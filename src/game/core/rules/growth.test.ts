import { describe, expect, it } from 'vitest';
import { fixedRng } from '../../../test/fixtures/rng';
import { sampleMonster } from '../../../test/fixtures/save';
import { BALANCE } from '../balance';
import { Rng } from '../engine/rng';
import { evolutionsOf, speciesOf } from '../../data';
import { addExp, evolutionLevel, evolutionMoves, evolve, evolvedForm, expGain, keepCount, learnMove, levelUpChoices, movesLearnedAt, pickEvolution } from './growth';
import { expForLevel, maxHp } from './stats';

const TACKLE = 33;
const VINE_WHIP = 22;
const RAZOR_LEAF = 75;
const SOLAR_BEAM = 76;

const bulba = (o = {}) => sampleMonster({ level: 5, exp: expForLevel(5), moves: [{ moveId: TACKLE, pp: 35 }], ...o });
const maxOf = (m: ReturnType<typeof bulba>) => maxHp(speciesOf(m.species)!.base, m.ivs, m.points, m.level);

describe('경험치 (4장)', () => {
  it('상대 기본 경험치 × 상대 레벨 / 7 · 팀 나머지 절반 · 상대가 5레벨 이상 낮으면 절반 · 트레이너 1.5배', () => {
    const pidgey = { species: 16, level: 4 };
    const base = Math.floor((speciesOf(16)!.baseExp * 4) / 7);
    expect(expGain(pidgey, 5)).toBe(base);
    expect(expGain(pidgey, 5, { share: true })).toBe(Math.floor((speciesOf(16)!.baseExp * 4) / 7 / 2));
    expect(expGain(pidgey, 9)).toBe(Math.floor(((speciesOf(16)!.baseExp * 4) / 7) * 0.5));
    expect(expGain(pidgey, 5, { trainer: true })).toBe(Math.floor(((speciesOf(16)!.baseExp * 4) / 7) * 1.5));
  });

  it('레벨업: 레벨마다 포인트 자동 2 + 고르는 2 · 최대 HP 가 는 만큼 HP 도', () => {
    const m = bulba({ hp: 15 });
    const up = addExp(m, expForLevel(7) - m.exp, new Rng(1));
    expect(up.level).toBe(7);
    const autoSum = Object.values(up.points).reduce((a, b) => a + b, 0) - Object.values(m.points).reduce((a, b) => a + b, 0);
    expect(autoSum).toBe(2 * BALANCE.pointsAutoPerLevel);
    expect(up.unspentPoints).toBe(m.unspentPoints + 2 * BALANCE.pointsFreePerLevel);
    expect(up.hp).toBe(15 + (maxOf(up) - maxOf(m)));
    expect(m.level).toBe(5); // 받은 것은 그대로
  });

  it('쓰러진 포켓몬은 HP 0 그대로 · 상한 100', () => {
    expect(addExp(bulba({ hp: 0 }), 5000, new Rng(1)).hp).toBe(0);
    expect(addExp(bulba(), 1e9, new Rng(1)).level).toBe(BALANCE.maxLevel);
  });
});

describe('새 기술 (S23)', () => {
  it('그 레벨에 배우는 기술 · 빈칸이 있으면 바로 · 4칸이면 고르기', () => {
    expect(movesLearnedAt(1, 9).map((m) => m.id)).toEqual([VINE_WHIP]);
    const roomy = levelUpChoices(bulba({ level: 9 }), 8, 9, new Rng(1));
    expect(roomy.learned).toEqual([VINE_WHIP]);
    expect(roomy.monster.moves.map((s) => s.moveId)).toEqual([TACKLE, VINE_WHIP]);
    const fullMoves = [{ moveId: TACKLE, pp: 35 }, { moveId: 52, pp: 25 }, { moveId: 55, pp: 25 }, { moveId: 84, pp: 30 }];
    const fullUp = levelUpChoices(bulba({ level: 9, moves: fullMoves }), 8, 9, new Rng(1));
    expect(fullUp.learned).toEqual([]);
    expect(fullUp.choices).toEqual([{ kind: 'learn', uid: 'm1', moveId: VINE_WHIP }]);
  });

  it('바꿀 칸을 고르거나 배우지 않기', () => {
    const fullMoves = [{ moveId: TACKLE, pp: 3 }, { moveId: 52, pp: 25 }, { moveId: 55, pp: 25 }, { moveId: 84, pp: 30 }];
    const m = bulba({ moves: fullMoves });
    expect(learnMove(m, VINE_WHIP, 0).moves[0]).toEqual({ moveId: VINE_WHIP, pp: 25 });
    expect(learnMove(m, VINE_WHIP, null)).toBe(m);
    expect(learnMove(bulba(), VINE_WHIP, null).moves.map((s) => s.moveId)).toEqual([TACKLE, VINE_WHIP]);
  });
});

describe('진화 (mvp-spec 3.6 · S22)', () => {
  it('레벨 진화: 그 레벨이 되면 진화 고르기를 남기고 멈춤 (그 뒤 레벨은 고를 때)', () => {
    const r = levelUpChoices(bulba({ level: 17, moves: [{ moveId: TACKLE, pp: 35 }, { moveId: VINE_WHIP, pp: 25 }] }), 15, 17, new Rng(1));
    const evo = r.choices.find((c) => c.kind === 'evolve');
    expect(evo).toMatchObject({ kind: 'evolve', to: 2, level: 16 });
  });

  it('진화 기술 = 진화한 포켓몬의 대표 기술 먼저 (이미 아는 것 · 변화 기술 빼고) · 최대 2개', () => {
    const moves = evolutionMoves(bulba({ level: 16, moves: [{ moveId: TACKLE, pp: 35 }] }), 2);
    expect(moves).toEqual([RAZOR_LEAF, SOLAR_BEAM]);
    expect(evolutionMoves(bulba({ level: 16, moves: [{ moveId: RAZOR_LEAF, pp: 25 }] }), 2)).not.toContain(RAZOR_LEAF);
  });

  it('남길 기술 수: 4개면 2 · 2개 이하면 다 · 3개면 2 · 새 기술이 1개뿐이면 3', () => {
    const four = bulba({ moves: [33, 52, 55, 84].map((moveId) => ({ moveId, pp: 5 })) });
    expect(keepCount(four, [RAZOR_LEAF, SOLAR_BEAM])).toBe(2);
    expect(keepCount(four, [RAZOR_LEAF])).toBe(3);
    expect(keepCount(bulba({ moves: [33, 52].map((moveId) => ({ moveId, pp: 5 })) }), [RAZOR_LEAF, SOLAR_BEAM])).toBe(2);
    expect(keepCount(bulba({ moves: [33, 52, 55].map((moveId) => ({ moveId, pp: 5 })) }), [RAZOR_LEAF, SOLAR_BEAM])).toBe(2);
  });

  it('진화하면 종 · 그림 · 기술 (남긴 2 + 새 2) · 최대 HP 가 는 만큼 HP', () => {
    const m = bulba({ level: 16, hp: 30, moves: [33, 52, 55, 84].map((moveId) => ({ moveId, pp: 5 })) });
    const e = evolve(m, 2, [RAZOR_LEAF, SOLAR_BEAM], [52, 84]);
    expect([e.species, e.form]).toEqual([2, 'ivysaur']);
    expect(e.moves.map((s) => s.moveId)).toEqual([52, 84, RAZOR_LEAF, SOLAR_BEAM]);
    expect(e.hp).toBe(30 + (maxOf(e) - maxOf(m)));
  });

  it('조건: 친밀도 = Lv 20 · 밤 · 돌 · 교환은 레벨업으로 안 됨 · 장소 같은 특수 조건 = 앞 진화 레벨 + 10 (없으면 Lv 30)', () => {
    const eevee = sampleMonster({ species: 133, form: 'eevee' });
    const evos = evolutionsOf(133);
    const lv = (to: number) => evolutionLevel(eevee, evos.find((e) => e.to === to)!);
    expect(lv(196)).toBe(BALANCE.friendshipLevel); // 에브이 (낮)
    expect(lv(197)).toBeNull(); // 블래키 (밤 — MVP 는 늘 낮)
    expect(lv(134)).toBeNull(); // 샤미드 (물의돌)
    expect(lv(470)).toBe(BALANCE.otherEvolutionDefault); // 리피아 (장소)
  });

  it('성별 갈래: 그림이 암컷 · 수컷이면 맞는 쪽만 (세꿀버리) · 성별 없는 그림은 반반 (도롱충이) · 확률 갈래 (개무소)', () => {
    expect(pickEvolution(sampleMonster({ species: 415, form: 'combee_male', level: 21 }), 21, new Rng(1))).toBeNull();
    expect(pickEvolution(sampleMonster({ species: 415, form: 'combee_female', level: 21 }), 21, new Rng(1))).toBe(416);
    const burmy = sampleMonster({ species: 412, form: 'burmy_sandy', level: 20 });
    expect([413, 414]).toContain(pickEvolution(burmy, 20, new Rng(3)));
    expect(evolvedForm('burmy_sandy', 412, 413)).toBe('wormadam_sandy');
    expect(evolvedForm('burmy_sandy', 412, 414)).toBe('mothim');
    expect(evolvedForm('pikachu_female', 25, 26)).toBe('raichu');
    const wurmple = sampleMonster({ species: 265, form: 'wurmple', level: 7 });
    expect(pickEvolution(wurmple, 7, fixedRng(0.1))).toBe(266);
    expect(pickEvolution(wurmple, 7, fixedRng(0.9))).toBe(268);
  });
});
