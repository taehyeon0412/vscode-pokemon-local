/**
 * 게임 한 걸음 · 입력 — 보일 때(웹뷰) · 안 보일 때(확장) 같은 함수.
 *
 * S06 스테이지 (mvp-spec 3.2): 자동으로 걷다가 길에 놓인 자리를 지나면
 *   떨어진 아이템 → 바로 줍고 계속 걸음 · 야생 → 튀어나옴 (Space · 클릭 선제공격 창) → 전투 · 부탁 → 고를 때까지 기다림
 * 상태는 늘 새 객체로 만듦 (그 자리에서 고치지 않음 — 확장 ↔ 웹뷰 · 저장소가 같은 객체를 나눠 써도 안 바뀌게).
 */
import { BALANCE, TIMING } from '../balance';
import { ambushChance, createWild, pickupAt, resolveStart } from '../rules/encounter';
import { itemName, requestAt, resolveRequest } from '../rules/request';
import { spotBetween, spotRng, stageLayout, walkDelta, type StageLayout } from '../rules/stage';
import { statsOf } from '../rules/stats';
import type { Save, StageId, StageProgress } from '../save';
import { withJosa } from '../text';
import { speciesOf } from '../../data';
import { Rng } from './rng';
import { MAX_SPEED, type GameState, type RuntimeState, type StageRuntime } from './state';
import { takeSteps } from './step';

/** 바로 저장해야 하는 일 (mvp-spec 3.1) — 웹뷰는 save-now 로, 확장은 바로 씀 */
export type SaveSignal = 'catch' | 'battle-end' | 'stage-clear';

/** 사용자 입력 (웹뷰에서만 옴) */
export type GameInput =
  /** 선제공격 — Space 또는 길 (패널) 클릭 */
  | { kind: 'space' }
  | { kind: 'request'; help: boolean }
  /** 스테이지 끝에서 처음부터 다시 걷기 — 클리어 카드 (단계 9) 전까지 임시. 새 시드로 (같은 아이템 · 부탁이 다시 나오지 않게) */
  | { kind: 'restart-stage' };

/** 부탁 자리에 멈춰 있을 때 진행 % 를 자리 바로 앞에 둠 — 고르기 전에 꺼도 다시 켜면 그 부탁부터 */
const BEFORE_SPOT = 1e-7;

interface StepOut {
  state: GameState;
  save: SaveSignal | null;
}

/** 나가는 포켓몬 = 쓰러지지 않은 첫 포켓몬 (mvp-spec 3.3) — 기습 확률의 "내 스피드" */
export function leadSpeed(save: Save): number {
  for (const uid of save.party) {
    const m = save.monsters[uid];
    const s = m ? speciesOf(m.species) : undefined;
    if (m && s && m.hp > 0) return statsOf(s.base, m.ivs, m.points, m.level).speed;
  }
  return 0;
}

const nameOf = (dex: number) => speciesOf(dex)?.name.ko ?? '???';

/** 처음 들어온 스테이지면 시드를 뽑고, 병원 · 상점 자리를 세이브에도 적어 둠 (그 뒤로는 세이브 쪽이 기준) */
function ensureStage(save: Save, rt: RuntimeState, id: StageId): { save: Save; rt: RuntimeState; prog: StageProgress; layout: StageLayout } {
  let prog = save.stages[id];
  let next = rt;
  if (!prog) {
    const rng = new Rng(rt.rngState);
    prog = { seed: rng.int(0, 0xffffffff), progress: 0, cleared: false, defeatedTrainers: [], facilities: [] };
    next = { ...rt, rngState: rng.state };
  }
  if (prog.facilities.length === 0) {
    const fresh = stageLayout(id, prog.seed);
    if (fresh.facilities.length > 0) prog = { ...prog, facilities: fresh.facilities.map((f) => ({ ...f })) };
  }
  const layout = stageLayout(id, prog.seed, prog.facilities);
  const out = prog === save.stages[id] ? save : { ...save, stages: { ...save.stages, [id]: prog } };
  return { save: out, rt: next, prog, layout };
}

function withProgress(save: Save, id: StageId, progress: number): Save {
  const prog = save.stages[id];
  if (!prog) return save;
  return { ...save, stages: { ...save.stages, [id]: { ...prog, progress } } };
}

/**
 * 다른 쪽에서 온 (또는 지난) 진행 중 상태가 지금 세이브와 맞는지 — 안 맞으면 null (세이브를 보고 다시 정함).
 * 다른 스테이지 것 · 상대 없는 전투 · 길에 없는 부탁 자리는 버림
 */
function checkedStage(rt: RuntimeState, save: Save, id: StageId, layout: StageLayout, progress: number): StageRuntime | null {
  const st = rt.stage;
  if (!st || rt.stageId !== id) return null;
  if ((st.phase === 'appear' || st.phase === 'battle') && save.pendingEncounter?.kind !== 'wild') return null;
  if (st.phase === 'request') {
    const spots = layout.spots.filter((s) => s.kind === 'request');
    const n = spots.findIndex((s) => s.at === st.at);
    if (n < 0 || n !== st.number || progress > st.at) return null;
  }
  return st;
}

function stageStep(save0: Save, rt0: RuntimeState, id: StageId, stepMs: number): { save: Save; rt: RuntimeState; signal: SaveSignal | null } {
  const ensured = ensureStage(save0, rt0, id);
  let save = ensured.save;
  let rt = ensured.rt;
  const { prog, layout } = ensured;
  let stage: StageRuntime =
    checkedStage(rt, save, id, layout, prog.progress) ??
    (save.pendingEncounter ? { phase: 'battle', ms: 0 } : prog.progress >= 1 ? { phase: 'end' } : { phase: 'walk' });
  let signal: SaveSignal | null = null;

  switch (stage.phase) {
    case 'walk': {
      const from = prog.progress;
      const to = Math.min(1, from + walkDelta(stepMs));
      const spot = spotBetween(layout, from, to);
      if (!spot) {
        save = withProgress(save, id, to);
        if (to >= 1) stage = { phase: 'end' };
        break;
      }
      if (spot.kind === 'item') {
        const p = pickupAt(id, prog.seed, spot);
        if (p.item) save = { ...save, bag: { ...save.bag, [p.item]: (save.bag[p.item] ?? 0) + 1 } };
        if (p.money) save = { ...save, money: save.money + p.money };
        save = withProgress(save, id, spot.at);
        const what = p.item ? itemName(p.item) : `${p.money ?? 0}원`;
        rt = { ...rt, toast: { text: `✨ ${withJosa(what, '을/를')} 주웠다!`, ms: TIMING.toastMs } };
      } else if (spot.kind === 'wild') {
        const wild = createWild(id, prog.seed, spot);
        const enemySpeed = statsOf(speciesOf(wild.species)!.base, wild.ivs, wild.points, wild.level).speed;
        const ambush = spotRng(prog.seed, spot.index, 6).chance(ambushChance(enemySpeed, leadSpeed(save)));
        const isNew = !save.dex.seen.includes(wild.species);
        save = {
          ...withProgress(save, id, spot.at),
          dex: isNew ? { ...save.dex, seen: [...save.dex.seen, wild.species] } : save.dex,
          pendingEncounter: { kind: 'wild', monster: wild, start: ambush ? 'ambush' : 'normal' },
        };
        stage = { phase: 'appear', ms: 0, space: false, ambush, isNew };
      } else {
        const number = layout.spots.filter((s) => s.kind === 'request' && s.at < spot.at).length;
        save = withProgress(save, id, Math.max(from, spot.at - BEFORE_SPOT));
        stage = { phase: 'request', at: spot.at, number, result: null, ms: 0 };
      }
      break;
    }
    case 'appear': {
      const ms = stage.ms + stepMs;
      if (ms < TIMING.appearMs) {
        stage = { ...stage, ms };
        break;
      }
      const pending = save.pendingEncounter;
      if (pending?.kind === 'wild') save = { ...save, pendingEncounter: { ...pending, start: resolveStart(stage.ambush, stage.space) } };
      stage = { phase: 'battle', ms: 0 };
      break;
    }
    case 'battle': {
      const ms = stage.ms + stepMs;
      if (ms < TIMING.battlePlaceholderMs) {
        stage = { phase: 'battle', ms };
        break;
      }
      // 전투는 단계 5 — 그 전까지는 이긴 것으로 (임시)
      const pending = save.pendingEncounter;
      const name = pending?.kind === 'wild' ? nameOf(pending.monster.species) : '상대';
      save = { ...save, pendingEncounter: null };
      rt = { ...rt, toast: { text: `야생 ${withJosa(name, '을/를')} 쓰러뜨렸다! (임시 — 전투는 다음 단계)`, ms: TIMING.toastMs } };
      stage = { phase: 'walk' };
      signal = 'battle-end';
      break;
    }
    case 'request': {
      if (!stage.result) break; // 고를 때까지 기다림 (고른 순간 진행 % 는 자리로 — applyInput)
      const ms = stage.ms + stepMs;
      stage = ms < TIMING.requestResultMs ? { ...stage, ms } : { phase: 'walk' };
      break;
    }
    case 'end':
      break;
  }
  return { save, rt: { ...rt, stage, stageId: id }, signal };
}

/** 걸음 하나 */
export function step(state: GameState, stepMs: number): StepOut {
  let save: Save = { ...state.save, playTimeMs: state.save.playTimeMs + stepMs };
  let rt: RuntimeState = state.runtime;
  if (rt.toast) rt = { ...rt, toast: rt.toast.ms > stepMs ? { ...rt.toast, ms: rt.toast.ms - stepMs } : null };
  let signal: SaveSignal | null = null;
  if (save.location.screen === 'stage') {
    const r = stageStep(save, rt, save.location.stageId, stepMs);
    save = r.save;
    rt = r.rt;
    signal = r.signal;
  } else if (rt.stage) {
    rt = { ...rt, stage: null, stageId: null };
  }
  return { state: { save, runtime: rt }, save: signal };
}

/** 지난 시간만큼 앞으로 (배속 반영) — 바로 저장할 일이 있었으면 saves 에 */
export function advance(state: GameState, elapsedMs: number, stepMs: number = TIMING.simStepMs): { state: GameState; steps: number; saves: SaveSignal[] } {
  const speed = Math.min(MAX_SPEED, Math.max(1, state.runtime.speed || 1));
  const { steps, accMs } = takeSteps(state.runtime.stepAccMs, elapsedMs * speed, stepMs);
  if (steps === 0 && accMs === state.runtime.stepAccMs) return { state, steps, saves: [] };
  let next = state;
  const saves = new Set<SaveSignal>();
  for (let i = 0; i < steps; i++) {
    const r = step(next, stepMs);
    next = r.state;
    if (r.save) saves.add(r.save);
  }
  return { state: { ...next, runtime: { ...next.runtime, stepAccMs: accMs } }, steps, saves: [...saves] };
}

/** 사람이 골라야 앞으로 가는 순간 (부탁 · 스테이지 끝) — 안 볼 때 확장은 계산 · 저장을 멈춤 */
export function isWaitingForInput(state: GameState): boolean {
  const st = state.runtime.stage;
  return (st?.phase === 'request' && !st.result) || st?.phase === 'end';
}

/** 입력 — 지금 받을 수 없는 입력이면 상태를 그대로 돌려줌 */
export function applyInput(state: GameState, input: GameInput): GameState {
  const stage = state.runtime.stage;
  const save = state.save;
  switch (input.kind) {
    case 'space':
      if (stage?.phase !== 'appear' || stage.space || stage.ms > BALANCE.preemptiveWindowMs) return state;
      return { ...state, runtime: { ...state.runtime, stage: { ...stage, space: true } } };
    case 'request': {
      if (stage?.phase !== 'request' || stage.result || save.location.screen !== 'stage') return state;
      const id = save.location.stageId;
      const prog = save.stages[id];
      if (!prog) return state;
      // 고른 순간 진행 % 를 그 자리로 — 결과를 보는 동안 꺼도 같은 부탁이 다시 나오지 않게 (보상 두 번 X)
      if (!input.help) {
        return {
          save: withProgress(save, id, stage.at),
          runtime: { ...state.runtime, stage: { ...stage, result: { ok: false, text: '그냥 지나갔다', reward: null }, ms: TIMING.requestResultMs - TIMING.requestPassMs } },
        };
      }
      const rng = new Rng(state.runtime.rngState);
      const outcome = resolveRequest(save, requestAt(prog.seed, stage.number), rng);
      return {
        save: withProgress(outcome.save, id, stage.at),
        runtime: { ...state.runtime, rngState: rng.state, stage: { ...stage, result: { ok: outcome.ok, text: outcome.text, reward: outcome.reward }, ms: 0 } },
      };
    }
    case 'restart-stage': {
      if (stage?.phase !== 'end' || save.location.screen !== 'stage') return state;
      const id = save.location.stageId;
      const prog = save.stages[id];
      if (!prog) return state;
      const rng = new Rng(state.runtime.rngState);
      const fresh: StageProgress = { ...prog, seed: rng.int(0, 0xffffffff), progress: 0, facilities: [] };
      return { save: { ...save, stages: { ...save.stages, [id]: fresh } }, runtime: { ...state.runtime, rngState: rng.state, stage: { phase: 'walk' } } };
    }
  }
}

/** 개발 창 빨리 감기 (1 ~ MAX_SPEED) */
export function withSpeed(state: GameState, speed: number): GameState {
  const s = Math.min(MAX_SPEED, Math.max(1, Math.round(speed)));
  return { ...state, runtime: { ...state.runtime, speed: s } };
}
