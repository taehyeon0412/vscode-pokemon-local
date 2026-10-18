import { describe, expect, it } from 'vitest';
import { validateSave } from '../../core/save';
import { moveOf, speciesOf } from '../../data';
import { chosenStarterMoves, createStartSave, defaultStarterMoves, evolutionChain, starterList, starterMoveCandidates } from './model';

const STARTERS = [1, 152, 252, 387, 495, 650, 4, 155, 255, 390, 498, 653, 7, 158, 258, 393, 501, 656];

describe('스타팅 처음 기술 (mvp-spec 3.6 · S04)', () => {
  it.each(STARTERS)('#%i: 후보 4개 이하 · 서로 다름 · 피해 기술 · 자기 타입 포함, 기본 2개도 자기 타입 포함', (dex) => {
    const types = speciesOf(dex)!.types;
    const cands = starterMoveCandidates(dex);
    expect(cands.length).toBeGreaterThanOrEqual(2);
    expect(cands.length).toBeLessThanOrEqual(4);
    expect(new Set(cands.map((m) => m.id)).size).toBe(cands.length);
    expect(cands.every((m) => m.class !== 'status')).toBe(true);
    expect(cands.some((m) => types.includes(m.type))).toBe(true);
    const picked = defaultStarterMoves(dex);
    expect(picked).toHaveLength(2);
    expect(picked.some((m) => types.includes(m.type))).toBe(true);
  });

  it('이상해씨: 몸통박치기 · 덩굴채찍', () => {
    expect(defaultStarterMoves(1).map((m) => m.name.ko)).toEqual(['몸통박치기', '덩굴채찍']);
  });
});

describe('새로 하기 세이브', () => {
  it('이상해씨 Lv 5 한 마리 · 숲 1-1 · HP 가득 · 볼 3 · 1000원 · 검사를 고칠 것 없이 통과', () => {
    const save = createStartSave(1_800_000_000_000, 42);
    const m = save.monsters.m1!;
    expect(m).toMatchObject({ species: 1, form: 'bulbasaur', level: 5, exp: 125, caughtAt: 'starter', status: null });
    expect(m.hp).toBeGreaterThanOrEqual(19);
    expect(m.moves.map((x) => moveOf(x.moveId)!.key)).toEqual(['tackle', 'vine-whip']);
    expect(m.moves.every((x) => x.pp === moveOf(x.moveId)!.pp)).toBe(true);
    expect(save.party).toEqual(['m1']);
    expect(save.location).toEqual({ screen: 'stage', stageId: 'forest-1' });
    expect(save.bag['poke-ball']).toBe(3);
    expect(save.money).toBe(1000);
    expect(save.dex).toEqual({ seen: [1], caught: [1] });
    expect(validateSave(JSON.parse(JSON.stringify(save)))).toEqual({ ok: true, save, problems: [] });
  });

  it('같은 시드면 같은 개체값 · 다른 시드면 대개 다름', () => {
    expect(createStartSave(0, 7).monsters.m1!.ivs).toEqual(createStartSave(0, 7).monsters.m1!.ivs);
    expect(createStartSave(0, 7).monsters.m1!.ivs).not.toEqual(createStartSave(0, 8).monsters.m1!.ivs);
  });

  it('스타팅 18종 모두 만들 수 있음 (단계 10 S04 에서 고름)', () => {
    for (const dex of STARTERS) expect(validateSave(createStartSave(0, dex, dex)).ok, String(dex)).toBe(true);
  });
});

describe('S03 · S04 고르기 (단계 10)', () => {
  it('스타팅 줄 18마리 · 진화 단계는 1 → 2 → 3 (그림이 있는 것만)', () => {
    expect(starterList().map((s) => s.dex)).toEqual(STARTERS);
    for (const dex of STARTERS) {
      const chain = evolutionChain(dex);
      expect(chain[0]!.dex).toBe(dex);
      expect(chain.length).toBeGreaterThanOrEqual(2);
      expect(chain.length).toBeLessThanOrEqual(3);
    }
    expect(evolutionChain(1).map((c) => c.dex)).toEqual([1, 2, 3]);
  });

  it('고른 처음 기술 2개 · 주인공 남 · 여가 세이브에 — 후보 밖 · 1개 · 같은 것 두 번이면 기본 2개', () => {
    const cands = starterMoveCandidates(4).map((m) => m.id);
    const pick = [cands[2]!, cands[3]!];
    const save = createStartSave(0, 5, 4, { gender: 'female', moves: pick });
    expect(save.monsters.m1!.moves.map((m) => m.moveId)).toEqual(pick);
    expect(save.player).toEqual({ gender: 'female' });
    expect(validateSave(JSON.parse(JSON.stringify(save))).ok).toBe(true);
    const defaults = defaultStarterMoves(4).map((m) => m.id);
    expect(chosenStarterMoves(4, [9999, cands[0]!]).map((m) => m.id)).toEqual(defaults);
    expect(chosenStarterMoves(4, [cands[0]!]).map((m) => m.id)).toEqual(defaults);
    expect(chosenStarterMoves(4, [cands[0]!, cands[0]!]).map((m) => m.id)).toEqual(defaults);
    // 스타팅이 아닌 종은 고를 수 없음 (손으로 만든 메시지) → 이상해씨
    expect(createStartSave(0, 5, 150).monsters.m1!.species).toBe(1);
  });
});
