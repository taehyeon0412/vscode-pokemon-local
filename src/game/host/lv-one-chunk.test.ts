/** "이름 Lv N" 은 한 덩이 — Lv 뒤를 붙여 쓴 곳 (Lv\u00a0N) 은 앞도 붙여 씀. 앞이 보통 띄어쓰기면 좁은 줄에서 "독침붕 / Lv 11" 로 끊김 (2026-10-30 디자인 2726 결과 상자 300 × 150 맥). 끊을 곳은 " · " 뒤만. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');
// 소스 글 그대로의 " Lv\u00a0" 와 진짜 붙임 글자로 쓴 " Lv" + U+00A0 둘 다
const LOOSE = / Lv(\\u00a0|\u00a0)/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.tsx?$/.test(p) && !p.endsWith('.test.ts') ? [p] : [];
  });
}

describe('"이름 Lv N" 한 덩이 (src/game/**/*.ts · tsx)', () => {
  it('Lv 뒤를 붙여 쓴 곳은 앞도 붙여 씀', () => {
    const found: string[] = [];
    for (const file of sources(ROOT)) {
      readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .forEach((l, i) => {
          if (LOOSE.test(l)) found.push(`${relative(ROOT, file)}:${i + 1} ${l.trim()}`);
        });
    }
    expect(found).toEqual([]);
  });
});
