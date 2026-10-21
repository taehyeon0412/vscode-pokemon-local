/**
 * 연출이 끝날 때까지 웹뷰 전투 진행을 붙잡음 — 엔진은 기술 0.9초인데 일반 모드 연출은 0.5 ~ 2.4초라 (2026-10-19).
 * 지금 연출 중인 행동이 다음 걸음에 끝나는데 (피해가 들어가는 순간) 연출이 아직이면 그 걸음만 미룸 → 피해 숫자가 연출이 맞는 순간에 뜸.
 * 안 볼 때 확장 계산 (엔진) 은 그대로 · 상한이 있어 오래 멈추지 않음.
 */
import { TIMING } from '../../../core/balance';
import { MAX_SPEED, takeSteps, type BattleState, type GameState } from '../../../core/engine';

/** 한 행동을 붙잡는 상한 (ms) — 기술 · 필살기 (일반 모드 필살기는 0.9 + 3.6 ~ 10 + 0.5초) */
export const FX_HOLD_MAX_MS = 4000;
export const FX_HOLD_ULT_MAX_MS = 12_000;
/** 힘대결 — VS (1.5) + 만남 (~1) + 밀기 3.6초까지 */
export const FX_HOLD_DUEL_MAX_MS = 7_000;

/** 3:3 필살기 붙잡기 열쇠 — 엔진 필살기 시작 시각 (기록 at = 그때 b.t, 필살기 단계에선 b.t − ult.ms) · 실행기 (fx/team) 와 여기가 같은 함수를 씀 */
export const teamUltKey = (startT: number): string => `teamult${startT}`;

let holdUntil = 0;
let holdKey = '';
/** 시간 막대가 시작하는 때 (힘대결 = 힘대결이 시작된 때) · 붙잡기를 건 때 */
let holdFrom = 0;
let holdAt = 0;

/** 연출 하나 = 이 열쇠 (BattleLayer 가 연출을 다시 시작하는 기준과 같음) */
export function battleAnimKey(b: BattleState): string {
  if (b.anim) return `${b.anim.side}${b.anim.action.kind}${b.t - b.anim.ms}`;
  // 힘대결 하나 = 시작 시각 (승자가 정해져도 같은 열쇠)
  return b.phase === 'clash' && b.clash ? `clash${b.t - b.clash.ms}` : '';
}

/** 이 행동의 연출이 now + ms 까지 걸림 */
export function holdFx(key: string, ms: number, now: number, maxMs = FX_HOLD_MAX_MS, from = now): void {
  holdKey = key;
  holdUntil = now + Math.max(0, Math.min(ms, maxMs));
  holdFrom = Math.min(from, now);
  holdAt = now;
}

/** 이 연출을 붙잡는 동안 — { from: 시간 막대 시작, at: 붙잡기를 건 때, until: 끝 } (없으면 null). 붙잡는 동안 엔진 시간이 멈춰서 시간 막대는 이걸로 그림.
 *  CSS 애니메이션 지연은 at − from 으로 고정 (그릴 때마다 지금 시각으로 바꾸면 지난 시간이 두 번 들어가 두 배로 빨리 줄어듦) */
export function holdWindow(key: string, now: number): { from: number; at: number; until: number } | null {
  return key && key === holdKey && now < holdUntil ? { from: holdFrom, at: holdAt, until: holdUntil } : null;
}

/** 1:1 필살기 연출이 끝나는 때 (performance.now) — 맞힌 뒤에도 연출이 남아서 (솔라빔 줄기 약 2.3초), 그걸로 쓰러뜨렸으면
 *  다음 볼 · 결과 · 마지막 기회 시간을 그 끝까지 붙잡고 벌러덩도 그 뒤에 넘어감 (벌러덩이 연출 밑에서 다 지나가던 것 — UX 리뷰어 2026-10-21) */
let fxTailUntil = 0;
export function setFxTail(until: number): void {
  fxTailUntil = until;
}
/** 필살기 연출이 남은 ms (없으면 0) */
export function fxTailLeft(now: number): number {
  return Math.max(0, fxTailUntil - now);
}

/** 필살기가 상대를 덮는 연출이 끝나는 때 (performance.now · 연출 다리 timing 의 cover — 상대를 안 덮는 필살기는 큰 맞음 main) — 0 = 모름 (꼬리 끝을 씀).
 *  벌러덩 · 고르기 목록 기다림만 이걸로 (덮지 않는 자기 둘레 필살기에 쓰러지면 연출 끝까지 서 있던 것 — UX 리뷰어 4차) · 다음 볼 · 결과 붙잡기는 꼬리 끝 그대로 */
let fxCoverUntil = 0;
export function setFxCover(until: number): void {
  fxCoverUntil = until;
}
/** 쓰러진 포켓몬이 넘어지기 전에 기다릴 남은 ms — 덮음 끝 (꼬리 끝을 넘지 않음) · 모르면 꼬리 끝 */
export function fxCoverLeft(now: number): number {
  return fxCoverUntil > 0 ? Math.max(0, Math.min(fxCoverUntil, fxTailUntil) - now) : fxTailLeft(now);
}

/** 벌러덩이 넘어가는 때 (game.css pg-ko · pg-ko-late 27% × 2.3초) — 시작 뒤 이만큼 맞은 모습으로 섰다가 넘어감 */
export const KO_FLIP_MS = 621;
/** 벌러덩 전체 길이 (game.css pg-ko 2.3s — 흐려져 사라질 때까지) */
export const KO_ANIM_MS = 2300;
/** 넘어짐 기다림 (CSS --pg-ko-wait) — 덮음 끝 0.4초 전에 넘어지게 (넘어가는 0.62초를 빼서 — 빼지 않아 덮음 끝보다 0.22초 늦게 넘어지던 것, UX 리뷰어 8차) */
export function koWaitMs(now: number): number {
  return Math.max(0, Math.round(fxCoverLeft(now)) - 400 - KO_FLIP_MS);
}

/** 다음 포켓몬 고르기 목록이 보이는 때 (performance.now · 0 = 고르는 중 아님) — BattleMenu 가 정함 · 한 줄 말 "다음 포켓몬을 골라요" 도 그때 붙음 (목록보다 5초 먼저 떠서 눌러도 반응이 없던 것 — UX 리뷰어 8차) */
let pickShowAt = 0;
export function setPickShow(at: number): void {
  pickShowAt = at;
}
export function pickShown(now: number): boolean {
  return pickShowAt > 0 && now >= pickShowAt;
}

export function releaseFx(): void {
  holdUntil = 0;
  holdKey = '';
}

/** 이번 걸음을 미룰지 — 같은 행동 · 이번 프레임에 끝날 수 있음 · 연출이 아직.
 *  엔진 (advance) 은 모아 둔 시간 (stepAccMs) + 이번 시간 × 배속 만큼 걸어서 — 이번 시간만 보면 끝 걸음이 빠져나감 (2026-10-19 필살기가 2.2초에 끊김) */
export function shouldHoldBattle(state: GameState, dtMs: number, now: number): boolean {
  // 필살기로 쓰러뜨린 뒤 연출이 남았으면 다음 볼 · 결과 · 마지막 기회 시간을 붙잡음 (상한 = 연출 길이 — FX_HOLD_ULT_MAX_MS 안).
  // 맞힌 순간 releaseFx 가 holdUntil 을 지워서 아래 첫 줄보다 먼저 봐야 함 (뒤에 두어 한 번도 안 걸리던 것 — UX 리뷰어 2026-10-21)
  const st0 = state.runtime.stage;
  const b0 = st0?.phase === 'battle' ? st0.battle : null;
  // 마지막 기회는 덮음 끝까지만 (세기 시작 = 넘어진 뒤 — 꼬리 끝까지 붙잡으면 "6초" 가 5초 넘게 서 있던 것, UX 리뷰어 8차)
  const tailEnd = b0?.phase === 'last' && fxCoverUntil > 0 ? Math.min(fxCoverUntil, fxTailUntil) : fxTailUntil;
  if (b0 && !b0.anim && (b0.phase === 'over' || b0.phase === 'last') && now < tailEnd) return true;
  // 다음 볼 (send) — 벌러덩이 시작할 때 (넘어짐 기다림 끝 = 덮음 끝 − 0.4 − 0.62초) 부터 내보내기 시간을 셈 → 보통 기술과 같은 박자 (볼은 벌러덩이 끝날 즈음) — 덮음 끝을 모르면 꼬리 끝까지.
  //   꼬리 끝까지 붙잡으면 빈 화면 2.2초 (8차) · 꼬리 동안 세면 넘어지기 전에 볼이 터짐 (9차) · 벌러덩 끝까지 붙잡으면 사라진 뒤 트레이너만 2초 (10차)
  if (b0 && !b0.anim && b0.phase === 'send' && fxTailUntil > 0) {
    const koStart = fxCoverUntil > 0 ? Math.min(fxCoverUntil, fxTailUntil) - 400 - KO_FLIP_MS : fxTailUntil;
    if (now < koStart) return true;
  }
  if (now >= holdUntil) return false;
  const st = state.runtime.stage;
  // 3:3 필살기 · 합동 마무리 — 맞는 순간 걸음을 연출이 맞힐 때까지 미룸 (그동안 나머지는 원래 멈춤 · 열쇠 = 시작 시각, fx/team teamUltKey)
  if (st?.phase === 'team') {
    const tb = st.team;
    const u = tb.ult;
    if (tb.phase !== 'ult' || !u || u.hit || teamUltKey(tb.t - u.ms) !== holdKey) return false;
    const speed = Math.min(MAX_SPEED, Math.max(1, state.runtime.speed || 1));
    const { steps } = takeSteps(state.runtime.stepAccMs, dtMs * speed, TIMING.simStepMs);
    return steps > 0 && u.ms + steps * TIMING.simStepMs >= u.hitMs;
  }
  const b = st?.phase === 'battle' ? st.battle : null;
  if (!b || battleAnimKey(b) !== holdKey) return false;
  const speed = Math.min(MAX_SPEED, Math.max(1, state.runtime.speed || 1));
  const { steps } = takeSteps(state.runtime.stepAccMs, dtMs * speed, TIMING.simStepMs);
  if (steps === 0) return false;
  const a = b.anim;
  if (b.phase === 'anim' && a) return a.ms + steps * TIMING.simStepMs >= a.dur;
  // 힘대결 — 승자를 정하는 걸음 (연타는 그동안 계속 셈)
  const c = b.phase === 'clash' ? b.clash : null;
  return !!c && c.winner === null && c.ms + steps * TIMING.simStepMs >= TIMING.clashMs;
}
