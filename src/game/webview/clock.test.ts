/** 웹뷰 게임 시계 (orders #83 · 코드 리뷰어 #83) — 배대로 흐름 · 떠나도 빼지 않아 시간이 거꾸로 가지 않음 · 타이머 번호가 끝까지 맞음 · main-bundle 용 __pgSetTimeout 이 배를 따름 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sampleMonster, sampleSave } from '../../test/fixtures/save';
import { TIMING } from '../core/balance';
import { createGameState, type GameState } from '../core/engine';
import { startTeamBattle, type TeamBattle } from '../core/engine/team';
import { FOE_TITLE_AT_MS, FOE_TITLE_KEEP_MS, setTeamView, type TeamView } from '../features/battle/fx/team-view';
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

  it('#136 빠르게 ▶▶ 장면 전환 — 들어가기 · 나오기 ×3 · 상대 혼자 필살기 = 기 모으기 ×3 → 큰 이름 동안 1 → 본편 ×3 · 내 필살기 · 합동 큰 컷인 · 힘겨루기 · 빠르게 끔은 그대로 (null) · 바로 (0.5초 기다림 없음)', () => {
    const ms = ['m1', 'm2', 'm3'].map((uid) => sampleMonster({ uid, level: 12 }));
    const save = sampleSave({ monsters: Object.fromEntries(ms.map((m) => [m.uid, { ...m, hp: 999 }])), party: ms.map((m) => m.uid) });
    const b0 = startTeamBattle(save, [10, 13, 16].map((species, i) => sampleMonster({ uid: `f${i}`, species, level: 10 })), 'trainer', '상대');
    const inUlt = (side: 'me' | 'foe', fast: boolean | undefined = true): GameState => {
      const b: TeamBattle = { ...b0, phase: 'ult', ult: { side, from: 0, ms: 300, dur: TIMING.ultAnimMs, hitMs: 800, hit: false, window: 0, joinAt: null, joiners: [] } };
      const s = createGameState(save, 3);
      return { ...s, save: { ...s.save, settings: { ...s.save.settings, battleFast: fast } }, runtime: { ...s.runtime, stage: { ...s.runtime.stage!, phase: 'team', team: b } as never } };
    };
    const fast = TIMING.team.tempo * TIMING.team.fasterScale;
    const at = 50_000;
    const view = (o: Partial<TeamView> = {}) => setTeamView({ kind: 'solo', side: 'foe', from: [0], to: { side: 'me', slot: 0 }, phase: 'in', at, ...o });
    const foe = inUlt('foe');
    view();
    expect(clock.teamSceneTempo(foe, at + 10)).toBe(fast);
    view({ phase: 'out' });
    expect(clock.teamSceneTempo(foe, at + 10)).toBe(fast);
    view({ phase: 'show' });
    expect(clock.teamSceneTempo(foe, at + 100)).toBe(fast);
    expect(clock.teamSceneTempo(foe, at + FOE_TITLE_AT_MS)).toBe(TIMING.team.tempo);
    expect(clock.teamSceneTempo(foe, at + FOE_TITLE_AT_MS + FOE_TITLE_KEEP_MS - 1)).toBe(TIMING.team.tempo);
    expect(clock.teamSceneTempo(foe, at + FOE_TITLE_AT_MS + FOE_TITLE_KEEP_MS)).toBe(fast);
    // 큰 이름 (0.16초에 커짐) 이 다 보이는 때 1초 넘게 기본 박자 (U1) — 여유 0.1초
    expect(FOE_TITLE_KEEP_MS - 160).toBeGreaterThanOrEqual(1100);
    // 내 필살기 본편 · 합동 큰 컷인 · 상대 합동 본편 · 힘겨루기 = 그대로 · 내 필살기도 들어가기는 ×3
    const mine = inUlt('me');
    view({ side: 'me', phase: 'show' });
    expect(clock.teamSceneTempo(mine, at + 3000)).toBeNull();
    view({ side: 'me' });
    expect(clock.teamSceneTempo(mine, at + 10)).toBe(fast);
    view({ kind: 'joint', side: 'me', phase: 'cut' });
    expect(clock.teamSceneTempo(mine, at + 10)).toBeNull();
    view({ kind: 'joint', phase: 'show' });
    expect(clock.teamSceneTempo(foe, at + 3000)).toBeNull();
    view({ kind: 'duel' });
    expect(clock.teamSceneTempo(foe, at + 10)).toBeNull();
    // 빠르게 끔 · 장면 없음
    view();
    expect(clock.teamSceneTempo(inUlt('foe', false), at + 10)).toBeNull();
    expect(clock.teamSceneTempo({ ...foe, save: { ...foe.save, settings: { ...foe.save.settings, battleFast: undefined } } }, at + 10)).toBeNull();
    setTeamView(null);
    expect(clock.teamSceneTempo(foe, at + 10)).toBeNull();
    // 바로 걸림 (gameClockSettle 의 0.5초 기다림 없이 — 0.35초 들어가기가 다 지나서야 빨라지지 않게)
    clock.setGameClock(1);
    view({ at: performance.now() });
    expect(clock.gameClockNow(foe, true)).toBe(fast);
    setTeamView(null);
    clock.setGameClock(1);
  });

  it('#136 쓰러짐 (새 쓰러짐 기록) 을 본 뒤 진짜 1초는 기본 박자 — 붙잡힌 엔진 시간으로 세면 맞아 쓰러진 뒤 연출 끝까지 1 로 남던 것 ("진짜 시계 1초")', async () => {
    const ms = ['m1', 'm2', 'm3'].map((uid) => sampleMonster({ uid, level: 12 }));
    const save = sampleSave({ monsters: Object.fromEntries(ms.map((m) => [m.uid, { ...m, hp: 999 }])), party: ms.map((m) => m.uid) });
    const b0 = startTeamBattle(save, [10, 13, 16].map((species, i) => sampleMonster({ uid: `f${i}`, species, level: 10 })), 'trainer', '상대');
    const b: TeamBattle = { ...b0, phase: 'ult', log: [{ id: 7, at: b0.t, t: 'faint', side: 'me', slot: 2 }], logSeq: 7, ult: { side: 'foe', from: 0, ms: 300, dur: TIMING.ultAnimMs, hitMs: 800, hit: false, window: 0, joinAt: null, joiners: [] } };
    const s = createGameState(save, 3);
    const foe: GameState = { ...s, save: { ...s.save, settings: { ...s.save.settings, battleFast: true } }, runtime: { ...s.runtime, stage: { ...s.runtime.stage!, phase: 'team', team: b } as never } };
    const fast = TIMING.team.tempo * TIMING.team.fasterScale;
    setTeamView({ kind: 'solo', side: 'foe', from: [0], to: { side: 'me', slot: 0 }, phase: 'out', at: 0 });
    expect(clock.teamSceneTempo({ ...foe, runtime: { ...foe.runtime, stage: { ...foe.runtime.stage!, team: { ...b, log: [], logSeq: 0 } } as never } }, 10)).toBe(fast);
    expect(clock.teamSceneTempo(foe, 10)).toBeNull();
    await sleep(TIMING.team.fastKeepMs - 300);
    expect(clock.teamSceneTempo(foe, 10)).toBeNull();
    await sleep(400);
    expect(clock.teamSceneTempo(foe, 10)).toBe(fast);
    // 말 팝업 ("쓰러졌다!" · 머릿수 안내 — info) 은 진짜 1.2초 — 팝업이 엔진 시간으로 남아 있어도 그 뒤엔 ×3 (꼬리 2.2초가 ×1 이던 것, UX 큼)
    const said: GameState = { ...foe, runtime: { ...foe.runtime, stage: { ...foe.runtime.stage!, team: { ...b, popups: [{ id: 9, side: 'me', slot: 2, text: '개굴닌자 쓰러졌다!', ms: 0, kind: 'info' }], popupSeq: 9 } } as never } };
    expect(clock.teamSceneTempo(said, 10)).toBeNull();
    await sleep(1000);
    expect(clock.teamSceneTempo(said, 10)).toBeNull();
    await sleep(300);
    expect(clock.teamSceneTempo(said, 10)).toBe(fast);
    setTeamView(null);
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
