/**
 * S09 전투 1:1 흐름 (mvp-spec 3.3) — 보일 때(웹뷰) · 안 볼 때(확장) 같은 함수. 상태는 늘 새 객체.
 *
 *   run    행동 게이지가 참 (스피드 비율, 빠른 쪽 최대 2배)
 *   choose 내 게이지가 다 참 → 자동 전투가 꺼져 있으면 양쪽이 멈추고 내가 고를 때까지 (그동안 Z 필살기만)
 *   anim   기술 연출 (게이지 멈춤) — 상대가 쏘는 기술이면 맞받아치기 창 1.5초 · 필살기로 끼어들면 그 기술은 취소 (PP 는 깎인 채)
 *   clash  힘대결 4초 — Space · 클릭 연타, 끝나면 확률로 승패 · 진 쪽이 이긴 기술의 피해
 *   pick   내 포켓몬이 쓰러짐 → 다음 포켓몬 고르기 (자동 전투면 상성 좋은 포켓몬)
 *   over   이김 · 짐 · 도망 — 잠깐 보여 주고 끝 (세이브에 돌려주는 건 play.ts)
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
  counterMove,
  fighterOf,
  fleeChance,
  gaugeRate,
  guardFactor,
  isShooting,
  streakMultiplier,
  ultGain,
  type Fighter,
} from '../rules/battle';
import { itemName } from '../rules/items';
import { effectivenessText } from '../rules/types';
import { ITEM_IDS, type EncounterStart, type ItemId, type Monster, type MoveSlot, type Save, type StatusCondition } from '../save';
import { withJosa } from '../text';
import { moveOf, speciesOf, type ReadonlyMove } from '../../data';
import type { Rng } from './rng';

export type Side = 'me' | 'foe';

export type BattleAction =
  | { kind: 'attack' }
  | { kind: 'move'; moveId: number }
  | { kind: 'guard' }
  /** uid = 기력의조각으로 살릴 포켓몬 */
  | { kind: 'item'; item: ItemId; uid?: string }
  | { kind: 'switch'; uid: string }
  | { kind: 'flee' }
  | { kind: 'ult' }
  /** 잠듦 · 마비로 못 움직임 */
  | { kind: 'skip' };

export interface BattleAnim {
  side: Side;
  action: BattleAction;
  ms: number;
  dur: number;
  /** 상대가 쏘는 기술 — 내 맞받아치기 버튼이 떠 있음 */
  counter: boolean;
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

/** 머리 위에 잠깐 뜨는 글 (피해 숫자 · 효과가 굉장했다! · 급소) */
export interface BattlePopup {
  /** 순번 — 같은 걸음에 같은 글이 두 번 떠도 따로 그리게 */
  id: number;
  side: Side;
  text: string;
  ms: number;
  kind: 'damage' | 'heal' | 'info';
}

export interface BattleState {
  kind: 'wild';
  me: Fighter;
  foe: Fighter;
  /** 이 전투에서 바뀐 내 포켓몬 (교체로 나온 포켓몬의 HP · PP · 상태) — 끝나면 세이브에 */
  bench: Record<string, { hp: number; moves: MoveSlot[]; status: StatusCondition | null; ult?: number }>;
  /** 이 전투에서 쓴 아이템 (끝나면 가방에서 뺌) */
  bagUsed: Partial<Record<ItemId, number>>;
  phase: 'run' | 'choose' | 'anim' | 'clash' | 'pick' | 'over';
  anim: BattleAnim | null;
  clash: BattleClash | null;
  result: 'win' | 'lose' | 'flee' | null;
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

const POPUP_MS = 1200;
const nameOf = (f: Fighter) => speciesOf(f.species)?.name.ko ?? '???';
const label = (f: Fighter, side: Side) => (side === 'foe' ? `야생 ${nameOf(f)}` : nameOf(f));
const other = (s: Side): Side => (s === 'me' ? 'foe' : 'me');
/** 내 차례 한 줄 — 곁눈으로 봐도 "기다리는 중" 인 걸 알게 */
const chooseMsg = (b: BattleState) => `${withJosa(nameOf(b.me), '은/는')} 무엇을 할까? (1 ~ 5)`;

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
    bench: {},
    bagUsed: {},
    phase: lead ? 'run' : 'over',
    anim: null,
    clash: null,
    result: lead ? null : 'lose',
    overMs: 0,
    fleeTries: 0,
    msg: !lead ? '싸울 수 있는 포켓몬이 없다…' : start === 'preemptive' ? '⚡ 선제공격!' : start === 'ambush' ? '💢 기습당했다!' : `가랏, ${nameOf(me)}!`,
    popups: [],
    popupSeq: 0,
    t: 0,
    ultAt: { me: null, foe: null },
    start,
  };
  return b;
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
  if (action.kind !== 'ult') actor.gauge = 0;
  // 방어는 다음 내 행동까지 — 내 차례가 오면 풀림
  if (action.kind !== 'ult') actor.guard = 1;

  // 잠듦 · 마비 (원작 규칙 [제안]) — 필살기는 막지 않음
  if (action.kind !== 'ult' && action.kind !== 'switch' && action.kind !== 'item' && action.kind !== 'flee') {
    const st = actor.status;
    if (st?.kind === 'sleep') {
      const left = st.turnsLeft - 1;
      actor.status = left > 0 ? { kind: 'sleep', turnsLeft: left } : null;
      action = { kind: 'skip' };
      b.msg = left > 0 ? `${withJosa(label(actor, side), '은/는')} 쿨쿨 잠들어 있다` : `${withJosa(label(actor, side), '이/가')} 눈을 떴다!`;
    } else if (st?.kind === 'paralysis' && rng.chance(BALANCE.paralysisSkip)) {
      action = { kind: 'skip' };
      b.msg = `${withJosa(label(actor, side), '은/는')} 몸이 저려 움직일 수 없다!`;
    }
  }

  if (action.kind !== 'guard' && action.kind !== 'ult') actor.guardStreak = 0;
  // 연달아 세지는 기술: 같은 기술을 또 쓰면 +1, 다른 행동이면 처음부터 (필살기는 아무 때나 끼어드는 것이라 그대로)
  if (action.kind !== 'ult') {
    const mv = action.kind === 'move' ? moveOf(action.moveId) : undefined;
    if (mv?.streak && actor.streakMove === mv.id) actor.streakCount += 1;
    else {
      actor.streakMove = mv?.streak ? mv.id : null;
      actor.streakCount = 0;
    }
  }
  let dur: number = TIMING.attackAnimMs;
  let counter = false;
  switch (action.kind) {
    case 'attack':
      b.msg = `${label(actor, side)}의 공격!`;
      break;
    case 'move': {
      const id = action.moveId;
      actor.moves = actor.moves.map((s) => (s.moveId === id ? { ...s, pp: Math.max(0, s.pp - 1) } : s));
      const mv = moveOf(id);
      b.msg = `${label(actor, side)}의 ${moveName(id)}!`;
      dur = TIMING.moveAnimMs;
      // 상대가 쏘는 기술 → 내 게이지가 절반 이상이고 나도 쏘는 기술이 있으면 맞받아치기 창
      if (side === 'foe' && isShooting(mv) && b.me.gauge >= BALANCE.counterMinGauge && mv && counterMove(b.me, mv)) {
        counter = true;
        dur = Math.max(dur, TIMING.counterWindowMs);
      }
      break;
    }
    case 'guard':
      actor.guard = guardFactor(actor.guardStreak);
      actor.guardStreak += 1;
      b.msg = actor.guard < 1 ? `${withJosa(label(actor, side), '은/는')} 몸을 지켰다!` : `${withJosa(label(actor, side), '은/는')} 몸을 지키려 했지만 지쳤다…`;
      dur = TIMING.guardAnimMs;
      break;
    case 'item':
      b.msg = `${withJosa(itemName(action.item), '을/를')} 썼다!`;
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
      b.msg = `${label(actor, side)}의 필살기!`;
      dur = TIMING.ultAnimMs;
      break;
    case 'skip':
      dur = TIMING.guardAnimMs;
      break;
  }
  return { ...b, phase: 'anim', anim: { side, action, ms: 0, dur, counter } };
}

/** 피해를 주고 필살기 게이지 · 글을 남김 */
function hit(b: BattleState, attackerSide: Side, power: number, type: ReadonlyMove['type'] | null, rng: Rng, opts: { useUlt?: boolean; move?: ReadonlyMove } = {}): number {
  const a = b[attackerSide];
  const d = b[other(attackerSide)];
  const guarded = d.guard < 1;
  const r = computeDamage({ attacker: a, defender: d, power, type, useUlt: opts.useUlt, rng });
  let dmg = r.damage;
  if (opts.move?.effect === 'leave-1hp') dmg = Math.min(dmg, Math.max(0, d.hp - 1));
  // 실제로 깎인 HP — 남은 HP 보다 큰 피해는 넘치는 만큼 버림 (흡수 · 반동 · 숫자도 이 값으로, 원작처럼)
  const before = d.hp;
  d.hp = Math.max(0, d.hp - dmg);
  dmg = before - d.hp;
  popup(b, other(attackerSide), `-${dmg}`, 'damage');
  const eff = effectivenessText(r.effect);
  if (eff) popup(b, other(attackerSide), eff, 'info');
  if (r.crit && dmg > 0) popup(b, other(attackerSide), '급소에 맞았다!', 'info');
  if (dmg > 0) {
    if (!opts.useUlt) a.ult = Math.min(1, a.ult + ultGain('hit', a, { wild: attackerSide === 'foe' }));
    d.ult = Math.min(1, d.ult + ultGain('hurt', d, { guarded, wild: attackerSide === 'me' }));
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
  popup(b, side, text, 'info');
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
function resolveMove(b: BattleState, side: Side, mv: ReadonlyMove | undefined, rng: Rng, powerScale = 1): void {
  const target = other(side);
  if (!mv) return;
  if (mv.accuracy !== null && !rng.chance(mv.accuracy / 100)) {
    popup(b, target, '빗나갔다!', 'info');
    return;
  }
  if (mv.class !== 'status' && mv.power > 0) hit(b, side, Math.round(mv.power * powerScale), mv.type, rng, { move: mv });
  if (!mv.ailment) return;
  // 효과가 없는 상대 (상성 0 · 타입 면역) 에게는 상태 이상도 안 걸림
  if (!canInflict(mv.ailment, mv.type, b[target].types)) {
    if (mv.class === 'status') popup(b, target, '효과가 없는 것 같다…', 'info');
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
      resolveMove(b, side, mv, rng, mv?.streak ? streakMultiplier(actor.streakCount) : 1);
      break;
    }
    case 'item': {
      const item = anim.action.item;
      b.bagUsed = { ...b.bagUsed, [item]: (b.bagUsed[item] ?? 0) + 1 };
      if (item === 'potion' || item === 'super-potion') {
        const heal = Math.min(actor.maxHp - actor.hp, item === 'potion' ? BALANCE.potionHeal : BALANCE.superPotionHeal);
        actor.hp += heal;
        popup(b, side, `+${heal}`, 'heal');
      } else if (item === 'full-heal') {
        actor.status = null;
        popup(b, side, '몸이 개운해졌다!', 'info');
      } else if (item === 'revive' && anim.action.uid) {
        // 쓰러진 팀 포켓몬을 HP 절반으로 (나와 있는 포켓몬이 아니라 교체로 낼 포켓몬)
        const m = faintedTeam(b, save).find((x) => x.uid === (anim.action as { uid?: string }).uid);
        if (m) {
          const hp = Math.max(1, Math.floor(fighterOf({ ...m, hp: 99999 }).maxHp * BALANCE.reviveFraction));
          b.bench = { ...b.bench, [m.uid]: { hp, moves: m.moves, status: null, ult: b.bench[m.uid]?.ult ?? 0 } };
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
        next.ult = saved?.ult ?? 0;
        b.me = next;
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
    case 'guard':
    case 'skip':
      break;
  }
  if (anim.action.kind !== 'ult' && anim.action.kind !== 'switch') afterAction(b, side);
  return afterHits({ ...b, anim: null }, save);
}

/** 쓰러졌는지 보고 다음 단계로 */
function afterHits(b: BattleState, save: Save): BattleState {
  if (b.foe.hp <= 0) {
    return { ...b, phase: 'over', result: 'win', overMs: 0, msg: `${withJosa(label(b.foe, 'foe'), '이/가')} 쓰러졌다!` };
  }
  if (b.me.hp <= 0) {
    const bench = { ...b.bench, [b.me.uid]: { hp: 0, moves: b.me.moves, status: b.me.status } };
    const nb = { ...b, bench };
    if (switchable(nb, save).length === 0) return { ...nb, phase: 'over', result: 'lose', overMs: 0, msg: `${withJosa(nameOf(b.me), '이/가')} 쓰러졌다… 눈앞이 깜깜해졌다` };
    return { ...nb, phase: 'pick', msg: `${withJosa(nameOf(b.me), '이/가')} 쓰러졌다! 다음 포켓몬을 골라요 (숫자 키)` };
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
  /** 자동 전투 — 내 행동도 AI 가 고름 (필살기는 차면 바로 [제안]) */
  auto: boolean;
}

/** 걸음 하나 */
export function battleStep(b0: BattleState, save: Save, stepMs: number, rng: Rng, opts: BattleStepOptions): BattleState {
  let b: BattleState = {
    ...b0,
    t: b0.t + stepMs,
    popups: b0.popups.filter((p) => p.ms + stepMs < POPUP_MS).map((p) => ({ ...p, ms: p.ms + stepMs })),
  };
  switch (b.phase) {
    case 'run': {
      const me = { ...b.me, gauge: Math.min(1, b.me.gauge + gaugeRate(b.me, b.foe) * stepMs) };
      const foe = { ...b.foe, gauge: Math.min(1, b.foe.gauge + gaugeRate(b.foe, b.me) * stepMs) };
      b = { ...b, me, foe };
      // 필살기: 야생 = 차면 바로 (끼어들지는 않음 [제안]) · 자동 전투의 내 필살기도 차면 바로 — 같은 걸음에 둘 다 쓰면 필살기 힘대결 (4장 동시 필살기)
      if (opts.auto && b.me.ult >= 1 && b.foe.ult >= 1) return startClash({ ...b, me: { ...b.me, ult: 0 }, foe: { ...b.foe, ult: 0 } }, 'ult', null, null);
      if (b.foe.ult >= 1) return startAction(b, 'foe', { kind: 'ult' }, rng);
      if (opts.auto && b.me.ult >= 1) return startAction(b, 'me', { kind: 'ult' }, rng);
      const meReady = b.me.gauge >= 1;
      const foeReady = b.foe.gauge >= 1;
      if (meReady && (!foeReady || b.me.stats.speed >= b.foe.stats.speed)) {
        if (!opts.auto) return { ...b, phase: 'choose', msg: chooseMsg(b) };
        const pick = aiPick(b.me, b.foe, 'smart', rng);
        return startAction(b, 'me', pick, rng);
      }
      if (foeReady) return startAction(b, 'foe', aiPick(b.foe, b.me, 'wild', rng), rng);
      return b;
    }
    case 'choose':
      if (opts.auto) return startAction(b, 'me', aiPick(b.me, b.foe, 'smart', rng), rng);
      return b; // 양쪽 멈춤 — 내가 고를 때까지
    case 'anim': {
      const anim = { ...b.anim!, ms: b.anim!.ms + stepMs };
      b = { ...b, anim };
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
      const next = bestNext(team, b.foe.types);
      return next ? pickNext(b, save, next.uid) : b;
    }
    case 'over':
      return { ...b, overMs: b.overMs + stepMs };
  }
}

function pickNext(b: BattleState, save: Save, uid: string): BattleState {
  const m = switchable(b, save).find((x) => x.uid === uid);
  if (!m) return b;
  const next = fighterOf(m);
  next.ult = b.bench[uid]?.ult ?? 0;
  return { ...b, me: next, phase: 'run', msg: `가랏, ${nameOf(next)}!` };
}

/** 전투 결과를 보여 주는 시간이 다 지났는지 */
export function battleDone(b: BattleState): boolean {
  return b.phase === 'over' && b.overMs >= TIMING.battleOverMs;
}

/** 내가 골라야 앞으로 가는지 (자동 전투가 꺼져 있을 때) */
export function battleWaiting(b: BattleState): boolean {
  return b.phase === 'choose' || b.phase === 'pick';
}

export type BattleInput =
  | { kind: 'act'; action: BattleAction }
  | { kind: 'ult' }
  /** Space · 클릭 — 힘대결 연타 · 맞받아치기 · 필살기 맞받아치기 */
  | { kind: 'space' }
  | { kind: 'pick'; uid: string };

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
      if (action.item === 'potion' || action.item === 'super-potion') return b.me.hp < b.me.maxHp;
      if (action.item === 'full-heal') return b.me.status !== null;
      if (action.item === 'revive') {
        const fainted = faintedTeam(b, save);
        return action.uid === undefined ? fainted.length > 0 : fainted.some((m) => m.uid === action.uid);
      }
      return false; // 볼 (단계 7 S11)
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
  return b.phase === 'anim' && b.anim?.side === 'foe' && b.anim.action.kind !== 'ult';
}

/** 맞받아치기 버튼이 떠 있는지 */
export function counterOpen(b: BattleState): boolean {
  return b.phase === 'anim' && !!b.anim?.counter && b.anim.side === 'foe' && b.me.gauge >= BALANCE.counterMinGauge;
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
    case 'act':
      if (!canAct(b, save, input.action)) return b;
      return startAction(b, 'me', input.action, rng);
    case 'ult': {
      if (ultCounterOpen(b)) return startClash({ ...b, me: { ...b.me, ult: 0 } }, 'ult', null, null);
      if (!canUlt(b)) return b;
      // 상대 기술 연출 중에 끼어들면 상대 기술은 취소 (상대 PP 는 깎인 채 — 2026-10-18 태현 님)
      const interrupted = b.phase === 'anim' && b.anim?.side === 'foe';
      const nb = startAction(interrupted ? { ...b, anim: null } : b, 'me', { kind: 'ult' }, rng);
      if (interrupted) return { ...nb, msg: `끼어들었다! ${nb.msg}` };
      // 고르는 중에 쓴 필살기 — 끝나면 다시 고르기 (내 행동 게이지는 그대로)
      return nb;
    }
    case 'space': {
      if (b.phase === 'clash' && b.clash) {
        if (b.clash.winner !== null) return b; // 승자가 정해진 뒤 연타는 안 셈
        const taps = Math.min(Math.round(BALANCE.clashTapMax / BALANCE.clashTap), b.clash.taps + 1);
        return { ...b, clash: { ...b.clash, taps } };
      }
      if (ultCounterOpen(b)) return startClash({ ...b, me: { ...b.me, ult: 0 } }, 'ult', null, null);
      if (counterOpen(b) && b.anim?.action.kind === 'move') {
        const incoming = moveOf(b.anim.action.moveId);
        const mine = incoming ? counterMove(b.me, incoming) : null;
        if (!incoming || !mine) return b;
        // 맞받아치기도 내 행동 — 게이지를 다 쓰고 방어 · 연달아는 풀림
        const me = { ...b.me, gauge: 0, guard: 1, guardStreak: 0, streakMove: null, streakCount: 0, moves: b.me.moves.map((s) => (s.moveId === mine.id ? { ...s, pp: Math.max(0, s.pp - 1) } : s)) };
        return startClash({ ...b, me }, 'move', mine, incoming);
      }
      return b;
    }
    case 'pick':
      if (b.phase !== 'pick') return b;
      return pickNext(b, save, input.uid);
  }
}

/** 전투 끝 — 내 포켓몬 HP · PP · 상태 이상과 쓴 아이템을 세이브에. 지면 (임시, 패배 화면은 단계 9) 팀을 회복 */
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
  let next: Save = { ...save, monsters, bag, pendingEncounter: null };
  // 이겼어도 (반동 · 독으로 같이 쓰러져) 살아 있는 포켓몬이 없으면 진 것과 같이
  const anyAlive = next.party.some((uid) => (next.monsters[uid]?.hp ?? 0) > 0);
  if (b.result === 'lose' || !anyAlive) {
    // 패배 화면 (S17) 은 단계 9 — 그 전까지는 팀을 회복하고 계속 걸음 (임시)
    const healed = { ...next.monsters };
    for (const uid of next.party) {
      const m = healed[uid];
      const s = m ? speciesOf(m.species) : undefined;
      if (m && s) healed[uid] = { ...m, hp: fighterOf({ ...m, hp: 99999 }).maxHp, status: null, moves: m.moves.map((x) => ({ ...x, pp: moveOf(x.moveId)?.pp ?? x.pp })) };
    }
    next = { ...next, monsters: healed };
  }
  return next;
}

// ---------- 다른 쪽 (웹뷰) 에서 온 전투 상태 검사 — 모양이 이상하면 null (그 전투를 처음부터)

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const fin = (v: unknown, min = -1e12, max = 1e12): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const SIDES = ['me', 'foe'];
const PHASES = ['run', 'choose', 'anim', 'clash', 'pick', 'over'];
const ACTIONS = ['attack', 'move', 'guard', 'item', 'switch', 'flee', 'ult', 'skip'];
const STATUS = ['poison', 'burn', 'paralysis', 'sleep'];
const POPUP_KINDS = ['damage', 'heal', 'info'];
const STARTS = ['preemptive', 'normal', 'ambush'];

function okStatus(st: unknown): boolean {
  if (st === null) return true;
  if (!isObj(st) || !STATUS.includes(st.kind as string)) return false;
  return st.kind !== 'sleep' || fin(st.turnsLeft, 0, 10);
}

function okMoves(moves: unknown): boolean {
  return Array.isArray(moves) && moves.length <= BALANCE.moveSlots && moves.every((m) => isObj(m) && fin(m.moveId, 1, 100000) && fin(m.pp, 0, 100));
}

function okFighter(f: unknown): boolean {
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
    fin(f.streakCount, 0, 10000)
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

export function readBattle(raw: unknown): BattleState | null {
  if (!isObj(raw) || raw.kind !== 'wild' || !okFighter(raw.me) || !okFighter(raw.foe)) return null;
  if (!PHASES.includes(raw.phase as string) || !okBench(raw.bench) || !okBag(raw.bagUsed)) return null;
  if (!Array.isArray(raw.popups) || !raw.popups.every((p) => isObj(p) && fin(p.id, 0) && SIDES.includes(p.side as string) && typeof p.text === 'string' && fin(p.ms, 0) && POPUP_KINDS.includes(p.kind as string))) return null;
  const anim = raw.anim;
  if (anim !== null && !(isObj(anim) && SIDES.includes(anim.side as string) && okAction(anim.action) && fin(anim.ms, 0) && fin(anim.dur, 0, 60_000) && typeof anim.counter === 'boolean')) return null;
  const clash = raw.clash;
  if (clash !== null && !(isObj(clash) && (clash.kind === 'move' || clash.kind === 'ult') && (clash.me === null || fin(clash.me, 1, 100000)) && (clash.foe === null || fin(clash.foe, 1, 100000)) && fin(clash.base, 0, 1) && fin(clash.taps, 0, 1000) && fin(clash.ms, 0) && (clash.winner === null || SIDES.includes(clash.winner as string)))) return null;
  if (raw.phase === 'anim' && anim === null) return null;
  if (raw.phase === 'clash' && clash === null) return null;
  if (!(raw.result === null || raw.result === 'win' || raw.result === 'lose' || raw.result === 'flee')) return null;
  // 끝난 전투에는 결과가, 진행 중에는 결과가 없어야 함
  if ((raw.phase === 'over') !== (raw.result !== null)) return null;
  if (!fin(raw.overMs, 0) || !fin(raw.fleeTries, 0, 1000) || typeof raw.msg !== 'string' || !fin(raw.t, 0) || !fin(raw.popupSeq, 0)) return null;
  if (!isObj(raw.ultAt) || !STARTS.includes(raw.start as string)) return null;
  return raw as unknown as BattleState;
}
