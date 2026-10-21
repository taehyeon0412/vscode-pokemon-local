/**
 * 게임 한 걸음 · 입력 — 보일 때(웹뷰) · 안 보일 때(확장) 같은 함수.
 *
 * S06 스테이지 (mvp-spec 3.2): 자동으로 걷다가 길에 놓인 자리를 지나면
 *   떨어진 아이템 → 바로 줍고 계속 걸음 · 야생 → 튀어나옴 (선제공격 · 기습은 스피드로) → 전투 (engine/battle.ts) · 부탁 → 10초 뒤 저절로 [도와준다] (안 볼 때 바로)
 *   트레이너 → 멈추고 "!" → "승부다!" → 1:1 토너먼트 · 병원 · 상점 → [들어가기] [지나가기] (10초 · 안 볼 때는 바로 지나감)
 *   끝 → S24 클리어 카드 (1-3 은 S16 체육관 대기실로, 자동 전투면 10초 뒤 다음) · 지면 → S17 (마지막 병원 앞에서 다시 — 한 판 첫 패배만 5초 뒤 저절로)
 * S16 체육관: 대기실 → 관장과 1:1 토너먼트 → 처음 이기면 배지 · MVP 끝 카드
 * 안 볼 때 (확장이 계산) 이로치 흔적 · 라이벌 앞 · 고르기 · 같은 판 두 번째 패배에서는 멈추고 알림 신호 (U9)
 * 상태는 늘 새 객체로 만듦 (그 자리에서 고치지 않음 — 확장 ↔ 웹뷰 · 저장소가 같은 객체를 나눠 써도 안 바뀌게).
 */
import { BALANCE, TIMING } from '../balance';
import { buy, canBuyCandy, healTeam, isShopItem, moveInTeam, sell, spendPoint, swapWithBox, teamHealth, toBox, useFieldItem, walkRegen } from '../rules/bag';
import { createWild, encounterStart, pickupAt, planWild, wildKey } from '../rules/encounter';
import { itemName, requestAt, resolveRequest } from '../rules/request';
import { spotBetween, spotRng, stageCode, stageLayout, trainerId, walkDelta, type Spot, type StageLayout } from '../rules/stage';
import { statsOf } from '../rules/stats';
import { aliveCount, GYM_LEADER, leaderTeam, trainerInfo, trainerNumber, trainerTeam } from '../rules/trainer';
import { pickRival, rivalLine, rivalLoseMsg, rivalName, rivalRecord, rivalTeam, withRivalResult } from '../rules/rival';
import { isTipId, ITEM_IDS, RUN_SEEN_MAX, STAGE_IDS, TIPS_MAX, type FacilitySpot, type ItemId, type Monster, type Save, type StageId, type StageProgress, type StageRun, type StatKey } from '../save';
import { withJosa } from '../text';
import { moveOf, speciesOf } from '../../data';
import { applyBattleResult, battleDone, battleInput, battleStep, battleWaiting, firstAlive, startBattle, startTrainerBattle, switchable, type BattleInput, type BattleState } from './battle';
import { addItem, battleRewards, clearStage, defeatPenalty, FOREST_BADGE, pickTreasure, resolveEvolve, resolveLearn, rivalWinRewards, stageClearExp, takeLaterChoices, useRareCandy, type BattleSummary } from './rewards';
import { Rng } from './rng';
// 개발 모드 (임시)
import { devTeam, devWalk } from '../../dev/runtime';
import { MAX_SPEED, type AwayLog, type GameState, type RuntimeState, type StageRuntime } from './state';
import { applyTeamResult, pickTeam, startTeamBattle, teamDone, teamInput, teamPossible, teamRewardBattle, teamScale, teamStep, type TeamBattle, type TeamInput } from './team';
import { takeSteps } from './step';

/** 바로 저장해야 하는 일 (mvp-spec 3.1) — 웹뷰는 save-now 로, 확장은 바로 씀 */
export type SaveSignal = 'catch' | 'battle-end' | 'stage-clear';

/** 사용자 입력 (웹뷰에서만 옴) */
export type GameInput =
  /** Space 또는 길 (패널) 클릭 — 전투 · 결과 · 트레이너 만남 · 체육관 장면 넘기기 (튀어나올 때 선제공격은 뺌, 2026-10-21) */
  | { kind: 'space' }
  | { kind: 'request'; help: boolean }
  /** 전투 메뉴 · 필살기 · 다음 포켓몬 (Space 는 위 'space' 로 — 힘대결 연타 · 맞받아치기) */
  | { kind: 'battle'; input: BattleInput }
  /** 3:3 — 필살기 1 · 2 · 3 · Z · 연타 (orders #17) */
  | { kind: 'team-battle'; input: TeamInput }
  /** 트레이너를 만났을 때 1:1 / 3:3 고르기 (3마리 미만이면 1:1 만) */
  | { kind: 'team-mode'; on: boolean }
  /** 3:3 에 나갈 포켓몬 하나를 넣고 빼기 — 트레이너 만남 (3:3 을 골랐을 때) · 대기실. 셋이 차 있으면 가장 먼저 고른 것이 빠짐 */
  | { kind: 'team-pick'; uid: string }
  /** 웹뷰 패널 크기 — 3:3 배율이 바뀔 때만 (teamScale) */
  | { kind: 'view'; w: number; h: number }
  /** S09 ⑫ 자동 전투 스위치 — 세이브 설정에 (다음 전투에도 그대로) */
  /** say = 한 줄 알림 "자동 전투 켜짐 · 꺼짐" (A 키 — 정보줄 스위치가 안 보일 때도 알게, 2026-10-21 코드 리뷰어) */
  | { kind: 'auto-battle'; on: boolean; say?: boolean }
  /** 빨리 걷기 켜기 · 끄기 (S06 정보줄 · S20, 2026-10-19) */
  | { kind: 'fast-walk'; on: boolean }
  /** 게임의 동작 줄이기 (설정 — 화면이 움직임을 줄임, OS 설정은 안 봄 · 2026-10-20 태현 님) */
  | { kind: 'reduce-motion'; on: boolean }
  /** 설정 — 자동 전투 상처약 (ideas #65) · 이미 잡은 종은 마지막 기회 건너뛰기 (ideas #35) */
  | { kind: 'auto-potion'; on: boolean }
  | { kind: 'skip-caught-last'; on: boolean }
  /** 첫 안내를 다 보여 줌 — 본 안내 id 를 세이브에 (디자인팀 orders #12) */
  | { kind: 'tip-seen'; id: string }
  /** S22 "어…? ○○의 모습이…!" 에서 진화 연출 시작 (Space · 클릭 — ideas #33) */
  | { kind: 'evolve-watch' }
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
  /** 병원 앞 [회복하고 가기] — 들어가기 · 회복 · 나가기를 한 번에 (2026-10-21 ideas #43) */
  | { kind: 'facility-heal' }
  /** S13 ① 회복 (병원 · 체육관 대기실) · S14 사기 (상점 · 대기실) */
  | { kind: 'heal' }
  /** count = Shift + 클릭 한 번에 (ideas #50, 최대 shopBulk) */
  | { kind: 'buy'; item: ItemId; count?: number }
  /** S14 [팔기] — 정가의 50% (ideas #126) */
  | { kind: 'sell'; item: ItemId; count?: number }
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
export type GameNotice = 'shiny' | 'rival' | 'request' | 'choice' | 'gym' | 'clear' | 'defeat';

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

/** 세이브의 만남 → 전투 종류 (라이벌 = 트레이너 전투) */
function battleKindOf(p: Save['pendingEncounter']): BattleState['kind'] | undefined {
  if (p?.kind === 'rival') return 'trainer';
  return p?.kind === 'wild' || p?.kind === 'trainer' ? p.kind : undefined;
}

/** 세이브의 만남 → 트레이너 전투의 상대 이름 (trainerBattle · rivalBattle 과 같게) */
function foeNameOf(p: Save['pendingEncounter']): string | undefined {
  if (p?.kind === 'trainer') return trainerInfo(p.stageId, trainerNumber(p.trainerId)).name;
  return p?.kind === 'rival' ? rivalName(p.rival) : undefined;
}

/** 트레이너 전투 — 데리고 나오는 포켓몬은 판 시드 · 번호 · 내 살아 있는 포켓몬 수로 (껐다 켜면 같은 상대와 처음부터) */
function trainerBattle(save: Save, id: StageId, prog: StageProgress, n: number): BattleState {
  return startTrainerBattle(save, trainerTeam(id, prog.seed, n, aliveCount(save)), 'trainer', trainerInfo(id, n).name);
}

/** 라이벌 전투 (gdd 4.12) — 1:1 토너먼트 (전투 종류는 트레이너와 같음 — 도망 없음), 팀은 판 시드 · 만난 수로 */
function rivalBattle(save: Save, id: StageId, prog: StageProgress, rival: string): BattleState {
  return startTrainerBattle(save, rivalTeam(save, rival, id, prog.seed), 'trainer', rivalName(rival));
}

/**
 * 3:3 으로 싸울지 (orders #17) — 켜져 있고 (화면이 생길 때까지 꺼 둠) · 잠기지 않음 (살아 있는 포켓몬 3마리 이상 · 패널에 6마리가 들어감) ·
 * 고른 대로 (고르지 않았으면 마지막으로 고른 방식 — 처음엔 1:1, gdd 4.7 · 명세 검사관). 관장전은 늘 3:3 (choice = true)
 */
function useTeam(save: Save, rt: RuntimeState, choice?: boolean): boolean {
  return teamOn(rt) && teamLockOf(save, rt) === null && (choice ?? save.settings.teamMode === true);
}

/** 3:3 을 켰는지 — 본편은 BALANCE.team.on, 개발 모드 (임시) 는 "3:3 미리 켜기" 로도 */
const teamOn = (rt: RuntimeState) => BALANCE.team.on || devTeam(rt.dev);

/** 3:3 을 못 하는 까닭 — few = 살아 있는 포켓몬 3마리 미만 · narrow = 패널이 좁아 6마리가 안 들어감 ("패널을 넓히면 3:3") · null = 됨 */
function teamLockOf(save: Save, rt: RuntimeState): 'few' | 'narrow' | null {
  if (!teamPossible(save)) return 'few';
  return teamScale(rt.view) === 0 ? 'narrow' : null;
}
export function teamLock(state: GameState): 'few' | 'narrow' | null {
  return teamLockOf(state.save, state.runtime);
}

/** 트레이너 3:3 상대 (늘 3마리) — 판 시드 · 번호로 (껐다 켜도 같음) */
function trainerFoes(save: Save, id: StageId, prog: StageProgress, n: number): Monster[] {
  return trainerTeam(id, prog.seed, n, aliveCount(save), BALANCE.team.size);
}

/**
 * 나갈 3마리 — 고른 것 (살아 있는 팀 포켓몬만) + 모자라면 상성 좋은 순으로 채움.
 * 미리 체크된 셋에서 뺀 포켓몬은 맨 뒤로 (빼고 바로 Enter 를 눌러도 뺀 것이 다시 나가지 않게 — 다른 포켓몬이 없을 때만, 코드 리뷰어)
 */
function fillPick(save: Save, pick: readonly string[] | undefined, foes: readonly Monster[]): string[] {
  if (!pick) return pickTeam(save, foes);
  const ok = pick.filter((uid) => save.party.includes(uid) && (save.monsters[uid]?.hp ?? 0) > 0);
  const first = pickTeam(save, foes);
  const rest = pickTeam(save, foes, Infinity).filter((uid) => !ok.includes(uid));
  return [...ok, ...rest.filter((uid) => !first.includes(uid)), ...rest.filter((uid) => first.includes(uid))].slice(0, BALANCE.team.size);
}

/**
 * 3마리 고르기 — 지금 체크된 포켓몬 (트레이너 만남에서 3:3 을 골랐을 때 · 대기실). 고를 수 없으면 null — 화면이 ●●●○○ 를 그림.
 * 처음엔 상성 좋은 셋이 체크 · 빼면 빈 채로 (시작할 때 모자라면 상성 좋은 순으로 채움)
 */
export function teamPickOf(state: GameState): string[] | null {
  const { save, runtime: rt } = state;
  const stage = rt.stage;
  if (!teamOn(rt) || teamLockOf(save, rt) !== null) return null;
  const alive = (pick: readonly string[]) => pick.filter((uid) => save.party.includes(uid) && (save.monsters[uid]?.hp ?? 0) > 0);
  if (stage?.phase === 'lobby' && inLobby(state)) return stage.pick ? alive(stage.pick) : fillPick(save, undefined, leaderTeam());
  if (stage?.phase !== 'trainer' || !stage.pick || save.pendingEncounter?.kind !== 'trainer') return null;
  return alive(stage.pick);
}

function trainerTeamBattle(save: Save, id: StageId, prog: StageProgress, n: number, pick?: readonly string[]): TeamBattle {
  const foes = trainerFoes(save, id, prog, n);
  return startTeamBattle(save, foes, 'trainer', trainerInfo(id, n).name, fillPick(save, pick, foes));
}

function leaderTeamBattle(save: Save, pick?: readonly string[]): TeamBattle {
  return startTeamBattle(save, leaderTeam(), 'gym', GYM_LEADER.name, fillPick(save, pick, leaderTeam()));
}

function leaderBattle(save: Save): BattleState {
  return startTrainerBattle(save, leaderTeam(), 'gym', GYM_LEADER.name);
}

/** 다시 안 나오는 자리 — 이긴 트레이너 · 졌다 다시 걸을 때 이미 지나간 떨어진 아이템 · 부탁 (주웠고 · 골랐음) */
const beaten = (prog: StageProgress, id: StageId, s: Spot) =>
  (s.kind === 'trainer' && prog.defeatedTrainers.includes(trainerId(id, s.trainer ?? 0))) || ((s.kind === 'item' || s.kind === 'request' || s.kind === 'rival') && s.at <= prog.run.reach);

/** 이번 걸음에 지나친 첫 자리 · 병원 · 상점 (from < at ≤ to) — 다시 안 나오는 자리는 건너뜀 */
/**
 * 걷는 빠르기 배 — 빨리 걷기 (설정, 2026-10-19 태현 님 "걷는 시간이 길어 루즈해") 가 켜져 있으면 ×3, 단 앞으로 0.5초 (보통 걸음, fastWalkLookMs) 안에
 * 흔적 · 트레이너 · 병원 · 상점 · 아이템 · 부탁이 있으면 보통 빠르기 (다가오는 걸 보고 선제공격 · 고르기를 할 수 있게). 지나가면 다시 ×3
 */
function walkSpeed(save: Save, layout: StageLayout, prog: StageProgress, id: StageId, rt?: RuntimeState): number {
  // 개발 모드 (임시) 걷기 배 — 다가오는 것과 상관없이 늘
  if (devWalk(rt?.dev) > 1) return devWalk(rt?.dev);
  if (save.settings.fastWalk !== true) return 1;
  const from = prog.progress;
  return nextEvent(layout, prog, id, from, Math.min(1, from + walkDelta(BALANCE.fastWalkLookMs))) ? 1 : BALANCE.fastWalkSpeed;
}

/** 화면용 — 지금 빨리 걷는 중인지 (배경 흐름 · 걷기 그림을 같이 빠르게 · 정보줄 표시) */
export function isWalkingFast(state: GameState): boolean {
  const loc = state.save.location;
  if (loc.screen !== 'stage' || state.runtime.stage?.phase !== 'walk' || (state.save.settings.fastWalk !== true && devWalk(state.runtime.dev) <= 1)) return false;
  const prog = state.save.stages[loc.stageId];
  if (!prog) return false;
  return walkSpeed(state.save, stageLayout(loc.stageId, prog.seed, prog.facilities), prog, loc.stageId, state.runtime) > 1;
}

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
  if (st.phase === 'rival' && (pending?.kind !== 'rival' || pending.rival !== st.rival)) return null;
  // 라이벌 전투는 트레이너 전투와 같은 종류 (도망 없음) — 그래서 상대 이름으로도 가림 (바뀌어 들어오면 보상 · 전적이 엉뚱하게, 코드 리뷰어)
  if (st.phase === 'battle' && (st.battle.kind === 'gym' || battleKindOf(pending) !== st.battle.kind)) return null;
  if (st.phase === 'battle' && st.battle.kind === 'trainer' && st.battle.foeName !== foeNameOf(pending)) return null;
  if (st.phase === 'team' && (st.team.kind !== 'trainer' || pending?.kind !== 'trainer' || st.team.foeName !== foeNameOf(pending))) return null;
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
    case 'gym-enter':
      return progress >= 1 ? st : null;
    case 'lobby':
    case 'badge':
      return null;
    default:
      return st;
  }
}

/** 진행 중 상태가 없을 때 세이브를 보고 정함 — 고르다 껐으면 그 고르기부터 · 전투 중에 껐다 켜면 그 전투를 처음부터 (mvp-spec 9장) */
function defaultStage(save: Save, rt: RuntimeState, id: StageId, prog: StageProgress): StageRuntime {
  const p = save.pendingEncounter;
  if (save.pendingChoices.length > 0) return choiceStage(save);
  if (p?.kind === 'wild') return { phase: 'battle', battle: startBattle(save, p.monster, p.start) };
  // 3:3 이었으면 3:3 으로 (마지막으로 고른 방식 — 껐다 켜도 같게, 코드 리뷰어)
  if (p?.kind === 'trainer' && p.stageId === id) {
    const n = trainerNumber(p.trainerId);
    return useTeam(save, rt) ? { phase: 'team', team: trainerTeamBattle(save, id, prog, n) } : { phase: 'battle', battle: trainerBattle(save, id, prog, n) };
  }
  if (p?.kind === 'rival' && p.stageId === id) return { phase: 'battle', battle: rivalBattle(save, id, prog, p.rival) };
  return prog.progress >= 1 ? { phase: 'clear' } : { phase: 'walk' };
}

/** 안 볼 때 (확장이 계산) 눈앞에 이로치가 나와 있으면 (튀어나옴 · 전투 중에 사람이 떠남) — 자동 전투로 쓰러뜨리지 않고 다시 볼 때까지 기다림 (U9) */
function shinyWhileAway(save: Save, rt: RuntimeState, stage: StageRuntime | null): boolean {
  // 안 볼 때 (확장이 계산) · VS Code 에 포커스가 없을 때 (패널은 보임, 2026-10-19)
  if (!(rt.headless || rt.away) || !stage) return false;
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
  let stage: StageRuntime = checkedStage(rt, save, id, layout, prog.progress) ?? defaultStage(save, rt, id, prog);
  let signal: SaveSignal | null = null;
  let notice: GameNotice | null = null;
  // 안 볼 때 고를 것이 남은 세이브로 시작했으면 (껐다 켬 등) 한 번 알림 — 그 뒤로는 기다리는 중이라 확장 계산이 멈춤
  if (rt.headless && stage.phase === 'choice' && rt.stage?.phase !== 'choice' && save.pendingChoices.length > 0) notice = 'choice';
  if (shinyWhileAway(save, rt, stage)) return { save, rt: { ...rt, stage, stageId: id }, signal, notice };
  const walking = stage.phase === 'walk';

  switch (stage.phase) {
    case 'walk': {
      const from = prog.progress;
      const to = Math.min(1, from + walkDelta(stepMs * walkSpeed(save, layout, prog, id, rt)));
      const ev = nextEvent(layout, prog, id, from, to);
      if (!ev) {
        save = withProgress(save, id, to);
        // 1-3 끝 — 길 끝 체육관 문이 열리고 걸어 들어간 뒤 대기실 (2026-10-20 태현 님 A안) · 안 볼 때 (확장 계산) 는 바로
        if (to >= 1 && id === 'forest-3' && !rt.headless) {
          stage = { phase: 'gym-enter', ms: 0 };
          break;
        }
        if (to >= 1) return finishStage(save, rt, id);
        break;
      }
      if ('facility' in ev) {
        const f = ev.facility;
        // 안 볼 때는 바로 지나감 (2026-10-18 태현 님) · 보이면 앞에서 멈추고 [들어가기] [지나가기]
        if (rt.headless) save = passFacility(save, id, f.kind, f.at);
        // 병원인데 팀이 다 건강하면 멈추지 않고 한 줄만 (ideas #42) — 쌓아 둔 기술 고르기는 꺼냄
        else if (f.kind === 'hospital' && teamHealth(save).healthy) {
          save = takeLaterChoices(passFacility(save, id, f.kind, f.at));
          rt = { ...rt, toast: { text: '병원 지나감 — 팀이 다 건강해요', ms: TIMING.toastMs } };
          stage = afterResult(save);
        } else {
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
        // 앞 한 줄 ("그동안: …" 등) 이 떠 있으면 덮지 않고 그 뒤에 (1초 넘게 — U1, 코드 리뷰어)
        const picked = `${withJosa(what, '을/를')} 주웠다!`;
        rt = { ...rt, toast: rt.toast ? { ...rt.toast, then: picked } : { text: picked, ms: TIMING.toastMs } };
      } else if (spot.kind === 'wild' && (rt.headless || rt.away) && planWild(id, prog.seed, spot, prog.run.retries).shiny) {
        // 안 볼 때 · VS Code 에 포커스가 없을 때 이로치 흔적 — 바로 앞에서 멈추고 알림 (U9), 다시 보이면 · 돌아오면 이어 감
        save = withProgress(save, id, Math.max(from, spot.at - BEFORE_SPOT));
        stage = { phase: 'hold', why: 'shiny' };
        notice = 'shiny';
      } else if (spot.kind === 'wild') {
        const wild = createWild(id, prog.seed, spot, prog.run.retries);
        const enemySpeed = statsOf(speciesOf(wild.species)!.base, wild.ivs, wild.points, wild.level).speed;
        const start = encounterStart(enemySpeed, leadSpeed(save), spotRng(prog.seed, wildKey(spot, prog.run.retries), 6));
        const isNew = !save.dex.seen.includes(wild.species);
        save = {
          ...withProgress(save, id, spot.at),
          dex: isNew ? { ...save.dex, seen: [...save.dex.seen, wild.species] } : save.dex,
          pendingEncounter: { kind: 'wild', monster: wild, start },
        };
        // S24 "새로 만난 포켓몬" — 이 판에서 처음 만난 종 몇 마리
        if (isNew) save = withRun(save, id, (r) => (r.seen.length < RUN_SEEN_MAX ? { ...r, seen: [...r.seen, wild.species] } : r));
        stage = { phase: 'appear', ms: 0, isNew };
      } else if (spot.kind === 'trainer') {
        // 트레이너 — 멈추고 "!" → "승부다!" (자동 전투여도 멈추지 않고 그대로 전투로)
        const n = spot.trainer ?? 0;
        save = { ...withProgress(save, id, spot.at), pendingEncounter: { kind: 'trainer', trainerId: trainerId(id, n), stageId: id } };
        stage = { phase: 'trainer', n, ms: 0 };
      } else if (spot.kind === 'rival' && (rt.headless || rt.away) && aliveCount(save) > 0) {
        // 안 볼 때 · VS Code 에 포커스가 없을 때 라이벌 — 이로치처럼 바로 앞에서 멈추고 알림 (드문 일을 자동 전투로 놓치지 않게, 2026-10-20 ideas #87), 다시 보면 걸어가 만남
        save = withProgress(save, id, Math.max(from, spot.at - BEFORE_SPOT));
        stage = { phase: 'hold', why: 'rival' };
        notice = 'rival';
      } else if (spot.kind === 'rival') {
        // 라이벌 깜짝 등장 (gdd 4.12) — 가장 덜 만난 라이벌, 트레이너처럼 멈추고 "!" → 띠 → 전투 (자동 전투여도)
        // 살아 있는 포켓몬이 없으면 (이상한 세이브) 싸우지 않고 지나감 — 전적도 안 셈 (테스터)
        const rival = aliveCount(save) > 0 ? pickRival(save) : null;
        save = withProgress(save, id, spot.at);
        if (rival) {
          save = { ...save, pendingEncounter: { kind: 'rival', rival, stageId: id } };
          stage = { phase: 'rival', rival, ms: 0 };
        }
      } else {
        const number = layout.spots.filter((s) => s.kind === 'request' && s.at < spot.at).length;
        save = withProgress(save, id, Math.max(from, spot.at - BEFORE_SPOT));
        // 안 볼 때는 다음 걸음에 바로 [도와준다] (ideas #115) — 알림 없음
        stage = { phase: 'request', at: spot.at, number, result: null, ms: 0 };
      }
      break;
    }
    case 'hold':
      if (!rt.headless && !rt.away) stage = { phase: 'walk' }; // 보이고 VS Code 로 돌아오면 그 흔적으로 걸어감
      break;
    case 'facility': {
      if (stage.inside) break; // 병원 · 상점 안 — [나가기] 를 기다림
      const ms = stage.ms + stepMs;
      if (rt.headless || ms >= TIMING.facilityPromptMs) {
        save = passFacility(save, id, stage.kind, stage.at);
        // 병원을 지나면 쌓아 둔 새 기술 고르기를 한 번에 (ideas #72) — 안 볼 때는 꺼내지 않음 (걷다 지나는 병원과 같게 · 스테이지 클리어 때 알림과 같이, 코드 리뷰어)
        if (stage.kind === 'hospital' && !rt.headless) save = takeLaterChoices(save);
        stage = afterResult(save);
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
      stage = { phase: 'battle', battle: startBattle(save, pending.monster, pending.start) };
      break;
    }
    case 'trainer': {
      const ms = stage.ms + stepMs;
      // 3:3 을 손으로 골랐으면 3마리 고르기 — Enter 까지 기다림, 늦어도 teamPickAutoMs 뒤 (안 볼 때 · 자동 전투는 안 기다림 — gdd 4.7 "자동 전투면 멈추지 않고")
      // 고르는 중에 패널이 좁아져 3:3 이 잠기면 기다리지 않음 (고르기가 사라졌는데 10초를 기다린 뒤 1:1 로 시작하던 것 — 코드 리뷰어)
      const picking = stage.pick !== undefined && stage.team === true && !rt.headless && !save.settings.autoBattle && teamLockOf(save, rt) === null;
      // 10초는 VS 가 끝난 뒤 (고르기 줄이 보일 때) 부터 (UX 리뷰어 — VS 를 가리지 않게 고르기는 VS 뒤)
      const pickMs = picking ? (stage.pickMs ?? 0) + (stage.ms >= TIMING.trainerMeetMs ? stepMs : 0) : 0;
      if (ms < TIMING.trainerMeetMs || (picking && pickMs < TIMING.teamPickAutoMs)) {
        stage = { ...stage, ms: Math.min(ms, TIMING.trainerMeetMs), ...(picking ? { pickMs } : {}) };
        break;
      }
      const p = save.pendingEncounter;
      const n = p?.kind === 'trainer' ? trainerNumber(p.trainerId) : 0;
      stage =
        p?.kind !== 'trainer'
          ? { phase: 'walk' }
          : useTeam(save, rt, stage.team)
            ? { phase: 'team', team: trainerTeamBattle(save, id, prog, n, stage.pick) }
            : { phase: 'battle', battle: trainerBattle(save, id, prog, n) };
      break;
    }
    case 'rival': {
      const ms = stage.ms + stepMs;
      if (ms < TIMING.rivalMeetMs) {
        stage = { ...stage, ms };
        break;
      }
      const p = save.pendingEncounter;
      stage = p?.kind === 'rival' ? { phase: 'battle', battle: rivalBattle(save, id, prog, p.rival) } : { phase: 'walk' };
      break;
    }
    case 'battle': {
      const rng = new Rng(rt.rngState);
      let battle = battleStep(stage.battle, save, stepMs, rng, { auto: save.settings.autoBattle, away: rt.headless });
      // 라이벌에게 짐 — 끝 문구를 "연습 경기" 로 (원작의 "눈앞이 깜깜해졌다" = 돈 · 병원인데 여기선 잃는 게 없어서, gdd 4.12)
      const rivalNow = save.pendingEncounter?.kind === 'rival' ? save.pendingEncounter.rival : null;
      if (rivalNow && battle.phase === 'over' && stage.battle.phase !== 'over' && battle.result !== 'win') battle = { ...battle, msg: rivalLoseMsg(rivalNow) };
      rt = { ...rt, rngState: rng.state };
      if (!battleDone(battle)) {
        stage = { phase: 'battle', battle };
        break;
      }
      // 이겼어도 (반동 · 독으로) 내 팀이 다 쓰러졌으면 진 것과 같이
      const wiped = battle.me.hp <= 0 && switchable(battle, save).length === 0;
      const before = save;
      const rivalP = before.pendingEncounter?.kind === 'rival' ? before.pendingEncounter : null;
      if (rivalP && (battle.result !== 'win' || wiped)) {
        // 라이벌에게 짐 (gdd 4.12) — 연습 경기: 세이브를 싸우기 전 그대로 (HP · PP · 상태 · 가방) + 전적 1패 · 돈 · 병원 없음 · 계속 걸음
        save = withRivalResult({ ...before, pendingEncounter: null }, rivalP.rival, false);
        rt = { ...rt, rngState: rng.state, toast: { text: rivalLine(rivalP.rival, false, rivalRecord(save, rivalP.rival)), ms: TIMING.toastMs * 2 } };
        signal = 'battle-end';
        stage = { phase: 'walk' };
        break;
      }
      save = applyBattleResult(save, battle);
      signal = battle.result === 'catch' ? 'catch' : 'battle-end';
      if ((battle.result === 'win' || battle.result === 'catch') && !wiped) {
        // S12 전투 결과 — 경험치 · 레벨업 · 돈 · 아이템 · 잡은 포켓몬 (세이브에 바로), 고를 것은 pendingChoices
        const wild = before.pendingEncounter?.kind === 'wild' ? before.pendingEncounter.monster : null;
        const r = battleRewards(save, battle, wild, id, rng);
        save = r.save;
        if (battle.result === 'catch') save = withRun(save, id, (run) => ({ ...run, caught: run.caught + 1 }));
        const p = before.pendingEncounter;
        if (p?.kind === 'rival') {
          // 라이벌에게 이김 — 돈 1.5배 + 아이템 (처음 = 진화의 돌) · 전적 1승 · 한마디
          const w = rivalWinRewards(save, r.summary, p.rival, rng);
          save = withRivalResult(w.save, p.rival, true);
          r.summary = { ...w.summary, quote: rivalLine(p.rival, true, rivalRecord(save, p.rival)), rival: true };
        }
        if (battle.kind === 'trainer' && p?.kind === 'trainer') {
          // 이긴 트레이너는 다시 안 나옴 (다시 걸어도 — 2026-10-18 태현 님)
          save = withStage(save, id, (s) => ({ ...s, defeatedTrainers: s.defeatedTrainers.includes(p.trainerId) ? s.defeatedTrainers : [...s.defeatedTrainers, p.trainerId], run: { ...s.run, trainers: s.run.trainers + 1 } }));
        }
        rt = { ...rt, rngState: rng.state };
        stage = { phase: 'result', summary: r.summary, ms: 0 };
        break;
      }
      if (battle.result === 'flee' && !wiped) {
        // 내가 도망 = "무사히 도망쳤다!" · 볼 3번을 다 놓쳐 상대가 도망 = "… 도망쳐 버렸다…" (2026-10-20)
        rt = { ...rt, toast: { text: battle.msg || '무사히 도망쳤다!', ms: TIMING.toastMs } };
        stage = { phase: 'walk' };
        break;
      }
      // S17 패배
      const d = stageDefeat(save, id);
      save = d.save;
      rt = { ...rt, rngState: rng.state };
      // 5초 뒤 (안 볼 때는 다음 걸음에) 저절로 다시 시작 (ideas #49) — 같은 판 두 번째 패배부터는 기다리고 안 볼 때 알림 (지고 또 지며 돈이 빠지지 않게, 코드 리뷰어)
      stage = { phase: 'defeat', gym: false, lost: d.lost };
      if (rt.headless && defeatWaits(save, stage)) notice = 'defeat';
      break;
    }
    case 'team': {
      // 3:3 실시간 (orders #17) — 이기면 1:1 트레이너와 같은 길 (결과 · 돈 ×1.5 · 다시 안 나옴).
      // 지면 그 트레이너에게만 진 것 — 남은 포켓몬이 있으면 돈 −10% · 쓰러진 셋은 그대로 · 계속 걸음, 없을 때만 S17 (2026-10-21 태현 님 "추천안대로")
      const rng = new Rng(rt.rngState);
      let team = teamStep(stage.team, stepMs, rng, { auto: save.settings.autoBattle, away: rt.headless });
      rt = { ...rt, rngState: rng.state };
      if (team.phase === 'over' && stage.team.phase !== 'over' && team.result === 'lose' && aliveCount(applyTeamResult(save, team)) > 0) {
        team = { ...team, msg: `${team.foeName}에게 졌다… 남은 포켓몬으로 계속 간다` };
      }
      if (!teamDone(team)) {
        stage = { phase: 'team', team };
        break;
      }
      const p = save.pendingEncounter;
      save = applyTeamResult(save, team);
      signal = 'battle-end';
      if (team.result === 'win') {
        const r = teamRewards(save, team, id, rng);
        save = r.save;
        if (p?.kind === 'trainer') {
          save = withStage(save, id, (s) => ({ ...s, defeatedTrainers: s.defeatedTrainers.includes(p.trainerId) ? s.defeatedTrainers : [...s.defeatedTrainers, p.trainerId], run: { ...s.run, trainers: s.run.trainers + 1 } }));
        }
        rt = { ...rt, rngState: rng.state };
        stage = { phase: 'result', summary: r.summary, ms: 0 };
        break;
      }
      if (aliveCount(save) > 0) {
        // 그 트레이너에게만 짐 — 트레이너는 이긴 게 아니라 지나간 자리 (졌다 다시 걸을 때 · 다음 판에 또 나옴), 회복은 병원에서
        const lost = Math.floor(save.money * BALANCE.defeatMoneyLoss);
        save = { ...save, money: save.money - lost };
        rt = { ...rt, toast: { text: `${team.foeName}에게 졌다… 돈 −${lost.toLocaleString('en-US')}원`, ms: TIMING.toastMs * 2 } };
        stage = afterResult(save);
        break;
      }
      const d = stageDefeat(save, id);
      save = d.save;
      stage = { phase: 'defeat', gym: false, lost: d.lost };
      if (rt.headless && defeatWaits(save, stage)) notice = 'defeat';
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
      if (!stage.result) {
        // 10초 뒤 (안 볼 때는 바로) 저절로 [도와준다] (2026-10-21 ideas #115 — 고른 순간 진행 % 는 자리로, applyInput)
        const wait = stage.ms + stepMs;
        if (!rt.headless && wait < TIMING.requestAutoMs) {
          stage = { ...stage, ms: wait };
          break;
        }
        const helped = applyInput({ save, runtime: { ...rt, stage, stageId: id } }, { kind: 'request', help: true });
        return { save: helped.save, rt: helped.runtime, signal: null, notice: null };
      }
      const ms = stage.ms + stepMs;
      stage = ms < TIMING.requestResultMs ? { ...stage, ms } : { phase: 'walk' };
      break;
    }
    case 'clear': {
      // 끝까지 왔는데 아직 클리어 처리를 안 한 세이브 (단계 9 전에 끝에 서 있던 세이브) — 지금 처리
      if (!prog.cleared) return finishStage(save, rt, id);
      // 자동 전투면 10초 뒤 (안 볼 때는 바로) [다음 스테이지] (2026-10-21 ideas #48)
      if (!save.settings.autoBattle) break;
      const ms = (stage.ms ?? 0) + stepMs;
      if (rt.headless || ms >= TIMING.clearAutoMs) {
        // 다음 스테이지를 이미 깼으면 (깬 스테이지를 다시 돌며 키우는 중) 같은 스테이지를 새 판으로 · 아니면 다음 (2026-10-21 태현 님 A)
        const next = nextPlace(id);
        const t = travel({ save, runtime: { ...rt, stage, stageId: id } }, next !== 'gym' && save.stages[next]?.cleared ? id : next);
        return { save: t.save, rt: t.runtime, signal: null, notice: null };
      }
      stage = { ...stage, ms };
      break;
    }
    case 'gym-enter': {
      const ms = stage.ms + stepMs;
      if (ms >= TIMING.gymEnterMs || rt.headless) return finishStage(save, rt, id);
      stage = { ...stage, ms };
      break;
    }
    case 'defeat':
      stage = defeatStep(stage, rt, stepMs, defeatWaits(save, stage));
      break;
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
  // 클리어 보너스 — 경험 부적 판이면 ×1.5 (한 줄 알림에도 같은 수)
  const bonus = stageClearExp(save0, id);
  const r = clearStage(save0, id, rng);
  // 쌓아 둔 새 기술 고르기를 한 번에 (클리어 카드 전, ideas #72)
  let save = takeLaterChoices(r.save);
  let rt: RuntimeState = { ...rt0, rngState: rng.state };
  // 두 마리까지 이름 · 나머지는 "외 N마리" (5 ~ 6마리면 240×150 에서 3줄로 자라 대기실 버튼을 가림 — 2026-10-21 UX 리뷰어)
  const lv = r.levelUps.length > 2 ? `${r.levelUps.slice(0, 2).join(' · ')} 외 ${r.levelUps.length - 2}마리` : r.levelUps.join(' · ');
  if (id === 'forest-3') {
    save = { ...save, location: { screen: 'gym' } };
    // 클리어 → 레벨업을 두 알림으로 차례로 (각 2.5초 · 합 5초) — 한 줄이면 6마리 레벨업에 약 660px (2026-10-21 UX 리뷰어)
    const head = `${stageCode(id)} 클리어! 경험치 +${bonus} · 볼 +${BALANCE.clearBalls}`;
    rt = { ...rt, toast: lv ? { text: head, ms: TIMING.toastMs, then: lv } : { text: head, ms: TIMING.toastMs * 2 } };
  } else if (lv) rt = { ...rt, toast: { text: lv, ms: TIMING.toastMs * 2 } };
  const stage = afterResult(save);
  // 자동 전투면 클리어 카드가 저절로 넘어가니 알림 없음 (ideas #48)
  const notice: GameNotice | null = !rt.headless ? null : stage.phase === 'choice' ? 'choice' : id === 'forest-3' ? 'gym' : save.settings.autoBattle ? null : 'clear';
  return { save, rt: { ...rt, stage, stageId: id === 'forest-3' ? null : id }, signal: 'stage-clear', notice };
}

/** S12 결과 (5초 — 잡았으면 앞에 소개 카드 1.5초 · 계속) · S23 · S22 고르기 (고를 때까지, ms = 진화 연출) — 스테이지 · 체육관이 같이 씀 */
function resultOrChoiceStep(stage: Extract<StageRuntime, { phase: 'result' | 'choice' }>, save: Save, stepMs: number): StageRuntime {
  if (stage.phase === 'result') {
    const ms = stage.ms + stepMs;
    // 잡았으면 소개 카드 시간만큼 더 (결과 상자는 늘 5초)
    return ms < TIMING.resultMs + (stage.summary.caught ? TIMING.caughtIntroMs : 0) ? { ...stage, ms } : afterResult(save, stage.then);
  }
  // 고를 것이 없으면 다음으로 · 있으면 고를 때까지 (ms = 진화 연출, 다 차면 그대로 · −1 = 진화를 보기 전 기다림)
  if (save.pendingChoices.length === 0) return afterResult(save, stage.then);
  if (stage.ms < 0) return stage;
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
    if (s.phase === 'team') return s.team.kind === 'gym' && pending?.kind === 'gym-leader';
    if (save.pendingChoices.length > 0 && s.phase !== 'result' && s.phase !== 'choice') return false;
    return s.phase === 'lobby' || s.phase === 'result' || s.phase === 'choice' || s.phase === 'defeat' || s.phase === 'badge';
  };
  let stage: StageRuntime = okHere(st)
    ? st
    : save.pendingChoices.length > 0
      ? choiceStage(save)
      : pending?.kind === 'gym-leader'
        ? useTeam(save, rt, true)
          ? { phase: 'team', team: leaderTeamBattle(save) }
          : { phase: 'battle', battle: leaderBattle(save) }
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
      break;
    }
    case 'team': {
      // 관장전 3:3 (orders #17) — 1:1 토너먼트와 같은 길 (처음 이기면 배지 · MVP 끝 카드, 지면 대기실)
      const rng = new Rng(rt.rngState);
      const team = teamStep(stage.team, stepMs, rng, { auto: save.settings.autoBattle, away: rt.headless });
      rt = { ...rt, rngState: rng.state };
      if (!teamDone(team)) {
        stage = { phase: 'team', team };
        break;
      }
      save = applyTeamResult(save, team);
      signal = 'battle-end';
      if (team.result === 'win') {
        const first = !save.badges.includes(FOREST_BADGE);
        const r = teamRewards(save, team, 'gym', rng);
        save = r.save;
        rt = { ...rt, rngState: rng.state };
        stage = first ? { phase: 'result', summary: r.summary, ms: 0, then: 'badge' } : { phase: 'result', summary: r.summary, ms: 0 };
        break;
      }
      save = defeatPenalty(save, true).save;
      stage = { phase: 'defeat', gym: true, lost: 0 };
      break;
    }
    case 'result':
    case 'choice': {
      const next = resultOrChoiceStep(stage, save, stepMs);
      if (next.phase === 'choice' && stage.phase === 'result' && rt.headless) notice = 'choice';
      stage = next;
      break;
    }
    case 'defeat':
      stage = defeatStep(stage, rt, stepMs, false);
      break;
    default:
      break;
  }
  return { save, rt: { ...rt, stage, stageId: null }, signal, notice };
}

/** 걸음 하나 */
export function step(state: GameState, stepMs: number): StepOut {
  let save: Save = { ...state.save, playTimeMs: state.save.playTimeMs + stepMs };
  let rt: RuntimeState = state.runtime;
  if (rt.toast) rt = { ...rt, toast: rt.toast.ms > stepMs ? { ...rt.toast, ms: rt.toast.ms - stepMs } : rt.toast.then ? { text: rt.toast.then, ms: TIMING.toastMs } : null };
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
  rt = awayStep(state, save, rt, signal);
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
    // 3:3 은 메뉴 없이 늘 흘러감
    case 'team':
      return false;
    case 'choice':
      return state.save.pendingChoices.length > 0;
    // 부탁 = 10초 뒤 · 안 볼 때 바로 [도와준다] — 기다리지 않음 (러너가 부탁 앞에서 멈추면 아무 일도 안 일어남 — 2026-10-21 코드 리뷰어)
    case 'request':
      return false;
    case 'facility':
      return st.inside;
    // 패배 상자 = 저절로 다시 시작 (ideas #49) — 같은 판 두 번째 패배부터는 기다림 · 클리어 카드 = 자동 전투면 저절로 다음 (ideas #48)
    case 'defeat':
      return defeatWaits(state.save, st);
    case 'clear':
      return !state.save.settings.autoBattle;
    case 'hold':
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
  return p === 'battle' || p === 'appear' || p === 'trainer' || p === 'rival' || p === 'team';
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
  // 경험 부적 — 스테이지를 새로 시작할 때 1개를 써서 이 판 동안 경험치 ×1.5 (2026-10-21 ideas #70)
  const charm = (save.bag['exp-charm'] ?? 0) > 0;
  if (charm) save = withRun({ ...save, bag: { ...save.bag, 'exp-charm': (save.bag['exp-charm'] ?? 0) - 1 } }, to, (r) => ({ ...r, boost: true }));
  const charmText = `경험 부적을 썼다! 이 스테이지 경험치 ×${BALANCE.expCharmScale}`;
  // 앞 알림 (클리어 · 레벨업) 이 떠 있으면 덮지 않고 그 뒤에 (코드 리뷰어)
  const prev = state.runtime.toast;
  const toastNow = !charm ? prev : prev ? { ...prev, then: prev.then ? `${prev.then} · ${charmText}` : charmText } : { text: charmText, ms: TIMING.toastMs * 2 };
  return { save, runtime: { ...state.runtime, rngState: rng.state, stage: null, stageId: to, toast: toastNow } };
}

/** 입력 — 지금 받을 수 없는 입력이면 상태를 그대로 돌려줌 */
export function applyInput(state: GameState, input: GameInput): GameState {
  const stage = state.runtime.stage;
  const save = state.save;
  switch (input.kind) {
    case 'space':
      if (stage?.phase === 'battle') return withBattleInput(state, { kind: 'space', extraMs: state.runtime.stepAccMs });
      if (stage?.phase === 'team') return applyInput(state, { kind: 'team-battle', input: { kind: 'space' } });
      // S12 계속 · S22 진화 연출 빨리 넘기기
      if (stage?.phase === 'result') return applyInput(state, { kind: 'result-continue' });
      if (stage?.phase === 'choice') return applyInput(state, { kind: stage.ms < 0 ? 'evolve-watch' : 'evolve-skip' });
      // 체육관 들어가기 — 바로 대기실로 (다음 걸음에 클리어 처리)
      if (stage?.phase === 'gym-enter') return stage.ms >= TIMING.gymEnterMs ? state : { ...state, runtime: { ...state.runtime, stage: { ...stage, ms: TIMING.gymEnterMs } } };
      // 트레이너 · 라이벌 만남 — "!" 가 지난 뒤 Space · 클릭 = 바로 전투 (2026-10-20 태현 님 "2초 정도 두고 클릭하면 바로 넘어가게")
      if ((stage?.phase === 'trainer' || stage?.phase === 'rival') && stage.ms >= TIMING.trainerAlertMs) {
        const end = stage.phase === 'rival' ? TIMING.rivalMeetMs : TIMING.trainerMeetMs;
        // 3마리 고르기 중이면 Enter · Space = 체크된 셋으로 바로 시작
        if (stage.phase === 'trainer' && stage.pick) return { ...state, runtime: { ...state.runtime, stage: { ...stage, ms: end, pickMs: TIMING.teamPickAutoMs } } };
        return stage.ms >= end ? state : { ...state, runtime: { ...state.runtime, stage: { ...stage, ms: end } } };
      }
      // 야생이 튀어나온 순간은 아무 일 없음 (선제공격은 스피드로, 2026-10-21)
      return state;
    case 'battle':
      return stage?.phase === 'battle' ? withBattleInput(state, input.input) : state;
    case 'team-battle': {
      if (stage?.phase !== 'team') return state;
      const rng = new Rng(state.runtime.rngState);
      const team = teamInput(stage.team, input.input, rng);
      return team === stage.team ? state : { ...state, runtime: { ...state.runtime, rngState: rng.state, stage: { phase: 'team', team } } };
    }
    case 'team-mode': {
      if (stage?.phase !== 'trainer' || !teamOn(state.runtime) || (input.on && teamLock(state) !== null) || stage.team === input.on) return state;
      // 고른 방식을 기억 — 다음 트레이너 (자동 전투 · 안 볼 때 포함) 는 이걸로. 3:3 이면 3마리 고르기를 염 (상성 좋은 셋이 미리 체크 — gdd 4.7)
      const id = state.runtime.stageId;
      const prog = id ? save.stages[id] : undefined;
      const pick = input.on && id && prog ? fillPick(save, undefined, trainerFoes(save, id, prog, stage.n)) : undefined;
      const { pick: _p, pickMs: _m, ...rest } = stage;
      return { save: { ...save, settings: { ...save.settings, teamMode: input.on } }, runtime: { ...state.runtime, stage: { ...rest, team: input.on, ...(pick ? { pick, pickMs: 0 } : {}) } } };
    }
    case 'team-pick': {
      const cur = teamPickOf(state);
      if (!cur || !save.party.includes(input.uid) || (save.monsters[input.uid]?.hp ?? 0) <= 0 || (stage?.phase !== 'trainer' && stage?.phase !== 'lobby')) return state;
      const pick = cur.includes(input.uid) ? cur.filter((u) => u !== input.uid) : [...cur, input.uid].slice(-BALANCE.team.size);
      return { ...state, runtime: { ...state.runtime, stage: { ...stage, pick } } };
    }
    case 'view': {
      const w = Math.round(input.w);
      const h = Math.round(input.h);
      if (!Number.isFinite(w) || !Number.isFinite(h) || w < 0 || h < 0 || w > 20_000 || h > 20_000) return state;
      const v = state.runtime.view;
      return v && v.w === w && v.h === h ? state : { ...state, runtime: { ...state.runtime, view: { w, h } } };
    }
    case 'auto-battle': {
      if (save.settings.autoBattle === input.on) return state;
      const next = { ...save, settings: { ...save.settings, autoBattle: input.on } };
      return input.say ? toast(state, next, input.on ? '자동 전투 켜짐 (A)' : '자동 전투 꺼짐 (A)') : { ...state, save: next };
    }
    case 'fast-walk':
      if ((save.settings.fastWalk === true) === input.on) return state;
      return { ...state, save: { ...save, settings: { ...save.settings, fastWalk: input.on } } };
    case 'reduce-motion':
      if ((save.settings.reduceMotion === true) === input.on) return state;
      return { ...state, save: { ...save, settings: { ...save.settings, reduceMotion: input.on } } };
    case 'auto-potion':
      if ((save.settings.autoPotion !== false) === input.on) return state;
      return { ...state, save: { ...save, settings: { ...save.settings, autoPotion: input.on } } };
    case 'skip-caught-last':
      if ((save.settings.skipCaughtLast === true) === input.on) return state;
      return { ...state, save: { ...save, settings: { ...save.settings, skipCaughtLast: input.on } } };
    case 'tip-seen':
      if (!isTipId(input.id) || save.tips?.includes(input.id) || (save.tips?.length ?? 0) >= TIPS_MAX) return state;
      return { ...state, save: { ...save, tips: [...(save.tips ?? []), input.id] } };
    case 'notifications':
      if (save.settings.notifications === input.on) return state;
      return { ...state, save: { ...save, settings: { ...save.settings, notifications: input.on } } };
    case 'result-continue':
      if (stage?.phase !== 'result') return state;
      // 잡은 포켓몬 소개 카드가 떠 있으면 먼저 소개만 넘김 (결과 상자로)
      if (stage.summary.caught && stage.ms < TIMING.caughtIntroMs) return { ...state, runtime: { ...state.runtime, stage: { ...stage, ms: TIMING.caughtIntroMs } } };
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
    case 'evolve-watch':
      if (stage?.phase !== 'choice' || save.pendingChoices[0]?.kind !== 'evolve' || stage.ms >= 0) return state;
      return { ...state, runtime: { ...state.runtime, stage: { ...stage, ms: 0 } } };
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
      // 팔 물건 — 부탁을 끝내면 (성공) 25% (2026-10-21 ideas #125)
      let after = outcome.save;
      let reward = outcome.reward;
      if (outcome.ok && rng.chance(BALANCE.treasureChance.request)) {
        const t = pickTreasure(rng);
        after = addItem(after, t);
        reward = [reward, itemName(t)].filter(Boolean).join(' · ');
      }
      return {
        save: withProgress(after, id, stage.at),
        runtime: { ...state.runtime, rngState: rng.state, stage: { ...stage, result: { ok: outcome.ok, text: outcome.text, reward }, ms: 0 } },
      };
    }
    case 'facility': {
      if (stage?.phase !== 'facility' || stage.inside || save.location.screen !== 'stage') return state;
      // 고른 순간 진행 % 를 그 자리로 (병원이면 마지막 병원) — 안에서 꺼도 다시 켜면 그 앞을 지나 걸음
      const passed = passFacility(save, save.location.stageId, stage.kind, stage.at);
      if (input.enter) return { save: passed, runtime: { ...state.runtime, stage: { ...stage, inside: true } } };
      // 병원을 지나면 쌓아 둔 새 기술 고르기를 한 번에 (ideas #72)
      const next = stage.kind === 'hospital' ? takeLaterChoices(passed) : passed;
      return { save: next, runtime: { ...state.runtime, stage: afterResult(next) } };
    }
    case 'facility-heal': {
      if (stage?.phase !== 'facility' || stage.kind !== 'hospital' || stage.inside || save.location.screen !== 'stage') return state;
      const healed = takeLaterChoices(healTeam(passFacility(save, save.location.stageId, stage.kind, stage.at)));
      return { save: healed, runtime: { ...state.runtime, stage: afterResult(healed), toast: { text: '포켓몬들이 모두 기운을 되찾았다!', ms: TIMING.toastMs } } };
    }
    case 'facility-leave': {
      if (stage?.phase !== 'facility' || !stage.inside) return state;
      const next = stage.kind === 'hospital' ? takeLaterChoices(save) : save;
      return { save: next, runtime: { ...state.runtime, stage: afterResult(next) } };
    }
    case 'heal':
      if (!canHeal(state)) return state;
      return toast(state, healTeam(save), '포켓몬들이 모두 기운을 되찾았다!');
    case 'buy': {
      if (!canShop(state) || !isShopItem(input.item)) return state;
      // 이상한사탕 = 스테이지 상점에서 한 판에 1개 (대기실 상점엔 없음 — 2026-10-21 ideas #70)
      const candy = input.item === 'rare-candy';
      const at = save.location.screen === 'stage' ? save.location.stageId : null;
      if (candy && !canBuyCandy(save)) return state;
      // Shift + 클릭 = 5개 (ideas #50) — 돈 · 가방이 모자라면 산 만큼
      const want = candy ? 1 : Math.max(1, Math.min(BALANCE.shopBulk, Math.floor(input.count ?? 1)));
      let next = save;
      let got = 0;
      for (; got < want; got++) {
        const b = buy(next, input.item);
        if (!b) break;
        next = b;
      }
      if (got === 0) return state;
      if (candy && at) next = withRun(next, at, (r) => ({ ...r, candy: (r.candy ?? 0) + 1 }));
      return toast(state, next, `${withJosa(itemName(input.item), '을/를')} ${got > 1 ? `${got}개 ` : ''}샀다!`);
    }
    case 'sell': {
      if (!canShop(state)) return state;
      const r = sell(save, input.item, Math.min(BALANCE.shopBulk, input.count ?? 1));
      return r ? toast(state, r.save, `${withJosa(itemName(input.item), '을/를')} ${r.count > 1 ? `${r.count}개 ` : ''}팔았다! +${r.money}원`) : state;
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
      // 이상한사탕 — 1레벨 (새 기술 · 진화 고르기가 생기면 고르기로, ideas #70)
      if (input.item === 'rare-candy') {
        const rng = new Rng(state.runtime.rngState);
        const next = useRareCandy(save, input.uid, rng);
        const m = next?.monsters[input.uid];
        if (!next || !m) return state;
        const name = speciesOf(m.species)?.name.ko ?? m.form;
        const stageNow = next.pendingChoices.length > save.pendingChoices.length ? choiceStage(next) : state.runtime.stage;
        return toast({ save, runtime: { ...state.runtime, rngState: rng.state, stage: stageNow } }, next, `${withJosa(name, '은/는')} Lv ${m.level} 이 됐다!`);
      }
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
      // 관장전 = 3:3 (못 하면 1:1 토너먼트 — orders #17)
      const pick = stage?.phase === 'lobby' ? stage.pick : undefined;
      const stageNow: StageRuntime = useTeam(next, state.runtime, true) ? { phase: 'team', team: leaderTeamBattle(next, pick) } : { phase: 'battle', battle: leaderBattle(next) };
      return { save: next, runtime: { ...state.runtime, stage: stageNow } };
    }
    case 'badge-continue':
      if (stage?.phase !== 'badge') return state;
      return { ...state, runtime: { ...state.runtime, stage: { phase: 'lobby' } } };
  }
}

/** S12 다음 — 고를 것 (S23 · S22) 이 있으면 고르기, 없으면: MVP 끝 카드 · 대기실 · 클리어 카드 · 걷기 */
function afterResult(save: Save, then?: 'badge'): StageRuntime {
  if (save.pendingChoices.length > 0) return choiceStage(save, then);
  if (then === 'badge') return { phase: 'badge' };
  if (save.location.screen === 'gym') return { phase: 'lobby' };
  const prog = save.location.screen === 'stage' ? save.stages[save.location.stageId] : undefined;
  return prog && prog.progress >= 1 ? { phase: 'clear' } : { phase: 'walk' };
}

/** S23 · S22 고르기 시작 — 진화는 "어…? ○○의 모습이…!" 에서 기다렸다 보면 연출 (ms −1, 2026-10-21 ideas #33 — 코딩 중에 4초 연출을 놓치지 않게) */
function choiceStage(save: Save, then?: 'badge'): StageRuntime {
  const ms = save.pendingChoices[0]?.kind === 'evolve' ? -1 : 0;
  return then ? { phase: 'choice', ms, then } : { phase: 'choice', ms };
}

/** 패배 상자 — 5초 뒤 (안 볼 때는 바로) 저절로 다시 시작 = [다시 시작] 과 같음 (ideas #49). wait = 기다림 (같은 판 두 번째 패배부터) */
function defeatStep(stage: Extract<StageRuntime, { phase: 'defeat' }>, rt: RuntimeState, stepMs: number, wait: boolean): StageRuntime {
  if (wait) return stage;
  const ms = (stage.ms ?? 0) + stepMs;
  if (rt.headless || ms >= TIMING.defeatAutoMs) return stage.gym ? { phase: 'lobby' } : { phase: 'walk' };
  return { ...stage, ms };
}

/** 스테이지 패배를 기다릴지 — 같은 판에서 두 번째 패배부터 (run.retries ≥ 2, 관장전 패배는 돈을 안 잃어 늘 저절로). 처음 한 번만 저절로 다시 걸어 돈이 계속 빠지는 고리를 막음 (2026-10-21 코드 리뷰어) */
export function defeatWaits(save: Save, stage: Extract<StageRuntime, { phase: 'defeat' }>): boolean {
  if (stage.gym || save.location.screen !== 'stage') return false;
  return (save.stages[save.location.stageId]?.run.retries ?? 0) >= 2;
}

/** 3:3 보상 — 1:1 과 같은 계산 (쓰러뜨린 상대 · 싸운 셋) + 돈 ×1.5 (orders #17) */
function teamRewards(save: Save, team: TeamBattle, where: StageId | 'gym', rng: Rng): { save: Save; summary: BattleSummary } {
  const r = battleRewards(save, teamRewardBattle(team), null, where, rng);
  // 트레이너전만 ×1.5 (관장 돈은 처음 3000 · 다시 300 그대로 — 명세 검사관)
  const extra = where === 'gym' ? 0 : Math.round(r.summary.money * (BALANCE.team.moneyScale - 1));
  return { save: { ...r.save, money: Math.min(999_999_999, r.save.money + extra) }, summary: { ...r.summary, money: r.summary.money + extra } };
}

/** 진행 막대 끝 "약 N분 남음" — 남은 걷기 시간 (전투 · 부탁 빼고, 빨리 걷기면 그 빠르기로 어림 — 2026-10-21 ideas #118). 스테이지가 아니면 null */
export function walkLeftMs(save: Save): number | null {
  if (save.location.screen !== 'stage') return null;
  const p = save.stages[save.location.stageId]?.progress ?? 0;
  return (Math.max(0, 1 - p) * BALANCE.stageWalkMs) / (save.settings.fastWalk === true ? BALANCE.fastWalkSpeed : 1);
}

/** 클리어 카드 [다음 스테이지] — 다음 스테이지 (마지막이면 체육관) */
function nextPlace(id: StageId): StageId | 'gym' {
  return STAGE_IDS[STAGE_IDS.indexOf(id) + 1] ?? 'gym';
}

/**
 * 자리 비운 동안 (ideas #16) — 확장이 계산하는 동안 떠날 때의 돈 · 가방을 적고 야생 전투를 셈.
 * 다시 보면 (웹뷰) 한 줄이 보이는 때 (걷기 · 클리어 카드 · 대기실, 다른 한 줄이 없을 때) "그동안: 몬스터볼 1 · 상처약 1 · 60원 · 야생 3마리" 를 띄우고 지움 — 바뀐 게 없으면 띄우지 않음
 */
function awayStep(before: GameState, save: Save, rt: RuntimeState, signal: SaveSignal | null): RuntimeState {
  if (rt.headless) {
    const prev = before.runtime.stage;
    // 잡은 야생도 셈 (신호가 'catch')
    const wildEnd = (signal === 'battle-end' || signal === 'catch') && prev?.phase === 'battle' && prev.battle.kind === 'wild';
    if (rt.awayLog && !wildEnd) return rt;
    const log: AwayLog = rt.awayLog ?? { money: before.save.money, bag: { ...before.save.bag }, wild: 0 };
    return { ...rt, awayLog: wildEnd ? { ...log, wild: log.wild + 1 } : log };
  }
  if (!rt.awayLog) return rt;
  const phase = rt.stage?.phase;
  if (rt.toast || !(phase === 'walk' || phase === 'clear' || phase === 'lobby')) return rt;
  const { awayLog, ...rest } = rt;
  const text = awaySummary(awayLog, save);
  return text ? { ...rest, toast: { text, ms: TIMING.awaySummaryMs } } : rest;
}

/** "그동안: 몬스터볼 1 · 상처약 1 · 60원 · 야생 3마리" — 늘어난 물건 · 돈 (줄었으면 −) · 싸운 야생. 없으면 빈 글 */
export function awaySummary(log: AwayLog, save: Save): string {
  const parts: string[] = [];
  for (const id of ITEM_IDS) {
    const d = (save.bag[id] ?? 0) - (log.bag[id] ?? 0);
    if (d > 0) parts.push(`${itemName(id)} ${d}`);
  }
  const dm = save.money - log.money;
  if (dm !== 0) parts.push(dm > 0 ? `${dm}원` : `−${-dm}원`);
  if (log.wild > 0) parts.push(`야생 ${log.wild}마리`);
  return parts.length > 0 ? `그동안: ${parts.join(' · ')}` : '';
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
