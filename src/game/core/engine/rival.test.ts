/** 라이벌 흐름 (gdd 4.12 · mvp-spec 3.10) — 깜짝 등장 → 띠 → 1:1 토너먼트 → 이기면 더 좋은 보상 · 지면 싸우기 전으로 */
import { describe, expect, it } from 'vitest';
import { sampleMonster, sampleSave, viaJson } from '../../../test/fixtures/save';
import { BALANCE, TIMING } from '../balance';
import { maxHpOf } from '../rules/bag';
import { stageLayout, stageLevelBand, type Spot } from '../rules/stage';
import type { Monster, Save, StageProgress } from '../save';
import { rivalLoseMsg } from '../rules/rival';
import { advance, isWaitingForInput, step } from './play';
import { createGameState, readRuntime, type GameState, type StageRuntime } from './state';

const STEP = TIMING.simStepMs;
const run0 = { startMs: 0, caught: 0, trainers: 0, seen: [], reach: 0, retries: 0 };
const FAC = [{ kind: 'hospital' as const, at: 0.5 }];
const STONES = ['fire-stone', 'water-stone', 'thunder-stone', 'leaf-stone', 'moon-stone'];

/** 라이벌 자리가 있는 시드 (30% 라 앞쪽에서 금방) */
function rivalSeed(): { seed: number; spot: Spot } {
  for (let seed = 1; seed < 10_000; seed++) {
    const spot = stageLayout('forest-1', seed, FAC).spots.find((s) => s.kind === 'rival');
    if (spot) return { seed, spot };
  }
  throw new Error('라이벌 자리가 있는 시드를 못 찾음');
}
const { seed, spot } = rivalSeed();
const stageAt = (progress: number, o: Partial<StageProgress> = {}): StageProgress => ({ seed, progress, cleared: false, defeatedTrainers: [], facilities: FAC, run: { ...run0 }, ...o });
const full = (m: Monster): Monster => ({ ...m, hp: maxHpOf(m) });

function game(save: Partial<Save> = {}, stage: StageRuntime | null = { phase: 'walk' }): GameState {
  const s = createGameState(sampleSave({ stages: { 'forest-1': stageAt(spot.at - 0.00001) }, ...save }), 7);
  return { ...s, runtime: { ...s.runtime, stage, stageId: 'forest-1' } };
}
const phase = (s: GameState) => s.runtime.stage?.phase;
function until(s: GameState, done: (s: GameState) => boolean, maxMs = 120_000): GameState {
  let cur = s;
  for (let t = 0; t < maxMs && !done(cur); t += STEP) cur = step(cur, STEP).state;
  return cur;
}
const auto = (s: GameState): GameState => ({ ...s, save: { ...s.save, settings: { ...s.save.settings, autoBattle: true } } });
const battleOf = (s: GameState) => (s.runtime.stage?.phase === 'battle' ? s.runtime.stage.battle : null);
/** 전투 상태의 한쪽 HP 를 바꿈 (이기거나 지게) */
function setHp(s: GameState, side: 'me' | 'foe', hp: number): GameState {
  const b = battleOf(s)!;
  return { ...s, runtime: { ...s.runtime, stage: { phase: 'battle', battle: { ...b, [side]: { ...b[side], hp } } } } };
}
/** 만남 → 띠 → 전투 시작까지 */
function meet(s0: GameState): GameState {
  const s = until(s0, (x) => phase(x) === 'rival', 5000);
  expect(phase(s)).toBe('rival');
  return advance(s, TIMING.rivalMeetMs + 100).state;
}

describe('라이벌 깜짝 등장 (gdd 4.12)', () => {
  it('안 볼 때 · VS Code 에 포커스가 없을 때는 라이벌 바로 앞에서 멈추고 알림 → 다시 보면 걸어가 만남 (2026-10-20 ideas #87)', () => {
    for (const away of [{ headless: true }, { away: true }]) {
      const s0 = auto(game());
      const r = advance({ ...s0, runtime: { ...s0.runtime, ...away } }, 3000);
      expect(phase(r.state)).toBe('hold');
      expect(r.state.runtime.stage).toEqual({ phase: 'hold', why: 'rival' });
      expect(r.notices).toEqual(['rival']);
      expect(r.state.save.pendingEncounter).toBeFalsy();
      expect(isWaitingForInput(r.state)).toBe(true);
      // 저장 · 다시 읽기에도 그대로
      expect(readRuntime(viaJson(r.state.runtime), 1).stage).toEqual({ phase: 'hold', why: 'rival' });
      const back = { ...r.state, runtime: { ...r.state.runtime, headless: false, away: false } };
      expect(phase(until(back, (x) => phase(x) === 'rival', 5000))).toBe('rival');
    }
  });

  it('그 자리에서 멈춤 → 라이벌 단계 (가장 덜 만난 라이벌) → 자동 전투여도 1:1 토너먼트 · 이름 "라이벌 레드" · 도망 없음 (트레이너 전투)', () => {
    const s = until(auto(game()), (x) => phase(x) === 'rival', 5000);
    expect(s.runtime.stage).toEqual({ phase: 'rival', rival: 'boy', ms: expect.any(Number) });
    expect(s.save.pendingEncounter).toEqual({ kind: 'rival', rival: 'boy', stageId: 'forest-1' });
    expect(isWaitingForInput(s)).toBe(false);
    expect(phase(advance(s, TIMING.trainerMeetMs + 100).state)).toBe('rival'); // 라이벌은 띠를 더 오래 (전적 읽을 시간)
    const b = battleOf(advance(s, TIMING.rivalMeetMs + 100).state);
    expect(b?.kind).toBe('trainer');
    expect(b?.foeName).toBe('라이벌 레드');
    expect(b?.foe.species).toBe(25);
    expect(b?.foeQueue).toHaveLength(0); // 처음 = 1마리
  });

  it('이기면 — 트레이너 돈 × 1.5 · 처음 이기면 진화의 돌 · 전적 1승 · 결과에 한마디', () => {
    const start = meet(auto(game({ monsters: { m1: full(sampleMonster()) }, party: ['m1'], bag: {} })));
    const money = start.save.money;
    const s = until(setHp(start, 'foe', 1), (x) => phase(x) === 'result', 60_000);
    expect(phase(s)).toBe('result');
    expect(s.save.rivals).toEqual({ boy: { wins: 1, losses: 0 } });
    const lv = battleOf(start)!.foe.level;
    expect(s.save.money - money).toBe(Math.round(lv * BALANCE.trainerMoneyPerLevel * BALANCE.rivalMoneyScale));
    const stones = STONES.filter((k) => (s.save.bag[k as keyof Save['bag']] ?? 0) > 0);
    expect(stones).toHaveLength(1);
    const summary = s.runtime.stage?.phase === 'result' ? s.runtime.stage.summary : null;
    expect(summary?.title).toBe('라이벌 레드와의 승부에서 이겼다!');
    expect(summary?.quote).toBe('레드: 다음엔 꼭 이길 거야! (전적 1승 0패)');
    expect(summary?.rival).toBe(true);
    // 웹뷰와 주고받아도 한마디 · 희귀 표시가 남음 (명세 검사관 · 리드)
    expect(readRuntime(viaJson(s.runtime), 1).stage).toEqual(s.runtime.stage);
    expect(summary?.item).toBeTruthy();
    expect(s.save.pendingEncounter).toBeNull();
    // 걸어서 같은 자리를 다시 지나도 이 판엔 다시 안 나옴
    const again = until({ ...s, runtime: { ...s.runtime, stage: { phase: 'walk' } } }, (x) => (x.save.stages['forest-1']?.progress ?? 0) > spot.at + 0.001 || phase(x) === 'rival', 10_000);
    expect(phase(again)).not.toBe('rival');
  });

  it('지면 — 싸우기 전 그대로 (HP · PP) · 돈 안 잃음 · 병원 안 감 · 계속 걸음 · 전적 1패 · 머리 위 알림', () => {
    const me = full(sampleMonster());
    const start = meet(auto(game({ monsters: { m1: me }, party: ['m1'], money: 500 })));
    const s = until(setHp(start, 'me', 1), (x) => phase(x) !== 'battle', 60_000);
    expect(phase(s)).toBe('walk');
    expect(s.save.rivals).toEqual({ boy: { wins: 0, losses: 1 } });
    expect(s.save.money).toBe(500);
    expect(s.save.monsters.m1).toEqual(me);
    expect(s.save.location).toEqual({ screen: 'stage', stageId: 'forest-1' });
    expect(s.save.stages['forest-1']!.progress).toBeGreaterThanOrEqual(spot.at);
    expect(s.save.pendingEncounter).toBeNull();
    expect(s.runtime.toast?.text).toBe('라이벌 레드: 역시 내가 한 수 위지! (전적 0승 1패)');
    // 계속 걸어도 같은 자리에서 다시 안 나옴
    const on = until(s, (x) => (x.save.stages['forest-1']?.progress ?? 0) > spot.at + 0.001 || phase(x) === 'rival', 10_000);
    expect(phase(on)).not.toBe('rival');
  });

  it('지면 전투 끝 문구 = "연습 경기" (눈앞이 깜깜해졌다 아님 — 플레이 리뷰어) · 상태 · 전투 중 쓴 아이템도 되돌림', () => {
    const me = full(sampleMonster());
    const start = meet(auto(game({ monsters: { m1: me }, party: ['m1'], bag: { potion: 2 } })));
    const b = battleOf(start)!;
    const hurt = { ...start, runtime: { ...start.runtime, stage: { phase: 'battle' as const, battle: { ...b, me: { ...b.me, hp: 1, status: { kind: 'poison' as const } }, bagUsed: { potion: 1 } } } } };
    const over = until(hurt, (x) => battleOf(x)?.phase === 'over' || phase(x) !== 'battle', 60_000);
    expect(battleOf(over)?.msg).toBe(rivalLoseMsg('boy'));
    expect(rivalLoseMsg('boy')).toBe('라이벌 레드에게 졌다… 연습 경기라 잃은 것은 없다!');
    const s = until(over, (x) => phase(x) !== 'battle', 10_000);
    expect(s.save.bag).toEqual({ potion: 2 });
    expect(s.save.monsters.m1).toEqual(me);
  });

  it('이겼어도 내 팀이 다 쓰러졌으면 (반동 · 독) 진 것과 같음 — 보상 없음 · 1패', () => {
    const start = meet(auto(game({ monsters: { m1: full(sampleMonster()) }, party: ['m1'], money: 500 })));
    const b = battleOf(start)!;
    const both = { ...start, runtime: { ...start.runtime, stage: { phase: 'battle' as const, battle: { ...b, phase: 'over' as const, result: 'win' as const, overMs: 0, foe: { ...b.foe, hp: 0 }, me: { ...b.me, hp: 0 } } } } };
    const s = until(both, (x) => phase(x) !== 'battle', 20_000);
    expect(phase(s)).toBe('walk');
    expect(s.save.rivals).toEqual({ boy: { wins: 0, losses: 1 } });
    expect(s.save.money).toBe(500);
  });

  it('졌다 병원에서 다시 걸을 때 이미 지나간 라이벌 자리는 건너뜀 · 아직 못 간 자리면 나옴', () => {
    const passed = game({ stages: { 'forest-1': stageAt(spot.at - 0.00001, { run: { ...run0, reach: spot.at + 0.01, retries: 1 } }) } });
    const on = until(passed, (x) => (x.save.stages['forest-1']?.progress ?? 0) > spot.at + 0.001 || phase(x) === 'rival', 10_000);
    expect(phase(on)).not.toBe('rival');
    const notYet = game({ stages: { 'forest-1': stageAt(spot.at - 0.00001, { run: { ...run0, reach: spot.at - 0.01, retries: 1 } }) } });
    expect(phase(until(notYet, (x) => phase(x) === 'rival', 5000))).toBe('rival');
  });

  it('두 번째 만남은 다음 라이벌 · 같은 라이벌을 다시 만나면 2마리', () => {
    const s = until(game({ rivals: { boy: { wins: 1, losses: 0 } } }), (x) => phase(x) === 'rival', 5000);
    expect(s.runtime.stage).toMatchObject({ rival: 'blue' });
    const all = Object.fromEntries(['boy', 'blue', 'brendan', 'wally', 'may', 'may-rs', 'leaf-em'].map((id) => [id, { wins: 1, losses: 0 }]));
    const b = battleOf(meet(game({ rivals: all })));
    expect(b?.foeName).toBe('라이벌 레드');
    expect(b?.foeQueue).toHaveLength(1);
  });

  it('라이벌 전투 중에 껐다 켜면 같은 상대와 처음부터 · 라이벌 단계도 이어서', () => {
    const s = meet(game());
    const reloaded = step(createGameState(viaJson(s.save), 3), STEP).state;
    expect(battleOf(reloaded)?.foeName).toBe('라이벌 레드');
    expect(battleOf(reloaded)?.foe.species).toBe(battleOf(s)?.foe.species);
    const meeting = until(game(), (x) => phase(x) === 'rival', 5000);
    expect(readRuntime(viaJson(meeting.runtime), 1).stage).toEqual(meeting.runtime.stage);
  });

  it('라이벌 단계의 라이벌이 세이브와 다르면 버리고 세이브대로 (트레이너와 같음)', () => {
    const s = game({ pendingEncounter: { kind: 'rival', rival: 'boy', stageId: 'forest-1' } }, { phase: 'rival', rival: 'may', ms: 0 });
    expect(battleOf(step(s, STEP).state)?.foeName).toBe('라이벌 레드');
  });

  it('트레이너 전투 상태가 라이벌 만남과 함께 오면 (또는 반대) 버리고 세이브대로 — 보상 · 전적이 엉뚱하게 가지 않게 (코드 리뷰어)', () => {
    const rivalFight = meet(game());
    const asTrainer = { ...rivalFight, save: { ...rivalFight.save, pendingEncounter: { kind: 'trainer' as const, trainerId: 'forest-1:t0', stageId: 'forest-1' as const } } };
    expect(battleOf(step(asTrainer, STEP).state)?.foeName).not.toBe('라이벌 레드');
    const otherRival = { ...rivalFight, save: { ...rivalFight.save, pendingEncounter: { kind: 'rival' as const, rival: 'may', stageId: 'forest-1' as const } } };
    expect(battleOf(step(otherRival, STEP).state)?.foeName).toBe('라이벌 지민');
    expect(battleOf(step(rivalFight, STEP).state)?.foeName).toBe('라이벌 레드');
  });

  it('살아 있는 포켓몬이 없으면 (이상한 세이브) 라이벌 자리를 그냥 지나감 — 전적도 안 셈 (테스터)', () => {
    const s = until(game({ monsters: { m1: { ...sampleMonster(), hp: 0 } }, party: ['m1'] }), (x) => (x.save.stages['forest-1']?.progress ?? 0) > spot.at + 0.001 || phase(x) !== 'walk', 10_000);
    expect(phase(s)).not.toBe('rival');
    expect(s.save.rivals).toBeUndefined();
  });

  it('가방이 가득 (999) 이어도 넘치지 않음 (테스터)', () => {
    const full999 = { 'fire-stone': 999, 'water-stone': 999, 'thunder-stone': 999, 'leaf-stone': 999, 'moon-stone': 999 } as const;
    const start = meet(auto(game({ monsters: { m1: full(sampleMonster()) }, party: ['m1'], bag: { ...full999 } })));
    const s = until(setHp(start, 'foe', 1), (x) => phase(x) === 'result', 60_000);
    expect(Object.values(s.save.bag).every((n) => (n ?? 0) <= 999)).toBe(true);
  });

  it('레벨 = 내 팀 최고 레벨 — 숲 레벨보다 높아도 따라옴', () => {
    const [, hi] = stageLevelBand('forest-1');
    const b = battleOf(meet(game({ monsters: { m1: full(sampleMonster({ level: hi + 7 })) }, party: ['m1'] })));
    expect(b?.foe.level).toBe(hi + 7);
  });
});
