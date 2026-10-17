import type { Layout } from './layout';

/** 아주 작게로도 안 맞을 때 (mvp-spec 1장) — 게임은 멈춰 있음 */
export function TooSmall({ layout }: { layout: Layout }) {
  return (
    <div class="pg-too-small" role="status">
      패널을 위로 올려 주세요 (지금 {layout.heightPx}px · 필요 {layout.needPx}px)
    </div>
  );
}
