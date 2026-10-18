/**
 * 게임 세션 (확장 쪽) — 게임 상태를 갖고 저장하며, 지금 누가 계산하는지(웹뷰 · 확장)를 정한다 (mvp-spec 9장).
 *
 * - 패널이 보이면 웹뷰가 계산 · 그리기를 맡고, 1초마다(바뀌었을 때) 상태를 보내 줌 → 여기서 저장
 * - 패널이 안 보이면 (접음 · 다른 탭) 웹뷰는 버려질 수 있어서 여기가 넘겨받음.
 *   자동 전투가 켜져 있으면 같은 계산을 그림 없이 이어 돌리고, 꺼져 있으면 멈춰 둠
 * - VS Code 밖 (창이 포커스를 잃음) + 자동 전투 꺼짐 → 웹뷰를 멈추고(suspend) 여기가 넘겨받아 멈춰 둠
 * - 다시 보이면 웹뷰가 새로 떠서 상태를 달라고 함 → 여기 상태를 넘겨줌
 * - 게임 모드는 창 잠금을 쥔 창 하나만, 세이브도 그 창만 씀
 *
 * VS Code 를 모른다 (웹뷰는 ViewPort, 저장은 SaveStore, 창 잠금은 WindowLease 로만 만남) → 자동 테스트에서 그대로 돌림.
 */
import { TIMING } from '../core/balance';
import { advance, createGameState, isWaitingForInput, readRuntime, shouldRunWhenHidden, withSpeed, type GameNotice, type GameState } from '../core/engine';
import { validateSave, type Save } from '../core/save';
import { GAME_COMMAND, isWebviewToHost, type HostToWebview, type TitleInfo, type TitleNotice } from '../shared/messages';
import { HeadlessRunner, type HeadlessRunnerOptions } from './headless-runner';
import type { LoadResult, SaveStore } from './save-store';
import type { WindowLease } from './window-lease';

/** 웹뷰 쪽 문 — VS Code 의 WebviewView 를 감싼 것 (view-port.ts) */
export interface ViewPort {
  post(message: HostToWebview): void;
  readonly visible: boolean;
}

/** normal = 일반 모드 · title = 타이틀 (S02, 게임은 아직 안 돎) · game = 게임 중 */
export type Mode = 'normal' | 'title' | 'game';
export type Owner = 'none' | 'webview' | 'host';
/** 게임 모드에 들어가기 결과 — no-save · locked · busy · failed (잠금 파일을 못 씀) 는 타이틀(S02)에서 안내 */
export type EnterResult = 'entered' | 'already' | 'no-save' | 'locked' | 'busy' | 'failed';

export interface SessionDeps {
  store: SaveStore;
  /** 없으면 창 잠금을 하지 않음 (테스트) */
  lease?: WindowLease;
  now(): number;
  newSeed(): number;
  log(message: string): void;
  /** 사용자에게 보이는 경고 (VS Code 알림) — 없으면 기록만 */
  warn?(message: string): void;
  /** 안 볼 때 직접 해야 하는 순간 알림 (U9 — VS Code 알림, 세이브 설정 notifications 가 켜져 있을 때만) */
  notify?(message: string): void;
  runner?: HeadlessRunnerOptions;
  /** 모드가 바뀜 — 제목줄 버튼 (🎮 ↔ 🏠 · ＋ 🔀 🗑 숨기기) */
  onModeChanged?(mode: Mode): void;
}

/** 세는 것 — 기록 · 테스트용 */
export interface SessionStats {
  boots: number;
  titles: number;
  accepted: number;
  stale: number;
  rejected: number;
  headlessSteps: number;
}

/** command 를 뺀 보낼 메시지 (post 가 채움) — 종류마다 따로 Omit */
type Outgoing = HostToWebview extends infer M ? (M extends unknown ? Omit<M, 'command'> : never) : never;

export class GameSession {
  private mode: Mode = 'normal';
  private owner: Owner = 'none';
  private epoch = 0;
  private state: GameState | null = null;
  private view: ViewPort | null = null;
  private windowFocused = true;
  /** suspend 를 보내고 웹뷰의 hidden 을 기다리는 중 */
  private suspendRequested = false;
  /** 웹뷰에 game.js 가 떠 있어 맡길 수 있는지 (ready 에서 켜고, 새로 뜸 · 못 불러옴 · 닫힘에서 끔) */
  private webviewReady = false;
  private loadResult: LoadResult = { kind: 'none' };
  /** 확장이 넘겨받기 바로 전 epoch — 그 epoch 의 늦은 메시지는 다시 맡기기 전까지 받아 줌 */
  private handoverEpoch: number | null = null;
  /** 세이브를 읽는 중 — 다 읽기 전에 게임 모드로 들어가지 않게 */
  private loading: Promise<LoadResult> = Promise.resolve({ kind: 'none' });
  /** 들어가기 · 나가기 · 새로 하기를 한 줄로 세움 (겹치면 잠금 · 저장이 꼬임) */
  private transitions: Promise<unknown> = Promise.resolve();
  /** 나가는 중 웹뷰의 마지막 상태(hidden)를 기다림 — 오면 부름 */
  private finalWait: (() => void) | null = null;
  /** 타이틀에서 다른 창이 게임을 끝냈는지 지켜봄 */
  private busyWatch: ReturnType<typeof setInterval> | null = null;
  private readonly runner: HeadlessRunner;
  readonly stats: SessionStats = { boots: 0, titles: 0, accepted: 0, stale: 0, rejected: 0, headlessSteps: 0 };

  constructor(private readonly deps: SessionDeps) {
    this.runner = new HeadlessRunner((ms) => this.onHeadless(ms), deps.runner);
  }

  /** 세이브를 읽어 둠. 켤 때는 readOnly (읽기만), 게임 모드에 들어갈 때 다시 읽으며 보관 · 고치기. 던지지 않음 */
  init(options: { readOnly?: boolean } = { readOnly: true }): Promise<LoadResult> {
    this.loading = this.deps.store
      .load(options)
      .catch((e: unknown): LoadResult => ({ kind: 'broken', reason: `세이브 읽기 실패: ${String(e)}` }))
      .then((r) => {
        this.loadResult = r;
        this.state = r.kind === 'ok' ? createGameState(r.save, this.deps.newSeed()) : null;
        return r;
      });
    return this.loading;
  }

  /** 지금 모습 (읽기만) — 기록 · 테스트용 */
  get snapshot(): { mode: Mode; owner: Owner; epoch: number; state: GameState | null; load: LoadResult['kind']; running: boolean } {
    return { mode: this.mode, owner: this.owner, epoch: this.epoch, state: this.state, load: this.loadResult.kind, running: this.runner.running };
  }

  attachView(view: ViewPort): void {
    this.view = view;
  }

  /** 보기가 아주 닫힘 (사용자가 보기를 숨김) */
  detachView(): void {
    this.takeOver('보기가 닫힘');
    this.view = null;
    this.webviewReady = false;
  }

  handleMessage(message: unknown): void {
    if (!isWebviewToHost(message)) return;
    switch (message.type) {
      case 'boot':
        this.stats.boots++;
        this.webviewReady = false; // 웹뷰가 새로 뜸 — game.js 는 아직
        if (this.mode !== 'normal') this.post({ type: 'load' });
        return;
      case 'ready':
        this.webviewReady = true;
        if (this.mode === 'title') {
          void this.sendTitle();
          return;
        }
        if (this.mode !== 'game') return;
        // 아주 빨리 접어서 안 보이는 채로 준비됐으면 맡기지 않고 여기서 들고 있음
        if (this.view && !this.view.visible) this.hostOwns('패널이 안 보이는 채로 웹뷰가 준비됨');
        else this.handToWebview();
        return;
      case 'state':
        this.accept(message.epoch, message.state);
        return;
      case 'save-now':
        if (this.accept(message.epoch, message.state) && this.state) void this.deps.store.saveNow(this.state.save);
        return;
      case 'hidden': {
        // 🎮 · 🏠 로 나가는 중에 달라고 한 마지막 상태 — 받기만 하고 나가기를 이어 감
        if (this.finalWait && this.owner === 'webview' && message.epoch === this.epoch) {
          this.accept(message.epoch, message.state);
          this.finalWait();
          return;
        }
        const relevant =
          (this.owner === 'webview' && message.epoch === this.epoch) || (this.owner === 'host' && message.epoch === this.handoverEpoch);
        if (!relevant) {
          this.stats.stale++;
          return;
        }
        const suspended = this.suspendRequested;
        this.suspendRequested = false;
        this.accept(message.epoch, message.state);
        this.takeOver('웹뷰가 멈춤');
        this.handoverEpoch = null; // hidden 이 마지막 — 같은 epoch 의 메시지는 더 받지 않음
        // suspend 로 멈췄는데 그 사이 포커스가 돌아왔으면 보이는 웹뷰에 다시 맡김.
        // 다른 까닭의 hidden 은 웹뷰가 다시 보일 때 ready 로 옴
        if (suspended && this.webviewReady && this.mode === 'game' && this.state && this.view?.visible && this.windowFocused) {
          this.handToWebview();
        }
        return;
      }
      case 'load-failed':
        this.webviewReady = false;
        this.deps.log(`웹뷰가 게임 화면을 불러오지 못함: ${message.message}`);
        if (this.mode === 'title') {
          // 타이틀이 안 뜨면 🎮 가 아무 반응 없는 것처럼 보임 — 알리고 일반 모드로 (다음 🎮 에서 다시 시도)
          this.setMode('normal');
          this.post({ type: 'stop' }); // 화면 오류로 온 것이면 웹뷰도 일반 모드로
          this.warn('포켓몬 게임 화면을 불러오지 못했어요 — 창을 다시 로드해 보세요 (Developer: Reload Window).');
        } else if (this.mode === 'game') {
          this.warn('포켓몬 게임 화면에 문제가 생겼어요 — 제목줄 🏠 로 일반 모드로 나갈 수 있어요 (진행은 저장돼요).');
          // 아무도 계산하지 않는 채로 두지 않음 — 자동 전투면 여기서 이어 감
          if (this.owner !== 'host') this.hostOwns('웹뷰가 게임을 못 불러옴');
        }
        return;
      case 'title-new':
        if (this.mode === 'title') void this.newFromTitle(message.save);
        return;
      case 'title-continue':
        if (this.mode === 'title') void this.continueFromTitle();
        return;
      case 'exit':
        // 게임 중이면 웹뷰가 들고 있던 마지막 상태를 받고 나감 (S02 ③ · S06 ⑪ — 모드 전환은 바로 저장)
        if (this.mode === 'game' && message.epoch !== null && message.state) this.accept(message.epoch, message.state);
        if (this.mode !== 'normal') void this.serial(() => this.leaveGame({ askWebview: false }));
        // 이미 일반 모드인데 웹뷰는 게임 화면이라고 여김 (stop 을 놓침 등) — 다시 알려 줌
        else this.post({ type: 'stop' });
        return;
    }
  }

  onVisibilityChanged(visible: boolean): void {
    // 다시 보이면 웹뷰가 새로 떠서 boot → ready 로 상태를 달라고 하므로 여기서는 숨을 때만
    if (visible) return;
    this.takeOver('패널이 안 보임');
    // 게임에 들어갔는데 웹뷰가 준비(ready)되기 전에 접음 — 아무도 계산하지 않게 두지 않음
    if (this.mode === 'game' && this.owner === 'none') this.hostOwns('웹뷰가 준비되기 전에 패널이 안 보임');
  }

  get currentMode(): Mode {
    return this.mode;
  }

  /** VS Code 창 포커스 (mvp-spec 3.3 "VS Code 밖") — 밖에 있는 동안은 확장이 맡음 (자동 전투면 계산 · 아니면 멈춤) */
  onWindowFocusChanged(focused: boolean): void {
    this.windowFocused = focused;
    if (focused && this.mode === 'game' && this.owner === 'host' && this.webviewReady && this.view?.visible) this.handToWebview();
    else this.maybeSuspend();
  }

  /** 🎮 — 일반 모드면 타이틀(S02)을 열고, 타이틀 · 게임 중이면 일반 모드로 */
  toggleGame(): Promise<void> {
    // 줄에 선 뒤에 정함 — 빠르게 두 번 누르면 열고 닫음 (누른 순간의 모드로 정하면 둘 다 "열기")
    return this.serial(async () => {
      await this.loading;
      if (this.mode === 'normal') this.beginTitle();
      else await this.leaveGame({ askWebview: true });
    });
  }

  /** 타이틀(S02)을 엶 — 웹뷰가 game.js 를 불러와 준비되면 세이브 요약을 보냄 */
  openTitle(): Promise<void> {
    return this.serial(async () => {
      await this.loading;
      if (this.mode === 'normal') this.beginTitle();
    });
  }

  private beginTitle(): void {
    this.setMode('title');
    this.deps.log('타이틀로');
    // 웹뷰에 아직 game.js 가 없으면 boot.js 가 불러오고, 이미 있으면 game.js 가 ready 로 답함
    this.post({ type: 'load' });
  }

  /** 게임 모드로 (S02 이어 하기 · 새로 하기 뒤) — 창 잠금을 쥐고, 다른 창에서 하던 진행을 덮지 않게 세이브를 다시 읽고 들어감 */
  enterGame(): Promise<EnterResult> {
    return this.serial(() => this.doEnter());
  }

  /** 일반 모드로 — 마지막 상태를 바로 저장하고 창 잠금을 놓음. 웹뷰가 맡고 있으면 마지막 상태를 받아서 */
  exitGame(): Promise<void> {
    return this.serial(() => this.leaveGame({ askWebview: true }));
  }

  /** 새로 하기 (S02 ①) — 지금 세이브는 보관함에 두고 이 세이브로. 다른 창이 게임 중이면 'busy', 못 쓰면 'failed' */
  startNewSave(save: Save): Promise<'done' | 'busy' | 'failed'> {
    return this.serial(() => this.doReplace(save, { keepLease: false }));
  }

  /**
   * 확장 쪽에서 세이브를 바꿈 (예: 확장 명령으로 바꾸는 설정) — 게임 모드에서만.
   * 웹뷰가 계산을 맡고 있으면 바뀐 상태로 다시 맡겨서, 웹뷰가 옛 상태로 덮어쓰지 않게
   */
  changeSave(change: (save: Save) => Save): boolean {
    if (this.mode !== 'game' || !this.state) return false;
    this.state = { ...this.state, save: change(this.state.save) };
    this.deps.store.set(this.state.save);
    if (this.owner === 'webview') this.handToWebview();
    else this.updateRunner();
    return true;
  }

  /** 시간 배속 (개발 창 빨리 감기 · 테스트) — 게임 중에만. 웹뷰가 맡고 있으면 바뀐 상태로 다시 맡김 */
  setSpeed(speed: number): boolean {
    if (this.mode !== 'game' || !this.state) return false;
    this.state = withSpeed(this.state, speed);
    if (this.owner === 'webview') this.handToWebview();
    else this.updateRunner();
    return true;
  }

  /** 저장소가 잠김 (다른 창이 씀 · 창 잠금을 잃음 등) — 게임 중이면 멈추고 일반 모드로 (잠겨 있어 쓰지 않음) */
  onStoreLocked(reason: string): void {
    this.deps.log(`세이브가 잠김: ${reason}`);
    // 타이틀은 읽을 때마다 잠길 수 있어서 (더 새 버전 세이브) 여기서 다시 보내지 않음 — 요약에 이미 save: 'newer' 로 감
    if (this.mode !== 'game') return;
    this.warn(`포켓몬 게임을 멈췄어요 — ${reason}. 세이브는 덮어쓰지 않았어요.`);
    // 잠겨서 어차피 쓰지 않으니 웹뷰의 마지막 상태를 기다리지 않음
    void this.serial(() => this.leaveGame({ askWebview: false }));
  }

  /** 확장이 꺼질 때 (동기 — VS Code 가 꺼지는 중에도 끝남) — 마지막 저장을 했으면 true */
  dispose(): boolean {
    this.stopBusyWatch();
    this.finalWait?.();
    this.runner.stop();
    if (this.state && this.mode === 'game') this.deps.store.set(this.state.save);
    const ok = this.deps.store.dispose();
    this.deps.lease?.release();
    return ok;
  }

  /** 타이틀에 세이브 요약을 보냄 (줄에 섬) */
  private sendTitle(notice?: TitleNotice): Promise<void> {
    return this.serial(() => this.postTitle(notice));
  }

  /** 세이브 요약 — 다른 창이 바꿨을 수 있어 파일에서 다시 읽음 (읽기만). 다른 창이 게임 중이면 끝날 때까지 지켜봄 */
  private async postTitle(notice?: TitleNotice): Promise<void> {
    if (this.mode !== 'title') return;
    const r = await this.init({ readOnly: true });
    const save = r.kind === 'ok' ? r.save : null;
    const leadUid = save?.party[0];
    const lead = leadUid ? save?.monsters[leadUid] : undefined;
    const info: TitleInfo = {
      save: r.kind,
      busy: this.otherWindowPlaying(),
      summary: save
        ? { playTimeMs: save.playTimeMs, money: save.money, badges: [...save.badges], lead: lead ? { form: lead.form, species: lead.species, level: lead.level } : null }
        : null,
    };
    if (notice) info.notice = notice;
    this.stats.titles++;
    this.post({ type: 'title', info });
    this.watchBusy(info.busy);
  }

  /** S02 새로 하기 — 웹뷰가 만든 새 세이브를 검사하고 지금 세이브는 보관함에, 그리고 게임으로. 한 줄에서 끝까지 (중간에 🎮 가 끼지 않게) */
  private newFromTitle(raw: Save): Promise<void> {
    return this.serial(async () => {
      if (this.mode !== 'title') return;
      const checked = validateSave(raw);
      if (!checked.ok) {
        this.deps.log(`새로 하기 세이브를 버림: ${checked.reason}`);
        await this.postTitle('bad-save');
        return;
      }
      // 창 잠금은 바꾸기부터 들어가기까지 쥔 채로 (그 틈에 다른 창이 가져가지 않게)
      const r = await this.doReplace(checked.save, { keepLease: true });
      if (r !== 'done') {
        await this.postTitle(r === 'busy' ? 'busy' : 'write-failed');
        return;
      }
      await this.enterFromTitle();
    });
  }

  /** S02 이어 하기 */
  private continueFromTitle(): Promise<void> {
    return this.serial(async () => {
      if (this.mode === 'title') await this.enterFromTitle();
    });
  }

  private async enterFromTitle(): Promise<void> {
    const r = await this.doEnter();
    if (r === 'entered' || r === 'already') return;
    const why: Record<Exclude<EnterResult, 'entered' | 'already'>, TitleNotice> = { 'no-save': 'no-save', locked: 'locked', busy: 'busy', failed: 'write-failed' };
    await this.postTitle(why[r]);
  }

  /** 줄을 서지 않는 들어가기 — serial 안에서만 부름 */
  private async doEnter(): Promise<EnterResult> {
    await this.loading;
    if (this.mode === 'game') return 'already';
    const lease = this.tryAcquire();
    if (lease !== 'ok') return lease;
    await this.init({ readOnly: false });
    let result: EnterResult = 'entered';
    if (this.deps.store.lockedReason) result = 'locked';
    else if (!this.state) result = 'no-save';
    if (result !== 'entered') {
      this.deps.lease?.release();
      this.deps.log(`게임 모드에 들어가지 않음: ${result}${this.deps.store.lockedReason ? ` (${this.deps.store.lockedReason})` : ''}`);
      return result;
    }
    this.setMode('game');
    this.deps.store.setWritable(true);
    this.deps.log('게임 모드로');
    // 웹뷰에 아직 game.js 가 없으면 boot.js 가 불러오고, 이미 있으면 game.js 가 ready 로 답함
    this.post({ type: 'load' });
    return result;
  }

  /** 줄을 서지 않는 새로 하기 — serial 안에서만 부름. keepLease: 게임에 바로 들어갈 거라 창 잠금을 쥔 채로 둠 */
  private async doReplace(save: Save, options: { keepLease: boolean }): Promise<'done' | 'busy' | 'failed'> {
    await this.loading;
    const temporary = this.mode !== 'game';
    if (temporary) {
      const lease = this.tryAcquire();
      if (lease !== 'ok') return lease;
    } else if (this.deps.lease && !this.deps.lease.held) return 'busy';
    if (temporary) this.deps.store.setWritable(true);
    let ok = false;
    try {
      ok = await this.deps.store.replace(save);
    } catch (e) {
      this.deps.log(`새로 하기 실패: ${String(e)}`);
    } finally {
      if (temporary) {
        this.deps.store.setWritable(false);
        if (!ok || !options.keepLease) this.deps.lease?.release();
      }
    }
    if (!ok) return 'failed';
    this.state = createGameState(save, this.deps.newSeed());
    this.loadResult = { kind: 'ok', save, problems: [], migratedFrom: null };
    // 게임 중이면 웹뷰가 옛 진행을 보내 새 세이브를 덮지 않게 새 epoch 으로
    if (!temporary) {
      if (this.owner === 'webview') this.handToWebview();
      else this.hostOwns('새로 하기');
    }
    return 'done';
  }

  /** 창 잠금 — 잠금 파일을 못 만들면 (디스크 가득 등) 던지지 않고 'failed' */
  private tryAcquire(): 'ok' | 'busy' | 'failed' {
    if (!this.deps.lease) return 'ok';
    try {
      return this.deps.lease.acquire() ? 'ok' : 'busy';
    } catch (e) {
      this.deps.log(`창 잠금 파일을 쓰지 못함: ${String(e)}`);
      return 'failed';
    }
  }

  private otherWindowPlaying(): boolean {
    try {
      return this.deps.lease?.heldByOther() ?? false;
    } catch {
      return false;
    }
  }

  /** 타이틀에서 다른 창이 게임 중 — 그 창이 끝나면 요약을 다시 보내 버튼을 살림 */
  private watchBusy(busy: boolean): void {
    this.stopBusyWatch();
    if (!busy) return;
    this.busyWatch = setInterval(() => {
      if (this.mode !== 'title') this.stopBusyWatch();
      else if (!this.otherWindowPlaying()) {
        this.stopBusyWatch();
        void this.sendTitle();
      }
    }, TIMING.titleBusyPollMs);
  }

  private stopBusyWatch(): void {
    if (this.busyWatch) clearInterval(this.busyWatch);
    this.busyWatch = null;
  }

  private setMode(mode: Mode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    if (mode !== 'title') this.stopBusyWatch();
    try {
      this.deps.onModeChanged?.(mode);
    } catch (e) {
      this.deps.log(`모드 알림 실패: ${String(e)}`);
    }
  }

  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.transitions.then(fn, fn);
    this.transitions = run.catch(() => undefined);
    return run;
  }

  /** 웹뷰가 맡고 있으면 마지막 상태를 달라고 하고 잠깐 기다림 (🎮 · 🏠 로 나갈 때 — 마지막 1초를 잃지 않게) */
  private collectFinalState(): Promise<void> {
    if (this.owner !== 'webview' || !this.webviewReady || !this.view?.visible) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => finish(), TIMING.exitWaitMs);
      const finish = () => {
        clearTimeout(timer);
        this.finalWait = null;
        resolve();
      };
      this.finalWait = finish;
      this.post({ type: 'suspend' });
    });
  }

  /** askWebview: 웹뷰에 마지막 상태를 달라고 함 (exit 메시지로 이미 받았으면 false) */
  private async leaveGame(options: { askWebview: boolean }): Promise<void> {
    if (this.mode === 'title') {
      this.setMode('normal');
      this.post({ type: 'stop' });
      this.deps.log('타이틀에서 일반 모드로');
      return;
    }
    if (this.mode !== 'game') return;
    // 이미 잠겨서 나가는 것이면 (onStoreLocked) 알림은 거기서 했음
    const lockedBefore = this.deps.store.lockedReason !== null;
    if (options.askWebview) await this.collectFinalState();
    this.runner.stop();
    this.setMode('normal');
    this.owner = 'none';
    this.epoch++;
    this.handoverEpoch = null;
    this.suspendRequested = false;
    this.post({ type: 'stop' });
    this.deps.log('일반 모드로');
    if (this.state) await this.finalSave(this.state.save, lockedBefore);
    this.deps.store.setWritable(false);
    this.deps.lease?.release();
  }

  /** 일반 모드로 갈 때 마지막 저장 — 못 쓰면 그 진행을 보관함에 남기고 알림 (다시 읽을 때 잃지 않게) */
  private async finalSave(save: Save, lockedBefore: boolean): Promise<void> {
    if (await this.deps.store.saveNow(save)) return;
    const locked = this.deps.store.lockedReason;
    if (!locked && (await this.deps.store.saveNow(save))) return; // 잠김이 아닌데 못 씀 (디스크 오류 등) — 한 번 더
    const kept = await this.deps.store.keepUnsaved(locked ? `일반 모드로 갈 때 잠겨서 안 씀: ${locked}` : '일반 모드로 갈 때 쓰지 못함');
    const tail = kept ? ' 이 진행은 세이브 백업에 남겨 뒀어요.' : '';
    if (locked && !lockedBefore) this.warn(`포켓몬 게임 마지막 진행은 저장하지 않았어요 — ${locked}.${tail}`);
    else if (!locked) this.warn(`포켓몬 게임 마지막 저장을 하지 못했어요 (디스크를 확인해 주세요).${tail}`);
  }

  private warn(message: string): void {
    this.deps.log(message);
    try {
      this.deps.warn?.(message);
    } catch {
      // 알림이 실패해도 게임 흐름은 그대로
    }
  }

  private post(message: Outgoing): void {
    this.view?.post({ command: GAME_COMMAND, ...message } as HostToWebview);
  }

  private handToWebview(): void {
    if (!this.state) return;
    this.runner.stop();
    this.epoch++;
    this.owner = 'webview';
    this.handoverEpoch = null;
    this.suspendRequested = false;
    this.markHeadless(false);
    this.post({ type: 'start', epoch: this.epoch, state: this.state });
    this.deps.log(`웹뷰가 계산을 맡음 (epoch ${this.epoch})`);
    this.maybeSuspend();
  }

  /**
   * VS Code 밖 (창 포커스 없음) 이면 웹뷰를 멈추고 확장이 넘겨받음 — mvp-spec 3.3: "VS Code 밖" 도 안 볼 때라 그림 없이 계산만
   * (자동 전투면 확장이 이어 계산하고 이로치 흔적 · 부탁 앞에서 멈춤 + 알림 U9, 꺼져 있으면 멈춤)
   */
  private maybeSuspend(): void {
    if (this.mode !== 'game' || this.owner !== 'webview' || this.windowFocused || this.suspendRequested || !this.state) return;
    this.suspendRequested = true;
    this.post({ type: 'suspend' });
  }

  /** 웹뷰가 맡던 것을 넘겨받음 */
  private takeOver(why: string): void {
    if (this.owner !== 'webview') return;
    this.handoverEpoch = this.epoch;
    this.epoch++;
    this.owner = 'host';
    this.markHeadless(true);
    this.updateRunner();
    this.deps.log(`${why} → 확장이 넘겨받음 (epoch ${this.epoch}, ${this.runner.running ? '자동 전투라 계속 계산' : '멈춤'})`);
  }

  /** 웹뷰에 맡기지 않고 여기서 들고 있음 */
  private hostOwns(why: string): void {
    this.epoch++;
    this.owner = 'host';
    this.handoverEpoch = null;
    this.markHeadless(true);
    this.updateRunner();
    this.deps.log(`${why} → 확장이 들고 있음 (epoch ${this.epoch})`);
  }

  /** 확장이 안 볼 때 계산 중인지 게임 상태에 적음 — 이로치 흔적 앞에서 멈추는 데 씀 (U9) */
  private markHeadless(on: boolean): void {
    if (this.state && this.state.runtime.headless !== on) this.state = { ...this.state, runtime: { ...this.state.runtime, headless: on } };
  }

  private notify(notice: GameNotice): void {
    if (!this.state?.save.settings.notifications) return;
    const TEXT: Record<GameNotice, string> = {
      shiny: '✨ 반짝이는 흔적을 찾았어요! 포켓몬 패널을 열면 이어서 걸어요.',
      request: '❓ 길에서 부탁하는 사람이 기다려요. 포켓몬 패널을 열어 골라 주세요.',
      choice: '🧬 진화 · 새 기술을 고를 차례예요. 포켓몬 패널을 열어 골라 주세요.',
      gym: '🏟 체육관 대기실에 도착했어요! 포켓몬 패널을 열어 관장에게 도전해 보세요.',
      clear: '🎉 스테이지를 깼어요! 포켓몬 패널을 열어 다음 스테이지를 골라 주세요.',
      defeat: '😵 포켓몬들이 쓰러졌어요… 포켓몬 패널을 열어 다시 시작해 주세요.',
    };
    const text = TEXT[notice];
    this.deps.log(`알림: ${text}`);
    try {
      this.deps.notify?.(text);
    } catch {
      // 알림이 실패해도 게임 흐름은 그대로
    }
  }

  /** 안 볼 때 계산은 지금 상태의 자동 전투 설정으로 정함 (늦게 온 상태로 바뀌면 다시 정함) */
  private updateRunner(): void {
    // 사람이 골라야 하는 순간 (부탁 · 스테이지 끝) 에는 안 볼 때 계산할 게 없음 — 깨어나 저장만 되풀이하지 않게
    const run = this.state !== null && this.mode === 'game' && this.owner === 'host' && shouldRunWhenHidden(this.state) && !isWaitingForInput(this.state);
    if (run) this.runner.start();
    else this.runner.stop();
  }

  /** 지금 맡긴 epoch 이거나, 넘겨받기 바로 전 epoch 이면 받음 */
  private accept(epoch: number, state: GameState): boolean {
    const current = this.owner === 'webview' && epoch === this.epoch;
    const late = this.owner === 'host' && this.handoverEpoch !== null && epoch === this.handoverEpoch;
    if (!current && !late) {
      this.stats.stale++;
      return false;
    }
    const ok = this.applyFromWebview(state);
    if (ok && late) this.updateRunner();
    if (ok && current) this.maybeSuspend(); // VS Code 밖인데 웹뷰가 맡고 있으면 넘겨받음
    return ok;
  }

  private applyFromWebview(state: GameState): boolean {
    const checked = validateSave(state.save);
    if (!checked.ok) {
      this.stats.rejected++;
      this.deps.log(`웹뷰가 보낸 상태를 버림: ${checked.reason}`);
      return false;
    }
    if (checked.problems.length > 0) this.deps.log(`웹뷰가 보낸 상태를 고침: ${checked.problems.slice(0, 3).join(' / ')}`);
    // 배속은 확장 쪽 값이 기준 (개발 창 빨리 감기 — 웹뷰가 보낸 값은 믿지 않음)
    const speed = this.state?.runtime.speed ?? 1;
    this.state = { save: checked.save, runtime: { ...readRuntime(state.runtime, this.deps.newSeed()), speed, headless: this.owner === 'host' } };
    this.stats.accepted++;
    this.deps.store.set(this.state.save);
    return true;
  }

  private onHeadless(elapsedMs: number): void {
    if (!this.state || this.owner !== 'host' || this.mode !== 'game' || !shouldRunWhenHidden(this.state)) {
      this.runner.stop();
      return;
    }
    let r: ReturnType<typeof advance>;
    try {
      r = advance(this.state, elapsedMs);
    } catch (e) {
      // 같은 오류가 0.25초마다 나지 않게 멈춤 (웹뷰가 다시 맡으면 그쪽에서 이어 감)
      this.runner.stop();
      this.warn(`포켓몬 게임 계산에 오류가 나서 안 보는 동안의 진행을 멈췄어요 (${String(e)}).`);
      return;
    }
    this.state = r.state;
    if (r.steps > 0) {
      this.stats.headlessSteps += r.steps;
      // 전투 끝 등은 바로, 나머지는 5초 안에 (mvp-spec 3.1)
      if (r.saves.length > 0) void this.deps.store.saveNow(this.state.save);
      else this.deps.store.set(this.state.save);
    }
    for (const n of r.notices) this.notify(n);
    if (isWaitingForInput(this.state)) this.runner.stop();
  }
}
