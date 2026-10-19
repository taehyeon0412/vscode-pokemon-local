/**
 * 패링 타이밍 (2026-10-19 태현 님 "날아오는 타이밍에 Space — 패링처럼") — 상대 공격이 "맞는 순간" 을 연출 (BattleFx) 이 적어 두고,
 * Space · 클릭을 그 순간까지 남은 ms 를 담은 패링 입력으로 바꿈. 등급은 엔진 (core/rules/battle parryGrade) 이 매김.
 * 연출이 없으면 (일반 모드 번들이 없음) 맞는 순간을 몰라서 그냥 Space — 엔진이 엔진 시간으로 어림함.
 */
import { canParry, type GameInput, type GameState } from '../../../core/engine';
import { battleAnimKey } from './hold';

/** 지금 상대 공격이 맞는 순간 — key = battleAnimKey, at = 맞는 때 (performance.now 기준), set = 적은 때 */
let impact = { key: '', at: 0, set: 0 };

/** 연출이 맞는 순간을 정했을 때 (BattleFx) */
export function setImpact(key: string, at: number, now: number): void {
  impact = { key, at, set: now };
}

/** 이 행동의 맞는 순간 (없으면 null) — 패링 원 (ParryRing) 이 이걸로 좁혀짐 */
export function impactOf(key: string): { at: number; set: number } | null {
  return key && impact.key === key ? { at: impact.at, set: impact.set } : null;
}

export function clearImpact(): void {
  impact = { key: '', at: 0, set: 0 };
}

/** Space · 판 클릭 → 상대 공격 중이고 맞는 순간을 알면 패링 (맞기까지 남은 ms), 아니면 그냥 Space */
export function spaceInput(state: GameState | null, now: number): GameInput {
  const st = state?.runtime.stage;
  const b = st?.phase === 'battle' ? st.battle : null;
  if (b && canParry(b)) {
    const w = impactOf(battleAnimKey(b));
    if (w) return { kind: 'battle', input: { kind: 'parry', ms: Math.round(w.at - now) } };
  }
  return { kind: 'space' };
}
