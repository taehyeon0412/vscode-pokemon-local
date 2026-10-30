import { describe, expect, it } from 'vitest';
import { numShown, NUM_MIN_REAL_MS, NUM_SHOW_MS, bandDrawn, bandLeft, duelSpots, faintHoldLeft, foeUltSoon, JOINT_CHIP_MS, keepJointChips, faintIsBig, faintLine, faintShortLine, faintShow, overLineHold, plateBoxOf, stackRows, TEAM_ROW_GAP, teamGeometry, viewHitChip, viewPopsBack, warnPosOf, type WarnPos, viewCrossers, viewMonClass, teamDenyNote } from './model';
import { sampleMonster, sampleSave } from '../../../../test/fixtures/save';
import { startTeamBattle, type TeamBattle } from '../../../core/engine/team';

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
    // 장면 전환 중 쓰러짐 = 따로 줄 (안 보이는 띠에 붙어 사라지던 것 — #96 UX 큼 1)
    expect(faintIsBig(6000, 5000, 6000, true)).toBe(false);
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

  it('판 끝 쓰러짐 줄은 결과 줄이 뜰 때까지 붙잡음 — 이기는 판 · 지는 판 둘 다 (지는 판에서 마지막 이름 하나로 줄던 것 — UX #95 17바퀴)', () => {
    // 이기는 판: 이름 1.2초 안 = 붙잡음
    expect(overLineHold(true, 1500, true)).toBe(true);
    // 지는 판: 이름은 1.2초가 지났지만 결과 줄 (판 끝 1초) 이 아직 = 붙잡음
    expect(overLineHold(false, 700, true)).toBe(true);
    // 결과 줄이 뜰 때 = 놓음 (결과 줄로 한 번에)
    expect(overLineHold(false, 1000, true)).toBe(false);
    // 결과 줄이 없는 판 끝 = 이름 1.2초만
    expect(overLineHold(false, 300, false)).toBe(false);
  });

  it('버린 누름 글 — "지금!" 이었다가 같은 걸음에 그 칸이 쓰러지거나 판이 끝나면 글 없음 ("아직 안 찼어요" 로 되돌아가지 않음, 테스터 #98 · bugs 1824)', () => {
    const mons = [0, 1, 2].map((i) => sampleMonster({ uid: `m${i}`, species: [1, 4, 7][i]!, form: ['bulbasaur', 'charmander', 'squirtle'][i]!, level: 10 }));
    const foes = [0, 1, 2].map((i) => sampleMonster({ uid: `f${i}`, species: 10, form: 'caterpie', level: 10 }));
    const b0 = startTeamBattle(sampleSave({ monsters: Object.fromEntries(mons.map((m) => [m.uid, m])), party: mons.map((m) => m.uid) }), foes, 'trainer', '상대', mons.map((m) => m.uid));
    const full = (b: TeamBattle, i: number): TeamBattle => ({ ...b, me: b.me.map((f, j) => (j === i ? { ...f, ult: 1 } : f)), ultReadyAt: { ...b.ultReadyAt, me: b.ultReadyAt.me.map((t, j) => (j === i ? b.t : t)) } });
    // 칸 있는 누름 — 차면 "지금!" · 그 칸이 쓰러지면 (도장은 아직 go) 글 없음
    const go: TeamBattle = { ...full(b0, 1), deny: { slot: 1, ms: 300, why: 'charge', go: true } };
    expect(teamDenyNote(go)).toMatchObject({ key: 2, go: true, text: '지금!' });
    expect(teamDenyNote({ ...go, me: go.me.map((f, j) => (j === 1 ? { ...f, hp: 0 } : f)) })).toBeNull();
    expect(teamDenyNote({ ...go, phase: 'over', result: 'win' })).toBeNull();
    // 아직 go 가 아니면 그대로 "아직 안 찼어요"
    expect(teamDenyNote({ ...b0, deny: { slot: 1, ms: 300, why: 'charge' } })).toMatchObject({ go: false, text: '아직 안 찼어요' });
    // 칸 없는 Z — go 였다가 찬 칸이 쓰러지면 글 없음
    const zGo: TeamBattle = { ...full(b0, 0), deny: { slot: -1, ms: 300, why: 'charge', go: true } };
    expect(teamDenyNote(zGo)).toMatchObject({ key: 1, go: true });
    expect(teamDenyNote({ ...zGo, me: zGo.me.map((f, j) => (j === 0 ? { ...f, hp: 0 } : f)) })).toBeNull();
  });

  it('상대 필살기 곧 (foeUltSoon) — 다음에 나갈 칸의 남은 기다림이 진짜 1.1초 안이면 "필살기 다 참" 처음 안내를 기다림 (개발 #98 판 자동 검사 7판 — 0.64초 만에 가려짐)', () => {
    const mons = [0, 1, 2].map((i) => sampleMonster({ uid: `m${i}`, species: [1, 4, 7][i]!, form: ['bulbasaur', 'charmander', 'squirtle'][i]!, level: 10 }));
    const foes = [0, 1, 2].map((i) => sampleMonster({ uid: `f${i}`, species: 10, form: 'caterpie', level: 10 }));
    const b0 = startTeamBattle(sampleSave({ monsters: Object.fromEntries(mons.map((m) => [m.uid, m])), party: mons.map((m) => m.uid) }), foes, 'trainer', '상대', mons.map((m) => m.uid));
    const run: TeamBattle = { ...b0, phase: 'run' };
    // 찬 상대가 없으면 아님
    expect(foeUltSoon(run, 1)).toBe(false);
    const full: TeamBattle = { ...run, foe: run.foe.map((f, j) => (j === 1 ? { ...f, ult: 1 } : f)), ultReadyAt: { ...run.ultReadyAt, foe: run.ultReadyAt.foe.map((t, j) => (j === 1 ? run.t : t)) } };
    const wait = (ms: number | null): TeamBattle => ({ ...full, foeUltWait: full.foeUltWait.map((w, j) => (j === 1 ? ms : w)) });
    // 기다림을 아직 안 정함 = 가장 짧은 값 (1초) 으로 셈 → 곧
    expect(foeUltSoon(wait(null), 1)).toBe(true);
    expect(foeUltSoon(wait(800), 1)).toBe(true);
    expect(foeUltSoon(wait(2500), 1)).toBe(false);
    // ▶▶ (게임 배 2) 면 같은 2초 기다림도 진짜 1초 → 곧
    expect(foeUltSoon(wait(2000), 2)).toBe(true);
    // run 이 아니면 (다른 필살기 · 힘겨루기 중 — 기다림이 안 줆) 아님
    expect(foeUltSoon({ ...wait(500), phase: 'ult' }, 1)).toBe(false);
  });

  it('합동 칩 붙잡기 (keepJointChips) — 진짜 시계 1.2초 · 엔진이 먼저 지워도 남김 · 장면 전환 칩이 가져가면 지움 (개발 #98 판 자동 검사 — "합동!" 0.65 ~ 0.7초)', () => {
    const kept = new Map<number, { p: { id: number; joint?: boolean; text: string }; at: number }>();
    const chip = { id: 5, joint: true, text: '-12' };
    const num = { id: 6, text: '-3' };
    // 처음 본 때 = 0 · 보통 숫자는 붙잡지 않음
    expect(keepJointChips(kept, [chip, num], 0, new Set()).gone).toEqual([]);
    expect([...kept.keys()]).toEqual([5]);
    // 엔진이 0.8초에 지워도 (▶▶) 남김 · 다음 다시 그리기 = 1.2초
    expect(keepJointChips(kept, [], 800, new Set())).toEqual({ gone: [chip], end: JOINT_CHIP_MS, on: new Set([5]) });
    // 1.2초가 지나면 없음
    expect(keepJointChips(kept, [], JOINT_CHIP_MS, new Set()).gone).toEqual([]);
    expect(kept.size).toBe(0);
    // 장면 전환 칩이 가져간 숫자 (skip) 는 남기지 않음
    keepJointChips(kept, [chip], 0, new Set());
    expect(keepJointChips(kept, [], 300, new Set([5])).gone).toEqual([]);
  });

  it('합동 칩 1.2초가 지나도 엔진 팝업이 살아 있으면 다시 안 켬 (3:3 박자 0.8 — 엔진 팝업 약 1.5초 · 한 장면 꺼졌다 1.2초 다시 켜지던 것, bugs 1852)', () => {
    const kept = new Map<number, { p: { id: number; joint?: boolean; text: string }; at: number }>();
    const chip = { id: 7, joint: true, text: '-30' };
    expect(keepJointChips(kept, [chip], 0, new Set()).on.has(7)).toBe(true);
    // 1.2초 · 1.3초 — 엔진 팝업이 아직 있어도 꺼진 채 (다시 넣지 않음)
    expect(keepJointChips(kept, [chip], JOINT_CHIP_MS, new Set()).on.has(7)).toBe(false);
    expect(keepJointChips(kept, [chip], JOINT_CHIP_MS + 100, new Set()).on.has(7)).toBe(false);
    expect(kept.get(7)?.at).toBe(0);
    // 엔진 팝업이 끝나면 적어 둔 것도 지움
    keepJointChips(kept, [], JOINT_CHIP_MS + 300, new Set());
    expect(kept.size).toBe(0);
  });

  it('장면 전환 칸 클래스 (viewMonClass) — 앞뒤가 바뀌는 동료는 in 바둑판 사라짐 → 새 자리 나타남 → out 은 다른 키프레임 (코드 리뷰어 #98)', () => {
    const o = { inGroup: true, hideDown: false, popsBack: true, cross: true, shooter: true };
    expect(viewMonClass('in', o)).toBe(' pg-view-pop-hide');
    expect(viewMonClass('cut', o)).toBe(' pg-view-pop pg-view-partner');
    expect(viewMonClass('show', o)).toBe(' pg-view-pop pg-view-partner');
    // 돌아갈 때 = 클래스 이름이 바뀌어야 (pg-view-pop → pg-view-pop-back) 다시 돎 · 제자리에서 사라진 뒤 3:3 자리에서 나타남 (곧바로 3:3 자리에서 반쯤 보여 112px 튀던 것, bugs 1909)
    expect(viewMonClass('out', o)).toBe(' pg-view-pop-back pg-view-partner');
    expect(viewMonClass('out', { ...o, cross: false, shooter: false })).toBe(' pg-view-pop-back');
    // 걷는 무리 · 나머지 · 숨긴 쓰러진 칸 (예전과 같음)
    const walk = { ...o, cross: false };
    expect(viewMonClass('in', walk)).toBe(' pg-view-move pg-view-partner');
    expect(viewMonClass('out', { ...walk, popsBack: false })).toBe(' pg-view-move pg-view-partner');
    expect(viewMonClass('in', { ...walk, inGroup: false })).toBe(' pg-view-hide-in');
    expect(viewMonClass('show', { ...walk, inGroup: false })).toBe(' pg-view-hidden');
    expect(viewMonClass('out', { ...walk, inGroup: false })).toBe(' pg-view-hide-out');
    expect(viewMonClass('out', { ...walk, hideDown: true })).toBe(' pg-view-hide-out pg-view-down-back');
    // 무리 밖 (오래전에 쓰러져 사라진 칸 포함) 은 되살리는 클래스 없음 (코드 리뷰어 #98 높음)
    expect(viewMonClass('out', { ...walk, inGroup: false, hideDown: false })).not.toContain('pg-view-down-back');
  });

  it('장면 전환 들어갈 때 앞뒤가 바뀌는 동료만 바둑판 (viewCrossers — 소미안이 앞장 통통코를 지나치던 것, bugs 1794 ③)', () => {
    for (const [W, H] of [[860, 187], [480, 150], [240, 150]] as const) {
      const g = teamGeometry(W, H, 26);
      for (const side of ['me', 'foe'] as const) {
        // 가운데에서 가까운 순서 (3:3 자리)
        const near = [0, 1, 2].sort((a, c) => Math.abs(g.pos(side, a).x - g.cx) - Math.abs(g.pos(side, c).x - g.cx));
        if (g.pos(side, near[0]!).x === g.pos(side, near[1]!).x) continue;
        const two = (lead: number, partner: number) => {
          const groups = { me: side === 'me' ? [lead, partner] : [0], foe: side === 'foe' ? [lead, partner] : [0] };
          return viewCrossers(g, groups, duelSpots(g, groups.me.length, groups.foe.length));
        };
        // 앞장이 가운데 쪽 → 동료는 바깥으로 걸어감 (안 지나침)
        expect(two(near[0]!, near[1]!).size).toBe(0);
        // 동료가 가운데 쪽 → 앞장을 지나쳐야 함 → 동료만 바둑판 (앞장은 걸어감)
        expect([...two(near[1]!, near[0]!)]).toEqual([`${side}-${near[0]}`]);
      }
    }
  });

  it('힘겨루기 장면 자리 (#116 leadSolo) — 앞장은 동료 수와 상관없이 혼자일 때 자리 · 동료는 바깥으로 (도중 합류에 앞장이 안 옮겨 감)', () => {
    for (const [W, H] of [[860, 187], [480, 150], [240, 150], [1860, 443]] as const) {
      const g = teamGeometry(W, H, 26);
      const one = duelSpots(g, 1, 1, true);
      const three = duelSpots(g, 3, 2, true);
      expect(three.me[0]).toEqual(one.me[0]);
      expect(three.foe[0]).toEqual(one.foe[0]);
      expect(three.me[1]!.x).toBeLessThan(three.me[0]!.x);
      expect(three.foe[1]!.x).toBeGreaterThan(three.foe[0]!.x);
      for (const p of [...three.me, ...three.foe]) expect(p.x - g.sp / 2).toBeGreaterThanOrEqual(0);
      // 합류해도 이미 선 동료가 안 옮겨 감 (둘 → 셋) · 동료 간격은 그림 폭 0.7 넘게 (모자라면 뒷줄이 더 위)
      const two = duelSpots(g, 2, 2, true);
      expect(three.me[1]).toEqual(two.me[1]);
      expect(three.foe[1]).toEqual(two.foe[1]);
      const gap = Math.abs(three.me[1]!.x - three.me[0]!.x);
      if (gap < Math.round(g.sp * 0.7)) expect(three.me[1]!.y).toBeLessThan(three.me[0]!.y - 4);
    }
  });

  it('장면 전환 자리 (#99 · #101) — 내 편 왼쪽 · 상대 오른쪽 · 혼자는 가운데 맞춤 · 합동 동료는 바깥으로 넉넉히 · 패널 안 · 배율 칸', () => {
    for (const [W, H] of [[860, 187], [860, 443], [480, 150], [240, 150]] as const) {
      const g = teamGeometry(W, H, 26);
      const solo = duelSpots(g, 1, 1);
      expect(Math.abs(g.cx - solo.me[0]!.x - (solo.foe[0]!.x - g.cx))).toBeLessThanOrEqual(g.scale);
      const s = duelSpots(g, 3, 1);
      expect(s.me[0]!.x).toBeLessThan(g.cx);
      expect(s.foe[0]!.x).toBeGreaterThan(g.cx);
      // 합동은 앞장을 대상 쪽으로 당김
      expect(s.me[0]!.x).toBeGreaterThan(solo.me[0]!.x);
      if (W === 860) expect(s.me[0]!.x - s.me[1]!.x).toBeGreaterThanOrEqual(110);
      expect(s.me[1]!.x).toBeLessThan(s.me[0]!.x);
      expect(s.me[1]!.y).toBeLessThan(s.me[0]!.y);
      for (const p of [...s.me, ...s.foe]) {
        expect(p.x - g.sp / 2).toBeGreaterThanOrEqual(0);
        expect(p.x + g.sp / 2).toBeLessThanOrEqual(W);
        expect(p.x % g.scale).toBe(0);
      }
      // 앞줄 = 3:3 앞줄 발 높이
      expect(s.me[0]!.y).toBe(g.pos('me', 2).y);
    }
  });

  it('띠 끝 쓰러짐 말을 줄이면 "2마리 쓰러졌다!" · 하나면 줄이지 않음', () => {
    expect(faintShortLine(['통통코', '소미안'])).toBe('2마리 쓰러졌다!');
    expect(faintShortLine(['통통코', '통통코'])).toBeNull();
    expect(faintShortLine(['레디바'])).toBeNull();
  });

  it('ideas 743 — 쓰러짐 한 줄은 내 이름 먼저 · "상대 ○○" 는 뒤로 (거울 대결 "상대 리자몽 · 망나뇽" 의 "상대" 가 망나뇽에도 걸려 읽히던 것) · 같은 이름 하나', () => {
    expect(faintLine(['상대 리자몽', '망나뇽'])).toBe('망나뇽 · 상대 리자몽 쓰러졌다!');
    expect(faintLine(['통통코', '상대 리자몽', '소미안', '상대 피죤'])).toBe('통통코 · 소미안 · 상대 리자몽 · 상대 피죤 쓰러졌다!');
    expect(faintLine(['통통코', '통통코'])).toBe('통통코 쓰러졌다!');
    expect(faintLine([])).toBeNull();
    // 그릴 때만 "상대" 와 이름을 붙임 (240 꺾임 — UX 큼 1) · 이름 나누기 (' · ') 는 그대로
    const shown = faintShow('아리아도스 · 상대 헤라크로스 · 상대 장크로다일 쓰러졌다!');
    expect(shown).toBe('아리아도스\u00a0· 상대\u00a0헤라크로스\u00a0· 상대\u00a0장크로다일 쓰러졌다!');
    expect(shown.split(/\s·\s/)).toHaveLength(3);
    expect(faintShow('통통코 쓰러졌다!')).toBe('통통코 쓰러졌다!');
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

describe('장면 전환 — 띠 · 돌아오는 칸 (#96 UX 5바퀴)', () => {
  it('장면 전환을 켠 판의 필살기 · 합동 띠는 view 가 서기 전에도 안 그림 (큼 1 — 한 장면 번쩍)', () => {
    expect(bandDrawn({ kind: 'ult' }, false, true, 0)).toBeNull();
    expect(bandDrawn({ kind: 'joint' }, false, true, 16)).toBeNull();
    expect(bandDrawn({ kind: 'vs' }, false, true)).toEqual({ kind: 'vs' });
    // 힘겨루기 VS 띠도 장면이 서기를 기다림 (#116 — 한 틱 번쩍)
    expect(bandDrawn({ kind: 'vs' }, false, true, 0)).toBeNull();
    expect(bandDrawn({ kind: 'vs' }, false, false, 0)).toEqual({ kind: 'vs' });
    expect(bandDrawn({ kind: 'win' }, true, true)).toBeNull();
    expect(bandDrawn({ kind: 'ult' }, false, false)).toEqual({ kind: 'ult' });
  });
  it('돌아갈 때 맞은 칸 · 합동 쏜 무리는 바둑판으로 제자리에 (큼 2 — 민 자리가 풀려 순간 이동)', () => {
    const solo = { kind: 'solo' as const, side: 'me' as const, from: [1], to: { side: 'foe' as const, slot: 2 } };
    expect(viewPopsBack(solo, 'foe', 2)).toBe(true);
    expect(viewPopsBack(solo, 'me', 1)).toBe(false);
    const joint = { kind: 'joint' as const, side: 'me' as const, from: [0, 2], to: { side: 'foe' as const, slot: 1 } };
    expect(viewPopsBack(joint, 'me', 2)).toBe(true);
    expect(viewPopsBack(joint, 'foe', 1)).toBe(true);
    expect(viewPopsBack(joint, 'me', 1)).toBe(false);
  });
});

describe('장면 전환 피해 칩 (ideas 717)', () => {
  const pop = (id: number, side: 'me' | 'foe', slot: number, text: string, kind: 'damage' | 'super' | 'weak' | 'crit' | 'heal' | 'info', joint?: true) => ({ id, side, slot, text, ms: 0, kind, ...(joint ? { joint } : {}) });
  it('장면 뒤 맞는 쪽 피해만 합계 하나 · 센 모양 · 합동', () => {
    const ps = [pop(3, 'foe', 1, '-9', 'damage'), pop(5, 'foe', 1, '-20', 'super', true), pop(6, 'foe', 2, '-4', 'damage', true), pop(7, 'me', 0, '-3', 'damage'), pop(8, 'foe', 1, '+5', 'heal'), pop(9, 'foe', 1, '효과가 굉장했다!', 'info')];
    expect(viewHitChip(ps, 'foe', 4)).toEqual({ ids: [5, 6], text: '-24', kind: 'super', joint: true });
    expect(viewHitChip(ps, 'me', 4)).toEqual({ ids: [7], text: '-3', kind: 'damage', joint: false });
  });
  it('장면 앞 숫자 · 회복 · 말뿐이면 칩 없음', () => {
    expect(viewHitChip([pop(3, 'foe', 1, '-9', 'damage'), pop(8, 'foe', 1, '+5', 'heal')], 'foe', 4)).toBeNull();
    expect(viewHitChip([], 'foe', 0)).toBeNull();
  });
  it('반감 · 급소가 섞이면 급소 모양', () => {
    expect(viewHitChip([pop(1, 'me', 0, '-2', 'weak'), pop(2, 'me', 0, '-6', 'crit')], 'me', 0)?.kind).toBe('crit');
  });
});

describe('장면 전환 띠 기다림 (#96 코드 리뷰 중간 2)', () => {
  it('필살기 · 합동 띠는 150ms 기다렸다가 장면 전환이 안 서면 그림', () => {
    expect(bandDrawn({ kind: 'ult' }, false, true, 100)).toBeNull();
    expect(bandDrawn({ kind: 'ult' }, false, true, 200)).toEqual({ kind: 'ult' });
    expect(bandDrawn({ kind: 'joint' }, false, true, 0)).toBeNull();
    expect(bandDrawn({ kind: 'joint' }, true, true, 500)).toBeNull();
  });
});

describe('상대 예고 칩 자리 (#98 R4 8판 — 240 × 187 체육관 "곧" 둘이 66px² 겹치던 것)', () => {
  const chip = (g: ReturnType<typeof teamGeometry>, i: number, pos: WarnPos) => {
    const p = plateBoxOf(g, 'foe', i);
    if (pos === 'right') return { l: p.r + 2, t: p.t + 1, r: p.r + 24, b: p.t + 13 };
    if (pos === 'left') return { l: p.l - 24, t: p.t + 1, r: p.l - 2, b: p.t + 13 };
    if (pos === 'below') return { l: p.r - 22, t: p.b + 2, r: p.r, b: p.b + 14 };
    return { l: p.r - 22, t: p.t - 14, r: p.r, b: p.t - 2 };
  };
  const over = (a: { l: number; t: number; r: number; b: number }, c: { l: number; t: number; r: number; b: number }) => a.l < c.r && a.r > c.l && a.t < c.b && a.b > c.t;
  for (const [W, H] of [[240, 187], [240, 150], [300, 187], [480, 187], [480, 150], [860, 187]] as const) {
    it(`${W} × ${H} — 칩끼리 · 다른 상대 판과 안 겹치고 패널 안`, () => {
      const g = teamGeometry(W, H, 26);
      const b = { foe: [{}, {}, {}] } as unknown as TeamBattle;
      const pos = warnPosOf(b, g, [true, true, true]);
      const rs = pos.map((p, i) => chip(g, i, p));
      rs.forEach((r, i) => {
        expect(r.l).toBeGreaterThanOrEqual(2);
        expect(r.r).toBeLessThanOrEqual(W - 2);
        rs.forEach((q, j) => j !== i && expect(over(r, q)).toBe(false));
        [0, 1, 2].forEach((j) => j !== i && expect(over(r, plateBoxOf(g, 'foe', j))).toBe(false));
      });
    });
  }
});

describe('3:3 숫자 보이는 시간 (bugs 1899)', () => {
  it('게임 시계 0.7초 또는 처음 본 때부터 진짜 시계 0.4초 중 긴 쪽 — 빠르게 ×3 에서 0.23초만 보이던 것', () => {
    const seen = new Map<number, number>();
    expect(numShown(seen, { id: 1, ms: 0 }, 1000)).toBe(true);
    // 게임 시계는 지났어도 (×3 — 0.7초가 진짜 0.23초) 진짜 시계 0.4초 안이면 보임
    expect(numShown(seen, { id: 1, ms: NUM_SHOW_MS + 10 }, 1000 + 250)).toBe(true);
    expect(numShown(seen, { id: 1, ms: NUM_SHOW_MS + 300 }, 1000 + NUM_MIN_REAL_MS + 1)).toBe(false);
    // 보통 박자 (×1) 는 게임 시계 0.7초 그대로
    expect(numShown(seen, { id: 2, ms: 0 }, 5000)).toBe(true);
    expect(numShown(seen, { id: 2, ms: NUM_SHOW_MS - 10 }, 5000 + 690)).toBe(true);
    expect(numShown(seen, { id: 2, ms: NUM_SHOW_MS + 10 }, 5000 + 710)).toBe(false);
  });
});
