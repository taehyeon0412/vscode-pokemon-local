/**
 * 옛 버전 세이브 → 지금 버전.
 * 확장을 업데이트한 사용자의 세이브가 그대로 이어지게, 형식을 바꿀 때마다 여기에 하나씩 더한다 (지우지 않음).
 */
import { SAVE_VERSION } from './schema';

type RawSave = Record<string, unknown>;
/** 키 = 옮기기 전 버전. 결과의 version 은 키 + 1 이어야 함 */
export type Migrations = Readonly<Record<number, (old: RawSave) => RawSave>>;

/** 판마다 하나씩 (지우지 않음) */
export const MIGRATIONS: Migrations = {
  // 1 → 2 (2026-10-21 orders #15): 칸은 그대로 — 새 칸은 모두 옵션 (없으면 기본). 옛 1판 창이 2판 세이브를 "더 새 버전" 으로 잠그게 판만 올림
  1: (v1) => ({ ...v1, version: 2 }),
  // 2 → 3 (2026-10-21 orders #17): settings.teamMode 옵션 칸 — 칸은 그대로 판만
  2: (v2) => ({ ...v2, version: 3 }),
  // 3 → 4 (2026-10-22 orders #30 · dev-log #40 안 A): 연 지역 = 숲 + 받은 지역 배지 순서 (진짜 세이브는 숲뿐 — 해변은 개발 모드 미리 보기라 저장 안 됨) · mode · stash · cleared 는 안 만듦 (없으면 노말 · 처음)
  // 4 → 5 (2026-10-22 orders #83): settings.battleFast 옵션 칸 — 칸은 그대로 판만
  4: (v4) => ({ ...v4, version: 5 }),
  // 5 → 6 (2026-10-22 orders #75 화산): 새 지역 · 스테이지 · 아이템 id — 칸은 그대로 판만
  5: (v5) => ({ ...v5, version: 6 }),
  // 6 → 7 (2026-10-26 #97): settings.teamCutscene 옵션 칸 — 칸은 그대로 판만
  6: (v6) => ({ ...v6, version: 7 }),
  3: (v3) => ({ ...v3, version: 4, regions: { order: ['forest', ...(Array.isArray(v3.badges) ? v3.badges.filter((b) => typeof b === 'string' && b !== 'forest') : [])] } }),
};

export type MigrateResult =
  | { ok: true; data: RawSave; from: number }
  | { ok: false; reason: 'newer'; version: number }
  | { ok: false; reason: 'unknown-version'; version: unknown };

export function migrateSave(raw: RawSave, migrations: Migrations = MIGRATIONS, current: number = SAVE_VERSION): MigrateResult {
  const from = raw.version;
  if (typeof from !== 'number' || !Number.isInteger(from) || from < 1) return { ok: false, reason: 'unknown-version', version: from };
  // 더 새 확장에서 만든 세이브 — 옛 확장으로 덮어쓰면 날아가므로 손대지 않음
  if (from > current) return { ok: false, reason: 'newer', version: from };

  let data = raw;
  for (let v = from; v < current; v++) {
    const step = migrations[v];
    if (!step) return { ok: false, reason: 'unknown-version', version: v };
    data = step(data);
    if (data.version !== v + 1) throw new Error(`세이브 옮기기 ${v} → ${v + 1} 가 version 을 ${String(data.version)} 로 둠`);
  }
  return { ok: true, data, from };
}
