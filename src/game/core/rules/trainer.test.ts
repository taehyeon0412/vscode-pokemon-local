import { describe, expect, it } from 'vitest';
import { BALANCE } from '../balance';
import { STAGE_IDS } from '../save';
import { evolutionsOf, formsOfSpecies, speciesOf } from '../../data';
import { baseTotal, devolveForLevel } from './encounter';
import { stageLayout, stageLevelBand, trainerCount, trainerId } from './stage';
import { leaderTeam, trainerInfo, trainerTeam, trainerTeamSize, shortTrainerName, withShortFoe } from './trainer';

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

  it('사람 (이름 · 옷) 은 늘 같음 · 데리고 나오는 포켓몬 수는 내 살아 있는 포켓몬 + 1 까지 · 레벨 = 레벨대 가운데 (위끝 → 가운데: 단계 11, 2026-10-19 태현 님)', () => {
    expect(trainerInfo('forest-1', 0)).toEqual(trainerInfo('forest-1', 0));
    expect(trainerInfo('forest-1', 0).name).toMatch(/ /);
    for (let seed = 1; seed < 40; seed++) {
      expect(trainerTeamSize(seed, 0, 1)).toBeLessThanOrEqual(2);
      const team = trainerTeam('forest-2', seed, 1, 5);
      expect(team.length).toBeGreaterThanOrEqual(1);
      expect(team.length).toBeLessThanOrEqual(3);
      for (const m of team) {
        const [lo, hi] = stageLevelBand('forest-2');
        expect(m.level).toBe(Math.round((lo + hi) / 2));
        expect(formsOfSpecies(m.species).length).toBeGreaterThan(0);
      }
    }
    expect(trainerTeam('forest-1', 7, 0, 3)).toEqual(trainerTeam('forest-1', 7, 0, 3));
  });

  it('옷은 주인공의 짙은 파랑 옷 (#2f6fd0, Hero.tsx) 과 다름 — 모자만으로 구별하지 않게 (플레이 리뷰 단계 10)', () => {
    for (const id of STAGE_IDS) {
      for (let i = 0; i < trainerCount(id); i++) expect(trainerInfo(id, i).shirt.toLowerCase()).not.toBe('#2f6fd0');
    }
  });
});

describe('트레이너 포켓몬은 그 레벨에 맞는 모습 · 아주 센 포켓몬은 안 씀 (orders #32 — 1-3 펜드라 Lv12 에게 44번 짐)', () => {
  it('종족값 bigBaseTotal 넘는 포켓몬 없음 · 진화형이면 그 레벨로 될 수 있는 진화', () => {
    let checked = 0;
    for (const id of STAGE_IDS) {
      for (let seed = 1; seed <= 60; seed++) {
        for (let n = 0; n < trainerCount(id); n++) {
          for (const m of trainerTeam(id, seed, n, 6, 3)) {
            const s = speciesOf(m.species)!;
            expect(baseTotal(s)).toBeLessThanOrEqual(BALANCE.bigBaseTotal);
            const from = s.evolvesFrom;
            if (from && speciesOf(from) && formsOfSpecies(from).length > 0) {
              const e = evolutionsOf(from).find((x) => x.to === m.species);
              expect(e?.kind === 'level' ? (e.level ?? 1) <= m.level : e?.kind === 'friendship' ? BALANCE.friendshipLevel <= m.level : false).toBe(true);
            }
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(500);
  });
  it('진화 전으로 — 레벨이 모자라면 앞 진화로 · 진화 전이 없으면 그대로', () => {
    // 버터플 (트랜셀 Lv10 → 버터플) — Lv8 이면 트랜셀까지 · Lv7 이면 캐터피 아님 (트랜셀은 Lv7)
    expect(devolveForLevel(12, 12)).toBe(12);
    expect(devolveForLevel(12, 8)).toBe(11);
    expect(devolveForLevel(12, 5)).toBe(10);
    // 헤라크로스 — 진화 전 없음
    expect(devolveForLevel(214, 3)).toBe(214);
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

describe('직함을 뺀 이름 (orders #20)', () => {
  it('마지막 낱말 · 직함이 없으면 그대로 · 말 안의 이름만 바꿈', () => {
    expect(shortTrainerName('엘리트 트레이너 소율')).toBe('소율');
    expect(shortTrainerName('관장 나래')).toBe('나래');
    expect(shortTrainerName('소율')).toBe('소율');
    expect(withShortFoe('엘리트 트레이너 소율은 다음 포켓몬을 꺼낸다…', '엘리트 트레이너 소율')).toBe('소율은 다음 포켓몬을 꺼낸다…');
    expect(withShortFoe('야생 파이리가 쓰러졌다!', null)).toBe('야생 파이리가 쓰러졌다!');
    // 숲 트레이너 모두 — 짧은 이름이 직함보다 짧음
    for (let n = 0; n < 9; n++) expect(shortTrainerName(trainerInfo('forest-1', n).name).length).toBeLessThan(trainerInfo('forest-1', n).name.length);
  });
});
