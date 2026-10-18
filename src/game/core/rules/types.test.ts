import { describe, expect, it } from 'vitest';
import { effectiveness, effectivenessText } from './types';

describe('타입 상성 (mvp-spec 3.3 U5 — 원작 18타입)', () => {
  it('한 타입: 굉장함 2 · 별로 0.5 · 없음 0 · 보통 1', () => {
    expect(effectiveness('fire', ['grass'])).toBe(2);
    expect(effectiveness('water', ['fire'])).toBe(2);
    expect(effectiveness('grass', ['fire'])).toBe(0.5);
    expect(effectiveness('electric', ['ground'])).toBe(0);
    expect(effectiveness('normal', ['ghost'])).toBe(0);
    expect(effectiveness('ghost', ['normal'])).toBe(0);
    expect(effectiveness('dragon', ['fairy'])).toBe(0);
    expect(effectiveness('normal', ['water'])).toBe(1);
  });

  it('두 타입이면 곱함 (4 · 0.25 · 0)', () => {
    expect(effectiveness('fire', ['grass', 'bug'])).toBe(4);
    expect(effectiveness('rock', ['fire', 'flying'])).toBe(4);
    expect(effectiveness('grass', ['fire', 'flying'])).toBe(0.25);
    expect(effectiveness('ground', ['electric', 'flying'])).toBe(0);
  });

  it('1 공격 (타입 없음) 은 늘 1', () => {
    expect(effectiveness(null, ['ghost'])).toBe(1);
    expect(effectiveness(null, ['rock', 'steel'])).toBe(1);
  });

  it('화면 문구', () => {
    expect(effectivenessText(2)).toBe('효과가 굉장했다!');
    expect(effectivenessText(4)).toBe('효과가 굉장했다!');
    expect(effectivenessText(0.5)).toBe('효과가 별로인 듯하다…');
    expect(effectivenessText(0)).toBe('효과가 없는 것 같다…');
    expect(effectivenessText(1)).toBeNull();
  });
});
