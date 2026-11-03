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

/**
 * 걷기 그림의 얼굴 자리 [가로, 세로] (원본 칸 · 그림은 오른쪽을 봄) — 그림 위 끝이 얼굴이 아닌 포켓몬만 손으로 (ideas 1682 — 꽃 · 나무 · 바위 · 잎 · 연잎 · 껍데기 · 털 ·
 * 큰 집게 · 두건이 위 끝이라 머리 위 끝 맞춤이면 얼굴이 걷기 얼굴 창 아래 끝 · 밖에 걸리던 것). 없으면 머리 위 끝 맞춤 그대로.
 * 창보다 키 큰 420 모습을 띠 창 (24 × 20) 으로 훑어 고름 (2026-11-03) · 눈 자동 어림 (테두리 색 안쪽 점) 은 안쪽 선까지 잡혀 빗나가서 손 표.
 * 몸 전체가 창에 드는 것 (토대부기) 은 넣어도 안 바뀌어 뺌
 */
const WALK_FACE: Readonly<Record<string, readonly [number, number]>> = {
  venusaur: [23, 21],
  venusaur_female: [23, 21],
  kingler: [14, 19],
  exeggutor: [18, 21],
  omastar: [20, 23],
  piloswine: [16, 22],
  ludicolo: [17, 20],
  torterra: [25, 21],
  mamoswine: [25, 19],
  crustle: [20, 25],
  chesnaught: [37, 41],
};

export function walkFaceOf(form: string): readonly [number, number] | undefined {
  return WALK_FACE[form];
}
