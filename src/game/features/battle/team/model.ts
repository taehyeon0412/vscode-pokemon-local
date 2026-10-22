/**
 * 3:3 화면 모델 (orders #17 3단계 — 디자인팀 4안 시안 그대로의 자리 · 판 상태). 화면 (TeamLayer) 과 떼어 둔 계산 — 자동 테스트.
 * 자리 (geo) = 시안 geo(): 폭 400 아래 ×1 · 높이 300 아래 ×2 · 그 위 ×3 · 가장 낮은 패널 (높이 170 아래 · 폭 400 부터) 은 ×2 한 줄 (#85 A).
 * 칸 0 · 1 · 2 = 위 (뒷줄 · 바깥) → 아래 (앞줄 · 가운데) = 발밑 판 키 1 · 2 · 3.
 */
import { BALANCE, TIMING } from '../../../core/balance';
import { teamClashSure, teamGather, teamLayout, teamUltLevel, teamUltOpen, type Side, type TeamBattle } from '../../../core/engine';
import { speciesOf } from '../../../data';

export interface TeamGeo {
  W: number;
  H: number;
  /** 정보줄 아래 무대가 시작하는 높이 */
  IB: number;
  scale: 1 | 2 | 3;
  /** 포켓몬 칸 (32 × 배율) */
  sp: number;
  oneRow: boolean;
  cx: number;
  /** 내 발밑 판 폭 (상대는 − 16) */
  pw: number;
  /** 발 가운데 (x) · 발 높이 (y) */
  pos(side: Side, slot: number): { x: number; y: number };
}

export function teamGeometry(W: number, H: number, IB: number): TeamGeo {
  const oneRow = teamLayout({ w: W, h: H }) === 'row';
  const scale: 1 | 2 | 3 = W < 400 ? 1 : oneRow || H < BALANCE.team.view.x3MinH ? 2 : 3;
  const sp = 32 * scale;
  const stageH = H - IB;
  const HZh = Math.round(stageH * 0.22);
  const r3 = stageH - 23;
  const r1 = HZh + Math.round(sp * 0.8);
  const r2 = Math.round((r1 + r3) / 2);
  const cx = Math.round(W / 2);
  const pw = oneRow ? 46 : scale === 1 ? 40 : scale === 2 ? 52 : 68;
  const s = scale === 1 ? 24 : scale === 2 ? 60 : 69;
  const Wb = Math.min(W, 860);
  const pwE = scale === 1 ? 40 : scale === 2 ? 52 : 68;
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
  if (d.slot >= 0) {
    const go = teamUltOpen(b, d.slot);
    return { key: d.slot + 1, go, text: go ? '지금!' : d.why === 'charge' ? '아직 안 찼어요' : '지금은 못 써요' };
  }
  const open = b.me.findIndex((_, i) => teamUltOpen(b, i));
  if (open >= 0) return { key: open + 1, go: true, text: '지금!' };
  const full = b.me.some((f) => f.hp > 0 && f.ult >= 1);
  return { key: null, go: false, text: d.why === 'charge' && !full ? '아직 다 찬 포켓몬이 없어요' : '지금은 못 써요' };
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
  | { kind: 'join'; keys: number[]; left: number; me: number; foe: number; sure: Side | null; foeJoint: boolean }
  | { kind: 'gather'; who: { key: number; name: string }[]; left: number }
  | { kind: 'mash'; sure: Side | null; me: number; foe: number }
  | null;

export function teamPrompt(b: TeamBattle): TeamPrompt {
  const keys = b.me.map((_, i) => i).filter((i) => teamUltOpen(b, i));
  if (b.phase === 'ult' && b.ult) {
    const g = teamGather(b);
    if (g && g.side === 'me') {
      return { kind: 'gather', who: g.can.map((i) => ({ key: i + 1, name: speciesOf(b.me[i]!.species)?.name.ko ?? '' })), left: Math.max(0, g.leftMs / g.totalMs) };
    }
    if (b.ult.side === 'foe' && b.ult.window > 0 && !b.ult.hit && keys.length > 0) {
      // 막대 = 실제 창 (상대 합동 멘트면 1.5초) 대로 (U2 — 1.2초로 셈하던 것, 기획 #24) · 머릿수 = 나 1 : 상대 (쓴 포켓몬 + 모인 동료)
      const foe = 1 + (b.ult.team?.length ?? 0);
      const total = b.ult.windowMs ?? TIMING.team.interruptMs;
      // 받아치면 짐 = 끼어들 수 있는 게 하나뿐일 때만 (둘 넘게 찼으면 힘겨루기 중에 더 끼어들어 2:3 · 3:3 이 될 수 있음 — 코드 리뷰어)
      const sure = keys.length === 1 ? teamClashSure({ me: [0], foe: Array.from({ length: foe }, (_, i) => i) }) : null;
      return { kind: 'join', keys: keys.map((i) => i + 1), left: Math.max(0, Math.min(1, b.ult.window / total)), me: 1, foe, sure, foeJoint: (b.ult.gather ?? 0) > 0 };
    }
  }
  if (b.phase === 'clash' && b.clash?.kind === 'ult') return { kind: 'mash', sure: teamClashSure(b.clash), me: b.clash.me.length, foe: b.clash.foe.length };
  return null;
}
