import { describe, expect, it } from 'vitest';
import { sampleMonster, sampleSave } from '../../../test/fixtures/save';
import { TIMING } from '../../core/balance';
import { battleStep, startBattle, type BattleState } from '../../core/engine/battle';
import { Rng } from '../../core/engine/rng';
import { counterMove, isShooting } from '../../core/rules/battle';
import { allForms, allMoves, formOf, moveOf } from '../../data';
import { battleGeometry, battleSpritePx, battleViewKey, duelKind, hpColor, menuItems, type DuelKind } from './model';

const wild = sampleMonster({ uid: 'wild', species: 4, form: 'charmander', level: 5, moves: [{ moveId: 52, pp: 25 }], hp: 999 });
const save = sampleSave();
const myTurn = (b: BattleState): BattleState => ({ ...b, phase: 'choose', me: { ...b.me, gauge: 1 } });

describe('S09 ⑦ 메뉴 한 줄', () => {
  it('1 공격 · 2 방어 · 3 스킬 · 4 아이템 · 5 교체 · 도망 — 내 차례가 아니면 흐림', () => {
    const b = startBattle(save, wild, 'normal');
    const main = menuItems(b, save, 'main');
    expect(main.map((i) => i.num)).toEqual([1, 2, 3, 4, 5]);
    expect(main.map((i) => i.label)).toEqual(['1 공격', '2 방어', '3 스킬', '4 아이템', '5 교체·도망']);
    expect(main.every((i) => !i.enabled)).toBe(true);
    const turn = menuItems(myTurn(b), save, 'main');
    expect(turn.find((i) => i.key === 'attack')?.enabled).toBe(true);
    expect(turn.find((i) => i.key === 'skills')?.enabled).toBe(true);
  });

  it('3 스킬 → 같은 줄이 기술 목록 (PP 표시) + ← 뒤로', () => {
    const b = myTurn(startBattle(save, wild, 'normal'));
    const skills = menuItems(b, save, 'skills');
    expect(skills.map((i) => i.label)).toEqual(['1 몸통박치기', '2 덩굴채찍', '←']);
    expect(skills.map((i) => i.sub)).toEqual(['35/35', '25/25', undefined]);
    expect(skills.at(-1)?.go).toEqual({ back: true });
  });

  it('바꿀 포켓몬이 없으면 5 = 도망 하나', () => {
    const solo = { ...save, party: ['m1'] };
    const b = myTurn(startBattle(solo, wild, 'normal'));
    const five = menuItems(b, solo, 'main').find((i) => i.num === 5)!;
    expect(five.label).toBe('5 도망');
    expect(five.go).toEqual({ action: { kind: 'flee' } });
  });

  it('HP 바 색: 반 넘음 · 반 아래 · 5분의 1 아래', () => {
    expect(hpColor(30, 40)).toBe('ok');
    expect(hpColor(15, 40)).toBe('mid');
    expect(hpColor(5, 40)).toBe('low');
    expect(hpColor(0, 0)).toBe('low');
  });
});

describe('쏘는 기술 짝짓기 표 (mvp-spec S10 · 9장)', () => {
  const KINDS: DuelKind[] = ['beam', 'bolt', 'orb', 'dome', 'ground', 'tornado', 'storm', 'meteor', 'swarm', 'rush', 'wave'];

  it('쏘는 기술은 모두 11종 중 하나에 짝지어짐', () => {
    const shooting = allMoves().filter(isShooting);
    expect(shooting.length).toBeGreaterThan(50);
    for (const mv of shooting) expect(KINDS).toContain(duelKind(mv.id));
  });

  it('대표 기술 — 전기 = 번개 · 바위 = 운석 · 하이드로펌프 = 광선', () => {
    expect(duelKind(85)).toBe('bolt'); // 10만볼트
    expect(duelKind(88)).toBe('meteor'); // 돌떨구기
    expect(duelKind(56)).toBe('beam'); // 하이드로펌프
    expect(duelKind(null)).toBe('beam');
  });
});

describe('S09 화면 자리 (gdd S09)', () => {
  const geo = (heightPx: number, widthPx = 600, uiScale = 1, scale = 1) =>
    battleGeometry({ widthPx, bodyPx: heightPx - Math.round(20 * uiScale), scale, uiScale, ground: 13, foeX: Math.round(widthPx * 0.45) + 44 * scale, meSpritePx: 32 * scale, foeSpritePx: 32 * scale, heroPx: 28 * scale });

  it('왼쪽 끝 트레이너 < 내 포켓몬 < 야생 (튀어나온 자리 그대로)', () => {
    const g = geo(200);
    expect(g.trainerX).toBeLessThan(g.meX);
    expect(g.meX).toBeLessThan(g.foeX);
    expect(g.foeX).toBe(Math.round(600 * 0.45) + 44);
  });

  it('가장 낮은 패널 (68px) 이면 메뉴는 정보줄 자리 · HP 바는 화면 안 · 자동 스위치는 메뉴 줄 앞', () => {
    const g = geo(68);
    expect(g.menuInBar).toBe(true);
    expect(g.autoInMenu).toBe(true);
    expect(g.meHpBottom + g.hpBlockPx).toBeLessThanOrEqual(48);
  });

  it('높이가 넉넉하면 메뉴는 내 HP 바 바로 위 · 자동 스위치는 트레이너 머리 위', () => {
    const g = geo(200);
    expect(g.menuInBar).toBe(false);
    expect(g.menuBottom).toBe(g.meHpBottom + g.hpBlockPx);
    expect(g.msgSide).toBeNull();
    expect(g.autoInMenu).toBe(false);
  });

  it('좁은 패널: 메뉴는 패널 왼쪽 끝부터 짧은 이름으로', () => {
    const g = geo(200, 260);
    expect(g.compact).toBe(true);
    expect(g.menuLeft).toBe(6);
    expect(geo(200, 720).compact).toBe(false);
    const b = myTurn(startBattle(save, wild, 'normal'));
    expect(menuItems(b, save, 'main', true).map((i) => i.label)).toEqual(['1 공격', '2 방어', '3 스킬', '4 가방', '5 교체']);
    expect(menuItems(b, save, 'main', true)[0]!.title).toContain('공격');
  });

  it('낮은 패널: 지금 한 줄이 HP 바를 가리지 않게 상대 오른쪽으로 (자리가 없으면 위 가운데)', () => {
    const g = geo(68);
    expect(g.msgSide).not.toBeNull();
    expect(g.msgSide!.left).toBeGreaterThan(g.foeX);
    expect(geo(68, 200).msgSide).toBeNull();
  });
});

describe('화면 다시 그릴지 보는 열쇠', () => {
  it('내 차례를 기다리는 동안은 안 바뀜 (초당 30번 다시 그리지 않게) · 게이지가 차면 바뀜', () => {
    const b = startBattle(save, wild, 'normal');
    const rng = new Rng(1);
    let x = b;
    for (let t = 0; t < 30_000 && x.phase !== 'choose'; t += TIMING.simStepMs) x = battleStep(x, save, TIMING.simStepMs, rng, { auto: false });
    expect(x.phase).toBe('choose');
    const later = battleStep(battleStep(x, save, 50, rng, { auto: false }), save, 50, rng, { auto: false });
    expect(battleViewKey(later, false)).toBe(battleViewKey(x, false));
    expect(battleViewKey(b, false)).not.toBe(battleViewKey(battleStep(b, save, 100, rng, { auto: false }), false));
  });
});

describe('단계 5 · 6 검토에서 고친 것 — 화면 (bugs #104 ~)', () => {
  const five = (): typeof save => {
    const ms = { ...save.monsters };
    const party = ['m1', 'm2'];
    for (let i = 3; i <= 5; i++) {
      ms[`m${i}`] = { ...save.monsters.m2!, uid: `m${i}` };
      party.push(`m${i}`);
    }
    return { ...save, monsters: ms, party };
  };

  it('교체: 팀 5마리면 바꿀 포켓몬 4마리 (1 ~ 4) + 5 도망 (명세 검사관 · 플레이 리뷰어)', () => {
    const s = five();
    const items = menuItems(myTurn(startBattle(s, wild, 'normal')), s, 'switch');
    expect(items.filter((i) => 'action' in i.go && i.go.action.kind === 'switch').map((i) => i.num)).toEqual([1, 2, 3, 4]);
    expect(items.find((i) => i.key === 'flee')?.num).toBe(5);
  });

  it('4 아이템이 흐린 까닭: 아이템은 있는데 지금 못 쓰는 것과 아예 없는 것을 구별 (플레이 리뷰어)', () => {
    const withPotion = { ...save, bag: { potion: 2 } }; // 볼은 야생에게 늘 쓸 수 있어서 상처약만
    const full = myTurn(startBattle(withPotion, wild, 'normal'));
    const atFull = { ...full, me: { ...full.me, hp: full.me.maxHp } };
    expect(menuItems(atFull, withPotion, 'main').find((i) => i.key === 'items')?.title).toContain('지금 쓸 수 있는');
    const none = { ...save, bag: {} };
    expect(menuItems(myTurn(startBattle(none, wild, 'normal')), none, 'main').find((i) => i.key === 'items')?.title).toContain('아이템이 없어요');
  });

  it('기력의조각 → 살릴 포켓몬 고르기 페이지', () => {
    const s = { ...save, bag: { ...save.bag, revive: 1 }, monsters: { ...save.monsters, m2: { ...save.monsters.m2!, hp: 0 } } };
    const b = myTurn(startBattle(s, wild, 'normal'));
    const revive = menuItems(b, s, 'items').find((i) => i.key === 'revive')!;
    expect(revive.enabled).toBe(true);
    expect(revive.go).toEqual({ page: 'revive' });
    const page = menuItems(b, s, 'revive');
    expect(page[0]?.go).toEqual({ action: { kind: 'item', item: 'revive', uid: 'm2' } });
  });

  it('큰 포켓몬 (원본 64px) 전투 크기 = min(보통 키 × 1.3, 패널 높이 − 36) (gdd 3.0 — 명세 검사관)', () => {
    expect(battleSpritePx('bulbasaur', 2, 200)).toBe(64);
    const big = allForms().find((f) => (formOf(f)?.size ?? 32) === 64)!;
    expect(battleSpritePx(big, 2, 200)).toBe(Math.round(64 * 1.3));
    expect(battleSpritePx(big, 1, 68)).toBe(32);
  });

  it('맞받아치기 기술 = 같은 모양 (짝짓기 표) 먼저 → 같은 타입 → 가장 센 것 (명세 검사관 "같은 종류")', () => {
    const b = startBattle(save, wild, 'normal');
    // 불꽃세례 (불꽃 · 광선) ← 물대포 (물결) · 10만볼트 (번개) · 오로라빔 (얼음 · 광선) → 오로라빔
    const me = { ...b.me, moves: [{ moveId: 55, pp: 5 }, { moveId: 85, pp: 5 }, { moveId: 62, pp: 5 }] };
    expect(counterMove(me, moveOf(52)!)?.id).toBe(62);
  });
});

describe('좁은 패널 자리 (테스터)', () => {
  const at = (w: number, h: number, scale: number, uiScale: number) =>
    battleGeometry({ widthPx: w, bodyPx: h - Math.round(20 * uiScale), scale, uiScale, ground: 13, foeX: Math.max(48, Math.round(w * 0.45)) + 44 * scale, meSpritePx: 32 * scale, foeSpritePx: 32 * scale, heroPx: 28 * scale });

  it('두 HP 묶음이 겹치지 않고 화면 안에 있음 (240 · 280 · 320px)', () => {
    for (const [w, h, s, u] of [[240, 200, 2, 1.3], [280, 200, 2, 1.3], [320, 220, 2.5, 1.3], [240, 68, 1, 1]] as const) {
      const g = at(w, h, s, u);
      expect(g.meHpX + g.meHpWide / 2).toBeLessThanOrEqual(g.foeHpX - g.foeHpWide / 2 + 1);
      expect(g.meHpX - g.meHpWide / 2).toBeGreaterThanOrEqual(0);
      expect(g.foeHpX + g.foeHpWide / 2).toBeLessThanOrEqual(w);
    }
  });

  it('지금 한 줄: 둘 곳이 없으면 숨김 (HP 바를 가리지 않게)', () => {
    const g = at(240, 68, 1, 1);
    expect(g.msgSide === null && g.msgHidden).toBe(true);
    expect(at(720, 200, 2, 1.3).msgHidden).toBe(false);
  });

  it('가로 메뉴 줄이 정보줄 바로 밑까지 오면 한 줄은 메뉴 오른쪽 끝 뒤에 · 자리가 없으면 숨김 — 게이지 · 💥Z 위에 안 겹침 (2026-10-19, bugs #289)', () => {
    // 상대가 가까워 (330) 옆 메뉴가 안 들어가는 720 × 161 → 예전 가로 한 줄이 정보줄 바로 밑 (HP 묶음이 1px 커져 160 은 정보줄 자리로 감)
    const g = battleGeometry({ widthPx: 720, bodyPx: 161 - 26, scale: 2, uiScale: 1.3, ground: 23, foeX: 330, meSpritePx: 64, foeSpritePx: 64, heroPx: 40, heroWidthPx: 32 });
    expect(g.menuSide).toBeNull();
    expect(g.menuInBar).toBe(false);
    if (g.msgSide) expect(g.msgSide.left).toBeGreaterThanOrEqual(g.menuLeft + 380 * 1.3);
    else expect(g.msgHidden).toBe(true);
  });

  it('옆 메뉴 (Sea of Stars, 2026-10-19 태현 님): 내 포켓몬 · HP 묶음 오른쪽 ~ 상대 왼쪽 사이 · 위 정보줄은 그대로 · 한 줄은 메뉴와 상대 HP 를 피함', () => {
    for (const [h, foeX] of [[150, 412], [150, 480], [190, 460]] as const) {
      const g = battleGeometry({ widthPx: 720, bodyPx: h - 26, scale: 2, uiScale: 1.3, ground: 23, foeX, meSpritePx: 64, foeSpritePx: 64, heroPx: 40, heroWidthPx: 32 });
      expect(g.menuSide).not.toBeNull();
      const s = g.menuSide!;
      expect(g.menuInBar).toBe(false);
      expect(s.left).toBeGreaterThanOrEqual(g.meHpX + g.meHpWide / 2);
      expect(s.left + s.maxWidth).toBeLessThanOrEqual(g.foeHpX - g.foeHpWide / 2);
      expect(s.left + s.maxWidth).toBeLessThanOrEqual(g.foeX - 32);
      // 탭 줄 13 + 판 (5줄 × 13 + 6) 이 길 칸 안 · 판 위 끝은 내 HP 묶음 위 끝에 맞춤 (넘치면 올림, 탭 자리는 남김)
      const body = h - 26;
      expect(s.top + 13 + 13 * 5 + 6).toBeLessThanOrEqual(body - 2);
      expect(s.top + s.maxHeight).toBe(body - 2);
      expect(s.top + 13).toBe(Math.max(14, Math.min(body - (g.meHpBottom + g.hpBlockPx), body - 2 - 71)));
      // 한 줄 말은 늘 오른쪽 위 · 옆 메뉴 오른쪽 끝보다 오른쪽
      expect(g.msgHidden).toBe(false);
      expect(g.msgSide).toBeNull();
      expect(g.msgRight).not.toBeNull();
      expect(720 - g.msgRight!.right - g.msgRight!.maxWidth).toBeGreaterThanOrEqual(s.left + s.maxWidth);
    }
    // 좁은 패널 · 상대가 바로 옆이면 예전 가로 한 줄
    expect(battleGeometry({ widthPx: 400, bodyPx: 150 - 26, scale: 2, uiScale: 1.3, ground: 23, foeX: 300, meSpritePx: 64, foeSpritePx: 64, heroPx: 40, heroWidthPx: 32 }).menuSide).toBeNull();
    expect(battleGeometry({ widthPx: 720, bodyPx: 150 - 26, scale: 2, uiScale: 1.3, ground: 23, foeX: 300, meSpritePx: 64, foeSpritePx: 64, heroPx: 40, heroWidthPx: 32 }).menuSide).toBeNull();
  });

  it('넓은 패널 (190) 은 위 한 줄 자리가 있어 그대로 (가운데 · 또는 옆 메뉴면 오른쪽 위)', () => {
    const tall = battleGeometry({ widthPx: 720, bodyPx: 190 - 26, scale: 1.5, uiScale: 1.3, ground: 18, foeX: 400, meSpritePx: 48, foeSpritePx: 48, heroPx: 20, heroWidthPx: 16 });
    expect(tall.msgSide === null && !tall.msgHidden).toBe(true);
  });

  it('자동 스위치가 내 HP 묶음을 가리면 메뉴 줄 앞으로', () => {
    expect(at(240, 200, 2, 1.3).autoInMenu).toBe(true);
    expect(at(720, 200, 2, 1.3).autoInMenu).toBe(false);
  });
});
