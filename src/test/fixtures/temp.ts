/**
 * 테스트 임시 폴더 — 만든 테스트 파일이 끝나면 지움 (#141 — mkdtempSync 만 하고 안 지워 %TEMP% 에 pokemon-* 가 쌓이던 것).
 * 테스트에서 임시 폴더는 이것으로만 만든다 (test/unit/temp-cleanup.test 가 mkdtempSync 를 찾음).
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll } from 'vitest';

const made: string[] = [];
afterAll(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
});

export function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  made.push(dir);
  return dir;
}
