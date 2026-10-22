/**
 * S07 지도 · S13 병원 · S14 상점 · S16 대기실 · S18 내 포켓몬 · S19 가방 · S21 프로필 · S24 클리어 — 화면을 모르는 부분: 무엇을 어떤 글로 보여 줄지.
 */
import { BALANCE } from '../../core/balance';
import { gymUnlocked, nextStageOf, regionGymUnlocked, regionsOn, stageClearGain, stageUnlocked, type GameState } from '../../core/engine';
import { canBuyCandy, FIELD_ITEMS, fieldUseBlock, isEvolutionItem, maxHpOf, priceOf, sellPrice, SHOP_ITEMS, type ShopItem } from '../../core/rules/bag';
import { itemName, VALUABLES } from '../../core/rules/items';
import { isRegionLast, regionAceLevel, regionHere, regionOrder, REGIONS, type RegionDef } from '../../core/rules/region';
import { expForLevel, starGrade, statsOf } from '../../core/rules/stats';
import { ITEM_IDS, REGION_IDS, STAT_KEYS, type ItemId, type Monster, type RegionId, type Save, type StageId, type StatKey } from '../../core/save';
import { typeNameKo } from '../../core/text';
import { formsOfSpecies, speciesOf } from '../../data';
import { moveView, type MoveView } from '../result/model';
import type { IconName } from '../../data/icons';
import { STAGES, stageLabel } from '../stage/model';

export const STAT_LABEL: Record<StatKey, string> = { hp: 'HP', attack: '공격', defense: '방어', speed: '스피드', ultimate: '필살' };

/** 화면 위에 뜨는 판 — 떠 있는 동안 게임이 멈춤 (웹뷰가 계산을 쉼) */
export type Overlay = { kind: 'map' } | { kind: 'team'; back?: 'map'; /** 처음 고를 포켓몬 (결과 레벨업 → 스탯 찍기) */ uid?: string } | { kind: 'bag' } | { kind: 'settings' } | { kind: 'shop' } | { kind: 'profile'; side: 'me' | 'foe' }
  /** 개발 모드 (임시, gdd 8장) 개발 메뉴 */
  | { kind: 'dev' };

/** 물건 그림 (상점 · 가방 — 2026-10-20 아트 디렉터 3차) · 진화의 돌은 같은 돌 그림 */
export const ITEM_ICON: Record<ItemId, IconName> = {
  'poke-ball': 'ball',
  'great-ball': 'greatBall',
  'ultra-ball': 'ultraBall',
  potion: 'potion',
  'super-potion': 'superPotion',
  'full-heal': 'fullHeal',
  revive: 'revive',
  'fire-stone': 'stone',
  'water-stone': 'stone',
  'thunder-stone': 'stone',
  'leaf-stone': 'stone',
  'moon-stone': 'stone',
  'linking-cord': 'cord',
  // 다음 버전 2단계 (2026-10-21) — 디자인팀 8 × 8 아이콘 (data/icons.ts)
  'rare-candy': 'rareCandy',
  'exp-charm': 'expCharm',
  'tiny-mushroom': 'tinyMushroom',
  pearl: 'pearl',
  stardust: 'stardust',
  'big-mushroom': 'bigMushroom',
  'big-pearl': 'bigPearl',
  nugget: 'nugget',
  'star-piece': 'starPiece',
  'big-nugget': 'bigNugget',
};

/** 팀에 남은 포인트가 있는 포켓몬이 있는지 (◓ 버튼에 점) */
export const hasUnspent = (save: Save) => save.party.some((uid) => (save.monsters[uid]?.unspentPoints ?? 0) > 0);
/** 팀에 남은 포인트 합 — 정보줄 "포켓몬 +2" (빨간 점만이면 뜻을 모름, 2026-10-20 플레이 리뷰어) */
export const unspentPoints = (save: Save) => save.party.reduce((n, uid) => n + (save.monsters[uid]?.unspentPoints ?? 0), 0);

/**
 * 정보줄 메뉴 단축키 (2026-10-19 태현 님 "아이콘만 있어 무슨 메뉴인지 모름 — 단축키 + 아이콘 + 설명") — F 빨리 걷기 · M 지도 · P 내 포켓몬 · B 가방 · S 설정.
 * 버튼에 쓰인 글자 그대로. 한글 입력 상태에서도 되게 자판 자리 (KeyboardEvent.code 'KeyM') 로 들음 (main.ts) — 전투 숫자 · Z · Enter · Esc · 방향키와 안 겹침
 */
export type MenuShortcut = 'fast' | 'map' | 'team' | 'bag' | 'settings';
export const MENU_KEYS: Record<MenuShortcut, string> = { fast: 'F', map: 'M', team: 'P', bag: 'B', settings: 'S' };
export function menuShortcutOf(code: string): MenuShortcut | null {
  return (Object.keys(MENU_KEYS) as MenuShortcut[]).find((k) => code === `Key${MENU_KEYS[k]}`) ?? null;
}
/** 정보줄 메뉴로 여는 판 — 하나가 떠 있을 때 다른 메뉴 단축키를 누르면 그 판으로 바꿈 */
export const MENU_PANELS: readonly Overlay['kind'][] = ['map', 'team', 'bag', 'settings'];

/**
 * 정보줄 메뉴 모양 — full = 단축키 + 아이콘 + 이름 · text = 아이콘 + 이름 · icon = 아이콘만 (이름은 올리면 나옴).
 * 지도 줄이 따로 있으면 (패널 180px 이상) 첫 줄에 볼 · 메뉴만 있어 자리가 넉넉, 없으면 가운데 지도와 나눠 씀 (버튼 다섯: 이름까지 ≈ 440px · 단축키 빼면 ≈ 350px)
 */
export type MenuLabels = 'full' | 'text' | 'icon';
export function menuLabels(widthPx: number, mapRow: boolean): MenuLabels {
  // 지도 줄이 있으면 글자 메뉴는 510 부터 (480 ~ 505 에서 칸보다 몇 px 넓어 첫 버튼 ▶▶ 가 반쯤 잘리던 것 — UX 리뷰어 2026-10-21)
  const [full, text] = mapRow ? [560, 510] : [1100, 920];
  return widthPx >= full ? 'full' : widthPx >= text ? 'text' : 'icon';
}

export const nameOfMonster = (m: Monster) => speciesOf(m.species)?.name.ko ?? m.form;
export const stars = (n: number) => {
  const k = Math.max(0, Math.min(5, Math.round(Number.isFinite(n) ? n : 0)));
  return '★'.repeat(k) + '☆'.repeat(5 - k);
};

export interface MonsterView {
  uid: string;
  name: string;
  form: string;
  shiny: boolean;
  level: number;
  hp: number;
  maxHp: number;
  status: string | null;
  star: number;
  /** 경험치 막대 (이 레벨 안에서 0 ~ 1) · 다음 레벨까지 */
  expRatio: number;
  expToNext: number;
  stats: { key: StatKey; label: string; value: number }[];
  unspent: number;
  moves: MoveView[];
  types: string;
}

const STATUS_KO: Record<string, string> = { poison: '독', burn: '화상', paralysis: '마비', sleep: '잠듦' };

export function monsterView(m: Monster): MonsterView {
  const s = speciesOf(m.species);
  const st = s ? statsOf(s.base, m.ivs, m.points, m.level) : null;
  const lo = expForLevel(m.level);
  const hi = expForLevel(m.level + 1);
  const atMax = m.level >= BALANCE.maxLevel;
  return {
    uid: m.uid,
    name: nameOfMonster(m),
    form: m.form,
    shiny: m.shiny,
    level: m.level,
    hp: Math.min(m.hp, maxHpOf(m)),
    maxHp: maxHpOf(m),
    status: m.status ? (STATUS_KO[m.status.kind] ?? null) : null,
    star: starGrade(m.ivs),
    expRatio: atMax ? 1 : Math.max(0, Math.min(1, (m.exp - lo) / Math.max(1, hi - lo))),
    expToNext: atMax ? 0 : Math.max(0, hi - m.exp),
    stats: STAT_KEYS.map((key) => ({ key, label: STAT_LABEL[key], value: st ? Math.floor(key === 'hp' ? maxHpOf(m) : st[key]) : 0 })),
    unspent: m.unspentPoints,
    moves: m.moves.map((x) => moveView(x.moveId, x.pp)),
    types: (s?.types ?? []).map(typeNameKo).join(' · '),
  };
}

/** S18 ① 팀 (맨 앞 = 선두) · ② 보관함 */
export function teamView(save: Save): { party: MonsterView[]; box: MonsterView[] } {
  const view = (uid: string) => {
    const m = save.monsters[uid];
    return m ? monsterView(m) : null;
  };
  return { party: save.party.map(view).filter((x): x is MonsterView => !!x), box: save.box.map(view).filter((x): x is MonsterView => !!x) };
}

export interface BagRow {
  item: ItemId;
  name: string;
  count: number;
  /** 전투 밖에서 쓸 수 있는 종류 (볼은 전투에서만) */
  field: boolean;
  /** 진화의 돌 · 연결의끈 */
  evolution: boolean;
  /** 전투 밖에서 못 쓰는 것의 안내 (볼 · 팔 물건 · 경험 부적 — 2026-10-21 UX 리뷰어: 진주가 "전투에서 써요" 로 나오던 것) */
  note?: string;
}

/** S19 ① 가진 아이템 — 쓰는 것 먼저 */
export function bagView(save: Save): BagRow[] {
  const rows: BagRow[] = [];
  for (const [item, count] of Object.entries(save.bag) as [ItemId, number][]) {
    if (!count || count <= 0) continue;
    const field = FIELD_ITEMS.includes(item);
    const note = field
      ? undefined
      : VALUABLES.includes(item)
        ? `상점에서 팔아요 · 1개 +${sellPrice(item).toLocaleString()}원`
        : item === 'exp-charm'
          ? `다음 스테이지를 새로 시작하면 저절로 써요 (경험치 ×${BALANCE.expCharmScale})`
          : '볼은 전투에서 써요 (야생 포켓몬에게)';
    rows.push({ item, name: itemName(item), count, field, evolution: isEvolutionItem(item), note });
  }
  return rows.sort((a, b) => Number(b.field) - Number(a.field));
}

/** 그 아이템을 팀 포켓몬마다 쓸 수 있는지 (흐리게 + 까닭) */
export function bagTargets(save: Save, item: ItemId): { view: MonsterView; block: string | null }[] {
  return save.party
    .map((uid) => save.monsters[uid])
    .filter((m): m is Monster => !!m)
    .map((m) => ({ view: monsterView(m), block: fieldUseBlock(m, item) }));
}

export interface ShopRow {
  item: ShopItem;
  name: string;
  /** 무엇을 하는지 짧게 ("HP 20" · "잘 잡힘 ×1.5") */
  effect: string;
  /** 긴 설명 (마우스를 올리면) */
  detail: string;
  price: number;
  have: number;
  affordable: boolean;
  /** 못 사는 까닭 (돈 말고) — 이상한사탕 "한 판에 1개" · "스테이지 상점에서만" (2026-10-21 다음 버전 2단계) */
  blocked?: string;
}

/** 상점 물건 한 줄 설명 (2026-10-19 태현 님 "볼 설명이 부실해" — 예전엔 "×1.5 · ×0" 처럼 잡기 배율과 가진 개수가 같은 × 라 헷갈림) · 3칸에서 안 잘리게 짧게 (아트 디렉터 4차, 긴 설명은 SHOP_DETAIL) */
const SHOP_EFFECT: Record<ShopItem, string> = {
  'poke-ball': '잡기 보통',
  'great-ball': `잘 잡힘 ×${BALANCE.ballScale['great-ball']}`,
  'ultra-ball': `잘 잡힘 ×${BALANCE.ballScale['ultra-ball']}`,
  potion: `HP ${BALANCE.potionHeal} 회복`,
  'super-potion': `HP ${BALANCE.superPotionHeal} 회복`,
  'full-heal': '상태 회복',
  revive: '되살림 HP ½',
  'rare-candy': '레벨 +1',
  // 무엇의 배율인지 (UX 밤 점검 · orders #51 — "다음판×1.5") · 다음 판이라는 것은 긴 설명
  'exp-charm': `경험치 ×${BALANCE.expCharmScale}`,
};
/** 마우스를 올리면 보이는 긴 설명 */
const SHOP_DETAIL: Record<ShopItem, string> = {
  'poke-ball': '야생 포켓몬을 잡는 기본 볼 — 상대 HP 가 낮을수록 잘 잡혀요',
  'great-ball': `몬스터볼보다 ${BALANCE.ballScale['great-ball']}배 잘 잡혀요`,
  'ultra-ball': `몬스터볼보다 ${BALANCE.ballScale['ultra-ball']}배 잘 잡혀요`,
  potion: `포켓몬 하나의 HP 를 ${BALANCE.potionHeal} 회복해요`,
  'super-potion': `포켓몬 하나의 HP 를 ${BALANCE.superPotionHeal} 회복해요`,
  'full-heal': '독 · 화상 · 마비 · 잠듦을 낫게 해요',
  revive: '쓰러진 포켓몬을 HP 절반으로 깨워요',
  'rare-candy': `포켓몬 하나의 레벨이 1 올라요 — 스테이지 상점에서 한 판에 ${BALANCE.candyPerStage}개만`,
  'exp-charm': `다음에 스테이지를 새로 시작할 때 저절로 써서 그 스테이지 경험치가 ×${BALANCE.expCharmScale}`,
};

/** S14 ① 물건 · ③ 내 돈 */
export function shopView(save: Save): ShopRow[] {
  // 이상한사탕 = 스테이지 상점에서 한 판에 1개 (대기실 상점 · 이미 산 판은 흐리게 — 다음 버전 2단계)
  // 규칙은 엔진과 같은 canBuyCandy (rules/bag)
  // 까닭은 짧게 (3칸 바둑판 · 240 에서 안 잘리게 — UX 리뷰어)
  const candyBlock = canBuyCandy(save) ? undefined : save.location.screen === 'stage' ? '한 판에 1개' : '길 상점만';
  return SHOP_ITEMS.map((item) => {
    const blocked = item === 'rare-candy' ? candyBlock : undefined;
    return { item, name: itemName(item), effect: SHOP_EFFECT[item], detail: SHOP_DETAIL[item], price: priceOf(item), have: save.bag[item] ?? 0, affordable: save.money >= priceOf(item) && !blocked, blocked };
  });
}

export interface SellRow {
  item: ItemId;
  name: string;
  /** 하나 팔면 받는 돈 (정가 × sellRate) */
  price: number;
  have: number;
}

/** S14 [팔기] — 가방에 있고 팔 수 있는 것 (값이 0 인 진화의 돌 · 연결의끈은 빠짐). 팔 물건 (진주 · 금구슬 …) 을 앞에, 나머지는 물건 순서대로 */
export function sellView(save: Save): SellRow[] {
  const order = [...VALUABLES, ...ITEM_IDS.filter((i) => !VALUABLES.includes(i))];
  return order.filter((item) => (save.bag[item] ?? 0) > 0 && sellPrice(item) > 0).map((item) => ({ item, name: itemName(item), price: sellPrice(item), have: save.bag[item] ?? 0 }));
}

export type MapStageState = 'cleared' | 'current' | 'open' | 'locked';

export interface MapStage {
  id: StageId;
  label: string;
  code: string;
  icon: IconName;
  state: MapStageState;
  gym: boolean;
}

/** S07 ① 갈 수 있는 스테이지 · ② 잠긴 스테이지 · 체육관 (지역 끝을 깨면 바로) — 지금 있는 지역 (지역 표 — 해변 미리 보기면 해변 셋, 디자인 UX 리뷰어) · region = 지역 이름 ("숲") */
/** S07 지역 칸 (orders #66 · 디자인 #67) — 연 지역마다: 몇 번째 · 배지 · 지금 있는 지역 · 스테이지 · 체육관 열림 */
export interface MapRegion {
  id: RegionId;
  name: string;
  /** 몇 번째 지역 (1 부터 — 연 순서) */
  k: number;
  badge: boolean;
  here: boolean;
  stages: MapStage[];
  gym: boolean;
}

/**
 * S07 세계 지도 — region · stages · gym · badge = 지금 지역 (예전 그대로) ·
 * regions = 연 지역 (다음 지역 열기가 꺼지면 지금 지역 하나) · next = 관장 첫 승 뒤 고를 곳 · locked = 아직 안 연 지역 (고를 곳도 아님 — 화면이 "???" 로 가릴 수 있음)
 */
export function mapView(state: GameState): { region: string; stages: MapStage[]; gym: boolean; badge: boolean; regions: MapRegion[]; next: { id: RegionId; name: string }[]; locked: { id: RegionId; name: string }[] } {
  const save = state.save;
  const region = regionHere(save.location);
  const on = regionsOn(state);
  const order = on ? save.regions.order : [region.id];
  const regions = order.map((id, i): MapRegion => {
    const r = REGIONS[id];
    return { id, name: r.name, k: i + 1, badge: save.badges.includes(r.badge), here: id === region.id, stages: mapStages(save, r), gym: regionGymUnlocked(save, r) };
  });
  const next = on ? (save.regions.next ?? []) : [];
  const locked = on ? REGION_IDS.filter((id) => !order.includes(id) && !next.includes(id)) : [];
  const name = (id: RegionId) => ({ id, name: REGIONS[id].name });
  return { region: region.name, stages: mapStages(save, region), gym: gymUnlocked(save), badge: save.badges.includes(region.badge), regions, next: next.map(name), locked: locked.map(name) };
}

function mapStages(save: Save, region: RegionDef): MapStage[] {
  const here = save.location.screen === 'stage' ? save.location.stageId : null;
  return region.stages.map(({ id }): MapStage => {
    const info = STAGES[id];
    const s: MapStageState = id === here ? 'current' : !stageUnlocked(save, id) ? 'locked' : save.stages[id]?.cleared ? 'cleared' : 'open';
    return { id, label: info.name, code: info.code, icon: info.icon, state: s, gym: isRegionLast(id) };
  });
}

/** S24 ① 클리어 안내 — 세이브의 이번 판 기록으로 (껐다 켜도 같은 카드) */
export function clearView(save: Save, id: StageId): { title: string; bonus: number; balls: number; caught: number; trainers: number; minutes: number; seen: { dex: number; form: string }[]; next: StageId | null } {
  const p = save.stages[id];
  const run = p?.run ?? { startMs: save.playTimeMs, caught: 0, trainers: 0, seen: [] };
  return {
    title: `${stageLabel(id)} 클리어!`,
    // 경험 부적 판이면 ×1.5 (받은 그대로 — 2026-10-21 ideas #70)
    // 선두가 받는 값 (방치면 줄어든 값 — 코드 리뷰어 #70)
    bonus: stageClearGain(save, id),
    balls: BALANCE.clearBalls,
    caught: run.caught,
    trainers: run.trainers,
    minutes: Math.max(0, Math.round((save.playTimeMs - run.startMs) / 60000)),
    seen: run.seen.map((dex) => ({ dex, form: formsOfSpecies(dex)[0] ?? '' })).filter((x) => x.form),
    next: ((n) => (n === 'gym' ? null : n))(nextStageOf(id)),
  };
}

/** S16 ④ 추천 레벨 · 내 팀에서 가장 센 3마리 평균 레벨 (모자라면 빨간색) — 관장이 3마리라 (5마리 평균이면 이길 만한데도 빨간색: 단계 11 플레이 리뷰) */
export function lobbyView(save: Save): { recommended: number; average: number; short: boolean } {
  const levels = save.party
    .map((uid) => save.monsters[uid]?.level ?? 0)
    .filter((l) => l > 0)
    .sort((a, b) => b - a)
    .slice(0, BALANCE.gymTeam.length);
  const average = levels.length ? Math.round((levels.reduce((a, b) => a + b, 0) / levels.length) * 10) / 10 : 0;
  // 추천 Lv = 그 지역 관장 에이스 (gdd 5.2) — 숲은 그대로 (해변 미리 보기에서 15 로 나오던 것 — #50 확인)
  const region = regionHere(save.location);
  const recommended = region.id === 'forest' ? BALANCE.gymRecommendedLevel : regionAceLevel(regionOrder(region.id));
  return { recommended, average, short: average < recommended };
}
