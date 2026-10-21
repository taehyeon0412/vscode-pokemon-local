/** 다음 버전 4단계 "편의 묶음 2" (2026-10-21 orders #16 · gdd 7장) + 테스터가 찾은 것 (#11 · #13) */
import { describe, expect, it } from 'vitest';
import { fixedRng } from '../../../test/fixtures/rng';
import { sampleMonster, sampleSave, viaJson } from '../../../test/fixtures/save';
import { BALANCE, TIMING } from '../balance';
import { maxHpOf, sell, teamHealth } from '../rules/bag';
import { gymHint } from '../rules/trainer';
import type { Save } from '../save';
import { battleInput, battleStep, moveEffect, readBattle, startBattle, type BattleState } from './battle';
import { applyInput, step, walkLeftMs } from './play';
import { battleRewards, takeLaterChoices, useRareCandy } from './rewards';
import { Rng } from './rng';
import { createGameState, type GameState } from './state';

const STEP = TIMING.simStepMs;
const wild = (o = {}) => sampleMonster({ uid: 'w', species: 10, form: 'caterpie', level: 3, moves: [{ moveId: 33, pp: 35 }], ...o });
const hurt = (save: Save): Save => ({ ...save, monsters: { ...save.monsters, m1: { ...save.monsters.m1!, hp: 1 } } });
/** 팀 전원 HP 가득 · 상태 없음 (표본 기술 PP 는 이미 가득) */
const healthyOf = (save: Save): Save => ({ ...save, monsters: Object.fromEntries(Object.entries(save.monsters).map(([k, m]) => [k, { ...m, hp: maxHpOf(m), status: null }])) });

describe('#42 · #43 · #47 병원 · 팀 상태', () => {
  it('팀 상태 — HP % · 쓰러짐 · 다 건강 (HP · PP · 상태) · 위험 (절반 아래 · 쓰러짐)', () => {
    const full = healthyOf(sampleSave());
    expect(teamHealth(full)).toEqual({ hpPct: 100, fainted: 0, healthy: true, danger: false });
    expect(teamHealth(hurt(full))).toMatchObject({ healthy: false });
    const down = { ...full, monsters: { ...full.monsters, m2: { ...full.monsters.m2!, hp: 0 } } };
    expect(teamHealth(down)).toMatchObject({ fainted: 1, healthy: false, danger: true });
  });

  it('병원 앞: 다 건강하면 멈추지 않고 한 줄 · 아니면 멈춤 · [회복하고 가기] = 회복 + 지나감 한 번에', () => {
    const near = (save: Save): GameState => ({ ...createGameState(save, 7), runtime: { ...createGameState(save, 7).runtime, stage: { phase: 'walk' as const }, stageId: 'forest-1' as const } });
    const base = sampleSave({ stages: { 'forest-1': { ...sampleSave().stages['forest-1']!, progress: 0.4999 } } });
    let passed = near(healthyOf(base));
    for (let t = 0; t < 1000 && !passed.runtime.toast && passed.runtime.stage?.phase === 'walk'; t += STEP) passed = step(passed, STEP).state;
    expect(passed.runtime.stage?.phase).toBe('walk');
    expect(passed.runtime.toast?.text).toContain('병원 지나감');
    expect(passed.save.lastHospital).toEqual({ stageId: 'forest-1', at: 0.5 });
    let stopped = near(hurt(base));
    for (let t = 0; t < 1000 && stopped.runtime.stage?.phase === 'walk'; t += STEP) stopped = step(stopped, STEP).state;
    expect(stopped.runtime.stage?.phase).toBe('facility');
    const healed = applyInput(stopped, { kind: 'facility-heal' });
    expect(teamHealth(healed.save).healthy).toBe(true);
    expect(healed.runtime.stage?.phase).toBe('walk');
    expect(healed.save.lastHospital).toEqual({ stageId: 'forest-1', at: 0.5 });
    expect(healed.runtime.toast?.text).toContain('기운');
    // 상점 앞 · 병원 안에서는 안 받음
    expect(applyInput({ ...stopped, runtime: { ...stopped.runtime, stage: { phase: 'facility', kind: 'shop', at: 0.5, ms: 0, inside: false } } }, { kind: 'facility-heal' }).save).toBe(stopped.save);
  });
});

describe('#118 남은 걷기 · #6 · #44', () => {
  it('남은 걷기 = (1 − 진행) × 걷는 시간 (빨리 걷기면 그 빠르기로) · 스테이지가 아니면 null', () => {
    expect(walkLeftMs(sampleSave())).toBeCloseTo(0.6 * BALANCE.stageWalkMs);
    expect(walkLeftMs(sampleSave({ settings: { notifications: true, autoBattle: false, fastWalk: true } }))).toBeCloseTo((0.6 * BALANCE.stageWalkMs) / BALANCE.fastWalkSpeed);
    expect(walkLeftMs(sampleSave({ location: { screen: 'gym' } }))).toBeNull();
  });

  it('관장 힌트 — 관장 포켓몬 타입 · 둘 이상에게 효과가 굉장한 기술을 가진 내 포켓몬', () => {
    const fire = sampleMonster({ uid: 'm3', species: 4, form: 'charmander', moves: [{ moveId: 52, pp: 25 }] });
    const h = gymHint(sampleSave({ monsters: { ...sampleSave().monsters, m3: fire }, party: ['m1', 'm2', 'm3'] }));
    expect(h.text).toMatch(/^관장 나래는 .*벌레.* 포켓몬을 써요$/);
    expect(h.good).toContain('m3');
    expect(h.good).not.toContain('m2');
  });
});

describe('#22 Enter = 지난번 행동 · #31 미리 누르기 · #24 상성 · #127 두 번째 완벽 패링', () => {
  const save = sampleSave();
  const ready = (b: BattleState): BattleState => ({ ...b, phase: 'choose', me: { ...b.me, gauge: 1 } });

  it('Enter = 지난번 기술 다시 · 지난번이 없으면 아무 일 없음 · 다시 읽어도 남음', () => {
    const b0 = ready(startBattle(save, wild(), 'normal'));
    expect(battleInput(b0, save, { kind: 'repeat' }, new Rng(1))).toBe(b0);
    const used = battleInput(b0, save, { kind: 'act', action: { kind: 'move', moveId: 33 } }, new Rng(1));
    expect(used.lastMe).toEqual({ kind: 'move', moveId: 33 });
    expect(readBattle(viaJson(used))?.lastMe).toEqual({ kind: 'move', moveId: 33 });
    const again = battleInput(ready({ ...used, anim: null }), save, { kind: 'repeat' }, new Rng(1));
    expect(again.anim?.action).toEqual({ kind: 'move', moveId: 33 });
  });

  it('게이지가 차기 0.5초 전에 누르면 기억했다가 차자마자 · 더 이르면 안 받음', () => {
    const b0 = startBattle(save, wild(), 'normal');
    // 게이지를 거의 다 찬 곳에 두고 누름
    const near = { ...b0, phase: 'run' as const, me: { ...b0.me, gauge: 0.999 }, foe: { ...b0.foe, gauge: 0 } };
    const queued = battleInput(near, save, { kind: 'act', action: { kind: 'move', moveId: 33 } }, new Rng(1));
    expect(queued.queued).toEqual({ kind: 'move', moveId: 33 });
    let cur = queued;
    for (let t = 0; t < 1000 && !cur.anim; t += STEP) cur = battleStep(cur, save, STEP, new Rng(2), { auto: false, away: false });
    expect(cur.anim?.side).toBe('me');
    expect(cur.anim?.action).toEqual({ kind: 'move', moveId: 33 });
    const early = { ...near, me: { ...near.me, gauge: 0 } };
    expect(battleInput(early, save, { kind: 'act', action: { kind: 'move', moveId: 33 } }, new Rng(1))).toBe(early);
  });

  it('기술 버튼 상성 — 효과 배율 · 변화 기술은 null', () => {
    const b = startBattle(save, wild(), 'normal');
    expect(moveEffect(b, 33)).toBe(1);
    expect(moveEffect(b, 52)).toBe(2); // 불꽃세례 → 캐터피 (벌레)
    expect(moveEffect(b, 45)).toBeNull(); // 울음소리 (변화)
  });

  it('같은 전투 두 번째 완벽 패링부터 반격 기회까지 짧게 (1.4 → 1.0초)', () => {
    expect(TIMING.parryShowRepeatMs).toBeLessThan(TIMING.parryShowMs);
    const b = startBattle(save, wild(), 'normal');
    expect(readBattle(viaJson({ ...b, perfects: 2 }))?.perfects).toBe(2);
  });
});

describe('테스터가 찾은 것 (#11 · #13)', () => {
  it('자동 전투는 run 에서 바로 고르니 상처약도 거기서 (choose 를 거의 안 거침)', () => {
    const s = sampleSave({ bag: { potion: 3 } });
    const b0 = startBattle(s, wild(), 'normal');
    const b = { ...b0, phase: 'run' as const, me: { ...b0.me, hp: 1, gauge: 0.999 }, foe: { ...b0.foe, gauge: 0 } };
    let cur: BattleState = b;
    for (let t = 0; t < 1000 && !cur.anim; t += STEP) cur = battleStep(cur, s, STEP, fixedRng(0.5), { auto: true, away: false });
    expect(cur.anim?.action).toMatchObject({ kind: 'item', item: 'potion' });
  });

  it('보관함에 간 포켓몬의 쌓아 둔 기술 고르기는 꺼내지 않고 남김', () => {
    const later = [{ kind: 'learn' as const, uid: 'm2', moveId: 10 }, { kind: 'learn' as const, uid: 'm1', moveId: 10 }];
    const s = takeLaterChoices(sampleSave({ party: ['m1'], box: ['m2'], laterChoices: later }));
    expect(s.pendingChoices).toEqual([later[1]]);
    expect(s.laterChoices).toEqual([later[0]]);
  });

  it('이상한사탕은 일부러 쓴 것 — 선두가 아니어도 새 기술 고르기를 바로', () => {
    const r = useRareCandy(sampleSave({ bag: { 'rare-candy': 1 } }), 'm2', new Rng(3))!;
    expect(r.laterChoices).toBeUndefined();
  });

  it('돈 상한에서 팔면 실제로 는 돈만 · 하나도 못 받으면 안 팖', () => {
    expect(sell(sampleSave({ money: 999_999_999, bag: { pearl: 1 } }), 'pearl', 1)).toBeNull();
    expect(sell(sampleSave({ money: 999_999_800, bag: { pearl: 1 } }), 'pearl', 1)).toMatchObject({ money: 199, save: { money: 999_999_999 } });
  });

  it('야생을 이겨도 팔 물건 (6%) — 결과 상자에', () => {
    const s = sampleSave();
    const won = battleRewards(s, { ...startBattle(s, wild(), 'normal'), result: 'win' }, null, 'forest-1', fixedRng(0));
    expect(won.summary.treasure).toBeTruthy();
    expect(BALANCE.treasureChance.wild).toBe(0.06);
  });
});
