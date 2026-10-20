/**
 * 포켓몬 그림의 실제 그림 범위 (대기 동작 모든 장면을 합친 칸, 원본 칸 기준 [왼, 위, 오른, 아래]) — scripts/sprite-boxes.py 가 만듦.
 * ui/Sprite 의 center — 그림 칸 안에서 실제 그림을 한가운데에 (포켓몬마다 빈칸 크기가 달라도 줄 위 · 아래 간격이 같게, 2026-10-20 태현 님)
 */
import boxesJson from './generated/sprite-boxes.json';

export type SpriteBox = readonly [number, number, number, number];

const BOXES: Readonly<Record<string, SpriteBox>> = boxesJson as unknown as Record<string, SpriteBox>;

export function spriteBoxOf(form: string): SpriteBox | undefined {
  return BOXES[form];
}
