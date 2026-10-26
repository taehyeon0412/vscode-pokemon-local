/**
 * 세이브 형식 — mvp-spec 9장 "저장 구조".
 *
 * 이미 나눠 준 세이브가 있으니 형식을 바꿀 때는:
 *   1. SAVE_VERSION 을 올리고 새 형식을 SaveV{n} 으로 더한다 (옛 형식은 지우지 않음)
 *   2. migrate.ts 의 MIGRATIONS 에 "옛 버전 → 새 버전" 함수를 더한다
 *   3. 옛 세이브 표본으로 테스트를 더한다 (migrate.test.ts)
 * 옵션 칸을 더할 때도 판을 올린다 (2026-10-21 orders #15) — 옛 판 코드는 모르는 칸을 "고칠 때" 지우는데, 판이 더 새로우면 "더 새 버전 세이브" 로 잠그고 쓰지 않아서
 *   (설치 뒤 다시 로드 안 한 옛 창이 새 칸을 지우지 못함 — save-store lock). 판 올리기는 "파일 읽기" 만 막음 —
 *   설치 직후 "옛 확장 + 새 웹뷰" 는 웹뷰가 판이 다른 상태를 계산하지 않고 넘겨서 막음 (webview-session start).
 */
export const SAVE_VERSION = 7;
// 6 → 7 (2026-10-26 #97 태현 님): settings.teamCutscene (옵션 — 3:3 필살기 연출 켬 · 끔) — 옛 6판 창이 지우지 못하게 판만 올림
// 5 → 6 (2026-10-22 orders #75 화산): 지역 id volcano · 스테이지 volcano-1 ~ 3 · 아이템 hyper-potion · full-restore — 옛 5판 창이 모르는 칸을 지우지 못하게 판만 올림
// 4 → 5 (2026-10-22 orders #83): settings.battleFast (옵션 — 전투 ×2) — 옛 4판 창이 지우지 못하게 판만 올림
// 3 → 4 (2026-10-22 orders #30 · dev-log #40 안 A): regions (연 지역 순서 · 다음 고를 곳) · mode · stash (안 하는 모드의 진행) · cleared — 옛 3판 창이 새 칸을 지우지 못하게 판을 올림
// 2 → 3 (2026-10-21 orders #17): settings.teamMode (옵션) — 옛 2판 창이 지우지 못하게 판만 올림
// 1 → 2 (2026-10-21 orders #15): 칸은 1판 + 옵션 칸 (settings.autoPotion · skipCaughtLast · laterChoices · tips · 새 물건 id · run.candy · boost) — 옛 1판 창이 이 세이브를 지우지 못하게 판만 올림

/** 스탯 5개 (mvp-spec 3.5): HP · 공격 · 방어 · 스피드 · 필살 */
export const STAT_KEYS = ['hp', 'attack', 'defense', 'speed', 'ultimate'] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>;

/** 상태 이상 (mvp-spec 3.3 U14) — 한 포켓몬에 하나만, 전투가 끝나도 이어짐 */
export type StatusCondition =
  | { kind: 'poison' }
  | { kind: 'burn' }
  | { kind: 'paralysis' }
  | { kind: 'sleep'; turnsLeft: number };
export const STATUS_KINDS = ['poison', 'burn', 'paralysis', 'sleep'] as const;

/** 기술 칸 하나 — moveId 는 PokeAPI 기술 번호 */
export interface MoveSlot {
  moveId: number;
  pp: number;
}

export interface Monster {
  /** 세이브 안에서만 쓰는 번호 ("m1", "m2" …) */
  uid: string;
  /** 전국 도감 번호 */
  species: number;
  /** 그림 폴더 이름 (예: bulbasaur · nidoran_female) — extension/media/gen<N>/<form>/ */
  form: string;
  level: number;
  /** 쌓인 경험치 */
  exp: number;
  /** 개체값 0~31 — 잡을 때 정해지고 안 바뀜 (★ 등급) */
  ivs: Stats;
  /** 나눈 포인트 (레벨업 자동 2 + 고른 2) */
  points: Stats;
  /** 아직 안 나눈 고르는 포인트 (S18 에서 나눔) */
  unspentPoints: number;
  /** 0~4개 */
  moves: MoveSlot[];
  /** 지금 HP (0 = 쓰러짐) */
  hp: number;
  status: StatusCondition | null;
  shiny: boolean;
  /** 잡은 곳: 'starter' 또는 스테이지 id */
  caughtAt: string;
}

/** 아이템 (mvp-spec S14 · 3.6) — PokeAPI 아이템 이름과 같은 꼴 */
export const ITEM_IDS = [
  'poke-ball', 'great-ball', 'ultra-ball',
  'potion', 'super-potion', 'full-heal', 'revive',
  // 회복약 배지 단계 (gdd 5.2 · 5.5 — 2026-10-22 orders #75): 고급상처약 (배지 3개부터 상점) · 풀회복약 (5개부터)
  'hyper-potion', 'full-restore',
  'fire-stone', 'water-stone', 'thunder-stone', 'leaf-stone', 'moon-stone', 'linking-cord',
  // 다음 버전 2단계 (2026-10-21 ideas #70 · #125): 이상한사탕 · 경험 부적 · 팔 물건 8가지 (팔기만)
  'rare-candy', 'exp-charm',
  'tiny-mushroom', 'pearl', 'stardust', 'big-mushroom', 'big-pearl', 'nugget', 'star-piece', 'big-nugget',
] as const;
export type ItemId = (typeof ITEM_IDS)[number];

/** 지역 (gdd 5.1 지역 표 — core/rules/region) — 만드는 순서: 숲 · 해변 (#70 본편) · 화산 (#75 — 세이브 6판) */
export const REGION_IDS = ['forest', 'beach', 'volcano'] as const;
export type RegionId = (typeof REGION_IDS)[number];
/** 지역 표의 스테이지 전부 — 숲 1-1 · 1-2 · 1-3 + 해변 (개발 모드 미리 보기 — orders #37) */
export const REGION_STAGE_IDS = ['forest-1', 'forest-2', 'forest-3', 'beach-1', 'beach-2', 'beach-3', 'volcano-1', 'volcano-2', 'volcano-3'] as const;
export type StageId = (typeof REGION_STAGE_IDS)[number];
/** 스테이지 (mvp-spec 3.2) — 진짜 게임 진행 = 숲 1-1 · 1-2 · 1-3 (세계 지도 · 이어 하기 · 다음 스테이지) */
export const STAGE_IDS: readonly StageId[] = ['forest-1', 'forest-2', 'forest-3'];

/** 본 첫 안내 id (save.tips) — 짧은 영문 · 최대 수 (디자인팀 orders #12) */
export const TIPS_MAX = 20;
export const isTipId = (id: unknown): id is string => typeof id === 'string' && /^[a-z0-9-]{1,24}$/.test(id);
/**
 * 알림 (VS Code 팝업) 처음 값 = 꺼짐 (2026-10-21 태현 님 "추천안으로 해줘" — gdd 4.13). 이 표시가 tips 에 있으면 이미 옮긴 세이브 —
 * 없으면 (옛 세이브) 읽을 때 한 번 꺼짐으로 바꾸고 표시를 붙임 (그 뒤 설정에서 켠 것은 그대로)
 */
export const NOTIFY_OFF_TIP = 'notify-off';

export interface FacilitySpot {
  kind: 'hospital' | 'shop';
  /** 스테이지 안 자리 (0 = 처음 · 1 = 끝) */
  at: number;
}

/** 이번에 걷는 판의 기록 — S24 클리어 카드 요약 (잡은 포켓몬 · 이긴 트레이너 · 걸린 시간 · 새로 만난 포켓몬) */
export interface StageRun {
  /** 이 판을 시작한 때의 플레이 시간 (ms) */
  startMs: number;
  caught: number;
  trainers: number;
  /** 이 판에서 처음 만난 종 (도감 번호, 앞에서부터 몇 마리만) */
  seen: number[];
  /** 이 판에서 가장 멀리 간 곳 — 졌다 다시 걸을 때 그 앞의 떨어진 아이템 · 부탁은 안 나옴 (이미 주웠고 · 골랐음) */
  reach: number;
  /** 이 판에서 진 횟수 — 졌다 다시 걸으면 야생을 다시 뽑음 (S17, 시드 · 길은 그대로) */
  retries: number;
  /** 이 판에서 3:3 으로 진 트레이너 (남은 포켓몬으로 계속 걸은 것) — 다시 만나면 주 버튼 1:1 · 같은 판 패배로 셈 (2026-10-21 기획 R8 A, 없으면 빈 목록) */
  teamLost?: string[];
  /** 이 판에서 산 이상한사탕 수 (한 판에 1개 — 2026-10-21 ideas #70, 없으면 0) */
  candy?: number;
  /** 이 판을 시작할 때 경험 부적을 씀 — 이 판 동안 경험치 ×1.5 (ideas #70) */
  boost?: boolean;
}

export interface StageProgress {
  /** 이번 판의 시드 (길) — 깬 스테이지를 다시 걸으면 새로 뽑음 (병원 · 상점 자리는 facilities 그대로 · 트레이너 자리는 스테이지마다 정해짐) */
  seed: number;
  /** 0 ~ 1 */
  progress: number;
  cleared: boolean;
  /** 이긴 트레이너 ("forest-1:t0") — 다시 걸어도 안 나옴 (2026-10-18 태현 님) */
  defeatedTrainers: string[];
  facilities: FacilitySpot[];
  /** 이번 판 기록 — 옛 1판 세이브에 없으면 빈 기록으로 읽음 */
  run: StageRun;
}

/** 이어 하기로 돌아갈 곳 (mvp-spec S02 ②) */
export type Location =
  | { screen: 'title' } // S02 — 아직 스타팅 전
  | { screen: 'stage'; stageId: StageId } // S06
  | { screen: 'gym'; /** 어느 지역 체육관 — 없으면 숲 (해변은 개발 모드 미리 보기만) */ region?: RegionId } // S16 대기실
  | { screen: 'world-map' }; // S07
export const LOCATION_SCREENS = ['title', 'stage', 'gym', 'world-map'] as const;

/** 전투 중에 껐을 때의 상대 — 다시 열면 그 전투를 시작 모습부터 (mvp-spec S02 ②) */
export type Encounter =
  | { kind: 'wild'; monster: Monster; start: EncounterStart }
  | { kind: 'trainer'; trainerId: string; stageId: StageId }
  /** 라이벌 (gdd 4.12) — rival = 주인공 id (data/heroes.ts) */
  | { kind: 'rival'; rival: string; stageId: StageId }
  | { kind: 'gym-leader' };
export const ENCOUNTER_STARTS = ['normal', 'preemptive', 'ambush'] as const;
export type EncounterStart = (typeof ENCOUNTER_STARTS)[number];

/**
 * 전투가 끝난 뒤 사람이 골라야 하는 것 (mvp-spec S12 → S23 · S22) — 세이브에 남겨 두어 껐다 켜도 이어 고름.
 * 경험치 · 레벨 · 스탯은 전투가 끝날 때 이미 세이브에 들어감, 여기는 고르는 것만 (차례대로)
 */
export type PendingChoice =
  /** S23 — 기술 4칸이 차 있을 때 새 기술 (바꿀 기술 고르기 · 배우지 않기) */
  | { kind: 'learn'; uid: string; moveId: number }
  /**
   * S22 — 진화: 지금 기술 2개 남기기 + 새 기술 2개. level = 진화 조건이 맞은 레벨 (그 뒤 오른 레벨의 새 기술은 진화한 · 안 한 모습으로 고를 때 다시 셈).
   * item = 돌 · 연결의끈으로 들어왔으면 그 아이템 (멈추면 돌려줌, 단계 8)
   */
  | { kind: 'evolve'; uid: string; to: number; newMoves: number[]; level: number; item: ItemId | null };
export const PENDING_KINDS = ['learn', 'evolve'] as const;

export interface LastHospital {
  stageId: StageId;
  at: number;
}

export interface SaveV3 {
  /** 2 = 1판과 같은 칸 + 옵션 칸 (orders #15) · 3 = + settings.teamMode (orders #17) */
  version: 3;
  createdAt: number;
  updatedAt: number;
  playTimeMs: number;
  /** S03 에서 고르기 전에는 null · look = 고른 캐릭터 (data/heroes.ts, 없으면 성별의 첫 캐릭터 — 옛 세이브) */
  player: { gender: 'male' | 'female'; look?: string } | null;
  /** 팀 · 보관함의 포켓몬 전부 (uid → 포켓몬) */
  monsters: Record<string, Monster>;
  /** 팀 순서, 맨 앞 = 선두 (최대 BALANCE.partySize) */
  party: string[];
  /** 보관함 */
  box: string[];
  /** 다음에 잡은 포켓몬의 uid 숫자 */
  nextMonsterUid: number;
  bag: Partial<Record<ItemId, number>>;
  money: number;
  /** 받은 배지 (예: 'forest') */
  badges: string[];
  stages: Partial<Record<StageId, StageProgress>>;
  location: Location;
  /** 졌을 때 돌아갈 병원 (mvp-spec 3.8) */
  lastHospital: LastHospital | null;
  /** 만난 · 잡은 종 (도감 번호) — NEW! 표시 */
  dex: { seen: number[]; caught: number[] };
  pendingEncounter: Encounter | null;
  /** 전투 끝에 남은 고르기 (S23 · S22) — 앞에서부터 */
  pendingChoices: PendingChoice[];
  /** fastWalk = 빨리 걷기 (2026-10-19 — 없으면 꺼짐, 옛 세이브엔 없음) · reduceMotion = 게임의 동작 줄이기 (2026-10-20 태현 님 — OS 설정 대신, 없으면 꺼짐) */
  settings: {
    notifications: boolean;
    autoBattle: boolean;
    fastWalk?: boolean;
    reduceMotion?: boolean;
    /** 자동 전투가 HP 30% 아래에서 상처약 (없으면 켬 — 2026-10-21 ideas #65) */
    autoPotion?: boolean;
    /** 이미 잡은 종은 마지막 기회 (볼) 를 건너뜀 (없으면 꺼짐 — ideas #35) */
    skipCaughtLast?: boolean;
    /** 트레이너를 만났을 때 마지막으로 고른 방식 — true = 3:3 (없으면 1:1, 2026-10-21 orders #17) */
    teamMode?: boolean;
    /** 3:3 전투 ×2 — 보통 공격만 두 배 (없으면 꺼짐 — 2026-10-22 orders #83) */
    battleFast?: boolean;
    /** 3:3 필살기 연출 — 켬 (없음 · true) = 장면 전환 (1:1 필살기 그대로 크게) · 끔 (false) = 3:3 화면 그대로 작은 판 (2026-10-26 #97 태현 님 — 위쪽 줄 버튼 · V) */
    teamCutscene?: boolean;
  };
  /** 라이벌 전적 (gdd 4.12) — 주인공 id → 내가 이긴 수 · 진 수. 처음 만나기 전 (옛 세이브 포함) 엔 칸이 없음 — 없는 칸을 만들면 옛 세이브가 "고친 세이브" 로 다시 써짐 */
  rivals?: Record<string, { wins: number; losses: number }>;
  /** 쌓아 둔 새 기술 고르기 (S23) — 선두가 아닌 포켓몬은 바로 멈추지 않고 여기 → 병원 · 클리어 때 pendingChoices 로 (2026-10-21 ideas #72). 쌓인 적이 없으면 칸이 없음 */
  laterChoices?: PendingChoice[];
  /** 본 첫 안내 id (2026-10-21 디자인팀 orders #12 — 'walk' · 'last' · 'ult' …). 처음 볼 때 생김 */
  tips?: string[];
  /** 오늘의 목표 (gdd 4.11 U13, orders #28) — 그날 처음 쓸 때 생김 · 어제 것은 덮음. 모두에게 (orders #59 — 그 전 판 창은 모르는 칸) */
  daily?: Daily;
  /** 기록 (gdd 4.11 U12) — 이긴 수 · 잡은 수 · 걸은 거리. 오늘의 목표와 같이 켜짐 (처음 쓸 때 생김) */
  records?: Records;
}

/** 오늘의 목표 한 줄의 종류 (rules/daily.ts) */
export const DAILY_KINDS = ['wild-win', 'trainer-win', 'stage-clear', 'new-catch', 'perfect-parry', 'request', 'type-win'] as const;
export type DailyKind = (typeof DAILY_KINDS)[number];
export interface DailyGoal {
  kind: DailyKind;
  need: number;
  have: number;
  /** type-win 의 타입 (grass · bug …) */
  type?: string;
  reward: ItemId;
  rewardN: number;
  /** 다 함 (보상을 받음) */
  done?: true;
}
export interface Daily {
  /** 내 PC 날짜 "2026-10-22" */
  day: string;
  goals: DailyGoal[];
  /** 셋 다 해서 금구슬을 받음 */
  bonus?: true;
}
export interface Records {
  /** 이긴 전투 수 (야생 · 트레이너 · 관장) */
  wins: number;
  /** 잡은 포켓몬 수 */
  catches: number;
  /** 걸은 거리 — 스테이지 한 번 끝까지 = 10000 */
  walked: number;
}

/**
 * 연 지역 (gdd 5.1 — 지금 모드). order[0] = 시작 지역 (숲 고정 — 7-3) · 몇 번째 = 자리 + 1 · 없는 지역 = 아직 안 열림.
 * next = 관장을 이긴 뒤 고를 곳 (1 ~ 2곳 — 뽑은 그때 저장해 껐다 켜도 같음 · 고르면 지움). "지금 지역" 은 따로 안 둠 (location 에서 — 두 군데 적으면 어긋남)
 */
export interface RegionProgress {
  order: RegionId[];
  next?: RegionId[];
}
/** 노말 · 하드 (gdd 4.5 — 하드는 노말 엔딩 뒤 열림) */
export const GAME_MODES = ['normal', 'hard'] as const;
export type GameMode = (typeof GAME_MODES)[number];
/** 모드마다 따로인 진행 (배지 · 깬 스테이지 · 위치 · 병원 · 연 지역) — 포켓몬 · 돈 · 아이템 · 도감 · 설정은 같이 씀 */
export interface ModeProgress {
  badges: string[];
  stages: Partial<Record<StageId, StageProgress>>;
  location: Location;
  lastHospital: LastHospital | null;
  regions: RegionProgress;
}

export interface SaveV4 extends Omit<SaveV3, 'version'> {
  /** 4 = 3판 + regions · mode · stash · cleared (orders #30) */
  version: 4;
  /** 연 지역 (지금 모드) */
  regions: RegionProgress;
  /** 'hard' 면 하드 모드 · 없으면 노말 (옛 세이브 = 노말) */
  mode?: 'hard';
  /** 지금 안 하는 모드의 진행 — 처음 하드에 들어갈 때 생김 (switchMode 가 맨 위 진행과 맞바꿈) */
  stash?: ModeProgress;
  /** 엔딩을 본 때 (ms) — normal = 노말 엔딩 (리그 챔피언) → 하드 열림 */
  cleared?: { normal?: number };
}

export interface SaveV5 extends Omit<SaveV4, 'version'> {
  /** 5 = 4판 + settings.battleFast (옵션 — orders #83) */
  version: 5;
}

export interface SaveV6 extends Omit<SaveV5, 'version'> {
  /** 6 = 5판 + 지역 volcano · 스테이지 volcano-1 ~ 3 · 아이템 hyper-potion · full-restore (orders #75 — 칸 모양은 그대로) */
  version: 6;
}

export interface SaveV7 extends Omit<SaveV6, 'version'> {
  /** 7 = 6판 + settings.teamCutscene (옵션 — #97) */
  version: 7;
}

/** 지금 버전의 세이브 */
export type Save = SaveV7;
