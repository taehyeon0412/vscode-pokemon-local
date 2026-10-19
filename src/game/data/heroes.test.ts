import { describe, expect, it } from 'vitest';
import { CODE_HERO_ROWS, HERO_LOOKS, heroDraw, heroHeightPx, heroLookOf, heroWidthPx, isHeroLookId, type HeroLook } from './heroes';

describe('S03 주인공 목록 (data/heroes.ts)', () => {
  it('이름은 겹치지 않고 영문 소문자 · 숫자 · - · 남 · 여가 다 있음', () => {
    const ids = HERO_LOOKS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]{1,32}$/);
    expect(HERO_LOOKS.some((l) => l.gender === 'male')).toBe(true);
    expect(HERO_LOOKS.some((l) => l.gender === 'female')).toBe(true);
  });

  it('세이브 → 캐릭터: 아는 이름 · 모르면 성별의 첫 캐릭터 · 그것도 없으면 첫 캐릭터', () => {
    expect(heroLookOf('cap-girl', 'male').id).toBe('cap-girl');
    expect(heroLookOf(undefined, 'female').gender).toBe('female');
    expect(heroLookOf('nobody', 'male').gender).toBe('male');
    expect(heroLookOf(undefined).id).toBe(HERO_LOOKS[0]!.id);
    // 옛 세이브 (look 없음) 의 모습 — 목록 앞에 끼우면 몰래 바뀜
    expect(heroLookOf(undefined, 'male').id).toBe('boy');
    expect(heroLookOf(undefined, 'female').id).toBe('girl');
    expect(isHeroLookId('cap-girl')).toBe(true);
    expect(isHeroLookId('nobody')).toBe(false);
    expect(isHeroLookId(3)).toBe(false);
  });

  it('크기 (A안): 그림은 1배부터 · 자리가 남으면 포켓몬 배율까지 0.5 단위 · 1배로 안 되면 작은 그림 · 그것도 없으면 할 수 없이 줄임', () => {
    const big = { frames: 4, w: 32, h: 48 };
    const small = { frames: 4, w: 20, h: 28 };
    const look: HeroLook = { id: 'x', label: 'x', gender: 'female', walk: big, small: { walk: small } };
    expect(heroDraw(look, 2.5, 200)).toMatchObject({ walkFile: 'walk', scale: 2.5 });
    expect(heroDraw(look, 2.5, 76)).toMatchObject({ walkFile: 'walk', scale: 1.5 }); // 크게 · 140px
    expect(heroDraw(look, 1.5, 49)).toMatchObject({ walkFile: 'walk', scale: 1 }); // 작게 · 92px
    expect(heroDraw(look, 1, 31)).toMatchObject({ walkFile: 'walk-small', scale: 1 }); // 아주 작게 · 68px
    expect(heroDraw(look, 1, 20)!.scale).toBeCloseTo(20 / 28); // 작은 그림도 안 들어감 → 줄임
    expect(heroDraw({ ...look, small: undefined }, 1, 31)!.scale).toBeCloseTo(31 / 48);
    expect(heroHeightPx(look, 1.5, 49)).toBe(48);
    expect(heroWidthPx(look, 1, 31)).toBe(20);
    // 그림이 없으면 코드 그림 — 28 × 배율
    const plain: HeroLook = { id: 'y', label: 'y', gender: 'male' };
    expect(heroDraw(plain, 2)).toBeNull();
    expect(heroHeightPx(plain, 1.5)).toBe(CODE_HERO_ROWS * 1.5);
  });
});
