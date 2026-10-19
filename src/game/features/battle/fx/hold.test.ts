import { afterEach, describe, expect, it } from 'vitest';
import { sampleMonster, sampleSave } from '../../../../test/fixtures/save';
import { startBattle, type BattleState } from '../../../core/engine/battle';
import { createGameState, type GameState } from '../../../core/engine';
import { battleAnimKey, FX_HOLD_MAX_MS, holdFx, releaseFx, shouldHoldBattle } from './hold';

/** 내 포켓몬이 기술을 쓰는 중인 전투 상태 (ms 까지 지남) */
function inMove(ms: number, dur = 900): { state: GameState; b: BattleState } {
  const save = sampleSave();
  const b0 = startBattle(save, sampleMonster({ uid: 'w', species: 4, form: 'charmander', caughtAt: 'forest-1' }), 'normal');
  const b: BattleState = { ...b0, phase: 'anim', anim: { side: 'me', action: { kind: 'move', moveId: 52 }, ms, dur, counter: false } };
  const s = createGameState(save, 1);
  return { b, state: { ...s, runtime: { ...s.runtime, stage: { phase: 'battle', battle: b } } } };
}

describe('일반 모드 연출이 끝날 때까지 전투 걸음을 붙잡음 (fx/hold — 2026-10-19)', () => {
  afterEach(() => releaseFx());

  it('같은 행동이 다음 걸음에 끝날 때만 · 연출 시간이 남았을 때만', () => {
    const { state, b } = inMove(880);
    holdFx(battleAnimKey(b), 2000, 0);
    expect(shouldHoldBattle(state, 50, 500)).toBe(true); // 880 + 50 ≥ 900 · 연출이 아직
    expect(shouldHoldBattle(state, 10, 500)).toBe(false); // 다음 걸음엔 아직 안 끝남
    expect(shouldHoldBattle(state, 50, 2000)).toBe(false); // 연출이 끝남
    const other = inMove(880);
    other.b.t += 1000; // 다른 행동 (열쇠가 다름)
    expect(shouldHoldBattle({ ...other.state, runtime: { ...other.state.runtime, stage: { phase: 'battle', battle: { ...other.b } } } }, 50, 500)).toBe(false);
  });

  it('상한이 있음 · 지우면 안 붙잡음 · 전투가 아니면 안 붙잡음', () => {
    const { state, b } = inMove(890);
    holdFx(battleAnimKey(b), 60_000, 0);
    expect(shouldHoldBattle(state, 50, FX_HOLD_MAX_MS - 1)).toBe(true);
    expect(shouldHoldBattle(state, 50, FX_HOLD_MAX_MS)).toBe(false);
    holdFx(battleAnimKey(b), 2000, 0);
    releaseFx();
    expect(shouldHoldBattle(state, 50, 100)).toBe(false);
    expect(shouldHoldBattle({ ...state, runtime: { ...state.runtime, stage: { phase: 'walk' } } }, 50, 100)).toBe(false);
  });
});
