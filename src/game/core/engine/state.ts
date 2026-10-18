/**
 * 게임 상태 = 세이브 (저장함) + 진행 중 상태 (저장 안 함 — 랜덤 상태 · 남은 걸음 시간 · 지금 화면에서 하는 일).
 * 이 상태 하나가 웹뷰와 확장 사이를 오가고, 누가 계산하든 같은 함수(advance)로 앞으로 간다 (play.ts).
 */
import { TIMING } from '../balance';
import { STAGE_IDS, type Save, type StageId } from '../save';
import { readBattle, type BattleState } from './battle';
import type { BattleSummary } from './rewards';

/**
 * 스테이지에서 지금 하는 일 (S06):
 * - walk: 자동으로 걸음
 * - appear: 야생이 튀어나와 "나타났다!" (Space 선제공격 창) — 상대는 save.pendingEncounter
 * - battle: 전투 1:1 (engine/battle.ts) — 상대는 save.pendingEncounter, 전투 중 상태는 여기 (세이브에는 끝나고 한 번에)
 * - hold: 안 볼 때 (확장이 계산) 직접 봐야 할 순간 (이로치 흔적) 앞에서 멈춤 — 다시 보이면 이어 감 (U9)
 * - request: 길 위의 부탁 — 고를 때까지 기다림, 고르면 결과를 잠깐 보여 줌
 * - result: S12 전투 결과 (경험치 · 레벨업 · 돈 · 아이템 · 잡은 포켓몬) — 잠깐 보여 주고 (계속으로 넘김) 고를 게 있으면 choice, 없으면 walk
 * - choice: S23 새 기술 · S22 진화 — save.pendingChoices 맨 앞을 고를 때까지 기다림 (ms = 진화 연출 시간)
 * - end: 스테이지 끝 (클리어 카드는 단계 9)
 */
export type StageRuntime =
  | { phase: 'walk' }
  | { phase: 'appear'; ms: number; space: boolean; ambush: boolean; isNew: boolean }
  | { phase: 'battle'; battle: BattleState }
  | { phase: 'hold'; why: 'shiny' }
  | { phase: 'request'; at: number; number: number; result: RequestResult | null; ms: number }
  | { phase: 'result'; summary: BattleSummary; ms: number }
  | { phase: 'choice'; ms: number }
  | { phase: 'end' };

export const STAGE_PHASES = ['walk', 'appear', 'battle', 'request', 'end', 'hold', 'result', 'choice'] as const;

/** 부탁 결과 — 글 · 받은 것 (따로 둬서 좁은 패널에서도 받은 것이 안 잘리게) */
export interface RequestResult {
  ok: boolean;
  text: string;
  reward: string | null;
}

/** 짧은 알림 ("몬스터볼을 주웠다!") — ms 가 다 지나면 사라짐 */
export interface Toast {
  text: string;
  ms: number;
}

export interface RuntimeState {
  /** Rng 상태 */
  rngState: number;
  /** 아직 걸음이 되지 못한 시간 (ms) */
  stepAccMs: number;
  /** 시간 배속 — 1 (개발 창에서만 빨리 감기) */
  speed: number;
  /** null = 아직 안 정함 (처음 · 다시 불러온 직후) → 다음 걸음에 세이브를 보고 정함 */
  stage: StageRuntime | null;
  /** stage 가 어느 스테이지 것인지 — 장소가 바뀌면 (단계 9) 이전 스테이지의 진행 중 상태를 버림 */
  stageId: StageId | null;
  toast: Toast | null;
  /** 확장이 안 볼 때 계산 중 (웹뷰가 맡으면 false) — 이로치 흔적 앞에서 멈추고 알림 (U9) */
  headless: boolean;
}

export interface GameState {
  save: Save;
  runtime: RuntimeState;
}

/** 개발 창 빨리 감기 상한 */
export const MAX_SPEED = 60;

export function createGameState(save: Save, seed: number): GameState {
  return { save, runtime: { rngState: seed >>> 0, stepAccMs: 0, speed: 1, stage: null, stageId: null, toast: null, headless: false } };
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, min: number, max: number): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null);

const text = (v: unknown, max = 200): string | null => (typeof v === 'string' ? v.slice(0, max) : null);

/** S12 에 보여 줄 것 — 보여 주기만이라 모양만 봄 (이상하면 null → 결과 화면 없이 이어 감) */
function readSummary(raw: unknown): BattleSummary | null {
  if (!isObj(raw) || text(raw.title) === null || !Array.isArray(raw.exp) || !Array.isArray(raw.learned)) return null;
  const exp = raw.exp
    .slice(0, 6)
    .filter(isObj)
    .map((e) => ({ uid: text(e.uid, 20) ?? '', name: text(e.name, 30) ?? '', gain: num(e.gain, 0, 1e9) ?? 0, from: num(e.from, 1, 100) ?? 1, to: num(e.to, 1, 100) ?? 1 }));
  const learned = raw.learned
    .slice(0, 12)
    .filter(isObj)
    .map((l) => ({ name: text(l.name, 30) ?? '', move: text(l.move, 30) ?? '' }));
  const c = raw.caught;
  const caught = isObj(c) && text(c.name, 30) !== null && typeof c.toBox === 'boolean' ? { name: text(c.name, 30) as string, toBox: c.toBox } : null;
  return { title: text(raw.title) as string, exp, money: num(raw.money, 0, 1e9) ?? 0, item: text(raw.item, 30), caught, learned, choices: num(raw.choices, 0, 1000) ?? 0 };
}

/** 웹뷰에서 온 스테이지 진행 중 상태 — 모양이 이상하면 null (다음 걸음에 세이브를 보고 다시 정함) */
function readStage(raw: unknown): StageRuntime | null {
  if (!isObj(raw)) return null;
  const ms = num(raw.ms, 0, 1e9);
  switch (raw.phase) {
    case 'walk':
    case 'end':
      return { phase: raw.phase };
    case 'appear':
      if (ms === null || typeof raw.space !== 'boolean' || typeof raw.ambush !== 'boolean' || typeof raw.isNew !== 'boolean') return null;
      return { phase: 'appear', ms, space: raw.space, ambush: raw.ambush, isNew: raw.isNew };
    case 'battle': {
      const battle = readBattle(raw.battle);
      return battle ? { phase: 'battle', battle } : null;
    }
    case 'hold':
      return raw.why === 'shiny' ? { phase: 'hold', why: 'shiny' } : null;
    case 'request': {
      const at = num(raw.at, 0, 1);
      const n = num(raw.number, 0, 100);
      const r = raw.result;
      const result =
        r === null
          ? null
          : isObj(r) && typeof r.ok === 'boolean' && typeof r.text === 'string' && (r.reward === null || typeof r.reward === 'string')
            ? { ok: r.ok, text: r.text.slice(0, 300), reward: r.reward === null ? null : (r.reward as string).slice(0, 100) }
            : undefined;
      if (ms === null || at === null || n === null || result === undefined) return null;
      return { phase: 'request', at, number: Math.floor(n), result, ms };
    }
    case 'result': {
      const summary = readSummary(raw.summary);
      return ms !== null && summary ? { phase: 'result', summary, ms } : null;
    }
    case 'choice':
      return ms !== null ? { phase: 'choice', ms } : null;
    default:
      return null;
  }
}

/** 다른 쪽(웹뷰)에서 온 진행 중 상태 — 이상한 값은 새 시드 · 기본값으로 */
export function readRuntime(raw: unknown, fallbackSeed: number, stepMs: number = TIMING.simStepMs): RuntimeState {
  const r = isObj(raw) ? raw : {};
  const rng = r.rngState;
  const acc = r.stepAccMs;
  const toast = isObj(r.toast) && typeof r.toast.text === 'string' && num(r.toast.ms, 0, 60_000) !== null ? { text: r.toast.text.slice(0, 300), ms: r.toast.ms as number } : null;
  return {
    rngState: typeof rng === 'number' && Number.isInteger(rng) && rng >= 0 && rng <= 0xffffffff ? rng : fallbackSeed >>> 0,
    stepAccMs: typeof acc === 'number' && Number.isFinite(acc) && acc >= 0 && acc < stepMs ? acc : 0,
    speed: num(r.speed, 1, MAX_SPEED) ?? 1,
    stage: readStage(r.stage),
    stageId: (STAGE_IDS as readonly unknown[]).includes(r.stageId) ? (r.stageId as StageId) : null,
    toast,
    headless: false, // 웹뷰에서 온 상태는 늘 보이는 쪽 — 확장이 넘겨받을 때 다시 켬
  };
}

/**
 * 패널이 안 보일 때도 계산을 이어 할지 (mvp-spec 3.3 U2).
 * 자동 전투가 꺼져 있으면 게임이 멈추고, 켜져 있으면 계속 (그림은 안 그리고 계산만).
 */
export function shouldRunWhenHidden(state: GameState): boolean {
  return state.save.settings.autoBattle;
}
