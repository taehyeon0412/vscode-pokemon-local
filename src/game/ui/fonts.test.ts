/** 글꼴이 자리 잡은 뒤 다시 재기 한 군데 (ui/fonts — 기획 2026-10-30 · bugs 2728 · 2729: 글꼴이 늦게 와 옛 배치로 잰 채 남던 것 두 번) · 직접 듣는 곳이 없는지는 host/fonts-one-place.test */
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('글꼴 뒤 다시 재기 (ui/fonts)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('fontsSettled 한 번에 듣는 곳마다 한 번 · 끄면 안 부름', async () => {
    vi.stubGlobal('requestAnimationFrame', (f: () => void) => {
      f();
      return 0;
    });
    const { afterFonts, fontsSettled } = await import('./fonts');
    const a = vi.fn();
    const b = vi.fn();
    const offA = afterFonts(a);
    const offB = afterFonts(b);
    fontsSettled();
    expect([a.mock.calls.length, b.mock.calls.length]).toEqual([1, 1]);
    offA();
    fontsSettled();
    expect([a.mock.calls.length, b.mock.calls.length]).toEqual([1, 2]);
    offB();
  });

  it('글꼴을 다 받을 때마다 (loadingdone) 다시 잼 · 처음 ready 에도 한 번', async () => {
    vi.stubGlobal('requestAnimationFrame', (f: () => void) => {
      f();
      return 0;
    });
    const listeners: Array<() => void> = [];
    vi.stubGlobal('document', { fonts: { ready: Promise.resolve(), addEventListener: (_: string, f: () => void) => listeners.push(f) } });
    const { afterFonts } = await import('./fonts');
    const fn = vi.fn();
    const off = afterFonts(fn);
    await Promise.resolve();
    expect(fn).toHaveBeenCalledTimes(1);
    listeners.forEach((f) => f());
    expect(fn).toHaveBeenCalledTimes(2);
    off();
  });
});
