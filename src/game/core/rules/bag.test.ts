import { describe, expect, it } from 'vitest';
import { sampleMonster, sampleSave } from '../../../test/fixtures/save';
import { BALANCE } from '../balance';
import { Rng } from '../engine/rng';
import { resolveEvolve } from '../engine/rewards';
import type { Save } from '../save';
import { buy, fieldUseBlock, healTeam, itemEvolution, maxHpOf, moveInTeam, priceOf, spendPoint, swapWithBox, teamHealthy, toBox, useFieldItem } from './bag';

const GLOOM = 44;
const withBox = (): Save => {
  const s = sampleSave();
  return { ...s, monsters: { ...s.monsters, m3: sampleMonster({ uid: 'm3', species: 13, form: 'weedle', level: 4 }) }, box: ['m3'], nextMonsterUid: 4 };
};

describe('S13 병원 · S14 상점 (mvp-spec S13 · S14 · 4장)', () => {
  it('회복 = 팀 전부 HP · PP · 상태 이상 (무료)', () => {
    const s = sampleSave();
    const hurt = { ...s, monsters: { ...s.monsters, m1: { ...s.monsters.m1!, hp: 0, status: { kind: 'poison' as const }, moves: [{ moveId: 33, pp: 0 }] } } };
    expect(teamHealthy(hurt)).toBe(false);
    const h = healTeam(hurt);
    expect(h.monsters.m1!.hp).toBe(maxHpOf(h.monsters.m1!));
    expect(h.monsters.m1!.status).toBeNull();
    expect(h.monsters.m1!.moves[0]!.pp).toBe(35);
    expect(teamHealthy(h)).toBe(true);
    expect(hurt.monsters.m1!.hp).toBe(0); // 원래 세이브는 그대로
  });

  it('사기 — 값만큼 돈이 줄고 가방에 하나 · 돈이 모자라면 안 됨', () => {
    const s = { ...sampleSave(), money: 500 };
    const one = buy(s, 'poke-ball')!;
    expect(one.money).toBe(500 - priceOf('poke-ball'));
    expect(one.bag['poke-ball']).toBe((s.bag['poke-ball'] ?? 0) + 1);
    expect(buy(s, 'ultra-ball')).toBeNull();
    expect(priceOf('revive')).toBe(1500);
  });
});

describe('S18 내 포켓몬 — 팀 · 보관함 · 포인트 (gdd 4.10)', () => {
  it('팀 순서 ← → (맨 앞 = 선두) · 끝을 넘으면 안 됨', () => {
    const s = sampleSave();
    expect(moveInTeam(s, 'm2', -1)!.party).toEqual(['m2', 'm1']);
    expect(moveInTeam(s, 'm1', -1)).toBeNull();
    expect(moveInTeam(s, 'm2', 1)).toBeNull();
  });

  it('보관함 포켓몬을 빈 칸에 · 팀 칸과 바꿈 · 팀에서 보관함으로 (하나는 남김)', () => {
    const s = withBox();
    expect(swapWithBox(s, 'm3', null)).toMatchObject({ party: ['m1', 'm2', 'm3'], box: [] });
    expect(swapWithBox(s, 'm3', 'm1')).toMatchObject({ party: ['m3', 'm2'], box: ['m1'] });
    expect(toBox(s, 'm2')).toMatchObject({ party: ['m1'], box: ['m3', 'm2'] });
    expect(toBox({ ...s, party: ['m1'] }, 'm1')).toBeNull();
    // 팀이 다 찼으면 빈 칸에 못 넣음
    expect(swapWithBox({ ...s, party: ['m1', 'm2', 'm1', 'm2', 'm1'] }, 'm3', null)).toBeNull();
  });

  it('살아 있는 포켓몬이 팀에 하나는 남아야 함 (다 쓰러진 팀으로 걷지 않게)', () => {
    const s = withBox();
    const m3down = { ...s, monsters: { ...s.monsters, m3: { ...s.monsters.m3!, hp: 0 }, m2: { ...s.monsters.m2!, hp: 0 } } };
    expect(swapWithBox(m3down, 'm3', 'm1')).toBeNull();
    expect(toBox(m3down, 'm1')).toBeNull();
  });

  it('남은 포인트 나누기 — HP 에 넣으면 지금 HP 도 그만큼', () => {
    const s = sampleSave();
    const m = s.monsters.m1!;
    const r = spendPoint(s, 'm1', 'hp')!;
    const n = r.monsters.m1!;
    expect(n.points.hp).toBe(m.points.hp + 1);
    expect(n.unspentPoints).toBe(m.unspentPoints - 1);
    expect(n.hp - m.hp).toBe(maxHpOf(n) - maxHpOf(m));
    expect(spendPoint({ ...s, monsters: { ...s.monsters, m1: { ...m, unspentPoints: 0 } } }, 'm1', 'attack')).toBeNull();
  });
});

describe('S19 가방 — 전투 밖 (mvp-spec S19 막는 것 [제안])', () => {
  it('쓰러진 포켓몬에 상처약 · HP 가득에 상처약 · 살아 있는 포켓몬에 기력의조각 · 진화 안 하는 포켓몬에 돌은 막음', () => {
    const m = sampleMonster();
    expect(fieldUseBlock({ ...m, hp: 0 }, 'potion')).not.toBeNull();
    expect(fieldUseBlock({ ...m, hp: maxHpOf(m) }, 'potion')).not.toBeNull();
    expect(fieldUseBlock({ ...m, hp: 1 }, 'potion')).toBeNull();
    expect(fieldUseBlock(m, 'revive')).not.toBeNull();
    expect(fieldUseBlock({ ...m, hp: 0 }, 'revive')).toBeNull();
    expect(fieldUseBlock(m, 'leaf-stone')).not.toBeNull();
    expect(fieldUseBlock(m, 'poke-ball')).not.toBeNull();
    expect(fieldUseBlock(sampleMonster({ species: GLOOM, form: 'gloom' }), 'leaf-stone')).toBeNull();
    expect(itemEvolution(sampleMonster({ species: GLOOM, form: 'gloom' }), 'leaf-stone')).toBe(45);
    // 연결의끈 = 교환 진화 (롱스톤 → 강철톤)
    expect(itemEvolution(sampleMonster({ species: 95, form: 'onix' }), 'linking-cord')).toBe(208);
  });

  it('상처약 · 기력의조각 — 가방에서 하나 빼고 회복', () => {
    const s = { ...sampleSave(), bag: { potion: 2, revive: 1 } };
    const r = useFieldItem(s, 'potion', 'm1')!;
    expect(r.save.bag.potion).toBe(1);
    expect(r.save.monsters.m1!.hp).toBe(Math.min(maxHpOf(s.monsters.m1!), s.monsters.m1!.hp + BALANCE.potionHeal));
    const down = { ...s, monsters: { ...s.monsters, m2: { ...s.monsters.m2!, hp: 0 } } };
    const rv = useFieldItem(down, 'revive', 'm2')!;
    expect(rv.save.monsters.m2!.hp).toBe(Math.floor(maxHpOf(s.monsters.m2!) * BALANCE.reviveFraction));
    expect(useFieldItem({ ...s, bag: {} }, 'potion', 'm1')).toBeNull();
  });

  it('진화의 돌 → S22 고르기 맨 앞 (아이템과 같이) · 멈추면 돌을 돌려줌', () => {
    const s0 = sampleSave();
    const s: Save = { ...s0, monsters: { ...s0.monsters, m1: sampleMonster({ species: GLOOM, form: 'gloom', level: 21 }) }, bag: { 'leaf-stone': 1 } };
    const r = useFieldItem(s, 'leaf-stone', 'm1')!;
    expect(r.evolve).toBe(true);
    expect(r.save.bag['leaf-stone']).toBe(0);
    expect(r.save.pendingChoices[0]).toMatchObject({ kind: 'evolve', uid: 'm1', to: 45, item: 'leaf-stone', level: 21 });
    const cancelled = resolveEvolve(r.save, null, new Rng(1));
    expect(cancelled.bag['leaf-stone']).toBe(1);
    expect(cancelled.monsters.m1!.species).toBe(GLOOM);
    const done = resolveEvolve(r.save, [33], new Rng(1));
    expect(done.monsters.m1!.species).toBe(45);
  });
});
