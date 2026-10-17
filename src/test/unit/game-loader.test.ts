/**
 * extension/out/extension/game-loader.js (원래 확장 쪽 GAME-PATCH) —
 * 게임 빌드가 없거나 게임 코드가 던져도 일반 모드가 그대로인지.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { loadGame } = require('../../../extension/out/extension/game-loader.js') as {
  loadGame: (context: { extensionPath: string }, options?: { hostPath?: string; log?: (...a: unknown[]) => void }) => LoadedGame | undefined;
};

interface LoadedGame {
  attachView(view: unknown): unknown;
  webviewHtml(webview: unknown, nonce: string): string;
  deactivate(): Promise<unknown> | unknown;
  exports: unknown;
}

const dir = mkdtempSync(join(tmpdir(), 'pokemon-loader-'));
function fakeHost(name: string, body: string): string {
  const p = join(dir, `${name}.js`);
  writeFileSync(p, body);
  return p;
}

describe('게임 불러오기 (game-loader.js)', () => {
  it('게임 빌드가 없으면 조용히 없음 → 일반 모드만', () => {
    expect(loadGame({ extensionPath: dir })).toBeUndefined();
  });

  it('게임의 activate 가 던지면 없음으로 · 기록만 남김', () => {
    const logs: unknown[] = [];
    const hostPath = fakeHost('throws', 'exports.activate = () => { throw new Error("boom"); };');
    expect(loadGame({ extensionPath: dir }, { hostPath, log: (...a) => logs.push(a) })).toBeUndefined();
    expect(logs).toHaveLength(1);
  });

  it('activate 가 아무것도 안 돌려주면 없음으로', () => {
    const hostPath = fakeHost('returns-null', 'exports.activate = () => null;');
    expect(loadGame({ extensionPath: dir }, { hostPath, log: () => undefined })).toBeUndefined();
  });

  it('게임 함수가 던지거나 실패해도 밖으로 안 번짐', async () => {
    const hostPath = fakeHost(
      'bad-methods',
      `exports.activate = () => ({
        attachView() { throw new Error('a'); },
        webviewHtml() { throw new Error('b'); },
        deactivate() { return Promise.reject(new Error('c')); },
        exports: { game: 1 },
      });`,
    );
    const game = loadGame({ extensionPath: dir }, { hostPath, log: () => undefined })!;
    expect(() => game.attachView({})).not.toThrow();
    expect(game.webviewHtml({}, 'n')).toBe('');
    await expect(game.deactivate()).resolves.toBeUndefined();
    expect(game.exports).toEqual({ game: 1 });
  });

  it('잘 되면 그대로 전달', () => {
    const hostPath = fakeHost('ok', `exports.activate = (ctx) => ({ attachView() {}, webviewHtml(w, n) { return '<script nonce="' + n + '">'; }, deactivate() {}, exports: undefined });`);
    const game = loadGame({ extensionPath: dir }, { hostPath })!;
    expect(game.webviewHtml({}, 'abc')).toBe('<script nonce="abc">');
  });
});
