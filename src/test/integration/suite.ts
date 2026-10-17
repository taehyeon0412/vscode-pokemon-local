/**
 * 실제 VS Code 안에서 도는 테스트 (확장 쪽에서 실행됨) — 웹뷰 생명주기 · 일반 모드 회귀 · 저장.
 * POKEMON_IT_PHASE=main: 순서대로 이어서 한 판 — 패널 열기 → 게임 모드 → 패널 숨기기 (확장이 이어 계산) → 다시 열기
 *   → 저장 → 일반 모드 → 망가진 세이브 → 끝으로 "저장 안 된 세이브"를 남기고 VS Code 를 끔
 * POKEMON_IT_PHASE=restart: 같은 사용자 폴더로 다시 켜서, 끌 때(deactivate) 쓴 그 세이브가 세이브 파일에 남아 있는지
 */
import * as assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import * as vscode from 'vscode';
import { createNewSave } from '../../game/core/save';
import type { GameTestApi } from '../../game/host/test-api';

const EXT_ID = 'local.vscode-pokemon';
/** 끄기 전에 남기는 표시 돈 */
const SHUTDOWN_MONEY = 4242;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor(what: string, check: () => boolean, timeoutMs = 20_000): Promise<void> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (check()) return;
    await sleep(100);
  }
  throw new Error(`${timeoutMs / 1000}초를 기다려도 안 됨: ${what}`);
}

export async function run(): Promise<void> {
  const ext = vscode.extensions.getExtension(EXT_ID);
  assert.ok(ext, `${EXT_ID} 확장이 없음`);
  const exported = (await ext.activate()) as { game?: GameTestApi } | undefined;
  const game = exported?.game;
  assert.ok(game, 'Test 모드 손잡이(game)가 없음 — npm run build 와 extension.js 의 GAME-PATCH 를 확인');
  await game.ready;
  const d = () => game.debug();

  if (process.env.POKEMON_IT_PHASE === 'restart') {
    await runAll([
      // 세이브는 파일이라 끄는 중에도 동기로 써짐 (globalState 는 끌 때 쓰기가 끝나지 않았음 — bugs.md #10)
      ['VS Code 를 껐다 켜도 끄기 직전 저장 안 된 세이브가 이어짐', async () => {
        assert.equal(d().load, 'ok');
        assert.equal(d().money, SHUTDOWN_MONEY);
      }],
      ['망가진 세이브 원본은 보관함 파일로 남아 있음', async () => {
        assert.ok((await game.archiveCount()) >= 1);
      }],
    ]);
    return;
  }

  const tests: [string, () => Promise<void>][] = [
    ['일반 모드 명령이 그대로 있음', async () => {
      const all = await vscode.commands.getCommands(true);
      for (const c of ['vscode-pokemon.start', 'vscode-pokemon.spawn-pokemon', 'vscode-pokemon.spawn-random-pokemon', 'vscode-pokemon.delete-pokemon', 'vscode-pokemon.settings-menu']) {
        assert.ok(all.includes(c), `${c} 명령이 없음`);
      }
    }],

    ['포켓몬 보기를 열면 일반 모드가 돌고, 게임 boot 신호도 옴', async () => {
      await vscode.commands.executeCommand('pokemonView.focus');
      await waitFor('boot 신호', () => d().stats.boots >= 1);
      const list = await game.probeNormalWebview();
      assert.equal(typeof list, 'string', '일반 모드 웹뷰가 포켓몬 목록으로 답해야 함');
      assert.equal(d().mode, 'normal');
    }],

    ['게임 모드: 웹뷰가 game.js 를 불러와 계산을 맡고 상태를 돌려줌', async () => {
      const save = createNewSave(Date.now());
      save.settings.autoBattle = true;
      await game.startNewSave(save);
      assert.equal(await game.enterGame(), 'entered');
      await waitFor('웹뷰가 맡음', () => d().owner === 'webview');
      await waitFor('웹뷰가 보낸 상태', () => d().stats.accepted >= 1 && (d().playTimeMs ?? 0) > 0, 10_000);
    }],

    ['패널을 숨기면 확장이 넘겨받아 계속 계산 (자동 전투)', async () => {
      await vscode.commands.executeCommand('workbench.action.toggleSidebarVisibility');
      await waitFor('확장이 넘겨받음', () => d().owner === 'host');
      assert.equal(d().running, true, '자동 전투라 확장이 계산해야 함');
      const t0 = d().playTimeMs ?? 0;
      await sleep(1500);
      assert.ok((d().playTimeMs ?? 0) >= t0 + 1000, `안 보이는 동안 시간이 흘러야 함 (${t0} → ${String(d().playTimeMs)})`);
    }],

    ['다시 열면 웹뷰가 새로 떠서 확장 상태를 받아 이어 감 · 일반 모드도 그대로', async () => {
      const before = d().playTimeMs ?? 0;
      const epoch = d().epoch;
      await vscode.commands.executeCommand('pokemonView.focus');
      await waitFor('웹뷰가 다시 맡음', () => d().owner === 'webview' && d().epoch > epoch);
      assert.equal(d().running, false, '확장 계산은 멈춰야 함');
      const accepted = d().stats.accepted;
      await waitFor('새 웹뷰가 보낸 상태', () => d().stats.accepted > accepted, 10_000);
      assert.ok((d().playTimeMs ?? 0) >= before, `시간이 되돌아가면 안 됨 (${before} → ${String(d().playTimeMs)})`);
      assert.equal(typeof (await game.probeNormalWebview()), 'string');
    }],

    ['저장: 세이브 파일에 1판 세이브', async () => {
      await game.flush();
      const raw = game.readStoredRaw() as { version?: number; playTimeMs?: number } | undefined;
      assert.equal(raw?.version, 1);
      assert.ok((raw?.playTimeMs ?? 0) > 0);
    }],

    ['일반 모드로 나가면 저장하고 멈춤', async () => {
      await game.exitGame();
      assert.equal(d().mode, 'normal');
      assert.equal(d().owner, 'none');
    }],

    ['망가진 세이브는 보관하고 게임 모드에 들어가지 않음, 일반 모드는 그대로', async () => {
      game.writeStoredRaw({ version: 1, monsters: 'oops' });
      const r = await game.reload();
      assert.equal(r.kind, 'broken');
      assert.equal(await game.enterGame(), 'no-save');
      assert.ok((await game.archiveCount()) >= 1, '게임 모드에 들어가려 할 때 원본을 보관함에');
      await vscode.commands.executeCommand('vscode-pokemon.spawn-random-pokemon');
      assert.equal(typeof (await game.probeNormalWebview()), 'string');
    }],

    ['끄기 전: 게임 모드에서 저장 안 된 세이브를 남김 (다음 실행에서 확인)', async () => {
      assert.equal(await game.startNewSave(createNewSave(Date.now())), 'done');
      assert.equal(await game.enterGame(), 'entered');
      assert.ok(game.queueUnsaved({ money: SHUTDOWN_MONEY }), '게임 모드여야 세이브를 바꿈');
      assert.notEqual((game.readStoredRaw() as { money?: number }).money, SHUTDOWN_MONEY);
    }],
  ];

  await runAll(tests);
  // 테스트가 끝나면 테스트 도구가 VS Code 를 강제로 끄므로 (deactivate 없음) →
  // 사람이 끄는 것처럼 정상 종료(quit)해서 deactivate 의 마지막 저장이 실제로 일어나게 하고, 다음 실행에서 확인.
  // 정상 종료는 테스트 도구가 실패(코드 1)로 보므로, 다 통과했다는 표시 파일을 남김 (run-integration.ts 가 확인)
  const marker = process.env.POKEMON_IT_MARKER;
  if (marker) writeFileSync(marker, 'ok');
  void vscode.commands.executeCommand('workbench.action.quit');
  await new Promise<never>(() => undefined);
}

async function runAll(tests: [string, () => Promise<void>][]): Promise<void> {
  let failed = 0;
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
    } catch (e) {
      failed++;
      console.error(`  ✗ ${name}\n`, e);
    }
  }
  console.log(`실제 VS Code 테스트: ${tests.length - failed}/${tests.length} 통과`);
  if (failed > 0) throw new Error(`${failed}개 실패`);
}
