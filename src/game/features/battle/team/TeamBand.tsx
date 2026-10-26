/**
 * 3:3 띠 (#95 — 기획 의논 "이름 컷인 = 3:3 띠 하나: 남색 + 금 테두리 · 얼굴 + 이름 · 위쪽 1.8초") — DOM. 3:3 용 필살기 판 연출은 컷인 · 어둠 · 큰 이름을 안 그림 (개발 noIntro).
 * 혼자 필살기 = 쓴 포켓몬 얼굴 + "이름 · 필살기!" · 합동 = 참가자 얼굴 + "이름 × 이름 · 합동 필살기!" · 힘겨루기 = "이름 VS 이름 · 필살기 힘겨루기" ·
 * 힘겨루기 끝 = "이겼다!" (금) / "졌다…" (빨강) 1초. 상대 필살기는 빨강 테두리.
 * 시작 = 엔진 상태가 바뀐 때 (혼자 = 합동 멘트가 끝난 뒤 · 합동 = joint 가 생긴 때 · 힘겨루기 = clash 가 생긴 때 — 개발 a6), 길이는 진짜 시계 (늦춤 0.3초만 게임 시계 · 엔진 ult.ms 는 맞는 때 연출을 기다리며 멈춤).
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Side, TeamBattle } from '../../../core/engine';
import { speciesOf } from '../../../data';
import { Sprite } from '../../../ui/Sprite';
import { jointName } from './joint-names';
import { bandLeft } from './model';
import { realLater, realNow } from '../../../ui/real-clock';

/** 띠가 보이는 시간 (진짜 ms — 게임 배와 상관없이) — 이름 컷인 · VS (U1 1초 넘게 · 기획 1.8초) · 힘겨루기 결과 */
export const BAND_MS = 1800;
export const WIN_MS = 1300;
/** 띠 높이 (얼굴 20 + 위아래 1 + 테두리) — 쓰러짐 한 줄은 그 아래로 */
export const BAND_PX = 24;
/** 띠는 큰 연출이 생긴 뒤 이만큼 늦게 — 달려간 칸이 집으로 돌아오는 0.3초 (개발 a6 b751b73 · 아트 디렉터 #95 "달려간 채 판 · 띠가 뜸") */
export const BAND_DELAY_MS = 300;
/** 붙잡기 (쓰러짐 말이 붙어 있는 동안 — 붙은 뒤 1.2초) 의 끝 — 띠 시간 + 이만큼까지 (좁은 패널은 띠가 1.2초 보인 뒤에 말이 붙어 1.5초로는 말이 잘리던 것, UX 리뷰어 #95 8바퀴 1) */
export const HOLD_MAX_MS = 4000;

type Stage = 'short' | 'faintShort' | 'noface' | 'shorter' | 'vsTight' | 'noFaint';

export interface TeamBandView {
  key: string;
  kind: 'ult' | 'joint' | 'vs' | 'win' | 'lose';
  side: Side;
  who: { side: Side; slot: number; form: string }[];
  title: string;
  sub: string;
  /** VS — 얼굴 줄을 나누는 자리 (내 편 얼굴 수) */
  split?: number;
}

function bandOf(b: TeamBattle): TeamBandView | null {
  const name = (side: Side, i: number) => speciesOf(b[side][i]?.species ?? 0)?.name.ko ?? '';
  const who = (side: Side, i: number) => ({ side, slot: i, form: b[side][i]?.form ?? '' });
  if (b.phase === 'clash' && b.clash?.kind === 'ult') {
    const c = b.clash;
    return { key: `vs:${c.me[0]}:${c.foe[0]}`, kind: 'vs', side: 'me', who: [...c.me.map((i) => who('me', i)), ...c.foe.map((i) => who('foe', i))], title: 'VS', sub: '힘겨루기!', split: c.me.length };
  }
  const u = b.phase === 'ult' ? b.ult : null;
  if (!u) return null;
  if (u.joint) {
    if (u.joint.quick) return null;
    // 합동 이름 (joint-names — 켬 길은 큰 컷인이 말함 · 끔 길 띠엔 "합동!" 뿐이던 것, UX 리뷰어 #97 작음 4)
    const jn = jointName(u.joint.winners.map((i) => speciesOf(b[u.side][i]?.species ?? 0)?.types[0] ?? 'normal'));
    return { key: `joint:${u.side}:${u.joint.winners.join('')}`, kind: 'joint', side: u.side, who: u.joint.winners.map((i) => who(u.side, i)), title: u.joint.winners.map((i) => name(u.side, i)).join(' × '), sub: `합동 ${jn}!` };
  }
  if ((u.gather ?? 0) > 0) return null;
  return { key: `ult:${u.side}${u.from}:${u.name ?? ''}`, kind: 'ult', side: u.side, who: [who(u.side, u.from)], title: name(u.side, u.from), sub: u.name ? `${u.name}!` : '필살기!' };
}

/** 지금 보일 띠 — 엔진 상태가 바뀐 때부터 셈 (늦춤은 게임 시계 · 보이는 길이는 진짜 시계) (힘겨루기 결과 1초가 다른 띠보다 먼저) · 시간이 다 되면 다시 그리게 깨움 */
/** hold = 쓰러짐 말이 띠 끝에 붙어 있는 동안 띠를 붙잡음 (띠가 먼저 닫혀 말이 따로 줄로 옮겨 가며 튀던 것 — UX 리뷰어 #95 2바퀴) · 최대 BAND_MS + 1.5초 */
export function useTeamBand(b: TeamBattle, hold = false): TeamBandView | null {
  // due = 보이기 시작할 때 (게임 시계 — 늦춤 0.3초는 달려간 칸이 돌아오는 그림과 같은 시계) · seen = 처음 보인 때 (진짜 시계 — 보이는 길이는 게임 배와 상관없이,
  //   ▶▶ ×2 에서 1.8초 띠가 0.9초 · 붙잡기가 반이 되던 것 — UX 리뷰어 #95 13바퀴 큼 1)
  const cur = useRef<{ key: string; due: number; seen: number | null; view: TeamBandView } | null>(null);
  // 바로 앞 그림이 합동 멘트 (모으기 판) 였으면 띠를 늦추지 않음 — 달려간 칸이 없고, 이름 띠가 빔이 다 뻗은 뒤 0.4초에 뜨던 것 (아트 디렉터 #95 3바퀴 · bw-triple-7 글이 먼저)
  const gathered = useRef(false);
  const win = useRef<{ id: number; at: number; view: TeamBandView } | null>(null);
  const [, tick] = useState(0);
  const gnow = performance.now();
  const now = realNow();
  const next = bandOf(b);
  // VS 띠도 늦추지 않음 (720 아래는 1.1초 뒤 연타 안내가 넘겨받아 0.3초 늦으면 0.8 ~ 1.0초만 보이던 것 — UX 리뷰어 #95 7바퀴)
  if (next && next.key !== cur.current?.key) cur.current = { key: next.key, due: gnow + (next.kind === 'win' || next.kind === 'lose' || next.kind === 'vs' || gathered.current ? 0 : BAND_DELAY_MS), seen: null, view: next };
  else if (next && cur.current) cur.current.view = next;
  if (cur.current && cur.current.seen === null && gnow >= cur.current.due) cur.current.seen = now;
  const age = cur.current && cur.current.seen !== null ? now - cur.current.seen : -1;
  if (!next && cur.current && age >= (hold ? BAND_MS + HOLD_MAX_MS : BAND_MS)) cur.current = null;
  const end = [...b.log].reverse().find((e) => e.t === 'ult-clash-end');
  if (end && end.t === 'ult-clash-end' && end.id !== win.current?.id) {
    const lose = end.winner === 'foe';
    // 얼굴 = 그 줄의 주인 (#136 A — 합동 띠와 같은 모양): 이겼다! = 이긴 내 얼굴 · 졌다… = 진 내 얼굴 (상대 얼굴이면 "상대가 졌다" 로 거꾸로 읽히던 것 — UX 리뷰어 #96)
    const mine = end.me.map((i) => ({ side: 'me' as Side, slot: i, form: b.me[i]?.form ?? '' }));
    win.current = { id: end.id, at: now, view: { key: `win:${end.id}`, kind: lose ? 'lose' : 'win', side: end.winner, who: mine, title: lose ? '졌다…' : '이겼다!', sub: '' } };
  }
  // "이겼다!" 띠도 쓰러짐 말이 붙어 있는 동안 붙잡음 (0.3초 만에 말이 따로 상자로 옮겨 가던 것 — UX 리뷰어 #95 3바퀴)
  const winOn = win.current !== null && now - win.current.at < (hold ? WIN_MS + HOLD_MAX_MS : WIN_MS) && win.current.at > 0;
  gathered.current = b.phase === 'ult' && (b.ult?.gather ?? 0) > 0;
  // 합동 · 혼자 필살기 띠는 그 연출이 엔진에 있는 동안 계속 (합동 한 장면 약 3초 > 1.8초라 빔 · 터짐 한가운데에 띠가 꺼졌다 다시 펼쳐지던 것 — 아트 디렉터 #95 3바퀴)
  const live = !!next && next.key === cur.current?.key && (next.kind === 'joint' || next.kind === 'ult');
  const bandOn = cur.current !== null && age >= 0 && (live || age < (hold ? BAND_MS + HOLD_MAX_MS : BAND_MS));
  const shown = winOn ? win.current!.view : bandOn ? cur.current!.view : null;
  const until = winOn ? win.current!.at + (hold ? WIN_MS + HOLD_MAX_MS : WIN_MS) : bandOn ? cur.current!.seen! + BAND_MS : 0;
  const due = cur.current && cur.current.seen === null ? cur.current.due : 0;
  useEffect(() => {
    if (!until) return;
    return realLater(() => tick((n) => n + 1), Math.max(16, until - realNow() + 16));
  }, [until]);
  // 늦춤 끝 (게임 시계)
  useEffect(() => {
    if (!due) return;
    const t = window.setTimeout(() => tick((n) => n + 1), Math.max(16, due - performance.now() + 16));
    return () => window.clearTimeout(t);
  }, [due]);
  return shown;
}

/** 띠 — 정보줄 아래 가운데 · 얼굴 = 그 포켓몬 걷기 그림 ×1 (24 × 20 창 · 실제 그림 범위 가운데) (left/right 0 + margin auto — translateX(−50%) 면 홀수 폭에서 반 픽셀) · 넘치면 뒷말 (· 필살기!) 을 뺌 (재서, 맥 여유 10%) */
export function TeamBand({ view, media, top, faint, faintShort, wide = false, tight = false }: { view: TeamBandView; media: string; top: number; /** 같은 줄 끝에 붙는 쓰러짐 말 */ faint?: string | null; /** 넘칠 때 쓰러짐 말 ("2마리 쓰러졌다!") */ faintShort?: string | null; /** 좁은 패널 = 패널 폭 판 · 글은 왼쪽부터 */ wide?: boolean; /** 아주 좁은 패널 — 이겼다 · 졌다는 처음부터 첫 얼굴 하나 (쓰러짐 말이 붙는 순간 얼굴 셋 → 하나로 줄며 "이겼다!" 가 60px 옮겨 가던 것 — UX 리뷰어 #96) */ tight?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  // (좁은 패널은 띠가 1.2초 보인 뒤에 쓰러짐 말을 붙임 — TeamLayer 가 정함 · 붙은 때부터 띠 붙잡기를 셈)
  // 넘치면 한 단계씩 (U4 — 재서, 맥 여유 10%): 1 = 혼자 · 합동은 포켓몬 이름, VS 는 뒷말 뺌 · 2 = 쓰러짐 말을 "N마리 쓰러졌다!" 로 · 3 = 얼굴 뺌 (혼자 · 합동 — 필살기 이름보다 먼저,
  //   "플레어드라이브! │ 레디바 쓰러졌다!" — UX 리뷰어 #95 7바퀴 1) · 4 = 뜻 (필살기 이름 · 합동!) 도 빼고 얼굴 + 쓰러짐 말만
  //   — 240 에서 합동 셋 이름이 19px 넘쳐 잘리던 것 (픽셀 검사원 #95) · 240 "이겼다! · 2마리 쓰러졌다!" (아트 디렉터 #95 4바퀴 ②) · 내용 (띠 · 쓰러짐 말) 이 바뀌면 0 단계부터 다시 ·
  //   견주는 폭 = 처음 자리 (왼쪽 고정) 에서 오른쪽 8 까지 — 줄이기를 먼저 하고 가운데로 옮기는 것은 마지막 (480 합동 띠에 쓰러짐 말이 붙어 50px 왼쪽으로 가던 것, UX 리뷰어 #95 7바퀴 8)
  // 줄이는 단계 (띠 종류마다) — VS 는 뒷말 → 얼굴 줄이기 (내 첫 얼굴 · 상대 첫 얼굴만) → 쓰러짐 말 N마리 → 쓰러짐 말 빼기 (240 에서 얼굴 넷 + "2마리 쓰러졌다!" 가 끝 단계에서도
  //   넘쳐 잘리던 것 — UX 리뷰어 #95 11바퀴 3 · 이름은 얼굴을 줄인 뒤에 줄임 — 11바퀴 5)
  //   VS 는 얼굴부터 줄임 ("힘겨루기!" 가 끼어든 얼굴이 늘 때 0.83 ~ 0.87초에 빠지던 것 — UX 리뷰어 #95 12바퀴 7)
  //   VS 는 쓰러짐 말 N마리를 "힘겨루기!" 빼기보다 먼저 (240 · 300 에서 쓰러짐 말이 붙으면 "힘겨루기!" 가 한 번도 안 보이던 것 — UX 리뷰어 #95 13바퀴 7)
  //   이겼다 · 졌다 는 얼굴을 빼도 "이겼다!" 는 남김 (뜻이 먼저 — #136 얼굴) · 얼굴은 첫 얼굴 하나 → 없음 (240 에서 쓰러짐 말이 붙는 순간 얼굴 셋이 다 빠져 글이 90px 옮겨 가던 것)
  const stages: Stage[] = view.kind === 'vs' ? ['vsTight', 'faintShort', 'short', 'noFaint'] : view.kind === 'ult' || view.kind === 'joint' ? ['short', 'faintShort', 'noface', 'shorter'] : ['short', 'faintShort', 'vsTight', 'noface'];
  const content = `${view.key}|${view.title}|${view.who.length}|${faint ?? ''}`;
  const [fit, setFit] = useState<{ content: string; step: number }>({ content, step: 0 });
  const step = fit.content === content ? fit.step : 0;
  // 왼쪽 끝 — 처음 뜬 자리 (가운데) 에 고정하고 글이 붙으면 오른쪽으로만 늘림 (쓰러짐 말이 붙는 순간 띠가 양쪽으로 50px 씩 벌어져 · "이겼다!" 64 → 208 로 튀던 것 — 픽셀 검사원 #95 4바퀴 ⑤ ⑨) ·
  //   오른쪽 끝이 패널 8px 안을 넘을 때만 왼쪽으로 · 정수 px (margin auto 면 37.813 처럼 소수)
  const anchor = useRef<{ key: string; left: number } | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const parent = el.parentElement?.clientWidth ?? window.innerWidth;
    const first = anchor.current?.key === view.key ? anchor.current.left : null;
    if (step < stages.length) {
      const kids = Array.from(el.children).filter((c) => (c as HTMLElement).getBoundingClientRect().width > 0);
      const need = kids.reduce((w, c) => w + (c as HTMLElement).getBoundingClientRect().width, 0) + 6 * Math.max(0, kids.length - 1) + 14;
      const avail = wide || first === null ? parent - 16 : parent - 8 - first;
      if (need * 1.1 > avail) {
        // 줄일 것이 없는 단계는 건너뜀 (쓰러짐 말 줄이기 · 빼기는 말이 있을 때만)
        let next = step + 1;
        while (next < stages.length && ((stages[next - 1] === 'faintShort' && !(faint && faintShort)) || (stages[next - 1] === 'noFaint' && !faint))) next++;
        setFit({ content, step: next });
        return;
      }
    }
    const left = wide ? 8 : bandLeft(parent, Math.ceil(el.getBoundingClientRect().width), first);
    anchor.current = { key: view.key, left: first ?? left };
    el.style.left = `${left}px`;
    el.style.right = 'auto';
    el.style.marginLeft = '0';
    el.style.marginRight = '0';
  });
  const on = (s: Stage) => stages.slice(0, step).includes(s);
  const winTight = tight && (view.kind === 'win' || view.kind === 'lose');
  const cls = ['pg-team-band', `pg-band-${view.kind}`, view.side === 'foe' && (view.kind === 'ult' || view.kind === 'joint') ? 'pg-band-foe' : '', on('short') ? 'pg-band-short' : '', on('vsTight') || winTight ? 'pg-band-vstight' : '', on('noface') && !on('shorter') ? 'pg-band-noface' : '', on('shorter') ? 'pg-band-shorter' : '', wide ? 'pg-band-wide' : ''].filter(Boolean).join(' ');
  const faintText = on('noFaint') ? null : faint && on('faintShort') && faintShort ? faintShort : faint;
  return (
    <div key={view.key} ref={box} class={cls} style={{ top: `${top}px` }}>
      {view.who.slice(0, 6).map((w, i) => (
        <span key={`${w.side}${w.slot}`} class={view.split !== undefined && i === view.split ? 'pg-band-face pg-band-vs-gap' : 'pg-band-face'} aria-hidden="true">
          <Sprite media={media} form={w.form} scale={1} px={32} crop={20} cropWidth={24} center action="walk" faceLeft={w.side === 'foe'} />
        </span>
      ))}
      {view.kind !== 'vs' && <b class="pg-band-title">{view.title}</b>}
      {view.sub && <span class="pg-band-sub">{view.sub}</span>}
      {faintText && <span class="pg-band-faint">{faintText}</span>}
    </div>
  );
}

