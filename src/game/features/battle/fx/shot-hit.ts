/**
 * 쏘는 기술이 상대에 닿는 때 (연출 길이의 몇 %) — 틀마다 잼 (2026-10-20 태현 님 "이미 맞았는데 패링 원이 남아 있음": 하나로 0.85 를 쓰니
 *  광선은 0.5초 먼저 · 솔라빔은 0.3초 늦게 닿았음). 1:1 (BattleFx) · 3:3 실행기 (fx/team) · 기술 박자표 (dev/move-fx.py 가 이 파일을 읽음) 가 같이 씀
 */
export const SHOT_HIT_AT: Readonly<Record<string, number>> = { beam: 0.25, spark: 0.6, rings: 0.7, water: 0.8, bubbles: 0.82, glow: 0.86, breath: 0.87, solarbeam: 1 };
export const SHOT_HIT_DEFAULT = 0.85;
export const shotHitAt = (fx: string): number => SHOT_HIT_AT[fx] ?? SHOT_HIT_DEFAULT;
