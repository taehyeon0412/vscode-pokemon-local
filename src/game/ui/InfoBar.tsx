import type { ComponentChildren } from 'preact';

/**
 * 위 정보줄 (20px, mvp-spec 1장) — 왼쪽 · 가운데 · 오른쪽.
 * split = 지도가 정보줄 아래 줄로 따로 있을 때 (S06 ②, 2026-10-19 태현 님): 가운데 없이 왼쪽 (볼) 은 왼쪽 끝 · 오른쪽 (메뉴) 은 오른쪽 끝 — 가운데 720px 칸 (game.css)
 * notice = 정보줄 위 가운데에 잠깐 얹는 한 줄 (3:3 버린 필살기 누름 — #88)
 */
export function InfoBar({ left, center, right, split = false, notice }: { left?: ComponentChildren; center?: ComponentChildren; right?: ComponentChildren; split?: boolean; notice?: ComponentChildren }) {
  if (split) {
    return (
      <div class="pg-infobar pg-infobar-split">
        <div class="pg-infobar-left">{left}</div>
        <div class="pg-infobar-right">{right}</div>
        {notice}
      </div>
    );
  }
  return (
    <div class="pg-infobar">
      <div class="pg-infobar-left">{left}</div>
      <div class="pg-infobar-center">{center}</div>
      <div class="pg-infobar-right">{right}</div>
      {notice}
    </div>
  );
}
