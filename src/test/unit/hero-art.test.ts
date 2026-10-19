import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HERO_LOOKS, HERO_MAX_ROWS } from '../../game/data/heroes';

/** PNG 머리 (IHDR) 의 가로 · 세로 */
function pngSize(file: string): { w: number; h: number } {
  const b = readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

const PEOPLE = join(__dirname, '..', '..', '..', 'extension', 'media', 'people');

describe('S03 사람 그림 파일 (extension/media/people)', () => {
  it('그림이 있는 캐릭터는 파일 크기가 장면 수 × 한 장면 크기와 맞음 (어긋나면 걸을 때 옆 장면이 비침)', () => {
    for (const look of HERO_LOOKS) {
      for (const [kind, art] of [['walk', look.walk], ['front', look.front]] as const) {
        if (!art) continue;
        expect(art.frames, `${look.id} ${kind}`).toBeGreaterThanOrEqual(1);
        expect(pngSize(join(PEOPLE, look.id, `${kind}.png`)), `${look.id} ${kind}.png`).toEqual({ w: art.w * art.frames, h: art.h });
      }
      if (look.walk) expect(look.walk.frames, look.id).toBeGreaterThanOrEqual(2);
      // 키 28칸 이하로 넣기 — 더 크면 화면에서 소수 배로 줄며 점이 빠짐 (scripts/people/rewalk.py 마지막 인자로 미리 줄이기)
      if (look.walk) expect(look.walk.h, `${look.id} 걷기 키`).toBeLessThanOrEqual(HERO_MAX_ROWS);
      // 정면도 같은 키 — 고르기 칸 높이가 튀지 않게
      if (look.walk && look.front) expect(look.front.h, `${look.id} 정면 키`).toBe(look.walk.h);
    }
  });

});
