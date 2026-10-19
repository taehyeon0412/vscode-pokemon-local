/**
 * 화면 틀 (mvp-spec 1장) — 포켓몬 키 · 최소 높이 · 높이가 모자랄 때 크기 낮추기.
 * 포켓몬 키 = 원본 그림 × 크기 설정 (nano ×1 · small ×1.5 · medium ×2 · large ×2.5), 크기별 최소 높이 = 보통 포켓몬 키 × 1.5 + 정보줄 20
 * 게임 모드 최소 높이는 크기 설정과 상관없이 150px (2026-10-19 태현 님 — 140 → 150, 디자인을 넉넉하게) — 낮으면 접힌 상태 (확장이 안 볼 때처럼 이어 감, main.ts sync)
 * 글자 · 버튼 · 정보줄 크기 (uiScale) 는 패널 높이에 맞춰 1 · 1.15 · 1.3 (2026-10-18 태현 님) — 남는 높이가 있을 때만 커져서 포켓몬 크기는 줄지 않음
 */
import { GAME_MIN_HEIGHT_PX } from '../shared/screen';

export const SIZES = ['nano', 'small', 'medium', 'large'] as const;
export type SizeName = (typeof SIZES)[number];

export const SIZE_SCALE: Record<SizeName, number> = { nano: 1, small: 1.5, medium: 2, large: 2.5 };
/** 보통 포켓몬 원본 키 (원본이 64px 인 큰 포켓몬은 따로) */
export const BASE_SPRITE_PX = 32;
/** 위 정보줄 높이 (uiScale 1 일 때) */
export const INFO_BAR_PX = 20;
/** 게임 모드 최소 높이 (150px) — 확장 쪽 알림 문구도 써서 shared 에 둠 */
export { GAME_MIN_HEIGHT_PX };
/** 글자 · 버튼 크기 단계 — [패널 높이 이상, 배율] (큰 것부터) */
export const UI_SCALE_STEPS: readonly (readonly [minHeightPx: number, scale: number])[] = [
  [140, 1.3],
  [92, 1.15],
];

export interface Layout {
  /** 설정한 크기 */
  wanted: SizeName;
  /** 지금 쓰는 크기 (높이가 모자라면 한 단계씩 낮춤) */
  size: SizeName;
  scale: number;
  /** 보통 포켓몬 키 */
  petPx: number;
  /** 게임 모드 최소 높이보다 낮음 → 접힌 상태 (게임 중이면 확장에 넘김) · 타이틀은 "패널을 위로 올려 주세요" */
  tooSmall: boolean;
  heightPx: number;
  /** 게임 모드 최소 높이 (tooSmall 일 때 안내) */
  needPx: number;
  /** 글자 · 버튼 · 정보줄 배율 (game.css 의 --pg-ui) */
  uiScale: number;
}

export function isSizeName(v: unknown): v is SizeName {
  return typeof v === 'string' && (SIZES as readonly string[]).includes(v);
}

/**
 * 게임 모드에서 쓸 크기 — 아주 작게 · 작게면 보통 (포켓몬 ×2 · 사람 2배, 2026-10-19 태현 님 A안).
 * 작게 (×1.5) 는 정수 배가 아니라 점 굵기가 고르지 않고 사람 (정수 배만) 이 1배라 포켓몬보다 훨씬 작아 보임 · 150px 이면 보통이 늘 들어감. 일반 모드는 설정 그대로
 */
export function gameSize(wanted: unknown): SizeName {
  const size: SizeName = isSizeName(wanted) ? wanted : 'nano';
  return size === 'nano' || size === 'small' ? 'medium' : size;
}

export function minHeightOf(size: SizeName): number {
  return BASE_SPRITE_PX * SIZE_SCALE[size] * 1.5 + INFO_BAR_PX;
}

/** 패널 높이에 맞는 크기 — 설정한 크기부터 맞을 때까지 한 단계씩 낮춤. minHeightPx 는 실제 VS Code 테스트에서만 바꿈 */
export function fitLayout(wanted: unknown, heightPx: number, minHeightPx = GAME_MIN_HEIGHT_PX): Layout {
  const want: SizeName = isSizeName(wanted) ? wanted : 'nano';
  const h = Number.isFinite(heightPx) && heightPx > 0 ? Math.floor(heightPx) : 0;
  let i = SIZES.indexOf(want);
  while (i > 0 && minHeightOf(SIZES[i]!) > h) i--;
  const size = SIZES[i]!;
  // 정보줄이 커지는 만큼 (20 × (배율 − 1)) 남는 높이가 있어야 그 배율 — 포켓몬 자리를 먹지 않게
  const spare = h - minHeightOf(size);
  const step = UI_SCALE_STEPS.find(([minH, k]) => h >= minH && spare >= Math.round(INFO_BAR_PX * (k - 1)));
  return {
    wanted: want,
    size,
    scale: SIZE_SCALE[size],
    petPx: BASE_SPRITE_PX * SIZE_SCALE[size],
    tooSmall: h < minHeightPx,
    heightPx: h,
    needPx: minHeightPx,
    uiScale: step ? step[1] : 1,
  };
}
