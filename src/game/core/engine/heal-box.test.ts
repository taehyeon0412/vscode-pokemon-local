import { describe, expect, it } from 'vitest';
import { fixedRng } from '../../../test/fixtures/rng';
import { sampleMonster, sampleSave, viaJson } from '../../../test/fixtures/save';
import { healTeam, maxHpOf, swapWithBox, toBox } from '../rules/bag';
import { readSave, type Monster, type Save, type StageProgress } from '../save';
import { startBattle } from './battle';
import { applyInput } from './play';
import { battleRewards } from './rewards';
import { createGameState, type GameState, type StageRuntime } from './state';

/** 다친 포켓몬 — HP 1 · 독 · PP 0 */
const hurt = (o: Partial<Monster>): Monster => sampleMonster({ hp: 1, status: { kind: 'poison' }, moves: [{ moveId: 33, pp: 0 }], ...o });
const full = (m: Monster | undefined) => !!m && m.hp === maxHpOf(m) && m.status === null && m.moves.every((s) => s.pp === 35);
const run0 = { startMs: 0, caught: 0, trainers: 0, seen: [], reach: 0, retries: 0 };
const prog = (progress: number): StageProgress => ({ seed: 42, progress, cleared: progress >= 1, defeatedTrainers: [], facilities: [{ kind: 'hospital', at: 0.5 }], run: { ...run0 } });
/** 팀 m1 (다침) · m2 + 보관함 m3 (다침 — 쓰러짐) */
const hurtSave = (o: Partial<Save> = {}): Save => {
  const s = sampleSave();
  return { ...s, monsters: { ...s.monsters, m1: hurt({ uid: 'm1' }), m3: hurt({ uid: 'm3', species: 13, form: 'weedle', hp: 0 }) }, box: ['m3'], nextMonsterUid: 4, ...o };
};
function game(save: Save, stage: StageRuntime | null): GameState {
  const s = createGameState(save, 7);
  return { ...s, runtime: { ...s.runtime, stage, stageId: save.location.screen === 'stage' ? save.location.stageId : null } };
}

describe('보관함 회복 (#124 — 태현 님 "보관함에 있는 포켓몬은 병원에 가도 회복이 안되네" → 넣는 순간 회복은 병원 · 대기실에서만 (A))', () => {
  it('병원 회복 = 팀 + 보관함 전부 (HP · PP · 상태 이상 · 쓰러진 것도)', () => {
    const h = healTeam(hurtSave());
    expect(full(h.monsters.m1)).toBe(true);
    expect(full(h.monsters.m3)).toBe(true);
  });

  it('병원 · 대기실에서 보관함에 넣으면 넣는 순간 회복 · 꺼낸 쪽은 손대지 않음', () => {
    const inHospital = game(hurtSave({ box: [], stages: { 'forest-1': prog(0.5) } }), { phase: 'facility', kind: 'hospital', at: 0.5, ms: 0, inside: true });
    expect(full(applyInput(inHospital, { kind: 'team-to-box', uid: 'm1' }).save.monsters.m1)).toBe(true);
    const lobby = game(hurtSave({ box: [], location: { screen: 'gym' } }), { phase: 'lobby' });
    expect(full(applyInput(lobby, { kind: 'team-to-box', uid: 'm1' }).save.monsters.m1)).toBe(true);
    // 바꾸기 — 팀 → 보관함 쪽만 회복
    const healthyBox = hurtSave({ location: { screen: 'gym' }, monsters: { ...hurtSave().monsters, m3: sampleMonster({ uid: 'm3', species: 13, form: 'weedle' }) } });
    const swapped = applyInput(game(healthyBox, { phase: 'lobby' }), { kind: 'team-swap', boxUid: 'm3', partyUid: 'm1' }).save;
    expect(swapped.box).toEqual(['m1']);
    expect(full(swapped.monsters.m1)).toBe(true);
    expect(swapped.monsters.m3!.hp).toBe(20);
  });

  it('클리어 카드 (S24) · 지도에서 넣었다 빼도 HP 그대로 — 공짜 회복 없음 (다음 병원에서)', () => {
    const clear = game(hurtSave({ box: [], stages: { 'forest-1': prog(1) } }), { phase: 'clear' });
    const put = applyInput(clear, { kind: 'team-to-box', uid: 'm1' });
    expect(put.save.box).toEqual(['m1']);
    expect(put.save.monsters.m1!.hp).toBe(1);
    const back = applyInput(put, { kind: 'team-swap', boxUid: 'm1', partyUid: null });
    expect(back.save.party).toContain('m1');
    expect(back.save.monsters.m1!.hp).toBe(1);
    // 규칙 함수 자체는 옮기기만 (회복은 엔진이 장소를 보고)
    expect(toBox(hurtSave({ box: [] }), 'm1')!.monsters.m1!.hp).toBe(1);
    expect(swapWithBox(hurtSave(), 'm3', 'm1')!.monsters.m1!.hp).toBe(1);
  });

  it('잡았는데 팀이 다 차서 보관함으로 → 지금 HP 그대로 (다음 병원에서 회복)', () => {
    const wild = sampleMonster({ uid: 'wild', species: 16, form: 'pidgey', level: 4, moves: [{ moveId: 33, pp: 35 }], hp: 999, caughtAt: 'forest-1' });
    const save: Save = { ...sampleSave(), pendingEncounter: { kind: 'wild', monster: wild, start: 'normal' } };
    const b = { ...startBattle(save, wild, 'normal'), phase: 'over' as const, result: 'catch' as const };
    const hurtFoe = { ...b, foe: { ...b.foe, hp: 3 } };
    const fullTeam: Save = { ...save, party: ['m1', 'm2', 'm3', 'm4', 'm5'], monsters: { ...save.monsters, m3: sampleMonster({ uid: 'm3' }), m4: sampleMonster({ uid: 'm4' }), m5: sampleMonster({ uid: 'm5' }) }, nextMonsterUid: 6 };
    const boxed = battleRewards(fullTeam, hurtFoe, wild, 'forest-1', fixedRng(0.001));
    expect(boxed.save.box).toContain('m6');
    expect(boxed.save.monsters.m6!.hp).toBe(3);
    expect(full(healTeam(boxed.save).monsters.m6)).toBe(true);
  });

  it('다친 채 보관함에 적힌 세이브 — 불러와도 그대로 (다시 불러오기로 공짜 회복이 안 되게) · 다음 병원에서 회복', () => {
    const g = createGameState(hurtSave(), 1);
    expect(g.save.monsters.m3!.hp).toBe(0);
    const back = readSave(viaJson(g.save));
    expect(back.kind === 'ok' && back.save.monsters.m3!.hp).toBe(0);
    const inside = game(hurtSave({ stages: { 'forest-1': prog(0.5) } }), { phase: 'facility', kind: 'hospital', at: 0.5, ms: 0, inside: true });
    expect(full(applyInput(inside, { kind: 'heal' }).save.monsters.m3)).toBe(true);
  });

  it('엔진 — 병원 안 회복 · 병원 앞 [회복하고 가기] · 대기실 회복 모두 보관함까지', () => {
    const front = game(hurtSave({ stages: { 'forest-1': prog(0.49) } }), { phase: 'facility', kind: 'hospital', at: 0.5, ms: 0, inside: false });
    expect(full(applyInput(front, { kind: 'facility-heal' }).save.monsters.m3)).toBe(true);
    const lobby = game(hurtSave({ location: { screen: 'gym' } }), { phase: 'lobby' });
    expect(full(applyInput(lobby, { kind: 'heal' }).save.monsters.m3)).toBe(true);
  });
});
