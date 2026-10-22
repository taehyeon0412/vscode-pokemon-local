/**
 * 모드 진행 (gdd 4.5 · orders #30 — dev-log #40 안 A): 노말 ↔ 하드는 진행 (배지 · 깬 스테이지 · 위치 · 병원 · 연 지역) 만 따로,
 * 포켓몬 · 돈 · 아이템 · 도감 · 설정은 같이. 지금 모드 진행은 맨 위 칸 그대로 (읽는 곳 약 156곳을 안 고침) · 안 하는 모드는 stash.
 */
import type { GameMode, ModeProgress, Save } from './schema';
import { normalCleared, swapProgress } from './validate';

/** 처음 들어가는 모드의 진행 — 숲 1-1 부터 */
export const freshProgress = (): ModeProgress => ({ badges: [], stages: {}, location: { screen: 'stage', stageId: 'forest-1' }, lastHospital: null, regions: { order: ['forest'] } });

/** 지금 모드 */
export const modeOf = (save: Save): GameMode => save.mode ?? 'normal';

/**
 * 모드 바꾸기 — 맨 위 진행과 stash 를 맞바꿈 (처음이면 숲 1-1 부터). 못 바꾸면 null:
 * 전투 · 고르기 중 (pendingEncounter · pendingChoices — 그 진행에 묶인 것) · 노말 엔딩 전에 하드.
 * 부르는 쪽은 세이브만 바꾸지 말고 createGameState 로 새로 + 새 epoch (handToWebview) — 세이브 불러오기 (confirmImport) 와 같이 (옛 진행의 장면 · stageId 가 남지 않게)
 */
export function switchMode(save: Save, to: GameMode): Save | null {
  if (to === modeOf(save)) return save;
  if (save.pendingEncounter || save.pendingChoices.length > 0) return null;
  if (to === 'hard' && !normalCleared(save)) return null;
  const swapped = swapProgress(save, save.stash ?? freshProgress());
  return to === 'hard' ? { ...swapped, mode: 'hard' } : swapped;
}
