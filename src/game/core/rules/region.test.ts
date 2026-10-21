import { describe, expect, it } from 'vitest';
import { BALANCE } from '../balance';
import { STAGE_IDS } from '../save';
import { REGIONS, regionAceLevel, regionGymTeam, regionLevelBand, regionOf, regionOrder } from './region';
import { stageCode, stageLevelBand } from './stage';
import { GYM_LEADER, leaderTeam, trainerInfo } from './trainer';

describe('지역 표 (gdd 5.1 · 5.2 — orders #35)', () => {
  it('숲 줄 = 예전 값 그대로 — 스테이지 · 번호 · 레벨대 · 관장 · 트레이너 (보이는 것 · 숫자가 같음)', () => {
    expect(REGIONS.forest.stages.map((s) => s.id)).toEqual([...STAGE_IDS]);
    expect(STAGE_IDS.map(stageCode)).toEqual(['1-1', '1-2', '1-3']);
    for (const id of STAGE_IDS) expect(stageLevelBand(id)).toEqual(BALANCE.stageLevels[id]);
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
