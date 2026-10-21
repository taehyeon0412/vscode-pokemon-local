/**
 * 3:3 연출 다리 (2026-10-21 orders #17 준비) — 엔진 기록 (TeamBattle.log) 을 연출 부르기 목록으로 (계획 · 화면 없이 시험) → 일반 모드 연출 (fx/bridge) 로 (실행).
 * 6마리가 겹쳐 쏘는 3:3 은 엔진이 연출을 기다리지 않음 (실시간) — 연출은 기록을 따라 그림만. 모양 (발밑 판 · 자리 · 크기) 은 디자인팀, 화면은 actor() 로 그림 요소만 넘김.
 * 태현 님 (기획 전달): 타격감 · 필살기 화려함은 일반 모드 · 1:1 보다 낫게 — 맞은 포켓몬만 짧게 멈춤 · 반 칸 밀림 · 타입 임팩트 · 마지막 한 방은 크게 + 짧게 느리게 ·
 * 합동 · 3:1 은 따로 마무리 · 기술 번쩍임은 끄고 필살기만 (1초 3번 이하) · 같은 연출 돌려쓰기 · 빠른 떨림 · 깜빡임 금지
 */
import { BALANCE, TIMING } from '../../../core/balance';
import type { Side, TeamBattle, TeamLogEntry } from '../../../core/engine';
import { shotTiming } from '../../../core/engine/team';
import { clashChance, clashWithTaps } from '../../../core/rules/battle';
import { moveOf } from '../../../data';
import { pokemonFx, type FxActor, type FxImpact, type FxMove, type PokemonFx } from './bridge';
import { FX_HOLD_ULT_MAX_MS, holdFx, releaseFx, teamUltKey } from './hold';
import { shotHitAt } from './shot-hit';
// 개발 모드 (임시) 에서 고른 필살기
import { devUltOf } from '../../../dev/ult-pick';

export interface TeamSlot {
  side: Side;
  slot: number;
}

/** 연출 하나 — 실행 (TeamFxRunner) 이 일반 모드 연출로 옮김 */
export type TeamFxCall =
  /** 쏘는 기술 — tag = 기술 번호 (힘겨루기 · 쏜 포켓몬이 쓰러지면 그 기술만 멈춤) · hitMs = 엔진이 맞히는 때 (연출이 닿는 때를 여기에 맞춰 늦게 시작) */
  | { do: 'move'; tag: number; src: TeamSlot; dst: TeamSlot; move: FxMove; hitMs: number }
  /** 닿는 기술 (1 공격 포함) — 상대 앞까지 달려가 박치기 → 제자리 (엔진 박자 shotTiming) */
  | { do: 'dash'; tag: number; src: TeamSlot; dst: TeamSlot; moveId: number }
  /** 닿는 기술이 맞는 순간 — 맞는 쪽 몸에 그 기술 자국 (1:1 과 같음, 쓰는 쪽 모양) */
  | { do: 'strike'; dst: TeamSlot; src: TeamSlot; move: FxMove }
  | { do: 'stop'; tag: number }
  /** 맞음 — 타입 임팩트 · 맞은 포켓몬만 멈춤 + 밀림 (cells = 칸 수, 반 칸 = 0.5) */
  | { do: 'impact'; dst: TeamSlot; type: string; big: boolean; name: string; o: FxImpact; delayMs?: number }
  | { do: 'knock'; dst: TeamSlot; cells: number; ms: number }
  | { do: 'dodge'; dst: TeamSlot }
  | { do: 'ko'; dst: TeamSlot }
  /** 마지막 한 방 — 크게 · 짧게 느리게 */
  | { do: 'final'; dst: TeamSlot }
  | { do: 'status'; dst: TeamSlot; kind: 'poison' | 'burn' | 'paralysis' | 'sleep' }
  | { do: 'ready'; dst: TeamSlot }
  /** 필살기 (일반 모드 그대로 — 변신 · 전용 연출) — dst = 가운데 상대 (모두를 침) · quick = 짧게 (TEAM_FX.quickRepeat) · key = 엔진 붙잡기 열쇠 (맞는 순간까지) */
  | { do: 'ult'; src: TeamSlot; dst: TeamSlot; quick: boolean; key: string; others: TeamSlot[]; type: string }
  /** 합동 필살기 마무리 — 이긴 참가자 필살기가 같은 때 닿아 한 점에서 합쳐 터짐 (ult/bridge.js ultJoint) · sure = 3:1 압도 */
  | { do: 'joint'; winners: TeamSlot[]; dst: TeamSlot; types: string[]; sure: boolean; key: string; others: TeamSlot[] }
  /** 필살기 힘겨루기 — 앞장 (첫 참가자) 끼리 대결 · 합류는 join */
  | { do: 'ult-clash'; me: number[]; foe: number[] }
  | { do: 'ult-join'; who: TeamSlot }
  /** joint = 이긴 쪽이 여럿 (합쳐지는 마무리) · sure = 3:1 (압도하는 마무리) */
  | { do: 'ult-clash-end'; winner: Side; joint: boolean; sure: boolean }
  /** 기술 힘겨루기 — 두 기술이 멈추고 (stop) 둘 사이에서 겨룸 */
  | { do: 'clash'; me: number; foe: number }
  | { do: 'end' };

/** 맞은 포켓몬 멈춤 + 밀림 — 보통 · 마지막 한 방 [제안] */
export const TEAM_KNOCK = { cells: 0.5, ms: 140, finalCells: 1, finalMs: 260 };
/** 3:3 연출 값 — quickRepeat = 같은 포켓몬 두 번째 필살기부터 짧게 (태현 님 "필살기 연출은 그대로" — 끔, 기획 #88 답 대기) · 닿는 기술 임팩트를 자국보다 늦게 (1:1 과 같음) */
export const TEAM_FX = { quickRepeat: false, contactImpactLagMs: 90 };
const TIMING_STRIKE_HIT_MS = TIMING.team.strikeHitMs;
const TIMING_BACK_MS = TIMING.team.backMs;
/** 이만큼 지난 일은 그리지 않음 — 패널을 접었다 펴거나 다른 탭에서 돌아왔을 때 지난 필살기 · 쓰러짐을 한 번에 몰아 그리지 않게 (코드 리뷰어) */
export const TEAM_FX_LATE_MS = 600;

const other = (s: Side): Side => (s === 'me' ? 'foe' : 'me');
const fxMoveOf = (moveId: number): FxMove | null => {
  const mv = moveOf(moveId);
  return mv ? { name: mv.name.ko, type: mv.type } : null;
};

/** 필살기를 맞을 상대 — 살아 있는 상대 가운데 (셋이면 둘째) */
function ultTarget(b: TeamBattle, side: Side): TeamSlot {
  const foes = b[other(side)].map((f, i) => (f.hp > 0 ? i : -1)).filter((i) => i >= 0);
  return { side: other(side), slot: foes[Math.floor((foes.length - 1) / 2)] ?? 0 };
}

/**
 * 계획 — after 번호 뒤 기록을 연출 목록으로. seen = 이 판에서 필살기를 쓴 포켓몬 (`side:slot`, 두 번째부터 짧게 — 계획이 채움).
 * TEAM_FX_LATE_MS 보다 지난 일은 그리지 않음 (필살기를 본 것으로는 셈). 처음 · 새 판은 부르는 쪽이 after = logSeq 로 시작
 */
export function planTeamFx(b: TeamBattle, after: number, seen: Set<string>): TeamFxCall[] {
  const news = b.log.filter((e) => e.id > after);
  for (const e of news) if (e.t === 'ult' && b.t - e.at > TEAM_FX_LATE_MS) seen.add(`${e.side}:${e.from}`);
  const fresh = news.filter((e) => b.t - e.at <= TEAM_FX_LATE_MS);
  const out: TeamFxCall[] = [];
  // 마무리 한 방 = 같은 묶음에 끝이 있으면 그 앞 마지막 ko
  const endAt = fresh.findIndex((e) => e.t === 'end');
  const finalId = endAt >= 0 ? [...fresh.slice(0, endAt)].reverse().find((e) => e.t === 'hit' && e.ko)?.id : undefined;
  for (const e of fresh) planOne(b, e, e.id === finalId, seen, out);
  return out;
}

function planOne(b: TeamBattle, e: TeamLogEntry, final: boolean, seen: Set<string>, out: TeamFxCall[]): void {
  switch (e.t) {
    case 'shoot': {
      const src = { side: e.side, slot: e.from };
      const dst = { side: other(e.side), slot: e.targets[Math.floor((e.targets.length - 1) / 2)]! };
      // 닿는 기술 (1 공격 포함) = 달려가 박치기 (자국 · 임팩트는 맞을 때) · 쏘는 기술 = 그 기술 연출 그대로
      if (e.contact) {
        out.push({ do: 'dash', tag: e.shot, src, dst, moveId: e.moveId });
        return;
      }
      const m = fxMoveOf(e.moveId);
      if (m) out.push({ do: 'move', tag: e.shot, src, dst, move: m, hitMs: e.hitMs });
      return;
    }
    case 'hit': {
      const dst = { side: other(e.side), slot: e.to };
      const m = e.ult ? null : fxMoveOf(e.moveId);
      const type = e.ult ? (b[e.side][e.from]?.types[0] ?? 'normal') : (m?.type ?? 'normal');
      const big = e.ult || e.effect === 'super' || e.effect === 'crit' || final;
      const o: FxImpact = e.effect === 'immune' ? { none: true } : { scale: final ? 1.4 : e.effect === 'super' ? 1.25 : e.effect === 'weak' ? 0.75 : 1, ...(e.moveId === 0 ? { basic: true } : {}) };
      const contact = !e.ult && shotTiming(e.moveId).contact;
      if (contact && m) out.push({ do: 'strike', dst, src: { side: e.side, slot: e.from }, move: m });
      // 필살기가 직접 맞힌 상대 (가운데) 는 필살기 연출이 맞은 모양을 그림 — 큰 임팩트가 두 번 겹치지 않게 (코드 리뷰어)
      const ultDrawn = e.ult && dst.slot === ultTarget(b, e.side).slot;
      if (!ultDrawn) out.push({ do: 'impact', dst, type, big, name: m?.name ?? '필살기', o, ...(contact && m ? { delayMs: TEAM_FX.contactImpactLagMs } : {}) });
      if (e.effect !== 'immune' && e.dmg > 0) out.push({ do: 'knock', dst, cells: final ? TEAM_KNOCK.finalCells : TEAM_KNOCK.cells, ms: final ? TEAM_KNOCK.finalMs : TEAM_KNOCK.ms });
      if (final) out.push({ do: 'final', dst });
      else if (e.ko) out.push({ do: 'ko', dst });
      return;
    }
    case 'miss':
      out.push({ do: 'dodge', dst: { side: other(e.side), slot: e.to } });
      return;
    case 'stop':
      out.push({ do: 'stop', tag: e.shot });
      return;
    case 'clash':
      out.push({ do: 'stop', tag: e.shots[0] }, { do: 'stop', tag: e.shots[1] }, { do: 'clash', me: e.me, foe: e.foe });
      return;
    case 'clash-end':
      // 진 기술 쪽 피해는 뒤따르는 hit 이 그림
      return;
    case 'ult': {
      if (e.joint) {
        const j = e.joint;
        // 한 점 = 진 쪽 가운데 · 나머지 상대에게는 퍼지는 충격 (범위 필살기 — 기획 제안)
        const mid = j.losers[Math.floor((j.losers.length - 1) / 2)]!;
        out.push({ do: 'joint', winners: j.winners.map((slot) => ({ side: e.side, slot })), dst: { side: other(e.side), slot: mid }, others: j.losers.filter((x) => x !== mid).map((slot) => ({ side: other(e.side), slot })), types: j.winners.map((w) => b[e.side][w]?.types[0] ?? 'normal'), sure: j.sure, key: teamUltKey(e.at) });
        return;
      }
      const key = `${e.side}:${e.from}`;
      // 필살기 = 상대 모두 — 자기 둘레 필살기의 기운 줄기가 나머지 상대에게도 (태현 님 #92)
      const dst = ultTarget(b, e.side);
      const others = b[other(e.side)].map((f, i) => (f.hp > 0 && i !== dst.slot ? i : -1)).filter((i) => i >= 0).map((slot) => ({ side: other(e.side), slot }));
      out.push({ do: 'ult', src: { side: e.side, slot: e.from }, dst, quick: TEAM_FX.quickRepeat && seen.has(key), key: teamUltKey(e.at), others, type: b[e.side][e.from]?.types[0] ?? 'normal' });
      seen.add(key);
      return;
    }
    case 'ult-clash':
      out.push({ do: 'ult-clash', me: [...e.me], foe: [...e.foe] });
      return;
    case 'ult-join':
      out.push({ do: 'ult-join', who: { side: e.side, slot: e.slot } });
      return;
    case 'gather':
      // 합동 필살기 멘트 — 쓴 포켓몬 둘레 반짝 (멘트 모양은 화면 · 디자인팀, 필살기 연출은 멘트가 끝난 뒤 ult 에서)
      out.push({ do: 'ult-join', who: { side: e.side, slot: e.from } });
      return;
    case 'ult-clash-end':
      out.push({ do: 'ult-clash-end', winner: e.winner, joint: e[e.winner].length > 1, sure: e.sure });
      return;
    case 'faint':
      // 쓰러짐 연출은 그 한 방 (hit.ko) 이 그림 — 독 · 반동으로 쓰러지면 여기서
      if (!b.log.some((x) => x.id < e.id && x.id >= e.id - 3 && x.t === 'hit' && x.ko && x.side === other(e.side) && x.to === e.slot)) out.push({ do: 'ko', dst: { side: e.side, slot: e.slot } });
      return;
    case 'status':
      out.push({ do: 'status', dst: { side: e.side, slot: e.slot }, kind: e.kind });
      return;
    case 'ready':
      out.push({ do: 'ready', dst: { side: e.side, slot: e.slot } });
      return;
    case 'end':
      out.push({ do: 'end' });
      return;
  }
}

/** 화면이 넘기는 것 — 칸마다 그림 요소 (없으면 그 연출은 건너뜀) · 연출 층 (없으면 맨 위) */
export interface TeamFxStage {
  actor(who: TeamSlot): FxActor | null;
  layer?(): HTMLElement | null;
}

/**
 * 실행 — 상태가 바뀔 때마다 update(b), 화면이 사라질 때 (useEffect 정리 · 판 끝 · 웹뷰가 새 상태를 받음) reset().
 * 처음 · 새 판 · 기록이 빠짐 (사이에 32개 넘게) 이면 지난 기록은 그리지 않음 · 0.6초 넘게 지난 일도 안 그림 (planTeamFx).
 * 3:3 모드는 update 마다 다시 켬 (연출 쪽이 1.5초 뒤 저절로 끔 — reset 이 빠져도 1:1 연출이 3:3 모드로 남지 않게).
 * 안 볼 때 (패널 접힘 · 확장 계산) 는 부르지 않음. VS Code 창 밖 (fxAway) 은 연출 쪽이 짧게 (ideas #113)
 */
export class TeamFxRunner {
  private seq = -1;
  private seen = new Set<string>();
  private last: TeamBattle | null = null;
  /** 늦게 시작할 기술 (번호 → 타이머 — 그새 멈추면 안 씀) · 그 밖의 늦은 연출 타이머 */
  private pending = new Map<number, number>();
  private timers = new Set<number>();
  /** 달려가는 몸짓 (기술 번호 → 몸짓 · 그 그림) — 쏜 포켓몬이 쓰러지면 (stop · ko) 멈춤 (코드 리뷰어) */
  private dashes = new Map<number, { an: Animation; el: Element }>();

  constructor(
    private readonly stage: TeamFxStage,
    private readonly fx: PokemonFx | null = pokemonFx(),
  ) {}

  update(b: TeamBattle | null): void {
    const fx = this.fx;
    if (!b) {
      this.reset();
      return;
    }
    fx?.team?.(true);
    const prev = this.last;
    const fresh = this.seq < 0 || b.logSeq < this.seq || (prev !== null && (b.t < prev.t || b.foeName !== prev.foeName || b.kind !== prev.kind));
    if (fresh || (b.log[0] !== undefined && b.log[0].id > this.seq + 1)) {
      // 처음 · 새 판 · 기록이 빠짐 — 지금부터 (새 판이면 필살기 본 것도 처음부터)
      if (fresh) {
        this.seen = new Set();
        fx?.mount?.(this.stage.layer?.() ?? null);
      }
      this.seq = b.logSeq;
      this.last = b;
      return;
    }
    this.last = b;
    if (b.logSeq === this.seq) return;
    const calls = planTeamFx(b, this.seq, this.seen);
    this.seq = b.logSeq;
    if (!fx) return;
    for (const c of calls) {
      try {
        this.run(fx, c);
      } catch (err) {
        console.warn('[pokemon-game] 3:3 연출', c.do, err);
      }
    }
  }

  /** 판이 끝나 화면이 사라질 때 — 남은 연출 · 타이머를 지우고 3:3 모드를 끔 */
  reset(): void {
    releaseKnocks();
    this.pending.forEach((t) => window.clearTimeout(t));
    this.pending.clear();
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers.clear();
    this.dashes.forEach((d) => d.an.cancel());
    this.dashes.clear();
    releaseFx();
    if (this.seq >= 0) {
      this.fx?.clear();
      this.fx?.team?.(false);
    }
    this.seq = -1;
    this.last = null;
  }

  /** ms 뒤 (reset 이 지움) */
  private later(ms: number, fn: () => void): void {
    const t = window.setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
  }

  private run(fx: PokemonFx, c: TeamFxCall): void {
    const a = (w: TeamSlot) => this.stage.actor(w);
    switch (c.do) {
      case 'move': {
        const src = a(c.src);
        const dst = a(c.dst);
        if (!src) return;
        // 이 포켓몬 모양의 연출이 닿는 때를 엔진이 맞히는 때에 맞춤 — 연출이 더 빨리 닿으면 그만큼 늦게 시작 (맞는 순간 = 피해 숫자, U2)
        const p = fx.plan(src.form, c.move);
        const delay = p ? Math.round(c.hitMs - p.ms * shotHitAt(p.fx)) : 0;
        const go = () => {
          this.pending.delete(c.tag);
          fx.move(src, c.move, 0, undefined, dst ?? undefined, c.tag);
        };
        if (delay < 16) go();
        else this.pending.set(c.tag, window.setTimeout(go, delay));
        return;
      }
      case 'dash': {
        const src = a(c.src);
        const dst = a(c.dst);
        const an = src && dst ? dash(src, dst, shotTiming(c.moveId)) : null;
        if (an && src) {
          this.dashes.set(c.tag, { an, el: src.box ?? src.el });
          an.finished.then(() => this.dashes.delete(c.tag)).catch(() => this.dashes.delete(c.tag));
        }
        return;
      }
      case 'strike': {
        const dst = a(c.dst);
        const src = a(c.src);
        if (dst) fx.move(dst, c.move, 0, src?.form);
        return;
      }
      case 'stop': {
        const t = this.pending.get(c.tag);
        if (t !== undefined) {
          window.clearTimeout(t);
          this.pending.delete(c.tag);
        }
        fx.stopMove?.(c.tag, true);
        this.dashes.get(c.tag)?.an.cancel();
        this.dashes.delete(c.tag);
        return;
      }
      case 'impact': {
        const hit = () => {
          const dst = a(c.dst);
          if (dst) fx.impact(dst, c.type, c.big, c.name, c.o);
        };
        if (c.delayMs) this.later(c.delayMs, hit);
        else hit();
        return;
      }
      case 'knock': {
        const dst = a(c.dst);
        if (dst) knock(dst, c.dst.side === 'foe' ? 1 : -1, c.cells, c.ms);
        return;
      }
      case 'dodge': {
        const dst = a(c.dst);
        if (dst) fx.dodge?.(dst);
        return;
      }
      case 'ko': {
        const dst = a(c.dst);
        if (dst) {
          this.stopDash(dst);
          fx.ko?.(dst);
        }
        return;
      }
      case 'final': {
        const dst = a(c.dst);
        // 마지막 한 방 — 전체가 짧게 멈춤 (3:3 에서 이것만 모두 멈춤) + 금색 별빛
        fx.hitStop?.(160, true);
        if (dst) fx.ko?.(dst);
        return;
      }
      case 'status': {
        const dst = a(c.dst);
        if (dst) fx.status?.(dst, c.kind);
        return;
      }
      case 'ready': {
        const dst = a(c.dst);
        if (dst) fx.ultReady?.(dst);
        return;
      }
      case 'ult': {
        const src = a(c.src);
        const dst = a(c.dst);
        fx.stopDuel?.();
        // 일반 모드 필살기 그대로 — 맞는 순간까지 엔진을 붙잡아 그때 피해 (1:1 과 같음 · 안 볼 때는 엔진 박자)
        const others = c.others.map(a).filter((x): x is FxActor => !!x);
        // 개발 모드 (임시) 에서 고른 필살기
        const pick = devUltOf(this.last?.[c.src.side][c.src.slot]?.uid);
        const total = src && dst ? (fx.ult?.(src, dst, () => releaseFx(), this.learned(c.src), { quick: c.quick, others, type: c.type, ...(pick ? { pick } : {}) }) ?? 0) : 0;
        if (total > 0) holdFx(c.key, total, performance.now(), FX_HOLD_ULT_MAX_MS);
        return;
      }
      case 'joint': {
        // 힘겨루기를 이겨 합동이면 대결 입자부터 지움 (fxGameStop 은 타이머만 막아 가운데서 계속 밀던 것 — 코드 리뷰어)
        fx.stopDuel?.();
        // 그림이 없는 참가자는 타입 · 피할 이름과 같이 뺌 (순번이 어긋나 다른 포켓몬 것이 붙던 것)
        const ps = c.winners
          .map((w, i) => ({ actor: a(w), type: c.types[i] ?? 'normal', avoid: this.learned(w), pick: devUltOf(this.last?.[w.side][w.slot]?.uid) ?? null }))
          .filter((p): p is { actor: FxActor; type: string; avoid: string[]; pick: string | null } => !!p.actor);
        const dst = a(c.dst);
        const others = c.others.map(a).filter((x): x is FxActor => !!x);
        const total = ps.length && dst ? (fx.ultJoint?.(ps.map((p) => p.actor), dst, () => releaseFx(), { types: ps.map((p) => p.type), avoid: ps.map((p) => p.avoid), pick: ps.map((p) => p.pick), sure: c.sure, others }) ?? 0) : 0;
        if (total > 0) holdFx(c.key, total, performance.now(), FX_HOLD_ULT_MAX_MS);
        return;
      }
      case 'ult-clash': {
        const me = a({ side: 'me', slot: c.me[0]! });
        const foe = a({ side: 'foe', slot: c.foe[0]! });
        fx.stopUlt?.();
        if (me && foe) fx.duel?.(me, foe, { kind: 'ult', a: null, b: null, aAvoid: this.learned({ side: 'me', slot: c.me[0]! }), bAvoid: this.learned({ side: 'foe', slot: c.foe[0]! }) }, () => this.live());
        return;
      }
      case 'ult-join': {
        const who = a(c.who);
        if (who) fx.ultReady?.(who);
        return;
      }
      case 'ult-clash-end':
        // 합동이면 곧 합동 마무리 (joint) 가 대결을 끝내고 시작 — 혼자 이긴 쪽만 뚫고 나감
        if (!c.joint) fx.duelWin?.(c.winner === 'me' ? 'a' : 'b');
        return;
      case 'clash':
        // 기술 힘겨루기 모양은 디자인팀 (둘 사이 부딪힘) — 지금은 두 기술을 멈추기만
        return;
      case 'end':
        fx.stopDuel?.(true);
        return;
    }
  }

  /** 그 그림의 달려가는 몸짓을 멈춤 (쓰러짐) */
  private stopDash(who: FxActor): void {
    const el = who.box ?? who.el;
    for (const [tag, d] of this.dashes) {
      if (d.el === el) {
        d.an.cancel();
        this.dashes.delete(tag);
      }
    }
  }

  /** 지금 필살기 힘겨루기에서 내가 이길 확률 (대결 연출이 기울기에 씀) */
  private live(): number {
    const b = this.last;
    const c = b?.clash;
    if (!b || !c) return 0.5;
    if (c.me.length >= BALANCE.team.size && c.foe.length === 1) return 1;
    if (c.foe.length >= BALANCE.team.size && c.me.length === 1) return 0;
    const sum = (side: Side, list: number[]) => list.reduce((s, i) => s + (b[side][i]?.stats.ultimate ?? 0), 0);
    return clashWithTaps(clashChance(sum('me', c.me), sum('foe', c.foe)), c.taps);
  }

  /** 필살기 이름이 배운 기술과 같으면 다른 것 (1:1 과 같음) */
  private learned(w: TeamSlot): string[] {
    const f = this.last?.[w.side][w.slot];
    return (f?.moves ?? []).map((s) => moveOf(s.moveId)?.name.ko).filter((n): n is string => !!n);
  }
}

/**
 * 닿는 기술 — 몸이 상대 앞까지 달려가 (dashMs) 박치기 자리에 머물고 (strike) 제자리로 (backMs) — 엔진 박자 shotTiming 그대로.
 * 상대 몸 앞 (두 그림 폭 사이) 까지 · 정수 px · 동작 줄이기면 반만
 */
export function dash(src: FxActor, dst: FxActor, t: { dur: number; hitMs: number }): Animation | null {
  const el = src.box ?? src.el;
  const to = dst.box ?? dst.el;
  if (typeof el.animate !== 'function') return null;
  const a = el.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  const dir = b.left + b.width / 2 >= a.left + a.width / 2 ? 1 : -1;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0.5 : 1;
  const dx = Math.round(((b.left + b.width / 2 - dir * (b.width / 2 + a.width * 0.3)) - (a.left + a.width / 2)) * reduce);
  const dy = Math.round((b.bottom - a.bottom) * reduce);
  const atHit = Math.min(0.9, Math.max(0.05, (t.hitMs - TIMING_STRIKE_HIT_MS) / t.dur));
  const back = Math.min(0.97, Math.max(atHit + 0.05, 1 - TIMING_BACK_MS / t.dur));
  const an = el.animate(
    [
      { translate: '0 0', easing: 'ease-in' },
      { translate: `${dx}px ${dy}px`, offset: atHit },
      { translate: `${dx}px ${dy}px`, offset: back, easing: 'ease-out' },
      { translate: '0 0' },
    ],
    { duration: t.dur, composite: 'add' },
  );
  an.id = DASH_ID;
  return an;
}

/** 밀림 중인 그림 — 멈춘 몸짓 · 다시 켤 타이머 (같은 포켓몬이 연달아 맞으면 늘림 · reset 이 모두 다시 켬) */
const knocked = new Map<Element, { paused: Animation[]; timer: number }>();
const KNOCK_ID = 'pg-team-knock';
const DASH_ID = 'pg-team-dash';

function unknock(el: Element): void {
  const k = knocked.get(el);
  if (!k) return;
  window.clearTimeout(k.timer);
  knocked.delete(el);
  k.paused.forEach((an) => an.playState === 'paused' && an.play());
}

/** 밀림 · 멈춤을 모두 풂 (판이 끝나 화면이 사라질 때) */
export function releaseKnocks(): void {
  [...knocked.keys()].forEach(unknock);
}

/**
 * 맞은 포켓몬만 — 그 몸짓을 잠깐 멈추고 맞은 쪽 뒤로 밀렸다 돌아옴 (픽셀 박자 steps · 정수 px). 동작 줄이기면 밀림 없이 멈춤만.
 * 같은 포켓몬이 멈춘 사이에 또 맞으면 멈춤을 그 끝까지 늘리고 밀림은 새로 (앞 밀림을 멈추지 않음 — 코드 리뷰어)
 */
export function knock(dst: FxActor, dir: 1 | -1, cells: number, ms: number): void {
  const el = dst.box ?? dst.el;
  if (typeof el.animate !== 'function') return;
  const prev = knocked.get(el);
  if (prev) window.clearTimeout(prev.timer);
  // 밀림 · 달려가기는 멈추지 않음 (달려가는 중에 맞아도 박자가 밀리지 않게 — 코드 리뷰어)
  const fresh = el.getAnimations({ subtree: true }).filter((an) => an.playState === 'running' && an.id !== KNOCK_ID && an.id !== DASH_ID);
  fresh.forEach((an) => an.pause());
  const paused = [...(prev?.paused ?? []), ...fresh];
  knocked.set(el, { paused, timer: window.setTimeout(() => unknock(el), ms) });
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  // 1칸 = 그림 폭의 1/4 (반 칸 = 1/8) — 정수 px [제안]
  const px = Math.max(1, Math.round(el.getBoundingClientRect().width * 0.25 * cells)) * dir;
  const an = el.animate([{ translate: '0 0' }, { translate: `${px}px 0`, offset: 0.25 }, { translate: `${px}px 0`, offset: 0.7 }, { translate: '0 0' }], { duration: ms, easing: 'steps(2, end)', composite: 'add' });
  an.id = KNOCK_ID;
}
