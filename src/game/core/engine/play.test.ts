import { describe, expect, it } from 'vitest';
import { BALANCE, TIMING } from '../balance';
import { stageLayout, type Spot } from '../rules/stage';
import type { Save } from '../save';
import { sampleSave } from '../../../test/fixtures/save';
import { advance, applyInput, isWaitingForInput, leadSpeed, step, withSpeed } from './play';
import { createGameState, type GameState } from './state';

const STEP = TIMING.simStepMs;

/** 숲 1-1 을 막 시작한 세이브 (시설 자리는 아직 안 적힘) */
function start(seed = 42): GameState {
  const save = sampleSave({ stages: { 'forest-1': { seed, progress: 0, cleared: false, defeatedTrainers: [], facilities: [] } }, dex: { seen: [1], caught: [1] } });
  return createGameState(save, 7);
}

const prog = (s: GameState) => s.save.stages['forest-1']!.progress;
const layoutOf = (s: GameState) => stageLayout('forest-1', s.save.stages['forest-1']!.seed);

/** 그 종류의 첫 자리 바로 앞까지 진행을 옮김 */
function nearSpot(s: GameState, kind: Spot['kind'], nth = 0): { state: GameState; spot: Spot } {
  const spot = layoutOf(s).spots.filter((x) => x.kind === kind)[nth]!;
  const stages = { ...s.save.stages, 'forest-1': { ...s.save.stages['forest-1']!, progress: spot.at - 0.00001 } };
  return { state: { ...s, save: { ...s.save, stages }, runtime: { ...s.runtime, stage: { phase: 'walk' } } }, spot };
}

/** 조건이 될 때까지 걸음 (최대 maxMs) */
function until(s: GameState, done: (s: GameState) => boolean, maxMs = 60_000): GameState {
  let cur = s;
  for (let t = 0; t < maxMs && !done(cur); t += STEP) cur = step(cur, STEP).state;
  return cur;
}

const phase = (s: GameState) => s.runtime.stage?.phase;

describe('S06 자동 걷기 (mvp-spec 3.2)', () => {
  it('걸음마다 진행 % 가 오르고 플레이 시간도 흐름 · 시설 자리를 세이브에 적어 둠', () => {
    const s0 = start();
    expect(s0.save.stages['forest-1']!.facilities).toEqual([]);
    const s1 = advance(s0, 1000).state;
    expect(prog(s1)).toBeCloseTo(1000 / BALANCE.stageWalkMs, 8);
    expect(s1.save.playTimeMs).toBe(1000);
    expect(phase(s1)).toBe('walk');
    expect(s1.save.stages['forest-1']!.facilities.length).toBeGreaterThanOrEqual(2);
    expect(s0.save.stages['forest-1']!.progress).toBe(0); // 원래 상태는 그대로
  });

  it('잘게 (웹뷰 16ms) 든 크게 (확장 250ms) 든 같은 시간이면 같은 결과', () => {
    let a = start();
    let b = start();
    for (let t = 0; t < 120_000; t += 16) a = advance(a, 16, STEP).state;
    for (let t = 0; t < 120_000; t += 250) b = advance(b, 250, STEP).state;
    // 16 은 50 의 배수가 아니라 남은 시간만큼 차이 — 같은 걸음 수까지 맞춤
    const extra = Math.round((a.runtime.stepAccMs - b.runtime.stepAccMs) / STEP);
    expect(extra).toBe(0);
    expect(a.save).toEqual(b.save);
  });

  it('개발 창 빨리 감기: 배속만큼 더 걸음', () => {
    const fast = advance(withSpeed(start(), 10), 1000).state;
    expect(prog(fast)).toBeCloseTo(10_000 / BALANCE.stageWalkMs, 8);
    expect(withSpeed(start(), 999).runtime.speed).toBe(60);
  });

  it('끝까지 걸으면 멈춤 (클리어 카드는 단계 9) · 처음부터 다시 (임시)', () => {
    let s = start();
    s = { ...s, save: { ...s.save, stages: { 'forest-1': { ...s.save.stages['forest-1']!, progress: 0.99999 } } }, runtime: { ...s.runtime, stage: { phase: 'walk' } } };
    s = until(s, (x) => phase(x) === 'end', 5000);
    expect(prog(s)).toBe(1);
    expect(advance(s, 5000).state.save.stages['forest-1']!.progress).toBe(1);
    const again = applyInput(s, { kind: 'restart-stage' });
    expect(prog(again)).toBe(0);
    expect(phase(again)).toBe('walk');
  });
});

describe('떨어진 아이템 (gdd 4.6)', () => {
  it('지나가면 자동으로 줍고 알림 · 멈추지 않음', () => {
    const { state, spot } = nearSpot(start(), 'item');
    const before = state.save;
    const s = until(state, (x) => prog(x) >= spot.at);
    const gotBall = (s.save.bag['poke-ball'] ?? 0) - (before.bag['poke-ball'] ?? 0);
    const gotPotion = (s.save.bag.potion ?? 0) - (before.bag.potion ?? 0);
    const gotMoney = s.save.money - before.money;
    const gotStone = (s.save.bag['leaf-stone'] ?? 0) + (s.save.bag['moon-stone'] ?? 0);
    expect(gotBall + gotPotion + gotStone + (gotMoney > 0 ? 1 : 0)).toBe(1);
    expect(s.runtime.toast?.text).toContain('주웠다');
    expect(phase(s)).toBe('walk');
    // 같은 자리를 다시 줍지 않음
    const later = advance(s, 2000).state;
    expect(later.save.bag).toEqual(s.save.bag);
    expect(later.runtime.toast === null || later.runtime.toast.ms < s.runtime.toast!.ms).toBe(true);
  });
});

describe('야생 조우 (mvp-spec 3.2)', () => {
  it('흔적 자리에 오면 튀어나옴 → 만난 종 기록 · 상대는 세이브에 (전투 중에 꺼도 그 전투부터) → 전투 → (임시) 이긴 것으로 · 바로 저장', () => {
    const { state, spot } = nearSpot(start(), 'wild');
    let s = until(state, (x) => phase(x) === 'appear');
    expect(prog(s)).toBe(spot.at);
    const pending = s.save.pendingEncounter;
    expect(pending?.kind).toBe('wild');
    const wild = pending!.kind === 'wild' ? pending!.monster : null;
    expect(s.save.dex.seen).toContain(wild!.species);
    s = until(s, (x) => phase(x) === 'battle', TIMING.appearMs + 100);
    expect(s.save.pendingEncounter).not.toBeNull();
    let saves: string[] = [];
    for (let t = 0; t < TIMING.battlePlaceholderMs + 200 && phase(s) === 'battle'; t += 250) {
      const r = advance(s, 250);
      s = r.state;
      saves = saves.concat(r.saves);
    }
    expect(phase(s)).toBe('walk');
    expect(s.save.pendingEncounter).toBeNull();
    expect(saves).toContain('battle-end');
    expect(s.runtime.toast?.text).toContain('쓰러뜨렸다');
  });

  it('처음 만난 종이면 NEW! (이미 만난 종이면 아님)', () => {
    const { state } = nearSpot(start(), 'wild');
    const met = until(state, (x) => phase(x) === 'appear');
    const species = met.save.pendingEncounter!.kind === 'wild' ? met.save.pendingEncounter!.monster.species : 0;
    expect(met.runtime.stage).toMatchObject({ isNew: !state.save.dex.seen.includes(species) });
    const seenBefore: Save = { ...state.save, dex: { ...state.save.dex, seen: [...state.save.dex.seen, species] } };
    const again = until({ ...state, save: seenBefore }, (x) => phase(x) === 'appear');
    expect(again.runtime.stage).toMatchObject({ isNew: false });
  });

  it('튀어나온 뒤 0.6초 안에 Space → 선제공격 (상대가 기습이면 막아내서 보통) · 늦으면 안 받음', () => {
    const { state } = nearSpot(start(), 'wild');
    const met = until(state, (x) => phase(x) === 'appear');
    const ambush = met.runtime.stage?.phase === 'appear' && met.runtime.stage.ambush;
    const pressed = applyInput(met, { kind: 'space' });
    const fought = until(pressed, (x) => phase(x) === 'battle', TIMING.appearMs + 100);
    expect(fought.save.pendingEncounter).toMatchObject({ start: ambush ? 'normal' : 'preemptive' });

    const late = until(met, (x) => x.runtime.stage?.phase === 'appear' && x.runtime.stage.ms > BALANCE.preemptiveWindowMs, 2000);
    expect(applyInput(late, { kind: 'space' })).toBe(late);
    const notPressed = until(met, (x) => phase(x) === 'battle', TIMING.appearMs + 100);
    expect(notPressed.save.pendingEncounter).toMatchObject({ start: ambush ? 'ambush' : 'normal' });
  });

  it('전투 중에 다시 불러오면 (진행 중 상태 없음) 그 전투부터', () => {
    const { state } = nearSpot(start(), 'wild');
    const met = until(state, (x) => phase(x) === 'battle');
    const reloaded = createGameState(met.save, 3);
    const s = step(reloaded, STEP).state;
    expect(phase(s)).toBe('battle');
    expect(s.save.pendingEncounter).toEqual(met.save.pendingEncounter);
  });
});

describe('길 위의 부탁 (gdd 4.6)', () => {
  it('부탁 자리에서 멈추고 고를 때까지 기다림 (진행 % 는 자리 바로 앞)', () => {
    const { state, spot } = nearSpot(start(), 'request');
    let s = until(state, (x) => phase(x) === 'request');
    expect(prog(s)).toBeLessThan(spot.at);
    expect(prog(s)).toBeGreaterThan(spot.at - 0.001);
    const waited = advance(s, 30_000).state;
    expect(prog(waited)).toBe(prog(s));
    expect(phase(waited)).toBe('request');
    s = applyInput(s, { kind: 'request', help: true });
    expect(s.runtime.stage).toMatchObject({ phase: 'request', result: { ok: expect.any(Boolean) } });
    s = until(s, (x) => phase(x) === 'walk', TIMING.requestResultMs + 100);
    expect(prog(s)).toBe(spot.at);
    // 지나간 부탁은 다시 안 나옴
    expect(phase(advance(s, 2000).state)).toBe('walk');
  });

  it('지나간다 → 보상 없이 곧 다시 걸음', () => {
    const { state } = nearSpot(start(), 'request');
    const s = until(state, (x) => phase(x) === 'request');
    const skipped = applyInput(s, { kind: 'request', help: false });
    expect(skipped.save.bag).toEqual(s.save.bag);
    expect(skipped.save.money).toBe(s.save.money);
    expect(phase(until(skipped, (x) => phase(x) === 'walk', 1000))).toBe('walk');
  });

  it('부탁 중에 꺼도 다시 켜면 그 부탁부터 · 이미 고른 뒤에는 다시 고를 수 없음', () => {
    const { state } = nearSpot(start(), 'request');
    const s = until(state, (x) => phase(x) === 'request');
    const reloaded = until(createGameState(s.save, 3), (x) => phase(x) === 'request', 2000);
    expect(phase(reloaded)).toBe('request');
    const answered = applyInput(s, { kind: 'request', help: true });
    expect(applyInput(answered, { kind: 'request', help: true })).toBe(answered);
  });

  it('고른 뒤 결과를 보는 동안 꺼도 같은 부탁이 다시 나오지 않음 — 보상 두 번 X (bugs, 테스터 · 코드 리뷰어)', () => {
    const { state, spot } = nearSpot(start(), 'request');
    const s = until(state, (x) => phase(x) === 'request');
    for (const help of [true, false]) {
      const answered = applyInput(s, { kind: 'request', help });
      expect(prog(answered)).toBe(spot.at);
      const reloaded = createGameState(answered.save, 9);
      const later = until(reloaded, (x) => phase(x) === 'request' || prog(x) > spot.at + 0.001, 10_000);
      expect(phase(later)).not.toBe('request');
      expect(later.save.bag).toEqual(answered.save.bag);
    }
  });

  it('기다리는 순간 (고르기 전 부탁 · 스테이지 끝) 을 알려 줌 — 안 볼 때 확장이 계산을 멈추게', () => {
    const { state } = nearSpot(start(), 'request');
    const s = until(state, (x) => phase(x) === 'request');
    expect(isWaitingForInput(s)).toBe(true);
    expect(isWaitingForInput(applyInput(s, { kind: 'request', help: true }))).toBe(false);
    expect(isWaitingForInput(start())).toBe(false);
  });
});

describe('다른 쪽에서 온 진행 중 상태 검사 (코드 리뷰어 · 테스터)', () => {
  it('다른 스테이지 것 · 상대 없는 전투 · 길에 없는 부탁 자리는 버리고 세이브를 보고 다시 정함', () => {
    const s = advance(start(), 100).state;
    const other = { ...s, runtime: { ...s.runtime, stageId: 'forest-2' as const, stage: { phase: 'end' as const } } };
    expect(phase(step(other, STEP).state)).toBe('walk');
    const fakeBattle = { ...s, runtime: { ...s.runtime, stage: { phase: 'battle' as const, ms: 2999 } } };
    const r = step(fakeBattle, STEP);
    expect(phase(r.state)).toBe('walk');
    expect(r.save).toBeNull();
    const fakeRequest = { ...s, runtime: { ...s.runtime, stage: { phase: 'request' as const, at: 0.95, number: 0, result: { ok: true, text: 'x', reward: null }, ms: 2499 } } };
    const after = step(fakeRequest, STEP).state;
    expect(prog(after)).toBeLessThan(0.01);
  });
});

describe('처음부터 다시 걷기 (임시) · 나가는 포켓몬', () => {
  it('새 시드로 — 같은 아이템 · 부탁이 다시 나오지 않음 · 시설 자리도 새로', () => {
    let s = start();
    s = { ...s, save: { ...s.save, stages: { 'forest-1': { ...s.save.stages['forest-1']!, progress: 0.99999 } } }, runtime: { ...s.runtime, stage: { phase: 'walk' } } };
    s = until(s, (x) => phase(x) === 'end', 5000);
    const again = applyInput(s, { kind: 'restart-stage' });
    expect(again.save.stages['forest-1']!.seed).not.toBe(s.save.stages['forest-1']!.seed);
    expect(again.save.stages['forest-1']!.facilities).toEqual([]);
    expect(prog(again)).toBe(0);
  });

  it('기습 계산의 "내 스피드" = 쓰러지지 않은 첫 포켓몬 (mvp-spec 3.3)', () => {
    const save = start().save;
    const fainted = { ...save, monsters: { ...save.monsters, m1: { ...save.monsters.m1!, hp: 0 } } };
    expect(leadSpeed(fainted)).not.toBe(leadSpeed(save));
    expect(leadSpeed({ ...save, party: [] })).toBe(0);
  });
});
