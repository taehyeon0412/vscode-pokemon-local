import { describe, expect, it } from 'vitest';
import { sampleSave, viaJson } from '../../../test/fixtures/save';
import { BALANCE, TIMING } from '../balance';
import { startBattle, startTrainerBattle } from '../engine/battle';
import { awaySummary, dailyView, step } from '../engine/play';
import { createGameState, type GameState } from '../engine/state';
import { validateSave } from '../save';
import type { TypeName } from '../../data';
import { devState } from '../../dev/demo';
import { dailyAdd, dailyDone, dailyFor, dailyLabel, dayFarAhead, dayKey } from './daily';
import { trainerInfo } from './trainer';

const STEP = TIMING.simStepMs;
const DAY = '2026-10-22';

describe('오늘의 목표 규칙 (gdd 4.11 U13 · orders #28)', () => {
  it('날짜 = 내 PC 날짜 · 같은 날이면 같은 셋 · ① 켜 두기 ② 봐야 ③ 숲 타입', () => {
    expect(dayKey(new Date(2026, 9, 2, 23, 59))).toBe('2026-10-02');
    const a = dailyFor(DAY);
    expect(dailyFor(DAY)).toEqual(a);
    expect(a.goals).toHaveLength(3);
    expect(['wild-win', 'trainer-win', 'stage-clear']).toContain(a.goals[0]!.kind);
    expect(['new-catch', 'perfect-parry', 'request']).toContain(a.goals[1]!.kind);
    expect(a.goals[2]).toMatchObject({ kind: 'type-win', need: 5 });
    expect(['grass', 'bug']).toContain(a.goals[2]!.type);
    for (const g of a.goals) expect(g.reward === 'poke-ball' ? g.rewardN === 2 : g.rewardN === 1).toBe(true);
    // 여러 날에 걸쳐 고르기가 고루 나옴
    const kinds = new Set(Array.from({ length: 40 }, (_, i) => dailyFor(`2026-11-${String((i % 28) + 1).padStart(2, '0')}`).goals[0]!.kind));
    expect(kinds.size).toBeGreaterThan(1);
    expect(dailyLabel({ kind: 'type-win', need: 5, type: 'grass' })).toBe('풀 타입 5마리 이기기');
  });

  it('한 일을 더함 — 넘치지 않음 · 끝나면 한 번만 · 야생 승리는 타입 목표에도', () => {
    const d = { day: DAY, goals: [{ kind: 'wild-win' as const, need: 2, have: 0, reward: 'poke-ball' as const, rewardN: 2 }, { kind: 'type-win' as const, need: 1, have: 0, type: 'bug', reward: 'pearl' as const, rewardN: 1 }] };
    const one = dailyAdd(d, 'wild-win', 1, ['grass']);
    expect(one.daily.goals.map((g) => g.have)).toEqual([1, 0]);
    expect(one.finished).toEqual([]);
    const two = dailyAdd(one.daily, 'wild-win', 5, ['bug', 'poison']);
    expect(two.daily.goals.map((g) => g.have)).toEqual([2, 1]);
    expect(two.finished.map((g) => g.kind)).toEqual(['wild-win', 'type-win']);
    expect(dailyAdd(two.daily, 'wild-win', 1, ['bug']).finished).toEqual([]);
    expect(dailyDone(two.daily)).toBe(2);
    expect(dailyAdd(d, 'request', 0).daily).toBe(d);
  });
});

describe('오늘의 목표 · 기록 — 엔진 (개발 모드 · 꺼짐도 견줌)', () => {
  const base = (dev = true): GameState => {
    const s = createGameState(sampleSave(), 7);
    const g = { ...s, runtime: { ...s.runtime, today: DAY } };
    return dev ? devState(g) : g;
  };
  const walkOnce = (s: GameState) => step(s, STEP).state;
  /** 야생 전투가 이긴 채 끝나는 걸음 */
  const winWild = (s: GameState, types: TypeName[]): GameState => {
    const mon = { ...s.save.monsters[s.save.party[0]!]!, uid: 'w', caughtAt: 'forest-1' as const };
    const b = startBattle(s.save, mon, 'normal');
    const over = { ...b, phase: 'over' as const, result: 'win' as const, overMs: TIMING.battleOverMs, foe: { ...b.foe, hp: 0, types } };
    return { ...s, save: { ...s.save, pendingEncounter: { kind: 'wild', monster: mon, start: 'normal' } }, runtime: { ...s.runtime, stageId: 'forest-1', stage: { phase: 'battle', battle: over } } };
  };

  /** 본편 오늘의 목표를 끈 채로 (BALANCE.daily.on 값과 상관없이 — 3:3 켤 때 값 한 줄, #55) */
  const dailyOff = <T>(fn: () => T): T => {
    const was = BALANCE.daily.on;
    (BALANCE.daily as { on: boolean }).on = false;
    try {
      return fn();
    } finally {
      (BALANCE.daily as { on: boolean }).on = was;
    }
  };

  it('꺼져 있으면 (개발 모드 아님) 목표 · 기록 칸을 만들지 않음', () => {
    const s = dailyOff(() => walkOnce(base(false)));
    expect(s.save.daily).toBeUndefined();
    expect(s.save.records).toBeUndefined();
  });

  it('걷기 (경계) 에서 그날 목표가 생김 · 날이 바뀌어도 전투 중엔 안 바뀜 · 걸은 거리 기록', () => {
    const s = walkOnce(base());
    expect(s.save.daily?.day).toBe(DAY);
    expect(s.save.records?.walked).toBeGreaterThan(0);
    const fighting = { ...winWild(s, ['grass']), runtime: { ...winWild(s, ['grass']).runtime, today: '2026-10-23' } };
    const fought = { ...fighting, runtime: { ...fighting.runtime, stage: { ...fighting.runtime.stage!, battle: { ...(fighting.runtime.stage as { battle: ReturnType<typeof startBattle> }).battle, phase: 'run' as const } } as GameState['runtime']['stage'] } };
    expect(walkOnce(fought).save.daily?.day).toBe(DAY);
  });

  it('야생을 이기면 야생 · 타입 목표를 셈 · 다 하면 보상 + 알림 · 셋 다면 금구슬 · 기록 이긴 수', () => {
    const s0 = walkOnce(base());
    const goals = [
      { kind: 'wild-win' as const, need: 1, have: 0, reward: 'poke-ball' as const, rewardN: 2 },
      { kind: 'request' as const, need: 1, have: 1, done: true as const, reward: 'pearl' as const, rewardN: 1 },
      { kind: 'type-win' as const, need: 1, have: 0, type: 'grass', reward: 'stardust' as const, rewardN: 1 },
    ];
    const s1 = { ...s0, save: { ...s0.save, daily: { day: DAY, goals } } };
    const balls = s1.save.bag['poke-ball'] ?? 0;
    const after = walkOnce(winWild(s1, ['grass']));
    expect(after.runtime.stage?.phase).toBe('result');
    expect(after.save.daily?.goals.every((g) => g.done)).toBe(true);
    expect(after.save.daily?.bonus).toBe(true);
    expect(after.save.bag['poke-ball']).toBe(balls + 2);
    expect(after.save.bag.stardust).toBe((s1.save.bag.stardust ?? 0) + 1);
    expect(after.save.bag.nugget).toBe((s1.save.bag.nugget ?? 0) + 1);
    expect(after.runtime.toast?.text).toContain('오늘의 목표 ✓');
    expect(JSON.stringify(after.runtime.toast?.then)).toContain('다 했어요');
    expect(after.save.records?.wins).toBe(1);
    // 안 보는 동안 끝냈으면 그동안 요약에 한 줄 (gdd 4.13 R14)
    expect(awaySummary({ money: after.save.money, bag: after.save.bag, wild: 0, dailyDone: 1 }, after.save).join(' ').replace(/\u00a0/g, ' ')).toContain('오늘의 목표 3/3');
    // 다른 타입이면 타입 목표는 안 셈
    const other = walkOnce(winWild(s1, ['normal']));
    expect(other.save.daily?.goals[2]?.have).toBe(0);
  });

  it('트레이너를 이기면 트레이너 목표 (야생 · 타입 목표는 안 셈) · 기록 이긴 수', () => {
    const s0 = walkOnce(base());
    const goals = [
      { kind: 'trainer-win' as const, need: 2, have: 0, reward: 'potion' as const, rewardN: 2 },
      { kind: 'wild-win' as const, need: 1, have: 0, reward: 'poke-ball' as const, rewardN: 2 },
      { kind: 'type-win' as const, need: 1, have: 0, type: 'grass', reward: 'stardust' as const, rewardN: 1 },
    ];
    const s1 = { ...s0, save: { ...s0.save, daily: { day: DAY, goals } } };
    // 트레이너 한 마리 팀을 이긴 채 끝나는 걸음
    const mon = { ...s1.save.monsters[s1.save.party[0]!]!, uid: 't0', caughtAt: 'forest-1' as const };
    const tb = startTrainerBattle(s1.save, [mon], 'trainer', trainerInfo('forest-1', 0).name);
    const over = { ...tb, phase: 'over' as const, result: 'win' as const, overMs: TIMING.battleOverMs, foe: { ...tb.foe, hp: 0 } };
    const trainer: GameState = {
      ...s1,
      save: { ...s1.save, pendingEncounter: { kind: 'trainer', trainerId: 'forest-1:t0', stageId: 'forest-1' } },
      runtime: { ...s1.runtime, stageId: 'forest-1', stage: { phase: 'battle', battle: over } },
    };
    const after = walkOnce(trainer);
    expect(after.runtime.stage?.phase).toBe('result');
    expect(after.save.daily?.goals.map((g) => g.have)).toEqual([1, 0, 0]);
    expect(after.save.records?.wins).toBe((s1.save.records?.wins ?? 0) + 1);
  });

  it('화면용 (dailyView) — 꺼져 있거나 · 다른 날 목표면 null · 세 줄 (이름 · n/m · 보상) · 끝낸 수', () => {
    const s0 = walkOnce(base());
    expect(dailyOff(() => dailyView(walkOnce(base(false))))).toBeNull();
    const v = dailyView(s0)!;
    expect(v.day).toBe(DAY);
    expect(v.goals).toHaveLength(3);
    expect(v.goals.every((g) => g.label.length > 0 && g.reward.length > 0 && g.have === 0 && !g.done)).toBe(true);
    expect(v.done).toBe(0);
    // 날이 바뀌었는데 아직 경계 (걷기) 를 안 지나 옛 목표가 남아 있으면 안 보임
    expect(dailyView({ ...s0, runtime: { ...s0.runtime, today: '2026-10-23' } })).toBeNull();
  });

  it('세이브 — 저장하고 다시 읽어도 같음 · 이상한 목표는 빼고 · 날짜가 이상하면 통째로 뺌', () => {
    const save = { ...sampleSave(), daily: dailyFor(DAY), records: { wins: 3, catches: 1, walked: 1.25 } };
    const r = validateSave(viaJson(save));
    expect(r.ok && r.save.daily).toEqual(save.daily);
    expect(r.ok && r.save.records).toEqual(save.records);
    const bad = validateSave(viaJson({ ...save, daily: { day: 'yesterday', goals: [] } }));
    expect(bad.ok && bad.save.daily).toBeUndefined();
    const odd = validateSave(viaJson({ ...save, daily: { day: DAY, goals: [{ kind: 'fly-away', need: 1, have: 0, reward: 'poke-ball', rewardN: 1 }, save.daily.goals[0]] } }));
    expect(odd.ok && odd.save.daily?.goals).toHaveLength(1);
    // 옛 세이브엔 칸을 만들지 않음
    const old = validateSave(viaJson(sampleSave()));
    expect(old.ok && ('daily' in old.save || 'records' in old.save)).toBe(false);
  });
});

describe('오늘의 목표 고침 (명세 검사관 #53 · 코드 리뷰어 #52)', () => {
  const base = (): GameState => {
    const s = createGameState(sampleSave(), 7);
    return devState({ ...s, runtime: { ...s.runtime, today: DAY } });
  };
  const walkOnce = (s: GameState) => step(s, STEP).state;

  it('보상 흔한 팔 물건 = 작은버섯 · 진주 (별의모래 빠짐) · 타입 목표는 그 지역 타입', () => {
    for (let d = 1; d <= 28; d++) {
      const g = dailyFor(`2026-11-${String(d).padStart(2, '0')}`);
      for (const x of g.goals) expect(['poke-ball', 'tiny-mushroom', 'pearl']).toContain(x.reward);
    }
    expect(['water']).toContain(dailyFor(DAY, ['water']).goals[2]!.type);
  });

  it('손으로 [도와준다] 해 성공하면 부탁 목표를 셈 (결과가 걸음 밖에서 들어가 안 세던 것) · 실패는 안 셈', () => {
    const s0 = walkOnce(base());
    const goals = [{ kind: 'request' as const, need: 1, have: 0, reward: 'pearl' as const, rewardN: 1 }];
    const withReq = (ok: boolean): GameState => ({
      ...s0,
      save: { ...s0.save, daily: { day: DAY, goals } },
      runtime: { ...s0.runtime, stageId: 'forest-1', stage: { phase: 'request', at: 0.3, number: 0, result: { ok, text: ok ? '고마워!' : '아쉽다…' } as never, ms: 999_999 } },
    });
    // 결과 장면이 끝나는 걸음 (다음 장면으로)
    const end = (s: GameState) => {
      let cur = s;
      for (let i = 0; i < 400 && cur.runtime.stage?.phase === 'request'; i++) cur = walkOnce(cur);
      return cur;
    };
    expect(end(withReq(true)).save.daily?.goals[0]?.have).toBe(1);
    expect(end(withReq(false)).save.daily?.goals[0]?.have).toBe(0);
  });

  it('걸은 거리 = 스테이지 하나 10000 · PC 날짜를 되돌려도 같은 날 목표를 다시 받지 않음', () => {
    const s = walkOnce(base());
    const w = s.save.records?.walked ?? 0;
    // 한 걸음 진행 × 10000 (반올림 없이 — 걸음마다 반올림하면 한 스테이지가 1.5배로 셈)
    expect(w).toBeGreaterThan(0);
    expect(w).toBeLessThan(5);
    const back = walkOnce({ ...s, save: { ...s.save, daily: { ...s.save.daily!, goals: s.save.daily!.goals.map((g) => ({ ...g, have: 1 })) } }, runtime: { ...s.runtime, today: '2026-10-21' } });
    expect(back.save.daily?.day).toBe(DAY);
    expect(back.save.daily?.goals[0]?.have).toBe(1);
  });
});

describe('잡기 — 오늘의 목표는 이긴 것으로 · 기록은 "잡은 수" 만 (기획 답)', () => {
  it('야생을 잡으면 야생 이기기 목표 +1 · 기록 catches +1 · wins 그대로', () => {
    const s0 = step(devState({ ...createGameState(sampleSave(), 7), runtime: { ...createGameState(sampleSave(), 7).runtime, today: DAY } }), STEP).state;
    const goals = [{ kind: 'wild-win' as const, need: 3, have: 0, reward: 'poke-ball' as const, rewardN: 2 }];
    const s1 = { ...s0, save: { ...s0.save, daily: { day: DAY, goals } } };
    const mon = { ...s1.save.monsters[s1.save.party[0]!]!, uid: 'w', caughtAt: 'forest-1' as const };
    const b = startBattle(s1.save, mon, 'normal');
    const caught = { ...b, phase: 'over' as const, result: 'catch' as const, overMs: TIMING.battleOverMs, foe: { ...b.foe, types: ['bug'] as TypeName[] } };
    const before = s1.save.records ?? { wins: 0, catches: 0, walked: 0 };
    const after = step({ ...s1, save: { ...s1.save, pendingEncounter: { kind: 'wild', monster: mon, start: 'normal' } }, runtime: { ...s1.runtime, stageId: 'forest-1', stage: { phase: 'battle', battle: caught } } }, STEP).state;
    expect(after.runtime.stage?.phase).toBe('result');
    expect(after.save.daily?.goals[0]?.have).toBe(1);
    expect(after.save.records?.wins).toBe(before.wins);
  });
});

describe('모두에게 켜짐 (orders #59)', () => {
  it('개발 모드가 아니어도 오늘의 목표를 받음 (게임 값 그대로)', () => {
    expect(BALANCE.daily.on).toBe(true);
    const s = createGameState(sampleSave(), 7);
    const after = step({ ...s, runtime: { ...s.runtime, today: DAY } }, STEP).state;
    expect(after.runtime.dev).toBeUndefined();
    expect(after.save.daily?.day).toBe(DAY);
  });
});

describe('PC 시계를 미래로 잘못 맞췄다 고침 (코드 리뷰어 #59)', () => {
  it('목표 날이 2일 넘게 앞이면 오늘 것으로 다시 · 하루 앞 (시간대 차이) 은 그대로', () => {
    expect(dayFarAhead('2027-01-01', DAY)).toBe(true);
    expect(dayFarAhead(DAY, DAY)).toBe(false);
    expect(dayFarAhead('2026-10-23', '2026-10-22')).toBe(false);
    expect(dayFarAhead('이상함', DAY)).toBe(false);
    const s = createGameState(sampleSave(), 7);
    const future = { ...s, save: { ...s.save, daily: { day: '2027-01-01', goals: dailyFor('2027-01-01').goals } }, runtime: { ...s.runtime, today: DAY } };
    expect(step(future, STEP).state.save.daily?.day).toBe(DAY);
  });
});
