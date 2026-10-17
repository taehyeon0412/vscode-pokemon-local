import type { ComponentChildren } from 'preact';

/** 위 정보줄 (20px, mvp-spec 1장) — 왼쪽 · 가운데 · 오른쪽 */
export function InfoBar({ left, center, right }: { left?: ComponentChildren; center?: ComponentChildren; right?: ComponentChildren }) {
  return (
    <div class="pg-infobar">
      <div class="pg-infobar-left">{left}</div>
      <div class="pg-infobar-center">{center}</div>
      <div class="pg-infobar-right">{right}</div>
    </div>
  );
}
