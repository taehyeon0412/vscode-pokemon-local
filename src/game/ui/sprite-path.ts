/** 포켓몬 그림 — 확장 media 폴더의 GIF (원래 확장과 같은 그림) */
import { formOf } from '../data';
import { BASE_SPRITE_PX } from './layout';

export type SpriteAction = 'idle' | 'walk';

/** <media>/gen<N>/<모습>/<default|shiny>_<idle|walk>_8fps.gif — 모르는 모습이면 null */
export function spriteSrc(media: string, form: string, options: { shiny?: boolean; action?: SpriteAction } = {}): string | null {
  const f = formOf(form);
  if (!f || !media) return null;
  const color = options.shiny && f.shiny ? 'shiny' : 'default';
  return `${media.replace(/\/+$/, '')}/gen${f.gen}/${form}/${color}_${options.action ?? 'idle'}_8fps.gif`;
}

/** 그림 키 (px) = 원본 크기 × 크기 배율 (원본이 64px 인 포켓몬은 두 배) */
export function spritePx(form: string, scale: number): number {
  return (formOf(form)?.size ?? BASE_SPRITE_PX) * scale;
}
