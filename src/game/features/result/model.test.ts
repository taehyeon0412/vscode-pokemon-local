import { describe, expect, it } from 'vitest';
import { sampleMonster, sampleSave } from '../../../test/fixtures/save';
import { addExp } from '../../core/rules/growth';
import { expForLevel } from '../../core/rules/stats';
import { Rng } from '../../core/engine/rng';
import type { BattleSummary } from '../../core/engine';
import { levelUps, monsterSpentPoints, needsStatHint } from './model';

const summary = (exp: BattleSummary['exp']): BattleSummary => ({ title: '야생 피죤을 쓰러뜨렸다!', exp, money: 20, item: null, caught: null, learned: [], choices: 0, badge: null });

describe('S12 레벨업 표시 · 안내 말풍선 (2026-10-20 태현 님)', () => {
  // 갓 잡은 포켓몬 (나눈 포인트 0 · 남은 0) — 기본 sampleMonster 는 한 번 레벨업한 값 (hp 2 · 남은 2)
  const m0 = sampleMonster({ uid: 'm1', level: 5, exp: expForLevel(5), points: { hp: 0, attack: 0, defense: 0, speed: 0, ultimate: 0 }, unspentPoints: 0 });
  const grown = addExp(m0, expForLevel(7) - m0.exp, new Rng(1)); // 두 레벨 — 자동 4 · 고르는 4

  it('직접 나눈 포인트 = points 합 − 자동 (레벨마다 2) — 레벨업만 했으면 0, 고르는 포인트를 나누면 그만큼', () => {
    expect(monsterSpentPoints(m0)).toBe(0);
    expect(grown.unspentPoints).toBe(4);
    expect(monsterSpentPoints(grown)).toBe(0);
    const spent = { ...grown, unspentPoints: 1, points: { ...grown.points, attack: grown.points.attack + 3 } };
    expect(monsterSpentPoints(spent)).toBe(3);
  });

  it('레벨업 목록 = 레벨이 오른 팀 포켓몬 + 남은 포인트 · 레벨이 안 오른 것 · 없는 포켓몬은 뺌', () => {
    const save = sampleSave({ monsters: { m1: grown }, party: ['m1'] });
    const ups = levelUps(summary([{ uid: 'm1', name: '이상해씨', gain: 40, from: 5, to: 7 }, { uid: 'm9', name: '파이리', gain: 20, from: 3, to: 4 }]), save);
    expect(ups).toEqual([{ uid: 'm1', name: '이상해씨', from: 5, to: 7, form: grown.form, shiny: grown.shiny, points: 4 }]);
    expect(levelUps(summary([{ uid: 'm1', name: '이상해씨', gain: 5, from: 7, to: 7 }]), save)).toEqual([]);
  });

  it('말풍선은 스탯을 한 번도 안 찍어 본 동안만 · 남은 포인트가 없으면 안 나옴', () => {
    const ups = (save: ReturnType<typeof sampleSave>) => levelUps(summary([{ uid: 'm1', name: '이상해씨', gain: 40, from: 5, to: 7 }]), save);
    const fresh = sampleSave({ monsters: { m1: grown }, party: ['m1'] });
    expect(needsStatHint(fresh, ups(fresh))).toBe(true);
    const learned = sampleSave({ monsters: { m1: { ...grown, unspentPoints: 3, points: { ...grown.points, hp: grown.points.hp + 1 } } }, party: ['m1'] });
    expect(needsStatHint(learned, ups(learned))).toBe(false);
    const none = sampleSave({ monsters: { m1: { ...grown, unspentPoints: 0, points: { ...grown.points, hp: grown.points.hp + 4 } } }, party: ['m1'] });
    expect(needsStatHint(none, ups(none))).toBe(false);
  });
});
