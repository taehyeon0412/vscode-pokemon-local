import { describe, expect, it } from 'vitest';
import { formatMoney, formatPlayTime } from './format';
import { fitLayout, minHeightOf } from './layout';
import { spritePx, spriteSrc } from './sprite-path';
import { Store } from './store';

describe('화면 틀 (mvp-spec 1장)', () => {
  it('최소 높이 = 포켓몬 키 × 1.5 + 20: 68 · 92 · 116 · 140', () => {
    expect([minHeightOf('nano'), minHeightOf('small'), minHeightOf('medium'), minHeightOf('large')]).toEqual([68, 92, 116, 140]);
  });

  it('높이가 넉넉하면 설정한 크기 그대로', () => {
    expect(fitLayout('large', 300)).toMatchObject({ size: 'large', scale: 2.5, petPx: 80, tooSmall: false });
    expect(fitLayout('medium', 116)).toMatchObject({ size: 'medium', tooSmall: false });
  });

  it('모자라면 맞을 때까지 한 단계씩 낮춤 (패널을 키우면 원래대로)', () => {
    expect(fitLayout('large', 139).size).toBe('medium');
    expect(fitLayout('large', 100).size).toBe('small');
    expect(fitLayout('large', 68).size).toBe('nano');
    expect(fitLayout('large', 140).size).toBe('large');
  });

  it('아주 작게로도 안 맞으면 멈춤 안내 (지금 · 필요 px)', () => {
    expect(fitLayout('small', 67)).toMatchObject({ size: 'nano', tooSmall: true, heightPx: 67, needPx: 68 });
    expect(fitLayout('nano', 0).tooSmall).toBe(true);
    expect(fitLayout('nano', Number.NaN)).toMatchObject({ tooSmall: true, heightPx: 0 });
  });

  it('모르는 크기 설정은 아주 작게로', () => {
    expect(fitLayout('huge', 500)).toMatchObject({ wanted: 'nano', size: 'nano' });
  });
});

describe('글자 모양', () => {
  it('플레이 시간', () => {
    expect(formatPlayTime(0)).toBe('0분');
    expect(formatPlayTime(59_999)).toBe('0분');
    expect(formatPlayTime(754_000)).toBe('12분');
    expect(formatPlayTime(3 * 3_600_000 + 5 * 60_000)).toBe('3시간 5분');
    expect(formatPlayTime(-5)).toBe('0분');
    expect(formatPlayTime(Number.NaN)).toBe('0분');
  });

  it('돈', () => {
    expect(formatMoney(0)).toBe('0원');
    expect(formatMoney(1000)).toBe('1,000원');
    expect(formatMoney(1234567)).toBe('1,234,567원');
    expect(formatMoney(-3)).toBe('0원');
  });
});

describe('포켓몬 그림', () => {
  it('세대 폴더 · 색 · 동작', () => {
    expect(spriteSrc('M', 'bulbasaur')).toBe('M/gen1/bulbasaur/default_idle_8fps.gif');
    expect(spriteSrc('M/', 'snivy', { action: 'walk', shiny: true })).toBe('M/gen5/snivy/shiny_walk_8fps.gif');
  });

  it('모르는 모습 · media 없음은 null (빈 칸)', () => {
    expect(spriteSrc('M', 'not-a-pokemon')).toBeNull();
    expect(spriteSrc('', 'bulbasaur')).toBeNull();
  });

  it('키 = 원본 × 배율 (원본 64px 은 두 배)', () => {
    expect(spritePx('bulbasaur', 2)).toBe(64);
    expect(spritePx('frogadier', 1)).toBe(64);
    expect(spritePx('???', 1.5)).toBe(48);
  });
});

describe('Store', () => {
  it('바뀐 것만 알림', () => {
    const s = new Store({ a: 1, b: 'x' });
    let n = 0;
    const off = s.subscribe(() => n++);
    s.set({ a: 1 });
    expect(n).toBe(0);
    s.set({ a: 2 });
    expect(n).toBe(1);
    expect(s.get()).toEqual({ a: 2, b: 'x' });
    off();
    s.set({ b: 'y' });
    expect(n).toBe(1);
  });
});
