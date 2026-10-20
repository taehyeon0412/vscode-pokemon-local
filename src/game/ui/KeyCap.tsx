/**
 * 자판 칸 — 정보줄 메뉴 (F · M · P · B · S) · 패링 "Space 막기" · 길 위 상자 버튼 (Enter · Esc) 이 같은 모양 (game.css .pg-menu-key).
 * 2026-10-20 플레이 리뷰어 "길 위 상자의 Enter · Esc 가 title 에만 있어 키를 모름"
 */
export function KeyCap({ k }: { k: string }) {
  return <span class="pg-menu-key">{k}</span>;
}
