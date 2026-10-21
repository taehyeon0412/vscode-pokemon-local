/**
 * 개발 모드 (임시, gdd 8장) — 웹뷰 시계를 늦추거나 멈춤 (전투 ×0.5 · ×0.25 · 멈춤).
 * 게임 계산 · 일반 모드 연출 (main-bundle.js) · CSS 움직임이 모두 같은 시계를 보게: performance.now · setTimeout · setInterval ·
 * requestAnimationFrame 의 시간을 바꾸고, CSS · Web Animations 는 재생 빠르기를 같은 배로.
 * 처음 늦출 때 한 번 끼우고 그 뒤로는 이 웹뷰가 다시 뜰 때까지 같은 시계 (배 1 = 그대로 흐름). 0ms 타이머는 그대로 (Preact 그리기 · "다음 차례" 가 멈춤에 막히지 않게).
 */
import { inBattle, type GameState } from '../core/engine';

type Fn = (...args: unknown[]) => void;
interface Timer {
  due: number;
  fn: Fn;
  args: unknown[];
  every: number | null;
}

const real = {
  now: performance.now.bind(performance),
  setTimeout: window.setTimeout.bind(window),
  clearTimeout: window.clearTimeout.bind(window),
  clearInterval: window.clearInterval.bind(window),
  raf: window.requestAnimationFrame.bind(window),
};

let installed = false;
let scale = 1;
let vBase = 0;
let rBase = 0;
let nextId = 1_000_000_000;
let wake: number | null = null;
let cssLoop = false;
const timers = new Map<number, Timer>();

const vnow = () => vBase + (real.now() - rBase) * scale;

function schedule(): void {
  if (wake !== null) real.clearTimeout(wake);
  wake = null;
  if (scale <= 0 || timers.size === 0) return;
  let min = Infinity;
  for (const t of timers.values()) min = Math.min(min, t.due);
  wake = real.setTimeout(fire, Math.max(0, (min - vnow()) / scale));
}

function fire(): void {
  wake = null;
  const now = vnow();
  const due = [...timers.entries()].filter(([, t]) => t.due <= now).sort((a, b) => a[1].due - b[1].due);
  for (const [id, t] of due) {
    if (timers.get(id) !== t) continue;
    if (t.every === null) timers.delete(id);
    else t.due += Math.max(1, t.every);
    try {
      t.fn(...t.args);
    } catch (e) {
      // 다른 타이머는 계속 — 오류는 콘솔로
      real.setTimeout(() => {
        throw e;
      }, 0);
    }
  }
  schedule();
}

function add(fn: unknown, ms: unknown, args: unknown[], every: boolean): number {
  const delay = Math.max(0, Number(ms) || 0);
  if (typeof fn !== 'function') return 0;
  if (delay === 0 && !every) return real.setTimeout(fn as Fn, 0, ...args);
  const id = nextId++;
  timers.set(id, { due: vnow() + delay, fn: fn as Fn, args, every: every ? Math.max(1, delay) : null });
  schedule();
  return id;
}

function clear(id: unknown): void {
  if (typeof id === 'number' && timers.delete(id)) schedule();
  else {
    real.clearTimeout(id as number);
    real.clearInterval(id as number);
  }
}

/** CSS · Web Animations 재생 빠르기 — 배가 1 이 아닌 동안 장마다 새로 생긴 것까지 */
function syncCss(): void {
  for (const a of document.getAnimations()) if (a.playbackRate !== scale) a.playbackRate = scale;
  if (scale !== 1) real.raf(syncCss);
  else cssLoop = false;
}

function install(): void {
  if (installed) return;
  installed = true;
  vBase = real.now();
  rBase = vBase;
  Object.defineProperty(performance, 'now', { value: vnow, configurable: true, writable: true });
  const w = window as unknown as Record<string, unknown>;
  w.setTimeout = (fn: unknown, ms?: unknown, ...args: unknown[]) => add(fn, ms, args, false);
  w.setInterval = (fn: unknown, ms?: unknown, ...args: unknown[]) => add(fn, ms, args, true);
  w.clearTimeout = clear;
  w.clearInterval = clear;
  w.requestAnimationFrame = (cb: FrameRequestCallback) => real.raf(() => cb(vnow()));
}

/** 지금 배 (1 = 그대로 · 0 = 멈춤) */
export function devClockScale(): number {
  return scale;
}

export function setDevClock(next: number): void {
  if (next === scale) return;
  if (!installed) {
    if (next === 1) return;
    install();
  }
  vBase = vnow();
  rBase = real.now();
  scale = next;
  schedule();
  if (!cssLoop) {
    cssLoop = true;
    syncCss();
  }
}

/** 게임 상태에 맞는 배 — 개발 모드 멈춤 = 0 · 전투 중 = 전투 배 · 그 밖 (일반 모드 · 타이틀 포함) = 1 */
export function devClockFor(state: GameState | null, playing: boolean): number {
  const dev = playing ? state?.runtime.dev : undefined;
  if (!dev || !state) return 1;
  if (dev.pause) return 0;
  return inBattle(state) ? dev.battle : 1;
}
