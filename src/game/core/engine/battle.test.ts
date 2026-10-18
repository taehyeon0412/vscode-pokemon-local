import { describe, expect, it } from 'vitest';
import { fixedRng } from '../../../test/fixtures/rng';
import { sampleMonster, sampleSave, viaJson } from '../../../test/fixtures/save';
import { BALANCE, TIMING } from '../balance';
import { canInflict, clashChance, fighterOf } from '../rules/battle';
import type { EncounterStart, Monster, Save } from '../save';
import {
  applyBattleResult,
  battleDone,
  battleInput,
  battleStep,
  battleWaiting,
  canAct,
  canUlt,
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

describe('맞받아치기 · 힘대결 (mvp-spec 3.3 · S10)', () => {
  /** 상대가 불꽃세례를 쏘는 순간 (내 게이지 · 내 기술은 정함) */
  function foeShoots(myGauge: number, myMoves = [{ moveId: WATER_GUN, pp: 25 }]) {
    const { b, save } = setup();
    const ready = { ...b, me: { ...b.me, gauge: myGauge, moves: myMoves }, foe: { ...b.foe, gauge: 1 } };
    return { b: battleStep(ready, save, STEP, fixedRng(0.5), { auto: false }), save };
  }

  it('상대 쏘는 기술 + 내 게이지 절반 이상 + 내 쏘는 기술 → 1.5초 버튼 → Space = 힘대결 (게이지를 다 씀 · 내 PP 1)', () => {
    const { b, save } = foeShoots(0.6);
    expect(b.anim).toMatchObject({ side: 'foe', action: { kind: 'move', moveId: EMBER }, counter: true, dur: TIMING.counterWindowMs });
    expect(counterOpen(b)).toBe(true);
    const c = battleInput(b, save, { kind: 'space' }, new SeededRng(1));
    expect(c.phase).toBe('clash');
    expect(c.clash).toMatchObject({ kind: 'move', me: WATER_GUN, foe: EMBER, taps: 0 });
    expect(c.clash!.base).toBeCloseTo(clashChance(c.me.stats.attack * 40, c.foe.stats.attack * 40), 9);
    expect(c.me.gauge).toBe(0);
    expect(c.me.moves[0]!.pp).toBe(24);
  });

  it('연타: Space 1번 = +1%p, 최대 20번 · 4초 뒤 확률로 승패 → 진 쪽 HP 가 깎임', () => {
    const { b, save } = foeShoots(0.6);
    let c = battleInput(b, save, { kind: 'space' }, new SeededRng(1));
    for (let i = 0; i < 30; i++) c = battleInput(c, save, { kind: 'space' }, new SeededRng(1));
    expect(c.clash!.taps).toBe(20);
    // 0.5 < 확률이면 내가 이김 (연타로 +20%p 라 기본이 30% 를 넘으면 이김)
    const meWins = 0.5 < Math.min(BALANCE.clashCap, c.clash!.base + 0.2);
    // 4초 뒤 승자가 정해지고 (이긴 줄기가 뚫고 나가는 0.8초 — 연타는 더 안 셈) 그다음 피해
    const decided = run(c, save, TIMING.clashMs, fixedRng(0.5));
    expect(decided.phase).toBe('clash');
    expect(decided.clash?.winner).toBe(meWins ? 'me' : 'foe');
    expect(battleInput(decided, save, { kind: 'space' }, new SeededRng(1))).toBe(decided);
    expect([decided.me.hp, decided.foe.hp]).toEqual([c.me.hp, c.foe.hp]);
    const done = run(decided, save, TIMING.clashResultMs, fixedRng(0.5));
    expect(done.phase === 'run' || done.phase === 'choose' || done.phase === 'over').toBe(true);
    if (meWins) expect(done.foe.hp).toBeLessThan(c.foe.hp);
    else expect(done.me.hp).toBeLessThan(c.me.hp);
    expect(done.msg).toContain('힘대결');
  });

  it('내 게이지가 낮아도 쏘는 기술이 있으면 버튼이 뜸 — 누르면 게이지를 다 씀 (2026-10-18 태현 님)', () => {
    const low = foeShoots(0.1);
    expect(low.b.anim?.counter).toBe(true);
    expect(counterOpen(low.b)).toBe(true);
    const c = battleInput(low.b, low.save, { kind: 'space' }, new SeededRng(1));
    expect(c.phase).toBe('clash');
    expect(c.me.gauge).toBe(0);
  });

  it('쏘는 기술이 없으면 버튼이 안 뜸 → 그냥 맞음', () => {
    const noShot = foeShoots(0.9, [{ moveId: TACKLE, pp: 9 }]);
    expect(noShot.b.anim?.counter).toBe(false);
    expect(battleInput(noShot.b, noShot.save, { kind: 'space' }, new SeededRng(1))).toBe(noShot.b);
    const hit = run(noShot.b, noShot.save, TIMING.moveAnimMs, fixedRng(0.5));
    expect(hit.me.hp).toBeLessThan(noShot.b.me.hp);
  });

  it('누르지 않으면 1.5초 동안 날아온 뒤 맞음', () => {
    const { b, save } = foeShoots(0.6);
    const before = b.me.hp;
    expect(run(b, save, TIMING.counterWindowMs - STEP * 2, fixedRng(0.5)).me.hp).toBe(before);
    expect(run(b, save, TIMING.counterWindowMs, fixedRng(0.5)).me.hp).toBeLessThan(before);
  });
});

describe('필살기 (mvp-spec 3.3 · gdd S09 ⑧)', () => {
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

  it('야생 필살기: 게이지가 차면 바로 (달리는 중에만)', () => {
    const { b, save } = setup();
    const next = battleStep({ ...b, foe: { ...b.foe, ult: 1 } }, save, STEP, fixedRng(0.5), { auto: false });
    expect(next.anim).toMatchObject({ side: 'foe', action: { kind: 'ult' } });
    const waiting = battleStep({ ...myTurn(b), foe: { ...b.foe, ult: 1 } }, save, STEP, fixedRng(0.5), { auto: false });
    expect(waiting.phase).toBe('choose');
  });

  it('상대 필살기에 1초 안에 Space · Z → 필살기 힘대결 (끼어들기는 안 됨)', () => {
    const { b, save } = setup();
    const foeUlt = battleStep({ ...b, me: { ...b.me, ult: 1 }, foe: { ...b.foe, ult: 1 } }, save, STEP, fixedRng(0.5), { auto: false });
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

  it('자동 전투면 내 필살기도 차면 바로', () => {
    const { b, save } = setup();
    const next = battleStep({ ...b, me: { ...b.me, ult: 1 } }, save, STEP, fixedRng(0.5), { auto: true });
    expect(next.anim).toMatchObject({ side: 'me', action: { kind: 'ult' } });
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
    expect(battleStep(down, save, STEP, new SeededRng(1), { auto: true }).me.uid).toBe('m2');
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
  it('교체: 독 · 화상 피해는 들어가는 포켓몬이 받고, 나오는 포켓몬은 그대로 (코드 리뷰어)', () => {
    const { b, save } = setup();
    const sick = myTurn({ ...b, me: { ...b.me, status: { kind: 'poison' as const } } });
    const swapped = run(battleInput(sick, save, { kind: 'act', action: { kind: 'switch', uid: 'm2' } }, new SeededRng(1)), save, TIMING.switchAnimMs);
    const m2 = fighterOf(save.monsters.m2!);
    expect(swapped.me.uid).toBe('m2');
    expect(swapped.me.hp).toBe(m2.hp);
    expect(swapped.bench.m1?.hp).toBe(sick.me.hp - Math.max(1, Math.floor(sick.me.maxHp * BALANCE.poisonDamage)));
  });

  it('필살기 게이지는 포켓몬마다 — 교체로 들어갔다 나와도 이어짐 (플레이 리뷰어 · 명세 검사관)', () => {
    const { b, save } = setup();
    const charged = myTurn({ ...b, me: { ...b.me, ult: 0.6 } });
    const out = run(battleInput(charged, save, { kind: 'act', action: { kind: 'switch', uid: 'm2' } }, new SeededRng(1)), save, TIMING.switchAnimMs);
    expect(out.me.ult).toBe(0);
    const back = run(battleInput(myTurn(out), save, { kind: 'act', action: { kind: 'switch', uid: 'm1' } }, new SeededRng(1)), save, TIMING.switchAnimMs);
    expect(back.me.uid).toBe('m1');
    expect(back.me.ult).toBe(0.6);
  });

  it('맞받아치기도 내 행동 — 방어 · 연달아가 풀림 (코드 리뷰어)', () => {
    const { b, save } = setup();
    const ready = { ...b, me: { ...b.me, gauge: 0.8, guard: 0.5, guardStreak: 1, moves: [{ moveId: WATER_GUN, pp: 25 }] }, foe: { ...b.foe, gauge: 1 } };
    const foeShot = battleStep(ready, save, STEP, fixedRng(0.5), { auto: false });
    const c = battleInput(foeShot, save, { kind: 'space' }, new SeededRng(1));
    expect(c.phase).toBe('clash');
    expect([c.me.guard, c.me.guardStreak]).toEqual([1, 0]);
  });

  it('자동 전투에서 양쪽 필살기가 같은 걸음에 차면 필살기 힘대결 (4장 동시 필살기 — 명세 검사관 · 코드 리뷰어)', () => {
    const { b, save } = setup();
    const both = battleStep({ ...b, me: { ...b.me, ult: 1 }, foe: { ...b.foe, ult: 1 } }, save, STEP, fixedRng(0.5), { auto: true });
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
