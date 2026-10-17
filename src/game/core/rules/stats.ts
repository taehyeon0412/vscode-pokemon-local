/**
 * 스탯 · 등급 · 경험치 곡선 (mvp-spec 3.5 · 4장 "경험치 · 성장").
 * 원작 종족값 6개 → 게임 스탯 5개 (HP · 공격 · 방어 · 스피드 · 필살), 원작 식으로 레벨에 따라 커지고 포인트를 그 위에 더함.
 */
import { BALANCE } from '../balance';
import { STAT_KEYS, type StatKey, type Stats } from '../save';

/** 원작 종족값 6개 (data 의 BaseStats 와 같은 모양) */
export interface BaseSix {
  readonly hp: number;
  readonly attack: number;
  readonly defense: number;
  readonly spAttack: number;
  readonly spDefense: number;
  readonly speed: number;
}

/** 게임 종족값 5개: 공격 = 공격 · 특수공격 중 높은 쪽, 방어 = 두 방어 평균, 필살 = 합계 / 6 */
export function gameBase(b: BaseSix): Stats {
  const total = b.hp + b.attack + b.defense + b.spAttack + b.spDefense + b.speed;
  return {
    hp: b.hp,
    attack: Math.max(b.attack, b.spAttack),
    defense: (b.defense + b.spDefense) / 2,
    speed: b.speed,
    ultimate: total / 6,
  };
}

/**
 * 스탯 하나 — HP = (2 × 종족값 + 개체값) × 레벨 / 100 + 레벨 + 10, 나머지 = … + 5, 그 위에 포인트.
 * 레벨에 따른 부분은 원작처럼 내림, 포인트(0.5 · 1.5 단위)는 그대로 더함 → HP 만 정수로 (maxHp)
 */
export function statValue(key: StatKey, base: number, iv: number, level: number, points: number): number {
  const core = Math.floor(((2 * base + iv) * level) / 100);
  return key === 'hp' ? core + level + 10 + points * BALANCE.pointHp : core + 5 + points * BALANCE.pointOther;
}

export function statsOf(base6: BaseSix, ivs: Stats, points: Stats, level: number): Stats {
  const base = gameBase(base6);
  const out = {} as Stats;
  for (const k of STAT_KEYS) out[k] = statValue(k, base[k], ivs[k], level, points[k]);
  return out;
}

/** 최대 HP (정수) */
export function maxHp(base6: BaseSix, ivs: Stats, points: Stats, level: number): number {
  return Math.floor(statValue('hp', base6.hp, ivs.hp, level, points.hp));
}

/** ★ 등급 1~5 — 개체값 합계로 (4장) */
export function starGrade(ivs: Stats): number {
  const sum = STAT_KEYS.reduce((a, k) => a + ivs[k], 0);
  return 1 + BALANCE.starThresholds.filter((t) => sum >= t).length;
}

/** 그 레벨이 되는 데 필요한 누적 경험치 — 원작 "보통 빠르기" (레벨³), 4장 */
export function expForLevel(level: number): number {
  return level <= 1 ? 0 : level ** 3;
}

/** 누적 경험치로 레벨 (상한 100) */
export function levelForExp(exp: number): number {
  let level = 1;
  while (level < BALANCE.maxLevel && expForLevel(level + 1) <= exp) level++;
  return level;
}
