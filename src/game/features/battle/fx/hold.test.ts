import { afterEach, describe, expect, it } from 'vitest';
import { sampleMonster, sampleSave } from '../../../../test/fixtures/save';
import { startBattle, type BattleState } from '../../../core/engine/battle';
import { advance, createGameState, type GameState } from '../../../core/engine';
import { battleAnimKey, FX_HOLD_DUEL_MAX_MS, FX_HOLD_MAX_MS, holdFx, releaseFx, shouldHoldBattle } from './hold';

/** 내 포켓몬이 기술을 쓰는 중인 전투 상태 (ms 까지 지남) */
function inMove(ms: number, dur = 900): { state: GameState; b: BattleState } {
  const wild = sampleMonster({ uid: 'w', species: 4, form: 'charmander', caughtAt: 'forest-1' });
  // 만난 야생이 저장에 있어야 엔진이 전투를 이어 감 (없으면 첫 걸음에 길로 돌아감)
  const save = sampleSave({ pendingEncounter: { kind: 'wild', monster: wild, start: 'normal' } });
  const b0 = startBattle(save, wild, 'normal');
  const b: BattleState = { ...b0, phase: 'anim', anim: { side: 'me', action: { kind: 'move', moveId: 52 }, ms, dur, counter: false } };
  const s = createGameState(save, 1);
  return { b, state: { ...s, runtime: { ...s.runtime, stageId: 'forest-1', stage: { phase: 'battle', battle: b } } } };
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

  it('엔진이 모아 둔 시간 · 배속까지 셈 — 끝 걸음이 빠져나가지 않게 (필살기가 2.2초에 끊기던 오류)', () => {
    const { state, b } = inMove(2150, 2200);
    holdFx(battleAnimKey(b), 6000, 0, 12_000);
    // 2150 + 16 < 2200 이지만 모아 둔 40 이 있으면 이번에 한 걸음 (50) 더 가서 끝남
    expect(shouldHoldBattle({ ...state, runtime: { ...state.runtime, stepAccMs: 40 } }, 16, 100)).toBe(true);
    expect(shouldHoldBattle({ ...state, runtime: { ...state.runtime, stepAccMs: 0 } }, 16, 100)).toBe(false);
    // 배속 4배면 16ms 프레임도 64ms
    expect(shouldHoldBattle({ ...state, runtime: { ...state.runtime, stepAccMs: 0, speed: 4 } }, 16, 100)).toBe(true);
    // 필살기 상한은 12초
    expect(shouldHoldBattle({ ...state, runtime: { ...state.runtime, stepAccMs: 40 } }, 16, 5999)).toBe(true);
    expect(shouldHoldBattle({ ...state, runtime: { ...state.runtime, stepAccMs: 40 } }, 16, 6000)).toBe(false);
  });

  it('실제 엔진을 16ms 프레임으로 돌려도 연출이 끝날 때까지 행동이 안 끝남 (코드 리뷰어 — 50ms 걸음 사이로 빠져나가던 것)', () => {
    const { state: s0, b } = inMove(0, 900);
    const key = battleAnimKey(b);
    holdFx(key, 2000, 0);
    let state = s0;
    let endedAt = -1;
    for (let now = 16; now <= 3000 && endedAt < 0; now += 16) {
      if (shouldHoldBattle(state, 16, now)) continue;
      state = advance(state, 16).state;
      const st = state.runtime.stage;
      const cur = st?.phase === 'battle' ? st.battle : null;
      if (!cur || battleAnimKey(cur) !== key) endedAt = now;
    }
    // 연출 2초가 끝난 다음 프레임쯤에 끝남 (엔진 0.9초가 아니라)
    expect(endedAt).toBeGreaterThanOrEqual(2000);
    expect(endedAt).toBeLessThan(2100);
  });

  it('힘대결 — 승자를 정하는 걸음만 붙잡음 (밀고 밀리기 3.6초까지, 연타는 그동안 계속) · 승자가 정해진 뒤엔 안 붙잡음', () => {
    const { state: s0, b: b0 } = inMove(0);
    const clash = (ms: number, winner: 'me' | 'foe' | null): { state: GameState; b: BattleState } => {
      // 시각 t 는 힘대결 시간과 같이 늚 (같은 힘대결 = 같은 시작 시각)
      const b: BattleState = { ...b0, t: 5000 + ms, phase: 'clash', anim: null, clash: { kind: 'move', me: 75, foe: 52, base: 0.5, taps: 0, ms, winner } };
      return { b, state: { ...s0, runtime: { ...s0.runtime, stage: { phase: 'battle', battle: b } } } };
    };
    const c = clash(3950, null);
    holdFx(battleAnimKey(c.b), 6000, 0, FX_HOLD_DUEL_MAX_MS);
    expect(battleAnimKey(c.b)).toBe(battleAnimKey(clash(100, null).b)); // 힘대결 하나 = 한 열쇠
    expect(shouldHoldBattle(c.state, 50, 100)).toBe(true); // 3950 + 50 = 4000 → 승자를 정할 걸음
    expect(shouldHoldBattle(clash(3000, null).state, 50, 100)).toBe(false); // 아직 연타 중
    expect(shouldHoldBattle(clash(4750, 'me').state, 50, 100)).toBe(false); // 승자가 정해진 뒤 (결과 0.8초) 는 그대로
    expect(shouldHoldBattle(c.state, 50, 6000)).toBe(false); // 연출이 끝남
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
