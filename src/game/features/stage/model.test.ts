import { describe, expect, it } from 'vitest';
import { STAGE_IDS } from '../../core/save';
import { STAGES, stageLabel } from './model';

describe('스테이지 이름표', () => {
  it('세이브의 스테이지 id 마다 이름이 있음', () => {
    for (const id of STAGE_IDS) expect(STAGES[id].id).toBe(id);
  });

  it('미니맵 모양: "🌲 새싹 오솔길 (1-1)" (gdd S06 ②)', () => {
    expect(stageLabel('forest-1')).toBe('🌲 새싹 오솔길 (1-1)');
  });
});
