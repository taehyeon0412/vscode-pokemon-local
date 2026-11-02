/**
 * 모습 크기 = 그림 크기 (bugs 2731 2026-11-02) — 확장 자료 (pokemon-data · main-bundle) 에 arceus_bug 만 originalSpriteSize 64 가 빠져
 * forms.json 에 32 로 적히고 64px 그림이 반 크기로 그려지던 것. 자료를 다시 받거나 포켓몬을 더하면 (add-pokemon.py → fetch-pokeapi.mjs) 여기서 드러남.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allForms, formOf } from '../../game/data';

const MEDIA = join(__dirname, '..', '..', '..', 'extension', 'media');

describe('모습 크기 = 그림 크기', () => {
  it('모든 모습의 서 있는 그림 (default_idle GIF) 가로 · 세로 = forms.json size', () => {
    const bad = allForms().flatMap((key) => {
      const f = formOf(key)!;
      const head = readFileSync(join(MEDIA, `gen${f.gen}`, key, 'default_idle_8fps.gif')).subarray(0, 10);
      const w = head.readUInt16LE(6);
      const h = head.readUInt16LE(8);
      return w === f.size && h === f.size ? [] : [`${key} 자료 ${f.size} · 그림 ${w} × ${h}`];
    });
    expect(bad).toEqual([]);
  });

  it('확장 자료 두 벌 (pokemon-data.js · main-bundle.js) 도 arceus_bug 가 64', () => {
    for (const f of [join(__dirname, '..', '..', '..', 'extension', 'out', 'common', 'pokemon-data.js'), join(MEDIA, 'main-bundle.js')]) {
      const block = readFileSync(f, 'utf8').match(/arceus_bug: \{[^}]*\}/)?.[0] ?? '';
      expect(block).toContain('originalSpriteSize: 64');
    }
  });
});
