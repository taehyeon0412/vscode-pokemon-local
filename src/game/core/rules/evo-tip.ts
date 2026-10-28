/**
 * 진화 아이템 처음 안내 (#125 — 2026-10-28 태현 님 "천둥의돌 같은 아이템을 얻으면 화면에 듀토리얼처럼 팁이 나왔으면 좋겠어 이걸로 특정 포켓몬을 진화시킬수 있다 이런식?")
 * 진화의 돌 (종류마다) · 연결의끈을 처음 가졌을 때 한 번 — 무엇 · 어떻게 ([B] 가방에서) · 누가 (내 팀 · 보관함에서 쓸 수 있는 포켓몬, 없으면 진화하는 포켓몬 예 — 잡은 적 있는 종 먼저).
 * 신호 = "가방에 있는데 안내를 본 기록이 없음" (save.tips 의 evo-<아이템>) — 얻는 곳 (줍기 · 부탁 · 관장 · 라이벌 · 그 밖) 이 따로 알리지 않아도 되고, 밖에서 얻어도 돌아와서 뜸.
 * 본 기록은 화면 (FirstTip — 보는 동안만 셈) 이 tip-seen 으로. 두 번째부터는 얻은 말 뒤에 쓸 포켓몬 한 줄만 (evoGotNote).
 */
import { allSpecies, evolutionsOf, formsOfSpecies, speciesOf } from '../../data';
import { TIPS_MAX, type ItemId, type Monster, type Save } from '../save';
import { withJosa } from '../text';
import { itemEvolution, STONES } from './bag';
import { itemName } from './items';

export const EVO_ITEMS: readonly ItemId[] = [...STONES, 'linking-cord'];
export const isEvoItem = (item: ItemId): boolean => EVO_ITEMS.includes(item);
/** 본 기록 id (save.tips) */
export const evoTipId = (item: ItemId): string => `evo-${item}`;

const nameOf = (dex: number) => speciesOf(dex)?.name.ko ?? '???';

export interface EvoUser {
  uid: string;
  name: string;
  toName: string;
  where: 'team' | 'box';
}

/** 그 아이템을 지금 쓸 수 있는 내 포켓몬 — 팀 먼저, 그다음 보관함 */
export function evoItemUsers(save: Save, item: ItemId): EvoUser[] {
  const out: EvoUser[] = [];
  const add = (uid: string, where: EvoUser['where']) => {
    const m: Monster | undefined = save.monsters[uid];
    const to = m ? itemEvolution(m, item) : null;
    if (m && to !== null) out.push({ uid, name: nameOf(m.species), toName: nameOf(to), where });
  };
  save.party.forEach((u) => add(u, 'team'));
  save.box.forEach((u) => add(u, 'box'));
  return out;
}

/** 아이템마다 그것으로 진화하는 종 (from → to) — 한 번만 셈 (화면이 그릴 때마다 전체 종을 돌지 않게 — 코드 리뷰어) */
const evolversCache = new Map<ItemId, { dex: number; to: number }[]>();
function evolversOf(item: ItemId): { dex: number; to: number }[] {
  let list = evolversCache.get(item);
  if (!list) {
    list = [];
    for (const dex of allSpecies()) {
      const e = evolutionsOf(dex).find((x) => (item === 'linking-cord' ? x.kind === 'trade' : x.kind === 'item' && x.item === item) && formsOfSpecies(x.to).length > 0);
      if (e && formsOfSpecies(dex).length > 0) list.push({ dex, to: e.to });
    }
    evolversCache.set(item, list);
  }
  return list;
}

/** 그 아이템으로 진화하는 포켓몬 예 — 잡은 적 있는 종 · 본 종 먼저, 그다음 도감 순 (그림이 있는 진화만) */
export function evoItemExamples(save: Save, item: ItemId, n = 3): { name: string; toName: string }[] {
  const caught = new Set(save.dex.caught);
  const seen = new Set(save.dex.seen);
  const rows = evolversOf(item).map((r) => ({ ...r, rank: caught.has(r.dex) ? 0 : seen.has(r.dex) ? 1 : 2 }));
  return rows
    .sort((a, b) => a.rank - b.rank || a.dex - b.dex)
    .slice(0, n)
    .map((r) => ({ name: nameOf(r.dex), toName: nameOf(r.to) }));
}

/**
 * 쓸 포켓몬 한 줄 — "피카츄 → 라이츄 진화 가능" (둘 넘으면 " 외 N") · 보관함에만 있으면 " · 팀에 넣고" (가방은 팀에만 쓰여서 — 코드 리뷰어).
 * 처음 안내 · 결과 상자 (디자인) 와 같은 말 · 짧게 (240 × 150 알림 줄이 "보관함의 … 외 2마리가 진화할 수 있어요 (팀에 넣으면 써요)" 48자 세 줄 · 2.5초에 못 읽던 것 — 디자인 UX 리뷰어 #125) · 없으면 null
 */
export function evoUsersLine(save: Save, item: ItemId): string | null {
  const users = evoItemUsers(save, item);
  const first = users[0];
  if (!first) return null;
  return `${first.name} → ${first.toName} 진화 가능${users.length > 1 ? ` 외 ${users.length - 1}` : ''}${users.every((u) => u.where === 'box') ? ' · 팀에 넣고' : ''}`;
}

/** 아직 안내를 못 본 진화 아이템 (가방에 있는 것 중 첫째) — 없으면 null · 본 안내가 꽉 차 (TIPS_MAX) 적을 수 없으면 안 띄움 (매번 다시 뜨지 않게 — 코드 리뷰어) */
export function evoTipItem(save: Save): ItemId | null {
  const tips = save.tips ?? [];
  if (tips.length >= TIPS_MAX) return null;
  return EVO_ITEMS.find((i) => (save.bag[i] ?? 0) > 0 && !tips.includes(evoTipId(i))) ?? null;
}

/** 처음 안내에 쓸 것 — 글 셋 (무엇 · 어떻게 · 누가) 은 기본 문장, 모양 · 줄임은 화면 (디자인) */
export interface EvoTip {
  item: ItemId;
  id: string;
  itemName: string;
  users: EvoUser[];
  examples: { name: string; toName: string }[];
  what: string;
  how: string;
  who: string;
}
export function evoTip(save: Save, item: ItemId): EvoTip {
  const users = evoItemUsers(save, item);
  const examples = users.length > 0 ? [] : evoItemExamples(save, item);
  const name = itemName(item);
  return {
    item,
    id: evoTipId(item),
    itemName: name,
    users,
    examples,
    what: `${withJosa(name, '으로/로')} 특정 포켓몬을 진화시킬 수 있어요`,
    how: users.length > 0 && users.every((u) => u.where === 'box') ? '팀에 넣은 뒤 [B] 가방에서 골라 써요' : '[B] 가방에서 골라 써요',
    who: evoUsersLine(save, item) ?? `지금은 쓸 포켓몬이 없어요${examples.length > 0 ? ` — ${examples.map((e) => `${e.name} → ${e.toName}`).join(' · ')}` : ''}`,
  };
}

/** 두 번째부터 얻은 말 뒤 한 줄 — before → after 에서 늘어난 진화 아이템 중 안내를 이미 본 것 · 쓸 포켓몬이 있을 때만 (처음이면 안내가 대신) */
export function evoGotNote(before: Save, after: Save): string | null {
  for (const item of EVO_ITEMS) {
    if ((after.bag[item] ?? 0) <= (before.bag[item] ?? 0) || !(after.tips ?? []).includes(evoTipId(item))) continue;
    const line = evoUsersLine(after, item);
    if (line) return line;
  }
  return null;
}
