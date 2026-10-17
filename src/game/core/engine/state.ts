/**
 * 게임 상태 = 세이브 (저장함) + 진행 중 상태 (저장 안 함 — 랜덤 상태 · 남은 걸음 시간 · 나중에 전투 중 상태).
 * 이 상태 하나가 웹뷰와 확장 사이를 오가고, 누가 계산하든 같은 함수(advance)로 앞으로 간다.
 */
import { TIMING } from '../balance';
import type { Save } from '../save';
import { takeSteps } from './step';

export interface RuntimeState {
  /** Rng 상태 */
  rngState: number;
  /** 아직 걸음이 되지 못한 시간 (ms) */
  stepAccMs: number;
}

export interface GameState {
  save: Save;
  runtime: RuntimeState;
}

export function createGameState(save: Save, seed: number): GameState {
  return { save, runtime: { rngState: seed >>> 0, stepAccMs: 0 } };
}

/** 다른 쪽(웹뷰)에서 온 진행 중 상태 — 이상한 값은 새 시드 · 0 으로 */
export function readRuntime(raw: unknown, fallbackSeed: number, stepMs: number = TIMING.simStepMs): RuntimeState {
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const rng = r.rngState;
  const acc = r.stepAccMs;
  return {
    rngState: typeof rng === 'number' && Number.isInteger(rng) && rng >= 0 && rng <= 0xffffffff ? rng : fallbackSeed >>> 0,
    stepAccMs: typeof acc === 'number' && Number.isFinite(acc) && acc >= 0 && acc < stepMs ? acc : 0,
  };
}

/**
 * 패널이 안 보일 때도 계산을 이어 할지 (mvp-spec 3.3 U2).
 * 자동 전투가 꺼져 있으면 게임이 멈추고, 켜져 있으면 계속 (그림은 안 그리고 계산만).
 */
export function shouldRunWhenHidden(state: GameState): boolean {
  return state.save.settings.autoBattle;
}

/** 걸음 하나 — 지금은 플레이 시간만. 전투 · 스테이지가 생기면 여기서 나눠 부름 */
export function step(state: GameState, stepMs: number): GameState {
  return { ...state, save: { ...state.save, playTimeMs: state.save.playTimeMs + stepMs } };
}

/** 지난 시간만큼 앞으로 — 보일 때(웹뷰) · 안 보일 때(확장) 같은 함수 */
export function advance(state: GameState, elapsedMs: number, stepMs: number = TIMING.simStepMs): { state: GameState; steps: number } {
  const { steps, accMs } = takeSteps(state.runtime.stepAccMs, elapsedMs, stepMs);
  let next = state;
  for (let i = 0; i < steps; i++) next = step(next, stepMs);
  if (steps === 0 && accMs === state.runtime.stepAccMs) return { state, steps };
  return { state: { ...next, runtime: { ...next.runtime, stepAccMs: accMs } }, steps };
}
