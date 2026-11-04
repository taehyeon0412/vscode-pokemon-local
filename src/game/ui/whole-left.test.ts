/** 가운데 맞춤 상자 왼쪽 끝 정수 px (bugs 2734) — 최소 폭을 1px 안쪽 소수 (+ 홀짝 1px) 만큼 넓은 정수 폭으로 */
import { describe, expect, it } from 'vitest';
import { wholeAdd } from './whole-left';

/** 가운데 맞춤 (left · right 8 + margin auto) 왼쪽 끝 — 패널 폭 cb · 상자 폭 w */
const leftOf = (cb: number, w: number) => 8 + (cb - 16 - w) / 2;

describe('wholeAdd — 넓힌 폭으로 왼쪽 끝이 정수 px', () => {
  it('결과 상자 480 · 860 · 500 · 말 상자 240 · 480 · 대기실 860 (재 본 폭) → 정수 · 넓히는 폭은 2px 아래', () => {
    for (const [cb, w] of [[480, 441.234], [860, 479.688], [500, 297.313], [240, 145.203], [480, 145.203], [860, 455.141], [480, 441.5], [481, 300.25]] as const) {
      const add = wholeAdd(leftOf(cb, w), w);
      const x = leftOf(cb, w + add);
      expect(Math.abs(x - Math.round(x)), `${cb} ${w}`).toBeLessThan(0.01);
      expect(add, `${cb} ${w}`).toBeGreaterThan(0);
      expect(add, `${cb} ${w}`).toBeLessThan(2);
    }
  });

  it('이미 정수면 0 (폭이 정수 · 홀짝이 맞음 · 왼쪽 고정 자리 8)', () => {
    expect(wholeAdd(leftOf(480, 440), 440)).toBe(0);
    expect(wholeAdd(8, 333.33)).toBe(0);
  });
});
