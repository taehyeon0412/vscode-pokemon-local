/**
 * 스타팅 (S04) · 새로 하기 — 화면을 모르는 규칙 부분.
 * 단계 3~9 동안 새로 하기는 임시 스타팅 (이상해씨 Lv 5, 처음 기술 자동) → 단계 10에서 S03 · S04 화면으로 고름 (dev-plan 2장).
 */
import { BALANCE } from '../../core/balance';
import { Rng } from '../../core/engine';
import { expForLevel, maxHp } from '../../core/rules/stats';
import { createNewSave, STAT_KEYS, type Monster, type MoveSlot, type Save, type Stats } from '../../core/save';
import { formsOfSpecies, learnsetOf, moveOf, speciesOf, type ReadonlyMove } from '../../data';

/** 단계 10 전까지 쓰는 임시 스타팅 — 이상해씨 */
export const TEMPORARY_STARTER = 1;

/**
 * 처음 기술 후보 (mvp-spec 3.6 · S04): 레벨 제한 없이 레벨업으로 배우는 피해 기술 중 앞에서부터 4개,
 * 그 안에 자기 타입 기술이 없으면 첫 자기 타입 기술을 4번째 자리에 넣음
 */
export function starterMoveCandidates(dex: number): ReadonlyMove[] {
  const types = speciesOf(dex)?.types ?? [];
  const damaging = learnsetOf(dex)
    .map(([, id]) => moveOf(id))
    .filter((m): m is ReadonlyMove => m !== undefined && m.class !== 'status');
  const first = damaging.slice(0, BALANCE.starterMoveCandidates);
  if (!first.some((m) => types.includes(m.type))) {
    const own = damaging.find((m) => types.includes(m.type));
    if (own) first.splice(BALANCE.starterMoveCandidates - 1, 1, own);
  }
  return first;
}

/** 고르기 전 기본 2개 — 앞에서부터, 자기 타입 기술 하나는 꼭 */
export function defaultStarterMoves(dex: number): ReadonlyMove[] {
  const cands = starterMoveCandidates(dex);
  const types = speciesOf(dex)?.types ?? [];
  const picked = cands.slice(0, BALANCE.starterMoves);
  if (!picked.some((m) => types.includes(m.type))) {
    const own = cands.find((m) => types.includes(m.type));
    if (own) picked[picked.length - 1] = own;
  }
  return picked;
}

function randomIvs(rng: Rng): Stats {
  const out = {} as Stats;
  for (const k of STAT_KEYS) out[k] = rng.int(0, BALANCE.maxIv);
  return out;
}

const noPoints = (): Stats => ({ hp: 0, attack: 0, defense: 0, speed: 0, ultimate: 0 });

/** 포켓몬 한 마리 만들기 — 개체값은 시드 랜덤, HP 는 가득 */
export function createMonster(options: { uid: string; dex: number; level: number; moves: readonly ReadonlyMove[]; rng: Rng; caughtAt: string }): Monster {
  const species = speciesOf(options.dex);
  const form = formsOfSpecies(options.dex)[0];
  if (!species || !form) throw new Error(`종 ${options.dex} 데이터 · 그림이 없음`);
  const ivs = randomIvs(options.rng);
  const points = noPoints();
  const moves: MoveSlot[] = options.moves.map((m) => ({ moveId: m.id, pp: m.pp }));
  return {
    uid: options.uid,
    species: options.dex,
    form,
    level: options.level,
    exp: expForLevel(options.level),
    ivs,
    points,
    unspentPoints: 0,
    moves,
    hp: maxHp(species.base, ivs, points, options.level),
    status: null,
    shiny: false,
    caughtAt: options.caughtAt,
  };
}

/** 새로 하기 (S02 ①) — 스타팅 한 마리와 함께 숲 1-1 에서 시작하는 세이브 */
export function createStartSave(now: number, seed: number, dex: number = TEMPORARY_STARTER): Save {
  const rng = new Rng(seed);
  const starter = createMonster({ uid: 'm1', dex, level: BALANCE.starterLevel, moves: defaultStarterMoves(dex), rng, caughtAt: 'starter' });
  const save = createNewSave(now);
  return {
    ...save,
    monsters: { m1: starter },
    party: ['m1'],
    nextMonsterUid: 2,
    location: { screen: 'stage', stageId: 'forest-1' },
    stages: { 'forest-1': { seed: rng.int(0, 0xffffffff), progress: 0, cleared: false, defeatedTrainers: [], facilities: [] } },
    dex: { seen: [dex], caught: [dex] },
  };
}
