/**
 * 아이템 이름 · 전투에서 쓰는 아이템 — 한 곳에 (줍기 · 부탁 보상 · 전투 메뉴 · 상점이 같은 이름을 씀).
 */
import type { ItemId } from '../save';

const ITEM_NAMES: Record<ItemId, string> = {
  'poke-ball': '몬스터볼',
  'great-ball': '슈퍼볼',
  'ultra-ball': '하이퍼볼',
  potion: '상처약',
  'super-potion': '좋은상처약',
  'full-heal': '상태 회복약',
  revive: '기력의조각',
  'fire-stone': '불꽃의돌',
  'water-stone': '물의돌',
  'thunder-stone': '천둥의돌',
  'leaf-stone': '리프의돌',
  'moon-stone': '달의돌',
  'linking-cord': '연결의끈',
};

export const itemName = (id: ItemId): string => ITEM_NAMES[id] ?? id;

/** S09 ⑦ 4 아이템 — 전투에서 쓰는 것 (볼은 단계 7 S11) */
export const BATTLE_ITEMS: readonly ItemId[] = ['potion', 'super-potion', 'full-heal', 'revive'];
