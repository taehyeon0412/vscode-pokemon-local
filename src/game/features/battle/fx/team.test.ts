/** 3:3 연출 다리 — 엔진 기록 → 계획 → 실행 (2026-10-21 orders #17 준비) */
import { describe, expect, it } from 'vitest';
import { sampleMonster, sampleSave, viaJson } from '../../../../test/fixtures/save';
import { TIMING } from '../../../core/balance';
import { Rng, readTeam, TEAM_LOG_MAX, type TeamBattle, type TeamNote } from '../../../core/engine';
import { startTeamBattle, teamStep } from '../../../core/engine/team';
import type { Monster, Save } from '../../../core/save';
import type { FxActor, PokemonFx } from './bridge';
import { planTeamFx, TEAM_FX, TEAM_FX_LATE_MS, TEAM_KNOCK, TeamFxRunner, type TeamFxCall } from './team';

const mon = (uid: string, o: Partial<Monster> = {}) => sampleMonster({ uid, level: 12, ...o });
function team3(): Save {
  const ms = [mon('m1'), mon('m2', { species: 4, form: 'charmander', moves: [{ moveId: 52, pp: 25 }] }), mon('m3', { species: 7, form: 'squirtle', moves: [{ moveId: 55, pp: 25 }] })];
  return sampleSave({ monsters: Object.fromEntries(ms.map((m) => [m.uid, { ...m, hp: 999 }])), party: ms.map((m) => m.uid) });
}
const foes = (): Monster[] => [10, 13, 16].map((dex, i) => sampleMonster({ uid: `f${i}`, species: dex, form: ['caterpie', 'weedle', 'pidgey'][i]!, level: 10, moves: [{ moveId: 33, pp: 35 }] }));
/** 기록을 직접 넣은 판 */
const withLog = (notes: TeamNote[]): TeamBattle => {
  const b = startTeamBattle(team3(), foes(), 'trainer', '상대');
  return { ...b, t: 5000, log: notes.map((n, i) => ({ ...n, id: i + 1, at: 5000 })), logSeq: notes.length };
};

describe('엔진 기록', () => {
  it('번호순 · 마지막 32개 · 다시 읽어도 그대로 · 쏨 · 맞음 · 끝이 적힘', () => {
    let b = startTeamBattle(team3(), foes(), 'trainer', '상대');
    const rng = new Rng(7);
    const kinds = new Set<string>();
    let last = 0;
    for (let t = 0; t < 300_000 && b.phase !== 'over'; t += TIMING.simStepMs) {
      b = teamStep(b, TIMING.simStepMs, rng, { auto: true, away: false });
      for (const e of b.log) if (e.id > last) kinds.add(e.t);
      last = b.logSeq;
    }
    expect(b.log.length).toBeLessThanOrEqual(TEAM_LOG_MAX);
    expect(b.log.every((e, i) => i === 0 || e.id === b.log[i - 1]!.id + 1)).toBe(true);
    expect(b.log[b.log.length - 1]!.id).toBe(b.logSeq);
    for (const k of ['shoot', 'hit', 'faint', 'ready', 'end']) expect(kinds.has(k)).toBe(true);
    expect(readTeam(viaJson(b))).toEqual(viaJson(b));
    expect(readTeam({ ...viaJson(b), log: [{ id: 1, t: 'hit', side: 'me', from: 9, to: 0 }] })).toBeNull();
    expect(readTeam({ ...viaJson(b), logSeq: 0 })).toBeNull();
  });
});

describe('계획', () => {
  const plan = (notes: TeamNote[], after = 0, seen = new Set<string>()) => planTeamFx(withLog(notes), after, seen);
  const one = (calls: TeamFxCall[], kind: TeamFxCall['do']) => calls.filter((c) => c.do === kind);

  it('쏨 = 그 기술 연출 (번호 · 엔진이 맞히는 때) · 닿는 기술 (1 공격 포함) 은 달려가기 · 본 번호 뒤만', () => {
    const calls = plan([
      { t: 'shoot', shot: 4, side: 'me', from: 1, targets: [0], moveId: 52, hitMs: 600, contact: false },
      { t: 'shoot', shot: 5, side: 'foe', from: 0, targets: [2], moveId: 0, hitMs: 440, contact: true },
    ]);
    expect(calls).toEqual([
      { do: 'move', tag: 4, src: { side: 'me', slot: 1 }, dst: { side: 'foe', slot: 0 }, move: { name: '불꽃세례', type: 'fire' }, hitMs: 600 },
      { do: 'dash', tag: 5, src: { side: 'foe', slot: 0 }, dst: { side: 'me', slot: 2 }, moveId: 0 },
    ]);
    expect(plan([{ t: 'shoot', shot: 4, side: 'me', from: 1, targets: [0], moveId: 52, hitMs: 600, contact: false }], 1)).toEqual([]);
    // 0.6초 넘게 지난 일 (패널을 접었다 폈을 때) 은 안 그림 — 필살기는 본 것으로 셈
    const old = withLog([{ t: 'shoot', shot: 4, side: 'me', from: 1, targets: [0], moveId: 52, hitMs: 600, contact: false }, { t: 'ult', side: 'me', from: 0 }]);
    const seen = new Set<string>();
    expect(planTeamFx({ ...old, t: 5000 + TEAM_FX_LATE_MS + 1 }, 0, seen)).toEqual([]);
    expect(seen.has('me:0')).toBe(true);
  });

  it('맞음 = 타입 임팩트 (굉장 크게 · 효과 없음 연기만) + 맞은 포켓몬만 반 칸 밀림 · 쓰러지면 별빛', () => {
    const calls = plan([
      { t: 'hit', side: 'me', from: 1, to: 0, moveId: 52, ult: false, effect: 'super', dmg: 9, ko: false },
      { t: 'hit', side: 'foe', from: 0, to: 1, moveId: 33, ult: false, effect: 'immune', dmg: 0, ko: false },
      { t: 'hit', side: 'me', from: 2, to: 1, moveId: 55, ult: false, effect: 'damage', dmg: 30, ko: true },
    ]);
    expect(one(calls, 'impact')).toEqual([
      { do: 'impact', dst: { side: 'foe', slot: 0 }, type: 'fire', big: true, name: '불꽃세례', o: { scale: 1.25 } },
      { do: 'impact', dst: { side: 'me', slot: 1 }, type: 'normal', big: false, name: '몸통박치기', o: { none: true }, delayMs: TEAM_FX.contactImpactLagMs },
      { do: 'impact', dst: { side: 'foe', slot: 1 }, type: 'water', big: false, name: '물대포', o: { scale: 1 } },
    ]);
    // 닿는 기술 (몸통박치기) 은 맞는 쪽 몸에 자국 (1:1 과 같음) → 임팩트는 조금 늦게
    expect(one(calls, 'strike')).toEqual([{ do: 'strike', dst: { side: 'me', slot: 1 }, src: { side: 'foe', slot: 0 }, move: { name: '몸통박치기', type: 'normal' } }]);
    expect(one(calls, 'knock')).toEqual([
      { do: 'knock', dst: { side: 'foe', slot: 0 }, cells: TEAM_KNOCK.cells, ms: TEAM_KNOCK.ms },
      { do: 'knock', dst: { side: 'foe', slot: 1 }, cells: TEAM_KNOCK.cells, ms: TEAM_KNOCK.ms },
    ]);
    expect(one(calls, 'ko')).toEqual([{ do: 'ko', dst: { side: 'foe', slot: 1 } }]);
  });

  it('마지막 한 방 = 크게 + 한 칸 밀림 + 짧게 멈춤 (같은 묶음에 끝이 있을 때)', () => {
    const calls = plan([
      { t: 'hit', side: 'me', from: 1, to: 2, moveId: 52, ult: false, effect: 'damage', dmg: 9, ko: true },
      { t: 'faint', side: 'foe', slot: 2 },
      { t: 'end', result: 'win' },
    ]);
    expect(one(calls, 'impact')[0]).toMatchObject({ big: true, o: { scale: 1.4 } });
    expect(one(calls, 'knock')[0]).toMatchObject({ cells: TEAM_KNOCK.finalCells, ms: TEAM_KNOCK.finalMs });
    expect(one(calls, 'final')).toEqual([{ do: 'final', dst: { side: 'foe', slot: 2 } }]);
    expect(one(calls, 'ko')).toEqual([]);
    expect(one(calls, 'end')).toHaveLength(1);
    // 독으로 쓰러지면 (맞은 한 방 없이) 별빛
    expect(plan([{ t: 'faint', side: 'me', slot: 0 }])).toEqual([{ do: 'ko', dst: { side: 'me', slot: 0 } }]);
  });

  it('기술 힘겨루기 = 두 기술 멈춤 · 필살기 두 번째부터 짧게 · 힘겨루기 · 합류 · 합동 · 3:1 마무리', () => {
    expect(plan([{ t: 'clash', shots: [3, 4], me: 1, foe: 2 }])).toEqual([
      { do: 'stop', tag: 3 },
      { do: 'stop', tag: 4 },
      { do: 'clash', me: 1, foe: 2 },
    ]);
    const seen = new Set<string>();
    const ults = plan([{ t: 'ult', side: 'me', from: 0 }, { t: 'ult', side: 'me', from: 0 }, { t: 'ult', side: 'foe', from: 2 }], 0, seen);
    // 필살기는 매번 일반 모드 그대로 (태현 님 — 짧게는 TEAM_FX.quickRepeat, 기획 #88 대기) · 열쇠 = 시작 시각
    expect(ults.map((c) => c.do === 'ult' && c.quick)).toEqual([false, false, false]);
    expect(ults[0]).toMatchObject({ dst: { side: 'foe', slot: 1 }, key: 'teamult5000' });
    // 합동 마무리 — 이긴 참가자 · 가운데 진 참가자 · 타입
    expect(plan([{ t: 'ult', side: 'me', from: 0, joint: { winners: [0, 2], losers: [0, 1, 2], sure: false } }])).toEqual([
      { do: 'joint', winners: [{ side: 'me', slot: 0 }, { side: 'me', slot: 2 }], dst: { side: 'foe', slot: 1 }, types: [withLog([]).me[0]!.types[0], withLog([]).me[2]!.types[0]], sure: false, key: 'teamult5000' },
    ]);
    const end = plan([
      { t: 'ult-clash', me: [0], foe: [1] },
      { t: 'ult-join', side: 'me', slot: 2 },
      { t: 'ult-clash-end', winner: 'me', sure: false, me: [0, 2], foe: [1] },
    ]);
    expect(end).toEqual([
      { do: 'ult-clash', me: [0], foe: [1] },
      { do: 'ult-join', who: { side: 'me', slot: 2 } },
      { do: 'ult-clash-end', winner: 'me', joint: true, sure: false },
    ]);
    expect(plan([{ t: 'ult-clash-end', winner: 'foe', sure: true, me: [0], foe: [0, 1, 2] }])).toEqual([{ do: 'ult-clash-end', winner: 'foe', joint: true, sure: true }]);
  });
});

describe('실행', () => {
  const fake = () => {
    const calls: string[] = [];
    const rec =
      (name: string) =>
      (...args: unknown[]) => {
        calls.push(`${name}:${args.filter((a) => typeof a === 'number' || typeof a === 'boolean').join(',')}`);
        return 100;
      };
    const fx = { version: 4, plan: () => null, move: rec('move'), cast: rec('cast'), impact: rec('impact'), clear: rec('clear'), stopMove: rec('stopMove'), team: rec('team'), hitStop: rec('hitStop'), ko: rec('ko'), mount: rec('mount') } as unknown as PokemonFx;
    const actor = { el: {} as HTMLElement, form: 'charmander', size: 32, left: false } as FxActor;
    return { calls, runner: new TeamFxRunner({ actor: () => actor }, fx) };
  };

  it('처음엔 지난 기록을 안 그림 (3:3 모드 켬) · 새 기록만 · 끝나면 지우고 끔', () => {
    const { calls, runner } = fake();
    const b = withLog([{ t: 'shoot', shot: 1, side: 'me', from: 1, targets: [0], moveId: 52, hitMs: 600, contact: false }]);
    runner.update(b);
    expect(calls).toEqual(['team:true', 'mount:']);
    const more: TeamBattle = { ...b, t: 5050, log: [...b.log, { t: 'shoot', shot: 2, side: 'me', from: 1, targets: [0], moveId: 52, hitMs: 600, contact: false, id: 2, at: 5050 }, { t: 'clash', shots: [2, 9], me: 1, foe: 0, id: 3, at: 5050 }], logSeq: 3 };
    runner.update(more);
    expect(calls.filter((c) => c !== 'team:true').slice(1)).toEqual(['move:0,2', 'stopMove:2,true', 'stopMove:9,true']);
    calls.length = 0;
    runner.update({ ...more, t: 5100, log: [...more.log, { t: 'hit', side: 'me', from: 1, to: 2, moveId: 52, ult: false, effect: 'damage', dmg: 9, ko: true, id: 4, at: 5100 }, { t: 'end', result: 'win', id: 5, at: 5100 }], logSeq: 5 });
    expect(calls).toEqual(['team:true', 'impact:true', 'hitStop:160,true', 'ko:']);
    runner.reset();
    expect(calls.slice(-2)).toEqual(['clear:', 'team:false']);
  });

  it('새 판 (시각이 줄어듦 · 상대가 바뀜) · 기록이 빠짐 (32개 넘게) 이면 그리지 않고 지금부터', () => {
    const { calls, runner } = fake();
    const b = withLog([{ t: 'shoot', shot: 1, side: 'me', from: 1, targets: [0], moveId: 52, hitMs: 600, contact: false }]);
    runner.update(b);
    calls.length = 0;
    const shoot = (id: number, t: number) => ({ t: 'shoot' as const, shot: id, side: 'me' as const, from: 1, targets: [0], moveId: 52, hitMs: 600, contact: false, id, at: t });
    // 새 판 — 시각이 앞보다 작음 (번호는 더 큼)
    runner.update({ ...b, t: 100, log: [shoot(1, 100), shoot(2, 100)], logSeq: 2 });
    expect(calls).toEqual(['team:true', 'mount:']);
    // 사이 기록이 빠짐
    calls.length = 0;
    runner.update({ ...b, t: 200, log: [shoot(40, 200)], logSeq: 40 });
    expect(calls).toEqual(['team:true']);
    runner.update({ ...b, t: 250, log: [shoot(40, 200), shoot(41, 250)], logSeq: 41 });
    expect(calls).toEqual(['team:true', 'team:true', 'move:0,41']);
  });
});
