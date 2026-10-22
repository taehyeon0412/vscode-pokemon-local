import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fixedRng } from '../../../test/fixtures/rng';
import { sampleMonster, sampleSave, viaJson } from '../../../test/fixtures/save';
import { BALANCE, TIMING } from '../balance';
import { canInflict, fighterOf, parryGrade } from '../rules/battle';
import type { EncounterStart, Monster, Save } from '../save';
import {
  applyBattleResult,
  battleDone,
  battleInput,
  battleAutoUltLeft,
  battleFoeUltWarn,
  battleStep,
  battleWaiting,
  canAct,
  canUlt,
  canParry,
  canRiposte,
  counterOpen,
  itemLeft,
  readBattle,
  startBattle,
  ultCounterOpen,
  type BattleState,
} from './battle';
import type { Rng } from './rng';
import { Rng as SeededRng } from './rng';

const STEP = TIMING.simStepMs;
const TACKLE = 33;
const EMBER = 52;
const WATER_GUN = 55;
const ROLLOUT = 205;

const wildMon = (o: Partial<Monster> = {}): Monster =>
  sampleMonster({ uid: 'wild', species: 4, form: 'charmander', level: 5, moves: [{ moveId: EMBER, pp: 25 }], hp: 999, caughtAt: 'forest-1', ...o });

interface Setup {
  save?: Save;
  wild?: Monster;
  start?: EncounterStart;
  meSpeed?: number;
  foeSpeed?: number;
}

/** 전투 하나 — 스피드는 따로 정함 (기본 둘 다 50) */
function setup(o: Setup = {}): { b: BattleState; save: Save } {
  const save = o.save ?? sampleSave();
  const b = startBattle(save, o.wild ?? wildMon(), o.start ?? 'normal');
  return {
    save,
    b: {
      ...b,
      me: { ...b.me, stats: { ...b.me.stats, speed: o.meSpeed ?? 50 } },
      foe: { ...b.foe, stats: { ...b.foe.stats, speed: o.foeSpeed ?? 50 } },
    },
  };
}

function run(b0: BattleState, save: Save, ms: number, rng: Rng = new SeededRng(1), auto = false): BattleState {
  let b = b0;
  for (let t = 0; t < ms; t += STEP) b = battleStep(b, save, STEP, rng, { auto });
  return b;
}

function until(b0: BattleState, save: Save, done: (b: BattleState) => boolean, rng: Rng = new SeededRng(1), auto = false, maxMs = 120_000): BattleState {
  let b = b0;
  for (let t = 0; t < maxMs && !done(b); t += STEP) b = battleStep(b, save, STEP, rng, { auto });
  return b;
}

/** 내 차례 (고르는 중) 로 바로 */
const myTurn = (b: BattleState): BattleState => ({ ...b, phase: 'choose', anim: null, me: { ...b.me, gauge: 1 } });

describe('전투 시작 (mvp-spec 3.3 · 4장)', () => {
  it('보통 = 둘 다 0 · 선제공격 = 내 게이지가 찬 채 · 기습 = 상대 게이지가 찬 채', () => {
    const normal = setup().b;
    expect([normal.me.gauge, normal.foe.gauge, normal.phase]).toEqual([0, 0, 'run']);
    const pre = setup({ start: 'preemptive' });
    expect(pre.b.me.gauge).toBe(1);
    expect(battleStep(pre.b, pre.save, STEP, new SeededRng(1), { auto: false }).phase).toBe('choose');
    const amb = setup({ start: 'ambush' });
    expect(amb.b.foe.gauge).toBe(1);
    const next = battleStep(amb.b, amb.save, STEP, new SeededRng(1), { auto: false });
    expect(next.phase).toBe('anim');
    expect(next.anim?.side).toBe('foe');
  });

  it('나가는 포켓몬 = 쓰러지지 않은 첫 포켓몬 · 다 쓰러져 있으면 바로 짐', () => {
    const save = sampleSave();
    const fainted: Save = { ...save, monsters: { ...save.monsters, m1: { ...save.monsters.m1!, hp: 0 } } };
    expect(startBattle(fainted, wildMon(), 'normal').me.uid).toBe('m2');
    const all = { ...fainted, monsters: { ...fainted.monsters, m2: { ...fainted.monsters.m2!, hp: 0 } } };
    const b = startBattle(all, wildMon(), 'normal');
    expect([b.phase, b.result]).toEqual(['over', 'lose']);
  });
});

describe('행동 게이지 · 내 차례 (mvp-spec 3.3)', () => {
  it('스피드가 같으면 2.5초 뒤 내 차례 → 자동 전투가 꺼져 있으면 양쪽 멈추고 기다림', () => {
    const { b, save } = setup();
    const turn = until(b, save, (x) => x.phase === 'choose');
    expect(turn.t).toBeGreaterThanOrEqual(BALANCE.gaugeMs - STEP);
    expect(turn.t).toBeLessThanOrEqual(BALANCE.gaugeMs + STEP);
    expect(battleWaiting(turn)).toBe(true);
    const later = run(turn, save, 10_000);
    expect(later.phase).toBe('choose');
    expect(later.foe.gauge).toBe(turn.foe.gauge);
    expect(later.me.hp).toBe(turn.me.hp);
  });

  it('빠른 쪽이 더 자주 (최대 2배)', () => {
    const { b, save } = setup({ meSpeed: 50, foeSpeed: 100 });
    // 상대가 먼저 1.25초에 행동
    const first = until(b, save, (x) => x.phase !== 'run');
    expect(first.anim?.side).toBe('foe');
    expect(first.t).toBeLessThanOrEqual(BALANCE.gaugeMs / 2 + STEP);
  });

  it('자동 전투면 기다리지 않고 AI 가 고름', () => {
    const { b, save } = setup();
    const turn = until(b, save, (x) => x.phase === 'choose');
    const next = battleStep(turn, save, STEP, new SeededRng(3), { auto: true });
    expect(next.phase).toBe('anim');
    expect(next.anim?.side).toBe('me');
  });

  it('메뉴는 내 차례에만 · 지금 못 하는 입력은 그대로 돌려줌', () => {
    const { b, save } = setup();
    expect(canAct(b, save, { kind: 'attack' })).toBe(false);
    expect(battleInput(b, save, { kind: 'act', action: { kind: 'attack' } }, new SeededRng(1))).toBe(b);
    const turn = myTurn(b);
    expect(canAct(turn, save, { kind: 'attack' })).toBe(true);
    expect(canAct(turn, save, { kind: 'flee' })).toBe(true);
  });
});

describe('공격 · 스킬 · 연달아 세지는 기술', () => {
  it('1 공격 → 연출이 끝나면 피해 · 필살기 게이지 (때린 쪽 · 맞은 쪽 둘 다)', () => {
    const { b, save } = setup();
    const started = battleInput(myTurn(b), save, { kind: 'act', action: { kind: 'attack' } }, new SeededRng(1));
    expect([started.phase, started.anim?.dur, started.me.gauge]).toEqual(['anim', TIMING.attackAnimMs, 0]);
    expect(started.foe.hp).toBe(b.foe.maxHp);
    const done = run(started, save, TIMING.attackAnimMs);
    expect(done.foe.hp).toBeLessThan(done.foe.maxHp);
    expect(done.me.ult).toBeGreaterThan(0);
    expect(done.foe.ult).toBeGreaterThan(0);
    expect(done.popups.some((p) => p.side === 'foe' && p.kind === 'damage')).toBe(true);
  });

  it('스킬은 쓰는 순간 PP 1 · PP 가 0 이면 못 씀', () => {
    const { b, save } = setup();
    const started = battleInput(myTurn(b), save, { kind: 'act', action: { kind: 'move', moveId: TACKLE } }, new SeededRng(1));
    expect(started.me.moves.find((s) => s.moveId === TACKLE)?.pp).toBe(34);
    const empty = myTurn({ ...b, me: { ...b.me, moves: [{ moveId: TACKLE, pp: 0 }] } });
    expect(canAct(empty, save, { kind: 'move', moveId: TACKLE })).toBe(false);
    expect(battleInput(empty, save, { kind: 'act', action: { kind: 'move', moveId: TACKLE } }, new SeededRng(1))).toBe(empty);
  });

  it('연달아 쓸 때마다 +10% (2026-10-18 태현 님) · 다른 행동을 하면 처음부터', () => {
    const { b: b0, save } = setup();
    // 큰 숫자로 (반올림 오차가 작게) — 상대는 쓰러지지 않게 HP 를 크게
    const b = { ...b0, me: { ...b0.me, level: 50, stats: { ...b0.me.stats, attack: 120 }, moves: [{ moveId: ROLLOUT, pp: 20 }] }, foe: { ...b0.foe, maxHp: 99999, hp: 99999 } };
    const rng = fixedRng(0.5); // 명중 · 급소 없음 · 무작위 가운데
    const use = (x: BattleState, action: { kind: 'move'; moveId: number } | { kind: 'attack' }) => {
      const before = x.foe.hp;
      const after = run(battleInput(myTurn(x), save, { kind: 'act', action }, rng), save, TIMING.moveAnimMs, rng);
      return { b: after, dmg: before - after.foe.hp };
    };
    const r1 = use(b, { kind: 'move', moveId: ROLLOUT });
    const r2 = use(r1.b, { kind: 'move', moveId: ROLLOUT });
    const r3 = use(r2.b, { kind: 'move', moveId: ROLLOUT });
    expect(r2.b.me.streakCount).toBe(1);
    expect(r2.dmg / r1.dmg).toBeCloseTo(1.1, 1);
    expect(r3.dmg / r1.dmg).toBeCloseTo(1.2, 1);
    const reset = use(r3.b, { kind: 'attack' });
    expect(reset.b.me.streakCount).toBe(0);
    expect(reset.b.me.streakMove).toBeNull();
    expect(use(reset.b, { kind: 'move', moveId: ROLLOUT }).dmg).toBe(r1.dmg);
  });
});

describe('방어 (mvp-spec 4장)', () => {
  it('첫 번 0.5 → 연달아 0.75 → 그다음 1 · 다른 행동을 하면 풀림', () => {
    const { b, save } = setup();
    const guard = (x: BattleState) => run(battleInput(myTurn(x), save, { kind: 'act', action: { kind: 'guard' } }, new SeededRng(1)), save, TIMING.guardAnimMs);
    const g1 = guard(b);
    const g2 = guard(g1);
    const g3 = guard(g2);
    expect([g1.me.guard, g2.me.guard, g3.me.guard]).toEqual([0.5, 0.75, 1]);
    const attacked = battleInput(myTurn(g3), save, { kind: 'act', action: { kind: 'attack' } }, new SeededRng(1));
    expect([attacked.me.guard, attacked.me.guardStreak]).toEqual([1, 0]);
  });

  it('방어 중에 받는 피해가 줄어듦', () => {
    const { b, save } = setup();
    const foeAttacks = (x: BattleState) => {
      const ready = { ...x, phase: 'run' as const, anim: null, me: { ...x.me, gauge: 0 }, foe: { ...x.foe, gauge: 1 } };
      const rng = fixedRng(0.1); // 야생 AI: 공격 (30%)
      return run(ready, save, STEP + TIMING.attackAnimMs, rng);
    };
    const plain = foeAttacks(b);
    const guarded = foeAttacks({ ...b, me: { ...b.me, guard: 0.5 } });
    expect(b.me.hp - guarded.me.hp).toBeLessThan(b.me.hp - plain.me.hp);
  });
});

describe('쏘는 기술끼리 힘대결은 없음 — 패링은 등급만 · 완벽이면 반격 기회 → 반격기 (2026-10-20 태현 님 다시 기획)', () => {
  /** 상대가 불꽃세례를 쏘는 순간 (내 게이지 · 내 기술은 정함) */
  function foeShoots(myGauge: number, myMoves = [{ moveId: WATER_GUN, pp: 25 }]) {
    const { b, save } = setup();
    const ready = { ...b, me: { ...b.me, gauge: myGauge, moves: myMoves }, foe: { ...b.foe, gauge: 1 } };
    return { b: battleStep(ready, save, STEP, fixedRng(0.5), { auto: false }), save };
  }
  /** 완벽하게 막고 맞는 순간이 지난 뒤 — pre = 쳐내기 보여 주기 중 · after = 반격 기회 원이 뜸 */
  function riposteChance() {
    const { b, save } = foeShoots(0.6);
    const parried = battleInput(b, save, { kind: 'parry', ms: 80 }, new SeededRng(1));
    const pre = run(parried, save, TIMING.moveAnimMs + STEP, fixedRng(0.5));
    return { b, save, pre, after: run(pre, save, -pre.riposte!.ms, fixedRng(0.5)) };
  }

  it('완벽 패링 뒤 쳐내기 연출을 다 보여 준 뒤 반격 기회 (parryShowMs) — 그동안 원 · Space 없음 · 시간 멈춤 (2026-10-20 태현 님)', () => {
    const { save, pre, after } = riposteChance();
    expect(pre.phase).toBe('riposte');
    expect(pre.riposte!.ms).toBeLessThan(0);
    expect(pre.riposte!.ms).toBeGreaterThanOrEqual(-TIMING.parryShowMs);
    // "완벽 패링!" 글씨 1.4초가 다 보인 뒤 반격 기회 (2026-10-21 태현 님 A — 중요한 순간 1초 이상)
    expect(TIMING.parryShowMs).toBeGreaterThanOrEqual(1400);
    expect(canRiposte(pre)).toBe(false);
    expect(battleInput(pre, save, { kind: 'space' }, new SeededRng(1)).anim).toBeNull();
    expect([after.me.gauge, after.foe.gauge]).toEqual([pre.me.gauge, pre.foe.gauge]);
    expect(canRiposte(after)).toBe(true);
    expect(after.riposte!.ms).toBeLessThan(TIMING.simStepMs);
    expect(readBattle(viaJson(pre))?.riposte).toEqual(pre.riposte);
  });

  it('상대 쏘는 기술 + 내 쏘는 기술이어도 맞받아치기 창 · 힘대결 없음 — 막으면 등급만 (내 게이지 · PP 그대로)', () => {
    const { b, save } = foeShoots(0.6);
    expect(b.anim).toMatchObject({ side: 'foe', action: { kind: 'move', moveId: EMBER }, counter: false, dur: TIMING.moveAnimMs });
    expect(counterOpen(b)).toBe(false);
    const c = battleInput(b, save, { kind: 'parry', ms: 80 }, new SeededRng(1));
    expect(c.phase).toBe('anim');
    expect(c.anim?.parry).toBe('perfect');
    expect(c.me.gauge).toBe(b.me.gauge);
    expect(c.me.moves[0]!.pp).toBe(25);
  });

  it('완벽 패링 → 피해 0 · 맞은 뒤 반격 기회 (게이지가 멈춤) → 두 번째 원도 완벽이면 반격기 (필살기 피해의 절반 · 행동 게이지 그대로 · 필살기 게이지는 보통 공격처럼 참 — 2026-10-21 태현 님 A)', () => {
    const { b, save, pre, after } = riposteChance();
    expect(after.me.hp).toBe(b.me.hp);
    expect(after.phase).toBe('riposte');
    expect(after.riposte).toEqual({ ms: expect.any(Number), dur: TIMING.riposteRingMs });
    expect(canRiposte(after)).toBe(true);
    // "완벽 패링!" 글은 쳐내기를 보여 주는 동안 (parryShowMs 1.4초 — 반격 기회가 열릴 땐 이미 사라짐)
    expect(pre.popups.some((p) => p.text === '완벽 패링!' && p.kind === 'parry')).toBe(true);
    const later = run(after, save, 300, fixedRng(0.5));
    expect([later.me.gauge, later.foe.gauge]).toEqual([after.me.gauge, after.foe.gauge]);
    // 반격 기회 중엔 필살기 · 프로필 · 메뉴 없음
    expect(canUlt({ ...later, me: { ...later.me, ult: 1 } })).toBe(false);
    const ult0 = later.me.ult;
    const gauge0 = later.me.gauge;
    const r = battleInput(later, save, { kind: 'parry', ms: 50 }, new SeededRng(1));
    expect(r.anim).toMatchObject({ side: 'me', action: { kind: 'riposte' } });
    expect(r.msg).toContain('반격');
    expect(r.me.gauge).toBe(gauge0);
    const done = run(r, save, TIMING.ultAnimMs + STEP, fixedRng(0.5));
    expect(done.foe.hp).toBeLessThan(later.foe.hp);
    // 반격기도 보통 공격처럼 필살기 게이지 — 때린 나 (hit) · 맞은 상대 (hurt)
    expect(ult0).toBeLessThan(1);
    expect(done.me.ult).toBeGreaterThan(ult0);
    expect(done.foe.ult).toBeGreaterThan(later.foe.ult);
    // 피해 = 필살기 위력 × 절반 (필살 스탯) — 같은 무작위로 필살기와 견줌
    const ultDone = run(battleInput({ ...later, phase: 'run', riposte: null, me: { ...later.me, ult: 1 } }, save, { kind: 'ult' }, new SeededRng(1)), save, TIMING.ultAnimMs + STEP, fixedRng(0.5));
    expect(later.foe.hp - done.foe.hp).toBeLessThan(later.foe.hp - ultDone.foe.hp);
  });

  it('반격 기회에 보통 · 늦게 누르면 반격기 없이 이어 감 (한 번만) · 안 누르면 원이 지나간 뒤 이어 감', () => {
    const { save, after } = riposteChance();
    const good = battleInput(after, save, { kind: 'parry', ms: 450 }, new SeededRng(1));
    expect([good.phase, good.riposte]).toEqual(['run', null]);
    // 왜 안 나갔는지 은색 한 줄 (일찍 · 늦게)
    expect(good.popups.some((p) => p.kind === 'parry' && p.text.includes('조금 빨랐다'))).toBe(true);
    expect(battleInput(after, save, { kind: 'parry', ms: -150 }, new SeededRng(1)).popups.some((p) => p.text.includes('조금 늦었다'))).toBe(true);
    const idle = run(after, save, TIMING.riposteRingMs + TIMING.parryLateMs + STEP * 2, fixedRng(0.5));
    expect(idle.phase).not.toBe('riposte');
    // Space (엔진 시간) — 원이 맞는 때 근처면 반격기
    const near = { ...after, riposte: { ...after.riposte!, ms: TIMING.riposteRingMs - 100 } };
    expect(battleInput(near, save, { kind: 'space' }, new SeededRng(1)).anim?.action.kind).toBe('riposte');
  });

  it('보통 패링 (완벽 아님) 은 피해 ×0.5 · 반격 기회 없음 · 반격 기회도 저장 · 다시 읽기', () => {
    const { b, save } = foeShoots(0.6);
    const good = run(battleInput(b, save, { kind: 'parry', ms: 450 }, new SeededRng(1)), save, TIMING.moveAnimMs + STEP, fixedRng(0.5));
    expect(good.phase).not.toBe('riposte');
    expect(good.me.hp).toBeLessThan(b.me.hp);
    const { after } = riposteChance();
    expect(readBattle(viaJson(after))?.riposte).toEqual(after.riposte);
    expect(readBattle(viaJson({ ...after, riposte: null }))).toBeNull(); // 반격 단계인데 원이 없으면 못 읽음
  });

  it('필살기 힘대결 연타: Space 1번 = +1%p, 최대 20번 · 4초 뒤 확률로 승패 → 진 쪽 HP 가 깎임', () => {
    const { b, save } = setup();
    const foeUlt = battleStep({ ...b, me: { ...b.me, ult: 1 }, foe: { ...b.foe, ult: 1 }, foeUltWait: STEP }, save, STEP, fixedRng(0.5), { auto: false });
    let c = battleInput(foeUlt, save, { kind: 'ult' }, fixedRng(0.5));
    expect(c.phase).toBe('clash');
    for (let i = 0; i < 30; i++) c = battleInput(c, save, { kind: 'space' }, new SeededRng(1));
    expect(c.clash!.taps).toBe(20);
    const meWins = 0.5 < Math.min(BALANCE.clashCap, c.clash!.base + 0.2);
    const decided = run(c, save, TIMING.clashMs, fixedRng(0.5));
    expect(decided.clash?.winner).toBe(meWins ? 'me' : 'foe');
    expect(battleInput(decided, save, { kind: 'space' }, new SeededRng(1))).toBe(decided);
    const done = run(decided, save, TIMING.clashResultMs, fixedRng(0.5));
    if (meWins) expect(done.foe.hp).toBeLessThan(c.foe.hp);
    else expect(done.me.hp).toBeLessThan(c.me.hp);
  });
});

describe('패링 — 상대 공격이 맞기 직전 Space · 클릭 (2026-10-19 태현 님 A)', () => {
  /** 상대가 1 공격 (몸통박치기 모양) 을 하는 중 */
  function foeAttacks() {
    const { b, save } = setup({ wild: wildMon({ moves: [{ moveId: TACKLE, pp: 35 }] }) });
    const anim: BattleState = { ...b, phase: 'anim', me: { ...b.me, gauge: 0.1 }, anim: { side: 'foe', action: { kind: 'attack' }, ms: 0, dur: TIMING.attackAnimMs, counter: false } };
    return { b: anim, save };
  }
  const damageOf = (b: BattleState, save: Save) => b.me.hp - run(b, save, TIMING.attackAnimMs + STEP, fixedRng(0.5)).me.hp;

  it('등급: 맞기 0.6초 전 ~ 0.2초 뒤 = 막음, 0.3초 전 ~ 0.1초 뒤 = 완벽 (2026-10-20), 더 일찍 = 일찍 (이번 공격은 못 막음), 더 늦게 = 늦음', () => {
    expect(parryGrade(TIMING.parryEarlyMs + 1)).toBe('early');
    expect(parryGrade(TIMING.parryEarlyMs)).toBe('good');
    expect(parryGrade(TIMING.parryPerfectEarlyMs)).toBe('perfect');
    expect(parryGrade(0)).toBe('perfect');
    expect(parryGrade(-TIMING.parryPerfectLateMs)).toBe('perfect');
    expect(parryGrade(-TIMING.parryPerfectLateMs - 1)).toBe('good');
    expect(parryGrade(-TIMING.parryLateMs)).toBe('good');
    expect(parryGrade(-TIMING.parryLateMs - 1)).toBe('late');
  });

  it('막음 = 피해 절반 · 완벽 = 피해 0 + 내 행동 게이지 +20% · 글이 뜸', () => {
    const { b, save } = foeAttacks();
    const plain = damageOf(b, save);
    expect(plain).toBeGreaterThan(1);
    const good = battleInput(b, save, { kind: 'parry', ms: 450 }, new SeededRng(1));
    expect(damageOf(good, save)).toBe(Math.floor(plain * BALANCE.parryGoodFactor));
    const perfect = battleInput(b, save, { kind: 'parry', ms: 30 }, new SeededRng(1));
    const after = run(perfect, save, TIMING.attackAnimMs + STEP, fixedRng(0.5));
    expect(after.me.hp).toBe(b.me.hp);
    expect(after.me.gauge).toBeGreaterThanOrEqual(b.me.gauge + BALANCE.parryPerfectGauge - 1e-9);
    expect(after.popups.some((p) => p.text === '완벽 패링!')).toBe(true);
    // 피해 0 이면 "-0" · 상성 글은 안 띄움 (2026-10-20)
    expect(after.popups.some((p) => p.text === '-0')).toBe(false);
  });

  it('완벽 패링도 필살기 게이지는 맞은 것처럼 — 나 (맞는 쪽) · 상대 (치는 쪽) 모두 참, HP 만 지킴 (기획 검토 R1 A)', () => {
    const { b, save } = foeAttacks();
    const start = { ...b, me: { ...b.me, ult: 0 }, foe: { ...b.foe, ult: 0 } };
    const plain = run(start, save, TIMING.attackAnimMs + STEP, fixedRng(0.5));
    const perfect = run(battleInput(start, save, { kind: 'parry', ms: 30 }, new SeededRng(1)), save, TIMING.attackAnimMs + STEP, fixedRng(0.5));
    expect(perfect.me.hp).toBe(b.me.hp);
    expect(plain.me.ult).toBeGreaterThan(0);
    expect(perfect.me.ult).toBeCloseTo(plain.me.ult, 9);
    expect(perfect.foe.ult).toBeCloseTo(plain.foe.ult, 9);
  });

  it('글 종류 — 막음 parry · 상성 super (화면이 말 칸 · 숫자 크기로 나눠 씀, 2026-10-20)', () => {
    const { b, save } = setup();
    // 야생 파이리 불꽃세례 → 이상해씨 (풀) = 효과 굉장
    const shot: BattleState = { ...b, phase: 'anim', anim: { side: 'foe', action: { kind: 'move', moveId: EMBER }, ms: 0, dur: TIMING.moveAnimMs, counter: false } };
    const good = battleInput(shot, save, { kind: 'parry', ms: 450 }, new SeededRng(1));
    const after = run(good, save, TIMING.moveAnimMs + STEP, fixedRng(0.5));
    expect(after.popups.find((p) => p.text === '패링!')?.kind).toBe('parry');
    expect(after.popups.find((p) => p.text === '효과가 굉장했다!')?.kind).toBe('super');
    expect(after.popups.find((p) => p.text.startsWith('-'))?.kind).toBe('damage');
  });

  it('명중은 행동 시작 때 정함 — 빗나갈 기술은 anim.miss (연출이 미리 피하는 모양), 맞는 순간 그대로 빗나감 (2026-10-20)', () => {
    const { b, save } = setup();
    const mine = myTurn({ ...b, me: { ...b.me, moves: [{ moveId: 25, pp: 5 }] } }); // 메가톤킥 — 명중 75
    const missed = battleInput(mine, save, { kind: 'act', action: { kind: 'move', moveId: 25 } }, fixedRng(0.99));
    expect(missed.anim?.miss).toBe(true);
    const after = run(missed, save, TIMING.moveAnimMs + STEP, fixedRng(0.01));
    expect(after.popups.find((p) => p.text === '빗나갔다!')?.kind).toBe('miss');
    expect(after.foe.hp).toBe(b.foe.hp);
    const hitting = battleInput(mine, save, { kind: 'act', action: { kind: 'move', moveId: 25 } }, fixedRng(0.01));
    expect(hitting.anim?.miss).toBe(false);
    // 맞는 순간 무작위가 빗나감 쪽이어도 시작 때 정한 대로 맞음
    expect(run(hitting, save, TIMING.moveAnimMs + STEP, fixedRng(0.99)).foe.hp).toBeLessThan(b.foe.hp);
  });

  it('빗나갈 상대 기술을 막으면 "피했다!" · 완벽은 게이지 보상 그대로 (2026-10-20)', () => {
    const { b, save } = setup();
    const shot: BattleState = { ...b, phase: 'anim', me: { ...b.me, gauge: 0.1 }, anim: { side: 'foe', action: { kind: 'move', moveId: EMBER }, ms: 0, dur: TIMING.moveAnimMs, counter: false, miss: true } };
    const perfect = run(battleInput(shot, save, { kind: 'parry', ms: 30 }, new SeededRng(1)), save, TIMING.moveAnimMs + STEP, fixedRng(0.5));
    expect(perfect.popups.find((p) => p.text === '완벽 패링!')?.kind).toBe('parry');
    expect(perfect.popups.some((p) => p.text === '빗나갔다!')).toBe(false);
    expect(perfect.me.gauge).toBeGreaterThanOrEqual(0.1 + BALANCE.parryPerfectGauge - 1e-9);
    expect(perfect.me.hp).toBe(b.me.hp);
    const plain = run(shot, save, TIMING.moveAnimMs + STEP, fixedRng(0.5));
    expect(plain.popups.find((p) => p.text === '빗나갔다!')?.kind).toBe('miss');
  });

  it('처음 누른 것만 셈 — 너무 일찍 누르면 이번 공격은 못 막음 (연타 막기)', () => {
    const { b, save } = foeAttacks();
    const early = battleInput(b, save, { kind: 'parry', ms: 800 }, new SeededRng(1));
    expect(early.anim?.parry).toBe('early');
    expect(battleInput(early, save, { kind: 'parry', ms: 30 }, new SeededRng(1))).toBe(early);
    expect(damageOf(early, save)).toBe(damageOf(b, save));
  });

  it('내 공격 · 변화 기술 · 쓰러진 뒤에는 못 막음 · 화면이 맞는 순간을 모르면 Space 는 엔진 시간으로 어림', () => {
    const { b, save } = foeAttacks();
    expect(canParry(b)).toBe(true);
    expect(canParry({ ...b, anim: { ...b.anim!, side: 'me' } })).toBe(false);
    expect(canParry({ ...b, me: { ...b.me, hp: 0 } })).toBe(false);
    // 맞기 0.15초 전에 Space (엔진 시간) → 막음
    const near = { ...b, anim: { ...b.anim!, ms: TIMING.attackAnimMs - 450 } };
    expect(battleInput(near, save, { kind: 'space' }, new SeededRng(1)).anim?.parry).toBe('good');
  });
});

describe('필살기 (mvp-spec 3.3 · gdd S09 ⑧)', () => {
  // 예전 규칙 (저절로 쓰기 — R2) 을 보는 묶음: 켜고 봄 · 게임 값 (꺼짐 — 사용자가 눌러야만, orders #82) 은 'ultAutoUse 꺼짐' 테스트가 봄
  const autoUse = BALANCE as { ultAutoUse: boolean };
  const wasAutoUse = autoUse.ultAutoUse;
  beforeEach(() => {
    autoUse.ultAutoUse = true;
  });
  afterEach(() => {
    autoUse.ultAutoUse = wasAutoUse;
  });

  it('상대 기술 연출 중에 끼어들면 그 기술은 취소 — 상대 PP 는 깎인 채 (2026-10-18 태현 님)', () => {
    const { b, save } = setup();
    const ready = { ...b, me: { ...b.me, ult: 1 }, foe: { ...b.foe, gauge: 1 } };
    const foeMove = battleStep(ready, save, STEP, fixedRng(0.5), { auto: false });
    expect(foeMove.anim?.action).toEqual({ kind: 'move', moveId: EMBER });
    expect(foeMove.foe.moves[0]!.pp).toBe(24);
    expect(canUlt(foeMove)).toBe(true);
    const cut = battleInput(foeMove, save, { kind: 'ult' }, fixedRng(0.5));
    expect(cut.anim).toMatchObject({ side: 'me', action: { kind: 'ult' }, dur: TIMING.ultAnimMs });
    expect(cut.msg).toContain('끼어들었다');
    expect(cut.me.ult).toBe(0);
    expect(cut.foe.moves[0]!.pp).toBe(24);
    const done = run(cut, save, TIMING.ultAnimMs, fixedRng(0.5));
    expect(done.foe.hp).toBeLessThan(b.foe.hp);
    expect(done.me.hp).toBe(b.me.hp); // 불꽃세례는 안 맞음
  });

  it('고르는 중에도 쓸 수 있고, 끝나면 다시 내 차례 · 내 연출 중에는 못 씀 · 게이지가 안 찼으면 못 씀', () => {
    const { b, save } = setup();
    const turn = { ...myTurn(b), me: { ...myTurn(b).me, ult: 1 } };
    const ult = battleInput(turn, save, { kind: 'ult' }, fixedRng(0.5));
    expect(ult.phase).toBe('anim');
    expect(canUlt({ ...ult, me: { ...ult.me, ult: 1 } })).toBe(false);
    expect(run(ult, save, TIMING.ultAnimMs, fixedRng(0.5)).phase).toBe('choose');
    expect(canUlt({ ...turn, me: { ...turn.me, ult: 0.99 } })).toBe(false);
  });

  it('야생 필살기: 게이지가 차면 1초 뒤 (예고 "!" 가 1초 보이게 — 기획 검토 R4 · U1) · 달리는 중에만', () => {
    const { b, save } = setup();
    const full = battleStep({ ...b, foe: { ...b.foe, ult: 1 } }, save, STEP, fixedRng(0.5), { auto: false });
    expect(full.anim).toBeNull();
    expect(full.foeUltWait).toBe(BALANCE.wildUltWaitMs);
    expect(battleFoeUltWarn(full)).toEqual({ full: true, pct: 99 });
    const next = battleStep({ ...full, foeUltWait: STEP }, save, STEP, fixedRng(0.5), { auto: false });
    expect(next.anim).toMatchObject({ side: 'foe', action: { kind: 'ult' } });
    // 쓰기 시작해 컷인 전까지는 "!" 그대로 (디자인팀 #26 판정) · 80% 부터 % · 그 아래 없음 · 쓰러지면 없음
    expect(battleFoeUltWarn(next)).toEqual({ full: true, pct: 99 });
    expect(battleFoeUltWarn({ ...b, foe: { ...b.foe, ult: 0.85 } })).toEqual({ full: false, pct: 85 });
    expect(battleFoeUltWarn({ ...b, foe: { ...b.foe, ult: 0.79 } })).toBeNull();
    expect(battleFoeUltWarn({ ...b, foe: { ...b.foe, ult: 1, hp: 0 } })).toBeNull();
    const waiting = battleStep({ ...myTurn(b), foe: { ...b.foe, ult: 1 } }, save, STEP, fixedRng(0.5), { auto: false });
    expect(waiting.phase).toBe('choose');
  });

  it('상대 필살기에 1초 안에 Space · Z → 필살기 힘대결 (끼어들기는 안 됨)', () => {
    const { b, save } = setup();
    const foeUlt = battleStep({ ...b, me: { ...b.me, ult: 1 }, foe: { ...b.foe, ult: 1 }, foeUltWait: STEP }, save, STEP, fixedRng(0.5), { auto: false });
    expect(canUlt(foeUlt)).toBe(false);
    expect(ultCounterOpen(foeUlt)).toBe(true);
    for (const input of [{ kind: 'space' as const }, { kind: 'ult' as const }]) {
      const c = battleInput(foeUlt, save, input, fixedRng(0.5));
      expect(c.phase).toBe('clash');
      expect(c.clash?.kind).toBe('ult');
      expect(c.me.ult).toBe(0);
    }
    const late = run(foeUlt, save, TIMING.ultCounterWindowMs + STEP, fixedRng(0.5));
    expect(ultCounterOpen(late)).toBe(false);
  });

  it('기다림은 Z 를 누를 수 있을 때만 셈 · 다 되면 상대 기술 중에도 끼어듦 · 못 누를 때 누른 Z 는 예약 · 상대 예고는 컷인까지 (디자인팀 #26 판정)', () => {
    const { b, save } = setup();
    const full: BattleState = { ...b, me: { ...b.me, ult: 1 }, foe: { ...b.foe, ult: 0 } };
    // 내 공격 연출 중 = Z 못 누름 → 안 셈
    const mine: BattleState = { ...full, phase: 'anim', anim: { side: 'me', action: { kind: 'attack' }, ms: 0, dur: 5000, counter: false }, ultWait: 1000 };
    expect(battleStep(mine, save, STEP, fixedRng(0.5), { auto: true }).ultWait).toBe(1000);
    // 상대 기술 연출 중 = 누를 수 있음 → 셈 · 다 되면 끼어듦
    const foeMove: BattleState = { ...full, phase: 'anim', anim: { side: 'foe', action: { kind: 'move', moveId: EMBER }, ms: 0, dur: 5000, counter: false }, ultWait: BALANCE.ultAutoWaitMs - STEP };
    const cut = battleStep(foeMove, save, STEP, fixedRng(0.5), { auto: true });
    expect(cut.anim).toMatchObject({ side: 'me', action: { kind: 'ult' } });
    expect(cut.msg.startsWith('끼어들었다!')).toBe(true);
    // 손 전투 — 내 연출 중 Z = 예약 → 연출이 끝나 누를 수 있으면 바로
    const queued = battleInput({ ...mine, ultWait: undefined }, save, { kind: 'ult' }, fixedRng(0.5));
    expect(queued.ultQueued).toBe(true);
    const done = battleStep({ ...queued, anim: { ...queued.anim!, ms: queued.anim!.dur } }, save, STEP, fixedRng(0.5), { auto: false });
    let s = done;
    for (let t = 0; t < 1000 && !(s.anim?.side === 'me' && s.anim.action.kind === 'ult'); t += STEP) s = battleStep(s, save, STEP, fixedRng(0.5), { auto: false });
    expect(s.anim).toMatchObject({ side: 'me', action: { kind: 'ult' } });
    expect(s.ultQueued).toBeUndefined();
    // 자동 전투 — 내 포켓몬이 쓰러지면 볼 때는 autoPickMs 뒤 다음 포켓몬 (쓰러짐이 0 ~ 1장면이던 것 #530) · 안 볼 때는 바로
    const fallen: BattleState = { ...b, phase: 'pick', me: { ...b.me, hp: 0 }, bench: { m2: { hp: 20, moves: b.me.moves, status: null } } };
    const fallenSave = { ...save, party: [...save.party, 'm2'], monsters: { ...save.monsters, m2: { ...save.monsters[save.party[0]!]!, uid: 'm2', hp: 20 } } };
    let wait = fallen;
    for (let t = STEP; t < TIMING.autoPickMs; t += STEP) {
      wait = battleStep(wait, fallenSave, STEP, fixedRng(0.5), { auto: true });
      expect(wait.phase).toBe('pick');
    }
    expect(battleStep(wait, fallenSave, STEP, fixedRng(0.5), { auto: true }).phase).not.toBe('pick');
    expect(battleStep(fallen, fallenSave, STEP, fixedRng(0.5), { auto: true, away: true }).phase).not.toBe('pick');
    // 교체 연출 중 Z 는 예약 안 함 (들어오는 포켓몬 필살기로 나가던 것 — 테스터) · 저절로 못 나가는 단계는 남은 시간 없음
    const switching: BattleState = { ...full, phase: 'anim', anim: { side: 'me', action: { kind: 'switch', uid: 'x' }, ms: 0, dur: 700, counter: false } };
    expect(battleInput(switching, save, { kind: 'ult' }, fixedRng(0.5)).ultQueued).toBeUndefined();
    expect(battleAutoUltLeft({ ...full, phase: 'last' }, true)).toBeNull();
    // 자동 전투 · HP 30% 아래 · 다 참 → 상대 필살기 창에서 저절로 받아침 (태현 님 B) · 30% 이상 · 손 전투는 안 받아침
    const foeUltOpen: BattleState = { ...full, phase: 'anim', anim: { side: 'foe', action: { kind: 'ult' }, ms: 100, dur: TIMING.ultAnimMs, counter: false } };
    const lowHp = Math.ceil(full.me.maxHp * BALANCE.autoPotionBelow) - 1;
    // 볼 때는 창 끝에 (예고 "!" 가 1.2초 다 보인 뒤 — 한 장면만에 사라지던 것, U1 코드 리뷰어) · 안 볼 때는 바로
    let lowOpen: BattleState = { ...foeUltOpen, me: { ...foeUltOpen.me, hp: lowHp } };
    expect(battleStep(lowOpen, save, STEP, fixedRng(0.5), { auto: true }).phase).toBe('anim');
    expect(battleStep(lowOpen, save, STEP, fixedRng(0.5), { auto: true, away: true }).phase).toBe('clash');
    for (let t = 0; t < 3000 && lowOpen.phase === 'anim'; t += STEP) lowOpen = battleStep(lowOpen, save, STEP, fixedRng(0.5), { auto: true });
    expect(lowOpen.phase).toBe('clash');
    expect(battleFoeUltWarn({ ...foeUltOpen, anim: { ...foeUltOpen.anim!, ms: TIMING.ultCounterWindowMs - STEP } })?.full).toBe(true);
    expect(battleStep({ ...foeUltOpen, me: { ...foeUltOpen.me, hp: lowHp + 1 }, anim: { ...foeUltOpen.anim!, ms: TIMING.ultCounterWindowMs } }, save, STEP, fixedRng(0.5), { auto: true }).phase).toBe('anim');
    // 자동으로 기다리다 손으로 고르면 기다림 (pickMs) 도 지움 — 다음 쓰러짐의 기다림이 줄지 않게 (코드 리뷰어)
    const halfWait: BattleState = { ...b, phase: 'pick', me: { ...b.me, hp: 0 }, bench: { m2: { hp: 20, moves: b.me.moves, status: null } }, pickMs: 900 };
    const halfSave = { ...save, party: [...save.party, 'm2'], monsters: { ...save.monsters, m2: { ...save.monsters[save.party[0]!]!, uid: 'm2', hp: 20 } } };
    const picked = battleInput(halfWait, halfSave, { kind: 'pick', uid: 'm2' }, fixedRng(0.5));
    expect(picked.phase).toBe('run');
    expect(picked.pickMs).toBeUndefined();
    expect(battleStep({ ...foeUltOpen, me: { ...foeUltOpen.me, hp: lowHp } }, save, STEP, fixedRng(0.5), { auto: false }).phase).toBe('anim');
    // 예약한 Z 는 상대 필살기 맞받아치기 창이 열리면 그걸로 (코드 리뷰어)
    const foeUltNow: BattleState = { ...full, phase: 'anim', anim: { side: 'foe', action: { kind: 'ult' }, ms: 100, dur: TIMING.ultAnimMs, counter: false }, ultQueued: true };
    const countered = battleStep(foeUltNow, save, STEP, fixedRng(0.5), { auto: false });
    expect(countered.phase).toBe('clash');
    expect(countered.clash?.kind).toBe('ult');
    expect(countered.ultQueued).toBeUndefined();
    // 예약 Z · 자동 필살기가 나갈 때 상대가 기다리는 중이기만 하면 힘대결이 아님 — 야생은 맞받아치지 않음 (명세 검사관)
    const wildWaiting: BattleState = { ...full, foe: { ...full.foe, ult: 1 }, foeUltWait: 800, ultQueued: true };
    expect(battleStep(wildWaiting, save, STEP, fixedRng(0.5), { auto: false }).anim).toMatchObject({ side: 'me', action: { kind: 'ult' } });
    // HP 30% (자동 상처약 기준) 아래면 기다리지 않고 바로 (기획 #26 R2 ① — 3초 안에 쓰러져 날아가던 것)
    const low: BattleState = { ...full, me: { ...full.me, hp: Math.ceil(full.me.maxHp * BALANCE.autoPotionBelow) - 1 } };
    expect(battleAutoUltLeft(low, true)).toBe(0);
    expect(battleStep(low, save, STEP, fixedRng(0.5), { auto: true }).anim).toMatchObject({ side: 'me', action: { kind: 'ult' } });
    // 상대 필살기 기 모으기 ~ 컷인 전까지 예고 "!" 그대로
    const foeUlt: BattleState = { ...b, phase: 'anim', anim: { side: 'foe', action: { kind: 'ult' }, ms: 0, dur: TIMING.ultAnimMs, counter: false } };
    expect(battleFoeUltWarn(foeUlt)).toEqual({ full: true, pct: 99 });
    expect(battleFoeUltWarn({ ...foeUlt, anim: { ...foeUlt.anim!, ms: TIMING.ultCutInMs } })).toBeNull();
  });

  it('자동 전투 내 필살기 — 안 볼 때는 차면 바로 · 볼 때는 3초 (Z 반짝) 뒤 저절로 · 손 전투는 Z 를 기다림 (기획 검토 R2 A)', () => {
    const { b, save } = setup();
    const full = { ...b, me: { ...b.me, ult: 1 }, foe: { ...b.foe, ult: 0 } };
    const away = battleStep(full, save, STEP, fixedRng(0.5), { auto: true, away: true });
    expect(away.anim).toMatchObject({ side: 'me', action: { kind: 'ult' } });
    // 볼 때 — 3초 동안은 안 씀 (다른 행동은 함) · 남은 시간이 줄어듦
    let s: BattleState = full;
    let fired = -1;
    for (let t = STEP; t <= BALANCE.ultAutoWaitMs + 2000 && fired < 0; t += STEP) {
      s = battleStep(s, save, STEP, fixedRng(0.5), { auto: true });
      if (s.anim?.side === 'me' && s.anim.action.kind === 'ult') fired = t;
      else if (s.phase === 'anim' || s.phase === 'choose') s = { ...s, phase: 'run', anim: null, me: { ...s.me, gauge: 0 }, foe: { ...s.foe, gauge: 0 } };
    }
    expect(fired).toBeGreaterThanOrEqual(BALANCE.ultAutoWaitMs);
    expect(fired).toBeLessThan(BALANCE.ultAutoWaitMs + STEP * 2);
    expect(battleAutoUltLeft(battleStep(full, save, STEP, fixedRng(0.5), { auto: true }), true)).toBe(BALANCE.ultAutoWaitMs - STEP);
    expect(battleAutoUltLeft(full, false)).toBeNull();
    // 손 전투 (자동 꺼짐) 는 그대로 Z 를 기다림
    let manual: BattleState = full;
    for (let t = 0; t < BALANCE.ultAutoWaitMs + 1000; t += STEP) {
      manual = battleStep(manual, save, STEP, fixedRng(0.5), { auto: false });
      if (manual.phase !== 'run') manual = { ...manual, phase: 'run', anim: null, me: { ...manual.me, gauge: 0 }, foe: { ...manual.foe, gauge: 0 } };
    }
    expect(manual.me.ult).toBe(1);
    expect(manual.ultWait).toBeUndefined();
  });
});

describe('상태 이상 (원작 규칙 [제안])', () => {
  it('독: 내 행동이 끝날 때 최대 HP 의 1/8', () => {
    const { b, save } = setup();
    const sick = { ...b, me: { ...b.me, status: { kind: 'poison' as const } } };
    const done = run(battleInput(myTurn(sick), save, { kind: 'act', action: { kind: 'guard' } }, new SeededRng(1)), save, TIMING.guardAnimMs);
    expect(sick.me.hp - done.me.hp).toBe(Math.max(1, Math.floor(b.me.maxHp * BALANCE.poisonDamage)));
  });

  it('잠듦: 정해진 차례만큼 넘기고 깨어남', () => {
    const { b, save } = setup();
    const asleep = { ...b, me: { ...b.me, status: { kind: 'sleep' as const, turnsLeft: 2 } } };
    const s1 = battleInput(myTurn(asleep), save, { kind: 'act', action: { kind: 'attack' } }, new SeededRng(1));
    expect(s1.anim?.action.kind).toBe('skip');
    expect(s1.me.status).toEqual({ kind: 'sleep', turnsLeft: 1 });
    const s2 = battleInput(myTurn(run(s1, save, TIMING.guardAnimMs)), save, { kind: 'act', action: { kind: 'attack' } }, new SeededRng(1));
    expect(s2.anim?.action.kind).toBe('skip');
    expect(s2.me.status).toBeNull();
    expect(s2.msg).toContain('눈을 떴다');
  });

  it('마비: 25% 로 못 움직임 · 게이지 절반 빠르기', () => {
    const { b, save } = setup();
    const para = myTurn({ ...b, me: { ...b.me, status: { kind: 'paralysis' as const } } });
    expect(battleInput(para, save, { kind: 'act', action: { kind: 'attack' } }, fixedRng(0.1)).anim?.action.kind).toBe('skip');
    expect(battleInput(para, save, { kind: 'act', action: { kind: 'attack' } }, fixedRng(0.5)).anim?.action.kind).toBe('attack');
  });
});

describe('아이템 · 도망 · 교체', () => {
  it('상처약 +20 (최대 HP 까지) · 다 차 있으면 못 씀 · 쓴 만큼 끝나고 가방에서 뺌', () => {
    const save = { ...sampleSave(), bag: { ...sampleSave().bag, potion: 1 } };
    const { b } = setup({ save });
    const hurt = myTurn({ ...b, me: { ...b.me, hp: 5 } });
    expect(canAct(myTurn(b), save, { kind: 'item', item: 'potion' })).toBe(b.me.hp < b.me.maxHp);
    const used = run(battleInput(hurt, save, { kind: 'act', action: { kind: 'item', item: 'potion' } }, new SeededRng(1)), save, TIMING.itemAnimMs);
    expect(used.me.hp).toBe(Math.min(b.me.maxHp, 5 + BALANCE.potionHeal));
    expect(itemLeft(used, save, 'potion')).toBe(0);
    expect(canAct(myTurn({ ...used, me: { ...used.me, hp: 1 } }), save, { kind: 'item', item: 'potion' })).toBe(false);
    expect(applyBattleResult(save, used).bag.potion).toBe(0);
  });

  it('고급상처약 +120 · 풀회복약 = HP 가득 + 상태 이상 (HP 가득이어도 상태 이상이면 씀 — gdd 5.5)', () => {
    const save = { ...sampleSave(), bag: { ...sampleSave().bag, 'hyper-potion': 1, 'full-restore': 1 } };
    const { b } = setup({ save });
    const hurt = myTurn({ ...b, me: { ...b.me, hp: 2, status: { kind: 'burn' as const } } });
    // 고급상처약은 상태 이상 없이 (화상이면 쓴 뒤 화상 피해 1 — 풀회복약과 견줌)
    const hyper = run(battleInput({ ...hurt, me: { ...hurt.me, status: null } }, save, { kind: 'act', action: { kind: 'item', item: 'hyper-potion' } }, new SeededRng(1)), save, TIMING.itemAnimMs);
    expect(hyper.me.hp).toBe(Math.min(b.me.maxHp, 2 + BALANCE.hyperPotionHeal));
    expect(itemLeft(hyper, save, 'hyper-potion')).toBe(0);
    const full = run(battleInput(hurt, save, { kind: 'act', action: { kind: 'item', item: 'full-restore' } }, new SeededRng(1)), save, TIMING.itemAnimMs);
    expect(full.me.hp).toBe(b.me.maxHp);
    expect(full.me.status).toBeNull();
    expect(canAct(myTurn({ ...b, me: { ...b.me, hp: b.me.maxHp, status: { kind: 'poison' as const } } }), save, { kind: 'item', item: 'full-restore' })).toBe(true);
    // HP 가득 + 상태 이상만 고치면 "+0" 대신 상태 말 (코드 리뷰어 · 테스터 #75)
    const sickFull = myTurn({ ...b, me: { ...b.me, hp: b.me.maxHp, status: { kind: 'poison' as const } } });
    const cured = run(battleInput(sickFull, save, { kind: 'act', action: { kind: 'item', item: 'full-restore' } }, new SeededRng(1)), save, TIMING.itemAnimMs);
    expect(cured.me.status).toBeNull();
    expect(cured.popups.map((p) => p.text)).toContain('몸이 개운해졌다!');
    expect(cured.popups.map((p) => p.text)).not.toContain('+0');
    expect(canAct(myTurn({ ...b, me: { ...b.me, hp: b.me.maxHp, status: null } }), save, { kind: 'item', item: 'full-restore' })).toBe(false);
    expect(canAct(myTurn({ ...b, me: { ...b.me, hp: b.me.maxHp, status: { kind: 'poison' as const } } }), save, { kind: 'item', item: 'hyper-potion' })).toBe(false);
  });

  it('도망: 성공하면 끝 · 실패하면 다음엔 +10%p', () => {
    const { b, save } = setup();
    const ok = run(battleInput(myTurn(b), save, { kind: 'act', action: { kind: 'flee' } }, new SeededRng(1)), save, TIMING.fleeAnimMs, fixedRng(0));
    expect([ok.phase, ok.result]).toEqual(['over', 'flee']);
    expect(battleDone(ok)).toBe(false);
    expect(battleDone(run(ok, save, TIMING.battleOverMs))).toBe(true);
    const fail = run(battleInput(myTurn(b), save, { kind: 'act', action: { kind: 'flee' } }, new SeededRng(1)), save, TIMING.fleeAnimMs, fixedRng(0.99));
    expect(fail.result).toBeNull();
    expect(fail.fleeTries).toBe(1);
    expect(fail.msg).toContain('도망칠 수 없었다');
  });

  it('교체: 나와 있던 포켓몬 상태는 따로 두고 다른 포켓몬이 나옴', () => {
    const { b, save } = setup();
    const swapped = run(battleInput(myTurn({ ...b, me: { ...b.me, hp: 7 } }), save, { kind: 'act', action: { kind: 'switch', uid: 'm2' } }, new SeededRng(1)), save, TIMING.switchAnimMs);
    expect(swapped.me.uid).toBe('m2');
    expect(swapped.bench.m1?.hp).toBe(7);
    expect(applyBattleResult(save, { ...swapped, result: 'flee' }).monsters.m1!.hp).toBe(7);
  });

  it('쓰러지면 다음 포켓몬 고르기 (숫자) · 자동이면 알아서 · 다 쓰러지면 짐', () => {
    const { b, save } = setup();
    const ready = { ...b, me: { ...b.me, hp: 1, gauge: 0 }, foe: { ...b.foe, gauge: 1 } };
    const down = run(ready, save, STEP + TIMING.attackAnimMs, fixedRng(0.1));
    expect(down.me.hp).toBe(0);
    expect(down.phase).toBe('pick');
    expect(battleWaiting(down)).toBe(true);
    const picked = battleInput(down, save, { kind: 'pick', uid: 'm2' }, new SeededRng(1));
    expect([picked.me.uid, picked.phase]).toEqual(['m2', 'run']);
    // 볼 때는 쓰러진 모습을 보인 뒤 (autoPickMs, #530) · 안 볼 때는 바로
    expect(battleStep({ ...down, pickMs: TIMING.autoPickMs }, save, STEP, new SeededRng(1), { auto: true }).me.uid).toBe('m2');
    expect(battleStep(down, save, STEP, new SeededRng(1), { auto: true, away: true }).me.uid).toBe('m2');
    const lastSave = { ...save, monsters: { ...save.monsters, m2: { ...save.monsters.m2!, hp: 0 } } };
    const last = run({ ...ready }, lastSave, STEP + TIMING.attackAnimMs, fixedRng(0.1));
    expect([last.phase, last.result]).toEqual(['over', 'lose']);
  });
});

describe('전투 끝 → 세이브 (mvp-spec 3.3 · 9장)', () => {
  it('HP · PP · 상태 이상을 세이브에 · 상대 정보 지움', () => {
    const { b, save } = setup();
    const end: BattleState = { ...b, phase: 'over', result: 'win', me: { ...b.me, hp: 9, status: { kind: 'burn' }, moves: [{ moveId: TACKLE, pp: 30 }] } };
    const next = applyBattleResult({ ...save, pendingEncounter: { kind: 'wild', monster: wildMon(), start: 'normal' } }, end);
    expect(next.monsters.m1).toMatchObject({ hp: 9, status: { kind: 'burn' }, moves: [{ moveId: TACKLE, pp: 30 }] });
    expect(next.pendingEncounter).toBeNull();
    expect(save.monsters.m1!.hp).toBe(20); // 원래 세이브는 그대로
  });

  it('지면 전투 결과는 그대로 세이브에 (회복 · 돈 · 다시 시작은 S17 패배 — play.ts, 단계 9)', () => {
    const { b, save } = setup();
    const lost: BattleState = { ...b, phase: 'over', result: 'lose', me: { ...b.me, hp: 0, status: { kind: 'poison' }, moves: [{ moveId: TACKLE, pp: 0 }] } };
    const next = applyBattleResult(save, lost);
    expect(next.monsters.m1!.hp).toBe(0);
    expect(next.monsters.m1!.moves[0]!.pp).toBe(0);
    expect(next.pendingEncounter).toBeNull();
    expect(fighterOf).toBeTypeOf('function');
  });
});

describe('전투 상태 검사 (확장 ↔ 웹뷰)', () => {
  it('JSON 으로 오간 전투는 그대로 · 모양이 이상하면 null', () => {
    const { b, save } = setup();
    const mid = run(b, save, 3000);
    expect(readBattle(viaJson(mid))).toEqual(mid);
    expect(readBattle({ ...viaJson(mid), phase: 'dance' })).toBeNull();
    expect(readBattle({ ...viaJson(mid), me: { ...viaJson(mid).me, hp: 99999 } })).toBeNull();
    expect(readBattle({ ...viaJson(mid), phase: 'anim', anim: null })).toBeNull();
    expect(readBattle({ ...viaJson(mid), phase: 'clash', clash: null })).toBeNull();
    expect(readBattle('x')).toBeNull();
  });
});

describe('단계 5 · 6 검토에서 고친 것 (bugs #104 ~)', () => {
  // 예전 규칙 (저절로 쓰기 — R2) 을 보는 묶음: 켜고 봄 · 게임 값 (꺼짐 — 사용자가 눌러야만, orders #82) 은 'ultAutoUse 꺼짐' 테스트가 봄
  const autoUse = BALANCE as { ultAutoUse: boolean };
  const wasAutoUse = autoUse.ultAutoUse;
  beforeEach(() => {
    autoUse.ultAutoUse = true;
  });
  afterEach(() => {
    autoUse.ultAutoUse = wasAutoUse;
  });

  it('교체: 독 · 화상 피해는 들어가는 포켓몬이 받고, 나오는 포켓몬은 그대로 (코드 리뷰어)', () => {
    const { b, save } = setup();
    const sick = myTurn({ ...b, me: { ...b.me, status: { kind: 'poison' as const } } });
    const swapped = run(battleInput(sick, save, { kind: 'act', action: { kind: 'switch', uid: 'm2' } }, new SeededRng(1)), save, TIMING.switchAnimMs);
    const m2 = fighterOf(save.monsters.m2!);
    expect(swapped.me.uid).toBe('m2');
    expect(swapped.me.hp).toBe(m2.hp);
    expect(swapped.bench.m1?.hp).toBe(sick.me.hp - Math.max(1, Math.floor(sick.me.maxHp * BALANCE.poisonDamage)));
  });

  it('필살기 게이지는 매 전투 20% 에서 시작 — 내 편 · 상대 모두 (태현 님 #22)', () => {
    const { b } = setup();
    expect(BALANCE.ultStart).toBe(0.2);
    expect(b.me.ult).toBe(0.2);
    expect(b.foe.ult).toBe(0.2);
  });

  it('필살기 게이지는 포켓몬마다 — 교체로 들어갔다 나와도 이어짐 (플레이 리뷰어 · 명세 검사관)', () => {
    const { b, save } = setup();
    const charged = myTurn({ ...b, me: { ...b.me, ult: 0.6 } });
    const out = run(battleInput(charged, save, { kind: 'act', action: { kind: 'switch', uid: 'm2' } }, new SeededRng(1)), save, TIMING.switchAnimMs);
    // 처음 나온 포켓몬은 매 전투 시작 값 (#22)
    expect(out.me.ult).toBe(BALANCE.ultStart);
    const back = run(battleInput(myTurn(out), save, { kind: 'act', action: { kind: 'switch', uid: 'm1' } }, new SeededRng(1)), save, TIMING.switchAnimMs);
    expect(back.me.uid).toBe('m1');
    expect(back.me.ult).toBe(0.6);
  });

  it('패링은 내 행동이 아님 — 방어 · 연달아 · 게이지 그대로 (2026-10-20 힘대결 없앤 뒤)', () => {
    const { b, save } = setup();
    const ready = { ...b, me: { ...b.me, gauge: 0.8, guard: 0.5, guardStreak: 1, moves: [{ moveId: WATER_GUN, pp: 25 }] }, foe: { ...b.foe, gauge: 1 } };
    const foeShot = battleStep(ready, save, STEP, fixedRng(0.5), { auto: false });
    const c = battleInput(foeShot, save, { kind: 'parry', ms: 80 }, new SeededRng(1));
    expect(c.phase).toBe('anim');
    expect([c.me.guard, c.me.guardStreak, c.me.gauge]).toEqual([foeShot.me.guard, foeShot.me.guardStreak, foeShot.me.gauge]);
  });

  it('자동 전투에서 양쪽 필살기가 같은 걸음에 차면 필살기 힘대결 (4장 동시 필살기 — 명세 검사관 · 코드 리뷰어)', () => {
    const { b, save } = setup();
    // 안 볼 때 (내 필살기 바로 · 볼 때는 3초 기다린 뒤 — R2) · 상대도 이 걸음에 씀 (기다림 끝)
    const both = battleStep({ ...b, me: { ...b.me, ult: 1 }, foe: { ...b.foe, ult: 1 }, foeUltWait: STEP }, save, STEP, fixedRng(0.5), { auto: true, away: true });
    expect(both.phase).toBe('clash');
    expect(both.clash?.kind).toBe('ult');
    expect([both.me.ult, both.foe.ult]).toEqual([0, 0]);
  });

  it('기력의조각: 쓰러진 팀 포켓몬을 HP 절반으로 → 교체로 낼 수 있음 · 쓰러진 포켓몬이 없으면 못 씀 (명세 검사관)', () => {
    const base = sampleSave();
    const save: Save = { ...base, bag: { ...base.bag, revive: 1 }, monsters: { ...base.monsters, m2: { ...base.monsters.m2!, hp: 0 } } };
    const { b } = setup({ save });
    const turn = myTurn(b);
    expect(canAct(turn, save, { kind: 'item', item: 'revive' })).toBe(true);
    expect(canAct(myTurn(setup().b), sampleSave(), { kind: 'item', item: 'revive' })).toBe(false);
    const used = run(battleInput(turn, save, { kind: 'act', action: { kind: 'item', item: 'revive', uid: 'm2' } }, new SeededRng(1)), save, TIMING.itemAnimMs);
    const max = fighterOf({ ...save.monsters.m2!, hp: 99999 }).maxHp;
    expect(used.bench.m2?.hp).toBe(Math.max(1, Math.floor(max * BALANCE.reviveFraction)));
    expect(used.bagUsed.revive).toBe(1);
    expect(applyBattleResult(save, { ...used, phase: 'over', result: 'flee' }).monsters.m2!.hp).toBe(used.bench.m2!.hp);
  });

  it('이겼어도 내 팀이 다 쓰러져 있으면 (반동 · 독으로 같이) — 쓰러진 채 세이브에 (패배 S17 이 회복, play.ts)', () => {
    const { b, save } = setup();
    const solo: Save = { ...save, party: ['m1'] };
    const won: BattleState = { ...b, phase: 'over', result: 'win', me: { ...b.me, hp: 0 } };
    expect(applyBattleResult(solo, won).monsters.m1!.hp).toBe(0);
  });

  it('피해 글마다 순번 — 같은 걸음에 같은 글이 두 번 떠도 둘 다 (코드 리뷰어)', () => {
    const { b, save } = setup();
    const sick = { ...b, me: { ...b.me, status: { kind: 'poison' as const } } };
    const done = run(battleInput(myTurn(sick), save, { kind: 'act', action: { kind: 'guard' } }, new SeededRng(1)), save, TIMING.guardAnimMs);
    const ids = done.popups.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(done.popupSeq).toBe(Math.max(0, ...ids));
  });

  it('내 차례가 되면 "○○는 무엇을 할까?" (곁눈으로도 기다리는 중인 걸 알게 — 플레이 리뷰어)', () => {
    const { b, save } = setup();
    expect(until(b, save, (x) => x.phase === 'choose').msg).toContain('무엇을 할까?');
  });

  it('전투 상태 검사: 가방 · 교체 포켓몬 · 행동 · 결과 모양까지 (코드 리뷰어)', () => {
    const { b, save } = setup();
    const mid = viaJson(run(b, save, 3000));
    expect(readBattle(mid)).not.toBeNull();
    expect(readBattle({ ...mid, bagUsed: { potion: Number.NaN } })).toBeNull();
    expect(readBattle({ ...mid, bagUsed: { cake: 1 } })).toBeNull();
    expect(readBattle({ ...mid, bench: { m1: { hp: 5, moves: 'x', status: null } } })).toBeNull();
    expect(readBattle({ ...mid, phase: 'over', result: null })).toBeNull();
    expect(readBattle({ ...mid, phase: 'anim', anim: { side: 'me', action: { kind: 'move' }, ms: 0, dur: 900, counter: false } })).toBeNull();
    expect(readBattle({ ...mid, me: { ...mid.me, status: { kind: 'frozen' } } })).toBeNull();
  });
});

describe('단계 5 · 6 검토에서 고친 것 — 테스터', () => {
  it('효과가 없는 상대 (상성 0 · 타입 면역) 에게는 상태 이상이 안 걸림', () => {
    expect(canInflict('paralysis', 'normal', ['ghost'])).toBe(false);
    expect(canInflict('paralysis', 'electric', ['ground'])).toBe(false);
    expect(canInflict('poison', 'poison', ['steel'])).toBe(false);
    expect(canInflict('poison', 'grass', ['poison'])).toBe(false);
    expect(canInflict('burn', 'fire', ['fire'])).toBe(false);
    expect(canInflict('paralysis', 'electric', ['electric'])).toBe(false);
    expect(canInflict('sleep', 'grass', ['grass'])).toBe(true);
    expect(canInflict('burn', 'fire', ['grass'])).toBe(true);
  });

  it('흡수 · 반동 · 피해 숫자는 실제로 깎인 HP 기준 (남은 HP 보다 큰 피해는 넘치는 만큼 버림)', () => {
    const { b, save } = setup();
    const ABSORB = 71;
    const strong = myTurn({ ...b, me: { ...b.me, level: 50, hp: 5, stats: { ...b.me.stats, attack: 200 }, moves: [{ moveId: ABSORB, pp: 25 }] }, foe: { ...b.foe, hp: 1 } });
    const done = run(battleInput(strong, save, { kind: 'act', action: { kind: 'move', moveId: ABSORB } }, fixedRng(0.5)), save, TIMING.moveAnimMs, fixedRng(0.5));
    expect(done.foe.hp).toBe(0);
    expect(done.popups.find((p) => p.side === 'foe' && p.kind === 'damage')?.text).toBe('-1');
    expect(done.me.hp).toBe(5); // 1 의 50% = 0 (내림)
  });

  it('고르는 단계인데 고를 포켓몬이 없으면 기다리지 않고 짐', () => {
    const { b, save } = setup();
    const solo: Save = { ...save, party: ['m1'] };
    const stuck: BattleState = { ...b, phase: 'pick', me: { ...b.me, hp: 0 } };
    const next = battleStep(stuck, solo, STEP, new SeededRng(1), { auto: false });
    expect([next.phase, next.result]).toEqual(['over', 'lose']);
  });

  it('세이브에 돌려줄 때 HP 는 그 포켓몬 최대 HP 까지', () => {
    const { b, save } = setup();
    const odd: BattleState = { ...b, phase: 'over', result: 'flee', bench: { m2: { hp: 99999, moves: save.monsters.m2!.moves, status: null } } };
    expect(applyBattleResult(save, odd).monsters.m2!.hp).toBe(fighterOf({ ...save.monsters.m2!, hp: 1e6 }).maxHp);
  });

  it('나갈 포켓몬이 없이 시작한 전투는 "싸울 수 있는 포켓몬이 없다…"', () => {
    const save = sampleSave();
    const none: Save = { ...save, monsters: { m1: { ...save.monsters.m1!, hp: 0 }, m2: { ...save.monsters.m2!, hp: 0 } } };
    expect(startBattle(none, wildMon(), 'normal').msg).toContain('싸울 수 있는 포켓몬이 없다');
  });
});

describe('필살기는 사용자가 눌러야만 (orders #82 — BALANCE.ultAutoUse 꺼짐)', () => {
  it('1:1 — 자동 전투 · 안 볼 때 · HP 30% 아래에도 다 찬 필살기가 저절로 안 나감 · 보통 공격은 이어 감 · Z 를 누르면 나감', () => {
    expect(BALANCE.ultAutoUse).toBe(false);
    const { b, save } = setup();
    const full = { ...b, me: { ...b.me, ult: 1 }, foe: { ...b.foe, ult: 0 } };
    for (const opts of [{ auto: true, away: true }, { auto: true }, { auto: false }]) {
      let s: BattleState = { ...full, me: { ...full.me, hp: Math.floor(full.me.maxHp * 0.2) } };
      for (let t = 0; t < 6000; t += STEP) {
        s = battleStep(s, save, STEP, fixedRng(0.5), opts);
        expect(s.anim?.side === 'me' && s.anim.action.kind === 'ult', JSON.stringify(opts)).toBe(false);
        if (s.phase !== 'run') s = { ...s, phase: 'run', anim: null, me: { ...s.me, gauge: 0 }, foe: { ...s.foe, gauge: 0 } };
      }
      expect(s.me.ult).toBe(1);
    }
    expect(battleAutoUltLeft(full, true)).toBeNull();
    const pressed = battleInput(full, save, { kind: 'ult' }, fixedRng(0.5));
    expect(pressed.anim).toMatchObject({ side: 'me', action: { kind: 'ult' } });
  });
});
