/**
 * S09 3:3 실시간 팀 배틀 화면 (orders #17 3단계 — 디자인팀 4안: 띠 · 카드 없이 포켓몬 발밑 판이 전부).
 * 기능 뼈대 — 자리 · 판 상태 · 안내는 model.ts (시안 geo 그대로), 모양은 디자인팀 (클래스 pg-team-*). 연출은 일반 모드 그대로 (fx/team.ts TeamFxRunner).
 * 누르기: 발밑 판 · 포켓몬 = 그 칸 필살기 (쓰기 · 예약 · 끼어들기 · 합류) — 키 1 · 2 · 3 · Z · Space 는 main.ts.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import { TIMING } from '../../../core/balance';
import { teamAutoUltLeft, teamAutoUltNext, type GameInput, type Side, type TeamBattle } from '../../../core/engine';
import { formOf, speciesOf } from '../../../data';
import { koSinkPx } from '../model';
import { Sprite } from '../../../ui/Sprite';
import type { FxActor } from '../fx/bridge';
import { TeamFxRunner, type TeamSlot } from '../fx/team';
import { foeWarn, plateState, teamGeometry, teamPrompt, type TeamGeo } from './model';
import './team.css';

const SIDES: Side[] = ['me', 'foe'];

function Bar({ v, kind }: { v: number; kind: 'hp' | 'ult' | 'ult-full' }) {
  const pct = Math.max(0, Math.min(1, v));
  const tone = kind === 'hp' ? (pct > 0.5 ? 'pg-team-hp-ok' : pct > 0.2 ? 'pg-team-hp-mid' : 'pg-team-hp-low') : kind === 'ult-full' ? 'pg-team-ult-full' : '';
  return (
    <span class={`pg-team-bar pg-team-bar-${kind === 'hp' ? 'hp' : 'ult'}`}>
      <span class={`pg-team-fill ${tone}`} style={{ width: `${Math.round(pct * 100)}%` }} />
    </span>
  );
}

function Fighter({ b, g, side, slot, media, topMin, final, autoNext, onUlt }: { b: TeamBattle; g: TeamGeo; side: Side; slot: number; media: string; topMin: number; final: boolean; autoNext: boolean; onUlt(slot: number): void }) {
  const f = b[side][slot]!;
  const { x, y } = g.pos(side, slot);
  const st = plateState(b, side, slot);
  const mine = side === 'me';
  const w = mine ? g.pw : g.pw - 16;
  const warn = side === 'foe' ? foeWarn(b, slot) : null;
  const pops = b.popups.filter((p) => p.side === side && p.slot === slot);
  const name = speciesOf(f.species)?.name.ko ?? f.form;
  const autoLeft = mine && autoNext ? teamAutoUltLeft(b, slot) : null;
  // 필살기 힘겨루기 중엔 끼어들 수 있는 칸 (join) 만 합류 — 나머지는 바깥 (연타) 으로 (누를 때마다 예약이 켜졌다 꺼지던 것 — 코드 리뷰어)
  const click =
    mine && st !== 'down' && (b.phase !== 'clash' || st === 'join')
      ? (e: MouseEvent) => {
          if (b.phase === 'clash') e.stopPropagation();
          onUlt(slot);
        }
      : undefined;
  return (
    <>
      {/* 포켓몬 — 발 가운데 (x, y) · 칸 = 32 × 배율 (그림 발끝이 칸 아래 3점 위) */}
      <span
        // 마지막 한 방 (판을 끝낸 ko) = 벌러덩 90° · 그 밖의 쓰러짐 = 회색 주저앉기 (2026-10-21 태현 님 B — 1:1 과 같은 값, game.css pg-ko)
        class={`pg-team-mon pg-team-${side}${st === 'down' ? ' pg-team-down' : ''}${st === 'down' && final ? ' pg-team-ko' : ''}`}
        data-team={`${side}-${slot}`}
        style={{ left: `${x - g.sp / 2}px`, top: `${y - g.sp + 3 * g.scale}px`, width: `${g.sp}px`, height: `${g.sp}px` }}
        title={`${name} Lv${f.level}${mine && st !== 'down' ? ` — ${slot + 1} 필살기` : ''}`}
        onClick={click}
      >
        <span class="pg-team-body" style={st === 'down' && final ? { '--pg-back': mine ? '-1' : '1', '--pg-ko-y': `${koSinkPx(f.form, g.sp)}px` } : undefined}>
          <Sprite media={media} form={f.form} shiny={f.shiny} scale={g.scale} action="walk" faceLeft={!mine} />
        </span>
      </span>
      {/* 발밑 판 — 키 칸 (내 편) + HP + 필살기 게이지 */}
      <span class={`pg-team-plate pg-team-plate-${side} pg-plate-${st}`} style={{ left: `${Math.round(x - w / 2)}px`, top: `${y + 4}px`, width: `${w}px` }} onClick={click}>
        {mine && <span class="pg-team-key">{slot + 1}</span>}
        <span class="pg-team-bars">
          <Bar v={f.hp / Math.max(1, f.maxHp)} kind="hp" />
          {st !== 'down' && <Bar v={f.ult} kind={st === 'charge' ? 'ult' : 'ult-full'} />}
        </span>
        {/* 상대 필살기 예고 = 상대 발밑 판 오른쪽 칩 (1:1 이 상대 HP 줄 안인 것과 같은 자리 — 머리 위에 두면 그 상대의 피해 숫자를 덮어 "−1" 이 0px 이던 것, 픽셀 검사원 2차) */}
        {warn && (
          <span class={`pg-team-warn${warn.full ? ' pg-team-warn-full' : ''}`} title={warn.full ? '상대 필살기가 다 찼어요' : `상대 필살기 ${warn.pct}% — 곧`}>
            {warn.full ? '!' : '곧'}
          </span>
        )}
        {/* 다 찬 필살기 누를 틈 (기획 R2 — 볼 때 3초 뒤 저절로) = 판 오른쪽 숫자 3 · 2 · 1 (1:1 Z 모서리와 같은 칩 · 나갈 때까지 1 — 게이지를 줄이면 "필살기가 빠져나간다" 로 읽히던 것, UX 리뷰어) */}
        {/* 세는 때 (지금 쓸 수 있는 칸 — ready) 만 · "3초" 칠 없는 금 테두리 (키 칩과 다른 모양) · 판 밖 (판 안이면 HP 막대가 줄던 것) — UX 리뷰어 2차 */}
        {/* 먼저 나갈 한 칸만 · 판 왼쪽 위 탭 (판 오른쪽 바깥이면 240 에서 다음 칸 포켓몬 몸을 덮고 · 셋 다 "1초" 인데 하나만 나가던 것 — UX 리뷰어 3차) */}
        {/* 바로 나가는 칸 (HP 30% 아래 — 0ms) 은 칩 없음 (1장면만 비치던 것 — UX 리뷰어 R9 ⑥) */}
        {autoLeft !== null && autoLeft > 0 && st === 'ready' ? (
          <span class="pg-team-auto" title={`${Math.max(1, Math.ceil(autoLeft / 1000))}초 뒤 저절로 필살기 — 지금 ${slot + 1} 로 바로`}>
            {Math.max(1, Math.ceil(autoLeft / 1000))}초
          </span>
        ) : (
          // 필살기는 눌러야만 나감 (태현 님 #82) — 다 찬 칸 = 같은 자리 "다 참" (남은 초 대신 · 내 편만)
          mine && st === 'ready' && (
            <span class="pg-team-auto pg-team-full" title={`필살기 다 참 — ${slot + 1} 누르면 나가요`}>
              다 참
            </span>
          )
        )}
      </span>

      {/* 피해 숫자 · 짧은 말 — 머리 위 */}
      {/* 칸마다 쌓음 (쓰러짐 말 · 피해 숫자가 같은 자리에 겹치던 것) · 지도 줄 아래로 막음 · 한 줄 배치 · ×1 (좁은 패널 — 셋이 가까움) 은 칸마다 높이를 엇갈림 — UX 리뷰어 */}
      {pops.map((p, i) => (
        <span key={p.id} class={`pg-team-pop pg-pop-${p.kind}`} style={{ left: `${x}px`, top: `${Math.max(topMin + 15 * (pops.length - 1 - i) + (slot % 3) * 15, y - g.sp - 4 - 15 * i - (g.oneRow || g.scale === 1 ? (slot % 3) * 15 : 0))}px` }}>
          {p.text}
        </span>
      ))}
    </>
  );
}

/** 쓰러짐 말이 이만큼 보인 뒤에 좁은 패널 합동 · 끼어들기 띠 (U1 — 1초) */
const FAINT_SAY_MS = 1000;

export function TeamLayer({ team: b, media, widthPx, heightPx, infoBarPx, fieldTopPx = 0, onInput }: { team: TeamBattle; media: string; widthPx: number; heightPx: number; infoBarPx: number; fieldTopPx?: number; onInput(i: GameInput): void }) {
  const g = useMemo(() => teamGeometry(widthPx, heightPx, infoBarPx), [widthPx, heightPx, infoBarPx]);
  const root = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const runner = useRef<TeamFxRunner | null>(null);
  const bRef = useRef<TeamBattle | null>(b);
  bRef.current = b;
  // 연출 다리 — 그 칸 그림 (FxActor) 은 이 화면 안에서 찾음
  if (!runner.current) {
    runner.current = new TeamFxRunner({
      actor: (w: TeamSlot): FxActor | null => {
        const box = root.current?.querySelector<HTMLElement>(`[data-team="${w.side}-${w.slot}"]`);
        const el = box?.querySelector<HTMLElement>('.pg-sprite') ?? null;
        const f = bRef.current?.[w.side][w.slot];
        if (!box || !el || !f || box.getBoundingClientRect().width < 1) return null;
        return { el, box, form: f.form, size: formOf(f.form)?.size ?? 32, left: w.side === 'foe', name: speciesOf(f.species)?.name.ko ?? '' };
      },
      layer: () => layer.current,
    });
  }
  useEffect(() => {
    runner.current?.update(b);
  }, [b]);
  useEffect(() => () => runner.current?.reset(), []);
  const prompt = teamPrompt(b);
  // 판을 끝낸 마지막 ko (끝 바로 앞 ko 한 방 — fx/team 의 final 과 같은 규칙) · 맞은 쪽 = 친 쪽 반대
  const finalKo = useMemo(() => {
    if (b.phase !== 'over') return null;
    const end = b.log.findIndex((e) => e.t === 'end');
    const hit = [...(end >= 0 ? b.log.slice(0, end) : b.log)].reverse().find((e) => e.t === 'hit' && e.ko);
    return hit?.t === 'hit' ? `${hit.side === 'me' ? 'foe' : 'me'}-${hit.to}` : null;
  }, [b.phase, b.log]);
  // 숫자 · 말 · 예고의 아래 끝 (translate −100%) 이 지도 줄 아래 + 2 보다 위로 가지 않게 (글 높이 약 14)
  const topMin = infoBarPx + fieldTopPx + 2 + 14;
  // 안내 (끼어들기 · 합동 · 연타) 자리 — 넓으면 무대 아래 가운데 (위 가운데는 필살기 컷인 이름 자리), 좁으면 정보줄 + 4 (정보줄 밑에 숨던 것 — UX 리뷰어)
  // 아래 가운데는 720 부터 (400 ~ 719 는 안내 폭 약 200 이 앞줄 발밑 판 — 끼어들 3번 판까지 — 을 덮던 것, UX 리뷰어 R9 ⑥)
  const low = widthPx >= 720;
  const promptStyle = low ? { top: 'auto', bottom: '4px' } : { top: `${infoBarPx + 4}px` };
  // 좁은 패널 (400 아래) — 띠가 폭 전체라 머리 위 "… 쓰러졌다!" 를 덮음: 그 말이 1초 보일 때까지 합동 · 끼어들기 띠를 늦게 그림 (0.85 ~ 0.93초에 덮던 것 — UX 밤 점검 U1, 막대 1.5초라 띠도 1초 넘게) · 키는 그대로 받음
  const faintFresh = widthPx < 400 && b.popups.some((p) => p.text.endsWith('쓰러졌다!') && p.ms < FAINT_SAY_MS);
  // 엔진 한 줄 (필살기 · 합류 · 결과) 은 판 끝 결과만 · 쓰러지는 장면이 0.9초 보인 뒤 (컷인 이름을 가리고 · 지난 필살기 줄이 남던 것 — UX 리뷰어)
  const msgOn = b.phase === 'over' && b.overMs >= 900 && !!b.msg;
  const ult = (slot: number) => onInput({ kind: 'team-battle', input: { kind: 'ult', slot } });
  // 큰 판 (끼어들기 · 합동) 은 무대 한가운데 — 폭 · 높이를 재서 왼쪽 · 위를 정수 px 로 (translate −50% 는 홀수 폭이면 반 픽셀)
  const bigBox = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = bigBox.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const midY = infoBarPx + (heightPx - infoBarPx) / 2;
    el.style.left = `${Math.round(Math.max(8, Math.min(widthPx - 8 - r.width, g.cx - r.width / 2)))}px`;
    el.style.top = `${Math.round(Math.max(infoBarPx + fieldTopPx + 2, midY - r.height / 2))}px`;
  });
  // 머리 위 말 · 숫자를 패널 양 끝 2px 안으로 (끝 칸의 "버섯꼬 쓰러졌다!" 의 "!" · "리자드" 의 "리" 가 잘리던 것 — UX 리뷰어 R9 ⑥, U4) · 정수 px
  // 처음 안내 (위 · 3:3 저절로 필살기) 와 겹치면 안내 아래 2px 로 내림 — 이 층 (z 5) 이 안내 (z 7) 아래라 240 에서 "레디바 쓰러졌다!" 첫 글자가 1.2초 숨던 것 (#59 UX 다시 보기 · 480 "-7" 의 "-" 도)
  useLayoutEffect(() => {
    const W = window.innerWidth;
    const tip = root.current?.closest('#pokemon-game')?.querySelector<HTMLElement>('.pg-first-tip.pg-first-tip-top')?.getBoundingClientRect();
    root.current?.querySelectorAll<HTMLElement>('.pg-team-pop').forEach((el) => {
      el.style.marginLeft = '0px';
      el.style.marginTop = '0px';
      const r = el.getBoundingClientRect();
      const shift = r.left < 2 ? 2 - r.left : r.right > W - 2 ? W - 2 - r.right : 0;
      if (shift) el.style.marginLeft = `${Math.round(shift)}px`;
      if (tip && tip.height > 0 && r.left + shift < tip.right && r.right + shift > tip.left && r.top < tip.bottom && r.bottom > tip.top) el.style.marginTop = `${Math.ceil(tip.bottom + 2 - r.top)}px`;
    });
  });
  // 저절로 나갈 칸 하나 = 엔진이 기다림을 세는 칸 (teamAutoUltNext — HP 30% 아래 칸 먼저, 아니면 먼저 찬 칸 · 둘째 칸 칩이 1장면만 보이던 것, 개발 4016471)
  const autoNext = teamAutoUltNext(b);
  return (
    // 자리는 패널 기준 (시안 geo) — 이 층은 들판 (정보줄 아래) 안이라 정보줄 높이만큼 위로
    <div class={`pg-team pg-team-x${g.scale}${g.oneRow ? ' pg-team-row' : ''}`} style={{ top: `${-infoBarPx}px` }} ref={root} onClick={b.phase === 'clash' ? () => onInput({ kind: 'team-battle', input: { kind: 'space' } }) : undefined}>
      {SIDES.map((side) => b[side].map((_, slot) => <Fighter key={`${side}-${slot}`} b={b} g={g} side={side} slot={slot} media={media} topMin={topMin} final={finalKo === `${side}-${slot}`} autoNext={side === 'me' && slot === autoNext} onUlt={ult} />))}
      {/* 연출 층 — 비어 있는 상자 (Preact 는 안을 안 건드림), 연출 다리가 캔버스를 넣음 */}
      <div class="pg-fxlayer pg-team-fx" ref={layer} />
      {/* 안내 — 무대 가운데 위 */}
      {/* 끼어들기 · 합동 = 무대 한가운데 큰 판 (태현 님 #81 "화면 가운데에 크게 띄우고 2초 넘게 확실히" — 아래 · 위 가운데 작은 한 줄이 빨리 지나가 몰랐던 것) ·
          금 제목 · 큰 키 칸 · 아래 4px 남은 막대 · 누를 틈은 엔진 (합동 약 2.5초 · 끼어들기 약 2.2초) · 자리는 재서 정수 px (반 픽셀이면 2px 금 테두리가 흐림) */}
      {prompt?.kind === 'join' && !faintFresh && (
        <div class="pg-team-prompt pg-team-prompt-join pg-team-prompt-big" ref={bigBox}>
          <b class="pg-team-big-title">
            {/* 상대가 합동으로 모이는 중 = 빨강 "상대 합동!" (내 편 멘트와 같은 말이던 것 — 기획 #24-4) */}
            {prompt.foeJoint && <span class="pg-team-foe-joint">{widthPx < 400 ? '상대 합동 · ' : '상대 합동! · '}</span>}
            끼어들기
          </b>
          <span class="pg-team-big-keys">
            {prompt.keys.map((k) => (
              <span key={k} class="pg-team-who" onClick={() => ult(k - 1)}>
                <span class="pg-team-key pg-team-key-on">{k}</span>
              </span>
            ))}
            {/* 머릿수 (기획 #24-3) — 받아치면 나 1 대 상대 쓴 포켓몬 + 모인 동료 · 1 대 3 이면 빨강 "받아치면 짐" (확정 패배) · "1:1" 은 만남의 "1:1 승부" 와 같은 글이라 "대" (개발 UX #59) */}
            <span class={`pg-team-odds${prompt.sure === 'foe' ? ' pg-team-sure-foe' : ''}`}>{`${prompt.me} 대 ${prompt.foe}${prompt.sure === 'foe' ? (widthPx < 400 ? ' 짐' : ' 받아치면 짐') : ''}`}</span>
          </span>
          <span class="pg-team-left" style={{ width: `${Math.round(prompt.left * 100)}%` }} />
        </div>
      )}
      {prompt?.kind === 'gather' && !faintFresh && (
        <div class="pg-team-prompt pg-team-prompt-gather pg-team-prompt-big" ref={bigBox}>
          <b class="pg-team-big-title">{widthPx < 400 ? '합동!' : '합동 필살기!'}</b>
          <span class="pg-team-big-keys">
            {prompt.who.map((w) => (
              <span key={w.key} class="pg-team-who" onClick={() => ult(w.key - 1)}>
                <span class="pg-team-key pg-team-key-on">{w.key}</span>
                <span class="pg-team-big-name">{w.name}</span>
              </span>
            ))}
          </span>
          <span class="pg-team-left" style={{ width: `${Math.round(prompt.left * 100)}%` }} />
        </div>
      )}
      {/* 연타 — VS · 맞닿기 (ultClashLeadMs) 뒤부터 (엔진도 그때부터 셈) */}
      {prompt?.kind === 'mash' && (b.clash?.ms ?? 0) >= TIMING.team.ultClashLeadMs && (
        <div class="pg-team-prompt pg-team-prompt-mash" style={promptStyle}>
          {/* 정해진 힘겨루기 (3:1 · 1:3) 는 연타가 소용없어 결과만 (디자인팀 UX R9 ⑥ U5) */}
          {prompt.sure === 'me' ? <b class="pg-team-sure">3 대 1 — 이길 거예요</b> : prompt.sure === 'foe' ? <b class="pg-team-sure pg-team-sure-foe">1 대 3 — 질 거예요</b> : <b>{`${prompt.me} 대 ${prompt.foe}`}</b>}
          {!prompt.sure && (
            <>
              <span class="pg-team-key">Space</span> 연타
            </>
          )}
        </div>
      )}
      {/* 결과 · 엔진 한 줄 (합류 · 힘겨루기 결과 · 이김 · 짐) — 안내가 없을 때 */}
      {msgOn && (
        <div class="pg-team-msg pg-team-msg-over" style={{ top: `${infoBarPx + fieldTopPx + 4}px` }}>
          {b.msg}
        </div>
      )}
    </div>
  );
}
