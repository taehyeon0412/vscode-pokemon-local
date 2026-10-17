/**
 * 받아 온 데이터 검사 — 데이터를 다시 받거나 포켓몬을 더 넣으면 (add-pokemon.py → fetch-pokeapi.mjs) 여기서 깨진 곳이 드러남.
 */
import { describe, expect, it } from 'vitest';
import {
  allForms, allSpecies, DATA_SOURCE, evolutionsOf, formOf, formsOfSpecies, learnsetOf, moveOf, speciesOf, TYPE_NAMES,
  type TypeName,
} from './index';

const isType = (t: string): t is TypeName => (TYPE_NAMES as readonly string[]).includes(t);

/** 스타팅 18종 (mvp-spec S04 · gdd 부록 A) — 진화 전 도감 번호 */
const STARTERS = {
  grass: [1, 152, 252, 387, 495, 650],
  fire: [4, 155, 255, 390, 498, 653],
  water: [7, 158, 258, 393, 501, 656],
} as const;

describe('데이터 출처', () => {
  it('PokeAPI 고정 커밋 · 울트라썬 · 울트라문', () => {
    expect(DATA_SOURCE.ref).toMatch(/^[0-9a-f]{40}$/);
    expect(DATA_SOURCE.versionGroup).toBe('ultra-sun-ultra-moon');
  });
});

describe('포켓몬', () => {
  it('확장의 모든 그림(652)에 종 데이터가 있고, 모든 종(576)에 그림이 있음', () => {
    expect(allForms().length).toBeGreaterThanOrEqual(652);
    expect(allSpecies().length).toBeGreaterThanOrEqual(576);
    for (const key of allForms()) expect(speciesOf(formOf(key)!.species), key).toBeDefined();
    for (const dex of allSpecies()) expect(formsOfSpecies(dex).length, String(dex)).toBeGreaterThan(0);
  });

  it('종마다 한글 이름 · 타입 1~2개 · 종족값 6개 · 포획률', () => {
    for (const dex of allSpecies()) {
      const s = speciesOf(dex)!;
      expect(s.name.ko, String(dex)).toBeTruthy();
      expect(s.types.length).toBeGreaterThanOrEqual(1);
      expect(s.types.length).toBeLessThanOrEqual(2);
      for (const t of s.types) expect(isType(t), `${dex} ${t}`).toBe(true);
      for (const v of Object.values(s.base)) expect(v).toBeGreaterThan(0);
      expect(Object.keys(s.base).sort()).toEqual(['attack', 'defense', 'hp', 'spAttack', 'spDefense', 'speed']);
      expect(s.captureRate).toBeGreaterThanOrEqual(3);
      expect(s.captureRate).toBeLessThanOrEqual(255);
    }
  });

  it('원작 값 몇 개 (이상해씨 · 개굴닌자)', () => {
    expect(speciesOf(1)).toMatchObject({ name: { ko: '이상해씨' }, types: ['grass', 'poison'], base: { hp: 45, attack: 49, speed: 45 }, captureRate: 45, stage: 1 });
    expect(speciesOf(658)).toMatchObject({ name: { ko: '개굴닌자' }, types: ['water', 'dark'], stage: 3 });
  });

  it('개구마르 계열 그림 크기 32 → 64 → 32 (mvp-spec 1장)', () => {
    expect([formOf('froakie')?.size, formOf('frogadier')?.size, formOf('greninja')?.size]).toEqual([32, 64, 32]);
  });

  it('숲 포켓몬 (풀 · 벌레) 이 넉넉함 — 100종 넘음 (mvp-spec 3.2 "110종")', () => {
    const forest = allSpecies().filter((d) => speciesOf(d)!.types.some((t) => t === 'grass' || t === 'bug'));
    expect(forest.length).toBeGreaterThanOrEqual(100);
  });
});

describe('스타팅 18종 (S04)', () => {
  for (const [type, list] of Object.entries(STARTERS)) {
    for (const dex of list) {
      it(`${speciesOf(dex)?.name.ko ?? dex}: 3단계가 모두 있고 레벨로 진화, 자기 타입 피해 기술이 있음`, () => {
        const first = speciesOf(dex)!;
        expect(first.types).toContain(type);
        expect(first.stage).toBe(1);
        const second = evolutionsOf(dex).find((e) => e.kind === 'level');
        expect(second?.level).toBeGreaterThan(0);
        const third = evolutionsOf(second!.to).find((e) => e.kind === 'level');
        expect(third?.level).toBeGreaterThan(second!.level!);
        for (const d of [dex, second!.to, third!.to]) expect(formsOfSpecies(d).length).toBeGreaterThan(0);
        // 처음 기술 후보: 레벨업으로 배우는 피해 기술, 자기 타입 1개는 꼭 (mvp-spec 3.6)
        const damaging = learnsetOf(dex).map(([, id]) => moveOf(id)!).filter((m) => m.class !== 'status');
        expect(damaging.length).toBeGreaterThanOrEqual(2);
        expect(damaging.some((m) => m.type === type)).toBe(true);
      });
    }
  }
});

describe('숲 관장 (mvp-spec 3.9)', () => {
  it('파라스 · 냄새꼬 · 버터플이 있고, 냄새꼬 → 라플레시아는 리프의 돌', () => {
    for (const d of [46, 44, 12]) expect(formsOfSpecies(d).length).toBeGreaterThan(0);
    expect(evolutionsOf(44)).toContainEqual({ to: 45, kind: 'item', item: 'leaf-stone' });
  });
});

describe('기술', () => {
  const learned = new Set(allSpecies().flatMap((d) => learnsetOf(d).map(([, id]) => id)));

  it('기술표의 기술은 모두 데이터에 있고 한글 이름이 있음 · 레벨 순서', () => {
    for (const dex of allSpecies()) {
      let last = -1;
      for (const [lv, id] of learnsetOf(dex)) {
        expect(moveOf(id)?.name.ko, `${dex} ${id}`).toBeTruthy();
        expect(lv).toBeGreaterThanOrEqual(last);
        expect(lv).toBeLessThanOrEqual(100);
        last = lv;
      }
    }
  });

  it('변화 기술은 상태 이상(독 · 화상 · 마비 · 잠듦)을 거는 것만 · 피해 기술은 위력이 있음', () => {
    for (const id of learned) {
      const m = moveOf(id)!;
      if (m.class === 'status') {
        expect(m.ailment, m.key).not.toBeNull();
        expect(m.power).toBe(0);
      } else {
        expect(m.power, m.key).toBeGreaterThan(0);
      }
      expect(isType(m.type)).toBe(true);
      expect(m.pp).toBeGreaterThan(0);
      if (m.accuracy !== null) expect(m.accuracy).toBeGreaterThan(0);
    }
  });

  it('뺀 기술: 일격필살 · 고정 피해 · 쓰러지며 쓰는 · 모으기 · 반동으로 쉬는 · 능력치만 바꾸는', () => {
    const keys = new Set([...learned].map((id) => moveOf(id)!.key));
    for (const k of ['fissure', 'guillotine', 'dragon-rage', 'seismic-toss', 'night-shade', 'self-destruct', 'explosion', 'solar-beam', 'fly', 'dig', 'hyper-beam', 'growl', 'harden', 'swords-dance', 'leech-seed']) {
      expect(keys.has(k), k).toBe(false);
    }
    for (const k of ['tackle', 'vine-whip', 'ember', 'water-gun', 'poison-powder', 'sleep-powder', 'stun-spore', 'thunder-wave', 'absorb', 'double-edge']) {
      expect(keys.has(k), k).toBe(true);
    }
  });

  it('연속기는 평균 횟수만큼 위력 (2~5회 = 3회) · 흡수 · 반동은 % 로', () => {
    const doubleKick = [...learned].map((id) => moveOf(id)!).find((m) => m.key === 'double-kick')!;
    expect(doubleKick.power).toBe(doubleKick.basePower * 2);
    const furySwipes = [...learned].map((id) => moveOf(id)!).find((m) => m.key === 'fury-swipes')!;
    expect(furySwipes.power).toBe(furySwipes.basePower * 3);
    const absorb = [...learned].map((id) => moveOf(id)!).find((m) => m.key === 'absorb')!;
    expect(absorb.drain).toBeGreaterThan(0);
    const doubleEdge = [...learned].map((id) => moveOf(id)!).find((m) => m.key === 'double-edge')!;
    expect(doubleEdge.drain).toBeLessThan(0);
  });

  it('맞받아치기 구분: 불꽃세례 · 물대포는 닿지 않음, 몸통박치기는 닿음 (mvp-spec 3.3)', () => {
    const byKey = new Map([...learned].map((id) => [moveOf(id)!.key, moveOf(id)!]));
    expect(byKey.get('ember')?.contact).toBe(false);
    expect(byKey.get('water-gun')?.contact).toBe(false);
    expect(byKey.get('tackle')?.contact).toBe(true);
  });
});

describe('진화', () => {
  it('진화하는 종은 모두 데이터 · 그림이 있음 · 종류가 정해진 것', () => {
    for (const dex of allSpecies()) {
      for (const e of evolutionsOf(dex)) {
        expect(speciesOf(e.to), `${dex} → ${e.to}`).toBeDefined();
        expect(['level', 'item', 'trade', 'friendship', 'other']).toContain(e.kind);
        if (e.kind === 'level') expect(e.level).toBeGreaterThan(0);
        if (e.kind === 'item') expect(e.item).toBeTruthy();
      }
    }
  });

  it('원작 값 몇 개 (이상해씨 Lv 16 · 뚜벅쵸 Lv 21 · 이브이 갈래)', () => {
    expect(evolutionsOf(1)).toEqual([{ to: 2, kind: 'level', level: 16 }]);
    expect(evolutionsOf(43)).toEqual([{ to: 44, kind: 'level', level: 21 }]);
    const eevee = evolutionsOf(133);
    expect(eevee).toContainEqual({ to: 196, kind: 'friendship', time: 'day' });
    expect(eevee).toContainEqual({ to: 134, kind: 'item', item: 'water-stone' });
    expect(new Set(eevee.map((e) => JSON.stringify(e))).size).toBe(eevee.length); // 겹친 줄 없음
  });
});

describe('리뷰에서 찾은 것 (다시 안 생기게)', () => {
  it('기술표에 같은 기술은 한 번만 (가장 낮은 레벨)', () => {
    for (const dex of allSpecies()) {
      const ids = learnsetOf(dex).map(([, id]) => id);
      expect(new Set(ids).size, String(dex)).toBe(ids.length);
    }
  });

  it('스타팅의 처음 기술 후보 (피해 기술 앞 4개)는 서로 다르고 자기 타입이 들어 있음 (S04)', () => {
    for (const [type, list] of Object.entries(STARTERS)) {
      for (const dex of list) {
        const first4 = learnsetOf(dex).map(([, id]) => moveOf(id)!).filter((m) => m.class !== 'status').slice(0, 4);
        expect(new Set(first4.map((m) => m.id)).size).toBe(first4.length);
        expect(first4.some((m) => m.type === type), `${dex}`).toBe(true);
      }
    }
  });

  it('진화는 울트라썬문 · 기본 모습 것만 (지역 폼 · 뒤 게임 규칙이 섞이지 않음)', () => {
    expect(evolutionsOf(155)).toEqual([{ to: 156, kind: 'level', level: 14 }]); // 브케인 (히스이 17 아님)
    expect(evolutionsOf(52)).toEqual([{ to: 53, kind: 'level', level: 28 }]); // 나옹 (알로라 친밀도 아님)
    expect(evolutionsOf(100).some((e) => e.item === 'leaf-stone')).toBe(false); // 찌리리공 (히스이)
    expect(evolutionsOf(133).some((e) => e.item === 'leaf-stone' || e.item === 'ice-stone')).toBe(false); // 이브이 (8세대 돌)
    expect(evolutionsOf(27).some((e) => e.item === 'ice-stone')).toBe(false); // 모래두지 (알로라)
    for (const dex of allSpecies()) {
      const seen = new Set(evolutionsOf(dex).map((e) => JSON.stringify(e)));
      expect(seen.size).toBe(evolutionsOf(dex).length);
    }
  });

  it('갈래 정보: 개무소 반반 · 도롱충이 · 세꿀버리 성별 · 기술을 알면 진화는 기술 번호', () => {
    expect(evolutionsOf(265).map((e) => e.chance)).toEqual([50, 50]);
    expect(evolutionsOf(412).map((e) => e.gender).sort()).toEqual(['female', 'male']);
    expect(evolutionsOf(193)[0]).toMatchObject({ kind: 'other', knownMove: 246 }); // 왕자리 → 메가자리 (원시의힘)
  });

  it('기술 값은 울트라썬문 때 것 (뒤 게임에서 바뀐 값을 되돌림)', () => {
    const byKey = new Map(allSpecies().flatMap((d) => learnsetOf(d)).map(([, id]) => [moveOf(id)!.key, moveOf(id)!]));
    expect(byKey.get('rapid-spin')?.power).toBe(20); // 8세대에서 50
    expect(byKey.get('triple-kick')?.power).toBe(60); // 10 + 20 + 30
  });

  it('조건 · 대가가 있는 센 기술은 뺌 · 독실(독)은 넣음 · 칼등치기는 HP 1 을 남김', () => {
    const keys = new Set(allSpecies().flatMap((d) => learnsetOf(d)).map(([, id]) => moveOf(id)!.key));
    for (const k of ['uproar', 'focus-punch', 'outrage', 'petal-dance', 'overheat', 'leaf-storm', 'close-combat', 'eruption', 'high-jump-kick', 'dream-eater']) {
      expect(keys.has(k), k).toBe(false);
    }
    expect(keys.has('toxic-thread')).toBe(true);
    const falseSwipe = allSpecies().flatMap((d) => learnsetOf(d)).map(([, id]) => moveOf(id)!).find((m) => m.key === 'false-swipe');
    expect(falseSwipe?.effect).toBe('leave-1hp');
  });

  it('진화 단계: 아기는 안 셈 (피카츄 1 · 라이츄 2), 진화 전 그림이 없으면 1단계 (모아머)', () => {
    expect(speciesOf(25)?.stage).toBe(1);
    expect(speciesOf(26)?.stage).toBe(2);
    expect(speciesOf(172)?.baby).toBe(true);
    expect(speciesOf(542)?.stage).toBe(1);
  });

  it('기본 모습이 먼저 (깝질무 west · 사철록 spring)', () => {
    expect(formsOfSpecies(422)[0]).toBe('shellos_west');
    expect(formsOfSpecies(585)[0]).toBe('deerling_spring');
  });

  it('쓸 기술이 하나도 없는 종 — 늘면 알 수 있게 고정 (게임에서는 1 공격만, mvp-spec 3.3)', () => {
    const none = allSpecies().filter((d) => learnsetOf(d).length === 0).sort((a, b) => a - b);
    expect(none).toEqual([11, 14, 63, 132, 202, 235, 266, 268, 273, 360]); // 단데기 · 딱충이 · 캐이시 · 메타몽 · 마자용 · 루브도 · 실쿤 · 카스쿤 · 도토링 · 마자
  });
});
