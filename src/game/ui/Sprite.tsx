import { spriteBoxOf, walkArtBoxOf, type SpriteBox } from '../data/sprite-boxes';
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
  /** crop 창 안에서 그림의 바닥 (가장 오래 보이는 장면의 발끝 — data/sprite-boxes) 을 창 아래 끝에서 bottomPad px 위에 (가로는 그림 가운데) — 나란한 그림의 바닥을 한 줄로 (스타팅 진화 줄) */
  bottom?: boolean;
  /** bottom 일 때 바닥 아래 여유 px (기본 그림 한 칸) — 바닥보다 내려가는 장면 + 한 칸 (끝에 딱 붙이면 화면 배율 125 · 150% 에서 반올림으로 발끝이 잘림 — 태현 님 "잘려 보이네") */
  bottomPad?: number;
  /** crop 창 폭 (없으면 crop — 정사각형) */
  cropWidth?: number;
  /** crop 창 안 그림 배율 (정수) — 원본 크기 (32 · 64) 와 상관없이 같은 점 크기 (스타팅 진화 줄 ×2 — 진화할수록 커 보이게) */
  zoom?: number;
}

/** 길 위 · 전투 그림 크기 (원본 32px × 2) */
const FIELD_SPRITE_PX = BASE_SPRITE_PX * 2;

/** 작은 창 얼굴을 ×1 로 자르는 그림 범위 긴 변 상한 (원본 칸) — 강철톤 32 · 개굴반장 33 · 염무왕 · 브리가론 34 까지 · 고래왕 36 · 그란돈 38 · 전설은 반 */
const FACE_MAX = 34;

/**
 * 작은 창 얼굴 — 64px 원본 중 실제 그림 범위가 작은 것 (샤로다 · 염무왕 · 대검귀 · 브리가론 · 개굴반장 — 반으로 줄이면 12 ~ 17px 로 뭉쳐
 * 개굴반장이 어두운 덩어리, ideas 1675) 은 줄이지 않고 ×1 로 얼굴 쪽을 자름 → 그 그림 범위 · 반으로도 창을 채우는 큰 그림 (전설) 은 그대로 반 (undefined)
 * 창 크기와 상관없이 포켓몬마다 정함 — 창마다 문턱이 다르면 포켓몬 판 선두 칩 (22) 은 ×1 · 메뉴 버튼 (20) 은 반으로 한 화면에 두 배율 (아트 디렉터 1675 · 원칙 4)
 * walk = 걷기 그림 (3:3 띠 · 컷인 · 머리 위 글) — 고르는 건 같은 대기 그림 범위로 (칩 · 띠가 같은 배율) · 자리는 걷기 그림 범위로 (아트 디렉터 1675 다음)
 */
export function faceCrop(form: string, crop: number, walk = false): SpriteBox | undefined {
  const box = spriteBoxOf(form);
  if (!box || spritePx(form, 1) <= crop * 2) return undefined;
  if (Math.max(box[2] - box[0], box[3] - box[1]) > FACE_MAX) return undefined;
  return walk ? (walkArtBoxOf(form) ?? box) : box;
}

/** crop 창 안 그림 크기 · 자리 (정수 px) — Sprite 가 씀 (테스트용으로 따로) */
export function cropPlace(
  form: string,
  crop: number,
  cw: number,
  o: Pick<SpriteProps, 'action' | 'faceLeft' | 'fieldSize' | 'center' | 'bottom' | 'bottomPad' | 'zoom'> = {},
): { s: number; left: number; top: number } {
  const { action, faceLeft, fieldSize, center, bottom, bottomPad, zoom } = o;
  const natural = spritePx(form, 1);
  // 걷기 그림 (3:3 띠 · 컷인 · 머리 위 글의 얼굴 창 · 합동 컷인 큰 그림) 은 걷기 그림 범위로 — 대기 그림 범위로 맞추면 2 ~ 3.5칸 어긋나 얼굴이 창 끝에 붙던 것 (차오꿀 · 엘리게이 등)
  const walk = action === 'walk';
  const face = zoom || fieldSize ? undefined : faceCrop(form, crop, walk);
  const s = zoom ? natural * zoom : fieldSize ? FIELD_SPRITE_PX : face ? natural : natural > crop * 2 ? natural / 2 : natural;
  const box = face ?? (center || bottom ? ((walk ? walkArtBoxOf(form) : undefined) ?? spriteBoxOf(form)) : undefined);
  const k = s / natural;
  // center = 실제 그림 범위가 창 한가운데 · 아니면 가로 가운데 · 세로는 발 쪽 (그림 위쪽은 대개 빈칸). 자리는 정수 px (점이 흐려지지 않게)
  //   face · 걷기 얼굴 = 가로 가운데 · 세로는 그림 위 끝 (머리) 을 창 위 끝에서 한 칸 아래 (창보다 낮은 그림이면 한가운데 — 마폭시 · 메가니움 머리가 창 위로 4 ~ 6칸 잘리던 것)
  //     걷기 얼굴이 창보다 넓으면 가로도 앞 끝 (얼굴 쪽 — 걷기 그림은 오른쪽을 봄) 을 창 앞 끝에서 한 칸 안 (가운데면 차오꿀 · 메가니움 얼굴이 창 끝에 7 ~ 12줄 잘리던 것, UX 1675b) · 꼬리 쪽이 잘림
  //   왼쪽을 보면 (faceLeft = 그림을 좌우로 뒤집음) 범위도 뒤집힌 자리 (라이츄 상대 얼굴이 5칸 옆으로 밀려 꼬리가 창 끝에 잘리던 것)
  const cx = box ? (box[0] + box[2]) / 2 : 0;
  const front = !!box && walk && !!(face || center) && (box[2] - box[0]) * k > cw - 2;
  const left = box
    ? front
      ? Math.round(faceLeft ? 1 - s + box[2] * k : cw - 1 - box[2] * k)
      : Math.round(cw / 2 - (faceLeft ? natural - cx : cx) * k)
    : Math.round((cw - s) / 2);
  const top =
    box && (face || (walk && center))
      ? Math.max(Math.round(1 - box[1] * k), Math.round(crop / 2 - ((box[1] + box[3]) / 2) * k))
      : box
        ? bottom
          ? crop - box[4] * k - (bottomPad ?? k)
          : Math.round(crop / 2 - ((box[1] + box[3]) / 2) * k)
        : Math.round((crop - s) * 0.8);
  return { s, left, top };
}

/** 포켓몬 그림 하나 — 픽셀이 뭉개지지 않게, 키는 원본 × 배율 */
export function Sprite({ media, form, scale, shiny, action, faceLeft, title, px: fixedPx, crop, fieldSize, center, bottom, bottomPad, cropWidth, zoom }: SpriteProps) {
  const src = spriteSrc(media, form, { shiny, action });
  const px = fixedPx ?? spritePx(form, scale);
  const cw = cropWidth ?? crop;
  if (!src) return <span class="pg-sprite pg-sprite-missing" style={{ width: `${cw ?? px}px`, height: `${crop ?? px}px` }} title={title} />;
  if (crop && cw) {
    const { s, left, top } = cropPlace(form, crop, cw, { action, faceLeft, fieldSize, center, bottom, bottomPad, zoom });
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
