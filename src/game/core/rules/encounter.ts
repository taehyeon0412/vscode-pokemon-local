/**
 * 조우 · 발견 (mvp-spec 3.2 · gdd 4.6) — 그 자리에서 무엇을 만나는지. 자리 시드로 정해서 언제 누가 계산해도 같음.
 *
 * 숲 포켓몬 = 확장에 그림이 있는 풀 · 벌레 1단계 (전설 · 환상 · 아기 빼고) · 30% 는 노말 · 비행으로만 된 1단계 (공격 기술이 있는 것 — 단계 11, 2026-10-19 태현 님) ·
 *   그 나머지의 10% 는 독 · 드래곤 · 페어리. 타입이 겹치면 풀 · 벌레 → 독 · 드래곤 · 페어리 → 노말 · 비행 순으로 한 곳에만.
 * 종족값 합 450 이 넘는 1단계 (스라크 · 헤라크로스 등) 는 1-3 에만. 레벨이 진화 레벨을 넘으면 진화형 (돌 · 교환은 안 나옴).
 * 스타팅 18종 계열은 야생에 안 나옴 (mvp-spec 9장 [제안] — 처음 고른 포켓몬이 특별하게).
 */
import { BALANCE } from '../balance';
import type { Rng } from '../engine/rng';
import type { EncounterStart, ItemId, Monster, StageId } from '../save';
import { allSpecies, evolutionsOf, formOf, formsOfSpecies, learnsetOf, moveOf, speciesOf, type ReadonlySpecies, type TypeName } from '../../data';
import { createMonster, wildMoves } from './monster';
import { spotRng, stageLevelBand, type Spot } from './stage';
import { regionOf } from './region';

/** 흔적 모양 6가지 — 타입 · 지형별로 다르게 튀어나옴 (gdd 4.6) */
export type TraceKind = 'grass' | 'water' | 'sky' | 'ground' | 'tree' | 'shadow';

export interface WildPlan {
  dex: number;
  form: string;
  level: number;
  /** 크게 흔들림 (레벨대 위끝 + 2) */
  strong: boolean;
  /** 반짝임 */
  shiny: boolean;
  trace: TraceKind;
}

/** 스타팅 18종 (S04 · mvp-spec 2장) — 이 진화 계열은 야생에서 뺌 */
export const STARTER_SPECIES: readonly number[] = [1, 152, 252, 387, 495, 650, 4, 155, 255, 390, 498, 653, 7, 158, 258, 393, 501, 656];
let starterChains: Set<number> | null = null;
const isStarterLine = (s: ReadonlySpecies) => {
  starterChains ??= new Set(STARTER_SPECIES.map((d) => speciesOf(d)?.chain).filter((c): c is number => c !== undefined));
  return starterChains.has(s.chain);
};

export const baseTotal = (s: ReadonlySpecies) => s.base.hp + s.base.attack + s.base.defense + s.base.spAttack + s.base.spDefense + s.base.speed;
const isWildable = (s: ReadonlySpecies) => !s.legendary && !s.mythical && !s.baby && s.stage === 1;
const hasAny = (types: readonly TypeName[], want: readonly TypeName[]) => types.some((t) => want.includes(t));

interface Pool {
  common: number[];
  rare: number[];
  /** 노말 · 비행 (숲에 섞임, mixedTypeChance) */
  mixed: number[];
}
const pools = new Map<string, Pool>();

/** 예전 이름 (개발 모드 · 시험이 씀) · preview = 정한 목록 초안 (숲 gdd 5.4 — 개발 모드 스위치) */
export const forestPool = (stageId: StageId, preview = false): Pool => regionPool(stageId, preview);

/** 스테이지 id 로 늘 같은 n 종 (정한 목록 초안의 노말 · 비행 · 드문 타입 — gdd 5.4 "지역 id 시드로 모두에게 같게" [제안]) */
function pickFixed(list: readonly number[], n: number, stageId: StageId, salt: number): number[] {
  let h = salt;
  for (const ch of stageId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rng = spotRng(h, 0, salt);
  const left = [...list].sort((a, b) => a - b);
  const out: number[] = [];
  while (out.length < n && left.length > 0) out.push(left.splice(rng.int(0, left.length - 1), 1)[0]!);
  return out;
}

/** 레벨업으로 피해 기술을 하나라도 배우는지 (메타몽처럼 변신만 있으면 숲에 섞지 않음) */
const canAttack = (dex: number) => learnsetOf(dex).some(([, id]) => (moveOf(id)?.class ?? 'status') !== 'status');

/**
 * 그 스테이지에 나오는 1단계 종 (도감 번호) — 지역 표의 타입으로 자동 (숲 = 풀 · 벌레 / 드묾 독 · 드래곤 · 페어리), 종족값 큰 것은 지역 마지막 스테이지에서만.
 * preview = 정한 목록 초안 (region.wild.preview — 숲 gdd 5.4, 개발 모드 스위치에서만): 흔함 = 목록 · 노말 · 비행 3종 · 드묾 = 마지막 스테이지 목록 · 앞 스테이지는 드문 타입 2종
 */
export function regionPool(stageId: StageId, preview = false): Pool {
  const { region, index } = regionOf(stageId);
  const draft = preview ? region.wild.preview : undefined;
  const key = draft ? `${stageId}:preview` : stageId;
  let pool = pools.get(key);
  if (pool) return pool;
  pool = { common: [], rare: [], mixed: [] };
  const lists = draft?.lists ?? region.wild.lists;
  const strong = draft ? draft.strong : region.wild.strong;
  const rareList = draft ? draft.rareList : region.wild.rareList;
  const rareTypes: number[] = [];
  for (const dex of allSpecies()) {
    const s = speciesOf(dex);
    if (!s || !isWildable(s) || isStarterLine(s) || formsOfSpecies(dex).length === 0) continue;
    if (baseTotal(s) > BALANCE.bigBaseTotal && index < region.stages.length - 1) continue;
    // 스테이지마다 정한 목록 (해변 · 숲 초안) 이면 흔함 · 드묾은 목록에서 (아래), 노말 · 비행 섞기만 타입으로
    if (lists) {
      if (s.types.every((t) => t === 'normal' || t === 'flying') && canAttack(dex)) pool.mixed.push(dex);
      else if (draft && !hasAny(s.types, region.wild.common) && hasAny(s.types, region.wild.rare)) rareTypes.push(dex);
      continue;
    }
    if (hasAny(s.types, region.wild.common)) pool.common.push(dex);
    else if (hasAny(s.types, region.wild.rare)) pool.rare.push(dex);
    else if (s.types.every((t) => t === 'normal' || t === 'flying') && canAttack(dex)) pool.mixed.push(dex);
  }
  if (lists) {
    const last = index === region.stages.length - 1;
    pool.common = [...(lists[index] ?? []), ...(last ? (strong ?? []) : [])].filter((d) => !!speciesOf(d) && formsOfSpecies(d).length > 0);
    pool.rare = last ? (rareList ?? []).filter((d) => !!speciesOf(d) && formsOfSpecies(d).length > 0) : draft ? pickFixed(rareTypes, 2, stageId, 2) : [];
    // 숲 초안 — 노말 · 비행도 스테이지마다 3종 (gdd 5.4)
    if (draft) pool.mixed = pickFixed(pool.mixed, 3, stageId, 1);
  }
  pools.set(key, pool);
  return pool;
}

/** 레벨에 맞게 진화 — 레벨 진화 (친밀도는 Lv 20) 만, 조건 · 돌 · 교환은 안 함. 갈래는 확률 (없으면 반반) */
/**
 * 그 레벨로 아직 될 수 없는 진화형이면 진화 전으로 (트레이너 — 2026-10-21 orders #32 A, 1-3 펜드라 Lv12 벽).
 * 레벨 진화는 그 레벨 · 친밀도는 friendshipLevel 이 넘었어야 함 · 돌 · 교환 같은 진화는 레벨로 못 되니 진화 전으로. 진화 전이 데이터에 없으면 그대로
 */
export function devolveForLevel(dex: number, level: number): number {
  let current = dex;
  for (let guard = 0; guard < 4; guard++) {
    const from = speciesOf(current)?.evolvesFrom;
    if (!from || !speciesOf(from) || formsOfSpecies(from).length === 0) return current;
    const e = evolutionsOf(from).find((x) => x.to === current);
    const reach = !e ? false : e.kind === 'level' ? (e.level ?? 1) <= level : e.kind === 'friendship' ? BALANCE.friendshipLevel <= level : false;
    if (reach) return current;
    current = from;
  }
  return current;
}

export function evolveForLevel(dex: number, level: number, rng: Rng): number {
  let current = dex;
  for (let guard = 0; guard < 4; guard++) {
    const options = evolutionsOf(current).filter((e) => {
      if (formsOfSpecies(e.to).length === 0) return false;
      if (e.item || e.heldItem || e.knownMove || e.knownMoveType || e.time || (e.conditions && e.conditions.length > 0)) return false;
      if (e.kind === 'level') return (e.level ?? 1) <= level;
      if (e.kind === 'friendship') return BALANCE.friendshipLevel <= level;
      return false;
    });
    if (options.length === 0) return current;
    const total = options.reduce((a, e) => a + (e.chance ?? 100 / options.length), 0);
    let r = rng.next() * total;
    let picked = options[options.length - 1]!;
    for (const e of options) {
      r -= e.chance ?? 100 / options.length;
      if (r < 0) {
        picked = e;
        break;
      }
    }
    current = picked.to;
  }
  return current;
}

export function traceKindOf(types: readonly TypeName[]): TraceKind {
  if (types.includes('water')) return 'water';
  if (types.includes('flying')) return 'sky';
  if (hasAny(types, ['ghost', 'dark'])) return 'shadow';
  if (hasAny(types, ['ground', 'rock', 'steel'])) return 'ground';
  if (types.includes('bug')) return 'tree';
  return 'grass';
}

/** 졌다 다시 걸을 때 (retries) 같은 자리의 야생을 다시 뽑는 열쇠 (mvp-spec S17 "야생은 다시 뽑음") */
export const wildKey = (spot: Spot, retries = 0) => spot.index + retries * 10_007;

/** 그 야생 자리에 무엇이 있는지 (만나기 전에도 흔적 모양 · 크게 흔들림 · 반짝임을 그리려고 미리 정함) */
export function planWild(stageId: StageId, stageSeed: number, spot: Spot, retries = 0, preview = false): WildPlan {
  const rng = spotRng(stageSeed, wildKey(spot, retries), 1);
  const pool = regionPool(stageId, preview);
  const list = pool.mixed.length > 0 && rng.chance(BALANCE.mixedTypeChance) ? pool.mixed : pool.rare.length > 0 && rng.chance(BALANCE.rareTypeChance) ? pool.rare : pool.common;
  const base = list[rng.int(0, list.length - 1)] ?? 1;
  const [lo, hi] = stageLevelBand(stageId);
  const strong = rng.chance(BALANCE.strongTraceChance);
  const level = strong ? hi + BALANCE.strongLevelBonus : Math.min(hi, Math.max(lo, Math.round(lo + (hi - lo) * spot.at + rng.int(-1, 1))));
  const dex = evolveForLevel(base, level, rng);
  const form = formsOfSpecies(dex)[0] ?? 'bulbasaur';
  const shiny = rng.chance(BALANCE.shinyChance) && formOf(form)?.shiny === true;
  return { dex, form, level, strong, shiny, trace: traceKindOf(speciesOf(dex)?.types ?? []) };
}

/** 만난 야생 포켓몬 — 개체값 · 기술을 지금 정함 (잡으면 그대로 가져감) */
export function createWild(stageId: StageId, stageSeed: number, spot: Spot, retries = 0, preview = false): Monster {
  const plan = planWild(stageId, stageSeed, spot, retries, preview);
  const key = wildKey(spot, retries);
  return createMonster({
    uid: 'wild',
    dex: plan.dex,
    form: plan.form,
    level: plan.level,
    moves: wildMoves(plan.dex, plan.level, spotRng(stageSeed, key, 7)),
    rng: spotRng(stageSeed, key, 2),
    caughtAt: stageId,
    shiny: plan.shiny,
  });
}

/** 기습 확률 — 상대가 나보다 훨씬 빠를수록 (상대 스피드가 내 1.5배 이상 10%, 2배 이상 20%) */
export function ambushChance(enemySpeed: number, mySpeed: number): number {
  if (!(mySpeed > 0)) return 0;
  const ratio = enemySpeed / mySpeed;
  return BALANCE.ambush.find(([min]) => ratio >= min)?.[1] ?? 0;
}

/** 선제공격 확률 — 내가 상대보다 훨씬 빠를수록 (내 스피드가 상대 1.5배 이상 10%, 2배 이상 20% — 기습과 대칭) */
export function preemptiveChance(enemySpeed: number, mySpeed: number): number {
  if (!(enemySpeed > 0)) return 0;
  const ratio = mySpeed / enemySpeed;
  return BALANCE.preemptive.find(([min]) => ratio >= min)?.[1] ?? 0;
}

/** 전투 시작 상태 — 스피드로 정함 (2026-10-21 태현 님 "Space 선제공격은 빼자 — 보고 있지 않으면 하기 어려움"): 상대가 훨씬 빠르면 기습 · 내가 훨씬 빠르면 선제공격 · 아니면 보통 (둘 중 하나만 0 이 아님, 랜덤은 늘 한 번) */
export function encounterStart(enemySpeed: number, mySpeed: number, rng: Rng): EncounterStart {
  const ambush = ambushChance(enemySpeed, mySpeed);
  if (ambush > 0) return rng.chance(ambush) ? 'ambush' : 'normal';
  return rng.chance(preemptiveChance(enemySpeed, mySpeed)) ? 'preemptive' : 'normal';
}

/** 떨어진 아이템 하나 — 아이템이면 item, 돈이면 money */
export interface Pickup {
  item?: ItemId;
  money?: number;
}


export function pickupAt(stageId: StageId, stageSeed: number, spot: Spot): Pickup {
  const rng = spotRng(stageSeed, spot.index, 3);
  const t = BALANCE.pickupTable;
  const r = rng.next();
  if (r < t['poke-ball']) return { item: 'poke-ball' };
  // 지역마다 가끔 섞이는 것 (해변 진주 — 돈 몫에서, gdd 5.3)
  const extra = regionOf(stageId).region.pickupExtra;
  if (extra && r >= t['poke-ball'] + t.potion && r < t['poke-ball'] + t.potion + extra.chance) return { item: extra.item };
  if (r < t['poke-ball'] + t.potion) return { item: 'potion' };
  if (r < t['poke-ball'] + t.potion + t.money) return { money: stageLevelBand(stageId)[1] * BALANCE.pickupMoneyPerLevel };
  // 진화의 돌 — 지역 표 (숲 = 리프의 돌 · 달의 돌 · 해변 = 물의 돌)
  const stones = regionOf(stageId).region.stones;
  return { item: stones[rng.int(0, stones.length - 1)]! };
}

/** 배경 속 포켓몬 (보기만) — 나무 위 (숲 포켓몬) · 하늘 (날 수 있는 포켓몬) */
export interface Scenery {
  form: string;
  place: 'tree' | 'sky';
}

let flyers: number[] | null = null;

export function sceneryAt(stageId: StageId, stageSeed: number, index: number): Scenery {
  const rng = spotRng(stageSeed, index, 4);
  if (!flyers) flyers = allSpecies().filter((d) => {
    const s = speciesOf(d);
    return !!s && isWildable(s) && s.types.includes('flying') && formsOfSpecies(d).length > 0;
  });
  // 지역 표에 정한 배경 포켓몬이 있으면 그것 (해변 = 하늘 갈모매 · 패리퍼 · 바다 잉어킹 · 만타인)
  const scenery = regionOf(stageId).region.scenery;
  const skyList = scenery?.sky ?? flyers;
  const sky = skyList.length > 0 && rng.chance(0.4);
  const list = sky ? skyList : (scenery?.ground ?? regionPool(stageId).common);
  const dex = list[rng.int(0, list.length - 1)] ?? 10;
  return { form: formsOfSpecies(dex)[0] ?? 'caterpie', place: sky ? 'sky' : 'tree' };
}
