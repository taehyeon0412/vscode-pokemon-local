/**
 * 게임 상태 = 세이브 (저장함) + 진행 중 상태 (저장 안 함 — 랜덤 상태 · 남은 걸음 시간 · 지금 화면에서 하는 일).
 * 이 상태 하나가 웹뷰와 확장 사이를 오가고, 누가 계산하든 같은 함수(advance)로 앞으로 간다 (play.ts).
 */
import { GAME_NOTICES, type GameNotice } from './notices';
import { TIMING } from '../balance';
import { isHeroLookId } from '../../data/heroes';
import { speciesOf } from '../../data';
import { STONES } from '../rules/bag';
import { ITEM_IDS, REGION_STAGE_IDS, type FacilitySpot, type ItemId, type Save, type StageId } from '../save';
import { readBattle, type BattleState } from './battle';
import { readTeam, type TeamBattle } from './team';
import type { BattleSummary } from './rewards';
// 개발 모드 (임시)
import { readDev, type DevRuntime } from '../../dev/runtime';

type FacilityKind = FacilitySpot['kind'];

/**
 * 지금 하는 일 — 스테이지 (S06) · 체육관 (S16) 이 같이 씀:
 * - walk: 자동으로 걸음
 * - appear: 야생이 튀어나와 "나타났다!" — 상대 · 시작 (선제공격 · 기습 — 스피드로 정함) 은 save.pendingEncounter
 * - trainer: 트레이너와 눈이 마주침 "!" → "승부다!" + ◓ 개수 → 전투 (S08, 자동 전투여도 멈추지 않음) — save.pendingEncounter = trainer
 * - facility: 병원 · 상점 앞 [들어가기] [지나가기] (10초 뒤 지나감) · inside = 들어가 있음 (S13 · S14, 나가기를 누를 때까지)
 * - battle: 전투 1:1 (engine/battle.ts) — 상대는 save.pendingEncounter, 전투 중 상태는 여기 (세이브에는 끝나고 한 번에)
 * - hold: 안 볼 때 (확장이 계산) 직접 봐야 할 순간 (이로치 흔적) 앞에서 멈춤 — 다시 보이면 이어 감 (U9)
 * - request: 길 위의 부탁 — 고를 때까지 기다림, 고르면 결과를 잠깐 보여 줌
 * - result: S12 전투 결과 (경험치 · 레벨업 · 돈 · 아이템 · 잡은 포켓몬) — 잠깐 보여 주고 (계속으로 넘김) 고를 게 있으면 choice, 없으면 걷기 · 대기실
 * - choice: S23 새 기술 · S22 진화 — save.pendingChoices 맨 앞을 고를 때까지 기다림 (ms = 진화 연출 시간)
 *   then = 'badge' 면 다 고른 뒤 MVP 끝 카드 (관장을 처음 이김) · 'again' = 다시 이긴 관장 카드 (배지 없음 — 다음 지역 버튼, #127)
 * - defeat: S17 패배 — 돈 · 회복 · 다시 시작 자리는 이미 세이브에, [다시 시작] 을 기다림
 * - clear: S24 스테이지 클리어 카드 (진행 100%) — [다음 스테이지] [지도] [포켓몬 교체] 를 기다림
 * - lobby: S16 체육관 대기실 (병원 · 보관함 · 상점 · 도전 · 세계 지도)
 * - badge: 관장을 처음 이김 — 배지 · "숲 클리어! 다음 지역은 준비 중이에요" (MVP 끝 카드)
 */
export type StageRuntime =
  | { phase: 'walk' }
  | { phase: 'appear'; ms: number; isNew: boolean }
  /** team = 3:3 으로 (고른 것 — 없으면 자동 전투 · 안 볼 때 3:3, 아니면 1:1 — 2026-10-21 orders #17) */
  /** team = 고른 방식 · pick = 3:3 을 손으로 고르면 3마리 고르기 (미리 체크된 셋에서 바꿈) · pickMs = 고르기가 열린 뒤 (늦어도 teamPickAutoMs 뒤 시작) */
  /** vsAt = VS 를 시작한 ms (3:3 을 고를 수 있는 만남 — 고른 때 · 시간 끝, 없으면 아직 고르는 중) · ask = 고르기를 연 만남 (중간에 자동 전투를 켜면 그때 VS) */
  | { phase: 'trainer'; n: number; ms: number; team?: boolean; pick?: string[]; pickMs?: number; vsAt?: number; ask?: true }
  /** 라이벌 깜짝 등장 (gdd 4.12) — rival = 주인공 id, "!" → 띠 → 전투 */
  | { phase: 'rival'; rival: string; ms: number }
  | { phase: 'battle'; battle: BattleState }
  /** 3:3 실시간 팀 배틀 (트레이너 · 관장 — orders #17) */
  | { phase: 'team'; team: TeamBattle }
  /** 안 볼 때 드문 일 바로 앞에서 멈춤 — 이로치 흔적 (U9) · 라이벌 (2026-10-20 ideas #87). 다시 보면 걸어가 만남 */
  | { phase: 'hold'; why: 'shiny' | 'rival' }
  | { phase: 'request'; at: number; number: number; result: RequestResult | null; ms: number }
  | { phase: 'facility'; kind: FacilityKind; at: number; ms: number; inside: boolean }
  | { phase: 'result'; summary: BattleSummary; ms: number; then?: 'badge' | 'again' }
  /** ms = 진화 연출 시간 · −1 = 진화를 보기 전 "어…? ○○의 모습이…!" 에서 기다림 (Space · 클릭으로 시작 — 2026-10-21 ideas #33) */
  | { phase: 'choice'; ms: number; then?: 'badge' | 'again' }
  /** ms = 저절로 다시 시작까지 지난 시간 (defeatAutoMs — ideas #49, 옛 상태엔 없음) */
  /** keep = 3:3 으로 진 트레이너 이름 — 같은 판 두 번째 패배라 멈춘 상자 ("○○에게 졌다 — 남은 포켓몬으로 계속", 다시 시작 없음 — 2026-10-21 기획 R8 A) */
  | { phase: 'defeat'; gym: boolean; lost: number; ms?: number; keep?: string; /** 3:3 두 번째 패배 상자 — 남은 (싸울 수 있는) 포켓몬 수 (#152) */ left?: number }
  /** ms = 자동 전투일 때 [다음 스테이지] 까지 지난 시간 (clearAutoMs — ideas #48, 자동 전투가 아니면 없음) */
  | { phase: 'clear'; ms?: number }
  /** 1-3 끝 — 체육관 문이 열리고 걸어 들어감 (ms 동안, 그다음 클리어 처리 · S16 대기실 — 2026-10-20 태현 님 A안) */
  | { phase: 'gym-enter'; ms: number }
  /** pick = 관장 3:3 에 나갈 3마리 (고르지 않았으면 없음 — 상성 좋은 셋) · picking = 도전을 눌러 3마리 고르기 판이 열림 (Enter = 시작 · Esc = 뒤로, 디자인팀 — 판이 대기실 상자를 덮던 것) */
  | { phase: 'lobby'; pick?: string[]; picking?: true }
  /** 관장을 이긴 카드 — 처음 (배지) · again = 다시 이김 (배지 없음) · ms = 자동 전투면 다음 지역까지 센 시간 (#127) */
  | { phase: 'badge'; ms?: number; again?: true };

// 멈춤 · 알림 이유 — 가져오는 것이 없는 파일에 (shared/messages · boot.js 가 값으로 가져감)
export { GAME_NOTICES, type GameNotice } from './notices';

export const STAGE_PHASES = ['walk', 'appear', 'trainer', 'rival', 'battle', 'team', 'request', 'hold', 'facility', 'result', 'choice', 'defeat', 'clear', 'gym-enter', 'lobby', 'badge'] as const;

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
  /** 이 알림이 끝나면 이어서 띄울 글 (TIMING.toastMs) — 긴 알림을 둘로 나눠 차례로 (2026-10-21 1-3 클리어) · 여럿이면 줄 (앞 것을 덮지 않음 — 주운 것이 요약 둘째 장을 덮던 것, UX 리뷰어) */
  then?: string | string[];
  /** 이어 띄울 알림의 길이 (없으면 TIMING.toastMs) — 그동안 요약 둘째 장도 첫 장과 같게 (3초) */
  thenMs?: number;
  /** 알림 종류 — 'auto-tip' = 자동 전투 첫 안내 (R12, 화면이 자동 스위치 옆에 둠). 없으면 머리 위 보통 알림 */
  kind?: 'auto-tip';
  /** 자동 전투 안내를 이미 셈 (화면이 그렸다고 알림 — tip-seen auto 는 안내 하나에 한 번) */
  counted?: true;
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
  /** stage 가 어느 스테이지 것인지 (체육관이면 null) — 장소가 바뀌면 이전 스테이지의 진행 중 상태를 버림 */
  stageId: StageId | null;
  toast: Toast | null;
  /** 확장이 안 볼 때 계산 중 (웹뷰가 맡으면 false) — 이로치 흔적 앞에서 멈추고 알림 (U9) */
  headless: boolean;
  /** VS Code 창에 포커스가 없음 (패널은 보이고 웹뷰가 계산) — 이로치 흔적 앞에서도 멈추고 알림 (2026-10-19, 다른 화면을 보는 사이 놓치지 않게). 세이브 · 넘기기에는 안 남음 */
  away?: boolean;
  /** 확장이 안 볼 때 계산하는 동안 바뀐 것 — 다시 보면 "그동안: …" 한 줄 (2026-10-21 ideas #16). 안 볼 때 처음 걸음에 생기고 한 줄을 띄우면 지움 */
  awayLog?: AwayLog;
  /** 내 PC 날짜 "2026-10-22" — 웹뷰 · 확장이 걸음 전에 넣음 (엔진은 시계를 모름). 오늘의 목표가 날마다 바뀜 (U13) */
  today?: string;
  /** 밖 · 숨김에서 이미 알린 기다림 (gdd 4.13 — 같은 기다림은 안 보는 동안 한 번) · 보는 중이면 지움 */
  noticed?: GameNotice;
  /** "다시 켜서 전투를 처음부터!" 남은 ms — 세이브의 전투를 처음부터 다시 만든 때 (껐다 켬 · 이어 하기, R15). 말 칸 (msg) 과 따로 — 선제 · 기습 · 관장 · 3:3 · 좁은 패널에서 0 장면이던 것 (UX 리뷰어). 보거나 전투가 흐르는 동안 줄어듦 (#133) */
  resumed?: number;
  /** 그 뒤 첫 기술이 나갔음 — 보는 중이면 1초 보인 때 지움 (첫 기술이 1초 안에 끝나도 잊지 않게 · #133). resumed 와 같이 지움 */
  resumeActed?: boolean;
  /** 1:1 내 차례 (고르기) 가 입력 없이 기다린 ms — 자동 전투 첫 안내 (R12). 넘기기에는 안 남음 */
  chooseMs?: number;
  /** 자동 전투 첫 안내 ② ("안 보는 동안 멈춰 있었어요") 를 띄울 차례 — 화면이 그릴 수 있는 장면 (1:1 전투 · 걷기 · 클리어 카드 · 대기실 · 시설 앞) 까지 미룸 (디자인팀 — 3:3 · 만남 · 결과 등에서는 못 그림) */
  backTip?: true;
  /** 웹뷰 패널 크기 (px) — 3:3 배율 · 잠금 (teamScale). 3:3 배율이 바뀔 때만 웹뷰가 알림 · 모르면 없음 */
  view?: { w: number; h: number };
  /** 개발 모드 (임시, gdd 8장) — 확장이 개발 모드일 때만 붙임 (src/game/dev) */
  dev?: DevRuntime;
}

/** 자리 비운 동안 — 떠날 때의 돈 · 가방 · 자리 · 레벨 · 포인트와 그동안 싸운 야생 · 진 수 (그동안 요약 두 장 — R14) */
export interface AwayLog {
  money: number;
  bag: Partial<Record<ItemId, number>>;
  wild: number;
  /** 그동안 진 수 (패배 상자에 들어선 때) */
  lost?: number;
  /** 떠날 때 자리 — 스테이지 · 진행 (0 ~ 1) · 체육관 */
  at?: { place: StageId | 'gym'; progress: number };
  /** 떠날 때 팀 레벨 (uid → Lv) */
  levels?: Record<string, number>;
  /** 떠날 때 남은 포인트 합 (모든 포켓몬) */
  points?: number;
  /** 떠날 때 떠 있던 알림 글 — 돌아와서도 그 알림이면 남기고 요약을 뒤에 (안 보는 동안 생긴 알림만 요약이 대신) */
  toastAtLeave?: string;
  /** 떠날 때 끝낸 오늘의 목표 수 — 안 보는 동안 끝냈으면 요약에 한 줄 (U13) */
  dailyDone?: number;
  /** 떠날 때 알림 뒤에 줄 서 있던 수 — 돌아와 그 알림을 남길 때 그만큼만 (떠난 뒤 줄 선 것은 요약이 대신) */
  thenAtLeave?: number;
  /** 떠날 때 연 지역 수 — 안 보는 동안 연 지역을 요약에 한 줄 (U6 — orders #70) */
  regions?: number;
  /** 안 보는 동안 다시 켜서 처음부터 한 전투 수 — "다시 켜서 전투를 처음부터!" 줄이 숨김에서 못 본 채 지나감 (ideas 730) */
  restarts?: number;
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
    // easy = 방치 경험치 배율 (5.2 — 1 아래일 때만, 넘기기에서 버려지던 것 · 코드 리뷰어 #70)
    .map((e) => ({ uid: text(e.uid, 20) ?? '', name: text(e.name, 30) ?? '', gain: num(e.gain, 0, 1e9) ?? 0, from: num(e.from, 1, 100) ?? 1, to: num(e.to, 1, 100) ?? 1, ...(num(e.easy, 0, 0.99) !== null ? { easy: e.easy as number } : {}) }));
  const learned = raw.learned
    .slice(0, 12)
    .filter(isObj)
    .map((l) => ({ name: text(l.name, 30) ?? '', move: text(l.move, 30) ?? '' }));
  const c = raw.caught;
  // uid · isNew (S12 소개 카드, 2026-10-20) — 옛 상태에는 없음 → 빈 uid (소개 카드 없이 결과 상자) · NEW 없음
  // stones = 막 잡은 포켓몬을 진화시킬 가방의 돌 (#131) — 웹뷰와 주고받아도 남게 · 진화의 돌 · 있는 종만 (이상한 칸은 버림 — 코드 리뷰어)
  const stones = isObj(c) && Array.isArray(c.stones)
    ? c.stones
        .slice(0, STONES.length)
        .filter(isObj)
        .flatMap((s) => ((STONES as readonly unknown[]).includes(s.item) && Number.isInteger(s.to) && speciesOf(s.to as number) && text(s.toName, 30) !== null ? [{ item: s.item as ItemId, to: s.to as number, toName: text(s.toName, 30) as string }] : []))
    : [];
  const caught =
    isObj(c) && text(c.name, 30) !== null && typeof c.toBox === 'boolean'
      ? { name: text(c.name, 30) as string, toBox: c.toBox, uid: text(c.uid, 20) ?? '', isNew: c.isNew === true, ...(stones.length > 0 ? { stones } : {}) }
      : null;
  const quote = text(raw.quote, 120);
  return {
    title: text(raw.title) as string,
    exp,
    money: num(raw.money, 0, 1e9) ?? 0,
    item: text(raw.item, 30),
    ...(text(raw.treasure, 30) !== null ? { treasure: text(raw.treasure, 30) } : {}),
    caught,
    learned,
    choices: num(raw.choices, 0, 1000) ?? 0,
    badge: text(raw.badge, 30),
    // 라이벌 (gdd 4.12) — 웹뷰와 주고받아도 한마디 · 희귀 표시가 남게
    ...(quote !== null ? { quote } : {}),
    ...(raw.rival === true ? { rival: true } : {}),
    ...(text(raw.evoNote, 80) !== null ? { evoNote: text(raw.evoNote, 80) as string } : {}),
  };
}

const okThen = (v: unknown) => v === undefined || v === 'badge' || v === 'again';
/** 3마리 고르기 — uid 3개 이하 · 겹침 없음 (세이브와 맞는지는 시작할 때 다시 봄) */
const okPick = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 3 && v.every((u) => typeof u === 'string' && u.length <= 64) && new Set(v).size === v.length;

/** 웹뷰에서 온 스테이지 진행 중 상태 — 모양이 이상하면 null (다음 걸음에 세이브를 보고 다시 정함) */
function readStage(raw: unknown): StageRuntime | null {
  if (!isObj(raw)) return null;
  const ms = num(raw.ms, 0, 1e9);
  switch (raw.phase) {
    case 'walk':
      return { phase: raw.phase };
    case 'badge':
      return { phase: 'badge', ...(ms !== null && ms > 0 ? { ms } : {}), ...(raw.again === true ? { again: true as const } : {}) };
    case 'lobby':
      return { phase: 'lobby', ...(okPick(raw.pick) ? { pick: raw.pick } : {}), ...(raw.picking === true ? { picking: true as const } : {}) };
    case 'clear':
      return ms !== null && ms > 0 ? { phase: 'clear', ms } : { phase: 'clear' };
    case 'trainer': {
      const n = num(raw.n, 0, 10);
      if (ms === null || n === null || !Number.isInteger(n)) return null;
      const pickMs = num(raw.pickMs, 0, 1e9);
      return {
        phase: 'trainer',
        n,
        ms,
        ...(typeof raw.team === 'boolean' ? { team: raw.team } : {}),
        ...(raw.team === true && okPick(raw.pick) ? { pick: raw.pick, ...(pickMs !== null ? { pickMs } : {}) } : {}),
        // vsAt 는 지금 ms 보다 앞이어야 (먼 미래면 만남에서 멈춤 — 코드 리뷰어)
        ...(num(raw.vsAt, 0, ms) !== null ? { vsAt: raw.vsAt as number } : {}),
        ...(raw.ask === true ? { ask: true as const } : {}),
      };
    }
    case 'rival':
      return ms !== null && isHeroLookId(raw.rival) ? { phase: 'rival', rival: raw.rival, ms } : null;
    case 'gym-enter':
      return ms !== null ? { phase: 'gym-enter', ms } : null;
    case 'facility': {
      const at = num(raw.at, 0, 1);
      if (ms === null || at === null || (raw.kind !== 'hospital' && raw.kind !== 'shop') || typeof raw.inside !== 'boolean') return null;
      return { phase: 'facility', kind: raw.kind, at, ms, inside: raw.inside };
    }
    case 'defeat': {
      const lost = num(raw.lost, 0, 1e9);
      if (typeof raw.gym !== 'boolean' || lost === null) return null;
      const left = num(raw.left, 0, 6);
      const keep = typeof raw.keep === 'string' && raw.keep.length <= 40 ? { keep: raw.keep, ...(left !== null ? { left: Math.floor(left) } : {}) } : {};
      return ms !== null && ms > 0 ? { phase: 'defeat', gym: raw.gym, lost, ms, ...keep } : { phase: 'defeat', gym: raw.gym, lost, ...keep };
    }
    case 'appear':
      // 옛 상태의 space · ambush 칸은 버림 (시작은 pendingEncounter.start)
      if (ms === null || typeof raw.isNew !== 'boolean') return null;
      return { phase: 'appear', ms, isNew: raw.isNew };
    case 'team': {
      const team = readTeam(raw.team);
      return team ? { phase: 'team', team } : null;
    }
    case 'battle': {
      const battle = readBattle(raw.battle);
      return battle ? { phase: 'battle', battle } : null;
    }
    case 'hold':
      return raw.why === 'shiny' || raw.why === 'rival' ? { phase: 'hold', why: raw.why } : null;
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
      if (ms === null || !summary || !okThen(raw.then)) return null;
      return raw.then === 'badge' || raw.then === 'again' ? { phase: 'result', summary, ms, then: raw.then } : { phase: 'result', summary, ms };
    }
    case 'choice': {
      // −1 = 진화를 보기 전 기다림
      const cms = raw.ms === -1 ? -1 : ms;
      if (cms === null || !okThen(raw.then)) return null;
      return raw.then === 'badge' || raw.then === 'again' ? { phase: 'choice', ms: cms, then: raw.then } : { phase: 'choice', ms: cms };
    }
    default:
      return null;
  }
}

/** 다른 쪽(웹뷰)에서 온 진행 중 상태 — 이상한 값은 새 시드 · 기본값으로 */
export function readRuntime(raw: unknown, fallbackSeed: number, stepMs: number = TIMING.simStepMs): RuntimeState {
  const r = isObj(raw) ? raw : {};
  const rng = r.rngState;
  const acc = r.stepAccMs;
  const toast =
    isObj(r.toast) && typeof r.toast.text === 'string' && num(r.toast.ms, 0, 60_000) !== null
      ? { text: r.toast.text.slice(0, 300), ms: r.toast.ms as number, ...readThen(r.toast.then), ...(num(r.toast.thenMs, 500, 60_000) !== null ? { thenMs: r.toast.thenMs as number } : {}), ...(r.toast.kind === 'auto-tip' ? { kind: 'auto-tip' as const, ...(r.toast.counted === true ? { counted: true as const } : {}) } : {}) }
      : null;
  return {
    rngState: typeof rng === 'number' && Number.isInteger(rng) && rng >= 0 && rng <= 0xffffffff ? rng : fallbackSeed >>> 0,
    stepAccMs: typeof acc === 'number' && Number.isFinite(acc) && acc >= 0 && acc < stepMs ? acc : 0,
    speed: num(r.speed, 1, MAX_SPEED) ?? 1,
    stage: readStage(r.stage),
    // 지역 표의 스테이지 모두 (개발 모드 해변을 넘길 때 stageId 가 빠져 결과 상자 · 부탁이 사라지던 것 — 코드 리뷰어 #52)
    stageId: (REGION_STAGE_IDS as readonly unknown[]).includes(r.stageId) ? (r.stageId as StageId) : null,
    toast,
    headless: false, // 웹뷰에서 온 상태는 늘 보이는 쪽 — 확장이 넘겨받을 때 다시 켬
    ...(readAwayLog(r.awayLog) ? { awayLog: readAwayLog(r.awayLog)! } : {}),
    ...((GAME_NOTICES as readonly unknown[]).includes(r.noticed) ? { noticed: r.noticed as GameNotice } : {}),
    ...(num(r.resumed, 1, 10_000) !== null ? { resumed: r.resumed as number, ...(r.resumeActed === true ? { resumeActed: true } : {}) } : {}),
    ...(r.backTip === true ? { backTip: true as const } : {}),
    ...(typeof r.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.today) ? { today: r.today } : {}),
    ...(num(r.chooseMs, 0, 1e6) !== null ? { chooseMs: r.chooseMs as number } : {}),
    ...(isObj(r.view) && num(r.view.w, 0, 20_000) !== null && num(r.view.h, 0, 20_000) !== null ? { view: { w: r.view.w as number, h: r.view.h as number } } : {}),
    // 개발 모드 (임시) — 확장이 개발 모드가 아니면 다시 뗌 (game-session)
    ...(readDev(r.dev) ? { dev: readDev(r.dev)! } : {}),
  };
}

/** 이어 띄울 알림 — 글 하나 또는 줄 (최대 4) */
function readThen(v: unknown): { then?: string | string[] } {
  if (typeof v === 'string') return { then: v.slice(0, 300) };
  if (Array.isArray(v)) {
    const q = v.filter((x): x is string => typeof x === 'string').slice(0, 4).map((x) => x.slice(0, 300));
    return q.length === 0 ? {} : { then: q.length === 1 ? q[0]! : q };
  }
  return {};
}

function readAwayLog(v: unknown): AwayLog | null {
  if (!isObj(v) || !isObj(v.bag)) return null;
  const money = num(v.money, 0, 1e12);
  const wild = num(v.wild, 0, 1e6);
  if (money === null || wild === null) return null;
  const bag: AwayLog['bag'] = {};
  for (const id of ITEM_IDS) {
    const n = num(v.bag[id], 0, 1e6);
    if (n !== null) bag[id] = n;
  }
  const lost = num(v.lost, 0, 1e6);
  const at = isObj(v.at) && ((REGION_STAGE_IDS as readonly unknown[]).includes(v.at.place) || v.at.place === 'gym') && num(v.at.progress, 0, 1) !== null ? { place: v.at.place as StageId | 'gym', progress: v.at.progress as number } : null;
  const levels: Record<string, number> = {};
  if (isObj(v.levels)) for (const [uid, lv] of Object.entries(v.levels).slice(0, 6)) if (typeof uid === 'string' && uid.length <= 40 && num(lv, 1, 100) !== null) levels[uid] = Math.floor(lv as number);
  const points = num(v.points, 0, 1e6);
  const toastAtLeave = typeof v.toastAtLeave === 'string' ? v.toastAtLeave.slice(0, 300) : null;
  return {
    money,
    bag,
    wild: Math.floor(wild),
    ...(lost !== null ? { lost: Math.floor(lost) } : {}),
    ...(at ? { at } : {}),
    ...(isObj(v.levels) ? { levels } : {}),
    ...(points !== null ? { points: Math.floor(points) } : {}),
    ...(toastAtLeave !== null ? { toastAtLeave } : {}),
    ...(num(v.dailyDone, 0, 3) !== null ? { dailyDone: Math.floor(v.dailyDone as number) } : {}),
    ...(num(v.thenAtLeave, 0, 4) !== null ? { thenAtLeave: Math.floor(v.thenAtLeave as number) } : {}),
    ...(num(v.regions, 1, 16) !== null ? { regions: Math.floor(v.regions as number) } : {}),
    ...(num(v.restarts, 1, 1e6) !== null ? { restarts: Math.floor(v.restarts as number) } : {}),
  };
}

/**
 * 패널이 안 보일 때도 계산을 이어 할지 (mvp-spec 3.3 U2).
 * 자동 전투가 꺼져 있으면 게임이 멈추고, 켜져 있으면 계속 (그림은 안 그리고 계산만).
 */
export function shouldRunWhenHidden(state: GameState): boolean {
  return state.save.settings.autoBattle;
}
