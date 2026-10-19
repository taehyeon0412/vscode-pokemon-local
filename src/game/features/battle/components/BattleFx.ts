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
import { formOf, moveOf, speciesOf } from '../../../data';
import { pokemonFx, type FxActor, type FxMove } from '../fx/bridge';
import { battleAnimKey, FX_HOLD_DUEL_MAX_MS, FX_HOLD_ULT_MAX_MS, holdFx, releaseFx } from '../fx/hold';

/** 쏘는 기술을 쓰기 시작하는 때 — 몸을 젖혔다 내미는 동안 (일반 모드 useSignature 의 120ms) */
const CAST_DELAY_MS = 120;
/** 닿는 기술이 상대에 닿는 때 = 달려들기 (pg-lunge) 의 82% */
const CONTACT_AT = 0.8;
/** 쏘는 기술이 상대에 닿는 때 (연출 길이의 몇 %) */
const SHOT_HIT_AT = 0.85;
/** 필살기 시작을 이만큼 넘겨서 붙었으면 (접었다 펴기 등) 처음부터 못 보여 줘서 이모지로 — 나와라! 등장 (0.45초) 을 기다리는 것 포함 */
const ULT_LATE_MS = 600;
const ULT_RETRY_MS = 50;
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
    if (plan && !plan.contact && b.anim) castAt = Math.max(CAST_DELAY_MS, b.anim.dur - Math.round(plan.ms * SHOT_HIT_AT));
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
  // 힘대결 연타를 실시간으로 (효과는 시작할 때 한 번만 도니, 지금 상태는 여기서 읽음)
  const now = useRef(b);
  now.current = b;
  useEffect(() => {
    if (!fx) return undefined;
    const a = b.anim;
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
          plan = me && foe && fx.duel ? fx.duel(me, foe, { kind: c.kind, a: mv(c.me), b: mv(c.foe) }, live) : null;
        } catch (err) {
          console.warn('[pokemon-game] 힘대결 연출 오류', err);
        }
        if (!plan) {
          setMissed(key);
          return;
        }
        started = true;
        // 승자를 정하는 걸음을 밀고 밀리기가 3.6초 될 때까지 붙잡음 (그동안 연타는 계속 셈)
        holdFx(key, plan.meetMs + DUEL_PUSH_MS - (now.current.clash?.ms ?? c.ms), performance.now(), FX_HOLD_DUEL_MAX_MS);
      };
      begin(0);
      // 힘대결이 끝나면 (피해가 들어가고 전투가 이어짐) 터지는 여운까지 그리고 정리
      return () => {
        window.clearTimeout(timer);
        if (started) fx.stopDuel?.(true);
      };
    }
    const side = a.side;
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
          // 짧은 연출은 늦게 시작해 맞는 순간이 피해 숫자 (엔진 dur) 와 같게 (#329) · 등장 중이면 끝난 뒤에
          const castAt = Math.max(CAST_DELAY_MS, a.dur - Math.round(plan.ms * SHOT_HIT_AT)) + settleMs();
          holdFx(key, castAt + plan.ms - a.ms, performance.now());
          at(castAt, () => {
            const src = actor(b, side);
            const dst = actor(b, other(side));
            if (src) fx.move(src, move.m, dst ? reachPx(src, dst) : 0, undefined, dst ?? undefined);
          });
          if (mv && mv.power > 0) {
            at(castAt + Math.round(plan.ms * SHOT_HIT_AT), () => {
              const dst = actor(b, other(side));
              if (dst) fx.impact(dst, move.hitType, move.big);
            });
          }
        }
      } else if (act.kind === 'ult') {
        // 필살기 — 일반 모드 필살기 그대로. 앞 행동의 남은 연출은 지우고 시작
        fx.clear();
        // 상대 필살기를 내 필살기로 맞받아칠 수 있으면 창 (1초) 이 지난 뒤 컷인 — 컷인 띠가 맞받아치기 안내를 덮지 않게 (플레이 리뷰어)
        const startAt = side === 'foe' && b.me.ult >= 1 && b.me.hp > 0 ? TIMING.ultCounterWindowMs : 0;
        // 그림이 아직 0 크기 (나와라! 커지는 중) 면 0.05초씩 기다림 — 0.6초까지 못 쓰면 이모지로
        const tryUlt = (waited: number) => {
          const src = actor(b, side);
          const dst = actor(b, other(side));
          // 상대를 처음 맞힌 순간 피해를 넣음 — 붙잡기를 풀고 남은 연출은 흘러가게 둠 (연출이 다 끝난 뒤 숫자가 늦게 뜨지 않게)
          const onHit = () => {
            ultHitDone = true;
            releaseFx();
          };
          const total = fx.ult && src && dst ? fx.ult(src, dst, onHit) : 0;
          if (total > 0) {
            holdFx(key, total, performance.now(), FX_HOLD_ULT_MAX_MS);
            ultOn = true;
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
      // 끊긴 기술 — 날아가던 연출 · 늦은 타이머를 지움 (다 끝난 행동은 남은 불씨가 자연스럽게 사라지게 둠)
      if (pending.size > 0 && !ultOn) fx.clear();
      // 필살기가 맞히기 전에 다른 행동 (맞받아치기 힘대결) 으로 바뀌면 멈춤 — 맞힌 뒤면 남은 연출은 끝까지 (전투 화면이 사라지면 clear)
      if (ultOn && !ultHitDone) fx.stopUlt?.();
    };
    // 행동이 바뀔 때만 (같은 행동 동안 다시 그려져도 한 번)
  }, [key]);
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
      pokemonFx()?.clear();
      document.body.style.removeProperty('--pg-fx-top');
    },
    [],
  );
  return fx !== null && missed !== key;
}
