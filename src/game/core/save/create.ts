import { BALANCE } from '../balance';
import { NOTIFY_OFF_TIP, SAVE_VERSION, type Save } from './schema';

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
    // 알림 (VS Code 팝업) 은 처음 꺼짐 — 기다리면 탭 배지 · 패널 한 줄 · 그동안 요약 (gdd 4.13)
    settings: { notifications: false, autoBattle: false },
    tips: [NOTIFY_OFF_TIP],
  };
}
