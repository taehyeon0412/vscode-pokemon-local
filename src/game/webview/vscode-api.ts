/**
 * VS Code 웹뷰 API — 한 웹뷰에서 acquireVsCodeApi() 를 한 번만 부를 수 있어서,
 * 원래 확장의 HTML (extension.js GAME-PATCH) 이 한 번 받아 일반 모드에 넘기고 window.pokemonVscodeApi 에도 둔다.
 * 게임 코드에는 postMessage 만 보이게 한다 — setState 를 쓰면 일반 모드의 포켓몬 상태를 덮어쓰게 되므로.
 */
import type { WebviewToHost } from '../shared/messages';

export interface GamePort {
  postMessage(message: WebviewToHost): void;
}

declare global {
  interface Window {
    pokemonVscodeApi?: { postMessage(message: unknown): void };
  }
}

export function getGamePort(): GamePort | undefined {
  const api = window.pokemonVscodeApi;
  return api ? { postMessage: (m) => api.postMessage(m) } : undefined;
}
