/**
 * 기술마다 모양 (#122 — 디자인 표 dev/move-look.json) — 표가 맞는 값인지 · 묶음 (main-bundle.js MOVE_LIB) 이 표와 맞는지 (표만 고치고 python dev/move-look.py 를 안 돌린 것을 잡음)
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import movesJson from '../../../data/generated/moves.json';

const root = join(__dirname, '../../../../..');
const look = JSON.parse(readFileSync(join(root, 'dev/move-look.json'), 'utf8')) as Record<string, unknown>;
const bundle = readFileSync(join(root, 'extension/media/main-bundle.js'), 'utf8');
const movesJs = readFileSync(join(root, 'moves.js'), 'utf8');
const moves = movesJson as unknown as Record<string, { name: { ko: string }; type: string; power: number | null }>;
const entries = Object.entries(look).filter(([k]) => !k.startsWith('_')) as [string, Record<string, unknown>][];

/** make-moves.py bundle_table 과 같은 읽기 — GAME-PATCH 표 (gameMoveEntry 가 쓰는 이름 바꿈 · 타입 기본 기술) */
const bundleTable = (name: string): Record<string, string> => {
  const m = new RegExp(`const ${name} = \\{([^}]*)\\};`).exec(bundle);
  // 열쇠가 한글 (화염바퀴) — JS \w 는 영문만이라 (파이썬 \w 는 한글도)
  return Object.fromEntries([...(m?.[1] ?? '').matchAll(/([^\s:,'{}]+): '([^']+)'/g)].map((x) => [x[1]!, x[2]!]));
};
const sigFx = (() => {
  const start = movesJs.indexOf('const SIG_FX = {');
  const end = movesJs.indexOf('\n};', start);
  return new Set([...movesJs.slice(start, end).matchAll(/^ {4}(\w+): \{$/gm)].map((m) => m[1]!));
})();
// 묶음은 윈도우 줄 끝 (make-moves.py 가 글 모드로 씀) — \r?\n
const libMatch = /const MOVE_LIB = (\[.*?\]);\r?\n/.exec(bundle);
const lib = JSON.parse(libMatch?.[1] ?? '[]') as [string, string, Record<string, unknown>?][];

describe('기술마다 모양 표 (#122 — 태현 님 "불꽃세례 불꽃 튀기기 둘다 똑같은 모션")', () => {
  it('묶음에서 읽는 표 (이름 바꿈 · 타입 기본 기술) 와 틀 이름을 make-moves.py 가 찾을 수 있음', () => {
    expect(Object.keys(bundleTable('GAME_TYPE_MOVE')).length).toBeGreaterThanOrEqual(17);
    expect(bundleTable('GAME_MOVE_ALIAS')).toHaveProperty('화염바퀴');
    expect(sigFx.has('breath') && sigFx.has('dash') && sigFx.has('vortex')).toBe(true);
    // 묶음의 기술 모음을 읽을 수 있음 (빈 표에서도 — 못 읽으면 아래 맞춤 검사가 늘 "없음")
    expect(lib.length).toBeGreaterThan(100);
  });

  it('표의 값 — 게임 기술 id · 있는 틀 · 크기 0.7 ~ 1.4 · 변주 값은 숫자 · 글 · 참거짓', () => {
    for (const [id, v] of entries) {
      expect(moves[id], `없는 기술 id ${id}`).toBeDefined();
      expect(typeof v === 'object' && v !== null && !Array.isArray(v)).toBe(true);
      if (v.fx !== undefined) expect(sigFx.has(String(v.fx)), `${id} 틀 ${String(v.fx)}`).toBe(true);
      if (v.size !== undefined) expect(Number(v.size)).toBeGreaterThan(0);
      for (const [k, x] of Object.entries(v)) expect(['number', 'string', 'boolean'], `${id}.${k}`).toContain(typeof x);
    }
  });

  it('묶음이 표와 맞음 — 표만 고치면 python dev/move-look.py 를 다시 돌리라고 알림', () => {
    const alias = bundleTable('GAME_MOVE_ALIAS');
    for (const [id, v] of entries) {
      const name = alias[moves[id]!.name.ko] ?? moves[id]!.name.ko;
      const got = lib.filter((m) => m[0] === name);
      expect(got.length, `${name} (${id}) 가 묶음에 없음 — python dev/move-look.py`).toBeGreaterThan(0);
      for (const m of got) {
        const { fx, size, ...opts } = v;
        if (fx !== undefined) expect(m[1], `${name} 틀`).toBe(fx);
        expect(m[2]?.size, `${name} 크기`).toBeGreaterThanOrEqual(0.7);
        expect(m[2]?.size, `${name} 크기`).toBeLessThanOrEqual(1.4);
        if (size !== undefined) expect(m[2]?.size).toBe(Math.round(Math.min(1.4, Math.max(0.7, Number(size))) * 100) / 100);
        for (const [k, x] of Object.entries(opts)) expect(m[2]?.[k], `${name}.${k} — python dev/move-look.py`).toBe(x);
      }
    }
  });
});
