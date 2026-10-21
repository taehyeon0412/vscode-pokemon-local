import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileSaveArchive } from './save-archive';

const fresh = () => join(mkdtempSync(join(tmpdir(), 'pokemon-archive-')), 'save-archive');

describe('세이브 보관함 (파일)', () => {
  it('원본을 파일로 두고, 까닭 · 메모 · 원본이 그대로 들어 있음', async () => {
    const dir = fresh();
    let t = Date.UTC(2026, 9, 18, 1, 2, 3, 456);
    const a = new FileSaveArchive(dir, () => t++);
    await a.add('broken', 'monsters 가 없음', { version: 1, monsters: 'oops' });
    const files = readdirSync(dir);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^20261018T010203456-broken-[0-9a-f]{12}\.json$/);
    const body = JSON.parse(readFileSync(join(dir, files[0]!), 'utf8')) as Record<string, unknown>;
    expect(body).toMatchObject({ reason: 'broken', note: 'monsters 가 없음', raw: { version: 1, monsters: 'oops' } });
    expect(await a.list()).toEqual([{ file: files[0], reason: 'broken' }]);
  });

  it('같은 원본은 한 번만 (켤 때마다 쌓이지 않음)', async () => {
    const dir = fresh();
    const a = new FileSaveArchive(dir);
    for (let i = 0; i < 3; i++) await a.add('broken', '같은 것', { x: 1 });
    await a.add('replaced', '다른 까닭이어도 같은 원본', { x: 1 });
    expect(readdirSync(dir)).toHaveLength(1);
  });

  it('최근 것만 남김 (오래된 것부터 지움)', async () => {
    const dir = fresh();
    let t = Date.UTC(2026, 0, 1);
    const a = new FileSaveArchive(dir, () => (t += 1000), 3);
    for (let i = 0; i < 5; i++) await a.add('repaired', `#${i}`, { i });
    const kept = (await a.list()).map((e) => JSON.parse(readFileSync(join(dir, e.file), 'utf8')).raw.i as number);
    expect(kept).toEqual([2, 3, 4]);
  });

  it('새로 하기 · 불러오기 전 세이브 (replaced) 는 최근 넷을 더 지킴 — 몇 번 불러와도 처음 세이브가 밀려 지워지지 않음 (코드 리뷰어 #48 큼 3)', async () => {
    const dir = fresh();
    let t = Date.UTC(2026, 0, 1);
    const a = new FileSaveArchive(dir, () => (t += 1000), 3);
    await a.add('replaced', '처음 세이브', { first: true });
    for (let i = 0; i < 6; i++) await a.add('repaired', `#${i}`, { i });
    const entries = await a.list();
    expect(entries.filter((e) => e.reason === 'replaced')).toHaveLength(1);
    expect(entries.filter((e) => e.reason === 'repaired')).toHaveLength(3);
  });

  it('불러오기만 여러 번 (replaced 만 12번) 해도 처음 세이브 (가장 오래된 백업) 와 최근 넷은 남음 (테스터 #48)', async () => {
    const dir = fresh();
    let t = Date.UTC(2026, 0, 1);
    const a = new FileSaveArchive(dir, () => (t += 1000), 3);
    for (let i = 0; i < 12; i++) await a.add('replaced', `#${i}`, { i });
    const kept = (await a.list()).map((e) => JSON.parse(readFileSync(join(dir, e.file), 'utf8')).raw.i as number);
    expect(kept).toEqual([0, 8, 9, 10, 11]);
  });

  it('폴더가 없으면 빈 목록', async () => {
    expect(await new FileSaveArchive(fresh()).list()).toEqual([]);
  });
});
