import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryLeaseFile, MemorySaveArchive, MemorySaveStorage, sampleSave } from '../../test/fixtures/save';
import type { GameState } from '../core/engine';
import type { Save } from '../core/save';
import type { HostToWebview } from '../shared/messages';
import { GameSession, type ViewPort } from './game-session';
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

async function setup(save?: unknown, opts: { lease?: boolean } = {}): Promise<void> {
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
    await session.exitGame();
    expect(view.last('stop')).toBeDefined();
    expect(stored()?.playTimeMs).toBe(4000);
    const count = view.sent.length;
    session.handleMessage(msg({ type: 'ready' }));
    expect(view.sent.length).toBe(count);
  });

  it('일반 모드로 나간 뒤에는 이 창이 쓰지 않음', async () => {
    await enterAndStart(sampleSave());
    await session.exitGame();
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
