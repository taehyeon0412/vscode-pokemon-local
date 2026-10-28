import { describe, expect, it } from 'vitest';
import { sampleMonster, sampleSave } from '../../../test/fixtures/save';
import { addExp } from '../../core/rules/growth';
import { expForLevel } from '../../core/rules/stats';
import { Rng } from '../../core/engine/rng';
import type { BattleSummary } from '../../core/engine';
import { createGameState } from '../../core/engine';
import { TIMING } from '../../core/balance';
import { caughtView, levelUps, needsStatHint, resultTitleShown, resultViewKey } from './model';

const summary = (exp: BattleSummary['exp']): BattleSummary => ({ title: '야생 피죤을 쓰러뜨렸다!', exp, money: 20, item: null, caught: null, learned: [], choices: 0, badge: null });

describe('잡은 뒤 소개 카드 ★ (orders #120)', () => {
  it('★ 등급 = 보관함 · 프로필과 같은 개체값 등급 (★1 · ★5)', () => {
    const iv = (v: number) => ({ hp: v, attack: v, defense: v, speed: v, ultimate: v });
    const got = { ...summary([]), caught: { name: '파이리', toBox: false, uid: 'm3', isNew: true } };
    const view = (v: number) => caughtView(got, sampleSave({ monsters: { m3: sampleMonster({ uid: 'm3', ivs: iv(v) }) } }));
    expect(view(0)?.star).toBe(1);
    expect(view(31)?.star).toBe(5);
  });
});

describe('S12 레벨업 표시 · 안내 말풍선 (2026-10-20 태현 님)', () => {
  // 갓 잡은 포켓몬 (나눈 포인트 0 · 남은 0) — 기본 sampleMonster 는 한 번 레벨업한 값 (hp 2 · 남은 2)
  const m0 = sampleMonster({ uid: 'm1', level: 5, exp: expForLevel(5), points: { hp: 0, attack: 0, defense: 0, speed: 0, ultimate: 0 }, unspentPoints: 0 });
  const grown = addExp(m0, expForLevel(7) - m0.exp, new Rng(1)); // 두 레벨 — 자동 4 · 고르는 4

  it('레벨업 목록 = 레벨이 오른 팀 포켓몬 + 남은 포인트 · 레벨이 안 오른 것 · 없는 포켓몬은 뺌', () => {
    const save = sampleSave({ monsters: { m1: grown }, party: ['m1'] });
    const ups = levelUps(summary([{ uid: 'm1', name: '이상해씨', gain: 40, from: 5, to: 7 }, { uid: 'm9', name: '파이리', gain: 20, from: 3, to: 4 }]), save);
    expect(ups).toEqual([{ uid: 'm1', name: '이상해씨', from: 5, to: 7, form: grown.form, shiny: grown.shiny, points: 4 }]);
    expect(levelUps(summary([{ uid: 'm1', name: '이상해씨', gain: 5, from: 7, to: 7 }]), save)).toEqual([]);
  });

  it('말풍선은 이번 전투에서 레벨업해 찍을 포인트가 있으면 매번 (스탯을 찍어 봤어도) · 포인트가 없으면 안 나옴 — 2026-10-20 태현 님 "레벨업 할 때마다"', () => {
    const ups = (save: ReturnType<typeof sampleSave>) => levelUps(summary([{ uid: 'm1', name: '이상해씨', gain: 40, from: 5, to: 7 }]), save);
    const fresh = sampleSave({ monsters: { m1: grown }, party: ['m1'] });
    expect(needsStatHint(ups(fresh))).toBe(true);
    const learned = sampleSave({ monsters: { m1: { ...grown, unspentPoints: 3, points: { ...grown.points, hp: grown.points.hp + 1 } } }, party: ['m1'] });
    expect(needsStatHint(ups(learned))).toBe(true);
    const none = sampleSave({ monsters: { m1: { ...grown, unspentPoints: 0, points: { ...grown.points, hp: grown.points.hp + 4 } } }, party: ['m1'] });
    expect(needsStatHint(ups(none))).toBe(false);
  });
});

describe('결과 다시 그리는 열쇠 (2026-10-21 UX 리뷰어)', () => {
  it('잡았으면 소개 카드 → 결과 상자로 넘어갈 때 열쇠가 바뀜 (빠지면 결과 상자가 안 보임)', () => {
    const base = createGameState(sampleSave(), 1);
    const caught = { ...summary([]), caught: { name: '파이리', toBox: false, uid: 'm3', isNew: true } };
    const at = (ms: number, s: BattleSummary) => resultViewKey({ ...base, runtime: { ...base.runtime, stage: { phase: 'result', summary: s, ms } } });
    expect(at(0, caught)).not.toBe(at(TIMING.caughtIntroMs, caught));
    // 소개 카드 안에서는 같음 (PC 부담) · 안 잡았으면 늘 같음
    expect(at(100, caught)).toBe(at(TIMING.caughtIntroMs - 100, caught));
    expect(at(0, summary([]))).toBe(at(TIMING.caughtIntroMs, summary([])));
  });
});

describe('S12 상자 제목 (기획 판단 2026-10-26 — 트레이너는 숫자만)', () => {
  const base: BattleSummary = { title: '', exp: [], money: 120, item: null, caught: null, learned: [], choices: 0, badge: null };
  it('트레이너 (1:1 · 3:3) 를 이긴 판 = 제목 없음 (띠 · 전투 한 줄이 같은 말)', () => {
    expect(resultTitleShown({ ...base, title: '반바지 꼬마 민수와의 승부에서 이겼다!' })).toBe(false);
    expect(resultTitleShown({ ...base, title: '엘리트 트레이너 소율과의 3:3 승부에서 이겼다!' })).toBe(false);
  });
  it('관장 · 야생 · 라이벌은 그대로', () => {
    expect(resultTitleShown({ ...base, title: '나래를 이겼다!', badge: '숲 배지' })).toBe(true);
    expect(resultTitleShown({ ...base, title: '나래를 이겼다!' })).toBe(true);
    expect(resultTitleShown({ ...base, title: '야생 파이리를 잡았다!' })).toBe(true);
    expect(resultTitleShown({ ...base, title: '라이벌 레드와의 승부에서 이겼다!', rival: true })).toBe(true);
  });
});
