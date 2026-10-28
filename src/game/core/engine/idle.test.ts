/** 다음 버전 1단계 "곁눈 · 방치 편의" (2026-10-21 orders #11 · gdd 7장) — 멈추는 곳 · 누를 곳 줄이기 */
import { describe, expect, it } from 'vitest';
import { fixedRng } from '../../../test/fixtures/rng';
import { sampleMonster, sampleSave, viaJson } from '../../../test/fixtures/save';
import { BALANCE, TIMING } from '../balance';
import { NOTIFY_OFF_TIP, TIPS_MAX, validateSave, type PendingChoice, type Save } from '../save';
import { autoPotion, battleStep, startBattle, type BattleState } from './battle';
import { applyInput, awaySummary, step } from './play';
import { addChoices, takeLaterChoices } from './rewards';
import { createGameState, readRuntime, type GameState, type StageRuntime } from './state';

const STEP = TIMING.simStepMs;
const prog0 = { seed: 42, progress: 0.4, cleared: false, defeatedTrainers: [], facilities: [{ kind: 'hospital' as const, at: 0.5 }], run: { startMs: 0, caught: 0, trainers: 0, seen: [], reach: 0, retries: 0 } };

function at(save: Partial<Save>, stage: StageRuntime | null, headless = false): GameState {
  const s = createGameState(sampleSave(save), 7);
  return { ...s, runtime: { ...s.runtime, stage, stageId: s.save.location.screen === 'stage' ? s.save.location.stageId : null, headless } };
}
/** 숲 1-1 첫 걷기 안내를 본 세이브 — 안내가 떠 있으면 그동안 요약이 기다림 (#34 UX 리뷰어) */
const SEEN_WALK: Partial<Save> = { tips: ['walk'] };
function until(s: GameState, done: (s: GameState) => boolean, maxMs: number): GameState {
  let cur = s;
  for (let t = 0; t < maxMs && !done(cur); t += STEP) cur = step(cur, STEP).state;
  return cur;
}
const learn = (uid: string, moveId: number): PendingChoice => ({ kind: 'learn', uid, moveId });

function wildBattle(save: Save, o: Partial<BattleState> = {}): BattleState {
  const b = startBattle(save, sampleMonster({ uid: 'w', species: 10, form: 'caterpie', level: 3, moves: [{ moveId: 33, pp: 35 }] }), 'normal');
  return { ...b, ...o };
}

describe('#65 자동 전투 상처약 (HP 30% 아래, 설정 — 기본 켬)', () => {
  const save = sampleSave({ bag: { potion: 1, 'super-potion': 1 } });
  const low = (b: BattleState, hp: number): BattleState => ({ ...b, me: { ...b.me, hp } });

  it('30% 아래 + 약이 있으면 모자란 만큼에 맞는 약 · 설정을 끄거나 · 30% 이상 · 약이 없으면 안 씀', () => {
    const b = wildBattle(save);
    const hp = Math.floor(b.me.maxHp * BALANCE.autoPotionBelow) - 1;
    const pick = autoPotion(low(b, hp), save);
    expect(pick).toBe(b.me.maxHp - hp > BALANCE.potionHeal ? 'super-potion' : 'potion');
    expect(autoPotion(low(b, Math.ceil(b.me.maxHp * BALANCE.autoPotionBelow)), save)).toBeNull();
    expect(autoPotion(low(b, hp), { ...save, settings: { ...save.settings, autoPotion: false } })).toBeNull();
    expect(autoPotion(low(b, hp), { ...save, bag: {} })).toBeNull();
    expect(autoPotion(low(b, 0), save)).toBeNull();
  });

  it('자동 전투가 고를 때 쓰고 (가방은 전투 끝에 빠짐) · 손으로 하면 안 씀', () => {
    const b = low(wildBattle(save, { phase: 'choose', me: { ...wildBattle(save).me, gauge: 1 } }), 1);
    const auto = battleStep(b, save, STEP, fixedRng(0.5), { auto: true, away: false });
    expect(auto.anim?.action).toMatchObject({ kind: 'item' });
    expect(battleStep(b, save, STEP, fixedRng(0.5), { auto: false, away: false }).anim).toBeNull();
  });
});

describe('#35 마지막 기회 — 자동 전투 3초 · 이미 잡은 종 건너뛰기 (설정)', () => {
  const save = sampleSave({ bag: { 'poke-ball': 3 } });

  it('자동 전투면 3초 뒤 · 손으로면 6초 뒤 지나감', () => {
    const b = wildBattle(save, { phase: 'last', lastMs: 0, foe: { ...wildBattle(save).foe, hp: 0 } });
    const run = (auto: boolean, ms: number) => {
      let cur = b;
      for (let t = 0; t < ms; t += STEP) cur = battleStep(cur, save, STEP, fixedRng(0.5), { auto, away: false });
      return cur.phase;
    };
    expect(run(true, TIMING.lastChanceAutoMs - 200)).toBe('last');
    expect(run(true, TIMING.lastChanceAutoMs + 200)).toBe('over');
    expect(run(false, TIMING.lastChanceAutoMs + 200)).toBe('last');
    expect(run(false, TIMING.lastChanceMs + 200)).toBe('over');
  });

  it('설정을 켜면 이미 잡은 종 (도감 caught) 은 마지막 기회 없이 끝 · 처음 보는 종 · 설정 끔은 그대로', () => {
    const finish = (s: Save, species: number) => {
      let b = startBattle(s, sampleMonster({ uid: 'w', species, form: species === 10 ? 'caterpie' : 'weedle', level: 2, hp: 1, moves: [{ moveId: 33, pp: 35 }] }), 'preemptive');
      for (let t = 0; t < 20_000 && b.phase !== 'last' && b.phase !== 'over'; t += STEP) b = battleStep(b, s, STEP, fixedRng(0.5), { auto: true, away: false });
      return b.phase;
    };
    const on = { ...save, settings: { ...save.settings, skipCaughtLast: true } };
    expect(finish(on, 10)).toBe('over');
    expect(finish(on, 13)).toBe('last');
    expect(finish(save, 10)).toBe('last');
    // 기준 = 지금 가진 종 (#121 — 2026-10-28 태현 님): 캐터피를 다 놓으면 도감에 잡은 기록이 남아도 다시 볼 기회 · 보관함에만 있어도 건너뜀
    const released = { ...on, party: ['m1'], monsters: { m1: on.monsters.m1! } };
    expect(released.dex.caught).toContain(10);
    expect(finish(released, 10)).toBe('last');
    expect(finish({ ...on, party: ['m1'], box: ['m2'] }, 10)).toBe('over');
  });
});

describe('#48 클리어 카드 — 자동 전투면 10초 뒤 · 안 볼 때는 바로 [다음 스테이지]', () => {
  const cleared = (autoBattle: boolean, headless = false) =>
    at({ settings: { notifications: true, autoBattle }, stages: { 'forest-1': { ...prog0, progress: 1, cleared: true } } }, { phase: 'clear' }, headless);

  it('자동 전투: 10초 동안 카드 → 다음 스테이지 · 안 볼 때 바로 · 자동 전투가 아니면 그대로 기다림', () => {
    const s = cleared(true);
    expect(until(s, () => false, TIMING.clearAutoMs - 500).save.location).toEqual({ screen: 'stage', stageId: 'forest-1' });
    expect(until(s, (x) => x.save.location.screen === 'stage' && x.save.location.stageId === 'forest-2', TIMING.clearAutoMs + 500).save.location).toEqual({ screen: 'stage', stageId: 'forest-2' });
    expect(step(cleared(true, true), STEP).state.save.location).toEqual({ screen: 'stage', stageId: 'forest-2' });
    const manual = until(cleared(false), () => false, TIMING.clearAutoMs + 2000);
    expect(manual.runtime.stage).toEqual({ phase: 'clear' });
    expect(manual.save.location).toEqual({ screen: 'stage', stageId: 'forest-1' });
  });

  it('깬 스테이지를 다시 돌며 키우는 중 (다음 스테이지도 이미 깸) 이면 같은 스테이지를 새 판으로 (2026-10-21 태현 님 A)', () => {
    const s = at({ settings: { notifications: true, autoBattle: true }, stages: { 'forest-1': { ...prog0, progress: 1, cleared: true, seed: 42 }, 'forest-2': { ...prog0, progress: 1, cleared: true } } }, { phase: 'clear' }, true);
    const went = step(s, STEP).state;
    expect(went.save.location).toEqual({ screen: 'stage', stageId: 'forest-1' });
    expect(went.save.stages['forest-1']!.progress).toBe(0);
  });

  it('다시 읽기 — 카드 시간 · 패배 상자 시간 · 진화 기다림 (−1) 이 남음', () => {
    const rt = (stage: StageRuntime) => readRuntime(viaJson({ rngState: 1, stepAccMs: 0, stage }), 1).stage;
    expect(rt({ phase: 'clear', ms: 3000 })).toEqual({ phase: 'clear', ms: 3000 });
    expect(rt({ phase: 'clear' })).toEqual({ phase: 'clear' });
    expect(rt({ phase: 'defeat', gym: false, lost: 5, ms: 1200 })).toEqual({ phase: 'defeat', gym: false, lost: 5, ms: 1200 });
    expect(rt({ phase: 'choice', ms: -1 })).toEqual({ phase: 'choice', ms: -1 });
    expect(rt({ phase: 'choice', ms: -5 } as StageRuntime)).toBeNull();
  });
});

/** 줄이 안 갈리는 띄어쓰기 (요약 조각을 묶음) 를 보통 띄어쓰기로 — 글 비교용 */
const sp = (t: string | undefined) => (t ?? '').replace(/\u00a0/g, ' ');
const spAll = (ts: string[]) => ts.map(sp);

describe('#16 자리 비운 동안 요약', () => {
  it('안 볼 때 처음 걸음에 떠날 때의 돈 · 가방 · 자리 · 레벨 · 포인트를 적고 → 다시 보면 걷는 중에 한 줄 · 지움', () => {
    const away = step(at(SEEN_WALK, { phase: 'walk' }, true), STEP).state;
    expect(away.runtime.awayLog).toMatchObject({ money: away.save.money, bag: away.save.bag, wild: 0, lost: 0, at: { place: 'forest-1' }, levels: { m1: away.save.monsters.m1!.level } });
    const log = away.runtime.awayLog!;
    const back: GameState = {
      // 숲 1-1 첫 걷기 안내는 본 뒤 (안내가 떠 있으면 요약이 기다림 — #34 UX 리뷰어)
      save: { ...away.save, tips: [...(away.save.tips ?? []), 'walk'], money: away.save.money + 60, bag: { ...away.save.bag, potion: (away.save.bag.potion ?? 0) + 1 } },
      runtime: { ...away.runtime, headless: false, awayLog: { ...log, wild: 3 } },
    };
    const shown = step(back, STEP).state;
    expect(sp(shown.runtime.toast?.text)).toBe('그동안: 상처약 1 · 60원 · 야생 3마리');
    expect(shown.runtime.toast?.ms).toBe(TIMING.awaySummaryMs);
    // 두 장 (R14 A) — ① 진행 · 레벨업 · 포인트 → ② 진 것 · 물건 · 돈 · 야생, 2.5초씩
    const m1 = away.save.monsters.m1!;
    const grown: GameState = {
      save: { ...back.save, monsters: { ...back.save.monsters, m1: { ...m1, level: m1.level + 2, unspentPoints: m1.unspentPoints + 6 } }, stages: { ...back.save.stages, 'forest-1': { ...back.save.stages['forest-1']!, progress: 0.63 } } },
      runtime: { ...back.runtime, awayLog: { ...log, wild: 3, lost: 1, at: { place: 'forest-1', progress: 0.12 } } },
    };
    const two = step(grown, STEP).state;
    expect(sp(two.runtime.toast?.text)).toBe(`그동안: 1-1 12% → 63% · 이상해씨 Lv ${m1.level + 2} · 포인트 +6`);
    expect(two.runtime.toast?.ms).toBe(TIMING.awaySummaryMs);
    expect(sp(two.runtime.toast?.then as string)).toBe('그동안: 패배 1번 · 상처약 1 · 60원 · 야생 3마리');
    let later = two;
    for (let t = 0; t < TIMING.awaySummaryMs + 100; t += STEP) later = step(later, STEP).state;
    expect(sp(later.runtime.toast?.text)).toBe('그동안: 패배 1번 · 상처약 1 · 60원 · 야생 3마리');
    // 그리지 않는 장면 (만남 · 전투) 에서는 알림 시간이 안 줄어듦 — 둘째 장이 만남에 묻혀 0ms 이던 것 (UX 리뷰어 R14)
    const met = step({ ...later, runtime: { ...later.runtime, stage: { phase: 'appear', ms: 0, isNew: false } } }, STEP).state;
    expect(met.runtime.toast?.ms).toBe(later.runtime.toast?.ms);
    // 떠나기 전부터 떠 있던 알림 (클리어 보상 등 — 안 볼 때 시간이 멈춤) 은 남기고 요약은 그 뒤에 · 요약이 비면 그대로 (코드 리뷰어)
    const leaving = step(at(SEEN_WALK, { phase: 'walk' }, true), STEP).state;
    const withToast = step({ ...at(SEEN_WALK, { phase: 'walk' }, true), runtime: { ...at(SEEN_WALK, { phase: 'walk' }, true).runtime, toast: { text: '1-1 클리어!', ms: 2000 } } }, STEP).state;
    expect(withToast.runtime.awayLog?.toastAtLeave).toBe('1-1 클리어!');
    const backWith = step({ save: { ...withToast.save, money: withToast.save.money + 60 }, runtime: { ...withToast.runtime, headless: false } }, STEP).state;
    expect(backWith.runtime.toast?.text).toBe('1-1 클리어!');
    expect(sp(String(backWith.runtime.toast?.then))).toContain('그동안');
    const emptyBack = step({ ...withToast, runtime: { ...withToast.runtime, headless: false } }, STEP).state;
    expect(emptyBack.runtime.toast?.text).toBe('1-1 클리어!');
    expect(leaving.runtime.awayLog?.toastAtLeave).toBeUndefined();
    // 떠날 때 줄 (then) 은 그 길이까지만 — 떠난 뒤 줄 선 "주웠다" 는 요약이 대신 (같은 말 두 번 — 테스터)
    const queued = step({ ...at(SEEN_WALK, { phase: 'walk' }, true), runtime: { ...at(SEEN_WALK, { phase: 'walk' }, true).runtime, toast: { text: '1-1 클리어!', ms: 2000, then: 'Lv 6!' } } }, STEP).state;
    expect(queued.runtime.awayLog?.thenAtLeave).toBe(1);
    const picked = { ...queued, save: { ...queued.save, bag: { ...queued.save.bag, potion: (queued.save.bag.potion ?? 0) + 1 } }, runtime: { ...queued.runtime, headless: false, toast: { ...queued.runtime.toast!, then: ['Lv 6!', '상처약을 주웠다!'] } } };
    const returned = step(picked, STEP).state;
    expect(JSON.stringify(returned.runtime.toast?.then)).not.toContain('주웠다');
    expect(JSON.stringify(returned.runtime.toast?.then)).toContain('Lv 6!');
    // 안 보는 동안 생긴 알림은 요약이 대신 (네 장 10초 — UX 리뷰어)
    const stale = step({ ...back, runtime: { ...back.runtime, toast: { text: '1-3 클리어!', ms: 2500, then: '이상해씨 Lv 6!' } } }, STEP).state;
    expect(sp(stale.runtime.toast?.text)).toContain('그동안');
    // 둘째 장도 3초 (2026-10-22 태현 님 "추천은 다 해주고")
    expect(TIMING.awaySummaryMs).toBe(3000);
    expect(later.runtime.toast?.ms).toBeGreaterThan(TIMING.awaySummaryMs - 300);
    expect(TIMING.toastMs).toBe(2500);
    expect(TIMING.awaySummaryMs).toBeGreaterThanOrEqual(1000);
    expect(shown.runtime.awayLog).toBeUndefined();
    // 바뀐 게 없으면 한 줄 없이 지움
    const nothing = step({ ...back, save: away.save, runtime: { ...back.runtime, awayLog: log } }, STEP).state;
    expect(nothing.runtime.toast).toBeNull();
    expect(nothing.runtime.awayLog).toBeUndefined();
  });

  it('전투 · 고르기 중에 돌아오면 한 줄이 보이는 때 (걷기) 까지 기다림 · 웹뷰 ↔ 확장으로 넘겨도 남음', () => {
    const log = { money: 100, bag: { potion: 1 }, wild: 2 };
    const s = at({}, { phase: 'choice', ms: 0 });
    const waiting = { ...s, save: { ...s.save, pendingChoices: [learn('m1', 10)] }, runtime: { ...s.runtime, awayLog: log } };
    expect(step(waiting, STEP).state.runtime.awayLog).toEqual(log);
    expect(readRuntime(viaJson({ rngState: 1, stepAccMs: 0, awayLog: { ...log, bag: { potion: 1, junk: 3 } } }), 1).awayLog).toEqual(log);
    expect(readRuntime(viaJson({ rngState: 1, stepAccMs: 0, awayLog: { money: -1, bag: {}, wild: 0 } }), 1).awayLog).toBeUndefined();
  });

  it('요약 글 — 줄어든 돈은 −, 줄어든 물건은 안 씀', () => {
    const save = sampleSave({ money: 40, bag: { 'poke-ball': 3, potion: 0 } });
    expect(spAll(awaySummary({ money: 100, bag: { 'poke-ball': 2, potion: 2 }, wild: 0 }, save))).toEqual(['그동안: 몬스터볼 1 · −60원']);
    // 물건은 두 가지까지 · 외 N가지 · 돈은 쉼표 (240 × 150 에서 4줄로 자라 잘리던 것 — UX 리뷰어 R14, U4) · 이름과 숫자 · 점은 붙여 둠
    const rich = { ...save, money: 12_385, bag: { 'poke-ball': 15, potion: 3, 'super-potion': 2, 'great-ball': 2, antidote: 1 } };
    const many = awaySummary({ money: 40, bag: {}, wild: 40, lost: 3 }, rich);
    expect(sp(many[0])).toBe('그동안: 패배 3번 · 몬스터볼 15 · 슈퍼볼 2 · 외 2가지 · 12,345원 · 야생 40마리');
    expect(many[0]).toContain('야생\u00a040마리');
    expect(many[0]).toContain('\u00a0· ');
    expect(awaySummary({ money: 40, bag: { 'poke-ball': 3 }, wild: 0 }, save)).toEqual([]);
    // 다른 스테이지 · 체육관으로 옮겼으면 "1-1 → 1-2 40%" · "1-3 → 체육관" · 레벨업 여럿이면 마리 수
    const moved = { ...save, location: { screen: 'stage' as const, stageId: 'forest-2' as const }, stages: { ...save.stages, 'forest-2': { ...save.stages['forest-1']!, progress: 0.4 } } };
    expect(spAll(awaySummary({ money: 40, bag: { 'poke-ball': 3 }, wild: 0, at: { place: 'forest-1', progress: 0.9 } }, moved))).toEqual(['그동안: 1-1 → 1-2 40%']);
    expect(spAll(awaySummary({ money: 40, bag: { 'poke-ball': 3 }, wild: 0, at: { place: 'forest-3', progress: 0.9 } }, { ...save, location: { screen: 'gym' } }))).toEqual(['그동안: 1-3 → 체육관']);
    const extra = { ...save.monsters.m1!, uid: 'm2' };
    const pair = { ...save, monsters: { ...save.monsters, m2: extra }, party: [...save.party, 'm2'] };
    const upTwo = { ...pair, monsters: Object.fromEntries(Object.entries(pair.monsters).map(([k, m]) => [k, { ...m, level: m.level + 1 }])) };
    const levels = Object.fromEntries(Object.entries(pair.monsters).map(([k, m]) => [k, m.level]));
    expect(spAll(awaySummary({ money: 40, bag: { 'poke-ball': 3 }, wild: 0, levels }, upTwo))).toEqual([`그동안: 레벨업 ${Object.keys(levels).length}마리`]);
    // 넘기기 (웹뷰 ↔ 확장) 에도 남음 · 이상한 값은 버림
    const full = { money: 1, bag: {}, wild: 0, lost: 2, at: { place: 'forest-2' as const, progress: 0.5 }, levels: { m1: 5 }, points: 3 };
    expect(readRuntime(viaJson({ rngState: 1, stepAccMs: 0, awayLog: full }), 1).awayLog).toEqual(full);
    expect(readRuntime(viaJson({ rngState: 1, stepAccMs: 0, awayLog: { ...full, at: { place: 'moon', progress: 2 } } }), 1).awayLog?.at).toBeUndefined();
  });
});

describe('#72 새 기술 고르기 모아 두기 — 선두가 아닌 포켓몬은 쌓았다 병원 · 클리어 때 한 번에', () => {
  it('선두 (party[0]) 의 새 기술 · 진화는 바로 · 나머지 포켓몬의 새 기술은 laterChoices (최대 수)', () => {
    const save = sampleSave();
    const evolve: PendingChoice = { kind: 'evolve', uid: 'm2', to: 11, newMoves: [], level: 7, item: null };
    const s = addChoices(save, [learn('m1', 10), learn('m2', 10), evolve]);
    expect(s.pendingChoices).toEqual([learn('m1', 10), evolve]);
    expect(s.laterChoices).toEqual([learn('m2', 10)]);
    expect(addChoices(save, [learn('m1', 10)]).laterChoices).toBeUndefined();
    const many = addChoices(save, Array.from({ length: BALANCE.laterChoicesMax + 5 }, (_, i) => learn('m2', 100 + i)));
    expect(many.laterChoices).toHaveLength(BALANCE.laterChoicesMax);
    // 같은 포켓몬 · 같은 기술은 하나만 · 체육관에서는 쌓지 않고 바로 (꺼낼 병원 · 클리어가 없음 — 코드 리뷰어)
    expect(addChoices(addChoices(save, [learn('m2', 10)]), [learn('m2', 10)]).laterChoices).toEqual([learn('m2', 10)]);
    expect(addChoices({ ...save, location: { screen: 'gym' } }, [learn('m2', 10)])).toMatchObject({ pendingChoices: [learn('m2', 10)] });
  });

  it('꺼낼 때 없는 포켓몬 · 이미 아는 기술은 뺌 · 칸을 지움', () => {
    const save = sampleSave({ laterChoices: [learn('m2', 10), learn('ghost', 10), learn('m2', 33)] });
    const s = takeLaterChoices(save);
    expect(s.pendingChoices).toEqual([learn('m2', 10)]);
    expect('laterChoices' in s).toBe(false);
    expect(takeLaterChoices(sampleSave())).toEqual(sampleSave());
  });

  it('병원을 지나가기 · 병원에서 나가기 · 시간이 지나 지나감 → 고르기 · 스테이지 클리어 → 고르기 먼저', () => {
    const later = { laterChoices: [learn('m2', 10)], stages: { 'forest-1': { ...prog0, progress: 0.4999 } } };
    const front = at(later, { phase: 'facility', kind: 'hospital', at: 0.5, ms: 0, inside: false });
    const passed = applyInput(front, { kind: 'facility', enter: false });
    expect(passed.runtime.stage).toEqual({ phase: 'choice', ms: 0 });
    expect(passed.save.pendingChoices).toEqual([learn('m2', 10)]);
    const inside = applyInput(front, { kind: 'facility', enter: true });
    expect(inside.save.laterChoices).toEqual([learn('m2', 10)]);
    expect(applyInput(inside, { kind: 'facility-leave' }).save.pendingChoices).toEqual([learn('m2', 10)]);
    const timed = until(front, (x) => x.runtime.stage?.phase !== 'facility', TIMING.facilityPromptMs + 500);
    expect(timed.runtime.stage?.phase).toBe('choice');
    // 안 볼 때 병원 앞을 시간이 지나 지나가면 꺼내지 않음 (클리어 때 고르기 · 알림)
    const away = until({ ...front, runtime: { ...front.runtime, headless: true } }, (x) => x.runtime.stage?.phase !== 'facility', 500);
    expect(away.save.laterChoices).toEqual([learn('m2', 10)]);
    // 상점은 그대로 쌓아 둠
    const shop = applyInput(at(later, { phase: 'facility', kind: 'shop', at: 0.5, ms: 0, inside: false }), { kind: 'facility', enter: false });
    expect(shop.save.laterChoices).toEqual([learn('m2', 10)]);
    // 스테이지 끝
    const end = until(at({ ...later, stages: { 'forest-1': { ...prog0, progress: 0.99999, facilities: [] } } }, { phase: 'walk' }), (x) => x.save.stages['forest-1']!.cleared, 5000);
    expect(end.save.pendingChoices).toContainEqual(learn('m2', 10));
    expect(end.save.laterChoices).toBeUndefined();
    expect(end.runtime.stage?.phase).toBe('choice');
  });
});

describe('세이브 새 칸 — 설정 둘 · laterChoices · tips (디자인팀 orders #12)', () => {
  it('저장하고 다시 불러오기 — 그대로 · 옛 세이브엔 칸을 만들지 않음 (고친 기록 없음)', () => {
    const save = sampleSave({ settings: { notifications: true, autoBattle: true, autoPotion: false, skipCaughtLast: true }, laterChoices: [learn('m2', 10)], tips: ['walk', 'last', NOTIFY_OFF_TIP] });
    const r = validateSave(viaJson(save));
    expect(r.ok && r.save).toEqual(save);
    expect(r.ok && r.problems).toEqual([]);
    const { tips: _t, ...oldSave } = sampleSave({ settings: { notifications: true, autoBattle: false } });
    const old = validateSave(viaJson(oldSave));
    expect(old.ok && ('laterChoices' in old.save || 'autoPotion' in old.save.settings)).toBe(false);
    // 옛 세이브 (옮김 표시 없음) — 알림은 한 번 꺼짐으로 · 표시만 붙음 (2026-10-21 태현 님 "추천안")
    expect(old.ok && old.save.tips).toEqual([NOTIFY_OFF_TIP]);
    expect(old.ok && old.save.settings.notifications).toBe(false);
    expect(old.ok && old.problems).toEqual([]);
  });

  it('이상한 값은 고침 — 모르는 포켓몬 · 진화 고르기는 laterChoices 에서 뺌 · 안내 id 는 짧은 영문 · 겹침 없이', () => {
    const raw = viaJson({ ...sampleSave(), laterChoices: [learn('m2', 10), learn('ghost', 10), { kind: 'evolve', uid: 'm2', to: 11, newMoves: [], level: 7, item: null }], tips: ['walk', 'walk', 'Bad!', 7] });
    const r = validateSave(raw);
    expect(r.ok && r.save.laterChoices).toEqual([learn('m2', 10)]);
    expect(r.ok && r.save.tips).toEqual([NOTIFY_OFF_TIP, 'walk']);
    // 옛 auto-1 ~ 은 뺌 · 옮김 표시는 자르기 전 원본으로 (20개가 넘어 잘려도 알림이 다시 꺼지지 않게 — 코드 리뷰어)
    const many = Array.from({ length: TIPS_MAX + 2 }, (_, i) => `t-${i}`);
    const kept = validateSave(viaJson({ ...sampleSave(), settings: { notifications: true, autoBattle: false }, tips: ['auto-1', 'auto-2', ...many, NOTIFY_OFF_TIP] }));
    expect(kept.ok && kept.save.settings.notifications).toBe(true);
    expect(kept.ok && kept.save.tips?.[0]).toBe(NOTIFY_OFF_TIP);
    expect(kept.ok && kept.save.tips?.some((t) => t.startsWith('auto-'))).toBe(false);
  });

  it('입력 — 설정 켜고 끄기 · tip-seen 은 한 번만 (이상한 id 는 안 받음)', () => {
    const s = at({}, { phase: 'walk' });
    expect(applyInput(s, { kind: 'auto-potion', on: true })).toBe(s);
    expect(applyInput(s, { kind: 'auto-potion', on: false }).save.settings.autoPotion).toBe(false);
    expect(applyInput(s, { kind: 'skip-caught-last', on: true }).save.settings.skipCaughtLast).toBe(true);
    const seen = applyInput(s, { kind: 'tip-seen', id: 'walk' });
    expect(seen.save.tips).toEqual([NOTIFY_OFF_TIP, 'walk']);
    expect(applyInput(seen, { kind: 'tip-seen', id: 'walk' })).toBe(seen);
    expect(applyInput(s, { kind: 'tip-seen', id: 'Bad id' })).toBe(s);
  });
});

describe('넘기기 — 해변 (지역 표의 스테이지) 도 stageId · 그동안 자리가 남음 (코드 리뷰어 #52)', () => {
  it('readRuntime 이 beach-1 stageId · awayLog.at 을 지우지 않음', () => {
    const s = createGameState(sampleSave(), 7);
    const rt = readRuntime(viaJson({ ...s.runtime, stageId: 'beach-1', awayLog: { money: 0, bag: {}, wild: 0, at: { place: 'beach-1', progress: 0.4 } } }), 7);
    expect(rt.stageId).toBe('beach-1');
    expect(rt.awayLog?.at).toEqual({ place: 'beach-1', progress: 0.4 });
  });
});
