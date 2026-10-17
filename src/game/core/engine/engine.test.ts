import { describe, expect, it } from 'vitest';
import { sampleSave } from '../../../test/fixtures/save';
import { advance, clampFrameDelta, createGameState, readRuntime, Rng, shouldRunWhenHidden, takeSteps } from './index';

describe('시드 랜덤', () => {
  it('같은 시드면 같은 수', () => {
    const a = new Rng(7);
    const b = new Rng(7);
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(Array.from({ length: 5 }, () => b.next()));
  });

  it('상태를 넘겨 이어 가도 같은 수 (웹뷰 → 확장으로 넘겨도 이어짐)', () => {
    const whole = new Rng(99);
    const seq = Array.from({ length: 6 }, () => whole.next());
    const first = new Rng(99);
    const head = [first.next(), first.next(), first.next()];
    const second = new Rng(first.state);
    expect([...head, second.next(), second.next(), second.next()]).toEqual(seq);
  });

  it('0 이상 1 미만 · int 는 끝값 포함 · 고르게', () => {
    const r = new Rng(1);
    const counts = [0, 0, 0];
    for (let i = 0; i < 30_000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      const n = r.int(0, 2);
      counts[n] = (counts[n] ?? 0) + 1;
    }
    for (const c of counts) expect(c).toBeGreaterThan(9_000);
    expect(counts.reduce((a, b) => a + b)).toBe(30_000);
  });

  it('chance(0) 는 늘 거짓 · chance(1) 은 늘 참', () => {
    const r = new Rng(3);
    for (let i = 0; i < 100; i++) {
      expect(r.chance(0)).toBe(false);
      expect(r.chance(1)).toBe(true);
    }
  });
});

describe('시간 → 걸음', () => {
  it.each([
    [16, 16],
    [-5, 0],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
    [5000, 100],
  ])('프레임 사이 %s ms → %s ms (상한 0.1초)', (dt, want) => {
    expect(clampFrameDelta(dt)).toBe(want);
  });

  it('남은 시간은 다음 걸음으로 넘김', () => {
    expect(takeSteps(0, 120, 50)).toEqual({ steps: 2, accMs: 20 });
    expect(takeSteps(20, 30, 50)).toEqual({ steps: 1, accMs: 0 });
    expect(takeSteps(10, -100, 50)).toEqual({ steps: 0, accMs: 10 });
  });

  it('숫자가 아닌 시간이 들어와도 시간이 멈추지 않음 (NaN 이 남지 않음)', () => {
    expect(takeSteps(Number.NaN, 120, 50)).toEqual({ steps: 2, accMs: 20 });
    expect(takeSteps(10, Number.NaN, 50)).toEqual({ steps: 0, accMs: 10 });
  });
});

describe('게임 상태 앞으로 가기', () => {
  const start = createGameState(sampleSave({ playTimeMs: 0 }), 5);

  it('걸음마다 플레이 시간이 늘고, 남은 시간은 상태에 실림', () => {
    const r = advance(start, 120);
    expect(r.steps).toBe(2);
    expect(r.state.save.playTimeMs).toBe(100);
    expect(r.state.runtime.stepAccMs).toBe(20);
    expect(start.save.playTimeMs).toBe(0); // 원래 상태는 그대로 (바꾸지 않고 새로 만듦)
  });

  it('바뀐 게 없으면 같은 상태를 돌려줌', () => {
    expect(advance(start, 0).state).toBe(start);
  });

  it('웹뷰처럼 잘게(16ms) 가든 확장처럼 크게(250ms) 가든 결과가 같음', () => {
    let fine = start;
    for (let i = 0; i < 250; i++) fine = advance(fine, 16).state; // 4초
    let coarse = start;
    for (let i = 0; i < 16; i++) coarse = advance(coarse, 250).state; // 4초
    expect(fine.save.playTimeMs).toBe(coarse.save.playTimeMs);
    expect(fine.runtime).toEqual(coarse.runtime);
  });

  it('안 볼 때 계산은 자동 전투일 때만 (mvp-spec 3.3 U2)', () => {
    expect(shouldRunWhenHidden(start)).toBe(false);
    const auto = createGameState(sampleSave({ settings: { notifications: true, autoBattle: true } }), 1);
    expect(shouldRunWhenHidden(auto)).toBe(true);
  });

  it('다른 쪽에서 온 진행 중 상태가 이상하면 새 시드 · 0 으로', () => {
    expect(readRuntime({ rngState: 12, stepAccMs: 30 }, 1)).toEqual({ rngState: 12, stepAccMs: 30 });
    expect(readRuntime({ rngState: -1, stepAccMs: 900 }, 7)).toEqual({ rngState: 7, stepAccMs: 0 });
    expect(readRuntime('x', 8)).toEqual({ rngState: 8, stepAccMs: 0 });
  });
});
