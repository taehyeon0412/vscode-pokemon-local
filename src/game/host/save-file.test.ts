import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileSaveStorage } from './save-file';

const fresh = () => join(mkdtempSync(join(tmpdir(), 'pokemon-save-')), 'globalStorage');

describe('세이브 파일', () => {
  it('없으면 undefined · 쓰고 읽으면 그대로 · 폴더가 없어도 만듦', () => {
    const dir = fresh();
    const f = new FileSaveStorage(join(dir, 'save.json'));
    expect(f.read()).toBeUndefined();
    f.write({ version: 1, money: 5 });
    expect(f.read()).toEqual({ version: 1, money: 5 });
  });

  it('임시 파일이 남지 않고, 바로 전 세이브는 .bak 으로 남음', () => {
    const dir = fresh();
    const f = new FileSaveStorage(join(dir, 'save.json'));
    f.write({ a: 1 });
    f.write({ a: 2 });
    expect(readdirSync(dir).sort()).toEqual(['save.json', 'save.json.bak']);
    expect(f.read()).toEqual({ a: 2 });
  });

  it('save.json 이 깨졌거나 없어지면 바로 전 세이브(.bak)를 읽음 (정전 · 블루스크린)', () => {
    const dir = fresh();
    const f = new FileSaveStorage(join(dir, 'save.json'));
    f.write({ a: 1 });
    f.write({ a: 2 });
    writeFileSync(join(dir, 'save.json'), '\0\0\0\0');
    expect(f.read()).toEqual({ a: 1 });
    f.write({ a: 3 }); // 깨진 것은 .bak 으로 옮기지 않음
    expect(f.read()).toEqual({ a: 3 });
    writeFileSync(join(dir, 'save.json'), '');
    expect(f.read()).toEqual({ a: 1 });
  });

  it('JSON 이 깨졌으면 { unreadable } — 망가진 세이브로 보관되게', () => {
    const dir = fresh();
    const f = new FileSaveStorage(join(dir, 'save.json'));
    f.write({ a: 1 });
    writeFileSync(join(dir, 'save.json'), '{"version": 1, "mons');
    expect(f.read()).toEqual({ unreadable: '{"version": 1, "mons' });
  });
});
