/** 화면 코드 (.tsx) 의 JSX 글 자리에 \u00a0 같은 글자 바꿈이 없는지 — JSX 글은 바꿔 읽지 않아 "Lv\u00a06" 이 6글자 그대로 그려짐 (2026-10-30 디자인 2725 결과 상자). 글 자리에는 {'\u00a0'} 처럼 중괄호 안 따옴표로. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');
const ESCAPE = /\\(u[0-9a-fA-F]{4}|u\{[0-9a-fA-F]+\}|x[0-9a-fA-F]{2}|[nt])/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return p.endsWith('.tsx') ? [p] : [];
  });
}

describe('JSX 글에 글자 바꿈 없음 (src/game/**/*.tsx)', () => {
  it('JSX 글 마디에 \\u · \\x · \\n · \\t 가 없음', () => {
    const found: string[] = [];
    for (const file of sources(ROOT)) {
      const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const walk = (n: ts.Node): void => {
        if (ts.isJsxText(n) && ESCAPE.test(n.getText(src))) {
          const { line } = src.getLineAndCharacterOfPosition(n.getStart(src));
          found.push(`${relative(ROOT, file)}:${line + 1} ${n.getText(src).trim()}`);
        }
        ts.forEachChild(n, walk);
      };
      walk(src);
    }
    expect(found).toEqual([]);
  });
});
