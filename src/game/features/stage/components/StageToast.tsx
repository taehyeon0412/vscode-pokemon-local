/**
 * 길 위 알림 (주운 것 · 회복 · 클리어 보너스) — 주인공 머리 위 가운데. 긴 알림이 패널 왼쪽 · 오른쪽 끝 밖으로 나가지 않게 실제 폭을 재서 8px 안쪽으로 당김.
 * 자리 (room — 대기실 바닥 줄 주인공 ~ 관장 사이) 에 한 줄로 들어가면 그 자리 · 아니면 패널 폭 안 한 줄 · 그래도 길면 줄 바꿈 (줄임표 금지 — ux-rules U4).
 * 자리는 정수 px (폭 올림 · 왼쪽 반올림, translateX 없음) — 1px 테두리가 반 픽셀에 걸려 흐리던 것 (픽셀 검사원 2026-10-21).
 * (2026-10-20 — 체육관 대기실 "1-3 클리어! 보너스 경험치 +130 · ◓+1 · …" 이 480px 까지 왼쪽이 잘리던 것, 예전엔 가운데가 최소 80px 라 넘침).
 */
import { Fragment } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { KeyCap } from '../../../ui/KeyCap';

const EDGE = 8;
/** 오늘의 목표 알림 (엔진 play.ts "오늘의 목표 ✓ …" · "오늘의 목표 다 했어요!") — 끝에 어디서 보는지 "· [M] 지도" (모두에게 켰는데 목표가 생긴 걸 알 곳이 없던 것 — 개발 UX #59) */
const DAILY_TOAST = '오늘의 목표';

export function StageToast({ text, center, bottom, room, avoid }: { text: string; center: number; bottom: number; room?: number; /** 덮으면 안 되는 상자 (선택자) — 줄이 늘어 그 상자에 닿으면 아래로 내림 */ avoid?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [, setRetry] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el?.parentElement) return;
    const widthPx = el.parentElement.clientWidth;
    // 아직 무대 폭이 안 잡혔으면 (글꼴을 기다리며 #pokemon-game 이 숨은 동안) 다음 장면에 다시 잼 — 가운데가 0 이 되어 왼쪽 반이 잘리던 것
    if (!widthPx) {
      const id = requestAnimationFrame(() => setRetry((n) => n + 1));
      return () => cancelAnimationFrame(id);
    }
    // 한 줄 폭을 잼 → 들어갈 폭을 정함 → 그 폭으로 다시 잼 (줄 바꿈이면 더 좁아짐)
    const full = widthPx - 2 * EDGE;
    el.style.width = 'max-content';
    el.style.maxWidth = 'none';
    el.style.whiteSpace = 'nowrap';
    const oneLine = el.getBoundingClientRect().width;
    el.style.whiteSpace = '';
    el.style.maxWidth = `${room !== undefined && oneLine <= room ? Math.floor(room) : full}px`;
    const w = Math.ceil(el.getBoundingClientRect().width);
    el.style.width = `${w}px`;
    el.style.left = `${Math.round(Math.min(widthPx - EDGE - w, Math.max(EDGE, center - w / 2)))}px`;
    el.style.transform = 'none';
    // 피할 상자 (클리어 카드 · 대기실 상자) 에 닿으면 그 아래 4px 부터 — 좁은 패널에서 세 줄 알림이 카드 버튼 줄을 덮던 것 (기획 · UX). 주인공 위에 잠깐 겹치는 쪽이 버튼을 가리는 것보다 나음
    el.style.bottom = `${bottom}px`;
    const box = avoid ? el.parentElement.querySelector<HTMLElement>(avoid) : null;
    if (box) {
      const parent = el.parentElement.getBoundingClientRect();
      const minTop = Math.ceil(box.getBoundingClientRect().bottom - parent.top) + 4;
      const h = Math.ceil(el.getBoundingClientRect().height);
      if (parent.height - bottom - h < minTop) el.style.bottom = `${Math.max(0, Math.floor(parent.height - minTop - h))}px`;
    }
    return undefined;
  });
  return (
    <div ref={ref} class="pg-toast" style={{ left: `${Math.round(center)}px`, bottom: `${bottom}px` }}>
      {/* "리자몽 Lv 36!" · "외 4마리" 가 줄 끝에서 "리자몽 / Lv 36!" · "외 / 4마리" 로 갈라지지 않게 (한 덩어리) · "\n" = 줄 바꿈 (지금은 만드는 곳 없음 — #156 되돌림 d8eb3a6, 긴 알림을 나눌 때 쓰게 남김) */}
      {text.split('\n').map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {line.replace(/(\S+) Lv (\d)/g, '$1\u00a0Lv\u00a0$2').replace(/외 (\d)/g, '외\u00a0$1')}
        </Fragment>
      ))}
      {text.startsWith(DAILY_TOAST) && (
        <span class="pg-nw">
          {' · '}
          <KeyCap k="M" /> 지도
        </span>
      )}
    </div>
  );
}
