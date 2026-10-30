/**
 * 줄인 게임 글꼴 (PG Sans — python dev/font-subset.py · #140 최적화 2026-10-30) 에 코드 · 데이터 · 연출에 나오는 글자가 다 있는지.
 * 새 말을 넣고 글꼴을 다시 안 만들면 그 글자만 다른 글꼴로 그려져 튐 → python dev/font-subset.py (원본에 없는 글자 · 그림 글자는 셈하지 않음)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '../../..');
const SCAN = ['src', 'ult', join('extension', 'media')];
const EXTS = ['.ts', '.tsx', '.js', '.json', '.css', '.html'];
const SKIP = ['node_modules', join('extension', 'media', 'fonts')];

function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (SKIP.some((s) => p.endsWith(s) || p.includes(s + sep))) continue;
    if (statSync(p).isDirectory()) yield* files(p);
    else if (EXTS.some((e) => name.endsWith(e)) && !name.endsWith('.min.js')) yield p;
  }
}

describe('줄인 게임 글꼴 PG Sans (#140)', () => {
  it('코드 · 데이터에 나오는 글자가 줄인 글꼴에 다 있음 (원본 Pretendard 에 있는 글자만 셈)', () => {
    const have = new Set(readFileSync(join(ROOT, 'dev', 'fonts', 'pg-sans-chars.txt'), 'utf8'));
    const orig = new Set(readFileSync(join(ROOT, 'dev', 'fonts', 'pretendard-chars.txt'), 'utf8'));
    const missing = new Set<string>();
    for (const top of SCAN) for (const f of files(join(ROOT, top))) for (const ch of readFileSync(f, 'utf8')) if (orig.has(ch) && !have.has(ch)) missing.add(ch);
    expect([...missing].sort().join('')).toBe('');
  });

  it('줄인 글꼴은 상용 한글 2,350자를 안전망으로 품음 (새 말이 생겨도 거의 다 들어감)', () => {
    const have = new Set(readFileSync(join(ROOT, 'dev', 'fonts', 'pg-sans-chars.txt'), 'utf8'));
    expect([...'가각간갇갈감갑값갓강개객갠갤갬갭갯갰갱갸뀌뷁쀼쓩핥힙'].filter((c) => !have.has(c))).toEqual([]);
  });
});
