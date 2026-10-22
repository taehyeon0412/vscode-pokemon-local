/**
 * 포켓몬 한 마리 만들기 — 스타팅 · 야생 · (나중에) 트레이너가 같이 씀 (mvp-spec 3.4 · 3.5 · 3.6).
 * 개체값은 시드 랜덤, HP 는 가득, 기술은 정해서 넘김.
 */
import { BALANCE } from '../balance';
import type { Rng } from '../engine/rng';
import { STAT_KEYS, type Monster, type MoveSlot, type Stats } from '../save';
import { formsOfSpecies, learnsetOf, moveOf, speciesOf, type ReadonlyMove } from '../../data';
import { expForLevel, maxHp } from './stats';

/** 개체값 0 ~ 31 (스탯마다) */
export function randomIvs(rng: Rng): Stats {
  const out = {} as Stats;
  for (const k of STAT_KEYS) out[k] = rng.int(0, BALANCE.maxIv);
  return out;
}

const noPoints = (): Stats => ({ hp: 0, attack: 0, defense: 0, speed: 0, ultimate: 0 });

export interface CreateMonsterOptions {
  uid: string;
  dex: number;
  level: number;
  moves: readonly ReadonlyMove[];
  rng: Rng;
  caughtAt: string;
  shiny?: boolean;
  /** 그림 이름 — 없으면 그 종의 기본 모습 */
  form?: string;
}

export function createMonster(o: CreateMonsterOptions): Monster {
  const species = speciesOf(o.dex);
  const form = o.form ?? formsOfSpecies(o.dex)[0];
  if (!species || !form) throw new Error(`종 ${o.dex} 데이터 · 그림이 없음`);
  const ivs = randomIvs(o.rng);
  const points = noPoints();
  const moves: MoveSlot[] = o.moves.map((m) => ({ moveId: m.id, pp: m.pp }));
  return {
    uid: o.uid,
    species: o.dex,
    form,
    level: o.level,
    exp: expForLevel(o.level),
    ivs,
    points,
    unspentPoints: 0,
    moves,
    hp: maxHp(species.base, ivs, points, o.level),
    status: null,
    shiny: o.shiny ?? false,
    caughtAt: o.caughtAt,
  };
}

/** 잡은 · 야생 포켓몬의 기술 수 — 레벨에 따라 2 · 3 · 4 (4장) */
export function wildMoveCount(level: number): number {
  return BALANCE.wildMoveCounts.find(([min]) => level >= min)?.[1] ?? 2;
}

/**
 * 야생 · 잡은 포켓몬 기술 (mvp-spec 3.4): 그 레벨까지 레벨업으로 배울 수 있는 기술 중 무작위 2 ~ 4개 (레벨이 높을수록 많이).
 * 배울 수 있는 게 그보다 적으면 있는 만큼, 0개면 빈 목록 → 전투에서 1 공격만 씀 (3.3 — 변화 기술만 배우는 단데기도 1 공격만).
 * 레벨 0 = 진화할 때 배우는 기술 — 그 모습이면 배운 것으로 (원작대로 — orders #64, Lv 20 갸라도스는 물기). 순서는 배우는 순서대로
 */
export function wildMoves(dex: number, level: number, rng: Rng): ReadonlyMove[] {
  const learned: ReadonlyMove[] = [];
  for (const [lv, id] of learnsetOf(dex)) {
    // 진화할 때 배우는 기술 (Lv 0 — 갸라도스 물기) 도 그 모습이면 배운 것 (원작대로 — orders #64)
    if (lv < 0 || lv > level) continue;
    const m = moveOf(id);
    if (m && !learned.some((x) => x.id === m.id)) learned.push(m);
  }
  const n = Math.min(wildMoveCount(level), learned.length);
  const pick = new Set<number>();
  while (pick.size < n) pick.add(rng.int(0, learned.length - 1));
  return learned.filter((_, i) => pick.has(i));
}
