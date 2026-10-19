import { describe, expect, it } from 'vitest';
import { HERO_LOOKS, HERO_MAX_ROWS, heroArtScale, heroHeightPx, heroLookOf, heroWidthPx, isHeroLookId } from './heroes';

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

  it('키: 코드 그림 28 × 배율 · 그림 사람은 키 28칸을 넘으면 줄여서 (알림 · 띠 · 전투 자리가 28 에 맞춰져 있음)', () => {
    expect(heroHeightPx(heroLookOf('boy'), 1.5)).toBe(42);
    for (const scale of [1, 1.5, 2, 2.5]) {
      for (const look of HERO_LOOKS) expect(heroHeightPx(look, scale), `${look.id} ×${scale}`).toBeLessThanOrEqual(HERO_MAX_ROWS * scale);
    }
    expect(heroArtScale({ id: 'x', label: 'x', gender: 'male', walk: { frames: 4, w: 16, h: 24 } }, 2)).toBe(2);
    expect(heroArtScale({ id: 'x', label: 'x', gender: 'male', walk: { frames: 4, w: 30, h: 42 } }, 3)).toBe(2);
    expect(heroWidthPx(heroLookOf('cap-girl'), 2)).toBe(48);
  });
});
