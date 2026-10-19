/**
 * VS Code 웹뷰 API — 한 웹뷰에서 acquireVsCodeApi() 를 한 번만 부를 수 있어서,
 * 원래 확장의 HTML (extension.js GAME-PATCH) 이 한 번 받아 일반 모드에 넘기고 window.pokemonVscodeApi 에도 둔다.
 * 게임 코드에는 postMessage 만 보이게 한다 — setState 를 쓰면 일반 모드의 포켓몬 상태를 덮어쓰게 되므로.
 */
import type { WebviewToHost } from '../shared/messages';

export interface GamePort {
  postMessage(message: WebviewToHost): void;
}

/** boot.js 가 확장에게 받아 game.js 에 넘기는 것 */
export interface GameConfig {
  /** 확장 media 폴더의 웹뷰 주소 (포켓몬 그림: <media>/gen<N>/<모습>/default_walk_8fps.gif) */
  media: string;
  /** 포켓몬 크기 설정: nano · small · medium · large */
  size: string;
  /** game.js 주소 (game.css 를 옆에서 찾음) */
  script: string;
  /** 게임 모드 최소 높이를 바꿈 — 실제 VS Code 테스트에서만 (탐색기 칸이 150px 보다 낮아서). 보통은 없음 = 150px */
  minHeight?: number;
}

declare global {
  interface Window {
    pokemonVscodeApi?: { postMessage(message: unknown): void };
    pokemonGameConfig?: GameConfig;
  }
}

export function getGameConfig(): GameConfig {
  return window.pokemonGameConfig ?? { media: '', size: 'nano', script: '' };
}

export function getGamePort(): GamePort | undefined {
  const api = window.pokemonVscodeApi;
  return api ? { postMessage: (m) => api.postMessage(m) } : undefined;
}
