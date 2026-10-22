import { describe, expect, it } from 'vitest';
import { bandLeft, faintHoldLeft, faintIsBig, faintShortLine, stackRows, TEAM_ROW_GAP, teamGeometry } from './model';

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

  it('240 × 150 = ×1 · 480 × 150 = ×2 한 줄 (#85 A) · 860 × 315 · 443 도 ×2 (#92) · 넓은 패널은 가운데 860 무대', () => {
    expect(teamGeometry(240, 150, 26).scale).toBe(1);
    const row = teamGeometry(480, 150, 26);
    expect(row.oneRow).toBe(true);
    expect(new Set([0, 1, 2].map((i) => row.pos('me', i).y)).size).toBe(1);
    expect(teamGeometry(860, 315, 26).scale).toBe(2);
    expect(teamGeometry(1860, 443, 26).scale).toBe(2);
    // 줄 사이 세로는 패널 높이와 상관없이 같음 · 앞줄은 바닥 − 23 (#93 각 줄이기)
    for (const h of [187, 300, 443]) {
      const t = teamGeometry(860, h, 26);
      expect([t.pos('me', 1).y - t.pos('me', 0).y, t.pos('me', 2).y - t.pos('me', 1).y]).toEqual([TEAM_ROW_GAP.x2, TEAM_ROW_GAP.x2]);
      expect(Math.abs(t.pos('me', 2).y - (h - 23))).toBeLessThanOrEqual(1);
    }
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
    const { BALANCE, TIMING } = await import('../../../core/balance');
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
    // 개발 3:3 을 끄면 — 본편 3:3 (BALANCE.team.on) 이 꺼져 있을 때만 고르기 칸이 없음 (켜면 늘 있음 — #55)
    const off = devApply(s, { kind: 'team', on: false }).state;
    expect(teamChoiceOn({ ...off, runtime: { ...off.runtime, stage: { phase: 'trainer', n: 0, ms: 1000 } } })).toBe(BALANCE.team.on);
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

describe('3:3 위 가운데 줄 — 띠 · 쓰러짐 줄 · 결과 줄 (픽셀 검사원 · UX 리뷰어 · 아트 디렉터 #95 4바퀴)', () => {
  it('보통 공격 쓰러짐 뒤에 상대 필살기가 시작돼도 큰 연출 쓰러짐이 아님 · 큰 연출 중 · 막 끝난 0.4초 안은 큰 것', () => {
    // 레디바 쓰러짐이 6000 에 생김 · 그 전 큰 연출은 2000 에 끝남 → 6350 에 상대 필살기가 시작돼도 생긴 때로 정함
    expect(faintIsBig(6000, null, 2000)).toBe(false);
    // 필살기 (5000 시작) 중에 생김 = 큰 것 · 필살기가 5800 에 끝나고 0.2초 뒤 = 큰 것 · 0.4초 넘어 = 아님
    expect(faintIsBig(6000, 5000, 6000)).toBe(true);
    expect(faintIsBig(6000, null, 5800)).toBe(true);
    expect(faintIsBig(6000, null, 5600)).toBe(false);
    // 같은 때 (0.2초 안) 시작한 상대 필살기 = 아님 (VS 띠로 옮겨 가던 것 — 6바퀴)
    expect(faintIsBig(6000, 5950, 6000)).toBe(false);
  });

  it('쓰러짐 말 넘겨받기는 가장 늦게 뜬 이름 + 1.2초 (판 끝 결과 줄이 마지막 이름을 0.98초에 덮던 것 — UX #95 15바퀴)', () => {
    // 레디바 0 · 통통코 800 에 뜸 → 1700 에는 통통코가 0.9초라 아직 300ms 남음 (첫 이름으로 세면 0 — 넘겨 버림)
    expect(faintHoldLeft([0, 800], 1700)).toBe(300);
    expect(faintHoldLeft([0, 800], 2000)).toBe(0);
    // 마지막 KO 와 판 끝 (결과 줄 1초) 이 같은 때 — 결과 줄은 이름이 1.2초 된 뒤
    expect(faintHoldLeft([5000], 6000)).toBe(200);
    expect(faintHoldLeft([], 6000)).toBe(0);
  });

  it('띠 끝 쓰러짐 말을 줄이면 "2마리 쓰러졌다!" · 하나면 줄이지 않음', () => {
    expect(faintShortLine(['통통코', '소미안'])).toBe('2마리 쓰러졌다!');
    expect(faintShortLine(['통통코', '통통코'])).toBeNull();
    expect(faintShortLine(['레디바'])).toBeNull();
  });

  it('위에서부터 앞 줄 아래 + 4 로 쌓음 · 띠 (24) 아래 쓰러짐 줄 (28) 아래 결과 줄', () => {
    expect(stackRows([{ base: 30, h: 24 }, { base: 30, h: 28 }, { base: 30, h: 28 }])).toEqual([30, 58, 90]);
  });

  it('떠 있는 줄은 위로 안 감 — 띠가 닫혀도 쓰러짐 줄은 58 그대로 · 처음 안내가 닫혀도 안내 아래 자리 그대로', () => {
    const [faint] = stackRows([{ base: 30, h: 28, min: 58 }]);
    expect(faint).toBe(58);
    // 처음 안내 (30 ~ 52) 와 겹치면 안내 아래 + 2 = 54 · 안내가 닫힌 뒤에도 54
    const [withTip] = stackRows([{ base: 30, h: 28, tip: { top: 30, bottom: 52 } }]);
    expect(withTip).toBe(54);
    expect(stackRows([{ base: 30, h: 28, min: withTip }])).toEqual([54]);
  });

  it('띠 왼쪽 끝 — 처음 가운데 (정수) · 글이 붙어 넓어져도 왼쪽 그대로 · 오른쪽 끝이 패널 8 안을 넘을 때만 왼쪽으로', () => {
    const first = bandLeft(860, 165, null);
    expect(first).toBe(348);
    // 쓰러짐 말이 붙어 165 → 265: 왼쪽은 그대로 (예전엔 양쪽으로 50 씩 벌어짐)
    expect(bandLeft(860, 265, first)).toBe(first);
    // 240 "이겼다!" 64 → 170: 오른쪽이 넘쳐 어차피 옮겨야 하니 가운데 (35 · 35) — 왼 36 · 오른 8 로 치우치던 것 (아트 디렉터 6바퀴 ④)
    expect(bandLeft(240, 170, bandLeft(240, 64, null))).toBe(35);
    expect(Number.isInteger(bandLeft(861, 164, null))).toBe(true);
  });
});
