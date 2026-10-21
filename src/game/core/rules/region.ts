/**
 * 지역 표 (gdd 5.1 · 5.2, orders #35) — 지역 하나 = 한 줄: 스테이지 셋 · 나오는 종 · 트레이너 9 · 관장 (셋 묶음) · 배지.
 * 레벨은 지역마다 적지 않음 — "몇 번째 지역" (k) 레벨표가 정함 (5.2, k = 1 은 지금 숲 숫자 그대로). 지금 진짜 게임은 숲 (k = 1) 하나 —
 * 숲 줄은 예전 코드 값을 그대로 옮김 (trainer.ts FOREST_TRAINERS · GYM_LEADER · balance.ts stageLevels · gymTeam · encounter.ts 숲 타입).
 */
import { BALANCE } from '../balance';
import type { StageId } from '../save';
import type { TypeName } from '../../data';

export type RegionId = 'forest';

export interface RegionStage {
  id: StageId;
  /** "새싹 오솔길" */
  name: string;
  /** 화면 이름표 그림 (features/stage) */
  icon: string;
}

export interface RegionTrainer {
  title: string;
  name: string;
  /** 사람 그림 (data/people.ts id) */
  look: string;
}

export interface RegionLeader {
  name: string;
  title: string;
  /** 그림이 없을 때 코드로 그린 사람 색 */
  hat: string;
  shirt: string;
  look: string;
  /** 셋 묶음 (5.1 [제안]) — 초반 (1 ~ 3번째) · 중반 (4 ~ 6) · 후반 (7 ~ 8). 마지막이 에이스. 숲은 아직 초반 하나 (k = 1 = 예전 gymTeam) */
  teams: { early: readonly number[]; mid?: readonly number[]; late?: readonly number[] };
}

export interface RegionDef {
  id: RegionId;
  /** "숲" */
  name: string;
  /** 받은 배지 이름 (save.badges) */
  badge: string;
  stages: readonly [RegionStage, RegionStage, RegionStage];
  /** 나오는 종 — 타입으로 자동 (숲): 흔함 · 드묾 (노말 · 비행 섞기는 BALANCE.mixedTypeChance) */
  wild: { common: readonly TypeName[]; rare: readonly TypeName[] };
  trainers: readonly RegionTrainer[];
  leader: RegionLeader;
}

export const REGIONS: Readonly<Record<RegionId, RegionDef>> = {
  forest: {
    id: 'forest',
    name: '숲',
    badge: 'forest',
    stages: [
      { id: 'forest-1', name: '새싹 오솔길', icon: 'tree' },
      { id: 'forest-2', name: '버섯 그늘길', icon: 'mushroom' },
      { id: 'forest-3', name: '깊은 숲', icon: 'oak' },
    ],
    wild: { common: ['grass', 'bug'], rare: ['poison', 'dragon', 'fairy'] },
    // 스테이지 3개 × 최대 3명 = 9자리, 칭호 · 원작 그림 (data/people.ts) · 이름이 다 다름 (2026-10-19 태현 님) — 이름은 예시
    trainers: [
      { title: '반바지 꼬마', name: '민수', look: 'frlg-youngster' },
      { title: '곤충채집 소년', name: '지호', look: 'frlg-bug-catcher' },
      { title: '짧은치마', name: '서연', look: 'frlg-lass' },
      { title: '피크닉 소녀', name: '하은', look: 'frlg-picnicker' },
      { title: '쌍둥이', name: '유나', look: 'em-twin' },
      { title: '학원생', name: '도윤', look: 'em-school-kid' },
      { title: '등산가', name: '현우', look: 'frlg-hiker' },
      { title: '엘리트 트레이너', name: '소율', look: 'frlg-cooltrainer-f' },
      { title: '포켓몬 애호가', name: '다인', look: 'em-pokefan-f' },
    ],
    // 그림 = 원작 풀 타입 관장 민화 (2026-10-19) · 초반 = 파라스 · 냄새꼬 · 에이스 버터플 (mvp-spec 3.9)
    leader: { name: '관장 나래', title: '숲 체육관 관장', hat: '#9a6f12', shirt: '#e3b341', look: 'frlg-erika', teams: { early: [46, 44, 12] } },
  },
};

/** 그 스테이지의 지역 · 지역 안 순서 (0 ~ 2) */
export function regionOf(stageId: StageId): { region: RegionDef; index: number } {
  for (const region of Object.values(REGIONS)) {
    const index = region.stages.findIndex((s) => s.id === stageId);
    if (index >= 0) return { region, index };
  }
  throw new Error(`지역 표에 없는 스테이지: ${stageId}`);
}

/**
 * 몇 번째 지역인지 (k, 1 부터) — 시작은 숲 고정 (2026-10-22 태현 님 7-3). 지금 진짜 게임은 숲 하나라 늘 1.
 * 다음 지역을 열면 세이브의 지역 순서 칸 (#30, 세이브 4판) 에서 셈
 */
export function regionOrder(_region: RegionId): number {
  return 1;
}

/** 관장 에이스 레벨 g = 15 + 6 × (k − 1) (5.2 [임시값]) */
export function regionAceLevel(k: number): number {
  return 15 + 6 * (Math.max(1, k) - 1);
}

/** 스테이지 레벨대 — k = 1 은 지금 숲 숫자 그대로 (BALANCE.stageLevels) · k ≥ 2 는 g−8 ~ g−5 / g−5 ~ g−2 / g−3 ~ g (5.2) */
export function regionLevelBand(k: number, index: number, stageId?: StageId): readonly [number, number] {
  if (k <= 1 && stageId && stageId in BALANCE.stageLevels) return BALANCE.stageLevels[stageId as keyof typeof BALANCE.stageLevels];
  const g = regionAceLevel(k);
  const bands: readonly (readonly [number, number])[] = [
    [g - 8, g - 5],
    [g - 5, g - 2],
    [g - 3, g],
  ];
  return bands[Math.min(2, Math.max(0, index))]!;
}

/** 관장 팀 [도감 번호, 레벨] — k = 1 은 지금 숲 그대로 (BALANCE.gymTeam) · 셋 묶음 (초반 1 ~ 3 · 중반 4 ~ 6 · 후반 7 ~ 8) · 레벨 = 에이스 g, 앞은 g−2 · g−1 */
export function regionGymTeam(region: RegionDef, k: number): readonly (readonly [number, number])[] {
  if (region.id === 'forest' && k <= 1) return BALANCE.gymTeam;
  const set = k >= 7 ? (region.leader.teams.late ?? region.leader.teams.mid ?? region.leader.teams.early) : k >= 4 ? (region.leader.teams.mid ?? region.leader.teams.early) : region.leader.teams.early;
  const g = regionAceLevel(k);
  return set.map((dex, i) => [dex, g - (set.length - 1 - i)] as const);
}
