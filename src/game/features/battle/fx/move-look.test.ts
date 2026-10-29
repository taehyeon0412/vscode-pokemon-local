/**
 * 기술마다 모양 (#122 — 디자인 표 dev/move-look.json) — 표가 맞는 값인지 · 묶음 (main-bundle.js MOVE_LIB) 이 표와 맞는지 (표만 고치고 python dev/move-look.py 를 안 돌린 것을 잡음)
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import movesJson from '../../../data/generated/moves.json';
import { shotHitAt } from './shot-hit';

const root = join(__dirname, '../../../../..');
const look = JSON.parse(readFileSync(join(root, 'dev/move-look.json'), 'utf8')) as Record<string, unknown>;
const bundle = readFileSync(join(root, 'extension/media/main-bundle.js'), 'utf8');
const movesJs = readFileSync(join(root, 'moves.js'), 'utf8');
const bridgeJs = readFileSync(join(root, 'ult/bridge.js'), 'utf8');
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

  it('표의 값 — 게임 기술 id · 있는 틀 · size 없음 (틀이 안 읽음 — 크기는 틀 값으로) · 변주 값은 숫자 · 글 · 참거짓', () => {
    for (const [id, v] of entries) {
      expect(moves[id], `없는 기술 id ${id}`).toBeDefined();
      expect(typeof v === 'object' && v !== null && !Array.isArray(v)).toBe(true);
      if (v.fx !== undefined) expect(sigFx.has(String(v.fx)), `${id} 틀 ${String(v.fx)}`).toBe(true);
      expect(v.size, `${id} size — make-moves 가 멈춤`).toBeUndefined();
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
        const { fx, ...opts } = v;
        if (fx !== undefined) expect(m[1], `${name} 틀`).toBe(fx);
        // 예전 위력 자동 크기가 묶음에 남지 않음 (python dev/move-look.py 로 다시 묶음)
        expect(m[2]?.size, `${name} size — python dev/move-look.py`).toBeUndefined();
        for (const [k, x] of Object.entries(opts)) expect(m[2]?.[k], `${name}.${k} — python dev/move-look.py`).toBe(x);
      }
    }
  });

  it('날리기는 맞는 때 (shot-hit) 에 상대에 닿게 빠르기를 맞춤 — bridge 의 닿는 때가 shot-hit.ts 와 같음 (#122 U2)', () => {
    const at = /const PROJECTILE_HIT_AT = ([\d.]+);/.exec(bridgeJs);
    expect(Number(at?.[1])).toBe(shotHitAt('projectile'));
    // 표에 적은 기술만이 아니라 게임의 똑바로 나는 날리기 모두 (reach: 0 만 예전 빠르기)
    expect(bridgeJs).toContain('o.reach !== 0 && ms > 0');
  });
  it('포물선 날리기도 맞는 때에 떨어지게 — bridge 의 포물선 시간이 moves.js 포물선 (위 빠르기 arc × 0.45 · 무게 arc) 과 같음 (#122 1단계 UX 큼)', () => {
    const up = /o\.arc \? o\.arc \* ([\d.]+) \* g\.s/.exec(movesJs);
    expect(movesJs).toContain('g: (o.arc ?? 0) * g.s');
    const sec = /const PROJECTILE_ARC_SEC = ([\d.]+);/.exec(bridgeJs);
    expect(Number(sec?.[1])).toBeCloseTo(2 * Number(up?.[1]), 6);
    expect(bridgeJs).toContain('if (o.arc && travel > 0)');
  });
  it('1:1 뿜기 기울임이 큰 포켓몬에서 켜짐 · 작은 포켓몬끼리는 그대로 — 몸 모양 기준 (#122 2단계 UX 6바퀴: 칸 기준 문턱이 한 번도 안 켜졌음)', () => {
    const shape = JSON.parse(/const POKEMON_SHAPE = (\{.*?\});\r?\n/.exec(bundle)?.[1] ?? '{}') as Record<string, number[]>;
    const above = Number(/const BREATH_TILT_ABOVE = ([\d.]+);/.exec(bridgeJs)?.[1]);
    // bridge 와 같은 셈 (1:1 = 같은 땅 · 같은 칸 크기라 그림 칸 단위로): 입 = my + 0.5 · 몸 위 = t · 몸 높이 = b − t
    const tilts = (who: string, dst: string): boolean => {
      const [, , my] = shape[who]!;
      const [, , , , t, , b] = shape[dst]!;
      return my! + 0.5 < t! + above * (b! - t!);
    };
    const foes = ['bulbasaur', 'charmander', 'squirtle', 'pikachu', 'caterpie'];
    for (const big of ['onix', 'dragonite', 'lapras', 'charizard']) for (const f of foes) expect(tilts(big, f), `${big} → ${f}`).toBe(true);
    for (const small of ['bulbasaur', 'charmander', 'squirtle']) for (const f of foes) expect(tilts(small, f), `${small} → ${f}`).toBe(false);
    expect(bridgeJs).toContain('g0.mouth.y < sb.top + BREATH_TILT_ABOVE * bh');
  });
});
