/**
 * 시간 → 고정 걸음.
 * 화면이 60번 그리든 확장 쪽이 0.25초마다 돌든, 게임 계산은 늘 TIMING.simStepMs 걸음으로 해서 결과가 같게 한다.
 */
import { TIMING } from '../balance';

/** 프레임 사이 시간 — 음수 · 숫자 아님은 0, 너무 길면 상한까지 (오래 멈췄다 와도 몰아서 계산하지 않게) */
export function clampFrameDelta(dtMs: number, maxMs: number = TIMING.maxFrameDeltaMs): number {
  if (!Number.isFinite(dtMs) || dtMs <= 0) return 0;
  return Math.min(dtMs, maxMs);
}

/** 쌓인 시간 + 지난 시간을 걸음 수로. 남은 시간은 다음으로 넘김 */
export function takeSteps(accMs: number, elapsedMs: number, stepMs: number = TIMING.simStepMs): { steps: number; accMs: number } {
  // 숫자가 아닌 값이 한 번 들어오면 남은 시간이 NaN 이 돼 시간이 영원히 멈추므로 0 으로
  const safe = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
  const total = safe(accMs) + safe(elapsedMs);
  const steps = Math.floor(total / stepMs);
  return { steps, accMs: total - steps * stepMs };
}
