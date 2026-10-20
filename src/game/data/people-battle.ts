/**
 * 트레이너 대결 그림 (VS 컷인 — 2026-10-20 태현 님 "추천대로") — 파이어레드 · 에메랄드 원작 64 × 64.
 * 그림 · 목록은 scripts/people/fetch-pret-battle.py 가 만듦 → extension/media/people/<id>/battle.png · generated/people-battle.json.
 * id = 사람 그림 목록 (people.ts) 의 id. top = 그림이 시작하는 줄 (낮은 패널에서 아래를 잘라도 머리부터 보이게)
 */
import battleJson from './generated/people-battle.json';

export interface BattleArt {
  /** 받은 곳 (원작 저장소 · 파일) */
  source: string;
  w: number;
  h: number;
  top: number;
}

const BY_ID: Readonly<Record<string, BattleArt>> = battleJson;

export function battleArtOf(id: string | undefined): BattleArt | undefined {
  return id === undefined ? undefined : BY_ID[id];
}
