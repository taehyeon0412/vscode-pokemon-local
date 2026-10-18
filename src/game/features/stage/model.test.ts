import { describe, expect, it } from 'vitest';
import { sampleSave } from '../../../test/fixtures/save';
import { BALANCE } from '../../core/balance';
import { createGameState, type GameState } from '../../core/engine';
import { stageLayout } from '../../core/rules/stage';
import { STAGE_IDS } from '../../core/save';
import { CONTACT_PX, heroX, minimapOf, STAGES, stageLabel, stagePx, visibleObjects, WALK_PX_PER_SEC } from './model';

function at(progress: number, stage: GameState['runtime']['stage'] = { phase: 'walk' }): GameState {
  const s = createGameState(sampleSave({ stages: { 'forest-1': { seed: 42, progress, cleared: false, defeatedTrainers: [], facilities: [], run: { startMs: 0, caught: 0, trainers: 0, seen: [], reach: 0, retries: 0 } } } }), 1);
  return { ...s, runtime: { ...s.runtime, stage } };
}
const layout = stageLayout('forest-1', 42);

describe('스테이지 이름표', () => {
  it('세이브의 스테이지 id 마다 이름이 있음', () => {
    for (const id of STAGE_IDS) expect(STAGES[id].id).toBe(id);
  });

  it('미니맵 모양: "🌲 새싹 오솔길 (1-1)" (gdd S06 ②)', () => {
    expect(stageLabel('forest-1')).toBe('🌲 새싹 오솔길 (1-1)');
  });
});

describe('길 위의 것들을 화면에', () => {
  it('스테이지 길이 = 걷는 시간 (20분) × 걷는 빠르기 × 크기 배율', () => {
    expect(stagePx(1)).toBe((BALANCE.stageWalkMs / 1000) * WALK_PX_PER_SEC);
    expect(stagePx(2)).toBe(stagePx(1) * 2);
  });

  it('만날 자리가 주인공 앞 (만나는 거리) 에 왔을 때 = 진행 % 가 그 자리', () => {
    const spot = layout.spots[0]!;
    const objs = visibleObjects(at(spot.at - 0.0001), 720, 1);
    const o = objs.find((x) => x.key.endsWith(String(spot.index)) && x.kind !== 'scenery' && x.kind !== 'facility')!;
    expect(o.x).toBeCloseTo(heroX(720) + CONTACT_PX + 0.0001 * stagePx(1), 3);
  });

  it('화면 밖 (멀리 앞 · 한참 뒤) 은 안 그림 · 왼쪽부터 정렬', () => {
    const objs = visibleObjects(at(0.5), 720, 1);
    for (const o of objs) {
      expect(o.x).toBeGreaterThan(-80);
      expect(o.x).toBeLessThan(800);
    }
    expect(objs.map((o) => o.x)).toEqual([...objs.map((o) => o.x)].sort((a, b) => a - b));
  });

  it('지나간 아이템 · 야생은 사라짐 · 만난 야생은 튀어나온 동안만 보임', () => {
    const wild = layout.spots.find((s) => s.kind === 'wild')!;
    const before = visibleObjects(at(wild.at - 0.0001), 720, 1).find((o) => o.key === `w${wild.index}`);
    expect(before).toMatchObject({ kind: 'wild', met: false });
    const meeting = visibleObjects(at(wild.at, { phase: 'appear', ms: 0, space: false, ambush: false, isNew: true }), 720, 1).find((o) => o.key === `w${wild.index}`);
    expect(meeting).toMatchObject({ kind: 'wild', met: true });
    expect(visibleObjects(at(wild.at + 0.0001), 720, 1).find((o) => o.key === `w${wild.index}`)).toBeUndefined();
    const item = layout.spots.find((s) => s.kind === 'item')!;
    expect(visibleObjects(at(item.at + 0.0001), 720, 1).find((o) => o.key === `i${item.index}`)).toBeUndefined();
  });

  it('부탁하던 사람은 지나간 뒤에도 화면 밖으로 나갈 때까지 보임 · 지금 부탁 중이면 active', () => {
    const req = layout.spots.find((s) => s.kind === 'request')!;
    const active = visibleObjects(at(req.at - 1e-7, { phase: 'request', at: req.at, number: 0, result: null, ms: 0 }), 720, 1).find((o) => o.key === `r${req.index}`);
    expect(active).toMatchObject({ kind: 'request', active: true });
    expect(visibleObjects(at(req.at + 0.001), 720, 1).find((o) => o.key === `r${req.index}`)).toMatchObject({ active: false });
  });

  it('미니맵: 진행 % · 시설 자리 (체육관은 1-3 에만)', () => {
    expect(minimapOf(at(0.37))).toEqual({ progress: 0.37, facilities: layout.facilities, gym: false });
  });
});

describe('S08 · S09 상대 볼 개수 (단계 9 테스터)', () => {
  it('상대가 쓰러진 순간 (다음 포켓몬을 내보내는 중) 에도 전부 = 처음 마릿수, 남은 것만 줄어듦', async () => {
    const { startTrainerBattle } = await import('../../core/engine/battle');
    const { foeTrainerView } = await import('./model');
    const { sampleMonster, sampleSave } = await import('../../../test/fixtures/save');
    const { createGameState } = await import('../../core/engine');
    const save = sampleSave({ pendingEncounter: { kind: 'trainer', trainerId: 'forest-1:t0', stageId: 'forest-1' } });
    const foe = (uid: string) => sampleMonster({ uid, species: 10, form: 'caterpie', level: 3 });
    const b0 = startTrainerBattle(save, [foe('a'), foe('b')], 'trainer', 't');
    const view = (b: typeof b0) => {
      const s = createGameState(save, 1);
      return foeTrainerView({ ...s, runtime: { ...s.runtime, stage: { phase: 'battle', battle: b }, stageId: 'forest-1' } });
    };
    expect(view(b0)).toMatchObject({ balls: 2, left: 2 });
    const down = { ...b0, phase: 'send' as const, foe: { ...b0.foe, hp: 0 }, foeDown: [{ species: 10, level: 3 }] };
    expect(view(down)).toMatchObject({ balls: 2, left: 1 });
  });
});
