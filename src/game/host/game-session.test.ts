import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryLeaseFile, MemorySaveArchive, MemorySaveStorage, sampleSave } from '../../test/fixtures/save';
import type { GameState } from '../core/engine';
import type { Save } from '../core/save';
import type { HostToWebview } from '../shared/messages';
import { TIMING } from '../core/balance';
import { createStartSave } from '../features/starter/model';
import { GameSession, type Mode, type ViewPort } from './game-session';
import { SaveStore } from './save-store';
import { WindowLease } from './window-lease';

class FakeView implements ViewPort {
  visible = true;
  readonly sent: HostToWebview[] = [];
  post(m: HostToWebview): void {
    this.sent.push(m);
  }
  last<T extends HostToWebview['type']>(type: T): Extract<HostToWebview, { type: T }> | undefined {
    return [...this.sent].reverse().find((m) => m.type === type) as Extract<HostToWebview, { type: T }> | undefined;
  }
  count(type: HostToWebview['type']): number {
    return this.sent.filter((m) => m.type === type).length;
  }
}

let now: number;
let storage: MemorySaveStorage;
let archive: MemorySaveArchive;
let leaseFile: MemoryLeaseFile;
let lease: WindowLease | undefined;
let store: SaveStore;
let session: GameSession;
let view: FakeView;
let warns: string[];
let modes: Mode[];

async function setup(save?: unknown, opts: { lease?: boolean } = {}): Promise<void> {
  warns = [];
  modes = [];
  storage = new MemorySaveStorage(save);
  archive = new MemorySaveArchive();
  leaseFile = new MemoryLeaseFile();
  store = new SaveStore(storage, archive, { now: () => now, onLock: (r) => session.onStoreLocked(r) });
  lease = opts.lease
    ? new WindowLease(leaseFile, 'me', { pid: 1, isAlive: () => true, now: () => now, onLost: () => store.lock('다른 VS Code 창이 게임 모드를 가져감') })
    : undefined;
  session = new GameSession({
    store,
    lease,
    now: () => now,
    newSeed: () => 1234,
    log: () => undefined,
    warn: (m) => warns.push(m),
    onModeChanged: (m) => modes.push(m),
    runner: { intervalMs: 250, maxCatchUpMs: 1000, now: () => now },
  });
  await session.init();
  store.start();
  view = new FakeView();
  session.attachView(view);
}

const msg = (m: Record<string, unknown>) => ({ command: 'game', ...m });
const autoSave = (playTimeMs = 0) => sampleSave({ settings: { notifications: true, autoBattle: true }, playTimeMs });
const withPlay = (s: GameState, playTimeMs: number): GameState => ({ ...s, save: { ...s.save, playTimeMs } });
const withAuto = (s: GameState, autoBattle: boolean): GameState => ({ ...s, save: { ...s.save, settings: { ...s.save.settings, autoBattle } } });
const stored = () => storage.read() as Save | undefined;
const snap = () => session.snapshot;

/** 게임 모드로 들어가 웹뷰가 준비됨(ready) → 확장이 맡긴 start */
async function enterAndStart(save: Save, opts: { lease?: boolean } = {}) {
  await setup(save, opts);
  expect(await session.enterGame()).toBe('entered');
  session.handleMessage(msg({ type: 'ready' }));
  const start = view.last('start');
  if (!start) throw new Error('start 가 안 옴');
  return start;
}

/** 🎮 · 🏠 로 나가기 — 웹뷰가 마지막 상태로 답하지 않는 경우라 기다리는 시간만큼 흘려보냄 (답하는 경우는 따로 테스트) */
async function exitNow(p: Promise<void> = session.exitGame()): Promise<void> {
  await vi.advanceTimersByTimeAsync(TIMING.exitWaitMs);
  await p;
}

/** 확장 쪽 계산을 ms 만큼 돌림 */
function runHost(ms: number): void {
  for (let t = 0; t < ms; t += 250) {
    now += 250;
    vi.advanceTimersByTime(250);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  now = 1_000_000;
});
afterEach(() => {
  vi.useRealTimers();
});

describe('게임 모드 들어가기', () => {
  it('일반 모드에서 웹뷰가 뜨면(boot) 게임을 안 불러옴', async () => {
    await setup();
    session.handleMessage(msg({ type: 'boot' }));
    expect(view.sent).toEqual([]);
    expect(session.stats.boots).toBe(1);
  });

  it('켤 때는 읽기만 — 고칠 게 있는 세이브도 게임 모드가 아니면 쓰지 않음', async () => {
    await setup({ ...sampleSave(), party: ['m1', 'ghost'] });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(storage.writes).toBe(0);
    expect(archive.items).toEqual([]);
  });

  it('세이브가 있으면 들어가서 game.js 를 불러오라고 함', async () => {
    await setup(sampleSave());
    expect(await session.enterGame()).toBe('entered');
    expect(snap().mode).toBe('game');
    expect(view.sent).toEqual([{ command: 'game', type: 'load' }]);
    expect(await session.enterGame()).toBe('already');
  });

  it('세이브가 없거나 망가졌으면 들어가지 않음 (no-save) — 새로 하기는 타이틀에서 (단계 3)', async () => {
    await setup();
    expect(await session.enterGame()).toBe('no-save');
    await setup({ version: 1, monsters: 'oops' });
    expect(await session.enterGame()).toBe('no-save');
    expect(snap().mode).toBe('normal');
    expect(stored()).toEqual({ version: 1, monsters: 'oops' });
    expect(archive.items).toHaveLength(1); // 들어가려 할 때 원본을 보관
  });

  it('더 새 확장의 세이브면 들어가지 않음 (locked) — 빈 게임을 몰래 시작하지 않음', async () => {
    await setup({ version: 9 });
    expect(await session.enterGame()).toBe('locked');
    expect(snap().mode).toBe('normal');
    expect(stored()).toEqual({ version: 9 });
  });

  it('다른 VS Code 창이 게임 중이면 들어가지 않음 (busy), 끝나면 들어감', async () => {
    await setup(sampleSave(), { lease: true });
    leaseFile.write({ owner: 'other-window', pid: 2, until: now + 10_000 });
    expect(await session.enterGame()).toBe('busy');
    leaseFile.remove();
    expect(await session.enterGame()).toBe('entered');
    expect(leaseFile.record?.owner).toBe('me');
    await session.exitGame();
    expect(leaseFile.record).toBeNull();
  });

  it('들어갈 때 다시 읽음 — 그 사이 다른 창이 한 진행을 덮지 않음', async () => {
    await setup(sampleSave({ money: 100, updatedAt: 1 }));
    storage.write(sampleSave({ money: 5000, updatedAt: 2 })); // 다른 창에서 하고 나감
    await session.enterGame();
    session.handleMessage(msg({ type: 'ready' }));
    expect(view.last('start')!.state.save.money).toBe(5000);
  });

  it('들어가기 · 나가기를 겹쳐 불러도 한 줄로 — 잠금을 쥔 채 게임 모드', async () => {
    await setup(sampleSave(), { lease: true });
    await session.enterGame();
    const exit = session.exitGame();
    const enter = session.enterGame();
    await Promise.all([exit, enter]);
    expect(snap().mode).toBe('game');
    expect(leaseFile.record?.owner).toBe('me');
    expect(lease!.held).toBe(true);
  });

  it('세이브를 읽다 실패해도 그 뒤 게임 모드가 막히지 않음 (던지지 않음)', async () => {
    const failing = { load: () => Promise.reject(new Error('boom')) } as unknown as SaveStore;
    const s = new GameSession({ store: failing, now: () => now, newSeed: () => 1, log: () => undefined });
    expect((await s.init()).kind).toBe('broken');
    failing.load = () => Promise.resolve({ kind: 'none' });
    Object.defineProperty(failing, 'lockedReason', { get: () => null });
    await expect(s.enterGame()).resolves.toBe('no-save');
  });
});

describe('웹뷰가 맡는 동안', () => {
  it('맡긴 epoch 의 상태는 받아서 저장 대기, 옛 epoch 은 버림', async () => {
    const start = await enterAndStart(sampleSave());
    session.handleMessage(msg({ type: 'state', epoch: start.epoch, state: withPlay(start.state, 1000) }));
    expect(snap().state?.save.playTimeMs).toBe(1000);
    expect(store.hasPending).toBe(true);
    session.handleMessage(msg({ type: 'state', epoch: start.epoch - 1, state: withPlay(start.state, 50) }));
    expect(snap().state?.save.playTimeMs).toBe(1000);
    expect(session.stats.stale).toBe(1);
  });

  it('save-now 는 바로 씀', async () => {
    const start = await enterAndStart(sampleSave());
    session.handleMessage(msg({ type: 'save-now', epoch: start.epoch, reason: 'catch', state: withPlay(start.state, 777) }));
    await vi.advanceTimersByTimeAsync(0);
    expect(stored()?.playTimeMs).toBe(777);
  });

  it('이상한 상태는 버림 (세이브 검사)', async () => {
    const start = await enterAndStart(sampleSave());
    const bad = { ...start.state, save: { ...start.state.save, monsters: 'oops' } };
    session.handleMessage(msg({ type: 'state', epoch: start.epoch, state: bad }));
    expect(session.stats.rejected).toBe(1);
    expect(snap().state?.save.monsters).toEqual(start.state.save.monsters);
  });

  it('확장 쪽에서 세이브를 바꾸면(changeSave) 저장 대기 + 웹뷰에 바뀐 상태로 다시 맡김 · 게임 모드가 아니면 안 바꿈', async () => {
    await setup(sampleSave());
    expect(session.changeSave((s) => ({ ...s, money: 1 }))).toBe(false);
    const start = await enterAndStart(sampleSave());
    expect(session.changeSave((s) => ({ ...s, money: 4242 }))).toBe(true);
    const again = view.last('start')!;
    expect(again.epoch).toBe(start.epoch + 1);
    expect(again.state.save.money).toBe(4242);
    expect(store.hasPending).toBe(true);
  });

  it('웹뷰가 game.js 를 못 불러오면 확장이 들고 있음 (자동 전투면 계속 계산)', async () => {
    await setup(autoSave());
    await session.enterGame();
    session.handleMessage(msg({ type: 'load-failed', message: 'x' }));
    expect(snap().owner).toBe('host');
    expect(snap().running).toBe(true);
  });
});

describe('패널이 안 보일 때 (mvp-spec 3.3 U2)', () => {
  it('자동 전투가 꺼져 있으면 확장이 넘겨받고 멈춰 둠', async () => {
    await enterAndStart(sampleSave({ playTimeMs: 0 }));
    session.onVisibilityChanged(false);
    expect(snap().owner).toBe('host');
    runHost(2000);
    expect(snap().running).toBe(false);
    expect(snap().state?.save.playTimeMs).toBe(0);
  });

  it('자동 전투가 켜져 있으면 확장이 그림 없이 계속 계산', async () => {
    await enterAndStart(autoSave());
    session.onVisibilityChanged(false);
    expect(snap().running).toBe(true);
    runHost(2000);
    expect(snap().state?.save.playTimeMs).toBe(2000);
  });

  it('hidden 이 먼저 오면 받고 넘겨받음 · 같은 hidden 이 또 와도 되돌아가지 않음', async () => {
    const start = await enterAndStart(autoSave());
    session.handleMessage(msg({ type: 'hidden', epoch: start.epoch, state: withPlay(start.state, 1500) }));
    expect(snap().owner).toBe('host');
    runHost(500);
    session.handleMessage(msg({ type: 'hidden', epoch: start.epoch, state: withPlay(start.state, 1500) }));
    expect(snap().state?.save.playTimeMs).toBe(2000);
  });

  it('넘겨받은 뒤 늦게 온 같은 epoch 의 state · save-now · hidden 은 받아 줌 (패널을 접는 순간의 잡기를 잃지 않게)', async () => {
    const start = await enterAndStart(autoSave());
    session.onVisibilityChanged(false);
    session.handleMessage(msg({ type: 'save-now', epoch: start.epoch, reason: 'catch', state: { ...start.state, save: { ...start.state.save, playTimeMs: 900, money: 4321 } } }));
    await vi.advanceTimersByTimeAsync(0);
    expect(stored()?.money).toBe(4321);
    session.handleMessage(msg({ type: 'hidden', epoch: start.epoch, state: withPlay(start.state, 950) }));
    expect(snap().state?.save.playTimeMs).toBe(950);
    session.handleMessage(msg({ type: 'state', epoch: start.epoch, state: withPlay(start.state, 10) }));
    expect(snap().state?.save.playTimeMs).toBe(950);
  });

  it('늦게 온 상태에서 자동 전투가 꺼져 있으면 확장 계산도 멈춤', async () => {
    const start = await enterAndStart(autoSave());
    session.onVisibilityChanged(false);
    expect(snap().running).toBe(true);
    session.handleMessage(msg({ type: 'hidden', epoch: start.epoch, state: withAuto(start.state, false) }));
    expect(snap().running).toBe(false);
  });

  it('아주 빨리 접어서 안 보이는 채로 준비(ready)되면 맡기지 않고 확장이 들고 있음', async () => {
    await setup(autoSave());
    await session.enterGame();
    view.visible = false;
    session.handleMessage(msg({ type: 'ready' }));
    expect(view.count('start')).toBe(0);
    expect(snap().owner).toBe('host');
    expect(snap().running).toBe(true);
  });

  it('다시 보여서 웹뷰가 준비되면 확장 상태를 넘기고 확장 계산은 멈춤 — 시간이 이어짐', async () => {
    await enterAndStart(autoSave());
    session.onVisibilityChanged(false);
    runHost(1000);
    session.handleMessage(msg({ type: 'boot' }));
    session.handleMessage(msg({ type: 'ready' }));
    const again = view.last('start')!;
    expect(again.epoch).toBe(3);
    expect(again.state.save.playTimeMs).toBe(1000);
    expect(snap().running).toBe(false);
    expect(snap().owner).toBe('webview');
  });

  it('보기가 아주 닫혀도(detach) 넘겨받음', async () => {
    await enterAndStart(autoSave());
    session.detachView();
    expect(snap().owner).toBe('host');
  });
});

describe('VS Code 밖 (창 포커스) — mvp-spec 3.3', () => {
  it('자동 전투가 꺼져 있으면 웹뷰를 멈춤(suspend) → hidden 으로 받고 멈춰 둠 → 돌아오면 다시 맡김', async () => {
    const start = await enterAndStart(sampleSave({ playTimeMs: 0 }));
    session.onWindowFocusChanged(false);
    expect(view.last('suspend')).toBeDefined();
    session.handleMessage(msg({ type: 'hidden', epoch: start.epoch, state: withPlay(start.state, 300) }));
    expect(snap().owner).toBe('host');
    expect(snap().running).toBe(false);
    session.onWindowFocusChanged(true);
    expect(snap().owner).toBe('webview');
    expect(view.last('start')!.state.save.playTimeMs).toBe(300);
  });

  it('hidden 이 오기 전에 포커스가 돌아와도 멈춘 채로 남지 않음', async () => {
    const start = await enterAndStart(sampleSave());
    session.onWindowFocusChanged(false);
    session.onWindowFocusChanged(true);
    session.handleMessage(msg({ type: 'hidden', epoch: start.epoch, state: start.state }));
    expect(snap().owner).toBe('webview');
  });

  it('자동 전투가 켜져 있으면 VS Code 밖이어도 계속 (멈추지 않음)', async () => {
    await enterAndStart(autoSave());
    session.onWindowFocusChanged(false);
    expect(view.count('suspend')).toBe(0);
    expect(snap().owner).toBe('webview');
  });

  it('VS Code 밖에서 웹뷰가 보낸 상태로 자동 전투가 꺼졌으면 그때 멈춤', async () => {
    const start = await enterAndStart(autoSave());
    session.onWindowFocusChanged(false);
    session.handleMessage(msg({ type: 'state', epoch: start.epoch, state: withAuto(start.state, false) }));
    expect(view.count('suspend')).toBe(1);
  });

  it('suspend 로 멈췄는데 늦게 온 상태가 자동 전투면, 보이는 웹뷰에 다시 맡김 (보이는 패널이 멈춰 있지 않게)', async () => {
    const start = await enterAndStart(sampleSave());
    session.onWindowFocusChanged(false);
    session.handleMessage(msg({ type: 'hidden', epoch: start.epoch, state: withAuto(start.state, true) }));
    expect(snap().owner).toBe('webview');
  });
});

describe('일반 모드로 · 새로 하기 · 잠김 · 끄기', () => {
  it('일반 모드로: stop 을 보내고 바로 저장, 그 뒤 ready 는 무시', async () => {
    const start = await enterAndStart(sampleSave());
    session.handleMessage(msg({ type: 'state', epoch: start.epoch, state: withPlay(start.state, 4000) }));
    await exitNow();
    expect(view.last('stop')).toBeDefined();
    expect(stored()?.playTimeMs).toBe(4000);
    const count = view.sent.length;
    session.handleMessage(msg({ type: 'ready' }));
    expect(view.sent.length).toBe(count);
  });

  it('일반 모드로 나간 뒤에는 이 창이 쓰지 않음', async () => {
    await enterAndStart(sampleSave());
    await exitNow();
    const writes = storage.writes;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(storage.writes).toBe(writes);
  });

  it('새로 하기: 옛 세이브는 보관함으로, 그다음 게임 모드에 들어갈 수 있음', async () => {
    await setup({ version: 9 });
    expect(await session.startNewSave(sampleSave({ money: 1 }))).toBe('done');
    expect(stored()?.money).toBe(1);
    expect(archive.items.some((i) => (i.raw as { version: number }).version === 9)).toBe(true);
    expect(await session.enterGame()).toBe('entered');
  });

  it('다른 창이 게임 중이면 새로 하기도 하지 않음 (busy)', async () => {
    await setup(sampleSave({ money: 5 }), { lease: true });
    leaseFile.write({ owner: 'other-window', pid: 2, until: now + 10_000 });
    expect(await session.startNewSave(sampleSave({ money: 1 }))).toBe('busy');
    expect(stored()?.money).toBe(5);
  });

  it('새로 하기가 실패하면 (보관함 · 디스크 오류) 잠금 · 쓰기 권한을 놓고 상태도 그대로 — failed', async () => {
    await setup(sampleSave({ money: 5 }), { lease: true });
    archive.failNext = 1;
    expect(await session.startNewSave(sampleSave({ money: 1 }))).toBe('failed');
    expect(leaseFile.record).toBeNull();
    expect(lease!.held).toBe(false);
    expect(snap().state?.save.money).toBe(5);
    expect(stored()?.money).toBe(5);
  });

  it('게임 중 새로 하기는 새 epoch 으로 — 웹뷰가 보낸 옛 진행이 새 세이브를 덮지 않음', async () => {
    const start = await enterAndStart(sampleSave({ money: 5 }));
    expect(await session.startNewSave(sampleSave({ money: 1 }))).toBe('done');
    session.handleMessage(msg({ type: 'state', epoch: start.epoch, state: start.state }));
    expect(snap().state?.save.money).toBe(1);
    expect(view.last('start')!.state.save.money).toBe(1);
  });

  it('지난 epoch 의 hidden 은 버림 — 지금 맡은 웹뷰를 두고 확장이 넘겨받지 않음', async () => {
    const start = await enterAndStart(sampleSave());
    session.handleMessage(msg({ type: 'ready' })); // 다시 맡김 → epoch +1
    session.handleMessage(msg({ type: 'hidden', epoch: start.epoch, state: start.state }));
    expect(snap().owner).toBe('webview');
  });

  it('game.js 를 못 불러온 웹뷰에는 포커스가 돌아와도 맡기지 않음', async () => {
    await setup(autoSave());
    await session.enterGame();
    session.handleMessage(msg({ type: 'load-failed', message: 'x' }));
    session.onWindowFocusChanged(false);
    session.onWindowFocusChanged(true);
    expect(snap().owner).toBe('host');
  });

  it('게임 중에 다른 창이 세이브를 바꾸면 덮지 않고 일반 모드로', async () => {
    const start = await enterAndStart(sampleSave({ updatedAt: 1 }));
    storage.write(sampleSave({ updatedAt: 999, money: 77 }));
    session.handleMessage(msg({ type: 'save-now', epoch: start.epoch, reason: 'catch', state: start.state }));
    await vi.advanceTimersByTimeAsync(0);
    expect(stored()?.money).toBe(77);
    expect(snap().mode).toBe('normal');
    expect(view.last('stop')).toBeDefined();
  });

  it('창 잠금을 잃으면 쓰지 않고 일반 모드로', async () => {
    const start = await enterAndStart(sampleSave(), { lease: true });
    leaseFile.write({ owner: 'other-window', pid: 2, until: now + 30_000 });
    now += 10_000;
    await vi.advanceTimersByTimeAsync(10_000);
    const writes = storage.writes;
    session.handleMessage(msg({ type: 'save-now', epoch: start.epoch, reason: 'catch', state: start.state }));
    await vi.advanceTimersByTimeAsync(0);
    expect(snap().mode).toBe('normal');
    expect(storage.writes).toBe(writes);
  });

  it('끌 때(dispose) 게임 중이던 상태를 바로 씀 · 창 잠금을 놓음', async () => {
    await enterAndStart(autoSave(), { lease: true });
    session.onVisibilityChanged(false);
    runHost(500);
    expect(session.dispose()).toBe(true);
    expect(stored()?.playTimeMs).toBe(500);
    expect(leaseFile.record).toBeNull();
  });
});

describe('🎮 · S02 타이틀 (단계 3)', () => {
  const flush = () => vi.advanceTimersByTimeAsync(0);

  /** 🎮 → load → (game.js) ready → title */
  async function openTitle(save?: unknown, opts: { lease?: boolean } = {}) {
    await setup(save, opts);
    await session.toggleGame();
    expect(snap().mode).toBe('title');
    expect(view.last('load')).toBeDefined();
    session.handleMessage(msg({ type: 'ready' }));
    await flush();
    const title = view.last('title');
    if (!title) throw new Error('title 이 안 옴');
    return title.info;
  }

  it('🎮 → 타이틀: 세이브 요약 (팀 맨 앞 · 돈 · 배지 · 플레이 시간), 아직 게임은 안 돎 · 창 잠금도 안 쥠', async () => {
    const info = await openTitle(sampleSave({ money: 4321, badges: ['forest'], playTimeMs: 60_000 }), { lease: true });
    expect(info).toEqual({
      save: 'ok',
      busy: false,
      summary: { playTimeMs: 60_000, money: 4321, badges: ['forest'], lead: { form: 'bulbasaur', species: 1, level: 5 } },
    });
    expect(session.stats.titles).toBe(1);
    expect(snap().owner).toBe('none');
    expect(view.count('start')).toBe(0);
    expect(lease?.held).toBe(false);
  });

  it('타이틀 중에 웹뷰가 새로 뜨면 (boot) 다시 불러오고 요약을 다시 보냄', async () => {
    await openTitle(sampleSave());
    session.handleMessage(msg({ type: 'boot' }));
    expect(view.sent.at(-1)).toEqual({ command: 'game', type: 'load' });
    session.handleMessage(msg({ type: 'ready' }));
    await flush();
    expect(session.stats.titles).toBe(2);
  });

  it('세이브 없음 · 망가짐 · 더 새 버전', async () => {
    expect(await openTitle()).toEqual({ save: 'none', busy: false, summary: null });
    expect((await openTitle({ version: 1, monsters: 'oops' })).save).toBe('broken');
    expect((await openTitle({ ...sampleSave(), version: 99 })).save).toBe('newer');
    expect(archive.items).toEqual([]); // 타이틀은 읽기만
  });

  it('더 새 버전 세이브로 타이틀을 열어도 요약은 한 번 (읽을 때 잠김 → 다시 보내기 → 다시 읽기로 돌지 않음, bugs #56)', async () => {
    await openTitle({ ...sampleSave(), version: 99 });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(view.count('title')).toBe(1);
  });

  it('타이틀은 다른 창이 바꾼 세이브를 다시 읽음', async () => {
    await setup(sampleSave({ money: 1 }));
    storage.write(sampleSave({ money: 2 }));
    await session.openTitle();
    session.handleMessage(msg({ type: 'ready' }));
    await flush();
    expect(view.last('title')?.info.summary?.money).toBe(2);
  });

  it('이어 하기 → 게임 모드 → (ready) 세이브 그대로 start', async () => {
    await openTitle(sampleSave({ money: 555 }), { lease: true });
    session.handleMessage(msg({ type: 'title-continue' }));
    await flush();
    expect(snap().mode).toBe('game');
    expect(lease?.held).toBe(true);
    session.handleMessage(msg({ type: 'ready' }));
    expect(view.last('start')?.state.save.money).toBe(555);
  });

  it('이어 할 세이브가 없으면 타이틀에 그대로 · 안내', async () => {
    await openTitle();
    session.handleMessage(msg({ type: 'title-continue' }));
    await flush();
    expect(snap().mode).toBe('title');
    expect(view.last('title')?.info.notice).toBe('no-save');
  });

  it('새로 하기 → 새 세이브로 바로 저장 · 지금 세이브는 보관함에 · 게임 모드로', async () => {
    await openTitle(sampleSave({ money: 999 }), { lease: true });
    const fresh = createStartSave(now, 7);
    session.handleMessage(msg({ type: 'title-new', save: fresh }));
    await flush();
    // 저장소가 쓸 때 updatedAt 을 찍음 (다른 창이 썼는지 확인용) — 나머지는 그대로
    const sameAsFresh = (s: Save | undefined) => expect({ ...s, updatedAt: fresh.updatedAt }).toEqual(fresh);
    sameAsFresh(stored());
    expect(archive.items.map((i) => i.reason)).toEqual(['replaced']);
    expect((archive.items[0]?.raw as Save).money).toBe(999);
    expect(snap().mode).toBe('game');
    session.handleMessage(msg({ type: 'ready' }));
    sameAsFresh(view.last('start')?.state.save);
  });

  it('세이브가 없을 때 새로 하기 — 보관할 것 없음', async () => {
    await openTitle();
    session.handleMessage(msg({ type: 'title-new', save: createStartSave(now, 7) }));
    await flush();
    expect(snap().mode).toBe('game');
    expect(archive.items).toEqual([]);
    expect(stored()?.party).toEqual(['m1']);
  });

  it('새로 하기 세이브가 이상하면 버리고 타이틀에 안내 (지금 세이브는 그대로)', async () => {
    await openTitle(sampleSave({ money: 999 }));
    session.handleMessage(msg({ type: 'title-new', save: { version: 1, monsters: 'oops' } }));
    await flush();
    expect(snap().mode).toBe('title');
    expect(stored()?.money).toBe(999);
    expect(view.last('title')?.info.notice).toBe('bad-save');
  });

  it('다른 창이 게임 중: 타이틀에 표시, 새로 하기 · 이어 하기 모두 막고 세이브는 그대로', async () => {
    await setup(sampleSave({ money: 999 }), { lease: true });
    leaseFile.write({ owner: 'other-window', pid: 2, until: now + 30_000 });
    await session.toggleGame();
    session.handleMessage(msg({ type: 'ready' }));
    await flush();
    expect(view.last('title')?.info.busy).toBe(true);
    session.handleMessage(msg({ type: 'title-continue' }));
    await flush();
    expect(snap().mode).toBe('title');
    expect(view.last('title')?.info.notice).toBe('busy');
    session.handleMessage(msg({ type: 'title-new', save: createStartSave(now, 7) }));
    await flush();
    expect(snap().mode).toBe('title');
    expect(stored()?.money).toBe(999);
    expect(archive.items).toEqual([]);
  });

  it('타이틀에서 일반 모드로 (S02 ③): stop · 아무것도 쓰지 않음', async () => {
    await openTitle(sampleSave());
    session.handleMessage(msg({ type: 'exit', epoch: null, state: null }));
    await flush();
    expect(snap().mode).toBe('normal');
    expect(view.sent.at(-1)).toEqual({ command: 'game', type: 'stop' });
    expect(storage.writes).toBe(0);
  });

  it('게임에서 일반 모드로 (S06 ⑪): 웹뷰의 마지막 상태를 받아 바로 저장 · 창 잠금을 놓음', async () => {
    const start = await enterAndStart(sampleSave(), { lease: true });
    session.handleMessage(msg({ type: 'exit', epoch: start.epoch, state: withPlay(start.state, 4321) }));
    await flush();
    expect(snap().mode).toBe('normal');
    expect(stored()?.playTimeMs).toBe(4321);
    expect(lease?.held).toBe(false);
    expect(view.last('stop')).toBeDefined();
  });

  it('지난 epoch 의 exit 상태는 버리고 (확장 상태로 저장) 그래도 나감', async () => {
    const start = await enterAndStart(sampleSave({ playTimeMs: 100 }));
    session.handleMessage(msg({ type: 'exit', epoch: start.epoch - 1, state: withPlay(start.state, 999_999) }));
    await flush();
    expect(snap().mode).toBe('normal');
    expect(stored()?.playTimeMs).toBe(100);
  });

  it('🎮 를 게임 중에 누르면 일반 모드로 (저장)', async () => {
    const start = await enterAndStart(sampleSave());
    session.handleMessage(msg({ type: 'state', epoch: start.epoch, state: withPlay(start.state, 777) }));
    await exitNow(session.toggleGame());
    expect(snap().mode).toBe('normal');
    expect(stored()?.playTimeMs).toBe(777);
  });

  it('일반 모드에서 온 타이틀 메시지는 무시 (exit 에는 stop 으로 다시 알려 줌)', async () => {
    await setup(sampleSave());
    session.handleMessage(msg({ type: 'title-new', save: createStartSave(now, 7) }));
    session.handleMessage(msg({ type: 'title-continue' }));
    session.handleMessage(msg({ type: 'exit', epoch: null, state: null }));
    await flush();
    expect(snap().mode).toBe('normal');
    expect(view.sent).toEqual([{ command: 'game', type: 'stop' }]);
    expect(storage.writes).toBe(0);
  });

  it('🎮 를 빠르게 두 번 → 타이틀을 열고 바로 닫음 (꼬이지 않음)', async () => {
    await setup(sampleSave());
    const a = session.toggleGame();
    const b = session.toggleGame();
    await Promise.all([a, b]);
    expect(snap().mode).toBe('normal');
    expect(view.sent.map((m) => m.type)).toEqual(['load', 'stop']);
  });
});

describe('단계 3 검토에서 고친 것 (bugs #59 ~)', () => {
  const flush = () => vi.advanceTimersByTimeAsync(0);

  async function titleOpen(save?: unknown, opts: { lease?: boolean } = {}) {
    await setup(save, opts);
    await session.toggleGame();
    session.handleMessage(msg({ type: 'ready' }));
    await flush();
  }

  it('🎮 로 게임에서 나가면 웹뷰에 마지막 상태를 달라고 하고 (suspend), 답(hidden)을 받아 저장 — 기다리지 않고 바로', async () => {
    const start = await enterAndStart(sampleSave());
    session.handleMessage(msg({ type: 'state', epoch: start.epoch, state: withPlay(start.state, 1000) }));
    const p = session.toggleGame();
    await flush();
    expect(view.sent.at(-1)).toEqual({ command: 'game', type: 'suspend' });
    session.handleMessage(msg({ type: 'hidden', epoch: start.epoch, state: withPlay(start.state, 1900) }));
    await p;
    expect(snap().mode).toBe('normal');
    expect(stored()?.playTimeMs).toBe(1900);
    expect(view.sent.at(-1)).toEqual({ command: 'game', type: 'stop' });
  });

  it('웹뷰가 0.5초 안에 답하지 않으면 확장이 가진 상태로 저장하고 나감', async () => {
    const start = await enterAndStart(sampleSave());
    session.handleMessage(msg({ type: 'state', epoch: start.epoch, state: withPlay(start.state, 1000) }));
    await exitNow(session.toggleGame());
    expect(snap().mode).toBe('normal');
    expect(stored()?.playTimeMs).toBe(1000);
  });

  it('S06 🏠 (exit 에 마지막 상태가 옴) 은 다시 묻지 않음', async () => {
    const start = await enterAndStart(sampleSave());
    session.handleMessage(msg({ type: 'exit', epoch: start.epoch, state: withPlay(start.state, 3000) }));
    await flush();
    expect(view.count('suspend')).toBe(0);
    expect(stored()?.playTimeMs).toBe(3000);
  });

  it('새로 하기를 누르고 곧바로 🎮 → 새 세이브는 쓰고, 결국 일반 모드 · 창 잠금도 놓음 (나가려던 사람을 게임에 넣지 않음)', async () => {
    await titleOpen(sampleSave({ money: 999 }), { lease: true });
    const fresh = createStartSave(now, 7);
    session.handleMessage(msg({ type: 'title-new', save: fresh }));
    const toggle = session.toggleGame();
    await exitNow(toggle);
    expect(snap().mode).toBe('normal');
    expect(lease?.held).toBe(false);
    expect(stored()?.party).toEqual(['m1']);
    expect(stored()?.money).toBe(fresh.money);
  });

  it('타이틀에서 🎮 로 나간 뒤 늦게 온 이어 하기는 무시', async () => {
    await titleOpen(sampleSave(), { lease: true });
    await session.toggleGame();
    session.handleMessage(msg({ type: 'title-continue' }));
    await flush();
    expect(snap().mode).toBe('normal');
    expect(lease?.held).toBe(false);
  });

  it('창 잠금 파일을 못 만들면 (디스크 가득) 던지지 않고 타이틀에 안내', async () => {
    await titleOpen(sampleSave(), { lease: true });
    leaseFile.create = () => {
      throw new Error('ENOSPC');
    };
    session.handleMessage(msg({ type: 'title-continue' }));
    await flush();
    expect(snap().mode).toBe('title');
    expect(view.last('title')?.info.notice).toBe('write-failed');
  });

  it('타이틀 중 게임 화면을 못 불러오면 알리고 일반 모드로 (다음 🎮 에서 다시)', async () => {
    await setup(sampleSave());
    await session.toggleGame();
    session.handleMessage(msg({ type: 'load-failed', message: 'x' }));
    expect(snap().mode).toBe('normal');
    expect(warns).toHaveLength(1);
    expect(view.sent.at(-1)).toEqual({ command: 'game', type: 'stop' });
    await session.toggleGame();
    expect(snap().mode).toBe('title');
  });

  it('게임 중 화면 오류는 알리고 확장이 들고 있음 (🏠 로 나갈 수 있음)', async () => {
    await enterAndStart(autoSave());
    session.handleMessage(msg({ type: 'load-failed', message: '화면 오류' }));
    expect(snap().owner).toBe('host');
    expect(warns).toHaveLength(1);
  });

  it('나가는 사이 다른 창이 세이브를 바꿨으면 덮지 않고, 이 진행은 백업에 두고 알림', async () => {
    const start = await enterAndStart(sampleSave({ updatedAt: 1 }));
    storage.write(sampleSave({ updatedAt: 999, money: 77 }));
    session.handleMessage(msg({ type: 'exit', epoch: start.epoch, state: withPlay(start.state, 5000) }));
    await flush();
    expect(snap().mode).toBe('normal');
    expect(stored()?.money).toBe(77);
    expect(archive.items.find((i) => i.reason === 'unsaved')?.raw).toMatchObject({ playTimeMs: 5000 });
    expect(warns).toHaveLength(1);
    expect(warns[0]).toContain('백업');
  });

  it('나갈 때 디스크 오류로 두 번 못 쓰면 진행을 백업에 두고 알림 (다시 읽어도 잃지 않게)', async () => {
    const start = await enterAndStart(sampleSave());
    storage.failNext = 2;
    session.handleMessage(msg({ type: 'exit', epoch: start.epoch, state: withPlay(start.state, 6000) }));
    await flush();
    expect(archive.items.find((i) => i.reason === 'unsaved')?.raw).toMatchObject({ playTimeMs: 6000 });
    expect(warns[0]).toContain('디스크');
  });

  it('게임 중에 잠겨서 나가면 알림은 한 번만', async () => {
    const start = await enterAndStart(sampleSave({ updatedAt: 1 }));
    storage.write(sampleSave({ updatedAt: 999 }));
    session.handleMessage(msg({ type: 'save-now', epoch: start.epoch, reason: 'catch', state: start.state }));
    await flush();
    expect(snap().mode).toBe('normal');
    expect(warns).toHaveLength(1);
  });

  it('다른 창이 게임 중인 타이틀은 그 창이 끝나면 저절로 다시 보냄 (버튼이 살아남)', async () => {
    await setup(sampleSave(), { lease: true });
    leaseFile.write({ owner: 'other-window', pid: 2, until: now + 60_000 });
    await session.toggleGame();
    session.handleMessage(msg({ type: 'ready' }));
    await flush();
    expect(view.last('title')?.info.busy).toBe(true);
    const titles = session.stats.titles;
    await vi.advanceTimersByTimeAsync(TIMING.titleBusyPollMs * 2);
    expect(session.stats.titles).toBe(titles); // 아직 게임 중 — 다시 보내지 않음
    leaseFile.remove();
    await vi.advanceTimersByTimeAsync(TIMING.titleBusyPollMs);
    expect(view.last('title')?.info.busy).toBe(false);
    await session.toggleGame();
    const after = session.stats.titles;
    await vi.advanceTimersByTimeAsync(TIMING.titleBusyPollMs * 3);
    expect(session.stats.titles).toBe(after); // 일반 모드에서는 지켜보지 않음
  });

  it('모드가 바뀔 때마다 알림 (제목줄 🎮 ↔ 🏠)', async () => {
    await titleOpen(sampleSave());
    session.handleMessage(msg({ type: 'title-continue' }));
    await flush();
    session.handleMessage(msg({ type: 'ready' }));
    await exitNow();
    expect(modes).toEqual(['title', 'game', 'normal']);
  });

  it('게임에 들어갔는데 웹뷰가 준비되기 전에 패널을 접으면 확장이 들고 있음 (자동 전투면 계속)', async () => {
    await setup(autoSave());
    await session.enterGame();
    session.onVisibilityChanged(false);
    expect(snap().owner).toBe('host');
    expect(snap().running).toBe(true);
  });
});

describe('단계 4 검토에서 고친 것 — 스테이지 (확장 쪽)', () => {
  /** 숲 1-1 을 막 시작한 자동 전투 세이브 (시드 42 — 첫 부탁은 87% 쯤) */
  const stageSave = (progress = 0) =>
    sampleSave({ settings: { notifications: true, autoBattle: true }, stages: { 'forest-1': { seed: 42, progress, cleared: false, defeatedTrainers: [], facilities: [] } } });

  it('안 볼 때 (자동 전투) 걷다가 부탁에서 멈추면 계산 · 저장을 멈춤 — 깨어나 저장만 되풀이하지 않게 (테스터)', async () => {
    await enterAndStart(stageSave(0.8784));
    session.onVisibilityChanged(false);
    expect(snap().running).toBe(true);
    runHost(2000);
    expect(snap().state?.runtime.stage?.phase).toBe('request');
    expect(snap().running).toBe(false);
    const steps = session.stats.headlessSteps;
    runHost(5000);
    expect(session.stats.headlessSteps).toBe(steps);
  });

  it('안 볼 때 계산 중 전투 (임시) 가 끝나면 바로 저장', async () => {
    await enterAndStart(stageSave(0.0483));
    session.onVisibilityChanged(false);
    const writes = storage.writes;
    runHost(TIMING.appearMs + TIMING.battlePlaceholderMs + 1000);
    await vi.advanceTimersByTimeAsync(0);
    expect(storage.writes).toBeGreaterThan(writes);
    expect(stored()?.pendingEncounter).toBeNull();
  });

  it('배속은 확장 쪽 값이 기준 — 웹뷰가 보낸 speed 는 무시 (코드 리뷰어)', async () => {
    const start = await enterAndStart(stageSave());
    session.handleMessage(msg({ type: 'state', epoch: start.epoch, state: { ...start.state, runtime: { ...start.state.runtime, speed: 60 } } }));
    expect(snap().state?.runtime.speed).toBe(1);
    expect(session.setSpeed(10)).toBe(true);
    const again = view.last('start')!;
    session.handleMessage(msg({ type: 'state', epoch: again.epoch, state: { ...again.state, runtime: { ...again.state.runtime, speed: 1 } } }));
    expect(snap().state?.runtime.speed).toBe(10);
  });
});
