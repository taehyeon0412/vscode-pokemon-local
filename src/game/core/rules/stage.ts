/**
 * 스테이지 길 (mvp-spec 3.2 · gdd 4.5 · 4.6) — 스테이지 시드 하나로 무엇이 어디에 있는지 정한다.
 * 같은 시드면 늘 같은 길 → 저장은 시드 · 진행 % · 병원 · 상점 자리만 (나머지는 다시 계산), 확장 쪽 · 웹뷰가 같은 길을 걸음.
 * 병원 · 상점 자리는 처음 들어갈 때 세이브에 적고, 그 뒤로는 세이브 쪽이 기준 (단계 8 에 들어가는 곳 · 마지막 병원과 그려진 곳이 같게).
 * 주의: BALANCE 의 스테이지 숫자 (나오는 수 · 구간) 를 바꾸면 같은 시드라도 길이 바뀜 → 하던 스테이지의 진행 % 가 다른 곳을 가리킴 (mvp-spec 9장).
 *
 * 자리 (0 = 처음 · 1 = 끝):
 *   야생 12 ~ 18 · 떨어진 아이템 4 ~ 6 · 길 위의 부탁 1 ~ 2 · 트레이너 2 ~ 3 → 고르게 나눈 칸에 섞어 놓음 (서로 붙지 않게)
 *   트레이너는 수 · 자리가 스테이지마다 정해져 있음 (시드와 상관없음 — 이긴 트레이너 "forest-1:t0" 이 다시 걸어도 같은 사람 · 졌다 새 시드로 다시 걸어도
 *   못 이긴 트레이너가 다시 시작하는 곳 뒤로 밀려 건너뛰어지지 않게). 다른 것들은 트레이너 · 시설 자리를 피해 놓음
 *   병원 · 상점 1 ~ 2 곳씩 → "중간쯤" 랜덤 (그 앞에서 멈추고 [들어가기] [지나가기])
 *   배경 속 포켓몬 10 ~ 16 → 보기만 (부딪히지 않음)
 */
import { BALANCE } from '../balance';
import { Rng } from '../engine/rng';
import { REGION_STAGE_IDS, type FacilitySpot, type StageId } from '../save';
import { regionLevelBand, regionOf, regionOrder } from './region';

/** rival = 라이벌 깜짝 등장 (gdd 4.12 — 길 위에 미리 안 보임) */
export type SpotKind = 'wild' | 'item' | 'request' | 'trainer' | 'rival';

export interface Spot {
  kind: SpotKind;
  /** 0 ~ 1 */
  at: number;
  /** 스테이지 안 번호 — 그 자리의 시드 (spotSeed) 를 만들 때 */
  index: number;
  /** 트레이너 번호 (길 순서, 0 부터) — trainerId 의 t0 · t1 … */
  trainer?: number;
}

/** 병원 · 상점 사람 — 건물 옆에 서서 다가오는 주인공 쪽을 봄 (원작 파이어레드 그림, 2026-10-19) */
export const FACILITY_STAFF: Readonly<Record<FacilitySpot['kind'], { name: string; look: string }>> = {
  hospital: { name: '간호순', look: 'frlg-nurse' },
  shop: { name: '점원', look: 'frlg-clerk' },
};

export interface StageLayout {
  /** at 순서 */
  spots: readonly Spot[];
  facilities: readonly FacilitySpot[];
  /** 배경 속 포켓몬 자리 — 무엇이 있는지는 encounter.ts 의 sceneryAt */
  scenery: readonly { at: number; index: number }[];
}

/** 두 수를 섞은 32비트 시드 (자리마다 다른 랜덤) */
export function mixSeed(a: number, b: number): number {
  let h = (a ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (b + 0x7f4a7c15), 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/** 그 자리 전용 랜덤 (야생 포켓몬 · 아이템 · 부탁을 시간과 상관없이 늘 같게) */
export function spotRng(stageSeed: number, index: number, salt = 0): Rng {
  return new Rng(mixSeed(mixSeed(stageSeed, index), salt));
}

const between = (rng: Rng, [lo, hi]: readonly [number, number]) => rng.int(lo, hi);

function shuffle<T>(rng: Rng, list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  return list;
}

/** 시설과 이만큼은 떨어지게 (시설 앞에서 바로 조우하지 않게) */
const FACILITY_GAP = 0.012;

/** 그 스테이지의 트레이너 수 — 스테이지마다 정해짐 (시드와 상관없음) */
export function trainerCount(stageId: StageId): number {
  const { region, index } = regionOf(stageId);
  const fixed = region.stages[index]?.trainers;
  if (fixed !== undefined) return fixed;
  const rng = new Rng(mixSeed(0x7a1e5, REGION_STAGE_IDS.indexOf(stageId) + 1));
  return between(rng, BALANCE.stageTrainers);
}

/** 트레이너 자리 (길 순서) — 스테이지마다 정해짐: 0.12 ~ 0.92 를 고르게 나눈 칸 안에서 조금 흔들어 */
export function trainerSpots(stageId: StageId): number[] {
  const n = trainerCount(stageId);
  const rng = new Rng(mixSeed(0x7a1e6, REGION_STAGE_IDS.indexOf(stageId) + 1));
  const [lo, hi] = TRAINER_RANGE;
  const cell = (hi - lo) / n;
  return Array.from({ length: n }, (_, i) => Math.round((lo + cell * (i + 0.5) + (rng.next() - 0.5) * cell * 0.5) * 100000) / 100000);
}

/** 트레이너가 서는 구간 · 다른 것들이 트레이너와 떨어지는 거리 */
const TRAINER_RANGE = [0.12, 0.92] as const;
const TRAINER_GAP = 0.02;

/** 이긴 트레이너 기록에 쓰는 이름 ("forest-1:t0") */
export function trainerId(stageId: StageId, n: number): string {
  return `${stageId}:t${n}`;
}

function buildLayout(stageId: StageId, seed: number, saved: readonly FacilitySpot[]): StageLayout {
  const rng = new Rng(mixSeed(seed, 0x51a6e));
  const trainers = trainerSpots(stageId);
  // 병원 · 상점 — 중간쯤, 서로 · 트레이너와 붙지 않게 (세이브에 적힌 자리가 있어도 랜덤은 똑같이 뽑아서 아래 자리들이 같게)
  let facilities: FacilitySpot[] = [];
  const [fLo, fHi] = BALANCE.stageFacilityRange;
  const place = (kind: FacilitySpot['kind']) => {
    for (let tries = 0; tries < 20; tries++) {
      const at = fLo + rng.next() * (fHi - fLo);
      if (facilities.every((f) => Math.abs(f.at - at) > 0.05) && trainers.every((t) => Math.abs(t - at) > TRAINER_GAP * 2)) {
        facilities.push({ kind, at: Math.round(at * 10000) / 10000 });
        return;
      }
    }
  };
  for (let i = between(rng, BALANCE.stageHospitals); i > 0; i--) place('hospital');
  for (let i = between(rng, BALANCE.stageShops); i > 0; i--) place('shop');
  // 같은 종류 둘은 앞쪽 하나 · 뒤쪽 하나 (#123) — 다른 랜덤으로 옮겨서 위 뽑기 · 아래 자리들은 그대로
  facilities = [...spreadFacilities(stageId, seed, facilities.sort((a, b) => a.at - b.at))];
  if (saved.length > 0) facilities = [...saved].sort((a, b) => a.at - b.at);

  // 만나는 것 — 고르게 나눈 칸마다 하나 (칸 안에서 조금 흔들어 놓음), 종류는 섞음
  const kinds: SpotKind[] = shuffle(rng, [
    ...Array<SpotKind>(between(rng, BALANCE.stageWild)).fill('wild'),
    ...Array<SpotKind>(between(rng, BALANCE.stageItems)).fill('item'),
    ...Array<SpotKind>(between(rng, BALANCE.stageRequests)).fill('request'),
  ]);
  // 트레이너 앞뒤 (± TRAINER_GAP) 는 길에서 빼고 남은 길이를 고르게 나눔 — 트레이너 곁에 붙지 않고 서로도 붙지 않게
  const [sLo, sHi] = BALANCE.stageSpotRange;
  const holes = trainers.map((t) => [t - TRAINER_GAP, t + TRAINER_GAP] as const);
  const free = sHi - sLo - holes.reduce((sum, [a, b]) => sum + (Math.min(b, sHi) - Math.max(a, sLo)), 0);
  const onTrack = (u: number) => {
    let at = sLo + u;
    for (const [a, b] of holes) if (at > a) at += b - a;
    return at;
  };
  const cell = free / kinds.length;
  const spots: Spot[] = kinds.map((kind, i) => {
    let at = onTrack(cell * (i + 0.5) + (rng.next() - 0.5) * cell * 0.6);
    const near = facilities.find((f) => Math.abs(f.at - at) < FACILITY_GAP);
    if (near) at = near.at + (at >= near.at ? FACILITY_GAP : -FACILITY_GAP);
    return { kind, at: Math.round(at * 100000) / 100000, index: i };
  });
  trainers.forEach((at, n) => spots.push({ kind: 'trainer', at, index: 900 + n, trainer: n }));
  // 라이벌 (gdd 4.12) — 판마다 rivalChance 로 한 자리. 다른 자리는 그대로 두려고 따로 뽑음 (같은 시드의 다른 랜덤)
  const rival = rivalSpotAt(seed, spots, facilities);
  if (rival !== null) spots.push({ kind: 'rival', at: rival, index: 950 });
  spots.sort((a, b) => a.at - b.at);

  const sceneryCount = between(rng, BALANCE.stageScenery);
  const scenery = Array.from({ length: sceneryCount }, (_, i) => ({
    at: Math.round((0.01 + (0.98 * (i + rng.next())) / sceneryCount) * 100000) / 100000,
    index: 1000 + i,
  }));
  return { spots, facilities, scenery };
}

/**
 * 같은 종류 시설 (병원 둘 · 상점 둘) 은 앞쪽 하나 · 뒤쪽 하나 — 사이 stageSameFacilityGap 넘게 (#123 — 태현 님 "이미 첫번에 상점에서 돈을 다 썼는데
 * 두번째 상점이 의미가 있을까" → B 멀리). 붙어 있으면 앞 것은 앞쪽 구간으로 · 뒤 것은 그보다 간격 넘게 뒤로. 다른 종류끼리 · 트레이너와는 지금처럼 떨어짐 (자리가 없으면 가장 덜 붙는 곳).
 * 수 · 종류는 그대로. 시드마다 같은 결과 (따로 뽑는 랜덤 — 길의 다른 자리는 안 바뀜). 세이브에 적힌 옛 자리도 이걸로 고침 (play ensureStage)
 */
export function spreadFacilities(stageId: StageId, seed: number, facilities: readonly FacilitySpot[]): readonly FacilitySpot[] {
  // 붙은 짝이 없으면 받은 목록 그대로 (같은 객체 — 매 걸음 부르는 ensureStage 가 바로 끝남, 코드 리뷰어)
  if (FACILITY_KINDS.every((k) => farEnough(facilities, k))) return facilities;
  const key = `${stageId}:${seed >>> 0}:${facilities.map((f) => `${f.kind}@${f.at}`).join(',')}`;
  const hit = spreadCache.get(key);
  if (hit) return hit;
  const out = spreadNow(stageId, seed, facilities);
  if (spreadCache.size > 16) spreadCache.clear();
  spreadCache.set(key, out);
  return out;
}

const FACILITY_KINDS = ['hospital', 'shop'] as const;
const spreadCache = new Map<string, readonly FacilitySpot[]>();
/** 같은 종류가 붙지 않음 — 둘일 때만 봄 (셋 넘는 손댄 세이브는 그대로) · 소수 넷째 자리로 적어 0.1799 가 되어도 다시 옮기지 않게 반올림만큼 봐 줌 (코드 리뷰어) */
function farEnough(list: readonly FacilitySpot[], kind: FacilitySpot['kind']): boolean {
  const same = list.filter((f) => f.kind === kind);
  return same.length !== 2 || Math.abs(same[1]!.at - same[0]!.at) >= BALANCE.stageSameFacilityGap - 1e-4;
}

function spreadNow(stageId: StageId, seed: number, facilities: readonly FacilitySpot[]): FacilitySpot[] {
  const gap = BALANCE.stageSameFacilityGap;
  const [lo, hi] = BALANCE.stageFacilityRange;
  const front = lo + (hi - lo - gap) / 2;
  const trainers = trainerSpots(stageId);
  const sorted = [...facilities].sort((a, b) => a.at - b.at);
  const kinds = FACILITY_KINDS;
  const pairOf = (list: readonly FacilitySpot[], kind: FacilitySpot['kind']) => list.filter((f) => f.kind === kind);
  const rng = new Rng(mixSeed(seed, 0x5a3e1));
  // 떨어진 정도 (1 넘으면 됨) — 다른 시설 0.05 · 트레이너 TRAINER_GAP × 2 (같은 종류 둘은 뽑을 때 gap 을 지킴)
  const room = (list: readonly FacilitySpot[]) => {
    let r = Infinity;
    list.forEach((f, i) => {
      for (const t of trainers) r = Math.min(r, Math.abs(t - f.at) / (TRAINER_GAP * 2));
      for (const g of list.slice(i + 1)) if (g.kind !== f.kind) r = Math.min(r, Math.abs(g.at - f.at) / 0.05);
    });
    return r;
  };
  const pair = (keep: number | null) => {
    const first = keep ?? lo + rng.next() * (front - lo);
    return [first, first + gap + rng.next() * Math.max(0, hi - first - gap)] as const;
  };
  const at = (x: number) => Math.round(x * 10000) / 10000;
  let best: { list: FacilitySpot[]; room: number } = { list: sorted, room: -1 };
  const tryList = (list: FacilitySpot[]) => {
    const r = room(list);
    if (r > best.room) best = { list: list.map((f) => ({ kind: f.kind, at: at(f.at) })).sort((a, b) => a.at - b.at), room: r };
  };
  // ① 붙은 짝만 앞쪽 하나 · 뒤쪽 하나로 (앞 것이 앞쪽 구간이면 처음엔 그대로) — 다른 시설은 그대로
  for (let i = 0; i < 60 && best.room <= 1; i++) {
    let list = [...sorted];
    for (const k of kinds) {
      const same = pairOf(list, k);
      if (farEnough(list, k)) continue;
      const [a, b] = pair(i < 20 && same[0]!.at <= front ? same[0]!.at : null);
      list = [...list.filter((f) => f.kind !== k), { kind: k, at: a }, { kind: k, at: b }];
    }
    tryList(list);
  }
  // ② 그래도 다른 시설 · 트레이너와 붙으면 이 판 시설을 모두 다시 (수 · 종류 그대로 — 둘인 종류는 앞 · 뒤, 하나는 구간 아무 데나) · 없으면 가장 덜 붙는 것
  for (let i = 0; i < 600 && best.room <= 1; i++) {
    const list: FacilitySpot[] = [];
    for (const k of kinds) {
      const n = pairOf(sorted, k).length;
      if (n === 2) pair(null).forEach((x) => list.push({ kind: k, at: x }));
      else if (n === 1) list.push({ kind: k, at: lo + rng.next() * (hi - lo) });
      else list.push(...pairOf(sorted, k)); // 셋 넘는 손댄 세이브는 그대로 (수 그대로)
    }
    tryList(list);
  }
  return best.list;
}

/**
 * 세이브에 붙어 적힌 옛 시설 자리 고침 (#123) — 고친 목록과 바뀌는 자리 중 가장 앞 (시설 옛 · 새 자리 + 시설 옆으로 밀리거나 라이벌처럼 시설 따라 바뀌는 길 자리 — 코드 리뷰어).
 * 고칠 게 없으면 null. play ensureStage 가 그 자리를 아직 안 지났을 때만 씀
 */
export function facilityFix(stageId: StageId, seed: number, facilities: readonly FacilitySpot[]): { facilities: readonly FacilitySpot[]; firstMoved: number } | null {
  const spread = spreadFacilities(stageId, seed, facilities);
  if (spread === facilities) return null;
  const key = (f: FacilitySpot) => `${f.kind}@${f.at}`;
  const before = new Set(facilities.map(key));
  const after = new Set(spread.map(key));
  const moved = [...facilities.filter((f) => !after.has(key(f))), ...spread.filter((f) => !before.has(key(f)))].map((f) => f.at);
  const oldSpots = new Map(stageLayout(stageId, seed, facilities).spots.map((x) => [x.index, x.at]));
  const newSpots = stageLayout(stageId, seed, spread).spots;
  for (const x of newSpots) {
    const was = oldSpots.get(x.index);
    if (was !== x.at) moved.push(x.at, ...(was === undefined ? [] : [was]));
    oldSpots.delete(x.index);
  }
  moved.push(...oldSpots.values());
  return moved.length > 0 ? { facilities: spread, firstMoved: Math.min(...moved) } : null;
}

/** 라이벌 자리 — 없으면 null. 범위 안에서 다른 자리 · 병원 · 상점과 rivalGap, 트레이너와 TRAINER_GAP 떨어진 곳 (16번 뽑아도 없으면 이 판엔 없음 — 자리가 0.04 쯤마다 있어 거의 다 찾음) */
function rivalSpotAt(seed: number, spots: readonly Spot[], facilities: readonly FacilitySpot[]): number | null {
  const rng = new Rng(mixSeed(seed, 0x51a1));
  if (!rng.chance(BALANCE.rivalChance)) return null;
  const [lo, hi] = BALANCE.rivalSpotRange;
  const taken = [...spots.map((s) => ({ at: s.at, gap: s.kind === 'trainer' ? TRAINER_GAP : BALANCE.rivalGap })), ...facilities.map((f) => ({ at: f.at, gap: BALANCE.rivalGap }))];
  for (let i = 0; i < 16; i++) {
    const at = Math.round((lo + rng.next() * (hi - lo)) * 100000) / 100000;
    if (taken.every((t) => Math.abs(t.at - at) >= t.gap)) return at;
  }
  return null;
}

const cache = new Map<string, StageLayout>();

/** 스테이지 길 (같은 시드면 같은 길 — 자주 부르니 기억해 둠). saved = 세이브에 적힌 병원 · 상점 자리 (없으면 시드로) */
export function stageLayout(stageId: StageId, seed: number, saved: readonly FacilitySpot[] = []): StageLayout {
  const key = `${stageId}:${seed >>> 0}:${saved.map((f) => `${f.kind}@${f.at}`).join(',')}`;
  let layout = cache.get(key);
  if (!layout) {
    layout = buildLayout(stageId, seed >>> 0, saved);
    if (cache.size > 16) cache.clear();
    cache.set(key, layout);
  }
  return layout;
}

/** 이번 걸음에 지나친 첫 자리 (from < at ≤ to) — 없으면 null */
export function spotBetween(layout: StageLayout, from: number, to: number): Spot | null {
  for (const s of layout.spots) {
    if (s.at > to) return null;
    if (s.at > from) return s;
  }
  return null;
}

/** 걸음 하나만큼 나아가는 진행 % */
export function walkDelta(stepMs: number): number {
  return stepMs / BALANCE.stageWalkMs;
}

/** 스테이지 번호 "1-1" (지역 1 = 숲) — 글로만 쓸 때 (이름은 features/stage/model 의 STAGES) */
export function stageCode(id: StageId): string {
  // "몇 번째 지역 - 지역 안 순서" (숲 = 1번째 → 1-1 · 1-2 · 1-3)
  const { region, index } = regionOf(id);
  return `${regionOrder(region.id)}-${index + 1}`;
}

/** 스테이지 레벨대 — 지역 표 · 몇 번째 지역 레벨표 (gdd 5.2 — 숲 k = 1 은 BALANCE.stageLevels 그대로) */
export function stageLevelBand(stageId: StageId): readonly [number, number] {
  const { region, index } = regionOf(stageId);
  return regionLevelBand(regionOrder(region.id), index, stageId);
}
