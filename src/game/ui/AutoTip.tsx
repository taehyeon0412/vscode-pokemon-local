/**
 * 자동 전투 첫 안내 (기획 R12 — gdd 3단계 문구 "자동 스위치 옆에", 엔진 toast kind 'auto-tip') — 스위치 묶음 (.pg-auto-wrap) 을 재서 그 옆에 한 줄 판.
 * 자리 (fixed — 정보줄 오른쪽 칸 overflow 에 잘려 안 보이던 것): below = 스위치 아래 (정보줄 · 위 가로 메뉴) · above = 위 (무대 아래쪽 메뉴 줄) ·
 * low = 패널 아래 끝 · 스위치 왼쪽 끝에 맞춤 (무대 위 스위치 — 위로 띄우면 240 · 480 에서 내 HP 줄을, 바로 아래면 내 포켓몬을 가리던 것).
 * 글 속 "[A]" 는 키 칸 · 좁으면 "—" 뒤에서 두 줄 · 패널 양 끝 8px 안 · 정수 px.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { KeyCap } from './KeyCap';

const EDGE_PX = 8;
const GAP_PX = 4;

export type AutoTipPlace = 'below' | 'above' | 'low';

export function AutoTip({ text, place }: { text: string; place: AutoTipPlace }) {
  const el = useRef<HTMLSpanElement>(null);
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

/** 글 속 "[A]" 같은 키 이름을 키 칸으로 */
function keyCaps(text: string): ComponentChildren {
  return text.split(/(\[[A-Z0-9]\])/).map((part, i) => (/^\[[A-Z0-9]\]$/.test(part) ? <KeyCap key={i} k={part.slice(1, -1)} /> : part));
}
