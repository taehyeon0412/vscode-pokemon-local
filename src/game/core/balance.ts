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
} as const;
