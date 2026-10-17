/**
 * 게임 모드는 한 번에 VS Code 창 하나에서만.
 * 창마다 확장이 따로 돌고 세이브 파일은 같이 쓰므로, 두 창이 함께 게임을 하면 서로의 진행을 덮어씀.
 * 게임 중인 창이 잠금 파일(전역 저장 폴더의 game-window.lock)에 "나 · 내 프로세스 · 언제까지" 를 적고 주기적으로 늘린다.
 * - 파일을 "없을 때만 만들기"로 가져가서 두 창이 동시에 가져가지 못함
 * - 창이 갑자기 죽거나 VS Code 를 끄면: 그 프로세스가 이미 없으면 바로, 아니어도 TTL 이 지나면 풀림
 * - 잠금 파일이 깨졌으면 (정전 · 디스크 가득) 조금 지난 뒤 끝난 잠금으로 봄 — 영원히 아무도 못 들어가지 않게
 * 그래도 혹시 두 창이 같이 쥐게 되면, 세이브를 쓰기 전 표(updatedAt) 확인이 남의 진행을 덮지 않게 막음 (save-store.ts).
 */
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeSync } from 'fs';
import { dirname } from 'path';
import { writeAtomic } from './save-file';

export interface LeaseRecord {
  owner: string;
  pid: number;
  until: number;
}

/** 잠금을 적는 곳 — 테스트에서는 메모리로 */
export interface LeaseFile {
  read(): LeaseRecord | null;
  /** 없을 때만 만듦 — 이미 있으면 false */
  create(record: LeaseRecord): boolean;
  write(record: LeaseRecord): void;
  remove(): void;
  /** 지금 내용이 expected 와 같을 때만 치움 (끝난 잠금을 두 창이 동시에 치우다 남의 새 잠금을 지우지 않게) */
  discard(expected: LeaseRecord): boolean;
  /** 읽을 수 없는 (깨진) 파일이 오래돼 있으면 치움 */
  clearCorrupt(): void;
}

/** 깨진 잠금 파일을 끝난 것으로 보기까지 — 다른 창이 막 만드는 중(빈 파일)인 것과 헷갈리지 않게 */
const CORRUPT_AFTER_MS = 2_000;

export class FileLeaseFile implements LeaseFile {
  constructor(private readonly path: string, private readonly now: () => number = Date.now) {}

  read(): LeaseRecord | null {
    if (!existsSync(this.path)) return null;
    try {
      const v = JSON.parse(readFileSync(this.path, 'utf8')) as Record<string, unknown>;
      return typeof v.owner === 'string' && typeof v.pid === 'number' && typeof v.until === 'number'
        ? { owner: v.owner, pid: v.pid, until: v.until }
        : null;
    } catch {
      return null;
    }
  }

  create(record: LeaseRecord): boolean {
    let fd: number;
    try {
      mkdirSync(dirname(this.path), { recursive: true });
      fd = openSync(this.path, 'wx'); // 없을 때만 만들기 — 두 창이 동시에 해도 하나만 됨
    } catch (e) {
      const code = (e as { code?: string }).code;
      // 윈도우에서 지워지는 중인 파일 앞에서는 EPERM · EACCES 가 날 수 있음 — 남이 쥔 것으로 봄
      if (code === 'EEXIST' || code === 'EPERM' || code === 'EACCES') return false;
      throw e;
    }
    try {
      writeSync(fd, JSON.stringify(record));
    } finally {
      closeSync(fd);
    }
    return true;
  }

  write(record: LeaseRecord): void {
    writeAtomic(this.path, JSON.stringify(record));
  }

  remove(): void {
    rmSync(this.path, { force: true });
  }

  discard(expected: LeaseRecord): boolean {
    const r = this.read();
    if (!r || r.owner !== expected.owner || r.until !== expected.until) return false;
    // 이름을 바꿔서 치움 — 같은 파일을 두 창이 동시에 바꾸면 하나만 성공
    const aside = `${this.path}.${process.pid}.${Date.now()}.old`;
    try {
      renameSync(this.path, aside);
    } catch {
      return false;
    }
    rmSync(aside, { force: true });
    return true;
  }

  clearCorrupt(): void {
    if (!existsSync(this.path) || this.read() !== null) return;
    try {
      if (this.now() - statSync(this.path).mtimeMs > CORRUPT_AFTER_MS) this.remove();
    } catch {
      // 그 사이 지워짐
    }
  }
}

/** 그 프로세스가 아직 있는지 (signal 0 = 확인만) */
export function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as { code?: string }).code === 'EPERM';
  }
}

export interface WindowLeaseOptions {
  pid?: number;
  isAlive?: (pid: number) => boolean;
  now?: () => number;
  ttlMs?: number;
  renewMs?: number;
  /** 늘리려는데 다른 창이 가져가 있을 때 */
  onLost?: () => void;
  /** 늘리다가 파일 오류 (기록용) */
  onError?: (e: unknown) => void;
}

export class WindowLease {
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly pid: number;
  private readonly isAlive: (pid: number) => boolean;
  private readonly now: () => number;
  private readonly ttlMs: number;
  private readonly renewMs: number;

  constructor(private readonly file: LeaseFile, readonly windowId: string, private readonly options: WindowLeaseOptions = {}) {
    this.pid = options.pid ?? process.pid;
    this.isAlive = options.isAlive ?? processAlive;
    this.now = options.now ?? Date.now;
    this.ttlMs = options.ttlMs ?? 30_000;
    this.renewMs = options.renewMs ?? 10_000;
  }

  /** 지금 이 창이 쥐고 있는지 */
  get held(): boolean {
    return this.timer !== null;
  }

  /** 다른 창이 지금 게임 중인지 */
  heldByOther(): boolean {
    const r = this.file.read();
    return r !== null && r.owner !== this.windowId && this.live(r);
  }

  /** 다른 창이 게임 중이면 false */
  acquire(): boolean {
    this.file.clearCorrupt();
    const r = this.file.read();
    if (r && r.owner !== this.windowId) {
      if (this.live(r)) return false;
      this.file.discard(r); // 끝난 창의 잠금 (남이 막 치우고 새로 만들었으면 아래 create 가 false)
    }
    if (r && r.owner === this.windowId) this.file.write(this.record());
    else if (!this.file.create(this.record())) return false;
    if (!this.timer) this.timer = setInterval(() => this.renew(), this.renewMs);
    return true;
  }

  release(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    try {
      if (this.file.read()?.owner === this.windowId) this.file.remove();
    } catch (e) {
      this.options.onError?.(e);
    }
  }

  private renew(): void {
    try {
      const r = this.file.read();
      if (r && r.owner !== this.windowId) return this.lose();
      if (r) this.file.write(this.record());
      // 누가 지웠으면 다시 만듦 — 그 사이 다른 창이 만들었으면 잃은 것
      else if (!this.file.create(this.record())) this.lose();
    } catch (e) {
      // 한 번 실패해도 다음 늘리기에서 다시 (TTL 이 넉넉함)
      this.options.onError?.(e);
    }
  }

  private lose(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.options.onLost?.();
  }

  private live(r: LeaseRecord): boolean {
    return r.until > this.now() && this.isAlive(r.pid);
  }

  private record(): LeaseRecord {
    return { owner: this.windowId, pid: this.pid, until: this.now() + this.ttlMs };
  }
}
