/**
 * 3:3 피해 숫자 · 말 자리 — 맞을 때 달려나가 있던 칸은 그 자리 위에 (bugs 1907 · U5 — 본 자리에 "-2" 가 떠 0.27초 동안 옆 칸이 맞은 것으로 읽히던 것)
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = (f: string) => readFileSync(join(__dirname, f), 'utf8');

describe('3:3 숫자 자리 — 달려나간 칸', () => {
  it('달려가기는 칸 상자 (data-team) 를 translate 로 옮김 → 숫자가 처음 뜰 때 그 거리를 한 번 재 머리 위 자리에 더함 · 옆 자리 찾기는 안 함', () => {
    const fx = src('../fx/team.ts');
    expect(fx).toMatch(/this\.dashes\.set\(c\.tag, \{ an, el: src\.box \?\? src\.el \}\)/);
    expect(fx).toMatch(/translate: at\(f\)/);
    const s = src('TeamLayer.tsx');
    expect(s).toMatch(/querySelector<HTMLElement>\(`\[data-team="\$\{w\.side\}-\$\{w\.slot\}"\]`\)/);
    expect(s).toMatch(/getComputedStyle\(el\)\.translate/);
    expect(s).toMatch(/dx = dashShift\(side, slot\);/);
    expect(s).toMatch(/const px = x \+ dx;/);
    expect(s).toMatch(/left: `\$\{px\}px`, top: `\$\{top\}px`/);
    expect(s).toMatch(/if \(tall && dx === 0 && !placed\.current\.has\(p\.id\)/);
  });
});
