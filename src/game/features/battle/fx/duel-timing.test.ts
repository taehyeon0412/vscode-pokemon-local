/** 1:1 힘대결 박자 — TS (FX_DUEL_MS) 와 일반 모드 연출 (ult/core.js · ult/duel.js) 이 같은 값인지 (같은 값이 세 곳에 따로 있던 것, 코드 리뷰어 #116) */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FX_DUEL_MS } from './bridge';
import { DUEL_VS_MS } from '../team/model';

const src = (f: string) => readFileSync(join(__dirname, '../../../../../ult', f), 'utf8');
const sec = (text: string, name: string): number => {
  const m = new RegExp(`const ${name} = ([0-9.]+);`).exec(text);
  if (!m) throw new Error(`${name} 를 못 찾음`);
  return Number(m[1]);
};

describe('힘대결 박자 — TS 와 JS 가 같음', () => {
  it('VS 컷인 · 밀고 밀리기 · 뚫고 나감 · 터진 여운', () => {
    const core = src('core.js');
    const duel = src('duel.js');
    expect(sec(core, 'ULT_VS_MS')).toBe(FX_DUEL_MS.vs);
    expect(sec(duel, 'DUEL_SEC') * 1000).toBe(FX_DUEL_MS.push);
    expect(sec(duel, 'DUEL_THROUGH') * 1000).toBe(FX_DUEL_MS.through);
    expect(sec(duel, 'DUEL_AFTER') * 1000).toBe(FX_DUEL_MS.after);
  });
  it('3:3 힘겨루기 장면 VS (연타 안내 기다림) = VS 컷인 + 걷힘 0.6초', () => {
    expect(DUEL_VS_MS).toBe(FX_DUEL_MS.vs + 600);
  });
});
