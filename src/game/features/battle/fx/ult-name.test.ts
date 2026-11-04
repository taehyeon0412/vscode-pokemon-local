/**
 * 필살기 이름 = 배운 기술과 다름 (ideas 102 · orders #149) — 후보가 다 배운 기술이면 타입 기본 필살기 (꼬렛 필살앞니 · 전광석화 → 울트라대시어택)
 * 엔진 (3:3 — team ultPool) · 연출 (1:1 · 3:3 그림 — ult/bridge.js fxUltPick) 이 같은 표 (make-moves.py — ult-moves.json fallback · 묶음 ULT_TYPE_LIB · POKEMON_ULT_TYPE) 를 씀
 * 연출은 묶음 (main-bundle) 으로만 돌아 표 · 함수 줄을 읽어 셈
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ultPool } from '../../../core/engine/team';
import { allMoves, ultFallbackOf, ultNamesOf } from '../../../data';
import ultMoves from '../../../data/generated/ult-moves.json';

const root = join(__dirname, '../../../../..');
const bridge = readFileSync(join(root, 'ult/bridge.js'), 'utf8');
const bundle = readFileSync(join(root, 'extension/media/main-bundle.js'), 'utf8');

type Entry = [string, string, Record<string, unknown>];
const table = <T>(name: string): T => JSON.parse(bundle.match(new RegExp(`const ${name} = (.*?);\\r?\\n`))![1]!) as T;
const ULT_LIB = table<Entry[]>('ULT_LIB');
const POKEMON_ULT = table<Record<string, number[]>>('POKEMON_ULT');
const ULT_TYPE_LIB = table<Entry[]>('ULT_TYPE_LIB');
const POKEMON_ULT_TYPE = table<Record<string, number>>('POKEMON_ULT_TYPE');
const core = readFileSync(join(root, 'ult/core.js'), 'utf8');
const ULT_SPECIALS = JSON.parse(core.match(/const ULT_SPECIALS = (\[.*?\]);/)![1]!.replace(/'/g, '"')) as string[];

/** bridge.js 의 fxName · fxTypeUlt · fxUltNamed · fxUltPick 을 그대로 떼어 돌림 (주머니 맨 앞 = 첫 후보 · 고르기 = 첫 것) */
const src = bridge.slice(bridge.indexOf('const fxName = '), bridge.indexOf('function fxPlan(')) + bridge.slice(bridge.indexOf('function fxDuelEntry('), bridge.indexOf('function fxDuelSoftStop('));
const fx = new Function('POKEMON_ULT', 'POKEMON_ULT_TYPE', 'ULT_LIB', 'ULT_TYPE_LIB', 'ULT_SPECIALS', 'ultEntry', 'movePick', `${src} return { fxUltPick, fxUltNamed, fxDuelEntry };`)(
  POKEMON_ULT,
  POKEMON_ULT_TYPE,
  ULT_LIB,
  ULT_TYPE_LIB,
  ULT_SPECIALS,
  (form: string) => (POKEMON_ULT[form] ? ULT_LIB[POKEMON_ULT[form]![0]!] : undefined),
  (list: Entry[]) => list[0],
) as { fxUltPick: (form: string, avoid: string[]) => Entry | undefined; fxUltNamed: (form: string, name: string) => Entry | null; fxDuelEntry: (kind: 'ult', form: string, m: null, avoid: string[], name?: string) => Entry };

const moveNames = new Set(allMoves().map((m) => m.name.ko));
const forms = Object.keys(ultMoves.forms);
/** 가장 나쁜 경우 — 후보 가운데 기술 이름인 것을 다 배움 (4칸보다 많아도) */
const worst = (form: string) => new Set(ultNamesOf(form).filter((n) => moveNames.has(n)));

describe('필살기 이름 — 배운 기술과 같은 이름 0', () => {
  it('엔진 · 연출이 같은 표 — 모습마다 타입 기본 필살기 하나 · 기술 이름이 아님', () => {
    expect(forms.length).toBeGreaterThan(600);
    for (const form of forms) {
      const name = ultFallbackOf(form);
      expect(name, form).toBeTruthy();
      expect(ULT_TYPE_LIB[POKEMON_ULT_TYPE[form]!]![0], form).toBe(name);
      expect(moveNames.has(name!), form).toBe(false);
    }
  });

  it('3:3 엔진 (ultPool) — 모든 모습 · 가장 나쁜 경우에도 배운 기술과 같은 이름 0 · 다 겹친 모습만 타입 기본', () => {
    let swapped = 0;
    for (const form of forms) {
      const learned = worst(form);
      const pool = ultPool(form, learned);
      expect(pool.length, form).toBeGreaterThan(0);
      expect(pool.filter((n) => learned.has(n)), form).toEqual([]);
      const all = ultNamesOf(form).every((n) => learned.has(n));
      expect(pool, form).toEqual(all ? [ultFallbackOf(form)] : ultNamesOf(form).filter((n) => !learned.has(n)));
      if (all) swapped += 1;
    }
    // 11-04 기획 확인 — 레벨로 배운 마지막 넷 흉내로 136 모습 (가장 나쁜 경우는 더 많음)
    expect(swapped).toBeGreaterThanOrEqual(136);
    // 꼬렛 필살앞니 · 전광석화 → 울트라대시어택 · 안 겹치면 그대로
    expect(ultPool('rattata', new Set(['필살앞니', '전광석화']))).toEqual(['울트라대시어택']);
    expect(ultPool('rattata', new Set(['전광석화']))).toEqual(['필살앞니']);
    expect(ultPool('rattata', new Set())).toEqual(ultNamesOf('rattata'));
  });

  it('1:1 · 3:3 연출 (fxUltPick · 1 공격 몸통박치기도 피함) — 모든 모습 · 가장 나쁜 경우에도 같은 이름 0 · 엔진이 고른 이름을 찾음', () => {
    for (const form of forms) {
      if (!POKEMON_ULT[form]) continue;
      const avoid = [...worst(form), '몸통박치기'];
      const e = fx.fxUltPick(form, avoid);
      expect(e, form).toBeTruthy();
      expect(avoid.includes(e![0]), `${form} ${e![0]}`).toBe(false);
      // 3:3 엔진 이름 (타입 기본 포함) → 그 그림
      for (const name of ultPool(form, worst(form))) expect(fx.fxUltNamed(form, name)?.[0], form).toBe(name);
    }
    expect(fx.fxUltPick('rattata', ['필살앞니', '전광석화', '몸통박치기'])![0]).toBe('울트라대시어택');
  });

  it('힘대결 (fxDuelEntry) — 모든 모습 · 가장 나쁜 경우에도 배운 기술과 같은 이름 0 · 특수 필살기 (튀어오르기 · 변신) 빼고', () => {
    for (const form of forms) {
      if (!POKEMON_ULT[form]) continue;
      const avoid = [...worst(form), '몸통박치기'];
      const e = fx.fxDuelEntry('ult', form, null, avoid);
      expect(avoid.includes(e[0]), `${form} ${e[0]}`).toBe(false);
      expect(ULT_SPECIALS.includes(e[1]), form).toBe(false);
    }
    // 잉어킹 — 튀어오르기가 빠진 뒤 "몸통박치기" 가 대결 이름이 되던 것 (#149 테스터) → 물 타입 기본
    expect(fx.fxDuelEntry('ult', 'magikarp', null, ['몸통박치기'])[0]).toBe(ultFallbackOf('magikarp'));
  });

  it('일반 모드 주머니 · 손가락흔들기 후보 (ULT_LIB 전체) 엔 안 넣음 — 타입 기본은 따로 표 (ULT_TYPE_LIB) · 피할 이름이 없으면 주머니 그대로', () => {
    expect(bundle).toContain('const POKEMON_ULT_TYPE = ');
    // ULT_LIB = 모습 주머니가 가리키는 것만 (타입 기본 변형 4개가 붙어 손가락흔들기 후보가 늘던 것 — #149 코드 리뷰 작음 3)
    expect(new Set(Object.values(POKEMON_ULT).flat()).size).toBe(ULT_LIB.length);
    expect(ULT_TYPE_LIB.length).toBe(18);
    expect(fx.fxUltPick('rattata', [])![0]).toBe(ULT_LIB[POKEMON_ULT.rattata![0]!]![0]);
    expect(POKEMON_ULT.rattata!.map((i) => ULT_LIB[i]![0])).not.toContain('울트라대시어택');
  });
});
