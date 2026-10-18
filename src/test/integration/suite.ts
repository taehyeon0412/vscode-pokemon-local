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
import { healed } from '../../game/core/rules/bag';
import { expForLevel } from '../../game/core/rules/stats';
import { createStartSave } from '../../game/features/starter/model';
import type { GameTestApi } from '../../game/host/test-api';

const EXT_ID = 'local.vscode-pokemon';
/** 🎮 (포켓몬 보기 제목줄) · 🏠 (게임 중 제목줄) */
const GAME_COMMAND_ID = 'vscode-pokemon.game-mode';
const NORMAL_COMMAND_ID = 'vscode-pokemon.normal-mode';
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

    ['🎮 · 🏠 명령과 포켓몬 보기 제목줄 버튼이 있음 (🎮 는 게임 빌드가 있을 때 · 게임 중에는 🏠, ＋ 🔀 🗑 는 게임 중에 숨김)', async () => {
      const all = await vscode.commands.getCommands(true);
      assert.ok(all.includes(GAME_COMMAND_ID));
      assert.ok(all.includes(NORMAL_COMMAND_ID));
      const menus = (ext.packageJSON as { contributes?: { menus?: Record<string, { command: string; when?: string }[]> } }).contributes?.menus?.['view/title'] ?? [];
      const when = (c: string) => menus.find((m) => m.command === c)?.when ?? '';
      assert.equal(when(GAME_COMMAND_ID), 'view == pokemonView && vscode-pokemon.gameAvailable && !vscode-pokemon.gameMode');
      assert.equal(when(NORMAL_COMMAND_ID), 'view == pokemonView && vscode-pokemon.gameMode');
      for (const c of ['vscode-pokemon.spawn-pokemon', 'vscode-pokemon.spawn-random-pokemon', 'vscode-pokemon.delete-pokemon']) {
        assert.ok(when(c).includes('!vscode-pokemon.gameMode'), `${c} 는 게임 중에 숨겨야 함`);
      }
    }],

    ['🎮 → 타이틀: 웹뷰가 game.js 를 불러와 준비되면 세이브 요약을 받음 · 일반 모드 웹뷰도 살아 있음', async () => {
      const titles = d().stats.titles;
      await vscode.commands.executeCommand(GAME_COMMAND_ID);
      await waitFor('타이틀 요약을 보냄 (웹뷰 game.js 의 ready 뒤)', () => d().mode === 'title' && d().stats.titles > titles);
      assert.equal(d().owner, 'none', '타이틀에서는 게임이 돌지 않음');
      assert.equal(typeof (await game.probeNormalWebview()), 'string');
    }],

    ['타이틀에서 새로 하기 → 게임 모드 → 웹뷰가 맡음 → 🎮 로 일반 모드 (저장)', async () => {
      game.fromWebview({ command: 'game', type: 'title-new', save: createStartSave(Date.now(), 1) });
      await waitFor('웹뷰가 맡음', () => d().mode === 'game' && d().owner === 'webview');
      await vscode.commands.executeCommand(GAME_COMMAND_ID);
      await waitFor('일반 모드', () => d().mode === 'normal');
      const raw = game.readStoredRaw() as { party?: string[] } | undefined;
      assert.deepEqual(raw?.party, ['m1']);
    }],

    ['스테이지 · 전투 (단계 4 ~ 6): 웹뷰가 자동으로 걷고 (60배) 야생을 만나 기록 · 자동 전투 뒤 계속 걸음 · 확장에 상태가 옴', async () => {
      const save = createStartSave(Date.now(), 1);
      // 자동 전투 — 꺼져 있으면 내 차례에 멈춰 기다림 (S09)
      save.settings.autoBattle = true;
      // 시드 42 = 첫 자리들이 야생 (부탁은 87% 쯤 — 부탁은 고를 때까지 멈추므로 그 전까지만 봄)
      save.stages['forest-1'] = { ...save.stages['forest-1']!, seed: 42, progress: 0 };
      // 지면 S17 패배 화면에서 [다시 시작] 을 기다림 (단계 9) — 숲 1-1 을 지지 않고 걷게 Lv 15 로
      save.monsters.m1 = healed({ ...save.monsters.m1!, level: 15, exp: expForLevel(15) });
      await vscode.commands.executeCommand(GAME_COMMAND_ID);
      await waitFor('타이틀', () => d().mode === 'title');
      game.fromWebview({ command: 'game', type: 'title-new', save });
      await waitFor('웹뷰가 맡음', () => d().mode === 'game' && d().owner === 'webview');
      assert.ok(game.setSpeed(60), '게임 중이면 배속을 바꿀 수 있음');
      await waitFor('야생 두 종 이상 만남 · 진행 12% 넘음', () => d().seen >= 3 && (d().progress ?? 0) > 0.12, 30_000);
      const p = d().progress ?? 0;
      await sleep(3000);
      assert.ok((d().progress ?? 0) > p, '전투 뒤에도 계속 걸음');
      game.setSpeed(1);
      await vscode.commands.executeCommand(GAME_COMMAND_ID);
      await waitFor('일반 모드', () => d().mode === 'normal');
      const raw = game.readStoredRaw() as { dex?: { seen?: number[] }; stages?: Record<string, { progress: number }> } | undefined;
      assert.ok((raw?.dex?.seen?.length ?? 0) >= 3, '만난 종이 세이브에');
      assert.ok((raw?.stages?.['forest-1']?.progress ?? 0) > 0.12, '진행 % 가 세이브에');
    }],

    ['🎮 → 타이틀 → 이어 하기 → 일반 모드 (S06 ⑪ 처럼 웹뷰가 exit)', async () => {
      await vscode.commands.executeCommand(GAME_COMMAND_ID);
      await waitFor('타이틀', () => d().mode === 'title');
      game.fromWebview({ command: 'game', type: 'title-continue' });
      await waitFor('웹뷰가 맡음', () => d().mode === 'game' && d().owner === 'webview');
      game.fromWebview({ command: 'game', type: 'exit', epoch: null, state: null });
      await waitFor('일반 모드', () => d().mode === 'normal');
    }],

    ['게임 중 제목줄 🏠: 웹뷰가 마지막 상태로 답하고 (suspend → hidden) 저장 · 일반 모드', async () => {
      await vscode.commands.executeCommand(GAME_COMMAND_ID);
      await waitFor('타이틀', () => d().mode === 'title');
      game.fromWebview({ command: 'game', type: 'title-continue' });
      await waitFor('웹뷰가 맡음', () => d().mode === 'game' && d().owner === 'webview');
      const accepted = d().stats.accepted;
      const started = Date.now();
      await vscode.commands.executeCommand(NORMAL_COMMAND_ID);
      assert.equal(d().mode, 'normal');
      assert.ok(d().stats.accepted > accepted, '웹뷰의 마지막 상태(hidden)를 받아야 함');
      assert.ok(Date.now() - started < 2000, '답을 받으면 바로 나감');
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
