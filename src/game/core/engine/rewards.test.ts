import { describe, expect, it } from 'vitest';
import { fixedRng } from '../../../test/fixtures/rng';
import { sampleMonster, sampleSave, viaJson } from '../../../test/fixtures/save';
import { BALANCE, TIMING } from '../balance';
import { expGain, levelUpChoices } from '../rules/growth';
import { expForLevel } from '../rules/stats';
import type { Monster, Save } from '../save';
import { battleDone, battleInput, battleStep, catchTimeline, catchTriesUsed, readBattle, startBattle, type BattleState } from './battle';
import { battleRewards, resolveEvolve, resolveLearn } from './rewards';
import { Rng } from './rng';

const STEP = TIMING.simStepMs;
const wild = (o: Partial<Monster> = {}): Monster =>
  sampleMonster({ uid: 'wild', species: 16, form: 'pidgey', level: 4, moves: [{ moveId: 33, pp: 35 }], hp: 999, caughtAt: 'forest-1', ...o });
const withBalls = (save: Save, n = 3): Save => ({ ...save, bag: { ...save.bag, 'poke-ball': n } });

function run(b0: BattleState, save: Save, ms: number, rng: Rng = new Rng(1)): BattleState {
  let b = b0;
  for (let t = 0; t < ms; t += STEP) b = battleStep(b, save, STEP, rng, { auto: false });
  return b;
}
const myTurn = (b: BattleState): BattleState => ({ ...b, phase: 'choose', me: { ...b.me, gauge: 1 } });
/** 정해진 차례로 값을 내는 랜덤 (다 쓰면 0.5) */
const seqRng = (vs: number[]): Rng => {
  const q = [...vs];
  return { next: () => q.shift() ?? 0.5, int: (lo: number) => lo, chance: (p: number) => (q.shift() ?? 0.5) < p, state: 1 } as unknown as Rng;
};
/** 던진 뒤 결과까지 (날아감 · 빨려 들어감 · 떨어짐) */
const AFTER_THROW = TIMING.catchFlyMs + TIMING.catchSuckMs + TIMING.catchDropMs;
/** 잡기가 끝날 때까지 걸음 */
function untilOut(b0: BattleState, save: Save, rng: Rng = new Rng(1)): BattleState {
  let b = b0;
  for (let i = 0; i < 200 && b.phase === 'catch'; i++) b = battleStep(b, save, STEP, rng, { auto: false });
  return b;
}

describe('S11 잡기 — 전투 흐름', () => {
  it('4 아이템 → 볼: 서 있는 상대 둘레 원 → Space = 그때 던짐 (완벽) → 날아감 · 빨려 들어감 · 떨어짐 · 흔들 3번 → 잡힘 (볼 1개 씀, 2026-10-20 태현 님 A안)', () => {
    const save = withBalls(sampleSave());
    const b = myTurn(startBattle(save, wild(), 'normal'));
    const ready = battleInput(b, save, { kind: 'act', action: { kind: 'item', item: 'poke-ball' } }, new Rng(1));
    expect(ready.phase).toBe('catch');
    expect(ready.bagUsed['poke-ball']).toBe(1);
    expect(ready.me.gauge).toBe(0);
    expect(catchTimeline(ready.catch!)).toBeNull(); // 아직 원이 줄어드는 중
    const thrown = battleInput(run(ready, save, TIMING.catchRingMs), save, { kind: 'space' }, fixedRng(0.01));
    expect(thrown.catch).toMatchObject({ pressMs: TIMING.catchRingMs, throwMs: TIMING.catchRingMs, caught: true, shakes: 3 });
    expect(thrown.msg).toContain('완벽');
    // 두 번째 누름은 안 셈
    expect(battleInput(thrown, save, { kind: 'space' }, fixedRng(0.99))).toBe(thrown);
    const tl = catchTimeline(thrown.catch!)!;
    expect(tl.done - tl.thrown).toBe(AFTER_THROW + 3 * TIMING.catchShakeMs + TIMING.catchEndMs);
    expect(run(thrown, save, AFTER_THROW + STEP).msg).toContain('흔들');
    const done = untilOut(thrown, save);
    expect([done.phase, done.result]).toEqual(['over', 'catch']);
    expect(done.catch?.ms).toBeGreaterThanOrEqual(tl.done);
    // 잡힌 뒤 끝은 다른 끝보다 짧게 ("잡았다!" 창 → 소개 카드)
    expect(battleDone(run(done, save, TIMING.catchOverMs))).toBe(true);
    expect(TIMING.catchOverMs).toBeLessThan(TIMING.battleOverMs);
  });

  it('안 누르면 원이 끝날 때 (늦게 누를 틈까지) 저절로 던짐 — 기본 확률 · 그 뒤 누름은 안 셈', () => {
    const save = withBalls(sampleSave());
    const ready = battleInput(myTurn(startBattle(save, wild(), 'normal')), save, { kind: 'act', action: { kind: 'item', item: 'poke-ball' } }, new Rng(1));
    const auto = run(ready, save, TIMING.catchRingMs + BALANCE.catchGoodMs + STEP, fixedRng(0.99));
    expect(auto.catch).toMatchObject({ pressMs: null, throwMs: TIMING.catchRingMs + BALANCE.catchGoodMs, caught: false });
    expect(battleInput(auto, save, { kind: 'space' }, fixedRng(0.01))).toBe(auto);
  });

  it('놓치면 상대 HP + 최대 HP 의 10% · 상대 게이지 가득 (먼저 공격) · 전투 계속 · 흔들 횟수 1 ~ 3 (잡힐 뻔할수록 많이)', () => {
    const save = withBalls(sampleSave());
    const b0 = startBattle(save, wild(), 'normal');
    const hp = Math.round(b0.foe.maxHp * 0.3);
    const ready = battleInput(myTurn({ ...b0, foe: { ...b0.foe, hp } }), save, { kind: 'act', action: { kind: 'item', item: 'poke-ball' } }, new Rng(1));
    const at = run(ready, save, 600);
    const once = battleInput(at, save, { kind: 'space' }, fixedRng(0.99));
    expect(once.catch).toMatchObject({ caught: false, shakes: 1 });
    expect(battleInput(at, save, { kind: 'space' }, seqRng([0.99, 0, 0])).catch?.shakes).toBe(3);
    expect(battleInput(at, save, { kind: 'space' }, seqRng([0.99, 0, 0.999])).catch?.shakes).toBe(2);
    const out = untilOut(once, save, fixedRng(0.99));
    expect(out.phase).toBe('run');
    expect(out.catch).toBeNull();
    expect(out.msg).toContain('빠져나와 덤벼든다');
    // 놓치면 창이 닫힌 뒤 숨 고르기 (catchFailPauseMs) 뒤에 이어 감 · 잡히면 바로
    const tl = catchTimeline(once.catch!)!;
    expect(tl.done - tl.end).toBe(TIMING.catchEndMs + TIMING.catchFailPauseMs);
    // "아깝다!" 는 중요한 순간 — 창이 닫히고 상대가 덤벼들기까지 1초 넘게 (ux-rules U1, 연속 캡처로 잰 창 ≈ 이 길이 − 0.1초)
    expect(tl.done - tl.end).toBeGreaterThanOrEqual(1100);
    expect(catchTimeline({ ...once.catch!, caught: true, shakes: 3 })!.done - catchTimeline({ ...once.catch!, caught: true, shakes: 3 })!.end).toBe(TIMING.catchEndMs);
    const heal = Math.max(1, Math.round(b0.foe.maxHp * BALANCE.catchFailHeal));
    expect(out.foe.hp).toBe(Math.min(b0.foe.maxHp, hp + heal));
    expect(out.foe.gauge).toBe(1);
    expect(out.popups.some((p) => p.side === 'foe' && p.kind === 'heal' && p.text === `+${heal}`)).toBe(true);
    // 다음 걸음에 상대가 먼저 덤빔 (내 게이지는 0 부터)
    const next = battleStep(out, save, STEP, fixedRng(0.5), { auto: false });
    expect(next.anim?.side).toBe('foe');
    // HP 가 가득하면 더 오르지 않음
    const full = untilOut(battleInput(run(battleInput(myTurn(b0), save, { kind: 'act', action: { kind: 'item', item: 'poke-ball' } }, new Rng(1)), save, 600), save, { kind: 'space' }, fixedRng(0.99)), save, fixedRng(0.99));
    expect(full.foe.hp).toBe(b0.foe.maxHp);
  });

  it('세 번 다 놓치면 상대가 도망 (경험치 없음) · 볼 기회를 다 쓰면 볼 메뉴 · 마지막 기회 없음 (2026-10-20 태현 님)', () => {
    const save = withBalls(sampleSave(), 5);
    const b = myTurn(startBattle(save, wild(), 'normal'));
    const ready = battleInput({ ...b, bagUsed: { 'poke-ball': 2 } }, save, { kind: 'act', action: { kind: 'item', item: 'poke-ball' } }, new Rng(1));
    expect(ready.phase).toBe('catch');
    const out = untilOut(battleInput(run(ready, save, 600), save, { kind: 'space' }, fixedRng(0.99)), save, fixedRng(0.99));
    expect([out.phase, out.result, out.escaped]).toEqual(['over', 'flee', true]);
    expect(out.msg).toContain('도망쳐 버렸다');
    expect(readBattle(viaJson(out))?.escaped).toBe(true);
    expect(readBattle({ ...viaJson(out), escaped: 'yes' })).toBeNull();
    const used3 = { ...b, bagUsed: { 'poke-ball': 3 } };
    expect(catchTriesUsed(used3)).toBe(3);
    expect(battleInput(used3, save, { kind: 'act', action: { kind: 'item', item: 'poke-ball' } }, new Rng(1))).toBe(used3);
    const lastHit = { ...used3, foe: { ...used3.foe, hp: 1 } };
    const won = run(battleInput(lastHit, save, { kind: 'act', action: { kind: 'attack' } }, fixedRng(0.5)), save, TIMING.attackAnimMs, fixedRng(0.5));
    expect([won.phase, won.result]).toEqual(['over', 'win']);
  });

  it('볼이 없거나 0개면 못 던짐', () => {
    const save = { ...sampleSave(), bag: {} };
    const b = myTurn(startBattle(save, wild(), 'normal'));
    expect(battleInput(b, save, { kind: 'act', action: { kind: 'item', item: 'poke-ball' } }, new Rng(1))).toBe(b);
  });

  it('이기면 마지막 기회 (볼이 있을 때) — 볼을 고르거나 · 안 던짐 · 시간이 지나면 · 안 볼 때는 바로 지나감', () => {
    const save = withBalls(sampleSave());
    const b0 = startBattle(save, wild(), 'normal');
    const lastHit = { ...myTurn(b0), foe: { ...b0.foe, hp: 1 } };
    const won = run(battleInput(lastHit, save, { kind: 'act', action: { kind: 'attack' } }, fixedRng(0.5)), save, TIMING.attackAnimMs, fixedRng(0.5));
    expect(won.phase).toBe('last');
    expect(battleInput(won, save, { kind: 'no-ball' }, new Rng(1))).toMatchObject({ phase: 'over', result: 'win' });
    const timeout = run(won, save, TIMING.lastChanceMs + STEP);
    expect([timeout.phase, timeout.result]).toEqual(['over', 'win']);
    const away = battleStep(won, save, STEP, new Rng(1), { auto: true, away: true });
    expect([away.phase, away.result]).toEqual(['over', 'win']);
    const thrown = battleInput(won, save, { kind: 'ball', ball: 'poke-ball' }, new Rng(1));
    expect(thrown.catch).toMatchObject({ last: true });
    // 마지막 기회에서 놓쳐도 보통처럼 — 10% 로 다시 일어나 전투 계속 · 먼저 덤빔 · 쓰러뜨린 기록 (경험치) 은 뺌 (2026-10-20 태현 님)
    const fail = untilOut(thrown, save, fixedRng(0.99));
    expect(fail.phase).toBe('run');
    expect(fail.result).toBeNull();
    expect(fail.foe.hp).toBe(Math.max(1, Math.round(fail.foe.maxHp * BALANCE.catchFailHeal)));
    expect([fail.foe.gauge, fail.me.gauge]).toEqual([1, 0]);
    expect(fail.foeDown).toHaveLength(won.foeDown.length - 1);
    expect(fail.msg).toContain('다시 일어났다');
    // 세 번째 기회를 마지막 기회로 써서 놓치면 도망이 아니라 이김 (쓰러뜨린 보상 그대로 — 2026-10-20 태현 님 "추천으로")
    const third = untilOut(battleInput({ ...won, bagUsed: { 'poke-ball': 2 } }, save, { kind: 'ball', ball: 'poke-ball' }, new Rng(1)), save, fixedRng(0.99));
    expect([third.phase, third.result, third.escaped]).toEqual(['over', 'win', undefined]);
    expect(third.foe.hp).toBe(0);
    expect(third.foeDown).toHaveLength(won.foeDown.length);
    // 볼이 없으면 마지막 기회 없이 바로 이김
    const none = { ...save, bag: {} };
    const noBall = run(battleInput({ ...lastHit }, none, { kind: 'act', action: { kind: 'attack' } }, fixedRng(0.5)), none, TIMING.attackAnimMs, fixedRng(0.5));
    expect([noBall.phase, noBall.result]).toEqual(['over', 'win']);
  });

  it('잡는 중 · 마지막 기회 전투 상태도 확장 ↔ 웹뷰로 그대로', () => {
    const save = withBalls(sampleSave());
    const b = myTurn(startBattle(save, wild(), 'normal'));
    const thrown = battleInput(b, save, { kind: 'act', action: { kind: 'item', item: 'great-ball' } }, new Rng(1));
    expect(thrown).toBe(b); // 슈퍼볼은 없음
    const t2 = battleInput(b, save, { kind: 'act', action: { kind: 'item', item: 'poke-ball' } }, new Rng(1));
    expect(readBattle(viaJson(t2))).toEqual(t2);
    expect(readBattle({ ...viaJson(t2), catch: { ...viaJson(t2).catch, ball: 'master-ball' } })).toBeNull();
    // 던진 뒤 (흔드는 중) 도 그대로
    const shaking = battleInput(run(t2, save, 600), save, { kind: 'space' }, fixedRng(0.99));
    expect(readBattle(viaJson(shaking))).toEqual(shaking);
    expect(readBattle({ ...viaJson(shaking), catch: { ...viaJson(shaking).catch, throwMs: null } })).toBeNull(); // 안 던졌는데 결과가 있음
    expect(readBattle({ ...viaJson(shaking), catch: { ...viaJson(shaking).catch, shakes: 9 } })).toBeNull();
    // 옛 상태 (던진 때 · 흔들 횟수 없음) — 원이 줄어드는 중 · 흔드는 중으로 이어 감
    const { throwMs: _t, shakes: _s, ...oldRing } = viaJson(t2).catch!;
    expect(readBattle({ ...viaJson(t2), catch: oldRing })?.catch).toMatchObject({ throwMs: null, shakes: 0 });
    const oldShake = { ...oldRing, ms: 1500, caught: true };
    expect(readBattle({ ...viaJson(t2), catch: oldShake })?.catch).toMatchObject({ throwMs: 1500 - AFTER_THROW, shakes: 3 });
  });
});

describe('S12 전투 결과 (mvp-spec 3.4 · 3.5 · 3.7)', () => {
  const won = (save: Save, foe = wild()): BattleState => ({ ...startBattle(save, foe, 'normal'), phase: 'over', result: 'win', foe: { ...startBattle(save, foe, 'normal').foe, hp: 0 } });

  it('경험치: 싸운 포켓몬은 다 · 팀 나머지는 절반 · 쓰러진 포켓몬은 없음', () => {
    const save = sampleSave();
    const r = battleRewards(save, won(save), null, 'forest-1', new Rng(1));
    const m1 = r.summary.exp.find((e) => e.uid === 'm1')!;
    const m2 = r.summary.exp.find((e) => e.uid === 'm2')!;
    expect(m1.gain).toBe(expGain({ species: 16, level: 4 }, 5));
    expect(m2.gain).toBe(expGain({ species: 16, level: 4 }, 3, { share: true }));
    expect(r.save.monsters.m1!.exp).toBe(save.monsters.m1!.exp + m1.gain);
    const fainted: Save = { ...save, monsters: { ...save.monsters, m2: { ...save.monsters.m2!, hp: 0 } } };
    expect(battleRewards(fainted, won(fainted), null, 'forest-1', new Rng(1)).summary.exp.map((e) => e.uid)).toEqual(['m1']);
  });

  it('돈 (30% · 레벨 × 5원) · 잭팟 · 아이템 (10%) — 이겼을 때만', () => {
    const save = sampleSave();
    const lucky = battleRewards(save, won(save), null, 'forest-1', fixedRng(0.001));
    expect(lucky.summary.money).toBe(4 * BALANCE.wildMoneyPerLevel + BALANCE.jackpotMoney);
    expect(lucky.save.money).toBe(save.money + lucky.summary.money);
    expect(lucky.summary.item).not.toBeNull();
    const unlucky = battleRewards(save, won(save), null, 'forest-1', fixedRng(0.99));
    expect([unlucky.summary.money, unlucky.summary.item]).toEqual([0, null]);
  });

  it('잡으면 팀에 (다 찼으면 보관함) · 지금 HP · 기술 · 잡은 종 기록 · 돈은 이길 때처럼 · 아이템은 없음', () => {
    const save: Save = { ...sampleSave(), pendingEncounter: { kind: 'wild', monster: wild(), start: 'normal' } };
    const b = { ...startBattle(save, wild(), 'normal'), phase: 'over' as const, result: 'catch' as const };
    const foeHp = { ...b, foe: { ...b.foe, hp: 3 } };
    const r = battleRewards(save, foeHp, wild(), 'forest-1', fixedRng(0.001));
    const uid = `m${save.nextMonsterUid}`;
    expect(r.save.party).toContain(uid);
    expect(r.save.monsters[uid]).toMatchObject({ species: 16, hp: 3, caughtAt: 'forest-1' });
    expect(r.save.dex.caught).toContain(16);
    expect(r.save.nextMonsterUid).toBe(save.nextMonsterUid + 1);
    expect(r.summary.caught).toEqual({ name: '구구', toBox: false, uid, isNew: !save.dex.caught.includes(16) });
    // 도감에 이미 있으면 isNew false (S12 소개 카드 NEW — 2026-10-20)
    expect(battleRewards({ ...save, dex: { ...save.dex, caught: [...save.dex.caught, 16] } }, foeHp, wild(), 'forest-1', fixedRng(0.001)).summary.caught?.isNew).toBe(false);
    expect(r.summary.money).toBe(4 * BALANCE.wildMoneyPerLevel + BALANCE.jackpotMoney);
    expect(r.summary.item).toBeNull();
    const fullTeam: Save = { ...save, party: ['m1', 'm2', 'm3', 'm4', 'm5'], monsters: { ...save.monsters, m3: sampleMonster({ uid: 'm3' }), m4: sampleMonster({ uid: 'm4' }), m5: sampleMonster({ uid: 'm5' }) }, nextMonsterUid: 6 };
    const boxed = battleRewards(fullTeam, foeHp, wild(), 'forest-1', new Rng(1));
    expect(boxed.save.box).toContain('m6');
    expect(boxed.summary.caught?.toBox).toBe(true);
  });

  it('레벨업으로 새 기술 (빈칸 = 바로 · 4칸 = 고르기) · 진화 고르기가 세이브에 남음', () => {
    const fullMoves = [33, 52, 55, 84].map((moveId) => ({ moveId, pp: 5 }));
    const save: Save = { ...sampleSave(), party: ['m1'], monsters: { m1: sampleMonster({ level: 15, exp: expForLevel(16) - 1, moves: fullMoves }) } };
    const r = battleRewards(save, won(save), null, 'forest-1', new Rng(1));
    expect(r.save.monsters.m1!.level).toBeGreaterThanOrEqual(16);
    expect(r.save.pendingChoices.some((c) => c.kind === 'evolve' && c.to === 2)).toBe(true);
    expect(r.summary.choices).toBe(r.save.pendingChoices.length);
  });
});

describe('S23 · S22 고르기 (save.pendingChoices)', () => {
  const fullMoves = [33, 52, 55, 84].map((moveId) => ({ moveId, pp: 5 }));
  const base = (choices: Save['pendingChoices'], m: Partial<Monster> = {}): Save => ({ ...sampleSave(), pendingChoices: choices, monsters: { ...sampleSave().monsters, m1: sampleMonster({ moves: fullMoves, level: 16, ...m }) } });

  it('새 기술: 바꿀 칸 · 배우지 않기 → 다음 고르기로', () => {
    const save = base([{ kind: 'learn', uid: 'm1', moveId: 22 }, { kind: 'learn', uid: 'm1', moveId: 75 }]);
    const replaced = resolveLearn(save, 1);
    expect(replaced.monsters.m1!.moves[1]!.moveId).toBe(22);
    expect(replaced.pendingChoices).toEqual([{ kind: 'learn', uid: 'm1', moveId: 75 }]);
    expect(resolveLearn(save, null).monsters.m1!.moves).toEqual(save.monsters.m1!.moves);
  });

  it('진화: 남긴 2 + 새 2 · 진화한 종 기록 · 멈추면 그대로 (다음 레벨업 때 다시)', () => {
    const save = base([{ kind: 'evolve', uid: 'm1', to: 2, newMoves: [75, 76], level: 16, item: null }]);
    const done = resolveEvolve(save, [52, 84], new Rng(1));
    expect(done.monsters.m1).toMatchObject({ species: 2, form: 'ivysaur' });
    expect(done.monsters.m1!.moves.map((s) => s.moveId)).toEqual([52, 84, 75, 76]);
    expect(done.dex.caught).toContain(2);
    expect(done.pendingChoices).toEqual([]);
    const cancelled = resolveEvolve(save, null, new Rng(1));
    expect(cancelled.monsters.m1!.species).toBe(1);
    expect(cancelled.pendingChoices).toEqual([]);
  });

  it('진화를 멈추면 같은 결과 안에서는 다시 안 물음 → 다음 레벨업 때 다시 (코드 리뷰어) · 진화한 뒤 오른 레벨의 기술은 진화한 모습 기준', () => {
    const save = base([{ kind: 'evolve', uid: 'm1', to: 2, newMoves: [75, 76], level: 16, item: null }], { level: 20 });
    const cancelled = resolveEvolve(save, null, new Rng(1));
    expect(cancelled.pendingChoices.some((c) => c.kind === 'evolve')).toBe(false);
    expect(levelUpChoices(cancelled.monsters.m1!, 20, 21, new Rng(1)).choices.some((c) => c.kind === 'evolve' && c.to === 2)).toBe(true);
    const evolved = resolveEvolve(save, [52, 84], new Rng(1));
    // 이상해풀은 Lv 20 에 잎날가르기 (이미 앎) — 새 고르기 없음
    expect(evolved.pendingChoices.every((c) => c.kind !== 'evolve' || c.to !== 2)).toBe(true);
  });

  it('가리키는 포켓몬이 없으면 그 고르기는 버림', () => {
    const save = { ...sampleSave(), pendingChoices: [{ kind: 'learn' as const, uid: 'm99', moveId: 22 }] };
    expect(resolveLearn(save, 0).pendingChoices).toEqual([]);
  });
});

describe('단계 7 검토에서 고친 것 (bugs #136 ~)', () => {
  it('내 팀도 다 쓰러졌으면 (반동 · 독) 마지막 기회 없음 — 잡아도 사라지던 것 (명세 검사관 · 코드 리뷰어)', () => {
    const save: Save = { ...withBalls(sampleSave()), party: ['m1'] };
    const b0 = startBattle(save, wild(), 'normal');
    const both = { ...myTurn(b0), me: { ...b0.me, hp: 1, status: { kind: 'poison' as const } }, foe: { ...b0.foe, hp: 1 } };
    const end = run(battleInput(both, save, { kind: 'act', action: { kind: 'attack' } }, fixedRng(0.5)), save, TIMING.attackAnimMs, fixedRng(0.5));
    expect(end.me.hp).toBe(0);
    expect([end.phase, end.result]).toEqual(['over', 'win']);
  });

  it('볼이 없으면 "볼이 없어 잡을 수 없어요" (mvp-spec S11 [제안])', () => {
    const save = { ...sampleSave(), bag: {} };
    const b0 = startBattle(save, wild(), 'normal');
    const won = run(battleInput({ ...myTurn(b0), foe: { ...b0.foe, hp: 1 } }, save, { kind: 'act', action: { kind: 'attack' } }, fixedRng(0.5)), save, TIMING.attackAnimMs, fixedRng(0.5));
    expect(won.msg).toContain('볼이 없어');
  });

  it('볼을 던진 것도 행동 — 놓치면 독 피해 (코드 리뷰어)', () => {
    const save = withBalls(sampleSave());
    const b0 = startBattle(save, wild(), 'normal');
    const sick = myTurn({ ...b0, me: { ...b0.me, status: { kind: 'poison' as const } } });
    const thrown = battleInput(sick, save, { kind: 'act', action: { kind: 'item', item: 'poke-ball' } }, new Rng(1));
    const broke = untilOut(thrown, save, fixedRng(0.99));
    expect(broke.me.hp).toBe(sick.me.hp - Math.max(1, Math.floor(sick.me.maxHp * BALANCE.poisonDamage)));
  });

  it('타이밍 원: 걸음이 되지 못한 시간까지 더해 판정 (그림과 같은 때)', () => {
    const save = withBalls(sampleSave());
    const thrown = battleInput(myTurn(startBattle(save, wild(), 'normal')), save, { kind: 'act', action: { kind: 'item', item: 'poke-ball' } }, new Rng(1));
    const at = run(thrown, save, 1000);
    expect(battleInput(at, save, { kind: 'space', extraMs: 30 }, new Rng(1)).catch?.pressMs).toBe(at.catch!.ms + 30);
    expect(battleInput(at, save, { kind: 'space', extraMs: 9999 }, new Rng(1)).catch?.pressMs).toBe(at.catch!.ms + STEP);
  });

  it('진화 새 기술은 "지금 기술에 없는 것" 기준 — 남기지 않은 지금 기술과 겹쳐도 4개를 넘지 않고 보여 준 새 기술을 버리지 않음 (코드 리뷰어)', () => {
    // 진화 전에 잎날가르기 (새 기술 후보) 를 이미 배움 → 새 기술은 솔라빔 하나 → 남길 기술 3
    const m = sampleMonster({ level: 16, moves: [33, 52, 75, 84].map((moveId) => ({ moveId, pp: 5 })) });
    const save = { ...sampleSave(), monsters: { ...sampleSave().monsters, m1: m }, pendingChoices: [{ kind: 'evolve' as const, uid: 'm1', to: 2, newMoves: [75, 76], level: 16, item: null }] };
    const done = resolveEvolve(save, [33, 52, 84], new Rng(1));
    expect(done.monsters.m1!.moves.map((s) => s.moveId)).toEqual([33, 52, 84, 76]);
  });
});
