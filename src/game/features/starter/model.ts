/**
 * S03 주인공 · S04 스타팅 · 새로 하기 — 화면을 모르는 규칙 부분 (gdd S03 · S04 · 4.2).
 * 새로 하기 → S03 주인공 (남 · 여 여러 명, data/heroes.ts) → S04 스타팅 18종 · 진화 단계 보기 · 처음 기술 4개 중 2개 → 숲 1-1 (S05 는 MVP 에 없음)
 */
import { BALANCE } from '../../core/balance';
import { Rng } from '../../core/engine';
import { STARTER_SPECIES } from '../../core/rules/encounter';
import { spriteBoxOf } from '../../data/sprite-boxes';
import { createMonster } from '../../core/rules/monster';
import { createNewSave, type Save } from '../../core/save';
import { evolutionsOf, formsOfSpecies, learnsetOf, moveOf, speciesOf, type ReadonlyMove } from '../../data';
import { isHeroLookId } from '../../data/heroes';

export { createMonster } from '../../core/rules/monster';
export { STARTER_SPECIES } from '../../core/rules/encounter';

/** 고르지 않았을 때 (테스트 · 미리보기 · 옛 길) — 이상해씨 */
export const TEMPORARY_STARTER = 1;

export type Gender = 'male' | 'female';

/** S03 · S04 에서 고른 것 */
export interface NewGameChoice {
  gender: Gender;
  /** S03 에서 고른 캐릭터 id (data/heroes.ts) */
  look?: string;
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

/**
 * S04 ② 진화 줄 그림 — 모든 단계를 같은 점 크기로 (원작 그림 크기 그대로라 진화할수록 커 보임 — 2026-10-20 태현 님 "크기가 제각각").
 * 위 칸 = 그림 (발끝을 한 줄에 — 태현 님 "바닥으로 정렬") · 아래 칸 = 이름 (그림마다 바로 밑) — 태현 님 그림 A안.
 * 배율 = 패널 크기에 따라 ×1 ~ ×4 (pickLayout — 들어가는 가장 큰 단계).
 * 그림 칸 높이 = 이 진화 줄에서 가장 큰 그림 × 배율 — 바닥을 맞춰도 위 · 아래 보이는 간격이 같게 (줄마다 높이가 다름)
 */
/** 18종 진화 단계 중 가장 큰 그림 키 (칸) — 150px 에서도 들어가는지 계산하는 기준 (model.test) */
export const CHAIN_MAX_ART = 33;
/** 진화 묶음 아래쪽 (그림 ↔ 이름 4 + 이름 · 타입 표 20 + 이름 밑 4 — game.css .pg-chain-grid) · 기술 줄 22 */
export const CHAIN_NAMES_PX = 4 + 20 + 4;
export const MOVES_PX = 22;
/** 고르는 화면 가운데 칸 폭 — 정보줄 · 진화 줄 · 기술 줄과 같은 720 (넓은 패널에서 칩 줄만 튀어나오지 않게) */
export const PICK_COLUMN_PX = 720;
/** 칩 = 그림 창 (22 × 배율) + 위아래 테두리 · 칩 사이 6px (줄 · 칸 모두) */
export const chipPx = (zoom: number): number => 22 * zoom + 2;
const CHIP_PITCH_EXTRA = 4 + 6;
const CHIP_GAP = 6;

/** 칩 줄 높이 — ×1 은 한 줄 (넘치면 옆으로 넘김), ×2 이상은 폭이 모자라면 여러 줄로 감음 (높은 패널의 세로 공간을 씀) */
export function stripLayout(zoom: number, widthPx: number, count: number): { rows: number; heightPx: number } {
  if (zoom === 1) return { rows: 1, heightPx: chipPx(1) };
  const pitch = chipPx(zoom) + CHIP_PITCH_EXTRA;
  const perRow = Math.max(1, Math.floor((widthPx + CHIP_GAP) / pitch));
  const rows = Math.ceil(count / perRow);
  return { rows, heightPx: rows * chipPx(zoom) + (rows - 1) * CHIP_GAP };
}

/**
 * 스타팅 화면 크기 단계 (2026-10-20 태현 님 "패널이 높으면 위 빈 공간을 써서 목록을 키우고 진화 포켓몬도 더 넓게") —
 * [칩 배율, 진화 배율] 큰 단계부터 들어가는 것: ×3 · ×4 → ×2 · ×3 → ×2 · ×2 → ×1 · ×2 → ×1 · ×1. 진화는 칩과 같거나 한 단계 크게 (고른 것이 주인공).
 * 들어감 = 칩 줄 + 진화 묶음 + 기술 줄 + 사이 (×1 단계는 4px · 위 4, 큰 단계는 8px · 위 8)
 */
const PICK_TIERS: readonly (readonly [number, number])[] = [
  [3, 4],
  [2, 3],
  [2, 2],
  [1, 2],
  [1, 1],
];
export interface PickLayout {
  chipZoom: number;
  chainZoom: number;
  stripRows: number;
  stripPx: number;
  rowPx: number;
  /** 칩 줄 + 진화 묶음 + 기술 줄 (사이 간격 빼고) */
  contentPx: number;
  /** 칩 줄 위 · 줄 사이 (나머지는 아래로) */
  topPx: number;
  gapPx: number;
}
export function pickLayout(availH: number, widthPx: number, count: number, forms: readonly string[]): PickLayout {
  let best: PickLayout | null = null;
  for (const [cz, ez] of PICK_TIERS) {
    const strip = stripLayout(cz, widthPx, count);
    const rowPx = chainRowPx(forms, ez);
    const contentPx = strip.heightPx + rowPx + CHAIN_NAMES_PX + MOVES_PX;
    const min = cz === 1 ? 4 : 8;
    // 단계는 가장 큰 진화 줄 (CHAIN_MAX_ART) 로 정함 — 고른 포켓몬을 넘길 때마다 목록 크기가 바뀌지 않게. 간격은 지금 진화 줄로
    const worst = strip.heightPx + (CHAIN_MAX_ART + 2) * ez + CHAIN_NAMES_PX + MOVES_PX;
    const left = availH - contentPx;
    // 칩 줄 위는 작게 (최대 8 — 태현 님 "위와 간격을 조금만"), 줄 사이는 남는 높이를 셋으로 (4 ~ 32), 나머지는 아래
    const topPx = Math.max(4, Math.min(8, Math.floor(left / 4)));
    const gapPx = Math.max(4, Math.min(32, Math.floor((left - topPx) / 3)));
    best = { chipZoom: cz, chainZoom: ez, stripRows: strip.rows, stripPx: strip.heightPx, rowPx, contentPx, topPx, gapPx };
    if (availH - worst >= min + 2 * min) return best;
  }
  return best!;
}

/** 그림 칸 높이 = 이 진화 줄의 가장 큰 실제 그림 × 배율 + 위아래 한 칸씩 여유 (화면 배율 125 · 150% 에서 끝 줄이 잘리지 않게 — Sprite bottom) */
export function chainRowPx(forms: readonly string[], zoom: number): number {
  const hs = forms.map((f) => spriteBoxOf(f)).map((b) => (b ? b[3] - b[1] : 32));
  return (Math.max(1, ...hs) + 2) * zoom;
}
/** 그림 칸 폭 = 실제 그림 폭 × 배율 + 양옆 2px (원본 칸 전체를 쓰면 빈칸이 넓어 줄이 길어짐) */
export function chainArtWidth(form: string, zoom: number): number {
  const box = spriteBoxOf(form);
  return box ? (box[2] - box[0]) * zoom + 4 : 32 * zoom;
}

/** S04 ① 스타팅 줄 — 18종 (풀 · 불꽃 · 물 순서, 세대 상관없음) */
export function starterList(): { dex: number; form: string; name: string }[] {
  return STARTER_SPECIES.map((dex) => ({ dex, form: formsOfSpecies(dex)[0] ?? '', name: speciesOf(dex)?.name.ko ?? String(dex) })).filter((s) => s.form);
}

/** 새로 하기 (S02 ①) — S03 · S04 에서 고른 주인공 · 스타팅 한 마리와 함께 숲 1-1 에서 시작하는 세이브 */
export function createStartSave(now: number, seed: number, dex: number = TEMPORARY_STARTER, choice: Partial<Pick<NewGameChoice, 'gender' | 'look' | 'moves'>> = {}): Save {
  const rng = new Rng(seed);
  const starterDex = STARTER_SPECIES.includes(dex) ? dex : TEMPORARY_STARTER;
  const moves = choice.moves ? chosenStarterMoves(starterDex, choice.moves) : defaultStarterMoves(starterDex);
  const starter = createMonster({ uid: 'm1', dex: starterDex, level: BALANCE.starterLevel, moves, rng, caughtAt: 'starter' });
  const save = createNewSave(now);
  return {
    ...save,
    player: choice.gender ? { gender: choice.gender, ...(isHeroLookId(choice.look) ? { look: choice.look } : {}) } : save.player,
    monsters: { m1: starter },
    party: ['m1'],
    nextMonsterUid: 2,
    location: { screen: 'stage', stageId: 'forest-1' },
    stages: { 'forest-1': { seed: rng.int(0, 0xffffffff), progress: 0, cleared: false, defeatedTrainers: [], facilities: [], run: { startMs: 0, caught: 0, trainers: 0, seen: [], reach: 0, retries: 0 } } },
    dex: { seen: [starterDex], caught: [starterDex] },
  };
}
