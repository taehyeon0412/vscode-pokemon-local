/**
 * 필살기 그림의 패널 전체 칠 (fillRect 0, 0, W, H) 표 — 밝은 칠은 동작 줄이기면 반 밝기 (ideas 738 · 1674).
 * 738 에서 밝은 칠 몇 곳 (전용 필살기 임팩트 프레임 · 뮤 분홍) 이 줄임에서 빠졌던 것 (UX 738 작음 1 · 2) — 다시 안 빠지게 표로 묶음.
 * 새 칠이 생기면 표에 넣어야 통과: 밝은 칠 (bright) 은 세기 식에 fxReduceMotion · fxFlashCap 이 있어야 하고 · 옅은 칠 (faint) 은 계수가 0.22 넘으면 걸림 · 어둡게 하는 칠 (dark) 은 그대로.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ULT = join(__dirname, '../../../../../ult');

type Kind = 'bright' | 'dark' | 'faint';
/** file · 칠 색 식 · 세기 식 앞부분 — 셋이 같으면 같은 칠 (줄 번호는 바뀌어도 됨) */
const TABLE: { file: string; style: string; alpha: string; kind: Kind; why: string }[] = [
  { file: 'bridge.js', style: "'#0a0c1e'", alpha: 'Math.ceil(a * 8) / 8', kind: 'dark', why: '어두운 막' },
  { file: 'fx-body.js', style: 'cols[3]', alpha: 'a * (0.22', kind: 'dark', why: '가장 짙은 색으로 가라앉힘' },
  { file: 'fx-energy.js', style: 'f.color', alpha: 'Math.min(typeof fxFlashCap', kind: 'bright', why: 'overlay 번쩍 — 상한 fxFlashCap (동작 줄이기 0.15)' },
  { file: 'fx-energy.js', style: 'o.rainbow ? hue(f * 300, 60) : cols[1]', alpha: '(0.07 + 0.03', kind: 'faint', why: '옅은 물듦 ≤ 0.1' },
  { file: 'fx-energy.js', style: "'#ff7ab8'", alpha: '0.16 * fadeInOut', kind: 'bright', why: '분홍빛 화면 전체' },
  { file: 'fx-sky.js', style: 'tint', alpha: '0.07 * a', kind: 'faint', why: '날씨 물듦' },
  { file: 'fx-sky.js', style: 'cols[1]', alpha: '0.12 * a', kind: 'faint', why: '모래 물듦' },
  { file: 'fx-sky.js', style: "'#f2fbff'", alpha: '0.45 * (1 - t)', kind: 'bright', why: '눈보라 흰 번쩍' },
  { file: 'fx-sky.js', style: 'cols[1]', alpha: '0.22 * grow * fade', kind: 'bright', why: '돔 화면 물듦' },
  { file: 'fx-sky.js', style: "'#05040a'", alpha: '0.45', kind: 'dark', why: '번쩍 앞 어둠 한 장' },
  { file: 'fx-sky.js', style: "'#05070c'", alpha: '0.78 * dark', kind: 'dark', why: '어둠' },
  { file: 'fx-sky.js', style: "'#ffffff'", alpha: '0.92', kind: 'bright', why: '임팩트 프레임 흰 칠 (하이드로캐논)' },
  { file: 'fx-sky.js', style: "'#000000'", alpha: '0.9', kind: 'dark', why: '임팩트 프레임 검정' },
  { file: 'fx-sky.js', style: 'MEWP[3]', alpha: 'a * fade', kind: 'bright', why: '뮤츠 보랏빛 물듦' },
  { file: 'fx-sky.js', style: 'MEWP[3]', alpha: 'a', kind: 'faint', why: '짙은 보라 ≤ 0.2 (0.08 + 0.12)' },
  { file: 'fx-sky.js', style: 'MEWPK[2]', alpha: '0.18 * a', kind: 'bright', why: '뮤 분홍 물듦' },
  { file: 'fx-sky.js', style: "'#ffffff'", alpha: 'white', kind: 'bright', why: 'impactFrames 흰 칠 — 전용 필살기 114곳' },
  { file: 'fx-sky.js', style: "'#000000'", alpha: 'black', kind: 'dark', why: 'impactFrames 검정' },
  { file: 'fx-unique.js', style: 'RAGE[3]', alpha: '0.14 * a', kind: 'faint', why: '옅은 물듦' },
  { file: 'fx-unique.js', style: 'LAVAC[2]', alpha: '0.18 * a', kind: 'faint', why: '옅은 물듦' },
  { file: 'fx-unique.js', style: 'TIMEC[3]', alpha: '0.16 * a', kind: 'faint', why: '옅은 물듦' },
  { file: 'fx-unique.js', style: 'FROST[3]', alpha: '0.14 * a', kind: 'faint', why: '옅은 물듦' },
  { file: 'fx-unique.js', style: "'#b02a0a'", alpha: '0.22 * a', kind: 'faint', why: '짙은 빨강 옅은 물듦' },
  { file: 'fx-unique.js', style: 'ALAK[3]', alpha: '0.14 * a', kind: 'faint', why: '옅은 물듦' },
  { file: 'fx-unique.js', style: 'FIRE[3]', alpha: '0.16 * a', kind: 'faint', why: '옅은 물듦' },
  { file: 'fx-unique.js', style: 'VINEC[1]', alpha: '0.12 * a', kind: 'faint', why: '옅은 물듦' },
];

/** 패널 전체 칠 하나 — 바로 앞 8줄 안의 ctx.fillStyle · ctx.globalAlpha 식 (오프스크린 oc. 칠은 뺌) */
function fills(): { file: string; line: number; style: string; alpha: string }[] {
  const out: { file: string; line: number; style: string; alpha: string }[] = [];
  for (const file of readdirSync(ULT).filter((f) => f.endsWith('.js'))) {
    const lines = readFileSync(join(ULT, file), 'utf8').split(/\r?\n/);
    lines.forEach((l, i) => {
      if (!/\bctx\.fillRect\(0, 0, (W, H|window\.innerWidth, window\.innerHeight|u\.W, u\.H)\)/.test(l)) return;
      let style = '';
      let alpha = '';
      for (let k = i - 1; k >= Math.max(0, i - 8) && (!style || !alpha); k--) {
        const s = /ctx\.fillStyle = (.+?);/.exec(lines[k]!);
        const a = /ctx\.globalAlpha = (.+?);/.exec(lines[k]!);
        if (!style && s) style = s[1]!.trim();
        if (!alpha && a) alpha = a[1]!.trim();
      }
      out.push({ file, line: i + 1, style, alpha });
    });
  }
  return out;
}

const entryOf = (f: { file: string; style: string; alpha: string }) => TABLE.filter((t) => t.file === f.file && t.style === f.style && (t.alpha === f.alpha || f.alpha.startsWith(t.alpha + ' ') || f.alpha.startsWith(t.alpha))).sort((a, b) => b.alpha.length - a.alpha.length)[0];

describe('필살기 패널 전체 칠 표 (ideas 1674)', () => {
  const all = fills();

  it('칠을 찾음 (표가 비지 않게)', () => {
    expect(all.length).toBeGreaterThanOrEqual(TABLE.length);
  });

  it('모든 패널 전체 칠이 표에 있음 — 새 칠은 밝음 · 어둠 · 옅음을 정해 표에 넣기', () => {
    const missing = all.filter((f) => !entryOf(f)).map((f) => `${f.file}:${f.line} ${f.style} | ${f.alpha}`);
    expect(missing).toEqual([]);
  });

  it('밝은 칠은 동작 줄이기면 줄어듦 (fxReduceMotion · fxFlashCap)', () => {
    const bad = all.filter((f) => entryOf(f)?.kind === 'bright' && !/fxReduceMotion|fxFlashCap/.test(f.alpha)).map((f) => `${f.file}:${f.line} ${f.alpha}`);
    expect(bad).toEqual([]);
  });

  it('옅은 칠은 계수 0.22 이하 (넘으면 밝음으로 옮겨 줄이기)', () => {
    const strong = all
      .filter((f) => entryOf(f)?.kind === 'faint')
      .map((f) => ({ f, k: Math.max(0, ...Array.from(f.alpha.matchAll(/\d*\.\d+/g), (m) => Number(m[0]))) }))
      .filter(({ k }) => k > 0.22)
      .map(({ f, k }) => `${f.file}:${f.line} ${k}`);
    expect(strong).toEqual([]);
  });
});
