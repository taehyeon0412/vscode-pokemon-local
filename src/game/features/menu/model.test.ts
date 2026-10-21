import { describe, expect, it } from 'vitest';
import { sampleMonster, sampleSave } from '../../../test/fixtures/save';
import { BALANCE } from '../../core/balance';
import { regionAceLevel } from '../../core/rules/region';
import { ICONS } from '../../data/icons';
import { clearBonusExp } from '../../core/engine';
import { clearView, ITEM_ICON, lobbyView, mapView, MENU_KEYS, menuLabels, menuShortcutOf, shopView } from './model';
import { createGameState } from '../../core/engine';

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

  it('폭에 따라 줄임 — 지도 줄이 있으면 560 부터 단축키까지 · 510 부터 이름 (480 ~ 505 에서 첫 버튼이 잘리던 것), 없으면 (지도와 나눠 씀) 1100 · 920', () => {
    expect([1860, 560, 559, 510, 509, 481, 240].map((w) => menuLabels(w, true))).toEqual(['full', 'full', 'text', 'text', 'icon', 'icon', 'icon']);
    expect([1860, 1100, 1000, 920, 720].map((w) => menuLabels(w, false))).toEqual(['full', 'full', 'text', 'text', 'icon']);
  });
});

describe('S14 상점 칸 (아트 디렉터 4차)', () => {
  it('설명은 3칸에서 안 잘리게 짧게 (10자 이하 — "아주 잘 잡힘 ×2") · 가진 수는 칸에 따로 — 긴 설명은 마우스를 올리면', () => {
    for (const r of shopView(sampleSave({ money: 5000 }))) {
      expect(r.effect.length, r.name).toBeLessThanOrEqual(10);
      expect(r.detail.length).toBeGreaterThan(r.effect.length);
    }
  });
  it('물건마다 픽셀 아이콘이 있음 (상점 · 가방)', () => {
    for (const icon of Object.values(ITEM_ICON)) expect(ICONS[icon], icon).toBeDefined();
  });
});

describe('S24 클리어 카드 보너스 — 경험 부적 판이면 받은 그대로 ×1.5 (2026-10-21 ideas #70)', () => {
  it('판 기록 boost 가 있으면 ×1.5 · 없으면 그대로', () => {
    const run = { startMs: 0, caught: 0, trainers: 0, seen: [], reach: 1, retries: 0 };
    const p = { seed: 1, progress: 1, cleared: true, defeatedTrainers: [], facilities: [] };
    expect(clearView(sampleSave({ stages: { 'forest-2': { ...p, run: { ...run, boost: true } } } }), 'forest-2').bonus).toBe(Math.round(clearBonusExp('forest-2') * BALANCE.expCharmScale));
    expect(clearView(sampleSave({ stages: { 'forest-2': { ...p, run } } }), 'forest-2').bonus).toBe(clearBonusExp('forest-2'));
  });
});

describe('세계 지도 (S07) — 지금 있는 지역 (지역 표, 디자인 UX 리뷰어)', () => {
  it('숲이면 숲 셋 (지금 그대로) · 해변 미리 보기면 해변 셋 · 지역 이름 · 그 지역 배지', () => {
    const forest = mapView(createGameState(sampleSave(), 1));
    expect(forest.region).toBe('숲');
    expect(forest.stages.map((x) => x.id)).toEqual(['forest-1', 'forest-2', 'forest-3']);
    expect(forest.stages.map((x) => x.gym)).toEqual([false, false, true]);
    const base = sampleSave();
    const beach = mapView(createGameState({ ...base, badges: ['forest', 'beach'], location: { screen: 'stage', stageId: 'beach-2' }, stages: { ...base.stages, 'beach-2': base.stages['forest-1']! } }, 1));
    expect(beach.region).toBe('해변');
    expect(beach.stages.map((x) => x.id)).toEqual(['beach-1', 'beach-2', 'beach-3']);
    expect(beach.stages[1]!.state).toBe('current');
    expect(beach.badge).toBe(true);
  });
});

describe('대기실 추천 Lv — 그 지역 관장 에이스 (gdd 5.2)', () => {
  it('숲 그대로 · 해변 체육관 (2번째) = 2번째 에이스 (T3 23)', () => {
    expect(lobbyView(sampleSave({ location: { screen: 'gym' } })).recommended).toBe(BALANCE.gymRecommendedLevel);
    expect(lobbyView(sampleSave({ location: { screen: 'gym', region: 'beach' } })).recommended).toBe(regionAceLevel(2));
  });
});
