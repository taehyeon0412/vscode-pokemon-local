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
  /** 스테이지 걷는 시간 (전투 · 부탁 빼고) — 2026-10-18 태현 님 */
  stageWalkMs: 15 * 60_000,
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
  /** 만나는 것들이 놓이는 구간 (시작하자마자 · 끝에서 바로 만나지 않게) [제안] */
  stageSpotRange: [0.04, 0.97],
  /** 병원 · 상점 = "중간쯤 랜덤 자리" [제안] */
  stageFacilityRange: [0.3, 0.75],
  /** 숲 레벨대 [낮은 끝, 높은 끝] — 진행 % 에 따라 올라감 */
  /** 1-1 은 2 ~ 5 (처음 3 ~ 6 → 단계 9 시뮬: 스타팅 한 마리 자동 전투로 1-1 에서 평균 9.7번 짐 — 진 뒤 회복이 생겨서 드러남 → 7.0번) [임시값] */
  stageLevels: { 'forest-1': [2, 5], 'forest-2': [6, 10], 'forest-3': [10, 13] },
  /** 센 포켓몬 흔적: 확률 · 레벨대 위끝 + */
  strongTraceChance: 0.15,
  strongLevelBonus: 2,
  /** 독 · 드래곤 · 페어리를 섞는 확률 */
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
  /** 선제공격 타이밍 창 — 튀어나온 뒤 이 시간 안에 Space */
  preemptiveWindowMs: 600,
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
  walkRegenPerMinute: 0.1,
  /** 졌을 때 잃는 돈 (관장전은 안 잃음 — gdd 4.10) */
  defeatMoneyLoss: 0.1,
  /** 상점 값 (원, 4장) — 마스터볼은 안 팖 */
  shopPrices: { 'poke-ball': 200, 'great-ball': 600, 'ultra-ball': 1200, potion: 300, 'super-potion': 700, 'full-heal': 600, revive: 1500 },
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
  /** 힘대결 길이 (연타하는 시간) */
  clashMs: 4000,
  /** 힘대결 승자가 정해진 뒤 이긴 줄기가 뚫고 나가는 시간 → 피해 */
  clashResultMs: 800,
  /** 전투 끝 결과 (쓰러뜨렸다 · 도망쳤다) 를 보여 주는 시간 */
  battleOverMs: 1800,
  /** S11 타이밍 원이 줄어드는 시간 · 그 뒤 늦게 눌러도 받는 시간 · 볼이 흔들리고 결과를 보여 주는 시간 */
  catchRingMs: 1200,
  catchShakeMs: 1100,
  /** 이긴 뒤 마지막 기회 — 볼을 고르지 않으면 이 시간 뒤 그냥 지나감 [제안] */
  lastChanceMs: 6000,
  /** S12 결과를 보여 주는 시간 (계속 · Space · Enter 로 넘김) [제안] */
  resultMs: 3500,
  /** S22 진화 연출 (Space = 빨리 넘기기) · 시작하고 이 시간 동안은 Space · Esc 를 안 받음 (결과에서 Space 를 두 번 눌러 연출을 통째로 놓치지 않게) */
  evolveAnimMs: 4000,
  evolveGuardMs: 800,
  /** 병원 · 상점 앞에서 [들어가기] [지나가기] 를 기다리는 시간 → 지나감 (2026-10-18 태현 님) */
  facilityPromptMs: 5000,
  /** 트레이너와 눈이 마주침: "!" → "승부다!" + ◓ 개수 → 전투 */
  trainerAlertMs: 700,
  trainerMeetMs: 2200,
  /** 상대 트레이너가 다음 포켓몬을 내보내는 시간 */
  foeSendMs: 1300,
} as const;
