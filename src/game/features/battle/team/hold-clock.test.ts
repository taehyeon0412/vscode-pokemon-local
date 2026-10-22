/**
 * 3:3 화면 붙잡기 (띠 · 쓰러짐 말 · 결과 줄 — U1 "1초 넘게") 는 진짜 시계 (ui/real-clock) 로 셈 — 게임 시계 (▶▶ ×2) 로 세어 상대 필살기 띠가 0.85 ~ 0.96초만 보이던 것
 * (UX 리뷰어 #95 13바퀴 큼 1 · 같은 띠 세 번째 — ux-rules "다시 안 나오게")
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = (f: string) => readFileSync(join(__dirname, f), 'utf8');

describe('3:3 화면 붙잡기 시계', () => {
  it('TeamLayer — 게임 시계는 큰 연출 판정 (엔진 말 나이와 같은 시계) 한 곳만 · 깨우기는 진짜 타이머', () => {
    const s = src('TeamLayer.tsx');
    expect(s.match(/performance\.now\(\)/g)?.length).toBe(1);
    expect(s).toMatch(/const seenNow = performance\.now\(\)/);
    expect(s).toMatch(/const bandNow = realNow\(\)/);
    expect(s).not.toMatch(/window\.setTimeout/);
  });

  it('TeamBand — 게임 시계는 늦춤 (달려간 칸이 돌아오는 그림 0.3초) 만 · 보이는 길이는 진짜 시계', () => {
    const s = src('TeamBand.tsx');
    const game = s.split('\n').filter((l) => /performance\.now\(\)|window\.setTimeout/.test(l));
    expect(game.length).toBeGreaterThan(0);
    expect(game.every((l) => /gnow|due/.test(l))).toBe(true);
    expect(s).toMatch(/const now = realNow\(\)/);
    expect(s).toMatch(/realLater\(/);
  });
});
