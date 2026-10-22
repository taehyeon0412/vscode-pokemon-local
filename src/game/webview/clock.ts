/**
 * 웹뷰 게임 시계 — 3:3 박자 (기본 0.8 · 전투 ×2 · 끼어들 창 늦춤 — orders #83 · #81, core gameTempo) + 개발 모드 (임시, gdd 8장) 전투 ×0.5 · ×0.25 · 멈춤.
 * 게임 계산 · 일반 모드 연출 (main-bundle.js) · CSS 움직임이 모두 같은 시계를 보게: performance.now · setTimeout · setInterval ·
 * requestAnimationFrame 의 시간을 바꾸고, CSS · Web Animations 는 재생 빠르기를 같은 배로.
 * 처음 1 이 아닌 배가 될 때 한 번 끼우고 그 뒤로는 이 웹뷰가 다시 뜰 때까지 빼지 않음 (배 1 = 그대로 흐름) — 빼면 시간이 거꾸로 가거나 튀고 (×2 로 앞선 만큼
 * 일반 모드 포켓몬이 멈춤) 부른 쪽이 들고 있는 타이머 번호를 못 끔 (코드 리뷰어 #83). 0ms 타이머는 그대로 (Preact 그리기 · "다음 차례" 가 멈춤에 막히지 않게).
 * main-bundle.js 는 fxGuard 를 건너뛰는 타이머로 window.__pgSetTimeout (배를 따름) 을 씀 — 불러올 때 잡아 둔 진짜 setTimeout 이 0.8배를 무시하던 것.
 */
import { gameTempo, inBattle, type GameState } from '../core/engine';

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
    // 밀린 인터벌은 몰아서 돌지 않음 (진짜 setInterval 처럼)
    else t.due = Math.max(t.due + Math.max(1, t.every), now);
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

/** 재생 빠르기를 지금 배로 */
function rate(list: readonly Animation[]): void {
  for (const a of list) if (a.playbackRate !== scale) a.playbackRate = scale;
}

/**
 * CSS · Web Animations 재생 빠르기 — 배가 바뀔 때 한 번 훑고, 새로 생기는 것은 생길 때 (Element.animate · animationstart · transitionrun).
 * 장마다 document.getAnimations() 를 훑던 것 (3:3 한 판 내내 스타일 계산 — 코드 리뷰어 #83 PC 부담) 대신
 */
function watchCss(): void {
  if (typeof Element !== 'undefined') {
    const animate0 = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, ...args: Parameters<Element['animate']>) {
      const a = animate0.apply(this, args);
      if (scale !== 1) a.playbackRate = scale;
      return a;
    };
  }
  const onStart = (e: Event) => {
    if (scale !== 1 && e.target instanceof Element) rate(e.target.getAnimations());
  };
  document.addEventListener('animationstart', onStart, true);
  document.addEventListener('transitionrun', onStart, true);
}

function install(): void {
  if (installed) return;
  installed = true;
  vBase = real.now();
  rBase = vBase;
  Object.defineProperty(performance, 'now', { value: vnow, configurable: true, writable: true });
  const w = window as unknown as Record<string, unknown>;
  const later = (fn: unknown, ms?: unknown, ...args: unknown[]) => add(fn, ms, args, false);
  w.setTimeout = later;
  w.setInterval = (fn: unknown, ms?: unknown, ...args: unknown[]) => add(fn, ms, args, true);
  w.clearTimeout = clear;
  w.clearInterval = clear;
  w.requestAnimationFrame = (cb: FrameRequestCallback) => real.raf(() => cb(vnow()));
  // main-bundle.js fxSetTimeout0 (fxGuard 를 건너뛰는 타이머) 가 씀 — 바뀌지 않는 이름
  w.__pgSetTimeout = later;
  watchCss();
}

/** 게임 화면을 떠남 — 배 1 (그대로 흐름). 끼운 시계는 빼지 않음 (위 설명 — 시간이 거꾸로 가지 않고 타이머 번호가 그대로 맞게) */
export function resetGameClock(): void {
  setGameClock(1);
}

/** 지금 배 (1 = 그대로 · 0 = 멈춤) */
export function gameClockScale(): number {
  return scale;
}

export function setGameClock(next: number): void {
  if (next === scale) return;
  if (!installed) {
    if (next === 1) return;
    install();
  }
  vBase = vnow();
  rBase = real.now();
  scale = next;
  schedule();
  rate(document.getAnimations());
}

/**
 * 빨라지는 쪽 (1 넘는 배 — 전투 ×2) 은 그 배가 0.5초 넘게 이어질 때만 — 0.8 사이에 1.6 이 0.04 ~ 0.3초 끼었다 빠지던 것 (디자인 UX #83 U2).
 * 느려지는 쪽 · 1 이하는 바로 (알아챌 순간 · 끼어들 창은 늦게 걸리면 안 됨). 진짜 시간으로 셈
 */
const SETTLE_MS = 500;
let settleWant = 1;
let settleSince = 0;
export function gameClockSettle(target: number): number {
  if (target <= 1 || target <= scale) {
    settleWant = target;
    return target;
  }
  const now = real.now();
  if (target !== settleWant) {
    settleWant = target;
    settleSince = now;
  }
  return now - settleSince >= SETTLE_MS ? target : scale;
}

/** 게임 상태에 맞는 배 — 개발 모드 멈춤 = 0 · 3:3 박자 (gameTempo) × 개발 모드 전투 배 · 그 밖 (일반 모드 · 타이틀 포함) = 1 */
export function gameClockFor(state: GameState | null, playing: boolean): number {
  if (!playing || !state) return 1;
  const dev = state.runtime.dev;
  if (dev?.pause) return 0;
  return (dev && inBattle(state) ? dev.battle : 1) * gameTempo(state);
}
