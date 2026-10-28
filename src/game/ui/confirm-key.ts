/**
 * Enter 자리에서 Space 도 (#117 — 2026-10-28 태현 님 "문구는 enter라고 해놔도 스페이스를 눌러도 작동 되게 해줘") — 글은 "Enter" 그대로.
 * Space 가 이미 뜻이 있는 곳 (막기 · 패링 · 힘대결 연타 · VS 넘기기 · 진화 보기 · 넘기기 · 3:3 · 전투 메뉴) 은 부르는 쪽이 이걸 안 씀.
 * Enter 처럼 받는 Space 는
 *   ① 연타 묶음의 첫 누름만 — 앞 Space 와 0.4초 안이면 같은 묶음 (힘대결 · 패링 연타가 이어져 결과 · 다음 상자를 바로 누르지 않게. 사람 연타는 0.08 ~ 0.25초 간격)
 *   ② 그 상자가 1초 넘게 보인 뒤 (U1 — 중요한 순간 1초: 체육관 들어가기를 Space 로 넘긴 뒤 한 번 더가 대기실 첫 알림을 덮고 바로 도전 · 진화했다! 를 바로 넘기던 것, 코드 리뷰어)
 * 시각은 누른 때 (e.timeStamp — 처리가 늦어도 간격이 안 늘고, 게임 시계 ▶▶ 가 바꿔 끼우는 performance.now 와 상관없음)
 */
import { useRef } from 'preact/hooks';
import { TIMING } from '../core/balance';
import type { StageRuntime } from '../core/engine';
import { realNow } from './real-clock';

export const SPACE_RUN_GAP_MS = 400;
export const SPACE_BOX_MIN_MS = 1000;

let lastAt = -Infinity;
let fresh = false;
/** 마우스로 누른 버튼 — 포커스가 남아도 키보드 포커스로 치지 않음 */
let pointerButton: unknown = null;

/** Space 누름을 적음 — 꾹 누름 (repeat) 은 묶음을 잇기만 */
export function noteSpace(repeat: boolean, at: number): void {
  fresh = !repeat && at - lastAt > SPACE_RUN_GAP_MS;
  lastAt = at;
}

/** 창 capture 로 가장 먼저 듣기 — 상자 · 메뉴 (bubble) 가 같은 누름을 볼 때 이미 적혀 있게 (main.ts 가 다른 키 듣기보다 먼저 부름) */
export function watchKeys(win: Window): void {
  win.addEventListener('keydown', (e) => {
    if (e.code === 'Space') noteSpace(e.repeat, e.timeStamp);
    // Tab = 키보드로 버튼을 옮겨 다님 — 그 뒤 포커스는 키보드 것
    else if (e.key === 'Tab') pointerButton = null;
  }, true);
  win.addEventListener('pointerdown', (e) => {
    pointerButton = e.target instanceof Element ? e.target.closest('button') : null;
  }, true);
}

/** 키보드로 간 버튼에 포커스가 있음 → Enter · Space 는 그 버튼이 받음. 마우스로 누른 뒤 남은 포커스는 아님
 *  (누른 기술 버튼이 Space 로 또 눌려 빠지고 · 누른 자동 전투 칸이 부탁 상자에서 Space 로 말없이 바뀌던 것 — 코드 리뷰어 #117) */
export function onKeyboardButton(e: Event): boolean {
  return e.target instanceof HTMLButtonElement && e.target !== pointerButton;
}

/** Enter, 또는 Enter 처럼 받을 Space (꾹 누름 · 연타 묶음 둘째부터 · 상자가 뜬 지 1초 안은 아님). shownAt = 상자가 뜬 때 (useShownAt · realNow — e.timeStamp 와 같은 바탕) */
export function confirmKey(e: Pick<KeyboardEvent, 'key' | 'code' | 'repeat' | 'timeStamp'>, shownAt = -Infinity): boolean {
  if (e.key === 'Enter') return true;
  return e.code === 'Space' && !e.repeat && fresh && e.timeStamp - shownAt >= SPACE_BOX_MIN_MS;
}

/** 이 상자가 뜬 때 — key 가 바뀐 첫 그림 (진짜 시계) */
export function useShownAt(key: string): number {
  const r = useRef<{ key: string; at: number } | null>(null);
  if (!r.current || r.current.key !== key) r.current = { key, at: realNow() };
  return r.current.at;
}

/** 길 위 상자 중 Space 가 따로 뜻이 없어 Enter 처럼 받는 곳 (main.ts) — 결과 (S12 계속) 는 Space = 계속 이던 것에 거름만 더함.
 *  나머지 (전투 · 3:3 · 트레이너 · 라이벌 만남 · 진화 · 체육관 들어가기 · 걷기) 는 Space 가 따로 뜻 → spaceInput 그대로 */
export const SPACE_AS_ENTER_PHASES: readonly StageRuntime['phase'][] = ['request', 'facility', 'result', 'lobby', 'defeat', 'clear', 'badge'];

export function spaceAsEnter(phase: StageRuntime['phase'] | undefined): boolean {
  return phase !== undefined && SPACE_AS_ENTER_PHASES.includes(phase);
}

/** main.ts 상자가 바뀌는 경계 — 바뀌면 "뜬 때" 를 다시 셈 (병원 앞 → 안 · 대기실 → 3마리 고르기 · 잡은 소개 카드 → 결과 상자) */
export function enterBoxKey(st: StageRuntime | null | undefined): string {
  if (!st || !spaceAsEnter(st.phase)) return '';
  switch (st.phase) {
    case 'facility':
      return `facility:${st.kind}:${st.at}:${st.inside ? 1 : 0}`;
    case 'request':
      return `request:${st.at}:${st.result ? 1 : 0}`;
    case 'lobby':
      return `lobby:${st.picking ? 1 : 0}`;
    case 'defeat':
      return `defeat:${st.keep ?? ''}`;
    case 'result':
      return `result:${st.summary.caught && st.ms < TIMING.caughtIntroMs ? 'intro' : 'box'}`;
    default:
      return st.phase;
  }
}
