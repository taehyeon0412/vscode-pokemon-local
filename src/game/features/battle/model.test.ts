import { describe, expect, it } from 'vitest';
import { sampleMonster, sampleSave } from '../../../test/fixtures/save';
import { TIMING } from '../../core/balance';
import { battleStep, startBattle, type BattleState } from '../../core/engine/battle';
import { Rng } from '../../core/engine/rng';
import { counterMove, isShooting } from '../../core/rules/battle';
import { hasMapRow, MAP_ROW_PX, topGapPx } from '../../ui/layout';
import { allForms, allMoves, formOf, moveOf } from '../../data';
import { battleGeometry, battleSpritePx, battleViewKey, catchFoeClass, catchView, duelKind, hpColor, menuItems, placeOnStage, sentenceText, splitPopups, introView, SEND_FLY_MS, SEND_BURST_MS, WIPE_MS, type DuelKind } from './model';

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
    expect(skills.map((i) => i.label)).toEqual(['1 몸통박치기', '2 덩굴채찍', '← 뒤로']);
    // 옆 메뉴 = "PP 35" (숫자만이면 위력과 헷갈림 — 2026-10-20 플레이 리뷰어)
    expect(skills.map((i) => i.subShort)).toEqual(['PP 35', 'PP 25', undefined]);
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
    // 야생 · 바꿀 포켓몬 있음 = 좁아도 "5 교체·도망" (2026-10-20 플레이 리뷰어 — "5 교체" 만이면 도망칠 수 있는지 모름)
    expect(menuItems(b, save, 'main', true).map((i) => i.label)).toEqual(['1 공격', '2 방어', '3 스킬', '4 아이템', '5 교체·도망']);
    expect(menuItems(b, save, 'main', true)[0]!.title).toContain('공격');
  });

  it('아주 좁은 패널 (300px 아래): 번호 없는 두 글자 — 240 에서 "1 …" 로 잘리던 것 (아트 디렉터 5차), 숫자 키 · title 은 그대로', () => {
    expect(geo(190, 240).tiny).toBe(true);
    expect(geo(190, 320).tiny).toBe(false);
    const b = myTurn(startBattle(save, wild, 'normal'));
    const tiny = menuItems(b, save, 'main', 'tiny');
    expect(tiny.map((i) => i.label)).toEqual(['공격', '방어', '스킬', '가방', '교체']);
    expect(tiny.map((i) => i.num)).toEqual([1, 2, 3, 4, 5]);
    expect(tiny[4]!.title).toContain('도망');
    expect(Math.max(...tiny.map((i) => i.label.length))).toBeLessThanOrEqual(2);
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
    // 개수 = "1개" (× 는 잡기 배율과 헷갈림 — 2026-10-19 태현 님 · 아트 디렉터 5차)
    expect(revive.sub).toBe('1개');
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
      // 한 줄 말은 늘 오른쪽 위 · 옆 메뉴와 안 겹침 — 메뉴가 말 (msgLines 줄, 위 3px + 23 + 15) 아래에서 시작하거나, 말이 메뉴 오른쪽 끝 (어림 170px) 보다 오른쪽
      expect(g.msgHidden).toBe(false);
      expect(g.msgSide).toBeNull();
      expect(g.msgRight).not.toBeNull();
      const msgLeft = 720 - g.msgRight!.right - g.msgRight!.maxWidth;
      expect(s.top >= g.msgTop + 23 + (g.msgLines - 1) * 15 + 2 || msgLeft >= s.left + Math.min(s.maxWidth, 170)).toBe(true);
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

describe('넓은 패널 전투 무대 (placeOnStage, 2026-10-19)', () => {
  // 720 무대에서 잰 자리 (야생 = 무대 안 만난 자리 324 + 80)
  const inStage = battleGeometry({ widthPx: 720, bodyPx: 212 - 26, scale: 2, uiScale: 1.3, ground: 23, foeX: 404, meSpritePx: 64, foeSpritePx: 64, heroPx: 40, heroWidthPx: 32 });

  it('무대 = 패널 (좁은 패널) 이면 그대로', () => {
    expect(placeOnStage(inStage, { left: 0, width: 720 }, 720)).toBe(inStage);
  });

  it('넓은 패널은 x 만 무대 왼쪽 끝만큼 옮기고, 오른쪽에서 잰 한 줄 말은 무대 오른쪽 밖만큼 더함', () => {
    const g = placeOnStage(inStage, { left: 512, width: 720 }, 1858);
    expect([g.trainerX, g.meX, g.foeX, g.meHpX, g.foeHpX, g.autoLeft]).toEqual([inStage.trainerX, inStage.meX, inStage.foeX, inStage.meHpX, inStage.foeHpX, inStage.autoLeft].map((x) => x + 512));
    expect(g.menuSide?.left).toBe((inStage.menuSide?.left ?? 0) + 512);
    expect(g.msgRight?.right).toBe((inStage.msgRight?.right ?? 0) + (1858 - 512 - 720));
    expect([g.meHpBottom, g.foeHpBottom, g.menuSide?.top]).toEqual([inStage.meHpBottom, inStage.foeHpBottom, inStage.menuSide?.top]);
  });

  it('두 포켓몬 사이 · 트레이너와 내 포켓몬 사이가 720 화면과 같음 (1858 패널에서 565px 떨어지던 것)', () => {
    const g = placeOnStage(inStage, { left: 512, width: 720 }, 1858);
    expect(g.foeX - g.meX).toBe(inStage.foeX - inStage.meX);
    expect(g.foeX - g.meX).toBeLessThan(260);
    expect(g.meX - g.trainerX).toBeLessThan(200);
  });
});

describe('지도 줄 아래 · 긴 한 줄 말 (2026-10-19 태현 님)', () => {
  // 실제 화면처럼: 패널 h → 길 칸 h − 26, 지도 줄이 있으면 (180px 이상) 위 띄움 + 18 을 비움 (StageScreen 과 같은 값)
  const real = (h: number, foeX: number, foeTrainer = false, heroPx = 40) =>
    battleGeometry({ widthPx: 720, bodyPx: h - 26, scale: 2, uiScale: 1.3, ground: 23, foeX, meSpritePx: 64, foeSpritePx: 64, heroPx, heroWidthPx: 32, topPx: hasMapRow(h) ? topGapPx(h) + MAP_ROW_PX : 0, gapPx: topGapPx(h), foeTrainer });

  it('HP 묶음 · 옆 메뉴가 지도 줄에 안 겹침 (180 ~ 330px · 야생 · 트레이너 자리)', () => {
    for (let h = 180; h <= 330; h += 10) {
      for (const foeX of [404, 560]) {
        const g = real(h, foeX);
        const body = h - 26;
        const top = topGapPx(h) + MAP_ROW_PX;
        expect(body - (g.meHpBottom + g.hpBlockPx)).toBeGreaterThanOrEqual(top + 4);
        expect(body - (g.foeHpBottom + g.hpBlockPx + 4)).toBeGreaterThanOrEqual(top + 4);
        if (g.menuSide) expect(g.menuSide.top).toBeGreaterThanOrEqual(top);
      }
    }
  });

  it('트레이너전 (상대가 오른쪽 끝) 이라도 긴 말은 무대 왼쪽 끝까지 · 자리가 있으면 두 줄 — "상대 도토링이 쓰러졌다! 곤충채…" 로 잘리던 것', () => {
    const g = real(315, 560, true, 64);
    expect(g.topBusy).toBe(false);
    expect(g.msgRight).not.toBeNull();
    expect(g.msgRight!.maxWidth).toBeGreaterThanOrEqual(600);
    expect(g.msgLines).toBe(2);
  });

  it('두 줄은 둘째 줄 아래가 빌 때만 — 위가 붐벼 상대 오른쪽에 둘 때도 · 트레이너전은 오른쪽 끝 이름표 (땅 + 키 + 16) 위까지', () => {
    // 150px 야생: 위가 붐벼 상대 오른쪽 — 그 아래가 비어 두 줄
    expect(real(150, 412).topBusy).toBe(true);
    expect(real(150, 412).msgLines).toBe(2);
    // 트레이너전 (사람 키 64): 150px 은 이름표에 걸려 한 줄
    expect(real(150, 480, true, 64).msgLines).toBe(1);
    // 옆 메뉴가 말 높이에 걸치면 말은 메뉴 오른쪽부터
    for (const foeX of [412, 480]) {
      const g = real(150, foeX);
      if (g.msgRight && g.menuSide && g.menuSide.top < g.msgTop + 23 + 15 + 2) expect(720 - g.msgRight.right - g.msgRight.maxWidth).toBeGreaterThanOrEqual(g.menuSide.left + Math.min(g.menuSide.maxWidth, 170));
    }
  });

  it('전투 동안 지도 줄 — 190px 은 위가 붐벼 (StageScreen 이 지도를 정보줄 안으로), 210 · 315px 은 지도 줄 그대로 둘 자리가 있음', () => {
    expect(real(190, 404).topBusy).toBe(true);
    expect(real(210, 404).topBusy).toBe(false);
    expect(real(315, 560, true, 64).topBusy).toBe(false);
  });

  it('한 줄 말 위 띄움은 자리가 모자라면 줄임 (최소 3) — 480 × 190 가로 메뉴: 띄움 8 이면 1px 모자라 말이 숨던 것', () => {
    const narrow = battleGeometry({ widthPx: 480, bodyPx: 190 - 26, scale: 2, uiScale: 1.3, ground: 23, foeX: 330, meSpritePx: 64, foeSpritePx: 64, heroPx: 40, heroWidthPx: 32, gapPx: 8 });
    expect(narrow.msgHidden).toBe(false);
    expect(narrow.msgTop).toBeGreaterThanOrEqual(3);
    expect(narrow.msgTop).toBeLessThan(8);
    // 자리가 넉넉하면 띄움 그대로 (지도 줄 아래 8)
    // 자리가 넉넉하면 지도 줄 아래 띄움보다 아래 — 옆 메뉴 탭 · 상대 HP 묶음 위 8px (싸우는 곳 가까이, 아트 디렉터 3차)
    const tall = real(315, 560, true, 64);
    expect(tall.msgTop).toBeGreaterThan(8 + MAP_ROW_PX + 8);
    expect(tall.msgTop + 23 + (tall.msgLines - 1) * 15 + 8).toBeLessThanOrEqual(tall.menuSide!.top);
    expect(tall.msgTop + 23 + (tall.msgLines - 1) * 15 + 8).toBeLessThanOrEqual(315 - 26 - (tall.foeHpBottom + tall.hpBlockPx + 4));
  });
});

describe('머리 위 글 — 숫자만 머리 위, 문장은 말 칸 (2026-10-20 플레이 리뷰어)', () => {
  const pop = (id: number, side: 'me' | 'foe', kind: Parameters<typeof splitPopups>[0][number]['kind'], text: string) => ({ id, side, kind, text, ms: 0 });

  it('-N → 상성 → 급소 = 숫자 하나 (굉장 = 크게 · 급소 = "!") · 문장 둘은 말 칸으로', () => {
    const { numbers, sentences } = splitPopups([pop(1, 'foe', 'damage', '-15'), pop(2, 'foe', 'super', '효과가 굉장했다!'), pop(3, 'foe', 'crit', '급소에 맞았다!')]);
    expect(numbers).toEqual([{ id: 1, side: 'foe', kind: 'damage', text: '-15!', size: 'big', crit: true }]);
    expect(sentences.map((s) => s.text)).toEqual(['효과가 굉장했다!', '급소에 맞았다!']);
  });

  it('별로 = 작게 · 다른 쪽 · 다음 숫자의 상성은 안 섞임 (연속기 · 흡수)', () => {
    const { numbers } = splitPopups([pop(1, 'foe', 'damage', '-3'), pop(2, 'foe', 'weak', '효과가 별로인 듯하다…'), pop(3, 'me', 'heal', '+2'), pop(4, 'foe', 'damage', '-3')]);
    expect(numbers.map((n) => [n.text, n.size])).toEqual([['-3', 'small'], ['+2', 'normal'], ['-3', 'normal']]);
  });

  it('상태 문장은 누가 걸렸는지 붙임 · 나머지는 그대로', () => {
    const name = (s: 'me' | 'foe') => (s === 'me' ? '이상해씨' : '파이리');
    expect(sentenceText(pop(5, 'me', 'status', '독에 걸렸다!'), name)).toBe('이상해씨는 독에 걸렸다!');
    expect(sentenceText(pop(6, 'foe', 'miss', '빗나갔다!'), name)).toBe('빗나갔다!');
  });
});

describe('전투 시작 연출 (2026-10-20 태현 님 B + C · 야생 A)', () => {
  const base = startBattle(save, wild, 'normal');
  it('야생 = 짧은 화면 닦기만 (볼 없음) · 끝나면 없음', () => {
    expect(introView({ ...base, t: 0 })).toEqual({ me: null, foe: null, wipe: 0 });
    expect(introView({ ...base, t: WIPE_MS }).wipe).toBeNull();
  });
  it('트레이너전 시작 = 양쪽 볼 (전투 시간 기준) · 상대가 다음 포켓몬을 낼 때 = 상대만 (내보내는 시간 기준)', () => {
    const tb = { ...base, kind: 'trainer' as const };
    expect(introView({ ...tb, t: 100 })).toEqual({ me: 100, foe: 100, wipe: null });
    expect(introView({ ...tb, t: SEND_FLY_MS + SEND_BURST_MS })).toEqual({ me: null, foe: null, wipe: null });
    // 다음 포켓몬 = 내보내는 시간 끝 무렵 볼만 (쓰러진 포켓몬은 그대로, 새 포켓몬은 붙을 때 나옴)
    expect(introView({ ...tb, t: 9000, phase: 'send', sendMs: 200 })).toEqual({ me: null, foe: null, wipe: null, sendBall: null });
    expect(introView({ ...tb, t: 9000, phase: 'send', sendMs: TIMING.foeSendMs - SEND_FLY_MS - SEND_BURST_MS + 100 }).sendBall).toBe(100);
  });
});

describe('S11 잡기 장면 (2026-10-20 태현 님 다시 기획) — 엔진 시간표대로', () => {
  const at = (ms: number, o: Partial<NonNullable<BattleState['catch']>> = {}, used = 1): BattleState => {
    const b = startBattle(save, wild, 'normal');
    return { ...b, phase: 'catch', bagUsed: { 'poke-ball': used }, catch: { ball: 'poke-ball', ms, pressMs: null, throwMs: 0, shakes: 2, last: false, caught: false, startT: 0, ...o } };
  };
  it('원 → 날아감 → 빨려 들어감 → 떨어짐 → 흔들 × 횟수 → 딸깍 · 터짐, 장면마다 다시 그림 (열쇠)', () => {
    expect(catchView(at(300, { throwMs: null, caught: null, shakes: 0 }))?.stage).toBe('ring');
    const fly = TIMING.catchFlyMs;
    const suck = fly + TIMING.catchSuckMs;
    const drop = suck + TIMING.catchDropMs;
    expect(catchView(at(fly - 1))).toMatchObject({ stage: 'fly', since: fly - 1 });
    expect(catchView(at(fly + 10))).toMatchObject({ stage: 'suck', since: 10 });
    expect(catchView(at(suck))?.stage).toBe('drop');
    expect(catchView(at(drop + 5))).toMatchObject({ stage: 'shake', since: 5, shakes: 2 });
    expect(catchView(at(drop + 2 * TIMING.catchShakeMs))?.stage).toBe('end');
    expect(battleViewKey(at(drop - 1), false)).not.toBe(battleViewKey(at(drop), false));
  });
  it('남은 기회 = 이번 볼 포함 (3/3 · 2/3 · 1/3) · 상대 그림 class (빨려 들어감 · 숨김 · 튀어나옴)', () => {
    expect([1, 2, 3].map((u) => catchView(at(0, {}, u))?.left)).toEqual([3, 2, 1]);
    const drop = TIMING.catchFlyMs + TIMING.catchSuckMs;
    expect(catchFoeClass(at(TIMING.catchFlyMs))).toBe('pg-catch-suck');
    expect(catchFoeClass(at(drop + 5))).toBe('pg-catch-gone');
    const end = drop + TIMING.catchDropMs + 2 * TIMING.catchShakeMs;
    expect(catchFoeClass(at(end))).toBe('pg-catch-pop');
    expect(catchFoeClass(at(end, { caught: true }))).toBe('pg-catch-gone');
    expect(catchFoeClass(at(10, { throwMs: null, caught: null }))).toBe('');
  });
});
