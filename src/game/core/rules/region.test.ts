import { describe, expect, it } from 'vitest';
import { BALANCE } from '../balance';
import { STAGE_IDS } from '../save';
import { sampleSave, viaJson } from '../../../test/fixtures/save';
import { startTrainerBattle } from '../engine/battle';
import { nextStageOf, stageUnlocked } from '../engine/play';
import { battleRewards } from '../engine/rewards';
import { Rng } from '../engine/rng';
import { validateSave } from '../save';
import { regionPool } from './encounter';
import { BEACH_REQUESTS, requestAt } from './request';
import { REGIONS, regionAceLevel, regionGymMoney, regionGymTeam, regionLevelBand, regionOf, regionOrder } from './region';
import { stageCode, stageLevelBand } from './stage';
import { GYM_LEADER, gymHint, leaderTeam, trainerInfo, trainerTeam } from './trainer';

describe('지역 표 (gdd 5.1 · 5.2 — orders #35)', () => {
  it('숲 줄 = 예전 값 그대로 — 스테이지 · 번호 · 레벨대 · 관장 · 트레이너 (보이는 것 · 숫자가 같음)', () => {
    expect(REGIONS.forest.stages.map((s) => s.id)).toEqual([...STAGE_IDS]);
    expect(STAGE_IDS.map(stageCode)).toEqual(['1-1', '1-2', '1-3']);
    for (const id of STAGE_IDS) expect(stageLevelBand(id)).toEqual(BALANCE.stageLevels[id as keyof typeof BALANCE.stageLevels]);
    expect(regionOrder('forest')).toBe(1);
    expect(regionGymTeam(REGIONS.forest, 1)).toEqual(BALANCE.gymTeam);
    expect(leaderTeam().map((m) => [m.species, m.level])).toEqual(BALANCE.gymTeam.map(([d, l]) => [d, l]));
    expect(GYM_LEADER.name).toBe('관장 나래');
    expect(trainerInfo('forest-1', 0).name).toBe('반바지 꼬마 민수');
    expect(trainerInfo('forest-2', 0).name).toBe('짧은치마 서연');
    expect(regionOf('forest-3')).toMatchObject({ index: 2 });
  });

  it('몇 번째 지역 레벨표 — 에이스 15 + 6 × (k − 1) · 스테이지 g−8 ~ g−5 / g−5 ~ g−2 / g−3 ~ g (k = 1 은 숲 그대로)', () => {
    expect([1, 2, 3, 8].map(regionAceLevel)).toEqual([15, 21, 27, 57]);
    expect([0, 1, 2].map((i) => regionLevelBand(2, i))).toEqual([[13, 16], [16, 19], [18, 21]]);
    expect(regionLevelBand(1, 0, 'forest-1')).toEqual([2, 4]);
    // 셋 묶음 — 에이스 = g, 앞은 g−2 · g−1 (해변 2번째 = 19 · 20 · 21 — gdd 5.3)
    expect(regionGymTeam(REGIONS.forest, 2).map(([, lv]) => lv)).toEqual([19, 20, 21]);
  });
});

describe('해변 한 벌 (gdd 5.3 — orders #37, 개발 모드 미리 보기 · 2번째 지역)', () => {
  it('스테이지 셋 · 2번째 지역 레벨 (13 ~ 16 / 16 ~ 19 / 18 ~ 21) · 번호 2-1 · 다음 스테이지 · 열림', () => {
    expect(REGIONS.beach.stages.map((x) => x.name)).toEqual(['반짝 모래길', '갯바위 해안', '등대 곶']);
    expect(['beach-1', 'beach-2', 'beach-3'].map((id) => stageLevelBand(id as 'beach-1'))).toEqual([[13, 16], [16, 19], [18, 21]]);
    expect(stageCode('beach-1')).toBe('2-1');
    expect(nextStageOf('beach-1')).toBe('beach-2');
    expect(nextStageOf('beach-3')).toBe('gym');
    expect(nextStageOf('forest-3')).toBe('gym');
    const save = sampleSave();
    expect(stageUnlocked(save, 'beach-1')).toBe(false);
    expect(stageUnlocked({ ...save, badges: ['forest'] }, 'beach-1')).toBe(true);
  });

  it('스테이지마다 정한 종 (8 · 8 · 12) — 강한 1단계 · 드묾은 마지막 스테이지만 · 트레이너는 종족값 큰 것을 안 씀', () => {
    expect(regionPool('beach-1').common).toEqual([54, 118, 183, 194, 278, 422, 129, 418]);
    expect(regionPool('beach-2').common).toHaveLength(8);
    expect(regionPool('beach-3').common).toEqual([170, 456, 72, 86, 366, 318, 223, 60, 131, 594]);
    expect(regionPool('beach-3').rare).toEqual([349, 140]);
    expect(regionPool('beach-1').rare).toEqual([]);
    for (let n = 0; n < 3; n++) for (const m of trainerTeam('beach-3', 77, n, 6, 3)) expect([131, 594]).not.toContain(m.species);
  });

  it('트레이너 9 · 부탁 5 · 관장 해솔 셋 묶음 (2번째 = 쏘드라 19 · 별가사리 20 · 에이스 아쿠스타 21)', () => {
    expect(trainerInfo('beach-1', 0)).toMatchObject({ name: '튜브 꼬마 준호', look: 'frlg-tuber-m' });
    expect(REGIONS.beach.trainers).toHaveLength(9);
    expect(new Set(Array.from({ length: 5 }, (_, n) => requestAt(42, n, 'beach-2').id))).toEqual(new Set(BEACH_REQUESTS.map((r) => r.id)));
    expect(requestAt(42, 0, 'forest-1').id).toBe(requestAt(42, 0).id);
    expect(leaderTeam(REGIONS.beach).map((m) => [m.species, m.level])).toEqual([[116, 19], [120, 20], [121, 21]]);
    expect(regionGymTeam(REGIONS.beach, 5).map(([d]) => d)).toEqual([55, 131, 130]);
    expect(regionGymTeam(REGIONS.beach, 8).map(([d, lv]) => [d, lv])).toEqual([[99, 55], [171, 56], [350, 57]]);
    expect(gymHint({ ...sampleSave(), location: { screen: 'gym', region: 'beach' } }).text).toContain('관장 해솔은');
  });

  it('등대 곶 끝 → 해변 체육관 · 관장 첫 승 = 해변 배지 + 4,000원 (1,000 × (2 + 2)) + 물의 돌', () => {
    const save = { ...sampleSave(), badges: ['forest'], location: { screen: 'gym' as const, region: 'beach' as const } };
    expect(validateSave(viaJson(save)).ok && (validateSave(viaJson(save)) as { save: { location: unknown } }).save.location).toEqual({ screen: 'gym', region: 'beach' });
    const b = startTrainerBattle(save, leaderTeam(REGIONS.beach), 'gym', REGIONS.beach.leader.name);
    const r = battleRewards(save, { ...b, result: 'win' }, null, 'gym', new Rng(1));
    expect(r.save.badges).toContain('beach');
    expect(r.summary.money).toBe(4000);
    expect(r.save.bag['water-stone']).toBe((save.bag['water-stone'] ?? 0) + 1);
    expect(r.summary.badge).toBe('해변 배지');
    expect(regionGymMoney(1)).toBe(BALANCE.gymFirstMoney);
  });
});

