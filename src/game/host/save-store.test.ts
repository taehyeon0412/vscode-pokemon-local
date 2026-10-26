import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemorySaveArchive, MemorySaveStorage, sampleSave } from '../../test/fixtures/save';
import { createNewSave, SAVE_VERSION, type Save } from '../core/save';
import { SaveStore } from './save-store';

let storage: MemorySaveStorage;
let archive: MemorySaveArchive;
let store: SaveStore;
let logs: string[];
let locks: string[];
let now = 1_800_000_000_000;

function make(initial?: unknown, { writable = true } = {}) {
  storage = new MemorySaveStorage(initial);
  archive = new MemorySaveArchive();
  store = new SaveStore(storage, archive, { intervalMs: 5000, now: () => now, log: (m) => logs.push(m), onLock: (r) => locks.push(r) });
  store.setWritable(writable);
}

beforeEach(() => {
  vi.useFakeTimers();
  now = 1_800_000_000_000;
  logs = [];
  locks = [];
  make();
});
afterEach(() => {
  vi.useRealTimers();
});

const stored = () => storage.read() as Save | undefined;

describe('읽기', () => {
  it('세이브가 없으면 none', async () => {
    expect(await store.load()).toEqual({ kind: 'none' });
  });

  it('있으면 읽고, 고칠 게 없으면 다시 쓰지 않음', async () => {
    make(sampleSave());
    expect((await store.load()).kind).toBe('ok');
    expect(store.hasPending).toBe(false);
    expect(storage.writes).toBe(0);
  });

  it('켤 때(readOnly)는 읽기만 — 보관 · 고친 것 쓰기를 하지 않음 (게임 모드가 아닌 창이 쓰지 않게)', async () => {
    make({ ...sampleSave(), party: ['m1', 'ghost', 'm2'] });
    expect((await store.load({ readOnly: true })).kind).toBe('ok');
    expect(archive.items).toEqual([]);
    expect(store.hasPending).toBe(false);
  });

  it('읽지 못하면 원본을 보관함에 넣고 원래 파일은 그대로 둠', async () => {
    make({ version: 1, monsters: 'oops' });
    expect((await store.load()).kind).toBe('broken');
    expect(archive.items).toEqual([expect.objectContaining({ reason: 'broken', raw: { version: 1, monsters: 'oops' } })]);
    expect(stored()).toEqual({ version: 1, monsters: 'oops' });
  });

  it('같은 망가진 세이브를 여러 번 읽어도 보관함에는 한 번만', async () => {
    make({ version: 1, monsters: 'oops' });
    for (let i = 0; i < 4; i++) await store.load();
    expect(archive.items).toHaveLength(1);
  });

  it('고쳐서 읽으면 원본을 보관하고 고친 것을 5초 안에 씀', async () => {
    make({ ...sampleSave(), party: ['m1', 'ghost', 'm2'] });
    expect((await store.load()).kind).toBe('ok');
    expect(archive.items[0]?.reason).toBe('repaired');
    store.start();
    await vi.advanceTimersByTimeAsync(5000);
    expect(stored()?.party).toEqual(['m1', 'm2']);
  });

  it('더 새 확장의 세이브: 잠금 → 덮어쓰지 않음, 로그는 한 번만 → 새로 하기(replace)로만 풀림', async () => {
    const newer = { version: 8, secret: 'future' };
    make(newer);
    expect(await store.load()).toEqual({ kind: 'newer', version: 8 });
    expect(locks).toHaveLength(1);
    expect(await store.saveNow(createNewSave(0))).toBe(false);
    expect(await store.saveNow(createNewSave(0))).toBe(false);
    expect(stored()).toEqual(newer);
    expect(logs.filter((l) => l.startsWith('저장하지 않음'))).toHaveLength(1);
    expect(await store.replace(createNewSave(5))).toBe(true);
    expect(stored()?.version).toBe(SAVE_VERSION);
    // 옛 원본은 'newer' 로 이미 있어 또 넣지 않고, 잠겨서 못 쓴 세이브는 'replaced' 로 보관
    expect(archive.items.map((i) => i.reason)).toEqual(['newer', 'replaced']);
  });

  it('원본을 보관하지 못하면 잠가서 원본을 덮어쓰지 않음', async () => {
    make({ version: 1, monsters: 'oops' });
    archive.failNext = 1;
    expect((await store.load()).kind).toBe('broken');
    expect(store.lockedReason).toMatch(/보관하지 못함/);
    expect(await store.saveNow(createNewSave(0))).toBe(false);
    expect(stored()).toEqual({ version: 1, monsters: 'oops' });
  });

  it('JSON 이 깨진 파일 ({ unreadable })도 망가진 세이브로 보관', async () => {
    make({ unreadable: '{"version": 1, "mons' });
    expect((await store.load()).kind).toBe('broken');
    expect(archive.items).toHaveLength(1);
  });

  it('다시 읽으면 기다리던 쓰기 · 잠금은 지움', async () => {
    make({ version: 9 });
    await store.load();
    store.set(createNewSave(0));
    storage.write(sampleSave({ money: 3 }));
    await store.load();
    expect(store.lockedReason).toBeNull();
    expect(store.hasPending).toBe(false);
  });
});

describe('쓰기', () => {
  it('아무것도 안 바뀌면 타이머도 없음 · 바뀌면 5초 안에 한 번 (mvp-spec 3.1)', async () => {
    store.start();
    expect(vi.getTimerCount()).toBe(0);
    store.set(sampleSave({ money: 1 }));
    store.set(sampleSave({ money: 2 }));
    await vi.advanceTimersByTimeAsync(4999);
    expect(storage.writes).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(storage.writes).toBe(1);
    expect(stored()?.money).toBe(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('게임 모드가 아닌 창(writable 아님)은 쓰지 않음', async () => {
    make(undefined, { writable: false });
    store.start();
    expect(await store.saveNow(sampleSave())).toBe(false);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(storage.writes).toBe(0);
  });

  it('바로 저장 · 저장한 시각을 적음 · 같은 시각에 또 써도 표가 늘어남', async () => {
    expect(await store.saveNow(sampleSave())).toBe(true);
    expect(stored()?.updatedAt).toBe(now);
    await store.saveNow(sampleSave());
    expect(stored()?.updatedAt).toBe(now + 1);
  });

  it('다른 VS Code 창이 그 사이에 세이브를 바꾸면 덮어쓰지 않고 잠금', async () => {
    make(sampleSave({ updatedAt: 100 }));
    await store.load();
    storage.write(sampleSave({ updatedAt: 200, money: 999 })); // 다른 창이 씀
    expect(await store.saveNow(sampleSave({ money: 1 }))).toBe(false);
    expect(stored()?.money).toBe(999);
    expect(locks).toEqual(['다른 VS Code 창이 그 사이에 세이브를 바꿈']);
  });

  it('밖에서 잠그면(창 잠금을 잃음) 그 뒤로 쓰지 않음', async () => {
    store.lock('다른 VS Code 창이 게임 모드를 가져감');
    expect(await store.saveNow(sampleSave())).toBe(false);
    expect(storage.writes).toBe(0);
  });

  it('쓰기가 실패하면 5초 뒤 다시 · 결과는 false', async () => {
    store.start();
    storage.failNext = 1;
    expect(await store.saveNow(sampleSave({ money: 9 }))).toBe(false);
    expect(stored()).toBeUndefined();
    await vi.advanceTimersByTimeAsync(5000);
    expect(stored()?.money).toBe(9);
  });

  it('끌 때(dispose)는 동기로 바로 씀 — VS Code 가 꺼지는 중에도 끝남', () => {
    store.start();
    store.set(sampleSave({ money: 77 }));
    expect(store.dispose()).toBe(true);
    expect(stored()?.money).toBe(77);
  });

  it('새로 하기: 백업은 하나 — 아직 안 쓴 진행이 있으면 그것 (디스크 것보다 새 것), 없으면 디스크 것 (둘 다 넣어 백업이 두 배로 밀리던 것 — 테스터 #48)', async () => {
    make(sampleSave({ money: 5 }));
    await store.load();
    store.set(sampleSave({ money: 6 }));
    await store.replace(createNewSave(1));
    expect(archive.items.map((i) => (i.raw as Save).money)).toEqual([6]);
    expect(archive.items[0]!.note).toContain('아직 안 쓴 진행');
    expect(stored()?.money).toBe(1000);
    // 안 쓴 진행이 없으면 디스크 것
    make(sampleSave({ money: 7 }));
    await store.load();
    await store.replace(createNewSave(1));
    expect(archive.items.map((i) => (i.raw as Save).money)).toEqual([7]);
  });
});

describe('새로 하기 · 불러오기 (replace) — 보관하는 동안 이 창이 한 번 더 써도 잠기지 않음 (코드 리뷰어 #48 큼 2)', () => {
  it('archive.add 를 기다리는 사이 save-now 가 끼어도 replace 가 쓰고 "다른 창" 으로 잠기지 않음', async () => {
    make(sampleSave({ money: 1 }));
    expect((await store.load()).kind).toBe('ok');
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const add = archive.add.bind(archive);
    archive.add = async (...a) => {
      await gate;
      return add(...a);
    };
    const done = store.replace(sampleSave({ money: 3 }), '불러오기 전 세이브');
    // 끼어든 저장 (전투 끝 save-now)
    archive.add = add;
    now += 1000;
    expect(await store.saveNow(sampleSave({ money: 2, updatedAt: now }))).toBe(true);
    release();
    expect(await done).toBe(true);
    expect(stored()?.money).toBe(3);
    expect(locks).toEqual([]);
  });
});

describe('불러오기 · 새로 하기 백업 — 다른 창이 그 사이 쓴 디스크 것도 (코드 리뷰어 #52)', () => {
  it('아직 안 쓴 진행이 있고 디스크 것이 이 창이 아는 것과 다르면 둘 다 백업 · 같으면 하나', async () => {
    make(sampleSave({ money: 1, updatedAt: 1 }));
    await store.load();
    store.set(sampleSave({ money: 2 }));
    // 다른 창이 몰래 씀
    storage.write(sampleSave({ money: 9, updatedAt: 99 }));
    await store.replace(createNewSave(1));
    expect(archive.items.map((i) => (i.raw as Save).money).sort()).toEqual([2, 9]);
  });
});

describe('3판 → 4판 (orders #30) — 설치 뒤 첫 읽기', () => {
  it('3판 세이브를 읽으면 원본을 "옮기기 전" 으로 보관하고 지금 판 (4판에서 연 지역 = 숲 · 5판은 판만) 으로 5초 안에 씀 · 같이 쓰는 칸 그대로', async () => {
    const v3 = (await import('../../test/fixtures/save-v3.json')).default as unknown as Save;
    make(v3);
    const r = await store.load();
    expect(r.kind === 'ok' && r.migratedFrom).toBe(3);
    expect(archive.items.map((i) => [i.reason, i.note])).toEqual([['before-migration', '3판']]);
    store.start();
    await vi.advanceTimersByTimeAsync(5000);
    expect(stored()?.version).toBe(SAVE_VERSION);
    expect(stored()?.regions).toEqual({ order: ['forest'] });
    expect(stored()?.monsters).toEqual(v3.monsters);
    expect(stored()?.money).toBe(v3.money);
  });
});

describe('시험 창 세이브 판 (코드 리뷰어 #30)', () => {
  it('시험 창 (dev/game-host.js) 세이브도 지금 판 — 판을 올리면 같이 (2 → 3 때 고친 줄을 3 → 4 에서 놓친 것)', () => {
    const host = readFileSync('dev/game-host.js', 'utf8');
    expect(host).toContain(`version: ${SAVE_VERSION},`);
    expect(host).toContain(`regions: { order: ['forest'] }`);
  });
});
