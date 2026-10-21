/**
 * 넘치면 한 단계 (ux-rules U4 — 폭 경계를 손으로 고르지 않음) — 길 위 상자 (.pg-banner, ref) 의 줄 (자식) 마다 내용의 실제 너비 × 여유 가 상자가 커질 수 있는 안쪽 폭을 넘으면 단계를 하나 올림.
 * 상자 · 줄은 내용만큼 줄어드는 판이라 줄 폭이 아니라 최대 폭 (패널 − 16 · 높은 주인공이면 --pg-banner-max) 과 비교 (줄 폭과 견주면 넓은 패널에서도 늘 넘친 것으로 재지던 것).
 * 여유 1.1 = 맥 글꼴이 윈도우보다 넓은 만큼 (ux-rules U4 "가로 여유 10%" — 1.0 이면 맥에서 버튼 끝이 잘리던 것, UX 리뷰어 #27).
 * 패널 크기가 바뀌면 0 단계부터 다시 잼 (한 번 줄면 넓혀도 안 돌아오던 것) · 글꼴이 늦게 오면 400ms · fonts.ready 에 다시 잼.
 */
import { useEffect, useLayoutEffect, useState } from 'preact/hooks';

const ROOM = 1.1;

/** 줄 내용의 실제 너비 = 칸마다 (글 · 칸) 너비 합 + 칸 사이 gap — 줄 전체 Range 는 space-between 이면 줄 끝까지 재져 늘 넘친 것으로 보여서 */
function contentWidth(line: HTMLElement): number {
  const range = document.createRange();
  let w = 0;
  let n = 0;
  line.childNodes.forEach((c) => {
    if (c.nodeType === Node.TEXT_NODE && !c.textContent?.trim()) return;
    range.selectNode(c);
    const rw = range.getBoundingClientRect().width;
    w += c instanceof HTMLElement ? Math.max(rw, c.scrollWidth) : rw;
    n += 1;
  });
  const gap = parseFloat(getComputedStyle(line).columnGap) || 0;
  return w + Math.max(0, n - 1) * gap;
}

/** 상자가 커질 수 있는 안쪽 폭 — game.css .pg-banner max-width (100% − 16px) · .pg-hero-tall 은 --pg-banner-max */
function roomOf(box: HTMLElement): number {
  const cs = getComputedStyle(box);
  const edge = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
  const tall = box.closest('.pg-hero-tall') ? parseFloat(cs.getPropertyValue('--pg-banner-max')) : NaN;
  const parent = box.offsetParent instanceof HTMLElement ? box.offsetParent.clientWidth : window.innerWidth;
  return (tall > 0 ? tall : parent - 16) - edge;
}

function over(box: HTMLElement, lines?: string): boolean {
  const room = roomOf(box);
  if (room <= 0) return false;
  return Array.from(lines ? box.querySelectorAll<HTMLElement>(lines) : box.children).some((line) => line instanceof HTMLElement && line.clientWidth > 0 && contentWidth(line) * ROOM > room + 0.02);
}

/** lines = 잴 줄 (CSS 선택자 — 없으면 상자의 자식 모두 · 일부러 줄여 보이는 줄 (줄임 글) 은 빼고 잼) */
export function useFit(box: { current: HTMLElement | null }, max: number, lines?: string): number {
  const [step, setStep] = useState(0);
  const [size, setSize] = useState(() => `${window.innerWidth}x${window.innerHeight}`);
  const check = () => {
    const el = box.current;
    if (el && over(el, lines)) setStep((s) => Math.min(max, s + 1));
  };
  useLayoutEffect(() => {
    if (step < max) check();
  });
  useEffect(() => {
    const onResize = () => {
      setSize(`${window.innerWidth}x${window.innerHeight}`);
      setStep(0);
    };
    window.addEventListener('resize', onResize);
    // 400ms · 글꼴이 오면 0 단계부터 다시 (처음 잼이 늦은 글꼴로 줄어든 채 남아 300 에서 실행마다 모양이 다르던 것 — 픽셀 검사원 #27)
    const again = () => setStep(0);
    const t = window.setTimeout(again, 400);
    void document.fonts?.ready.then(again);
    return () => {
      window.removeEventListener('resize', onResize);
      window.clearTimeout(t);
    };
  }, [size]);
  return step;
}
