/**
 * 조우 · 발견 (mvp-spec 3.2 · gdd 4.6) — 그 자리에서 무엇을 만나는지. 자리 시드로 정해서 언제 누가 계산해도 같음.
 *
 * 숲 포켓몬 = 확장에 그림이 있는 풀 · 벌레 1단계 (전설 · 환상 · 아기 빼고), 10% 는 독 · 드래곤 · 페어리.
 * 종족값 합 450 이 넘는 1단계 (스라크 · 헤라크로스 등) 는 1-3 에만. 레벨이 진화 레벨을 넘으면 진화형 (돌 · 교환은 안 나옴).
 * 스타팅 18종 계열은 야생에 안 나옴 (mvp-spec 9장 [제안] — 처음 고른 포켓몬이 특별하게).
 */
import { BALANCE } from '../balance';
import type { Rng } from '../engine/rng';
import type { EncounterStart, ItemId, Monster, StageId } from '../save';
import { allSpecies, evolutionsOf, formOf, formsOfSpecies, speciesOf, type ReadonlySpecies, type TypeName } from '../../data';
import { createMonster, wildMoves } from './monster';
import { spotRng, stageLevelBand, type Spot } from './stage';

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

const baseTotal = (s: ReadonlySpecies) => s.base.hp + s.base.attack + s.base.defense + s.base.spAttack + s.base.spDefense + s.base.speed;
const isWildable = (s: ReadonlySpecies) => !s.legendary && !s.mythical && !s.baby && s.stage === 1;
const hasAny = (types: readonly TypeName[], want: readonly TypeName[]) => types.some((t) => want.includes(t));

interface Pool {
  common: number[];
  rare: number[];
}
const pools = new Map<StageId, Pool>();

/** 그 스테이지에 나오는 1단계 종 (도감 번호) */
export function forestPool(stageId: StageId): Pool {
  let pool = pools.get(stageId);
  if (pool) return pool;
  pool = { common: [], rare: [] };
  for (const dex of allSpecies()) {
    const s = speciesOf(dex);
    if (!s || !isWildable(s) || isStarterLine(s) || formsOfSpecies(dex).length === 0) continue;
    if (baseTotal(s) > BALANCE.bigBaseTotal && stageId !== 'forest-3') continue;
    if (hasAny(s.types, ['grass', 'bug'])) pool.common.push(dex);
    else if (hasAny(s.types, ['poison', 'dragon', 'fairy'])) pool.rare.push(dex);
  }
  pools.set(stageId, pool);
  return pool;
}

/** 레벨에 맞게 진화 — 레벨 진화 (친밀도는 Lv 20) 만, 조건 · 돌 · 교환은 안 함. 갈래는 확률 (없으면 반반) */
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
export function planWild(stageId: StageId, stageSeed: number, spot: Spot, retries = 0): WildPlan {
  const rng = spotRng(stageSeed, wildKey(spot, retries), 1);
  const pool = forestPool(stageId);
  const list = pool.rare.length > 0 && rng.chance(BALANCE.rareTypeChance) ? pool.rare : pool.common;
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
export function createWild(stageId: StageId, stageSeed: number, spot: Spot, retries = 0): Monster {
  const plan = planWild(stageId, stageSeed, spot, retries);
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

/** 전투 시작 상태: Space 를 맞게 누르면 선제공격 (상대가 기습이면 막아내서 보통), 안 누르면 보통 (상대가 기습이면 기습당함) */
export function resolveStart(ambush: boolean, space: boolean): EncounterStart {
  if (space) return ambush ? 'normal' : 'preemptive';
  return ambush ? 'ambush' : 'normal';
}

/** 떨어진 아이템 하나 — 아이템이면 item, 돈이면 money */
export interface Pickup {
  item?: ItemId;
  money?: number;
}

/** 진화의 돌 중 숲에서 주울 수 있는 것 */
const FOREST_STONES: readonly ItemId[] = ['leaf-stone', 'moon-stone'];

export function pickupAt(stageId: StageId, stageSeed: number, spot: Spot): Pickup {
  const rng = spotRng(stageSeed, spot.index, 3);
  const t = BALANCE.pickupTable;
  const r = rng.next();
  if (r < t['poke-ball']) return { item: 'poke-ball' };
  if (r < t['poke-ball'] + t.potion) return { item: 'potion' };
  if (r < t['poke-ball'] + t.potion + t.money) return { money: stageLevelBand(stageId)[1] * BALANCE.pickupMoneyPerLevel };
  return { item: FOREST_STONES[rng.int(0, FOREST_STONES.length - 1)]! };
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
  const sky = flyers.length > 0 && rng.chance(0.4);
  const list = sky ? flyers : forestPool(stageId).common;
  const dex = list[rng.int(0, list.length - 1)] ?? 10;
  return { form: formsOfSpecies(dex)[0] ?? 'caterpie', place: sky ? 'sky' : 'tree' };
}
