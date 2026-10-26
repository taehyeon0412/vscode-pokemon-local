/**
 * S09 3:3 실시간 팀 배틀 화면 (orders #17 3단계 — 디자인팀 4안: 띠 · 카드 없이 포켓몬 발밑 판이 전부).
 * 기능 뼈대 — 자리 · 판 상태 · 안내는 model.ts (시안 geo 그대로), 모양은 디자인팀 (클래스 pg-team-*). 연출은 일반 모드 그대로 (fx/team.ts TeamFxRunner).
 * 누르기: 발밑 판 · 포켓몬 = 그 칸 필살기 (쓰기 · 끼어들기 · 합류 — 예약 없음, 못 쓰면 판 흐림 + 정보줄 위 한 줄 #88 — StageScreen) — 키 1 · 2 · 3 · Z · Space 는 main.ts.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { TIMING } from '../../../core/balance';
import { teamAutoUltLeft, teamAutoUltNext, teamFoeNext, teamLit, type GameInput, type Side, type TeamBattle } from '../../../core/engine';
import { formOf, speciesOf } from '../../../data';
import { spriteBoxOf, walkBoxOf } from '../../../data/sprite-boxes';
import { battleSpritePx, koSinkPx, TYPE_COLOR } from '../model';
import { Sprite } from '../../../ui/Sprite';
import type { FxActor } from '../fx/bridge';
import { TEAM_FX, TeamFxRunner, type TeamSlot } from '../fx/team';
import { bandDrawn, DUEL_VS_MS, VIEW_CHIP_MS, VIEW_WAIT_MS, duelSpots, faintHoldLeft, faintIsBig, faintShortLine, foeWarn, overLineHold, keepJointChips, plateBoxOf, plateState, stackRows, teamDenyNote, teamGeometry, teamPrompt, viewHitChip, viewPopsBack, warnPosOf, type TeamGeo, type WarnPos, viewCrossers, viewMonClass } from './model';
import { HEAD_NOTE_H, HeadNote, headNoteWidth, pickHeadSpot, useHeldNote } from '../../../ui/HeadNote';
import { getTeamView, subscribeTeamView, type TeamView } from '../fx/team-view';
import { cutinArtH, JointNamePlate, TeamCutin } from './TeamCutin';
import { jointName } from './joint-names';
import { BAND_PX, TeamBand, useTeamBand, type TeamBandView } from './TeamBand';
import { topGapPx } from '../../../ui/layout';
import { realLater, realNow } from '../../../ui/real-clock';
import { withJosa } from '../../../core/text';
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

/** 무대 (.pg-team) 의 떠 있는 머리 글 상자 — 무대 기준 (칩 자리를 고를 때 피함 · 그린 뒤라 한 그림 전 자리) */
function headNoteBoxes(): Rect[] {
  const stage = document.querySelector<HTMLElement>('#pokemon-game .pg-team');
  if (!stage) return [];
  const sr = stage.getBoundingClientRect();
  return [...stage.querySelectorAll<HTMLElement>('.pg-head-note')].map((n) => {
    const r = n.getBoundingClientRect();
    return { l: r.left - sr.left - 1, t: r.top - sr.top - 1, r: r.right - sr.left + 1, b: r.bottom - sr.top + 1 };
  });
}

/** 그림 칸 (그린 크기 px · 원본 한 점 = s px · 발끝 줄) — 보통 = 32 × k · 발끝 29 (원본 아래 3 위) · 큰 포켓몬 (원본 64) = 1:1 과 같은 보통 키 × 1.3 (battleSpritePx) ·
 *  큰 포켓몬 발끝 = 걷기 그림 실제 발끝 (sprite-walk) − 2 (보통과 같은 땅 묻힘 — 원본 58 로 셈하면 대검귀가 4px 아래로 내려가 판과 겹치던 것, 픽셀 검사원 #92).
 *  ×1 무대 (폭 400 아래) 의 큰 포켓몬은 원본 ÷ 2 = 32 (×1.3 = 42 는 원본 0.66 배라 점이 뭉개지던 것 — 아트 디렉터 #92 · 칩과 같은 2:1) */
function artOf(form: string, k: number): { px: number; s: number; foot: number } {
  const n = formOf(form)?.size ?? 32;
  const px = k === 1 && n > 32 ? n / 2 : battleSpritePx(form, k, Number.POSITIVE_INFINITY);
  const foot = n > 32 ? (walkBoxOf(form)?.[1] ?? n - 1) - 2 : n - (3 * n) / 32;
  return { px, s: px / n, foot };
}

/** 발밑 그림자 자리 · 크기 — 그림 실제 폭 (sprite-boxes) × 0.6 을 2k 단위로 · 줄 높이 u = k (그림 점 하나) · 가운데 = 그림 발끝 ·
 *  가로 가운데 = 그림 실제 범위 가운데 (칸 가운데면 이상해씨 −6 · 레디바 +8px 어긋나던 것 — 픽셀 검사원) · 상대는 왼쪽을 봐서 좌우 뒤집음 · 자리는 k 칸 격자 (×2 top 55 → 56) */
function shadowStyle(form: string, g: TeamGeo, flip: boolean, artTop: number): Record<string, string> {
  const k = g.scale;
  const box = spriteBoxOf(form);
  const n = formOf(form)?.size ?? 32;
  const { px, s, foot } = artOf(form, k);
  const vis = box ? (box[2] - box[0]) * s : px;
  const w = Math.max(k === 1 ? 12 : 20, Math.min(20 * k, Math.round((vis * 0.6) / (2 * k)) * 2 * k));
  const u = k;
  const mid = box ? (flip ? n - (box[0] + box[2]) / 2 : (box[0] + box[2]) / 2) : n / 2;
  const cx = mid * s;
  const snap = (v: number) => Math.round(v / k) * k;
  return { left: `${snap(cx - w / 2)}px`, top: `${snap(artTop + foot * s - 1.5 * u) - artTop}px`, width: `${w}px`, '--pg-sh-u': `${u}px`, '--pg-sh-in': `${2 * k}px` };
}

/** 같은 때 (0.3초 안 — 3:1 마무리는 상대마다 몇 ms 씩 늦게 맞아 "합동! −12" · "합동! −11" 칩 둘이던 것, 아트 디렉터 #95 4바퀴 ④ · 개발 e5cce66) 합동 피해 */
const JOINT_SAME_MS = 300;
const sameJoint = (a: number, b: number) => Math.abs(a - b) < JOINT_SAME_MS;
/** 같은 때 합동 피해를 받은 칸들 중 가운데 칸 (칩을 놓을 곳) */
function jointHome(all: readonly { ms: number; slot: number }[], ms: number): number {
  const slots = [...new Set(all.filter((p) => sameJoint(p.ms, ms)).map((p) => p.slot))].sort((a, b) => a - b);
  return slots[Math.floor((slots.length - 1) / 2)] ?? -1;
}

/** 숫자 (피해 · 회복) — 같은 칸 0.3초 안 숫자는 하나로 합쳐 0.7초만 (기획 #95 — 숫자 4개 · 말 둘이 몰려 한 화면 15개이던 것, 3:3 점검 · 원작은 숫자 0) */
const NUM_KINDS = new Set(['damage', 'super', 'weak', 'crit', 'heal']);
const NUM_MERGE_MS = 300;
const NUM_SHOW_MS = 700;
const NUM_RANK: Record<string, number> = { weak: 0, damage: 1, crit: 2, super: 3 };
/** 쓰러짐 말 — 머리 위에서 빼고 무대 위 한 줄로 (여럿이면 "통통코 · 소미안 쓰러졌다!") */
const FAINT_RE = /\s*쓰러졌다!$/;

/** 패널 위 상자 (px) */
type Rect = { l: number; t: number; r: number; b: number };
const hits = (a: Rect, c: Rect) => a.l < c.r && a.r > c.l && a.t < c.b && a.b > c.t;
/** 보이는 그림 상자 — 가로 = 걷기 그림 왼쪽 끝 (walkBoxOf) 을 양쪽에 같게 (대기 그림 상자로 잡으면 걷기 그림과 13px 어긋나던 것 — 아트 디렉터 #95 7바퀴 ①) · 위 = 대기 그림 위 끝 · 아래 = 발끝 */
function visBoxOf(form: string, g: TeamGeo, side: Side, slot: number): Rect {
  const { x, y } = g.pos(side, slot);
  const art = artOf(form, g.scale);
  const n = formOf(form)?.size ?? 32;
  const monLeft = Math.round((x - art.px / 2) / g.scale) * g.scale;
  const wl = walkBoxOf(form)?.[0] ?? spriteBoxOf(form)?.[0] ?? 0;
  return { l: monLeft + Math.round(wl * art.s), t: y - Math.round(art.foot * art.s) + Math.round((spriteBoxOf(form)?.[1] ?? 0) * art.s), r: monLeft + Math.round((n - wl) * art.s), b: y };
}
type Block = { side: Side; slot: number; box: Rect; plate?: boolean };

/** 머리 위 말 · 숫자 쌓는 높이 — 한 줄 15 · 합동 칩 24 (칩 20 + 간격 1단 4 — 2 면 "쓰러졌다!" 가 칩 테두리에 붙던 것, 개발 #80 UX ④) */
const popGap = (ps: readonly { joint?: boolean }[]) => ps.reduce((h, p) => h + (p.joint ? 24 : 15), 0);

function Fighter({ b, g, side, slot, media, topMin, final, autoNext, fullChip, dim, big, warnChip, warnShow, warnPos, blocks, viewAt, vMon, vRest, skip, head, lineBand, onUlt }: { /** 버린 필살기 누름 — 이 칸 머리 왼쪽 위 작은 글 (TeamLayer 가 붙잡은 것 · 없으면 null) */ head: { key: string; value: { text: string; go: boolean; key: number | null }; step: number } | null; /** 머리 위 글이 피할 가로 줄 (시합장 흰 선 — 글 가운데를 지나 글자가 흐트러지던 것) */ lineBand: { t: number; b: number } | null; /** 장면 전환 (#99 시안) — 1:1 자리 (쏘는 칸 · 맞는 칸, 없으면 3:3 자리) */ viewAt: { x: number; y: number } | null; /** 장면 전환 칩이 이미 보인 숫자 (ideas 717 — 돌아온 뒤 다시 안 띄움) */ skip: ReadonlySet<number>; /** 포켓몬 칸 전환 클래스 (자리 옮김 · 숨김) */ vMon: string; /** 판 · 숫자 숨김 클래스 */ vRest: string; b: TeamBattle; g: TeamGeo; side: Side; slot: number; media: string; topMin: number; final: boolean; autoNext: boolean; fullChip: boolean; /** 다 찬 상대 중 먼저 나갈 한 칸 — 그 칸만 "!" 칩 (셋 다 뜨면 끼어들기 장면이 8 ~ 9개로 붐비던 것, 아트 디렉터 #95 2바퀴) */ warnChip: boolean; /** 상대 예고 칩을 보임 ("!" = 먼저 나갈 칸 · "곧" = 0.3초 이어진 뒤) */ warnShow: boolean; /** 상대 예고 칩 자리 (TeamLayer warnPosOf) */ warnPos: WarnPos; /** 모든 칸의 보이는 그림 · 발밑 판 상자 — 칩을 옆에 둘 때 피함 */ blocks: readonly Block[]; /** 큰 연출 (필살기 · 합동 · 힘겨루기) 중 주인공이 아닌 칸 — 흐리게 · 숫자 · 말 지움 (기획 #95) */ dim: boolean; /** 혼자 필살기에 맞는 칸 — 숫자 하나를 크게 */ big: boolean; onUlt(slot: number): void }) {
  const f = b[side][slot]!;
  const { x, y } = g.pos(side, slot);
  const st = plateState(b, side, slot);
  const mine = side === 'me';
  const w = mine ? g.pw : g.pw - 16;
  const warn0 = side === 'foe' ? foeWarn(b, slot) : null;
  const warn = warn0 && warnShow ? warn0 : null;
  const warnPlate = !!warn0?.full && !warnChip;
  // 다 참 · N초 칩 자리 — 판 왼쪽 2px (판 왼쪽 위 탭이면 자기 포켓몬 발 · 꼬리를 27 × 12 덮던 것 — 픽셀 검사원 #95 6바퀴 5) · 패널 왼쪽 밖이면 판 아래 2px ·
  //   한 줄 배치 (판 사이 14px — 칩이 안 들어감) 는 "다 참" 칩 없음 (다 찬 판 = 2px 금 테두리 + 금 키 칸이 이미 말함 · N초 는 숫자라 판 위 탭 그대로)
  //   다른 칸 그림 · 판 (금 테두리 바깥 4 까지) 과 겹치면 다음 자리 — 왼쪽 → 오른쪽 → 아래 → 판 위 탭 (240 판 아래 칩을 2번 판 금 테두리가 덮어 "참" 이 반쯤 가려지던 것, UX 리뷰어 #95 7바퀴 5)
  // 보이는 그림 상자 · 다른 칸 (그림 · 판) — 합동 칩 · 큰 숫자 판 · 다 참 칩 자리를 고를 때 피함 (다 참 칩보다 앞에 — 뒤에 두면 화면이 ReferenceError 로 멈춤)
  const autoLeft = mine && autoNext ? teamAutoUltLeft(b, slot) : null;
  const vis = visBoxOf(f.form, g, side, slot);
  const others = blocks.filter((o) => !(o.side === side && o.slot === slot));
  const plateB = plateBoxOf(g, side, slot);
  const gapA = st === 'ready' || st === 'join' ? 6 : 2;
  const grow = (r: Rect, d: number) => ({ l: r.l - d, t: r.t - d, r: r.r + d, b: r.b + d });
  //   자리 상자 = 실제 칩 폭 (다 참 26 · N초 22 — 30 으로 잡아 240 에서 왼쪽 자리를 1px 차로 놓치고 판 위 탭으로 밀려 자기 포켓몬을 다시 덮던 것, 아트 디렉터 #95 8바퀴 1) ·
  //   다 참은 자리가 없으면 칩을 뺌 (판 위 탭은 자기 포켓몬 몸을 덮음 — 다 찬 판 2px 금 테두리 + 금 키가 이미 말함, 한 줄 배치와 같은 규칙) · N초 (숫자) 는 판 위 탭 그대로
  //   (실제 폭 다 참 27.6 · 맥 30.9 — 26 으로 잡아 맥 240 에서 왼쪽 테두리가 패널 밖에서 잘리던 것, 픽셀 검사원 #95 10바퀴 4)
  const autoW = autoLeft !== null && autoLeft > 0 && st === 'ready' ? 26 : 31;
  const autoSpots: [string, Rect][] = [
    [' pg-auto-left', { l: plateB.l - gapA - autoW, t: plateB.t + 1, r: plateB.l - gapA, b: plateB.t + 13 }],
    [' pg-auto-right', { l: plateB.r + gapA, t: plateB.t + 1, r: plateB.r + gapA + autoW, b: plateB.t + 13 }],
    [' pg-auto-below', { l: plateB.l, t: plateB.b + gapA, r: plateB.l + autoW, b: plateB.b + gapA + 12 }],
  ];
  //   아래 자리가 다른 판과 같은 줄 높이면 뺌 (그 판 왼쪽 칩처럼 읽혀 — 860 에서 2번 "다 참" 이 3번 판 칩으로 읽히던 것, 아트 디렉터 #95 9바퀴 3 · 원칙 7)
  const sameRow = (r: Rect) => others.some((o) => o.plate && r.t < o.box.b + 4 && r.b > o.box.t - 4);
  const autoSpot = g.oneRow ? undefined : autoSpots.find(([k, r]) => r.l >= 2 && r.r <= g.W - 2 && r.b <= g.H - 2 && !others.some((o) => hits(r, grow(o.box, 4))) && !(k === ' pg-auto-below' && sameRow(r)))?.[0];
  const autoPos = autoSpot ?? '';
  // 합동 피해 칩 = 같은 때 (ms) 여러 상대면 합계 하나를 가운데 칸에만 (칩 셋이 계단이던 것 — 아트 디렉터 #95 · BW 4)
  const popsAll = skip.size ? b.popups.filter((p) => !skip.has(p.id)) : b.popups;
  const jointAll = popsAll.filter((p) => p.side === side && p.joint);
  const pops0 = popsAll.filter((p) => p.side === side && p.slot === slot && !(p.joint && jointAll.some((q) => sameJoint(q.ms, p.ms) && q.slot !== p.slot && jointHome(jointAll, p.ms) !== slot))).map((p) =>
    p.joint && jointHome(jointAll, p.ms) === slot ? { ...p, text: `-${jointAll.filter((q) => sameJoint(q.ms, p.ms) && q.slot !== slot).reduce((t, q) => t + Number(q.text.slice(1)), Number(p.text.slice(1)))}` } : p,
  );
  // 합동 마무리 피해 숫자 = 칩 "합동! −숫자" (같은 걸음 합동 피해끼리 합계 하나) — 엔진이 그 피해 팝업에만 joint 를 닮 (개발 b488a8a · 판 없는 빨강 "−7" "−9" 둘이 240 에서 묻히던 것, #80 아트 디렉터 2바퀴 · design-system 12장).
  //   예전엔 "최근 로그에 합동" 으로 골라 합동 뒤 2 ~ 3초 보통 공격 숫자에도 붙고 창이 끝나면 칩이 글로 바뀌며 깜빡이던 것 (개발 #80 UX 마지막 큼)
  //   큰 연출 중 주인공이 아닌 칸은 숫자 · 말을 지움 · 쓰러짐 말은 무대 위 한 줄 (TeamLayer) · 같은 칸 0.3초 안 숫자는 합침 (센 쪽 모양) · 숫자는 0.7초만 (합동 칩은 1.2초)
  //   합동 칩만 처음 본 때부터 진짜 시계 1.2초 (keepJointChips) · 엔진이 팝업을 먼저 지워도 마지막 모양 그대로 남김
  const jointKept = useRef(new Map<number, { p: (typeof pops0)[number]; at: number }>());
  const { gone: jointGone, end: jointEnd } = keepJointChips(jointKept.current, pops0, realNow(), skip);
  const [, jointWake] = useState(0);
  useEffect(() => (Number.isFinite(jointEnd) ? realLater(() => jointWake((n) => n + 1), Math.max(0, jointEnd - realNow()) + 16) : undefined), [jointEnd]);
  const pops = (dim ? [] : jointGone.length ? [...pops0, ...jointGone].sort((p, q) => p.id - q.id) : pops0)
    .filter((p) => !(p.kind === 'info' && FAINT_RE.test(p.text)) && (!NUM_KINDS.has(p.kind) || (p.joint ? jointKept.current.has(p.id) : p.ms < NUM_SHOW_MS)))
    .reduce<(typeof pops0[number] & { joint?: boolean })[]>((out, p) => {
      if (p.joint) {
        const same = out.find((q) => q.joint && sameJoint(q.ms, p.ms));
        if (!same) return [...out, p];
        return out.map((q) => (q === same ? { ...q, text: `-${Number(q.text.slice(1)) + Number(p.text.slice(1))}` } : q));
      }
      if (!NUM_KINDS.has(p.kind) || !/^[+-]\d+$/.test(p.text)) return [...out, p];
      const heal = p.kind === 'heal';
      const same = out.find((q) => !q.joint && NUM_KINDS.has(q.kind) && (q.kind === 'heal') === heal && /^[+-]\d+$/.test(q.text) && Math.abs(q.ms - p.ms) < NUM_MERGE_MS);
      if (!same) return [...out, p];
      const kind = heal ? 'heal' : (NUM_RANK[p.kind] ?? 1) > (NUM_RANK[same.kind] ?? 1) ? p.kind : same.kind;
      return out.map((q) => (q === same ? { ...q, kind, text: `${heal ? '+' : '-'}${Number(q.text.slice(1)) + Number(p.text.slice(1))}` } : q));
    }, []);
  const name = speciesOf(f.species)?.name.ko ?? f.form;
  // 그림 칸 = 그린 크기 (큰 포켓몬 ×1.3) · 발끝이 (x, y) — 보통은 예전 그대로 (칸 sp · 위 = y − sp + 3k)
  const art = artOf(f.form, g.scale);
  // 장면 전환 동안 포켓몬 칸만 1:1 자리 (판 · 숫자는 숨겨 둠 — 돌아온 뒤 제자리에서 보임)
  const mp = viewAt ?? { x, y };
  const mTop = mp.y - Math.round(art.foot * art.s);
  // 칩마다 처음 정한 자리 (옆 · 머리 위) 를 끝까지 — 이겼다 띠가 닫히는 장면에 옆 자리에서 머리 위로 47 ~ 61px 옆걸음하던 것 (UX 리뷰어 #95 7바퀴 4)
  const placed = useRef(new Map<number, { l: number; t: number } | null>());
  // 버린 필살기 누름 글 자리 — 처음 정한 자리를 끝까지 (사라지는 동안 옆걸음 없게 — U2) · 머리 왼쪽 위 → 몸 왼쪽 → 오른쪽 … (다른 칸 그림 · 판 · 자기 판을 피함 · 위 줄 아래)
  const headAt = useRef<{ key: string; l: number; t: number; w: number } | null>(null);
  // 글이 다 사라지면 자리도 잊음 (같은 칸 · 같은 글을 다시 누르면 열쇠가 같아 칩이 없던 때 고른 옛 자리를 다시 써 옆 칸 칩을 덮던 것 — UX 리뷰어 #98)
  if (!head) headAt.current = null;
  if (head && headAt.current?.key !== head.key) {
    const hw = headNoteWidth(head.value.text, head.value.key !== null);
    // 시합장 흰 선은 피함 (흰 선이 글 가운데를 지나던 것 — 아트 디렉터 #97)
    const line = lineBand ? [{ l: 0, t: lineBand.t, r: g.W, b: lineBand.b }] : [];
    //   내 편은 오른쪽 자리 빼기 (맞을 때 상대가 달려와 서는 앞자리) · ×1 무대 (400 아래) 는 위쪽 자리만 → 막히면 위 줄 아래 왼쪽 고정 칸 (아트 디렉터 #97 2바퀴 큼 1)
    //   3:3 = 누른 칸 포켓몬 머리 왼쪽 위만 (기획 10-26 — 막혀서 무대 왼쪽 위 구석 고정 칸으로 가 리자몽과 멀던 것) · 흰 선만 피해 올리고 · 글은 그림을 따라감 (follow)
    //   (자기 피해 숫자는 글 아래로만 — popMin)
    //   떠 있는 피해 숫자 · 합동 칩 (모든 칸 — 그린 자리 · 무대 기준) 도 피함 (옆 칸 "합동! −19" 의 9 를 키 칸 [2] 가 덮어 −12 로 읽히던 것 — UX 리뷰어 #98 남은 작음 큼)
    const stage = document.querySelector<HTMLElement>('#pokemon-game .pg-team');
    const sr = stage?.getBoundingClientRect();
    const popBoxes = stage && sr ? [...stage.querySelectorAll<HTMLElement>('.pg-team-pop')].map((n) => {
      const r = n.getBoundingClientRect();
      return { l: r.left - sr.left, t: r.top - sr.top, r: r.right - sr.left, b: r.bottom - sr.top };
    }) : [];
    headAt.current = { key: head.key, w: hw, ...pickHeadSpot(vis, hw, HEAD_NOTE_H, { l: 0, t: topMin - 14, r: g.W, b: g.H }, [...line, ...popBoxes], { team: true }) };
  }
  // 글이 떠 있는 동안 이 칸 피해 숫자는 글 아래 끝 + 1 위로 못 올라감 (가로로 겹칠 때 — 위 왼쪽 고정 칸에 리자몽 "-1" 이 올라와 키 칸 [1] 에 겹치던 것, #97 마지막 확인 ·
  //   1:1 "숫자는 말 칸 위로 안 올라감" 과 같은 규칙)
  const ha = head ? headAt.current : null;
  const popMin = ha && ha.l < x + 16 && ha.l + ha.w > x - 16 ? Math.max(topMin, ha.t + HEAD_NOTE_H + 1 + 14) : topMin;
  // 머리 위 숫자 바닥 = 보이는 그림 위 끝 − 4 (맞은 몸에 붙임 — 그림 칸 위 끝으로 잡아 860 에서 머리 18px 위에 뜨고 · ×1 은 #92 때 쓰러짐 말 (폭 약 90) 을 앞 칸 더미 위로 쌓던 규칙이 남아
  //   숫자가 다른 포켓몬 옆 45px 위에 뜨던 것 — 아트 디렉터 #95 9바퀴 1 · 쓰러짐 말은 이제 위 줄이라 더미엔 숫자 (폭 14 ~ 25) 만 · 칸 사이 24 ~ 60 이라 안 겹침)
  const popBase = vis.t - 4;
  // 위 줄에 밀려 바닥이 같아질 때만 엇갈림 (×1 계단 — 칸 사이 24 라 숫자가 붙음) · ×2 · 한 줄은 칸 사이 60 이라 엇갈림 없음 (480 한 줄 3번 숫자가 늘 30px 위에 혼자 뜨던 것 — 아트 디렉터 9바퀴 2)
  const stagger = g.scale === 1 && !g.oneRow ? (slot % 3) * 15 : 0;
  // 필살기 힘겨루기 중엔 끼어들 수 있는 칸 (join) 만 합류 — 나머지는 바깥 (연타) 으로 (코드 리뷰어)
  // 버린 누름 (#88 — 엔진 b.deny, 1.2초) = 이 칸 판이 흐려짐 (까닭은 머리 왼쪽 위 작은 글 — head · 태현 님 10-26) · 그동안 쓸 수 있게 되면 흐림만 거둠
  const deny = mine && b.deny && b.deny.slot === slot && st !== 'ready' && st !== 'join' ? b.deny : null;
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
        class={`pg-team-mon pg-team-${side}${st === 'down' ? ' pg-team-down' : ''}${st === 'down' && final ? ' pg-team-ko' : ''}${dim ? ' pg-team-dim' : ''}${vMon}`}
        data-team={`${side}-${slot}`}
        style={{ left: `${Math.round((mp.x - art.px / 2) / g.scale) * g.scale}px`, top: `${mTop}px`, width: `${art.px}px`, height: `${art.px}px` }}
        title={`${name} Lv${f.level}${mine && st !== 'down' ? ` — ${slot + 1} 필살기` : ''}`}
        onClick={click}
      >
        {/* 발밑 그림자 (시합장 배경에서만 — game.css) = 칸 안 (달려가기 · 밀림 · 사라짐에 같이 움직임) · 그림 발끝 가운데 · 폭 = 그림 폭 × 0.6 (2k 단위 · ×1 12 ~ ×2 20 이상 · 20k 이하) · k 칸 줄 3단 (아트 디렉터 #78) */}
        <span class="pg-team-shadow" style={shadowStyle(f.form, g, !mine, mTop)} />
        <span class="pg-team-body" style={st === 'down' && final ? { '--pg-back': mine ? '-1' : '1', '--pg-ko-y': `${koSinkPx(f.form, art.px)}px` } : undefined}>
          <Sprite media={media} form={f.form} shiny={f.shiny} scale={g.scale} px={art.px} action="walk" faceLeft={!mine} />
        </span>
      </span>
      {/* 발밑 판 — 키 칸 (내 편) + HP + 필살기 게이지 */}
      <span class={`pg-team-plate pg-team-plate-${side} pg-plate-${st}${deny ? ' pg-plate-deny' : ''}${dim ? ' pg-team-dim' : ''}${warnPlate ? ' pg-plate-warn' : ''}${vRest}`} style={{ left: `${Math.round(x - w / 2)}px`, top: `${y + 4}px`, width: `${w}px` }} onClick={click}>
        {mine && <span class="pg-team-key">{slot + 1}</span>}
        <span class="pg-team-bars">
          <Bar v={f.hp / Math.max(1, f.maxHp)} kind="hp" />
          {st !== 'down' && <Bar v={f.ult} kind={st === 'charge' ? 'ult' : 'ult-full'} />}
        </span>
        {/* 상대 필살기 예고 = 상대 발밑 판 오른쪽 칩 (1:1 이 상대 HP 줄 안인 것과 같은 자리 — 머리 위에 두면 그 상대의 피해 숫자를 덮어 "−1" 이 0px 이던 것, 픽셀 검사원 2차) */}
        {warn && (
          <span class={`pg-team-warn${warn.full ? ' pg-team-warn-full' : ''}${warnPos === 'right' ? '' : ` pg-team-warn-${warnPos}`}`} title={warn.full ? '상대 필살기가 다 찼어요' : `상대 필살기 ${warn.pct}% — 곧`}>
            {warn.full ? '!' : '곧'}
          </span>
        )}
        {/* 다 찬 필살기 누를 틈 (기획 R2 — 볼 때 3초 뒤 저절로) = 판 오른쪽 숫자 3 · 2 · 1 (1:1 Z 모서리와 같은 칩 · 나갈 때까지 1 — 게이지를 줄이면 "필살기가 빠져나간다" 로 읽히던 것, UX 리뷰어) */}
        {/* 세는 때 (지금 쓸 수 있는 칸 — ready) 만 · "3초" 칠 없는 금 테두리 (키 칩과 다른 모양) · 판 밖 (판 안이면 HP 막대가 줄던 것) — UX 리뷰어 2차 */}
        {/* 먼저 나갈 한 칸만 · 판 왼쪽 위 탭 (판 오른쪽 바깥이면 240 에서 다음 칸 포켓몬 몸을 덮고 · 셋 다 "1초" 인데 하나만 나가던 것 — UX 리뷰어 3차) */}
        {/* 바로 나가는 칸 (HP 30% 아래 — 0ms) 은 칩 없음 (1장면만 비치던 것 — UX 리뷰어 R9 ⑥) */}
        {autoLeft !== null && autoLeft > 0 && st === 'ready' ? (
          <span class={`pg-team-auto${autoPos}`} title={`${Math.max(1, Math.ceil(autoLeft / 1000))}초 뒤 저절로 필살기 — 지금 ${slot + 1} 로 바로`}>
            {Math.max(1, Math.ceil(autoLeft / 1000))}초
          </span>
        ) : (
          // 필살기는 눌러야만 나감 (태현 님 #82) — 다 찬 칸 = 같은 자리 "다 참" (남은 초 대신 · 내 편만)
          mine && st === 'ready' && fullChip && autoSpot !== undefined && (
            <span class={`pg-team-auto pg-team-full${autoPos}`} title={`필살기 다 참 — ${slot + 1} 누르면 나가요`}>
              다 참
            </span>
          )
        )}
      </span>

      {/* 피해 숫자 · 짧은 말 — 머리 위 */}
      {/* 칸마다 쌓음 (쓰러짐 말 · 피해 숫자가 같은 자리에 겹치던 것) · 지도 줄 아래로 막음 · 한 줄 배치 · ×1 (좁은 패널 — 셋이 가까움) 은 칸마다 높이를 엇갈림 — UX 리뷰어 */}
      {/* topMin 은 글 높이 14 기준 — 합동 칩 · 큰 숫자 판 (높이 20) 은 6 더 아래 (위 4px 가 띠 밑으로 들어가던 것 — 픽셀 검사원 #95 4바퀴 ④) ·
          그렇게 내려 아래 끝이 머리 위 6px 안으로 들어가면 그림 옆 — 바깥쪽 (상대 = 오른쪽 · 내 편 = 왼쪽) 2px 부터, 다른 칸 그림 · 판과 겹치거나 패널 밖이면 반대쪽, 둘 다 막히면 머리 위 그대로 ·
          세로 = 머리 위 끝 + 4 (위 줄 아래 + 2 보다 위로는 안 감) — 240 에서 칩이 맞은 레디바 위 14px 를 덮고 (6바퀴 ①) · 옆 자리가 다른 포켓몬 머리 위에 붙어 그쪽이 맞은 것처럼 읽히던 것 (아트 디렉터 #95 7바퀴 ① · bw-triple-8 숫자는 그림을 덮지 않음) */}
      {pops.map((p, i) => {
        const tall = !!p.joint || (big && NUM_KINDS.has(p.kind) && p.kind !== 'heal');
        const top = Math.max(popMin + (tall ? 6 : 0) + popGap(pops.slice(i + 1)) + stagger, popBase - popGap(pops.slice(0, i)));
        let at: { l: number; t: number } | null = placed.current.get(p.id) ?? null;
        // 칩 폭 어림 (합동 = 판 + "합동!" + 16px 숫자 · 큰 숫자 판) — 실측 (합동 −5 = 52 · −23 = 63 · 큰 −7 = 25) 보다 늘 크게 잡아 겹침을 놓치지 않게 (아트 디렉터 #95 8바퀴 2)
        // ×1 무대 (400 아래) 합동 칩은 숫자만 ("합동!" 은 띠가 말함 · 폭 62 → 약 30 — 옆 두 자리가 막혀 머리 위로 가 옆 칸 그림을 덮던 것, UX 리뷰어 #95 8바퀴 5)
        const tagOn = g.scale !== 1;
        const cw = Math.ceil(((p.joint && tagOn ? 35 : 12) + 10 * p.text.length) * 1.1);
        // 머리 위 자리가 옆 칸 그림 · 판에 닿아도 옆 자리를 찾아봄 (240 × 187 에서 머리 위 칩이 통통코 · 이상해꽃을 덮던 것 — 픽셀 검사원 #95 7바퀴 7)
        //   떠 있는 머리 글 (버린 필살기 누름 — 다른 칸 · 무대 기준) 도 처음 자리를 고를 때만 피함 (글이 먼저 떠 있고 옆 칸에 칩이 나중에 붙어 글 키 칸이 칩 숫자를 덮던 것 — UX 리뷰어 98b 2바퀴 작음 1)
        const notes = tall && !placed.current.has(p.id) ? headNoteBoxes() : [];
        const headHit = tall && (others.some((o) => hits({ l: x - cw / 2, t: top - 20, r: x + cw / 2, b: top }, o.box)) || notes.some((o) => hits({ l: x - cw / 2, t: top - 20, r: x + cw / 2, b: top }, o)));
        if (tall && !placed.current.has(p.id) && (top > vis.t - 2 || headHit)) {
          // ×1 (그림 32 · 보이는 키 약 22) 은 머리 높이 (위 끝 − 4) — 위 끝 + 4 면 칩 아래가 발밑 판에 닿아 옆 자리가 막히고 맞은 몸 위로 돌아오던 것 (픽셀 검사원 #95 11바퀴 3)
          const ct = Math.max(vis.t + (g.scale === 1 ? -4 : 4), topMin - 14);
          for (const right of mine ? [false, true] : [true, false]) {
            const l = right ? vis.r + 2 : vis.l - 2 - cw;
            const rect = { l, t: ct, r: l + cw, b: ct + 20 };
            // 자기 발밑 판도 피함 (240 에서 옆 칩이 자기 판 모서리와 1 ~ 2px 겹치던 것 — 픽셀 검사원 #95 10바퀴 6)
            if (l >= 2 && rect.r <= g.W - 2 && !others.some((o) => hits(rect, o.box)) && !hits(rect, plateB) && !notes.some((o) => hits(rect, o))) {
              at = { l, t: ct };
              break;
            }
          }
        }
        if (tall && !placed.current.has(p.id)) {
          if (placed.current.size > 24) placed.current = new Map([...placed.current].slice(-8));
          placed.current.set(p.id, at);
        }
        return (
          // 그림 왼쪽에 둘 때는 오른쪽 끝 = 그림 왼쪽 − 2 (left 로 잡으면 폭 어림 차이가 그대로 그림 쪽 틈이 되어 0 ~ 7px 로 들쭉날쭉하던 것 — 아트 디렉터 #95 8바퀴 2)
          <span key={p.id} class={`pg-team-pop${vRest} pg-pop-${p.kind}${p.joint ? ' pg-team-joint' : ''}${tall && !p.joint ? ' pg-pop-big' : ''}${at ? (at.l < vis.l ? ' pg-pop-side pg-pop-side-l' : ' pg-pop-side') : ''}`} style={at ? { left: `${at.l < vis.l ? vis.l - 2 : at.l}px`, top: `${at.t}px` } : { left: `${x}px`, top: `${top}px` }}>
            {p.joint ? (
              <>
                {tagOn && <b class="pg-team-joint-tag">합동!</b>} {p.text}
              </>
            ) : (
              p.text
            )}
          </span>
        );
      })}
      {/* 키 칸 [N] 은 늘 (돌진 중이거나 상대가 앞으로 나와 붙어도 어느 칸 말인지 — UX 리뷰어 #97 작음 3) */}
      {head && headAt.current && <HeadNote text={head.value.text} go={head.value.go} keyCap={head.value.key !== null ? String(head.value.key) : null} at={headAt.current} step={head.step} follow={() => document.querySelector<HTMLElement>(`#pokemon-game [data-team="${side}-${slot}"] .pg-team-body`)} />}
    </>
  );
}

/** 장면 전환 상태 (개발 fx/team-view) — 단계가 바뀔 때마다 다시 그림 (연출 동안 엔진 시계가 붙잡혀 b 가 안 바뀜) */
function useTeamView(): TeamView | null {
  const [, tick] = useState(0);
  useEffect(() => subscribeTeamView(() => tick((n) => n + 1)), []);
  return getTeamView();
}

/** 합동 큰 컷인 자리 · 참가자 */
function JointCutin({ b, view, media, widthPx, heightPx, infoBarPx, fieldTopPx, scale, feetPx, minTop = 0 }: { /** 떠 있는 쓰러짐 줄 아래 + 4 — 띠 위 금선이 줄에 3px 걸치던 것 (아트 디렉터 #98 2바퀴 4) */ minTop?: number; b: TeamBattle; view: TeamView; media: string; widthPx: number; heightPx: number; infoBarPx: number; fieldTopPx: number; scale: 1 | 2; /** 무대 앞줄 발끝 (장면 전환 자리 — duelSpots 앞장) */ feetPx: number }) {
  //   포켓몬은 ×2 까지 (태현 님 10-23 "크게 키운 장면 너무 못생겼는데" — 180 이상 ×3 이던 것) · 작은 무대 (scale 1) 는 ×1
  //   작은 무대 (scale 1) 도 컷인 그림은 ×2 (240 × 150 ×1 그림 18px 이 92px 띠에서 점처럼 보이던 것 — 아트 디렉터 #98 2바퀴 2)
  const k: 1 | 2 = 2;
  //   무대 포켓몬 배율 (띠가 무대 포켓몬에 걸치는지 셀 때)
  const sk: 1 | 2 = scale === 1 ? 1 : 2;
  const mons = view.from.flatMap((i) => (b[view.side][i] ? [b[view.side][i]!] : []));
  //   띠 키 = 그림 창 (보이는 키 + 2칸 — cutinArtH) + 이름표 18 + 위아래 여유 10 (32k + 28 보다 작으면 그대로) — 키 큰 포켓몬 발 · 이름표가 띠 밖으로 잘리던 것 (아트 디렉터 #98 2바퀴 1) · 무대 남는 키까지
  const fieldTop0 = infoBarPx + fieldTopPx - 4;
  const base = Math.min(Math.max(heightPx - fieldTop0, 32 * k + 28), Math.max(32 * k + 28, ...mons.map((f) => cutinArtH(f.form, k) + 18 + 10)));
  //   지도 줄 아래부터 (지도 줄을 반만 덮던 것) · 남는 자리 가운데
  const fieldTop = infoBarPx + fieldTopPx - 4;
  const mid = fieldTop + Math.max(0, Math.round((heightPx - fieldTop - base) / 2));
  //   띠가 무대 포켓몬에 반쯤 걸치면 띠 아래 끝 = 발끝 + 4 — 240 × 150 은 띠 아래 끝 117 · 발끝 127 이라 머리는 띠 뒤 · 발만 띠 아래로 나와 잘려 보이던 것 (아트 디렉터 #96 5바퀴) ·
  //   걸침 = 큰 포켓몬 (×1.3) 머리 + 동료 지그재그 (위 8 · 12) 까지 · 띠가 포켓몬보다 위에 따로 있으면 (높은 패널) 가운데 그대로 ·
  //   모자람이 16px 까지면 위 끝은 두고 아래로 늘림 (240 × 150 = 58 ~ 130 · 높이 73 — 옮기면 띠가 무대 아래로 몰리고 두 줄 제목 위아래 여유가 4 ~ 5px 이던 것) · 더 모자라면 옮김
  const monTop = feetPx - Math.round(32 * sk * 1.3) - (sk === 1 ? 8 : 12);
  const short = feetPx + 4 - (mid + base);
  const cut = mid + base > monTop && short > 0;
  const height0 = cut && short <= 16 && mid + base + short <= heightPx ? base + short : base;
  const top0 = cut && height0 === base ? Math.min(heightPx - base, feetPx + 4 - base) : mid;
  const top1 = Math.max(top0, minTop);
  //   뜰 때 정한 자리 · 키를 끝까지 (쓰러짐 줄이 닫히며 minTop 이 풀려 큰 이름을 읽는 1.2초 한가운데에 16px 위로 튀던 것 — 아트 디렉터 #98 R5 2 · 칩 "처음 정한 자리" 규칙)
  const fixedAt = useRef<{ at: number; top: number; height: number } | null>(null);
  if (!fixedAt.current || fixedAt.current.at !== view.at) fixedAt.current = { at: view.at, top: top1, height: Math.max(32, Math.min(height0, heightPx - top1)) };
  const { top, height } = fixedAt.current;
  const who = mons.map((f) => ({ form: f.form, shiny: f.shiny, name: speciesOf(f.species)?.name.ko ?? f.form }));
  // 타입 색 — 앞장 = 띠 바탕 (어둡게) · 동료 = 속도선 ("합동" 을 색으로 — 남색 띠가 HUD 판처럼 읽히던 것, 아트 디렉터 #99 · 마스터즈 타입 색 방사선)
  const colors = mons.map((f) => TYPE_COLOR[speciesOf(f.species)?.types[0] ?? 'normal']);
  // 큰 제목 = 합동 이름 (짝마다 — #100 시안 · joint-names) · 위 작은 줄 "합동 필살기!" · 좁으면 이름 하나
  const name = jointName(mons.map((f) => speciesOf(f.species)?.types[0] ?? 'normal'));
  return <TeamCutin who={who} side={view.side} title={widthPx < 400 ? name : '합동 필살기!'} sub={widthPx < 400 ? '' : name} media={media} k={k} top={top} height={height} colors={colors} quick={!!view.quick} />;
}



export function TeamLayer({ team: b, media, widthPx, heightPx, infoBarPx, fieldTopPx = 0, onInput, cutscene = true, lineBand = null }: { team: TeamBattle; media: string; widthPx: number; heightPx: number; infoBarPx: number; fieldTopPx?: number; onInput(i: GameInput): void; /** 시합장 흰 선 (패널 y) — 머리 위 글이 피함 */ lineBand?: { t: number; b: number } | null; /** 필살기 연출 켬 (장면 전환) · 끔 (작은 판) — 설정 teamCutscene (#97) */ cutscene?: boolean }) {
  const g = useMemo(() => teamGeometry(widthPx, heightPx, infoBarPx), [widthPx, heightPx, infoBarPx]);
  // 장면 전환 (#99 시안 — 개발 fx/team-view): 필살기 · 합동 동안 무대가 잠깐 1:1 처럼 (내 편 무리 왼쪽 · 상대 무리 오른쪽 · 나머지 숨김) → 1:1 필살기 연출 그대로 → 3:3 으로 돌아옴
  const view = useTeamView();
  // 버린 필살기 누름 (#88) = 그 칸 포켓몬 머리 왼쪽 위 작은 글 (태현 님 10-26 "엄청 작은 글씨로 포켓몬 위쪽 · 머리 기준 왼쪽 위 · 서서히 사라짐" — 정보줄 위 가운데에서 옮김) ·
  //   칸 없는 Z ("아직 다 찬 포켓몬이 없어요") 는 앞장 (살아 있는 첫 칸) · 진짜 시계로 1.1초 붙잡고 사라짐 (ui/HeadNote) · 내 필살기가 나가면 바로 지움
  const deny0 = teamDenyNote(b);
  const denySlot = deny0 ? (deny0.key !== null ? deny0.key - 1 : b.me.findIndex((f) => !!f && f.hp > 0)) : -1;
  const denyOn = deny0 !== null && denySlot >= 0;
  //   지우기는 내 필살기가 시작되는 순간 한 번 · 쏜 칸 (합동이면 모인 칸) 의 글만 — 필살기 내내 지워 그동안 다른 칸을 눌러도 글이 안 뜨던 것 (UX 리뷰어 #97 큼 1 (a) (b))
  const myUlt = b.ult?.side === 'me' ? b.ult : null;
  const myUltWas = useRef(false);
  const denyLast = useRef<number | null>(null);
  const denyCut = !!myUlt && !myUltWas.current && denyLast.current !== null && (myUlt.from === denyLast.current || (myUlt.team ?? []).includes(denyLast.current));
  myUltWas.current = !!myUlt;
  const denyHeld = useHeldNote(denyOn ? `${denySlot}|${deny0.text}|${deny0.go}` : null, denyOn ? { ...deny0, slot: denySlot } : null, denyCut);
  denyLast.current = denyHeld?.value.slot ?? null;
  //   장면 전환 (1:1 무대 · 컷인) 중에 생긴 글 = 위 왼쪽 고정 자리 · 맨 위 (그 칸 포켓몬이 숨어 있어 숨은 자리 · 다른 포켓몬 옆에 뜨고 컷인 뒤에 0.95초 숨던 것 — UX 리뷰어 #97 큼 1 (c)) · 처음 정한 자리를 끝까지
  const denyFixed = useRef<{ key: string; fixed: boolean } | null>(null);
  if (denyHeld && denyFixed.current?.key !== denyHeld.key) denyFixed.current = { key: denyHeld.key, fixed: view !== null };
  //   고정 자리는 장면 전환 동안만 — 돌아오면 남은 시간 동안 그 포켓몬 머리 왼쪽 위로 한 번 옮김 (구석에 남던 것 — 아트 디렉터 #98 2바퀴 7)
  const denyAtFixed = !!denyHeld && denyFixed.current?.fixed === true && view !== null;
  //   힘겨루기 장면 (#116) = 맞붙는 두 무리 (앞장 먼저) 를 둘 다 1:1 자리로
  const vGroups = view ? (view.kind === 'duel' && view.duel ? { me: view.duel.me, foe: view.duel.foe } : { me: view.side === 'me' ? view.from : view.to.side === 'me' ? [view.to.slot] : [], foe: view.side === 'foe' ? view.from : view.to.side === 'foe' ? [view.to.slot] : [] }) : null;
  const vSpots = vGroups ? duelSpots(g, vGroups.me.length, vGroups.foe.length, view?.kind === 'duel') : null;
  const vCross = vGroups && vSpots ? viewCrossers(g, vGroups, vSpots) : null;
  //   나머지 포켓몬 = 바둑판 두 걸음으로 사라짐 · 판 · 숫자 = in 에 바로 숨김 (바둑판이 옮겨 가는 몸 위에 겹쳐 어수선하던 것 — 개발 #99) · out 에 바둑판으로 나타남
  const vHide = !view ? '' : view.phase === 'in' ? ' pg-view-hide-in' : view.phase === 'out' ? ' pg-view-hide-out' : ' pg-view-hidden';
  const vRestHide = view?.phase === 'in' ? ' pg-view-hidden' : vHide;
  //   합동 쏘는 무리는 돌아갈 때 걷지 않고 바둑판으로 사라졌다 제자리에서 나타남 (동료 왼쪽 · 앞장 오른쪽 순서가 줄과 달라 돌아가는 길에 서로를 지나쳐 0.3초 겹치던 것 — 아트 디렉터 #101) ·
  //   합동 동료는 연출 층 위 (1:1 불 혜성 · 불벽이 동료 몸을 덮어 "앞장이 동료를 친다" 로 보이던 것 — 아트 디렉터 #101)
  const vOf = (side: Side, slot: number) => {
    const i = vGroups ? vGroups[side].indexOf(slot) : -1;
    const shooter = !!view && ((view.kind === 'joint' && side === view.side) || view.kind === 'duel') && i >= 0;
    // 앞장도 연출 층 위 (#103 — 터질 때 흰 막 아래에서 앞장만 반쯤 하얘지던 것, 아트 디렉터) · 앞장을 숨기고 캔버스에 꼭두각시로 그리는 필살기는 상관없음 ·
    // 돌아갈 때 합동 쏜 무리 · 맞은 칸은 바둑판으로 제자리에 (viewPopsBack) — 무리 안에서 쓰러진 칸도 바둑판 (pg-view-down-back — 예전엔 숨겼다가 끝에 툭, #98) · 예전 까닭: (쓰러짐 사라지기 애니메이션이 바둑판을 덮고
    //   장면 전환 동안 멈춰 있어, 회색 레디바가 보이는 채로 38px 옮겨 가던 것 — #96 6바퀴 · 회색 1.2초는 돌아온 뒤 그대로)
    const hideDown = !!view && view.phase === 'out' && viewPopsBack(view, side, slot) && plateState(b, side, slot) === 'down';
    //   들어갈 때 앞뒤가 바뀌는 동료 (viewCrossers) = in 동안 제자리에서 바둑판으로 사라지고 → 새 자리에서 바둑판으로 나타남 (pg-view-pop — 돌아갈 때 pg-view-hide-out 으로 바뀌어 다시 나타남이 돎)
    //   이어받는 장면 (cont — 다른 장면에서 숨어 있던 칸이 있음) 은 무리 모두 바둑판으로 새 자리에 (걸어가면 숨었던 칸이 제자리에서 툭 보였다 걸어감)
    const cross = !!view && view.phase !== 'out' && (!!vCross?.has(`${side}-${slot}`) || (!!view.cont && i >= 0) || !!view.popIn?.includes(`${side}-${slot}`));
    const vMon = !view ? '' : viewMonClass(view.phase, { inGroup: i >= 0, hideDown, popsBack: viewPopsBack(view, side, slot), cross, shooter, cont: !!view.cont });
    // 판 · 숫자도 다른 칸처럼 (쓰러진 칸도 이제 바둑판으로 보임 — 예전 숨김은 빈 자리 위에 "-1" 만 떠 있던 것, #96)
    return { viewAt: vSpots && i >= 0 && view!.phase !== 'out' && !(cross && view!.phase === 'in') ? (vSpots[side][i] ?? null) : null, vMon, vRest: vRestHide };
  };
  const root = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const runner = useRef<TeamFxRunner | null>(null);
  const bRef = useRef<TeamBattle | null>(b);
  bRef.current = b;
  const cutRef = useRef(cutscene);
  cutRef.current = cutscene;
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
      cutscene: () => cutRef.current,
    });
  }
  useEffect(() => {
    runner.current?.update(b);
  }, [b]);
  useEffect(
    () => () => {
      runner.current?.reset();
      document.body.style.removeProperty('--pg-fx-top');
    },
    [],
  );
  // 연출 캔버스 위 끝 = 지도 줄 (스테이지 이름 · 진행 막대) 아래 끝, 없으면 정보줄 아래 끝 (game.css 가 여기서 자름 — 1:1 BattleFx 와 같은 규칙) ·
  //   3:3 엔 이 잼이 없어 블래스트번 돔 · 분화 불기둥 · 합동 폭발 · 컷인 띠가 맨 위 줄 · 지도 줄을 덮던 것 (#80 아트 디렉터 2바퀴 큼 — 레퍼런스 goldensun-1f) · 그릴 때마다 잼 (값이 같으면 안 씀)
  //   useLayoutEffect — 같은 그림에서 연출 실행기 (위 useEffect) 보다 먼저 (지도 줄 자리가 바뀐 그림에서 필살기가 시작하면 한 그림 전 값을 쓰던 것 — 코드 리뷰어 #97 · bugs 1821)
  useLayoutEffect(() => {
    const game = root.current?.closest('#pokemon-game');
    const rows = [game?.querySelector<HTMLElement>('.pg-infobar'), game?.querySelector<HTMLElement>('.pg-maprow')].filter((e): e is HTMLElement => !!e && e.getClientRects().length > 0);
    const top = `${rows.length ? Math.round(Math.max(...rows.map((e) => e.getBoundingClientRect().bottom))) : 0}px`;
    if (document.body.style.getPropertyValue('--pg-fx-top') !== top) document.body.style.setProperty('--pg-fx-top', top);
  });
  const prompt = teamPrompt(b);
  // 큰 연출 (필살기 · 합동 멘트 · 합동 · 힘겨루기) 의 주인공 칸 (엔진 teamLit — 평소 null) · 나머지는 흐리게 (기획 #95 "나머지 다섯은 멈추고 흐리게")
  const lit = teamLit(b);
  // 혼자 필살기에 맞는 칸 = 숫자 하나를 크게 (합동은 "합동! −숫자" 칩)
  const bigHit = b.phase === 'ult' && b.ult && !b.ult.joint && !((b.ult.gather ?? 0) > 0) ? (b.ult.side === 'me' ? 'foe' : 'me') : null;
  // 3:3 띠 (이름 컷인 · VS · 이겼다!) — 정보줄 · 지도 줄 아래 4px (간격 단계 — fieldTopPx 에 든 띄움을 빼고, 10px 이던 것 · 픽셀 검사원 #95)
  // 쓰러짐 말 — 큰 연출 (필살기 · 합동 · 힘겨루기) 중에 쓰러진 것만 띠 끝에 붙임 · 그 밖 (보통 공격) 은 따로 줄 (띠를 붙잡는 동안 다른 포켓몬의 보통 공격 쓰러짐까지
  //   띠에 붙어 "하드플랜트! | 통통코 쓰러졌다!" 로 읽히던 것 — UX 리뷰어 #95 3바퀴)
  //   큰 것인지는 처음 본 때 정함 — 그때 큰 연출 중이거나 막 끝났으면 (0.4초 안) 큰 것 (보통 공격 쓰러짐 뒤 0.4초 안에 상대 필살기가 시작되면
  //   "힘겨루기! | 레디바 쓰러졌다!" 로 VS 띠에 붙고 · 따로 줄에서 띠로 옮겨 가며 튀던 것 — 픽셀 검사원 #95 4바퀴 ⑦)
  const litAt = useRef(Number.NEGATIVE_INFINITY);
  const litStart = useRef<number | null>(null);
  const faintSeen = useRef(new Map<number, boolean>());
  const seenNow = performance.now();
  if (lit !== null) {
    litStart.current ??= seenNow;
    litAt.current = seenNow;
  } else litStart.current = null;
  const faints = b.popups.filter((p) => p.kind === 'info' && FAINT_RE.test(p.text));
  // 생긴 때 = 처음 본 때 − 말의 나이 (p.ms)
  faints.forEach((p) => faintSeen.current.has(p.id) || faintSeen.current.set(p.id, faintIsBig(seenNow - p.ms, litStart.current, litAt.current, !!view)));
  if (faintSeen.current.size > 24) faintSeen.current = new Map([...faintSeen.current].slice(-12));
  const line = (ps: typeof faints) => {
    const names = [...new Set(ps.map((p) => p.text.replace(FAINT_RE, '')))];
    return names.length ? `${names.join(' · ')} 쓰러졌다!` : null;
  };
  const bigOnes = faints.filter((p) => faintSeen.current.get(p.id) === true);
  const faintBig = line(bigOnes);
  // 쓰러짐 말은 모든 폭에서 띠 끝 같은 줄 (240 에서 띠 아래 따로 상자가 "합동! −23" 칩의 앞을 덮고 · 띠 + 상자 + 칩 판 셋이 쌓이던 것 — 아트 디렉터 #95 4바퀴 ② ⑧ · bw-triple-4 쓰러짐 글은 한 자리)
  //   좁아 넘치면 띠가 "N마리 쓰러졌다!" 로 줄임 (TeamBand) · 띠가 닫힐 때까지 그대로
  //   띠 붙잡기 = 엔진 말이 살아 있는 동안 + 띠에 말이 붙은 때부터 1.2초 (좁은 패널은 1.2초 늦게 붙여 말이 0.8초만 보이던 것 — UX 리뷰어 #95 8바퀴 1 · 기획 #131 "쓰러짐 말 1초 넘게")
  const attach = useRef<{ key: string; at: number } | null>(null);
  // 필살기 · 합동 띠가 생긴 때 · 장면 전환이 섰는지 (bandDrawn — 150ms 안에 장면 전환이 안 서면 띠를 그림, #96 코드 리뷰 중간 2)
  const viewWait = useRef<{ key: string; at: number; viewed: boolean } | null>(null);
  const band = useTeamBand(b, faintBig !== null || (attach.current !== null && realNow() - attach.current.at < 1200));
  // 띠에 붙은 쓰러짐 말은 띠가 닫힐 때까지 그대로 (글자가 먼저 빠져 띠가 줄며 왼쪽 끝이 50px 튀던 것 — UX 리뷰어 #95 3바퀴)
  const bandFaint = useRef<{ key: string; text: string; short: string | null } | null>(null);
  const seenBand = useRef<{ view: TeamBandView; faint: { text: string; short: string | null } | null; at: number } | null>(null);
  const seenBand0 = (key: string) => seenBand.current?.view.key === key;
  if (!band) bandFaint.current = null;
  else if (faintBig) bandFaint.current = { key: band.key, text: faintBig, short: faintShortLine(bigOnes.map((p) => p.text.replace(FAINT_RE, ''))) };
  else if (bandFaint.current && bandFaint.current.key !== band.key) bandFaint.current = null;
  const bandTop0 = infoBarPx + fieldTopPx - topGapPx(heightPx) + 4;
  // 높은 패널 (300 이상) 띠 = 맨 위 그림 칸 위 끝 − 30 (칩 20 + 2 + 8 — 머리 위 숫자 · 합동 칩 자리를 남김. 8 이면 위 빈 풀밭이 200px 인데도 칩이 옆으로 밀리던 것, 아트 디렉터 #95 7바퀴 ① ·
  //   그림 칸 + 8 위로 셈해 머리에서 22 ~ 36px 멀던 것은 그림 칸 기준으로 고침 — 픽셀 검사원 6바퀴 10)
  const headTop = Math.min(...SIDES.flatMap((s) => b[s].map((f, i) => {
    const a = artOf(f?.form ?? '', g.scale);
    return g.pos(s, i).y - Math.round(a.foot * a.s);
  })));
  const bandTop = heightPx >= 300 ? Math.max(bandTop0, headTop - BAND_PX - 30) : bandTop0;
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
  // 낮은 패널 (170 아래 · ×2 한 줄 — 400 이상) 의 끼어들기 · 모으기 큰 판 = 띠 자리 (머리 위) · 그동안 띠는 숨김 (판 제목 "소미안 필살기 · 끼어들기" · "상대 합동!" 이 띠 내용을 담음)
  //   — 480 × 150 에서 판이 누를 [3] 거북왕 위 반을 덮던 것 (아트 디렉터 #95 6바퀴 ⑦) · 240 은 #81 가운데 큰 판 그대로
  const bigUp = heightPx < 170 && widthPx >= 400 && (prompt?.kind === 'join' || prompt?.kind === 'gather');
  // 좁은 패널 (720 아래) 힘겨루기 = 연타 안내가 뜨면 VS 띠 자리를 넘겨받음 (VS 띠는 1.1초 보인 뒤 — 안내를 띠 아래에 두면 240 에서 두 줄기가 맞닿는 곳을 통째로 덮던 것, 아트 디렉터 #95 6바퀴 ② · bw-triple-7 글은 한 자리)
  const mashOn = prompt?.kind === 'mash' && (b.clash?.ms ?? 0) >= TIMING.team.ultClashLeadMs;
  // 480 이상은 끼어들기 · 모으기 판 동안 띠를 숨김 (판 제목 "소미안 필살기 · 끼어들기" 가 띠 내용) — 띠가 곧 뜰 자리 (28) 를 미리 비우느라 860 에서 판이 y 112 까지 내려와
  //   누를 [3] 거북왕을 덮던 것 (픽셀 검사원 #95 7바퀴 3) · 480 아래는 판 제목에 이름이 없어 띠를 남김
  // 상대 컷인 이름 (ult/core — 약 1.9초) 이 떠 있을 때 뜬 끼어들기 판 · 낮은 패널 (200 아래 · 400 이상은 250 아래) = 한 줄 판 (판이 떠 있는 동안 그대로) — 무대 아래 끝으로 보내도 150 에서 이름 아래 절반을 0.55초 가리던 것 (UX 리뷰어 #78 큼) ·
  //   200 ~ 249 × 400 ~ 600 세로 판 (94) 이 [3] 거북왕 · 필살기를 쓰는 상대를 1.2초 넘게 덮던 것 (픽셀 검사원 #95 13바퀴 큼 2)
  const bigRowRef = useRef<boolean | null>(null);
  // 낮은 패널 띠 자리 큰 판 (bigUp) 도 한 줄 판 (높이 38 — 머리 위에 들어가게, UX 리뷰어 #95 6바퀴 큼 2)
  if (prompt?.kind !== 'join' && prompt?.kind !== 'gather') bigRowRef.current = null;
  // #135 A (10-23 태현 님 "응 추천대로 해줘") — 모든 크기에서 끼어들기 · 모으기 판 = 머리 위 띠 자리 한 줄 판 ("합동! [2] 이상해꽃 [3] 거북왕" · #81 2초 넘게 그대로) —
  //   240 · 480 · 높은 패널의 가운데 큰 판 (두 줄 66px) 이 앞장 리자몽 · 상대 셋을 2초 덮던 것. 넘치면 줄이는 단계 (f1 ~ f7)
  else if (bigRowRef.current === null) bigRowRef.current = true;
  const bigRow = bigRowRef.current === true;
  //   높은 패널 (300 이상) · 480 아래 끼어들기 판이 띠 위에 들어갈 자리가 없으면 (×1 — 240 · 300 × 315 에서 판 94 > 띠 위 빈 자리 60) 판이 떠 있는 동안 띠를 숨기고 판 제목에 이름
  //   (띠가 뜨며 판이 88px 아래로 튀어 누를 [1][2] · 포켓몬을 0.7초 덮던 것 — UX 리뷰어 #95 13바퀴 큼 2 · 판 자리 효과가 재서 정함)
  const bigTall = useRef(false);
  const [, reBig] = useState(0);
  if (prompt?.kind !== 'join') bigTall.current = false;
  //   400 ~ 479 한 줄 끼어들기 판도 띠를 숨기고 띠 자리에 (띠 아래로 밀려 y 84 에서 [2] 이상해꽃을 덮던 것 — 픽셀 검사원 #95 13바퀴 1)
  //   (#135 A — 한 줄 판이 띠 자리를 넘겨받으니 모든 크기에서 띠를 숨김 · 판 제목이 띠 내용 "소미안 필살기 · 끼어들기")
  const bigHide = bigUp || prompt?.kind === 'join' || prompt?.kind === 'gather' || bigTall.current;
  // 새 띠는 떠 있는 쓰러짐 줄이 1초를 채울 때까지 기다렸다가 그 자리를 넘겨받음 (띠가 뜨며 쓰러짐 줄이 28 ~ 44px 아래로 튀던 것 — UX 리뷰어 #95 8바퀴 2 · 같은 규칙 두 번째 ·
  //   띠 자리를 미리 비우지 않음). 낮은 패널 큰 판은 쓰러짐 줄을 바로 넘겨받음 (아래)
  // 결과 줄 (판 끝) — 뜨면 띠 자리를 넘겨받음 (띠 "이겼다!" 아래 결과 줄 "… 이겼다!" 로 두 번 쌓이던 것 — UX 리뷰어 #95 10바퀴 7)
  //   띠에 붙은 쓰러짐 말이 1.2초 된 뒤에 (좁은 패널 "이겼다! │ 소미안 쓰러졌다!" 가 0.86 ~ 0.93초에 결과 줄로 닫히던 것 — UX 리뷰어 #95 11바퀴 4 · #131)
  const bigOn = prompt?.kind === 'join' || prompt?.kind === 'gather';
  // 띠 · 큰 판이 넘겨받은 쓰러짐 말은 다시 줄로 안 냄 (띠가 닫힌 뒤 지난 "통통코 쓰러졌다!" 가 두 장면 다시 뜨던 것 — UX 리뷰어 #95 10바퀴 3)
  const faintTaken = useRef(new Set<number>());
  if (faintTaken.current.size > 24) faintTaken.current = new Set([...faintTaken.current].slice(-12));
  const take = (ps: typeof faints) => ps.forEach((p) => faintTaken.current.add(p.id));
  const faintBox = useRef<{ text: string; at: number } | null>(null);
  const panelFaint = useRef<{ text: string; short: string | null; ids: number[]; at: number } | null>(null);
  // 붙잡기 · 기다림 시간은 진짜 시계 (게임 시계면 ▶▶ ×2 에서 1.2초가 0.6초 — 상대 필살기 띠가 0.85 ~ 0.96초만 보이던 것, UX 리뷰어 #95 13바퀴 큼 1 · 같은 띠 세 번째)
  const bandNow = realNow();
  // 쓰러짐 말마다 처음 본 때 — 큰 판이 뜰 때 이미 1초 넘게 보인 말은 접지 않고 넘김 (아래)
  const faintAt = useRef(new Map<number, number>());
  // 힘겨루기 장면 (#116) — 쓰러짐 말을 붙잡아 두므로 (아래 duelFaintHold) 뜬 때를 계속 새로 잡고 · 장면이 끝난 첫 그림에서 한 번 더 (장면 끝무렵은 엔진이 붙잡혀
  //   그림이 드물어 마지막으로 잡은 때가 돌아오기 0.5초 전 — 돌아온 뒤 0.8 ~ 0.9초만 보이던 것, #116 2바퀴)
  const wasDuel = useRef(false);
  const duelEnd = view?.kind !== 'duel' && wasDuel.current;
  wasDuel.current = view?.kind === 'duel';
  faints.forEach((p) => (view?.kind === 'duel' || duelEnd || !faintAt.current.has(p.id)) && faintAt.current.set(p.id, bandNow));
  if (faintAt.current.size > 24) faintAt.current = new Map([...faintAt.current].slice(-12));
  // 판이 닫히면 접혀 있던 쓰러짐 말을 넘김 — 처음 보인 지 1.2초가 넘었을 때만 (안 됐으면 줄로 남겨 1.2초를 채움) · 이 그림의 줄 계산보다 먼저
  //   (판이 닫히는 장면에 접힌 말이 줄로 한 장면 다시 뜨고 · 빨리 누르면 0.92 ~ 0.97초만 보이던 것 — UX 리뷰어 #95 11바퀴 2)
  if (!bigOn && panelFaint.current) {
    // (1.0초 — #131 "1초 넘게" · 1.2 로 잡으면 판을 빨리 닫을 때 줄로 0.13 ~ 0.25초 다시 뜨고 합동 띠가 그만큼 늦던 것, UX 리뷰어 #95 12바퀴 6)
    if (bandNow - panelFaint.current.at >= 1000) take(faints.filter((p) => panelFaint.current!.ids.includes(p.id)));
    panelFaint.current = null;
  }
  const freeFaints = faints.filter((p) => !faintTaken.current.has(p.id));
  const boxPs = band && seenBand0(band.key) ? freeFaints.filter((p) => faintSeen.current.get(p.id) !== true) : freeFaints;
  const boxText = line(boxPs);
  if (!boxText) faintBox.current = null;
  else if (!faintBox.current) faintBox.current = { text: boxText, at: bandNow };
  // 넘겨받기 문턱은 모두 1.2초 (1.0 이면 쓰러짐 줄이 0.95 ~ 1.0초에 넘겨지던 것 — UX 리뷰어 #95 10바퀴 5 · 8바퀴 6 과 같은 종류)
  //   줄에 든 이름 중 가장 늦게 뜬 것부터 셈 (첫 이름으로 세어 뒤에 붙은 "통통코" 가 0.78 ~ 0.87초만 보이던 것 — UX 리뷰어 #95 14바퀴 큼 1 · 진짜 시계로 바꾸며 드러남, #131)
  const boxAt = boxPs.map((p) => faintAt.current.get(p.id) ?? bandNow);
  const boxLast = boxAt.length ? Math.max(...boxAt) : bandNow;
  const boxYoung = faintBox.current !== null && faintHoldLeft(boxAt, bandNow) > 0;
  //   결과 줄도 떠 있는 쓰러짐 줄의 가장 늦은 이름이 1.2초 된 뒤 (판 끝 합동으로 셋을 연달아 쓰러뜨리면 마지막 이름이 0.98 ~ 1.0초에 결과 줄로 바뀌던 것 — UX 리뷰어 #95 15바퀴 큼 1 ·
  //   #131 일곱 번째 · 띠에 붙은 말은 attach 가 기다림)
  // 판 끝 (over) 쓰러짐 줄은 한 번 늘어난 글을 줄이지 않고 가장 늦은 이름 + 1.2초에 결과 줄로 한 번에 바꿈 (앞 이름부터 하나씩 빠지며 1.2초 안에 글이 네 번 바뀌고
  //   남은 이름이 앞으로 당겨지던 것 — 아트 디렉터 · UX 리뷰어 #95 16바퀴 작음 · bugs 1655 · BW 말 상자는 통째로 바뀜)
  const overLine = useRef<{ names: string[]; last: number } | null>(null);
  if (b.phase !== 'over') overLine.current = null;
  else if (boxPs.length) {
    const ol = overLine.current ?? { names: [], last: Number.NEGATIVE_INFINITY };
    boxPs.forEach((p) => {
      const nm = p.text.replace(FAINT_RE, '');
      if (!ol.names.includes(nm)) ol.names.push(nm);
    });
    ol.last = Math.max(ol.last, boxLast);
    overLine.current = ol;
  }
  const lineYoung = b.phase === 'over' && faintHoldLeft(overLine.current ? [overLine.current.last] : boxAt, bandNow) > 0;
  const msgOn = b.phase === 'over' && b.overMs >= 1000 && !!b.msg && !(attach.current !== null && realNow() - attach.current.at < 1200) && !lineYoung;
  // VS 띠는 쓰러짐 줄을 기다리지 않고 그 말을 띠 끝에 붙임 (기다리다 720 아래에서 연타 안내에 넘겨 VS 가 0.38 ~ 0.72초만 보이던 것 — UX 리뷰어 #95 10바퀴 2 · 태현 님 #431 같은 종류)
  //   장면 전환 (view) 동안은 띠가 안 보이므로 붙이지 않음 (힘겨루기 장면의 숨은 VS 띠가 쓰러짐 말을 가져가 돌아온 뒤 줄에서 0.8초 만에 빠지던 것 — #116)
  if (!view && band?.kind === 'vs' && !seenBand0(band.key) && boxYoung && boxText && !bigHide) {
    bandFaint.current = { key: band.key, text: boxText, short: faintShortLine(boxPs.map((p) => p.text.replace(FAINT_RE, ''))) };
    take(boxPs);
  }
  const bandWait = !!band && band.kind !== 'vs' && !seenBand0(band.key) && boxYoung;
  // 720 아래 연타 안내는 VS 띠가 1.2초 보인 뒤에 넘겨받음 (연타 셈은 엔진 그대로) · 한 번 넘긴 VS 띠는 그 힘겨루기 동안 다시 안 띄움
  //   (머릿수가 바뀌며 VS 띠가 0.2초 다시 떠 연타 안내를 28px 밀고 그 자리에 남아 240 에서 리자몽을 1.8초 덮던 것 — 픽셀 검사원 #95 10바퀴 1 · UX 3)
  const vsTaken = useRef<string | null>(null);
  const vsSeenAt = band?.kind === 'vs' && seenBand0(band.key) ? seenBand.current!.at : null;
  // 힘겨루기 장면 (#116) — VS 컷인이 걷힌 뒤 (장면 시계 = 연출과 같은 performance.now) · 자리는 위 가운데 (장면 동안 띠가 없음 — 아래 자리는 두 줄기 아래 끝에 붙던 것)
  const duelView = view?.kind === 'duel' ? view : null;
  const duelVsLeft = duelView ? (duelView.phase === 'show' ? DUEL_VS_MS - (seenNow - duelView.at) : DUEL_VS_MS) : 0;
  const mashShow = mashOn && duelVsLeft <= 0 && (low || band?.kind !== 'vs' || vsTaken.current === band.key || (vsSeenAt !== null && bandNow - vsSeenAt >= 1200));
  if (mashShow && band?.kind === 'vs' && !low) vsTaken.current = band.key;
  const vsHidden = band?.kind === 'vs' && !low && vsTaken.current === band.key;
  const bandVis0 = band && !bigHide && !bandWait && !vsHidden && !msgOn ? band : null;
  // 보인 띠는 1.2초 넘게 (낮은 패널에서 끼어들기 판이 2.1초 띠 자리를 쓰고 판이 닫힌 뒤 뜬 상대 필살기 띠가 0.89초만 보이던 것 — UX 리뷰어 #95 7바퀴 2 · U1) ·
  //   일부러 숨긴 띠 (큰 판 · 연타 안내) 는 붙잡지 않음
  // 큰 판에 숨었다가 다시 보인 띠는 다시 보인 때부터 1.2초 (판 앞에 잠깐 보였던 때로 세어 빠르게 ▶▶ 에서 상대 필살기 띠가 0.88 ~ 0.93초만 보이던 것 — UX 리뷰어 #95 12바퀴 큼 1 · 7바퀴 2 같은 종류 두 번째)
  const bandHidden = useRef<string | null>(null);
  if (band && bigHide) bandHidden.current = band.key;
  if (bandVis0) {
    if (seenBand.current?.view.key !== bandVis0.key || bandHidden.current === bandVis0.key) seenBand.current = { view: bandVis0, faint: seenBand.current?.view.key === bandVis0.key ? seenBand.current.faint : null, at: bandNow };
    if (bandHidden.current === bandVis0.key) bandHidden.current = null;
    seenBand.current.view = bandVis0;
    seenBand.current.faint = bandFaint.current;
  }
  const bandKept = !bandVis0 && !band && !bigHide && !msgOn && seenBand.current !== null && seenBand.current.view.key !== vsTaken.current && bandNow - seenBand.current.at < 1200;
  const bandVis = bandVis0 ?? (bandKept ? seenBand.current!.view : null);
  // 실제로 그리는 띠 — 장면 전환 (view) 동안은 띠를 안 그림 (이름은 큰 컷인 · 1:1 이름 띠) · 줄 자리 (쓰러짐 줄 · 연타 안내 · 머리 위 숫자 아래 끝) 도 이것으로 셈
  // 장면 전환을 켠 판의 필살기 · 합동 띠 (힘겨루기 뒤 합동은 띠가 없음 — bandOf) 는 늘 장면 전환으로 바뀌니 처음부터 안 그림 — 엔진 상태가 먼저 바뀌고 연출이 다음 그림에 view 를 세워
  //   띠가 한 장면 (50 ~ 100ms) 번쩍이던 것 (#96 UX 5바퀴 큼 1)
  //   짝 · 이름은 앞의 합동 멘트 판 · 큰 컷인 (짝 그림 + 합동! + 이름) 이 말함 (디자인 #96 5바퀴)
  //   힘겨루기 VS 띠도 (#116 — 힘겨루기도 장면 전환 · 480 × 150 에서 한 틱 번쩍이던 것, UX 리뷰어 2바퀴 큼 1)
  const waitKey = bandVis && (bandVis.kind === 'ult' || bandVis.kind === 'joint' || bandVis.kind === 'vs') ? bandVis.key : null;
  if (waitKey && viewWait.current?.key !== waitKey) viewWait.current = { key: waitKey, at: bandNow, viewed: false };
  if (!waitKey) viewWait.current = null;
  if (viewWait.current && view) viewWait.current.viewed = true;
  const viewWaitAt = viewWait.current && !viewWait.current.viewed ? viewWait.current.at : null;
  // 장면 전환을 이미 보인 띠는 도중에 꺼도 그대로 숨김 (V 로 끈 뒤 끝난 필살기 이름 띠가 다시 뜨던 것 — 코드 리뷰어 #97)
  const bandShown = bandDrawn(bandVis, !!view, TEAM_FX.view11 && (cutscene || !!viewWait.current?.viewed), viewWait.current?.viewed ? 0 : viewWaitAt !== null ? bandNow - viewWaitAt : undefined);
  // 좁은 패널 (패널 폭 판) 은 띠가 1.2초 보인 뒤에 쓰러짐 말을 붙임 — 붙으면 한 말만 남아 필살기 이름이 빠짐 (맥 글꼴이면 4단계 — 이름이 1.2초는 보이게, UX 리뷰어 #95 8바퀴 1)
  //   (이겼다 · 졌다 · VS 는 바로 — 제목이 짧아 같이 들어가고, 늦게 붙이면 결과 줄에 닫혀 말이 1초가 안 됨, UX 리뷰어 #95 11바퀴 4)
  const narrowWait = widthPx < 400 && (bandVis0?.kind === 'ult' || bandVis0?.kind === 'joint') && seenBand.current !== null && bandNow - seenBand.current.at < 1200;
  const inBand = narrowWait ? null : bandVis0 ? bandFaint.current : bandKept ? seenBand.current!.faint : null;
  if (bandVis && inBand && attach.current?.key !== bandVis.key) attach.current = { key: bandVis.key, at: bandNow };
  else if (!bandVis) attach.current = null;
  // 띠가 쓰러짐 줄 자리를 넘겨받은 뒤 (1초 넘게 보인 줄) · 낮은 패널 큰 판이 뜨면 (바로) 쓰러짐 줄을 닫음
  //   (낮은 패널 큰 판도 바로 지우지 않음 — 기획 #131 "쓰러짐 말 1초 넘게 보인 뒤" · 판이 줄 아래에 서고 1.2초 뒤 줄 자리를 넘겨받음)
  const boxTaken = !view && bandVis0 !== null && !boxYoung && faintBox.current !== null && seenBand.current !== null && seenBand.current.at >= faintBox.current.at;
  if (boxTaken) take(boxPs);
  // 넘긴 말은 이 그림에서 바로 뺌 (VS 띠 끝 말과 밀린 같은 줄이 1장면 함께 보이던 것 — UX 리뷰어 #95 12바퀴 5)
  const freeNow = faints.filter((p) => !faintTaken.current.has(p.id));
  let apart0 = boxTaken ? null : line(bandShown ? freeNow.filter((p) => faintSeen.current.get(p.id) !== true) : freeNow);
  // 큰 판 (끼어들기 · 모으기) 이 뜨면 떠 있는 쓰러짐 말을 판 맨 위에 접어 넣음 (판이 끝날 때까지 그대로 — #131 "쓰러짐 말 1초 넘게" 를 지키며, 판은 늘 머리 위 자리 ·
  //   쓰러짐 줄 아래에 판이 서서 누를 [2][3] 을 2.4초 가리던 것 — UX 리뷰어 #95 10바퀴 1 · 6 · 픽셀 2 · 3)
  //   한 줄 판 (낮은 패널 · 150 높이 상대 끼어들기) 에는 안 접음 — 줄이 넘쳐 판이 2 ~ 4줄로 커지며 머리 · 키를 덮던 것 (UX 리뷰어 #95 11바퀴 1) · 줄은 띠 자리, 판은 그 아래 ·
  //   세로 판은 한 줄 고정 (둘 넘고 480 아래면 "N마리 쓰러졌다!") · 처음 글 그대로 (판이 떠 있는 동안 글이 바뀌어 판 크기가 달라지던 것 — 11바퀴 7)
  //   (한 줄 판도 400 이상이면 접음 — 한 줄 고정 · 넘치면 줄이는 단계 (판 자리 효과) · 접지 않으면 판이 쓰러짐 줄 아래로 22 ~ 28px 내려와 [2][3] 머리를 덮던 것, 픽셀 검사원 #95 12바퀴 1 ·
  //   240 한 줄 판은 #81 (태현 님 결정 대기) 이라 그대로)
  const foldOk = bigOn && !msgOn && (!(bigUp || (prompt?.kind === 'join' && heightPx < 200)) || widthPx >= 400);
  if (foldOk && apart0 && !panelFaint.current) {
    const ps = bandShown ? freeNow.filter((p) => faintSeen.current.get(p.id) !== true) : freeNow;
    // 이미 1초 넘게 보인 말은 접지 않고 넘김 (#131 을 채움 — 판 맨 앞에서 2.4초 더 보이며 한 줄 판 제목 앞을 밀어내 "통통코 쓰러졌다! │ 같이 쓰기! [2] 이상해꽃" 으로 읽히고 ·
    //   400 × 187 세로 판이 94 높이로 [3] 거북왕을 덮던 것 — UX 리뷰어 #95 13바퀴 3 · 4 · 5)
    const young = ps.filter((p) => bandNow - (faintAt.current.get(p.id) ?? bandNow) < 1000);
    take(ps.filter((p) => !young.includes(p)));
    const text = line(young);
    // "N마리" 는 넘칠 때만 (판 자리 효과가 재서 바꿈 — 재지 않고 바꿔 240 에서 이름이 0.13 ~ 0.6초만 보이던 것, UX 리뷰어 #95 12바퀴 3)
    if (text) panelFaint.current = { text, short: faintShortLine(young.map((p) => p.text.replace(FAINT_RE, ''))), ids: young.map((p) => p.id), at: Math.max(...young.map((p) => faintAt.current.get(p.id) ?? bandNow)) };
    apart0 = null;
  }
  // 쓰러짐 줄은 한 번 늘면 안 줄임 — 앞 이름 말 (엔진 팝업) 이 먼저 끝나 "소미안" → "소미안 · 레디바" → "레디바 쓰러졌다!" 로 1.5초에 세 번 바뀌던 것
  //   (UX 리뷰어 #98 2바퀴 ⑦ · 1655 같은 종류) · 마지막 이름이 붙은 뒤 1.2초 (진짜 시계) 에 통째로 닫음 · 띠 · 판으로 넘어가면 (take · 접기) 놓음
  const faintStick = useRef<{ names: string[]; at: number } | null>(null);
  const liveFaint = apart0 ? apart0.replace(FAINT_RE, '').split(' · ') : [];
  if (boxTaken || panelFaint.current) faintStick.current = null;
  else if (liveFaint.length) {
    const add = liveFaint.filter((nm) => !faintStick.current?.names.includes(nm));
    if (!faintStick.current) faintStick.current = { names: liveFaint, at: realNow() };
    else if (add.length) faintStick.current = { names: [...faintStick.current.names, ...add], at: realNow() };
  }
  // 힘겨루기 장면 (#116) — 쓰러짐 말이 장면 끝 1:1 큰 글씨 ("힘대결에서 이겼다!" · "거북왕의 하이드로캐논!") 를 덮던 것 → 장면 동안은 안 띄우고 붙잡아 두었다가 돌아온 뒤 그때부터 1.2초
  //   (아래 가운데에 두면 합류 나선 아래 끝 · 줄기를 11 ~ 16줄 덮던 것 — 픽셀 검사원 #116 큼 1 · 위는 결과 글)
  const duelFaintHold = duelView !== null;
  if ((duelFaintHold || duelEnd) && faintStick.current) faintStick.current = { ...faintStick.current, at: realNow() };
  else if (!liveFaint.length && faintStick.current && realNow() - faintStick.current.at >= 1200) faintStick.current = null;
  if (faintStick.current) apart0 = `${faintStick.current.names.join(' · ')} 쓰러졌다!`;
  const [, kickStick] = useState(0);
  const stickLeft = faintStick.current && !liveFaint.length ? faintStick.current.at + 1200 - realNow() : -1;
  useEffect(() => (stickLeft >= 0 ? realLater(() => kickStick((k) => k + 1), Math.max(16, stickLeft + 20)) : undefined), [faintStick.current?.at, stickLeft >= 0]);
  // 힘겨루기 머릿수가 바뀐 뒤 1초 = 금색 (상대가 끼어들어도 숫자 한 글자만 바뀌어 몰랐던 것 — UX 리뷰어 #95 3바퀴)
  const count = prompt?.kind === 'mash' ? `${prompt.me}:${prompt.foe}` : '';
  const countAt = useRef<{ count: string; at: number }>({ count: '', at: 0 });
  //   보이는 동안만 셈 · 힘겨루기 장면은 처음 보일 때 1 대 1 이 아니면 새 표시 (VS 컷인 동안 상대가 합류해 끼어들기 판 "받아치면 1 대 1" 과 다른 "1 대 2" 가 새 표시 없이 뜨던 것 — UX 리뷰어 #116 큼 3)
  if (mashShow && count && count !== countAt.current.count) countAt.current = { count, at: countAt.current.count || (duelView && count !== '1:1') ? realNow() : 0 };
  const countNew = count !== '' && countAt.current.at > 0 && realNow() - countAt.current.at < 1000;
  //   좁으면 띠 줄 (24 + 4) 아래 — 힘겨루기 VS 띠가 "3 대 1 — 이길 거예요" 를 1.7초 덮던 것 (픽셀 검사원 #95)
  //   띠가 없으면 띠 자리 (위 줄 쌓기에 같이 — 쓰러짐 줄이 먼저 떠 있으면 그 아래)
  // 힘겨루기 장면 — 높은 패널 (300 이상) 은 장면 속 두 앞장 그림 위 끝 − 24 − 패널 높이 × 0.12 (정보줄 밑이면 줄기와 260px 떨어지던 것 — UX 리뷰어 #116 2바퀴 작음 2 · × 0.05 면 1860 나선 위쪽에 걸침) · 그 밖은 정보줄 밑 (bandTop0)
  const duelTop = (() => {
    if (!duelView || heightPx < 300 || !vSpots || !vGroups) return bandTop0;
    const tops = SIDES.flatMap((s) => {
      const i = vGroups[s][0];
      const f = i !== undefined ? b[s][i] : undefined;
      const sp = vSpots[s][0];
      if (!f || !sp) return [];
      const a = artOf(f.form, g.scale);
      return [sp.y - Math.round(a.foot * a.s)];
    });
    return tops.length ? Math.max(bandTop0, Math.min(...tops) - 24 - Math.round(heightPx * 0.12)) : bandTop0;
  })();
  const promptStyle = duelView ? { top: `${duelTop}px` } : low ? { top: 'auto', bottom: '4px' } : { top: `${bandShown ? bandTop + BAND_PX + 4 : bandTop}px` };
  // 엔진 한 줄 (필살기 · 합류 · 결과) 은 판 끝 결과만 · 쓰러지는 장면이 1초 보인 뒤 (컷인 이름을 가리고 · 지난 필살기 줄이 남던 것 — UX 리뷰어 · U1 1초) ·
  //   결과 줄은 쓰러짐 줄 · 띠 자리를 넘겨받음 (픽셀 검사원 #95 6바퀴 6 · UX 10바퀴 7) · 큰 판이 떠 있으면 쓰러짐 말은 판 안 (위)
  //   결과 줄이 뜰 때까지 붙잡음 (지는 판은 결과 줄이 0.3 ~ 0.6초 늦어 그 사이 마지막 이름 하나로 줄던 것 — UX 리뷰어 #95 17바퀴 2)
  //   떠 있던 쓰러짐 줄 이름 (faintStick — 엔진 말이 먼저 끝난 이름) 도 앞에 둠 (힘겨루기 장면에서 돌아온 직후 판이 끝나 "꼬렛 · 구구" 가 0.4초 만에 빠지고 마지막 이름만 남던 것 — #116 2바퀴)
  const overNames = [...new Set([...(faintStick.current?.names ?? []), ...(overLine.current?.names ?? [])])];
  const overText = b.phase === 'over' && overLineHold(lineYoung, b.overMs, !!b.msg) && !msgOn && !boxTaken && overLine.current?.names.length ? `${overNames.join(' · ')} 쓰러졌다!` : null;
  const apart = duelFaintHold || msgOn || (bigOn && panelFaint.current) ? null : (overText ?? apart0);
  // 기다림 · 붙잡기 끝에 다시 그림 (그림은 열쇠가 바뀔 때만 다시 그려져, 띠 기다림이 끝나도 0.05 ~ 0.5초 늦게 뜨던 것 — UX 리뷰어 #95 10바퀴 4)
  // 장면 전환 피해 칩 (ideas 717 — 장면 동안 판 · 숫자를 숨겨 필살기 · 합동 피해가 안 보이던 것): 장면이 선 뒤 맞는 쪽에 뜬 피해를 합계 칩 하나로 맞는 칸 1:1 자리 머리 위에 ·
  //   진짜 시계 1.2초 (▶▶ 에서도 — ux-rules 화면 붙잡기) · out 에 바둑판으로 사라짐 · 그 숫자는 돌아온 뒤 3:3 자리에 다시 안 띄움 (skip)
  const viewChip = useRef<{ inAt: number; afterId: number; ids: number[]; shownAt: number } | null>(null);
  const chipDone = useRef<ReadonlySet<number>>(new Set());
  if (view && (!viewChip.current || (view.phase === 'in' && viewChip.current.inAt !== view.at))) {
    viewChip.current = { inAt: view.phase === 'in' ? view.at : -1, afterId: b.popups.reduce((m, p) => Math.max(m, p.id), -1), ids: [], shownAt: 0 };
  } else if (!view && viewChip.current) {
    chipDone.current = new Set([...chipDone.current, ...viewChip.current.ids]);
    viewChip.current = null;
  }
  if (chipDone.current.size && !b.popups.some((p) => chipDone.current.has(p.id))) chipDone.current = new Set();
  const vc = viewChip.current;
  const chip = view && vc ? viewHitChip(b.popups, view.to.side, vc.afterId) : null;
  if (chip && vc) {
    vc.shownAt ||= bandNow;
    vc.ids = chip.ids;
  }
  const chipOn = !!chip && !!vc && bandNow - vc.shownAt < VIEW_CHIP_MS;
  const skip: ReadonlySet<number> = vc?.ids.length ? new Set([...chipDone.current, ...vc.ids]) : chipDone.current;
  const [, wakeUp] = useState(0);
  // 힘겨루기 장면 연타 안내 처음 폭 (장면마다 한 번 잼)
  const mashEl = useRef<HTMLDivElement>(null);
  const mashW = useRef<{ at: number; w: number } | null>(null);
  useLayoutEffect(() => {
    if (!duelView || !mashEl.current) return;
    // 장면 동안 가장 넓었던 폭 (첫 판 "1 대 3 — 질 거예요" 가 좁아 넓어졌다 줄며 왼쪽 끝이 26px 튀던 것 — 픽셀 검사원 #116 2바퀴 작음 4)
    const w = Math.ceil(mashEl.current.getBoundingClientRect().width);
    if (mashW.current?.at !== duelView.at) mashW.current = { at: duelView.at, w };
    else if (w > mashW.current.w) mashW.current = { at: duelView.at, w };
  });
  // VS 컷인이 걷히는 때에 다시 그림 (장면 동안 엔진이 붙잡혀 그림이 안 바뀜) — VS 는 연출 (게임 시계) 이 그려서 붙잡기가 아니라 같은 시계 setTimeout (화면 붙잡기 규칙 밖 · hold-clock 시험)
  useEffect(() => {
    if (duelVsLeft <= 0) return undefined;
    const id = setTimeout(() => wakeUp((n) => n + 1), Math.ceil(duelVsLeft) + 30);
    return () => clearTimeout(id);
  }, [duelView?.at, duelView?.phase]);
  const wakes = [
    bandWait && faintBox.current ? boxLast + 1200 : 0,
    mashOn && !mashShow && vsSeenAt !== null ? vsSeenAt + 1200 : 0,
    (narrowWait || bandKept) && seenBand.current ? seenBand.current.at + 1200 : 0,
    attach.current ? attach.current.at + 1200 : 0,
    lineYoung ? (overLine.current?.last ?? boxLast) + 1200 : 0,
    viewWaitAt !== null ? viewWaitAt + VIEW_WAIT_MS : 0,
    chipOn && vc ? vc.shownAt + VIEW_CHIP_MS : 0,
    // 머릿수 새 표시 1초 끝 (장면 동안 엔진이 붙잡혀 다시 안 그려져 금색이 남던 것)
    countNew ? countAt.current.at + 1000 : 0,
  ].filter((t) => t > bandNow);
  const nextWake = wakes.length ? Math.min(...wakes) : 0;
  useEffect(() => {
    if (!nextWake) return;
    return realLater(() => wakeUp((n) => n + 1), Math.max(16, nextWake - realNow() + 16));
  }, [nextWake]);
  // 위 가운데 줄 (띠 · 쓰러짐 줄 · 연타 안내 · 결과 줄 모두 24, 사이 4) 의 아래 끝 — 머리 위 숫자 · 칩은 그 아래까지만 (띠 아래 쓰러짐 줄은 안 봐서 240 "합동! −12" 칩이 그 밑에 가려지던 것 — 픽셀 검사원 #95 4바퀴 ①)
  const rows = [bandShown ? BAND_PX : 0, apart ? 24 : 0, mashShow && !low ? 24 : 0, msgOn ? 24 : 0].filter((h) => h > 0);
  const rowsBottom = rows.length ? bandTop + rows.reduce((t, h) => t + h, 0) + 4 * (rows.length - 1) : 0;
  const ult = (slot: number) => onInput({ kind: 'team-battle', input: { kind: 'ult', slot } });
  // 큰 판 (끼어들기 · 합동) 은 무대 한가운데 — 폭 · 높이를 재서 왼쪽 · 위를 정수 px 로 (translate −50% 는 홀수 폭이면 반 픽셀)
  const bigBox = useRef<HTMLDivElement>(null);
  // 쓰러짐 말을 피해 내린 판의 위 (판이 떠 있는 동안만 기억)
  const bigLow = useRef<number | null>(null);
  const bigLeft = useRef<number | null>(null);
  const bigW = useRef<number | null>(null);
  // 이 판에서 접힌 쓰러짐 말을 보였는지 — 보였으면 판이 떠 있는 동안 빼지 않음 (#131 "1초 넘게 보인 뒤 칸 빔")
  const foldShown = useRef(false);
  // 한 줄 판이 지도 줄 자리로 올라갔는지 — 그동안 지도 줄을 숨김 (아래)
  const bigCover = useRef(false);
  if (prompt?.kind !== 'join' && prompt?.kind !== 'gather') {
    bigLow.current = null;
    bigLeft.current = null;
    bigW.current = null;
    foldShown.current = false;
    bigCover.current = false;
  }
  // 머리 위 말 · 숫자를 패널 양 끝 2px 안으로 (끝 칸의 "버섯꼬 쓰러졌다!" 의 "!" · "리자드" 의 "리" 가 잘리던 것 — UX 리뷰어 R9 ⑥, U4) · 정수 px
  // 처음 안내 (위 · 3:3 저절로 필살기) 와 겹치면 안내 아래 2px 로 내림 — 이 층 (z 5) 이 안내 (z 7) 아래라 240 에서 "레디바 쓰러졌다!" 첫 글자가 1.2초 숨던 것 (#59 UX 다시 보기 · 480 "-7" 의 "-" 도)
  //   떠 있는 동안 위로 안 옮김 ("이겼다!" 띠가 닫히는 장면에 "합동! −14" 칩이 20 ~ 24px 위로 튀던 것 — UX 리뷰어 #95 6바퀴 큼 3 · 위 줄 쌓기와 같은 규칙)
  const popMin = useRef(new WeakMap<HTMLElement, number>());
  useLayoutEffect(() => {
    const W = window.innerWidth;
    const tip = root.current?.closest('#pokemon-game')?.querySelector<HTMLElement>('.pg-first-tip.pg-first-tip-top')?.getBoundingClientRect();
    root.current?.querySelectorAll<HTMLElement>('.pg-team-pop').forEach((el) => {
      el.style.marginLeft = '0px';
      el.style.marginTop = '0px';
      // 폭도 정수 px (폭이 .359 · .625 처럼 소수면 왼쪽을 맞춰도 오른쪽 1px 테두리가 두 열로 번지던 것 — 픽셀 검사원 #95 7바퀴 2 · 원칙 4)
      el.style.width = '';
      el.style.width = `${Math.ceil(el.getBoundingClientRect().width)}px`;
      const r = el.getBoundingClientRect();
      const shift = r.left < 2 ? 2 - r.left : r.right > W - 2 ? W - 2 - r.right : 0;
      // 왼쪽 끝을 정수 px 로 (translate −50% 가 홀수 폭이면 반 px — 1px 판 테두리 · 글이 흐림, 아트 디렉터 #80)
      const fix = Math.round(r.left + shift) - r.left;
      if (Math.abs(fix) > 0.01) el.style.marginLeft = `${fix}px`;
      let mt = tip && tip.height > 0 && r.left + fix < tip.right && r.right + fix > tip.left && r.top < tip.bottom && r.bottom > tip.top ? Math.ceil(tip.bottom + 2 - r.top) : 0;
      const prev = popMin.current.get(el);
      if (prev !== undefined && r.top + mt < prev) mt = Math.ceil(prev - r.top);
      popMin.current.set(el, r.top + mt);
      if (mt) el.style.marginTop = `${mt}px`;
    });
  });
  // 위 가운데 줄 (띠 · 쓰러짐 줄 · 결과 줄) = 위에서부터 차례로 쌓음 (앞 줄 아래 + 4 · 처음 안내와 겹치면 안내 아래 + 2) · 떠 있는 동안은 위로 안 옮김 ·
  //   쓰러짐 줄 · 결과 줄의 가운데는 정수 px (띠는 TeamBand 가 잡음)
  //   — 결과 줄이 쓰러짐 줄과 2 ~ 18px 겹치고 · 띠 · 안내가 닫힐 때마다 쓰러짐 줄이 28px 튀고 · margin auto 라 left 가 71.594 처럼 소수이던 것 (픽셀 검사원 #95 4바퀴 ③ ⑥ ⑩)
  const stackMin = useRef(new WeakMap<HTMLElement, number>());
  const rowLeft = useRef(new WeakMap<HTMLElement, number>());
  useLayoutEffect(() => {
    const host = root.current;
    if (!host) return;
    const o = host.getBoundingClientRect();
    const W = host.clientWidth;
    const tip = host.closest('#pokemon-game')?.querySelector<HTMLElement>('.pg-first-tip.pg-first-tip-top')?.getBoundingClientRect();
    const els = Array.from(host.querySelectorAll<HTMLElement>(`:scope > .pg-team-band, :scope > .pg-team-faint, :scope > .pg-team-msg-over${low ? '' : ', :scope > .pg-team-prompt-mash'}`));
    const rows = els.map((el) => {
      if (!el.classList.contains('pg-team-band')) {
        el.style.transform = 'none';
        el.style.right = 'auto';
        el.style.margin = '0';
        // 왼쪽은 처음 자리 그대로 (글이 늘면 오른쪽으로만 — 쓰러짐 줄이 "레디바" → "레디바 · 통통코" 로 바뀔 때 가운데 다시 맞춰 ±20px 옮겨 가던 것, 픽셀 검사원 #95 10바퀴 8 · 띠와 같은 규칙)
        const w0 = el.getBoundingClientRect().width;
        const first = rowLeft.current.get(el) ?? Math.round((W - w0) / 2);
        rowLeft.current.set(el, first);
        el.style.left = `${Math.max(8, Math.min(first, Math.floor(W - 8 - w0)))}px`;
      }
      el.style.marginTop = '0px';
      const r = el.getBoundingClientRect();
      const hitsTip = !!tip && tip.height > 0 && r.left < tip.right && r.right > tip.left;
      return { base: r.top - o.top, h: r.height, min: stackMin.current.get(el), tip: hitsTip ? { top: tip!.top - o.top, bottom: tip!.bottom - o.top } : null };
    });
    // ×1 결과 줄이 두 줄로 넘치면 글 사이 · 좌우를 좁혀 한 줄 (맥 글꼴 +10% 에서 240 결과 줄이 44 가 되어 리자몽을 1.3 ~ 1.6초 덮던 것 — 픽셀 검사원 #95 8바퀴 6)
    els.forEach((el, i) => {
      if (!el.classList.contains('pg-team-msg-over') || g.scale !== 1) return;
      el.classList.remove('pg-msg-tight');
      if (el.getBoundingClientRect().height > 30) {
        el.classList.add('pg-msg-tight');
        const r2 = el.getBoundingClientRect();
        el.style.left = `${Math.round((W - r2.width) / 2)}px`;
        rows[i]!.h = r2.height;
      }
    });
    stackRows(rows).forEach((want, i) => {
      const el = els[i]!;
      stackMin.current.set(el, want);
      if (want !== rows[i]!.base) el.style.marginTop = `${Math.round(want - rows[i]!.base)}px`;
    });
  });
  // 큰 판 (끼어들기 · 모으기) 자리 — 위 줄 쌓기 뒤에 정함 (그 자리를 읽어야 해서). 위 줄 (띠 · 쓰러짐 줄) 과 가로로 겹치면 그 아래 + 4 · 큰 연출 중 아직 띠가 없으면 띠 자리 (24 + 4) 를 미리 비움 ·
  //   떠 있는 동안 위로 안 옮김 · 숨기지 않음 (아래 자리가 모자라면 패널 아래 끝에 붙임) — 240 · 480 × 150 에서 쓰러짐 말이 1초 안이면 판을 숨겨 0.8 ~ 1초 늦게 뜨고 (빨리 누르면 한 장면도 안 보임),
  //   띠가 뜨며 쓰러짐 줄이 내려와 판과 겹치던 것 (UX 리뷰어 #95 6바퀴 큼 2 · #81 "2초 넘게 확실히")
  useLayoutEffect(() => {
    const el = bigBox.current;
    const host = root.current;
    if (!el || !host) return;
    // 판이 넘치면 (맥 여유 1.1 · 판 최대 폭 = 패널 − 16) 한 단계씩 — 한 줄 판: "받아치면" 빼기 → 제목 앞 줄이기 ("소미안에" · "리자몽과") → 접힌 말 N마리 → 접힌 말 빼기 → 제목 앞 빼기 /
    //   세로 판: 접힌 말 N마리 (재지 않고 바꿔 이름이 0.13 ~ 0.6초만 보이던 것 — UX 리뷰어 #95 12바퀴 3 · 맥 240 한 줄 판이 "1 대 1" 줄바꿈으로 60 이던 것 — 픽셀 검사원 12바퀴 4)
    const maxW = widthPx - 16;
    const fold = el.querySelector<HTMLElement>('.pg-team-big-faint');
    const title = el.querySelector<HTMLElement>('.pg-team-big-title');
    el.classList.remove('pg-big-f1', 'pg-big-f2', 'pg-big-f3', 'pg-big-f4', 'pg-big-f5', 'pg-big-f6', 'pg-big-f7', 'pg-big-f8', 'pg-big-f9');
    if (fold?.dataset.full && fold.textContent !== fold.dataset.full) fold.textContent = fold.dataset.full;
    //   제목 앞은 지우지 않고 먼저 줄임 ("리자몽 필살기 · 같이 쓰기!" → "리자몽과 같이 쓰기!" · "소미안 필살기 · 끼어들기" → "소미안에 끼어들기" — 지우면 "같이 쓰기! [2] 이상해꽃" 이
    //   "이 둘이 합동한다" 로 읽히던 것, UX 리뷰어 #95 13바퀴 3 · UX 3:3 점검 3) · 세로 판은 제목도 잼 (띠를 숨긴 높은 패널은 제목에 이름)
    const row = el.classList.contains('pg-team-big-row');
    const over = () => (row ? el.scrollWidth * 1.1 : Math.max(fold?.scrollWidth ?? 0, title?.scrollWidth ?? 0) * 1.1 + 32) > maxW;
    //   끼어들기 한 줄 판은 이름 (띠를 숨겨 넣은 것 — 판이 닫히면 띠가 1.2초 말함) 을 쓰러짐 말보다 먼저 뺌 (400 × 187 에서 접힌 말이 빠져 0 ~ 0.43초만 보이던 것 — #131) ·
    //   모으기 판은 앞장 이름을 마지막까지 (빼면 "이 둘이 합동한다" 로 읽힘)
    //   모으기 한 줄 판은 키 옆 이름 ("이상해꽃 · 거북왕" — 칸 번호판이 말함) 을 앞장 이름 · 접힌 말보다 먼저 뺌 · 접힌 말 빼기는 늘 마지막, 한 번 보인 말은 판이 떠 있는 동안 안 뺌
    //   (400 ~ 459 × 150 · 맥 480 모으기 판이 접힌 말부터 빼 "소미안 쓰러졌다!" 가 0.13 ~ 0.44초만 보이고 · [2] ✓ 에 다시 재며 빠지던 것 — UX 리뷰어 #95 14바퀴 큼 2)
    //   상대 합동 판은 그다음 빨강 칠 뒤 " · " 빼기 (f8) → "상대 합동" → "합동" (f9 — 빨강이 상대를 말함): 맥 240 에서 줄이기를 다 써도 9px 넘쳐 "짐" 이 패널 끝에 잘리던 것 (UX 리뷰어 #95 17바퀴 큼 1)
    //   끼어들기 한 줄 판은 N마리 앞에 상대 얼굴 빼기 (f7 — 쓰러짐 이름이 먼저 · 누구 필살기인지는 판이 닫힌 뒤 띠가 말함, 400 · 맥 440 에서 얼굴 28px 로 다시 "2마리" 가 되던 것)
    //   한 줄 판은 N마리 앞에 간격 줄이기 (f6 — 판 안 여백 · 틈 10 → 6 · 키 사이 12 → 6: 400 ~ 419 에서 접힌 이름이 처음부터 "2마리" 이던 것 · 240 상대 합동 판 여백 1 ~ 2px — UX · 아트 #95 15 · 16바퀴, ideas 1605)
    //   모으기 한 줄 판은 키 옆 이름보다 간격 줄이기 (f6) 가 먼저 — 240 에서도 "합동! [2] 이상해꽃 [3] 거북왕" (#135 A — 이름이 먼저 빠져 "합동! [2] [3]" 이던 것)
    const steps = (!row ? ['short', 'pg-big-f2', 'pg-big-f4'] : prompt?.kind === 'join' ? ['pg-big-f1', 'pg-big-f2', 'pg-big-f4', 'pg-big-f6', 'pg-big-f7', 'pg-big-f8', 'pg-big-f9', 'short', 'pg-big-f3'] : ['pg-big-f2', 'pg-big-f6', 'pg-big-f5', 'short', 'pg-big-f4', 'pg-big-f3']).filter((k) => k !== 'pg-big-f3' || !foldShown.current);
    for (const k of steps) {
      if (!over()) break;
      if (k !== 'short') el.classList.add(k);
      else if (fold?.dataset.short) fold.textContent = fold.dataset.short;
    }
    if (fold && !el.classList.contains('pg-big-f3')) foldShown.current = true;
    const r = el.getBoundingClientRect();
    const o = host.getBoundingClientRect();
    const midY = infoBarPx + (heightPx - infoBarPx) / 2;
    const mine = [0, 1, 2].filter((i) => b.me[i]).map((i) => g.pos('me', i).x + Math.round(g.pw / 2));
    const myRight = mine.length ? Math.max(...mine) + 8 : 8;
    const mid = Math.round(Math.max(8, Math.min(widthPx - 8 - r.width, g.cx - r.width / 2)));
    // 내 편 오른쪽으로 비켜도 상대 그림 (끼어들 대상) 을 덮으면 가운데 그대로 (480 에서 비킨 판이 상대 셋을 덮던 것 — 픽셀 검사원 #95 4바퀴 ⑧)
    const foeArt = [0, 1, 2].filter((i) => b.foe[i]).map((i) => g.pos('foe', i).x - Math.round(g.pw / 2));
    const foeLeft = foeArt.length ? Math.min(...foeArt) - 8 : widthPx - 8;
    const left0 = mid < myRight && myRight + r.width <= Math.min(widthPx - 8, foeLeft) ? myRight : mid;
    // 왼쪽은 처음 자리 그대로 (키 "1" → "✓" 처럼 글이 바뀌어 폭이 달라질 때 1 ~ 3px 옮겨 가던 것 — 픽셀 검사원 #95 8바퀴 10) · 패널 밖으로 나갈 때만 당김
    // 판 폭이 8px 넘게 바뀌면 (줄이는 단계 · ✓) 가운데 다시 (왼쪽 고정이라 줄어든 판이 가운데보다 52px 왼쪽에 서던 것 — UX 리뷰어 #95 14바퀴 2 · 1 ~ 3px 는 그대로)
    if (bigLeft.current !== null && bigW.current !== null && Math.abs(r.width - bigW.current) > 8) bigLeft.current = null;
    if (bigLeft.current === null) bigW.current = r.width;
    const left = Math.max(8, Math.min(bigLeft.current ?? left0, widthPx - 8 - Math.ceil(r.width)));
    bigLeft.current = bigLeft.current ?? left0;
    // (띠 자리를 미리 비우지 않음 — 새 띠는 떠 있는 쓰러짐 줄이 1초 채울 때까지 기다렸다 같은 줄을 넘겨받음, UX 리뷰어 #95 8바퀴 2) ·
    //   다만 480 아래 끼어들기 판은 띠를 숨기지 않으니 곧 뜰 상대 필살기 띠 자리를 처음부터 비움 (판이 떠 있는 동안 띠가 뜨며 판 전체가 26px 아래로 튀던 것 — UX 리뷰어 #95 11바퀴 1)
    //   (상대 합동은 비우지 않음 — 합동 띠는 판이 닫힌 뒤에 와서 판만 26px 내려가 누를 [2][3] 을 덮던 것, UX 리뷰어 #95 12바퀴 4)
    //   높은 패널 (300 이상) 은 띠가 그림 칸 위 − 30 이라 그 아래를 비우면 판이 그림 줄 위로 내려옴 → 대신 판 아래 끝을 띠 위 − 4 로 (픽셀 검사원 #95 12바퀴 2)
    const bandSoon = prompt?.kind === 'join' && !prompt.foeJoint && !bigHide && !bandVis && b.phase === 'ult';
    // 높은 패널 (300 이상) 은 무대 한가운데가 아니라 맨 위 그림 칸 바로 위 (아래 끝 = 그림 칸 위 − 6) — 띠 · 쓰러짐 줄은 그림 위로 내렸는데 큰 판만 70px 위 빈 풀밭에 떠 있던 것 (아트 디렉터 #95 8바퀴 4 · "떠 보임")
    // 판 밑에 오는 포켓몬 (보이는 그림) 의 머리 위 − 2 까지 올림 — 860 × 187 에서 판 아래 끝이 누를 [3] 거북왕 머리를 4줄 덮던 것 (픽셀 검사원 #95 8바퀴 4) · 위 줄 아래 + 4 보다 위로는 안 감
    const under = blocks.filter((o) => o.box.b - o.box.t > 20 && o.box.l < left + r.width && o.box.r > left).map((o) => o.box.t);
    const headCap = under.length ? Math.min(...under) - 2 - Math.ceil(r.height) : Number.POSITIVE_INFINITY;
    // 띠를 숨긴 한 줄 판 (400 이상) = 띠 자리 (위 끝 = 띠 위 — 150 은 +2 · 187 은 +6 으로 판마다 정렬선이 어긋나던 것, 픽셀 검사원 #95 13바퀴 6) ·
    //   밑 포켓몬 머리를 덮으면 지도 줄을 통째로 덮는 자리 (정보줄 + 2) — 자리는 이 둘만 (187 × 480 ~ 720 에서 판이 지도 줄 아래 + 2 에 막혀 [1] 리자몽 머리를 1.9초 덮던 것 —
    //   픽셀 검사원 #95 13바퀴 큼 1 · 그 사이 아무 값에 서서 판 테두리가 지도 줄 한가운데를 지나 아이콘 아래 절반만 가리고 폭마다 위 끝이 46 · 52 · 57 로 갈리던 것 —
    //   아트 디렉터 #95 14바퀴 큼 1 · BW 판은 겹치면 통째로 덮음 · 지도 줄 (z 4) 은 판 (z 5) 아래)
    const rowUp = bigRow && bigHide;
    //   (높은 자리 = 정보줄 + 4 — 위 줄 쌓기 틈 4 와 같게 · + 2 면 정보줄 아래 선과 판 테두리가 겹선처럼 보이던 것, 아트 디렉터 #95 15바퀴 제안 2)
    const rowTop = headCap >= bandTop ? bandTop : infoBarPx + 4;
    bigCover.current = rowUp && rowTop < bandTop;
    //   ×1 (400 아래) 한 줄 판 바닥도 띠 위 (지도 줄 아래 + 2 라 240 상대 합동 판 위 끝 32 ↔ 다른 위 줄 30 — 아트 디렉터 #95 16바퀴 작음 2)
    const lo = rowUp ? rowTop : bigRow ? Math.min(bandTop, infoBarPx + fieldTopPx + 2) : infoBarPx + fieldTopPx + 2;
    const base0 = rowUp ? rowTop : heightPx >= 300 ? Math.round(Math.max(infoBarPx + fieldTopPx + 2, Math.min(headTop - 6 - r.height, bandSoon || bandVis ? bandTop - 4 - r.height : Number.POSITIVE_INFINITY))) : Math.round(Math.max(infoBarPx + fieldTopPx + 2, midY - r.height / 2));
    const base = rowUp ? rowTop : Math.max(lo, Math.min(base0, headCap));
    // 높은 패널 · 480 아래 끼어들기 판이 띠 위에 안 들어가면 (위 bigTall) 띠를 숨기고 그 자리에 판 — 이 그림은 그 자리에 두고 다시 그림
    if (heightPx >= 300 && prompt?.kind === 'join' && !prompt.foeJoint && widthPx < 480 && !bigTall.current && bandTop - 4 - r.height < infoBarPx + fieldTopPx + 2) {
      bigTall.current = true;
      bigLow.current = base;
      el.style.left = `${left}px`;
      el.style.top = `${base}px`;
      reBig((n) => n + 1);
      return;
    }
    // 위 줄 (띠 · 쓰러짐 줄) 과 가로로 겹치면 그 아래 + 4 — 판 아래에 오는 줄 (위 끝 ≥ 판 아래 끝) 은 안 봄 (높은 패널 440 × 315 에서 판 바로 아래 띠가 뜨며
    //   판이 126px 아래로 튀어 거북왕을 덮던 것 — UX 리뷰어 #95 13바퀴 큼 2)
    let below = Number.NEGATIVE_INFINITY;
    host.querySelectorAll<HTMLElement>(':scope > .pg-team-band, :scope > .pg-team-faint').forEach((p) => {
      const q = p.getBoundingClientRect();
      if (q.left - o.left >= left + r.width || q.right - o.left <= left) return;
      if (q.top - o.top >= base + r.height) return;
      below = Math.max(below, q.bottom - o.top);
    });
    if (bandSoon && heightPx < 300) below = Math.max(below, bandTop + BAND_PX);
    // 낮은 패널 (띠 자리 판) 도 떠 있는 쓰러짐 줄 아래 + 4 (줄을 판 아래로 밀면 44px 튐 · 바로 지우면 #131) — 줄은 1.2초 뒤 판이 넘겨받고 판은 그 자리 그대로
    let top = Math.max(base, below > Number.NEGATIVE_INFINITY ? Math.ceil(below + 4) : base, bigLow.current ?? Number.NEGATIVE_INFINITY);
    top = Math.max(lo, Math.min(top, Math.floor(heightPx - r.height - 2)));
    bigLow.current = top;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  });
  // 한 줄 판이 지도 줄 자리에 떠 있는 동안 지도 줄을 숨김 (판 양옆에 "새싹" · "0분 남음" 처럼 잘린 글이 남던 것 — UX 리뷰어 #95 14바퀴 7 · 아트 14바퀴 큼 1 "통째로")
  useLayoutEffect(() => {
    root.current?.closest('#pokemon-game')?.querySelector<HTMLElement>('.pg-maprow')?.classList.toggle('pg-maprow-under', !!bigBox.current && bigCover.current);
  });
  useEffect(() => () => document.querySelector<HTMLElement>('#pokemon-game .pg-maprow')?.classList.remove('pg-maprow-under'), []);
  // 저절로 나갈 칸 하나 = 엔진이 기다림을 세는 칸 (teamAutoUltNext — HP 30% 아래 칸 먼저, 아니면 먼저 찬 칸 · 둘째 칸 칩이 1장면만 보이던 것, 개발 4016471)
  const autoNext = teamAutoUltNext(b);
  // "다 참" 칩 = 먼저 찬 한 칸만 (셋 다 뜨면 240 에서 칩이 자기 포켓몬 발을 덮던 것 — UX 리뷰어 #82 · 나머지 찬 칸은 판 금 테두리로 구별)
  const joinKeys0 = prompt?.kind === 'mash' ? [0, 1, 2].filter((i) => b.me[i] && plateState(b, 'me', i) === 'join').map((i) => i + 1) : [];
  //   힘겨루기 끝 1초 안엔 "· [n] 합류" 를 새로 붙이지 않음 (끝나기 0.4 ~ 0.5초 전에 붙었다 결과 띠로 닫혀 못 읽던 것 — UX 리뷰어 #98 마지막 ⑥) · 이미 붙은 건 끝까지
  const joinTail = useRef<string | null>(null);
  const clashKey = b.clash ? `${b.clash.me.join('')}:${b.clash.foe.join('')}` : null;
  const clashLeft = b.clash ? TIMING.team.ultClashLeadMs + TIMING.team.ultClashMs - b.clash.ms : 0;
  if (!clashKey) joinTail.current = null;
  else if (joinKeys0.length > 0 && joinTail.current !== clashKey && clashLeft >= 1000) joinTail.current = clashKey;
  const joinKeys = joinTail.current === clashKey ? joinKeys0 : [];
  const fullFirst = prompt?.kind === 'join' || prompt?.kind === 'gather' ? undefined : [0, 1, 2].find((i) => b.me[i] && plateState(b, 'me', i) === 'ready');
  // 다 찬 상대 중 먼저 찬 칸 (엔진도 이 칸부터 씀 — teamFoeNext) — 그 칸만 "!" 칩
  //   상대 필살기 · 합동 모으기 동안은 "!" 칩 없음 — 모으는 사이 합동에 안 끼는 다음 칸 (소미안) 으로 옮겨 가 2.3초 "곧 쏜다" 로 읽히던 것 (UX 리뷰어 #98 2)
  const foeFirstSlot = b.phase === 'ult' && b.ult?.side === 'foe' ? -1 : (teamFoeNext(b) ?? -1);
  // "곧" 은 0.3초 이어진 뒤에 (곧 → ! 가 67 ~ 214ms 만에 바뀌어 한두 장면짜리 글자이던 것 — UX 리뷰어 #95 6바퀴 작음 7) · "!" 는 바로
  const soonAt = useRef<number[]>([]);
  const chipNow = realNow();
  const warnShow = b.foe.map((_, i) => {
    const w0 = foeWarn(b, i);
    if (!w0 || w0.full) soonAt.current[i] = 0;
    else soonAt.current[i] ||= chipNow;
    //   "곧" 은 0.3초 이어진 뒤 · 다 차기 직전 (92% 넘게) 이면 1초 이어질 때만 — 한 장면 (52 · 155ms) 만 보이고 "!" 로 바뀌던 것 (UX 리뷰어 #98 마지막 ④ — 그런 때는 건너뛰고 바로 "!")
    return !!w0 && (w0.full ? i === foeFirstSlot : chipNow - (soonAt.current[i] ?? 0) >= (w0.pct >= 92 ? 1000 : 300));
  });
  const warnPos = warnPosOf(b, g, warnShow);
  // 모든 칸의 보이는 그림 · 발밑 판 (머리 위 자리가 없는 칩을 옆에 둘 때 피함)
  const blocks: Block[] = SIDES.flatMap((s) => b[s].flatMap((f, i) => (f ? [{ side: s, slot: i, box: visBoxOf(f.form, g, s, i) }, { side: s, slot: i, box: plateBoxOf(g, s, i), plate: true }] : [])));
  const popTop = rowsBottom > 0 ? Math.max(topMin, rowsBottom + 2 + 14) : topMin;
  // 장면 전환 피해 칩 자리 — 맞는 칸 1:1 자리 (vSpots) 머리 위 · 위 끝에 막혀 몸을 덮으면 옆 (바깥쪽 먼저 — 머리 위 숫자 칩과 같은 규칙 · 장면 동안 다른 칸은 숨어 있어 옆이 빔)
  const chipAt = (() => {
    if (!chipOn || !chip || !view || !vSpots || !vGroups) return null;
    const { side, slot } = view.to;
    const f = b[side][slot];
    const spot = vSpots[side][vGroups[side].indexOf(slot)];
    if (!f || !spot) return null;
    const p0 = g.pos(side, slot);
    const v0 = visBoxOf(f.form, g, side, slot);
    const vis = { l: v0.l + spot.x - p0.x, t: v0.t + spot.y - p0.y, r: v0.r + spot.x - p0.x };
    const tagOn = g.scale !== 1;
    const cw = Math.ceil(((chip.joint && tagOn ? 35 : 12) + 10 * chip.text.length) * 1.1);
    // 힘겨루기 장면 (#116) — 1:1 큰 결과 글 ("힘대결에서 이겼다!" · ult/core.js ultTitle — 크기 W ÷ 9 (18 ~ 40) · 가운데 H × 0.36 · 부제 자리만큼 아래) 아래로 (칩이 끝 글자 "다!" 를 덮던 것 — 480 × 150 · 187)
    const tSize = Math.min(40, Math.max(18, widthPx / 9));
    const titleB = view.kind === 'duel' ? Math.max(heightPx * 0.36, infoBarPx + fieldTopPx + tSize * 0.85 + Math.max(10, tSize * 0.4) / 2 + 4) + tSize * 0.6 : 0;
    const top = Math.max(popTop + 6, vis.t - 4, titleB + 2 + 20);
    const head = { left: Math.round(Math.min(g.W - 2 - cw / 2, Math.max(2 + cw / 2, spot.x))), top, cls: '', tagOn };
    // 결과 글 아래로 내려 상대 머리를 덮으면 상대 그림 왼쪽 (오른쪽 끝 = 그림 왼쪽 − 2 · 480 에서 맞는 장면에 이브이 머리 16 ~ 20줄을 덮던 것 — 픽셀 검사원 #116 큼 4)
    if (view.kind === 'duel' && top > vis.t - 2 && vis.l - 2 - cw >= 2) return { left: vis.l - 2, top: titleB + 2, cls: ' pg-pop-side pg-pop-side-l', tagOn };
    if (top <= vis.t - 2 || view.kind === 'duel') return head;
    const ct = Math.max(vis.t + (g.scale === 1 ? -4 : 4), popTop - 14);
    for (const right of side === 'me' ? [false, true] : [true, false]) {
      const l = right ? vis.r + 2 : vis.l - 2 - cw;
      if (l >= 2 && l + cw <= g.W - 2) return { left: right ? l : vis.l - 2, top: ct, cls: right ? ' pg-pop-side' : ' pg-pop-side pg-pop-side-l', tagOn };
    }
    return head;
  })();
  return (
    // 자리는 패널 기준 (시안 geo) — 이 층은 들판 (정보줄 아래) 안이라 정보줄 높이만큼 위로
    // 힘겨루기 VS 컷인 동안은 장면 무리를 연출 층 아래로 — 이름이 그림과 겹치는 좁은 폭 (400 아래) 만 (240 에서 무리 그림이 아래 띠 이름 "나인에볼부스트" 의 첫 · 끝 글자를 덮던 것 — 픽셀 검사원 #116 2바퀴 큼 1 ·
    //   넓은 폭까지 내리면 860 아래 띠가 거북왕 · 이브이 아래 반을 1.4초 덮음, UX 리뷰어 3바퀴 작음 3)
    <div class={`pg-team pg-team-x${g.scale}${g.oneRow ? ' pg-team-row' : ''}${view ? ' pg-team-viewing' : ''}${duelVsLeft > 0 && widthPx < 400 ? ' pg-duel-vs' : ''}`} style={{ top: `${-infoBarPx}px` }} ref={root} onClick={b.phase === 'clash' ? () => onInput({ kind: 'team-battle', input: { kind: 'space' } }) : undefined}>
      {SIDES.map((side) => b[side].map((_, slot) => <Fighter key={`${side}-${slot}`} b={b} g={g} side={side} slot={slot} media={media} topMin={popTop} final={finalKo === `${side}-${slot}`} autoNext={side === 'me' && slot === autoNext} fullChip={side === 'me' && slot === fullFirst} warnChip={side === 'foe' && slot === foeFirstSlot} warnShow={side === 'foe' && (warnShow[slot] ?? false)} warnPos={side === 'foe' ? (warnPos[slot] ?? 'right') : 'right'} blocks={blocks} dim={lit !== null && !lit[side].includes(slot)} big={bigHit === side && (lit?.[side].includes(slot) ?? false)} {...vOf(side, slot)} skip={skip} head={side === 'me' && denyHeld && !denyAtFixed && denyHeld.value.slot === slot ? denyHeld : null} lineBand={lineBand} onUlt={ult} />))}
      {/* 장면 전환 피해 칩 (ideas 717) — 합동 "합동! −N" · 혼자 큰 숫자 판 · 숫자 칩 층 (연출 층 위) · 돌아갈 때 (out) 바둑판으로 사라짐 */}
      {chipAt && chip && (
        <span class={`pg-team-pop pg-pop-${chip.kind}${chip.joint ? ' pg-team-joint' : ' pg-pop-big'}${chipAt.cls}${view?.phase === 'out' ? ' pg-view-hide-in' : ''}`} style={{ left: `${chipAt.left}px`, top: `${chipAt.top}px` }}>
          {chip.joint ? (
            <>
              {chipAt.tagOn && <b class="pg-team-joint-tag">합동!</b>} {chip.text}
            </>
          ) : (
            chip.text
          )}
        </span>
      )}
      {/* 띠 · 쓰러짐 줄이 떠 있는 동안 머리 위 숫자 · 칩은 그 줄 아래까지만 (240 에서 쓰러짐 줄이 "합동!" 칩을 덮던 것 — 픽셀 검사원 #95) */}
      {/* 장면 전환 동안은 3:3 띠를 안 띄움 — 혼자 = 1:1 캔버스 이름 띠 · 합동 = 큰 컷인이 이름을 말함 (이름 두 번 안 나오게) */}
      {bandShown && <TeamBand view={bandShown} media={media} top={bandTop} faint={inBand?.text ?? null} faintShort={inBand?.short ?? null} wide={widthPx < 400} tight={widthPx < 300} />}
      {/* 고정 자리 = 위 왼쪽 · 좁은 패널 (400 아래) 은 무대 왼쪽 아래 (위 왼쪽이 컷인 부제 "리자몽의 필살기!" · 합동 이름 판에 붙거나 겹치던 것 — UX 리뷰어 #97 2바퀴 큼 · 장면 전환 동안 발밑 판 · 숫자는 숨어 있음) */}
      {/* 고정 자리 글엔 누른 포켓몬 얼굴 (무대에 없어 누구 말인지 모르던 것 — 아트 디렉터 #98 2바퀴 7) */}
      {denyHeld && denyAtFixed && <HeadNote text={denyHeld.value.text} go={denyHeld.value.go} keyCap={denyHeld.value.key !== null ? String(denyHeld.value.key) : null} at={widthPx < 400 ? { l: 4, t: heightPx - 20 - 4 } : { l: 8, t: topMin - 14 }} step={denyHeld.step} fixed face={b.me[denyHeld.value.slot] ? { media, form: b.me[denyHeld.value.slot]!.form } : undefined} />}
      {/* 쓰러짐 말 한 줄 (기획 #95 — 머리 위에 따로 뜨던 "쓰러졌다!" 둘이 15px 차이로 붙고 숫자에 묻히던 것) · 띠가 있으면 그 아래 · 엔진 결과 한 줄이 있으면 그 아래 */}
      {apart && (
        // 띠 아래 자리 = 보이는 띠가 있거나, 큰 연출 중 (띠가 곧 뜸) — 숨긴 띠까지 세어 낮은 패널에서 28px 빈 줄이 남고 · 0.6초 뒤 띠가 뜨며 28px 내려가던 것 (UX 리뷰어 #95 7바퀴 3 · 8)
        <div class="pg-team-msg pg-team-faint" style={{ top: `${bandTop + (bandShown ? BAND_PX + 4 : 0)}px` }}>
          {apart}
        </div>
      )}
      {/* 연출 층 — 비어 있는 상자 (Preact 는 안을 안 건드림), 연출 다리가 캔버스를 넣음 */}
      <div class="pg-fxlayer pg-team-fx" ref={layer} />
      {/* 안내 — 무대 가운데 위 */}
      {/* 끼어들기 · 합동 = 무대 한가운데 큰 판 (태현 님 #81 "화면 가운데에 크게 띄우고 2초 넘게 확실히" — 아래 · 위 가운데 작은 한 줄이 빨리 지나가 몰랐던 것) ·
          금 제목 · 큰 키 칸 · 아래 4px 남은 막대 · 누를 틈은 엔진 (합동 약 2.5초 · 끼어들기 약 2.2초) · 자리는 재서 정수 px (반 픽셀이면 2px 금 테두리가 흐림) */}
      {prompt?.kind === 'join' && (
        <div class={`pg-team-prompt pg-team-prompt-join pg-team-prompt-big${bigRow ? ' pg-team-big-row' : ''}`} ref={bigBox}>
          {panelFaint.current && <span class="pg-team-big-faint" data-full={panelFaint.current.text} data-short={panelFaint.current.short ?? undefined}>{panelFaint.current.text}</span>}
          <b class="pg-team-big-title">
            {/* 상대가 합동으로 모이는 중 = 빨강 "상대 합동!" (내 편 멘트와 같은 말이던 것 — 기획 #24-4) */}
            {prompt.foeJoint ? (
              <>
                <span class="pg-team-foe-joint">
                  <span class="pg-fj-pre">상대 </span>
                  {widthPx < 400 ? '합동' : '합동!'}
                </span>
                <span class="pg-fj-sep">{' · '}</span>
              </>
            ) : (widthPx >= 480 || bigHide) && prompt.user ? (
              <>
                {/* 넓으면 필살기 이름까지 ("레디바 은빛바람 · 끼어들기") — 판이 떠 있는 2.2초 동안 띠를 숨겨 이름이 연출 끝에야 뜨던 것 (UX 리뷰어 #97 작음 5) */}
                <span class="pg-team-big-who">{`${prompt.user} ${b.ult?.name ?? '필살기'} · `}</span>
                <span class="pg-big-lead-s">{`${prompt.user}에 `}</span>
                {/* 한 줄 판에서 이름까지 빠지면 (f4) 상대 얼굴 — 띠를 숨긴 동안 누구 필살기인지 글이 없던 것 (UX 리뷰어 #95 14 · 15바퀴, ideas 1601) · 띠 얼굴과 같은 24 × 20 창 */}
                {b.ult && b[b.ult.side][b.ult.from] && (
                  <span class="pg-band-face pg-big-face">
                    <Sprite media={media} form={b[b.ult.side][b.ult.from]!.form} scale={1} px={32} crop={20} cropWidth={24} center action="walk" faceLeft={b.ult.side === 'foe'} />
                  </span>
                )}
              </>
            ) : null}
            끼어들기
          </b>
          <span class="pg-team-big-keys">
            {prompt.keys.map((k) => (
              <span key={k} class="pg-team-who" onClick={() => ult(k - 1)}>
                <span class="pg-team-key pg-team-key-on">{k}</span>
              </span>
            ))}
            {/* 머릿수 (기획 #24-3) — 받아치면 나 1 대 상대 쓴 포켓몬 + 모인 동료 · 1 대 3 이면 빨강 "받아치면 짐" (확정 패배) · "1:1" 은 만남의 "1:1 승부" 와 같은 글이라 "대" (개발 UX #59) */}
            <span class={`pg-team-odds${prompt.sure === 'foe' ? ' pg-team-sure-foe' : ''}`}>
              {widthPx >= 480 && prompt.sure !== 'foe' && <span class="pg-odds-pre">받아치면 </span>}
              {`${prompt.me} 대 ${prompt.foe}${prompt.sure === 'foe' ? (widthPx < 400 ? ' 짐' : ' 받아치면 짐') : ''}`}
            </span>
          </span>
          <span class="pg-team-left" style={{ width: `${Math.round(prompt.left * 100)}%` }} />
        </div>
      )}
      {prompt?.kind === 'gather' && (
        <div class={`pg-team-prompt pg-team-prompt-gather pg-team-prompt-big${bigRow ? ' pg-team-big-row' : ''}`} ref={bigBox}>
          {panelFaint.current && <span class="pg-team-big-faint" data-full={panelFaint.current.text} data-short={panelFaint.current.short ?? undefined}>{panelFaint.current.text}</span>}
          {/* 앞장 이름 먼저 ("이 둘이 합동한다" 로 읽히던 것 — UX 3:3 점검 3) · 좁으면 "합동!" */}
          <b class="pg-team-big-title">
            {widthPx < 400 ? (
              '합동!'
            ) : (
              <>
                <span class="pg-big-lead">{`${prompt.lead} 필살기 · `}</span>
                <span class="pg-big-lead-s">{`${withJosa(prompt.lead, '과/와')} `}</span>
                같이 쓰기!
              </>
            )}
          </b>
          <span class="pg-team-big-keys">
            {[...prompt.joined.map((w) => ({ ...w, done: true })), ...prompt.who.map((w) => ({ ...w, done: false }))].sort((a, c) => a.key - c.key).filter((w) => w.done).map((w) => (
              <span key={w.key} class="pg-team-who pg-team-joined" title={`${w.name} 합류함`} style={{ order: w.key }}>
                <span class="pg-team-key pg-team-key-on">✓</span>
                <span class="pg-team-big-name">{w.name}</span>
              </span>
            ))}
            {prompt.who.map((w) => (
              <span key={w.key} class="pg-team-who" onClick={() => ult(w.key - 1)} style={{ order: w.key }}>
                <span class="pg-team-key pg-team-key-on">{w.key}</span>
                <span class="pg-team-big-name">{w.name}</span>
              </span>
            ))}
          </span>
          <span class="pg-team-left" style={{ width: `${Math.round(prompt.left * 100)}%` }} />
        </div>
      )}
      {/* 연타 — VS · 맞닿기 (ultClashLeadMs) 뒤부터 (엔진도 그때부터 셈) */}
      {prompt?.kind === 'mash' && mashShow && (
        // 힘겨루기 장면은 판 폭을 처음 폭 아래로 안 줄임 · 글은 가운데 (합류로 "· [2][3] 합류" 가 빠질 때 480 판이 가운데에서 34px 벗어나고 860 왼쪽 끝이 26px 튀던 것 — 픽셀 검사원 #116 큼 3)
        <div ref={mashEl} class="pg-team-prompt pg-team-prompt-mash" style={duelView && mashW.current?.at === duelView.at ? { ...promptStyle, minWidth: `${mashW.current.w}px`, ...(widthPx >= 400 ? { justifyContent: 'center' } : {}) } : promptStyle}>
          {/* 정해진 힘겨루기 (3:1 · 1:3) 는 연타가 소용없어 결과만 (디자인팀 UX R9 ⑥ U5) */}
          {prompt.sure === 'me' ? <b class="pg-team-sure">3 대 1 — 이길 거예요</b> : prompt.sure === 'foe' ? <b class="pg-team-sure pg-team-sure-foe">1 대 3 — 질 거예요</b> : <b class={countNew ? 'pg-team-count-new' : undefined}>{`${prompt.me} 대 ${prompt.foe}`}</b>}
          {!prompt.sure && (
            <>
              <span class="pg-team-key">Space</span> 연타
            </>
          )}
          {/* 아직 낄 수 있는 내 칸 = "· [3] 합류" (첫 키로 끼어들기 판이 닫히면 남은 합류가 금테 판으로만 보여 몰랐던 것 — UX 리뷰어 #95 4바퀴 5) */}
          {!prompt.sure && joinKeys.length > 0 && (
            <>
              {' · '}
              {joinKeys.map((k) => (
                <span key={k} class="pg-team-key">
                  {k}
                </span>
              ))}{' '}
              합류
            </>
          )}
        </div>
      )}
      {/* 칸 없이 누른 Z 를 버림 (#88 — 다 찬 포켓몬이 없음 · 다른 연출 중) = 무대 위 가운데 한 줄 1초 (엔진 한 줄이 있으면 그 아래) */}
      {/* 결과 · 엔진 한 줄 (합류 · 힘겨루기 결과 · 이김 · 짐) — 안내가 없을 때 */}
      {msgOn && (
        // 띠 줄과 같은 자리에서 시작 (띠 자리 + 정보줄 아래 띄움이던 것 — 쓰러짐 줄과 어긋나 겹치던 것) · 떠 있는 쓰러짐 줄이 있으면 그 아래 (위 쌓기)
        <div class="pg-team-msg pg-team-msg-over" style={{ top: `${bandTop}px` }}>
          {b.msg}
        </div>
      )}
      {/* 합동 큰 컷인 (#99 시안) — cut 단계 동안 · 무대 가운데 패널 폭 띠 · 그림 배율 = ×1 무대면 1 · 높은 패널 3 · 그 밖 2 */}
      {/* 합동 이름 판 (#100 시안) — show 동안 위쪽 1.5초 (합동은 1:1 캔버스 이름 띠가 없어서) */}
      {view?.kind === 'joint' && view.phase === 'show' && (() => {
        const mons = view.from.flatMap((i) => (b[view.side][i] ? [b[view.side][i]!] : []));
        const types = mons.map((f) => speciesOf(f.species)?.types[0] ?? 'normal');
        return <JointNamePlate key={view.at} who={mons} side={view.side} name={jointName(types)} media={media} top={bandTop} colors={types.map((t) => TYPE_COLOR[t])} quick={!!view.quick} />;
      })()}
      {view?.kind === 'joint' && view.phase === 'cut' && <JointCutin b={b} view={view} media={media} widthPx={widthPx} heightPx={heightPx} infoBarPx={infoBarPx} fieldTopPx={fieldTopPx} scale={g.scale} feetPx={g.pos('me', 2).y} minTop={apart ? bandTop + (bandShown ? BAND_PX + 4 : 0) + 24 + 4 : 0} />}
    </div>
  );
}
