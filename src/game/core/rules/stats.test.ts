import { describe, expect, it } from 'vitest';
import { BALANCE } from '../balance';
import { expForLevel, gameBase, levelForExp, maxHp, starGrade, statsOf, statValue } from './stats';

const bulbasaur = { hp: 45, attack: 49, defense: 49, spAttack: 65, spDefense: 65, speed: 45 };
const zero = { hp: 0, attack: 0, defense: 0, speed: 0, ultimate: 0 };
const ivs = (n: number) => ({ hp: n, attack: n, defense: n, speed: n, ultimate: n });

describe('스탯 (mvp-spec 3.5 · 4장)', () => {
  it('원작 6개 → 게임 5개: 공격 = 둘 중 높은 쪽, 방어 = 평균, 필살 = 합계 / 6', () => {
    expect(gameBase(bulbasaur)).toEqual({ hp: 45, attack: 65, defense: 57, speed: 45, ultimate: 318 / 6 });
  });

  it('원작 식: 이상해씨 Lv 5 개체값 0 → HP 19 · 공격 11 (원작 계산과 같음)', () => {
    expect(statValue('hp', 45, 0, 5, 0)).toBe(19); // floor(90×5/100)=4 + 5 + 10
    expect(statValue('attack', 65, 0, 5, 0)).toBe(11); // floor(130×5/100)=6 + 5
  });

  it('포인트: HP +pointHp · 나머지 +pointOther 씩 (2 · 0.7 — orders #82)', () => {
    expect(statValue('hp', 45, 0, 5, 2)).toBe(statValue('hp', 45, 0, 5, 0) + 2 * BALANCE.pointHp);
    expect(statValue('speed', 45, 0, 5, 3)).toBeCloseTo(statValue('speed', 45, 0, 5, 0) + 3 * BALANCE.pointOther, 10);
  });

  it('레벨 · 개체값이 오르면 스탯도 오름 · 최대 HP 는 정수', () => {
    const lv5 = statsOf(bulbasaur, ivs(15), zero, 5);
    const lv50 = statsOf(bulbasaur, ivs(15), zero, 50);
    for (const k of Object.keys(lv5) as (keyof typeof lv5)[]) expect(lv50[k]).toBeGreaterThan(lv5[k]);
    expect(Number.isInteger(maxHp(bulbasaur, ivs(15), { ...zero, hp: 1 }, 5))).toBe(true);
  });

  it.each([
    [0, 1], [31, 1], [32, 2], [62, 2], [63, 3], [94, 4], [124, 4], [125, 5], [155, 5],
  ])('★ 등급: 개체값 합계 %i → ★%i', (sum, star) => {
    const v = { hp: Math.min(31, sum), attack: 0, defense: 0, speed: 0, ultimate: 0 };
    let left = sum - v.hp;
    for (const k of ['attack', 'defense', 'speed', 'ultimate'] as const) {
      v[k] = Math.min(31, left);
      left -= v[k];
    }
    expect(starGrade(v)).toBe(star);
  });

  it('경험치 곡선: 보통 빠르기 (레벨³) · 레벨 ↔ 경험치가 맞물림 · 100 이 끝', () => {
    expect(expForLevel(5)).toBe(125);
    expect(levelForExp(124)).toBe(4);
    expect(levelForExp(125)).toBe(5);
    expect(levelForExp(10 ** 9)).toBe(100);
    expect(levelForExp(0)).toBe(1);
  });
});
