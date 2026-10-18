/**
 * 게임 한 걸음 · 입력 — 보일 때(웹뷰) · 안 보일 때(확장) 같은 함수.
 *
 * S06 스테이지 (mvp-spec 3.2): 자동으로 걷다가 길에 놓인 자리를 지나면
 *   떨어진 아이템 → 바로 줍고 계속 걸음 · 야생 → 튀어나옴 (Space · 클릭 선제공격 창) → 전투 (engine/battle.ts) · 부탁 → 고를 때까지 기다림
 *   트레이너 → 멈추고 "!" → "승부다!" → 1:1 토너먼트 · 병원 · 상점 → [들어가기] [지나가기] (5초 · 안 볼 때는 바로 지나감)
 *   끝 → S24 클리어 카드 (1-3 은 S16 체육관 대기실로) · 지면 → S17 (마지막 병원 앞에서 다시)
 * S16 체육관: 대기실 → 관장과 1:1 토너먼트 → 처음 이기면 배지 · MVP 끝 카드
 * 안 볼 때 (확장이 계산) 이로치 흔적 · 부탁 앞에서는 멈추고 알림 신호 (U9)
 * 상태는 늘 새 객체로 만듦 (그 자리에서 고치지 않음 — 확장 ↔ 웹뷰 · 저장소가 같은 객체를 나눠 써도 안 바뀌게).
 */
import { BALANCE, TIMING } from '../balance';
import { buy, healTeam, isShopItem, moveInTeam, spendPoint, swapWithBox, toBox, useFieldItem, walkRegen } from '../rules/bag';
import { ambushChance, createWild, pickupAt, planWild, resolveStart, wildKey } from '../rules/encounter';
import { itemName, requestAt, resolveRequest } from '../rules/request';
import { spotBetween, spotRng, stageCode, stageLayout, trainerId, walkDelta, type Spot, type StageLayout } from '../rules/stage';
import { statsOf } from '../rules/stats';
import { aliveCount, GYM_LEADER, leaderTeam, trainerInfo, trainerNumber, trainerTeam } from '../rules/trainer';
import { RUN_SEEN_MAX, STAGE_IDS, type FacilitySpot, type ItemId, type Save, type StageId, type StageProgress, type StageRun, type StatKey } from '../save';
import { withJosa } from '../text';
import { moveOf, speciesOf } from '../../data';
import { applyBattleResult, battleDone, battleInput, battleStep, battleWaiting, firstAlive, startBattle, startTrainerBattle, switchable, type BattleInput, type BattleState } from './battle';
import { battleRewards, clearBonusExp, clearStage, defeatPenalty, FOREST_BADGE, resolveEvolve, resolveLearn } from './rewards';
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
  /** 전투 메뉴 · 필살기 · 다음 포켓몬 (Space 는 위 'space' 로 — 힘대결 연타 · 맞받아치기) */
  | { kind: 'battle'; input: BattleInput }
  /** S09 ⑫ 자동 전투 스위치 — 세이브 설정에 (다음 전투에도 그대로) */
  | { kind: 'auto-battle'; on: boolean }
  /** S12 계속 (Space · Enter · 클릭) */
  | { kind: 'result-continue' }
  /** S23 — 바꿀 칸 (null = 배우지 않기) */
  | { kind: 'learn'; replace: number | null; uid?: string; moveId?: number }
  /** S22 — 남길 지금 기술 (진화 연출이 끝난 뒤) · 멈추기 (Esc, 연출 중) · 빨리 넘기기 (Space) */
  | { kind: 'evolve'; keep: number[]; uid?: string; to?: number }
  | { kind: 'evolve-cancel'; uid?: string; to?: number }
  | { kind: 'evolve-skip' }
  /** S06 ⑥ 병원 · 상점 앞 — [들어가기] · [지나가기] · 안에서 [나가기] */
  | { kind: 'facility'; enter: boolean }
  | { kind: 'facility-leave' }
  /** S13 ① 회복 (병원 · 체육관 대기실) · S14 사기 (상점 · 대기실) */
  | { kind: 'heal' }
  | { kind: 'buy'; item: ItemId }
  /** S18 — 팀 순서 · 보관함과 바꾸기 (병원 · 대기실 · 스테이지 시작 전만) · 남은 포인트 */
  | { kind: 'team-move'; uid: string; dir: -1 | 1 }
  | { kind: 'team-swap'; boxUid: string; partyUid: string | null }
  | { kind: 'team-to-box'; uid: string }
  | { kind: 'points'; uid: string; stat: StatKey }
  /** S19 — 전투 밖에서 아이템 (돌 · 연결의끈은 S22 로) */
  | { kind: 'use-item'; item: ItemId; uid: string }
  /** S20 ③ 알림 (U9) */
  | { kind: 'notifications'; on: boolean }
  /** S17 ② 다시 시작 */
  | { kind: 'defeat-continue' }
  /** S07 · S24 · S16 ③ — 스테이지 · 체육관으로 */
  | { kind: 'travel'; to: StageId | 'gym' }
  /** S16 ② 관장에게 도전 · MVP 끝 카드 다음 */
  | { kind: 'challenge' }
  | { kind: 'badge-continue' };

/**
 * 안 볼 때 직접 해야 하는 순간 — 확장이 VS Code 알림 (U9, 설정에서 끔).
 * 이로치 · 부탁 · 고르기 · 체육관 도착 (mvp-spec 3.3) + 클리어 카드 · 패배 (멈춰서 기다리는 곳이라 [제안] — 돌아와서 "이미 멈춰 있었네" 가 안 되게)
 */
export type GameNotice = 'shiny' | 'request' | 'choice' | 'gym' | 'clear' | 'defeat';

/** 부탁 · 병원 앞에 멈춰 있을 때 진행 % 를 자리 바로 앞에 둠 — 고르기 전에 꺼도 다시 켜면 그 자리부터 */
const BEFORE_SPOT = 1e-7;

interface StepOut {
  state: GameState;
  save: SaveSignal | null;
  notice: GameNotice | null;
}

/** 나가는 포켓몬 = 쓰러지지 않은 첫 포켓몬 (mvp-spec 3.3) — 기습 확률의 "내 스피드" */
export function leadSpeed(save: Save): number {
  const m = firstAlive(save);
  const s = m ? speciesOf(m.species) : undefined;
  return m && s ? statsOf(s.base, m.ivs, m.points, m.level).speed : 0;
}

const newSeed = (rng: Rng) => rng.int(0, 0xffffffff);

/** 새 판 — 새 시드 (떨어진 아이템 · 부탁 · 야생이 새로, #62 2026-10-18 태현 님) · 병원 · 상점 자리 · 이긴 트레이너 · 깬 표시는 그대로 */
function freshRun(prev: StageProgress | undefined, seed: number, playTimeMs: number): StageProgress {
  return { seed, progress: 0, cleared: prev?.cleared ?? false, defeatedTrainers: prev?.defeatedTrainers ?? [], facilities: prev?.facilities ?? [], run: { startMs: playTimeMs, caught: 0, trainers: 0, seen: [], reach: 0, retries: 0 } };
}

/** 처음 들어온 스테이지면 시드를 뽑고, 병원 · 상점 자리를 세이브에도 적어 둠 (그 뒤로는 세이브 쪽이 기준) */
function ensureStage(save: Save, rt: RuntimeState, id: StageId): { save: Save; rt: RuntimeState; prog: StageProgress; layout: StageLayout } {
  let prog = save.stages[id];
  let next = rt;
  if (!prog) {
    const rng = new Rng(rt.rngState);
    prog = freshRun(undefined, newSeed(rng), save.playTimeMs);
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

function withStage(save: Save, id: StageId, change: (p: StageProgress) => StageProgress): Save {
  const prog = save.stages[id];
  return prog ? { ...save, stages: { ...save.stages, [id]: change(prog) } } : save;
}
const withProgress = (save: Save, id: StageId, progress: number) => withStage(save, id, (p) => ({ ...p, progress }));
const withRun = (save: Save, id: StageId, change: (r: StageRun) => StageRun) => withStage(save, id, (p) => ({ ...p, run: change(p.run) }));

/** 트레이너 전투 — 데리고 나오는 포켓몬은 판 시드 · 번호 · 내 살아 있는 포켓몬 수로 (껐다 켜면 같은 상대와 처음부터) */
function trainerBattle(save: Save, id: StageId, prog: StageProgress, n: number): BattleState {
  return startTrainerBattle(save, trainerTeam(id, prog.seed, n, aliveCount(save)), 'trainer', trainerInfo(id, n).name);
}

function leaderBattle(save: Save): BattleState {
  return startTrainerBattle(save, leaderTeam(), 'gym', GYM_LEADER.name);
}

/** 다시 안 나오는 자리 — 이긴 트레이너 · 졌다 다시 걸을 때 이미 지나간 떨어진 아이템 · 부탁 (주웠고 · 골랐음) */
const beaten = (prog: StageProgress, id: StageId, s: Spot) =>
  (s.kind === 'trainer' && prog.defeatedTrainers.includes(trainerId(id, s.trainer ?? 0))) || ((s.kind === 'item' || s.kind === 'request') && s.at <= prog.run.reach);

/** 이번 걸음에 지나친 첫 자리 · 병원 · 상점 (from < at ≤ to) — 다시 안 나오는 자리는 건너뜀 */
function nextEvent(layout: StageLayout, prog: StageProgress, id: StageId, from: number, to: number): { spot: Spot } | { facility: FacilitySpot } | null {
  let spot: Spot | null = null;
  let f = from;
  while (!spot) {
    const s = spotBetween(layout, f, to);
    if (!s) break;
    if (beaten(prog, id, s)) f = s.at;
    else spot = s;
  }
  const facility = layout.facilities.find((x) => x.at > from && x.at <= to) ?? null;
  if (facility && (!spot || facility.at <= spot.at)) return { facility };
  return spot ? { spot } : null;
}

/**
 * 다른 쪽에서 온 (또는 지난) 진행 중 상태가 지금 세이브와 맞는지 — 안 맞으면 null (세이브를 보고 다시 정함).
 * 다른 스테이지 것 · 상대 없는 전투 · 길에 없는 부탁 · 병원 자리는 버림
 */
function checkedStage(rt: RuntimeState, save: Save, id: StageId, layout: StageLayout, progress: number): StageRuntime | null {
  const st = rt.stage;
  if (!st || rt.stageId !== id) return null;
  const pending = save.pendingEncounter;
  if (st.phase === 'appear' && pending?.kind !== 'wild') return null;
  if (st.phase === 'trainer' && (pending?.kind !== 'trainer' || trainerNumber(pending.trainerId) !== st.n)) return null;
  if (st.phase === 'battle' && (st.battle.kind === 'gym' || pending?.kind !== st.battle.kind)) return null;
  // 고를 것 (S23 · S22) 이 남았는데 걷기 · 전투 상태가 오면 버림 → 고르기부터 (고르기를 둔 채 걷지 않게)
  if (save.pendingChoices.length > 0 && st.phase !== 'result' && st.phase !== 'choice') return null;
  switch (st.phase) {
    case 'request': {
      const spots = layout.spots.filter((s) => s.kind === 'request');
      const n = spots.findIndex((s) => s.at === st.at);
      return n < 0 || n !== st.number || progress > st.at ? null : st;
    }
    case 'facility':
      return layout.facilities.some((f) => f.kind === st.kind && f.at === st.at) && progress <= st.at ? st : null;
    case 'clear':
      return progress >= 1 ? st : null;
    case 'lobby':
    case 'badge':
      return null;
    default:
      return st;
  }
}

/** 진행 중 상태가 없을 때 세이브를 보고 정함 — 고르다 껐으면 그 고르기부터 · 전투 중에 껐다 켜면 그 전투를 처음부터 (mvp-spec 9장) */
function defaultStage(save: Save, id: StageId, prog: StageProgress): StageRuntime {
  const p = save.pendingEncounter;
  if (save.pendingChoices.length > 0) return { phase: 'choice', ms: 0 };
  if (p?.kind === 'wild') return { phase: 'battle', battle: startBattle(save, p.monster, p.start) };
  if (p?.kind === 'trainer' && p.stageId === id) return { phase: 'battle', battle: trainerBattle(save, id, prog, trainerNumber(p.trainerId)) };
  return prog.progress >= 1 ? { phase: 'clear' } : { phase: 'walk' };
}

/** 안 볼 때 (확장이 계산) 눈앞에 이로치가 나와 있으면 (튀어나옴 · 전투 중에 사람이 떠남) — 자동 전투로 쓰러뜨리지 않고 다시 볼 때까지 기다림 (U9) */
function shinyWhileAway(save: Save, rt: RuntimeState, stage: StageRuntime | null): boolean {
  if (!rt.headless || !stage) return false;
  if (stage.phase === 'battle') return stage.battle.kind === 'wild' && stage.battle.foe.shiny;
  return stage.phase === 'appear' && save.pendingEncounter?.kind === 'wild' && save.pendingEncounter.monster.shiny;
}

/** 병원 · 상점을 지나감 (들어가도 · 그냥 지나가도) — 병원이면 "마지막으로 지나간 병원" (S17) */
function passFacility(save: Save, id: StageId, kind: FacilitySpot['kind'], at: number): Save {
  const s = withProgress(save, id, at);
  return kind === 'hospital' ? { ...s, lastHospital: { stageId: id, at } } : s;
}

/**
 * S17 — 스테이지에서 짐: 돈 −10% · 팀 회복 · 마지막으로 지나간 병원 앞 (없으면 처음).
 * 길 (시드) 은 그대로 — 이긴 트레이너는 이긴 채로 · 병원 · 상점 자리 그대로 · 야생만 다시 뽑음 (retries) · 이미 지나간 아이템 · 부탁은 안 나옴 (reach)
 */
function stageDefeat(save0: Save, id: StageId): { save: Save; lost: number } {
  const d = defeatPenalty(save0, false);
  const hospital = d.save.lastHospital?.stageId === id ? d.save.lastHospital.at : null;
  const save = withStage(d.save, id, (p) => ({
    ...p,
    progress: hospital !== null ? Math.max(0, hospital - BEFORE_SPOT) : 0,
    run: { ...p.run, reach: Math.max(p.run.reach, p.progress), retries: p.run.retries + 1 },
  }));
  return { save, lost: d.lost };
}

function stageStep(save0: Save, rt0: RuntimeState, id: StageId, stepMs: number): { save: Save; rt: RuntimeState; signal: SaveSignal | null; notice: GameNotice | null } {
  const ensured = ensureStage(save0, rt0, id);
  let save = ensured.save;
  let rt = ensured.rt;
  const { prog, layout } = ensured;
  let stage: StageRuntime = checkedStage(rt, save, id, layout, prog.progress) ?? defaultStage(save, id, prog);
  let signal: SaveSignal | null = null;
  let notice: GameNotice | null = null;
  // 안 볼 때 고를 것이 남은 세이브로 시작했으면 (껐다 켬 등) 한 번 알림 — 그 뒤로는 기다리는 중이라 확장 계산이 멈춤
  if (rt.headless && stage.phase === 'choice' && rt.stage?.phase !== 'choice' && save.pendingChoices.length > 0) notice = 'choice';
  if (shinyWhileAway(save, rt, stage)) return { save, rt: { ...rt, stage, stageId: id }, signal, notice };
  const walking = stage.phase === 'walk';

  switch (stage.phase) {
    case 'walk': {
      const from = prog.progress;
      const to = Math.min(1, from + walkDelta(stepMs));
      const ev = nextEvent(layout, prog, id, from, to);
      if (!ev) {
        save = withProgress(save, id, to);
        if (to >= 1) return finishStage(save, rt, id);
        break;
      }
      if ('facility' in ev) {
        const f = ev.facility;
        // 안 볼 때는 바로 지나감 (2026-10-18 태현 님) · 보이면 앞에서 멈추고 [들어가기] [지나가기]
        if (rt.headless) save = passFacility(save, id, f.kind, f.at);
        else {
          save = withProgress(save, id, Math.max(from, f.at - BEFORE_SPOT));
          stage = { phase: 'facility', kind: f.kind, at: f.at, ms: 0, inside: false };
        }
        break;
      }
      const spot = ev.spot;
      if (spot.kind === 'item') {
        const p = pickupAt(id, prog.seed, spot);
        if (p.item) save = { ...save, bag: { ...save.bag, [p.item]: (save.bag[p.item] ?? 0) + 1 } };
        if (p.money) save = { ...save, money: save.money + p.money };
        save = withProgress(save, id, spot.at);
        const what = p.item ? itemName(p.item) : `${p.money ?? 0}원`;
        rt = { ...rt, toast: { text: `✨ ${withJosa(what, '을/를')} 주웠다!`, ms: TIMING.toastMs } };
      } else if (spot.kind === 'wild' && rt.headless && planWild(id, prog.seed, spot, prog.run.retries).shiny) {
        // 안 볼 때 이로치 흔적 — 바로 앞에서 멈추고 알림 (U9), 다시 보이면 이어 감
        save = withProgress(save, id, Math.max(from, spot.at - BEFORE_SPOT));
        stage = { phase: 'hold', why: 'shiny' };
        notice = 'shiny';
      } else if (spot.kind === 'wild') {
        const wild = createWild(id, prog.seed, spot, prog.run.retries);
        const enemySpeed = statsOf(speciesOf(wild.species)!.base, wild.ivs, wild.points, wild.level).speed;
        const ambush = spotRng(prog.seed, wildKey(spot, prog.run.retries), 6).chance(ambushChance(enemySpeed, leadSpeed(save)));
        const isNew = !save.dex.seen.includes(wild.species);
        save = {
          ...withProgress(save, id, spot.at),
          dex: isNew ? { ...save.dex, seen: [...save.dex.seen, wild.species] } : save.dex,
          pendingEncounter: { kind: 'wild', monster: wild, start: ambush ? 'ambush' : 'normal' },
        };
        // S24 "새로 만난 포켓몬" — 이 판에서 처음 만난 종 몇 마리
        if (isNew) save = withRun(save, id, (r) => (r.seen.length < RUN_SEEN_MAX ? { ...r, seen: [...r.seen, wild.species] } : r));
        stage = { phase: 'appear', ms: 0, space: false, ambush, isNew };
      } else if (spot.kind === 'trainer') {
        // 트레이너 — 멈추고 "!" → "승부다!" (자동 전투여도 멈추지 않고 그대로 전투로)
        const n = spot.trainer ?? 0;
        save = { ...withProgress(save, id, spot.at), pendingEncounter: { kind: 'trainer', trainerId: trainerId(id, n), stageId: id } };
        stage = { phase: 'trainer', n, ms: 0 };
      } else {
        const number = layout.spots.filter((s) => s.kind === 'request' && s.at < spot.at).length;
        save = withProgress(save, id, Math.max(from, spot.at - BEFORE_SPOT));
        stage = { phase: 'request', at: spot.at, number, result: null, ms: 0 };
        if (rt.headless) notice = 'request';
      }
      break;
    }
    case 'hold':
      if (!rt.headless) stage = { phase: 'walk' }; // 보이면 그 흔적으로 걸어감
      break;
    case 'facility': {
      if (stage.inside) break; // 병원 · 상점 안 — [나가기] 를 기다림
      const ms = stage.ms + stepMs;
      if (rt.headless || ms >= TIMING.facilityPromptMs) {
        save = passFacility(save, id, stage.kind, stage.at);
        stage = { phase: 'walk' };
      } else stage = { ...stage, ms };
      break;
    }
    case 'appear': {
      const ms = stage.ms + stepMs;
      if (ms < TIMING.appearMs) {
        stage = { ...stage, ms };
        break;
      }
      const pending = save.pendingEncounter;
      if (pending?.kind !== 'wild') {
        stage = { phase: 'walk' };
        break;
      }
      const start = resolveStart(stage.ambush, stage.space);
      save = { ...save, pendingEncounter: { ...pending, start } };
      stage = { phase: 'battle', battle: startBattle(save, pending.monster, start) };
      break;
    }
    case 'trainer': {
      const ms = stage.ms + stepMs;
      if (ms < TIMING.trainerMeetMs) {
        stage = { ...stage, ms };
        break;
      }
      const p = save.pendingEncounter;
      stage = p?.kind === 'trainer' ? { phase: 'battle', battle: trainerBattle(save, id, prog, trainerNumber(p.trainerId)) } : { phase: 'walk' };
      break;
    }
    case 'battle': {
      const rng = new Rng(rt.rngState);
      const battle = battleStep(stage.battle, save, stepMs, rng, { auto: save.settings.autoBattle, away: rt.headless });
      rt = { ...rt, rngState: rng.state };
      if (!battleDone(battle)) {
        stage = { phase: 'battle', battle };
        break;
      }
      // 이겼어도 (반동 · 독으로) 내 팀이 다 쓰러졌으면 진 것과 같이
      const wiped = battle.me.hp <= 0 && switchable(battle, save).length === 0;
      const before = save;
      save = applyBattleResult(save, battle);
      signal = battle.result === 'catch' ? 'catch' : 'battle-end';
      if ((battle.result === 'win' || battle.result === 'catch') && !wiped) {
        // S12 전투 결과 — 경험치 · 레벨업 · 돈 · 아이템 · 잡은 포켓몬 (세이브에 바로), 고를 것은 pendingChoices
        const wild = before.pendingEncounter?.kind === 'wild' ? before.pendingEncounter.monster : null;
        const r = battleRewards(save, battle, wild, id, rng);
        save = r.save;
        if (battle.result === 'catch') save = withRun(save, id, (run) => ({ ...run, caught: run.caught + 1 }));
        const p = before.pendingEncounter;
        if (battle.kind === 'trainer' && p?.kind === 'trainer') {
          // 이긴 트레이너는 다시 안 나옴 (다시 걸어도 — 2026-10-18 태현 님)
          save = withStage(save, id, (s) => ({ ...s, defeatedTrainers: s.defeatedTrainers.includes(p.trainerId) ? s.defeatedTrainers : [...s.defeatedTrainers, p.trainerId], run: { ...s.run, trainers: s.run.trainers + 1 } }));
        }
        rt = { ...rt, rngState: rng.state };
        stage = { phase: 'result', summary: r.summary, ms: 0 };
        break;
      }
      if (battle.result === 'flee' && !wiped) {
        rt = { ...rt, toast: { text: '무사히 도망쳤다!', ms: TIMING.toastMs } };
        stage = { phase: 'walk' };
        break;
      }
      // S17 패배
      const d = stageDefeat(save, id);
      save = d.save;
      rt = { ...rt, rngState: rng.state };
      stage = { phase: 'defeat', gym: false, lost: d.lost };
      if (rt.headless) notice = 'defeat';
      break;
    }
    case 'result':
    case 'choice': {
      const next = resultOrChoiceStep(stage, save, stepMs);
      if (next.phase === 'choice' && stage.phase === 'result' && rt.headless) notice = 'choice';
      stage = next;
      break;
    }
    case 'request': {
      if (!stage.result) break; // 고를 때까지 기다림 (고른 순간 진행 % 는 자리로 — applyInput)
      const ms = stage.ms + stepMs;
      stage = ms < TIMING.requestResultMs ? { ...stage, ms } : { phase: 'walk' };
      break;
    }
    case 'clear':
      // 끝까지 왔는데 아직 클리어 처리를 안 한 세이브 (단계 9 전에 끝에 서 있던 세이브) — 지금 처리
      if (!prog.cleared) return finishStage(save, rt, id);
      break;
    case 'defeat':
    case 'lobby':
    case 'badge':
      break;
  }
  // 걷는 동안 회복 — 이번 걸음에 나아간 만큼 (1분에 최대 HP 10%)
  if (walking) save = walkRegen(save, prog.progress, save.stages[id]?.progress ?? prog.progress);
  return { save, rt: { ...rt, stage, stageId: id }, signal, notice };
}

/** 스테이지 끝 — 볼 +1 · 보너스 경험치 · 깬 표시 → S24 클리어 카드 (고를 것이 있으면 먼저) · 1-3 은 S16 체육관 대기실로 */
function finishStage(save0: Save, rt0: RuntimeState, id: StageId): { save: Save; rt: RuntimeState; signal: SaveSignal | null; notice: GameNotice | null } {
  const rng = new Rng(rt0.rngState);
  const r = clearStage(save0, id, rng);
  let save = r.save;
  let rt: RuntimeState = { ...rt0, rngState: rng.state };
  const lv = r.levelUps.length > 0 ? ` · ${r.levelUps.join(' · ')}` : '';
  if (id === 'forest-3') {
    save = { ...save, location: { screen: 'gym' } };
    rt = { ...rt, toast: { text: `🎉 ${stageCode(id)} 클리어! 보너스 경험치 +${clearBonusExp(id)} · ◓+${BALANCE.clearBalls}${lv}`, ms: TIMING.toastMs * 2 } };
  } else if (lv) rt = { ...rt, toast: { text: `🎉${lv}`, ms: TIMING.toastMs * 2 } };
  const stage = afterResult(save);
  const notice: GameNotice | null = !rt.headless ? null : stage.phase === 'choice' ? 'choice' : id === 'forest-3' ? 'gym' : 'clear';
  return { save, rt: { ...rt, stage, stageId: id === 'forest-3' ? null : id }, signal: 'stage-clear', notice };
}

/** S12 결과 (3.5초 · 계속) · S23 · S22 고르기 (고를 때까지, ms = 진화 연출) — 스테이지 · 체육관이 같이 씀 */
function resultOrChoiceStep(stage: Extract<StageRuntime, { phase: 'result' | 'choice' }>, save: Save, stepMs: number): StageRuntime {
  if (stage.phase === 'result') {
    const ms = stage.ms + stepMs;
    return ms < TIMING.resultMs ? { ...stage, ms } : afterResult(save, stage.then);
  }
  // 고를 것이 없으면 다음으로 · 있으면 고를 때까지 (ms = 진화 연출, 다 차면 그대로)
  if (save.pendingChoices.length === 0) return afterResult(save, stage.then);
  return { ...stage, ms: Math.min(TIMING.evolveAnimMs, stage.ms + stepMs) };
}

/** S16 체육관 — 대기실 · 관장전 · 결과 · 고르기 · 패배 · MVP 끝 카드 */
function gymStep(save0: Save, rt0: RuntimeState, stepMs: number): { save: Save; rt: RuntimeState; signal: SaveSignal | null; notice: GameNotice | null } {
  let save = save0;
  let rt = rt0;
  const st = rt.stageId === null ? rt.stage : null;
  const pending = save.pendingEncounter;
  const okHere = (s: StageRuntime | null): s is StageRuntime => {
    if (!s) return false;
    if (s.phase === 'battle') return s.battle.kind === 'gym' && pending?.kind === 'gym-leader';
    if (save.pendingChoices.length > 0 && s.phase !== 'result' && s.phase !== 'choice') return false;
    return s.phase === 'lobby' || s.phase === 'result' || s.phase === 'choice' || s.phase === 'defeat' || s.phase === 'badge';
  };
  let stage: StageRuntime = okHere(st)
    ? st
    : save.pendingChoices.length > 0
      ? { phase: 'choice', ms: 0 }
      : pending?.kind === 'gym-leader'
        ? { phase: 'battle', battle: leaderBattle(save) }
        : { phase: 'lobby' };
  let signal: SaveSignal | null = null;
  let notice: GameNotice | null = null;
  if (rt.headless && stage.phase === 'choice' && rt.stage?.phase !== 'choice' && save.pendingChoices.length > 0) notice = 'choice';
  switch (stage.phase) {
    case 'battle': {
      const rng = new Rng(rt.rngState);
      const battle = battleStep(stage.battle, save, stepMs, rng, { auto: save.settings.autoBattle, away: rt.headless });
      rt = { ...rt, rngState: rng.state };
      if (!battleDone(battle)) {
        stage = { phase: 'battle', battle };
        break;
      }
      const wiped = battle.me.hp <= 0 && switchable(battle, save).length === 0;
      save = applyBattleResult(save, battle);
      signal = 'battle-end';
      if (battle.result === 'win' && !wiped) {
        const first = !save.badges.includes(FOREST_BADGE);
        const r = battleRewards(save, battle, null, 'gym', rng);
        save = r.save;
        rt = { ...rt, rngState: rng.state };
        stage = first ? { phase: 'result', summary: r.summary, ms: 0, then: 'badge' } : { phase: 'result', summary: r.summary, ms: 0 };
        break;
      }
      // 관장전 패배 — 돈은 안 잃고 팀 회복, 대기실로 (gdd 4.10)
      const d = defeatPenalty(save, true);
      save = d.save;
      stage = { phase: 'defeat', gym: true, lost: 0 };
      if (rt.headless) notice = 'defeat';
      break;
    }
    case 'result':
    case 'choice': {
      const next = resultOrChoiceStep(stage, save, stepMs);
      if (next.phase === 'choice' && stage.phase === 'result' && rt.headless) notice = 'choice';
      stage = next;
      break;
    }
    default:
      break;
  }
  return { save, rt: { ...rt, stage, stageId: null }, signal, notice };
}

/** 걸음 하나 */
export function step(state: GameState, stepMs: number): StepOut {
  let save: Save = { ...state.save, playTimeMs: state.save.playTimeMs + stepMs };
  let rt: RuntimeState = state.runtime;
  if (rt.toast) rt = { ...rt, toast: rt.toast.ms > stepMs ? { ...rt.toast, ms: rt.toast.ms - stepMs } : null };
  let signal: SaveSignal | null = null;
  let notice: GameNotice | null = null;
  const loc = save.location;
  if (loc.screen === 'stage' || loc.screen === 'gym') {
    const r = loc.screen === 'stage' ? stageStep(save, rt, loc.stageId, stepMs) : gymStep(save, rt, stepMs);
    save = r.save;
    rt = r.rt;
    signal = r.signal;
    notice = r.notice;
  } else if (rt.stage) {
    rt = { ...rt, stage: null, stageId: null };
  }
  return { state: { save, runtime: rt }, save: signal, notice };
}

/** 지난 시간만큼 앞으로 (배속 반영) — 바로 저장할 일이 있었으면 saves 에 */
export function advance(
  state: GameState,
  elapsedMs: number,
  stepMs: number = TIMING.simStepMs,
): { state: GameState; steps: number; saves: SaveSignal[]; notices: GameNotice[] } {
  const speed = Math.min(MAX_SPEED, Math.max(1, state.runtime.speed || 1));
  const { steps, accMs } = takeSteps(state.runtime.stepAccMs, elapsedMs * speed, stepMs);
  if (steps === 0 && accMs === state.runtime.stepAccMs) return { state, steps, saves: [], notices: [] };
  let next = state;
  const saves = new Set<SaveSignal>();
  const notices = new Set<GameNotice>();
  for (let i = 0; i < steps; i++) {
    const r = step(next, stepMs);
    next = r.state;
    if (r.save) saves.add(r.save);
    if (r.notice) notices.add(r.notice);
  }
  return { state: { ...next, runtime: { ...next.runtime, stepAccMs: accMs } }, steps, saves: [...saves], notices: [...notices] };
}

/** 사람이 골라야 앞으로 가는 순간 (부탁 · 병원 안 · 클리어 카드 · 대기실 · 패배 · 내 차례 · 안 볼 때 이로치) — 안 볼 때 확장은 계산 · 저장을 멈춤 */
export function isWaitingForInput(state: GameState): boolean {
  const st = state.runtime.stage;
  if (shinyWhileAway(state.save, state.runtime, st)) return true;
  if (!st) return false;
  switch (st.phase) {
    case 'battle':
      return !state.save.settings.autoBattle && battleWaiting(st.battle);
    case 'choice':
      return state.save.pendingChoices.length > 0;
    case 'request':
      return !st.result;
    case 'facility':
      return st.inside;
    case 'hold':
    case 'defeat':
    case 'clear':
    case 'lobby':
    case 'badge':
      return true;
    default:
      return false;
  }
}

// ---------- 어디서 무엇을 할 수 있는지 (화면이 버튼을 흐리게 하는 데도 씀)

const phaseOf = (state: GameState) => state.runtime.stage?.phase ?? null;
const inFacility = (state: GameState, kind: FacilitySpot['kind']) => {
  const st = state.runtime.stage;
  return state.save.location.screen === 'stage' && st?.phase === 'facility' && st.inside && st.kind === kind;
};
const inLobby = (state: GameState) => state.save.location.screen === 'gym' && phaseOf(state) === 'lobby';

/** S18 ② 보관함과 팀 바꾸기 — 병원 · 체육관 대기실 · 스테이지 시작 전 (클리어 카드 · 대기실에서 연 지도) (gdd 4.10) */
export function canSwapBox(state: GameState): boolean {
  return inFacility(state, 'hospital') || inLobby(state) || (state.save.location.screen === 'stage' && phaseOf(state) === 'clear');
}
/** S13 ① 회복 */
export function canHeal(state: GameState): boolean {
  return inFacility(state, 'hospital') || inLobby(state);
}
/** S14 사기 */
export function canShop(state: GameState): boolean {
  return inFacility(state, 'shop') || inLobby(state);
}
/** 전투 중 (튀어나옴 · 트레이너와 마주침 포함) — 팀 순서 · 포인트를 못 바꿈 */
export function inBattle(state: GameState): boolean {
  const p = phaseOf(state);
  return p === 'battle' || p === 'appear' || p === 'trainer';
}
/** S06 ⑦ ~ ⑩ 오른쪽 위 버튼 · S19 가방 — 걷는 중 (그동안 화면은 걸음을 멈춤) · 체육관 대기실 (관장에게 받은 리프의 돌을 바로) */
export function canOpenMenus(state: GameState): boolean {
  return (state.save.location.screen === 'stage' && phaseOf(state) === 'walk') || inLobby(state);
}
/** 스테이지 · 체육관으로 갈 수 있는 때 — 걷는 중 (지도) · 클리어 카드 · 대기실 */
export function canTravel(state: GameState): boolean {
  const p = phaseOf(state);
  return (state.save.location.screen === 'stage' && (p === 'walk' || p === 'clear')) || inLobby(state);
}
/** 그 스테이지가 열렸는지 — 1-1 은 처음부터, 그다음은 앞 스테이지를 깨야 */
export function stageUnlocked(save: Save, id: StageId): boolean {
  const i = STAGE_IDS.indexOf(id);
  return i === 0 || save.stages[STAGE_IDS[i - 1]!]?.cleared === true;
}
/** 체육관 — 1-3 을 깨면 지도에서 바로 (mvp-spec S07 ① [제안]) */
export const gymUnlocked = (save: Save) => save.stages['forest-3']?.cleared === true;

function toast(state: GameState, save: Save, text: string): GameState {
  return { save, runtime: { ...state.runtime, toast: { text, ms: TIMING.toastMs } } };
}

/** S07 · S24 · S16 ③ — 떠나는 스테이지는 처음부터 다시 (지도 확인 한 번은 화면이), 가는 스테이지는 새 판 (새 길, #62) */
function travel(state: GameState, to: StageId | 'gym'): GameState {
  if (!canTravel(state)) return state;
  const loc = state.save.location;
  if (loc.screen === 'stage' && to === loc.stageId && phaseOf(state) === 'walk') return state; // 지금 스테이지 = 그대로 이어 함
  const rng = new Rng(state.runtime.rngState);
  let save = state.save;
  if (to === 'gym' ? !gymUnlocked(save) : !stageUnlocked(save, to)) return state;
  if (loc.screen === 'stage') {
    const from = loc.stageId;
    save = withStage(save, from, (p) => ({ ...freshRun(p, newSeed(rng), save.playTimeMs) }));
    if (save.lastHospital?.stageId === from) save = { ...save, lastHospital: null };
  }
  if (to === 'gym') return { save: { ...save, location: { screen: 'gym' } }, runtime: { ...state.runtime, rngState: rng.state, stage: { phase: 'lobby' }, stageId: null } };
  save = { ...save, stages: { ...save.stages, [to]: freshRun(save.stages[to], newSeed(rng), save.playTimeMs) }, location: { screen: 'stage', stageId: to } };
  if (save.lastHospital?.stageId === to) save = { ...save, lastHospital: null };
  return { save, runtime: { ...state.runtime, rngState: rng.state, stage: null, stageId: to } };
}

/** 입력 — 지금 받을 수 없는 입력이면 상태를 그대로 돌려줌 */
export function applyInput(state: GameState, input: GameInput): GameState {
  const stage = state.runtime.stage;
  const save = state.save;
  switch (input.kind) {
    case 'space':
      if (stage?.phase === 'battle') return withBattleInput(state, { kind: 'space', extraMs: state.runtime.stepAccMs });
      // S12 계속 · S22 진화 연출 빨리 넘기기
      if (stage?.phase === 'result') return applyInput(state, { kind: 'result-continue' });
      if (stage?.phase === 'choice') return applyInput(state, { kind: 'evolve-skip' });
      if (stage?.phase !== 'appear' || stage.space || stage.ms > BALANCE.preemptiveWindowMs) return state;
      return { ...state, runtime: { ...state.runtime, stage: { ...stage, space: true } } };
    case 'battle':
      return stage?.phase === 'battle' ? withBattleInput(state, input.input) : state;
    case 'auto-battle':
      if (save.settings.autoBattle === input.on) return state;
      return { ...state, save: { ...save, settings: { ...save.settings, autoBattle: input.on } } };
    case 'notifications':
      if (save.settings.notifications === input.on) return state;
      return { ...state, save: { ...save, settings: { ...save.settings, notifications: input.on } } };
    case 'result-continue':
      if (stage?.phase !== 'result') return state;
      return { ...state, runtime: { ...state.runtime, stage: afterResult(save, stage.then) } };
    case 'learn': {
      const c = save.pendingChoices[0];
      if (stage?.phase !== 'choice' || c?.kind !== 'learn') return state;
      // 화면이 다시 그려지기 전에 두 번 눌러도 다음 고르기 (다른 포켓몬) 에 들어가지 않게 — 화면이 보던 고르기와 맞을 때만
      if ((input.uid !== undefined && input.uid !== c.uid) || (input.moveId !== undefined && input.moveId !== c.moveId)) return state;
      // 무엇을 잊고 배웠는지 한 줄 (숫자 하나로 기술이 바뀌니 알게)
      const m = save.monsters[c.uid];
      const learned = moveOf(c.moveId)?.name.ko ?? '?';
      const forgot = input.replace !== null && m ? moveOf(m.moves[input.replace]?.moveId ?? -1)?.name.ko : undefined;
      const text = forgot ? `${withJosa(forgot, '을/를')} 잊고 ${withJosa(learned, '을/를')} 배웠다!` : `${withJosa(learned, '을/를')} 배우지 않았다`;
      return afterChoice(state, resolveLearn(save, input.replace), state.runtime.rngState, text);
    }
    case 'evolve':
    case 'evolve-cancel': {
      const head = save.pendingChoices[0];
      if (stage?.phase !== 'choice' || head?.kind !== 'evolve') return state;
      if ((input.uid !== undefined && input.uid !== head.uid) || (input.to !== undefined && input.to !== head.to)) return state;
      // 남길 기술은 연출이 끝난 뒤에 고름 · 멈추기 (Esc) 는 연출 중에만 (원작처럼)
      if (input.kind === 'evolve' && stage.ms < TIMING.evolveAnimMs) return state;
      if (input.kind === 'evolve-cancel' && (stage.ms >= TIMING.evolveAnimMs || stage.ms < TIMING.evolveGuardMs)) return state;
      const rng = new Rng(state.runtime.rngState);
      const text = input.kind === 'evolve-cancel' ? (head.item ? `진화를 멈췄다 — ${withJosa(itemName(head.item), '은/는')} 가방으로` : '진화를 멈췄다 — 다음 레벨업 때 다시') : undefined;
      return afterChoice(state, resolveEvolve(save, input.kind === 'evolve' ? input.keep : null, rng), rng.state, text);
    }
    case 'evolve-skip':
      if (stage?.phase !== 'choice' || save.pendingChoices[0]?.kind !== 'evolve' || stage.ms >= TIMING.evolveAnimMs || stage.ms < TIMING.evolveGuardMs) return state;
      return { ...state, runtime: { ...state.runtime, stage: { ...stage, ms: TIMING.evolveAnimMs } } };
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
    case 'facility': {
      if (stage?.phase !== 'facility' || stage.inside || save.location.screen !== 'stage') return state;
      // 고른 순간 진행 % 를 그 자리로 (병원이면 마지막 병원) — 안에서 꺼도 다시 켜면 그 앞을 지나 걸음
      const passed = passFacility(save, save.location.stageId, stage.kind, stage.at);
      return { save: passed, runtime: { ...state.runtime, stage: input.enter ? { ...stage, inside: true } : { phase: 'walk' } } };
    }
    case 'facility-leave':
      if (stage?.phase !== 'facility' || !stage.inside) return state;
      return { ...state, runtime: { ...state.runtime, stage: { phase: 'walk' } } };
    case 'heal':
      if (!canHeal(state)) return state;
      return toast(state, healTeam(save), '포켓몬들이 모두 기운을 되찾았다!');
    case 'buy': {
      if (!canShop(state) || !isShopItem(input.item)) return state;
      const next = buy(save, input.item);
      return next ? toast(state, next, `${withJosa(itemName(input.item), '을/를')} 샀다!`) : state;
    }
    case 'team-move': {
      if (inBattle(state)) return state;
      const next = moveInTeam(save, input.uid, input.dir);
      return next ? { ...state, save: next } : state;
    }
    case 'team-swap':
    case 'team-to-box': {
      if (!canSwapBox(state)) return state;
      const next = input.kind === 'team-swap' ? swapWithBox(save, input.boxUid, input.partyUid) : toBox(save, input.uid);
      return next ? { ...state, save: next } : state;
    }
    case 'points': {
      if (inBattle(state)) return state;
      const next = spendPoint(save, input.uid, input.stat);
      return next ? { ...state, save: next } : state;
    }
    case 'use-item': {
      if (!canOpenMenus(state)) return state;
      const r = useFieldItem(save, input.item, input.uid);
      if (!r) return state;
      // 진화의 돌 · 연결의끈 → S22 (연출부터)
      if (r.evolve) return { save: r.save, runtime: { ...state.runtime, stage: { phase: 'choice', ms: 0 } } };
      const m = r.save.monsters[input.uid];
      const name = m ? (speciesOf(m.species)?.name.ko ?? m.form) : '';
      const text = r.healedHp > 0 ? `${withJosa(name, '은/는')} HP 가 ${r.healedHp} 회복됐다!` : `${withJosa(name, '은/는')} 몸이 개운해졌다!`;
      return toast(state, r.save, text);
    }
    case 'defeat-continue':
      if (stage?.phase !== 'defeat') return state;
      return { ...state, runtime: { ...state.runtime, stage: stage.gym ? { phase: 'lobby' } : { phase: 'walk' } } };
    case 'travel':
      return travel(state, input.to);
    case 'challenge': {
      if (!inLobby(state) || !firstAlive(save)) return state;
      const next: Save = { ...save, pendingEncounter: { kind: 'gym-leader' } };
      return { save: next, runtime: { ...state.runtime, stage: { phase: 'battle', battle: leaderBattle(next) } } };
    }
    case 'badge-continue':
      if (stage?.phase !== 'badge') return state;
      return { ...state, runtime: { ...state.runtime, stage: { phase: 'lobby' } } };
  }
}

/** S12 다음 — 고를 것 (S23 · S22) 이 있으면 고르기, 없으면: MVP 끝 카드 · 대기실 · 클리어 카드 · 걷기 */
function afterResult(save: Save, then?: 'badge'): StageRuntime {
  if (save.pendingChoices.length > 0) return then ? { phase: 'choice', ms: 0, then } : { phase: 'choice', ms: 0 };
  if (then === 'badge') return { phase: 'badge' };
  if (save.location.screen === 'gym') return { phase: 'lobby' };
  const prog = save.location.screen === 'stage' ? save.stages[save.location.stageId] : undefined;
  return prog && prog.progress >= 1 ? { phase: 'clear' } : { phase: 'walk' };
}

/** 하나 고른 뒤 — 다음 고르기 (새 연출부터) 또는 다음 · 한 줄 알림 (걸을 때 주인공 머리 위) */
function afterChoice(state: GameState, save: Save, rngState: number, text?: string): GameState {
  const st = state.runtime.stage;
  const then = st?.phase === 'choice' ? st.then : undefined;
  return { save, runtime: { ...state.runtime, rngState, stage: afterResult(save, then), toast: text ? { text, ms: TIMING.toastMs } : state.runtime.toast } };
}

function withBattleInput(state: GameState, input: BattleInput): GameState {
  const stage = state.runtime.stage;
  if (stage?.phase !== 'battle') return state;
  const rng = new Rng(state.runtime.rngState);
  const battle = battleInput(stage.battle, state.save, input, rng);
  if (battle === stage.battle) return state;
  return { ...state, runtime: { ...state.runtime, rngState: rng.state, stage: { phase: 'battle', battle } } };
}

/** 개발 창 빨리 감기 (1 ~ MAX_SPEED) */
export function withSpeed(state: GameState, speed: number): GameState {
  const s = Math.min(MAX_SPEED, Math.max(1, Math.round(speed)));
  return { ...state, runtime: { ...state.runtime, speed: s } };
}
