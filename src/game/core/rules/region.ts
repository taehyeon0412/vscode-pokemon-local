/**
 * 지역 표 (gdd 5.1 · 5.2, orders #35) — 지역 하나 = 한 줄: 스테이지 셋 · 나오는 종 · 트레이너 9 · 관장 (셋 묶음) · 배지.
 * 레벨은 지역마다 적지 않음 — "몇 번째 지역" (k) 레벨표가 정함 (5.2, k = 1 은 지금 숲 숫자 그대로). 지금 진짜 게임은 숲 (k = 1) 하나 —
 * 숲 줄은 예전 코드 값을 그대로 옮김 (trainer.ts FOREST_TRAINERS · GYM_LEADER · balance.ts stageLevels · gymTeam · encounter.ts 숲 타입).
 */
import { BALANCE } from '../balance';
import type { ItemId, RegionId, StageId } from '../save';
import type { TypeName } from '../../data';

export type { RegionId } from '../save';

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
  /**
   * 나오는 종 — 타입으로 자동 (숲): 흔함 · 드묾 (노말 · 비행 섞기는 BALANCE.mixedTypeChance) ·
   * 스테이지마다 정한 목록 (해변 — gdd 5.3): lists[i] = 그 스테이지 흔함 · strong = 마지막 스테이지에 더하는 강한 1단계 (야생에서만) · rareList = 마지막 스테이지 드묾
   */
  wild: { common: readonly TypeName[]; rare: readonly TypeName[]; lists?: readonly (readonly number[])[]; strong?: readonly number[]; rareList?: readonly number[] };
  /** 길에서 주울 수 있는 진화의 돌 */
  stones: readonly ItemId[];
  /** 배경 속 포켓몬 (보기만) — 하늘 · 땅 (없으면 날 수 있는 포켓몬 · 흔한 목록) */
  scenery?: { sky: readonly number[]; ground: readonly number[] };
  /** 받은 배지 이름 (결과 상자) · 관장 첫 승 물건 (배지 · 돈과 같이) */
  badgeName: string;
  firstWinItem: ItemId;
  /** 관장 첫 승에 더 주는 팔 물건 (숲 = 큰금구슬 — ideas #125) */
  firstWinTreasure?: ItemId;
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
    stones: ['leaf-stone', 'moon-stone'],
    badgeName: '숲 배지',
    firstWinItem: 'leaf-stone',
    firstWinTreasure: 'big-nugget',
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
  // 해변 (gdd 5.3 — 2026-10-22 밤 기획, 배경 빼고) — 개발 모드 미리 보기만 (늘 2번째 이후 — 시작은 숲 고정)
  beach: {
    id: 'beach',
    name: '해변',
    badge: 'beach',
    stages: [
      { id: 'beach-1', name: '반짝 모래길', icon: 'sparkle' },
      { id: 'beach-2', name: '갯바위 해안', icon: 'pebbles' },
      { id: 'beach-3', name: '등대 곶', icon: 'ripple' },
    ],
    wild: {
      common: ['water'],
      rare: ['ice', 'electric', 'rock'],
      lists: [
        // 반짝 모래길 — 고라파덕 · 콘치 · 마릴 · 우파 · 갈모매 · 깝질무 · 잉어킹 · 브이젤 (얕은 물 · 모래)
        [54, 118, 183, 194, 278, 422, 129, 418],
        // 갯바위 해안 — 크랩 · 셀러 · 별가사리 · 쏘드라 · 코산호 · 가재군 · 비구술 · 연꽃몬 (바위 웅덩이)
        [98, 90, 120, 116, 222, 341, 283, 270],
        // 등대 곶 — 초라기 · 형광어 · 왕눈해 · 쥬쥬 · 진주몽 · 샤프니아 · 총어 · 발챙이
        [170, 456, 72, 86, 366, 318, 223, 60],
      ],
      // 강한 1단계 (종족값 450 넘음 — 야생에서만) 라프라스 · 맘복치 · 드묾 빈티나 · 투구
      strong: [131, 594],
      rareList: [349, 140],
    },
    stones: ['water-stone'],
    // 하늘 갈모매 · 패리퍼 · 바다 잉어킹 · 만타인 [제안]
    scenery: { sky: [278, 279], ground: [129, 226] },
    badgeName: '해변 배지',
    firstWinItem: 'water-stone',
    trainers: [
      { title: '튜브 꼬마', name: '준호', look: 'frlg-tuber-m' },
      { title: '튜브 꼬마', name: '서윤', look: 'frlg-tuber-f' },
      { title: '낚시꾼', name: '만석', look: 'frlg-fisher' },
      { title: '수영팬티 소년', name: '태오', look: 'frlg-swimmer-m' },
      { title: '비키니 아가씨', name: '하린', look: 'frlg-swimmer-f' },
      { title: '뱃사람', name: '강철', look: 'frlg-sailor' },
      { title: '트라이애슬론', name: '지아', look: 'em-triathlete-f' },
      { title: '엘리트 트레이너', name: '도현', look: 'frlg-cooltrainer-m' },
      { title: '아가씨', name: '유리', look: 'frlg-beauty' },
    ],
    // 원작 이슬 그림 · 셋 묶음 — 초반 쏘드라 · 별가사리 · 에이스 아쿠스타 / 중반 골덕 · 라프라스 · 에이스 갸라도스 / 후반 킹크랩 · 랜턴 · 에이스 밀로틱
    leader: { name: '관장 해솔', title: '해변 체육관 관장', hat: '#1d5fa8', shirt: '#5fb4e8', look: 'frlg-misty', teams: { early: [116, 120, 121], mid: [55, 131, 130], late: [99, 171, 350] } },
  },
};

/** 지역 끝 스테이지인지 (끝에 체육관 — 숲 1-3 · 해변 등대 곶) */
export function isRegionLast(stageId: StageId): boolean {
  const { region, index } = regionOf(stageId);
  return index === region.stages.length - 1;
}

/** 그 지역 체육관 자리 (숲은 칸 없음 — 옛 세이브와 같게) */
export function gymLocation(region: RegionDef): { screen: 'gym'; region?: RegionId } {
  return region.id === 'forest' ? { screen: 'gym' } : { screen: 'gym', region: region.id };
}

/** 지금 어느 지역인지 — 스테이지 · 체육관 (location.region, 없으면 숲) */
export function regionHere(location: { screen: string; stageId?: StageId; region?: RegionId }): RegionDef {
  if (location.screen === 'stage' && location.stageId) return regionOf(location.stageId).region;
  if (location.screen === 'gym' && location.region) return REGIONS[location.region];
  return REGIONS.forest;
}

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
export function regionOrder(region: RegionId): number {
  // 해변 = 늘 2번째 이후 (시작은 숲 고정 — 7-3) · 미리 보기는 2번째 (관장 에이스 Lv 21 — orders #37)
  return region === 'forest' ? 1 : 2;
}

/** 관장 첫 승 돈 = 1,000 × (k + 2) (gdd 5.2 — k = 1 은 지금 숲 그대로 BALANCE.gymFirstMoney) */
export function regionGymMoney(k: number): number {
  return k <= 1 ? BALANCE.gymFirstMoney : 1000 * (k + 2);
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
