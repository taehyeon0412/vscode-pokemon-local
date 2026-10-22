import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../core/balance';
import { expForLevel } from '../../core/rules/stats';
import { validateSave } from '../../core/save';
import { moveOf, speciesOf } from '../../data';
import { spriteBoxOf } from '../../data/sprite-boxes';
import { CHAIN_MAX_ART, chainRowPx, chosenStarterMoves, pickLayout, createStartSave, defaultStarterMoves, evolutionChain, starterList, starterMoveCandidates } from './model';

const STARTERS = [1, 152, 252, 387, 495, 650, 4, 155, 255, 390, 498, 653, 7, 158, 258, 393, 501, 656];

describe('스타팅 처음 기술 (mvp-spec 3.6 · S04)', () => {
  it.each(STARTERS)('#%i: 후보 4개 이하 · 서로 다름 · 피해 기술 · 자기 타입 포함, 기본 2개도 자기 타입 포함', (dex) => {
    const types = speciesOf(dex)!.types;
    const cands = starterMoveCandidates(dex);
    expect(cands.length).toBeGreaterThanOrEqual(2);
    expect(cands.length).toBeLessThanOrEqual(4);
    expect(new Set(cands.map((m) => m.id)).size).toBe(cands.length);
    expect(cands.every((m) => m.class !== 'status')).toBe(true);
    expect(cands.some((m) => types.includes(m.type))).toBe(true);
    const picked = defaultStarterMoves(dex);
    expect(picked).toHaveLength(2);
    expect(picked.some((m) => types.includes(m.type))).toBe(true);
  });

  it('이상해씨: 몸통박치기 · 덩굴채찍', () => {
    expect(defaultStarterMoves(1).map((m) => m.name.ko)).toEqual(['몸통박치기', '덩굴채찍']);
  });
});

describe('새로 하기 세이브', () => {
  it('이상해씨 스타팅 레벨 (Lv 6 — orders #82) 한 마리 · 숲 1-1 · HP 가득 · 볼 3 · 1000원 · 검사를 고칠 것 없이 통과', () => {
    const save = createStartSave(1_800_000_000_000, 42);
    const m = save.monsters.m1!;
    expect(m).toMatchObject({ species: 1, form: 'bulbasaur', level: BALANCE.starterLevel, exp: expForLevel(BALANCE.starterLevel), caughtAt: 'starter', status: null });
    expect(m.hp).toBeGreaterThanOrEqual(19);
    expect(m.moves.map((x) => moveOf(x.moveId)!.key)).toEqual(['tackle', 'vine-whip']);
    expect(m.moves.every((x) => x.pp === moveOf(x.moveId)!.pp)).toBe(true);
    expect(save.party).toEqual(['m1']);
    expect(save.location).toEqual({ screen: 'stage', stageId: 'forest-1' });
    expect(save.bag['poke-ball']).toBe(3);
    expect(save.money).toBe(1000);
    expect(save.dex).toEqual({ seen: [1], caught: [1] });
    expect(validateSave(JSON.parse(JSON.stringify(save)))).toEqual({ ok: true, save, problems: [] });
  });

  it('같은 시드면 같은 개체값 · 다른 시드면 대개 다름', () => {
    expect(createStartSave(0, 7).monsters.m1!.ivs).toEqual(createStartSave(0, 7).monsters.m1!.ivs);
    expect(createStartSave(0, 7).monsters.m1!.ivs).not.toEqual(createStartSave(0, 8).monsters.m1!.ivs);
  });

  it('스타팅 18종 모두 만들 수 있음 (단계 10 S04 에서 고름)', () => {
    for (const dex of STARTERS) expect(validateSave(createStartSave(0, dex, dex)).ok, String(dex)).toBe(true);
  });
});

describe('S03 · S04 고르기 (단계 10)', () => {
  it('스타팅 줄 18마리 · 진화 단계는 1 → 2 → 3 (그림이 있는 것만)', () => {
    expect(starterList().map((s) => s.dex)).toEqual(STARTERS);
    for (const dex of STARTERS) {
      const chain = evolutionChain(dex);
      expect(chain[0]!.dex).toBe(dex);
      expect(chain.length).toBeGreaterThanOrEqual(2);
      expect(chain.length).toBeLessThanOrEqual(3);
    }
    expect(evolutionChain(1).map((c) => c.dex)).toEqual([1, 2, 3]);
  });

  it('고른 처음 기술 2개 · 주인공 남 · 여가 세이브에 — 후보 밖 · 1개 · 같은 것 두 번이면 기본 2개', () => {
    const cands = starterMoveCandidates(4).map((m) => m.id);
    const pick = [cands[2]!, cands[3]!];
    const save = createStartSave(0, 5, 4, { gender: 'female', moves: pick });
    expect(save.monsters.m1!.moves.map((m) => m.moveId)).toEqual(pick);
    expect(save.player).toEqual({ gender: 'female' });
    expect(validateSave(JSON.parse(JSON.stringify(save))).ok).toBe(true);
    const defaults = defaultStarterMoves(4).map((m) => m.id);
    expect(chosenStarterMoves(4, [9999, cands[0]!]).map((m) => m.id)).toEqual(defaults);
    expect(chosenStarterMoves(4, [cands[0]!]).map((m) => m.id)).toEqual(defaults);
    expect(chosenStarterMoves(4, [cands[0]!, cands[0]!]).map((m) => m.id)).toEqual(defaults);
    // 스타팅이 아닌 종은 고를 수 없음 (손으로 만든 메시지) → 이상해씨
    expect(createStartSave(0, 5, 150).monsters.m1!.species).toBe(1);
  });

  it('S03 고른 캐릭터 (2026-10-19 A안) 가 세이브에 — 모르는 이름은 버리고 성별만', () => {
    const save = createStartSave(0, 5, 4, { gender: 'female', look: 'may' });
    expect(save.player).toEqual({ gender: 'female', look: 'may' });
    expect(validateSave(JSON.parse(JSON.stringify(save)))).toMatchObject({ ok: true, problems: [] });
    expect(createStartSave(0, 5, 4, { gender: 'male', look: 'nobody' }).player).toEqual({ gender: 'male' });
  });
});

describe('S04 ② 진화 줄 그림 (2026-10-20 태현 님 "크기가 제각각 · 바닥 정렬 · 이름은 밑에")', () => {
  it('18종 모든 진화 단계의 실제 그림이 CHAIN_MAX_ART 안 · ×2 는 들어갈 때만 (187px 은 ×2 · 150px 은 ×1)', () => {
    for (const s of starterList()) {
      for (const c of evolutionChain(s.dex)) {
        const box = spriteBoxOf(c.form);
        expect(box, c.form).toBeDefined();
        expect(box![3] - box![1], c.form).toBeLessThanOrEqual(CHAIN_MAX_ART);
      }
    }
    // 크기 단계 (정보줄 27 을 뺀 높이 · 폭 − 16): 150 · 720 = ×1 · ×1, 187 · 1860 = ×1 · ×2, 443 · 860 (맥 높은 패널) = 큰 단계 — 모두 넘치지 않음
    const big = evolutionChain(650).map((c) => c.form); // 도치마론 → 브리가론 (가장 큰 그림)
    const n = starterList().length;
    const fits = (h: number, w: number, forms: string[]) => {
      const l = pickLayout(h - 27, Math.min(w - 16, 720), n, forms);
      return { l, used: l.topPx + l.contentPx + 2 * l.gapPx };
    };
    const s150 = fits(150, 720, big);
    expect([s150.l.chipZoom, s150.l.chainZoom]).toEqual([1, 1]);
    expect(s150.used).toBeLessThanOrEqual(150 - 27);
    const s187 = fits(187, 1860, big);
    expect([s187.l.chipZoom, s187.l.chainZoom]).toEqual([1, 2]);
    expect(s187.used).toBeLessThanOrEqual(187 - 27);
    const tall = fits(443, 860, big);
    // 높아도 ×2 까지 (×3 · ×4 없앰 — 태현 님 #92 "패널이 커져도 포켓몬은 ×2 고정")
    expect([tall.l.chipZoom, tall.l.chainZoom]).toEqual([2, 2]);
    expect(tall.l.chainZoom).toBeGreaterThanOrEqual(tall.l.chipZoom);
    expect(tall.l.stripRows).toBeGreaterThanOrEqual(2); // 큰 칩은 860 폭에 한 줄로 안 들어가 감음
    expect(tall.used).toBeLessThanOrEqual(443 - 27);
    expect(tall.l.topPx).toBeLessThanOrEqual(8); // 칩 줄 위는 작게 (태현 님)
    // 고른 포켓몬이 바뀌어도 크기 단계는 같음 (목록이 들썩이지 않게)
    for (const [h, w] of [[187, 1860], [210, 1860], [260, 1860], [315, 1860], [443, 860], [300, 480]] as const) {
      const tiers = new Set(starterList().map((st) => { const l = pickLayout(h - 27, Math.min(w - 16, 720), n, evolutionChain(st.dex).map((c) => c.form)); return `${l.chipZoom}x${l.chainZoom}`; }));
      expect(tiers.size, `${h}x${w}`).toBe(1);
    }
  });
  it('같은 점 크기라 원작 그림대로 진화할수록 커짐 (이상해씨 < 이상해풀 < 이상해꽃) · 그림 칸 높이 = 가장 큰 그림', () => {
    const forms = evolutionChain(1).map((c) => c.form);
    const h = forms.map((f) => spriteBoxOf(f)!).map((b) => b[3] - b[1]);
    expect(h[0]!).toBeLessThan(h[1]!);
    expect(h[1]!).toBeLessThan(h[2]!);
    // 바닥 위 가장 큰 키 + 바닥 아래 내려가는 만큼 + 위아래 한 칸씩 (화면 배율에서 발끝이 잘리지 않게 — 2026-10-20 태현 님 "잘려 보이네")
    const bs = forms.map((f) => spriteBoxOf(f)!);
    const up = Math.max(...bs.map((b) => b[4] - b[1]));
    const down = Math.max(...bs.map((b) => b[3] - b[4]));
    expect(chainRowPx(forms, 2)).toBe((up + down + 2) * 2);
  });
  it('바닥 = 가장 오래 보이는 장면의 발끝 — 브리가론은 첫 장면 (0.67초) 발끝 60 · 다른 장면 63 이라 "가장 아래" 로 맞추면 떠 보였음 (태현 님)', () => {
    expect(spriteBoxOf('chesnaught')![4]).toBe(60);
    expect(spriteBoxOf('chesnaught')![3]).toBe(63);
    // 18종 진화 줄 모두 (바닥 위 키 + 아래로 내려가는 만큼) 이 CHAIN_MAX_ART 안 — 크기 단계 계산이 맞게
    for (const st of starterList()) {
      const bs = evolutionChain(st.dex).map((c) => spriteBoxOf(c.form)!);
      expect(Math.max(...bs.map((b) => b[4] - b[1])) + Math.max(...bs.map((b) => b[3] - b[4])), st.name).toBeLessThanOrEqual(CHAIN_MAX_ART);
    }
  });
});
