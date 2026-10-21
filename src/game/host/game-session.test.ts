import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryLeaseFile, MemorySaveArchive, MemorySaveStorage, sampleMonster, sampleSave, viaJson } from '../../test/fixtures/save';
import { BALANCE } from '../core/balance';
import { createGameState, readRuntime } from '../core/engine';
import { createNewSave, validateSave } from '../core/save';
import { dailyFor, dayKey } from '../core/rules/daily';
import type { GameState } from '../core/engine';
import type { Save } from '../core/save';
import type { HostToWebview } from '../shared/messages';
import { TIMING } from '../core/balance';
import { createStartSave } from '../features/starter/model';
import { shinyWildSeed } from '../../test/fixtures/stage';
import { stageLayout } from '../core/rules/stage';
import { GameSession, noticeText, type Mode, type ViewPort } from './game-session';
import { SaveStore } from './save-store';
import { WindowLease } from './window-lease';

/** 시드 42 숲 1-1 의 첫 부탁 바로 앞 (길이 바뀌어도 — 단계 9 에서 트레이너가 들어가 자리가 바뀜) */
const nearRequest = () => stageLayout('forest-1', 42).spots.find((s) => s.kind === 'request')!.at - 0.0005;

class FakeView implements ViewPort {
  visible = true;
  readonly sent: HostToWebview[] = [];
  readonly badges: number[] = [];
  badge(count: number): void {
    this.badges.push(count);
  }
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
let notices: string[];
/** 세이브 파일 창 흉내 (orders #33) — 저장한 파일 · 열 파일 (null = 취소) */
let savedFiles: { name: string; text: string }[];
let openFile: { name: string; text: string; tooBig?: number } | null;
/** 열기 창이 닫히기 전까지 기다림 (열기 창이 떠 있는 동안 게임을 나가는 경우 — 코드 리뷰어 #48) */
let openGate: Promise<void> | null;

async function setup(save?: unknown, opts: { lease?: boolean } = {}): Promise<void> {
  warns = [];
  modes = [];
  notices = [];
  savedFiles = [];
  openFile = null;
  openGate = null;
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
    notify: (m) => notices.push(m),
    runner: { intervalMs: 250, maxCatchUpMs: 1000, now: () => now },
    files: {
      save: async (name, text) => {
        savedFiles.push({ name, text });
        return name;
      },
      open: async () => {
        if (openGate) await openGate;
        return openFile;
      },
    },
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

describe('VS Code 밖 (창 포커스) — 보이면 계속 (2026-10-19 태현 님: 웹페이지를 보는 동안 게임이 멈춰 보임)', () => {
  it('VS Code 창이 포커스를 잃어도 패널이 보이면 웹뷰가 계속 계산 · 그리기 — 넘겨받지 않음 (자동 전투 꺼짐)', async () => {
    await enterAndStart(sampleSave({ playTimeMs: 0 }));
    session.onWindowFocusChanged(false);
    expect(view.count('suspend')).toBe(0);
    expect(snap().owner).toBe('webview');
    session.onWindowFocusChanged(true);
    expect(snap().owner).toBe('webview');
  });

  it('VS Code 창이 포커스를 잃어도 패널이 보이면 웹뷰가 계속 계산 · 그리기 — 넘겨받지 않음 (자동 전투 켜짐)', async () => {
    await enterAndStart(autoSave());
    session.onWindowFocusChanged(false);
    expect(view.count('suspend')).toBe(0);
    expect(snap().owner).toBe('webview');
    session.onWindowFocusChanged(true);
    expect(snap().owner).toBe('webview');
  });

  it('포커스가 바뀌면 웹뷰에 focus 로 알림 (포커스 없이 맡기면 start 다음에) · 웹뷰가 보낸 이로치 알림은 "VS Code 로 돌아오면" 문구로 (2026-10-19)', async () => {
    const start = await enterAndStart(sampleSave({ settings: { notifications: true, autoBattle: false } }));
    session.onWindowFocusChanged(false);
    expect(view.last('focus')).toMatchObject({ focused: false });
    session.handleMessage(msg({ type: 'notice', epoch: start.epoch, notice: 'shiny' }));
    // 팝업은 VS Code 밖으로 나간 지 10초 뒤 (alt-tab 을 거름 — 2026-10-21 태현 님 "추천안")
    expect(notices).toHaveLength(0);
    vi.advanceTimersByTime(TIMING.noticeAfterHiddenMs);
    expect(notices.at(-1)).toContain('VS Code 로 돌아오면');
    session.handleMessage(msg({ type: 'notice', epoch: start.epoch + 99, notice: 'shiny' })); // 다른 epoch 은 무시
    vi.advanceTimersByTime(TIMING.noticeAfterHiddenMs);
    expect(notices).toHaveLength(1);
    session.onWindowFocusChanged(true);
    expect(view.last('focus')).toMatchObject({ focused: true });
  });

  it('VS Code 밖에서 웹뷰가 보낸 상태로 자동 전투가 꺼져도 그 까닭만으로는 멈추지 않음 (내 차례 · 부탁이면 화면이 기다림)', async () => {
    const start = await enterAndStart(autoSave());
    session.onWindowFocusChanged(false);
    session.handleMessage(msg({ type: 'state', epoch: start.epoch, state: withAuto(start.state, false) }));
    expect(view.count('suspend')).toBe(0);
    expect(snap().owner).toBe('webview');
  });

  it('안 보일 때 (자동 전투 · 확장이 계산) 이로치 흔적을 만나면 멈추고 알림 (U9 — 명세 검사관 · 코드 리뷰어)', async () => {
    const { seed, spot } = shinyWildSeed();
    const save = sampleSave({ settings: { notifications: true, autoBattle: true }, stages: { 'forest-1': { seed, progress: spot.at - 0.0005, cleared: false, defeatedTrainers: [], facilities: [], run: { startMs: 0, caught: 0, trainers: 0, seen: [], reach: 0, retries: 0 } } } });
    const start = await enterAndStart(save);
    session.onWindowFocusChanged(false);
    session.handleMessage(msg({ type: 'hidden', epoch: start.epoch, state: start.state }));
    runHost(3000);
    expect(snap().state?.runtime.stage?.phase).toBe('hold');
    runHost(TIMING.noticeAfterHiddenMs);
    expect(notices).toHaveLength(1);
  });

  it('안 보여 넘겨받은 마지막 상태가 자동 전투면 확장이 들고 계산 · 포커스가 돌아오면 (보이는 웹뷰) 다시 맡김', async () => {
    const start = await enterAndStart(sampleSave());
    session.onWindowFocusChanged(false);
    session.handleMessage(msg({ type: 'hidden', epoch: start.epoch, state: withAuto(start.state, true) }));
    expect(snap().owner).toBe('host');
    expect(snap().running).toBe(true);
    session.onWindowFocusChanged(true);
    expect(snap().owner).toBe('webview');
    // 다시 맡길 때 포커스가 돌아왔다는 것도 (웹뷰 away 가 남아 이로치 · 라이벌 앞에서 멈춰 있지 않게 — 2026-10-20)
    expect(view.last('focus')).toMatchObject({ focused: true });
  });
});

describe('접힌 상태 (패널이 150px 보다 낮음) — bugs #297 · #299', () => {
  it('접혀서 넘겨받으면 VS Code 포커스가 돌아와도 다시 맡기지 않음 (웹뷰가 바로 돌려주는 왕복) · 다시 높아져 ready 가 오면 맡김', async () => {
    const start = await enterAndStart(autoSave());
    session.handleMessage(msg({ type: 'hidden', epoch: start.epoch, state: start.state, collapsed: true }));
    expect(snap().owner).toBe('host');
    const starts = view.count('start');
    session.onWindowFocusChanged(false);
    session.onWindowFocusChanged(true);
    expect(view.count('start')).toBe(starts);
    expect(snap().owner).toBe('host');
    session.handleMessage(msg({ type: 'ready' }));
    expect(view.count('start')).toBe(starts + 1);
    expect(snap().owner).toBe('webview');
  });

  it('알림 문구: 접혀 있으면 "열면" 대신 "150px 이상으로 올리면" (패널은 이미 열려 있어서)', () => {
    expect(noticeText('shiny', false)).toContain('포켓몬 패널을 열면');
    expect(noticeText('shiny', true)).toContain('150px 이상으로 올리면');
    expect(noticeText('rival', false)).toContain('포켓몬 패널을 열면');
    expect(noticeText('rival', true, true)).toContain('VS Code 로 돌아오면');
    for (const n of ['choice', 'gym', 'clear', 'defeat', 'badge'] as const) {
      expect(noticeText(n, false)).toContain('포켓몬 패널을 열어');
      expect(noticeText(n, true)).toContain('150px 이상으로 올려');
      // 밖 (패널은 보이는데 VS Code 에 포커스 없음) = 돌아와 (gdd 4.13)
      expect(noticeText(n, false, true)).toContain('VS Code 로 돌아와');
    }
    expect(noticeText('battle', false, true)).toContain('[A] 자동 전투면 알아서 싸워요');
    expect(noticeText('paused', false)).toContain('자동 전투가 꺼져 있어 멈춰 있어요');
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
      summary: { playTimeMs: 60_000, money: 4321, badges: ['forest'], lead: { form: 'bulbasaur', species: 1, level: 5 }, where: '1-1 · 40%' },
    });
    expect(session.stats.titles).toBe(1);
    expect(snap().owner).toBe('none');
    expect(view.count('start')).toBe(0);
    expect(lease?.held).toBe(false);
  });

  it('타이틀 요약 "오늘 1/3" (#28) — 오늘의 목표가 켜졌고 세이브의 목표가 오늘 것일 때만', async () => {
    const today = dayKey(new Date(Date.now()));
    const goals = dailyFor(today).goals.map((g, i) => (i === 0 ? { ...g, have: g.need, done: true as const } : g));
    const withDaily = sampleSave({ daily: { day: today, goals } });
    // 꺼져 있으면 (지금 — 개발 모드에서만) 안 보냄
    expect((await openTitle(withDaily)).summary?.daily).toBeUndefined();
    const was = BALANCE.daily.on;
    (BALANCE.daily as { on: boolean }).on = true;
    try {
      expect((await openTitle(withDaily)).summary?.daily).toEqual({ done: 1, total: 3 });
      // 어제 목표면 안 보냄 (오늘 새로 뽑힐 것)
      expect((await openTitle(sampleSave({ daily: { day: '2000-01-01', goals } }))).summary?.daily).toBeUndefined();
      // 목표가 비면 (모르는 목표를 다 뺀 세이브) 안 보냄 — "오늘 0/0" (코드 리뷰어)
      expect((await openTitle(sampleSave({ daily: { day: today, goals: [] } }))).summary?.daily).toBeUndefined();
    } finally {
      (BALANCE.daily as { on: boolean }).on = was;
    }
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
    sampleSave({ settings: { notifications: true, autoBattle: true }, stages: { 'forest-1': { seed: 42, progress, cleared: false, defeatedTrainers: [], facilities: [], run: { startMs: 0, caught: 0, trainers: 0, seen: [], reach: 0, retries: 0 } } } });

  it('안 볼 때 부탁에 오면 바로 [도와준다] 하고 계속 계산 — 멈추지 않음 (2026-10-21 ideas #115, 예전엔 고를 때까지 멈춤)', async () => {
    await enterAndStart(stageSave(nearRequest()));
    session.onVisibilityChanged(false);
    expect(snap().running).toBe(true);
    runHost(2000);
    const st = snap().state?.runtime.stage;
    expect(st?.phase === 'request' ? st.result : 'walked').not.toBeNull();
    expect(snap().running).toBe(true);
  });

  it('안 볼 때 (자동 전투) 전투를 끝까지 계산하고 끝나면 바로 저장', async () => {
    await enterAndStart(stageSave(0.0483));
    session.onVisibilityChanged(false);
    let sawBattle = false;
    let writes = -1;
    let done = false;
    for (let i = 0; i < 600 && !done; i++) {
      runHost(500);
      await vi.advanceTimersByTimeAsync(0);
      const st = snap().state?.runtime.stage?.phase;
      if (st === 'battle' && !sawBattle) {
        sawBattle = true;
        writes = storage.writes;
      }
      done = sawBattle && st === 'walk';
    }
    expect(sawBattle).toBe(true);
    expect(done).toBe(true);
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

describe('멈춤 · 알림 표 — 넘겨받을 때 · 탭 배지 · 접힌 줄 (gdd 4.13 · orders #27 R13)', () => {
  it('자동 꺼짐에서 숨기면 알림 한 번 ("멈춰 있어요") + 탭 배지 1 → 다시 보면 배지 지움', async () => {
    const start = await enterAndStart(sampleSave({ settings: { notifications: true, autoBattle: false } }));
    session.handleMessage(msg({ type: 'hidden', epoch: start.epoch, state: start.state }));
    // 배지는 바로 · 팝업은 숨긴 지 10초 뒤
    expect(view.badges.at(-1)).toBe(1);
    expect(notices).toHaveLength(0);
    runHost(TIMING.noticeAfterHiddenMs);
    expect(notices.filter((n) => n.includes('멈춰 있어요'))).toHaveLength(1);
    runHost(5000);
    expect(notices.filter((n) => n.includes('멈춰 있어요'))).toHaveLength(1);
    session.handleMessage(msg({ type: 'ready' }));
    expect(snap().owner).toBe('webview');
    expect(view.badges.at(-1)).toBe(0);
  });

  it('이미 기다리던 장면 (고르기) 을 넘겨받으면 그 알림 — 걸음을 계산하지 않아도', async () => {
    const save = sampleSave({ settings: { notifications: true, autoBattle: true }, pendingChoices: [{ kind: 'learn', uid: 'm1', moveId: 22 }] });
    const start = await enterAndStart(save);
    const choosing = { ...start.state, runtime: { ...start.state.runtime, stage: { phase: 'choice' as const, ms: 0 }, stageId: 'forest-1' as const } };
    session.handleMessage(msg({ type: 'hidden', epoch: start.epoch, state: choosing }));
    expect(view.badges.at(-1)).toBe(1);
    vi.advanceTimersByTime(TIMING.noticeAfterHiddenMs);
    expect(notices.filter((n) => n.includes('고를 차례'))).toHaveLength(1);
    // 같은 기다림은 한 번 — 보고 다시 떠나도 다시 안 알림 (태현 님 "추천안")
    session.handleMessage(msg({ type: 'ready' }));
    expect(snap().owner).toBe('webview');
    const again = view.last('start')!;
    session.handleMessage(msg({ type: 'hidden', epoch: again.epoch, state: again.state }));
    vi.advanceTimersByTime(TIMING.noticeAfterHiddenMs * 2);
    expect(notices.filter((n) => n.includes('고를 차례'))).toHaveLength(1);
    expect(view.badges.at(-1)).toBe(1);
  });

  it('짧게 숨겼다 10초 안에 돌아오면 팝업 없음 (배지만) · 알림 처음 값은 꺼짐 — 꺼져도 배지는 뜸', async () => {
    let start = await enterAndStart(sampleSave({ settings: { notifications: true, autoBattle: false } }));
    session.handleMessage(msg({ type: 'hidden', epoch: start.epoch, state: start.state }));
    runHost(TIMING.noticeAfterHiddenMs - 2000);
    session.handleMessage(msg({ type: 'ready' }));
    runHost(TIMING.noticeAfterHiddenMs);
    expect(notices).toEqual([]);
    // 새 세이브 = 알림 꺼짐 (gdd 4.13) — 팝업 없이 배지
    const fresh = createNewSave(now);
    expect(fresh.settings.notifications).toBe(false);
    start = await enterAndStart({ ...sampleSave(), settings: fresh.settings, tips: fresh.tips });
    session.handleMessage(msg({ type: 'hidden', epoch: start.epoch, state: start.state }));
    runHost(TIMING.noticeAfterHiddenMs * 2);
    expect(notices).toEqual([]);
    expect(view.badges.at(-1)).toBe(1);
  });

  it('숨긴 채 잠깐 다른 앱에 갔다 와도 숨김 팝업은 10초에 뜸 · 10초 안에 다시 보면 안 뜨고, 다시 숨기면 그 기다림을 다시 알림 (코드 리뷰어)', async () => {
    await enterAndStart(sampleSave({ settings: { notifications: true, autoBattle: false } }));
    // 패널을 숨김 (아래 패널에서 다른 탭) — 확장이 넘겨받음
    view.visible = false;
    session.onVisibilityChanged(false);
    session.onWindowFocusChanged(false);
    runHost(3000);
    session.onWindowFocusChanged(true);
    runHost(TIMING.noticeAfterHiddenMs);
    expect(notices.filter((n) => n.includes('멈춰 있어요'))).toHaveLength(1);
    // 다른 기다림 (고르기) — 10초 안에 다시 보면 취소 · 그 기다림은 "알림" 으로 안 셈
    const save = sampleSave({ settings: { notifications: true, autoBattle: true }, pendingChoices: [{ kind: 'learn', uid: 'm1', moveId: 22 }] });
    const s2 = await enterAndStart(save);
    const choosing = { ...s2.state, runtime: { ...s2.state.runtime, stage: { phase: 'choice' as const, ms: 0 }, stageId: 'forest-1' as const } };
    session.handleMessage(msg({ type: 'hidden', epoch: s2.epoch, state: choosing }));
    runHost(2000);
    session.handleMessage(msg({ type: 'ready' }));
    expect(snap().state?.runtime.noticed).toBeUndefined();
    const again = view.last('start')!;
    session.handleMessage(msg({ type: 'hidden', epoch: again.epoch, state: again.state }));
    runHost(TIMING.noticeAfterHiddenMs);
    expect(notices.filter((n) => n.includes('고를 차례'))).toHaveLength(1);
  });

  it('밖 알림을 기다리는 10초 안에 패널을 숨기면 "패널을 열면" 문구로 (테스터)', async () => {
    const start = await enterAndStart(sampleSave({ settings: { notifications: true, autoBattle: true } }));
    session.onWindowFocusChanged(false);
    session.handleMessage(msg({ type: 'notice', epoch: start.epoch, notice: 'shiny' }));
    runHost(3000);
    view.visible = false;
    session.onVisibilityChanged(false);
    runHost(TIMING.noticeAfterHiddenMs);
    expect(notices).toHaveLength(1);
    expect(notices[0]).not.toContain('VS Code 로 돌아오면');
  });

  it('"멈춰 있어요" 팝업은 처음 3번만 (세이브에 셈)', async () => {
    const start = await enterAndStart(sampleSave({ settings: { notifications: true, autoBattle: false } }));
    let epoch = start.epoch;
    let state = start.state;
    for (let i = 0; i < 5; i++) {
      session.handleMessage(msg({ type: 'hidden', epoch, state }));
      runHost(TIMING.noticeAfterHiddenMs);
      session.handleMessage(msg({ type: 'ready' }));
      const s = view.last('start')!;
      epoch = s.epoch;
      // 웹뷰가 보면 paused 를 지움 (엔진 step — 다시 떠나면 다시 넘겨받음)
      const { noticed: _n, ...runtime } = s.state.runtime;
      state = { ...s.state, runtime };
    }
    expect(notices.filter((n) => n.includes('멈춰 있어요'))).toHaveLength(3);
    expect(state.save.tips?.filter((t) => t.startsWith('paused-'))).toEqual(['paused-1', 'paused-2', 'paused-3']);
  });

  it('넘겨받은 뒤 늦게 온 save-now · hidden 에 같은 알림을 되풀이하지 않음 · 게임에서 나가면 배지 지움 (코드 리뷰어)', async () => {
    const start = await enterAndStart(sampleSave({ settings: { notifications: true, autoBattle: false } }));
    session.onVisibilityChanged(false);
    session.handleMessage(msg({ type: 'save-now', epoch: start.epoch, reason: 'catch', state: withPlay(start.state, 900) }));
    await vi.advanceTimersByTimeAsync(0);
    session.handleMessage(msg({ type: 'hidden', epoch: start.epoch, state: withPlay(start.state, 950) }));
    runHost(TIMING.noticeAfterHiddenMs);
    expect(notices.filter((n) => n.includes('멈춰 있어요'))).toHaveLength(1);
    expect(view.badges.at(-1)).toBe(1);
    await exitNow();
    expect(snap().mode).toBe('normal');
    expect(view.badges.at(-1)).toBe(0);
  });

  it('멈춤 (paused) 은 스테이지에서만 — 병원 안 · 화면 오류로 넘겨받음은 알림 · 배지 없음 (표대로)', async () => {
    const off = sampleSave({ settings: { notifications: true, autoBattle: false } });
    let start = await enterAndStart(off);
    const inside = { ...start.state, runtime: { ...start.state.runtime, stage: { phase: 'facility' as const, kind: 'hospital' as const, at: 0.3, ms: 0, inside: true }, stageId: 'forest-1' as const } };
    session.handleMessage(msg({ type: 'hidden', epoch: start.epoch, state: inside }));
    expect(notices).toEqual([]);
    expect(view.badges.at(-1) ?? 0).toBe(0);
    start = await enterAndStart(off);
    session.handleMessage(msg({ type: 'load-failed', message: 'x' }));
    expect(warns.some((w) => w.includes('화면에 문제'))).toBe(true);
    expect(notices).toEqual([]);
  });

  it('접힌 동안 (150px 아래) 확장이 계산하면 지금 상태를 웹뷰에 (접힌 줄 — 1초에 한 번까지)', async () => {
    const start = await enterAndStart(autoSave());
    session.handleMessage(msg({ type: 'hidden', epoch: start.epoch, state: start.state, collapsed: true }));
    const first = view.count('peek');
    expect(first).toBeGreaterThanOrEqual(1);
    runHost(3000);
    expect(view.count('peek')).toBeGreaterThan(first);
    expect(view.count('peek')).toBeLessThanOrEqual(first + 4);
  });
});

describe('3:3 을 켠 저장 넷 — 개발 모드 밖 (기획 R9 켜기 점검표 ②)', () => {
  const setOn = (on: boolean) => {
    (BALANCE.team as { on: boolean }).on = on;
  };
  const three = (o: Partial<Save> = {}): Save => {
    const ms = ['m1', 'm2', 'm3'].map((uid, i) => ({ ...sampleMonster({ uid, level: 12, species: [1, 4, 7][i]!, form: ['bulbasaur', 'charmander', 'squirtle'][i]! }), hp: 999 }));
    return sampleSave({ settings: { notifications: true, autoBattle: true, teamMode: true }, monsters: Object.fromEntries(ms.map((m) => [m.uid, m])), party: ms.map((m) => m.uid), ...o });
  };

  it('트레이너 3:3 중에 숨김 (접기) → 확장이 이어 계산 · 저장 → 껐다 켜도 같은 3:3 (그 트레이너를 처음부터)', async () => {
    setOn(true);
    try {
      const start = await enterAndStart(three());
      const meet = { ...start.state, save: { ...start.state.save, pendingEncounter: { kind: 'trainer' as const, trainerId: 'forest-1:t0', stageId: 'forest-1' as const } }, runtime: { ...start.state.runtime, stage: { phase: 'trainer' as const, n: 0, ms: TIMING.trainerMeetMs - 50 }, stageId: 'forest-1' as const } };
      session.handleMessage(msg({ type: 'hidden', epoch: start.epoch, state: meet, collapsed: true }));
      runHost(3000);
      expect(snap().state?.runtime.stage?.phase).toBe('team');
      runHost(6000);
      const saved = stored();
      expect(saved?.pendingEncounter).toMatchObject({ kind: 'trainer', trainerId: 'forest-1:t0' });
      // 껐다 켬 (진행 중 상태 없음) — 세이브로 다시 시작하면 그 트레이너와 3:3 (마지막으로 고른 방식)
      const checked = validateSave(saved);
      expect(checked.ok).toBe(true);
      if (!checked.ok) return;
      const fresh = createGameState(checked.save, 3);
      const again = { ...fresh, runtime: { ...readRuntime({}, 3), stage: null, stageId: 'forest-1' as const } };
      expect(checked.save.settings.teamMode).toBe(true);
      expect(again.save.pendingEncounter?.kind).toBe('trainer');
    } finally {
      setOn(false);
    }
  });

  it('3:3 에서 진 판 기록 (teamLost) · 3:3 방식 (teamMode) 은 저장 · 다시 읽기를 지나도 그대로 · 옛 세이브 (칸 없음) 는 1:1 · 빈 목록', () => {
    const base = three();
    const lost = { ...base, stages: { 'forest-1': { seed: 42, progress: 0.4, cleared: false, defeatedTrainers: [], facilities: [], run: { startMs: 0, caught: 0, trainers: 0, seen: [], reach: 0, retries: 0, teamLost: ['forest-1:t0'] } } } };
    const r = validateSave(JSON.parse(JSON.stringify(lost)));
    expect(r.ok && r.save.stages['forest-1']!.run.teamLost).toEqual(['forest-1:t0']);
    expect(r.ok && r.save.settings.teamMode).toBe(true);
    const old = JSON.parse(JSON.stringify(sampleSave())) as Record<string, unknown>;
    const o = validateSave(old);
    expect(o.ok && o.save.settings.teamMode).toBeFalsy();
    expect(o.ok && Object.values(o.save.stages).every((st) => (st.run.teamLost ?? []).length === 0)).toBe(true);
    // 이상한 값은 걸러 냄
    const bad = validateSave({ ...JSON.parse(JSON.stringify(lost)), stages: { 'forest-1': { ...lost.stages['forest-1'], run: { ...lost.stages['forest-1'].run, teamLost: [1, 'forest-1:t0', 'forest-1:t0', ''] } } } });
    expect(bad.ok && bad.save.stages['forest-1']!.run.teamLost).toEqual(['forest-1:t0']);
  });
});

describe('단계 5 · 6 — 전투 · 안 볼 때 알림 (확장 쪽, U9)', () => {
  const shinySave = (notifications: boolean) => {
    const { seed, spot } = shinyWildSeed();
    return sampleSave({
      settings: { notifications, autoBattle: true },
      stages: { 'forest-1': { seed, progress: spot.at - 0.0005, cleared: false, defeatedTrainers: [], facilities: [], run: { startMs: 0, caught: 0, trainers: 0, seen: [], reach: 0, retries: 0 } } },
    });
  };

  it('안 볼 때 (자동 전투) 이로치 흔적 바로 앞에서 멈추고 VS Code 알림 한 번 — 계산도 멈춤', async () => {
    await enterAndStart(shinySave(true));
    session.onVisibilityChanged(false);
    runHost(3000);
    expect(snap().state?.runtime.stage?.phase).toBe('hold');
    runHost(TIMING.noticeAfterHiddenMs);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toContain('반짝');
    expect(snap().running).toBe(false);
    runHost(5000);
    expect(notices).toHaveLength(1);
  });

  it('설정에서 알림을 끄면 멈추기만 하고 알림은 없음', async () => {
    await enterAndStart(shinySave(false));
    session.onVisibilityChanged(false);
    runHost(3000);
    expect(snap().state?.runtime.stage?.phase).toBe('hold');
    expect(notices).toHaveLength(0);
  });

  it('안 볼 때 부탁에 와도 알림 없음 — 바로 [도와준다] (2026-10-21 ideas #115)', async () => {
    await enterAndStart(sampleSave({ settings: { notifications: true, autoBattle: true }, stages: { 'forest-1': { seed: 42, progress: nearRequest(), cleared: false, defeatedTrainers: [], facilities: [], run: { startMs: 0, caught: 0, trainers: 0, seen: [], reach: 0, retries: 0 } } } }));
    session.onVisibilityChanged(false);
    runHost(2000);
    expect(notices.some((n) => n.includes('부탁'))).toBe(false);
  });

  it('확장이 들고 있을 때만 "안 볼 때" 표시 — 웹뷰가 다시 맡으면 꺼짐', async () => {
    const start = await enterAndStart(sampleSave({ settings: { notifications: true, autoBattle: true } }));
    expect(start.state.runtime.headless).toBe(false);
    session.onVisibilityChanged(false);
    expect(snap().state?.runtime.headless).toBe(true);
    session.onVisibilityChanged(true);
    session.handleMessage(msg({ type: 'ready' }));
    expect(view.last('start')?.state.runtime.headless).toBe(false);
  });
});

describe('📦 꺼내기 연결 (단계 10)', () => {
  it('웹뷰가 새로 뜨면 (boot) 알림 · 일반 모드에서는 세이브를 파일에서 다시 읽어 줌', async () => {
    let boots = 0;
    const storage = new MemorySaveStorage(sampleSave());
    const store = new SaveStore(storage, new MemorySaveArchive(), { log: () => {} });
    const s = new GameSession({ store, now: () => 1, newSeed: () => 1, log: () => {}, onWebviewBoot: () => boots++ });
    await s.init();
    s.handleMessage({ command: 'game', type: 'boot' });
    expect(boots).toBe(1);
    storage.write({ ...sampleSave(), money: 777 });
    const read = await s.readSaveForTeam();
    expect(read.kind === 'ok' && read.save.money).toBe(777);
    // 읽기만 — 세션이 들고 있는 상태는 그대로 (코드 리뷰어 단계 10: 이름은 읽기인데 상태를 덮던 것)
    expect(s.snapshot.state?.save.money).toBe(sampleSave().money);
    storage.write('{broken');
    expect(await s.readSaveForTeam()).toEqual({ kind: 'broken' });
    expect(store.lockedReason).toBeNull();
  });
});

describe('개발 모드 (임시, gdd 8장 · S02 ④) — 저장하지 않음', () => {
  /** 타이틀 → 개발 모드 → 웹뷰 준비 → start */
  async function enterDev(save?: Save) {
    await setup(save, { lease: true });
    await session.openTitle();
    session.handleMessage(msg({ type: 'title-dev' }));
    await vi.advanceTimersByTimeAsync(0);
    session.handleMessage(msg({ type: 'ready' }));
    const start = view.last('start');
    if (!start) throw new Error('start 가 안 옴');
    return start;
  }

  it('진짜 세이브를 불러와 시작 · 팀 · 돈 · 레벨을 바꾸고 웹뷰 상태 · 바로 저장 · 안 볼 때 계산 · 나가기 · 끄기를 해도 세이브 파일이 그대로', async () => {
    const real = autoSave(5000);
    const start = await enterDev(real);
    expect(session.devMode).toBe(true);
    expect(start.state.runtime.dev).toBeTruthy();
    expect(start.state.save.money).toBe(real.money);
    const before = JSON.stringify(storage.read());
    const writes = storage.writes;
    const lead = start.state.save.party[0]!;
    const changed: GameState = {
      ...start.state,
      save: { ...start.state.save, money: 999_999, monsters: { ...start.state.save.monsters, [lead]: { ...start.state.save.monsters[lead]!, level: 99 } } },
    };
    session.handleMessage(msg({ type: 'state', epoch: start.epoch, state: changed }));
    session.handleMessage(msg({ type: 'save-now', epoch: start.epoch, reason: 'battle-end', state: changed }));
    expect(snap().state?.save.money).toBe(999_999);
    // 패널을 접어도 이어짐 (자동 전투 — 확장이 계산) · 그래도 안 씀
    view.visible = false;
    session.onVisibilityChanged(false);
    runHost(10_000);
    expect(snap().state?.save.money).toBe(999_999);
    vi.advanceTimersByTime(TIMING.autosaveCheckMs * 3);
    await exitNow();
    expect(snap().mode).toBe('normal');
    expect(session.devMode).toBe(false);
    session.dispose();
    expect(storage.writes).toBe(writes);
    expect(JSON.stringify(storage.read())).toBe(before);
    expect(archive.items).toHaveLength(0);
    expect(warns).toEqual([]);
  });

  it('세이브가 없으면 시연 팀 (3마리) · 웹뷰가 개발 값을 지워 보내도 개발 모드 그대로', async () => {
    const start = await enterDev();
    expect(start.state.save.party).toHaveLength(3);
    const { dev: _dev, ...runtime } = start.state.runtime;
    session.handleMessage(msg({ type: 'state', epoch: start.epoch, state: { ...start.state, runtime } }));
    expect(snap().state?.runtime.dev).toBeTruthy();
    expect(storage.read()).toBeUndefined();
  });

  it('개발 모드 끝내기 → 타이틀 (진짜 세이브 요약) · 그다음 이어 하기는 진짜 진행 · 일반 저장은 그대로 됨', async () => {
    const real = autoSave(5000);
    const start = await enterDev(real);
    session.handleMessage(msg({ type: 'state', epoch: start.epoch, state: { ...start.state, save: { ...start.state.save, money: 1 } } }));
    session.handleMessage(msg({ type: 'dev-end' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(snap().mode).toBe('title');
    expect(view.last('title')?.info.summary?.money).toBe(real.money);
    session.handleMessage(msg({ type: 'title-continue' }));
    await vi.advanceTimersByTimeAsync(0);
    session.handleMessage(msg({ type: 'ready' }));
    const again = view.last('start')!;
    expect(again.state.runtime.dev).toBeUndefined();
    expect(again.state.save.money).toBe(real.money);
    // 일반 플레이 — 저장됨
    session.handleMessage(msg({ type: 'save-now', epoch: again.epoch, reason: 'battle-end', state: { ...again.state, save: { ...again.state.save, money: 4321 } } }));
    await vi.advanceTimersByTimeAsync(0);
    expect(stored()?.money).toBe(4321);
  });

  it('개발 모드 중에 VS Code 를 끔 · 🏠 뒤 늦게 온 끝내기 · 새로 하기 — 쓰지 않고 타이틀이 다시 뜨지 않음', async () => {
    const real = autoSave(5000);
    const start = await enterDev(real);
    session.handleMessage(msg({ type: 'state', epoch: start.epoch, state: { ...start.state, save: { ...start.state.save, money: 7 } } }));
    expect(await session.startNewSave(sampleSave())).toBe('busy');
    const exit = session.exitGame();
    session.handleMessage(msg({ type: 'dev-end' }));
    await exitNow(exit);
    await vi.advanceTimersByTimeAsync(0);
    expect(snap().mode).toBe('normal');
    expect(session.dispose()).toBe(true);
    expect(storage.writes).toBe(0);
    expect(archive.items).toHaveLength(0);
  });

  it('웹뷰가 보낸 개발 값으로는 일반 게임이 개발 모드가 되지 않음', async () => {
    const start = await enterAndStart(sampleSave());
    session.handleMessage(msg({ type: 'state', epoch: start.epoch, state: { ...start.state, runtime: { ...start.state.runtime, dev: { team: true, walk: 10, battle: 1, pause: false, foes: [], ults: {} } } } }));
    expect(snap().state?.runtime.dev).toBeUndefined();
    expect(session.devMode).toBe(false);
  });
});

describe('세이브 내보내기 · 가져오기 (orders #33 · U6 S20 ④)', () => {
  const ask = () => view.last('save-import-ask');
  const result = () => view.last('save-result');

  it('내보내고 불러오면 같음 — 확인하면 지금 세이브를 보관함에 두고 덮어씀 · 웹뷰에 새로 맡김', async () => {
    const start = await enterAndStart(sampleSave({ money: 1234 }));
    session.handleMessage(msg({ type: 'save-export' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(savedFiles).toHaveLength(1);
    expect(savedFiles[0]!.name).toMatch(/^pokemon-save-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(savedFiles[0]!.text)).toEqual(viaJson(start.state.save));
    expect(result()).toMatchObject({ ok: true });
    // 다른 세이브를 불러옴
    const other = sampleSave({ money: 777, playTimeMs: 90_000 });
    openFile = { name: 'friend.json', text: JSON.stringify(other) };
    session.handleMessage(msg({ type: 'save-import' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(ask()).toMatchObject({ name: 'friend.json', summary: { money: 777, playTimeMs: 90_000 } });
    expect(stored()?.money).not.toBe(777);
    const epoch = snap().epoch;
    session.handleMessage(msg({ type: 'save-import-confirm' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(stored()?.money).toBe(777);
    expect(archive.items.some((i) => i.reason === 'replaced' && i.note === '불러오기 전 세이브')).toBe(true);
    expect(snap().epoch).toBeGreaterThan(epoch);
    expect(view.last('start')?.state.save.money).toBe(777);
    expect(result()).toMatchObject({ ok: true });
  });

  it('그만두기 · 취소 · 망가진 파일 · 더 새 판 · 옛 1판 (옮김)', async () => {
    await enterAndStart(sampleSave({ money: 1234 }));
    // 열기 창 취소 = 아무것도 안 보냄
    session.handleMessage(msg({ type: 'save-import' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(ask()).toBeUndefined();
    // 망가진 파일
    openFile = { name: 'bad.json', text: '{ not json' };
    session.handleMessage(msg({ type: 'save-import' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(ask()?.error).toContain('망가진');
    // 더 새 판
    openFile = { name: 'future.json', text: JSON.stringify({ ...sampleSave(), version: 99 }) };
    session.handleMessage(msg({ type: 'save-import' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(ask()?.error).toContain('더 새');
    // 옛 1판 표본 — 옮겨서 읽음
    const v1 = (await import('../../test/fixtures/save-v1.json')).default;
    openFile = { name: 'old.json', text: JSON.stringify(v1) };
    session.handleMessage(msg({ type: 'save-import' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(ask()?.summary).toBeTruthy();
    // 그만두기 — 덮지 않음
    session.handleMessage(msg({ type: 'save-import-cancel' }));
    session.handleMessage(msg({ type: 'save-import-confirm' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(stored()?.money ?? 1234).toBe(1234);
  });

  it('개발 모드는 둘 다 막음 (저장 안 됨 모드)', async () => {
    await setup(sampleSave());
    await session.openTitle();
    session.handleMessage(msg({ type: 'ready' }));
    session.handleMessage(msg({ type: 'title-dev' }));
    await vi.advanceTimersByTimeAsync(0);
    session.handleMessage(msg({ type: 'save-export' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(savedFiles).toHaveLength(0);
    expect(result()).toMatchObject({ ok: false });
    openFile = { name: 'x.json', text: JSON.stringify(sampleSave()) };
    session.handleMessage(msg({ type: 'save-import' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(ask()?.error).toContain('개발 모드');
  });
});

describe('세이브 불러오기 — 코드 리뷰어 #48 (지난 상자 · 이상한 파일 · 고친 곳 · 쓰기 실패)', () => {
  const ask = () => view.last('save-import-ask');
  const result = () => view.last('save-result');
  const other = sampleSave({ money: 777, playTimeMs: 90_000 });

  it('묻고 나서 게임을 나갔다 다시 들어와 confirm 해도 덮지 않음 · 열기 창 동안 나가면 묻지 않음', async () => {
    await enterAndStart(sampleSave({ money: 1234 }));
    openFile = { name: 'friend.json', text: JSON.stringify(other) };
    session.handleMessage(msg({ type: 'save-import' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(ask()?.summary).toBeTruthy();
    await exitNow();
    expect(await session.enterGame()).toBe('entered');
    session.handleMessage(msg({ type: 'ready' }));
    session.handleMessage(msg({ type: 'save-import-confirm' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(stored()?.money).toBe(1234);
    expect(archive.items.some((i) => i.note === '불러오기 전 세이브')).toBe(false);
    // 열기 창이 떠 있는 동안 나가면 — 닫힌 뒤 묻지 않음
    let open!: () => void;
    openGate = new Promise<void>((r) => (open = r));
    const asks = view.count('save-import-ask');
    session.handleMessage(msg({ type: 'save-import' }));
    await exitNow();
    open();
    await vi.advanceTimersByTimeAsync(0);
    expect(view.count('save-import-ask')).toBe(asks);
  });

  it('메모장 BOM · 보관함 파일 ({ at, reason, note, raw }) 은 읽음 · 너무 큰 파일 · 게임 밖은 까닭', async () => {
    await enterAndStart(sampleSave({ money: 1234 }));
    openFile = { name: 'bom.json', text: '\uFEFF' + JSON.stringify(other) };
    session.handleMessage(msg({ type: 'save-import' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(ask()?.summary?.money).toBe(777);
    openFile = { name: 'backup.json', text: JSON.stringify({ at: 1, reason: 'replaced', note: '불러오기 전 세이브', raw: other }) };
    session.handleMessage(msg({ type: 'save-import' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(ask()?.summary?.money).toBe(777);
    openFile = { name: 'huge.json', text: '', tooBig: 12_000_000 };
    session.handleMessage(msg({ type: 'save-import' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(ask()?.error).toContain('너무 커요');
    await exitNow();
    session.handleMessage(msg({ type: 'save-import' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(ask()?.error).toContain('게임 중에만');
  });

  it('읽으며 고친 곳 · 빠진 포켓몬을 확인 상자에 (말없이 빠지던 것) · 불러온 뒤 기록에도', async () => {
    await enterAndStart(sampleSave({ money: 1234 }));
    const ghost = { ...other.monsters.m1!, uid: 'm9', species: 99999 };
    openFile = { name: 'newer-build.json', text: JSON.stringify({ ...other, monsters: { ...other.monsters, m9: ghost }, box: ['m9'] }) };
    session.handleMessage(msg({ type: 'save-import' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(ask()).toMatchObject({ lost: 1 });
    expect(ask()?.fixes).toBeGreaterThan(0);
    session.handleMessage(msg({ type: 'save-import-confirm' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(stored()?.money).toBe(777);
    expect(result()).toMatchObject({ ok: true });
  });

  it('쓰기에 실패하면 불러올 세이브를 남기지 않음 — 나중에 몰래 써지지 않고 지금 진행이 써짐', async () => {
    await enterAndStart(sampleSave({ money: 1234 }));
    openFile = { name: 'friend.json', text: JSON.stringify(other) };
    session.handleMessage(msg({ type: 'save-import' }));
    await vi.advanceTimersByTimeAsync(0);
    storage.failNext = 1;
    session.handleMessage(msg({ type: 'save-import-confirm' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(result()).toMatchObject({ ok: false });
    await vi.advanceTimersByTimeAsync(6000);
    expect(stored()?.money ?? 1234).toBe(1234);
    expect(stored()?.money).not.toBe(777);
  });
});

describe('세이브 불러오기 — 테스터 #48 (빈 세이브 · 나간 뒤 결과 · 내보내기 크기)', () => {
  const ask = () => view.last('save-import-ask');

  it('팀에 포켓몬이 없는 세이브는 불러오지 않음 (불러온 뒤 아무 일도 안 일어나던 것)', async () => {
    await enterAndStart(sampleSave({ money: 1234 }));
    openFile = { name: 'empty.json', text: JSON.stringify({ version: 3, monsters: {} }) };
    session.handleMessage(msg({ type: 'save-import' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(ask()?.error).toContain('포켓몬이 없는');
    session.handleMessage(msg({ type: 'save-import-confirm' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(stored()?.money ?? 1234).toBe(1234);
  });

  it('내보내기는 들여쓰기 없이 (큰 세이브도 5 MB 안에) · 저장 창 동안 나가면 결과를 다음 게임에 안 보냄', async () => {
    await enterAndStart(sampleSave({ money: 1234 }));
    session.handleMessage(msg({ type: 'save-export' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(savedFiles[0]!.text).not.toContain('\n');
    expect(JSON.parse(savedFiles[0]!.text).money).toBe(1234);
    const results = view.count('save-result');
    let open!: () => void;
    openGate = new Promise<void>((r) => (open = r));
    session.handleMessage(msg({ type: 'save-import' }));
    await exitNow();
    open();
    await vi.advanceTimersByTimeAsync(0);
    expect(view.count('save-result')).toBe(results);
  });
});

describe('세이브 불러오기 — 아직 안 열린 지역 (코드 리뷰어 #52)', () => {
  it('해변 스테이지 · 위치 · 배지가 든 세이브는 받지 않음 (#30 전까지)', async () => {
    await enterAndStart(sampleSave({ money: 1234 }));
    const base = sampleSave({ money: 777 });
    for (const bad of [
      { ...base, location: { screen: 'stage', stageId: 'beach-1' }, stages: { ...base.stages, 'beach-1': base.stages['forest-1'] } },
      { ...base, location: { screen: 'gym', region: 'beach' } },
      { ...base, badges: ['forest', 'beach'] },
    ]) {
      openFile = { name: 'beach.json', text: JSON.stringify(bad) };
      session.handleMessage(msg({ type: 'save-import' }));
      await vi.advanceTimersByTimeAsync(0);
      expect(view.last('save-import-ask')?.error).toContain('열리지 않은 지역');
    }
  });
});
