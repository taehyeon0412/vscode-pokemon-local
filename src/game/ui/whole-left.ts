/**
 * 가운데 맞춤 상자 (left · right 8 + fit-content + margin auto — 결과 상자 · 1:1 말 상자 · 대기실 · 클리어 · 패배 · 고르기) 의 왼쪽 끝을 정수 px 로.
 * 폭이 글자를 따라 소수 (441.23) 라 가운데 맞춤 자리가 19.38 처럼 반 픽셀이 되어 상자 · 안 글자가 흐리던 것 (bugs 2734 · 디자인 634 재기).
 * 최소 폭 (min-width) 을 1px 안쪽 소수 (+ 홀짝이 안 맞으면 1px) 만큼 넓은 정수 폭으로 — 가운데 맞춤 왼쪽 끝이 정수 px 에 그려짐.
 *   translate 로 소수만 옮기면 그린 뒤 밀어서 금색 테두리 · 글자가 오히려 흐려짐 · 오른쪽 여백을 더하면 넘치면 한 단계 (ui/useFit roomOf 등) 가 여백을 빼고 방을 재
 *   경계에서 단계가 바뀜 (대기실 500 × 150 — 첫 판 확대 · 견줌으로 확인) · 최소 폭이라 내용이 더 넓어지면 그대로 늘어남.
 * 다시 잼: 안 내용 (글 · 줄이기 단계 class) · 상자 자신의 style 이 바뀌면 (MutationObserver — 줄어든 내용 · 넓힘 변수에 옛 최소 폭이 남지 않게 · 스스로 쓴 것은 버림) · 크기 (ResizeObserver) · 패널 크기 · 글꼴 · 상자가 바뀌면 (key 로 다시 그림) 새 상자에.
 */
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { afterFonts } from './fonts';

const whole = (x: number) => Math.abs(x - Math.round(x)) < 0.02;

/** 왼쪽 끝 x · 폭 w 인 가운데 맞춤 상자를 몇 px 넓히면 왼쪽 끝이 정수인지 — 폭을 정수로 · 그래도 반 픽셀이면 1px 더 (폭이 1 늘면 왼쪽 끝이 0.5 옮김) · 이미 정수면 0 */
export function wholeAdd(x: number, w: number): number {
  if (whole(x)) return 0;
  const add = Math.round((Math.ceil(w - 0.001) - w) * 1000) / 1000;
  return whole(x - add / 2) ? add : add + 1;
}

/** 지금 준 최소 폭을 지우고 잰 뒤 다시 줌 · 가운데 맞춤이 아니라 (왼쪽 고정 자리) 폭으로 안 풀리거나 최대 폭을 넘으면 그대로 둠 · 더한 폭은 data-whole-add 에 (wholeExtra) */
export function snapLeft(el: HTMLElement): void {
  el.style.minWidth = '';
  delete el.dataset.wholeAdd;
  const r = el.getBoundingClientRect();
  const add = wholeAdd(r.left, r.width);
  if (add === 0) return;
  const cs = getComputedStyle(el);
  const edge = cs.boxSizing === 'border-box' ? 0 : parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
  el.style.minWidth = `${Math.round((r.width + add - edge) * 1000) / 1000}px`;
  const after = el.getBoundingClientRect();
  if (!whole(after.left) || Math.abs(after.width - (r.width + add)) > 0.02) el.style.minWidth = '';
  else el.dataset.wholeAdd = String(add);
}

/** 이 훅이 상자에 더한 폭 (px) — 상자 폭으로 "더 넓힐 자리" 를 재는 곳은 빼고 잼 (결과 상자 할 일 넓힘 · growOf — 1.9px 차이로 경계에서 판단이 갈리던 것, 2734 픽셀 검사원) */
export function wholeExtra(el: HTMLElement): number {
  return parseFloat(el.dataset.wholeAdd ?? '') || 0;
}

export function useWholeLeft(ref: { current: HTMLElement | null }): void {
  const on = useRef<{ el: HTMLElement; off: () => void } | null>(null);
  // 그릴 때마다는 상자가 바뀌었는지만 봄 (전투는 1초에 여러 번 그림 — 잼은 내용 · 크기 · 패널 · 글꼴이 바뀔 때만)
  useLayoutEffect(() => {
    const el = ref.current;
    if (on.current?.el === el) return;
    on.current?.off();
    on.current = null;
    if (!el) return;
    const mos: MutationObserver[] = [];
    // 스스로 쓴 최소 폭 변화는 버림 (다시 불리는 고리가 안 되게)
    const snap = () => {
      snapLeft(el);
      for (const mo of mos) mo.takeRecords();
    };
    snap();
    if (typeof MutationObserver !== 'undefined') {
      // 안 내용 (글 · 줄이기 단계 class) · 상자 자신의 style (결과 상자 할 일 넓힘 변수 --pg-how-w 가 줄면 옛 최소 폭이 남지 않게)
      const inner = new MutationObserver(snap);
      inner.observe(el, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });
      const own = new MutationObserver(snap);
      own.observe(el, { attributes: true, attributeFilter: ['style'] });
      mos.push(inner, own);
    }
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(snap);
    ro?.observe(el);
    window.addEventListener('resize', snap);
    const offFonts = afterFonts(snap);
    on.current = {
      el,
      off: () => {
        for (const mo of mos) mo.disconnect();
        ro?.disconnect();
        window.removeEventListener('resize', snap);
        offFonts();
      },
    };
  });
  useEffect(() => () => on.current?.off(), []);
}
