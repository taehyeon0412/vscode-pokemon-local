/**
 * boot.js — 포켓몬 보기가 뜰 때마다 불러오는 작은 파일 (일반 모드에서도).
 * 게임 코드(game.js)는 확장이 "load" 라고 할 때만 불러온다 → 일반 모드만 쓰는 사람에게는 게임 코드가 안 올라감.
 */
import { GAME_COMMAND, isHostToWebview } from '../shared/messages';
import { getGamePort } from './vscode-api';

const me = document.currentScript as HTMLScriptElement | null;
const gameSrc = me?.dataset.gameSrc;
const nonce = me?.nonce;
const port = getGamePort();
const minHeight = Number(me?.dataset.minHeight);
window.pokemonGameConfig = {
  media: me?.dataset.media ?? '',
  size: me?.dataset.size ?? 'nano',
  script: gameSrc ?? '',
  ...(minHeight > 0 ? { minHeight } : {}),
};
let requested = false;

window.addEventListener('message', (event: MessageEvent<unknown>) => {
  const m = event.data;
  if (!isHostToWebview(m) || m.type !== 'load' || requested || !gameSrc) return;
  requested = true;
  const script = document.createElement('script');
  script.src = gameSrc;
  if (nonce) script.nonce = nonce; // 웹뷰 보안 규칙(CSP)이 같은 nonce 의 스크립트만 허용
  script.onerror = () => {
    // 다음 load 때 다시 시도할 수 있게
    requested = false;
    script.remove();
    port?.postMessage({ command: GAME_COMMAND, type: 'load-failed', message: `game.js 를 불러오지 못함 (${gameSrc})` });
  };
  document.body.appendChild(script);
});

port?.postMessage({ command: GAME_COMMAND, type: 'boot' });
