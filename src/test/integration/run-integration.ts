/**
 * 실제 VS Code 테스트 시작 — VS Code 를 받아(.vscode-test/) 따로 된 사용자 폴더로 띄우고 suite.ts 를 돌린다.
 * 개발 PC 의 VS Code 설정 · 확장 · 저장(globalState)과는 섞이지 않음 (--user-data-dir · --extensions-dir 을 임시 폴더로).
 * 두 번 띄움: 1) 한 판 테스트 + 끄기 전에 저장 안 된 세이브를 남김  2) 같은 사용자 폴더로 다시 켜서 끌 때 저장됐는지
 *
 *   npm run test:integration                              최신 VS Code
 *   VSCODE_TEST_VERSION=1.73.0 npm run test:integration   가장 낮은 지원 버전 (package.json engines)
 */
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
  // VS Code 안의 터미널(· Claude Code)에서 돌리면 이 값이 1 이라, 받은 VS Code 가 창 없이 Node 로 떠 버림
  delete process.env.ELECTRON_RUN_AS_NODE;
  const root = resolve(__dirname, '..');
  const tmp = mkdtempSync(join(tmpdir(), 'pokemon-it-'));
  const workspace = join(tmp, 'workspace');
  mkdirSync(workspace);
  // 윈도우에서 test-electron 은 셸로 VS Code 를 띄우면서 경로를 따옴표로 감싸지 않음 → "코딩 공부" 처럼 띄어쓰기가 있으면 잘림
  const q = (p: string) => (process.platform === 'win32' ? `"${p}"` : p);
  // 첫 실행은 끝에 VS Code 를 정상 종료하는데, 테스트 도구는 그걸 실패(코드 1)로 봄 → 다 통과했다는 표시 파일로 가림
  const marker = join(tmp, 'main-passed');
  const run = (phase: 'main' | 'restart') =>
    runTests({
      version: process.env.VSCODE_TEST_VERSION ?? 'stable',
      extensionDevelopmentPath: q(join(root, 'extension')),
      extensionTestsPath: q(join(root, '.test-out', 'integration-suite.cjs')),
      extensionTestsEnv: { POKEMON_IT_PHASE: phase, POKEMON_IT_MARKER: marker },
      launchArgs: [
        q(workspace),
        '--disable-extensions',
        '--user-data-dir', q(join(tmp, 'user')),
        '--extensions-dir', q(join(tmp, 'extensions')),
      ],
    });
  try {
    try {
      await run('main');
    } catch (e) {
      if (!existsSync(marker)) throw e;
    }
    await run('restart');
  } finally {
    // POKEMON_IT_KEEP=1 이면 사용자 폴더를 남겨 둠 (저장소를 직접 들여다볼 때)
    if (process.env.POKEMON_IT_KEEP) console.log(`사용자 폴더를 남김: ${tmp}`);
    else rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((e: unknown) => {
  console.error('실제 VS Code 테스트 실패:', e);
  process.exit(1);
});
