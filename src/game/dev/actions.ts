/**
 * 개발 모드 (임시, gdd 8장) — 개발 메뉴가 게임 상태를 바로 바꾸는 것 (화면 · 확장과 떼어 둔 계산 — 자동 테스트).
 * 진짜 게임 규칙 함수로 장면을 만들어서, 바로 간 장면도 보통 플레이와 같은 길로 이어짐 (이기면 보상 · 지면 패배 · 진화 고르기 등).
 */
import { BALANCE } from '../core/balance';
import { startBattle } from '../core/engine/battle';
import { Rng } from '../core/engine/rng';
import type { GameState, RuntimeState, StageRuntime } from '../core/engine/state';
import { pickTeam, startTeamBattle } from '../core/engine/team';
import type { Fighter } from '../core/rules/battle';
import { forestPool } from '../core/rules/encounter';
import { evolutionLevel, evolutionMoves, pickEvolution } from '../core/rules/growth';
import { createMonster, wildMoves } from '../core/rules/monster';
import { pickRival } from '../core/rules/rival';
import { trainerId } from '../core/rules/stage';
import { expForLevel, maxHp } from '../core/rules/stats';
import { aliveCount, GYM_LEADER, leaderTeam, trainerInfo, trainerTeam } from '../core/rules/trainer';
import { ITEM_IDS, STAGE_IDS, type ItemId, type Monster, type Save, type StageId } from '../core/save';
import { evolutionsOf, speciesOf } from '../data';
import { DEV_BATTLES, DEV_FOES_MAX, DEV_LEVEL_MAX, DEV_WALKS, devDefault, type DevMon, type DevRuntime } from './runtime';

export type DevScene = 'stage-1' | 'stage-2' | 'stage-3' | 'wild' | 'catch' | 'evolve' | 'rival' | 'trainer-team' | 'gym-team' | 'gym-enter' | 'lobby';

export type DevAction =
  | { kind: 'scene'; scene: DevScene }
  /** 내 팀 칸 (0 ~ 5) 에 포켓몬 — 칸이 비었으면 뒤에 더함 */
  | { kind: 'mon'; slot: number; dex: number; level: number }
  | { kind: 'mon-remove'; slot: number }
  | { kind: 'level'; uid: string; level: number }
  /** 필살기 고르기 (null = 돌아가며) */
  | { kind: 'ult'; uid: string; name: string | null }
  | { kind: 'foe'; slot: number; dex: number; level: number }
  | { kind: 'foe-remove'; slot: number }
  | { kind: 'gauge-full' }
  | { kind: 'heal' }
  | { kind: 'hp1'; side: 'me' | 'foe' }
  | { kind: 'money' }
  | { kind: 'balls' }
  | { kind: 'items' }
  | { kind: 'pre-evolve' }
  | { kind: 'team'; on: boolean }
  | { kind: 'walk' }
  | { kind: 'battle-speed' }
  | { kind: 'pause' };

/** 한 줄 알림 (안 되는 까닭 · 한 일) — 개발 메뉴 아래에 */
export interface DevResult {
  state: GameState;
  say: string;
}

const devOf = (rt: RuntimeState): DevRuntime => rt.dev ?? devDefault();
const withDev = (state: GameState, change: (d: DevRuntime) => DevRuntime): GameState => ({ ...state, runtime: { ...state.runtime, dev: change(devOf(state.runtime)) } });
const cycle = <T>(list: readonly T[], now: T): T => list[(list.indexOf(now) + 1) % list.length]!;
const nameOf = (dex: number) => speciesOf(dex)?.name.ko ?? `#${dex}`;
const STAGE_OF: Record<'stage-1' | 'stage-2' | 'stage-3', StageId> = { 'stage-1': 'forest-1', 'stage-2': 'forest-2', 'stage-3': 'forest-3' };

/** 지금 스테이지 (체육관 · 지도면 1-1) */
function hereOf(save: Save): StageId {
  return save.location.screen === 'stage' ? save.location.stageId : 'forest-1';
}

/** 그 스테이지에 서서 장면만 바꿈 — 길 진행 · 이긴 트레이너는 처음부터 (같은 트레이너 · 라이벌을 다시 만나게), 고르기 · 만남은 비움 */
function standOn(state: GameState, id: StageId, rng: Rng, progress = 0): Save {
  const prev = state.save.stages[id];
  return {
    ...state.save,
    location: { screen: 'stage', stageId: id },
    pendingEncounter: null,
    pendingChoices: [],
    stages: {
      ...state.save.stages,
      [id]: {
        seed: prev?.seed ?? rng.int(0, 0xffffffff),
        progress,
        cleared: prev?.cleared ?? false,
        defeatedTrainers: [],
        facilities: prev?.facilities ?? [],
        run: { startMs: state.save.playTimeMs, caught: 0, trainers: 0, seen: [], reach: 0, retries: 0 },
      },
    },
  };
}

const withStage = (state: GameState, save: Save, stage: StageRuntime | null, stageId: StageId | null, rng: Rng): GameState => ({
  save,
  runtime: { ...state.runtime, rngState: rng.state, stage, stageId, toast: null, stepAccMs: 0 },
});

/** 개발 포켓몬 — 그 레벨까지 배우는 기술 중 무작위 · HP 가득 */
function devMonster(uid: string, mon: DevMon, rng: Rng, caughtAt: string): Monster {
  return createMonster({ uid, dex: mon.dex, level: mon.level, moves: wildMoves(mon.dex, mon.level, rng), rng, caughtAt });
}

/** 상대 팀 — 개발 메뉴에서 고른 것 (없으면 null = 그 장면 원래 상대) */
function devFoes(state: GameState, rng: Rng, n: number): Monster[] | null {
  const foes = devOf(state.runtime).foes.slice(0, n);
  return foes.length ? foes.map((f, i) => devMonster(`foe${i}`, f, rng, 'dev')) : null;
}

/** 야생 한 마리 — 고른 상대 첫 마리, 없으면 그 숲에서 나오는 포켓몬 하나 (스테이지 레벨쯤) */
function devWild(state: GameState, id: StageId, rng: Rng): Monster {
  const pick = devOf(state.runtime).foes[0];
  if (pick) return devMonster('wild', pick, rng, id);
  const pool = forestPool(id).common;
  const dex = pool.length ? pool[rng.int(0, pool.length - 1)]! : 16;
  const level = { 'forest-1': 4, 'forest-2': 8, 'forest-3': 12 }[id];
  return devMonster('wild', { dex, level }, rng, id);
}

/** 진화할 수 있는 레벨 (레벨로 진화하는 것만) — 없으면 null */
function evolveAt(m: Monster): number | null {
  const levels = evolutionsOf(m.species)
    .map((e) => evolutionLevel(m, e))
    .filter((l): l is number => l !== null);
  return levels.length ? Math.min(...levels) : null;
}

function scene(state: GameState, sc: DevScene, rng: Rng): DevResult {
  const save0 = state.save;
  switch (sc) {
    case 'stage-1':
    case 'stage-2':
    case 'stage-3': {
      const id = STAGE_OF[sc];
      return { state: withStage(state, standOn(state, id, rng), { phase: 'walk' }, id, rng), say: `${id.replace('forest-', '1-')} 처음부터` };
    }
    case 'wild':
    case 'catch': {
      const id = hereOf(save0);
      const save1 = standOn(state, id, rng, 0.05);
      const wild = devWild(state, id, rng);
      const isNew = !save1.dex.seen.includes(wild.species);
      let save: Save = { ...save1, pendingEncounter: { kind: 'wild', monster: wild, start: 'normal' }, dex: isNew ? { ...save1.dex, seen: [...save1.dex.seen, wild.species] } : save1.dex };
      if (sc === 'wild') return { state: withStage(state, save, { phase: 'appear', ms: 0, isNew }, id, rng), say: `야생 ${nameOf(wild.species)} Lv ${wild.level}` };
      // 잡기 — 상대 HP 1 · 볼 10개씩 (볼을 고르면 바로 잡기)
      save = { ...save, bag: { ...save.bag, 'poke-ball': Math.max(10, save.bag['poke-ball'] ?? 0), 'great-ball': Math.max(10, save.bag['great-ball'] ?? 0), 'ultra-ball': Math.max(10, save.bag['ultra-ball'] ?? 0) } };
      const b = startBattle(save, wild, 'normal');
      return { state: withStage(state, save, { phase: 'battle', battle: { ...b, foe: { ...b.foe, hp: 1 } } }, id, rng), say: `잡기 — ${nameOf(wild.species)} HP 1 · 볼 10개씩` };
    }
    case 'evolve': {
      const uid = save0.party.find((u) => {
        const m = save0.monsters[u];
        return m && evolveAt(m) !== null;
      });
      const m = uid ? save0.monsters[uid] : undefined;
      if (!m) return { state, say: '레벨로 진화하는 포켓몬이 없어요 — 팀 탭에서 더하기' };
      const level = Math.max(m.level, evolveAt(m)!);
      const to = pickEvolution({ ...m, level }, level, rng);
      if (to === null) return { state, say: '진화할 모습을 못 찾았어요' };
      const grown: Monster = { ...m, level, exp: Math.max(m.exp, expForLevel(level)) };
      const save: Save = { ...save0, pendingEncounter: null, monsters: { ...save0.monsters, [m.uid]: grown }, pendingChoices: [{ kind: 'evolve', uid: m.uid, to, newMoves: evolutionMoves(grown, to), level, item: null }] };
      const id = save.location.screen === 'stage' ? save.location.stageId : null;
      return { state: withStage(state, save, null, id, rng), say: `${nameOf(m.species)} → ${nameOf(to)} 진화` };
    }
    case 'rival': {
      const id = hereOf(save0);
      const rival = pickRival(save0);
      if (!rival) return { state, say: '라이벌을 못 골랐어요' };
      const save: Save = { ...standOn(state, id, rng, 0.3), pendingEncounter: { kind: 'rival', rival, stageId: id } };
      return { state: withStage(state, save, { phase: 'rival', rival, ms: 0 }, id, rng), say: '라이벌' };
    }
    case 'trainer-team':
    case 'gym-team': {
      const alive = save0.party.filter((u) => (save0.monsters[u]?.hp ?? 0) > 0);
      if (alive.length < BALANCE.team.size) return { state, say: `3:3 은 살아 있는 ${BALANCE.team.size}마리 — 팀 탭 더하기 · 바꾸기 탭 모두 회복` };
      if (sc === 'gym-team') {
        const foes = devFoes(state, rng, BALANCE.team.size) ?? leaderTeam();
        const save: Save = { ...save0, location: { screen: 'gym' }, pendingEncounter: { kind: 'gym-leader' }, pendingChoices: [] };
        const team = startTeamBattle(save, foes, 'gym', GYM_LEADER.name, pickTeam(save, foes));
        return { state: withDev(withStage(state, save, { phase: 'team', team }, null, rng), (d) => ({ ...d, team: true })), say: '관장 3:3' };
      }
      const id = hereOf(save0);
      const save1 = standOn(state, id, rng, 0.2);
      const n = 0;
      const save: Save = { ...save1, pendingEncounter: { kind: 'trainer', trainerId: trainerId(id, n), stageId: id } };
      const foes = devFoes(state, rng, BALANCE.team.size) ?? trainerTeam(id, save.stages[id]!.seed, n, aliveCount(save), BALANCE.team.size);
      const team = startTeamBattle(save, foes, 'trainer', trainerInfo(id, n).name, pickTeam(save, foes));
      return { state: withDev(withStage(state, save, { phase: 'team', team }, id, rng), (d) => ({ ...d, team: true })), say: '트레이너 3:3' };
    }
    case 'gym-enter': {
      const save = standOn(state, 'forest-3', rng, 1);
      return { state: withStage(state, save, { phase: 'gym-enter', ms: 0 }, 'forest-3', rng), say: '체육관 들어가기' };
    }
    case 'lobby': {
      const save: Save = { ...save0, location: { screen: 'gym' }, pendingEncounter: null, pendingChoices: [] };
      return { state: withStage(state, save, { phase: 'lobby' }, null, rng), say: '체육관 대기실' };
    }
  }
}

/** 팀 포켓몬 바꾸기 — 칸이 비었으면 뒤에 더함 (팀 6마리까지) · 빠진 포켓몬은 지움 (개발 세이브라) */
function setMon(state: GameState, slot: number, mon: DevMon, rng: Rng): DevResult {
  const save = state.save;
  if (!speciesOf(mon.dex) || slot < 0 || slot >= BALANCE.partySize) return { state, say: '없는 포켓몬이에요' };
  const level = Math.max(1, Math.min(DEV_LEVEL_MAX, Math.round(mon.level)));
  const uid = `m${save.nextMonsterUid}`;
  const m = devMonster(uid, { dex: mon.dex, level }, rng, 'dev');
  const party = [...save.party];
  const old = party[slot];
  if (old) party[slot] = uid;
  else party.push(uid);
  const monsters = { ...save.monsters, [uid]: m };
  if (old && !save.box.includes(old)) delete monsters[old];
  const seen = save.dex.seen.includes(mon.dex) ? save.dex.seen : [...save.dex.seen, mon.dex];
  const caught = save.dex.caught.includes(mon.dex) ? save.dex.caught : [...save.dex.caught, mon.dex];
  const next: Save = { ...save, party, monsters, nextMonsterUid: save.nextMonsterUid + 1, dex: { seen, caught } };
  // 고른 필살기는 빠진 포켓몬 것만 지움
  const out = old ? withDev({ ...state, save: next }, (d) => ({ ...d, ults: Object.fromEntries(Object.entries(d.ults).filter(([u]) => u !== old)) })) : { ...state, save: next };
  return { state: { ...out, runtime: { ...out.runtime, rngState: rng.state } }, say: `${nameOf(mon.dex)} Lv ${level}` };
}

function setLevel(state: GameState, uid: string, level0: number): DevResult {
  const m = state.save.monsters[uid];
  const s = m ? speciesOf(m.species) : undefined;
  if (!m || !s) return { state, say: '없는 포켓몬이에요' };
  const level = Math.max(1, Math.min(DEV_LEVEL_MAX, Math.round(level0)));
  const hp = maxHp(s.base, m.ivs, m.points, level);
  const next: Monster = { ...m, level, exp: expForLevel(level), hp: m.hp > 0 ? hp : 0 };
  return { state: { ...state, save: { ...state.save, monsters: { ...state.save.monsters, [uid]: next } } }, say: `${nameOf(m.species)} Lv ${level}` };
}

/** 전투 중인 포켓몬 (1:1 · 3:3) 을 함께 바꿈 */
function inBattle(state: GameState, change: (b: { me: Fighter; foe: Fighter }) => void): GameState | null {
  const st = state.runtime.stage;
  if (st?.phase === 'battle') {
    const b = { me: { ...st.battle.me }, foe: { ...st.battle.foe } };
    change(b);
    return { ...state, runtime: { ...state.runtime, stage: { phase: 'battle', battle: { ...st.battle, me: b.me, foe: b.foe } } } };
  }
  if (st?.phase === 'team') {
    const me = st.team.me.map((f) => ({ ...f }));
    const foe = st.team.foe.map((f) => ({ ...f }));
    for (let i = 0; i < Math.max(me.length, foe.length); i++) {
      const b = { me: me[i] ?? me[0]!, foe: foe[i] ?? foe[0]! };
      change(b);
    }
    const t = st.team.t;
    const ultReadyAt = { me: me.map((f, i) => (f.ult >= 1 ? (st.team.ultReadyAt.me[i] ?? t) : null)), foe: foe.map((f, i) => (f.ult >= 1 ? (st.team.ultReadyAt.foe[i] ?? t) : null)) };
    return { ...state, runtime: { ...state.runtime, stage: { phase: 'team', team: { ...st.team, me, foe, ultReadyAt } } } };
  }
  return null;
}

const addItems = (save: Save, items: readonly ItemId[], n: number): Save => ({ ...save, bag: { ...save.bag, ...Object.fromEntries(items.map((id) => [id, (save.bag[id] ?? 0) + n])) } });

/** 개발 메뉴 한 번 누름 — 바뀐 상태 + 한 줄 알림 (안 바뀌면 state 그대로) */
export function devApply(state: GameState, action: DevAction): DevResult {
  const rng = new Rng(state.runtime.rngState);
  switch (action.kind) {
    case 'scene':
      return scene(state, action.scene, rng);
    case 'mon':
      return setMon(state, action.slot, { dex: action.dex, level: action.level }, rng);
    case 'mon-remove': {
      const save = state.save;
      const uid = save.party[action.slot];
      if (!uid || save.party.length <= 1) return { state, say: '팀에 한 마리는 있어야 해요' };
      const monsters = { ...save.monsters };
      if (!save.box.includes(uid)) delete monsters[uid];
      return { state: { ...state, save: { ...save, party: save.party.filter((u) => u !== uid), monsters } }, say: '팀에서 뺌' };
    }
    case 'level':
      return setLevel(state, action.uid, action.level);
    case 'ult':
      return {
        state: withDev(state, (d) => {
          const ults = { ...d.ults };
          if (action.name) ults[action.uid] = action.name;
          else delete ults[action.uid];
          return { ...d, ults };
        }),
        say: action.name ? `필살기 ${action.name}` : '필살기 돌아가며',
      };
    case 'foe':
    case 'foe-remove': {
      const foes = [...devOf(state.runtime).foes];
      if (action.kind === 'foe') {
        if (!speciesOf(action.dex) || action.slot < 0 || action.slot >= DEV_FOES_MAX) return { state, say: '없는 포켓몬이에요' };
        const mon = { dex: action.dex, level: Math.max(1, Math.min(DEV_LEVEL_MAX, Math.round(action.level))) };
        if (action.slot < foes.length) foes[action.slot] = mon;
        else foes.push(mon);
      } else foes.splice(action.slot, 1);
      return { state: withDev(state, (d) => ({ ...d, foes })), say: foes.length ? `상대 ${foes.map((f) => `${nameOf(f.dex)} Lv ${f.level}`).join(' · ')}` : '상대 = 장면 원래 상대' };
    }
    case 'gauge-full': {
      const next = inBattle(state, (b) => {
        b.me.ult = 1;
      });
      return next ? { state: next, say: '필살기 게이지 가득' } : { state, say: '전투 중에만 돼요' };
    }
    case 'heal': {
      const save = state.save;
      const monsters = { ...save.monsters };
      for (const uid of save.party) {
        const m = monsters[uid];
        const s = m ? speciesOf(m.species) : undefined;
        if (m && s) monsters[uid] = { ...m, hp: maxHp(s.base, m.ivs, m.points, m.level), status: null, moves: m.moves.map((mv) => ({ ...mv })) };
      }
      const healed = { ...state, save: { ...save, monsters } };
      const next = inBattle(healed, (b) => {
        b.me.hp = b.me.maxHp;
        b.me.status = null;
      });
      return { state: next ?? healed, say: '모두 회복' };
    }
    case 'hp1': {
      const next = inBattle(state, (b) => {
        const f = action.side === 'me' ? b.me : b.foe;
        if (f.hp > 0) f.hp = 1;
      });
      if (next) return { state: next, say: action.side === 'me' ? '내 HP 1' : '상대 HP 1' };
      if (action.side === 'foe') return { state, say: '전투 중에만 돼요' };
      const uid = state.save.party[0];
      const m = uid ? state.save.monsters[uid] : undefined;
      if (!m) return { state, say: '' };
      return { state: { ...state, save: { ...state.save, monsters: { ...state.save.monsters, [m.uid]: { ...m, hp: 1 } } } }, say: '선두 HP 1' };
    }
    case 'money':
      return { state: { ...state, save: { ...state.save, money: state.save.money + 10_000 } }, say: `돈 +10000 → ${state.save.money + 10_000}` };
    case 'balls':
      return { state: { ...state, save: addItems(state.save, ['poke-ball', 'great-ball', 'ultra-ball'], 10) }, say: '볼 +10씩' };
    case 'items':
      return { state: { ...state, save: addItems(state.save, ITEM_IDS.filter((id) => !id.endsWith('-ball')), 5) }, say: '아이템 +5씩' };
    case 'pre-evolve': {
      const uid = state.save.party[0];
      const m = uid ? state.save.monsters[uid] : undefined;
      const at = m ? evolveAt(m) : null;
      if (!m || at === null) return { state, say: '선두가 레벨로 진화하지 않아요' };
      const level = Math.max(1, at - 1);
      const r = setLevel(state, m.uid, level);
      const grown = r.state.save.monsters[m.uid]!;
      // 다음 레벨 바로 앞 경험치 — 한 번 이기면 레벨업 → 진화
      const near: Monster = { ...grown, exp: Math.max(expForLevel(level), expForLevel(level + 1) - 1) };
      return { state: { ...r.state, save: { ...r.state.save, monsters: { ...r.state.save.monsters, [m.uid]: near } } }, say: `${nameOf(m.species)} Lv ${level} — 한 번 이기면 진화` };
    }
    case 'team':
      return { state: withDev(state, (d) => ({ ...d, team: action.on })), say: action.on ? '3:3 켜짐 (개발 모드에서만)' : '3:3 꺼짐' };
    case 'walk': {
      const walk = cycle(DEV_WALKS, devOf(state.runtime).walk as (typeof DEV_WALKS)[number]);
      return { state: withDev(state, (d) => ({ ...d, walk })), say: `걷기 ×${walk}` };
    }
    case 'battle-speed': {
      const battle = cycle(DEV_BATTLES, devOf(state.runtime).battle as (typeof DEV_BATTLES)[number]);
      return { state: withDev(state, (d) => ({ ...d, battle })), say: `전투 ×${battle}` };
    }
    case 'pause': {
      const pause = !devOf(state.runtime).pause;
      return { state: withDev(state, (d) => ({ ...d, pause })), say: pause ? '멈춤' : '다시 감' };
    }
  }
}

/** 스테이지 id 목록 (화면 — 바로 가기 버튼) */
export const DEV_STAGES = STAGE_IDS;
