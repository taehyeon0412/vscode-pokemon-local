/** 화면에 보일 글자 모양 — 시간 · 돈 */

/** 플레이 시간: "0분" · "12분" · "3시간 5분" */
export function formatPlayTime(ms: number): string {
  const totalMin = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 60000) : 0;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

/** 돈: "1,000원" (돈 단위 = 원, gdd) */
export function formatMoney(won: number): string {
  const n = Number.isFinite(won) ? Math.max(0, Math.floor(won)) : 0;
  return `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원`;
}

/** 타입 한글 이름 — core/text 에 둠 (규칙 쪽 글에서도 씀) */
export { typeNameKo } from '../core/text';
