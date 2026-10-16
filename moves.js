// 타입별 기술 + 특수 행동 + 드래그 — make-moves.py 가 main-bundle.js 의 handleMouseOver 앞에 표와 같이 넣는다
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
const moveParticles = [];
let moveCanvas;
let moveCtx;
let moveRaf = 0;
let moveLast = 0;
let moveAutoStarted = false;

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

// 쿵 넘어졌다 일어남 — 착지 직후 보는 쪽으로 옆으로 눕고(바닥에 닿게 75% 높이를 축으로), 머리 위 별 빙글, 비틀 세우기
class TumbleState {
    label = "swipe" /* States.swipe */;
    constructor(pokemon, left) {
        this.pokemon = pokemon;
        this.frames = 0;
        faceState(this, left);
        const el = pokemon.el;
        const tilt = left ? -90 : 90;
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
        setTimeout(() => startDizzy(pokemon, left), GLIDE_LAG_MS + 220);
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
    const dt = moveLast ? Math.min(0.05, (now - moveLast) / 1000) : 0;
    moveLast = now;
    moveCanvasReady();
    const ctx = moveCtx;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (let i = moveEmitters.length - 1; i >= 0; i--) {
        const e = moveEmitters[i];
        if (now >= e.until) {
            moveEmitters.splice(i, 1);
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
        drawParticle(ctx, p);
    }
    ctx.globalAlpha = 1;

    if (moveEmitters.length || moveParticles.length) {
        moveRaf = requestAnimationFrame(moveTick);
    } else {
        moveRaf = 0;
        moveLast = 0;
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

function useMove(pokemon) {
    const move = POKEMON_MOVES[pokemon.label];
    const current = pokemon.currentState;
    if (!move || !pokemon.canSwipe || current instanceof MoveState || current instanceof JumpState || current instanceof TumbleState) {
        return;
    }
    const flying = current instanceof FlyState;
    const left = flying ? current.dir < 0 : facingLeft(pokemon.el);
    if (flying) {
        // 공중에서 쓰고 계속 날기
        pokemon.holdState = current;
        pokemon.holdStateEnum = "swipe" /* States.swipe */;
    } else if (pokemon.currentStateEnum !== "swipe" /* States.swipe */) {
        // 마우스를 올려 멈춘 상태(swipe)면 그 전 상태를 그대로 두고 끝나면 돌아감
        pokemon.holdState = current;
        pokemon.holdStateEnum = pokemon.currentStateEnum;
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
        if (element.collision === e.currentTarget && !(performance.now() - (element.pokemon.el.dragEndAt ?? -1e9) < 300)) {
            useMove(element.pokemon);
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
        if (document.hidden) {
            return;
        }
        if (Math.random() < 1 / MOVE_AUTO_AVG_SEC) {
            const list = ready((key) => POKEMON_MOVES[key]);
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
