/**
 * 개발 모드 (임시 — gdd 8장, 2026-10-21 태현 님 "개발모드는 나중에 없애는걸로").
 * 지울 때: 이 폴더 (src/game/dev) + "개발 모드 (임시)" 가 적힌 줄 (grep) — DEV_MODE 를 false 로 두면 스위치가 안 보이고 확장도 개발 세이브를 안 씀.
 *
 * 개발 모드에서만 쓰는 진행 중 값 (state.runtime.dev — 세이브에는 안 남음, 확장이 켜짐을 정함):
 * - team = 3:3 미리 켜기 (BALANCE.team.on 과 따로) · walk = 걷기 배 · battle = 전투 시간 배 (웹뷰 시계) · pause = 멈춤
 * - forestLists = 숲 야생을 정한 목록 초안 (gdd 5.4) 으로 (아침 질문 #103 비교 — orders #41)
 * - foes = 장면 바로 가기 상대 팀 (야생 = 첫 마리 · 트레이너 · 관장 3:3 = 셋) · ults = 포켓몬마다 고른 필살기 이름
 */
import { speciesOf } from '../data';

export const DEV_MODE = true;

export interface DevMon {
  dex: number;
  level: number;
}

export interface DevRuntime {
  team: boolean;
  forestLists: boolean;
  walk: number;
  battle: number;
  pause: boolean;
  foes: DevMon[];
  ults: Record<string, string>;
}

export const DEV_WALKS = [1, 4, 10] as const;
export const DEV_BATTLES = [1, 0.5, 0.25] as const;
export const DEV_FOES_MAX = 3;
export const DEV_LEVEL_MAX = 100;

export function devDefault(): DevRuntime {
  return { team: true, forestLists: false, walk: 1, battle: 1, pause: false, foes: [], ults: {} };
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** 다른 쪽에서 온 값 — 이상하면 null (확장이 개발 모드일 때만 붙임) */
export function readDev(raw: unknown): DevRuntime | null {
  if (!isObj(raw)) return null;
  const d = devDefault();
  if (typeof raw.team === 'boolean') d.team = raw.team;
  if (typeof raw.forestLists === 'boolean') d.forestLists = raw.forestLists;
  if ((DEV_WALKS as readonly unknown[]).includes(raw.walk)) d.walk = raw.walk as number;
  if ((DEV_BATTLES as readonly unknown[]).includes(raw.battle)) d.battle = raw.battle as number;
  if (typeof raw.pause === 'boolean') d.pause = raw.pause;
  if (Array.isArray(raw.foes)) {
    d.foes = raw.foes
      .filter((f): f is Obj => isObj(f) && Number.isInteger(f.dex) && Number.isInteger(f.level) && (f.level as number) >= 1 && (f.level as number) <= DEV_LEVEL_MAX && !!speciesOf(f.dex as number))
      .slice(0, DEV_FOES_MAX)
      .map((f) => ({ dex: f.dex as number, level: f.level as number }));
  }
  if (isObj(raw.ults)) {
    for (const [uid, name] of Object.entries(raw.ults).slice(0, 12)) {
      if (uid.length <= 64 && typeof name === 'string' && name.length > 0 && name.length <= 40) d.ults[uid] = name;
    }
  }
  return d;
}

/** 엔진 — 3:3 을 쓸지 (본편 BALANCE.team.on 이 꺼져 있어도 개발 모드에서 켬) */
export const devTeam = (dev: DevRuntime | undefined): boolean => dev?.team === true;
/** 엔진 · 화면 — 숲 야생을 정한 목록 초안 (gdd 5.4) 으로 (개발 모드에서만) */
export const devForestLists = (dev: DevRuntime | undefined): boolean => dev?.forestLists === true;
/** 엔진 — 걷기 배 */
export const devWalk = (dev: DevRuntime | undefined): number => dev?.walk ?? 1;
