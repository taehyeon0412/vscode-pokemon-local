/**
 * 트레이너 · 관장 (mvp-spec S08 · 3.9 · 4장) — 누가 어떤 포켓몬을 데리고 나오는지. 시드로 정해서 언제 누가 계산해도 같음.
 *
 * 트레이너: 스테이지마다 2 ~ 3명 (stage.ts trainerCount) · 사람 (이름 · 옷 색) 은 스테이지 · 번호로 늘 같음, 데리고 나오는 포켓몬은 판마다.
 *   상대 마릿수 1 ~ 3 · 내 살아 있는 포켓몬 수 + 1 까지 (스타팅 1마리일 때 3마리 연속을 막음) · 레벨 = 스테이지 레벨대 가운데 (반올림 — 1-1 Lv 3 · 1-2 Lv 8 · 1-3 Lv 12, 위끝 → 가운데: 2026-10-19 태현 님) · 포켓몬은 숲 보통 목록 (풀 · 벌레만, 노말 · 비행은 안 섞음)
 * 관장: 파라스 Lv 13 · 냄새꼬 Lv 14 · 에이스 버터플 Lv 15 (필살기 게이지 절반 찬 채로 나옴) — 늘 같은 3마리 (다시 도전할 때 공략이 쌓임, gdd 4.7)
 */
import { BALANCE } from '../balance';
import { Rng } from '../engine/rng';
import { STAGE_IDS, type Monster, type Save, type StageId, type Stats } from '../save';
import { formsOfSpecies, learnsetOf, moveOf, type ReadonlyMove } from '../../data';
import { evolveForLevel, forestPool } from './encounter';
import { createMonster, wildMoves } from './monster';
import { mixSeed, spotRng, stageLevelBand } from './stage';

export interface TrainerInfo {
  /** 이긴 트레이너 기록 이름 ("forest-1:t0") */
  id: string;
  /** "곤충채집 소년 민수" */
  name: string;
  /** 코드로 그린 사람 색 — 모자 · 옷 */
  hat: string;
  shirt: string;
}

/** 숲의 트레이너 (이름은 예시 — 원작 그림 · 이름 아님). 사람 그림은 주인공과 같은 모양에 파란색 (decisions 2026-10-17: 주인공 빨강 · 트레이너 파랑 · 관장 금색) — 밝은 파랑 모자 · 하늘색 옷 (주인공의 짙은 파랑 옷과 구별) */
const TRAINER_SHIRT = '#8cc4ff';
const CLASSES = [
  { title: '곤충채집 소년', hat: '#2f6ff0', shirt: TRAINER_SHIRT },
  { title: '피크닉 소녀', hat: '#4a8af0', shirt: TRAINER_SHIRT },
  { title: '숲 탐험가', hat: '#3a7ae0', shirt: TRAINER_SHIRT },
  { title: '꽃집 아이', hat: '#6aa0ff', shirt: TRAINER_SHIRT },
  { title: '등산가', hat: '#2a62d8', shirt: TRAINER_SHIRT },
] as const;
const NAMES = ['민수', '지호', '서연', '하은', '도윤', '유나', '현우', '소율', '태오', '다인'] as const;

export function trainerInfo(stageId: StageId, n: number): TrainerInfo {
  const rng = new Rng(mixSeed(0x7e41, (STAGE_IDS.indexOf(stageId) + 1) * 16 + n));
  const c = CLASSES[rng.int(0, CLASSES.length - 1)]!;
  return { id: `${stageId}:t${n}`, name: `${c.title} ${NAMES[rng.int(0, NAMES.length - 1)]}`, hat: c.hat, shirt: c.shirt };
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
export function trainerTeam(stageId: StageId, stageSeed: number, n: number, alive: number): Monster[] {
  const pool = forestPool(stageId).common;
  const [lo, hi] = stageLevelBand(stageId);
  const level = Math.round((lo + hi) / 2);
  const out: Monster[] = [];
  for (let i = 0; i < trainerTeamSize(stageSeed, n, alive); i++) {
    const rng = spotRng(stageSeed, 5000 + n, 10 + i);
    const dex = evolveForLevel(pool[rng.int(0, pool.length - 1)] ?? 10, level, rng);
    out.push(createMonster({ uid: `foe${i}`, dex, level, moves: wildMoves(dex, level, rng), rng, caughtAt: 'trainer' }));
  }
  return out;
}

/** 숲 관장 (이름은 예시, 코드로 그린 사람 — 금색, decisions 2026-10-17) */
export const GYM_LEADER = { name: '관장 나래', title: '숲 체육관 관장', hat: '#9a6f12', shirt: '#e3b341' } as const;
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

/** 숲 관장 3마리 (마지막 = 에이스) */
export function leaderTeam(): Monster[] {
  return BALANCE.gymTeam.map(([dex, level], i) => {
    const m = createMonster({ uid: `gym${i}`, dex, level, moves: leaderMoves(dex, level), rng: new Rng(0x6e1 + i), caughtAt: 'gym', form: formsOfSpecies(dex)[0] });
    return { ...m, ivs: { ...LEADER_IVS }, hp: 99999 };
  });
}
