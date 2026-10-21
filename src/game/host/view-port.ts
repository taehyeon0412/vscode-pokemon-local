/** VS Code 의 WebviewView ↔ GameSession 연결 (세션은 VS Code 를 모르게 이 파일만 VS Code 를 앎) */
import type * as vscode from 'vscode';
import type { GameSession } from './game-session';

export function connectWebviewView(view: vscode.WebviewView, session: GameSession, log: (m: string) => void): vscode.Disposable {
  session.attachView({
    post(message) {
      try {
        view.webview.postMessage(message).then(undefined, (e: unknown) => log(`웹뷰로 보내기 실패: ${String(e)}`));
      } catch (e) {
        // 보기가 닫힌 뒤에 보내면 던짐 — 세션은 detachView 로 곧 알게 됨
        log(`웹뷰로 보내기 실패: ${String(e)}`);
      }
    },
    get visible() {
      return view.visible;
    },
    badge(count, tooltip) {
      // 포켓몬 탭 배지 (안 볼 때 기다리는 장면 — gdd 4.13 R13, 다시 보면 지움)
      try {
        view.badge = count > 0 ? { value: count, tooltip: tooltip ?? '' } : undefined;
      } catch (e) {
        log(`탭 배지를 못 바꿈: ${String(e)}`);
      }
    },
  });
  const subs = [
    view.webview.onDidReceiveMessage((m: unknown) => session.handleMessage(m)),
    view.onDidChangeVisibility(() => session.onVisibilityChanged(view.visible)),
    view.onDidDispose(() => session.detachView()),
  ];
  return { dispose: () => subs.forEach((s) => s.dispose()) };
}
