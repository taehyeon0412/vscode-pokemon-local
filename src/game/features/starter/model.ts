/**
 * S03 주인공 · S04 스타팅 · 새로 하기 — 화면을 모르는 규칙 부분 (gdd S03 · S04 · 4.2).
 * 새로 하기 → S03 남 · 여 → S04 스타팅 18종 · 진화 단계 보기 · 처음 기술 4개 중 2개 → 숲 1-1 (S05 는 MVP 에 없음)
 */
import { BALANCE } from '../../core/balance';
import { Rng } from '../../core/engine';
import { STARTER_SPECIES } from '../../core/rules/encounter';
import { createMonster } from '../../core/rules/monster';
import { createNewSave, type Save } from '../../core/save';
import { evolutionsOf, formsOfSpecies, learnsetOf, moveOf, speciesOf, type ReadonlyMove } from '../../data';

export { createMonster } from '../../core/rules/monster';
export { STARTER_SPECIES } from '../../core/rules/encounter';

/** 고르지 않았을 때 (테스트 · 미리보기 · 옛 길) — 이상해씨 */
export const TEMPORARY_STARTER = 1;

export type Gender = 'male' | 'female';

/** S03 · S04 에서 고른 것 */
export interface NewGameChoice {
  gender: Gender;
  dex: number;
  /** 처음 기술 2개 (후보 안에서) — 틀리면 기본 2개 */
  moves: number[];
}

/**
 * 처음 기술 후보 (mvp-spec 3.6 · S04): 레벨 제한 없이 레벨업으로 배우는 피해 기술 중 앞에서부터 4개,
 * 그 안에 자기 타입 기술이 없으면 첫 자기 타입 기술을 4번째 자리에 넣음
 */
export function starterMoveCandidates(dex: number): ReadonlyMove[] {
  const types = speciesOf(dex)?.types ?? [];
  const damaging = learnsetOf(dex)
    .map(([, id]) => moveOf(id))
    .filter((m): m is ReadonlyMove => m !== undefined && m.class !== 'status')
    .filter((m, i, all) => all.findIndex((x) => x.id === m.id) === i);
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

/** 고른 처음 기술이 맞는지 — 후보 안에서 서로 다른 2개 (아니면 기본 2개) */
export function chosenStarterMoves(dex: number, ids: readonly number[]): ReadonlyMove[] {
  const cands = starterMoveCandidates(dex);
  const picked = [...new Set(ids)].map((id) => cands.find((m) => m.id === id)).filter((m): m is ReadonlyMove => !!m);
  return picked.length === BALANCE.starterMoves ? picked : defaultStarterMoves(dex);
}

/** S04 ② 진화 단계 (1 → 2 → 3) — 그림이 있는 첫 갈래를 따라감 */
export function evolutionChain(dex: number): { dex: number; form: string; name: string }[] {
  const out: { dex: number; form: string; name: string }[] = [];
  let cur: number | undefined = dex;
  for (let guard = 0; cur !== undefined && guard < 4; guard++) {
    const form = formsOfSpecies(cur)[0];
    if (!form) break;
    out.push({ dex: cur, form, name: speciesOf(cur)?.name.ko ?? form });
    cur = evolutionsOf(cur).find((e) => formsOfSpecies(e.to).length > 0)?.to;
  }
  return out;
}

/** S04 ① 스타팅 줄 — 18종 (풀 · 불꽃 · 물 순서, 세대 상관없음) */
export function starterList(): { dex: number; form: string; name: string }[] {
  return STARTER_SPECIES.map((dex) => ({ dex, form: formsOfSpecies(dex)[0] ?? '', name: speciesOf(dex)?.name.ko ?? String(dex) })).filter((s) => s.form);
}

/** 새로 하기 (S02 ①) — S03 · S04 에서 고른 주인공 · 스타팅 한 마리와 함께 숲 1-1 에서 시작하는 세이브 */
export function createStartSave(now: number, seed: number, dex: number = TEMPORARY_STARTER, choice: Partial<Pick<NewGameChoice, 'gender' | 'moves'>> = {}): Save {
  const rng = new Rng(seed);
  const starterDex = STARTER_SPECIES.includes(dex) ? dex : TEMPORARY_STARTER;
  const moves = choice.moves ? chosenStarterMoves(starterDex, choice.moves) : defaultStarterMoves(starterDex);
  const starter = createMonster({ uid: 'm1', dex: starterDex, level: BALANCE.starterLevel, moves, rng, caughtAt: 'starter' });
  const save = createNewSave(now);
  return {
    ...save,
    player: choice.gender ? { gender: choice.gender } : save.player,
    monsters: { m1: starter },
    party: ['m1'],
    nextMonsterUid: 2,
    location: { screen: 'stage', stageId: 'forest-1' },
    stages: { 'forest-1': { seed: rng.int(0, 0xffffffff), progress: 0, cleared: false, defeatedTrainers: [], facilities: [], run: { startMs: 0, caught: 0, trainers: 0, seen: [], reach: 0, retries: 0 } } },
    dex: { seen: [starterDex], caught: [starterDex] },
  };
}
