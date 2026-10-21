// 게임 모드 전투 다리 (2026-10-19 태현 님 "일반 모드처럼 자연스럽고 멋지게 스킬 · 필살기 · 배틀") — 게임 (src/game/features/battle/fx) 이 window.pokemonFx 로 일반 모드 연출을 씀.
// make-moves.py 가 moves.js · ult/* 와 같은 묶음 (main-bundle.js 의 main.ts 모듈) 안에 넣어서 SIG_FX · sigGeometry · sigImpact · gameMoveEntry 를 그대로 씀.
// 게임 그림 (Preact 가 그린 <img>) 을 일반 모드 포켓몬처럼 보이게 하는 작은 가짜 객체 (fxActor) 만 만들고, 연출 코드는 안 고침.
// 그리는 곳은 일반 모드와 같은 캔버스 (moveCanvas, id pokemonFxCanvas) — game.css 가 게임 중엔 게임 화면 위로 올림.

// 몸으로 닿는 틀 — 게임이 상대 쪽으로 달려들고 (pg-lunge), 닿는 순간 다리를 부름 (그때 위치에서 그림)
const FX_CONTACT = new Set(['dash', 'slash', 'punch']);
// 게임 타입 → 연출 색 (SIG_PALETTE)
const FX_TYPE_PAL = {
    normal: 'normal', fire: 'fire', water: 'water', electric: 'electric', grass: 'grass', ice: 'ice', fighting: 'fight', poison: 'poison', ground: 'ground',
    flying: 'wind', psychic: 'psychic', bug: 'bug', rock: 'rock', ghost: 'ghost', dragon: 'dragon', dark: 'dark', steel: 'steel', fairy: 'fairy',
};

// spec = { el: 그림 <img>, box: 위치 · 크기를 읽을 요소 (없으면 el), form: 게임 모습 id (= 일반 모드 label), size: 원본 크기 (32 · 64), left: 왼쪽을 보는지, name }
// 필살기가 몸을 옮기면 (돌진 · 다이브 · 밀려 벌러덩) box 를 translate 로 옮김 — 끝나면 fxReset 으로 제자리
const fxIdle = (left) => ({ horizontalDirection: left ? states_1.HorizontalDirection.left : states_1.HorizontalDirection.right, nextFrame: () => states_1.FrameResult.stateContinue });
function fxActor(spec) {
    const box = () => spec.box || spec.el;
    const r0 = box().getBoundingClientRect();
    const base = { left: r0.left, bottom: window.innerHeight - r0.bottom };
    const src0 = spec.el.getAttribute('src') || '';
    let tx = 0;
    let ty = 0;
    const apply = () => {
        box().style.translate = tx || ty ? `${Math.round(tx)}px ${Math.round(-ty)}px` : '';
    };
    return {
        el: spec.el,
        collision: box(),
        label: spec.form,
        name: spec.name || '',
        _originalSpriteSize: spec.size || 32,
        _size: 'game',
        calculateSpriteWidth: () => box().getBoundingClientRect().width,
        get left() {
            return base.left + tx;
        },
        get bottom() {
            return base.bottom + ty;
        },
        floor: base.bottom,
        positionLeft(x) {
            tx = x - base.left;
            apply();
        },
        positionBottom(y) {
            ty = y - base.bottom;
            apply();
        },
        currentState: fxIdle(!!spec.left),
        currentStateEnum: 'idle',
        hideSpeechBubble() {},
        canSwipe: true,
        speed: 1,
        // 그림을 바꾸는 필살기 (전용 연출) 용 — <색>_<동작>_8fps.gif 앞부분
        pokemonRoot: src0.replace(/_(walk|idle)_8fps\.gif$/, ''),
        fxReset() {
            tx = 0;
            ty = 0;
            apply();
            spec.el.getAnimations?.().forEach((a) => a.cancel());
            spec.el.style.visibility = '';
            spec.el.style.filter = '';
            if (spec.el.ninjaOpacity !== undefined) {
                // 전용 필살기가 숨긴 그림 (fx-sky.js hideMon) — 되돌리는 타이머가 안 불려도 보이게
                const [v, pri] = spec.el.ninjaOpacity;
                spec.el.ninjaOpacity = undefined;
                if (v) {
                    spec.el.style.setProperty('opacity', v, pri);
                } else {
                    spec.el.style.removeProperty('opacity');
                }
            }
            spec.el.style.transformOrigin = '';
            if (src0 && spec.el.getAttribute('src') !== src0) {
                spec.el.setAttribute('src', src0);
            }
        },
    };
}

// ── 게임 화면 안에서만 (2026-10-19 아트 디렉터 · 플레이 리뷰어 — 정보줄 · HP 를 덮지 않게, 번쩍 · 흔들기는 순하게) ──
function fxInGame() {
    return !!document.body && document.body.classList.contains('pokemon-game-on');
}
// 연출이 넘지 않는 위 끝 = 게임 정보줄 아래 끝 (px) — 게임 밖이면 0 (game.css 가 캔버스를 여기서 자름)
function fxTop() {
    const bar = fxInGame() && document.querySelector('#pokemon-game .pg-infobar');
    return bar ? Math.round(bar.getBoundingClientRect().bottom) : 0;
}
// 필살기 어둠에서 밝게 남길 HP 묶음 자리 — 게임 밖이면 없음
function fxHudRects() {
    return fxInGame() ? [...document.querySelectorAll('#pokemon-game .pg-hpblock')].map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0) : [];
}
// 게임 중 흔들기 — 배경 · 포켓몬 · 트레이너만 (HP · 메뉴 글자는 안 떨게), 2 ~ 3px 정수 · 80ms 왕복 4번 (design-system 8장)
// 안 볼 때 (VS Code 창에 포커스가 없음 — 게임은 계속 감) 는 연출을 차분하게: 흔들기 · 히트스톱 없음 · 번쩍 반 · 기술 임팩트 작게 (2026-10-20 ideas #113 — 코딩하며 곁눈으로 보는 게임)
// 확장이 보내는 { command: 'game', type: 'focus', focused } 를 다리도 직접 들음 (게임 화면 코드와 따로)
let fxAway = false;
// 히트스톱으로 멈춘 움직임 · 다시 켤 타이머 (겹쳐 불러도 하나로)
const fxStopped = [];
let fxStopTimer = 0;
window.addEventListener('message', (e) => {
    const m = e.data;
    if (m && m.command === 'game' && m.type === 'focus') {
        fxAway = m.focused === false;
    }
});
function fxGameShake(amp) {
    if (fxAway) {
        return;
    }
    const a = Math.max(2, Math.min(3, Math.round(amp)));
    document.querySelectorAll('#pokemon-game .pg-bg, #pokemon-game .pg-fg, #pokemon-game .pg-fighter, #pokemon-game .pg-hero-wrap, #pokemon-game .pg-foe-trainer').forEach((el) => {
        el.fxShake?.cancel();
        el.fxShake = el.animate([{ translate: `-${a}px 0` }, { translate: `${a}px 0` }], { duration: 80, iterations: 4, direction: 'alternate', composite: 'add' });
    });
}
// 화면 번쩍 상한 — 게임 중엔 0.3 (넓은 패널 전체가 하얗게 번쩍이지 않게) · 반격기 (짧은 필살기, fxGame.noFlash) 는 0 (2026-10-21 orders #7 — 솔라빔이 860 전체를 0.2초 밝게)
const fxFlashCap = () => (fxInGame() ? (fxGame && fxGame.noFlash ? 0 : fxAway ? 0.15 : 0.3) : 1);
// 게임 중 화면 번쩍 — 0.34초에 한 번 · 진하기 0.3 까지 (1초 3번 규칙). 일반 모드는 그대로
let fxLastFlash = 0;
const fxScreenFlash = screenFlash;
screenFlash = function (s, alpha, color, max) {
    if (!fxInGame()) {
        return fxScreenFlash(s, alpha, color, max);
    }
    if (fxGame && fxGame.noFlash) {
        return undefined;
    }
    const now = performance.now();
    if (now - fxLastFlash < 340) {
        return undefined;
    }
    fxLastFlash = now;
    return fxScreenFlash(s, Math.min(fxFlashCap(), alpha), color, max);
};
// 필살기가 상대를 처음 맞힌 순간 — 게임은 그때 피해를 넣음 (연출이 다 끝날 때까지 기다리지 않게)
const fxUltHit = ultHit;
ultHit = function (q, ...rest) {
    const out = fxUltHit(q, ...rest);
    const g = fxGame;
    if (g && g.onHit && !g.hit && (q?.pokemon ?? q) === g.B) {
        g.hit = true;
        try {
            g.onHit();
        } catch (err) {
            ultError('game hit', err);
        }
    }
    return out;
};

// 그림 폭 (px) — 0 이면 연출을 안 씀 (moves.js 의 몇몇 반복문이 배율 0 이면 안 끝남 — 패널이 접히는 중 · 떨어져 나간 그림)
const fxWidth = (spec) => (spec && (spec.box || spec.el) ? (spec.box || spec.el).getBoundingClientRect().width : 0);

// 게임 전투 중 필살기 — 맞을 상대 (ultOthers 가 일반 모드 목록 대신 이것) · 0.1초마다 상태 진행 (일반 모드 박자 대신)
let fxGame;
// 필살기마다 번호 — 중간에 멈춘 필살기 (맞받아치기 힘대결 · 전투 끝) 가 걸어 둔 타이머는 건너뜀.
// 필살기 본편은 0.9초 뒤 타이머로 시작하고 전용 연출도 단계마다 타이머를 걸어서, 멈춘 뒤에 그려지지 않게 그 필살기가 거는 타이머에 번호를 붙임 (fxGuard)
let fxGen = 0;
const fxKilled = new Set();
function fxKill(gen) {
    fxKilled.add(gen);
    // 오래된 번호는 버림 — 걸어 둔 타이머는 길어야 15초라 최근 것만 있으면 됨
    if (fxKilled.size > 64) {
        fxKilled.delete(fxKilled.values().next().value);
    }
}
// 기술 · 방어 · 회복 연출이 거는 타이머 번호 (솔라빔 모으기 · 번개 …) — clear() 가 멈추고 새 번호로
let fxMoveGen = ++fxGen;
function fxGuard(gen, fn) {
    return function (...args) {
        if (fxKilled.has(gen)) {
            return undefined;
        }
        return fxWithTimers(gen, () => fn.apply(this, args));
    };
}
// run 하는 동안 거는 타이머 (setTimeout) 에 번호를 붙임 — 그 타이머 안에서 또 거는 것도
function fxWithTimers(gen, run) {
    const prev = window.setTimeout;
    window.setTimeout = (fn, ms, ...rest) => prev(typeof fn === 'function' ? fxGuard(gen, fn) : fn, ms, ...rest);
    try {
        return run();
    } finally {
        window.setTimeout = prev;
    }
}
function fxGameTargets() {
    if (!fxGame) {
        return undefined;
    }
    return [fxGame.B].map((q) => {
        const r = q.collision.getBoundingClientRect();
        return { pokemon: q, x: r.left + r.width / 2, y: r.top + r.height / 2, bottom: r.bottom, w: r.width, h: r.height };
    });
}
function fxGameTick() {
    if (!fxGame) {
        return;
    }
    const g = fxGame;
    // 움직이기 (UltMoveState) 가 거는 타이머도 그 필살기 번호로
    fxWithTimers(g.gen, () => {
        for (const p of [g.A, g.B]) {
            const st = p.currentState;
            try {
                if (st && st.nextFrame && st.nextFrame() === states_1.FrameResult.stateComplete) {
                    p.currentState = fxIdle(st.horizontalDirection === states_1.HorizontalDirection.left);
                }
            } catch (err) {
                ultError('game tick', err);
                p.currentState = fxIdle(false);
            }
        }
    });
}
// kill = 중간에 멈춤 (남은 타이머 건너뜀) · 아니면 다 끝나서 정리만
function fxGameStop(kill) {
    if (!fxGame) {
        return;
    }
    const g = fxGame;
    fxGame = undefined;
    if (kill) {
        fxKill(g.gen);
        // 게임 화면 흔들기도 멈춤 (ultShake)
        document.querySelector('#pokemon-game .pg-field')?.ultShakeAnim?.cancel();
    }
    clearInterval(g.tick);
    clearTimeout(g.done);
    if (ultActive && ultActive.pokemon === g.A) {
        ultEnd(g.A);
    }
    g.A.fxReset();
    g.B.fxReset();
}

// ── 상대까지 닿게 (2026-10-19 테스터 #327: 번개는 제자리 · 회오리 · 돌떨구기는 가운데 · 물대포 · 거품 · 노래는 입 앞에서 끝 · 광선은 화면 끝까지) ──
// 일반 모드 틀은 "쓰는 쪽 앞 몇 칸" 기준이라 — 자리형은 상대 자리로 옮기고, 날아가는 것은 빠르기를 거리에 맞추고, 광선은 상대 몸 뒤에서 멈춤
function fxTarget(g, dst) {
    const r = (dst.box || dst.el).getBoundingClientRect();
    const cx = r.left + r.width / 2;
    // 그 둘레 HP 묶음 아래 끝 (회오리처럼 높은 연출이 HP 를 덮지 않게)
    const hud = fxHudRects().filter((h) => h.right > r.left - r.width && h.left < r.right + r.width);
    return { cx, cy: r.top + r.height * 0.55, w: r.width, far: g.dir > 0 ? r.right : r.left, dist: Math.abs(cx - g.mouth.x), ground: r.bottom, hudBottom: hud.length ? Math.max(...hud.map((h) => h.bottom)) : 0 };
}
// ── 진화 연출 도우미 — 그림 그대로 / 한 색 실루엣 (0.1초마다 새로 — 움직이는 그림) ──
const evoSilCache = new Map();
function evoSil(img, w, h, color) {
    const key = `${img.src}|${color}|${w}|${h}`;
    let c = evoSilCache.get(key);
    if (!c) {
        if (evoSilCache.size > 8) {
            evoSilCache.clear();
        }
        c = { cv: document.createElement('canvas'), t: -1e9 };
        evoSilCache.set(key, c);
    }
    const now = performance.now();
    if (now - c.t > 100) {
        c.t = now;
        c.cv.width = w;
        c.cv.height = h;
        const x = c.cv.getContext('2d');
        x.imageSmoothingEnabled = false;
        x.drawImage(img, 0, 0, w, h);
        x.globalCompositeOperation = 'source-in';
        x.fillStyle = color;
        x.fillRect(0, 0, w, h);
    }
    return c.cv;
}
function evoDraw(ctx, img, box, swell, color, alpha) {
    if (!img.naturalWidth || box.w < 2 || alpha <= 0) {
        return;
    }
    const w = Math.max(1, Math.round(box.w));
    const h = Math.max(1, Math.round(box.h));
    const dw = Math.round(w * swell);
    const dh = Math.round(h * swell);
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(color ? evoSil(img, w, h, color) : img, Math.round(box.x - dw / 2), Math.round(box.b - h / 2 - dh / 2), dw, dh);
}

// ── 완벽 패링 쳐내기 = 쳐올리기 (2026-10-20 태현 님 시안 B) ──
// 기술 색 구슬 (도는 살 넷) · 꼬리 · 금색 별 폭발 · 픽셀 고리
function swatOrbDraw(ctx, p, t, px) {
    ctx.globalAlpha = 1;
    const r = p.R || 5;
    sigDisc(ctx, px, p.s, p.x, p.y, r * p.s, p.cols[2]);
    sigDisc(ctx, px, p.s, p.x, p.y, (r - 1) * p.s, p.cols[1]);
    sigDisc(ctx, px, p.s, p.x, p.y, Math.max(1, r - 3) * p.s, p.cols[0]);
    dotAt(ctx, px, p.s, p.x - 2 * p.s, p.y - 2 * p.s, '#ffffff', 2, 2);
    for (let k = 0; k < 4; k++) {
        const a = (p.spin || 0) + (k * Math.PI) / 2;
        dotAt(ctx, px, p.s, p.x + Math.cos(a) * (r + 1) * p.s, p.y + Math.sin(a) * (r + 1) * p.s, p.cols[0], 2, 2);
    }
}
function swatTail(p, n, gold) {
    for (let k = 0; k < n; k++) {
        const c = gold && k === 0 ? HIT_GOLD[movePick([0, 1])] : p.cols[movePick([0, 1, 2])];
        sigParticle({ x: p.x + moveRand(-2, 2) * p.s, y: p.y + moveRand(-2, 2) * p.s, s: p.s, max: moveRand(0.25, 0.5), color: c, size: movePick([1, 2]), draw: DRAW.dot });
    }
}
function swatBoom(x, y, s, cols, k) {
    // 맞을 때마다 보는 퍽 (sigPow) · 몸 둘레 원과 헷갈리는 고리는 빼고 — 불똥 · 반짝이만 (아트 디렉터 8차)
    sigBurst(x, y, s, [...cols.slice(0, 3), '#ffffff', HIT_GOLD[1]], Math.round(14 * k), 95 * k);
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + moveRand(-0.3, 0.3);
        sigParticle({ x, y, s, vx: Math.cos(a) * 70 * k * s, vy: Math.sin(a) * 70 * k * s - 20 * s, g: 60 * s, drag: 2, max: moveRand(0.45, 0.65), cols: HIT_GOLD, draw: DRAW.sparkle });
    }
}
// 쳐올리기 — 금색 반달 휘두르기 → 구슬이 높은 포물선으로 날아올라 꼭대기 (또는 위 끝) 에서 불꽃놀이처럼 터짐
function swatUp(g, x0, y0, cols) {
    const s = g.s;
    const R = g.body.ry * 1.7;
    sigParticle({ x: g.body.cx, y: g.body.cy, s, max: 0.32, R, dir: g.dir, draw: (ctx, p, t, px) => {
        // 아래 앞 (1.2) → 위 (-1.35) 로 0.1초에 쓸고 남은 자국이 흐려짐
        ctx.globalAlpha = hitStep(1 - Math.max(0, t - 0.3) / 0.7);
        const end = 1.2 - 2.55 * Math.min(1, t / 0.3);
        for (let a = 1.2; a >= end; a -= 0.07) {
            const w = a - end < 0.5 ? 3 : 2;
            const cx = p.x + p.dir * Math.cos(a) * p.R;
            const cy = p.y + Math.sin(a) * p.R;
            dotAt(ctx, px, p.s, cx, cy, HIT_GOLD[2], w, w);
            dotAt(ctx, px, p.s, cx, cy, a - end < 0.5 ? '#ffffff' : HIT_GOLD[0], w - 1, w - 1);
        }
    } });
    const v = 240 * s;
    // 거의 위로 (1.3 rad — 57° 는 "완벽 패링!" 글 위를 지나감) · 꼭대기는 정보줄 24칸 아래 (위로 퍼지는 불꽃이 정보줄에서 잘리지 않게, 아트 디렉터 8차)
    const top = fxTop() + 24 * s;
    sigParticle({ x: x0, y: y0, s, vx: g.dir * Math.cos(1.3) * v, vy: -Math.sin(1.3) * v, g: 330 * s, max: 1.2, cols, spin: 0, R: 5, tailAcc: 0, update: (p, dt) => {
        if (p.popped || dt <= 0) {
            return;
        }
        p.spin += dt * 6;
        // 꼬리 — 1/60초마다 두 덩이 (화면 빠르기와 상관없이)
        for (p.tailAcc += dt; p.tailAcc >= 1 / 60; p.tailAcc -= 1 / 60) {
            swatTail(p, 2, true);
        }
        if ((p.vy || 0) >= 0 || p.y < top || p.x < 6 * p.s || p.x > window.innerWidth - 6 * p.s) {
            p.popped = true;
            p.life = p.max;
            // 꼭대기 — 구슬이 한 걸음 커졌다 (5 → 7, 0.06초) 8 살로 갈라짐 (닿는 거리 약 47px — 150px 무대 안)
            const bx = p.x;
            const by = p.y;
            sigParticle({ x: bx, y: by, s: p.s, max: 0.06, R: 7, spin: p.spin, cols: p.cols, draw: swatOrbDraw });
            swatBoom(bx, by, p.s, p.cols, 1.0);
            // 불꽃놀이 살 — 8 줄기
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                sigParticle({ x: bx, y: by, s: p.s, vx: Math.cos(a) * 90 * p.s, vy: Math.sin(a) * 90 * p.s, g: 90 * p.s, drag: 3, max: 0.5, color: i % 2 ? HIT_GOLD[0] : p.cols[0], len: 3, draw: (ctx, q, t, px) => {
                    ctx.globalAlpha = hitStep(1 - t);
                    const m = Math.hypot(q.vx, q.vy) || 1;
                    for (let j = 0; j < q.len; j++) {
                        dotAt(ctx, px, q.s, q.x - (q.vx / m) * j * 2 * q.s, q.y - (q.vy / m) * j * 2 * q.s, j === 0 ? '#ffffff' : q.color);
                    }
                } });
            }
        }
    }, draw: swatOrbDraw });
}
// 쓰는 쪽 몸 앞 → 상대 가운데 번개 줄기 — 연출 55% 부터 0.35초, 모양만 0.12초마다 새로 (밝기 그대로 — 1초 3번 규칙)
function fxSparkArc(g, t) {
    const ms = SIG_FX.spark.ms(g.P, {});
    const cols = HIT_COLS.electric;
    setTimeout(() => {
        sigParticle({ x: g.body.front, y: g.mouth.y, s: g.s, max: 0.35, drawn: -1, cols, update: (p) => {
            if (p.drawn >= 0 && p.life - p.drawn < 0.12) {
                return;
            }
            p.drawn = p.life;
            p.path = zigzag(p.x, p.y, t.cx, t.cy, p.s, 3, 5);
            p.branch = zapBranch(p.path, 6 * p.s, Math.atan2(t.cy - p.y, t.cx - p.x), p.s);
        }, draw: (ctx, p, tt, px) => {
            if (!p.path) {
                return;
            }
            ctx.globalAlpha = tt > 0.7 ? 0.5 : 1;
            zapLine(ctx, px, p.s, p.path, 1, p.cols[2], p.cols[0]);
            zapLine(ctx, px, p.s, p.branch, 1, p.cols[2], p.cols[1]);
        } });
    }, Math.round(ms * 0.55));
}
// 연출 자리를 옆으로 dx 만큼 (크기 · 방향은 쓰는 쪽 그대로)
const fxShift = (g, dx) => ({ ...g, mouth: { ...g.mouth, x: g.mouth.x + dx }, body: { ...g.body, cx: g.body.cx + dx, front: g.body.front + dx } });
// 입에서 날아가는 거리 (px) — 틀의 빠르기 · 끌림 · 수명으로 셈 (v / 끌림 × (1 − e^−끌림×수명), 끌림 없으면 v × 수명)
const fxFly = (v, drag, life) => (drag > 0 ? (v / drag) * (1 - Math.exp(-drag * life)) : v * life);
const FX_TRAVEL = {
    breath: (g) => 12 * g.s * (1 + 0.8 * g.P), // 사진으로 잼 (끌림 2.6 − 세기)
    water: (g) => fxFly(66 * (1 + 0.6 * g.P) * g.s, 0.4, 0.65 * (1 + 0.4 * g.P)),
    bubbles: (g, o) => fxFly(35 * g.s * (o.many ? 1.5 : 1), 0.9, 1.05),
    rings: (g, o) => (o.forward ? fxFly((90 + 40 * g.P) * g.s, 0, 0.7) : 0),
    notes: (g) => fxFly(22 * g.s, 0, 1.1),
};
// run 하는 동안 · 그 뒤 발사기가 만드는 입자의 옆 빠르기를 k 배 — 예전 틀 (물대포: fx 없는 발사기) 은 fx 발사기로 바꿔 감쌈
function fxScaled(k, run, cap, rateK = 1) {
    const p0 = moveParticles.length;
    const e0 = moveEmitters.length;
    run();
    const fix = (from) => {
        for (let j = from; j < moveParticles.length; j++) {
            const p = moveParticles[j];
            p.vx *= k;
            if (p.v0 !== undefined) {
                p.v0 *= k;
            }
            cap?.(p);
        }
    };
    fix(p0);
    for (let i = e0; i < moveEmitters.length; i++) {
        const e = moveEmitters[i];
        if (!e.fx) {
            const base = { ...e };
            e.rate = moveRate(e.move, e.power);
            e.fx = () => spawnParticle(base);
        }
        // 멀리 퍼지는 만큼 더 많이 (빽빽하게, PC 부담 때문에 4배까지)
        if (rateK > 1 && typeof e.rate === 'number') {
            e.rate *= rateK;
        }
        const fx = e.fx;
        e.fx = (...a) => {
            const n = moveParticles.length;
            const out = fx(...a);
            fix(n);
            return out;
        };
    }
}
// 틀마다 상대까지 — { g, o, k, cap, rateK, after } (k = 빠르기 배, cap = 입자마다 고칠 것, rateK = 입자 수 배, after = 더 할 것)
function fxAim(fx, g, o, t) {
    const clampK = (v) => Math.min(25, Math.max(0.6, v));
    const dense = (k) => Math.min(4, Math.max(1, k));
    // 상대 몸 뒤 (0.3 폭) 를 지나면 사라짐 — 큰 포켓몬의 뿜기가 상대 뒤로 멀리 나가지 않게
    const lim = t.far + g.dir * 0.3 * t.w;
    const stopPast = (p) => {
        const prev = p.update;
        // 쳐내기 (swat) 가 튕길 때 원래 update 로 되돌림 — 방향이 바뀌면 "상대 뒤를 지나면 사라짐" 이 필요 없음
        p.aimPrev = prev;
        p.aimStop = true;
        p.update = (q, dt) => {
            prev?.(q, dt);
            if ((q.x - lim) * g.dir > 0) {
                q.life = q.max;
            }
        };
    };
    switch (fx) {
        case 'breath': {
            const k = clampK(t.dist / FX_TRAVEL.breath(g));
            return { g, o: { ...o, speed: (o.speed ?? 1) * k, rate: (o.rate ?? 1) * dense(k) }, k: 1, cap: stopPast };
        }
        case 'water':
        case 'bubbles':
        case 'notes':
        case 'rings': {
            const d = FX_TRAVEL[fx](g, o);
            const k = d > 0 ? clampK(t.dist / d) : 1;
            return d > 0 ? { g, o, k, rateK: dense(k), cap: stopPast } : { g, o };
        }
        case 'beam':
            // 덩굴채찍 · 핥기 (len) = 상대 가운데까지 · 광선 = 상대 몸 뒤 윤곽까지 (화면 끝까지 뚫고 가지 않게)
            // 진짜 광선만 닿는 끝 빛 (채찍 · 혀 · 실 = 원래 len 이 있는 것은 없이)
            return { g, o: { ...o, len: (o.len ? t.dist : t.dist + 0.3 * t.w) / Math.max(1, g.w), hitGlow: !o.len } };
        case 'vortex': {
            // 높이는 HP 묶음 아래까지 (불 기둥이 HP 를 덮지 않게)
            const full = (1.7 + 0.6 * g.P) * g.h;
            const height = t.hudBottom ? Math.min(o.height ?? 1, Math.max(0.4, (t.ground - t.hudBottom - 2) / full)) : o.height;
            return { g: fxShift(g, t.cx - (g.body.front + g.dir * ((0.55 + 0.3 * g.P) * g.w + 0.2 * g.w))), o: { ...o, height } };
        }
        case 'rockfall':
            return { g: fxShift(g, t.cx - (g.body.front + g.dir * 1.4 * g.w)), o };
        case 'thunder': {
            // 상대 위에 · 구름은 정보줄 아래 · 둘레 줄기는 좁게 (트레이너 · 패널 끝을 피함) · 둘레 줄기는 번쩍 없이
            const W = Math.max(g.w, 40) * (1.1 + 0.6 * g.P);
            const hero = document.querySelector('#pokemon-game .pg-hero-wrap');
            const heroRight = hero ? hero.getBoundingClientRect().right : 0;
            // 구름 두께 반 = 8px (위아래 16px — 아트 디렉터)
            const cloudH = Math.min(1, 8 / (Math.max(0.3 * g.h, 12) + 3 * g.s));
            return { g: fxShift(g, t.cx - g.body.cx), o: { ...o, skyTop: fxTop(), cloudH, spread: 0.6, calm: true, xmin: heroRight + 0.8 * W + 8, xmax: window.innerWidth - 0.8 * W - 8 } };
        }
        case 'powder':
            return o.around ? { g, o } : { g: fxShift(g, t.cx - (g.mouth.x + g.dir * 1.5 * g.w)), o };
        case 'spark':
            // 전기쇼크 · 10만볼트 — 몸에서 지직거리다 끝무렵 상대까지 번개 줄기가 이어짐 (몸 둘레에서만 지직거려 상대까지 안 닿던 것, 플레이 리뷰어)
            return { g, o, after: () => fxSparkArc(g, t) };
        case 'quake':
            // 흙먼지는 상대 발밑 · 흔들기는 게임 화면 (일반 모드는 숨은 포켓몬 · 앞쪽 풀을 흔듦)
            return { g: fxShift(g, t.cx - g.body.cx), o, after: () => fxGameShake(2 + g.P) };
        case 'projectile':
            // 똑바로 나는 것은 상대를 지나면 사라짐 (화면 끝까지 안 감) — 부메랑 · 포물선은 그대로
            return o.boomerang || o.arc ? { g, o } : { g, o, k: 1, cap: (p) => {
                if (p.vx && p.max > 0.3) {
                    p.max = Math.min(p.max, (t.dist + 0.3 * t.w) / Math.abs(p.vx));
                }
            } };
        default:
            return { g, o };
    }
}

// 게임에서는 그 포켓몬이 배운 기술과 이름이 같은 필살기를 피함 (이상해씨 "덩굴채찍" = 3 스킬의 덩굴채찍 — 필살기가 기술보다 약해 보임, 플레이 리뷰어 · ideas #102).
// 일반 모드 주머니 순서 그대로 꺼내고, 이름이 겹칠 때만 겹치지 않는 것 중에서 — 다 겹치면 그대로
const fxName = (s) => String(s || '').replace(/\s+/g, '');
function fxUltPick(form, avoid) {
    const e = ultEntry(form);
    const bad = new Set((avoid || []).map(fxName));
    if (!e || !bad.size || !bad.has(fxName(e[0]))) {
        return e;
    }
    const list = (POKEMON_ULT[form] || []).map((i) => ULT_LIB[i]).filter((v) => v && !bad.has(fxName(v[0])));
    const plain = list.filter((v) => !ULT_SPECIALS.includes(v[1]));
    return plain.length ? movePick(plain) : list.length ? movePick(list) : e;
}

function fxPlan(form, m) {
    if (!POKEMON_SHAPE[form] || !m || !m.name) {
        return null;
    }
    // 일반 모드 표 · 길이 계산 오류가 게임을 멈추지 않게 — 못 고르면 null (게임은 이모지로)
    try {
        const sig = gameMoveEntry(form, m);
        const T = sig && SIG_FX[sig[1]];
        if (!T) {
            return null;
        }
        const o = sig[2] || {};
        return { sig, T, o, ms: Math.round(T.ms(POKEMON_SHAPE[form][0], o)) };
    } catch (err) {
        moveFault(err);
        return null;
    }
}

// ── 힘대결 = 일반 모드 필살기 대결 (ult/duel.js) — 모으기 → 앞으로 → 가운데서 밀고 밀리기 (연타로 기울어짐) → 이긴 쪽이 뚫고 나가 터짐 ──
// 기술 맞받아치기는 그 기술 틀을 대결 모양으로 (광선 · 번개 · 구슬 · 회오리 · 운석 · 땅 · 돌진 · 물결), 색은 기술 타입
const FX_DUEL_FX = {
    breath: 'ultbeam', water: 'ultbeam', beam: 'ultbeam', solarbeam: 'ultbeam', bubbles: 'ultorb', projectile: 'ultorb', bolt: 'ultvolt', thunder: 'ultvolt',
    megavolt: 'ultvolt', spark: 'ultvolt', powder: 'ultswarm', notes: 'ultpsy', rings: 'ultpsy', vortex: 'ultvortex', rockfall: 'ultskyfall', quake: 'ultquake',
    dash: 'ultrush', slash: 'ultrush', punch: 'ultrush',
};
// 대결 입자의 수명 표시 (멈출 때 찾아서 줄임) — 승자가 정해질 때까지 밀기가 이어지게 아주 길게
const FX_DUEL_LONG = 59.75;
function fxDuelEntry(kind, form, m, avoid) {
    if (kind === 'ult') {
        // 필살기 대결 — 그 포켓몬 필살기 (일반 모드 주머니 순서, 배운 기술과 이름이 같으면 다른 것), 특수 필살기 (튀어오르기 · 변신 · 손가락흔들기) 면 다른 것
        const e = fxUltPick(form, avoid);
        if (e && !ULT_SPECIALS.includes(e[1])) {
            return e;
        }
        const list = (POKEMON_ULT[form] || []).map((i) => ULT_LIB[i]).filter((v) => v && !ULT_SPECIALS.includes(v[1]));
        return list.length ? movePick(list) : ['필살기', 'ultbeam', {}];
    }
    const p = m && fxPlan(form, m);
    return [m ? m.name : '기술', FX_DUEL_FX[p && p.sig[1]] || 'ultbeam', { c: FX_TYPE_PAL[m && m.type] || 'normal' }];
}
// 부드럽게 멈춤 — 이긴 쪽이 뚫고 나가 터지는 여운 (1.7초) 까지 그린 뒤 정리
function fxDuelSoftStop() {
    const g = fxGame;
    if (!g || !g.duel) {
        return;
    }
    const dp = g.duel.dp;
    if (dp) {
        dp.max = Math.min(dp.max, dp.life + 1.7);
    }
    clearTimeout(g.done);
    g.done = setTimeout(() => fxGame === g && fxGameStop(false), 1800);
}

window.pokemonFx = {
    version: 4,
    /** 그 기술의 연출 — { fx: 틀 이름, ms: 걸리는 시간, contact: 몸으로 닿는지 } · 없으면 null (게임은 그 기술을 예전 모양으로) */
    plan(form, m) {
        const p = fxPlan(form, m);
        return p && { fx: p.sig[1], ms: p.ms, contact: FX_CONTACT.has(p.sig[1]) };
    },
    /** 기술을 지금 씀 — 쏘는 기술은 입에서 · 닿는 기술은 몸 앞에서 (box 를 달려든 몸으로 주면 상대 바로 앞). 그린 시간 (ms), 못 그리면 0.
     *  reach = 입에서 상대까지 px — 뿜기 (breath: 불꽃세례 · 화염방사 · 독가스 …) 는 일반 모드에선 입 앞에서만 피어서, 전투에선 상대까지 닿게 빠르기를 키움
     *  form = 기술 모양을 고를 포켓몬 (닿는 기술 자국을 맞는 쪽에 그릴 때 쓰는 쪽 모양 그대로 — 없으면 src)
     *  dst = 맞는 포켓몬 — 주면 틀마다 상대까지 닿게 (fxAim: 자리 옮김 · 빠르기 · 광선 길이), 안 주면 reach 로 뿜기만 */
    move(src, m, reach, form, dst) {
        const p = fxPlan(form || src.form, m);
        if (!p || fxWidth(src) < 1) {
            return 0;
        }
        if (p.sig[1] === 'dash') {
            // 몸통박치기 — 몸이 달려드는 것이 연출 (게임 pg-lunge), 닿을 때 (src = 맞는 쪽) 몸을 꿰뚫는 바람줄 + impact
            safeFx({}, () => {
                const g = sigGeometry(fxActor(src), !!src.left);
                // 노말은 임팩트 색 (흰 덩이 먼지가 되지 않게 — ult/fx-hit.js HIT_COLS)
                hitRush(g.body.front, g.body.cy, g.s, g.dir, g.body.ry, p.o.c === 'normal' || !p.o.c ? HIT_COLS.normal : sigPal(p.o.c));
            });
            return p.ms;
        }
        const A = fxActor(src);
        const ok = safeFx({}, () => fxWithTimers(fxMoveGen, () => {
            const g0 = sigGeometry(A, !!src.left);
            // 닿는 기술 (할퀴기 · 주먹) 은 게임에서 늘 맞는 쪽에 그림 → 자국을 몸 위에 (일반 모드는 쓰는 쪽 몸 앞)
            // 색도 타입 임팩트 색 (순백 대신 색이 든 흰색 — 뒤따르는 임팩트와 같은 흰색, 아트 디렉터 2바퀴)
            let aim = { g: g0, o: FX_CONTACT.has(p.sig[1]) ? { ...p.o, onTarget: true, c: hitColsOfPal(p.o.c ?? 'normal') } : p.o };
            if (dst && fxWidth(dst) >= 1) {
                aim = fxAim(p.sig[1], g0, p.o, fxTarget(g0, dst));
            } else if (p.sig[1] === 'breath' && reach > 0) {
                aim = { g: g0, o: { ...p.o, speed: (p.o.speed ?? 1) * Math.min(25, Math.max(1, reach / FX_TRAVEL.breath(g0))) } };
            }
            const go = () => p.T.run(aim.g, aim.o, p.ms, A);
            if (aim.k !== undefined || aim.cap) {
                fxScaled(aim.k ?? 1, go, aim.cap, aim.rateK);
            } else {
                go();
            }
            aim.after?.();
        }));
        return ok ? p.ms : 0;
    },
    /** 틀 하나를 그 자리에서 (방어 = shield · 회복 = glow · 잠 = zzz …) — o 는 SIG_FX 옵션 */
    cast(src, fx, o) {
        const T = SIG_FX[fx];
        if (!T || !POKEMON_SHAPE[src.form] || fxWidth(src) < 1) {
            return 0;
        }
        const opts = o || {};
        let ms = 0;
        const ok = safeFx({}, () => {
            ms = Math.round(T.ms(POKEMON_SHAPE[src.form][0], opts));
            const A = fxActor(src);
            fxWithTimers(fxMoveGen, () => T.run(sigGeometry(A, !!src.left), opts, ms, A));
        });
        return ok ? ms : 0;
    },
    /** 맞는 곳에 타입별 도트 임팩트 (ult/fx-hit.js — 불꽃 = 감아 올라가는 불길 회오리 · 물 = 물보라 왕관 · 얼음 = 결정 조각 …) — dst = 맞는 포켓몬 spec, type = 기술 타입 (게임), big = 세게 */
    impact(dst, type, big, name, o) {
        const r = (dst.box || dst.el).getBoundingClientRect();
        if (r.width < 1) {
            return;
        }
        const s = r.width / (dst.size || 32);
        const P = (POKEMON_SHAPE[dst.form] || [0.5])[0];
        // 발밑 = 그림 속 몸 아래 끝 (상자 아래는 빈칸이 있음)
        const bottom = POKEMON_SHAPE[dst.form] ? sigGeometry(fxActor(dst), !!dst.left).body.bottom : r.bottom;
        // 맞는 방향 — 상대 (왼쪽을 봄) 가 맞으면 내 쪽 (왼쪽) 에서 날아옴 → 오른쪽으로 튐
        // o.pick = 짜임 (게임 = 그 포켓몬 기술 칸 순서, 없으면 기술 이름) · scale · light · basic · none (ult/fx-hit.js)
        // 늦게 터지는 고리 · 연타 (setTimeout) 도 기술 연출과 같이 멈추게 (전투가 끝나면 다음 화면에 안 남음)
        // 안 볼 때는 닿는 기술처럼 작게 · 가운데 번쩍 · 고리 · 흔들기 없이
        const opts = { ...(o || {}), pick: o?.pick ?? hitHash(name), bottom, ...(fxAway ? { light: true } : {}) };
        safeFx({}, () => fxWithTimers(fxMoveGen, () => typeImpact(r.left + r.width / 2, r.top + r.height * 0.55, s, type, P, !!big, dst.left ? 1 : -1, r.width, opts)));
    },
    /** 필살기 — 일반 모드처럼 번쩍 · 어두워짐 · 컷인 · 큰 글씨 · 그 포켓몬의 필살기 (전용 연출 포함). 상대 = dst. 걸리는 시간 (ms), 못 쓰면 0.
     *  onHit = 상대를 처음 맞힌 순간 (게임은 그때 피해를 넣고, 남은 연출은 흘러가게 둠) · avoid = 피할 필살기 이름 (그 포켓몬이 배운 기술) */
    ult(src, dst, onHit, avoid, o) {
        fxGameStop(true);
        if (!POKEMON_SHAPE[src.form] || ultActive || fxWidth(src) < 1 || fxWidth(dst) < 1) {
            return 0;
        }
        let entry = fxUltPick(src.form, avoid);
        if (!entry) {
            return 0;
        }
        // 메타몽 변신 · 손가락흔들기는 일반 모드 포켓몬 목록을 써서 — 게임에선 기본 필살기로
        if (entry[1] === 'ultcopy' || entry[1] === 'ultmetronome') {
            entry = [entry[0], 'ultgeneric', {}];
        }
        const A = fxActor(src);
        const B = fxActor(dst);
        const gen = ++fxGen;
        // o.sub = 반격기 — 패널 전체 번쩍 없음 (fxFlashCap)
        fxGame = { A, B, gen, tick: setInterval(fxGameTick, 100), onHit, hit: false, noFlash: !!o?.sub };
        let total = 0;
        try {
            // o.quick = 같은 전투에서 다시 보는 필살기 — 컷인 없이 짧게 (ult/core.js ULT_QUICK_INTRO_MS)
            // 쓰기 전 기 모으기 (일반 모드 꾹 누르기와 같은 연출, 2026-10-20 태현 님) — 첫 필살기 0.8초 · 다시 보는 필살기 0.4초 · 반격기 (sub) 는 바로
            const charge = o?.sub ? 0 : o?.quick ? 400 : 800;
            total = fxWithTimers(gen, () => useUltimate(A, entry, { quick: !!o?.quick, charge, ...(o?.sub ? { sub: o.sub } : {}) })) || 0;
        } catch (err) {
            ultError('game ult', err);
        }
        if (!total) {
            fxGameStop(true);
            return 0;
        }
        fxGame.done = setTimeout(fxGameStop, total + 200);
        return total;
    },
    /** 힘대결 시작 — a = 내 포켓몬 (왼쪽), b = 상대. spec = { kind: 'ult' | 'move', a: 기술 | null, b: 기술 | null }, live() = 내가 이길 확률 (연타 반영, 0 ~ 1).
     *  필살기 대결은 VS 연출 (1.5초) 뒤에. { meetMs: 시작에서 가운데서 만나는 때 } · 못 하면 null */
    duel(a, b, spec, live) {
        fxGameStop(true);
        if (!POKEMON_SHAPE[a.form] || !POKEMON_SHAPE[b.form] || ultActive || fxWidth(a) < 1 || fxWidth(b) < 1) {
            return null;
        }
        const A = fxActor(a);
        const B = fxActor(b);
        const gen = ++fxGen;
        fxGame = { A, B, gen, tick: setInterval(fxGameTick, 100) };
        let meetMs = 0;
        const ok = safeFx({}, () => fxWithTimers(gen, () => {
            const ultA = fxDuelEntry(spec.kind, a.form, spec.a, spec.aAvoid);
            const ultB = fxDuelEntry(spec.kind, b.form, spec.b, spec.bAvoid);
            const leftA = !!a.left;
            const leftB = !!b.left;
            // 승패는 게임 엔진이 4초 끝에 정함 — 처음엔 가운데 (무승부 모양) 로 짜고, 밀기는 승자가 올 때까지 (duelWin)
            const D = duelPlan(A, ultA, leftA, B, ultB, leftB, 'draw');
            D.draw = false;
            D.winner = null;
            D.loser = null;
            D.tO = Infinity;
            D.total = FX_DUEL_LONG;
            D.winTitle = (Wn) => [Wn === D.A ? '힘대결에서 이겼다!' : '힘대결에서 졌다…', `${Wn.p.name}의 ${Wn.name}!`, 1.3];
            D.live = (t, s) => {
                let p = 0.5;
                try {
                    p = Math.min(1, Math.max(0, Number(live()) || 0.5));
                } catch (err) {
                    ultError('duel live', err);
                }
                // 연타로 기운 만큼 + 일반 모드 밀고 밀리기 리듬 (반만)
                return Math.min(0.85, Math.max(-0.85, (p - 0.5) * 1.4 + 0.5 * s));
            };
            const vs = spec.kind === 'ult' ? ULT_VS_MS : 0;
            meetMs = vs + D.tm * 1000;
            const now = performance.now();
            ultActive = { pokemon: A, rival: B, until: now + FX_DUEL_LONG * 1000, name: ultA[0], fx: 'clash' };
            const start = () => {
                duelStart(D);
                fxGame && fxGame.gen === gen && (fxGame.duel.dp = moveParticles.find((q) => q.max === FX_DUEL_LONG && q.z === -1));
            };
            fxGame.duel = { D, dp: null };
            if (vs) {
                // 필살기 대결 — 번쩍 · 어두워짐 · 위아래 컷인 · VS (일반 모드 그대로). 길이는 어림 (밀기 3.6초 + 끝 1.9초)
                ultVsIntro(A, ultA, leftA, B, ultB, leftB, vs / 1000 + D.tm + DUEL_SEC + DUEL_THROUGH + DUEL_AFTER);
                setTimeout(start, vs);
            } else {
                screenFlash(2, 0.4, '#ffffff', 0.2);
                start();
            }
        }));
        if (!ok) {
            fxGameStop(true);
            return null;
        }
        return { meetMs: Math.round(meetMs) };
    },
    /** 힘대결 승자 — 'a' (나) | 'b' (상대). 이긴 쪽이 뚫고 나가 진 쪽에서 터짐 (0.4초) */
    duelWin(who) {
        const D = fxGame && fxGame.duel && fxGame.duel.D;
        if (!D || D.winner) {
            return;
        }
        D.winner = who === 'a' ? D.A : D.B;
        D.loser = who === 'a' ? D.B : D.A;
        D.pushes[D.n - 1] = who === 'a' ? 0.55 : -0.55;
        D.live = undefined;
        // 지금부터 결과 — 밀기가 아직 안 시작했으면 (VS · 모으기 중) 만나는 때부터
        D.tO = Math.max(D.t || 0, D.tm);
    },
    /** 힘대결이 끝남 — soft = 터지는 여운까지 그리고 정리 (전투가 이어질 때), 아니면 바로 */
    stopDuel(soft) {
        if (soft && fxGame && fxGame.duel && fxGame.duel.D.winner) {
            fxDuelSoftStop();
            return;
        }
        const was = !!fxGame;
        fxGameStop(true);
        if (was) {
            moveEmitters.length = 0;
            moveParticles.length = 0;
        }
    },
    /** 쓰는 중인 필살기를 멈춤 (맞받아치기 · 전투 끝) — 몸 자리 · 그림 · 어둠을 되돌림 */
    /** 남은 필살기 연출을 ms 동안 흐리게 한 뒤 끔 (픽셀 박자 3단) — 반격기는 맞힌 뒤 줄기가 고르기 메뉴 위로 0.66초 남던 것 (2026-10-21 orders #7) */
    fadeUlt(ms) {
        const g = fxGame;
        if (!g || typeof moveCanvas === 'undefined' || !moveCanvas) {
            return;
        }
        const c = moveCanvas;
        c.style.transition = `opacity ${ms}ms steps(3, end)`;
        c.style.opacity = '0';
        setTimeout(() => {
            // 그사이 새 필살기 · 대결이 시작했으면 그건 두고 캔버스만 다시 보이게
            if (fxGame === g) {
                window.pokemonFx.stopUlt();
            } else if (!fxGame) {
                moveEmitters.length = 0;
                moveParticles.length = 0;
            }
            c.style.transition = '';
            c.style.opacity = '';
        }, ms);
    },
    stopUlt() {
        const was = !!fxGame;
        fxGameStop(true);
        if (was) {
            moveEmitters.length = 0;
            moveParticles.length = 0;
        }
    },
    /** 빗나감 — 맞을 쪽이 등 뒤로 반 칸 휙 피했다 돌아옴 (픽셀 박자) + 떠난 자리에 바람줄 · 발밑 먼지 (2026-10-20 플레이 리뷰어 "빗나갔다인데 터짐") */
    dodge(dst) {
        const el = dst.box || dst.el;
        const r = el.getBoundingClientRect();
        if (r.width < 1) {
            return;
        }
        // 등 뒤 = 보는 쪽 반대 (상대는 왼쪽을 봄 → 오른쪽으로)
        const back = dst.left ? 1 : -1;
        const dx = back * Math.max(6, Math.round(r.width * 0.35));
        el.animate([{ translate: '0 0' }, { translate: `${dx}px 0`, offset: 0.3 }, { translate: `${dx}px 0`, offset: 0.7 }, { translate: '0 0' }], { duration: 380, easing: 'steps(8, end)', composite: 'add' });
        safeFx({}, () => {
            const s = r.width / (dst.size || 32);
            const g = POKEMON_SHAPE[dst.form] ? sigGeometry(fxActor(dst), !!dst.left) : null;
            const cy = g ? g.body.cy : r.top + r.height * 0.55;
            const ry = g ? g.body.ry : r.height * 0.3;
            for (let i = 0; i < 4; i++) {
                sigParticle({ x: r.left + r.width / 2, y: cy + (i - 1.5) * ry * 0.5, s, vx: back * moveRand(120, 200) * s, drag: 4, max: 0.25, len: Math.round(moveRand(4, 8)), back, color: HIT_COLS.flying[i % 3], draw: (ctx, p, t, px) => {
                    ctx.globalAlpha = hitStep(1 - t);
                    dotAt(ctx, px, p.s, p.back > 0 ? p.x - p.len * p.s : p.x, p.y, p.color, p.len, 1);
                } });
            }
            hitDust(r.left + r.width / 2, g ? g.body.bottom : r.bottom, s, Math.max(10 * s, r.width * 0.3), sigPal('ground'), 4);
        });
    },
    /** 히트스톱 — 굉장 · 급소 · 마지막 한 방에서 연출 입자와 전투 그림 (포켓몬 · 트레이너 몸짓) 이 ms 동안 멈춤 (번쩍 없이 손맛, 2026-10-20) */
    hitStop(ms = 80) {
        if (fxAway) {
            return;
        }
        const until = Math.max(moveFreezeUntil, performance.now() + ms);
        moveFreezeUntil = until;
        // 이번에 멈춘 것만 (다른 곳에서 멈춘 움직임은 건드리지 않음) — 겹쳐 부르면 모아서 늦은 끝에 한 번에 다시 켬
        const anims = fxInGame() ? [...document.querySelectorAll('#pokemon-game .pg-fighter')].flatMap((el) => el.getAnimations({ subtree: true })).filter((a) => a.playState === 'running') : [];
        anims.forEach((a) => a.pause());
        fxStopped.push(...anims);
        clearTimeout(fxStopTimer);
        fxStopTimer = setTimeout(() => {
            const list = fxStopped.splice(0);
            list.forEach((a) => {
                try {
                    if (a.playState === 'paused') {
                        a.play();
                    }
                } catch (err) {
                    // 그새 지워진 움직임은 그대로 둠
                }
            });
        }, Math.max(0, until - performance.now()));
    },
    /** 패링 되튀기 — 막은 쪽 (dst) 몸 앞에서 불똥이 친 쪽 (src) 으로 튐 · 완벽 = 금색 초승달 "팅" + 히트스톱 (2026-10-20 플레이 리뷰어) */
    deflect(dst, src, perfect, noMoon) {
        safeFx({}, () => {
            if (!POKEMON_SHAPE[dst.form] || fxWidth(dst) < 1) {
                return;
            }
            const g = sigGeometry(fxActor(dst), !!dst.left);
            const cols = perfect ? HIT_GOLD : HIT_COLS.steel;
            const x = g.body.front + g.dir * 2 * g.s;
            for (let i = 0; i < (perfect ? 12 : 8); i++) {
                const a = moveRand(-0.7, 0.5);
                const v = moveRand(90, 170) * g.s;
                sigParticle({ x, y: g.body.cy + moveRand(-0.5, 0.5) * g.body.ry, s: g.s, vx: g.dir * Math.cos(a) * v, vy: Math.sin(a) * v, g: 160 * g.s, drag: 1.5, max: moveRand(0.25, 0.45), color: cols[i % 3], draw: DRAW.dot });
            }
            if (perfect && noMoon) {
                // 쳐올리기 — 반달은 휘두르기 하나만 (같은 0.3초에 둘이면 "((" 로 겹침, 아트 디렉터 8차)
                window.pokemonFx.hitStop(90);
            } else if (perfect) {
                // 몸 앞 금색 초승달 — 0.25초에 바깥으로 (2칸 → 1칸)
                const R = g.body.ry * 1.2;
                sigParticle({ x: g.body.cx, y: g.body.cy, s: g.s, max: 0.3, R, dir: g.dir, cols, draw: (ctx, p, t, px) => {
                    ctx.globalAlpha = hitStep(1 - t);
                    const r = p.R * (1 + 0.5 * t);
                    const dots = Math.ceil((Math.PI * r) / p.s);
                    for (let j = 0; j <= dots; j++) {
                        const a = -Math.PI / 2 + (j / dots) * Math.PI;
                        const cx = p.x + p.dir * Math.cos(a) * r;
                        const cy = p.y + Math.sin(a) * r;
                        dotAt(ctx, px, p.s, cx, cy, p.cols[1], t < 0.5 ? 2 : 1, t < 0.5 ? 2 : 1);
                        if (t < 0.4 && Math.abs(Math.sin(a)) < 0.5) {
                            dotAt(ctx, px, p.s, cx, cy, p.cols[0]);
                        }
                    }
                } });
                window.pokemonFx.hitStop(90);
            }
        });
    },
    /** 상태 이상이 걸린 순간 (독 · 화상 · 마비 · 잠 · 나음 = cure) — ult/fx-hit.js hitStatus (2026-10-20) */
    status(dst, kind) {
        safeFx({}, () => {
            if (!POKEMON_SHAPE[dst.form] || fxWidth(dst) < 1) {
                return;
            }
            fxWithTimers(fxMoveGen, () => hitStatus(sigGeometry(fxActor(dst), !!dst.left), kind));
        });
    },
    /** 쓰러뜨린 한 방 — 금색 별빛 살 · 별 조각 · 발밑 충격파 (ult/fx-hit.js hitKO) */
    ko(dst) {
        safeFx({}, () => {
            if (!POKEMON_SHAPE[dst.form] || fxWidth(dst) < 1) {
                return;
            }
            fxWithTimers(fxMoveGen, () => hitKO(sigGeometry(fxActor(dst), !!dst.left)));
        });
    },
    /** 완벽 패링 — 쳐내기 (2026-10-20 태현 님 그림 docs: 날아온 줄이 내 포켓몬 앞에서 위쪽 대각선으로 튕겨 나감).
     *  dst = 막은 쪽 (내 포켓몬) · src = 친 쪽 · type = 기술 타입 · kind = 연출 틀 (fx.plan().fx) — 광선은 위로 꺾여 흩어지고, 날아오는 것은 회전하며 튕겨 나감, 하늘 · 땅 · 둘레 기술은 휙 피함 */
    swat(dst, src, type, kind) {
        const SHOT = ['projectile', 'water', 'bubbles', 'rings', 'notes', 'breath', 'spark', 'beam', 'solarbeam'];
        if (!SHOT.includes(kind)) {
            window.pokemonFx.dodge(dst);
            return;
        }
        safeFx({}, () => {
            if (!POKEMON_SHAPE[dst.form] || fxWidth(dst) < 1) {
                return;
            }
            const g = sigGeometry(fxActor(dst), !!dst.left);
            const s = g.s;
            const dir = g.dir; // 막은 쪽이 보는 쪽 = 친 쪽
            const x0 = g.body.front + dir * 2 * s;
            const y0 = g.body.cy;
            // 날아오던 것 — 한꺼번에 지우면 "누르니 사라졌다" 로 보임 (2026-10-20 태현 님 #433): 몸 앞 1.5폭 안은 위 · 친 쪽으로 튕겨 흩어지고 (0.45초),
            // 그 뒤에 오던 것 · 막은 쪽을 향한 광선 · 줄기는 0.2초에 걸쳐 사라짐 (광선은 아래에서 위로 꺾인 줄기가 새로 뻗음)
            for (const p of moveParticles) {
                const beam = p.reach !== undefined && p.W !== undefined && p.dir !== undefined && p.dir * dir < 0;
                if (beam) {
                    p.max = Math.min(p.max, p.life + 0.2);
                    continue;
                }
                if (!((p.vx || 0) * dir < 0 && Math.abs(p.x - x0) < g.w * 3) || p.life >= p.max) {
                    continue;
                }
                if (Math.abs(p.x - x0) < g.w * 1.5 && (!p.update || p.aimStop)) {
                    if (p.aimStop) {
                        p.update = p.aimPrev;
                        p.aimStop = false;
                    }
                    const sp = Math.max(60 * s, Math.hypot(p.vx || 0, p.vy || 0) * 0.4);
                    const a = moveRand(0.55, 1.25);
                    p.vx = dir * Math.cos(a) * sp;
                    p.vy = -Math.sin(a) * sp;
                    p.g = 140 * s;
                    p.drag = 1.2;
                    p.max = Math.min(p.max, p.life + moveRand(0.35, 0.5));
                } else {
                    p.max = Math.min(p.max, p.life + 0.2);
                }
            }
            // 뿜기 · 물대포처럼 계속 뿜던 것도 멈춤 (쳐낸 뒤에도 날아오지 않게)
            moveEmitters.length = 0;
            const cols = hitCols(type);
            // 쳐내는 쪽 = 위 · 친 쪽으로 비스듬히 (약 55°)
            const ax = dir * Math.cos(0.95);
            const ay = -Math.sin(0.95);
            if (kind === 'beam' || kind === 'solarbeam') {
                // 광선 — 막은 자리에서 위로 꺾인 굵은 줄기가 0.4초 동안 뻗었다 흩어짐 (줄기를 따라 반짝이)
                const L = g.w * 3.5;
                sigParticle({ x: x0, y: y0, s, max: 0.65, cols, draw: (ctx, p, t, px) => {
                    ctx.globalAlpha = t > 0.6 ? Math.ceil(((1 - t) / 0.4) * 4) / 4 : 1;
                    const len = L * Math.min(1, t / 0.2);
                    for (let d = 0; d < len; d += p.s) {
                        const w = Math.max(1, Math.round(3 * (1 - d / L) * (t < 0.5 ? 1 : 1 - (t - 0.5) * 1.6)));
                        const cx = p.x + ax * d;
                        const cy = p.y + ay * d;
                        dotAt(ctx, px, p.s, cx - p.s, cy - p.s, p.cols[2], w + 1, w + 1);
                        dotAt(ctx, px, p.s, cx, cy, d < len * 0.6 ? '#ffffff' : p.cols[0], Math.max(1, w - 1), Math.max(1, w - 1));
                    }
                } });
                for (let i = 0; i < 10; i++) {
                    const d = moveRand(0.2, 1) * L;
                    sigParticle({ x: x0 + ax * d, y: y0 + ay * d, s, vx: moveRand(-30, 30) * s, vy: moveRand(-30, 10) * s, max: moveRand(0.3, 0.5), cols, draw: DRAW.sparkle });
                }
            } else {
                // 날아오는 것 — 쳐올리기 (2026-10-20 태현 님 시안 셋 중 B "쳐올리기가 가장 좋은 것 같아" — 되돌려 보냄 · 산산조각은 버림)
                swatUp(g, x0, y0, cols);
            }
            // 쳐내는 순간 — 금색 퍽 · 초승달 · 불똥 + 0.15초 멈춤 (튕기기 전 막은 순간이 보이게 — 되튀기 완벽의 0.09초보다 길게)
            sigPow(x0, y0, s, HIT_GOLD, 0.5, false, { size: 6 });
            window.pokemonFx.deflect(dst, src, true, true);
            window.pokemonFx.hitStop(150);
        });
    },
    /** 패링 글 (2026-10-20 태현 님) — 완벽 = 금색 "완벽 패링!" (크게 · 반짝) · 보통 = 은색 "패링!" (작게) · 반격 = 금색 "반격!" — 필살기 이름 글씨처럼, 그 포켓몬 머리 위.
     *  opt.sec = 보이는 길이 (초) · opt.other = 맞은편 포켓몬 — 주면 글씨가 두 포켓몬 사이 이 포켓몬 쪽 반을 넘지 않음 (좁은 패널에서 상대 머리 위에 그려져 상대가 막은 것처럼 읽히던 것, 2026-10-21 UX 리뷰어)
     *  · opt.away = 맞은편 반대쪽 (바깥) 에 */
    word(dst, text, tone, opt = {}) {
        safeFx({}, () => {
            const r = (dst.box || dst.el).getBoundingClientRect();
            if (r.width < 1) {
                return;
            }
            const gold = tone === 'gold';
            const cols = gold ? ['#fffbe0', '#ffe680', '#f5c400', '#b88a00'] : ['#ffffff', '#eef2f6', '#c4ced8', '#5f6f82'];
            const big = gold;
            // 포켓몬 배율 — 보통 ×2 그대로, 높은 패널 ×3 이면 글씨 · 반짝이도 1.5배 (2026-10-20 높은 패널 크게)
            const s = Math.max(1, Math.round(r.width / (dst.size || 32)));
            const grow = Math.max(1, s / 2);
            const cx = r.left + r.width / 2;
            const o = opt.other ? (opt.other.box || opt.other.el).getBoundingClientRect() : null;
            const ox = o && o.width >= 1 ? o.left + o.width / 2 : null;
            // 글씨 크기 · 폭 (ultTitle 과 같은 셈)
            const k0 = (big ? 0.55 : 0.38) * grow;
            const size = Math.round(ultClamp(window.innerWidth / 9, 18, 40) * k0);
            const m = document.createElement('canvas').getContext('2d');
            m.font = `900 ${size}px ${ultFont()}`;
            const tw = m.measureText(text).width;
            // 머리 위는 HP 묶음 자리라 — 그 포켓몬 옆 (상대 쪽 · 없으면 화면 가운데 쪽) 위에 · opt.away = 바깥쪽 (반격 — 가운데는 반격기 이름 자리)
            const inward = (ox !== null ? ox > cx : cx < window.innerWidth / 2) ? 1 : -1;
            const toward = opt.away ? -inward : inward;
            let x = cx + toward * r.width * 1.6;
            let y = r.top + r.height * 0.2;
            // 상대 쪽이면 두 포켓몬 사이 이 포켓몬 쪽 반 안에 · 그래도 이 포켓몬 가운데보다 바깥으로는 안 밂 (240px 에서 주인공 · 자동 꺼짐 표 뒤로 가던 것)
            if (ox !== null && !opt.away) {
                const mid = (cx + ox) / 2;
                x = toward > 0 ? Math.max(cx, Math.min(x, mid - tw / 2)) : Math.min(cx, Math.max(x, mid + tw / 2));
            }
            // 글씨 가운데가 이 포켓몬 위면 머리 위로 — HP 묶음 아래까지만 (480 × 187 에서 HP 숫자 위에 겹치던 것)
            if (Math.abs(x - cx) < r.width / 2) {
                const hb = fxHudRects()
                    .filter((h) => h.left < x + tw / 2 && h.right > x - tw / 2 && h.bottom < r.top + r.height / 2)
                    .reduce((b, h) => Math.max(b, h.bottom), -Infinity);
                y = Math.min(y, Math.max(r.top - size * 0.6, hb + 2 + size / 2));
            }
            // 보통 패링 0.7 → 1.1초 (흐려지기 전 약 0.4초만 보이던 것, 2026-10-21 UX 리뷰어 U1) · 완벽 1.0 → 1.4초 (엔진 parryShowMs 1400 — 글씨가 다 사라진 뒤 반격 기회, 2026-10-21 태현 님 A) · 은색 1.1 → 1.3초 (또렷한 시간 0.9초뿐이던 것, UX 리뷰어)
            const sec = opt.sec || (big ? 1.4 : 1.3);
            // 필살기 이름 글씨보다 얌전하게 — 1.4배에서 시작 · 떨림 없음 (패링은 자주 나와서, 아트 디렉터 8차)
            ultTitle(text, null, cols, sec, 0.36, k0, { x, y, s0: 1.4, still: true });
            if (big) {
                for (let i = 0; i < 8; i++) {
                    const a = (i / 8) * Math.PI * 2;
                    sigParticle({ x: x + Math.cos(a) * 30 * grow, y: y + Math.sin(a) * 10 * grow, s, vx: Math.cos(a) * 30 * grow, vy: (Math.sin(a) * 15 - 10) * grow, drag: 2, max: 0.6, cols, draw: DRAW.sparkle });
                }
            }
        });
    },
    /** 반격 기회 — 상대 (dst) 만 밝고 둘레는 살짝 어두워짐 (화면이 느려진 느낌, ms 동안) · 구멍은 픽셀 줄로 */
    riposteFocus(dst, ms) {
        safeFx({}, () => {
            const r = (dst.box || dst.el).getBoundingClientRect();
            if (r.width < 1) {
                return;
            }
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height * 0.55;
            const R = Math.max(r.width, r.height) * 0.95;
            // 구멍 줄 = 포켓몬 픽셀 한 칸 (보통 2px · 높은 패널 ×3 이면 3px — 픽셀 격자 하나)
            const s = Math.max(1, Math.round(r.width / (dst.size || 32)));
            // 쳐내기 연출이 다 끝난 뒤 원과 같이 뜸 (엔진 parryShowMs — 2026-10-20 태현 님 #434 "패링 연출이 끝난 뒤에 반격")
            sigParticle({ x: 0, y: 0, s, max: ms / 1000, z: -1, draw: (ctx, p, t) => {
                const a = 0.34 * (t < 0.12 ? t / 0.12 : t > 0.85 ? (1 - t) / 0.15 : 1);
                const W = window.innerWidth;
                const H = window.innerHeight;
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, 0, W, H);
                for (let dy = -R; dy <= R; dy += s) {
                    const half = Math.round(Math.sqrt(Math.max(0, R * R - dy * dy)) / s) * s;
                    ctx.rect(Math.round(cx - half), Math.round(cy + dy), half * 2, s);
                }
                ctx.clip('evenodd');
                ctx.globalAlpha = Math.ceil(a * 8) / 8;
                ctx.fillStyle = '#0a0c1e';
                ctx.fillRect(0, 0, W, H);
                ctx.restore();
            } });
        });
    },
    /** 닿는 기술 (할퀴기 · 몸통박치기 …) 을 패링 — 늘 쳐내는 몸짓으로 상대를 튕겨 냄 (가만히 서 있던 것, 2026-10-20 태현 님).
     *  받아쳐 밀어내기 (태현 님 시안 셋 중 A — 방패 · 회전은 버림): 반 걸음 받아치며 반달 휘두르기 · 친 쪽이 닿은 자리에서 뒤로 밀렸다 돌아옴. perfect = 금색 · 크게 · 짧은 멈춤, 보통 = 은색 · 작게 */
    contactParry(dst, src, perfect) {
        safeFx({}, () => {
            if (!POKEMON_SHAPE[dst.form] || fxWidth(dst) < 1) {
                return;
            }
            const g = sigGeometry(fxActor(dst), !!dst.left);
            const s = g.s;
            const dir = g.dir; // 막은 쪽이 보는 쪽 = 친 쪽
            const cols = perfect ? HIT_GOLD : HIT_COLS.steel;
            const k = perfect ? 1 : 0.6;
            const x0 = g.body.front + dir * 3 * s;
            const y0 = g.body.cy;
            const step = (n) => `steps(${n})`;
            // 친 쪽이 튕겨 나감 — 닿은 자리 (달려들기 그 순간) 에서 뒤로 밀려 (살짝 뜸) 제자리를 조금 지나쳤다 돌아옴.
            // 달려들기 (안쪽 몸 pg-lunge) 는 행동이 끝나면 그림이 새로 붙어 같이 지워져서 — 그 순간 위치를 바깥 상자 (.pg-fighter, 안 바뀜) 로 넘겨받아 움직임 (제자리로 순간 이동하던 것)
            const knock = (dist, hop, ms) => {
                const box = src && (src.box || src.el);
                if (!box) {
                    return;
                }
                const body = src.el && src.el.closest('.pg-fx-body');
                let tx = 0;
                if (body) {
                    const t = getComputedStyle(body).transform;
                    if (t && t !== 'none') {
                        tx = Math.round(new DOMMatrixReadOnly(t).m41);
                    }
                    body.getAnimations().forEach((an) => an.cancel());
                }
                const kick = Math.round(tx + dir * dist);
                const over = Math.round(dir * dist * 0.45);
                box.animate([{ translate: `${tx}px 0` }, { translate: `${kick}px ${-Math.round(hop)}px`, offset: 0.22 }, { translate: `${over}px 0`, offset: 0.6 }, { translate: '0 0' }], { duration: ms, easing: step(10) });
            };
            const me = dst.box || dst.el;
            // 받아쳐 밀어내기 — 반 걸음 받아치며 금색 반달 휘두르기 · 친 쪽이 튕겨 뒤로 밀렸다 돌아옴
            me.animate([{ translate: '0 0' }, { translate: `${Math.round(dir * g.w * 0.22)}px 0`, offset: 0.35 }, { translate: '0 0' }], { duration: 280, easing: step(5), composite: 'add' });
            const R = g.body.ry * 1.7;
            sigParticle({ x: g.body.cx + dir * g.w * 0.15, y: g.body.cy, s, max: 0.32, R, dir, cols, draw: (ctx, p, t, px) => {
                ctx.globalAlpha = hitStep(1 - Math.max(0, t - 0.3) / 0.7);
                const end = 1.2 - 2.55 * Math.min(1, t / 0.3);
                for (let a = 1.2; a >= end; a -= 0.07) {
                    const w = a - end < 0.5 ? 3 : 2;
                    const cx = p.x + p.dir * Math.cos(a) * p.R;
                    const cy = p.y + Math.sin(a) * p.R;
                    dotAt(ctx, px, p.s, cx, cy, p.cols[2], w, w);
                    dotAt(ctx, px, p.s, cx, cy, a - end < 0.5 ? '#ffffff' : p.cols[0], w - 1, w - 1);
                }
            } });
            sigBurst(x0, y0, s, [...cols.slice(0, 3), '#ffffff'], Math.round(12 * k), 100 * k);
            knock(g.w * 0.6 * k, g.body.ry * 0.3 * k, 520);
            sigPow(x0, y0, s, cols, 0.4, false, { size: Math.round(5 * k), white: perfect });
            if (perfect) {
                window.pokemonFx.hitStop(120);
            }
        });
    },
    /** 필살기 게이지가 다 참 — 몸 둘레 금색 반짝임 세 번 (1.2초마다, 2026-10-20 태현 님 "다 채워지면 반짝반짝 · 인지하게") */
    ultReady(dst) {
        safeFx({}, () => {
            if (!POKEMON_SHAPE[dst.form] || fxWidth(dst) < 1) {
                return;
            }
            const burst = () => {
                if (fxWidth(dst) < 1) {
                    return;
                }
                const g = sigGeometry(fxActor(dst), !!dst.left);
                const s = g.s;
                for (let i = 0; i < 9; i++) {
                    const a = (i / 9) * Math.PI * 2 + moveRand(-0.3, 0.3);
                    const r = moveRand(0.7, 1.15);
                    sigParticle({ x: g.body.cx + Math.cos(a) * g.body.rx * r, y: g.body.cy + Math.sin(a) * g.body.ry * r, s, vy: -moveRand(8, 22) * s, max: moveRand(0.45, 0.7), cols: HIT_GOLD, draw: DRAW.sparkle });
                }
                // 발밑에서 솟는 금빛 알갱이
                for (let i = 0; i < 6; i++) {
                    sigParticle({ x: g.body.cx + moveRand(-1, 1) * g.body.rx, y: g.body.bottom, s, vy: -moveRand(40, 80) * s, max: moveRand(0.35, 0.55), color: HIT_GOLD[i % 2], size: 1, draw: DRAW.dot });
                }
            };
            fxWithTimers(fxMoveGen, () => {
                burst();
                setTimeout(burst, 1200);
                setTimeout(burst, 2400);
            });
        });
    },
    /** 진화 (S22) — 메가진화처럼: 하얗게 빛남 → 하얀 실루엣이 옛 ↔ 새 모습으로 점점 빠르게 바뀌며 둘레로 빛줄기가 돎 → 하얗게 펑 → 새 모습 (2026-10-20 태현 님).
     *  stage = .pg-evolve-stage (안의 .pg-evolve-old img · .pg-evolve-new img 는 연출 동안 숨김 — CSS 는 ms 에 새 모습으로 바뀜) · 캔버스라 "동작 줄이기" 와 상관없이 */
    evolve(stage, ms = 3200) {
        safeFx({}, () => {
            const oldImg = stage && stage.querySelector('.pg-evolve-old img');
            const newImg = stage && stage.querySelector('.pg-evolve-new img');
            if (!oldImg || !newImg) {
                return;
            }
            const hide = (el, on) => (on ? el.style.setProperty('opacity', '0', 'important') : el.style.removeProperty('opacity'));
            hide(oldImg, true);
            hide(newImg, true);
            // 예전 CSS 번쩍임 (pg-evolve-flash) 은 끔 — 캔버스가 펑을 그려서 두 번 번쩍이지 않게
            stage.style.setProperty('animation', 'none');
            const restore = () => {
                hide(oldImg, false);
                hide(newImg, false);
            };
            // 캔버스 끝 (ms) 보다 조금 먼저 되살림 — 끝난 뒤 되살리면 약 0.1초 그림이 비던 것 (2026-10-21 UX 리뷰어, CSS 새 모습은 3.1초에 이미 보임)
            setTimeout(restore, ms - 30);
            const sec = ms / 1000;
            const T0 = 0.4;
            const T1 = sec * 0.78;
            const T2 = T1 + 0.25;
            const box = (img) => {
                const r = img.getBoundingClientRect();
                return { x: r.left + r.width / 2, b: r.bottom, w: r.width, h: r.height };
            };
            let burst = false;
            sigParticle({ x: 0, y: 0, s: 2, max: sec, z: 1, acc: 0, update: (p, dt) => {
                if (!stage.isConnected) {
                    p.life = p.max;
                    return;
                }
                const L = p.life;
                const a = box(oldImg);
                const s = Math.max(1, Math.round(a.w / (oldImg.naturalWidth || 32)));
                p.s = s;
                // 둘레에서 솟는 빛 알갱이 — 바뀌는 동안
                if (L > T0 && L < T2 && dt > 0) {
                    for (p.acc += dt * 30; p.acc >= 1; p.acc -= 1) {
                        sigParticle({ x: a.x + moveRand(-0.7, 0.7) * a.w, y: a.b - moveRand(0, 0.3) * a.h, s, vy: -moveRand(30, 70) * s, max: moveRand(0.3, 0.55), color: movePick(['#ffffff', '#ffe9a0', HIT_GOLD[1]]), size: 1, draw: DRAW.dot });
                    }
                }
                // 펑 — 새 모습이 하얗게 부풀며 금빛 · 흰 알갱이가 튐 (한 번)
                if (!burst && L >= T1) {
                    burst = true;
                    const n = box(newImg);
                    sigBurst(n.x, n.b - n.h * 0.5, s, ['#ffffff', '#ffe9a0', HIT_GOLD[1]], 24, 110);
                    for (let i = 0; i < 8; i++) {
                        const an = (i / 8) * Math.PI * 2;
                        sigParticle({ x: n.x + Math.cos(an) * n.w * 0.4, y: n.b - n.h * 0.5 + Math.sin(an) * n.h * 0.4, s, vx: Math.cos(an) * 60 * s, vy: Math.sin(an) * 60 * s - 10 * s, drag: 2, max: 0.6, cols: HIT_GOLD, draw: DRAW.sparkle });
                    }
                }
            }, draw: (ctx, p, t, px) => {
                const L = p.life;
                const s = p.s;
                const a = box(oldImg);
                const n = box(newImg);
                ctx.save();
                ctx.imageSmoothingEnabled = false;
                if (L < T0) {
                    // 하얗게 빛나기 시작 — 옛 모습 위로 흰빛이 차오름
                    evoDraw(ctx, oldImg, a, 1, null, 1);
                    evoDraw(ctx, oldImg, a, 1, '#ffffff', Math.ceil((L / T0) * 4) / 4);
                } else if (L < T1) {
                    const k = (L - T0) / (T1 - T0);
                    // 빛줄기 12 줄 — 몸 가운데에서 돌며 뻗음 (하양 · 금)
                    const cx = a.x;
                    const cy = a.b - a.h * 0.5;
                    const R = Math.max(a.w, n.w) * (0.55 + 0.25 * k);
                    ctx.globalAlpha = 0.75 * Math.min(1, k / 0.15);
                    for (let i = 0; i < 12; i++) {
                        const an = (i / 12) * Math.PI * 2 + L * 0.9;
                        const len = R * (1 + 0.6 * k) * (0.75 + 0.25 * Math.sin(L * 7 + i * 1.7));
                        for (let d = R * 0.55; d < len; d += s * 2) {
                            dotAt(ctx, px, s, cx + Math.cos(an) * d, cy + Math.sin(an) * d, i % 2 ? '#ffe9a0' : '#ffffff', 1, 1);
                        }
                    }
                    // 점선 빛 고리 — 두근두근
                    const ring = R * 0.55 * (1 + 0.08 * Math.sin(L * 14));
                    const dots = Math.max(16, Math.ceil((2 * Math.PI * ring) / (s * 2)));
                    ctx.globalAlpha = 0.8;
                    for (let j = 0; j < dots; j += 1) {
                        const an = (j / dots) * Math.PI * 2;
                        dotAt(ctx, px, s, cx + Math.cos(an) * ring, cy + Math.sin(an) * ring, j % 2 ? '#dfe9ff' : '#ffffff', 1, 1);
                    }
                    // 하얀 실루엣이 옛 ↔ 새 로 점점 빠르게 (초당 2 → 12번, 끝 10% 는 새 모습) · 바뀔 때마다 부풀었다 줄어듦
                    const flips = (L - T0) * (2 + 5 * k);
                    const showNew = k > 0.9 || Math.floor(flips) % 2 === 1;
                    const swell = 1 + 0.12 * Math.sin((flips % 1) * Math.PI);
                    evoDraw(ctx, showNew ? newImg : oldImg, showNew ? n : a, swell, '#ffffff', 1);
                } else if (L < T2) {
                    // 펑 — 새 모습 하얀 실루엣이 크게
                    const k = (L - T1) / (T2 - T1);
                    evoDraw(ctx, newImg, n, 1.25 - 0.25 * k, '#ffffff', 1);
                } else {
                    // 새 모습 — 하얀빛이 빠짐 (4 걸음)
                    const k = (L - T2) / Math.max(0.01, sec - T2);
                    evoDraw(ctx, newImg, n, 1, null, 1);
                    evoDraw(ctx, newImg, n, 1, '#ffffff', Math.ceil((1 - k) * 4) / 4);
                }
                ctx.restore();
            } });
        });
    },
    /** 개발 미리보기 — 타입 임팩트 하나를 그 자리에 (dev/game-host.js impacts=1) */
    testImpact(x, y, s, type, big, w, pick = 0) {
        safeFx({}, () => typeImpact(x, y, s, type, 0.6, !!big, 1, w, { pick }));
    },
    /** 연출 캔버스를 둘 곳 (version 4) — el = 게임 전투 판의 연출 층 (포켓몬 위 · HP · 말 · 메뉴 · 피해 숫자 아래), null 이면 맨 위 (body) */
    mount(el) {
        moveCanvasReady();
        const home = el && el.isConnected && fxInGame() ? el : document.body;
        if (moveCanvas.parentNode !== home) {
            home.appendChild(moveCanvas);
        }
    },
    /** 남은 연출을 지움 — 전투가 갑자기 끝나거나 화면이 바뀔 때 */
    clear() {
        fxGameStop(true);
        fxKill(fxMoveGen);
        fxMoveGen = ++fxGen;
        moveEmitters.length = 0;
        moveParticles.length = 0;
    },
};
