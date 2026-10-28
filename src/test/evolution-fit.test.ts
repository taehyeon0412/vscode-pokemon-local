/**
 * 진화 레벨을 우리 게임 속도에 (#126 — 2026-10-28 태현 님 "미뇽 → 신뇽 → 망나뇽 30 55는 너무 키우기 힘들것같아" → B + "3정도만 더")
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sampleMonster } from './fixtures/save';
import { allSpecies, evolutionsOf, speciesOf } from '../game/data';
import { BALANCE } from '../game/core/balance';
import { Rng } from '../game/core/engine/rng';
import { fitEvolutionLevel, levelUpChoices, pickEvolution } from '../game/core/rules/growth';

const script = readFileSync(join(__dirname, '../../scripts/fetch-pokeapi.mjs'), 'utf8');
const levelOf = (from: number, to: number) => evolutionsOf(from).find((e) => e.to === to)?.level;
const pseudoFrom = new Set(
  (/const PSEUDO_FROM = new Set\(\[([^\]]*)\]\)/.exec(script)?.[1] ?? '')
    .split(',')
    .map((x) => Number(x.trim()))
    .filter(Boolean),
);

describe('진화 레벨 — 우리 게임 속도 (#126)', () => {
  it('기획 예 그대로 — 20 이하 그대로 · 넘는 부분 0.6배 · 40 이상 · 600족 −3', () => {
    expect(levelOf(10, 11)).toBe(7); // 캐터피
    expect(levelOf(4, 5)).toBe(16); // 파이리
    expect(levelOf(5, 6)).toBe(30); // 리자몽 36
    expect(levelOf(8, 9)).toBe(30); // 거북왕 36
    expect(levelOf(2, 3)).toBe(27); // 이상해꽃 32
    expect(levelOf(147, 148)).toBe(23); // 신뇽 30
    expect(levelOf(148, 149)).toBe(38); // 망나뇽 55
    expect(levelOf(247, 248)).toBe(38); // 마기라스 55
    expect(levelOf(372, 373)).toBe(35); // 보만다 50
    expect(levelOf(444, 445)).toBe(34); // 한카리아스 48
    expect(levelOf(375, 376)).toBe(32); // 메타그로스 45
    expect(levelOf(329, 330)).toBe(32); // 플라이곤 45
    expect(levelOf(77, 78)).toBe(29); // 날쌩마 40
    // 원작 값은 남김
    expect(evolutionsOf(148)[0]?.origLevel).toBe(55);
  });

  it('받아 오는 스크립트의 식 = 게임 안 식 (BALANCE.evolutionFit) — 데이터의 모든 레벨 진화가 맞음', () => {
    const fit = /const EVO_FIT = \{ keep: (\d+), scale: ([\d.]+), highFrom: (\d+), cut: (\d+) \}/.exec(script);
    expect(fit && { keep: Number(fit[1]), scale: Number(fit[2]), highFrom: Number(fit[3]), cut: Number(fit[4]) }).toEqual(BALANCE.evolutionFit);
    expect(pseudoFrom.size).toBe(12);
    let n = 0;
    for (const from of allSpecies()) {
      for (const e of evolutionsOf(from)) {
        if (e.level === undefined) continue;
        n++;
        const orig = e.origLevel ?? e.level;
        const pseudoCut = pseudoFrom.has(from) && orig < BALANCE.evolutionFit.highFrom ? BALANCE.evolutionFit.cut : 0;
        expect(e.level, `${speciesOf(from)?.name.ko} → ${speciesOf(e.to)?.name.ko}`).toBe(Math.max(1, fitEvolutionLevel(orig) - pseudoCut));
      }
    }
    expect(n).toBeGreaterThan(150);
  });

  it('세 단계 계열은 둘째 진화가 첫째보다 늦음 (줄여도 순서가 안 뒤집힘)', () => {
    for (const mid of allSpecies()) {
      const from = speciesOf(mid)?.evolvesFrom;
      const first = from ? evolutionsOf(from).find((e) => e.to === mid && e.kind === 'level')?.level : undefined;
      if (first === undefined) continue;
      for (const e of evolutionsOf(mid)) if (e.kind === 'level' && e.level !== undefined) expect(e.level, `${speciesOf(mid)?.name.ko}`).toBeGreaterThan(first);
    }
  });

  it('게임이 계산하는 진화 레벨도 같은 식 — 친밀도 20 그대로 · 그 밖 조건 30 → 26', () => {
    expect(fitEvolutionLevel(BALANCE.friendshipLevel)).toBe(20);
    expect(fitEvolutionLevel(30)).toBe(26);
    expect(fitEvolutionLevel(45)).toBe(32);
  });

  it('이미 새 진화 레벨을 넘은 포켓몬 (예전 세이브 — 리자드 Lv 33) = 다음 레벨업에 진화 고르기 (S22 를 거침)', () => {
    const charmeleon = sampleMonster({ species: 5, form: 'charmeleon', level: 33, exp: 33 ** 3 });
    expect(pickEvolution(charmeleon, 33, new Rng(1))).toBe(6);
    const up = levelUpChoices(charmeleon, 33, 34, new Rng(1));
    expect(up.choices.some((c) => c.kind === 'evolve' && c.to === 6)).toBe(true);
  });
});
