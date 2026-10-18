/** 테스트용 랜덤 */
import type { Rng } from '../../game/core/engine/rng';

/** 정해진 값만 내는 랜덤 — next = v, chance(p) = v < p, int = 가장 작은 값 */
export function fixedRng(v: number): Rng {
  return { next: () => v, int: (lo: number) => lo, chance: (p: number) => v < p, state: 1 } as unknown as Rng;
}
