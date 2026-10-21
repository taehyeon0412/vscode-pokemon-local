/**
 * 실제 VS Code 캡처 (기획 R17 — dev/vscode-shot.py 가 run-shot.ts 로 띄움). 확장 쪽에서 돌아 세이브를 넣고 게임에 들어간 뒤,
 * 파이썬이 창을 다 찍을 때까지 그대로 멈춰 있다가 끝냄 (VS Code 가 꺼짐). 사진을 찍는 건 파이썬 (창 크기 · 캡처).
 *   SHOT_DIR      주고받는 폴더 — ready.json 을 쓰고 done 이 생길 때까지 기다림
 *   SHOT_SAVE     넣을 세이브 JSON 경로 (없으면 새 스타팅 세이브)
 *   SHOT_WAIT_MS  게임에 들어간 뒤 찍기 전까지 기다림 (기본 3000)
 *   SHOT_IMPORT   이 세이브 파일로 "불러오기" 를 눌러 확인 상자를 띄운 채 찍음 (파일 창 대신 정해 둔 경로 — orders #49 · #50)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { createStartSave } from '../../game/features/starter/model';
import type { GameTestApi } from '../../game/host/test-api';

const EXT_ID = 'local.vscode-pokemon';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor(what: string, check: () => boolean, timeoutMs = 30_000): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (check()) return;
    await sleep(100);
  }
  throw new Error(`${timeoutMs / 1000}초를 기다려도 안 됨: ${what}`);
}

export async function run(): Promise<void> {
  const dir = process.env.SHOT_DIR;
  if (!dir) throw new Error('SHOT_DIR 이 없음 (dev/vscode-shot.py 로 띄우세요)');
  const ext = vscode.extensions.getExtension(EXT_ID);
  if (!ext) throw new Error(`${EXT_ID} 확장이 없음`);
  const game = ((await ext.activate()) as { game?: GameTestApi } | undefined)?.game;
  if (!game) throw new Error('Test 모드 손잡이(game)가 없음 — node scripts/build.mjs --release --tests');
  await game.ready;
  const savePath = process.env.SHOT_SAVE;
  game.writeStoredRaw(savePath ? (JSON.parse(readFileSync(savePath, 'utf8')) as unknown) : createStartSave(Date.now(), 1));
  await game.reload();
  // 찍을 자리만 — 옆 칸 · 편집기를 닫고 포켓몬 보기 (아래 패널)
  await vscode.commands.executeCommand('workbench.action.closeSidebar');
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  await vscode.commands.executeCommand('pokemonView.focus');
  // 패널을 최대화 — 창 높이 = 패널 높이가 되어 파이썬이 창 높이로 웹뷰 높이를 px 로 맞춤 (패널 높이는 저장값 · 명령 60px 단위로는 못 맞춤)
  await vscode.commands.executeCommand('workbench.action.toggleMaximizedPanel');
  await waitFor('포켓몬 보기 boot', () => game.debug().stats.boots >= 1);
  const r = await game.enterGame();
  if (r !== 'entered') throw new Error(`게임에 못 들어감: ${r}`);
  await waitFor('웹뷰가 게임을 맡음', () => game.debug().owner === 'webview');
  await sleep(Number(process.env.SHOT_WAIT_MS ?? 3000));
  // 세이브 불러오기 확인 상자 (설정 ④ 불러오기를 누른 것처럼 — 파일 창 대신 SHOT_IMPORT)
  if (process.env.SHOT_IMPORT) {
    game.pickFiles({ open: process.env.SHOT_IMPORT });
    game.fromWebview({ command: 'game', type: 'save-import' });
    await sleep(1500);
  }
  // VS Code 알림 ("확장이 잠시 꺼져 있어요" 등) 이 게임을 덮지 않게
  await vscode.commands.executeCommand('notifications.clearAll');
  await sleep(300);
  const d = game.debug();
  writeFileSync(join(dir, 'ready.json'), JSON.stringify({ mode: d.mode, owner: d.owner, progress: d.progress, view: d.view, version: vscode.version }));
  // 파이썬이 다 찍을 때까지 (최대 10분) — 그동안 웹뷰 크기를 view.json 으로 (창 크기를 바꾸면 웹뷰가 알림)
  const end = Date.now() + 600_000;
  let cleared = Date.now();
  while (!existsSync(join(dir, 'done')) && Date.now() < end) {
    if (Date.now() - cleared > 1000) {
      cleared = Date.now();
      void vscode.commands.executeCommand('notifications.clearAll');
    }
    try {
      writeFileSync(join(dir, 'view.json'), JSON.stringify(game.debug().view));
    } catch {
      // 파이썬이 읽는 순간 (윈도우 파일 잠금) — 다음에 다시
    }
    await sleep(150);
  }
}
