import { describe, expect, it } from 'vitest';
import { BALANCE } from '../balance';
import { mixSeed, spotBetween, stageLayout, walkDelta } from './stage';

const SEEDS = Array.from({ length: 60 }, (_, i) => mixSeed(i, 99));
const count = (xs: readonly { kind: string }[], k: string) => xs.filter((x) => x.kind === k).length;
const within = (n: number, [lo, hi]: readonly [number, number]) => n >= lo && n <= hi;

describe('스테이지 길 (mvp-spec 3.2 · gdd 4.5 · 4.6)', () => {
  it('같은 시드면 같은 길 · 다른 시드면 다른 길', () => {
    expect(stageLayout('forest-1', 42)).toEqual(stageLayout('forest-1', 42));
    expect(stageLayout('forest-1', 42).spots).not.toEqual(stageLayout('forest-1', 43).spots);
  });

  it.each(SEEDS)('시드 %i: 야생 12~18 · 아이템 4~6 · 부탁 1~2 · 병원 1~2 · 상점 1~2 · 배경 포켓몬 10~16', (seed) => {
    const l = stageLayout('forest-2', seed);
    expect(within(count(l.spots, 'wild'), BALANCE.stageWild)).toBe(true);
    expect(within(count(l.spots, 'item'), BALANCE.stageItems)).toBe(true);
    expect(within(count(l.spots, 'request'), BALANCE.stageRequests)).toBe(true);
    expect(within(count(l.facilities, 'hospital'), BALANCE.stageHospitals)).toBe(true);
    expect(within(count(l.facilities, 'shop'), BALANCE.stageShops)).toBe(true);
    expect(within(l.scenery.length, BALANCE.stageScenery)).toBe(true);
  });

  it.each(SEEDS)('시드 %i: 자리는 순서대로 · 구간 안 · 서로 붙지 않음 · 시설 바로 앞에 없음 · 시설은 중간쯤', (seed) => {
    const l = stageLayout('forest-1', seed);
    const at = l.spots.map((s) => s.at);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(at[0]!).toBeGreaterThan(0.02);
    expect(at[at.length - 1]!).toBeLessThan(0.99);
    for (let i = 1; i < at.length; i++) expect(at[i]! - at[i - 1]!).toBeGreaterThan(0.005);
    for (const f of l.facilities) {
      expect(f.at).toBeGreaterThanOrEqual(BALANCE.stageFacilityRange[0]);
      expect(f.at).toBeLessThanOrEqual(BALANCE.stageFacilityRange[1]);
      for (const s of l.spots) expect(Math.abs(s.at - f.at)).toBeGreaterThan(0.011);
    }
    expect(new Set(l.spots.map((s) => s.index)).size).toBe(l.spots.length);
  });

  it('지나친 첫 자리: from < at ≤ to (멈춰 선 자리는 다시 안 걸림)', () => {
    const l = stageLayout('forest-1', 7);
    const first = l.spots[0]!;
    expect(spotBetween(l, 0, first.at - 0.0001)).toBeNull();
    expect(spotBetween(l, 0, first.at)).toEqual(first);
    expect(spotBetween(l, first.at, first.at + 0.000001)).toBeNull();
    expect(spotBetween(l, first.at - 0.000001, 1)).toEqual(first);
  });

  it('걷는 시간 15분 = 진행 100% (15분 → 20분 단계 11 → 15분 2026-10-19 밤 태현 님 "루즈해" + 빨리 걷기)', () => {
    expect(walkDelta(BALANCE.stageWalkMs)).toBeCloseTo(1);
    expect(walkDelta(50) * (20 * 60 * 15)).toBeCloseTo(1);
  });
});

describe('병원 · 상점 자리는 세이브 쪽이 기준 (코드 리뷰어)', () => {
  it('세이브에 적힌 자리가 시드로 만든 자리와 같으면 길도 같음', () => {
    const fresh = stageLayout('forest-1', 42);
    expect(stageLayout('forest-1', 42, fresh.facilities)).toEqual(fresh);
  });

  it('세이브에 다른 자리가 적혀 있으면 그 자리를 그림 · 만나는 자리도 그 시설에서 띄움', () => {
    const saved = [{ kind: 'hospital' as const, at: 0.5 }];
    const l = stageLayout('forest-1', 42, saved);
    expect(l.facilities).toEqual(saved);
    for (const s of l.spots) expect(Math.abs(s.at - 0.5)).toBeGreaterThan(0.011);
  });
});
