/**
 * 연출이 끝날 때까지 웹뷰 전투 진행을 붙잡음 — 엔진은 기술 0.9초인데 일반 모드 연출은 0.5 ~ 2.4초라 (2026-10-19).
 * 지금 연출 중인 행동이 다음 걸음에 끝나는데 (피해가 들어가는 순간) 연출이 아직이면 그 걸음만 미룸 → 피해 숫자가 연출이 맞는 순간에 뜸.
 * 안 볼 때 확장 계산 (엔진) 은 그대로 · 상한이 있어 오래 멈추지 않음.
 */
import { TIMING } from '../../../core/balance';
import { MAX_SPEED, takeSteps, type BattleState, type GameState } from '../../../core/engine';

/** 한 행동을 붙잡는 상한 (ms) — 기술 · 필살기 (일반 모드 필살기는 0.9 + 3.6 ~ 10 + 0.5초) */
export const FX_HOLD_MAX_MS = 4000;
export const FX_HOLD_ULT_MAX_MS = 12_000;

let holdUntil = 0;
let holdKey = '';

/** 연출 하나 = 이 열쇠 (BattleLayer 가 연출을 다시 시작하는 기준과 같음) */
export function battleAnimKey(b: BattleState): string {
  return b.anim ? `${b.anim.side}${b.anim.action.kind}${b.t - b.anim.ms}` : '';
}

/** 이 행동의 연출이 now + ms 까지 걸림 */
export function holdFx(key: string, ms: number, now: number, maxMs = FX_HOLD_MAX_MS): void {
  holdKey = key;
  holdUntil = now + Math.max(0, Math.min(ms, maxMs));
}

export function releaseFx(): void {
  holdUntil = 0;
  holdKey = '';
}

/** 이번 걸음을 미룰지 — 같은 행동 · 이번 프레임에 끝날 수 있음 · 연출이 아직.
 *  엔진 (advance) 은 모아 둔 시간 (stepAccMs) + 이번 시간 × 배속 만큼 걸어서 — 이번 시간만 보면 끝 걸음이 빠져나감 (2026-10-19 필살기가 2.2초에 끊김) */
export function shouldHoldBattle(state: GameState, dtMs: number, now: number): boolean {
  if (now >= holdUntil) return false;
  const st = state.runtime.stage;
  const b = st?.phase === 'battle' ? st.battle : null;
  const a = b?.anim;
  if (!b || !a || b.phase !== 'anim' || battleAnimKey(b) !== holdKey) return false;
  const speed = Math.min(MAX_SPEED, Math.max(1, state.runtime.speed || 1));
  const { steps } = takeSteps(state.runtime.stepAccMs, dtMs * speed, TIMING.simStepMs);
  return steps > 0 && a.ms + steps * TIMING.simStepMs >= a.dur;
}
