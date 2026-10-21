import { afterEach, describe, expect, it } from 'vitest';
import { fixedRng } from '../../../../test/fixtures/rng';
import { sampleMonster, sampleSave } from '../../../../test/fixtures/save';
import { startBattle, type BattleState } from '../../../core/engine/battle';
import { advance, createGameState, type GameState } from '../../../core/engine';
import { TIMING } from '../../../core/balance';
import { Rng } from '../../../core/engine/rng';
import { startTeamBattle, teamInput, teamStep, type TeamBattle } from '../../../core/engine/team';
import { battleAnimKey, FX_HOLD_DUEL_MAX_MS, FX_HOLD_MAX_MS, fxCoverLeft, fxTailLeft, holdFx, KO_ANIM_MS, KO_FLIP_MS, koWaitMs, pickShown, releaseFx, setFxCover, setFxTail, setPickShow, shouldHoldBattle, teamUltKey } from './hold';

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

describe('3:3 필살기 · 합동 마무리 — 연출이 맞힐 때까지 맞는 걸음을 붙잡음 (열쇠 = 시작 시각, 세 가지 시작 길)', () => {
  afterEach(() => releaseFx());
  const team = () => {
    const ms = [sampleMonster({ uid: 'a' }), sampleMonster({ uid: 'b', species: 4, form: 'charmander' }), sampleMonster({ uid: 'c', species: 7, form: 'squirtle' })];
    const save = sampleSave({ monsters: Object.fromEntries(ms.map((m) => [m.uid, { ...m, hp: 999 }])), party: ms.map((m) => m.uid) });
    const foes = [10, 13, 16].map((dex, i) => sampleMonster({ uid: `f${i}`, species: dex, form: ['caterpie', 'weedle', 'pidgey'][i]!, moves: [{ moveId: 33, pp: 35 }] }));
    return { save, b: startTeamBattle(save, foes, 'trainer', '상대') };
  };
  const at = (save: GameState['save'], tb: TeamBattle): GameState => {
    const s = createGameState(save, 1);
    return { ...s, runtime: { ...s.runtime, stageId: 'forest-1', stage: { phase: 'team', team: tb } } };
  };
  /** 필살기 단계로 들어간 기록 (ult) 의 시작 시각 열쇠 · 맞기 바로 앞까지 걸음 */
  const keyOf = (tb: TeamBattle) => teamUltKey(tb.log.filter((e) => e.t === 'ult').at(-1)!.at);
  const nearHit = (tb: TeamBattle): TeamBattle => {
    let cur = tb;
    while (cur.ult && cur.ult.ms + 50 < cur.ult.hitMs) cur = teamStep(cur, 50, new Rng(1), { auto: false, away: false });
    return cur;
  };

  it('혼자 · 멘트 뒤 · 힘겨루기 뒤 합동 — 기록 열쇠와 붙잡는 열쇠가 같음', () => {
    const { save, b } = team();
    const full = (x: TeamBattle, slots: number[]) => ({ ...x, me: x.me.map((f, i) => (slots.includes(i) ? { ...f, ult: 1 } : f)) });
    // 혼자 (찬 동료 없음)
    const solo = nearHit(teamInput(full(b, [0]), { kind: 'ult', slot: 0 }, new Rng(9)));
    // 멘트 뒤 합동
    const g = teamInput(full(b, [0, 1]), { kind: 'ult', slot: 0 }, new Rng(9));
    const joint = nearHit(teamStep(teamInput(g, { kind: 'ult', slot: 1 }, new Rng(9)), 50, new Rng(9), { auto: false, away: false }));
    // 힘겨루기 뒤 합동 (둘이 이김)
    const clash: TeamBattle = { ...b, phase: 'clash', clash: { kind: 'ult', me: [0, 2], foe: [0], shots: null, ms: TIMING.team.ultClashMs - 50, dur: TIMING.team.ultClashMs, taps: 0, winner: null } };
    const won = nearHit(teamStep(clash, 50, fixedRng(0.01), { auto: false, away: false }));
    for (const tb of [solo, joint, won]) {
      expect(tb.phase).toBe('ult');
      releaseFx();
      holdFx(keyOf(tb), 5000, 0, 12_000);
      expect(shouldHoldBattle(at(save, tb), 50, 100)).toBe(true);
      // 다른 필살기 열쇠면 안 붙잡음
      holdFx(teamUltKey(-1), 5000, 0, 12_000);
      expect(shouldHoldBattle(at(save, tb), 50, 100)).toBe(false);
    }
  });
});

describe('필살기로 쓰러뜨린 뒤 남은 연출 동안 붙잡음 (2026-10-21 UX 리뷰어 — 벌러덩이 연출 밑에서 지나가던 것)', () => {
  afterEach(() => {
    releaseFx();
    setFxTail(0);
  });
  const at = (phase: BattleState['phase']) => {
    const { state, b } = inMove(0);
    const nb: BattleState = { ...b, phase, anim: null };
    return { ...state, runtime: { ...state.runtime, stage: { phase: 'battle' as const, battle: nb } } };
  };
  it('맞힌 순간 releaseFx 로 붙잡기가 풀려도 꼬리가 남았으면 send · over · last 를 붙잡음 · 꼬리가 끝나면 풂', () => {
    holdFx('x', 3000, 0, 12_000);
    releaseFx(); // 맞힌 순간 (onHit)
    setFxTail(2500);
    for (const ph of ['over', 'last'] as const) expect(shouldHoldBattle(at(ph), 50, 1000)).toBe(true);
    expect(shouldHoldBattle(at('run'), 50, 1000)).toBe(false);
    expect(shouldHoldBattle(at('over'), 50, 2600)).toBe(false);
    expect(fxTailLeft(1000)).toBe(1500);
    setFxTail(0);
    expect(shouldHoldBattle(at('over'), 50, 1000)).toBe(false);
  });
  it('덮음 끝 (cover) = 넘어짐 기다림 — 모르면 꼬리 끝 · 꼬리 끝을 넘지 않음 · 붙잡기는 꼬리 끝 그대로 (UX 리뷰어 4차)', () => {
    setFxTail(4000);
    setFxCover(0);
    expect(fxCoverLeft(1000)).toBe(3000);
    setFxCover(1800);
    expect(fxCoverLeft(1000)).toBe(800);
    expect(shouldHoldBattle(at('over'), 50, 2000)).toBe(true);
    setFxCover(9000);
    expect(fxCoverLeft(1000)).toBe(3000);
    setFxCover(0);
  });
  it('넘어짐 기다림 = 덮음 끝 − 0.4초 − 넘어가는 0.62초 (UX 리뷰어 8차) · 마지막 기회는 덮음 끝까지만 붙잡음', () => {
    setFxTail(9000);
    setFxCover(5000);
    expect(koWaitMs(1000)).toBe(4000 - 400 - KO_FLIP_MS);
    expect(koWaitMs(4800)).toBe(0);
    expect(shouldHoldBattle(at('last'), 50, 4000)).toBe(true);
    expect(shouldHoldBattle(at('last'), 50, 5100)).toBe(false);
    expect(shouldHoldBattle(at('over'), 50, 5100)).toBe(true);
    setFxCover(0);
  });
  it('다음 볼 — 벌러덩이 시작할 때부터 (덮음 끝 − 1.02초) 내보내기 시간을 셈 = 보통 기술 박자 (8 · 9 · 10차)', () => {
    const send = (sendMs: number) => {
      const s = at('send');
      const b = s.runtime.stage.phase === 'battle' ? s.runtime.stage.battle : null;
      return { ...s, runtime: { ...s.runtime, stage: { phase: 'battle' as const, battle: { ...b!, sendMs } } } };
    };
    const koStart = (cover: number) => cover - 400 - KO_FLIP_MS;
    // 덮음이 늦은 필살기 (덮음 3.0 · 꼬리 3.2초) — 벌러덩 시작 (1.98초) 까지 단계를 통째로 붙잡음 (볼 그림도 그 뒤 — 보통 시간표대로 1.9초 뒤 = 벌러덩 끝 즈음)
    setFxTail(3200);
    setFxCover(3000);
    expect(shouldHoldBattle(send(0), 50, 1900)).toBe(true);
    expect(shouldHoldBattle(send(0), 50, koStart(3000) + 10)).toBe(false);
    // 자기 둘레 필살기 (덮음 = 큰 맞음 바로 뒤) — 바로 셈
    setFxTail(3300);
    setFxCover(100);
    expect(shouldHoldBattle(send(0), 50, 1000)).toBe(false);
    expect(KO_ANIM_MS).toBe(2300);
    // 덮음 끝을 모르면 꼬리 끝까지
    setFxCover(0);
    expect(shouldHoldBattle(send(0), 50, 3100)).toBe(true);
    expect(shouldHoldBattle(send(0), 50, 3300)).toBe(false);
    // 필살기가 아니면 (꼬리 0) 엔진 그대로
    setFxTail(0);
    setFxCover(0);
    expect(shouldHoldBattle(send(TIMING.foeSendMs - 50), 50, 1000)).toBe(false);
  });
  it('고르기 목록이 보이는 때 — 0 이면 고르는 중 아님', () => {
    setPickShow(0);
    expect(pickShown(5000)).toBe(false);
    setPickShow(3000);
    expect(pickShown(2999)).toBe(false);
    expect(pickShown(3000)).toBe(true);
    setPickShow(0);
  });
});
