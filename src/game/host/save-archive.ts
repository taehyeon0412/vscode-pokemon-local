/**
 * 세이브 보관함 — 읽지 못한 · 고쳐서 읽은 · 옮기기 전 · 더 새 버전 · 새로 하기 전 세이브의 원본을 지우지 않고
 * 전역 저장 폴더의 save-archive/ 에 파일로 둔다 (세이브 파일 save.json 과 따로).
 * - 같은 원본은 한 번만 (켤 때마다 같은 망가진 세이브가 쌓여 다른 보관본을 밀어내지 않게)
 * - 최근 KEEP 개까지 (오래된 것부터 지움)
 */
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';

export type ArchiveReason = 'broken' | 'repaired' | 'before-migration' | 'newer' | 'replaced';

export interface ArchiveEntry {
  file: string;
  reason: ArchiveReason;
}

export interface SaveArchive {
  add(reason: ArchiveReason, note: string, raw: unknown): Promise<void>;
  list(): Promise<ArchiveEntry[]>;
}

const KEEP = 10;
const NAME = /^(\d{8}T\d{9})-([a-z-]+)-([0-9a-f]{12})\.json$/;

export class FileSaveArchive implements SaveArchive {
  constructor(private readonly dir: string, private readonly now: () => number = Date.now, private readonly keep = KEEP) {}

  async add(reason: ArchiveReason, note: string, raw: unknown): Promise<void> {
    const body = JSON.stringify(raw) ?? 'null';
    const hash = createHash('sha1').update(body).digest('hex').slice(0, 12);
    await fs.mkdir(this.dir, { recursive: true });
    const names = await this.names();
    if (names.some((n) => NAME.exec(n)?.[3] === hash)) return;
    // 이름 = 시각-까닭-원본해시.json (이름 순서 = 시간 순서)
    const stamp = new Date(this.now()).toISOString().replace(/[-:]/g, '').replace('.', '').replace('Z', '');
    const file = `${stamp}-${reason}-${hash}.json`;
    await fs.writeFile(join(this.dir, file), JSON.stringify({ at: this.now(), reason, note, raw }, null, 1), 'utf8');
    const all = [...names, file].sort();
    for (const old of all.slice(0, Math.max(0, all.length - this.keep))) await fs.rm(join(this.dir, old), { force: true });
  }

  async list(): Promise<ArchiveEntry[]> {
    return (await this.names()).sort().map((file) => ({ file, reason: NAME.exec(file)?.[2] as ArchiveReason }));
  }

  private async names(): Promise<string[]> {
    try {
      return (await fs.readdir(this.dir)).filter((n) => NAME.test(n));
    } catch {
      return [];
    }
  }
}
