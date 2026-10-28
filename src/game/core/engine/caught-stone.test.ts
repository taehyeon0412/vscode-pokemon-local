/** 잡기 결과 — 막 잡은 포켓몬을 가방의 진화의 돌로 진화시킬 수 있으면 어느 돌 · 어느 종 (#131 — 2026-10-28 태현 님 "추천대로" · 한 줄 · 돌 그림은 디자인) */
import { describe, expect, it } from 'vitest';
import { fixedRng } from '../../../test/fixtures/rng';
import { sampleMonster, sampleSave, viaJson } from '../../../test/fixtures/save';
import type { ItemId, Monster, Save } from '../save';
import { startBattle } from './battle';
import { battleRewards } from './rewards';
import { createGameState, readRuntime } from './state';

const wild = (species: number, form: string): Monster => sampleMonster({ uid: 'wild', species, form, level: 5, moves: [{ moveId: 33, pp: 35 }], hp: 999, caughtAt: 'forest-1' });
function catchWith(species: number, form: string, bag: Partial<Record<ItemId, number>>) {
  const w = wild(species, form);
  const save: Save = { ...sampleSave(), bag: { ...sampleSave().bag, ...bag }, pendingEncounter: { kind: 'wild', monster: w, start: 'normal' } };
  const b = { ...startBattle(save, w, 'normal'), phase: 'over' as const, result: 'catch' as const };
  return battleRewards(save, { ...b, foe: { ...b.foe, hp: 3 } }, w, 'forest-1', fixedRng(0.99));
}

describe('잡기 결과 진화의 돌 신호 (#131)', () => {
  it('천둥의돌이 있고 피카츄를 잡음 = 천둥의돌 → 라이츄 하나', () => {
    expect(catchWith(25, 'pikachu', { 'thunder-stone': 1 }).summary.caught?.stones).toEqual([{ item: 'thunder-stone', to: 26, toName: '라이츄' }]);
  });

  it('돌이 없음 · 다른 돌만 있음 · 돌로 진화하지 않는 종 = 신호 없음 (칸 자체가 없음)', () => {
    expect(catchWith(25, 'pikachu', {}).summary.caught).not.toHaveProperty('stones');
    expect(catchWith(25, 'pikachu', { 'thunder-stone': 0, 'fire-stone': 2 }).summary.caught).not.toHaveProperty('stones');
    expect(catchWith(16, 'pidgey', { 'thunder-stone': 1, 'fire-stone': 1, 'water-stone': 1, 'leaf-stone': 1, 'moon-stone': 1 }).summary.caught).not.toHaveProperty('stones');
  });

  it('이브이처럼 여럿이면 돌 차례대로 다 · 가방에 있는 것만', () => {
    const r = catchWith(133, 'eevee', { 'fire-stone': 1, 'water-stone': 1, 'thunder-stone': 1 });
    expect(r.summary.caught?.stones?.map((s) => [s.item, s.to])).toEqual([['fire-stone', 136], ['water-stone', 134], ['thunder-stone', 135]]);
    expect(catchWith(133, 'eevee', { 'water-stone': 1 }).summary.caught?.stones?.map((s) => s.item)).toEqual(['water-stone']);
  });

  it('잡지 않은 전투 결과엔 없음 · 웹뷰와 주고받아도 남음 · 이상한 칸은 버림', () => {
    const r = catchWith(25, 'pikachu', { 'thunder-stone': 1 });
    const rt = { ...createGameState(r.save, 1).runtime, stage: { phase: 'result' as const, summary: r.summary, ms: 0 }, stageId: 'forest-1' as const };
    const back = readRuntime(viaJson(rt), 1).stage;
    expect(back?.phase === 'result' && back.summary.caught?.stones).toEqual([{ item: 'thunder-stone', to: 26, toName: '라이츄' }]);
    const bad = viaJson(rt) as { stage: { summary: { caught: { stones: unknown[] } } } };
    bad.stage.summary.caught.stones = [{ item: 'master-stone', to: 26, toName: '라이츄' }, { item: 'potion', to: 26, toName: '라이츄' }, { item: 'thunder-stone', to: 'x', toName: '라이츄' }, { item: 'thunder-stone', to: 26.5, toName: '라이츄' }, { item: 'thunder-stone', to: 99999, toName: '?' }, 7];
    const badBack = readRuntime(bad, 1).stage;
    expect(badBack?.phase === 'result' && badBack.summary.caught).not.toHaveProperty('stones');
  });
});
