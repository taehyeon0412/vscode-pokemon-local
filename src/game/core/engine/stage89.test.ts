/** 단계 8 · 9 — 병원 · 상점 · 트레이너 · 1:1 토너먼트 · S17 패배 · S24 클리어 · S07 이동 · S16 체육관 (mvp-spec S08 · S13 · S14 · S16 · S17 · S24 · 3.8 · 3.9) */
import { describe, expect, it } from 'vitest';
import { sampleMonster, sampleSave, viaJson } from '../../../test/fixtures/save';
import { BALANCE, TIMING } from '../balance';
import { maxHpOf } from '../rules/bag';
import { planWild } from '../rules/encounter';
import { stageLayout, stageLevelBand } from '../rules/stage';
import type { Monster, Save, StageProgress } from '../save';
import { battleInput, battleStep, readBattle, startBattle, startTrainerBattle, type BattleState } from './battle';

const startBattleFor = (save: Save, m: Monster) => startBattle(save, m, 'normal');
import { advance, applyInput, canHeal, canShop, canSwapBox, isWaitingForInput, step } from './play';
import { Rng } from './rng';
import { createGameState, readRuntime, type GameState, type StageRuntime } from './state';

const STEP = TIMING.simStepMs;
const run0 = { startMs: 0, caught: 0, trainers: 0, seen: [], reach: 0, retries: 0 };
const stageAt = (progress: number, o: Partial<StageProgress> = {}): StageProgress => ({ seed: 42, progress, cleared: false, defeatedTrainers: [], facilities: [{ kind: 'hospital', at: 0.5 }], run: { ...run0 }, ...o });
/** 아주 센 내 포켓몬 하나 (자동 전투로 이기게) */
const strong = (o: Partial<Monster> = {}): Monster => {
  const m = sampleMonster({ level: 60, exp: 216000, moves: [{ moveId: 22, pp: 25 }], ...o });
  return { ...m, hp: maxHpOf(m) };
};

function game(save: Partial<Save> = {}, stage: StageRuntime | null = { phase: 'walk' }): GameState {
  const s = createGameState(sampleSave({ stages: { 'forest-1': stageAt(0.4) }, ...save }), 7);
  return { ...s, runtime: { ...s.runtime, stage, stageId: s.save.location.screen === 'stage' ? s.save.location.stageId : null } };
}
const phase = (s: GameState) => s.runtime.stage?.phase;
const prog = (s: GameState, id: 'forest-1' | 'forest-2' | 'forest-3' = 'forest-1') => s.save.stages[id]?.progress ?? -1;
function until(s: GameState, done: (s: GameState) => boolean, maxMs = 120_000): GameState {
  let cur = s;
  for (let t = 0; t < maxMs && !done(cur); t += STEP) cur = step(cur, STEP).state;
  return cur;
}
const auto = (s: GameState): GameState => ({ ...s, save: { ...s.save, settings: { ...s.save.settings, autoBattle: true } } });

describe('S06 ⑥ 병원 · 상점 앞 (2026-10-18 태현 님)', () => {
  it('앞에서 멈추고 [들어가기] [지나가기] — 5초 안 고르면 지나감 · 지나가기만 해도 마지막 병원', () => {
    const s = until(game({ stages: { 'forest-1': stageAt(0.4999) } }), (x) => phase(x) === 'facility', 5000);
    expect(s.runtime.stage).toMatchObject({ phase: 'facility', kind: 'hospital', at: 0.5, inside: false });
    expect(prog(s)).toBeLessThan(0.5);
    expect(isWaitingForInput(s)).toBe(false); // 5초 뒤 저절로 지나감 (안 막힘)
    const passed = advance(s, TIMING.facilityPromptMs + 100).state;
    expect(phase(passed)).toBe('walk');
    expect(prog(passed)).toBeGreaterThanOrEqual(0.5);
    expect(passed.save.lastHospital).toEqual({ stageId: 'forest-1', at: 0.5 });
    const skipped = applyInput(s, { kind: 'facility', enter: false });
    expect(phase(skipped)).toBe('walk');
    expect(skipped.save.lastHospital).toEqual({ stageId: 'forest-1', at: 0.5 });
  });

  it('들어가면 S13 — 나가기를 누를 때까지 기다림 · 회복 · 보관함 교체는 안에서만 · 상점 물건은 상점에서만', () => {
    const s = until(game({ stages: { 'forest-1': stageAt(0.4999) } }), (x) => phase(x) === 'facility', 5000);
    expect(canHeal(s)).toBe(false);
    const inside = applyInput(s, { kind: 'facility', enter: true });
    expect(inside.runtime.stage).toMatchObject({ phase: 'facility', inside: true });
    expect(isWaitingForInput(inside)).toBe(true);
    expect(advance(inside, 30_000).state.runtime.stage).toEqual(inside.runtime.stage);
    expect(canHeal(inside)).toBe(true);
    expect(canSwapBox(inside)).toBe(true);
    expect(canShop(inside)).toBe(false);
    const hurt = { ...inside, save: { ...inside.save, monsters: { ...inside.save.monsters, m1: { ...inside.save.monsters.m1!, hp: 1 } } } };
    const healed = applyInput(hurt, { kind: 'heal' });
    expect(healed.save.monsters.m1!.hp).toBe(maxHpOf(healed.save.monsters.m1!));
    expect(applyInput(hurt, { kind: 'buy', item: 'poke-ball' })).toBe(hurt);
    const out = applyInput(inside, { kind: 'facility-leave' });
    expect(phase(out)).toBe('walk');
    expect(applyInput(out, { kind: 'heal' })).toBe(out);
  });

  it('상점 안에서 사기 · 안 볼 때 (확장이 계산) 는 멈추지 않고 바로 지나감', () => {
    const shop = until(game({ stages: { 'forest-1': stageAt(0.4999, { facilities: [{ kind: 'shop', at: 0.5 }] }) } }), (x) => phase(x) === 'facility', 5000);
    const inside = applyInput(shop, { kind: 'facility', enter: true });
    const bought = applyInput({ ...inside, save: { ...inside.save, money: 1000 } }, { kind: 'buy', item: 'great-ball' });
    expect(bought.save.money).toBe(1000 - BALANCE.shopPrices['great-ball']);
    expect(bought.save.bag['great-ball']).toBe(1);
    const away = game({ stages: { 'forest-1': stageAt(0.4999) } });
    const r = advance({ ...away, runtime: { ...away.runtime, headless: true } }, 2000).state;
    expect(phase(r)).not.toBe('facility');
    expect(r.save.lastHospital).toEqual({ stageId: 'forest-1', at: 0.5 });
  });
});

describe('트레이너 (S08 · 2026-10-18 태현 님)', () => {
  const trainerSpot = () => stageLayout('forest-1', 42, [{ kind: 'hospital', at: 0.5 }]).spots.find((s) => s.kind === 'trainer')!;

  it('멈추고 "!" → "승부다!" → 1:1 토너먼트 (자동 전투여도 그대로) → 이기면 다시 안 나옴 · 돈 = 레벨 × 20 · 기록', () => {
    const spot = trainerSpot();
    const base = auto(game({ monsters: { m1: strong() }, party: ['m1'], stages: { 'forest-1': stageAt(spot.at - 0.00001) } }));
    let s = until(base, (x) => phase(x) === 'trainer', 5000);
    expect(s.save.pendingEncounter).toEqual({ kind: 'trainer', trainerId: `forest-1:t${spot.trainer}`, stageId: 'forest-1' });
    expect(isWaitingForInput(s)).toBe(false);
    s = advance(s, TIMING.trainerMeetMs + 100).state;
    const b = s.runtime.stage?.phase === 'battle' ? s.runtime.stage.battle : null;
    expect(b?.kind).toBe('trainer');
    expect(b?.foeName).toMatch(/ /);
    const foes = 1 + (b?.foeQueue.length ?? 0);
    const money = s.save.money;
    s = until(s, (x) => phase(x) === 'result', 300_000);
    expect(s.save.stages['forest-1']!.defeatedTrainers).toContain(`forest-1:t${spot.trainer}`);
    expect(s.save.stages['forest-1']!.run.trainers).toBe(1);
    const [lo, hi] = stageLevelBand('forest-1');
    expect(s.save.money - money).toBe(foes * Math.round((lo + hi) / 2) * BALANCE.trainerMoneyPerLevel);
    expect(s.runtime.stage).toMatchObject({ summary: { title: expect.stringMatching(/승부에서 이겼다/) } });
    // 같은 자리를 다시 지나가도 안 나옴
    const again = until({ ...s, save: { ...s.save, stages: { 'forest-1': { ...s.save.stages['forest-1']!, progress: spot.at - 0.00001 } } }, runtime: { ...s.runtime, stage: { phase: 'walk' } } }, (x) => prog(x) > spot.at + 0.0005, 5000);
    expect(again.save.pendingEncounter).toBeNull();
  });

  it('트레이너 만남 — "!" 뒤 Space · 클릭이면 VS 를 다 기다리지 않고 바로 전투 ("!" 동안은 안 넘김, 2026-10-20 태현 님)', () => {
    const spot = trainerSpot();
    const met = until(game({ stages: { 'forest-1': stageAt(spot.at - 0.00001) } }), (x) => phase(x) === 'trainer', 5000);
    expect(applyInput(met, { kind: 'space' })).toBe(met); // "!" 0.8초 동안은 그대로 (누구인지 보이게)
    const talking = advance(met, TIMING.trainerAlertMs + 50).state;
    expect(phase(talking)).toBe('trainer');
    const skipped = step(applyInput(talking, { kind: 'space' }), STEP).state;
    expect(phase(skipped)).toBe('battle');
  });

  it('트레이너 전투 중에 껐다 켜면 같은 상대와 처음부터', () => {
    const spot = trainerSpot();
    const s = advance(until(game({ stages: { 'forest-1': stageAt(spot.at - 0.00001) } }), (x) => phase(x) === 'trainer', 5000), TIMING.trainerMeetMs + 100).state;
    const reloaded = step(createGameState(viaJson(s.save), 3), STEP).state;
    const a = s.runtime.stage?.phase === 'battle' ? s.runtime.stage.battle : null;
    const b = reloaded.runtime.stage?.phase === 'battle' ? reloaded.runtime.stage.battle : null;
    expect(b?.kind).toBe('trainer');
    expect(b?.foe.species).toBe(a?.foe.species);
    expect(b?.foeQueue.map((m) => m.species)).toEqual(a?.foeQueue.map((m) => m.species));
  });
});

describe('1:1 토너먼트 · 상대 AI 필살기 (gdd S08 ③ · 4.7)', () => {
  const save = sampleSave({ monsters: { m1: strong() }, party: ['m1'] });
  const weak = (uid: string, species = 10): Monster => ({ ...sampleMonster({ uid, species, form: species === 10 ? 'caterpie' : 'weedle', level: 3, moves: [{ moveId: 33, pp: 35 }] }), hp: 1 });
  const runB = (b0: BattleState, ms: number, autoOn = true) => {
    let b = b0;
    const rng = new Rng(3);
    for (let t = 0; t < ms && b.phase !== 'over'; t += STEP) b = battleStep(b, save, STEP, rng, { auto: autoOn });
    return b;
  };

  it('상대가 쓰러지면 다음 포켓몬을 내보냄 (내 HP 그대로) → 다 쓰러뜨리면 이김 · 쓰러뜨린 상대 기록', () => {
    const b0 = startTrainerBattle(save, [weak('a'), weak('b', 13)], 'trainer', '곤충채집 소년 민수');
    expect(b0.msg).toContain('곤충채집 소년 민수');
    let sawSend = false;
    let b = b0;
    const rng = new Rng(3);
    for (let t = 0; t < 60_000 && b.phase !== 'over'; t += STEP) {
      b = battleStep(b, save, STEP, rng, { auto: true });
      if (b.phase === 'send') sawSend = true;
    }
    expect(sawSend).toBe(true);
    expect(b.result).toBe('win');
    expect(b.foeDown.map((d) => d.species)).toEqual([10, 13]);
    expect(b.msg).toContain('승부에서 이겼다');
  });

  it('트레이너 · 관장전은 도망 · 볼이 안 됨 · 관장 에이스는 필살기 게이지 절반으로 나옴', () => {
    const b = runB(startTrainerBattle(save, [weak('a')], 'trainer', 'x'), 0);
    const choose = { ...b, phase: 'choose' as const, me: { ...b.me, gauge: 1 } };
    const withBall = { ...save, bag: { 'poke-ball': 3 } };
    expect(battleInput(choose, withBall, { kind: 'act', action: { kind: 'flee' } }, new Rng(1))).toBe(choose);
    expect(battleInput(choose, withBall, { kind: 'act', action: { kind: 'item', item: 'poke-ball' } }, new Rng(1))).toBe(choose);
    expect(startTrainerBattle(save, [weak('a')], 'gym', '관장').foe.ult).toBe(BALANCE.gymAceUlt);
    const two = startTrainerBattle(save, [weak('a'), weak('b')], 'gym', '관장');
    expect(two.foe.ult).toBe(0);
    let s = two;
    const rng = new Rng(5);
    for (let t = 0; t < 30_000 && s.foeQueue.length > 0; t += STEP) s = battleStep(s, save, STEP, rng, { auto: true });
    expect(s.foe.ult).toBeGreaterThanOrEqual(BALANCE.gymAceUlt);
  });

  it('관장은 에이스 HP 가 절반 아래면 상처약 1번 (내 가방은 그대로) — 앞 포켓몬 · 트레이너는 안 씀 (2026-10-20)', () => {
    // 앞 포켓몬 (뒤에 더 있음) 에게는 안 씀
    const front = startTrainerBattle(save, [{ ...weak('a'), hp: 999 }, weak('b')], 'gym', '관장 웅이');
    const frontLow = battleStep({ ...front, phase: 'run' as const, foe: { ...front.foe, hp: 1, gauge: 1, ult: 0 }, me: { ...front.me, gauge: 0 } }, save, STEP, new Rng(1), { auto: true });
    expect(frontLow.anim?.action.kind).not.toBe('item');
    const gym = startTrainerBattle(save, [{ ...weak('a'), hp: 999 }], 'gym', '관장 웅이');
    expect(gym.foePotions).toBe(BALANCE.gymPotions);
    const low = { ...gym, phase: 'run' as const, foe: { ...gym.foe, hp: Math.floor(gym.foe.maxHp * 0.4), gauge: 1, ult: 0 }, me: { ...gym.me, gauge: 0 } };
    const used = battleStep(low, save, STEP, new Rng(1), { auto: true });
    expect(used.anim?.action).toEqual({ kind: 'item', item: 'potion' });
    expect(used.msg).toBe('관장 웅이는 상처약을 썼다!');
    expect(used.foePotions).toBe(0);
    // 상처약 연출이 끝난 직후 — HP 가 상처약만큼 · 내 가방에서는 안 빠짐
    let h = used;
    const rng = new Rng(1);
    for (let t = 0; t < 3000 && h.anim?.action.kind === 'item'; t += STEP) h = battleStep(h, save, STEP, rng, { auto: false });
    expect(h.foe.hp).toBe(Math.min(h.foe.maxHp, low.foe.hp + BALANCE.potionHeal));
    expect(h.bagUsed.potion ?? 0).toBe(0);
    // 다 쓰면 다시 안 씀
    const again = battleStep({ ...low, foePotions: 0 }, save, STEP, new Rng(1), { auto: true });
    expect(again.anim?.action.kind).not.toBe('item');
    // 트레이너는 안 씀
    const tr = startTrainerBattle(save, [{ ...weak('a'), hp: 999 }], 'trainer', 't');
    expect(tr.foePotions).toBeUndefined();
    const trLow = battleStep({ ...tr, phase: 'run' as const, foe: { ...tr.foe, hp: 1, gauge: 1, ult: 0 }, me: { ...tr.me, gauge: 0 } }, save, STEP, new Rng(1), { auto: true });
    expect(trLow.anim?.action.kind).not.toBe('item');
  });

  it('트레이너 필살기: 게이지가 차면 0.5 ~ 3초 기다렸다가 · 관장: 내 기술 연출에 끼어듦 (내 기술은 취소)', () => {
    const tb = startTrainerBattle(save, [{ ...weak('a'), hp: 999 }], 'trainer', 't');
    const full = { ...tb, foe: { ...tb.foe, ult: 1 }, me: { ...tb.me, stats: { ...tb.me.stats, speed: 1 } } };
    const one = battleStep(full, save, STEP, new Rng(2), { auto: false });
    expect(one.phase).toBe('run');
    expect(one.foeUltWait).toBeGreaterThanOrEqual(BALANCE.trainerUltWaitMs[0] - STEP);
    // 기다리는 시간은 싸우는 동안만 흐름 (내가 고르는 중 · 상대 연출 중에는 멈춤) — 자동 전투로 넉넉히
    const later = runB(full, 8000);
    expect(later.foe.ult).toBeLessThan(1);

    const gb = startTrainerBattle(save, [{ ...weak('a'), hp: 999 }], 'gym', '관장');
    const myTurn: BattleState = { ...gb, phase: 'choose', me: { ...gb.me, gauge: 1 }, foe: { ...gb.foe, ult: 1 } };
    let s = battleInput(myTurn, save, { kind: 'act', action: { kind: 'move', moveId: 22 } }, new Rng(1));
    expect(s.anim?.side).toBe('me');
    for (let t = 0; t <= BALANCE.leaderCutMs; t += STEP) s = battleStep(s, save, STEP, new Rng(1), { auto: false });
    expect(s.anim).toMatchObject({ side: 'foe', action: { kind: 'ult' } });
    expect(s.msg).toContain('끼어들었다');
    expect(s.me.moves[0]!.pp).toBe(24); // 내 PP 는 깎인 채
  });

  it('내 필살기를 상대가 필살기로 맞받아침 — 관장은 늘 (필살기 힘대결)', () => {
    const gb = startTrainerBattle(save, [{ ...weak('a'), hp: 999 }], 'gym', '관장');
    const ready: BattleState = { ...gb, phase: 'choose', me: { ...gb.me, gauge: 1, ult: 1 }, foe: { ...gb.foe, ult: 1 } };
    const s = battleInput(ready, save, { kind: 'ult' }, new Rng(1));
    expect(s.phase).toBe('clash');
    expect(s.clash?.kind).toBe('ult');
    expect([s.me.ult, s.foe.ult]).toEqual([0, 0]);
  });

  it('트레이너 전투도 JSON 으로 오가면 그대로 (모양이 이상하면 null)', () => {
    const b = runB(startTrainerBattle(save, [weak('a'), weak('b')], 'trainer', '피크닉 소녀 하은'), 3000);
    expect(readBattle(viaJson(b))).toEqual(b);
    expect(readBattle({ ...viaJson(b), foeQueue: [{ uid: 'x' }] })).toBeNull();
    expect(readBattle({ ...viaJson(b), kind: 'boss' })).toBeNull();
    expect(readBattle({ ...viaJson(b), foeName: null })).toBeNull();
  });
});

describe('S17 패배 (gdd 4.10)', () => {
  const lostBattle = (s: GameState): GameState => {
    const save: Save = { ...s.save, monsters: { ...s.save.monsters, m1: { ...s.save.monsters.m1!, hp: 0 }, m2: { ...s.save.monsters.m2!, hp: 0 } }, pendingEncounter: { kind: 'wild', monster: sampleMonster({ uid: 'wild' }), start: 'normal' } };
    return { ...s, save, runtime: { ...s.runtime, stage: null } };
  };

  it('돈 −10% · 팀 회복 · 마지막으로 지나간 병원 앞 · 야생만 다시 뽑음 (길 · 병원 자리 그대로) → [다시 시작]', () => {
    const base = game({ money: 1005, lastHospital: { stageId: 'forest-1', at: 0.5 }, stages: { 'forest-1': stageAt(0.7) } });
    const s = until(lostBattle(base), (x) => phase(x) === 'defeat', 10_000);
    expect(s.runtime.stage).toEqual({ phase: 'defeat', gym: false, lost: 100 });
    expect(s.save.money).toBe(905);
    expect(s.save.monsters.m1!.hp).toBe(maxHpOf(s.save.monsters.m1!));
    expect(prog(s)).toBeLessThan(0.5);
    expect(prog(s)).toBeGreaterThan(0.49);
    expect(s.save.stages['forest-1']!.seed).toBe(42);
    expect(s.save.stages['forest-1']!.run).toMatchObject({ reach: 0.7, retries: 1 });
    expect(s.save.stages['forest-1']!.facilities).toEqual([{ kind: 'hospital', at: 0.5 }]);
    expect(isWaitingForInput(s)).toBe(true);
    const back = applyInput(s, { kind: 'defeat-continue' });
    expect(phase(back)).toBe('walk');
    // 다시 걸으면 바로 그 병원 앞
    expect(phase(until(back, (x) => phase(x) === 'facility', 3000))).toBe('facility');
  });

  it('병원을 안 지났으면 (다른 스테이지 병원) 스테이지 처음부터', () => {
    const base = game({ lastHospital: { stageId: 'forest-2', at: 0.5 }, stages: { 'forest-1': stageAt(0.7) } });
    const s = until(lostBattle(base), (x) => phase(x) === 'defeat', 10_000);
    expect(prog(s)).toBe(0);
  });
});

describe('S24 · S07 · 깬 스테이지 (mvp-spec S07 · S24 · #62)', () => {
  it('잠긴 스테이지는 못 감 · 클리어 카드에서 다음 스테이지 = 새 판, 떠난 스테이지는 처음부터 (새 길)', () => {
    const s = game();
    expect(applyInput(s, { kind: 'travel', to: 'forest-2' })).toBe(s);
    expect(applyInput(s, { kind: 'travel', to: 'gym' })).toBe(s);
    expect(applyInput(s, { kind: 'travel', to: 'forest-1' })).toBe(s); // 지금 스테이지 = 그대로
    const card = game({ stages: { 'forest-1': stageAt(1, { cleared: true }) } }, { phase: 'clear' });
    expect(canSwapBox(card)).toBe(true);
    const next = applyInput(card, { kind: 'travel', to: 'forest-2' });
    expect(next.save.location).toEqual({ screen: 'stage', stageId: 'forest-2' });
    expect(prog(next)).toBe(0);
    expect(next.save.stages['forest-1']!.seed).not.toBe(42);
    expect(next.save.stages['forest-1']!.cleared).toBe(true);
    expect(prog(next, 'forest-2')).toBe(0);
    expect(phase(step(next, STEP).state)).toBe('walk');
  });

  it('걷다가 지도로 다른 스테이지 → 지금 스테이지는 처음부터 다시 · 마지막 병원도 지움', () => {
    const s = game({ lastHospital: { stageId: 'forest-1', at: 0.5 }, stages: { 'forest-1': stageAt(0.6, { cleared: true }), 'forest-2': stageAt(0.3, { seed: 9 }) } });
    const moved = applyInput(s, { kind: 'travel', to: 'forest-2' });
    expect(prog(moved)).toBe(0);
    expect(moved.save.lastHospital).toBeNull();
    expect(prog(moved, 'forest-2')).toBe(0); // 가는 스테이지도 새 판
  });

  it('1-3 끝 → S16 체육관 대기실 (볼 +1 · 보너스 경험치 · 깬 표시)', () => {
    const s0 = game({ location: { screen: 'stage', stageId: 'forest-3' }, party: ['m1'], stages: { 'forest-1': stageAt(0, { cleared: true }), 'forest-2': stageAt(0, { cleared: true }), 'forest-3': stageAt(0.99999) } });
    const s = until(s0, (x) => x.save.location.screen === 'gym', 5000);
    expect(s.save.stages['forest-3']!.cleared).toBe(true);
    const lobby = until(s, (x) => phase(x) === 'lobby', 1000);
    expect(phase(lobby)).toBe('lobby');
    expect(lobby.runtime.stageId).toBeNull();
    expect(isWaitingForInput(lobby)).toBe(true);
    expect(canSwapBox(lobby) && canHeal(lobby) && canShop(lobby)).toBe(true);
  });
});

describe('S16 체육관 · 관장 (mvp-spec 3.9)', () => {
  const lobby = (o: Partial<Save> = {}): GameState => {
    const s = createGameState(sampleSave({ location: { screen: 'gym' }, monsters: { m1: strong() }, party: ['m1'], stages: { 'forest-3': stageAt(1, { cleared: true }) }, ...o }), 11);
    return auto({ ...s, runtime: { ...s.runtime, stage: { phase: 'lobby' }, stageId: null } });
  };

  it('도전 → 관장 3마리 1:1 → 처음 이기면 배지 + 3000원 + 리프의 돌 → MVP 끝 카드 → 대기실', () => {
    const s0 = lobby();
    const fight = applyInput(s0, { kind: 'challenge' });
    expect(fight.save.pendingEncounter).toEqual({ kind: 'gym-leader' });
    expect(fight.runtime.stage?.phase === 'battle' && fight.runtime.stage.battle.kind).toBe('gym');
    const money = fight.save.money;
    let s = until(fight, (x) => phase(x) === 'result', 600_000);
    expect(s.save.badges).toContain('forest');
    expect(s.save.bag['leaf-stone']).toBe(1);
    expect(s.save.money - money).toBe(BALANCE.gymFirstMoney);
    expect(s.runtime.stage).toMatchObject({ phase: 'result', then: 'badge', summary: { badge: '숲 배지' } });
    s = until(s, (x) => phase(x) !== 'result' && phase(x) !== 'choice', 60_000);
    expect(phase(s)).toBe('badge');
    expect(isWaitingForInput(s)).toBe(true);
    expect(phase(applyInput(s, { kind: 'badge-continue' }))).toBe('lobby');
  });

  it('다시 이기면 300원만 · 지면 돈은 그대로 · 팀 회복 · 대기실로', () => {
    const rematch = until(applyInput(lobby({ badges: ['forest'] }), { kind: 'challenge' }), (x) => phase(x) === 'result', 600_000);
    expect(rematch.runtime.stage).not.toHaveProperty('then');
    expect(rematch.save.money - lobby().save.money).toBe(BALANCE.gymRematchMoney);
    const weak = sampleMonster({ level: 2, moves: [{ moveId: 33, pp: 35 }] });
    const lose = until(applyInput(lobby({ monsters: { m1: weak } }), { kind: 'challenge' }), (x) => phase(x) === 'defeat', 600_000);
    expect(lose.runtime.stage).toEqual({ phase: 'defeat', gym: true, lost: 0 });
    expect(lose.save.money).toBe(lobby().save.money);
    expect(lose.save.monsters.m1!.hp).toBe(maxHpOf(lose.save.monsters.m1!));
    expect(phase(applyInput(lose, { kind: 'defeat-continue' }))).toBe('lobby');
  });

  it('대기실에서 지도로 · 1-3 을 안 깼으면 체육관으로 못 감', () => {
    const s = lobby();
    const out = applyInput(s, { kind: 'travel', to: 'forest-1' });
    expect(out.save.location).toEqual({ screen: 'stage', stageId: 'forest-1' });
    const back = applyInput({ ...out, runtime: { ...out.runtime, stage: { phase: 'walk' } } }, { kind: 'travel', to: 'gym' });
    expect(back.save.location).toEqual({ screen: 'gym' });
    const locked = game();
    expect(applyInput(locked, { kind: 'travel', to: 'gym' })).toBe(locked);
  });
});

describe('S18 · S19 · S20 — 어디서 무엇을 (gdd 4.10 · mvp-spec S19 · S20)', () => {
  it('걷는 중: 팀 순서 · 포인트 · 가방은 됨, 보관함 교체는 안 됨 (병원 · 대기실 · 스테이지 시작 전만)', () => {
    const s = game({ box: [], bag: { potion: 1, 'leaf-stone': 1 } });
    expect(applyInput(s, { kind: 'team-move', uid: 'm2', dir: -1 }).save.party).toEqual(['m2', 'm1']);
    expect(applyInput(s, { kind: 'points', uid: 'm1', stat: 'attack' }).save.monsters.m1!.points.attack).toBe(1);
    expect(applyInput(s, { kind: 'team-to-box', uid: 'm2' })).toBe(s);
    const healed = applyInput(s, { kind: 'use-item', item: 'potion', uid: 'm1' });
    expect(healed.save.bag.potion).toBe(0);
    expect(healed.runtime.toast?.text).toContain('회복');
    expect(applyInput(s, { kind: 'notifications', on: false }).save.settings.notifications).toBe(false);
  });

  it('진화의 돌 → S22 연출부터 · 전투 중에는 팀 순서를 못 바꿈', () => {
    const gloom = { ...sampleMonster({ species: 44, form: 'gloom', level: 21 }), hp: 30 };
    const s = game({ monsters: { ...sampleSave().monsters, m1: gloom }, bag: { 'leaf-stone': 1 } });
    const evo = applyInput(s, { kind: 'use-item', item: 'leaf-stone', uid: 'm1' });
    expect(evo.runtime.stage).toEqual({ phase: 'choice', ms: 0 });
    expect(evo.save.pendingChoices[0]).toMatchObject({ kind: 'evolve', item: 'leaf-stone' });
    const fighting = game({}, { phase: 'trainer', n: 0, ms: 0 });
    expect(applyInput(fighting, { kind: 'team-move', uid: 'm2', dir: -1 })).toBe(fighting);
  });
});

describe('새 진행 중 상태도 확장 ↔ 웹뷰로 (모양이 이상하면 버림)', () => {
  it('병원 · 트레이너 · 패배 · 클리어 · 대기실 · 배지', () => {
    const ok: StageRuntime[] = [
      { phase: 'facility', kind: 'shop', at: 0.4, ms: 100, inside: true },
      { phase: 'trainer', n: 1, ms: 300 },
      { phase: 'defeat', gym: false, lost: 120 },
      { phase: 'clear' },
      { phase: 'lobby' },
      { phase: 'badge' },
      { phase: 'choice', ms: 10, then: 'badge' },
    ];
    for (const stage of ok) expect(readRuntime({ rngState: 1, stepAccMs: 0, stage }, 1).stage).toEqual(stage);
    expect(readRuntime({ rngState: 1, stepAccMs: 0, stage: { phase: 'facility', kind: 'casino', at: 0.4, ms: 0, inside: false } }, 1).stage).toBeNull();
    expect(readRuntime({ rngState: 1, stepAccMs: 0, stage: { phase: 'choice', ms: 0, then: 'party' } }, 1).stage).toBeNull();
    expect(readRuntime({ rngState: 1, stepAccMs: 0, stage: { phase: 'end' } }, 1).stage).toBeNull();
  });
});

describe('단계 8 · 9 검토에서 고친 것 (bugs #156 ~)', () => {
  it('안 볼 때 1-3 끝 = 체육관 도착 알림 · 클리어 카드 · 패배도 알림 (명세 검사관 · 플레이 리뷰어)', () => {
    const gymBound = game({ location: { screen: 'stage', stageId: 'forest-3' }, party: ['m1'], stages: { 'forest-1': stageAt(0, { cleared: true }), 'forest-2': stageAt(0, { cleared: true }), 'forest-3': stageAt(0.99999) } });
    expect(advance({ ...gymBound, runtime: { ...gymBound.runtime, headless: true } }, 2000).notices).toContain('gym');
    const end = game({ party: ['m1'], stages: { 'forest-1': stageAt(0.99999) } });
    expect(advance({ ...end, runtime: { ...end.runtime, headless: true } }, 2000).notices).toContain('clear');
    expect(advance(end, 2000).notices).toEqual([]);
  });

  it('트레이너는 내 기술 연출에 끼어들지 않음 — 끼어들기는 관장 성격 (명세 검사관)', () => {
    const save = sampleSave({ monsters: { m1: strong() }, party: ['m1'] });
    const tb = startTrainerBattle(save, [{ ...sampleMonster({ uid: 'a', species: 10, form: 'caterpie', level: 3 }), hp: 999 }], 'trainer', 't');
    const turn: BattleState = { ...tb, phase: 'choose', me: { ...tb.me, gauge: 1 }, foe: { ...tb.foe, ult: 1 }, foeUltWait: STEP };
    let s = battleInput(turn, save, { kind: 'act', action: { kind: 'move', moveId: 22 } }, new Rng(1));
    for (let t = 0; t < 400; t += STEP) s = battleStep(s, save, STEP, new Rng(1), { auto: false });
    expect(s.msg).not.toContain('끼어들었다');
  });

  it('트레이너 자리는 스테이지마다 정해짐 — 졌다 새 시드로 다시 걸어도 못 이긴 트레이너가 뒤로 밀리지 않음 (명세 검사관)', () => {
    const at = (seed: number) => stageLayout('forest-2', seed).spots.filter((s) => s.kind === 'trainer').map((s) => s.at);
    expect(at(1)).toEqual(at(98765));
    expect(at(1).length).toBeGreaterThanOrEqual(2);
  });
});

describe('단계 8 · 9 코드 리뷰에서 고친 것', () => {
  it('토너먼트: 상대와 같이 쓰러진 내 포켓몬 (독) 은 다음 포켓몬 목록에 없고 전투 끝 세이브에 HP 0 (코드 리뷰어 높음)', () => {
    const save = sampleSave({ monsters: { m1: { ...strong(), hp: 1, status: { kind: 'poison' } }, m2: sampleSave().monsters.m2! }, party: ['m1', 'm2'] });
    const foe = (uid: string) => ({ ...sampleMonster({ uid, species: 10, form: 'caterpie', level: 3, moves: [{ moveId: 33, pp: 35 }] }), hp: 1 });
    const b0 = startTrainerBattle(save, [foe('a'), foe('b')], 'trainer', 't');
    const turn: BattleState = { ...b0, phase: 'choose', me: { ...b0.me, gauge: 1 } };
    let b = battleInput(turn, save, { kind: 'act', action: { kind: 'attack' } }, new Rng(1));
    for (let t = 0; t < 5000 && b.phase !== 'pick' && b.phase !== 'over'; t += STEP) b = battleStep(b, save, STEP, new Rng(1), { auto: false });
    expect(b.phase).toBe('pick');
    expect(b.bench.m1?.hp).toBe(0);
    const picked = battleInput(b, save, { kind: 'pick', uid: 'm1' }, new Rng(1));
    expect(picked).toBe(b); // 쓰러진 m1 은 못 고름
  });

  it('졌다 다시 걸으면 이미 지나간 떨어진 아이템 · 부탁은 다시 안 나옴 · 같은 자리 야생은 다시 뽑음 (코드 리뷰어 중간)', () => {
    const layout = stageLayout('forest-1', 42, [{ kind: 'hospital', at: 0.5 }]);
    const item = layout.spots.find((s) => s.kind === 'item' && s.at > 0.5)!;
    const base = game({ lastHospital: { stageId: 'forest-1', at: 0.5 }, stages: { 'forest-1': stageAt(0.5, { run: { ...run0, reach: item.at + 0.001, retries: 1 } }) } });
    const passed = until(base, (x) => prog(x) > item.at + 0.0005 || phase(x) !== 'walk', 30_000);
    expect(passed.runtime.toast?.text ?? '').not.toContain('주웠다');
    const wild = layout.spots.find((s) => s.kind === 'wild')!;
    const a = planWild('forest-1', 42, wild, 0);
    const differs = [1, 2, 3, 4].some((r) => JSON.stringify(planWild('forest-1', 42, wild, r)) !== JSON.stringify(a));
    expect(differs).toBe(true);
  });

  it('트레이너 단계의 번호가 세이브의 상대와 다르면 버리고 세이브대로 (코드 리뷰어)', () => {
    const s = game({ pendingEncounter: { kind: 'trainer', trainerId: 'forest-1:t1', stageId: 'forest-1' } }, { phase: 'trainer', n: 0, ms: 0 });
    const next = step(s, STEP).state;
    expect(next.runtime.stage?.phase).toBe('battle');
  });
});

describe('단계 8 · 9 테스터가 찾은 것', () => {
  it('필살기 게이지 × 0.5 는 야생 포켓몬만 — 트레이너 · 관장 포켓몬은 그대로 참 (테스터 큼)', () => {
    const save = sampleSave({ monsters: { m1: strong() }, party: ['m1'] });
    const foeMon = { ...sampleMonster({ uid: 'a', species: 10, form: 'caterpie', level: 3, moves: [{ moveId: 33, pp: 35 }] }), hp: 999 };
    const gain = (kind: 'trainer' | 'wild') => {
      const b0 = kind === 'wild' ? startBattleFor(save, foeMon) : startTrainerBattle(save, [foeMon], 'trainer', 't');
      const turn: BattleState = { ...b0, phase: 'choose', me: { ...b0.me, gauge: 1 } };
      let b = battleInput(turn, save, { kind: 'act', action: { kind: 'attack' } }, new Rng(4));
      for (let t = 0; t < 2000 && b.anim; t += STEP) b = battleStep(b, save, STEP, new Rng(4), { auto: false });
      return b.foe.ult;
    };
    expect(gain('trainer')).toBeGreaterThan(gain('wild') * 1.9);
  });
});
