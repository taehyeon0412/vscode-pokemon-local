/**
 * 화면 틀 (mvp-spec 1장) — 포켓몬 키 · 최소 높이 · 높이가 모자랄 때 크기 낮추기.
 * 포켓몬 키 = 원본 그림 × 크기 설정 (nano ×1 · small ×1.5 · medium ×2 · large ×2.5), 최소 높이 = 보통 포켓몬 키 × 1.5 + 정보줄 20
 */
export const SIZES = ['nano', 'small', 'medium', 'large'] as const;
export type SizeName = (typeof SIZES)[number];

export const SIZE_SCALE: Record<SizeName, number> = { nano: 1, small: 1.5, medium: 2, large: 2.5 };
/** 보통 포켓몬 원본 키 (원본이 64px 인 큰 포켓몬은 따로) */
export const BASE_SPRITE_PX = 32;
/** 위 정보줄 높이 */
export const INFO_BAR_PX = 20;

export interface Layout {
  /** 설정한 크기 */
  wanted: SizeName;
  /** 지금 쓰는 크기 (높이가 모자라면 한 단계씩 낮춤) */
  size: SizeName;
  scale: number;
  /** 보통 포켓몬 키 */
  petPx: number;
  /** 아주 작게로도 안 맞음 → 게임을 멈추고 "패널을 위로 올려 주세요" */
  tooSmall: boolean;
  heightPx: number;
  /** 아주 작게의 최소 높이 (tooSmall 일 때 안내) */
  needPx: number;
}

export function isSizeName(v: unknown): v is SizeName {
  return typeof v === 'string' && (SIZES as readonly string[]).includes(v);
}

export function minHeightOf(size: SizeName): number {
  return BASE_SPRITE_PX * SIZE_SCALE[size] * 1.5 + INFO_BAR_PX;
}

/** 패널 높이에 맞는 크기 — 설정한 크기부터 맞을 때까지 한 단계씩 낮춤 */
export function fitLayout(wanted: unknown, heightPx: number): Layout {
  const want: SizeName = isSizeName(wanted) ? wanted : 'nano';
  const h = Number.isFinite(heightPx) && heightPx > 0 ? Math.floor(heightPx) : 0;
  let i = SIZES.indexOf(want);
  while (i > 0 && minHeightOf(SIZES[i]!) > h) i--;
  const size = SIZES[i]!;
  return {
    wanted: want,
    size,
    scale: SIZE_SCALE[size],
    petPx: BASE_SPRITE_PX * SIZE_SCALE[size],
    tooSmall: minHeightOf(size) > h,
    heightPx: h,
    needPx: minHeightOf('nano'),
  };
}
