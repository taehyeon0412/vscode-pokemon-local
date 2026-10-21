/** 3:3 실시간 팀 배틀 (gdd 4.7 끝 · 2026-10-21 orders #17) */
import { describe, expect, it } from 'vitest';
import { fixedRng } from '../../../test/fixtures/rng';
import { sampleMonster, sampleSave, viaJson } from '../../../test/fixtures/save';
import { BALANCE, TIMING } from '../balance';
import type { Monster, Save } from '../save';
import { applyInput, step, teamLock, teamPickOf } from './play';
import { Rng } from './rng';
import { createGameState, readRuntime, type GameState } from './state';
import { shotTiming, applyTeamResult, isSpread, pickTeam, readTeam, startTeamBattle, TEAM_BASIC, teamClashSure, teamDone, teamInput, teamPick, teamPossible, teamScale, teamStep, teamUltLevel, teamUltOpen, type TeamBattle, teamGather } from './team';
import { moveFxOf, moveOf } from '../../data';
import { trainerTeam } from '../rules/trainer';

const STEP = TIMING.simStepMs;
const mon = (uid: string, o: Partial<Monster> = {}) => sampleMonster({ uid, level: 12, ...o });
/** 내 셋: 이상해씨 (몸통박치기 · 덩굴채찍) · 파이리 (불꽃세례) · 꼬부기 (물대포) */
function team3(): Save {
  const ms = [mon('m1'), mon('m2', { species: 4, form: 'charmander', moves: [{ moveId: 52, pp: 25 }] }), mon('m3', { species: 7, form: 'squirtle', moves: [{ moveId: 55, pp: 25 }] })];
  return sampleSave({ monsters: Object.fromEntries(ms.map((m) => [m.uid, { ...m, hp: 999 }])), party: ms.map((m) => m.uid) });
}
const foes = (): Monster[] => [10, 13, 16].map((dex, i) => sampleMonster({ uid: `f${i}`, species: dex, form: ['caterpie', 'weedle', 'pidgey'][i]!, level: 10, moves: [{ moveId: 33, pp: 35 }] }));
const run = (b: TeamBattle, ms: number, rng: Rng = new Rng(1), auto = false) => {
  let cur = b;
  for (let t = 0; t < ms; t += STEP) cur = teamStep(cur, STEP, rng, { auto, away: false });
  return cur;
};

describe('시작 · 고르기', () => {
  it('3마리 이상이면 3:3 · 상성 좋은 3마리 (벌레 · 비행 상대에게 불꽃이 먼저)', () => {
    expect(teamPossible(team3())).toBe(true);
    expect(teamPossible(sampleSave())).toBe(false);
    expect(pickTeam(team3(), foes())[0]).toBe('m2');
    const b = startTeamBattle(team3(), foes(), 'trainer', '반바지 꼬마 민수');
    expect([b.me.length, b.foe.length, b.phase]).toEqual([3, 3, 'run']);
    expect(b.fought).toEqual(pickTeam(team3(), foes()));
  });

  it('AI — 기술이 있으면 일반 공격 없음 · 범위 기술은 상대 모두 · 상성 좋은 상대 (같으면 HP 낮은 쪽)', () => {
    const b = startTeamBattle(team3(), foes(), 'trainer', '상대');
    const fire = b.me.find((f) => f.species === 4)!;
    const p = teamPick(fire, b.foe, new Rng(3))!;
    expect(p.moveId).toBe(52);
    expect(p.targets).toHaveLength(1);
    const hurt = b.foe.map((f, i) => (i === 1 ? { ...f, hp: 1 } : f));
    // 벌레 둘 (캐터피 · 뿔충이) 은 불꽃 상성이 같으니 HP 낮은 뿔충이
    expect(teamPick(fire, hurt, new Rng(3))!.targets).toEqual([1]);
    expect(isSpread(moveOf(89))).toBe(true); // 지진
    expect(isSpread(moveOf(52))).toBe(false);
  });
});

describe('실시간 — 게이지가 차면 바로 · 겹쳐도', () => {
  it('끝까지 가면 한쪽이 다 쓰러져 끝 · 이기면 쓰러뜨린 상대 기록', () => {
    const b = run(startTeamBattle(team3(), foes(), 'trainer', '상대'), 300_000, new Rng(5), true);
    expect(b.phase).toBe('over');
    expect(teamDone(b)).toBe(true);
    if (b.result === 'win') expect(b.foeDown).toHaveLength(3);
    expect([...b.me, ...b.foe].some((f) => f.hp > 0)).toBe(true);
  });

  it('여럿이 동시에 쏨 — 기술이 날아가는 중에도 다른 포켓몬이 행동', () => {
    let b = startTeamBattle(team3(), foes(), 'trainer', '상대');
    b = { ...b, me: b.me.map((f) => ({ ...f, gauge: 0.999 })), foe: b.foe.map((f) => ({ ...f, gauge: 0 })) };
    const after = run(b, STEP * 2);
    expect(after.shots.filter((s) => s.side === 'me').length).toBe(3);
  });

  it('3:3 은 PP 가 닳지 않음 · 세이브엔 HP · 상태만', () => {
    const save = team3();
    const b = run(startTeamBattle(save, foes(), 'trainer', '상대'), 20_000, new Rng(2), true);
    expect(b.me.every((f) => f.moves.every((s, i) => s.pp === save.monsters[f.uid]!.moves[i]!.pp))).toBe(true);
    const hurt = { ...b, me: b.me.map((f, i) => (i === 0 ? { ...f, hp: 3, status: { kind: 'poison' as const } } : f)) };
    const after = applyTeamResult(save, hurt);
    expect(after.monsters[hurt.me[0]!.uid]).toMatchObject({ hp: 3, status: { kind: 'poison' } });
    expect(after.pendingEncounter).toBeNull();
  });
});

describe('필살기 — 1 · 2 · 3 · Z · 나머지 멈춤 · 끼어들기 · 힘겨루기', () => {
  const ready = (b: TeamBattle, side: 'me' | 'foe', i: number): TeamBattle => ({ ...b, [side]: b[side].map((f, j) => (j === i ? { ...f, ult: 1 } : f)), ultReadyAt: { ...b.ultReadyAt, [side]: b.ultReadyAt[side].map((t, j) => (j === i ? 0 : t)) } });

  it('찬 포켓몬만 · 쓰면 나머지 멈춤 (게이지 그대로) · 상대 모두에게 피해', () => {
    const b0 = startTeamBattle(team3(), foes(), 'trainer', '상대');
    expect(teamInput(b0, { kind: 'ult' }, new Rng(1))).toBe(b0);
    const b = ready(b0, 'me', 1);
    expect(teamUltOpen(b, 1)).toBe(true);
    const u = teamInput(b, { kind: 'ult' }, fixedRng(0.99)); // Z = 먼저 찬 포켓몬 · 상대 AI 는 안 끼어듦 (0.99)
    expect(u.phase).toBe('ult');
    expect(u.ult).toMatchObject({ side: 'me', from: 1 });
    const mid = run(u, 500, fixedRng(0.99));
    expect(mid.me.map((f) => f.gauge)).toEqual(u.me.map((f) => f.gauge));
    const done = run(u, TIMING.ultAnimMs + STEP, fixedRng(0.99));
    expect(done.phase).toBe('run');
    expect(done.foe.every((f, i) => f.hp < u.foe[i]!.hp)).toBe(true);
  });

  it('상대 필살기 — 끼어들기 창 (1.2초) 안에 내가 쓰면 힘겨루기 · 창이 지나면 못 끼어듦 · 다른 포켓몬 합류 (2:1) · 연타', () => {
    const base = ready(ready(ready(startTeamBattle(team3(), foes(), 'trainer', '상대'), 'foe', 0), 'me', 0), 'me', 2);
    let b = run({ ...base, foeUltWait: [1, null, null] }, STEP, new Rng(1));
    expect(b.ult).toMatchObject({ side: 'foe', from: 0 });
    expect(TIMING.team.interruptMs).toBeGreaterThanOrEqual(1000);
    expect(teamUltOpen(run(b, TIMING.team.interruptMs + STEP), 0)).toBe(false);
    b = teamInput(b, { kind: 'ult', slot: 0 }, new Rng(1));
    expect(b.phase).toBe('clash');
    expect(b.clash).toMatchObject({ kind: 'ult', me: [0], foe: [0] });
    b = teamInput(b, { kind: 'ult', slot: 2 }, new Rng(1));
    expect(b.clash!.me).toEqual([0, 2]);
    b = teamInput(b, { kind: 'space' }, new Rng(1));
    expect(b.clash!.taps).toBe(1);
    // 둘이 이김 → 합동 마무리 (합쳐 터지는 순간에 피해) 까지
    const end = run(b, TIMING.team.ultClashMs + TIMING.team.jointMs + STEP, fixedRng(0.01));
    expect(end.phase).toBe('run');
    // 진 쪽 참가자 (상대 0번) 가 피해
    expect(end.foe[0]!.hp).toBeLessThan(b.foe[0]!.hp);
  });

  it('상대 AI 도 내 필살기에 끼어듦 (관장이 트레이너보다 자주)', () => {
    expect(BALANCE.team.interruptChance.gym).toBeGreaterThan(BALANCE.team.interruptChance.trainer);
    const b = ready(ready(startTeamBattle(team3(), foes(), 'gym', '관장'), 'me', 0), 'foe', 1);
    const u = teamInput(b, { kind: 'ult', slot: 0 }, fixedRng(0)); // 0 = 늘 끼어듦
    expect(u.ult!.joiners).toEqual([1]);
    const c = run(u, TIMING.team.interruptMs, fixedRng(0));
    expect(c.phase).toBe('clash');
    expect(c.clash!.foe).toEqual([1]);
  });
});

describe('기술 힘겨루기 — 엇갈린 쏘는 기술 1:1 · 1.5초 자동 · 진 기술 쪽이 맞음', () => {
  it('둘 다 날아가는 중이면 힘겨루기 · 그 둘만 멈춤 · 끝나면 진 쪽 포켓몬 피해', () => {
    let b = startTeamBattle(team3(), foes(), 'trainer', '상대');
    const fireSlot = b.me.findIndex((f) => f.species === 4);
    b = {
      ...b,
      shots: [
        { id: 1, side: 'me', from: fireSlot, targets: [0], moveId: 52, ms: 300, dur: 900, hitMs: 630, hit: false, shooting: true, clash: false },
        { id: 2, side: 'foe', from: 2, targets: [0], moveId: 16, ms: 300, dur: 900, hitMs: 630, hit: false, shooting: true, clash: false },
      ],
      seq: 2,
    };
    const c = run(b, STEP);
    expect(c.moveClashes).toHaveLength(1);
    expect(c.moveClashes[0]!.shots).toEqual([1, 2]);
    const end = run(c, TIMING.team.moveClashMs + STEP);
    expect(end.moveClashes).toHaveLength(0);
    expect(end.shots.some((s) => s.id === 1 || s.id === 2)).toBe(false);
    const hurt = [...end.me.map((f, i) => f.hp < c.me[i]!.hp), ...end.foe.map((f, i) => f.hp < c.foe[i]!.hp)];
    expect(hurt.some(Boolean)).toBe(true);
  });
});

describe('다시 읽기', () => {
  it('웹뷰 ↔ 확장으로 넘겨도 그대로 · 모양이 이상하면 null', () => {
    const b = run(startTeamBattle(team3(), foes(), 'trainer', '상대'), 5000, new Rng(4), true);
    expect(readTeam(viaJson(b))).toEqual(viaJson(b));
    expect(readTeam({ ...viaJson(b), phase: 'dance' })).toBeNull();
    expect(readTeam({ ...viaJson(b), me: [] })).toBeNull();
  });
});

describe('연결 — 트레이너 만남 · 관장전 (BALANCE.team.on 이 켜질 때만, 화면이 생길 때까지 꺼 둠)', () => {
  const setOn = (on: boolean) => {
    (BALANCE.team as { on: boolean }).on = on;
  };
  const meet = (save: Save, team?: boolean): GameState => {
    const s = createGameState({ ...save, pendingEncounter: { kind: 'trainer', trainerId: 'forest-1:t0', stageId: 'forest-1' } }, 3);
    return { ...s, runtime: { ...s.runtime, stage: { phase: 'trainer', n: 0, ms: TIMING.trainerMeetMs - STEP, ...(team === undefined ? {} : { team }) }, stageId: 'forest-1' } };
  };
  const phaseAfter = (s: GameState) => step(s, STEP).state.runtime.stage?.phase;
  const auto = (save: Save): Save => ({ ...save, settings: { ...save.settings, autoBattle: true } });
  /** 지난번에 3:3 을 고름 */
  const remembered = (save: Save): Save => ({ ...save, settings: { ...save.settings, teamMode: true } });

  it('꺼져 있으면 늘 1:1 · 켜면 마지막으로 고른 방식 (처음엔 자동 전투도 1:1) · 고르면 기억 · 3마리 미만이면 1:1', () => {
    setOn(false);
    expect(phaseAfter(meet(remembered(auto(team3()))))).toBe('battle');
    setOn(true);
    try {
      expect(phaseAfter(meet(auto(team3())))).toBe('battle');
      expect(phaseAfter(meet(team3()))).toBe('battle');
      const chose = applyInput(meet(team3()), { kind: 'team-mode', on: true });
      expect(chose.save.settings.teamMode).toBe(true);
      // 손으로 3:3 을 고르면 3마리 고르기 → Enter (Space) 로 시작
      expect(phaseAfter(chose)).toBe('trainer');
      expect(phaseAfter(applyInput(chose, { kind: 'space' }))).toBe('team');
      expect(phaseAfter(meet(auto(remembered(team3()))))).toBe('team');
      expect(phaseAfter(meet(remembered(team3())))).toBe('team');
      expect(phaseAfter(meet(remembered(team3()), false))).toBe('battle');
      expect(applyInput(meet(sampleSave()), { kind: 'team-mode', on: true }).runtime.stage).toMatchObject({ phase: 'trainer' });
      expect(phaseAfter(meet(remembered(sampleSave())))).toBe('battle');
      // 껐다 켜도 (진행 중 상태 없음) 3:3 이었으면 3:3 (코드 리뷰어)
      const fresh = (save: Save): GameState => {
        const s = createGameState({ ...save, pendingEncounter: { kind: 'trainer', trainerId: 'forest-1:t0', stageId: 'forest-1' } }, 3);
        return { ...s, runtime: { ...s.runtime, stage: null, stageId: 'forest-1' } };
      };
      expect(phaseAfter(fresh(remembered(team3())))).toBe('team');
      expect(phaseAfter(fresh(team3()))).toBe('battle');
    } finally {
      setOn(false);
    }
  });

  it('3:3 이기면 결과 (돈 ×1.5) · 트레이너는 다시 안 나옴 · 지면 S17 · 다시 읽기 · 필살기 입력', () => {
    setOn(true);
    try {
      let s = step(meet(auto(remembered(team3()))), STEP).state;
      expect(s.runtime.stage?.phase).toBe('team');
      const st = s.runtime.stage?.phase === 'team' ? s.runtime.stage : null;
      expect(readRuntime(viaJson(s.runtime), 1).stage).toEqual(viaJson(st));
      for (let t = 0; t < 300_000 && s.runtime.stage?.phase === 'team'; t += STEP) s = step(s, STEP).state;
      expect(['result', 'defeat']).toContain(s.runtime.stage?.phase);
      if (s.runtime.stage?.phase === 'result') {
        expect(s.save.stages['forest-1']!.defeatedTrainers).toContain('forest-1:t0');
        expect(s.runtime.stage.summary.money % 1).toBe(0);
      }
      expect(s.save.pendingEncounter).toBeNull();
    } finally {
      setOn(false);
    }
  });

  it('3:3 에서 지면 그 트레이너에게만 — 남은 포켓몬이 있으면 돈 −10% · 쓰러진 셋 그대로 · 계속 걸음, 없으면 S17', () => {
    setOn(true);
    try {
      const lose = (save: Save) => {
        let s = step(meet(remembered(save)), STEP).state;
        const st = s.runtime.stage;
        if (st?.phase !== 'team') throw new Error('3:3 아님');
        s = { ...s, runtime: { ...s.runtime, stage: { phase: 'team', team: { ...st.team, me: st.team.me.map((f) => ({ ...f, hp: 0 })) } } } };
        s = step(s, STEP).state;
        const over = s.runtime.stage?.phase === 'team' ? s.runtime.stage.team : null;
        for (let t = 0; t < 5000 && s.runtime.stage?.phase === 'team'; t += STEP) s = step(s, STEP).state;
        return { s, over, fought: st.team.fought };
      };
      const four = team3();
      const extra = mon('m4', { hp: 999 });
      const save = { ...four, money: 1000, monsters: { ...four.monsters, m4: extra }, party: [...four.party, 'm4'] };
      const { s, over, fought } = lose(save);
      expect(over?.msg).toContain('남은 포켓몬으로 계속');
      expect(s.runtime.stage?.phase).toBe('walk');
      expect(s.save.money).toBe(900);
      expect(s.runtime.toast?.text).toContain('돈 −100원');
      expect(fought.every((uid) => s.save.monsters[uid]!.hp === 0)).toBe(true);
      expect(s.save.party.some((uid) => s.save.monsters[uid]!.hp > 0)).toBe(true);
      expect(s.save.pendingEncounter).toBeNull();
      expect(s.save.stages['forest-1']!.defeatedTrainers).not.toContain('forest-1:t0');
      // 셋뿐이면 전멸 → S17
      expect(lose(team3()).s.runtime.stage?.phase).toBe('defeat');
    } finally {
      setOn(false);
    }
  });

  it('관장전 = 3:3 (3마리 미만이면 1:1 토너먼트)', () => {
    setOn(true);
    try {
      const lobby = (save: Save): GameState => {
        const s = createGameState({ ...save, location: { screen: 'gym' } }, 3);
        return { ...s, runtime: { ...s.runtime, stage: { phase: 'lobby' }, stageId: null } };
      };
      expect(applyInput(lobby(team3()), { kind: 'challenge' }).runtime.stage?.phase).toBe('team');
      expect(applyInput(lobby(sampleSave()), { kind: 'challenge' }).runtime.stage?.phase).toBe('battle');
      const g = applyInput(lobby(team3()), { kind: 'challenge' });
      expect(step(g, STEP).state.runtime.stage?.phase).toBe('team');
      // 껐다 켜도 관장전은 3:3
      const back = createGameState({ ...g.save, pendingEncounter: { kind: 'gym-leader' } }, 3);
      expect(step({ ...back, runtime: { ...back.runtime, stage: null, stageId: null } }, STEP).state.runtime.stage?.phase).toBe('team');
    } finally {
      setOn(false);
    }
  });
});

describe('명세 검사관 · 코드 리뷰어 (2026-10-21)', () => {
  const fighters = (b: TeamBattle, side: 'me' | 'foe', f: (x: TeamBattle['me'][number], i: number) => Partial<TeamBattle['me'][number]>): TeamBattle => ({ ...b, [side]: b[side].map((x, i) => ({ ...x, ...f(x, i) })) });
  const shot = (o: Partial<TeamBattle['shots'][number]>): TeamBattle['shots'][number] => ({ id: 1, side: 'me', from: 0, targets: [0], moveId: 33, ms: 600, dur: 900, hitMs: 630, hit: false, shooting: false, clash: false, ...o });

  it('관장 에이스 필살기 반 · 트레이너 3:3 상대는 늘 3마리 · 진흙뿌리기는 한 마리', () => {
    expect(startTeamBattle(team3(), foes(), 'gym', '관장').foe.map((f) => f.ult)).toEqual([0, 0, BALANCE.gymAceUlt]);
    expect(startTeamBattle(team3(), foes(), 'trainer', '상대').foe.every((f) => f.ult === 0)).toBe(true);
    for (let seed = 1; seed < 30; seed++) expect(trainerTeam('forest-1', seed, 0, 1, BALANCE.team.size)).toHaveLength(3);
    expect(isSpread(moveOf(341))).toBe(false);
    // 범위 = 데이터 (원작 대상) — 불사르기 · 칼바람 · 거품 · 독가스도
    for (const id of [510, 13, 145, 139]) expect(isSpread(moveOf(id))).toBe(true);
  });

  it('흡수 · 반동 · 칼등치기 · 마비 · 연달아 세짐 (1:1 과 같음)', () => {
    const b0 = fighters(startTeamBattle(team3(), foes(), 'trainer', '상대'), 'me', (x) => ({ hp: Math.floor(x.maxHp / 2) }));
    // 공격을 세게 (3:3 피해 배율 0.2 라 약하면 흡수 · 반동이 0)
    const strong = fighters(b0, 'me', (x) => ({ stats: { ...x.stats, attack: 400 } }));
    const drain = run({ ...strong, shots: [shot({ moveId: 71 })] }, STEP * 2, fixedRng(0.5));
    expect(drain.me[0]!.hp).toBeGreaterThan(b0.me[0]!.hp);
    const recoil = run({ ...strong, shots: [shot({ moveId: 36 })] }, STEP * 2, fixedRng(0.5));
    expect(recoil.me[0]!.hp).toBeLessThan(b0.me[0]!.hp);
    const low = fighters(b0, 'foe', () => ({ hp: 1 }));
    expect(run({ ...low, shots: [shot({ moveId: 206 })] }, STEP * 2, fixedRng(0.5)).foe[0]!.hp).toBe(1);
    // 마비 — 0.25 확률로 못 움직임
    const para = fighters(b0, 'me', (_x, i) => (i === 0 ? { gauge: 0.999, status: { kind: 'paralysis' } } : { gauge: 0 }));
    const stuck = run({ ...para, foe: para.foe.map((f) => ({ ...f, gauge: 0 })) }, STEP, fixedRng(0));
    expect(stuck.shots).toHaveLength(0);
    expect(stuck.popups.some((p) => p.text.includes('몸이 저려'))).toBe(true);
    // 연달아 세지는 기술 (구르기) — 두 번째가 더 셈
    let r = fighters(b0, 'me', (_x, i) => (i === 0 ? { moves: [{ moveId: 205, pp: 20 }], gauge: 0.999 } : { gauge: 0 }));
    r = { ...r, foe: r.foe.map((f) => ({ ...f, gauge: 0 })) };
    const first = run(r, STEP, new Rng(1)).shots.find((s) => s.side === 'me' && s.from === 0)!;
    const again = run({ ...r, me: r.me.map((f, i) => (i === 0 ? { ...f, streakMove: 205, streakCount: 1 } : f)) }, STEP, new Rng(1)).shots.find((s) => s.side === 'me' && s.from === 0)!;
    expect(again.boost!).toBeGreaterThan(first.boost!);
  });

  it('3:1 필살기 힘겨루기 = 셋 쪽 100% (연타 · 스탯과 상관없이) · 2:1 · 3:2 는 합 + 연타', () => {
    expect(teamClashSure({ me: [0, 1, 2], foe: [0] })).toBe('me');
    expect(teamClashSure({ me: [0], foe: [0, 1, 2] })).toBe('foe');
    expect(teamClashSure({ me: [0, 1], foe: [0] })).toBeNull();
    expect(teamClashSure({ me: [0, 1, 2], foe: [0, 1] })).toBeNull();
    const base = startTeamBattle(team3(), foes(), 'trainer', '상대');
    const clash = (me: number[], foe: number[], taps: number): TeamBattle => ({ ...base, phase: 'clash', clash: { kind: 'ult', me, foe, shots: null, ms: 0, dur: TIMING.team.ultClashMs, taps, winner: null } });
    // 0.999 = 확률로는 거의 짐 · 0 = 거의 이김 — 3:1 이면 상관없이
    expect(run(clash([0, 1, 2], [0], 0), TIMING.team.ultClashMs + TIMING.team.jointMs + STEP, fixedRng(0.999)).foe[0]!.hp).toBeLessThan(base.foe[0]!.hp);
    const lost = run(clash([0], [0, 1, 2], 200), TIMING.team.ultClashMs + TIMING.team.jointMs + STEP, fixedRng(0));
    expect(lost.me[0]!.hp).toBeLessThan(base.me[0]!.hp);
    expect(lost.foe.every((f, i) => f.hp === base.foe[i]!.hp)).toBe(true);
  });

  it('합동 필살기 힘겨루기 이김 = 이긴 쪽 참가자마다 자기 필살기 (둘이면 혼자보다 셈) · 상대 합류는 시작할 때 한 번 정함', () => {
    const base = startTeamBattle(team3(), foes(), 'trainer', '상대');
    const clash = (me: number[]): TeamBattle => ({ ...base, phase: 'clash', clash: { kind: 'ult', me, foe: [0], shots: null, ms: 0, dur: TIMING.team.ultClashMs, taps: 0, winner: null } });
    const one = run(clash([0]), TIMING.team.ultClashMs + STEP, fixedRng(0.01));
    const two = run(clash([0, 2]), TIMING.team.ultClashMs + TIMING.team.jointMs + STEP, fixedRng(0.01));
    expect(base.foe[0]!.hp - two.foe[0]!.hp).toBeGreaterThan(base.foe[0]!.hp - one.foe[0]!.hp);
    // 상대 필살기에 내가 끼어듦 → 찬 상대 (2번) 의 합류를 그때 정함
    const ready = { ...base, foe: base.foe.map((f, i) => (i === 0 || i === 2 ? { ...f, ult: 1 } : f)), me: base.me.map((f, i) => (i === 0 ? { ...f, ult: 1 } : f)), foeUltWait: [1, 700, null] };
    const u = run(ready, STEP, fixedRng(0.99));
    expect(u.ult).toMatchObject({ side: 'foe', from: 0 });
    const join = teamInput(u, { kind: 'ult', slot: 0 }, fixedRng(0));
    expect(join.clash!.foeJoin).toHaveLength(1);
    expect(join.clash!.foeJoin![0]!.slot).toBe(2);
    expect(run(join, TIMING.team.ultClashMs - 200, fixedRng(0.99)).clash!.foe).toEqual([0, 2]);
    expect(teamInput(u, { kind: 'ult', slot: 0 }, fixedRng(0.99)).clash!.foeJoin).toEqual([]);
  });

  it('필살기 게이지 — 피해가 없으면 안 참 · 필살기에 맞아도 참 · 합류하면 상대 기다림도 지움', () => {
    const b = startTeamBattle(team3(), foes(), 'trainer', '상대');
    const u: TeamBattle = { ...b, phase: 'ult', ult: { side: 'me', from: 0, ms: 0, dur: TIMING.ultAnimMs, hitMs: 10, hit: false, window: 0, joinAt: null, joiners: [] } };
    const hit = run(u, STEP * 2, fixedRng(0.99));
    expect(hit.foe.every((f) => f.ult > 0)).toBe(true);
    expect(hit.me[0]!.ult).toBe(0);
    // 내 필살기에 상대 1번이 끼어듦 → 그 칸 기다림이 지워짐
    const ready = { ...b, me: b.me.map((f, i) => (i === 0 ? { ...f, ult: 1 } : f)), foe: b.foe.map((f, i) => (i === 1 ? { ...f, ult: 1 } : f)), foeUltWait: [null, 400, null] };
    const c = run(teamInput(ready, { kind: 'ult', slot: 0 }, fixedRng(0)), TIMING.team.interruptMs, fixedRng(0));
    expect(c.clash!.foe).toEqual([1]);
    expect(c.foeUltWait[1]).toBeNull();
  });

  it('쓸 기술이 없으면 1 공격 (단데기 · 딱충이끼리도 끝남) · 효과 없는 기술 · 걸 수 없는 상태 기술은 안 고름', () => {
    const shell = (uid: string, species: number) => mon(uid, { species, form: 'x', moves: [] });
    const ms = [shell('a', 11), shell('b', 11), shell('c', 11)];
    const save = sampleSave({ monsters: Object.fromEntries(ms.map((m) => [m.uid, { ...m, hp: 999 }])), party: ms.map((m) => m.uid) });
    const kakuna = [0, 1, 2].map((i) => sampleMonster({ uid: `k${i}`, species: 14, form: 'kakuna', level: 10, moves: [] }));
    const b = startTeamBattle(save, kakuna, 'trainer', '상대');
    expect(teamPick(b.me[0]!, b.foe, new Rng(1))).toEqual({ moveId: TEAM_BASIC, targets: [0] });
    const end = run(b, TIMING.team.maxMs + 10_000, new Rng(2));
    expect(end.phase).toBe('over');
    // 몸통박치기 (노말) vs 고오스 (고스트) → 1 공격 · 독가루 vs 독 타입 → 1 공격, 캐터피에게는 독가루
    const ghost = startTeamBattle(team3(), [sampleMonster({ uid: 'g', species: 92, form: 'gastly', level: 10, moves: [] })], 'trainer', '상대');
    const tackler = { ...ghost.me[0]!, moves: [{ moveId: 33, pp: 35 }] };
    expect(teamPick(tackler, ghost.foe, new Rng(1))!.moveId).toBe(TEAM_BASIC);
    const powder = { ...ghost.me[0]!, moves: [{ moveId: 77, pp: 35 }] };
    expect(teamPick(powder, startTeamBattle(team3(), kakuna, 'trainer', '상대').foe, new Rng(1))!.moveId).toBe(TEAM_BASIC);
    expect(teamPick(powder, startTeamBattle(team3(), foes(), 'trainer', '상대').foe, new Rng(1))!.moveId).toBe(77);
  });

  it('판 상한 — 넘으면 남은 HP 비율로 · 둘 다 쓰러지면 짐', () => {
    const b = startTeamBattle(team3(), foes(), 'trainer', '상대');
    const late = (meHp: number): TeamBattle => fighters(fighters({ ...b, t: TIMING.team.maxMs - STEP }, 'foe', (x) => ({ hp: Math.ceil(x.maxHp / 2) })), 'me', (x) => ({ hp: Math.ceil(x.maxHp * meHp) }));
    expect(run(late(0.9), STEP).result).toBe('win');
    expect(run(late(0.2), STEP).result).toBe('lose');
    const wiped = fighters(fighters(b, 'me', () => ({ hp: 0 })), 'foe', () => ({ hp: 0 }));
    expect(run(wiped, STEP).result).toBe('lose');
  });

  it('기술 힘겨루기 중인 둘은 게이지 멈춤 · 쓰러진 포켓몬 기술과는 안 겨룸 · 맞은 뒤엔 못 끼어듦 · 끼어들 상대가 비면 그냥 필살기', () => {
    let b = startTeamBattle(team3(), foes(), 'trainer', '상대');
    b = fighters({ ...b, shots: [shot({ id: 1, shooting: true, moveId: 52, ms: 300 }), shot({ id: 2, side: 'foe', from: 2, shooting: true, moveId: 16, ms: 300 })], seq: 2 }, 'me', () => ({ gauge: 0.9 }));
    const c = run(b, STEP);
    expect(c.moveClashes).toHaveLength(1);
    const later = run(c, 500);
    expect(later.me[0]!.gauge).toBe(c.me[0]!.gauge);
    expect(later.me[1]!.gauge).not.toBe(c.me[1]!.gauge);
    const dead = fighters(b, 'foe', (_x, i) => (i === 2 ? { hp: 0 } : {}));
    expect(run(dead, STEP).moveClashes).toHaveLength(0);
    const foeUlt: TeamBattle = { ...fighters(b, 'me', (_x, i) => (i === 0 ? { ult: 1 } : {})), shots: [], phase: 'ult', ult: { side: 'foe', from: 0, ms: 900, dur: TIMING.ultAnimMs, hitMs: 800, hit: true, window: 300, joinAt: null, joiners: [] } };
    expect(teamUltOpen(foeUlt, 0)).toBe(false);
    const mine: TeamBattle = { ...b, shots: [], phase: 'ult', ult: { side: 'me', from: 0, ms: 0, dur: TIMING.ultAnimMs, hitMs: 600, hit: false, window: 1200, joinAt: 100, joiners: [1] } };
    const after = run(mine, 200, fixedRng(0.99));
    expect(after.phase).toBe('ult');
    expect(after.ult!.joinAt).toBeNull();
  });

  it('다시 읽기 — 칸 번호는 그쪽 마릿수 안 · 쓰러뜨린 상대 레벨 · 칸 길이 · 힘겨루기 기술 id', () => {
    const b = viaJson(run(startTeamBattle(team3(), foes().slice(0, 2), 'trainer', '상대'), 3000, new Rng(4), true));
    expect(readTeam(b)).toEqual(b);
    expect(readTeam({ ...b, moveClashes: [], shots: [shot({ side: 'foe', from: 2 })] })).toBeNull();
    expect(readTeam({ ...b, moveClashes: [], shots: [shot({ targets: [2] })] })).toBeNull();
    expect(readTeam({ ...b, foeDown: [{ species: 10 }] })).toBeNull();
    expect(readTeam({ ...b, ultReadyAt: { me: [null], foe: [null, null] } })).toBeNull();
    expect(readTeam({ ...b, moveClashes: [{ kind: 'move', me: [0], foe: [0], shots: [98, 99], ms: 0, dur: 1500, taps: 0, winner: null }] })).toBeNull();
    expect(readTeam({ ...b, me: b.me.map((f) => ({ ...f, stats: { ...f.stats, speed: null } })) })).toBeNull();
  });
});

describe('#17 준비 — 배율 · 잠금 · 3마리 고르기 · 필살기 예약 · 상대 필살기 예고 (2026-10-21)', () => {
  const setOn = (on: boolean) => {
    (BALANCE.team as { on: boolean }).on = on;
  };
  const five = (): Save => {
    const base = team3();
    const more = [mon('m4', { species: 1, form: 'bulbasaur' }), mon('m5', { species: 25, form: 'pikachu', moves: [{ moveId: 84, pp: 30 }] })];
    return { ...base, monsters: { ...base.monsters, ...Object.fromEntries(more.map((m) => [m.uid, { ...m, hp: 999 }])) }, party: [...base.party, 'm4', 'm5'] };
  };
  const meet = (save: Save, view?: { w: number; h: number }): GameState => {
    const s = createGameState({ ...save, pendingEncounter: { kind: 'trainer', trainerId: 'forest-1:t0', stageId: 'forest-1' } }, 3);
    return { ...s, runtime: { ...s.runtime, stage: { phase: 'trainer', n: 0, ms: TIMING.trainerAlertMs }, stageId: 'forest-1', ...(view ? { view } : {}) } };
  };
  const steps = (s: GameState, ms: number) => {
    let cur = s;
    for (let t = 0; t < ms; t += STEP) cur = step(cur, STEP).state;
    return cur;
  };

  it('배율 — 240 폭 ×1 · 높이 300 아래 ×2 · 300 부터 ×3 · ×1 로도 안 들어가면 0 (잠금) · 모르면 들어감', () => {
    expect(teamScale(null)).toBe(2);
    expect(teamScale({ w: 239, h: 187 })).toBe(0);
    expect(teamScale({ w: 240, h: 187 })).toBe(1);
    expect(teamScale({ w: 479, h: 400 })).toBe(1);
    expect(teamScale({ w: 480, h: 187 })).toBe(2);
    expect(teamScale({ w: 1860, h: 299 })).toBe(2);
    expect(teamScale({ w: 720, h: 300 })).toBe(3);
  });

  it('잠금 — 좁으면 3:3 고르기 안 됨 · 기억한 3:3 도 1:1 · 관장도 1:1 토너먼트 · 까닭 (few · narrow) · 패널 크기는 넘겨도 남음', () => {
    setOn(true);
    try {
      const narrow = { w: 200, h: 187 };
      const s = meet(five(), narrow);
      expect(teamLock(s)).toBe('narrow');
      expect(teamLock(meet(sampleSave()))).toBe('few');
      expect(teamLock(meet(five(), { w: 860, h: 187 }))).toBeNull();
      expect(applyInput(s, { kind: 'team-mode', on: true })).toBe(s);
      const remembered = meet({ ...five(), settings: { ...five().settings, teamMode: true } }, narrow);
      expect(steps(remembered, TIMING.trainerMeetMs).runtime.stage?.phase).toBe('battle');
      const lobby = createGameState({ ...five(), location: { screen: 'gym' } }, 3);
      const l = { ...lobby, runtime: { ...lobby.runtime, stage: { phase: 'lobby' as const }, stageId: null, view: narrow } };
      expect(applyInput(l, { kind: 'challenge' }).runtime.stage?.phase).toBe('battle');
      // 패널 크기 알림 — 같으면 그대로 · 다시 읽어도 남음
      const v = applyInput(s, { kind: 'view', w: 860.4, h: 187 });
      expect(v.runtime.view).toEqual({ w: 860, h: 187 });
      expect(applyInput(v, { kind: 'view', w: 860, h: 187 })).toBe(v);
      expect(readRuntime(viaJson(v.runtime), 1).view).toEqual({ w: 860, h: 187 });
    } finally {
      setOn(false);
    }
  });

  it('3마리 고르기 — 3:3 을 고르면 상성 좋은 셋이 체크 · 넣고 빼기 · Enter 까지 기다림 (늦어도 10초) · 고른 셋으로 시작 · 자동 전투면 안 기다림', () => {
    setOn(true);
    try {
      const s = applyInput(meet(five()), { kind: 'team-mode', on: true });
      const first = teamPickOf(s)!;
      expect(first).toEqual(pickTeam(s.save, trainerTeam('forest-1', s.save.stages['forest-1']!.seed, 0, 5, 3)));
      // 하나 빼면 빈 채로 · 다른 걸 넣음 · 셋이 차 있으면 가장 먼저 고른 것이 빠짐
      const out = applyInput(s, { kind: 'team-pick', uid: first[0]! });
      expect(teamPickOf(out)).toEqual(first.slice(1));
      const other = ['m1', 'm2', 'm3', 'm4', 'm5'].find((u) => !first.includes(u))!;
      const swapped = applyInput(out, { kind: 'team-pick', uid: other });
      expect(teamPickOf(swapped)).toEqual([...first.slice(1), other]);
      expect(teamPickOf(applyInput(s, { kind: 'team-pick', uid: other }))).toEqual([...first.slice(1), other]);
      // 만남이 끝나도 기다림 → Enter (Space) = 바로 · 10초 = 저절로
      const held = steps(swapped, TIMING.trainerMeetMs + 1000);
      expect(held.runtime.stage?.phase).toBe('trainer');
      const go = step(applyInput(held, { kind: 'space' }), STEP).state;
      expect(go.runtime.stage?.phase).toBe('team');
      expect(go.runtime.stage?.phase === 'team' && [...go.runtime.stage.team.fought].sort()).toEqual([...first.slice(1), other].sort());
      expect(steps(swapped, TIMING.teamPickAutoMs + STEP * 2).runtime.stage?.phase).toBe('team');
      // 하나만 빼고 바로 시작 — 뺀 포켓몬 말고 다음 포켓몬으로 채움 (코드 리뷰어)
      const quick = step(applyInput(out, { kind: 'space' }), STEP).state;
      expect(quick.runtime.stage?.phase === 'team' && quick.runtime.stage.team.fought.includes(first[0]!)).toBe(false);
      // 고르는 중에 패널이 좁아지면 기다리지 않고 1:1
      const narrow = { ...swapped, runtime: { ...swapped.runtime, view: { w: 200, h: 187 } } };
      expect(steps(narrow, TIMING.trainerMeetMs).runtime.stage?.phase).toBe('battle');
      const auto = applyInput(meet({ ...five(), settings: { ...five().settings, autoBattle: true } }), { kind: 'team-mode', on: true });
      expect(steps(auto, TIMING.trainerMeetMs).runtime.stage?.phase).toBe('team');
      // 다시 읽어도 고르기가 남음 · 1:1 로 바꾸면 고르기를 닫음
      expect(readRuntime(viaJson(swapped.runtime), 1).stage).toEqual(viaJson(swapped.runtime.stage));
      expect(applyInput(swapped, { kind: 'team-mode', on: false }).runtime.stage).toEqual({ phase: 'trainer', n: 0, ms: TIMING.trainerAlertMs, team: false });
    } finally {
      setOn(false);
    }
  });

  it('대기실 고르기 — 처음엔 상성 좋은 셋 · 바꾼 셋으로 관장 3:3', () => {
    setOn(true);
    try {
      const base = createGameState({ ...five(), location: { screen: 'gym' } }, 3);
      const lobby = { ...base, runtime: { ...base.runtime, stage: { phase: 'lobby' as const }, stageId: null } };
      const first = teamPickOf(lobby)!;
      expect(first).toHaveLength(3);
      const other = ['m1', 'm2', 'm3', 'm4', 'm5'].find((u) => !first.includes(u))!;
      const changed = applyInput(lobby, { kind: 'team-pick', uid: other });
      const g = applyInput(changed, { kind: 'challenge' });
      expect(g.runtime.stage?.phase === 'team' && g.runtime.stage.team.fought).toEqual([...first.slice(1), other]);
    } finally {
      setOn(false);
    }
  });

  it('필살기 예약 — 차는 중에 그 칸을 누르면 예약 · 다시 누르면 취소 · 차는 순간 씀 · 끼어들기 창 · 힘겨루기에도 바로 · Z 는 예약 없음', () => {
    const b = startTeamBattle(team3(), foes(), 'trainer', '상대');
    const r = teamInput(b, { kind: 'ult', slot: 0 }, new Rng(1));
    expect(r.reserve).toEqual([0]);
    expect(teamInput(r, { kind: 'ult', slot: 0 }, new Rng(1)).reserve).toEqual([]);
    expect(teamInput(b, { kind: 'ult' }, new Rng(1))).toBe(b);
    const full = (x: TeamBattle, i: number): TeamBattle => ({ ...x, me: x.me.map((f, j) => (j === i ? { ...f, ult: 1 } : f)) });
    expect(run(full(r, 0), STEP, fixedRng(0.99)).ult).toMatchObject({ side: 'me', from: 0 });
    expect(run(full(b, 0), STEP, fixedRng(0.99)).phase).toBe('run');
    const used = run(full(r, 0), STEP, fixedRng(0.99));
    expect(used.reserve).toEqual([]);
    // 상대 필살기 창 — 예약한 포켓몬이 차 있으면 바로 끼어듦
    const foeUlt: TeamBattle = { ...full({ ...b, reserve: [1] }, 1), phase: 'ult', ult: { side: 'foe', from: 0, ms: 0, dur: TIMING.ultAnimMs, hitMs: 800, hit: false, window: 1200, joinAt: null, joiners: [] } };
    expect(run(foeUlt, STEP, fixedRng(0.99)).clash).toMatchObject({ kind: 'ult', me: [1] });
    // 힘겨루기 — 예약한 포켓몬이 차면 합류
    const clash: TeamBattle = { ...full({ ...b, reserve: [2] }, 2), phase: 'clash', clash: { kind: 'ult', me: [0], foe: [0], shots: null, ms: 0, dur: TIMING.team.ultClashMs, taps: 0, winner: null } };
    expect(run(clash, STEP, fixedRng(0.99)).clash!.me).toEqual([0, 2]);
    // 쓰러지면 예약이 빠짐 · 다시 읽기
    const dead = run({ ...r, me: r.me.map((f, i) => (i === 0 ? { ...f, hp: 0 } : f)) }, STEP, fixedRng(0.99));
    expect(dead.reserve).toEqual([]);
    expect(readTeam(viaJson(r))).toEqual(viaJson(r));
    expect(readTeam({ ...viaJson(r), reserve: [0, 0] })).toBeNull();
    expect(readTeam({ ...viaJson(r), reserve: [5] })).toBeNull();
  });

  it('상대 필살기 예고 — 80% 넘으면 near · 다 차면 full · 쓰러지면 none', () => {
    const f = startTeamBattle(team3(), foes(), 'trainer', '상대').foe[0]!;
    expect(teamUltLevel({ ...f, ult: 0.5 })).toBe('none');
    expect(teamUltLevel({ ...f, ult: BALANCE.team.ultWarnAt })).toBe('near');
    expect(teamUltLevel({ ...f, ult: 1 })).toBe('full');
    expect(teamUltLevel({ ...f, ult: 1, hp: 0 })).toBe('none');
  });
});

describe('3:3 연출 방향 (2026-10-21 태현 님 — 일반 모드 기술 그대로 · 달려가 박치기 · 합동 필살기 합쳐 터짐)', () => {
  it('기술 박자 = 일반 모드 연출 — 쏘는 기술은 연출 길이 · 틀마다 맞는 때, 닿는 기술 (1 공격 포함) 은 달려가기 + 박치기 + 제자리', () => {
    const ember = shotTiming(52);
    const fx = moveFxOf(52)!;
    const ms = Math.min(TIMING.team.shotMaxMs, Math.max(TIMING.team.shotMinMs, fx.ms));
    expect(ember).toEqual({ dur: ms + TIMING.team.shotTailMs, hitMs: Math.max(120, Math.round(ms * fx.hitAt)), contact: false });
    const tackle = shotTiming(33);
    expect(tackle).toMatchObject({ contact: true, hitMs: TIMING.team.dashMs + TIMING.team.strikeHitMs });
    expect(tackle.dur).toBeGreaterThan(TIMING.team.dashMs + TIMING.team.backMs);
    expect(shotTiming(TEAM_BASIC).contact).toBe(true);
    // 솔라빔은 연출 끝에 맞음 · 광선 (덩굴채찍) 은 곧
    expect(shotTiming(76).hitMs).toBeGreaterThan(shotTiming(22).hitMs);
    // 쏜 기술에 박자가 그대로
    let b = startTeamBattle(team3(), foes(), 'trainer', '상대');
    b = { ...b, me: b.me.map((f) => ({ ...f, gauge: 0.999 })), foe: b.foe.map((f) => ({ ...f, gauge: 0 })) };
    const fire = run(b, STEP).shots.find((s) => s.moveId === 52)!;
    expect([fire.dur, fire.hitMs, fire.contact ?? false]).toEqual([ember.dur, ember.hitMs, false]);
  });

  it('합동 마무리 — 여럿이 이기면 필살기 단계 (나머지 멈춤) · 합쳐 터지는 순간에 피해 (그 전엔 그대로) · 혼자 이기면 바로', () => {
    const base = startTeamBattle(team3(), foes(), 'trainer', '상대');
    const clash: TeamBattle = { ...base, phase: 'clash', clash: { kind: 'ult', me: [0, 2], foe: [0], shots: null, ms: 0, dur: TIMING.team.ultClashMs, taps: 0, winner: null } };
    const won = run(clash, TIMING.team.ultClashMs + STEP, fixedRng(0.01));
    expect(won.phase).toBe('ult');
    expect(won.ult).toMatchObject({ side: 'me', from: 0, window: 0, joint: { winners: [0, 2], losers: [0], sure: false } });
    expect(won.foe[0]!.hp).toBe(base.foe[0]!.hp);
    expect(won.log.some((e) => e.t === 'ult' && e.joint !== undefined)).toBe(true);
    const before = run(won, TIMING.team.jointHitMs - STEP * 3, fixedRng(0.01));
    expect(before.foe[0]!.hp).toBe(base.foe[0]!.hp);
    const after = run(won, TIMING.team.jointHitMs + STEP, fixedRng(0.01));
    expect(after.foe[0]!.hp).toBeLessThan(base.foe[0]!.hp);
    expect(readTeam(viaJson(won))).toEqual(viaJson(won));
    const solo = run({ ...clash, clash: { ...clash.clash!, me: [0] } }, TIMING.team.ultClashMs + STEP, fixedRng(0.01));
    expect(solo.phase).toBe('run');
    expect(solo.foe[0]!.hp).toBeLessThan(base.foe[0]!.hp);
  });
});

describe('같은 편 합동 필살기 — 합동 필살기 멘트 (2026-10-21 태현 님 "멘트가 있을때 다른 포켓몬 필살기를 누르면 합동")', () => {
  const full = (b: TeamBattle, side: 'me' | 'foe', slots: number[]): TeamBattle => ({ ...b, [side]: b[side].map((f, i) => (slots.includes(i) ? { ...f, ult: 1 } : f)) });
  const base = () => startTeamBattle(team3(), foes(), 'trainer', '상대');

  it('같은 편에 찬 포켓몬이 있으면 멘트 (멈춤 · 키 + 남은 시간) → 누르면 합동 (같은 때 합쳐 터지는 순간에 피해) · 안 누르면 따로', () => {
    const b = full(base(), 'me', [0, 1]);
    const g = teamInput(b, { kind: 'ult', slot: 0 }, fixedRng(0.99));
    expect(g.phase).toBe('ult');
    expect(teamGather(g)).toEqual({ side: 'me', from: 0, leftMs: TIMING.team.gatherMs, totalMs: TIMING.team.gatherMs, team: [], can: [1] });
    expect(g.log.at(-1)).toMatchObject({ t: 'gather', side: 'me', from: 0 });
    // 멘트 동안 필살기는 멈춤 · 끼어들기 창도 그만큼
    const mid = run(g, 500, fixedRng(0.99));
    expect(mid.ult).toMatchObject({ ms: 0, gather: TIMING.team.gatherMs - 500 });
    expect(teamUltOpen(mid, 1)).toBe(true);
    const joined = teamInput(mid, { kind: 'ult', slot: 1 }, fixedRng(0.99));
    expect(joined.ult!.team).toEqual([1]);
    expect(joined.me[1]!.ult).toBe(0);
    const joint = run(joined, TIMING.team.gatherMs, fixedRng(0.99));
    expect(joint.ult).toMatchObject({ joint: { winners: [0, 1], losers: [0, 1, 2], sure: false }, dur: TIMING.team.jointMs, window: 0 });
    expect(teamGather(joint)).toBeNull();
    const hp = joint.foe.map((f) => f.hp);
    const hit = run(joint, TIMING.team.jointHitMs + STEP, fixedRng(0.99));
    expect(hit.foe.every((f, i) => f.hp < hp[i]!)).toBe(true);
    // 안 누르면 따로 — 멘트가 끝난 뒤 혼자 (끼어들기 창은 멘트로 지났음)
    const solo = run(g, TIMING.team.gatherMs, fixedRng(0.99));
    expect(solo.ult).toMatchObject({ side: 'me', from: 0, window: 0 });
    expect(solo.ult!.joint).toBeUndefined();
    expect(solo.log.at(-1)).toMatchObject({ t: 'ult', side: 'me', from: 0 });
    expect(readTeam(viaJson(mid))).toEqual(viaJson(mid));
  });

  it('찬 동료가 없으면 멘트 없이 바로 · 예약한 동료 · 자동 전투는 저절로 합류 · 멘트 중에 받아치면 양쪽이 모인 채 힘겨루기', () => {
    const one = teamInput(full(base(), 'me', [0]), { kind: 'ult', slot: 0 }, fixedRng(0.99));
    expect(one.ult!.gather).toBeUndefined();
    expect(one.ult!.window).toBe(TIMING.team.interruptMs);
    const g = teamInput(full(base(), 'me', [0, 2]), { kind: 'ult', slot: 0 }, fixedRng(0.99));
    expect(run({ ...g, reserve: [2] }, STEP, fixedRng(0.99)).ult!.team).toEqual([2]);
    expect(teamStep(g, STEP, fixedRng(0.99), { auto: true, away: false }).ult!.team).toEqual([2]);
    // 상대 AI 가 멘트 중에 받아침 (0 = 늘) — 내 쪽은 모인 동료와 함께
    const both = full(full(base(), 'me', [0, 2]), 'foe', [1]);
    const g2 = teamInput(both, { kind: 'ult', slot: 0 }, fixedRng(0));
    const joined = teamInput(g2, { kind: 'ult', slot: 2 }, fixedRng(0));
    const c = run(joined, TIMING.team.gatherMs, fixedRng(0));
    expect(c.phase).toBe('clash');
    expect(c.clash).toMatchObject({ me: [0, 2], foe: [1] });
  });

  it('상대 편 합동 — 찬 동료가 정해 둔 때 모임 (트레이너 가끔 · 관장 자주) · 내가 멘트 중에 받아칠 수 있음', () => {
    const b = { ...full(base(), 'foe', [0, 2]), foeUltWait: [1, null, null] };
    const g = run(b, STEP, fixedRng(0));
    expect(teamGather(g)).toMatchObject({ side: 'foe', from: 0, can: [2] });
    const done = run(g, TIMING.team.gatherMs, fixedRng(0));
    expect(done.ult).toMatchObject({ joint: { winners: [0, 2] } });
    const mine = full(g, 'me', [1]);
    expect(teamUltOpen(mine, 1)).toBe(true);
    const clash = teamInput(mine, { kind: 'ult', slot: 1 }, fixedRng(0.99));
    expect(clash.phase).toBe('clash');
    expect(clash.clash!.me).toEqual([1]);
  });
});
