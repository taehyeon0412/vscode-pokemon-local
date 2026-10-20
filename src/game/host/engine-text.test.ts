/** 화면으로 가는 엔진 글 (src/game/core) 에 이모지가 없는지 — core 는 Node 를 못 써서 여기 (확장 쪽) 에서 훑음. (2026-10-20 아트 디렉터 3차 — 이모지는 OS 마다 다르고 픽셀 화풍과 안 맞아 "AI 티", 아이콘은 화면이 픽셀 그림으로) */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', 'core');
const EMOJI = /[\u{1F300}-\u{1FAFF}\u2728\u26A1]/u;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return p.endsWith('.ts') && !p.endsWith('.test.ts') ? [p] : [];
  });
}

describe('엔진 글에 이모지 없음 (src/game/core)', () => {
  it('주석 · 부탁하는 사람 그림 대신 아이콘 (icon:) 말고는 U+1F300–1FAFF · ✨ · ⚡ 가 없음', () => {
    const found: string[] = [];
    for (const file of sources(ROOT)) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          const t = line.trim();
          if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || /\bicon:/.test(t)) return;
          const code = t.replace(/\/\/.*$/, '');
          if (EMOJI.test(code)) found.push(`${file.slice(ROOT.length + 1)}:${i + 1}`);
        });
    }
    expect(found).toEqual([]);
  });
});
