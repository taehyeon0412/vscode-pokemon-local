/**
 * 머리 위 작은 글 (버린 필살기 누름 — "아직 안 찼어요" · "지금은 못 써요" · 금 "지금!", 태현 님 2026-10-26 "엄청 작은 글씨로 포켓몬 위쪽에 · 머리 기준 왼쪽 위에 문구가 뜨고 서서히 사라짐").
 * 피해 숫자처럼 판 없는 게임 안 글 — 11px 700 (design-system 가장 작은 단계) + 네 방향 1px 남색 외곽선 (team .pg-team-pop 과 같은 테) ·
 * 진짜 시계로 다 보이는 때 1.1초 (U1 — 엔진 도장은 게임 시계라 ▶▶ 에서 0.6초) 뒤 투명도 3단계로 사라짐 (픽셀 박자 · 깜빡임 없음) ·
 * 자리 = 머리 왼쪽 위 → 머리 오른쪽 위 → 머리 위 → 몸 왼쪽 → 몸 오른쪽 → 발밑 (패널 끝 · 정보줄에 걸리면 안쪽으로 · 이름표 · HP · 판 · 다른 포켓몬을 피함) — 처음 정한 자리를 끝까지 (U2)
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { realLater, realNow } from './real-clock';
import { Sprite } from './Sprite';

export type Rect = { l: number; t: number; r: number; b: number };

/** 다 보이는 때 · 사라지는 한 걸음 · 걸음 수 (진짜 ms) */
export const HEAD_HOLD_MS = 1100;
export const HEAD_FADE_STEP_MS = 120;
export const HEAD_FADE_STEPS = 3;
/** 글 높이 (11px · 줄 13) */
export const HEAD_NOTE_H = 13;

const hits = (a: Rect, c: Rect) => a.l < c.r && a.r > c.l && a.t < c.b && a.b > c.t;

let measureCtx: CanvasRenderingContext2D | null | undefined;
/** 글 폭 — 캔버스로 잰 실제 폭 + 외곽선 2 (자리 고를 때만). 맥 여유 10% 는 안 곱함 — 캔버스가 그 컴퓨터 글꼴로 재고, 글은 왼쪽 끝이 고정이라 넓어지면 오른쪽 (머리 쪽) 으로 늘어남
 *  (× 1.1 로 71px 로 잡아 1:1 480 × 187 머리 왼쪽 위가 "A 자동" 칩과 겹치는 걸로 계산돼 오른쪽 위로 가던 것 — 기획 10-26) */
export function headNoteWidth(text: string, keyCap = false): number {
  if (measureCtx === undefined) measureCtx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  let w = text.length * 11;
  if (measureCtx) {
    measureCtx.font = '700 11px Pretendard, sans-serif';
    w = measureCtx.measureText(text).width;
  }
  return Math.ceil(w) + 2 + (keyCap ? 14 : 0);
}

/**
 * 자리 고르기 — a = 보이는 그림 상자 · w × h = 글 · bounds = 둘 수 있는 곳 (위 = 정보줄 · 지도 줄 아래) · avoid = 피할 상자 (이름표 · HP · 판 · 다른 포켓몬).
 * 자기 그림은 모서리 6px 까지만 걸쳐도 됨 (머리 왼쪽 위에 붙여 "이 포켓몬 말" 로 읽히게). 다 막히면 첫 자리 (안쪽으로 당김)
 */
export function pickHeadSpot(a: Rect, w: number, h: number, bounds: Rect, avoid: readonly Rect[], opts: { /** 3:3 — 머리 왼쪽 위만 (막히면 16px 까지 올리고 그래도 막히면 그 자리 · 글이 포켓몬을 따라감 — 기획 10-26 "누른 칸 포켓몬 머리 왼쪽 위를 따라가게") */ team?: boolean } = {}): { l: number; t: number } {
  const cx = (a.l + a.r) / 2;
  // 태현 님 "포켓몬 머리 기준 왼쪽 위" (기획 10-26 — 1:1 이 오른쪽 위로 가던 것): 머리 왼쪽 위 (머리 모서리 6px 걸침) → 막히면 글 오른쪽 끝 = 머리 왼쪽 끝 · 둘 다 24px 까지 올려 봄 →
  //   그래도 막히면 (1:1 — 트레이너 · 자동 칩 · HP 묶음) 오른쪽 위 → 머리 위 → 몸 왼쪽 → 몸 오른쪽 → 발밑 (1:1 240 × 150 은 다 막혀 발밑)
  type Cand = { at: [number, number]; lift: number };
  const left: Cand[] = [
    { at: [a.l - w + 6, a.t - h - 1], lift: opts.team ? 16 : 24 },
    ...(opts.team ? [] : [{ at: [a.l - w, a.t - h - 1] as [number, number], lift: 24 }]),
  ];
  const rest: Cand[] = opts.team
    ? []
    : [
        { at: [a.r - 6, a.t - h - 1], lift: 16 },
        { at: [cx - w / 2, a.t - h - 1], lift: 16 },
        { at: [a.l - w - 2, a.t + 2], lift: 0 },
        { at: [a.r + 2, a.t + 2], lift: 0 },
        { at: [cx - w / 2, a.b + 1], lift: 0 },
      ];
  const cands = [...left, ...rest];
  const body = { l: a.l + 6, t: a.t + 6, r: a.r - 6, b: a.b - 6 };
  // 패널 끝 4px (2 면 첫 획이 끝에서 1 ~ 2px — 아트 디렉터 #97)
  const fit = ([l, t]: [number, number]) => ({
    l: Math.round(Math.max(bounds.l + 4, Math.min(bounds.r - 4 - w, l))),
    t: Math.round(Math.max(bounds.t, Math.min(bounds.b - 2 - h, t))),
  });
  const free = (p: { l: number; t: number }) => {
    const r = { l: p.l, t: p.t, r: p.l + w, b: p.t + h };
    return !hits(r, body) && !avoid.some((o) => hits(r, { l: o.l - 1, t: o.t - 1, r: o.r + 1, b: o.b + 1 }));
  };
  for (const c of cands) {
    const p = fit(c.at);
    for (let dy = 0; dy <= c.lift; dy += 2) {
      const q = { l: p.l, t: Math.max(Math.round(bounds.t), p.t - dy) };
      if (free(q)) return q;
    }
  }
  return fit(cands[0]!.at);
}

/** 그림이 움직인 만큼 (달려가기 · 돌아오기 — transform) = 그린 자리 − 놓인 자리 (offsetLeft · offsetTop 은 transform 을 안 셈) · stop = 글의 offsetParent */
export function drawnShift(node: HTMLElement, stop: HTMLElement): { dx: number; dy: number } {
  let x = 0;
  let y = 0;
  let n: HTMLElement | null = node;
  while (n && n !== stop) {
    x += n.offsetLeft;
    y += n.offsetTop;
    n = n.offsetParent instanceof HTMLElement ? n.offsetParent : null;
  }
  if (n !== stop) return { dx: 0, dy: 0 };
  const r = node.getBoundingClientRect();
  const s = stop.getBoundingClientRect();
  return { dx: Math.round(r.left - s.left - stop.clientLeft - x), dy: Math.round(r.top - s.top - stop.clientTop - y) };
}

/**
 * 붙잡기 — key 가 나타나거나 바뀌면 그때부터 진짜 시계로 HEAD_HOLD_MS 다 보이고 (엔진 도장이 더 길면 그동안도) 3걸음으로 사라짐.
 * cancel = 바로 지움 (필살기가 나감 — 나가는데 "아직 안 찼어요" 가 남지 않게). 돌려줌: 붙잡은 값 · 사라짐 걸음 (0 = 다 보임)
 */
export function useHeldNote<T>(key: string | null, value: T | null, cancel = false): { key: string; value: T; step: number } | null {
  // on = 엔진 도장이 아직 있음 (그동안은 다 보임) · last = 도장이 사라진 걸 본 때 (그때부터 남은 붙잡기 · 사라짐)
  const cur = useRef<{ key: string; value: T; at: number; last: number; on: boolean } | null>(null);
  const [, kick] = useState(0);
  const now = realNow();
  if (cancel) cur.current = null;
  else if (key !== null && value !== null) {
    if (!cur.current || cur.current.key !== key) cur.current = { key, value, at: now, last: now, on: true };
    else cur.current = { ...cur.current, value, last: now, on: true };
  } else if (cur.current?.on) cur.current = { ...cur.current, last: now, on: false };
  const c = cur.current;
  const fadeAt = !c ? 0 : c.on ? Number.POSITIVE_INFINITY : Math.max(c.at + HEAD_HOLD_MS, c.last);
  const step = c && now >= fadeAt ? Math.floor((now - fadeAt) / HEAD_FADE_STEP_MS) + 1 : 0;
  if (c && step > HEAD_FADE_STEPS) cur.current = null;
  const live = cur.current;
  // 도장이 사라진 뒤에만 스스로 깨움 (다음 걸음 — 엔진 그림은 열쇠가 바뀔 때만 다시 그려짐) · 도장이 있는 동안은 엔진이 다시 그림
  const wake = live && !live.on ? fadeAt + step * HEAD_FADE_STEP_MS - now : -1;
  useEffect(() => (wake >= 0 ? realLater(() => kick((n) => n + 1), Math.max(16, Math.ceil(wake) + 5)) : undefined), [live?.key, live?.on, step]);
  return live ? { key: live.key, value: live.value, step: Math.min(step, HEAD_FADE_STEPS) } : null;
}

/** 머리 위 글 하나 — 자리 (l, t) 는 부른 쪽이 정함 (정수 px) · follow = 따라갈 그림 (달려가면 그 자리 · 돌아오면 같이 — 글이 떠 있는 동안만 매 장면 잼) */
export function HeadNote({ text, go, keyCap, at, step, fixed = false, follow, followFrom = 'zero', face }: { text: string; go: boolean; keyCap?: string | null; at: { l: number; t: number }; step: number; /** 고정 자리 (장면 전환 중) — 연출 · 컷인 위 */ fixed?: boolean; /** 얼굴 창 24 × 20 (고정 자리 — 누른 포켓몬이 무대에 없을 때) */ face?: { media: string; form: string }; follow?: () => HTMLElement | null; /** zero = 자리를 놓인 자리 (transform 0) 로 정함 (3:3) · start = 그린 자리로 정함 — 놓은 순간부터 움직인 만큼만 (1:1 — 그림 칸에 가운데 맞춤 transform 이 늘 있음) */ followFrom?: 'zero' | 'start' }) {
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!follow) return undefined;
    let id = 0;
    let base: { dx: number; dy: number } | null = followFrom === 'zero' ? { dx: 0, dy: 0 } : null;
    const tick = () => {
      const me = el.current;
      const node = follow();
      const stop = me?.offsetParent;
      if (me && node && stop instanceof HTMLElement) {
        const d = drawnShift(node, stop);
        base ??= d;
        // 패널 끝 4px 안 (뒤로 밀려 날 때 글이 패널 왼쪽 밖으로 나가던 것)
        const dx = Math.max(4 - at.l, Math.min(stop.clientWidth - 4 - me.offsetWidth - at.l, d.dx - base.dx));
        const dy = d.dy - base.dy;
        const tr = dx || dy ? `translate(${dx}px, ${dy}px)` : '';
        if (me.style.transform !== tr) me.style.transform = tr;
      }
      id = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(id);
  }, [follow ? 1 : 0, at.l, at.t]);
  return (
    <span ref={el} class={`pg-head-note${go ? ' pg-head-go' : ''}${fixed ? ' pg-head-fixed' : ''}${step ? ` pg-head-fade${step}` : ''}`} style={{ left: `${at.l}px`, top: `${at.t}px` }}>
      {face && (
        <span class="pg-band-face pg-head-face">
          <Sprite media={face.media} form={face.form} scale={1} px={32} crop={20} cropWidth={24} center action="walk" />
        </span>
      )}
      {keyCap && <span class="pg-head-key">{keyCap}</span>}
      {text}
    </span>
  );
}
