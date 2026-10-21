/**
 * 실제 VS Code 캡처 시작 (기획 R17) — dev/vscode-shot.py 가 부름. 사용자 폴더 (설정 · 패널 높이) 는 파이썬이 만들어 SHOT_USER_DIR 로 넘김.
 * VS Code 를 받아 (.vscode-test/) 띄우고 shot-suite.ts 를 돌린다 — 개발 PC 의 VS Code 설정 · 확장 · 저장과 섞이지 않음.
 *   SHOT_USER_DIR  --user-data-dir (파이썬이 settings.json · 패널 높이를 미리 넣음)
 *   SHOT_VERSION   VS Code 버전 (기본 stable — .vscode-test 에 받아 둔 것)
 */
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
  // VS Code 안의 터미널(· Claude Code)에서 돌리면 이 값이 1 이라, 받은 VS Code 가 창 없이 Node 로 떠 버림
  delete process.env.ELECTRON_RUN_AS_NODE;
  const user = process.env.SHOT_USER_DIR;
  if (!user) throw new Error('SHOT_USER_DIR 이 없음 (dev/vscode-shot.py 로 띄우세요)');
  const root = resolve(__dirname, '..');
  const tmp = mkdtempSync(join(tmpdir(), 'pokemon-shot-'));
  // 창 제목으로 파이썬이 찾음 — 파이썬이 정한 임의 이름 (SHOT_NAME, 남은 창 · 탐색기 창과 안 헷갈리게)
  const workspace = join(tmp, process.env.SHOT_NAME || 'pokemon-shot');
  mkdirSync(workspace);
  // 윈도우에서 test-electron 은 셸로 VS Code 를 띄우면서 경로를 따옴표로 감싸지 않음 → 띄어쓰기가 있으면 잘림
  const q = (p: string) => (process.platform === 'win32' ? `"${p}"` : p);
  try {
    await runTests({
      version: process.env.SHOT_VERSION ?? 'stable',
      extensionDevelopmentPath: q(join(root, 'extension')),
      extensionTestsPath: q(join(root, '.test-out', 'shot-suite.cjs')),
      // 실제 사용자와 같은 최소 높이 (테스트 창의 68px 이 아니라 150px) — extension host index.ts
      extensionTestsEnv: { POKEMON_SHOT: '1', SHOT_DIR: process.env.SHOT_DIR ?? '', SHOT_SAVE: process.env.SHOT_SAVE ?? '', SHOT_WAIT_MS: process.env.SHOT_WAIT_MS ?? '' },
      launchArgs: [q(workspace), '--disable-extensions', '--user-data-dir', q(user), '--extensions-dir', q(join(tmp, 'extensions'))],
    });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((e: unknown) => {
  console.error('실제 VS Code 캡처 실패:', e);
  process.exit(1);
});
