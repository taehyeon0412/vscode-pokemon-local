// 게임 모드가 일반 모드 파일에 넣은 패치 (GAME-PATCH) 가 다 남아 있는지 — node dev/game-patch-check.js
// 다른 작업 (필살기 · 기술 고치기, make-moves.py 다시 돌리기) 뒤에 📦 꺼내기 · 게임 중 멈춤 · 저장에서 빼기가 깨지지 않게
// 빠지면 무엇이 빠졌는지 적고 1 로 끝남
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n');
const bundle = read('extension/media/main-bundle.js');
const moves = read('moves.js');
const problems = [];

// 번들이 문법째로 깨지면 일반 모드 패널이 안 뜸 (🎮 도 못 누름)
try {
    new Function(bundle);
} catch (e) {
    problems.push(`main-bundle.js 문법 오류: ${e.message}`);
}

const need = [
    // [파일 이름, 내용, 찾을 글, 하는 일]
    ['moves.js', moves, 'pokemon.gameMoves?.length ? movePick(pokemon.gameMoves) : sigEntry(pokemon.label)', '📦 클릭 = 게임에서 배운 기술'],
    ['moves.js', moves, "document.body.classList.contains('pokemon-game-on')", '게임 모드 중 자동 기술 멈춤'],
    ['main-bundle.js', bundle, 'pokemon.gameMoves?.length ? movePick(pokemon.gameMoves) : sigEntry(pokemon.label)', '번들 안 moves 사본에도 📦 클릭 기술'],
    ['main-bundle.js', bundle, "document.body.classList.contains('pokemon-game-on') /* GAME-PATCH", '번들 안 moves 사본에도 게임 중 자동 기술 멈춤'],
    ['main-bundle.js', bundle, '/* GAME-PATCH: S01 ②', '📦 블록 시작'],
    ['main-bundle.js', bundle, 'function gameTeamMessage(message, ctx)', '📦 팀 맞추기'],
    ['main-bundle.js', bundle, 'function gameGlide(el, dx, dy)', '📦 Lv 표 미끄러짐 (다른 모듈 glideSprite 대신)'],
    ['main-bundle.js', bundle, "case 'game-team': // GAME-PATCH", '📦 메시지 받기'],
    ['main-bundle.js', bundle, "if (!document.body.classList.contains('pokemon-game-on')) {", '게임 모드 중 일반 포켓몬 박자 멈춤'],
    ['main-bundle.js', bundle, 'const dead = tickCallbacks.filter((f) => f() === false);', '넣은 포켓몬 박자 콜백 빼내기'],
    ['main-bundle.js', bundle, 'return false; // GAME-PATCH', '넣은 포켓몬은 박자에서 빠짐'],
    ['main-bundle.js', bundle, 'find((e) => !e.game && e.pokemon.name === message.name)', '🗑 이름으로 지울 때 게임 포켓몬 빼기'],
    ['main-bundle.js', bundle, 'filter((e) => !e.game) /* GAME-PATCH: 📦 게임 포켓몬은 저장 안 함 */', '웹뷰 저장에서 게임 포켓몬 빼기'],
    ['main-bundle.js', bundle, '.filter((e) => !e.game) // GAME-PATCH: 📦 게임 포켓몬은 확장의 저장 목록', 'list-pokemon (동기화) 에서 빼기'],
    ['main-bundle.js', bundle, 'var pokemonToRemove = exports.allPokemon.pokemonCollection.filter((e) => !e.game);', '🗑 모두 지우기는 일반만'],
    ['main-bundle.js', bundle, '.filter((e) => !e.game).forEach((e) => e.remove()); // GAME-PATCH', '처음으로 (reset) 때 게임 팀은 남김'],
];
for (const [file, text, needle, what] of need) {
    if (!text.includes(needle)) problems.push(`${file}: ${what} — "${needle.slice(0, 60)}" 없음`);
}

if (problems.length) {
    console.error(`GAME-PATCH 검사 실패 ${problems.length}개`);
    problems.forEach((p) => console.error(`- ${p}`));
    process.exit(1);
}
console.log(`GAME-PATCH 검사 통과 (${need.length}곳 · 번들 문법)`);
