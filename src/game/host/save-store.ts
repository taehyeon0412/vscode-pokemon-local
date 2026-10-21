/**
 * 세이브 저장소 (확장 쪽) — 세이브 파일 하나 (save-file.ts, mvp-spec 3.1 · 9장).
 * - 설정 동기화에는 올리지 않음 (globalState 가 아니라 파일)
 * - 바뀐 게 있으면 5초 안에 한 번 씀 (아무것도 안 바뀌면 타이머도 없음) · 잡기 · 전투 끝 · 모드 전환은 바로 · 끌 때 마지막으로
 * - 쓰기는 게임 모드인 창(창 잠금을 쥔 창)만 — setWritable 로 세션이 켜고 끔. 켤 때 읽기는 읽기만 (readOnly)
 * - 읽지 못한 · 고쳐서 읽은 · 옮기기 전 · 더 새 버전 · 새로 하기 전 세이브의 원본은 보관함(save-archive)에
 * - 잠김 (쓰지 않음): 더 새 확장의 세이브 · 원본을 보관하지 못함 · 다른 VS Code 창이 그 사이에 세이브를 바꿈 · 창 잠금을 잃음
 */
import { TIMING } from '../core/balance';
import { readSave, type ReadSaveResult, type Save } from '../core/save';
import type { SaveArchive } from './save-archive';
import type { SaveStorage } from './save-file';

export type LoadResult = ReadSaveResult | { kind: 'none' };

export interface SaveStoreOptions {
  intervalMs?: number;
  now?: () => number;
  log?: (message: string) => void;
  /** 쓸 때마다 기록 (개발 창에서만) */
  verbose?: boolean;
  /** 잠겼을 때 (게임을 멈추고 알릴 수 있게) */
  onLock?: (reason: string) => void;
}

/** 세이브의 updatedAt — 다른 창이 썼는지 알아보는 표 */
const stampOf = (raw: unknown): number | undefined =>
  typeof raw === 'object' && raw !== null && typeof (raw as Record<string, unknown>).updatedAt === 'number'
    ? ((raw as Record<string, unknown>).updatedAt as number)
    : undefined;

export class SaveStore {
  private pending: Save | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private enabled = false;
  private writable = false;
  private lockReason: string | null = null;
  private lockLogged = false;
  /** 마지막으로 읽거나 쓴 세이브의 updatedAt — 쓰기 전에 파일 것과 다르면 다른 창이 쓴 것 */
  private knownStamp: number | undefined;
  private readonly intervalMs: number;
  private readonly now: () => number;

  constructor(private readonly storage: SaveStorage, private readonly archive: SaveArchive, private readonly options: SaveStoreOptions = {}) {
    this.intervalMs = options.intervalMs ?? TIMING.autosaveCheckMs;
    this.now = options.now ?? Date.now;
  }

  /**
   * 세이브를 읽음. 기다리던 쓰기 · 잠금은 지움. 던지지 않음.
   * readOnly (켤 때): 보관 · 고친 것 쓰기를 하지 않음 — 게임 모드에 들어갈 때 다시 읽으며 함
   */
  async load(options: { readOnly?: boolean } = {}): Promise<LoadResult> {
    this.pending = null;
    this.lockReason = null;
    this.lockLogged = false;
    let raw: unknown;
    try {
      raw = this.storage.read();
    } catch (e) {
      this.knownStamp = undefined;
      this.lock(`세이브 파일을 읽지 못함 (${String(e)})`);
      return { kind: 'broken', reason: `세이브 파일을 읽지 못함 (${String(e)})` };
    }
    this.knownStamp = stampOf(raw);
    if (raw === undefined) return { kind: 'none' };
    const result = readSave(raw);
    if (result.kind === 'newer') this.lock('더 새 버전 확장에서 만든 세이브');
    if (options.readOnly) return result;
    try {
      switch (result.kind) {
        case 'broken':
          await this.archive.add('broken', result.reason, raw);
          break;
        case 'newer':
          await this.archive.add('newer', `${result.version}판`, raw);
          break;
        case 'ok':
          if (result.migratedFrom !== null) await this.archive.add('before-migration', `${result.migratedFrom}판`, raw);
          if (result.problems.length > 0) await this.archive.add('repaired', result.problems.slice(0, 5).join(' / '), raw);
          if (result.migratedFrom !== null || result.problems.length > 0) this.set(result.save);
          break;
      }
    } catch (e) {
      // 원본을 보관하지 못했으면 덮어쓰지 않게 잠금
      this.pending = null;
      this.lock(`세이브 원본을 보관하지 못함 (${String(e)})`);
    }
    return result;
  }

  /** 읽기만 (📦 꺼내기) — 기다리던 쓰기 · 잠금 · 표를 건드리지 않고 보관도 안 함. 던지지 않음 */
  peek(): LoadResult {
    try {
      const raw = this.storage.read();
      return raw === undefined ? { kind: 'none' } : readSave(raw);
    } catch (e) {
      return { kind: 'broken', reason: `세이브 파일을 읽지 못함 (${String(e)})` };
    }
  }

  /** 쓰지 않는 까닭 (없으면 null) */
  get lockedReason(): string | null {
    return this.lockReason;
  }

  get hasPending(): boolean {
    return this.pending !== null;
  }

  /** 이 창이 세이브를 써도 되는지 (창 잠금을 쥐었을 때만 true) */
  setWritable(writable: boolean): void {
    this.writable = writable;
    if (writable && this.pending) this.schedule();
  }

  /** 바뀐 세이브 — 5초 안에 씀 */
  set(save: Save): void {
    this.pending = save;
    this.schedule();
  }

  /** 바로 저장. 썼으면(또는 쓸 게 없으면) true */
  saveNow(save: Save): Promise<boolean> {
    this.pending = save;
    return this.flush();
  }

  /** 새로 하기 (S02 ①) — 사용자가 고른 것이라 잠금을 풀고 덮어씀. 지금 세이브 · 아직 안 쓴 세이브는 보관함에 */
  async replace(save: Save, note = '새로 하기 전 세이브'): Promise<boolean> {
    const old = this.storage.read();
    if (old !== undefined) await this.archive.add('replaced', note, old);
    if (this.pending) await this.archive.add('replaced', `${note} (아직 안 쓴 것)`, this.pending);
    this.lockReason = null;
    this.lockLogged = false;
    // 보관하는 동안 (await) 이 창이 한 번 더 썼을 수 있음 (전투 끝 save-now · 5초 자동저장) → 쓰기 바로 앞의 파일 표로 (옛 표로 되돌려 "다른 창" 으로 잠기던 것 — 코드 리뷰어 #48 큼 2)
    this.knownStamp = stampOf(this.storage.read());
    return this.saveNow(save);
  }

  /** 끝내 쓰지 못한 세이브를 보관함에 — 다음에 세이브를 다시 읽어도 그 진행을 잃지 않게. 보관했으면 true */
  async keepUnsaved(note: string): Promise<boolean> {
    if (!this.pending) return false;
    try {
      await this.archive.add('unsaved', note, this.pending);
      return true;
    } catch (e) {
      this.log(`쓰지 못한 세이브를 보관하지 못함 (${String(e)})`);
      return false;
    }
  }

  /** 밖에서 잠금 (창 잠금을 잃음 등) — 그 뒤로는 쓰지 않음 */
  lock(reason: string): void {
    if (this.lockReason) return;
    this.lockReason = reason;
    this.options.onLock?.(reason);
  }

  /** 자동저장 켜기 (켤 때 읽기가 끝난 뒤) */
  start(): void {
    this.enabled = true;
    if (this.pending) this.schedule();
  }

  /** 기다리는 세이브가 있으면 바로 씀 (동기로 쓰고 결과만 Promise 로) */
  flush(): Promise<boolean> {
    return Promise.resolve(this.write());
  }

  /** 확장이 꺼질 때 — 타이머를 멈추고 마지막으로 씀 (동기 — VS Code 가 꺼지는 중에도 끝남) */
  dispose(): boolean {
    this.enabled = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const ok = this.write();
    if (!ok) this.log('끄기 전 마지막 저장을 하지 못함');
    return ok;
  }

  private log(message: string): void {
    try {
      this.options.log?.(message);
    } catch {
      // 기록이 실패해도 저장은 계속 (끌 때 출력 채널이 먼저 닫힘)
    }
  }

  private schedule(): void {
    if (!this.enabled || !this.writable || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.write();
    }, this.intervalMs);
  }

  private write(): boolean {
    const save = this.pending;
    if (!save) return true;
    if (!this.writable) return false;
    if (this.lockReason) {
      if (!this.lockLogged) this.log(`저장하지 않음: ${this.lockReason}`);
      this.lockLogged = true;
      return false;
    }
    let current: number | undefined;
    try {
      current = stampOf(this.storage.read());
    } catch {
      current = this.knownStamp; // 읽기만 실패 — 쓰기는 해 봄
    }
    if (current !== this.knownStamp) {
      this.lock('다른 VS Code 창이 그 사이에 세이브를 바꿈');
      this.log('저장하지 않음: 다른 VS Code 창이 그 사이에 세이브를 바꿈');
      this.lockLogged = true;
      return false;
    }
    // 같은 밀리초에 두 번 써도 표가 달라지게
    const stamped = { ...save, updatedAt: Math.max(this.now(), (this.knownStamp ?? 0) + 1) };
    try {
      this.storage.write(stamped);
      this.pending = null;
      this.knownStamp = stamped.updatedAt;
      if (this.options.verbose) this.log(`저장함 (플레이 ${Math.round(save.playTimeMs / 1000)}초)`);
      return true;
    } catch (e) {
      this.log(`저장 실패 (5초 뒤 다시): ${String(e)}`);
      this.schedule();
      return false;
    }
  }
}
