/** 진짜 시계 ui/real-clock (UX 리뷰어 #95 13바퀴 큼 1) — 게임 시계가 ×2 · 0.55 로 바뀌어도 화면 붙잡기는 진짜 시간으로 셈 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type * as Clock from './clock';
import type * as Real from '../ui/real-clock';

const nowReal = performance.now.bind(performance);
const realSetTimeout = globalThis.setTimeout;
const g = globalThis as unknown as Record<string, unknown>;
/** 웹뷰 window 흉내 (clock.test.ts 와 같음) */
const win: Record<string, unknown> = {
  setTimeout: globalThis.setTimeout.bind(globalThis),
  clearTimeout: globalThis.clearTimeout.bind(globalThis),
  setInterval: globalThis.setInterval.bind(globalThis),
  clearInterval: globalThis.clearInterval.bind(globalThis),
  requestAnimationFrame: (cb: (t: number) => void) => realSetTimeout(() => cb(nowReal()), 16),
};
const sleep = (ms: number) => new Promise((r) => realSetTimeout(r, ms));
let clock: typeof Clock;
let real: typeof Real;

beforeAll(async () => {
  real = await import('../ui/real-clock');
  g.window = win;
  g.document = { getAnimations: () => [], addEventListener: () => undefined };
  clock = await import('./clock');
});
afterAll(() => {
  clock.setGameClock(1);
  Object.defineProperty(performance, 'now', { value: nowReal, configurable: true, writable: true });
  delete g.window;
  delete g.document;
});

describe('진짜 시계', () => {
  it('게임 시계 ×2 에서도 진짜 시간으로 흐름 (붙잡기 1.2초가 실제 0.6초가 되던 것)', async () => {
    clock.setGameClock(2);
    const g0 = performance.now();
    const r0 = real.realNow();
    await sleep(200);
    expect(performance.now() - g0).toBeGreaterThan(200 * 1.6);
    const dr = real.realNow() - r0;
    expect(dr).toBeGreaterThan(170);
    expect(dr).toBeLessThan(200 + 150);
  });

  it('게임 시계 0.55 에서도 진짜 시간 뒤에 부르고 · 끄면 안 부름', async () => {
    clock.setGameClock(0.55);
    const t0 = nowReal();
    await new Promise<void>((done) => real.realLater(done, 120));
    const dt = nowReal() - t0;
    expect(dt).toBeGreaterThan(100);
    expect(dt).toBeLessThan(120 + 150);
    let ran = false;
    const stop = real.realLater(() => (ran = true), 60);
    stop();
    await sleep(120);
    expect(ran).toBe(false);
  });
});
