import { describe, expect, it } from 'vitest';
import { sampleMonster, sampleSave } from '../../../test/fixtures/save';
import { BALANCE } from '../../core/balance';
import { lobbyView, MENU_KEYS, menuLabels, menuShortcutOf } from './model';

describe('S16 ④ 추천 레벨 (mvp-spec S16)', () => {
  it('내 팀에서 가장 센 3마리 평균과 비교 — 관장이 3마리라 약한 2마리 때문에 빨간색이 되지 않게 (단계 11 플레이 리뷰)', () => {
    const levels = [17, 16, 14, 12, 11];
    const monsters = Object.fromEntries(levels.map((level, i) => [`m${i}`, sampleMonster({ uid: `m${i}`, level })]));
    const save = sampleSave({ monsters, party: levels.map((_, i) => `m${i}`) });
    const v = lobbyView(save);
    expect(v.recommended).toBe(BALANCE.gymRecommendedLevel);
    // 5마리 평균 14 → 빨간색이었음 · 센 3마리 (17 · 16 · 14) 평균 15.7
    expect(v.average).toBe(15.7);
    expect(v.short).toBe(false);
    const weak = lobbyView(sampleSave({ monsters: { m0: sampleMonster({ uid: 'm0', level: 9 }) }, party: ['m0'] }));
    expect([weak.average, weak.short]).toEqual([9, true]);
  });
});

describe('S06 ⑦ ~ ⑩ 정보줄 메뉴 — 단축키 + 아이콘 + 이름 (2026-10-19 태현 님)', () => {
  it('F 빨리 걷기 · M 지도 · P 내 포켓몬 · B 가방 · S 설정 — 자판 자리 (한글 입력 상태도) 로 찾고, 다른 키는 없음', () => {
    expect(['KeyF', 'KeyM', 'KeyP', 'KeyB', 'KeyS'].map(menuShortcutOf)).toEqual(['fast', 'map', 'team', 'bag', 'settings']);
    expect(['KeyZ', 'Digit1', 'Space', 'Enter', 'Escape', 'KeyA'].map(menuShortcutOf)).toEqual([null, null, null, null, null, null]);
    expect(new Set(Object.values(MENU_KEYS)).size).toBe(5);
  });

  it('폭에 따라 줄임 — 지도 줄이 있으면 560 부터 단축키까지 · 470 부터 이름, 없으면 (지도와 나눠 씀) 1100 · 920', () => {
    expect([1860, 560, 559, 470, 469, 240].map((w) => menuLabels(w, true))).toEqual(['full', 'full', 'text', 'text', 'icon', 'icon']);
    expect([1860, 1100, 1000, 920, 720].map((w) => menuLabels(w, false))).toEqual(['full', 'full', 'text', 'text', 'icon']);
  });
});
