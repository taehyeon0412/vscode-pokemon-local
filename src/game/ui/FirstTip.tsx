/**
 * 처음 한 번 안내 (2026-10-21 orders #12) — 그리는 동안 ms 를 세고 끝나면 onSeen (세이브 tips 에 적힘 → 다음부터 안 뜸).
 * 1초 넘게 보인 뒤 사라져도 (안내대로 Z · 볼을 누름 · 단계가 바뀜) 본 것으로 적음 — 1초 안에 사라지면 다음에 다시 뜸 (UX 리뷰어: 4초를 다 봐야 적혀 자동 전투면 매번 뜨던 것). 자리는 className 으로 (game.css .pg-first-tip-*).
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

/** 이만큼 보였으면 본 것 (ux-rules U1 — 중요한 순간 1초) */
const SEEN_MS = 1000;

/** paused = 안 보는 동안 (밖 — 포커스 없음 · 숨김) — 시간을 세지 않음 (밖에서 체육관 첫 알림이 아무도 못 본 채 지나가 다시 안 뜨던 것 — UX 리뷰어 #27). 돌아오면 처음부터 */
/** seenMs = 이만큼 보였으면 사라져도 본 것 (긴 문장은 더 길게 — 3:3 "필살기 다 참 — [1] 누르면 나가요 (저절로 안 나가요)" 가 끼어들기 판에 1.3초 만에 끊겨도 본 것으로 적히던 것, UX 리뷰어 #82) */
export function FirstTip({ ms = 4000, seenMs = SEEN_MS, onSeen, className = '', paused = false, style, children }: { ms?: number; seenMs?: number; onSeen(): void; className?: string; paused?: boolean; /** 자리를 직접 (높은 패널 — 누를 포켓몬 가까이) */ style?: Record<string, string>; children: ComponentChildren }) {
  const seen = useRef(onSeen);
  seen.current = onSeen;
  // 다른 층이 이 자리를 잠깐 씀 (pg-tip-yield — 3:3 쓰러짐 줄이 발밑 판을 덮게 될 때, TeamLayer) = 안 보이는 동안 · 돌아오면 처음부터 (paused 와 같음)
  const box = useRef<HTMLDivElement>(null);
  const [yielded, setYielded] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof MutationObserver === 'undefined') return undefined;
    const mo = new MutationObserver(() => setYielded(el.classList.contains('pg-tip-yield')));
    mo.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  useEffect(() => {
    if (paused || yielded) return;
    const from = performance.now();
    let done = false;
    const t = window.setTimeout(() => {
      done = true;
      seen.current();
    }, ms);
    return () => {
      window.clearTimeout(t);
      if (!done && performance.now() - from >= seenMs) seen.current();
    };
  }, [ms, paused, yielded, seenMs]);
  return (
    <div ref={box} class={`pg-first-tip ${className}`} style={style}>
      {children}
    </div>
  );
}
