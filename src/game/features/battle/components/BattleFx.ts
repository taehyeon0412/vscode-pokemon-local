/**
 * 전투 연출 = 일반 모드 연출 (2026-10-19 태현 님 "일반 모드처럼 자연스럽고 멋지게") — 행동이 바뀔 때마다 (battleAnimKey) 일반 모드 기술 연출을 그 포켓몬 그림에서 씀.
 * 쏘는 기술 = 시작 0.12초 뒤 입에서 (일반 모드 useSignature 와 같음) · 연출이 끝날 때까지 엔진 걸음을 붙잡음 (fx/hold) · 끝무렵 상대에 번쩍.
 * 닿는 기술 (몸통박치기 · 할퀴기 · 주먹) = 게임 몸짓 (pg-lunge) 이 상대에 닿는 순간 (80%) 맞는 쪽 몸 앞에.
 * 방어 = 방패 · 회복 = 반짝 · 잠 = Z · 마비 = 찌릿. 일반 모드 번들이 없으면 아무것도 안 함 (BattleLayer 가 이모지로).
 */
import { useEffect } from 'preact/hooks';
import type { BattleState, Side } from '../../../core/engine';
import { formOf, moveOf, speciesOf } from '../../../data';
import { pokemonFx, type FxActor, type FxMove } from '../fx/bridge';
import { battleAnimKey, holdFx, releaseFx } from '../fx/hold';

/** 쏘는 기술을 쓰기 시작하는 때 — 몸을 젖혔다 내미는 동안 (일반 모드 useSignature 의 120ms) */
const CAST_DELAY_MS = 120;
/** 닿는 기술이 상대에 닿는 때 = 달려들기 (pg-lunge) 의 82% */
const CONTACT_AT = 0.8;
/** 쏘는 기술이 상대에 닿는 때 (연출 길이의 몇 %) */
const SHOT_HIT_AT = 0.85;

const other = (s: Side): Side => (s === 'me' ? 'foe' : 'me');

/** 쓰는 포켓몬 가운데에서 상대 몸 앞쪽까지 (px) — 뿜는 기술이 상대까지 닿게 */
function reachPx(src: FxActor, dst: FxActor): number {
  const a = (src.box ?? src.el).getBoundingClientRect();
  const d = (dst.box ?? dst.el).getBoundingClientRect();
  return Math.max(0, Math.abs(d.left + d.width / 2 - (a.left + a.width / 2)) - d.width * 0.25);
}

/** 그 쪽 포켓몬의 그림 · 위치 (안 움직이는 바깥 칸 — 몸짓 중에도 제자리) */
function actor(b: BattleState, side: Side): FxActor | null {
  const el = document.querySelector<HTMLElement>(`.pg-fighter-${side} .pg-sprite`);
  const box = document.querySelector<HTMLElement>(`.pg-fighter-${side}`);
  if (!el || !box) return null;
  const f = b[side];
  return { el, box, form: f.form, size: formOf(f.form)?.size ?? 32, left: side === 'foe', name: speciesOf(f.species)?.name.ko ?? '' };
}

/** 행동 → 일반 모드에 넘길 기술 (공격 = 몸통박치기, 색은 그 포켓몬 첫 타입) */
function fxMove(b: BattleState): { m: FxMove; hitType: string; big: boolean } | null {
  const a = b.anim;
  if (!a) return null;
  if (a.action.kind === 'attack') return { m: { name: '몸통박치기', type: 'normal' }, hitType: b[a.side].types[0] ?? 'normal', big: false };
  if (a.action.kind === 'move') {
    const mv = moveOf(a.action.moveId);
    return mv ? { m: { name: mv.name.ko, type: mv.type }, hitType: mv.type, big: mv.power >= 80 } : null;
  }
  return null;
}

/** 행동마다 연출을 한 번 — 일반 모드 번들이 있으면 true (BattleLayer 는 그때 이모지를 안 그림) */
export function useBattleFx(b: BattleState): boolean {
  const fx = pokemonFx();
  const key = battleAnimKey(b);
  useEffect(() => {
    const a = b.anim;
    if (!fx || !a) return undefined;
    const side = a.side;
    const timers: number[] = [];
    const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    const act = a.action;
    const move = fxMove(b);
    if (move) {
      const plan = fx.plan(b[side].form, move.m);
      if (plan?.contact) {
        // 자국 · 주먹은 맞는 쪽 몸 앞 (서로 마주 보니 친 쪽을 향한 면) 에 — 달려드는 몸짓 타이밍과 상관없이 늘 상대에 남게
        later(Math.round(a.dur * CONTACT_AT), () => {
          const dst = actor(b, other(side));
          if (!dst) return;
          fx.move(dst, move.m);
          fx.impact(dst, move.hitType, move.big);
        });
      } else if (plan) {
        const mv = act.kind === 'move' ? moveOf(act.moveId) : undefined;
        holdFx(key, CAST_DELAY_MS + plan.ms, performance.now());
        later(CAST_DELAY_MS, () => {
          const src = actor(b, side);
          const dst = actor(b, other(side));
          if (src) fx.move(src, move.m, dst ? reachPx(src, dst) : 0);
        });
        if (mv && mv.power > 0) {
          later(CAST_DELAY_MS + Math.round(plan.ms * SHOT_HIT_AT), () => {
            const dst = actor(b, other(side));
            if (dst) fx.impact(dst, move.hitType, move.big);
          });
        }
      }
    } else if (act.kind === 'guard' || act.kind === 'item' || act.kind === 'skip') {
      const src = actor(b, side);
      const status = b[side].status?.kind;
      if (src) {
        if (act.kind === 'guard') fx.cast(src, 'shield', { c: 'aura' });
        else if (act.kind === 'item') fx.cast(src, 'glow', { c: act.item === 'revive' ? 'gold' : 'heal' });
        else if (status === 'sleep') fx.cast(src, 'zzz', {});
        else fx.cast(src, 'spark', { c: 'paralyze' });
      }
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
    // 행동이 바뀔 때만 (같은 행동 동안 다시 그려져도 한 번)
  }, [key]);
  // 전투 화면이 사라지면 남은 연출 · 붙잡기를 지움
  useEffect(
    () => () => {
      releaseFx();
      pokemonFx()?.clear();
    },
    [],
  );
  return fx !== null;
}
