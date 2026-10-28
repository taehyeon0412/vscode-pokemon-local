import { describe, expect, it } from 'vitest';
import { fixedRng } from '../../../test/fixtures/rng';
import { sampleMonster, sampleSave, viaJson } from '../../../test/fixtures/save';
import { TIMING } from '../balance';
import { EVO_ITEMS, evoGotNote, evoItemExamples, evoItemUsers, evoTip, evoTipId, evoTipItem, evoUsersLine } from '../rules/evo-tip';
import { isTipId, readSave, TIPS_MAX, type Save } from '../save';
import { applyInput, evoTipNow } from './play';
import { rivalWinRewards, type BattleSummary } from './rewards';
import { createGameState, readRuntime, type GameState, type StageRuntime } from './state';

const pikachu = sampleMonster({ uid: 'm3', species: 25, form: 'pikachu', level: 12 });
/** 가방에 천둥의돌 · 팀 이상해씨 + 캐터피 (+ where 에 피카츄) */
const withStone = (where: 'none' | 'team' | 'box' = 'none', o: Partial<Save> = {}): Save => {
  const s = sampleSave();
  const mons = where === 'none' ? s.monsters : { ...s.monsters, m3: pikachu };
  return { ...s, monsters: mons, party: where === 'team' ? ['m1', 'm2', 'm3'] : s.party, box: where === 'box' ? ['m3'] : [], bag: { ...s.bag, 'thunder-stone': 1 }, nextMonsterUid: 4, ...o };
};
function game(save: Save, stage: StageRuntime | null = { phase: 'walk' }): GameState {
  const s = createGameState(save, 7);
  return { ...s, runtime: { ...s.runtime, stage, stageId: 'forest-1' } };
}

describe('진화 아이템 처음 안내 (#125 — 태현 님 "천둥의돌 같은 아이템을 얻으면 … 이걸로 특정 포켓몬을 진화시킬수 있다")', () => {
  it('가방에 있는데 안내를 본 기록이 없는 진화 아이템 — 종류마다 따로 · 본 뒤엔 없음', () => {
    expect(evoTipItem(sampleSave())).toBeNull();
    expect(evoTipItem(withStone())).toBe('thunder-stone');
    expect(evoTipItem(withStone('none', { tips: [evoTipId('thunder-stone')] }))).toBeNull();
    // 다른 종류는 따로
    const two = withStone('none', { tips: [evoTipId('thunder-stone')], bag: { 'thunder-stone': 1, 'moon-stone': 1 } });
    expect(evoTipItem(two)).toBe('moon-stone');
  });

  it('쓸 포켓몬 — 팀 · 보관함 (팀 먼저) · 한 줄 · 셋 넘으면 "외 N마리"', () => {
    expect(evoItemUsers(withStone('team'), 'thunder-stone')).toEqual([{ uid: 'm3', name: '피카츄', toName: '라이츄', where: 'team' }]);
    expect(evoUsersLine(withStone('team'), 'thunder-stone')).toBe('피카츄 → 라이츄 진화 가능');
    const many = withStone('team', { monsters: { ...withStone('team').monsters, m4: { ...pikachu, uid: 'm4' }, m5: { ...pikachu, uid: 'm5' } }, box: ['m4', 'm5'] });
    expect(evoUsersLine(many, 'thunder-stone')).toBe('피카츄 → 라이츄 진화 가능 외 2');
    expect(evoUsersLine(withStone(), 'thunder-stone')).toBeNull();
  });

  it('쓸 포켓몬이 없으면 진화하는 포켓몬 예 2 ~ 3 — 잡은 적 있는 종 먼저 · 연결의끈 = 통신 진화', () => {
    const tip = evoTip(withStone(), 'thunder-stone');
    expect(tip.users).toEqual([]);
    expect(tip.examples.length).toBeGreaterThanOrEqual(2);
    expect(tip.examples.length).toBeLessThanOrEqual(3);
    expect(tip.who).toMatch(/^지금은 쓸 포켓몬이 없어요 — .+ → .+/);
    expect(tip.what).toBe('천둥의돌로 특정 포켓몬을 진화시킬 수 있어요');
    expect(tip.how).toContain('[B] 가방');
    // 잡은 적 있는 피카츄가 맨 앞 (도감 순으로는 뒤인 종이 먼저)
    const caught = withStone('none', { dex: { seen: [1, 10, 25], caught: [1, 10, 25] } });
    expect(evoItemExamples(caught, 'thunder-stone')[0]).toEqual({ name: '피카츄', toName: '라이츄' });
    expect(evoItemExamples(sampleSave(), 'linking-cord').map((e) => e.name)).toContain('근육몬');
    // 쓸 포켓몬이 있으면 예 없이 그 포켓몬
    expect(evoTip(withStone('team'), 'thunder-stone')).toMatchObject({ examples: [], who: '피카츄 → 라이츄 진화 가능' });
  });

  it('두 번째부터 얻은 말 뒤 한 줄 — 안내를 본 아이템 · 늘어났을 때 · 쓸 포켓몬이 있을 때만', () => {
    const before = withStone('team', { bag: {}, tips: [evoTipId('thunder-stone')] });
    const after = { ...before, bag: { 'thunder-stone': 1 } };
    expect(evoGotNote(before, after)).toBe('피카츄 → 라이츄 진화 가능');
    expect(evoGotNote(before, { ...after, tips: [] })).toBeNull(); // 처음 = 안내가 대신
    expect(evoGotNote(after, after)).toBeNull(); // 안 늘어남
    const noUser = withStone('none', { bag: {}, tips: [evoTipId('thunder-stone')] });
    expect(evoGotNote(noUser, { ...noUser, bag: { 'thunder-stone': 1 } })).toBeNull();
  });

  it('라이벌 첫 승 진화의 돌 — 결과 상자 한 줄 (evoNote) · 웹뷰와 주고받아도 남음', () => {
    const vulpix = sampleMonster({ uid: 'm3', species: 37, form: 'vulpix', level: 12 });
    const s: Save = { ...sampleSave(), monsters: { ...sampleSave().monsters, m3: vulpix }, party: ['m1', 'm2', 'm3'], nextMonsterUid: 4, tips: [evoTipId('fire-stone')] };
    const summary: BattleSummary = { title: '라이벌', exp: [], money: 100, item: null, caught: null, learned: [], choices: 0, badge: null };
    const r = rivalWinRewards(s, summary, 'may', fixedRng(0));
    expect(r.save.bag['fire-stone']).toBe(1);
    expect(r.summary.evoNote).toBe('식스테일 → 나인테일 진화 가능');
    const rt = readRuntime(viaJson({ ...createGameState(r.save, 1).runtime, stage: { phase: 'result', ms: 0, summary: r.summary } }), 1);
    expect(rt.stage?.phase === 'result' && rt.stage.summary.evoNote).toBe('식스테일 → 나인테일 진화 가능');
    // 안내를 아직 못 봤으면 한 줄 없음 (걷는 중 안내가 대신)
    expect(rivalWinRewards({ ...s, tips: [] }, summary, 'may', fixedRng(0)).summary.evoNote).toBeUndefined();
  });

  it('언제 띄우나 — 걷기 · 대기실 · 보고 있고 알림이 없을 때 (줍기 알림 · 결과 · 전투 · 밖에선 기다림) · 본 뒤 (tip-seen) 안 뜨고 세이브에 남음', () => {
    const walk = game(withStone());
    expect(evoTipNow(walk)).toBe('thunder-stone');
    expect(evoTipNow({ ...walk, runtime: { ...walk.runtime, toast: { text: '천둥의돌을 주웠다!', ms: TIMING.toastMs } } })).toBeNull();
    expect(evoTipNow({ ...walk, runtime: { ...walk.runtime, away: true } })).toBeNull();
    expect(evoTipNow(game(withStone(), { phase: 'appear', ms: 0, isNew: false }))).toBeNull();
    expect(evoTipNow(game(withStone('none', { location: { screen: 'gym' }, tips: ['gym-team'] }), { phase: 'lobby' }))).toBe('thunder-stone');
    const seen = applyInput(walk, { kind: 'tip-seen', id: evoTipId('thunder-stone') });
    expect(evoTipNow(seen)).toBeNull();
    const back = readSave(viaJson(seen.save));
    expect(back.kind === 'ok' && back.save.tips).toContain('evo-thunder-stone');
  });

  it('코드 리뷰어 — 보관함에만 있으면 "팀에 넣으면" · 본 안내가 꽉 차면 안 띄움 · 안내 id 는 짧은 영문 (24자) · 대기실 고르기 판 · 첫 안내 먼저', () => {
    expect(evoUsersLine(withStone('box'), 'thunder-stone')).toBe('피카츄 → 라이츄 진화 가능 · 팀에 넣고');
    // 가장 긴 실제 조합도 짧게 (240 × 150 알림 줄 — 디자인 UX 리뷰어)
    expect((evoUsersLine(withStone('box'), 'thunder-stone') ?? '').length).toBeLessThanOrEqual(30);
    expect(evoTip(withStone('box'), 'thunder-stone').how).toBe('팀에 넣은 뒤 [B] 가방에서 골라 써요');
    expect(evoTipItem(withStone('none', { tips: Array.from({ length: TIPS_MAX }, (_, i) => `t${i}`) }))).toBeNull();
    for (const item of EVO_ITEMS) expect(isTipId(evoTipId(item)), item).toBe(true);
    const gym = withStone('none', { location: { screen: 'gym' }, tips: ['gym-team'] });
    expect(evoTipNow(game(gym, { phase: 'lobby', picking: true }))).toBeNull();
    expect(evoTipNow(game(gym, { phase: 'lobby' }))).toBe('thunder-stone');
  });

  it('본 안내가 많아도 적힘 (상한 40 — 진화 아이템 6종이 더해져 20 이 차면 안내가 매번 뜨던 것)', () => {
    expect(TIPS_MAX).toBeGreaterThanOrEqual(30);
    const full = withStone('none', { tips: Array.from({ length: 25 }, (_, i) => `t${i}`) });
    const seen = applyInput(game(full), { kind: 'tip-seen', id: evoTipId('thunder-stone') });
    expect(seen.save.tips).toContain('evo-thunder-stone');
  });
});
