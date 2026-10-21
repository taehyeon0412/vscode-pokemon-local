/** 다음 버전 1단계 "곁눈 · 방치 편의" (2026-10-21 orders #11 · gdd 7장) — 멈추는 곳 · 누를 곳 줄이기 */
import { describe, expect, it } from 'vitest';
import { fixedRng } from '../../../test/fixtures/rng';
import { sampleMonster, sampleSave, viaJson } from '../../../test/fixtures/save';
import { BALANCE, TIMING } from '../balance';
import { validateSave, type PendingChoice, type Save } from '../save';
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

  it('다시 읽기 — 카드 시간 · 패배 상자 시간 · 진화 기다림 (−1) 이 남음', () => {
    const rt = (stage: StageRuntime) => readRuntime(viaJson({ rngState: 1, stepAccMs: 0, stage }), 1).stage;
    expect(rt({ phase: 'clear', ms: 3000 })).toEqual({ phase: 'clear', ms: 3000 });
    expect(rt({ phase: 'clear' })).toEqual({ phase: 'clear' });
    expect(rt({ phase: 'defeat', gym: false, lost: 5, ms: 1200 })).toEqual({ phase: 'defeat', gym: false, lost: 5, ms: 1200 });
    expect(rt({ phase: 'choice', ms: -1 })).toEqual({ phase: 'choice', ms: -1 });
    expect(rt({ phase: 'choice', ms: -5 } as StageRuntime)).toBeNull();
  });
});

describe('#16 자리 비운 동안 요약', () => {
  it('안 볼 때 처음 걸음에 떠날 때의 돈 · 가방을 적고 → 다시 보면 걷는 중에 3초 한 줄 · 지움', () => {
    const away = step(at({}, { phase: 'walk' }, true), STEP).state;
    expect(away.runtime.awayLog).toEqual({ money: away.save.money, bag: away.save.bag, wild: 0 });
    const log = away.runtime.awayLog!;
    const back: GameState = {
      save: { ...away.save, money: away.save.money + 60, bag: { ...away.save.bag, potion: (away.save.bag.potion ?? 0) + 1 } },
      runtime: { ...away.runtime, headless: false, awayLog: { ...log, wild: 3 } },
    };
    const shown = step(back, STEP).state;
    expect(shown.runtime.toast).toEqual({ text: '그동안: 상처약 1 · 60원 · 야생 3마리', ms: TIMING.awaySummaryMs });
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
    expect(awaySummary({ money: 100, bag: { 'poke-ball': 2, potion: 2 }, wild: 0 }, save)).toBe('그동안: 몬스터볼 1 · −60원');
    expect(awaySummary({ money: 40, bag: { 'poke-ball': 3 }, wild: 0 }, save)).toBe('');
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
    const many = addChoices(save, Array.from({ length: BALANCE.laterChoicesMax + 5 }, () => learn('m2', 10)));
    expect(many.laterChoices).toHaveLength(BALANCE.laterChoicesMax);
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
    const save = sampleSave({ settings: { notifications: true, autoBattle: true, autoPotion: false, skipCaughtLast: true }, laterChoices: [learn('m2', 10)], tips: ['walk', 'last'] });
    const r = validateSave(viaJson(save));
    expect(r.ok && r.save).toEqual(save);
    expect(r.ok && r.problems).toEqual([]);
    const old = validateSave(viaJson(sampleSave()));
    expect(old.ok && ('laterChoices' in old.save || 'tips' in old.save || 'autoPotion' in old.save.settings)).toBe(false);
    expect(old.ok && old.problems).toEqual([]);
  });

  it('이상한 값은 고침 — 모르는 포켓몬 · 진화 고르기는 laterChoices 에서 뺌 · 안내 id 는 짧은 영문 · 겹침 없이', () => {
    const raw = viaJson({ ...sampleSave(), laterChoices: [learn('m2', 10), learn('ghost', 10), { kind: 'evolve', uid: 'm2', to: 11, newMoves: [], level: 7, item: null }], tips: ['walk', 'walk', 'Bad!', 7] });
    const r = validateSave(raw);
    expect(r.ok && r.save.laterChoices).toEqual([learn('m2', 10)]);
    expect(r.ok && r.save.tips).toEqual(['walk']);
  });

  it('입력 — 설정 켜고 끄기 · tip-seen 은 한 번만 (이상한 id 는 안 받음)', () => {
    const s = at({}, { phase: 'walk' });
    expect(applyInput(s, { kind: 'auto-potion', on: true })).toBe(s);
    expect(applyInput(s, { kind: 'auto-potion', on: false }).save.settings.autoPotion).toBe(false);
    expect(applyInput(s, { kind: 'skip-caught-last', on: true }).save.settings.skipCaughtLast).toBe(true);
    const seen = applyInput(s, { kind: 'tip-seen', id: 'walk' });
    expect(seen.save.tips).toEqual(['walk']);
    expect(applyInput(seen, { kind: 'tip-seen', id: 'walk' })).toBe(seen);
    expect(applyInput(s, { kind: 'tip-seen', id: 'Bad id' })).toBe(s);
  });
});
