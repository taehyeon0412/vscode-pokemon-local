/**
 * 라이벌 (gdd 4.12 · mvp-spec 3.10, U11 — 2026-10-19 태현 님) — 고르지 않은 주인공 7명이 숲에서 깜짝 승부.
 * 누가 = 가장 덜 만난 라이벌 · 팀 = 만날수록 1 → 3마리, 에이스 = 라이벌마다 파트너 (그린만 내 스타팅에 상성 유리) ·
 * 레벨 = 내 팀 가장 높은 레벨 (나머지는 rivalLevelGap 낮게) · 이기면 돈 1.5배 + 아이템 (처음 = 진화의 돌), 지면 싸우기 전으로 (play.ts).
 * 시드로 정해서 껐다 켜도 같은 상대.
 */
import { BALANCE } from '../balance';
import type { Rng } from '../engine/rng';
import type { ItemId, Monster, Save, StageId } from '../save';
import { HERO_LOOKS, heroLookOf } from '../../data/heroes';
import { speciesOf } from '../../data';
import { STONES } from './bag';
import { evolveForLevel, isBig, regionPool } from './encounter';
import { createMonster, wildMoves } from './monster';
import { spotRng } from './stage';
import { aliveCount } from './trainer';

/** 라이벌마다 파트너 (도감 번호) — 원작 느낌. 그린 (blue) 은 내 스타팅에 상성 유리한 1세대 스타팅 (counterStarter) */
export const RIVAL_PARTNERS: Readonly<Record<string, number>> = {
  boy: 25, // 레드 — 피카츄
  brendan: 252, // 휘웅 — 나무지기
  wally: 280, // 민진 — 랄토스
  girl: 1, // 리프 — 이상해씨
  may: 255, // 지민 — 아차모
  'may-rs': 258, // 봄이 — 물짱이
  'leaf-em': 7, // 리즈 — 꼬부기
};
/** 그린의 둘째 (에이스 바로 앞) — 이브이 */
const BLUE_SECOND = 133;

export interface RivalRecord {
  wins: number;
  losses: number;
}

export function rivalRecord(save: Save, id: string): RivalRecord {
  return save.rivals?.[id] ?? { wins: 0, losses: 0 };
}

/** "라이벌 휘웅" */
export function rivalName(id: string): string {
  return `라이벌 ${heroLookOf(id).label}`;
}

/** "전적 2승 1패" */
export function recordText(r: RivalRecord): string {
  return `전적 ${r.wins}승 ${r.losses}패`;
}

/** 내가 고른 주인공 — 옛 세이브 (look 없음) 는 성별의 첫 캐릭터 */
function myLook(save: Save): string {
  return heroLookOf(save.player?.look, save.player?.gender).id;
}

/** 이번에 나올 라이벌 — 내가 고르지 않은 주인공 중 가장 덜 만난 (이김 + 짐), 같으면 S03 순서. 없으면 null */
export function pickRival(save: Save): string | null {
  const me = myLook(save);
  let best: string | null = null;
  let bestMet = Number.POSITIVE_INFINITY;
  for (const l of HERO_LOOKS) {
    if (l.id === me) continue;
    const r = rivalRecord(save, l.id);
    const met = r.wins + r.losses;
    if (met < bestMet) {
      best = l.id;
      bestMet = met;
    }
  }
  return best;
}

/** 내 스타팅 타입에 유리한 1세대 스타팅 — 풀 → 파이리 · 불꽃 → 꼬부기 · 물 → 이상해씨 (그 밖 → 이브이) */
export function counterStarter(save: Save): number {
  const starter = Object.values(save.monsters).find((m) => m.caughtAt === 'starter') ?? save.monsters[save.party[0] ?? ''];
  const types = starter ? (speciesOf(starter.species)?.types ?? []) : [];
  if (types.includes('grass')) return 4;
  if (types.includes('fire')) return 7;
  if (types.includes('water')) return 1;
  return BLUE_SECOND;
}

/** 라이벌의 에이스 (진화 전 모습) */
export function rivalPartner(save: Save, id: string): number {
  return id === 'blue' ? counterStarter(save) : (RIVAL_PARTNERS[id] ?? 25);
}

/** 내 팀에서 가장 높은 레벨 (살아 있는 포켓몬, 없으면 팀 전체) */
function topLevel(save: Save): number {
  const team = save.party.map((uid) => save.monsters[uid]).filter((m): m is Monster => m !== undefined);
  const alive = team.filter((m) => m.hp > 0);
  return Math.max(2, ...(alive.length > 0 ? alive : team).map((m) => m.level));
}

/** 데리고 나오는 수 — 처음 1마리, 만날 때마다 +1 (최대 3), 내 살아 있는 포켓몬 + 1 까지 */
export function rivalTeamSize(save: Save, id: string): number {
  const r = rivalRecord(save, id);
  return Math.max(1, Math.min(3, r.wins + r.losses + 1, aliveCount(save) + 1));
}

/** 라이벌 팀 — 앞은 숲 포켓몬 (그린은 에이스 앞에 이브이), 맨 끝 = 에이스 (파트너, 진화 레벨을 넘으면 진화형). 시드 = 판 시드 · 만난 수 */
export function rivalTeam(save: Save, id: string, stageId: StageId, stageSeed: number): Monster[] {
  const size = rivalTeamSize(save, id);
  const top = topLevel(save);
  const low = Math.max(2, top - BALANCE.rivalLevelGap);
  const r = rivalRecord(save, id);
  // 강한 1단계 (종족값 450 넘음) 는 야생에서만 — 라이벌 · 트레이너 앞 포켓몬은 거름 (gdd 5.3 · 5.4 — 숲도, orders #60)
  const pool = regionPool(stageId).common.filter((dex) => !isBig(dex));
  const out: Monster[] = [];
  for (let i = 0; i < size; i++) {
    const rng = spotRng(stageSeed, 7000 + r.wins + r.losses, 10 + i);
    const ace = i === size - 1;
    const level = ace ? top : low;
    const blueSecond = id === 'blue' && i === size - 2 && rivalPartner(save, id) !== BLUE_SECOND;
    const base = ace ? rivalPartner(save, id) : blueSecond ? BLUE_SECOND : (pool[rng.int(0, pool.length - 1)] ?? 10);
    const dex = evolveForLevel(base, level, rng);
    out.push(createMonster({ uid: `foe${i}`, dex, level, moves: wildMoves(dex, level, rng), rng, caughtAt: 'trainer' }));
  }
  return out;
}

/** 이기면 받는 아이템 — 그 라이벌을 처음 이기면 진화의 돌 (5종 중), 그 뒤 rivalItems 비율 (stone = 진화의 돌) */
export function rivalItem(save: Save, id: string, rng: Rng): ItemId {
  const stone = () => STONES[rng.int(0, STONES.length - 1)]!;
  if (rivalRecord(save, id).wins === 0) return stone();
  let roll = rng.next();
  for (const [item, p] of Object.entries(BALANCE.rivalItems)) {
    roll -= p;
    if (roll < 0) return item === 'stone' ? stone() : (item as ItemId);
  }
  return 'great-ball';
}

/** 라이벌 한마디 (대사는 gdd 4.12 [아이디어]) — 이기면 결과 둘째 줄 (제목에 "라이벌 ○○" 이 있어 이름만), 지면 머리 위 알림 (명세 문구 그대로). record = 이번 전적을 더한 뒤 */
export function rivalLine(id: string, iWon: boolean, record: RivalRecord): string {
  return iWon ? `${heroLookOf(id).label}: 다음엔 꼭 이길 거야! (${recordText(record)})` : `${rivalName(id)}: 역시 내가 한 수 위지! (${recordText(record)})`;
}

/** 라이벌에게 졌을 때 전투 끝 문구 — "눈앞이 깜깜해졌다" (원작 = 돈 · 병원) 대신, 여기선 잃는 게 없어서 */
export function rivalLoseMsg(id: string): string {
  return `${rivalName(id)}에게 졌다… 연습 경기라 잃은 것은 없다!`;
}

/** 전적 하나 더하기 */
export function withRivalResult(save: Save, id: string, won: boolean): Save {
  const r = rivalRecord(save, id);
  return { ...save, rivals: { ...save.rivals, [id]: won ? { ...r, wins: r.wins + 1 } : { ...r, losses: r.losses + 1 } } };
}
