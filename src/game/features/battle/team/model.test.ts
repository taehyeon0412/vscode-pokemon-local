import { describe, expect, it } from 'vitest';
import { teamGeometry } from './model';

describe('3:3 자리 (디자인팀 4안 시안 geo 그대로)', () => {
  it('860 × 187 = ×2 비스듬히 세 줄 · 앞줄끼리 약 310px · 판 안 잘림', () => {
    const g = teamGeometry(860, 187, 26);
    expect(g.scale).toBe(2);
    expect(g.oneRow).toBe(false);
    const front = [g.pos('me', 2), g.pos('foe', 2)];
    expect(Math.abs(front[1]!.x - front[0]!.x - 310)).toBeLessThanOrEqual(4);
    // 칸 0 (키 1) = 위 · 바깥, 칸 2 (키 3) = 아래 · 가운데
    expect(g.pos('me', 0).y).toBeLessThan(g.pos('me', 2).y);
    expect(g.pos('me', 0).x).toBeLessThan(g.pos('me', 2).x);
    // 발밑 판 (발 + 4 · 높이 14) 이 패널 안
    expect(g.pos('me', 2).y + 4 + 14).toBeLessThanOrEqual(187);
  });

  it('240 × 150 = ×1 · 480 × 150 = ×2 한 줄 (#85 A) · 860 × 315 = ×3 · 넓은 패널은 가운데 860 무대', () => {
    expect(teamGeometry(240, 150, 26).scale).toBe(1);
    const row = teamGeometry(480, 150, 26);
    expect(row.oneRow).toBe(true);
    expect(new Set([0, 1, 2].map((i) => row.pos('me', i).y)).size).toBe(1);
    expect(teamGeometry(860, 315, 26).scale).toBe(3);
    const wide = teamGeometry(1860, 187, 26);
    expect(wide.pos('foe', 0).x - wide.pos('me', 0).x).toBe(teamGeometry(860, 187, 26).pos('foe', 0).x - teamGeometry(860, 187, 26).pos('me', 0).x);
  });

  it('자리는 배율의 배수 (흐림 없게)', () => {
    for (const [w, h] of [[240, 150], [480, 150], [860, 187], [860, 315], [1860, 187]] as const) {
      const g = teamGeometry(w, h, 26);
      for (const side of ['me', 'foe'] as const) for (let i = 0; i < 3; i++) expect(g.pos(side, i).x % g.scale).toBe(0);
    }
  });
});

describe('트레이너 만남 1:1 / 3:3 고르기 · 3마리 고르기 (개발 모드 3:3 미리 켜기)', () => {
  it('3 → 3마리 고르기 (상성 좋은 셋 미리 체크) → 넣고 빼기 → Enter 로 3:3 · 3:3 꺼져 있으면 고르기 칸 없음', async () => {
    const { createGameState, applyInput, advance } = await import('../../../core/engine');
    const { TIMING } = await import('../../../core/balance');
    const { createStartSave } = await import('../../starter/model');
    const { devState } = await import('../../../dev/demo');
    const { devApply } = await import('../../../dev/actions');
    const { teamChoiceOn } = await import('./TeamChoice');
    const { trainerId } = await import('../../../core/rules/stage');
    let s = devState(createGameState({ ...createStartSave(0, 5, 4), location: { screen: 'stage', stageId: 'forest-1' } }, 5));
    s = { ...s, runtime: { ...s.runtime, view: { w: 860, h: 187 } } };
    s = [{ dex: 7, level: 20 }, { dex: 1, level: 20 }].reduce((st, m, i) => devApply(st, { kind: 'mon', slot: i + 1, ...m }).state, s);
    s = devApply(s, { kind: 'scene', scene: 'stage-1' }).state;
    s = { ...s, save: { ...s.save, pendingEncounter: { kind: 'trainer', trainerId: trainerId('forest-1', 0), stageId: 'forest-1' } }, runtime: { ...s.runtime, stage: { phase: 'trainer', n: 0, ms: 1000 } } };
    expect(teamChoiceOn(s)).toBe(true);
    s = applyInput(s, { kind: 'team-mode', on: true });
    const st = s.runtime.stage;
    expect(st?.phase === 'trainer' && st.pick).toHaveLength(3);
    s = applyInput(s, { kind: 'team-pick', uid: s.save.party[0]! });
    const st2 = s.runtime.stage;
    expect(st2?.phase === 'trainer' && st2.pick).toHaveLength(2);
    // Enter = 그때 VS 2초 → 3:3
    s = applyInput(s, { kind: 'space' });
    s = advance(s, TIMING.vsMs + 100).state;
    expect(s.runtime.stage?.phase).toBe('team');
    const off = devApply(s, { kind: 'team', on: false }).state;
    expect(teamChoiceOn({ ...off, runtime: { ...off.runtime, stage: { phase: 'trainer', n: 0, ms: 1000 } } })).toBe(false);
  });
});

describe('체육관 대기실 3마리 고르기 (관장 3:3)', () => {
  it('대기실에서 넣고 빼기 → 도전 = 고른 셋 (모자라면 상성 좋은 순으로 채움)', async () => {
    const { createGameState, applyInput, advance, teamPickOf } = await import('../../../core/engine');
    const { createStartSave } = await import('../../starter/model');
    const { devState } = await import('../../../dev/demo');
    const { devApply } = await import('../../../dev/actions');
    const { teamChoiceOn } = await import('./TeamChoice');
    let s = devState(createGameState({ ...createStartSave(0, 5, 4), location: { screen: 'stage', stageId: 'forest-1' } }, 5));
    s = { ...s, runtime: { ...s.runtime, view: { w: 860, h: 187 } } };
    s = [{ dex: 7, level: 20 }, { dex: 1, level: 20 }, { dex: 25, level: 20 }].reduce((st, m, i) => devApply(st, { kind: 'mon', slot: i + 1, ...m }).state, s);
    s = devApply(s, { kind: 'scene', scene: 'lobby' }).state;
    s = advance(s, 50).state;
    // 도전 = 3마리 고르기 판 · 판에서 도전 = 시작 (디자인팀)
    s = applyInput(s, { kind: 'challenge' });
    expect(teamChoiceOn(s)).toBe(true);
    // 미리 체크되지 않은 포켓몬을 넣음
    const pika = s.save.party.find((u) => !teamPickOf(s)!.includes(u))!;
    s = applyInput(s, { kind: 'team-pick', uid: pika });
    s = applyInput(s, { kind: 'challenge' });
    s = advance(s, 50).state;
    const st = s.runtime.stage;
    expect(st?.phase).toBe('team');
    expect(st?.phase === 'team' && st.team.me.map((f) => f.uid)).toContain(pika);
  });
});

describe('다시 그리는 열쇠 — 3:3 고르기 막대 (코드 리뷰어)', () => {
  it('만남 4초 · 3마리 고르기 10초 막대가 0.25초마다 열쇠를 바꿈', async () => {
    const { createGameState } = await import('../../../core/engine');
    const { createStartSave } = await import('../../starter/model');
    const { devState } = await import('../../../dev/demo');
    const { stageViewKey } = await import('../../stage/model');
    const { trainerId } = await import('../../../core/rules/stage');
    const s0 = devState(createGameState({ ...createStartSave(0, 5, 4), location: { screen: 'stage', stageId: 'forest-1' }, pendingEncounter: { kind: 'trainer', trainerId: trainerId('forest-1', 0), stageId: 'forest-1' } }, 5));
    const at = (ms: number, pickMs?: number) => stageViewKey({ ...s0, runtime: { ...s0.runtime, stageId: 'forest-1', stage: { phase: 'trainer', n: 0, ms, ...(pickMs !== undefined ? { team: true, pick: [], pickMs } : {}) } } });
    expect(at(1200)).not.toBe(at(1260));
    expect(at(4000, 0)).not.toBe(at(4000, 260));
    expect(at(1200)).toBe(at(1240));
  });
});
