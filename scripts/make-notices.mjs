// 함께 들어 있는 다른 사람의 작품 고지 — extension/THIRD-PARTY-NOTICES.txt (vsix 안에 들어감)
//
//   node scripts/make-notices.mjs      add-pokemon.py 로 포켓몬을 넣은 뒤 · PokeAPI 커밋을 바꾼 뒤 다시
//
// - PMD SpriteCollab 그림 (CC BY-NC 4.0): pokemon.json 의 포켓몬마다 작가 이름 (sprite/<번호>/credits.txt + credit_names.txt)
// - PokeAPI 데이터 (BSD 3-Clause): 고정된 커밋의 LICENSE.md 전문 (src/game/data/generated/meta.json 의 ref)
// - 게임 모드 글꼴 PG Sans = 줄인 Pretendard (SIL OFL 1.1): extension/media/fonts/Pretendard-LICENSE.txt 전문 (scripts/fetch-fonts.mjs · dev/font-subset.py)
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPRITE_BASE = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master';
const CACHE = join(ROOT, '.cache', 'notices');
const OUT = join(ROOT, 'extension', 'THIRD-PARTY-NOTICES.txt');

async function get(url, cacheName) {
  mkdirSync(CACHE, { recursive: true });
  const file = join(CACHE, cacheName);
  if (!existsSync(file)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} 받기 실패: ${res.status}`);
    writeFileSync(`${file}.tmp`, await res.text(), 'utf8');
    renameSync(`${file}.tmp`, file);
  }
  return readFileSync(file, 'utf8');
}

async function main() {
  const added = JSON.parse(readFileSync(join(ROOT, 'pokemon.json'), 'utf8'));
  const koNames = {};
  for (const g of [5, 6]) Object.assign(koNames, JSON.parse(readFileSync(join(ROOT, 'extension', 'l10n', 'pokemon', 'ko', `gen${g}.json`), 'utf8')));
  const meta = JSON.parse(readFileSync(join(ROOT, 'src', 'game', 'data', 'generated', 'meta.json'), 'utf8'));

  // 작가 이름 표: Name \t Discord \t Contact
  const names = new Map();
  for (const line of (await get(`${SPRITE_BASE}/credit_names.txt`, 'credit_names.txt')).split(/\r?\n/).slice(1)) {
    const [name, id] = line.split('\t');
    if (name && id) names.set(id, name);
  }

  // 작가 · 라이선스 한 줄 — dir = sprite/ 아래 폴더 (모습이면 <번호>/<모습>)
  const credit = async (dir, label) => {
    const credits = await get(`${SPRITE_BASE}/sprite/${dir}/credits.txt`, `credits-${dir.replace('/', '-')}.txt`);
    const authors = new Set();
    const licenses = new Set();
    for (const line of credits.split(/\r?\n/)) {
      const [, who, status, license] = line.split('\t');
      if (status !== 'CUR') continue; // 지금 그림에 남아 있는 기여만
      authors.add(names.get(who) ?? who);
      licenses.add(license);
    }
    return `  ${label} — ${[...authors].join(', ')}  [${[...licenses].join(', ')}]\n    https://github.com/PMDCollab/SpriteCollab/tree/master/sprite/${dir}`;
  };
  const sprites = [];
  for (const [key, p] of Object.entries(added).sort((a, b) => a[1].id - b[1].id)) {
    const num = String(p.id).padStart(4, '0');
    sprites.push(await credit(num, `#${num} ${key} (${koNames[key] ?? p.name})`));
  }
  // 필살기 연출에서 잠깐 바꿔 그리는 다른 모습 (add-form.py · pokemon-forms.json — 예: 메가리자몽X)
  const formsPath = join(ROOT, 'pokemon-forms.json');
  const forms = existsSync(formsPath) ? JSON.parse(readFileSync(formsPath, 'utf8')) : {};
  for (const [key, f] of Object.entries(forms).sort((a, b) => a[1].id - b[1].id)) {
    const num = String(f.id).padStart(4, '0');
    sprites.push(await credit(`${num}/${f.form}`, `#${num}/${f.form} ${key} (${f.ko ?? f.name})`));
  }

  const fontLicense = readFileSync(join(ROOT, 'extension', 'media', 'fonts', 'Pretendard-LICENSE.txt'), 'utf8');
  const pokeapiLicense = await get(`https://raw.githubusercontent.com/PokeAPI/pokeapi/${meta.ref}/LICENSE.md`, `pokeapi-license-${meta.ref.slice(0, 12)}.md`);

  const text = `VS Code 포켓몬 (한국어판 수정본) — 함께 들어 있는 다른 사람의 작품
Third-party notices for this extension. 이 파일은 scripts/make-notices.mjs 가 만듦.

이 확장은 비상업 팬 작품이에요. 포켓몬 · 포켓몬 이름 · 캐릭터는 Nintendo / Creatures / GAME FREAK / The Pokémon Company 의 것이고,
이 확장은 그 회사들과 관계가 없어요.
Pokémon and Pokémon character names are trademarks of Nintendo. This is a non-commercial fan project, not affiliated with them.

------------------------------------------------------------
1. 원작 확장 — jakobhoeg/vscode-pokemon (https://github.com/jakobhoeg/vscode-pokemon), CC0 1.0 (LICENSE.txt)
   이 확장은 그 코드를 고친 것이에요.

------------------------------------------------------------
2. 포켓몬 그림 — PMD SpriteCollab (https://github.com/PMDCollab/SpriteCollab)
   CC BY-NC 4.0 — 비상업 용도, 출처 표시 (https://creativecommons.org/licenses/by-nc/4.0/)
   아래 포켓몬의 그림은 SpriteCollab 의 그림 시트를 받아 바꿨어요:
   서 있기 · 걷기 애니메이션만 잘라 GIF 로, 발을 바닥에 맞추고 32×32 또는 64×64 칸에 넣음 (add-pokemon.py · 다른 모습은 add-form.py).
   작가 (credits.txt 의 지금 기여자) · [라이선스 표시]:
${sprites.join('\n')}

------------------------------------------------------------
3. 게임 데이터 — PokeAPI (https://github.com/PokeAPI/pokeapi), BSD 3-Clause
   종족값 · 기술표 · 기술 · 진화 · 포획률 · 한글 이름을 커밋 ${meta.ref} 에서 받아 JSON 으로 바꿨어요 (scripts/fetch-pokeapi.mjs).

${pokeapiLicense.trim()}

------------------------------------------------------------
4. 게임 모드 글꼴 — PG Sans = Pretendard (https://github.com/orioncactus/pretendard) 를 줄인 판, SIL Open Font License 1.1
   media/fonts/PGSansVariable.woff2 — 버전 1.3.9 의 가변 글꼴에서 게임에 나오는 글자와 상용 한글 2,350자만 남김 (글자 모양 · 굵기는 그대로).
   바꾼 판 (Modified Version) 이라 OFL 3조 · Reserved Font Name "Pretendard" 에 따라 글꼴 이름을 "PG Sans" 로 바꿈 (scripts/fetch-fonts.mjs · dev/font-subset.py).
   This font is a subset of Pretendard 1.3.9 (Copyright (c) 2021, Kil Hyung-jin, with Reserved Font Name Pretendard), renamed "PG Sans" as required by the OFL.

${fontLicense.trim()}
`;
  writeFileSync(OUT, text, 'utf8');
  console.log(`THIRD-PARTY-NOTICES.txt — 그림 ${sprites.length}종`);
}

await main();
