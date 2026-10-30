/**
 * 넘치면 한 단계 (ui/useFit) 를 여럿 쓰는 상자 — 두 훅이 같은 줄을 따로 재지 않게 (ideas 1672).
 * 기술 배우기 (ChoiceBox) 가 버튼 줄까지 재는 훅 (`:scope > .pg-line`) 과 첫 줄 훅을 같이 써, 버튼 줄이 넘칠 때 자리가 있는 첫 줄에서 이름 · 타입이 빠지고
 * 처음 열기 ↔ 크기 바꾼 뒤가 달랐던 것 (UX 작음 묶음 3 큼 2) — 같은 상자 안: 같은 선택자 두 번 금지 · 줄 전체 (`:scope > .pg-line`) 를 재는 훅은 혼자일 때만.
 * 같은 줄을 차례로 재는 것은 앞 단계가 붙이는 class 로 막아야 함 (`:scope.pg-no-type > …` — learnFit 2 단계 뒤에만 tight 가 잼).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '../../game');

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? tsxFiles(p) : p.endsWith('.tsx') ? [p] : [];
  });
}

/** 파일 · 부품 (감싼 function) 마다 useFit(상자, 최대, '선택자') — 선택자 없으면 상자의 모든 자식 · 부품이 다르면 같은 변수 이름 (box) 이어도 다른 상자 */
function calls(): { file: string; box: string; sel: string }[] {
  return tsxFiles(SRC).flatMap((file) => {
    const text = readFileSync(file, 'utf8');
    return Array.from(text.matchAll(/useFit\((\w+), \d+(?:, '([^']+)')?\)/g), (m) => {
      const fn = Array.from(text.slice(0, m.index).matchAll(/function (\w+)/g)).pop()?.[1] ?? '?';
      return { file: `${file.slice(SRC.length + 1)}#${fn}`, box: m[1]!, sel: m[2] ?? '*' };
    });
  });
}

describe('넘치면 한 단계 훅이 같은 줄을 따로 재지 않음 (ideas 1672)', () => {
  const all = calls();
  const groups = new Map<string, string[]>();
  for (const c of all) groups.set(`${c.file}|${c.box}`, [...(groups.get(`${c.file}|${c.box}`) ?? []), c.sel]);

  it('useFit 을 찾음', () => {
    expect(all.length).toBeGreaterThan(3);
  });

  it('같은 상자에 같은 선택자 두 번 없음', () => {
    const dup = [...groups].filter(([, sels]) => new Set(sels).size !== sels.length).map(([k]) => k);
    expect(dup).toEqual([]);
  });

  it('줄 전체 · 모든 자식을 재는 훅은 그 상자에 혼자', () => {
    const wide = [...groups].filter(([, sels]) => sels.length > 1 && sels.some((s) => s === '*' || s === ':scope > .pg-line')).map(([k, sels]) => `${k} ${sels.join(' · ')}`);
    expect(wide).toEqual([]);
  });

  it('같은 줄을 재는 두 훅은 class 로 차례가 갈림 (:scope.<class> > 같은 줄)', () => {
    const bad = [...groups].flatMap(([k, sels]) => {
      const line = (s: string) => s.replace(/^:scope(\.[\w-]+)*\s*>\s*/, '');
      const gated = (s: string) => /^:scope\.[\w-]+/.test(s);
      return sels.flatMap((a, i) => sels.slice(i + 1).filter((b) => line(a) === line(b) && !gated(a) && !gated(b)).map((b) => `${k} ${a} · ${b}`));
    });
    expect(bad).toEqual([]);
  });
});
