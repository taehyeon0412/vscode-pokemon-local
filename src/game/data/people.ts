/**
 * 사람 그림 목록 — 파이어레드 · 에메랄드 원작 필드 그림 152명 (2026-10-19 태현 님: 원작 그림 씀 · 이름은 모두 한글).
 * 그림 · 목록은 scripts/people/fetch-pret.py 가 만듦 → extension/media/people/<id>/walk.png (옆모습, 오른쪽을 봄) · front.png (정면)
 * 걷는 사람은 walk 4장 (서기 · 한 발 · 서기 · 다른 발), 원작에서도 걷지 않는 사람 (관장 · 사천왕 등) 은 1장.
 * 쓰는 곳: 주인공 고르기 (heroes.ts) · 숲 트레이너 · 관장 (core/rules/trainer.ts) · 부탁하는 사람 (core/rules/request.ts) — 겹치지 않게 리드가 배치.
 */
import peopleJson from './generated/people.json';

/** 가로로 이은 장면 그림 — 장면 수 · 한 장면 크기 (칸) */
export interface SheetArt {
  frames: number;
  w: number;
  h: number;
}

export type PeopleGroup = 'hero' | 'leader' | 'elite' | 'villain' | 'trainer' | 'people';

export interface PersonArt {
  /** 그림 폴더 이름 */
  id: string;
  /** 한글 이름 */
  name: string;
  group: PeopleGroup;
  /** 받은 곳 (원작 저장소 · 파일) */
  source: string;
  walk: SheetArt;
  front: SheetArt;
}

export const PEOPLE: readonly PersonArt[] = peopleJson as PersonArt[];

const BY_ID = new Map(PEOPLE.map((p) => [p.id, p]));

export function personOf(id: string | undefined): PersonArt | undefined {
  return id === undefined ? undefined : BY_ID.get(id);
}
