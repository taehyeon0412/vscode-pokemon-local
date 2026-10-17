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
import { advance, createGameState, readRuntime, shouldRunWhenHidden, type GameState } from '../core/engine';
import { validateSave, type Save } from '../core/save';
import { GAME_COMMAND, isWebviewToHost, type HostToWebview } from '../shared/messages';
import { HeadlessRunner, type HeadlessRunnerOptions } from './headless-runner';
import type { LoadResult, SaveStore } from './save-store';
import type { WindowLease } from './window-lease';

/** 웹뷰 쪽 문 — VS Code 의 WebviewView 를 감싼 것 (view-port.ts) */
export interface ViewPort {
  post(message: HostToWebview): void;
  readonly visible: boolean;
}

export type Mode = 'normal' | 'game';
export type Owner = 'none' | 'webview' | 'host';
/** 게임 모드에 들어가기 결과 — no-save · locked · busy 는 단계 3 타이틀(S02)에서 안내 */
export type EnterResult = 'entered' | 'already' | 'no-save' | 'locked' | 'busy';

export interface SessionDeps {
  store: SaveStore;
  /** 없으면 창 잠금을 하지 않음 (테스트) */
  lease?: WindowLease;
  now(): number;
  newSeed(): number;
  log(message: string): void;
  /** 사용자에게 보이는 경고 (VS Code 알림) — 없으면 기록만 */
  warn?(message: string): void;
  runner?: HeadlessRunnerOptions;
}

/** 세는 것 — 기록 · 테스트용 */
export interface SessionStats {
  boots: number;
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
  private readonly runner: HeadlessRunner;
  readonly stats: SessionStats = { boots: 0, accepted: 0, stale: 0, rejected: 0, headlessSteps: 0 };

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
        if (this.mode === 'game') this.post({ type: 'load' });
        return;
      case 'ready':
        this.webviewReady = true;
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
        // suspend 로 멈췄는데 그 사이 포커스가 돌아왔거나 (늦게 온 상태로 보니) 자동 전투면 보이는 웹뷰에 다시 맡김.
        // 다른 까닭의 hidden 은 웹뷰가 다시 보일 때 ready 로 옴
        if (suspended && this.webviewReady && this.mode === 'game' && this.state && this.view?.visible && (this.windowFocused || shouldRunWhenHidden(this.state))) {
          this.handToWebview();
        }
        return;
      }
      case 'load-failed':
        this.webviewReady = false;
        this.deps.log(`웹뷰가 game.js 를 불러오지 못함: ${message.message}`);
        // 아무도 계산하지 않는 채로 두지 않음 — 자동 전투면 여기서 이어 감
        if (this.mode === 'game' && this.owner !== 'host') this.hostOwns('웹뷰가 게임을 못 불러옴');
        return;
    }
  }

  onVisibilityChanged(visible: boolean): void {
    // 다시 보이면 웹뷰가 새로 떠서 boot → ready 로 상태를 달라고 하므로 여기서는 숨을 때만
    if (!visible) this.takeOver('패널이 안 보임');
  }

  /** VS Code 창 포커스 (mvp-spec 3.3 "VS Code 밖") — 자동 전투가 꺼져 있으면 밖에 있는 동안 멈춤 */
  onWindowFocusChanged(focused: boolean): void {
    this.windowFocused = focused;
    if (focused && this.mode === 'game' && this.owner === 'host' && this.webviewReady && this.view?.visible) this.handToWebview();
    else this.maybeSuspend();
  }

  /** 게임 모드로 (🎮) — 창 잠금을 쥐고, 다른 창에서 하던 진행을 덮지 않게 세이브를 다시 읽고 들어감 */
  enterGame(): Promise<EnterResult> {
    return this.serial(async () => {
      await this.loading;
      if (this.mode === 'game') return 'already';
      if (this.deps.lease && !this.deps.lease.acquire()) return 'busy';
      await this.init({ readOnly: false });
      let result: EnterResult = 'entered';
      if (this.deps.store.lockedReason) result = 'locked';
      else if (!this.state) result = 'no-save';
      if (result !== 'entered') {
        this.deps.lease?.release();
        this.deps.log(`게임 모드에 들어가지 않음: ${result}${this.deps.store.lockedReason ? ` (${this.deps.store.lockedReason})` : ''}`);
        return result;
      }
      this.mode = 'game';
      this.deps.store.setWritable(true);
      this.deps.log('게임 모드로');
      // 웹뷰에 아직 game.js 가 없으면 boot.js 가 불러오고, 이미 있으면 game.js 가 ready 로 답함
      this.post({ type: 'load' });
      return result;
    });
  }

  /** 일반 모드로 — 마지막 상태를 바로 저장하고 창 잠금을 놓음 */
  exitGame(): Promise<void> {
    return this.serial(() => this.leaveGame());
  }

  /** 새로 하기 (S02 ①) — 지금 세이브는 보관함에 두고 이 세이브로. 다른 창이 게임 중이면 'busy', 못 쓰면 'failed' */
  startNewSave(save: Save): Promise<'done' | 'busy' | 'failed'> {
    return this.serial(async () => {
      await this.loading;
      const temporary = this.mode !== 'game';
      if (temporary ? this.deps.lease && !this.deps.lease.acquire() : this.deps.lease && !this.deps.lease.held) return 'busy';
      if (temporary) this.deps.store.setWritable(true);
      let ok = false;
      try {
        ok = await this.deps.store.replace(save);
      } catch (e) {
        this.deps.log(`새로 하기 실패: ${String(e)}`);
      } finally {
        if (temporary) {
          this.deps.store.setWritable(false);
          this.deps.lease?.release();
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
    });
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

  /** 저장소가 잠김 (다른 창이 씀 · 창 잠금을 잃음 등) — 게임 중이면 멈추고 일반 모드로 (잠겨 있어 쓰지 않음) */
  onStoreLocked(reason: string): void {
    this.deps.log(`세이브가 잠김: ${reason}`);
    if (this.mode !== 'game') return;
    this.warn(`포켓몬 게임을 멈췄어요 — ${reason}. 세이브는 덮어쓰지 않았어요.`);
    void this.exitGame();
  }

  /** 확장이 꺼질 때 (동기 — VS Code 가 꺼지는 중에도 끝남) — 마지막 저장을 했으면 true */
  dispose(): boolean {
    this.runner.stop();
    if (this.state && this.mode === 'game') this.deps.store.set(this.state.save);
    const ok = this.deps.store.dispose();
    this.deps.lease?.release();
    return ok;
  }

  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.transitions.then(fn, fn);
    this.transitions = run.catch(() => undefined);
    return run;
  }

  private async leaveGame(): Promise<void> {
    if (this.mode !== 'game') return;
    this.runner.stop();
    this.mode = 'normal';
    this.owner = 'none';
    this.epoch++;
    this.handoverEpoch = null;
    this.suspendRequested = false;
    this.post({ type: 'stop' });
    this.deps.log('일반 모드로');
    if (this.state && !(await this.deps.store.saveNow(this.state.save)) && !this.deps.store.lockedReason) {
      // 잠김이 아닌데 못 씀 (디스크 오류 등) — 한 번 더, 그래도 안 되면 알림
      if (!(await this.deps.store.saveNow(this.state.save))) this.warn('포켓몬 게임 마지막 저장을 하지 못했어요 (디스크를 확인해 주세요).');
    }
    this.deps.store.setWritable(false);
    this.deps.lease?.release();
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
    this.post({ type: 'start', epoch: this.epoch, state: this.state });
    this.deps.log(`웹뷰가 계산을 맡음 (epoch ${this.epoch})`);
    this.maybeSuspend();
  }

  /** VS Code 밖인데 자동 전투가 꺼진 채 웹뷰가 맡고 있으면 멈춤 */
  private maybeSuspend(): void {
    if (this.mode !== 'game' || this.owner !== 'webview' || this.windowFocused || this.suspendRequested || !this.state) return;
    if (shouldRunWhenHidden(this.state)) return;
    this.suspendRequested = true;
    this.post({ type: 'suspend' });
  }

  /** 웹뷰가 맡던 것을 넘겨받음 */
  private takeOver(why: string): void {
    if (this.owner !== 'webview') return;
    this.handoverEpoch = this.epoch;
    this.epoch++;
    this.owner = 'host';
    this.updateRunner();
    this.deps.log(`${why} → 확장이 넘겨받음 (epoch ${this.epoch}, ${this.runner.running ? '자동 전투라 계속 계산' : '멈춤'})`);
  }

  /** 웹뷰에 맡기지 않고 여기서 들고 있음 */
  private hostOwns(why: string): void {
    this.epoch++;
    this.owner = 'host';
    this.handoverEpoch = null;
    this.updateRunner();
    this.deps.log(`${why} → 확장이 들고 있음 (epoch ${this.epoch})`);
  }

  /** 안 볼 때 계산은 지금 상태의 자동 전투 설정으로 정함 (늦게 온 상태로 바뀌면 다시 정함) */
  private updateRunner(): void {
    const run = this.state !== null && this.mode === 'game' && this.owner === 'host' && shouldRunWhenHidden(this.state);
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
    if (ok && current) this.maybeSuspend(); // 자동 전투를 방금 끈 채 VS Code 밖이면 멈춤
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
    this.state = { save: checked.save, runtime: readRuntime(state.runtime, this.deps.newSeed()) };
    this.stats.accepted++;
    this.deps.store.set(this.state.save);
    return true;
  }

  private onHeadless(elapsedMs: number): void {
    if (!this.state || this.owner !== 'host' || this.mode !== 'game' || !shouldRunWhenHidden(this.state)) {
      this.runner.stop();
      return;
    }
    const r = advance(this.state, elapsedMs);
    this.state = r.state;
    if (r.steps > 0) {
      this.stats.headlessSteps += r.steps;
      this.deps.store.set(this.state.save);
    }
  }
}
