import { describe, expect, it } from 'vitest';
import { BALANCE } from '../balance';
import { Rng } from '../engine/rng';
import { formOf, moveOf, speciesOf } from '../../data';
import { ambushChance, createWild, evolveForLevel, forestPool, pickupAt, planWild, resolveStart, sceneryAt, STARTER_SPECIES, traceKindOf } from './encounter';
import { mixSeed, stageLayout, stageLevelBand, type Spot } from './stage';

const [LO1, HI1] = stageLevelBand('forest-1');

const spot = (index: number, at: number): Spot => ({ kind: 'wild', at, index });

describe('숲 포켓몬 (mvp-spec 3.2)', () => {
  it('보통 = 풀 · 벌레 1단계, 드물게 = 독 · 드래곤 · 페어리 (풀 · 벌레 아님), 전설 · 환상 · 아기 없음', () => {
    const pool = forestPool('forest-1');
    // 스타팅 계열을 빼고 풀 · 벌레 1단계 (1-1 · 1-2 는 종족값 합 450 넘는 것도 뺌) — mvp-spec 9장 "충분함"
    expect(pool.common.length).toBeGreaterThan(30);
    expect(pool.rare.length).toBeGreaterThan(5);
    for (const dex of pool.common) {
      const s = speciesOf(dex)!;
      expect(s.types.some((t) => t === 'grass' || t === 'bug'), String(dex)).toBe(true);
    }
    for (const dex of [...pool.common, ...pool.rare]) {
      const s = speciesOf(dex)!;
      expect(s.legendary || s.mythical || s.baby, String(dex)).toBe(false);
      expect(s.stage, String(dex)).toBe(1);
    }
    for (const dex of pool.rare) expect(speciesOf(dex)!.types.some((t) => t === 'grass' || t === 'bug')).toBe(false);
    expect(pool.common).toContain(10); // 캐터피
    // 노말 · 비행 (단계 11: 숲이 불꽃 스타팅에만 쉬워서 섞음, 2026-10-19 태현 님) — 풀 · 벌레 · 독 · 드래곤 · 페어리가 아닌 1단계
    expect(pool.mixed.length).toBeGreaterThan(10);
    for (const dex of pool.mixed) {
      const s = speciesOf(dex)!;
      expect(s.types.every((t) => t === 'normal' || t === 'flying'), String(dex)).toBe(true);
      expect(s.legendary || s.mythical || s.baby, String(dex)).toBe(false);
      expect(s.stage, String(dex)).toBe(1);
    }
    expect(pool.mixed).toContain(16); // 구구
    expect(pool.mixed).not.toContain(132); // 메타몽 (변신만)
    expect(pool.mixed).not.toContain(278); // 갈모매 (물 · 비행 — 숲길에 물결 흔적)
  });

  it('스타팅 18종 계열은 야생에 안 나옴 (mvp-spec 9장 [제안])', () => {
    const all = [...forestPool('forest-3').common, ...forestPool('forest-3').rare];
    for (const dex of [1, 152, 252, 387, 495, 650]) expect(all, String(dex)).not.toContain(dex);
    for (const dex of STARTER_SPECIES) expect(all).not.toContain(dex);
  });

  it('종족값 합 450 이 넘는 1단계 (스라크) 는 1-3 에만', () => {
    expect(forestPool('forest-1').common).not.toContain(123);
    expect(forestPool('forest-3').common).toContain(123);
  });

  it('레벨이 진화 레벨을 넘으면 진화형 (캐터피 → 단데기 Lv 7 → 버터플 Lv 10), 돌 진화는 안 함 (냄새꼬 → 라플레시아 X)', () => {
    const rng = new Rng(1);
    expect(evolveForLevel(10, 6, rng)).toBe(10);
    expect(evolveForLevel(10, 7, rng)).toBe(11);
    expect(evolveForLevel(10, 10, rng)).toBe(12);
    expect(evolveForLevel(43, 21, rng)).toBe(44);
    expect(evolveForLevel(43, 60, rng)).toBe(44);
  });

  it('흔적 모양: 물 → 물결 · 비행 → 하늘 · 고스트 · 악 → 그림자 · 땅 · 바위 · 강철 → 땅 · 벌레 → 나무 · 나머지 → 풀숲', () => {
    expect(traceKindOf(['grass', 'poison'])).toBe('grass');
    expect(traceKindOf(['bug', 'flying'])).toBe('sky');
    expect(traceKindOf(['bug'])).toBe('tree');
    expect(traceKindOf(['water', 'bug'])).toBe('water');
    expect(traceKindOf(['bug', 'ghost'])).toBe('shadow');
    expect(traceKindOf(['bug', 'rock'])).toBe('ground');
  });

  it('같은 자리는 늘 같은 포켓몬 (확장 · 웹뷰 누가 계산해도)', () => {
    expect(planWild('forest-1', 42, spot(3, 0.2))).toEqual(planWild('forest-1', 42, spot(3, 0.2)));
    expect(createWild('forest-1', 42, spot(3, 0.2))).toEqual(createWild('forest-1', 42, spot(3, 0.2)));
  });

  it('레벨대 안에서 진행 % 에 따라 오름 · 센 흔적은 위끝 + 2 · 비율 (센 약 15% · 노말 · 비행 약 30% · 드문 타입은 나머지의 10% = 약 7% · 이로치 약 2%)', () => {
    let strong = 0;
    let rare = 0;
    let shiny = 0;
    let shinyCapable = 0;
    const N = 4000;
    const rarePool = new Set(forestPool('forest-1').rare);
    const mixedPool = new Set(forestPool('forest-1').mixed);
    let mixed = 0;
    let early = 0;
    let late = 0;
    for (let i = 0; i < N; i++) {
      const at = (i % 100) / 100;
      const p = planWild('forest-1', mixSeed(i, 5), spot(i, at));
      if (p.strong) {
        strong++;
        expect(p.level).toBe(HI1 + BALANCE.strongLevelBonus);
      } else {
        expect(p.level).toBeGreaterThanOrEqual(LO1);
        expect(p.level).toBeLessThanOrEqual(HI1);
        if (at < 0.2) early += p.level;
        if (at >= 0.8) late += p.level;
      }
      if (formOf(p.form)?.shiny) shinyCapable++;
      if (p.shiny) {
        shiny++;
        expect(formOf(p.form)?.shiny).toBe(true);
      }
      if (rarePool.has(speciesOf(p.dex)?.evolvesFrom ?? -1) || rarePool.has(p.dex)) rare++;
      if (mixedPool.has(speciesOf(p.dex)?.evolvesFrom ?? -1) || mixedPool.has(p.dex)) mixed++;
    }
    // 노말 · 비행 30% · 독 · 드래곤 · 페어리는 나머지의 10% (= 7%)
    expect(mixed / N).toBeGreaterThan(0.26);
    expect(mixed / N).toBeLessThan(0.34);
    expect(strong / N).toBeGreaterThan(0.12);
    expect(strong / N).toBeLessThan(0.18);
    expect(rare / N).toBeGreaterThan(0.05);
    expect(rare / N).toBeLessThan(0.09);
    expect(shiny / shinyCapable).toBeGreaterThan(0.01);
    expect(shiny / shinyCapable).toBeLessThan(0.035);
    expect(late).toBeGreaterThan(early);
  });

  it('만난 야생 포켓몬: 레벨 · 그림이 계획대로 · HP 가득 · 기술은 그 레벨까지 배우는 것 중 레벨대로 (없으면 빈 목록 = 1 공격만)', () => {
    for (let i = 0; i < 50; i++) {
      const s = spot(i, i / 50);
      const plan = planWild('forest-2', 77, s);
      const m = createWild('forest-2', 77, s);
      expect(m).toMatchObject({ uid: 'wild', species: plan.dex, form: plan.form, level: plan.level, shiny: plan.shiny, caughtAt: 'forest-2', status: null });
      expect(m.moves.length).toBeLessThanOrEqual(plan.level >= 11 ? 3 : 2);
      for (const x of m.moves) expect(moveOf(x.moveId)).toBeDefined();
      expect(m.hp).toBeGreaterThan(0);
    }
  });
});

describe('전투 시작 상태 (mvp-spec 3.2 · 4장)', () => {
  it('기습 확률: 상대 스피드가 내 1.5배 이상 10% · 2배 이상 20%', () => {
    expect(ambushChance(20, 10)).toBe(0.2);
    expect(ambushChance(15, 10)).toBe(0.1);
    expect(ambushChance(14.9, 10)).toBe(0);
    expect(ambushChance(5, 0)).toBe(0);
  });

  it('Space: 기습이 아니면 선제공격 · 기습이면 막아냄 (보통) / 안 누름: 기습이면 기습당함 · 아니면 보통', () => {
    expect(resolveStart(false, true)).toBe('preemptive');
    expect(resolveStart(true, true)).toBe('normal');
    expect(resolveStart(true, false)).toBe('ambush');
    expect(resolveStart(false, false)).toBe('normal');
  });
});

describe('걷는 동안 발견 (gdd 4.6)', () => {
  it('떨어진 아이템: 몬스터볼 · 상처약 · 돈 (레벨대 위끝 × 10원) · 진화의 돌, 대략 40 · 30 · 25 · 5%', () => {
    const n: Record<string, number> = { ball: 0, potion: 0, money: 0, stone: 0 };
    for (let i = 0; i < 4000; i++) {
      const p = pickupAt('forest-1', mixSeed(i, 3), { kind: 'item', at: 0.5, index: i % 30 });
      if (p.item === 'poke-ball') n.ball!++;
      else if (p.item === 'potion') n.potion!++;
      else if (p.money !== undefined) {
        n.money!++;
        expect(p.money).toBe(HI1 * BALANCE.pickupMoneyPerLevel);
      } else {
        n.stone!++;
        expect(['leaf-stone', 'moon-stone']).toContain(p.item);
      }
    }
    expect(n.ball! / 4000).toBeCloseTo(0.4, 1);
    expect(n.potion! / 4000).toBeCloseTo(0.3, 1);
    expect(n.money! / 4000).toBeCloseTo(0.25, 1);
    expect(n.stone! / 4000).toBeLessThan(0.08);
  });

  it('배경 속 포켓몬: 그림이 있는 포켓몬 · 나무 위 또는 하늘 · 같은 자리는 늘 같음', () => {
    const l = stageLayout('forest-1', 5);
    for (const s of l.scenery) {
      const a = sceneryAt('forest-1', 5, s.index);
      expect(a).toEqual(sceneryAt('forest-1', 5, s.index));
      expect(formOf(a.form)).toBeDefined();
      expect(['tree', 'sky']).toContain(a.place);
    }
  });
});
