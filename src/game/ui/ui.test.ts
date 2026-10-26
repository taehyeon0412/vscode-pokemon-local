import { describe, expect, it } from 'vitest';
import { formatMoney, formatPlayTime } from './format';
import { HEAD_FADE_STEP_MS, HEAD_FADE_STEPS, HEAD_HOLD_MS, pickHeadSpot } from './HeadNote';
import { fieldTopPx, fitGameLayout, fitLayout, gameSize, hasMapRow, MAP_ROW_PX, minHeightOf, topGapPx } from './layout';
import { spritePx, spriteSrc } from './sprite-path';
import { Store } from './store';

describe('화면 틀 (mvp-spec 1장)', () => {
  it('최소 높이 = 포켓몬 키 × 1.5 + 20: 68 · 92 · 116 · 140', () => {
    expect([minHeightOf('nano'), minHeightOf('small'), minHeightOf('medium'), minHeightOf('large')]).toEqual([68, 92, 116, 140]);
  });

  it('높이가 넉넉하면 설정한 크기 그대로', () => {
    expect(fitLayout('large', 300)).toMatchObject({ size: 'large', scale: 2.5, petPx: 80, tooSmall: false });
    expect(fitLayout('medium', 150)).toMatchObject({ size: 'medium', tooSmall: false });
  });

  it('모자라면 맞을 때까지 한 단계씩 낮춤 (패널을 키우면 원래대로)', () => {
    expect(fitLayout('large', 139).size).toBe('medium');
    expect(fitLayout('large', 100).size).toBe('small');
    expect(fitLayout('large', 68).size).toBe('nano');
    expect(fitLayout('large', 140).size).toBe('large');
  });

  it('게임 모드는 크기 설정과 상관없이 150px 아래면 접힌 상태 (지금 · 필요 px) — 2026-10-19 태현 님 (140 → 150)', () => {
    expect(fitLayout('nano', 149)).toMatchObject({ tooSmall: true, heightPx: 149, needPx: 150 });
    expect(fitLayout('large', 140)).toMatchObject({ size: 'large', tooSmall: true });
    expect(fitLayout('nano', 150)).toMatchObject({ size: 'nano', tooSmall: false });
    expect(fitLayout('large', 150)).toMatchObject({ size: 'large', tooSmall: false, uiScale: 1.3 });
    expect(fitLayout('small', 67)).toMatchObject({ size: 'nano', tooSmall: true, heightPx: 67, needPx: 150 });
    expect(fitLayout('nano', 0).tooSmall).toBe(true);
    expect(fitLayout('nano', Number.NaN)).toMatchObject({ tooSmall: true, heightPx: 0 });
  });

  it('실제 VS Code 테스트만 최소 높이를 바꿀 수 있음 (탐색기 칸이 150px 보다 낮아서)', () => {
    expect(fitLayout('nano', 100, 68)).toMatchObject({ tooSmall: false, needPx: 68 });
    expect(fitLayout('nano', 67, 68).tooSmall).toBe(true);
  });

  it('게임 모드 크기: 설정 · 패널 크기와 상관없이 보통 ×2 (2026-10-22 태현 님 #92 "패널이 커져도 포켓몬은 저걸로 고정")', () => {
    expect([gameSize('nano'), gameSize('small'), gameSize('medium'), gameSize('large'), gameSize('huge')]).toEqual(['medium', 'medium', 'medium', 'medium', 'medium']);
    // 150px 이면 보통이 늘 들어감 · 높아도 · 넓어도 보통
    expect(fitGameLayout(150)).toMatchObject({ size: 'medium', scale: 2, tooSmall: false });
    expect(fitGameLayout(299)).toMatchObject({ size: 'medium', scale: 2 });
    expect(fitGameLayout(300)).toMatchObject({ size: 'medium', scale: 2, petPx: 64, tooSmall: false });
    expect(fitGameLayout(443, undefined, 860)).toMatchObject({ size: 'medium', scale: 2 });
    expect(fitGameLayout(315, undefined, 240)).toMatchObject({ size: 'medium', scale: 2 });
    expect(fitGameLayout(315, undefined, 479)).toMatchObject({ size: 'medium', scale: 2 });
    expect(fitGameLayout(315, undefined, 1860)).toMatchObject({ size: 'medium', scale: 2 });
    expect(fitGameLayout(100).tooSmall).toBe(true);
  });

  it('모르는 크기 설정은 아주 작게로', () => {
    expect(fitLayout('huge', 500)).toMatchObject({ wanted: 'nano', size: 'nano' });
  });

  it('글자 · 버튼 배율은 패널 높이에 맞춰: 92 아래 1 · 92 ~ 139 1.15 · 140 이상 1.3', () => {
    expect(fitLayout('nano', 68).uiScale).toBe(1);
    expect(fitLayout('nano', 91).uiScale).toBe(1);
    expect(fitLayout('nano', 92).uiScale).toBe(1.15);
    expect(fitLayout('nano', 139).uiScale).toBe(1.15);
    expect(fitLayout('nano', 160).uiScale).toBe(1.3);
  });

  it('남는 높이가 없으면 배율을 올리지 않음 — 글자 때문에 포켓몬 크기가 줄지 않게', () => {
    // 크게 (최소 140) 를 140px 에: 남는 높이 0 → 1, 그래도 포켓몬은 크게 그대로
    expect(fitLayout('large', 140)).toMatchObject({ size: 'large', uiScale: 1 });
    // 145px: 남는 5 → 1.15 (정보줄 +3) 는 되고 1.3 (정보줄 +6) 은 안 됨
    expect(fitLayout('large', 145)).toMatchObject({ size: 'large', uiScale: 1.15 });
    expect(fitLayout('large', 146)).toMatchObject({ size: 'large', uiScale: 1.3 });
    // 작게 (최소 92) 를 92px 에: 남는 0 → 1
    expect(fitLayout('small', 92)).toMatchObject({ size: 'small', uiScale: 1 });
  });
});

describe('정보줄 아래 띄움 · 지도 줄 (2026-10-19 태현 님)', () => {
  it('띄움 = 낮은 패널 4 · 중간 6 · 186px 부터 8 (예전 3px — "위 정보바와 너무 붙어 있는 느낌")', () => {
    expect([150, 165, 166, 185, 186, 315].map(topGapPx)).toEqual([4, 4, 6, 6, 8, 8]);
  });

  it('지도 줄은 180px 부터 — 상자 · 판은 그 아래 (띄움 + 18 + 띄움), 낮으면 띄움만', () => {
    expect([150, 179, 180, 315].map(hasMapRow)).toEqual([false, false, true, true]);
    expect(fieldTopPx(150)).toBe(4);
    expect(fieldTopPx(180)).toBe(6 + MAP_ROW_PX + 6);
    expect(fieldTopPx(315)).toBe(8 + MAP_ROW_PX + 8);
  });
});

describe('글자 모양', () => {
  it('플레이 시간', () => {
    expect(formatPlayTime(0)).toBe('0분');
    expect(formatPlayTime(59_999)).toBe('0분');
    expect(formatPlayTime(754_000)).toBe('12분');
    expect(formatPlayTime(3 * 3_600_000 + 5 * 60_000)).toBe('3시간 5분');
    expect(formatPlayTime(-5)).toBe('0분');
    expect(formatPlayTime(Number.NaN)).toBe('0분');
  });

  it('돈', () => {
    expect(formatMoney(0)).toBe('0원');
    expect(formatMoney(1000)).toBe('1,000원');
    expect(formatMoney(1234567)).toBe('1,234,567원');
    expect(formatMoney(-3)).toBe('0원');
  });
});

describe('포켓몬 그림', () => {
  it('세대 폴더 · 색 · 동작', () => {
    expect(spriteSrc('M', 'bulbasaur')).toBe('M/gen1/bulbasaur/default_idle_8fps.gif');
    expect(spriteSrc('M/', 'snivy', { action: 'walk', shiny: true })).toBe('M/gen5/snivy/shiny_walk_8fps.gif');
  });

  it('모르는 모습 · media 없음은 null (빈 칸)', () => {
    expect(spriteSrc('M', 'not-a-pokemon')).toBeNull();
    expect(spriteSrc('', 'bulbasaur')).toBeNull();
  });

  it('키 = 원본 × 배율 (원본 64px 은 두 배)', () => {
    expect(spritePx('bulbasaur', 2)).toBe(64);
    expect(spritePx('frogadier', 1)).toBe(64);
    expect(spritePx('???', 1.5)).toBe(48);
  });
});

describe('Store', () => {
  it('바뀐 것만 알림', () => {
    const s = new Store({ a: 1, b: 'x' });
    let n = 0;
    const off = s.subscribe(() => n++);
    s.set({ a: 1 });
    expect(n).toBe(0);
    s.set({ a: 2 });
    expect(n).toBe(1);
    expect(s.get()).toEqual({ a: 2, b: 'x' });
    off();
    s.set({ b: 'y' });
    expect(n).toBe(1);
  });
});

describe('머리 위 작은 글 자리 (버린 필살기 누름 — 태현 님 10-26 "머리 기준 왼쪽 위 · 서서히 사라짐")', () => {
  const a = { l: 100, t: 60, r: 140, b: 100 };
  const bounds = { l: 0, t: 26, r: 480, b: 187 };
  it('빈 무대 = 머리 왼쪽 위 (아래 끝이 머리 위 끝 위 · 오른쪽 끝이 머리 왼쪽 끝 + 6)', () => {
    expect(pickHeadSpot(a, 60, 13, bounds, [])).toEqual({ l: 46, t: 46 });
  });
  it('패널 왼쪽 끝 · 정보줄에 걸리면 자리만 안쪽으로 (4px · 위 끝)', () => {
    expect(pickHeadSpot({ ...a, l: 10, r: 50 }, 60, 13, bounds, [])).toEqual({ l: 4, t: 46 });
    expect(pickHeadSpot({ ...a, t: 30 }, 60, 13, bounds, []).t).toBe(26);
  });
  it('머리 바로 위가 막히면 왼쪽 위 그대로 위로 올림 (24px 까지)', () => {
    const hp = { l: 30, t: 40, r: 110, b: 58 };
    expect(pickHeadSpot(a, 60, 13, bounds, [hp])).toEqual({ l: 46, t: 26 });
  });
  it('왼쪽 위 (머리 6px 걸침) 가 막히면 글 오른쪽 끝 = 머리 왼쪽 끝 → 그래도 막히면 그때만 오른쪽 위 (기획 10-26)', () => {
    expect(pickHeadSpot(a, 60, 13, bounds, [{ l: 101, t: 20, r: 104, b: 59 }])).toEqual({ l: 40, t: 46 });
    expect(pickHeadSpot(a, 60, 13, bounds, [{ l: 0, t: 0, r: 101, b: 60 }])).toEqual({ l: 134, t: 46 });
  });
  it('3:3 은 머리 왼쪽 위만 — 다 막혀도 그 자리 (글이 포켓몬을 따라감)', () => {
    expect(pickHeadSpot(a, 60, 13, bounds, [], { team: true })).toEqual({ l: 46, t: 46 });
    expect(pickHeadSpot(a, 60, 13, bounds, [{ l: 0, t: 0, r: 480, b: 187 }], { team: true })).toEqual({ l: 46, t: 46 });
  });
  it('3:3 — 왼쪽 위가 옆 칸 합동 칩에 막히면 칩 오른쪽 끝 + 2 (칩 숫자를 키 칸이 덮어 −19 가 −12 로 읽히던 것, UX 리뷰어 #98) · 가로 흰 선은 셈 밖', () => {
    const chip = { l: 20, t: 30, r: 80, b: 50 };
    expect(pickHeadSpot(a, 60, 13, bounds, [chip], { team: true })).toEqual({ l: 82, t: 46 });
    expect(pickHeadSpot(a, 60, 13, bounds, [{ l: 0, t: 44, r: 480, b: 47 }], { team: true }).l).toBe(46);
  });
  it('다 막히면 발밑 (1:1 240 × 150)', () => {
    const wall = [{ l: 0, t: 26, r: 480, b: 99 }];
    expect(pickHeadSpot(a, 60, 13, bounds, wall)).toEqual({ l: 90, t: 101 });
  });
  it('붙잡기 1.1초 (진짜 시계) + 사라짐 3걸음 — 다 보이는 때가 U1 1초를 넘음', () => {
    expect(HEAD_HOLD_MS).toBeGreaterThan(1000);
    expect(HEAD_FADE_STEPS * HEAD_FADE_STEP_MS).toBeLessThan(500);
  });
});
