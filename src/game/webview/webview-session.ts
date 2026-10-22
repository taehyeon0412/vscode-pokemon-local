/**
 * 웹뷰 쪽 세션 — 확장에게 받은 상태로 계산을 이어 가고, 1초마다(바뀌었을 때) 상태를 돌려준다.
 * 화면(DOM)을 모르는 부분만 모아서 자동 테스트로 확인한다 (그리기 · 이벤트 연결은 main.ts).
 */
import { BALANCE, TIMING } from '../core/balance';
import { advance, applyInput, clampFrameDelta, syncRegionOrder, type GameInput, type GameState } from '../core/engine';
import { dayKey } from '../core/rules/daily';
import { SAVE_VERSION, type Save } from '../core/save';
import { GAME_COMMAND, type HostToWebview, type SaveReason, type TitleInfo, type WebviewToHost } from '../shared/messages';

/** 세이브 내보내기 · 가져오기 화면 상태 (orders #33 — 모양은 디자인팀): 확인 상자 · 못 읽음 · 결과 한 줄 */
export interface SaveIoView {
  /** fixes = 읽으며 고친 곳 수 · lost = 빠진 포켓몬 수 (있으면 — 코드 리뷰어 #48) */
  ask?: { name: string; summary: TitleInfo['summary']; fixes?: number; lost?: number };
  error?: string;
  name?: string;
  result?: { ok: boolean; text: string };
}

/** 지금 보일 화면 — none 이면 일반 모드 (게임 화면을 숨김) */
export type Screen = 'none' | 'title' | 'game';

export interface WebviewSessionDeps {
  post(message: WebviewToHost): void;
  now(): number;
  /** 벽시계 (ms — 오늘의 목표 날짜, 없으면 Date.now · 테스트가 날짜를 바꿈) */
  wallNow?(): number;
  /** 이번 걸음을 미룰지 (연출이 끝날 때까지 — 없으면 안 미룸) */
  hold?: (state: GameState, dtMs: number) => boolean;
}

export class WebviewSession {
  /** 날짜를 마지막으로 본 때 (deps.now — 1초에 한 번) */
  private dayCheckedAt = -Infinity;
  /** 확장이 맡긴 epoch — null 이면 지금은 계산을 맡지 않음 */
  private epoch: number | null = null;
  private state: GameState | null = null;
  private dirty = false;
  private lastSentAt = 0;
  private titleInfo: TitleInfo | null = null;
  /** 세이브 내보내기 · 가져오기 (orders #33) — 확인 상자 (ask) · 결과 한 줄 (result) · 화면이 닫으면 null */
  private saveIoNow: SaveIoView | null = null;
  private screenNow: Screen = 'none';
  /** 판 (지도 · 내 포켓몬 · 프로필 …) 이 떠 있음 — 계산을 쉼 (바뀐 상태는 그대로 보냄) */
  private paused = false;
  /** 패널이 게임 모드 최소 높이 (150px) 보다 낮음 — 접힌 상태 (setCollapsed) */
  private collapsed = false;
  /** VS Code 창에 포커스가 없음 (확장이 focus 로 알림) — 엔진이 이로치 흔적 앞에서 멈춤 (2026-10-19) */
  private away = false;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly deps: WebviewSessionDeps) {}

  get screen(): Screen {
    return this.screenNow;
  }

  get title(): TitleInfo | null {
    return this.titleInfo;
  }

  get saveIO(): SaveIoView | null {
    return this.saveIoNow;
  }

  /** 화면이 확인 상자 · 결과 한 줄을 닫음 */
  clearSaveIO(): void {
    if (this.saveIoNow === null) return;
    this.saveIoNow = null;
    this.changed();
  }

  /** 화면이 바뀔 때 (title · start · stop) — 화면 컴포넌트가 다시 그림 */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** S02 새로 하기 — 웹뷰가 만든 새 세이브 (확장이 검사하고 지금 세이브는 보관함에) */
  newGame(save: Save): void {
    this.deps.post({ command: GAME_COMMAND, type: 'title-new', save });
  }

  /** S02 이어 하기 */
  continueGame(): void {
    this.deps.post({ command: GAME_COMMAND, type: 'title-continue' });
  }

  /** 개발 모드 (임시, gdd 8장) — 타이틀에서 들어가기 · 끝내기 (확장이 타이틀을 다시 보냄) */
  devStart(): void {
    this.deps.post({ command: GAME_COMMAND, type: 'title-dev' });
  }

  devEnd(): void {
    this.epoch = null;
    this.deps.post({ command: GAME_COMMAND, type: 'dev-end' });
  }

  /** 일반 모드로 (S02 ③ · S06 ⑪) — 게임 중이면 마지막 상태를 같이 */
  exit(): void {
    const running = this.epoch !== null && this.state !== null;
    this.deps.post({ command: GAME_COMMAND, type: 'exit', epoch: running ? this.epoch : null, state: running ? this.state : null });
  }

  private changed(): void {
    for (const fn of this.listeners) fn();
  }

  /** 판이 뜨면 true — 게임 시간을 멈춤 (S21 "떠 있는 동안 전투가 멈춤" · 메뉴를 보는 동안 걸음이 멈춤) */
  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  get running(): boolean {
    return this.epoch !== null && this.state !== null;
  }

  get current(): GameState | null {
    return this.state;
  }

  handleMessage(message: HostToWebview): void {
    switch (message.type) {
      case 'load':
        // game.js 가 이미 있음 (일반 모드 → 다시 게임 모드) — 상태를 달라고 함
        this.deps.post({ command: GAME_COMMAND, type: 'ready' });
        return;
      case 'start':
        // 판이 다른 상태 = 설치 뒤 다시 로드 전 (확장은 옛 코드, 웹뷰만 새 game.js) — 계산하지 않고 확장에 넘김: 옛 확장이 새 칸을 지운 채 저장하지 않게 (2026-10-21 코드 리뷰어)
        if (message.state.save.version !== SAVE_VERSION) {
          this.deps.post({ command: GAME_COMMAND, type: 'load-failed', message: `세이브 판이 달라요 (${String(message.state.save.version)} ≠ ${SAVE_VERSION}) — 창을 다시 로드해 주세요 (Developer: Reload Window)` });
          return;
        }
        this.epoch = message.epoch;
        this.state = message.state;
        // 첫 그림이 엔진 걸음 전이라 지역 순서를 받은 세이브로 (개발 모드 ↔ 진짜 게임을 오갈 때 지난 세이브 것으로 그리던 것 — 코드 리뷰어 #66)
        syncRegionOrder(message.state);
        this.dirty = false;
        this.lastSentAt = this.deps.now();
        this.titleInfo = null;
        // 다른 화면에서 게임으로 처음 들어올 때는 지난 결과 · 상자를 지움 (나간 뒤 온 결과가 다음 게임에 뜨던 것 — 테스터 #48) · 불러온 뒤 다시 맡길 때 (이미 game) 는 결과 한 줄을 남김
        if (this.screenNow !== 'game') this.saveIoNow = null;
        this.screenNow = 'game';
        // 접힌 상태 (150px 아래) 에서 맡겨지면 계산하지 않고 바로 돌려줌 — 안 그리는 웹뷰가 맡아 게임이 조용히 멈추지 않게
        if (this.collapsed) this.hide();
        this.changed();
        return;
      case 'save-import-ask':
        this.saveIoNow =
          message.error !== undefined
            ? { error: message.error, ...(message.name ? { name: message.name } : {}) }
            : { ask: { name: message.name ?? '', summary: message.summary ?? null, ...(message.fixes ? { fixes: message.fixes } : {}), ...(message.lost ? { lost: message.lost } : {}) } };
        this.changed();
        return;
      case 'save-result':
        this.saveIoNow = { result: { ok: message.ok, text: message.text } };
        this.changed();
        return;
      case 'title':
        this.epoch = null;
        this.state = null;
        // 게임을 나가면 확인 상자 · 결과 한 줄도 지움 (다시 들어온 게임 위에 지난 상자가 떠 Enter 로 덮던 것 — 코드 리뷰어 #48 큼 1)
        this.saveIoNow = null;
        this.titleInfo = message.info;
        this.screenNow = 'title';
        this.changed();
        return;
      case 'suspend':
        // 일반 모드로 나가며 마지막 상태를 달라고 함 — 넘기고 멈춤
        this.hide();
        return;
      case 'focus':
        this.away = !message.focused;
        return;
      case 'peek':
        // 접힌 동안 확장이 계산한 지금 상태 — 맡지 않은 채 그림만 (접힌 줄이 접은 순간 모습 그대로 멈춰 있던 것 — gdd 4.13 R13)
        if (this.epoch === null && this.collapsed && this.screenNow === 'game') {
          this.state = message.state;
          syncRegionOrder(message.state);
          this.changed();
        }
        return;
      case 'stop':
        this.epoch = null;
        this.state = null;
        this.saveIoNow = null;
        this.dirty = false;
        this.titleInfo = null;
        this.screenNow = 'none';
        this.changed();
        return;
    }
  }

  /** 그리기 한 번마다 — 지난 시간만큼 계산하고, 바뀌었으면 1초에 한 번 확장에 보냄 */
  frame(dtMs: number): void {
    if (this.epoch === null || !this.state) return;
    if (this.paused) {
      // 멈춘 동안에도 판에서 바꾼 것 (산 물건 · 팀 순서) 은 보냄 — 껐다 켜도 남게
      this.sendIfDue();
      return;
    }
    // VS Code 에 포커스가 없으면 엔진이 이로치 흔적 앞에서 멈춤 (state.runtime.away)
    if ((this.state.runtime.away === true) !== this.away) this.state = { ...this.state, runtime: { ...this.state.runtime, away: this.away } };
    const dt = clampFrameDelta(dtMs);
    // 일반 모드 연출이 아직 — 피해가 들어가는 걸음을 미룸 (features/battle/fx/hold, 웹뷰에서만). 그동안에도 상태는 보냄 (필살기는 12초까지)
    if (this.deps.hold?.(this.state, dt)) {
      this.sendIfDue();
      return;
    }
    // 내 PC 날짜 — 오늘의 목표 (U13, 엔진은 시계를 모름) · 걸음을 계산할 때만 (연출을 기다리는 동안은 상태를 안 바꿈) · 목표가 켜졌을 때 1초에 한 번 (코드 리뷰어 #52)
    const nowMs = this.deps.now();
    if ((BALANCE.daily.on || this.state.runtime.dev !== undefined) && (this.state.runtime.today === undefined || nowMs - this.dayCheckedAt >= 1000)) {
      this.dayCheckedAt = nowMs;
      const today = dayKey(new Date(this.deps.wallNow?.() ?? Date.now()));
      if (this.state.runtime.today !== today) this.state = { ...this.state, runtime: { ...this.state.runtime, today } };
    }
    const r = advance(this.state, dt);
    this.state = r.state;
    if (r.steps > 0) this.dirty = true;
    // 엔진 알림 (포커스가 없을 때 이로치 흔적) — 확장이 VS Code 알림으로
    for (const notice of r.notices) this.deps.post({ command: GAME_COMMAND, type: 'notice', epoch: this.epoch, notice });
    // 전투 끝 · 잡기 · 스테이지 클리어 — 1초를 기다리지 않고 바로 저장해 달라고 함 (mvp-spec 3.1)
    const reason = r.saves[0];
    if (reason) {
      this.saveNow(reason);
      return;
    }
    this.sendIfDue();
  }

  /** 바뀐 게 있고 1초가 지났으면 확장에 보냄 */
  private sendIfDue(): void {
    if (this.epoch === null || !this.state) return;
    if (this.dirty && this.deps.now() - this.lastSentAt >= TIMING.snapshotIntervalMs) {
      this.deps.post({ command: GAME_COMMAND, type: 'state', epoch: this.epoch, state: this.state });
      this.markSent();
    }
  }

  /** 입력 (Space · 부탁 고르기 등) — 맡고 있을 때만. 받았으면 true (화면을 바로 다시 그리게) */
  input(input: GameInput): boolean {
    if (this.epoch === null || !this.state) return false;
    const next = applyInput(this.state, input);
    if (next === this.state) return false;
    this.state = next;
    this.dirty = true;
    return true;
  }

  /** 개발 모드 (임시, gdd 8장) — 개발 메뉴가 상태를 바로 바꿈 (입력처럼, 맡고 있을 때만). 바꿨으면 true */
  devChange(change: (state: GameState) => GameState): boolean {
    if (this.epoch === null || !this.state) return false;
    const next = change(this.state);
    if (next === this.state) return false;
    this.state = next;
    this.dirty = true;
    return true;
  }

  /** 잡기 · 전투 끝 등 — 바로 저장해 달라고 함 */
  saveNow(reason: SaveReason): void {
    if (this.epoch === null || !this.state) return;
    this.deps.post({ command: GAME_COMMAND, type: 'save-now', epoch: this.epoch, reason, state: this.state });
    this.markSent();
  }

  /** 패널이 안 보이게 됨 — 마지막 상태를 넘기고 계산을 멈춤 (확장이 이어 받음) */
  hide(): void {
    if (this.epoch === null || !this.state) return;
    this.deps.post({ command: GAME_COMMAND, type: 'hidden', epoch: this.epoch, state: this.state, ...(this.collapsed ? { collapsed: true } : {}) });
    this.epoch = null;
    this.dirty = false;
    // 화면에도 알림 — 계산을 넘긴 뒤엔 멈춘 그림 (배경 흐름 · 걷기도 멈춤)
    this.changed();
  }

  /** 다시 보임 (웹뷰가 버려지지 않은 경우) — 확장의 최신 상태를 달라고 함 */
  show(): void {
    this.deps.post({ command: GAME_COMMAND, type: 'ready' });
  }

  /**
   * 패널이 150px 보다 낮아짐 · 다시 높아짐 (2026-10-19 태현 님) — 낮아지면 안 보일 때처럼 마지막 상태를 넘기고 (확장이 이어 감),
   * 게임 중에 다시 높아지면 확장의 최신 상태를 달라고 함. 바뀔 때만 움직임 (창 크기를 바꾸는 동안 여러 번 불려도 한 번)
   */
  /** 지금 접힌 상태인지 (main.ts 가 다시 높아질 때 잠깐 기다릴지 정함) */
  get isCollapsed(): boolean {
    return this.collapsed;
  }

  setCollapsed(collapsed: boolean, visible: boolean): void {
    if (collapsed === this.collapsed) return;
    this.collapsed = collapsed;
    if (collapsed) this.hide();
    else if (visible && this.screenNow === 'game') this.show();
  }

  private markSent(): void {
    this.dirty = false;
    this.lastSentAt = this.deps.now();
  }
}
