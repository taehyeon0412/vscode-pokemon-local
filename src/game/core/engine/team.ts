/**
 * 3:3 실시간 팀 배틀 (다음 버전 5단계 — gdd 4.7 끝 「3:3 실시간 팀 배틀」, 2026-10-21 orders #17).
 *   메뉴 없이 6마리가 스피드대로 게이지가 차면 AI 가 기술을 고름 (겹쳐도 바로 — 일반 공격 없음 · PP 안 닳음 · 변화 기술은 가끔).
 *   내가 하는 것 = 필살기 (1 · 2 · 3 · Z) · 상대 필살기에 끼어들기 (1:2 · 2:3 …, 연타). 쏘는 기술끼리 엇갈리면 기술 힘겨루기 (1.5초 자동, 1:1).
 *   필살기 · 필살기 힘겨루기 동안 나머지는 멈춤 · 기술 힘겨루기 동안은 계속 싸움. 패링 · 아이템 · 교체 · 도망 없음 · 쓰러지면 빠짐.
 * 화면 자리 · 거리는 모름 (화면이 정함 — 모양은 디자인팀이 아직 정하는 중). 계산은 화면과 떼어 둠.
 */
import { BALANCE, TIMING } from '../balance';
import { canInflict, clashChance, clashWithTaps, computeDamage, fighterOf, isShooting, ultGain, type Fighter } from '../rules/battle';
import { effectiveness } from '../rules/types';
import type { Monster, Save } from '../save';
import { withJosa } from '../text';
import { moveOf, speciesOf, type ReadonlyMove } from '../../data';
import { POPUP_MS, type BattlePopup, type Side } from './battle';
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

/** 원작에서 상대 모두를 치는 기술 (범위 — 상대 모두에게 0.75배) */
const SPREAD = new Set([
  'surf', 'earthquake', 'magnitude', 'discharge', 'rock-slide', 'bulldoze', 'icy-wind', 'heat-wave', 'petal-blizzard', 'eruption', 'water-spout',
  'hyper-voice', 'sludge-wave', 'blizzard', 'muddy-water', 'lava-plume', 'dazzling-gleam', 'snarl', 'struggle-bug', 'electroweb', 'air-cutter',
  'twister', 'razor-leaf', 'acid', 'powder-snow', 'swift', 'boomburst', 'parabolic-charge', 'mud-shot', 'breaking-swipe',
]);
export const isSpread = (mv: ReadonlyMove | undefined): boolean => !!mv && mv.power > 0 && SPREAD.has(mv.key);

const alive = (f: Fighter) => f.hp > 0;
const other = (s: Side): Side => (s === 'me' ? 'foe' : 'me');
const nameOf = (f: Fighter) => speciesOf(f.species)?.name.ko ?? f.form;

// ---------- 시작

/** 3:3 을 할 수 있는지 — 살아 있는 내 포켓몬 3마리 이상 (gdd: 3마리 미만이면 1:1) */
export function teamPossible(save: Save): boolean {
  return save.party.filter((uid) => (save.monsters[uid]?.hp ?? 0) > 0).length >= BALANCE.team.size;
}

/** 나갈 3마리 — 상대 팀에 효과가 굉장한 기술이 많은 순 (같으면 레벨 높은 쪽) · 자동 전투 · 고르지 않았을 때 */
export function pickTeam(save: Save, foes: readonly Monster[]): string[] {
  const foeTypes = foes.map((m) => speciesOf(m.species)?.types ?? []);
  const score = (m: Monster) =>
    foeTypes.reduce((sum, t) => sum + Math.max(1, ...m.moves.map((s) => moveOf(s.moveId)).filter((mv): mv is ReadonlyMove => !!mv && mv.power > 0).map((mv) => effectiveness(mv.type, t))), 0);
  return save.party
    .map((uid) => save.monsters[uid])
    .filter((m): m is Monster => !!m && m.hp > 0)
    .sort((a, b) => score(b) - score(a) || b.level - a.level)
    .slice(0, BALANCE.team.size)
    .map((m) => m.uid);
}

/** 3:3 시작 — uids = 내가 고른 3마리 (없으면 pickTeam) · 상대는 받은 팀 앞에서 3마리 */
export function startTeamBattle(save: Save, foes: readonly Monster[], kind: 'trainer' | 'gym', foeName: string, uids?: readonly string[]): TeamBattle {
  const mine = (uids ?? pickTeam(save, foes)).map((uid) => save.monsters[uid]).filter((m): m is Monster => !!m && m.hp > 0).slice(0, BALANCE.team.size);
  const me = mine.map((m) => fighterOf(m));
  const foe = foes.slice(0, BALANCE.team.size).map((m) => fighterOf({ ...m, hp: 1e6 }));
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
  };
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

function gainUlt(b: TeamBattle, side: Side, slot: number, kind: 'hit' | 'hurt'): void {
  const f = b[side][slot]!;
  if (!alive(f) || f.ult >= 1) return;
  f.ult = Math.min(1, f.ult + ultGain(kind, f) * BALANCE.team.ultGainScale);
  if (f.ult >= 1) b.ultReadyAt[side][slot] = b.t;
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
 * 변화 기술 = 0.3 (상태 이상이 없는 상대가 있을 때만). 쓸 기술이 없으면 null
 */
export function teamPick(self: Fighter, foes: readonly Fighter[], rng: Rng): { moveId: number; targets: number[] } | null {
  const moves = self.moves.map((s) => moveOf(s.moveId)).filter((mv): mv is ReadonlyMove => !!mv);
  const living = foes.map((f, i) => (alive(f) ? i : -1)).filter((i) => i >= 0);
  if (moves.length === 0 || living.length === 0) return null;
  const weights = moves.map((mv) => {
    if (mv.class === 'status' || mv.power <= 0) return living.some((i) => !foes[i]!.status) && mv.ailment ? BALANCE.team.statusWeight : 0;
    const t = bestTarget(foes, mv);
    const eff = t === null ? 1 : effectiveness(mv.type, foes[t]!.types);
    const stab = self.types.includes(mv.type) ? 1.5 : 1;
    return Math.max(0.1, (mv.power / 40) * eff * eff * stab);
  });
  const total = weights.reduce((a, w) => a + w, 0);
  if (total <= 0) return null;
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
  const target = pick.class === 'status' || pick.power <= 0 ? (living.find((i) => !foes[i]!.status) ?? living[0]!) : bestTarget(foes, pick)!;
  return { moveId: pick.id, targets: [target] };
}

/** 피해 하나 (3:3 피해 배율 · 범위 0.75) — 쓰러지면 빠짐 */
function damage(b: TeamBattle, side: Side, from: number, to: number, power: number, type: ReadonlyMove['type'] | null, rng: Rng, useUlt: boolean, scale = 1): void {
  const a = b[side][from]!;
  const d = b[other(side)][to]!;
  if (!alive(d)) return;
  const r = computeDamage({ attacker: a, defender: d, power: Math.max(1, Math.round(power * scale)), type, useUlt, rng });
  // 3:3 피해 배율은 마지막 피해에 (위력에 곱하면 식의 +2 가 남아 한 판 길이가 배율대로 안 늘어남)
  const dmg = r.effect === 0 ? 0 : Math.max(1, Math.round(r.damage * BALANCE.team.damageScale));
  d.hp = Math.max(0, d.hp - dmg);
  popup(b, other(side), to, `-${dmg}`, r.crit ? 'crit' : r.effect > 1 ? 'super' : r.effect < 1 ? (r.effect === 0 ? 'immune' : 'weak') : 'damage');
  if (!useUlt) {
    gainUlt(b, side, from, 'hit');
    gainUlt(b, other(side), to, 'hurt');
  }
  if (d.hp <= 0) faint(b, other(side), to);
}

function faint(b: TeamBattle, side: Side, slot: number): void {
  const f = b[side][slot]!;
  f.gauge = 0;
  popup(b, side, slot, `${nameOf(f)} 쓰러졌다!`, 'info');
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
  const mv = moveOf(s.moveId);
  if (!mv) return;
  const foes = b[other(s.side)];
  const targets = s.targets.length > 1 ? s.targets.filter((i) => alive(foes[i]!)) : [alive(foes[s.targets[0]!]!) ? s.targets[0]! : bestTarget(foes, mv)].filter((i): i is number => i !== null);
  const spread = targets.length > 1 ? BALANCE.team.spreadScale : 1;
  for (const t of targets) {
    if (mv.accuracy !== null && !rng.chance(mv.accuracy / 100)) {
      popup(b, other(s.side), t, '빗나갔다!', 'miss');
      continue;
    }
    if (mv.class !== 'status' && mv.power > 0) damage(b, s.side, s.from, t, mv.power, mv.type, rng, false, spread);
    const d = foes[t]!;
    if (mv.ailment && alive(d) && !d.status && canInflict(mv.ailment, mv.type, d.types) && rng.chance(mv.ailmentChance / 100)) {
      const [lo, hi] = BALANCE.sleepTurns;
      d.status = mv.ailment === 'sleep' ? { kind: 'sleep', turnsLeft: rng.int(lo, hi) } : { kind: mv.ailment };
      popup(b, other(s.side), t, { poison: '독에 걸렸다!', burn: '화상을 입었다!', paralysis: '마비되었다!', sleep: '잠들었다!' }[mv.ailment], 'status');
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
  const pick = teamPick(f, b[other(side)], rng);
  if (!pick) return;
  const mv = moveOf(pick.moveId);
  b.seq += 1;
  const dur = TIMING.team.moveMs;
  b.shots = [...b.shots, { id: b.seq, side, from: slot, targets: pick.targets, moveId: pick.moveId, ms: 0, dur, hitMs: Math.round(dur * 0.7), hit: false, shooting: isShooting(mv), clash: false }];
  tick(b, side, slot);
}

/** 쏘는 기술끼리 엇갈림 — 둘 다 날아가는 중 (쏜 뒤 · 닿기 전) 이고 아직 힘겨루기를 안 한 반대편 기술 */
function findMoveClash(b: TeamBattle): [TeamShot, TeamShot] | null {
  const flying = (s: TeamShot) => s.shooting && !s.clash && !s.hit && s.ms >= s.dur * 0.15 && s.ms < s.hitMs;
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
  const win = meWins ? a : f;
  const lose = meWins ? f : a;
  const wm = moveOf(win.moveId);
  if (wm && alive(b[win.side][win.from]!)) damage(b, win.side, win.from, lose.from, wm.power, wm.type, rng, false);
}

/** 필살기 쓰기 — 나머지는 멈춤 · 끼어들 수 있는 창 (상대 AI 는 시작할 때 정함) */
function startUlt(b: TeamBattle, side: Side, slot: number, rng: Rng): void {
  const f = b[side][slot]!;
  f.ult = 0;
  b.ultReadyAt[side][slot] = null;
  const window = TIMING.team.interruptMs;
  const foes = b[other(side)];
  // 상대 AI 끼어들기 — 내 필살기에 (트레이너 가끔 · 관장 자주)
  const chance = side === 'me' ? BALANCE.team.interruptChance[b.kind] : 0;
  const joiners = foes.map((x, i) => (alive(x) && x.ult >= 1 && rng.chance(chance) ? i : -1)).filter((i) => i >= 0);
  b.phase = 'ult';
  b.ult = { side, from: slot, ms: 0, dur: TIMING.ultAnimMs, hitMs: Math.round(TIMING.ultAnimMs * 0.6), hit: false, window, joinAt: joiners.length ? rng.int(200, window - 100) : null, joiners };
  b.msg = `${nameOf(f)}의 필살기!`;
}

/** 필살기 힘겨루기 시작 — 쓴 쪽 + 끼어든 쪽 (그 뒤에도 합류) */
function startUltClash(b: TeamBattle, joinSide: Side, joiners: number[]): void {
  const u = b.ult!;
  for (const i of joiners) {
    b[joinSide][i]!.ult = 0;
    b.ultReadyAt[joinSide][i] = null;
  }
  const me = u.side === 'me' ? [u.from] : joiners;
  const foe = u.side === 'foe' ? [u.from] : joiners;
  b.phase = 'clash';
  b.clash = { kind: 'ult', me: [...me], foe: [...foe], shots: null, ms: 0, dur: TIMING.team.ultClashMs, taps: 0, winner: null };
  b.ult = null;
  b.msg = me.length === foe.length ? '필살기 힘겨루기!' : `필살기 힘겨루기! ${me.length}:${foe.length}`;
}

/** 필살기 힘겨루기 끝 — 합류한 필살 스탯의 합 · 연타 · 진 쪽 참가자 모두 피해 (이긴 쪽 가장 센 필살기 × (1 + 0.25 × 더 합류한 수)) */
function endUltClash(b: TeamBattle, rng: Rng): void {
  const c = b.clash!;
  const sum = (side: Side, list: number[]) => list.reduce((s, i) => s + b[side][i]!.stats.ultimate, 0);
  const p = clashWithTaps(clashChance(sum('me', c.me), sum('foe', c.foe)), c.taps);
  const meWins = rng.chance(p);
  c.winner = meWins ? 'me' : 'foe';
  const winSide: Side = meWins ? 'me' : 'foe';
  const winners = meWins ? c.me : c.foe;
  const losers = meWins ? c.foe : c.me;
  const lead = winners.reduce((best, i) => (b[winSide][i]!.stats.ultimate > b[winSide][best]!.stats.ultimate ? i : best), winners[0]!);
  const power = BALANCE.ultPower * (1 + BALANCE.team.ultJoinBonus * (winners.length - 1));
  for (const t of losers) damage(b, winSide, lead, t, power, b[winSide][lead]!.types[0] ?? null, rng, true);
  b.msg = meWins ? '힘겨루기에서 이겼다!' : '힘겨루기에서 졌다…';
  b.clash = null;
  b.phase = 'run';
}

function checkEnd(b: TeamBattle): void {
  if (b.phase === 'over') return;
  const meLeft = b.me.some(alive);
  const foeLeft = b.foe.some(alive);
  if (meLeft && foeLeft) return;
  b.phase = 'over';
  b.result = foeLeft ? 'lose' : 'win';
  b.ult = null;
  b.clash = null;
  b.moveClashes = [];
  b.shots = [];
  b.overMs = 0;
  b.msg = b.result === 'win' ? `${withJosa(b.foeName, '과/와')}의 3:3 승부에서 이겼다!` : '내 포켓몬이 다 쓰러졌다…';
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

// ---------- 입력 · 걸음

/** 지금 그 칸 필살기를 쓸 · 끼어들 · 합류할 수 있는지 (화면이 아이콘을 밝게) */
export function teamUltOpen(b: TeamBattle, slot: number): boolean {
  const f = b.me[slot];
  if (!f || !alive(f) || f.ult < 1) return false;
  if (b.phase === 'run') return true;
  if (b.phase === 'ult') return b.ult!.side === 'foe' && b.ult!.window > 0;
  return b.phase === 'clash' && b.clash!.kind === 'ult' && !b.clash!.me.includes(slot);
}

export function teamInput(b0: TeamBattle, input: TeamInput, rng: Rng): TeamBattle {
  if (b0.phase === 'over') return b0;
  if (input.kind === 'space') {
    if (b0.phase !== 'clash' || !b0.clash) return b0;
    return { ...b0, clash: { ...b0.clash, taps: b0.clash.taps + 1 } };
  }
  const slot = input.slot ?? firstReady(b0, 'me');
  if (slot === null || !teamUltOpen(b0, slot)) return b0;
  const b = clone(b0);
  if (b.phase === 'run') startUlt(b, 'me', slot, rng);
  else if (b.phase === 'ult') startUltClash(b, 'me', [slot]);
  else if (b.clash) {
    b.me[slot]!.ult = 0;
    b.ultReadyAt.me[slot] = null;
    b.clash.me = [...b.clash.me, slot];
    b.msg = `합류! 필살기 힘겨루기 ${b.clash.me.length}:${b.clash.foe.length}`;
  }
  return b;
}

export function teamStep(b0: TeamBattle, stepMs: number, rng: Rng, opts: TeamStepOptions): TeamBattle {
  const b = clone(b0);
  b.t += stepMs;
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
        startUltClash(b, 'foe', u.joiners.filter((i) => alive(b.foe[i]!) && b.foe[i]!.ult >= 1));
        return b;
      }
      if (u.side === 'foe' && auto && u.window > 0) {
        const mine = b.me.map((f, i) => (alive(f) && f.ult >= 1 ? i : -1)).filter((i) => i >= 0);
        if (mine.length) {
          startUltClash(b, 'me', mine);
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
      if (auto) {
        b.me.forEach((f, i) => {
          if (alive(f) && f.ult >= 1 && !c.me.includes(i)) {
            f.ult = 0;
            c.me = [...c.me, i];
          }
        });
      }
      b.foe.forEach((f, i) => {
        if (alive(f) && f.ult >= 1 && !c.foe.includes(i) && rng.chance((BALANCE.team.interruptChance[b.kind] * stepMs) / c.dur)) {
          f.ult = 0;
          c.foe = [...c.foe, i];
        }
      });
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
    }
  }
  b.shots = b.shots.filter((s) => s.clash || s.ms < s.dur);
  const pair = findMoveClash(b);
  if (pair) {
    pair[0].clash = true;
    pair[1].clash = true;
    b.moveClashes = [...b.moveClashes, { kind: 'move', me: [pair[0].from], foe: [pair[1].from], shots: [pair[0].id, pair[1].id], ms: 0, dur: TIMING.team.moveClashMs, taps: 0, winner: null }];
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
  if (auto) {
    const z = firstReady(b, 'me');
    if (z !== null) {
      startUlt(b, 'me', z, rng);
      return b;
    }
  }
  // 행동 게이지 — 차면 바로 (겹쳐도)
  for (const side of ['me', 'foe'] as const) {
    b[side].forEach((f, i) => {
      if (!alive(f)) return;
      f.gauge = Math.min(1, f.gauge + gaugeRate(b, f) * stepMs);
      if (f.gauge >= 1) act(b, side, i, rng);
    });
  }
  checkEnd(b);
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
const slots = (v: unknown, n: number) => Array.isArray(v) && v.every((i) => Number.isInteger(i) && i >= 0 && i < n);

function okFighter(f: unknown): boolean {
  return isObj(f) && typeof f.uid === 'string' && fin(f.species, 1, 2000) && fin(f.level, 1, 100) && fin(f.hp, 0) && fin(f.maxHp, 1) && fin(f.gauge, 0, 1) && fin(f.ult, 0, 1) && Array.isArray(f.moves) && Array.isArray(f.types) && isObj(f.stats);
}

export function readTeam(raw: unknown): TeamBattle | null {
  if (!isObj(raw) || (raw.kind !== 'trainer' && raw.kind !== 'gym') || typeof raw.foeName !== 'string') return null;
  if (!Array.isArray(raw.me) || !Array.isArray(raw.foe) || raw.me.length < 1 || raw.me.length > 3 || raw.foe.length < 1 || raw.foe.length > 3) return null;
  if (!raw.me.every(okFighter) || !raw.foe.every(okFighter)) return null;
  if (!['run', 'ult', 'clash', 'over'].includes(raw.phase as string)) return null;
  const nMe = raw.me.length;
  const nFoe = raw.foe.length;
  if (!Array.isArray(raw.shots) || !raw.shots.every((s) => isObj(s) && fin(s.id) && (s.side === 'me' || s.side === 'foe') && fin(s.from, 0, 2) && slots(s.targets, 3) && fin(s.moveId, 1) && fin(s.ms, 0) && fin(s.dur, 1) && fin(s.hitMs, 0))) return null;
  const okClash = (c: unknown) => isObj(c) && (c.kind === 'move' || c.kind === 'ult') && slots(c.me, nMe) && slots(c.foe, nFoe) && fin(c.ms, 0) && fin(c.dur, 1) && fin(c.taps, 0, 1000);
  if (!Array.isArray(raw.moveClashes) || !raw.moveClashes.every(okClash)) return null;
  if (!(raw.clash === null || okClash(raw.clash)) || (raw.phase === 'clash' && raw.clash === null)) return null;
  const u = raw.ult;
  if (!(u === null || (isObj(u) && (u.side === 'me' || u.side === 'foe') && fin(u.from, 0, 2) && fin(u.ms, 0) && fin(u.dur, 1) && fin(u.window, 0) && slots(u.joiners, 3)))) return null;
  if (raw.phase === 'ult' && u === null) return null;
  if (!Array.isArray(raw.foeUltWait) || !isObj(raw.ultReadyAt) || !Array.isArray(raw.popups) || !Array.isArray(raw.foeDown) || !Array.isArray(raw.fought)) return null;
  if (!fin(raw.overMs, 0) || !fin(raw.t, 0) || !fin(raw.seq, 0) || !fin(raw.popupSeq, 0) || typeof raw.msg !== 'string') return null;
  if (!(raw.result === null || raw.result === 'win' || raw.result === 'lose') || (raw.phase === 'over') !== (raw.result !== null)) return null;
  return raw as unknown as TeamBattle;
}

/** 다시 그리는 열쇠 — 한 걸음마다 바뀌는 것 (게이지 · HP · 날아가는 기술 · 힘겨루기) 을 모양 단위로 */
export function teamViewKey(b: TeamBattle): string {
  const f = (x: Fighter) => `${x.hp}:${Math.floor(x.gauge * 20)}:${Math.floor(x.ult * 20)}:${x.status?.kind ?? ''}`;
  return [b.phase, b.me.map(f).join(','), b.foe.map(f).join(','), b.shots.map((s) => `${s.id}:${s.clash}`).join(','), b.moveClashes.length, b.ult ? `${b.ult.side}${b.ult.from}:${b.ult.window > 0}` : '', b.clash ? `${b.clash.me.join('')}:${b.clash.foe.join('')}:${b.clash.taps}` : '', b.popupSeq, b.msg].join('|');
}
