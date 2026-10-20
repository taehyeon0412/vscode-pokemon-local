/**
 * 대화 상자 얼굴 칸 (Sea of Stars 대화 상자 왼쪽 얼굴 — 2026-10-20 아트 디렉터 4차, ideas #122):
 * 원작 정면 그림 (data/people.ts front.png) 첫 장의 머리 쪽 위 12칸을 ×2 — 길 위 사람 그림과 같은 배율. 그림이 없으면 아무것도 안 그림
 */
import { personOf } from '../data/people';

const FACE_ROWS = 12;
const FACE_SCALE = 2;

export function Face({ media, id }: { media: string; id: string | undefined }) {
  const p = personOf(id);
  if (!p || !media) return null;
  const { w, h, frames } = p.front;
  return (
    <span class="pg-face" style={{ width: `${w * FACE_SCALE}px`, height: `${FACE_ROWS * FACE_SCALE}px` }} aria-hidden="true">
      <img src={`${media.replace(/\/+$/, '')}/people/${p.id}/front.png`} width={w * frames * FACE_SCALE} height={h * FACE_SCALE} alt="" draggable={false} />
    </span>
  );
}
