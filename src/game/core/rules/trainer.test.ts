import { describe, expect, it } from 'vitest';
import { BALANCE } from '../balance';
import { STAGE_IDS } from '../save';
import { formsOfSpecies } from '../../data';
import { stageLayout, stageLevelBand, trainerCount, trainerId } from './stage';
import { leaderTeam, trainerInfo, trainerTeam, trainerTeamSize } from './trainer';

describe('트레이너 (mvp-spec S08 · 4장)', () => {
  it('스테이지마다 2 ~ 3명 — 수는 시드와 상관없이 같고, 길 순서로 t0 · t1 …', () => {
    for (const id of STAGE_IDS) {
      const n = trainerCount(id);
      expect(n).toBeGreaterThanOrEqual(BALANCE.stageTrainers[0]);
      expect(n).toBeLessThanOrEqual(BALANCE.stageTrainers[1]);
      for (const seed of [1, 42, 999]) {
        const spots = stageLayout(id, seed).spots.filter((s) => s.kind === 'trainer');
        expect(spots.map((s) => s.trainer)).toEqual([...Array(n).keys()]);
      }
    }
    expect(trainerId('forest-2', 1)).toBe('forest-2:t1');
  });

  it('사람 (이름 · 옷) 은 늘 같음 · 데리고 나오는 포켓몬 수는 내 살아 있는 포켓몬 + 1 까지 · 레벨 = 레벨대 위끝', () => {
    expect(trainerInfo('forest-1', 0)).toEqual(trainerInfo('forest-1', 0));
    expect(trainerInfo('forest-1', 0).name).toMatch(/ /);
    for (let seed = 1; seed < 40; seed++) {
      expect(trainerTeamSize(seed, 0, 1)).toBeLessThanOrEqual(2);
      const team = trainerTeam('forest-2', seed, 1, 5);
      expect(team.length).toBeGreaterThanOrEqual(1);
      expect(team.length).toBeLessThanOrEqual(3);
      for (const m of team) {
        expect(m.level).toBe(stageLevelBand('forest-2')[1]);
        expect(formsOfSpecies(m.species).length).toBeGreaterThan(0);
      }
    }
    expect(trainerTeam('forest-1', 7, 0, 3)).toEqual(trainerTeam('forest-1', 7, 0, 3));
  });
});

describe('숲 관장 (mvp-spec 3.9)', () => {
  it('파라스 Lv 13 · 냄새꼬 Lv 14 · 에이스 버터플 Lv 15 — 늘 같은 3마리 · 기술은 피해 기술 먼저', () => {
    const team = leaderTeam();
    expect(team.map((m) => [m.species, m.level])).toEqual([
      [46, 13],
      [44, 14],
      [12, 15],
    ]);
    expect(leaderTeam()).toEqual(team);
    for (const m of team) expect(m.moves.length).toBeGreaterThan(0);
  });
});
