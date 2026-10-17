import { spritePx, spriteSrc, type SpriteAction } from './sprite-path';

export interface SpriteProps {
  media: string;
  form: string;
  scale: number;
  shiny?: boolean;
  action?: SpriteAction;
  /** 왼쪽을 봄 (원본 그림은 오른쪽을 봄 — 일반 모드 faceLeft 와 같음) */
  faceLeft?: boolean;
  title?: string;
}

/** 포켓몬 그림 하나 — 픽셀이 뭉개지지 않게, 키는 원본 × 배율 */
export function Sprite({ media, form, scale, shiny, action, faceLeft, title }: SpriteProps) {
  const src = spriteSrc(media, form, { shiny, action });
  const px = spritePx(form, scale);
  if (!src) return <span class="pg-sprite pg-sprite-missing" style={{ width: `${px}px`, height: `${px}px` }} title={title} />;
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
