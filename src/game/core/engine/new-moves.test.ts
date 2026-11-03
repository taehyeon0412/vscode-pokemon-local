import { describe, expect, it } from 'vitest';
import { sampleMonster, sampleSave, viaJson } from '../../../test/fixtures/save';
import { evolve, learnMove, levelUpChoices, markNewMoves } from '../rules/growth';
import { expForLevel } from '../rules/stats';
import { validateSave, type Monster, type Save } from '../save';
import { applyBattleResult, startBattle, type BattleState } from './battle';
import { applyInput } from './play';
import { battleRewards, resolveEvolve, resolveLearn } from './rewards';
import { Rng } from './rng';
import { createGameState, readRuntime } from './state';

const TACKLE = 33;
const VINE_WHIP = 22;
const RAZOR_LEAF = 75;
const SOLAR_BEAM = 76;
const FULL = [TACKLE, 52, 55, 84].map((moveId) => ({ moveId, pp: 5 }));

const bulba = (o: Partial<Monster> = {}) => sampleMonster({ level: 5, exp: expForLevel(5), moves: [{ moveId: TACKLE, pp: 35 }], ...o });
const withM1 = (m: Monster, o: Partial<Save> = {}): Save => ({ ...sampleSave(), monsters: { ...sampleSave().monsters, m1: m }, ...o });

describe('새 기술 표시 newMoves (#144 — S18 NEW 칩)', () => {
  it('지금 칸에 있는 id 만 · 같은 id 한 번 · 비면 칸을 지움 · 바뀐 게 없으면 같은 객체', () => {
    const m = bulba({ moves: [{ moveId: TACKLE, pp: 35 }, { moveId: VINE_WHIP, pp: 25 }] });
    expect(markNewMoves(m, [VINE_WHIP, VINE_WHIP, RAZOR_LEAF]).newMoves).toEqual([VINE_WHIP]);
    expect(markNewMoves({ ...m, newMoves: [TACKLE] }, [VINE_WHIP]).newMoves).toEqual([TACKLE, VINE_WHIP]);
    expect('newMoves' in markNewMoves({ ...m, newMoves: [RAZOR_LEAF] }, [])).toBe(false);
    expect(markNewMoves(m, [])).toBe(m);
  });

  it('레벨업 빈칸에 바로 배움 → 표시 · 4칸이라 고르기로 남으면 아직 없음', () => {
    expect(levelUpChoices(bulba({ level: 9 }), 8, 9, new Rng(1)).monster.newMoves).toEqual([VINE_WHIP]);
    const full = levelUpChoices(bulba({ level: 9, moves: FULL }), 8, 9, new Rng(1));
    expect(full.choices).toHaveLength(1);
    expect(full.monster.newMoves).toBeUndefined();
  });

  it('S23 배우기 — 빈칸 · 바꾼 칸은 표시 · 바뀐 옛 기술의 표시는 빠짐 · 배우지 않기는 그대로', () => {
    expect(learnMove(bulba(), VINE_WHIP, null).newMoves).toEqual([VINE_WHIP]);
    const m = bulba({ moves: FULL, newMoves: [52, 84] });
    expect(learnMove(m, VINE_WHIP, 1).newMoves).toEqual([84, VINE_WHIP]);
    expect(learnMove(m, VINE_WHIP, null)).toBe(m);
    const save = withM1(sampleMonster({ moves: FULL, level: 16 }), { pendingChoices: [{ kind: 'learn', uid: 'm1', moveId: VINE_WHIP }] });
    expect(resolveLearn(save, 0).monsters.m1!.newMoves).toEqual([VINE_WHIP]);
  });

  it('진화 — 새로 생긴 기술은 표시 · 남긴 기술의 표시는 그대로 · 버린 기술의 표시는 빠짐', () => {
    const m = sampleMonster({ moves: FULL, level: 16, newMoves: [52, 84] });
    const e = evolve(m, 2, [RAZOR_LEAF, SOLAR_BEAM], [TACKLE, 52]);
    expect(e.moves.map((s) => s.moveId)).toEqual([TACKLE, 52, RAZOR_LEAF, SOLAR_BEAM]);
    expect(e.newMoves).toEqual([52, RAZOR_LEAF, SOLAR_BEAM]);
    // 이미 아는 기술을 진화 기술로 받으면 새로 안 셈 (keepCount 와 같은 기준)
    expect(evolve(sampleMonster({ moves: FULL.slice(0, 2), level: 16 }), 2, [TACKLE], [TACKLE, 52]).newMoves).toBeUndefined();
    const save = withM1(sampleMonster({ moves: FULL, level: 16 }), { pendingChoices: [{ kind: 'evolve', uid: 'm1', to: 2, newMoves: [RAZOR_LEAF, SOLAR_BEAM], level: 16, item: null }] });
    expect(resolveEvolve(save, [TACKLE, 52], new Rng(1)).monsters.m1!.newMoves).toEqual([RAZOR_LEAF, SOLAR_BEAM]);
  });

  it('전투 끝 — 돌아온 칸의 표시는 남고 · 칸에 없는 표시는 빠짐 (코드 리뷰어)', () => {
    const save = withM1(bulba({ moves: [{ moveId: TACKLE, pp: 35 }, { moveId: VINE_WHIP, pp: 25 }], newMoves: [VINE_WHIP] }));
    const b = startBattle(save, sampleMonster({ uid: 'w', species: 16, form: 'pidgey', level: 4 }), 'normal');
    expect(applyBattleResult(save, b).monsters.m1!.newMoves).toEqual([VINE_WHIP]);
    const moved: BattleState = { ...b, me: { ...b.me, moves: [{ moveId: TACKLE, pp: 30 }] } };
    expect('newMoves' in applyBattleResult(save, moved).monsters.m1!).toBe(false);
  });

  it('moves-seen — 그 포켓몬의 표시만 지움 · 없거나 이미 비면 상태 그대로 (저장 안 바뀜)', () => {
    const save = withM1(bulba({ moves: [{ moveId: TACKLE, pp: 35 }, { moveId: VINE_WHIP, pp: 25 }], newMoves: [VINE_WHIP] }));
    const s = createGameState(save, 1);
    const seen = applyInput(s, { kind: 'moves-seen', uid: 'm1' });
    expect('newMoves' in seen.save.monsters.m1!).toBe(false);
    expect(seen.save.monsters.m2).toBe(save.monsters.m2);
    expect(applyInput(seen, { kind: 'moves-seen', uid: 'm1' })).toBe(seen);
    expect(applyInput(s, { kind: 'moves-seen', uid: 'nope' })).toBe(s);
  });

  it('세이브 — 맞는 표시는 남고 · 칸에 없는 · 겹친 · 숫자 아닌 것은 빠짐 · 목록이 아니면 없음 · 옛 세이브 (칸 없음) 는 고칠 것 없음', () => {
    const moves = [{ moveId: TACKLE, pp: 35 }, { moveId: VINE_WHIP, pp: 25 }];
    const read = (newMoves: unknown) => {
      const r = validateSave(viaJson({ ...withM1(bulba({ moves })), monsters: { ...withM1(bulba({ moves })).monsters, m1: { ...bulba({ moves }), newMoves } } }));
      if (!r.ok) throw new Error(r.reason);
      return r;
    };
    const good = read([VINE_WHIP]);
    expect(good.save.monsters.m1!.newMoves).toEqual([VINE_WHIP]);
    expect(good.problems).toEqual([]);
    const bad = read([VINE_WHIP, VINE_WHIP, RAZOR_LEAF, 'x', 1.5, TACKLE]);
    expect(bad.save.monsters.m1!.newMoves).toEqual([VINE_WHIP, TACKLE]);
    expect(bad.problems.length).toBeGreaterThan(0);
    expect('newMoves' in read([RAZOR_LEAF]).save.monsters.m1!).toBe(false);
    expect('newMoves' in read('x').save.monsters.m1!).toBe(false);
    const old = validateSave(viaJson(withM1(bulba({ moves }))));
    expect(old.ok && old.problems).toEqual([]);
    expect(old.ok && 'newMoves' in old.save.monsters.m1!).toBe(false);
  });

  it('결과 상자 — 바로 배운 줄에 uid · 웹뷰와 주고받아도 남음 · 옛 줄 (uid 없음) 도 읽힘', () => {
    const save = withM1(bulba({ level: 8, exp: expForLevel(9) - 1 }));
    const b: BattleState = { ...startBattle(save, sampleMonster({ uid: 'w', species: 16, form: 'pidgey', level: 4 }), 'normal'), phase: 'over', result: 'win' };
    const r = battleRewards(save, { ...b, foe: { ...b.foe, hp: 0 } }, null, 'forest-1', new Rng(1));
    expect(r.summary.learned).toEqual([{ name: '이상해씨', move: '덩굴채찍', uid: 'm1' }]);
    expect(r.save.monsters.m1!.newMoves).toEqual([VINE_WHIP]);
    const rt = { ...createGameState(r.save, 1).runtime, stage: { phase: 'result' as const, summary: r.summary, ms: 0 }, stageId: 'forest-1' as const };
    const back = readRuntime(viaJson(rt), 1).stage;
    expect(back?.phase === 'result' && back.summary.learned).toEqual([{ name: '이상해씨', move: '덩굴채찍', uid: 'm1' }]);
    const old = { ...rt, stage: { ...rt.stage, summary: { ...r.summary, learned: [{ name: '이상해씨', move: '덩굴채찍' }] } } };
    const oldBack = readRuntime(viaJson(old), 1).stage;
    expect(oldBack?.phase === 'result' && oldBack.summary.learned).toEqual([{ name: '이상해씨', move: '덩굴채찍' }]);
  });
});
