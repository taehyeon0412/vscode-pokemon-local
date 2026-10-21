/** 3:3 실시간 팀 배틀 (gdd 4.7 끝 · 2026-10-21 orders #17) */
import { describe, expect, it } from 'vitest';
import { fixedRng } from '../../../test/fixtures/rng';
import { sampleMonster, sampleSave, viaJson } from '../../../test/fixtures/save';
import { BALANCE, TIMING } from '../balance';
import type { Monster, Save } from '../save';
import { applyInput, step } from './play';
import { Rng } from './rng';
import { createGameState, readRuntime, type GameState } from './state';
import { applyTeamResult, isSpread, pickTeam, readTeam, startTeamBattle, teamDone, teamInput, teamPick, teamPossible, teamStep, teamUltOpen, type TeamBattle } from './team';
import { moveOf } from '../../data';

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

  it('AI — 일반 공격 없음 · 범위 기술은 상대 모두 · 상성 좋은 상대 (같으면 HP 낮은 쪽)', () => {
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

  it('꺼져 있으면 늘 1:1 · 켜면 자동 전투는 3:3 · 손으로는 고른 대로 (안 고르면 1:1) · 3마리 미만이면 1:1', () => {
    setOn(false);
    expect(phaseAfter(meet(auto(team3())))).toBe('battle');
    setOn(true);
    try {
      expect(phaseAfter(meet(auto(team3())))).toBe('team');
      expect(phaseAfter(meet(team3()))).toBe('battle');
      expect(phaseAfter(applyInput(meet(team3()), { kind: 'team-mode', on: true }))).toBe('team');
      expect(phaseAfter(meet(auto(team3()), false))).toBe('battle');
      expect(applyInput(meet(sampleSave()), { kind: 'team-mode', on: true }).runtime.stage).toMatchObject({ phase: 'trainer' });
      expect(phaseAfter(meet(auto(sampleSave())))).toBe('battle');
    } finally {
      setOn(false);
    }
  });

  it('3:3 이기면 결과 (돈 ×1.5) · 트레이너는 다시 안 나옴 · 지면 S17 · 다시 읽기 · 필살기 입력', () => {
    setOn(true);
    try {
      let s = step(meet(auto(team3())), STEP).state;
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
    } finally {
      setOn(false);
    }
  });
});
