import { describe, expect, it } from 'vitest';
import { teamGeometry } from './model';

describe('3:3 자리 (디자인팀 4안 시안 geo 그대로)', () => {
  it('860 × 187 = ×2 비스듬히 세 줄 · 앞줄끼리 약 310px · 판 안 잘림', () => {
    const g = teamGeometry(860, 187, 26);
    expect(g.scale).toBe(2);
    expect(g.oneRow).toBe(false);
    const front = [g.pos('me', 2), g.pos('foe', 2)];
    expect(Math.abs(front[1]!.x - front[0]!.x - 310)).toBeLessThanOrEqual(4);
    // 칸 0 (키 1) = 위 · 바깥, 칸 2 (키 3) = 아래 · 가운데
    expect(g.pos('me', 0).y).toBeLessThan(g.pos('me', 2).y);
    expect(g.pos('me', 0).x).toBeLessThan(g.pos('me', 2).x);
    // 발밑 판 (발 + 4 · 높이 14) 이 패널 안
    expect(g.pos('me', 2).y + 4 + 14).toBeLessThanOrEqual(187);
  });

  it('240 × 150 = ×1 · 480 × 150 = ×2 한 줄 (#85 A) · 860 × 315 = ×3 · 넓은 패널은 가운데 860 무대', () => {
    expect(teamGeometry(240, 150, 26).scale).toBe(1);
    const row = teamGeometry(480, 150, 26);
    expect(row.oneRow).toBe(true);
    expect(new Set([0, 1, 2].map((i) => row.pos('me', i).y)).size).toBe(1);
    expect(teamGeometry(860, 315, 26).scale).toBe(3);
    const wide = teamGeometry(1860, 187, 26);
    expect(wide.pos('foe', 0).x - wide.pos('me', 0).x).toBe(teamGeometry(860, 187, 26).pos('foe', 0).x - teamGeometry(860, 187, 26).pos('me', 0).x);
  });

  it('자리는 배율의 배수 (흐림 없게)', () => {
    for (const [w, h] of [[240, 150], [480, 150], [860, 187], [860, 315], [1860, 187]] as const) {
      const g = teamGeometry(w, h, 26);
      for (const side of ['me', 'foe'] as const) for (let i = 0; i < 3; i++) expect(g.pos(side, i).x % g.scale).toBe(0);
    }
  });
});
