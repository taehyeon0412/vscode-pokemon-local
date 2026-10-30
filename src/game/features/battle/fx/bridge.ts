/**
 * 일반 모드 연출 다리 (ult/bridge.js 가 main-bundle.js 안에서 내놓는 window.pokemonFx) — 2026-10-19 태현 님 "일반 모드처럼 자연스럽고 멋지게".
 * 일반 모드 번들이 없으면 (미리보기 · 테스트 · 옛 번들) null → 전투는 예전 모양 (이모지) 그대로.
 */

/**
 * 1:1 힘대결 연출 박자 (ms) — ult/core.js ULT_VS_MS (VS 컷인) · ult/duel.js DUEL_SEC (밀고 밀리기) · DUEL_THROUGH (이긴 쪽이 뚫고 나감) · DUEL_AFTER (터진 뒤 여운) 와 같은 값.
 * 1:1 전투 (BattleFx) · 3:3 힘겨루기 장면 (fx/team · team/model) 이 함께 씀 — JS 쪽을 바꾸면 fx/duel-timing.test 가 알려 줌 (같은 값이 세 곳에 따로 있던 것, 코드 리뷰어 #116)
 */
export const FX_DUEL_MS = { vs: 1500, push: 3600, through: 400, after: 1500 } as const;

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

/** 맞는 순간 타입 임팩트 옵션 (ult/fx-hit.js typeImpact) — pick = 짜임 (기술 칸 순서) · scale = 크기 배 (상성 · 막음) · light = 닿는 기술 (작게) · basic = 1 공격 · none = 효과 없음 (연기만) */
export interface FxImpact {
  pick?: number;
  scale?: number;
  light?: boolean;
  basic?: boolean;
  none?: boolean;
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
  /** 필살기 대결 — 피할 필살기 이름 (그 포켓몬이 배운 기술) */
  aAvoid?: string[];
  bAvoid?: string[];
  /** 필살기 대결 — 엔진이 정한 앞장 필살기 이름 (첫 컷인 · 합동 컷인과 같게 — #86) */
  aName?: string;
  bName?: string;
  /** 앞장 뒤에 선 같은 편 그림 (3:3 힘겨루기 장면) — 진 쪽이 밀려날 때 그 앞에서 멈춤 (#116) */
  behind?: (side: 'a' | 'b') => FxActor[];
}

export interface PokemonFx {
  version: number;
  plan(form: string, m: FxMove): FxPlan | null;
  /** reach = 입에서 상대까지 px (dst 가 없을 때 뿜기만) · form = 기술 모양을 고를 포켓몬 (없으면 src — 닿는 기술 자국은 쓰는 쪽 모양) · dst = 맞는 포켓몬 (틀마다 상대까지 닿게) */
  move(src: FxActor, m: FxMove, reach?: number, form?: string, dst?: FxActor, tag?: number): number;
  /** 3:3 (2026-10-21) — tag 로 쏜 기술 하나만 멈춤 (soft = 남은 입자가 0.12초에 사라짐 · 걸어 둔 타이머 · 발사기는 바로) */
  stopMove?(tag: number, soft?: boolean): void;
  /** 3:3 모드 — 켜면 기술은 패널 번쩍 · 흔들기 · 전체 멈춤 없이 (필살기만 번쩍, 1초 3번 이하) */
  team?(on: boolean): void;
  cast(src: FxActor, fx: string, o?: Record<string, unknown>): number;
  /** name = 기술 이름 — 같은 타입이라도 기술마다 다른 짜임 (ult/fx-hit.js, 2026-10-19) · o = 크기 · 짜임 (FxImpact) */
  impact(dst: FxActor, type: string, big?: boolean, name?: string, o?: FxImpact): void;
  /** 빗나감 — 맞을 쪽이 등 뒤로 휙 피함 (2026-10-20) */
  dodge?(dst: FxActor): void;
  /** 히트스톱 — 연출 입자 · 전투 그림 몸짓이 ms 동안 멈춤 */
  hitStop?(ms?: number, all?: boolean): void;
  /** 상태 이상이 걸린 순간 (독 · 화상 · 마비 · 잠 · 나음) */
  status?(dst: FxActor, kind: 'poison' | 'burn' | 'paralysis' | 'sleep' | 'cure'): void;
  /** 쓰러뜨린 한 방 — 금색 별빛 */
  ko?(dst: FxActor): void;
  /** 완벽 패링 쳐내기 — kind = 연출 틀 (fx.plan().fx), 쏘는 것은 위로 쳐내고 나머지는 피함 (2026-10-20) */
  swat?(dst: FxActor, src: FxActor | null, type: string, kind: string, quick?: boolean): void;
  /** 패링 글 — tone gold (완벽 패링! · 반격!) · silver (패링!) · opt.sec = 보이는 길이 (초) · opt.other = 맞은편 포켓몬 (글씨가 두 포켓몬 사이 dst 쪽 반 안에) · opt.away = 맞은편 반대쪽 (바깥) 에 */
  word?(dst: FxActor, text: string, tone: 'gold' | 'silver', opt?: { sec?: number; other?: FxActor | null; away?: boolean }): void;
  /** 반격 기회 — 상대만 밝고 둘레가 살짝 어두워짐 (ms 동안) */
  riposteFocus?(dst: FxActor, ms: number): void;
  /** 닿는 기술을 패링 — 쳐내는 몸짓으로 상대를 튕겨 냄 (dst = 막은 쪽 · src = 친 쪽, perfect = 금색 · 크게) */
  contactParry?(dst: FxActor, src: FxActor | null, perfect: boolean): void;
  /** 필살기 게이지가 다 참 — 몸 둘레 금색 반짝임 세 번 */
  ultReady?(dst: FxActor): void;
  /** 보이는 몸 위 끝 (화면 px — 그림 모양) · 모르면 null */
  shapeTop?(a: FxActor): number | null;
  /** S22 진화 — stage 안 옛 · 새 그림을 숨기고 캔버스로 메가진화처럼 (ms 동안) */
  evolve?(stage: HTMLElement, ms: number): void;
  /** 패링 되튀기 — 막은 쪽 (dst) 에서 친 쪽 (src) 으로 불똥 · 완벽 = 금색 초승달 + 히트스톱 */
  deflect?(dst: FxActor, src: FxActor, perfect: boolean): void;
  /** 필살기 (version 2) — 걸리는 시간 (ms), 못 쓰면 0 */
  /** onHit = 상대를 처음 맞힌 순간 (그때 피해를 넣음) */
  /** o.quick = 같은 전투에서 다시 보는 필살기 — 컷인 없이 짧게 (2026-10-20) */
  /** o.others = 나머지 맞을 상대 (3:3 — 자기 둘레 필살기의 기운 줄기가 모두에게) · o.type = 쓴 포켓몬 타입 (기운이 닿을 때 임팩트) */
  ult?(src: FxActor, dst: FxActor, onHit?: () => void, avoid?: string[], o?: { quick?: boolean; sub?: string; others?: FxActor[]; type?: string; pick?: string; stage?: boolean; hitMs?: number; noIntro?: boolean; /** 3:3 장면 전환 상대 필살기 — 큰 이름 상대 색 */ titleFoe?: boolean; timing?: (t: { main: number; cover: number; total: number; still?: number }) => void }): number;
  /** 그 모습이 가진 필살기 이름 (개발 모드 (임시) — 필살기 고르기) */
  ults?(form: string): string[];
  /** 3:3 합동 필살기 마무리 — 참가자 필살기가 같은 때 닿아 한 점에서 합쳐 터짐. onHit = 합쳐진 순간 · 걸리는 시간 (ms), 못 쓰면 0 */
  ultJoint?(srcs: FxActor[], dst: FxActor, onHit?: () => void, o?: { types?: string[]; avoid?: string[][]; pick?: (string | null)[]; sure?: boolean; sub?: string; others?: FxActor[]; tailMs?: number; quick?: boolean }): number;
  /** 3:3 장면 전환 합동 (#99) — 앞장 1:1 필살기 하나 (컷인 없이) + 동료 기운이 기 모으는 동안 앞장 입으로 + 맞을 때 동료 색 고리 · 걸리는 시간 (ms) */
  team11Joint?(srcs: FxActor[], dst: FxActor, onHit?: () => void, o?: { types?: string[]; avoid?: string[][]; pick?: (string | null)[]; timing?: (t: { main: number; cover: number; total: number; still?: number }) => void }): number;
  stopUlt?(): void;
  /** 남은 필살기 연출을 ms 동안 흐리게 한 뒤 끔 (반격기 — 맞힌 뒤 줄기가 메뉴 위로 남지 않게) */
  fadeUlt?(ms: number, steps?: number): void;
  /** 힘대결 (version 3) — a = 나, b = 상대 · live() = 내가 이길 확률 · { meetMs } 또는 null */
  duel?(a: FxActor, b: FxActor, spec: FxDuel, live: () => number): { meetMs: number } | null;
  /** 1:1 힘겨루기 연출을 쓸 수 있는지 (두 그림 모양 · 폭) — 3:3 힘겨루기 장면을 열기 전에 물음 (#116 — 열고 나서 못 쓰면 연출 없이 지나감, bugs 1851) */
  duelReady?(a: FxActor, b: FxActor): boolean;
  /** 1:1 힘겨루기에 동료 합류 (#116 3:3 힘겨루기 장면) — 쪽 (a = 왼쪽 · b) · 동료 타입 (섞임 · 굵기 모양은 연출이 그림) */
  duelJoin?(side: 'a' | 'b', type: string, who?: FxActor): void;
  duelWin?(who: 'a' | 'b'): void;
  /** 3:3 용 판 (orders #95) — 합동 한 장면 · 필살기 힘겨루기 (ult/fx-team33.js) */
  teamJoint?(srcs: FxActor[], dst: FxActor, onHit?: () => void, o?: { types?: string[]; quick?: boolean; hitMs?: number; others?: FxActor[]; near?: FxActor[] }): number;
  teamDuel?(a: FxActor, b: FxActor, spec: { typeA: string; typeB: string; leadMs?: number; clashMs?: number; /** 끊긴 필살기를 쓰던 쪽 — 맞부딪힘 자리 */ by?: 'me' | 'foe' }, live: () => number): { meetMs: number } | null;
  teamDuelJoin?(side: 'a' | 'b', type?: string): void;
  teamDuelWin?(who: 'a' | 'b'): void;
  /** soft = 터지는 여운까지 그리고 정리 */
  stopDuel?(soft?: boolean): void;
  /** 연출 캔버스를 둘 곳 (version 4) — 전투 판의 연출 층, null 이면 맨 위 */
  mount?(el: HTMLElement | null): void;
  clear(): void;
}

export function pokemonFx(): PokemonFx | null {
  const fx = (globalThis as { pokemonFx?: Partial<PokemonFx> }).pokemonFx;
  return fx && typeof fx.move === 'function' && typeof fx.plan === 'function' && (fx.version ?? 0) >= 1 ? (fx as PokemonFx) : null;
}
