import { describe, expect, it } from 'vitest';
import { withJosa } from './text';

describe('조사 고르기', () => {
  it('받침 있으면 을 · 이 · 은 · 과 / 없으면 를 · 가 · 는 · 와', () => {
    expect(withJosa('상처약', '을/를')).toBe('상처약을');
    expect(withJosa('몬스터볼', '을/를')).toBe('몬스터볼을');
    expect(withJosa('리프의돌', '을/를')).toBe('리프의돌을');
    expect(withJosa('피콘', '이/가')).toBe('피콘이');
    expect(withJosa('버터플', '이/가')).toBe('버터플이');
    expect(withJosa('캐터피', '이/가')).toBe('캐터피가');
    expect(withJosa('이상해씨', '은/는')).toBe('이상해씨는');
    expect(withJosa('꼬부기', '과/와')).toBe('꼬부기와');
    expect(withJosa('이상해꽃', '과/와')).toBe('이상해꽃과');
  });

  it('으로/로: 받침 없음 · ㄹ 받침은 로', () => {
    expect(withJosa('숲', '으로/로')).toBe('숲으로');
    expect(withJosa('바다', '으로/로')).toBe('바다로');
    expect(withJosa('마을', '으로/로')).toBe('마을로');
  });

  it('숫자로 끝나면 읽는 소리로 (2개 · 60원 은 단위가 한글이라 그대로)', () => {
    expect(withJosa('60원', '을/를')).toBe('60원을');
    expect(withJosa('2개', '을/를')).toBe('2개를');
    expect(withJosa('1', '이/가')).toBe('1이');
    expect(withJosa('2', '이/가')).toBe('2가');
  });

  it('모르는 글자로 끝나면 둘 다', () => {
    expect(withJosa('Pikachu', '이/가')).toBe('Pikachu이(가)');
    expect(withJosa('', '을/를')).toBe('을(를)');
  });
});
