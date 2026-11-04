/** 전투 기술 메뉴 NEW (#146 · ideas 1692) — 세이브 untried: 배울 때 넣고 · 손 · 자동 · 3:3 어디서든 한 번 나가면 지움 · S18 을 봐도 남음 · 첫 메뉴 N 은 기술 판을 열면 그 전투 동안 끔 (#147 · ideas 2709) */
import { describe, expect, it } from 'vitest';
import { sampleMonster, sampleSave, viaJson } from '../../../test/fixtures/save';
import { BALANCE, TIMING } from '../balance';
import { evolve, learnMove, levelUpChoices, markNewMoves } from '../rules/growth';
import { expForLevel } from '../rules/stats';
import { validateSave, type Monster, type Save } from '../save';
import { applyBattleResult, battleInput, battleMenuNew, battleStep, battleUntried, readBattle, startBattle, type BattleState } from './battle';
import { applyInput } from './play';
import { resolveEvolve, resolveLearn } from './rewards';
import { Rng } from './rng';
import { createGameState } from './state';
import { applyTeamResult, readTeam, startTeamBattle, TEAM_BASIC, teamStep, type TeamBattle } from './team';

const TACKLE = 33;
const VINE_WHIP = 22;
const RAZOR_LEAF = 75;
const SOLAR_BEAM = 76;
const TWO = [{ moveId: TACKLE, pp: 35 }, { moveId: VINE_WHIP, pp: 25 }];
const FULL = [TACKLE, 52, 55, 84].map((moveId) => ({ moveId, pp: 5 }));

const bulba = (o: Partial<Monster> = {}) => sampleMonster({ level: 5, exp: expForLevel(5), moves: [{ moveId: TACKLE, pp: 35 }], ...o });
const withM1 = (m: Monster, o: Partial<Save> = {}): Save => ({ ...sampleSave(), monsters: { ...sampleSave().monsters, m1: m }, ...o });
const wild = (o: Partial<Monster> = {}) => sampleMonster({ uid: 'w', species: 16, form: 'pidgey', level: 4, ...o });
const myTurn = (b: BattleState): BattleState => ({ ...b, phase: 'choose', me: { ...b.me, gauge: 1 } });
/** 내 차례에 기술을 골라 연출이 끝날 때까지 (맞는 때에 적힘) */
function useMove(save: Save, b0: BattleState, moveId: number): { started: BattleState; done: BattleState } {
  const rng = new Rng(1);
  const started = battleInput(myTurn(b0), save, { kind: 'act', action: { kind: 'move', moveId } }, rng);
  let done = started;
  for (let i = 0; i < 200 && done.phase === 'anim'; i++) done = battleStep(done, save, TIMING.simStepMs, rng, { auto: false });
  return { started, done };
}

describe('세이브 칸 untried — 배울 때 넣음', () => {
  it('배우면 S18 NEW · 메뉴 NEW 둘 다 · 나간 기술은 메뉴 NEW 에서만 빠짐 · 칸에 없는 id 는 둘 다 빠짐 · 바뀐 게 없으면 같은 객체', () => {
    const m = bulba({ moves: TWO });
    const learned = markNewMoves(m, [VINE_WHIP]);
    expect([learned.newMoves, learned.untried]).toEqual([[VINE_WHIP], [VINE_WHIP]]);
    const used = markNewMoves(learned, [], [VINE_WHIP]);
    expect(used.newMoves).toEqual([VINE_WHIP]);
    expect('untried' in used).toBe(false);
    expect(markNewMoves(used, [], [VINE_WHIP])).toBe(used);
    expect(markNewMoves(learned, [], [TACKLE])).toBe(learned);
    const stale = markNewMoves({ ...m, untried: [RAZOR_LEAF] }, []);
    expect('untried' in stale || 'newMoves' in stale).toBe(false);
  });

  it('레벨업 빈칸 · S23 (빈칸 · 바꾼 칸) · 진화 — 새로 생긴 기술이 untried · 바뀐 옛 기술은 빠짐 · 4칸이라 고르기로 남으면 아직 없음', () => {
    expect(levelUpChoices(bulba({ level: 9 }), 8, 9, new Rng(1)).monster.untried).toEqual([VINE_WHIP]);
    expect(levelUpChoices(bulba({ level: 9, moves: FULL }), 8, 9, new Rng(1)).monster.untried).toBeUndefined();
    expect(learnMove(bulba(), VINE_WHIP, null).untried).toEqual([VINE_WHIP]);
    expect(learnMove(bulba({ moves: FULL, untried: [52, 84] }), VINE_WHIP, 1).untried).toEqual([84, VINE_WHIP]);
    const s23 = withM1(sampleMonster({ moves: FULL, level: 16 }), { pendingChoices: [{ kind: 'learn', uid: 'm1', moveId: VINE_WHIP }] });
    expect(resolveLearn(s23, 0).monsters.m1!.untried).toEqual([VINE_WHIP]);
    const e = evolve(sampleMonster({ moves: FULL, level: 16, untried: [52, 84] }), 2, [RAZOR_LEAF, SOLAR_BEAM], [TACKLE, 52]);
    expect(e.untried).toEqual([52, RAZOR_LEAF, SOLAR_BEAM]);
    const evo = withM1(sampleMonster({ moves: FULL, level: 16 }), { pendingChoices: [{ kind: 'evolve', uid: 'm1', to: 2, newMoves: [RAZOR_LEAF, SOLAR_BEAM], level: 16, item: null }] });
    expect(resolveEvolve(evo, [TACKLE, 52], new Rng(1)).monsters.m1!.untried).toEqual([RAZOR_LEAF, SOLAR_BEAM]);
  });

  it('S18 을 봐도 (moves-seen) 남음 — newMoves 만 지움', () => {
    const save = withM1(bulba({ moves: TWO, newMoves: [VINE_WHIP], untried: [VINE_WHIP] }));
    const seen = applyInput(createGameState(save, 1), { kind: 'moves-seen', uid: 'm1' });
    expect('newMoves' in seen.save.monsters.m1!).toBe(false);
    expect(seen.save.monsters.m1!.untried).toEqual([VINE_WHIP]);
  });

  it('세이브 읽기 — 맞는 것은 남고 · 칸에 없는 · 겹친 · 숫자 아닌 것은 빠짐 · 목록이 아니면 없음 · 옛 세이브 (칸 없음) 는 고칠 것 없음', () => {
    const read = (untried: unknown) => {
      const r = validateSave(viaJson(withM1({ ...bulba({ moves: TWO }), untried } as Monster)));
      if (!r.ok) throw new Error(r.reason);
      return r;
    };
    const good = read([VINE_WHIP]);
    expect([good.save.monsters.m1!.untried, good.problems]).toEqual([[VINE_WHIP], []]);
    const bad = read([VINE_WHIP, VINE_WHIP, RAZOR_LEAF, 'x', 1.5, null, TACKLE]);
    expect(bad.save.monsters.m1!.untried).toEqual([VINE_WHIP, TACKLE]);
    expect(bad.problems.length).toBeGreaterThan(0);
    expect('untried' in read([RAZOR_LEAF]).save.monsters.m1!).toBe(false);
    expect('untried' in read({ 0: VINE_WHIP }).save.monsters.m1!).toBe(false);
    const old = validateSave(viaJson(withM1(bulba({ moves: TWO }))));
    expect(old.ok && old.problems).toEqual([]);
    expect(old.ok && 'untried' in old.save.monsters.m1!).toBe(false);
  });
});

describe('1:1 — 손 · 자동 어디서든 한 번 나가면 지움', () => {
  it('손으로 쓴 기술 — 맞는 때에 적혀 메뉴 NEW 가 꺼지고 · 끝나면 세이브에서 빠짐 · 안 쓴 것은 남음 · 시작만 하고 끼어들기로 취소되면 안 쓴 것 (코드 리뷰어)', () => {
    const save = withM1(bulba({ moves: [...TWO, { moveId: RAZOR_LEAF, pp: 25 }], untried: [VINE_WHIP, RAZOR_LEAF] }));
    const b0 = startBattle(save, wild({ hp: 999 }), 'normal');
    expect(battleUntried(b0, save)).toEqual([VINE_WHIP, RAZOR_LEAF]);
    const { started, done: b } = useMove(save, b0, VINE_WHIP);
    expect(started.anim?.action).toEqual({ kind: 'move', moveId: VINE_WHIP });
    expect(started.tried).toBeUndefined();
    expect(applyBattleResult(save, started).monsters.m1!.untried).toEqual([VINE_WHIP, RAZOR_LEAF]);
    expect(b.phase).not.toBe('anim');
    expect(b.tried).toEqual({ m1: [VINE_WHIP] });
    expect(battleUntried(b, save)).toEqual([RAZOR_LEAF]);
    expect(applyBattleResult(save, b).monsters.m1!.untried).toEqual([RAZOR_LEAF]);
    // 공격 · 방어는 기술이 아님
    const atk = battleInput(myTurn(b0), save, { kind: 'act', action: { kind: 'attack' } }, new Rng(1));
    expect(atk.tried).toBeUndefined();
    expect(applyBattleResult(save, atk).monsters.m1).toEqual(save.monsters.m1);
  });

  it('자동 전투 — 내가 낸 기술만 적힘 (상대가 같은 기술을 써도 안 지움) · 교체로 빠진 포켓몬 것도 끝에 반영', () => {
    const m1 = bulba({ level: 20, moves: TWO, untried: [VINE_WHIP], hp: 999 });
    const save = withM1(m1);
    // 상대 = 꼬부기 (풀에 약함 — 자동이 덩굴채찍을 고름) · 상대도 덩굴채찍
    let b = startBattle(save, wild({ species: 7, form: 'squirtle', level: 20, moves: [{ moveId: VINE_WHIP, pp: 25 }], hp: 999 }), 'normal');
    const rng = new Rng(3);
    const mine: number[] = [];
    let foeUsed = false;
    for (let t = 0; t < 60_000 && b.phase !== 'over'; t += TIMING.simStepMs) {
      const prev = b.anim;
      b = battleStep(b, save, TIMING.simStepMs, rng, { auto: true });
      if (b.anim && b.anim !== prev && b.anim.action.kind === 'move') {
        if (b.anim.side === 'me' && !mine.includes(b.anim.action.moveId)) mine.push(b.anim.action.moveId);
        if (b.anim.side === 'foe') foeUsed = true;
      }
      if (b.tried?.m1?.includes(VINE_WHIP) && foeUsed) break;
    }
    expect(foeUsed).toBe(true);
    expect(Object.keys(b.tried ?? {})).toEqual(['m1']);
    expect(b.tried!.m1).toContain(VINE_WHIP);
    // 적힌 것은 모두 내가 낸 기술 (마지막에 낸 것은 아직 연출 중일 수 있음)
    expect(b.tried!.m1!.every((id) => mine.includes(id))).toBe(true);
    expect('untried' in applyBattleResult(save, b).monsters.m1!).toBe(false);
    // 교체로 빠진 포켓몬 — bench 로 돌아와도 그 uid 의 기록으로 지움
    const benched: BattleState = { ...b, me: { ...b.me, uid: 'm2' }, bench: { m1: { hp: 10, moves: TWO, status: null } }, tried: { m1: [VINE_WHIP] } };
    expect('untried' in applyBattleResult(save, benched).monsters.m1!).toBe(false);
  });

  it('웹뷰와 주고받기 — 기록이 그대로 · 옛 상태 (칸 없음) 도 읽힘 · 이상한 기록이면 그 전투를 처음부터 (null)', () => {
    const save = withM1(bulba({ moves: TWO, untried: [VINE_WHIP] }));
    const b0 = startBattle(save, wild({ hp: 999 }), 'normal');
    const b = useMove(save, b0, VINE_WHIP).done;
    expect(readBattle(viaJson(b))?.tried).toEqual({ m1: [VINE_WHIP] });
    expect(readBattle(viaJson(b0))).not.toBeNull();
    const many = Object.fromEntries(Array.from({ length: BALANCE.partySize + 1 }, (_, i) => [`m${i}`, [TACKLE]]));
    for (const tried of ['x', [VINE_WHIP], { m1: VINE_WHIP }, { m1: [] }, { m1: [0] }, { m1: [1.5] }, { m1: [22, 22] }, { m1: [1, 2, 3, 4, 5] }, many]) {
      expect(readBattle(viaJson({ ...b, tried })), JSON.stringify(tried)).toBeNull();
    }
  });
});

describe('3:3 — PP 가 안 닳아도 쏜 기술을 적어 지움', () => {
  /** 내 셋: 이상해씨 (몸통박치기 · 덩굴채찍 — 덩굴채찍 NEW) · 파이리 (불꽃세례 NEW) · 1 공격만 (기술 없음) */
  function team(): Save {
    const ms = [
      sampleMonster({ uid: 'm1', level: 12, moves: TWO, untried: [VINE_WHIP] }),
      sampleMonster({ uid: 'm2', level: 12, species: 4, form: 'charmander', moves: [{ moveId: 52, pp: 25 }], untried: [52] }),
      sampleMonster({ uid: 'm3', level: 12, species: 7, form: 'squirtle', moves: [] }),
    ];
    return sampleSave({ monsters: Object.fromEntries(ms.map((m) => [m.uid, { ...m, hp: 999 }])), party: ms.map((m) => m.uid) });
  }
  /** 상대 = 물 셋 (풀에 약함 — 자동이 덩굴채찍을 고름) · 상대도 불꽃세례 */
  const foes = (): Monster[] => [7, 129, 7].map((dex, i) => sampleMonster({ uid: `f${i}`, species: dex, form: ['squirtle', 'magikarp', 'squirtle'][i]!, level: 10, moves: [{ moveId: 52, pp: 35 }] }));

  it('자동으로 쏜 기술이 적히고 (1 공격 · 상대 기술은 안 적힘) · 끝나면 세이브 untried 에서 빠짐', () => {
    const save = team();
    let b: TeamBattle = startTeamBattle(save, foes(), 'trainer', '상대', ['m1', 'm2', 'm3']);
    const rng = new Rng(2);
    // 1 공격 (m3) · 상대 기술 (같은 불꽃세례) 이 실제로 나간 뒤까지 — 그 둘이 안 적히는지 보려고
    let seen = 0;
    let basic = false;
    let foeShot = false;
    for (let t = 0; t < 30_000 && b.phase !== 'over' && !(b.tried?.m1 && b.tried.m2 && basic && foeShot); t += TIMING.simStepMs) {
      b = teamStep(b, TIMING.simStepMs, rng, { auto: true, away: false });
      for (const e of b.log.filter((x) => x.id > seen)) {
        if (e.t === 'shoot' && e.side === 'me' && e.moveId === TEAM_BASIC) basic = true;
        if (e.t === 'shoot' && e.side === 'foe') foeShot = true;
      }
      seen = b.logSeq;
    }
    expect([basic, foeShot]).toEqual([true, true]);
    expect(b.tried?.m2).toEqual([52]);
    expect(b.tried?.m1).toContain(VINE_WHIP);
    expect(b.tried?.m3).toBeUndefined();
    expect(Object.values(b.tried ?? {}).flat()).not.toContain(TEAM_BASIC);
    expect(Object.keys(b.tried ?? {}).every((uid) => ['m1', 'm2'].includes(uid))).toBe(true);
    const after = applyTeamResult(save, b);
    expect('untried' in after.monsters.m2!).toBe(false);
    expect('untried' in after.monsters.m1!).toBe(false);
    // 기록 없는 판 (옛 상태) 은 그대로
    expect(applyTeamResult(save, { ...b, tried: undefined }).monsters.m2!.untried).toEqual([52]);
  });

  it('쏠 때가 아니라 닿을 때 적힘 — 날아가는 동안 (큰 연출이 거두거나 쏜 포켓몬이 쓰러지면 안 쓴 것) 은 아직 없음 (코드 리뷰어)', () => {
    let b: TeamBattle = startTeamBattle(team(), foes(), 'trainer', '상대', ['m1', 'm2', 'm3']);
    const rng = new Rng(2);
    let shot: { id: number; uid: string; moveId: number } | null = null;
    for (let t = 0; t < 30_000 && !shot; t += TIMING.simStepMs) {
      b = teamStep(b, TIMING.simStepMs, rng, { auto: false, away: false });
      const s = b.shots.find((x) => x.side === 'me' && x.moveId !== TEAM_BASIC && !x.hit);
      if (s) shot = { id: s.id, uid: b.me[s.from]!.uid, moveId: s.moveId };
    }
    expect(shot).not.toBeNull();
    expect(b.tried?.[shot!.uid] ?? []).not.toContain(shot!.moveId);
    for (let t = 0; t < 10_000 && b.shots.some((x) => x.id === shot!.id && !x.hit); t += TIMING.simStepMs) b = teamStep(b, TIMING.simStepMs, rng, { auto: false, away: false });
    expect(b.tried?.[shot!.uid]).toContain(shot!.moveId);
  });

  it('웹뷰와 주고받기 — 기록이 그대로 · 이 판에 없는 포켓몬 uid 면 null', () => {
    const b: TeamBattle = { ...startTeamBattle(team(), foes(), 'trainer', '상대', ['m1', 'm2', 'm3']), tried: { m2: [52] } };
    expect(readTeam(viaJson(b))?.tried).toEqual({ m2: [52] });
    expect(readTeam(viaJson({ ...b, tried: undefined }))).not.toBeNull();
    expect(readTeam(viaJson({ ...b, tried: { f0: [52] } }))).toBeNull();
    expect(readTeam(viaJson({ ...b, tried: { m2: ['52'] } }))).toBeNull();
  });
});

describe('첫 메뉴 3 기술 N — 기술 판을 열면 그 전투 동안 끔 (#147 · ideas 2709)', () => {
  const seen = (b: BattleState, save: Save) => battleInput(b, save, { kind: 'skills-seen' }, new Rng(1));
  /** 이상해씨 (덩굴채찍 NEW) · 파이리 (불꽃세례 NEW) */
  const pair = (): Save => {
    const s = withM1(bulba({ level: 20, moves: TWO, untried: [VINE_WHIP], hp: 999 }));
    const m2 = sampleMonster({ uid: 'm2', level: 20, species: 4, form: 'charmander', moves: [{ moveId: 52, pp: 25 }], untried: [52], hp: 999 });
    return { ...s, monsters: { ...s.monsters, m2 }, party: ['m1', 'm2'] };
  };
  /** 내 차례에 교체해 연출이 끝날 때까지 */
  function switchTo(save: Save, b0: BattleState, uid: string): BattleState {
    const rng = new Rng(1);
    let b = battleInput(myTurn(b0), save, { kind: 'act', action: { kind: 'switch', uid } }, rng);
    for (let i = 0; i < 400 && b.me.uid !== uid; i++) b = battleStep(b, save, TIMING.simStepMs, rng, { auto: false });
    return b;
  }

  it('판을 열면 첫 메뉴 N 만 꺼지고 기술 줄 N 은 남음 · 세이브는 그대로 · 같은 포켓몬 두 번 = 같은 상태 (다시 그리기 없음)', () => {
    const save = pair();
    const b0 = startBattle(save, wild({ hp: 999 }), 'normal');
    expect(battleMenuNew(b0, save)).toBe(true);
    const b = seen(b0, save);
    expect(b.skillsSeen).toEqual(['m1']);
    expect(battleMenuNew(b, save)).toBe(false);
    expect(battleUntried(b, save)).toEqual([VINE_WHIP]);
    expect(seen(b, save)).toBe(b);
    expect(applyBattleResult(save, b).monsters.m1!.untried).toEqual([VINE_WHIP]);
    // 게이지가 차는 동안 (3 = 미리 엶) 에도 받음
    expect(seen({ ...b0, phase: 'run' }, save).skillsSeen).toEqual(['m1']);
  });

  it('포켓몬마다 셈 — 교체로 나온 포켓몬은 다시 켬 · 돌아온 처음 포켓몬은 끈 채', () => {
    const save = pair();
    const b1 = seen(startBattle(save, wild({ level: 2, hp: 999 }), 'normal'), save);
    const b2 = switchTo(save, b1, 'm2');
    expect(b2.me.uid).toBe('m2');
    expect(battleMenuNew(b2, save)).toBe(true);
    const b3 = switchTo(save, seen(b2, save), 'm1');
    expect(b3.me.uid).toBe('m1');
    expect(b3.skillsSeen).toEqual(['m1', 'm2']);
    expect(battleMenuNew(b3, save)).toBe(false);
    expect(battleUntried(b3, save)).toEqual([VINE_WHIP]);
  });

  it('다음 전투에는 다시 (아직 안 쓴 새 기술이 있으면) · 다 쓰면 첫 메뉴 · 기술 줄 둘 다 없음', () => {
    const save = pair();
    const b0 = startBattle(save, wild({ hp: 999 }), 'normal');
    const after = applyBattleResult(save, seen(b0, save));
    const next = startBattle(after, wild({ hp: 999 }), 'normal');
    expect('skillsSeen' in next).toBe(false);
    expect(battleMenuNew(next, after)).toBe(true);
    const used = useMove(save, b0, VINE_WHIP).done;
    expect([battleMenuNew(used, save), battleUntried(used, save)]).toEqual([false, []]);
    const later = applyBattleResult(save, used);
    expect([battleMenuNew(startBattle(later, wild({ hp: 999 }), 'normal'), later), 'untried' in later.monsters.m1!]).toEqual([false, false]);
  });

  it('자동 — 판을 안 열어도 자동이 쓰면 둘 다 꺼짐 · 판을 열면 쓰기 전에도 첫 메뉴 N 만 꺼짐', () => {
    const save = pair();
    // 상대 = 꼬부기 (풀에 약함 — 자동이 덩굴채찍을 고름)
    const b0 = startBattle(save, wild({ species: 7, form: 'squirtle', level: 20, hp: 999 }), 'normal');
    let b = b0;
    const rng = new Rng(3);
    for (let t = 0; t < 60_000 && b.phase !== 'over' && !b.tried?.m1?.includes(VINE_WHIP); t += TIMING.simStepMs) {
      expect(battleMenuNew(b, save)).toBe(true);
      b = battleStep(b, save, TIMING.simStepMs, rng, { auto: true });
    }
    expect(b.tried?.m1).toContain(VINE_WHIP);
    expect([battleMenuNew(b, save), battleUntried(b, save)]).toEqual([false, []]);
    const opened = seen(battleStep(b0, save, TIMING.simStepMs, new Rng(3), { auto: true }), save);
    expect([battleMenuNew(opened, save), battleUntried(opened, save)]).toEqual([false, [VINE_WHIP]]);
  });

  it('3:3 — 기술 판이 없어 판을 지나도 다음 1:1 은 다시 · 3:3 에서 쏜 기술은 둘 다 없음', () => {
    const save = pair();
    const team = startTeamBattle(save, [sampleMonster({ uid: 'f0', species: 7, form: 'squirtle', level: 10 })], 'trainer', '상대', ['m1', 'm2']);
    expect('skillsSeen' in team).toBe(false);
    const idle = applyTeamResult(save, team);
    expect(battleMenuNew(startBattle(idle, wild({ hp: 999 }), 'normal'), idle)).toBe(true);
    const shot = applyTeamResult(save, { ...team, tried: { m1: [VINE_WHIP] } });
    const next = startBattle(shot, wild({ hp: 999 }), 'normal');
    expect([battleMenuNew(next, shot), battleUntried(next, shot)]).toEqual([false, []]);
  });

  it('웹뷰와 주고받기 — 다시 켜도 끈 채 · 옛 상태 (칸 없음) 도 읽힘 · 이상한 값이면 그 전투를 처음부터 (null)', () => {
    const save = pair();
    const b0 = startBattle(save, wild({ hp: 999 }), 'normal');
    const b = seen(b0, save);
    expect(readBattle(viaJson(b))?.skillsSeen).toEqual(['m1']);
    expect(readBattle(viaJson(b0))).not.toBeNull();
    const many = Array.from({ length: BALANCE.partySize + 1 }, (_, i) => `m${i}`);
    for (const skillsSeen of [5, 'm1', [1], ['m1', 'm1'], [null], { 0: 'm1' }, many]) {
      expect(readBattle(viaJson({ ...b, skillsSeen })), JSON.stringify(skillsSeen)).toBeNull();
    }
  });
});
