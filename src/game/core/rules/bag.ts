/**
 * 전투 밖에서 쓰는 것 (mvp-spec S13 · S14 · S18 · S19 · 3.8) — 화면을 모르는 계산. 세이브는 늘 새 객체로 돌려줌 (못 하면 null).
 *   S13 병원: 팀 + 보관함 전부 회복 (HP · PP · 상태 이상, 무료) · 보관함에 넣는 순간 회복 (#124)
 *   S14 상점: 사기 (값은 4장)
 *   S18 내 포켓몬: 팀 순서 · 보관함과 바꾸기 · 남은 포인트 나누기 · 놓아주기 (#121)
 *   S19 가방: 상처약 · 좋은상처약 · 상태 회복약 · 기력의조각 · 진화의 돌 · 연결의끈 (볼은 전투에서만)
 */
import { BALANCE } from '../balance';
import type { ItemId, Monster, Save, StatKey } from '../save';
import { evolutionsOf, formsOfSpecies, moveOf, speciesOf } from '../../data';
import { evolutionMoves } from './growth';
import { VALUABLES } from './items';
import { maxHp, starGrade } from './stats';

export type ShopItem = keyof typeof BALANCE.shopPrices;
export const SHOP_ITEMS = Object.keys(BALANCE.shopPrices) as ShopItem[];
export const isShopItem = (id: string): id is ShopItem => (SHOP_ITEMS as readonly string[]).includes(id);
export const priceOf = (id: ShopItem): number => BALANCE.shopPrices[id];
/** 상점에 나오는지 — 회복약 배지 단계 (고급상처약 배지 3 · 풀회복약 5 — gdd 5.2 · 5.5) */
export const shopItemOpen = (save: Save, id: ShopItem): boolean => save.badges.length >= (BALANCE.shopBadges[id] ?? 0);
/** 상점 목록 (배지 단계로 닫힌 것 뺌) — 화면이 이 순서로 */
export const shopItemsFor = (save: Save): ShopItem[] => SHOP_ITEMS.filter((id) => shopItemOpen(save, id));

/** HP 를 채우는 약의 양 — 풀회복약 = 가득 · 약이 아니면 null */
export function healAmount(item: ItemId, missing: number): number | null {
  if (item === 'potion') return Math.min(missing, BALANCE.potionHeal);
  if (item === 'super-potion') return Math.min(missing, BALANCE.superPotionHeal);
  if (item === 'hyper-potion') return Math.min(missing, BALANCE.hyperPotionHeal);
  if (item === 'full-restore') return missing;
  return null;
}
/** HP 를 채우는 약인지 (상처약 넷 — 위 표 하나가 기준) */
export const isHealItem = (item: ItemId): boolean => healAmount(item, 1) !== null;
/** 가방 한 칸 상한 (세이브 검사와 같음) */
export const BAG_MAX = 999;

export function maxHpOf(m: Monster): number {
  const s = speciesOf(m.species);
  return s ? maxHp(s.base, m.ivs, m.points, m.level) : m.hp;
}

/** 다 회복한 포켓몬 — HP 가득 · 상태 이상 없음 · PP 가득 */
export function healed(m: Monster): Monster {
  return { ...m, hp: maxHpOf(m), status: null, moves: m.moves.map((s) => ({ ...s, pp: moveOf(s.moveId)?.pp ?? s.pp })) };
}

/** S13 ① · S17 — 팀 + 보관함 전부 회복 (#124 — 2026-10-28 태현 님 "보관함에 있는 포켓몬은 병원에 가도 회복이 안되네") */
export function healTeam(save: Save): Save {
  const monsters = { ...save.monsters };
  for (const uid of [...save.party, ...save.box]) {
    const m = monsters[uid];
    if (m) monsters[uid] = healed(m);
  }
  return { ...save, monsters };
}

/**
 * 걷는 동안 회복 (2026-10-18 태현 님) — 걸은 시간 1분에 최대 HP 의 10%, 살아 있는 팀만 (상태 이상 · PP 는 그대로).
 * 걸은 시간 = 진행 % × 걷는 시간 → 걸음 크기 (웹뷰 16ms · 확장 250ms) 와 상관없이 같은 결과
 */
export function walkRegen(save: Save, fromProgress: number, toProgress: number): Save {
  if (!(toProgress > fromProgress)) return save;
  const minutes = (p: number) => (p * BALANCE.stageWalkMs) / 60_000;
  let monsters: Save['monsters'] | null = null;
  for (const uid of save.party) {
    const m = save.monsters[uid];
    if (!m || m.hp <= 0) continue;
    const max = maxHpOf(m);
    if (m.hp >= max) continue;
    const per = max * BALANCE.walkRegenPerMinute;
    const heal = Math.floor(per * minutes(toProgress)) - Math.floor(per * minutes(fromProgress));
    if (heal <= 0) continue;
    monsters ??= { ...save.monsters };
    monsters[uid] = { ...m, hp: Math.min(max, m.hp + heal) };
  }
  return monsters ? { ...save, monsters } : save;
}

/** 팀이 다 회복돼 있는지 (병원 [회복] 을 흐리게) */
export function teamHealthy(save: Save): boolean {
  return save.party.every((uid) => {
    const m = save.monsters[uid];
    return !m || (m.hp >= maxHpOf(m) && m.status === null && m.moves.every((s) => s.pp >= (moveOf(s.moveId)?.pp ?? s.pp)));
  });
}

/** S14 — 하나 사기 (돈이 모자라거나 가방이 꽉 차면 null) */
/** 상점 [팔기] 값 — 정가 (상점 값 · 팔 물건 값) × sellRate, 값이 없는 것 (진화의 돌 · 연결의끈) 은 0 = 못 팖 (2026-10-21 ideas #126) */
export function sellPrice(item: ItemId): number {
  const list: Partial<Record<ItemId, number>> = { ...BALANCE.shopPrices, ...BALANCE.valuablePrices };
  return Math.floor((list[item] ?? 0) * BALANCE.sellRate);
}

/** S14 [팔기] — count 개까지 (가진 만큼). 못 팔면 null */
export function sell(save: Save, item: ItemId, count: number): { save: Save; count: number; money: number } | null {
  const price = sellPrice(item);
  const n = Math.min(Math.max(1, Math.floor(Number.isFinite(count) ? count : 1)), save.bag[item] ?? 0);
  if (price <= 0 || n <= 0) return null;
  // 돈 상한 — 실제로 늘어난 돈만 (하나도 못 받으면 안 팖, 테스터)
  const money = Math.min(999_999_999, save.money + price * n) - save.money;
  if (money <= 0) return null;
  return { save: { ...save, money: save.money + money, bag: { ...save.bag, [item]: (save.bag[item] ?? 0) - n } }, count: n, money };
}

/** 이상한사탕을 지금 살 수 있는지 — 스테이지 상점에서 한 판에 candyPerStage 개 (대기실 상점엔 없음 — 2026-10-21 ideas #70, 엔진 · 상점 화면이 같이 씀) */
export function canBuyCandy(save: Save): boolean {
  return save.location.screen === 'stage' && (save.stages[save.location.stageId]?.run.candy ?? 0) < BALANCE.candyPerStage;
}

/** S14 — 하나 사기 (돈 · 가방 한 칸 상한) */
export function buy(save: Save, item: ShopItem): Save | null {
  const price = priceOf(item);
  const have = save.bag[item] ?? 0;
  if (save.money < price || have >= BAG_MAX || !shopItemOpen(save, item)) return null;
  return { ...save, money: save.money - price, bag: { ...save.bag, [item]: have + 1 } };
}

// ---------- S18 팀 · 보관함 · 포인트

/** 살아 있는 포켓몬이 팀에 하나는 있어야 함 (다 쓰러진 팀으로 걷지 않게 [제안]) */
const anyAlive = (save: Save, party: readonly string[]) => party.some((uid) => (save.monsters[uid]?.hp ?? 0) > 0);

/** 팀 순서 — 한 칸 앞 (−1) · 뒤 (+1). 맨 앞 = 선두 */
export function moveInTeam(save: Save, uid: string, dir: -1 | 1): Save | null {
  const i = save.party.indexOf(uid);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= save.party.length) return null;
  const party = [...save.party];
  [party[i], party[j]] = [party[j]!, party[i]!];
  return { ...save, party };
}

/** 보관함 포켓몬을 팀으로 — partyUid 가 있으면 그 칸과 바꿈, 없으면 빈 칸에 (팀이 다 찼으면 null) */
export function swapWithBox(save: Save, boxUid: string, partyUid: string | null): Save | null {
  const b = save.box.indexOf(boxUid);
  if (b < 0) return null;
  if (partyUid === null) {
    if (save.party.length >= BALANCE.partySize) return null;
    const party = [...save.party, boxUid];
    return anyAlive(save, party) ? { ...save, party, box: save.box.filter((u) => u !== boxUid) } : null;
  }
  const p = save.party.indexOf(partyUid);
  if (p < 0) return null;
  const party = save.party.map((u, i) => (i === p ? boxUid : u));
  const box = save.box.map((u, i) => (i === b ? partyUid : u));
  return anyAlive(save, party) ? { ...save, party, box } : null;
}

/** 팀 포켓몬을 보관함으로 (팀에 하나는 남김 · 살아 있는 포켓몬이 남아야 함) — 넣는 순간 회복은 병원 · 대기실에서만 (engine team-to-box · #124 A) */
export function toBox(save: Save, uid: string): Save | null {
  if (!save.party.includes(uid) || save.party.length <= 1) return null;
  const party = save.party.filter((u) => u !== uid);
  return anyAlive(save, party) ? { ...save, party, box: [...save.box, uid] } : null;
}

/** 다 나은 포켓몬 (HP 가득 · 상태 이상 없음 · PP 가득) */
const isHealed = (m: Monster) => m.hp === maxHpOf(m) && m.status === null && m.moves.every((s) => s.pp === (moveOf(s.moveId)?.pp ?? s.pp));

/** 보관함 포켓몬 회복 — HP · PP · 상태 이상 (#124 — 병원 · 대기실에서 넣는 순간, 원작 PC 처럼). 다친 칸만 새로 · 다 건강하면 같은 세이브 */
export function healBox(save: Save): Save {
  let monsters: Save['monsters'] | null = null;
  for (const uid of save.box) {
    const m = save.monsters[uid];
    if (!m || isHealed(m)) continue;
    monsters ??= { ...save.monsters };
    monsters[uid] = healed(m);
  }
  return monsters ? { ...save, monsters } : save;
}

/** S18 ⑥ 놓아주기 (#121 — 2026-10-28 태현 님) 를 못 하는 까닭 — null = 놓을 수 있음 (화면이 버튼을 못 누르게 하고 이 한 줄을 보임). 보관함 포켓몬은 늘 놓을 수 있음 */
export function releaseWhy(save: Save, uid: string): string | null {
  if (!save.monsters[uid] || (!save.party.includes(uid) && !save.box.includes(uid))) return '없는 포켓몬이에요';
  if (!save.party.includes(uid)) return null;
  if (save.party.length <= 1) return '팀의 마지막 한 마리는 놓아줄 수 없어요';
  if (!anyAlive(save, save.party.filter((u) => u !== uid))) return '놓으면 팀에 싸울 수 있는 포켓몬이 없어요';
  return null;
}

/** 확인 상자에서 한 번 더 물을 까닭 (#121) — 이로치 · ★5 · 높은 Lv (BALANCE.releaseHigh — Lv 15 이상 + 팀에 있거나 가장 높은 Lv 와 5 차이 안: 혼자 높은 한 마리만 보면 Lv 50대 주전이 그냥 놓이던 것, 코드 리뷰어) */
export type ReleaseWarn = 'shiny' | 'star5' | 'high';
export function releaseWarns(save: Save, uid: string): ReleaseWarn[] {
  const m = save.monsters[uid];
  if (!m) return [];
  const top = Math.max(0, ...[...save.party, ...save.box].map((u) => save.monsters[u]?.level ?? 0));
  const out: ReleaseWarn[] = [];
  if (m.shiny) out.push('shiny');
  if (starGrade(m.ivs) >= 5) out.push('star5');
  const hi = BALANCE.releaseHigh;
  if (m.level >= hi.minLevel && (save.party.includes(uid) || m.level >= top - hi.nearTop)) out.push('high');
  return out;
}

/** 지금 가진 종 (팀 + 보관함) — 잡은 종 볼 건너뛰기 (설정 ⑩) 기준 (#121 — 놓아준 종은 도감 기록이 남아도 다시 잡을 수 있게) */
export function ownsSpecies(save: Save, species: number): boolean {
  return [...save.party, ...save.box].some((u) => save.monsters[u]?.species === species);
}

/** 놓아주기 — 세이브에서 지움 (팀 · 보관함 · 포켓몬 · 남은 고르기). 선두를 놓으면 다음 칸이 선두 · 도감 "잡은 적 있음" 은 그대로 · 보상 없음. 못 하면 null */
export function release(save: Save, uid: string): Save | null {
  if (releaseWhy(save, uid) !== null) return null;
  const { [uid]: _gone, ...monsters } = save.monsters;
  const next: Save = {
    ...save,
    monsters,
    party: save.party.filter((u) => u !== uid),
    box: save.box.filter((u) => u !== uid),
    pendingChoices: save.pendingChoices.filter((c) => c.uid !== uid),
  };
  if (save.laterChoices) next.laterChoices = save.laterChoices.filter((c) => c.uid !== uid);
  return next;
}

/** S18 ⑤ 남은 포인트 하나를 나눔 — HP 에 넣으면 최대 HP 가 는 만큼 지금 HP 도 (레벨업과 같은 규칙, 쓰러진 포켓몬은 그대로) */
export function spendPoint(save: Save, uid: string, stat: StatKey): Save | null {
  const m = save.monsters[uid];
  if (!m || m.unspentPoints <= 0) return null;
  const next: Monster = { ...m, points: { ...m.points, [stat]: m.points[stat] + 1 }, unspentPoints: m.unspentPoints - 1 };
  if (m.hp > 0) next.hp = Math.min(maxHpOf(next), m.hp + (maxHpOf(next) - maxHpOf(m)));
  return { ...save, monsters: { ...save.monsters, [uid]: next } };
}

/** 팀 상태 — HP 합 % · 쓰러진 수 · 다 건강 (HP · PP 가득 · 상태 이상 없음) · 위험 (HP 절반 아래 또는 쓰러짐) — 병원 앞 상자 (ideas #42) · 정보줄 작은 칸 (#47) */
export function teamHealth(save: Save): { hpPct: number; fainted: number; healthy: boolean; danger: boolean } {
  let hp = 0;
  let max = 0;
  let fainted = 0;
  let healthy = true;
  for (const uid of save.party) {
    const m = save.monsters[uid];
    if (!m) continue;
    const mx = maxHpOf(m);
    hp += Math.max(0, m.hp);
    max += mx;
    if (m.hp <= 0) fainted++;
    if (m.hp < mx || m.status || m.moves.some((s) => s.pp < (moveOf(s.moveId)?.pp ?? s.pp))) healthy = false;
  }
  const ratio = max > 0 ? hp / max : 0;
  return { hpPct: Math.round(ratio * 100), fainted, healthy, danger: fainted > 0 || ratio < BALANCE.teamDangerBelow };
}

// ---------- S19 가방 (전투 밖)

/** 전투 밖에서 쓰는 아이템 (볼은 전투에서만) */
/** 관장 AI 상처약 — 에이스 최대 HP × gymPotionShare 에 가장 가까이 낫는 것 (지역마다 에이스가 커져도 비율이 비슷하게 — ideas 713) */
export function leaderPotion(maxHp: number): 'potion' | 'super-potion' | 'hyper-potion' {
  const want = maxHp * BALANCE.gymPotionShare;
  const opts = [
    ['potion', BALANCE.potionHeal],
    ['super-potion', BALANCE.superPotionHeal],
    ['hyper-potion', BALANCE.hyperPotionHeal],
  ] as const;
  return opts.reduce((best, o) => (Math.abs(o[1] - want) < Math.abs(best[1] - want) ? o : best))[0];
}

export const FIELD_ITEMS: readonly ItemId[] = ['potion', 'super-potion', 'hyper-potion', 'full-restore', 'full-heal', 'revive', 'rare-candy', 'fire-stone', 'water-stone', 'thunder-stone', 'leaf-stone', 'moon-stone', 'linking-cord'];
/** 진화의 돌 5종 (라이벌 보상도 여기서 — rules/rival.ts) */
export const STONES: readonly ItemId[] = ['fire-stone', 'water-stone', 'thunder-stone', 'leaf-stone', 'moon-stone'];
export const isEvolutionItem = (item: ItemId) => STONES.includes(item) || item === 'linking-cord';

/** 그 아이템으로 하는 진화 (돌 = 그 돌 · 연결의끈 = 교환 진화) — 그림이 있는 종만, 없으면 null */
export function itemEvolution(m: Monster, item: ItemId): number | null {
  const e = evolutionsOf(m.species).find((x) => (item === 'linking-cord' ? x.kind === 'trade' : x.kind === 'item' && x.item === item) && formsOfSpecies(x.to).length > 0);
  return e ? e.to : null;
}

/** 그 포켓몬에게 쓸 수 있는지 — 못 쓰면 까닭 (mvp-spec S19 막는 것 [제안]) */
export function fieldUseBlock(m: Monster, item: ItemId): string | null {
  switch (item) {
    case 'potion':
    case 'super-potion':
    case 'hyper-potion':
      if (m.hp <= 0) return '쓰러진 포켓몬에게는 기력의조각을 써요';
      if (m.hp >= maxHpOf(m)) return 'HP 가 가득해요';
      return null;
    case 'full-restore':
      if (m.hp <= 0) return '쓰러진 포켓몬에게는 기력의조각을 써요';
      return m.hp >= maxHpOf(m) && !m.status ? 'HP 가 가득하고 상태 이상도 없어요' : null;
    case 'full-heal':
      if (m.hp <= 0) return '쓰러진 포켓몬이에요';
      return m.status ? null : '상태 이상이 없어요';
    case 'revive':
      return m.hp <= 0 ? null : '쓰러진 포켓몬에게만 써요';
    case 'rare-candy':
      return m.level >= BALANCE.maxLevel ? '더 오를 수 없어요' : null;
    case 'exp-charm':
      return '스테이지를 새로 시작할 때 저절로 써요';
    default:
      if (VALUABLES.includes(item)) return '상점에서 팔 수 있어요';
      if (isEvolutionItem(item)) return itemEvolution(m, item) !== null ? null : '이 포켓몬은 진화하지 않아요';
      return '전투에서만 써요';
  }
}

/**
 * S19 — 아이템 하나 쓰기. 진화의 돌 · 연결의끈은 진화 고르기 (S22) 를 맨 앞에 넣음 (멈추면 아이템을 돌려줌 — resolveEvolve).
 * 못 쓰면 null
 */
/** cured = 상태 이상이 나음 (풀회복약 · 만병통치제 · 기력의조각 — 알림에 "몸도 개운해졌다", 테스터 #75) */
export function useFieldItem(save: Save, item: ItemId, uid: string): { save: Save; healedHp: number; evolve: boolean; cured: boolean } | null {
  const m = save.monsters[uid];
  const have = save.bag[item] ?? 0;
  // 이상한사탕은 레벨업 (랜덤) 이라 엔진 (useRareCandy) 이 씀
  if (!m || have <= 0 || !save.party.includes(uid) || item === 'rare-candy' || fieldUseBlock(m, item) !== null) return null;
  const bag = { ...save.bag, [item]: have - 1 };
  if (isEvolutionItem(item)) {
    const to = itemEvolution(m, item)!;
    const choice = { kind: 'evolve' as const, uid, to, newMoves: evolutionMoves(m, to), level: m.level, item };
    return { save: { ...save, bag, pendingChoices: [choice, ...save.pendingChoices] }, healedHp: 0, evolve: true, cured: false };
  }
  let next: Monster = m;
  const heal = healAmount(item, maxHpOf(m) - m.hp);
  if (heal !== null) next = { ...m, hp: m.hp + heal, ...(item === 'full-restore' ? { status: null } : {}) };
  else if (item === 'full-heal') next = { ...m, status: null };
  else if (item === 'revive') next = { ...m, hp: Math.max(1, Math.floor(maxHpOf(m) * BALANCE.reviveFraction)), status: null };
  return { save: { ...save, bag, monsters: { ...save.monsters, [uid]: next } }, healedHp: next.hp - m.hp, evolve: false, cured: !!m.status && !next.status };
}
