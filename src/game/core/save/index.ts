/**
 * 세이브 읽기 — 저장소에서 꺼낸 값을 옛 버전 옮기기 → 검사 순서로 지금 버전 세이브로 만든다.
 * 확장 쪽 저장(host/save-store)과 웹뷰 쪽이 같은 함수를 쓴다.
 */
import { migrateSave, MIGRATIONS, type Migrations } from './migrate';
import { SAVE_VERSION, type Save } from './schema';
import { validateSave } from './validate';

export * from './schema';
export { createNewSave } from './create';
export { NOTIFY_OFF_TIP } from './schema';
export { validateSave, MAX_SPECIES, RUN_SEEN_MAX, type ValidateResult } from './validate';
export { migrateSave, MIGRATIONS, type Migrations, type MigrateResult } from './migrate';
export { freshProgress, modeOf, switchMode } from './progress';

export type ReadSaveResult =
  /** 읽음. problems = 고친 것, migratedFrom = 옛 버전에서 옮겼으면 그 버전 */
  | { kind: 'ok'; save: Save; problems: string[]; migratedFrom: number | null }
  /** 더 새 확장에서 만든 세이브 — 덮어쓰지 말 것 */
  | { kind: 'newer'; version: number }
  /** 읽을 수 없음 — 원본은 따로 보관할 것 */
  | { kind: 'broken'; reason: string };

export function readSave(raw: unknown, migrations: Migrations = MIGRATIONS): ReadSaveResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { kind: 'broken', reason: '세이브가 객체가 아님' };
  let migrated;
  try {
    migrated = migrateSave(raw as Record<string, unknown>, migrations, SAVE_VERSION);
  } catch (e) {
    return { kind: 'broken', reason: `옛 버전 옮기기 실패: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!migrated.ok) {
    if (migrated.reason === 'newer') return { kind: 'newer', version: migrated.version };
    return { kind: 'broken', reason: `알 수 없는 버전 ${String(migrated.version)}` };
  }
  const checked = validateSave(migrated.data);
  if (!checked.ok) return { kind: 'broken', reason: checked.reason };
  return {
    kind: 'ok',
    save: checked.save,
    problems: checked.problems,
    migratedFrom: migrated.from === SAVE_VERSION ? null : migrated.from,
  };
}
