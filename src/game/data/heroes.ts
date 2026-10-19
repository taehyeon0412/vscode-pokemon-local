/**
 * S03 주인공 목록 (gdd S03 — 2026-10-19 태현 님 A안: 남 · 여 여러 명을 한 줄에, 칸마다 정면 그림 · 고른 캐릭터만 옆으로 걸음).
 * 그림: extension/media/people/<id>/walk.png — 옆모습 걷기 장면을 가로로 이어 붙인 것 (오른쪽을 봄, 장면마다 w × h 칸)
 *       extension/media/people/<id>/front.png — 정면 (장면을 가로로, 없으면 걷기 첫 장)
 * 그림이 없는 캐릭터 (walk 없음) 는 코드로 그린 사람 (Hero.tsx) [임시]. 새 캐릭터 = 그림 폴더 + 여기 한 줄.
 * 포켓몬 그림과 같은 픽셀 크기 (그림 1칸 = 크기 배율만큼의 화면 px).
 */
export type HeroGender = 'male' | 'female';

/** 가로로 이은 장면 그림 — 장면 수 · 한 장면 크기 (칸) */
export interface SheetArt {
  frames: number;
  w: number;
  h: number;
}

export interface HeroLook {
  /** 세이브에 남는 이름 (영문 소문자 · 숫자 · -) */
  id: string;
  /** 칸 아래 이름 */
  label: string;
  gender: HeroGender;
  walk?: SheetArt;
  front?: SheetArt;
}

/**
 * 순서 = 고르기 화면 순서. id 는 세이브에 남으니 바꾸거나 지우지 말 것 (지우면 그 세이브는 성별의 첫 캐릭터로 보임).
 * 성별마다 첫 줄 (boy · girl) = look 이 없는 옛 세이브의 모습 — 그 앞에 끼우지 말 것.
 */
export const HERO_LOOKS: readonly HeroLook[] = [
  { id: 'boy', label: '남 1', gender: 'male' },
  { id: 'girl', label: '여 1', gender: 'female' },
  // 2026-10-19 태현 님이 다른 AI 로 만든 걷기 4장 → 리드가 진짜 픽셀로 정리 · 키 28칸으로 (scripts/people/)
  { id: 'cap-girl', label: '여 2', gender: 'female', walk: { frames: 4, w: 24, h: 28 } },
];

export function isHeroLookId(id: unknown): id is string {
  return typeof id === 'string' && HERO_LOOKS.some((l) => l.id === id);
}

/** 세이브의 주인공 → 캐릭터. 모르는 이름이면 그 성별의 첫 캐릭터 (옛 세이브), 그것도 없으면 첫 캐릭터 */
export function heroLookOf(id: string | undefined, gender?: HeroGender): HeroLook {
  return HERO_LOOKS.find((l) => l.id === id) ?? HERO_LOOKS.find((l) => l.gender === gender) ?? HERO_LOOKS[0]!;
}

/** 화면에 그리는 사람 키 상한 (그림 칸) — 코드 그림 사람 (14칸 × 2) 과 같게. 알림 · 띠 · 전투 자리가 이 키에 맞춰져 있음.
 *  그림이 더 크면 줄여서 그림 (1배보다 작게 줄이면 점이 빠짐) — 새 그림은 키 28칸 이하로 받거나 미리 28칸으로 줄여 넣기 */
export const HERO_MAX_ROWS = 28;
/** 코드 그림 사람 너비 (10칸 × 2) */
const CODE_HERO_COLS = 20;

/** 그림 1칸 = 화면 몇 px — 원래는 크기 배율, 그림 키가 상한보다 크면 줄임 (정면 그림도 같은 상한 — 칸 키가 같게) */
export function heroArtScale(look: HeroLook, scale: number, art: SheetArt | undefined = look.walk): number {
  const h = art?.h ?? HERO_MAX_ROWS;
  return h > HERO_MAX_ROWS ? (scale * HERO_MAX_ROWS) / h : scale;
}

/** 서 있는 키 (화면 px) — 그림이 있으면 그림 키 × 그림 배율, 없으면 코드 그림 28 × 배율 */
export function heroHeightPx(look: HeroLook, scale: number): number {
  return look.walk ? Math.round(look.walk.h * heroArtScale(look, scale)) : HERO_MAX_ROWS * scale;
}

/** 서 있는 너비 (화면 px) — 전투 때 왼쪽 끝 자리 */
export function heroWidthPx(look: HeroLook, scale: number): number {
  return look.walk ? Math.round(look.walk.w * heroArtScale(look, scale)) : CODE_HERO_COLS * scale;
}
