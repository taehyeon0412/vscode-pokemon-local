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
  facilities.sort((a, b) => a.at - b.at);
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
