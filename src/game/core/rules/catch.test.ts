import { describe, expect, it } from 'vitest';
import { BALANCE } from '../balance';
import { catchChance, catchTiming, isBall, timingScale } from './catch';

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

  it('볼만 던짐 (상처약 · 돌은 아님)', () => {
    expect(isBall('poke-ball')).toBe(true);
    expect(isBall('ultra-ball')).toBe(true);
    expect(isBall('potion')).toBe(false);
  });
});
