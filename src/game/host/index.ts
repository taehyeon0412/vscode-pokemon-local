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
import { TeamOut } from './team-out';
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
  // S01 ② 📦 내 포켓몬 꺼내기 — 상태는 이 PC 에만 (setKeysForSync 안 함 — 일반 모드 목록처럼 동기화로 퍼지지 않게)
  //   game 보다 먼저 만듦 (game 의 알림이 teamOut 을 부름) — readSave 는 꺼낼 때만 불려 그때는 game 이 있음
  const TEAM_OUT_KEY = 'vscode-pokemon.game.teamOut';
  const teamOut = new TeamOut({
    post: (m) => {
      try {
        view?.webview.postMessage(m).then(undefined, (e: unknown) => log(`꺼내기 보내기 실패: ${String(e)}`));
      } catch (e) {
        // 보기가 이미 닫힘 (사용자가 숨김) — 다음에 열릴 때 boot 에서 다시 보냄
        log(`꺼내기 보내기 실패: ${String(e)}`);
      }
    },
    readSave: () => game.readSaveForTeam(),
    load: () => context.globalState.get<boolean>(TEAM_OUT_KEY, false) === true,
    store: (on) => void context.globalState.update(TEAM_OUT_KEY, on),
    setContext: (on) => void vscode.commands.executeCommand('setContext', 'vscode-pokemon.teamOut', on),
    info: (m) => void vscode.window.showInformationMessage(m),
  });

  /** 일반 모드로 돌아올 때 팀을 다시 보내야 함 (게임을 했음 · 게임 중에 웹뷰가 새로 떠서 팀이 없어짐) */
  let teamStale = false;
  const game = new GameSession({
    store,
    lease,
    log,
    warn: (m) => void vscode.window.showWarningMessage(m),
    notify: (m) => void vscode.window.showInformationMessage(m),
    now: () => Date.now(),
    newSeed: () => Math.floor(Math.random() * 0x100000000),
    // 제목줄: 게임 중에는 🎮 대신 🏠, ＋ 🔀 🗑 는 숨김 (게임 화면이 덮고 있어 눌러도 안 보임) — package.json menus 의 when
    onModeChanged: (mode) => {
      void vscode.commands.executeCommand('setContext', 'vscode-pokemon.gameMode', mode !== 'normal');
      // 게임에서 돌아오면 꺼낸 팀을 지금 레벨 · 진화 · 기술로 (타이틀만 보고 오면 그대로 — 볼 연출 · 자리를 다시 안 함)
      if (mode === 'game') teamStale = true;
      if (mode === 'normal' && teamStale) {
        teamStale = false;
        void teamOut.refresh();
      }
    },
    // 웹뷰가 새로 뜸 — 일반 모드일 때만 (게임 중 · 타이틀이면 일반 모드 화면이 숨어 있어 볼 연출이 쌓임. 돌아올 때 onModeChanged 가 보냄)
    onWebviewBoot: () => {
      if (game.currentMode === 'normal') void teamOut.refresh();
      else teamStale = true;
    },
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
    // 📦 (S01 ②) — 게임 팀을 일반 모드 포켓몬과 같이 · 다시 누르면 넣음
    vscode.commands.registerCommand('vscode-pokemon.team-out', async () => {
      await vscode.commands.executeCommand('pokemonView.focus');
      await teamOut.takeOut();
    }),
    vscode.commands.registerCommand('vscode-pokemon.team-in', () => teamOut.putIn()),
    // 개발 창 (F5) 에서만 보이는 빨리 감기 — 15분 스테이지를 시험하려고 (사용자 설치본에는 안 보임)
    vscode.commands.registerCommand('vscode-pokemon.game-speed', async () => {
      if (!debug) return; // 사용자 설치본에서는 단축키로 묶어도 아무것도 안 함
      const pick = await vscode.window.showQuickPick(['1', '10', '30', '60'], { placeHolder: '게임 시간 배속 (개발용)' });
      if (pick && !game.setSpeed(Number(pick))) void vscode.window.showInformationMessage('게임 중에만 바꿀 수 있어요');
    }),
  );
  void vscode.commands.executeCommand('setContext', 'vscode-pokemon.gameDev', debug);
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
      // 보기가 아주 닫히면 비움 (닫힌 보기에 보내면 던짐 — 📦 넣기 · 일반 모드로 등)
      v.onDidDispose(() => {
        if (view === v) view = undefined;
      });
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
