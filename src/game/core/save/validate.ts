/**
 * 세이브 검사 — 읽은 세이브를 믿지 않고 한 칸씩 확인한다.
 * - 고칠 수 있는 것 (범위 밖 숫자 · 없는 포켓몬을 가리키는 팀 칸 등)은 고치고 problems 에 적는다
 * - 고칠 수 없는 것 (객체가 아님 · 버전이 다름 · 포켓몬 목록이 없음)은 ok: false
 * 포켓몬을 잃지 않는 쪽으로 고친다 (팀 · 보관함 어디에도 없는 포켓몬 → 보관함).
 */
import { BALANCE } from '../balance';
import {
  ENCOUNTER_STARTS, ITEM_IDS, LOCATION_SCREENS, SAVE_VERSION, STAGE_IDS, STAT_KEYS, STATUS_KINDS,
  type Encounter, type FacilitySpot, type ItemId, type LastHospital, type Location, type Monster,
  type MoveSlot, type PendingChoice, type Save, type StageId, type StageProgress, type StageRun, type Stats, type StatusCondition,
} from './schema';
import { evolutionsOf, moveOf, speciesOf } from '../../data';
import { heroLookOf, isHeroLookId } from '../../data/heroes';

export type ValidateResult =
  | { ok: true; save: Save; problems: string[] }
  | { ok: false; reason: string };

/** 전국 도감 끝 번호 (9세대). 확장에 실제로 있는 종인지는 데이터(단계 2)로 따로 확인 */
export const MAX_SPECIES = 1025;
/** 잠듦 1~3번 (mvp-spec 3.3) */
const MAX_SLEEP_TURNS = 3;
/** SaveV1 의 칸 이름 — 모르는 칸은 고칠 때 뺌 */
const KNOWN_KEYS: readonly (keyof Save)[] = [
  'version', 'createdAt', 'updatedAt', 'playTimeMs', 'player', 'monsters', 'party', 'box', 'nextMonsterUid',
  'bag', 'money', 'badges', 'stages', 'location', 'lastHospital', 'dex', 'pendingEncounter', 'pendingChoices', 'settings',
];

/** 클리어 카드에 보일 새로 만난 포켓몬 수 */
export const RUN_SEEN_MAX = 6;

/** 포켓몬 uid 의 숫자 상한 ("m" + 9자리) — 열쇠 이름 규칙과 nextMonsterUid 가 늘 맞게 */
const MAX_UID_NUMBER = 999_999_999;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
/** 물려받은 이름(toString · constructor · __proto__)이 아닌 자기 칸인지 */
const hasOwn = (o: object, key: string): boolean => Object.prototype.hasOwnProperty.call(o, key);
/** "m123" → 123, 규칙에 안 맞으면 null */
const uidNumber = (key: string): number | null => {
  const m = /^m(\d{1,9})$/.exec(key);
  return m ? Number(m[1]) : null;
};
const isStageId = (v: unknown): v is StageId => (STAGE_IDS as readonly unknown[]).includes(v);
const isItemId = (v: unknown): v is ItemId => (ITEM_IDS as readonly unknown[]).includes(v);

/** 값 하나씩 읽으며 고친 것을 적어 두는 도우미 */
class Fixer {
  readonly problems: string[] = [];

  note(path: string, what: string): void {
    this.problems.push(`${path}: ${what}`);
  }

  int(v: unknown, path: string, min: number, max: number, fallback: number): number {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      this.note(path, `숫자가 아님 → ${fallback}`);
      return fallback;
    }
    let n = Math.round(v);
    if (n !== v) this.note(path, `정수가 아님 → ${n}`);
    if (n < min) {
      this.note(path, `${n} < ${min} → ${min}`);
      n = min;
    } else if (n > max) {
      this.note(path, `${n} > ${max} → ${max}`);
      n = max;
    }
    return n;
  }

  ratio(v: unknown, path: string): number {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      this.note(path, '숫자가 아님 → 0');
      return 0;
    }
    if (v < 0 || v > 1) {
      const c = Math.min(1, Math.max(0, v));
      this.note(path, `${v} 가 0~1 밖 → ${c}`);
      return c;
    }
    return v;
  }

  bool(v: unknown, path: string, fallback: boolean): boolean {
    if (typeof v === 'boolean') return v;
    this.note(path, `참/거짓이 아님 → ${fallback}`);
    return fallback;
  }

  text(v: unknown, path: string, fallback: string): string {
    if (typeof v === 'string' && v.length > 0) return v;
    this.note(path, `글자가 아님 → "${fallback}"`);
    return fallback;
  }

  /** 중복 없는 글자 목록 */
  texts(v: unknown, path: string): string[] {
    if (!Array.isArray(v)) {
      this.note(path, '목록이 아님 → 빈 목록');
      return [];
    }
    const out: string[] = [];
    for (const x of v) {
      if (typeof x !== 'string' || x.length === 0) this.note(path, `글자가 아닌 칸을 뺌 (${String(x)})`);
      else if (out.includes(x)) this.note(path, `겹친 "${x}" 를 뺌`);
      else out.push(x);
    }
    return out;
  }

  /** 도감 번호 목록 — 중복 없이 작은 순서로 */
  speciesList(v: unknown, path: string): number[] {
    if (!Array.isArray(v)) {
      this.note(path, '목록이 아님 → 빈 목록');
      return [];
    }
    const set = new Set<number>();
    for (const x of v) {
      if (typeof x === 'number' && Number.isInteger(x) && x >= 1 && x <= MAX_SPECIES) set.add(x);
      else this.note(path, `도감 번호가 아닌 칸을 뺌 (${String(x)})`);
    }
    return [...set].sort((a, b) => a - b);
  }
}

function readStats(v: unknown, path: string, fx: Fixer, max: number): Stats {
  const src = isObj(v) ? v : {};
  if (!isObj(v)) fx.note(path, '스탯이 없음 → 0');
  const out = {} as Stats;
  for (const k of STAT_KEYS) out[k] = fx.int(src[k], `${path}.${k}`, 0, max, 0);
  return out;
}

function readMoves(v: unknown, path: string, fx: Fixer): MoveSlot[] {
  if (!Array.isArray(v)) {
    fx.note(path, '목록이 아님 → 기술 없음');
    return [];
  }
  const out: MoveSlot[] = [];
  v.forEach((m, i) => {
    const p = `${path}[${i}]`;
    if (!isObj(m) || typeof m.moveId !== 'number' || !Number.isInteger(m.moveId) || m.moveId < 1) {
      fx.note(p, '기술 번호가 없어 뺌');
      return;
    }
    if (out.some((x) => x.moveId === m.moveId)) {
      fx.note(p, `겹친 기술 ${m.moveId} 를 뺌`);
      return;
    }
    if (out.length >= BALANCE.moveSlots) {
      fx.note(p, `기술 칸 ${BALANCE.moveSlots}개를 넘어 뺌`);
      return;
    }
    out.push({ moveId: m.moveId, pp: fx.int(m.pp, `${p}.pp`, 0, 99, 0) });
  });
  return out;
}

function readStatus(v: unknown, path: string, fx: Fixer): StatusCondition | null {
  if (v === null) return null;
  if (!isObj(v) || !(STATUS_KINDS as readonly unknown[]).includes(v.kind)) {
    fx.note(path, '알 수 없는 상태 이상 → 없음');
    return null;
  }
  if (v.kind === 'sleep') {
    return { kind: 'sleep', turnsLeft: fx.int(v.turnsLeft, `${path}.turnsLeft`, 1, MAX_SLEEP_TURNS, 1) };
  }
  return { kind: v.kind as 'poison' | 'burn' | 'paralysis' };
}

/** 포켓몬 한 마리 — 종 · 그림 이름이 없으면 살릴 수 없어 null. uid 가 없으면 fallbackUid */
function readMonster(v: unknown, path: string, fx: Fixer, fallbackUid: string): Monster | null {
  if (!isObj(v)) {
    fx.note(path, '포켓몬이 객체가 아니어서 뺌');
    return null;
  }
  if (typeof v.species !== 'number' || !Number.isInteger(v.species) || v.species < 1 || v.species > MAX_SPECIES) {
    fx.note(path, `도감 번호가 맞지 않아 뺌 (${String(v.species)})`);
    return null;
  }
  if (typeof v.form !== 'string' || v.form.length === 0) {
    fx.note(path, '그림 이름(form)이 없어 뺌');
    return null;
  }
  return {
    uid: fx.text(v.uid, `${path}.uid`, fallbackUid),
    species: v.species,
    form: v.form,
    level: fx.int(v.level, `${path}.level`, 1, BALANCE.maxLevel, 1),
    exp: fx.int(v.exp, `${path}.exp`, 0, Number.MAX_SAFE_INTEGER, 0),
    ivs: readStats(v.ivs, `${path}.ivs`, fx, BALANCE.maxIv),
    points: readStats(v.points, `${path}.points`, fx, 10_000),
    unspentPoints: fx.int(v.unspentPoints, `${path}.unspentPoints`, 0, 10_000, 0),
    moves: readMoves(v.moves, `${path}.moves`, fx),
    hp: fx.int(v.hp, `${path}.hp`, 0, 100_000, 0),
    status: readStatus(v.status, `${path}.status`, fx),
    shiny: fx.bool(v.shiny, `${path}.shiny`, false),
    caughtAt: fx.text(v.caughtAt, `${path}.caughtAt`, 'unknown'),
  };
}

function readFacilities(v: unknown, path: string, fx: Fixer): FacilitySpot[] {
  if (!Array.isArray(v)) {
    fx.note(path, '목록이 아님 → 빈 목록');
    return [];
  }
  const out: FacilitySpot[] = [];
  v.forEach((f, i) => {
    if (isObj(f) && (f.kind === 'hospital' || f.kind === 'shop')) out.push({ kind: f.kind, at: fx.ratio(f.at, `${path}[${i}].at`) });
    else fx.note(`${path}[${i}]`, '병원 · 상점이 아니어서 뺌');
  });
  return out;
}

/** 이번 판 기록 — 옛 세이브에 칸이 없으면 빈 기록 (단계 9 에서 더함, 버전은 1 그대로) */
function readRun(v: unknown, path: string, fx: Fixer, playTimeMs: number): StageRun {
  if (v === undefined) return { startMs: playTimeMs, caught: 0, trainers: 0, seen: [], reach: 0, retries: 0 };
  const r = isObj(v) ? v : {};
  if (!isObj(v)) fx.note(path, '객체가 아님 → 빈 기록');
  return {
    startMs: fx.int(r.startMs, `${path}.startMs`, 0, Number.MAX_SAFE_INTEGER, playTimeMs),
    caught: fx.int(r.caught, `${path}.caught`, 0, 100_000, 0),
    trainers: fx.int(r.trainers, `${path}.trainers`, 0, 100, 0),
    seen: fx.speciesList(r.seen, `${path}.seen`).slice(0, RUN_SEEN_MAX),
    reach: r.reach === undefined ? 0 : fx.ratio(r.reach, `${path}.reach`),
    retries: r.retries === undefined ? 0 : fx.int(r.retries, `${path}.retries`, 0, 100_000, 0),
  };
}

function readStage(v: unknown, path: string, fx: Fixer, playTimeMs: number): StageProgress | null {
  if (!isObj(v)) {
    fx.note(path, '스테이지 진행이 객체가 아니어서 뺌');
    return null;
  }
  return {
    seed: fx.int(v.seed, `${path}.seed`, 0, 0xffffffff, 0),
    progress: fx.ratio(v.progress, `${path}.progress`),
    cleared: fx.bool(v.cleared, `${path}.cleared`, false),
    defeatedTrainers: fx.texts(v.defeatedTrainers, `${path}.defeatedTrainers`),
    facilities: readFacilities(v.facilities, `${path}.facilities`, fx),
    run: readRun(v.run, `${path}.run`, fx, playTimeMs),
  };
}

function readLocation(v: unknown, path: string, fx: Fixer): Location {
  if (isObj(v) && (LOCATION_SCREENS as readonly unknown[]).includes(v.screen)) {
    if (v.screen === 'stage') {
      if (isStageId(v.stageId)) return { screen: 'stage', stageId: v.stageId };
    } else {
      return { screen: v.screen as 'title' | 'gym' | 'world-map' };
    }
  }
  fx.note(path, '알 수 없는 곳 → 타이틀');
  return { screen: 'title' };
}

function readLastHospital(v: unknown, path: string, fx: Fixer): LastHospital | null {
  if (v === null) return null;
  if (isObj(v) && isStageId(v.stageId)) return { stageId: v.stageId, at: fx.ratio(v.at, `${path}.at`) };
  fx.note(path, '알 수 없는 병원 → 없음');
  return null;
}

function readEncounter(v: unknown, path: string, fx: Fixer): Encounter | null {
  if (v === null) return null;
  if (isObj(v)) {
    if (v.kind === 'wild') {
      // 아직 안 잡은 상대라 팀 uid 가 없음 → 'wild'
      const monster = readMonster(v.monster, `${path}.monster`, fx, 'wild');
      const start = ENCOUNTER_STARTS.find((s) => s === v.start);
      if (monster && start) return { kind: 'wild', monster, start };
    } else if (v.kind === 'trainer') {
      if (typeof v.trainerId === 'string' && v.trainerId && isStageId(v.stageId)) {
        return { kind: 'trainer', trainerId: v.trainerId, stageId: v.stageId };
      }
    } else if (v.kind === 'gym-leader') {
      return { kind: 'gym-leader' };
    }
  }
  fx.note(path, '하던 전투를 읽지 못함 → 전투 없이 이어 함');
  return null;
}

/** 전투 끝에 남은 고르기 — 없는 포켓몬 · 모르는 기술 · 이상한 칸은 빼고 (빠져도 다음 레벨업 · 진화 때 다시 나옴). 옛 세이브에 칸이 없으면 빈 목록 */
function readChoices(v: unknown, path: string, fx: Fixer, monsters: Record<string, Monster>, renamed: Map<string, string>): PendingChoice[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) {
    fx.note(path, '목록이 아님 → 비움');
    return [];
  }
  const out: PendingChoice[] = [];
  v.forEach((c, i) => {
    const p = `${path}[${i}]`;
    // 열쇠 이름을 고친 포켓몬이면 새 이름으로 · 목록에 진짜로 있는 포켓몬만 (toString 같은 이름은 안 됨)
    const uid = isObj(c) && typeof c.uid === 'string' ? (renamed.get(c.uid) ?? c.uid) : null;
    if (isObj(c) && uid !== null && Object.prototype.hasOwnProperty.call(monsters, uid)) {
      if (c.kind === 'learn' && Number.isInteger(c.moveId) && moveOf(c.moveId as number)) {
        out.push({ kind: 'learn', uid, moveId: c.moveId as number });
        return;
      }
      const newMoves = Array.isArray(c.newMoves) ? c.newMoves.filter((m): m is number => Number.isInteger(m) && !!moveOf(m as number)).slice(0, 4) : null;
      // 진화는 그 종의 진짜 진화만 · 포켓몬마다 하나만 (손으로 고친 세이브에서 뮤츠로 "진화" 하지 않게)
      const realEvolution = Number.isInteger(c.to) && evolutionsOf(monsters[uid]!.species).some((e) => e.to === c.to);
      const already = out.some((x) => x.kind === 'evolve' && x.uid === uid);
      if (c.kind === 'evolve' && realEvolution && !already && speciesOf(c.to as number) && newMoves && Number.isInteger(c.level) && (c.level as number) >= 1 && (c.level as number) <= BALANCE.maxLevel && (c.item === null || isItemId(c.item))) {
        out.push({ kind: 'evolve', uid, to: c.to as number, newMoves, level: c.level as number, item: c.item as ItemId | null });
        return;
      }
    }
    fx.note(p, '고르기를 읽지 못해 뺌');
  });
  return out;
}

function readBag(v: unknown, path: string, fx: Fixer): Save['bag'] {
  const bag: Save['bag'] = {};
  if (!isObj(v)) {
    fx.note(path, '가방이 객체가 아님 → 빈 가방');
    return bag;
  }
  for (const [key, count] of Object.entries(v)) {
    if (!isItemId(key)) {
      fx.note(`${path}.${key}`, '알 수 없는 아이템을 뺌');
      continue;
    }
    const n = fx.int(count, `${path}.${key}`, 0, 999, 0);
    if (n > 0) bag[key] = n;
  }
  return bag;
}

/**
 * 팀 · 보관함 — 없는 포켓몬 · 겹친 칸을 빼고, 팀이 넘치면 보관함으로, 어디에도 없는 포켓몬은 보관함으로.
 * renamed: 열쇠 이름을 바꾼 포켓몬 (옛 이름 → 새 uid) — 팀 · 보관함 칸도 따라 바꿈
 */
function readRoster(raw: Obj, monsters: Record<string, Monster>, renamed: Map<string, string>, fx: Fixer): { party: string[]; box: string[] } {
  const seen = new Set<string>();
  const take = (list: unknown, path: string): string[] => {
    if (!Array.isArray(list)) {
      fx.note(path, '목록이 아님 → 빈 목록');
      return [];
    }
    const out: string[] = [];
    for (const entry of list) {
      const uid = typeof entry === 'string' ? (renamed.get(entry) ?? entry) : entry;
      if (typeof uid !== 'string' || !hasOwn(monsters, uid)) fx.note(path, `없는 포켓몬 "${String(uid)}" 를 뺌`);
      else if (seen.has(uid)) fx.note(path, `겹친 "${uid}" 를 뺌`);
      else {
        seen.add(uid);
        out.push(uid);
      }
    }
    return out;
  };
  let party = take(raw.party, 'party');
  const box = take(raw.box, 'box');
  if (party.length > BALANCE.partySize) {
    fx.note('party', `팀이 ${BALANCE.partySize}마리를 넘어 나머지를 보관함으로`);
    box.unshift(...party.slice(BALANCE.partySize));
    party = party.slice(0, BALANCE.partySize);
  }
  for (const uid of Object.keys(monsters)) {
    if (!seen.has(uid)) {
      fx.note('box', `팀 · 보관함 어디에도 없던 "${uid}" 를 보관함으로`);
      box.push(uid);
    }
  }
  return { party, box };
}

export function validateSave(raw: unknown): ValidateResult {
  if (!isObj(raw)) return { ok: false, reason: '세이브가 객체가 아님' };
  if (raw.version !== SAVE_VERSION) return { ok: false, reason: `버전이 ${SAVE_VERSION} 이 아님 (${String(raw.version)})` };
  if (!isObj(raw.monsters)) return { ok: false, reason: '포켓몬 목록(monsters)이 없음' };

  const fx = new Fixer();
  const known = new Set<string>(KNOWN_KEYS);
  for (const key of Object.keys(raw)) if (!known.has(key)) fx.note(key, '모르는 칸을 뺌');

  // 포켓몬 목록 — 열쇠는 "m숫자" 만 받음 (toString · __proto__ 같은 이름이 끼지 않게).
  // 규칙에 안 맞는 열쇠는 새 번호로 바꾸고, 팀 · 보관함 칸도 따라 바꿈 (포켓몬을 잃지 않게)
  const entries = Object.entries(raw.monsters);
  let nextFree = Math.max(0, ...entries.map(([key]) => uidNumber(key) ?? 0)) + 1;
  const renamed = new Map<string, string>();
  const monsters: Record<string, Monster> = {};
  for (const [key, m] of entries) {
    let uid = key;
    if (uidNumber(key) === null) {
      uid = `m${nextFree++}`;
      renamed.set(key, uid);
      fx.note(`monsters.${key}`, `열쇠 이름이 규칙(m숫자)에 안 맞아 "${uid}" 로 바꿈`);
    }
    const mon = readMonster(m, `monsters.${key}`, fx, uid);
    if (!mon) continue;
    if (mon.uid !== uid) {
      fx.note(`monsters.${key}.uid`, `"${mon.uid}" → "${uid}" (목록 이름과 맞춤)`);
      mon.uid = uid;
    }
    monsters[uid] = mon;
  }
  const { party, box } = readRoster(raw, monsters, renamed, fx);
  if (party.length === 0 && box.length > 0) {
    const lead = box.shift() as string;
    fx.note('party', `팀이 비어 보관함 첫 포켓몬 "${lead}" 를 팀으로`);
    party.push(lead);
  }

  // 다음 uid 는 지금 있는 어떤 "m숫자" 보다 커야 겹치지 않음
  const maxUid = Math.max(0, ...Object.keys(monsters).map((u) => uidNumber(u) ?? 0));
  let nextMonsterUid = fx.int(raw.nextMonsterUid, 'nextMonsterUid', 1, MAX_UID_NUMBER, maxUid + 1);
  if (nextMonsterUid <= maxUid) {
    fx.note('nextMonsterUid', `${nextMonsterUid} 가 있는 번호와 겹침 → ${maxUid + 1}`);
    nextMonsterUid = maxUid + 1;
  }

  let player: Save['player'] = null;
  if (raw.player !== null) {
    if (isObj(raw.player) && (raw.player.gender === 'male' || raw.player.gender === 'female')) {
      player = { gender: raw.player.gender };
      // 고른 캐릭터 — 모르는 이름이면 버림 (성별의 첫 캐릭터로 보임)
      if (isHeroLookId(raw.player.look)) {
        player.look = raw.player.look;
        // 고른 캐릭터와 성별이 다르면 (손으로 고친 세이브) 캐릭터 쪽으로 — 고른 모습을 지키려고
        const lookGender = heroLookOf(raw.player.look).gender;
        if (lookGender !== player.gender) {
          fx.note('player.gender', `캐릭터 ${raw.player.look} 와 성별이 다름 → ${lookGender}`);
          player.gender = lookGender;
        }
      } else if (raw.player.look !== undefined) fx.note('player.look', `모르는 캐릭터 ${String(raw.player.look)} → 성별의 첫 캐릭터`);
    } else fx.note('player', '주인공을 읽지 못함 → 고르기 전');
  }

  const playTimeMs = fx.int(raw.playTimeMs, 'playTimeMs', 0, Number.MAX_SAFE_INTEGER, 0);
  const stages: Save['stages'] = {};
  if (isObj(raw.stages)) {
    for (const [id, s] of Object.entries(raw.stages)) {
      if (!isStageId(id)) {
        fx.note(`stages.${id}`, '알 수 없는 스테이지를 뺌');
        continue;
      }
      const stage = readStage(s, `stages.${id}`, fx, playTimeMs);
      if (stage) stages[id] = stage;
    }
  } else {
    fx.note('stages', '객체가 아님 → 진행 없음');
  }

  const dexRaw = isObj(raw.dex) ? raw.dex : {};
  if (!isObj(raw.dex)) fx.note('dex', '객체가 아님 → 빈 기록');
  const caught = fx.speciesList(dexRaw.caught, 'dex.caught');
  const seenList = fx.speciesList(dexRaw.seen, 'dex.seen');
  const missingSeen = caught.filter((n) => !seenList.includes(n));
  if (missingSeen.length > 0) fx.note('dex.seen', `잡은 종은 만난 종에도 넣음 (${missingSeen.join(', ')})`);
  const seen = [...new Set([...seenList, ...caught])].sort((a, b) => a - b);

  const settingsRaw = isObj(raw.settings) ? raw.settings : {};
  if (!isObj(raw.settings)) fx.note('settings', '객체가 아님 → 기본값');

  let location = readLocation(raw.location, 'location', fx);
  if (party.length === 0 && box.length === 0 && location.screen !== 'title') {
    fx.note('location', '포켓몬이 하나도 없음 → 타이틀 (스타팅부터)');
    location = { screen: 'title' };
  }

  const save: Save = {
    version: SAVE_VERSION,
    createdAt: fx.int(raw.createdAt, 'createdAt', 0, Number.MAX_SAFE_INTEGER, 0),
    updatedAt: fx.int(raw.updatedAt, 'updatedAt', 0, Number.MAX_SAFE_INTEGER, 0),
    playTimeMs,
    player,
    monsters,
    party,
    box,
    nextMonsterUid,
    bag: readBag(raw.bag, 'bag', fx),
    money: fx.int(raw.money, 'money', 0, 999_999_999, 0),
    badges: fx.texts(raw.badges, 'badges'),
    stages,
    location,
    lastHospital: readLastHospital(raw.lastHospital ?? null, 'lastHospital', fx),
    dex: { seen, caught },
    pendingEncounter: readEncounter(raw.pendingEncounter ?? null, 'pendingEncounter', fx),
    pendingChoices: readChoices(raw.pendingChoices, 'pendingChoices', fx, monsters, renamed),
    settings: {
      notifications: fx.bool(settingsRaw.notifications, 'settings.notifications', true),
      autoBattle: fx.bool(settingsRaw.autoBattle, 'settings.autoBattle', false),
    },
  };
  return { ok: true, save, problems: fx.problems };
}
