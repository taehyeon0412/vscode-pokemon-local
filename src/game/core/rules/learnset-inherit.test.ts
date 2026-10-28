/** 돌로 진화한 포켓몬은 진화 전 기술표를 이어받음 (#129 — 2026-10-28 태현 님 B · ideas 729: 라이츄는 원작 표가 Lv 1 셋뿐이라 진화한 뒤 새 기술이 끝까지 끊김) */
import { describe, expect, it } from 'vitest';
import { sampleMonster } from '../../../test/fixtures/save';
import { Rng } from '../engine/rng';
import { allSpecies, evolutionsOf, itemEvolvedFrom, learnsetFrom, learnsetOf, learnsetOwnOf, moveOf, SPARSE_LEARNSET_MAX } from '../../data';
import { evolutionMoves, levelUpChoices, movesLearnedAt } from './growth';
import { wildMoves } from './monster';
import { REGIONS } from './region';
import { leaderMoves, leaderTeam } from './trainer';

const RAICHU = 26;
const PIKACHU = 25;
const idAt = (dex: number, level: number) => learnsetOwnOf(dex).find(([lv]) => lv === level)?.[1];
const itemEvolved = () => allSpecies().filter((d) => itemEvolvedFrom(d) !== undefined);

describe('돌 · 아이템 진화형은 바로 앞 진화 전 종의 기술도 같은 레벨에 (#129)', () => {
  it('라이츄 = 피카츄가 배울 기술을 같은 레벨에 (Lv 18 · 21 · 26 · 29 · 34 · 37 · 50 · 58) · 원작 라이츄 표 (Lv 1 셋) 는 그대로', () => {
    expect(learnsetOwnOf(RAICHU).every(([lv]) => lv <= 1)).toBe(true);
    for (const lv of [18, 21, 26, 29, 34, 37, 50, 58]) {
      const id = idAt(PIKACHU, lv);
      expect(id, `피카츄 Lv ${lv}`).toBeDefined();
      expect(movesLearnedAt(RAICHU, lv).map((m) => m.id), `라이츄 Lv ${lv}`).toContain(id);
    }
    // 원작 라이츄 표가 먼저 (10만볼트 Lv 1)
    for (const [lv, id] of learnsetOwnOf(RAICHU)) expect(learnsetOf(RAICHU)).toContainEqual([lv, id]);
  });

  it('같은 기술은 한 번 · 자기 표에 있으면 자기 레벨 · 앞 종의 진화 기술 (Lv 0) 은 안 이어받음 · 레벨 순서', () => {
    for (const dex of itemEvolved()) {
      const merged = learnsetOf(dex);
      const own = learnsetOwnOf(dex);
      const ids = merged.map(([, id]) => id);
      expect(new Set(ids).size, String(dex)).toBe(ids.length);
      for (const [lv, id] of own) expect(merged.find(([, x]) => x === id)?.[0], `${dex} 기술 ${id}`).toBe(lv);
      for (const [lv, id] of merged) if (!own.some(([, x]) => x === id)) expect(lv, `${dex} 이어받은 ${id}`).toBeGreaterThanOrEqual(1);
      for (let i = 1; i < merged.length; i++) expect(merged[i]![0]).toBeGreaterThanOrEqual(merged[i - 1]![0]);
    }
  });

  it('돌 진화형 목록 — 라이츄 · 픽시 · 나인테일 · 라플레시아 · 윈디 · 샤미드 · 쥬피썬더 · 부스터 … 28종 · 레벨 진화형 · 표가 넉넉한 친밀도 진화형은 원작 표 그대로', () => {
    const list = itemEvolved();
    expect(list).toHaveLength(28);
    for (const dex of [26, 36, 38, 45, 59, 134, 135, 136]) expect(list, String(dex)).toContain(dex);
    expect(itemEvolvedFrom(38)).toBe(37); // 나인테일 ← 식스테일
    expect(itemEvolvedFrom(135)).toBe(133); // 쥬피썬더 ← 이브이
    // 이상해풀 · 이상해꽃 (레벨) · 피카츄 (친밀도 — 피츄, 표가 넉넉함) · 후딘 (교환) · 에브이 (친밀도) 는 돌 진화형이 아님 — 후딘 · 에브이는 #132 로 이어받음 (아래)
    for (const dex of [2, 3, 25, 65, 196]) expect(itemEvolvedFrom(dex), String(dex)).toBeUndefined();
    for (const dex of [2, 3, 25]) {
      expect(learnsetFrom(dex), String(dex)).toBeUndefined();
      expect(learnsetOf(dex)).toBe(learnsetOwnOf(dex));
    }
  });

  it('이미 진화한 포켓몬 (옛 세이브) 은 다음 레벨업부터 — 지나간 레벨 기술을 한꺼번에 안 줌', () => {
    const raichu = (level: number) => sampleMonster({ species: RAICHU, form: 'raichu', level, moves: [{ moveId: 84, pp: 30 }] });
    // Lv 30 라이츄가 31 이 됨 — 18 · 21 · 26 · 29 기술은 안 받음
    expect(levelUpChoices(raichu(30), 30, 31, new Rng(1)).learned).toEqual([]);
    // 33 → 34 — 피카츄 Lv 34 기술 (방전) 을 배움
    expect(levelUpChoices(raichu(33), 33, 34, new Rng(1)).learned).toEqual([idAt(PIKACHU, 34)]);
  });

  it('야생 · 트레이너 · 라이벌 라이츄도 같은 표 — Lv 30 이면 이어받은 기술 (Lv 18 ~ 29) 에서도 뽑음', () => {
    const inherited = new Set(learnsetOf(RAICHU).filter(([lv, id]) => lv >= 2 && lv <= 30 && !learnsetOwnOf(RAICHU).some(([, x]) => x === id)).map(([, id]) => id));
    expect(inherited.size).toBeGreaterThanOrEqual(3);
    let seen = 0;
    for (let seed = 1; seed <= 40; seed++) if (wildMoves(RAICHU, 30, new Rng(seed)).some((m) => inherited.has(m.id))) seen++;
    expect(seen).toBeGreaterThan(30);
    expect(moveOf(idAt(PIKACHU, 34)!)?.type).toBe('electric');
  });

  it('관장 돌 진화형은 진화할 때 받는 주력기 (자기 표 Lv 1) 를 그대로 — 해변 에이스 아쿠스타 하이드로펌프 (테스터 — 이어받은 기술에 밀려 잃던 것)', () => {
    const starmie = leaderTeam(REGIONS.beach).find((m) => m.species === 121);
    expect(starmie).toBeDefined();
    expect(starmie!.moves.map((s) => s.moveId)).toContain(56); // 하이드로펌프
  });

  it('진화할 때 새 기술 — 앞 종에서 이어받은 기술은 아직 안 지난 레벨만 (냄새꼬 Lv 20 → 라플레시아에 냄새꼬 Lv 1 용해액이 끼던 것)', () => {
    const gloom = sampleMonster({ species: 44, form: 'gloom', level: 20, moves: [77, 78, 79, 72].map((moveId) => ({ moveId, pp: 20 })) });
    const offered = evolutionMoves(gloom, 45);
    for (const id of offered) {
      const own = learnsetOwnOf(45).some(([, x]) => x === id);
      const lv = learnsetOf(45).find(([, x]) => x === id)?.[0] ?? 0;
      expect(own || lv > 20, `기술 ${id} Lv ${lv}`).toBe(true);
    }
    expect(offered).not.toContain(51); // 용해액 (냄새꼬 Lv 1)
  });
});

describe('교환 · 조건 진화형도 자기 표가 모자라면 이어받음 (#132 — 2026-10-28 태현 님 "추천대로" · 기준 SPARSE_LEARNSET_MAX)', () => {
  const hi = (dex: number) => learnsetOwnOf(dex).filter(([lv]) => lv > 2).length;
  const kindsTo = (dex: number) => allSpecies().flatMap((from) => evolutionsOf(from).filter((e) => e.to === dex).map((e) => e.kind));

  it('왕구리 · 후딘 · 블래키 · 에브이 · 리피아 · 글레이시아 · 팬텀 · 이어롭 … = 바로 앞 종 · 이브이 진화형은 다 이어받음 (돌 셋 + 조건 넷)', () => {
    expect([186, 65, 197, 196, 470, 471, 94, 428].map((d) => learnsetFrom(d))).toEqual([61, 64, 133, 133, 133, 133, 93, 427]);
    for (const d of [134, 135, 136, 196, 197, 470, 471]) expect(learnsetFrom(d), String(d)).toBe(133);
    // 왕구리 = 슈륙챙이 Lv 2 넘는 기술을 같은 레벨에 (자기 표는 Lv 2 넘는 것 둘뿐)
    expect(hi(186)).toBeLessThanOrEqual(2);
    for (const [lv, id] of learnsetOwnOf(61)) if (lv > 2 && !learnsetOwnOf(186).some(([, x]) => x === id)) expect(learnsetOf(186), `기술 ${id}`).toContainEqual([lv, id]);
  });

  it('기준 = 교환 · 친밀도 · 그 밖 진화형 중 자기 표 Lv 2 넘는 기술이 기준 이하만 · 레벨 진화형은 아님 · 표가 넉넉하면 원작 표 그대로', () => {
    for (const dex of allSpecies()) {
      const from = learnsetFrom(dex);
      if (from === undefined || itemEvolvedFrom(dex) !== undefined) continue;
      const kinds = kindsTo(dex);
      expect(kinds.some((k) => k !== 'level' && k !== 'item'), String(dex)).toBe(true);
      expect(hi(dex), String(dex)).toBeLessThanOrEqual(SPARSE_LEARNSET_MAX);
    }
    // 야도킹 · 괴력몬 · 딱구리 (교환 — 표가 넉넉함) 는 그대로
    for (const dex of [199, 68, 76]) {
      expect(hi(dex), String(dex)).toBeGreaterThan(SPARSE_LEARNSET_MAX);
      expect(learnsetOf(dex)).toBe(learnsetOwnOf(dex));
    }
  });

  it('관장 기술은 돌 진화형만 이어받은 표 + 진화 주력기 · 교환 · 조건 진화형은 원작 표 그대로 — 밀로틱 하이드로펌프 · 회오리 (코드 리뷰어 · 테스터 — 4번째 지역 mid · late 표)', () => {
    expect(learnsetFrom(350)).toBe(349);
    for (const lv of [30, 40, 50, 60]) {
      const ids = leaderMoves(350, lv).map((m) => m.id);
      if (lv >= 44) expect(ids, `밀로틱 Lv ${lv}`).toContain(56); // 하이드로펌프 (자기 표 Lv 44)
      expect(ids, `밀로틱 Lv ${lv}`).not.toContain(35); // 김밥말이 (자기 표 Lv 1)
      expect(ids, `밀로틱 Lv ${lv}`).not.toContain(33); // 몸통박치기 (빈티나에서 이어받은 Lv 15 — 관장은 원작 표, 테스터)
    }
    expect(leaderMoves(350, 60).map((m) => m.id).sort()).toEqual([56, 239, 401, 525].sort()); // 하이드로펌프 · 회오리 · 아쿠아테일 · 드래곤테일
  });

  it('같은 기술은 한 번 · 자기 레벨 그대로 · 레벨 순서 (이어받는 종 모두)', () => {
    for (const dex of allSpecies().filter((d) => learnsetFrom(d) !== undefined)) {
      const merged = learnsetOf(dex);
      const ids = merged.map(([, id]) => id);
      expect(new Set(ids).size, String(dex)).toBe(ids.length);
      for (const [lv, id] of learnsetOwnOf(dex)) expect(merged.find(([, x]) => x === id)?.[0], `${dex} 기술 ${id}`).toBe(lv);
      for (let i = 1; i < merged.length; i++) expect(merged[i]![0]).toBeGreaterThanOrEqual(merged[i - 1]![0]);
    }
  });
});
