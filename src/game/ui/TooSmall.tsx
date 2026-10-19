import type { Layout } from './layout';

/**
 * 패널이 게임 모드 최소 높이 (150px) 보다 낮을 때 (mvp-spec 1장)
 * 게임 중 = 접힌 상태 — 패널을 접어 둔 것과 같은 규칙으로 확장이 이어 감 · 타이틀 = 올려 달라는 안내만
 */
export function TooSmall({ layout, playing }: { layout: Layout; playing: boolean }) {
  return (
    <div class="pg-too-small" role="status">
      <span>
        {playing
          ? `접어 둔 상태 · 자동 전투면 계속 걸어요 · ▲ ${layout.needPx}px 이상으로 올리면 보여요`
          : `패널을 ▲ ${layout.needPx}px 이상으로 올려 주세요`}
      </span>
    </div>
  );
}
