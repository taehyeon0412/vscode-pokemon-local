/**
 * 3:3 연출 다리 (2026-10-21 orders #17 준비) — 엔진 기록 (TeamBattle.log) 을 연출 부르기 목록으로 (계획 · 화면 없이 시험) → 일반 모드 연출 (fx/bridge) 로 (실행).
 * 6마리가 겹쳐 쏘는 3:3 은 엔진이 연출을 기다리지 않음 (실시간) — 연출은 기록을 따라 그림만. 모양 (발밑 판 · 자리 · 크기) 은 디자인팀, 화면은 actor() 로 그림 요소만 넘김.
 * 태현 님 (기획 전달): 타격감 · 필살기 화려함은 일반 모드 · 1:1 보다 낫게 — 맞은 포켓몬만 짧게 멈춤 · 반 칸 밀림 · 타입 임팩트 · 마지막 한 방은 크게 + 짧게 느리게 ·
 * 합동 · 3:1 은 따로 마무리 · 기술 번쩍임은 끄고 필살기만 (1초 3번 이하) · 같은 연출 돌려쓰기 · 빠른 떨림 · 깜빡임 금지
 */
import { BALANCE } from '../../../core/balance';
import type { Side, TeamBattle, TeamLogEntry } from '../../../core/engine';
import { clashChance, clashWithTaps } from '../../../core/rules/battle';
import { moveOf } from '../../../data';
import { pokemonFx, type FxActor, type FxImpact, type FxMove, type PokemonFx } from './bridge';

export interface TeamSlot {
  side: Side;
  slot: number;
}

/** 연출 하나 — 실행 (TeamFxRunner) 이 일반 모드 연출로 옮김 */
export type TeamFxCall =
  /** 쏘는 기술 — tag = 기술 번호 (힘겨루기 · 쏜 포켓몬이 쓰러지면 그 기술만 멈춤) */
  | { do: 'move'; tag: number; src: TeamSlot; dst: TeamSlot; move: FxMove }
  | { do: 'stop'; tag: number }
  /** 맞음 — 타입 임팩트 · 맞은 포켓몬만 멈춤 + 밀림 (cells = 칸 수, 반 칸 = 0.5) */
  | { do: 'impact'; dst: TeamSlot; type: string; big: boolean; name: string; o: FxImpact }
  | { do: 'knock'; dst: TeamSlot; cells: number; ms: number }
  | { do: 'dodge'; dst: TeamSlot }
  | { do: 'ko'; dst: TeamSlot }
  /** 마지막 한 방 — 크게 · 짧게 느리게 */
  | { do: 'final'; dst: TeamSlot }
  | { do: 'status'; dst: TeamSlot; kind: 'poison' | 'burn' | 'paralysis' | 'sleep' }
  | { do: 'ready'; dst: TeamSlot }
  /** 필살기 — dst = 가운데 상대 (모두를 침) · quick = 이 판에서 이 포켓몬이 두 번째부터 (컷인 없이) */
  | { do: 'ult'; src: TeamSlot; dst: TeamSlot; quick: boolean }
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
      const m = fxMoveOf(e.moveId);
      // 1 공격 (moveId 0) 은 쏘는 것이 없음 — 맞을 때 임팩트만
      if (m) out.push({ do: 'move', tag: e.shot, src: { side: e.side, slot: e.from }, dst: { side: other(e.side), slot: e.targets[Math.floor((e.targets.length - 1) / 2)]! }, move: m });
      return;
    }
    case 'hit': {
      const dst = { side: other(e.side), slot: e.to };
      const m = e.ult ? null : fxMoveOf(e.moveId);
      const type = e.ult ? (b[e.side][e.from]?.types[0] ?? 'normal') : (m?.type ?? 'normal');
      const big = e.ult || e.effect === 'super' || e.effect === 'crit' || final;
      const o: FxImpact = e.effect === 'immune' ? { none: true } : { scale: final ? 1.4 : e.effect === 'super' ? 1.25 : e.effect === 'weak' ? 0.75 : 1, ...(e.moveId === 0 ? { basic: true } : {}) };
      out.push({ do: 'impact', dst, type, big, name: m?.name ?? '필살기', o });
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
      const key = `${e.side}:${e.from}`;
      out.push({ do: 'ult', src: { side: e.side, slot: e.from }, dst: ultTarget(b, e.side), quick: seen.has(key) });
      seen.add(key);
      return;
    }
    case 'ult-clash':
      out.push({ do: 'ult-clash', me: [...e.me], foe: [...e.foe] });
      return;
    case 'ult-join':
      out.push({ do: 'ult-join', who: { side: e.side, slot: e.slot } });
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
    if (this.seq >= 0) {
      this.fx?.clear();
      this.fx?.team?.(false);
    }
    this.seq = -1;
    this.last = null;
  }

  private run(fx: PokemonFx, c: TeamFxCall): void {
    const a = (w: TeamSlot) => this.stage.actor(w);
    switch (c.do) {
      case 'move': {
        const src = a(c.src);
        const dst = a(c.dst);
        if (src) fx.move(src, c.move, 0, undefined, dst ?? undefined, c.tag);
        return;
      }
      case 'stop':
        fx.stopMove?.(c.tag, true);
        return;
      case 'impact': {
        const dst = a(c.dst);
        if (dst) fx.impact(dst, c.type, c.big, c.name, c.o);
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
        if (dst) fx.ko?.(dst);
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
        if (src && dst) fx.ult?.(src, dst, undefined, this.learned(c.src), { quick: c.quick });
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
        fx.duelWin?.(c.winner === 'me' ? 'a' : 'b');
        return;
      case 'clash':
        // 기술 힘겨루기 모양은 디자인팀 (둘 사이 부딪힘) — 지금은 두 기술을 멈추기만
        return;
      case 'end':
        fx.stopDuel?.(true);
        return;
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

/** 밀림 중인 그림 — 멈춘 몸짓 · 다시 켤 타이머 (같은 포켓몬이 연달아 맞으면 늘림 · reset 이 모두 다시 켬) */
const knocked = new Map<Element, { paused: Animation[]; timer: number }>();
const KNOCK_ID = 'pg-team-knock';

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
  const fresh = el.getAnimations({ subtree: true }).filter((an) => an.playState === 'running' && an.id !== KNOCK_ID);
  fresh.forEach((an) => an.pause());
  const paused = [...(prev?.paused ?? []), ...fresh];
  knocked.set(el, { paused, timer: window.setTimeout(() => unknock(el), ms) });
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  // 1칸 = 그림 폭의 1/4 (반 칸 = 1/8) — 정수 px [제안]
  const px = Math.max(1, Math.round(el.getBoundingClientRect().width * 0.25 * cells)) * dir;
  const an = el.animate([{ translate: '0 0' }, { translate: `${px}px 0`, offset: 0.25 }, { translate: `${px}px 0`, offset: 0.7 }, { translate: '0 0' }], { duration: ms, easing: 'steps(2, end)', composite: 'add' });
  an.id = KNOCK_ID;
}
