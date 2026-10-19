/**
 * 전투 연출 = 일반 모드 연출 (2026-10-19 태현 님 "일반 모드처럼 자연스럽고 멋지게") — 행동이 바뀔 때마다 (battleAnimKey) 일반 모드 기술 연출을 그 포켓몬 그림에서 씀.
 * 쏘는 기술 = 시작 0.12초 뒤 입에서 (일반 모드 useSignature 와 같음) · 연출이 끝날 때까지 엔진 걸음을 붙잡음 (fx/hold) · 끝무렵 상대에 번쩍.
 * 닿는 기술 (몸통박치기 · 할퀴기 · 주먹) = 게임 몸짓 (pg-lunge) 이 상대에 닿는 순간 (80%) 맞는 쪽 몸 앞에.
 * 필살기 = 일반 모드 필살기 그대로 (번쩍 · 어두워짐 · 컷인 · 큰 글씨 · 전용 연출) · 끝날 때까지 붙잡음 · 맞받아치기로 끊기면 멈춤.
 * 방어 = 방패 · 회복 = 반짝 · 잠 = Z · 마비 = 찌릿. 일반 모드 번들이 없거나 못 그린 행동은 BattleLayer 가 이모지로.
 */
import { useEffect, useState } from 'preact/hooks';
import type { BattleState, Side } from '../../../core/engine';
import { formOf, moveOf, speciesOf } from '../../../data';
import { pokemonFx, type FxActor, type FxMove } from '../fx/bridge';
import { battleAnimKey, FX_HOLD_ULT_MAX_MS, holdFx, releaseFx } from '../fx/hold';

/** 쏘는 기술을 쓰기 시작하는 때 — 몸을 젖혔다 내미는 동안 (일반 모드 useSignature 의 120ms) */
const CAST_DELAY_MS = 120;
/** 닿는 기술이 상대에 닿는 때 = 달려들기 (pg-lunge) 의 82% */
const CONTACT_AT = 0.8;
/** 쏘는 기술이 상대에 닿는 때 (연출 길이의 몇 %) */
const SHOT_HIT_AT = 0.85;
/** 필살기 시작을 이만큼 넘겨서 붙었으면 (접었다 펴기 등) 처음부터 못 보여 줘서 이모지로 */
const ULT_LATE_MS = 300;
const ULT_RETRY_MS = 50;
/** 이미 지난 순간은 이만큼까지만 늦게라도 그림 (화면이 다시 붙는 사이) */
const LATE_OK_MS = 50;

const other = (s: Side): Side => (s === 'me' ? 'foe' : 'me');

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

/** 행동마다 연출을 한 번 — 일반 모드가 그리면 true (BattleLayer 는 그때 이모지를 안 그림). 못 그린 행동 (필살기를 못 씀 · 오류) 은 false */
export function useBattleFx(b: BattleState): boolean {
  const fx = pokemonFx();
  const key = battleAnimKey(b);
  // 일반 모드가 못 그린 행동의 열쇠 — 그 행동만 이모지로
  const [missed, setMissed] = useState('');
  useEffect(() => {
    if (!fx) return undefined;
    const a = b.anim;
    if (!a) {
      // 힘대결 — 앞 행동의 뿜기 · 늦은 타이머가 힘대결 그림 위에 남지 않게
      if (b.phase === 'clash') fx.clear();
      return undefined;
    }
    const side = a.side;
    const timers: number[] = [];
    let ultOn = false;
    const fail = (err: unknown) => {
      // 일반 모드 연출 오류가 게임을 멈추지 않게 (Guard 로 가면 화면 오류) — 이 행동만 이모지로
      console.warn('[pokemon-game] 전투 연출 오류', err);
      setMissed(key);
    };
    // 행동 시작에서 ms 뒤 — 화면이 행동 도중에 붙었으면 (접었다 펴기) 지난 만큼 당기고, 많이 지났으면 건너뜀
    const at = (ms: number, fn: () => void) => {
      if (ms < a.ms - LATE_OK_MS) return;
      timers.push(
        window.setTimeout(() => {
          try {
            fn();
          } catch (err) {
            fail(err);
          }
        }, Math.max(0, ms - a.ms)),
      );
    };
    try {
      const act = a.action;
      const move = fxMove(b);
      if (move) {
        const form = b[side].form;
        const plan = fx.plan(form, move.m);
        if (plan?.contact) {
          // 자국 · 주먹은 맞는 쪽 몸 앞 (서로 마주 보니 친 쪽을 향한 면) 에 — 쓰는 쪽 기술 모양 그대로 (form)
          at(Math.round(a.dur * CONTACT_AT), () => {
            const dst = actor(b, other(side));
            if (!dst) return;
            fx.move(dst, move.m, 0, form);
            fx.impact(dst, move.hitType, move.big);
          });
        } else if (plan) {
          const mv = act.kind === 'move' ? moveOf(act.moveId) : undefined;
          holdFx(key, CAST_DELAY_MS + plan.ms - a.ms, performance.now());
          at(CAST_DELAY_MS, () => {
            const src = actor(b, side);
            const dst = actor(b, other(side));
            if (src) fx.move(src, move.m, dst ? reachPx(src, dst) : 0);
          });
          if (mv && mv.power > 0) {
            at(CAST_DELAY_MS + Math.round(plan.ms * SHOT_HIT_AT), () => {
              const dst = actor(b, other(side));
              if (dst) fx.impact(dst, move.hitType, move.big);
            });
          }
        }
      } else if (act.kind === 'ult') {
        // 필살기 — 일반 모드 필살기 그대로, 끝날 때까지 엔진을 붙잡음. 앞 행동의 남은 연출은 지우고 시작
        fx.clear();
        // 그림이 아직 0 크기 (나와라! 커지는 중) 면 0.05초씩 기다림 — 0.3초까지 못 쓰면 이모지로
        const tryUlt = (waited: number) => {
          const src = actor(b, side);
          const dst = actor(b, other(side));
          const total = fx.ult && src && dst ? fx.ult(src, dst) : 0;
          if (total > 0) {
            holdFx(key, total, performance.now(), FX_HOLD_ULT_MAX_MS);
            ultOn = true;
          } else if (fx.ult && a.ms + waited + ULT_RETRY_MS <= ULT_LATE_MS) {
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
        tryUlt(0);
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
      // 필살기가 다른 행동 (맞받아치기 힘대결 · 전투 끝) 으로 바뀌면 멈춤 — 끝까지 갔으면 이미 끝나 있음
      if (ultOn) fx.stopUlt?.();
    };
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
  return fx !== null && missed !== key;
}
