import { describe, expect, it } from 'vitest';
import { fixedRng } from '../../../test/fixtures/rng';
import { sampleMonster } from '../../../test/fixtures/save';
import { BALANCE } from '../balance';
import { Rng } from '../engine/rng';
import { moveOf } from '../../data';
import {
  aiPick,
  bestNext,
  clashChance,
  clashWithTaps,
  computeDamage,
  counterMove,
  fighterOf,
  fleeChance,
  gaugeRate,
  guardFactor,
  isShooting,
  streakMultiplier,
  ultGain,
  type Fighter,
} from './battle';

const TACKLE = 33;
const EMBER = 52;
const WATER_GUN = 55;
const FLAMETHROWER = 53;
const VINE_WHIP = 22;
const EARTHQUAKE = 89;
const THUNDER_WAVE = 86;

function fighter(overrides: Partial<Fighter> = {}, monster = sampleMonster()): Fighter {
  return { ...fighterOf(monster), ...overrides };
}

describe('행동 게이지 (mvp-spec 3.3 · 4장)', () => {
  it('스피드가 같으면 2.5초에 한 번 · 빠른 쪽은 비율대로 최대 2배 · 느린 쪽은 그대로', () => {
    const a = fighter({ stats: { hp: 20, attack: 10, defense: 10, speed: 50, ultimate: 10 } });
    const same = fighter({ stats: { hp: 20, attack: 10, defense: 10, speed: 50, ultimate: 10 } });
    const fast = fighter({ stats: { hp: 20, attack: 10, defense: 10, speed: 75, ultimate: 10 } });
    const veryFast = fighter({ stats: { hp: 20, attack: 10, defense: 10, speed: 500, ultimate: 10 } });
    expect(gaugeRate(a, same) * BALANCE.gaugeMs).toBeCloseTo(1, 9);
    expect(gaugeRate(fast, a) * BALANCE.gaugeMs).toBeCloseTo(1.5, 9);
    expect(gaugeRate(a, fast) * BALANCE.gaugeMs).toBeCloseTo(1, 9);
    expect(gaugeRate(veryFast, a) * BALANCE.gaugeMs).toBeCloseTo(2, 9);
  });

  it('마비면 절반', () => {
    const a = fighter({ status: { kind: 'paralysis' } });
    expect(gaugeRate(a, fighter()) * BALANCE.gaugeMs).toBeCloseTo(0.5, 9);
  });
});

describe('피해 (mvp-spec 3.3)', () => {
  const atk = fighter({ level: 50, types: ['fire'], stats: { hp: 100, attack: 100, defense: 50, speed: 50, ultimate: 120 } });
  const def = fighter({ types: ['grass'], stats: { hp: 100, attack: 50, defense: 100, speed: 50, ultimate: 50 } });
  // 급소 없음 (0.5 < 1/16 아님) · 무작위 = 0.85 + 0.5 × 0.15
  const rng = () => fixedRng(0.5);
  const raw = (power: number) => (((2 * 50) / 5 + 2) * power * (100 / 100)) / 50 + 2;
  const rand = BALANCE.damageRandomMin + 0.5 * (1 - BALANCE.damageRandomMin);

  it('공식대로 · 상성 · 자속 1.5', () => {
    const r = computeDamage({ attacker: atk, defender: def, power: 40, type: 'fire', rng: rng() });
    expect(r.effect).toBe(2);
    expect(r.crit).toBe(false);
    expect(r.damage).toBe(Math.floor(raw(40) * 2 * 1.5 * rand));
    const neutral = computeDamage({ attacker: atk, defender: def, power: 40, type: 'normal', rng: rng() });
    expect(neutral.damage).toBe(Math.floor(raw(40) * rand));
  });

  it('1 공격 (타입 없음) 은 상성 · 자속 없음 · 효과 없음이면 0', () => {
    expect(computeDamage({ attacker: atk, defender: def, power: BALANCE.attackPower, type: null, rng: rng() }).effect).toBe(1);
    const ghost = fighter({ types: ['ghost'] });
    expect(computeDamage({ attacker: atk, defender: ghost, power: 40, type: 'normal', rng: rng() }).damage).toBe(0);
  });

  it('급소 × 1.5 (1/16)', () => {
    const r = computeDamage({ attacker: atk, defender: def, power: 40, type: 'normal', rng: fixedRng(0.01) });
    expect(r.crit).toBe(true);
    const rand01 = BALANCE.damageRandomMin + 0.01 * (1 - BALANCE.damageRandomMin);
    expect(r.damage).toBe(Math.floor(raw(40) * BALANCE.critMultiplier * rand01));
  });

  it('방어 중이면 받는 피해 × 방어 배수 · 화상이면 공격 · 기술 절반 (필살기는 그대로)', () => {
    const guarded = { ...def, guard: 0.5 };
    const full = computeDamage({ attacker: atk, defender: def, power: 40, type: 'normal', rng: rng() }).damage;
    expect(computeDamage({ attacker: atk, defender: guarded, power: 40, type: 'normal', rng: rng() }).damage).toBe(Math.floor(raw(40) * rand * 0.5));
    expect(full).toBeGreaterThan(0);
    const burned = { ...atk, status: { kind: 'burn' as const } };
    expect(computeDamage({ attacker: burned, defender: def, power: 40, type: 'normal', rng: rng() }).damage).toBe(Math.floor(raw(40) * rand * 0.5));
    const ultRaw = (((2 * 50) / 5 + 2) * 100 * (120 / 100)) / 50 + 2;
    expect(computeDamage({ attacker: burned, defender: def, power: 100, type: 'fire', useUlt: true, rng: rng() }).damage).toBe(Math.floor(ultRaw * 2 * 1.5 * rand));
  });

  it('피해는 적어도 1', () => {
    const weak = fighter({ level: 1, stats: { hp: 10, attack: 1, defense: 1, speed: 1, ultimate: 1 } });
    const tank = fighter({ stats: { hp: 10, attack: 1, defense: 999, speed: 1, ultimate: 1 } });
    expect(computeDamage({ attacker: weak, defender: tank, power: 10, type: 'normal', rng: rng() }).damage).toBe(1);
  });
});

describe('연달아 · 방어 · 필살기 게이지', () => {
  it('연달아 세지는 기술: 쓸 때마다 +10% (첫 번 1 · 둘째 1.1 · 셋째 1.2 …) — 2026-10-18 태현 님', () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(1)).toBeCloseTo(1.1, 9);
    expect(streakMultiplier(2)).toBeCloseTo(1.2, 9);
    expect(streakMultiplier(9)).toBeCloseTo(1.9, 9);
  });

  it('방어: 첫 번 0.5 · 연달아 0.75 · 그다음부터 1 (효과 없음)', () => {
    expect(guardFactor(0)).toBe(0.5);
    expect(guardFactor(1)).toBe(0.75);
    expect(guardFactor(2)).toBe(1);
    expect(guardFactor(10)).toBe(1);
  });

  it('필살기 게이지: 맞으면 > 때리면 · 방어 중에 맞으면 더 · 야생은 절반 · 필살 스탯이 높을수록 (포인트를 넣으면 빨라짐)', () => {
    const f = fighter();
    const hit = ultGain('hit', f);
    const hurt = ultGain('hurt', f);
    expect(hurt).toBeGreaterThan(hit);
    expect(ultGain('hurt', f, { guarded: true })).toBeGreaterThan(hurt);
    expect(ultGain('hit', f, { wild: true })).toBeCloseTo(hit * BALANCE.ultGainWildScale, 9);
    // 이상해씨 (종족값 평균 53) 는 0.8 ~ 1.2 사이
    expect(hit).toBeGreaterThan(BALANCE.ultGainHit * 0.8 - 1e-9);
    expect(hit).toBeLessThan(BALANCE.ultGainHit * 1.2 + 1e-9);
    const strong = fighter({ stats: { ...f.stats, ultimate: f.stats.ultimate + 5 } });
    expect(ultGain('hit', strong)).toBeGreaterThan(hit);
    const huge = fighter({ stats: { ...f.stats, ultimate: 999 } });
    expect(ultGain('hit', huge)).toBeCloseTo(BALANCE.ultGainHit * 1.2, 9);
    const tiny = fighter({ stats: { ...f.stats, ultimate: 0 } });
    expect(ultGain('hit', tiny)).toBeCloseTo(BALANCE.ultGainHit * 0.8, 9);
  });
});

describe('쏘는 기술 · 맞받아치기 (mvp-spec 3.3)', () => {
  it('쏘는 기술 = 몸이 닿지 않는 피해 기술 (지진 · 소리 같은 건 아님 · 변화 기술 아님)', () => {
    expect(isShooting(moveOf(EMBER))).toBe(true);
    expect(isShooting(moveOf(FLAMETHROWER))).toBe(true);
    expect(isShooting(moveOf(TACKLE))).toBe(false);
    expect(isShooting(moveOf(VINE_WHIP))).toBe(false);
    expect(isShooting(moveOf(EARTHQUAKE))).toBe(false);
    expect(isShooting(moveOf(THUNDER_WAVE))).toBe(false);
    expect(isShooting(undefined)).toBe(false);
  });

  it('나가는 기술 = 상대와 같은 타입 먼저, 없으면 가장 센 쏘는 기술 · PP 가 없으면 못 씀', () => {
    const f = fighter({ moves: [{ moveId: WATER_GUN, pp: 5 }, { moveId: FLAMETHROWER, pp: 5 }, { moveId: TACKLE, pp: 5 }] });
    expect(counterMove(f, moveOf(EMBER)!)?.id).toBe(FLAMETHROWER);
    expect(counterMove(f, moveOf(55)!)?.id).toBe(WATER_GUN);
    expect(counterMove(f, moveOf(84)!)?.id).toBe(FLAMETHROWER); // 전기 → 같은 타입 없음 → 가장 센 것
    const noPp = fighter({ moves: [{ moveId: FLAMETHROWER, pp: 0 }, { moveId: TACKLE, pp: 5 }] });
    expect(counterMove(noPp, moveOf(EMBER)!)).toBeNull();
  });
});

describe('힘대결 확률 (mvp-spec 3.3 · 4장)', () => {
  it('비슷하면 50% · 차이가 50% 이상이면 센 쪽 80% · 사이는 비례', () => {
    expect(clashChance(100, 100)).toBeCloseTo(0.5, 9);
    expect(clashChance(150, 100)).toBeCloseTo(0.8, 9);
    expect(clashChance(300, 100)).toBeCloseTo(0.8, 9);
    expect(clashChance(125, 100)).toBeCloseTo(0.65, 9);
    expect(clashChance(100, 150)).toBeCloseTo(0.2, 9);
  });

  it('연타 1번 +1%p · 최대 +20%p · 합쳐서 최대 95%', () => {
    expect(clashWithTaps(0.5, 0)).toBe(0.5);
    expect(clashWithTaps(0.5, 10)).toBeCloseTo(0.6, 9);
    expect(clashWithTaps(0.5, 50)).toBeCloseTo(0.7, 9);
    expect(clashWithTaps(0.8, 20)).toBeCloseTo(0.95, 9);
  });
});

describe('도망 (mvp-spec 3.3)', () => {
  it('50% + 스피드 차이 · 10 ~ 95% · 실패할 때마다 +10%p', () => {
    expect(fleeChance(50, 50, 0)).toBeCloseTo(0.5, 9);
    expect(fleeChance(75, 50, 0)).toBeCloseTo(0.75, 9);
    expect(fleeChance(500, 50, 0)).toBeCloseTo(0.95, 9);
    expect(fleeChance(1, 100, 0)).toBeCloseTo(0.1, 9);
    expect(fleeChance(50, 50, 2)).toBeCloseTo(0.7, 9);
  });
});

describe('AI (mvp-spec 3.3 [제안])', () => {
  it('야생: 공격 30% · 기술 70% · 기술이 없으면 공격', () => {
    const wild = fighter({ moves: [{ moveId: EMBER, pp: 5 }] });
    const target = fighter();
    expect(aiPick(wild, target, 'wild', fixedRng(0.1))).toEqual({ kind: 'attack' });
    expect(aiPick(wild, target, 'wild', fixedRng(0.5))).toEqual({ kind: 'move', moveId: EMBER });
    expect(aiPick(fighter({ moves: [] }), target, 'wild', fixedRng(0.5))).toEqual({ kind: 'attack' });
    expect(aiPick(fighter({ moves: [{ moveId: EMBER, pp: 0 }] }), target, 'wild', fixedRng(0.5))).toEqual({ kind: 'attack' });
  });

  it('자동 전투: 효과가 굉장한 기술을 훨씬 자주 고름', () => {
    const me = fighter({ types: ['water'], moves: [{ moveId: WATER_GUN, pp: 99 }, { moveId: TACKLE, pp: 99 }] });
    const fireFoe = fighter({ types: ['fire'] });
    const rng = new Rng(5);
    const counts = { water: 0, other: 0 };
    for (let i = 0; i < 1000; i++) {
      const p = aiPick(me, fireFoe, 'smart', rng);
      if (p.kind === 'move' && p.moveId === WATER_GUN) counts.water++;
      else counts.other++;
    }
    expect(counts.water).toBeGreaterThan(counts.other * 3);
  });

  it('상태 이상 기술은 상대가 이미 걸려 있으면 안 고름', () => {
    const me = fighter({ moves: [{ moveId: THUNDER_WAVE, pp: 9 }] });
    const sick = fighter({ status: { kind: 'poison' } });
    expect(aiPick(me, sick, 'smart', fixedRng(0.5))).toEqual({ kind: 'attack' });
  });

  it('다음 포켓몬 자동 고르기: 상대 타입에 센 기술이 있는 쪽 · 같으면 레벨 높은 쪽 · 쓰러진 포켓몬 빼고', () => {
    const grassMon = sampleMonster({ uid: 'g', level: 5, moves: [{ moveId: VINE_WHIP, pp: 5 }] });
    const waterMon = sampleMonster({ uid: 'w', level: 3, moves: [{ moveId: WATER_GUN, pp: 5 }] });
    const strong = sampleMonster({ uid: 's', level: 9, moves: [{ moveId: TACKLE, pp: 5 }] });
    expect(bestNext([grassMon, waterMon, strong], ['fire'])?.uid).toBe('w');
    expect(bestNext([grassMon, strong], ['normal'])?.uid).toBe('s');
    expect(bestNext([{ ...waterMon, hp: 0 }], ['fire'])).toBeNull();
  });
});
