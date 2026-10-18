// 일반 모드 0.1초 박자 (main-bundle.js 의 everyTick) 검사 — node dev/tick-check.js
// 머리 없는 브라우저에서는 화면 그리기 (rAF) 가 안 돌아 미리보기로는 못 봄 → 함수를 떼어 가짜 rAF 로 돌림
//   📦 넣은 게임 포켓몬 (콜백이 false) 은 빠지고 · 나머지는 계속 돌고 · 박자 줄은 늘 하나
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '..', 'extension', 'media', 'main-bundle.js'), 'utf8').replace(/\r\n/g, '\n');
const code = src.slice(src.indexOf('const tickCallbacks = [];'), src.indexOf('function startAnimations('));
let queue = [];
const document = { body: { classList: { contains: () => false } } };
const api = new Function('requestAnimationFrame', 'document', `${code}\nreturn { everyTick, tickCallbacks };`)((f) => queue.push(f), document);
let now = 0;
const frame = () => {
    now += 100;
    const q = queue;
    queue = [];
    q.forEach((f) => f(now));
};

const counts = { normal: 0, game: 0, late: 0 };
let gone = false;
api.everyTick(() => void counts.normal++);
api.everyTick(() => (gone ? false : void counts.game++));
for (let i = 0; i < 5; i++) frame();
gone = true;
for (let i = 0; i < 5; i++) frame();
assert.deepStrictEqual([counts.normal, counts.game, api.tickCallbacks.length, queue.length], [10, 5, 1, 1], '넣은 포켓몬만 빠지고 박자 줄은 하나');
api.tickCallbacks.length = 0;
api.everyTick(() => void counts.late++);
for (let i = 0; i < 3; i++) frame();
assert.deepStrictEqual([counts.late, queue.length], [3, 1], '모두 빠진 뒤 새로 더해도 박자 줄은 하나');
console.log('박자 검사 통과', JSON.stringify(counts));
