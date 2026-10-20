import { spriteBoxOf } from '../data/sprite-boxes';
import { BASE_SPRITE_PX } from './layout';
import { spritePx, spriteSrc, type SpriteAction } from './sprite-path';

export interface SpriteProps {
  media: string;
  form: string;
  scale: number;
  shiny?: boolean;
  action?: SpriteAction;
  /** 왼쪽을 봄 (원본 그림은 오른쪽을 봄 — 일반 모드 faceLeft 와 같음) */
  faceLeft?: boolean;
  /** 키를 직접 (전투의 큰 포켓몬 상한 등) — 없으면 원본 × 배율 */
  px?: number;
  title?: string;
  /**
   * 창 크기 (px) — 그림을 줄이지 않고 원본 ×1 을 이 크기 창으로 잘라 보임 (칩 · 버튼 안: 줄이면 점이 빠져 뭉개짐 — design-system 2장 · 아트 디렉터).
   * 원본이 창의 2배 넘게 큰 그림 (64px) 만 반으로. 전투 그림 (.pg-fighter) 은 쓰지 않음 — 연출이 <img> 폭으로 입 위치를 잼
   */
  crop?: number;
  /** crop 창 안 그림을 길 위 · 전투와 같은 크기로 (원본 32px 은 ×2 · 64px 은 ×1 = 64px — 진화 상자, 아트 디렉터 4차) */
  fieldSize?: boolean;
  /** crop 창 안에서 실제 그림 범위 (data/sprite-boxes) 를 한가운데에 — 포켓몬마다 빈칸이 달라도 위 · 아래가 같게 (없으면 발 쪽 맞춤) */
  center?: boolean;
  /** crop 창 안에서 실제 그림의 발끝을 창 아래 끝에 (가로는 그림 가운데) — 나란한 그림의 바닥을 한 줄로 (스타팅 진화 줄) */
  bottom?: boolean;
  /** crop 창 폭 (없으면 crop — 정사각형) */
  cropWidth?: number;
  /** crop 창 안 그림 배율 (정수) — 원본 크기 (32 · 64) 와 상관없이 같은 점 크기 (스타팅 진화 줄 ×2 — 진화할수록 커 보이게) */
  zoom?: number;
}

/** 길 위 · 전투 그림 크기 (원본 32px × 2) */
const FIELD_SPRITE_PX = BASE_SPRITE_PX * 2;

/** 포켓몬 그림 하나 — 픽셀이 뭉개지지 않게, 키는 원본 × 배율 */
export function Sprite({ media, form, scale, shiny, action, faceLeft, title, px: fixedPx, crop, fieldSize, center, bottom, cropWidth, zoom }: SpriteProps) {
  const src = spriteSrc(media, form, { shiny, action });
  const px = fixedPx ?? spritePx(form, scale);
  const cw = cropWidth ?? crop;
  if (!src) return <span class="pg-sprite pg-sprite-missing" style={{ width: `${cw ?? px}px`, height: `${crop ?? px}px` }} title={title} />;
  if (crop && cw) {
    const natural = spritePx(form, 1);
    const s = zoom ? natural * zoom : fieldSize ? FIELD_SPRITE_PX : natural > crop * 2 ? natural / 2 : natural;
    const box = center || bottom ? spriteBoxOf(form) : undefined;
    const k = s / natural;
    // center = 실제 그림 범위가 창 한가운데 · 아니면 가로 가운데 · 세로는 발 쪽 (그림 위쪽은 대개 빈칸). 자리는 정수 px (점이 흐려지지 않게)
    const left = box ? Math.round(cw / 2 - ((box[0] + box[2]) / 2) * k) : Math.round((cw - s) / 2);
    const top = box ? (bottom ? crop - box[3] * k : Math.round(crop / 2 - ((box[1] + box[3]) / 2) * k)) : Math.round((crop - s) * 0.8);
    return (
      <span class="pg-sprite-crop" style={{ width: `${cw}px`, height: `${crop}px` }} title={title}>
        <img class={faceLeft ? 'pg-sprite pg-face-left' : 'pg-sprite'} src={src} width={s} height={s} alt={title ?? ''} draggable={false} style={{ left: `${left}px`, top: `${top}px` }} />
      </span>
    );
  }
  return (
    <img
      class={faceLeft ? 'pg-sprite pg-face-left' : 'pg-sprite'}
      src={src}
      width={px}
      height={px}
      alt={title ?? ''}
      title={title}
      draggable={false}
    />
  );
}
