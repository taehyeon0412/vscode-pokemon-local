/** 3:3 실시간 팀 배틀 (gdd 4.7 끝 · 2026-10-21 orders #17) */
import { describe, expect, it } from 'vitest';
import { fixedRng } from '../../../test/fixtures/rng';
import { sampleMonster, sampleSave, viaJson } from '../../../test/fixtures/save';
import { BALANCE, TIMING } from '../balance';
import type { Monster, Save } from '../save';
import { applyInput, step } from './play';
import { Rng } from './rng';
import { createGameState, readRuntime, type GameState } from './state';
import { applyTeamResult, isSpread, pickTeam, readTeam, startTeamBattle, TEAM_BASIC, teamClashSure, teamDone, teamInput, teamPick, teamPossible, teamStep, teamUltOpen, type TeamBattle } from './team';
import { moveOf } from '../../data';
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
    expect(teamInput(b0, { kind: 'ult', slot: 0 }, new Rng(1))).toBe(b0);
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
    const end = run(b, TIMING.team.ultClashMs + STEP, fixedRng(0.01));
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
      expect(phaseAfter(chose)).toBe('team');
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
    expect(run(clash([0, 1, 2], [0], 0), TIMING.team.ultClashMs + STEP, fixedRng(0.999)).foe[0]!.hp).toBeLessThan(base.foe[0]!.hp);
    const lost = run(clash([0], [0, 1, 2], 200), TIMING.team.ultClashMs + STEP, fixedRng(0));
    expect(lost.me[0]!.hp).toBeLessThan(base.me[0]!.hp);
    expect(lost.foe.every((f, i) => f.hp === base.foe[i]!.hp)).toBe(true);
  });

  it('합동 필살기 힘겨루기 이김 = 이긴 쪽 참가자마다 자기 필살기 (둘이면 혼자보다 셈) · 상대 합류는 시작할 때 한 번 정함', () => {
    const base = startTeamBattle(team3(), foes(), 'trainer', '상대');
    const clash = (me: number[]): TeamBattle => ({ ...base, phase: 'clash', clash: { kind: 'ult', me, foe: [0], shots: null, ms: 0, dur: TIMING.team.ultClashMs, taps: 0, winner: null } });
    const one = run(clash([0]), TIMING.team.ultClashMs + STEP, fixedRng(0.01));
    const two = run(clash([0, 2]), TIMING.team.ultClashMs + STEP, fixedRng(0.01));
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
