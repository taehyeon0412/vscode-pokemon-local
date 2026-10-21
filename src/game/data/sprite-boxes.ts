/**
 * 포켓몬 그림의 실제 그림 범위 (대기 동작 모든 장면을 합친 칸, 원본 칸 기준 [왼, 위, 오른, 아래, 바닥]) — scripts/sprite-boxes.py 가 만듦.
 * 바닥 = 가장 오래 보이는 장면의 발끝 (브리가론처럼 장면마다 발 높이가 달라도 서 있는 자리로 맞추게).
 * ui/Sprite 의 center — 그림 칸 안에서 실제 그림을 한가운데에 (포켓몬마다 빈칸 크기가 달라도 줄 위 · 아래 간격이 같게, 2026-10-20 태현 님)
 */
import boxesJson from './generated/sprite-boxes.json';
import walkJson from './generated/sprite-walk.json';

export type SpriteBox = readonly [number, number, number, number, number];

const BOXES: Readonly<Record<string, SpriteBox>> = boxesJson as unknown as Record<string, SpriteBox>;

export function spriteBoxOf(form: string): SpriteBox | undefined {
  return BOXES[form];
}

/** 전투 그림 (걷기) 의 [왼쪽 끝, 발끝] — 가장 오래 보이는 값 (scripts/sprite-boxes.py). 마지막 한 방 벌러덩 90° 의 누운 높이 (battle/model koSinkPx) */
export type WalkBox = readonly [number, number];

const WALK: Readonly<Record<string, WalkBox>> = walkJson as unknown as Record<string, WalkBox>;

export function walkBoxOf(form: string): WalkBox | undefined {
  return WALK[form];
}
