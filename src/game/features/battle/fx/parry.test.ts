import { afterEach, describe, expect, it } from 'vitest';
import { sampleMonster, sampleSave } from '../../../../test/fixtures/save';
import { startBattle, type BattleAction, type BattleState } from '../../../core/engine/battle';
import { createGameState, type GameState } from '../../../core/engine';
import { battleAnimKey } from './hold';
import { clearImpact, setImpact, setUltSkip, spaceInput } from './parry';

/** 전투 중 행동 하나 (side · 행동) 가 도는 상태 */
function inAction(side: 'me' | 'foe', action: BattleAction): { state: GameState; b: BattleState } {
  const wild = sampleMonster({ uid: 'w', species: 4, form: 'charmander', caughtAt: 'forest-1' });
  const save = sampleSave({ pendingEncounter: { kind: 'wild', monster: wild, start: 'normal' } });
  const b0 = startBattle(save, wild, 'normal');
  const b: BattleState = { ...b0, phase: 'anim', anim: { side, action, ms: 100, dur: 900, counter: false } };
  const s = createGameState(save, 1);
  return { b, state: { ...s, runtime: { ...s.runtime, stageId: 'forest-1', stage: { phase: 'battle', battle: b } } } };
}

describe('Space — 패링 · 필살기 건너뛰기 (fx/parry)', () => {
  afterEach(() => {
    setUltSkip(null);
    clearImpact();
  });

  it('상대 공격 중 맞는 순간을 알면 패링 (맞기까지 남은 ms), 모르면 그냥 Space', () => {
    const { state, b } = inAction('foe', { kind: 'attack' });
    expect(spaceInput(state, 0)).toEqual({ kind: 'space' });
    setImpact(battleAnimKey(b), 500, 0);
    expect(spaceInput(state, 380)).toEqual({ kind: 'battle', input: { kind: 'parry', ms: 120 } });
  });

  it('필살기 연출 중 Space = 건너뛰기를 한 번만 부름 (2026-10-20) — 필살기가 아니면 안 부름', () => {
    let n = 0;
    setUltSkip(() => {
      n += 1;
    });
    const move = inAction('me', { kind: 'move', moveId: 52 });
    expect(spaceInput(move.state, 0)).toEqual({ kind: 'space' });
    expect(n).toBe(0);
    const ult = inAction('me', { kind: 'ult' });
    expect(spaceInput(ult.state, 0)).toEqual({ kind: 'space' });
    expect(spaceInput(ult.state, 0)).toEqual({ kind: 'space' });
    expect(n).toBe(1);
  });
});
