/**
 * 안내 · 알림 상자가 무대 사람 (주인공 · 관장 · 트레이너) · 대기실 상자를 덮는지 (ideas 1665) — 대기실 · 길 위에 새 안내가 생길 때마다
 * 겹침을 손으로 재던 것 (대기실 줄 확인 규칙에 세 번 걸림 — 1631 · 2710 · #125) 을 한 판정으로. FirstTip fit · EvoTip 넘치면 한 단계가 같이 씀.
 * widen = 상자 폭을 가운데에서 넓혀 잼 (맥 여유 — 한 번 재고 마는 곳만 FIT_ROOM · 크기 · 글꼴이 바뀔 때 다시 재는 곳은 1, ux-rules U4)
 */
const AVOID = '.pg-hero-wrap, .pg-foe-trainer, .pg-banner.pg-lobby';

export function coversStage(box: HTMLElement, widen = 1): boolean {
  const game = box.closest('#pokemon-game') ?? document;
  const r = box.getBoundingClientRect();
  if (r.width === 0) return false;
  const mid = r.left + r.width / 2;
  const half = (r.width * widen) / 2;
  return Array.from(game.querySelectorAll<HTMLElement>(AVOID)).some((el) => {
    if (el.contains(box) || box.contains(el)) return false;
    const o = el.getBoundingClientRect();
    return o.width > 0 && mid - half < o.right + 2 && mid + half > o.left - 2 && r.top < o.bottom && r.bottom > o.top;
  });
}
