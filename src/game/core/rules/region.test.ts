import { describe, expect, it } from 'vitest';
import { BALANCE } from '../balance';
import { learnsetOf, moveOf, speciesOf } from '../../data';
import { STAGE_IDS } from '../save';
import { sampleSave, viaJson } from '../../../test/fixtures/save';
import { startTrainerBattle } from '../engine/battle';
import { nextStageOf, stageUnlocked } from '../engine/play';
import { battleRewards } from '../engine/rewards';
import { Rng } from '../engine/rng';
import { validateSave } from '../save';
import { createWild, devolveForLevel, learnsDamage, pickupAt, planWild, regionPool } from './encounter';
import { wildMoves } from './monster';
import { BEACH_REQUESTS, requestAt } from './request';
import { gymRoomOf, REGIONS, regionAceLevel, setRegionOrder, regionGymMoney, regionGymTeam, regionLevelBand, regionOf, regionOrder, stageBackground } from './region';
import { stageCode, stageLevelBand, trainerCount } from './stage';
import { GYM_LEADER, gymHint, leaderTeam, trainerInfo, trainerTeam } from './trainer';
import { rivalTeam } from './rival';
import { battleArtOf } from '../../data/people-battle';

describe('지역 표 (gdd 5.1 · 5.2 — orders #35)', () => {
  it('숲 줄 = 예전 값 그대로 — 스테이지 · 번호 · 레벨대 · 관장 · 트레이너 (보이는 것 · 숫자가 같음)', () => {
    expect(REGIONS.forest.stages.map((s) => s.id)).toEqual([...STAGE_IDS]);
    expect(STAGE_IDS.map(stageCode)).toEqual(['1-1', '1-2', '1-3']);
    for (const id of STAGE_IDS) expect(stageLevelBand(id)).toEqual(BALANCE.stageLevels[id as keyof typeof BALANCE.stageLevels]);
    expect(regionOrder('forest')).toBe(1);
    expect(regionGymTeam(REGIONS.forest, 1)).toEqual(BALANCE.gymTeam);
    expect(leaderTeam(REGIONS.forest).map((m) => [m.species, m.level])).toEqual(BALANCE.gymTeam.map(([d, l]) => [d, l]));
    expect(GYM_LEADER.name).toBe('관장 나래');
    expect(trainerInfo('forest-1', 0).name).toBe('반바지 꼬마 민수');
    expect(trainerInfo('forest-2', 0).name).toBe('짧은치마 서연');
    expect(regionOf('forest-3')).toMatchObject({ index: 2 });
  });

  it('몇 번째 지역 레벨표 — 표가 비면 에이스 15 + 6 × (k − 1) · 스테이지 g−8 ~ g−5 / g−5 ~ g−2 / g−3 ~ g (k = 1 은 숲 그대로)', () => {
    const tune = BALANCE.region as { aceTable: readonly number[] };
    const before = tune.aceTable;
    try {
      tune.aceTable = [];
      expect([1, 2, 3, 8].map(regionAceLevel)).toEqual([15, 21, 27, 57]);
      expect([0, 1, 2].map((i) => regionLevelBand(2, i))).toEqual([[13, 16], [16, 19], [18, 21]]);
      expect(regionLevelBand(1, 0, 'forest-1')).toEqual([2, 4]);
      // 셋 묶음 — 에이스 = g, 앞은 g−2 · g−1
      expect(regionGymTeam(REGIONS.forest, 2).map(([, lv]) => lv)).toEqual([19, 20, 21]);
    } finally {
      tune.aceTable = before;
    }
  });
});

describe('해변 한 벌 (gdd 5.3 — orders #37, 개발 모드 미리 보기 · 2번째 지역)', () => {
  it('스테이지 셋 · 2번째 지역 레벨 (T3 에이스 23 — 15 ~ 18 / 18 ~ 21 / 20 ~ 23) · 번호 2-1 · 다음 스테이지 · 열림', () => {
    expect(REGIONS.beach.stages.map((x) => x.name)).toEqual(['반짝 모래길', '갯바위 해안', '등대 곶']);
    expect(['beach-1', 'beach-2', 'beach-3'].map((id) => stageLevelBand(id as 'beach-1'))).toEqual([[15, 18], [18, 21], [20, 23]]);
    expect(stageCode('beach-1')).toBe('2-1');
    expect(nextStageOf('beach-1')).toBe('beach-2');
    expect(nextStageOf('beach-3')).toBe('gym');
    expect(nextStageOf('forest-3')).toBe('gym');
    const save = sampleSave();
    expect(stageUnlocked(save, 'beach-1')).toBe(false);
    // 연 지역 (4판 regions.order) 이어야 — 배지만으로는 안 열림 (세이브 검사와 같은 규칙 · orders #66)
    expect(stageUnlocked({ ...save, badges: ['forest'] }, 'beach-1')).toBe(false);
    expect(stageUnlocked({ ...save, badges: ['forest'], regions: { order: ['forest', 'beach'] } }, 'beach-1')).toBe(true);
  });

  it('스테이지마다 정한 종 (8 · 8 · 12) — 강한 1단계 · 드묾은 마지막 스테이지만 · 트레이너는 종족값 큰 것을 안 씀', () => {
    expect(regionPool('beach-1').common).toEqual([54, 118, 183, 194, 278, 422, 129, 418]);
    expect(regionPool('beach-2').common).toHaveLength(8);
    expect(regionPool('beach-3').common).toEqual([170, 456, 72, 86, 366, 318, 223, 60, 131, 594]);
    expect(regionPool('beach-3').rare).toEqual([349, 140]);
    // 앞 스테이지 드묾 = 얼음 · 전기 · 바위 2종 (물이 아님 — 스테이지 id 시드, 기획 답)
    for (const id of ['beach-1', 'beach-2'] as const) {
      const rare = regionPool(id).rare;
      expect(rare).toHaveLength(2);
      for (const d of rare) {
        const t = speciesOf(d)!.types;
        expect(t.some((x) => x === 'ice' || x === 'electric' || x === 'rock') && !t.includes('water')).toBe(true);
      }
    }
    for (let n = 0; n < 3; n++) for (const m of trainerTeam('beach-3', 77, n, 6, 3)) expect([131, 594]).not.toContain(m.species);
  });

  it('트레이너 9 · 부탁 5 · 관장 해솔 셋 묶음 (2번째 T3 = 쏘드라 21 · 별가사리 22 · 에이스 아쿠스타 23)', () => {
    expect(trainerInfo('beach-1', 0)).toMatchObject({ name: '튜브 꼬마 준호', look: 'frlg-tuber-m' });
    expect(REGIONS.beach.trainers).toHaveLength(9);
    expect(new Set(Array.from({ length: 5 }, (_, n) => requestAt(42, n, 'beach-2').id))).toEqual(new Set(BEACH_REQUESTS.map((r) => r.id)));
    expect(requestAt(42, 0, 'forest-1').id).toBe(requestAt(42, 0).id);
    expect(leaderTeam(REGIONS.beach).map((m) => [m.species, m.level])).toEqual([[116, 21], [120, 22], [121, 23]]);
    expect(regionGymTeam(REGIONS.beach, 5).map(([d]) => d)).toEqual([55, 131, 130]);
    expect(regionGymTeam(REGIONS.beach, 8).map(([d, lv]) => [d, lv])).toEqual([[99, 60], [171, 61], [350, 62]]);
    expect(gymHint({ ...sampleSave(), location: { screen: 'gym', region: 'beach' } }).text).toContain('관장 해솔은');
  });

  it('해변 야생 레벨은 그 스테이지 레벨대 (센 흔적 = 위끝 + 2) · 떨어진 돌은 물의 돌 · 가끔 진주 (gdd 5.3) · 돈은 레벨대 위끝 × 10 (orders #37 — 2번째 지역)', () => {
    for (const id of ['beach-1', 'beach-2', 'beach-3'] as const) {
      const [lo, hi] = stageLevelBand(id);
      for (let i = 0; i < 120; i++) {
        const p = planWild(id, 4242, { kind: 'wild', at: (i % 20) / 20, index: i });
        if (p.strong) expect(p.level).toBe(hi + BALANCE.strongLevelBonus);
        else expect(p.level >= lo && p.level <= hi).toBe(true);
      }
      const got = Array.from({ length: 400 }, (_, i) => pickupAt(id, 99, { kind: 'item', at: 0.5, index: i }));
      expect(new Set(got.filter((g) => g.item && !['poke-ball', 'potion'].includes(g.item)).map((g) => g.item))).toEqual(new Set(['water-stone', 'pearl']));
      expect(new Set(got.filter((g) => g.money).map((g) => g.money))).toEqual(new Set([hi * BALANCE.pickupMoneyPerLevel]));
    }
  });

  it('숲 목록 (gdd 5.4 [확정] — orders #60 본편) — 흔함 8 · 8 · 8 + 강한 2 · 드묾 덩쿠리 · 로젤리아 · 노말 · 비행 3종 · 앞 스테이지 드문 타입 2종', () => {
    expect(regionPool('forest-1').common).toEqual([10, 13, 265, 165, 48, 187, 546, 420]);
    expect(regionPool('forest-2').common).toEqual([46, 285, 43, 69, 401, 167, 191, 290]);
    expect(regionPool('forest-3').common).toEqual([415, 412, 204, 588, 616, 313, 314, 193, 123, 214]);
    expect(regionPool('forest-3').rare).toEqual([114, 315]);
    for (const id of ['forest-1', 'forest-2', 'forest-3'] as const) {
      const p = regionPool(id);
      expect(p.mixed).toHaveLength(3);
      expect(regionPool(id).mixed).toEqual(p.mixed);
      for (const d of p.mixed) expect(speciesOf(d)!.types.every((t) => t === 'normal' || t === 'flying')).toBe(true);
      if (id !== 'forest-3') {
        expect(p.rare).toHaveLength(2);
        for (const d of p.rare) expect(speciesOf(d)!.types.some((t) => t === 'poison' || t === 'dragon' || t === 'fairy') && !speciesOf(d)!.types.some((t) => t === 'grass' || t === 'bug')).toBe(true);
      }
    }
    // 만나는 야생 = 목록 · 노말 · 비행 3종 · 드묾 (진화형은 목록의 진화 — 1단계로 되돌려 봄)
    const spots = Array.from({ length: 40 }, (_, i) => ({ kind: 'wild' as const, at: 0.5, index: i }));
    const p1 = regionPool('forest-1');
    const allowed = new Set([...p1.common, ...p1.mixed, ...p1.rare]);
    // 진화 사슬 어딘가가 목록에 있으면 됨 (푸린 앞에는 아기 푸푸린이 있음)
    const chain = (dex: number) => {
      const out = [dex];
      for (let d = dex, g = 0; g < 4 && speciesOf(d)?.evolvesFrom; g++) out.push((d = speciesOf(d)!.evolvesFrom!));
      return out;
    };
    for (const sp of spots) expect(chain(createWild('forest-1', 7, sp).species).some((d) => allowed.has(d))).toBe(true);
  });

  it('라이벌 · 트레이너 앞 포켓몬에 강한 1단계 (스라크 · 헤라크로스) 가 없음 — 숲도 (orders #60)', () => {
    const save = { ...sampleSave(), rivals: { blue: { wins: 3, losses: 3 } } };
    for (let seed = 1; seed <= 60; seed++) {
      for (const m of rivalTeam(save, 'blue', 'forest-3', seed).slice(0, -1)) expect([123, 212, 214]).not.toContain(m.species);
      for (const m of trainerTeam('forest-3', seed, seed % 3, 3)) expect([123, 212, 214]).not.toContain(m.species);
    }
  });

  it('레벨표 값 한 곳 (BALANCE.region) — 게임 숫자 그대로 (#47 T3 표 · 해변 2번째, 시뮬만 바꿔 봄 — orders #38 · #59)', () => {
    expect(BALANCE.region).toEqual({ aceBase: 15, aceStep: 6, aceJump2: 0, aceTable: [15, 23, 31, 39, 46, 52, 57, 62], beachOrder: 2, open: false });
    expect([1, 2, 3, 8, 9].map(regionAceLevel)).toEqual([15, 23, 31, 62, 68]);
    expect(regionOrder('beach')).toBe(2);
  });

  it('레벨표 표 칸 (aceTable — orders #42): 비면 식 그대로 · 넣으면 번째마다 그 값 (#38 D · #39 T2 를 값 한 줄로) · 표보다 뒤는 + 6 씩 · 해변 스테이지 · 관장 팀이 따라감', () => {
    const tune = BALANCE.region as { aceTable: readonly number[] };
    const before = tune.aceTable;
    try {
      tune.aceTable = [15, 26, 34, 42, 49, 55, 60, 65];
      expect([1, 2, 3, 5, 8, 9].map(regionAceLevel)).toEqual([15, 26, 34, 49, 65, 71]);
      expect(regionLevelBand(2, 2)).toEqual([23, 26]);
      expect(leaderTeam(REGIONS.beach).map((m) => m.level)).toEqual([24, 25, 26]);
      // 숲 (1번째) 은 그대로 — stageLevels · gymTeam
      expect(stageLevelBand('forest-3')).toEqual(BALANCE.stageLevels['forest-3']);
      expect(leaderTeam(REGIONS.forest).map((m) => m.level)).toEqual(BALANCE.gymTeam.map(([, lv]) => lv));
      tune.aceTable = [15, 24, 30, 36, 42, 48, 54, 60];
      expect(regionAceLevel(2)).toBe(24);
      tune.aceTable = [];
      expect(regionAceLevel(2)).toBe(21);
    } finally {
      tune.aceTable = before;
    }
    expect(regionAceLevel(2)).toBe(23);
  });

  it('등대 곶 끝 → 해변 체육관 · 관장 첫 승 = 해변 배지 + 4,000원 (1,000 × (2 + 2)) + 물의 돌', () => {
    const save = { ...sampleSave(), badges: ['forest'], location: { screen: 'gym' as const, region: 'beach' as const }, regions: { order: ['forest' as const, 'beach' as const] } };
    expect(validateSave(viaJson(save)).ok && (validateSave(viaJson(save)) as { save: { location: unknown } }).save.location).toEqual({ screen: 'gym', region: 'beach' });
    // 해변을 안 연 세이브 (4판 regions) 면 해변 체육관에 있을 수 없음 → 숲 1-1
    const closed = validateSave(viaJson({ ...save, regions: { order: ['forest'] } }));
    expect(closed.ok && closed.save.location).toEqual({ screen: 'stage', stageId: 'forest-1' });
    const b = startTrainerBattle(save, leaderTeam(REGIONS.beach), 'gym', REGIONS.beach.leader.name);
    const r = battleRewards(save, { ...b, result: 'win' }, null, 'gym', new Rng(1));
    expect(r.save.badges).toContain('beach');
    expect(r.summary.money).toBe(4000);
    expect(r.save.bag['water-stone']).toBe((save.bag['water-stone'] ?? 0) + 1);
    expect(r.summary.badge).toBe('해변 배지');
    expect(regionGymMoney(1)).toBe(BALANCE.gymFirstMoney);
  });
});

describe('지역 표 맞추기 (명세 검사관 #53)', () => {
  it('해변 트레이너 2 · 3 · 3 · gdd 5.3 자리 (k-2 낚시꾼 만석 · k-3 엘리트 트레이너 도현) · 숲은 그대로 2 · 3 · 3', () => {
    expect(['beach-1', 'beach-2', 'beach-3'].map((id) => trainerCount(id as 'beach-1'))).toEqual([2, 3, 3]);
    expect(['forest-1', 'forest-2', 'forest-3'].map((id) => trainerCount(id as 'forest-1'))).toEqual([2, 3, 3]);
    expect([0, 1].map((n) => trainerInfo('beach-1', n).name)).toEqual(['튜브 꼬마 준호', '튜브 꼬마 서윤']);
    expect(trainerInfo('beach-2', 0).name).toBe('낚시꾼 만석');
    expect(trainerInfo('beach-3', 2).name).toBe('엘리트 트레이너 도현');
    // 숲 진주는 없음
    const got = Array.from({ length: 400 }, (_, i) => pickupAt('forest-1', 99, { kind: 'item', at: 0.5, index: i }));
    expect(got.some((g) => g.item === 'pearl')).toBe(false);
  });
});

describe('라이벌 앞 포켓몬 — 강한 1단계는 야생에서만 (기획 답 · gdd 5.3)', () => {
  it('해변 등대 곶 라이벌 팀에 라프라스 · 맘복치가 없음 (숲은 아래 orders #60 테스트)', () => {
    const save = { ...sampleSave(), rivals: { blue: { wins: 3, losses: 3 } } };
    for (let seed = 1; seed <= 60; seed++) for (const m of rivalTeam(save, 'blue', 'beach-3', seed)) expect([131, 594]).not.toContain(m.species);
  });
});

describe('그림 칸 (orders #57) — 스테이지마다 배경 · 지역마다 체육관 방, 비면 지금 그대로', () => {
  it('숲 = 숲 배경 · 숲 방 (gym) · 해변 = 낮 → 노을 → 밤 · 물 방 (#61) · 스테이지가 없으면 숲', () => {
    for (const id of ['forest-1', 'forest-3'] as const) expect(stageBackground(id)).toBe('forest');
    expect((['beach-1', 'beach-2', 'beach-3'] as const).map(stageBackground)).toEqual(['beach-day', 'beach-dusk', 'beach-night']);
    expect(stageBackground(null)).toBe('forest');
    expect(gymRoomOf(REGIONS.forest)).toBe('gym');
    expect(gymRoomOf(REGIONS.beach)).toBe('gym-water');
  });

  it('넣으면 스테이지 → 지역 순서로 · 체육관 방 이름', () => {
    const beach = { ...REGIONS.beach, background: 'beach', gymRoom: 'gym-water', stages: [{ ...REGIONS.beach.stages[0], background: 'beach-day' }, { ...REGIONS.beach.stages[1], background: undefined }, REGIONS.beach.stages[2]] as const };
    const regions = REGIONS as unknown as Record<string, unknown>;
    const was = regions.beach;
    regions.beach = beach;
    try {
      expect(stageBackground('beach-1')).toBe('beach-day');
      expect(stageBackground('beach-2')).toBe('beach');
      expect(gymRoomOf(REGIONS.beach)).toBe('gym-water');
    } finally {
      regions.beach = was;
    }
  });
});
describe('VS 대결 그림 — 지역 표의 트레이너 · 관장 모두 (bugs 663 — 해변 9명 + 해솔이 빠져 VS 오른쪽이 비던 것)', () => {
  it('REGIONS 의 트레이너 · 관장 look 마다 battle.png 목록이 있음', () => {
    for (const region of Object.values(REGIONS)) {
      for (const look of [...region.trainers.map((t) => t.look), region.leader.look]) expect(battleArtOf(look), `${region.id} ${look}`).toBeDefined();
    }
  });
});

describe('기술 없는 야생 막기 (orders #63 · #64)', () => {
  const dmgAt = (dex: number, level: number) => learnsetOf(dex).some(([lv, id]) => lv <= level && (moveOf(id)?.power ?? 0) > 0 && moveOf(id)?.class !== 'status');
  it('숲 · 해변 모든 스테이지 — 흔함 · 섞기 · 드묾 모두 그 레벨대 아래 끝에서 피해 기술을 배움 (진화 기술 Lv 0 포함)', () => {
    for (const region of Object.values(REGIONS)) {
      for (const st of region.stages) {
        const [lo] = stageLevelBand(st.id);
        const p = regionPool(st.id);
        for (const d of [...p.common, ...p.mixed, ...p.rare]) expect(dmgAt(d, lo), `${st.id} ${speciesOf(d)?.name.ko}`).toBe(true);
        expect(p.mixed.every((d) => learnsDamage(d, lo)) && p.rare.every((d) => learnsDamage(d, lo))).toBe(true);
      }
    }
  });

  it('진화 기술 (Lv 0) 도 야생 · 관장 기술에 — 갸라도스 Lv 20 은 물기', () => {
    const moves = wildMoves(130, 20, new Rng(1));
    expect(moves.some((m) => m.id === learnsetOf(130).find(([lv]) => lv === 0)![1])).toBe(true);
  });

  it('진화는 레벨대 위 끝까지만 — 센 흔적의 +2 로는 진화하지 않음 (해변 2-1 센 잉어킹은 잉어킹 · orders #64 B)', () => {
    const spots = Array.from({ length: 400 }, (_, i) => ({ kind: 'wild' as const, at: (i % 20) / 20, index: i }));
    let strongSeen = 0;
    for (const region of Object.values(REGIONS)) {
      for (const st of region.stages) {
        const [, hi] = stageLevelBand(st.id);
        const bases = new Set([...regionPool(st.id).common, ...regionPool(st.id).rare, ...regionPool(st.id).mixed]);
        for (const sp of spots) {
          const p = planWild(st.id, 777, sp);
          if (p.strong) strongSeen++;
          // 진화형이면 위 끝 레벨로 될 수 있는 것 (목록의 1단계 — 삐삐처럼 앞에 아기가 있어도 — 는 그대로)
          if (!bases.has(p.dex)) expect(devolveForLevel(p.dex, hi), `${st.id} ${speciesOf(p.dex)?.name.ko} Lv${p.level}`).toBe(p.dex);
        }
      }
    }
    expect(strongSeen).toBeGreaterThan(0);
    expect(spots.some((sp) => planWild('beach-1', 777, sp).dex === 130)).toBe(false);
  });
});

describe('드문 종 — 같은 지역 안에서 겹치지 않음 (orders #65 ②)', () => {
  it('숲 · 해변 앞 스테이지 드문 2종이 지역 안에서 모두 다름 · 숲은 그대로 (삐삐 · 블루 / 마릴 · 랄토스)', () => {
    for (const region of Object.values(REGIONS)) {
      const rare = region.stages.slice(0, -1).flatMap((st) => regionPool(st.id).rare);
      expect(new Set(rare).size, region.id).toBe(rare.length);
    }
    expect(regionPool('forest-1').rare.map((d) => speciesOf(d)?.name.ko)).toEqual(['삐삐', '블루']);
    expect(regionPool('forest-2').rare.map((d) => speciesOf(d)?.name.ko)).toEqual(['마릴', '랄토스']);
  });
});

describe('지역 순서 = 세이브 연 순서 (orders #66 — 엔진이 걸음마다 넣음)', () => {
  it('켜져 있으면 연 순서 (안 연 곳 = 다음 번째) · 꺼지면 (null) BALANCE.region.beachOrder · 숲은 늘 1', () => {
    try {
      setRegionOrder(['forest', 'beach']);
      expect([regionOrder('forest'), regionOrder('beach')]).toEqual([1, 2]);
      setRegionOrder(['forest']);
      expect(regionOrder('beach')).toBe(2);
      // 셋째로 연 지역이면 그 번째의 레벨 (지역이 늘면 — 지금은 숲 · 해변 둘)
      setRegionOrder(['forest', 'cave', 'beach'] as never);
      expect(regionOrder('beach')).toBe(3);
      expect(stageLevelBand('beach-3')).toEqual(regionLevelBand(3, 2, 'beach-3'));
      expect(stageCode('beach-1')).toBe('3-1');
    } finally {
      setRegionOrder(null);
    }
    expect(regionOrder('beach')).toBe(BALANCE.region.beachOrder);
    expect(stageCode('beach-1')).toBe('2-1');
  });
});
