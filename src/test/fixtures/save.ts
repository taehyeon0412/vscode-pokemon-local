/** 테스트용 세이브 · 포켓몬 · 세이브 파일 · 보관함 · 잠금 파일 */
import { createNewSave, type Monster, type Save } from '../../game/core/save';
import type { ArchiveEntry, ArchiveReason, SaveArchive } from '../../game/host/save-archive';
import type { SaveStorage } from '../../game/host/save-file';
import type { LeaseFile, LeaseRecord } from '../../game/host/window-lease';

export function sampleMonster(overrides: Partial<Monster> = {}): Monster {
  return {
    uid: 'm1',
    species: 1,
    form: 'bulbasaur',
    level: 5,
    exp: 135,
    ivs: { hp: 10, attack: 20, defense: 5, speed: 31, ultimate: 0 },
    points: { hp: 2, attack: 0, defense: 0, speed: 0, ultimate: 0 },
    unspentPoints: 2,
    moves: [{ moveId: 33, pp: 35 }, { moveId: 22, pp: 25 }],
    hp: 20,
    status: null,
    shiny: false,
    caughtAt: 'starter',
    ...overrides,
  };
}

/** 스타팅 1마리 + 잡은 1마리가 있는, 1-1 을 하던 세이브 */
export function sampleSave(overrides: Partial<Save> = {}): Save {
  const base = createNewSave(1_700_000_000_000);
  return {
    ...base,
    player: { gender: 'female' },
    monsters: {
      m1: sampleMonster(),
      m2: sampleMonster({ uid: 'm2', species: 10, form: 'caterpie', level: 3, moves: [{ moveId: 33, pp: 35 }], caughtAt: 'forest-1' }),
    },
    party: ['m1', 'm2'],
    nextMonsterUid: 3,
    location: { screen: 'stage', stageId: 'forest-1' },
    stages: { 'forest-1': { seed: 42, progress: 0.4, cleared: false, defeatedTrainers: [], facilities: [{ kind: 'hospital', at: 0.5 }] } },
    dex: { seen: [1, 10, 13], caught: [1, 10] },
    ...overrides,
  };
}

/** JSON 으로 한 번 돌려 파일 · postMessage 처럼 (함수 · undefined 가 빠짐) */
export function viaJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** 세이브 파일 흉내 — 쓸 때마다 JSON 으로 복사 */
export class MemorySaveStorage implements SaveStorage {
  value: unknown = undefined;
  writes = 0;
  failNext = 0;

  constructor(initial?: unknown) {
    if (initial !== undefined) this.value = viaJson(initial);
  }

  read(): unknown {
    return this.value === undefined ? undefined : viaJson(this.value);
  }

  write(value: unknown): void {
    if (this.failNext > 0) {
      this.failNext--;
      throw new Error('disk full');
    }
    this.writes++;
    this.value = viaJson(value);
  }
}

/** 보관함 흉내 — 같은 원본은 한 번만 (FileSaveArchive 와 같은 규칙) */
export class MemorySaveArchive implements SaveArchive {
  readonly items: { reason: ArchiveReason; note: string; raw: unknown }[] = [];
  failNext = 0;

  add(reason: ArchiveReason, note: string, raw: unknown): Promise<void> {
    if (this.failNext > 0) {
      this.failNext--;
      return Promise.reject(new Error('disk full'));
    }
    const body = JSON.stringify(raw);
    if (!this.items.some((i) => JSON.stringify(i.raw) === body)) this.items.push({ reason, note, raw: viaJson(raw) });
    return Promise.resolve();
  }

  list(): Promise<ArchiveEntry[]> {
    return Promise.resolve(this.items.map((i, n) => ({ file: `${n}.json`, reason: i.reason })));
  }
}

/** 잠금 파일 흉내 (여러 창이 같은 것을 나눠 씀) */
export class MemoryLeaseFile implements LeaseFile {
  record: LeaseRecord | null = null;
  read(): LeaseRecord | null {
    return this.record ? { ...this.record } : null;
  }
  create(record: LeaseRecord): boolean {
    if (this.record) return false;
    this.record = { ...record };
    return true;
  }
  write(record: LeaseRecord): void {
    this.record = { ...record };
  }
  remove(): void {
    this.record = null;
  }
  discard(expected: LeaseRecord): boolean {
    if (!this.record || this.record.owner !== expected.owner || this.record.until !== expected.until) return false;
    this.record = null;
    return true;
  }
  clearCorrupt(): void {
    // 메모리에는 깨진 파일이 없음
  }
}
