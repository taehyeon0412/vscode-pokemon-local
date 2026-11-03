/**
 * 찍기 · 재기 도구가 옛 빌드를 쓰지 않게 (bugs 1937 · 783 B 2026-11-03) — 도구들은 빌드를 안 해 TS 를 고친 뒤에도 옛 game.js 로
 * 전 · 후 판 · perf-guard 를 찍던 것. 시험 서버를 여는 곳 (game-shots serve · 따로 서버를 여는 도구) 은 서버를 열기 전에 build_check.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DEV = join(__dirname, '..', '..', '..', 'dev');
const read = (name: string) => readFileSync(join(DEV, name), 'utf8');

describe('dev 도구 빌드 확인', () => {
  it('game-shots serve() 는 서버를 열기 전에 build_check() (team-run · cdp-frames · perf-guard 등이 같이 씀)', () => {
    const src = read('game-shots.py');
    const body = src.slice(src.indexOf('def serve():'));
    expect(body.indexOf('build_check()')).toBeGreaterThan(0);
    expect(body.indexOf('build_check()')).toBeLessThan(body.indexOf('Server(('));
  });

  it('따로 서버를 여는 도구도 build_check', () => {
    const own = readdirSync(DEV).filter((name) => name.endsWith('.py') && name !== 'game-shots.py' && read(name).includes('HTTPServer(('));
    expect(own.length).toBeGreaterThan(0);
    expect(own.filter((name) => !read(name).includes('build_check('))).toEqual([]);
  });
});
