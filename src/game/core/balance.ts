/**
 * 게임 숫자 모음 — docs mvp-spec 4장과 1:1.
 * 해 보면서 맞춘 값은 여기만 고치고, mvp-spec 4장에도 바꾼 값을 적는다.
 */
export const BALANCE = {
  /** 새 게임 시작 돈 (원) — 4장 돈 · 아이템 */
  startingMoney: 1000,
  /** 새 게임 시작 몬스터볼 — 3.4 · 4장 잡기 */
  startingPokeBalls: 3,
  /** 팀 칸 — 3.8 */
  partySize: 5,
  /** 기술 칸 — 3.6 */
  moveSlots: 4,
  /** 레벨 상한 — 3.5 */
  maxLevel: 100,
  /** 개체값 상한 (스탯마다 0~31) — 3.4 */
  maxIv: 31,
  /** 포인트 1개 크기 — 4장 성장 (HP 는 크게) */
  pointHp: 1.5,
  pointOther: 0.5,
  /** ★ 등급 경계 — 개체값 합계 (0~155) 가 이 값 이상이면 ★2 · ★3 · ★4 · ★5 (4장) */
  starThresholds: [32, 63, 94, 125],
  /** 스타팅 레벨 — 4장 */
  starterLevel: 5,
  /** 스타팅 처음 기술: 후보 수 · 고르는 수 (mvp-spec 3.6 · S04) */
  starterMoveCandidates: 4,
  starterMoves: 2,

  // ---- 스테이지 (mvp-spec 3.2 · 4장 "스테이지 · 조우")
  /** 스테이지 걷는 시간 (전투 · 부탁 빼고) — 15분 (2026-10-18 태현 님) → 20분 (2026-10-19 태현 님: 단계 11 시뮬에서 전투가 한 번 12 ~ 21초라 한 판 25 ~ 35분 · 지역 1시간 25분 → 목표 35 ~ 45분 · 2 ~ 3시간에 가깝게) */
  stageWalkMs: 12.5 * 60_000,
  // → 15분 (2026-10-19 밤 태현 님 "걷는 시간이 너무 길어 루즈해" — 20분은 시뮬 숫자만 보고 늘린 값이라 되돌림 + 빨리 걷기)
  // → 12분 30초 (2026-10-21 태현 님 "1.2배로" — 진짜로 빠르게 걸음: 만나는 수는 그대로 · 사이 간격만 짧아짐, 보이는 걸음 48 → 57.6px/초)
  /** 빨리 걷기 (설정) — 걷는 동안 몇 배 · 앞으로 몇 ms (보통 걸음) 안에 일이 있으면 보통 빠르기 (다가오는 걸 보게) */
  fastWalkSpeed: 2.5,
  // 3 → 2.5 (2026-10-21 태현 님 — 기본 걸음이 1.2배라 보이는 빠르기는 전과 같은 144px/초)
  /** 2026-10-20 태현 님 4000 → 500 ("목표물 앞까지 4초는 길어 — 0.5초로") */
  fastWalkLookMs: 500,
  /** 스테이지마다 나오는 수 [최소, 최대] — gdd 4.5 · 4.6 */
  stageWild: [12, 18],
  stageItems: [4, 6],
  stageRequests: [1, 2],
  stageHospitals: [1, 2],
  stageShops: [1, 2],
  stageScenery: [10, 16],
  /** 트레이너 — 스테이지마다 2 ~ 3명 (스테이지마다 정해진 수 · 자리는 판마다) · 상대 마릿수 1 ~ 3, 내 살아 있는 포켓몬 + 1 까지 (2026-10-18 태현 님) */
  stageTrainers: [2, 3],
  trainerTeamSize: [1, 3],
  /** 라이벌 (gdd 4.12 · mvp-spec 3.10, 2026-10-19 태현 님) — 한 판에 나올 확률 · 자리 범위 · 다른 자리와 떨어지는 거리 · 에이스 말고는 레벨 − · 트레이너 돈의 몇 배 [임시값] */
  rivalChance: 0.5,
  rivalSpotRange: [0.25, 0.85],
  rivalGap: 0.012,
  rivalLevelGap: 2,
  rivalMoneyScale: 1.5,
  /** 라이벌을 두 번째부터 이기면 받는 아이템 비율 (처음 이기면 진화의 돌 — 트레이너는 돈만) [임시값] */
  rivalItems: { 'great-ball': 0.3, 'ultra-ball': 0.2, 'super-potion': 0.2, revive: 0.15, 'full-heal': 0.1, stone: 0.05 },
  /** 만나는 것들이 놓이는 구간 (시작하자마자 · 끝에서 바로 만나지 않게) [제안] */
  stageSpotRange: [0.04, 0.97],
  /** 병원 · 상점 = "중간쯤 랜덤 자리" [제안] */
  stageFacilityRange: [0.3, 0.75],
  /** 숲 레벨대 [낮은 끝, 높은 끝] — 진행 % 에 따라 올라감 */
  /** 1-1 은 2 ~ 4 (처음 3 ~ 6 → 단계 9: 2 ~ 5 → 단계 11 시뮬: 첫 병원 전 1-1 에서 풀 · 물 스타팅이 평균 2 ~ 3번 짐 → 2 ~ 4, 2026-10-19 태현 님) [임시값] */
  stageLevels: { 'forest-1': [2, 4], 'forest-2': [6, 10], 'forest-3': [10, 13] },
  /** 센 포켓몬 흔적: 확률 · 레벨대 위끝 + */
  strongTraceChance: 0.15,
  strongLevelBonus: 2,
  /** 노말 · 비행을 섞는 확률 — 숲 (풀 · 벌레) 이 불꽃 스타팅에만 쉬워서 (단계 11 시뮬, 2026-10-19 태현 님) [임시값] */
  mixedTypeChance: 0.3,
  /** 독 · 드래곤 · 페어리를 섞는 확률 (노말 · 비행이 아닐 때) */
  rareTypeChance: 0.1,
  /** 종족값 합이 이보다 큰 1단계 포켓몬은 1-3 에만 [제안] */
  bigBaseTotal: 450,
  /** 이로치 — 2026-10-18 태현 님 (이로치 그림이 있는 종만) */
  shinyChance: 0.02,
  /** 친밀도 진화 레벨 — 4장 */
  friendshipLevel: 20,
  /** 기습 확률: 상대 스피드가 내 몇 배 이상이면 [배, 확률] (큰 것부터) */
  ambush: [
    [2, 0.2],
    [1.5, 0.1],
  ],
  /** 선제공격 확률: 내 스피드가 상대의 몇 배 이상이면 [배, 확률] (큰 것부터) — 기습과 대칭 [임시값] (2026-10-21 태현 님 — 튀어나올 때 Space 선제공격을 뺌) */
  preemptive: [
    [2, 0.2],
    [1.5, 0.1],
  ],
  /** 자동 전투가 상처약을 쓰는 HP — 최대의 이만큼 아래 (설정 "자동 전투 상처약", 기본 켬 — 2026-10-21 ideas #65) [제안] */
  autoPotionBelow: 0.3,
  /** 미리 누르기 — 게이지가 차기 이만큼 (ms) 전에 누른 공격 · 기술 · 막기는 기억했다가 차자마자 (2026-10-21 ideas #31) [제안] */
  prePressMs: 500,
  /**
   * 3:3 실시간 팀 배틀 (다음 버전 5단계 — gdd 4.7 끝, 2026-10-21 orders #17) — 숫자는 모두 [임시값] (시뮬로 한 판 1분 안팎에 맞춤).
   * on = 게임에서 켬 (화면 · 연출이 생길 때까지 꺼 둠 — 모양은 디자인팀이 정하는 중) · size = 한쪽 마리 수 · ultGainScale = 필살기 게이지가 1:1 의 몇 배로 참 ·
   * interruptChance = 상대 AI 가 내 필살기에 끼어드는 확률 (트레이너 가끔 · 관장 자주) · spreadScale = 범위 기술 · 필살기가 여럿을 칠 때 ·
   * statusWeight = 변화 기술 총점수 · moneyScale = 트레이너전 돈 (관장 돈은 그대로) · damageScale = 피해 배율
   */
  team: {
    on: false,
    size: 3,
    ultGainScale: 1.2,
    interruptChance: { trainer: 0.3, gym: 0.7 },
    spreadScale: 0.75,
    statusWeight: 0.3,
    moneyScale: 1.5,
    damageScale: 0.2,
    /** 행동 게이지가 1:1 보다 이만큼 느리게 (6마리가 겹쳐 치니) */
    gaugeScale: 1.4,
    /** 상대 필살기 예고 — 게이지가 이만큼 넘으면 "곧" (2026-10-21 태현 님 ② 상대 필살기 예고) [임시값] */
    ultWarnAt: 0.8,
    /** 포켓몬 크기 배율 — 폭 unitW × 배율이 있어야 그 배율 (240 = ×1 · 480 = ×2 · 720 = ×3), ×3 은 높이 x3MinH 부터. ×1 로도 안 들어가면 3:3 잠금 (gdd S06 ④ · 2026-10-21 기획) [임시값] */
    view: { unitW: 240, x3MinH: 300 },
  },
  /** 팀 HP 가 이 아래 (또는 쓰러진 포켓몬) 면 "위험" — 정보줄 작은 칸 (ideas #47) [제안] */
  teamDangerBelow: 0.5,
  /** 쌓아 두는 새 기술 고르기 (선두가 아닌 포켓몬) 최대 — 넘으면 오래된 것부터 버림 (ideas #72) */
  laterChoicesMax: 20,
  /** 잡은 · 야생 포켓몬 기술 수: [이 레벨 이상, 개수] (큰 것부터) */
  wildMoveCounts: [
    [26, 4],
    [11, 3],
    [1, 2],
  ],
  /** 떨어진 아이템: 몬스터볼 · 상처약 · 돈 · 진화의 돌 비율 (합 1) · 돈 = 레벨대 위끝 × 이 값 [제안] */
  pickupTable: { 'poke-ball': 0.4, potion: 0.3, money: 0.25, stone: 0.05 },
  pickupMoneyPerLevel: 10,
  /** 길 위의 부탁 성공 확률: 맞는 타입 기술이 있으면 · 없으면 [임시값] */
  requestChanceMatch: 0.85,
  requestChanceOther: 0.3,

  // ---- 전투 (mvp-spec 3.3 · 4장 "전투") — [임시값], 해 보며 맞춤
  /** 행동 게이지: 스피드가 같으면 이 시간마다 한 번 · 빠른 쪽은 최대 이 배까지 자주 */
  gaugeMs: 2500,
  maxSpeedRatio: 2,
  /** 1 공격 = 약한 기본기 (타입 없음) */
  attackPower: 30,
  critChance: 1 / 16,
  critMultiplier: 1.5,
  /** 같은 타입 기술 (자속) */
  stab: 1.5,
  /** 피해 무작위 0.85 ~ 1 */
  damageRandomMin: 0.85,
  /** 방어: 받는 피해 × (첫 번 0.5 · 연달아 0.75 · 그다음 1) */
  guardFactors: [0.5, 0.75, 1],
  /** 필살기 위력 · 게이지 (때림 +18% · 맞음 +25% · 방어 중에 맞으면 +5% 더, 야생 × 0.5)
   *  처음 10% · 15% → 야생전 216판 시뮬에서 필살기가 찬 전투가 3% 뿐이라 올림 (약 3판에 1번, 단계 5 · 6 플레이 리뷰) */
  ultPower: 100,
  ultGainHit: 0.18,
  ultGainHurt: 0.25,
  ultGainGuardBonus: 0.05,
  ultGainWildScale: 0.5,
  /** 필살 스탯이 같은 레벨의 필살 종족값 40 ~ 120 포켓몬 사이 어디쯤인지 → 게이지가 차는 빠르기 × 0.8 ~ 1.2 [제안] */
  ultGainStatRange: [40, 120],
  ultGainFactorRange: [0.8, 1.2],
  /** 힘대결: 센 쪽 50 ~ 80% (차이가 50% 이상이면 80) · 연타 1번 +1%p · 최대 +20%p · 합쳐서 최대 95% */
  clashMin: 0.5,
  clashMax: 0.8,
  clashRatioFull: 0.5,
  clashTap: 0.01,
  clashTapMax: 0.2,
  clashCap: 0.95,
  /** 도망: 50% + (내 스피드 − 상대) / 상대 × 50%, 10 ~ 95%, 실패할 때마다 +10%p */
  fleeBase: 0.5,
  fleeStep: 0.1,
  fleeRange: [0.1, 0.95],
  /** 연달아 쓸수록 세지는 기술 — 연달아 쓸 때마다 +10% (2026-10-18 태현 님) */
  streakStep: 0.1,
  /** 상태 이상 (원작 규칙 [제안]) */
  poisonDamage: 1 / 8,
  burnDamage: 1 / 16,
  burnAttackScale: 0.5,
  paralysisGaugeScale: 0.5,
  paralysisSkip: 0.25,
  sleepTurns: [1, 3],
  /** 회복약 · 기력의조각 (쓰러진 포켓몬을 최대 HP 의 절반으로 [제안 — 원작]) */
  potionHeal: 20,
  superPotionHeal: 50,
  reviveFraction: 0.5,
  /** 야생 AI: 공격 30% · 기술 70% */
  wildAttackChance: 0.3,

  // ---- 잡기 (mvp-spec 3.4 · 4장 "잡기")
  /** 잡을 확률 = (포획률 / 255) × (1 − 남은 HP 비율 × 2/3) × 볼 배율 × 타이밍, 최대 1 · 마지막 기회 × 0.5 */
  catchHpWeight: 2 / 3,
  ballScale: { 'poke-ball': 1, 'great-ball': 1.5, 'ultra-ball': 2 },
  lastChanceScale: 0.5,
  /** 타이밍 원: 원이 다 줄어든 순간에서 ± 이 시간 안이면 완벽 · 좋음 */
  catchPerfectMs: 100,
  catchGoodMs: 250,
  /** 한 마리에 볼 기회 · 놓치면 상대가 되찾는 HP (최대 HP 비율) — 3번 다 놓치면 도망 (2026-10-20 태현 님) */
  catchTries: 3,
  catchFailHeal: 0.1,
  /** 패링 피해 배 (막음 · 완벽) · 완벽이면 내 행동 게이지 + [임시값] */
  parryGoodFactor: 0.5,
  parryPerfectFactor: 0,
  parryPerfectGauge: 0.2,
  /** 반격기 피해 = 필살기 피해의 이만큼 (게이지 없이 나가는 덤 — 2026-10-20 태현 님 "추천") */
  riposteUltFactor: 0.5,
  catchPerfectScale: 1.5,
  catchGoodScale: 1.25,

  // ---- 경험치 · 성장 (mvp-spec 3.5 · 4장 "경험치 · 성장")
  /** 경험치 = 상대 기본 경험치 × 상대 레벨 / 7 · 트레이너 × 1.5 · 팀 나머지 × 0.5 · 상대가 내 레벨보다 5 이상 낮으면 × 0.5 */
  expDivisor: 7,
  expTrainerScale: 1.5,
  expShareScale: 0.5,
  expLowGap: 5,
  expLowScale: 0.5,
  /** 레벨업마다 포인트: 자동 2 (종족값이 높은 스탯일수록 잘 뽑힘) + 고르는 2 (S18) */
  pointsAutoPerLevel: 2,
  pointsFreePerLevel: 2,
  /** 특수 조건 진화 [제안]: 앞 진화 레벨 + 10, 앞 진화가 없으면 Lv 30 */
  otherEvolutionGap: 10,
  otherEvolutionDefault: 30,
  /** 진화할 때 새 기술 2개 · 대표 기술이 모자라면 지금 레벨 + 5 까지 배우는 기술 중 가장 센 것 [제안] */
  evolutionNewMoves: 2,
  evolutionMoveReach: 5,

  // ---- 돈 · 아이템 (mvp-spec 3.7 · 4장 "돈 · 아이템")
  /** 야생을 이기면 30% 로 상대 레벨 × 5원 · 잭팟 1% 1000원 */
  wildMoneyChance: 0.3,
  wildMoneyPerLevel: 5,
  jackpotChance: 0.01,
  jackpotMoney: 1000,
  /** 야생을 이기면 약 10% 로 아이템 — 몬스터볼 · 상처약 반반 [제안] */
  wildItemChance: 0.1,
  /** 트레이너: 쓰러뜨린 마리마다 상대 레벨 × 20원 · 관장: 처음 3000원 (+ 리프의 돌 · 배지) · 다시 이기면 300원 (4장) */
  trainerMoneyPerLevel: 20,
  gymFirstMoney: 3000,
  gymRematchMoney: 300,
  /** 걷는 동안 회복: 걸은 시간 1분에 최대 HP 의 10% (쓰러진 포켓몬은 그대로) — 2026-10-18 태현 님 (1-1 에서 첫 병원 전에 계속 지는 것을 줄임) · 숫자는 [임시값] */
  walkRegenPerMinute: 0.12,
  // 0.1 → 0.12 (2026-10-21 — 걷는 시간이 ÷1.2 라 만남 사이에 차는 양을 전과 같게) [제안]
  /** 졌을 때 잃는 돈 (관장전은 안 잃음 — gdd 4.10) */
  defeatMoneyLoss: 0.1,
  /** 상점 값 (원, 4장) — 마스터볼은 안 팖 */
  shopPrices: { 'poke-ball': 200, 'great-ball': 600, 'ultra-ball': 1200, potion: 300, 'super-potion': 700, 'full-heal': 600, revive: 1500, 'rare-candy': 3000, 'exp-charm': 1500 },
  // ---- 돈 쓰는 재미 (다음 버전 2단계 — 2026-10-21 태현 님 "추천대로", gdd 7장 · 숫자는 [임시값])
  /** 팔 물건 정가 (팔면 sellRate) — 전투 · 쓰임 없이 팔기만 (ideas #125) */
  valuablePrices: { 'tiny-mushroom': 400, pearl: 1000, stardust: 1200, 'big-mushroom': 2500, 'big-pearl': 3000, nugget: 4000, 'star-piece': 5000, 'big-nugget': 10000 },
  /** 상점 [팔기] — 정가의 이만큼 (팔 물건 + 볼 · 약 등 값이 있는 것, ideas #126) */
  sellRate: 0.5,
  /** 팔 물건을 받는 확률 — 잡았을 때 · 트레이너를 이겼을 때 · 부탁 [도와준다] 가 성공했을 때. 관장 첫 승 = 큰금구슬 · 라이벌마다 첫 승 = 금구슬 (꼭) */
  treasureChance: { catch: 0.1, trainer: 0.15, request: 0.25, wild: 0.06 },
  // wild 6% 더함 (2026-10-21 테스터 — 야생이 한 판 약 15번이라 약 0.9개 · 한 판 1 ~ 2개 목표) [임시값]
  /** 무엇이 나올지 — [확률, 물건] 흔함 50% · 보통 35% · 드묾 15% (큰금구슬은 관장 첫 승에서만) */
  treasureTiers: [
    [0.5, ['tiny-mushroom', 'pearl']],
    [0.35, ['stardust', 'big-mushroom', 'big-pearl']],
    [0.15, ['nugget', 'star-piece']],
  ],
  /** 이상한사탕 — 스테이지 상점에서 한 판에 이만큼 (대기실 상점엔 없음) · 경험 부적 = 스테이지를 새로 시작할 때 1개 써서 그 판 경험치 ×이만큼 (ideas #70) */
  candyPerStage: 1,
  expCharmScale: 1.5,
  /** Shift + 클릭 = 한 번에 이만큼 사기 · 팔기 (ideas #50) */
  shopBulk: 5,
  /** 스테이지 클리어 보너스 경험치 = 그 스테이지 레벨대 위끝 × 10 (팀 전원) · 관장 (처음 이길 때) 은 그 2배 [제안] · 클리어 볼 +1 */
  clearExpPerLevel: 10,
  gymClearExpScale: 2,
  clearBalls: 1,

  // ---- 관장 (mvp-spec 3.9) — 숲 관장 = 파라스 Lv 13 · 냄새꼬 Lv 14 · 에이스 버터플 Lv 15 (필살기 게이지 절반)
  gymTeam: [
    [46, 13],
    [44, 14],
    [12, 15],
  ],
  gymAceUlt: 0.5,
  /** 관장 상처약 (2026-10-20 ideas #69 — 원작 관장처럼, 난이도보다 긴장 · 길이): 한 판에 이만큼 · 에이스 (마지막 포켓몬) HP 가 이 비율 아래가 되면 차례에 씀 [제안] */
  gymPotions: 1,
  gymPotionAt: 0.5,
  /** 추천 레벨 (S16 ④) */
  gymRecommendedLevel: 15,
  /** 트레이너 AI: 필살기 게이지가 차면 0.5 ~ 3초 기다렸다가 · 상대 필살기를 맞받아칠 확률 (관장은 늘) [제안] */
  trainerUltWaitMs: [500, 3000],
  trainerUltCounterChance: 0.5,
  /** 관장 AI: 내 공격 · 기술 연출이 시작되고 이 시간에 필살기로 끼어듦 (0.3초 안) · 끼어들 틈이 없으면 이만큼 기다렸다가 그냥 씀 */
  leaderCutMs: 150,
  leaderUltWaitMs: 4000,
} as const;

/** 시간 박자 — 저장 · 그리기 · 계산 (mvp-spec 3.1 · 9장) */
export const TIMING = {
  /** 자동저장: 이 간격마다 확인해서 바뀐 게 있을 때만 저장 (3.1 "5초마다 확인") */
  autosaveCheckMs: 5000,
  /** 프레임 사이 시간 상한 — 오래 멈췄다 와도 한 번에 몰아서 계산하지 않게 (9장) */
  maxFrameDeltaMs: 100,
  /** 게임 계산 한 걸음 — 보일 때(웹뷰) · 안 보일 때(확장) 같은 걸음이라 결과가 같음 */
  simStepMs: 50,
  /** 안 보일 때 확장 쪽이 계산을 돌리는 간격 */
  headlessIntervalMs: 250,
  /** 안 보일 때 한 번에 따라잡는 최대 시간 — PC 가 잠들었다 깨도 몇 시간치를 몰아 돌리지 않게 */
  headlessMaxCatchUpMs: 1000,
  /** 웹뷰 → 확장 상태 보내기 간격 (바뀐 게 있을 때만) */
  snapshotIntervalMs: 1000,
  /** 🎮 · 🏠 로 게임에서 나갈 때 웹뷰의 마지막 상태를 기다리는 시간 (안 오면 확장 상태로 저장) */
  exitWaitMs: 500,
  /** 타이틀에서 다른 창이 게임 중일 때, 그 창이 끝났는지 보는 간격 */
  titleBusyPollMs: 2000,
  /** 야생이 튀어나와 "나타났다!" 를 보여 주는 시간 → 전투로 */
  appearMs: 1600,
  /** 아이템을 주웠다 · 부탁 결과 같은 짧은 알림 */
  toastMs: 2500,
  /** 부탁 결과를 보여 주는 시간 → 다시 걸음 */
  requestResultMs: 2500,
  /** [지나간다] 뒤 다시 걷기까지 */
  requestPassMs: 600,
  /** 전투 연출 시간 (그동안 행동 게이지가 멈춤 [제안]) */
  attackAnimMs: 700,
  moveAnimMs: 900,
  guardAnimMs: 500,
  itemAnimMs: 700,
  switchAnimMs: 700,
  fleeAnimMs: 700,
  ultAnimMs: 2200,
  /** 상대가 쏘는 기술을 쓸 때 맞받아치기 버튼이 떠 있는 시간 (4장) — 그동안 그 기술은 날아오는 중 */
  counterWindowMs: 1500,
  /** 상대 필살기에 내 필살기로 맞받아칠 수 있는 시간 (그 안에 Z · Space = 필살기 힘대결) */
  ultCounterWindowMs: 1000,
  /** 패링 (2026-10-19 태현 님 A — 상대 공격이 맞기 직전 Space · 클릭) — 맞기 몇 ms 전부터 · 맞은 뒤 몇 ms 까지 받는지 (막음 / 완벽) · 원이 좁혀지는 시간 [임시값] */
  // 패링 창 (2026-10-20 태현 님 다시 기획): 보통 = 맞기 0.6초 전 ~ 0.2초 뒤 · 완벽 = 0.3초 전 ~ 0.1초 뒤 · 첫 원은 0.9초 전부터 좁혀짐
  parryEarlyMs: 600,
  parryLateMs: 200,
  parryPerfectEarlyMs: 300,
  parryPerfectLateMs: 100,
  parryRingMs: 900,
  /** 반격 기회 (완벽 패링 뒤) — 상대 둘레 두 번째 원이 좁혀지는 시간 (첫 원보다 느리게 — "화면이 살짝 느려짐"), 창은 패링과 같음 */
  riposteRingMs: 1200,
  /** 완벽 패링 뒤 쳐내기 연출을 다 보여 주고 반격 기회 (원 · 어둠) 를 띄움 — 그동안 시간은 멈춤 (2026-10-20 태현 님 "패링 연출이 끝난 뒤에 반격") · 1000 → 1400: "완벽 패링!" 글씨 1.4초 뒤 반격 기회 (2026-10-21 태현 님 A — UX 리뷰어 U1) */
  parryShowMs: 1400,
  /** 같은 전투 두 번째 완벽 패링부터 — 쳐올리기를 짧게 (2026-10-21 ideas #127 — 두 번째 필살기를 짧게 하는 규칙과 같게) [제안] ·
   *  1000 → 1300: 글씨 "완벽 패링!" (이 길이로 그림) 가 또렷한 때가 0.81 ~ 0.88초뿐이었음 → 1250 은 잼 1.0초 (빠듯) → 1300 (2026-10-21 UX 리뷰어 U1 큼) */
  parryShowRepeatMs: 1300,
  /**
   * 3:3 (orders #17) — 기술 연출 · 기술 힘겨루기 (자동, 연타 없음) · 필살기 힘겨루기 (연타) · 상대 필살기에 끼어들 수 있는 창 ("1 끼어들기" 1초 넘게 — U1) [임시값]
   * maxMs = 한 판 상한 — 넘으면 남은 HP 비율로 판정 (끝나지 않는 판을 막는 안전망, 보통 30 ~ 60초 — 2026-10-21 코드 리뷰어) [임시값]
   */
  team: { moveMs: 900, moveClashMs: 1500, ultClashMs: 3000, interruptMs: 1200, maxMs: 180_000 },
  /** 힘대결 길이 (연타하는 시간) */
  clashMs: 4000,
  /** 힘대결 승자가 정해진 뒤 이긴 줄기가 뚫고 나가는 시간 → 피해 */
  clashResultMs: 800,
  /** 전투 끝 결과 (쓰러뜨렸다 · 도망쳤다) 를 보여 주는 시간 */
  battleOverMs: 1800,
  /** S11 타이밍 원이 줄어드는 시간 · 그 뒤 늦게 눌러도 받는 시간 · 볼이 흔들리고 결과를 보여 주는 시간 */
  catchRingMs: 1200,
  /** 잡기 시간표 (2026-10-20 태현 님 다시 기획) — 던짐 → 날아감 → 열려 빨려 들어감 → 떨어져 통통 → 흔들 한 번 × (잡힘 3 · 놓침 1 ~ 3) → 딸깍 · 터짐 */
  catchFlyMs: 400,
  catchSuckMs: 400,
  catchDropMs: 300,
  catchShakeMs: 550,
  catchEndMs: 500,
  /** 놓친 뒤 상대가 덤벼들기 전 숨 고르기 (창이 닫히자마자 패링 원이 떠 막기 어렵던 것 — 2026-10-20 플레이 리뷰어) · 300 → 600: "아깝다!" 창이 약 0.7초만 보이던 것 → 약 1.1초 (2026-10-21 UX 리뷰어 U1) */
  catchFailPauseMs: 600,
  /** 1-3 끝 — 길 끝 체육관 문이 열리고 걸어 들어가는 장면 (gym-enter) → S16 대기실. Space · 클릭으로 넘김 (2026-10-20 태현 님 A안) */
  gymEnterMs: 2400,
  /** 잡힌 뒤 전투 끝 ("잡았다!" 창이 그대로) → 소개 카드 (같은 창에서 볼이 열리며 포켓몬 소개, 2026-10-20 태현 님 B) — 딸깍 · 별 0.5초 뒤 곧바로 */
  catchOverMs: 400,
  /** 이긴 뒤 마지막 기회 — 볼을 고르지 않으면 이 시간 뒤 그냥 지나감 [제안] */
  lastChanceMs: 6000,
  /** S12 결과를 보여 주는 시간 (계속 · Space · Enter 로 넘김) — 2026-10-20 태현 님 3500 → 5000 ("전투가 끝나고 5초 정도 두고 레벨업 표시") */
  resultMs: 5000,
  /** S12 잡았을 때 결과 상자 전에 가운데 소개 카드 — 잡기 창이 그대로 넓어지며 볼이 열리고 포켓몬 · NEW! 처음 잡았다 · 이름 · 타입 (2026-10-20 태현 님 안 2 "잡았다는 기쁨" → 1.5초 → 3초 "잡았다 창이 너무 빨리 꺼져 — 3초 후나 클릭" → 5초 "볼이 열리는 연출이 짧아 인지가 안 돼 — 좀 느리게" — 볼 열림 2초 + 읽기 3초), 결과 시간에 더함 · 클릭 · Space · Enter 로 넘김 */
  caughtIntroMs: 5000,
  /** S22 진화 연출 (Space = 빨리 넘기기) · 시작하고 이 시간 동안은 Space · Esc 를 안 받음 (결과에서 Space 를 두 번 눌러 연출을 통째로 놓치지 않게) */
  evolveAnimMs: 4000,
  evolveGuardMs: 800,
  /** 병원 · 상점 앞에서 [들어가기] [지나가기] 를 기다리는 시간 → 지나감 (2026-10-18 태현 님 5초 → 2026-10-20 태현 님 10초) */
  facilityPromptMs: 10000,
  /** 트레이너와 눈이 마주침: "!" 0.8초 → "승부다!" + ◓ 개수 1.2초 → VS 2초 (stage/model VS_MS) → 전투 — "!" 뒤 클릭 · Space · Enter = 바로 전투
   *  (2026-10-20 태현 님 "VS 등이 너무 휙 지나가 읽지도 못해 — 2초 정도 두고 클릭하면 바로 넘어가게", 예전 0.7 · 0.7 · 0.8초) */
  trainerAlertMs: 800,
  trainerMeetMs: 4000,
  /** 트레이너 만남에서 3:3 을 손으로 고르면 3마리 고르기 — Enter 까지 기다리고 늦어도 이 시간 뒤 미리 체크된 셋으로 시작 (안 볼 때 · 자동 전투는 안 기다림) [임시값] */
  teamPickAutoMs: 10000,
  /** 라이벌은 띠 (전적) 를 읽을 시간을 더 (플레이 리뷰어 — 2026-10-19) — "!" 0.8 · 대사 2 · VS 2초 */
  rivalMeetMs: 4800,
  /** 상대 트레이너가 다음 포켓몬을 내보내는 시간 · 1300 → 1900: 처음 0.65초는 맞는 연출이 가려 쓰러진 회색 모습이 약 0.45초만 보이던 것 → 약 1초 (2026-10-21 UX 리뷰어 U1) */
  foeSendMs: 1900,
  /** 자동 전투 중 마지막 기회 (볼) — 보통은 lastChanceMs (2026-10-21 ideas #35) [제안] */
  lastChanceAutoMs: 3000,
  /** 자동 전투가 켜져 있으면 클리어 카드 (S24) 가 이만큼 뒤 [다음 스테이지] — 안 볼 때는 바로 (ideas #48) [제안] */
  clearAutoMs: 10000,
  /** 패배 상자 (S17) 가 이만큼 뒤 저절로 다시 시작 — 안 볼 때는 바로 (ideas #49) [제안] */
  defeatAutoMs: 5000,
  /** 부탁 상자가 이만큼 뒤 저절로 [도와준다] — 안 볼 때는 바로 (ideas #115 — 성공률을 보여 주니 손해 없음) [제안] */
  requestAutoMs: 10000,
  /** 자리 비운 동안 요약 한 줄 "그동안: …" (ideas #16 — 1초 넘게, U1) [제안] */
  awaySummaryMs: 3000,
} as const;
