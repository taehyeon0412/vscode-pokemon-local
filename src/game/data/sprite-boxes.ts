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

/** 전투 그림 (걷기) 의 [왼쪽 끝, 발끝] — 가장 오래 보이는 값 (scripts/sprite-boxes.py · 뒤에 그림 범위 넷이 더 있음 — walkArtBoxOf). 마지막 한 방 벌러덩 90° 의 누운 높이 (battle/model koSinkPx) */
export type WalkBox = readonly [number, number];

const WALK: Readonly<Record<string, WalkBox>> = walkJson as unknown as Record<string, WalkBox>;

export function walkBoxOf(form: string): WalkBox | undefined {
  return WALK[form];
}

/** 걷기 그림 모든 장면을 합친 그림 범위 [왼, 위, 오른, 아래, 바닥] (sprite-walk.json 셋째 칸부터 — 바닥 = 가장 오래 보이는 발끝) — 3:3 띠 · 컷인 · 머리 위 글의 걷기 얼굴 창 (ui/Sprite) */
export function walkArtBoxOf(form: string): SpriteBox | undefined {
  const w = WALK[form] as readonly number[] | undefined;
  return w && w.length >= 6 ? [w[2]!, w[3]!, w[4]!, w[5]!, w[1]!] : undefined;
}
