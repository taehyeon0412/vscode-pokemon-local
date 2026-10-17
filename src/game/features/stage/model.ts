/**
 * S06 스테이지 — 화면을 모르는 부분. 단계 3 은 이름표만, 걷기 · 흔적 · 조우는 단계 4.
 */
import type { StageId } from '../../core/save';

export interface StageInfo {
  id: StageId;
  /** 스테이지 이름 (gdd: 이름은 [아이디어] 예시) */
  name: string;
  /** 번호 — 화면에는 작게 (mvp-spec S06 ②) */
  code: string;
  icon: string;
}

export const STAGES: Readonly<Record<StageId, StageInfo>> = {
  'forest-1': { id: 'forest-1', name: '새싹 오솔길', code: '1-1', icon: '🌲' },
  'forest-2': { id: 'forest-2', name: '버섯 그늘길', code: '1-2', icon: '🍄' },
  'forest-3': { id: 'forest-3', name: '깊은 숲', code: '1-3', icon: '🌳' },
};

/** "🌲 새싹 오솔길 (1-1)" — 글로만 쓸 때 (클리어 카드 문구 등). 화면 이름표는 STAGES 로 번호를 따로 작게 */
export function stageLabel(id: StageId): string {
  const s = STAGES[id];
  return `${s.icon} ${s.name} (${s.code})`;
}
