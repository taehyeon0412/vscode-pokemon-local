/**
 * 사람 (S06 ③ 주인공 · 트레이너 · 관장 · 부탁하는 사람) — 사람 그림 (data/people.ts · heroes.ts) 이 있으면 그 그림
 * (옆 걷기 · 정면 장면을 가로로 이은 것, 자리에 맞춰 큰 그림 / 작은 그림), 없으면 코드로 그린 픽셀 사람. 오른쪽을 보고 제자리걸음 (game.css .pg-hero · .pg-sheet).
 * 코드 그림: 남 · 여는 머리 모양만 다름 (여자는 모자 밑으로 긴 머리). 트레이너 · 관장도 같은 모양에 모자 · 옷 색만 바꿔 씀 (왼쪽을 봄).
 */
import { memo } from 'preact/compat';
import { heroDraw, type HeroLook, type SheetArt } from '../../../data/heroes';

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
/** 여자 주인공 — 모자 밑 뒤쪽으로 긴 머리 (머리 모양만 다름, gdd S03) */
const ROWS_TOP_FEMALE = [
  '...rrrr...',
  '.hrrrrrr..',
  'hhrrrrrrrr',
  'hhhssss...',
  'hhhsses...',
  '.hhssss...',
  '.hhtttttt.',
  '.hstttttts',
  '.hs.tttt.s',
  '..h.tttt..',
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

function rects(rows: readonly string[], y0: number, colors: Record<string, string>) {
  const out = [];
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y]!;
    for (let x = 0; x < row.length; x++) {
      const c = colors[row[x]!];
      if (c) out.push(<rect key={`${x},${y}`} x={x} y={y0 + y} width={1} height={1} fill={c} />);
    }
  }
  return out;
}

export interface HeroProps {
  /** 픽셀 하나 크기 (크기 배율 × 2) */
  px: number;
  /** 걷는 중이면 다리가 움직임 */
  walking: boolean;
  /** 트레이너 · 관장 — 모자 · 옷 색 (없으면 주인공) */
  hat?: string;
  shirt?: string;
  faceLeft?: boolean;
  label?: string;
  /** 주인공 남 · 여 (S03) — 없으면 남 */
  gender?: 'male' | 'female';
  /** 고른 캐릭터 — 그림 (walk) 이 있고 media 가 있으면 그림으로 */
  look?: HeroLook;
  media?: string;
  /** 정면 (S03 칸) — walking 이면 정면으로 제자리걸음, 정면 그림이 없으면 옆모습 */
  front?: boolean;
  /** 위아래로 쓸 수 있는 px — 큰 그림이 안 들어가면 작은 그림 (data/heroes.ts heroDraw) */
  roomPx?: number;
}

/** 걷기 그림 한 장 (ms) — 걷는 속도 2배 (2026-10-19) 에 맞춰 조금 빠르게 */
const WALK_FRAME_MS = 130;

/** 가로로 이은 장면 그림 — 칸 하나만 보이게 자르고, 걸을 때는 장면을 한 칸씩 옮김 (steps) */
function Sheet({ src, art, scale, run, frameMs, title }: { src: string; art: SheetArt; scale: number; run: boolean; frameMs: number; title?: string }) {
  // 한 장면 폭을 정수 px 로 — 한 칸씩 옮길 때 옆 장면이 비치지 않게
  const w = Math.max(1, Math.round(art.w * scale));
  const h = Math.max(1, Math.round(art.h * scale));
  const moving = run && art.frames > 1;
  return (
    <span class="pg-sheet" style={{ width: `${w}px`, height: `${h}px` }} title={title}>
      <img
        class={moving ? 'pg-sheet-img pg-sheet-run' : 'pg-sheet-img'}
        src={src}
        width={w * art.frames}
        height={h}
        alt={title ?? ''}
        draggable={false}
        style={moving ? { animationDuration: `${art.frames * frameMs}ms`, animationTimingFunction: `steps(${art.frames})` } : undefined}
      />
    </span>
  );
}

/** 값이 같으면 다시 안 그림 (초당 30번 화면 갱신) */
export const Hero = memo(function Hero({ px, walking, hat, shirt, faceLeft, label, gender, look, media, front, roomPx }: HeroProps) {
  const d = look && media ? heroDraw(look, px / 2, roomPx) : null;
  if (look && d) {
    const base = `${media!.replace(/\/+$/, '')}/people/${look.dir ?? look.id}`;
    return (
      <span class={['pg-hero', 'pg-hero-art', faceLeft ? 'pg-face-left' : ''].filter(Boolean).join(' ')}>
        {front && d.front ? (
          <Sheet src={`${base}/${d.frontFile}.png`} art={d.front} scale={d.scale} run={walking} frameMs={WALK_FRAME_MS} title={label} />
        ) : (
          <Sheet src={`${base}/${d.walkFile}.png`} art={d.walk} scale={d.scale} run={walking} frameMs={WALK_FRAME_MS} title={label} />
        )}
      </span>
    );
  }
  const top = gender === 'female' ? ROWS_TOP_FEMALE : ROWS_TOP;
  const h = (ROWS_TOP.length + LEGS_A.length) * px;
  const colors = hat || shirt ? { ...COLORS, ...(hat ? { r: hat } : {}), ...(shirt ? { t: shirt } : {}) } : COLORS;
  const cls = ['pg-hero', walking ? 'pg-walking' : '', faceLeft ? 'pg-face-left' : ''].filter(Boolean).join(' ');
  return (
    <svg class={cls} width={10 * px} height={h} viewBox={`0 0 10 ${ROWS_TOP.length + LEGS_A.length}`} shape-rendering="crispEdges" aria-label={label ?? '주인공'}>
      {rects(top, 0, colors)}
      <g class="pg-legs-a">{rects(LEGS_A, ROWS_TOP.length, colors)}</g>
      <g class="pg-legs-b">{rects(LEGS_B, ROWS_TOP.length, colors)}</g>
    </svg>
  );
});

