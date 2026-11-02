/** 화면 코드가 document.fonts 를 직접 듣지 않는지 — 글꼴 뒤 다시 재기는 ui/fonts afterFonts 한 군데 (기획 2026-10-30 · bugs 2728 · 2729 같은 종류 두 번). 웹뷰 쪽은 Node 를 못 써서 여기 (확장 쪽) 에서 훑음 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p) ? [p] : [];
  });
}

describe('글꼴 뒤 다시 재기는 한 군데 (ui/fonts)', () => {
  it('document.fonts 는 ui/fonts 와 main.ts 처음 보이기만', () => {
    const allowed = [join('ui', 'fonts.ts'), join('webview', 'main.ts')];
    const found = sources(ROOT)
      .filter((f) => !allowed.some((a) => f.endsWith(sep + a)))
      .flatMap((f) =>
        readFileSync(f, 'utf8')
          .split('\n')
          .map((l, i) => [l, i] as const)
          .filter(([l]) => /document\.fonts/.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l))
          .map(([, i]) => `${relative(ROOT, f)}:${i + 1}`),
      );
    expect(found).toEqual([]);
  });
});
