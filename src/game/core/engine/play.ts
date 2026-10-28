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
import { buy, canBuyCandy, healBox, healTeam, isShopItem, moveInTeam, release, sell, spendPoint, swapWithBox, teamHealth, toBox, useFieldItem, walkRegen } from '../rules/bag';
import { createWild, encounterStart, pickupAt, planWild, wildKey } from '../rules/encounter';
import { itemName, requestAt, resolveRequest } from '../rules/request';
import { DAILY_BONUS, dailyAdd, dailyDone, dailyFor, dailyLabel, dayFarAhead, trainersLeft } from '../rules/daily';
import { gymLocation, isRegionLast, REGIONS, regionGymTeam, regionHere, regionOf, setRegionOrder, type RegionDef } from '../rules/region';
import { effectiveness } from '../rules/types';
import { facilityFix, spotBetween, spotRng, stageCode, stageLayout, trainerId, walkDelta, type Spot, type StageLayout } from '../rules/stage';
import { statsOf } from '../rules/stats';
import { aliveCount, leaderTeam, trainerInfo, trainerNumber, trainerTeam } from '../rules/trainer';
import { evoGotNote, evoTipItem } from '../rules/evo-tip';
import { pickRival, rivalLine, rivalLoseMsg, rivalName, rivalRecord, rivalTeam, withRivalResult } from '../rules/rival';
import { isTipId, ITEM_IDS, REGION_IDS, RUN_SEEN_MAX, TIPS_MAX, type RegionId, type DailyGoal, type FacilitySpot, type ItemId, type Monster, type Save, type StageId, type StageProgress, type StageRun, type StatKey } from '../save';
import { withJosa } from '../text';
import { moveOf, speciesOf } from '../../data';
import { applyBattleResult, battleDone, battleInput, battleStep, battleWaiting, firstAlive, startBattle, startTrainerBattle, switchable, type BattleInput, type BattleState } from './battle';
import { addItem, battleRewards, clearStage, defeatLoss, defeatPenalty, stageClearGain, pickTreasure, resolveEvolve, resolveLearn, rivalWinRewards, takeLaterChoices, useRareCandy, type BattleSummary } from './rewards';
import { Rng } from './rng';
// 개발 모드 (임시)
import { devTeam, devWalk } from '../../dev/runtime';
import { MAX_SPEED, type AwayLog, type GameNotice, type GameState, type RuntimeState, type StageRuntime } from './state';
import { applyTeamResult, pickTeam, startTeamBattle, teamDone, teamFastOk, teamInput, teamJoinOpen, teamPossible, teamRewardBattle, teamScale, teamStep, type TeamBattle, type TeamInput } from './team';
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
  /** go = 1:1 버튼처럼 고르고 바로 VS (team-mode + space 두 입력으로 나뉘어 하나만 먹히면 3:3 이 시작되던 것 — 코드 리뷰어) */
  | { kind: 'team-mode'; on: boolean; go?: boolean }
  /** 3:3 에 나갈 포켓몬 하나를 넣고 빼기 — 트레이너 만남 (3:3 을 골랐을 때) · 대기실. 셋이 차 있으면 가장 먼저 고른 것이 빠짐 */
  | { kind: 'team-pick'; uid: string }
  /** 웹뷰 패널 크기 — 3:3 배율이 바뀔 때만 (teamScale) */
  | { kind: 'view'; w: number; h: number }
  /** S09 ⑫ 자동 전투 스위치 — 세이브 설정에 (다음 전투에도 그대로) */
  /** say = 한 줄 알림 "자동 전투 켜짐 · 꺼짐" (A 키 — 정보줄 스위치가 안 보일 때도 알게, 2026-10-21 코드 리뷰어) */
  | { kind: 'auto-battle'; on: boolean; say?: boolean }
  /** 빨리 걷기 켜기 · 끄기 (S06 정보줄 · S20, 2026-10-19) */
  | { kind: 'fast-walk'; on: boolean }
  /** 빠르게 ▶▶ 켜기 · 끄기 — 3:3 약 1.5배 (보통 공격 두 배 · 알아챌 순간 1초 · 누를 창 그대로 — 화면 위 스위치 · 설정 · C, orders #83). say = 한 줄 알림 (키로 바꿀 때) */
  | { kind: 'battle-fast'; on: boolean; say?: boolean }
  /** 3:3 필살기 연출 켬 · 끔 (V · 위쪽 줄 버튼 — #97) — 다음 필살기부터 */
  | { kind: 'team-cutscene'; on: boolean; say?: boolean }
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
  /** S18 ⑥ 놓아주기 (#121) — 팀 · 보관함 어디서나 (전투 · 고르기 중 빼고) · 확인 상자는 화면이 */
  | { kind: 'release'; uid: string }
  /** n = 한 번에 찍을 포인트 (Shift + 클릭 = 5 — 기획 R16, 남은 만큼까지) */
  | { kind: 'points'; uid: string; stat: StatKey; n?: number }
  /** S19 — 전투 밖에서 아이템 (돌 · 연결의끈은 S22 로) */
  | { kind: 'use-item'; item: ItemId; uid: string }
  /** S20 ③ 알림 (U9) */
  | { kind: 'notifications'; on: boolean }
  /** S17 ② 다시 시작 */
  | { kind: 'defeat-continue' }
  /** 3:3 두 번째 패배 상자 [병원 앞으로] — 팀 회복 · 마지막으로 지나간 병원 앞 (없으면 스테이지 처음) 에서 다시 걷기, 돈은 더 안 뺌 (#152) */
  | { kind: 'defeat-retreat' }
  /** S07 · S24 · S16 ③ — 스테이지 · 체육관으로 */
  /** region = 다른 지역 체육관으로 (to 'gym' 일 때 — 없으면 지금 지역, orders #66) */
  | { kind: 'travel'; to: StageId | 'gym'; region?: RegionId }
  /** 관장 첫 승 뒤 고를 다음 지역 (regions.next) 중 하나 — 연 지역에 더함 (orders #66 · 7-2) */
  | { kind: 'region-pick'; region: RegionId }
  /** S16 ② 관장에게 도전 · MVP 끝 카드 다음 — 3:3 이 되는 대기실은 처음 누르면 3마리 고르기 판 · 판에서 누르면 시작 */
  | { kind: 'challenge' }
  /** S16 3마리 고르기 판 닫기 (Esc — 대기실로) */
  | { kind: 'lobby-back' }
  | { kind: 'badge-continue' }
  /** 관장을 이긴 카드의 주 버튼 — 다음 지역으로 (#127 · 고르기면 region · 없으면 상성 좋은 쪽) */
  | { kind: 'badge-next'; region?: RegionId };

/** 밖 · 숨김에서 게임이 사람을 기다리는 이유 — VS Code 알림 (U9, 설정에서 끔) · 기준은 gdd 4.13 멈춤 · 알림 표 (waitReason · STAGE_WAIT) */
export type { GameNotice } from './state';

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
/** 옛 세이브의 붙은 시설을 옮기려면 그 자리보다 이만큼 앞이어야 함 (시설 앞에 막 선 판 · 들어간 판을 흔들지 않게 — #123) */
const FACILITY_FIX_MARGIN = 0.01;

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
  } else {
    // 같은 종류 둘이 붙어 적힌 옛 자리 (#123) — 바뀌는 자리 (시설 · 따라 밀리는 길 자리 · 라이벌) 를 이번 판에 아직 안 갔으면 지금 고침, 갔으면 다음 판 처음에.
    //   간 곳 = 지금 진행과 이번 판 가장 멀리 간 곳 (졌다 병원 앞으로 돌아와도 들른 상점이 옮겨 다시 나오지 않게 — 코드 리뷰어)
    const fix = facilityFix(id, prog.seed, prog.facilities);
    if (fix && Math.max(prog.progress, prog.run.reach) < fix.firstMoved - FACILITY_FIX_MARGIN) prog = { ...prog, facilities: fix.facilities.map((f) => ({ ...f })) };
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
 * 3:3 으로 싸울지 (orders #17) — 켜져 있고 (모두에게 — orders #59) · 잠기지 않음 (살아 있는 포켓몬 3마리 이상 · 패널에 6마리가 들어감) ·
 * 고른 대로 (고르지 않았으면 마지막으로 고른 방식 — 처음엔 1:1, gdd 4.7 · 명세 검사관). 관장전은 늘 3:3 (choice = true)
 */
function useTeam(save: Save, rt: RuntimeState, choice?: boolean): boolean {
  return teamOn(rt) && teamLockOf(save, rt) === null && (choice ?? teamMain(save));
}

/**
 * 주 버튼 방식 — 마지막으로 고른 방식 · 자동 전투면 3:3 이 기본 (할 수 있으면 — 잠기면 useTeam 이 1:1, orders #71 · #108 A).
 * 이번 판 3:3 에서 진 트레이너면 1:1 (자동 · 안 볼 때도 — 2026-10-21 기획 R8 A)
 */
function teamMain(save: Save): boolean {
  if (save.settings.teamMode !== true && !save.settings.autoBattle) return false;
  const p = save.pendingEncounter;
  return !(p?.kind === 'trainer' && (save.stages[p.stageId]?.run.teamLost ?? []).includes(p.trainerId));
}
/** 화면 — 만남의 주 버튼이 3:3 인지 (teamMode · 이번 판 3:3 에서 진 트레이너면 1:1) */
export function teamMainOf(state: GameState): boolean {
  return teamMain(state.save);
}

/** 3:3 을 켰는지 — 본편은 BALANCE.team.on, 개발 모드 (임시) 는 "3:3 미리 켜기" 로도 */
const teamOn = (rt: RuntimeState) => BALANCE.team.on || devTeam(rt.dev);

/**
 * 3:3 을 고를 수 있는 트레이너 만남 (화면 1:1 / 3:3 · 3마리 고르기) — "!" 뒤 고를 때까지 (늦어도 teamChoiceMs) 기다리고, 고르면 그때 VS (vsAt) → 전투.
 * 자동 전투 · 안 볼 때는 예전처럼 만남 4초 (고르지 않음 — 마지막으로 고른 방식)
 */
function choiceMeet(save: Save, rt: RuntimeState): boolean {
  // 3:3 이 잠기면 (2마리 · 좁음) 고를 게 1:1 하나뿐 — 예전 4초 박자 (화면은 "3마리 필요" 안내, 디자인팀 UX 9차)
  return choiceFree(save, rt) && teamLockOf(save, rt) === null;
}
/** 고를 수 있는 만남인지 (잠금은 안 봄) — 고르는 중 (ask) 에 패널이 좁아져 잠겨도 고르기를 이어 감 (바로 VS 가 시작되던 것 — 코드 리뷰어, 넓히면 다시 3:3) */
function choiceFree(save: Save, rt: RuntimeState): boolean {
  return teamOn(rt) && !save.settings.autoBattle && !rt.headless && save.pendingEncounter?.kind === 'trainer';
}
/** 엔진이 고를 때까지 기다리는 만남인지 (자동 전투 · 안 볼 때는 아님) — 화면에 고르기를 그려도 되는지는 TeamChoice 의 teamChoiceOn (자동 전투도 포함) */
export function teamChoiceMeet(state: GameState): boolean {
  return state.runtime.stage?.phase === 'trainer' && choiceMeet(state.save, state.runtime);
}

/**
 * 자동 전투 3:3 처음 안내 (orders #71) — 자동 전투로 트레이너와 3:3 이 된 판 (만남 고르기 없이) 에서 한 번. 화면은 VS 가 끝난 3:3 판 첫 몇 초에 그림 (디자인 #71 —
 * "승부다!" · VS 를 안 가리게) · 보는 동안만 셈 · 보면 tip-seen 'auto-team'
 */
export const AUTO_TEAM_TIP = 'auto-team';
export function autoTeamTipDue(state: GameState): boolean {
  const { save, runtime: rt } = state;
  const st = rt.stage;
  return st?.phase === 'team' && st.team.kind === 'trainer' && save.settings.autoBattle && !(save.tips ?? []).includes(AUTO_TEAM_TIP);
}

/** 3:3 처음 안내 — 3:3 을 처음 고를 수 있는 만남에서 "승부다!" 상자 위 4초 (보는 동안만 셈 — 화면이 다 보이면 tip-seen 'team-meet', 2026-10-22 태현 님 "추천안") */
export const TEAM_MEET_TIP = 'team-meet';
export function teamMeetTipDue(state: GameState): boolean {
  // "!" 가 끝나 1:1 / 3:3 버튼이 나올 때부터 ([3] 이 먹을 때 — "!" 때 떠서 3 을 눌러도 안 먹던 것, UX 리뷰어 #59 · stageViewKey 에 같은 경계)
  const st = state.runtime.stage;
  return teamChoiceMeet(state) && st?.phase === 'trainer' && st.ms >= TIMING.trainerAlertMs && !(state.save.tips ?? []).includes(TEAM_MEET_TIP);
}

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

/** 3:3 상대 셋 — 트레이너 만남 = trainerFoes · 대기실 = 관장 팀 (3마리 고르기 판이 그림 · 타입을 그림 — 기획 #24). 고를 수 없으면 null */
export function teamFoesOf(state: GameState): Monster[] | null {
  const { save, runtime: rt } = state;
  const st = rt.stage;
  // 그 지역 관장 (해변 대기실이 숲 관장 팀을 그리고 · 미리 체크하던 것 — 코드 리뷰어 #59)
  if (st?.phase === 'lobby' && inLobby(state)) return leaderTeam(regionHere(save.location));
  const p = save.pendingEncounter;
  if (st?.phase !== 'trainer' || p?.kind !== 'trainer') return null;
  const prog = save.stages[p.stageId];
  return prog ? trainerFoes(save, p.stageId, prog, trainerNumber(p.trainerId)) : null;
}

/**
 * 3마리 고르기 — 지금 체크된 포켓몬 (트레이너 만남에서 3:3 을 골랐을 때 · 대기실은 도전을 눌러 판이 열렸을 때). 고를 수 없으면 null — 화면이 ●●●○○ 를 그림.
 * 처음엔 상성 좋은 셋이 체크 · 빼면 빈 채로 (시작할 때 모자라면 상성 좋은 순으로 채움)
 */
export function teamPickOf(state: GameState): string[] | null {
  const { save, runtime: rt } = state;
  const stage = rt.stage;
  if (!teamOn(rt) || teamLockOf(save, rt) !== null) return null;
  const alive = (pick: readonly string[]) => pick.filter((uid) => save.party.includes(uid) && (save.monsters[uid]?.hp ?? 0) > 0);
  if (stage?.phase === 'lobby' && inLobby(state)) return !stage.picking ? null : stage.pick ? alive(stage.pick) : fillPick(save, undefined, leaderTeam(regionHere(save.location)));
  if (stage?.phase !== 'trainer' || !stage.pick || save.pendingEncounter?.kind !== 'trainer') return null;
  return alive(stage.pick);
}

function trainerTeamBattle(save: Save, id: StageId, prog: StageProgress, n: number, pick?: readonly string[]): TeamBattle {
  const foes = trainerFoes(save, id, prog, n);
  return startTeamBattle(save, foes, 'trainer', trainerInfo(id, n).name, fillPick(save, pick, foes));
}

function leaderTeamBattle(save: Save, pick?: readonly string[]): TeamBattle {
  // 지금 체육관의 관장 (지역 표 — 숲 나래 · 해변 해솔)
  const region = regionHere(save.location);
  return startTeamBattle(save, leaderTeam(region), 'gym', region.leader.name, fillPick(save, pick, leaderTeam(region)));
}

function leaderBattle(save: Save): BattleState {
  const region = regionHere(save.location);
  return startTrainerBattle(save, leaderTeam(region), 'gym', region.leader.name);
}

/** 화면용 — 지금 체육관 · 지역의 관장 (대기실 · 체육관 앞 그림 · 이름) */
export function gymLeaderOf(save: Save): RegionDef['leader'] {
  return regionHere(save.location).leader;
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

/** 세이브의 전투를 처음부터 다시 만든 때 (껐다 켬 · 이어 하기, 기획 R15) 한 줄 — runtime.resumed 동안 화면이 따로 띄움 (말 칸과 따로) */
export const RESUME_BATTLE_MSG = '다시 켜서 전투를 처음부터!';
/** 지금 띄울 "다시 켜서 전투를 처음부터!" — 없으면 null */
export function resumeLine(state: GameState): string | null {
  const p = state.runtime.stage?.phase;
  return (state.runtime.resumed ?? 0) > 0 && (p === 'battle' || p === 'team') ? RESUME_BATTLE_MSG : null;
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

/**
 * [병원 앞으로] (3:3 두 번째 패배 상자, #152) — 팀 회복 · 마지막으로 지나간 병원 앞 (없으면 처음) · 돈은 더 안 뺌.
 * 다시 걷는 길의 야생은 다시 뽑음 (run.retries — S17 과 같이, 같은 이로치를 또 잡던 것 — 테스터). 상자는 이미 두 번째 패배라 기다림 조건은 그대로
 */
function stageRetreat(save0: Save, id: StageId): Save {
  const save = { ...healTeam(save0), pendingEncounter: null };
  const hospital = save.lastHospital?.stageId === id ? save.lastHospital.at : null;
  return withStage(save, id, (p) => ({ ...p, progress: hospital !== null ? Math.max(0, hospital - BEFORE_SPOT) : 0, run: { ...p.run, reach: Math.max(p.run.reach, p.progress), retries: p.run.retries + 1 } }));
}

function stageStep(save0: Save, rt0: RuntimeState, id: StageId, stepMs: number): { save: Save; rt: RuntimeState; signal: SaveSignal | null } {
  const ensured = ensureStage(save0, rt0, id);
  let save = ensured.save;
  let rt = ensured.rt;
  const { prog, layout } = ensured;
  const kept = checkedStage(rt, save, id, layout, prog.progress);
  let stage: StageRuntime = kept ?? defaultStage(save, rt, id, prog);
  // 세이브의 전투를 처음부터 다시 만듦 (껐다 켬 · 이어 하기) — "다시 켜서 전투를 처음부터!" (R15)
  if (!kept && (stage.phase === 'battle' || stage.phase === 'team') && save.pendingEncounter) rt = { ...rt, resumed: TIMING.resumeLineMs };
  let signal: SaveSignal | null = null;
  if (shinyWhileAway(save, rt, stage)) return { save, rt: { ...rt, stage, stageId: id }, signal };
  const walking = stage.phase === 'walk';

  switch (stage.phase) {
    case 'walk': {
      const from = prog.progress;
      const to = Math.min(1, from + walkDelta(stepMs * walkSpeed(save, layout, prog, id, rt)));
      const ev = nextEvent(layout, prog, id, from, to);
      if (!ev) {
        save = withProgress(save, id, to);
        // 1-3 끝 — 길 끝 체육관 문이 열리고 걸어 들어간 뒤 대기실 (2026-10-20 태현 님 A안) · 안 볼 때 (확장 계산) 는 바로
        if (to >= 1 && isRegionLast(id) && !rt.headless) {
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
        const beforePick = save;
        if (p.item) save = { ...save, bag: { ...save.bag, [p.item]: (save.bag[p.item] ?? 0) + 1 } };
        if (p.money) save = { ...save, money: save.money + p.money };
        save = withProgress(save, id, spot.at);
        const what = p.item ? itemName(p.item) : `${p.money ?? 0}원`;
        // 앞 한 줄 ("그동안: …" 등) 이 떠 있으면 덮지 않고 그 뒤에 (1초 넘게 — U1, 코드 리뷰어)
        const picked = `${withJosa(what, '을/를')} 주웠다!`;
        rt = queueToast(rt, picked);
        // 진화 아이템 — 안내를 이미 봤으면 쓸 포켓몬 한 줄 (#125 · 처음이면 걷는 중 안내가 대신)
        const evo = evoGotNote(beforePick, save);
        if (evo) rt = queueToast(rt, evo);
      } else if (spot.kind === 'wild' && (rt.headless || rt.away) && planWild(id, prog.seed, spot, prog.run.retries).shiny) {
        // 안 볼 때 · VS Code 에 포커스가 없을 때 이로치 흔적 — 바로 앞에서 멈추고 알림 (U9), 다시 보이면 · 돌아오면 이어 감
        save = withProgress(save, id, Math.max(from, spot.at - BEFORE_SPOT));
        stage = { phase: 'hold', why: 'shiny' };
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
      const choose = choiceMeet(save, rt);
      const free = choiceFree(save, rt);
      let st: Extract<StageRuntime, { phase: 'trainer' }> = { ...stage, ms };
      // 3:3 을 고를 수 있는 만남 — 고를 때까지 (3마리 고르기 10초 · 늦어도 teamChoiceMs) → 고른 때 VS 2초 → 전투 (디자인팀 4안). ask = 고르기를 연 만남
      if (st.vsAt === undefined) {
        const oldVs = TIMING.trainerMeetMs - TIMING.vsMs;
        if (!free && st.ask) {
          // 고르다가 자동 전투를 켜거나 안 보게 되면 그때 VS (예전 길로 가 VS 가 중간부터 나오던 것 — 코드 리뷰어)
          st = { ...st, vsAt: stage.ms };
        } else if (choose && !st.ask && stage.ms >= oldVs) {
          // 예전 길 (자동 전투) 로 VS 가 나오던 중에 끄면 그 VS 그대로 (사라졌다 처음부터 다시 나오던 것 — 코드 리뷰어)
          st = { ...st, vsAt: oldVs };
        } else if (choose || (free && st.ask)) {
          // 처음 고르기를 여는 때 — 자동 전투 중 3 으로 판 없이 고른 3:3 은 지움 (그 뒤 자동을 끄면 주 버튼 · 3 · Enter 가 판을 안 열던 것 — #84 UX)
          if (!st.ask && st.team === true && st.pick === undefined) {
            const { team: _t, ...rest } = st;
            st = rest;
          }
          st = { ...st, ask: true };
          if (st.pick !== undefined && st.team === true) {
            const pickMs = (st.pickMs ?? 0) + stepMs;
            st = { ...st, pickMs, ...(pickMs >= TIMING.teamPickAutoMs ? { vsAt: ms } : {}) };
          } else if (ms >= TIMING.trainerAlertMs + TIMING.teamChoiceMs) {
            // 시간 끝 = 주 버튼 방식 (마지막으로 고른 방식)
            st = { ...st, vsAt: ms };
          }
          stage = st;
          break;
        }
      }
      // VS 를 시작했으면 2초 뒤 전투 · 예전 길 (3:3 꺼짐 · 자동 전투 · 안 볼 때) 은 만남 4초 (고르지 않음 — 마지막으로 고른 방식)
      if (st.vsAt !== undefined ? ms < st.vsAt + TIMING.vsMs : ms < TIMING.trainerMeetMs) {
        stage = st;
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
      break;
    }
    case 'team': {
      // 3:3 실시간 (orders #17) — 이기면 1:1 트레이너와 같은 길 (결과 · 돈 ×1.5 · 다시 안 나옴).
      // 지면 그 트레이너에게만 진 것 — 남은 포켓몬이 있으면 돈 −10% · 쓰러진 셋은 그대로 · 계속 걸음, 없을 때만 S17 (2026-10-21 태현 님 "추천안대로")
      const rng = new Rng(rt.rngState);
      let team = teamStep(stage.team, stepMs, rng, { auto: save.settings.autoBattle, away: rt.headless, ...(rt.dev ? { ults: rt.dev.ults } : {}) });
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
        // 1:1 패배와 같은 돈 (5.2 상한 — 코드 리뷰어 #70)
        const lost = defeatLoss(save, false);
        save = { ...save, money: save.money - lost };
        // 이 트레이너는 이번 판에 다시 만나면 주 버튼 1:1 · 같은 판 패배로 셈 (R8 A)
        if (p?.kind === 'trainer') save = withStage(save, id, (s) => ({ ...s, run: { ...s.run, teamLost: [...(s.run.teamLost ?? []).filter((t) => t !== p.trainerId), p.trainerId] } }));
        const run = save.stages[id]?.run;
        if ((run?.retries ?? 0) + (run?.teamLost?.length ?? 0) >= 2) {
          // 같은 판 두 번째 패배 — 멈춤 상자 (다시 시작 없음, Enter · 클릭 = 계속 걷기) · 안 볼 때는 알림 (R8 A — 방치 손해 막기)
          stage = { phase: 'defeat', gym: false, lost, keep: team.foeName ?? '상대', left: aliveCount(save) };
          break;
        }
        rt = { ...rt, toast: { text: `${team.foeName}에게 졌다… 돈 −${lost.toLocaleString('en-US')}원`, ms: TIMING.toastMs * 2 } };
        stage = afterResult(save);
        break;
      }
      const d = stageDefeat(save, id);
      save = d.save;
      stage = { phase: 'defeat', gym: false, lost: d.lost };
      break;
    }
    case 'result':
    case 'choice': {
      const next = resultOrChoiceStep(stage, save, stepMs);
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
        return { save: helped.save, rt: helped.runtime, signal: null };
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
        return { save: t.save, rt: t.runtime, signal: null };
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
  return { save, rt: { ...rt, stage, stageId: id }, signal };
}

/** 스테이지 끝 — 볼 +1 · 보너스 경험치 · 깬 표시 → S24 클리어 카드 (고를 것이 있으면 먼저) · 1-3 은 S16 체육관 대기실로 */
function finishStage(save0: Save, rt0: RuntimeState, id: StageId): { save: Save; rt: RuntimeState; signal: SaveSignal | null } {
  const rng = new Rng(rt0.rngState);
  // 클리어 보너스 — 경험 부적 판이면 ×1.5 · 방치면 줄어든 값 (선두가 받는 값 — 한 줄 알림에도 같은 수)
  const bonus = stageClearGain(save0, id);
  const r = clearStage(save0, id, rng);
  // 쌓아 둔 새 기술 고르기를 한 번에 (클리어 카드 전, ideas #72)
  let save = takeLaterChoices(r.save);
  let rt: RuntimeState = { ...rt0, rngState: rng.state };
  // 두 마리까지 이름 · 나머지는 "외 N마리" (5 ~ 6마리면 240×150 에서 3줄로 자라 대기실 버튼을 가림 — 2026-10-21 UX 리뷰어)
  const lv = r.levelUps.length > 2 ? `${r.levelUps.slice(0, 2).join(' · ')} 외 ${r.levelUps.length - 2}마리` : r.levelUps.join(' · ');
  if (isRegionLast(id)) {
    // 지역 끝 → 그 지역 체육관 대기실
    save = { ...save, location: gymLocation(regionOf(id).region) };
    // 클리어 → 레벨업을 두 알림으로 차례로 (각 2.5초 · 합 5초) — 한 줄이면 6마리 레벨업에 약 660px (2026-10-21 UX 리뷰어)
    const head = `${stageCode(id)} 클리어! 경험치 +${bonus} · 볼 +${BALANCE.clearBalls}`;
    rt = { ...rt, toast: lv ? { text: head, ms: TIMING.toastMs, then: lv } : { text: head, ms: TIMING.toastMs * 2 } };
  } else if (lv) rt = { ...rt, toast: { text: lv, ms: TIMING.toastMs * 2 } };
  const stage = afterResult(save);
  // 자동 전투면 클리어 카드가 저절로 넘어가니 알림 없음 (ideas #48)
  return { save, rt: { ...rt, stage, stageId: isRegionLast(id) ? null : id }, signal: 'stage-clear' };
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

/**
 * 관장 카드 자동 셈을 멈추는지 — 숨김 (접힘 · 다른 탭) 이면 늘 멈춤 · 밖 (패널은 보이고 다른 곳에 손) 이면 첫 승 카드만 멈춤 (배지 · 제목을 보는 동안만 — U6).
 * 다시 이긴 카드 (again) 는 밖에서도 셈 — 앞 체육관을 되풀이해 키우며 다른 일을 하는 동안 카드에서 멈춰 있지 않고 대기실로 (#130 — 2026-10-28 태현 님 "추천대로")
 */
export function badgeAutoHeld(rt: Pick<RuntimeState, 'headless' | 'away'>, again: boolean): boolean {
  return rt.headless || (rt.away === true && !again);
}

/** S16 체육관 — 대기실 · 관장전 · 결과 · 고르기 · 패배 · MVP 끝 카드 */
function gymStep(save0: Save, rt0: RuntimeState, stepMs: number): { save: Save; rt: RuntimeState; signal: SaveSignal | null } {
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
  // 관장전을 세이브에서 처음부터 다시 만듦 — "다시 켜서 전투를 처음부터!" (R15, 관장전엔 문구가 없던 것 — UX 리뷰어)
  if (!okHere(st) && save.pendingChoices.length === 0 && pending?.kind === 'gym-leader') rt = { ...rt, resumed: TIMING.resumeLineMs };
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
        const first = !save.badges.includes(regionHere(save.location).badge);
        const r = battleRewards(save, battle, null, 'gym', rng);
        save = r.save;
        if (first && regionsOnRt(rt)) ({ save, rt } = openAndAnnounce(save, rt, rng));
        rt = { ...rt, rngState: rng.state };
        // 처음 = 배지 카드 · 다시 이김 = 같은 카드 (배지 없음 — 다음 지역 버튼, #127)
        stage = { phase: 'result', summary: r.summary, ms: 0, then: first ? 'badge' : 'again' };
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
      const team = teamStep(stage.team, stepMs, rng, { auto: save.settings.autoBattle, away: rt.headless, ...(rt.dev ? { ults: rt.dev.ults } : {}) });
      rt = { ...rt, rngState: rng.state };
      if (!teamDone(team)) {
        stage = { phase: 'team', team };
        break;
      }
      save = applyTeamResult(save, team);
      signal = 'battle-end';
      if (team.result === 'win') {
        const first = !save.badges.includes(regionHere(save.location).badge);
        const r = teamRewards(save, team, 'gym', rng);
        save = r.save;
        if (first && regionsOnRt(rt)) ({ save, rt } = openAndAnnounce(save, rt, rng));
        rt = { ...rt, rngState: rng.state };
        // 처음 = 배지 카드 · 다시 이김 = 같은 카드 (배지 없음 — 다음 지역 버튼, #127)
        stage = { phase: 'result', summary: r.summary, ms: 0, then: first ? 'badge' : 'again' };
        break;
      }
      save = defeatPenalty(save, true).save;
      stage = { phase: 'defeat', gym: true, lost: 0 };
      break;
    }
    case 'result':
    case 'choice': {
      const next = resultOrChoiceStep(stage, save, stepMs);
      stage = next;
      break;
    }
    case 'defeat':
      stage = defeatStep(stage, rt, stepMs, false);
      break;
    case 'badge': {
      // 자동 전투면 10초 뒤 다음 지역 (#127) — 첫 승 카드는 보는 동안만 셈 (숨김 · 밖이면 기다림 — U6) · 다 깼으면 (지도) 기다림
      //   다시 이긴 관장 (again) 은 10초 뒤 대기실로 — 앞 체육관을 되풀이해 키우는 사람이 다음 지역으로 끌려가지 않게 (예전처럼, 코드 리뷰어) · 버튼도 Enter = 대기실 · 2 = 다음 지역 (기획 B 10-28 · main.ts)
      //   다 깼어도 다시 이김은 대기실로 갈 수 있어 셈 (끝없이 기다리던 것 — UX 마지막 바퀴) · 밖에서도 셈 (#130 — badgeAutoHeld)
      if (!save.settings.autoBattle || badgeAutoHeld(rt, stage.again === true) || (!stage.again && gymNext({ save, runtime: rt }).kind === 'map')) break;
      const ms = (stage.ms ?? 0) + stepMs;
      if (ms >= TIMING.badgeAutoMs) {
        const here: GameState = { save, runtime: { ...rt, stage, stageId: null } };
        let t = stage.again ? here : applyInput(here, { kind: 'badge-next' });
        // 출발이 막히면 (이상한 세이브) 대기실로 — 매 걸음 다시 해 보며 헛돌지 않게
        if (t === here) t = applyInput(here, { kind: 'badge-continue' });
        return { save: t.save, rt: t.runtime, signal: null };
      }
      stage = { ...stage, ms };
      break;
    }
    default:
      break;
  }
  return { save, rt: { ...rt, stage, stageId: null }, signal };
}

/** 걸음 하나 */
export function step(state: GameState, stepMs: number): StepOut {
  syncRegionOrder(state);
  let save: Save = { ...state.save, playTimeMs: state.save.playTimeMs + stepMs };
  let rt: RuntimeState = state.runtime;
  // 알림 시간은 보는 동안 · 그 알림을 그리는 장면에서만 셈 — 밖 · 숨김에서 흘러가 돌아오면 없던 것 (디자인팀 UX #27 큼 1) · 만남 · 전투 중에 흘러가 요약 둘째 장이 0ms 이던 것 (UX 리뷰어 R14)
  if (rt.toast && toastShown(rt, save)) rt = { ...rt, toast: rt.toast.ms > stepMs ? { ...rt.toast, ms: rt.toast.ms - stepMs } : nextToast(rt.toast) };
  // "다시 켜서 전투를 처음부터!" — 보는 동안 전투 · 3:3 에서만 줄어듦 · 전투가 끝나면 지움
  if (rt.resumed !== undefined) {
    const p = rt.stage?.phase;
    const left = p === 'battle' || p === 'team' ? rt.resumed - (!rt.headless && !rt.away ? stepMs : 0) : 0;
    if (left > 0) rt = { ...rt, resumed: left };
    else {
      const { resumed: _r, ...rest } = rt;
      rt = rest;
    }
  }
  let signal: SaveSignal | null = null;
  const loc = save.location;
  if (loc.screen === 'stage' || loc.screen === 'gym') {
    const r = loc.screen === 'stage' ? stageStep(save, rt, loc.stageId, stepMs) : gymStep(save, rt, stepMs);
    save = r.save;
    rt = r.rt;
    signal = r.signal;
  } else if (rt.stage) {
    rt = { ...rt, stage: null, stageId: null };
  }
  // 다음 지역 따라잡기 — 연 지역 관장을 다 이겼는데 다음 곳이 없으면 (배지가 이미 있는 세이브 · 결과 상자 전에 꺼진 첫 승) 걷기 · 대기실 경계에서 열고 알림 (코드 리뷰어 #66)
  if (regionsOnRt(rt) && (rt.stage?.phase === 'walk' || rt.stage?.phase === 'lobby') && nextRegionDue(save)) {
    const rng = new Rng(rt.rngState);
    ({ save, rt } = openAndAnnounce(save, rt, rng));
    rt = { ...rt, rngState: rng.state };
  }
  // 오늘의 목표 · 기록 (U13 · U12) — 모두에게 (3:3 과 같이 — orders #59)
  if (dailyOn(rt)) {
    const d = dailyStep(state, save, rt, signal);
    save = d.save;
    rt = d.rt;
  }
  // 자동 전투 첫 안내 (R12 A — 자동을 한 번 켤 때까지 최대 3번, 화면이 그렸을 때 셈 'tip-seen' auto): ① 보는 중 내 차례가 10초 넘게 입력 없이 기다린 첫 때 — 내 차례가 끝날 때까지 남김
  // ② 자동 꺼짐으로 안 보는 동안 멈췄다 다시 볼 때. 그동안 요약 (R14) 이 있으면 요약이 먼저 — ② 는 요약이 끝난 뒤 (겹치지 않게)
  const watchingNow = !rt.headless && !rt.away;
  const myTurn = rt.stage?.phase === 'battle' && rt.stage.battle.phase === 'choose' && !save.settings.autoBattle;
  if (myTurn && watchingNow) {
    const ms = (rt.chooseMs ?? 0) + stepMs;
    // 다른 알림이 떠 있으면 이번 차례는 건너뜀 (붙잡혀 있던 요약 · 주운 것을 덮어 지우던 것 — 코드 리뷰어)
    if ((rt.chooseMs ?? 0) < TIMING.autoTipWaitMs && ms >= TIMING.autoTipWaitMs && autoTipLeft(save) && !rt.toast) rt = { ...rt, toast: { text: AUTO_TIP_TURN, ms: AUTO_TIP_TURN_MS, kind: 'auto-tip' } };
    rt = { ...rt, chooseMs: ms };
  } else {
    if (rt.chooseMs !== undefined) {
      const { chooseMs: _c, ...rest } = rt;
      rt = rest;
    }
    // ① 은 내 차례가 끝나면 (골랐거나 · 자동을 켬 · 떠남) 지움 (5초 만에 사라져 코드를 보다 돌아오면 놓치던 것 — UX 리뷰어)
    if (rt.toast?.kind === 'auto-tip' && rt.toast.text === AUTO_TIP_TURN) rt = { ...rt, toast: nextToast(rt.toast) };
  }
  // ② 는 화면이 그릴 수 있는 장면에서 (다른 알림이 끝난 뒤) — 3:3 · 만남 · 결과 · 고르기 등에서 돌아오면 그 장면까지 미룸 · 5초는 띄운 뒤부터 (디자인팀 R12 큼 2)
  if (watchingNow && rt.noticed === 'paused' && autoTipLeft(save)) rt = { ...rt, backTip: true };
  // 그동안 요약 (awayLog) 이 먼저 — ② 는 요약이 끝난 뒤 (겹치지 않게)
  if (rt.backTip && watchingNow && !rt.toast && !rt.awayLog && canDrawAutoTip(rt.stage) && !firstWalkTip(save, rt.stage)) {
    const { backTip: _b, ...rest } = rt;
    rt = { ...rest, toast: { text: AUTO_TIP_BACK, ms: TIMING.toastMs * 2, kind: 'auto-tip' } };
  }
  // 자동을 켜면 안내는 바로 지움 (미룬 것도)
  if (save.settings.autoBattle && (rt.toast?.kind === 'auto-tip' || rt.backTip)) {
    const { backTip: _b, ...rest } = rt;
    rt = { ...rest, toast: rt.toast?.kind === 'auto-tip' ? nextToast(rt.toast) : rt.toast };
  }
  rt = awayStep(state, save, rt, signal);
  // 멈춤 · 알림 (gdd 4.13 · U6) — 밖 · 숨김에서 기다리는 이유가 생겼는데 아직 안 알렸으면 한 번 (장면마다 따로 알리던 것을 한곳에서 — 이로치 전투 중에 떠남 · 밖 고르기 · 대기실로 돌아옴 등 빠진 곳 없이).
  // 같은 기다림은 한 번 — 보고 다시 떠나도 다시 안 알림 (탭을 오갈 때마다 쌓이던 것 — 2026-10-21 태현 님 "추천안"), 기다림이 바뀌거나 풀리면 지움 (다음 기다림을 알리게).
  // paused (자동 꺼짐 멈춤 — 확장이 넘겨받을 때) 는 다시 보면 지움
  let told: GameNotice | null = null;
  const watching = !rt.headless && !rt.away;
  const wait = waitReason({ save, runtime: rt });
  // 다시 이긴 카드 + 자동은 볼 때 · 밖에선 기다림이 아니라 (#130) wait 가 null — 카드가 그대로인 동안은 알린 기록을 남김 (지우면 숨길 때마다 다시 알림 — 테스터)
  const sameCard = rt.noticed === 'badge' && wait === null && rt.stage?.phase === 'badge';
  if (!watching && wait && wait !== rt.noticed) {
    told = wait;
    rt = { ...rt, noticed: wait };
  } else if (!sameCard && rt.noticed !== undefined && (rt.noticed === 'paused' ? watching || wait !== null : wait !== rt.noticed)) {
    const { noticed: _n, ...rest } = rt;
    rt = rest;
  }
  return { state: { save, runtime: rt }, save: signal, notice: told };
}

/** 오늘의 목표 · 기록이 켜졌는지 — 모두에게 (BALANCE.daily.on, 3:3 을 켤 때 같이) · 개발 모드 (임시) 는 늘 */
const dailyOn = (rt: RuntimeState) => BALANCE.daily.on || rt.dev !== undefined;

/**
 * 오늘의 목표 · 기록 한 걸음 (U13 · U12) — 걸음 앞 (before) 과 뒤를 견줘 한 일을 셈: 야생 · 트레이너 · 관장 이김 (결과 장면으로 감) · 새 종 잡음 (도감) ·
 * 완벽 패링 · 부탁 · 스테이지 클리어 · 걸은 거리. 날이 바뀌면 경계 (걷기 · 대기실 · 장면 없음 — 하던 전투 · 스테이지는 안 끊음) 에서 새 목표.
 * 하나 끝나면 보상 + 알림 (줄 — 앞 알림을 덮지 않음, U1) · 셋 다면 금구슬. 안 볼 때는 멈추지 않고 그동안 요약에 한 줄
 */
function dailyStep(before: GameState, save0: Save, rt0: RuntimeState, signal: SaveSignal | null): { save: Save; rt: RuntimeState } {
  let save = save0;
  let rt = rt0;
  const prev = before.runtime.stage;
  const st = rt.stage;
  const boundary = !st || st.phase === 'walk' || st.phase === 'lobby';
  // 새 날만 (PC 날짜를 되돌려 같은 날 목표를 다시 받지 않게 — 코드 리뷰어 #52) · 타입 목표 = 지금 지역 타입 (명세 검사관 #53) ·
  // 목표 날이 오늘보다 2일 넘게 앞 (시계를 미래로 잘못 맞췄다 고침) 이면 그날까지 기다리지 않고 오늘 것 (코드 리뷰어 #59)
  if (rt.today && (!save.daily || rt.today > save.daily.day || dayFarAhead(save.daily.day, rt.today)) && boundary) save = { ...save, daily: dailyFor(rt.today, regionHere(save.location).wild.common, trainersLeft(save, regionHere(save.location))) };
  // 한 일
  const won = (prev?.phase === 'battle' || prev?.phase === 'team') && st?.phase === 'result';
  const wildWin = won && prev?.phase === 'battle' && prev.battle.kind === 'wild';
  const foeTypes = wildWin && prev?.phase === 'battle' ? prev.battle.foe.types : [];
  const perfects = prev?.phase === 'battle' && st?.phase === 'battle' ? Math.max(0, (st.battle.perfects ?? 0) - (prev.battle.perfects ?? 0)) : 0;
  const newSpecies = Math.max(0, save.dex.caught.length - before.save.dex.caught.length);
  // 부탁을 끝냈을 때 (성공만 — gdd 7장) · 부탁 장면이 끝나는 걸음에 셈 (손으로 누르면 결과가 걸음 밖에서 들어가 안 세던 것 — 명세 검사관 #53)
  const helped = prev?.phase === 'request' && prev.result?.ok === true && st?.phase !== 'request' ? 1 : 0;
  const cleared = signal === 'stage-clear' ? 1 : 0;
  const bl = before.save.location;
  const al = save.location;
  const walked = bl.screen === 'stage' && al.screen === 'stage' && bl.stageId === al.stageId ? Math.max(0, (save.stages[al.stageId]?.progress ?? 0) - (before.save.stages[bl.stageId]?.progress ?? 0)) : 0;
  // 기록 (U12)
  if (won || signal === 'catch' || walked > 0) {
    const r = save.records ?? { wins: 0, catches: 0, walked: 0 };
    // 걸은 거리 = 스테이지 하나 10000 (schema · 세계 지도 판과 같게 — 늘 0.0 으로 보이던 것, 명세 검사관 #53)
    // 기록은 하나만 — 쓰러뜨리면 "이긴 전투", 잡으면 "잡은 수" (오늘의 목표는 잡아도 이긴 것으로 셈 — 기획 답)
    save = { ...save, records: { wins: r.wins + (won && signal !== 'catch' ? 1 : 0), catches: r.catches + (signal === 'catch' ? 1 : 0), walked: r.walked + walked * 10000 } };
  }
  if (!save.daily) return { save, rt };
  let daily = save.daily;
  const finished: DailyGoal[] = [];
  for (const [kind, n, types] of [
    ['wild-win', wildWin ? 1 : 0, foeTypes],
    ['trainer-win', won && !wildWin ? 1 : 0, []],
    ['perfect-parry', perfects, []],
    ['new-catch', newSpecies, []],
    ['request', helped, []],
    ['stage-clear', cleared, []],
  ] as const) {
    const r = dailyAdd(daily, kind, n, types);
    daily = r.daily;
    finished.push(...r.finished);
  }
  if (daily === save.daily) return { save, rt };
  save = { ...save, daily };
  // 보상 · 알림 — 하나마다 · 셋 다면 금구슬
  for (const g of finished) {
    save = addItem(save, g.reward, g.rewardN);
    rt = queueToast(rt, `오늘의 목표 ✓ ${dailyLabel(g)} — ${itemName(g.reward)} +${g.rewardN}`);
  }
  if (dailyDone(save.daily) === save.daily!.goals.length && save.daily!.goals.length > 0 && !save.daily!.bonus) {
    save = addItem({ ...save, daily: { ...save.daily!, bonus: true } }, DAILY_BONUS.item, DAILY_BONUS.n);
    rt = queueToast(rt, `오늘의 목표 다 했어요! ${itemName(DAILY_BONUS.item)} +${DAILY_BONUS.n}`);
  }
  return { save, rt };
}

/** 화면용 — 오늘의 목표 세 줄 (☐ / ☑ · n/m) · 끝낸 수. 꺼져 있거나 아직 없으면 null (세계 지도 판 · 타이틀 "오늘 1/3" — 디자인팀) */
export function dailyView(state: GameState): { day: string; goals: { label: string; have: number; need: number; done: boolean; reward: string }[]; done: number } | null {
  const d = state.save.daily;
  if (!dailyOn(state.runtime) || !d || (state.runtime.today !== undefined && d.day !== state.runtime.today)) return null;
  return { day: d.day, goals: d.goals.map((g) => ({ label: dailyLabel(g), have: g.have, need: g.need, done: g.done === true, reward: `${itemName(g.reward)} ${g.rewardN}` })), done: dailyDone(d) };
}

/** 머리 위 알림을 화면이 그리는 장면 (StageScreen showToast — 걷기 · 클리어 카드 · 대기실 · 시설) · 자동 전투 안내는 1:1 전투도 (AutoTip) */
function toastShown(rt: RuntimeState, save: Save): boolean {
  if (rt.headless || rt.away || !rt.toast) return false;
  const st = rt.stage;
  // 자동 전투 안내 = 스위치 옆 (숲 1-1 첫 걷기 안내 동안은 뒤로) · 보통 알림 = 상점 안에서는 안 그림 (StageScreen 과 같게 — 코드 리뷰어)
  if (rt.toast.kind === 'auto-tip') return canDrawAutoTip(st) && !firstWalkTip(save, st);
  if (st?.phase === 'facility' && st.inside && st.kind === 'shop') return false;
  // 숲 1-1 첫 걷기 안내 (5초) 동안은 보통 알림도 안 셈 — 그 상자 뒤에 깔린 채 시간을 다 써 목표 알림이 한 번도 안 보이던 것 (디자인 UX 리뷰어)
  if (firstWalkTip(save, st)) return false;
  return st?.phase === 'walk' || st?.phase === 'clear' || st?.phase === 'lobby' || st?.phase === 'facility';
}

/** 숲 1-1 첫 걷기 안내 (FirstTip 'walk') 가 떠 있는 때 — 자동 전투 안내는 그 뒤로 (화면 walkTipOn 과 같음) */
function firstWalkTip(save: Save, st: StageRuntime | null): boolean {
  return save.location.screen === 'stage' && save.location.stageId === 'forest-1' && st?.phase === 'walk' && !(save.tips ?? []).includes('walk');
}

/** 다음 알림 (줄의 첫 것) — 없으면 null */
function nextToast(t: NonNullable<RuntimeState['toast']>): RuntimeState['toast'] {
  const q = t.then === undefined ? [] : Array.isArray(t.then) ? t.then : [t.then];
  if (q.length === 0) return null;
  const rest = q.slice(1);
  return { text: q[0]!, ms: t.thenMs ?? TIMING.toastMs, ...(rest.length ? { then: rest.length === 1 ? rest[0]! : rest, ...(t.thenMs ? { thenMs: t.thenMs } : {}) } : {}) };
}

/** 알림 줄 세우기 — 떠 있는 알림이 있으면 그 뒤에 (덮지 않음, U1 · 최대 4) */
/** 알림 줄에서 맞는 글을 지움 — 앞 것이 지워지면 다음 것이 새 시간으로 앞에 */
function dropToasts(rt: RuntimeState, drop: (text: string) => boolean): RuntimeState {
  const t = rt.toast;
  if (!t) return rt;
  const then = t.then === undefined ? [] : Array.isArray(t.then) ? t.then : [t.then];
  const left = [t.text, ...then].filter((x) => !drop(x));
  if (left.length === 1 + then.length) return rt;
  if (left.length === 0) return { ...rt, toast: null };
  const [head, ...rest] = left;
  const tail = rest.length === 0 ? {} : { then: rest.length === 1 ? rest[0]! : rest };
  if (head === t.text) {
    const { then: _then, ...keep } = t;
    return { ...rt, toast: { ...keep, ...tail } };
  }
  return { ...rt, toast: { text: head!, ms: t.thenMs ?? TIMING.toastMs, ...tail } };
}

function queueToast(rt: RuntimeState, text: string): RuntimeState {
  if (!rt.toast) return { ...rt, toast: { text, ms: TIMING.toastMs } };
  const q = rt.toast.then === undefined ? [] : Array.isArray(rt.toast.then) ? rt.toast.then : [rt.toast.then];
  const next = [...q, text].slice(-4);
  return { ...rt, toast: { ...rt.toast, then: next.length === 1 ? next[0]! : next } };
}

/** 자동 전투 첫 안내를 화면이 그릴 수 있는 장면 — 1:1 전투 (늘 자동 스위치) · 걷기 · 클리어 카드 · 대기실 · 시설 앞 (정보줄 스위치) (디자인팀) */
function canDrawAutoTip(st: StageRuntime | null): boolean {
  // 병원 · 상점 앞 · 클리어 카드는 메뉴가 안 보여 자동 스위치가 없음 — 머리 위로 떨어뜨려 "Esc 지나가기" 줄 · 보상 줄을 덮던 것 (디자인팀 UX R12 재확인 큼)
  return st?.phase === 'battle' || st?.phase === 'walk' || st?.phase === 'lobby';
}

const AUTO_TIP_MAX = 3;
/** 셈 (tips 'autotip-1' ~) — 화면이 그렸을 때만 ('tip-seen' auto). 옛 'auto-1' ~ 은 안 그린 채 세던 것이라 안 셈 (UX 리뷰어) */
const AUTO_TIP_SEEN = /^autotip-\d$/;
export const AUTO_TIP_TURN = '자리를 비울 땐 [A] 자동 전투 — 알아서 싸워요';
export const AUTO_TIP_BACK = '안 보는 동안 멈춰 있었어요 — [A] 자동 전투면 계속 걸어요';
/** ① 은 내 차례가 끝날 때까지 — 알림 길이 끝 (readRuntime 60초) 까지 */
const AUTO_TIP_TURN_MS = 60_000;
export function autoTipLeft(save: Save): boolean {
  const t = save.tips ?? [];
  return !save.settings.autoBattle && !t.includes('auto-on') && t.filter((x) => AUTO_TIP_SEEN.test(x)).length < AUTO_TIP_MAX && t.length < TIPS_MAX;
}
function useAutoTip(save: Save): Save {
  const t = save.tips ?? [];
  return { ...save, tips: [...t, `autotip-${t.filter((x) => AUTO_TIP_SEEN.test(x)).length + 1}`] };
}

/**
 * 지금 사람을 기다리는 이유 (gdd 4.13 표의 "기다림" 줄) — 없으면 null. 병원 · 상점 안 · 판 (사람이 먼저 들어간 곳) 은 알림 없음 (null).
 * 밖 · 숨김에서 이 값이 새로 생기면 알림 (step) · 확장이 넘겨받을 때도 (game-session) · 화면 기다림 한 줄 · 포켓몬 탭 배지
 */
export function waitReason(state: GameState): GameNotice | null {
  const st = state.runtime.stage;
  if (shinyWhileAway(state.save, state.runtime, st)) return 'shiny';
  if (!st) return null;
  switch (st.phase) {
    case 'hold':
      return st.why;
    case 'battle':
      return !state.save.settings.autoBattle && battleWaiting(st.battle) ? 'battle' : null;
    case 'choice':
      return state.save.pendingChoices.length > 0 ? 'choice' : null;
    case 'defeat':
      return defeatWaits(state.save, st) ? 'defeat' : null;
    case 'clear':
      return state.save.settings.autoBattle ? null : 'clear';
    case 'lobby':
      return 'gym';
    case 'badge':
      // 다시 이긴 카드 + 자동은 밖에서도 대기실로 넘어감 (#130) — 멈추지 않으니 알리지 않음 (U6) · 대기실에 닿으면 'gym' 으로 알림
      return state.save.settings.autoBattle && st.again === true && !badgeAutoHeld(state.runtime, true) ? null : 'badge';
    default:
      return null;
  }
}

/**
 * 장면마다 gdd 4.13 표의 어느 줄인지 — flow = 멈추지 않음 · wait = 기다리면 알림 (waitReason) · entered = 사람이 먼저 들어간 곳 (알림 없음).
 * 새 장면을 만들면 여기 (와 gdd 4.13) 에 먼저 — 테스트가 장면마다 줄이 있는지 봄 (orders #27 R13)
 */
export const STAGE_WAIT: Readonly<Record<StageRuntime['phase'], 'flow' | 'wait' | 'entered'>> = {
  walk: 'flow',
  appear: 'flow',
  trainer: 'flow',
  rival: 'flow',
  battle: 'wait',
  team: 'flow',
  request: 'flow',
  hold: 'wait',
  facility: 'entered',
  result: 'flow',
  choice: 'wait',
  defeat: 'wait',
  clear: 'wait',
  'gym-enter': 'flow',
  lobby: 'wait',
  badge: 'wait',
};

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
/**
 * 진화 아이템 처음 안내를 지금 띄울지 (#125) — 안내를 못 본 진화 아이템이 가방에 있고, 조용한 장면 (걷기 · 대기실) 이고, 보고 있고, 알림이 없을 때 (줍기 알림 · 결과 상자 · 라이벌 연출이 끝난 뒤 — 덮지 않음).
 * 띄울 아이템 (없으면 null) — 글 · 쓸 포켓몬은 rules/evo-tip evoTip. 본 기록은 화면이 tip-seen (evoTipId) 으로
 */
export function evoTipNow(state: GameState): ItemId | null {
  const rt = state.runtime;
  const p = phaseOf(state);
  if (rt.headless || rt.away || rt.toast || (p !== 'walk' && p !== 'lobby')) return null;
  // 대기실 — 3마리 고르기 판 위 · 대기실 첫 안내 (gym-team) 가 먼저 뜰 때는 안 띄움 (처음 안내는 한 번에 하나 — 코드 리뷰어)
  const st = rt.stage;
  if (st?.phase === 'lobby' && (st.picking || ((BALANCE.team.on || rt.dev?.team === true) && !(state.save.tips ?? []).includes('gym-team')))) return null;
  return evoTipItem(state.save);
}
/** S18 내 포켓몬 판을 열 수 있는 때 (전투 · 만남 · 진화 · 기술 고르기 중 아님) — 판 (webview/app overlayAllowed) 과 놓아주기가 같이 씀 (한 벌 — 코드 리뷰어 #121) */
export function canOpenTeam(state: GameState): boolean {
  return !inBattle(state) && phaseOf(state) !== 'choice';
}
/** S18 ⑥ 놓아주기 (#121) — 판을 열 수 있으면 됨 */
export const canRelease = canOpenTeam;
/** 관장을 이긴 카드의 다음 (#127) — go = 그 지역 (안 깬 첫 스테이지 · 다 깼으면 그 체육관) · pick = 고를 두 곳 (상성 좋은 쪽 먼저 — 자동 전투는 첫째) · map = 다 깸 (지도 버튼) */
export type GymNext = { kind: 'go'; region: RegionId; to: StageId | 'gym' } | { kind: 'pick'; regions: RegionId[] } | { kind: 'map' };
export function gymNext(state: GameState): GymNext {
  const save = state.save;
  if (!regionsOn(state)) return { kind: 'map' };
  if (save.regions.next?.length) return { kind: 'pick', regions: [...save.regions.next].sort((a, b) => regionMatchup(save, b) - regionMatchup(save, a)) };
  // 아직 안 깬 연 지역 중 가장 앞 (지금 지역 빼고 — 다시 이긴 관장이면 앞 지역에서 뒤 지역으로)
  const here = regionHere(save.location).id;
  const r = save.regions.order.find((id) => id !== here && !save.badges.includes(REGIONS[id].badge));
  return r ? { kind: 'go', region: r, to: regionEntry(save, r) } : { kind: 'map' };
}
/** 그 지역에서 갈 곳 — 안 깬 첫 스테이지 (새 지역이면 1-1) · 다 깼으면 체육관 */
function regionEntry(save: Save, r: RegionId): StageId | 'gym' {
  return REGIONS[r].stages.map((s) => s.id).find((id) => !save.stages[id]?.cleared) ?? 'gym';
}
/** 내 팀 (살아 있는) 기술이 그 지역 관장 포켓몬에 얼마나 잘 듣는지 — 고를 두 곳 줄 세우기 */
function regionMatchup(save: Save, r: RegionId): number {
  // 그 지역이 다음 번째일 때 나올 관장 팀 (초반 · 중반 · 후반 묶음 — 코드 리뷰어)
  const foes = regionGymTeam(REGIONS[r], save.regions.order.length + 1).map(([d]) => speciesOf(d)?.types ?? []);
  let score = 0;
  for (const uid of save.party) {
    const m = save.monsters[uid];
    if (!m || m.hp <= 0) continue;
    for (const t of foes) score += Math.max(1, ...m.moves.map((x) => moveOf(x.moveId)).filter((mv) => !!mv && mv.power > 0).map((mv) => effectiveness(mv!.type, t)));
  }
  return score;
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
/**
 * 웹뷰 시계 배 (orders #83 · #81 · #89) — 3:3 은 기본 박자 (TIMING.team.tempo 1.0 — #89) · 빠르게 ▶▶ (settings.battleFast — 태현 님 C 안, 약 1.5배) 를 켜면 보통 공격 (run) 두 배 ·
 * 알아챌 순간 1.0 (딱 1초 — U1, teamFastOk) · 상대 필살기 연출은 컷인 1초 뒤 두 배 · 누를 창 (끼어들기 joinSlow · 합동 멘트) 그대로. 그 밖 (1:1 · 걷기 · 타이틀) = 1
 */
export function gameTempo(state: GameState): number {
  const st = state.runtime.stage;
  if (st?.phase !== 'team') return 1;
  const t = TIMING.team;
  const join = teamJoinOpen(st.team);
  if (join && !join.gathering) return t.joinSlow;
  if (state.save.settings.battleFast !== true) return t.tempo;
  // 빠르게 ▶▶ (C 안 — 2026-10-22 태현 님): 보통 공격 = 두 배 · 누를 창 (합동 멘트 — 내 것 · 상대 것) 은 기본 박자 그대로 ·
  // 상대 필살기 연출 (합동 빼고) 은 컷인 1초 뒤부터 두 배 · 그 밖 알아챌 순간 (내 필살기 · 힘겨루기 · 다 참 · 쓰러짐 · 안내 · 합동 · 결과) 은 1.0 (딱 1초 — U1)
  const b = st.team;
  if (teamFastOk(b)) return t.tempo * t.fastScale;
  // 버린 누름 한 줄 (#88) 은 알아챌 순간 — 상대 컷인 뒤 ×2 가지에서도 (0.7초만 보이던 것, UX 리뷰어 2차)
  if (b.deny) return t.fastNotice;
  const u = b.phase === 'ult' ? b.ult : null;
  if (u && (u.gather ?? 0) > 0) return t.tempo;
  if (u && u.side === 'foe' && !u.joint && u.ms > t.fastFoeUltMs) return t.tempo * t.fastScale;
  return t.fastNotice;
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
/**
 * 그 스테이지가 열렸는지 — 지역 첫 스테이지는 연 지역 (세이브 regions.order — 숲은 처음부터, 세이브 검사와 같은 규칙 · 코드 리뷰어 #30), 그다음은 지역 안 앞 스테이지를 깨야
 */
export function stageUnlocked(save: Save, id: StageId): boolean {
  const { region, index } = regionOf(id);
  if (index > 0) return save.stages[region.stages[index - 1]!.id]?.cleared === true;
  return region.id === 'forest' || save.regions.order.includes(region.id);
}
/** 그 지역 체육관 — 연 지역이고 끝 스테이지를 깨면 지도에서 바로 (mvp-spec S07 ① [제안]) */
export function regionGymUnlocked(save: Save, region: RegionDef): boolean {
  return (region.id === 'forest' || save.regions.order.includes(region.id)) && save.stages[region.stages[region.stages.length - 1]!.id]?.cleared === true;
}
/** 지금 지역의 체육관 */
export const gymUnlocked = (save: Save) => regionGymUnlocked(save, regionHere(save.location));

/** 다음 지역 열기가 켜졌는지 (orders #66 — BALANCE.region.open · 개발 모드 (임시) 는 늘) */
const regionsOnRt = (rt: RuntimeState) => BALANCE.region.open || rt.dev !== undefined;
export const regionsOn = (state: GameState): boolean => regionsOnRt(state.runtime);
/** 규칙 함수 (레벨대 · 번호 · 관장 팀) 가 볼 지역 순서 — 켜져 있으면 세이브 것 · 꺼지면 예전 (BALANCE.region.beachOrder). 화면이 엔진 걸음 전에 그릴 때 (start · peek) 도 부름 */
export function syncRegionOrder(state: GameState): void {
  setRegionOrder(regionsOn(state) ? state.save.regions.order : null);
}

/** 연 지역마다 관장을 이겼는지 (배지) — 그러면 다음 지역을 열 차례 (관장 첫 승 · 배지가 이미 있는 세이브 따라잡기 — 코드 리뷰어 #66) */
function nextRegionDue(save: Save): boolean {
  return !save.regions.next?.length && REGION_IDS.some((r) => !save.regions.order.includes(r)) && save.regions.order.every((r) => save.badges.includes(REGIONS[r].badge));
}

/**
 * 다음 지역을 열고 알림 줄에 (알림은 걷기 · 대기실에서만 셈 — 관장 첫 승이면 배지 카드 뒤에 보임, U1). 앞머리 "새 지역" · "다음 지역" 은 화면이 [M] 지도 칸을 붙이는 표시 (디자인 #67)
 */
function openAndAnnounce(save: Save, rt: RuntimeState, rng: Rng): { save: Save; rt: RuntimeState } {
  if (!nextRegionDue(save)) return { save, rt };
  const opened = openNextRegion(save, rng);
  if (opened.regions.next?.length) return { save: opened, rt: queueToast(rt, '다음 지역을 골라요') };
  const added = opened.regions.order.find((r) => !save.regions.order.includes(r));
  return { save: opened, rt: added ? queueToast(rt, `새 지역이 열렸어요 — ${REGIONS[added].name}`) : rt };
}

/**
 * 관장 첫 승 → 다음 지역 (gdd 5.1 · 7-2 — orders #66): 남은 곳이 1곳이면 바로 연 지역에 · 2곳 이상이면 2곳을 뽑아 고르기 (regions.next — 껐다 켜도 같은 두 곳).
 * 지역이 3곳 (BALANCE.region.pickAbove) 까지는 고르기 없이 만드는 순서대로 (숲 → 해변 → 화산 — gdd 5.1, orders #75) · all = 지역 목록 (테스트가 셋 넘는 지역으로 봄)
 */
export function openNextRegion(save: Save, rng: Rng, all: readonly RegionId[] = REGION_IDS): Save {
  const order = save.regions.order;
  const left = all.filter((r) => !order.includes(r));
  if (left.length === 0 || (save.regions.next?.length ?? 0) > 0) return save;
  if (left.length === 1 || all.length <= BALANCE.region.pickAbove) return { ...save, regions: { ...save.regions, order: [...order, left[0]!] } };
  const a = left.splice(rng.int(0, left.length - 1), 1)[0]!;
  const b = left[rng.int(0, left.length - 1)]!;
  return { ...save, regions: { ...save.regions, next: [a, b] } };
}

function toast(state: GameState, save: Save, text: string): GameState {
  return { save, runtime: { ...state.runtime, toast: { text, ms: TIMING.toastMs } } };
}

/** S07 · S24 · S16 ③ — 떠나는 스테이지는 처음부터 다시 (지도 확인 한 번은 화면이), 가는 스테이지는 새 판 (새 길, #62) · region = 다른 지역 체육관 (orders #66) */
function travel(state: GameState, to: StageId | 'gym', toRegion?: RegionId): GameState {
  if (!canTravel(state)) return state;
  const loc = state.save.location;
  if (loc.screen === 'stage' && to === loc.stageId && phaseOf(state) === 'walk') return state; // 지금 스테이지 = 그대로 이어 함
  const rng = new Rng(state.runtime.rngState);
  let save = state.save;
  const gymRegion = toRegion ? REGIONS[toRegion] : regionHere(loc);
  // 가는 지역의 "새 지역이 열렸어요 — …" 알림은 지움 (이미 왔는데 지도로 가라던 것 — UX 리뷰어 #70)
  const arrive = to === 'gym' ? gymRegion : regionOf(to).region;
  const rt0 = dropToasts(state.runtime, (x) => x === `새 지역이 열렸어요 — ${arrive.name}`);
  if (to === 'gym' ? !regionGymUnlocked(save, gymRegion) : !stageUnlocked(save, to)) return state;
  if (loc.screen === 'stage') {
    const from = loc.stageId;
    save = withStage(save, from, (p) => ({ ...freshRun(p, newSeed(rng), save.playTimeMs) }));
    if (save.lastHospital?.stageId === from) save = { ...save, lastHospital: null };
  }
  if (to === 'gym') return { save: { ...save, location: gymLocation(gymRegion) }, runtime: { ...rt0, rngState: rng.state, stage: { phase: 'lobby' }, stageId: null } };
  save = { ...save, stages: { ...save.stages, [to]: freshRun(save.stages[to], newSeed(rng), save.playTimeMs) }, location: { screen: 'stage', stageId: to } };
  if (save.lastHospital?.stageId === to) save = { ...save, lastHospital: null };
  // 경험 부적 — 스테이지를 새로 시작할 때 1개를 써서 이 판 동안 경험치 ×1.5 (2026-10-21 ideas #70)
  const charm = (save.bag['exp-charm'] ?? 0) > 0;
  if (charm) save = withRun({ ...save, bag: { ...save.bag, 'exp-charm': (save.bag['exp-charm'] ?? 0) - 1 } }, to, (r) => ({ ...r, boost: true }));
  const charmText = `경험 부적을 썼다! 이 스테이지 경험치 ×${BALANCE.expCharmScale}`;
  // 앞 알림 (클리어 · 레벨업) 이 떠 있으면 덮지 않고 그 뒤에 (코드 리뷰어)
  const prev = rt0.toast;
  const toastNow = !charm ? prev : prev ? queueToast(rt0, charmText).toast : { text: charmText, ms: TIMING.toastMs * 2 };
  return { save, runtime: { ...rt0, rngState: rng.state, stage: null, stageId: to, toast: toastNow } };
}

/** 입력 — 지금 받을 수 없는 입력이면 상태를 그대로 돌려줌 */
export function applyInput(state: GameState, input: GameInput): GameState {
  syncRegionOrder(state);
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
      if (stage?.phase === 'trainer' && stage.ms >= TIMING.trainerAlertMs && (choiceMeet(save, state.runtime) || stage.vsAt !== undefined)) {
        // 고르는 중 = 지금 방식으로 VS · VS 중 = 바로 전투 (VS 는 1초는 보임 — 더블클릭 · 버튼 뒤 한 번 더 누름에 한 장면 만에 끝나던 것, U1 · 코드 리뷰어)
        if (stage.vsAt !== undefined && stage.ms < stage.vsAt + TIMING.vsSkipAfterMs) return state;
        // 주 버튼이 3:3 (지난번 3:3) 이고 판이 아직이면 Enter · Space 도 클릭처럼 3마리 고르기 판 (같은 버튼인데 키는 판 없이 VS 로 가던 것 — 디자인팀 UX 9차)
        if (stage.vsAt === undefined && !stage.pick && stage.team === undefined && teamMain(save)) return applyInput(state, { kind: 'team-mode', on: true });
        const st = stage.vsAt === undefined ? { ...stage, vsAt: stage.ms } : { ...stage, ms: Math.max(stage.ms, stage.vsAt + TIMING.vsMs) };
        return { ...state, runtime: { ...state.runtime, stage: st } };
      }
      if ((stage?.phase === 'trainer' || stage?.phase === 'rival') && stage.ms >= TIMING.trainerAlertMs) {
        const end = stage.phase === 'rival' ? TIMING.rivalMeetMs : TIMING.trainerMeetMs;
        return stage.ms >= end ? state : { ...state, runtime: { ...state.runtime, stage: { ...stage, ms: end } } };
      }
      // 야생이 튀어나온 순간은 아무 일 없음 (선제공격은 스피드로, 2026-10-21)
      return state;
    case 'battle':
      return stage?.phase === 'battle' ? withBattleInput(state, input.input) : state;
    case 'team-battle': {
      if (stage?.phase !== 'team') return state;
      const rng = new Rng(state.runtime.rngState);
      const team = teamInput(stage.team, input.input, rng, state.runtime.dev?.ults);
      return team === stage.team ? state : { ...state, runtime: { ...state.runtime, rngState: rng.state, stage: { phase: 'team', team } } };
    }
    case 'team-mode': {
      const goNow = input.go === true && !input.on && stage?.phase === 'trainer' && stage.ms >= TIMING.trainerAlertMs && choiceMeet(save, state.runtime);
      if (stage?.phase !== 'trainer' || stage.vsAt !== undefined || !teamOn(state.runtime) || (input.on && teamLock(state) !== null) || (stage.team === input.on && !goNow)) return state;
      // 고른 방식을 기억 — 다음 트레이너 (자동 전투 · 안 볼 때 포함) 는 이걸로. 3:3 이면 3마리 고르기를 염 (상성 좋은 셋이 미리 체크 — gdd 4.7)
      const id = state.runtime.stageId;
      const prog = id ? save.stages[id] : undefined;
      // 3마리 고르기 판은 만남이 고르기를 기다릴 때만 — 자동 전투 (예전 4초 길) 에서 3 을 누르면 판이 VS 를 가리다 Enter 없이 1.6초 뒤 시작하던 것 (orders #84) → 판 없이 3:3 (상성 좋은 셋)
      const pick = input.on && id && prog && choiceFree(save, state.runtime) ? fillPick(save, undefined, trainerFoes(save, id, prog, stage.n)) : undefined;
      const { pick: _p, pickMs: _m, ...rest } = stage;
      return { save: { ...save, settings: { ...save.settings, teamMode: input.on } }, runtime: { ...state.runtime, stage: { ...rest, team: input.on, ...(pick ? { pick, pickMs: 0 } : {}), ...(goNow ? { vsAt: stage.ms } : {}) } } };
    }
    case 'team-pick': {
      const cur = teamPickOf(state);
      // 대기실은 3마리 고르기 판이 열렸을 때만 (teamPickOf 가 null) · 트레이너는 VS 전에만 (VS 동안 숫자로 보이지 않게 셋이 바뀌던 것 — 코드 리뷰어)
      if (stage?.phase === 'trainer' && stage.vsAt !== undefined) return state;
      if (!cur || !save.party.includes(input.uid) || (save.monsters[input.uid]?.hp ?? 0) <= 0 || (stage?.phase !== 'trainer' && stage?.phase !== 'lobby')) return state;
      // 셋이 다 찼으면 넷째는 마지막에 고른 것과 바꿈 (1 · 2 번은 그대로 — 맨 처음 것이 소리 없이 빠지고 번호가 당겨지던 것, 디자인팀 UX 9차)
      const pick = cur.includes(input.uid) ? cur.filter((u) => u !== input.uid) : cur.length >= BALANCE.team.size ? [...cur.slice(0, BALANCE.team.size - 1), input.uid] : [...cur, input.uid];
      // 트레이너 만남 고르기 — 넣고 빼면 시작 막대를 다시 채움 (고르는 중에 저절로 시작되지 않게 — ideas #145)
      return { ...state, runtime: { ...state.runtime, stage: { ...stage, pick, ...(stage.phase === 'trainer' ? { pickMs: 0 } : {}) } } };
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
      // 자동을 한 번 켜면 자동 전투 첫 안내는 끝 (R12 A)
      const tips = save.tips ?? [];
      const next = { ...save, settings: { ...save.settings, autoBattle: input.on }, ...(input.on && !tips.includes('auto-on') && tips.length < TIPS_MAX ? { tips: [...tips, 'auto-on'] } : {}) };
      // 한 줄 알림은 전투 밖에서만 — 전투 · 3:3 중에는 알림 자리가 안 보여 끝난 뒤에야 뜨고 남은 알림을 덮던 것 (테스터 #83 — 전투 화면은 스위치 ✓ 가 알려 줌)
      return input.say && !inBattle(state) ? toast(state, next, input.on ? '자동 전투 켜짐 (A)' : '자동 전투 꺼짐 (A)') : { ...state, save: next };
    }
    case 'fast-walk':
      if ((save.settings.fastWalk === true) === input.on) return state;
      return { ...state, save: { ...save, settings: { ...save.settings, fastWalk: input.on } } };
    case 'battle-fast': {
      if ((save.settings.battleFast === true) === input.on) return state;
      const next = { ...save, settings: { ...save.settings, battleFast: input.on } };
      // 1:1 · 걷기에서 눌러도 무엇이 바뀌는지 알게 "3:3" (코드 리뷰어 #83)
      return input.say && !inBattle(state) ? toast(state, next, input.on ? '3:3 빠르게 ▶▶ 켜짐 (C)' : '3:3 빠르게 ▶▶ 꺼짐 (C)') : { ...state, save: next };
    }
    case 'team-cutscene': {
      if ((save.settings.teamCutscene !== false) === input.on) return state;
      // 켬 = 칸을 지움 (기본) · 끔 = false — 전투 밖에서만 한 줄 알림 (전투 중엔 버튼 옆 한 줄 판 — 디자인)
      const { teamCutscene: _, ...rest } = save.settings;
      const next = { ...save, settings: input.on ? rest : { ...rest, teamCutscene: false } };
      // "3:3" — 걷기 · 1:1 에서 보면 1:1 필살기가 꺼진 줄 읽히던 것 (#83 C 와 같은 지적, 코드 리뷰어 #97)
      return input.say && !inBattle(state) ? toast(state, next, input.on ? '3:3 필살기 연출 켬 (V)' : '3:3 필살기 연출 끔 (V)') : { ...state, save: next };
    }
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
      // 자동 전투 첫 안내 (R12) — 화면이 그렸을 때 셈 (전투 화면이 안 그린 채 세어 세 번이 끝나던 것 — UX 리뷰어)
      // 떠 있는 안내 하나에 한 번만 — 장면이 바뀌어 다시 그리면 또 와서 두 번 세던 것 (디자인팀 UX R12 재확인)
      if (input.id === 'auto') {
        const t = state.runtime.toast;
        if (t?.kind !== 'auto-tip' || t.counted || !autoTipLeft(save)) return state;
        return { save: useAutoTip(save), runtime: { ...state.runtime, toast: { ...t, counted: true } } };
      }
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
      const outcome = resolveRequest(save, requestAt(prog.seed, stage.number, id), rng);
      // 팔 물건 — 부탁을 끝내면 (성공) 25% (2026-10-21 ideas #125)
      let after = outcome.save;
      let reward = outcome.reward;
      if (outcome.ok && rng.chance(BALANCE.treasureChance.request)) {
        const t = pickTreasure(rng);
        after = addItem(after, t);
        reward = [reward, itemName(t)].filter(Boolean).join(' · ');
      }
      // 진화 아이템 보너스 (리프의돌 등) — 안내를 이미 봤으면 쓸 포켓몬 한 줄을 결과 뒤에 (#125)
      const evo = evoGotNote(save, after);
      const rt1 = { ...state.runtime, rngState: rng.state, stage: { ...stage, result: { ok: outcome.ok, text: outcome.text, reward }, ms: 0 } };
      return {
        save: withProgress(after, id, stage.at),
        runtime: evo ? queueToast(rt1, evo) : rt1,
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
      // 넣는 순간 회복은 병원 · 대기실에서만 (#124 A — 태현 님 "추천대로": 클리어 카드 · 지도에서 넣었다 빼면 공짜 회복이 되던 것) · 그 밖은 다음 병원에서
      return next ? { ...state, save: inFacility(state, 'hospital') || inLobby(state) ? healBox(next) : next } : state;
    }
    case 'release': {
      if (!canRelease(state)) return state;
      const m = save.monsters[input.uid];
      const next = release(save, input.uid);
      if (!next || !m) return state;
      let st = stage;
      // 대기실 3마리 고르기에 든 칸도 뺌 (빈 자리는 판이 다시 채우지 않음 — 사람이 고름) · 3:3 이 안 되면 고르기 판을 닫음 (도전 Enter 가 아무 일 없던 것 — 코드 리뷰어)
      if (st?.phase === 'lobby') {
        if (st.pick?.includes(input.uid)) st = { ...st, pick: st.pick.filter((u) => u !== input.uid) };
        if (st.picking && teamLockOf(next, state.runtime) === 'few') st = { phase: 'lobby', ...(st.pick ? { pick: st.pick } : {}) };
      }
      // 잡은 소개 카드 중에 그 포켓몬을 놓으면 소개를 건너뜀 (카드는 사라졌는데 엔진은 소개 중이라 결과 상자가 3초 더 남던 것 — 코드 리뷰어)
      if (st?.phase === 'result' && st.summary.caught?.uid === input.uid) st = { ...st, ms: Math.max(st.ms, TIMING.caughtIntroMs) };
      // 3:3 두 번째 패배 상자의 남은 수 (#152)
      if (st?.phase === 'defeat' && st.left !== undefined) st = { ...st, left: aliveCount(next) };
      // 알림 줄은 안 씀 — "○○를 놓아줬다… 잘 지내!" 는 S18 판이 직접 그림 (판이 열린 동안 게임 · 알림이 멈춰, 여럿 놓으면 줄 뒤에 쌓여 앞 알림 (오늘의 목표 ✓) 을 밀어내고
      //   판을 닫은 뒤 이미 본 말이 2.5초씩 다시 뜨던 것 — 디자인 UX 리뷰어 #121)
      return { save: next, runtime: { ...state.runtime, stage: st } };
    }
    case 'points': {
      if (inBattle(state)) return state;
      // Shift + 클릭 = +5 (상점 Shift ×5 와 같은 손 — 2026-10-21 태현 님 R16 A) · 남은 포인트까지만
      let next: Save | null = null;
      const times = Math.max(1, Math.min(BALANCE.shopBulk, Math.floor(input.n ?? 1)));
      for (let i = 0; i < times; i++) {
        const r = spendPoint(next ?? save, input.uid, input.stat);
        if (!r) break;
        next = r;
      }
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
      const text = r.healedHp > 0 ? `${withJosa(name, '은/는')} HP 가 ${r.healedHp} ${r.cured ? '회복되고 몸도 개운해졌다!' : '회복됐다!'}` : `${withJosa(name, '은/는')} 몸이 개운해졌다!`;
      return toast(state, r.save, text);
    }
    case 'defeat-continue':
      if (stage?.phase !== 'defeat') return state;
      // 3:3 두 번째 패배 상자 = 남은 포켓몬으로 계속 (다시 시작 없음 — R8 A)
      if (stage.keep !== undefined) return { ...state, runtime: { ...state.runtime, stage: afterResult(save) } };
      return { ...state, runtime: { ...state.runtime, stage: stage.gym ? { phase: 'lobby' } : { phase: 'walk' } } };
    case 'defeat-retreat': {
      // 3:3 두 번째 패배 상자에서만 — 1:1 전멸처럼 병원 앞으로 (돈은 진 때 이미 뺌 · 같은 판 패배도 이미 셈, #152)
      if (stage?.phase !== 'defeat' || stage.keep === undefined || save.location.screen !== 'stage') return state;
      const back = stageRetreat(save, save.location.stageId);
      return { save: back, runtime: { ...state.runtime, stage: afterResult(back) } };
    }
    case 'travel':
      return travel(state, input.to, input.region);
    case 'region-pick': {
      // 고를 곳 중 하나 — 연 지역에 더하고 고르기를 지움 (그 자리에서 이동은 안 함 — 지도에서). 전투 중엔 안 받음
      const next = save.regions.next;
      if (!regionsOn(state) || !next?.includes(input.region) || save.regions.order.includes(input.region) || inBattle(state)) return state;
      const { next: _next, ...regions } = save.regions;
      const picked: Save = { ...save, regions: { ...regions, order: [...regions.order, input.region] } };
      return { save: picked, runtime: queueToast(state.runtime, `새 지역이 열렸어요 — ${REGIONS[input.region].name}`) };
    }
    case 'challenge': {
      if (!inLobby(state) || !firstAlive(save)) return state;
      const next: Save = { ...save, pendingEncounter: { kind: 'gym-leader' } };
      // 3:3 이 되면 처음 누를 때 3마리 고르기 판 (상성 좋은 셋 미리 체크) — 판에서 한 번 더 = 시작 (트레이너 만남과 같은 흐름 · 저절로 시작 없음, 디자인팀). 자동 전투는 고르지 않음
      // 판이 열린 채 패널이 좁아져 3:3 이 잠기면 Enter 는 아무 일 없음 (1:1 관장전이 바로 시작되던 것 — 판은 "넓히면 3:3", 디자인팀) · Esc 로 뒤로
      if (stage?.phase === 'lobby' && stage.picking && teamLockOf(save, state.runtime) !== null) return state;
      if (stage?.phase === 'lobby' && !stage.picking && !save.settings.autoBattle && useTeam(next, state.runtime, true)) {
        return { ...state, runtime: { ...state.runtime, stage: { ...stage, picking: true, pick: fillPick(save, stage.pick, leaderTeam(regionHere(save.location))) } } };
      }
      // 관장전 = 3:3 (못 하면 1:1 토너먼트 — orders #17)
      const pick = stage?.phase === 'lobby' ? stage.pick : undefined;
      const stageNow: StageRuntime = useTeam(next, state.runtime, true) ? { phase: 'team', team: leaderTeamBattle(next, pick) } : { phase: 'battle', battle: leaderBattle(next) };
      return { save: next, runtime: { ...state.runtime, stage: stageNow } };
    }
    case 'lobby-back': {
      if (stage?.phase !== 'lobby' || !stage.picking) return state;
      const { picking: _k, ...rest } = stage;
      return { ...state, runtime: { ...state.runtime, stage: rest } };
    }
    case 'badge-continue':
      if (stage?.phase !== 'badge') return state;
      return { ...state, runtime: { ...state.runtime, stage: { phase: 'lobby' } } };
    case 'badge-next': {
      // 관장을 이긴 카드에서 바로 다음 지역 (#127 — 태현 님 "세계지도를 눌러서 가야되서 불편") — 고르기면 그 자리에서 고르고 출발 · 다 깼으면 지도 (여기선 아무 일 없음)
      if (stage?.phase !== 'badge') return state;
      const n = gymNext(state);
      if (n.kind === 'map') return state;
      let s: GameState = { ...state, runtime: { ...state.runtime, stage: { phase: 'lobby' } } };
      let region: RegionId;
      let to: StageId | 'gym';
      if (n.kind === 'pick') {
        region = input.region && n.regions.includes(input.region) ? input.region : n.regions[0]!;
        // 고르기 알림은 이미 골랐으니 지움 (새 지역에 가서 뜨지 않게 — 코드 리뷰어)
        s = applyInput({ ...s, runtime: dropToasts(s.runtime, (x) => x === '다음 지역을 골라요') }, { kind: 'region-pick', region });
        to = regionEntry(s.save, region);
      } else {
        region = n.region;
        to = n.to;
      }
      const t = travel(s, to, to === 'gym' ? region : undefined);
      if (t === s) return state;
      // 도착 한 줄 — travel 은 "새 지역이 열렸어요" 를 지우므로 어디로 왔는지를 알림 (카드 · 자동으로 떠나면 말없이 바뀌던 것 — 디자인 UX 리뷰어 · ideas 1635) · 앞머리는 "새 지역" 이 아님 (그 앞머리엔 화면이 [M] 칸을 붙임)
      syncRegionOrder(t);
      const arrive = to === 'gym' ? `${REGIONS[region].name} 체육관 도착!` : `${REGIONS[region].name} ${stageCode(to)} 도착!`;
      return { ...t, runtime: queueToast(t.runtime, arrive) };
    }
  }
}

/** S12 다음 — 고를 것 (S23 · S22) 이 있으면 고르기, 없으면: MVP 끝 카드 · 대기실 · 클리어 카드 · 걷기 */
function afterResult(save: Save, then?: 'badge' | 'again'): StageRuntime {
  if (save.pendingChoices.length > 0) return choiceStage(save, then);
  if (then === 'badge') return { phase: 'badge' };
  if (then === 'again') return { phase: 'badge', again: true };
  if (save.location.screen === 'gym') return { phase: 'lobby' };
  const prog = save.location.screen === 'stage' ? save.stages[save.location.stageId] : undefined;
  return prog && prog.progress >= 1 ? { phase: 'clear' } : { phase: 'walk' };
}

/** S23 · S22 고르기 시작 — 진화는 "어…? ○○의 모습이…!" 에서 기다렸다 보면 연출 (ms −1, 2026-10-21 ideas #33 — 코딩 중에 4초 연출을 놓치지 않게) */
function choiceStage(save: Save, then?: 'badge' | 'again'): StageRuntime {
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
  // 3:3 두 번째 패배 상자는 늘 기다림 (멈추고 알림 — R8 A)
  if (stage.keep !== undefined) return true;
  if (stage.gym || save.location.screen !== 'stage') return false;
  // 3:3 으로 진 것 (남은 포켓몬으로 계속 걸은 것) 도 같은 판 패배로 셈 (R8 A)
  const run = save.stages[save.location.stageId]?.run;
  return (run?.retries ?? 0) + (run?.teamLost?.length ?? 0) >= 2;
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
  // 지역 안 다음 스테이지 · 끝이면 그 지역 체육관 (지역 표 — 해변 2-3 다음이 숲 1-1 이 되지 않게)
  const { region, index } = regionOf(id);
  return region.stages[index + 1]?.id ?? 'gym';
}
/** 화면용 — 클리어 카드 [다음 스테이지] · Enter 가 갈 곳 */
export const nextStageOf = nextPlace;

/**
 * 자리 비운 동안 (ideas #16) — 확장이 계산하는 동안 떠날 때의 돈 · 가방을 적고 야생 전투를 셈.
 * 다시 보면 (웹뷰) 한 줄이 보이는 때 (걷기 · 클리어 카드 · 대기실, 다른 한 줄이 없을 때) "그동안: 몬스터볼 1 · 상처약 1 · 60원 · 야생 3마리" 를 띄우고 지움 — 바뀐 게 없으면 띄우지 않음
 */
function awayStep(before: GameState, save: Save, rt: RuntimeState, signal: SaveSignal | null): RuntimeState {
  if (rt.headless) {
    const prev = before.runtime.stage;
    // 잡은 야생도 셈 (신호가 'catch')
    const wildEnd = (signal === 'battle-end' || signal === 'catch') && prev?.phase === 'battle' && prev.battle.kind === 'wild';
    // 진 것도 셈 — 패배 상자에 들어선 때 · 3:3 에서 지고 남은 포켓몬으로 계속 (상자 없이 바로 걷기 — 명세 검사관: 요약에 "패배" 가 빠지던 것)
    const met = before.save.pendingEncounter;
    const teamLost =
      prev?.phase === 'team' && rt.stage?.phase !== 'team' && rt.stage?.phase !== 'defeat' && met?.kind === 'trainer' && !save.pendingEncounter && save.stages[met.stageId]?.defeatedTrainers.includes(met.trainerId) !== true;
    const lostNow = (rt.stage?.phase === 'defeat' && prev?.phase !== 'defeat') || teamLost;
    if (rt.awayLog && !wildEnd && !lostNow) return rt;
    const leaveToast = before.runtime.toast;
    const leaveThen = leaveToast?.then === undefined ? 0 : Array.isArray(leaveToast.then) ? leaveToast.then.length : 1;
    const log: AwayLog = rt.awayLog ?? { ...awayStart(before.save, leaveToast?.text), ...(leaveToast ? { thenAtLeave: leaveThen } : {}) };
    return { ...rt, awayLog: { ...log, ...(wildEnd ? { wild: log.wild + 1 } : {}), ...(lostNow ? { lost: (log.lost ?? 0) + 1 } : {}) } };
  }
  if (!rt.awayLog || rt.away) return rt;
  const phase = rt.stage?.phase;
  if (!(phase === 'walk' || phase === 'clear' || phase === 'lobby')) return rt;
  // 안 보는 동안 생긴 알림 (클리어 · 레벨업 · 주움) 은 요약이 대신 (네 장 10초 · 레벨업을 두 번 말하던 것 — UX 리뷰어) · 자동 전투 안내가 떠 있으면 그게 끝난 뒤
  if (rt.toast?.kind === 'auto-tip') return rt;
  // 숲 1-1 첫 걷기 안내 (화면 상자) 가 떠 있는 동안은 기다림 — 요약이 그 상자 밑에 깔려 3초 내내 안 보이던 것 (#34 UX 리뷰어 · 240 × 150)
  if (firstWalkTip(save, rt.stage)) return rt;
  const { awayLog, ...rest } = rt;
  // 두 장 2.5초씩 (R14 A) — ① 진행 · 레벨업 · 포인트 ② 진 것 · 물건 · 돈 · 야생 (한 장만 있으면 그 장만)
  // (안내 ② 를 요약 끝 줄로 합치는 것 — ideas #156 — 은 되돌림: 숨김 중 계산은 자동 켬일 때만이라 요약과 ② (자동 꺼짐 멈춤) 가 실제로 같이 나오지 않음, #34 UX 리뷰어)
  const [first, second] = awaySummary(awayLog, save);
  return awayCards(rest, rt, awayLog, first, second);
}

/** 그동안 요약 카드 띄우기 — 떠나기 전부터 떠 있던 알림은 남기고 그 뒤에 (아래 설명) */
function awayCards(rest: RuntimeState, rt: RuntimeState, awayLog: AwayLog, first: string | undefined, second: string | undefined): RuntimeState {
  // 떠나기 전부터 떠 있던 알림 (클리어 보상 · 레벨업 — 안 볼 때는 시간이 멈춰 있음) 은 남기고 요약은 그 뒤에 · 안 보는 동안 생긴 알림은 요약이 대신 · 요약이 비면 그대로 (코드 리뷰어)
  // 떠날 때 줄 (then) 도 그때 길이까지만 — 떠난 뒤 줄 선 것 ("상처약을 주웠다!") 은 요약이 대신 (같은 말을 두 번 하던 것 — 테스터)
  const thenOf = (t: NonNullable<RuntimeState['toast']>) => (t.then === undefined ? [] : Array.isArray(t.then) ? t.then : [t.then]);
  const keptThen = rt.toast ? thenOf(rt.toast).slice(0, awayLog.thenAtLeave ?? 0) : [];
  const kept = rt.toast && awayLog.toastAtLeave === rt.toast.text ? { ...rt.toast, then: keptThen.length === 0 ? undefined : keptThen.length === 1 ? keptThen[0]! : keptThen } : null;
  if (!first) return { ...rest, toast: rt.toast };
  if (kept) {
    const q = queueToast({ ...rest, toast: kept }, first);
    const both = second ? queueToast(q, second) : q;
    return both.toast ? { ...both, toast: { ...both.toast, thenMs: TIMING.awaySummaryMs } } : both;
  }
  return { ...rest, toast: { text: first, ms: TIMING.awaySummaryMs, ...(second ? { then: second, thenMs: TIMING.awaySummaryMs } : {}) } };
}

/** 떠날 때 — 돈 · 가방 · 자리 · 레벨 · 포인트 (그동안 요약의 기준) */
function awayStart(save: Save, toastAtLeave?: string): AwayLog {
  const levels: Record<string, number> = {};
  for (const uid of save.party) {
    const m = save.monsters[uid];
    if (m) levels[uid] = m.level;
  }
  return { money: save.money, bag: { ...save.bag }, wild: 0, lost: 0, at: placeOf(save), levels, points: pointsOf(save), regions: save.regions.order.length, ...(toastAtLeave ? { toastAtLeave } : {}), ...(save.daily ? { dailyDone: dailyDone(save.daily) } : {}) };
}

/** 지금 자리 — 스테이지와 진행 (0 ~ 1) · 체육관 */
function placeOf(save: Save): NonNullable<AwayLog['at']> {
  if (save.location.screen === 'stage') return { place: save.location.stageId, progress: save.stages[save.location.stageId]?.progress ?? 0 };
  return { place: 'gym', progress: 0 };
}

const pointsOf = (save: Save) => Object.values(save.monsters).reduce((n, m) => n + m.unspentPoints, 0);
/** 줄이 안 갈리는 띄어쓰기 */
const NB = '\u00a0';
const pct = (p: number) => Math.floor(p * 100);

/**
 * 그동안 요약 두 장 (R14 A — 2.5초씩) — 빈 장은 뺌 (둘 다 비면 []):
 * ① "그동안: 1-2 12% → 63% · 피카츄 Lv 14 · 포인트 +6" (진행 · 레벨업 · 포인트) ② "그동안: 패배 1번 · 몬스터볼 1 · 60원 · 야생 3마리" (진 것 · 물건 · 돈 (줄었으면 −) · 싸운 야생)
 */
export function awaySummary(log: AwayLog, save: Save): string[] {
  const grow: string[] = [];
  if (log.at) {
    const now = placeOf(save);
    const code = (p: StageId | 'gym') => (p === 'gym' ? '체육관' : stageCode(p));
    if (now.place !== log.at.place) grow.push(now.place === 'gym' ? `${code(log.at.place)} → 체육관` : `${code(log.at.place)} → ${code(now.place)} ${pct(now.progress)}%`);
    else if (now.place !== 'gym' && pct(now.progress) !== pct(log.at.progress)) grow.push(`${code(now.place)} ${pct(log.at.progress)}% → ${pct(now.progress)}%`);
  }
  if (log.levels) {
    const up = Object.entries(log.levels).flatMap(([uid, lv]) => {
      const m = save.monsters[uid];
      return m && m.level > lv ? [m] : [];
    });
    if (up.length === 1) grow.push(`${speciesOf(up[0]!.species)?.name.ko ?? up[0]!.form} Lv ${up[0]!.level}`);
    else if (up.length > 1) grow.push(`레벨업 ${up.length}마리`);
  }
  if (log.points !== undefined && pointsOf(save) > log.points) grow.push(`포인트${NB}+${pointsOf(save) - log.points}`);
  // 오늘의 목표 — 안 보는 동안 끝냈으면 한 줄 (gdd 4.13 R14 "오늘의 목표가 끝났으면 한 줄 더")
  if (save.daily && dailyDone(save.daily) > (log.dailyDone ?? 0)) grow.push(`오늘의${NB}목표${NB}${dailyDone(save.daily)}/${save.daily.goals.length}`);
  // 안 보는 동안 연 지역 · 고를 곳 — "새 지역" 알림을 요약이 대신해 한 번도 안 보이던 것 (U6 — 코드 리뷰어 #70)
  if (log.regions !== undefined) {
    for (const r of save.regions.order.slice(log.regions)) grow.push(`새${NB}지역${NB}${REGIONS[r].name}`);
    if (save.regions.next?.length && save.regions.order.length === log.regions) grow.push(`다음${NB}지역${NB}고르기`);
  }
  const gain: string[] = [];
  if ((log.lost ?? 0) > 0) gain.push(`패배${NB}${log.lost}번`);
  // 물건은 두 가지까지 · 나머지는 "외 N가지" (7종이면 240 × 150 에서 4줄로 자라 메뉴 줄 밑으로 잘리던 것 — UX 리뷰어 R14, U4)
  const items = ITEM_IDS.flatMap((id) => {
    const d = (save.bag[id] ?? 0) - (log.bag[id] ?? 0);
    return d > 0 ? [`${itemName(id).replace(/ /g, NB)}${NB}${d}`] : [];
  });
  gain.push(...items.slice(0, 2));
  if (items.length > 2) gain.push(`외${NB}${items.length - 2}가지`);
  const dm = save.money - log.money;
  if (dm !== 0) gain.push(`${dm > 0 ? '' : '−'}${Math.abs(dm).toLocaleString('en-US')}원`);
  if (log.wild > 0) gain.push(`야생${NB}${log.wild}마리`);
  // 이름과 숫자 · 점과 앞 조각은 붙여 둠 (줄이 "· 금구슬 1" 로 시작하거나 "야생 / 40마리" 로 갈리던 것)
  return [grow, gain].filter((p) => p.length > 0).map((p) => `그동안: ${p.join(`${NB}· `)}`);
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
