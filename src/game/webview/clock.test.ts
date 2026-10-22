/** 웹뷰 게임 시계 (orders #83 · 코드 리뷰어 #83) — 배대로 흐름 · 떠나도 빼지 않아 시간이 거꾸로 가지 않음 · 타이머 번호가 끝까지 맞음 · main-bundle 용 __pgSetTimeout 이 배를 따름 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type * as Clock from './clock';

const nowReal = performance.now.bind(performance);
const realSetTimeout = globalThis.setTimeout;
const g = globalThis as unknown as Record<string, unknown>;
/** 웹뷰 window 흉내 — 시계가 바꿔 끼우는 함수만 (globalThis 와 따로라 테스트 도구의 타이머는 그대로) */
const win: Record<string, unknown> = {
  setTimeout: globalThis.setTimeout.bind(globalThis),
  clearTimeout: globalThis.clearTimeout.bind(globalThis),
  setInterval: globalThis.setInterval.bind(globalThis),
  clearInterval: globalThis.clearInterval.bind(globalThis),
  requestAnimationFrame: (cb: (t: number) => void) => realSetTimeout(() => cb(nowReal()), 16),
};
const sleep = (ms: number) => new Promise((r) => realSetTimeout(r, ms));
let clock: typeof Clock;

beforeAll(async () => {
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

describe('웹뷰 게임 시계', () => {
  it('배 1.6 이면 1.6배로 흐름 · 떠나면 (배 1) 시간이 거꾸로 가지 않음 · 그 뒤 그대로 흐름', async () => {
    clock.setGameClock(1.6);
    const t0 = performance.now();
    await sleep(200);
    const dt = performance.now() - t0;
    expect(dt).toBeGreaterThan(200 * 1.3);
    expect(dt).toBeLessThan(200 * 1.6 + 200);
    const before = performance.now();
    clock.resetGameClock();
    expect(clock.gameClockScale()).toBe(1);
    expect(performance.now()).toBeGreaterThanOrEqual(before);
    const t1 = performance.now();
    await sleep(100);
    expect(performance.now() - t1).toBeGreaterThan(80);
  });

  it('떠나기 전에 건 타이머 번호로 떠난 뒤에도 끌 수 있음 (못 끄는 타이머가 남던 것)', async () => {
    clock.setGameClock(0.8);
    let ran = 0;
    const id = (win.setTimeout as (fn: () => void, ms: number) => number)(() => (ran += 1), 150);
    const every = (win.setInterval as (fn: () => void, ms: number) => number)(() => (ran += 10), 60);
    clock.resetGameClock();
    (win.clearTimeout as (id: number) => void)(id);
    (win.clearInterval as (id: number) => void)(every);
    await sleep(300);
    expect(ran).toBe(0);
  });

  it('빨라지는 쪽 (×2 — 1 넘는 배) 은 0.5초 넘게 이어질 때만 · 느려지는 쪽은 바로 (0.8 사이에 1.6 이 잠깐 끼던 것 — 디자인 UX #83)', async () => {
    clock.setGameClock(0.8);
    expect(clock.gameClockSettle(1.6)).toBe(0.8);
    await sleep(200);
    expect(clock.gameClockSettle(1.6)).toBe(0.8);
    // 잠깐 느려지면 다시 처음부터 셈
    expect(clock.gameClockSettle(0.8)).toBe(0.8);
    expect(clock.gameClockSettle(1.6)).toBe(0.8);
    await sleep(550);
    expect(clock.gameClockSettle(1.6)).toBe(1.6);
    clock.setGameClock(1.6);
    expect(clock.gameClockSettle(0.55)).toBe(0.55);
    expect(clock.gameClockSettle(1)).toBe(1);
    clock.setGameClock(1);
  });

  it('main-bundle 의 fxGuard 건너뛰는 타이머 (__pgSetTimeout) 도 배를 따름 — 배 2 면 200ms 가 약 100ms', async () => {
    clock.setGameClock(2);
    const later = win.__pgSetTimeout as (fn: () => void, ms: number) => number;
    expect(typeof later).toBe('function');
    let at = -1;
    const start = nowReal();
    later(() => (at = nowReal() - start), 200);
    await sleep(170);
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(170);
    clock.setGameClock(1);
  });
});
