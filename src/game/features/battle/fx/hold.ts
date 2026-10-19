/**
 * 연출이 끝날 때까지 웹뷰 전투 진행을 붙잡음 — 엔진은 기술 0.9초인데 일반 모드 연출은 0.5 ~ 2.4초라 (2026-10-19).
 * 지금 연출 중인 행동이 다음 걸음에 끝나는데 (피해가 들어가는 순간) 연출이 아직이면 그 걸음만 미룸 → 피해 숫자가 연출이 맞는 순간에 뜸.
 * 안 볼 때 확장 계산 (엔진) 은 그대로 · 상한이 있어 오래 멈추지 않음.
 */
import type { BattleState, GameState } from '../../../core/engine';

/** 한 행동을 붙잡는 상한 (ms) */
export const FX_HOLD_MAX_MS = 4000;

let holdUntil = 0;
let holdKey = '';

/** 연출 하나 = 이 열쇠 (BattleLayer 가 연출을 다시 시작하는 기준과 같음) */
export function battleAnimKey(b: BattleState): string {
  return b.anim ? `${b.anim.side}${b.anim.action.kind}${b.t - b.anim.ms}` : '';
}

/** 이 행동의 연출이 now + ms 까지 걸림 */
export function holdFx(key: string, ms: number, now: number): void {
  holdKey = key;
  holdUntil = now + Math.max(0, Math.min(ms, FX_HOLD_MAX_MS));
}

export function releaseFx(): void {
  holdUntil = 0;
  holdKey = '';
}

/** 이번 걸음을 미룰지 — 같은 행동 · 다음 걸음에 끝남 · 연출이 아직 */
export function shouldHoldBattle(state: GameState, dtMs: number, now: number): boolean {
  if (now >= holdUntil) return false;
  const st = state.runtime.stage;
  const b = st?.phase === 'battle' ? st.battle : null;
  const a = b?.anim;
  if (!b || !a || battleAnimKey(b) !== holdKey) return false;
  return a.ms + dtMs >= a.dur;
}
