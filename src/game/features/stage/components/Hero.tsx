/**
 * 주인공 (S06 ③) — 코드로 그린 픽셀 사람 (원작 그림 아님). 오른쪽을 보고 제자리걸음, 다리 두 장이 번갈아 (game.css .pg-hero).
 * 남 · 여 머리 모양은 단계 10 (S03) — 지금은 모자 쓴 기본 모양.
 */
import { memo } from 'preact/compat';

const ROWS_TOP = [
  '...rrrr...',
  '..rrrrrr..',
  '..rrrrrrrr',
  '..hssss...',
  '..hsses...',
  '...ssss...',
  '..tttttt..',
  '.sttttttts',
  '.s.tttt..s',
  '...tttt...',
];
const LEGS_A = ['...pppp...', '...p..p...', '...p..p...', '..kk..kk..'];
const LEGS_B = ['...pppp...', '....pp....', '....pp....', '...kkkk...'];
const COLORS: Record<string, string> = {
  r: '#d8382e',
  h: '#3b2a1c',
  s: '#f2c9a0',
  e: '#1d1d1d',
  t: '#2f6fd0',
  p: '#3a4152',
  k: '#1d1d1d',
};

function rects(rows: readonly string[], y0: number) {
  const out = [];
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y]!;
    for (let x = 0; x < row.length; x++) {
      const c = COLORS[row[x]!];
      if (c) out.push(<rect key={`${x},${y}`} x={x} y={y0 + y} width={1} height={1} fill={c} />);
    }
  }
  return out;
}

/** px = 픽셀 하나 크기 (크기 배율 × 2) · walking = 걷는 중이면 다리가 움직임 — 값이 같으면 다시 안 그림 (초당 30번 화면 갱신) */
export const Hero = memo(function Hero({ px, walking }: { px: number; walking: boolean }) {
  const h = (ROWS_TOP.length + LEGS_A.length) * px;
  return (
    <svg class={walking ? 'pg-hero pg-walking' : 'pg-hero'} width={10 * px} height={h} viewBox={`0 0 10 ${ROWS_TOP.length + LEGS_A.length}`} shape-rendering="crispEdges" aria-label="주인공">
      {rects(ROWS_TOP, 0)}
      <g class="pg-legs-a">{rects(LEGS_A, ROWS_TOP.length)}</g>
      <g class="pg-legs-b">{rects(LEGS_B, ROWS_TOP.length)}</g>
    </svg>
  );
});
