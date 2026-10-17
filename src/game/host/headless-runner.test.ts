import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HeadlessRunner } from './headless-runner';

let now = 0;
beforeEach(() => {
  vi.useFakeTimers();
  now = 0;
});
afterEach(() => {
  vi.useRealTimers();
});

const make = (calls: number[]) => new HeadlessRunner((ms) => calls.push(ms), { intervalMs: 250, maxCatchUpMs: 1000, now: () => now });

describe('안 볼 때 계산', () => {
  it('간격마다 지난 시간을 넘김', () => {
    const calls: number[] = [];
    const r = make(calls);
    r.start();
    now += 250;
    vi.advanceTimersByTime(250);
    now += 250;
    vi.advanceTimersByTime(250);
    expect(calls).toEqual([250, 250]);
    expect(r.running).toBe(true);
  });

  it('PC 가 잠들었다 깨도 한 번에 1초까지만 따라잡음', () => {
    const calls: number[] = [];
    const r = make(calls);
    r.start();
    now += 3_600_000;
    vi.advanceTimersByTime(250);
    expect(calls).toEqual([1000]);
  });

  it('멈추면 더 안 부름 · 두 번 시작해도 하나만', () => {
    const calls: number[] = [];
    const r = make(calls);
    r.start();
    r.start();
    now += 250;
    vi.advanceTimersByTime(250);
    expect(calls).toHaveLength(1);
    r.stop();
    now += 1000;
    vi.advanceTimersByTime(1000);
    expect(calls).toHaveLength(1);
    expect(r.running).toBe(false);
  });
});
