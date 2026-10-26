/**
 * 3:3 화면 모델 (orders #17 3단계 — 디자인팀 4안 시안 그대로의 자리 · 판 상태). 화면 (TeamLayer) 과 떼어 둔 계산 — 자동 테스트.
 * 자리 (geo) = 시안 geo(): 폭 400 아래 ×1 · 그 밖은 ×2 (높아도 ×3 없음 — 태현 님 #92) · 가장 낮은 패널 (높이 170 아래 · 폭 400 부터) 은 ×2 한 줄 (#85 A).
 * 비스듬한 세 줄은 바닥 띠에 모음 — 줄 사이 세로는 패널 높이와 상관없이 고정 (TEAM_ROW_GAP — 태현 님 #93 "대각선으로 너무 각지게 서있는데 각을 줄여서").
 * 칸 0 · 1 · 2 = 위 (뒷줄 · 바깥) → 아래 (앞줄 · 가운데) = 발밑 판 키 1 · 2 · 3.
 */
import { BALANCE, TIMING } from '../../../core/balance';
import { teamClashSure, teamFoeNext, teamGather, teamLayout, teamUltLevel, teamUltOpen, teamZSlot, type Side, type TeamBattle, type TeamPopup } from '../../../core/engine';
import { speciesOf } from '../../../data';

export interface TeamGeo {
  W: number;
  H: number;
  /** 정보줄 아래 무대가 시작하는 높이 */
  IB: number;
  scale: 1 | 2;
  /** 포켓몬 칸 (32 × 배율) */
  sp: number;
  oneRow: boolean;
  cx: number;
  /** 내 발밑 판 폭 (상대는 − 16) */
  pw: number;
  /** 발 가운데 (x) · 발 높이 (y) */
  pos(side: Side, slot: number): { x: number; y: number };
}

/**
 * 비스듬한 세 줄 사이 세로 (px) — ×2 = 16 (가로 칸 60 에 약 15° · 판 높이 14 + 2 — 아트 디렉터가 13 · 16 · 20 중 고름, 2026-10-22 #93). 예전엔 무대 높이에 비례 (187 약 23° · 443 약 51 ~ 57°).
 * ×1 (폭 400 아래) = 24 — 판 (40px) 이 가로 칸 (24) 보다 넓어 16 이면 판이 다음 칸 포켓몬을 23 ~ 34% 덮고 머리 위 말이 겹치던 것 (픽셀 검사원 · UX 리뷰어 #92) · 예전 낮은 패널과 같은 값 (높은 ×1 패널은 더 완만해짐)
 */
export const TEAM_ROW_GAP = { x1: 24, x2: 16 } as const;

/** 시합장 그림 높이 (무대 위 끝부터 — ×1 x1 그림 250 · ×2 500) — 앞줄이 그림 아래 남색 띠에 서지 않게 (240 × 315 에서 셋이 그림 밖에 서던 것) */
const ARENA_ART_PX = { 1: 250, 2: 500 } as const;

export function teamGeometry(W: number, H: number, IB: number): TeamGeo {
  const oneRow = teamLayout({ w: W, h: H }) === 'row';
  const scale: 1 | 2 = W < 400 ? 1 : 2;
  const sp = 32 * scale;
  const stageH = H - IB;
  // 앞줄 = 바닥 − 23 (판 · 그림자 자리) · 가운데 · 뒷줄은 고정 간격으로 위 (세 줄을 바닥 띠에 모음 — 높은 패널에서 뒷줄이 하늘로 올라가 가팔라지던 것)
  const gap = scale === 1 ? TEAM_ROW_GAP.x1 : TEAM_ROW_GAP.x2;
  const r3 = Math.min(stageH - 23, ARENA_ART_PX[scale] - 23);
  const r2 = r3 - gap;
  const r1 = r3 - 2 * gap;
  const cx = Math.round(W / 2);
  const pw = oneRow ? 46 : scale === 1 ? 40 : 52;
  const s = scale === 1 ? 24 : 60;
  const Wb = Math.min(W, 860);
  const pwE = scale === 1 ? 40 : 52;
  // 가운데에서 앞줄까지 = 무대 폭 × 0.18 (넓은 패널은 860 무대 안) · 좁으면 판이 패널 안에 들어가는 만큼 (짝수)
  const d = 2 * Math.round(Math.max(scale === 1 ? 30 : 40, Math.min(Math.round(Wb * 0.18), Math.round(W / 2 - 2 * s - pwE / 2 - 12))) / 2);
  const dA = 2 * Math.round(Math.max(35, Math.min(Math.round(Wb * 0.18), Math.round(W / 2 - 120 - 23 - 8))) / 2);
  const rows = oneRow ? [r3, r3, r3] : [r1, r2, r3];
  const pos = (side: Side, slot: number) => {
    const dir = side === 'me' ? -1 : 1;
    const x = oneRow ? cx + dir * (dA + (2 - slot) * 60) : cx + dir * (d + (2 - slot) * s);
    const y = IB + rows[Math.max(0, Math.min(2, slot))]!;
    return { x: Math.round(x / scale) * scale, y: Math.round(y / scale) * scale };
  };
  return { W, H, IB, scale, sp, oneRow, cx, pw, pos };
}

/**
 * 3:3 필살기 · 합동 "장면 전환" 자리 (orders #99 시안) — 무대가 잠깐 1:1 처럼: 내 편 무리는 왼쪽 · 상대 무리는 오른쪽 (1:1 전투와 같은 쪽 — 그림을 안 뒤집음) ·
 * 무리 첫째 (쏘는 포켓몬 · 맞는 포켓몬) 가 앞줄 · 나머지 (합동 동료) 는 바깥으로 지그재그 (둘째 = 바깥 · 위 · 셋째 = 더 바깥 · 앞줄 높이).
 * 발 가운데 (x, y) · 배율 칸에 맞춤 · 패널 안 (그림 반 + 2).
 */
// leadSolo = 앞장은 동료 수와 상관없이 혼자일 때 자리 (#116 힘겨루기 장면 — 1:1 힘겨루기 연출이 시작 때 앞장 자리를 잡아, 도중에 합류해도 앞장이 옮겨 가면 줄기가 어긋남)
export function duelSpots(g: TeamGeo, nMe: number, nFoe: number, leadSolo = false): { me: { x: number; y: number }[]; foe: { x: number; y: number }[] } {
  const k = g.scale;
  const front = g.pos('me', 2).y;
  const Wb = Math.min(g.W, 860);
  //   동료는 지그재그 — 둘째 = 위 12 · 셋째 = 앞줄 높이 (위 24 면 187 에서 동료 기 모으기 빛 · 물 공이 무대 위 끝에서 잘리던 것, 아트 디렉터 #100)
  const stepY = k === 1 ? 8 : 12;
  const D = Math.max(k === 1 ? 40 : 90, Math.min(Math.round(Wb * 0.26), Math.round(g.W / 2 - g.sp)));
  const lo = Math.round(g.sp / 2) + 2;
  const snap = (v: number) => Math.round(v / k) * k;
  //   혼자 = 가운데에서 D · 합동 (둘 넘게) = 앞장을 대상 쪽으로 당기고 (D × 0.5) 동료는 바깥으로 넉넉히 (×2 = 칸 사이 112 까지 · ×1 = 56 까지 · 자리가 모자라면 고르게) —
  //   동료 기운이 앞장 구 · 대포 끝으로 흘러드는 길이 보이게 (44 면 빔 짝은 동료가 앞장 위에 겹치고, 구 짝은 동료가 불꽃 구 안에 들어가 길이 20 ~ 40px 뿐이던 것 — 개발 #101)
  const group = (dir: -1 | 1, n: number) => {
    const lead = n > 1 && !leadSolo ? Math.round(D * 0.5) : D;
    const room = g.cx - lead - lo;
    //   힘겨루기 장면 (leadSolo) = 동료 간격은 머릿수와 상관없이 셋 기준 고정 (합류할 때마다 간격이 줄어 이미 선 동료가 한 장면에 15 ~ 20px 옆걸음하던 것 — #116 UX) ·
    //   그림 폭 × 0.7 넘게 (240 · 480 × 150 에서 30 ~ 50% 겹치던 것 — #116 아트 ⑧) · 자리가 모자라면 뒷줄을 4px 더 위로
    const need = Math.round(g.sp * 0.7);
    const step = n > 1 ? (leadSolo ? Math.max(need, Math.min(k === 1 ? 56 : 112, Math.floor(room / 2))) : Math.max(k === 1 ? 24 : 44, Math.min(k === 1 ? 56 : 112, Math.floor(room / (n - 1))))) : 0;
    const tight = leadSolo && Math.floor(room / 2) < need;
    return Array.from({ length: n }, (_, i) => {
      const x = g.cx + dir * (lead + i * step);
      return { x: snap(Math.max(lo, Math.min(g.W - lo, x))), y: snap(front - (i % 2) * stepY - (tight && i > 0 ? 4 : 0)) };
    });
  };
  return { me: group(-1, nMe), foe: group(1, nFoe) };
}

/**
 * 장면 전환 동안 포켓몬 칸 클래스 (TeamLayer — 단계 in · cut · show · out)
 * - 무리 밖 (inGroup 아님) = 나머지 — rest (in 바둑판으로 사라짐 · 숨김 · out 바둑판으로 나타남)
 * - 숨긴 쓰러진 칸 (hideDown) = 숨김 · 돌아갈 때 제자리로 튀어나오는 칸 (popsBack — 합동 쏜 무리 · 맞은 칸) = out 에 rest 와 같이 바둑판
 * - 앞뒤가 바뀌는 동료 (cross — viewCrossers) = in 에 제자리 바둑판으로 빨리 사라짐 (pg-view-pop-hide) → cut · show 에 새 자리에서 바둑판으로 나타남 (pg-view-pop —
 *   out 의 pg-view-hide-out 과 키프레임 이름이 달라야 돌아갈 때 다시 돎, 코드 리뷰어 #98)
 * - 나머지 무리 = 걸어서 자리 옮김 (pg-view-move) · 쏘는 무리는 연출 층 위 (pg-view-partner)
 */
export function viewMonClass(phase: 'in' | 'cut' | 'show' | 'out', o: { inGroup: boolean; hideDown: boolean; popsBack: boolean; cross: boolean; shooter: boolean; cont?: boolean }): string {
  //   cont = 다른 장면이 열린 채 이어받음 (#116 힘겨루기) — 나머지는 이미 숨어 있어 바로 숨김 (바둑판 사라지기를 다시 돌리면 숨은 칸이 0.1초 보임)
  const rest = phase === 'in' ? (o.cont ? ' pg-view-hidden' : ' pg-view-hide-in') : phase === 'out' ? ' pg-view-hide-out' : ' pg-view-hidden';
  const top = o.shooter ? ' pg-view-partner' : '';
  if (!o.inGroup) return rest;
  //   쓰러진 칸 (hideDown — 돌아갈 때만) 은 걷지 않고 제자리에서 다른 칸과 같이 바둑판으로 나타남 (회색 그림만 0.2 ~ 0.3초 늦게 툭 나타나던 것, UX 리뷰어 #98 5 — team.css 가 쓰러짐 사라지기보다 앞에 둠)
  //   pg-view-down-back = 무리 안에서 쓰러진 칸만 (무리 밖 · 오래전에 쓰러져 사라진 칸에까지 걸리면 장면마다 회색이 2초씩 되살아남 — 코드 리뷰어 #98 높음)
  if (o.hideDown) return phase === 'out' ? `${rest} pg-view-down-back` : ' pg-view-hidden';
  if (phase === 'out') return o.popsBack ? rest : ` pg-view-move${top}`;
  if (o.cross) return phase === 'in' ? ' pg-view-pop-hide' : ` pg-view-pop${top}`;
  return ` pg-view-move${top}`;
}

/**
 * 장면 전환 들어갈 때 앞뒤가 바뀌는 칸 ("side-slot") — 같은 무리에서 3:3 자리 순서와 1:1 자리 (duelSpots) 순서가 다른 짝의 동료 (앞장은 그대로 걸어감).
 * 이 칸은 걷지 않고 바둑판으로 사라졌다 새 자리에서 나타남 (상대 합동에 들어갈 때 가운데 쪽 소미안이 앞장 통통코를 지나쳐 뒤로 가던 것 — UX 6바퀴 작음 3 · bugs 1794 ③ · 돌아갈 때는 이미 바둑판, #101)
 */
export function viewCrossers(g: TeamGeo, groups: Record<Side, number[]>, spots: Record<Side, { x: number; y: number }[]>): Set<string> {
  const out = new Set<string>();
  for (const s of ['me', 'foe'] as const) {
    const grp = groups[s];
    for (let a = 0; a < grp.length; a++) {
      for (let c = a + 1; c < grp.length; c++) {
        const o = g.pos(s, grp[a]!).x - g.pos(s, grp[c]!).x;
        const t = (spots[s][a]?.x ?? 0) - (spots[s][c]?.x ?? 0);
        if (o * t >= 0) continue;
        if (a > 0) out.add(`${s}-${grp[a]}`);
        out.add(`${s}-${grp[c]}`);
      }
    }
  }
  return out;
}

/** 발밑 판 모양 — charge (차는 중 · 판 없음) · ready (쓸 수 있음) · join (끼어들기 · 합류) · down (쓰러짐). 예약 판은 없앰 (태현 님 #88) */
export type PlateState = 'charge' | 'ready' | 'join' | 'down';

export function plateState(b: TeamBattle, side: Side, slot: number): PlateState {
  const f = b[side][slot];
  if (!f || f.hp <= 0) return 'down';
  if (side === 'foe') return 'charge';
  if (teamUltOpen(b, slot)) return b.phase === 'run' ? 'ready' : 'join';
  return 'charge';
}

/**
 * 버린 필살기 누름 한 줄 (#88 — 예약 없앰, 엔진 b.deny 1.2초) — 정보줄 위 가운데 (연출 · 큰 판 · 머리 위 말이 오지 않는 고정 자리 — 무대 가운데에 두면 합동 이름 · 끼어들기 판 · 쓰러짐 말을 덮던 것, UX 리뷰어 2차).
 * key = 누른 키 (칸 없는 Z 면 없음 · 그 1초 안에 누가 쓸 수 있게 되면 그 키) · go = 그 1초 안에 쓸 수 있게 됨 (금색 "지금!")
 */
export function teamDenyNote(b: TeamBattle): { key: number | null; text: string; go: boolean } | null {
  const d = b.deny;
  if (!d) return null;
  //   "지금!" 이었다가 같은 걸음 뒤쪽에서 그 칸이 쓰러지거나 판이 끝나면 글 없음 — 엔진은 다음 걸음 맨 앞에서야 도장을 지워
  //   그 사이 "아직 안 찼어요" 로 되돌아가 1.1초 붙잡히던 것 (테스터 #98 · bugs 1824 고침의 빈틈)
  if (d.slot >= 0) {
    const go = teamUltOpen(b, d.slot);
    if (d.go && !go) return null;
    return { key: d.slot + 1, go, text: go ? '지금!' : d.why === 'charge' ? '아직 안 찼어요' : '지금은 못 써요' };
  }
  // Z 가 실제로 쏠 칸 (teamZSlot — 먼저 찬 칸) 에 "지금!" (번호 작은 칸에 뜨는데 Z 는 먼저 찬 다른 칸이 나가던 것, 코드 리뷰어 #98)
  const z = teamZSlot(b);
  if (z !== null && teamUltOpen(b, z)) return { key: z + 1, go: true, text: '지금!' };
  if (d.go) return null;
  const full = b.me.some((f) => f.hp > 0 && f.ult >= 1);
  return { key: null, go: false, text: d.why === 'charge' && !full ? '아직 다 찬 포켓몬이 없어요' : '지금은 못 써요' };
}

/** 상대 필살기가 곧 나감 — 다음에 나갈 한 칸 (teamFoeNext — 나머지 찬 칸은 기다림 null) 의 남은 기다림 (게임 ms · run 에서만 줆) 이 진짜 시계 realMs 안.
 *  기다림을 아직 안 정했으면 가장 짧은 값 (foeUltWaitMs 아래 끝) 으로 셈 · tempo = 게임 배 (gameTempo — ▶▶ 면 더 빨리 줆)
 *  ("필살기 다 참" 처음 안내가 뜨자마자 0.64초 만에 상대 컷인 · 장면 전환에 가려졌다 끝난 뒤 다시 뜨던 것 — 개발 #98 판 자동 검사 7판) */
export function foeUltSoon(b: TeamBattle, tempo: number, realMs = 1100): boolean {
  if (b.phase !== 'run') return false;
  const i = teamFoeNext(b);
  return i !== null && (b.foeUltWait[i] ?? BALANCE.team.foeUltWaitMs[0]) < realMs * tempo;
}

/** 합동 칩 ("합동! −N") 붙잡기 — 진짜 시계 1.2초 (숫자 0.7초 규칙에 같이 걸려 "합동!" 글이 0.65 ~ 0.7초만 보이던 것 — 개발 #98 판 자동 검사 6 · 7판 · ux-rules U1 화면 붙잡기) */
export const JOINT_CHIP_MS = 1200;
/** 처음 본 때 (진짜 시계) 를 kept 에 적어 1.2초 동안 남김 — 엔진이 팝업을 먼저 지워도 (게임 시계 1.2초 · ▶▶ 에서 더 빨리) 마지막 모양 그대로 (gone) ·
 *  끝났거나 장면 전환 칩이 가져간 것 (skip) 은 지움 · end = 가장 먼저 끝나는 때 (다시 그리기 타이머) */
export function keepJointChips<P extends { id: number; joint?: boolean }>(kept: Map<number, { p: P; at: number }>, live: readonly P[], now: number, skip: ReadonlySet<number>): { gone: P[]; end: number } {
  for (const p of live) if (p.joint) kept.set(p.id, { p, at: kept.get(p.id)?.at ?? now });
  for (const [id, k] of kept) if (now - k.at >= JOINT_CHIP_MS || skip.has(id)) kept.delete(id);
  return { gone: [...kept.values()].map((k) => k.p).filter((p) => !live.some((q) => q.id === p.id)), end: Math.min(...[...kept.values()].map((k) => k.at + JOINT_CHIP_MS)) };
}

/** 상대 필살기 예고 — 80% 부터 % · 다 차면 "곧!" */
export function foeWarn(b: TeamBattle, slot: number): { full: boolean; pct: number } | null {
  const f = b.foe[slot];
  if (!f) return null;
  const lv = teamUltLevel(f);
  return lv === 'none' ? null : { full: lv === 'full', pct: Math.min(99, Math.floor(f.ult * 100)) };
}

/** 무대 가운데 위 안내 — 끼어들기 (상대 필살기 창) · 합동 멘트 (내 필살기에 같은 편 모임) · 연타 (필살기 힘겨루기) · 3:1 / 1:3 */
export type TeamPrompt =
  /** 끼어들기 — me : foe = 머릿수 (받아치면 힘겨루기) · sure = 1:3 이면 'foe' (받아치면 짐) · foeJoint = 상대가 합동으로 모이는 중 ("상대 합동!") */
  /** user = 상대 필살기를 쓴 포켓몬 이름 (판 제목 "소미안 필살기" — 누구 필살기에 끼어드는지, UX 3:3 점검 8) */
  | { kind: 'join'; keys: number[]; left: number; me: number; foe: number; sure: Side | null; foeJoint: boolean; user: string }
  /** lead = 앞장 (처음 누른 포켓몬) 이름 · who = 낄 수 있는 칸 · joined = 이미 낀 칸 (✓ 로 남김 — 합류하면 목록에서 사라져 취소된 것처럼 보이던 것, UX 3:3 점검 3) */
  | { kind: 'gather'; who: { key: number; name: string }[]; joined: { key: number; name: string }[]; lead: string; left: number }
  | { kind: 'mash'; sure: Side | null; me: number; foe: number }
  | null;

export function teamPrompt(b: TeamBattle): TeamPrompt {
  const keys = b.me.map((_, i) => i).filter((i) => teamUltOpen(b, i));
  if (b.phase === 'ult' && b.ult) {
    const g = teamGather(b);
    if (g && g.side === 'me') {
      const nm = (i: number) => speciesOf(b.me[i]!.species)?.name.ko ?? '';
      return { kind: 'gather', who: g.can.map((i) => ({ key: i + 1, name: nm(i) })), joined: g.team.map((i) => ({ key: i + 1, name: nm(i) })), lead: nm(g.from), left: Math.max(0, g.leftMs / g.totalMs) };
    }
    if (b.ult.side === 'foe' && b.ult.window > 0 && !b.ult.hit && keys.length > 0) {
      // 막대 = 실제 창 (상대 합동 멘트면 1.5초) 대로 (U2 — 1.2초로 셈하던 것, 기획 #24) · 머릿수 = 나 1 : 상대 (쓴 포켓몬 + 모인 동료)
      // 상대 합동이면 모일 동료 (allyAt) 까지 세어 처음부터 맞는 머릿수 ("받아치면 1 대 1" 이 0.4초 뒤 "1 대 2" 로 바뀌던 것 — UX 리뷰어 #95 3바퀴)
      const team = b.ult.team ?? [];
      const foe = 1 + team.length + (b.ult.allyAt ?? []).filter((a) => !team.includes(a.slot)).length;
      const total = b.ult.windowMs ?? TIMING.team.interruptMs;
      // 받아치면 짐 = 끼어들 수 있는 게 하나뿐일 때만 (둘 넘게 찼으면 힘겨루기 중에 더 끼어들어 2:3 · 3:3 이 될 수 있음 — 코드 리뷰어)
      const sure = keys.length === 1 ? teamClashSure({ me: [0], foe: Array.from({ length: foe }, (_, i) => i) }) : null;
      return { kind: 'join', keys: keys.map((i) => i + 1), left: Math.max(0, Math.min(1, b.ult.window / total)), me: 1, foe, sure, foeJoint: (b.ult.gather ?? 0) > 0 && ((b.ult.team?.length ?? 0) > 0 || (b.ult.allyAt?.length ?? 0) > 0), user: speciesOf(b.foe[b.ult.from]?.species ?? 0)?.name.ko ?? '' };
    }
  }
  // "3 대 1 — 이길 거예요" 는 상대가 더 낄 수 없을 때만 (약속 1.1초 뒤 상대가 끼어 "3 대 2" 가 되던 것 — UX 리뷰어 #95 2바퀴)
  if (b.phase === 'clash' && b.clash?.kind === 'ult') {
    const c = b.clash;
    const more = (c.foeJoin ?? []).some((j) => !c.foe.includes(j.slot));
    return { kind: 'mash', sure: more ? null : teamClashSure(c), me: c.me.length, foe: c.foe.length };
  }
  return null;
}

/** 쓰러짐이 큰 연출 (필살기 · 합동 · 힘겨루기) 것인지 — 생긴 때 (createdMs) 큰 연출이 0.2초 넘게 이어지던 중이거나, 큰 연출이 막 끝난 0.4초 안이면 큰 것.
 *  보통 공격 쓰러짐 뒤에 상대 필살기가 시작돼도 큰 것이 되지 않음 ("힘겨루기! | 레디바 쓰러졌다!" — 픽셀 검사원 · UX 리뷰어 #95 4바퀴) ·
 *  같은 때 (0.2초 안) 시작한 큰 연출도 아님 (보통 공격 쓰러짐과 상대 필살기 시작이 겹쳐 VS 띠로 옮겨 가던 것 — 픽셀 검사원 #95 6바퀴 8)
 *  litStartMs = 지금 이어지는 큰 연출이 시작된 때 (없으면 null) · lastLitMs = 큰 연출이 마지막으로 보인 때 */
export const FAINT_BIG_MS = 400;
export const FAINT_LIT_LEAD_MS = 200;
export function faintIsBig(createdMs: number, litStartMs: number | null, lastLitMs: number, viewing = false): boolean {
  // 장면 전환 (필살기 · 합동이 1:1 처럼) 중에는 띠가 안 보여 — 큰 것으로 세면 안 보이는 띠에 붙어 쓰러짐 말이 사라짐 (#96 UX 큼 1 · #131) · 따로 줄로
  if (viewing) return false;
  if (litStartMs !== null) return createdMs - litStartMs >= FAINT_LIT_LEAD_MS;
  return createdMs - lastLitMs < FAINT_BIG_MS;
}

/** 장면 전환 (#99) — 그리는 띠: view 동안은 없음 · 장면 전환을 켠 판 (view11) 의 필살기 · 합동 띠는 VIEW_WAIT_MS 동안 기다림 — 엔진 상태가 먼저 바뀌고
 *  연출이 다음 그림에 view 를 세워 띠가 한 장면 번쩍이던 것 (#96 UX 5바퀴 큼 1) · 그만큼 지나도 view 가 안 서면 (접었다 편 직후 · 칸을 못 찾음 — 3:3 용 판으로 감)
 *  띠를 그림 (이름이 아예 안 보이던 것 — #96 코드 리뷰 중간 2) · waitedMs = 그 띠가 생긴 뒤 (한 번이라도 장면 전환이 섰으면 0 — 끝까지 안 그림) */
export const VIEW_WAIT_MS = 150;
/** 힘겨루기 장면 (#116) 의 1:1 VS 컷인 (위아래 두 이름 · ult/core.js ULT_VS_MS 1.5초 + 걷힘 0.6초 — 1.6 이면 걷히는 VS 글자 위에 떴음) — 이 뒤에 연타 안내 (컷인 아래 띠의 상대 필살기 이름을 덮던 것) */
export const DUEL_VS_MS = 2100;
export function bandDrawn<T extends { kind: string }>(band: T | null, viewing: boolean, view11: boolean, waitedMs = Number.POSITIVE_INFINITY): T | null {
  if (!band || viewing) return null;
  // 힘겨루기 VS 띠도 (#116 — 힘겨루기도 장면 전환 · 장면이 서기 전 한 틱에 예전 "VS · 힘겨루기!" 띠가 번쩍이던 것, UX 리뷰어 2바퀴 큼 1 · #96 5바퀴 큼 1 과 같은 종류)
  return view11 && (band.kind === 'ult' || band.kind === 'joint' || band.kind === 'vs') && waitedMs < VIEW_WAIT_MS ? null : band;
}

/** 장면 전환이 끝날 때 (out) 걷지 않고 바둑판으로 사라졌다 제자리에서 나타나는 칸 — 합동 쏜 무리 (#101 — 돌아가는 길에 서로를 지나침) ·
 *  맞은 칸 (1:1 연출이 민 자리가 한 번에 풀려 90px 순간 이동한 뒤 걸어가던 것 — #96 UX 5바퀴 큼 2) */
export function viewPopsBack(view: { kind: 'solo' | 'joint' | 'duel'; side: Side; from: readonly number[]; to: { side: Side; slot: number }; duel?: { me: readonly number[]; foe: readonly number[] } }, side: Side, slot: number): boolean {
  if (view.kind === 'duel') return !!view.duel && view.duel[side].includes(slot);
  return (view.kind === 'joint' && side === view.side && view.from.includes(slot)) || (side === view.to.side && slot === view.to.slot);
}

/**
 * 장면 전환 피해 칩 (ideas 717 — 1:1 자리로 옮긴 동안 판 · 숫자를 숨겨 피해가 안 보이던 것): 장면이 시작된 뒤 (afterId 다음 순번) 맞는 쪽에 뜬 피해 숫자를 합계 하나로.
 * 회복 · 말은 뺌 · 모양은 센 쪽 (상성 > 급소 > 보통 > 반감) · 합동 숫자가 하나라도 있으면 합동 칩 · 없으면 null
 */
export const VIEW_CHIP_MS = 1200;
const CHIP_RANK: Record<string, number> = { weak: 0, damage: 1, crit: 2, super: 3 };
export function viewHitChip(popups: readonly TeamPopup[], side: Side, afterId: number): { ids: number[]; text: string; kind: TeamPopup['kind']; joint: boolean } | null {
  const hits = popups.filter((p) => p.id > afterId && p.side === side && p.kind in CHIP_RANK && /^-\d+$/.test(p.text));
  if (!hits.length) return null;
  const kind = hits.reduce((k, p) => (CHIP_RANK[p.kind]! > CHIP_RANK[k]! ? p.kind : k), hits[0]!.kind);
  return { ids: hits.map((p) => p.id), text: `-${hits.reduce((t, p) => t + Number(p.text.slice(1)), 0)}`, kind, joint: hits.some((p) => p.joint) };
}

/** 쓰러짐 말 넘겨받기 문턱 (1.2초) 까지 남은 ms — 줄에 든 이름 중 가장 늦게 뜬 것부터 셈 (첫 이름으로 세어 뒤 이름이 0.78초 · 판 끝 결과 줄이 마지막 이름을 0.98초에
 *  덮던 것 — UX 리뷰어 #95 14 · 15바퀴, 기획 #131 "쓰러짐 말 1초 넘게") · 이름이 없으면 0 */
export const FAINT_HOLD_MS = 1200;
export function faintHoldLeft(shownAt: readonly number[], now: number, hold = FAINT_HOLD_MS): number {
  return shownAt.length ? Math.max(0, Math.max(...shownAt) + hold - now) : 0;
}

/** 판 끝 (over) 쓰러짐 줄을 붙잡을지 — 가장 늦은 이름이 1.2초 안 됐거나, 결과 줄 ("…이겼다!" · "내 포켓몬이 다 쓰러졌다…") 이 아직 안 떴을 때 (판 끝 1초)
 *  (지는 판은 결과 줄이 이름 1.2초보다 0.3 ~ 0.6초 늦게 와서 그 사이 줄이 마지막 이름 하나로 줄던 것 — UX 리뷰어 #95 17바퀴 2 · bugs 1655 같은 종류) */
export function overLineHold(lineYoung: boolean, overMs: number, hasMsg: boolean): boolean {
  return lineYoung || (hasMsg && overMs < 1000);
}

/** 띠 끝 쓰러짐 말을 줄인 것 — 둘 넘게면 "2마리 쓰러졌다!" (240 "이겼다! · 2마리 쓰러졌다!" — 아트 디렉터 #95 4바퀴 ②) · 하나면 줄이지 않음 */
export function faintShortLine(names: readonly string[]): string | null {
  const n = new Set(names).size;
  return n > 1 ? `${n}마리 쓰러졌다!` : null;
}

/** 위 가운데 줄 (띠 · 쓰러짐 줄 · 결과 줄) 의 위 끝 — 위에서부터 앞 줄 아래 + 4 · 처음 안내와 겹치면 안내 아래 + 2 · 떠 있는 동안은 전보다 위로 안 감 (min)
 *  (닫히는 띠 · 안내를 따라 쓰러짐 줄이 28px 튀고 · 결과 줄과 겹치던 것 — 픽셀 검사원 #95 4바퀴 ③ ⑥) */
export function stackRows(rows: readonly { base: number; h: number; min?: number; tip?: { top: number; bottom: number } | null }[], gap = 4): number[] {
  let below = Number.NEGATIVE_INFINITY;
  return rows.map((r) => {
    let want = Math.max(r.base, below);
    if (r.tip && want < r.tip.bottom && want + r.h > r.tip.top) want = Math.ceil(r.tip.bottom + 2);
    want = Math.max(want, r.min ?? Number.NEGATIVE_INFINITY);
    below = want + r.h + gap;
    return want;
  });
}

/** 띠 왼쪽 끝 — 처음엔 가운데 (정수) · 그 뒤엔 처음 자리 그대로 (글이 붙으면 오른쪽으로만 늚) · 오른쪽 끝이 패널 8px 안을 넘을 때만 왼쪽으로
 *  (쓰러짐 말이 붙는 순간 띠가 양쪽으로 50px 씩 벌어지던 것 — 픽셀 검사원 #95 4바퀴 ⑤) */
export function bandLeft(parentW: number, w: number, first: number | null): number {
  const mid = Math.round((parentW - w) / 2);
  const start = first ?? mid;
  // 오른쪽 끝이 패널 8 안을 넘어 어차피 옮겨야 하면 가운데로 (240 에서 왼 36 · 오른 8 로 치우치던 것 — 아트 디렉터 #95 6바퀴 ④)
  return Math.max(8, start + w > parentW - 8 ? mid : start);
}

/** 패널 위 상자 (px) — 칩 자리 고르기 */
type ChipRect = { l: number; t: number; r: number; b: number };
const chipHits = (a: ChipRect, c: ChipRect) => a.l < c.r && a.r > c.l && a.t < c.b && a.b > c.t;

/** 발밑 판 상자 */
export function plateBoxOf(g: TeamGeo, side: Side, slot: number): ChipRect {
  const { x, y } = g.pos(side, slot);
  const w = side === 'me' ? g.pw : g.pw - 16;
  const l = Math.round(x - w / 2);
  return { l, t: y + 4, r: l + w, b: y + 18 };
}

/** 상대 예고 칩 자리 — 판 오른쪽 2px (보통) · 패널 오른쪽 밖이면 ×2 = 판 왼쪽 2px · ×1 (240) = 판 아래 2px (판 왼쪽이면 옆 칸 그림을 15 × 11 덮던 것 — 픽셀 검사원 #95 6바퀴 3) ·
 *  한 줄 배치에서 왼쪽 옆 상대의 칩과 같은 틈이면 판 위 (가운데 상대 "!" 와 끝 칸 "곧" 이 겹치던 것 — UX 리뷰어 #95 6바퀴 작음 6) */
export type WarnPos = 'right' | 'left' | 'below' | 'up';
export function warnPosOf(b: TeamBattle, g: TeamGeo, show: readonly boolean[]): WarnPos[] {
  const fits = (i: number) => Math.round(g.pos('foe', i).x + (g.pw - 16) / 2) + 2 + 22 <= g.W - 2;
  // 칩 상자 (판 기준 — team.css .pg-team-warn · -left · -below · -up 과 같은 값 · 22 × 12)
  const chipAt = (i: number, pos: WarnPos): ChipRect => {
    const p = plateBoxOf(g, 'foe', i);
    if (pos === 'right') return { l: p.r + 2, t: p.t + 1, r: p.r + 24, b: p.t + 13 };
    if (pos === 'left') return { l: p.l - 24, t: p.t + 1, r: p.l - 2, b: p.t + 13 };
    if (pos === 'below') return { l: p.r - 22, t: p.b + 2, r: p.r, b: p.b + 14 };
    return { l: p.r - 22, t: p.t - 14, r: p.r, b: p.t - 2 };
  };
  // 칸 순서대로 정하며 다른 상대 판 · 먼저 정한 칩과 겹치면 다음 자리 (240 × 187 체육관에서 위 판 "곧" (아래) 이 아래 판 "곧" (오른쪽) 과 66px² 겹치던 것 — #98 R4 8판) ·
  //   보이든 안 보이든 모든 칸을 같은 순서로 (칩이 새로 떠도 이미 뜬 칩이 옮겨 가지 않게 — U2)
  const plates = b.foe.map((f, i) => (f ? plateBoxOf(g, 'foe', i) : null));
  const placed: ChipRect[] = [];
  const inPanel = (r: ChipRect) => r.l >= 2 && r.r <= g.W - 2 && r.t >= 0 && r.b <= g.H - 2;
  return b.foe.map((_, i) => {
    let first: WarnPos = 'left';
    if (fits(i)) first = 'right';
    else if (g.scale === 1) first = 'below';
    else if (g.oneRow) {
      const x = g.pos('foe', i).x;
      const near = b.foe.map((__, j) => j).filter((j) => j !== i && g.pos('foe', j).x < x).sort((p, q) => g.pos('foe', q).x - g.pos('foe', p).x)[0];
      if (near !== undefined && show[near] && fits(near)) first = 'up';
    }
    const free = (pos: WarnPos) => {
      const r = chipAt(i, pos);
      return inPanel(r) && !plates.some((q, j) => q !== null && j !== i && chipHits(r, q)) && !placed.some((q) => chipHits(r, q));
    };
    const pos = [first, ...(['below', 'up', 'left', 'right'] as const).filter((p) => p !== first)].find(free) ?? first;
    placed.push(chipAt(i, pos));
    return pos;
  });
}

