/**
 * 게임 모드 확장 쪽 시작점 → extension/out/game/host.js
 * 원래 확장(extension.js)의 GAME-PATCH 가 game-loader.js 를 거쳐 activate 를 부른다.
 * 여기서 오류가 나도 game-loader 가 잡아서 일반 모드는 그대로 돈다.
 *
 * 켤 때 하는 일은 작게: 세이브를 읽어 두기만 (쓰기 · 타이머 없음). 웹뷰 쪽 게임 코드(game.js)는 게임 모드일 때만 불러옴.
 * 파일 (모두 VS Code 가 이 확장에 주는 전역 저장 폴더 globalStorageUri 안):
 *   save.json 세이브 · game-window.lock 게임 중인 창 · save-archive/ 보관함
 */
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { join } from 'path';
import * as vscode from 'vscode';
import { GameSession } from './game-session';
import { FileSaveArchive } from './save-archive';
import { FileSaveStorage } from './save-file';
import { SaveStore, type LoadResult } from './save-store';
import { createTestApi, type GameTestApi } from './test-api';
import { connectWebviewView } from './view-port';
import { FileLeaseFile, WindowLease } from './window-lease';

export interface GameHost {
  /** 포켓몬 보기(pokemonView)가 열릴 때 — HTML 을 넣기 전에 부름 */
  attachView(view: vscode.WebviewView): void;
  /** 웹뷰 HTML 에 넣을 게임 불러오기 태그 (포켓몬 보기에만, 빌드가 없으면 빈 글자) */
  webviewHtml(webview: vscode.Webview, nonce: string): string;
  deactivate(): void;
  /** activate 의 반환값 — Test 모드에서만 { game } */
  exports: { game: GameTestApi } | undefined;
}

export function activate(context: vscode.ExtensionContext): GameHost {
  // 기록은 개발 창 · 테스트에서만 ("출력" 패널의 "포켓몬 게임")
  const debug = context.extensionMode !== vscode.ExtensionMode.Production;
  const testMode = context.extensionMode === vscode.ExtensionMode.Test;
  const channel = debug ? vscode.window.createOutputChannel('포켓몬 게임') : undefined;
  if (channel) context.subscriptions.push(channel);
  const log = (m: string) => {
    try {
      channel?.appendLine(`[${new Date().toLocaleTimeString()}] ${m}`);
    } catch {
      // 끌 때 채널이 먼저 닫힘
    }
  };

  const dir = context.globalStorageUri.fsPath;
  const storage = new FileSaveStorage(join(dir, 'save.json'));
  const archive = new FileSaveArchive(join(dir, 'save-archive'));
  // 저장소가 잠기면(다른 창이 씀 등) 세션에 알림 — game 은 바로 아래에서 만들고, 알림은 그 뒤에만 옴
  const store = new SaveStore(storage, archive, { log, verbose: debug, onLock: (reason) => game.onStoreLocked(reason) });
  // 창마다 다른 이름 (확장 쪽 프로세스 + 무작위)
  const lease = new WindowLease(new FileLeaseFile(join(dir, 'game-window.lock')), `${process.pid}-${randomUUID()}`, {
    onLost: () => store.lock('다른 VS Code 창이 게임 모드를 가져감'),
    onError: (e) => log(`창 잠금 파일 오류: ${String(e)}`),
  });
  const game = new GameSession({
    store,
    lease,
    log,
    warn: (m) => void vscode.window.showWarningMessage(m),
    now: () => Date.now(),
    newSeed: () => Math.floor(Math.random() * 0x100000000),
    // 제목줄: 게임 중에는 🎮 대신 🏠, ＋ 🔀 🗑 는 숨김 (게임 화면이 덮고 있어 눌러도 안 보임) — package.json menus 의 when
    onModeChanged: (mode) => void vscode.commands.executeCommand('setContext', 'vscode-pokemon.gameMode', mode !== 'normal'),
  });

  const ready: Promise<LoadResult> = game.init({ readOnly: true }).then((r) => {
    log(`세이브: ${describeLoad(r)}`);
    store.start();
    return r;
  });

  const gameDir = vscode.Uri.joinPath(context.extensionUri, 'media', 'game');
  const hasWebviewBuild = ['boot.js', 'game.js'].every((f) => existsSync(join(context.extensionPath, 'media', 'game', f)));
  let view: vscode.WebviewView | undefined;

  context.subscriptions.push(vscode.window.onDidChangeWindowState((s) => game.onWindowFocusChanged(s.focused)));
  // 🎮 (패널 제목줄, S01 ①) — 포켓몬 보기를 먼저 보이게 하고, 일반 모드면 타이틀 · 아니면 일반 모드로.
  // 게임 중인데 보기가 접혀 있었으면 (명령 팔레트) 보이게만 함 — 나가 버리지 않게
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-pokemon.game-mode', async () => {
      const wasVisible = view?.visible === true;
      await vscode.commands.executeCommand('pokemonView.focus');
      if (!wasVisible && game.currentMode !== 'normal') return;
      await game.toggleGame();
    }),
    // 🏠 (게임 중 제목줄) — 자동저장 후 일반 모드로
    vscode.commands.registerCommand('vscode-pokemon.normal-mode', () => game.exitGame()),
  );
  // 게임 빌드가 있을 때만 🎮 를 보임 (install.py 가 빌드하지 못하면 일반 모드만)
  void vscode.commands.executeCommand('setContext', 'vscode-pokemon.gameAvailable', hasWebviewBuild);
  void vscode.commands.executeCommand('setContext', 'vscode-pokemon.gameMode', false);
  game.onWindowFocusChanged(vscode.window.state.focused);

  let viewConnection: vscode.Disposable | undefined;

  return {
    attachView(v) {
      viewConnection?.dispose();
      view = v;
      viewConnection = connectWebviewView(v, game, log);
    },
    webviewHtml(webview, nonce) {
      if (!hasWebviewBuild || webview !== view?.webview) return '';
      const boot = webview.asWebviewUri(vscode.Uri.joinPath(gameDir, 'boot.js'));
      const src = webview.asWebviewUri(vscode.Uri.joinPath(gameDir, 'game.js'));
      const media = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media'));
      // 포켓몬 크기 설정 (nano · small · medium · large) — 바뀌면 원래 확장이 HTML 을 다시 만들어 여기로 다시 옴
      const size = vscode.workspace.getConfiguration('vscode-pokemon').get<string>('pokemonSize', 'nano');
      const attr = (v: string) => v.replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`);
      return `<script nonce="${nonce}" src="${attr(boot.toString())}" data-game-src="${attr(src.toString())}" data-media="${attr(media.toString())}" data-size="${attr(size)}"></script>`;
    },
    deactivate() {
      // 모두 동기 — VS Code 가 꺼지는 중에도 마지막 저장 · 창 잠금 풀기가 끝남
      viewConnection?.dispose();
      game.dispose();
    },
    exports: testMode ? { game: createTestApi(game, store, storage, archive, ready, () => probeNormalWebview(view)) } : undefined,
  };
}

function describeLoad(r: LoadResult): string {
  switch (r.kind) {
    case 'none':
      return '없음 (처음)';
    case 'ok':
      return `읽음${r.migratedFrom !== null ? ` (${r.migratedFrom}판에서 옮김)` : ''}${r.problems.length > 0 ? ` · ${r.problems.length}곳 고칠 것 있음` : ''}`;
    case 'newer':
      return `더 새 확장의 세이브 (${r.version}판) — 덮어쓰지 않음`;
    case 'broken':
      return `읽지 못함 (${r.reason}) — 게임 모드에 들어갈 때 원본을 보관함에`;
  }
}

/** 테스트용: 원래 확장이 쓰는 'list-pokemon' 을 웹뷰에 보내고 답을 기다림 */
function probeNormalWebview(view: vscode.WebviewView | undefined): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!view) {
      reject(new Error('포켓몬 보기가 아직 없음'));
      return;
    }
    const timer = setTimeout(() => {
      sub.dispose();
      reject(new Error('일반 모드 웹뷰가 10초 동안 답하지 않음'));
    }, 10_000);
    const sub = view.webview.onDidReceiveMessage((m: { command?: string; text?: unknown }) => {
      if (m?.command !== 'list-pokemon') return;
      clearTimeout(timer);
      sub.dispose();
      resolve(m.text);
    });
    void view.webview.postMessage({ command: 'list-pokemon' });
  });
}
