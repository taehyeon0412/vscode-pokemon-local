import { describe, expect, it } from 'vitest';
import { sampleSave } from '../../../test/fixtures/save';
import { BALANCE, TIMING } from '../../core/balance';
import { createGameState, type GameState } from '../../core/engine';
import { stageLayout } from '../../core/rules/stage';
import { STAGE_IDS } from '../../core/save';
import { summaryLines } from '../result/model';
import { BATTLE_STAGE_MAX_PX, battleStage, CONTACT_PX, contactX, foeTrainerView, heroX, minimapOf, rivalTag, STAGES, stageLabel, stagePx, visibleObjects, WALK_PX_PER_SEC } from './model';

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
    expect(stageLabel('forest-1')).toBe('새싹 오솔길 (1-1)');
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

describe('라이벌 (gdd 4.12) — 띠 · 결과 보이기', () => {
  it('띠의 전적 칩 — 처음이면 "첫 만남!", 그 뒤 "전적 W승 L패" · 이름 · 볼 수 · "!" 뒤 띠', () => {
    expect(rivalTag(sampleSave(), 'boy')).toBe('첫 만남!');
    expect(rivalTag(sampleSave({ rivals: { boy: { wins: 0, losses: 1 } } }), 'boy')).toBe('전적 0승 1패');
    const meet = (ms: number): GameState => {
      const s = at(0.4, { phase: 'rival', rival: 'may', ms });
      return { ...s, save: { ...s.save, rivals: { may: { wins: 2, losses: 1 } }, pendingEncounter: { kind: 'rival', rival: 'may', stageId: 'forest-1' } } };
    };
    expect(foeTrainerView(meet(0))).toMatchObject({ name: '라이벌 지민', record: '전적 2승 1패', balls: 3, talking: false }); // 3마리 = min(3, 만난 수 + 1, 살아 있는 2 + 1)
    expect(foeTrainerView(meet(TIMING.trainerAlertMs))?.talking).toBe(true);
  });

  it('길 위에 미리 안 보임 (깜짝 등장)', () => {
    for (let seed = 1; seed < 200; seed++) {
      const rival = stageLayout('forest-1', seed).spots.find((x) => x.kind === 'rival');
      if (!rival) continue;
      const s = createGameState(sampleSave({ stages: { 'forest-1': { seed, progress: rival.at - 0.002, cleared: false, defeatedTrainers: [], facilities: [], run: { startMs: 0, caught: 0, trainers: 0, seen: [], reach: 0, retries: 0 } } } }), 1);
      expect(visibleObjects({ ...s, runtime: { ...s.runtime, stage: { phase: 'walk' } } }, 720, 1).some((o) => o.key.endsWith(String(rival.index)))).toBe(false);
      return;
    }
    throw new Error('라이벌 자리가 있는 시드가 없음');
  });

  it('이긴 결과 — 한마디는 둘째 줄 맨 끝 (좁은 패널에서 레벨업이 먼저)', () => {
    const lines = summaryLines({ title: '라이벌 레드와의 승부에서 이겼다!', exp: [{ uid: 'm1', name: '이상해씨', gain: 64, from: 5, to: 6 }], money: 180, item: '불꽃의돌', caught: null, learned: [], choices: 0, badge: null, quote: '레드: 다음엔 꼭 이길 거야! (전적 1승 0패)', rival: true });
    expect(lines.title).toBe('라이벌 레드와의 승부에서 이겼다!');
    expect(lines.head).toEqual([
      { kind: 'money', text: '+180원' },
      { kind: 'item', text: '불꽃의돌' },
    ]);
    expect(lines.body).toEqual([
      { kind: 'up', text: '이상해씨 Lv 5 → 6 (+64 EXP)' },
      { kind: 'quote', text: '레드: 다음엔 꼭 이길 거야! (전적 1승 0패)' },
    ]);
  });
});

describe('전투 무대 (battleStage, 2026-10-19)', () => {
  it('무대보다 좁거나 같은 패널은 패널 전체', () => {
    expect(battleStage(360)).toEqual({ left: 0, width: 360 });
    expect(battleStage(BATTLE_STAGE_MAX_PX)).toEqual({ left: 0, width: BATTLE_STAGE_MAX_PX });
  });

  it('넓은 패널은 720 무대 — 무대 안 주인공 자리가 걷던 자리와 같은 비율 (1858 → 512 ~ 1232)', () => {
    const s = battleStage(1858);
    expect(s).toEqual({ left: heroX(1858) - heroX(720), width: 720 });
    expect(s.left).toBe(512);
  });

  it('야생은 튀어나온 자리 그대로 싸움 (무대 안 만난 자리 + 무대 왼쪽 끝 = 패널의 만난 자리)', () => {
    for (const w of [800, 1200, 1858]) {
      for (const scale of [1, 2, 2.5]) {
        const s = battleStage(w);
        expect(s.left + contactX(s.width, scale)).toBe(contactX(w, scale));
      }
    }
  });
});
