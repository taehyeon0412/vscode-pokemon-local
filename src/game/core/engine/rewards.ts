/**
 * 전투가 끝난 뒤 (mvp-spec S12 · S17 · S24 · 3.4 · 3.5 · 3.7 · 3.9) — 이기거나 잡으면: 경험치 · 레벨업 · 새 기술 · 진화 고르기 · 돈 · 아이템 · 잡은 포켓몬.
 * 계산 결과는 세이브에 바로 들어가고 (전투 끝 = 바로 저장), 사람이 골라야 하는 것 (S23 · S22) 은 save.pendingChoices 에 차례대로.
 * 스테이지 클리어 (S24) · 패배 (S17) 의 세이브 변화도 여기.
 */
import { BALANCE } from '../balance';
import { BAG_MAX, healTeam } from '../rules/bag';
import { addExp, evolve, expGain, learnMove, levelUpChoices } from '../rules/growth';
import { expForLevel } from '../rules/stats';
import { itemName } from '../rules/items';
import { stageLevelBand } from '../rules/stage';
import { GYM_LEADER } from '../rules/trainer';
import { rivalItem } from '../rules/rival';
import type { ItemId, Monster, PendingChoice, Save, StageId } from '../save';
import { withJosa } from '../text';
import { moveOf, speciesOf } from '../../data';
import type { BattleState } from './battle';
import type { Rng } from './rng';

/** 숲 배지 (U8 — 세계 지도 · 타이틀에 보임) */
export const FOREST_BADGE = 'forest';

/** S12 에 보여 줄 것 (보여 주기만 — 세이브에는 이미 들어감) */
export interface BattleSummary {
  title: string;
  exp: { uid: string; name: string; gain: number; from: number; to: number }[];
  money: number;
  item: string | null;
  /** 받은 팔 물건 (이름 — 2026-10-21 ideas #125, 없으면 null · 옛 상태엔 칸이 없음) */
  treasure?: string | null;
  /** 잡은 포켓몬 — uid · isNew = 도감 (잡음) 에 처음 (S12 소개 카드 "NEW! 처음 잡았다", 2026-10-20 태현 님 안 2 — 도감 화면이 생기면 "도감 등록") */
  caught: { name: string; toBox: boolean; uid: string; isNew: boolean } | null;
  /** 빈칸이라 바로 배운 기술 */
  learned: { name: string; move: string }[];
  /** 이어서 고를 것 (S23 · S22) 수 */
  choices: number;
  /** 관장을 처음 이겨 받은 배지 ("숲 배지") */
  badge: string | null;
  /** 라이벌 한마디 (gdd 4.12) */
  quote?: string;
  /** 라이벌에게 이김 — 돈 · 아이템을 "트레이너보다 좋게" 표시 (돈 ×1.5 · 희귀 아이템) */
  rival?: boolean;
}

const nameOf = (dex: number) => speciesOf(dex)?.name.ko ?? '???';

/** 고를 것 더하기 — 선두가 아닌 포켓몬의 새 기술 (S23) 은 바로 멈추지 않고 laterChoices 에 쌓음 (병원 · 클리어 때 한 번에 — 2026-10-21 ideas #72). 진화 (S22) 는 바로 */
export function addChoices(save: Save, choices: readonly PendingChoice[]): Save {
  const lead = save.party[0];
  const later = choices.filter((c) => c.kind === 'learn' && c.uid !== lead);
  const now = choices.filter((c) => !later.includes(c));
  const next: Save = { ...save, pendingChoices: [...save.pendingChoices, ...now] };
  return later.length > 0 ? { ...next, laterChoices: [...(save.laterChoices ?? []), ...later].slice(-BALANCE.laterChoicesMax) } : next;
}

/** 쌓아 둔 새 기술 고르기를 지금 고르기로 — 병원 · 클리어 때 (없는 포켓몬 · 이미 아는 기술은 뺌). 칸은 지움 */
export function takeLaterChoices(save: Save): Save {
  if (save.laterChoices === undefined) return save;
  const { laterChoices, ...rest } = save;
  const ok = laterChoices.filter((c) => {
    const m = save.monsters[c.uid];
    return c.kind === 'learn' && !!m && !m.moves.some((x) => x.moveId === c.moveId);
  });
  return { ...rest, pendingChoices: [...save.pendingChoices, ...ok] };
}
const addDex = (list: number[], dex: number) => (list.includes(dex) ? list : [...list, dex].sort((a, b) => a - b));

/** 팀 전원에게 경험치 (스테이지 · 관장 보너스) — 레벨업 · 새 기술 · 진화 고르기까지. 받은 레벨 변화 */
function giveTeamExp(save: Save, gain: number, rng: Rng): { save: Save; exp: BattleSummary['exp']; learned: BattleSummary['learned'] } {
  const monsters = { ...save.monsters };
  const choices: PendingChoice[] = [];
  const exp: BattleSummary['exp'] = [];
  const learned: BattleSummary['learned'] = [];
  for (const uid of save.party) {
    const m = monsters[uid];
    if (!m) continue;
    const grown = addExp(m, gain, rng);
    const r = levelUpChoices(grown, m.level, grown.level, rng);
    monsters[uid] = r.monster;
    exp.push({ uid, name: nameOf(m.species), gain, from: m.level, to: grown.level });
    for (const id of r.learned) learned.push({ name: nameOf(m.species), move: moveOf(id)?.name.ko ?? '?' });
    choices.push(...r.choices);
  }
  return { save: addChoices({ ...save, monsters }, choices), exp, learned };
}

/**
 * 전투 끝 (이김 · 잡음) — applyBattleResult (HP · PP · 쓴 아이템) 다음에. wild = 조우 때 정한 상대 (잡으면 개체값 · 기술을 그대로).
 * where = 잡은 곳 (스테이지 id · 'gym')
 */
export function battleRewards(save0: Save, b: BattleState, wild: Monster | null, where: StageId | 'gym', rng: Rng): { save: Save; summary: BattleSummary } {
  let save: Save = { ...save0, monsters: { ...save0.monsters }, bag: { ...save0.bag } };
  const summary: BattleSummary = { title: '', exp: [], money: 0, item: null, caught: null, learned: [], choices: 0, badge: null };
  const choices: PendingChoice[] = [];
  const trainer = b.kind !== 'wild';
  // 경험치를 주는 상대 — 쓰러뜨린 상대 (토너먼트면 여럿), 쓰러뜨리지 않고 잡았으면 그 포켓몬
  const foes = b.foeDown.length > 0 ? b.foeDown : [{ species: b.foe.species, level: b.foe.level }];

  // 잡은 포켓몬 — 조우 때 정한 개체값 · 기술에 지금 HP · PP · 상태 (mvp-spec 3.4) · 팀이 다 찼으면 보관함
  if (b.result === 'catch' && wild) {
    const uid = `m${save.nextMonsterUid}`;
    const caught: Monster = {
      ...wild,
      uid,
      hp: Math.max(0, Math.min(b.foe.hp, b.foe.maxHp)),
      status: b.foe.status ? { ...b.foe.status } : null,
      moves: b.foe.moves.map((s) => ({ ...s })),
      caughtAt: where,
    };
    const toBox = save.party.length >= BALANCE.partySize;
    const isNew = !save.dex.caught.includes(caught.species);
    save = {
      ...save,
      monsters: { ...save.monsters, [uid]: caught },
      party: toBox ? save.party : [...save.party, uid],
      box: toBox ? [...save.box, uid] : save.box,
      nextMonsterUid: save.nextMonsterUid + 1,
      dex: { seen: addDex(save.dex.seen, caught.species), caught: addDex(save.dex.caught, caught.species) },
    };
    summary.caught = { name: nameOf(caught.species), toBox, uid, isNew };
  }

  // 경험치 — 싸운 포켓몬은 다, 팀 나머지는 절반, 쓰러진 포켓몬은 없음 (방금 잡은 포켓몬도 없음) · 트레이너 · 관장 × 1.5
  for (const uid of save0.party) {
    const m = save.monsters[uid];
    if (!m || m.hp <= 0) continue;
    // 경험 부적 판이면 ×1.5 (ideas #70)
    const gain = Math.round(foes.reduce((sum, foe) => sum + expGain(foe, m.level, { share: !b.fought.includes(uid), trainer }), 0) * runExpScale(save0));
    const grown = addExp(m, gain, rng);
    const r = levelUpChoices(grown, m.level, grown.level, rng);
    save.monsters[uid] = r.monster;
    summary.exp.push({ uid, name: nameOf(m.species), gain, from: m.level, to: grown.level });
    for (const id of r.learned) summary.learned.push({ name: nameOf(m.species), move: moveOf(id)?.name.ko ?? '?' });
    choices.push(...r.choices);
  }
  save = addChoices(save, choices);

  if (b.kind === 'wild') {
    // 돈 — 이기거나 잡았을 때 (잡아도 쓰러뜨린 판에서 손해 보지 않게 — 2026-10-18 태현 님) · 아이템 — 이겼을 때만 (잡았을 때는 없음, gdd 4.3)
    if (rng.chance(BALANCE.wildMoneyChance)) summary.money += b.foe.level * BALANCE.wildMoneyPerLevel;
    if (rng.chance(BALANCE.jackpotChance)) summary.money += BALANCE.jackpotMoney;
    if (b.result === 'win' && rng.chance(BALANCE.wildItemChance)) {
      const item: ItemId = rng.chance(0.5) ? 'poke-ball' : 'potion';
      save.bag[item] = (save.bag[item] ?? 0) + 1;
      summary.item = itemName(item);
    }
    // 팔 물건 — 잡았을 때 10% (ideas #125)
    if (b.result === 'catch' && rng.chance(BALANCE.treasureChance.catch)) save = giveTreasure(save, summary, pickTreasure(rng));
    const foeName = `야생 ${nameOf(b.foe.species)}`;
    summary.title = b.result === 'catch' ? `${withJosa(foeName, '을/를')} 잡았다!` : `${withJosa(foeName, '을/를')} 쓰러뜨렸다!`;
  } else if (b.kind === 'trainer') {
    // 트레이너: 쓰러뜨린 마리마다 상대 레벨 × 20원 (돈만, gdd 4.3)
    summary.money = foes.reduce((sum, f) => sum + f.level * BALANCE.trainerMoneyPerLevel, 0);
    // 팔 물건 — 15% (ideas #125, 라이벌은 rivalWinRewards 에서 첫 승에 금구슬)
    if (rng.chance(BALANCE.treasureChance.trainer)) save = giveTreasure(save, summary, pickTreasure(rng));
    summary.title = `${withJosa(b.foeName ?? '트레이너', '과/와')}의 승부에서 이겼다!`;
  } else {
    // 관장: 처음 = 배지 + 3000원 + 리프의 돌 + 보너스 경험치 (스테이지의 2배) · 다시 = 300원 (3.9)
    const first = !save.badges.includes(FOREST_BADGE);
    summary.money = first ? BALANCE.gymFirstMoney : BALANCE.gymRematchMoney;
    summary.title = `${withJosa(GYM_LEADER.name, '을/를')} 이겼다!`;
    if (first) {
      save = { ...save, badges: [...save.badges, FOREST_BADGE], bag: { ...save.bag, 'leaf-stone': (save.bag['leaf-stone'] ?? 0) + 1 } };
      summary.badge = '숲 배지';
      summary.item = itemName('leaf-stone');
      // 관장 첫 승 = 큰금구슬 (ideas #125)
      save = giveTreasure(save, summary, 'big-nugget');
      const bonus = giveTeamExp(save, stageLevelBand('forest-3')[1] * BALANCE.clearExpPerLevel * BALANCE.gymClearExpScale, rng);
      save = bonus.save;
      // 보너스까지 합친 레벨 변화 (같은 포켓몬이면 한 줄로)
      for (const e of bonus.exp) {
        const row = summary.exp.find((x) => x.uid === e.uid);
        if (row) {
          row.gain += e.gain;
          row.to = e.to;
        } else summary.exp.push(e);
      }
      summary.learned.push(...bonus.learned);
    }
  }
  save = { ...save, money: Math.min(999_999_999, save.money + summary.money) };
  summary.choices = save.pendingChoices.length;
  return { save, summary };
}

/** 라이벌에게 이김 (gdd 4.12) — battleRewards (트레이너 돈) 다음에: 돈을 rivalMoneyScale 배로 + 아이템 1개 (처음 이기면 진화의 돌) */
export function rivalWinRewards(save: Save, summary: BattleSummary, rival: string, rng: Rng): { save: Save; summary: BattleSummary } {
  const extra = Math.round(summary.money * (BALANCE.rivalMoneyScale - 1));
  const item = rivalItem(save, rival, rng);
  const next: Save = { ...save, money: Math.min(999_999_999, save.money + extra), bag: { ...save.bag, [item]: Math.min(BAG_MAX, (save.bag[item] ?? 0) + 1) } };
  const out: BattleSummary = { ...summary, money: summary.money + extra, item: itemName(item) };
  // 이 라이벌에게 처음 이김 (전적은 이 다음에 셈) = 금구슬 (ideas #125)
  const first = (save.rivals?.[rival]?.wins ?? 0) === 0;
  return { save: first ? giveTreasure(next, out, 'nugget') : next, summary: out };
}

/** S23 — 맨 앞 고르기가 새 기술이면: replace 번째 칸과 바꿈 (null = 배우지 않기) */
export function resolveLearn(save: Save, replace: number | null): Save {
  const [c, ...rest] = save.pendingChoices;
  if (c?.kind !== 'learn') return save;
  const m = save.monsters[c.uid];
  if (!m) return { ...save, pendingChoices: rest };
  return { ...save, monsters: { ...save.monsters, [c.uid]: learnMove(m, c.moveId, replace) }, pendingChoices: rest };
}

/**
 * S22 — 맨 앞 고르기가 진화면: keep = 남길 지금 기술 (null = 진화 멈추기, 다음 레벨업 때 다시 · 돌이면 돌려줌).
 * 진화한 (또는 멈춘) 모습으로 그 뒤 오른 레벨의 새 기술 · 다음 진화를 다시 셈
 */
export function resolveEvolve(save: Save, keep: readonly number[] | null, rng: Rng): Save {
  const [c, ...rest] = save.pendingChoices;
  if (c?.kind !== 'evolve') return save;
  const m = save.monsters[c.uid];
  if (!m) return { ...save, pendingChoices: rest };
  let next = m;
  let dex = save.dex;
  let bag = save.bag;
  if (keep) {
    next = evolve(m, c.to, c.newMoves, keep);
    dex = { seen: addDex(dex.seen, c.to), caught: addDex(dex.caught, c.to) };
  } else if (c.item) {
    bag = { ...bag, [c.item]: (bag[c.item] ?? 0) + 1 };
  }
  // 그 뒤 오른 레벨의 새 기술 — 진화를 멈췄으면 이번 결과 안에서는 다시 묻지 않음 (다음 레벨업 때 다시)
  const after = next.level > c.level ? levelUpChoices(next, c.level, next.level, rng, { noEvolve: !keep }) : { monster: next, learned: [], choices: [] };
  return { ...save, dex, bag, monsters: { ...save.monsters, [c.uid]: after.monster }, pendingChoices: [...after.choices, ...rest] };
}

/** S24 에 보여 줄 보너스 경험치 (팀 전원) — 그 스테이지 레벨대 위끝 × 10 */
/** 경험 부적 판이면 경험치 ×1.5 — id 가 없으면 지금 있는 스테이지 (체육관 · 타이틀 = 1, 2026-10-21 ideas #70) */
export function runExpScale(save: Save, id?: StageId): number {
  const at = id ?? (save.location.screen === 'stage' ? save.location.stageId : null);
  return at && save.stages[at]?.run.boost ? BALANCE.expCharmScale : 1;
}

/** 팔 물건 하나 — 흔함 50% · 보통 35% · 드묾 15% (큰금구슬은 관장 첫 승에서만, 2026-10-21 ideas #125) */
export function pickTreasure(rng: Rng): ItemId {
  const r = rng.next();
  let acc = 0;
  for (const [p, items] of BALANCE.treasureTiers) {
    acc += p;
    if (r < acc) return items[rng.int(0, items.length - 1)]!;
  }
  const last = BALANCE.treasureTiers[BALANCE.treasureTiers.length - 1]![1];
  return last[rng.int(0, last.length - 1)]!;
}

/** 가방에 하나 (상한 BAG_MAX) */
export function addItem(save: Save, item: ItemId, n = 1): Save {
  return { ...save, bag: { ...save.bag, [item]: Math.min(BAG_MAX, (save.bag[item] ?? 0) + n) } };
}

/** 팔 물건을 가방에 · 결과 상자 (summary.treasure) 에 */
function giveTreasure(save: Save, summary: BattleSummary, item: ItemId): Save {
  summary.treasure = itemName(item);
  return addItem(save, item);
}

/** 이상한사탕 — 그 포켓몬 1레벨 (새 기술 · 진화 고르기도 레벨업처럼, 선두가 아니면 기술 고르기는 쌓아 둠). 못 쓰면 null (2026-10-21 ideas #70) */
export function useRareCandy(save: Save, uid: string, rng: Rng): Save | null {
  const m = save.monsters[uid];
  const have = save.bag['rare-candy'] ?? 0;
  if (!m || have <= 0 || !save.party.includes(uid) || m.level >= BALANCE.maxLevel) return null;
  const grown = addExp(m, expForLevel(m.level + 1) - m.exp, rng);
  const r = levelUpChoices(grown, m.level, grown.level, rng);
  return addChoices({ ...save, bag: { ...save.bag, 'rare-candy': have - 1 }, monsters: { ...save.monsters, [uid]: r.monster } }, r.choices);
}

export function clearBonusExp(id: StageId): number {
  return stageLevelBand(id)[1] * BALANCE.clearExpPerLevel;
}

/**
 * 스테이지 끝 (S24 · 1-3 은 S16 으로) — 볼 +1 (이미 깬 스테이지를 다시 깨도) · 팀 전원 보너스 경험치 · 깬 표시 · 진행 100%.
 * 레벨이 오른 포켓몬 (S24 에 한 줄 · 고를 것은 pendingChoices)
 */
export function clearStage(save0: Save, id: StageId, rng: Rng): { save: Save; levelUps: string[] } {
  const prog = save0.stages[id];
  if (!prog) return { save: save0, levelUps: [] };
  let save: Save = {
    ...save0,
    bag: { ...save0.bag, 'poke-ball': Math.min(999, (save0.bag['poke-ball'] ?? 0) + BALANCE.clearBalls) },
    stages: { ...save0.stages, [id]: { ...prog, progress: 1, cleared: true } },
  };
  const r = giveTeamExp(save, Math.round(clearBonusExp(id) * runExpScale(save0, id)), rng);
  save = r.save;
  return { save, levelUps: r.exp.filter((e) => e.to > e.from).map((e) => `${e.name} Lv ${e.to}!`) };
}

/** S17 — 지면: 돈 −10% (관장전은 안 잃음) · 팀 회복. 잡은 포켓몬 · 경험치는 그대로 (gdd 4.10) */
export function defeatPenalty(save: Save, gym: boolean): { save: Save; lost: number } {
  const lost = gym ? 0 : Math.floor(save.money * BALANCE.defeatMoneyLoss);
  return { save: { ...healTeam(save), money: save.money - lost, pendingEncounter: null }, lost };
}
