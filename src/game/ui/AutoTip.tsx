/**
 * 자동 전투 첫 안내 (기획 R12 — gdd 3단계 문구 "자동 스위치 옆에", 엔진 toast kind 'auto-tip') — 스위치 묶음 (.pg-auto-wrap) 을 재서 그 옆에 한 줄 판.
 * 자리 (fixed — 정보줄 오른쪽 칸 overflow 에 잘려 안 보이던 것): below = 스위치 아래 (정보줄 · 위 가로 메뉴) · above = 위 (무대 아래쪽 메뉴 줄) ·
 * low = 패널 아래 끝 · 스위치 왼쪽 끝에 맞춤 (무대 위 스위치 — 위로 띄우면 240 · 480 에서 내 HP 줄을, 바로 아래면 내 포켓몬을 가리던 것).
 * 글 속 "[A]" 는 키 칸 · 좁으면 "—" 뒤에서 두 줄 ("자동 전투" 는 안 갈림) · 패널 양 끝 8px 안 · 정수 px.
 * 1초 넘게 보이면 onSeen 한 번 (엔진은 그렸을 때만 셈 — tip-seen 'auto', 개발 b24a649 · 띄우자마자 세어 전투 화면이 그리지 않은 채 세 번이 끝나던 것).
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { KeyCap } from './KeyCap';

const EDGE_PX = 8;
const GAP_PX = 4;
/** 이만큼 보였으면 본 것 (ux-rules U1 — FirstTip 과 같음) */
const SEEN_MS = 1000;

/** 1초 넘게 그려지면 onSeen 한 번 — 그 전에 사라지면 안 셈 (머리 위 알림으로 대신 띄울 때도 씀) */
export function useSeen(onSeen: (() => void) | undefined): void {
  const cb = useRef(onSeen);
  cb.current = onSeen;
  useEffect(() => {
    const id = window.setTimeout(() => cb.current?.(), SEEN_MS);
    return () => window.clearTimeout(id);
  }, []);
}
export function SeenAfter({ onSeen }: { onSeen(): void }) {
  useSeen(onSeen);
  return null;
}

export type AutoTipPlace = 'below' | 'above' | 'low';

export function AutoTip({ text, place, onSeen }: { text: string; place: AutoTipPlace; onSeen?(): void }) {
  const el = useRef<HTMLSpanElement>(null);
  useSeen(onSeen);
  // 세로는 높이를 재지 않고 top / bottom 으로 (처음 그릴 때 높이가 0 으로 재져 240 에서 판이 패널 밖에 놓이던 것) · 가로만 폭을 재서 양 끝 안으로
  const put = () => {
    const t = el.current;
    const anchor = t?.parentElement;
    if (!t || !anchor) return;
    const a = anchor.getBoundingClientRect();
    t.style.left = `${Math.max(EDGE_PX, Math.min(Math.round(a.left), window.innerWidth - EDGE_PX - t.offsetWidth))}px`;
    t.style.top = place === 'below' ? `${Math.round(a.bottom) + GAP_PX}px` : 'auto';
    t.style.bottom = place === 'above' ? `${window.innerHeight - Math.round(a.top) + GAP_PX}px` : place === 'low' ? `${GAP_PX}px` : 'auto';
    t.style.visibility = 'visible';
  };
  useLayoutEffect(put);
  // 첫 그림 뒤 한 번 더 (전투 화면은 열쇠가 안 바뀌면 다시 안 그려져 첫 잼이 그대로 남음)
  useEffect(() => {
    const id = window.setTimeout(put, 120);
    return () => window.clearTimeout(id);
  }, [text, place]);
  const [head, tail] = text.split(' — ');
  return (
    <span class="pg-auto-tip" role="status" ref={el}>
      <span class="pg-tip-part">
        {keyCaps(head ?? text)}
        {tail ? ' —' : ''}
      </span>
      {tail && (
        <>
          {' '}
          <span class="pg-tip-part">{keyCaps(tail)}</span>
        </>
      )}
    </span>
  );
}

/** 글 속 "[A]" 같은 키 이름을 키 칸으로 · "자동 전투" 는 한 덩이 (240 에서 "자동 / 전투" 로 갈리던 것 — UX 리뷰어) */
function keyCaps(text: string): ComponentChildren {
  return text.split(/(\[[A-Z0-9]\])/).map((part, i) => (/^\[[A-Z0-9]\]$/.test(part) ? <KeyCap key={i} k={part.slice(1, -1)} /> : part.replace(/자동 전투/g, '자동\u00a0전투')));
}
