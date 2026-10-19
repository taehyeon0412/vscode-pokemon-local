/**
 * 길 위의 부탁 (gdd 4.6 · mvp-spec 3.2, 2026-10-18 태현 님 아이디어).
 * 사람이 ❓ 를 띄우고 서 있음 → [도와준다] → 맞는 타입 기술이 있는 팀 포켓몬이 해결 (85%) · 없으면 아무나 (30%) → 성공하면 보상.
 * 기술은 이름이 아니라 타입으로 맞춤 (이름으로 정하면 대부분 못 풂). 부탁 · 이벤트 종류 늘리기는 MVP 이후 (ideas #12).
 */
import { BALANCE } from '../balance';
import type { Rng } from '../engine/rng';
import type { ItemId, Save } from '../save';
import { moveOf, speciesOf, type TypeName } from '../../data';
import { withJosa } from '../text';
import { itemName } from './items';
import { spotRng } from './stage';

export interface RequestReward {
  items?: Partial<Record<ItemId, number>>;
  money?: number;
  /** 가끔 더 주는 것 */
  bonus?: { item: ItemId; chance: number };
}

export interface RequestTemplate {
  id: string;
  /** 부탁하는 사람 (이모지 · 이름 · 사람 그림 data/people.ts — 트레이너와 안 겹치게) */
  who: { icon: string; name: string; look?: string };
  /** 부탁 한 줄 */
  text: string;
  /** 이 타입 기술이 있으면 잘 해결함 */
  types: readonly TypeName[];
  /** 성공 문구 — {name} 포켓몬 이름 · {move} 기술 이름 (맞는 기술이 없으면 "{name}이(가) 힘껏 도왔다") */
  done: string;
  reward: RequestReward;
}

/** 숲 부탁 5종 (gdd 4.6 표) — 문구 · 보상 [임시값] */
export const FOREST_REQUESTS: readonly RequestTemplate[] = [
  {
    id: 'hat-in-tree',
    who: { icon: '👴', name: '할아버지', look: 'frlg-old-man-1' },
    text: '모자가 나무에 걸렸어… 꺼내 줄 수 있겠니?',
    types: ['grass', 'flying', 'bug'],
    done: '{move}! 모자를 꺼냈다!',
    reward: { items: { potion: 2 } },
  },
  {
    id: 'lost-caterpie',
    who: { icon: '👦', name: '꼬마', look: 'frlg-little-boy' },
    text: '내 캐터피가 없어졌어! 같이 찾아 줘!',
    types: ['bug', 'psychic', 'normal'],
    done: '{move}! 수풀 속 캐터피를 찾았다!',
    reward: { items: { 'poke-ball': 2 } },
  },
  {
    id: 'fallen-tree',
    who: { icon: '👷', name: '아저씨', look: 'frlg-worker-m' },
    text: '쓰러진 나무가 길을 막았어. 치울 힘이 없구나…',
    types: ['fighting', 'rock', 'ground', 'steel'],
    done: '{move}! 나무를 밀어냈다!',
    reward: { money: 500 },
  },
  {
    id: 'campfire',
    who: { icon: '🧑‍🌾', name: '캠퍼', look: 'frlg-camper' },
    text: '모닥불이 번진다! 어서 꺼 줘!',
    types: ['water', 'ice', 'ground'],
    done: '{move}! 불을 껐다!',
    reward: { items: { 'super-potion': 1 } },
  },
  {
    id: 'withered-flowers',
    who: { icon: '👩', name: '꽃집 누나', look: 'em-woman-2' },
    text: '꽃밭이 시들었어… 살릴 방법이 없을까?',
    types: ['grass', 'water', 'fairy'],
    done: '{move}! 꽃이 다시 피었다!',
    reward: { items: { potion: 1 }, bonus: { item: 'leaf-stone', chance: 0.3 } },
  },
];

/**
 * 스테이지에서 n 번째 부탁 (0 부터) — 한 스테이지 안에서는 같은 부탁이 겹치지 않게 시드로 정한 곳부터 차례로.
 * 지역이 늘면 지역마다 다른 부탁 목록 (MVP 이후)
 */
export function requestAt(stageSeed: number, requestNumber: number): RequestTemplate {
  const start = spotRng(stageSeed, 0, 5).int(0, FOREST_REQUESTS.length - 1);
  return FOREST_REQUESTS[(start + requestNumber) % FOREST_REQUESTS.length]!;
}

export interface Helper {
  uid: string;
  name: string;
  /** 맞는 타입 기술 (없으면 null) */
  moveId: number | null;
  moveName: string | null;
  chance: number;
}

/** 도울 포켓몬 — 팀 순서대로 맞는 타입 기술이 있는 첫 포켓몬, 없으면 쓰러지지 않은 첫 포켓몬 (MVP 는 바꿀 수 없음 [제안]) */
export function bestHelper(save: Save, template: RequestTemplate): Helper | null {
  const alive = save.party.map((uid) => save.monsters[uid]).filter((m): m is NonNullable<typeof m> => !!m && m.hp > 0);
  for (const m of alive) {
    for (const slot of m.moves) {
      const move = moveOf(slot.moveId);
      if (move && template.types.includes(move.type)) {
        return { uid: m.uid, name: speciesOf(m.species)?.name.ko ?? m.form, moveId: move.id, moveName: move.name.ko, chance: BALANCE.requestChanceMatch };
      }
    }
  }
  const first = alive[0];
  if (!first) return null;
  return { uid: first.uid, name: speciesOf(first.species)?.name.ko ?? first.form, moveId: null, moveName: null, chance: BALANCE.requestChanceOther };
}

export interface RequestOutcome {
  ok: boolean;
  /** 결과 한 줄 ("이상해씨의 덩굴채찍! 모자를 꺼냈다!") */
  text: string;
  /** 받은 것 ("상처약 2개") — 실패 · 지나감이면 null */
  reward: string | null;
  save: Save;
}

export { itemName };

/** 보상을 세이브에 더함 — 받은 것 글 ("상처약 2개") 도 같이 */
export function giveReward(save: Save, reward: RequestReward, rng: Rng): { save: Save; got: string[] } {
  const bag = { ...save.bag };
  const got: string[] = [];
  for (const [id, n] of Object.entries(reward.items ?? {}) as [ItemId, number][]) {
    bag[id] = (bag[id] ?? 0) + n;
    got.push(`${itemName(id)} ${n}개`);
  }
  let money = save.money;
  if (reward.money) {
    money += reward.money;
    got.push(`${reward.money.toLocaleString('en-US')}원`);
  }
  if (reward.bonus && rng.chance(reward.bonus.chance)) {
    bag[reward.bonus.item] = (bag[reward.bonus.item] ?? 0) + 1;
    got.push(itemName(reward.bonus.item));
  }
  return { save: { ...save, bag, money }, got };
}

/** [도와준다] — 성공하면 보상, 실패하면 없음 */
export function resolveRequest(save: Save, template: RequestTemplate, rng: Rng): RequestOutcome {
  const helper = bestHelper(save, template);
  if (!helper) return { ok: false, text: '도와줄 수 있는 포켓몬이 없어요…', reward: null, save };
  const ok = rng.chance(helper.chance);
  const who = helper.moveName ? `${helper.name}의 ${helper.moveName}` : `${withJosa(helper.name, '이/가')} 힘껏 도왔다`;
  if (!ok) return { ok: false, text: `${who}… 잘 안 됐다. "그래도 고마워"`, reward: null, save };
  const { save: next, got } = giveReward(save, template.reward, rng);
  return { ok: true, text: template.done.replace('{move}', who), reward: got.join(' · '), save: next };
}
