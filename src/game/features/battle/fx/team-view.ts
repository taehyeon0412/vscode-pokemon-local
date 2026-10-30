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
  /** duel = 필살기 힘겨루기 (#116 — 맞붙는 두 무리를 1:1 자리로 · 1:1 힘겨루기 연출 그대로) */
  kind: 'solo' | 'joint' | 'duel';
  /** 힘겨루기 두 무리 (앞장 먼저) — kind 'duel' 만 */
  duel?: { me: number[]; foe: number[] };
  /** 다른 장면 (상대 · 내 필살기) 이 열린 채 이어받음 — 나머지는 바로 숨기고 무리는 바둑판으로 새 자리에 (걸어가며 숨은 칸이 보이지 않게) */
  cont?: boolean;
  /** 장면 도중 무리에 든 칸 ("side-slot" — 힘겨루기 합류) — 걷지 않고 제 자리에 바둑판으로 나타남 */
  popIn?: string[];
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
  /** 힘겨루기 두 줄기가 맞닿는 때 (performance.now — VS 가 걷힌 뒤 · 밀기 시작) — kind 'duel' 의 show 만. 빠르게 ▶▶ 밀기 ×3 은 이때부터 (#138) */
  meetAt?: number;
  /** 힘겨루기 승패가 난 뒤 이긴 줄기가 다 뚫고 나가는 때 (performance.now — "이겼다!" 글 바로 앞) — 밀기 ×3 은 여기까지 (#138) */
  wonAt?: number;
}

/** 단계 길이 (ms) — show 는 연출 길이 (혼자 약 4 ~ 9초) [임시값] */
// cutMs 1200 → 1400 — 합동 컷인 머리말 ("합동 필살기!" · "합동!") 이 0.82 ~ 0.92초만 보이던 것 (U1 1초 — #96 UX 작음 5 · 디자인)
// cutQuickMs 600 → 1200 — 같은 짝 두 번째 합동 큰 컷인 머리말 · 이름이 0.55초만 보이던 것 (U1 "quick 포함 1초" — 판 도구 #98 7바퀴 · 디자인 제안 값)
export const TEAM_VIEW = { inMs: 350, cutMs: 1400, outMs: 350, cutQuickMs: 1200, repeatTailMs: 1500 } as const;
/**
 * 빠르게 ▶▶ 혼자 필살기 (상대 #136 A — ×3 · 내 것 #138 ① — ×2) 에서 기본 박자로 두는 구간 (show 시작부터 ms) — 큰 이름 (ult/core.js ultTitle) 이 기 모으기 0.8초 뒤 나와
 * 0.16초에 커지고 다 보이는 때 1초 넘게 (U1) + 0.14초 여유. 그 앞 (기 모으기) · 뒤 (본편) 는 빠르게
 */
export const ULT_TITLE_AT_MS = 800;
export const ULT_TITLE_KEEP_MS = 1300;
/**
 * 합동 이름 판 (team/TeamCutin JointNamePlate · game.css — show 시작부터 1.5초 · 같은 짝 두 번째 1.0초) 이 떠 있는 동안 — 빠르게 ▶▶ 합동 본편 ×2 에서도 기본 박자
 * (게임 시계로 세는 판이 ×2 에서 0.6초만 보이던 것 — #138 UX 큼 2 · U1 "보인 띠는 1.2초 넘게")
 */
export const JOINT_PLATE_MS = 1500;
export const JOINT_PLATE_QUICK_MS = 1000;

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
