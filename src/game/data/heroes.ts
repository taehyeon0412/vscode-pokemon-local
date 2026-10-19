/**
 * S03 주인공 목록 (gdd S03 — 2026-10-19 태현 님 A안: 남 · 여 여러 명을 한 줄에, 칸마다 정면 그림 · 고른 캐릭터만 옆으로 걸음).
 * 그림: extension/media/people/<id>/walk.png — 옆모습 걷기 장면을 가로로 이어 붙인 것 (오른쪽을 봄, 장면마다 w × h 칸)
 *       extension/media/people/<id>/front.png — 정면 (장면을 가로로, 없으면 걷기 첫 장)
 *       walk-small.png · front-small.png — 작은 그림 (낮은 패널용, 있으면)
 * 그림이 없는 캐릭터 (walk 없음) 는 코드로 그린 사람 (Hero.tsx) [임시]. 새 캐릭터 = 그림 폴더 + 여기 한 줄.
 * 크기 (2026-10-19 태현 님 A안): 그림은 줄이지 않고 1배 (그림 1칸 = 화면 1px) 부터 — 자리가 남으면 포켓몬 배율까지 0.5 단위로 키움,
 * 1배로도 안 들어가면 작은 그림으로 (줄이면 점이 합쳐져 뭉개짐). 작은 그림도 없으면 할 수 없이 줄임.
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
  /** 큰 그림 (원본 크기) */
  walk?: SheetArt;
  front?: SheetArt;
  /** 작은 그림 — 큰 그림이 1배로도 안 들어가는 낮은 패널용 (walk-small.png · front-small.png) */
  small?: { walk: SheetArt; front?: SheetArt };
}

/**
 * 순서 = 고르기 화면 순서. id 는 세이브에 남으니 바꾸거나 지우지 말 것 (지우면 그 세이브는 성별의 첫 캐릭터로 보임).
 * 성별마다 첫 줄 (boy · girl) = look 이 없는 옛 세이브의 모습 — 그 앞에 끼우지 말 것.
 */
export const HERO_LOOKS: readonly HeroLook[] = [
  // 파이어레드 · 리프그린 원작 필드 그림 (scripts/people/fetch-frlg.py) — id 는 옛 세이브 때문에 boy · girl 그대로
  { id: 'boy', label: '레드', gender: 'male', walk: { frames: 4, w: 15, h: 19 }, front: { frames: 1, w: 15, h: 19 } },
  { id: 'girl', label: '리프', gender: 'female', walk: { frames: 4, w: 15, h: 19 }, front: { frames: 1, w: 15, h: 19 } },
  // 2026-10-19 태현 님이 준 걷기 4장 (20 × 28칸, 넓게 · 모음 · 넓게 · 모음) 을 그대로
  { id: 'cap-girl', label: '모자 소녀', gender: 'female', walk: { frames: 4, w: 20, h: 28 } },
];

export function isHeroLookId(id: unknown): id is string {
  return typeof id === 'string' && HERO_LOOKS.some((l) => l.id === id);
}

/** 세이브의 주인공 → 캐릭터. 모르는 이름이면 그 성별의 첫 캐릭터 (옛 세이브), 그것도 없으면 첫 캐릭터 */
export function heroLookOf(id: string | undefined, gender?: HeroGender): HeroLook {
  return HERO_LOOKS.find((l) => l.id === id) ?? HERO_LOOKS.find((l) => l.gender === gender) ?? HERO_LOOKS[0]!;
}

/** 코드 그림 사람 키 · 너비 (그림 칸 — 14 × 2 · 10 × 2) */
export const CODE_HERO_ROWS = 28;
const CODE_HERO_COLS = 20;

/** 실제로 그릴 그림 — 파일 · 장면 크기 · 그림 1칸 = 화면 몇 px */
export interface HeroDraw {
  walkFile: 'walk' | 'walk-small';
  frontFile: 'front' | 'front-small';
  walk: SheetArt;
  front?: SheetArt;
  scale: number;
}

/** 이 자리 (roomPx, 위아래로 쓸 수 있는 px) 에 그릴 그림 — 그림이 없으면 null (코드 그림) */
export function heroDraw(look: HeroLook, scale: number, roomPx = Number.POSITIVE_INFINITY): HeroDraw | null {
  if (!look.walk) return null;
  // 0.5 단위로, 포켓몬 배율을 넘지 않게
  const fit = (h: number) => Math.min(scale, Math.floor((roomPx / h) * 2) / 2);
  const shrink = (h: number) => Math.max(0.25, roomPx / h); // 1배로도 안 될 때 — 할 수 없이 줄임
  const big = fit(look.walk.h);
  if (big >= 1 || !look.small) return { walkFile: 'walk', frontFile: 'front', walk: look.walk, front: look.front, scale: big >= 1 ? big : shrink(look.walk.h) };
  const small = fit(look.small.walk.h);
  return { walkFile: 'walk-small', frontFile: 'front-small', walk: look.small.walk, front: look.small.front, scale: small >= 1 ? small : shrink(look.small.walk.h) };
}

/** 서 있는 키 (화면 px) — 그림 사람은 이 자리에 그리는 그림, 코드 그림은 28 × 배율 */
export function heroHeightPx(look: HeroLook, scale: number, roomPx?: number): number {
  const d = heroDraw(look, scale, roomPx);
  return d ? Math.round(d.walk.h * d.scale) : CODE_HERO_ROWS * scale;
}

/** 서 있는 너비 (화면 px) — 전투 때 왼쪽 끝 자리 · 띠를 옆으로 옮길 때 */
export function heroWidthPx(look: HeroLook, scale: number, roomPx?: number): number {
  const d = heroDraw(look, scale, roomPx);
  return d ? Math.round(d.walk.w * d.scale) : CODE_HERO_COLS * scale;
}
