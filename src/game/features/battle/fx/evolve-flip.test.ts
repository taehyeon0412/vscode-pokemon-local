/**
 * 진화 (S22) 흰 실루엣 옛 ↔ 새 바뀜은 일정하게 초당 3번 아래 — 초당 2 → 12번으로 빨라져 깜빡임 1초 3번 규칙에 걸리던 것 (bugs 1800 · 10-25 결정 — 깜빡임 규칙이 메가보다 위)
 * ult/bridge.js 는 묶음 (main-bundle) 으로만 돌아 줄을 읽어 셈
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const bridge = readFileSync(join(__dirname, '../../../../../ult/bridge.js'), 'utf8');

describe('진화 흰 실루엣 바뀜', () => {
  it('초당 바뀜이 일정한 값 하나 · 바뀌는 간격 0.34초 넘게', () => {
    const hz = Number(bridge.match(/const EVO_FLIP_HZ = ([\d.]+);/)?.[1]);
    expect(hz).toBeGreaterThan(0);
    expect(1 / hz).toBeGreaterThanOrEqual(0.34);
  });

  it('게임 설정 동작 줄이기면 게임 화면 번쩍을 안 함 (ideas 712 — 참가자 필살기 · 메가진화 번쩍)', () => {
    const wrap = bridge.slice(bridge.indexOf('screenFlash = function'), bridge.indexOf('const fxUltShake0'));
    expect(wrap).toMatch(/document\.querySelector\('#pokemon-game\.pg-reduce-motion'\)\) \{\s*return undefined;/);
  });

  it('바뀜 수는 그 값만 곱함 (시간에 따라 빨라지는 몫 없음)', () => {
    expect(bridge).toMatch(/const flips = \(L - T0\) \* EVO_FLIP_HZ;/);
    expect(bridge).not.toMatch(/const flips = \(L - T0\) \* \(2 \+ 5 \* k\)/);
  });
});
