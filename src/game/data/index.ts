/**
 * 게임 데이터 — PokeAPI 에서 받아 둔 JSON (scripts/fetch-pokeapi.mjs 가 만듦, generated/ 는 손으로 고치지 않음).
 * 가장 아래 층: 아무것도 가져오지 않음. 규칙(core) · 기능(features)이 이걸 읽음.
 * 포켓몬은 확장에 그림이 있는 종만 (576종). 기술은 게임에서 쓸 수 있는 것만 (거른 규칙은 스크립트의 classifyMove · EXCLUDED_MOVES).
 * 기준 게임 = 울트라썬 · 울트라문 (기술표 · 진화 · 기술 값). 돌려주는 값은 모두 읽기 전용 — 고치지 말고 새로 만들어 쓸 것.
 */
import evolutionsJson from './generated/evolutions.json';
import formsJson from './generated/forms.json';
import learnsetsJson from './generated/learnsets.json';
import metaJson from './generated/meta.json';
import movesJson from './generated/moves.json';
import moveFxJson from './generated/move-fx.json';
import signatureJson from './generated/signature.json';
import speciesJson from './generated/species.json';
import ultMovesJson from './generated/ult-moves.json';

export const TYPE_NAMES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
] as const;
export type TypeName = (typeof TYPE_NAMES)[number];

/** 원작 종족값 6개 (게임 스탯 5개로 바꾸는 것은 규칙 쪽 — mvp-spec 3.5) */
export interface BaseStats {
  hp: number;
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  speed: number;
}

export interface SpeciesData {
  name: { ko: string; en: string };
  types: TypeName[];
  base: BaseStats;
  /** 쓰러뜨렸을 때 경험치 계산에 쓰는 기본 경험치 */
  baseExp: number;
  /** 원작 포획률 (3 ~ 255) */
  captureRate: number;
  growthRate: string;
  legendary: boolean;
  mythical: boolean;
  /** 아기 포켓몬 (피츄 등) */
  baby: boolean;
  /** 원작의 진화 전 종 (확장에 그림이 없을 수도 있음) */
  evolvesFrom: number | null;
  chain: number;
  /** 게임 안 진화 단계 — 확장에 있고 아기가 아닌 진화 전 종만 셈 (진화 전 그림이 없으면 1) */
  stage: number;
}

export interface MoveData {
  id: number;
  key: string;
  name: { ko: string; en: string };
  type: TypeName;
  class: 'physical' | 'special' | 'status';
  /** 게임에서 쓰는 위력 (연속기는 평균 횟수를 곱함) — 변화 기술은 0 */
  power: number;
  /** 원작 한 번 위력 */
  basePower: number;
  hits: [number, number] | null;
  /** 명중률 (null = 반드시 맞음) */
  accuracy: number | null;
  pp: number;
  ailment: 'poison' | 'burn' | 'paralysis' | 'sleep' | null;
  /** 상태 이상을 걸 확률 (%) */
  ailmentChance: number;
  /** 흡수(+) · 반동(−) — 준 피해의 % */
  drain: number;
  critRate: number;
  /** 몸이 닿는 기술 — 맞받아치기(쏘는 기술끼리)는 닿지 않는 기술 중에서 (지진처럼 쏘지 않는 것은 단계 6에서 더 거름) */
  contact: boolean;
  /** 전투 규칙이 따로 처리할 부가 효과 (leave-1hp = 칼등치기: HP 1 을 남김) */
  effect?: 'leave-1hp';
  /** 원작의 모으기 · 반동으로 쉬는 기술 — 게임에서는 한 번에 쏨 (위력은 이미 × 0.7) */
  oneShot?: true;
  /** 연달아 쓸수록 세지는 기술 (구르기 · 연속자르기 · 분노 등) — 연달아 쓸 때마다 위력 +10% (core/rules/battle) */
  streak?: true;
  /** 원작 대상이 상대 모두 · 나 빼고 모두 (지진 · 파도타기 · 독가스 등) — 3:3 에서 상대 모두에게 (2026-10-21) */
  spread?: true;
}

/** 진화 하나 — 어떤 갈래를 어떻게 쓸지는 규칙 쪽 (단계 7, mvp-spec 3.6) */
export interface Evolution {
  to: number;
  kind: 'level' | 'item' | 'trade' | 'friendship' | 'other';
  level?: number;
  item?: string;
  time?: 'day' | 'night';
  /** 성별 갈래 (도롱충이 · 세꿀버리) — 게임에 성별이 없어 규칙 쪽에서 정함 */
  gender?: 'female' | 'male';
  /** 갈래 확률 % (개무소 → 실쿤 · 카스쿤 50 · 50) */
  chance?: number;
  /** 이 기술을 알면 진화 (기술 번호) */
  knownMove?: number;
  knownMoveType?: TypeName;
  heldItem?: string;
  conditions?: string[];
  trigger?: string;
}

/** 그림 하나 (extension/media/gen<gen>/<키>/) */
export interface FormData {
  species: number;
  gen: number;
  /** 원본 그림 크기 (32 · 64) */
  size: number;
  shiny: boolean;
}

/** 레벨업 기술 [레벨, 기술 번호] — 기술마다 한 번 (가장 낮은 레벨). 레벨 0 = 진화할 때 배우는 기술 (레벨이 올라서는 안 들어옴) */
export type LearnsetEntry = readonly [level: number, moveId: number];

type Ro<T> = { readonly [K in keyof T]: T[K] extends (infer U)[] ? readonly Ro<U>[] : T[K] extends object ? Ro<T[K]> : T[K] };
export type ReadonlySpecies = Ro<SpeciesData>;
export type ReadonlyMove = Ro<MoveData>;
export type ReadonlyEvolution = Ro<Evolution>;
export type ReadonlyForm = Ro<FormData>;

const species = speciesJson as unknown as Readonly<Record<string, ReadonlySpecies>>;
const moves = movesJson as unknown as Readonly<Record<string, ReadonlyMove>>;
const learnsets = learnsetsJson as unknown as Readonly<Record<string, readonly LearnsetEntry[]>>;
const evolutions = evolutionsJson as unknown as Readonly<Record<string, readonly ReadonlyEvolution[]>>;
const forms = formsJson as unknown as Readonly<Record<string, ReadonlyForm>>;
/** 종 → 그림 이름들 (확장의 POKEMON_DATA 순서 = 기본 모습이 먼저 — 깝질무 west · 사철록 spring) */
const formsBySpecies = new Map<number, string[]>();
for (const [key, form] of Object.entries(forms)) {
  const list = formsBySpecies.get(form.species) ?? [];
  list.push(key);
  formsBySpecies.set(form.species, list);
}

export const DATA_SOURCE = metaJson;

const hasOwn = (o: object, key: string) => Object.prototype.hasOwnProperty.call(o, key);

export function speciesOf(dex: number): ReadonlySpecies | undefined {
  return hasOwn(species, String(dex)) ? species[String(dex)] : undefined;
}

export function moveOf(id: number): ReadonlyMove | undefined {
  return hasOwn(moves, String(id)) ? moves[String(id)] : undefined;
}

/** 기술의 일반 모드 연출 — ms = 길이 (가운데 값) · hitAt = 맞는 때 (길이의 몇 %) · contact = 몸으로 닿는 틀 (달려가 박치기) · fx = 틀 이름 (dev/move-fx.py 가 만듦 — 3:3 박자) */
export interface MoveFx {
  ms: number;
  hitAt: number;
  contact: boolean;
  fx: string;
}
const moveFx = moveFxJson as unknown as Readonly<Record<string, readonly [number, number, number, string]>>;
export function moveFxOf(id: number): MoveFx | null {
  const r = hasOwn(moveFx, String(id)) ? moveFx[String(id)] : undefined;
  return r ? { ms: r[0], hitAt: r[1] / 1000, contact: r[2] === 1, fx: r[3] } : null;
}

/** 레벨업 기술표 (레벨 순서) — 쓸 수 있는 기술이 하나도 없는 종은 빈 목록 */
export function learnsetOf(dex: number): readonly LearnsetEntry[] {
  return hasOwn(learnsets, String(dex)) ? (learnsets[String(dex)] ?? []) : [];
}

export function evolutionsOf(dex: number): readonly ReadonlyEvolution[] {
  return hasOwn(evolutions, String(dex)) ? (evolutions[String(dex)] ?? []) : [];
}

export function formOf(key: string): ReadonlyForm | undefined {
  return hasOwn(forms, key) ? forms[key] : undefined;
}

/** 그 종의 그림 이름들 — 기본 모습이 먼저 */
export function formsOfSpecies(dex: number): readonly string[] {
  return formsBySpecies.get(dex) ?? [];
}

export function allSpecies(): number[] {
  return Object.keys(species).map(Number).sort((a, b) => a - b);
}

export function allForms(): string[] {
  return Object.keys(forms);
}

const signature = signatureJson as unknown as Readonly<Record<string, readonly number[]>>;

/** 모습마다 필살기 이름 · 원작 범위기 이름 (make-moves.py 가 연출 표 · PokeAPI 기술 대상에서 만듦 — 3:3 필살기 대상, 2026-10-21 기획 R7) */
const ultMoves = ultMovesJson as unknown as { forms: Readonly<Record<string, readonly string[]>>; spread: readonly string[] };
const ultSpread = new Set(ultMoves.spread);

/** 그 모습의 필살기 이름들 (연출과 같은 이름) — 없으면 빈 목록 */
export function ultNamesOf(form: string): readonly string[] {
  return hasOwn(ultMoves.forms, form) ? (ultMoves.forms[form] ?? []) : [];
}

/** 원작에서 상대 모두를 치는 기술 이름인지 (대상 = 상대 모두 · 나 빼고 모두) — 원작 기술이 아닌 필살기는 false */
export function ultIsSpread(name: string): boolean {
  return ultSpread.has(name);
}

/** 진화할 때 들어오는 대표 기술 후보 (확장의 대표 기술 중 게임에 있는 피해 기술, scripts/build-signature.mjs) — 없으면 빈 목록 */
export function signatureOf(dex: number): readonly number[] {
  return hasOwn(signature, String(dex)) ? (signature[String(dex)] ?? []) : [];
}

/** 기술 전부 (번호 순서) */
export function allMoves(): ReadonlyMove[] {
  return Object.values(moves).sort((a, b) => a.id - b.id);
}
