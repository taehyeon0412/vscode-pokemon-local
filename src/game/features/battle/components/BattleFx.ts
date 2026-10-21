/**
 * 전투 연출 = 일반 모드 연출 (2026-10-19 태현 님 "일반 모드처럼 자연스럽고 멋지게") — 행동이 바뀔 때마다 (battleAnimKey) 일반 모드 기술 연출을 그 포켓몬 그림에서 씀.
 * 쏘는 기술 = 시작 0.12초 뒤 입에서 (일반 모드 useSignature 와 같음) · 연출이 끝날 때까지 엔진 걸음을 붙잡음 (fx/hold) · 끝무렵 상대에 번쩍.
 * 닿는 기술 (몸통박치기 · 할퀴기 · 주먹) = 게임 몸짓 (pg-lunge) 이 상대에 닿는 순간 (80%) 맞는 쪽 몸 앞에.
 * 필살기 = 일반 모드 필살기 그대로 (번쩍 · 어두워짐 · 컷인 · 큰 글씨 · 전용 연출) · 끝날 때까지 붙잡음 · 맞받아치기로 끊기면 멈춤.
 * 방어 = 방패 · 회복 = 반짝 · 잠 = Z · 마비 = 찌릿. 일반 모드 번들이 없거나 못 그린 행동은 BattleLayer 가 이모지로.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { TIMING } from '../../../core/balance';
import type { BattleState, Side } from '../../../core/engine';
import { clashWithTaps } from '../../../core/rules/battle';
import { effectiveness } from '../../../core/rules/types';
import { formOf, moveOf, speciesOf } from '../../../data';
import { pokemonFx, type FxActor, type FxImpact, type FxMove } from '../fx/bridge';
import { battleAnimKey, FX_HOLD_DUEL_MAX_MS, FX_HOLD_ULT_MAX_MS, holdFx, releaseFx } from '../fx/hold';
import { clearImpact, impactOf, setImpact, setUltSkip } from '../fx/parry';

/** 쏘는 기술을 쓰기 시작하는 때 — 몸을 젖혔다 내미는 동안 (일반 모드 useSignature 의 120ms) */
const CAST_DELAY_MS = 120;
/** 닿는 기술이 상대에 닿는 때 = 달려들기 (pg-lunge) 의 82% */
const CONTACT_AT = 0.8;
/** 닿는 기술의 타입 임팩트는 자국 · 주먹보다 이만큼 늦게 (같이 터지면 서로 가림, 2026-10-19) */
const CONTACT_IMPACT_LAG_MS = 90;
/** 쏘는 기술이 상대에 닿는 때 (연출 길이의 몇 %) — 틀마다 잼 (2026-10-20 태현 님 "이미 맞았는데 패링 원이 남아 있음": 하나로 0.85 를 쓰니
 *  광선은 0.5초 먼저 · 솔라빔은 0.3초 늦게 닿았음). 원이 1배가 되는 때 · 쳐내기 · 맞는 연출 · 엔진 피해가 다 이 때 */
const SHOT_HIT_AT: Record<string, number> = { beam: 0.25, spark: 0.6, rings: 0.7, water: 0.8, bubbles: 0.82, glow: 0.86, breath: 0.87, solarbeam: 1 };
const SHOT_HIT_DEFAULT = 0.85;
const shotHitAt = (fx: string) => SHOT_HIT_AT[fx] ?? SHOT_HIT_DEFAULT;
/** 맞는 때 뒤 이만큼까지 엔진을 붙잡음 (피해 숫자가 맞는 때에 뜨게 — 남은 연출은 흘러감) */
const SHOT_HOLD_AFTER_MS = 60;
/** 필살기 시작을 이만큼 넘겨서 붙었으면 (접었다 펴기 등) 처음부터 못 보여 줘서 이모지로 — 나와라! 등장 (0.45초) 을 기다리는 것 포함 */
const ULT_LATE_MS = 600;
const ULT_RETRY_MS = 50;
/** 반격기 — 맞힌 뒤 줄기를 보여 주는 가장 짧은 시간 · 그다음 흐리게 끄는 시간. 흐림은 엔진 행동이 끝나는 때 (= 피해) 에 끝나게 맞춤, 그동안 엔진을 붙잡음 (2026-10-21 orders #7 — 처음 맞힌 순간 = 줄기 시작이라 바로 끄면 줄기가 안 보임) */
const RIPOSTE_BEAM_MS = 500;
const RIPOSTE_FADE_MS = 200;
/** 힘대결 밀고 밀리기 — 일반 모드 대결과 같은 3.6초 (가운데서 만난 뒤부터, 연타는 그동안 계속) */
const DUEL_PUSH_MS = 3600;
/** 이미 지난 순간은 이만큼까지만 늦게라도 그림 (화면이 다시 붙는 사이) */
const LATE_OK_MS = 50;

const other = (s: Side): Side => (s === 'me' ? 'foe' : 'me');

/** 나와라! 등장 몸짓 (pg-sendout, 크기 0.2 → 1) 이 남은 시간 (ms) — 등장 중에 재면 연출이 작고 자리가 틀림 (#331) */
function settleMs(): number {
  let ms = 0;
  for (const side of ['me', 'foe'] as const) {
    const box = document.querySelector<HTMLElement>(`.pg-fighter-${side}`);
    for (const an of box?.getAnimations?.() ?? []) {
      if ((an as CSSAnimation).animationName !== 'pg-sendout') continue;
      const t = an.effect?.getComputedTiming();
      if (t && typeof t.endTime === 'number' && typeof t.localTime === 'number') ms = Math.max(ms, t.endTime - t.localTime);
    }
  }
  return Math.min(600, Math.max(0, Math.round(ms)));
}

/** 지금 행동이 몸으로 닿는 기술인지 (일반 모드 연출 틀 기준 — 몸짓 달려들기 / 젖혔다 내밀기를 연출과 맞춤, #328). 연출이 없으면 null (예전 기준) */
let planCache: { key: string; contact: boolean | null; castAt: number | null } = { key: '', contact: null, castAt: null };
function planOf(b: BattleState): typeof planCache {
  const key = battleAnimKey(b);
  if (planCache.key === key) return planCache;
  const fx = pokemonFx();
  const move = fx && b.anim ? fxMove(b) : null;
  let contact: boolean | null = null;
  let castAt: number | null = null;
  try {
    const plan = fx && move && b.anim ? fx.plan(b[b.anim.side].form, move.m) : null;
    contact = plan?.contact ?? null;
    if (plan && !plan.contact && b.anim) castAt = Math.max(CAST_DELAY_MS, b.anim.dur - Math.round(plan.ms * shotHitAt(plan.fx)));
  } catch {
    contact = null;
  }
  planCache = { key, contact, castAt };
  return planCache;
}
export function fxContact(b: BattleState): boolean | null {
  return planOf(b).contact;
}
/** 쏘는 기술이 입에서 나가는 때 (ms, 행동 시작 기준) — 몸을 내미는 순간을 여기에 맞춤 (#짧은 기술 "재채기하고 쏨", 플레이 리뷰어). 연출이 없으면 null */
export function fxCastAt(b: BattleState): number | null {
  return planOf(b).castAt;
}

/** 쓰는 포켓몬 가운데에서 상대 몸 앞쪽까지 (px) — 뿜는 기술이 상대까지 닿게 */
function reachPx(src: FxActor, dst: FxActor): number {
  const a = (src.box ?? src.el).getBoundingClientRect();
  const d = (dst.box ?? dst.el).getBoundingClientRect();
  return Math.max(0, Math.abs(d.left + d.width / 2 - (a.left + a.width / 2)) - d.width * 0.25);
}

/** 그 쪽 포켓몬의 그림 · 위치 (안 움직이는 바깥 칸 — 몸짓 중에도 제자리). 폭이 0 이면 (접히는 중 · 떨어져 나감) null — 일반 모드 연출은 폭 0 에서 멈출 수 있음 */
function actor(b: BattleState, side: Side): FxActor | null {
  const el = document.querySelector<HTMLElement>(`.pg-fighter-${side} .pg-sprite`);
  const box = document.querySelector<HTMLElement>(`.pg-fighter-${side}`);
  if (!el || !box || box.getBoundingClientRect().width < 1) return null;
  const f = b[side];
  return { el, box, form: f.form, size: formOf(f.form)?.size ?? 32, left: side === 'foe', name: speciesOf(f.species)?.name.ko ?? '' };
}

/** 그 포켓몬이 쓰는 기술 이름 (1 공격 = 몸통박치기 모양 포함) — 같은 이름 필살기는 피함 (ideas #102) */
function learnedNames(b: BattleState, side: Side): string[] {
  const names = b[side].moves.map((m) => moveOf(m.moveId)?.name.ko).filter((n): n is string => !!n);
  return [...names, '몸통박치기'];
}

/** 행동 → 일반 모드에 넘길 기술 (공격 = 몸통박치기, 색은 그 포켓몬 첫 타입) · hit = 맞는 순간 타입 임팩트 옵션 (ult/fx-hit.js) */
function fxMove(b: BattleState): { m: FxMove; hitType: string; big: boolean; hit: FxImpact } | null {
  const a = b.anim;
  if (!a) return null;
  // 1 공격 = 노말 별을 작게 · 색만 타입 (기술 · 필살기보다 수수하게 — 플레이 리뷰어)
  if (a.action.kind === 'attack') return { m: { name: '몸통박치기', type: 'normal' }, hitType: b[a.side].types[0] ?? 'normal', big: false, hit: { basic: true } };
  if (a.action.kind === 'move') {
    const mv = moveOf(a.action.moveId);
    if (!mv) return null;
    // 상성이 연출 크기로 — 굉장 ×1.35 · 별로 ×0.6 · 없음 = 연기만 (글을 안 읽어도 알게, 플레이 리뷰어) · 짜임 = 기술 칸 순서 (한 포켓몬 기술끼리 겹치지 않게)
    const mult = effectiveness(mv.type, b[other(a.side)].types);
    const slot = b[a.side].moves.findIndex((s) => s.moveId === mv.id);
    const hit: FxImpact = { scale: mult > 1 ? 1.35 : mult < 1 ? 0.6 : 1, none: mult === 0, ...(slot >= 0 ? { pick: slot } : {}) };
    return { m: { name: mv.name.ko, type: mv.type }, hitType: mv.type, big: mv.power >= 80, hit };
  }
  return null;
}

/** 이 행동 (key) 의 패링 등급 — 맞는 순간의 최신 상태로 */
function parryOf(now: BattleState, key: string) {
  return battleAnimKey(now) === key && now.anim?.side === 'foe' ? now.anim.parry : undefined;
}

/** 패링으로 막았으면 임팩트를 줄이거나 (막음 ×0.5) 빼기 (완벽 — 쳐내기 · 피하기만) — 맞는 순간의 최신 상태로 */
function parriedHit(now: BattleState, key: string, hit: FxImpact): FxImpact | null {
  const p = battleAnimKey(now) === key && now.anim?.side === 'foe' ? now.anim.parry : undefined;
  if (p === 'perfect') return null;
  if (p === 'good') return { ...hit, scale: (hit.scale ?? 1) * 0.5 };
  return hit;
}

/** 행동마다 연출을 한 번 — 일반 모드가 그리면 true (BattleLayer 는 그때 이모지를 안 그림). 못 그린 행동 (필살기를 못 씀 · 오류) 은 false */
export function useBattleFx(b: BattleState, layer?: { current: HTMLElement | null }): boolean {
  const fx = pokemonFx();
  const key = battleAnimKey(b);
  // 연출 층 (#350) — 기술 · 힘대결은 HUD 아래 층에, 필살기 시작 (컷인 · 큰 글씨) 만 맨 위 → 상대를 맞히는 순간 내림
  const down = () => fx?.mount?.(layer?.current ?? null);
  // 일반 모드가 못 그린 행동의 열쇠 — 그 행동만 이모지로
  const [missed, setMissed] = useState('');
  // 힘대결 연타를 실시간으로 (효과는 시작할 때 한 번만 도니, 지금 상태는 여기서 읽음)
  const now = useRef(b);
  // 이 전투에서 이미 본 필살기 (쪽 · 포켓몬) — 두 번째부터 컷인 없이 짧게 (전투 화면이 새로 뜨면 비움)
  const seenUlts = useRef(new Set<string>());
  now.current = b;
  useEffect(() => {
    if (!fx) return undefined;
    const a = b.anim;
    if (a?.action.kind !== 'ult') down();
    if (!a) {
      if (b.phase !== 'clash' || !b.clash) return undefined;
      // 힘대결 — 앞 행동의 뿜기 · 늦은 타이머를 지우고, 일반 모드 대결로 (모으기 → 가운데서 밀고 밀리기 → 이긴 쪽이 뚫고 나감)
      fx.clear();
      const c = b.clash;
      const mv = (id: number | null): FxMove | null => {
        const m = id === null ? undefined : moveOf(id);
        return m ? { name: m.name.ko, type: m.type } : null;
      };
      if (!fx.duel || c.ms > ULT_LATE_MS) {
        setMissed(key);
        return undefined;
      }
      let started = false;
      let timer = 0;
      // 그림이 아직 0 크기 (막 그려져 그림을 못 받음 · 나와라! 커지는 중) 면 0.05초씩 기다림 — 0.6초까지 못 하면 예전 그림으로
      const begin = (waited: number) => {
        let plan: { meetMs: number } | null = null;
        const me = actor(b, 'me');
        const foe = actor(b, 'foe');
        if ((!me || !foe || settleMs() > 0) && waited < ULT_LATE_MS) {
          timer = window.setTimeout(() => begin(waited + ULT_RETRY_MS), ULT_RETRY_MS);
          return;
        }
        try {
          const live = () => {
            const cur = now.current.clash;
            return cur ? clashWithTaps(cur.base, cur.taps) : 0.5;
          };
          plan = me && foe && fx.duel ? fx.duel(me, foe, { kind: c.kind, a: mv(c.me), b: mv(c.foe), aAvoid: learnedNames(b, 'me'), bAvoid: learnedNames(b, 'foe') }, live) : null;
        } catch (err) {
          console.warn('[pokemon-game] 힘대결 연출 오류', err);
        }
        if (!plan) {
          setMissed(key);
          return;
        }
        started = true;
        // 승자를 정하는 걸음을 밀고 밀리기가 3.6초 될 때까지 붙잡음 (그동안 연타는 계속 셈)
        const t = performance.now();
        const elapsed = now.current.clash?.ms ?? c.ms;
        holdFx(key, plan.meetMs + DUEL_PUSH_MS - elapsed, t, FX_HOLD_DUEL_MAX_MS, t - elapsed);
      };
      begin(0);
      // 힘대결이 끝나면 (피해가 들어가고 전투가 이어짐) 터지는 여운까지 그리고 정리
      return () => {
        window.clearTimeout(timer);
        if (started) fx.stopDuel?.(true);
      };
    }
    const side = a.side;
    // 엔진이 이 행동을 끝내는 때 (벽시계) — 반격기 흐림 끝을 피해 들어가는 때와 맞춤
    const animEndAt = performance.now() + Math.max(0, a.dur - a.ms);
    const timers: number[] = [];
    // 아직 안 온 순간 — 행동이 끊기면 (관장 끼어들기 · 맞받아치기) 남은 연출을 지움 (#330)
    const pending = new Set<number>();
    let ultOn = false;
    let ultHitDone = false;
    const fail = (err: unknown) => {
      // 일반 모드 연출 오류가 게임을 멈추지 않게 (Guard 로 가면 화면 오류) — 이 행동만 이모지로
      console.warn('[pokemon-game] 전투 연출 오류', err);
      setMissed(key);
    };
    // 행동 시작에서 ms 뒤 — 화면이 행동 도중에 붙었으면 (접었다 펴기) 지난 만큼 당기고, 많이 지났으면 건너뜀
    const at = (ms: number, fn: () => void) => {
      if (ms < a.ms - LATE_OK_MS) return;
      const id = window.setTimeout(() => {
        pending.delete(id);
        try {
          fn();
        } catch (err) {
          fail(err);
        }
      }, Math.max(0, ms - a.ms));
      timers.push(id);
      pending.add(id);
    };
    try {
      const act = a.action;
      const move = fxMove(b);
      if (move) {
        const form = b[side].form;
        const plan = fx.plan(form, move.m);
        // 상대 공격이 맞는 순간 — 패링 (Space · 클릭) 판정 · 좁혀지는 원이 이 때에 맞춤 (fx/parry, 2026-10-19)
        const impactAt = (ms: number) => {
          if (side !== 'foe') return;
          const t = performance.now();
          setImpact(key, t + Math.max(0, ms - a.ms), t);
        };
        if (!plan) impactAt(a.dur);
        if (plan?.contact) {
          impactAt(Math.round(a.dur * CONTACT_AT));
          // 자국 · 주먹은 맞는 쪽 몸 앞 (서로 마주 보니 친 쪽을 향한 면) 에 — 쓰는 쪽 기술 모양 그대로 (form)
          at(Math.round(a.dur * CONTACT_AT), () => {
            const dst = actor(b, other(side));
            if (!dst) return;
            // 빗나감 (엔진이 행동 시작 때 정함) — 맞을 쪽이 휙 피함 · 패링 (보통 · 완벽) — 늘 쳐내는 몸짓으로 상대를 튕겨 냄 (가만히 서 있던 것, 2026-10-20 태현 님)
            const p = parryOf(now.current, key);
            if (a.miss) fx.dodge?.(dst);
            else if ((p === 'perfect' || p === 'good') && fx.contactParry) fx.contactParry(dst, actor(b, side), p === 'perfect');
            else if (p === 'perfect') fx.dodge?.(dst);
            else fx.move(dst, move.m, 0, form);
          });
          // 타입 임팩트는 자국 · 주먹이 먼저 보이게 조금 뒤에 (같이 터지면 서로 가림)
          at(Math.round(a.dur * CONTACT_AT) + CONTACT_IMPACT_LAG_MS, () => {
            const dst = actor(b, other(side));
            const hit = a.miss ? null : parriedHit(now.current, key, { ...move.hit, light: true });
            if (dst && hit) fx.impact(dst, move.hitType, move.big, move.m.name, hit);
          });
        } else if (plan) {
          const mv = act.kind === 'move' ? moveOf(act.moveId) : undefined;
          // 짧은 연출은 늦게 시작해 맞는 순간이 피해 숫자 (엔진 dur) 와 같게 (#329) · 등장 중이면 끝난 뒤에.
          // 맞는 순간 = 틀마다 잰 실제로 닿는 때 (shotHitAt) — 패링 원 1배 · 쳐내기 · 맞는 연출 · 피해 숫자가 같이 (2026-10-20 태현 님)
          const hitMs = Math.round(plan.ms * shotHitAt(plan.fx));
          const castAt = Math.max(CAST_DELAY_MS, a.dur - hitMs) + settleMs();
          // 엔진은 맞는 때 바로 뒤까지만 붙잡음 (예전엔 연출이 다 끝날 때까지 — 광선 꼬리 동안 피해 숫자가 늦게 떴음) · 남은 연출은 흘러감
          holdFx(key, castAt + hitMs + SHOT_HOLD_AFTER_MS - a.ms, performance.now());
          impactAt(castAt + hitMs);
          at(castAt, () => {
            const src = actor(b, side);
            const dst = actor(b, other(side));
            const drawn = src ? fx.move(src, move.m, dst ? reachPx(src, dst) : 0, undefined, dst ?? undefined) : 0;
            // 못 그렸으면 (일반 모드 틀 오류 · 그림 폭 0) 그림 없이 4초 멈추지 않게 붙잡기를 풀고 이모지로 (테스터)
            if (!drawn) {
              releaseFx();
              setMissed(key);
            }
          });
          if (mv && mv.power > 0) {
            at(castAt + hitMs, () => {
              const dst = actor(b, other(side));
              if (a.miss) {
                if (dst) fx.dodge?.(dst);
                return;
              }
              // 완벽 패링 — 날아온 것을 위쪽 대각선으로 쳐냄 (빔은 꺾여 흩어짐, 하늘 · 땅 기술은 피함)
              if (parryOf(now.current, key) === 'perfect') {
                // 같은 전투 두 번째 완벽 패링부터 짧게 (ideas #127 — 이번 것까지 센 수는 맞는 순간 엔진이 올림, 그래서 지난 수 ≥ 1)
                if (dst) fx.swat?.(dst, actor(b, side), move.hitType, plan.fx, (b.perfects ?? 0) >= 1);
                return;
              }
              const hit = parriedHit(now.current, key, move.hit);
              if (dst && hit) fx.impact(dst, move.hitType, move.big, move.m.name, hit);
            });
          }
        }
      } else if (act.kind === 'ult' || act.kind === 'riposte') {
        // 필살기 — 일반 모드 필살기 그대로. 앞 행동의 남은 연출은 지우고 시작
        // 반격기 (완벽 패링 두 번) — 그 포켓몬 필살기를 늘 짧게 (컷인 없이 — 컷인은 진짜 필살기만, 2026-10-20 태현 님) + 금색 "반격!"
        const riposte = act.kind === 'riposte';
        fx.clear();
        // 상대 필살기를 내 필살기로 맞받아칠 수 있으면 창 (1초) 이 지난 뒤 컷인 — 컷인 띠가 맞받아치기 안내를 덮지 않게 (플레이 리뷰어)
        const startAt = !riposte && side === 'foe' && b.me.ult >= 1 && b.me.hp > 0 ? TIMING.ultCounterWindowMs : 0;
        // 그림이 아직 0 크기 (나와라! 커지는 중) 면 0.05초씩 기다림 — 0.6초까지 못 쓰면 이모지로
        const tryUlt = (waited: number) => {
          const src = actor(b, side);
          const dst = actor(b, other(side));
          // 상대를 처음 맞힌 순간 피해를 넣음 — 붙잡기를 풀고 남은 연출은 흘러가게 둠 (연출이 다 끝난 뒤 숫자가 늦게 뜨지 않게)
          const onHit = () => {
            ultHitDone = true;
            // 반격기: 줄기 (0.5초 이상) → 0.2초에 흐리게 끄고 그다음 피해 · 메뉴 (메뉴가 뜬 뒤에도 줄기가 0.66초 더 나가던 것, orders #7).
            //   흐림 끝 = 엔진 행동 끝 (피해) — 0.5초로 고정하면 줄기가 사라지고 약 0.15초 뒤에 맞던 것 (UX 리뷰어 U2)
            if (riposte && fx.fadeUlt) {
              const t = performance.now();
              const fadeAt = Math.max(t + RIPOSTE_BEAM_MS, animEndAt - RIPOSTE_FADE_MS);
              holdFx(key, fadeAt + RIPOSTE_FADE_MS - t, t, FX_HOLD_ULT_MAX_MS);
              timers.push(window.setTimeout(() => fx.fadeUlt?.(RIPOSTE_FADE_MS), fadeAt - t));
            } else releaseFx();
            down();
          };
          fx.mount?.(null);
          // 같은 전투에서 이 포켓몬이 필살기를 이미 썼으면 (두 번째부터 — 필살기가 여럿이면 다른 것이어도) 컷인 없이 짧게. 컷인 띠는 포켓몬 얼굴이라 포켓몬 기준
          const seenKey = `${side}:${b[side].uid}:${b[side].form}`;
          const quick = riposte || seenUlts.current.has(seenKey);
          const total = fx.ult && src && dst ? fx.ult(src, dst, onHit, learnedNames(b, side), { quick, ...(riposte ? { sub: `${src?.name ?? ''}의 반격!` } : {}) }) : 0;
          if (total > 0) {
            // 반격기로 본 것은 "본 필살기" 로 안 셈 (진짜 필살기는 처음엔 컷인까지) · 반격기는 금색 "반격!" (그림이 준비된 뒤라 여기서)
            if (!riposte) seenUlts.current.add(seenKey);
            // 약 0.85초만 보이던 것 → 1.4초 (2026-10-21 UX 리뷰어 U1) · 상대 바깥쪽 (가운데는 반격기 이름 — 150px 에서 겹침)
            else if (dst) fx.word?.(dst, '반격!', 'gold', { sec: 1.4, other: src, away: true });
            holdFx(key, total, performance.now(), FX_HOLD_ULT_MAX_MS);
            ultOn = true;
            // Space = 남은 연출 건너뛰기 (아직 안 맞혔으면 맞힌 것으로 — 피해는 엔진이 그대로)
            setUltSkip(
              () => {
                fx.stopUlt?.();
                if (!ultHitDone) onHit();
                // 건너뛰면 바로 (반격기의 줄기 붙잡기도 풂)
                releaseFx();
              },
              key,
              quick,
            );
          } else if (fx.ult && waited + ULT_RETRY_MS <= ULT_LATE_MS) {
            timers.push(
              window.setTimeout(() => {
                try {
                  tryUlt(waited + ULT_RETRY_MS);
                } catch (err) {
                  fail(err);
                }
              }, ULT_RETRY_MS),
            );
          } else {
            setMissed(key);
          }
        };
        const t0 = startAt + settleMs();
        if (t0 < a.ms - LATE_OK_MS) setMissed(key);
        else if (t0 <= a.ms) tryUlt(0);
        else at(t0, () => tryUlt(0));
      } else if (act.kind === 'guard' || act.kind === 'item' || act.kind === 'skip') {
        const src = actor(b, side);
        if (src && a.ms <= LATE_OK_MS * 4) {
          if (act.kind === 'guard') fx.cast(src, 'shield', { c: 'aura' });
          else if (act.kind === 'item') fx.cast(src, 'glow', { c: act.item === 'revive' ? 'gold' : 'heal' });
          else if (act.why === 'sleep') fx.cast(src, 'zzz', {});
          else if (act.why !== 'wake') fx.cast(src, 'spark', { c: 'paralyze' });
        }
      }
    } catch (err) {
      fail(err);
    }
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      setUltSkip(null);
      // 끊긴 기술 — 날아가던 연출 · 늦은 타이머를 지움 (다 끝난 행동은 남은 불씨가 자연스럽게 사라지게 둠)
      if (pending.size > 0 && !ultOn) fx.clear();
      // 필살기가 맞히기 전에 다른 행동 (맞받아치기 힘대결) 으로 바뀌면 멈춤 — 맞힌 뒤면 남은 연출은 끝까지 (전투 화면이 사라지면 clear)
      if (ultOn && !ultHitDone) fx.stopUlt?.();
    };
    // 행동이 바뀔 때만 (같은 행동 동안 다시 그려져도 한 번)
  }, [key]);
  // 패링 — 막으면 맞는 순간에 맞춰 내 포켓몬에 방패 (완벽 = 금색)
  const parried = b.anim?.side === 'foe' ? b.anim.parry : undefined;
  // 빗나갈 공격을 막았으면 피하는 몸짓만 — 방패 · 되튀기는 안 그림 (한꺼번에 나와 헷갈리던 것, 코드 리뷰어)
  // 완벽은 맞는 순간 쳐내기 · 피하기 (위) — 여기는 보통 패링 (스치듯) 의 은색 방패 · 불똥만 (2026-10-20)
  const parriedMiss = !!b.anim?.miss;
  useEffect(() => {
    // 닿는 기술은 쳐내기 (contactParry) 가 맡음 — 방패 · 불똥을 또 그리지 않게
    if (!fx || parried !== 'good' || parriedMiss || (fxContact(b) === true && fx.contactParry)) return undefined;
    const w = impactOf(key);
    const t = window.setTimeout(
      () => {
        const me = actor(b, 'me');
        if (me) fx.cast(me, 'shield', { c: 'silver' });
        // 되튀기 — 막은 몸 앞에서 친 쪽으로 불똥 · 완벽은 금색 초승달 + 히트스톱
        const foe = actor(b, 'foe');
        if (me && foe) fx.deflect?.(me, foe, false);
      },
      w ? Math.max(0, Math.round(w.at - performance.now())) : 0,
    );
    return () => window.clearTimeout(t);
  }, [key, parried]);
  // 새로 뜬 글로 — 히트스톱 (급소 · 마지막 한 방 100ms · 효과 굉장 70ms, 번쩍 없이 손맛) · 쓰러뜨린 한 방 금색 별빛 · 상태 이상이 걸린 순간 연출 (2026-10-20)
  const seenPop = useRef(b.popupSeq);
  useEffect(() => {
    const fresh = b.popups.filter((p) => p.id > seenPop.current);
    seenPop.current = b.popupSeq;
    if (!fx || !fresh.length) return;
    const ko = fresh.find((p) => p.kind === 'damage' && b[p.side].hp <= 0);
    const big = !!ko || fresh.some((p) => p.kind === 'crit');
    if (big || fresh.some((p) => p.kind === 'super')) fx.hitStop?.(big ? 100 : 70);
    const koActor = ko ? actor(b, ko.side) : null;
    if (koActor) fx.ko?.(koActor);
    // 패링 글 — 완벽 = 금색 "완벽 패링!" · 보통 = 은색 "패링!" (내 포켓몬 머리 위)
    const parryPop = fresh.find((p) => p.kind === 'parry');
    const me = parryPop ? actor(b, 'me') : null;
    // 두 번째 완벽 패링부터는 글씨도 짧게 (1.0초 — 엔진 parryShowRepeatMs 와 같게, ideas #127)
    const repeatPerfect = parryPop?.text === '완벽 패링!' && (b.perfects ?? 0) >= 2;
    if (parryPop && me) fx.word?.(me, parryPop.text, parryPop.text === '완벽 패링!' ? 'gold' : 'silver', { other: actor(b, 'foe'), ...(repeatPerfect ? { sec: TIMING.parryShowRepeatMs / 1000 } : {}) });
    // 상태 이상이 걸림 = status 글 + 지금 그 상태 (나음은 아이템 반짝이가 이미 있어서 따로 안 그림)
    for (const p of fresh) {
      const kind = p.kind === 'status' ? b[p.side].status?.kind : undefined;
      const who = kind ? actor(b, p.side) : null;
      if (who && kind) fx.status?.(who, kind);
    }
  }, [b.popupSeq]);
  // 내 필살기 게이지가 다 찬 순간 — 몸 둘레 금색 반짝임 세 번 (2026-10-20 태현 님 "다 채워지면 반짝반짝 · 인지하게", Z 칸 반짝임과 같이)
  const ultFull = b.me.ult >= 1 && b.me.hp > 0 && b.phase !== 'over';
  useEffect(() => {
    if (!fx || !ultFull) return;
    const me = actor(now.current, 'me');
    if (me) fx.ultReady?.(me);
  }, [ultFull]);
  // 반격 기회 — 상대만 밝고 둘레가 살짝 어두워짐 (두 번째 원은 화면이 그림) · 쳐내기 보여 주기 (ms < 0) 가 끝나 원이 뜰 때부터
  const ripostingAt = b.phase === 'riposte' && (b.riposte?.ms ?? -1) >= 0 ? b.t - (b.riposte?.ms ?? 0) : -1;
  useEffect(() => {
    if (!fx || ripostingAt < 0) return;
    const foe = actor(now.current, 'foe');
    if (foe) fx.riposteFocus?.(foe, Math.max(100, (b.riposte?.dur ?? TIMING.riposteRingMs) + TIMING.parryLateMs - (b.riposte?.ms ?? 0)));
  }, [ripostingAt]);
  // 연출 캔버스 위 끝 = 정보줄 아래 끝 (game.css 가 여기서 자름 — 연출이 정보줄을 덮지 않게, 아트 디렉터).
  // 그릴 때마다 잼 — 처음 그릴 땐 game.css 를 받기 전이라 화면이 숨어 0 이 나오고, 패널 크기도 바뀜 (값이 같으면 안 씀)
  useEffect(() => {
    const bar = document.querySelector<HTMLElement>('#pokemon-game .pg-infobar');
    const top = `${bar ? Math.round(bar.getBoundingClientRect().bottom) : 0}px`;
    if (document.body.style.getPropertyValue('--pg-fx-top') !== top) document.body.style.setProperty('--pg-fx-top', top);
  });
  // 힘대결 승자 — 엔진이 정하는 순간 이긴 쪽이 뚫고 나감
  const winner = b.phase === 'clash' ? (b.clash?.winner ?? null) : null;
  useEffect(() => {
    if (fx && winner && missed !== key) fx.duelWin?.(winner === 'me' ? 'a' : 'b');
  }, [key, winner]);
  // 전투 화면이 사라지면 남은 연출 · 붙잡기를 지움
  useEffect(
    () => () => {
      releaseFx();
      clearImpact();
      pokemonFx()?.clear();
      pokemonFx()?.mount?.(null);
      document.body.style.removeProperty('--pg-fx-top');
    },
    [],
  );
  return fx !== null && missed !== key;
}
