/**
 * 확장 ↔ 웹뷰 메시지 (게임 모드).
 * 원래 확장의 메시지({ command: 'spawn-pokemon' } 등)와 섞이지 않게 command 는 늘 'game'.
 *
 * 흐름 (src/game/README.md "웹뷰 생명주기"):
 *   웹뷰가 뜸 ── boot ──▶ 확장 ── load (게임 모드일 때만) ──▶ boot.js 가 game.js 를 불러옴
 *   game.js ── ready ──▶ 확장 ── start (epoch · 상태) ──▶ 웹뷰가 계산 · 그리기를 맡음
 *   웹뷰 ── state (1초마다, 바뀌었을 때) · save-now (잡기 · 전투 끝 등) ──▶ 확장이 저장
 *   웹뷰가 안 보임 ── hidden (마지막 상태) ──▶ 확장이 이어서 계산 (자동 전투일 때만)
 *   VS Code 밖 (창 포커스를 잃음) · 자동 전투 꺼짐 ── 확장 ── suspend ──▶ 웹뷰가 hidden 으로 답하고 멈춤
 * epoch: 상태를 맡는 쪽이 바뀔 때마다 1씩 늘어남. 지난 epoch 의 메시지는 버린다 (늦게 온 옛 상태가 덮어쓰지 않게).
 *   단, 확장이 넘겨받기 바로 전 epoch 의 메시지는 받아 줌 (패널을 접는 순간의 잡기 · 마지막 상태를 잃지 않게).
 */
import type { GameState } from '../core/engine';

export const GAME_COMMAND = 'game';

/** 바로 저장하는 까닭 (mvp-spec 3.1) */
export const SAVE_REASONS = ['catch', 'battle-end', 'stage-clear', 'mode-change', 'new-game'] as const;
export type SaveReason = (typeof SAVE_REASONS)[number];

export type WebviewToHost =
  | { command: typeof GAME_COMMAND; type: 'boot' }
  | { command: typeof GAME_COMMAND; type: 'ready' }
  | { command: typeof GAME_COMMAND; type: 'state'; epoch: number; state: GameState }
  | { command: typeof GAME_COMMAND; type: 'save-now'; epoch: number; reason: SaveReason; state: GameState }
  | { command: typeof GAME_COMMAND; type: 'hidden'; epoch: number; state: GameState }
  | { command: typeof GAME_COMMAND; type: 'load-failed'; message: string };

export type HostToWebview =
  | { command: typeof GAME_COMMAND; type: 'load' }
  | { command: typeof GAME_COMMAND; type: 'start'; epoch: number; state: GameState }
  | { command: typeof GAME_COMMAND; type: 'suspend' }
  | { command: typeof GAME_COMMAND; type: 'stop' };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const hasState = (m: Obj): boolean =>
  typeof m.epoch === 'number' && isObj(m.state) && isObj(m.state.save) && isObj(m.state.runtime);

/** 웹뷰에서 온 메시지가 게임 메시지 모양인지 (상태 안쪽은 받는 쪽이 validateSave 로 다시 검사) */
export function isWebviewToHost(v: unknown): v is WebviewToHost {
  if (!isObj(v) || v.command !== GAME_COMMAND) return false;
  switch (v.type) {
    case 'boot':
    case 'ready':
      return true;
    case 'state':
    case 'hidden':
      return hasState(v);
    case 'save-now':
      return hasState(v) && (SAVE_REASONS as readonly unknown[]).includes(v.reason);
    case 'load-failed':
      return typeof v.message === 'string';
    default:
      return false;
  }
}

export function isHostToWebview(v: unknown): v is HostToWebview {
  if (!isObj(v) || v.command !== GAME_COMMAND) return false;
  switch (v.type) {
    case 'load':
    case 'suspend':
    case 'stop':
      return true;
    case 'start':
      return hasState(v);
    default:
      return false;
  }
}
