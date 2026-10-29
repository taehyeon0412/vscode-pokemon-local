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
import { moveFxOf, moveOf, speciesOf, ultIsSpread, ultNamesOf, type ReadonlyMove, type TypeName } from '../../data';
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
  /** 쏠 때 들어간 독 · 화상 피해 (큰 연출로 거두면 돌려줌 — settleDashes) */
  ticked?: number;
  /** 몸으로 닿는 기술 — 상대 앞까지 달려가 박치기 → 제자리 (연출이 몸을 옮김) */
  contact?: boolean;
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
  /** 필살기 힘겨루기 앞장 (me[0] · foe[0]) 필살기 이름 — 첫 컷인 · 대결 VS · 이긴 뒤 합동 컷인이 같은 이름 (따로 골라 "또 다른 필살기" 로 읽히던 것 — 코드 리뷰어 #86) */
  names?: { me?: string; foe?: string };
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
  /** 끼어들 수 있는 창의 처음 길이 (ms — 화면 막대, 옛 상태엔 없음: 합동 멘트면 gatherMs · 아니면 interruptMs) */
  windowMs?: number;
  /** 쓴 필살기 이름 (연출과 같은 이름) · 원작 범위기면 상대 모두 · 아니면 target 한 마리 (기획 R7 — 옛 상태엔 없음: 상대 모두) */
  name?: string;
  spread?: boolean;
  target?: number;
  /** 상대 AI 가 끼어들 때 (ms, null = 안 끼어듦) · 끼어들 포켓몬 */
  joinAt: number | null;
  joiners: number[];
  /** 합동 마무리 — 힘겨루기를 여럿이 이김 (3:1 = sure) · 같은 편이 모임: 이긴 참가자마다 자기 필살기를 진 참가자 모두에게 (합쳐 터지는 순간) */
  /** spread = 같은 편이 모인 합동 (필살기 = 상대 모두 — 여럿이면 0.75배, 혼자 필살기와 같음) · 힘겨루기 뒤 합동은 진 참가자 모두 (힘겨루기 규칙) */
  /** names = 참가자 (winners 순) 마다 엔진이 고른 필살기 이름 (없으면 null — 옛 상태엔 칸 없음) · 연출이 그대로 씀 (2026-10-22 기획 #80 답) */
  /** quick = 힘겨루기를 이긴 합동 (참가자 필살기는 대결에서 나감 — 연출은 짧은 마무리만, orders #86) */
  joint?: { winners: number[]; losers: number[]; sure: boolean; spread?: boolean; names?: (string | null)[]; quick?: true };
  /** 합동 필살기 멘트 — 남은 ms (그동안 필살기는 멈추고 같은 편이 모임) · 모인 같은 편 (쓴 포켓몬 빼고) · 상대 AI 동료가 모일 때 */
  gather?: number;
  team?: number[];
  allyAt?: { slot: number; at: number }[];
}

/** 게이지가 찬 칸 하나 — 찬 때 · 막힌 고름 */
export interface TeamReady {
  at: number;
  pick?: { moveId: number; targets: number[] };
}

/** joint = 합동 필살기 피해 (화면 "합동! −숫자" 칩 — 시간 창으로 고르면 뒤따른 보통 공격 피해에도 붙던 것, #80 UX) */
export type TeamPopup = BattlePopup & { slot: number; joint?: true };

/**
 * 연출 다리 — 3:3 에서 일어난 일 (번호순, 마지막 TEAM_LOG_MAX 개). 화면 · 연출은 본 번호 뒤 것만 그림 (여러 걸음을 한 번에 그려도 안 놓침 · 다시 붙으면 옛것은 안 그림).
 * 모양은 디자인팀 · 이 기록과 features/battle/fx/team.ts (계획 · 실행) 는 개발팀 (2026-10-21 orders #17 준비)
 */
export type TeamNote =
  /** 기술을 쏨 (moveId 0 = 1 공격) — shot = TeamShot.id */
  | { t: 'shoot'; shot: number; side: Side; from: number; targets: number[]; moveId: number; hitMs: number; contact: boolean }
  /** 맞음 — 기술 · 1 공격 (moveId 0) · 필살기 (ult, moveId −1). effect = 팝업 종류 (super · weak · immune · crit · damage) · ko = 이 한 방에 쓰러짐 */
  | { t: 'hit'; side: Side; from: number; to: number; moveId: number; ult: boolean; effect: BattlePopup['kind']; dmg: number; ko: boolean }
  | { t: 'miss'; side: Side; from: number; to: number; moveId: number }
  /** 쏜 포켓몬이 쓰러져 날아가던 기술이 사라짐 */
  | { t: 'stop'; shot: number }
  /** 기술 힘겨루기 시작 (두 기술이 멈춤) · 끝 */
  | { t: 'clash'; shots: [number, number]; me: number; foe: number }
  | { t: 'clash-end'; shots: [number, number]; me: number; foe: number; winner: Side }
  /** joint = 합동 마무리 (이긴 참가자 · 진 참가자 · 3:1) */
  | { t: 'ult'; side: Side; from: number; joint?: { winners: number[]; losers: number[]; sure: boolean; spread?: boolean; names?: (string | null)[]; quick?: true }; name?: string; spread?: boolean; target?: number }
  /** by = 끊긴 필살기를 쓰던 쪽 (연출 — 맞부딪힘 자리) */
  | { t: 'ult-clash'; me: number[]; foe: number[]; names?: { me?: string; foe?: string }; by?: Side }
  /** 합동 필살기 멘트 시작 (같은 편이 모임 — 끝나면 ult 가 따로 · 합동으로) */
  | { t: 'gather'; side: Side; from: number }
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
  /** (옛 기록) 필살기 예약 — 없앰 (2026-10-22 orders #88 "필살기 예약 이라는건 없애자"). 늘 빈 목록 (옛 상태 읽기용) */
  reserve: number[];
  /** 버린 필살기 누름 (내 칸 — slot −1 = 칸 없이 Z) — 지난 ms · 까닭 (charge = 아직 안 참 · busy = 찼지만 다른 필살기 · 연출 중). TIMING.team.denyMs 뒤 지움 */
  deny?: { slot: number; ms: number; why: 'charge' | 'busy'; go?: boolean };
  /** 내 칸마다 다 찬 필살기를 기다린 ms (볼 때 — 쓸 수 있는 걸음에서만 셈, ultAutoWaitMs 가 되면 저절로 · R2) · 옛 상태엔 없음 */
  autoWait?: number[];
  /** 마지막 기술을 쏜 때 (t) — 다음 기술은 staggerMs 뒤 (시작 시각 엇갈림, #117) · 옛 상태엔 없음 */
  lastShotAt?: number;
  /**
   * 게이지가 찬 칸 — 찬 때 (at · 먼저 찬 칸부터 쏨) · 막혀 기다리는 고른 기술 (pick — 다음 걸음엔 막힘만 다시 봄).
   * 걸음마다 다시 고르면 막히기 쉬운 센 기술 (범위 · 닿는) 이 약한 기술로 바뀌고 (지진 93 → 29%) · 칸 번호 순이면 뒤 칸이 20초 굶던 것 (테스터 #95). 옛 상태엔 없음
   */
  ready?: { me: (TeamReady | null)[]; foe: (TeamReady | null)[] };
  /** 연출 다리 — 일어난 일 (TeamNote) 과 마지막 번호 */
  log: TeamLogEntry[];
  logSeq: number;
}

export interface TeamStepOptions {
  /** 자동 전투 — 내 필살기도 차면 바로 · 상대 필살기에 늘 끼어듦 */
  auto: boolean;
  /** 안 볼 때 (확장이 계산) — 자동 전투와 같게 */
  away: boolean;
  /** 개발 모드 (임시) — 포켓몬 (uid) 마다 고른 필살기 이름 (연출 · 대상이 같게) */
  ults?: Readonly<Record<string, string>>;
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
  const alive = save.party.map((uid) => save.monsters[uid]).filter((m): m is Monster => !!m && m.hp > 0);
  // 레벨 규칙 (켜져 있으면 — BALANCE.team.pickLevelGap): 센 셋 평균보다 그만큼 넘게 낮으면 뒤로 (모자라면 그래도 나감).
  // 센 셋 = 늘 팀 크기만큼 (순위 전체 n = Infinity 로 불러도 — 모두의 평균이 되던 것, 테스터 #59)
  const gap = BALANCE.team.pickLevelGap;
  const top = alive.map((m) => m.level).sort((a, b) => b - a).slice(0, BALANCE.team.size);
  const floor = gap > 0 && top.length > 0 ? top.reduce((a, b) => a + b, 0) / top.length - gap : -Infinity;
  const low = (m: Monster) => (m.level < floor ? 1 : 0);
  return alive
    .sort((a, b) => low(a) - low(b) || score(b) - score(a) || b.level - a.level)
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
  const b: TeamBattle = {
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
  // 처음 게이지 — 빠른 순으로 startFirstMs · + startGapMs … 뒤에 차게 (VS 뒤 0.8초 안 첫 공격 · 여섯이 한꺼번에 나가지 않게 — 2026-10-22 태현 님 #130 · #117)
  const order = [...b.me.map((f) => ({ f, side: 0 })), ...b.foe.map((f) => ({ f, side: 1 }))].sort((x, y) => y.f.stats.speed - x.f.stats.speed || x.side - y.side);
  order.forEach(({ f }, i) => {
    const wait = TIMING.team.startFirstMs + i * TIMING.team.startGapMs;
    f.gauge = Math.max(0, Math.min(0.999, 1 - wait * gaugeRate(b, f)));
  });
  return b;
}

// ---------- 계산 도구

function clone(b: TeamBattle): TeamBattle {
  return {
    ...b,
    me: b.me.map((f) => ({ ...f })),
    foe: b.foe.map((f) => ({ ...f })),
    shots: b.shots.map((s) => ({ ...s })),
    moveClashes: b.moveClashes.map((c) => ({ ...c })),
    ult: b.ult ? { ...b.ult, joiners: [...b.ult.joiners], ...(b.ult.team ? { team: [...b.ult.team] } : {}) } : null,
    clash: b.clash ? { ...b.clash, me: [...b.clash.me], foe: [...b.clash.foe] } : null,
    foeUltWait: [...b.foeUltWait],
    ultReadyAt: { me: [...b.ultReadyAt.me], foe: [...b.ultReadyAt.foe] },
    popups: [...b.popups],
    foeDown: [...b.foeDown],
    reserve: [...b.reserve],
    ...(b.autoWait ? { autoWait: [...b.autoWait] } : {}),
    ...(b.ready ? { ready: { me: [...b.ready.me], foe: [...b.ready.foe] } } : {}),
    log: [...b.log],
  };
}

/** 연출 다리에 하나 적음 (기록 하나하나는 바꾸지 않음 — 앞 상태와 같이 씀) */
function note(b: TeamBattle, n: TeamNote): void {
  b.logSeq += 1;
  b.log = [...b.log.slice(-(TEAM_LOG_MAX - 1)), { ...n, id: b.logSeq, at: b.t }];
}

/** 지금 합동 마무리 피해를 주는 중 (그 피해 팝업에 joint) */
let jointDamage = false;
function popup(b: TeamBattle, side: Side, slot: number, text: string, kind: BattlePopup['kind'], joint = false): void {
  b.popupSeq += 1;
  b.popups = [...b.popups.slice(-11), { id: b.popupSeq, side, slot, text, ms: 0, kind, ...(joint ? { joint: true as const } : {}) }];
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

/**
 * 기술 박자 — 일반 모드 연출 길이 (data moveFxOf) 에 맞춤. 쏘는 기술 = 연출 길이 + 여운, 맞는 때 = 틀마다 (광선은 곧 · 솔라빔은 끝에).
 * 닿는 기술 (1 공격 포함) = 달려가기 + 박치기 + 자국 + 제자리, 맞는 때 = 닿고 조금 뒤
 */
export function shotTiming(moveId: number): { dur: number; hitMs: number; contact: boolean } {
  const T = TIMING.team;
  const f = moveId === TEAM_BASIC ? null : moveFxOf(moveId);
  if (!f || f.contact) {
    const strike = Math.max(T.strikeMs, Math.min(600, f?.ms ?? 0));
    return { dur: T.dashMs + strike + T.backMs, hitMs: T.dashMs + T.strikeHitMs, contact: true };
  }
  const ms = Math.min(T.shotMaxMs, Math.max(T.shotMinMs, f.ms));
  return { dur: ms + T.shotTailMs, hitMs: Math.max(120, Math.round(ms * f.hitAt)), contact: false };
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
  popup(b, other(side), to, `-${dmg}`, effect, jointDamage);
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

/**
 * 큰 연출이 겹치지 않게 (2026-10-22 태현 님 #117 "평소엔 다 같이 움직이고 큰 연출만 겹치지 않게") — 이 기술을 지금 쏘면 안 되는지:
 * 닿는 기술 = 쓰는 포켓몬 · 맞을 상대가 다른 달려가기 (가는 중 · 박치기 · 돌아오는 중) 에 든 동안 기다림 (같은 상대 앞에 둘이 겹쳐 서던 것) ·
 * 범위 기술 (화면을 크게 쓰는 기술 — 지진 · 파도타기) = 앞 범위 기술이 끝날 때까지 기다림
 */
function actBlocked(b: TeamBattle, side: Side, slot: number, pick: { moveId: number; targets: number[] }): boolean {
  if (shotTiming(pick.moveId).contact) {
    if (bodyBusy(b, side, slot)) return true;
    // 맞을 상대 앞에 다른 포켓몬이 있으면 비어 있는 다른 상대로 (그 기술 상성이 좋은 순) — 모두 바쁠 때만 기다림 (멈춰 있는 포켓몬이 없게 — 태현 님 #117)
    if (bodyBusy(b, other(side), pick.targets[0]!)) {
      const foes = b[other(side)];
      const mv = moveOf(pick.moveId);
      const free = foes.map((f, i) => (alive(f) && !bodyBusy(b, other(side), i) && (!mv || effectiveness(mv.type, f.types) > 0) ? i : -1)).filter((i) => i >= 0);
      if (!free.length) return true;
      // 범위 + 닿는 기술 (바람가르기 · 에어컷터 · 바크아웃 · 폭음파) 은 대상은 그대로 · 달려갈 상대만 비어 있는 쪽으로 (한 마리 기술로 바뀌던 것 — 코드 리뷰어)
      if (pick.targets.length > 1) {
        const first = pick.targets.find((i) => free.includes(i));
        if (first === undefined) return true;
        pick.targets = [first, ...pick.targets.filter((i) => i !== first)];
      } else {
        const best = bestTarget(foes.map((f, i) => (free.includes(i) ? f : { ...f, hp: 0 })), mv ?? null);
        pick.targets = [best ?? free[0]!];
      }
    }
  }
  return isSpread(moveOf(pick.moveId)) && b.shots.some((x) => isSpread(moveOf(x.moveId)));
}

/** 그 포켓몬이 달려가기에 든 동안 (달려가는 쪽 · 맞는 쪽 — 가는 중 · 박치기 · 돌아오는 중) */
function bodyBusy(b: TeamBattle, side: Side, slot: number): boolean {
  return b.shots.some((x) => x.contact && ((x.side === side && x.from === slot) || (x.side !== side && x.targets[0] === slot)));
}

/** 한 포켓몬 행동 — 잠듦이면 쉼 · 아니면 AI 가 고른 기술을 쏨 (겹쳐도 — 큰 연출이 겹치면 기다림 actBlocked). 기다리면 false (게이지 그대로) */
function act(b: TeamBattle, side: Side, slot: number, rng: Rng): boolean {
  const f = b[side][slot]!;
  if (f.status?.kind === 'sleep') {
    f.gauge = 0;
    const left = f.status.turnsLeft - 1;
    f.status = left > 0 ? { kind: 'sleep', turnsLeft: left } : null;
    popup(b, side, slot, left > 0 ? '쿨쿨 잠들어 있다' : '잠에서 깼다!', 'info');
    return true;
  }
  // 막혀 기다리던 고름이 있으면 그대로 (대상이 다 쓰러졌으면 새로 고름)
  const held = b.ready?.[side][slot]?.pick;
  const foes = b[other(side)];
  const pick = held && held.targets.some((i) => foes[i] && alive(foes[i]!)) ? { moveId: held.moveId, targets: held.targets.filter((i) => alive(foes[i]!)) } : teamPick(f, foes, rng);
  if (!pick) {
    f.gauge = 0;
    return true;
  }
  if (actBlocked(b, side, slot, pick)) {
    const r = b.ready?.[side][slot];
    if (r && b.ready) b.ready[side][slot] = { ...r, pick: { moveId: pick.moveId, targets: [...pick.targets] } };
    return false;
  }
  f.gauge = 0;
  // 마비 — 가끔 못 움직임 (1:1 과 같음)
  if (f.status?.kind === 'paralysis' && rng.chance(BALANCE.paralysisSkip)) {
    popup(b, side, slot, '몸이 저려 움직일 수 없다!', 'info');
    return true;
  }
  const mv = moveOf(pick.moveId);
  // 연달아 세지는 기술 — 같은 기술을 또 쓰면 +1, 다른 기술이면 처음부터 (1:1 과 같음)
  if (mv?.streak && f.streakMove === mv.id) f.streakCount += 1;
  else {
    f.streakMove = mv?.streak ? mv.id : null;
    f.streakCount = 0;
  }
  b.seq += 1;
  const { dur, hitMs, contact } = shotTiming(pick.moveId);
  b.shots = [...b.shots, { id: b.seq, side, from: slot, targets: pick.targets, moveId: pick.moveId, ms: 0, dur, hitMs, hit: false, shooting: isShooting(mv) && !contact, clash: false, ...(contact ? { contact } : {}), ...(mv?.streak ? { boost: streakMultiplier(f.streakCount) } : {}) }];
  note(b, { t: 'shoot', shot: b.seq, side, from: slot, targets: [...pick.targets], moveId: pick.moveId, hitMs, contact });
  b.lastShotAt = b.t;
  const hp0 = f.hp;
  tick(b, side, slot);
  if (f.hp < hp0) b.shots[b.shots.length - 1]!.ticked = hp0 - f.hp;
  return true;
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
/**
 * 필살기 고르기 (기획 R7 A) — 그 모습의 필살기 중 (개발 모드에서 고른 것 · 배운 기술과 같은 이름은 피함, 연출 fxUltPick 과 같은 규칙) 하나.
 * 원작 범위기면 상대 모두, 아니면 한 마리 — 상성 좋은 · HP 가 적은 상대 (기본 기술과 같은 고르기)
 */
function pickUlt(b: TeamBattle, side: Side, slot: number, rng: Rng, ults?: Readonly<Record<string, string>>): { name?: string; spread: boolean; target: number } {
  const f = b[side][slot]!;
  const names = ultNamesOf(f.form);
  const learned = new Set(f.moves.map((m) => moveOf(m.moveId)?.name.ko).filter((n): n is string => !!n));
  const dev = f.uid ? ults?.[f.uid] : undefined;
  const fresh = names.filter((n) => !learned.has(n));
  const pool = fresh.length ? fresh : names;
  const name = dev && names.includes(dev) ? dev : pool.length ? pool[rng.int(0, pool.length - 1)] : undefined;
  const target = bestUltTarget(b[other(side)], f.types[0] ?? 'normal') ?? 0;
  return { ...(name ? { name } : {}), spread: !!name && ultIsSpread(name), target };
}

/** 한 마리 필살기 대상 — 상성 좋은 · HP 비율이 적은 상대 (bestTarget 과 같은 규칙, 필살기는 제 첫 타입) */
function bestUltTarget(foes: readonly Fighter[], type: TypeName): number | null {
  let best: number | null = null;
  for (let i = 0; i < foes.length; i++) {
    const f = foes[i]!;
    if (!alive(f)) continue;
    if (best === null) {
      best = i;
      continue;
    }
    const o = foes[best]!;
    const ef = effectiveness(type, f.types);
    const eb = effectiveness(type, o.types);
    if (ef > eb || (ef === eb && f.hp / f.maxHp < o.hp / o.maxHp)) best = i;
  }
  return best;
}

/**
 * 큰 연출 (필살기 · 합동 · 힘겨루기) 이 시작되면 아직 안 맞은 달려가기를 거둠 — 몸은 집으로 (연출 0.3초), 게이지는 거의 찬 채 (0.9) 돌려줌.
 * 상대 앞에 선 채 큰 연출이 시작돼 떠 보이고 · 맞음이 연출 뒤에 따로 나던 것 (아트 디렉터 #95 ③). 이미 맞은 달려가기는 돌아오는 중이라 그대로
 */
function settleDashes(b: TeamBattle): void {
  for (const s of b.shots) {
    if (!s.contact || s.hit || s.clash) continue;
    note(b, { t: 'stop', shot: s.id });
    const f = b[s.side][s.from];
    if (f && alive(f)) {
      f.gauge = Math.max(f.gauge, 0.9);
      // 쏠 때 쓴 것을 돌려줌 — 독 · 화상 피해 · 연달아 세지는 횟수 (다시 쏠 때 두 번 들어가던 것 — 테스터 #95)
      if (s.ticked) f.hp = Math.min(f.maxHp, f.hp + s.ticked);
      if (s.boost !== undefined && f.streakMove === s.moveId) f.streakCount = Math.max(0, f.streakCount - 1);
    }
  }
  b.shots = b.shots.filter((s) => !s.contact || s.hit || s.clash);
}

function startUlt(b: TeamBattle, side: Side, slot: number, rng: Rng, ults?: Readonly<Record<string, string>>): void {
  const f = b[side][slot]!;
  settleDashes(b);
  spendUlt(b, side, slot);
  const pick = pickUlt(b, side, slot, rng, ults);
  // 같은 편에 찬 포켓몬이 있으면 합동 필살기 멘트 (모이는 동안 멈춤 — 이 시간이 끼어들기 창도 됨), 없으면 바로 (끼어들기 창 1.2초)
  const allies = b[side].map((x, i) => (i !== slot && alive(x) && x.ult >= 1 ? i : -1)).filter((i) => i >= 0);
  const gather = allies.length > 0 ? TIMING.team.gatherMs : 0;
  const window = gather || TIMING.team.interruptMs;
  const foes = b[other(side)];
  // 상대 AI 끼어들기 — 내 필살기에 (트레이너 가끔 · 관장 자주)
  const chance = side === 'me' ? BALANCE.team.interruptChance[b.kind] : 0;
  const joiners = foes.map((x, i) => (alive(x) && x.ult >= 1 && rng.chance(chance) ? i : -1)).filter((i) => i >= 0);
  // 상대 AI 동료 — 찬 동료마다 한 번 굴려 모일 때를 정함 (트레이너 가끔 · 관장 자주)
  const allyAt = side === 'foe' && gather ? allies.filter(() => rng.chance(BALANCE.team.interruptChance[b.kind])).map((i) => ({ slot: i, at: rng.int(150, Math.min(TIMING.team.foeAllyByMs, gather - 250)) })) : [];
  // 3:3 용 판 (#122 — 2초 안팎): 보는 중엔 연출이 맞힐 때까지 붙잡음 · 안 볼 때는 이 박자.
  // 끼어들 수 있으면 (상대 필살기에 내 다 찬 칸 · 내 필살기에 상대 AI 가 끼어듦) 맞는 때를 끼어들기 창 뒤로 — 맞으면 창이 닫혀서 (u.hit) 0.25초로 줄면 못 끼어들던 것 (#95)
  const canJoin = !gather && (side === 'foe' ? b.me.some((x) => alive(x) && x.ult >= 1) : joiners.length > 0);
  const hitMs = canJoin ? Math.max(TIMING.team.ultHitMs, window + 100) : TIMING.team.ultHitMs;
  b.phase = 'ult';
  b.ult = {
    side,
    from: slot,
    windowMs: window,
    ms: 0,
    dur: hitMs + TIMING.team.ultMs - TIMING.team.ultHitMs,
    hitMs,
    hit: false,
    window,
    joinAt: joiners.length ? rng.int(Math.min(TIMING.team.foeJoinMinMs, window - 100), window - 100) : null,
    joiners,
    ...pick,
    ...(gather ? { gather, team: [], ...(allyAt.length ? { allyAt } : {}) } : {}),
  };
  if (gather) {
    note(b, { t: 'gather', side, from: slot });
    // 상대 편 멘트는 "합류" 가 아니라 받아칠 때 — 말을 나눔 (U5, 코드 리뷰어)
    b.msg = side === 'me' ? `${nameOf(f)}의 필살기! 합동 필살기?` : `상대 ${nameOf(f)}의 필살기! 상대 합동 필살기?`;
  } else {
    note(b, { t: 'ult', side, from: slot, ...pick });
    b.msg = `${nameOf(f)}의 필살기!`;
  }
}

/** 합동 필살기 멘트 동안 같은 편이 모임 (필살기 게이지를 씀) */
function joinTeam(b: TeamBattle, side: Side, slot: number): void {
  const u = b.ult!;
  spendUlt(b, side, slot);
  u.team = [...(u.team ?? []), slot];
  note(b, { t: 'ult-join', side, slot });
  b.msg = `합동 필살기! ${u.team.length + 1}마리`;
}

/** 멘트 끝 — 모였으면 합동 (같은 때 맞아 합쳐 터지는 순간에 피해), 아니면 따로 (끼어들기 창은 멘트로 지났음) */
function finishGather(b: TeamBattle, rng: Rng, ults?: Readonly<Record<string, string>>): void {
  const u = b.ult!;
  const team = (u.team ?? []).filter((i) => alive(b[u.side][i]!));
  const pick = { ...(u.name ? { name: u.name } : {}), ...(u.spread !== undefined ? { spread: u.spread } : {}), ...(u.target !== undefined ? { target: u.target } : {}) };
  if (team.length > 0) {
    // 합동은 한 점 = 한 마리 (기획 R7 A) — 처음 쓴 포켓몬이 고른 대상 (쓰러졌으면 다시 고름)
    const foes = b[other(u.side)];
    const target = u.target !== undefined && alive(foes[u.target]!) ? u.target : (bestUltTarget(foes, b[u.side][u.from]!.types[0] ?? 'normal') ?? 0);
    // 참가자 필살기도 엔진이 고름 (첫 참가자 = 쓴 필살기 · 나머지 = 같은 규칙 pickUlt)
    const names = [u.name ?? null, ...team.map((i) => pickUlt(b, u.side, i, rng, ults).name ?? null)];
    const joint = { winners: [u.from, ...team], losers: [target], sure: false, spread: true, names };
    b.ult = { side: u.side, from: u.from, ms: 0, dur: TIMING.team.jointMs, hitMs: TIMING.team.jointHitMs, hit: false, window: 0, joinAt: null, joiners: [], joint, ...pick, target };
    note(b, { t: 'ult', side: u.side, from: u.from, joint, ...pick, target });
    b.msg = `합동 필살기! ${joint.winners.length}마리`;
    return;
  }
  b.ult = { side: u.side, from: u.from, ms: 0, dur: u.dur, hitMs: u.hitMs, hit: false, window: 0, joinAt: null, joiners: [], ...pick };
  note(b, { t: 'ult', side: u.side, from: u.from, ...pick });
  b.msg = `${nameOf(b[u.side][u.from]!)}의 필살기!`;
}

/** 필살기 힘겨루기 시작 — 쓴 쪽 + 끼어든 쪽 (그 뒤에도 합류) */
function startUltClash(b: TeamBattle, joinSide: Side, joiners: number[], rng: Rng): void {
  const u = b.ult!;
  settleDashes(b);
  for (const i of joiners) spendUlt(b, joinSide, i);
  // 쓴 쪽은 모인 같은 편과 함께 (합동 필살기 멘트 중에 받아침 — 양쪽이 모인 채 힘겨루기)
  const me = u.side === 'me' ? [u.from, ...(u.team ?? [])] : joiners;
  const foe = u.side === 'foe' ? [u.from, ...(u.team ?? [])] : joiners;
  b.phase = 'clash';
  const dur = TIMING.team.ultClashMs;
  // 힘겨루기 동안 상대가 합류 — 찬 포켓몬마다 한 번 굴려 합류할 때를 정함 (트레이너 가끔 · 관장 자주)
  const foeJoin = b.foe
    .map((f, i) => ({ f, i }))
    .filter(({ f, i }) => alive(f) && f.ult >= 1 && !foe.includes(i) && rng.chance(BALANCE.team.interruptChance[b.kind]))
    .map(({ i }) => ({ slot: i, at: rng.int(200, dur - 300) }));
  // 앞장 이름 — 쓴 쪽 = 쓴 필살기 (u.name) · 받아친 쪽 = 엔진이 고름
  const leadName = (side: Side, list: number[]) => (side === u.side ? u.name : list[0] !== undefined ? pickUlt(b, side, list[0], rng).name : undefined);
  const names = { ...(leadName('me', me) ? { me: leadName('me', me) } : {}), ...(leadName('foe', foe) ? { foe: leadName('foe', foe) } : {}) };
  b.clash = { kind: 'ult', me: [...me], foe: [...foe], shots: null, ms: 0, dur, taps: 0, winner: null, foeJoin, names };
  note(b, { t: 'ult-clash', me: [...me], foe: [...foe], names, by: u.side });
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
function endUltClash(b: TeamBattle, rng: Rng, ults?: Readonly<Record<string, string>>): void {
  const c = b.clash!;
  const sum = (side: Side, list: number[]) => list.reduce((s, i) => s + b[side][i]!.stats.ultimate, 0);
  const sure = teamClashSure(c);
  const meWins = sure ? sure === 'me' : rng.chance(clashWithTaps(clashChance(sum('me', c.me), sum('foe', c.foe)), c.taps));
  note(b, { t: 'ult-clash-end', winner: meWins ? 'me' : 'foe', sure: sure !== null, me: [...c.me], foe: [...c.foe] });
  c.winner = meWins ? 'me' : 'foe';
  const winSide: Side = meWins ? 'me' : 'foe';
  const winners = meWins ? c.me : c.foe;
  const losers = meWins ? c.foe : c.me;
  const live = winners.filter((w) => alive(b[winSide][w]!));
  b.msg = meWins ? '힘겨루기에서 이겼다!' : '힘겨루기에서 졌다…';
  b.clash = null;
  // 혼자 이겨도 짧은 마무리 (3:3 용 판 #132 — 이긴 쪽 줄기가 뚫고 터짐 · 그동안 나머지는 멈춤) · 여럿이면 합동 마무리
  if (live.length > 0) {
    // 합동 마무리 — 이긴 참가자 필살기가 합쳐 터지는 순간에 피해 (2026-10-21 태현 님 "필살기가 합쳐지듯이") · 그동안 나머지는 멈춤
    // 참가자마다 필살기를 엔진이 고름 (연출이 고르면 피해 때가 참가자 필살기에 따라 6.2 ↔ 8.2초로 달라짐 — 기획 #80 답, U2)
    // quick — 참가자 필살기는 방금 대결에서 나감 → 처음부터 다시 쓰지 않고 짧은 마무리 (#86)
    const lead = winners[0];
    const joint = { winners: live, losers: [...losers], sure: sure !== null, names: live.map((w) => (w === lead && c.names?.[winSide] ? c.names[winSide]! : (pickUlt(b, winSide, w, rng, ults).name ?? null))), quick: true as const };
    b.phase = 'ult';
    b.ult = { side: winSide, from: live[0]!, ms: 0, dur: TIMING.team.clashJointMs, hitMs: TIMING.team.clashJointHitMs, hit: false, window: 0, joinAt: null, joiners: [], joint };
    note(b, { t: 'ult', side: winSide, from: live[0]!, joint });
    return;
  }
  // 이긴 쪽이 다 쓰러짐 (반동 등) — 피해 없이 다시 달림
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

/** 칸 없이 Z 를 누르면 쏠 내 칸 — 다 찬 칸 중 먼저 찬 칸 (엔진 · 화면 "지금! [n]" 이 같이 씀) */
export function teamZSlot(b: TeamBattle): number | null {
  return firstReady(b, 'me');
}

/** 다음에 필살기를 쓸 상대 칸 — 다 찬 칸 중 먼저 찬 칸 (엔진 · 화면 "!" 칩이 같이 씀) */
export function teamFoeNext(b: TeamBattle): number | null {
  return firstReady(b, 'foe');
}

/**
 * 볼 때 저절로 나갈 내 칸 하나 — HP 30% 아래 (기다리지 않음) 먼저, 아니면 먼저 찬 칸. 기다림 (autoWait) 은 이 칸만 셈 · 화면 "N초" 칩도 이 칸 (디자인팀 UX R9 ⑥)
 */
export function teamAutoUltNext(b: TeamBattle): number | null {
  const low = (i: number) => b.me[i]!.hp < b.me[i]!.maxHp * BALANCE.autoPotionBelow;
  let best: number | null = null;
  for (let i = 0; i < b.me.length; i++) {
    const f = b.me[i]!;
    if (!alive(f) || f.ult < 1) continue;
    if (best === null || (low(i) !== low(best) ? low(i) : (b.ultReadyAt.me[i] ?? 0) < (b.ultReadyAt.me[best] ?? 0))) best = i;
  }
  return best;
}

/** 찬 지 ultAutoWaitMs 가 지난 내 포켓몬 중 먼저 찬 것 (볼 때 저절로 — R2) */
function firstWaited(b: TeamBattle): number | null {
  const left = b.me.map((_, i) => teamAutoUltLeft(b, i));
  let best: number | null = null;
  left.forEach((l, i) => {
    if (l !== 0) return;
    if (best === null || (b.ultReadyAt.me[i] ?? 0) < (b.ultReadyAt.me[best] ?? 0)) best = i;
  });
  return best;
}

/** 그 칸 필살기가 저절로 나가기까지 남은 ms (볼 때 — 발밑 판 반짝 · 막대, R2) · 안 찼으면 null */
export function teamAutoUltLeft(b: TeamBattle, slot: number): number | null {
  const f = b.me[slot];
  // 저절로 안 씀 (사용자가 눌러야만 — orders #82) 이면 늘 null (화면은 "다 참 · 1 · 2 · 3")
  if (!BALANCE.ultAutoUse || !f || !alive(f) || f.ult < 1) return null;
  // 기다림은 run 에서만 셈 — 다른 필살기 · 힘겨루기 · 합동 멘트 중엔 칩도 없음 (멈춘 숫자가 1장면 보였다 사라지던 것 — 디자인 UX R9)
  if (b.phase !== 'run') return null;
  // HP 가 30% (자동 상처약 기준) 아래면 기다리지 않음 — 3초 안에 쓰러져 필살기가 날아가던 것 (2026-10-21 태현 님 "추천대로", 기획 #26 R2 ①)
  if (f.hp < f.maxHp * BALANCE.autoPotionBelow) return 0;
  return Math.max(0, BALANCE.ultAutoWaitMs - (b.autoWait?.[slot] ?? 0));
}

// ---------- 입력 · 걸음

/**
 * 합동 필살기 멘트 — 같은 편이 필살기를 쓰고 모이는 동안 (화면: "합동 필살기! [2] 이상해꽃" · 남은 시간 막대). 없으면 null.
 * can = 지금 누르면 합류하는 칸 (키 = 칸 + 1) · team = 이미 모인 칸 (쓴 포켓몬 빼고)
 */
export function teamGather(b: TeamBattle): { side: Side; from: number; leftMs: number; totalMs: number; team: number[]; can: number[] } | null {
  const u = b.ult;
  if (b.phase !== 'ult' || !u || !((u.gather ?? 0) > 0)) return null;
  const team = u.team ?? [];
  const can = b[u.side].map((f, i) => (i !== u.from && !team.includes(i) && alive(f) && f.ult >= 1 ? i : -1)).filter((i) => i >= 0);
  return { side: u.side, from: u.from, leftMs: u.gather!, totalMs: TIMING.team.gatherMs, team: [...team], can };
}

/**
 * 큰 연출 동안 밝게 둘 칸 (2026-10-22 태현 님 #121 — 필살기 · 합동 · 힘겨루기 동안 나머지는 멈추고 흐리게): 혼자 필살기 = 쓴 포켓몬 + 맞는 상대 (범위면 상대 모두) ·
 * 합동 멘트 = 쓴 포켓몬 + 모인 · 모일 수 있는 동료 · 합동 = 참가자 + 맞는 상대 · 힘겨루기 = 참가자. 평소 (run) · 끝은 null
 */
export function teamLit(b: TeamBattle): { me: number[]; foe: number[] } | null {
  const lit = { me: [] as number[], foe: [] as number[] };
  const add = (side: Side, list: readonly number[]) => list.forEach((i) => !lit[side].includes(i) && lit[side].push(i));
  const living = (side: Side) => b[side].map((f, i) => (alive(f) ? i : -1)).filter((i) => i >= 0);
  if (b.phase === 'clash' && b.clash) {
    add('me', b.clash.me);
    add('foe', b.clash.foe);
    return lit;
  }
  const u = b.phase === 'ult' ? b.ult : null;
  if (!u) return null;
  if (u.joint) {
    add(u.side, u.joint.winners);
    add(other(u.side), u.joint.losers);
    return lit;
  }
  add(u.side, [u.from, ...(u.team ?? [])]);
  if ((u.gather ?? 0) > 0) add(u.side, teamGather(b)?.can ?? []);
  add(other(u.side), u.spread !== false || u.target === undefined ? living(other(u.side)) : [u.target]);
  return lit;
}

/** 필살기 게이지 단계 — 화면의 상대 필살기 예고 (near = ultWarnAt 넘음 · full = 다 참) · 내 발밑 판에도 씀 */
export function teamUltLevel(f: Fighter): 'none' | 'near' | 'full' {
  return !alive(f) ? 'none' : f.ult >= 1 ? 'full' : f.ult >= BALANCE.team.ultWarnAt ? 'near' : 'none';
}

/**
 * 포켓몬 크기 배율 (화면) · 0 = 3:3 잠금 — 폭 unitW × 배율이 있어야 그 배율 (240 폭 ×1 · 480 부터 ×2 · 높아도 ×3 없음 — 태현 님 #92).
 * 패널 크기를 모르면 (안 볼 때 · 아직 안 알림) 들어가는 것으로
 */
export function teamScale(view: { w: number; h: number } | null | undefined): 0 | 1 | 2 {
  if (!view) return 2;
  const { unitW } = BALANCE.team.view;
  if (teamLayout(view) === 'row') return 2;
  if (view.w >= unitW * 2) return 2;
  return view.w >= unitW ? 1 : 0;
}

/**
 * 여섯을 세우는 모양 — row = ×2 로 한 줄: 가장 낮은 패널 (높이 150 ~ 169 · 폭 400 부터, #85 A) · 폭 400 ~ 479 (×2 비스듬히가 안 들어감 — 높이와 상관없이, 기획 #24: #85 에서 버린 ×1 비스듬히 대신) ·
 * slant = 비스듬히 세 줄. 빛줄기는 머리 위 · 안내는 내 편 위 (디자인팀)
 */
export function teamLayout(view: { w: number; h: number } | null | undefined): 'row' | 'slant' {
  const { rowMinW, rowMaxH, unitW } = BALANCE.team.view;
  return view && view.w >= rowMinW && (view.h < rowMaxH || view.w < unitW * 2) ? 'row' : 'slant';
}

/** 상대 필살기에 내가 끼어들 창이 열림 (찬 포켓몬이 있을 때 — 화면 "끼어들기" 판 · 시계를 늦춤 orders #81). 상대 합동 멘트 중이면 gathering = true */
export function teamJoinOpen(b: TeamBattle): { gathering: boolean } | null {
  const u = b.ult;
  if (b.phase !== 'ult' || !u || u.side !== 'foe' || u.window <= 0 || u.hit || !b.me.some((_, i) => teamUltOpen(b, i))) return null;
  return { gathering: (u.gather ?? 0) > 0 };
}

/**
 * 전투 ×2 를 걸어도 되는 때 (orders #83) — 보통 공격 (run) 중 알아챌 순간이 화면에 없을 때만 (U1 — ×2 로 1초 아래가 되던 것, 코드 리뷰어 #83):
 * 상대 필살기 예고 (다 참 · "곧!") · 내 필살기 다 참 말풍선 (찬 지 1초) · 쓰러짐 (1초) · 말 팝업 (머릿수 등 info · 상태 이상 · 빗나감 — 1899) · 기술 힘겨루기 (1.5초 — "힘겨루기는 기본 박자", 명세 검사관)
 */
export function teamFastOk(b: TeamBattle): boolean {
  if (b.phase !== 'run' || b.moveClashes.length > 0) return false;
  // 버린 누름 한 줄 (#88) 은 알아챌 순간 — 기본 박자 (빠르게면 ×2 시계로 세어 0.4초만 보이던 것, UX 리뷰어)
  if (b.deny) return false;
  const keep = TIMING.team.fastKeepMs;
  // 다 참 (상대 "!" · 내 말풍선) 은 찬 뒤 1초만 — 상대 "!" 기다림 내내 0.8 이라 ×2 를 켜도 관장 판이 1.16배밖에 안 빨라지던 것 (디자인 UX #83 큼 — "!" 칩은 화면에 남아 U1 은 지켜짐)
  const freshFull = (side: Side) => b[side].some((f, i) => teamUltLevel(f) === 'full' && b.t - (b.ultReadyAt[side][i] ?? -Infinity) < keep);
  if (freshFull('foe') || freshFull('me')) return false;
  if (b.log.some((e) => e.t === 'faint' && b.t - e.at < keep)) return false;
  // 말 팝업 (안내 info · 상태 이상 · 빗나감 · 효과 없음 · 막음) 은 알아챌 순간 — 게임 시계 1.2초라 빠르게 (×3) 에서 0.4초만 보이던 것 (bugs 1899 · UX #134)
  return !b.popups.some((p) => WORD_POPUPS.has(p.kind));
}
/** 숫자가 아닌 말 팝업 — 떠 있는 동안 3:3 박자를 붙잡음 (teamFastOk) */
const WORD_POPUPS: ReadonlySet<string> = new Set(['info', 'immune', 'miss', 'parry', 'status']);

/** 지금 그 칸 필살기를 쓸 · 끼어들 · 합류할 수 있는지 (화면이 아이콘을 밝게) */
export function teamUltOpen(b: TeamBattle, slot: number): boolean {
  const f = b.me[slot];
  if (!f || !alive(f) || f.ult < 1) return false;
  if (b.phase === 'run') return true;
  // 맞은 뒤에는 못 끼어듦 (피해가 두 번 들어가지 않게 — 코드 리뷰어)
  if (b.phase === 'ult') {
    const u = b.ult!;
    // 상대 필살기 = 끼어들기 · 내 필살기 멘트 = 같은 편 합류
    if (u.side === 'foe') return u.window > 0 && !u.hit;
    return (u.gather ?? 0) > 0 && slot !== u.from && !(u.team ?? []).includes(slot);
  }
  return b.phase === 'clash' && b.clash!.kind === 'ult' && !b.clash!.me.includes(slot);
}

export function teamInput(b0: TeamBattle, input: TeamInput, rng: Rng, ults?: Readonly<Record<string, string>>): TeamBattle {
  if (b0.phase === 'over') return b0;
  if (input.kind === 'space') {
    // 필살기 힘겨루기는 맞닿은 뒤부터 셈 (VS 연출 동안 누른 것은 안 셈 — 화면도 그때부터 "연타")
    if (b0.phase !== 'clash' || !b0.clash || (b0.clash.kind === 'ult' && b0.clash.ms < TIMING.team.ultClashLeadMs)) return b0;
    return { ...b0, clash: { ...b0.clash, taps: b0.clash.taps + 1 } };
  }
  // 내 필살기 중 (연타 — 동료가 차 있어도 "지금은 못 써요" 가 컷인 내내 2.5초 남던 것) · 힘겨루기 중 (할 일은 Space) 의 Z 는 조용히 — 합동 멘트 창은 Z 로 합류 그대로 (UX 리뷰어 #88 2차)
  const quiet = b0.phase === 'clash' || (b0.phase === 'ult' && b0.ult?.side === 'me' && !((b0.ult.gather ?? 0) > 0));
  if (input.slot === undefined && quiet) return b0;
  const slot = input.slot ?? teamZSlot(b0);
  // Z (칸 없이) 인데 찬 포켓몬이 없음 — 버린 누름 도장 (아직 안 참)
  if (slot === null) return b0.me.some(alive) ? { ...clone(b0), deny: { slot: -1, ms: 0, why: 'charge' } } : b0;
  if (!teamUltOpen(b0, slot)) {
    // 못 쓸 때 누른 것은 버림 — 예약 없음 (2026-10-22 orders #88). 까닭 도장 1초 (화면 한 줄 — 말없이 먹지 않게, U5).
    // 이미 힘겨루기에 든 · 합동 멘트에서 쓴 · 모인 포켓몬은 조용히 (멘트 중 연타)
    const f = b0.me[slot];
    const u = b0.phase === 'ult' && b0.ult?.side === 'me' ? b0.ult : null;
    // 합동 마무리 중 참가자 (joint.winners — b.ult.team 은 비어 있음) 를 또 누름도 조용히 (방금 쓴 칸에 "아직 안 찼어요" 가 3.5초 남던 것 — UX 리뷰어 #88 2차)
    if (!f || !alive(f) || b0.phase === 'clash' || (u && (slot === u.from || (u.team ?? []).includes(slot) || (u.joint?.winners ?? []).includes(slot)))) return b0;
    const b = clone(b0);
    b.deny = { slot: input.slot === undefined ? -1 : slot, ms: 0, why: f.ult < 1 ? 'charge' : 'busy' };
    return b;
  }
  const b = clone(b0);
  // 쓴 누름은 앞서 버린 누름 한 줄을 지움 (필살기가 나가는데 "아직 안 찼어요" 가 남던 것 — 디자인 #88 캡처)
  delete b.deny;
  if (b.phase === 'run') {
    startUlt(b, 'me', slot, rng, ults);

  } else if (b.phase === 'ult' && b.ult!.side === 'me') joinTeam(b, 'me', slot);
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
  const b = teamStepOnce(b0, stepMs, rng, opts);
  // 필살기가 막 시작된 걸음에 자동 · 예약으로 바로 끼어들거나 모일 포켓몬이 있으면 같은 걸음에 (다음 걸음까지 끼어들기 · 합동 띠가
  // 한 장면 (약 70ms) 만 번쩍이던 것 — UX 리뷰어 #59, U1). 0ms 한 번 더 = 다음 걸음에 할 일을 앞당김
  if (b0.phase !== 'ult' && b.phase === 'ult' && joinsNow(b, opts.auto || opts.away)) return teamStepOnce(b, 0, rng, opts);
  return b;
}

/** 지금 필살기에 내 포켓몬이 자동 · 예약으로 바로 끼어들거나 (상대 필살기 창) 모이는지 (내 합동 멘트) */
function joinsNow(b: TeamBattle, auto: boolean): boolean {
  const u = b.ult;
  if (!u) return false;
  const ready = (i: number) => alive(b.me[i]!) && b.me[i]!.ult >= 1 && BALANCE.ultAutoUse && auto;
  if (u.side === 'foe') return u.window > 0 && !u.hit && b.me.some((_, i) => ready(i));
  return (u.gather ?? 0) > 0 && b.me.some((_, i) => i !== u.from && !(u.team ?? []).includes(i) && ready(i));
}

function teamStepOnce(b0: TeamBattle, stepMs: number, rng: Rng, opts: TeamStepOptions): TeamBattle {
  const b = clone(b0);
  b.t += stepMs;
  // 예약은 없음 (#88) — 옛 상태의 예약은 지움 · 버린 누름 도장은 1초 뒤 지움
  if (b.reserve.length) b.reserve = [];
  if (b.deny) {
    let ms = b.deny.ms + stepMs;
    // 그 사이 쓸 수 있게 되면 (화면 금색 "지금!") 그때부터 1초 넘게 — 1.2초 끝 무렵에 바뀌어 "지금!" 이 0.2초만 보이던 것 (#98 자동 판 · ux-rules U1)
    //   칸 없는 Z 는 Z 가 실제로 쏠 칸 (teamZSlot) 으로 봄 · "지금!" 뒤 그 칸을 못 쓰게 되면 (쓰러짐 · 판 끝) 도장을 지움 ("아직 안 찼어요" 로 되돌아가던 것 — 코드 리뷰어 #98)
    const d = b.deny;
    const z = d.slot >= 0 ? d.slot : teamZSlot(b);
    const go = z !== null && teamUltOpen(b, z);
    if (d.go && !go) delete b.deny;
    else {
      if (go && !d.go) ms = Math.min(ms, Math.max(0, TIMING.team.denyMs - TIMING.team.denyGoMs));
      if (ms >= TIMING.team.denyMs) delete b.deny;
      else b.deny = { ...d, ms, ...(go ? { go: true } : {}) };
    }
  }
  // 찬 때를 모르는 내 필살기 (개발 모드 게이지 가득 · 옛 상태) 는 지금부터 셈 — 저절로 쓰기 3초 (R2)
  b.me.forEach((f, i) => {
    if (alive(f) && f.ult >= 1 && b.ultReadyAt.me[i] === null) b.ultReadyAt.me[i] = b.t;
  });
  b.popups = b.popups.map((p) => ({ ...p, ms: p.ms + stepMs })).filter((p) => p.ms < POPUP_MS);
  // 내 필살기 저절로 쓰기 (끼어들기 · 합류 포함) — 꺼짐 = 사용자가 누르거나 예약한 것만 (orders #82, BALANCE.ultAutoUse)
  const auto = BALANCE.ultAutoUse && (opts.auto || opts.away);
  switch (b.phase) {
    case 'over':
      b.overMs += stepMs;
      return b;
    case 'ult': {
      const u = b.ult!;
      // 합동 필살기 멘트 동안은 필살기가 멈추고 (ms 그대로) 멘트 시간만 감
      const gathering = (u.gather ?? 0) > 0;
      if (gathering) u.gather = Math.max(0, u.gather! - stepMs);
      else u.ms += stepMs;
      u.window = Math.max(0, u.window - stepMs);
      const at = gathering ? TIMING.team.gatherMs - u.gather! : u.ms;
      // 상대 AI 가 내 필살기에 끼어듦 · 자동 전투면 내가 상대 필살기에 바로 끼어듦
      if (u.joinAt !== null && at >= u.joinAt) {
        const joiners = u.joiners.filter((i) => alive(b.foe[i]!) && b.foe[i]!.ult >= 1);
        if (joiners.length > 0) {
          startUltClash(b, 'foe', joiners, rng);
          return b;
        }
        u.joinAt = null;
      }
      // 예약해 둔 포켓몬도 끼어들기 창이 열리면 바로 끼어듦 (예약 = 차는 대로 쓰기 — 끼어들기도 쓰기)
      if (u.side === 'foe' && u.window > 0 && !u.hit) {
        const mine = b.me.map((f, i) => (alive(f) && f.ult >= 1 && auto ? i : -1)).filter((i) => i >= 0);
        if (mine.length) {
          startUltClash(b, 'me', mine, rng);
          return b;
        }
      }
      if (gathering) {
        // 같은 편 합류 — 내 편: 예약 · 자동 전투 (안 볼 때) 면 찬 포켓몬 모두 / 상대 편: 정해 둔 때
        if (u.side === 'me') {
          b.me.forEach((f, i) => {
            if (i !== u.from && !(u.team ?? []).includes(i) && alive(f) && f.ult >= 1 && auto) joinTeam(b, 'me', i);
          });
        } else {
          for (const j of u.allyAt ?? []) {
            const f = b.foe[j.slot];
            if (f && at >= j.at && j.slot !== u.from && !(u.team ?? []).includes(j.slot) && alive(f) && f.ult >= 1) joinTeam(b, 'foe', j.slot);
          }
        }
        // 내 멘트에 찬 동료가 다 모였고 상대 끼어들기도 안 걸려 있으면 바로 (자동 전투가 1.5초를 그냥 기다리지 않게 — 코드 리뷰어).
        // 상대 멘트는 끝까지 — 그 시간이 내가 받아칠 창이기도 함
        const allIn = u.side === 'me' && (u.team ?? []).length > 0 && u.joinAt === null && (teamGather(b)?.can.length ?? 0) === 0;
        if (u.gather === 0 || allIn) finishGather(b, rng, opts.ults);
        return b;
      }
      if (!u.hit && u.ms >= u.hitMs && u.joint) {
        u.hit = true;
        // 합동 마무리 — 이긴 참가자마다 자기 필살기를 진 참가자 모두에게 (합류한 위력을 다 더함 — gdd 4.7)
        // 합동 칩 ("합동!") 은 여럿일 때만 — 혼자 이긴 힘겨루기 마무리는 보통 필살기 숫자
        jointDamage = u.joint.winners.length > 1;
        try {
          for (const w of u.joint.winners) {
            if (!alive(b[u.side][w]!)) continue;
            const scale = u.joint.spread && u.joint.losers.length > 1 ? BALANCE.team.spreadScale : 1;
            for (const t of u.joint.losers) damage(b, u.side, w, t, BALANCE.ultPower, b[u.side][w]!.types[0] ?? null, rng, true, scale);
          }
        } finally {
          jointDamage = false;
        }
      }
      if (!u.hit && u.ms >= u.hitMs) {
        u.hit = true;
        // 필살기 대상 = 원작 기술대로 (기획 R7 A) — 범위기 · 옛 상태 (이름 없음) 는 상대 모두 (여럿이면 0.75배), 그 밖은 한 마리 (쓰러졌으면 다시 고름)
        const foes = b[other(u.side)];
        const type = b[u.side][u.from]!.types[0] ?? 'normal';
        const all = u.spread !== false || u.target === undefined;
        const targets = all ? foes.map((f, i) => (alive(f) ? i : -1)).filter((i) => i >= 0) : [alive(foes[u.target!]!) ? u.target! : (bestUltTarget(foes, type) ?? -1)].filter((i) => i >= 0);
        const scale = all ? (targets.length > 1 ? BALANCE.team.spreadScale : 1) : BALANCE.team.ultSingleScale;
        for (const t of targets) damage(b, u.side, u.from, t, BALANCE.ultPower, type, rng, true, scale);
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
        if (alive(f) && f.ult >= 1 && !c.me.includes(i) && auto) {
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
      if (c.ms >= c.dur) endUltClash(b, rng, opts.ults);
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
  //   상대는 먼저 찬 칸부터 (teamFoeNext — 화면 "!" 칩도 이 칸 · 찬 칸마다 따로 기다려 칩이 붙은 칸이 아닌 칸이 먼저 나가던 것, UX 리뷰어 · bugs 1775)
  const fi = teamFoeNext(b);
  if (fi !== null) {
    const [lo, hi] = BALANCE.team.foeUltWaitMs;
    const wait = b.foeUltWait[fi] ?? rng.int(lo, hi);
    b.foeUltWait[fi] = wait - stepMs;
    if (wait - stepMs <= 0) {
      b.foeUltWait[fi] = null;
      startUlt(b, 'foe', fi, rng, opts.ults);
      return b;
    }
  }
  // 내 필살기 — (저절로 쓰기가 켜졌을 때만) 볼 때는 찬 지 ultAutoWaitMs 뒤 저절로 (발밑 판이 반짝 · 자동 전투가 꺼져도) · 안 볼 때는 바로 (R2 A). 끼어들기 · 합동 멘트는 그대로 손으로
  // 기다림은 내 필살기를 쓸 수 있는 걸음 (여기까지 온 run) 에서만 셈 — 다른 필살기 · 힘겨루기 · 합동 멘트 중엔 멈춤 (0 에서 2.5 ~ 6초 서 있던 것, 디자인팀 #26 판정)
  // 안 볼 때는 지움 (안 보다 돌아오면 남은 3초가 짧아져 있던 것 — 코드 리뷰어)
  // 쌓는 건 저절로 나갈 한 칸 (화면 "N초" 칩이 뜬 칸) 만 — 찬 칸이 다 같이 쌓여 둘째 칸 칩이 1장면만 보이고 나가던 것 (디자인팀 UX R9 ⑥ U1)
  if (!opts.away && BALANCE.ultAutoUse) {
    const next = teamAutoUltNext(b);
    b.autoWait = b.me.map((_, i) => (i === next ? (b.autoWait?.[i] ?? 0) + stepMs : 0));
  }
  else if (b.autoWait) delete b.autoWait;
  // 저절로 안 씀 (orders #82) 이면 누른 것만 (예약 없음 — #88) · 안 볼 때도 멈추지 않고 보통 공격으로
  const z = !BALANCE.ultAutoUse ? null : opts.away ? firstReady(b, 'me') : firstWaited(b);
  if (z !== null) {
    startUlt(b, 'me', z, rng, opts.ults);
    return b;
  }
  // 행동 게이지 — 차면 쏨 · 기술 힘겨루기 중인 둘은 멈춤 (그동안 다른 포켓몬만 계속 — 한 포켓몬이 힘겨루기 둘을 하지 않게).
  // 시작 시각 엇갈림 (#117): 앞 기술 뒤 staggerMs 안이면 찬 채로 기다림 · 큰 연출이 겹치면 (actBlocked) 그 포켓몬만 기다리고 다음 포켓몬 · 걸음마다 먼저 볼 편을 번갈아
  // 찬 때를 칸마다 적고 먼저 찬 칸부터 (같으면 편을 걸음마다 번갈아) — 칸 번호 순이면 범위 기술 팀의 뒤 칸이 굶던 것 (테스터 #95)
  const q = (b.ready ??= { me: b.me.map(() => null), foe: b.foe.map(() => null) });
  const ready: { side: Side; i: number; at: number }[] = [];
  for (const side of ['me', 'foe'] as const) {
    b[side].forEach((f, i) => {
      if (!alive(f)) {
        q[side][i] = null;
        return;
      }
      if (b.moveClashes.some((c) => c[side].includes(i))) return;
      f.gauge = Math.min(1, f.gauge + gaugeRate(b, f) * stepMs);
      if (f.gauge >= 1) {
        q[side][i] ??= { at: b.t };
        ready.push({ side, i, at: q[side][i]!.at });
      }
    });
  }
  const meFirst = b.seq % 2 === 0;
  ready.sort((x, y) => x.at - y.at || (x.side === y.side ? x.i - y.i : (x.side === 'me') === meFirst ? -1 : 1));
  for (const { side, i } of ready) {
    if (b.lastShotAt !== undefined && b.t - b.lastShotAt < TIMING.team.staggerMs) break;
    if (!alive(b[side][i]!)) continue;
    if (act(b, side, i, rng)) q[side][i] = null;
    if ((b.phase as TeamBattle['phase']) === 'over') break;
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
    typeof s.hit === 'boolean' && typeof s.shooting === 'boolean' && typeof s.clash === 'boolean' && (s.boost === undefined || fin(s.boost, 1, 100)) && (s.contact === undefined || s.contact === true) && (s.ticked === undefined || fin(s.ticked, 0, 1e6));
  if (!Array.isArray(raw.shots) || raw.shots.length > 30 || !raw.shots.every(okShot)) return null;
  const shotIds = new Set(raw.shots.map((s: Obj) => s.id));
  const okBase = (c: Obj) => slots(c.me, 'me', 1) && slots(c.foe, 'foe', 1) && fin(c.ms, 0) && fin(c.dur, 1) && fin(c.taps, 0, 1000) && (c.winner === null || isSide(c.winner));
  const okMoveClash = (c: unknown) => isObj(c) && c.kind === 'move' && okBase(c) && Array.isArray(c.shots) && c.shots.length === 2 && c.shots.every((id) => shotIds.has(id));
  if (!Array.isArray(raw.moveClashes) || !raw.moveClashes.every(okMoveClash)) return null;
  const c = raw.clash;
  const okJoin = (j: unknown) => isObj(j) && slot(j.slot, 'foe') && fin(j.at, 0);
  // 힘겨루기 앞장 필살기 이름 (#86) — me · foe 각각 없거나 40자 안 글자
  const okLeadNames = (n: unknown) => isObj(n) && Object.keys(n).every((k) => k === 'me' || k === 'foe') && [n.me, n.foe].every((x) => x === undefined || (typeof x === 'string' && x.length <= 40));
  if (!(c === null || (isObj(c) && c.kind === 'ult' && c.shots === null && okBase(c) && (c.foeJoin === undefined || (Array.isArray(c.foeJoin) && c.foeJoin.every(okJoin))) && (c.names === undefined || okLeadNames(c.names))))) return null;
  if ((raw.phase === 'clash') !== (c !== null)) return null;
  const u = raw.ult;
  const okNames = (n: unknown, len: number) => Array.isArray(n) && n.length === len && n.every((x) => x === null || (typeof x === 'string' && x.length <= 30));
  const okJoint = (j: unknown, side: Side) =>
    isObj(j) && slots(j.winners, side, 1) && slots(j.losers, other(side), 1) && typeof j.sure === 'boolean' && (j.spread === undefined || typeof j.spread === 'boolean') &&
    (j.names === undefined || okNames(j.names, (j.winners as unknown[]).length)) && (j.quick === undefined || j.quick === true);
  const okUlt = (x: Obj) =>
    isSide(x.side) && slot(x.from, x.side) && fin(x.ms, 0) && fin(x.dur, 1) && fin(x.hitMs, 0) && typeof x.hit === 'boolean' && fin(x.window, 0) && (x.windowMs === undefined || fin(x.windowMs, 1)) && (x.joinAt === null || fin(x.joinAt, 0)) && slots(x.joiners, other(x.side)) &&
    (x.joint === undefined || okJoint(x.joint, x.side)) &&
    (x.name === undefined || (typeof x.name === 'string' && x.name.length <= 40)) && (x.spread === undefined || typeof x.spread === 'boolean') && (x.target === undefined || slot(x.target, other(x.side as Side))) &&
    (x.gather === undefined || fin(x.gather, 0, 60_000)) && (x.team === undefined || slots(x.team, x.side)) &&
    (x.allyAt === undefined || (Array.isArray(x.allyAt) && x.allyAt.every((j) => isObj(j) && slot(j.slot, x.side as Side) && fin(j.at, 0))));
  if (!(u === null || (isObj(u) && okUlt(u)))) return null;
  if ((raw.phase === 'ult') !== (u !== null)) return null;
  if (!waits(raw.foeUltWait, n.foe) || !isObj(raw.ultReadyAt) || !waits(raw.ultReadyAt.me, n.me) || !waits(raw.ultReadyAt.foe, n.foe)) return null;
  const okPopup = (p: unknown) => isObj(p) && fin(p.id, 0) && isSide(p.side) && slot(p.slot, p.side) && typeof p.text === 'string' && p.text.length <= 200 && fin(p.ms, 0) && POPUP_KINDS.includes(p.kind as string) && (p.joint === undefined || p.joint === true);
  if (!Array.isArray(raw.popups) || raw.popups.length > 12 || !raw.popups.every(okPopup)) return null;
  // 쓰러뜨린 상대 (보상 계산 — level 이 없으면 돈 · 경험치가 NaN → 세이브 검사에서 0 이 됨)
  if (!Array.isArray(raw.foeDown) || raw.foeDown.length > n.foe || !raw.foeDown.every((d) => isObj(d) && fin(d.species, 1, 2000) && fin(d.level, 1, 100))) return null;
  if (!Array.isArray(raw.fought) || raw.fought.length > n.me || !raw.fought.every((x) => typeof x === 'string')) return null;
  if (!Array.isArray(raw.reserve) || !slots(raw.reserve, 'me') || new Set(raw.reserve).size !== raw.reserve.length) return null;
  // 버린 누름 도장 (#88) — 칸 −1 ~ 2 · 지난 ms · 까닭
  const d = raw.deny;
  if (!(d === undefined || (isObj(d) && Number.isInteger(d.slot) && (d.slot as number) >= -1 && (d.slot as number) < BALANCE.team.size && fin(d.ms, 0, 1e6) && (d.why === 'charge' || d.why === 'busy') && (d.go === undefined || d.go === true)))) return null;
  if (!(raw.autoWait === undefined || (Array.isArray(raw.autoWait) && raw.autoWait.length === n.me && raw.autoWait.every((x) => fin(x, 0, 1e6))))) return null;
  // 판 시각보다 뒤면 안 읽음 (아무도 행동하지 않고 상한까지 멈추던 것 — 코드 리뷰어)
  if (!(raw.lastShotAt === undefined || fin(raw.lastShotAt, 0, typeof raw.t === 'number' ? raw.t : 0))) return null;
  const okReady = (r: unknown, side: Side) => r === null || (isObj(r) && fin(r.at, 0, typeof raw.t === 'number' ? raw.t : 0) && (r.pick === undefined || (isObj(r.pick) && fin(r.pick.moveId, 0, 100000) && slots(r.pick.targets, other(side), 1))));
  if (!(raw.ready === undefined || (isObj(raw.ready) && Array.isArray(raw.ready.me) && raw.ready.me.length === n.me && raw.ready.me.every((r) => okReady(r, 'me')) && Array.isArray(raw.ready.foe) && raw.ready.foe.length === n.foe && raw.ready.foe.every((r) => okReady(r, 'foe'))))) return null;
  const both = (e: Obj) => isSide(e.side) && slot(e.from, e.side) && slot(e.to, other(e.side));
  const pair = (v: unknown) => Array.isArray(v) && v.length === 2 && v.every((x) => fin(x, 0));
  const okNote = (e: unknown): boolean => {
    if (!isObj(e) || !fin(e.id, 1) || !fin(e.at, 0)) return false;
    switch (e.t) {
      case 'shoot':
        return fin(e.shot, 0) && isSide(e.side) && slot(e.from, e.side) && slots(e.targets, other(e.side), 1) && fin(e.moveId, 0, 100000) && fin(e.hitMs, 0) && typeof e.contact === 'boolean';
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
        return isSide(e.side) && slot(e.from, e.side) && (e.joint === undefined || okJoint(e.joint, e.side));
      case 'ult-clash':
        return slots(e.me, 'me', 1) && slots(e.foe, 'foe', 1) && (e.names === undefined || okLeadNames(e.names)) && (e.by === undefined || isSide(e.by));
      case 'ult-clash-end':
        return isSide(e.winner) && typeof e.sure === 'boolean' && slots(e.me, 'me', 1) && slots(e.foe, 'foe', 1);
      case 'ult-join':
      case 'faint':
      case 'ready':
        return isSide(e.side) && slot(e.slot, e.side);
      case 'gather':
        return isSide(e.side) && slot(e.from, e.side);
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
  // 다 찬 필살기 저절로 쓰기까지 남은 막대 (0.25초 칸 — 발밑 판 막대, R2)
  const auto = b.me.map((_, i) => { const l = teamAutoUltLeft(b, i); return l === null ? '' : Math.ceil(l / 250); }).join(',');
  return [b.phase, b.me.map(f).join(','), b.foe.map(f).join(','), auto, b.shots.map((s) => `${s.id}:${s.clash}`).join(','), b.moveClashes.map((c) => `${c.shots?.join('-')}:${Math.floor(c.ms / 100)}`).join(','), b.ult ? `${b.ult.side}${b.ult.from}:${b.ult.window > 0}:${b.ult.hit}:${Math.floor(b.ult.ms / 100)}:${Math.floor((b.ult.gather ?? 0) / 100)}:${(b.ult.team ?? []).join('')}` : '', b.clash ? `${b.clash.me.join('')}:${b.clash.foe.join('')}:${b.clash.taps}:${Math.floor(b.clash.ms / 100)}` : '', b.popups.map((p) => p.id).join(','), b.msg, b.deny ? `${b.deny.slot}${b.deny.why}` : '', b.logSeq].join('|');
}
