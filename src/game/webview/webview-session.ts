/**
 * 웹뷰 쪽 세션 — 확장에게 받은 상태로 계산을 이어 가고, 1초마다(바뀌었을 때) 상태를 돌려준다.
 * 화면(DOM)을 모르는 부분만 모아서 자동 테스트로 확인한다 (그리기 · 이벤트 연결은 main.ts).
 */
import { TIMING } from '../core/balance';
import { advance, clampFrameDelta, type GameState } from '../core/engine';
import { GAME_COMMAND, type HostToWebview, type SaveReason, type WebviewToHost } from '../shared/messages';

export interface WebviewSessionDeps {
  post(message: WebviewToHost): void;
  now(): number;
}

export class WebviewSession {
  /** 확장이 맡긴 epoch — null 이면 지금은 계산을 맡지 않음 */
  private epoch: number | null = null;
  private state: GameState | null = null;
  private dirty = false;
  private lastSentAt = 0;

  constructor(private readonly deps: WebviewSessionDeps) {}

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
        return;
      case 'suspend':
        // VS Code 밖 · 자동 전투 꺼짐 — 마지막 상태를 넘기고 멈춤
        this.hide();
        return;
      case 'stop':
        this.epoch = null;
        this.state = null;
        this.dirty = false;
        return;
    }
  }

  /** 그리기 한 번마다 — 지난 시간만큼 계산하고, 바뀌었으면 1초에 한 번 확장에 보냄 */
  frame(dtMs: number): void {
    if (this.epoch === null || !this.state) return;
    const r = advance(this.state, clampFrameDelta(dtMs));
    this.state = r.state;
    if (r.steps > 0) this.dirty = true;
    if (this.dirty && this.deps.now() - this.lastSentAt >= TIMING.snapshotIntervalMs) {
      this.deps.post({ command: GAME_COMMAND, type: 'state', epoch: this.epoch, state: this.state });
      this.markSent();
    }
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
    this.deps.post({ command: GAME_COMMAND, type: 'hidden', epoch: this.epoch, state: this.state });
    this.epoch = null;
    this.dirty = false;
  }

  /** 다시 보임 (웹뷰가 버려지지 않은 경우) — 확장의 최신 상태를 달라고 함 */
  show(): void {
    this.deps.post({ command: GAME_COMMAND, type: 'ready' });
  }

  private markSent(): void {
    this.dirty = false;
    this.lastSentAt = this.deps.now();
  }
}
