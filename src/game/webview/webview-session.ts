/**
 * 웹뷰 쪽 세션 — 확장에게 받은 상태로 계산을 이어 가고, 1초마다(바뀌었을 때) 상태를 돌려준다.
 * 화면(DOM)을 모르는 부분만 모아서 자동 테스트로 확인한다 (그리기 · 이벤트 연결은 main.ts).
 */
import { TIMING } from '../core/balance';
import { advance, applyInput, clampFrameDelta, type GameInput, type GameState } from '../core/engine';
import type { Save } from '../core/save';
import { GAME_COMMAND, type HostToWebview, type SaveReason, type TitleInfo, type WebviewToHost } from '../shared/messages';

/** 지금 보일 화면 — none 이면 일반 모드 (게임 화면을 숨김) */
export type Screen = 'none' | 'title' | 'game';

export interface WebviewSessionDeps {
  post(message: WebviewToHost): void;
  now(): number;
  /** 이번 걸음을 미룰지 (연출이 끝날 때까지 — 없으면 안 미룸) */
  hold?: (state: GameState, dtMs: number) => boolean;
}

export class WebviewSession {
  /** 확장이 맡긴 epoch — null 이면 지금은 계산을 맡지 않음 */
  private epoch: number | null = null;
  private state: GameState | null = null;
  private dirty = false;
  private lastSentAt = 0;
  private titleInfo: TitleInfo | null = null;
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
        this.epoch = message.epoch;
        this.state = message.state;
        this.dirty = false;
        this.lastSentAt = this.deps.now();
        this.titleInfo = null;
        this.screenNow = 'game';
        // 접힌 상태 (150px 아래) 에서 맡겨지면 계산하지 않고 바로 돌려줌 — 안 그리는 웹뷰가 맡아 게임이 조용히 멈추지 않게
        if (this.collapsed) this.hide();
        this.changed();
        return;
      case 'title':
        this.epoch = null;
        this.state = null;
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
      case 'stop':
        this.epoch = null;
        this.state = null;
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
