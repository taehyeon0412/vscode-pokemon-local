/**
 * 길 위 알림 (주운 것 · 회복 · 클리어 보너스) — 주인공 머리 위 가운데. 긴 알림이 패널 왼쪽 · 오른쪽 끝 밖으로 나가지 않게 실제 폭을 재서 8px 안쪽으로 당김
 * (2026-10-20 — 체육관 대기실 "1-3 클리어! 보너스 경험치 +130 · ◓+1 · …" 이 480px 까지 왼쪽이 잘리던 것, 예전엔 주인공 왼쪽 끝 · 최소 80px 가 가운데라 넘침).
 */
import { useLayoutEffect, useRef } from 'preact/hooks';

const EDGE = 8;

export function StageToast({ text, center, bottom }: { text: string; center: number; bottom: number }) {
  const ref = useRef<HTMLDivElement>(null);
  // 그린 뒤 폭을 재서 가운데를 당김 (.pg-toast 는 translateX(-50%) — left 가 가운데 · 끝 = 무대 폭)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el?.parentElement) return;
    const widthPx = el.parentElement.clientWidth;
    const half = el.offsetWidth / 2;
    const min = EDGE + half;
    const max = widthPx - EDGE - half;
    el.style.left = `${Math.round(max < min ? widthPx / 2 : Math.min(max, Math.max(min, center)))}px`;
  });
  return (
    <div ref={ref} class="pg-toast" style={{ left: `${Math.round(center)}px`, bottom: `${bottom}px` }}>
      {text}
    </div>
  );
}
