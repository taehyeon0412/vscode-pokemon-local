import { afterEach, describe, expect, it } from 'vitest';
import { sampleMonster, sampleSave } from '../../../test/fixtures/save';
import { BALANCE } from '../balance';
import { expGain, idleExpScale } from '../rules/growth';
import { freeBall, setRegionOrder } from '../rules/region';
import { rivalTeamSize } from '../rules/rival';
import { defeatLoss, defeatPenalty, stageClearExp, stageClearGain } from './rewards';
import { awaySummary } from './play';
import { readRuntime } from './state';

type Draft = { -readonly [K in keyof typeof BALANCE.draft52]: (typeof BALANCE.draft52)[K] };
const draft = BALANCE.draft52 as Draft;
const was = { ...draft };

describe('5.2 숫자 [임시값] (orders #69 — 태현 님 "추천대로 해줘" 켬) · 끄면 예전 규칙', () => {
  afterEach(() => {
    Object.assign(draft, was);
    setRegionOrder(null);
  });

  it('게임 값은 모두 켬', () => {
    expect([draft.idleExp, draft.rivalByRegion, draft.freeBallTier, draft.loseMoneyCap]).toEqual([true, true, true, true]);
  });

  it('방치 경험치 — 켜면 상대 레벨 대신 스테이지 위끝과 견줌 (+5 ×0.5 · +8 ×0.25 · +12 ×0.1) · 꺼지면 상대가 5 낮을 때 ×0.5', () => {
    expect([4, 5, 7, 8, 11, 12, 30].map((over) => idleExpScale(20 + over, 20))).toEqual([1, 0.5, 0.5, 0.25, 0.25, 0.1, 0.1]);
    const foe = { species: 10, level: 4 };
    // 꺼짐: Lv 30 이 Lv 4 상대 → ×0.5 (상대 기준)
    draft.idleExp = false;
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
    draft.rivalByRegion = false;
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
    draft.freeBallTier = false;
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
    draft.loseMoneyCap = false;
    expect(defeatPenalty(rich, false).lost).toBe(10_000);
    draft.loseMoneyCap = true;
    // 숲 1-1 위끝 4 × 50 = 200
    expect(defeatPenalty(rich, false).lost).toBe(200);
    expect(defeatPenalty({ ...rich, money: 1000 }, false).lost).toBe(100);
    expect(defeatPenalty(rich, true).lost).toBe(0);
  });
});

describe('#70 리뷰 고침 (코드 리뷰어 · 테스터)', () => {
  it('질 때 잃는 돈 — 1:1 · 3:3 일부 패배가 같은 함수 (5.2 상한)', () => {
    const rich = sampleSave({ money: 100_000, location: { screen: 'stage', stageId: 'beach-1' } });
    expect(defeatLoss(rich, false)).toBe(900);
    expect(defeatPenalty(rich, false).lost).toBe(defeatLoss(rich, false));
  });

  it('클리어 보너스 표시 = 선두가 받는 값 (방치면 줄어든 값)', () => {
    const base = sampleSave();
    const strong = { ...base, monsters: { ...base.monsters, m1: { ...base.monsters.m1!, level: 30 } } };
    expect(stageClearGain(base, 'forest-1')).toBe(stageClearExp(base, 'forest-1'));
    expect(stageClearGain(strong, 'forest-1')).toBe(Math.round(stageClearExp(strong, 'forest-1') * 0.1));
  });

  it('안 보는 동안 연 지역 — 그동안 요약에 한 줄 (U6) · 결과 상자 easy 칸이 넘기기에서 남음', () => {
    const save = { ...sampleSave(), regions: { order: ['forest' as const, 'beach' as const] } };
    const log = { money: save.money, bag: save.bag, wild: 0, regions: 1 };
    expect(awaySummary(log, save).join(' ')).toContain('새 지역 해변');
    const summary = { title: 't', exp: [{ uid: 'm1', name: 'a', gain: 1, from: 5, to: 5, easy: 0.25 }], money: 0, item: null, caught: null, learned: [], choices: 0, badge: null };
    const rt = readRuntime(JSON.parse(JSON.stringify({ stage: { phase: 'result', summary, ms: 0 } })), 1);
    expect(rt.stage?.phase === 'result' && rt.stage.summary.exp[0]?.easy).toBe(0.25);
  });
});
