/**
 * 개발 모드 (임시, gdd 8장) — 세이브가 없을 때 쓰는 시연용 세이브 (저장하지 않음). 1-1 길 위 · 셋이라 3:3 도 바로.
 */
import { createGameState, type GameState } from '../core/engine';
import type { Save } from '../core/save';
import { createStartSave } from '../features/starter/model';
import { devApply } from './actions';
import { devDefault } from './runtime';

/** 시연 팀 — 리자몽 · 거북왕 · 이상해꽃 Lv 36 */
const DEMO_TEAM = [
  { dex: 6, level: 36 },
  { dex: 9, level: 36 },
  { dex: 3, level: 36 },
];

export function devDemoSave(now: number, seed: number): Save {
  let state = devState(createGameState({ ...createStartSave(now, seed, 4), location: { screen: 'stage', stageId: 'forest-1' } }, seed));
  DEMO_TEAM.forEach((m, i) => {
    state = devApply(state, { kind: 'mon', slot: i, ...m }).state;
  });
  return { ...state.save, money: 50_000, bag: { ...state.save.bag, 'poke-ball': 30, 'great-ball': 10, 'ultra-ball': 10, potion: 10 } };
}

/** 개발 모드 게임 상태 — 진행 중 값에 개발 값을 붙임 */
export function devState(state: GameState): GameState {
  return { ...state, runtime: { ...state.runtime, dev: state.runtime.dev ?? devDefault() } };
}
