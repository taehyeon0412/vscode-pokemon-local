/** 다음 버전 2단계 "돈 쓰는 재미" (2026-10-21 orders #13 · gdd 7장 2단계 값 — 숫자는 [임시값]) */
import { describe, expect, it } from 'vitest';
import { fixedRng } from '../../../test/fixtures/rng';
import { sampleMonster, sampleSave, viaJson } from '../../../test/fixtures/save';
import { BALANCE, TIMING } from '../balance';
import { sell, sellPrice } from '../rules/bag';
import { itemName, VALUABLES } from '../rules/items';
import { validateSave, type ItemId, type Save } from '../save';
import { startBattle, startTrainerBattle } from './battle';
import { applyInput, step } from './play';
import { battleRewards, pickTreasure, rivalWinRewards, runExpScale, useRareCandy } from './rewards';
import { Rng } from './rng';
import { createGameState, readRuntime, type GameState, type StageRuntime } from './state';

const STEP = TIMING.simStepMs;
const run0 = { startMs: 0, caught: 0, trainers: 0, seen: [], reach: 0, retries: 0 };
const prog = (o = {}) => ({ seed: 42, progress: 0.4, cleared: false, defeatedTrainers: [], facilities: [{ kind: 'shop' as const, at: 0.6 }], run: { ...run0 }, ...o });

function at(save: Partial<Save>, stage: StageRuntime | null): GameState {
  const s = createGameState(sampleSave(save), 7);
  return { ...s, runtime: { ...s.runtime, stage, stageId: s.save.location.screen === 'stage' ? s.save.location.stageId : null } };
}
const shop = (save: Partial<Save> = {}) => at({ money: 10_000, stages: { 'forest-1': prog({ progress: 0.6 }) }, ...save }, { phase: 'facility', kind: 'shop', at: 0.6, ms: 0, inside: true });
const wild = () => sampleMonster({ uid: 'w', species: 10, form: 'caterpie', level: 3, moves: [{ moveId: 33, pp: 35 }] });

describe('#125 팔 물건 — 무엇이 나올지', () => {
  it('흔함 (작은버섯 · 진주) 50% · 보통 35% · 드묾 15% — 큰금구슬은 안 나옴', () => {
    const tier = (id: ItemId) => BALANCE.treasureTiers.findIndex(([, items]) => (items as readonly string[]).includes(id));
    const rng = new Rng(12345);
    const n = 20_000;
    const count = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      const t = pickTreasure(rng);
      expect(t).not.toBe('big-nugget');
      count[tier(t)]! += 1;
    }
    expect(count[0]! / n).toBeCloseTo(0.5, 1);
    expect(count[1]! / n).toBeCloseTo(0.35, 1);
    expect(count[2]! / n).toBeCloseTo(0.15, 1);
    expect(pickTreasure(fixedRng(0.49))).toBe('tiny-mushroom');
    expect(pickTreasure(fixedRng(0.84))).toBe('stardust');
    expect(pickTreasure(fixedRng(0.99))).toBe('nugget');
  });

  it('잡았을 때 · 트레이너를 이겼을 때 받고 결과 상자에 이름 · 관장 첫 승 = 큰금구슬 · 라이벌마다 첫 승 = 금구슬', () => {
    const save = sampleSave();
    const caught = battleRewards(save, { ...startBattle(save, wild(), 'normal'), result: 'catch' }, wild(), 'forest-1', fixedRng(0));
    expect(caught.summary.treasure).toBe('작은버섯');
    expect(caught.save.bag['tiny-mushroom']).toBe(1);
    const missed = battleRewards(save, { ...startBattle(save, wild(), 'normal'), result: 'catch' }, wild(), 'forest-1', fixedRng(0.99));
    expect(missed.summary.treasure ?? null).toBeNull();
    const tb = { ...startTrainerBattle(save, [wild()], 'trainer', '반바지 꼬마 민수'), result: 'win' as const, foeDown: [{ species: 10, level: 3 }] };
    expect(battleRewards(save, tb, null, 'forest-1', fixedRng(0)).summary.treasure).toBe('작은버섯');
    const gym = { ...startTrainerBattle(save, [wild()], 'gym', '관장'), result: 'win' as const, foeDown: [{ species: 10, level: 3 }] };
    const g = battleRewards(save, gym, null, 'gym', fixedRng(0.99));
    expect(g.summary.treasure).toBe('큰금구슬');
    expect(g.save.bag['big-nugget']).toBe(1);
    const again = battleRewards({ ...save, badges: ['forest'] }, gym, null, 'gym', fixedRng(0.99));
    expect(again.save.bag['big-nugget']).toBeUndefined();
    const base = { title: '', exp: [], money: 100, item: null, caught: null, learned: [], choices: 0, badge: null };
    expect(rivalWinRewards(save, base, 'may', fixedRng(0.5)).save.bag.nugget).toBe(1);
    expect(rivalWinRewards({ ...save, rivals: { may: { wins: 1, losses: 0 } } }, base, 'may', fixedRng(0.5)).save.bag.nugget).toBeUndefined();
  });

  it('부탁을 끝내면 (성공) 약 25%', () => {
    let ok = 0;
    let got = 0;
    for (let seed = 1; seed <= 600; seed++) {
      const s0 = at({ stages: { 'forest-1': prog({ seed: seed * 7 }) } }, { phase: 'request', at: 0.5, number: 0, result: null, ms: 0 });
      const s = { ...s0, runtime: { ...s0.runtime, rngState: seed } };
      const r = applyInput(s, { kind: 'request', help: true });
      const res = r.runtime.stage?.phase === 'request' ? r.runtime.stage.result : null;
      if (!res?.ok) continue;
      ok++;
      if (VALUABLES.some((v) => (r.save.bag[v] ?? 0) > (s.save.bag[v] ?? 0))) {
        got++;
        expect(VALUABLES.some((v) => res.reward?.includes(itemName(v)))).toBe(true);
      }
    }
    expect(ok).toBeGreaterThan(100);
    expect(got / ok).toBeGreaterThan(0.17);
    expect(got / ok).toBeLessThan(0.33);
  });
});

describe('#126 상점 [팔기] — 정가의 50%', () => {
  it('팔 물건 · 볼 · 약은 반값 · 값이 없는 것 (진화의 돌) 은 못 팖', () => {
    expect(sellPrice('pearl')).toBe(500);
    expect(sellPrice('big-nugget')).toBe(5000);
    expect(sellPrice('potion')).toBe(150);
    expect(sellPrice('poke-ball')).toBe(100);
    expect(sellPrice('rare-candy')).toBe(1500);
    expect(sellPrice('leaf-stone')).toBe(0);
    for (const v of VALUABLES) expect(sellPrice(v)).toBe(BALANCE.valuablePrices[v as keyof typeof BALANCE.valuablePrices] * 0.5);
    const save = sampleSave({ money: 0, bag: { pearl: 2, 'leaf-stone': 1 } });
    expect(sell(save, 'pearl', 5)).toMatchObject({ count: 2, money: 1000, save: { money: 1000, bag: { pearl: 0 } } });
    expect(sell(save, 'leaf-stone', 1)).toBeNull();
    expect(sell(save, 'nugget', 1)).toBeNull();
  });

  it('상점 안에서만 · Shift = 5개까지 · 알림에 받은 돈', () => {
    const s = shop({ money: 0, bag: { pearl: 7 } });
    const one = applyInput(s, { kind: 'sell', item: 'pearl' });
    expect([one.save.money, one.save.bag.pearl]).toEqual([500, 6]);
    expect(one.runtime.toast?.text).toBe('진주를 팔았다! +500원');
    const five = applyInput(s, { kind: 'sell', item: 'pearl', count: 5 });
    expect([five.save.money, five.save.bag.pearl]).toEqual([2500, 2]);
    expect(applyInput(s, { kind: 'sell', item: 'pearl', count: 99 }).save.bag.pearl).toBe(2);
    const walking = at({ bag: { pearl: 1 } }, { phase: 'walk' });
    expect(applyInput(walking, { kind: 'sell', item: 'pearl' })).toBe(walking);
  });
});

describe('#50 Shift + 클릭 = 5개 · #70 이상한사탕 · 경험 부적', () => {
  it('사기 5개 — 돈이 모자라면 산 만큼', () => {
    const five = applyInput(shop({ money: 10_000 }), { kind: 'buy', item: 'potion', count: 5 });
    expect([five.save.money, five.save.bag.potion]).toEqual([10_000 - 5 * 300, 5]);
    expect(five.runtime.toast?.text).toBe('상처약을 5개 샀다!');
    const poor = applyInput(shop({ money: 700, bag: {} }), { kind: 'buy', item: 'potion', count: 5 });
    expect([poor.save.money, poor.save.bag.potion]).toEqual([100, 2]);
  });

  it('이상한사탕은 스테이지 상점에서 한 판에 1개 (5개를 눌러도 1개) · 대기실 상점엔 없음 · 새 판이면 다시', () => {
    const s = shop({ bag: {} });
    const once = applyInput(s, { kind: 'buy', item: 'rare-candy', count: 5 });
    expect(once.save.bag['rare-candy']).toBe(1);
    expect(once.save.stages['forest-1']!.run.candy).toBe(1);
    expect(applyInput(once, { kind: 'buy', item: 'rare-candy' })).toBe(once);
    const lobby = at({ money: 10_000, location: { screen: 'gym' } }, { phase: 'lobby' });
    expect(applyInput(lobby, { kind: 'buy', item: 'rare-candy' })).toBe(lobby);
    // 다음 판 (새 판) — 기록이 새로 생겨 다시 살 수 있음
    const fresh = shop({ stages: { 'forest-1': prog({ progress: 0.6, run: { ...run0 } }) } });
    expect(applyInput(fresh, { kind: 'buy', item: 'rare-candy' }).save.bag['rare-candy']).toBe(1);
  });

  it('이상한사탕 쓰기 = 1레벨 (경험치도 그 레벨 처음) · Lv 100 · 팀 밖은 못 씀', () => {
    const save = sampleSave({ bag: { 'rare-candy': 2 } });
    const r = useRareCandy(save, 'm1', new Rng(1))!;
    expect(r.monsters.m1!.level).toBe(save.monsters.m1!.level + 1);
    expect(r.bag['rare-candy']).toBe(1);
    expect(useRareCandy({ ...save, monsters: { ...save.monsters, m1: sampleMonster({ level: 100 }) } }, 'm1', new Rng(1))).toBeNull();
    expect(useRareCandy({ ...save, bag: {} }, 'm1', new Rng(1))).toBeNull();
    const s = at({ bag: { 'rare-candy': 1 } }, { phase: 'walk' });
    const used = applyInput(s, { kind: 'use-item', item: 'rare-candy', uid: 'm1' });
    expect(used.save.monsters.m1!.level).toBe(s.save.monsters.m1!.level + 1);
    expect(used.runtime.toast?.text).toContain(`Lv ${s.save.monsters.m1!.level + 1}`);
  });

  it('경험 부적 — 스테이지를 새로 시작할 때 1개를 써서 그 판 경험치 ×1.5 (전투 · 클리어 보너스) · 알림', () => {
    const cleared = at({ bag: { 'exp-charm': 1 }, stages: { 'forest-1': prog({ progress: 1, cleared: true }) } }, { phase: 'clear' });
    const went = applyInput(cleared, { kind: 'travel', to: 'forest-2' });
    expect(went.save.bag['exp-charm']).toBe(0);
    expect(went.save.stages['forest-2']!.run.boost).toBe(true);
    expect(runExpScale(went.save)).toBe(1.5);
    expect(went.runtime.toast?.text).toContain('경험 부적');
    const plain = applyInput({ ...cleared, save: { ...cleared.save, bag: {} } }, { kind: 'travel', to: 'forest-2' });
    expect(runExpScale(plain.save)).toBe(1);
    // 전투 경험치
    const b = { ...startBattle(went.save, wild(), 'normal'), result: 'win' as const };
    const boosted = battleRewards(went.save, b, null, 'forest-2', fixedRng(0.99)).summary.exp[0]!.gain;
    const normal = battleRewards(plain.save, b, null, 'forest-2', fixedRng(0.99)).summary.exp[0]!.gain;
    expect(boosted).toBe(Math.round(normal * 1.5));
    // 클리어 보너스 (한 줄 알림에도)
    const end = (save: Save) => {
      const s: GameState = { save: { ...save, stages: { ...save.stages, 'forest-2': { ...save.stages['forest-2']!, progress: 0.99999 } } }, runtime: { ...createGameState(save, 1).runtime, stage: { phase: 'walk' }, stageId: 'forest-2' } };
      let cur = s;
      for (let t = 0; t < 5000 && !cur.save.stages['forest-2']!.cleared; t += STEP) cur = step(cur, STEP).state;
      return cur;
    };
    // 클리어 보너스 — 받은 경험치 (선두) 가 ×1.5 · 판이 끝나도 판 기록 (boost) 이 남아 클리어 카드가 같은 수를 보임 (features/menu clearView)
    const done = end(went.save);
    const none = end(plain.save);
    expect(runExpScale(done.save, 'forest-2')).toBe(1.5);
    expect(done.save.monsters.m1!.exp - went.save.monsters.m1!.exp).toBeGreaterThan(none.save.monsters.m1!.exp - plain.save.monsters.m1!.exp);
  });
});

describe('세이브 · 진행 상태 — 저장하고 다시 불러오기', () => {
  it('새 물건 · 판 기록 (사탕 · 부적) 이 그대로 · 옛 세이브엔 칸이 안 생김', () => {
    const save = sampleSave({ bag: { pearl: 3, 'big-nugget': 1, 'rare-candy': 1, 'exp-charm': 2 }, stages: { 'forest-1': prog({ run: { ...run0, candy: 1, boost: true } }) } });
    const r = validateSave(viaJson(save));
    expect(r.ok && r.save).toEqual(save);
    expect(r.ok && r.problems).toEqual([]);
    const old = validateSave(viaJson(sampleSave()));
    expect(old.ok && ('candy' in old.save.stages['forest-1']!.run || 'boost' in old.save.stages['forest-1']!.run)).toBe(false);
  });

  it('결과 상자의 팔 물건 이름이 웹뷰 ↔ 확장으로 넘겨도 남음', () => {
    const summary = { title: 't', exp: [], money: 0, item: null, treasure: '진주', caught: null, learned: [], choices: 0, badge: null };
    const st = readRuntime(viaJson({ rngState: 1, stepAccMs: 0, stage: { phase: 'result', summary, ms: 0 } }), 1).stage;
    expect(st?.phase === 'result' && st.summary.treasure).toBe('진주');
  });
});
