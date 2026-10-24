/**
 * 3:3 필살기 · 합동 장면 전환 (orders #99 시안 — 태현 님 "연출이 심각하게 별론데" → 기획 #138 "추천대로"):
 * 필살기가 나가면 3:3 무대가 잠깐 1:1 처럼 바뀌고 이미 만든 1:1 필살기 연출을 그대로 크게 돌린 뒤 3:3 으로 돌아옴.
 * 단계는 연출 쪽 (fx/team TeamFxRunner) 이 정함 — 1:1 필살기 길이는 연출이 정하고 그동안 엔진 시계는 붙잡혀 멈춰서 엔진 ms 로는 못 셈.
 * 화면 (team/TeamLayer — 디자인) 은 이 상태만 보고 그림: in (나머지 칸 · HP 판 숨김 · 쏘는 쪽 · 맞는 쪽이 1:1 자리로) → cut (합동만 — 큰 컷인)
 * → show (1:1 필살기 연출 그대로) → out (3:3 자리로 · HP 판 다시, 줄어듦은 그때).
 */
import type { Side } from '../../../core/engine';

export type TeamViewPhase = 'in' | 'cut' | 'show' | 'out';

export interface TeamView {
  kind: 'solo' | 'joint';
  /** 쏘는 쪽 */
  side: Side;
  /** 쏘는 칸 — 합동은 앞장 먼저 */
  from: number[];
  /** 맞는 칸 */
  to: { side: Side; slot: number };
  phase: TeamViewPhase;
  /** 그 단계 시작 (performance.now) */
  at: number;
  /** 같은 판에서 다시 나온 필살기 · 같은 짝 합동 — 맞고 1.5초 뒤 끊고 나옴 · 큰 컷인도 짧게 (#140 A) */
  quick?: boolean;
}

/** 단계 길이 (ms) — show 는 연출 길이 (혼자 약 4 ~ 9초) [임시값] */
// cutMs 1200 → 1400 — 합동 컷인 머리말 ("합동 필살기!" · "합동!") 이 0.82 ~ 0.92초만 보이던 것 (U1 1초 — #96 UX 작음 5 · 디자인)
export const TEAM_VIEW = { inMs: 350, cutMs: 1400, outMs: 350, cutQuickMs: 600, repeatTailMs: 1500 } as const;

let view: TeamView | null = null;
const subs = new Set<(v: TeamView | null) => void>();

export function getTeamView(): TeamView | null {
  return view;
}

/** 단계를 바꾸고 화면에 알림 (붙잡힌 동안 전투 상태가 안 바뀌어 화면이 다시 안 그려지니 이걸로) */
export function setTeamView(v: TeamView | null): void {
  view = v;
  subs.forEach((cb) => {
    try {
      cb(v);
    } catch (err) {
      console.warn('[pokemon-game] 3:3 장면 전환 알림', err);
    }
  });
}

/** 단계가 바뀔 때마다 부름 · 돌려준 함수로 끊음 */
export function subscribeTeamView(cb: (v: TeamView | null) => void): () => void {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}
