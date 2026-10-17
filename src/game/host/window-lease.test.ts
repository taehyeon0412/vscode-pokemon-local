import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryLeaseFile } from '../../test/fixtures/save';
import { FileLeaseFile, processAlive, WindowLease } from './window-lease';

let now = 0;
let file: MemoryLeaseFile;
const alive = new Set<number>();
beforeEach(() => {
  vi.useFakeTimers();
  now = 1000;
  file = new MemoryLeaseFile();
  alive.clear();
  alive.add(1).add(2);
});
afterEach(() => {
  vi.useRealTimers();
});

const lease = (id: string, pid: number, onLost?: () => void) =>
  new WindowLease(file, id, { pid, isAlive: (p) => alive.has(p), now: () => now, ttlMs: 30_000, renewMs: 10_000, onLost });

describe('게임 모드는 한 번에 창 하나', () => {
  it('비어 있으면 가져오고, 다른 창은 못 가져옴', () => {
    expect(lease('A', 1).acquire()).toBe(true);
    const b = lease('B', 2);
    expect(b.heldByOther()).toBe(true);
    expect(b.acquire()).toBe(false);
  });

  it('게임 중인 창은 10초마다 늘려서 계속 쥠', async () => {
    lease('A', 1).acquire();
    for (let i = 0; i < 6; i++) {
      now += 10_000;
      await vi.advanceTimersByTimeAsync(10_000);
    }
    expect(lease('B', 2).acquire()).toBe(false);
  });

  it('그 창의 프로세스가 이미 없으면 (VS Code 를 껐음) 바로 가져감', () => {
    file.write({ owner: 'old', pid: 99, until: now + 30_000 });
    expect(lease('B', 2).acquire()).toBe(true);
  });

  it('프로세스가 살아 있어도 늘리지 못해 30초가 지나면 가져감', () => {
    file.write({ owner: 'stuck', pid: 1, until: now + 30_000 });
    expect(lease('B', 2).acquire()).toBe(false);
    now += 30_001;
    expect(lease('B', 2).acquire()).toBe(true);
  });

  it('놓으면 다른 창이 가져감 · 남의 것은 지우지 않음', () => {
    const a = lease('A', 1);
    a.acquire();
    lease('B', 2).release();
    expect(file.record?.owner).toBe('A');
    a.release();
    expect(file.record).toBeNull();
    expect(lease('B', 2).acquire()).toBe(true);
  });

  it('늘리려는데 다른 창이 가져가 있으면 onLost', async () => {
    const lost = vi.fn();
    const a = lease('A', 1, lost);
    a.acquire();
    file.write({ owner: 'B', pid: 2, until: now + 30_000 });
    now += 10_000;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(lost).toHaveBeenCalledOnce();
    expect(a.held).toBe(false);
  });
});

describe('잠금 파일 (실제 파일)', () => {
  it('없을 때만 만들어짐 — 두 번째 만들기는 false', () => {
    const f = new FileLeaseFile(join(mkdtempSync(join(tmpdir(), 'pokemon-lease-')), 'sub', 'game-window.lock'));
    expect(f.read()).toBeNull();
    expect(f.create({ owner: 'A', pid: 1, until: 5 })).toBe(true);
    expect(f.create({ owner: 'B', pid: 2, until: 5 })).toBe(false);
    expect(f.read()).toEqual({ owner: 'A', pid: 1, until: 5 });
    f.write({ owner: 'A', pid: 1, until: 9 });
    expect(f.read()?.until).toBe(9);
    f.remove();
    expect(f.read()).toBeNull();
  });

  it('잠금 파일이 깨졌으면 조금 지난 뒤 치우고 가져감 (영원히 못 들어가지 않게)', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'pokemon-lease-')), 'game-window.lock');
    let t = Date.now();
    const f = new FileLeaseFile(path, () => t);
    writeFileSync(path, '\0\0');
    const l = new WindowLease(f, 'B', { pid: process.pid, now: () => t });
    expect(l.acquire()).toBe(false); // 막 만들어진 것일 수도 있어서 바로는 안 치움
    t += 5_000;
    expect(l.acquire()).toBe(true);
    l.release();
  });

  it('끝난 잠금은 읽은 그대로일 때만 치움 (그 사이 남이 새로 만들었으면 지우지 않음)', () => {
    const f = new FileLeaseFile(join(mkdtempSync(join(tmpdir(), 'pokemon-lease-')), 'game-window.lock'));
    f.create({ owner: 'dead', pid: 2 ** 30, until: 1 });
    expect(f.discard({ owner: 'someone-else', pid: 1, until: 1 })).toBe(false);
    expect(f.discard({ owner: 'dead', pid: 2 ** 30, until: 1 })).toBe(true);
    expect(f.read()).toBeNull();
  });

  it('지금 프로세스는 살아 있음 · 없는 번호는 없음', () => {
    expect(processAlive(process.pid)).toBe(true);
    expect(processAlive(2 ** 30)).toBe(false);
  });
});
