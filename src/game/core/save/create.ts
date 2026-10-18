import { BALANCE } from '../balance';
import { SAVE_VERSION, type Save } from './schema';

/** 새로 하기 (S02 ①) — 스타팅을 고르기 전 빈 세이브 */
export function createNewSave(now: number): Save {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    updatedAt: now,
    playTimeMs: 0,
    player: null,
    monsters: {},
    party: [],
    box: [],
    nextMonsterUid: 1,
    bag: { 'poke-ball': BALANCE.startingPokeBalls },
    money: BALANCE.startingMoney,
    badges: [],
    stages: {},
    location: { screen: 'title' },
    lastHospital: null,
    dex: { seen: [], caught: [] },
    pendingEncounter: null,
    pendingChoices: [],
    settings: { notifications: true, autoBattle: false },
  };
}
