/**
 * S09 전투 1:1 흐름 (mvp-spec 3.3) — 보일 때(웹뷰) · 안 볼 때(확장) 같은 함수. 상태는 늘 새 객체.
 *
 *   run    행동 게이지가 참 (스피드 비율, 빠른 쪽 최대 2배)
 *   choose 내 게이지가 다 참 → 자동 전투가 꺼져 있으면 양쪽이 멈추고 내가 고를 때까지 (그동안 Z 필살기만)
 *   anim   기술 연출 (게이지 멈춤) — 상대가 쏘는 기술이면 맞받아치기 창 1.5초 · 필살기로 끼어들면 그 기술은 취소 (PP 는 깎인 채)
 *   clash  힘대결 4초 — Space · 클릭 연타, 끝나면 확률로 승패 · 진 쪽이 이긴 기술의 피해
 *   pick   내 포켓몬이 쓰러짐 → 다음 포켓몬 고르기 (자동 전투면 상성 좋은 포켓몬)
 *   catch  볼을 던짐 (S11) — 타이밍 원 1.2초 (Space · 클릭) → 흔들흔들 → 잡힘 (끝) · 빠져나옴 (전투 계속, 마지막 기회면 이김)
 *   last   야생을 쓰러뜨림 → 마지막 기회 (볼 고르기 · 안 던짐 · 6초) — 볼이 없거나 내 팀이 다 쓰러졌으면 건너뜀
 *   send   트레이너 · 관장이 다음 포켓몬을 내보냄 (1:1 토너먼트 — 내 포켓몬은 HP 그대로, gdd S08 ③)
 *   over   이김 · 짐 · 도망 · 잡음 — 잠깐 보여 주고 끝 (세이브에 돌려주는 건 play.ts)
 * 상대 필살기 (gdd 4.7): 야생 = 다 찬 뒤 1초 · 트레이너 = 1 ~ 3초 기다렸다가 (게이지가 도는 동안만 셈 — 예고 "!" 가 1초는 보이게, 기획 #26 R4) · 관장 = 내 공격 · 기술 연출에 끼어듦.
 *   트레이너 · 관장은 내 필살기를 필살기로 맞받아침 (관장은 늘 · 트레이너는 반) — "상대도 마찬가지"
 * 전투 중에는 세이브를 바꾸지 않음 (껐다 켜면 그 전투를 처음부터, mvp-spec 9장) — 끝날 때 HP · PP · 상태 이상 · 쓴 아이템을 한 번에.
 */
import { BALANCE, TIMING } from '../balance';
import {
  aiPick,
  bestNext,
  clashChance,
  canInflict,
  clashWithTaps,
  computeDamage,
  fighterOf,
  fleeChance,
  gaugeRate,
  guardFactor,
  parryGrade,
  type ParryGrade,
  streakMultiplier,
  ultGain,
  type Fighter,
} from '../rules/battle';
import { BALLS, catchChance, catchOdds, catchTiming, isBall, type BallId } from '../rules/catch';
import { healAmount, isHealItem } from '../rules/bag';
import { itemName } from '../rules/items';
import { effectiveness, effectivenessText } from '../rules/types';
import { ITEM_IDS, type EncounterStart, type ItemId, type Monster, type MoveSlot, type Save, type StatusCondition } from '../save';
import { withJosa } from '../text';
import { moveOf, speciesOf, type ReadonlyMove } from '../../data';
import type { Rng } from './rng';

export type Side = 'me' | 'foe';
/** 야생 · 트레이너 (스테이지) · 관장 (체육관) */
export type BattleKind = 'wild' | 'trainer' | 'gym';

export type BattleAction =
  | { kind: 'attack' }
  | { kind: 'move'; moveId: number }
  | { kind: 'guard' }
  /** uid = 기력의조각으로 살릴 포켓몬 */
  | { kind: 'item'; item: ItemId; uid?: string }
  | { kind: 'switch'; uid: string }
  | { kind: 'flee' }
  | { kind: 'ult' }
  /** 반격기 (완벽 패링 → 두 번째 원도 완벽) — 그 포켓몬 필살기를 짧게, 피해는 필살기의 절반 · 게이지는 안 씀 (2026-10-20) */
  | { kind: 'riposte' }
  /** 잠듦 · 마비로 못 움직임 — why = 잠 · 이번에 깸 · 마비 (연출용, 예전 저장엔 없음) */
  | { kind: 'skip'; why?: 'sleep' | 'wake' | 'paralysis' };

export interface BattleAnim {
  side: Side;
  action: BattleAction;
  ms: number;
  dur: number;
  /** 상대가 쏘는 기술 — 막으면 (패링) 힘대결로 이어질 수 있음 (나에게 쏘는 기술이 있을 때) */
  counter: boolean;
  /** 패링 (상대 공격일 때, 한 번만) — 처음 누른 등급. good · perfect 면 피해가 줄어듦 (2026-10-19) */
  parry?: ParryGrade;
  /** 기술이 빗나감 — 행동 시작 때 정함 (연출이 미리 알고 피하는 모양을 그리게, 2026-10-20). 기술 행동에만 있고, 옛 세이브에 없으면 맞는 순간 정함 */
  miss?: boolean;
}

/** 반격 기회 (2026-10-20 태현 님) — 완벽 패링 뒤 상대 둘레에 두 번째 원이 좁혀짐, ms === dur 이 맞는 때 (창은 패링과 같음) */
export interface BattleRiposte {
  ms: number;
  dur: number;
}

export interface BattleClash {
  kind: 'move' | 'ult';
  /** 각자 나간 기술 (필살기면 null) */
  me: number | null;
  foe: number | null;
  /** 내가 이길 기본 확률 */
  base: number;
  taps: number;
  ms: number;
  /** 4초가 지나 정해진 승자 — 이긴 줄기가 뚫고 나가는 동안 (TIMING.clashResultMs) 보여 주고 피해 */
  winner: Side | null;
}

/** S11 볼 던지기 (2026-10-20 태현 님 다시 기획) — 서 있는 상대 둘레에서 원이 줄어드는 동안 Space = 그때 던짐 (pressMs · throwMs, 안 누르면 원이 끝날 때 저절로)
 *  → 던진 순간 잡힘 · 흔들 횟수가 정해짐 → 날아감 · 빨려 들어감 · 떨어짐 · 흔들 × shakes (가운데 창) → 결과 (catchTimeline) */
export interface BattleCatch {
  ball: BallId;
  ms: number;
  pressMs: number | null;
  /** 던진 때 (ms 기준) — null = 아직 원이 줄어드는 중. 옛 상태에는 없음 (readBattle 이 채움) */
  throwMs?: number | null;
  /** 흔들 횟수 — 잡히면 3 · 놓치면 1 ~ 3 (던질 때 정함) */
  shakes?: number;
  /** 이긴 뒤 마지막 기회 (쓰러진 포켓몬에게 한 번 — 확률 × 0.5) */
  last: boolean;
  caught: boolean | null;
  /** 던진 때 (전투 시간) — 그림이 다시 그려져도 같은 볼 · 같은 원으로 이어지게 */
  startT: number;
}

/** 머리 위에 잠깐 뜨는 글 (피해 숫자 · 효과가 굉장했다! · 급소) */
export interface BattlePopup {
  /** 순번 — 같은 걸음에 같은 글이 두 번 떠도 따로 그리게 */
  id: number;
  side: Side;
  text: string;
  ms: number;
  /** 글 종류 — 화면이 숫자 크기 · 말 칸으로 나눠 씀 (2026-10-20 디자인 세션): 상성 super · weak · immune, 급소 crit, 빗나감 miss, 막음 parry, 상태 status, 나머지 info */
  kind: 'damage' | 'heal' | 'info' | 'super' | 'weak' | 'immune' | 'crit' | 'miss' | 'parry' | 'status';
}

export interface BattleState {
  kind: BattleKind;
  me: Fighter;
  foe: Fighter;
  /** 트레이너 · 관장: 아직 안 나온 상대 포켓몬 (차례대로) */
  foeQueue: Monster[];
  /** 쓰러뜨린 상대 (경험치 · 돈) */
  foeDown: { species: number; level: number }[];
  /** 상대 필살기를 쓰기까지 남은 기다림 (트레이너 · 관장, 게이지가 찬 뒤) */
  foeUltWait: number | null;
  /** 내 필살기가 다 찬 뒤 기다린 ms (자동 전투 · 볼 때 — ultAutoWaitMs 가 되면 저절로, R2) · Z 를 누를 수 있을 때만 셈 · 안 찼으면 없음 (옛 상태에도 없음) */
  ultWait?: number;
  /** Z 를 못 누르는 때 (내 행동 연출 중) 누른 필살기 — 누를 수 있게 되면 바로 씀 (말없이 버려지던 것, U5) */
  ultQueued?: boolean;
  /** 자동 전투 — 내 포켓몬이 쓰러진 뒤 다음 포켓몬까지 기다린 ms (볼 때 autoPickMs, #530) · 옛 상태엔 없음 */
  pickMs?: number;
  /** 상대 트레이너 이름 ("곤충채집 소년 민수") — 야생은 null */
  foeName: string | null;
  /** 관장이 남긴 상처약 (2026-10-20) — 관장전만, 옛 상태에는 없음 (= 0) */
  foePotions?: number;
  /** 반격 기회 (phase riposte 일 때만) */
  riposte?: BattleRiposte | null;
  /** 볼을 세 번 다 놓쳐 상대가 도망침 (result flee 와 같이 — 화면이 뛰어나가는 상대를 그림, 2026-10-20) */
  escaped?: boolean;
  /** 이 전투의 완벽 패링 수 — 두 번째부터 쳐올리기 · 보여 주기를 짧게 (2026-10-21 ideas #127, 옛 상태엔 없음) */
  perfects?: number;
  /** 내가 지난번에 고른 공격 · 기술 · 막기 — Enter 로 다시 (ideas #22) */
  lastMe?: BattleAction;
  /** 미리 누른 행동 — 게이지가 차자마자 (ideas #31) */
  queued?: BattleAction | null;
  /** send — 다음 포켓몬을 내보내는 데 지난 시간 */
  sendMs: number;
  /** 이 전투에서 바뀐 내 포켓몬 (교체로 나온 포켓몬의 HP · PP · 상태) — 끝나면 세이브에 */
  bench: Record<string, { hp: number; moves: MoveSlot[]; status: StatusCondition | null; ult?: number }>;
  /** 이 전투에서 쓴 아이템 (끝나면 가방에서 뺌) */
  bagUsed: Partial<Record<ItemId, number>>;
  /** catch = 볼을 던짐 (S11) · last = 이긴 뒤 마지막 기회 (볼을 고르거나 그냥 지나감) */
  phase: 'run' | 'choose' | 'anim' | 'clash' | 'pick' | 'catch' | 'last' | 'send' | 'over' | 'riposte';
  anim: BattleAnim | null;
  clash: BattleClash | null;
  catch: BattleCatch | null;
  /** 마지막 기회를 기다린 시간 */
  lastMs: number;
  result: 'win' | 'lose' | 'flee' | 'catch' | null;
  /** 이 전투에 나와 싸운 내 포켓몬 (경험치를 다 받음 — 나머지는 절반) */
  fought: string[];
  overMs: number;
  fleeTries: number;
  /** 지금 한 줄 ("이상해씨의 덩굴채찍!") */
  msg: string;
  popups: BattlePopup[];
  popupSeq: number;
  /** 전투 시간 · 마지막으로 필살기를 시작한 때 (양쪽이 0.3초 안에 쓰면 자동 힘대결) */
  t: number;
  ultAt: { me: number | null; foe: number | null };
  start: EncounterStart;
}

export const POPUP_MS = 1200;
const nameOf = (f: Fighter) => speciesOf(f.species)?.name.ko ?? '???';
/** 한 줄에 쓰는 이름 — 상대는 "야생 ○○" · "상대 ○○" */
const label = (b: BattleState, side: Side) => (side === 'foe' ? `${b.kind === 'wild' ? '야생' : '상대'} ${nameOf(b.foe)}` : nameOf(b.me));
/** 상대 AI 성격 — 야생은 무작위, 트레이너 · 관장은 상성을 봄 */
const foeStyle = (b: BattleState) => (b.kind === 'wild' ? 'wild' : 'smart');
const other = (s: Side): Side => (s === 'me' ? 'foe' : 'me');
/** 내 차례 한 줄 — 곁눈으로 봐도 "기다리는 중" 인 걸 알게 */
// 메뉴에 숫자가 이미 있어서 "(1 ~ 5)" 는 뺌 (아트 디렉터 2차, 2026-10-19)
const chooseMsg = (b: BattleState) => `${withJosa(nameOf(b.me), '은/는')} 무엇을 할까?`;

/** 나갈 포켓몬 = 쓰러지지 않은 첫 포켓몬 (mvp-spec 3.3) */
export function firstAlive(save: Save): Monster | null {
  for (const uid of save.party) {
    const m = save.monsters[uid];
    if (m && m.hp > 0) return m;
  }
  return null;
}

/** 전투 시작 — 선제공격 = 내 게이지가 꽉 찬 채 · 기습 = 상대 게이지가 꽉 찬 채 · 보통 = 둘 다 0 (4장) */
export function startBattle(save: Save, wild: Monster, start: EncounterStart): BattleState {
  const lead = firstAlive(save);
  const me = lead ? fighterOf(lead) : { ...fighterOf(wild), uid: 'none', hp: 0 };
  const foe = fighterOf(wild);
  if (start === 'preemptive') me.gauge = 1;
  if (start === 'ambush') foe.gauge = 1;
  const b: BattleState = {
    kind: 'wild',
    me,
    foe,
    foeQueue: [],
    foeDown: [],
    foeUltWait: null,
    foeName: null,
    sendMs: 0,
    bench: {},
    bagUsed: {},
    phase: lead ? 'run' : 'over',
    anim: null,
    clash: null,
    catch: null,
    lastMs: 0,
    result: lead ? null : 'lose',
    fought: lead ? [lead.uid] : [],
    overMs: 0,
    fleeTries: 0,
    msg: !lead ? '싸울 수 있는 포켓몬이 없다…' : start === 'preemptive' ? '선제공격!' : start === 'ambush' ? '기습당했다!' : `가랏, ${nameOf(me)}!`,
    popups: [],
    popupSeq: 0,
    t: 0,
    ultAt: { me: null, foe: null },
    start,
  };
  return b;
}

/**
 * 트레이너 · 관장 1:1 토너먼트 (gdd S08 ③ · 3.9) — 상대 포켓몬이 차례대로 나옴 (도망 · 볼 없음).
 * 관장의 마지막 포켓몬 (에이스) 은 필살기 게이지가 절반 찬 채로 나옴
 */
export function startTrainerBattle(save: Save, team: readonly Monster[], kind: 'trainer' | 'gym', foeName: string): BattleState {
  const [first, ...rest] = team;
  if (!first) throw new Error('상대 포켓몬이 없음');
  const b = startBattle(save, first, 'normal');
  if (kind === 'gym' && rest.length === 0) b.foe.ult = BALANCE.gymAceUlt;
  const lead = b.me.uid !== 'none';
  return {
    ...b,
    kind,
    foeQueue: rest.map((m) => ({ ...m })),
    foeName,
    ...(kind === 'gym' ? { foePotions: BALANCE.gymPotions } : {}),
    msg: lead ? `${withJosa(foeName, '이/가')} ${withJosa(nameOf(b.foe), '을/를')} 내보냈다! 가랏, ${nameOf(b.me)}!` : b.msg,
  };
}

/** 이 전투에서 던진 볼 수 (던지는 중인 볼 포함) — 한 마리에 BALANCE.catchTries 번까지 (2026-10-20 태현 님) */
export function catchTriesUsed(b: BattleState): number {
  return BALLS.reduce((n, ball) => n + (b.bagUsed[ball] ?? 0), 0);
}

/** 잡기 시간표 (catch.ms 기준) — 던짐 · 볼이 열림 (빨려 들어감) · 떨어짐 · 흔들기 시작 · 딸깍 · 터짐 · 끝. 아직 안 던졌으면 null */
export function catchTimeline(c: BattleCatch): { thrown: number; open: number; drop: number; shake: number; end: number; done: number } | null {
  if (c.throwMs === null || c.throwMs === undefined) return null;
  const open = c.throwMs + TIMING.catchFlyMs;
  const drop = open + TIMING.catchSuckMs;
  const shake = drop + TIMING.catchDropMs;
  const end = shake + (c.shakes ?? 0) * TIMING.catchShakeMs;
  return { thrown: c.throwMs, open, drop, shake, end, done: end + TIMING.catchEndMs + (c.caught ? 0 : TIMING.catchFailPauseMs) };
}

/** 자동 전투 상처약 — 설정이 켜져 있고 (없으면 켬) HP 가 최대의 30% 아래면 모자란 만큼에 맞는 약 (상처약 → 좋은상처약 순, 둘 다 없으면 null) */
export function autoPotion(b: BattleState, save: Save): ItemId | null {
  if (save.settings.autoPotion === false || b.me.hp <= 0 || b.me.hp >= b.me.maxHp * BALANCE.autoPotionBelow) return null;
  const missing = b.me.maxHp - b.me.hp;
  // 모자란 만큼에 맞는 약부터 (상처약 → 좋은 → 고급 — 풀회복약은 아껴 안 씀)
  const order: ItemId[] = missing > BALANCE.superPotionHeal ? ['hyper-potion', 'super-potion', 'potion'] : missing > BALANCE.potionHeal ? ['super-potion', 'hyper-potion', 'potion'] : ['potion', 'super-potion', 'hyper-potion'];
  return order.find((item) => itemLeft(b, save, item) > 0) ?? null;
}

/** 지금 가방에 남은 그 아이템 수 (전투 중 쓴 것 빼고) */
export function itemLeft(b: BattleState, save: Save, item: ItemId): number {
  return Math.max(0, (save.bag[item] ?? 0) - (b.bagUsed[item] ?? 0));
}

/** 지금 나와 있지 않은 내 팀 (이 전투에서 바뀐 HP · PP · 상태로) */
function benchTeam(b: BattleState, save: Save): Monster[] {
  return save.party
    .map((uid) => save.monsters[uid])
    .filter((m): m is Monster => !!m && m.uid !== b.me.uid)
    .map((m) => {
      const c = b.bench[m.uid];
      return c ? { ...m, hp: c.hp, moves: c.moves, status: c.status } : m;
    });
}

/** 교체할 수 있는 내 포켓몬 (지금 나와 있지 않고 쓰러지지 않음) */
export function switchable(b: BattleState, save: Save): Monster[] {
  return benchTeam(b, save).filter((m) => m.hp > 0);
}

/** 기력의조각으로 살릴 수 있는 내 포켓몬 (쓰러진 팀 포켓몬) */
export function faintedTeam(b: BattleState, save: Save): Monster[] {
  return benchTeam(b, save).filter((m) => m.hp <= 0);
}

/** 상성 배수 → 글 종류 (effectivenessText 와 같은 경계) */
function effectKind(mult: number): BattlePopup['kind'] {
  return mult === 0 ? 'immune' : mult > 1 ? 'super' : 'weak';
}

function popup(b: BattleState, side: Side, text: string, kind: BattlePopup['kind']): void {
  b.popupSeq += 1;
  b.popups = [...b.popups.slice(-5), { id: b.popupSeq, side, text, ms: 0, kind }];
}

function moveName(id: number): string {
  return moveOf(id)?.name.ko ?? '기술';
}

/** 행동 하나 시작 — 게이지 0 · PP · 방어 · 연달아 세짐 · 맞받아치기 창 · 연출 시간 */
function startAction(b0: BattleState, side: Side, action0: BattleAction, rng: Rng): BattleState {
  const b: BattleState = { ...b0, me: { ...b0.me }, foe: { ...b0.foe } };
  const actor = b[side];
  let action = action0;
  // 필살기 · 반격기는 끼어드는 것이라 행동 게이지 · 방어를 안 건드림
  const free = action.kind === 'ult' || action.kind === 'riposte';
  if (!free) actor.gauge = 0;
  // 방어는 다음 내 행동까지 — 내 차례가 오면 풀림
  if (!free) actor.guard = 1;

  // 잠듦 · 마비 (원작 규칙 [제안]) — 필살기는 막지 않음
  if (!free && action.kind !== 'switch' && action.kind !== 'item' && action.kind !== 'flee') {
    const st = actor.status;
    if (st?.kind === 'sleep') {
      const left = st.turnsLeft - 1;
      actor.status = left > 0 ? { kind: 'sleep', turnsLeft: left } : null;
      action = { kind: 'skip', why: left > 0 ? 'sleep' : 'wake' };
      b.msg = left > 0 ? `${withJosa(label(b, side), '은/는')} 쿨쿨 잠들어 있다` : `${withJosa(label(b, side), '이/가')} 눈을 떴다!`;
    } else if (st?.kind === 'paralysis' && rng.chance(BALANCE.paralysisSkip)) {
      action = { kind: 'skip', why: 'paralysis' };
      b.msg = `${withJosa(label(b, side), '은/는')} 몸이 저려 움직일 수 없다!`;
    }
  }

  if (action.kind !== 'guard' && !free) actor.guardStreak = 0;
  // 연달아 세지는 기술: 같은 기술을 또 쓰면 +1, 다른 행동이면 처음부터 (필살기는 아무 때나 끼어드는 것이라 그대로)
  if (!free) {
    const mv = action.kind === 'move' ? moveOf(action.moveId) : undefined;
    if (mv?.streak && actor.streakMove === mv.id) actor.streakCount += 1;
    else {
      actor.streakMove = mv?.streak ? mv.id : null;
      actor.streakCount = 0;
    }
  }
  let dur: number = TIMING.attackAnimMs;
  const counter = false;
  let miss: boolean | undefined;
  switch (action.kind) {
    case 'attack':
      b.msg = `${label(b, side)}의 공격!`;
      break;
    case 'move': {
      const id = action.moveId;
      actor.moves = actor.moves.map((s) => (s.moveId === id ? { ...s, pp: Math.max(0, s.pp - 1) } : s));
      const mv = moveOf(id);
      b.msg = `${label(b, side)}의 ${moveName(id)}!`;
      dur = TIMING.moveAnimMs;
      // 명중은 지금 정함 (맞는 순간에 정하면 연출이 모르고 임팩트를 터뜨림 — 빗나가면 피하는 모양)
      miss = !!mv && mv.accuracy !== null && !rng.chance(mv.accuracy / 100);
      // 쏘는 기술끼리 맞받아치기 힘대결은 없앰 (2026-10-20 태현 님 — 패링 = 피하거나 쳐냄 · 완벽 두 번이면 반격기)
      break;
    }
    case 'guard':
      actor.guard = guardFactor(actor.guardStreak);
      actor.guardStreak += 1;
      b.msg = actor.guard < 1 ? `${withJosa(label(b, side), '은/는')} 몸을 지켰다!` : `${withJosa(label(b, side), '은/는')} 몸을 지키려 했지만 지쳤다…`;
      dur = TIMING.guardAnimMs;
      break;
    case 'item':
      // 상대 (관장) 가 쓰면 "관장 웅이는 상처약을 썼다!"
      b.msg = side === 'foe' ? `${withJosa(b.foeName ?? '상대', '은/는')} ${withJosa(itemName(action.item), '을/를')} 썼다!` : `${withJosa(itemName(action.item), '을/를')} 썼다!`;
      dur = TIMING.itemAnimMs;
      break;
    case 'switch':
      b.msg = `돌아와, ${nameOf(actor)}!`;
      dur = TIMING.switchAnimMs;
      break;
    case 'flee':
      b.msg = '도망칠 곳을 찾는 중…';
      dur = TIMING.fleeAnimMs;
      break;
    case 'ult':
      actor.ult = 0;
      b.ultAt = { ...b.ultAt, [side]: b.t };
      b.msg = `${label(b, side)}의 필살기!`;
      dur = TIMING.ultAnimMs;
      break;
    case 'riposte':
      b.msg = `${label(b, side)}의 반격!`;
      dur = TIMING.ultAnimMs;
      break;
    case 'skip':
      dur = TIMING.guardAnimMs;
      break;
  }
  return { ...b, phase: 'anim', anim: { side, action, ms: 0, dur, counter, ...(miss === undefined ? {} : { miss }) } };
}

/** 피해를 주고 필살기 게이지 · 글을 남김 */
function hit(b: BattleState, attackerSide: Side, power: number, type: ReadonlyMove['type'] | null, rng: Rng, opts: { useUlt?: boolean; riposte?: boolean; move?: ReadonlyMove } = {}): number {
  const a = b[attackerSide];
  const d = b[other(attackerSide)];
  const guarded = d.guard < 1;
  const r = computeDamage({ attacker: a, defender: d, power, type, useUlt: opts.useUlt, rng });
  let dmg = r.damage;
  // 패링 (상대 공격을 막음) — 피해 ×0.5 · 완벽 ×0 + 내 행동 게이지 (2026-10-19)
  const parried = attackerSide === 'foe' && !opts.useUlt ? b.anim?.parry : undefined;
  if (parried === 'good' || parried === 'perfect') {
    dmg = Math.floor(dmg * (parried === 'perfect' ? BALANCE.parryPerfectFactor : BALANCE.parryGoodFactor));
    popup(b, 'me', parried === 'perfect' ? '완벽 패링!' : '패링!', 'parry');
    if (parried === 'perfect') b.perfects = (b.perfects ?? 0) + 1;
    if (parried === 'perfect') d.gauge = Math.min(1, d.gauge + BALANCE.parryPerfectGauge);
  }
  if (opts.move?.effect === 'leave-1hp') dmg = Math.min(dmg, Math.max(0, d.hp - 1));
  // 실제로 깎인 HP — 남은 HP 보다 큰 피해는 넘치는 만큼 버림 (흡수 · 반동 · 숫자도 이 값으로, 원작처럼)
  const before = d.hp;
  d.hp = Math.max(0, d.hp - dmg);
  dmg = before - d.hp;
  // 막아서 피해가 0 이면 (완벽 · 또는 막음인데 피해 1 → 0) "-0" · 상성 글은 안 띄움 (막았는지 맞았는지 헷갈려서 — 플레이 리뷰어 · 테스터, 2026-10-20)
  const blocked = (parried === 'good' || parried === 'perfect') && dmg === 0;
  if (!blocked) popup(b, other(attackerSide), `-${dmg}`, 'damage');
  const eff = effectivenessText(r.effect);
  if (eff && !blocked) popup(b, other(attackerSide), eff, effectKind(r.effect));
  if (r.crit && dmg > 0) popup(b, other(attackerSide), '급소에 맞았다!', 'crit');
  // 필살기 게이지는 패링 전 피해로 — 막아도 (완벽 = 피해 0) 맞은 것처럼 나 · 상대 모두 참 (패링은 HP 만 지킴, 2026-10-21 기획 검토 R1 A — 패링을 잘할수록 필살기가 줄던 것)
  const parriedHit = (parried === 'good' || parried === 'perfect') && r.damage > 0;
  if (dmg > 0 || parriedHit) {
    // × 0.5 는 야생 포켓몬만 (트레이너 · 관장 포켓몬은 그대로 — 테스터)
    const wild = b.kind === 'wild';
    // 반격기는 필살기 위력이어도 보통 공격처럼 게이지가 참 (2026-10-21 태현 님 A — 패링을 잘할수록 필살기를 못 보던 것, 10-20 "안 채움" 을 바꿈)
    if (!opts.useUlt || opts.riposte) a.ult = Math.min(1, a.ult + ultGain('hit', a, { wild: wild && attackerSide === 'foe' }));
    d.ult = Math.min(1, d.ult + ultGain('hurt', d, { guarded, wild: wild && attackerSide === 'me' }));
  }
  // 흡수 (+) · 반동 (−)
  if (opts.move && opts.move.drain !== 0 && dmg > 0) {
    const amount = Math.floor((dmg * Math.abs(opts.move.drain)) / 100);
    if (opts.move.drain > 0) {
      a.hp = Math.min(a.maxHp, a.hp + amount);
      if (amount > 0) popup(b, attackerSide, `+${amount}`, 'heal');
    } else {
      a.hp = Math.max(0, a.hp - amount);
      if (amount > 0) popup(b, attackerSide, `-${amount}`, 'damage');
    }
  }
  return dmg;
}

/** 상태 이상 걸기 — 한 포켓몬에 하나만 */
function inflict(b: BattleState, side: Side, ailment: NonNullable<ReadonlyMove['ailment']>, rng: Rng): void {
  const f = b[side];
  if (f.status || f.hp <= 0) return;
  const [lo, hi] = BALANCE.sleepTurns;
  f.status = ailment === 'sleep' ? { kind: 'sleep', turnsLeft: rng.int(lo, hi) } : { kind: ailment };
  const text = { poison: '독에 걸렸다!', burn: '화상을 입었다!', paralysis: '마비되었다!', sleep: '잠들었다!' }[ailment];
  popup(b, side, text, 'status');
}

/** 행동이 끝날 때 독 · 화상 피해 */
function afterAction(b: BattleState, side: Side): void {
  const f = b[side];
  if (f.hp <= 0 || !f.status) return;
  const part = f.status.kind === 'poison' ? BALANCE.poisonDamage : f.status.kind === 'burn' ? BALANCE.burnDamage : 0;
  if (part <= 0) return;
  const dmg = Math.max(1, Math.floor(f.maxHp * part));
  f.hp = Math.max(0, f.hp - dmg);
  popup(b, side, `-${dmg}`, 'damage');
}

/** 기술 하나 끝 — 명중 · 피해 · 상태 이상 */
function resolveMove(b: BattleState, side: Side, mv: ReadonlyMove | undefined, rng: Rng, powerScale = 1, miss?: boolean): void {
  const target = other(side);
  if (!mv) return;
  // 명중은 행동 시작 때 정한 것 (옛 세이브에 없으면 지금)
  if (miss ?? (mv.accuracy !== null && !rng.chance(mv.accuracy / 100))) {
    // 빗나갈 상대 공격을 막았으면 (패링) "피했다!" — 완벽 보상 (게이지) 은 그대로 (잘 눌렀는데 보상이 사라지지 않게, 2026-10-20 플레이 리뷰어)
    const parried = side === 'foe' ? b.anim?.parry : undefined;
    if (parried === 'good' || parried === 'perfect') {
      popup(b, 'me', parried === 'perfect' ? '완벽 패링!' : '패링!', 'parry');
      if (parried === 'perfect') b.perfects = (b.perfects ?? 0) + 1;
      if (parried === 'perfect') b.me.gauge = Math.min(1, b.me.gauge + BALANCE.parryPerfectGauge);
      return;
    }
    popup(b, target, '빗나갔다!', 'miss');
    return;
  }
  if (mv.class !== 'status' && mv.power > 0) hit(b, side, Math.round(mv.power * powerScale), mv.type, rng, { move: mv });
  if (!mv.ailment) return;
  if (side === 'foe' && b.anim?.parry === 'perfect') return; // 완벽하게 막으면 상태 이상도 안 걸림
  // 효과가 없는 상대 (상성 0 · 타입 면역) 에게는 상태 이상도 안 걸림
  if (!canInflict(mv.ailment, mv.type, b[target].types)) {
    if (mv.class === 'status') popup(b, target, '효과가 없는 것 같다…', 'immune');
    return;
  }
  if (rng.chance(mv.ailmentChance / 100)) inflict(b, target, mv.ailment, rng);
}

function finishAnim(b0: BattleState, save: Save, rng: Rng): BattleState {
  const b: BattleState = { ...b0, me: { ...b0.me }, foe: { ...b0.foe }, popups: [...b0.popups] };
  const anim = b.anim!;
  const side = anim.side;
  const actor = b[side];
  switch (anim.action.kind) {
    case 'attack':
      hit(b, side, BALANCE.attackPower, null, rng);
      break;
    case 'move': {
      const mv = moveOf(anim.action.moveId);
      // 연달아 세지는 기술: 이번이 n 번째 연달아면 × (1 + 0.1 × (n − 1))
      resolveMove(b, side, mv, rng, mv?.streak ? streakMultiplier(actor.streakCount) : 1, anim.miss);
      break;
    }
    case 'item': {
      const item = anim.action.item;
      // 내 가방에서 쓴 것만 셈 (관장 상처약은 관장 것)
      if (side === 'me') b.bagUsed = { ...b.bagUsed, [item]: (b.bagUsed[item] ?? 0) + 1 };
      if (isHealItem(item)) {
        const heal = healAmount(item, actor.maxHp - actor.hp) ?? 0;
        const cured = item === 'full-restore' && actor.status !== null;
        actor.hp += heal;
        if (item === 'full-restore') actor.status = null;
        // HP 가득 + 상태 이상만 고친 풀회복약은 "+0" 대신 상태 회복약 말 (필드와 같게 — 코드 리뷰어 #75)
        if (heal > 0 || !cured) popup(b, side, `+${heal}`, 'heal');
        else popup(b, side, '몸이 개운해졌다!', 'status');
      } else if (item === 'full-heal') {
        actor.status = null;
        popup(b, side, '몸이 개운해졌다!', 'status');
      } else if (item === 'revive' && anim.action.uid) {
        // 쓰러진 팀 포켓몬을 HP 절반으로 (나와 있는 포켓몬이 아니라 교체로 낼 포켓몬)
        const m = faintedTeam(b, save).find((x) => x.uid === (anim.action as { uid?: string }).uid);
        if (m) {
          const hp = Math.max(1, Math.floor(fighterOf({ ...m, hp: 99999 }).maxHp * BALANCE.reviveFraction));
          b.bench = { ...b.bench, [m.uid]: { hp, moves: m.moves, status: null, ult: b.bench[m.uid]?.ult ?? BALANCE.ultStart } };
          b.msg = `${withJosa(speciesOf(m.species)?.name.ko ?? m.form, '이/가')} 기운을 차렸다! (HP ${hp})`;
        }
      }
      break;
    }
    case 'switch': {
      const target = save.monsters[anim.action.uid];
      if (target) {
        // 독 · 화상은 들어가는 포켓몬이 받음 (행동한 쪽) — 나오는 포켓몬이 아니라
        afterAction(b, side);
        // 필살기 게이지는 포켓몬마다 — 들어가도 그대로, 다시 나오면 이어서
        b.bench = { ...b.bench, [b.me.uid]: { hp: b.me.hp, moves: b.me.moves, status: b.me.status, ult: b.me.ult } };
        const saved = b.bench[target.uid];
        const next = fighterOf(saved ? { ...target, ...saved } : target);
        next.ult = saved?.ult ?? BALANCE.ultStart;
        b.me = next;
        if (!b.fought.includes(next.uid)) b.fought = [...b.fought, next.uid];
        b.msg = `가랏, ${nameOf(next)}!`;
      }
      break;
    }
    case 'flee':
      if (rng.chance(fleeChance(b.me.stats.speed, b.foe.stats.speed, b.fleeTries))) {
        b.msg = '무사히 도망쳤다!';
        return { ...b, phase: 'over', result: 'flee', anim: null, overMs: 0 };
      }
      b.fleeTries += 1;
      b.msg = '도망칠 수 없었다!';
      break;
    case 'ult':
      hit(b, side, BALANCE.ultPower, actor.types[0] ?? null, rng, { useUlt: true });
      break;
    case 'riposte':
      hit(b, side, Math.round(BALANCE.ultPower * BALANCE.riposteUltFactor), actor.types[0] ?? null, rng, { useUlt: true, riposte: true });
      break;
    case 'guard':
    case 'skip':
      break;
  }
  if (anim.action.kind !== 'ult' && anim.action.kind !== 'riposte' && anim.action.kind !== 'switch') afterAction(b, side);
  const after = afterHits({ ...b, anim: null }, save);
  // 완벽 패링 뒤 둘 다 서 있으면 반격 기회 — 상대 둘레에 두 번째 원 (2026-10-20 태현 님)
  if (side === 'foe' && anim.parry === 'perfect' && (after.phase === 'run' || after.phase === 'choose') && after.me.hp > 0 && after.foe.hp > 0) {
    // ms 가 0 이 될 때까지 (parryShowMs) 는 쳐내기 연출만 — 원 · Space 는 그 뒤 (2026-10-20 태현 님)
    // 같은 전투 두 번째 완벽 패링부터 짧게 (ideas #127)
    const show = (after.perfects ?? 0) >= 2 ? TIMING.parryShowRepeatMs : TIMING.parryShowMs;
    return { ...after, phase: 'riposte', riposte: { ms: -show, dur: TIMING.riposteRingMs } };
  }
  return after;
}

/** 반격 기회에 누름 — 두 번째 원도 완벽이면 반격기, 아니면 그냥 이어 감 (한 번만) */
function riposteInput(b: BattleState, msBeforeHit: number, rng: Rng): BattleState {
  const done: BattleState = { ...b, phase: 'run', riposte: null, popups: [...b.popups] };
  if (parryGrade(msBeforeHit) !== 'perfect') {
    // 완벽이 아니면 반격 없이 이어 감 — 왜 안 나갔는지 은색 한 줄 (말 없이 원만 사라지던 것, 2026-10-20 플레이 리뷰어)
    popup(done, 'me', msBeforeHit > 0 ? '반격 — 조금 빨랐다' : '반격 — 조금 늦었다', 'parry');
    return done;
  }
  return startAction(done, 'me', { kind: 'riposte' }, rng);
}

/** 지금 반격 기회인지 (화면이 상대 둘레 두 번째 원 · 판 클릭을 Space 로) */
export function canRiposte(b: BattleState): boolean {
  return b.phase === 'riposte' && !!b.riposte && b.riposte.ms >= 0 && b.me.hp > 0 && b.foe.hp > 0;
}

/** 쓰러졌는지 보고 다음 단계로 */
function afterHits(b0: BattleState, save: Save): BattleState {
  if (b0.foe.hp <= 0) {
    const b: BattleState = { ...b0, foeDown: [...b0.foeDown, { species: b0.foe.species, level: b0.foe.level }] };
    const down = `${withJosa(label(b, 'foe'), '이/가')} 쓰러졌다!`;
    // 야생은 마지막 기회 한 번 (mvp-spec S11) — 볼이 없으면 "볼이 없어요" 로 건너뜀 · 내 팀도 다 쓰러졌으면 (반동 · 독) 진 것과 같아 건너뜀
    const wiped = b.me.hp <= 0 && switchable(b, save).length === 0;
    if (b.kind !== 'wild') {
      const who = b.foeName ?? '상대';
      // 내 포켓몬도 같이 쓰러졌으면 (독 · 화상 · 반동) 그 HP 0 을 남김 — 다음 포켓몬 목록 · 전투 끝 세이브에 (살아난 채로 다시 나오지 않게, 코드 리뷰어)
      const nb: BattleState = b.me.hp <= 0 ? { ...b, bench: { ...b.bench, [b.me.uid]: { hp: 0, moves: b.me.moves, status: b.me.status, ult: b.me.ult } } } : b;
      if (wiped) return { ...nb, phase: 'over', result: 'lose', overMs: 0, msg: `${down} 내 포켓몬도 다 쓰러졌다… 눈앞이 깜깜해졌다` };
      if (nb.foeQueue.length > 0) return { ...nb, phase: 'send', sendMs: 0, foeUltWait: null, msg: `${down} ${withJosa(who, '은/는')} 다음 포켓몬을 꺼낸다…` };
      return { ...nb, phase: 'over', result: 'win', overMs: 0, msg: `${down} ${withJosa(who, '과/와')}의 승부에서 이겼다!` };
    }
    // 볼 기회가 남았을 때만 (3번 다 던졌으면 없음 — 2026-10-20 태현 님)
    const hasBall = BALLS.some((ball) => itemLeft(b, save, ball) > 0) && catchTriesUsed(b) < BALANCE.catchTries;
    // 이미 잡은 종은 마지막 기회를 건너뜀 (설정, 2026-10-21 ideas #35)
    // 이로치는 건너뛰지 않음 (코드 리뷰어)
    const skip = save.settings.skipCaughtLast === true && save.dex.caught.includes(b.foe.species) && !b.foe.shiny;
    if (b.kind === 'wild' && hasBall && !wiped && !skip) return { ...b, phase: 'last', lastMs: 0, msg: down };
    // 같이 쓰러짐 (반동 · 독) = 진 것 — 트레이너전처럼 내 쪽도 말함 ("야생 ○○이 쓰러졌다!" 만 보이고 패배로 가던 것 — 기획 #25)
    if (wiped) return { ...b, phase: 'over', result: 'lose', overMs: 0, msg: `${down} 내 포켓몬도 다 쓰러졌다… 눈앞이 깜깜해졌다` };
    return { ...b, phase: 'over', result: 'win', overMs: 0, msg: b.kind === 'wild' && !hasBall && !wiped ? `${down} (볼이 없어 잡을 수 없어요)` : down };
  }
  const b = b0;
  if (b.me.hp <= 0) {
    const bench = { ...b.bench, [b.me.uid]: { hp: 0, moves: b.me.moves, status: b.me.status } };
    const nb = { ...b, bench };
    if (switchable(nb, save).length === 0) return { ...nb, phase: 'over', result: 'lose', overMs: 0, msg: `${withJosa(nameOf(b.me), '이/가')} 쓰러졌다… 눈앞이 깜깜해졌다` };
    return { ...nb, phase: 'pick', msg: `${withJosa(nameOf(b.me), '이/가')} 쓰러졌다! 다음 포켓몬을 골라요` };
  }
  return b.me.gauge >= 1 ? { ...b, phase: 'choose', msg: chooseMsg(b) } : { ...b, phase: 'run' };
}

function resolveClash(b0: BattleState, rng: Rng): BattleState {
  const b: BattleState = { ...b0, me: { ...b0.me }, foe: { ...b0.foe }, popups: [...b0.popups] };
  const c = b.clash!;
  const winner: Side = c.winner ?? 'foe';
  if (c.kind === 'ult') hit(b, winner, BALANCE.ultPower, b[winner].types[0] ?? null, rng, { useUlt: true });
  else {
    const mv = moveOf((winner === 'me' ? c.me : c.foe) ?? -1);
    if (mv) hit(b, winner, mv.power, mv.type, rng, { move: mv });
  }
  return { ...b, clash: null, anim: null };
}

export interface BattleStepOptions {
  /** 자동 전투 — 내 행동도 AI 가 고름 (다 찬 필살기는 볼 때 3초 · 안 볼 때 · HP 30% 아래 바로 — 기획 #26 R2) */
  auto: boolean;
  /** 사람이 안 봄 (확장이 계산) — 마지막 기회는 바로 지나감 (볼은 사람이 던짐) */
  away?: boolean;
}

/** 걸음 하나 */
export function battleStep(b0: BattleState, save: Save, stepMs: number, rng: Rng, opts: BattleStepOptions): BattleState {
  let b: BattleState = {
    ...b0,
    t: b0.t + stepMs,
    popups: b0.popups.filter((p) => p.ms + stepMs < POPUP_MS).map((p) => ({ ...p, ms: p.ms + stepMs })),
  };
  // 다 찬 내 필살기 — 자동 전투 · 볼 때는 ultAutoWaitMs 기다림 (Z 가 반짝 · 눌러도 됨), 안 볼 때는 바로 (R2 A).
  // 기다림은 Z 를 누를 수 있을 때만 셈 (내 행동 연출 중엔 멈춤) · 다 되면 쓸 수 있는 첫 걸음에 (상대 연출 중이면 끼어듦 — 1 이 연출 끝까지 남던 것, 디자인팀 #26 판정)
  // 저절로 쓰기는 꺼짐 (사용자가 눌러야만 — orders #82, BALANCE.ultAutoUse)
  const autoUlt = BALANCE.ultAutoUse && opts.auto;
  if (b.me.ult >= 1 && b.me.hp > 0 && autoUlt && !opts.away) b.ultWait = (b0.ultWait ?? 0) + (canUlt(b) ? stepMs : 0);
  else if (b.ultWait !== undefined) delete b.ultWait;
  if (b.ultQueued && (b.me.ult < 1 || b.me.hp <= 0)) delete b.ultQueued;
  // HP 가 자동 상처약 기준 (30%) 아래면 기다리지 않음 — 3초 안에 쓰러져 필살기가 날아가던 것 (2026-10-21 태현 님 "추천대로", 기획 #26 R2 ①)
  const low = b.me.hp < b.me.maxHp * BALANCE.autoPotionBelow;
  const myUltNow = (autoUlt && b.me.ult >= 1 && (opts.away === true || low || (b.ultWait ?? 0) >= BALANCE.ultAutoWaitMs)) || b.ultQueued === true;
  // 예약한 Z 는 맞받아치기 창 (관장 끼어들기 · 상대 필살기) 이 열리면 그걸로 (예약을 둔 채 상대 필살기를 맞던 것 — 코드 리뷰어).
  // 자동 전투 · HP 30% 아래 · 다 참이면 저절로 받아침 (맞고 쓰러져 필살기가 날아가던 것 — 2026-10-21 태현 님 B, 그 밖의 맞받아치기는 손으로)
  const autoCounter = autoUlt && low && (opts.away === true || (b.anim?.ms ?? 0) + stepMs > TIMING.ultCounterWindowMs);
  if ((b.ultQueued || autoCounter) && ultCounterOpen(b)) return startClash({ ...b, me: { ...b.me, ult: 0 }, ultQueued: undefined, ultWait: undefined }, 'ult', null, null);
  if (myUltNow && b.phase !== 'run' && canUlt(b) && !ultCounterOpen(b)) return pressUlt(b, rng);
  switch (b.phase) {
    case 'riposte': {
      const r = b.riposte;
      if (!r) return { ...b, phase: 'run', riposte: null };
      const ms = r.ms + stepMs;
      if (ms > r.dur + TIMING.parryLateMs) return { ...b, phase: 'run', riposte: null };
      return { ...b, riposte: { ...r, ms } };
    }
    case 'run': {
      const me = { ...b.me, gauge: Math.min(1, b.me.gauge + gaugeRate(b.me, b.foe) * stepMs) };
      const foe = { ...b.foe, gauge: Math.min(1, b.foe.gauge + gaugeRate(b.foe, b.me) * stepMs) };
      b = { ...b, me, foe };
      // 필살기: 상대 = 다 찬 뒤 1초 넘게 (예고 "!") · 자동 전투의 내 필살기 = 볼 때 3초 · 안 볼 때 바로 · 예약한 Z.
      // 정말 같은 걸음에 둘 다 쓸 때만 필살기 힘대결 (4장 동시 필살기) — 그 밖엔 Z 를 누른 것과 같게 (야생은 맞받아치지 않음 · 트레이너 반 · 관장 늘, 명세 검사관:
      // 상대가 기다리는 중이기만 해도 힘대결이 되어 야생도 맞받아치던 것)
      const tick = foeUltTick(b, stepMs, rng);
      b = tick.b;
      if (tick.fire && myUltNow) return startClash({ ...b, me: { ...b.me, ult: 0 }, foe: { ...b.foe, ult: 0 }, foeUltWait: null, ultQueued: undefined, ultWait: undefined }, 'ult', null, null);
      if (tick.fire) return startAction(b, 'foe', { kind: 'ult' }, rng);
      if (myUltNow) return pressUlt(b, rng);
      const meReady = b.me.gauge >= 1;
      const foeReady = b.foe.gauge >= 1;
      if (meReady && (!foeReady || b.me.stats.speed >= b.foe.stats.speed)) {
        if (!opts.auto) {
          const ready: BattleState = { ...b, phase: 'choose', msg: chooseMsg(b), queued: null };
          // 미리 누른 행동 — 차자마자 (ideas #31)
          return b.queued && canAct(ready, save, b.queued) ? startAction({ ...ready, lastMe: b.queued }, 'me', b.queued, rng) : ready;
        }
        // 자동 전투는 여기서 바로 고름 (choose 를 거의 안 거침) — HP 30% 아래면 상처약 (ideas #65, 테스터: choose 에만 있어 거의 안 썼음)
        const potion = autoPotion(b, save);
        return startAction(b, 'me', potion ? { kind: 'item', item: potion } : aiPick(b.me, b.foe, 'smart', rng), rng);
      }
      if (foeReady) {
        // 관장 — 에이스 (마지막 포켓몬) HP 가 절반 아래면 상처약 (한 판에 BALANCE.gymPotions 번) — 첫 포켓몬에게 쓰면 긴장이 첫 판에서 끝나서 (플레이 리뷰어)
        if (b.kind === 'gym' && b.foeQueue.length === 0 && (b.foePotions ?? 0) > 0 && b.foe.hp > 0 && b.foe.hp <= b.foe.maxHp * BALANCE.gymPotionAt) {
          return startAction({ ...b, foePotions: (b.foePotions ?? 0) - 1 }, 'foe', { kind: 'item', item: 'potion' }, rng);
        }
        return startAction(b, 'foe', aiPick(b.foe, b.me, foeStyle(b), rng), rng);
      }
      return b;
    }
    case 'choose':
      if (opts.auto) {
        // HP 30% 아래면 상처약 (설정 — 기본 켬, 2026-10-21 ideas #65)
        const potion = autoPotion(b, save);
        return startAction(b, 'me', potion ? { kind: 'item', item: potion } : aiPick(b.me, b.foe, 'smart', rng), rng);
      }
      return b; // 양쪽 멈춤 — 내가 고를 때까지 (상대 필살기 기다림도 멈춤)
    case 'anim': {
      const anim = { ...b.anim!, ms: b.anim!.ms + stepMs };
      b = { ...b, anim };
      // 관장이 내 공격 · 기술 연출에 필살기로 끼어듦 — 내 기술은 취소 (PP 는 깎인 채, 내가 끼어들 때와 같은 규칙) · 트레이너는 끼어들지 않음 (gdd 4.7 성격)
      // 찬 지 1초가 지나야 (기다림이 leaderCutAfterFullMs 만큼 줄었을 때 — 예고 "!" 를 보고 방어할 틈)
      const fullLong = b.foeUltWait !== null && b.foeUltWait <= BALANCE.leaderUltWaitMs - TIMING.leaderCutAfterFullMs;
      if (b.kind === 'gym' && anim.side === 'me' && (anim.action.kind === 'attack' || anim.action.kind === 'move') && b.foe.hp > 0 && b.foe.ult >= 1 && fullLong) {
        if (anim.ms >= BALANCE.leaderCutMs && anim.ms - stepMs < BALANCE.leaderCutMs) {
          const nb = startAction({ ...b, anim: null, foeUltWait: null }, 'foe', { kind: 'ult' }, rng);
          return { ...nb, msg: `끼어들었다! ${nb.msg}` };
        }
      }
      if (anim.ms < anim.dur) return b;
      return finishAnim(b, save, rng);
    }
    case 'clash': {
      const clash = { ...b.clash!, ms: b.clash!.ms + stepMs };
      b = { ...b, clash };
      if (clash.winner === null) {
        if (clash.ms < TIMING.clashMs) return b;
        // 4초 끝 — 확률로 승자를 정하고, 이긴 줄기가 뚫고 나가는 걸 잠깐 보여 준 뒤 피해
        const meWins = rng.next() < clashWithTaps(clash.base, clash.taps);
        return { ...b, clash: { ...clash, winner: meWins ? 'me' : 'foe' }, msg: meWins ? '힘대결에서 이겼다!' : '힘대결에서 졌다…' };
      }
      if (clash.ms < TIMING.clashMs + TIMING.clashResultMs) return b;
      return afterHits(resolveClash(b, rng), save);
    }
    case 'pick': {
      const team = switchable(b, save);
      // 고를 포켓몬이 없으면 (이상한 상태로 왔어도) 기다리지 않고 짐
      if (team.length === 0) return { ...b, phase: 'over', result: 'lose', overMs: 0 };
      if (!opts.auto) return b;
      // 자동 — 볼 때는 쓰러진 모습을 보인 뒤 (autoPickMs) 다음 포켓몬 · 안 볼 때는 바로 (#530 U1)
      if (!opts.away) {
        const pickMs = (b.pickMs ?? 0) + stepMs;
        if (pickMs < TIMING.autoPickMs) return { ...b, pickMs };
      }
      const next = bestNext(team, b.foe.types);
      return next ? pickNext(b, save, next.uid) : b;
    }
    case 'catch':
      return catchStep(b, save, stepMs, rng);
    case 'last': {
      const lastMs = b.lastMs + stepMs;
      // 볼을 고르지 않으면 (자동 전투 · 안 봄 · 그냥 둠) 지나감 [제안]
      // 자동 전투면 3초 (ideas #35)
      if (opts.away || lastMs >= lastChanceLimitMs(b, opts.auto)) return { ...b, lastMs, phase: 'over', result: 'win', overMs: 0, msg: `${withJosa(label(b, 'foe'), '이/가')} 쓰러졌다!` };
      return { ...b, lastMs };
    }
    case 'send': {
      const sendMs = b.sendMs + stepMs;
      if (sendMs < TIMING.foeSendMs) return { ...b, sendMs };
      const [next, ...rest] = b.foeQueue;
      if (!next) return { ...b, phase: 'over', result: 'win', overMs: 0 };
      const foe = fighterOf(next);
      // 관장의 마지막 포켓몬 = 에이스 (필살기 게이지 절반, gdd 4.7)
      if (b.kind === 'gym' && rest.length === 0) foe.ult = BALANCE.gymAceUlt;
      const nb: BattleState = { ...b, foe, foeQueue: rest, sendMs: 0, foeUltWait: null, msg: `${withJosa(b.foeName ?? '상대', '은/는')} ${withJosa(nameOf(foe), '을/를')} 내보냈다!` };
      // 내 포켓몬도 같이 쓰러졌으면 (반동 · 독) 다음 포켓몬 고르기
      if (nb.me.hp <= 0) {
        if (switchable(nb, save).length === 0) return { ...nb, phase: 'over', result: 'lose', overMs: 0, msg: '눈앞이 깜깜해졌다…' };
        return { ...nb, phase: 'pick', msg: `${nb.msg} 다음 포켓몬을 골라요` };
      }
      return nb.me.gauge >= 1 ? { ...nb, phase: 'choose', msg: chooseMsg(nb) } : { ...nb, phase: 'run' };
    }
    case 'over':
      return { ...b, overMs: b.overMs + stepMs };
  }
}

/** 상대 필살기를 쓸 때인지 — 야생: 다 찬 뒤 1초 · 트레이너: 1 ~ 3초 기다렸다가 · 관장: 끼어들 틈 (내 공격 · 기술) 이 없으면 4초 뒤 */
function foeUltTick(b: BattleState, stepMs: number, rng: Rng): { b: BattleState; fire: boolean } {
  if (b.foe.ult < 1 || b.foe.hp <= 0) return { b: b.foeUltWait === null ? b : { ...b, foeUltWait: null }, fire: false };
  if (b.foeUltWait === null) {
    const [lo, hi] = BALANCE.trainerUltWaitMs;
    return { b: { ...b, foeUltWait: b.kind === 'wild' ? BALANCE.wildUltWaitMs : b.kind === 'gym' ? BALANCE.leaderUltWaitMs : rng.int(lo, hi) }, fire: false };
  }
  const left = b.foeUltWait - stepMs;
  return left <= 0 ? { b: { ...b, foeUltWait: null }, fire: true } : { b: { ...b, foeUltWait: left }, fire: false };
}

/** Z — 지금 내 필살기 (상대 기술 연출 중이면 끼어들어 상대 기술은 취소 — 상대 PP 는 깎인 채, 2026-10-18 태현 님) · 고르는 중에 쓴 필살기는 끝나면 다시 고르기 */
function pressUlt(b0: BattleState, rng: Rng): BattleState {
  const { ultQueued: _q, ultWait: _w, ...b } = b0;
  const interrupted = b.phase === 'anim' && b.anim?.side === 'foe';
  const nb = myUlt(interrupted ? { ...b, anim: null } : b, rng);
  return interrupted && nb.phase === 'anim' ? { ...nb, msg: `끼어들었다! ${nb.msg}` } : nb;
}

/** 내 필살기 — 트레이너 · 관장의 게이지가 차 있으면 필살기로 맞받아침 (관장은 늘 · 트레이너는 반) → 필살기 힘대결 */
function myUlt(b: BattleState, rng: Rng): BattleState {
  if (b.kind !== 'wild' && b.foe.ult >= 1 && b.foe.hp > 0 && (b.kind === 'gym' || rng.chance(BALANCE.trainerUltCounterChance))) {
    const nb = startClash({ ...b, me: { ...b.me, ult: 0 }, foe: { ...b.foe, ult: 0 }, foeUltWait: null }, 'ult', null, null);
    return { ...nb, msg: '상대도 필살기로 맞받아쳤다! 필살기 힘대결!' };
  }
  return startAction(b, 'me', { kind: 'ult' }, rng);
}

/** 볼 던지기 시작 — 전투 중이면 내 행동 하나 (게이지 0) · 쓴 볼은 끝날 때 가방에서 뺌 */
function throwBall(b: BattleState, ball: BallId, last: boolean): BattleState {
  const me = last ? b.me : { ...b.me, gauge: 0, guard: 1, guardStreak: 0, streakMove: null, streakCount: 0 };
  return {
    ...b,
    me,
    phase: 'catch',
    anim: null,
    catch: { ball, ms: 0, pressMs: null, throwMs: null, shakes: 0, last, caught: null, startT: b.t },
    bagUsed: { ...b.bagUsed, [ball]: (b.bagUsed[ball] ?? 0) + 1 },
    msg: `${withJosa(itemName(ball), '을/를')} 꺼냈다!`,
  };
}

/** 던짐 — 그 순간 잡힘 · 흔들 횟수를 정함. pressed = Space 로 던짐 (at = 누른 때, 타이밍 보너스) · 아니면 원이 끝나 저절로 */
function throwNow(b: BattleState, c: BattleCatch, at: number, pressed: boolean, rng: Rng): BattleState {
  const pressMs = pressed ? at : null;
  const timing = catchTiming(pressMs, TIMING.catchRingMs);
  const p = catchChance({ captureRate: speciesOf(b.foe.species)?.captureRate ?? 45, hp: b.foe.hp, maxHp: b.foe.maxHp, ball: c.ball, timing, lastChance: c.last, status: b.foe.status?.kind });
  const caught = rng.next() < p;
  // 흔들 횟수 (원작처럼) — 잡히면 3번, 놓치면 1번 + 한 번 더 흔들 확률 = 잡을 확률의 세제곱근 (잡힐 뻔할수록 많이 흔들다 터짐)
  let shakes = 3;
  if (!caught) {
    const q = Math.cbrt(p);
    shakes = 1;
    while (shakes < 3 && rng.next() < q) shakes += 1;
  }
  const nice = timing === 'perfect' ? ' 완벽한 타이밍!' : timing === 'good' ? ' 좋은 타이밍!' : '';
  return { ...b, catch: { ...c, pressMs, throwMs: at, caught, shakes }, msg: `가랏, ${itemName(c.ball)}!${nice}` };
}

function catchStep(b: BattleState, save: Save, stepMs: number, rng: Rng): BattleState {
  const c = { ...b.catch!, ms: b.catch!.ms + stepMs };
  // 안 누르면 원이 다 줄어든 뒤 (늦게 누를 틈까지) 저절로 던짐
  const tl = catchTimeline(c);
  if (!tl) {
    // 옛 세이브 (2026-10-20 전) 에서 눌렀지만 결과가 아직이면 — 누른 때로 던짐 (얻은 타이밍 보너스를 잃지 않게, 코드 리뷰어)
    if (c.pressMs !== null) return throwNow(b, c, c.pressMs, true, rng);
    return c.ms < TIMING.catchRingMs + BALANCE.catchGoodMs ? { ...b, catch: c } : throwNow(b, c, TIMING.catchRingMs + BALANCE.catchGoodMs, false, rng);
  }
  if (c.ms < tl.done) return { ...b, catch: c, msg: b.catch!.ms < tl.shake && c.ms >= tl.shake ? '흔들… 흔들…' : b.msg };
  const name = label(b, 'foe');
  if (c.caught) return { ...b, catch: c, phase: 'over', result: 'catch', overMs: 0, msg: `신난다! ${withJosa(name, '을/를')} 잡았다!` };
  // 이긴 뒤 마지막 기회가 세 번째 볼이었으면 — 도망이 아니라 이김으로 끝 (쓰러뜨린 보상을 잃지 않게, 2026-10-20 태현 님 "추천으로")
  if (c.last && catchTriesUsed(b) >= BALANCE.catchTries) return { ...b, catch: null, phase: 'over', result: 'win', overMs: 0, msg: `아깝다! ${withJosa(name, '이/가')} 빠져나왔다…` };
  // 세 번 다 놓침 — 상대가 도망 (경험치 없음, 2026-10-20 태현 님)
  if (catchTriesUsed(b) >= BALANCE.catchTries) return { ...b, catch: null, phase: 'over', result: 'flee', escaped: true, anim: null, overMs: 0, msg: `아깝다! ${withJosa(name, '은/는')} 도망쳐 버렸다…` };
  // 놓침 — 상대가 HP 를 조금 되찾고 (최대 HP 의 10%) 먼저 덤빔 (상대 게이지 가득, 2026-10-20 태현 님).
  // 이긴 뒤 마지막 기회 (쓰러진 상대) 에서 놓쳐도 같음 — 10% 로 다시 일어나 전투 계속 (2026-10-20 태현 님, 예전 "놓쳐도 이김" 을 바꿈):
  //   쓰러뜨린 기록 (foeDown — 경험치) 은 뺌 · 던진 것도 내 행동이라 내 게이지 0
  const heal = Math.min(b.foe.maxHp - b.foe.hp, Math.max(1, Math.round(b.foe.maxHp * BALANCE.catchFailHeal)));
  const revived = c.last && b.foe.hp <= 0;
  const nb0: BattleState = {
    ...b,
    catch: null,
    me: revived ? { ...b.me, gauge: 0, guard: 1, guardStreak: 0, streakMove: null, streakCount: 0 } : { ...b.me },
    foe: { ...b.foe, hp: b.foe.hp + heal, gauge: 1 },
    foeDown: revived ? b.foeDown.slice(0, -1) : b.foeDown,
    popups: [...b.popups],
  };
  if (heal > 0) popup(nb0, 'foe', `+${heal}`, 'heal');
  // 볼을 던진 것도 내 행동 하나 — 독 · 화상 피해 (다른 아이템처럼)
  afterAction(nb0, 'me');
  const nb = afterHits(nb0, save);
  return { ...nb, msg: nb.phase === 'choose' || nb.phase === 'pick' || nb.phase === 'over' ? nb.msg : revived ? `아깝다! ${withJosa(name, '이/가')} 빠져나와 다시 일어났다!` : `아깝다! ${withJosa(name, '이/가')} 빠져나와 덤벼든다!` };
}

function pickNext(b: BattleState, save: Save, uid: string): BattleState {
  const m = switchable(b, save).find((x) => x.uid === uid);
  if (!m) return b;
  const next = fighterOf(m);
  next.ult = b.bench[uid]?.ult ?? BALANCE.ultStart;
  // 자동 기다림 (pickMs) 은 손으로 골라도 지움 — 남으면 다음 쓰러짐의 기다림이 줄어듦 (U1, 코드 리뷰어)
  const { pickMs: _p, ...rest } = b;
  return { ...rest, me: next, phase: 'run', msg: `가랏, ${nameOf(next)}!`, fought: b.fought.includes(uid) ? b.fought : [...b.fought, uid] };
}

/** 잡기 어려움 (orders #23) — 지금 이 야생에게 볼마다 던질 때의 기본 확률 · 쉬움 / 보통 / 어려움 (마지막 기회면 × 0.5). 야생이 아니면 null */
export function battleCatchOdds(b: BattleState): ReturnType<typeof catchOdds> | null {
  if (b.kind !== 'wild') return null;
  const lastChance = b.phase === 'last' || b.catch?.last === true;
  return catchOdds({ captureRate: speciesOf(b.foe.species)?.captureRate ?? 45, hp: b.foe.hp, maxHp: b.foe.maxHp, lastChance, status: b.foe.status?.kind });
}

/**
 * 1:1 상대 필살기 예고 (2026-10-21 기획 검토 R4 — 3:3 과 같은 그림) — 80% 부터 { pct } · 다 차면 { full } (쓰기까지 1초 넘게 — wildUltWaitMs · trainerUltWaitMs).
 * 상대가 쓰러졌거나 · 필살기를 쓰는 중 · 전투가 끝나 가는 때는 null. 화면이 상대 HP 칸 · 2 방어 칸 ▲ 를 그림 (디자인팀)
 */
export function battleFoeUltWarn(b: BattleState): { full: boolean; pct: number } | null {
  const f = b.foe;
  if (f.hp <= 0 || b.phase === 'over' || b.phase === 'send' || b.phase === 'last' || b.phase === 'catch') return null;
  // 상대 필살기 기 모으기 ~ 컷인 전까지는 "!" 그대로 (쓰기 시작하면 게이지가 0 — 컷인까지 1.25초 비던 것, 디자인팀 #26 판정 U1)
  if (b.anim?.side === 'foe' && b.anim.action.kind === 'ult') return b.anim.ms < TIMING.ultCutInMs ? { full: true, pct: 99 } : null;
  if (f.ult < BALANCE.team.ultWarnAt) return null;
  return { full: f.ult >= 1, pct: Math.min(99, Math.floor(f.ult * 100)) };
}

/** 다 찬 내 필살기가 저절로 나가기까지 남은 ms (자동 전투 · 볼 때 — Z 반짝 · 막대, R2) · 저절로 안 나가면 null */
export function battleAutoUltLeft(b: BattleState, auto: boolean): number | null {
  // 저절로 안 씀 (사용자가 눌러야만 — orders #82) 이면 늘 null (화면은 "다 참 · Z")
  if (!BALANCE.ultAutoUse || !auto || b.me.ult < 1 || b.me.hp <= 0) return null;
  // 저절로 나갈 수 없는 단계 (마지막 기회 · 잡기 · 다음 볼 · 반격 기회 · 고르기 · 끝) 는 없음 (테스터 — 숫자가 멈춘 채 남던 것)
  if (b.phase !== 'run' && b.phase !== 'choose' && b.phase !== 'anim' && b.phase !== 'clash') return null;
  if (b.me.hp < b.me.maxHp * BALANCE.autoPotionBelow) return 0;
  return Math.max(0, BALANCE.ultAutoWaitMs - (b.ultWait ?? 0));
}

/** 전투 결과를 보여 주는 시간이 다 지났는지 */
export function battleDone(b: BattleState): boolean {
  return b.phase === 'over' && b.overMs >= (b.result === 'catch' ? TIMING.catchOverMs : TIMING.battleOverMs);
}

/** 내가 골라야 앞으로 가는지 (자동 전투가 꺼져 있을 때) */
export function battleWaiting(b: BattleState): boolean {
  return b.phase === 'choose' || b.phase === 'pick';
}

export type BattleInput =
  | { kind: 'act'; action: BattleAction }
  | { kind: 'ult' }
  /** Space · 클릭 — 힘대결 연타 · 맞받아치기 · 필살기 맞받아치기 · 타이밍 원 (extraMs = 걸음이 되지 못한 시간) */
  | { kind: 'space'; extraMs?: number }
  /** 패링 — ms = 맞기까지 남은 시간 (화면이 연출의 맞는 순간으로 잼, 음수 = 맞은 뒤) */
  | { kind: 'parry'; ms: number }
  | { kind: 'pick'; uid: string }
  /** 이긴 뒤 마지막 기회: 볼 던지기 · 그냥 지나가기 */
  | { kind: 'ball'; ball: BallId }
  | { kind: 'no-ball' }
  /** Enter — 지난번 공격 · 기술 · 막기를 다시 (ideas #22) */
  | { kind: 'repeat' };

/** 미리 누를 수 있는지 — 공격 · 기술 (PP 있음) · 막기, 내 게이지가 prePressMs 안에 참 (ideas #31) */
function prePressable(b: BattleState, action: BattleAction): boolean {
  if (b.me.hp <= 0 || b.me.gauge >= 1) return false;
  if (action.kind === 'move' && !b.me.moves.some((s) => s.moveId === action.moveId && s.pp > 0)) return false;
  if (action.kind !== 'attack' && action.kind !== 'move' && action.kind !== 'guard') return false;
  const rate = gaugeRate(b.me, b.foe);
  return rate > 0 && (1 - b.me.gauge) / rate <= BALANCE.prePressMs;
}

/** 기술 버튼 상성 (ideas #24) — 지금 상대에게 효과 배율 (변화 기술 · 모르는 기술 = null) */
export function moveEffect(b: BattleState, moveId: number): number | null {
  const mv = moveOf(moveId);
  return mv && mv.power > 0 ? effectiveness(mv.type, b.foe.types) : null;
}

/** 마지막 기회 길이 — 자동 전투 3초 (이로치는 6초 그대로) · 손으로 6초 (화면의 남은 초도 이걸로, 2026-10-21 디자인팀) */
export function lastChanceLimitMs(b: BattleState, auto: boolean): number {
  return auto && !b.foe.shiny ? TIMING.lastChanceAutoMs : TIMING.lastChanceMs;
}

/** 지금 할 수 있는 행동인지 (메뉴를 흐리게) */
export function canAct(b: BattleState, save: Save, action: BattleAction): boolean {
  if (b.phase !== 'choose') return false;
  switch (action.kind) {
    case 'attack':
    case 'guard':
      return true;
    case 'move':
      return b.me.moves.some((s) => s.moveId === action.moveId && s.pp > 0);
    case 'item':
      if (itemLeft(b, save, action.item) <= 0) return false;
      if (action.item === 'full-restore') return b.me.hp < b.me.maxHp || b.me.status !== null;
      if (isHealItem(action.item)) return b.me.hp < b.me.maxHp;
      if (action.item === 'full-heal') return b.me.status !== null;
      if (action.item === 'revive') {
        const fainted = faintedTeam(b, save);
        return action.uid === undefined ? fainted.length > 0 : fainted.some((m) => m.uid === action.uid);
      }
      // 볼은 야생에게만 (원작 규칙 [제안]) · 한 마리에 3번까지 (2026-10-20 태현 님)
      return isBall(action.item) && b.kind === 'wild' && catchTriesUsed(b) < BALANCE.catchTries;
    case 'switch':
      return switchable(b, save).some((m) => m.uid === action.uid);
    case 'flee':
      return b.kind === 'wild';
    default:
      return false;
  }
}

/** 필살기를 지금 쓸 수 있는지 — 게이지가 차 있고, 힘대결 · 고르기 · 끝이 아니고, 내 연출 중이 아닐 때 */
export function canUlt(b: BattleState): boolean {
  if (b.me.ult < 1 || b.me.hp <= 0) return false;
  if (b.phase === 'run' || b.phase === 'choose') return true;
  // 상대 기술 연출 중에는 끼어들기 (상대 필살기에는 맞받아치기만 — ultCounterOpen)
  // 상대 아이템 (관장 상처약) 은 못 끊음 — 끊으면 상처약만 사라지고 회복은 안 되던 것 (테스터 2026-10-20)
  return b.phase === 'anim' && b.anim?.side === 'foe' && b.anim.action.kind !== 'ult' && b.anim.action.kind !== 'item';
}

/** 지금 패링할 수 있는지 — 상대가 피해를 주는 공격 (1 공격 · 위력 있는 기술) 을 하는 중 · 아직 안 누름 · 내가 서 있음 */
export function canParry(b: BattleState): boolean {
  const a = b.anim;
  if (b.phase !== 'anim' || !a || a.side !== 'foe' || a.parry !== undefined || b.me.hp <= 0) return false;
  if (a.action.kind === 'attack') return true;
  if (a.action.kind !== 'move') return false;
  const mv = moveOf(a.action.moveId);
  return !!mv && mv.class !== 'status' && mv.power > 0;
}

/**
 * 패링 (2026-10-19 태현 님 A) — 처음 누른 것만 셈 (너무 일찍 누르면 이번 공격은 못 막음 — 연타 막기).
 * 막음 · 완벽이면: 쏘는 기술끼리 (나에게 쏘는 기술이 있음) 는 그대로 맞받아치기 힘대결 (게이지를 다 씀), 아니면 맞을 때 피해 ×0.5 · ×0 (hit)
 */
function parry(b: BattleState, msBeforeHit: number): BattleState {
  const a = b.anim!;
  // 등급만 적음 — 피해는 맞는 순간 (hit) 에 ×0.5 · ×0, 완벽이면 그 뒤 반격 기회 (쏘는 기술끼리 힘대결은 2026-10-20 없앰)
  return { ...b, anim: { ...a, parry: parryGrade(msBeforeHit) } };
}

/** 맞받아치기 버튼이 떠 있는지 */
export function counterOpen(b: BattleState): boolean {
  return b.phase === 'anim' && !!b.anim?.counter && b.anim.side === 'foe' && b.me.hp > 0;
}

/** 상대 필살기에 내 필살기로 맞받아칠 수 있는지 */
export function ultCounterOpen(b: BattleState): boolean {
  return (
    b.phase === 'anim' && b.anim?.side === 'foe' && b.anim.action.kind === 'ult' && b.me.ult >= 1 && b.anim.ms <= TIMING.ultCounterWindowMs
  );
}

function startClash(b: BattleState, kind: 'move' | 'ult', myMove: ReadonlyMove | null, foeMove: ReadonlyMove | null): BattleState {
  const base =
    kind === 'ult'
      ? clashChance(b.me.stats.ultimate, b.foe.stats.ultimate)
      : clashChance(b.me.stats.attack * (myMove?.power ?? 1), b.foe.stats.attack * (foeMove?.power ?? 1));
  return {
    ...b,
    phase: 'clash',
    anim: null,
    clash: { kind, me: myMove?.id ?? null, foe: foeMove?.id ?? null, base, taps: 0, ms: 0, winner: null },
    msg: kind === 'ult' ? '필살기 힘대결!' : '맞받아쳤다! 힘대결!',
  };
}

/** 입력 — 받을 수 없으면 그대로 돌려줌 */
export function battleInput(b: BattleState, save: Save, input: BattleInput, rng: Rng): BattleState {
  switch (input.kind) {
    case 'act': {
      // 게이지가 차기 0.5초 전에 누른 공격 · 기술 · 막기는 기억했다가 차자마자 (ideas #31)
      if (b.phase === 'run' && prePressable(b, input.action)) return { ...b, queued: input.action };
      if (!canAct(b, save, input.action)) return b;
      if (input.action.kind === 'item' && isBall(input.action.item)) return throwBall(b, input.action.item, false);
      const remember = input.action.kind === 'attack' || input.action.kind === 'move' || input.action.kind === 'guard';
      return startAction(remember ? { ...b, lastMe: input.action } : b, 'me', input.action, rng);
    }
    case 'repeat':
      return b.lastMe ? battleInput(b, save, { kind: 'act', action: b.lastMe }, rng) : b;
    case 'ball':
      if (b.phase !== 'last' || itemLeft(b, save, input.ball) <= 0) return b;
      return throwBall(b, input.ball, true);
    case 'no-ball':
      if (b.phase !== 'last') return b;
      return { ...b, phase: 'over', result: 'win', overMs: 0, msg: `${withJosa(label(b, 'foe'), '이/가')} 쓰러졌다!` };
    case 'ult': {
      if (ultCounterOpen(b)) return startClash({ ...b, me: { ...b.me, ult: 0 } }, 'ult', null, null);
      // 내 행동 연출 중 (Z 를 못 누름) 이면 예약 — 누를 수 있게 되면 바로 (말없이 버려지던 것, U5)
      // 교체 연출은 빼고 (들어오는 포켓몬의 필살기로 나가던 것 — 테스터)
      if (!canUlt(b)) return b.me.ult >= 1 && b.me.hp > 0 && b.phase === 'anim' && b.anim?.side === 'me' && b.anim.action.kind !== 'switch' ? { ...b, ultQueued: true } : b;
      return pressUlt(b, rng);
    }
    case 'space': {
      // 타이밍 원 — 누른 때 = 던짐 (처음 한 번만, 다 줄어든 뒤 조금 늦게까지)
      if (b.phase === 'catch' && b.catch) {
        // extraMs = 아직 걸음이 되지 못한 시간 (화면의 원은 실제 시간으로 줄어듦 — 판정을 그 시간에 맞춤)
        const at = b.catch.ms + Math.min(TIMING.simStepMs, Math.max(0, input.extraMs ?? 0));
        if (catchTimeline(b.catch) || at > TIMING.catchRingMs + BALANCE.catchGoodMs) return b;
        return throwNow(b, b.catch, at, true, rng);
      }
      if (b.phase === 'clash' && b.clash) {
        if (b.clash.winner !== null) return b; // 승자가 정해진 뒤 연타는 안 셈
        const taps = Math.min(Math.round(BALANCE.clashTapMax / BALANCE.clashTap), b.clash.taps + 1);
        return { ...b, clash: { ...b.clash, taps } };
      }
      if (ultCounterOpen(b)) return startClash({ ...b, me: { ...b.me, ult: 0 } }, 'ult', null, null);
      // 반격 기회 — 두 번째 원이 맞는 때까지 남은 시간 (엔진 시간)
      if (canRiposte(b)) return riposteInput(b, b.riposte!.dur - b.riposte!.ms - Math.min(TIMING.simStepMs, Math.max(0, input.extraMs ?? 0)), rng);
      // 상대 공격 중 Space — 화면이 맞는 순간을 모르면 (연출 없음) 엔진 시간으로 어림한 패링
      if (canParry(b)) return parry(b, b.anim!.dur - b.anim!.ms - Math.min(TIMING.simStepMs, Math.max(0, input.extraMs ?? 0)));
      return b;
    }
    case 'parry': {
      if (!Number.isFinite(input.ms)) return b;
      if (canRiposte(b)) return riposteInput(b, input.ms, rng);
      if (!canParry(b)) return b;
      return parry(b, input.ms);
    }
    case 'pick':
      if (b.phase !== 'pick') return b;
      return pickNext(b, save, input.uid);
  }
}

/** 전투 끝 — 내 포켓몬 HP · PP · 상태 이상과 쓴 아이템을 세이브에 (지면 S17 패배 — 돈 · 회복 · 다시 시작은 play.ts) */
export function applyBattleResult(save: Save, b: BattleState): Save {
  const monsters = { ...save.monsters };
  const changed = { ...b.bench, [b.me.uid]: { hp: b.me.hp, moves: b.me.moves, status: b.me.status } };
  for (const [uid, c] of Object.entries(changed)) {
    const m = monsters[uid];
    // HP 는 그 포켓몬 최대 HP 까지 (다른 쪽에서 온 값이 이상해도 세이브에 넘치지 않게)
    if (m) monsters[uid] = { ...m, hp: Math.min(c.hp, fighterOf({ ...m, hp: 1e6 }).maxHp), moves: c.moves.map((s) => ({ ...s })), status: c.status };
  }
  const bag = { ...save.bag };
  for (const [item, n] of Object.entries(b.bagUsed) as [ItemId, number][]) bag[item] = Math.max(0, (bag[item] ?? 0) - n);
  return { ...save, monsters, bag, pendingEncounter: null };
}

// ---------- 다른 쪽 (웹뷰) 에서 온 전투 상태 검사 — 모양이 이상하면 null (그 전투를 처음부터)

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const fin = (v: unknown, min = -1e12, max = 1e12): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const SIDES = ['me', 'foe'];
const PHASES = ['run', 'choose', 'anim', 'clash', 'pick', 'catch', 'last', 'send', 'over', 'riposte'];
const KINDS = ['wild', 'trainer', 'gym'];
const ACTIONS = ['attack', 'move', 'guard', 'item', 'switch', 'flee', 'ult', 'skip', 'riposte'];
const PARRY_GRADES = ['perfect', 'good', 'early', 'late'];
const STATUS = ['poison', 'burn', 'paralysis', 'sleep'];
// 옛 세이브의 'info' 는 그대로 통과 — 새 종류는 2026-10-20 (화면이 숫자 크기 · 말 칸으로 나눔)
export const POPUP_KINDS = ['damage', 'heal', 'info', 'super', 'weak', 'immune', 'crit', 'miss', 'parry', 'status'];
const STARTS = ['preemptive', 'normal', 'ambush'];

function okStatus(st: unknown): boolean {
  if (st === null) return true;
  if (!isObj(st) || !STATUS.includes(st.kind as string)) return false;
  return st.kind !== 'sleep' || fin(st.turnsLeft, 0, 10);
}

function okMoves(moves: unknown): boolean {
  return Array.isArray(moves) && moves.length <= BALANCE.moveSlots && moves.every((m) => isObj(m) && fin(m.moveId, 1, 100000) && fin(m.pp, 0, 100));
}

export function okFighter(f: unknown): boolean {
  if (!isObj(f)) return false;
  const s = f.stats;
  return (
    typeof f.uid === 'string' &&
    fin(f.species, 1, 2000) &&
    typeof f.form === 'string' &&
    fin(f.level, 1, 100) &&
    typeof f.shiny === 'boolean' &&
    Array.isArray(f.types) &&
    f.types.every((t) => typeof t === 'string') &&
    isObj(s) &&
    ['hp', 'attack', 'defense', 'speed', 'ultimate'].every((k) => fin(s[k], 0, 1e6)) &&
    fin(f.maxHp, 1, 1e6) &&
    fin(f.hp, 0, f.maxHp as number) &&
    okMoves(f.moves) &&
    okStatus(f.status) &&
    fin(f.gauge, 0, 1) &&
    fin(f.ult, 0, 1) &&
    fin(f.guard, 0, 1) &&
    fin(f.guardStreak, 0, 1000) &&
    (f.streakMove === null || fin(f.streakMove, 1, 100000)) &&
    fin(f.streakCount, 0, 10000) &&
    (f.star === undefined || (fin(f.star, 1, 5) && Number.isInteger(f.star)))
  );
}

/** 행동 하나 — 종류마다 필요한 값 (기술 번호 · 아이템 · 바꿀 포켓몬) */
function okAction(a: unknown): boolean {
  if (!isObj(a) || !ACTIONS.includes(a.kind as string)) return false;
  if (a.kind === 'move') return fin(a.moveId, 1, 100000);
  if (a.kind === 'item') return typeof a.item === 'string' && (ITEM_IDS as readonly string[]).includes(a.item) && (a.uid === undefined || typeof a.uid === 'string');
  if (a.kind === 'switch') return typeof a.uid === 'string';
  return true;
}

/** 끝나면 세이브에 들어가는 값 (교체로 바뀐 포켓몬 · 쓴 아이템) 은 안까지 봄 */
function okBench(bench: unknown): boolean {
  return isObj(bench) && Object.values(bench).every((c) => isObj(c) && fin(c.hp, 0, 1e6) && okMoves(c.moves) && okStatus(c.status) && (c.ult === undefined || fin(c.ult, 0, 1)));
}

function okBag(bag: unknown): boolean {
  return isObj(bag) && Object.entries(bag).every(([k, n]) => (ITEM_IDS as readonly string[]).includes(k) && fin(n, 0, 9999) && Number.isInteger(n));
}

/** 아직 안 나온 상대 포켓몬 — fighterOf 가 쓰는 칸만 봄 (세이브에는 안 들어감) */
function okFoeMonster(m: unknown): boolean {
  if (!isObj(m) || typeof m.uid !== 'string' || !fin(m.species, 1, 2000) || typeof m.form !== 'string' || !fin(m.level, 1, 100) || typeof m.shiny !== 'boolean') return false;
  const statsOk = (s: unknown) => isObj(s) && ['hp', 'attack', 'defense', 'speed', 'ultimate'].every((k) => fin(s[k], 0, 1e6));
  return statsOk(m.ivs) && statsOk(m.points) && okMoves(m.moves) && fin(m.hp, 0, 1e6) && okStatus(m.status);
}

export function readBattle(raw: unknown): BattleState | null {
  if (!isObj(raw) || !KINDS.includes(raw.kind as string) || !okFighter(raw.me) || !okFighter(raw.foe)) return null;
  if (!Array.isArray(raw.foeQueue) || raw.foeQueue.length > 6 || !raw.foeQueue.every(okFoeMonster)) return null;
  if (!Array.isArray(raw.foeDown) || raw.foeDown.length > 6 || !raw.foeDown.every((d) => isObj(d) && fin(d.species, 1, 2000) && fin(d.level, 1, 100))) return null;
  if (!(raw.foeUltWait === null || fin(raw.foeUltWait, -1e6, 1e6)) || !(raw.foeName === null || (typeof raw.foeName === 'string' && raw.foeName.length <= 40)) || !fin(raw.sendMs, 0)) return null;
  if (!(raw.foePotions === undefined || fin(raw.foePotions, 0, 10)) || !(raw.ultWait === undefined || fin(raw.ultWait, 0, 1e6)) || !(raw.ultQueued === undefined || typeof raw.ultQueued === 'boolean') || !(raw.pickMs === undefined || fin(raw.pickMs, 0, 1e6))) return null;
  if (!(raw.escaped === undefined || typeof raw.escaped === 'boolean')) return null;
  if (!(raw.perfects === undefined || fin(raw.perfects, 0, 1000))) return null;
  if (!(raw.lastMe === undefined || okAction(raw.lastMe)) || !(raw.queued === undefined || raw.queued === null || okAction(raw.queued))) return null;
  const rp = raw.riposte;
  if (!(rp === undefined || rp === null || (isObj(rp) && fin(rp.ms, -60_000) && fin(rp.dur, 1, 60_000)))) return null;
  if (raw.phase === 'riposte' && !isObj(rp)) return null;
  if (raw.kind !== 'wild' && typeof raw.foeName !== 'string') return null;
  if (!PHASES.includes(raw.phase as string) || !okBench(raw.bench) || !okBag(raw.bagUsed)) return null;
  if (!Array.isArray(raw.popups) || !raw.popups.every((p) => isObj(p) && fin(p.id, 0) && SIDES.includes(p.side as string) && typeof p.text === 'string' && fin(p.ms, 0) && POPUP_KINDS.includes(p.kind as string))) return null;
  const anim = raw.anim;
  if (anim !== null && !(isObj(anim) && SIDES.includes(anim.side as string) && okAction(anim.action) && fin(anim.ms, 0) && fin(anim.dur, 0, 60_000) && typeof anim.counter === 'boolean' && (anim.parry === undefined || PARRY_GRADES.includes(anim.parry as string)) && (anim.miss === undefined || typeof anim.miss === 'boolean'))) return null;
  const clash = raw.clash;
  if (clash !== null && !(isObj(clash) && (clash.kind === 'move' || clash.kind === 'ult') && (clash.me === null || fin(clash.me, 1, 100000)) && (clash.foe === null || fin(clash.foe, 1, 100000)) && fin(clash.base, 0, 1) && fin(clash.taps, 0, 1000) && fin(clash.ms, 0) && (clash.winner === null || SIDES.includes(clash.winner as string)))) return null;
  if (raw.phase === 'anim' && anim === null) return null;
  if (raw.phase === 'clash' && clash === null) return null;
  const ct = raw.catch;
  if (ct !== null && !(isObj(ct) && (BALLS as readonly string[]).includes(ct.ball as string) && fin(ct.ms, 0) && (ct.pressMs === null || fin(ct.pressMs, 0)) && typeof ct.last === 'boolean' && (ct.caught === null || typeof ct.caught === 'boolean') && fin(ct.startT, 0))) return null;
  if (isObj(ct) && !((ct.throwMs === undefined || ct.throwMs === null || fin(ct.throwMs, 0)) && (ct.shakes === undefined || fin(ct.shakes, 0, 3)))) return null;
  // 옛 상태 (2026-10-20 전 — 원이 끝나면 정하고 흔듦): 정해졌으면 흔드는 중으로, 아니면 원이 줄어드는 중으로 (받은 객체는 안 바꿈)
  const oldCatch = isObj(ct) && ct.throwMs === undefined;
  const catchNow = oldCatch
    ? { ...ct, throwMs: ct.caught === null ? null : Math.max(0, (ct.ms as number) - TIMING.catchFlyMs - TIMING.catchSuckMs - TIMING.catchDropMs), shakes: ct.caught === null ? 0 : ct.caught ? 3 : 1 }
    : ct;
  if (isObj(catchNow) && catchNow.throwMs === null && catchNow.caught !== null) return null; // 안 던졌는데 결과가 있으면 못 읽음
  if (raw.phase === 'catch' && ct === null) return null;
  if (!fin(raw.lastMs, 0) || !Array.isArray(raw.fought) || !raw.fought.every((u) => typeof u === 'string')) return null;
  if (!(raw.result === null || raw.result === 'win' || raw.result === 'lose' || raw.result === 'flee' || raw.result === 'catch')) return null;
  // 끝난 전투에는 결과가, 진행 중에는 결과가 없어야 함
  if ((raw.phase === 'over') !== (raw.result !== null)) return null;
  if (!fin(raw.overMs, 0) || !fin(raw.fleeTries, 0, 1000) || typeof raw.msg !== 'string' || !fin(raw.t, 0) || !fin(raw.popupSeq, 0)) return null;
  if (!isObj(raw.ultAt) || !STARTS.includes(raw.start as string)) return null;
  return (oldCatch ? { ...raw, catch: catchNow } : raw) as unknown as BattleState;
}
