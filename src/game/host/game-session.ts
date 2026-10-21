/**
 * 게임 세션 (확장 쪽) — 게임 상태를 갖고 저장하며, 지금 누가 계산하는지(웹뷰 · 확장)를 정한다 (mvp-spec 9장).
 *
 * - 패널이 보이면 웹뷰가 계산 · 그리기를 맡고, 1초마다(바뀌었을 때) 상태를 보내 줌 → 여기서 저장
 * - 패널이 안 보이면 (접음 · 다른 탭) 웹뷰는 버려질 수 있어서 여기가 넘겨받음.
 *   자동 전투가 켜져 있으면 같은 계산을 그림 없이 이어 돌리고, 꺼져 있으면 멈춰 둠
 * - VS Code 밖 (창이 포커스를 잃음) 이어도 패널이 보이면 웹뷰가 그대로 계산 · 그리기 (2026-10-19 태현 님: 웹페이지를 보는 동안 게임이 멈춰 보임 —
 *   예전엔 포커스를 잃으면 "안 봄" 으로 쳐서 넘겨받았음). 정말 안 보일 때 (접음 · 다른 탭 · 창을 내림) 만 위처럼 넘겨받음
 * - 다시 보이면 웹뷰가 새로 떠서 상태를 달라고 함 → 여기 상태를 넘겨줌
 * - 게임 모드는 창 잠금을 쥔 창 하나만, 세이브도 그 창만 씀
 *
 * VS Code 를 모른다 (웹뷰는 ViewPort, 저장은 SaveStore, 창 잠금은 WindowLease 로만 만남) → 자동 테스트에서 그대로 돌림.
 */
import { BALANCE, TIMING } from '../core/balance';
import { advance, createGameState, isWaitingForInput, readRuntime, shouldRunWhenHidden, waitReason, withSpeed, type GameNotice, type GameState } from '../core/engine';
import { readSave, TIPS_MAX, validateSave, type Save } from '../core/save';
import { GAME_COMMAND, isWebviewToHost, type HostToWebview, type TitleInfo, type TitleNotice } from '../shared/messages';
import { GAME_MIN_HEIGHT_PX } from '../shared/screen';
import { HeadlessRunner, type HeadlessRunnerOptions } from './headless-runner';
import type { LoadResult, SaveStore } from './save-store';
import type { TeamSave } from './team-out';
import type { WindowLease } from './window-lease';
import { dailyDone, dayKey } from '../core/rules/daily';
import { stageCode } from '../core/rules/stage';
import { speciesOf } from '../data';
import { devDemoSave, devState } from '../dev/demo';
import { DEV_MODE } from '../dev/runtime';

/** 일반 모드로 갈 때 상태줄 "저장했어요" 를 보여 주는 시간 (ms, 2026-10-21 ideas #8) */
const SAVED_STATUS_MS = 2000;

/** 이어 하기 요약 "어디서" — "1-1 · 37%" · "전투 중" · "체육관" (2026-10-21 ideas #6) */
/** "멈춰 있어요" 팝업은 처음 이만큼만 (태현 님 "추천안") */
const PAUSED_NOTICE_MAX = 3;

/** 불러올 세이브 파일 크기 상한 (글자) — 세이브는 보통 수십 KB */
const IMPORT_MAX_CHARS = 5_000_000;

/** 세이브 한 줄 요약 — 타이틀 이어 하기 · 불러오기 확인 상자 (같은 모양) */
/** today = 오늘 날짜 (있으면 오늘의 목표 수도 — 켜졌고 세이브의 목표가 오늘 것일 때만, #28 타이틀 "오늘 1/3") */
function summaryOf(save: Save, today?: string): NonNullable<TitleInfo['summary']> {
  const leadUid = save.party[0];
  const lead = leadUid ? save.monsters[leadUid] : undefined;
  const d = save.daily;
  const daily = BALANCE.daily.on && today !== undefined && d?.day === today ? { daily: { done: dailyDone(d), total: d.goals.length } } : {};
  return { playTimeMs: save.playTimeMs, money: save.money, badges: [...save.badges], lead: lead ? { form: lead.form, species: lead.species, level: lead.level } : null, where: whereOf(save), ...daily };
}

function whereOf(save: Save): string {
  if (save.pendingEncounter) return '전투 중';
  if (save.location.screen === 'gym') return '체육관';
  if (save.location.screen === 'stage') return `${stageCode(save.location.stageId)} · ${Math.floor((save.stages[save.location.stageId]?.progress ?? 0) * 100)}%`;
  return '';
}

/** 웹뷰 쪽 문 — VS Code 의 WebviewView 를 감싼 것 (view-port.ts) */
export interface ViewPort {
  post(message: HostToWebview): void;
  readonly visible: boolean;
  /** 포켓몬 탭 배지 — 0 이면 지움 (없으면 안 그림, 테스트) */
  badge?(count: number, tooltip?: string): void;
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
  /** 상태줄에 잠깐 (ms) — 일반 모드로 갈 때 "포켓몬: 저장했어요 (이상해씨 Lv 5)" (ideas #8) */
  status?(message: string, ms: number): void;
  /** 안 볼 때 직접 해야 하는 순간 알림 (U9 — VS Code 알림, 세이브 설정 notifications 가 켜져 있을 때만) */
  notify?(message: string): void;
  runner?: HeadlessRunnerOptions;
  /** 모드가 바뀜 — 제목줄 버튼 (🎮 ↔ 🏠 · ＋ 🔀 🗑 숨기기) */
  onModeChanged?(mode: Mode): void;
  /** 웹뷰가 새로 뜸 (boot) — 📦 꺼낸 팀을 다시 보냄 */
  onWebviewBoot?(): void;
  /** 벽시계 (ms) — 오늘의 목표 날짜 (없으면 Date.now — 테스트가 바꿈) */
  wallNow?(): number;
  /** 세이브 파일 창 (orders #33) — save = 저장 창 · 쓰기 (파일 이름 · 취소면 null) · open = 열기 창 · 읽기 (취소면 null). 없으면 내보내기 · 가져오기 안 됨 */
  files?: { save(defaultName: string, text: string): Promise<string | null>; open(): Promise<{ name: string; text: string } | null> };
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
  /** VS Code 창 포커스 — 웹뷰에 알려서 포커스가 없을 때 이로치 흔적 앞에서 멈추게 (2026-10-19) */
  private windowFocused = true;
  /** 웹뷰에 game.js 가 떠 있어 맡길 수 있는지 (ready 에서 켜고, 새로 뜸 · 못 불러옴 · 닫힘에서 끔) */
  private webviewReady = false;
  /** 웹뷰가 "패널이 너무 낮아서" 넘김 (접힌 상태) — 다시 높아지면 ready 가 옴. 그동안 포커스가 돌아와도 맡기지 않음 (#297) · 알림은 "올리면" (#299) */
  private webviewCollapsed = false;
  /** 포켓몬 탭 배지를 달았는지 · 접힌 줄에 마지막으로 상태를 보낸 때 (R13) */
  private badgeOn = false;
  private lastPeekAt = 0;
  /** 확장이 넘겨받은 때 · VS Code 밖으로 나간 때 — 팝업은 그 뒤 10초가 지나야 (짧은 탭 전환을 거름 — 태현 님 "추천안") */
  private hiddenAt = 0;
  private awayAt = 0;
  /** 10초를 기다리는 팝업 (가장 나중 것 하나) */
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;
  /** 기다리는 팝업이 밖 (포커스 없음) 것인지 · 그 이유 — 포커스가 돌아오면 밖 것만 취소, 안 보낸 숨김 것은 noticed 를 지움 (코드 리뷰어) */
  private noticeAway = false;
  private noticePending: GameNotice | null = null;
  /** 불러오기 확인을 기다리는 세이브 (orders #33) */
  private pendingImport: { save: Save; name: string } | null = null;
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
  /** 개발 모드 (임시, gdd 8장 · S02 ④) — 저장하지 않는 게임: 진짜 세이브는 읽기만, 이 동안은 어디서도 쓰지 않음 (자동저장 · 나갈 때 · 끌 때). 나가면 사라짐 */
  private dev = false;
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
        this.webviewCollapsed = false;
        if (this.mode !== 'normal') this.post({ type: 'load' });
        try {
          this.deps.onWebviewBoot?.();
        } catch (e) {
          this.deps.log(`boot 알림 실패: ${String(e)}`);
        }
        return;
      case 'ready':
        this.webviewReady = true;
        this.webviewCollapsed = false; // 접혔던 웹뷰가 다시 높아짐 (또는 다시 보임)
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
      case 'notice':
        // 웹뷰가 계산하다 생긴 알림 (VS Code 에 포커스가 없을 때 이로치 흔적) — 패널은 보이니 "돌아오면" 문구로
        if (this.owner === 'webview' && message.epoch === this.epoch) this.notify(message.notice, true);
        return;
      case 'save-now':
        if (this.accept(message.epoch, message.state) && this.state) this.persist(this.state.save, true);
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
        this.webviewCollapsed = message.collapsed === true;
        this.accept(message.epoch, message.state);
        this.takeOver('웹뷰가 멈춤');
        this.handoverEpoch = null; // hidden 이 마지막 — 같은 epoch 의 메시지는 더 받지 않음
        // 웹뷰는 다시 보일 때 ready 로 상태를 달라고 함
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
          this.warn(`포켓몬 게임 화면에 문제가 생겼어요 — 제목줄 🏠 로 일반 모드로 나갈 수 있어요 (${this.dev ? '개발 모드는 저장되지 않아요' : '진행은 저장돼요'}).`);
          // 아무도 계산하지 않는 채로 두지 않음 — 자동 전투면 여기서 이어 감
          if (this.owner !== 'host') this.hostOwns('웹뷰가 게임을 못 불러옴', false);
        }
        return;
      case 'title-new':
        if (this.mode === 'title') void this.newFromTitle(message.save);
        return;
      case 'save-export':
        void this.exportSave();
        return;
      case 'save-import':
        void this.importSave();
        return;
      case 'save-import-confirm':
        void this.confirmImport();
        return;
      case 'save-import-cancel':
        this.pendingImport = null;
        return;
      case 'title-continue':
        if (this.mode === 'title') void this.continueFromTitle();
        return;
      case 'title-dev':
        if (this.mode === 'title' && DEV_MODE) void this.serial(() => this.enterDev());
        return;
      case 'dev-end':
        if (this.mode === 'game' && this.dev) void this.serial(() => this.endDev());
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

  /** VS Code 창 포커스 — 포커스만으로는 넘겨받지 않음 (보이면 웹뷰가 계속, 2026-10-19). 확장이 들고 있는데 보이는 웹뷰가 있으면 돌아올 때 다시 맡김 */
  onWindowFocusChanged(focused: boolean): void {
    if (this.windowFocused && !focused) this.awayAt = this.deps.now();
    // 돌아오면 밖 알림만 취소 — 숨김 (확장이 들고 있음) 알림은 패널을 다시 볼 때 (handToWebview) 취소 (잠깐 다른 앱에 갔다 오면 숨김 팝업이 영영 안 뜨던 것 — 코드 리뷰어)
    if (focused) this.cancelNotice(true);
    this.windowFocused = focused;
    if (this.mode === 'game' && this.owner === 'webview') this.post({ type: 'focus', focused });
    // 접힌 상태 (패널이 너무 낮음) 면 맡기지 않음 — 맡겨도 웹뷰가 바로 돌려줌 (#297, 다시 높아지면 웹뷰가 ready)
    if (focused && this.mode === 'game' && this.owner === 'host' && this.webviewReady && !this.webviewCollapsed && this.view?.visible) this.handToWebview();
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
    this.persist(this.state.save);
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

  /** S01 ② 📦 꺼내기 — 세이브를 읽기만 (다른 창이 바꿨을 수 있어 파일에서 다시) · 게임 중이면 지금 상태. 줄에 섬 (들어가기 · 나가기와 겹치지 않게) */
  readSaveForTeam(): Promise<TeamSave> {
    return this.serial(async () => {
      if (this.mode === 'game' && !this.dev) return this.state ? { kind: 'ok', save: this.state.save } : { kind: 'none' };
      // 읽기만 — 세션 상태 · 저장소를 건드리지 않음 (줄을 서는 건 게임에서 나올 때 마지막 저장이 끝난 뒤에 읽으려고)
      const r = this.deps.store.peek();
      return r.kind === 'ok' ? { kind: 'ok', save: r.save } : { kind: r.kind };
    });
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
    this.cancelNotice();
    this.stopBusyWatch();
    this.finalWait?.();
    this.runner.stop();
    if (this.state && this.mode === 'game') this.persist(this.state.save);
    const ok = this.deps.store.dispose();
    this.deps.lease?.release();
    return ok;
  }

  /** 타이틀에 세이브 요약을 보냄 (줄에 섬) */
  private sendTitle(notice?: TitleNotice): Promise<void> {
    return this.serial(() => this.postTitle(notice));
  }

  /** 세이브 내보내기 (orders #33) — 게임 중이면 지금 상태 · 아니면 파일 세이브를 JSON 으로 저장 창에 (개발 모드는 막음 — 저장 안 됨 모드) */
  private async exportSave(): Promise<void> {
    if (!this.deps.files) return;
    if (this.dev) return this.postSaveResult(false, '개발 모드에서는 세이브를 내보내지 않아요');
    const r = this.deps.store.peek();
    const save = this.mode === 'game' && this.state ? this.state.save : r.kind === 'ok' ? r.save : null;
    if (!save) return this.postSaveResult(false, '내보낼 세이브가 없어요');
    let name: string | null;
    try {
      name = await this.deps.files.save(`pokemon-save-${dayKey(new Date(this.deps.wallNow?.() ?? Date.now()))}.json`, JSON.stringify(save, null, 2));
    } catch (e) {
      return this.postSaveResult(false, `세이브를 저장하지 못했어요 (${String(e)})`);
    }
    if (name) this.postSaveResult(true, `세이브를 저장했어요 — ${name}`);
  }

  /** 세이브 불러오기 1 (orders #33) — 열기 창 · 읽기 · 검사 (옛 판은 옮김) → 웹뷰에 확인 상자 (요약) · 못 읽으면 까닭. 게임 중에만 (개발 모드는 막음) */
  private async importSave(): Promise<void> {
    if (!this.deps.files) return;
    this.pendingImport = null;
    if (this.dev || this.mode !== 'game') return this.post({ type: 'save-import-ask', error: '개발 모드에서는 세이브를 불러오지 않아요' });
    let file: { name: string; text: string } | null;
    try {
      file = await this.deps.files.open();
    } catch (e) {
      return this.post({ type: 'save-import-ask', error: `파일을 읽지 못했어요 (${String(e)})` });
    }
    if (!file) return;
    let raw: unknown;
    try {
      raw = file.text.length > IMPORT_MAX_CHARS ? null : JSON.parse(file.text);
    } catch {
      raw = null;
    }
    const r = readSave(raw);
    if (r.kind === 'newer') return this.post({ type: 'save-import-ask', name: file.name, error: `더 새 확장의 세이브 (${r.version}판) 라 불러올 수 없어요 — 확장을 업데이트해 주세요` });
    if (r.kind !== 'ok') return this.post({ type: 'save-import-ask', name: file.name, error: '포켓몬 게임 세이브가 아니거나 망가진 파일이에요' });
    this.pendingImport = { save: r.save, name: file.name };
    this.post({ type: 'save-import-ask', name: file.name, summary: summaryOf(r.save) });
  }

  /** 세이브 불러오기 2 — 확인하면 지금 세이브를 보관함에 두고 (자동 보관 [제안]) 덮어써서 그 세이브로 이어 함 */
  private confirmImport(): Promise<void> {
    return this.serial(async () => {
      const p = this.pendingImport;
      this.pendingImport = null;
      if (!p || this.dev || this.mode !== 'game') return;
      if (this.deps.lease && !this.deps.lease.held) return this.postSaveResult(false, '다른 VS Code 창이 게임 중이라 불러오지 못했어요');
      let ok = false;
      try {
        ok = await this.deps.store.replace(p.save, '불러오기 전 세이브');
      } catch (e) {
        this.deps.log(`불러오기 실패: ${String(e)}`);
      }
      if (!ok) return this.postSaveResult(false, '세이브를 쓰지 못해 불러오지 못했어요');
      this.state = createGameState(p.save, this.deps.newSeed());
      this.loadResult = { kind: 'ok', save: p.save, problems: [], migratedFrom: null };
      // 새 epoch 으로 — 웹뷰가 옛 진행을 보내 불러온 세이브를 덮지 않게
      if (this.owner === 'webview') this.handToWebview();
      else this.hostOwns('세이브 불러오기');
      this.postSaveResult(true, `불러왔어요 — 지금 것은 보관함에 둠 (${p.name})`);
    });
  }

  private postSaveResult(ok: boolean, text: string): void {
    this.deps.log(`세이브 ${ok ? '' : '실패 '}— ${text}`);
    this.post({ type: 'save-result', ok, text });
  }

  /** 세이브 요약 — 다른 창이 바꿨을 수 있어 파일에서 다시 읽음 (읽기만). 다른 창이 게임 중이면 끝날 때까지 지켜봄 */
  private async postTitle(notice?: TitleNotice): Promise<void> {
    if (this.mode !== 'title') return;
    const r = await this.init({ readOnly: true });
    const save = r.kind === 'ok' ? r.save : null;
    const info: TitleInfo = {
      save: r.kind,
      busy: this.otherWindowPlaying(),
      summary: save ? summaryOf(save, dayKey(new Date(this.deps.wallNow?.() ?? Date.now()))) : null,
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
    this.dev = false; // 개발 모드 (임시) 표시가 남아 일반 게임 저장을 건너뛰지 않게
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
    // 개발 모드 (임시) — 세이브를 바꾸지 않음
    if (this.dev) return 'busy';
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
    // 게임에서 나가면 탭 배지도 지움 (접힌 채 대기실 → 🏠 에 "기다려요" 가 일반 모드에 남던 것 — 코드 리뷰어)
    this.updateBadge();
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
    if (this.dev) {
      // 개발 모드 — 저장 없이 나감 (한 것은 사라짐), 다음엔 진짜 세이브로
      this.runner.stop();
      this.setMode('normal');
      this.owner = 'none';
      this.epoch++;
      this.handoverEpoch = null;
      this.post({ type: 'stop' });
      await this.leaveDev('일반 모드로');
      return;
    }
    // 이미 잠겨서 나가는 것이면 (onStoreLocked) 알림은 거기서 했음
    const lockedBefore = this.deps.store.lockedReason !== null;
    if (options.askWebview) await this.collectFinalState();
    this.runner.stop();
    this.cancelNotice();
    this.setMode('normal');
    this.owner = 'none';
    this.epoch++;
    this.handoverEpoch = null;
    this.post({ type: 'stop' });
    this.deps.log('일반 모드로');
    if (this.state) await this.finalSave(this.state.save, lockedBefore);
    this.deps.store.setWritable(false);
    this.deps.lease?.release();
  }

  /** 일반 모드로 갈 때 마지막 저장 — 못 쓰면 그 진행을 보관함에 남기고 알림 (다시 읽을 때 잃지 않게) */
  private async finalSave(save: Save, lockedBefore: boolean): Promise<void> {
    if (await this.deps.store.saveNow(save)) {
      // 수동 저장이 없어 "저장됐나?" 를 덜게 — 상태줄에 2초 (2026-10-21 ideas #8)
      const lead = save.monsters[save.party[0] ?? ''];
      const who = lead ? ` (${speciesOf(lead.species)?.name.ko ?? lead.form} Lv ${lead.level})` : '';
      try {
        this.deps.status?.(`포켓몬: 저장했어요${who}`, SAVED_STATUS_MS);
      } catch {
        // 상태줄이 실패해도 게임 흐름은 그대로
      }
      return;
    }
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
    this.markHeadless(false);
    this.cancelNotice();
    this.updateBadge();
    this.post({ type: 'start', epoch: this.epoch, state: this.state });
    // 포커스 상태를 늘 같이 (돌아온 뒤 다시 맡길 때 focused: true 를 안 보내 웹뷰가 "포커스 없음" 으로 남아 이로치 · 라이벌 앞에서 멈춰 있던 것 — 테스터 2026-10-20)
    this.post({ type: 'focus', focused: this.windowFocused });
    this.deps.log(`웹뷰가 계산을 맡음 (epoch ${this.epoch})`);
  }

  /** 웹뷰가 맡던 것을 넘겨받음 */
  private takeOver(why: string): void {
    if (this.owner !== 'webview') return;
    this.handoverEpoch = this.epoch;
    this.epoch++;
    this.owner = 'host';
    this.markHeadless(true);
    this.updateRunner();
    this.noticeHidden();
    this.deps.log(`${why} → 확장이 넘겨받음 (epoch ${this.epoch}, ${this.runner.running ? '자동 전투라 계속 계산' : '멈춤'})`);
  }

  /**
   * 넘겨받은 순간 (gdd 4.13 · U6) — 이미 기다리던 장면이면 그 알림 (걸음을 계산할 때만 알림이 생겨 안 뜨던 것),
   * 자동 꺼짐이면 "멈춰 있어요" 한 번 (알림 없이 전부 멈추던 것) · 탭 배지 · 접힌 줄에 지금 상태
   */
  private noticeHidden(): void {
    if (!this.state || this.mode !== 'game' || this.owner !== 'host') return;
    const wait = waitReason(this.state);
    // 자동 꺼짐 멈춤 (paused) 은 자동을 켜면 걷는 곳 (스테이지) 에서만 — 병원 · 상점 안 (사람이 먼저 들어간 곳) · 세계 지도는 표대로 알림 · 배지 없음 (코드 리뷰어)
    const paused = wait === null && !shouldRunWhenHidden(this.state) && this.state.save.location.screen === 'stage' && !isWaitingForInput(this.state);
    const reason = wait ?? (paused ? 'paused' : null);
    if (reason && reason !== this.state.runtime.noticed) {
      this.state = { ...this.state, runtime: { ...this.state.runtime, noticed: reason } };
      this.notify(reason);
    }
    this.updateBadge();
    this.peek(true);
  }

  /** 포켓몬 탭 배지 — 안 볼 때 (확장이 계산) 기다리는 장면이면 1, 다시 보면 지움 (알림 끄기와 상관없이 · 개발 모드는 없음 — gdd 4.13 [제안]) */
  private updateBadge(): void {
    const s = this.state;
    const on = s !== null && this.mode === 'game' && this.owner === 'host' && !this.dev && (waitReason(s) !== null || s.runtime.noticed === 'paused');
    if (on === this.badgeOn) return;
    this.badgeOn = on;
    this.view?.badge?.(on ? 1 : 0, on ? '포켓몬 게임이 기다려요' : undefined);
  }

  /** 접힌 동안 (150px 아래 — 보이지만 확장이 계산) 지금 상태를 웹뷰에 (접힌 줄이 접은 순간 모습 그대로 멈춰 있던 것 — R13), 1초에 한 번까지 */
  private peek(force = false): void {
    if (!this.state || this.owner !== 'host' || !this.webviewCollapsed || !this.view?.visible) return;
    const now = this.deps.now();
    if (!force && now - this.lastPeekAt < 1000) return;
    this.lastPeekAt = now;
    this.post({ type: 'peek', state: this.state });
  }

  /** 웹뷰에 맡기지 않고 여기서 들고 있음 · notice = 기다리면 알림 (화면 오류로 온 것이면 그 경고만 — 겹치지 않게) */
  private hostOwns(why: string, notice = true): void {
    this.epoch++;
    this.owner = 'host';
    this.handoverEpoch = null;
    this.markHeadless(true);
    this.updateRunner();
    if (notice) this.noticeHidden();
    else this.updateBadge();
    this.deps.log(`${why} → 확장이 들고 있음 (epoch ${this.epoch})`);
  }

  /** 확장이 안 볼 때 계산 중인지 게임 상태에 적음 — 이로치 흔적 앞에서 멈추는 데 씀 (U9) */
  private markHeadless(on: boolean): void {
    if (on && this.state?.runtime.headless !== true) this.hiddenAt = this.deps.now();
    if (this.state && this.state.runtime.headless !== on) this.state = { ...this.state, runtime: { ...this.state.runtime, headless: on } };
  }

  /** 저장 — 바로 (now) 또는 5초 안에. 개발 모드 (임시) 는 아무 데도 쓰지 않음 */
  private persist(save: Save, now = false): void {
    if (this.dev) return;
    if (now) void this.deps.store.saveNow(save);
    else this.deps.store.set(save);
  }

  /** 개발 모드로 (타이틀 S02 ④) — 진짜 세이브를 읽기만 (없으면 시연 팀), 창 잠금 · 쓰기 없이 게임으로. serial 안에서만 */
  private async enterDev(): Promise<void> {
    await this.loading;
    if (this.mode !== 'title') return;
    const r = this.deps.store.peek();
    const real = r.kind === 'ok' && r.save.party.length > 0 && r.save.location.screen !== 'title' ? r.save : null;
    const save = real ?? devDemoSave(this.deps.now(), this.deps.newSeed());
    const state = devState(createGameState(save, this.deps.newSeed()));
    this.state = state;
    this.dev = true;
    this.setMode('game');
    this.deps.log(`개발 모드로 (저장 안 함 · ${real ? '지금 진행' : '시연 팀'})`);
    // 웹뷰에 아직 game.js 가 없으면 boot.js 가 불러오고, 이미 있으면 game.js 가 ready 로 답함
    this.post({ type: 'load' });
  }

  /** 개발 모드 끝내기 (개발 메뉴) — 저장 없이 타이틀로. serial 안에서만 */
  private async endDev(): Promise<void> {
    if (this.mode !== 'game' || !this.dev) return;
    this.runner.stop();
    this.owner = 'none';
    this.epoch++;
    this.handoverEpoch = null;
    this.setMode('title');
    await this.leaveDev('타이틀로');
    await this.postTitle();
  }

  /** 개발 모드에서 나옴 — 한 것을 버리고 진짜 세이브를 다시 읽어 둠 (읽기만) */
  private async leaveDev(to: string): Promise<void> {
    this.dev = false;
    this.deps.log(`개발 모드 끝 → ${to} (저장 안 함)`);
    await this.init({ readOnly: true });
  }

  /** 개발 모드 (임시) 인지 — 테스트 · 기록 */
  get devMode(): boolean {
    return this.dev;
  }

  /**
   * VS Code 팝업 (설정 "알림" 을 켰을 때만 — 처음 값 꺼짐, gdd 4.13) — 숨긴 (밖으로 나간) 지 10초가 지난 뒤에 (짧은 탭 전환 · alt-tab 을 거름).
   * 그 전이면 10초가 될 때 아직 같은 이유로 기다리면 띄움 (가장 나중 것 하나) · 다시 보면 (맡김 · 포커스) 취소
   */
  private notify(notice: GameNotice, away = false): void {
    // 개발 모드 (임시) 는 VS Code 알림을 띄우지 않음
    if (this.dev || !this.state?.save.settings.notifications) return;
    const since = away ? this.awayAt : this.hiddenAt;
    const wait = since + TIMING.noticeAfterHiddenMs - this.deps.now();
    this.cancelNotice();
    if (wait <= 0) {
      this.sendNotice(notice, away);
      return;
    }
    this.noticeAway = away;
    this.noticePending = notice;
    this.noticeTimer = setTimeout(() => {
      this.noticeTimer = null;
      this.noticePending = null;
      if (this.mode !== 'game' || !this.state) return;
      // 아직 안 보고 같은 이유로 기다릴 때만 (밖 = 포커스 없음 · 숨김 = 확장이 들고 있고 그 이유가 그대로)
      const still = away ? !this.windowFocused || this.owner === 'host' : this.owner === 'host' && (waitReason(this.state) ?? (this.state.runtime.noticed === 'paused' ? 'paused' : null)) === notice;
      // 밖에서 기다리다 패널을 숨겼으면 (확장이 들고 있음) "패널을 열면" 문구로 ("VS Code 로 돌아오면" 으로 뜨던 것 — 테스터)
      if (still) this.sendNotice(notice, away && this.owner !== 'host');
    }, wait);
  }

  /** 기다리는 팝업 취소 · onlyAway = 밖 것만. 안 보낸 숨김 알림은 noticed 에서도 지움 (보낸 것처럼 셈해 같은 기다림에 다시 안 뜨던 것 — 코드 리뷰어) */
  private cancelNotice(onlyAway = false): void {
    if (!this.noticeTimer || (onlyAway && !this.noticeAway)) return;
    clearTimeout(this.noticeTimer);
    if (!this.noticeAway && this.state && this.noticePending !== null && this.state.runtime.noticed === this.noticePending) {
      const { noticed: _n, ...runtime } = this.state.runtime;
      this.state = { ...this.state, runtime };
    }
    this.noticeTimer = null;
    this.noticePending = null;
  }

  private sendNotice(notice: GameNotice, away: boolean): void {
    if (this.dev || !this.state?.save.settings.notifications) return;
    // "멈춰 있어요" 는 처음 3번만 (세이브 tips 'paused-1' ~ — 태현 님 "추천안") · 그 뒤엔 배지 · 다시 볼 때 게임 안 안내만
    if (notice === 'paused') {
      const tips = this.state.save.tips ?? [];
      const n = tips.filter((t) => /^paused-\d$/.test(t)).length;
      if (n >= PAUSED_NOTICE_MAX || tips.length >= TIPS_MAX) return;
      this.state = { ...this.state, save: { ...this.state.save, tips: [...tips, `paused-${n + 1}`] } };
      this.persist(this.state.save);
    }
    const text = noticeText(notice, this.webviewCollapsed, away);
    this.deps.log(`알림: ${text}`);
    try {
      this.deps.notify?.(text);
    } catch {
      // 알림이 실패해도 게임 흐름은 그대로
    }
  }

  /** 안 볼 때 계산은 지금 상태의 자동 전투 설정으로 정함 (늦게 온 상태로 바뀌면 다시 정함) */
  private updateRunner(): void {
    // 사람을 기다리는 순간 (isWaitingForInput — 고르기 · 클리어 카드 · 대기실 · 패배 두 번째 · 이로치 앞 등, gdd 4.13) 에는 안 볼 때 계산할 게 없음 — 깨어나 저장만 되풀이하지 않게
    // 개발 모드 (임시) 멈춤이면 안 볼 때도 멈춘 채로
    const run = this.state !== null && this.mode === 'game' && this.owner === 'host' && shouldRunWhenHidden(this.state) && !isWaitingForInput(this.state) && this.state.runtime.dev?.pause !== true;
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
    const told = this.state?.runtime.noticed;
    const ok = this.applyFromWebview(state);
    if (ok && late) {
      // 웹뷰는 보던 중이라 noticed 가 없음 — 넘겨받을 때 이미 알린 것을 그대로 (visibility → save-now → hidden 에 같은 알림 2 ~ 3번 — 코드 리뷰어)
      if (told !== undefined && this.state && this.state.runtime.noticed === undefined) this.state = { ...this.state, runtime: { ...this.state.runtime, noticed: told } };
      this.updateRunner();
      // 넘겨받은 뒤 늦게 온 마지막 상태 — 그 장면으로 다시 봄 (같은 기다림이면 noticed 로 한 번만)
      this.noticeHidden();
    }
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
    // 개발 값은 개발 모드일 때만 (웹뷰가 보낸 값으로 개발 모드를 켜거나 끄지 못하게)
    const { dev, ...runtime } = readRuntime(state.runtime, this.deps.newSeed());
    this.state = { save: checked.save, runtime: { ...runtime, speed, headless: this.owner === 'host' } };
    if (this.dev) this.state = devState({ ...this.state, runtime: { ...this.state.runtime, ...(dev ? { dev } : {}) } });
    this.stats.accepted++;
    this.persist(this.state.save);
    return true;
  }

  private onHeadless(elapsedMs: number): void {
    if (!this.state || this.owner !== 'host' || this.mode !== 'game' || !shouldRunWhenHidden(this.state)) {
      this.runner.stop();
      return;
    }
    let r: ReturnType<typeof advance>;
    // 내 PC 날짜 — 오늘의 목표 (U13, 엔진은 시계를 모름)
    const today = dayKey(new Date(this.deps.wallNow?.() ?? Date.now()));
    if (this.state.runtime.today !== today) this.state = { ...this.state, runtime: { ...this.state.runtime, today } };
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
      this.persist(this.state.save, r.saves.length > 0);
    }
    for (const n of r.notices) this.notify(n);
    this.updateBadge();
    if (r.steps > 0) this.peek();
    if (isWaitingForInput(this.state)) this.runner.stop();
  }
}

/**
 * 알림 문구 (gdd 4.13 표 — U9 · U6) — 이어서 하는 법: 밖 (away — 패널은 보이는데 VS Code 에 포커스 없음, 웹뷰가 알림) = "VS Code 로 돌아오면" ·
 * 접힘 (보이지만 너무 낮음) = "150px 이상으로 올리면" (#299 — 패널은 이미 열려 있어서 헷갈림) · 숨김 = "패널을 열면"
 */
export function noticeText(notice: GameNotice, collapsed: boolean, away = false): string {
  const back = away ? 'VS Code 로 돌아오면' : collapsed ? `포켓몬 패널을 ${GAME_MIN_HEIGHT_PX}px 이상으로 올리면` : '포켓몬 패널을 열면';
  const open = away ? 'VS Code 로 돌아와' : collapsed ? `포켓몬 패널을 ${GAME_MIN_HEIGHT_PX}px 이상으로 올려` : '포켓몬 패널을 열어';
  const TEXT: Record<GameNotice, string> = {
    shiny: `✨ 반짝이는 흔적을 찾았어요! ${back} 이어서 걸어요.`,
    rival: `⚔ 라이벌이 길에서 기다려요! ${back} 이어서 걸어요.`,
    battle: `⚔ 전투가 기다려요! ${back} 이어서 싸워요 — [A] 자동 전투면 알아서 싸워요.`,
    choice: `🧬 진화 · 새 기술을 고를 차례예요. ${open} 골라 주세요.`,
    defeat: `😵 포켓몬들이 쓰러졌어요… ${open} 이어 가 주세요.`,
    clear: `🎉 스테이지를 깼어요! ${open} 다음 스테이지를 골라 주세요.`,
    gym: `🏟 체육관 대기실에서 기다려요! ${open} 관장에게 도전해 보세요.`,
    badge: `🏅 관장을 이겼어요! 배지를 받았어요 — ${open} 보세요.`,
    paused: '⏸ 자동 전투가 꺼져 있어 멈춰 있어요. 자동 전투를 켜면 안 볼 때도 계속 걸어요.',
  };
  return TEXT[notice];
}
