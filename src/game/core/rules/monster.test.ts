import { describe, expect, it } from 'vitest';
import { Rng } from '../engine/rng';
import { learnsetOf, moveOf } from '../../data';
import { createMonster, wildMoveCount, wildMoves } from './monster';

describe('포켓몬 만들기 (mvp-spec 3.4 · 3.5)', () => {
  it('HP 가득 · 경험치 = 그 레벨 · 개체값 0 ~ 31 · 포인트 0 · 기술 PP 가득', () => {
    const m = createMonster({ uid: 'x', dex: 10, level: 5, moves: [moveOf(33)!], rng: new Rng(3), caughtAt: 'forest-1', shiny: true });
    expect(m).toMatchObject({ uid: 'x', species: 10, form: 'caterpie', level: 5, exp: 125, unspentPoints: 0, shiny: true, caughtAt: 'forest-1', status: null });
    expect(Object.values(m.ivs).every((v) => v >= 0 && v <= 31)).toBe(true);
    expect(Object.values(m.points).every((v) => v === 0)).toBe(true);
    expect(m.moves).toEqual([{ moveId: 33, pp: moveOf(33)!.pp }]);
    expect(m.hp).toBeGreaterThan(10);
  });

  it('그림이 없는 종은 만들지 않음 (던짐)', () => {
    expect(() => createMonster({ uid: 'x', dex: 99999, level: 5, moves: [], rng: new Rng(1), caughtAt: 's' })).toThrow();
  });
});

describe('야생 기술 (4장: Lv 1 ~ 10 = 2개 · 11 ~ 25 = 3개 · 26 ~ = 4개)', () => {
  it('기술 수', () => {
    expect([1, 10, 11, 25, 26, 100].map(wildMoveCount)).toEqual([2, 2, 3, 3, 4, 4]);
  });

  it('그 레벨까지 레벨업으로 배우는 기술 중에서만 · 레벨 0 (진화 기술) · 기술표에 없는 기술은 없음 · 겹치지 않음', () => {
    for (const [dex, level] of [[1, 5], [1, 15], [1, 30], [10, 3], [11, 8], [13, 4], [43, 12], [123, 12], [412, 4]] as const) {
      for (let seed = 1; seed <= 20; seed++) {
        const moves = wildMoves(dex, level, new Rng(seed));
        expect(moves.length).toBeLessThanOrEqual(wildMoveCount(level));
        expect(new Set(moves.map((m) => m.id)).size).toBe(moves.length);
        const learnedAt = new Map(learnsetOf(dex).filter(([lv]) => lv >= 1).map(([lv, id]) => [id, lv]));
        for (const m of moves) {
          expect(learnedAt.has(m.id), `${dex} Lv${level} ${m.name.ko} 는 기술표에 있어야 함`).toBe(true);
          expect(learnedAt.get(m.id)!).toBeLessThanOrEqual(level);
        }
      }
    }
  });

  it('배울 수 있는 기술이 기술 수보다 많으면 무작위 (시드마다 다름 · 같은 시드면 같음)', () => {
    const picks = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) picks.add(wildMoves(1, 30, new Rng(seed)).map((m) => m.id).join(','));
    expect(picks.size).toBeGreaterThan(1);
    expect(wildMoves(1, 30, new Rng(5))).toEqual(wildMoves(1, 30, new Rng(5)));
    expect(wildMoves(1, 30, new Rng(5))).toHaveLength(4);
  });

  it('배울 수 있는 게 적으면 있는 만큼 · 0개면 빈 목록 (전투에서 1 공격만, 3.3 · 3.4)', () => {
    expect(wildMoves(1, 5, new Rng(1)).map((m) => m.name.ko)).toEqual(['몸통박치기']);
    expect(wildMoves(11, 8, new Rng(1))).toEqual([]); // 단데기 — 단단해지기는 데이터에서 빠짐
  });
});
