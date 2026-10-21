/**
 * 처음 한 번 안내 (2026-10-21 orders #12) — 그리는 동안 ms 를 세고 끝나면 onSeen (세이브 tips 에 적힘 → 다음부터 안 뜸).
 * 다 보기 전에 사라지면 (단계가 바뀜 · 패널을 닫음) 적히지 않아서 다음에 다시 뜸. 자리는 className 으로 (game.css .pg-first-tip-*).
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

export function FirstTip({ ms = 4000, onSeen, className = '', children }: { ms?: number; onSeen(): void; className?: string; children: ComponentChildren }) {
  const seen = useRef(onSeen);
  seen.current = onSeen;
  useEffect(() => {
    const t = window.setTimeout(() => seen.current(), ms);
    return () => window.clearTimeout(t);
  }, [ms]);
  return <div class={`pg-first-tip ${className}`}>{children}</div>;
}
