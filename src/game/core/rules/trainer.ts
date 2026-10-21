/**
 * 트레이너 · 관장 (mvp-spec S08 · 3.9 · 4장) — 누가 어떤 포켓몬을 데리고 나오는지. 시드로 정해서 언제 누가 계산해도 같음.
 *
 * 트레이너: 스테이지마다 2 ~ 3명 (stage.ts trainerCount) · 사람 (칭호 · 이름 · 원작 그림) 은 스테이지 · 번호로 늘 같음 — 숲 9자리가 다 다름, 데리고 나오는 포켓몬은 판마다.
 *   상대 마릿수 1 ~ 3 · 내 살아 있는 포켓몬 수 + 1 까지 (스타팅 1마리일 때 3마리 연속을 막음) · 레벨 = 스테이지 레벨대 가운데 (반올림 — 1-1 Lv 3 · 1-2 Lv 8 · 1-3 Lv 12, 위끝 → 가운데: 2026-10-19 태현 님) · 포켓몬은 숲 보통 목록 (풀 · 벌레만, 노말 · 비행은 안 섞음)
 * 관장: 파라스 Lv 13 · 냄새꼬 Lv 14 · 에이스 버터플 Lv 15 (필살기 게이지 절반 찬 채로 나옴) — 늘 같은 3마리 (다시 도전할 때 공략이 쌓임, gdd 4.7)
 */
import { BALANCE } from '../balance';
import { Rng } from '../engine/rng';
import type { Monster, Save, StageId, Stats } from '../save';
import { formsOfSpecies, learnsetOf, moveOf, speciesOf, type ReadonlyMove } from '../../data';
import { typeNameKo, withJosa } from '../text';
import { effectiveness } from './types';
import { baseTotal, devolveForLevel, evolveForLevel, regionPool } from './encounter';
import { REGIONS, regionGymTeam, regionHere, regionOf, regionOrder, type RegionDef } from './region';
import { createMonster, wildMoves } from './monster';
import { spotRng, stageLevelBand, trainerCount } from './stage';

export interface TrainerInfo {
  /** 이긴 트레이너 기록 이름 ("forest-1:t0") */
  id: string;
  /** "곤충채집 소년 민수" */
  name: string;
  /** 코드로 그린 사람 색 — 모자 · 옷 (그림이 없을 때) */
  hat: string;
  shirt: string;
  /** 사람 그림 (data/people.ts id) */
  look?: string;
}

/** 그림이 없을 때 코드로 그린 사람 색 (decisions 2026-10-17: 트레이너 파랑) */
const TRAINER_HAT = '#2f6ff0';
const TRAINER_SHIRT = '#8cc4ff';
/**
 * 트레이너 자리 — 지역마다 스테이지 3개 × 최대 3명 = 9자리, 칭호 · 원작 그림 (data/people.ts) · 이름이 다 다름 (지역 표 — 2026-10-19 태현 님: 원작 그림 · 한글 이름 · 겹치지 않게).
 * 자리 = 지역 안 앞 스테이지들의 트레이너 수 합 + 트레이너 번호 (숲 1-1 2명 · 1-2 3명 · 1-3 3명 = 8자리, 빈 자리 없이). 이름은 예시.
 */
export const FOREST_TRAINERS = REGIONS.forest.trainers;
/** 그 스테이지 첫 트레이너의 자리 (지역 안) */
export function trainerSlot(stageId: StageId, n: number): number {
  const { region, index } = regionOf(stageId);
  return region.stages.slice(0, index).reduce((sum, s) => sum + trainerCount(s.id), 0) + n;
}

export function trainerInfo(stageId: StageId, n: number): TrainerInfo {
  const slot = trainerSlot(stageId, n);
  const list = regionOf(stageId).region.trainers;
  const t = list[slot % list.length]!;
  return { id: `${stageId}:t${n}`, name: `${t.title} ${t.name}`, hat: TRAINER_HAT, shirt: TRAINER_SHIRT, look: t.look };
}

/** 직함을 뺀 이름 — "엘리트 트레이너 소율" → "소율" · "관장 나래" → "나래" · "라이벌 ○○" → "○○" (좁은 패널의 전투 말 — orders #20) */
export function shortTrainerName(name: string): string {
  const i = name.lastIndexOf(' ');
  return i < 0 ? name : name.slice(i + 1);
}

/** 말 안의 트레이너 이름을 직함 없이 — 조사는 이름 끝 글자가 같아 그대로 맞음 ("엘리트 트레이너 소율은" → "소율은") */
export function withShortFoe(msg: string, foeName: string | null): string {
  if (!foeName) return msg;
  const short = shortTrainerName(foeName);
  return short === foeName ? msg : msg.split(foeName).join(short);
}

/** 트레이너 번호 ("forest-1:t2" → 2) */
export function trainerNumber(id: string): number {
  const m = /:t(\d+)$/.exec(id);
  return m ? Number(m[1]) : 0;
}

/** 팀에서 살아 있는 포켓몬 수 — 트레이너가 데리고 나오는 수의 상한 (+1) */
export function aliveCount(save: Save): number {
  return save.party.filter((uid) => (save.monsters[uid]?.hp ?? 0) > 0).length;
}

/** 그 트레이너가 데리고 나오는 포켓몬 수 (◓ 개수) — 내 살아 있는 포켓몬 + 1 까지 */
export function trainerTeamSize(stageSeed: number, n: number, alive: number): number {
  const [lo, hi] = BALANCE.trainerTeamSize;
  const want = spotRng(stageSeed, 5000 + n, 1).int(lo, hi);
  return Math.max(1, Math.min(want, alive + 1));
}

/** 트레이너 포켓몬 — 숲 목록에서, 레벨 = 그 스테이지 레벨대 가운데 (위끝 → 가운데: 단계 11 시뮬, 2026-10-19 태현 님) (진화 레벨을 넘으면 진화형) */
/** size = 마리 수를 정해서 (3:3 은 늘 3 — 2026-10-21 명세 검사관), 없으면 시드로 1 ~ 3 */
export function trainerTeam(stageId: StageId, stageSeed: number, n: number, alive: number, size?: number): Monster[] {
  // 종족값 아주 큰 포켓몬 (bigBaseTotal 넘음) 은 트레이너가 안 씀 — 야생에서만 드물게 (orders #32 B)
  const big = (dex: number) => { const s = speciesOf(dex); return !!s && baseTotal(s) > BALANCE.bigBaseTotal; };
  const pool = regionPool(stageId).common.filter((dex) => !big(dex));
  const [lo, hi] = stageLevelBand(stageId);
  const level = Math.round((lo + hi) / 2);
  const out: Monster[] = [];
  const count = size ?? trainerTeamSize(stageSeed, n, alive);
  for (let i = 0; i < count; i++) {
    const rng = spotRng(stageSeed, 5000 + n, 10 + i);
    // 그 레벨에 맞는 모습 (아직 될 수 없는 진화형은 진화 전 → 레벨이 되면 진화형, orders #32 A) · 진화해서 아주 커지면 진화 전 그대로
    const base = devolveForLevel(pool[rng.int(0, pool.length - 1)] ?? 10, level);
    const grown = evolveForLevel(base, level, rng);
    const dex = big(grown) ? base : grown;
    out.push(createMonster({ uid: `foe${i}`, dex, level, moves: wildMoves(dex, level, rng), rng, caughtAt: 'trainer' }));
  }
  return out;
}

/** 숲 관장 (지역 표 — 이름은 예시) — 그림은 원작 풀 타입 관장 민화 (2026-10-19), 그림이 없으면 코드로 그린 사람 (금색, decisions 2026-10-17) */
export const GYM_LEADER = REGIONS.forest.leader;
/**
 * S16 대기실 힌트 (2026-10-21 ideas #44) — "관장 나래는 벌레 · 풀 · 독 · 비행 포켓몬을 써요" + 상성이 좋은 내 포켓몬
 * (가진 공격 기술이 관장 포켓몬 셋 중 둘 이상에게 효과가 굉장 — 팀 · 보관함 둘 다, 선두부터)
 */
export function gymHint(save: Save): { text: string; good: string[] } {
  const region = regionHere(save.location);
  const team = regionGymTeam(region, regionOrder(region.id)).map(([dex]) => speciesOf(dex)?.types ?? []);
  const types = [...new Set(team.flat())];
  const good = [...save.party, ...save.box].filter((uid) => {
    const m = save.monsters[uid];
    if (!m) return false;
    const hits = team.filter((t) => m.moves.some((s) => {
      const mv = moveOf(s.moveId);
      return !!mv && mv.power > 0 && effectiveness(mv.type, t) >= 2;
    })).length;
    return hits >= 2;
  });
  return { text: `${withJosa(region.leader.name, '은/는')} ${types.map(typeNameKo).join(' · ')} 포켓몬을 써요`, good };
}

/** 관장 포켓몬 개체값 — 늘 같게 (★4 쯤) */
const LEADER_IVS: Stats = { hp: 20, attack: 20, defense: 20, speed: 20, ultimate: 20 };

/** 관장 기술 — 그 레벨까지 배우는 기술 중 늦게 배우는 것부터 4개 (피해 기술 먼저 — 관장답게) */
function leaderMoves(dex: number, level: number): ReadonlyMove[] {
  const learned: ReadonlyMove[] = [];
  for (const [lv, id] of learnsetOf(dex)) {
    const m = lv >= 1 && lv <= level ? moveOf(id) : undefined;
    if (m && !learned.some((x) => x.id === m.id)) learned.push(m);
  }
  const damage = learned.filter((m) => m.class !== 'status' && m.power > 0).reverse();
  const rest = learned.filter((m) => !damage.includes(m)).reverse();
  return [...damage, ...rest].slice(0, BALANCE.moveSlots);
}

/** 관장 3마리 (마지막 = 에이스) — 지역 표 셋 묶음 · 몇 번째 지역 레벨 (숲 k = 1 = 예전 gymTeam 그대로) */
export function leaderTeam(region: RegionDef = REGIONS.forest): Monster[] {
  return regionGymTeam(region, regionOrder(region.id)).map(([dex, level], i) => {
    const m = createMonster({ uid: `gym${i}`, dex, level, moves: leaderMoves(dex, level), rng: new Rng(0x6e1 + i), caughtAt: 'gym', form: formsOfSpecies(dex)[0] });
    return { ...m, ivs: { ...LEADER_IVS }, hp: 99999 };
  });
}
