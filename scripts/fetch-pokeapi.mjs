// 게임 모드 데이터 받기 — PokeAPI CSV (고정된 커밋) → src/game/data/generated/*.json
//
//   node scripts/fetch-pokeapi.mjs          받은 CSV 는 .cache/pokeapi/<커밋>/ 에 두고 다시 씀 (두 번째부터는 인터넷 없이)
//
// - 포켓몬: 확장에 그림이 있는 종만 (extension/out/common/pokemon-data.js). 포켓몬을 더 넣었으면 (add-pokemon.py) 다시 돌림
// - 기준 게임: 울트라썬 · 울트라문 (version group 18) — 레벨업 기술표 · 진화 조건 · 기술 값 (뒤 게임에서 바뀐 값은 되돌림)
// - 기술: 게임에서 쓸 수 있는 것만 거름 (아래 "기술 거르기" — mvp-spec 3.6 · 9장)
// - 원작 그림 · 소리는 받지 않음. 숫자 · 이름 데이터만 (PokeAPI, BSD-3-Clause → extension/THIRD-PARTY-NOTICES.txt)
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/** PokeAPI 저장소 커밋 — 바꾸면 데이터가 바뀌므로 테스트를 다시 돌려 봄 */
const POKEAPI_REF = '5ee47a9a9c1229632ec4b473a9c1c53026e005dd';
const CSV_BASE = `https://raw.githubusercontent.com/PokeAPI/pokeapi/${POKEAPI_REF}/data/v2/csv`;
const CACHE = join(ROOT, '.cache', 'pokeapi', POKEAPI_REF.slice(0, 12));
const OUT = join(ROOT, 'src', 'game', 'data', 'generated');
const USUM = 18; // version group: ultra-sun-ultra-moon
const LAST_USUM_DEX = 807; // 울트라썬문에 있는 마지막 종 (그 뒤 종은 기술표 · 진화가 없음)
const LANG_KO = '3';
const LANG_EN = '9';

// ---------- 기술 거르기 (mvp-spec 3.6 · 9장 "빼거나 단순하게") ----------

/** 게임에 있는 상태 이상 (mvp-spec 3.3 U14) — 이것을 거는 변화 기술만 넣음 */
const OUR_AILMENTS = new Set(['poison', 'burn', 'paralysis', 'sleep']);
/** 피해 기술 중 받는 메타 분류 — 능력치 변화 · 회복 부가 효과는 무시하고 피해만 씀 */
const DAMAGE_CATEGORIES = new Set(['damage', 'damage-ailment', 'damage-lower', 'damage-raise', 'damage-heal']);
/** 뺄 피해 기술과 까닭 — 게이지 · 1:1 전투에서 조건이나 대가를 만들 수 없는 것 */
const EXCLUDED_MOVES = {
  '쓰러지며 쓰는 기술': ['self-destruct', 'explosion', 'memento', 'final-gambit', 'healing-wish', 'lunar-dance', 'misty-explosion'],
  '조건이 있어야 쓰는 기술': ['focus-punch', 'dream-eater', 'belch', 'synchronoise', 'last-resort', 'snore', 'fake-out', 'first-impression', 'sucker-punch', 'future-sight', 'doom-desire'],
  '여러 턴 날뛰는 기술 (혼란 · 소란)': ['outrage', 'petal-dance', 'thrash', 'uproar'],
  '쓰면 자기 능력치가 크게 떨어지는 기술 (능력치 변화 규칙이 없음)': [
    'overheat', 'leaf-storm', 'draco-meteor', 'psycho-boost', 'fleur-cannon', 'close-combat', 'superpower', 'v-create',
    'hammer-arm', 'ice-hammer', 'dragon-ascent', 'clanging-scales',
  ],
  '빗나가면 자기가 다치는 기술': ['jump-kick', 'high-jump-kick'],
  'HP 에 따라 위력이 바뀌는 기술': ['eruption', 'water-spout'],
};
const EXCLUDED = new Map(Object.entries(EXCLUDED_MOVES).flatMap(([why, keys]) => keys.map((k) => [k, why])));
/** 원작 합계로 고친 위력 (한 번 위력 × 평균 횟수로는 안 맞는 것) */
const POWER_OVERRIDE = { 'triple-kick': 60 }; // 10 + 20 + 30
/** 전투 규칙이 따로 처리할 부가 효과 */
const MOVE_EFFECTS = { 'false-swipe': 'leave-1hp' };

/**
 * 게임에서 쓸 기술인지.
 * - 변화 기술: 상태 이상(독 · 화상 · 마비 · 잠듦)을 거는 것만 (능력치만 바꾸는 · 회복 · 혼란 · 씨뿌리기 등은 뺌)
 * - 피해 기술: 위력이 정해지지 않은 것(고정 · 무게 · 레벨 피해 등) · 일격필살 · 모으기(2턴) · 반동으로 쉬는 것 · 특수 효과 ·
 *   EXCLUDED_MOVES 는 뺌. 연속기는 평균 횟수만큼 위력을 곱함 (2~5회 = 3회), 반동 · 흡수는 drain(%)으로 남김
 */
function classifyMove(m, flags, ailmentName, categoryName) {
  const damageClass = m.damage_class_id === '1' ? 'status' : m.damage_class_id === '2' ? 'physical' : 'special';
  const ailment = ailmentName && OUR_AILMENTS.has(ailmentName) ? ailmentName : null;
  if (damageClass === 'status') {
    // 분류와 상관없이 우리 상태 이상을 걸면 넣음 (독실 = 독 + 스피드 하락 → 독만)
    return ailment ? { keep: true, damageClass, ailment } : { keep: false, reason: '변화 기술' };
  }
  if (m.power === null) return { keep: false, reason: '위력이 정해지지 않음 (고정 · 무게 · 레벨 피해 등)' };
  if (categoryName === 'ohko') return { keep: false, reason: '일격필살' };
  if (!DAMAGE_CATEGORIES.has(categoryName ?? 'unique')) return { keep: false, reason: `특수한 효과 (${categoryName})` };
  if (EXCLUDED.has(m.identifier)) return { keep: false, reason: EXCLUDED.get(m.identifier) };
  if (flags.has('charge')) return { keep: false, reason: '모으기 (2턴)' };
  if (flags.has('recharge')) return { keep: false, reason: '반동으로 쉬는 기술' };
  return { keep: true, damageClass, ailment };
}

function averageHits(meta) {
  const min = num(meta?.min_hits);
  const max = num(meta?.max_hits);
  if (min === null || max === null) return 1;
  if (min === 2 && max === 5) return 3; // 원작 2~5회의 평균 (약 3.1)
  return (min + max) / 2;
}

// ---------- CSV ----------

async function csv(name) {
  mkdirSync(CACHE, { recursive: true });
  const file = join(CACHE, `${name}.csv`);
  if (!existsSync(file)) {
    let res;
    try {
      res = await fetch(`${CSV_BASE}/${name}.csv`);
    } catch (e) {
      throw new Error(`${name}.csv 를 받지 못함 — 인터넷 연결을 확인하세요 (${e.cause?.code ?? e.message})`);
    }
    if (!res.ok) throw new Error(`${name}.csv 받기 실패: HTTP ${res.status}`);
    // 다 받은 뒤에만 캐시가 되게 (받다가 끊겨 잘린 파일이 캐시로 남지 않게)
    writeFileSync(`${file}.tmp`, await res.text(), 'utf8');
    renameSync(`${file}.tmp`, file);
  }
  const text = readFileSync(file, 'utf8');
  const rows = parseCsv(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text, name); // BOM 이 있으면 뺌
  if (rows.length === 0) throw new Error(`${name}.csv 가 비어 있음 — .cache/pokeapi 를 지우고 다시`);
  return rows;
}

/** 따옴표 안의 쉼표 · 줄바꿈까지 읽는 작은 CSV 읽개. 칸 수가 머리줄과 다르면 오류 (잘린 · 깨진 파일) */
function parseCsv(text, name) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [head, ...body] = rows;
  body.forEach((r, i) => {
    if (r.length !== head.length) throw new Error(`${name}.csv ${i + 2}번째 줄 칸 수가 ${r.length} (머리줄 ${head.length}) — 파일이 깨졌으면 .cache/pokeapi 를 지우고 다시`);
  });
  return body.map((r) => Object.fromEntries(head.map((h, j) => [h, r[j]])));
}

const num = (v) => (v === '' || v === undefined || v === null ? null : Number(v));
const byId = (rows, key = 'id') => new Map(rows.map((r) => [r[key], r]));
const names = (rows, idKey) => {
  const out = new Map();
  for (const r of rows) {
    if (r.local_language_id !== LANG_KO && r.local_language_id !== LANG_EN) continue;
    const e = out.get(r[idKey]) ?? {};
    e[r.local_language_id === LANG_KO ? 'ko' : 'en'] = r.name;
    out.set(r[idKey], e);
  }
  return out;
};

// ---------- 확장에 있는 포켓몬 ----------

function extensionForms() {
  const require = createRequire(import.meta.url);
  const { POKEMON_DATA } = require(join(ROOT, 'extension', 'out', 'common', 'pokemon-data.js'));
  const forms = {};
  for (const [key, d] of Object.entries(POKEMON_DATA)) {
    forms[key] = { species: d.id, gen: d.generation, size: d.originalSpriteSize ?? 32, shiny: (d.possibleColors ?? []).includes('shiny') };
  }
  return forms;
}

// ---------- 울트라썬문 기술 값 ----------

/**
 * moves.csv 는 최신 세대 값이라, 울트라썬문 뒤에 바뀐 값은 move_changelog 로 되돌림.
 * changelog 한 줄 = "그 버전에서 바뀌기 전 값" → 18 뒤의 바뀐 줄 중 가장 이른 것의 값이 울트라썬문 때 값
 */
function usumMoveValues(moves, changelog) {
  const after = changelog
    .filter((r) => Number(r.changed_in_version_group_id) > USUM)
    .sort((a, b) => a.changed_in_version_group_id - b.changed_in_version_group_id);
  const out = new Map(moves.map((m) => [m.id, { ...m, power: num(m.power), pp: num(m.pp), accuracy: num(m.accuracy) }]));
  const done = new Map(); // 칸마다 이미 되돌렸는지
  for (const r of after) {
    const m = out.get(r.move_id);
    if (!m) continue;
    const seen = done.get(r.move_id) ?? new Set();
    for (const [col, key] of [['power', 'power'], ['pp', 'pp'], ['accuracy', 'accuracy'], ['type_id', 'type_id']]) {
      if (r[col] === '' || seen.has(key)) continue;
      m[key] = key === 'type_id' ? r[col] : Number(r[col]);
      seen.add(key);
    }
    done.set(r.move_id, seen);
  }
  return out;
}

// ---------- 만들기 ----------

async function main() {
  const forms = extensionForms();
  const speciesIds = new Set(Object.values(forms).map((f) => String(f.species)));
  const late = [...speciesIds].filter((id) => Number(id) > LAST_USUM_DEX);
  if (late.length) console.warn(`경고: 울트라썬문 뒤의 종 ${late.join(', ')} — 기술표 · 진화가 비어요`);

  const [
    pokemon, species, stats, speciesNames, types, pokemonTypes,
    moves, moveChangelog, moveNames, moveMeta, moveFlagMap, moveFlags, ailments, categories,
    pokemonMoves, evolution, triggers, items, growthRates,
  ] = await Promise.all([
    csv('pokemon'), csv('pokemon_species'), csv('pokemon_stats'), csv('pokemon_species_names'), csv('types'), csv('pokemon_types'),
    csv('moves'), csv('move_changelog'), csv('move_names'), csv('move_meta'), csv('move_flag_map'), csv('move_flags'), csv('move_meta_ailments'), csv('move_meta_categories'),
    csv('pokemon_moves'), csv('pokemon_evolution'), csv('evolution_triggers'), csv('items'), csv('growth_rates'),
  ]);

  const typeName = new Map(types.map((t) => [t.id, t.identifier]));
  const statKey = { 1: 'hp', 2: 'attack', 3: 'defense', 4: 'spAttack', 5: 'spDefense', 6: 'speed' };
  const speciesById = byId(species);
  const pokemonById = byId(pokemon);
  const spName = names(speciesNames, 'pokemon_species_id');
  const growthName = new Map(growthRates.map((g) => [g.id, g.identifier]));

  // 종 (기본 모습 = pokemon id 가 종 번호와 같고 is_default 인 것)
  const speciesOut = {};
  for (const id of [...speciesIds].sort((a, b) => a - b)) {
    const s = speciesById.get(id);
    const p = pokemonById.get(id);
    if (!s || !p) throw new Error(`종 ${id} 데이터가 없음`);
    if (p.species_id !== id || p.is_default !== '1') throw new Error(`pokemon ${id} 가 종 ${id} 의 기본 모습이 아님`);
    const base = {};
    for (const r of stats) if (r.pokemon_id === id) base[statKey[r.stat_id]] = Number(r.base_stat);
    const t = pokemonTypes.filter((r) => r.pokemon_id === id).sort((a, b) => a.slot - b.slot).map((r) => typeName.get(r.type_id));
    speciesOut[id] = {
      name: spName.get(id) ?? {},
      types: t,
      base,
      baseExp: num(p.base_experience) ?? 0,
      captureRate: Number(s.capture_rate),
      growthRate: growthName.get(s.growth_rate_id),
      legendary: s.is_legendary === '1',
      mythical: s.is_mythical === '1',
      baby: s.is_baby === '1',
      evolvesFrom: s.evolves_from_species_id ? Number(s.evolves_from_species_id) : null,
      chain: Number(s.evolution_chain_id),
    };
  }
  // 진화 단계 — 확장에 있고 아기가 아닌 진화 전 종만 셈 (게임 안 기준: 진화 전 그림이 없으면 1단계)
  const preEvolutionOf = (id) => {
    const from = speciesById.get(String(id))?.evolves_from_species_id;
    return from ? Number(from) : null;
  };
  for (const [id, s] of Object.entries(speciesOut)) {
    let stage = 1;
    for (let from = preEvolutionOf(id); from !== null; from = preEvolutionOf(from)) {
      if (speciesIds.has(String(from)) && speciesById.get(String(from)).is_baby !== '1') stage++;
    }
    s.stage = stage;
  }

  // 기술
  const flagName = new Map(moveFlags.map((f) => [f.id, f.identifier]));
  const flagsOf = new Map();
  for (const r of moveFlagMap) {
    if (!flagsOf.has(r.move_id)) flagsOf.set(r.move_id, new Set());
    flagsOf.get(r.move_id).add(flagName.get(r.move_flag_id));
  }
  const metaOf = byId(moveMeta, 'move_id');
  const ailmentName = new Map(ailments.map((a) => [a.id, a.identifier]));
  const categoryName = new Map(categories.map((c) => [c.id, c.identifier]));
  const mvName = names(moveNames, 'move_id');
  const moveById = usumMoveValues(moves, moveChangelog);
  const verdict = new Map();
  const dropped = {};
  const movesOut = {};
  const useMove = (moveId) => {
    if (verdict.has(moveId)) return verdict.get(moveId);
    const m = moveById.get(moveId);
    const meta = metaOf.get(moveId);
    const flags = flagsOf.get(moveId) ?? new Set();
    const v = classifyMove(m, flags, ailmentName.get(meta?.meta_ailment_id), categoryName.get(meta?.meta_category_id));
    verdict.set(moveId, v.keep);
    if (!v.keep) {
      dropped[v.reason] = (dropped[v.reason] ?? 0) + 1;
      return false;
    }
    const hits = averageHits(meta);
    const out = {
      id: Number(moveId),
      key: m.identifier,
      name: mvName.get(moveId) ?? {},
      type: typeName.get(m.type_id),
      class: v.damageClass,
      power: m.power === null ? 0 : (POWER_OVERRIDE[m.identifier] ?? Math.round(m.power * hits)),
      basePower: m.power ?? 0,
      hits: hits === 1 ? null : [num(meta.min_hits), num(meta.max_hits)],
      accuracy: m.accuracy, // null = 반드시 맞음
      pp: m.pp,
      ailment: v.ailment,
      // 변화 기술은 맞으면 걸림 (명중률로 정함), 피해 기술은 ailment_chance
      ailmentChance: v.ailment ? (v.damageClass === 'status' ? 100 : num(meta?.ailment_chance) || 100) : 0,
      drain: num(meta?.drain) ?? 0,
      critRate: num(meta?.crit_rate) ?? 0,
      contact: flags.has('contact'),
    };
    if (MOVE_EFFECTS[m.identifier]) out.effect = MOVE_EFFECTS[m.identifier];
    movesOut[moveId] = out;
    return true;
  };

  // 레벨업 기술표 (울트라썬 · 울트라문) — 기술마다 가장 낮은 레벨 하나만. 레벨 0 = 진화할 때 배우는 기술
  const learnOut = {};
  const rows = pokemonMoves
    .filter((r) => r.version_group_id === String(USUM) && r.pokemon_move_method_id === '1' && speciesIds.has(r.pokemon_id))
    .sort((a, b) => a.level - b.level || (a.order || 0) - (b.order || 0));
  for (const r of rows) {
    if (!useMove(r.move_id)) continue;
    const list = (learnOut[r.pokemon_id] ??= []);
    if (!list.some(([, id]) => id === Number(r.move_id))) list.push([Number(r.level), Number(r.move_id)]);
  }

  // 진화 — 울트라썬문까지의 규칙 · 기본 모습끼리만 (지역 폼 · 뒤 게임의 새 진화 방법은 뺌)
  const triggerName = new Map(triggers.map((t) => [t.id, t.identifier]));
  const itemName = new Map(items.map((i) => [i.id, i.identifier]));
  const evoOut = {};
  let noSprite = 0;
  let notUsum = 0;
  for (const e of evolution) {
    const to = e.evolved_species_id;
    const from = speciesById.get(to)?.evolves_from_species_id;
    if (!from || !speciesIds.has(from)) continue;
    const vg = num(e.version_group_id);
    const formId = (v) => num(v) ?? 0;
    if ((vg !== null && vg > USUM) || e.region_id || formId(e.required_pokemon_form_id) >= 10000 || formId(e.evolved_pokemon_form_id) >= 10000) {
      notUsum++;
      continue;
    }
    // 확장에 그림이 없는 종으로는 진화하지 않음 (그릴 수 없음) — 예: 님피아
    if (!speciesIds.has(to)) {
      noSprite++;
      continue;
    }
    const trigger = triggerName.get(e.evolution_trigger_id);
    const level = num(e.minimum_level);
    const conditions = [];
    if (e.location_id) conditions.push('location');
    if (e.party_species_id || e.party_type_id) conditions.push('party');
    if (e.relative_physical_stats) conditions.push(`stats:${e.relative_physical_stats}`);
    if (e.needs_overworld_rain === '1') conditions.push('rain');
    if (e.turn_upside_down === '1') conditions.push('upside-down');
    if (e.minimum_beauty || e.minimum_affection) conditions.push('beauty-affection');
    if (e.trade_species_id) conditions.push('trade-species');
    const entry = { to: Number(to) };
    let kind;
    if (trigger === 'level-up' && e.minimum_happiness) kind = 'friendship';
    else if (trigger === 'use-item') kind = 'item';
    else if (trigger === 'trade') kind = 'trade';
    else if (trigger === 'level-up' && level !== null && conditions.length === 0 && !e.known_move_id && !e.known_move_type_id && !e.held_item_id) kind = 'level';
    else kind = 'other';
    entry.kind = kind;
    if (level !== null) entry.level = level;
    if (kind === 'item') entry.item = itemName.get(e.trigger_item_id);
    if (e.time_of_day) entry.time = e.time_of_day;
    if (e.gender_id) entry.gender = e.gender_id === '1' ? 'female' : 'male';
    if (e.percentage_chance) entry.chance = Number(e.percentage_chance); // 개무소 → 실쿤 · 카스쿤 반반
    if (e.known_move_id) entry.knownMove = Number(e.known_move_id);
    if (e.known_move_type_id) entry.knownMoveType = typeName.get(e.known_move_type_id);
    if (e.held_item_id) entry.heldItem = itemName.get(e.held_item_id);
    if (conditions.length) entry.conditions = conditions;
    if (kind === 'other') entry.trigger = trigger;
    // PokeAPI 는 세대마다 같은 진화를 여러 줄로 둠 → 같은 것은 한 번
    const list = (evoOut[from] ??= []);
    if (!list.some((x) => JSON.stringify(x) === JSON.stringify(entry))) list.push(entry);
  }

  mkdirSync(OUT, { recursive: true });
  // 맨 위 열쇠마다 한 줄 — 다시 만들었을 때 무엇이 바뀌었는지 diff 로 보이게
  const write = (name, data) => {
    const lines = Object.entries(data).map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`);
    writeFileSync(join(OUT, `${name}.json`), `{\n${lines.join(',\n')}\n}\n`, 'utf8');
  };
  write('forms', forms);
  write('species', speciesOut);
  write('moves', movesOut);
  write('learnsets', learnOut);
  write('evolutions', evoOut);
  write('meta', { source: 'PokeAPI (https://github.com/PokeAPI/pokeapi, BSD-3-Clause)', ref: POKEAPI_REF, versionGroup: 'ultra-sun-ultra-moon' });

  console.log(`포켓몬 모습 ${Object.keys(forms).length} · 종 ${Object.keys(speciesOut).length} · 기술 ${Object.keys(movesOut).length} · 기술표 ${Object.keys(learnOut).length} · 진화 ${Object.keys(evoOut).length}`);
  console.log('뺀 기술:', JSON.stringify(dropped));
  console.log(`뺀 진화: 울트라썬문 밖(지역 폼 · 뒤 게임) ${notUsum} · 그림이 없는 종 ${noSprite}`);
}

await main();
