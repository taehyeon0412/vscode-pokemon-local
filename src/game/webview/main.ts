/**
 * game.js — 게임 모드 웹뷰 쪽 시작점. boot.js 가 확장의 "load" 를 받고 불러온다.
 * 단계 1: 상태를 받아 계산을 이어 가고 확장에 돌려주는 틀만 (화면은 단계 3부터).
 */
import { GAME_COMMAND, isHostToWebview } from '../shared/messages';
import { FrameLoop } from './frame-loop';
import { getGamePort } from './vscode-api';
import { WebviewSession } from './webview-session';

const port = getGamePort();
if (!port) {
  console.error('[pokemon-game] VS Code API 가 없어요 — extension.js 의 GAME-PATCH 를 확인하세요');
} else {
  const session = new WebviewSession({ post: (m) => port.postMessage(m), now: () => performance.now() });
  // 프레임 오류로 멈추면 마지막 상태를 확장에 넘김 (자동 전투면 확장이 이어 감)
  const loop = new FrameLoop((dt) => session.frame(dt), () => session.hide());

  /** 맡고 있고 보일 때만 돎. 안 보이는데 맡겨졌으면 바로 돌려줌 (확장이 이어 받음) */
  const sync = () => {
    if (session.running && document.hidden) session.hide();
    if (session.running) loop.start();
    else loop.stop();
  };

  window.addEventListener('message', (event: MessageEvent<unknown>) => {
    if (!isHostToWebview(event.data)) return;
    session.handleMessage(event.data);
    sync();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      session.hide();
      sync();
    } else {
      session.show();
    }
  });

  port.postMessage({ command: GAME_COMMAND, type: 'ready' });
}
