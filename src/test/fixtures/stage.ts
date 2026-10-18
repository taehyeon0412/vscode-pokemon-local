/** 테스트용 스테이지 자리 찾기 */
import { planWild } from '../../game/core/rules/encounter';
import { stageLayout, type Spot } from '../../game/core/rules/stage';
import type { StageId } from '../../game/core/save';

/** 이로치 흔적이 있는 시드와 그 자리 (2% 라 앞쪽 시드에서 금방 나옴) */
export function shinyWildSeed(stageId: StageId = 'forest-1'): { seed: number; spot: Spot } {
  for (let seed = 1; seed < 100_000; seed++) {
    const spot = stageLayout(stageId, seed).spots.find((s) => s.kind === 'wild' && planWild(stageId, seed, s).shiny);
    if (spot) return { seed, spot };
  }
  throw new Error('이로치 흔적이 있는 시드를 못 찾음');
}
