/**
 * 잡기 (mvp-spec 3.4 · S11 · 4장 "잡기") — 화면도 시간도 모르는 계산.
 * 잡을 확률 = (포획률 / 255) × (1 − 남은 HP 비율 × 2/3) × 볼 배율 × 상태 이상 × 타이밍 보너스, 최대 1 · 마지막 기회 × 0.5
 */
import { BALANCE } from '../balance';
import type { ItemId, StatusCondition } from '../save';

export type BallId = 'poke-ball' | 'great-ball' | 'ultra-ball';
export const BALLS: readonly BallId[] = ['poke-ball', 'great-ball', 'ultra-ball'];

export function isBall(id: ItemId): id is BallId {
  return (BALLS as readonly string[]).includes(id);
}

export type CatchTiming = 'perfect' | 'good' | 'none';

/** 타이밍 원 — 다 줄어든 순간 (ringMs) 에서 얼마나 가까이 눌렀는지. 안 눌렀으면 (자동 전투 · 그냥 둠) 기본 */
export function catchTiming(pressMs: number | null, ringMs: number): CatchTiming {
  if (pressMs === null) return 'none';
  const off = Math.abs(pressMs - ringMs);
  if (off <= BALANCE.catchPerfectMs) return 'perfect';
  if (off <= BALANCE.catchGoodMs) return 'good';
  return 'none';
}

export function timingScale(t: CatchTiming): number {
  return t === 'perfect' ? BALANCE.catchPerfectScale : t === 'good' ? BALANCE.catchGoodScale : 1;
}

/** 잡기 어려움 (orders #23) — 쉬움 · 보통 · 어려움 (경계 BALANCE.catchTier) */
export type CatchTier = 'easy' | 'normal' | 'hard';

export function catchTier(chance: number): CatchTier {
  return chance >= BALANCE.catchTier.easy ? 'easy' : chance >= BALANCE.catchTier.normal ? 'normal' : 'hard';
}

/** 볼마다 지금 던질 때의 기본 확률 · 어려움 (타이밍 보너스 없이, 마지막 기회 × 0.5 포함) — 볼 줄 · 마지막 기회 · 타이밍 원이 같은 값 */
export function catchOdds(o: { captureRate: number; hp: number; maxHp: number; lastChance: boolean; status?: StatusCondition['kind'] | null }): Record<BallId, { chance: number; tier: CatchTier }> {
  const out = {} as Record<BallId, { chance: number; tier: CatchTier }>;
  for (const ball of BALLS) {
    const chance = catchChance({ ...o, ball, timing: 'none' });
    out[ball] = { chance, tier: catchTier(chance) };
  }
  return out;
}

/** 상태 이상 배율 — 잠듦 2 · 마비 · 독 · 화상 1.5 · 없으면 1 */
export function statusScale(status: StatusCondition['kind'] | null | undefined): number {
  return status ? BALANCE.catchStatusScale[status] : 1;
}

export function catchChance(o: { captureRate: number; hp: number; maxHp: number; ball: BallId; timing: CatchTiming; lastChance: boolean; status?: StatusCondition['kind'] | null }): number {
  const ratio = o.maxHp > 0 ? Math.min(1, Math.max(0, o.hp / o.maxHp)) : 0;
  const base = (Math.min(255, Math.max(1, o.captureRate)) / 255) * (1 - ratio * BALANCE.catchHpWeight);
  const p = base * BALANCE.ballScale[o.ball] * statusScale(o.status) * timingScale(o.timing) * (o.lastChance ? BALANCE.lastChanceScale : 1);
  return Math.min(1, Math.max(0, p));
}
