import { afterEach, describe, expect, it } from 'vitest';
import { sampleMonster, sampleSave } from '../../../test/fixtures/save';
import { BALANCE } from '../balance';
import { expGain, idleExpScale } from '../rules/growth';
import { freeBall, setRegionOrder } from '../rules/region';
import { rivalTeamSize } from '../rules/rival';
import { defeatPenalty } from './rewards';

type Draft = { -readonly [K in keyof typeof BALANCE.draft52]: (typeof BALANCE.draft52)[K] };
const draft = BALANCE.draft52 as Draft;
const was = { ...draft };

describe('5.2 숫자 초안 — 꺼 둔 칸 (orders #69) · 꺼짐 = 지금 그대로', () => {
  afterEach(() => {
    Object.assign(draft, was);
    setRegionOrder(null);
  });

  it('게임 값은 모두 꺼짐', () => {
    expect([draft.idleExp, draft.rivalByRegion, draft.freeBallTier, draft.loseMoneyCap]).toEqual([false, false, false, false]);
  });

  it('방치 경험치 — 켜면 상대 레벨 대신 스테이지 위끝과 견줌 (+5 ×0.5 · +8 ×0.25 · +12 ×0.1) · 꺼지면 상대가 5 낮을 때 ×0.5', () => {
    expect([4, 5, 7, 8, 11, 12, 30].map((over) => idleExpScale(20 + over, 20))).toEqual([1, 0.5, 0.5, 0.25, 0.25, 0.1, 0.1]);
    const foe = { species: 10, level: 4 };
    // 꺼짐: Lv 30 이 Lv 4 상대 → ×0.5 (상대 기준)
    const off = expGain(foe, 30, { cap: 4 });
    expect(off).toBe(expGain(foe, 9));
    draft.idleExp = true;
    // 켬: 위끝 4 보다 +26 → ×0.1
    expect(expGain(foe, 30, { cap: 4 })).toBeLessThan(off);
    // 위끝보다 +2 → 그대로 (×1)
    expect(expGain(foe, 6, { cap: 4 })).toBe(expGain(foe, 6));
  });

  it('라이벌 마릿수 — 켜면 몇 번째 지역 (1번째 1 · 2 ~ 3번째 2 · 4번째부터 3 · 살아 있는 + 1 상한) · 꺼지면 전적', () => {
    const team = ['m1', 'm2', 'm3', 'm4'];
    const save = { ...sampleSave(), monsters: Object.fromEntries(team.map((uid) => [uid, sampleMonster({ uid })])), party: team, rivals: { blue: { wins: 2, losses: 1 } } };
    expect(rivalTeamSize(save, 'blue', 'forest-1')).toBe(3);
    draft.rivalByRegion = true;
    expect(rivalTeamSize(save, 'blue', 'forest-1')).toBe(1);
    expect(rivalTeamSize(save, 'blue', 'beach-1')).toBe(2);
    setRegionOrder(['forest', 'a', 'b', 'beach'] as never);
    expect(rivalTeamSize(save, 'blue', 'beach-1')).toBe(3);
    expect(rivalTeamSize({ ...save, party: ['m1'] }, 'blue', 'beach-1')).toBe(2);
  });

  it('공짜 볼 — 켜면 1 ~ 2번째 몬스터볼 · 3 ~ 5 슈퍼볼 · 6 ~ 8 하이퍼볼 · 꺼지면 늘 몬스터볼', () => {
    setRegionOrder(['forest', 'a', 'beach'] as never);
    expect(freeBall('beach')).toBe('poke-ball');
    draft.freeBallTier = true;
    expect(freeBall('forest')).toBe('poke-ball');
    expect(freeBall('beach')).toBe('great-ball');
    setRegionOrder(['forest', 'a', 'b', 'c', 'd', 'beach'] as never);
    expect(freeBall('beach')).toBe('ultra-ball');
    setRegionOrder(['forest', 'beach'] as never);
    expect(freeBall('beach')).toBe('poke-ball');
  });

  it('질 때 잃는 돈 — 켜면 10% 와 스테이지 위끝 × 50원 중 작은 쪽 · 관장전은 그대로 0 · 꺼지면 10%', () => {
    const rich = sampleSave({ money: 100_000, location: { screen: 'stage', stageId: 'forest-1' } });
    expect(defeatPenalty(rich, false).lost).toBe(10_000);
    draft.loseMoneyCap = true;
    // 숲 1-1 위끝 4 × 50 = 200
    expect(defeatPenalty(rich, false).lost).toBe(200);
    expect(defeatPenalty({ ...rich, money: 1000 }, false).lost).toBe(100);
    expect(defeatPenalty(rich, true).lost).toBe(0);
  });
});
