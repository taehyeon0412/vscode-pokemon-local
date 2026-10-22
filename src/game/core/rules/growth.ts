/**
 * 경험치 · 레벨업 · 포인트 · 새 기술 · 진화 (mvp-spec 3.5 · 3.6 · S12 · S22 · S23 · 4장 "경험치 · 성장") — 화면을 모르는 계산.
 * 포켓몬은 늘 새 객체로 돌려줌 (받은 것은 고치지 않음).
 */
import { BALANCE } from '../balance';
import type { Rng } from '../engine/rng';
import { STAT_KEYS, type Monster, type MoveSlot, type PendingChoice, type StatKey } from '../save';
import { evolutionsOf, formsOfSpecies, learnsetOf, moveOf, signatureOf, speciesOf, type ReadonlyEvolution, type ReadonlyMove } from '../../data';
import { gameBase, levelForExp, maxHp } from './stats';

/**
 * 경험치 한 번 (4장): 상대 기본 경험치 × 상대 레벨 / 7 · 트레이너 × 1.5 · 팀 나머지 × 0.5 · 상대가 5레벨 이상 낮으면 × 0.5.
 * cap = 그 스테이지 레벨대 위끝 — 방치 경험치 초안을 켜면 (BALANCE.draft52.idleExp) 상대 레벨 대신 이것과 견줌 (gdd 5.2 · orders #69)
 */
export function expGain(foe: { species: number; level: number }, receiverLevel: number, opts: { trainer?: boolean; share?: boolean; cap?: number } = {}): number {
  const base = ((speciesOf(foe.species)?.baseExp ?? 50) * foe.level) / BALANCE.expDivisor;
  let g = base * (opts.trainer ? BALANCE.expTrainerScale : 1) * (opts.share ? BALANCE.expShareScale : 1);
  if (BALANCE.draft52.idleExp && opts.cap !== undefined) g *= idleExpScale(receiverLevel, opts.cap);
  else if (foe.level <= receiverLevel - BALANCE.expLowGap) g *= BALANCE.expLowScale;
  return Math.max(1, Math.floor(g));
}

/** 방치 경험치 배율 — 그 스테이지 위끝 (cap) 보다 +5 ×0.5 · +8 ×0.25 · +12 ×0.1 (gdd 5.2 초안 — 켜졌을 때만 씀) */
export function idleExpScale(level: number, cap: number): number {
  const over = level - cap;
  return BALANCE.draft52.idleExpSteps.find(([gap]) => over >= gap)?.[1] ?? 1;
}

function maxHpOf(m: Monster): number {
  const s = speciesOf(m.species);
  return s ? maxHp(s.base, m.ivs, m.points, m.level) : m.hp;
}

/** 레벨업 자동 포인트 하나 — 종족값이 높은 스탯일수록 잘 뽑힘 (mvp-spec 3.5) */
function autoPoint(m: Monster, rng: Rng): StatKey {
  const s = speciesOf(m.species);
  const base = s ? gameBase(s.base) : null;
  const weights = STAT_KEYS.map((k) => Math.max(1, base ? base[k] : 1));
  let r = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < STAT_KEYS.length; i++) {
    r -= weights[i]!;
    if (r < 0) return STAT_KEYS[i]!;
  }
  return STAT_KEYS[STAT_KEYS.length - 1]!;
}

/**
 * 경험치를 더하고 레벨업 — 레벨마다 포인트 자동 2 + 고르는 2 (쌓아 둠, S18) · 최대 HP 가 는 만큼 지금 HP 도 (원작처럼, 쓰러진 포켓몬은 그대로)
 */
export function addExp(m0: Monster, gain: number, rng: Rng): Monster {
  const oldMax = maxHpOf(m0);
  const exp = m0.exp + Math.max(0, Math.floor(gain));
  const level = Math.max(m0.level, levelForExp(exp));
  const m: Monster = { ...m0, exp, level, points: { ...m0.points } };
  for (let l = m0.level; l < level; l++) {
    for (let i = 0; i < BALANCE.pointsAutoPerLevel; i++) m.points[autoPoint(m, rng)] += 1;
    m.unspentPoints += BALANCE.pointsFreePerLevel;
  }
  const newMax = maxHpOf(m);
  m.hp = m0.hp > 0 ? Math.min(newMax, Math.max(1, m0.hp + (newMax - oldMax))) : 0;
  return m;
}

/** 그 레벨에 레벨업으로 배우는 기술 (레벨 0 = 진화 기술은 빼고) */
export function movesLearnedAt(dex: number, level: number): ReadonlyMove[] {
  const out: ReadonlyMove[] = [];
  for (const [lv, id] of learnsetOf(dex)) {
    const mv = lv === level && lv >= 1 ? moveOf(id) : undefined;
    if (mv && !out.some((x) => x.id === mv.id)) out.push(mv);
  }
  return out;
}

const full = (mv: ReadonlyMove): MoveSlot => ({ moveId: mv.id, pp: mv.pp });

/** 그림 이름의 갈래 꼬리 (_female · _plant …) — 진화해도 같은 꼬리가 있으면 그 모습으로 */
function formTail(form: string, dex: number): string | null {
  const base = formsOfSpecies(dex)[0];
  if (base && form !== base && form.startsWith(`${base}_`)) return form.slice(base.length + 1);
  const i = form.lastIndexOf('_');
  return i > 0 ? form.slice(i + 1) : null;
}

/** 진화한 모습의 그림 이름 — 같은 갈래 꼬리 (암컷 · 도롱이 모양) 가 있으면 그것, 없으면 기본 모습 */
export function evolvedForm(fromForm: string, fromDex: number, to: number): string {
  const forms = formsOfSpecies(to);
  const tail = formTail(fromForm, fromDex);
  if (tail) {
    const match = forms.find((f) => f.endsWith(`_${tail}`));
    if (match) return match;
  }
  return forms[0] ?? fromForm;
}

/** 그 종으로 진화해 온 레벨 (앞 진화) — 특수 조건 진화의 기준 */
function previousEvolutionLevel(dex: number): number | null {
  const from = speciesOf(dex)?.evolvesFrom;
  if (!from) return null;
  const e = evolutionsOf(from).find((x) => x.to === dex);
  if (!e) return null;
  if (e.level) return e.level;
  if (e.kind === 'friendship') return BALANCE.friendshipLevel;
  return null;
}

/**
 * 이 진화가 레벨업으로 되는 레벨 (mvp-spec 3.6) — 돌 · 교환 (아이템, 단계 8) · 밤 (MVP 는 늘 낮) 이면 null.
 * 레벨이 있으면 그 레벨 · 친밀도 = Lv 20 · "이 기술을 알면" = 그 기술을 배우는 레벨 · 그 밖 (장소 · 지닌 도구 …) = 앞 진화 레벨 + 10 (없으면 Lv 30) [제안]
 */
export function evolutionLevel(m: Monster, e: ReadonlyEvolution): number | null {
  if (e.kind === 'item' || e.kind === 'trade') return null;
  if (e.time === 'night') return null;
  if (formsOfSpecies(e.to).length === 0) return null;
  // 성별 갈래: 그림이 암컷 · 수컷이면 맞는 쪽만 (세꿀버리 → 비퀸은 combee_female), 성별 없는 그림은 무작위 반반 (pickEvolution)
  if (e.gender && (m.form.endsWith('_female') || m.form.endsWith('_male')) && !m.form.endsWith(`_${e.gender}`)) return null;
  if (e.level) return e.level;
  if (e.kind === 'friendship') return BALANCE.friendshipLevel;
  if (e.knownMove) {
    const learned = learnsetOf(m.species).find(([, id]) => id === e.knownMove);
    if (learned && learned[0] >= 1) return learned[0];
  }
  const prev = previousEvolutionLevel(m.species);
  return prev !== null ? prev + BALANCE.otherEvolutionGap : BALANCE.otherEvolutionDefault;
}

/** 그 레벨에서 할 수 있는 진화 하나 (갈래는 확률 · 없으면 반반) — 없으면 null */
export function pickEvolution(m: Monster, level: number, rng: Rng): number | null {
  const options = evolutionsOf(m.species).filter((e) => {
    const at = evolutionLevel(m, e);
    return at !== null && at <= level;
  });
  if (options.length === 0) return null;
  const weight = (e: ReadonlyEvolution) => e.chance ?? 100 / options.length;
  let r = rng.next() * options.reduce((a, e) => a + weight(e), 0);
  for (const e of options) {
    r -= weight(e);
    if (r < 0) return e.to;
  }
  return options[options.length - 1]!.to;
}

/**
 * 진화할 때 새 기술 (최대 2개, mvp-spec S22): 진화한 포켓몬의 대표 기술 → 진화할 때 배우는 기술 (레벨 0) → 지금 레벨 + 5 까지 배우는 기술 중 센 것.
 * 이미 아는 기술 · 변화 기술은 건너뜀
 */
export function evolutionMoves(m: Monster, to: number): number[] {
  const known = new Set(m.moves.map((s) => s.moveId));
  const out: number[] = [];
  const take = (id: number) => {
    const mv = moveOf(id);
    if (!mv || mv.class === 'status' || mv.power <= 0 || known.has(id) || out.includes(id)) return;
    if (out.length < BALANCE.evolutionNewMoves) out.push(id);
  };
  for (const id of signatureOf(to)) take(id);
  for (const [lv, id] of learnsetOf(to)) if (lv === 0) take(id);
  const near = learnsetOf(to)
    .filter(([lv]) => lv >= 1 && lv <= m.level + BALANCE.evolutionMoveReach)
    .map(([, id]) => moveOf(id))
    .filter((mv): mv is ReadonlyMove => !!mv)
    .sort((a, b) => b.power - a.power);
  for (const mv of near) take(mv.id);
  return out;
}

/**
 * 레벨이 오른 만큼 새 기술 · 진화 (mvp-spec S12 처리 순서): 레벨마다 그 레벨의 새 기술 — 빈칸이 있으면 바로, 4칸이면 고르기 (S23) →
 * 진화 조건이 맞으면 진화 고르기 (S22) 를 남기고 멈춤 (그 뒤 레벨은 진화한 · 안 한 모습으로 고를 때 다시 — continueAfterEvolve)
 */
export function levelUpChoices(
  m0: Monster,
  fromLevel: number,
  toLevel: number,
  rng: Rng,
  /** 진화를 묻지 않음 — 방금 진화를 멈췄으면 같은 결과 안에서는 다시 안 물음 (다음 레벨업 때 다시, mvp-spec S22) */
  opts: { noEvolve?: boolean } = {},
): { monster: Monster; learned: number[]; choices: PendingChoice[] } {
  const m: Monster = { ...m0, moves: m0.moves.map((s) => ({ ...s })) };
  const learned: number[] = [];
  const choices: PendingChoice[] = [];
  for (let level = fromLevel + 1; level <= toLevel; level++) {
    for (const mv of movesLearnedAt(m.species, level)) {
      if (m.moves.some((s) => s.moveId === mv.id) || choices.some((c) => c.kind === 'learn' && c.moveId === mv.id)) continue;
      if (m.moves.length < BALANCE.moveSlots) {
        m.moves.push(full(mv));
        learned.push(mv.id);
      } else {
        choices.push({ kind: 'learn', uid: m.uid, moveId: mv.id });
      }
    }
    const to = opts.noEvolve ? null : pickEvolution(m, level, rng);
    if (to !== null) {
      choices.push({ kind: 'evolve', uid: m.uid, to, newMoves: evolutionMoves(m, to), level, item: null });
      break;
    }
  }
  return { monster: m, learned, choices };
}

/** S23 — 새 기술을 replace 번째 칸에 (null = 배우지 않기) */
export function learnMove(m: Monster, moveId: number, replace: number | null): Monster {
  const mv = moveOf(moveId);
  if (!mv || m.moves.some((s) => s.moveId === moveId)) return m;
  if (m.moves.length < BALANCE.moveSlots) return { ...m, moves: [...m.moves, full(mv)] };
  if (replace === null || replace < 0 || replace >= m.moves.length) return m;
  return { ...m, moves: m.moves.map((s, i) => (i === replace ? full(mv) : { ...s })) };
}

/** S22 — 남길 수 있는 지금 기술 수 (지금 2개 이하면 다 · 새 기술이 모자라면 그만큼 더) */
export function keepCount(m: Monster, newMoves: readonly number[]): number {
  const fresh = newMoves.filter((id) => !m.moves.some((s) => s.moveId === id)).length;
  return Math.min(m.moves.length, BALANCE.moveSlots - fresh);
}

/** S22 — 진화: 종 · 그림 · 기술 (남길 것 + 새 것) · HP (최대 HP 가 는 만큼) */
export function evolve(m: Monster, to: number, newMoves: readonly number[], keep: readonly number[]): Monster {
  const n = keepCount(m, newMoves);
  const kept = m.moves.filter((s) => keep.includes(s.moveId)).slice(0, n);
  // 남길 것을 덜 골랐으면 앞에서부터 채움 (자동 · 잘못된 입력)
  for (const s of m.moves) if (kept.length < n && !kept.includes(s)) kept.push(s);
  // 새 기술은 "지금 기술에 없는 것" (keepCount · 화면과 같은 기준 — 남기지 않은 지금 기술과 겹치면 그 기술은 새 기술로 안 셈)
  const fresh = newMoves
    .filter((id) => !m.moves.some((s) => s.moveId === id))
    .map((id) => moveOf(id))
    .filter((mv): mv is ReadonlyMove => !!mv)
    .map(full);
  const oldMax = maxHpOf(m);
  const next: Monster = { ...m, species: to, form: evolvedForm(m.form, m.species, to), moves: [...kept.map((s) => ({ ...s })), ...fresh].slice(0, BALANCE.moveSlots) };
  const newMax = maxHpOf(next);
  next.hp = m.hp > 0 ? Math.min(newMax, Math.max(1, m.hp + (newMax - oldMax))) : 0;
  return next;
}

