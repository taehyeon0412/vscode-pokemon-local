import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** GIF 의 장면 칸 (이미지 설명 블록) 들 — 헤더 · 확장 블록을 건너뛰며 읽음 */
function frameRects(buf: Buffer): { w: number; h: number; frames: { x: number; y: number; w: number; h: number }[] } {
  const w = buf.readUInt16LE(6);
  const h = buf.readUInt16LE(8);
  let at = 13;
  if (buf[10]! & 0x80) at += 3 * (1 << ((buf[10]! & 7) + 1));
  const skipBlocks = () => {
    while (buf[at]! !== 0) at += buf[at]! + 1;
    at += 1;
  };
  const frames: { x: number; y: number; w: number; h: number }[] = [];
  while (at < buf.length) {
    const b = buf[at]!;
    if (b === 0x3b) break;
    if (b === 0x21) {
      at += 2;
      skipBlocks();
    } else if (b === 0x2c) {
      frames.push({ x: buf.readUInt16LE(at + 1), y: buf.readUInt16LE(at + 3), w: buf.readUInt16LE(at + 5), h: buf.readUInt16LE(at + 7) });
      const flags = buf[at + 9]!;
      at += 10;
      if (flags & 0x80) at += 3 * (1 << ((flags & 7) + 1));
      at += 1; // LZW 최소 코드 크기
      skipBlocks();
    } else {
      break;
    }
  }
  return { w, h, frames };
}

const MEDIA = join(__dirname, '..', '..', '..', 'extension', 'media');

describe('포켓몬 GIF 장면 (2026-10-20 — scripts/gif-full-frames.py)', () => {
  it('모든 장면이 그림 전체 칸 — "바뀐 부분만 담은 장면" 이 있으면 맥 VS Code 에서 칸 안에 잘라 넣을 때 일부만 그려져 안 보이거나 잘림', () => {
    const bad: string[] = [];
    let count = 0;
    for (const gen of readdirSync(MEDIA).filter((d) => /^gen\d+$/.test(d))) {
      for (const form of readdirSync(join(MEDIA, gen))) {
        const dir = join(MEDIA, gen, form);
        if (!statSync(dir).isDirectory()) continue;
        for (const f of readdirSync(dir).filter((n) => n.endsWith('.gif'))) {
          const g = frameRects(readFileSync(join(dir, f)));
          count++;
          if (g.frames.length === 0 || g.frames.some((r) => r.x !== 0 || r.y !== 0 || r.w !== g.w || r.h !== g.h)) bad.push(`${gen}/${form}/${f}`);
        }
      }
    }
    expect(count).toBeGreaterThan(2000);
    expect(bad).toEqual([]);
    // 그림 2000장 넘게 읽음 — 다른 일이 같이 돌면 5초를 넘겨 가끔 실패 (테스터)
  }, 30_000);
});
