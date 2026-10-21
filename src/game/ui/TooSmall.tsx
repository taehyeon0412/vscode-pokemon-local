import { useLayoutEffect, useRef } from 'preact/hooks';
import type { Layout } from './layout';

/**
 * 패널이 게임 모드 최소 높이 (150px) 보다 낮을 때 (mvp-spec 1장)
 * 게임 중 = 접힌 상태 — 패널을 접어 둔 것과 같은 규칙으로 확장이 이어 감 · 타이틀 = 올려 달라는 안내만
 */
export function TooSmall({ layout, playing, status }: { layout: Layout; playing: boolean; /** 접힌 줄 전체 (어디 · 몇 % · 기다리는 장면 / 자동 전투 · ▲ — stage/model foldStatus) */ status?: string }) {
  // 들어가는 만큼의 줄만 (높이 ÷ 줄 높이) — 240 × 20 에서 둘째 줄 머리 4px 가 잘려 보이던 것 (UX 리뷰어)
  const box = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const b = box.current;
    const t = text.current;
    if (!b || !t) return;
    t.style.maxHeight = '';
    const lh = parseFloat(getComputedStyle(t).lineHeight) || 16;
    t.style.maxHeight = `${Math.max(1, Math.floor(b.clientHeight / lh)) * lh}px`;
  });
  return (
    <div class="pg-too-small" role="status" ref={box}>
      <span ref={text}>
        {playing
          ? (status ?? '접어 둔 상태 · 자동 전투면 계속 걸어요 · 패널을 ▲ 올리면 보여요')
          : `패널을 ▲ ${layout.needPx}px 이상으로 올려 주세요`}
      </span>
    </div>
  );
}
