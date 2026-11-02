/**
 * %TEMP% 에 쌓이지 않게 (#141 — 2026-11-02 태현 님 "%temp%에 엄청나게 많은 임시 파일들이 생기는데")
 * - 테스트 임시 폴더는 mkdtempSync 를 바로 쓰지 않고 test/fixtures/temp 의 tempDir 로 (안 지운 pokemon-archive · save · lease · loader)
 * - dev 도구의 머리 없는 브라우저는 game-shots.py headless_flags() 로만 띄움 (Edge 부품 받기 · 풀기 — msedge_url_fetcher · Unpacker · scoped_dir · crx .tmp)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const DEV = join(ROOT, '..', 'dev');

function tests(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return tests(p);
    return /\.test\.tsx?$/.test(p) ? [p] : [];
  });
}

describe('%TEMP% 에 남기지 않음', () => {
  it('테스트 파일에 mkdtemp · mkdtempSync 부름이 없음 (tempDir 로만)', () => {
    const found = tests(ROOT).filter((file) => file !== __filename && /\bmkdtemp(Sync)?\(/.test(readFileSync(file, 'utf8')));
    expect(found.map((file) => relative(ROOT, file))).toEqual([]);
  });

  it('dev 도구는 headless_flags() 로만 머리 없는 브라우저를 띄움', () => {
    const tools = readdirSync(DEV).filter((name) => name.endsWith('.py'));
    const own = tools.filter((name) => name !== 'game-shots.py' && /["']--headless=/.test(readFileSync(join(DEV, name), 'utf8')));
    expect(own).toEqual([]);
    const flags = readFileSync(join(DEV, 'game-shots.py'), 'utf8').match(/def headless_flags\(\):[\s\S]*?return (\[.*\])/)?.[1] ?? '';
    expect(flags).toContain('--disable-component-update');
    expect(flags).toContain('--disable-background-networking');
  });
});
