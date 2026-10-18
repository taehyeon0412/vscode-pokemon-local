// 진화할 때 들어오는 대표 기술 표 (mvp-spec S22 · 9장) — 확장의 대표 기술 이름 (signature-moves.json · moves-data/*.json 의 moves)
// 을 게임 기술 데이터 (src/game/data/generated/moves.json, 한글 이름) 와 짝지어 src/game/data/generated/signature.json 으로.
// 받아 오기 (PokeAPI) 없이 저장소 파일만 읽음 — 대표 기술 · 기술 데이터가 바뀌면 다시 돌림: node scripts/build-signature.mjs
// 변화 기술 · 게임에 없는 기술 (레벨업으로 안 배움 · 거른 기술) 은 빠짐 → 규칙 쪽이 "가장 센 기술" 로 채움
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

const moves = read('src/game/data/generated/moves.json');
const forms = read('src/game/data/generated/forms.json');

/** 확장의 옛 · 연출 이름 → 지금 한글 기술 이름 (단계 2 에서 찾은 옛 표기) */
const ALIAS = {
  화염자동차: '화염바퀴',
  잎사귀날리기: '잎날가르기',
};

const byName = new Map();
for (const m of Object.values(moves)) byName.set(m.name.ko, m);

function namesOf(entry) {
  if (!Array.isArray(entry)) return [];
  // [이름, 틀, 옵션] 하나 또는 [[...], [...]] 여러 개
  if (typeof entry[0] === 'string') return [entry[0]];
  return entry.filter((e) => Array.isArray(e) && typeof e[0] === 'string').map((e) => e[0]);
}

/** 그림 이름 → 대표 기술 이름들 */
const sigNames = new Map();
const add = (key, names) => {
  if (key.startsWith('_')) return;
  const list = sigNames.get(key) ?? [];
  for (const n of names) if (!list.includes(n)) list.push(n);
  sigNames.set(key, list);
};
const gen1 = read('signature-moves.json');
for (const [key, entry] of Object.entries(gen1)) add(key, namesOf(entry));
for (const f of fs.readdirSync(path.join(ROOT, 'moves-data')).filter((x) => x.endsWith('.json')).sort()) {
  const data = read(path.join('moves-data', f));
  for (const [key, v] of Object.entries(data)) if (v && typeof v === 'object' && !key.startsWith('_')) add(key, namesOf(v.moves ?? []));
}

/** 도감 번호 → 기술 번호들 (그 종의 기본 모습 것 먼저, 다른 모습 것은 뒤에) */
const out = {};
let matched = 0;
let names = 0;
const misses = new Map();
const keys = [...sigNames.keys()].sort((a, b) => (a.includes('_') ? 1 : 0) - (b.includes('_') ? 1 : 0) || a.localeCompare(b));
for (const key of keys) {
  const form = forms[key];
  if (!form) continue;
  for (const name of sigNames.get(key)) {
    names++;
    const m = byName.get(ALIAS[name] ?? name);
    if (!m) {
      misses.set(name, (misses.get(name) ?? 0) + 1);
      continue;
    }
    if (m.class === 'status' || m.power <= 0) continue;
    const list = (out[form.species] ??= []);
    if (!list.includes(m.id)) {
      list.push(m.id);
      matched++;
    }
  }
}

const sorted = Object.fromEntries(Object.entries(out).sort((a, b) => Number(a[0]) - Number(b[0])));
fs.writeFileSync(path.join(ROOT, 'src/game/data/generated/signature.json'), JSON.stringify(sorted) + '\n');
console.log(`대표 기술 이름 ${names}개 → 쓸 수 있는 피해 기술 ${matched}개 (${Object.keys(sorted).length}종) · 짝 없음 ${misses.size}종류`);
if (process.argv.includes('--misses')) console.log([...misses.entries()].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n}×${c}`).join(' '));
