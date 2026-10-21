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
  /** S22 진화 — stage 안 옛 · 새 그림을 숨기고 캔버스로 메가진화처럼 (ms 동안) */
  evolve?(stage: HTMLElement, ms: number): void;
  /** 패링 되튀기 — 막은 쪽 (dst) 에서 친 쪽 (src) 으로 불똥 · 완벽 = 금색 초승달 + 히트스톱 */
  deflect?(dst: FxActor, src: FxActor, perfect: boolean): void;
  /** 필살기 (version 2) — 걸리는 시간 (ms), 못 쓰면 0 */
  /** onHit = 상대를 처음 맞힌 순간 (그때 피해를 넣음) */
  /** o.quick = 같은 전투에서 다시 보는 필살기 — 컷인 없이 짧게 (2026-10-20) */
  ult?(src: FxActor, dst: FxActor, onHit?: () => void, avoid?: string[], o?: { quick?: boolean; sub?: string }): number;
  stopUlt?(): void;
  /** 남은 필살기 연출을 ms 동안 흐리게 한 뒤 끔 (반격기 — 맞힌 뒤 줄기가 메뉴 위로 남지 않게) */
  fadeUlt?(ms: number): void;
  /** 힘대결 (version 3) — a = 나, b = 상대 · live() = 내가 이길 확률 · { meetMs } 또는 null */
  duel?(a: FxActor, b: FxActor, spec: FxDuel, live: () => number): { meetMs: number } | null;
  duelWin?(who: 'a' | 'b'): void;
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
