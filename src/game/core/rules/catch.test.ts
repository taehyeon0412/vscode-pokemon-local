import { describe, expect, it } from 'vitest';
import { BALANCE } from '../balance';
import { catchChance, catchOdds, catchTier, catchTiming, isBall, statusScale, timingScale } from './catch';

describe('잡기 (mvp-spec 3.4 · 4장)', () => {
  it('타이밍 원: 다 줄어든 순간 ±0.1초 완벽 × 1.5 · ±0.25초 좋음 × 1.25 · 그 밖 · 안 누름 × 1', () => {
    expect(catchTiming(1200, 1200)).toBe('perfect');
    expect(catchTiming(1290, 1200)).toBe('perfect');
    expect(catchTiming(1050, 1200)).toBe('good');
    expect(catchTiming(800, 1200)).toBe('none');
    expect(catchTiming(null, 1200)).toBe('none');
    expect([timingScale('perfect'), timingScale('good'), timingScale('none')]).toEqual([1.5, 1.25, 1]);
  });

  it('확률 = 포획률 / 255 × (1 − HP 비율 × 2/3) × 볼 × 타이밍, 최대 1 · 마지막 기회 × 0.5', () => {
    const base = { captureRate: 255, hp: 20, maxHp: 20, ball: 'poke-ball' as const, timing: 'none' as const, lastChance: false };
    expect(catchChance(base)).toBeCloseTo(1 / 3, 9);
    expect(catchChance({ ...base, ball: 'great-ball' })).toBeCloseTo(0.5, 9);
    expect(catchChance({ ...base, ball: 'ultra-ball', timing: 'perfect' })).toBe(1);
    expect(catchChance({ ...base, hp: 10 })).toBeCloseTo(2 / 3, 9);
    expect(catchChance({ ...base, hp: 0, lastChance: true })).toBeCloseTo(BALANCE.lastChanceScale, 9);
    expect(catchChance({ ...base, captureRate: 45 })).toBeCloseTo((45 / 255) * (1 / 3), 9);
  });

  it('상태 이상 × 잠듦 2 · 마비 · 독 · 화상 1.5 (기획 검토 R5) — 최대 1 · 쉬움 · 보통 · 어려움에도 바로', () => {
    expect([statusScale('sleep'), statusScale('paralysis'), statusScale('poison'), statusScale('burn'), statusScale(null), statusScale(undefined)]).toEqual([2, 1.5, 1.5, 1.5, 1, 1]);
    const base = { captureRate: 45, hp: 30, maxHp: 30, ball: 'poke-ball' as const, timing: 'none' as const, lastChance: false };
    expect(catchChance({ ...base, status: 'sleep' })).toBeCloseTo(catchChance(base) * 2, 9);
    expect(catchChance({ ...base, status: 'burn' })).toBeCloseTo(catchChance(base) * 1.5, 9);
    expect(catchChance({ ...base, captureRate: 255, hp: 1, ball: 'ultra-ball', status: 'sleep' })).toBe(1);
    // 포획률 120 · HP 절반 · 몬스터볼 약 31% (보통) → 잠듦 약 63% (쉬움)
    const half = { captureRate: 120, hp: 15, maxHp: 30, lastChance: false };
    expect(catchOdds(half)['poke-ball'].tier).toBe('normal');
    expect(catchOdds({ ...half, status: 'sleep' })['poke-ball'].tier).toBe('easy');
  });

  it('볼만 던짐 (상처약 · 돌은 아님)', () => {
    expect(isBall('poke-ball')).toBe(true);
    expect(isBall('ultra-ball')).toBe(true);
    expect(isBall('potion')).toBe(false);
  });
});

describe('잡기 어려움 3단계 (orders #23 — 쉬움 60% 부터 · 보통 25% 부터 · 그 아래 어려움)', () => {
  it('경계 그대로', () => {
    expect(catchTier(0.6)).toBe('easy');
    expect(catchTier(0.5999)).toBe('normal');
    expect(catchTier(0.25)).toBe('normal');
    expect(catchTier(0.2499)).toBe('hard');
    expect(catchTier(1)).toBe('easy');
    expect(catchTier(0)).toBe('hard');
  });

  it('볼마다 기본 확률 = 타이밍 보너스 없이 · 좋은 볼일수록 쉬움 · 마지막 기회 × 0.5', () => {
    // 포획률 45 (스타팅급) · HP 가득 → 몬스터볼 약 6% 어려움
    const full = catchOdds({ captureRate: 45, hp: 30, maxHp: 30, lastChance: false });
    expect(full['poke-ball'].tier).toBe('hard');
    expect(full['ultra-ball'].chance).toBeCloseTo(full['poke-ball'].chance * 2);
    expect(full['poke-ball'].chance).toBeCloseTo(catchChance({ captureRate: 45, hp: 30, maxHp: 30, ball: 'poke-ball', timing: 'none', lastChance: false }));
    // 포획률 255 (캐터피급) · HP 1 → 쉬움, 마지막 기회 (쓰러짐 · × 0.5) 는 몬스터볼 50% = 보통
    expect(catchOdds({ captureRate: 255, hp: 1, maxHp: 30, lastChance: false })['poke-ball'].tier).toBe('easy');
    const last = catchOdds({ captureRate: 255, hp: 0, maxHp: 30, lastChance: true });
    expect(last['poke-ball'].chance).toBeCloseTo(0.5);
    expect(last['poke-ball'].tier).toBe('normal');
    expect(last['great-ball'].tier).toBe('easy');
  });
});
