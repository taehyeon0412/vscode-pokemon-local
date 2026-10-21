/**
 * 3:3 실시간 팀 배틀 (다음 버전 5단계 — gdd 4.7 끝 「3:3 실시간 팀 배틀」, 2026-10-21 orders #17).
 *   메뉴 없이 6마리가 스피드대로 게이지가 차면 AI 가 기술을 고름 (겹쳐도 바로 — 일반 공격은 쓸 기술이 없을 때만 · PP 안 닳음 · 변화 기술은 가끔).
 *   내가 하는 것 = 필살기 (1 · 2 · 3 · Z) · 상대 필살기에 끼어들기 (1:2 · 2:3 …, 연타). 쏘는 기술끼리 엇갈리면 기술 힘겨루기 (1.5초 자동, 1:1).
 *   필살기 · 필살기 힘겨루기 동안 나머지는 멈춤 · 기술 힘겨루기 동안은 계속 싸움. 패링 · 아이템 · 교체 · 도망 없음 · 쓰러지면 빠짐.
 * 화면 자리 · 거리는 모름 (화면이 정함 — 모양은 디자인팀이 아직 정하는 중). 계산은 화면과 떼어 둠.
 */
import { BALANCE, TIMING } from '../balance';
import { canInflict, clashChance, clashWithTaps, computeDamage, fighterOf, isShooting, streakMultiplier, ultGain, type Fighter } from '../rules/battle';
import { effectiveness } from '../rules/types';
import type { Monster, Save } from '../save';
import { withJosa } from '../text';
import { moveOf, speciesOf, type ReadonlyMove } from '../../data';
import { okFighter, POPUP_KINDS, POPUP_MS, type BattlePopup, type Side } from './battle';
import type { Rng } from './rng';

/** 날아가는 기술 하나 — 겹쳐도 바로 나감 */
export interface TeamShot {
  id: number;
  side: Side;
  /** 쓴 포켓몬 (그쪽 칸 번호) */
  from: number;
  /** 맞을 상대 칸 — 범위 기술이면 여럿 */
  targets: number[];
  moveId: number;
  ms: number;
  dur: number;
  /** 닿는 때 (ms) */
  hitMs: number;
  hit: boolean;
  shooting: boolean;
  /** 기술 힘겨루기에 들어감 (한 기술은 한 번만) — 그동안 멈춤 */
  clash: boolean;
  /** 연달아 세지는 기술 배율 (쏠 때 정함, 1:1 과 같음) */
  boost?: number;
}

/** 힘겨루기 — 기술 (1:1, 자동) · 필살기 (끼어든 마리 수만큼, 연타) */
export interface TeamClash {
  kind: 'move' | 'ult';
  me: number[];
  foe: number[];
  /** 기술 힘겨루기의 두 기술 (shot id) */
  shots: [number, number] | null;
  ms: number;
  dur: number;
  taps: number;
  winner: Side | null;
  /** 필살기 힘겨루기에 상대가 합류할 칸 · 때 (시작할 때 마리마다 한 번 정함 — 명세 검사관: 걸음마다 굴리면 30% · 70% 가 26% · 50% 로 줄었음) */
  foeJoin?: { slot: number; at: number }[];
}

/** 필살기 하나 (나머지는 멈춤) — window = 끼어들 수 있는 남은 ms */
export interface TeamUlt {
  side: Side;
  from: number;
  ms: number;
  dur: number;
  hitMs: number;
  hit: boolean;
  window: number;
  /** 상대 AI 가 끼어들 때 (ms, null = 안 끼어듦) · 끼어들 포켓몬 */
  joinAt: number | null;
  joiners: number[];
}

export type TeamPopup = BattlePopup & { slot: number };

/**
 * 연출 다리 — 3:3 에서 일어난 일 (번호순, 마지막 TEAM_LOG_MAX 개). 화면 · 연출은 본 번호 뒤 것만 그림 (여러 걸음을 한 번에 그려도 안 놓침 · 다시 붙으면 옛것은 안 그림).
 * 모양은 디자인팀 · 이 기록과 features/battle/fx/team.ts (계획 · 실행) 는 개발팀 (2026-10-21 orders #17 준비)
 */
export type TeamNote =
  /** 기술을 쏨 (moveId 0 = 1 공격) — shot = TeamShot.id */
  | { t: 'shoot'; shot: number; side: Side; from: number; targets: number[]; moveId: number }
  /** 맞음 — 기술 · 1 공격 (moveId 0) · 필살기 (ult, moveId −1). effect = 팝업 종류 (super · weak · immune · crit · damage) · ko = 이 한 방에 쓰러짐 */
  | { t: 'hit'; side: Side; from: number; to: number; moveId: number; ult: boolean; effect: BattlePopup['kind']; dmg: number; ko: boolean }
  | { t: 'miss'; side: Side; from: number; to: number; moveId: number }
  /** 쏜 포켓몬이 쓰러져 날아가던 기술이 사라짐 */
  | { t: 'stop'; shot: number }
  /** 기술 힘겨루기 시작 (두 기술이 멈춤) · 끝 */
  | { t: 'clash'; shots: [number, number]; me: number; foe: number }
  | { t: 'clash-end'; shots: [number, number]; me: number; foe: number; winner: Side }
  | { t: 'ult'; side: Side; from: number }
  | { t: 'ult-clash'; me: number[]; foe: number[] }
  | { t: 'ult-join'; side: Side; slot: number }
  /** sure = 3:1 (셋 쪽이 압도) · me · foe = 끝날 때 참가자 (여럿이면 합동 마무리) */
  | { t: 'ult-clash-end'; winner: Side; sure: boolean; me: number[]; foe: number[] }
  | { t: 'faint'; side: Side; slot: number }
  | { t: 'status'; side: Side; slot: number; kind: 'poison' | 'burn' | 'paralysis' | 'sleep' }
  /** 필살기 게이지가 다 참 */
  | { t: 'ready'; side: Side; slot: number }
  /** 끝 — 같은 묶음의 마지막 ko 한 방이 마무리 (크게 · 짧게 느리게) */
  | { t: 'end'; result: 'win' | 'lose' };
/** id = 번호 · at = 판 시각 (b.t) — 화면이 다시 붙었을 때 지난 일을 몰아 그리지 않게 */
export type TeamLogEntry = TeamNote & { id: number; at: number };
export const TEAM_LOG_MAX = 32;

export interface TeamBattle {
  kind: 'trainer' | 'gym';
  foeName: string;
  me: Fighter[];
  foe: Fighter[];
  phase: 'run' | 'ult' | 'clash' | 'over';
  shots: TeamShot[];
  /** 기술 힘겨루기 (여럿이 동시에 — 다른 포켓몬은 계속 싸움) */
  moveClashes: TeamClash[];
  ult: TeamUlt | null;
  /** 필살기 힘겨루기 (나머지 멈춤) */
  clash: TeamClash | null;
  /** 상대 필살기 기다림 (칸마다 남은 ms, null = 안 기다림) */
  foeUltWait: (number | null)[];
  /** 필살기 게이지가 꽉 찬 때 (t) — Z = 먼저 찬 포켓몬 */
  ultReadyAt: { me: (number | null)[]; foe: (number | null)[] };
  result: 'win' | 'lose' | null;
  overMs: number;
  foeDown: { species: number; level: number }[];
  fought: string[];
  popups: TeamPopup[];
  popupSeq: number;
  seq: number;
  t: number;
  msg: string;
  /** 필살기 예약 (내 칸) — 게이지가 차는 중에 그 칸을 누르면 예약 · 다시 누르면 취소 → 차는 순간 씀 (끼어들기 창 · 힘겨루기 합류도 바로, 2026-10-21 태현 님 ①) */
  reserve: number[];
  /** 연출 다리 — 일어난 일 (TeamNote) 과 마지막 번호 */
  log: TeamLogEntry[];
  logSeq: number;
}

export interface TeamStepOptions {
  /** 자동 전투 — 내 필살기도 차면 바로 · 상대 필살기에 늘 끼어듦 */
  auto: boolean;
  /** 안 볼 때 (확장이 계산) — 자동 전투와 같게 */
  away: boolean;
}

export type TeamInput =
  /** 1 · 2 · 3 = 그 칸 · 없으면 Z (먼저 찬 포켓몬) — 쓰기 · 상대 필살기에 끼어들기 · 힘겨루기에 합류 */
  | { kind: 'ult'; slot?: number }
  /** Space · 클릭 — 필살기 힘겨루기 연타 */
  | { kind: 'space' };

/**
 * 범위 기술 — 원작 대상이 상대 모두 · 나 빼고 모두 (PokeAPI 데이터 spread — 손 목록 대신, 2026-10-21 기획).
 * 피해는 상대 모두에게 0.75배 · 변화 기술 (독가스 등) 은 상대 모두에게 걸기를 굴림
 */
export const isSpread = (mv: ReadonlyMove | undefined): boolean => mv?.spread === true;

/** 1 공격 (위력 30 · 타입 없음) — 쓸 기술이 없거나 (단데기 · 딱충이) 다 효과가 없을 때만 (shot.moveId 0) */
export const TEAM_BASIC = 0;

const alive = (f: Fighter) => f.hp > 0;
const other = (s: Side): Side => (s === 'me' ? 'foe' : 'me');
const nameOf = (f: Fighter) => speciesOf(f.species)?.name.ko ?? f.form;

// ---------- 시작

/** 3:3 을 할 수 있는지 — 살아 있는 내 포켓몬 3마리 이상 (gdd: 3마리 미만이면 1:1) */
export function teamPossible(save: Save): boolean {
  return save.party.filter((uid) => (save.monsters[uid]?.hp ?? 0) > 0).length >= BALANCE.team.size;
}

/** 나갈 3마리 — 상대 팀에 효과가 굉장한 기술이 많은 순 (같으면 레벨 높은 쪽) · 자동 전투 · 고르지 않았을 때. n = 몇 마리까지 (순위 전체는 Infinity) */
export function pickTeam(save: Save, foes: readonly Monster[], n: number = BALANCE.team.size): string[] {
  const foeTypes = foes.map((m) => speciesOf(m.species)?.types ?? []);
  const score = (m: Monster) =>
    foeTypes.reduce((sum, t) => sum + Math.max(1, ...m.moves.map((s) => moveOf(s.moveId)).filter((mv): mv is ReadonlyMove => !!mv && mv.power > 0).map((mv) => effectiveness(mv.type, t))), 0);
  return save.party
    .map((uid) => save.monsters[uid])
    .filter((m): m is Monster => !!m && m.hp > 0)
    .sort((a, b) => score(b) - score(a) || b.level - a.level)
    .slice(0, n)
    .map((m) => m.uid);
}

/** 3:3 시작 — uids = 내가 고른 3마리 (없으면 pickTeam) · 상대는 받은 팀 앞에서 3마리 */
export function startTeamBattle(save: Save, foes: readonly Monster[], kind: 'trainer' | 'gym', foeName: string, uids?: readonly string[]): TeamBattle {
  const mine = (uids ?? pickTeam(save, foes)).map((uid) => save.monsters[uid]).filter((m): m is Monster => !!m && m.hp > 0).slice(0, BALANCE.team.size);
  const me = mine.map((m) => fighterOf(m));
  const foe = foes.slice(0, BALANCE.team.size).map((m) => fighterOf({ ...m, hp: 1e6 }));
  // 관장 에이스 (마지막) 는 필살기 게이지 절반에서 시작 (1:1 과 같음 — gdd S16 ①)
  if (kind === 'gym' && foe.length > 0) foe[foe.length - 1]!.ult = BALANCE.gymAceUlt;
  return {
    kind,
    foeName,
    me,
    foe,
    phase: 'run',
    shots: [],
    moveClashes: [],
    ult: null,
    clash: null,
    foeUltWait: foe.map(() => null),
    ultReadyAt: { me: me.map(() => null), foe: foe.map(() => null) },
    result: null,
    overMs: 0,
    foeDown: [],
    fought: me.map((f) => f.uid),
    popups: [],
    popupSeq: 0,
    seq: 0,
    t: 0,
    msg: `${withJosa(foeName, '과/와')}의 3:3 승부!`,
    reserve: [],
    log: [],
    logSeq: 0,
  };
}

// ---------- 계산 도구

function clone(b: TeamBattle): TeamBattle {
  return {
    ...b,
    me: b.me.map((f) => ({ ...f })),
    foe: b.foe.map((f) => ({ ...f })),
    shots: b.shots.map((s) => ({ ...s })),
    moveClashes: b.moveClashes.map((c) => ({ ...c })),
    ult: b.ult ? { ...b.ult, joiners: [...b.ult.joiners] } : null,
    clash: b.clash ? { ...b.clash, me: [...b.clash.me], foe: [...b.clash.foe] } : null,
    foeUltWait: [...b.foeUltWait],
    ultReadyAt: { me: [...b.ultReadyAt.me], foe: [...b.ultReadyAt.foe] },
    popups: [...b.popups],
    foeDown: [...b.foeDown],
    reserve: [...b.reserve],
    log: [...b.log],
  };
}

/** 연출 다리에 하나 적음 (기록 하나하나는 바꾸지 않음 — 앞 상태와 같이 씀) */
function note(b: TeamBattle, n: TeamNote): void {
  b.logSeq += 1;
  b.log = [...b.log.slice(-(TEAM_LOG_MAX - 1)), { ...n, id: b.logSeq, at: b.t }];
}

function popup(b: TeamBattle, side: Side, slot: number, text: string, kind: BattlePopup['kind']): void {
  b.popupSeq += 1;
  b.popups = [...b.popups.slice(-11), { id: b.popupSeq, side, slot, text, ms: 0, kind }];
}

/** 행동 게이지 빠르기 — 가장 느린 포켓몬 (살아 있는 6마리 중) 이 gaugeMs 에 한 번, 빠르면 스피드 비율대로 최대 2배 · 마비면 절반 */
function gaugeRate(b: TeamBattle, f: Fighter): number {
  const slow = Math.max(1, Math.min(...[...b.me, ...b.foe].filter(alive).map((x) => x.stats.speed)));
  const ratio = Math.min(BALANCE.maxSpeedRatio, Math.max(1, f.stats.speed / slow));
  const para = f.status?.kind === 'paralysis' ? BALANCE.paralysisGaugeScale : 1;
  return (ratio * para) / (BALANCE.gaugeMs * BALANCE.team.gaugeScale);
}

/** 필살기를 씀 — 게이지 · 찬 때 · 상대 기다림을 같이 지움 (끼어들기 · 합류 뒤에 남은 기다림이 다음에 쓰이지 않게 — 코드 리뷰어) */
function spendUlt(b: TeamBattle, side: Side, slot: number): void {
  b[side][slot]!.ult = 0;
  b.ultReadyAt[side][slot] = null;
  if (side === 'foe') b.foeUltWait[slot] = null;
  else b.reserve = b.reserve.filter((i) => i !== slot);
}

function gainUlt(b: TeamBattle, side: Side, slot: number, kind: 'hit' | 'hurt'): void {
  const f = b[side][slot]!;
  if (!alive(f) || f.ult >= 1) return;
  f.ult = Math.min(1, f.ult + ultGain(kind, f) * BALANCE.team.ultGainScale);
  if (f.ult >= 1) {
    b.ultReadyAt[side][slot] = b.t;
    note(b, { t: 'ready', side, slot });
  }
}

/** 맞을 상대 — 그 기술 상성이 가장 좋은 상대 (같으면 HP 비율이 낮은 쪽) */
function bestTarget(foes: readonly Fighter[], mv: ReadonlyMove | null): number | null {
  let best: number | null = null;
  for (let i = 0; i < foes.length; i++) {
    const f = foes[i]!;
    if (!alive(f)) continue;
    if (best === null) {
      best = i;
      continue;
    }
    const b = foes[best]!;
    const ef = mv ? effectiveness(mv.type, f.types) : 1;
    const eb = mv ? effectiveness(mv.type, b.types) : 1;
    if (ef > eb || (ef === eb && f.hp / f.maxHp < b.hp / b.maxHp)) best = i;
  }
  return best;
}

/**
 * AI — 자동 전투 총점수 그대로 (피해 기술 = 위력 ÷ 40 × 상성² × 같은 타입 1.5 — 상성은 가장 좋은 상대에게) · 일반 공격 없음 · PP 안 봄 ·
 * 변화 기술 = 0.3 (걸 수 있는 상대가 있을 때만 — 독 타입에 독가루 X) · 상대 모두에게 효과 없는 기술 = 0.
 * 쓸 기술이 없으면 1 공격 (끝나지 않는 판을 막음 — 코드 리뷰어) · 살아 있는 상대가 없으면 null
 */
export function teamPick(self: Fighter, foes: readonly Fighter[], rng: Rng): { moveId: number; targets: number[] } | null {
  const moves = self.moves.map((s) => moveOf(s.moveId)).filter((mv): mv is ReadonlyMove => !!mv);
  const living = foes.map((f, i) => (alive(f) ? i : -1)).filter((i) => i >= 0);
  if (living.length === 0) return null;
  const canAil = (mv: ReadonlyMove, i: number) => !foes[i]!.status && !!mv.ailment && canInflict(mv.ailment, mv.type, foes[i]!.types);
  const weights = moves.map((mv) => {
    if (mv.class === 'status' || mv.power <= 0) return living.some((i) => canAil(mv, i)) ? BALANCE.team.statusWeight : 0;
    const t = bestTarget(foes, mv);
    const eff = t === null ? 1 : effectiveness(mv.type, foes[t]!.types);
    if (eff === 0) return 0;
    const stab = self.types.includes(mv.type) ? 1.5 : 1;
    return Math.max(0.1, (mv.power / 40) * eff * eff * stab);
  });
  const total = weights.reduce((a, w) => a + w, 0);
  if (total <= 0) return { moveId: TEAM_BASIC, targets: [bestTarget(foes, null)!] };
  let r = rng.next() * total;
  let pick = moves[moves.length - 1]!;
  for (let i = 0; i < moves.length; i++) {
    r -= weights[i]!;
    if (r < 0) {
      pick = moves[i]!;
      break;
    }
  }
  if (isSpread(pick)) return { moveId: pick.id, targets: living };
  const target = pick.class === 'status' || pick.power <= 0 ? (living.find((i) => canAil(pick, i)) ?? living[0]!) : bestTarget(foes, pick)!;
  return { moveId: pick.id, targets: [target] };
}

/** 피해 하나 (3:3 피해 배율 · 범위 0.75) — 쓰러지면 빠짐 */
function damage(b: TeamBattle, side: Side, from: number, to: number, power: number, type: ReadonlyMove['type'] | null, rng: Rng, useUlt: boolean, scale = 1, move?: ReadonlyMove): void {
  const a = b[side][from]!;
  const d = b[other(side)][to]!;
  if (!alive(d)) return;
  const r = computeDamage({ attacker: a, defender: d, power: Math.max(1, Math.round(power * scale)), type, useUlt, rng });
  // 3:3 피해 배율은 마지막 피해에 (위력에 곱하면 식의 +2 가 남아 한 판 길이가 배율대로 안 늘어남)
  let dmg = r.effect === 0 ? 0 : Math.max(1, Math.round(r.damage * BALANCE.team.damageScale));
  if (move?.effect === 'leave-1hp') dmg = Math.min(dmg, Math.max(0, d.hp - 1));
  // 실제로 깎인 HP 로 (흡수 · 반동도 이 값 — 1:1 과 같음)
  const before = d.hp;
  d.hp = Math.max(0, d.hp - dmg);
  dmg = before - d.hp;
  const effect = r.crit ? 'crit' : r.effect > 1 ? 'super' : r.effect < 1 ? (r.effect === 0 ? 'immune' : 'weak') : 'damage';
  popup(b, other(side), to, `-${dmg}`, effect);
  note(b, { t: 'hit', side, from, to, moveId: useUlt ? -1 : (move?.id ?? TEAM_BASIC), ult: useUlt, effect, dmg, ko: d.hp <= 0 });
  // 필살기 게이지 — 피해가 있을 때만 · 때린 쪽 (필살기 빼고) · 맞은 쪽 (필살기에 맞아도 참 — 1:1 과 같음)
  if (dmg > 0) {
    if (!useUlt) gainUlt(b, side, from, 'hit');
    gainUlt(b, other(side), to, 'hurt');
  }
  // 흡수 (+) · 반동 (−)
  if (move && move.drain !== 0 && dmg > 0) {
    const amount = Math.floor((dmg * Math.abs(move.drain)) / 100);
    if (move.drain > 0) {
      a.hp = Math.min(a.maxHp, a.hp + amount);
      if (amount > 0) popup(b, side, from, `+${amount}`, 'heal');
    } else if (amount > 0) {
      a.hp = Math.max(0, a.hp - amount);
      popup(b, side, from, `-${amount}`, 'damage');
      if (a.hp <= 0) faint(b, side, from);
    }
  }
  if (d.hp <= 0) faint(b, other(side), to);
}

function faint(b: TeamBattle, side: Side, slot: number): void {
  const f = b[side][slot]!;
  f.gauge = 0;
  popup(b, side, slot, `${nameOf(f)} 쓰러졌다!`, 'info');
  note(b, { t: 'faint', side, slot });
  if (side === 'foe') b.foeDown = [...b.foeDown, { species: f.species, level: f.level }];
  else b.reserve = b.reserve.filter((i) => i !== slot);
  b.ultReadyAt[side][slot] = null;
}

/** 독 · 화상 — 행동할 때마다 (1:1 과 같음) */
function tick(b: TeamBattle, side: Side, slot: number): void {
  const f = b[side][slot]!;
  if (!alive(f) || !f.status) return;
  const part = f.status.kind === 'poison' ? BALANCE.poisonDamage : f.status.kind === 'burn' ? BALANCE.burnDamage : 0;
  if (part <= 0) return;
  const dmg = Math.max(1, Math.floor(f.maxHp * part));
  f.hp = Math.max(0, f.hp - dmg);
  popup(b, side, slot, `-${dmg}`, 'damage');
  if (f.hp <= 0) faint(b, side, slot);
}

/** 기술이 닿음 — 명중 · 피해 · 상태 이상 (맞을 상대가 그사이 쓰러졌으면 다른 상대로) */
function land(b: TeamBattle, s: TeamShot, rng: Rng): void {
  const foes = b[other(s.side)];
  if (s.moveId === TEAM_BASIC) {
    const t = alive(foes[s.targets[0]!]!) ? s.targets[0]! : bestTarget(foes, null);
    if (t !== null) damage(b, s.side, s.from, t, BALANCE.attackPower, null, rng, false);
    return;
  }
  const mv = moveOf(s.moveId);
  if (!mv) return;
  const targets = s.targets.length > 1 ? s.targets.filter((i) => alive(foes[i]!)) : [alive(foes[s.targets[0]!]!) ? s.targets[0]! : bestTarget(foes, mv)].filter((i): i is number => i !== null);
  const spread = targets.length > 1 ? BALANCE.team.spreadScale : 1;
  for (const t of targets) {
    if (mv.accuracy !== null && !rng.chance(mv.accuracy / 100)) {
      popup(b, other(s.side), t, '빗나갔다!', 'miss');
      note(b, { t: 'miss', side: s.side, from: s.from, to: t, moveId: s.moveId });
      continue;
    }
    if (mv.class !== 'status' && mv.power > 0) damage(b, s.side, s.from, t, Math.round(mv.power * (s.boost ?? 1)), mv.type, rng, false, spread, mv);
    const d = foes[t]!;
    if (mv.ailment && alive(d) && !d.status && canInflict(mv.ailment, mv.type, d.types) && rng.chance(mv.ailmentChance / 100)) {
      const [lo, hi] = BALANCE.sleepTurns;
      d.status = mv.ailment === 'sleep' ? { kind: 'sleep', turnsLeft: rng.int(lo, hi) } : { kind: mv.ailment };
      popup(b, other(s.side), t, { poison: '독에 걸렸다!', burn: '화상을 입었다!', paralysis: '마비되었다!', sleep: '잠들었다!' }[mv.ailment], 'status');
      note(b, { t: 'status', side: other(s.side), slot: t, kind: mv.ailment });
    }
  }
}

/** 한 포켓몬 행동 — 잠듦이면 쉼 · 아니면 AI 가 고른 기술을 바로 쏨 (겹쳐도) */
function act(b: TeamBattle, side: Side, slot: number, rng: Rng): void {
  const f = b[side][slot]!;
  f.gauge = 0;
  if (f.status?.kind === 'sleep') {
    const left = f.status.turnsLeft - 1;
    f.status = left > 0 ? { kind: 'sleep', turnsLeft: left } : null;
    popup(b, side, slot, left > 0 ? '쿨쿨 잠들어 있다' : '잠에서 깼다!', 'info');
    return;
  }
  // 마비 — 가끔 못 움직임 (1:1 과 같음)
  if (f.status?.kind === 'paralysis' && rng.chance(BALANCE.paralysisSkip)) {
    popup(b, side, slot, '몸이 저려 움직일 수 없다!', 'info');
    return;
  }
  const pick = teamPick(f, b[other(side)], rng);
  if (!pick) return;
  const mv = moveOf(pick.moveId);
  // 연달아 세지는 기술 — 같은 기술을 또 쓰면 +1, 다른 기술이면 처음부터 (1:1 과 같음)
  if (mv?.streak && f.streakMove === mv.id) f.streakCount += 1;
  else {
    f.streakMove = mv?.streak ? mv.id : null;
    f.streakCount = 0;
  }
  b.seq += 1;
  const dur = TIMING.team.moveMs;
  b.shots = [...b.shots, { id: b.seq, side, from: slot, targets: pick.targets, moveId: pick.moveId, ms: 0, dur, hitMs: Math.round(dur * 0.7), hit: false, shooting: isShooting(mv), clash: false, ...(mv?.streak ? { boost: streakMultiplier(f.streakCount) } : {}) }];
  note(b, { t: 'shoot', shot: b.seq, side, from: slot, targets: [...pick.targets], moveId: pick.moveId });
  tick(b, side, slot);
}

/** 쏘는 기술끼리 엇갈림 — 둘 다 날아가는 중 (쏜 뒤 · 닿기 전) 이고 아직 힘겨루기를 안 한 반대편 기술 */
function findMoveClash(b: TeamBattle): [TeamShot, TeamShot] | null {
  const flying = (s: TeamShot) => s.shooting && !s.clash && !s.hit && s.ms >= s.dur * 0.15 && s.ms < s.hitMs && alive(b[s.side][s.from]!);
  for (const a of b.shots) {
    if (a.side !== 'me' || !flying(a)) continue;
    const c = b.shots.find((x) => x.side === 'foe' && flying(x));
    if (c) return [a, c];
  }
  return null;
}

/** 기술 힘겨루기 끝 — 센 쪽 (공격 × 위력) 50 ~ 80% · 진 기술을 쓴 포켓몬이 이긴 기술 피해 */
function endMoveClash(b: TeamBattle, c: TeamClash, rng: Rng): void {
  const [aId, fId] = c.shots!;
  const a = b.shots.find((s) => s.id === aId);
  const f = b.shots.find((s) => s.id === fId);
  b.shots = b.shots.filter((s) => s.id !== aId && s.id !== fId);
  if (!a || !f) return;
  const am = moveOf(a.moveId);
  const fm = moveOf(f.moveId);
  const pa = b.me[a.from]!.stats.attack * (am?.power ?? 1);
  const pf = b.foe[f.from]!.stats.attack * (fm?.power ?? 1);
  const meWins = rng.chance(clashChance(pa, pf));
  c.winner = meWins ? 'me' : 'foe';
  note(b, { t: 'clash-end', shots: [aId, fId], me: a.from, foe: f.from, winner: c.winner });
  const win = meWins ? a : f;
  const lose = meWins ? f : a;
  const wm = moveOf(win.moveId);
  if (wm && alive(b[win.side][win.from]!)) damage(b, win.side, win.from, lose.from, Math.round(wm.power * (win.boost ?? 1)), wm.type, rng, false, 1, wm);
}

/** 필살기 쓰기 — 나머지는 멈춤 · 끼어들 수 있는 창 (상대 AI 는 시작할 때 정함) */
function startUlt(b: TeamBattle, side: Side, slot: number, rng: Rng): void {
  const f = b[side][slot]!;
  spendUlt(b, side, slot);
  const window = TIMING.team.interruptMs;
  const foes = b[other(side)];
  // 상대 AI 끼어들기 — 내 필살기에 (트레이너 가끔 · 관장 자주)
  const chance = side === 'me' ? BALANCE.team.interruptChance[b.kind] : 0;
  const joiners = foes.map((x, i) => (alive(x) && x.ult >= 1 && rng.chance(chance) ? i : -1)).filter((i) => i >= 0);
  b.phase = 'ult';
  note(b, { t: 'ult', side, from: slot });
  b.ult = { side, from: slot, ms: 0, dur: TIMING.ultAnimMs, hitMs: Math.round(TIMING.ultAnimMs * 0.6), hit: false, window, joinAt: joiners.length ? rng.int(200, window - 100) : null, joiners };
  b.msg = `${nameOf(f)}의 필살기!`;
}

/** 필살기 힘겨루기 시작 — 쓴 쪽 + 끼어든 쪽 (그 뒤에도 합류) */
function startUltClash(b: TeamBattle, joinSide: Side, joiners: number[], rng: Rng): void {
  const u = b.ult!;
  for (const i of joiners) spendUlt(b, joinSide, i);
  const me = u.side === 'me' ? [u.from] : joiners;
  const foe = u.side === 'foe' ? [u.from] : joiners;
  b.phase = 'clash';
  const dur = TIMING.team.ultClashMs;
  // 힘겨루기 동안 상대가 합류 — 찬 포켓몬마다 한 번 굴려 합류할 때를 정함 (트레이너 가끔 · 관장 자주)
  const foeJoin = b.foe
    .map((f, i) => ({ f, i }))
    .filter(({ f, i }) => alive(f) && f.ult >= 1 && !foe.includes(i) && rng.chance(BALANCE.team.interruptChance[b.kind]))
    .map(({ i }) => ({ slot: i, at: rng.int(200, dur - 300) }));
  b.clash = { kind: 'ult', me: [...me], foe: [...foe], shots: null, ms: 0, dur, taps: 0, winner: null, foeJoin };
  note(b, { t: 'ult-clash', me: [...me], foe: [...foe] });
  b.ult = null;
  b.msg = me.length === foe.length ? '필살기 힘겨루기!' : `필살기 힘겨루기! ${me.length}:${foe.length}`;
}

/**
 * 3:1 필살기 힘겨루기 = 셋 쪽이 100% 이김 (2026-10-17 · 10-21 태현 님 "추천안대로") — 화면은 나 1 : 상대 3 이면 "1:3 — 질 거예요" 를 띄움.
 * 2:1 · 3:2 처럼 덜 모인 경우는 null (필살 합 + 연타)
 */
export function teamClashSure(c: Pick<TeamClash, 'me' | 'foe'>): Side | null {
  const n = BALANCE.team.size;
  if (c.me.length >= n && c.foe.length === 1) return 'me';
  if (c.foe.length >= n && c.me.length === 1) return 'foe';
  return null;
}

/** 필살기 힘겨루기 끝 — 3:1 이면 셋 쪽 · 아니면 합류한 필살 스탯의 합 · 연타 · 진 쪽 참가자 모두 피해 = 이긴 쪽 참가자마다 자기 필살기 (합류한 위력을 다 더함 — gdd 4.7) */
function endUltClash(b: TeamBattle, rng: Rng): void {
  const c = b.clash!;
  const sum = (side: Side, list: number[]) => list.reduce((s, i) => s + b[side][i]!.stats.ultimate, 0);
  const sure = teamClashSure(c);
  const meWins = sure ? sure === 'me' : rng.chance(clashWithTaps(clashChance(sum('me', c.me), sum('foe', c.foe)), c.taps));
  note(b, { t: 'ult-clash-end', winner: meWins ? 'me' : 'foe', sure: sure !== null, me: [...c.me], foe: [...c.foe] });
  c.winner = meWins ? 'me' : 'foe';
  const winSide: Side = meWins ? 'me' : 'foe';
  const winners = meWins ? c.me : c.foe;
  const losers = meWins ? c.foe : c.me;
  for (const w of winners) {
    if (!alive(b[winSide][w]!)) continue;
    for (const t of losers) damage(b, winSide, w, t, BALANCE.ultPower, b[winSide][w]!.types[0] ?? null, rng, true);
  }
  b.msg = meWins ? '힘겨루기에서 이겼다!' : '힘겨루기에서 졌다…';
  b.clash = null;
  b.phase = 'run';
}

/** HP 비율 (쓰러진 포켓몬 포함 셋 모두) */
const hpShare = (list: readonly Fighter[]) => list.reduce((s, f) => s + f.hp, 0) / Math.max(1, list.reduce((s, f) => s + f.maxHp, 0));

/** 끝 — 한쪽이 다 쓰러짐 (둘 다면 짐 — 반동으로 "이겼는데 팀 전멸" 이 없게) · timeUp = 판 상한이 지나면 남은 HP 비율로 */
function checkEnd(b: TeamBattle, timeUp = false): void {
  if (b.phase === 'over') return;
  const meLeft = b.me.some(alive);
  const foeLeft = b.foe.some(alive);
  if (meLeft && foeLeft && !timeUp) return;
  b.phase = 'over';
  b.result = meLeft && foeLeft ? (hpShare(b.me) > hpShare(b.foe) ? 'win' : 'lose') : meLeft ? 'win' : 'lose';
  b.ult = null;
  b.clash = null;
  b.moveClashes = [];
  b.shots = [];
  b.overMs = 0;
  b.msg = b.result === 'win' ? `${withJosa(b.foeName, '과/와')}의 3:3 승부에서 이겼다!` : '내 포켓몬이 다 쓰러졌다…';
  note(b, { t: 'end', result: b.result });
}

/** 먼저 찬 내 포켓몬 (Z) */
function firstReady(b: TeamBattle, side: Side): number | null {
  let best: number | null = null;
  b[side].forEach((f, i) => {
    if (!alive(f) || f.ult < 1) return;
    const t = b.ultReadyAt[side][i] ?? 0;
    if (best === null || t < (b.ultReadyAt[side][best] ?? 0)) best = i;
  });
  return best;
}

/** 예약해 둔 내 포켓몬 중 먼저 찬 것 */
function firstReserved(b: TeamBattle): number | null {
  const ready = b.reserve.filter((i) => alive(b.me[i]!) && b.me[i]!.ult >= 1);
  return ready.length ? ready.reduce((best, i) => ((b.ultReadyAt.me[i] ?? 0) < (b.ultReadyAt.me[best] ?? 0) ? i : best)) : null;
}

// ---------- 입력 · 걸음

/** 필살기 게이지 단계 — 화면의 상대 필살기 예고 (near = ultWarnAt 넘음 · full = 다 참) · 내 발밑 판에도 씀 */
export function teamUltLevel(f: Fighter): 'none' | 'near' | 'full' {
  return !alive(f) ? 'none' : f.ult >= 1 ? 'full' : f.ult >= BALANCE.team.ultWarnAt ? 'near' : 'none';
}

/**
 * 포켓몬 크기 배율 (화면) · 0 = 3:3 잠금 — 폭 unitW × 배율이 있어야 그 배율, ×3 은 높이 x3MinH 부터 (240 폭 ×1 · 높이 300 아래 ×2 · 300 부터 ×3).
 * 패널 크기를 모르면 (안 볼 때 · 아직 안 알림) 들어가는 것으로
 */
export function teamScale(view: { w: number; h: number } | null | undefined): 0 | 1 | 2 | 3 {
  if (!view) return 2;
  const { unitW, x3MinH } = BALANCE.team.view;
  if (view.w >= unitW * 3 && view.h >= x3MinH) return 3;
  if (view.w >= unitW * 2) return 2;
  return view.w >= unitW ? 1 : 0;
}

/** 지금 그 칸 필살기를 쓸 · 끼어들 · 합류할 수 있는지 (화면이 아이콘을 밝게) */
export function teamUltOpen(b: TeamBattle, slot: number): boolean {
  const f = b.me[slot];
  if (!f || !alive(f) || f.ult < 1) return false;
  if (b.phase === 'run') return true;
  // 맞은 뒤에는 못 끼어듦 (피해가 두 번 들어가지 않게 — 코드 리뷰어)
  if (b.phase === 'ult') return b.ult!.side === 'foe' && b.ult!.window > 0 && !b.ult!.hit;
  return b.phase === 'clash' && b.clash!.kind === 'ult' && !b.clash!.me.includes(slot);
}

export function teamInput(b0: TeamBattle, input: TeamInput, rng: Rng): TeamBattle {
  if (b0.phase === 'over') return b0;
  if (input.kind === 'space') {
    if (b0.phase !== 'clash' || !b0.clash) return b0;
    return { ...b0, clash: { ...b0.clash, taps: b0.clash.taps + 1 } };
  }
  const slot = input.slot ?? firstReady(b0, 'me');
  if (slot === null) return b0;
  if (!teamUltOpen(b0, slot)) {
    // 예약 — 그 칸 (1 · 2 · 3 · 발밑 판) 만, Z 는 예약 없음 · 이미 힘겨루기에 든 포켓몬은 빼고
    const f = b0.me[slot];
    if (input.slot === undefined || !f || !alive(f) || (b0.clash?.kind === 'ult' && b0.clash.me.includes(slot))) return b0;
    const b = clone(b0);
    b.reserve = b.reserve.includes(slot) ? b.reserve.filter((i) => i !== slot) : [...b.reserve, slot];
    return b;
  }
  const b = clone(b0);
  if (b.phase === 'run') startUlt(b, 'me', slot, rng);
  else if (b.phase === 'ult') startUltClash(b, 'me', [slot], rng);
  else if (b.clash) {
    spendUlt(b, 'me', slot);
    b.clash.me = [...b.clash.me, slot];
    note(b, { t: 'ult-join', side: 'me', slot });
    b.msg = `합류! 필살기 힘겨루기 ${b.clash.me.length}:${b.clash.foe.length}`;
  }
  return b;
}

export function teamStep(b0: TeamBattle, stepMs: number, rng: Rng, opts: TeamStepOptions): TeamBattle {
  const b = clone(b0);
  b.t += stepMs;
  // 쓰러진 포켓몬의 예약은 지움 (독 · 반동 등 어디서 쓰러졌든)
  if (b.reserve.some((i) => !alive(b.me[i]!))) b.reserve = b.reserve.filter((i) => alive(b.me[i]!));
  b.popups = b.popups.map((p) => ({ ...p, ms: p.ms + stepMs })).filter((p) => p.ms < POPUP_MS);
  const auto = opts.auto || opts.away;
  switch (b.phase) {
    case 'over':
      b.overMs += stepMs;
      return b;
    case 'ult': {
      const u = b.ult!;
      u.ms += stepMs;
      u.window = Math.max(0, u.window - stepMs);
      // 상대 AI 가 내 필살기에 끼어듦 · 자동 전투면 내가 상대 필살기에 바로 끼어듦
      if (u.joinAt !== null && u.ms >= u.joinAt) {
        const joiners = u.joiners.filter((i) => alive(b.foe[i]!) && b.foe[i]!.ult >= 1);
        if (joiners.length > 0) {
          startUltClash(b, 'foe', joiners, rng);
          return b;
        }
        u.joinAt = null;
      }
      // 예약해 둔 포켓몬도 끼어들기 창이 열리면 바로 끼어듦 (예약 = 차는 대로 쓰기 — 끼어들기도 쓰기)
      if (u.side === 'foe' && u.window > 0 && !u.hit) {
        const mine = b.me.map((f, i) => (alive(f) && f.ult >= 1 && (auto || b.reserve.includes(i)) ? i : -1)).filter((i) => i >= 0);
        if (mine.length) {
          startUltClash(b, 'me', mine, rng);
          return b;
        }
      }
      if (!u.hit && u.ms >= u.hitMs) {
        u.hit = true;
        // 필살기 = 상대 모두 (여럿이면 0.75배)
        const foes = b[other(u.side)];
        const targets = foes.map((f, i) => (alive(f) ? i : -1)).filter((i) => i >= 0);
        const scale = targets.length > 1 ? BALANCE.team.spreadScale : 1;
        for (const t of targets) damage(b, u.side, u.from, t, BALANCE.ultPower, b[u.side][u.from]!.types[0] ?? null, rng, true, scale);
      }
      if (u.ms >= u.dur) {
        b.ult = null;
        b.phase = 'run';
      }
      checkEnd(b);
      return b;
    }
    case 'clash': {
      const c = b.clash!;
      c.ms += stepMs;
      // 자동 전투면 차는 대로 합류 · 상대 AI 도 가끔 (트레이너) · 자주 (관장) 합류
      b.me.forEach((f, i) => {
        if (alive(f) && f.ult >= 1 && !c.me.includes(i) && (auto || b.reserve.includes(i))) {
          spendUlt(b, 'me', i);
          c.me = [...c.me, i];
          note(b, { t: 'ult-join', side: 'me', slot: i });
        }
      });
      for (const j of c.foeJoin ?? []) {
        const f = b.foe[j.slot];
        if (f && c.ms >= j.at && alive(f) && f.ult >= 1 && !c.foe.includes(j.slot)) {
          spendUlt(b, 'foe', j.slot);
          c.foe = [...c.foe, j.slot];
          note(b, { t: 'ult-join', side: 'foe', slot: j.slot });
          b.msg = `상대 합류! 필살기 힘겨루기 ${c.me.length}:${c.foe.length}`;
        }
      }
      if (c.ms >= c.dur) endUltClash(b, rng);
      checkEnd(b);
      return b;
    }
    case 'run':
      break;
  }
  // 기술 힘겨루기 — 그 둘만 멈추고 1.5초 뒤 결과
  for (const c of b.moveClashes) c.ms += stepMs;
  for (const c of b.moveClashes.filter((x) => x.ms >= x.dur)) endMoveClash(b, c, rng);
  b.moveClashes = b.moveClashes.filter((c) => c.ms < c.dur);
  // 날아가는 기술
  for (const s of b.shots) {
    if (s.clash) continue;
    s.ms += stepMs;
    if (!s.hit && s.ms >= s.hitMs) {
      s.hit = true;
      if (alive(b[s.side][s.from]!)) land(b, s, rng);
      else note(b, { t: 'stop', shot: s.id });
    }
  }
  b.shots = b.shots.filter((s) => s.clash || s.ms < s.dur);
  const pair = findMoveClash(b);
  if (pair) {
    pair[0].clash = true;
    pair[1].clash = true;
    b.moveClashes = [...b.moveClashes, { kind: 'move', me: [pair[0].from], foe: [pair[1].from], shots: [pair[0].id, pair[1].id], ms: 0, dur: TIMING.team.moveClashMs, taps: 0, winner: null }];
    note(b, { t: 'clash', shots: [pair[0].id, pair[1].id], me: pair[0].from, foe: pair[1].from });
  }
  checkEnd(b);
  if ((b.phase as TeamBattle['phase']) === 'over') return b;
  // 필살기 — 상대 AI 는 차면 조금 기다렸다 · 자동 전투면 내 것도 차는 대로
  for (let i = 0; i < b.foe.length; i++) {
    const f = b.foe[i]!;
    if (!alive(f) || f.ult < 1) continue;
    const [lo, hi] = BALANCE.trainerUltWaitMs;
    const wait = b.foeUltWait[i] ?? rng.int(lo, hi);
    b.foeUltWait[i] = wait - stepMs;
    if (wait - stepMs <= 0) {
      b.foeUltWait[i] = null;
      startUlt(b, 'foe', i, rng);
      return b;
    }
  }
  const z = auto ? firstReady(b, 'me') : firstReserved(b);
  if (z !== null) {
    startUlt(b, 'me', z, rng);
    return b;
  }
  // 행동 게이지 — 차면 바로 (겹쳐도) · 기술 힘겨루기 중인 둘은 멈춤 (그동안 다른 포켓몬만 계속 — 한 포켓몬이 힘겨루기 둘을 하지 않게)
  for (const side of ['me', 'foe'] as const) {
    b[side].forEach((f, i) => {
      if (!alive(f) || b.moveClashes.some((c) => c[side].includes(i))) return;
      f.gauge = Math.min(1, f.gauge + gaugeRate(b, f) * stepMs);
      if (f.gauge >= 1) act(b, side, i, rng);
    });
  }
  checkEnd(b, b.t >= TIMING.team.maxMs);
  return b;
}

export function teamDone(b: TeamBattle): boolean {
  return b.phase === 'over' && b.overMs >= TIMING.battleOverMs;
}

// ---------- 끝 — 세이브 · 보상

/** HP · 상태 이상을 세이브에 (3:3 은 PP 가 안 닳음) */
export function applyTeamResult(save: Save, b: TeamBattle): Save {
  const monsters = { ...save.monsters };
  for (const f of b.me) {
    const m = monsters[f.uid];
    if (m) monsters[f.uid] = { ...m, hp: Math.min(f.hp, fighterOf({ ...m, hp: 1e6 }).maxHp), status: f.status ? { ...f.status } : null };
  }
  return { ...save, monsters, pendingEncounter: null };
}

/** 보상 계산 (battleRewards) 에 넘길 모양 — 쓰러뜨린 상대 · 싸운 내 포켓몬 (돈은 그 뒤 ×1.5) */
export function teamRewardBattle(b: TeamBattle): { kind: 'trainer' | 'gym'; result: 'win' | 'lose' | null; foe: Fighter; foeDown: TeamBattle['foeDown']; fought: string[]; foeName: string } {
  return { kind: b.kind, result: b.result, foe: b.foe[b.foe.length - 1]!, foeDown: b.foeDown, fought: b.fought, foeName: b.foeName };
}

// ---------- 다른 쪽 (웹뷰) 에서 온 상태 — 모양이 이상하면 null (그 전투를 처음부터)

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const fin = (v: unknown, min = -1e12, max = 1e12): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const isSide = (v: unknown): v is Side => v === 'me' || v === 'foe';
const waits = (v: unknown, n: number) => Array.isArray(v) && v.length === n && v.every((x) => x === null || fin(x));

export function readTeam(raw: unknown): TeamBattle | null {
  if (!isObj(raw) || (raw.kind !== 'trainer' && raw.kind !== 'gym') || typeof raw.foeName !== 'string') return null;
  if (!Array.isArray(raw.me) || !Array.isArray(raw.foe) || raw.me.length < 1 || raw.me.length > 3 || raw.foe.length < 1 || raw.foe.length > 3) return null;
  if (!raw.me.every(okFighter) || !raw.foe.every(okFighter) || raw.foeName.length > 40) return null;
  if (!['run', 'ult', 'clash', 'over'].includes(raw.phase as string)) return null;
  // 칸 번호는 그쪽 실제 마릿수 안 (상대가 1 ~ 2마리면 b.foe[2] 가 없음 — 코드 리뷰어)
  const n = { me: raw.me.length, foe: raw.foe.length };
  const slot = (v: unknown, side: Side) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < n[side];
  const slots = (v: unknown, side: Side, min = 0) => Array.isArray(v) && v.length >= min && v.length <= n[side] && v.every((i) => slot(i, side));
  const okShot = (s: unknown) =>
    isObj(s) && fin(s.id, 0) && isSide(s.side) && slot(s.from, s.side) && slots(s.targets, other(s.side), 1) && fin(s.moveId, 0, 100000) && fin(s.ms, 0) && fin(s.dur, 1) && fin(s.hitMs, 0) &&
    typeof s.hit === 'boolean' && typeof s.shooting === 'boolean' && typeof s.clash === 'boolean' && (s.boost === undefined || fin(s.boost, 1, 100));
  if (!Array.isArray(raw.shots) || raw.shots.length > 30 || !raw.shots.every(okShot)) return null;
  const shotIds = new Set(raw.shots.map((s: Obj) => s.id));
  const okBase = (c: Obj) => slots(c.me, 'me', 1) && slots(c.foe, 'foe', 1) && fin(c.ms, 0) && fin(c.dur, 1) && fin(c.taps, 0, 1000) && (c.winner === null || isSide(c.winner));
  const okMoveClash = (c: unknown) => isObj(c) && c.kind === 'move' && okBase(c) && Array.isArray(c.shots) && c.shots.length === 2 && c.shots.every((id) => shotIds.has(id));
  if (!Array.isArray(raw.moveClashes) || !raw.moveClashes.every(okMoveClash)) return null;
  const c = raw.clash;
  const okJoin = (j: unknown) => isObj(j) && slot(j.slot, 'foe') && fin(j.at, 0);
  if (!(c === null || (isObj(c) && c.kind === 'ult' && c.shots === null && okBase(c) && (c.foeJoin === undefined || (Array.isArray(c.foeJoin) && c.foeJoin.every(okJoin)))))) return null;
  if ((raw.phase === 'clash') !== (c !== null)) return null;
  const u = raw.ult;
  const okUlt = (x: Obj) =>
    isSide(x.side) && slot(x.from, x.side) && fin(x.ms, 0) && fin(x.dur, 1) && fin(x.hitMs, 0) && typeof x.hit === 'boolean' && fin(x.window, 0) && (x.joinAt === null || fin(x.joinAt, 0)) && slots(x.joiners, other(x.side));
  if (!(u === null || (isObj(u) && okUlt(u)))) return null;
  if ((raw.phase === 'ult') !== (u !== null)) return null;
  if (!waits(raw.foeUltWait, n.foe) || !isObj(raw.ultReadyAt) || !waits(raw.ultReadyAt.me, n.me) || !waits(raw.ultReadyAt.foe, n.foe)) return null;
  const okPopup = (p: unknown) => isObj(p) && fin(p.id, 0) && isSide(p.side) && slot(p.slot, p.side) && typeof p.text === 'string' && p.text.length <= 200 && fin(p.ms, 0) && POPUP_KINDS.includes(p.kind as string);
  if (!Array.isArray(raw.popups) || raw.popups.length > 12 || !raw.popups.every(okPopup)) return null;
  // 쓰러뜨린 상대 (보상 계산 — level 이 없으면 돈 · 경험치가 NaN → 세이브 검사에서 0 이 됨)
  if (!Array.isArray(raw.foeDown) || raw.foeDown.length > n.foe || !raw.foeDown.every((d) => isObj(d) && fin(d.species, 1, 2000) && fin(d.level, 1, 100))) return null;
  if (!Array.isArray(raw.fought) || raw.fought.length > n.me || !raw.fought.every((x) => typeof x === 'string')) return null;
  if (!Array.isArray(raw.reserve) || !slots(raw.reserve, 'me') || new Set(raw.reserve).size !== raw.reserve.length) return null;
  const both = (e: Obj) => isSide(e.side) && slot(e.from, e.side) && slot(e.to, other(e.side));
  const pair = (v: unknown) => Array.isArray(v) && v.length === 2 && v.every((x) => fin(x, 0));
  const okNote = (e: unknown): boolean => {
    if (!isObj(e) || !fin(e.id, 1) || !fin(e.at, 0)) return false;
    switch (e.t) {
      case 'shoot':
        return fin(e.shot, 0) && isSide(e.side) && slot(e.from, e.side) && slots(e.targets, other(e.side), 1) && fin(e.moveId, 0, 100000);
      case 'hit':
        return both(e) && fin(e.moveId, -1, 100000) && typeof e.ult === 'boolean' && POPUP_KINDS.includes(e.effect as string) && fin(e.dmg, 0) && typeof e.ko === 'boolean';
      case 'miss':
        return both(e) && fin(e.moveId, 0, 100000);
      case 'stop':
        return fin(e.shot, 0);
      case 'clash':
      case 'clash-end':
        return pair(e.shots) && slot(e.me, 'me') && slot(e.foe, 'foe') && (e.t === 'clash' || isSide(e.winner));
      case 'ult':
        return isSide(e.side) && slot(e.from, e.side);
      case 'ult-clash':
        return slots(e.me, 'me', 1) && slots(e.foe, 'foe', 1);
      case 'ult-clash-end':
        return isSide(e.winner) && typeof e.sure === 'boolean' && slots(e.me, 'me', 1) && slots(e.foe, 'foe', 1);
      case 'ult-join':
      case 'faint':
      case 'ready':
        return isSide(e.side) && slot(e.slot, e.side);
      case 'status':
        return isSide(e.side) && slot(e.slot, e.side) && ['poison', 'burn', 'paralysis', 'sleep'].includes(e.kind as string);
      case 'end':
        return e.result === 'win' || e.result === 'lose';
      default:
        return false;
    }
  };
  if (!fin(raw.logSeq, 0) || !Array.isArray(raw.log) || raw.log.length > TEAM_LOG_MAX || !raw.log.every(okNote) || raw.log.some((e: Obj) => (e.id as number) > (raw.logSeq as number))) return null;
  if (!fin(raw.overMs, 0) || !fin(raw.t, 0) || !fin(raw.seq, 0) || !fin(raw.popupSeq, 0) || typeof raw.msg !== 'string') return null;
  if (!(raw.result === null || raw.result === 'win' || raw.result === 'lose') || (raw.phase === 'over') !== (raw.result !== null)) return null;
  return raw as unknown as TeamBattle;
}

/** 다시 그리는 열쇠 — 한 걸음마다 바뀌는 것 (게이지 · HP · 날아가는 기술 · 힘겨루기 · 필살기 진행 · 팝업이 사라짐) 을 모양 단위로 */
export function teamViewKey(b: TeamBattle): string {
  const f = (x: Fighter) => `${x.hp}:${Math.floor(x.gauge * 20)}:${Math.floor(x.ult * 20)}:${x.status?.kind ?? ''}`;
  return [b.phase, b.me.map(f).join(','), b.foe.map(f).join(','), b.shots.map((s) => `${s.id}:${s.clash}`).join(','), b.moveClashes.map((c) => `${c.shots?.join('-')}:${Math.floor(c.ms / 100)}`).join(','), b.ult ? `${b.ult.side}${b.ult.from}:${b.ult.window > 0}:${b.ult.hit}:${Math.floor(b.ult.ms / 100)}` : '', b.clash ? `${b.clash.me.join('')}:${b.clash.foe.join('')}:${b.clash.taps}:${Math.floor(b.clash.ms / 100)}` : '', b.popups.map((p) => p.id).join(','), b.msg, b.reserve.join(''), b.logSeq].join('|');
}
