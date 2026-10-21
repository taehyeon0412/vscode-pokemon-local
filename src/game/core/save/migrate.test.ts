import { describe, expect, it } from 'vitest';
import { createNewSave, readSave, SAVE_VERSION } from './index';
import { migrateSave, type Migrations } from './migrate';

describe('옛 버전 옮기기', () => {
  it('지금 버전은 그대로', () => {
    const raw = { ...createNewSave(0) } as Record<string, unknown>;
    expect(migrateSave(raw)).toEqual({ ok: true, data: raw, from: SAVE_VERSION });
  });

  it('1판 → 2판 (2026-10-21 orders #15) — 칸은 그대로 판만 · 옛 1판 코드는 2판 세이브를 "더 새 버전" 으로 잠그고 쓰지 않음 (새 칸을 지우지 못함)', () => {
    const v1 = { ...createNewSave(0), version: 1, laterChoices: [{ kind: 'learn', uid: 'm1', moveId: 10 }], tips: ['walk'], bag: { pearl: 2 } } as Record<string, unknown>;
    const r = migrateSave(v1);
    expect(r).toEqual({ ok: true, data: { ...v1, version: SAVE_VERSION }, from: 1 });
    // 옛 1판 코드 = migrateSave(raw, 1판 옮기기 없음, current 1)
    expect(migrateSave({ ...v1, version: 2 }, {}, 1)).toEqual({ ok: false, reason: 'newer', version: 2 });
  });

  it('1판 → 2판 → 3판을 차례로 (표본: 2판에서 칸 하나, 3판에서 이름 바꿈)', () => {
    const migrations: Migrations = {
      1: (v1) => ({ ...v1, version: 2, theme: 'forest' }),
      2: ({ theme, ...v2 }) => ({ ...v2, version: 3, background: theme }),
    };
    const r = migrateSave({ version: 1, money: 5 }, migrations, 3);
    expect(r).toEqual({ ok: true, data: { version: 3, money: 5, background: 'forest' }, from: 1 });
  });

  it('더 새 확장의 세이브는 손대지 않음 (newer)', () => {
    expect(migrateSave({ version: 9 })).toEqual({ ok: false, reason: 'newer', version: 9 });
    expect(readSave({ version: 9 })).toEqual({ kind: 'newer', version: 9 });
  });

  it.each([['글자', 'one'], ['0', 0], ['소수', 1.5], ['없음', undefined]])('버전이 %s 이면 알 수 없음', (_n, version) => {
    expect(migrateSave({ version })).toMatchObject({ ok: false, reason: 'unknown-version' });
    expect(readSave({ version }).kind).toBe('broken');
  });

  it('중간 단계가 빠졌으면 알 수 없음', () => {
    expect(migrateSave({ version: 1 }, { 2: (v) => ({ ...v, version: 3 }) }, 3)).toEqual({ ok: false, reason: 'unknown-version', version: 1 });
  });

  it('옮기는 함수가 버전을 잘못 두면 오류 (테스트에서 바로 드러나게)', () => {
    expect(() => migrateSave({ version: 1 }, { 1: (v) => ({ ...v, version: 5 }) }, 2)).toThrow();
  });
});
