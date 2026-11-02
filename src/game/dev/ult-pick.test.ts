import { afterEach, describe, expect, it } from 'vitest';
import { devUltOf, setDevUlts } from './ult-pick';

describe('개발 모드 고른 필살기 (연출 쪽) — "*" = 모든 칸 (시험 창 ult= · ideas 1673)', () => {
  afterEach(() => setDevUlts(undefined));
  it('칸 (uid) 이 먼저 · 없으면 "*" · 둘 다 없으면 undefined', () => {
    setDevUlts({ m1: '블래스트번', '*': '플레어드라이브' });
    expect(devUltOf('m1')).toBe('블래스트번');
    expect(devUltOf('m2')).toBe('플레어드라이브');
    expect(devUltOf(undefined)).toBe('플레어드라이브');
    setDevUlts({ m1: '블래스트번' });
    expect(devUltOf('m2')).toBeUndefined();
  });
});
