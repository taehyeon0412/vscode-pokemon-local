/**
 * 오늘의 목표 (gdd 4.11 U13 · 기획 검토 R19 A, orders #28) — 날 = 내 PC 날짜, 하루 셋:
 * ① 켜 두기만 해도 되는 것 (야생 10마리 · 트레이너 3명 · 스테이지 1개 중) ② 봐야 되는 것 (새 종 2마리 · 완벽 패링 3번 · 부탁 1개 중)
 * ③ 그 지역 타입 (숲 = 풀 · 벌레 5마리 이기기). 보상 하나마다 몬스터볼 2 또는 흔한 팔 물건 1, 셋 다 하면 금구슬 1 [임시값].
 * 어제 것은 쌓이지 않음 (밀린 숙제 없음). 지금은 개발 모드에서만 (BALANCE.daily.on — 3:3 을 켤 때 같이).
 */
import { Rng } from '../engine/rng';
import type { Daily, DailyGoal, DailyKind, ItemId } from '../save';
import { typeNameKo } from '../text';
import { REGIONS } from './region';

/** 내 PC 날짜 "2026-10-22" (자정에 바뀜) — 웹뷰 · 확장이 걸음마다 runtime.today 로 넣음 (엔진은 시계를 모름) */
export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const isDayKey = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** ① 켜 두기만 해도 · ② 봐야 · ③ 지역 타입 (지역 표의 흔한 타입 — 숲 = 풀 · 벌레) */
const PASSIVE: readonly { kind: DailyKind; need: number }[] = [
  { kind: 'wild-win', need: 10 },
  { kind: 'trainer-win', need: 3 },
  { kind: 'stage-clear', need: 1 },
];
const WATCH: readonly { kind: DailyKind; need: number }[] = [
  { kind: 'new-catch', need: 2 },
  { kind: 'perfect-parry', need: 3 },
  { kind: 'request', need: 1 },
];
const FOREST_TYPES = REGIONS.forest.wild.common;
const TYPE_NEED = 5;
/** 보상 — 몬스터볼 2 또는 흔한 팔 물건 1 · 셋 다 하면 금구슬 1 [임시값] */
const COMMON_SELL: readonly ItemId[] = ['tiny-mushroom', 'pearl', 'stardust'];
export const DAILY_BONUS: { item: ItemId; n: number } = { item: 'nugget', n: 1 };

function seedOf(day: string): number {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) h = Math.imul(h ^ day.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** 그날의 목표 셋 (같은 날이면 늘 같음 — 날짜 시드) */
export function dailyFor(day: string): Daily {
  const rng = new Rng(seedOf(day));
  const pick = <T>(list: readonly T[]): T => list[rng.int(0, list.length - 1)]!;
  const reward = (): Pick<DailyGoal, 'reward' | 'rewardN'> => (rng.chance(0.5) ? { reward: 'poke-ball', rewardN: 2 } : { reward: pick(COMMON_SELL), rewardN: 1 });
  const a = pick(PASSIVE);
  const b = pick(WATCH);
  const type = pick(FOREST_TYPES);
  return {
    day,
    goals: [
      { ...a, have: 0, ...reward() },
      { ...b, have: 0, ...reward() },
      { kind: 'type-win', need: TYPE_NEED, have: 0, type, ...reward() },
    ],
  };
}

/** 목표 글 — "야생 10마리 이기기" (화면 · 알림) */
export function dailyLabel(g: Pick<DailyGoal, 'kind' | 'need' | 'type'>): string {
  switch (g.kind) {
    case 'wild-win':
      return `야생 ${g.need}마리 이기기`;
    case 'trainer-win':
      return `트레이너 ${g.need}명 이기기`;
    case 'stage-clear':
      return `스테이지 ${g.need}개 깨기`;
    case 'new-catch':
      return `새 종 ${g.need}마리 잡기`;
    case 'perfect-parry':
      return `완벽 패링 ${g.need}번`;
    case 'request':
      return `부탁 ${g.need}개 들어주기`;
    case 'type-win':
      return `${typeNameKo(g.type ?? 'normal')} 타입 ${g.need}마리 이기기`;
  }
}

/** 한 일 — 그 종류 목표에 n 을 더함 (야생 승리는 타입 목표에도 — foeTypes) · 이번에 끝난 목표 */
export function dailyAdd(d: Daily, kind: DailyKind, n: number, foeTypes: readonly string[] = []): { daily: Daily; finished: DailyGoal[] } {
  if (n <= 0) return { daily: d, finished: [] };
  const finished: DailyGoal[] = [];
  const goals = d.goals.map((g) => {
    const hit = g.kind === kind || (kind === 'wild-win' && g.kind === 'type-win' && g.type !== undefined && foeTypes.includes(g.type));
    if (!hit || g.done) return g;
    const have = Math.min(g.need, g.have + n);
    const next: DailyGoal = { ...g, have, ...(have >= g.need ? { done: true as const } : {}) };
    if (next.done) finished.push(next);
    return next;
  });
  return finished.length || goals.some((g, i) => g !== d.goals[i]) ? { daily: { ...d, goals }, finished } : { daily: d, finished: [] };
}

export const dailyDone = (d: Daily | undefined): number => d?.goals.filter((g) => g.done).length ?? 0;
