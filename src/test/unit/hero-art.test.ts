import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HERO_LOOKS } from '../../game/data/heroes';

/** PNG 머리 (IHDR) 의 가로 · 세로 */
function pngSize(file: string): { w: number; h: number } {
  const b = readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

const PEOPLE = join(__dirname, '..', '..', '..', 'extension', 'media', 'people');

describe('S03 사람 그림 파일 (extension/media/people)', () => {
  it('그림이 있는 캐릭터는 파일 크기가 장면 수 × 한 장면 크기와 맞음 (어긋나면 걸을 때 옆 장면이 비침)', () => {
    for (const look of HERO_LOOKS) {
      const sets = [['walk', look.walk], ['front', look.front], ['walk-small', look.small?.walk], ['front-small', look.small?.front]] as const;
      for (const [file, art] of sets) {
        if (!art) continue;
        expect(art.frames, `${look.id} ${file}`).toBeGreaterThanOrEqual(1);
        expect(pngSize(join(PEOPLE, look.dir ?? look.id, `${file}.png`)), `${look.id} ${file}.png`).toEqual({ w: art.w * art.frames, h: art.h });
      }
      if (look.walk) expect(look.walk.frames, look.id).toBeGreaterThanOrEqual(2);
      // 정면도 같은 키 — 고르기 칸 높이가 튀지 않게
      if (look.walk && look.front) expect(look.front.h, `${look.id} 정면 키`).toBe(look.walk.h);
      if (look.small?.front) expect(look.small.front.h, `${look.id} 작은 정면 키`).toBe(look.small.walk.h);
      // 작은 그림은 가장 낮은 패널 (아주 작게 68px — 쓸 수 있는 높이 약 31px) 에 1배로 들어가게
      if (look.small) expect(look.small.walk.h, `${look.id} 작은 그림 키`).toBeLessThanOrEqual(30);
      if (look.small && look.walk) expect(look.small.walk.h, `${look.id} 작은 그림이 큰 그림보다 작게`).toBeLessThan(look.walk.h);
    }
  });
});
