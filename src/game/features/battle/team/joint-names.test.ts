import { describe, expect, it } from 'vitest';
import type { TypeName } from '../../../data';
import { splitName, jointName, JOINT_NAME_DEFAULT, JOINT_TRIPLE_PREFIX } from './joint-names';

const TYPES: TypeName[] = ['normal', 'fire', 'water', 'grass', 'electric', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'];

describe('3:3 합동 이름 (#100 시안 → #96 ② 기획 표)', () => {
  it('두 타입 짝 — 순서 상관없음', () => {
    expect(jointName(['fire', 'grass'])).toBe('화염 꽃보라');
    expect(jointName(['grass', 'fire'])).toBe('화염 꽃보라');
    expect(jointName(['fire', 'water'])).toBe('증기 폭발');
    expect(jointName(['water', 'grass'])).toBe('꽃잎 해일');
    expect(jointName(['fire', 'fire'])).toBe('쌍불기둥');
    expect(jointName(['ghost', 'fairy'])).toBe('환상의 밤');
  });

  it('짝 표 — 18 타입 모든 짝 (같은 타입 둘 포함 171) 에 이름 · 기본 이름 없음 · 순서 상관없음 · 같은 이름 없음', () => {
    const seen = new Map<string, string>();
    for (const [i, a] of TYPES.entries()) {
      for (const b of TYPES.slice(i)) {
        const name = jointName([a, b]);
        expect(name, `${a}+${b}`).not.toBe(JOINT_NAME_DEFAULT);
        expect(jointName([b, a])).toBe(name);
        expect(seen.get(name), `${a}+${b} = ${name}`).toBeUndefined();
        seen.set(name, `${a}+${b}`);
      }
    }
    expect(seen.size).toBe(171);
  });

  it('셋 — 불꽃 · 물 · 풀 = 삼색 대폭발 · 그 밖 = 삼중 + 앞장 × 먼저 끼어든 동료 짝', () => {
    expect(jointName(['fire', 'grass', 'water'])).toBe('삼색 대폭발');
    expect(jointName(['water', 'fire', 'grass'])).toBe('삼색 대폭발');
    expect(jointName(['fire', 'water', 'electric'])).toBe(`${JOINT_TRIPLE_PREFIX} 증기 폭발`);
    expect(jointName(['fire', 'fire', 'grass'])).toBe(`${JOINT_TRIPLE_PREFIX} 쌍불기둥`);
    expect(jointName(['grass', 'electric', 'fire'])).toBe(`${JOINT_TRIPLE_PREFIX} ${jointName(['grass', 'electric'])}`);
  });

  it('하나 · 넷은 기본 이름', () => {
    expect(jointName(['fire'])).toBe(JOINT_NAME_DEFAULT);
    expect(jointName(['fire', 'water', 'grass', 'ice'])).toBe(JOINT_NAME_DEFAULT);
  });
});

describe('합동 이름 두 줄 나누기 (#96 U4)', () => {
  it('긴 줄이 가장 짧아지는 띄어쓰기 · 같으면 앞쪽', () => {
    expect(splitName('삼중 빙염 소용돌이')).toEqual(['삼중 빙염', '소용돌이']);
    expect(splitName('삼중 하늘 요정 춤')).toEqual(['삼중 하늘', '요정 춤']);
    expect(splitName('삼중 도깨비불 행렬')).toEqual(['삼중', '도깨비불 행렬']);
    expect(splitName('겁화')).toBeNull();
  });
});
