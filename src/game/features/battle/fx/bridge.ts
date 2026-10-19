/**
 * 일반 모드 연출 다리 (ult/bridge.js 가 main-bundle.js 안에서 내놓는 window.pokemonFx) — 2026-10-19 태현 님 "일반 모드처럼 자연스럽고 멋지게".
 * 일반 모드 번들이 없으면 (미리보기 · 테스트 · 옛 번들) null → 전투는 예전 모양 (이모지) 그대로.
 */

/** 연출에 넘기는 포켓몬 — 그림 요소 · 위치를 읽을 요소 · 모습 id (= 일반 모드 label) · 원본 크기 · 왼쪽을 보는지 */
export interface FxActor {
  el: HTMLElement;
  box?: HTMLElement;
  form: string;
  size: number;
  left: boolean;
  name?: string;
}

/** 기술 이름 (한글) · 타입 — 일반 모드 기술 모음에서 찾고, 없으면 그 타입 기본 연출에 진짜 이름 (main-bundle.js gameMoveEntry) */
export interface FxMove {
  name: string;
  type: string;
}

export interface FxPlan {
  fx: string;
  ms: number;
  contact: boolean;
}

/** 힘대결 — 필살기끼리 (그 포켓몬 필살기) · 기술끼리 (그 기술 틀 · 타입 색) */
export interface FxDuel {
  kind: 'ult' | 'move';
  a: FxMove | null;
  b: FxMove | null;
}

export interface PokemonFx {
  version: number;
  plan(form: string, m: FxMove): FxPlan | null;
  /** reach = 입에서 상대까지 px (dst 가 없을 때 뿜기만) · form = 기술 모양을 고를 포켓몬 (없으면 src — 닿는 기술 자국은 쓰는 쪽 모양) · dst = 맞는 포켓몬 (틀마다 상대까지 닿게) */
  move(src: FxActor, m: FxMove, reach?: number, form?: string, dst?: FxActor): number;
  cast(src: FxActor, fx: string, o?: Record<string, unknown>): number;
  impact(dst: FxActor, type: string, big?: boolean): void;
  /** 필살기 (version 2) — 걸리는 시간 (ms), 못 쓰면 0 */
  ult?(src: FxActor, dst: FxActor): number;
  stopUlt?(): void;
  /** 힘대결 (version 3) — a = 나, b = 상대 · live() = 내가 이길 확률 · { meetMs } 또는 null */
  duel?(a: FxActor, b: FxActor, spec: FxDuel, live: () => number): { meetMs: number } | null;
  duelWin?(who: 'a' | 'b'): void;
  /** soft = 터지는 여운까지 그리고 정리 */
  stopDuel?(soft?: boolean): void;
  clear(): void;
}

export function pokemonFx(): PokemonFx | null {
  const fx = (globalThis as { pokemonFx?: Partial<PokemonFx> }).pokemonFx;
  return fx && typeof fx.move === 'function' && typeof fx.plan === 'function' && (fx.version ?? 0) >= 1 ? (fx as PokemonFx) : null;
}
