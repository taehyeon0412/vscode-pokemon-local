import { describe, expect, it } from 'vitest';
import { sampleMonster, sampleSave } from '../../../test/fixtures/save';
import { BALANCE } from '../../core/balance';
import { lobbyView } from './model';

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
