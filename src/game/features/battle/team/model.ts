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

/** 발밑 판 모양 — charge (차는 중 · 판 없음) · reserved (예약) · ready (쓸 수 있음) · join (끼어들기 · 합류) · down (쓰러짐) */
export type PlateState = 'charge' | 'reserved' | 'ready' | 'join' | 'down';

export function plateState(b: TeamBattle, side: Side, slot: number): PlateState {
  const f = b[side][slot];
  if (!f || f.hp <= 0) return 'down';
  if (side === 'foe') return 'charge';
  if (teamUltOpen(b, slot)) return b.phase === 'run' ? 'ready' : 'join';
  if (b.reserve.includes(slot)) return 'reserved';
  return 'charge';
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
  | { kind: 'join'; keys: number[]; left: number }
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
    if (b.ult.side === 'foe' && b.ult.window > 0 && !b.ult.hit && keys.length > 0) return { kind: 'join', keys: keys.map((i) => i + 1), left: Math.max(0, b.ult.window / TIMING.team.interruptMs) };
  }
  if (b.phase === 'clash' && b.clash?.kind === 'ult') return { kind: 'mash', sure: teamClashSure(b.clash), me: b.clash.me.length, foe: b.clash.foe.length };
  return null;
}
