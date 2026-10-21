/**
 * 처음 한 번 안내 (2026-10-21 orders #12) — 그리는 동안 ms 를 세고 끝나면 onSeen (세이브 tips 에 적힘 → 다음부터 안 뜸).
 * 1초 넘게 보인 뒤 사라져도 (안내대로 Z · 볼을 누름 · 단계가 바뀜) 본 것으로 적음 — 1초 안에 사라지면 다음에 다시 뜸 (UX 리뷰어: 4초를 다 봐야 적혀 자동 전투면 매번 뜨던 것). 자리는 className 으로 (game.css .pg-first-tip-*).
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

/** 이만큼 보였으면 본 것 (ux-rules U1 — 중요한 순간 1초) */
const SEEN_MS = 1000;

export function FirstTip({ ms = 4000, onSeen, className = '', children }: { ms?: number; onSeen(): void; className?: string; children: ComponentChildren }) {
  const seen = useRef(onSeen);
  seen.current = onSeen;
  useEffect(() => {
    const from = performance.now();
    let done = false;
    const t = window.setTimeout(() => {
      done = true;
      seen.current();
    }, ms);
    return () => {
      window.clearTimeout(t);
      if (!done && performance.now() - from >= SEEN_MS) seen.current();
    };
  }, [ms]);
  return <div class={`pg-first-tip ${className}`}>{children}</div>;
}
