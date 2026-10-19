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
}

/** 포켓몬 그림 하나 — 픽셀이 뭉개지지 않게, 키는 원본 × 배율 */
export function Sprite({ media, form, scale, shiny, action, faceLeft, title, px: fixedPx, crop }: SpriteProps) {
  const src = spriteSrc(media, form, { shiny, action });
  const px = fixedPx ?? spritePx(form, scale);
  if (!src) return <span class="pg-sprite pg-sprite-missing" style={{ width: `${crop ?? px}px`, height: `${crop ?? px}px` }} title={title} />;
  if (crop) {
    const natural = spritePx(form, 1);
    const s = natural > crop * 2 ? natural / 2 : natural;
    // 가로 가운데 · 세로는 발 쪽 (그림 위쪽은 대개 빈칸)
    return (
      <span class="pg-sprite-crop" style={{ width: `${crop}px`, height: `${crop}px` }} title={title}>
        <img class={faceLeft ? 'pg-sprite pg-face-left' : 'pg-sprite'} src={src} width={s} height={s} alt={title ?? ''} draggable={false} style={{ left: `${Math.round((crop - s) / 2)}px`, top: `${Math.round((crop - s) * 0.8)}px` }} />
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
