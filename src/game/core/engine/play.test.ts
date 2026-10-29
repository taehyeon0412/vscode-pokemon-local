import { describe, expect, it } from 'vitest';
import { BALANCE, TIMING } from '../balance';
import { stageLayout, type Spot } from '../rules/stage';
import { validateSave, type Save } from '../save';
import { sampleSave, viaJson } from '../../../test/fixtures/save';
import { shinyWildSeed } from '../../../test/fixtures/stage';
import { startBattle } from './battle';
import { advance, applyInput, AUTO_HINT_TURN, AUTO_TIP_BACK, AUTO_TIP_TURN, autoTipLeft, isWaitingForInput, RESUME_BATTLE_MSG, resultBagOk, resultThenCard, resumeLine, TEAM_MEET_TIP, teamMeetTipDue, isWalkingFast, leadSpeed, STAGE_WAIT, step, waitReason, withSpeed } from './play';
import { createGameState, readRuntime, STAGE_PHASES, type GameState } from './state';

const STEP = TIMING.simStepMs;

/** 숲 1-1 을 막 시작한 세이브 (시설 자리는 아직 안 적힘) */
function start(seed = 42): GameState {
  const save = sampleSave({ stages: { 'forest-1': { seed, progress: 0, cleared: false, defeatedTrainers: [], facilities: [], run: { startMs: 0, caught: 0, trainers: 0, seen: [], reach: 0, retries: 0 } } }, dex: { seen: [1], caught: [1] } });
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

  it('끝까지 걸으면 S24 클리어 카드에서 멈춤 (단계 9) · 볼 +1 · 깬 표시 · 바로 저장', () => {
    let s = start();
    s = { ...s, save: { ...s.save, stages: { 'forest-1': { ...s.save.stages['forest-1']!, progress: 0.99999 } } }, runtime: { ...s.runtime, stage: { phase: 'walk' } } };
    const balls = s.save.bag['poke-ball'] ?? 0;
    const r = advance(s, 5000);
    s = until(r.state, (x) => phase(x) === 'clear', 5000);
    expect(r.saves).toContain('stage-clear');
    expect(prog(s)).toBe(1);
    expect(s.save.stages['forest-1']!.cleared).toBe(true);
    expect(s.save.bag['poke-ball']).toBe(balls + BALANCE.clearBalls);
    expect(isWaitingForInput(s)).toBe(true);
    // 카드에서 껐다 켜도 카드 그대로 · 보상은 한 번만
    const reloaded = advance(createGameState(viaJson(s.save), 3), 1000).state;
    expect(phase(reloaded)).toBe('clear');
    expect(reloaded.save.bag['poke-ball']).toBe(balls + BALANCE.clearBalls);
  });
});

describe('빨리 걷기 (2026-10-19 태현 님 "걷는 시간이 길어 루즈해")', () => {
  const fast = (s: GameState, on = true): GameState => applyInput(s, { kind: 'fast-walk', on });

  it('켜면 일이 멀리 있을 때 ×3 · 끄면 보통 · 화면도 isWalkingFast 로 앎', () => {
    const s0 = start();
    // 처음 자리 (0) 에서 4초 안에는 일이 없음
    expect(layoutOf(s0).spots.every((x) => x.at > (BALANCE.fastWalkLookMs + 2000) / BALANCE.stageWalkMs)).toBe(true);
    const on = advance(fast(s0), 1000).state;
    expect(prog(on)).toBeCloseTo((1000 * BALANCE.fastWalkSpeed) / BALANCE.stageWalkMs, 8);
    expect(isWalkingFast(on)).toBe(true);
    const off = advance(fast(on, false), 1000).state;
    expect(prog(off) - prog(on)).toBeCloseTo(1000 / BALANCE.stageWalkMs, 8);
    expect(isWalkingFast(off)).toBe(false);
  });

  it('흔적 · 아이템이 0.5초 (보통 걸음, fastWalkLookMs — 2026-10-20 태현 님 4초 → 0.5초) 안에 다가오면 보통 빠르기 · 그보다 멀면 ×3', () => {
    const base = fast(start());
    const spot = layoutOf(base).spots[0]!;
    const at = (aheadMs: number): GameState => ({
      ...base,
      save: { ...base.save, stages: { 'forest-1': { ...base.save.stages['forest-1']!, progress: spot.at - aheadMs / BALANCE.stageWalkMs } } },
      runtime: { ...base.runtime, stage: { phase: 'walk' } },
    });
    expect(BALANCE.fastWalkLookMs).toBe(500);
    const near = at(BALANCE.fastWalkLookMs / 2);
    expect(isWalkingFast(near)).toBe(false);
    const s1 = step(near, STEP).state;
    expect(prog(s1) - prog(near)).toBeCloseTo(STEP / BALANCE.stageWalkMs, 10);
    expect(isWalkingFast(at(BALANCE.fastWalkLookMs * 2))).toBe(true);
  });

  it('동작 줄이기 (게임 설정, 2026-10-20 태현 님) — 기본 꺼짐 · 켜고 끄기 · 세이브에 남음 · 옛 세이브는 꺼짐', () => {
    const s0 = start();
    expect(s0.save.settings.reduceMotion).toBeFalsy();
    const on = applyInput(s0, { kind: 'reduce-motion', on: true });
    expect(on.save.settings.reduceMotion).toBe(true);
    expect(applyInput(on, { kind: 'reduce-motion', on: true })).toBe(on);
    const kept = validateSave(viaJson(on.save));
    expect(kept.ok && kept.save.settings.reduceMotion).toBe(true);
    expect(applyInput(on, { kind: 'reduce-motion', on: false }).save.settings.reduceMotion).toBe(false);
  });

  it('설정은 세이브에 남음 · 옛 세이브 (fastWalk 없음) 는 고친 기록 없이 꺼짐', () => {
    const on = fast(start());
    expect(on.save.settings.fastWalk).toBe(true);
    const kept = validateSave(viaJson(on.save));
    expect(kept.ok && kept.save.settings.fastWalk).toBe(true);
    expect(fast(on)).toBe(on); // 이미 켜져 있으면 그대로
    const old = { ...start().save, settings: { notifications: true, autoBattle: false } } as Save;
    const back = validateSave(viaJson(old));
    expect(back.ok && back.save.settings.fastWalk).toBeFalsy();
    expect(back.ok && back.problems.filter((p) => p.includes('fastWalk'))).toEqual([]);
  });
});

describe('떨어진 아이템 (gdd 4.6)', () => {
  it('지나가면 자동으로 줍고 알림 · 멈추지 않음', () => {
    // 숲 1-1 첫 걷기 안내는 본 뒤 (안내 동안은 알림 시간이 안 흐름 — 디자인 UX 리뷰어)
    const s0 = start();
    const { state, spot } = nearSpot({ ...s0, save: { ...s0.save, tips: [...(s0.save.tips ?? []), 'walk'] } }, 'item');
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
  it('흔적 자리에 오면 튀어나옴 → 만난 종 기록 · 상대는 세이브에 (전투 중에 꺼도 그 전투부터) → 전투 (자동) → 끝나면 걸음 · 바로 저장', () => {
    const s0 = start();
    const { state, spot } = nearSpot({ ...s0, save: { ...s0.save, settings: { ...s0.save.settings, autoBattle: true } } }, 'wild');
    let s = until(state, (x) => phase(x) === 'appear');
    expect(prog(s)).toBe(spot.at);
    const pending = s.save.pendingEncounter;
    expect(pending?.kind).toBe('wild');
    const wild = pending!.kind === 'wild' ? pending!.monster : null;
    expect(s.save.dex.seen).toContain(wild!.species);
    s = until(s, (x) => phase(x) === 'battle', TIMING.appearMs + 100);
    expect(s.save.pendingEncounter).not.toBeNull();
    let saves: string[] = [];
    for (let t = 0; t < 300_000 && phase(s) === 'battle'; t += 250) {
      const r = advance(s, 250);
      s = r.state;
      saves = saves.concat(r.saves);
    }
    // 이기면 S12 결과 (단계 7) → 잠깐 뒤 걸음 (고를 게 있으면 고르기) · 도망 · 지면 알림만
    expect(['result', 'walk']).toContain(phase(s));
    expect(s.save.pendingEncounter).toBeNull();
    expect(saves).toContain('battle-end');
    if (phase(s) === 'result') {
      expect(s.runtime.stage).toMatchObject({ summary: { title: expect.stringMatching(/쓰러뜨렸다/) } });
      s = advance(s, TIMING.resultMs + 100).state;
      expect(['walk', 'choice']).toContain(phase(s));
    } else {
      expect(s.runtime.toast?.text).toMatch(/도망쳤다|깜깜/);
    }
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

  it('튀어나온 순간 Space · 클릭은 아무 일 없음 — 시작 (선제공격 · 기습 · 보통) 은 만날 때 스피드로 정해져 그대로 전투로 (2026-10-21 태현 님)', () => {
    const { state } = nearSpot(start(), 'wild');
    const met = until(state, (x) => phase(x) === 'appear');
    const pending = met.save.pendingEncounter;
    expect(pending?.kind === 'wild' && ['preemptive', 'normal', 'ambush'].includes(pending.start)).toBe(true);
    expect(applyInput(met, { kind: 'space' })).toBe(met);
    const fought = until(met, (x) => phase(x) === 'battle', TIMING.appearMs + 100);
    expect(fought.save.pendingEncounter).toEqual(pending);
    const b = fought.runtime.stage?.phase === 'battle' ? fought.runtime.stage.battle : null;
    const kind = pending?.kind === 'wild' ? pending.start : 'normal';
    expect(b?.msg).toEqual(kind === 'preemptive' ? '선제공격!' : kind === 'ambush' ? '기습당했다!' : expect.stringContaining('가랏'));
  });

  it('스피드 차이로 시작이 정해짐 — 내가 2배 빠르면 선제공격 · 상대가 2배 빠르면 기습 (같은 자리 · 같은 판이면 늘 같음)', () => {
    const { state } = nearSpot(start(), 'wild');
    const lead = state.save.monsters[state.save.party[0]!]!;
    const withSpeed = (pts: number): GameState => ({ ...state, save: { ...state.save, monsters: { ...state.save.monsters, [lead.uid]: { ...lead, points: { ...lead.points, speed: pts } } } } });
    // 랜덤은 자리마다 정해져 있음 — 확률 20% 가 걸리는 자리를 찾을 때까지 판 (retries) 을 바꿔 봄
    const startsAt = (s: GameState) => {
      const met = until(s, (x) => phase(x) === 'appear');
      const p = met.save.pendingEncounter;
      return { start: p?.kind === 'wild' ? p.start : null, met };
    };
    const fast = startsAt(withSpeed(999));
    const slow = startsAt({ ...withSpeed(0), save: { ...withSpeed(0).save, monsters: { ...withSpeed(0).save.monsters, [lead.uid]: { ...lead, level: 1, points: { ...lead.points, speed: 0 } } } } });
    expect(['preemptive', 'normal']).toContain(fast.start);
    expect(['ambush', 'normal']).toContain(slow.start);
    expect(startsAt(withSpeed(999)).start).toBe(fast.start);
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
    const waited = advance(s, TIMING.requestAutoMs - 1000).state;
    expect(prog(waited)).toBe(prog(s));
    expect(waited.runtime.stage).toMatchObject({ phase: 'request', result: null });
    // 10초 뒤 저절로 [도와준다] — 진행 % 는 자리로 (2026-10-21 ideas #115)
    const auto = advance(s, TIMING.requestAutoMs + 200).state;
    expect(auto.runtime.stage).toMatchObject({ phase: 'request', result: { ok: expect.any(Boolean) } });
    expect(prog(auto)).toBe(spot.at);
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

  it('부탁은 기다리지 않음 — 10초 · 안 볼 때 바로 [도와준다] (러너가 부탁 앞에서 멈추면 아무 일도 안 일어남, 2026-10-21 코드 리뷰어)', () => {
    const { state } = nearSpot(start(), 'request');
    const s = until(state, (x) => phase(x) === 'request');
    expect(isWaitingForInput(s)).toBe(false);
    expect(isWaitingForInput(applyInput(s, { kind: 'request', help: true }))).toBe(false);
    expect(isWaitingForInput(start())).toBe(false);
  });
});

describe('다른 쪽에서 온 진행 중 상태 검사 (코드 리뷰어 · 테스터)', () => {
  it('다른 스테이지 것 · 상대 없는 전투 · 길에 없는 부탁 자리는 버리고 세이브를 보고 다시 정함', () => {
    const s = advance(start(), 100).state;
    const other = { ...s, runtime: { ...s.runtime, stageId: 'forest-2' as const, stage: { phase: 'clear' as const } } };
    expect(phase(step(other, STEP).state)).toBe('walk');
    const fakeBattle = { ...s, runtime: { ...s.runtime, stage: { phase: 'battle' as const, battle: startBattle(s.save, s.save.monsters.m2!, 'normal') } } };
    const r = step(fakeBattle, STEP);
    expect(phase(r.state)).toBe('walk');
    expect(r.save).toBeNull();
    const fakeRequest = { ...s, runtime: { ...s.runtime, stage: { phase: 'request' as const, at: 0.95, number: 0, result: { ok: true, text: 'x', reward: null }, ms: 2499 } } };
    const after = step(fakeRequest, STEP).state;
    expect(prog(after)).toBeLessThan(0.01);
  });
});

describe('깬 스테이지 다시 걷기 (#62) · 나가는 포켓몬', () => {
  it('새 시드로 (새 길) — 같은 아이템 · 부탁이 다시 나오지 않음 · 병원 · 상점 자리 · 이긴 트레이너는 그대로', () => {
    let s = start();
    s = { ...s, save: { ...s.save, stages: { 'forest-1': { ...s.save.stages['forest-1']!, progress: 0.99999, defeatedTrainers: ['forest-1:t0'] } } }, runtime: { ...s.runtime, stage: { phase: 'walk' } } };
    s = until(s, (x) => phase(x) === 'clear', 5000);
    const again = applyInput(s, { kind: 'travel', to: 'forest-1' });
    expect(again.save.stages['forest-1']!.seed).not.toBe(s.save.stages['forest-1']!.seed);
    expect(again.save.stages['forest-1']!.facilities).toEqual(s.save.stages['forest-1']!.facilities);
    expect(again.save.stages['forest-1']!.facilities.length).toBeGreaterThan(0);
    expect(again.save.stages['forest-1']!.defeatedTrainers).toEqual(['forest-1:t0']);
    expect(again.save.stages['forest-1']!.cleared).toBe(true);
    expect(prog(again)).toBe(0);
    expect(phase(step(again, STEP).state)).toBe('walk');
  });

  it('기습 계산의 "내 스피드" = 쓰러지지 않은 첫 포켓몬 (mvp-spec 3.3)', () => {
    const save = start().save;
    const fainted = { ...save, monsters: { ...save.monsters, m1: { ...save.monsters.m1!, hp: 0 } } };
    expect(leadSpeed(fainted)).not.toBe(leadSpeed(save));
    expect(leadSpeed({ ...save, party: [] })).toBe(0);
  });
});

describe('전투 (단계 5 · 6) — 스테이지 쪽', () => {
  const withAutoBattle = (s: GameState, on: boolean): GameState => ({ ...s, save: { ...s.save, settings: { ...s.save.settings, autoBattle: on } } });
  const battleOf = (s: GameState) => (s.runtime.stage?.phase === 'battle' ? s.runtime.stage.battle : null);

  it('튀어나온 뒤 전투가 시작되고, 내 차례에는 (자동 전투가 꺼져 있으면) 기다림 — 안 볼 때 확장이 멈추게', () => {
    const { state } = nearSpot(start(), 'wild');
    const fight = until(state, (x) => battleOf(x)?.phase === 'choose', 60_000);
    expect(battleOf(fight)?.phase).toBe('choose');
    expect(isWaitingForInput(fight)).toBe(true);
    expect(isWaitingForInput(withAutoBattle(fight, true))).toBe(false);
    // 기다리는 동안 진행 · 전투는 그대로 (플레이 시간만 흐름)
    const later = advance(fight, 10_000).state;
    expect(battleOf(later)?.phase).toBe('choose');
    expect(prog(later)).toBe(prog(fight));
  });

  it('3:3 처음 안내 — 3:3 을 고를 수 있는 만남에서만 · 본 뒤 (tip-seen team-meet) 엔 안 뜸 (2026-10-22 태현 님 "추천안")', () => {
    const s = start();
    expect(teamMeetTipDue(s)).toBe(false);
    expect(TEAM_MEET_TIP).toBe('team-meet');
    expect(teamMeetTipDue(applyInput(s, { kind: 'tip-seen', id: TEAM_MEET_TIP }))).toBe(false);
  });

  it('전투 중에 껐다 켜면 그 전투를 처음부터 — 첫 말 "다시 켜서 전투를 처음부터!" (기획 R15 A)', () => {
    const { state } = nearSpot(start(), 'wild');
    const met = until(state, (x) => battleOf(x) !== null);
    const reopened = createGameState(viaJson(met.save), 9);
    const again = step(reopened, STEP).state;
    // 말 칸 (msg) 과 따로 — 선제 · 기습 · 관장 · 3:3 · 좁은 패널에서 0 장면이던 것 (UX 리뷰어 R15)
    expect(resumeLine(again)).toBe(RESUME_BATTLE_MSG);
    expect(battleOf(again)?.msg).not.toBe(RESUME_BATTLE_MSG);
    expect(battleOf(again)?.foe.species).toBe(battleOf(met)?.foe.species);
    // 보는 동안 2초 (밖 · 숨김은 아래 #133) · 넘기기에도 남음 · 이어진 전투 (넘겨받은 상태) 에는 안 생김
    expect(readRuntime(viaJson(again.runtime), 1).resumed).toBe(again.runtime.resumed);
    const seen = advance(again, TIMING.resumeLineMs + 100).state;
    expect(resumeLine(seen)).toBeNull();
    expect(step(met, STEP).state.runtime.resumed).toBeUndefined();
  });

  it('"다시 켜서 …" — 밖 · 숨김이어도 전투가 흐르면 같이 셈 · 내 차례를 기다리는 동안만 남음 · 첫 기술이 나가면 지움 · 힘겨루기 · 필살기 · 결과 동안 숨김 (#133 — 전투 내내 남던 것)', () => {
    const { state } = nearSpot(start(), 'wild');
    const met = until(state, (x) => battleOf(x) !== null);
    const reopen = (auto: boolean) => step(withAutoBattle(createGameState(viaJson(met.save), 9), auto), STEP).state;
    const away = (s: GameState): GameState => ({ ...s, runtime: { ...s.runtime, away: true } });
    const auto = reopen(true);
    expect(resumeLine(auto)).toBe(RESUME_BATTLE_MSG);
    // 밖 (다른 창을 누른 채 봄) · 숨김 (확장이 계산) + 자동 전투 — 전투가 흐르니 2초 안에 지움
    expect(resumeLine(advance(away(auto), TIMING.resumeLineMs + STEP).state)).toBeNull();
    expect(resumeLine(advance({ ...auto, runtime: { ...auto.runtime, headless: true } }, TIMING.resumeLineMs + STEP).state)).toBeNull();
    // 숨김 (그릴 화면이 없음) + 첫 기술 — 늦어도 그때 지움 (2초를 다 기다리지 않음)
    const hiddenActed = until({ ...auto, runtime: { ...auto.runtime, headless: true } }, (x) => battleOf(x)?.phase === 'anim', 10_000);
    expect(battleOf(hiddenActed)?.phase).toBe('anim');
    expect(hiddenActed.runtime.resumed).toBeUndefined();
    // 보는 중 · 밖 (포커스만 없음 — 패널은 보임) 첫 기술 — 1.2초는 보인 뒤에 지움 (U1 · 밖에서 0.1 ~ 0.35초 번쩍이던 것 — UX 3)
    for (const s0 of [auto, away(auto)]) {
      const acted = until(s0, (x) => battleOf(x)?.phase === 'anim', 10_000);
      const shown = TIMING.resumeLineMs - (acted.runtime.resumed ?? 0);
      expect(acted.runtime.resumed === undefined ? shown : shown < TIMING.resumeLineMinMs).toBeTruthy();
      expect(advance(acted, TIMING.resumeLineMinMs).state.runtime.resumed).toBeUndefined();
    }
    // 밖 + 내 차례 기다림 (자동 꺼짐) — 멈춘 동안은 남음 (돌아와 보면 그때부터 셈)
    const turn = until(reopen(false), (x) => battleOf(x)?.phase === 'choose');
    expect(isWaitingForInput(turn)).toBe(true);
    const waiting = away({ ...turn, runtime: { ...turn.runtime, resumed: 1500 } });
    expect(advance(waiting, 5000).state.runtime.resumed).toBe(1500);
    expect(advance({ ...waiting, runtime: { ...waiting.runtime, away: false } }, 1600).state.runtime.resumed).toBeUndefined();
    // 힘겨루기 · 필살기 · 반격 · 결과 동안은 숨김 (컷인 이름 · 큰 글을 가리지 않게 — U1) · 시간은 그대로 셈
    const b = battleOf(auto)!;
    const as = (patch: Partial<typeof b>): GameState => ({ ...auto, runtime: { ...auto.runtime, stage: { phase: 'battle', battle: { ...b, ...patch } } } });
    expect(resumeLine(as({ phase: 'clash' }))).toBeNull();
    expect(resumeLine(as({ phase: 'over' }))).toBeNull();
    expect(resumeLine(as({ phase: 'anim', anim: { side: 'foe', action: { kind: 'ult' }, ms: 0, dur: 1000, counter: false } }))).toBeNull();
    expect(resumeLine(as({ phase: 'anim', anim: { side: 'me', action: { kind: 'attack' }, ms: 0, dur: 1000, counter: false } }))).toBe(RESUME_BATTLE_MSG);
    // 밖에서 이로치 앞에 멈춤 — 같은 자리 기다림 한 줄이 먼저 (칩은 숨고 시간도 멈춤 → 돌아오면 그대로 — UX 2)
    const shiny = away(as({ foe: { ...b.foe, shiny: true } }));
    expect(waitReason(shiny)).toBe('shiny');
    expect(resumeLine(shiny)).toBeNull();
    expect(advance(shiny, 3000).state.runtime.resumed).toBe(auto.runtime.resumed);
  });

  it('메뉴 입력 → 전투가 이어짐 · 전투가 아닐 때 전투 입력은 무시', () => {
    const { state } = nearSpot(start(), 'wild');
    const fight = until(state, (x) => battleOf(x)?.phase === 'choose', 60_000);
    const acted = applyInput(fight, { kind: 'battle', input: { kind: 'act', action: { kind: 'attack' } } });
    expect(battleOf(acted)?.phase).toBe('anim');
    const walking = start();
    expect(applyInput(walking, { kind: 'battle', input: { kind: 'ult' } })).toBe(walking);
  });

  it('⑫ 자동 전투 스위치 = 세이브 설정 (같은 값이면 그대로)', () => {
    const s = start();
    const on = applyInput(s, { kind: 'auto-battle', on: true });
    expect(on.save.settings.autoBattle).toBe(true);
    expect(applyInput(on, { kind: 'auto-battle', on: true })).toBe(on);
    expect(applyInput(on, { kind: 'auto-battle', on: false }).save.settings.autoBattle).toBe(false);
  });

  it('안 볼 때 (확장이 계산) 이로치 흔적 바로 앞에서 멈추고 알림 신호 → 다시 보이면 그 흔적으로 걸어가 만남 (U9)', () => {
    const { seed, spot } = shinyWildSeed();
    const base = start(seed);
    const near: GameState = {
      ...base,
      save: { ...base.save, stages: { 'forest-1': { ...base.save.stages['forest-1']!, progress: spot.at - 0.0005 } } },
      runtime: { ...base.runtime, stage: { phase: 'walk' }, headless: true },
    };
    const r = advance(near, 3000);
    expect(phase(r.state)).toBe('hold');
    expect(r.notices).toEqual(['shiny']);
    expect(prog(r.state)).toBeLessThan(spot.at);
    expect(isWaitingForInput(r.state)).toBe(true);
    const shown = { ...r.state, runtime: { ...r.state.runtime, headless: false } };
    const met = until(shown, (x) => phase(x) === 'appear', 5000);
    expect(met.save.pendingEncounter).toMatchObject({ kind: 'wild', monster: { shiny: true } });
  });

  it('VS Code 에 포커스가 없을 때 (패널은 보이고 웹뷰가 계산, away) 도 이로치 흔적 앞에서 멈추고 알림 → 돌아오면 이어 감 (2026-10-19)', () => {
    const { seed, spot } = shinyWildSeed();
    const base = start(seed);
    const near: GameState = {
      ...base,
      save: { ...base.save, stages: { 'forest-1': { ...base.save.stages['forest-1']!, progress: spot.at - 0.0005 } } },
      runtime: { ...base.runtime, stage: { phase: 'walk' }, headless: false, away: true },
    };
    const r = advance(near, 3000);
    expect(phase(r.state)).toBe('hold');
    expect(r.notices).toEqual(['shiny']);
    const back = { ...r.state, runtime: { ...r.state.runtime, away: false } };
    const met = until(back, (x) => phase(x) === 'appear', 5000);
    expect(met.save.pendingEncounter).toMatchObject({ kind: 'wild', monster: { shiny: true } });
  });

  it('보일 때는 이로치 흔적에서 멈추지 않고 바로 만남 · 부탁 알림은 안 볼 때만', () => {
    const { seed, spot } = shinyWildSeed();
    const base = start(seed);
    const near: GameState = { ...base, save: { ...base.save, stages: { 'forest-1': { ...base.save.stages['forest-1']!, progress: spot.at - 0.0005 } } }, runtime: { ...base.runtime, stage: { phase: 'walk' } } };
    const r = advance(near, 3000);
    expect(phase(r.state)).not.toBe('hold');
    expect(r.notices).toEqual([]);
    const { state } = nearSpot(start(), 'request');
    expect(advance(state, 3000).notices).toEqual([]);
    // 안 볼 때도 알림 없이 바로 [도와준다] (2026-10-21 ideas #115 — 예전엔 알림 · 고를 때까지 멈춤)
    const away = advance({ ...state, runtime: { ...state.runtime, headless: true } }, 3000);
    expect(away.notices).toEqual([]);
    const st = away.state.runtime.stage;
    expect(st?.phase === 'request' ? st.result : 'walked').not.toBeNull();
  });
});

describe('단계 5 · 6 검토에서 고친 것 — 안 볼 때 이로치 (bugs #104 ~)', () => {
  it('안 볼 때 눈앞에 이로치가 나와 있으면 (튀어나옴 · 전투 중에 떠남) 자동 전투로 쓰러뜨리지 않고 기다림 (코드 리뷰어)', () => {
    const { state } = nearSpot(start(), 'wild');
    const met = until(state, (x) => phase(x) === 'battle');
    const pending = met.save.pendingEncounter!;
    const shinySave = { ...met.save, settings: { ...met.save.settings, autoBattle: true }, pendingEncounter: pending.kind === 'wild' ? { ...pending, monster: { ...pending.monster, shiny: true } } : pending };
    const battle = met.runtime.stage?.phase === 'battle' ? met.runtime.stage.battle : null;
    const away: GameState = { save: shinySave, runtime: { ...met.runtime, headless: true, stage: { phase: 'battle', battle: { ...battle!, foe: { ...battle!.foe, shiny: true } } } } };
    expect(isWaitingForInput(away)).toBe(true);
    const later = advance(away, 5000).state;
    expect(later.runtime.stage).toEqual(away.runtime.stage);
    // 다시 보면 이어서
    expect(isWaitingForInput({ ...away, runtime: { ...away.runtime, headless: false } })).toBe(false);
  });
});

describe('S12 결과 · S23 · S22 — 스테이지 쪽 (단계 7)', () => {
  const choiceSave = (s: GameState): GameState => ({
    ...s,
    save: { ...s.save, pendingChoices: [{ kind: 'learn', uid: 'm1', moveId: 22 }, { kind: 'evolve', uid: 'm1', to: 2, newMoves: [75, 76], level: 16, item: null }] },
    runtime: { ...s.runtime, stage: { phase: 'choice', ms: 0 } },
  });

  it('고를 것이 있으면 기다림 (안 볼 때 확장은 멈춤) · 하나 고르면 다음 · 다 고르면 걸음', () => {
    let s = choiceSave(start());
    expect(isWaitingForInput(s)).toBe(true);
    expect(phase(advance(s, 10_000).state)).toBe('choice');
    s = applyInput(s, { kind: 'learn', replace: null });
    expect(s.save.pendingChoices[0]?.kind).toBe('evolve');
    // 진화는 "어…? ○○의 모습이…!" 에서 기다림 — 시간이 가도 시작 안 함 · 고르기 · 멈추기 없음 · Space (클릭 = evolve-watch) 로 시작 (2026-10-21 ideas #33)
    expect(s.runtime.stage).toEqual({ phase: 'choice', ms: -1 });
    expect(advance(s, 10_000).state.runtime.stage).toEqual({ phase: 'choice', ms: -1 });
    expect(applyInput(s, { kind: 'evolve', keep: [33] })).toBe(s);
    expect(applyInput(s, { kind: 'evolve-cancel' })).toBe(s);
    expect(applyInput(s, { kind: 'evolve-watch' }).runtime.stage).toEqual({ phase: 'choice', ms: 0 });
    s = applyInput(s, { kind: 'space' });
    expect(s.runtime.stage).toEqual({ phase: 'choice', ms: 0 });
    expect(applyInput(s, { kind: 'evolve-watch' })).toBe(s);
    // 진화: 연출이 끝나기 전에는 남길 기술을 못 고름 · Space 로 빨리 넘김 · 연출 중 Esc = 멈추기
    expect(applyInput(s, { kind: 'evolve', keep: [33] })).toBe(s);
    // 연출 시작 0.8초 동안은 Space · Esc 를 안 받음 (결과에서 Space 를 두 번 눌러 연출을 놓치지 않게 — 플레이 리뷰어)
    expect(applyInput(s, { kind: 'space' })).toBe(s);
    expect(applyInput(s, { kind: 'evolve-cancel' })).toBe(s);
    s = { ...s, runtime: { ...s.runtime, stage: { phase: 'choice', ms: TIMING.evolveGuardMs } } };
    const skipped = applyInput(s, { kind: 'space' });
    expect(skipped.runtime.stage).toEqual({ phase: 'choice', ms: TIMING.evolveAnimMs });
    const evolved = applyInput(skipped, { kind: 'evolve', keep: [33] });
    expect(evolved.save.monsters.m1!.species).toBe(2);
    expect(phase(evolved)).toBe('walk');
    const cancelled = applyInput(s, { kind: 'evolve-cancel' });
    expect(cancelled.save.monsters.m1!.species).toBe(1);
    expect(cancelled.runtime.toast?.text).toContain('진화를 멈췄다');
    // 다른 고르기를 보던 화면의 입력은 안 받음 (두 번 누름)
    expect(applyInput(s, { kind: 'evolve-cancel', uid: 'm2' })).toBe(s);
    expect(applyInput(skipped, { kind: 'evolve-cancel' })).toBe(skipped);
  });

  it('잡았으면 결과 상자 전에 소개 카드 1.5초 — 결과는 그만큼 더 길고, Space · Enter 는 먼저 소개만 넘김 (2026-10-20 태현 님 안 2)', () => {
    const base = start();
    const summary = { title: '야생 구구를 잡았다!', exp: [], money: 0, item: null, caught: { name: '구구', toBox: false, uid: 'm1', isNew: true }, learned: [], choices: 0, badge: null };
    const result: GameState = { ...base, runtime: { ...base.runtime, stageId: 'forest-1', stage: { phase: 'result', summary, ms: 0 } } };
    expect(phase(advance(result, TIMING.resultMs + 100).state)).toBe('result');
    expect(phase(advance(result, TIMING.resultMs + TIMING.caughtIntroMs + 100).state)).toBe('walk');
    const skipped = applyInput(result, { kind: 'space' });
    expect(skipped.runtime.stage).toMatchObject({ phase: 'result', ms: TIMING.caughtIntroMs });
    expect(phase(applyInput(skipped, { kind: 'result-continue' }))).toBe('walk');
  });

  it('결과 상자 B = 계속 + 가방 (ideas 1656) — 소개 카드 뒤 · 계속하면 걷기일 때만 · 고르기 · 클리어 카드 · 관장 카드로 이어지면 아님', () => {
    const base = start();
    const summary = { title: '야생 구구를 잡았다!', exp: [], money: 0, item: null, caught: { name: '구구', toBox: false, uid: 'm1', isNew: true }, learned: [], choices: 0, badge: null };
    const result: GameState = { ...base, runtime: { ...base.runtime, stageId: 'forest-1', stage: { phase: 'result', summary, ms: 0 } } };
    // 소개 카드 동안은 아님 (B 를 눌러도 소개만 넘기지 않음) · 상자가 보이면 됨
    expect(resultBagOk(result)).toBe(false);
    const box = applyInput(result, { kind: 'space' });
    expect(resultBagOk(box)).toBe(true);
    // 잡지 않은 결과는 처음부터
    expect(resultBagOk({ ...result, runtime: { ...result.runtime, stage: { phase: 'result', summary: { ...summary, caught: null }, ms: 0 } } })).toBe(true);
    // 계속하면 기술 · 진화 고르기 — 가방을 못 엶
    expect(resultBagOk({ ...box, save: { ...box.save, pendingChoices: [{ kind: 'learn', uid: 'm1', moveId: 22 }] } })).toBe(false);
    // 스테이지 끝 (클리어 카드) · 관장 카드로 이어짐
    const done = { ...box.save, stages: { ...box.save.stages, 'forest-1': { ...box.save.stages['forest-1']!, progress: 1 } } };
    expect(resultBagOk({ ...box, save: done })).toBe(false);
    const st = box.runtime.stage!;
    if (st.phase !== 'result') throw new Error('result');
    expect(resultBagOk({ ...box, runtime: { ...box.runtime, stage: { ...st, then: 'badge' } } })).toBe(false);
    // 결과가 아니면 아님 · 계속한 뒤 (걷기) 는 가방이 열림 (main.ts 가 이어서 open)
    expect(resultBagOk(base)).toBe(false);
    expect(phase(applyInput(box, { kind: 'result-continue' }))).toBe('walk');
    // 다시 이긴 관장 카드 (again) · 체육관 대기실로 돌아가는 결과 (테스터 빈 곳)
    expect(resultBagOk({ ...box, runtime: { ...box.runtime, stage: { ...st, then: 'again' } } })).toBe(false);
    expect(resultBagOk({ ...box, save: { ...box.save, location: { screen: 'gym' } } })).toBe(true);
    // 계속하면 클리어 · 관장 카드 = "다음 스테이지에서 [B] 가방" (그 카드에서도 B 가 안 먹음 — bugs 1897) · 걷기 · 고르기 · 대기실은 아님
    expect(resultThenCard({ ...box, save: done })).toBe(true);
    expect(resultThenCard({ ...box, runtime: { ...box.runtime, stage: { ...st, then: 'badge' } } })).toBe(true);
    expect(resultThenCard({ ...box, runtime: { ...box.runtime, stage: { ...st, then: 'again' } } })).toBe(true);
    expect(resultThenCard(box)).toBe(false);
    expect(resultThenCard({ ...box, save: { ...box.save, pendingChoices: [{ kind: 'learn', uid: 'm1', moveId: 22 }] } })).toBe(false);
    expect(resultThenCard({ ...box, save: { ...box.save, location: { screen: 'gym' } } })).toBe(false);
    expect(resultThenCard(base)).toBe(false);
  });

  it('고르다 껐다 켜면 그 고르기부터 (세이브에 남아 있음)', () => {
    const s = choiceSave(start());
    const reloaded = step(createGameState(viaJson(s.save), 5), STEP).state;
    expect(phase(reloaded)).toBe('choice');
  });

  it('결과는 잠깐 보여 주고 (Space · Enter 로 넘김) → 고를 게 있으면 고르기 · 안 볼 때면 알림', () => {
    const base = start();
    const summary = { title: 't', exp: [], money: 0, item: null, caught: null, learned: [], choices: 0, badge: null };
    const result: GameState = { ...base, runtime: { ...base.runtime, stageId: 'forest-1', stage: { phase: 'result', summary, ms: 0 } } };
    expect(phase(applyInput(result, { kind: 'space' }))).toBe('walk');
    expect(phase(advance(result, TIMING.resultMs + 100).state)).toBe('walk');
    const withChoice: GameState = { ...result, save: { ...result.save, pendingChoices: [{ kind: 'learn', uid: 'm1', moveId: 22 }] }, runtime: { ...result.runtime, headless: true } };
    const r = advance(withChoice, TIMING.resultMs + 100);
    expect(phase(r.state)).toBe('choice');
    expect(r.notices).toEqual(['choice']);
    // 고를 것이 남은 세이브를 안 볼 때 처음 불러와도 한 번 알림
    const fresh = createGameState(withChoice.save, 3);
    expect(advance({ ...fresh, runtime: { ...fresh.runtime, headless: true } }, 500).notices).toEqual(['choice']);
  });

  it('결과 · 고르기 진행 중 상태도 확장 ↔ 웹뷰로 (모양이 이상하면 버림)', () => {
    const summary = { title: '야생 구구를 쓰러뜨렸다!', exp: [{ uid: 'm1', name: '이상해씨', gain: 28, from: 5, to: 6 }], money: 20, item: '몬스터볼', caught: null, learned: [], choices: 0, badge: null };
    expect(readRuntime({ rngState: 1, stepAccMs: 0, stage: { phase: 'result', summary, ms: 10 } }, 1).stage).toEqual({ phase: 'result', summary, ms: 10 });
    expect(readRuntime({ rngState: 1, stepAccMs: 0, stage: { phase: 'result', summary: { title: 3 }, ms: 10 } }, 1).stage).toBeNull();
    expect(readRuntime({ rngState: 1, stepAccMs: 0, stage: { phase: 'choice', ms: 100 } }, 1).stage).toEqual({ phase: 'choice', ms: 100 });
  });
});
describe('고를 것이 남았는데 걷기 상태가 오면 (단계 7 테스터)', () => {
  it('걷지 않고 고르기부터', () => {
    const base = start();
    const s: GameState = { ...base, save: { ...base.save, pendingChoices: [{ kind: 'learn', uid: 'm1', moveId: 22 }] }, runtime: { ...base.runtime, stageId: 'forest-1', stage: { phase: 'walk' } } };
    const next = step(s, STEP).state;
    expect(phase(next)).toBe('choice');
    expect(prog(next)).toBe(prog(s));
  });
});

describe('멈춤 · 알림 표 (gdd 4.13 · U6 — orders #27 R13)', () => {
  const away = (s: GameState): GameState => ({ ...s, runtime: { ...s.runtime, away: true } });
  const at = (s: GameState, stage: NonNullable<GameState['runtime']['stage']>, save: Partial<Save> = {}): GameState => ({ ...s, save: { ...s.save, ...save }, runtime: { ...s.runtime, stageId: 'forest-1', stage } });

  it('알림 시간은 보는 동안만 셈 — 밖 · 숨김에서 흘러가 돌아오면 없던 것 (디자인팀 UX #27 큼 1) · 숲 1-1 첫 걷기 안내 동안도 안 흐름', () => {
    const s0 = start();
    // 첫 걷기 안내 (tips 에 walk 없음) 동안은 보통 알림 시간도 안 흐름 — 안내 상자 뒤에 깔린 채 다 쓰던 것 (디자인 UX 리뷰어)
    const underTip = advance({ ...s0, runtime: { ...s0.runtime, toast: { text: '오늘의 목표 ✓', ms: 1000 } } }, 600).state;
    expect(underTip.runtime.toast?.ms).toBe(1000);
    const base = { ...s0, save: { ...s0.save, tips: [...(s0.save.tips ?? []), 'walk'] } };
    const toasted: GameState = { ...base, runtime: { ...base.runtime, toast: { text: '클리어 보상!', ms: 1000 } } };
    const awayLater = advance(away(toasted), 5000).state;
    expect(awayLater.runtime.toast).toMatchObject({ text: '클리어 보상!', ms: 1000 });
    const hiddenLater = advance({ ...toasted, runtime: { ...toasted.runtime, headless: true } }, 5000).state;
    expect(hiddenLater.runtime.toast?.text).toBe('클리어 보상!');
    const back = advance({ ...awayLater, runtime: { ...awayLater.runtime, away: false } }, 600).state;
    expect(back.runtime.toast?.ms).toBeLessThanOrEqual(400);
  });

  it('장면마다 표에 줄이 있음 (flow · wait · entered) — 새 장면을 만들면 STAGE_WAIT 와 gdd 4.13 에 먼저', () => {
    for (const p of STAGE_PHASES) expect(['flow', 'wait', 'entered']).toContain(STAGE_WAIT[p]);
    expect(Object.keys(STAGE_WAIT).sort()).toEqual([...STAGE_PHASES].sort());
  });

  it('밖 (VS Code 포커스 없음) 에서 기다리면 한 번 알림 · 같은 기다림은 보고 다시 떠나도 한 번 · 기다림이 풀리면 다음 기다림을 알림', () => {
    const base = start();
    const mon = { ...base.save.monsters[base.save.party[0]!]!, uid: 'w', caughtAt: 'forest-1' as const };
    const wild = startBattle(base.save, mon, 'normal');
    const myTurn = at(base, { phase: 'battle', battle: { ...wild, phase: 'choose', me: { ...wild.me, gauge: 1 } } }, { pendingEncounter: { kind: 'wild', monster: mon, start: 'normal' } });
    const r = advance(away(myTurn), 500);
    expect(r.notices).toEqual(['battle']);
    expect(r.state.runtime.noticed).toBe('battle');
    expect(advance(r.state, 500).notices).toEqual([]);
    // 같은 기다림 (그 내 차례) 은 보고 다시 떠나도 다시 안 알림 (탭을 오갈 때마다 쌓이던 것 — 2026-10-21 태현 님 "추천안")
    const seen = advance({ ...r.state, runtime: { ...r.state.runtime, away: false } }, 100).state;
    expect(seen.runtime.noticed).toBe('battle');
    expect(advance(away(seen), 100).notices).toEqual([]);
    // 고르면 (기다림이 풀림) 지움 → 다음 기다림은 다시 알림
    const acted = advance(applyInput(seen, { kind: 'battle', input: { kind: 'act', action: { kind: 'attack' } } }), 100).state;
    expect(acted.runtime.noticed).toBeUndefined();
    // 보는 중이면 알림 없음 · 자동 전투면 기다리지 않음
    expect(advance(myTurn, 500).notices).toEqual([]);
    expect(waitReason(away({ ...myTurn, save: { ...myTurn.save, settings: { ...myTurn.save.settings, autoBattle: true } } }))).toBeNull();
  });

  it('기다리는 장면마다 이유 — 고르기 · 패배 두 번째 · 클리어 (자동 꺼짐) · 대기실 · 배지 · 이로치 (전투 중 떠남) · 병원 안은 알림 없음', () => {
    const base = start();
    const choice = at(base, { phase: 'choice', ms: 0 }, { pendingChoices: [{ kind: 'learn', uid: base.save.party[0]!, moveId: 22 }] });
    expect(advance(away(choice), 200).notices).toEqual(['choice']);
    const twice = { ...base.save.stages, 'forest-1': { ...base.save.stages['forest-1']!, run: { ...base.save.stages['forest-1']!.run, retries: 2 } } };
    expect(advance(away(at(base, { phase: 'defeat', gym: false, lost: 0 }, { stages: twice })), 200).notices).toEqual(['defeat']);
    expect(advance(away(at(base, { phase: 'defeat', gym: false, lost: 0 })), 200).notices).toEqual([]);
    const done = { ...base.save.stages, 'forest-1': { ...base.save.stages['forest-1']!, progress: 1 } };
    expect(advance(away(at(base, { phase: 'clear' }, { stages: done })), 200).notices).toEqual(['clear']);
    const gym = { ...base, save: { ...base.save, location: { screen: 'gym' as const } }, runtime: { ...base.runtime, stage: { phase: 'lobby' as const }, stageId: null } };
    expect(advance(away(gym), 200).notices).toEqual(['gym']);
    expect(advance(away({ ...gym, runtime: { ...gym.runtime, stage: { phase: 'badge' as const } } }), 200).notices).toEqual(['badge']);
    // 다시 이긴 카드 + 자동 = 밖에서도 대기실로 넘어가니 알림 없음 · 자동이 아니면 기다림 알림 (#130)
    const againCard = { ...gym, runtime: { ...gym.runtime, stage: { phase: 'badge' as const, again: true as const } } };
    expect(advance(away({ ...againCard, save: { ...againCard.save, settings: { ...againCard.save.settings, autoBattle: true } } }), 200).notices).toEqual([]);
    expect(advance(away({ ...againCard, save: { ...againCard.save, settings: { ...againCard.save.settings, autoBattle: false } } }), 200).notices).toEqual(['badge']);
    // 다시 이긴 카드 + 자동 — 숨김 (멈춤 · 알림) → 봄 (셈 · 기다림 아님) → 다시 숨김 = 알림은 한 번 (숨길 때마다 쌓이던 것 — 테스터)
    const hide = (g: GameState, on: boolean): GameState => ({ ...g, runtime: { ...g.runtime, headless: on } });
    const againAuto = { ...againCard, save: { ...againCard.save, settings: { ...againCard.save.settings, autoBattle: true } } };
    const h1 = advance(hide(againAuto, true), 200);
    const seen = advance(hide(h1.state, false), 2000);
    const h2 = advance(hide(seen.state, true), 200);
    expect([h1.notices, seen.notices, h2.notices]).toEqual([['badge'], [], []]);
    const sm = { ...base.save.monsters[base.save.party[0]!]!, uid: 'w', shiny: true, caughtAt: 'forest-1' as const };
    const shiny = startBattle(base.save, sm, 'normal');
    expect(advance(away(at(base, { phase: 'battle', battle: shiny }, { pendingEncounter: { kind: 'wild', monster: sm, start: 'normal' } })), 200).notices).toEqual(['shiny']);
    const inside = at(base, { phase: 'facility', kind: 'hospital', at: 0.3, ms: 0, inside: true });
    expect(isWaitingForInput(inside)).toBe(true);
    expect(waitReason(away(inside))).toBeNull();
    expect(STAGE_WAIT.facility).toBe('entered');
  });

  it('자동 전투 첫 안내 (R12 A) — 내 차례 10초 · 멈췄다 다시 볼 때 · 자동을 한 번 켤 때까지 최대 3번', () => {
    const base = start();
    const mon = { ...base.save.monsters[base.save.party[0]!]!, uid: 'w', caughtAt: 'forest-1' as const };
    const wild = startBattle(base.save, mon, 'normal');
    const myTurn = at(base, { phase: 'battle', battle: { ...wild, phase: 'choose' } }, { pendingEncounter: { kind: 'wild', monster: mon, start: 'normal' } });
    const tipOf = (s: GameState) => s.runtime.toast?.text ?? '';
    const seen = (s: GameState) => (s.save.tips ?? []).filter((t) => t.startsWith('autotip-'));
    // 9.9초는 아직 · 10초를 넘는 첫 때 · 내 차례가 끝날 때까지 남음 (5초 만에 사라지던 것 — UX 리뷰어)
    const early = advance(myTurn, TIMING.autoTipWaitMs - 100).state;
    expect(tipOf(early)).not.toContain('[A] 자동 전투');
    const tipped = advance(early, 200).state;
    expect(tipOf(tipped)).toBe(AUTO_TIP_TURN);
    expect(tipped.runtime.toast?.kind).toBe('auto-tip');
    expect(readRuntime(viaJson(tipped.runtime), 1).toast?.kind).toBe('auto-tip');
    expect(tipOf(advance(tipped, 30_000).state)).toBe(AUTO_TIP_TURN);
    const acted = applyInput(tipped, { kind: 'battle', input: { kind: 'act', action: { kind: 'attack' } } });
    expect(tipOf(advance(acted, 100).state)).not.toBe(AUTO_TIP_TURN);
    // 셈은 화면이 그렸을 때만 ('tip-seen' auto — 전투 화면이 안 그린 채 세 번이 끝나던 것, UX 리뷰어) · 옛 'auto-1' ~ 은 안 셈
    expect(seen(tipped)).toEqual([]);
    const counted = applyInput(tipped, { kind: 'tip-seen', id: 'auto' });
    expect(seen(counted)).toEqual(['autotip-1']);
    expect(autoTipLeft({ ...base.save, tips: ['auto-1', 'auto-2', 'auto-3'] })).toBe(true);
    // 밖에서는 안 띄움
    expect(tipOf(advance(away(myTurn), 20_000).state)).not.toBe(AUTO_TIP_TURN);
    // 첫 안내 세 번이 지난 뒤에도 30초 넘게 기다리면 짧은 한 줄 (ideas 158) · 그 차례 끝까지 · 고르면 지움
    const used = { ...myTurn, save: { ...myTurn.save, tips: ['autotip-1', 'autotip-2', 'autotip-3'] } };
    expect(autoTipLeft(used.save)).toBe(false);
    const quiet = advance(used, TIMING.autoHintWaitMs - 100).state;
    expect(tipOf(quiet)).not.toContain('[A] 자동 전투');
    const hinted = advance(quiet, 200).state;
    expect(tipOf(hinted)).toBe(AUTO_HINT_TURN);
    expect(tipOf(advance(hinted, 20_000).state)).toBe(AUTO_HINT_TURN);
    expect(tipOf(advance(applyInput(hinted, { kind: 'battle', input: { kind: 'act', action: { kind: 'attack' } } }), 100).state)).not.toBe(AUTO_HINT_TURN);
    // 첫 안내가 떠 있는 차례엔 그대로 (30초에 바꿔 끼우지 않음)
    expect(tipOf(advance(tipped, TIMING.autoHintWaitMs).state)).toBe(AUTO_TIP_TURN);
    // 자동 꺼짐으로 멈췄다 (확장이 'paused' 알림) 다시 보면 한 번 — 그동안 요약 (R14) 은 그 뒤에
    // 그동안 요약이 먼저 · ② 는 요약이 끝난 뒤 따로 (겹치지 않게)
    const seenWalk = { ...base, save: { ...base.save, tips: [...(base.save.tips ?? []), 'walk'] } };
    const summary = advance({ ...seenWalk, runtime: { ...seenWalk.runtime, noticed: 'paused', awayLog: { money: 0, bag: {}, wild: 2 } } }, 100).state;
    expect(tipOf(summary)).toContain('그동안');
    expect(tipOf(summary)).not.toContain(AUTO_TIP_BACK);
    expect(summary.runtime.backTip).toBe(true);
    expect(tipOf(advance(summary, TIMING.awaySummaryMs + 200).state)).toBe(AUTO_TIP_BACK);
    // 숲 1-1 첫 걷기 안내가 떠 있는 동안은 요약도 ② 도 기다림 (그 상자 밑에 깔림 — #34 UX 리뷰어) — 안내를 본 뒤 요약
    const walkFirst = advance({ ...base, runtime: { ...base.runtime, noticed: 'paused', awayLog: { money: 0, bag: {}, wild: 2 } } }, 100).state;
    expect(tipOf(walkFirst) ?? '').not.toContain('그동안');
    expect(tipOf(walkFirst)).not.toBe(AUTO_TIP_BACK);
    expect(walkFirst.runtime.awayLog).toBeDefined();
    expect(walkFirst.runtime.backTip).toBe(true);
    const afterWalk = advance({ ...walkFirst, save: { ...walkFirst.save, tips: [...(walkFirst.save.tips ?? []), 'walk'] } }, 100).state;
    expect(tipOf(afterWalk)).toContain('그동안');
    // 요약이 없으면 자동 스위치 옆 안내 — 숲 1-1 첫 걷기 안내가 떠 있는 동안은 뒤로 (화면 walkTipOn 과 같게)
    const firstWalk = advance({ ...base, runtime: { ...base.runtime, noticed: 'paused' } }, 100).state;
    expect(tipOf(firstWalk)).not.toBe(AUTO_TIP_BACK);
    expect(firstWalk.runtime.backTip).toBe(true);
    const back = advance({ ...seenWalk, runtime: { ...seenWalk.runtime, noticed: 'paused' } }, 100).state;
    expect(tipOf(back)).toBe(AUTO_TIP_BACK);
    // 그린 안내 하나에 한 번만 셈 — 장면이 바뀌어 다시 그려 또 와도 (디자인팀 UX R12 재확인)
    const twice = applyInput(applyInput(back, { kind: 'tip-seen', id: 'auto' }), { kind: 'tip-seen', id: 'auto' });
    expect(twice.save.tips?.filter((t) => t.startsWith('autotip-'))).toEqual(['autotip-1']);
    expect(readRuntime(viaJson(twice.runtime), 1).toast?.counted).toBe(true);
    // 병원 · 상점 앞 · 클리어 카드는 스위치가 없어 미룸 (디자인팀 UX R12 재확인 큼)
    const done = { ...seenWalk.save.stages, 'forest-1': { ...seenWalk.save.stages['forest-1']!, progress: 1 } };
    const atClear = advance({ save: { ...seenWalk.save, stages: done }, runtime: { ...seenWalk.runtime, noticed: 'paused', stageId: 'forest-1', stage: { phase: 'clear' } } }, 100).state;
    expect(atClear.runtime.stage?.phase).toBe('clear');
    expect(tipOf(atClear)).not.toBe(AUTO_TIP_BACK);
    expect(atClear.runtime.backTip).toBe(true);
    expect(back.runtime.noticed).toBeUndefined();
    // 그릴 수 없는 장면 (고르기 · 3:3 · 만남 · 결과 …) 으로 돌아오면 ② 를 미룸 → 걷기로 오면 그때 5초 (디자인팀 R12 큼 2)
    const choosing = at(seenWalk, { phase: 'choice', ms: 0 }, { pendingChoices: [{ kind: 'learn', uid: base.save.party[0]!, moveId: 22 }] });
    const held = advance({ ...choosing, runtime: { ...choosing.runtime, noticed: 'paused' } }, 100).state;
    expect(tipOf(held)).not.toBe(AUTO_TIP_BACK);
    expect(held.runtime.backTip).toBe(true);
    const walked = advance({ ...held, save: { ...held.save, pendingChoices: [] }, runtime: { ...held.runtime, stage: { phase: 'walk' } } }, 100).state;
    expect(tipOf(walked)).toBe(AUTO_TIP_BACK);
    expect(walked.runtime.toast?.ms).toBeGreaterThan(TIMING.toastMs * 2 - 200);
    expect(walked.runtime.backTip).toBeUndefined();
    // 3번 그리면 끝
    const three = { ...base, save: { ...base.save, tips: ['autotip-1', 'autotip-2', 'autotip-3'] }, runtime: { ...base.runtime, noticed: 'paused' as const } };
    expect(tipOf(advance(three, 100).state)).not.toContain('[A] 자동 전투');
    expect(applyInput(three, { kind: 'tip-seen', id: 'auto' }).save.tips).toHaveLength(3);
    // 자동을 한 번 켜면 다시 끄더라도 끝
    const once = applyInput(applyInput(base, { kind: 'auto-battle', on: true }), { kind: 'auto-battle', on: false });
    expect(once.save.tips).toContain('auto-on');
    expect(tipOf(advance({ ...once, runtime: { ...once.runtime, noticed: 'paused' } }, 100).state)).not.toContain('[A] 자동 전투');
    // 저장했다 불러와도 남음
    expect(validateSave(viaJson(counted.save)).ok && (validateSave(viaJson(counted.save)) as { save: Save }).save.tips).toContain('autotip-1');
    // 자동을 켜면 떠 있던 안내도 바로 지움
    expect(tipOf(advance(applyInput(tipped, { kind: 'auto-battle', on: true }), 100).state)).not.toBe(AUTO_TIP_TURN);
  });
});
