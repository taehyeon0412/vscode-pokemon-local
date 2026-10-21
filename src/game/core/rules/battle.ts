/**
 * 전투 계산 (mvp-spec 3.3 · 4장 "전투") — 화면도 시간 흐름도 모르는 순수 계산. 흐름은 core/engine/battle.ts.
 * 피해 = ((2 × 레벨 / 5 + 2) × 위력 × 공격 / 방어 / 50 + 2) × 상성 × 자속 1.5 × 급소 1.5 × 무작위 0.85 ~ 1
 */
import { BALANCE, TIMING } from '../balance';
import type { Rng } from '../engine/rng';
import type { Monster, MoveSlot, StatusCondition, Stats } from '../save';
import { moveOf, speciesOf, type ReadonlyMove, type TypeName } from '../../data';
import { duelKind } from './duel';
import { starGrade, statsOf, statValue } from './stats';
import { effectiveness } from './types';

/** 전투에 나온 포켓몬 하나 (전투 중에만 — 끝나면 HP · PP · 상태 이상을 세이브에 돌려줌) */
export interface Fighter {
  /** 내 포켓몬 uid · 야생은 'wild' */
  uid: string;
  species: number;
  form: string;
  level: number;
  shiny: boolean;
  types: TypeName[];
  stats: Stats;
  maxHp: number;
  hp: number;
  moves: MoveSlot[];
  status: StatusCondition | null;
  /** 행동 게이지 0 ~ 1 */
  gauge: number;
  /** 필살기 게이지 0 ~ 1 */
  ult: number;
  /** 지금 걸린 방어 (받는 피해 배수, 1 = 없음) — 다음 내 행동까지 */
  guard: number;
  /** 연달아 방어한 횟수 (다른 행동을 하면 0) */
  guardStreak: number;
  /** 연달아 세지는 기술: 마지막으로 쓴 그 기술 · 연달아 쓴 횟수 (다른 행동 · 교체면 처음부터) */
  streakMove: number | null;
  streakCount: number;
  /** ★ 등급 (S21 프로필 — 상대도 보임, 좋은 개체를 골라 잡게) · 옛 상태에는 없을 수 있음 */
  star?: number;
}

export function fighterOf(m: Monster): Fighter {
  const s = speciesOf(m.species);
  const stats = s ? statsOf(s.base, m.ivs, m.points, m.level) : { hp: m.hp, attack: 10, defense: 10, speed: 10, ultimate: 10 };
  const maxHp = Math.floor(stats.hp);
  return {
    uid: m.uid,
    species: m.species,
    form: m.form,
    level: m.level,
    shiny: m.shiny,
    types: s ? [...s.types] : ['normal'],
    stats,
    maxHp,
    hp: Math.min(m.hp, maxHp),
    moves: m.moves.map((x) => ({ ...x })),
    status: m.status ? { ...m.status } : null,
    gauge: 0,
    // 매 전투 20% 에서 시작 (#22)
    ult: BALANCE.ultStart,
    guard: 1,
    guardStreak: 0,
    streakMove: null,
    streakCount: 0,
    star: starGrade(m.ivs),
  };
}

/** 행동 게이지가 차는 빠르기 (ms 당) — 느린 쪽이 2.5초에 한 번, 빠른 쪽은 스피드 비율대로 최대 2배. 마비면 절반 */
export function gaugeRate(self: Fighter, other: Fighter): number {
  const a = Math.max(1, self.stats.speed);
  const b = Math.max(1, other.stats.speed);
  const ratio = a >= b ? Math.min(BALANCE.maxSpeedRatio, a / b) : 1;
  const para = self.status?.kind === 'paralysis' ? BALANCE.paralysisGaugeScale : 1;
  return (ratio * para) / BALANCE.gaugeMs;
}

export interface DamageResult {
  damage: number;
  /** 상성 배수 */
  effect: number;
  crit: boolean;
}

/**
 * 피해 하나. power = 위력 (1 공격 30 · 기술 · 필살기 100), type = 공격 타입 (기본기는 null), useUlt = 공격 자리에 필살 스탯.
 * 화상이면 공격 · 기술 피해 절반 (필살기는 그대로)
 */
export function computeDamage(o: { attacker: Fighter; defender: Fighter; power: number; type: TypeName | null; useUlt?: boolean; rng: Rng }): DamageResult {
  const { attacker: a, defender: d } = o;
  const atk = o.useUlt ? a.stats.ultimate : a.stats.attack;
  const def = Math.max(1, d.stats.defense);
  const base = ((2 * a.level) / 5 + 2) * o.power * (atk / def) / 50 + 2;
  const effect = effectiveness(o.type, d.types);
  const stab = o.type && a.types.includes(o.type) ? BALANCE.stab : 1;
  const crit = o.rng.chance(BALANCE.critChance);
  const random = BALANCE.damageRandomMin + o.rng.next() * (1 - BALANCE.damageRandomMin);
  const burn = a.status?.kind === 'burn' && !o.useUlt ? BALANCE.burnAttackScale : 1;
  const raw = base * effect * stab * (crit ? BALANCE.critMultiplier : 1) * random * burn * d.guard;
  const damage = effect === 0 ? 0 : Math.max(1, Math.floor(raw));
  return { damage, effect, crit };
}

/** 타입 면역 (원작): 독 · 강철은 독 · 불꽃은 화상 · 전기는 마비가 안 걸림 */
const AILMENT_IMMUNE: Record<NonNullable<ReadonlyMove['ailment']>, readonly TypeName[]> = {
  poison: ['poison', 'steel'],
  burn: ['fire'],
  paralysis: ['electric'],
  sleep: [],
};

/** 상태 이상이 걸릴 수 있는지 — 기술 상성이 0 (효과 없음) 이거나 타입 면역이면 안 걸림 */
export function canInflict(ailment: NonNullable<ReadonlyMove['ailment']>, moveType: TypeName, defendTypes: readonly TypeName[]): boolean {
  if (effectiveness(moveType, defendTypes) === 0) return false;
  return !defendTypes.some((t) => AILMENT_IMMUNE[ailment].includes(t));
}

/** 연달아 세지는 기술의 위력 배수 — 연달아 쓴 횟수 (첫 번 0) × 10% */
export function streakMultiplier(previousCount: number): number {
  return 1 + BALANCE.streakStep * previousCount;
}

/** 방어 배수 — 연달아 쓸수록 줄어듦 (50% → 25% → 0%) */
export function guardFactor(streakBefore: number): number {
  const f = BALANCE.guardFactors;
  return f[Math.min(streakBefore, f.length - 1)]!;
}

/**
 * 필살기 게이지 오르는 양 — 때림 · 맞음 · 방어 중에 맞음 · 야생은 절반.
 * 필살 스탯이 높을수록 빨리 참 (mvp-spec 3.3): 같은 레벨에서 필살 종족값 40 · 120 인 포켓몬의 필살 스탯 사이 어디쯤인지로 × 0.8 ~ 1.2
 * — 레벨업 포인트를 필살에 넣으면 게이지도 빨라짐
 */
export function ultGain(kind: 'hit' | 'hurt', f: Fighter, opts: { guarded?: boolean; wild?: boolean } = {}): number {
  const [baseLo, baseHi] = BALANCE.ultGainStatRange;
  const lo = statValue('ultimate', baseLo, 0, f.level, 0);
  const hi = statValue('ultimate', baseHi, 0, f.level, 0);
  const [fLo, fHi] = BALANCE.ultGainFactorRange;
  const k = Math.min(1, Math.max(0, (f.stats.ultimate - lo) / Math.max(1, hi - lo)));
  const factor = fLo + (fHi - fLo) * k;
  const base = kind === 'hit' ? BALANCE.ultGainHit : BALANCE.ultGainHurt + (opts.guarded ? BALANCE.ultGainGuardBonus : 0);
  return base * factor * (opts.wild ? BALANCE.ultGainWildScale : 1);
}

/** 땅을 흔드는 · 소리 · 자기 둘레 기술은 쏘는 기술이 아님 (몸이 닿지 않아도) — 맞받아치기 · 힘대결은 쏘는 기술끼리 */
const NOT_SHOOTING = new Set([
  'earthquake', 'magnitude', 'bulldoze', 'stomping-tantrum',
  'hyper-voice', 'echoed-voice', 'round', 'boomburst', 'snarl', 'bug-buzz', 'disarming-voice', 'chatter',
  'discharge', 'lava-plume', 'heat-wave', 'petal-blizzard', 'hurricane',
]);

/** 쏘는 기술 (광선 · 불꽃 · 물 · 구체 등) — 몸이 닿지 않는 피해 기술 중 위 목록 빼고 */
/** 패링 등급 — perfect = 완벽 (피해 0) · good = 막음 (피해 절반) · early = 너무 일찍 (이번 공격은 못 막음) · late = 늦음 */
export type ParryGrade = 'perfect' | 'good' | 'early' | 'late';

/** 맞기까지 남은 ms (음수 = 맞은 뒤) 로 등급 (2026-10-19 태현 님 "날아오는 타이밍에 Space — 패링처럼") */
export function parryGrade(msBeforeHit: number): ParryGrade {
  if (msBeforeHit > TIMING.parryEarlyMs) return 'early';
  if (msBeforeHit < -TIMING.parryLateMs) return 'late';
  if (msBeforeHit <= TIMING.parryPerfectEarlyMs && msBeforeHit >= -TIMING.parryPerfectLateMs) return 'perfect';
  return 'good';
}

export function isShooting(move: ReadonlyMove | undefined): boolean {
  return !!move && move.class !== 'status' && move.power > 0 && !move.contact && !NOT_SHOOTING.has(move.key);
}

/** 쓸 수 있는 기술 (PP 남음) */
export function usableMoves(f: Fighter): { slot: MoveSlot; move: ReadonlyMove }[] {
  const out: { slot: MoveSlot; move: ReadonlyMove }[] = [];
  for (const slot of f.moves) {
    const move = moveOf(slot.moveId);
    if (move && slot.pp > 0) out.push({ slot, move });
  }
  return out;
}

/**
 * 맞받아칠 때 나가는 기술 (mvp-spec 3.3 "상대와 같은 종류 먼저, 없으면 가장 센 것") —
 * 종류 = 짝짓기 표의 모양 (광선 · 구체 · 번개 …, gdd 4.7 예시가 모양) → 없으면 같은 타입 → 그것도 없으면 가장 센 쏘는 기술 [제안]
 */
export function counterMove(f: Fighter, incoming: ReadonlyMove): ReadonlyMove | null {
  const shooting = usableMoves(f).map((x) => x.move).filter(isShooting);
  if (shooting.length === 0) return null;
  const kind = duelKind(incoming.id);
  const sameKind = shooting.filter((m) => duelKind(m.id) === kind);
  const sameType = shooting.filter((m) => m.type === incoming.type);
  const pool = sameKind.length > 0 ? sameKind : sameType.length > 0 ? sameType : shooting;
  return pool.reduce((best, m) => (m.power > best.power ? m : best));
}

/**
 * 힘대결에서 내가 이길 기본 확률 — 센 쪽 50 ~ 80% (비슷하면 50, 차이가 50% 이상이면 80).
 * 기술끼리 = 공격 × 위력, 필살기끼리 = 필살 스탯
 */
export function clashChance(myPower: number, foePower: number): number {
  const big = Math.max(myPower, foePower, 1e-9);
  const small = Math.max(Math.min(myPower, foePower), 1e-9);
  const k = Math.min(1, (big / small - 1) / BALANCE.clashRatioFull);
  const strong = BALANCE.clashMin + (BALANCE.clashMax - BALANCE.clashMin) * k;
  return myPower >= foePower ? strong : 1 - strong;
}

/** 연타를 더한 최종 확률 (최대 +20%p · 합쳐서 95%) */
export function clashWithTaps(base: number, taps: number): number {
  return Math.min(BALANCE.clashCap, base + Math.min(BALANCE.clashTapMax, taps * BALANCE.clashTap));
}

/** 도망 확률 — 50% + (내 스피드 − 상대) / 상대 × 50%, 10 ~ 95%, 실패할 때마다 +10%p */
export function fleeChance(mySpeed: number, foeSpeed: number, tries: number): number {
  const base = BALANCE.fleeBase + ((mySpeed - foeSpeed) / Math.max(1, foeSpeed)) * 0.5 + BALANCE.fleeStep * tries;
  return Math.min(BALANCE.fleeRange[1], Math.max(BALANCE.fleeRange[0], base));
}

export type AiStyle = 'wild' | 'smart';

/** 상대 · 자동 전투가 고르는 것 — 공격 또는 기술 (볼 · 아이템 · 도망은 안 씀) */
export type AiPick = { kind: 'attack' } | { kind: 'move'; moveId: number };

/**
 * AI (mvp-spec 3.3 [제안]): 야생 = 공격 30% · 기술 70% 무작위 / 트레이너 · 자동 전투 = 효과가 굉장한 기술 > 같은 타입 > 위력 순으로 무게를 둔 무작위.
 * 쓸 수 있는 기술이 없으면 공격
 */
export function aiPick(self: Fighter, target: Fighter, style: AiStyle, rng: Rng): AiPick {
  const usable = usableMoves(self).filter((x) => x.move.class !== 'status' || target.status === null);
  if (usable.length === 0) return { kind: 'attack' };
  if (style === 'wild') {
    if (rng.chance(BALANCE.wildAttackChance)) return { kind: 'attack' };
    return { kind: 'move', moveId: usable[rng.int(0, usable.length - 1)]!.move.id };
  }
  const weights = usable.map(({ move }) => {
    if (move.class === 'status') return 1;
    const eff = effectiveness(move.type, target.types);
    const stab = self.types.includes(move.type) ? 1.5 : 1;
    return Math.max(0.1, (move.power / 40) * eff * eff * stab);
  });
  const attackWeight = (BALANCE.attackPower / 40) * 0.5;
  const total = weights.reduce((a, b) => a + b, attackWeight);
  let r = rng.next() * total;
  for (let i = 0; i < usable.length; i++) {
    r -= weights[i]!;
    if (r < 0) return { kind: 'move', moveId: usable[i]!.move.id };
  }
  return { kind: 'attack' };
}

/** 쓰러졌을 때 자동으로 고르는 다음 포켓몬 = 상대 타입에 대한 내 기술 배율이 가장 큰 포켓몬, 같으면 레벨이 높은 쪽 (mvp-spec 3.3 [제안]) */
export function bestNext(candidates: readonly Monster[], foeTypes: readonly TypeName[]): Monster | null {
  let best: Monster | null = null;
  let bestScore = -1;
  for (const m of candidates) {
    if (m.hp <= 0) continue;
    const score = Math.max(1, ...m.moves.map((x) => moveOf(x.moveId)).filter((mv): mv is ReadonlyMove => !!mv && mv.class !== 'status').map((mv) => effectiveness(mv.type, foeTypes)));
    if (score > bestScore || (score === bestScore && best && m.level > best.level)) {
      best = m;
      bestScore = score;
    }
  }
  return best;
}

