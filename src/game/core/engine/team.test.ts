/** 3:3 실시간 팀 배틀 (gdd 4.7 끝 · 2026-10-21 orders #17) */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fixedRng } from '../../../test/fixtures/rng';
import { sampleMonster, sampleSave, viaJson } from '../../../test/fixtures/save';
import { BALANCE, TIMING } from '../balance';
import type { Monster, Save } from '../save';
import { applyInput, AUTO_TEAM_TIP, autoTeamTipDue, defeatWaits, step, TEAM_MEET_TIP, teamChoiceMeet, teamFoesOf, teamLock, teamMainOf, teamMeetTipDue, teamPickOf } from './play';
import { Rng } from './rng';
import { createGameState, readRuntime, type GameState } from './state';
import { shotTiming, applyTeamResult, isSpread, pickTeam, readTeam, startTeamBattle, TEAM_BASIC, teamClashSure, teamDone, teamInput, teamPick, teamPossible, teamScale, teamStep, teamAutoUltLeft, teamAutoUltNext, teamUltLevel, teamUltOpen, type TeamBattle, teamGather, teamLayout } from './team';
import { moveFxOf, moveOf, ultIsSpread, ultNamesOf } from '../../data';
import { teamHealthy } from '../rules/bag';
import { leaderTeam, trainerTeam } from '../rules/trainer';
import { REGIONS } from '../rules/region';

/** 게임 값 (모두에게 켬 — orders #59) — 켜고 끄는 테스트는 끝나면 이 값으로 되돌림 */
const TEAM_ON = BALANCE.team.on;

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

  it('찬 포켓몬만 · 쓰면 나머지 멈춤 (게이지 그대로) · 대상 = 원작 기술대로 (범위기만 상대 모두 · 그 밖 한 마리 — 기획 R7)', () => {
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
    const hurt = done.foe.filter((f, i) => f.hp < u.foe[i]!.hp).length;
    expect(hurt).toBe(u.ult!.spread ? 3 : 1);
    if (!u.ult!.spread) expect(done.foe[u.ult!.target!]!.hp).toBeLessThan(u.foe[u.ult!.target!]!.hp);
    expect(u.log.at(-1)).toMatchObject({ t: 'ult', side: 'me', from: 1, target: u.ult!.target });
  });

  it('필살기 고르기 — 그 모습의 필살기 중 (개발 모드 고른 것 먼저) · 원작 범위기면 상대 모두 · 옛 상태 (이름 없음) 는 상대 모두', () => {
    const b = ready(startTeamBattle(team3(), foes(), 'trainer', '상대'), 'me', 1);
    const form = b.me[1]!.form;
    const names = ultNamesOf(form);
    expect(names.length).toBeGreaterThan(0);
    const u = teamInput(b, { kind: 'ult' }, fixedRng(0.99));
    expect(names).toContain(u.ult!.name);
    expect(u.ult!.spread).toBe(ultIsSpread(u.ult!.name!));
    // 개발 모드에서 고른 이름 그대로
    const dev = teamInput(b, { kind: 'ult' }, fixedRng(0.99), { [b.me[1]!.uid]: names[names.length - 1]! });
    expect(dev.ult!.name).toBe(names[names.length - 1]);
    // 범위기 이름이면 상대 모두
    expect(ultIsSpread('지진')).toBe(true);
    expect(ultIsSpread('블래스트번')).toBe(false);
    const quake = { ...u, ult: { ...u.ult!, name: '지진', spread: true } };
    const allHit = run(quake, TIMING.ultAnimMs + STEP, fixedRng(0.99));
    expect(allHit.foe.every((f, i) => f.hp < quake.foe[i]!.hp)).toBe(true);
    // 옛 상태 (이름 · 대상 없음) = 상대 모두
    const { name: _n, spread: _s, target: _t, ...old } = u.ult!;
    const oldHit = run({ ...u, ult: old }, TIMING.ultAnimMs + STEP, fixedRng(0.99));
    expect(oldHit.foe.every((f, i) => f.hp < u.foe[i]!.hp)).toBe(true);
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
    // VS · 맞닿기 (ultClashLeadMs) 동안 누른 것은 안 셈 — 그 뒤부터 (UX 리뷰어 U2)
    expect(teamInput(b, { kind: 'space' }, new Rng(1)).clash!.taps).toBe(0);
    b = { ...b, clash: { ...b.clash!, ms: TIMING.team.ultClashLeadMs } };
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

describe('연결 — 트레이너 만남 · 관장전 (BALANCE.team.on 이 켜졌을 때 — 모두에게 켬 orders #59 · 꺼짐도 견줌)', () => {
  const setOn = (on: boolean) => {
    (BALANCE.team as { on: boolean }).on = on;
  };
  const meet = (save: Save, team?: boolean): GameState => {
    const s = createGameState({ ...save, pendingEncounter: { kind: 'trainer', trainerId: 'forest-1:t0', stageId: 'forest-1' } }, 3);
    // ask = 고르기를 연 만남 (자동 전투가 아니면 — ask 없이 ms 3950 이면 자동 전투 VS 가 나오던 중에 끈 것으로 봄)
    return { ...s, runtime: { ...s.runtime, stage: { phase: 'trainer', n: 0, ms: TIMING.trainerMeetMs - STEP, ...(save.settings.autoBattle ? {} : { ask: true as const }), ...(team === undefined ? {} : { team }) }, stageId: 'forest-1' } };
  };
  // 3:3 을 고를 수 있는 만남은 고른 때 (시간 끝 · Space) VS 2초 뒤 전투 — 그만큼 걸어 봄
  const phaseAfter = (s: GameState) => {
    let cur = s;
    for (let t = 0; t < TIMING.vsMs + STEP * 3; t += STEP) cur = step(cur, STEP).state;
    return cur.runtime.stage?.phase;
  };
  const auto = (save: Save): Save => ({ ...save, settings: { ...save.settings, autoBattle: true } });
  /** 지난번에 3:3 을 고름 */
  const remembered = (save: Save): Save => ({ ...save, settings: { ...save.settings, teamMode: true } });

  it('꺼져 있으면 늘 1:1 · 켜면 마지막으로 고른 방식 · 자동 전투면 3:3 이 기본 (orders #71) · 고르면 기억 · 3마리 미만이면 1:1', () => {
    try {
      setOn(false);
      expect(phaseAfter(meet(remembered(auto(team3()))))).toBe('battle');
      setOn(true);
      // 자동 전투면 3:3 이 기본 (할 수 있으면 — orders #71 · #108 A)
      expect(phaseAfter(meet(auto(team3())))).toBe('team');
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
      setOn(TEAM_ON);
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
      setOn(TEAM_ON);
    }
  });

  it('3:3 에서 지면 그 트레이너에게만 — 남은 포켓몬이 있으면 돈 −10% · 쓰러진 셋 그대로 · 계속 걸음, 없으면 S17', () => {
    setOn(true);
    try {
      const lose = (save: Save) => {
        let s = meet(remembered(save));
        for (let t = 0; t < TIMING.vsMs + STEP * 3 && s.runtime.stage?.phase === 'trainer'; t += STEP) s = step(s, STEP).state;
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
      // 안 보는 동안 (확장이 계산) 이렇게 지면 그동안 요약 "패배 1번" 에 셈 (상자 없이 바로 걷기 — 명세 검사관)
      let away = meet(remembered(save));
      for (let t = 0; t < TIMING.vsMs + STEP * 3 && away.runtime.stage?.phase === 'trainer'; t += STEP) away = step(away, STEP).state;
      const ast = away.runtime.stage;
      if (ast?.phase !== 'team') throw new Error('3:3 아님');
      away = { ...away, runtime: { ...away.runtime, headless: true, stage: { phase: 'team', team: { ...ast.team, me: ast.team.me.map((f) => ({ ...f, hp: 0 })) } } } };
      for (let t = 0; t < 5000 && away.runtime.stage?.phase === 'team'; t += STEP) away = step(away, STEP).state;
      expect(away.runtime.stage?.phase).not.toBe('defeat');
      expect(away.runtime.awayLog?.lost).toBe(1);
      expect(s.runtime.stage?.phase).toBe('walk');
      expect(s.save.money).toBe(900);
      expect(s.runtime.toast?.text).toContain('돈 −100원');
      expect(fought.every((uid) => s.save.monsters[uid]!.hp === 0)).toBe(true);
      expect(s.save.party.some((uid) => s.save.monsters[uid]!.hp > 0)).toBe(true);
      expect(s.save.pendingEncounter).toBeNull();
      expect(s.save.stages['forest-1']!.defeatedTrainers).not.toContain('forest-1:t0');
      // 이번 판에 3:3 으로 진 트레이너 — 다시 만나면 주 버튼 1:1 (자동 · 안 볼 때도) · 같은 판 패배로 셈 (R8 A)
      expect(s.save.stages['forest-1']!.run.teamLost).toEqual(['forest-1:t0']);
      const again = { ...s.save, settings: { ...s.save.settings, teamMode: true }, monsters: Object.fromEntries(Object.entries(s.save.monsters).map(([k, m]) => [k, { ...m, hp: 999 }])) };
      const met = meet(again);
      expect(teamMainOf(met)).toBe(false);
      expect(phaseAfter(meet(auto(again)))).toBe('battle');
      expect(teamMainOf(meet({ ...again, stages: { ...again.stages, 'forest-1': { ...again.stages['forest-1']!, run: { ...again.stages['forest-1']!.run, teamLost: [] } } } }))).toBe(true);
      expect(defeatWaits(again, { phase: 'defeat', gym: false, lost: 0 })).toBe(false);
      const twice = { ...again, stages: { ...again.stages, 'forest-1': { ...again.stages['forest-1']!, run: { ...again.stages['forest-1']!.run, retries: 1 } } } };
      expect(defeatWaits(twice, { phase: 'defeat', gym: false, lost: 0 })).toBe(true);
      // 3:3 패배가 같은 판 두 번째면 멈춤 상자 (다시 시작 없음) → 계속 = 걷기 (R8 A)
      const second = { ...save, stages: { ...save.stages, 'forest-1': { ...save.stages['forest-1']!, run: { ...save.stages['forest-1']!.run, retries: 1 } } } };
      const box = lose(second).s;
      expect(box.runtime.stage).toMatchObject({ phase: 'defeat', gym: false, keep: expect.any(String) });
      expect(box.save.money).toBe(900);
      expect(step(box, 60_000).state.runtime.stage?.phase).toBe('defeat');
      expect(applyInput(box, { kind: 'defeat-continue' }).runtime.stage?.phase).toBe('walk');
      expect(readRuntime(viaJson(box.runtime), 1).stage).toEqual(viaJson(box.runtime.stage));
      // 남은 N마리 · [병원 앞으로] = 팀 회복 · 마지막 병원 앞 (없으면 처음) · 돈 · 패배 수는 그대로 (#152)
      expect(box.runtime.stage).toMatchObject({ left: 1 });
      const retreat = applyInput({ ...box, save: { ...box.save, lastHospital: { stageId: 'forest-1', at: 0.3 } } }, { kind: 'defeat-retreat' });
      expect(retreat.runtime.stage?.phase).toBe('walk');
      expect(teamHealthy(retreat.save)).toBe(true);
      expect(retreat.save.stages['forest-1']!.progress).toBeCloseTo(0.3, 5);
      expect(retreat.save.stages['forest-1']!.progress).toBeLessThan(0.3);
      expect(retreat.save.money).toBe(900);
      // 다시 걷는 길의 야생은 다시 뽑음 (retries — S17 과 같이, 같은 이로치를 또 잡던 것 — 테스터)
      expect(retreat.save.stages['forest-1']!.run.retries).toBe(2);
      expect(applyInput(box, { kind: 'defeat-retreat' }).save.stages['forest-1']!.progress).toBe(0);
      expect(applyInput(s, { kind: 'defeat-retreat' })).toBe(s);
      // 셋뿐이면 전멸 → S17
      expect(lose(team3()).s.runtime.stage?.phase).toBe('defeat');
    } finally {
      setOn(TEAM_ON);
    }
  });

  it('관장전 = 3:3 (3마리 미만이면 1:1 토너먼트)', () => {
    setOn(true);
    try {
      const lobby = (save: Save): GameState => {
        const s = createGameState({ ...save, location: { screen: 'gym' } }, 3);
        return { ...s, runtime: { ...s.runtime, stage: { phase: 'lobby' }, stageId: null } };
      };
      // 도전 = 3마리 고르기 판 (picking) → 판에서 도전 = 시작 · Esc (lobby-back) = 대기실로 (디자인팀 — 판이 대기실 상자를 덮던 것)
      const open = applyInput(lobby(team3()), { kind: 'challenge' });
      expect(open.runtime.stage).toMatchObject({ phase: 'lobby', picking: true });
      expect(open.runtime.stage?.phase === 'lobby' && open.runtime.stage.pick).toHaveLength(3);
      expect(teamPickOf(lobby(team3()))).toBeNull();
      // 해변 대기실 = 해솔 팀 (판 그림 · 미리 체크가 숲 관장 팀 기준이던 것 — 코드 리뷰어 #59)
      const beach = lobby({ ...team3(), location: { screen: 'gym', region: 'beach' } });
      const beachLobby = { ...beach, save: { ...beach.save, location: { screen: 'gym' as const, region: 'beach' as const } } };
      expect(teamFoesOf(beachLobby)?.map((m) => m.species)).toEqual(leaderTeam(REGIONS.beach).map((m) => m.species));
      expect(teamFoesOf(lobby(team3()))?.map((m) => m.species)).toEqual(leaderTeam(REGIONS.forest).map((m) => m.species));
      const closed = applyInput(open, { kind: 'lobby-back' });
      expect(closed.runtime.stage).toEqual({ phase: 'lobby', pick: open.runtime.stage?.phase === 'lobby' ? open.runtime.stage.pick : [] });
      expect(applyInput(closed, { kind: 'team-pick', uid: 'm1' })).toBe(closed);
      expect(applyInput(open, { kind: 'challenge' }).runtime.stage?.phase).toBe('team');
      // 저절로 시작 없음
      expect(step(open, 60_000).state.runtime.stage).toMatchObject({ phase: 'lobby', picking: true });
      // 판이 열린 채 좁아져 잠기면 Enter 는 아무 일 없음 (1:1 관장전이 시작되던 것)
      const narrow = { ...open, runtime: { ...open.runtime, view: { w: 200, h: 187 } } };
      expect(applyInput(narrow, { kind: 'challenge' })).toBe(narrow);
      // 자동 전투 · 3마리 미만은 고르지 않고 바로
      expect(applyInput(lobby(auto(team3())), { kind: 'challenge' }).runtime.stage?.phase).toBe('team');
      expect(applyInput(lobby(sampleSave()), { kind: 'challenge' }).runtime.stage?.phase).toBe('battle');
      const g = applyInput(open, { kind: 'challenge' });
      expect(step(g, STEP).state.runtime.stage?.phase).toBe('team');
      // 껐다 켜도 관장전은 3:3
      const back = createGameState({ ...g.save, pendingEncounter: { kind: 'gym-leader' } }, 3);
      expect(step({ ...back, runtime: { ...back.runtime, stage: null, stageId: null } }, STEP).state.runtime.stage?.phase).toBe('team');
    } finally {
      setOn(TEAM_ON);
    }
  });
});

describe('명세 검사관 · 코드 리뷰어 (2026-10-21)', () => {
  const fighters = (b: TeamBattle, side: 'me' | 'foe', f: (x: TeamBattle['me'][number], i: number) => Partial<TeamBattle['me'][number]>): TeamBattle => ({ ...b, [side]: b[side].map((x, i) => ({ ...x, ...f(x, i) })) });
  const shot = (o: Partial<TeamBattle['shots'][number]>): TeamBattle['shots'][number] => ({ id: 1, side: 'me', from: 0, targets: [0], moveId: 33, ms: 600, dur: 900, hitMs: 630, hit: false, shooting: false, clash: false, ...o });

  it('관장 에이스 필살기 반 · 트레이너 3:3 상대는 늘 3마리 · 진흙뿌리기는 한 마리', () => {
    expect(startTeamBattle(team3(), foes(), 'gym', '관장').foe.map((f) => f.ult)).toEqual([BALANCE.ultStart, BALANCE.ultStart, BALANCE.gymAceUlt]);
    expect(startTeamBattle(team3(), foes(), 'trainer', '상대').foe.every((f) => f.ult === BALANCE.ultStart)).toBe(true);
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
    expect(hit.me[0]!.ult).toBe(BALANCE.ultStart);
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
  // 예전 규칙 (저절로 쓰기 — R2) 을 보는 묶음: 켜고 봄 · 게임 값 (꺼짐 — 사용자가 눌러야만, orders #82) 은 'ultAutoUse 꺼짐' 테스트가 봄
  const autoUse = BALANCE as { ultAutoUse: boolean };
  const wasAutoUse = autoUse.ultAutoUse;
  beforeEach(() => {
    autoUse.ultAutoUse = true;
  });
  afterEach(() => {
    autoUse.ultAutoUse = wasAutoUse;
  });

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
    // 폭 400 ~ 479 는 높이와 상관없이 ×2 한 줄 (기획 #24 — ×1 비스듬히는 #85 에서 버린 모양)
    expect([teamScale({ w: 479, h: 400 }), teamLayout({ w: 479, h: 400 })]).toEqual([2, 'row']);
    expect([teamScale({ w: 399, h: 400 }), teamLayout({ w: 399, h: 400 })]).toEqual([1, 'slant']);
    expect(teamScale({ w: 480, h: 187 })).toBe(2);
    expect(teamScale({ w: 1860, h: 299 })).toBe(2);
    expect(teamScale({ w: 720, h: 300 })).toBe(3);
    // 가장 낮은 패널 (높이 150 ~ 169 · 폭 400 부터) = ×2 한 줄 (#85 A) · 그 밖은 비스듬히
    expect([teamScale({ w: 400, h: 150 }), teamLayout({ w: 400, h: 150 })]).toEqual([2, 'row']);
    expect([teamScale({ w: 1860, h: 169 }), teamLayout({ w: 1860, h: 169 })]).toEqual([2, 'row']);
    expect([teamScale({ w: 399, h: 150 }), teamLayout({ w: 399, h: 150 })]).toEqual([1, 'slant']);
    expect(teamLayout({ w: 860, h: 187 })).toBe('slant');
  });

  it('자동 전투면 3:3 이 기본 (orders #71 · #108 A) — 싸울 수 있는 3마리 = 3:3 · 2마리 = 1:1 · 좁은 패널 = 1:1 · 처음 안내 (3:3 판에서 한 번)', () => {
    const autoOn = (save: Save): Save => ({ ...save, settings: { ...save.settings, autoBattle: true } });
    const wide = { w: 860, h: 187 };
    const go = (s: GameState) => steps(s, TIMING.trainerMeetMs + STEP * 2).runtime.stage?.phase;
    expect(go(meet(autoOn(five()), wide))).toBe('team');
    const two = { ...five(), party: ['m1', 'm2'] };
    expect(go(meet(autoOn(two), wide))).toBe('battle');
    expect(go(meet(autoOn(five()), { w: 200, h: 187 }))).toBe('battle');
    // 자동을 끄면 예전처럼 만남에서 고름 (기다림)
    expect(teamChoiceMeet(meet(five(), wide))).toBe(true);
    // 처음 안내 — 자동으로 3:3 이 된 판에서 · 보면 끝
    const fight = steps(meet(autoOn(five()), wide), TIMING.trainerMeetMs + STEP * 2);
    expect(autoTeamTipDue(fight)).toBe(true);
    expect(autoTeamTipDue(applyInput(fight, { kind: 'tip-seen', id: AUTO_TEAM_TIP }))).toBe(false);
    expect(autoTeamTipDue(steps(meet(autoOn(two), wide), TIMING.trainerMeetMs + STEP * 2))).toBe(false);
  });

  it('모두에게 켜짐 (orders #59) — 게임 값 그대로 · 개발 모드 아님: 트레이너 만남에서 1:1 / 3:3 고르기 · 3:3 처음 안내가 뜸', () => {
    expect(BALANCE.team.on).toBe(true);
    const open = meet({ ...five(), settings: { ...five().settings, autoBattle: false } }, { w: 860, h: 187 });
    expect(open.runtime.dev).toBeUndefined();
    expect(teamChoiceMeet(open)).toBe(true);
    expect(teamMeetTipDue(open)).toBe(true);
    // "!" 동안 (버튼 전 — 3 이 아직 안 먹음) 엔 처음 안내도 안 뜸 (UX 리뷰어 #59)
    expect(teamMeetTipDue({ ...open, runtime: { ...open.runtime, stage: { phase: 'trainer', n: 0, ms: TIMING.trainerAlertMs - STEP } } })).toBe(false);
    // 만남 4초가 지나도 고르기를 기다림 (자동 전투가 꺼져 있으면 — 고르면 이어 감)
    expect(teamChoiceMeet(steps(open, TIMING.trainerMeetMs + STEP))).toBe(true);
  });

  it('잠금 — 좁으면 3:3 고르기 안 됨 · 기억한 3:3 도 1:1 · 관장도 1:1 토너먼트 · 까닭 (few · narrow) · 패널 크기는 넘겨도 남음', () => {
    setOn(true);
    try {
      const narrow = { w: 200, h: 187 };
      const s = meet(five(), narrow);
      expect(teamLock(s)).toBe('narrow');
      expect(teamLock(meet(sampleSave()))).toBe('few');
      expect(teamLock(meet(five(), { w: 860, h: 187 }))).toBeNull();
      // 3:3 처음 안내 — 3:3 을 고를 수 있는 만남에서 아직 안 봤으면 · 보면 끝 · 잠기면 안 뜸 (2026-10-22 태현 님 "추천안")
      const open = meet(five(), { w: 860, h: 187 });
      expect(teamMeetTipDue(open)).toBe(true);
      expect(teamMeetTipDue(applyInput(open, { kind: 'tip-seen', id: TEAM_MEET_TIP }))).toBe(false);
      expect(teamMeetTipDue(s)).toBe(false);
      expect(applyInput(s, { kind: 'team-mode', on: true })).toBe(s);
      const remembered = meet({ ...five(), settings: { ...five().settings, teamMode: true } }, narrow);
      expect(steps(remembered, TIMING.teamChoiceMs + TIMING.vsMs + STEP * 2).runtime.stage?.phase).toBe('battle');
      const lobby = createGameState({ ...five(), location: { screen: 'gym' } }, 3);
      const l = { ...lobby, runtime: { ...lobby.runtime, stage: { phase: 'lobby' as const }, stageId: null, view: narrow } };
      expect(applyInput(l, { kind: 'challenge' }).runtime.stage?.phase).toBe('battle');
      // 패널 크기 알림 — 같으면 그대로 · 다시 읽어도 남음
      const v = applyInput(s, { kind: 'view', w: 860.4, h: 187 });
      expect(v.runtime.view).toEqual({ w: 860, h: 187 });
      expect(applyInput(v, { kind: 'view', w: 860, h: 187 })).toBe(v);
      expect(readRuntime(viaJson(v.runtime), 1).view).toEqual({ w: 860, h: 187 });
    } finally {
      setOn(TEAM_ON);
    }
  });

  it('3마리 고르기 — 3:3 을 고르면 상성 좋은 셋이 체크 · 넣고 빼기 · Enter 까지 기다림 (늦어도 10초) · 고른 셋으로 시작 · 자동 전투면 안 기다림', () => {
    setOn(true);
    try {
      const s = applyInput(meet(five()), { kind: 'team-mode', on: true });
      const first = teamPickOf(s)!;
      expect(first).toEqual(pickTeam(s.save, trainerTeam('forest-1', s.save.stages['forest-1']!.seed, 0, 5, 3)));
      // 하나 빼면 빈 채로 · 다른 걸 넣음 · 셋이 차 있으면 셋째 (마지막 자리) 와 바꿈 (디자인팀 UX 9차)
      const out = applyInput(s, { kind: 'team-pick', uid: first[0]! });
      expect(teamPickOf(out)).toEqual(first.slice(1));
      const other = ['m1', 'm2', 'm3', 'm4', 'm5'].find((u) => !first.includes(u))!;
      const swapped = applyInput(out, { kind: 'team-pick', uid: other });
      expect(teamPickOf(swapped)).toEqual([...first.slice(1), other]);
      expect(teamPickOf(applyInput(s, { kind: 'team-pick', uid: other }))).toEqual([first[0], first[1], other]);
      // 만남이 끝나도 기다림 → Enter (Space) = 바로 · 10초 = 저절로
      const held = steps(swapped, TIMING.trainerMeetMs + 1000);
      expect(held.runtime.stage?.phase).toBe('trainer');
      // Enter = 그때 VS (2초) → 3:3
      const go = steps(applyInput(held, { kind: 'space' }), TIMING.vsMs + STEP);
      expect(go.runtime.stage?.phase).toBe('team');
      expect(go.runtime.stage?.phase === 'team' && [...go.runtime.stage.team.fought].sort()).toEqual([...first.slice(1), other].sort());
      // 10초 = 저절로 시작 → VS 2초 → 3:3 (3마리 고르기는 VS 전 — 디자인팀 4안)
      expect(steps(swapped, TIMING.teamPickAutoMs + TIMING.vsMs + STEP * 2).runtime.stage?.phase).toBe('team');
      // 고르는 중에 넣고 빼면 10초 막대를 다시 채움 — 고르다가 저절로 시작되지 않게 (ideas #145)
      const late = steps(s, TIMING.teamPickAutoMs - 2000);
      expect(late.runtime.stage?.phase === 'trainer' && late.runtime.stage.vsAt).toBeUndefined();
      const repicked = applyInput(late, { kind: 'team-pick', uid: other });
      expect(repicked.runtime.stage?.phase === 'trainer' && repicked.runtime.stage.pickMs).toBe(0);
      const still = steps(repicked, 3000);
      expect(still.runtime.stage?.phase === 'trainer' && still.runtime.stage.vsAt).toBeUndefined();
      expect(steps(repicked, TIMING.teamPickAutoMs + TIMING.vsMs + STEP * 2).runtime.stage?.phase).toBe('team');
      // 하나만 빼고 바로 시작 — 뺀 포켓몬 말고 다음 포켓몬으로 채움 (코드 리뷰어)
      const quick = steps(applyInput(out, { kind: 'space' }), TIMING.vsMs + STEP);
      expect(quick.runtime.stage?.phase === 'team' && quick.runtime.stage.team.fought.includes(first[0]!)).toBe(false);
      // 고르는 중에 패널이 좁아지면 기다리지 않고 1:1
      const narrow = { ...swapped, runtime: { ...swapped.runtime, view: { w: 200, h: 187 } } };
      expect(steps(narrow, TIMING.teamChoiceMs + TIMING.vsMs + STEP * 2).runtime.stage?.phase).toBe('battle');
      const auto = applyInput(meet({ ...five(), settings: { ...five().settings, autoBattle: true } }), { kind: 'team-mode', on: true });
      expect(steps(auto, TIMING.trainerMeetMs).runtime.stage?.phase).toBe('team');
      // 다시 읽어도 고르기가 남음 · 1:1 로 바꾸면 고르기를 닫음
      expect(readRuntime(viaJson(swapped.runtime), 1).stage).toEqual(viaJson(swapped.runtime.stage));
      expect(applyInput(swapped, { kind: 'team-mode', on: false }).runtime.stage).toEqual({ phase: 'trainer', n: 0, ms: TIMING.trainerAlertMs, team: false });
    } finally {
      setOn(TEAM_ON);
    }
  });

  it('만남 중에 바뀌어도 VS 가 튀지 않음 · VS 뒤엔 셋을 못 바꿈 · VS 1초는 보임 · 1:1 은 한 입력 · 이상한 vsAt 무시 (코드 리뷰어 29b90b4)', () => {
    setOn(true);
    try {
      const vsAtOf = (s: GameState) => (s.runtime.stage?.phase === 'trainer' ? s.runtime.stage.vsAt : -1);
      const autoOn = (s: GameState, on: boolean) => applyInput(s, { kind: 'auto-battle', on });
      // 고르다가 (3초) 자동 전투를 켜면 그때 VS → 2초 뒤 전투 (예전 길로 가 VS 가 중간부터 나오던 것)
      const at3 = steps(meet(five()), 2200);
      expect(vsAtOf(at3)).toBeUndefined();
      const on = step(autoOn(at3, true), STEP).state;
      expect(vsAtOf(on)).toBe(at3.runtime.stage?.phase === 'trainer' ? at3.runtime.stage.ms : -1);
      expect(steps(on, TIMING.vsMs - STEP * 2).runtime.stage?.phase).toBe('trainer');
      // 자동 전투면 3:3 이 기본 (orders #71)
      expect(steps(on, TIMING.vsMs + STEP).runtime.stage?.phase).toBe('team');
      // 자동 전투 (예전 길) VS 가 나오던 중 (3초) 에 끄면 그 VS 그대로 (vsAt = 2초) — 사라졌다 다시 나오지 않음
      const autoMeet = steps(meet({ ...five(), settings: { ...five().settings, autoBattle: true } }), 2200);
      expect(vsAtOf(autoMeet)).toBeUndefined();
      const off = step(autoOn(autoMeet, false), STEP).state;
      expect(vsAtOf(off)).toBe(TIMING.trainerMeetMs - TIMING.vsMs);
      // VS 중에 자동을 끄면 손으로 고른 방식 (지난번 1:1) 으로 — 자동 3:3 기본은 자동이 켜져 있을 때만 (orders #71)
      expect(steps(off, 1000).runtime.stage?.phase).toBe('battle');
      // VS 뒤에는 1 ~ 5 로 셋을 못 바꿈
      const held = applyInput(meet(five()), { kind: 'team-mode', on: true });
      const vs = applyInput(held, { kind: 'space' });
      expect(vsAtOf(vs)).toBe(TIMING.trainerAlertMs);
      expect(applyInput(vs, { kind: 'team-pick', uid: 'm4' })).toBe(vs);
      // VS 1초 안의 넘기기는 무시 (더블클릭) · 1초 뒤엔 바로 전투
      expect(applyInput(vs, { kind: 'space' })).toBe(vs);
      const later = steps(vs, TIMING.vsSkipAfterMs);
      expect(steps(applyInput(later, { kind: 'space' }), STEP).runtime.stage?.phase).toBe('team');
      // 1:1 버튼 = 한 입력 (team-mode go) — 지난번 3:3 이었어도 1:1 로 VS
      const remembered = { ...five(), settings: { ...five().settings, teamMode: true } };
      const one = applyInput(meet(remembered), { kind: 'team-mode', on: false, go: true });
      expect(one.runtime.stage).toMatchObject({ phase: 'trainer', team: false, vsAt: TIMING.trainerAlertMs });
      expect(steps(one, TIMING.vsMs + STEP).runtime.stage?.phase).toBe('battle');
      const plain = applyInput(meet(five()), { kind: 'team-mode', on: false, go: true });
      expect(vsAtOf(plain)).toBe(TIMING.trainerAlertMs);
      // 다시 읽기 — vsAt 가 지금보다 뒤면 버림 (만남에서 멈추지 않게)
      expect(readRuntime({ stage: { phase: 'trainer', n: 0, ms: 3000, vsAt: 999_999_999 } }, 1).stage).toEqual({ phase: 'trainer', n: 0, ms: 3000 });
      expect(readRuntime({ stage: { phase: 'trainer', n: 0, ms: 3000, vsAt: 2000, ask: true } }, 1).stage).toEqual({ phase: 'trainer', n: 0, ms: 3000, vsAt: 2000, ask: true });
    } finally {
      setOn(TEAM_ON);
    }
  });

  it('지난번 3:3 이면 Enter 도 3마리 고르기 판 · 넷째는 셋째와 바꿈 · 3:3 이 잠기면 예전 4초 (디자인팀 UX 9차)', () => {
    setOn(true);
    try {
      const remembered = { ...five(), settings: { ...five().settings, teamMode: true } };
      const opened = applyInput(meet(remembered), { kind: 'space' });
      expect(opened.runtime.stage).toMatchObject({ phase: 'trainer', team: true });
      expect(opened.runtime.stage?.phase === 'trainer' && opened.runtime.stage.vsAt).toBeUndefined();
      const first = teamPickOf(opened)!;
      expect(first).toHaveLength(3);
      // 판에서 Enter = 시작 (VS)
      expect(applyInput(opened, { kind: 'space' }).runtime.stage).toMatchObject({ vsAt: TIMING.trainerAlertMs });
      // 판에서 Esc (1:1 로) = 1:1 바로 VS
      expect(applyInput(opened, { kind: 'team-mode', on: false, go: true }).runtime.stage).toMatchObject({ team: false, vsAt: TIMING.trainerAlertMs });
      // 넷째 = 셋째 자리와 바꿈 (1 · 2 그대로)
      const other = ['m1', 'm2', 'm3', 'm4', 'm5'].find((u) => !first.includes(u))!;
      expect(teamPickOf(applyInput(opened, { kind: 'team-pick', uid: other }))).toEqual([first[0], first[1], other]);
      // 고르는 중에 패널이 좁아져 잠겨도 고르기를 이어 감 (바로 VS 가 시작되던 것 — 코드 리뷰어) · 넓히면 다시 3:3
      const narrowed = { ...opened, runtime: { ...opened.runtime, view: { w: 200, h: 187 } } };
      const still = steps(narrowed, 1000);
      expect(still.runtime.stage).toMatchObject({ phase: 'trainer', team: true });
      expect(still.runtime.stage?.phase === 'trainer' && still.runtime.stage.vsAt).toBeUndefined();
      // 3:3 이 잠기면 (1마리) 고르기 없는 만남 — 예전 4초
      const locked = meet(sampleSave());
      expect(teamChoiceMeet(locked)).toBe(false);
      expect(steps(locked, TIMING.trainerMeetMs - TIMING.trainerAlertMs + STEP).runtime.stage?.phase).toBe('battle');
    } finally {
      setOn(TEAM_ON);
    }
  });

  it('대기실 고르기 — 처음엔 상성 좋은 셋 · 바꾼 셋으로 관장 3:3', () => {
    setOn(true);
    try {
      const base = createGameState({ ...five(), location: { screen: 'gym' } }, 3);
      const closed = { ...base, runtime: { ...base.runtime, stage: { phase: 'lobby' as const }, stageId: null } };
      // 도전 = 판이 열림 (상성 좋은 셋 미리 체크)
      const lobby = applyInput(closed, { kind: 'challenge' });
      const first = teamPickOf(lobby)!;
      expect(first).toHaveLength(3);
      const other = ['m1', 'm2', 'm3', 'm4', 'm5'].find((u) => !first.includes(u))!;
      const changed = applyInput(lobby, { kind: 'team-pick', uid: other });
      const g = applyInput(changed, { kind: 'challenge' });
      expect(g.runtime.stage?.phase === 'team' && g.runtime.stage.team.fought).toEqual([first[0], first[1], other]);
    } finally {
      setOn(TEAM_ON);
    }
  });

  it('기다림은 저절로 나갈 한 칸 (칩 칸) 만 셈 — 둘째로 찬 칸은 첫 칸이 나간 뒤 0 부터 3초 (디자인팀 UX R9 ⑥ U1)', () => {
    const b0 = startTeamBattle(team3(), foes(), 'trainer', '상대');
    const two: TeamBattle = { ...b0, me: b0.me.map((f, i) => ({ ...f, ult: i === 2 ? 0 : 1, gauge: 0 })), foe: b0.foe.map((f) => ({ ...f, ult: 0, gauge: 0 })), ultReadyAt: { me: [b0.t + 500, b0.t, null], foe: [null, null, null] } };
    expect(teamAutoUltNext(two)).toBe(1);
    const later = teamStep(teamStep(two, STEP, new Rng(3), { auto: false, away: false }), STEP, new Rng(3), { auto: false, away: false });
    expect(later.autoWait).toEqual([0, STEP * 2, 0]);
    // HP 30% 아래 (바로 나감) 칸이 먼저
    const low: TeamBattle = { ...two, me: two.me.map((f, i) => (i === 0 ? { ...f, hp: 1 } : f)) };
    expect(teamAutoUltNext(low)).toBe(0);
    expect(teamAutoUltNext({ ...two, me: two.me.map((f) => ({ ...f, ult: 0 })) })).toBeNull();
  });

  it('상대 AI 끼어들기는 1초 뒤부터 (컷인 이름 · 합동 멘트를 1초는 봄) · 상대 동료는 0.5초 안에 모임 (디자인팀 UX R9 ⑥ U1)', () => {
    const b0 = startTeamBattle(team3(), foes(), 'gym', '관장');
    let joins = 0;
    let allies = 0;
    for (let seed = 1; seed <= 40; seed++) {
      // 내 필살기 (찬 동료가 있어 합동 멘트) — 상대 셋 다 참 · 관장 (자주 끼어듦)
      const mine: TeamBattle = { ...b0, me: b0.me.map((f, i) => ({ ...f, ult: i < 2 ? 1 : 0, gauge: 0 })), foe: b0.foe.map((f) => ({ ...f, ult: 1, gauge: 0 })), reserve: [0], ultReadyAt: { me: [b0.t, b0.t + 100, null], foe: [null, null, null] } };
      const s = teamStep(mine, STEP, new Rng(seed), { auto: false, away: false });
      if (s.phase === 'ult' && s.ult?.joinAt !== null && s.ult?.joinAt !== undefined) {
        joins++;
        expect(s.ult.joinAt).toBeGreaterThanOrEqual(TIMING.team.foeJoinMinMs);
      }
      // 상대 필살기 (찬 동료) — 모이는 때
      const theirs: TeamBattle = { ...b0, me: b0.me.map((f) => ({ ...f, ult: 0, gauge: 0 })), foe: b0.foe.map((f) => ({ ...f, ult: 1, gauge: 0 })), foeUltWait: [STEP, null, null] };
      const f = teamStep(theirs, STEP, new Rng(seed), { auto: false, away: false });
      for (const a of f.ult?.allyAt ?? []) {
        allies++;
        expect(a.at).toBeLessThanOrEqual(TIMING.team.foeAllyByMs);
      }
    }
    expect(joins).toBeGreaterThan(0);
    expect(allies).toBeGreaterThan(0);
  });

  it('저절로 쓰기 기다림은 쓸 수 있는 걸음에서만 셈 — 다른 필살기 중엔 멈춤 (디자인팀 #26 판정)', () => {
    const b0 = startTeamBattle(team3(), foes(), 'trainer', '상대');
    const full: TeamBattle = { ...b0, me: b0.me.map((f, i) => ({ ...f, ult: i === 1 ? 1 : 0, gauge: 0 })), foe: b0.foe.map((f, i) => ({ ...f, ult: i === 0 ? 1 : 0, gauge: 0 })), autoWait: [0, 1000, 0] };
    // 상대 필살기 중 (ult 단계) — 내 기다림은 그대로
    const foeUlt = teamStep({ ...full, foeUltWait: [STEP, null, null] }, STEP, new Rng(3), { auto: false, away: false });
    expect(foeUlt.phase).toBe('ult');
    const during = teamStep(foeUlt, STEP, new Rng(3), { auto: false, away: false });
    expect(during.autoWait?.[1]).toBe(foeUlt.autoWait?.[1]);
    // 다른 필살기 중엔 칩도 없음 (멈춘 숫자가 1장면 보였다 사라지던 것 — 디자인 UX R9) · 기다림은 그대로 남았다가 run 에서 이어 셈
    expect(teamAutoUltLeft(during, 1)).toBeNull();
    // 안 볼 때는 기다림을 지움 (돌아오면 다시 3초 — 코드 리뷰어)
    expect(teamStep({ ...full, autoWait: [0, 2500, 0], me: full.me.map((f) => ({ ...f, ult: 0 })) }, STEP, new Rng(3), { auto: false, away: true }).autoWait).toBeUndefined();
    // HP 30% 아래면 기다리지 않음 (기획 #26 R2 ①)
    const low: TeamBattle = { ...full, me: full.me.map((f, i) => (i === 1 ? { ...f, hp: Math.ceil(f.maxHp * BALANCE.autoPotionBelow) - 1 } : f)) };
    expect(teamAutoUltLeft(low, 1)).toBe(0);
    const go = teamStep(low, STEP, new Rng(3), { auto: false, away: false });
    expect(go.phase === 'ult' && go.ult?.side === 'me' && go.ult.from).toBe(1);
  });

  it('다 찬 필살기 — 볼 때는 3초 (발밑 판 반짝) 뒤 저절로 (자동 전투가 꺼져도) · 안 볼 때는 바로 (기획 검토 R2 A)', () => {
    const b0 = startTeamBattle(team3(), foes(), 'trainer', '상대');
    const full: TeamBattle = { ...b0, me: b0.me.map((f, i) => ({ ...f, ult: i === 1 ? 1 : 0, gauge: 0 })), foe: b0.foe.map((f) => ({ ...f, ult: 0, gauge: 0 })), ultReadyAt: { me: [null, b0.t, null], foe: [null, null, null] } };
    expect(teamAutoUltLeft(full, 1)).toBe(BALANCE.ultAutoWaitMs);
    expect(teamAutoUltLeft(full, 0)).toBeNull();
    const away = teamStep(full, STEP, new Rng(3), { auto: false, away: true });
    expect(away.phase === 'ult' && away.ult?.side === 'me' && away.ult.from).toBe(1);
    let b = full;
    let fired = -1;
    for (let t = STEP; t <= BALANCE.ultAutoWaitMs + 1000 && fired < 0; t += STEP) {
      // 행동 게이지는 비워 둠 (기술이 끼지 않게)
      b = teamStep({ ...b, me: b.me.map((f) => ({ ...f, gauge: 0 })), foe: b.foe.map((f) => ({ ...f, gauge: 0 })) }, STEP, new Rng(3), { auto: false, away: false });
      if (b.phase === 'ult' && b.ult?.side === 'me') fired = t;
    }
    expect(fired).toBeGreaterThanOrEqual(BALANCE.ultAutoWaitMs);
    expect(fired).toBeLessThan(BALANCE.ultAutoWaitMs + STEP * 2);
    expect(b.ult?.from).toBe(1);
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
  // 예전 규칙 (저절로 쓰기 — R2) 을 보는 묶음: 켜고 봄 · 게임 값 (꺼짐 — 사용자가 눌러야만, orders #82) 은 'ultAutoUse 꺼짐' 테스트가 봄
  const autoUse = BALANCE as { ultAutoUse: boolean };
  const wasAutoUse = autoUse.ultAutoUse;
  beforeEach(() => {
    autoUse.ultAutoUse = true;
  });
  afterEach(() => {
    autoUse.ultAutoUse = wasAutoUse;
  });

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
    // 합동은 한 점 = 한 마리 (기획 R7 A)
    expect(joint.ult).toMatchObject({ joint: { winners: [0, 1], losers: [joint.ult!.target], sure: false }, dur: TIMING.team.jointMs, window: 0 });
    expect(teamGather(joint)).toBeNull();
    const hp = joint.foe.map((f) => f.hp);
    const hit = run(joint, TIMING.team.jointHitMs + STEP, fixedRng(0.99));
    expect(hit.foe.filter((f, i) => f.hp < hp[i]!).length).toBe(1);
    expect(hit.foe[joint.ult!.target!]!.hp).toBeLessThan(hp[joint.ult!.target!]!);
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
    // 찬 동료가 다 모이고 상대 끼어들기도 없으면 멘트를 끝까지 안 기다리고 바로 합동 (코드 리뷰어)
    expect(run({ ...g, reserve: [2] }, STEP, fixedRng(0.99)).ult!.joint?.winners).toEqual([0, 2]);
    expect(teamStep(g, STEP, fixedRng(0.99), { auto: true, away: false }).ult!.joint?.winners).toEqual([0, 2]);
    // 막 시작한 걸음에 바로 모임 — 멘트 (합동 띠) 가 한 장면만 보이지 않게 (UX 리뷰어 #59, U1): 자동 전투 · 예약
    let autoStart = full(base(), 'me', [0, 2]);
    for (let t = 0; t < 10_000 && autoStart.phase !== 'ult'; t += STEP) autoStart = teamStep(autoStart, STEP, fixedRng(0.99), { auto: true, away: false });
    expect(autoStart.phase).toBe('ult');
    expect(teamGather(autoStart)).toBeNull();
    expect(autoStart.ult!.joint?.winners.slice().sort()).toEqual([0, 2]);
    const reserved = teamInput({ ...full(base(), 'me', [0, 2]), reserve: [2] }, { kind: 'ult', slot: 0 }, fixedRng(0.99));
    expect(teamGather(reserved)).toBeNull();
    expect(reserved.ult!.joint?.winners).toEqual([0, 2]);
    // 멘트 중에 쓴 포켓몬 · 모인 포켓몬의 키를 또 눌러도 예약이 되지 않음
    expect(teamInput(g, { kind: 'ult', slot: 0 }, fixedRng(0.99))).toBe(g);
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

describe('3마리 기본 고르기 레벨 규칙 (orders #46 · #44 — 꺼 둔 스위치)', () => {
  // #44 그대로: Lv 31 파이숭이 (격투 — 얼음에 2배라 상성 점수가 높음) · Lv 58 넷 (노말 기술) vs 해변 관장 중반 골덕 · 라프라스 · 갸라도스
  const foes = [sampleMonster({ uid: 'f1', species: 55, form: 'golduck', level: 47 }), sampleMonster({ uid: 'f2', species: 131, form: 'lapras', level: 48 }), sampleMonster({ uid: 'f3', species: 130, form: 'gyarados', level: 49 })];
  const mons = [
    sampleMonster({ uid: 'm1', species: 391, form: 'monferno', level: 31, moves: [{ moveId: 183, pp: 30 }] }),
    ...[2, 3, 4, 5].map((i) => sampleMonster({ uid: `m${i}`, level: 58 - (i % 2), moves: [{ moveId: 33, pp: 35 }] })),
  ];
  const save = sampleSave({ party: mons.map((m) => m.uid), monsters: Object.fromEntries(mons.map((m) => [m.uid, m])) });
  const setGap = (gap: number) => {
    (BALANCE.team as { pickLevelGap: number }).pickLevelGap = gap;
  };

  it('꺼짐 (0) = 상성 점수 먼저 — Lv 31 파이숭이가 들어감 · 켬 (10, 게임 값 — orders #59) = 센 셋 평균보다 10 넘게 낮으면 뒤로 — 빠짐', () => {
    expect(BALANCE.team.pickLevelGap).toBe(10);
    setGap(0);
    try {
      expect(pickTeam(save, foes)).toContain('m1');
      setGap(10);
      const picked = pickTeam(save, foes);
      expect(picked).toHaveLength(3);
      expect(picked).not.toContain('m1');
      // 살아 있는 게 셋뿐이면 낮아도 나감 (모자라면 그래도)
      const few = { ...save, party: ['m1', 'm2', 'm3'] };
      expect(pickTeam(few, foes).sort()).toEqual(['m1', 'm2', 'm3']);
      // 레벨 차가 10 안이면 상성 그대로
      const close = { ...save, monsters: { ...save.monsters, m1: { ...save.monsters.m1!, level: 50 } } };
      expect(pickTeam(close, foes)).toContain('m1');
      // 순위 전체 (n = Infinity — 고르기에서 빼고 채울 때) 도 센 셋 평균 기준 (모두의 평균이면 Lv 47 이 "안 낮음" 으로 앞에 오던 것 — 테스터 #59)
      const mid = { ...save, monsters: { ...save.monsters, m1: { ...save.monsters.m1!, level: 47 } } };
      expect(pickTeam(mid, foes)).not.toContain('m1');
      expect(pickTeam(mid, foes, Infinity).at(-1)).toBe('m1');
    } finally {
      setGap(10);
    }
  });
});

describe('필살기는 사용자가 눌러야만 (orders #82 — BALANCE.ultAutoUse 꺼짐)', () => {
  it('3:3 — 볼 때 · 안 볼 때 · 자동 전투 모두 다 찬 필살기가 저절로 안 나감 · 상대 필살기에 저절로 안 끼어듦 · 누르거나 예약하면 나감', () => {
    expect(BALANCE.ultAutoUse).toBe(false);
    const b0 = startTeamBattle(team3(), foes(), 'trainer', '상대');
    const full: TeamBattle = { ...b0, me: b0.me.map((f) => ({ ...f, ult: 1, gauge: 0 })), foe: b0.foe.map((f) => ({ ...f, ult: 0, gauge: 0 })), ultReadyAt: { me: [b0.t, b0.t, b0.t], foe: [null, null, null] } };
    expect(teamAutoUltLeft(full, 0)).toBeNull();
    for (const opts of [{ auto: true, away: true }, { auto: true, away: false }, { auto: false, away: false }]) {
      let b = full;
      for (let t = 0; t < 6000; t += STEP) {
        b = teamStep({ ...b, me: b.me.map((f) => ({ ...f, gauge: 0 })), foe: b.foe.map((f) => ({ ...f, gauge: 0 })) }, STEP, new Rng(3), opts);
        expect(b.phase === 'ult' && b.ult?.side === 'me', JSON.stringify(opts)).toBe(false);
      }
    }
    // 누르면 · 예약하면
    expect(teamInput(full, { kind: 'ult', slot: 1 }, new Rng(3)).ult?.from).toBe(1);
    const reserved = teamStep({ ...full, reserve: [2] }, STEP, new Rng(3), { auto: true, away: true });
    expect(reserved.phase === 'ult' && reserved.ult?.from).toBe(2);
  });
});
