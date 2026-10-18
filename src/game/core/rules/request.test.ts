import { describe, expect, it } from 'vitest';
import { sampleMonster, sampleSave } from '../../../test/fixtures/save';
import { Rng } from '../engine/rng';
import { TYPE_NAMES } from '../../data';
import { bestHelper, FOREST_REQUESTS, requestAt, resolveRequest } from './request';

const byId = (id: string) => FOREST_REQUESTS.find((r) => r.id === id)!;
/** 첫 확률 뽑기가 p 보다 작게 (성공) · 크게 (실패) 나오는 시드 */
const seedWhere = (ok: boolean, p: number) => {
  for (let s = 1; s < 10_000; s++) if (new Rng(s).next() < p === ok) return s;
  throw new Error('시드 없음');
};

describe('길 위의 부탁 (gdd 4.6, 2026-10-18 태현 님)', () => {
  it('숲 부탁 5종 · 타입은 실제 타입 이름 · 문구에 {move} 자리', () => {
    expect(FOREST_REQUESTS).toHaveLength(5);
    expect(new Set(FOREST_REQUESTS.map((r) => r.id)).size).toBe(5);
    for (const r of FOREST_REQUESTS) {
      for (const t of r.types) expect(TYPE_NAMES).toContain(t);
      expect(r.done).toContain('{move}');
    }
  });

  it('한 스테이지 안에서 첫 부탁 · 둘째 부탁은 다름 · 같은 시드면 같음', () => {
    for (let seed = 0; seed < 30; seed++) {
      expect(requestAt(seed, 0).id).not.toBe(requestAt(seed, 1).id);
      expect(requestAt(seed, 0)).toBe(requestAt(seed, 0));
    }
  });

  it('도울 포켓몬: 맞는 타입 기술이 있으면 그 포켓몬 · 기술 (85%)', () => {
    // 이상해씨 (몸통박치기 · 덩굴채찍) → 모자가 나무에 (풀 · 비행 · 벌레)
    const h = bestHelper(sampleSave(), byId('hat-in-tree'));
    expect(h).toMatchObject({ uid: 'm1', name: '이상해씨', moveName: '덩굴채찍', chance: 0.85 });
  });

  it('맞는 기술이 없으면 쓰러지지 않은 첫 포켓몬 (30%) · 쓰러진 포켓몬은 안 도움 · 아무도 없으면 null', () => {
    expect(bestHelper(sampleSave(), byId('campfire'))).toMatchObject({ uid: 'm1', moveId: null, chance: 0.3 });
    const fainted = sampleSave({ monsters: { m1: sampleMonster({ hp: 0 }), m2: sampleMonster({ uid: 'm2', species: 10, form: 'caterpie', moves: [{ moveId: 33, pp: 35 }] }) } });
    expect(bestHelper(fainted, byId('hat-in-tree'))).toMatchObject({ uid: 'm2', chance: 0.3 });
    expect(bestHelper(sampleSave({ party: [] }), byId('hat-in-tree'))).toBeNull();
  });

  it('성공하면 보상 (상처약 2개) · 결과에 포켓몬 · 기술 이름', () => {
    const save = sampleSave({ bag: { potion: 1 } });
    const out = resolveRequest(save, byId('hat-in-tree'), new Rng(seedWhere(true, 0.85)));
    expect(out.ok).toBe(true);
    expect(out.save.bag.potion).toBe(3);
    expect(out.text).toBe('이상해씨의 덩굴채찍! 모자를 꺼냈다!');
    expect(out.reward).toBe('상처약 2개');
    expect(save.bag.potion).toBe(1); // 원래 세이브는 그대로
  });

  it('실패하면 보상 없음', () => {
    const save = sampleSave({ money: 100 });
    const out = resolveRequest(save, byId('fallen-tree'), new Rng(seedWhere(false, 0.3)));
    expect(out.ok).toBe(false);
    expect(out.save).toBe(save);
    expect(out.reward).toBeNull();
    // 맞는 기술이 없으면 "이상해씨가 힘껏 도왔다" (조사도 받침에 맞게)
    expect(out.text).toContain('이상해씨가 힘껏 도왔다');
  });

  it('돈 보상 · 가끔 더 주는 것 (시든 꽃밭 → 리프의돌 30%)', () => {
    expect(resolveRequest(sampleSave({ money: 100 }), byId('fallen-tree'), new Rng(seedWhere(true, 0.3))).save.money).toBe(600);
    let stones = 0;
    for (let s = 1; s <= 400; s++) {
      const out = resolveRequest(sampleSave(), byId('withered-flowers'), new Rng(s));
      if (out.save.bag['leaf-stone']) stones++;
    }
    // 성공 85% × 30% ≈ 25%
    expect(stones / 400).toBeGreaterThan(0.15);
    expect(stones / 400).toBeLessThan(0.35);
  });
});
