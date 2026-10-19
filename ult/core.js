
// ───── 필살기 — 1초 꾹 누르기 (설계 · 약속은 ult/SPEC.md) ─────
// ULT_LIB = [[이름, 틀, 옵션], …] 필살기 모음, POKEMON_ULT[키] = [ULT_LIB 번호, …] — make-moves.py 가 moves-data/*.json · 타입 기본(TYPE_ULTS)으로 만들어 넣음
// 틀은 ULT_FX — ult/fx-*.js 가 채움 (ms: 연출 시간, run: 그리기 시작). 여기는 누르기 · 기 모으기 · 시작 연출 · 도구 · 특수 틀
const ULT_HOLD_MS = 1000; // 이만큼 누르면 필살기
const ULT_CHARGE_FROM = 200; // 이때부터 기 모으기가 보임
const ULT_INTRO_MS = 900; // 어두워짐 · 컷인 · 큰 글씨
// 다시 보는 필살기 (게임 전투에서 같은 전투 · 같은 포켓몬 두 번째부터 — opt.quick) 는 컷인 · 번쩍 없이 이름만 짧게 (2026-10-20 ideas #101)
const ULT_QUICK_INTRO_MS = 300;
const ULT_OUTRO_MS = 500; // 다시 밝아짐
const ULT_DIM = 0.55; // 화면 어둡기
const ULT_CLASH_CHANCE = 0.5; // 꾹 눌러 필살기를 쓰면 이 확률로 멀리 있는 포켓몬이 자기 필살기로 받아침 (필살기 대결)
const ULT_VS_MS = 1500; // 대결 시작 연출 (위아래 두 컷인 · VS)
const ULT_FX = {};
let ultActive; // 지금 쓰는 중 { pokemon, until } — 한 번에 하나
let ultPress; // 누르는 중
const ultErrors = [];

// 필살기가 여러 개면 번갈아 — 주머니에서 하나씩 꺼내 다 나올 때까지 같은 걸 안 뽑음 (순서는 무작위, 주머니가 바뀔 때도 연달아 안 나옴)
const ULT_BAGS = {};
const ULT_LAST = {};
function ultBag(key) {
    const set = POKEMON_ULT[key];
    if (!set) {
        return undefined;
    }
    let bag = ULT_BAGS[key];
    if (!bag || !bag.length) {
        bag = ULT_BAGS[key] = set.slice();
        for (let i = bag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        if (bag.length > 1 && bag[bag.length - 1] === ULT_LAST[key]) {
            [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
        }
    }
    return bag;
}
// 다음에 나올 것 — 꺼내지 않고 보기만 (기 모으기 색)
const ultPeek = (key) => {
    const bag = ultBag(key);
    return bag && ULT_LIB[bag[bag.length - 1]];
};
// 꺼내기 — 실제로 쓸 때만 (1초 전에 떼면 안 꺼냄)
const ultEntry = (key) => {
    const bag = ultBag(key);
    if (!bag) {
        return undefined;
    }
    ULT_LAST[key] = bag.pop();
    return ULT_LIB[ULT_LAST[key]];
};
const ULT_SPECIALS = ['ultsplash', 'ultcopy', 'ultmetronome'];
// 틀마다 색을 안 줬을 때
const ULT_DEFAULT_C = { ultbeam: 'hyper', ultnova: 'hyper', ultvolt: 'electric', ultthunder: 'electric', ultpsy: 'psychic', ultshadow: 'ghost', ultblackhole: 'dark', ultsparkle: 'fairy', ultquake: 'ground', ultbloom: 'grass', ultvortex: 'water', ultsplash: 'water' };
const ULT_ORB_C = { energy: 'hyper', flame: 'fire', shadow: 'ghost', aura: 'aura', water: 'water', ice: 'ice', leaf: 'grass' };
const ultCols = (o, fx) => sigPal(o.c || (fx === 'ultorb' && ULT_ORB_C[o.style]) || ULT_DEFAULT_C[fx] || 'gold');
const ultClamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// 큰 마무리 — 전용 필살기(fx-unique.js)가 부름 (fx-sky.js 가 채움: bloom 거대한 꽃). 2026-10-19
const ULT_FINALE = {};
function ultFinale(kind, ...args) {
    try {
        ULT_FINALE[kind]?.(...args);
    } catch (err) {
        ultError(`finale ${kind}`, err);
    }
}
// fx-sky.js 의 그리기 도구 — 전용 필살기(fx-unique.js)가 씀
const ULT_KIT = {};
// 받침 — 받침 있으면 a, 없으면 b ("리자몽으로" · "피카츄로")
const josa = (word, a, b) => {
    const c = word.charCodeAt(word.length - 1) - 0xac00;
    const jong = c >= 0 && c <= 11171 ? c % 28 : 0;
    return jong === 0 || (a === '으로' && jong === 8) ? b : a;
};

// 필살기 쓰는 동안 — 제자리에서 멈춤 (until 까지)
class UltState extends MoveState {
    constructor(left, until, sprite) {
        super(left, 1e9, sprite);
        this.until = until;
    }
    nextFrame() {
        return performance.now() >= this.until ? states_1.FrameResult.stateComplete : states_1.FrameResult.stateContinue;
    }
}
// 필살기 중 움직이기 — fn(i, state) 가 true 를 돌려줄 때까지 0.1초마다, 그 뒤엔 끝날 때까지 멈춤
class UltMoveState extends UltState {
    constructor(left, until, fn) {
        super(left, until);
        this.fn = fn;
        this.i = 0;
        this.done = false;
    }
    nextFrame() {
        if (!this.done) {
            try {
                this.done = !!this.fn(this.i++, this);
            } catch (err) {
                this.done = true;
                ultError('ultMove', err);
            }
        }
        return super.nextFrame();
    }
}
// 맞아서 잠깐 멈춤 (떠오르는 동안 걸어가지 않게)
class UltFreezeState extends MoveState {
    constructor(left, until) {
        super(left, 1e9);
        this.until = until;
    }
    nextFrame() {
        return performance.now() >= this.until ? states_1.FrameResult.stateComplete : states_1.FrameResult.stateContinue;
    }
}

function ultError(where, err) {
    ultErrors.push(`${where}: ${err?.stack || err}`);
    console.error('[필살기]', where, err);
}

function ultBusy(p) {
    const c = p.currentState;
    return !!ultActive || !p.canSwipe || performance.now() < (p.clashUntil ?? 0) ||
        c instanceof DragState || c instanceof TumbleState || c instanceof FallState || c instanceof DashState || c instanceof SplashState || c instanceof JumpState || c instanceof UltState || c instanceof UltFreezeState;
}

// ── 꾹 누르기 ──
function handleUltPress(e) {
    if (e.button !== 0) {
        return;
    }
    const element = exports.allPokemon.pokemonCollection.find((el) => el.collision === e.currentTarget);
    if (!element || !POKEMON_ULT[element.pokemon.label] || !POKEMON_SHAPE[element.pokemon.label]) {
        return;
    }
    ultCancelPress();
    const p = element.pokemon;
    p.el.ultFired = false;
    const press = { pokemon: p, target: e.currentTarget, t0: performance.now(), anims: [] };
    press.end = () => ultCancelPress(press);
    press.chargeTimer = setTimeout(() => ultChargeStart(press), ULT_CHARGE_FROM);
    press.fireTimer = setTimeout(() => ultFire(press), ULT_HOLD_MS);
    press.target.addEventListener('pointerup', press.end);
    press.target.addEventListener('pointercancel', press.end);
    ultPress = press;
}

function ultCancelPress(press = ultPress) {
    if (!press || press !== ultPress) {
        return;
    }
    clearTimeout(press.chargeTimer);
    clearTimeout(press.fireTimer);
    press.target.removeEventListener('pointerup', press.end);
    press.target.removeEventListener('pointercancel', press.end);
    press.anims.forEach((a) => a.cancel());
    press.cancelled = true;
    ultPress = undefined;
}

// 기 모으기 — 빛 알갱이가 몸으로 빨려 들고, 발밑 고리가 차오르고, 몸이 점점 세게 떨림
function ultChargeStart(press) {
    const p = press.pokemon;
    if (ultBusy(p)) {
        return;
    }
    press.ult = ultPeek(p.label);
    const cols = ultCols(press.ult[2] || {}, press.ult[1]);
    const span = (ULT_HOLD_MS - ULT_CHARGE_FROM) / 1000;
    const prog = () => ultClamp((performance.now() - press.t0 - ULT_CHARGE_FROM) / (ULT_HOLD_MS - ULT_CHARGE_FROM), 0, 1);
    const S = Math.max(2, Math.round(spriteSize(p) / (p._originalSpriteSize || 32)));
    const tremble = (amp, n) => press.anims.push(p.el.animate([{ translate: `-${amp}px 0` }, { translate: `${amp}px 0` }], { duration: 40, iterations: n, direction: 'alternate', composite: 'add' }));
    tremble(0.6, 8);
    // 화면이 서서히 어두워짐 (누르는 애만 밝게) — 떼면 바로 사라짐
    ultDimLayer(() => 0.32 * prog(), span + 0.05, () => p, (q) => {
        if (press.cancelled) {
            q.life = q.max;
        }
    });
    press.anims.push({ cancel: clearTimeout.bind(null, setTimeout(() => tremble(1.2, 6), span * 400)) });
    press.anims.push({ cancel: clearTimeout.bind(null, setTimeout(() => tremble(2, 6), span * 700)) });
    sigParticle({ x: 0, y: 0, s: S, max: span + 0.05,
        update: (q, dt) => {
            if (press.cancelled) {
                q.life = q.max;
                return;
            }
            const k = prog();
            const r = p.collision.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height * 0.55;
            // 발밑에서 솟는 기운 — 갈수록 많이 · 높이
            q.rise = (q.rise ?? 0) + dt * (20 + 90 * k);
            while (q.rise >= 1) {
                q.rise -= 1;
                sigParticle({ x: r.left + moveRand(-0.1, 1.1) * r.width, y: r.bottom, s: S, vy: -moveRand(30, 70) * (1 + k), max: moveRand(0.3, 0.55), color: movePick(cols), size: 1, draw: (ctx, d, t, px) => {
                    ctx.globalAlpha = fadeInOut(t, 0.1, 0.5);
                    dotAt(ctx, px, d.s, d.x, d.y, d.color, 1, 2 + Math.round(2 * k));
                } });
            }
            q.acc = (q.acc ?? 0) + dt * (40 + 160 * k);
            while (q.acc >= 1) {
                q.acc -= 1;
                const a = moveRand(0, Math.PI * 2);
                const rr = Math.max(r.width, 28) * moveRand(1.1, 1.9);
                const x0 = cx + Math.cos(a) * rr;
                const y0 = cy + Math.sin(a) * rr * 0.8;
                sigParticle({ x: x0, y: y0, x0, y0, s: S, max: moveRand(0.22, 0.32), color: movePick(cols), size: Math.random() < 0.3 ? 2 : 1,
                    update: (d) => {
                        const f = Math.min(1, (d.life / d.max) ** 2);
                        d.x = d.x0 + (cx - d.x0) * f;
                        d.y = d.y0 + (cy - d.y0) * f;
                    },
                    draw: (ctx, d, t, px) => {
                        ctx.globalAlpha = Math.min(1, t * 4);
                        dotAt(ctx, px, d.s, d.x, d.y, d.color, d.size, d.size);
                    },
                });
            }
        },
        draw: (ctx, q, t, px) => {
            const k = prog();
            const r = p.collision.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            // 발밑 고리 — 점이 하나씩 차오름 (다 차면 필살기)
            const n = 28;
            const lit = Math.floor(k * n);
            const rx = r.width * 0.8 + 10;
            const ry = Math.max(5, r.width * 0.22);
            for (let j = 0; j < n; j++) {
                const a = -Math.PI / 2 + (j / n) * Math.PI * 2;
                ctx.globalAlpha = j < lit ? 1 : 0.3;
                dotAt(ctx, px, q.s, cx + Math.cos(a) * rx, r.bottom - q.s + Math.sin(a) * ry, j < lit ? cols[j % 2] : '#ffffff');
            }
            // 몸을 감싸는 빛 — 점점 커지고 밝게
            ctx.globalAlpha = 0.25 + 0.5 * k;
            const dots = 22;
            for (let j = 0; j < dots; j++) {
                const a = (j / dots) * Math.PI * 2 + q.life * (4 + 8 * k);
                const rr = (r.width * 0.5 + 3) * (1.25 - 0.25 * k);
                dotAt(ctx, px, q.s, cx + Math.cos(a) * rr, r.top + r.height * 0.55 + Math.sin(a) * rr * 0.9, cols[(j + 1) % 3]);
            }
        },
    });
}

function ultFire(press) {
    const p = press.pokemon;
    ultCancelPress(press);
    p.el.ultFired = true; // 손을 뗄 때 오는 click 은 일반 기술로 안 이어지게
    if (drag && drag.pokemon === p) {
        handleDragEnd(); // 아직 안 잡힌 잡기 추적 그만
    }
    if (!POKEMON_ULT[p.label] || ultBusy(p)) {
        return;
    }
    useUltimate(p, ultEntry(p.label), { clash: true }); // 기 모으기 때 본 것과 같은 것 (주머니 맨 끝) — 실제로 쓸 때만 꺼냄
}

// ── 필살기 쓰기 ──
// 특수 — 쓸 기술을 먼저 정함 (연출 시간을 알아야 해서)
const ULT_PRE = {
    // 손가락흔들기 — 다른 필살기 아무거나
    ultmetronome: (pokemon, name) => {
        const pool = ULT_LIB.filter((v) => !ULT_SPECIALS.includes(v[1]) && ULT_FX[v[1]]);
        const pick = pool.length ? movePick(pool) : ['울트라대시어택', 'ultgeneric', {}];
        return { ult: pick, sub: `${pokemon.name}의 ${name}!` };
    },
    // 변신 — 가장 가까운 포켓몬 모습으로 그 애의 필살기
    ultcopy: (pokemon, name) => {
        const me = pokemon.left + spriteSize(pokemon) / 2;
        const others = exports.allPokemon.pokemonCollection.map((el) => el.pokemon)
            .filter((q) => q !== pokemon && POKEMON_ULT[q.label] && POKEMON_ULT[q.label].some((i) => !ULT_SPECIALS.includes(ULT_LIB[i][1])))
            .sort((a, b) => Math.abs(a.left + spriteSize(a) / 2 - me) - Math.abs(b.left + spriteSize(b) / 2 - me));
        const q = others[0];
        if (!q) {
            return { ult: [name, 'ultgeneric', { c: 'hypno' }], sub: '그러나 변신할 상대가 없다!' };
        }
        const pool = POKEMON_ULT[q.label].map((i) => ULT_LIB[i]).filter((v) => !ULT_SPECIALS.includes(v[1]));
        const el = pokemon.el;
        const keep = { width: el.style.width };
        return {
            ult: movePick(pool),
            sub: `${pokemon.name}${josa(pokemon.name, '은', '는')} ${q.name}${josa(q.name, '으로', '로')} 변신했다!`,
            start: () => {
                const r = pokemon.collision.getBoundingClientRect();
                sigBurst(r.left + r.width / 2, r.top + r.height / 2, 2, ['#ffffff', '#e6c8ff', '#c99cff'], 24, 90);
                el.style.width = `${spriteSize(q)}px`;
                el.src = `${q.pokemonRoot}_walk_8fps.gif`; // 이름 끝이 _walk_8fps.gif 면 매 프레임 그림 바꾸기가 그대로 둠
            },
            end: () => {
                el.style.width = keep.width;
                el.src = `${pokemon.pokemonRoot}_walk_8fps.gif`;
            },
        };
    },
    // 튀어오르기 — 가끔 갸라도스로
    ultsplash: (pokemon, name, o) => ({ ult: [name, 'ultsplash', { ...o, gyarados: o.gyarados ?? Math.random() < 0.15 }] }),
};

function useUltimate(pokemon, ult, opt = {}) {
    if (opt.clash && !ULT_SPECIALS.includes(ult[1]) && Math.random() < ULT_CLASH_CHANCE) {
        const rival = ultFindRival(pokemon);
        if (rival) {
            return ultClash(pokemon, ult, rival);
        }
    }
    let [name, fx, o = {}] = ult;
    let sub = `${pokemon.name}의 필살기!`;
    let pre;
    if (ULT_PRE[fx]) {
        pre = ULT_PRE[fx](pokemon, name, o);
        [name, fx, o = {}] = pre.ult;
        sub = pre.sub ?? sub;
    }
    const T = ULT_FX[fx] || ULT_FX.ultgeneric;
    if (!ULT_FX[fx]) {
        ultError('useUltimate', `없는 틀 ${fx} — ultgeneric 으로`);
    }
    const left = pokemon.left + spriteSize(pokemon) / 2 > window.innerWidth / 2; // 화면 가운데 쪽을 보고
    const P = POKEMON_SHAPE[pokemon.label][0];
    let ms = 3000;
    try {
        ms = ultClamp(T.ms(P, o) || 3000, 800, 15000); // 길이 상한 15초 (2026-10-19 태현 님: 어떤 포켓몬이든 길고 화려하게 만들 수 있게)
    } catch (err) {
        ultError(`${fx}.ms`, err);
    }
    const now = performance.now();
    const introMs = opt.quick ? ULT_QUICK_INTRO_MS : ULT_INTRO_MS;
    const until = now + introMs + ms + ULT_OUTRO_MS;
    const current = pokemon.currentState;
    if (current instanceof FlyState) {
        // 공중에서 쓰고 계속 날기
        pokemon.holdState = current;
        pokemon.holdStateEnum = "swipe" /* States.swipe */;
    } else if (pokemon.currentStateEnum !== "swipe" /* States.swipe */) {
        pokemon.holdState = current;
        pokemon.holdStateEnum = pokemon.currentStateEnum;
    }
    pokemon.currentStateEnum = "swipe" /* States.swipe */;
    pokemon.currentState = new UltState(left, until);
    pokemon.hideSpeechBubble();
    ultActive = { pokemon, until, name, fx, pre };
    // 필살기 동안은 효과를 앞쪽 풀 · 나무 위로 (평소엔 그 밑)
    moveCanvasReady();
    moveCanvas.style.zIndex = '6';
    if (o.tint) {
        pokemon.el.style.filter = o.tint;
    }
    try {
        pre?.start?.();
        ultIntro(pokemon, left, name, sub, o, fx, until, introMs);
    } catch (err) {
        ultError('intro', err);
    }
    setTimeout(() => {
        try {
            T.run(ultGeometry(pokemon, left), o, ms, pokemon);
        } catch (err) {
            ultError(`${fx}.run`, err);
        }
    }, introMs);
    setTimeout(() => ultEnd(pokemon), until - now);
    return until - now;
}

// ── 필살기 대결 ──
// 받아칠 상대 — 땅에 있고 한가하고 몸길이 2.5배 넘게 떨어진 애 중 가장 먼 애 (특수 필살기뿐인 잉어킹 · 메타몽은 빼고)
function ultFindRival(a) {
    if (a.bottom > a.floor + 1) {
        return undefined;
    }
    const w = spriteSize(a);
    let best;
    for (const el of exports.allPokemon.pokemonCollection) {
        const q = el.pokemon;
        const c = q.currentState;
        if (q === a || !POKEMON_SHAPE[q.label] || !(POKEMON_ULT[q.label] || []).some((i) => !ULT_SPECIALS.includes(ULT_LIB[i][1])) || !q.canSwipe ||
            q.bottom > q.floor + 1 || performance.now() < (q.clashUntil ?? 0) ||
            c instanceof DragState || c instanceof TumbleState || c instanceof FallState || c instanceof DashState || c instanceof SplashState || c instanceof JumpState || c instanceof UltState || c instanceof UltFreezeState) {
            continue;
        }
        const d = Math.abs(q.left - a.left);
        if (d >= w * 2.5 && (!best || d > best.d)) {
            best = { q, d };
        }
    }
    return best?.q;
}

// 대결 — 위아래 두 컷인 · VS → 서로의 고유 필살기가 가운데서 맞부딪혀 밀고 밀림 (ult/duel.js) → 센 쪽 필살기가 뚫고 나가 진 쪽에서 터짐 / 무승부
function ultClash(a, ultA, b, ultB, force) {
    if (!ultB) {
        // 받아치는 쪽도 번갈아 — 특수 필살기(손가락흔들기 등)가 나오면 다른 것으로
        const next = ultEntry(b.label);
        ultB = next && !ULT_SPECIALS.includes(next[1]) ? next : movePick(POKEMON_ULT[b.label].map((i) => ULT_LIB[i]).filter((v) => !ULT_SPECIALS.includes(v[1])));
    }
    const leftA = b.left < a.left;
    const leftB = !leftA;
    const D = duelPlan(a, ultA, leftA, b, ultB, leftB, force);
    const total = ULT_VS_MS / 1000 + D.total;
    const now = performance.now();
    const until = now + total * 1000;
    for (const [p, left, u] of [[a, leftA, ultA], [b, leftB, ultB]]) {
        const current = p.currentState;
        if (p.currentStateEnum !== "swipe" /* States.swipe */) {
            p.holdState = current;
            p.holdStateEnum = p.currentStateEnum;
        }
        p.currentStateEnum = "swipe" /* States.swipe */;
        p.currentState = new UltState(left, until);
        p.clashUntil = until;
        p.hideSpeechBubble();
        if (u[2]?.tint) {
            p.el.style.filter = u[2].tint;
        }
    }
    ultActive = { pokemon: a, rival: b, until, name: ultA[0], fx: 'clash' };
    moveCanvasReady();
    moveCanvas.style.zIndex = '6';
    try {
        ultVsIntro(a, ultA, leftA, b, ultB, leftB, total);
    } catch (err) {
        ultError('vs', err);
    }
    setTimeout(() => {
        try {
            duelStart(D);
        } catch (err) {
            ultError('duel', err);
        }
    }, ULT_VS_MS);
    setTimeout(() => {
        ultActive = undefined;
        if (moveCanvas) {
            moveCanvas.style.zIndex = '4';
        }
        for (const p of [a, b]) {
            p.el.style.filter = '';
            p.el.style.visibility = '';
        }
    }, total * 1000);
    return total * 1000;
}

// 대결 시작 — 번쩍 · 어두워짐(둘만 밝음) · 위 띠에 쓰는 애, 아래 띠에 받아친 애 · 가운데 VS 쾅
function ultVsIntro(a, ultA, leftA, b, ultB, leftB, total) {
    const ca = ultCols(ultA[2] || {}, ultA[1]);
    const cb = ultCols(ultB[2] || {}, ultB[1]);
    const sec = ULT_VS_MS / 1000;
    const outro = ULT_OUTRO_MS / 1000;
    screenFlash(2, 0.7, '#ffffff', 0.25);
    for (const [p, cols] of [[a, ca], [b, cb]]) {
        const r = p.collision.getBoundingClientRect();
        sigRing(r.left + r.width / 2, r.top + r.height / 2, 2, 4, Math.max(r.width, 30) * 2.2, 1, 0.4, [cols[0], '#ffffff', cols[1]]);
        sigBurst(r.left + r.width / 2, r.top + r.height / 2, 2, [...cols, '#ffffff'], 20, 110);
    }
    ultDimLayer((life) => ULT_DIM * Math.min(1, life / 0.25) * (life > total - outro ? Math.max(0, (total - life) / outro) : 1), total, () => [a, b]);
    // 입자는 나중 것부터 그려서 — 글씨를 띠보다 먼저 만들어야 위에 보임
    ultTitle(ultA[0], `${a.name}의 필살기!`, ultA[2]?.tc ? sigPal(ultA[2].tc) : null, sec + 0.4, 0.22, 0.72);
    ultCutIn(a, leftA, ca, sec, 0.22, 0.26);
    setTimeout(() => {
        screenFlash(2, 0.4, '#ffffff', 0.2);
        ultTitle(ultB[0], `${b.name}의 필살기!`, ultB[2]?.tc ? sigPal(ultB[2].tc) : null, sec + 0.15, 0.66, 0.72);
        ultCutIn(b, leftB, cb, sec - 0.25, 0.66, 0.26);
    }, 250);
    setTimeout(() => {
        ultShake(4, 300);
        ultTitle('VS', null, ['#ffffff', '#ffe0d0', '#ff5a3c', '#7a0a0a'], sec - 0.35, 0.44, 1.25);
    }, 450);
}

function ultEnd(pokemon) {
    try {
        ultActive?.pre?.end?.();
    } catch (err) {
        ultError('end', err);
    }
    ultActive = undefined;
    if (moveCanvas) {
        moveCanvas.style.zIndex = '4';
    }
    pokemon.el.style.filter = '';
    pokemon.el.style.visibility = '';
}

// 쓰는 순간의 위치 · 크기 (SPEC.md 의 u)
function ultGeometry(pokemon, left) {
    const g = sigGeometry(pokemon, left);
    const rect = pokemon.collision.getBoundingClientRect();
    return {
        ...g, pokemon,
        S: Math.max(2, Math.round(g.s)),
        W: window.innerWidth, H: window.innerHeight,
        ground: Math.min(window.innerHeight, rect.bottom + Math.max(0, pokemon.bottom - pokemon.floor)),
        R: Math.max(g.w, 40),
        others: () => ultOthers(pokemon),
    };
}

// ── 시작 연출 — 번쩍 · 어두워짐(쓰는 애만 동그랗게 밝음) · 컷인 · 큰 글씨 ──
function ultIntro(pokemon, left, name, sub, o, fx, until, introMs = ULT_INTRO_MS) {
    const cols = ultCols(o, fx);
    const total = (until - performance.now()) / 1000;
    const r = pokemon.collision.getBoundingClientRect();
    const S = Math.max(2, Math.round(r.width / (pokemon._originalSpriteSize || 32)));
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const quick = introMs < ULT_INTRO_MS;
    if (!quick) {
        screenFlash(S, 0.7, '#ffffff', 0.25);
    }
    sigRing(cx, cy, S, 4, Math.max(r.width, 30) * 2.2, 1, 0.4, [cols[0], '#ffffff', cols[1]]);
    sigBurst(cx, cy, S, [...cols, '#ffffff'], 26, 120);
    // 어둠 — 끝 0.5초 동안 다시 밝아짐
    const outro = ULT_OUTRO_MS / 1000;
    ultDimLayer((life) => ULT_DIM * Math.min(1, life / 0.25) * (life > total - outro ? Math.max(0, (total - life) / outro) : 1), total);
    // 몸에서 피어오르는 기운 (시작 연출 동안)
    sigEmitter({ until: performance.now() + introMs + 300, rate: 50, fx: () => {
        const b = pokemon.collision.getBoundingClientRect();
        sigParticle({ x: b.left + moveRand(0, b.width), y: b.bottom - moveRand(0, 0.3) * b.height, s: S, vy: -moveRand(40, 90) * S / 2, vx: moveRand(-6, 6), max: moveRand(0.4, 0.7), color: movePick(cols), size: movePick([1, 1, 2]), draw: (ctx, p, t, px) => {
            ctx.globalAlpha = fadeInOut(t, 0.1, 0.5);
            dotAt(ctx, px, p.s, p.x, p.y, p.color, p.size, p.size * 2);
        } });
    } });
    // 입자는 나중 것부터 그려서 — 글씨를 먼저 만들어야 띠 위에 보임
    // 다시 보는 필살기는 컷인 띠 없이 이름만 짧게
    ultTitle(name, sub, o.tc ? sigPal(o.tc) : null, introMs / 1000 + (quick ? 0.6 : 0.9));
    if (!quick) {
        ultCutIn(pokemon, left, cols, ULT_INTRO_MS / 1000);
    }
}

// 어둠 한 겹 — alphaAt(life) 로 진하기, 쓰는 애 둘레만 동그랗게 비움. 먼저 그린 효과 밑으로 깔림
function ultDimLayer(alphaAt, sec, who = () => ultActive?.pokemon, update) {
    sigParticle({ x: 0, y: 0, s: 1, max: sec, update, draw: (ctx, p) => {
        const a = alphaAt(p.life);
        if (a <= 0.005) {
            return;
        }
        const W = window.innerWidth;
        const H = window.innerHeight;
        ctx.save();
        // 게임 모드 — HP 묶음 자리는 어둡게 안 칠함 (HP 가 주는 순간이 보이게, ult/bridge.js fxHudRects)
        const huds = typeof fxHudRects === 'function' ? fxHudRects() : [];
        if (huds.length) {
            ctx.beginPath();
            ctx.rect(0, 0, W, H);
            for (const h of huds) {
                ctx.rect(h.left - 2, h.top - 2, h.width + 4, h.height + 4);
            }
            ctx.clip('evenodd');
        }
        ctx.globalCompositeOperation = 'destination-over';
        ctx.globalAlpha = Math.min(0.95, a);
        ctx.fillStyle = '#05080f';
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        for (const u of [].concat(who() || [])) {
            if (u.el.style.visibility === 'hidden') {
                continue;
            }
            const r = u.collision.getBoundingClientRect();
            const R = typeof fxInGame === 'function' && fxInGame() ? Math.max(r.width, r.height) * 0.6 + 4 : Math.max(r.width, r.height) * 0.8 + 6;
            const x = r.left + r.width / 2;
            const y = r.top + r.height / 2;
            ctx.moveTo(x + R, y);
            ctx.arc(x, y, R, 0, Math.PI * 2);
        }
        ctx.fill('evenodd');
        ctx.restore();
        ctx.globalCompositeOperation = 'source-over';
    } });
}

// 캔버스에 그림을 그릴 때 좌우로 뒤집을지 — 왼쪽 그림(_walk_left_)이 따로 있는 포켓몬은 이미 왼쪽을 봄
const ultFlip = (img, left) => left && !img.src.includes('_left_');

// 컷인 — 가로 띠가 열리고 큰 그림이 휙 지나감 (속도선). yc = 띠 가운데 높이(패널 비율), hf = 띠 굵기
function ultCutIn(pokemon, left, cols, sec, yc = 0.36, hf = 0.3) {
    const img = pokemon.el;
    const dir = left ? -1 : 1;
    sigParticle({ x: 0, y: 0, s: 2, max: sec, lines: [], draw: (ctx, p) => {
        const W = window.innerWidth;
        const H = window.innerHeight;
        const t = p.life / p.max;
        const bh = Math.round(ultClamp(H * hf, 40, 120));
        const open = t < 0.14 ? t / 0.14 : t > 0.86 ? (1 - t) / 0.14 : 1;
        const h = Math.max(2, Math.round(bh * open));
        const y0 = Math.round(H * yc - h / 2);
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = cols[3];
        ctx.fillRect(0, y0, W, h);
        ctx.globalAlpha = 1;
        ctx.fillStyle = cols[1];
        ctx.fillRect(0, y0, W, 2);
        ctx.fillRect(0, y0 + h - 2, W, 2);
        // 속도선 — 보는 쪽 반대로 휙휙
        for (let i = 0; i < 18; i++) {
            const seed = (i * 7919) % 97;
            const ly = y0 + 3 + ((seed * 13) % Math.max(1, h - 6));
            const len = 20 + (seed % 5) * 14;
            const x = ((seed * 31 - dir * p.life * (900 + seed * 9)) % (W + len) + W + len) % (W + len) - len;
            ctx.globalAlpha = 0.5 + (seed % 3) * 0.2;
            ctx.fillStyle = seed % 2 ? cols[0] : cols[2];
            ctx.fillRect(Math.round(x), Math.round(ly), len, 2);
        }
        // 큰 그림 — 띠보다 살짝 크게, 천천히 앞으로
        if (open > 0.6 && img.naturalWidth) {
            const nh = img.naturalHeight;
            const dh = typeof fxInGame === 'function' && fxInGame() ? nh * Math.max(1, Math.round((bh * 1.25) / nh)) : Math.round(bh * 1.25);
            const dw = Math.round(dh * (img.naturalWidth / img.naturalHeight));
            const slide = ultClamp((t - 0.1) / 0.25, 0, 1);
            const ease = 1 - (1 - slide) ** 3;
            const xc = W / 2 - dir * W * 0.22 + dir * (1 - ease) * -W * 0.6 + dir * t * W * 0.06;
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            ctx.globalAlpha = Math.min(1, open);
            ctx.beginPath();
            ctx.rect(0, y0, W, h);
            ctx.clip();
            ctx.translate(Math.round(xc), Math.round(y0 + h - dh * 0.92));
            if (ultFlip(img, left)) {
                ctx.scale(-1, 1);
            }
            ctx.drawImage(img, -dw / 2, 0, dw, dh);
            ctx.restore();
        }
    } });
}

// 큰 글씨 — 크게 쾅 박혔다가 자리 잡음, 반짝 지나감. cols 를 주면 그 색으로 (기본 금색), yc = 높이(패널 비율), k = 크기 배수
// 필살기 글자 글꼴 — 게임 모드는 게임 글꼴 (Pretendard, 가변 굵기라 900 그대로), 일반 모드는 그대로
const ultFont = () => (typeof fxInGame === 'function' && fxInGame() ? "'Pretendard', sans-serif" : 'sans-serif');
function ultTitle(text, sub, cols, sec, yc = 0.36, k0 = 1) {
    const C = cols || ['#fffbe0', '#ffe680', '#f5c400', '#b88a00'];
    sigParticle({ x: 0, y: 0, s: 2, max: sec, draw: (ctx, p) => {
        const W = window.innerWidth;
        const H = window.innerHeight;
        const t = p.life;
        const inT = 0.16;
        const k = Math.min(1, t / inT);
        const back = 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2; // 살짝 넘쳤다 돌아옴
        const scale = t < inT ? 2.4 - 1.4 * back : 1;
        const alpha = Math.min(1, t / 0.06) * (t > p.max - 0.3 ? Math.max(0, (p.max - t) / 0.3) : 1);
        let size = Math.round(ultClamp(W / 9, 18, 40) * k0);
        const font = ultFont();
        ctx.save();
        ctx.font = `900 ${size}px ${font}`;
        const tw = ctx.measureText(text).width;
        if (tw > W * 0.9) {
            size = Math.max(12, Math.floor((size * W * 0.9) / tw));
            ctx.font = `900 ${size}px ${font}`;
        }
        const jx = t < 0.35 ? moveRand(-1, 1) * 2 : 0;
        // 게임 모드 — 부제까지 정보줄 아래에 (연출 캔버스 위쪽은 정보줄 아래 끝에서 잘림)
        const top = typeof fxTop === 'function' ? fxTop() : 0;
        const yMin = top ? top + (sub ? size * 0.85 + Math.max(10, Math.round(size * 0.4)) / 2 : size / 2) + 4 : 0;
        ctx.translate(Math.round(W / 2 + jx), Math.round(Math.max(H * yc, yMin)));
        ctx.scale(scale, scale);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = alpha;
        ctx.lineWidth = Math.max(5, size / 4);
        ctx.strokeStyle = 'rgba(10, 5, 0, 0.9)';
        ctx.strokeText(text, 0, 0);
        ctx.lineWidth = Math.max(2, size / 9);
        ctx.strokeStyle = C[3];
        ctx.strokeText(text, 0, 0);
        const grad = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, C[0]);
        grad.addColorStop(0.62, C[1]);
        grad.addColorStop(1, C[2]);
        ctx.fillStyle = grad;
        ctx.fillText(text, 0, 0);
        // 반짝 — 글씨 위로 하얀 빛이 비스듬히 지나감
        const sweep = (t - 0.25) / 0.35;
        if (sweep > 0 && sweep < 1) {
            const w2 = ctx.measureText(text).width / 2 + size;
            ctx.save();
            ctx.beginPath();
            const x = -w2 + sweep * 2 * w2;
            ctx.moveTo(x - size * 0.5, -size);
            ctx.lineTo(x + size * 0.1, -size);
            ctx.lineTo(x - size * 0.1, size);
            ctx.lineTo(x - size * 0.7, size);
            ctx.closePath();
            ctx.clip();
            ctx.globalAlpha = alpha * 0.85;
            ctx.fillStyle = '#ffffff';
            ctx.fillText(text, 0, 0);
            ctx.restore();
        }
        if (sub) {
            const ss = Math.max(10, Math.round(size * 0.4));
            ctx.font = `bold ${ss}px ${font}`;
            ctx.lineWidth = 3;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
            ctx.strokeText(sub, 0, -size * 0.85);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(sub, 0, -size * 0.85);
        }
        ctx.restore();
    } });
}

// ── 연출 틀이 쓰는 도구 (SPEC.md) ──
// 맞을 수 있는 다른 포켓몬
function ultOthers(pokemon) {
    // 게임 모드 전투 (ult/bridge.js) — 맞을 상대 = 게임 상대 (일반 모드 포켓몬은 숨어 있음)
    if (typeof fxGameTargets === 'function' && fxGameTargets()) {
        return fxGameTargets();
    }
    return exports.allPokemon.pokemonCollection.map((el) => el.pokemon)
        .filter((q) => q !== pokemon && q !== ultActive?.pokemon && !(q.currentState instanceof DragState))
        .map((q) => {
            const r = q.collision.getBoundingClientRect();
            return { pokemon: q, x: r.left + r.width / 2, y: r.top + r.height / 2, bottom: r.bottom, w: r.width, h: r.height };
        });
}

// 다른 포켓몬 · 앞쪽 풀 · 효과를 흔듦 (쓰는 애는 그대로) — 새 흔들림이 앞 것을 대신함 (겹쳐 더해지면 화면 끝이 크게 비어서)
function ultShake(amp = 3, ms = 600) {
    const n = Math.max(2, Math.round(ms / 50));
    amp = Math.min(amp, 12);
    const shake = (el, a = amp) => {
        if (!el) {
            return;
        }
        el.ultShakeAnim?.cancel();
        el.ultShakeAnim = el.animate([{ translate: `-${a}px 0` }, { translate: `${a}px ${a * 0.3}px` }], { duration: 50, iterations: n, direction: 'alternate', composite: 'add' });
    };
    exports.allPokemon.pokemonCollection.forEach((el) => el.pokemon !== ultActive?.pokemon && shake(el.el));
    shake(document.getElementById('foreground'), amp / 2); // 앞쪽 풀은 반만 — 화면 끝이 덜 비게
    // 게임 모드 — 배경 · 포켓몬 · 트레이너만 부드럽게 (HP · 메뉴 글자는 안 떨게 · 캔버스도 안 흔듦, ult/bridge.js)
    if (typeof fxInGame === 'function' && fxInGame()) {
        fxGameShake(amp / 2);
    } else {
        shake(moveCanvas);
    }
}

function ultFreeze(p, ms) {
    const c = p.currentState;
    if (c instanceof UltState || c instanceof UltFreezeState || c instanceof TumbleState || c instanceof DragState) {
        return;
    }
    if (c instanceof FlyState) {
        p.holdState = c;
        p.holdStateEnum = "swipe" /* States.swipe */;
    } else if (!(c instanceof MoveState) && p.currentStateEnum !== "swipe" /* States.swipe */) {
        p.holdState = c;
        p.holdStateEnum = p.currentStateEnum;
    }
    p.currentStateEnum = "swipe" /* States.swipe */;
    p.currentState = new UltFreezeState(c.horizontalDirection === states_1.HorizontalDirection.left, performance.now() + ms);
}

// 다른 포켓몬 맞히기 — tumble(뒤로 밀려 벌러덩) · lift(떠올랐다 툭) · spin(빙글 돌며 떠오름) · shake
function ultHit(q, dir = 1, kind = 'tumble') {
    const p = q?.pokemon ?? q;
    if (!p || !p.el || p === ultActive?.pokemon || p.currentState instanceof DragState) {
        return;
    }
    const now = performance.now();
    // 맞는 동작(떠오름 1.5초 · 벌러덩 1.7초)이 끝나기 전엔 다시 안 맞음 — 겹치면 그림이 꼬여서. 흔들림은 그 사이 건너뜀
    if (now < (p.el.ultHitUntil ?? 0) || (kind === 'shake' && now < (p.el.ultShakeUntil ?? 0))) {
        return;
    }
    if (kind === 'shake') {
        p.el.ultShakeUntil = now + 550;
    } else {
        p.el.ultHitUntil = now + (kind === 'tumble' ? 1700 : 1500);
    }
    const w = spriteSize(p);
    dir = dir < 0 ? -1 : 1;
    if (kind === 'shake') {
        p.el.animate([{ translate: '-3px 0' }, { translate: '3px 0' }], { duration: 45, iterations: 12, direction: 'alternate', composite: 'add' });
        return;
    }
    if (kind === 'lift' || kind === 'spin') {
        const ms = 1500;
        ultFreeze(p, ms);
        const up = Math.min(window.innerHeight * 0.4, w * 2 + 24);
        const spin = kind === 'spin';
        p.el.animate([
            { translate: '0 0', rotate: '0deg', easing: 'ease-out' },
            { translate: `0 -${up}px`, rotate: spin ? `${dir * 360}deg` : `${dir * 14}deg`, offset: 0.35 },
            { translate: `0 -${up * 0.9}px`, rotate: spin ? `${dir * 540}deg` : `${-dir * 10}deg`, offset: 0.7, easing: 'ease-in' },
            { translate: '0 0', rotate: spin ? `${dir * 720}deg` : '0deg', offset: 0.9 },
            { translate: '0 -4px', rotate: spin ? `${dir * 720}deg` : '0deg', offset: 0.95 },
            { translate: '0 0', rotate: spin ? `${dir * 720}deg` : '0deg', offset: 1 },
        ], { duration: ms, composite: 'add' });
        setTimeout(() => {
            const r = p.collision.getBoundingClientRect();
            sigBurst(r.left + r.width / 2, r.bottom, 2, ['#d1b178', '#a88a55', '#ffffff'], 8, 40);
        }, ms * 0.9);
        return;
    }
    // tumble — 공중이면 떨어져서, 땅이면 뒤로 밀려 벌러덩
    p.holdState = undefined;
    p.holdStateEnum = undefined;
    p.currentStateEnum = "swipe" /* States.swipe */;
    if (p.bottom > p.floor + 1) {
        p.currentState = new FallState(p, dir > 0);
        return;
    }
    knockBack(p, dir > 0, dir, w * 0.7);
}

// x 가 x0~x1 안인 다른 포켓몬 모두 — 쓰는 애에게서 멀어지는 쪽으로
function ultHitIn(u, x0, x1, kind = 'tumble') {
    const lo = Math.min(x0, x1);
    const hi = Math.max(x0, x1);
    u.others().forEach((q) => {
        if (q.x + q.w / 2 >= lo && q.x - q.w / 2 <= hi) {
            ultHit(q, Math.sign(q.x - u.body.cx) || u.dir, kind);
        }
    });
}

// 기본 어둠 위에 더 어둡게 (alpha 만큼, ms 동안 — 앞뒤 0.2초는 서서히)
function ultDark(alpha = 0.3, ms = 1000) {
    const sec = ms / 1000;
    ultDimLayer((life) => alpha * Math.min(1, life / 0.2, (sec - life) / 0.2), sec);
}

// 포켓몬을 움직이기 (돌진 · 다이브 · 끌려감) — fn(i, state) 가 true 면 끝, 그 뒤엔 멈춤
// 쓰는 애는 필살기가 끝날 때까지, 다른 애는 ms 동안 (기본 5초)
function ultMove(pokemon, fn, ms) {
    const cur = pokemon.currentState;
    const left = cur?.horizontalDirection === states_1.HorizontalDirection.left;
    const until = ultActive?.pokemon === pokemon ? ultActive.until : performance.now() + (ms ?? 5000);
    pokemon.currentStateEnum = "swipe" /* States.swipe */;
    pokemon.currentState = new UltMoveState(left, until, fn);
    return pokemon.currentState;
}

// 그림 숨기기 · 다시 보이기 (화면 밖으로 날아간 동안)
function ultHide(pokemon, on) {
    pokemon.el.style.visibility = on ? 'hidden' : '';
}

// ── 특수 · 예비 틀 ──
Object.assign(ULT_FX, {
    // 틀이 없을 때 대신 — 기운이 솟구치고 몸에서 빛이 터짐
    ultgeneric: {
        ms: () => 2200,
        run: (u, o) => {
            const cols = ultCols(o, 'ultgeneric');
            const P = 0.4 + 0.6 * u.P;
            sigEmitter({ until: performance.now() + 900, rate: 90, fx: () => sigParticle({
                x: u.body.cx + moveRand(-1, 1) * u.body.rx * 1.4, y: u.ground, s: u.S, vy: -moveRand(60, 160), max: moveRand(0.5, 0.9), color: movePick(cols), size: movePick([1, 2]), draw: DRAW.dot,
            }) });
            setTimeout(() => {
                screenFlash(u.S, 0.6, '#ffffff', 0.35);
                ultShake(3 + 2 * P, 700);
                for (let k = 0; k < 3; k++) {
                    setTimeout(() => sigRing(u.body.cx, u.body.cy, u.S, 4, u.R * (2 + k) * P + u.W * 0.15 * k, 0.7, 0.6, [cols[0], cols[2], '#ffffff']), k * 120);
                }
                sigBurst(u.body.cx, u.body.cy, u.S, [...cols, '#ffffff'], 60, 220);
                u.others().forEach((q) => Math.abs(q.x - u.body.cx) < u.W * 0.35 && ultHit(q, Math.sign(q.x - u.body.cx) || u.dir, 'tumble'));
            }, 900);
        },
    },
    // 튀어오르기 MAX — 온 힘을 모아 화면 끝까지 튀어올랐다… 아무 일도 / 가끔 갸라도스로 변해 파괴광선
    ultsplash: {
        ms: (P, o) => (o.gyarados ? 5200 : 3200),
        run: (u, o, ms, pokemon) => {
            const cols = sigPal('water');
            const top = Math.max(u.ground - u.h, u.H * 0.12);
            const floor = pokemon.bottom;
            const peak = floor + (u.ground - top) * 0.92;
            // 0.9초 모으기 — 바들바들 + 물방울
            pokemon.el.animate([{ translate: '-1px 0' }, { translate: '1px 0' }], { duration: 40, iterations: 22, direction: 'alternate', composite: 'add' });
            sigEmitter({ until: performance.now() + 900, rate: 40, fx: () => sigParticle({ x: u.body.cx + moveRand(-1, 1) * u.body.rx, y: u.body.bottom, s: u.S, vx: moveRand(-30, 30), vy: -moveRand(40, 90), g: 220, max: 0.6, color: movePick(cols), draw: DRAW.dot }) });
            setTimeout(() => {
                sigRing(u.body.cx, u.ground, u.S, 4, u.R * 1.8, 0.3, 0.5, [cols[1], '#ffffff']);
                ultMove(pokemon, (i) => {
                    // 5프레임 오르기 · 4프레임 멈칫 · 5프레임 내려오기 · 작게 퐁퐁
                    const seq = [0.35, 0.65, 0.85, 0.96, 1, 1, 1, 0.99, 0.97, 0.75, 0.45, 0.15, 0, 0.12, 0, 0.05, 0];
                    pokemon.positionBottom(floor + (peak - floor) * (seq[i] ?? 0));
                    return i >= seq.length - 1;
                });
            }, 900);
            setTimeout(() => {
                sigBurst(u.body.cx, u.ground, u.S, cols, 16, 70);
                if (!o.gyarados) {
                    ultTitle('그러나 아무 일도 일어나지 않았다!', null, sigPal('silver'), 1.7);
                    return;
                }
                // 갸라도스로!? — 그림을 바꾸고 크게, 파괴광선
                const el = pokemon.el;
                const keep = { src: el.src, scale: el.style.scale, origin: el.style.transformOrigin };
                const gy = pokemon.pokemonRoot.replace(/\/magikarp(_[^/]*)?\//, '/gyarados/');
                screenFlash(u.S, 0.8, '#ffffff', 0.4);
                el.style.transformOrigin = '50% 100%';
                el.style.scale = '2';
                el.src = `${gy}_walk_8fps.gif`;
                ultTitle('…갸라도스!?', null, sigPal('hyper'), 1.2);
                setTimeout(() => {
                    const g2 = ultGeometry(pokemon, u.left);
                    const beam = ULT_FX.ultbeam || ULT_FX.ultgeneric;
                    try {
                        beam.run({ ...g2, mouth: { x: g2.mouth.x + u.dir * g2.w * 0.5, y: g2.mouth.y - g2.h * 0.6 }, P: 1 }, { c: 'hyper', width: 1.3, sparkle: 'hyper' }, 2000, pokemon);
                    } catch (err) {
                        ultError('ultsplash.gyarados', err);
                    }
                }, 700);
                setTimeout(() => {
                    el.style.scale = keep.scale;
                    el.style.transformOrigin = keep.origin;
                    el.src = `${pokemon.pokemonRoot}_walk_8fps.gif`;
                }, ms - 200);
            }, 900 + 1700);
        },
    },
});

// 미리보기 · 점검용 (dev/panel.html) — 웹뷰 안에서만 보임
window.__ult = {
    errors: ultErrors,
    fx: () => Object.keys(ULT_FX),
    lib: () => ULT_LIB,
    of: (key) => (POKEMON_ULT[key] || []).map((i) => ULT_LIB[i]),
    count: () => moveParticles.length,
    active: () => !!ultActive,
    list: () => exports.allPokemon.pokemonCollection.map((el) => el.pokemon.label),
    info: (key) => pokemon_data_1.POKEMON_DATA[key],
    pick(i) {
        const all = exports.allPokemon.pokemonCollection.map((el) => el.pokemon);
        return typeof i === 'number' ? all[i] : all.find((p) => p.label === i);
    },
    place(i, x) {
        const p = this.pick(i);
        p.positionLeft(Math.min(Math.max(0, x), rightEdge(p)));
        p.el.glideAnim?.cancel?.();
    },
    // 필살기 — spec 을 주면 그걸로 ([이름, 틀, 옵션])
    fire(i = 0, spec) {
        const p = this.pick(i);
        ultActive = undefined;
        return useUltimate(p, spec || ultEntry(p.label));
    },
    // 필살기 대결 — i 가 쓰고 j 가 받아침 (ua · ub 를 주면 그 필살기로)
    clash(i = 0, j = 1, ua, ub, force) {
        ultActive = undefined;
        const a = this.pick(i);
        const pool = (POKEMON_ULT[a.label] || []).map((k) => ULT_LIB[k]).filter((v) => !ULT_SPECIALS.includes(v[1]));
        return ultClash(a, ua || movePick(pool), this.pick(j), ub, force);
    },
    kind: (fx, o) => duelKind(fx, o), // 대결 모양 종류 (duel.js 가 뒤에 붙어서 함수로)
    // 클릭 기술 하나를 정해서 (점검 · 사진용) — left 면 왼쪽을 보고
    sig(i = 0, spec, left = false) {
        useSignature(this.pick(i), spec, left);
    },
    // 광선 힘겨루기 — i 가 광선을 쏘고 j(광선 쓰는 애)가 받아침
    beamclash(i = 0, j = 1, spec) {
        const a = this.pick(i);
        const b = this.pick(j);
        startClash(a, spec || beamMoves(a.label)[0], b.left < a.left, b);
    },
    click(i = 0) {
        const p = this.pick(i);
        useMove(p, p.left + spriteSize(p) / 2 > window.innerWidth / 2);
    },
    // 꾹 누르기를 흉내 (ms 동안 누름)
    press(i = 0, ms = ULT_HOLD_MS + 50) {
        const p = this.pick(i);
        const r = p.collision.getBoundingClientRect();
        p.collision.setPointerCapture = () => {}; // 만든 이벤트는 붙잡기가 안 돼서
        const ev = (type) => p.collision.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, pointerId: 1, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
        ev('pointerdown');
        setTimeout(() => {
            ev('pointerup');
            p.collision.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
        }, ms);
    },
};
