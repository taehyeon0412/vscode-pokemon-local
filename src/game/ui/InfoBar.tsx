import type { ComponentChildren } from 'preact';

/**
 * 위 정보줄 (20px, mvp-spec 1장) — 왼쪽 · 가운데 · 오른쪽.
 * split = 지도가 정보줄 아래 줄로 따로 있을 때 (S06 ②, 2026-10-19 태현 님): 가운데 없이 왼쪽 (볼) 은 왼쪽 끝 · 오른쪽 (메뉴) 은 오른쪽 끝 — 가운데 720px 칸 (game.css)
 */
export function InfoBar({ left, center, right, split = false }: { left?: ComponentChildren; center?: ComponentChildren; right?: ComponentChildren; split?: boolean }) {
  if (split) {
    return (
      <div class="pg-infobar pg-infobar-split">
        <div class="pg-infobar-left">{left}</div>
        <div class="pg-infobar-right">{right}</div>
      </div>
    );
  }
  return (
    <div class="pg-infobar">
      <div class="pg-infobar-left">{left}</div>
      <div class="pg-infobar-center">{center}</div>
      <div class="pg-infobar-right">{right}</div>
    </div>
  );
}
