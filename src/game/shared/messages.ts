/**
 * 확장 ↔ 웹뷰 메시지 (게임 모드).
 * 원래 확장의 메시지({ command: 'spawn-pokemon' } 등)와 섞이지 않게 command 는 늘 'game'.
 *
 * 흐름 (src/game/README.md "웹뷰 생명주기"):
 *   🎮 ── 확장 ── load ──▶ game.js ── ready ──▶ 확장 ── title (세이브 요약) ──▶ S02 타이틀
 *   S02 ── title-new (새 세이브) · title-continue ──▶ 확장이 게임 모드로 → start
 *   일반 모드로 (S02 ③ · S06 ⑪) ── exit (마지막 상태) ──▶ 확장이 저장 → stop
 *   🎮 · 🏠 (제목줄) 로 게임에서 나감 ── 확장 ── suspend ──▶ 웹뷰가 hidden (마지막 상태) ──▶ 저장 → stop (0.5초 안에 답이 없으면 확장 상태로)
 *   웹뷰가 뜸 ── boot ──▶ 확장 ── load (게임 모드일 때만) ──▶ boot.js 가 game.js 를 불러옴
 *   game.js ── ready ──▶ 확장 ── start (epoch · 상태) ──▶ 웹뷰가 계산 · 그리기를 맡음
 *   웹뷰 ── state (1초마다, 바뀌었을 때) · save-now (잡기 · 전투 끝 등) ──▶ 확장이 저장
 *   웹뷰가 안 보임 ── hidden (마지막 상태) ──▶ 확장이 이어서 계산 (자동 전투일 때만)
 *   VS Code 밖 (창 포커스를 잃음) · 자동 전투 꺼짐 ── 확장 ── suspend ──▶ 웹뷰가 hidden 으로 답하고 멈춤
 * epoch: 상태를 맡는 쪽이 바뀔 때마다 1씩 늘어남. 지난 epoch 의 메시지는 버린다 (늦게 온 옛 상태가 덮어쓰지 않게).
 *   단, 확장이 넘겨받기 바로 전 epoch 의 메시지는 받아 줌 (패널을 접는 순간의 잡기 · 마지막 상태를 잃지 않게).
 */
// 값은 가져오는 것이 없는 파일에서만 — 이 파일은 boot.js (일반 모드에서도 읽힘) 에 들어감 (eslint 가 막음)
import { GAME_NOTICES, type GameNotice } from '../core/engine/notices';
import type { GameState } from '../core/engine';
import type { Save } from '../core/save';

export const GAME_COMMAND = 'game';

/** 바로 저장하는 까닭 (mvp-spec 3.1) */
export const SAVE_REASONS = ['catch', 'battle-end', 'stage-clear', 'mode-change', 'new-game'] as const;
export type SaveReason = (typeof SAVE_REASONS)[number];

/** 타이틀에서 방금 누른 것이 안 된 까닭 — 문구는 features/title/model.ts 한 곳에서 */
/** no-answer = 웹뷰가 보낸 것 (확장이 5초 안에 답하지 않음 — 다시 로드 안 한 옛 확장 + 새 웹뷰, #77) */
export const TITLE_NOTICES = ['busy', 'no-save', 'locked', 'write-failed', 'bad-save', 'no-answer'] as const;
export type TitleNotice = (typeof TITLE_NOTICES)[number];

/** 타이틀(S02)에 보일 것 — 세이브가 어떤지 · 다른 창이 게임 중인지 · 요약 */
export interface TitleInfo {
  save: 'none' | 'ok' | 'broken' | 'newer';
  /** 다른 VS Code 창이 게임 중 (새로 하기 · 이어 하기를 막음 — 그 창이 끝나면 확장이 다시 보냄) */
  busy: boolean;
  /** where = 어디서 ("1-1 · 37%" · "전투 중" · "체육관" — 2026-10-21 ideas #6, 옛 확장엔 없음) · daily = 오늘의 목표 끝낸 수 / 전체 (#28 — 켜졌고 오늘 것일 때만) */
  summary: { playTimeMs: number; money: number; badges: string[]; lead: { form: string; species: number; level: number } | null; where?: string; daily?: { done: number; total: number } } | null;
  notice?: TitleNotice;
}

export type WebviewToHost =
  | { command: typeof GAME_COMMAND; type: 'boot' }
  | { command: typeof GAME_COMMAND; type: 'ready' }
  | { command: typeof GAME_COMMAND; type: 'state'; epoch: number; state: GameState }
  | { command: typeof GAME_COMMAND; type: 'save-now'; epoch: number; reason: SaveReason; state: GameState }
  /** collapsed = 패널이 게임 모드 최소 높이보다 낮아서 넘김 (보이기는 함) — 확장은 접힌 동안 다시 맡기지 않고 알림 문구를 "올리면" 으로 (#297 · #299) */
  | { command: typeof GAME_COMMAND; type: 'hidden'; epoch: number; state: GameState; collapsed?: boolean }
  | { command: typeof GAME_COMMAND; type: 'load-failed'; message: string }
  | { command: typeof GAME_COMMAND; type: 'title-new'; save: Save }
  | { command: typeof GAME_COMMAND; type: 'title-continue' }
  /** 개발 모드 (임시, gdd 8장 · S02 ④) — 저장하지 않는 게임으로 · 끝내기 (타이틀로) */
  | { command: typeof GAME_COMMAND; type: 'title-dev' }
  | { command: typeof GAME_COMMAND; type: 'dev-end' }
  /** 일반 모드로 — 게임 중이면 마지막 상태도 (epoch 는 맡은 것, 없으면 null) */
  | { command: typeof GAME_COMMAND; type: 'exit'; epoch: number | null; state: GameState | null }
  /** 세이브 내보내기 · 가져오기 (U6 · S20 ④, orders #33) — 파일 창은 확장이 열고, 불러오기는 확인 (confirm) 뒤에 덮어씀 */
  | { command: typeof GAME_COMMAND; type: 'save-export' | 'save-import' | 'save-import-confirm' | 'save-import-cancel' }
  /** 웹뷰가 계산하다 생긴 알림 (VS Code 에 포커스가 없을 때 이로치 흔적 — 2026-10-19) → 확장이 VS Code 알림으로 */
  | { command: typeof GAME_COMMAND; type: 'notice'; epoch: number; notice: GameNotice };

export type HostToWebview =
  | { command: typeof GAME_COMMAND; type: 'load' }
  | { command: typeof GAME_COMMAND; type: 'start'; epoch: number; state: GameState }
  | { command: typeof GAME_COMMAND; type: 'suspend' }
  /** VS Code 창 포커스 — 없으면 (패널은 보임) 웹뷰가 이로치 흔적 앞에서 멈추고 알림 (2026-10-19) */
  | { command: typeof GAME_COMMAND; type: 'focus'; focused: boolean }
  | { command: typeof GAME_COMMAND; type: 'title'; info: TitleInfo }
  /** 접힌 동안 (150px 아래 — 확장이 계산) 지금 상태 — 접힌 줄이 그때 모습 그대로 멈춰 있지 않게 (gdd 4.13 R13, 1초에 한 번까지) */
  | { command: typeof GAME_COMMAND; type: 'peek'; state: GameState }
  /** 불러올 세이브 확인 — 한 줄 요약 (타이틀 요약과 같은 모양) · 못 읽으면 error (orders #33) */
  /** fixes = 읽으며 고친 곳 수 · lost = 빠진 포켓몬 수 (확인 상자에 — 코드 리뷰어 #48) */
  | { command: typeof GAME_COMMAND; type: 'save-import-ask'; name?: string; summary?: TitleInfo['summary']; error?: string; fixes?: number; lost?: number }
  /** 내보내기 · 불러오기 결과 한 줄 (취소면 안 보냄) */
  | { command: typeof GAME_COMMAND; type: 'save-result'; ok: boolean; text: string }
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
    case 'title-new':
      return isObj(v.save);
    case 'title-continue':
    case 'title-dev':
    case 'dev-end':
    case 'save-export':
    case 'save-import':
    case 'save-import-confirm':
    case 'save-import-cancel':
      return true;
    case 'exit':
      return (v.epoch === null || typeof v.epoch === 'number') && (v.state === null || (isObj(v.state) && isObj(v.state.save)));
    case 'notice':
      return typeof v.epoch === 'number' && (GAME_NOTICES as readonly unknown[]).includes(v.notice);
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
    case 'focus':
      return typeof v.focused === 'boolean';
    case 'start':
      return hasState(v);
    case 'peek':
      return isObj(v.state) && isObj(v.state.save) && isObj(v.state.runtime);
    case 'save-import-ask':
      return (
        (v.name === undefined || typeof v.name === 'string') &&
        (v.error === undefined || typeof v.error === 'string') &&
        (v.summary === undefined || v.summary === null || isObj(v.summary)) &&
        (v.fixes === undefined || typeof v.fixes === 'number') &&
        (v.lost === undefined || typeof v.lost === 'number')
      );
    case 'save-result':
      return typeof v.ok === 'boolean' && typeof v.text === 'string';
    case 'title':
      return (
        isObj(v.info) &&
        typeof v.info.save === 'string' &&
        typeof v.info.busy === 'boolean' &&
        (v.info.notice === undefined || (TITLE_NOTICES as readonly unknown[]).includes(v.info.notice))
      );
    default:
      return false;
  }
}
