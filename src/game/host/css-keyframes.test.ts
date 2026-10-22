/** 게임 css 의 @keyframes 이름이 겹치지 않는지 — 뒤 것이 앞 것을 덮어 다른 연출이 됨 (2026-10-22 UX 리뷰어 #75: 야생 튀어나옴 pg-pop-rise 가 피해 숫자 pg-pop-rise (끝 투명) 에 덮여 땅 · 바위 야생이 0.3초 뒤 사라지던 것 — 10-18 부터) */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return cssFiles(p);
    return name.endsWith('.css') ? [p] : [];
  });
}

describe('css @keyframes', () => {
  it('이름이 게임 css 전체에서 한 번씩만', () => {
    const seen = new Map<string, string>();
    const dup: string[] = [];
    for (const f of cssFiles(ROOT)) {
      for (const m of readFileSync(f, 'utf8').matchAll(/@keyframes\s+([\w-]+)/g)) {
        const name = m[1]!;
        if (seen.has(name)) dup.push(`${name} (${seen.get(name)} · ${f})`);
        else seen.set(name, f);
      }
    }
    expect(dup).toEqual([]);
  });
});
