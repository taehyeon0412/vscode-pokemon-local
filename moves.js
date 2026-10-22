// 타입별 기술 + 1세대 전용 기술 + 특수 행동 + 드래그 — make-moves.py 가 main-bundle.js 의 handleMouseOver 앞에 표와 같이 넣는다
// POKEMON_MOVES[키] = [기술, 세기, 입 x, 입 y] / 전기는 [기술, 세기, 왼, 위, 오른, 아래] 몸 테두리
//   — 좌표는 오른쪽 보는 걷기 그림 첫 프레임 기준 픽셀, 세기는 종족값 기준 0~1 (클수록 크고 길고 화려하게)
// POKEMON_ACTS[키] = 'fly'(날개 있는 비행 타입 — 패널 2/3 높이로 날아다니다 내려옴) | 'jump'(개굴닌자류 — 멀리뛰기)
// MOVE_SPECIAL[키] = 전용기 (개굴닌자 물수리검 등)
const MOVE_AUTO_AVG_SEC = 20; // 평균 이 초마다 누군가 한 번 저절로 기술
const ACT_AUTO_AVG_SEC = { fly: 25, jump: 12 }; // 평균 이 초마다 해당하는 애 중 하나가
const FLY_HEIGHT = 2 / 3; // 패널 높이 대비
const GLIDE_LAG_MS = 150; // 보이는 그림이 실제 위치를 따라오는 시간 (main-bundle 의 GLIDE_MS)
// 전용기 — chance 확률로 기본 기술 대신. sprite 는 쓰는 동안 바꿀 그림(<색>_<sprite>_8fps.gif),
// 표창은 first ms 뒤부터 every ms 마다 count 개 (던지는 그림 한 바퀴 = 0.42초에 맞춤)
const MOVE_SPECIAL = {
    greninja: { kind: 'shuriken', chance: 0.6, sprite: 'shoot', first: 180, every: 420, count: 3 }, // 물수리검
};

const moveEmitters = [];
// 히트스톱 — 이 시각 (performance.now) 까지 입자가 멈춤 (ult/bridge.js hitStop)
let moveFreezeUntil = 0;
const moveParticles = [];
let moveCanvas;
let moveCtx;
let moveRaf = 0;
let moveLast = 0;
let moveAutoStarted = false;
// 무대 상자 (게임 3:3 필살기 판 — ult/bridge.js, 2026-10-22 orders #95) — { x, y, W, H }: 이 안에서 만든 입자 · 발사기는 상자를 화면으로 알고 그림
// (상자 왼쪽 위 = 0, 0 · 크기 = W × H). 그 입자를 움직이고 그릴 때 상자로 옮김. 없으면 (일반 모드 · 1:1) 그대로
let moveFrame = null;
// 포켓몬 아래 캔버스 (게임 3:3 판 — ult/bridge.js 가 넣음) — 무대 상자 그림의 대상 둘레 밖을 여기에 (없으면 다 위 캔버스)
let moveBackHook = null;
// 상자 시계 차이 (f.skew ms) — 앞 감은 만큼 상자 안에서 보는 performance.now 를 앞당김 (필살기 코드가 시작 때 잡은 시계
// (const t0 = performance.now()) 가 감기 뒤에도 이어지게 — 돌진 · 다이브 · 연타 · 사이코 · 그림자 틀이 처음부터 다시 그리던 것, 코드 리뷰어 #95)
function moveInFrame(f, fn) {
    const prev = moveFrame;
    const skew = (f && f.skew) || 0;
    const undo = skew !== moveSkewNow ? moveSkew(skew) : null;
    moveFrame = f;
    try {
        return fn();
    } finally {
        moveFrame = prev;
        undo?.();
    }
}
let moveSkewNow = 0;
let moveSkewRoot = null;
function moveSkew(skew) {
    const was = moveSkewNow;
    if (was === 0) {
        moveSkewRoot = { own: Object.getOwnPropertyDescriptor(performance, 'now'), base: performance.now.bind(performance) };
    }
    const set = (s) => {
        moveSkewNow = s;
        const r = moveSkewRoot;
        if (s === 0) {
            if (r.own) {
                Object.defineProperty(performance, 'now', r.own);
            } else {
                delete performance.now;
            }
            return;
        }
        Object.defineProperty(performance, 'now', { configurable: true, writable: true, value: () => r.base() + s });
    };
    set(skew);
    return () => set(was);
}

const moveRand = (min, max) => min + Math.random() * (max - min);
const movePick = (list) => list[Math.floor(Math.random() * list.length)];
const spriteSize = (pokemon) => pokemon.calculateSpriteWidth(pokemon._size, pokemon._originalSpriteSize);
const rightEdge = (pokemon) => Math.max(0, window.innerWidth - spriteSize(pokemon));
// 초당 입자 수 — 셀수록 많이
const moveRate = (kind, power) => ({ fire: 70 + 110 * power, water: 55 + 90 * power, electric: 30 + 70 * power, grass: 10 + 20 * power })[kind];

// 정면(서 있기) 그림이면 아무 쪽으로나, 아니면 보던 쪽
function facingLeft(el) {
    if (el.src.includes('_idle_')) {
        return Math.random() < 0.5;
    }
    return el.style.transform.includes('-1') || el.src.includes('_walk_left_');
}

function faceState(state, left) {
    state.horizontalDirection = left ? states_1.HorizontalDirection.left : states_1.HorizontalDirection.right;
    // 왼쪽 그림이 따로 없으면 setAnimation 이 walk 로 바꾸고 좌우를 뒤집음
    state.spriteLabel = left ? 'walk_left' : 'walk';
}

class MoveState {
    label = "swipe" /* States.swipe */;
    frames = 0;
    constructor(left, hold, sprite) {
        faceState(this, left);
        if (sprite) {
            this.spriteLabel = sprite; // 따로 그림이 있는 전용기 — 왼쪽이면 nextFrame 이 좌우를 뒤집음
        }
        this.hold = hold;
    }
    nextFrame() {
        this.frames += 1;
        return this.frames >= this.hold ? states_1.FrameResult.stateComplete : states_1.FrameResult.stateContinue;
    }
}

// 날아올라 좌우로 날아다니다(살짝 출렁) 내려앉음
class FlyState {
    label = "swipe" /* States.swipe */;
    // startBottom 이 있으면 그 높이에서 바로 날기 (드래그로 놓았을 때)
    constructor(pokemon, startBottom) {
        this.pokemon = pokemon;
        this.dir = Math.random() < 0.5 ? -1 : 1;
        const h = spriteSize(pokemon);
        this.top = startBottom ?? Math.max(pokemon.floor + h, window.innerHeight * FLY_HEIGHT - h / 2);
        this.climb = Math.max(2, (this.top - pokemon.floor) / 12); // 1.2초 만에 오르내림
        this.cruise = Math.round(startBottom === undefined ? moveRand(40, 80) : moveRand(15, 30)); // 4~8초, 놓았을 땐 짧게
        this.phase = startBottom === undefined ? 'up' : 'cruise';
        this.t = 0;
        faceState(this, this.dir < 0);
    }
    nextFrame() {
        const p = this.pokemon;
        this.t += 1;
        let x = p.left + this.dir * p.speed * 2.5;
        if (x <= 0 || x >= rightEdge(p)) {
            this.dir = -this.dir;
            faceState(this, this.dir < 0);
            x = Math.min(Math.max(x, 0), rightEdge(p));
        }
        p.positionLeft(x);
        if (this.phase === 'up') {
            p.positionBottom(Math.min(this.top, p.bottom + this.climb));
            if (p.bottom >= this.top) {
                this.phase = 'cruise';
                this.t = 0;
            }
        } else if (this.phase === 'cruise') {
            p.positionBottom(this.top + Math.sin(this.t * 0.35) * 3);
            if (this.t >= this.cruise) {
                this.phase = 'down';
            }
        } else {
            p.positionBottom(Math.max(p.floor, p.bottom - this.climb));
            if (p.bottom <= p.floor) {
                return states_1.FrameResult.stateComplete;
            }
        }
        return states_1.FrameResult.stateContinue;
    }
}

// 포물선으로 몸길이 3~4배 앞으로 폴짝 — 앞이 막혔으면 반대로
class JumpState {
    label = "swipe" /* States.swipe */;
    constructor(pokemon, left) {
        this.pokemon = pokemon;
        const w = spriteSize(pokemon);
        const roomRight = rightEdge(pokemon) - pokemon.left;
        const roomLeft = pokemon.left;
        this.dir = left ? -1 : 1;
        if ((this.dir > 0 ? roomRight : roomLeft) < w * 2) {
            this.dir = -this.dir;
        }
        this.dist = Math.min(w * moveRand(3, 4), this.dir > 0 ? roomRight : roomLeft);
        this.height = w * 0.9;
        this.x0 = pokemon.left;
        this.n = 8;
        this.i = 0;
        faceState(this, this.dir < 0);
    }
    nextFrame() {
        const p = this.pokemon;
        this.i += 1;
        const k = this.i / this.n;
        p.positionLeft(this.x0 + this.dir * this.dist * k);
        p.positionBottom(p.floor + 4 * this.height * k * (1 - k));
        return this.i >= this.n ? states_1.FrameResult.stateComplete : states_1.FrameResult.stateContinue;
    }
}

// 잡혀 있는 동안 — 제자리(움직임은 마우스가), 걷기 그림으로 바둥
class DragState {
    label = "swipe" /* States.swipe */;
    constructor(left) {
        faceState(this, left);
    }
    nextFrame() {
        return states_1.FrameResult.stateContinue;
    }
}

// 놓으면 떨어져서 착지 — 통 튀기는 안 함 (보이는 그림이 한 걸음 늦게 따라와서, 튀면 바닥 닿기 전 공중에서 멈춘 것처럼 보임)
class FallState {
    label = "swipe" /* States.swipe */;
    constructor(pokemon, left) {
        this.pokemon = pokemon;
        this.v = 0;
        this.left = left;
        this.drop = pokemon.bottom - pokemon.floor; // 몸 크기의 3/4 넘게 떨어지면 착지하면서 넘어짐
        faceState(this, left);
    }
    nextFrame() {
        const p = this.pokemon;
        this.v += 3;
        p.positionBottom(Math.max(p.floor, p.bottom - this.v));
        if (p.bottom > p.floor) {
            return states_1.FrameResult.stateContinue;
        }
        if (this.drop > spriteSize(p) * 0.75) {
            p.currentState = new TumbleState(p, this.left);
            return states_1.FrameResult.stateContinue;
        }
        return states_1.FrameResult.stateComplete;
    }
}

// 쿵 넘어졌다 일어남 — 착지 직후 보는 쪽으로 옆으로 눕고(바닥에 닿게 75% 높이를 축으로), 머리 위 별 빙글, 비틀 세우기 · back 이면 뒤로 벌러덩
class TumbleState {
    label = "swipe" /* States.swipe */;
    constructor(pokemon, left, back = false) {
        this.pokemon = pokemon;
        this.frames = 0;
        faceState(this, left);
        const el = pokemon.el;
        const tilt = left !== back ? -90 : 90;
        el.tumbleAnim?.cancel();
        el.style.transformOrigin = '50% 75%';
        el.tumbleAnim = el.animate([
            { rotate: '0deg', offset: 0, easing: 'ease-in' },
            { rotate: `${tilt}deg`, offset: 0.12 },
            { rotate: `${tilt * 0.9}deg`, offset: 0.18 }, // 쿵 — 살짝 튕김
            { rotate: `${tilt}deg`, offset: 0.24 },
            { rotate: `${tilt}deg`, offset: 0.62, easing: 'ease-out' },
            { rotate: `${-tilt * 0.12}deg`, offset: 0.85 }, // 비틀
            { rotate: '0deg', offset: 1 },
        ], { duration: 1500, delay: GLIDE_LAG_MS }); // 그림이 실제로 바닥에 닿은 뒤 넘어짐
        el.tumbleAnim.onfinish = () => {
            el.style.transformOrigin = '';
        };
        setTimeout(() => startDizzy(pokemon, left !== back), GLIDE_LAG_MS + 220);
    }
    nextFrame() {
        this.frames += 1;
        return this.frames >= 17 ? states_1.FrameResult.stateComplete : states_1.FrameResult.stateContinue;
    }
}

// 누운 머리 위로 별 세 개 빙글
function startDizzy(pokemon, left) {
    const rect = pokemon.collision.getBoundingClientRect(); // 그림은 돌아가 있어서 안 도는 클릭 영역 기준
    const w = rect.width;
    const h = rect.height;
    const s = w / (pokemon._originalSpriteSize || 32);
    for (let i = 0; i < 3; i++) {
        moveParticles.push({
            move: 'dizzy', life: 0, max: 1.0, s, vx: 0, vy: 0, g: 0, drag: 0,
            cx: rect.left + (left ? 0.22 : 0.78) * w, cy: rect.top + 0.56 * h, rx: 0.18 * w, ry: 0.07 * h, phase: (i * Math.PI * 2) / 3,
        });
    }
    if (!moveRaf) {
        moveRaf = requestAnimationFrame(moveTick);
    }
}

function startAct(pokemon, act) {
    // 끝나면 swipe 다음 상태(서 있기)로 — 원래 하던 걸로 돌아가면 공중에서 걸을 수 있어서
    pokemon.holdState = undefined;
    pokemon.holdStateEnum = undefined;
    pokemon.currentStateEnum = "swipe" /* States.swipe */;
    pokemon.currentState = act === 'fly' ? new FlyState(pokemon) : new JumpState(pokemon, facingLeft(pokemon.el));
}

function moveCanvasReady() {
    if (!moveCanvas) {
        moveCanvas = document.createElement('canvas');
        // 게임 모드 전투도 이 캔버스에 그림 (ult/bridge.js) — game.css 가 게임 중엔 이 id 로 게임 화면 위로 올림
        moveCanvas.id = 'pokemonFxCanvas';
        // 포켓몬(2) · 공(3) 위, 앞쪽 풀(5) 아래 — CSP 때문에 style 은 속성 하나씩
        moveCanvas.style.position = 'fixed';
        moveCanvas.style.left = '0';
        moveCanvas.style.top = '0';
        moveCanvas.style.margin = '0'; // pokemon.css 의 body>* 위아래 여백(4px)에 밀리지 않게
        moveCanvas.style.width = '100%';
        moveCanvas.style.height = '100%';
        moveCanvas.style.pointerEvents = 'none';
        moveCanvas.style.zIndex = '4';
        document.body.appendChild(moveCanvas);
        moveCtx = moveCanvas.getContext('2d');
    }
    // 게임 모드 전투는 캔버스를 전투 판의 연출 층 (HUD 아래) 으로 옮겨 씀 (ult/bridge.js mount) — 게임이 아니거나 떨어져 나갔으면 body 로 되돌림 (일반 모드 연출이 안 보이는 일 없게)
    if (moveCanvas.parentNode !== document.body && (!moveCanvas.isConnected || !document.body.classList.contains('pokemon-game-on'))) {
        document.body.appendChild(moveCanvas);
    }
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(window.innerWidth * dpr);
    const h = Math.round(window.innerHeight * dpr);
    if (moveCanvas.width !== w || moveCanvas.height !== h) {
        moveCanvas.width = w;
        moveCanvas.height = h;
    }
    moveCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// 번개 한 줄기 — angle 쪽으로 가면서 옆으로 한 칸씩 꺾임
function boltPath(angle, steps, x = 0, y = 0) {
    const points = [];
    for (let i = 0; i < steps; i++) {
        x += Math.cos(angle);
        y += Math.sin(angle);
        if (i % 2 === 1) {
            const side = movePick([-1, 1]);
            x += -Math.sin(angle) * side;
            y += Math.cos(angle) * side;
        }
        points.push([x, y]);
    }
    return points;
}

function spawnParticle(e) {
    const s = e.s;
    const P = e.power;
    const p = { move: e.move, x: e.x, y: e.y, life: 0, s, vx: 0, vy: 0, g: 0, drag: 0 };
    switch (e.move) {
        case 'fire':
            if (Math.random() < 0.25 * P) {
                // 불똥 — 더 멀리 튀다가 떨어짐
                p.move = 'ember';
                p.vx = e.dir * moveRand(50, 80) * (1 + 0.5 * P) * s;
                p.vy = moveRand(-20, -5) * s;
                p.g = 25 * s;
                p.drag = 1.2;
                p.max = moveRand(0.5, 0.9);
                p.color = movePick(['#ffe680', '#ffb347']);
                break;
            }
            p.vx = e.dir * moveRand(28, 48) * (1 + 0.8 * P) * s;
            p.vy = moveRand(-10, 6) * (1 + 0.6 * P) * s;
            p.g = -14 * s; // 불은 위로 뜸
            p.drag = 2.6 - P;
            p.max = moveRand(0.35, 0.6) * (1 + 0.7 * P);
            p.grow = 2 + 2.5 * P;
            break;
        case 'water':
            p.vx = e.dir * moveRand(55, 78) * (1 + 0.6 * P) * s;
            p.vy = moveRand(-16, -4) * s;
            p.g = 130 * (1 - 0.3 * P) * s;
            p.drag = 0.4;
            p.max = moveRand(0.5, 0.8) * (1 + 0.4 * P);
            p.color = movePick(['#e8f7ff', '#8fd3ff', '#8fd3ff', '#3fa2f0']);
            p.size = Math.random() < 0.2 + 0.5 * P ? (P > 0.6 ? 3 : 2) : 1;
            break;
        case 'electric': {
            // 몸 둘레(타원) 안쪽에서 바깥으로 튐 — 셀수록 넓고 길고 갈라짐
            const angle = moveRand(0, Math.PI * 2);
            const reach = 1 + 0.5 * P;
            p.x = e.cx + Math.cos(angle) * e.rx * 0.75 * reach;
            p.y = e.cy + Math.sin(angle) * e.ry * 0.75 * reach;
            p.max = moveRand(0.08, 0.16);
            p.path = boltPath(angle + moveRand(-0.4, 0.4), Math.floor(moveRand(3, 7) + 6 * P));
            if (Math.random() < P) {
                const [mx, my] = p.path[Math.floor(p.path.length / 2)];
                p.path = p.path.concat(boltPath(angle + movePick([-0.9, 0.9]), Math.ceil(p.path.length / 2), mx, my));
            }
            p.thick = P > 0.6 && Math.random() < 0.5;
            break;
        }
        case 'flash':
            // 몸 둘레로 번쩍 퍼지는 고리
            Object.assign(p, { cx: e.cx, cy: e.cy, rx: e.rx * (1 + 0.5 * P), ry: e.ry * (1 + 0.5 * P), max: 0.25 });
            break;
        case 'shuriken':
            // 빙글 돌며 일직선으로 — 셀수록 크고 빠름
            p.dir = e.dir;
            p.vx = e.dir * (120 + 60 * P) * s;
            p.vy = moveRand(-6, 6) * s;
            p.max = 1.6;
            p.arm = P > 0.6 ? 3 : 2;
            break;
        case 'grass':
            p.vx = e.dir * moveRand(40, 60) * (1 + 0.5 * P) * s;
            p.vy = moveRand(-8, 8) * (1 + 0.5 * P) * s;
            p.drag = 0.2;
            p.max = moveRand(0.7, 1.0) * (1 + 0.5 * P);
            p.phase = moveRand(0, Math.PI * 2);
            p.color = movePick(['#8be04e', '#4cae3c', '#2f7d32']);
            p.big = P > 0.55 && Math.random() < 0.6;
            break;
    }
    moveParticles.push(p);
}

function drawParticle(ctx, p) {
    const s = p.s;
    const t = p.life / p.max;
    // 도트 느낌 — 그림 픽셀 칸에 맞춰 찍음
    const px = (v) => Math.round(v / s) * s;
    if (p.draw) {
        p.draw(ctx, p, t, px);
        return;
    }
    switch (p.move) {
        case 'fire': {
            const colors = ['#fff6b3', '#ffc93c', '#ff7a21', '#d9381e'];
            const size = s * Math.round(1 + t * p.grow);
            if (t < 0.88) {
                ctx.globalAlpha = 1;
                ctx.fillStyle = colors[Math.min(3, Math.floor(t / 0.22))];
            } else {
                ctx.globalAlpha = (1 - t) / 0.12;
                ctx.fillStyle = '#7a7a7a';
            }
            ctx.fillRect(px(p.x - size / 2), px(p.y - size / 2), size, size);
            break;
        }
        case 'ember':
            ctx.globalAlpha = t < 0.7 ? 1 : (1 - t) / 0.3;
            ctx.fillStyle = p.color;
            ctx.fillRect(px(p.x), px(p.y), s, s);
            break;
        case 'water': {
            const size = s * p.size;
            ctx.globalAlpha = t < 0.7 ? 1 : (1 - t) / 0.3;
            ctx.fillStyle = p.color;
            ctx.fillRect(px(p.x), px(p.y), size, size);
            break;
        }
        case 'electric':
            ctx.globalAlpha = 1;
            p.path.forEach(([x, y], i) => {
                ctx.fillStyle = i < 2 ? '#ffffff' : '#ffe53b';
                ctx.fillRect(px(p.x + x * s), px(p.y + y * s), p.thick ? s * 2 : s, s);
            });
            break;
        case 'shuriken': {
            // + 모양과 x 모양을 번갈아 그려서 도는 것처럼
            const plus = Math.floor(p.life / 0.05) % 2 === 0;
            const dot = (dx, dy, color) => {
                ctx.fillStyle = color;
                ctx.fillRect(px(p.x + dx * s), px(p.y + dy * s), s, s);
            };
            ctx.globalAlpha = 1;
            for (const [ax, ay] of plus ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
                for (let k = 1; k <= (plus ? p.arm : p.arm - 1); k++) {
                    dot(ax * k, ay * k, k === 1 ? '#cdefff' : k < p.arm ? '#8fd3ff' : '#3fa2f0');
                }
            }
            for (const [ax, ay] of plus ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                dot(ax, ay, '#8fd3ff');
            }
            dot(0, 0, '#ffffff');
            break;
        }
        case 'dizzy': {
            const dot = (dx, dy, color) => {
                ctx.fillStyle = color;
                ctx.fillRect(px(p.x + dx * s), px(p.y + dy * s), s, s);
            };
            ctx.globalAlpha = t < 0.8 ? 1 : (1 - t) / 0.2;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                dot(dx, dy, '#ffd23f');
            }
            dot(0, 0, '#fff7c2');
            break;
        }
        case 'trail':
            ctx.globalAlpha = 1 - t;
            ctx.fillStyle = '#8fd3ff';
            ctx.fillRect(px(p.x), px(p.y), s, s);
            break;
        case 'flash': {
            const grow = 1 + 0.4 * t;
            const dots = Math.max(16, Math.round((p.rx + p.ry) / s));
            ctx.globalAlpha = 1 - t;
            ctx.fillStyle = '#fff9c4';
            for (let i = 0; i < dots; i++) {
                const a = (i / dots) * Math.PI * 2;
                ctx.fillRect(px(p.cx + Math.cos(a) * p.rx * grow), px(p.cy + Math.sin(a) * p.ry * grow), s, s);
            }
            break;
        }
        case 'grass': {
            // 가로 · 세로를 번갈아 그려서 빙글 도는 것처럼
            const flat = Math.floor(p.life / 0.08) % 2 === 0;
            const long = p.big ? 3 : 2;
            const short = p.big ? 2 : 1;
            ctx.globalAlpha = t < 0.8 ? 1 : (1 - t) / 0.2;
            ctx.fillStyle = p.color;
            ctx.fillRect(px(p.x), px(p.y), (flat ? long : short) * s, (flat ? short : long) * s);
            break;
        }
    }
}

function moveTick(now) {
    // 한 장 사이 시간 — 0.25초까지는 실제 시간대로 (2026-10-19: 0.05초로 막았더니 VS Code 가 초당 20장 아래로 느려지면
    // 필살기 장면이 실제 시간보다 몇 초씩 늦어져, 타이머로 먼저 다시 보인 진짜 그림과 아직 그려지는 그림이 둘로 보이고 순간이동처럼 보였음)
    const gap = moveLast ? (now - moveLast) / 1000 : 0;
    // 패널이 가려져 그리기가 멈춰 있다 돌아옴 — 그사이 필살기가 끝났으면 남은 효과는 버림 (진짜 그림과 겹쳐 보이지 않게)
    if (gap > 1.5 && !ultActive) {
        moveParticles.length = 0;
        moveEmitters.length = 0;
    }
    // 히트스톱 (게임 전투 — ult/bridge.js hitStop) 동안은 움직이지 않고 그리기만
    const dt = now < moveFreezeUntil ? 0 : Math.min(0.25, gap);
    moveLast = now;
    moveCanvasReady();
    const ctx = moveCtx;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    moveStep(now, dt, null);
    // 무대 상자 입자는 상자마다 따로 그린 뒤 가장자리를 흐려 깖 (moveFrameLayer)
    const frames = new Set();
    // 그리기 — 층(z) 순서: z<0 맨 밑 → 보통(나중 것부터 그려서 먼저 만든 게 위) → z>0 맨 위
    for (const layer of [-1, 0, 1]) {
        for (let i = moveParticles.length - 1; i >= 0; i--) {
            const p = moveParticles[i];
            const z = p.z ?? 0;
            if ((z < 0 ? -1 : z > 0 ? 1 : 0) !== layer || p.life >= p.max) {
                continue;
            }
            const f = p._f;
            let c = ctx;
            try {
                if (f) {
                    // 무대 상자 입자 — 상자 그림판에 상자 자리로 옮겨 그림 (그동안 상자를 화면으로)
                    if (!frames.has(f)) {
                        frames.add(f);
                        moveFrameLayer(f);
                    }
                    c = f.ctx;
                    c.save();
                    c.translate(f.x, f.y);
                    moveInFrame(f, () => drawParticle(c, p));
                } else {
                    drawParticle(ctx, p);
                }
            } catch (err) {
                moveFault(err);
                p.life = p.max;
                c.globalCompositeOperation = 'source-over';
            } finally {
                if (f && c !== ctx) {
                    c.restore();
                }
            }
        }
    }
    ctx.globalAlpha = 1;
    for (const f of frames) {
        moveFramePut(ctx, f);
    }

    if (moveEmitters.length || moveParticles.length) {
        moveRaf = requestAnimationFrame(moveTick);
    } else {
        moveRaf = 0;
        moveLast = 0;
    }
}

// 무대 상자 그림판 — 화면과 같은 크기 · 장마다 비움
function moveFrameLayer(f) {
    const dpr = window.devicePixelRatio || 1;
    const w = moveCanvas.width;
    const h = moveCanvas.height;
    if (!f.cv) {
        f.cv = document.createElement('canvas');
        // 장마다 읽음 (moveFrameDither — 반투명을 바둑판으로)
        f.ctx = f.cv.getContext('2d', { willReadFrequently: true });
    }
    if (f.cv.width !== w || f.cv.height !== h) {
        f.cv.width = w;
        f.cv.height = h;
        f.mask = null;
    }
    f.ctx.setTransform(1, 0, 0, 1, 0, 0);
    f.ctx.globalCompositeOperation = 'source-over';
    f.ctx.globalAlpha = 1;
    // 상자 영역만 비움 · 넣음 (밖은 마스크가 0 이라 안 씀 — 매 장면 화면 전체를 세 번 거치던 것, 코드 리뷰어)
    const r = moveFrameRect(f);
    f.ctx.clearRect(r.x, r.y, r.w, r.h);
    f.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
// 상자 영역 (기기 px) — 왼쪽 · 위 · 폭 · 화면 아래 끝까지 (모양이 있으면 그 모양들을 품는 네모)
function moveFrameRect(f) {
    const dpr = window.devicePixelRatio || 1;
    if (f.shapes && f.shapes.length) {
        const b = moveFrameBox(f);
        const x = Math.max(0, Math.floor(b.x0 * dpr));
        const y = Math.max(0, Math.floor(b.y0 * dpr));
        return { x, y, w: Math.max(1, Math.min(f.cv.width - x, Math.ceil((b.x1 - b.x0) * dpr) + 1)), h: Math.max(1, Math.min(f.cv.height - y, Math.ceil((b.y1 - b.y0) * dpr) + 1)) };
    }
    const x = Math.max(0, Math.floor(f.x * dpr));
    const y = Math.max(0, Math.floor(Math.min(f.y, f.maskTop ?? f.y) * dpr));
    return { x, y, w: Math.max(1, Math.min(f.cv.width - x, Math.ceil(f.W * dpr))), h: Math.max(1, f.cv.height - y) };
}
// 모양들을 품는 네모 (화면 px)
function moveFrameBox(f) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const s of f.shapes) {
        const r = s.kind === 'seg' ? s.r : 0;
        const ax = s.kind === 'seg' ? Math.min(s.x0, s.x1) - r : s.cx - s.rx;
        const bx = s.kind === 'seg' ? Math.max(s.x0, s.x1) + r : s.cx + s.rx;
        const ay = s.kind === 'seg' ? Math.min(s.y0, s.y1) - r : s.cy - s.ry;
        const by = s.kind === 'seg' ? Math.max(s.y0, s.y1) + r : s.cy + s.ry;
        x0 = Math.min(x0, ax);
        x1 = Math.max(x1, bx);
        y0 = Math.min(y0, ay);
        y1 = Math.max(y1, by);
    }
    return { x0: Math.max(0, x0), y0: Math.max(0, y0), x1, y1 };
}
// 그 점이 모양 안으로 들어간 깊이 (px — 음수 = 밖) · 여럿이면 가장 깊은 것
function moveShapeDepth(shapes, px, py) {
    let best = -Infinity;
    for (const s of shapes) {
        let e;
        if (s.kind === 'seg') {
            const vx = s.x1 - s.x0;
            const vy = s.y1 - s.y0;
            const L2 = vx * vx + vy * vy || 1;
            const t = Math.max(0, Math.min(1, ((px - s.x0) * vx + (py - s.y0) * vy) / L2));
            e = s.r - Math.hypot(px - (s.x0 + vx * t), py - (s.y0 + vy * t));
        } else {
            const dx = (px - s.cx) / s.rx;
            const dy = (py - s.cy) / s.ry;
            e = (1 - Math.sqrt(dx * dx + dy * dy)) * Math.min(s.rx, s.ry);
        }
        if (e > best) {
            best = e;
        }
    }
    return best;
}
// 상자 가장자리 — 그림 점 (S) 칸 (옆 6 · 위 10줄) 에 걸쳐 바둑판 (4×4 Bayer) 으로 사그라짐 (흐린 그라데이션 대신 픽셀 — 디자인 규칙) · 아래 끝은 그대로 (땅에 닿는 것)
const MOVE_BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function moveFrameMask(f) {
    if (f.mask) {
        return f.mask;
    }
    const dpr = window.devicePixelRatio || 1;
    const m = document.createElement('canvas');
    m.width = moveCanvas.width;
    m.height = moveCanvas.height;
    const mc = m.getContext('2d');
    const S = Math.max(1, f.S || 2);
    // 타원 (상자 아래 끝 가운데 · 가로 반지름 = 폭 반 · 세로 = 높이 — 위로 둥근 돔) 안쪽만 · 바깥 4px 씩 50% · 25% 바둑판
    // (네모 상자 변이 곧은 바둑판으로 보이던 것 — 아트 디렉터 #95 ①) · 아래 끝 밑 (땅) 은 같은 폭으로 화면 끝까지
    mc.setTransform(dpr, 0, 0, dpr, 0, 0);
    mc.fillStyle = '#fff';
    // f.shapes = 보이는 곳 (통로 seg · 타원 ell — 화면 px) 의 합 — 3:3 판은 쓰는 입 → 대상 통로 + 대상 둘레 + 입 앞만 (불벽 · 큰 호 · 빛 기둥 · 바닥 줄이 무대를 덮던 것, 아트 디렉터 #95 2바퀴)
    if (f.shapes && f.shapes.length) {
        const b = moveFrameBox(f);
        // 앞 모양 (front — 대상 둘레) 마스크 · 뒤 마스크 (= 전체 − 앞) — 앞은 포켓몬 위 캔버스 · 뒤는 포켓몬 아래 (moveFramePut)
        const fronts = f.shapes.filter((s) => s.front);
        let fm = null;
        let fc = null;
        if (fronts.length) {
            fm = document.createElement('canvas');
            fm.width = m.width;
            fm.height = m.height;
            fc = fm.getContext('2d');
            fc.setTransform(dpr, 0, 0, dpr, 0, 0);
            fc.fillStyle = '#fff';
        }
        const lvlOf = (e) => (e >= 8 ? 16 : e >= 4 ? 8 : 4);
        for (let y = Math.floor(b.y0 / S) * S; y < b.y1; y += S) {
            for (let x = Math.floor(b.x0 / S) * S; x < b.x1; x += S) {
                // 가장자리를 칸마다 ±4px 흔듦 — 곧은 바둑판 변이 네모로 읽히던 것 (불꽃 혀처럼 들쭉날쭉 — 아트 디렉터 #95 2바퀴)
                const jag = ((((Math.floor(x / S) * 73856093) ^ (Math.floor(y / S) * 19349663)) >>> 0) % 3) * 4 - 4;
                const bay = MOVE_BAYER[(Math.floor(x / S) & 3) + (Math.floor(y / S) & 3) * 4];
                const e = moveShapeDepth(f.shapes, x + S / 2, y + S / 2) + jag;
                if (e >= 0 && bay < lvlOf(e)) {
                    mc.fillRect(x, y, S, S);
                }
                if (fc) {
                    const ef = moveShapeDepth(fronts, x + S / 2, y + S / 2) + jag;
                    if (ef >= 0 && bay < lvlOf(ef)) {
                        fc.fillRect(x, y, S, S);
                    }
                }
            }
        }
        if (fm) {
            const bm = document.createElement('canvas');
            bm.width = m.width;
            bm.height = m.height;
            const bc = bm.getContext('2d');
            bc.drawImage(m, 0, 0);
            bc.globalCompositeOperation = 'destination-out';
            bc.drawImage(fm, 0, 0);
            f.maskFront = fm;
            f.maskBack = bm;
        }
        f.mask = m;
        return m;
    }
    const cx0 = f.x + f.W / 2;
    const cy0 = f.y + f.H;
    const top = Math.min(f.y, f.maskTop ?? f.y);
    const rx = Math.max(1, f.W / 2);
    const ry = Math.max(1, cy0 - top);
    const H0 = m.height / dpr;
    const rmin = Math.min(rx, ry);
    for (let y = Math.floor(top / S) * S; y < H0; y += S) {
        for (let x = Math.floor(f.x / S) * S; x < f.x + f.W; x += S) {
            const dx = (x + S / 2 - cx0) / rx;
            const dy = Math.min(0, y + S / 2 - cy0) / ry;
            const e = (1 - Math.sqrt(dx * dx + dy * dy)) * rmin;
            if (e < 0) {
                continue;
            }
            const lvl = e >= 8 ? 16 : e >= 4 ? 8 : 4;
            if (MOVE_BAYER[(Math.floor(x / S) & 3) + (Math.floor(y / S) & 3) * 4] < lvl) {
                mc.fillRect(x, y, S, S);
            }
        }
    }
    f.mask = m;
    return m;
}
// 바둑판 무늬 (지울 칸 — Bayer < lvl) · 칸 = S 그림 점 (기기 px 로) — 칸 · 단마다 하나
const MOVE_BAYER_PAT = new Map();
function moveBayerPattern(ctx, S, lvl) {
    const dpr = window.devicePixelRatio || 1;
    const key = `${S}:${lvl}:${dpr}`;
    let p = MOVE_BAYER_PAT.get(key);
    if (!p) {
        const c = Math.max(1, Math.round(S * dpr));
        const t = document.createElement('canvas');
        t.width = c * 4;
        t.height = c * 4;
        const tc = t.getContext('2d');
        tc.fillStyle = '#000';
        for (let i = 0; i < 16; i++) {
            if (MOVE_BAYER[i] < lvl) {
                tc.fillRect((i % 4) * c, Math.floor(i / 4) * c, c, c);
            }
        }
        p = ctx.createPattern(t, 'repeat');
        MOVE_BAYER_PAT.set(key, p);
    }
    return p;
}
// 상자 그림을 가장자리를 흐려 연출 밑에 깖 (다른 연출 — 맞음 · 쓰러짐 별빛 — 이 위)
function moveFramePut(ctx, f) {
    const mask = moveFrameMask(f);
    const r = moveFrameRect(f);
    // 계단 (f.stair — 1:1 연출을 대상 줄로, bridge fxUltAim) — 마스크 앞에 (통로 · 대상 둘레는 대상 쪽이라)
    if (f.stair && f.stair.dy) {
        moveFrameStair(f, r);
    }
    moveFrameDither(f, r);
    // f.drop = 바둑판으로 지울 단 (0 ~ 16 — 쓰러짐 옅게 · 끝 흐려짐, bridge fxStageSoft · fxStageCut) · 반투명 (globalAlpha) 대신 (반투명 조각 · 유령 — 아트 디렉터 #95 ②)
    if (f.drop > 0) {
        f.ctx.save();
        f.ctx.setTransform(1, 0, 0, 1, 0, 0);
        f.ctx.globalCompositeOperation = 'destination-out';
        f.ctx.fillStyle = moveBayerPattern(f.ctx, Math.max(1, f.S || 2), Math.min(16, f.drop));
        f.ctx.fillRect(r.x, r.y, r.w, r.h);
        f.ctx.restore();
    }
    // 뒤 · 앞 나눔 — 대상 둘레 (앞 마스크) 만 위 캔버스 · 나머지는 포켓몬 아래 캔버스 (moveBackHook) · 자기 둘레 (allBack) 는 다 아래
    const back = (f.maskBack || f.allBack) && typeof moveBackHook === 'function' ? moveBackHook() : null;
    if (back) {
        let src = f.cv;
        if (!f.allBack) {
            if (!f.cvB || f.cvB.width !== f.cv.width || f.cvB.height !== f.cv.height) {
                f.cvB = document.createElement('canvas');
                f.cvB.width = f.cv.width;
                f.cvB.height = f.cv.height;
            }
            const cb = f.cvB.getContext('2d');
            cb.setTransform(1, 0, 0, 1, 0, 0);
            cb.globalCompositeOperation = 'source-over';
            cb.globalAlpha = 1;
            cb.clearRect(r.x, r.y, r.w, r.h);
            cb.drawImage(f.cv, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
            cb.globalCompositeOperation = 'destination-in';
            cb.drawImage(f.maskBack, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
            src = f.cvB;
        } else {
            f.ctx.save();
            f.ctx.setTransform(1, 0, 0, 1, 0, 0);
            f.ctx.globalCompositeOperation = 'destination-in';
            f.ctx.globalAlpha = 1;
            f.ctx.drawImage(mask, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
            f.ctx.restore();
        }
        back.save();
        back.globalCompositeOperation = 'source-over';
        back.globalAlpha = 1;
        back.imageSmoothingEnabled = false;
        back.drawImage(src, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
        back.restore();
        if (f.allBack) {
            return;
        }
    }
    f.ctx.save();
    f.ctx.setTransform(1, 0, 0, 1, 0, 0);
    f.ctx.globalCompositeOperation = 'destination-in';
    f.ctx.globalAlpha = 1;
    f.ctx.drawImage(back ? f.maskFront : mask, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
    f.ctx.restore();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'destination-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(f.cv, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
    ctx.restore();
}

// 계단 — 입 (x0) 뒤는 그대로 · 앞은 열 u (2칸) 마다 기울기 (dy / dx) 만큼 u 단위로 옮김 (돌린 그림 대신 칸 계단 — 픽셀 그대로, 합동 줄기 fxStairBlit 과 같은 문법).
// 1:1 은 같은 땅 높이라 가로로 쏘는데 3:3 은 상대 줄이 달라 허공에서 터지던 것 (아트 디렉터 #95 4바퀴 ③)
function moveFrameStair(f, r) {
    const s = f.stair;
    const dpr = window.devicePixelRatio || 1;
    if (!f.cv2 || f.cv2.width !== f.cv.width || f.cv2.height !== f.cv.height) {
        f.cv2 = document.createElement('canvas');
        f.cv2.width = f.cv.width;
        f.cv2.height = f.cv.height;
    }
    const c2 = f.cv2.getContext('2d');
    c2.setTransform(1, 0, 0, 1, 0, 0);
    c2.globalCompositeOperation = 'source-over';
    c2.globalAlpha = 1;
    c2.clearRect(r.x, r.y, r.w, r.h);
    c2.drawImage(f.cv, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
    const c = f.ctx;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    c.imageSmoothingEnabled = false;
    c.clearRect(r.x, r.y, r.w, r.h);
    // 열 = 그림 칸 한 칸 · 화면 칸 격자에 맞춤 (2칸 열이 칸 격자와 어긋나 물줄기 눈금이 1px 조각으로 쪼개져 위아래로 튀어나오던 것 — 아트 디렉터 #95 6바퀴 ③) · 높이는 2칸 (u) 계단
    const U = Math.max(1, Math.round((f.S || 2) * dpr));
    const x0 = Math.floor(r.x / U) * U;
    for (let x = x0; x < r.x + r.w; x += U) {
        const a = Math.max(x, r.x);
        const w = Math.min(x + U, r.x + r.w) - a;
        if (w <= 0) {
            continue;
        }
        const t = ((x + U / 2) / dpr - s.x0) / s.dx;
        const dy = t <= 0 ? 0 : Math.round((s.dy * t) / s.u) * s.u;
        c.drawImage(f.cv2, a, r.y, w, r.h, a, r.y + Math.round(dy * dpr), w, r.h);
    }
    c.restore();
}
// 반투명 → 1칸 바둑판 (알파 단 = 4×4 Bayer · 그림 칸 격자) — 3:3 용 판은 1:1 연출의 반투명 물기둥 · 빛 구슬 · 원판이 뒤 포켓몬을 비쳐 팔레트 밖 색이 되던 것 (아트 디렉터 #95 6바퀴 ⑧ · 태현 님 ⑨ 반투명 원판).
// 아주 옅은 것 (3/16 아래) 은 지움 — 넓은 옅은 빛이 흩어진 점이 되지 않게
const MOVE_DITHER_MIN = 3;
function moveFrameDither(f, r) {
    const dpr = window.devicePixelRatio || 1;
    const c = Math.max(1, Math.round((f.S || 2) * dpr));
    let img;
    try {
        img = f.ctx.getImageData(r.x, r.y, r.w, r.h);
    } catch {
        return;
    }
    const d = img.data;
    let changed = false;
    for (let y = 0; y < r.h; y++) {
        const by = (Math.floor((r.y + y) / c) & 3) * 4;
        let i = y * r.w * 4 + 3;
        for (let x = 0; x < r.w; x++, i += 4) {
            const a = d[i];
            if (a === 0 || a === 255) {
                continue;
            }
            const lvl = Math.round((a * 16) / 255);
            d[i] = lvl >= MOVE_DITHER_MIN && MOVE_BAYER[(Math.floor((r.x + x) / c) & 3) + by] < lvl ? 255 : 0;
            changed = true;
        }
    }
    if (changed) {
        f.ctx.putImageData(img, r.x, r.y);
    }
}

// 앞 감기 (게임 3:3 필살기 판) — 그 상자 (f) 의 입자 · 발사기만 sec 초를 그리지 않고 움직임 (1/30초씩 · tick(지난 초) 은 걸음마다).
// 발사기 시각 (until · nextShot) 은 감은 만큼 당겨 둠 — 감는 동안 performance.now 를 같이 앞당기는 건 부르는 쪽 (bridge)
function moveSeek(f, sec, tick) {
    const now = performance.now();
    let done = 0;
    while (done < sec - 1e-6) {
        const dt = Math.min(1 / 30, sec - done);
        done += dt;
        // 상자 시계를 감은 만큼 앞당김 — 발사기 · 장면 시각 · 타이머가 같은 시계 (moveInFrame · moveStep)
        f.skew = done * 1000;
        moveStep(now, dt, f);
        tick?.(done);
    }
    f.skew = sec * 1000;
}

// 한 걸음 — 발사기 · 입자 움직이기 (only = 그 무대 상자 것만 · null 이면 모두)
function moveStep(now0, dt, only) {
    for (let i = moveEmitters.length - 1; i >= 0; i--) {
        const e = moveEmitters[i];
        if (only && e._f !== only) {
            continue;
        }
        // 상자 발사기는 상자 시계로 (감은 만큼 앞 — moveSeek)
        const now = now0 + (e._f && e._f.skew ? e._f.skew : 0);
        if (now >= e.until) {
            moveEmitters.splice(i, 1);
            continue;
        }
        if (e.fx) {
            // 전용기 발사기 — 정해진 시각마다 shots 개, 아니면 초당 rate 개 (무대 상자 발사기는 그 상자 안에서)
            moveInFrame(e._f ?? null, () => {
                if (e.shots !== undefined) {
                    while (e.shots > 0 && now >= e.nextShot) {
                        if (!safeFx(e, () => e.fx(e, e.shot++))) {
                            break;
                        }
                        e.shots -= 1;
                        e.nextShot += e.every;
                    }
                } else {
                    e.acc += dt * e.rate;
                    while (e.acc >= 1) {
                        e.acc -= 1;
                        if (!safeFx(e, () => e.fx(e))) {
                            break;
                        }
                    }
                }
            });
            continue;
        }
        if (e.move === 'shuriken') {
            if (e.shots > 0 && now >= e.nextShot) {
                spawnParticle(e);
                e.shots -= 1;
                e.nextShot += e.every;
            }
            continue;
        }
        if (e.nextFlash && now >= e.nextFlash) {
            spawnParticle({ ...e, move: 'flash' });
            e.nextFlash = e.power > 0.75 ? now + 300 : 0;
        }
        e.acc += dt * moveRate(e.move, e.power);
        while (e.acc >= 1) {
            e.acc -= 1;
            spawnParticle(e);
        }
    }
    for (let i = moveParticles.length - 1; i >= 0; i--) {
        const p = moveParticles[i];
        if (only && p._f !== only) {
            continue;
        }
        p.life += dt;
        if (p.life >= p.max) {
            moveParticles.splice(i, 1);
            continue;
        }
        const keep = Math.exp(-p.drag * dt);
        p.vx *= keep;
        p.vy = p.vy * keep + p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.move === 'grass') {
            p.y += Math.sin(p.phase + p.life * 14) * p.s * 0.6;
        }
        try {
            if (p.update) {
                if (p._f) {
                    moveInFrame(p._f, () => p.update(p, dt));
                } else {
                    p.update(p, dt);
                }
            }
        } catch (err) {
            moveFault(err);
            p.life = p.max;
        }
        if (p.move === 'dizzy') {
            const a = p.phase + p.life * 9;
            p.x = p.cx + Math.cos(a) * p.rx;
            p.y = p.cy + Math.sin(a) * p.ry;
        }
        if (p.move === 'shuriken') {
            if (p.x < -20 || p.x > window.innerWidth + 20) {
                p.life = p.max;
            } else if (Math.random() < 0.6) {
                moveParticles.push({ move: 'trail', x: p.x, y: p.y + moveRand(-1, 1) * p.s, life: 0, s: p.s, vx: -p.dir * moveRand(5, 20) * p.s, vy: moveRand(-6, 6) * p.s, g: 40 * p.s, drag: 1, max: 0.25 });
            }
        }
    }
}

// 효과 하나의 오류 — 기록만 하고 그 입자 · 발사기만 없앰 (moveTick 은 계속)
function moveFault(err) {
    if (typeof ultError === 'function') {
        ultError('moveTick', err);
    } else {
        console.error(err);
    }
}
function safeFx(e, fn) {
    try {
        fn();
        return true;
    } catch (err) {
        moveFault(err);
        e.until = 0;
        return false;
    }
}

function startMoveEffect(pokemon, move, left, emitMs, special) {
    const kind = special ? special.kind : move[0];
    const power = move[1];
    const size = pokemon._originalSpriteSize || 32;
    const rect = pokemon.el.getBoundingClientRect();
    const s = rect.width / size;
    const dir = left ? -1 : 1;
    // 왼쪽을 보면 그림이 좌우로 뒤집혀 있음
    const sx = (v) => rect.left + (left ? size - v : v) * s;
    const now = performance.now();
    const emitter = { move: kind, power, dir, s, until: now + emitMs, acc: 1 };
    if (kind === 'electric') {
        const [, , l, t, r, b] = move;
        emitter.cx = (sx(l) + sx(r)) / 2;
        emitter.cy = rect.top + ((t + b) / 2) * s;
        emitter.rx = ((r - l) / 2) * s;
        emitter.ry = ((b - t) / 2) * s;
        emitter.nextFlash = power > 0.4 ? now : 0;
    } else {
        const [, , mouthX, mouthY] = move;
        emitter.x = sx(mouthX + 0.5) + dir * s;
        emitter.y = rect.top + (mouthY + 0.5) * s;
    }
    if (special) {
        // 던지는 손 높이 — 입보다 살짝 아래
        emitter.y += 2 * s;
        emitter.shots = special.count;
        emitter.every = special.every;
        emitter.nextShot = now + special.first - 120;
    }
    moveEmitters.push(emitter);
    if (!moveRaf) {
        moveRaf = requestAnimationFrame(moveTick);
    }
}


// ───── 1세대 전용 기술 ─────
// MOVE_LIB = [[이름, 연출 틀, 옵션], …] 기술 모음, POKEMON_MOVESET[키] = [MOVE_LIB 번호, …] 그 포켓몬이 쓸 수 있는 기술 (클릭마다 하나를 무작위로)
// POKEMON_SHAPE[키] = [세기, 입 x, 입 y, 왼, 위, 오른, 아래]
// 둘 다 make-moves.py 가 signature-moves.json · 걷기 그림으로 만들어 넣음. 연출 틀은 아래 SIG_FX
const SIG_PALETTE = {
    fire: ['#fff6b3', '#ffc93c', '#ff7a21', '#d9381e'], dragon: ['#eef2ff', '#a9b8ff', '#7a5cff', '#4a2aa8'],
    poison: ['#f3d6ff', '#c77ce8', '#9b45cc', '#6a2196'], sludge: ['#e3b8f5', '#a45ccc', '#74309a', '#4a1a66'],
    gas: ['#e8d8f0', '#bf9fd6', '#9677b0', '#6d5687'], smoke: ['#f2f2f2', '#c9c9c9', '#9a9a9a', '#6e6e6e'],
    water: ['#ffffff', '#bfe9ff', '#6cc3ff', '#2f8fe0'], ice: ['#ffffff', '#e3faff', '#9fe8ff', '#55c2ef'],
    grass: ['#e6ffb8', '#8be04e', '#4cae3c', '#2f7d32'], solar: ['#ffffff', '#fffbd0', '#d6ff8a', '#6fd35a'],
    psychic: ['#fff0fa', '#ff9fd6', '#e05db0', '#a33a99'], hypno: ['#f6e8ff', '#c99cff', '#9a62ff', '#6a3ad9'],
    electric: ['#ffffff', '#fff8a8', '#ffe53b', '#f2b600'], ghost: ['#efe0ff', '#a87ee6', '#6b3fb0', '#3a1f66'],
    normal: ['#ffffff', '#f2f2f2', '#d6d6d6', '#a8a8a8'], wind: ['#ffffff', '#eaf6ff', '#c9e6f5', '#9cc9e0'],
    rock: ['#e6d6b8', '#bda27a', '#8a7252', '#5c4a33'], ground: ['#f0dcae', '#d1b178', '#a88a55', '#7a6238'],
    steel: ['#ffffff', '#e6ecf2', '#b9c6d4', '#7d8ea3'], silk: ['#ffffff', '#f7f7f0', '#e3e3d2', '#c4c4ae'],
    fairy: ['#fff3fa', '#ffc9e6', '#ff94c9', '#e85aa8'], petal: ['#ffe6f2', '#ffb3d6', '#ff7ab8', '#e0508f'],
    sleep: ['#e8fffb', '#b2f0e6', '#6fd6c8', '#3aa89a'], paralyze: ['#fffde0', '#fff27a', '#f5d93a', '#c9a800'],
    spore: ['#fff2d9', '#ffd79a', '#e8ad5c', '#b8792e'], silver: ['#ffffff', '#f0f4f8', '#cfd8e0', '#9fadba'],
    moon: ['#ffffff', '#fffbe6', '#ffe8a3', '#f0c96a'], heal: ['#ffffff', '#e3ffe0', '#9bf0a0', '#45c35a'],
    hyper: ['#ffffff', '#fff4c2', '#ffb94d', '#ff7a1a'], fight: ['#ffffff', '#ffe0c2', '#ff9d5c', '#d9542b'],
    blood: ['#ffe0e6', '#ff8fa3', '#e0405a', '#a31f3a'], tongue: ['#ffe3ec', '#ffb0c8', '#ff7aa3', '#d9507a'],
    bone: ['#ffffff', '#f5efe0', '#dccfb0', '#a8987a'], gold: ['#fffbe0', '#ffe680', '#f5c400', '#b88a00'],
    egg: ['#ffffff', '#fff8e8', '#f0e0c0', '#c9b48a'], star: ['#ffffff', '#fff8b0', '#ffe14d', '#f5b300'],
    aura: ['#ffffff', '#d8ecff', '#7ab8ff', '#3a7ae0'], bug: ['#f4ffd0', '#d6f06a', '#a8c93a', '#6f8f1f'],
    dark: ['#e6dcff', '#8f78c9', '#4f3a85', '#261a45'],
};
const sigPal = (c) => (Array.isArray(c) ? c : SIG_PALETTE[c] || SIG_PALETTE.normal);
const sigEntry = (key) => {
    const set = POKEMON_MOVESET[key];
    return set && MOVE_LIB[movePick(set)];
};

// 쓰는 순간의 위치 — 그림이 돌아가 있을 수 있어서 안 도는 클릭 영역 기준
function sigGeometry(pokemon, left) {
    const [P, mx, my, l, t, r, b] = POKEMON_SHAPE[pokemon.label];
    const size = pokemon._originalSpriteSize || 32;
    const rect = pokemon.collision.getBoundingClientRect();
    const s = rect.width / size;
    const dir = left ? -1 : 1;
    const sx = (v) => rect.left + (left ? size - v : v) * s;
    return {
        P, s, dir, left, w: rect.width, h: rect.height,
        mouth: { x: sx(mx + 0.5) + dir * s, y: rect.top + (my + 0.5) * s },
        body: {
            cx: (sx(l) + sx(r)) / 2, cy: rect.top + ((t + b) / 2) * s, rx: ((r - l) / 2) * s, ry: ((b - t) / 2) * s,
            top: rect.top + t * s, bottom: rect.top + b * s, front: sx(r),
        },
    };
}

function sigStart() {
    if (!moveRaf) {
        moveRaf = requestAnimationFrame(moveTick);
    }
}
function sigParticle(p) {
    const q = { life: 0, vx: 0, vy: 0, g: 0, drag: 0, ...p };
    if (moveFrame && q._f === undefined) {
        q._f = moveFrame;
    }
    moveParticles.push(q);
    sigStart();
}
function sigEmitter(e) {
    const q = { acc: 1, shot: 0, ...e };
    if (moveFrame && q._f === undefined) {
        q._f = moveFrame;
    }
    moveEmitters.push(q);
    sigStart();
}
// 그림 칸에 맞춘 점 하나
const dotAt = (ctx, px, s, x, y, color, w = 1, h = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(px(x), px(y), w * s, h * s);
};
const fadeInOut = (t, inT = 0.1, outT = 0.25) => (t < inT ? t / inT : t > 1 - outT ? (1 - t) / outT : 1);
// 3x3 · 4x4 · 5x5 그림 (# = 칠함)
const GLYPHS = {
    z4: ['####', '..#.', '.#..', '####'],
    z5: ['#####', '...#.', '..#..', '.#...', '#####'],
    note: ['..##', '..#.', '..#.', '###.', '##..'],
    note8: ['..##..', '..#.#.', '..#..#', '..#...', '.##...', '###...', '###...', '.#....'],
    heart: ['.#.#.', '#####', '#####', '.###.', '..#..'],
};
function drawGlyph(ctx, px, s, x, y, rows, color) {
    ctx.fillStyle = color;
    rows.forEach((row, j) => [...row].forEach((ch, i) => ch === '#' && ctx.fillRect(px(x + i * s), px(y + j * s), s, s)));
}

// 머리 위 기술 이름 "솔라빔!"
function showMoveName(g, text) {
    sigParticle({
        move: 'label', text, x: g.body.cx, y: Math.max(14, g.body.top - 6), vy: -8, max: 1.5, s: g.s,
        draw: (ctx, p, t) => {
            ctx.globalAlpha = fadeInOut(t, 0.08, 0.3);
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            // 화면 끝에서 글자가 잘리지 않게 안쪽으로
            const half = ctx.measureText(p.text).width / 2 + 3;
            const x = Math.min(Math.max(p.x, half), window.innerWidth - half);
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.strokeText(p.text, x, p.y);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(p.text, x, p.y);
        },
    });
}

// 입자 그리기 모음
const DRAW = {
    // 불길 — 시간에 따라 색이 바뀌며 커짐, 끝은 연기
    stream: (ctx, p, t, px) => {
        const n = p.cols.length;
        if (p.tongue) {
            // 불꽃 혀 (2026-10-20 아트 디렉터 2바퀴 — 네모 알갱이 · 네모 꼬리가 줄지어 남던 것): 최대 3칸 · 3칸은 모서리 깎기 · 끝무렵은 1칸 폭 3칸 높이 혀
            ctx.globalAlpha = t < 0.85 ? 1 : Math.ceil(((1 - t) / 0.15) * 4) / 4;
            const c = p.cols[Math.min(n - 1, Math.floor((t / 0.85) * n))];
            if (t > 0.6) {
                for (let j = 0; j < 3; j++) {
                    dotAt(ctx, px, p.s, p.x, p.y - j * p.s, p.cols[Math.min(n - 1, Math.floor((t / 0.85) * n) + (j > 0 ? 1 : 0))]);
                }
                return;
            }
            const k = Math.min(3, Math.round(1 + t * p.grow));
            for (let dy = 0; dy < k; dy++) {
                for (let dx = 0; dx < k; dx++) {
                    // 3칸이면 모서리를 깎아 십자 (2칸은 깎으면 남는 게 없어 그대로)
                    if (k === 3 && (dx === 0 || dx === k - 1) && (dy === 0 || dy === k - 1)) {
                        continue;
                    }
                    dotAt(ctx, px, p.s, p.x + (dx - (k - 1) / 2) * p.s, p.y + (dy - (k - 1) / 2) * p.s, dx === (k - 1) / 2 && dy === (k - 1) / 2 && t < 0.3 ? p.cols[0] : c);
                }
            }
            return;
        }
        const size = p.s * Math.round(1 + t * p.grow);
        if (t < 0.85 || !p.smoke) {
            ctx.globalAlpha = t < 0.85 ? 1 : (1 - t) / 0.15;
            ctx.fillStyle = p.cols[Math.min(n - 1, Math.floor((t / 0.85) * n))];
        } else {
            ctx.globalAlpha = (1 - t) / 0.15;
            ctx.fillStyle = '#7a7a7a';
        }
        ctx.fillRect(px(p.x - size / 2), px(p.y - size / 2), size, size);
    },
    dot: (ctx, p, t, px) => {
        ctx.globalAlpha = fadeInOut(t, 0.1, 0.35);
        dotAt(ctx, px, p.s, p.x, p.y, p.color, p.size || 1, p.size || 1);
    },
    sparkle: (ctx, p, t, px) => {
        ctx.globalAlpha = fadeInOut(t, 0.2, 0.4) * (0.6 + 0.4 * Math.abs(Math.sin(p.life * 8)));
        dotAt(ctx, px, p.s, p.x, p.y, p.cols[0]);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            dotAt(ctx, px, p.s, p.x + dx * p.s, p.y + dy * p.s, p.cols[2]);
        }
    },
    bubble: (ctx, p, t, px) => {
        ctx.globalAlpha = fadeInOut(t, 0.1, 0.15);
        const r = p.r;
        if (t > 0.9) {
            for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
                dotAt(ctx, px, p.s, p.x + dx * (r + 1) * p.s, p.y + dy * (r + 1) * p.s, p.cols[1]);
            }
            return;
        }
        // 안쪽 물빛 (옅게) + 끊김 없는 테두리 + 왼쪽 위 반짝 2칸 — 점 줄이 아니라 방울로 보이게 (2026-10-20 플레이 리뷰어)
        const alpha = ctx.globalAlpha;
        ctx.globalAlpha = alpha * 0.35;
        sigDisc(ctx, px, p.s, p.x, p.y, (r - 0.5) * p.s, p.cols[1]);
        ctx.globalAlpha = alpha;
        const dots = Math.max(8, Math.ceil(2 * Math.PI * r));
        for (let i = 0; i < dots; i++) {
            const a = (i / dots) * Math.PI * 2;
            dotAt(ctx, px, p.s, p.x + Math.cos(a) * r * p.s, p.y + Math.sin(a) * r * p.s, p.cols[2]);
        }
        dotAt(ctx, px, p.s, p.x - Math.ceil(r / 2) * p.s, p.y - Math.ceil(r / 2) * p.s, p.cols[0]);
        if (r >= 3) {
            dotAt(ctx, px, p.s, p.x - Math.ceil(r / 2) * p.s + p.s, p.y - Math.ceil(r / 2) * p.s, p.cols[0]);
        }
    },
};

// 날아가는 물체 모양
const SHAPES = {
    needle: (ctx, p, px) => {
        const len = p.big ? 7 : 5;
        for (let k = 0; k < len; k++) {
            dotAt(ctx, px, p.s, p.x - p.dir * k * p.s, p.y, k === 0 ? p.cols[0] : k < 3 ? p.cols[2] : p.cols[3]);
        }
    },
    star: (ctx, p, px) => {
        const plus = Math.floor(p.life / 0.06) % 2 === 0;
        const r = p.big ? 2 : 1;
        for (let k = 1; k <= r; k++) {
            for (const [dx, dy] of plus ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
                dotAt(ctx, px, p.s, p.x + dx * k * p.s, p.y + dy * k * p.s, p.cols[2]);
            }
        }
        dotAt(ctx, px, p.s, p.x, p.y, p.cols[0]);
    },
    ball: (ctx, p, px) => {
        const r = p.big ? 3 : 2;
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                const d = dx * dx + dy * dy;
                if (d <= r * r) {
                    dotAt(ctx, px, p.s, p.x + dx * p.s, p.y + dy * p.s, d >= (r - 0.5) * (r - 0.5) ? p.cols[3] : p.cols[2]);
                }
            }
        }
        dotAt(ctx, px, p.s, p.x - p.s, p.y - p.s, p.cols[0]);
    },
    rock: (ctx, p, px) => {
        const n = p.big ? 5 : 4;
        for (let dy = 0; dy < n; dy++) {
            for (let dx = 0; dx < n; dx++) {
                if ((dx === 0 || dx === n - 1) && (dy === 0 || dy === n - 1)) {
                    continue;
                }
                const edge = dx === 0 || dy === 0 || dx === n - 1 || dy === n - 1;
                dotAt(ctx, px, p.s, p.x + dx * p.s, p.y + dy * p.s, edge ? '#3a2e20' : dx === 1 && dy === 1 ? p.cols[0] : p.cols[2 + ((dx + dy) % 2)]);
            }
        }
    },
    leaf: (ctx, p, px) => {
        const flat = Math.floor(p.life / 0.08) % 2 === 0;
        dotAt(ctx, px, p.s, p.x, p.y, p.cols[2], flat ? 2 : 1, flat ? 1 : 2);
    },
    coin: (ctx, p, px) => {
        // 뒤집히며 날아감 — 넓었다 좁았다
        const wide = Math.floor(p.life / 0.07) % 3;
        const w = [3, 2, 1][wide];
        dotAt(ctx, px, p.s, p.x - Math.floor(w / 2) * p.s, p.y - p.s, p.cols[2], w, 3);
        dotAt(ctx, px, p.s, p.x, p.y - p.s, p.cols[0]);
    },
    egg: (ctx, p, px) => {
        dotAt(ctx, px, p.s, p.x - p.s, p.y - 2 * p.s, p.cols[1], 3, 4);
        dotAt(ctx, px, p.s, p.x, p.y - 3 * p.s, p.cols[1]);
        dotAt(ctx, px, p.s, p.x, p.y, '#e0905a');
    },
    bone: (ctx, p, px) => {
        const flat = Math.floor(p.life / 0.06) % 2 === 0;
        if (flat) {
            dotAt(ctx, px, p.s, p.x - 2 * p.s, p.y, p.cols[1], 5, 1);
            for (const dx of [-3, 3]) {
                dotAt(ctx, px, p.s, p.x + dx * p.s, p.y - p.s, p.cols[0], 1, 3);
            }
        } else {
            dotAt(ctx, px, p.s, p.x, p.y - 2 * p.s, p.cols[1], 1, 5);
            for (const dy of [-3, 3]) {
                dotAt(ctx, px, p.s, p.x - p.s, p.y + dy * p.s, p.cols[0], 3, 1);
            }
        }
    },
    heart: (ctx, p, px) => drawGlyph(ctx, px, p.s, p.x - 2 * p.s, p.y - 2 * p.s, GLYPHS.heart, p.cols[2]),
};

// 터지는 작은 조각
function sigBurst(x, y, s, cols, n = 6, speed = 40) {
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + moveRand(-0.3, 0.3);
        sigParticle({ x, y, s, vx: Math.cos(a) * speed * s, vy: Math.sin(a) * speed * s - 10 * s, g: 120 * s, drag: 1, max: moveRand(0.25, 0.45), color: movePick(cols), draw: DRAW.dot });
    }
}

// 지그재그 번개 길 (시작점은 그대로, 나머지는 옆으로 jit 칸씩 흔들림)
function zigzag(x0, y0, x1, y1, s, jit = 2.5, seg = 3) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const nx = -(y1 - y0) / (len || 1);
    const ny = (x1 - x0) / (len || 1);
    const steps = Math.max(4, Math.round(len / (seg * s)));
    const path = [];
    for (let k = 0; k <= steps; k++) {
        const off = k === 0 || k === steps ? 0 : moveRand(-jit, jit) * s;
        path.push([x0 + ((x1 - x0) * k) / steps + nx * off, y0 + ((y1 - y0) * k) / steps + ny * off]);
    }
    return path;
}
// 번개 줄 — 하얀 심 + 둘레 색
function zapLine(ctx, px, s, pts, w, tint, core = '#ffffff') {
    for (let k = 1; k < pts.length; k++) {
        const [x0, y0] = pts[k - 1];
        const [x1, y1] = pts[k];
        const m = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / s));
        for (let j = 0; j <= m; j++) {
            const x = x0 + ((x1 - x0) * j) / m;
            const y = y0 + ((y1 - y0) * j) / m;
            dotAt(ctx, px, s, x - s, y - s, tint, w + 2, w + 2);
            dotAt(ctx, px, s, x - (w > 1 ? s / 2 : 0), y - (w > 1 ? s / 2 : 0), core, w, w);
        }
    }
}
// 가지 하나 — 줄 중간에서 비스듬히
function zapBranch(path, len, angle, s) {
    const at = path[Math.floor((path.length - 1) * moveRand(0.3, 0.7))];
    const b = angle + movePick([-0.8, 0.8]);
    return zigzag(at[0], at[1], at[0] + Math.cos(b) * len, at[1] + Math.sin(b) * len, s, 1.5);
}
// 화면 전체 번쩍
function screenFlash(s, alpha, color = '#fffbe0', max = 0.28) {
    sigParticle({ x: 0, y: 0, s, max, draw: (ctx, p, t) => {
        ctx.globalAlpha = alpha * (1 - t);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    } });
}
// 꽉 찬 원 (그림 칸 단위 가로줄로)
// 빔이 나오는 자리의 작은 빛 구 — 겹 원(바깥 짙은 색 → 하얀 심) · 둘레에 짧은 빛살이 돎. 빔 시작의 네모 단면을 덮어 자연스럽게
function muzzleGlow(ctx, px, s, x, y, r, cols, t, alpha = 1) {
    if (r < s || alpha <= 0.01) {
        return;
    }
    for (const [m, c, a] of [[1.25, cols[3], 0.45], [1, cols[2], 0.9], [0.72, cols[1], 1], [0.45, '#ffffff', 1]]) {
        ctx.globalAlpha = a * alpha;
        sigDisc(ctx, px, s, x, y, Math.max(s * 0.6, r * m), c);
    }
    ctx.globalAlpha = 0.85 * alpha;
    for (let j = 0; j < 8; j++) {
        const a = t * 5 + (j * Math.PI * 2) / 8;
        const len = r * (j % 2 ? 1.7 : 2.3) * (0.85 + 0.2 * Math.sin(t * 30 + j));
        for (let d = r * 1.1; d < len; d += s) {
            ctx.fillStyle = d < len * 0.6 ? cols[0] : cols[1];
            ctx.fillRect(px(x + Math.cos(a) * d), px(y + Math.sin(a) * d), s, s);
        }
    }
}
function sigDisc(ctx, px, s, x, y, r, color) {
    ctx.fillStyle = color;
    for (let dy = -r; dy <= r; dy += s) {
        const half = Math.sqrt(Math.max(0, r * r - dy * dy));
        ctx.fillRect(px(x - half), px(y + dy), Math.max(s, px(2 * half)), s);
    }
}
// 퍼지는 고리 (ry 는 납작한 정도)
function sigRing(x, y, s, r0, r1, flat, max, cols) {
    sigParticle({ x, y, s, max, draw: (ctx, p, t, px) => {
        // 3:3 용 판 상자 안 — 둘레 고리는 그림 한 폭 (반지름) 안 (우리 셋 위를 지나던 큰 고리 — 아트 디렉터 #95 ②)
        const cap = moveFrame && moveFrame.ringMax ? moveFrame.ringMax : Infinity;
        const r = Math.min(cap, r0 + (r1 - r0) * t);
        ctx.globalAlpha = 1 - t;
        const dots = Math.max(24, Math.round(r / p.s) * 2);
        for (let j = 0; j < dots; j++) {
            const a = (j / dots) * Math.PI * 2;
            dotAt(ctx, px, p.s, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * flat, cols[j % cols.length]);
        }
    } });
}

// 돌진 — 앞으로 휙 나갔다 돌아옴, 뒤로 잔상 줄, 끝에 쿵
class DashState {
    label = "swipe" /* States.swipe */;
    constructor(pokemon, g, o) {
        this.pokemon = pokemon;
        this.g = g;
        this.o = o;
        const w = spriteSize(pokemon);
        let dir = g.dir;
        const room = (d) => (d > 0 ? rightEdge(pokemon) - pokemon.left : pokemon.left);
        if (room(dir) < w * 0.6) {
            dir = -dir;
        }
        this.dir = dir;
        this.dist = Math.min(w * (1.2 + g.P * 0.8) * (o.fast ? 1.3 : 1), room(dir));
        this.out = o.fast ? 2 : 3;
        this.back = 4;
        this.i = 0;
        this.x0 = pokemon.left;
        faceState(this, dir < 0);
        if (o.roll) {
            pokemon.el.animate([{ rotate: '0deg' }, { rotate: `${dir * 360}deg` }], { duration: this.out * 100 + 150 });
        }
    }
    nextFrame() {
        const p = this.pokemon;
        const cols = sigPal(this.o.c);
        this.i += 1;
        if (this.i <= this.out) {
            p.positionLeft(this.x0 + this.dir * this.dist * (this.i / this.out));
            const rect = p.collision.getBoundingClientRect();
            for (let k = 0; k < 3; k++) {
                const y = rect.top + rect.height * moveRand(0.35, 0.9);
                const x = this.dir > 0 ? rect.left : rect.right;
                sigParticle({ x, y, s: this.g.s, vx: -this.dir * 60 * this.g.s, max: 0.25, len: Math.round(moveRand(4, 7)), dir: this.dir, color: movePick(cols.slice(1)), draw: (ctx, q, t, px) => {
                    ctx.globalAlpha = 1 - t;
                    dotAt(ctx, px, q.s, q.dir > 0 ? q.x - q.len * q.s : q.x, q.y, q.color, q.len, 1);
                } });
            }
            if (this.i === this.out) {
                const rect2 = p.collision.getBoundingClientRect();
                sigImpact(this.dir > 0 ? rect2.right : rect2.left, rect2.top + rect2.height * 0.6, this.g.s, cols, this.g.P);
            }
            return states_1.FrameResult.stateContinue;
        }
        const k = (this.i - this.out) / this.back;
        p.positionLeft(this.x0 + this.dir * this.dist * (1 - Math.min(1, k)));
        return k >= 1 ? states_1.FrameResult.stateComplete : states_1.FrameResult.stateContinue;
    }
}

// 마비 — 몸 가장자리 세 곳에 작은 노란 지직이 0.28초마다 하나씩 (전기 공격처럼 사방으로 튀지 않고 · 1초 3번 아래) + 떨어지는 작은 불똥
function sigNumb(g) {
    const cols = sigPal('paralyze');
    for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i - 1) * 1.1 + moveRand(-0.2, 0.2);
        const x = g.body.cx + Math.cos(a) * g.body.rx * 0.95;
        const y = g.body.cy + Math.sin(a) * g.body.ry * 0.95;
        sigParticle({ x, y, s: g.s, max: 0.28 * i + 0.2, d: 0.28 * i, a, cols, path: null, draw: (ctx, p, t, px) => {
            if (p.life < p.d) {
                return;
            }
            if (!p.path) {
                p.path = zigzag(p.x, p.y, p.x + Math.cos(p.a) * 6 * p.s, p.y + Math.sin(p.a) * 6 * p.s, p.s, 1.5, 2);
                for (let k = 0; k < 3; k++) {
                    sigParticle({ x: p.x, y: p.y, s: p.s, vx: moveRand(-20, 20) * p.s, vy: -moveRand(10, 30) * p.s, g: 120 * p.s, max: 0.3, color: p.cols[movePick([1, 2])], draw: DRAW.dot });
                }
            }
            ctx.globalAlpha = 1;
            zapLine(ctx, px, p.s, p.path, 1, p.cols[3], p.cols[1]);
        } });
    }
}

// 땅 금 — 발밑에서 양옆으로 지그재그 금이 0.2초에 쫙 (진한 금 + 위 밝은 테두리), 천천히 흐려짐 (지진 · 땅고르기)
function sigQuakeCrack(x, y, s, reach, cols) {
    const paths = [1, -1].map((side) => {
        const pts = [[x, y]];
        let cx = x;
        let cy = y;
        while (Math.abs(cx - x) < reach) {
            cx += side * moveRand(3, 6) * s;
            cy = y + Math.round(moveRand(-1.4, 1.4)) * s;
            pts.push([cx, cy]);
        }
        return pts;
    });
    sigParticle({ x, y, s, max: 0.9, paths, cols, draw: (ctx, p, t, px) => {
        const grow = Math.min(1, p.life / 0.2);
        ctx.globalAlpha = t > 0.6 ? (1 - t) / 0.4 : 1;
        for (const pts of p.paths) {
            const upto = Math.max(1, Math.round((pts.length - 1) * grow));
            for (let k = 1; k <= upto; k++) {
                const [x0, y0] = pts[k - 1];
                const [x1, y1] = pts[k];
                const m = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / p.s));
                for (let j = 0; j <= m; j++) {
                    const qx = x0 + ((x1 - x0) * j) / m;
                    const qy = y0 + ((y1 - y0) * j) / m;
                    dotAt(ctx, px, p.s, qx, qy - p.s, p.cols[0]);
                    dotAt(ctx, px, p.s, qx, qy, '#2a1d10', 1, k < upto * 0.5 ? 2 : 1);
                }
            }
        }
    } });
}

// 칼자국 하나 — 굽은 대각선이 0.08초에 쫙 그어지고 (가운데 굵게 · 흰 심 · 끝은 가늘게), 끝에서 불똥이 튐 · 천천히 흐려짐
function sigSlashMark(x, y, s, dir, flip, L, cols) {
    const half = (L * s) / 2;
    // 시작 (앞 위) → 끝 (뒤 아래), 가운데가 바깥으로 살짝 굽음
    const x0 = x + dir * half * 0.75;
    const y0 = y - flip * half;
    const x1 = x - dir * half * 0.75;
    const y1 = y + flip * half;
    const bx = (x0 + x1) / 2 + dir * half * 0.35;
    const by = (y0 + y1) / 2 - flip * half * 0.1;
    const at = (u) => [(1 - u) * (1 - u) * x0 + 2 * u * (1 - u) * bx + u * u * x1, (1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * by + u * u * y1];
    sigParticle({ x, y, s, max: 0.5, cols, L, update: (p) => {
        // 다 그어진 끝에서 불똥 — 긋는 방향으로 (타이머 없이 — 전투 정리 뒤 다음 화면에 안 남게)
        if (p.sparked || p.life < 0.08) {
            return;
        }
        p.sparked = true;
        const [ex, ey] = at(1);
        for (let k = 0; k < 6; k++) {
            const a = Math.atan2(y1 - by, x1 - bx) + moveRand(-0.6, 0.6);
            const v = moveRand(50, 110) * s;
            sigParticle({ x: ex, y: ey, s, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 120 * s, drag: 2, max: moveRand(0.25, 0.4), color: movePick(cols.slice(0, 3)), draw: DRAW.dot });
        }
    }, draw: (ctx, p, t, px) => {
        const shown = Math.min(1, p.life / 0.08);
        ctx.globalAlpha = t > 0.5 ? Math.ceil(((1 - t) / 0.5) * 4) / 4 : 1;
        const steps = p.L * 2;
        for (let k = 0; k <= steps * shown; k++) {
            const u = k / steps;
            const [cx, cy] = at(u);
            const w = Math.max(1, Math.round(Math.sin(Math.PI * u) * (t < 0.25 ? 3 : 2)));
            dotAt(ctx, px, p.s, cx - p.s, cy - (w - 1) * p.s * 0.5 + p.s, p.cols[3], 1, w);
            dotAt(ctx, px, p.s, cx, cy - (w - 1) * p.s * 0.5, w > 1 ? p.cols[1] : p.cols[2], 1, w);
            if (w > 1 && t < 0.35) {
                dotAt(ctx, px, p.s, cx, cy, '#ffffff');
            }
        }
        // 막 그어지는 끝 — 하얀 번쩍
        if (shown < 1) {
            const [hx, hy] = at(shown);
            dotAt(ctx, px, p.s, hx - p.s, hy - p.s, '#ffffff', 3, 3);
        }
    } });
}

// 퍽 — 만화식 뾰족 폭발 (가시 10개 · 작은 흰 심 · 2칸 진한 테두리) 이 확 커졌다 줄고 + 불똥. sigImpact (8줄 별) 보다 크고 단단함
// opt.size = 작은 퍽 반지름 (연타 — 불똥 없이) · opt.white = false 면 흰 심 없이 (연타 둘째부터 — 번쩍 1초 3번)
function sigPow(x, y, s, cols0, P, big, opt = {}) {
    // 노말 (흰 · 회색) 은 흰 덩이로만 보여서 만화식 노란 퍽으로
    const cols = cols0 === SIG_PALETTE.normal ? SIG_PALETTE.star : cols0;
    const rOut = opt.size ?? (big ? 10 : 7) + 3 * P;
    const white = opt.white ?? true;
    const spikes = 10;
    const tilt = moveRand(0, Math.PI);
    sigParticle({ x, y, s, max: big ? 0.42 : 0.34, cols, rOut, tilt, draw: (ctx, p, t, px) => {
        // 0.06초에 확 → 그대로 → 줄며 사라짐
        const grow = t < 0.15 ? t / 0.15 : t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
        const R = p.rOut * (0.35 + 0.65 * grow);
        const rr = Math.ceil(R);
        ctx.globalAlpha = 1;
        for (let j = -rr; j <= rr; j++) {
            for (let k = -rr; k <= rr; k++) {
                const d = Math.hypot(k, j);
                const a = Math.atan2(j, k) + p.tilt;
                // 가시 — 각도마다 반지름이 길었다 짧았다 (삼각파)
                // 음수 각도도 0 ~ 1 로 (JS % 는 음수를 돌려줘서 그 구역 가시가 사라짐)
                const f = ((((a / (Math.PI * 2)) * spikes) % 1) + 1) % 1;
                const w = Math.abs(f - 0.5) * 2;
                const lim = R * (0.55 + 0.45 * (1 - w));
                if (d > lim) {
                    continue;
                }
                // 순백은 처음 0.25 동안 가운데만 · 나머지는 cols[1] → cols[2] (반이 흰 덩이가 되지 않게) · 작은 퍽 (rOut < 6) 은 테두리 1칸
                const c = d > lim - (p.rOut < 6 ? 1 : 2) ? p.cols[3] : white && t < 0.25 && d < lim * 0.2 ? '#ffffff' : d < lim * 0.45 ? p.cols[1] : p.cols[2];
                dotAt(ctx, px, p.s, p.x + k * p.s, p.y + j * p.s, c);
            }
        }
    } });
    if (!opt.size) {
        sigBurst(x, y, s, cols.slice(0, 3), big ? 9 : 6, big ? 70 : 55);
    }
}

// 쿵 — 가운데 번쩍 + 바깥으로 뻗는 선 8개
function sigImpact(x, y, s, cols, P, big) {
    sigParticle({ x, y, s, max: 0.3, cols, reach: (big ? 8 : 5) + 3 * P, draw: (ctx, p, t, px) => {
        ctx.globalAlpha = 1 - t * t;
        const len = Math.round(2 + t * p.reach);
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            for (let k = Math.round(t * 2) + 1; k <= len; k++) {
                dotAt(ctx, px, p.s, p.x + Math.cos(a) * k * p.s, p.y + Math.sin(a) * k * p.s, k === len ? p.cols[0] : p.cols[2]);
            }
        }
        const r = Math.round(1 + t * 2);
        dotAt(ctx, px, p.s, p.x - r * p.s, p.y - r * p.s, p.cols[0], 2 * r + 1, 2 * r + 1);
    } });
}

// 튀어오르기 — 제자리에서 퐁퐁
class SplashState {
    label = "swipe" /* States.swipe */;
    constructor(pokemon, left) {
        this.pokemon = pokemon;
        this.i = 0;
        this.h = spriteSize(pokemon) * 0.45;
        faceState(this, left);
    }
    nextFrame() {
        const p = this.pokemon;
        this.i += 1;
        p.positionBottom(p.floor + Math.abs(Math.sin((this.i * Math.PI) / 5)) * this.h);
        return this.i >= 10 ? states_1.FrameResult.stateComplete : states_1.FrameResult.stateContinue;
    }
}

// 연출 틀 — ms: 기술 쓰는 동안 멈춰 있을 시간, run: 그리기 시작 (g = 위치, o = 옵션)
const SIG_FX = {
    // 입에서 뿜기 — 화염방사 · 용의숨결 · 독가스 · 눈보라
    breath: {
        ms: (P, o) => (550 + 650 * P) * (o.dur ?? 1),
        run: (g, o, ms) => {
            const cols = sigPal(o.c);
            sigEmitter({ until: performance.now() + ms, rate: (70 + 110 * g.P) * (o.rate ?? 1), fx: () => {
                if (o.ember && Math.random() < 0.25 * g.P) {
                    sigParticle({ x: g.mouth.x, y: g.mouth.y, s: g.s, vx: g.dir * moveRand(50, 80) * (1 + 0.5 * g.P) * g.s, vy: moveRand(-20, -5) * g.s, g: 25 * g.s, drag: 1.2, max: moveRand(0.5, 0.9), color: movePick(cols.slice(0, 2)), draw: DRAW.dot });
                    return;
                }
                if (o.snow && Math.random() < 0.3) {
                    sigParticle({ x: g.mouth.x, y: g.mouth.y, s: g.s, vx: g.dir * moveRand(30, 60) * g.s, vy: moveRand(-10, 15) * g.s, g: 20 * g.s, drag: 0.6, max: moveRand(0.6, 1.0), cols: ['#ffffff', '#ffffff', '#cfefff'], draw: DRAW.sparkle });
                    return;
                }
                sigParticle({
                    x: g.mouth.x, y: g.mouth.y, s: g.s, cols, smoke: o.smoke,
                    vx: g.dir * moveRand(28, 48) * (1 + 0.8 * g.P) * g.s * (o.speed ?? 1),
                    vy: moveRand(-10, 6) * (1 + 0.6 * g.P) * g.s * (o.spread ?? 1),
                    g: -14 * g.s * (o.rise ?? 1), drag: 2.6 - g.P,
                    max: moveRand(0.35, 0.6) * (1 + 0.7 * g.P) * (o.life ?? 1),
                    grow: (2 + 2.5 * g.P) * (o.grow ?? 1), tongue: o.c === 'fire' || o.c === 'dragon', draw: DRAW.stream,
                });
            } });
        },
    },
    // 물대포 (예전 물 기술 그대로) · 파도타기는 바닥을 따라
    water: {
        ms: (P) => 550 + 650 * P,
        run: (g, o, ms) => {
            sigEmitter({ move: 'water', power: g.P, dir: g.dir, s: g.s, until: performance.now() + ms, x: o.surf ? g.body.front : g.mouth.x, y: o.surf ? g.body.bottom - 3 * g.s : g.mouth.y });
            if (o.surf) {
                return;
            }
            // 물줄기 심 (2026-10-19 "밋밋해") — 3칸 굵기 물 덩이가 이어 나가며 물결침 (위 흰 빛 · 아래 진한 파랑), 입 앞엔 물방울 고리
            const cols = sigPal('water');
            const thick = g.P > 0.6 ? 4 : 3;
            sigEmitter({ until: performance.now() + ms * 0.9, rate: 55 + 40 * g.P, fx: () => sigParticle({
                x: g.mouth.x, y: g.mouth.y, s: g.s, dir: g.dir, ph: performance.now() / 90,
                vx: g.dir * moveRand(66, 74) * (1 + 0.6 * g.P) * g.s, vy: 0, g: 18 * g.s, drag: 0.4, max: 0.6 * (1 + 0.4 * g.P), len: Math.round(moveRand(3, 5)), thick, cols,
                draw: (ctx, p, t, px) => {
                    ctx.globalAlpha = t < 0.8 ? 1 : (1 - t) / 0.2;
                    const wob = Math.round(Math.sin(p.ph + p.life * 18)) * p.s;
                    const x = p.dir > 0 ? p.x - p.len * p.s : p.x;
                    for (let j = 0; j < p.thick; j++) {
                        dotAt(ctx, px, p.s, x, p.y + wob + (j - 1) * p.s, j === 0 ? '#ffffff' : j === p.thick - 1 ? p.cols[3] : p.cols[1 + (j % 2)], p.len, 1);
                    }
                },
            }) });
            sigParticle({ x: g.mouth.x, y: g.mouth.y, s: g.s, max: ms / 1000, cols, draw: (ctx, p, t, px) => {
                ctx.globalAlpha = 0.9 * fadeInOut(t, 0.05, 0.2);
                const r = (3 + Math.sin(p.life * 25)) * p.s;
                for (let k = 0; k < 10; k++) {
                    const a = (k / 10) * Math.PI * 2 + p.life * 8;
                    dotAt(ctx, px, p.s, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, k % 2 ? '#ffffff' : p.cols[1]);
                }
            } });
        },
    },
    // 거품
    bubbles: {
        ms: (P) => 700 + 500 * P,
        run: (g, o, ms) => {
            const cols = sigPal(o.c);
            sigEmitter({ until: performance.now() + ms, rate: (14 + 18 * g.P) * (o.many ? 2 : 1), fx: () => sigParticle({
                x: g.mouth.x, y: g.mouth.y, s: g.s, cols, phase: moveRand(0, 6),
                vx: g.dir * moveRand(25, 45) * g.s * (o.many ? 1.5 : 1), vy: moveRand(-10, -2) * g.s, g: -6 * g.s, drag: 0.9, max: moveRand(0.8, 1.3),
                // 방울 반지름 2 ~ 4칸 (1칸은 점 줄로만 보여서)
                r: Math.random() < 0.3 + 0.4 * g.P ? (g.P > 0.7 && Math.random() < 0.3 ? 4 : 3) : 2,
                update: (p, dt) => {
                    p.y += Math.sin(p.phase + p.life * 10) * 0.3 * p.s;
                },
                draw: DRAW.bubble,
            }) });
        },
    },
    // 광선 — 파괴광선 · 냉동빔 · 오로라빔(무지개) · 환상빔(물결) · 덩굴채찍 · 실뿜기 · 핥기(len 으로 짧게)
    beam: {
        ms: (P, o) => (o.len ? 450 : 600 + 400 * P),
        run: (g, o, ms) => {
            const cols = sigPal(o.c);
            // 가는 광선 (덩굴채찍 · 실뿜기 · 핥기) 도 2칸은 되게 — 1칸은 배경에 묻힘 (2026-10-19 "밋밋해")
            const W = Math.max(2, Math.round((2 + 2 * g.P) * (o.width ?? 1)));
            const reach = o.len ? o.len * g.w : g.dir > 0 ? window.innerWidth - g.mouth.x : g.mouth.x;
            // 반짝이 — 옵션이 없으면 광선 제 색으로 조금
            const sparkle = sigPal(o.sparkle ?? o.c);
            const sparkleRate = o.sparkle ? 0.6 : 0.3;
            sigParticle({ x: g.mouth.x, y: g.mouth.y, s: g.s, max: ms / 1000, dir: g.dir, cols, W, reach,
                update: (p) => {
                    if (Math.random() < sparkleRate) {
                        const k = Math.min(p.reach, p.life * 1600) * Math.random();
                        sigParticle({ x: p.x + p.dir * k, y: p.y + moveRand(-1, 1) * p.W * p.s, s: p.s, vy: moveRand(-20, 20) * p.s, max: 0.3, cols: sparkle, draw: DRAW.sparkle });
                    }
                    // 덩굴 · 풀 광선 — 잎이 떨어짐
                    if (o.c === 'grass' && Math.random() < 0.25) {
                        const k = Math.min(p.reach, p.life * 1600) * Math.random();
                        sigParticle({ x: p.x + p.dir * k, y: p.y, s: p.s, vx: moveRand(-10, 10) * p.s, vy: moveRand(5, 20) * p.s, g: 20 * p.s, max: 0.5, color: movePick(p.cols.slice(1)), draw: DRAW.dot });
                    }
                },
                draw: (ctx, p, t, px) => {
                    const L = Math.min(p.reach, p.life * 1600);
                    const alpha = (t > 0.8 ? (1 - t) / 0.2 : 1) * (0.92 + 0.08 * (Math.floor(p.life * 6) % 2));
                    ctx.globalAlpha = alpha;
                    for (let k = 0; k < L; k += p.s) {
                        const x = p.x + p.dir * k;
                        const curl = o.c === 'tongue' && k > L - 3 * p.s ? Math.round((k - (L - 3 * p.s)) / p.s) * p.s : 0;
                        const yo = (o.wave ? Math.sin(k / (5 * p.s) - p.life * 25) * p.s * 1.5 : 0) + curl;
                        const layers = o.rainbow
                            ? [[p.W + 2, `hsl(${(k / p.s) * 12 + p.life * 60}, 100%, 70%)`], [Math.max(1, p.W - 1), '#ffffff']]
                            : [[p.W + 2, p.cols[3]], [p.W, p.cols[2]], [Math.max(1, p.W - 2), p.cols[0]]];
                        for (const [th, color] of layers) {
                            ctx.fillStyle = color;
                            ctx.fillRect(px(x), px(p.y + yo - (th * p.s) / 2), p.s, th * p.s);
                        }
                    }
                    // 입 앞 작은 빛 구 — 쏘는 순간 크게 터졌다 줄어듦
                    const r = Math.max(1.5 * p.s, (p.W + 2) * p.s * 0.75) * (1 + 0.6 * Math.max(0, 1 - p.life / 0.12)) * (1 + 0.08 * Math.sin(p.life * 40));
                    muzzleGlow(ctx, px, p.s, p.x, p.y, r, o.rainbow ? ['#ffffff', '#fff3b0', '#ffb3e6', '#9ec5ff'] : p.cols, p.life, alpha);
                    // 닿는 끝 빛 (게임 전투의 진짜 광선 — fxAim 이 hitGlow 를 줌, 채찍 · 혀 · 실은 없이) — 닿은 동안 끝에서 빛 구가 일렁임
                    if (o.hitGlow && L >= p.reach - p.s) {
                        const yo = o.wave ? Math.sin(L / (5 * p.s) - p.life * 25) * p.s * 1.5 : 0;
                        muzzleGlow(ctx, px, p.s, p.x + p.dir * L, p.y + yo, r * 0.9, o.rainbow ? ['#ffffff', '#fff3b0', '#ffb3e6', '#9ec5ff'] : p.cols, p.life + 1, alpha);
                    }
                },
            });
        },
    },
    // 솔라빔 — 이상해꽃. 1.2초 모으기: 화면이 어두워지고 햇빛 기둥만 밝아짐 · 빛 알갱이가 점점 빨리 빨려 듦 · 빛 구슬이 세 번 두근대며 커지고 몸이 떨림 → 마지막에 확 움츠러들었다가
    // 펑: 화면 번쩍 · 화면 흔들림 · 반동 · 충격파 두 겹 · 앞으로 튀는 빛 조각 → 멀리 갈수록 넓어지는 빛줄기(따라 나가는 고리 · 흩날리는 빛 · 끝에서 튀는 빛) → 가늘어지며 사라지고 화면이 밝아짐
    solarbeam: {
        ms: (P) => 1200 + 900 + 300 * P,
        run: (g, o, ms, pokemon) => {
            const P = g.P;
            const cols = sigPal('solar');
            const charge = 1200;
            const fire = ms - charge;
            const R = Math.max(g.w, 40);
            const cx = g.mouth.x + g.dir * 7 * g.s;
            const cy = g.mouth.y;
            const now = performance.now();
            const hw = R * 0.7;
            // 0~1 모으기 진행
            const progress = () => Math.min(1, (performance.now() - now) / charge);
            // 화면이 어두워짐 — 햇빛 기둥 자리만 빼고, 먼저 그린 효과 밑으로 깔림
            sigParticle({ x: g.body.cx, y: 0, s: g.s, max: ms / 1000, draw: (ctx, p, t, px) => {
                const c = charge / 1000;
                const f = fire / 1000;
                const a = p.life < c ? Math.min(1, p.life / (0.7 * c)) : p.life < c + 0.6 * f ? 1 : 1 - (p.life - c - 0.6 * f) / (0.4 * f);
                const x0 = px(p.x - hw);
                const x1 = px(p.x + hw);
                const bottom = g.body.bottom;
                ctx.globalCompositeOperation = 'destination-over';
                ctx.globalAlpha = 0.5 * a;
                ctx.fillStyle = '#05080f';
                ctx.fillRect(0, 0, x0, window.innerHeight);
                ctx.fillRect(x1, 0, window.innerWidth - x1, window.innerHeight);
                ctx.fillRect(x0, bottom, x1 - x0, window.innerHeight - bottom);
                ctx.globalCompositeOperation = 'source-over';
            } });
            // 하늘에서 햇빛 기둥 — 점점 밝아짐
            sigParticle({ x: g.body.cx, y: 0, s: g.s, max: (charge + 300) / 1000, draw: (ctx, p, t, px) => {
                const a = Math.min(1, p.life / (charge / 1000)) * (t > 0.8 ? (1 - t) / 0.2 : 1);
                ctx.globalAlpha = 0.08 + a * 0.2;
                ctx.fillStyle = '#fff6a8';
                ctx.fillRect(px(p.x - hw), 0, px(2 * hw), g.body.bottom);
                ctx.globalAlpha = 0.1 + a * 0.3;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(px(p.x - hw * 0.3), 0, px(0.6 * hw), g.body.bottom);
            } });
            // 땅에서 올라오는 빛
            sigEmitter({ until: now + charge, rate: 14 + 14 * P, fx: () => sigParticle({
                x: g.body.cx + moveRand(-1, 1) * hw, y: g.body.bottom, s: g.s, vy: -moveRand(25, 50) * g.s, max: moveRand(0.5, 0.8), cols, draw: DRAW.sparkle,
            }) });
            // 빛 알갱이가 입 앞으로 빨려 듦 — 갈수록 많이 · 빨리
            sigEmitter({ until: now + charge - 100, rate: 40, fx: (e) => {
                const k0 = progress();
                e.rate = (40 + 40 * P) * (1 + 3 * k0);
                const a = moveRand(0, Math.PI * 2);
                const r = R * moveRand(1.1, 2);
                const x0 = cx + Math.cos(a) * r;
                const y0 = cy + Math.sin(a) * r * 0.8;
                sigParticle({ x: x0, y: y0, x0, y0, s: g.s, max: moveRand(0.3, 0.4) * (1 - 0.4 * k0), color: movePick(cols), size: Math.random() < 0.35 ? 2 : 1,
                    update: (p) => {
                        const k = Math.min(1, (p.life / p.max) ** 2);
                        p.x = p.x0 + (cx - p.x0) * k;
                        p.y = p.y0 + (cy - p.y0) * k;
                    },
                    draw: (ctx, p, t, px) => {
                        ctx.globalAlpha = Math.min(1, t * 4);
                        dotAt(ctx, px, p.s, p.x, p.y, p.color, p.size, p.size);
                        ctx.globalAlpha *= 0.5;
                        dotAt(ctx, px, p.s, p.x + (p.x0 - p.x) * 0.15, p.y + (p.y0 - p.y) * 0.15, cols[2], p.size, p.size);
                    },
                });
            } });
            // 두근 세 번 — 고리가 좁혀 들고 반짝
            const beats = [0.25, 0.5, 0.72];
            beats.forEach((b) => setTimeout(() => {
                sigRing(cx, cy, g.s, R * 1.5, R * 0.15, 1, 0.3, [cols[2], cols[0]]);
                sigBurst(cx, cy, g.s, cols, 8, 50);
            }, b * charge));
            // 몸 떨림 — 뒤쪽 절반 동안 점점 세게
            const shakeAt = (amp, n) => pokemon.el.animate([{ translate: `-${amp}px 0` }, { translate: `${amp}px 0` }], { duration: 45, iterations: n, direction: 'alternate', composite: 'add' });
            setTimeout(() => shakeAt(0.5 * g.s, 7), charge * 0.5);
            setTimeout(() => shakeAt(1 * g.s, 6), charge * 0.75);
            // 빛 구슬 — 두근대며 커지다 마지막에 확 움츠러듦 + 도는 빛살 + 둘레를 도는 빛 점
            sigParticle({ x: cx, y: cy, s: g.s, max: charge / 1000 + 0.05, draw: (ctx, p, t, px) => {
                const T = Math.min(1, p.life / (charge / 1000));
                let r = 1 + (4 + 4 * P) * Math.min(1, T / 0.85);
                for (const b of beats) {
                    const d = (T - b) / 0.06;
                    if (d > 0 && d < 1) {
                        r *= 1 + 0.3 * Math.sin(d * Math.PI);
                    }
                }
                if (T > 0.88) {
                    r *= 1 - 0.55 * ((T - 0.88) / 0.12);
                }
                r *= p.s * (1 + 0.1 * Math.sin(p.life * 40));
                const hot = T > 0.88;
                for (const [k, c, a] of [[1.8, cols[3], 0.35], [1.35, cols[2], 1], [1, hot ? cols[0] : cols[1], 1], [0.55, cols[0], 1]]) {
                    ctx.globalAlpha = a;
                    sigDisc(ctx, px, p.s, p.x, p.y, r * k, c);
                }
                const rays = 8;
                for (let j = 0; j < rays; j++) {
                    const a = p.life * (3 + 6 * T) + (j * Math.PI * 2) / rays;
                    const len = r * (j % 2 ? 2.2 : 3.4) * (0.8 + 0.2 * Math.sin(p.life * 30 + j)) * (hot ? 1.4 : 1);
                    const w = j % 2 ? 1 : 2;
                    ctx.globalAlpha = 0.4 + 0.6 * T;
                    for (let d = r * 1.2; d < len; d += p.s) {
                        dotAt(ctx, px, p.s, p.x + Math.cos(a) * d - ((w - 1) * p.s) / 2, p.y + Math.sin(a) * d - ((w - 1) * p.s) / 2, d < len * 0.6 ? cols[0] : cols[2], w, w);
                    }
                }
                ctx.globalAlpha = 1;
                for (let j = 0; j < 6; j++) {
                    const a = p.life * (8 + 10 * T) + (j * Math.PI) / 3;
                    dotAt(ctx, px, p.s, p.x + Math.cos(a) * r * 2.4, p.y + Math.sin(a) * r * 2.4, j % 2 ? cols[0] : cols[2]);
                }
            } });
            setTimeout(() => {
                screenFlash(g.s, 0.55, '#f4ffd6', 0.35);
                // 화면 흔들림 · 반동
                const amp = 2 + 2 * P;
                const shake = (el) => el?.animate([{ translate: `-${amp}px 0` }, { translate: `${amp}px 0` }], { duration: 55, iterations: 8, direction: 'alternate', composite: 'add' });
                exports.allPokemon.pokemonCollection.forEach((element) => element.el !== pokemon.el && shake(element.el));
                shake(document.getElementById('foreground'));
                pokemon.el.animate([{ translate: `${-g.dir * 4 * g.s}px 0` }, { translate: '0 0' }], { duration: 350, easing: 'ease-out', composite: 'add' });
                // 입 앞에서 펑 — 충격파 두 겹 + 앞쪽으로 퍼지는 빛 조각
                sigRing(cx, cy, g.s, 2 * g.s, R * (1.4 + 0.6 * P), 1, 0.4, [cols[0], cols[2]]);
                setTimeout(() => sigRing(cx, cy, g.s, 2 * g.s, R * (2.2 + P), 0.8, 0.55, [cols[1], cols[3]]), 90);
                for (let i = 0; i < 34 + 24 * P; i++) {
                    const a = moveRand(-1.2, 1.2);
                    const sp = moveRand(70, 200) * g.s;
                    sigParticle({ x: cx, y: cy, s: g.s, vx: g.dir * Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 2.5, max: moveRand(0.35, 0.65), color: movePick(cols), size: Math.random() < 0.35 ? 2 : 1, draw: DRAW.dot });
                }
                // 굵은 빛줄기 — 처음엔 더 굵게 터지고, 멀리 갈수록 넓게, 끝엔 가늘어짐
                sigParticle({ x: g.mouth.x, y: cy, s: g.s, max: fire / 1000, dir: g.dir, reach: g.dir > 0 ? window.innerWidth - g.mouth.x : g.mouth.x, W: 4 + 3 * P, rings: [], nextRing: 0, nextSpray: 0,
                    update: (p) => {
                        const L = Math.min(p.reach, p.life * 2400);
                        for (let j = 0; j < 3; j++) {
                            const side = Math.random() < 0.5 ? -1 : 1;
                            sigParticle({ x: p.x + p.dir * L * Math.random(), y: p.y + side * p.W * p.s * 0.5, s: p.s, vx: p.dir * moveRand(20, 60) * p.s, vy: side * moveRand(15, 60) * p.s, drag: 2, max: moveRand(0.25, 0.45), cols, draw: DRAW.sparkle });
                        }
                        if (p.life >= p.nextRing && p.life < p.max * 0.75) {
                            p.nextRing = p.life + 0.08;
                            p.rings.push(p.life);
                        }
                        p.rings = p.rings.filter((r0) => p.life - r0 < 0.45);
                        // 화면 끝에 닿으면 튀는 빛
                        if (L >= p.reach && p.life >= p.nextSpray && p.life < p.max * 0.7) {
                            p.nextSpray = p.life + 0.07;
                            sigBurst(p.x + p.dir * (p.reach - 2 * p.s), p.y, p.s, cols, 6, 70);
                        }
                    },
                    draw: (ctx, p, t, px) => {
                        const L = Math.min(p.reach, p.life * 2400);
                        const burst = Math.max(0, 1 - p.life / 0.2);
                        const w = (p.W + 6 * burst) * (t > 0.7 ? 0.3 + (0.7 * (1 - t)) / 0.3 : 1) * (1 + 0.12 * Math.sin(p.life * 50));
                        const fade = t > 0.85 ? (1 - t) / 0.15 : 1;
                        // 멀리 갈수록 넓게 퍼짐
                        const seg = 6 * p.s;
                        for (const [k, c, a] of [[2.2, cols[3], 0.35], [1.6, cols[2], 0.9], [1.15, cols[1], 1], [0.6, cols[0], 1]]) {
                            ctx.globalAlpha = a * fade;
                            ctx.fillStyle = c;
                            for (let d = 0; d < L; d += seg) {
                                const th = Math.max(1, Math.round(w * k * (0.8 + (0.8 * d) / p.reach))) * p.s;
                                ctx.fillRect(px(p.dir > 0 ? p.x + d : p.x - d - seg), px(p.y - th / 2), seg, th);
                            }
                        }
                        // 앞머리 빛 덩어리
                        if (L < p.reach) {
                            ctx.globalAlpha = 1;
                            sigDisc(ctx, px, p.s, p.x + p.dir * L, p.y, w * 1.3 * p.s, cols[1]);
                            sigDisc(ctx, px, p.s, p.x + p.dir * L, p.y, w * 0.8 * p.s, cols[0]);
                        }
                        // 빛줄기를 따라 나가며 커지는 고리
                        for (const r0 of p.rings) {
                            const age = p.life - r0;
                            const d = age * 700;
                            if (d > L) {
                                continue;
                            }
                            const ry = (w * (0.8 + (0.8 * d) / p.reach) + age * 30) * p.s;
                            ctx.globalAlpha = (1 - age / 0.45) * fade;
                            const dots = Math.max(12, Math.round(ry / p.s) * 3);
                            for (let j = 0; j < dots; j++) {
                                const a = (j / dots) * Math.PI * 2;
                                dotAt(ctx, px, p.s, p.x + p.dir * d + Math.cos(a) * 2 * p.s, p.y + Math.sin(a) * ry, j % 2 ? cols[0] : cols[2]);
                            }
                        }
                    },
                });
            }, charge);
        },
    },
    // 날리기 — 독침 · 바늘미사일 · 스피드스타 · 오물폭탄 · 섀도볼 · 알폭탄 · 고양이돈받기 · 뼈다귀부메랑 · 악마의키스 · 트라이어택
    projectile: {
        ms: (P, o) => ((o.n ?? 1 + Math.round(2 * P)) - 1) * (o.every ?? 150) + 400,
        run: (g, o) => {
            const n = o.n ?? 1 + Math.round(2 * g.P);
            sigEmitter({ until: performance.now() + (n - 1) * (o.every ?? 150) + 50, shots: n, every: o.every ?? 150, nextShot: performance.now(), fx: (e, i) => {
                const speed = (100 + 60 * g.P) * g.s * (o.speed ?? 1);
                // 쏠 때 입 앞 번쩍 (작은 십자 — 첫 발만, 1초 3번 규칙)
                if (i === 0) sigParticle({ x: g.mouth.x, y: g.mouth.y, s: g.s, max: 0.12, cols: o.tri ? sigPal(['fire', 'ice', 'electric'][i % 3]) : sigPal(o.c), draw: (ctx, p, t, px) => {
                    ctx.globalAlpha = 1 - t;
                    dotAt(ctx, px, p.s, p.x - p.s, p.y - p.s, '#ffffff', 3, 3);
                    for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
                        dotAt(ctx, px, p.s, p.x + dx * p.s, p.y + dy * p.s, p.cols[1]);
                    }
                } });
                sigParticle({
                    x: g.mouth.x, y: g.mouth.y + moveRand(-1, 1) * g.s, s: g.s, dir: g.dir,
                    vx: g.dir * speed, v0: g.dir * speed, vy: moveRand(-6, 6) * g.s - (o.arc ? o.arc * 0.45 * g.s : 0), g: (o.arc ?? 0) * g.s,
                    max: o.boomerang ? 1.0 : 2.2, big: o.big || g.P > 0.75, ground: g.body.bottom,
                    cols: o.tri ? sigPal(['fire', 'ice', 'electric'][i % 3]) : sigPal(o.c), shape: SHAPES[o.shape] || SHAPES.ball,
                    update: (p) => {
                        if (o.boomerang) {
                            p.vx = p.v0 * Math.cos((Math.PI * p.life) / 1.0);
                        }
                        if (o.arc && p.y >= p.ground) {
                            sigBurst(p.x, p.ground, p.s, p.cols, 6, 35);
                            p.life = p.max;
                        }
                        if (p.x < -30 || p.x > window.innerWidth + 30) {
                            p.life = p.max;
                        }
                        // 잔상 꼬리 — 공 · 별은 많이, 잎 · 바늘 · 하트도 조금 (2026-10-19 "밋밋해")
                        if (Math.random() < (o.shape === 'ball' || o.shape === 'star' ? 0.7 : 0.45)) {
                            sigParticle({ x: p.x - p.dir * moveRand(2, 4) * p.s, y: p.y + moveRand(-1, 1) * p.s, s: p.s, vy: moveRand(-4, 4) * p.s, max: moveRand(0.15, 0.3), color: p.cols[movePick([0, 1, 2])], draw: DRAW.dot });
                        }
                    },
                    draw: (ctx, p, t, px) => {
                        ctx.globalAlpha = 1;
                        p.shape(ctx, p, px);
                    },
                });
            } });
        },
    },
    // 가루 — 수면가루 · 독가루 · 저리가루 · 버섯포자 · 꽃잎댄스(around) · 은빛바람(drift)
    powder: {
        ms: (P) => 900 + 300 * P,
        run: (g, o, ms) => {
            const cols = sigPal(o.c);
            sigEmitter({ until: performance.now() + ms, rate: 25 + 35 * g.P, fx: () => {
                const a = moveRand(0, Math.PI * 2);
                const x = o.around ? g.body.cx + Math.cos(a) * g.body.rx * 1.3 : g.mouth.x + g.dir * moveRand(0, 3) * g.w;
                const y = o.around ? g.body.cy + Math.sin(a) * g.body.ry * 1.3 : moveRand(g.body.top - 0.3 * g.h, g.mouth.y);
                // 가루 사이사이 반짝 (2026-10-20 "밋밋해") — 십자 반짝이가 천천히 내려앉음
                if (!o.petal && Math.random() < 0.22) {
                    sigParticle({ x, y, s: g.s, vx: g.dir * moveRand(2, 10) * g.s * (o.drift ? 4 : 1), vy: moveRand(3, 9) * g.s, drag: 0.5, max: moveRand(0.6, 1), cols: [cols[0], cols[1], cols[2]], draw: DRAW.sparkle });
                    return;
                }
                sigParticle({
                    x, y, s: g.s, phase: moveRand(0, 6), petal: o.petal, color: movePick(cols.slice(1)), size: Math.random() < 0.2 ? 2 : 1,
                    vx: g.dir * moveRand(4, 16) * g.s * (o.drift ? 4 : 1) + (o.around ? Math.cos(a) * 15 * g.s : 0), vy: moveRand(4, 12) * g.s, g: 2 * g.s, drag: 0.5, max: moveRand(0.8, 1.3),
                    update: (p) => {
                        p.x += Math.sin(p.phase + p.life * 5) * 0.3 * p.s;
                    },
                    draw: o.petal
                        ? (ctx, p, t, px) => {
                            const flat = Math.floor(p.life / 0.1) % 2 === 0;
                            ctx.globalAlpha = fadeInOut(t, 0.1, 0.3);
                            dotAt(ctx, px, p.s, p.x, p.y, p.color, flat ? 2 : 1, flat ? 1 : 2);
                        }
                        : DRAW.dot,
                });
            } });
        },
    },
    // 퍼지는 고리 — 염동력 · 사이코키네시스 · 최면술(spiral) · 나이트헤드 · 회오리불꽃 / 앞으로 퍼지는 물결 — 바람일으키기 · 초음파 · 하이퍼보이스(forward)
    rings: {
        ms: (P, o) => (o.n ?? 3) * 140 + 500,
        run: (g, o) => {
            const cols = sigPal(o.c);
            const n = o.n ?? 3;
            sigEmitter({ until: performance.now() + n * 140, shots: n, every: 140, nextShot: performance.now(), fx: (e, i) => sigParticle({
                x: o.forward ? g.mouth.x : g.body.cx, y: o.forward ? g.mouth.y : g.body.cy, s: g.s, dir: g.dir, i,
                vx: o.forward ? g.dir * (90 + 40 * g.P) * g.s : 0, max: o.forward ? 0.7 : 0.55, cols,
                r0: o.forward ? 3 : 0.4 * Math.max(g.body.rx, g.body.ry) / g.s, r1: o.forward ? 12 + 5 * g.P : (1.6 + 0.4 * g.P) * Math.max(g.body.rx, g.body.ry) / g.s,
                update: o.forward ? (p) => {
                    // 앞으로 가는 물결 — 지나간 자리에 반짝이 (2026-10-19 "밋밋해")
                    if (Math.random() < 0.5) {
                        const r = (p.r0 + (p.r1 - p.r0) * (p.life / p.max)) * p.s;
                        const a = moveRand(-0.9, 0.9);
                        sigParticle({ x: p.x + p.dir * Math.cos(a) * r, y: p.y + Math.sin(a) * r, s: p.s, vx: -p.dir * 15 * p.s, drag: 2, max: 0.3, color: p.cols[movePick([0, 1])], draw: DRAW.dot });
                    }
                } : undefined,
                draw: (ctx, p, t, px) => {
                    const r = (p.r0 + (p.r1 - p.r0) * t) * p.s;
                    ctx.globalAlpha = 1 - t * t;
                    if (o.forward) {
                        // 바깥 진한 2칸 · 안쪽 흰 줄 (끝은 가늘게)
                        for (let a = -1.1; a <= 1.1; a += 0.09) {
                            const edge = Math.abs(a) > 0.8;
                            const x = p.x + p.dir * Math.cos(a) * r;
                            const y = p.y + Math.sin(a) * r;
                            dotAt(ctx, px, p.s, x, y, p.cols[edge ? 1 : 2 + (p.i % 2)], edge ? 1 : 2, edge ? 1 : 2);
                            if (!edge) {
                                dotAt(ctx, px, p.s, x - p.dir * p.s, y, '#ffffff');
                            }
                        }
                        return;
                    }
                    const dots = Math.max(20, Math.round(r / p.s) * 4);
                    for (let k = 0; k < dots; k++) {
                        if (o.spiral && (k + Math.floor(p.life * 30)) % 4 > 1) {
                            continue;
                        }
                        const a = (k / dots) * Math.PI * 2 + (o.spiral ? p.life * 6 : 0);
                        const x = p.x + Math.cos(a) * r;
                        const y = p.y + Math.sin(a) * r * 0.75;
                        // 굵은 고리 (2칸) + 안쪽 흰 점 줄
                        dotAt(ctx, px, p.s, x, y, p.cols[(k + p.i) % 2 ? 1 : 2], t < 0.5 ? 2 : 1, 1);
                        if (k % 3 === 0 && t < 0.6) {
                            dotAt(ctx, px, p.s, p.x + Math.cos(a) * (r - 2 * p.s), p.y + Math.sin(a) * (r - 2 * p.s) * 0.75, '#ffffff');
                        }
                    }
                },
            }) });
        },
    },
    // 회오리 기둥 — 포켓몬 앞에 깔때기 모양으로 빙글빙글 솟음 (회오리불꽃). 앞쪽 입자는 크고 밝게 · 뒤쪽은 작고 어둡게, 아래는 뜨거운 색 · 위로 갈수록 바깥 색
    vortex: {
        ms: (P) => 1300 + 500 * P,
        run: (g, o, ms) => {
            const cols = sigPal(o.c);
            const H = (1.7 + 0.6 * g.P) * g.h * (o.height ?? 1);
            const rTop = (0.55 + 0.3 * g.P) * g.w;
            const rBottom = 0.12 * g.w;
            const cx = g.body.front + g.dir * (rTop + 0.2 * g.w);
            const ground = g.body.bottom;
            const start = performance.now();
            const spin = g.dir * moveRand(9, 12);
            // 바닥 불빛
            sigParticle({ x: cx, y: ground, s: g.s, max: ms / 1000, draw: (ctx, p, t, px) => {
                ctx.globalAlpha = fadeInOut(t, 0.15, 0.3) * (0.5 + 0.5 * Math.abs(Math.sin(p.life * 14)));
                const dots = 18;
                for (let k = 0; k < dots; k++) {
                    const a = (k / dots) * Math.PI * 2 + p.life * 4;
                    dotAt(ctx, px, p.s, p.x + Math.cos(a) * rTop * 0.8, p.y + Math.sin(a) * p.s * 2, cols[k % 2 ? 1 : 2]);
                }
            } });
            // 기둥을 감고 올라가는 나선 띠 두 줄 — 꼬인 회오리 모양
            sigParticle({ x: cx, y: ground, s: g.s, max: ms / 1000, draw: (ctx, p, t, px) => {
                const grow = Math.min(1, p.life / 0.25);
                const top = H * grow * (t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1);
                for (let strand = 0; strand < 2; strand++) {
                    for (let h = 0; h < top; h += p.s) {
                        const frac = h / H;
                        const r = rBottom + (rTop - rBottom) * frac;
                        const theta = strand * Math.PI + frac * 9 + p.life * spin;
                        const front = Math.sin(theta) > 0;
                        ctx.globalAlpha = (front ? 0.95 : 0.35) * fadeInOut(t, 0.05, 0.25);
                        dotAt(ctx, px, p.s, p.x + Math.cos(theta) * r, p.y - h + Math.sin(theta) * r * 0.15, cols[Math.min(cols.length - 1, Math.floor(frac * cols.length))], front ? 2 : 1, 1);
                    }
                }
            } });
            sigEmitter({ until: start + ms - 300, rate: 110 + 110 * g.P, fx: () => {
                const grow = Math.min(1, (performance.now() - start) / 250); // 처음엔 솟아오르며 커짐
                if (Math.random() < 0.12 + 0.1 * g.P) {
                    // 회오리 밖으로 튀는 불똥
                    const a = moveRand(0, Math.PI * 2);
                    sigParticle({ x: cx + Math.cos(a) * rTop * 0.6, y: ground - moveRand(0.2, 0.9) * H * grow, s: g.s, vx: Math.cos(a) * moveRand(30, 70) * g.s, vy: -moveRand(10, 50) * g.s, g: 60 * g.s, drag: 1, max: moveRand(0.4, 0.8), color: movePick(cols.slice(0, 2)), draw: DRAW.dot });
                    return;
                }
                sigParticle({
                    x: cx, y: ground, s: g.s, max: moveRand(0.5, 0.9), theta: moveRand(0, Math.PI * 2), h: moveRand(0, 0.15) * H, rise: moveRand(0.9, 1.3) * H * grow,
                    update: (p, dt) => {
                        p.theta += spin * dt;
                        p.h += p.rise * dt;
                        p.frac = Math.min(1, p.h / H);
                        const r = rBottom + (rTop - rBottom) * p.frac;
                        p.depth = Math.sin(p.theta);
                        p.x = cx + Math.cos(p.theta) * r;
                        p.y = ground - p.h + p.depth * r * 0.15;
                    },
                    draw: (ctx, p, t, px) => {
                        if (p.frac === undefined) {
                            return;
                        }
                        const front = p.depth > 0;
                        const size = (front ? 2 : 1) + (g.P > 0.6 && front ? 1 : 0);
                        ctx.globalAlpha = (front ? 1 : 0.55) * fadeInOut(t, 0.1, 0.35) * (p.frac > 0.85 ? (1 - p.frac) / 0.15 : 1);
                        dotAt(ctx, px, p.s, p.x, p.y, cols[Math.min(cols.length - 1, Math.floor(p.frac * cols.length))], size, size);
                    },
                });
            } });
        },
    },
    // 몸 둘레 스파크 (예전 전기 기술 그대로) — 10만볼트 · 전기쇼크
    spark: {
        ms: (P, o) => (o.c === 'paralyze' ? 900 : 550 + 650 * P),
        run: (g, o, ms) => {
            if (o.c === 'paralyze') {
                sigNumb(g);
                return;
            }
            sigEmitter({ move: 'electric', power: g.P, dir: g.dir, s: g.s, until: performance.now() + ms, cx: g.body.cx, cy: g.body.cy, rx: g.body.rx, ry: g.body.ry, nextFlash: g.P > 0.4 ? performance.now() : 0 });
        },
    },
    // 반짝이며 올라감 — 문라이트 · 알낳기 · 순간이동 · 변신
    glow: {
        ms: (P) => 800 + 300 * P,
        run: (g, o, ms) => {
            const cols = sigPal(o.c);
            sigEmitter({ until: performance.now() + ms, rate: 18 + 25 * g.P, fx: () => sigParticle({
                x: g.body.cx + moveRand(-1, 1) * g.body.rx, y: g.body.bottom - moveRand(0, 2) * g.body.ry, s: g.s,
                vy: -moveRand(15, 35) * g.s, max: moveRand(0.6, 1.0), cols, draw: DRAW.sparkle,
            }) });
            // 빛 기둥 — 발밑에서 1칸 점이 줄지어 솟음 + 회복이면 + 표 셋이 차례로 떠오름 (2026-10-20 "밋밋해")
            sigEmitter({ until: performance.now() + ms * 0.8, rate: 30 + 20 * g.P, fx: () => sigParticle({
                x: g.body.cx + Math.round(moveRand(-1, 1) * (g.body.rx / g.s)) * g.s, y: g.body.bottom, s: g.s, vy: -moveRand(50, 80) * g.s, max: moveRand(0.35, 0.55), color: movePick(cols.slice(1, 3)), len: Math.round(moveRand(2, 4)),
                draw: (ctx, p, t, px) => {
                    ctx.globalAlpha = Math.ceil(fadeInOut(t, 0.1, 0.4) * 4) / 4;
                    dotAt(ctx, px, p.s, p.x, p.y, p.color, 1, p.len);
                },
            }) });
            if (o.c === 'heal') {
                for (let i = 0; i < 3; i++) {
                    sigParticle({ x: g.body.cx + (i - 1) * g.body.rx * 0.7, y: g.body.cy, s: g.s, vy: -18 * g.s, max: 0.7, d: i * 0.15, cols, draw: (ctx, p, t, px) => {
                        if (p.life < p.d) {
                            return;
                        }
                        ctx.globalAlpha = Math.ceil(fadeInOut(t, 0.15, 0.35) * 4) / 4;
                        dotAt(ctx, px, p.s, p.x - p.s, p.y, p.cols[3], 3, 1);
                        dotAt(ctx, px, p.s, p.x, p.y - p.s, p.cols[3], 1, 3);
                        dotAt(ctx, px, p.s, p.x, p.y, '#ffffff');
                    } });
                }
            }
        },
    },
    // 보호막 — 단단해지기 · 배리어 · 막기 (게임 패링) — 둥근 방울 방패: 끊김 없는 픽셀 테두리 · 옅은 안쪽 · 위쪽 반짝 호가 천천히 돎 (2026-10-20 — 점선 네모는 고른 칸처럼 보여서)
    shield: {
        ms: () => 1000,
        run: (g, o) => {
            const cols = sigPal(o.c);
            const R = Math.max(g.body.rx, g.body.ry) + 3 * g.s;
            sigParticle({ x: g.body.cx, y: g.body.cy, s: g.s, max: 1.0, cols, R, draw: (ctx, p, t, px) => {
                const fade = Math.ceil(fadeInOut(t, 0.1, 0.25) * 4) / 4;
                const r = p.R * (t < 0.1 ? 0.7 + 3 * t : 1);
                ctx.globalAlpha = fade * 0.18;
                sigDisc(ctx, px, p.s, p.x, p.y, r, p.cols[1]);
                ctx.globalAlpha = fade;
                const dots = Math.ceil((2 * Math.PI * r) / p.s);
                for (let j = 0; j < dots; j++) {
                    const a = (j / dots) * Math.PI * 2;
                    dotAt(ctx, px, p.s, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.9, p.cols[2]);
                }
                // 위쪽 반짝 호 (흰빛) — 1초에 반 바퀴
                for (let j = 0; j < 6; j++) {
                    const a = -Math.PI * 0.8 + j * 0.12 + p.life * Math.PI * 0.5;
                    dotAt(ctx, px, p.s, p.x + Math.cos(a) * (r - p.s), p.y + Math.sin(a) * (r - p.s) * 0.9, p.cols[0]);
                }
            } });
        },
    },
    // 하늘에서 번개 — 번개 · 대폭발
    bolt: {
        ms: () => 900,
        run: (g) => {
            const path = [];
            const steps = Math.max(4, Math.round(g.body.top / (4 * g.s)));
            for (let i = 0; i <= steps; i++) {
                path.push([g.body.cx + (i === steps ? 0 : moveRand(-3, 3) * g.s), (g.body.top * i) / steps]);
            }
            sigParticle({ x: 0, y: 0, s: g.s, max: 0.5, path, thick: g.P > 0.6 ? 2 : 1, draw: (ctx, p, t, px) => {
                if (Math.floor(p.life / 0.06) % 2 === 1) {
                    return;
                }
                ctx.globalAlpha = 1;
                for (let i = 1; i < p.path.length; i++) {
                    const [x0, y0] = p.path[i - 1];
                    const [x1, y1] = p.path[i];
                    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / p.s));
                    for (let k = 0; k <= n; k++) {
                        const x = x0 + ((x1 - x0) * k) / n;
                        const y = y0 + ((y1 - y0) * k) / n;
                        dotAt(ctx, px, p.s, x - p.s, y, '#ffe53b', 1 + 2 * p.thick, 1);
                        dotAt(ctx, px, p.s, x, y, '#ffffff', p.thick, 1);
                    }
                }
            } });
            setTimeout(() => SIG_FX.spark.run(g, {}, 500), 90);
        },
    },
    // 땅 흔들기 — 지진 · 대지의힘 · 구멍파기
    quake: {
        ms: () => 900,
        run: (g, o) => {
            const cols = sigPal(o.c ?? 'ground');
            const amp = Math.round(2 + g.P);
            // 포켓몬 · 앞쪽 풀을 하나씩 흔듦 — 포켓몬 상자를 통째로 움직이면 위치 기준이 바뀌어 포켓몬이 화면 밖으로 튐
            const shake = (el) => el?.animate([{ translate: `-${amp}px 0` }, { translate: `${amp}px 0` }], { duration: 80, iterations: 6, direction: 'alternate', composite: 'add' });
            exports.allPokemon.pokemonCollection.forEach((element) => shake(element.el));
            shake(document.getElementById('foreground'));
            for (let i = 0; i < 18 + 18 * g.P; i++) {
                const side = Math.random() < 0.5 ? -1 : 1;
                sigParticle({ x: g.body.cx + side * moveRand(0, 0.8) * g.w, y: g.body.bottom, s: g.s, vx: side * moveRand(20, 60) * g.s, vy: -moveRand(10, 45) * g.s, g: 140 * g.s, drag: 0.5, max: moveRand(0.4, 0.8), color: movePick(cols.slice(1)), size: Math.random() < 0.3 ? 2 : 1, draw: DRAW.dot });
            }
            // 땅이 갈라짐 (2026-10-19 "밋밋해") — 발밑에서 양옆으로 지그재그 금이 쫙 + 흙먼지 물결 두 번 + 튀는 돌
            sigQuakeCrack(g.body.cx, g.body.bottom, g.s, (1.3 + 0.6 * g.P) * g.w, cols);
            sigRing(g.body.cx, g.body.bottom, g.s, 0.3 * g.w, (1.4 + 0.5 * g.P) * g.w, 0.22, 0.6, [cols[1], cols[2], cols[0]]);
            setTimeout(() => sigRing(g.body.cx, g.body.bottom, g.s, 0.2 * g.w, (1.1 + 0.4 * g.P) * g.w, 0.22, 0.5, [cols[2], cols[1]]), 220);
            for (let i = 0; i < 5 + 4 * g.P; i++) {
                const side = i % 2 ? -1 : 1;
                sigParticle({ x: g.body.cx + side * moveRand(0.2, 1) * g.w, y: g.body.bottom, s: g.s, vx: side * moveRand(10, 30) * g.s, vy: -moveRand(60, 100) * g.s, g: 260 * g.s, max: moveRand(0.5, 0.8), big: Math.random() < 0.4, cols, ground: g.body.bottom,
                    update: (q) => {
                        if (q.vy > 0 && q.y >= q.ground) {
                            q.life = q.max;
                            sigBurst(q.x, q.ground, q.s, q.cols, 4, 25);
                        }
                    },
                    draw: (ctx, q, t, px) => {
                        ctx.globalAlpha = 1;
                        SHAPES.rock(ctx, q, px);
                    } });
            }
        },
    },
    // 바위 떨어뜨리기 — 돌떨구기 · 스톤샤워 · 원시의힘
    rockfall: {
        ms: (P, o) => (o.n ?? 3) * 150 + 700,
        run: (g, o) => {
            const cols = sigPal(o.c ?? 'rock');
            const n = o.n ?? 3;
            sigEmitter({ until: performance.now() + n * 150, shots: n, every: 150, nextShot: performance.now(), fx: () => sigParticle({
                x: g.body.front + g.dir * moveRand(0.3, 2.5) * g.w, y: -10, s: g.s, vy: moveRand(30, 60) * g.s, g: 500 * g.s, max: 2,
                big: g.P > 0.5 || Math.random() < 0.4, cols, ground: g.body.bottom, top: -10,
                update: (p) => {
                    // 떨어지는 동안 위로 흙 꼬리 (2026-10-19 "밋밋해")
                    if (Math.random() < 0.6) {
                        sigParticle({ x: p.x + moveRand(0, 3) * p.s, y: p.y - p.s, s: p.s, vy: -20 * p.s, drag: 3, max: 0.2, color: p.cols[2], draw: DRAW.dot });
                    }
                    if (p.y >= p.ground - (p.big ? 4 : 3) * p.s) {
                        sigBurst(p.x, p.ground, p.s, p.cols, 10, 50);
                        // 쿵 — 바닥 먼지 고리 + 돌 조각
                        sigRing(p.x + 1.5 * p.s, p.ground, p.s, 2 * p.s, (p.big ? 18 : 13) * p.s, 0.25, 0.4, [p.cols[1], p.cols[2]]);
                        p.life = p.max;
                    }
                },
                draw: (ctx, p, t, px) => {
                    // 바닥 그림자 — 가까워질수록 커지고 진해짐
                    const k = Math.min(1, Math.max(0, (p.y - p.top) / Math.max(1, p.ground - p.top)));
                    const half = Math.round((p.big ? 3 : 2) * (0.5 + 0.8 * k));
                    ctx.globalAlpha = 0.25 + 0.4 * k;
                    dotAt(ctx, px, p.s, p.x + 1.5 * p.s - half * p.s, p.ground, 'rgba(20, 14, 8, 0.9)', 2 * half + 1, 1);
                    ctx.globalAlpha = 1;
                    SHAPES.rock(ctx, p, px);
                },
            }) });
        },
    },
    // 돌진 — 전광석화 · 몸통박치기 · 구르기(roll) · 신속(fast)
    dash: {
        ms: () => 100,
        run: (g, o, ms, pokemon) => {
            pokemon.currentState = new DashState(pokemon, g, o);
        },
    },
    // 할퀴기 자국 — 할퀴기 · 베어가르기 · 마구할퀴기 · 시저크로스(x) (2026-10-19 태현 님 "기술이 밋밋해" → 몸 크기만 한 굽은 칼자국 + 흰 심 + 튀는 불똥)
    slash: {
        ms: (P, o) => (o.n ?? 3) * 80 + 500,
        run: (g, o) => {
            const cols = sigPal(o.c);
            const n = o.n ?? 3;
            // 자국 길이 = 몸 높이쯤 (작은 포켓몬도 12칸 이상)
            const L = Math.max(12, Math.round(((g.body.bottom - g.body.top) * 1.05) / g.s + 3 * g.P));
            const cx = o.onTarget ? g.body.front - g.dir * 0.15 * g.body.rx * 2 : g.body.front + g.dir * L * g.s * 0.4;
            const cy = g.body.cy;
            sigEmitter({ until: performance.now() + n * 80, shots: n, every: 80, nextShot: performance.now(), fx: (e, i) => {
                const off = (i - (n - 1) / 2) * 4 * g.s;
                for (const flip of o.x ? [1, -1] : [1]) {
                    sigSlashMark(cx + g.dir * off * 0.6, cy + off, g.s, g.dir, flip, L, cols);
                }
            } });
        },
    },
    // 주먹 · 부리 — 쪼기 · 연속펀치 · 불꽃/냉동/번개펀치 · 찝게햄머(big) (만화식 뾰족 폭발 + 충격 고리 + 불똥)
    punch: {
        ms: (P, o) => (o.n ?? 1) * 150 + 400,
        run: (g, o) => {
            const cols = sigPal(o.c);
            const n = o.n ?? 1;
            sigEmitter({ until: performance.now() + n * 150, shots: n, every: 150, nextShot: performance.now(), fx: () => {
                const spread = n > 1 ? 1 : 0;
                sigPow(g.body.front + g.dir * moveRand(1, 4) * g.s, g.mouth.y + spread * moveRand(-0.5, 0.5) * g.body.ry, g.s, cols, g.P, o.big);
            } });
        },
    },
    // Z — 잠자기 · 하품
    zzz: {
        ms: () => 1600,
        run: (g, o) => {
            sigEmitter({ until: performance.now() + 1200, shots: 3, every: 400, nextShot: performance.now(), fx: (e, i) => sigParticle({
                x: g.body.cx + g.dir * g.body.rx * 0.4, y: g.body.top, s: g.s, vx: g.dir * 8 * g.s, vy: -18 * g.s, max: 1.1, big: o.big && i > 0,
                draw: (ctx, p, t, px) => {
                    ctx.globalAlpha = fadeInOut(t, 0.15, 0.3);
                    drawGlyph(ctx, px, p.s, p.x, p.y, p.big ? GLYPHS.z5 : GLYPHS.z4, '#dbe8ff');
                },
            }) });
        },
    },
    // 음표 — 노래하기
    notes: {
        ms: () => 1600,
        run: (g, o) => {
            const cols = sigPal(o.c);
            // 음표 7개 — 하나씩 다른 색 (기술 색 + 무지개) · 크게 물결치며 · 지나간 자리에 반짝이 (2026-10-19 "밋밋해")
            const tints = [cols[2], '#ff7ab8', '#ffd23f', cols[1], '#6fd6ff', '#9bf06a', cols[3]];
            sigEmitter({ until: performance.now() + 1400, shots: 7, every: 190, nextShot: performance.now(), fx: (e, i) => sigParticle({
                x: g.mouth.x, y: g.mouth.y - 3 * g.s, s: g.s, phase: moveRand(0, 6), color: tints[i % tints.length],
                vx: g.dir * moveRand(18, 34) * g.s, vy: -moveRand(8, 18) * g.s, max: 1.2,
                update: (p) => {
                    p.x += Math.sin(p.phase + p.life * 7) * 0.7 * p.s;
                    if (Math.random() < 0.35) {
                        sigParticle({ x: p.x + moveRand(0, 3) * p.s, y: p.y + 5 * p.s, s: p.s, vy: 6 * p.s, max: 0.35, color: Math.random() < 0.5 ? '#ffffff' : p.color, draw: DRAW.dot });
                    }
                },
                draw: (ctx, p, t, px) => {
                    ctx.globalAlpha = fadeInOut(t, 0.12, 0.3);
                    // 1칸 진한 그림자 + 음표 (단단한 픽셀 그림자 — 배경에서 안 묻히게)
                    drawGlyph(ctx, px, p.s, p.x + p.s, p.y + p.s, GLYPHS.note8, '#141028');
                    drawGlyph(ctx, px, p.s, p.x, p.y, GLYPHS.note8, p.color);
                },
            }) });
        },
    },
    // 100만볼트 — 피카츄. 모으기(몸으로 빨려 드는 고리 · 세지는 스파크) → 화면 번쩍 + 사방으로 무지개빛 굵은 번개 · 하늘 번개 · 충격파 · 불똥 → 지직지직 여운
    megavolt: {
        ms: (P) => 1500 + 400 * P,
        run: (g, o, ms) => {
            const P = g.P;
            // 작은 크기에서도 크게 보이게 최소 반지름
            const R = Math.max(g.body.rx, g.body.ry, 14);
            const charge = 350;
            // 모으기 — 바깥에서 몸으로 빨려 드는 고리
            sigParticle({ x: g.body.cx, y: g.body.cy, s: g.s, max: charge / 1000, draw: (ctx, p, t, px) => {
                const r = R * (2.4 - 1.8 * t);
                ctx.globalAlpha = 0.4 + 0.6 * t;
                const dots = 28;
                for (let k = 0; k < dots; k++) {
                    const a = (k / dots) * Math.PI * 2 - p.life * 10;
                    dotAt(ctx, px, p.s, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.8, k % 2 ? '#ffffff' : '#ffe53b');
                }
            } });
            SIG_FX.spark.run({ ...g, P: Math.min(1, P + 0.3) }, {}, ms - 200);
            setTimeout(() => {
                screenFlash(g.s, 0.38);
                // 사방으로 굵은 번개 — 0.07초마다 모양을 새로 그려 지직거림, 가지도 침
                const n = 10 + Math.round(4 * P);
                const tints = ['#ffe53b', '#ff7ad9', '#6fdcff', '#9dff6f', '#ffe53b'];
                for (let i = 0; i < n; i++) {
                    const angle = (i / n) * Math.PI * 2 + moveRand(-0.2, 0.2);
                    const len = R * moveRand(2.8, 4) * (1 + P);
                    sigParticle({ x: g.body.cx, y: g.body.cy, s: g.s, max: moveRand(0.55, 0.8), angle, len, tint: tints[i % tints.length],
                        update: (p) => {
                            if (!p.path || p.life - p.drawn > 0.07) {
                                p.drawn = p.life;
                                p.path = zigzag(p.x, p.y, p.x + Math.cos(p.angle) * p.len, p.y + Math.sin(p.angle) * p.len, p.s);
                                p.branch = zapBranch(p.path, p.len * 0.3, p.angle, p.s);
                            }
                        },
                        draw: (ctx, p, t, px) => {
                            ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
                            zapLine(ctx, px, p.s, p.path, 2, p.tint);
                            zapLine(ctx, px, p.s, p.branch, 1, p.tint);
                        },
                    });
                }
                // 하늘에서 쾅
                SIG_FX.bolt.run({ ...g, P: 1 }, {});
                // 충격파 두 겹
                for (let k = 0; k < 2; k++) {
                    setTimeout(() => sigRing(g.body.cx, g.body.cy, g.s, R * 0.8, R * (3.8 + 2 * P), 0.75, 0.5, ['#fff59d', '#fff59d', '#ffffff']), k * 140);
                }
                // 사방으로 튀는 불똥
                sigBurst(g.body.cx, g.body.cy, g.s, ['#ffffff', '#fff59d', '#ffe53b', '#ff7ad9', '#6fdcff'], 24 + Math.round(24 * P), 110);
            }, charge);
        },
    },
    // 번개 — 라이츄. 머리 위로 먹구름이 몰려와 번쩍이고, 굵은 번개가 라이츄에게 두 번 · 둘레 땅에 여러 번 내리꽂힘 (칠 때마다 화면 번쩍 · 땅 충격파 · 불똥)
    thunder: {
        ms: (P) => 1800 + 400 * P,
        run: (g, o, ms) => {
            const P = g.P;
            // 작은 크기에서도 구름 · 번개가 크게 보이게 최소 크기
            const W = Math.max(g.w, 40) * (1.1 + 0.6 * P);
            // cloudH = 구름 두께 배 (게임 모드: 얇게 — 정보줄 · HP 를 덮지 않게)
            const ch = (Math.max(0.3 * g.h, 12) + 3 * g.s) * (o.cloudH ?? 1);
            // skyTop = 구름이 내려올 위 끝 (게임 모드: 정보줄 아래, ult/bridge.js)
            // 구름 몸통은 cloudY 위로 2 × ch — skyTop 을 주면 구름 윗끝이 그 아래로
            const cloudY = o.skyTop !== undefined ? Math.max(o.skyTop + 2 * ch, Math.min(g.body.top - 1.2 * g.h, 0.12 * g.h + ch)) : Math.max(ch, Math.min(g.body.top - 1.2 * g.h, 0.12 * g.h + ch));
            const ground = g.body.bottom;
            // 친 순간들 (초) — 0: 라이츄, 나머지: 둘레 땅
            const side = 3 + Math.round(2 * P);
            const strikes = [{ at: 0.35, main: true }];
            for (let i = 0; i < side; i++) {
                const dir = i % 2 ? -1 : 1;
                // spread · xmin · xmax = 둘레 줄기 범위 (게임 모드: 상대 둘레 좁게 · 트레이너 · 패널 끝을 피함)
                const sx = g.body.cx + dir * moveRand(0.6, 1.3) * W * (o.spread ?? 1);
                strikes.push({ at: 0.5 + i * 0.13, x: Math.min(o.xmax ?? Infinity, Math.max(o.xmin ?? -Infinity, sx)) });
            }
            strikes.push({ at: 0.5 + side * 0.13 + 0.12, main: true });
            // 먹구름 — 덩어리 셋, 칠 때마다 속이 번쩍
            const lumps = [[-0.75, 0.35, 0.55, 0.65], [0, 0, 0.85, 1], [0.75, 0.3, 0.6, 0.7]];
            sigParticle({ x: g.body.cx, y: cloudY, s: g.s, max: ms / 1000, draw: (ctx, p, t, px) => {
                // calm = 둘레 줄기는 구름 · 화면 번쩍 없이 (게임 모드 — 1초에 번쩍 3번까지)
                const lit = strikes.some((k) => (k.main || !o.calm) && p.life >= k.at && p.life - k.at < 0.08);
                ctx.globalAlpha = fadeInOut(t, 0.15, 0.25) * 0.9;
                for (const [ox, oy, rw, rh] of lumps) {
                    const cx = p.x + ox * W;
                    const cy = p.y - ch + oy * ch;
                    const hw = rw * W;
                    const hh = rh * ch;
                    for (let y = -hh; y <= hh; y += p.s) {
                        const half = hw * Math.sqrt(Math.max(0, 1 - (y / hh) * (y / hh)));
                        ctx.fillStyle = lit ? (y < 0 ? '#fffbe0' : '#ffe53b') : y < -hh * 0.4 ? '#6b7090' : '#454a63';
                        ctx.fillRect(px(cx - half), px(cy + y), Math.max(p.s, px(2 * half)), p.s);
                    }
                }
            } });
            SIG_FX.spark.run({ ...g, P: Math.min(1, P + 0.3) }, {}, ms - 200);
            for (const k of strikes) {
                setTimeout(() => {
                    const x = k.main ? g.body.cx : k.x;
                    const y1 = k.main ? g.body.cy : ground;
                    if (k.main || !o.calm) {
                        screenFlash(g.s, k.main ? 0.4 : 0.2);
                    }
                    // 지직거리는 굵은 번개 + 가지 둘
                    sigParticle({ x, y: cloudY, s: g.s, max: k.main ? 0.4 : 0.3, y1, w: k.main ? 3 : 2,
                        update: (p) => {
                            if (!p.path || p.life - p.drawn > 0.05) {
                                p.drawn = p.life;
                                p.path = zigzag(p.x + moveRand(-1, 1) * g.s, p.y, p.x, p.y1, p.s, 3.5);
                                const len = (p.y1 - p.y) * 0.35;
                                p.branches = [zapBranch(p.path, len, Math.PI / 2, p.s), zapBranch(p.path, len * 0.7, Math.PI / 2, p.s)];
                            }
                        },
                        draw: (ctx, p, t, px) => {
                            if (Math.floor(p.life / 0.05) % 3 === 2) {
                                return;
                            }
                            ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
                            zapLine(ctx, px, p.s, p.path, p.w, '#ffe53b');
                            p.branches.forEach((b) => zapLine(ctx, px, p.s, b, 1, '#fff59d'));
                        },
                    });
                    // 땅 충격파 · 불똥
                    sigRing(x, ground, g.s, 2 * g.s, (k.main ? 1.4 : 0.8) * W, 0.25, k.main ? 0.5 : 0.35, ['#fff59d', '#ffffff', '#ffe53b']);
                    sigBurst(x, k.main ? g.body.cy : ground, g.s, ['#ffffff', '#fff59d', '#ffe53b', '#ffb300'], k.main ? 22 + Math.round(16 * P) : 10, k.main ? 100 : 70);
                }, k.at * 1000);
            }
        },
    },
    // 물수리검 — 개굴닌자 (예전 전용기 그대로, 던지는 그림)
    shuriken: {
        sprite: 'shoot',
        ms: () => MOVE_SPECIAL.greninja.first + MOVE_SPECIAL.greninja.every * (MOVE_SPECIAL.greninja.count - 1),
        run: (g, o, ms, pokemon) => {
            const [P, mx, my] = POKEMON_SHAPE[pokemon.label];
            startMoveEffect(pokemon, ['water', P, mx, my], g.left, ms, MOVE_SPECIAL.greninja);
        },
    },
    // 튀어오르기 — 잉어킹 (그러나 아무 일도 일어나지 않았다!)
    splash: {
        ms: () => 100,
        run: (g, o, ms, pokemon) => {
            pokemon.currentState = new SplashState(pokemon, g.left);
            // 첫 이름("튀어오르기!")이 사라진 뒤에
            setTimeout(() => showMoveName(sigGeometry(pokemon, g.left), '그러나 아무 일도 일어나지 않았다!'), 1500);
        },
    },
    // 손가락흔들기 — 1세대 아무 기술이나 하나
    metronome: {
        ms: () => 1500,
        run: (g, o, ms, pokemon) => {
            const pool = MOVE_LIB.filter((v) => !['metronome', 'splash', 'shuriken'].includes(v[1]));
            const [name, fx, opt = {}] = movePick(pool);
            setTimeout(() => {
                const g2 = sigGeometry(pokemon, g.left);
                showMoveName({ ...g2, body: { ...g2.body, top: g2.body.top - 14 } }, `${name}!`);
                SIG_FX[fx].run(g2, opt, SIG_FX[fx].ms(g2.P, opt), pokemon);
            }, 600);
        },
    },
};

// 광선 힘겨루기 — 광선을 쏘면 가끔, 바라보는 쪽 가장 먼 광선 쓰는 애가 돌아서서 받아침
// 모으기 → 두 광선이 가운데서 쾅 → 3.6초 동안 0.9초마다 한쪽이 천천히 밀어붙이며 에너지가 솟구쳐 바닥에 튀고 번개가 땅에 꽂힘, 마지막엔 점점 격해짐
// → 센 쪽이 뚫고 나가 진 쪽이 벌러덩 (아니면 가운데서 대폭발 · 둘 다 벌러덩)
const CLASH_CHANCE = 0.5;
const CLASH_DRAW = 0.35;
const CLASH_CHARGE = 0.9;
const CLASH_SEC = 3.6;
const CLASH_SPEED = 1800;
const isBeam = (m) => !!m && ((m[1] === 'beam' && !m[2]?.len) || m[1] === 'solarbeam');
const beamMoves = (key) => (POKEMON_MOVESET[key] || []).map((i) => MOVE_LIB[i]).filter(isBeam);

function findRival(pokemon, left) {
    const dir = left ? -1 : 1;
    const w = spriteSize(pokemon);
    let best;
    for (const element of exports.allPokemon.pokemonCollection) {
        const q = element.pokemon;
        if (q === pokemon || !POKEMON_SHAPE[q.label] || !q.canSwipe || q.bottom > q.floor + 1 || !['sit-idle', 'walk-right', 'walk-left'].includes(q.currentStateEnum) || !beamMoves(q.label).length) {
            continue;
        }
        const d = (q.left - pokemon.left) * dir;
        if (d >= w * 2.5 && (!best || d > best.d)) {
            best = { q, d };
        }
    }
    return best?.q;
}

function startClash(a, sigA, leftA, b) {
    const sigB = movePick(beamMoves(b.label));
    if (b.currentStateEnum !== "swipe" /* States.swipe */) {
        b.holdState = b.currentState;
        b.holdStateEnum = b.currentStateEnum;
    }
    const meet = Math.abs(b.left - a.left) / 2 / CLASH_SPEED;
    const hold = Math.ceil((0.12 + CLASH_CHARGE + meet + CLASH_SEC + 1.5) * 10);
    for (const [p, left] of [[a, leftA], [b, !leftA]]) {
        p.clashUntil = performance.now() + hold * 100; // 힘겨루기 중엔 필살기 안 됨
        p.currentStateEnum = "swipe" /* States.swipe */;
        p.currentState = new MoveState(left, hold);
        p.hideSpeechBubble();
    }
    setTimeout(() => runClash(a, sigA, leftA, b, sigB, !leftA), 120);
}

// 맞은 쪽 — 뒤로 밀려 벌러덩
function knockBack(p, left, away, amount) {
    p.holdState = undefined;
    p.holdStateEnum = undefined;
    p.currentStateEnum = "swipe" /* States.swipe */;
    p.positionLeft(Math.min(Math.max(p.left + away * amount, 0), rightEdge(p)));
    p.currentState = new TumbleState(p, left, true);
}

function runClash(a, sigA, leftA, b, sigB, leftB) {
    const side = (p, sig, left) => {
        const g = sigGeometry(p, left);
        const [, fx, o = {}] = sig;
        const solar = fx === 'solarbeam';
        return {
            p, g, left, s: g.s, P: g.P, dir: g.dir, x: g.mouth.x, y: g.mouth.y,
            cols: sigPal(solar ? 'solar' : o.c), rainbow: !!o.rainbow, wave: !!o.wave,
            W: 1.2 * (solar ? 4 + 3 * g.P : Math.max(2, Math.round((2 + 2 * g.P) * (o.width ?? 1)))),
        };
    };
    const A = side(a, sigA, leftA);
    const B = side(b, sigB, leftB);
    const s = (A.s + B.s) / 2;
    const half = Math.abs(B.x - A.x) / 2;
    const mid = (A.x + B.x) / 2;
    const tm = CLASH_CHARGE + half / CLASH_SPEED;
    const tO = tm + CLASH_SEC;
    const THROUGH = 0.35; // 이긴 광선이 뚫고 나가는 시간
    const draw = Math.random() < CLASH_DRAW;
    const winner = draw ? null : Math.random() < Math.min(0.85, Math.max(0.15, 0.5 + (A.P - B.P) * 1.2)) ? A : B;
    const loser = winner === A ? B : A;
    const R = Math.max(A.g.w, B.g.w, 40);
    const ground = Math.max(A.g.body.bottom, B.g.body.bottom);
    const both = [...A.cols, ...B.cols, '#ffffff'];
    showMoveName(A.g, `${sigA[0]}!`);
    setTimeout(() => showMoveName(B.g, `${sigB[0]}!`), 350);
    // 밀고 밀리기 — 0.9초쯤마다 한쪽이 천천히 밀어붙임, 마지막 구간은 이길 쪽으로 (무승부면 가운데로)
    const n = Math.max(3, Math.round(CLASH_SEC / 0.9));
    const pushes = [];
    let sgn = Math.random() < 0.5 ? 1 : -1;
    for (let i = 0; i < n; i++) {
        pushes.push(i === n - 1 ? (winner ? (winner === A ? 0.6 : -0.6) : moveRand(-0.08, 0.08)) : sgn * moveRand(0.25, 0.5));
        sgn = -sgn;
    }
    const seg = (t) => {
        const u = Math.min(0.9999, Math.max(0, (t - tm) / CLASH_SEC)) * n;
        const k = Math.floor(u);
        return { k, f: u - k, from: k ? pushes[k - 1] : 0, to: pushes[k] };
    };
    const smooth = (f) => f * f * (3 - 2 * f);
    // 만나는 곳 — +1 이면 B 입, -1 이면 A 입
    const shiftAt = (t) => {
        if (t < tO) {
            const { f, from, to } = seg(t);
            return from + (to - from) * smooth(f) + 0.02 * Math.sin(t * 5);
        }
        const s0 = pushes[n - 1];
        if (!winner) {
            return s0;
        }
        const k = Math.min(1, (t - tO) / THROUGH);
        return s0 + ((winner === A ? 1 : -1) - s0) * k * k;
    };
    // 지금 밀어붙이는 쪽 (+1 이면 A) 과 세기 0~1
    const pushNow = (t) => {
        if (t < tm || t >= tO) {
            return [0, 0];
        }
        const { f, from, to } = seg(t);
        return [Math.sign(to - from), Math.sin(f * Math.PI)];
    };
    // 마지막 1/4 — 점점 격해짐 0~1
    const climaxAt = (t) => Math.min(1, Math.max(0, ((t - tm) / CLASH_SEC - 0.72) / 0.28));
    const pointAt = (sh) => {
        const x = mid + A.dir * half * sh;
        return [x, A.y + (B.y - A.y) * ((x - A.x) / (B.x - A.x || 1))];
    };
    const shakeOthers = (amp, n) => {
        const shake = (el) => el?.animate([{ translate: `-${amp}px 0` }, { translate: `${amp}px 0` }], { duration: 55, iterations: n, direction: 'alternate', composite: 'add' });
        exports.allPokemon.pokemonCollection.forEach((element) => element.pokemon !== a && element.pokemon !== b && shake(element.el));
        shake(document.getElementById('foreground'));
    };
    const tremble = (X, ms) => X.p.el.animate([{ translate: `-${X.s * 0.6}px 0` }, { translate: `${X.s * 0.6}px 0` }], { duration: 45, iterations: Math.round(ms / 45), direction: 'alternate', composite: 'add' });
    // 빛줄기 — 입에서 (xe, ye) 까지, 고리가 만나는 곳 쪽으로 흘러감
    const drawBeam = (ctx, px, X, xe, ye, w, life, alpha) => {
        const len = Math.abs(xe - X.x);
        const seg = 4 * X.s;
        for (const [k, c, a0] of [[2.2, X.cols[3], 0.35], [1.6, X.cols[2], 0.9], [1.15, X.cols[1], 1], [0.6, X.cols[0], 1]]) {
            ctx.globalAlpha = a0 * alpha;
            const th = Math.max(1, Math.round(w * k)) * X.s;
            for (let d = 0; d < len; d += seg) {
                const y = X.y + (ye - X.y) * (d / (len || 1)) + (X.wave ? Math.sin(d / (5 * X.s) - life * 12) * X.s * 1.5 : 0);
                ctx.fillStyle = X.rainbow && k > 1.5 ? `hsl(${(d / X.s) * 12 + life * 400}, 100%, 70%)` : X.rainbow && k > 1 ? '#ffffff' : c;
                ctx.fillRect(px(X.dir > 0 ? X.x + d : X.x - d - seg), px(y - th / 2), seg, th);
            }
        }
        ctx.globalAlpha = alpha;
        for (let j = 0; j < 3; j++) {
            const d = (life * 300 + (j * len) / 3) % (len || 1);
            const ry = w * 1.1 * X.s;
            for (let q = 0; q < 10; q++) {
                const an = (q / 10) * Math.PI * 2;
                dotAt(ctx, px, X.s, X.x + X.dir * d + Math.cos(an) * X.s, X.y + (ye - X.y) * (d / (len || 1)) + Math.sin(an) * ry, q % 2 ? X.cols[0] : X.cols[2]);
            }
        }
    };
    // 모으는 빛 구슬
    const drawOrb = (ctx, px, X, k, life) => {
        const r = (1 + (3 + 3 * X.P) * k) * X.s * (1 + 0.15 * Math.sin(life * 40));
        const ox = X.x + X.dir * 3 * X.s;
        for (const [m, c, a0] of [[1.8, X.cols[3], 0.35], [1.35, X.cols[2], 1], [1, X.cols[1], 1], [0.55, X.cols[0], 1]]) {
            ctx.globalAlpha = a0;
            sigDisc(ctx, px, X.s, ox, X.y, r * m, c);
        }
        ctx.globalAlpha = 0.5 + 0.5 * k;
        for (let j = 0; j < 6; j++) {
            const an = life * 5 + (j * Math.PI) / 3;
            for (let d = r * 1.2; d < r * (j % 2 ? 2 : 3); d += X.s) {
                dotAt(ctx, px, X.s, ox + Math.cos(an) * d, X.y + Math.sin(an) * d, X.cols[0]);
            }
        }
    };
    const pullIn = (X) => {
        const an = moveRand(0, Math.PI * 2);
        const r = R * moveRand(0.9, 1.6);
        const x0 = X.x + Math.cos(an) * r;
        const y0 = X.y + Math.sin(an) * r * 0.8;
        sigParticle({ x: x0, y: y0, x0, y0, s: X.s, max: 0.3, color: movePick(X.cols),
            update: (q) => {
                const k = Math.min(1, (q.life / q.max) ** 2);
                q.x = q.x0 + (X.x - q.x0) * k;
                q.y = q.y0 + (X.y - q.y0) * k;
            },
            draw: DRAW.dot,
        });
    };
    // 솟구친 에너지 — 포물선으로 떨어져 바닥에 닿으면 톡 튐
    const splash = (x, y, up) => {
        const an = up ? moveRand(-Math.PI * 0.85, -Math.PI * 0.15) : moveRand(0, Math.PI * 2);
        const sp = moveRand(60, up ? 220 : 140) * s;
        sigParticle({ x, y, s, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, g: 260 * s, drag: 0.6, max: 1.6, color: movePick(both), size: movePick([1, 2, 2, 3]),
            update: (q) => {
                if (q.y >= ground && q.vy > 0) {
                    q.life = q.max;
                    sigBurst(q.x, ground, s, [q.color, '#ffffff'], 3, 30);
                }
            },
            draw: (ctx, q, t, px) => {
                ctx.globalAlpha = 1;
                dotAt(ctx, px, s, q.x, q.y, q.color, q.size, q.size);
                ctx.globalAlpha = 0.4;
                dotAt(ctx, px, s, q.x - q.vx * 0.025, q.y - q.vy * 0.025, q.color, q.size, q.size);
            },
        });
    };
    const boom = (x, y, big, cols) => {
        screenFlash(s, big ? 0.6 : 0.45, '#ffffff', 0.4);
        shakeOthers(big ? 4 : 3, 10);
        sigRing(x, y, s, 2 * s, R * (big ? 3 : 2), 1, 0.5, [cols[0], '#ffffff']);
        setTimeout(() => sigRing(x, y, s, 2 * s, R * (big ? 4.2 : 2.8), 0.7, 0.6, [cols[1], cols[2]]), 100);
        for (let i = 0; i < (big ? 70 : 45); i++) {
            const an = moveRand(0, Math.PI * 2);
            const sp = moveRand(60, big ? 240 : 180) * s;
            sigParticle({ x, y, s, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp - 30 * s, g: 120 * s, drag: 1.5, max: moveRand(0.4, 0.8), color: movePick(cols), size: Math.random() < 0.4 ? 2 : 1, draw: DRAW.dot });
        }
        for (let i = 0; i < (big ? 24 : 12); i++) {
            splash(x, y, true);
        }
    };
    const st = { fired: false, met: false, hit: false, seg: -1, acc: 0, sparkAcc: 0, nextRing: 0, nextShake: 0, nextArc: 0, nextBolt: 0, arcs: [] };
    // 화면이 어두워지고 두 포켓몬만 동그랗게 밝음 (막판엔 더 어둡게) — 먼저 그린 효과 밑으로 깔림
    const spots = [A, B].map((X) => [X.g.body.cx, X.g.body.cy, Math.max(X.g.w, X.g.h) * 0.75]);
    sigParticle({ x: 0, y: 0, s, max: tO + 1.4, draw: (ctx, q) => {
        const a0 = Math.min(1, q.life / CLASH_CHARGE) * (q.life > tO + 0.6 ? Math.max(0, 1 - (q.life - tO - 0.6) / 0.6) : 1);
        ctx.globalCompositeOperation = 'destination-over';
        ctx.globalAlpha = (0.5 + 0.15 * climaxAt(q.life)) * a0;
        ctx.fillStyle = '#05080f';
        ctx.beginPath();
        ctx.rect(0, 0, window.innerWidth, window.innerHeight);
        for (const [x, y, r] of q.life < tO ? spots : []) {
            ctx.moveTo(x + r, y);
            ctx.arc(x, y, r, 0, Math.PI * 2);
        }
        ctx.fill('evenodd');
        ctx.globalCompositeOperation = 'source-over';
    } });
    sigParticle({ x: 0, y: 0, s, max: tO + 1.4,
        update: (q, dt) => {
            const t = q.life;
            if (t < CLASH_CHARGE) {
                pullIn(A);
                if (t > 0.35) {
                    pullIn(B);
                }
                return;
            }
            if (!st.fired) {
                st.fired = true;
                screenFlash(s, 0.35, '#ffffff', 0.25);
                for (const X of [A, B]) {
                    sigRing(X.x, X.y, X.s, 2 * X.s, R * 1.2, 1, 0.35, [X.cols[0], X.cols[2]]);
                }
            }
            const [xm, ym] = pointAt(shiftAt(t));
            if (t >= tm && t < tO) {
                const c = climaxAt(t);
                const [, pa] = pushNow(t);
                if (!st.met) {
                    st.met = true;
                    boom(xm, ym, false, both);
                    tremble(A, CLASH_SEC * 1000);
                    tremble(B, CLASH_SEC * 1000);
                }
                // 한쪽이 밀어붙이기 시작할 때마다 — 고리 · 에너지가 확 솟구침
                const { k } = seg(t);
                if (k !== st.seg) {
                    st.seg = k;
                    sigRing(xm, ym, s, R * 0.4, R * (1.8 + c), 1, 0.6, [A.cols[1], B.cols[1], '#ffffff']);
                    for (let j = 0; j < 14; j++) {
                        splash(xm, ym, true);
                    }
                    shakeOthers(2, 8);
                    if (k > 0) {
                        screenFlash(s, 0.15, '#ffffff', 0.2);
                    }
                }
                // 계속 튀는 에너지 · 짧은 불꽃 — 세게 밀수록, 막판일수록 많이
                st.acc += dt * (18 + 50 * c + 14 * pa);
                while (st.acc >= 1) {
                    st.acc -= 1;
                    splash(xm, ym, Math.random() < 0.7);
                }
                st.sparkAcc += dt * (50 + 80 * c);
                while (st.sparkAcc >= 1) {
                    st.sparkAcc -= 1;
                    const an = moveRand(0, Math.PI * 2);
                    const sp = moveRand(40, 110) * s;
                    sigParticle({ x: xm, y: ym, s, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, drag: 2, max: moveRand(0.2, 0.35), color: movePick(both), draw: DRAW.dot });
                }
                // 빛 덩어리 둘레 번개 · 땅에 꽂히는 번개 · 고리 · 흔들림
                if (t >= st.nextArc) {
                    st.nextArc = t + 0.16 - 0.08 * c;
                    const an = moveRand(0, Math.PI * 2);
                    const r = R * moveRand(0.5, 0.9);
                    st.arcs.push({ until: t + 0.14, w: 1, path: zigzag(xm, ym, xm + Math.cos(an) * r, ym + Math.sin(an) * r, s, 2) });
                }
                if (t >= st.nextBolt && ground - ym > 8 * s) {
                    st.nextBolt = t + moveRand(0.45, 0.7) - 0.25 * c;
                    const gx = xm + moveRand(-0.7, 0.7) * R;
                    st.arcs.push({ until: t + 0.18, w: 2, path: zigzag(xm, ym, gx, ground, s, 3) });
                    sigBurst(gx, ground, s, both, 8, 60);
                    sigRing(gx, ground, s, 2 * s, R * 0.6, 0.3, 0.35, [A.cols[0], B.cols[0]]);
                }
                if (t >= st.nextRing) {
                    st.nextRing = t + 0.55 - 0.25 * c;
                    sigRing(xm, ym, s, R * 0.3, R * 1.2, 1, 0.5, [A.cols[1], B.cols[1], '#ffffff']);
                }
                if (t >= st.nextShake) {
                    st.nextShake = t + (c > 0 ? 0.25 : 0.9);
                    shakeOthers(1.2 + 2 * c, c > 0 ? 3 : 5);
                }
            }
            st.arcs = st.arcs.filter((arc) => arc.until > t);
            if (t >= tO && !st.hit && (!winner || t >= tO + THROUGH)) {
                st.hit = true;
                if (winner) {
                    const lg = sigGeometry(loser.p, loser.left);
                    boom(lg.body.cx, lg.body.cy, true, [...winner.cols, '#ffffff']);
                    knockBack(loser.p, loser.left, -loser.dir, spriteSize(loser.p) * 0.8);
                    setTimeout(() => showMoveName(sigGeometry(loser.p, loser.left), '효과는 굉장했다!'), 200);
                } else {
                    boom(xm, ym, true, both);
                    for (const X of [A, B]) {
                        knockBack(X.p, X.left, -X.dir, spriteSize(X.p) * 0.5);
                    }
                    setTimeout(() => showMoveName({ s, body: { cx: xm, top: ym - 10 * s } }, '무승부!'), 200);
                }
            }
        },
        draw: (ctx, q, t, px) => {
            const life = q.life;
            if (life < CLASH_CHARGE) {
                drawOrb(ctx, px, A, life / CLASH_CHARGE, life);
                if (life > 0.35) {
                    drawOrb(ctx, px, B, (life - 0.35) / (CLASH_CHARGE - 0.35), life);
                }
                return;
            }
            const sh = shiftAt(life);
            const [xm, ym] = pointAt(sh);
            const c = climaxAt(life);
            const [pd, pa] = pushNow(life);
            const pulse = (1 + 0.08 * Math.sin(life * 18)) * (1 + 0.3 * c);
            const burst = Math.max(0, 1 - (life - CLASH_CHARGE) / 0.2);
            if (life < tm) {
                // 아직 날아가는 중 — 앞머리 빛 덩어리
                const k = Math.min(1, ((life - CLASH_CHARGE) * CLASH_SPEED) / half);
                for (const X of [A, B]) {
                    const xe = X.x + X.dir * half * k;
                    const ye = X.y + (ym - X.y) * k;
                    const w = X.W * (1 + burst) * pulse;
                    drawBeam(ctx, px, X, xe, ye, w, life, 1);
                    ctx.globalAlpha = 1;
                    sigDisc(ctx, px, X.s, xe, ye, w * 1.2 * X.s, X.cols[1]);
                    sigDisc(ctx, px, X.s, xe, ye, w * 0.7 * X.s, X.cols[0]);
                }
                return;
            }
            if (life < tO || winner) {
                for (const X of [A, B]) {
                    if (life >= tO + THROUGH && X === loser) {
                        continue;
                    }
                    // 밀어붙이는 쪽은 굵어지고 밀리는 쪽은 살짝 가늘어짐
                    const mine = X === A ? pd : -pd;
                    const after = life > tO + 0.7 ? Math.max(0, 1 - (life - tO - 0.7) / 0.5) : 1;
                    const w = X.W * (1 + 0.35 * pa * (mine > 0 ? 1 : mine < 0 ? -0.4 : 0)) * pulse * (life >= tO ? 1.3 * (0.4 + 0.6 * after) : 1);
                    drawBeam(ctx, px, X, xm, ym, w, life, after);
                }
            }
            if (life < tO + (winner ? THROUGH : 0)) {
                // 만나는 곳 빛 덩어리 — 바깥은 밀어붙이는 쪽 색, 둘레로 천천히 도는 에너지 가시
                const strong = pd < 0 ? B : A;
                const weak = strong === A ? B : A;
                const r = (Math.max(A.W, B.W) * 1.6 * (1 + 0.6 * c) + Math.sin(life * 12)) * s;
                for (const [m, col, a0] of [[2.1, strong.cols[2], 0.4], [1.5, weak.cols[1], 1], [1, '#ffffff', 1]]) {
                    ctx.globalAlpha = a0;
                    sigDisc(ctx, px, s, xm, ym, r * m, col);
                }
                ctx.globalAlpha = 0.85;
                const spikes = 10;
                for (let j = 0; j < spikes; j++) {
                    const an = life * 1.2 + (j * Math.PI * 2) / spikes;
                    const len = r * (2.3 + 0.7 * Math.sin(life * 6 + j * 1.7)) * (1 + 0.4 * c);
                    for (let d = r * 1.6; d < len; d += s) {
                        dotAt(ctx, px, s, xm + Math.cos(an) * d, ym + Math.sin(an) * d, d < len * 0.75 ? '#ffffff' : (j % 2 ? A : B).cols[1]);
                    }
                }
                ctx.globalAlpha = 1;
                st.arcs.forEach((arc) => zapLine(ctx, px, s, arc.path, arc.w, strong.cols[1]));
            }
        },
    });
}

function useSignature(pokemon, sig, left) {
    const [name, fx, o = {}] = sig;
    const T = SIG_FX[fx];
    const ms = T.ms(POKEMON_SHAPE[pokemon.label][0], o);
    pokemon.currentStateEnum = "swipe" /* States.swipe */;
    pokemon.currentState = new MoveState(left, Math.ceil((ms + 300) / 100), T.sprite);
    pokemon.hideSpeechBubble();
    setTimeout(() => {
        const g = sigGeometry(pokemon, left);
        showMoveName(g, `${name}!`);
        T.run(g, o, ms, pokemon);
    }, 120);
}

// faceLeft 를 주면 그쪽을 보고 씀 (클릭 — 화면 가운데 쪽)
function useMove(pokemon, faceLeft) {
    const move = POKEMON_MOVES[pokemon.label];
    // GAME-PATCH: 📦 게임에서 꺼낸 포켓몬은 게임에서 배운 기술 중 하나 (main-bundle.js gameMoveEntry)
    const sig = POKEMON_SHAPE[pokemon.label] && (pokemon.gameMoves?.length ? movePick(pokemon.gameMoves) : sigEntry(pokemon.label));
    const current = pokemon.currentState;
    if ((!move && !sig) || !pokemon.canSwipe || current instanceof MoveState || current instanceof JumpState || current instanceof TumbleState || current instanceof DashState || current instanceof SplashState) {
        return;
    }
    const flying = current instanceof FlyState;
    const left = faceLeft ?? (flying ? current.dir < 0 : facingLeft(pokemon.el));
    if (flying) {
        // 공중에서 쓰고 계속 날기
        pokemon.holdState = current;
        pokemon.holdStateEnum = "swipe" /* States.swipe */;
    } else if (pokemon.currentStateEnum !== "swipe" /* States.swipe */) {
        // 마우스를 올려 멈춘 상태(swipe)면 그 전 상태를 그대로 두고 끝나면 돌아감
        pokemon.holdState = current;
        pokemon.holdStateEnum = pokemon.currentStateEnum;
    }
    if (sig) {
        const rival = !flying && isBeam(sig) && Math.random() < CLASH_CHANCE && findRival(pokemon, left);
        if (rival) {
            startClash(pokemon, sig, left, rival);
            return;
        }
        useSignature(pokemon, sig, left);
        return;
    }
    const special = MOVE_SPECIAL[pokemon.label] && Math.random() < MOVE_SPECIAL[pokemon.label].chance ? MOVE_SPECIAL[pokemon.label] : undefined;
    const emitMs = special ? special.first + special.every * (special.count - 1) : 550 + 650 * move[1];
    pokemon.currentStateEnum = "swipe" /* States.swipe */;
    pokemon.currentState = new MoveState(left, Math.ceil((emitMs + (special ? 300 : 450)) / 100), special?.sprite);
    pokemon.hideSpeechBubble();
    // 다음 프레임에 몸을 돌린 뒤 뿜음
    setTimeout(() => startMoveEffect(pokemon, move, left, emitMs, special), 120);
}

function handleMoveClick(e) {
    exports.allPokemon.pokemonCollection.forEach((element) => {
        const p = element.pokemon;
        if (element.collision === e.currentTarget && p.el.ultFired) {
            p.el.ultFired = false; // 꾹 눌러 필살기를 쓴 뒤 손을 뗀 것
            return;
        }
        if (element.collision === e.currentTarget && !(performance.now() - (p.el.dragEndAt ?? -1e9) < 300)) {
            // 가운데보다 왼쪽이면 오른쪽을 보고, 오른쪽이면 왼쪽을 보고
            useMove(p, p.left + spriteSize(p) / 2 > window.innerWidth / 2);
        }
    });
}

// 드래그 — 4px 넘게 움직이면 잡음 (그냥 클릭은 기술), 잡는 동안 파닥파닥, 놓으면 떨어짐 · 나는 애는 그 높이에서 날다 내려옴
let drag;

function handleDragStart(e) {
    if (e.button !== 0) {
        return;
    }
    const element = exports.allPokemon.pokemonCollection.find((el) => el.collision === e.currentTarget);
    if (!element) {
        return;
    }
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    drag = { pokemon: element.pokemon, target, x0: e.clientX, y0: e.clientY, lastX: e.clientX, grabbed: false };
    target.addEventListener('pointermove', handleDragMove);
    target.addEventListener('pointerup', handleDragEnd);
    target.addEventListener('pointercancel', handleDragEnd);
}

function grab(d) {
    ultCancelPress(); // 움직였으면 꾹 누르기가 아니라 잡기
    const p = d.pokemon;
    const el = p.el;
    d.grabbed = true;
    d.left0 = p.left;
    d.bottom0 = p.bottom;
    el.glideAnim?.cancel();
    el.tumbleAnim?.cancel();
    el.style.transformOrigin = '';
    el.noGlide = true; // 마우스를 바로 따라오게
    p.holdState = undefined;
    p.holdStateEnum = undefined;
    p.currentStateEnum = "swipe" /* States.swipe */;
    p.currentState = new DragState(facingLeft(el));
    p.hideSpeechBubble();
    el.dragWiggle = el.animate([{ rotate: '-14deg' }, { rotate: '14deg' }], { duration: 110, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
    d.target.classList.add('dragging');
}

function handleDragMove(e) {
    if (!drag) {
        return;
    }
    const dx = e.clientX - drag.x0;
    const dy = e.clientY - drag.y0;
    if (!drag.grabbed) {
        if (Math.abs(dx) + Math.abs(dy) <= 4) {
            return;
        }
        grab(drag);
    }
    const p = drag.pokemon;
    p.positionLeft(Math.min(Math.max(drag.left0 + dx, 0), rightEdge(p)));
    p.positionBottom(Math.min(Math.max(drag.bottom0 - dy, p.floor), window.innerHeight - spriteSize(p)));
    // 끄는 쪽으로 몸을 돌림
    if (Math.abs(e.clientX - drag.lastX) > 2) {
        faceState(p.currentState, e.clientX < drag.lastX);
        drag.lastX = e.clientX;
    }
}

function handleDragEnd() {
    if (!drag) {
        return;
    }
    const { pokemon: p, target, grabbed } = drag;
    drag = undefined;
    target.removeEventListener('pointermove', handleDragMove);
    target.removeEventListener('pointerup', handleDragEnd);
    target.removeEventListener('pointercancel', handleDragEnd);
    if (!grabbed) {
        return; // 그냥 클릭 — 기술은 click 에서
    }
    target.classList.remove('dragging');
    p.el.dragWiggle?.cancel();
    p.el.noGlide = false;
    // 바로 뒤따르는 click 이 기술로 이어지지 않게
    p.el.dragEndAt = performance.now();
    const left = p.currentState.horizontalDirection === states_1.HorizontalDirection.left;
    p.currentState = p.bottom > p.floor + 1 && POKEMON_ACTS[p.label] === 'fly' ? new FlyState(p, p.bottom) : new FallState(p, left);
}

function startMoveAuto() {
    if (moveAutoStarted) {
        return;
    }
    moveAutoStarted = true;
    const ready = (has) =>
        exports.allPokemon.pokemonCollection.filter(
            (element) => has(element.pokemon.label) && ['sit-idle', 'walk-right', 'walk-left'].includes(element.pokemon.currentStateEnum),
        );
    setInterval(() => {
        if (document.hidden || ultActive || document.body.classList.contains('pokemon-game-on') /* GAME-PATCH: 게임 모드 중에는 자동 기술 안 씀 */) {
            return;
        }
        if (Math.random() < 1 / MOVE_AUTO_AVG_SEC) {
            const list = ready((key) => POKEMON_MOVES[key] || POKEMON_MOVESET[key]);
            if (list.length) {
                useMove(movePick(list).pokemon);
            }
        }
        for (const act of ['fly', 'jump']) {
            if (Math.random() < 1 / ACT_AUTO_AVG_SEC[act]) {
                const list = ready((key) => POKEMON_ACTS[key] === act);
                if (list.length) {
                    startAct(movePick(list).pokemon, act);
                }
            }
        }
    }, 1000);
}
