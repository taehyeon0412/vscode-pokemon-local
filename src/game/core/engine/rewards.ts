/**
 * 전투가 끝난 뒤 (mvp-spec S12 · 3.4 · 3.5 · 3.7) — 이기거나 잡으면: 경험치 · 레벨업 · 새 기술 · 진화 고르기 · 돈 · 아이템 · 잡은 포켓몬.
 * 계산 결과는 세이브에 바로 들어가고 (전투 끝 = 바로 저장), 사람이 골라야 하는 것 (S23 · S22) 은 save.pendingChoices 에 차례대로.
 */
import { BALANCE } from '../balance';
import { addExp, evolve, expGain, learnMove, levelUpChoices } from '../rules/growth';
import { itemName } from '../rules/items';
import type { ItemId, Monster, PendingChoice, Save, StageId } from '../save';
import { withJosa } from '../text';
import { moveOf, speciesOf } from '../../data';
import type { BattleState } from './battle';
import type { Rng } from './rng';

/** S12 에 보여 줄 것 (보여 주기만 — 세이브에는 이미 들어감) */
export interface BattleSummary {
  title: string;
  exp: { uid: string; name: string; gain: number; from: number; to: number }[];
  money: number;
  item: string | null;
  caught: { name: string; toBox: boolean } | null;
  /** 빈칸이라 바로 배운 기술 */
  learned: { name: string; move: string }[];
  /** 이어서 고를 것 (S23 · S22) 수 */
  choices: number;
}

const nameOf = (dex: number) => speciesOf(dex)?.name.ko ?? '???';
const addDex = (list: number[], dex: number) => (list.includes(dex) ? list : [...list, dex].sort((a, b) => a - b));

/** 전투 끝 (이김 · 잡음) — applyBattleResult (HP · PP · 쓴 아이템) 다음에. wild = 조우 때 정한 상대 (잡으면 개체값 · 기술을 그대로) */
export function battleRewards(save0: Save, b: BattleState, wild: Monster | null, stageId: StageId, rng: Rng): { save: Save; summary: BattleSummary } {
  let save: Save = { ...save0, monsters: { ...save0.monsters }, bag: { ...save0.bag } };
  const foe = { species: b.foe.species, level: b.foe.level };
  const summary: BattleSummary = { title: '', exp: [], money: 0, item: null, caught: null, learned: [], choices: 0 };
  const choices: PendingChoice[] = [];

  // 잡은 포켓몬 — 조우 때 정한 개체값 · 기술에 지금 HP · PP · 상태 (mvp-spec 3.4) · 팀이 다 찼으면 보관함
  if (b.result === 'catch' && wild) {
    const uid = `m${save.nextMonsterUid}`;
    const caught: Monster = {
      ...wild,
      uid,
      hp: Math.max(0, Math.min(b.foe.hp, b.foe.maxHp)),
      status: b.foe.status ? { ...b.foe.status } : null,
      moves: b.foe.moves.map((s) => ({ ...s })),
      caughtAt: stageId,
    };
    const toBox = save.party.length >= BALANCE.partySize;
    save = {
      ...save,
      monsters: { ...save.monsters, [uid]: caught },
      party: toBox ? save.party : [...save.party, uid],
      box: toBox ? [...save.box, uid] : save.box,
      nextMonsterUid: save.nextMonsterUid + 1,
      dex: { seen: addDex(save.dex.seen, caught.species), caught: addDex(save.dex.caught, caught.species) },
    };
    summary.caught = { name: nameOf(caught.species), toBox };
  }

  // 경험치 — 싸운 포켓몬은 다, 팀 나머지는 절반, 쓰러진 포켓몬은 없음 (방금 잡은 포켓몬도 없음)
  for (const uid of save0.party) {
    const m = save.monsters[uid];
    if (!m || m.hp <= 0) continue;
    const gain = expGain(foe, m.level, { share: !b.fought.includes(uid) });
    const grown = addExp(m, gain, rng);
    const r = levelUpChoices(grown, m.level, grown.level, rng);
    save.monsters[uid] = r.monster;
    summary.exp.push({ uid, name: nameOf(m.species), gain, from: m.level, to: grown.level });
    for (const id of r.learned) summary.learned.push({ name: nameOf(m.species), move: moveOf(id)?.name.ko ?? '?' });
    choices.push(...r.choices);
  }

  // 돈 — 이기거나 잡았을 때 (잡아도 쓰러뜨린 판에서 손해 보지 않게 [제안]) · 아이템 — 이겼을 때만 (잡았을 때는 없음, gdd 4.3)
  {
    if (rng.chance(BALANCE.wildMoneyChance)) summary.money += foe.level * BALANCE.wildMoneyPerLevel;
    if (rng.chance(BALANCE.jackpotChance)) summary.money += BALANCE.jackpotMoney;
    if (b.result === 'win' && rng.chance(BALANCE.wildItemChance)) {
      const item: ItemId = rng.chance(0.5) ? 'poke-ball' : 'potion';
      save.bag[item] = (save.bag[item] ?? 0) + 1;
      summary.item = itemName(item);
    }
    save = { ...save, money: Math.min(999_999_999, save.money + summary.money) };
  }

  const foeName = `야생 ${nameOf(b.foe.species)}`;
  summary.title = b.result === 'catch' ? `${withJosa(foeName, '을/를')} 잡았다!` : `${withJosa(foeName, '을/를')} 쓰러뜨렸다!`;
  save = { ...save, pendingChoices: [...save.pendingChoices, ...choices] };
  summary.choices = save.pendingChoices.length;
  return { save, summary };
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
