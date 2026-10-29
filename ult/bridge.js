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
// 크기 변환을 뺀 그림 자리 — 내보내기 크기 애니 (pg-sendout scale 0.2 → 1.08 → 1) 도중에 기술이 시작되면 s = 폭 / 32 가 2.10 처럼 정수가 아니어서
//   효과 점이 전부 반 픽셀로 흐리던 것 (디자인 #122 픽셀 검사원 · bugs 1884). 변환 기준점 (transform-origin) 은 그대로 두고 크기만 1 로 · translate (fxActor) 는 transform 밖이라 그대로
function fxRestRect(el) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const k = cs.transform && cs.transform !== 'none' ? new DOMMatrixReadOnly(cs.transform).a : 1;
    if (!(k > 0) || Math.abs(k - 1) < 0.001) {
        return r;
    }
    const [ox, oy] = cs.transformOrigin.split(' ').map(parseFloat);
    return new DOMRect(r.x - ox * (1 - k), r.y - oy * (1 - k), r.width / k, r.height / k);
}
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
        restRect: () => fxRestRect(box()),
        // 무대 상자 안 (3:3 필살기 판 — moveFrame) 에서는 상자 기준 자리 (왼쪽 = 상자 왼쪽 · 아래 = 상자 아래 끝에서)
        get left() {
            return base.left + tx - (moveFrame ? moveFrame.x : 0);
        },
        get bottom() {
            return base.bottom + ty - fxFrameDrop();
        },
        get floor() {
            return base.bottom - fxFrameDrop();
        },
        positionLeft(x) {
            tx = x + (moveFrame ? moveFrame.x : 0) - base.left;
            apply();
        },
        positionBottom(y) {
            ty = y + fxFrameDrop() - base.bottom;
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
            // 쓰러진 포켓몬 (게임 화면이 data-ko 를 붙임) 은 밀린 자리 그대로 — 연출 끝에 되돌리면 벌러덩이 시작하는 장면에 몸이 29 ~ 47px 순간이동 (UX 리뷰어 2026-10-21 · 칸은 곧 사라짐)
            if (box().closest?.('[data-ko]')) {
                return;
            }
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

// ── 무대 상자 (3:3 용 필살기 판 — 2026-10-22 태현 님 #122 · orders #95) ──
// 필살기를 무대 안 작은 상자를 화면으로 알고 그리게 — 상자 안 (moves.js moveFrame) 에서 읽는 그림 자리 (getBoundingClientRect) · 화면 크기 (innerWidth · innerHeight) 를 상자 기준으로.
// 112개 필살기 코드는 그대로 (패널 크기에 맞춰 그리는 코드라 상자가 작으면 작게 · 상자 끝 = 대상 조금 너머라 화면 끝을 겨누던 것도 대상에 닿음)
const fxRect0 = Element.prototype.getBoundingClientRect;
Element.prototype.getBoundingClientRect = function () {
    const r = fxRect0.call(this);
    const f = moveFrame;
    return f ? new DOMRect(r.x - f.x, r.y - f.y, r.width, r.height) : r;
};
const fxWinGet = {};
for (const k of ['innerWidth', 'innerHeight']) {
    const d = Object.getOwnPropertyDescriptor(window, k);
    if (d && d.get && d.configurable) {
        fxWinGet[k] = d.get;
        Object.defineProperty(window, k, {
            configurable: true,
            enumerable: d.enumerable,
            get() {
                const f = moveFrame;
                return f ? (k === 'innerWidth' ? f.W : f.H) : d.get.call(window);
            },
            set: d.set ? (v) => d.set.call(window, v) : undefined,
        });
    }
}
// 3:3 판 상자 안에서 상자 폭 전체를 칠하는 것 (화면 색 입히기 · 땅 빛 띠 · 가로 줄) 은 안 그림 — 화면 전체를 칠하던 그림이 상자 모서리에서 끊겨 반투명 네모 · 무대를 가로지르는 줄로 보여서 (#95 — 태현 님 지적 ⑨)
const fxFillRect0 = CanvasRenderingContext2D.prototype.fillRect;
CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
    const f = moveFrame;
    // 상자 그림판에 그릴 때만 (다른 캔버스 — 실루엣 · 그림 캔버스는 그대로, 코드 리뷰어) · 상자 폭 전체 (화면 물들임 · 땅 빛 띠).
    // 넓이로 거르기 (폭 80% · 높이 30%) 는 뺌 — 보이는 곳은 마스크 모양 (통로 + 대상 둘레) 이 정하고, 그 거르기가 솔라빔 빔 몸통까지 지웠음 (#95 2바퀴)
    if (f && f.quiet && this === f.ctx && x <= 0 && x + w >= f.W) {
        return undefined;
    }
    return fxFillRect0.call(this, x, y, w, h);
};
// 3:3 용 판 상자 안 — 반투명 그림 복사본 (잔상 · 유령 — 쓰는 포켓몬이 반투명하게 겹쳐 보이던 것) · 상자를 거의 다 덮는 큰 그림은 안 그림 (아트 디렉터 #95 ②)
const fxDrawImage0 = CanvasRenderingContext2D.prototype.drawImage;
CanvasRenderingContext2D.prototype.drawImage = function (img, ...a) {
    const f = moveFrame;
    if (f && f.quiet && this === f.ctx) {
        if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement && (this.globalAlpha < 0.9 || img === f.skipImg)) {
            return undefined;
        }
    }
    return fxDrawImage0.call(this, img, ...a);
};
// 진짜 화면 크기 (상자 밖)
const fxWinW = () => (fxWinGet.innerWidth ? fxWinGet.innerWidth.call(window) : moveInFrame(null, () => window.innerWidth));
const fxWinH = () => (fxWinGet.innerHeight ? fxWinGet.innerHeight.call(window) : moveInFrame(null, () => window.innerHeight));
// 상자 아래 끝 ~ 화면 아래 끝 (px) — 포켓몬 bottom (화면 아래에서 잰 높이) 을 상자 기준으로
const fxFrameDrop = () => (moveFrame ? fxWinH() - moveFrame.H - moveFrame.y : 0);

// 3:3 용 판 박자 — 큰 순간 (가장 센 번쩍 · 없으면 큰 맞음) 앞 0.6초부터 (자기 둘레 터짐은 0.1초 — 솟는 불길 · 그림 크기를 따르는 큰 기 모으기 구슬이 무대 위 끝에 붙던 것) 보이고 ·
// 맞은 뒤 1초 · 0.25초에 흐려짐 (엔진 TIMING.team.ultHitMs · ultMs 는 이 박자에 맞춤 — 보는 중엔 연출이 맞힐 때까지 붙잡음) [임시값]
const FX_STAGE_LEAD_MS = 600;
// 자기 둘레는 터지는 순간부터 (0 — 기 모으기 덩어리가 한 장면 비치던 것, 240) · 맞은 뒤 0.5초 (되돌아오는 물결 · 남은 돔이 우리 편 위에 0.7 ~ 0.8초 남던 것)
const FX_STAGE_SELF_LEAD_MS = 0;
const FX_STAGE_AFTER_MS = 500;
// 쏘는 필살기 — 빔이 나가는 번쩍 뒤 이만큼 (큰 맞음이 더 이르면 그때) 에 피해 숫자 (빔이 닿는 때 — 닿고 0.6초 뒤 숫자이던 것, UX 리뷰어 #95 ⑧)
const FX_STAGE_REACH_MS = 350;
// 끊기 — 바둑판 3걸음 50ms 씩 (솔라빔 점 줄이 0.25초 넘게 남던 것 — 아트 디렉터 #95 4바퀴 ⑦)
const FX_STAGE_FADE_MS = 150;
// 앞 감는 동안 — 흔들기 · 맞음 (DOM) · 번쩍은 건너뜀 (감은 장면은 안 보여서 · 맞음은 보이는 때 다시)
let fxSeeking = false;

/**
 * 무대 상자 — 쓰는 포켓몬 · 맞을 상대 (범위면 모두) 를 품는 가장 작은 상자 + 양옆 그림 한 폭 · 위는 지도 줄 아래 (--pg-fx-top) 를 안 넘음.
 * 높이 = 화면 반 (크기 절반 — #122) · 몸이 다 들어가야 하면 그만큼. 왼쪽 · 위는 그림 점 (S) 칸에 맞춤 (반 칸 없음)
 */
function fxStageFrame(A, list, self) {
    const rs = [A, ...list].map((q) => fxRect0.call(q.collision || q.box || q.el)).filter((r) => r.width > 0);
    const W0 = fxWinW();
    const H0 = fxWinH();
    const a = fxRect0.call(A.collision || A.el);
    const S = Math.max(1, Math.round(a.width / (A._originalSpriteSize || 32)));
    const top0 = Math.max(fxTop(), parseFloat(document.body.style.getPropertyValue('--pg-fx-top')) || 0);
    const unit = Math.max(...rs.map((r) => r.width));
    // 자기 둘레 터짐 = 쓰는 포켓몬 둘레 (그림 4폭) — 상대에게는 기운 줄기로 (상자가 무대 전체가 되어 터짐이 무대를 덮던 것)
    // 쏘는 필살기 = 쓰는 쪽 한 폭 · 맞는 쪽 0.6폭 너머까지 (상대를 60px 지나 끝나던 것 — UX 리뷰어 #95 ⑦)
    const toRight = list[0] ? fxRect0.call(list[0].collision || list[0].box || list[0].el).left >= a.left : true;
    const lo = Math.min(...rs.map((r) => r.left));
    const hi = Math.max(...rs.map((r) => r.right));
    const span = self ? [a.left + a.width / 2 - unit * 2, a.left + a.width / 2 + unit * 2] : toRight ? [lo - unit, hi + unit * 0.6] : [lo - unit * 0.6, hi + unit];
    const x0 = Math.max(0, Math.floor(span[0] / S) * S);
    const x1 = Math.min(W0, span[1]);
    const bottom = Math.min(H0, Math.max(...rs.map((r) => r.bottom)) + 2 * S);
    const need = bottom - Math.min(...rs.map((r) => r.top)) + 4 * S;
    // 높이 = 몸이 다 들어가는 만큼 · 그 밖은 그림 1.6폭까지 (패널 높이를 따라 커지던 것 — 443 에서 줄기 두께 ×1.9, UX 리뷰어 #95 ⑤)
    const H = Math.max(S * 8, Math.min(bottom - top0, Math.max(need, Math.min(Math.round(H0 * 0.5), Math.round(unit * 1.6)))));
    const y = Math.max(0, Math.ceil((bottom - H) / S) * S);
    // 보이는 곳 (마스크 모양 — moves.js moveFrameMask) — 무대 위 끝 · 화면 아래 끝 안으로 줄인 타원 (아래 끝에서 잘리던 것 — 아트 2바퀴)
    const fit = (cx, cy, rx, ry) => ({ kind: 'ell', cx, cy, rx, ry: Math.max(S * 4, Math.min(ry, cy - top0, H0 - 2 - cy)) });
    const ab = { x: a.left + a.width / 2, y: a.top + a.height * 0.55 };
    let shapes;
    let stairTo = null;
    if (self) {
        // 자기 둘레 — 쓰는 포켓몬 둘레 타원 (가로 1.2폭 · 세로 1폭)
        shapes = [fit(ab.x, ab.y, unit * 1.2, unit)];
    } else {
        // 쏘는 필살기 — 입 → 대상 통로 (굵기 0.66폭) + 대상 둘레 (가로 1폭 · 세로 0.8폭) + 입 앞 (0.45폭)
        const tb = fxChest(list[0] || A);
        const mouth = POKEMON_SHAPE[A.label] ? sigGeometry(A, fxFacesLeft(A, list[0] || A)).mouth : ab;
        // 계단 목표 — 입 x 부터 · 대상 가슴 (1:1 연출이 fxUltAim 으로 맞히는 곳을 알리면 그곳이 여기로)
        // 계단 = 1칸 (2칸 계단이 두꺼운 빔에서 벽돌 마디로 보이던 것 — 아트 디렉터 #95 9바퀴 ① · design-system 12장 바뀜)
        stairTo = { x0: mouth.x, ty: tb.y, u: S };
        // 통로 둘 — 입 → 대상 (겨누는 필살기) · 쓰는 포켓몬 몸 높이 가로 (1:1 에 맞춘 가로 빔은 입 · 등 꽃 등 몸 높이 어디서나 나감 — 솔라빔이 통로를 벗어나 안 보이던 것)
        // 몸 위쪽 (높이 42% 가운데 · 반지름 0.36폭) — 땅 높이 (되돌아오는 물결 · 바닥 줄) 는 빼고
        const midY = a.top + a.height * 0.42;
        shapes = [{ kind: 'seg', x0: mouth.x, y0: mouth.y, x1: tb.x, y1: tb.y, r: unit * 0.33 }, { kind: 'seg', x0: mouth.x, y0: midY, x1: tb.x, y1: midY, r: unit * 0.36 }, fit(tb.x, tb.y, unit, unit * 0.8), fit(mouth.x, mouth.y, unit * 0.45, unit * 0.45)];
        // 앞 모양 — 대상 둘레 (가로 0.6폭 · 세로 0.7폭) 만 포켓몬 위 캔버스 (맞음 · 터짐이 대상을 덮음) · 나머지는 포켓몬 아래 (moves.js moveFramePut)
        shapes.push({ ...fit(tb.x, tb.y, unit * 0.6, unit * 0.7), front: true });
    }
    // ringMax = 둘레 고리 반지름 상한 (그림 한 폭 — 지름 두 폭) · maskTop = 그리는 곳 위 끝 (무대 위 끝 — 상자 위로 넘는 것은 거기까지 사그라짐, 허공에서 잘리던 것 UX ①)
    // 자기 둘레 (돔 · 덩굴) 는 다 포켓몬 아래 (allBack) — 쓰는 포켓몬 · 우리 편이 그 앞에
    return { x: x0, y, W: Math.round(x1 - x0), H: Math.round(bottom - y), S, quiet: true, ringMax: Math.round(unit), maskTop: Math.min(y, Math.ceil(top0 / S) * S), skipImg: A.el, shapes, stairTo, allBack: !!self };
}

/**
 * 앞 감기 — run (필살기 본편 시작) 을 무대 상자 안에서 부르고 sec 초를 그리지 않고 지나감: 입자 · 발사기 (moves.js moveSeek) · 0.1초 게임 걸음 (돌진 · 다이브 몸) ·
 * 그동안 건 타이머 (가상 시계로 돌리고 남은 것은 남은 시간 뒤로) · performance.now 도 감은 만큼 앞당겨 보이게 (발사기 · 장면 시각)
 */
function fxSeekRun(g, frame, seekMs, run) {
    const sec = Math.max(0, seekMs) / 1000;
    let v = 0;
    const timers = [];
    const realSet = window.setTimeout;
    const animate0 = Element.prototype.animate;
    // 감는 중에 시작한 몸짓 (el.animate — 흔들기 · 밀림 · 몸 옮기기) — 끝나면 감은 만큼 앞당김 (실제 시간으로 처음부터 돌던 것)
    const anims = [];
    const vset = (fn, ms, ...args) => {
        if (typeof fn !== 'function') {
            return 0;
        }
        const f = moveFrame;
        timers.push({ due: v + Math.max(0, Number(ms) || 0), fn: () => moveInFrame(f, () => fn(...args)) });
        return 0;
    };
    // 때가 된 타이머를 때 순으로 · 한 번에 500개까지 (0ms 로 자기를 다시 거는 타이머가 끝없이 돌지 않게 — 코드 리뷰어)
    const fire = () => {
        for (let n = 0; n < 500; n++) {
            let i = -1;
            for (let j = 0; j < timers.length; j++) {
                if (timers[j].due <= v && (i < 0 || timers[j].due < timers[i].due)) {
                    i = j;
                }
            }
            if (i < 0) {
                return;
            }
            const t = timers.splice(i, 1)[0];
            try {
                t.fn();
            } catch (err) {
                ultError('stage seek timer', err);
            }
        }
    };
    let out;
    try {
        fxSeeking = sec > 0;
        window.setTimeout = vset;
        Element.prototype.animate = function (...a) {
            const an = animate0.apply(this, a);
            anims.push({ an, at: v });
            return an;
        };
        out = moveInFrame(frame, run);
        if (sec > 0) {
            let tick = 0;
            moveSeek(frame, sec, (done) => {
                v = done * 1000;
                fire();
                while (tick + 100 <= v) {
                    tick += 100;
                    if (fxGame === g) {
                        fxGameTick();
                    }
                }
            });
            v = sec * 1000;
            fire();
        }
    } finally {
        fxSeeking = false;
        window.setTimeout = realSet;
        Element.prototype.animate = animate0;
    }
    for (const a of anims) {
        try {
            a.an.currentTime = (Number(a.an.currentTime) || 0) + (v - a.at);
        } catch (err) {
            ultError('stage seek anim', err);
        }
    }
    // 남은 타이머 — 남은 만큼 뒤에 (그 필살기 번호로)
    for (const t of timers) {
        setTimeout(fxGuard(g.gen, t.fn), Math.max(0, t.due - v));
    }
    return out;
}

// 3:3 판 상자 안 어둠 (ultDark · 컷인 어둠) 은 끔 — 상자만 어두워져 네모 판으로 보여서 (흐리게는 화면이 나머지 다섯을 — #121)
const fxDimLayer0 = ultDimLayer;
ultDimLayer = function (...a) {
    if (moveFrame?.quiet) {
        return undefined;
    }
    return fxDimLayer0(...a);
};

/** 상자 밑에서 새로 쓰러지면 (시작 때 쓰러져 있던 칸은 빼고) 상자 그림을 0.1초마다 옅게 (0.35 까지) — 쓰러짐 (회색 주저앉기) · 쓰러짐 말이 하얀 빔 · 돔 속에 묻히던 것 (#1706 을 모든 필살기로 — 디자인 #92 UX ③) */
function fxStageSoft(g) {
    const f = g.frame;
    if (!f) {
        return;
    }
    if (!f.softAt) {
        const hit = moveInFrame(f, () => fxGameDown().some((q) => !g.down0.has(q.el) && q.r.right > 0 && q.r.left < f.W && q.r.top < f.H && q.r.bottom > 0));
        if (hit) {
            f.softAt = performance.now();
            // 쓰러지면 0.25초 바둑판으로 끊음 (옅게 남긴 판이 죽은 상대 위에 1초 머물던 것 — 디자인 UX #95 ①)
            fxStageCut(g);
        }
    }
}

/** 끊기 — 무대 상자 입자를 흐리게 (캔버스 0.25초) 지우고 필살기를 끝냄 (진짜 그림 · 자리를 되돌림) */
function fxStageCut(g) {
    // 한 번만 (쓰러짐 · 끝 둘 중 먼저)
    if (g.cutting) {
        return;
    }
    g.cutting = true;
    const f = g.frame;
    // 다른 연출이 이어받았으면 흐리기 없이 상자만 끝냄 (코드 리뷰어 — TS 쪽 부르는 순서에 기대지 않게)
    if (fxGame !== g) {
        fxFrameFree(f);
        return;
    }
    // 바둑판 3걸음 (50 → 75 → 100% 지움 · 50ms 씩) — 캔버스 반투명 대신 (아트 디렉터 #95 ② · 4바퀴 ⑦)
    f.drop = Math.max(f.drop || 0, 8);
    fxSetTimeout0(() => {
        f.drop = Math.max(f.drop || 0, 12);
    }, 50);
    fxSetTimeout0(() => {
        f.drop = 16;
    }, 100);
    fxSetTimeout0(() => {
        fxFrameFree(f);
        if (fxGame === g) {
            fxGameStop(true);
        }
    }, FX_STAGE_FADE_MS);
}
/** 상자 끝 — 그 상자 입자 · 발사기를 끝내고 그림판 · 마스크를 비움 (필살기마다 화면 크기 캔버스 둘이 남던 것 — 코드 리뷰어) */
function fxFrameFree(f) {
    if (!f) {
        return;
    }
    for (const p of moveParticles) {
        if (p._f === f) {
            p.max = p.life;
        }
    }
    for (const e of moveEmitters) {
        if (e._f === f) {
            e.until = 0;
        }
    }
    if (f.cv) {
        f.cv.width = 0;
        f.cv.height = 0;
    }
    f.mask = null;
    f.maskFront = null;
    f.maskBack = null;
    f.cvB = null;
    f.cv2 = null;
}

/** 큰 연출 시작 — 남은 작은 연출 (맞음 · 기술 입자) 은 0.1초 안에 끝냄 (하던 맞음 터짐이 큰 연출 위에 계속되던 것 — 아트 디렉터 #95 ③) */
function fxQuietOthers(keep) {
    for (const p of moveParticles) {
        if (!p._f && p !== keep && p.max - p.life > 0.1) {
            p.max = p.life + 0.1;
        }
    }
}
/**
 * 몸 구멍 — 맞는 상대 (hit) 가 아닌 3:3 칸 (쓰는 포켓몬 · 우리 편 · 지나가기만 하는 몸) 의 그림 모양만큼 연출을 지움 (fxPunchHoles — 그릴 때마다).
 * 줄기 · 물 덩어리 · 모으기 구슬이 몸 위로 지나가던 것 (아트 디렉터 #95 2바퀴 ③ ④ ⑤) — 캔버스가 z 10001 이라 몸을 위로 올릴 수 없어서 (z-index 올리기는 안 들음)
 */
function fxLiftBystanders(g, hit) {
    const els = new Set(hit.filter(Boolean).map((q) => q.collision || q.box || q.el));
    g.holes = [];
    for (const el of document.querySelectorAll('#pokemon-game .pg-team-mon')) {
        if (els.has(el)) {
            continue;
        }
        const img = el.querySelector('.pg-sprite');
        if (img) {
            g.holes.push(img);
        }
    }
}
function fxPunchHoles() {
    const g = fxGame;
    if (!g || !g.holes || !g.holes.length || !moveCtx) {
        return;
    }
    fxCutSprites(moveCtx, g.holes);
}
/** 그림 모양만큼 지움 (ctx — 화면 크기 캔버스) */
function fxCutSprites(ctx, imgs) {
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
    for (const img of imgs) {
        if (!img.isConnected || !img.complete || !img.naturalWidth) {
            continue;
        }
        const r = fxRect0.call(img);
        if (r.width < 1) {
            continue;
        }
        if (img.classList.contains('pg-face-left')) {
            ctx.save();
            ctx.translate(r.left + r.width, r.top);
            ctx.scale(-1, 1);
            fxDrawImage0.call(ctx, img, 0, 0, r.width, r.height);
            ctx.restore();
        } else {
            fxDrawImage0.call(ctx, img, r.left, r.top, r.width, r.height);
        }
    }
    ctx.restore();
}
/**
 * 뒤 층 — 3:3 판 (.pg-team) 맨 아래 진짜 캔버스 (포켓몬 · 판 밑). 합동 · 힘겨루기 줄기 · 나선 · 구슬 · 모이는 점선 · 혼자 필살기 판의 대상 둘레 밖은 여기에 —
 * 포켓몬 몸이 진짜로 줄기 앞에 섬 (BW 트리플 문법, 아트 디렉터 #95 4바퀴 ①). 몸 모양을 지우는 구멍은 GIF 첫 장 모양이라 걷기 그림이 다음 장일 때
 * 줄기가 몸 테두리 위에 그려지고 몸과 줄기 사이로 바탕이 비치던 것 (디자인 픽셀 #95 6바퀴 ① — drawImage 는 움직이는 그림의 첫 장만 그림). 맞음 · 고리 · 별은 그대로 위 캔버스
 */
const fxBack = { cv: null, ctx: null, dirty: false };
function fxBackCanvas() {
    if (!fxInGame() || !fxTeamOn()) {
        return null;
    }
    const root = document.querySelector('#pokemon-game .pg-team');
    if (!root) {
        return null;
    }
    if (!fxBack.cv) {
        const cv = document.createElement('canvas');
        cv.className = 'pg-fx-back';
        cv.style.cssText = 'position:absolute;pointer-events:none;image-rendering:pixelated;margin:0;padding:0;';
        fxBack.cv = cv;
        fxBack.ctx = cv.getContext('2d');
    }
    const cv = fxBack.cv;
    // 판 맨 아래 (화면이 다시 그려져 자리가 바뀌면 다시 넣음)
    if (root.firstChild !== cv) {
        root.insertBefore(cv, root.firstChild);
    }
    const dpr = window.devicePixelRatio || 1;
    const W = fxWinW();
    const H = fxWinH();
    const w = Math.round(W * dpr);
    const h = Math.round(H * dpr);
    if (cv.width !== w || cv.height !== h) {
        cv.width = w;
        cv.height = h;
        cv.style.width = `${W}px`;
        cv.style.height = `${H}px`;
    }
    // 화면 0, 0 에 맞춤 (판은 정보줄 위로 올라가 있음)
    const pr = fxRect0.call(root);
    const L = `${Math.round(-pr.left)}px`;
    const T = `${Math.round(-pr.top)}px`;
    if (cv.style.left !== L) {
        cv.style.left = L;
    }
    if (cv.style.top !== T) {
        cv.style.top = T;
    }
    fxBack.dirty = true;
    return fxBack.ctx;
}
function fxBackCtx(ctx) {
    const b = fxBackCanvas();
    if (!b) {
        return ctx;
    }
    b.setTransform(ctx.getTransform());
    b.globalAlpha = 1;
    b.globalCompositeOperation = 'source-over';
    b.imageSmoothingEnabled = false;
    return b;
}
/** 장마다 처음에 비움 (그린 장 다음 장 — 아무것도 안 그리면 빈 채로 남음) */
function fxBackBegin() {
    if (fxBack.dirty && fxBack.ctx) {
        fxBack.ctx.setTransform(1, 0, 0, 1, 0, 0);
        fxBack.ctx.clearRect(0, 0, fxBack.cv.width, fxBack.cv.height);
    }
    fxBack.dirty = false;
}
// 혼자 필살기 판 (moves.js moveFramePut) — 대상 둘레 밖을 이 캔버스에
moveBackHook = () => {
    const b = fxBackCanvas();
    if (b) {
        b.setTransform(1, 0, 0, 1, 0, 0);
    }
    return b;
};
/** 보이는 몸 상자 (화면 px) — 그림 모양 (POKEMON_SHAPE 왼 · 위 · 오른 · 아래) · 3:3 칸 (FxActor) · 게임 배우 (fxActor) 둘 다 · 모르면 null */
function fxShapeBox(q) {
    const form = q && (q.form || q.label);
    const sh = form && typeof POKEMON_SHAPE !== 'undefined' ? POKEMON_SHAPE[form] : null;
    const img = q && q.el;
    if (!sh || !img) {
        return null;
    }
    const r = fxRect0.call(img);
    if (r.width < 1) {
        return null;
    }
    const size = q.size || q._originalSpriteSize || 32;
    const s = r.width / size;
    const [, , , l, t, rr, b] = sh;
    const left = img.classList.contains('pg-face-left');
    return { left: left ? r.left + (size - rr) * s : r.left + l * s, right: left ? r.left + (size - l) * s : r.left + rr * s, top: r.top + t * s, bottom: r.top + b * s };
}
/** 가슴 (화면 px) — 발 − 키 × 0.55 (합동 줄기 · 3:3 용 판 계단이 겨누는 곳, 아트 디렉터 #95 4바퀴 ③) */
function fxChest(q) {
    const b = fxShapeBox(q);
    if (b) {
        return { x: (b.left + b.right) / 2, y: b.bottom - (b.bottom - b.top) * 0.55 };
    }
    const r = fxRect0.call(q.collision || q.box || q.el);
    return { x: r.left + r.width / 2, y: r.top + r.height * 0.55 };
}
/**
 * 1:1 연출이 맞히는 곳 (그 판 좌표 — 상자 기준) 을 알림 — 3:3 용 판은 입 뒤는 그대로 · 앞은 열 2칸마다 칸 단위 계단으로 기울여 그곳이 대상 가슴에 오게 (moves.js moveFrameStair).
 * 1:1 은 같은 땅 높이라 가로로 쏘는데 3:3 은 줄이 달라 솔라빔이 대상 머리 위 허공에서 터지던 것 (아트 디렉터 #95 4바퀴 ③ · 태현 님 ⑧). 스스로 겨누는 필살기 (ultAimTarget) 는 안 기울임
 */
function fxUltAim(x, y) {
    const f = moveFrame;
    if (!f || !f.stairTo || f.stair || f.aimed) {
        return;
    }
    const s = f.stairTo;
    const dx = x + f.x - s.x0;
    if (Math.abs(dx) < 8) {
        return;
    }
    f.stair = { x0: s.x0, dx, dy: s.ty - (y + f.y), u: s.u };
}

// ── 게임 화면 안에서만 (2026-10-19 아트 디렉터 · 플레이 리뷰어 — 정보줄 · HP 를 덮지 않게, 번쩍 · 흔들기는 순하게) ──
function fxInGame() {
    return !!document.body && document.body.classList.contains('pokemon-game-on');
}
// 필살기 연출이 넘으면 안 보이는 위 끝 (정보줄 · 지도 줄 아래 끝 — 3:3 은 --pg-fx-top) — 게임 밖 · 3:3 무대 상자 안은 0 (#105 — 던지는 구 · 뛰어오른 몸이 그 뒤로 숨지 않게. fx-energy runOrb · fx-unique 가 씀)
// 장마다 한 번만 잼 (그리기 루프 안에서 아이템마다 부르던 것 — querySelector · 레이아웃, 코드 리뷰어 #107) · 무대 상자 안 (moveFrame) 은 늘 0
//   (장이 멈춘 사이 — 1:1 필살기 뒤 3:3 장면 전환처럼 위 끝이 바뀔 때 — 옛 값을 쓰지 않게 50ms 넘으면 다시 잼)
let fxStageTopAt = -1;
let fxStageTopT = -1e9;
let fxStageTopV = 0;
let fxFrameId = 0;
function fxStageTop() {
    if (moveFrame) {
        return 0;
    }
    const t = performance.now();
    if (fxStageTopAt !== fxFrameId || t - fxStageTopT > 50) {
        fxStageTopAt = fxFrameId;
        fxStageTopT = t;
        fxStageTopV = fxInGame() && typeof t33Top === 'function' ? t33Top() : 0;
    }
    return fxStageTopV;
}
// 연출이 넘지 않는 위 끝 = 게임 정보줄 아래 끝 (px) — 게임 밖이면 0 (game.css 가 캔버스를 여기서 자름)
function fxTop() {
    // 무대 상자 안 (3:3 판) = 상자 위 끝 (상자는 이미 지도 줄 아래)
    if (moveFrame) {
        return 0;
    }
    if (!fxInGame()) {
        return 0;
    }
    // 정보줄 아래 끝 · 3:3 에서 연출이 실제로 잘리는 선 (--pg-fx-top = 지도 줄 아래 끝) 중 낮은 쪽 (3:3 에서 26px 위를 보아 맞음 · 하늘 위 끝이 지도 줄에 걸치던 것 — bugs 1703)
    const bar = document.querySelector('#pokemon-game .pg-infobar');
    const cut = parseFloat(document.body.style.getPropertyValue('--pg-fx-top')) || 0;
    return Math.max(bar ? Math.round(bar.getBoundingClientRect().bottom) : 0, Math.round(cut));
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
// 3:3 모드 (2026-10-21 orders #17) — 6마리 기술이 겹치니 기술은 패널 번쩍 · 흔들기 · 전체 멈춤 없이 (필살기 · 대결 = fxGame 중에만, 마지막 한 방은 hitStop(ms, true))
// 3:3 모드는 켠 뒤 1.5초 동안만 (게임이 상태마다 다시 켬) — 3:3 화면이 끄지 못하고 사라져도 1:1 연출이 3:3 모드로 남지 않게 (코드 리뷰어)
let fxTeamUntil = 0;
// 실제 시계 — 3:3 용 판 상자 안은 앞 감은 만큼 performance.now 가 앞서 (moves.js moveSkew) 3:3 켜짐을 못 알아보고 1:1 흔들기 · 띄우기가 그대로 나가던 것 (디자인 UX #95 4바퀴 ① · 아트 디렉터 ⑦)
const fxRealNow = () => performance.now() - (typeof moveSkewNow === 'number' ? moveSkewNow : 0);
// 지금 연출을 부른 번호 (fxWithTimers 안) — 3:3 에서 번쩍 · 흔들기 · 전체 멈춤은 필살기 · 대결 (fxGame) 이 부른 것만.
// 필살기 연출이 남아 있는 동안 쏜 기술 (번호 붙은 기술) · 임팩트 (fxMoveGen) 는 그대로 조용히 (코드 리뷰어)
let fxNowGen = 0;
const fxTeamQuiet = () => fxRealNow() < fxTeamUntil && (!fxGame || fxNowGen === fxMoveGen || fxMoveTagged.has(fxNowGen));
function fxGameShake(amp) {
    // 3:3 은 필살기 · 힘겨루기도 흔들지 않음 (흔들면 무대 왼쪽 끝 남색 세로줄이 드러남 — design-system 253, 아트 디렉터 #95 3바퀴 ③)
    if (fxAway || fxTeamQuiet() || fxSeeking || fxTeamOn()) {
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
    // 개발 창 — 필살기 박자 재기 (dev/ult-fx.py): window.__fxTrace 가 배열이면 번쩍을 적음
    if (Array.isArray(window.__fxTrace)) {
        window.__fxTrace.push(['f', performance.now(), alpha]);
    }
    if (!fxInGame()) {
        return fxScreenFlash(s, alpha, color, max);
    }
    // 3:3 판 상자 안 — 번쩍은 상자만 하얗게 되어 네모로 보여서 끔 (#95 — 무대 흰 줄 · 판 지적)
    if ((fxGame && fxGame.noFlash) || fxTeamQuiet() || fxSeeking || moveFrame?.quiet) {
        return undefined;
    }
    const now = performance.now();
    if (now - fxLastFlash < 340) {
        return undefined;
    }
    fxLastFlash = now;
    // 실제로 그린 번쩍 ('F' — 위 'f' 는 부른 것 모두, 박자 재기용) · 자동 판 도구 (dev/team-run.py) 의 1초 3번 검사
    if (Array.isArray(window.__fxTrace)) {
        window.__fxTrace.push(['F', now, Math.min(fxFlashCap(), alpha)]);
    }
    return fxScreenFlash(s, Math.min(fxFlashCap(), alpha), color, max);
};
// 3:3 은 1:1 연출의 흔들기도 끔 — 앞쪽 층 (#foreground) 이 ±1px 흔들려 무대 양 끝에 세로줄이 번갈아 생기던 것 (fxGameShake 는 막았는데 이 길은 그대로, 아트 디렉터 #95 4바퀴 ⑦)
const fxUltShake0 = ultShake;
ultShake = function (...args) {
    if (fxInGame() && fxTeamOn()) {
        return undefined;
    }
    return fxUltShake0(...args);
};
// 기술 연출 (moves.js) · 1:1 연출도 앞쪽 층을 직접 흔듦 — 3:3 동안은 그 층의 몸짓을 안 받음 (혼자 필살기 6종 1.2 ~ 1.4초 ±1 ~ 4px · 동작 줄이기에서도, 디자인 UX #95 4바퀴 ①)
function fxHoldForeground() {
    const fg = document.getElementById('foreground');
    if (!fg || fg.fxHeld) {
        return;
    }
    fg.fxHeld = true;
    fg.animate = function (...args) {
        if (fxInGame() && fxTeamOn()) {
            return null;
        }
        return Element.prototype.animate.apply(this, args);
    };
}
fxHoldForeground();
// 필살기가 상대를 처음 맞힌 순간 — 게임은 그때 피해를 넣음 (연출이 다 끝날 때까지 기다리지 않게)
const fxUltHit = ultHit;
ultHit = function (q, ...rest) {
    // 앞 감는 동안 맞음 (밀림 · 벌러덩 몸짓) 은 건너뜀 — 감은 장면은 안 보여서 (보이는 맞음 · 피해는 3:3 판 타이머)
    if (fxSeeking) {
        return undefined;
    }
    // 3:3 은 밀기 · 띄우기 · 떨기 없이 (1:1 벌러덩이 옆 칸 HP 판 위로 밀려 겹쳤다 튀던 것 — 아트 디렉터 #95 4바퀴 ③) · 맞음은 연출 · 숫자로
    const out = fxTeamOn() ? undefined : fxUltHit(q, ...rest);
    const g = fxGame;
    if (Array.isArray(window.__fxTrace) && g && (q?.pokemon ?? q) === g.B) {
        window.__fxTrace.push(['h', performance.now()]);
    }
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
// clear() 때 그때까지의 번호는 모두 멈춤 — fxKilled 는 64개만 기억해서 3:3 처럼 기술 번호가 많으면 방금 멈춘 필살기 번호가 밀려나 남은 타이머가 다시 그리던 것 (코드 리뷰어)
let fxDeadBelow = 0;
function fxKill(gen) {
    fxKilled.add(gen);
    // 오래된 번호는 버림 — 걸어 둔 타이머는 길어야 15초라 최근 것만 있으면 됨
    if (fxKilled.size > 64) {
        fxKilled.delete(fxKilled.values().next().value);
    }
}
// 기술 · 방어 · 회복 연출이 거는 타이머 번호 (솔라빔 모으기 · 번개 …) — clear() 가 멈추고 새 번호로
let fxMoveGen = ++fxGen;
function fxGuard(gen, fn, sched) {
    const run = function (...args) {
        if (gen <= fxDeadBelow || fxKilled.has(gen)) {
            return undefined;
        }
        // 3:3 합동 — 그 번호가 멈춰 있었으면 (쏘는 필살기 모으기 늘리기 · 빔 끝 맞추기) 그만큼 뒤로 미룸
        if (sched !== undefined && fxFreezeLog.has(gen)) {
            const t = performance.now();
            const until = Math.max(t, fxFrozen.get(gen) ?? 0);
            const lag = fxFrozenBetween(gen, sched, t) + (until - t);
            if (lag > 1) {
                sched = until;
                fxSetTimeout0(() => run.apply(this, args), lag);
                return undefined;
            }
        }
        return fxWithTimers(gen, () => fn.apply(this, args));
    };
    return run;
}
// run 하는 동안 거는 타이머 (setTimeout) 에 번호를 붙임 — 그 타이머 안에서도.
// 3:3 기술 (fxTagged 번호) 은 그동안 만든 입자 · 발사기에도 번호 (_g) — stopMove 가 그 기술만 멈춤
const fxTagged = new Set();
// 그중 3:3 기술 번호 (번쩍 · 흔들기 · 전체 멈춤을 끔 — 필살기 번호는 입자에만 번호를 붙이고 번쩍은 그대로)
const fxMoveTagged = new Set();
const fxTagGen = new Map();
// 번호 붙은 입자 · 발사기가 그 뒤에 만드는 입자에도 같은 번호 (발사기는 매 장면 입자를 만듦 — 기본 발사기는 spawnParticle, 전용기는 e.fx)
function fxTagNew(from, gen) {
    for (let i = from; i < moveParticles.length; i++) {
        const p = moveParticles[i];
        if (p._g === undefined) {
            p._g = gen;
            fxTagUpdate(p, gen);
        }
    }
}
// 위 끝 층 필살기 (fxSoftGens) 는 입자 update 안에서 만든 입자에도 같은 번호 — 하이퍼보이스 큰 터짐처럼 update 에서 터지면 번호가 없어 위 끝 층에 안 들어가던 것 (#107)
//   (다른 필살기는 그대로 — 합동 줄기 보기 · 층이 번호로 입자를 나눠 그려서)
function fxTagUpdate(p, gen) {
    if (!fxSoftGens.has(gen) || typeof p.update !== 'function' || p._gUpd) {
        return;
    }
    const f = p.update;
    p._gUpd = true;
    p.update = (...a) => {
        const n = moveParticles.length;
        const prev = fxNowGen;
        fxNowGen = gen;
        try {
            return f(...a);
        } finally {
            fxNowGen = prev;
            fxTagNew(n, gen);
        }
    };
}
function fxTagEmitter(em, gen) {
    if (em._g !== undefined) {
        return;
    }
    em._g = gen;
    if (typeof em.fx === 'function') {
        const f = em.fx;
        em.fx = (...a) => {
            const n = moveParticles.length;
            const prevNow = fxNowGen;
            fxNowGen = gen;
            try {
                return f(...a);
            } finally {
                fxNowGen = prevNow;
                fxTagNew(n, gen);
            }
        };
    }
}
const fxSpawnParticle = spawnParticle;
spawnParticle = function (e) {
    const n = moveParticles.length;
    const out = fxSpawnParticle(e);
    if (e && e._g !== undefined) {
        fxTagNew(n, e._g);
    }
    return out;
};
function fxWithTimers(gen, run) {
    const prev = window.setTimeout;
    const prevNow = fxNowGen;
    fxNowGen = gen;
    const tag = fxTagged.has(gen);
    const p0 = moveParticles.length;
    const e0 = moveEmitters.length;
    window.setTimeout = (fn, ms, ...rest) => {
        if (typeof fn !== 'function') {
            return prev(fn, ms, ...rest);
        }
        // 무대 상자 안에서 건 타이머는 그 상자 안에서 (3:3 판)
        const f = moveFrame;
        const run = f ? (...a) => moveInFrame(f, () => fn(...a)) : fn;
        return prev(fxGuard(gen, run, performance.now()), ms, ...rest);
    };
    try {
        return run();
    } finally {
        window.setTimeout = prev;
        fxNowGen = prevNow;
        if (tag) {
            fxTagNew(p0, gen);
            for (let i = e0; i < moveEmitters.length; i++) {
                fxTagEmitter(moveEmitters[i], gen);
            }
        }
    }
}
function fxGameTargets() {
    if (!fxGame) {
        return undefined;
    }
    // 합동 — 참가자 연출은 상대를 직접 안 침 (각자 맞음 · 도착 알갱이가 맞기 0.8 ~ 1초 전에 상대 위에서 튀던 것 — #80 UX U2). 맞음은 합동 마무리 하나
    if (fxGame.joint) {
        return [];
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
    // 움직이기 (UltMoveState) 가 거는 타이머도 그 필살기 번호로 · 3:3 판은 무대 상자 안에서 (몸 자리가 상자 기준)
    if (g.stage) {
        fxStageSoft(g);
    }
    moveInFrame(g.frame || null, () => fxWithTimers(g.gen, () => {
        for (const p of [...(g.many || [g.A]), g.B]) {
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
    }));
}
// kill = 중간에 멈춤 (남은 타이머 건너뜀) · 아니면 다 끝나서 정리만
function fxGameStop(kill) {
    // 숨긴 진짜 그림은 연출이 멈추면 늘 되돌림 (꼭두각시 끝 타이머가 버려져도)
    fxHideAll();
    // 힘대결 인트로에서 숨긴 HP · 힘대결 상자 되돌림 (끊겨도 — core ultHideHud)
    if (typeof ultHudRestore === 'function') {
        ultHudRestore();
    }
    if (!fxGame) {
        return;
    }
    const g = fxGame;
    fxGame = undefined;
    if (fxJointTop?.g === g) {
        fxJointTop = null;
    }
    if (fxJ11?.g === g) {
        fxJ11 = null;
    }
    if (kill) {
        fxKill(g.gen);
        (g.gens || []).forEach((x) => fxKill(x));
        // 3:3 용 판 — 상자 · 힘겨루기 줄기 (수명이 길어 멈출 때 끝냄 — 코드 리뷰어)
        fxFrameFree(g.frame);
        if (g.duel33) {
            g.duel33.p.max = g.duel33.p.life;
        }
        // 대결 입자 (수명 FX_DUEL_LONG — fxGame 를 안 봄) 도 끝냄 (합동 마무리가 대결을 이어받을 때 가운데서 계속 밀던 것 — 코드 리뷰어)
        if (g.duel) {
            for (const q of moveParticles) {
                if (q.max === FX_DUEL_LONG) {
                    q.max = q.life;
                }
            }
        }
        // 게임 화면 흔들기도 멈춤 (ultShake)
        document.querySelector('#pokemon-game .pg-field')?.ultShakeAnim?.cancel();
    }
    clearInterval(g.tick);
    clearTimeout(g.done);

    (g.gens || []).forEach((x) => {
        fxTagged.delete(x);
        fxFrozen.delete(x);
        fxFreezeLog.delete(x);
        fxBeamView.delete(x);
        fxNoFlashGens.delete(x);
    });
    if (ultActive && ultActive.pokemon === g.A) {
        ultEnd(g.A);
    }
    (g.many || [g.A]).forEach((p) => p.fxReset());
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
/** quick = 같은 전투 두 번째 완벽 패링부터 — 높이 올라가는 구슬 대신 막은 자리 바로 위에서 작은 불꽃 (약 0.4초, 2026-10-21 ideas #127) */
function swatUp(g, x0, y0, cols, quick) {
    const s = g.s;
    if (quick) {
        const by = y0 - 18 * s;
        swatBoom(x0, by, s, cols, 0.6);
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
            sigParticle({ x: x0, y: by, s, vx: Math.cos(a) * 70 * s, vy: Math.sin(a) * 70 * s, g: 90 * s, drag: 3, max: 0.35, color: i % 2 ? HIT_GOLD[0] : cols[0], draw: DRAW.dot });
        }
        return;
    }
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
// 위아래로 dy 만큼 (3:3 — 다른 줄 상대)
const fxShiftY = (g, dy) => ({ ...g, mouth: { ...g.mouth, y: g.mouth.y + dy }, body: { ...g.body, cy: g.body.cy + dy, top: g.body.top + dy, bottom: g.body.bottom + dy } });
// 3:3 다른 줄 상대 겨누기 (2026-10-21 디자인팀 6판 · 기획 — 일반 모드 기술은 쏘는 높이로 곧게 날아가 다른 줄 상대를 비켜 감):
// 상대 자리에 놓는 틀 (회오리 · 돌떨구기 · 번개 · 땅 · 가루) 은 상대 발 높이로 · 광선은 상대 높이에서 · 날아가는 입자는 상대 쪽으로 기울여 (옆 빠르기 × 높이 차 ÷ 거리)
const FX_PLACED = new Set(['vortex', 'rockfall', 'thunder', 'quake', 'powder']);
function fxAimRow(fx, aim, g0, t) {
    const dyMouth = t.cy - g0.mouth.y;
    const dyGround = t.ground - g0.body.bottom;
    if (FX_PLACED.has(fx)) {
        return Math.abs(dyGround) < 2 ? aim : { ...aim, g: fxShiftY(aim.g, dyGround) };
    }
    if (Math.abs(dyMouth) < 2) {
        return aim;
    }
    if (fx === 'beam' || fx === 'solarbeam') {
        return { ...aim, g: fxShiftY(aim.g, dyMouth) };
    }
    const dx = t.cx - g0.mouth.x;
    if (Math.abs(dx) < 20) {
        return aim;
    }
    const slope = dyMouth / dx;
    const prev = aim.cap;
    return { ...aim, cap: (p) => {
        prev?.(p);
        p.vy = (p.vy ?? 0) + (p.vx ?? 0) * slope;
    } };
}
// 입에서 날아가는 거리 (px) — 틀의 빠르기 · 끌림 · 수명으로 셈 (v / 끌림 × (1 − e^−끌림×수명), 끌림 없으면 v × 수명)
const fxFly = (v, drag, life) => (drag > 0 ? (v / drag) * (1 - Math.exp(-drag * life)) : v * life);
const FX_TRAVEL = {
    breath: (g) => 12 * g.s * (1 + 0.8 * g.P), // 사진으로 잼 (끌림 2.6 − 세기)
    water: (g) => fxFly(66 * (1 + 0.6 * g.P) * g.s, 0.4, 0.65 * (1 + 0.4 * g.P)),
    bubbles: (g, o) => fxFly(35 * g.s * (o.many ? 1.5 : 1), 0.9, 1.05),
    rings: (g, o) => (o.forward ? fxFly((90 + 40 * g.P) * g.s, 0, 0.7) : 0),
    notes: (g) => fxFly(22 * g.s, 0, 1.1),
};
// 날리기 (projectile) 가 상대에 닿는 때 = 연출 길이의 이만큼 — src/game/features/battle/fx/shot-hit.ts shotHitAt('projectile') 와 같은 값 (fx/move-look.test 가 견줌)
const PROJECTILE_HIT_AT = 0.85;
// 고리 (rings) 가 닿는 때 — shot-hit.ts SHOT_HIT_AT.rings 와 같은 값
const RINGS_HIT_AT = 0.7;
// 뿜기 (breath) 가 닿는 때 — shot-hit.ts SHOT_HIT_AT.breath 와 같은 값
const BREATH_HIT_AT = 0.87;
// 1:1 뿜기 기울임 — 입이 상대 몸 위쪽 이만큼 (몸 높이 비) 보다 높으면 켬 · 겨누는 곳 = 몸 가운데 + 몸 높이 × LOW (알갱이가 위로 뜨는 만큼 낮게, UX 6바퀴 — fx/move-look.test 가 큰 포켓몬에서 켜지는지 봄)
const BREATH_TILT_ABOVE = 0.3;
const BREATH_TILT_LOW = 0.1;
// 돌 떨구기 (rockfall) — 돌 사이 (ms) · 맞는 때 앞뒤로 모아 떨굼 (#122 2단계 UX 큼: 150ms 마다 0.45초에 떨어져 맞는 때보다 0.2 ~ 1초 먼저 땅에 닿던 것 — 암석봉인 · 분연 · 암석미사일)
const ROCKFALL_EVERY = 30;
// 포물선 날리기 (arc) 가 쓰는 쪽 땅높이로 돌아오는 시간 (초) — moves.js projectile: 처음 위 빠르기 arc × 0.45 · 무게 arc → 2 × 0.45 (fx/move-look.test 가 견줌)
const PROJECTILE_ARC_SEC = 0.9;
// 날리기 빠르기 배 끝 [임시값] — 1:1 은 860 넘게 넓어도 상대까지 319px (가운데 축) · 맞는 때까지 0.28 ~ 0.54초라 2 ~ 5배 · 느린 하트 (천사의키스 speed 0.6) 7.9배 (#122 잼)
const PROJECTILE_K_MAX = 8;
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
function fxAim(fx, g, o, t, ms = 0) {
    const clampK = (v) => Math.min(25, Math.max(0.6, v));
    const dense = (k) => Math.min(4, Math.max(1, k));
    // 상대 몸 뒤 (0.3 폭) 를 지나면 사라짐 — 큰 포켓몬의 뿜기가 상대 뒤로 멀리 나가지 않게
    const lim = t.far + g.dir * 0.3 * t.w;
    const stopAt = (front, line = () => lim) => (p) => {
        const prev = p.update;
        // 쳐내기 (swat) 가 튕길 때 원래 update 로 되돌림 — 방향이 바뀌면 "상대 뒤를 지나면 사라짐" 이 필요 없음
        p.aimPrev = prev;
        p.aimStop = true;
        p.update = (q, dt) => {
            prev?.(q, dt);
            if ((q.x + g.dir * front(q) - line()) * g.dir > 0) {
                q.life = q.max;
            }
        };
    };
    const stopPast = stopAt(() => 0);
    // 앞으로 가는 고리는 그려지는 앞 끝 (가운데 + 반지름 — moves.js rings r0 → r1) 으로 잼 — 가운데로 재면 860 에서 앞 끝이 몸 뒤로 56 ~ 68px 넘어감 (#122 2단계 픽셀 2바퀴)
    const stopRing = stopAt((q) => (q.r1 !== undefined ? (q.r0 + (q.r1 - q.r0) * Math.min(1, q.life / q.max)) * q.s : 0));
    switch (fx) {
        case 'breath': {
            // 앞머리는 몸 앞에서 기다렸다 맞는 때에 감쌈 — 끝을 몸 가운데 · 몸 앞 · 평균 알갱이로 맞추던 것은 폭마다 먼저 · 늦게 닿음 (#122 1단계 UX 2 · 3바퀴 · 2단계 UX 2 · 3 · 4바퀴, 태현 님 #457 과 같은 종류)
            //   표의 빠르기 (speed) 와 상관없이 늘 이 끝까지 — 알갱이가 가는 거리 = 빠르기 / 끌림 × (1 − e^−끌림×수명) (moves.js breath: 끌림 2.6 − 세기)
            //   〔#122 2단계 UX 4바퀴〕 앞머리 (가장 빠르고 오래 사는 알갱이 — moves.js breath 48 칸/초 · 수명 0.6 × (1 + 0.7 세기) × life) 를 몸 뒤 (가운데 + 0.5 폭) 에 겨눠
            //   몸 앞을 빠르게 지나게 하고 (끝에 천천히 다가가는 구간이라 860 에서 맞는 때보다 0.2 ~ 0.3초 늦게 닿던 것), 맞는 때 (0.87 × 길이) 까지는 몸 앞 멈춤 줄 · 그 뒤 몸 가운데 멈춤 줄
            //   (늦게 시작하면 큰 포켓몬이 몸을 내민 뒤 0.3초 서 있다 뿜던 것 · 평균으로 맞추면 860 에서 0.1 ~ 0.3초 먼저 · 몸을 뚫고 지나가던 것 — UX 3 · 4바퀴)
            const drag = 2.6 - g.P;
            const head = ((48 * (1 + 0.8 * g.P) * g.s) / drag) * (1 - Math.exp(-drag * 0.6 * (1 + 0.7 * g.P) * (o.life ?? 1)));
            const k = clampK((t.dist + 0.5 * t.w) / head);
            // 줄은 맞는 때보다 60ms 먼저 옮김 — 멈춤 줄에 닿은 알갱이는 느려져 3 ~ 9px 틈을 메우는 데 0.03 ~ 0.18초 (UX 5바퀴)
            const hitAt = performance.now() + BREATH_HIT_AT * ms - 60;
            const hold = t.cx - g.dir * (0.35 * t.w + 3 * g.s);
            // 멈춤 자리는 알갱이마다 ±2칸 흔들림 — 같은 x 에서 지우면 용의숨결 덩어리가 곧은 세로선으로 잘려 보이던 것 (픽셀 4바퀴)
            const stop = stopAt((q) => q.cutJ ?? 0, () => (performance.now() < hitAt ? hold : t.cx));
            return { g, o: { ...o, speed: k, rate: (o.rate ?? 1) * dense(k) }, k: 1, cap: (p) => {
                p.cutJ = (Math.random() * 4 - 2) * g.s;
                stop(p);
            } };
        }
        case 'rings':
            // 앞으로 가는 고리 — 첫 고리가 맞는 때 (shot-hit rings 0.7 × 길이) 에 상대에 닿게 (#122 2단계 UX 큼: 수명 0.7초 끝에 닿게 셈이라 휘감기 n1 은 0.2초 늦고,
            //   하한 0.6 때문에 240 에선 조이기 · 기존 고리가 0.3초 먼저 닿던 것) — 하한 0.15
            //   〔UX 2바퀴〕 그려지는 앞 끝 (가운데 + 반지름 — moves.js 3 → 12 + 5P 칸) 이 몸 앞 (가운데 − 0.3 폭) 에 닿게 · 날아가는 시간은 수명 (0.7초) 의 0.6 안 · 남는 시간은 첫 고리를 늦게 (o.delay)
            //   고리 사이 (o.every) 합 60ms 안 · 가운데 고리가 맞는 때 — 가운데를 맞춰 앞 끝이 240 에서 0.15 ~ 0.3초 먼저 · 길이가 수명보다 긴 고리는 닿기 전에 사라지던 것
            if (o.forward && ms > 0) {
                const n = o.n ?? 3;
                const every = n > 1 ? Math.min(140, 60 / (n - 1)) : 140;
                const first = (RINGS_HIT_AT * ms) / 1000 - ((n - 1) * every) / 2000;
                const fly = Math.max(0.1, Math.min(0.42, first));
                const rAt = (3 + (9 + 5 * g.P) * (fly / 0.7)) * g.s;
                const k = Math.min(25, Math.max(0.05, (t.dist - 0.3 * t.w - rAt) / ((90 + 40 * g.P) * g.s * fly)));
                return { g, o: { ...o, every, delay: Math.max(0, first - fly) * 1000 }, k, rateK: dense(k), cap: stopRing };
            }
        // falls through
        case 'water':
        case 'bubbles':
        case 'notes': {
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
        case 'rockfall': {
            // 가운데 돌이 맞는 때 (0.85 × 길이) 에 땅에 닿게 — 처음부터 떨어지되 천천히 (그림자가 커지며 미리 보임) · 돌 사이 40ms
            const n = o.n ?? 3;
            // 〔UX 3 · 4바퀴〕 + 0.01초 · 펼침 90ms (가운데 돌이 먼저 땅 → +0.03 은 마지막 돌이 0.08 ~ 0.1초 늦음)
            const fall = ms > 0 ? Math.max(0.25, (PROJECTILE_HIT_AT * ms) / 1000 + 0.01 - ((n - 1) * Math.min(ROCKFALL_EVERY, 90 / Math.max(1, n - 1))) / 2000) : 0;
            return { g: fxShift(g, t.cx - (g.body.front + g.dir * 1.4 * g.w)), o: fall ? { ...o, fall, every: n > 1 ? Math.min(ROCKFALL_EVERY, 90 / (n - 1)) : ROCKFALL_EVERY } : o };
        }
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
            //   땅 금 · 흙 고리 반 길이 = 가까운 패널 끝까지 (o.half — 240 에서 지진 · 분함의발구르기 금이 오른쪽 끝 밖으로 잘리던 것, #122 2단계 픽셀 2바퀴)
            return { g: fxShift(g, t.cx - g.body.cx), o: { ...o, half: Math.max(0.5 * g.w, Math.min(t.cx, window.innerWidth - t.cx) - 4 * g.s) }, after: () => fxGameShake(2 + g.P) };
        case 'projectile': {
            // 마지막 발이 맞는 때 (PROJECTILE_HIT_AT × 길이) 에 상대에 닿게 빠르기를 맞춤 (#122 U2 — 빠르기 1 그대로면 0.5 ~ 1초 늦게 닿아
            //   피해 숫자 · 맞는 빛이 나온 뒤에도 날아가던 것: 불꽃세례 · 독침 · 바늘미사일 · 섀도볼 …). 게임의 똑바로 나는 날리기 모두 · 표에 reach: 0 = 예전 빠르기
            let k = 1;
            let travel = 0;
            if (o.reach !== 0 && ms > 0) {
                const n = o.n ?? 1 + Math.round(2 * g.P);
                // 〔#122 2단계 UX 2바퀴〕 가운데 발이 맞는 때에 · 몸 앞 (가운데 − 0.3 폭) 에 닿게 — 마지막 발 · 몸 가운데를 맞춰 240 에서 첫 발 앞 끝이 0.09 ~ 0.12초 먼저 닿던 것
                travel = Math.max(0.12, (PROJECTILE_HIT_AT * ms - ((n - 1) * (o.every ?? 150)) / 2) / 1000);
                // 〔UX 3바퀴〕 하한 0.6 → 0.3 (240 암석포는 0.49 가 필요해 0.12 ~ 0.16초 먼저 닿던 것) — 큰 것 6칸 덜은 걷음 (모양마다 앞 끝이 달라 240 에서 0.15 ~ 0.24초 늦던 것, UX 4바퀴)
                k = Math.min(PROJECTILE_K_MAX, Math.max(0.3, Math.max(0.5 * t.dist, t.dist - 0.3 * t.w) / travel / ((100 + 60 * g.P) * g.s * (o.speed ?? 1))));
            }
            // 포물선도 맞는 때에 상대 발밑에 떨어지게 — 옆 빠르기 × k · 처음 위 빠르기 × f · 무게 × f² (f = 0.9초 / 날아갈 시간). 예전엔 빠르기와 상관없이 0.9초에 떨어져
            //   피해 숫자 · 패링 원보다 0.35 ~ 0.75초 늦게 닿던 것 (씨폭탄 · 진흙폭탄 · 돌떨구기 — #122 1단계 UX 큼, 태현 님 #457 과 같은 종류)
            if (o.arc && travel > 0) {
                const f = PROJECTILE_ARC_SEC / travel;
                return { g, o, k, cap: (p) => {
                    if (p.g && p.vx) {
                        p.vy *= f;
                        p.g *= f * f;
                        // 상대 자리에서 끝 (터지는 것은 거기서 — 그대로 떨어져 상대 뒤 25 ~ 45px 에 굴러가던 것, UX 2바퀴)
                        const at = Math.max(0.5 * t.dist, t.dist - 0.3 * t.w) / Math.abs(p.vx);
                        p.max = Math.min(p.max, at + 0.02);
                        if (o.pop) {
                            p.popAt = Math.min(p.max - 0.02, at);
                        }
                    }
                } };
            }
            // 부메랑 — x = v0/π · sin(πt) (moves.js · 1초에 돌아옴) 가 맞는 때에 상대 가운데가 되게 v0 × k (#122 2단계 UX 큼: 빠르기 배를 안 받아 860 에서 115px 모자라 돌아오던 것 — 뼈다귀부메랑)
            if (o.boomerang && o.reach !== 0 && ms > 0) {
                const at = Math.min(0.5, (PROJECTILE_HIT_AT * ms) / 1000);
                // 〔UX 3바퀴〕 몸 가운데가 아니라 몸 앞 — 240 에서 0.085초 먼저 닿던 것
                const kb = Math.min(PROJECTILE_K_MAX, Math.max(0.3, (Math.PI * Math.max(0.5 * t.dist, t.dist - 0.3 * t.w)) / Math.sin(Math.PI * at) / ((100 + 60 * g.P) * g.s * (o.speed ?? 1))));
                return { g, o, k: kb };
            }
            // 똑바로 나는 것은 상대를 지나면 사라짐 (화면 끝까지 안 감) — 부메랑 · 포물선은 그대로
            return o.boomerang || o.arc ? { g, o } : { g, o, k, cap: (p) => {
                if (p.vx && p.max > 0.3) {
                    p.max = Math.min(p.max, (t.dist + 0.3 * t.w) / Math.abs(p.vx));
                    // 닿는 때 = 상대까지 (불꽃튀기기 pop — 상대 몸에서 터짐, #122)
                    if (o.pop) {
                        p.popAt = Math.min(p.max - 0.02, t.dist / Math.abs(p.vx));
                    }
                }
            } };
        }
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
function fxDuelEntry(kind, form, m, avoid, name) {
    if (kind === 'ult') {
        const named = name && (POKEMON_ULT[form] || []).map((k) => ULT_LIB[k]).find((v) => v && v[0] === name && !ULT_SPECIALS.includes(v[1]));
        if (named) {
            return named;
        }
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

// ── 3:3 필살기 박자 · 자리 (2026-10-21 디자인팀 6판 · 기획) ──
// 필살기 박자표 — "모습|이름|틀" → [큰 맞음 ms, 본편 ms, 자기 둘레 터짐 1/0, 가장 센 번쩍 ms, 덮음 끝 ms, (자기 둘레만) [[거리 px, 덮음 끝] …]] (dev/ult-fx.py — 본편 시작부터, 3:3 자리에서 잼).
// 자기 둘레 터짐은 거리마다 덮음이 달라 (좁은 패널은 돔이 상대까지 덮음 — 디자인팀 UX 9차) 실제 내 · 상대 거리에서 가장 가까운 값
// 그 모습 값이 없으면 같은 필살기 (이름|틀) 의 다른 모습 값, 그것도 없으면 null (처음 닿음 · 본편 40% 로)
let fxUltIndex;
function fxUltTiming(form, e, dist) {
    const t = typeof ULT_HIT !== 'undefined' ? ULT_HIT : {};
    if (!fxUltIndex) {
        fxUltIndex = {};
        for (const [k, v] of Object.entries(t)) {
            const short = k.split('|').slice(-2).join('|');
            if (!(short in fxUltIndex)) {
                fxUltIndex[short] = v;
            }
        }
    }
    const m = t[`${form}|${e[0]}|${e[1]}`] || fxUltIndex[`${e[0]}|${e[1]}`];
    if (!m || m[0] < 0) {
        return null;
    }
    let cover = m[4] ?? -1;
    // 거리별 덮음 끝은 자기 둘레 터짐만 (코드 리뷰어 — 다른 필살기에 남은 목록을 쓰던 것)
    if (m[2] === 1 && Array.isArray(m[5]) && m[5].length > 0 && typeof dist === 'number' && dist > 0) {
        const near = m[5].reduce((a, b) => (Math.abs(b[0] - dist) < Math.abs(a[0] - dist) ? b : a), m[5][0]);
        cover = near[1];
    }
    return { main: m[0], run: m[1], self: m[2] === 1, flash: m[3] ?? -1, cover };
}
/** 내 · 상대 가운데 사이 가로 px (박자표 덮음 끝 고르기) — 모르면 0 */
function fxGap(a, b) {
    const ra = (a?.box || a?.el)?.getBoundingClientRect?.();
    const rb = (b?.box || b?.el)?.getBoundingClientRect?.();
    return ra && rb ? Math.abs(rb.left + rb.width / 2 - (ra.left + ra.width / 2)) : 0;
}
// 3:3 모드 켜짐 (게임이 상태마다 다시 켬)
const fxTeamOn = () => fxRealNow() < fxTeamUntil;


/**
 * 3:3 용 필살기 판 (2026-10-22 태현 님 #122 B · #125 기본 — "너무 화려하게 하니까 깨지는 부분이 많아서 절충안"): 1:1 연출의 핵심 장면만 · 크기 절반 · 2초 안팎 · 무대 안 · 대상을 보고 닿음.
 * 같은 필살기 코드 (112개 그대로) 를 무대 상자 (fxStageFrame) 안에서 컷인 없이 · 큰 순간 (박자표 가장 센 번쩍 · 없으면 큰 맞음) 0.6초 앞까지 앞 감아 (fxSeekRun) ·
 * 그때부터 0.6초 뒤 피해 · 그 뒤 1.3초 보이고 흐려 끔 (fxStageCut). 자기 둘레 터짐은 번쩍 뒤 기운 줄기가 맞을 상대에게 (#92 그대로). 이름은 화면 3:3 띠 (디자인)
 */
function fxStageUlt(A, B, entry, gen, onHit, o) {
    fxHoldForeground();
    fxQuietOthers();
    const tm = fxUltTiming(A.label, entry, fxGap(A, B));
    // 박자표 번쩍이 쏘는 때가 아닌 필살기 (거북왕 메가런처 = 메가진화 펑 · 하이드로캐논 = 물줄기 뒤 폭발) 는 합동과 같은 발사 · 닿음 시각 (FX_JOINT_FIRE) —
    // 메가진화 펑에 피해가 들어가고 물 구슬은 0.6초 뒤에 반쯤 날아가다 끊기던 것 (디자인 UX #95 3바퀴 · #1705 · 태현 님 ⑧ 못 닿음)
    const fire = fxTurtleFire(entry);
    const self = !fire && !!(tm && tm.self && tm.flash >= 0);
    // 큰 순간 = 가장 센 번쩍 (자기 둘레 = 대폭발 → 기운 줄기 · 쏘는 필살기 = 빔이 나감) · 번쩍이 없으면 큰 맞음
    const anchor = fire ? fire[0] : tm ? (tm.flash >= 0 ? tm.flash : tm.main) : -1;
    const reach = fire ? fire[1] - fire[0] : tm && !self && tm.flash >= 0 ? Math.min(FX_STAGE_REACH_MS, Math.max(0, tm.main - tm.flash)) : 0;
    const lead = self ? FX_STAGE_SELF_LEAD_MS : FX_STAGE_LEAD_MS;
    const others = (o.others || []).filter((x) => x && fxWidth(x) >= 1);
    // 상자 = 쓰는 포켓몬 + 맞는 상대 하나 (범위의 나머지 상대는 맞음 임팩트 — 상자가 무대 전체가 되지 않게) · 자기 둘레는 쓰는 포켓몬 둘레
    const frame = fxStageFrame(A, [B], !!tm?.self);
    fxTagged.add(gen);
    // 엔진 맞는 때가 연출보다 늦으면 (끼어들기 창) 그만큼 기 모으기 (일반 모드 꾹 누르기 고리) 를 먼저 — 맞음 = 엔진 맞는 때 (U2)
    const hitAt0 = self ? FX_STAGE_SELF_LEAD_MS + FX_FLOW_DELAY_MS + FX_FLOW_MS + 80 : FX_STAGE_LEAD_MS + reach;
    const wait = Math.max(0, Math.round((o.hitMs ?? 0) - hitAt0));
    // down0 = 시작할 때 쓰러져 있던 칸 (상자 밑에서 새로 쓰러지면 상자 그림을 옅게 — fxStageSoft)
    const g = { A, B, gen, tick: setInterval(fxGameTick, 100), onHit: null, hit: false, noFlash: false, frame, stage: true, down0: new Set(fxGameDown().map((q) => q.el)) };
    fxGame = g;
    // 맞을 상대 (범위면 모두) 만 연출이 덮음 · 쓰는 포켓몬 · 우리 편 · 지나가는 몸은 구멍
    fxLiftBystanders(g, [B, ...others]);
    // 앞길 끝 = 가장 가까운 상대 칸 16px 앞 (화면 px) — 1:1 연출의 집중선 · 모으기 줄이 상대 몸 위로 지나가지 않게 (fx-sky 하이드로캐논 — 아트 디렉터 #95 6바퀴 ③)
    const aBox = A.collision || A.el;
    const foeCls = aBox.classList?.contains('pg-team-me') ? 'pg-team-foe' : 'pg-team-me';
    const toR = fxRect0.call(B.collision || B.el).left >= fxRect0.call(aBox).left;
    let clear = toR ? Infinity : -Infinity;
    for (const el of document.querySelectorAll(`#pokemon-game .${foeCls}`)) {
        const r = fxRect0.call(el);
        if (r.width >= 1) {
            clear = toR ? Math.min(clear, r.left) : Math.max(clear, r.right);
        }
    }
    if (Number.isFinite(clear)) {
        frame.clearX = clear - (toR ? 16 : -16);
    }
    let total = 0;
    try {
        const seek = anchor >= 0 ? Math.max(0, anchor - lead) : 0;
        // wait 동안 기 모으기 고리 (useUltimate charge — 끝나면 본편 · 앞 감기)
        total = fxWithTimers(gen, () => useUltimate(A, entry, { quick: true, charge: wait, noIntro: true, wrap: (run) => fxSeekRun(g, frame, seek, run) })) || 0;
    } catch (err) {
        ultError('stage ult', err);
    }
    if (!total) {
        fxGameStop(true);
        return 0;
    }
    const at = (ms) => wait + ms;
    const hitNow = () => {
        try {
            onHit?.();
        } catch (err) {
            ultError('game hit', err);
        }
    };
    // 자기 둘레 (블래스트번 등) — 번쩍 0.2초 뒤 기운 줄기가 맞을 상대 모두에게 → 닿을 때 피해 (#92) · 쏘는 필살기는 큰 순간에 피해
    // 자기 둘레 — 기운 줄기가 닿고 한 장면 뒤 (숫자가 줄기보다 65 ~ 100ms 먼저 뜨던 것, 디자인 UX #95)
    const hitAt = self ? lead + FX_FLOW_DELAY_MS + FX_FLOW_MS + 80 : lead + reach;
    if (self) {
        const targets = [B, ...others];
        fxSetTimeout0(fxGuard(gen, () => fxSoloFlow(gen, A, targets, fxCols4(ultCols(entry[2] || {}, entry[1])), FX_SPIN_COLS[entry[0]])), at(lead + FX_FLOW_DELAY_MS));
        // 쓰는 쪽 터짐은 기운이 닿고 0.3초 뒤 바둑판으로 끊음 (돔 · 덩굴이 맞은 뒤에도 우리 편을 덮던 것 — UX 리뷰어 #95 ② · 240)
        fxSetTimeout0(() => fxStageCut(g), at(hitAt + 300));
    }
    fxSetTimeout0(fxGuard(gen, hitNow), at(hitAt));
    const end = at(hitAt + FX_STAGE_AFTER_MS);
    fxSetTimeout0(() => fxStageCut(g), end);
    g.done = fxSetTimeout0(() => fxGame === g && fxGameStop(true), end + FX_STAGE_FADE_MS + 200);
    return end + FX_STAGE_FADE_MS;
}
// ── 3:3 필살기 마무리 — 디자인팀 7판 값 (2026-10-21, 시안 fx7.js · joint7.js 그대로) ──
// 혼자 · 자기 둘레 필살기 (태현 님 #92): 대폭발 번쩍 → 0.2초 뒤 돔 끝에서 기운 줄기 (위로 볼록) 가 맞을 상대 모두에게 0.45초 → 불꽃 맞음 · 피해 (타이머)
// 합동 (#89 A): 컷인 → 두 포켓몬 머리 위 빛줄 0.3초 → 각자 필살기 · 쏘는 줄기는 합류점까지만 (구슬로 기다림) → 대폭발 번쩍 0.2초 뒤 기운 셋이 합류점으로 0.3초 →
//   꼬인 줄기가 상대까지 0.3초 (= 쏘는 필살기의 큰 맞음) → 섞인 큰 폭발 · 번쩍 한 번 · 피해 (타이머)
const FX_FLOW_DELAY_MS = 200;
const FX_FLOW_MS = 450;
// 합동 — 컷인 뒤 빛줄
const FX_LINK_MS = 300;
// 닿은 뒤 여운 (섞인 큰 폭발 0.9초 + 정리)
const FX_JOINT_BURST_MS = 1500;
const FX_CORE = '#fffbe8';
// 번쩍을 빼는 번호 (합동의 쏘는 쪽 — 흰 돔이 회색으로 깜빡이던 것)
const fxNoFlashGens = new Set();
// 합동 맞은 뒤 꼬리 — 엔진은 피해 (jointMs − jointHitMs) 뒤 다시 달림 · 그 전에 흐려 끔 (보통 기술 · 쓰러짐 · 다음 필살기가 합동 꼬리 위에 겹치고 다음 필살기가 꼬리를 뚝 끊던 것 — #80 진단 ②)
const FX_JOINT_TAIL_MS = 1550;
// 맞은 뒤 (아트 디렉터 #80 — 멈춘 그림이 반투명으로 흐려지던 것은 영상 디졸브 · design-system 12장 "바둑판 3걸음"): 참가자만 120ms 히트스톱 →
// 발사기를 끄고 남은 입자 수명을 0.45초로 자름 (본편 다음 단계 — 다시 굵어짐 · 덩굴이 퍼짐 — 를 막음) → +300 · +450 · +600 바둑판 (그대로 → 절반 → 4분의 1 → 없음) ·
// +450 에 진짜 그림 · 합동 층 (섞인 폭발 · 숫자) 은 그대로 다 보임 → +950 부터 어둠이 0.5초에 걷힘 (엔진이 다시 달리기 전)
const FX_JOINT_STOP_MS = 120;
const FX_JOINT_KEEP_S = 0.45;
const FX_JOINT_DISSOLVE_MS = 300;
const FX_JOINT_STEP_MS = 150;
const FX_JOINT_END_MS = 950;
// 합동 층 — 합동 번호 (컷인 · 빛줄 · 나선 · 합친 줄기 · 섞인 폭발 · 번쩍) 는 맨 위 (각자 맞은 그림 뒤에 묻히던 것 — 아트 디렉터 #80 ③) ·
// 맞은 뒤 참가자 (자기 둘레) 는 따로 층에 그려 바둑판으로 지움 · 쏘는 쪽은 줄기 보기 캔버스를 같이 지움. { g, gen, gens, p, dissolveAt, top, part }
let fxJointTop = null;
// 3:3 장면 전환 합동 (#101 team11Joint) — { g: 앞장 게임 · lit: 어둠에서 밝게 둘 참가자 · 대상 }
// 합동 — 동료가 기를 모아 주는 구간을 늘리는 길이 (#106 — 첫 합동 4.8 → 약 5.8초 · #96 빔 · 오라 앞장도)
const FX_J11_GATHER_EXTRA_MS = 1000;
// 메가진화하는 필살기 (블라스트번 · 하드플랜트 · 메가런처 — 1:1 하얀 실루엣, 태현 님 10-20) — 합동 그림은 꾹 누르기부터 메가진화가 끝날 때까지
// 번개 · 오라 불꽃 혀를 쉬고, 실루엣 위에는 아무것도 안 그림 (연출 틀이 track.morph · morphed · morphBox 를 알림 — #96 디자인)
// 전용 연출 틀 (fx-unique uniq · fx-sky 스타팅 특수 키 — dev/ult-top.py · joint-kinds.py SPECIAL 과 같게) — o.track 을 안 채움 (하이드로캐논 turtle 빔 · 플레어드라이브 flare 빼고)
const FX_J11_SPECIAL = ['uniq', 'blast', 'flare', 'venus', 'turtle', 'ninja', 'clones', 'lucario', 'mew', 'mewtwo'];
const fxJ11Special = (e) => FX_J11_SPECIAL.some((k) => e?.[2]?.[k]);
const fxJ11Morph = (e) => (e?.[1] === 'ultpillar' && !!(e[2]?.blast || e[2]?.venus)) || (e?.[1] === 'ultorb' && !!e[2]?.turtle);
// 3:3 합동 앞장 분류 (#96 — dev/joint-kinds.py 와 같은 규칙 · 바꾸면 둘 다): 구 (모으는 자리 = 구 가운데) · 빔 (빔 시작 = 입) · 오라 (몸)
function fxJ11Kind(e) {
    const o = (e && e[2]) || {};
    if ((e[1] === 'ultorb' && !o.sky) || e[1] === 'ultblackhole' || (e[1] === 'ultdive' && o.flare)) {
        return 'orb';
    }
    if (e[1] === 'ultbeam' || e[1] === 'ultvolt') {
        return 'beam';
    }
    return 'aura';
}
let fxJ11 = null;
const fxBayerTiles = new Map();
function fxBayerErase(L, p, step) {
    if (!L?.ctx || !L.drawn) {
        return;
    }
    const c = L.ctx;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (step >= 3) {
        c.clearRect(0, 0, L.cv.width, L.cv.height);
    } else {
        const k = Math.max(1, Math.round(p * (window.devicePixelRatio || 1)));
        const key = `${k}:${step}`;
        if (!fxBayerTiles.has(key)) {
            const t = document.createElement('canvas');
            t.width = 2 * k;
            t.height = 2 * k;
            const tc = t.getContext('2d');
            tc.fillStyle = '#000';
            // 지울 칸 — 절반: 바둑판 두 칸 · 4분의 1: 왼쪽 위 한 칸만 남김 (fxDissolveDraw 와 같은 무늬)
            tc.fillRect(k, 0, k, k);
            tc.fillRect(0, k, k, k);
            if (step === 2) {
                tc.fillRect(k, k, k, k);
            }
            fxBayerTiles.set(key, t);
        }
        c.globalCompositeOperation = 'destination-out';
        c.fillStyle = c.createPattern(fxBayerTiles.get(key), 'repeat');
        c.fillRect(0, 0, L.cv.width, L.cv.height);
    }
    c.restore();
}
function fxLayerBlit(L) {
    if (!L?.cv || !L.drawn || !moveCtx) {
        return;
    }
    moveCtx.save();
    moveCtx.setTransform(1, 0, 0, 1, 0, 0);
    moveCtx.imageSmoothingEnabled = false;
    moveCtx.drawImage(L.cv, 0, 0);
    moveCtx.restore();
}
// 위 끝 층 (#107 — 디자인 값 10-24 22:30): 하늘까지 닿는 기둥 · 회오리 · 날씨 틀은 그 필살기 입자를 따로 그려, 자르는 줄 (fxStageTop — 정보줄 · 지도 줄 아래) 위는 지우고
//   그 아래 4칸 (2px 칸) 을 위에서부터 25 · 50 · 75 · 87.5% 채운 Bayer 바둑판 ("위로 이어짐" — 일자로 잘려 정보줄 · 지도 줄에 걸쳐 머물던 것, ux-rules U4) ·
//   어둠 · 번쩍 · 화면 판 (_full · _flash · _screen) 은 큰 캔버스 그대로 (띠에 줄무늬가 생기지 않게) · 구 · 덩어리 · 큰 터짐 (블래스트번 반구) 은 이 층이 아니라 자리를 옮김
// ultdive = 하늘에서 내려오는 빛기둥 · 내리꽂는 줄기 · 솟아 사라지는 몸 (리자몽 플레어드라이브 하늘 불꽃 구는 머무는 모양이라 뺌)
// ultnova = 화면 전체 대폭발 (반지름이 무대보다 커서 자리를 옮겨도 위 끝을 넘음 — 크기는 그대로) · 솔라빔 하늘 햇빛 기둥 (o.solar) · twinkle 화면 가득 별 · 하트 (날씨처럼)
// ultvolt = 화면 끝까지 뻗는 번개 줄기 (10만볼트 · 1000만볼트 — 위로 뻗은 줄기가 천천히 돌며 위 끝을 넘음) · ultthunder = 하늘에서 내리치는 번개 (스파킹기가볼트 끝 · 번개 기둥)
const FX_SOFT_TOP = new Set(['ultpillar', 'ultvortex', 'ultstorm', 'ultbloom', 'ultdive', 'ultnova', 'ultvolt', 'ultthunder']);
const fxSoftTopOk = (e) => (FX_SOFT_TOP.has(e?.[1]) || (e?.[1] === 'ultbeam' && !!e[2]?.solar) || (e?.[1] === 'ultsparkle' && e[2]?.mode !== 'moon' && !e[2]?.uniq)) && !e[2]?.blast && !e[2]?.flare;
const fxSoftGens = new Set();
const fxSoftTopL = {};
// 필살기 하나 전체가 아니라 한 입자만 (_softTop — fx-sky scene sc.soft: 무대보다 큰 반구 등) 위 끝 층에 그릴 때 — 그 입자가 사는 동안 층을 켬
let fxSoftTopUntil = 0;
function fxSoftTopWant(ms) {
    fxSoftTopUntil = Math.max(fxSoftTopUntil, performance.now() + ms);
}
const fxSoftTopOn = () => fxSoftGens.size > 0 || performance.now() < fxSoftTopUntil;
// 한 그림을 둘로 — 큰 캔버스에는 위 끝 띠 (8px) 아래만 (몸 뒤 순서 그대로) · 위 끝 층에는 그 위만 (fx-body 오라처럼 무대보다 큰 몸 뒤 그림 — #107, fx-sky sc.split 과 같음)
//   큰 캔버스에 그릴 때만 (위 끝 층 · 줄기 보기 캔버스에 그리는 중이면 그대로)
function fxSplitTop(ctx, fn) {
    const top0 = fxStageTop();
    if (!(top0 > 0) || ctx !== moveCtx) {
        fn(ctx);
        return;
    }
    fxSoftTopWant(250);
    const cut = top0 + 8;
    const m = ctx.getTransform();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath();
    ctx.rect(0, Math.round(cut * (window.devicePixelRatio || 1)), ctx.canvas.width, ctx.canvas.height);
    ctx.clip();
    ctx.setTransform(m);
    fn(ctx);
    ctx.restore();
    const L = fxSoftTopL.ctx;
    if (!L) {
        return;
    }
    L.save();
    L.setTransform(1, 0, 0, 1, 0, 0);
    L.beginPath();
    L.rect(0, 0, L.canvas.width, Math.round(cut * (window.devicePixelRatio || 1)));
    L.clip();
    L.setTransform(m);
    L.globalAlpha = ctx.globalAlpha;
    L.globalCompositeOperation = 'source-over';
    fn(L);
    L.restore();
    fxSoftTopL.drawn = true;
}
// 띠 4칸 (2px 칸 · 위에서부터 채움 25 · 50 · 75 · 87.5%) — 줄마다 8칸 순서표를 3칸씩 밀어 남김 (어느 위 끝에서도 8칸 중 정확히 2 · 4 · 6 · 7 ·
//   줄마다 구멍이 엇갈려 일직선이 안 생김 — 75% 줄 구멍이 불기둥을 가로지르는 점선으로 읽히던 것 · 4 × 4 Bayer 한 줄만 써서 위 끝에 따라 50 · 50 · 100 · 75% 가 되던 것, 픽셀 검사원 #107)
//   지울 칸 모양은 (폭 · 위 끝 · 칸) 마다 한 번 만들어 둠
const FX_SOFT_FILL = [0.25, 0.5, 0.75, 0.875];
const FX_SOFT_ORD8 = [0, 4, 2, 6, 1, 5, 3, 7];
let fxSoftHoles = null;
// 위 끝 층을 거치지 않고 큰 캔버스에 점으로 그리는 것 (3:3 합동 김 — 픽셀 검사원 #107 띠 없이 위 끝에 닿던 것) — 그 점 자리가 띠 무늬로 남는 칸인지 (위 끝 위는 안 남음)
function fxBandKeep(x, y) {
    const top = fxStageTop();
    if (!(top > 0) || y >= top + FX_SOFT_FILL.length * 2) {
        return true;
    }
    if (y < top) {
        return false;
    }
    const r = Math.floor((y - top) / 2);
    return FX_SOFT_ORD8[(Math.floor(x / 2) + 3 * r) % 8] < FX_SOFT_FILL[r] * 8;
}
function fxSoftTopTrim(L) {
    const top = fxStageTop();
    if (!L.cv || !L.drawn || top <= 0) {
        return;
    }
    const c = L.ctx;
    const dpr = window.devicePixelRatio || 1;
    const k = Math.max(1, Math.round(2 * dpr));
    const y0 = Math.round((top * dpr) / k) * k;
    const w = L.cv.width;
    const key = `${k}:${y0}:${w}`;
    if (fxSoftHoles?.key !== key) {
        const path = new Path2D();
        for (let r = 0; r < FX_SOFT_FILL.length; r++) {
            for (let cx = 0; cx * k < w; cx++) {
                if (FX_SOFT_ORD8[(cx + 3 * r) % 8] >= FX_SOFT_FILL[r] * 8) {
                    path.rect(cx * k, y0 + r * k, k, k);
                }
            }
        }
        fxSoftHoles = { key, path };
    }
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, w, y0);
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = '#000';
    c.fill(fxSoftHoles.path);
    c.restore();
}
// 맞는 순간 (합동 번쩍이 덮는 장면) — 자기 둘레 참가자 입자 · 발사기를 한 번에 뺌 (진짜 그림이 같은 장면에 돌아옴)
function fxJointDrop(J) {
    for (let i = moveParticles.length - 1; i >= 0; i--) {
        if (J.selfGens.has(moveParticles[i]._g)) {
            moveParticles.splice(i, 1);
        }
    }
    for (let i = moveEmitters.length - 1; i >= 0; i--) {
        if (J.selfGens.has(moveEmitters[i]._g)) {
            moveEmitters.splice(i, 1);
        }
    }
}
// 맞은 뒤 히트스톱이 끝날 때 — 참가자 발사기를 끄고 입자 수명을 자르고 번호를 멈춤 (뒤 타이머 단계가 안 나오게)
function fxJointCut(J) {
    for (const q of moveParticles) {
        if (J.gens.has(q._g)) {
            q.max = Math.min(q.max ?? Infinity, (q.life ?? 0) + FX_JOINT_KEEP_S);
        }
    }
    for (let i = moveEmitters.length - 1; i >= 0; i--) {
        if (J.gens.has(moveEmitters[i]._g)) {
            moveEmitters.splice(i, 1);
        }
    }
    J.gens.forEach((x) => fxKill(x));
}
// 박자표 번쩍이 쏘는 때가 아닌 필살기 — 합동에서 맞출 때 · 닿는 때 (ms, 본편 시작부터). 거북왕 하이드로캐논 (o.turtle · fx-sky runHydroCannon):
// 박자표 번쩍 5045 는 물줄기가 그친 뒤 거대한 물 폭발 (재는 창이 번쩍 판을 안 그려 물줄기가 나가는 하양 · 검정 번쩍을 못 잡음) → 물줄기 나감 TB 2.72초 · 가장 가까운 애에 닿음 TH 2.88초 (#80 진단 ①)
// 메가런처 (o.turtle · ultorb — runMegaLauncher): 박자표 번쩍 2833 = 메가진화 펑 · main 4172 → 구슬이 피해 0.6 ~ 0.8초 뒤에 닿던 것 → 발사 TS 4.5초 · 맞음 TX 4.9초 (#80 다시 찍기 ③)
const FX_JOINT_FIRE = { hydro: [2720, 2880], launcher: [4500, 4900] };
const fxTurtleFire = (e) => (e?.[2]?.turtle ? (e[1] === 'ultbeam' ? FX_JOINT_FIRE.hydro : e[1] === 'ultorb' ? FX_JOINT_FIRE.launcher : null) : null);
// 자리형 틀 (불기둥 · 땅 · 꽃 · 대폭발) — 박자표가 쏘는 (self 0) 이어도 자기 둘레 길로 (분화가 쏘는 쪽이 되어 줄기 없이 가운데 불기둥이 5초 얼어 있던 것 — #80 다시 찍기 ④)
const FX_JOINT_AREA = new Set(['ultpillar', 'ultquake', 'ultbloom', 'ultnova']);
// 줄기 보기 캔버스에 그리는 중 — 화면 전체를 칠하는 입자 (빔이 화면을 물들이는 판 등) 는 이때 안 칠함 (계단 · 앞끝으로 잘려 회색 네모가 되던 것 — #80 진단 ④)
let fxViewDrawing = false;
const fxDrawParticle0 = drawParticle;
drawParticle = function (ctx, p) {
    // 개발 창 덮음 재기 (dev/ult-fx.py) — 화면 전체 어두워짐 · 번쩍 판은 그리지 않음 (캔버스 점 수로 상대를 덮는 연출만 셈)
    if (window.__fxMeasure && (p._full || p._flash)) {
        return;
    }
    if (p._g !== undefined) {
        // _screen = 기술 연출이 직접 그리는 화면 전체 번쩍 판 (fx-energy overlay) — 합동 쏘는 쪽은 core 번쩍과 같이 뺌 (번쩍은 닿는 순간 한 번)
        if ((p._flash || p._screen) && fxNoFlashGens.has(p._g)) {
            return;
        }
        const J = fxJointTop;
        // 합동 — 참가자의 화면 전체 어둠 · 물들임은 안 그림 (합동 것 하나만 — 참가자마다 패널 색이 바뀌어 어지럽던 것, 아트 디렉터 #80 ⑦)
        if (J && p._full && J.gens.has(p._g)) {
            return;
        }
        // 합동 쏘는 줄기 — 따로 그려 두면 장 끝에 계단 · 앞끝까지만 (fxStairBlit). 화면 전체 어두워짐 판은 빼고 (앞끝에서 어두워짐이 끊겨 네모 경계가 보이던 것)
        const view = p._full || p._screen ? undefined : fxBeamView.get(p._g);
        if (view?.ctx && ctx === moveCtx) {
            view.drawn = true;
            fxViewDrawing = true;
            try {
                fxDrawParticle0(view.ctx, p);
            } finally {
                fxViewDrawing = false;
            }
            return;
        }
        // 합동 층 — 합동 번호는 맨 위 층
        if (J && ctx === moveCtx && !p._full && p._g === J.gen && J.top.ctx) {
            J.top.drawn = true;
            fxDrawParticle0(J.top.ctx, p);
            return;
        }
        // 위 끝 층 (#107 — 기둥 · 회오리 · 날씨) — 장 끝에 위 끝을 다듬어 큰 캔버스로 (fxSoftTopTrim)
        if (p._softTop) {
            fxSoftTopWant(250);
        }
        if (ctx === moveCtx && !p._full && !p._flash && !p._screen && !p._ui && (fxSoftGens.has(p._g) || p._softTop) && fxSoftTopL.ctx && fxSoftTopOn()) {
            fxSoftTopL.drawn = true;
            fxDrawParticle0(fxSoftTopL.ctx, p);
            return;
        }
    } else if (p._softTop && ctx === moveCtx && fxSoftTopL.ctx && (fxSoftTopWant(250), true)) {
        // 번호 없는 필살기의 위 끝 층 한 입자 (fx-sky sc.soft)
        fxSoftTopL.drawn = true;
        fxDrawParticle0(fxSoftTopL.ctx, p);
        return;
    }
    fxDrawParticle0(ctx, p);
};
// 장면 전환 합동 — 앞장 연출이 알린 대비 장면 (track.contrast — 하이드로캐논 압축 어둠 → 하양) 인지. 어둠 진하기로 셈하던 것은 섀도볼 밤 어둠 전체에 걸려
//   동료가 6.4초 꺼진 것처럼 보이고 (#96 아트 7바퀴 — 6바퀴 ① 고침의 회귀) 틀이 직접 칠하는 어둠은 못 잡아 뺌 · 오라 · 구 앞장은 6바퀴 모습 (제 색 + 1칸 테) 그대로
function fxJ11Contrast(J) {
    return !!J?.track?.contrast;
}
// 필살기 어두워짐 판 (화면 전체) 표시 — 줄기 보기 · 자르기에 들지 않게
const fxUltDimLayer0 = ultDimLayer;
ultDimLayer = function (...args) {
    // 장면 전환 합동 (#101) — 앞장 연출의 어둠 (밝게 둘 애를 안 정한 것) 은 참가자 · 대상 밝게 · 구멍 가장자리 바둑판 · 0.3 아래면 구멍 없음 (#100 ①)
    const J = fxJ11;
    // 동료 꾹 누르기 기 모으기 어둠 (그 포켓몬만 밝게) 은 끔 — 동료가 둘이면 겹으로 어두워져 앞장 구 · 대포까지 묻히던 것 (#103)
    if (J && fxGame === J.g && args[2] !== undefined && !args[4]?.j11) {
        return undefined;
    }
    if (J && fxGame === J.g && args[2] === undefined) {
        // 대비 장면 (fxJ11Contrast) 동안은 동료 구멍을 닫음 — 동료가 앞장보다 또렷해 위계가 거꾸로이던 것 (#96 아트 6바퀴 1)
        args[2] = () => J.lit.filter((u, i) => u?.el?.isConnected && (i === 0 || ((!J.allyUntil || performance.now() < J.allyUntil) && !fxJ11Contrast(J))));
        args[3] = args[3] ?? undefined;
        args[4] = args[4] ?? { edge: 3, minA: 0.3, edgeOf: J.edgeOf };
    }
    const n = moveParticles.length;
    const out = fxUltDimLayer0(...args);
    for (let i = n; i < moveParticles.length; i++) {
        moveParticles[i]._full = true;
    }
    return out;
};
const fxScreenFlash0 = screenFlash;
screenFlash = function (...args) {
    // 합동 쏘는 쪽 번쩍은 아예 안 부름 (박자 0.34초를 먼저 써서 같은 순간의 진짜 번쩍이 버려지던 것 — 코드 리뷰어)
    if (fxNowGen !== undefined && fxNoFlashGens.has(fxNowGen)) {
        return undefined;
    }
    // 합동 중엔 합동 번호의 번쩍만 — 참가자 연출이 장면 안에서 (번호 없이) 부른 번쩍이 맞기 1.2초 전에 패널 전체를 번쩍이던 것 (#80 다섯째 바퀴)
    if (fxJointTop && fxNowGen !== fxJointTop.gen) {
        return undefined;
    }
    const n = moveParticles.length;
    const out = fxScreenFlash0(...args);
    if (moveParticles.length > n) {
        moveParticles[n]._flash = true;
    }
    return out;
};
// 점 하나 (u 칸 격자)
function fxDot(ctx, x, y, u, col) {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x / u) * u, Math.round(y / u) * u, u, u);
}
// 위로 볼록한 길 (p 0 → 1)
function fxArcAt(a, b, lift, p) {
    const mx = (a.x + b.x) / 2;
    const my = Math.min(a.y, b.y) - lift;
    const q = 1 - p;
    return { x: q * q * a.x + 2 * q * p * mx + p * p * b.x, y: q * q * a.y + 2 * q * p * my + p * p * b.y };
}
// 필살기 색 → [흰 심, 옅은, 본색, 짙은]
const fxCols4 = (pal) => ['#ffffff', pal[1] ?? pal[0], pal[2] ?? pal[1] ?? pal[0], pal[3] ?? pal[pal.length - 1]];
// 몸 가운데 · 크기
// 게임 — A 가 B 를 보려면 왼쪽인지 (몸 가운데끼리 — 화면 가운데 쪽을 보던 것: 3:3 에서 가운데를 넘어 선 포켓몬이 상대 반대로 쏘던 것, 개굴닌자 태현 님 #91)
function fxFacesLeft(A, B) {
    const a = A.collision.getBoundingClientRect();
    const b = B.collision.getBoundingClientRect();
    return b.left + b.width / 2 < a.left + a.width / 2;
}
// 필살기 방향 (ult/core.js useUltimate) — 게임 필살기를 쓰는 포켓몬이면 대상 쪽 · 아니면 null (일반 모드 = 화면 가운데 쪽)
function fxGameFacesLeft(pokemon) {
    const g = fxGame;
    if (!g?.B || !pokemon?.collision || !g.A || g.A.el !== pokemon.el) {
        return null;
    }
    return fxFacesLeft(pokemon, g.B);
}
// 3:3 — 지금 쓰러져 있는 칸 (회색 주저앉기 · 벌러덩, TeamLayer pg-team-down) [{ el, r }]. 1:1 은 넘어짐을 덮음 끝 (cover) 뒤로 미뤄서 빈 목록
function fxGameDown() {
    if (!fxInGame() || !fxTeamOn()) {
        return [];
    }
    return [...document.querySelectorAll('#pokemon-game .pg-team-down')].map((el) => ({ el, r: el.getBoundingClientRect() })).filter((q) => q.r.width > 0);
}
function fxBody(A) {
    const r = (A.collision || A.box || A.el).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height * 0.55, w: r.width, h: r.height, ok: r.width >= 1 };
}
// 기운 줄기 — 머리 = 흰 마름모 (반지름 2칸) · 옅은 둘레 (3칸) · 빛 둘레 (반지름 5칸, 35%) / 꼬리 28마디 (굵기 4 → 3 → 2 → 1칸 · 옅은 → 본색 → 짙은) · 4마디마다 엇갈린 혀
function fxFlow(a, b, cols, u, ms, lift = 36) {
    const sec = ms / 1000;
    sigParticle({ x: 0, y: 0, s: 1, max: sec, draw: (ctx, q) => {
        const p = Math.min(1, q.life / sec);
        const L = Math.hypot(b.x - a.x, b.y - a.y) * 1.15;
        const dp = u / Math.max(1, L);
        ctx.globalAlpha = 1;
        for (let i = 28; i >= 1; i--) {
            const t = p - i * dp;
            if (t < 0) {
                continue;
            }
            const pt = fxArcAt(a, b, lift, t);
            const w = i < 6 ? 4 : i < 14 ? 3 : i < 22 ? 2 : 1;
            const col = cols[i < 6 ? 1 : i < 18 ? 2 : 3];
            for (let k = 0; k < w; k++) {
                fxDot(ctx, pt.x, pt.y + (k - (w >> 1)) * u, u, col);
            }
            if (i % 4 === 0 && i < 24) {
                const s = (i / 4) % 2 ? -1 : 1;
                const n = i < 12 ? 2 : 1;
                for (let k = 1; k <= n; k++) {
                    fxDot(ctx, pt.x, pt.y + s * ((w >> 1) + k) * u, u, cols[k === 1 ? 2 : 3]);
                }
            }
        }
        const h = fxArcAt(a, b, lift, p);
        // 머리 둘레 = 바둑판 본색 (반투명 둘레는 남색 위 회색 테로 보였음 — 디자인팀 아트 2차)
        for (let j = -5; j <= 5; j++) {
            for (let i = -5; i <= 5; i++) {
                const d2 = i * i + j * j;
                if (d2 > 9 && d2 <= 25 && (i + j) & 1) {
                    fxDot(ctx, h.x + i * u, h.y + j * u, u, cols[2]);
                }
            }
        }
        for (let j = -3; j <= 3; j++) {
            for (let i = -3; i <= 3; i++) {
                const m = Math.abs(i) + Math.abs(j);
                if (m <= 3) {
                    fxDot(ctx, h.x + i * u, h.y + j * u, u, cols[m <= 2 ? 0 : 1]);
                }
            }
        }
    } });
}
// 불꽃 맞음 (혼자 — 기운 줄기가 닿은 곳) — 1칸 폭 혀 12개 3걸음 (150ms) 에 4 → 7 → 9칸 (위쪽 +2) · 흰 심 원 3 → 4 → 3칸 · 0.45초
function fxFlameHit(x, y, cols, u) {
    sigParticle({ x: 0, y: 0, s: 1, max: 0.45, draw: (ctx, q) => {
        const k = Math.min(2, Math.floor((q.life * 1000) / 150));
        const R = [3, 4, 3][k];
        ctx.globalAlpha = 1;
        for (let a = 0; a < 12; a++) {
            const an = (a / 12) * Math.PI * 2;
            const L = [4, 7, 9][k] + (Math.sin(an) < -0.3 ? 2 : 0);
            for (let i = 1; i <= L; i++) {
                fxDot(ctx, x + Math.round(Math.cos(an) * (R + i)) * u, y + Math.round(Math.sin(an) * (R + i) * 0.8) * u, u, cols[i <= 2 ? 1 : i < L - 1 ? 2 : 3]);
            }
        }
        for (let j = -R; j <= R; j++) {
            for (let i = -R; i <= R; i++) {
                const d2 = i * i + j * j;
                if (d2 <= R * R) {
                    fxDot(ctx, x + i * u, y + j * u, u, k === 2 && d2 > 4 ? cols[1] : cols[0]);
                }
            }
        }
    } });
}
// 잇는 빛줄 — 합동이 정해지면 머리 위를 잇는 금색 무지개 0.3초 (위로 볼록 −14px · 2칸 점선 + 흰 빛이 3걸음에 건너감 · 양 끝 + 모양)
function fxLinkLine(a, b, u) {
    sigParticle({ x: 0, y: 0, s: 1, max: FX_LINK_MS / 1000, draw: (ctx, q) => {
        const k = Math.min(2, Math.floor((q.life * 1000) / 100));
        const n = Math.max(4, Math.round((Math.hypot(b.x - a.x, b.y - a.y) * 1.3) / u));
        ctx.globalAlpha = 1;
        for (let i = 0; i <= n; i++) {
            const lit = Math.abs(i / n - (k + 0.5) / 3) < 0.17;
            if (i % 2 && !lit) {
                continue;
            }
            const p = fxArcAt(a, b, 14, i / n);
            fxDot(ctx, p.x, p.y, u, lit ? '#ffffff' : '#ffd76a');
        }
        [a, b].forEach((p) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([i, j]) => fxDot(ctx, p.x + i * u, p.y + j * u, u, i || j ? '#ffd76a' : '#fff3b0')));
    } });
}
// 쓴 쪽 둘레의 그려진 그림 (캔버스) — 대폭발 돔의 상대 쪽 끝 · 색. 입자 자리는 큰 그림 하나의 가운데라 돔 크기를 몰라서 캔버스를 읽음
function fxDomeScan(a, dir, reach) {
    const out = { edge: null, cols: null };
    if (!moveCtx) {
        return out;
    }
    try {
        const dpr = window.devicePixelRatio || 1;
        const R = Math.min(reach, a.w * 4);
        const x0 = Math.max(0, Math.floor((a.x - R) * dpr));
        const x1 = Math.min(moveCanvas.width, Math.ceil((a.x + R) * dpr));
        const y0 = Math.max(0, Math.floor((a.y - a.h * 2.5) * dpr));
        const y1 = Math.min(moveCanvas.height, Math.ceil((a.y + a.h * 0.6) * dpr));
        if (x1 - x0 < 4 || y1 - y0 < 4) {
            return out;
        }
        const W = x1 - x0;
        const d = moveCtx.getImageData(x0, y0, W, y1 - y0).data;
        const px = [];
        for (let i = 0; i < d.length; i += 4 * 3) {
            if (d[i + 3] < 200) {
                continue;
            }
            const r = d[i];
            const g = d[i + 1];
            const b = d[i + 2];
            // 흰 심 · 어두워짐 (회색 · 남색) 은 빼고 색이 있고 밝은 것만
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            if (Math.max(r, g, b) - Math.min(r, g, b) < 40 || lum < 50) {
                continue;
            }
            px.push([lum, r, g, b]);
        }
        if (px.length >= 30) {
            px.sort((p, q) => p[0] - q[0]);
            const hex = (k) => {
                const c = px[Math.min(px.length - 1, Math.floor(px.length * k))];
                return `#${[c[1], c[2], c[3]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
            };
            out.cols = ['#ffffff', hex(0.85), hex(0.5), hex(0.12)];
        }
        // 돔 끝 — 몸 가운데 높이 위 (몸 키 × 0.4) 줄을 상대 쪽으로 걸으며 마지막으로 밝은 점 (12px 넘게 끊기면 끝)
        const row = Math.round((a.y - a.h * 0.4) * dpr) - y0;
        if (row >= 0 && row < y1 - y0) {
            let last = -1;
            let gap = 0;
            const start = Math.round(a.x * dpr) - x0;
            for (let i = start; i >= 0 && i < W; i += dir) {
                const k = (row * W + i) * 4;
                const lum = 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2];
                if (d[k + 3] >= 200 && lum > 140) {
                    last = i;
                    gap = 0;
                } else if (++gap > 12 * dpr) {
                    break;
                }
            }
            if (last >= 0) {
                out.edge = (last + x0) / dpr;
            }
        }
    } catch {
        // 읽지 못하면 (캔버스가 막힘 등) 몸 둘레 · 필살기 색으로
    }
    return out;
}
// 혼자 · 자기 둘레 — 대폭발 돔 끝 (위) 에서 맞을 상대 모두에게 기운 줄기 → 닿으면 불꽃 맞음 (그림만 — 피해는 부른 쪽 타이머). 색 = 그 대폭발 색
function fxSoloFlow(gen, A, targets, fallback, fixed) {
    const a = fxBody(A);
    if (!a.ok) {
        return;
    }
    const S = Math.max(1, Math.round(a.w / (A._originalSpriteSize || 32)));
    const u = 2 * S;
    const first = targets.map(fxBody).find((b) => b.ok);
    const dir = first && first.x < a.x ? -1 : 1;
    const scan = fxDomeScan(a, dir, first ? Math.abs(first.x - a.x) * 0.8 : a.w * 4);
    const cols = fixed || scan.cols || fallback;
    const from = scan.edge !== null ? { x: scan.edge - dir * u * 3, y: a.y - a.h * 0.55 } : { x: a.x + dir * a.w * 0.6, y: a.y - a.h * 0.4 };
    for (const t of targets) {
        const b = fxBody(t);
        if (!b.ok) {
            continue;
        }
        fxFlow(from, { x: b.x, y: b.y }, cols, u, FX_FLOW_MS, 36);
        setTimeout(() => fxFlameHit(b.x, b.y, cols, u), FX_FLOW_MS);
    }
}

// ── 합동 나선 감기 (태현 님 #98 D — 디자인팀 8판 값, 시안 fx8.js · joint7.js) ──
// 둘이 같이 시작 → 쏘는 쪽은 모으기를 늘림 (입 앞 빛 구슬이 400ms 마다 커짐) → 자기 둘레 대폭발 "크게" 순간에 빔 (×1.5 굵게) 이 나감 →
// 빔 앞끝 + 기운 나선이 0.9초에 상대 가슴까지 (앞끝 너머는 안 그림) → 닿는 순간 = 쏘는 쪽 꽃 터짐 = 섞인 큰 폭발 + 번쩍 + 피해 (한 장면)
const FX_SPIRAL_RUN_MS = 900;
// 번호마다 멈춤 (그 때까지) — 입자 · 발사기 · 타이머 (fxGuard) 가 멈춤: 쏘는 필살기의 모으기를 늘리고 · 빔 끝 (꽃 터짐) 을 나선이 닿는 때에 맞춤
const fxFrozen = new Map();
let fxFrozenLast = 0;
// fxGuard 를 건너뛰는 타이머 — 게임 시계 (3:3 박자 0.8 · 개발 모드 — src/game/webview/clock.ts 가 __pgSetTimeout 을 내놓음) 는 따름.
// 불러올 때 잡아 둔 진짜 setTimeout 만 쓰면 3:3 에서 빔 멈춤 · 힘대결 HUD 되돌림이 20% 일찍 오던 것 (코드 리뷰어 #83)
const fxSetTimeoutReal = window.setTimeout.bind(window);
const fxSetTimeout0 = (fn, ms, ...args) => (window.__pgSetTimeout || fxSetTimeoutReal)(fn, ms, ...args);
// 번호마다 쏘는 줄기 보기 — 앞끝 (front(now)) 너머는 안 그림 · 줄이 다르면 계단 (열마다 2칸 폭으로 아래 · 위로 밀기, 기울기 = 줄 차이 / 거리)
const fxBeamView = new Map();
// 멈춘 때 기록 (번호 → [시작, 끝]) — 멈춘 동안 걸려 있던 타이머는 멈춘 만큼 뒤로 (fxGuard)
const fxFreezeLog = new Map();
function fxFreeze(gen, ms) {
    if (ms > 0) {
        const t = performance.now();
        fxFrozen.set(gen, Math.max(fxFrozen.get(gen) ?? 0, t + ms));
        const log = fxFreezeLog.get(gen) ?? [];
        log.push([t, t + ms]);
        fxFreezeLog.set(gen, log);
        sigStart();
    }
}
// a ~ b 사이에 그 번호가 멈춰 있던 시간 (ms)
function fxFrozenBetween(gen, a, b) {
    let sum = 0;
    for (const [s, e] of fxFreezeLog.get(gen) ?? []) {
        sum += Math.max(0, Math.min(e, b) - Math.max(s, a));
    }
    return sum;
}
// 계단 — x 에서 줄기가 밀리는 칸 (입 뒤는 0)
function fxStairDy(v, x) {
    const k = (x - v.x0) * v.dir;
    return k <= 0 ? 0 : Math.round((v.slope * (x - v.x0)) / v.u) * v.u;
}
function fxStairCanvas(v) {
    if (!v.cv) {
        v.cv = document.createElement('canvas');
        v.ctx = v.cv.getContext('2d');
    }
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(window.innerWidth * dpr);
    const h = Math.round(window.innerHeight * dpr);
    if (v.cv.width !== w || v.cv.height !== h) {
        v.cv.width = w;
        v.cv.height = h;
    }
    v.ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (v.drawn !== false) {
        v.ctx.clearRect(0, 0, w, h);
    }
    v.drawn = false;
    v.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return v.ctx;
}
// 따로 그린 줄기를 2칸 폭 열마다 계단 · 앞끝까지만 큰 캔버스로
function fxStairBlit(v, now) {
    if (!v.cv || !moveCtx || !v.drawn) {
        return;
    }
    const dpr = window.devicePixelRatio || 1;
    const front = v.front(now);
    const step = v.u;
    const W = window.innerWidth;
    // 빔이 나가는 동안은 빔 축 + 13칸 아래를 숨김 (찍은 줄기 아래 조각이 먼저 닿은 것처럼 보이던 것)
    const travel = v.bigAt !== undefined && now >= v.bigAt && now < v.hitAt;
    const H = travel ? Math.max(0, Math.min(window.innerHeight, Math.round(v.y0 + 13 * (v.p || 1)))) : window.innerHeight;
    moveCtx.save();
    moveCtx.imageSmoothingEnabled = false;
    // 입 뒤 (밀리지 않음) 는 한 번에 — 합동 맞은 뒤 바둑판이 시작하면 안 그림 (꼭두각시 자리 — 진짜 그림이 돌아옴)
    const xs = Math.max(0, Math.min(W, Math.floor(v.x0 / step) * step));
    const J = fxJointTop;
    const gone = !!J?.dissolveAt && now >= J.dissolveAt;
    if (H <= 0 || gone) {
        // 다 숨김
    } else if (v.dir > 0 && xs > 0) {
        moveCtx.drawImage(v.cv, 0, 0, Math.round(xs * dpr), H * dpr, 0, 0, xs, H);
    } else if (v.dir < 0 && xs < W) {
        moveCtx.drawImage(v.cv, Math.round(xs * dpr), 0, Math.round((W - xs) * dpr), H * dpr, xs, 0, W - xs, H);
    }
    for (let x = v.dir > 0 ? xs : 0; v.dir > 0 ? x < W : x < xs; x += step) {
        if (v.dir > 0 ? x >= front : x + step <= front) {
            continue;
        }
        const dy = fxStairDy(v, x + step / 2);
        if (H > 0 && v.clip && v.mid) {
            // Y 자 팔 — 두 입 가운데 → M 줄 위 (A) · 아래 (B) 만 (넓은 빔이 다른 팔을 덮어 깔때기로 읽히던 것 — 아트 디렉터 #80 둘째 바퀴 ③)
            const m = v.mid;
            const k = Math.max(0, Math.min(1, (x + step / 2 - m.x1) / (m.x2 - m.x1 || 1)));
            const cut = Math.max(0, Math.min(H, Math.round(m.y1 + (m.y2 - m.y1) * k) - dy));
            if (v.clip < 0 && cut > 0) {
                moveCtx.drawImage(v.cv, x * dpr, 0, step * dpr, cut * dpr, x, dy, step, cut);
            } else if (v.clip > 0 && cut < H) {
                moveCtx.drawImage(v.cv, x * dpr, cut * dpr, step * dpr, (H - cut) * dpr, x, dy + cut, step, H - cut);
            }
        } else if (H > 0) {
            moveCtx.drawImage(v.cv, x * dpr, 0, step * dpr, H * dpr, x, dy, step, H);
        }
    }
    moveCtx.restore();
}
// 게임 배우의 진짜 그림 숨기기 — 고정 칸 상자 (collision = .pg-fighter-*) 를 숨김: 게임이 다시 그려 그림 (<img>) 이 새것으로 바뀌어도 그대로
//   (img 에만 숨김을 걸어 쓰러짐으로 다시 그려지면 제자리에 진짜 보스로라가 다시 보여 꼭두각시와 둘이던 것 — #97 · bugs 1819, main 에도) ·
//   풂 = ultHide(false) · 그 필살기 끝 (모르면 12초) 타이머 · 연출을 멈출 때 (fxGameStop — stopUlt · 넘기기 · 반격기 · 마지막 기회 볼 — 코드 리뷰어 #97 높음)
const fxHidden = new Map();
const FX_HIDE_MAX_MS = 12000;
const fxUltHide0 = ultHide;
ultHide = function (pokemon, on) {
    fxUltHide0(pokemon, on);
    if (pokemon?._size !== 'game') {
        return;
    }
    if (!on) {
        fxHideRelease(pokemon);
        return;
    }
    const box = pokemon.collision;
    if (pokemon.el.style.visibility !== 'hidden' || !box || box === pokemon.el) {
        return;
    }
    const now = performance.now();
    const until = ultActive?.pokemon === pokemon && ultActive.until > now ? ultActive.until + 500 : now + FX_HIDE_MAX_MS;
    fxHideRelease(pokemon);
    box.style.visibility = 'hidden';
    fxHidden.set(pokemon, { box, timer: setTimeout(() => fxHideRelease(pokemon), until - now) });
};
function fxHideRelease(a) {
    const h = fxHidden.get(a);
    if (!h) {
        return;
    }
    fxHidden.delete(a);
    clearTimeout(h.timer);
    if (h.box.style.visibility === 'hidden') {
        h.box.style.visibility = '';
    }
}
function fxHideAll() {
    for (const a of [...fxHidden.keys()]) {
        fxHideRelease(a);
    }
}
// 그리기 한 장 — 멈춘 번호는 움직이지 않고 그 자리에 · 줄기 보기 번호는 따로 그려 계단 · 앞끝으로
const fxMoveTick0 = moveTick;
moveTick = function (now) {
    fxFrameId += 1;
    // 그리기가 멈췄다 돌아오면 (패널을 가림) 그 사이는 0.25초까지만
    const dt = fxFrozenLast ? Math.min(250, now - fxFrozenLast) : 0;
    fxFrozenLast = now;
    for (const [g, until] of fxFrozen) {
        if (now >= until || g <= fxDeadBelow || fxKilled.has(g)) {
            fxFrozen.delete(g);
        }
    }
    let held = null;
    let heldE = null;
    if (fxFrozen.size) {
        held = [];
        heldE = [];
        for (let i = 0; i < moveParticles.length; ) {
            if (fxFrozen.has(moveParticles[i]._g)) {
                held.push(moveParticles.splice(i, 1)[0]);
            } else {
                i += 1;
            }
        }
        for (let i = 0; i < moveEmitters.length; ) {
            if (fxFrozen.has(moveEmitters[i]._g)) {
                heldE.push(moveEmitters.splice(i, 1)[0]);
            } else {
                i += 1;
            }
        }
        for (const e of heldE) {
            if (typeof e.until === 'number') {
                e.until += dt;
            }
            if (typeof e.nextShot === 'number') {
                e.nextShot += dt;
            }
        }
    }
    for (const v of fxBeamView.values()) {
        fxStairCanvas(v);
    }
    const J = fxJointTop;
    if (J) {
        fxStairCanvas(J.top);
    }
    if (fxSoftTopOn()) {
        fxStairCanvas(fxSoftTopL);
    }
    try {
        fxBackBegin();
        fxMoveTick0(now);
        fxPunchHoles();
    } finally {
        fxPutBack(held, heldE);
    }
    // 합동 맞은 뒤 — 쏘는 쪽 줄기 보기를 바둑판으로 지움 (+300 · +450 · +600). 자기 둘레 참가자는 +300 에 한 번에 뺌 (fxJointDrop —
    // 따로 층에 그려 통째로 바둑판을 덮었더니 그 연출의 큰 반투명 판 · 고리가 패널 전체 2px 그물이 되던 것, #80 다섯째 바퀴)
    if (J?.dissolveAt && now >= J.dissolveAt) {
        const step = Math.min(3, 1 + Math.floor((now - J.dissolveAt) / FX_JOINT_STEP_MS));
        for (const [x, v] of fxBeamView) {
            if (J.gens.has(x)) {
                fxBayerErase(v, J.p, step);
            }
        }
    }
    for (const v of fxBeamView.values()) {
        fxStairBlit(v, now);
    }
    if (J) {
        fxLayerBlit(J.top);
    }
    if (fxSoftTopOn()) {
        fxSoftTopTrim(fxSoftTopL);
        fxLayerBlit(fxSoftTopL);
    } else if (fxSoftTopL.ctx && fxSoftTopL.drawn) {
        // 층이 꺼질 때 비움 — 다음에 켜진 첫 장에 옛 그림이 한 장 같이 붙지 않게 (코드 리뷰어 #107)
        fxSoftTopL.ctx.save();
        fxSoftTopL.ctx.setTransform(1, 0, 0, 1, 0, 0);
        fxSoftTopL.ctx.clearRect(0, 0, fxSoftTopL.cv.width, fxSoftTopL.cv.height);
        fxSoftTopL.ctx.restore();
        fxSoftTopL.drawn = false;
    }
    fxCutDown(now);
    fxOnTopDraw(now);
    // 입자가 다 끝나 루프가 멈춰도 맨 위 그리기 (대상 다시 그리기 등) 가 남았으면 한 장 더 — 마지막 장에 덧그린 그림이 지워지지 않고 남던 것 (코드 리뷰어 #107 높음)
    if (fxOnTops.length && !moveRaf && moveCtx) {
        moveRaf = requestAnimationFrame(moveTick);
    }
};
// 맨 위 그리기 — 장 끝 (판 · 층을 다 붙인 뒤) 에 그림 (fxOnTop(fn, ms) — fn(ctx) · 화면 좌표). 1:1 필살기 입자는 판 캔버스에 그려 장 끝에 큰 캔버스로 붙어,
//   큰 캔버스에 z 1 로 그린 꼭두각시도 그 밑에 깔리던 것 (하이퍼보이스 앞장 다시 그리기 — #108 아트 1바퀴 ②)
// 진화 (S22) 흰 실루엣 옛 ↔ 새 바뀜 — 초당 2.8번 일정하게 (깜빡임 1초 3번 규칙 · fx-sky 메가 넷과 같은 값 — 초당 2 → 12번으로 빨라지던 것, 10-25 결정 · bugs 1800)
//   시험 fx/evolve-flip.test.ts 가 이 줄을 읽음 (간격 ≥ 0.34초)
const EVO_FLIP_HZ = 2.8;
const fxOnTops = [];
// gen = 그 연출 번호 — 멈춘 (clear · 끊김) 연출 것은 바로 뺌
function fxOnTop(fn, ms, gen) {
    fxOnTops.push({ fn, until: performance.now() + ms, gen });
    if (!moveRaf && moveCtx) {
        moveRaf = requestAnimationFrame(moveTick);
    }
}
function fxOnTopDraw(now) {
    if (!fxOnTops.length || !moveCtx) {
        return;
    }
    const dpr = window.devicePixelRatio || 1;
    for (let i = fxOnTops.length - 1; i >= 0; i--) {
        const d = fxOnTops[i];
        if (now >= d.until || (d.gen !== undefined && (d.gen <= fxDeadBelow || fxKilled.has(d.gen)))) {
            fxOnTops.splice(i, 1);
            continue;
        }
        moveCtx.save();
        moveCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        moveCtx.globalAlpha = 1;
        moveCtx.globalCompositeOperation = 'source-over';
        try {
            moveInFrame(null, () => d.fn(moveCtx));
        } catch (err) {
            ultError('on top', err);
            fxOnTops.splice(i, 1);
        } finally {
            moveCtx.restore();
        }
    }
}
// ── 쓰러진 포켓몬 위 연출 지우기 (#107 UX 큼 1 — 대상 다시 그리기는 쓰러짐 시작에 끝나서, 그 뒤 연출이 누운 회색 모습을 계속 덮던 것 · #1706 같은 종류 세 번째) ──
// 쓰러짐이 시작된 그림 (1:1 = pg-fainted · pg-down — 벌러덩은 넘어짐 기다림 --pg-ko-wait 뒤 · 3:3 = pg-team-down) 의 모양 + 1칸 위 연출 캔버스를 지움 ·
//   테 칸에는 화면 전체 판 · 꼭두각시는 다시 · 모든 필살기 · 기술 공통 · 게임 화면만
const FX_DOWN_PAD = 1; // 그림 점 칸
// 1:1 쓰러짐 연출 (game.css pg-ko — --pg-ko-wait 만큼 늦게 시작) 이 시작했는지 = 그 CSS 애니메이션의 지금 시간 ≥ 늦춤 (처음 본 장 + wait 로 세면 늦게 본 경우 어긋나던 것 — 코드 리뷰어 #107)
function fxKoStarted(body) {
    if (!body.classList.contains('pg-ko-late')) {
        return true;
    }
    // 늦게 넘어지는 판은 이름이 따로 (game.css pg-ko-late · pg-ko-down-late · pg-faint-late) — 'pg-ko' 만 찾아 1:1 에서 한 번도 안 맞던 것 (디자인 #107 UX 3바퀴 헤비봄버 구덩이)
    const a = body.getAnimations?.().find((x) => /^pg-(ko|faint)/.test(x.animationName));
    if (!a) {
        return false;
    }
    const delay = Number(a.effect?.getTiming?.().delay) || 0;
    return (Number(a.currentTime) || 0) >= delay;
}
// 캔버스에 그린 포켓몬 그림 (쓰는 쪽 꼭두각시 · 잔상) — 장마다 적어 두고, 쓰러진 칸을 지운 뒤 지운 칸 안에만 다시 그림
//   (디자인 #107 UX 2바퀴 — 내리꽂는 리자몽 아랫몸이 지우기 상자 윗변에 일자로 잘리던 것 · 돌진 · 내려찍기 공통) · 쓰러진 포켓몬 그림은 빼고
const fxMonDraws = [];
let fxMonDrawsAt = -1;
// 큰 캔버스로 그대로 붙는 판 — 큰 캔버스 · 위 끝 층 (헤비봄버처럼 번호째 이 층 — 위 끝 위만 다듬음) · 합동 층 · 지금 그리는 무대 상자 판
//   (같은 크기 · 같은 기기 좌표라 그 변환 그대로 다시 그림) · 계단 상자는 빼고
function fxMainCtx(ctx) {
    return ctx === moveCtx || ctx === fxSoftTopL.ctx || (!!fxJointTop && ctx === fxJointTop.top.ctx) || (!!moveFrame && ctx === moveFrame.ctx && !moveFrame.stair?.dy);
}
// 그린 판 — null = 그대로 붙음 · 줄기 보기 (1:1 필살기 입자 — 장 끝에 칸마다 계단 dy 로 붙음, fxStairBlit) · undefined = 모르는 판 (안 적음)
//   (큰 캔버스만 보아 1:1 꼭두각시를 못 적어 헤비봄버 꼭두각시가 지운 칸에서 사라지던 것, #107 개발 확인)
function fxMonLayer(ctx) {
    if (fxMainCtx(ctx)) {
        return null;
    }
    if (fxViewDrawing) {
        for (const v of fxBeamView.values()) {
            if (v.ctx === ctx) {
                return v;
            }
        }
    }
    return undefined;
}
function fxMonNote(ctx, src, img, w, h) {
    const v = fxMonLayer(ctx);
    if (v === undefined || !fxInGame()) {
        return;
    }
    if (fxMonDrawsAt !== fxFrameId) {
        fxMonDrawsAt = fxFrameId;
        fxMonDraws.length = 0;
    }
    fxMonDraws.push({ m: ctx.getTransform(), a: ctx.globalAlpha, f: ctx.filter, src, img, w, h, v });
}
// 화면 전체 판 (어둠 _full · 번쩍 _flash · 물들임 _screen) 중 이번 장에 그려진 것 — drawParticle 이 빼는 것 (합동 쏘는 쪽 번쩍 · 참가자 어둠 · 덮음 재기) 은 빼고
function fxScreenLayer(p) {
    if (!(p._full || p._flash || p._screen) || p.life >= p.max) {
        return false;
    }
    if (window.__fxMeasure && (p._full || p._flash)) {
        return false;
    }
    if (p._g !== undefined && (((p._flash || p._screen) && fxNoFlashGens.has(p._g)) || (fxJointTop && p._full && fxJointTop.gens.has(p._g)))) {
        return false;
    }
    return true;
}
function fxCutDown() {
    if (!moveCtx || !fxInGame()) {
        return;
    }
    const els = [];
    // 1:1 = 필살기로 쓰러뜨려 늦게 넘어지는 칸만 (덮는 연출이 남는 경우 · 보통 기술로 쓰러뜨린 칸의 쓰러짐 금빛 별빛은 그대로) — 넘어짐이 시작된 뒤부터
    for (const body of document.querySelectorAll('#pokemon-game .pg-fighter[data-ko] .pg-fx-body.pg-ko-late')) {
        if (!fxKoStarted(body)) {
            continue;
        }
        const img = body.querySelector('img');
        if (img) {
            els.push(img);
        }
    }
    // 3:3 = 필살기 연출이 도는 동안만
    if (fxGame) {
        for (const q of fxGameDown()) {
            els.push(q.el);
        }
    }
    // 다 사라진 몸 (KO 끝 · 볼로 돌아감) 은 뺌 — 그 자리에 단데기 모양 얼룩이 0.3초 남던 것 (디자인 #107 UX 5바퀴 작음 ①)
    for (let i = els.length - 1; i >= 0; i--) {
        if (fxDownAlpha(els[i]) < 0.05) {
            els.splice(i, 1);
        }
    }
    if (!els.length) {
        return;
    }
    const dpr = window.devicePixelRatio || 1;
    // ① 지울 모양 M — 쓰러진 그림 모양 (지금 기울기 · 방향 그대로) 을 FX_DOWN_PAD 칸 넓힌 것 (네모로 지워 어둠 · 물들임 · 구덩이에 네모 구멍이 나던 것 — 디자인 #107 UX 3바퀴 신속 · 헤비봄버 ·
    //   2칸째 바둑판 테는 1 ~ 2px 톱니로 보여 뺌 — 4바퀴)
    const M = fxCutCanvas('m');
    for (const el of els) {
        fxDownShape(M, el, FX_DOWN_PAD);
    }
    // ② 그 자리에 다시 그릴 것 O — 화면 전체 판 (어둠 · 번쩍 · 물들임 — 같은 때 모습 · 같은 순서 · 어둠은 destination-over 라 번쩍 밑으로 · HP 묶음 · 밝힌 구멍도 그 판 그대로) — 테 칸에만 ·
    //   쓰러진 그림 자리는 판 없이 (어둠만 다시 깔면 물들임 · 불 속에서 누운 몸이 검은 그림자로 보이다 어둠이 걷히면 갑자기 회색 — 디자인 #107 UX 4바퀴) + 꼭두각시 · 잔상
    const O = fxCutCanvas('o');
    for (const layer of [-1, 0, 1]) {
        for (let i = moveParticles.length - 1; i >= 0; i--) {
            const p = moveParticles[i];
            const z = p.z ?? 0;
            if ((z < 0 ? -1 : z > 0 ? 1 : 0) !== layer || !fxScreenLayer(p)) {
                continue;
            }
            O.save();
            try {
                if (p._f) {
                    O.translate(p._f.x, p._f.y);
                    moveInFrame(p._f, () => fxDrawParticle0(O, p));
                } else {
                    fxDrawParticle0(O, p);
                }
            } catch {
                // 그 판만 — 다음 장에 원래 자리에서 다시 그려짐
            } finally {
                O.restore();
            }
        }
    }
    O.save();
    O.globalCompositeOperation = 'destination-out';
    for (const el of els) {
        // 흐려지는 만큼만 (KO 0.8 → 0.55 → 0.3) — 다 사라진 몸 자리에 판 없는 얼룩이 남지 않게
        O.globalAlpha = fxDownAlpha(el);
        fxDownShape(O, el, 0);
    }
    O.restore();
    if (fxMonDrawsAt === fxFrameId) {
        const down = new Set(els);
        O.save();
        for (const d of fxMonDraws) {
            if (down.has(d.src)) {
                continue;
            }
            let m = d.m;
            if (d.v) {
                // 줄기 보기 — 그림 가운데 칸의 계단 dy 만큼 (fxStairBlit 과 같게)
                const c = m.transformPoint(new DOMPoint(0, 0));
                m = new DOMMatrix([1, 0, 0, 1, 0, fxStairDy(d.v, c.x / dpr) * dpr]).multiply(m);
            }
            O.setTransform(m);
            O.globalAlpha = d.a;
            O.filter = d.f;
            O.drawImage(d.img, -d.w / 2, -d.h / 2, d.w, d.h);
        }
        O.restore();
    }
    // ③ 큰 캔버스에서 M 모양을 지우고 · M 모양 안의 O 를 붙임
    O.save();
    O.setTransform(1, 0, 0, 1, 0, 0);
    O.globalCompositeOperation = 'destination-in';
    O.drawImage(M.canvas, 0, 0);
    O.restore();
    moveCtx.save();
    moveCtx.setTransform(1, 0, 0, 1, 0, 0);
    moveCtx.globalAlpha = 1;
    moveCtx.globalCompositeOperation = 'destination-out';
    moveCtx.drawImage(M.canvas, 0, 0);
    moveCtx.globalCompositeOperation = 'source-over';
    moveCtx.imageSmoothingEnabled = false;
    moveCtx.drawImage(O.canvas, 0, 0);
    moveCtx.restore();
}
// 쓰러진 몸이 보이는 정도 — 몸 상자 · 그림의 지금 opacity (KO 애니메이션 값) · 숨김이면 0
function fxDownAlpha(el) {
    if (!el.isConnected) {
        return 0;
    }
    let a = 1;
    for (const n of [el, el.closest('.pg-fx-body')]) {
        if (!n) {
            continue;
        }
        const cs = getComputedStyle(n);
        if (cs.visibility === 'hidden' || cs.display === 'none') {
            return 0;
        }
        a *= Number(cs.opacity);
    }
    return a;
}
// 쓰러진 칸 지우기 판 두 장 (큰 캔버스와 같은 크기 · 장마다 비우고 화면 좌표로)
const fxCutL = {};
function fxCutCanvas(key) {
    const w = moveCtx.canvas.width;
    const h = moveCtx.canvas.height;
    if (!fxCutL[key]) {
        fxCutL[key] = document.createElement('canvas').getContext('2d');
    }
    const x = fxCutL[key];
    if (x.canvas.width !== w || x.canvas.height !== h) {
        x.canvas.width = w;
        x.canvas.height = h;
    }
    const dpr = window.devicePixelRatio || 1;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = 'source-over';
    x.globalAlpha = 1;
    x.filter = 'none';
    x.clearRect(0, 0, w, h);
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.imageSmoothingEnabled = false;
    return x;
}
// 쓰러진 그림 모양을 n 칸 넓혀 찍음 — 지금 모습 그대로 (벌러덩 기울기 = 몸 상자 transform · 그림 rotate · 방향 · 같은 칸 크기). 그림 도구가 없으면 상자 네모
function fxDownShape(x, el, n) {
    const r = fxRect0.call(el);
    if (r.width < 1 || r.height < 1 || !el.naturalWidth) {
        return;
    }
    const K = ULT_KIT;
    if (!K.drawMon) {
        x.fillStyle = '#000';
        x.fillRect(r.left - n * 2, r.top - n * 2, r.width + n * 4, r.height + n * 4);
        return;
    }
    const body = el.closest('.pg-fx-body');
    const t = body ? getComputedStyle(body).transform : 'none';
    const m = t && t !== 'none' ? new DOMMatrix(t) : null;
    const rot = (m ? Math.atan2(m.b, m.a) : 0) + ((parseFloat(getComputedStyle(el).rotate) || 0) * Math.PI) / 180;
    const w = el.offsetWidth || r.width;
    const h = (w * el.naturalHeight) / el.naturalWidth;
    const cell = Math.max(1, Math.round(w / el.naturalWidth));
    const cx = r.left + r.width / 2;
    const bottom = r.top + r.height / 2 + h / 2;
    const left = el.classList.contains('pg-face-left');
    for (let dy = -n; dy <= n; dy++) {
        for (let dx = -n; dx <= n; dx++) {
            if (Math.abs(dx) + Math.abs(dy) <= n) {
                K.drawMon(x, el, cx + dx * cell, bottom + dy * cell, w, left, 1, '#000', rot);
            }
        }
    }
}
// ── 대상 다시 그리기 (#107 — 기획 10-25: 필살기가 맞는 포켓몬을 0.5초 넘게 덮지 않게 · 크기는 줄이지 않고 대상을 연출 맨 위에) ──
// 구간 = ULT_COVER (dev/ult-cover.py --data 가 860 × 187 에서 잰 가림 0.3초 넘는 구간 → make-moves) · 열쇠 = 틀 · 옵션 (색 · track 빼고) · o = 1:1 · j = 3:3 장면 전환 합동
// 맞는 모습 (디자인 10-25): 다시 그리기 시작에 흰 실루엣 0.06초 한 번 · 처음 0.6초만 0.12초마다 좌우 ±2px · 몸 바깥 1칸 밝은 테 (그 연출 cols[1]) + 그 바깥 1칸 #1a1626 ·
//   쓰러짐 (회색 주저앉기 · 벌러덩 — 1:1 은 넘어짐 기다림 --pg-ko-wait 이 끝날 때 · 3:3 pg-team-down) 이 시작하면 끝
// 구간 앞 · 뒤 여유 (ms — 패널 폭마다 덮는 때가 조금 다름) · 이만큼 안 떨어진 구간은 하나로 (테가 켜졌다 꺼졌다 하지 않게)
// 켜고 끄기 — false (태현 님 10-26 "맞는 포켓몬이 보이게는 없애는게 더 나은것 같아" · #115): 효과가 맞는 포켓몬을 덮는 건 예전처럼.
//   구간 데이터 (ult/ult-cover.json) · 재는 도구 (dev/ult-cover.py) · 그리는 코드는 남김 — true 로 다시 켬 (시험 창 cover=1 · window.__fxCoverRedraw)
//   쓰러진 뒤 자리 비우기 (fxCutDown) · 쓰는 쪽 HP 판 바둑판 반 · 하이퍼보이스 앞장 다시 그리기는 따로라 그대로
const FX_COVER_REDRAW = false;
const FX_COVER_PAD = [150, 250];
const FX_COVER_JOIN_MS = 600;
const FX_COVER_RIM = '#1a1626';
const FX_COVER_SHAKE = { px: 2, step: 0.12, sec: 0.6, white: 0.06 };
// 구간 끝 뒤 넘어짐을 기다리며 이어 그리는 최대 ms (넘어짐 기다림 0.62초 + 여유)
const FX_COVER_WAIT_MS = 1500;
function fxCoverSig(e) {
    const o = e[2] || {};
    return JSON.stringify([e[1], Object.keys(o).filter((k) => k !== 'c' && k !== 'track').sort().map((k) => [k, o[k]])]);
}
/** 다시 그릴 구간 [[본편 시작부터 ms, 끝 ms] …] — 앞뒤 여유를 붙이고 가까운 것은 하나로 */
function fxCoverSpans(e) {
    const t = typeof ULT_COVER !== 'undefined' ? ULT_COVER[fxCoverSig(e)] : null;
    const runs = (t && (e[2]?.track ? t.j : t.o)) || [];
    const out = [];
    for (const [a, n] of runs) {
        const s0 = Math.max(0, a - FX_COVER_PAD[0]);
        const s1 = a + n + FX_COVER_PAD[1];
        if (out.length && s0 <= out[out.length - 1][1] + FX_COVER_JOIN_MS) {
            out[out.length - 1][1] = Math.max(out[out.length - 1][1], s1);
        } else {
            out.push([s0, s1]);
        }
    }
    return out;
}
/** B (fxActor) 를 ms 동안 연출 맨 위에 맞는 모습으로 — 칸 상자에 __fxRedrawUntil 을 적음 (dev/ult-cover.py 가 그동안은 가림으로 안 셈) */
function fxCoverRedraw(gen, B, ms, color) {
    if (window.__fxNoCoverRedraw || !ULT_KIT.drawMon) {
        return;
    }
    const box = B.collision;
    const t0 = performance.now();
    let done = false;
    let x0 = null;
    fxOnTop((ctx) => {
        // 게임이 그림 (<img>) 을 새로 바꿔 넣으면 처음 el 은 문서에서 빠짐 — 칸 상자 안 img 를 다시 찾음
        const img = done ? null : B.el?.isConnected ? B.el : box?.isConnected ? box.querySelector('.pg-sprite') || box.querySelector('img') : null;
        if (!img?.naturalWidth) {
            return;
        }
        // 연출이 대상을 숨기고 꼭두각시로 그리는 동안은 안 그림 (뮤츠 사이코키네시스 — 둘로 보이던 것, 코드 리뷰어 #107)
        if (img.style.visibility === 'hidden' || img.style.opacity === '0') {
            return;
        }
        const now = performance.now();
        // 쓰러짐이 시작하면 끝 — 1:1 벌러덩은 넘어짐 기다림 (맞은 모습으로 섬) 이 끝날 때 (pg-ko 애니메이션 시간으로)
        const body = img.closest('.pg-fx-body');
        const fallen = !!body && (body.classList.contains('pg-fainted') || body.classList.contains('pg-down'));
        if (img.closest('.pg-team-down') || (fallen && fxKoStarted(body))) {
            done = true;
            return;
        }
        // 구간이 끝났어도 쓰러져 넘어짐을 기다리는 동안은 이어 그림 (구간 끝 → 넘어짐 사이 0.2초 동안 대상이 구덩이 밑에 사라지던 것 — 디자인 #107 UX 4바퀴 헤비봄버)
        if (now - t0 > ms && !fallen) {
            done = true;
            return;
        }
        const r = img.getBoundingClientRect();
        const w = img.offsetWidth || r.width;
        if (w < 2) {
            return;
        }
        box.__fxRedrawUntil = now + 120;
        const t = (now - t0) / 1000;
        const cell = Math.max(1, Math.round(w / img.naturalWidth));
        const dx = t < FX_COVER_SHAKE.sec ? (Math.floor(t / FX_COVER_SHAKE.step) % 2 ? 1 : -1) * FX_COVER_SHAKE.px : 0;
        // 흔들리는 0.6초는 처음 잰 자리 + dx (게임의 맞는 흔들림과 겹쳐 폭 6px 로 넓어지던 것 — 픽셀 검사원 #107 작음) · 그 뒤는 게임 자리를 따라감
        x0 ??= r.left + r.width / 2;
        const x = t < FX_COVER_SHAKE.sec ? x0 + dx : r.left + r.width / 2;
        // 가운데 기준 (기울어진 그림도 — 상자 가운데 = 그림 가운데) · 기울기는 그림의 rotate 그대로
        const bottom = r.top + r.height / 2 + (w * img.naturalHeight) / img.naturalWidth / 2;
        const rot = ((parseFloat(getComputedStyle(img).rotate) || 0) * Math.PI) / 180;
        const left = img.classList.contains('pg-face-left');
        const K = ULT_KIT;
        for (const [ox, oy] of [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            K.drawMon(ctx, img, x + ox * cell, bottom + oy * cell, w, left, 1, FX_COVER_RIM, rot);
        }
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            K.drawMon(ctx, img, x + ox * cell, bottom + oy * cell, w, left, 1, color, rot);
        }
        // 그림은 밝기 85% — 가장 밝은 빛줄기 위에서 원래 색 그대로라 스티커처럼 보이던 것 (#107 아트 작음 ①) · 번쩍 없이
        if (t >= FX_COVER_SHAKE.white) {
            ctx.filter = 'brightness(0.85)';
        }
        K.drawMon(ctx, img, x, bottom, w, left, 1, t < FX_COVER_SHAKE.white ? '#ffffff' : null, rot);
        ctx.filter = 'none';
    }, ms + FX_COVER_WAIT_MS, gen);
}
// 멈춘 번호 입자 · 발사기를 그 자리에 그리고 되돌림 (틱이 던져도)
function fxPutBack(held, heldE) {
    if (held) {
        for (const p of held) {
            try {
                drawParticle(moveCtx, p);
            } catch {
                // 그리기 오류 — 그 입자만
            }
        }
        moveParticles.push(...held);
        moveEmitters.push(...heldE);
        if (!moveRaf && (held.length || heldE.length)) {
            moveRaf = requestAnimationFrame(moveTick);
        }
    }
}
// 8판 1차 (아트 디렉터) — 점 = 포켓몬 점 1칸 (p = 배율 px) · 빛줄기 · 불 · 불씨. 기운 줄기 (fxFlow) 만 2칸 (몸에서 나온 덩어리)
const fxHashN = (i, k = 0) => (((i * 374761393) ^ (k * 668265263)) >>> 0) % 997;
// 블래스트번 (메가리자몽X) 파란 불 — 나선 · 기운 색 (디자인팀 정한 줄). 그 밖의 자기 둘레 필살기는 그 필살기 색 4단
const FX_SPIN_COLS = { 블래스트번: ['#ffffff', '#c4ecff', '#5cb8f6', '#2466d0'] };
// 바둑판 흐려짐 (디자인팀 8판 끝) — step 0 그대로 · 1 칸 절반 · 2 칸 4분의 1 · 3 없음. 따로 그린 캔버스에 2p × 2p 무늬를 destination-out 으로 덮어 지움
// (globalAlpha 로 흐리면 남색 바탕과 섞여 팔레트 밖 회색이 나옴 — 픽셀 검사원)
let fxDissolveCv = null;
const fxDissolvePat = new Map();
function fxDissolveDraw(ctx, p, step, draw) {
    if (step <= 0) {
        draw(ctx);
        return;
    }
    if (step >= 3) {
        return;
    }
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(window.innerWidth * dpr);
    const h = Math.round(window.innerHeight * dpr);
    fxDissolveCv ??= document.createElement('canvas');
    if (fxDissolveCv.width !== w || fxDissolveCv.height !== h) {
        fxDissolveCv.width = w;
        fxDissolveCv.height = h;
    }
    const oc = fxDissolveCv.getContext('2d');
    oc.setTransform(1, 0, 0, 1, 0, 0);
    oc.clearRect(0, 0, w, h);
    oc.setTransform(dpr, 0, 0, dpr, 0, 0);
    oc.globalAlpha = 1;
    oc.globalCompositeOperation = 'source-over';
    draw(oc);
    const key = `${p}:${step}`;
    if (!fxDissolvePat.has(key)) {
        const t = document.createElement('canvas');
        t.width = 2 * p;
        t.height = 2 * p;
        const tc = t.getContext('2d');
        tc.fillStyle = '#000';
        // 지울 칸 — 절반: 바둑판 두 칸 · 4분의 1: 왼쪽 위 한 칸만 남김
        tc.fillRect(p, 0, p, p);
        tc.fillRect(0, p, p, p);
        if (step === 2) {
            tc.fillRect(p, p, p, p);
        }
        fxDissolvePat.set(key, oc.createPattern(t, 'repeat'));
    }
    oc.globalCompositeOperation = 'destination-out';
    oc.fillStyle = fxDissolvePat.get(key);
    oc.fillRect(0, 0, window.innerWidth, window.innerHeight);
    oc.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(fxDissolveCv, 0, 0);
    ctx.restore();
}
// 커지는 빛 모으기 (8판 끝) — 쏘는 쪽 원래 모으기 빛 자리 (입 − 8칸 · 빔 축 − 1칸) · 모으기 시간을 여섯으로 나눠 한 칸씩 (반지름 3 → 8칸) ·
// 빔이 나갈 때 8 → 7 → 6칸 (50ms 두 걸음) · 빔이 나가는 동안 6칸으로 남아 빔 뿌리를 덮음 · 흰 심 2칸 + [0] · [1] ·
// 빛살 4개 (1칸 — 모으는 동안 200ms 마다 길이 3 ↔ 5칸, 빔이 나간 뒤 4칸으로 멈춤, 끝 칸 [1]) · 닿은 뒤 빔 · 나선과 같이 바둑판으로 흐려짐 (v = 그 빔 보기)
function fxGrowOrb(M, cols, p, growSec, v) {
    sigParticle({ x: 0, y: 0, s: 1, max: growSec + (FX_SPIRAL_RUN_MS + FX_JOINT_DISSOLVE_MS + 3 * FX_JOINT_STEP_MS) / 1000 + 0.2, draw: (ctx, q) => {
        const now = performance.now();
        const out = v && now >= v.bigAt;
        if (v && now >= v.hitAt + FX_JOINT_DISSOLVE_MS + 3 * FX_JOINT_STEP_MS) {
            q.life = q.max;
            return;
        }
        const after = out ? now - v.bigAt : 0;
        const R = !out ? Math.min(8, 3 + Math.floor((q.life * 6) / Math.max(0.01, growSec))) : after < 50 ? 8 : after < 100 ? 7 : 6;
        const L = R + (out ? 4 : Math.floor((q.life * 1000) / 200) % 2 ? 5 : 3);
        const step = v && now >= v.hitAt + FX_JOINT_DISSOLVE_MS ? 1 + Math.floor((now - v.hitAt - FX_JOINT_DISSOLVE_MS) / FX_JOINT_STEP_MS) : 0;
        fxDissolveDraw(ctx, p, step, (c) => {
            for (let j = -R; j <= R; j++) {
                for (let i = -R; i <= R; i++) {
                    const d2 = i * i + j * j;
                    if (d2 <= R * R) {
                        fxDot(c, M.x + i * p, M.y + j * p, p, d2 <= 4 ? '#ffffff' : d2 <= (R * 0.65) ** 2 ? cols[0] : cols[1]);
                    }
                }
            }
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                for (let k = R + 1; k <= L; k++) {
                    fxDot(c, M.x + dx * k * p, M.y + dy * k * p, p, k < L ? '#ffffff' : cols[1]);
                }
            }
        });
    } });
}
// 빔 굵게 (×1.5) — 원래 줄기 위아래 한쪽마다 1칸 줄 셋 (끝 1칸을 덮는 옅은 [1] · 옅은 [1] · 본색 [2]) + 바깥 들쭉날쭉 1칸 (열의 반, 해시) ·
// 흰 줄무늬 3칸이 9칸마다 (해시로 셋 중 하나 빔) 50ms 마다 2칸 앞으로 · core = 닿은 뒤 흐려지는 동안 심을 [0] 로 채움
function fxBeamThicken(ctx, v, front, cols, t, core) {
    const p = v.p;
    const ph = Math.floor((t * 1000) / 50) * 2;
    // 빔은 구슬 자리 (입 − 8칸) 부터 — 빔이 구슬에서 나옴
    const from = Math.round((v.orbX ?? v.x0) / p) * p;
    for (let x = from, n = 0; v.dir > 0 ? x <= front : x >= front; x += v.dir * p, n++) {
        const yc = v.y0 + fxStairDy(v, x);
        const yTop = Math.round((yc - v.half) / p) * p;
        const yBot = Math.round((yc + v.half) / p) * p;
        const k = n - ph;
        const seg = Math.floor(k / 9);
        const streak = ((k % 9) + 9) % 9 < 3 && fxHashN(((seg % 97) + 97) % 97, 3) % 3 !== 0;
        if (core) {
            ctx.fillStyle = streak ? '#ffffff' : cols[0];
            ctx.fillRect(x, yTop, p, yBot - yTop);
        }
        for (const s of [-1, 1]) {
            const edge = s < 0 ? yTop : yBot - p;
            ctx.fillStyle = streak ? '#ffffff' : cols[1];
            ctx.fillRect(x, edge, p, p);
            ctx.fillStyle = cols[1];
            ctx.fillRect(x, edge + s * p, p, p);
            ctx.fillStyle = cols[2];
            ctx.fillRect(x, edge + s * 2 * p, p, p);
            if (fxHashN(n, s + 5) % 2) {
                ctx.fillRect(x, edge + s * 3 * p, p, p);
            }
        }
    }
}
// 불 머리 (아트 2차) — 1칸 원 반지름 9칸 (안 40% 흰 · 70% [1] · 그 밖 [2]) + 둘레 2칸 바둑판 [2] (반투명 둘레 대신 — 돔 가장자리 문법)
function fxFireHead(ctx, x, y, cols, p) {
    const R = 9;
    for (let j = -R - 2; j <= R + 2; j++) {
        for (let i = -R - 2; i <= R + 2; i++) {
            const d2 = i * i + j * j;
            if (d2 <= R * R) {
                fxDot(ctx, x + i * p, y + j * p, p, d2 <= (R * 0.4) ** 2 ? '#ffffff' : d2 <= (R * 0.7) ** 2 ? cols[1] : cols[2]);
            } else if (d2 <= (R + 2) ** 2 && (i + j) & 1) {
                fxDot(ctx, x + i * p, y + j * p, p, cols[2]);
            }
        }
    }
}
// 기운 나선 (아트 2차) — 한 가닥 · 40칸 주기 · ±13칸 · 위상 50ms 마다 2칸 · 앞 마디 (cos>0) 굵기 3 → 5칸 (뿌리 → 머리) + 들쭉날쭉 0 ~ 1칸 ·
// 빔 쪽 끝 흰 1칸은 위 반 (sin<0) 만 · [1] → [2] → 바깥 [3] · 혀는 위 반만 3열마다 2 ~ 4칸을 뒤 (−x) 와 위로 (아래로 늘어져 고드름처럼 보이던 것) ·
// 뒤 마디 = 2칸 [3] (빔 반 높이 안은 가려져 안 그림) · 머리 뒤 불씨 1칸 · 앞끝에 불 머리
function fxFireSpiral(ctx, v, from, front, cols, t) {
    const p = v.p;
    const ph = Math.floor((t * 1000) / 50) * 2;
    const amp = 13;
    const per = 40;
    const x0 = Math.round(from / p) * p;
    const len = Math.max(1, Math.abs(front - x0) / p);
    let prev = null;
    for (let x = x0, n = 0; v.dir > 0 ? x <= front : x >= front; x += v.dir * p, n++) {
        const i = n - ph;
        const a = (i * Math.PI * 2) / per;
        const sn = Math.sin(a);
        const yc = Math.round((v.y0 + fxStairDy(v, x)) / p) * p;
        const yy = yc + Math.round(sn * amp) * p;
        const top = prev === null ? yy : Math.min(prev, yy);
        const bot = prev === null ? yy : Math.max(prev, yy);
        prev = yy;
        if (Math.cos(a) <= 0) {
            if (Math.abs(yy - yc) >= v.half) {
                ctx.fillStyle = cols[3];
                ctx.fillRect(x, top, p, bot - top + 2 * p);
            }
            continue;
        }
        const upper = sn < 0;
        const out = upper ? -1 : 1;
        const w = 3 + Math.round((n / len) * 2) + (fxHashN(((i % 97) + 97) % 97, 7) % 2);
        for (let q = 0; q < w; q++) {
            ctx.fillStyle = q === 0 ? (upper ? '#ffffff' : cols[1]) : q === 1 ? cols[1] : q < w - 1 ? cols[2] : cols[3];
            ctx.fillRect(x, top + out * (q - 1) * p, p, bot - top + p);
        }
        if (upper && ((i % 3) + 3) % 3 === 0) {
            const L = 2 + (fxHashN(((i % 89) + 89) % 89, 9) % 3);
            for (let q = 1; q <= L; q++) {
                fxDot(ctx, x - v.dir * q * p, yy - (w + q - 1) * p, p, q < L ? cols[2] : cols[3]);
            }
        }
    }
    const fy = Math.round((v.y0 + fxStairDy(v, front)) / p) * p;
    for (let q = 2; q <= 40; q += 3) {
        const ex = front - v.dir * q * p;
        const h = (fxHashN(q, 11) % 19) - 9;
        if ((ex - x0) * v.dir > 0) {
            fxDot(ctx, ex, fy + h * p * 2, p, q < 16 ? cols[1] : cols[2]);
        }
    }
    fxFireHead(ctx, front, fy, cols, p);
}
// 빔 둘레 반짝 — 1칸 "+" 8개가 빔 축 ±(19 ~ 23)칸 · 해시 자리 · 150ms 마다 자리 바뀜 (밝기 같음) · 가운데 흰 · 팔 [1]
function fxBeamSparks(ctx, v, from, front, cols, t) {
    const p = v.p;
    const k = Math.floor((t * 1000) / 150);
    for (let s = 0; s < 8; s++) {
        const hx = fxHashN(s + k * 13, 21) / 997;
        const sx = Math.round((from + (front - from) * hx) / p) * p;
        if ((sx - front) * v.dir >= 0) {
            continue;
        }
        const sy = v.y0 + fxStairDy(v, sx) + (fxHashN(s + k * 7, 23) % 2 ? -1 : 1) * (19 + (fxHashN(s, 29) % 5)) * p;
        [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([i, j]) => fxDot(ctx, sx + i * p, sy + j * p, p, i || j ? cols[1] : '#ffffff'));
    }
}
// 나선 그림 — 대폭발 크게부터 빔 앞끝까지 굵은 띠 + 기운 나선 (주 줄기 보기 v 를 따라 계단) · 닿은 뒤 150ms 3걸음에 흐려짐 (심을 [0] 로 채움)
function fxSpiralRun(v, beamCols, spinCols) {
    const sec = (FX_SPIRAL_RUN_MS + FX_JOINT_DISSOLVE_MS + 3 * FX_JOINT_STEP_MS) / 1000;
    sigParticle({ x: 0, y: 0, s: 1, max: sec, draw: (ctx, q) => {
        // 앞끝 — 입에서 상대 가슴까지 (늘 그 사이 — 타이머가 늦어도 끝없는 줄이 되지 않게)
        const t = performance.now();
        const k = Math.max(0, Math.min(1, (t - v.bigAt) / Math.max(1, v.hitAt - v.bigAt)));
        const front = v.x0 + (v.tx - v.x0) * k;
        const after = t >= v.hitAt;
        // 팔 · 합친 줄기와 같은 때 같은 걸음 (맞음 +300 · 150ms — 둘째 바퀴 ⑥)
        const step = t >= v.hitAt + FX_JOINT_DISSOLVE_MS ? 1 + Math.floor((t - v.hitAt - FX_JOINT_DISSOLVE_MS) / FX_JOINT_STEP_MS) : 0;
        fxDissolveDraw(ctx, v.p, step, (c) => {
            c.globalAlpha = 1;
            fxBeamThicken(c, v, front, beamCols, q.life, true);
            if (!after) {
                fxBeamSparks(c, v, v.orbX, front, beamCols, q.life);
            }
            fxFireSpiral(c, v, v.x0 + v.dir * 4, front, spinCols, q.life);
        });
    } });
}
// 합친 줄기 (Y 자 — 아트 디렉터 #80 ② [제안]) — M 에서 상대까지 앞끝이 mAt → hitAt 에 감 · 반 굵기 = 빔 반 높이 × 1.3 칸 · 위 반 A 색 · 아래 반 B 색 ·
// 흰 심 3칸 · 12칸마다 위아래가 바뀌는 꼬임 (50ms 마다 2칸 앞으로) · M 에 1칸 흰 고리 (반지름 6 → 10칸, 50ms 두 걸음) · 닿은 뒤 번쩍 80ms 뒤 150ms 3걸음 바둑판
function fxMergeRun(M, B, ca, cb, p, half, mAt, hitAt) {
    // 반 굵기 = 굵게 한 빔 (×1.5 — fxBeamThicken) 반 높이 + 3칸 (합치면 가늘어져 보이던 것 — 아트 디렉터 #80 셋째 ①) · 빔 문법 (흰 심 → 옅은 → 본색 → 짙은 테 · 들쭉날쭉 바깥 칸)
    // (패널 22% 로 키웠던 것은 평평한 깃발 네모 — 디자인 캡처)
    const H = Math.max(4, Math.round((half * 1.5) / p) + 3);
    const sec = Math.max(0.3, (hitAt - performance.now() + FX_JOINT_DISSOLVE_MS + 3 * FX_JOINT_STEP_MS) / 1000 + 0.1);
    sigParticle({ x: 0, y: 0, s: 1, max: sec, draw: (ctx) => {
        const t = performance.now();
        if (t < mAt) {
            return;
        }
        // 앞끝 = 그때 상대 가운데 (처음 잰 자리에서 멈춰 상대 앞 약 45px 비던 것 — 셋째 ②)
        const T = fxBody(B);
        const len = Math.hypot(T.x - M.x, T.y - M.y);
        const ux = (T.x - M.x) / Math.max(1, len);
        const uy = (T.y - M.y) / Math.max(1, len);
        const k = Math.min(1, (t - mAt) / Math.max(1, hitAt - mAt));
        // Y 전체가 한 모양으로 같이 사라짐 — 팔 (줄기 보기) 과 같은 때 · 걸음 (맞음 +300 · 150ms — 합친 줄기만 먼저 지워져 팔이 잘린 채 떠 있던 것, 둘째 바퀴 ⑥)
        const step = t >= hitAt + FX_JOINT_DISSOLVE_MS ? 1 + Math.floor((t - hitAt - FX_JOINT_DISSOLVE_MS) / FX_JOINT_STEP_MS) : 0;
        fxDissolveDraw(ctx, p, step, (c) => {
            c.globalAlpha = 1;
            const n = Math.floor((len * k) / p);
            const ph = Math.floor(t / 50) * 2;
            for (let i = 0; i <= n; i++) {
                const bx = M.x + ux * i * p;
                const by = M.y + uy * i * p;
                // 꼰 밧줄 — 위 반 A · 아래 반 B, 두 색 경계가 24칸 주기로 ±2칸 비스듬히 (12칸마다 딱 바뀌어 블록 같던 것 — 둘째 바퀴 ③ [제안])
                const edge = Math.round(2 * Math.sin(((i + ph) / 24) * Math.PI * 2));
                for (let j = -H; j <= H; j++) {
                    const a = Math.abs(j);
                    // 바깥 한 칸은 들쭉날쭉 (열의 반)
                    if (a === H && fxHashN(i + ph, j > 0 ? 5 : 6) % 2) {
                        continue;
                    }
                    const P = j < edge ? ca : cb;
                    fxDot(c, bx - uy * j * p, by + ux * j * p, p, a <= 1 ? '#ffffff' : a <= H * 0.45 ? P[1] : a <= H * 0.8 ? P[2] : P[3]);
                }
            }
            // M 매듭 — 꽉 찬 빛 (반지름 6칸: 흰 3칸 + 금 2칸 + 남색 1칸 테) · 합칠 때부터 내내 · 맨 나중에 (고리가 반만 보여 괄호 같던 것 — 셋째 ①)
            for (let j = -6; j <= 6; j++) {
                for (let i = -6; i <= 6; i++) {
                    const d = Math.hypot(i, j);
                    if (d <= 6.4) {
                        fxDot(c, M.x + i * p, M.y + j * p, p, d <= 3.4 ? '#ffffff' : d <= 5.4 ? '#ffd76a' : '#0c101e');
                    }
                }
            }
        });
    } });
}
// 섞인 큰 폭발 (8판 1차) — 1칸 격자 · 가운데 45% 를 비운 고리 (꽃이 안에 보이게) · 반지름 [5 9 13 16 18 19] × 참가 수 × 0.5 칸 · 6걸음 × 200ms (#80 UX — 1초 넘게) ·
// 고리 8조각 (45°) 두 색 번갈아 · 안쪽 20% 흰 (3걸음 전) · 50% [1] · 85% [2] · 끝 [3] · 조각마다 혀 (길이 4 + 2 × 걸음, 굵기 3 → 2 → 1, 걸음마다 +10° 휨) ·
// 쏘는 쪽 색 잎 6장 (1-2-2-1 + 잎맥, 해시 각도 · 반지름 R + 3 + 3 × 걸음, 돌린 모양 4) · 4걸음째부터 고리가 호 6조각 (40° 칠 · 20° 빔) · 3걸음째부터 바깥 호
function fxMixBurst8(x0, y0, ca, cb, p, n) {
    // 가운데를 패널 안으로 — 오른쪽 끝 상대면 고리 40% 가 밖으로 잘리던 것 (480 — #80 UX U4) · 바깥 호 (R × 1.4 + 걸음 × 2) 까지
    const W = window.innerWidth;
    const ext = (Math.round(19 * n * 0.5) * 1.4 + 12) * p;
    const x = Math.round((W > 2 * ext ? Math.min(W - ext, Math.max(ext, x0)) : x0) / p) * p;
    const y = Math.round(y0 / p) * p;
    const LEAF = [[0, 1, 1, 0], [1, 1, 1, 1], [1, 1, 1, 1], [0, 1, 1, 0]];
    // 6걸음 × 200ms (150 이면 보이는 시간이 0.97 ~ 1.1초로 1초 기준에 빠듯 — #80 UX U1) — 엔진이 다시 달리기 (+1.55초) 전에 끝
    sigParticle({ x, y, s: 1, max: 1.2, draw: (ctx, q) => {
        const k = Math.min(5, Math.floor((q.life * 1000) / 200));
        const R = Math.round([5, 9, 13, 16, 18, 19][k] * n * 0.5);
        // 걸음마다 안에서부터 얇아지며 흩어짐 (R 이 거의 안 변해 큰 도넛이 0.6초 멈춰 있던 것 — 아트 디렉터 #80 둘째 바퀴 ④) · 5걸음째는 바깥 테 + 혀 + 잎
        const inner = R * [0.45, 0.45, 0.55, 0.7, 0.82, 0.92][k];
        ctx.globalAlpha = 1;
        // 가로 타원 (가로 × 1.6 — 솔라빔 꽃 폭에 맞게, 아트 2차) · 색은 동심원 (바깥 띠 = ca · 안 띠 = cb — 45° 부채꼴로 번갈아 비치볼 · 구명 튜브 같던 것) ·
        // 바깥 가장자리는 15° 칸마다 −2 ~ +2칸 들쭉날쭉 (규칙적인 부채꼴 · 끊긴 호 대신 — 골든 선 불길)
        for (let j = -R - 2; j <= R + 2; j++) {
            for (let i = -Math.ceil((R + 2) * 1.6); i <= Math.ceil((R + 2) * 1.6); i++) {
                const d = Math.hypot(i / 1.6, j);
                const ang = (Math.atan2(j, i) * 180) / Math.PI + 180;
                const Rj = R + ((fxHashN(Math.floor(ang / 15), k) % 5) - 2);
                if (d > Rj || d < inner) {
                    continue;
                }
                const rr = (d - inner) / Math.max(1, Rj - inner);
                ctx.fillStyle = rr < 0.2 && k < 1 ? '#ffffff' : rr < 0.55 ? (rr < 0.35 ? cb[1] : cb[2]) : rr < 0.7 ? ca[1] : rr < 0.85 ? ca[2] : ca[3];
                ctx.fillRect(x + i * p, y + j * p, p, p);
            }
        }
        if (k < 5) {
            for (let s = 0; s < 8; s++) {
                const P = s % 2 ? cb : ca;
                let a = (s / 8) * Math.PI * 2 + 0.2;
                let px = x + Math.cos(a) * R * 1.6 * p;
                let py = y + Math.sin(a) * R * p;
                const L = 4 + k * 2;
                for (let t = 0; t < L; t++) {
                    const w = t < L / 3 ? 3 : t < (2 * L) / 3 ? 2 : 1;
                    for (let m = 0; m < w; m++) {
                        fxDot(ctx, px + Math.cos(a + Math.PI / 2) * m * p, py + Math.sin(a + Math.PI / 2) * m * p, p, t < L - 1 ? P[w === 3 ? 1 : 2] : P[3]);
                    }
                    px += Math.cos(a) * p;
                    py += Math.sin(a) * p;
                    a += (10 * Math.PI) / 180;
                }
            }
        }
        for (let l = 0; l < 6; l++) {
            const a = ((fxHashN(l, 13) % 360) * Math.PI) / 180;
            const d = R + 3 + k * 3 + (fxHashN(l, 17) % 4);
            const lx = Math.round((x + Math.cos(a) * d * p) / p) * p;
            const ly = Math.round((y + Math.sin(a) * d * p * 0.8) / p) * p;
            const rot = (fxHashN(l, 19) + k) % 4;
            for (let r = 0; r < 4; r++) {
                for (let c = 0; c < 4; c++) {
                    if (!LEAF[r][c]) {
                        continue;
                    }
                    const [ix, iy] = rot === 0 ? [c, r] : rot === 1 ? [3 - r, c] : rot === 2 ? [3 - c, 3 - r] : [r, 3 - c];
                    ctx.fillStyle = r === c || r === 3 - c ? cb[1] : cb[k < 4 ? 2 : 3];
                    ctx.fillRect(lx + ix * p, ly + iy * p, p, p);
                }
            }
        }
        if (k >= 2) {
            const rr = Math.round(R * 1.4 + k * 2);
            for (let a = 0; a < 72; a++) {
                const deg = a * 5;
                // 끊긴 곳은 해시 (규칙적인 점선 고리가 로딩 표시처럼 읽히던 것 — 둘째 바퀴 ④)
                if (fxHashN(a, k + 31) % 3 === 0) {
                    continue;
                }
                const an = (deg * Math.PI) / 180;
                // 바깥 고리 = 금 하나 (합동 표지색 — 컷인 뒤 빛줄과 이어짐 · 같은 파랑끼리 짝도 갈림, 아트 디렉터 #80 ③ [제안] — design-system --pg-sos-gold)
                fxDot(ctx, x + Math.cos(an) * rr * p, y + Math.sin(an) * rr * p * 0.6, p, '#ffd76a');
            }
        }
    } });
}

// 합동 마무리 (2026-10-21 태현 님 #89 A "폭발의 기운은 제자리에서 터트려서 솔라빔으로") — 각자 필살기가 제자리에서 다 나간 뒤
//   ① 자기 둘레 터짐의 기운이 합류점으로 흘러감 (0.45초) ② 합류점에서 두 색이 꼬인 굵은 줄기 (쏘는 필살기가 있을 때) · 큰 구슬 (없을 때) 이 상대로 (0.3초)
//   ③ 닿는 순간 섞인 큰 합체 폭발 (혼자보다 한 단계 큼) + 피해 (onHit). 합류점 = 쏘는 + 자기 둘레: 쏘는 줄기 위 55% · 쏘는 + 쏘는: 상대 앞 80% · 자기 둘레끼리: 둘 가운데
const FX_JOINT_FLOW_MS = 450;
const FX_JOINT_GO_MS = 300;
function fxJointFinish(parts, B, sure, others) {
    const r = B.collision.getBoundingClientRect();
    const S = Math.max(1, Math.round(r.width / (B._originalSpriteSize || 32)));
    const u = 2 * S;
    const snap = (v) => Math.round(v / u) * u;
    const tx = r.left + r.width / 2;
    const ty = r.top + r.height * 0.5;
    const center = (A) => {
        const a = A.collision.getBoundingClientRect();
        return { x: a.left + a.width / 2, y: a.top + a.height * 0.5, w: a.width, h: a.height };
    };
    const mouthOf = (A) => {
        const c = center(A);
        return { x: c.x + Math.sign(tx - c.x) * c.w * 0.4, y: c.y - c.h * 0.1 };
    };
    const shooters = parts.filter((p) => !p.self);
    const selfs = parts.filter((p) => p.self);
    const lerp = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
    const T = { x: tx, y: ty };
    let M;
    if (shooters.length && selfs.length) {
        M = lerp(mouthOf(shooters[0].A), T, 0.55);
    } else if (shooters.length) {
        M = lerp(mouthOf(shooters[0].A), T, 0.8);
    } else {
        const cs = selfs.map((p) => center(p.A));
        M = { x: cs.reduce((a, c) => a + c.x, 0) / cs.length, y: cs.reduce((a, c) => a + c.y, 0) / cs.length - 2 * u };
    }
    const shade = (pal) => [pal[3] ?? pal[pal.length - 1], pal[2] ?? pal[1] ?? pal[0], pal[1] ?? pal[0]];
    // 색 = 그 필살기 연출 색 (블래스트번 = 메가리자몽X 파랑 — 타입 색 (불 = 주황) 이 나오던 것, 아트 디렉터 #80 ④) · 연출 색이 없을 때만 타입 색
    const colOf = (p) => FX_SPIN_COLS[p.e[0]] ?? p.cols ?? sigPal(p.type);
    const pals = parts.map((p) => shade(colOf(p)));
    const flow = selfs.length ? FX_JOINT_FLOW_MS / 1000 : 0;
    const go = FX_JOINT_GO_MS / 1000;
    const orb = !shooters.length;
    const cell = (ctx, x, y, col) => {
        ctx.fillStyle = col;
        ctx.fillRect(snap(x), snap(y), u, u);
    };
    let hit = false;
    sigParticle({ x: 0, y: 0, s: 1, max: flow + go + 0.35, draw: (ctx, q) => {
        const t = q.life;
        ctx.globalAlpha = t > flow + go ? Math.max(0, 1 - (t - flow - go) / 0.35) : 1;
        // ① 기운이 합류점으로 — 머리 + 10칸 꼬리 (그 필살기 색)
        selfs.forEach((p) => {
            const c = center(p.A);
            const pal = shade(colOf(p));
            const k = Math.min(1, t / Math.max(0.01, flow));
            const len = Math.hypot(M.x - c.x, M.y - c.y);
            for (let i = 0; i < 10; i++) {
                const kk = Math.max(0, k - (i * u) / Math.max(1, len));
                const pt = lerp(c, M, kk);
                cell(ctx, pt.x, pt.y, pal[i < 2 ? 2 : i < 6 ? 1 : 0]);
                if (i < 3) {
                    cell(ctx, pt.x, pt.y - u, pal[2]);
                    cell(ctx, pt.x, pt.y + u, pal[1]);
                }
            }
        });
        if (t < flow) {
            return;
        }
        // ② 합류점에서 상대로 — 꼬인 줄기 (두 가닥 12칸 주기 · ±2칸 · 엇갈리는 곳 짙은 틈) · 큰 구슬
        const k = Math.min(1, (t - flow) / go);
        const len = Math.hypot(T.x - M.x, T.y - M.y);
        const ux = (T.x - M.x) / Math.max(1, len);
        const uy = (T.y - M.y) / Math.max(1, len);
        if (orb) {
            const c = lerp(M, T, k);
            const R = 5 + parts.length;
            for (let j = -R; j <= R; j++) {
                for (let i = -R; i <= R; i++) {
                    const d2 = i * i + j * j;
                    if (d2 > R * R) {
                        continue;
                    }
                    // 동심원 — 바깥 1.5칸 A 짙은 · 본색 · 그 안 2칸 B 본색 · 옅은 · 가운데 40% 흰 (칸마다 섞으면 멀리서 탁한 올리브 — 아트 디렉터 #80 ④)
                    const d = Math.sqrt(d2);
                    const A = pals[0];
                    const Bp = pals[1 % pals.length];
                    cell(ctx, c.x + i * u, c.y + j * u, d < R * 0.4 ? '#ffffff' : d > R - 0.75 ? A[0] : d > R - 1.5 ? A[1] : d > R - 3.5 ? Bp[1] : Bp[2]);
                }
            }
        } else {
            const n = Math.floor((len * k) / u);
            const ph = Math.floor(t * 12.5);
            for (let i = 0; i <= n; i++) {
                const bx = M.x + ux * i * u;
                const by = M.y + uy * i * u;
                const off = Math.round(Math.sin(((i + ph) / 12) * Math.PI * 2) * 2);
                const cross = Math.abs(off) < 1;
                // 굵기 = 흰 심 1 + 가닥 둘 (2칸씩)
                cell(ctx, bx, by, cross ? pals[0][0] : '#ffffff');
                [off, -off].forEach((o, si) => {
                    const pal = pals[si % pals.length];
                    for (let w = 0; w < 2; w++) {
                        cell(ctx, bx - uy * (o + (o >= 0 ? w + 1 : -w - 1)) * u, by + ux * (o + (o >= 0 ? w + 1 : -w - 1)) * u, cross ? pal[0] : pal[w ? 1 : 2]);
                    }
                });
            }
        }
        // ③ 닿음 — 섞인 큰 폭발 (혼자보다 한 단계 큼 — 디자인팀 7판 값) · 피해는 ultJoint 타이머 (그리기가 멈춰도 들어가게 — 코드 리뷰어)
        if (!hit && k >= 1) {
            hit = true;
            try {
                fxMixBurst8(tx, ty, fxCols4(colOf(parts[0])), fxCols4(colOf(parts[1] ?? parts[0])), u / 2, Math.max(2, parts.length) + 1);
                screenFlash(S, 0.55, '#ffffff', 0.08);
                others.forEach((spec, i) => setTimeout(() => {
                    const o = (spec.box || spec.el).getBoundingClientRect();
                    if (o.width >= 1) {
                        typeImpact(o.left + o.width / 2, o.top + o.height * 0.55, S, parts[i % parts.length].type, 0.5, false, o.left > r.left ? 1 : -1, o.width, { scale: 0.9 });
                    }
                }, 150 + i * 60));
            } catch (err) {
                ultError('joint finish', err);
            }
        }
    } });
    return Math.round((flow + go) * 1000);
}
// 개발 창 — 필살기 박자 · 터지는 자리 재기 (dev/ult-fx.py): 지금 입자들의 가운데 · 개수
window.__fxDebug = {
    centroid: () => {
        let x = 0;
        let y = 0;
        let n = 0;
        for (const q of moveParticles) {
            if (typeof q.x === 'number' && q.x > 0 && q.x < window.innerWidth) {
                x += q.x;
                y += q.y;
                n += 1;
            }
        }
        return n ? { x: x / n, y: y / n, n } : null;
    },
    // 그 칸 안의 입자 수 (어두워짐 · 번쩍 판 빼고) — 상대를 덮는 연출이 끝나는 때 (cover) 재기
    near: (x0, y0, x1, y1) => {
        let n = 0;
        for (const q of moveParticles) {
            if (!q._full && !q._flash && typeof q.x === 'number' && q.x >= x0 && q.x <= x1 && q.y >= y0 && q.y <= y1) {
                n += 1;
            }
        }
        return n;
    },
    // 번쩍 판 (화면 전체 흰색) 이 떠 있는지 — 덮음 재기에서 그 순간은 뺌 (캔버스 점 수로 재서)
    flashing: () => moveParticles.some((q) => q._flash),
    // 쓰러진 칸 지우기 — 이번 장에 적은 포켓몬 그림 수 · 화면 전체 판 수 (#107 확인)
    cut: () => ({ frame: fxFrameId, mon: fxMonDrawsAt === fxFrameId ? fxMonDraws.length : -1, screens: moveParticles.filter(fxScreenLayer).length }),
};

window.pokemonFx = {
    version: 4,
    /** 그 모습이 가진 필살기 이름 (게임 개발 모드 (임시) — 필살기 고르기) */
    ults(form) {
        return (POKEMON_ULT[form] || []).map((k) => ULT_LIB[k]).filter(Boolean).map((v) => v[0]);
    },
    /** 그 기술의 연출 — { fx: 틀 이름, ms: 걸리는 시간, contact: 몸으로 닿는지 } · 없으면 null (게임은 그 기술을 예전 모양으로) */
    plan(form, m) {
        const p = fxPlan(form, m);
        return p && { fx: p.sig[1], ms: p.ms, contact: FX_CONTACT.has(p.sig[1]) };
    },
    /** 기술을 지금 씀 — 쏘는 기술은 입에서 · 닿는 기술은 몸 앞에서 (box 를 달려든 몸으로 주면 상대 바로 앞). 그린 시간 (ms), 못 그리면 0.
     *  reach = 입에서 상대까지 px — 뿜기 (breath: 불꽃세례 · 화염방사 · 독가스 …) 는 일반 모드에선 입 앞에서만 피어서, 전투에선 상대까지 닿게 빠르기를 키움
     *  form = 기술 모양을 고를 포켓몬 (닿는 기술 자국을 맞는 쪽에 그릴 때 쓰는 쪽 모양 그대로 — 없으면 src)
     *  dst = 맞는 포켓몬 — 주면 틀마다 상대까지 닿게 (fxAim: 자리 옮김 · 빠르기 · 광선 길이), 안 주면 reach 로 뿜기만 */
    move(src, m, reach, form, dst, tag) {
        const p = fxPlan(form || src.form, m);
        if (!p || fxWidth(src) < 1) {
            return 0;
        }
        // 3:3 — tag 가 있으면 이 기술만의 번호 (stopMove 로 이것만 멈춤 · clear 는 다 멈춤)
        let gen = fxMoveGen;
        if (tag !== undefined) {
            gen = ++fxGen;
            fxTagged.add(gen);
            fxMoveTagged.add(gen);
            fxTagGen.set(tag, gen);
            // 오래된 번호는 버림 (다 끝난 기술 — 판이 길어도 쌓이지 않게)
            if (fxTagGen.size > 96) {
                const [oldTag, oldGen] = fxTagGen.entries().next().value;
                fxTagGen.delete(oldTag);
                fxTagged.delete(oldGen);
                fxMoveTagged.delete(oldGen);
            }
        }
        if (p.sig[1] === 'dash') {
            // 몸통박치기 — 몸이 달려드는 것이 연출 (게임 pg-lunge), 닿을 때 (src = 맞는 쪽) 몸을 꿰뚫는 바람줄 + impact
            safeFx({}, () => fxWithTimers(gen, () => {
                const g = sigGeometry(fxActor(src), !!src.left);
                // 노말은 임팩트 색 (흰 덩이 먼지가 되지 않게 — ult/fx-hit.js HIT_COLS)
                hitRush(g.body.front, g.body.cy, g.s, g.dir, g.body.ry, p.o.c === 'normal' || !p.o.c ? HIT_COLS.normal : sigPal(p.o.c));
            }));
            return p.ms;
        }
        const A = fxActor(src);
        const ok = safeFx({}, () => fxWithTimers(gen, () => {
            const g0 = sigGeometry(A, !!src.left);
            // 닿는 기술 (할퀴기 · 주먹) 은 게임에서 늘 맞는 쪽에 그림 → 자국을 몸 위에 (일반 모드는 쓰는 쪽 몸 앞)
            // 색도 타입 임팩트 색 (순백 대신 색이 든 흰색 — 뒤따르는 임팩트와 같은 흰색, 아트 디렉터 2바퀴)
            let aim = { g: g0, o: FX_CONTACT.has(p.sig[1]) ? { ...p.o, onTarget: true, c: hitColsOfPal(p.o.c ?? 'normal') } : p.o };
            if (dst && fxWidth(dst) >= 1) {
                const tg = fxTarget(g0, dst);
                aim = fxAim(p.sig[1], g0, p.o, tg, p.ms);
                // 3:3 — 다른 줄 상대 (1:1 은 같은 땅이라 그대로)
                if (fxTeamOn()) {
                    aim = fxAimRow(p.sig[1], aim, g0, tg);
                } else if (p.sig[1] === 'breath') {
                    // 1:1 뿜기도 입이 상대 몸 위쪽 30% 보다 높으면 (큰 포켓몬) 몸 가운데 조금 아래로 기울임 — 머리 위로 지나가 맞는 때에 몸에 안 닿던 것 (롱스톤 · 망나뇽 · 라프라스 · 리자몽, #122 2단계 UX 5바퀴)
                    // 칸 (64px) 이 아니라 보이는 몸 모양으로 셈 — 칸 55% · 칸 높이 15% 문턱은 큰 포켓몬 입 높이 차 (4 ~ 6px) 로 한 번도 안 켜졌음 (UX 6바퀴)
                    const sb = fxShapeBox(dst);
                    const bh = sb ? sb.bottom - sb.top : 0;
                    if (sb && g0.mouth.y < sb.top + BREATH_TILT_ABOVE * bh) {
                        aim = fxAimRow('breath', aim, g0, { ...tg, cy: (sb.top + sb.bottom) / 2 + BREATH_TILT_LOW * bh });
                    }
                }
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
        // 기술마다 맞는 짜임 (#122) = 그 기술 표 칸의 hit (dev/move-look.json → make-moves 가 MOVE_LIB 옵션에 넣음 · 게임과 같은 이름 찾기)
        const lib = typeof MOVE_LIB !== 'undefined' ? MOVE_LIB.find((v) => v[0] === ((typeof GAME_MOVE_ALIAS !== 'undefined' && GAME_MOVE_ALIAS[name]) || name)) : null;
        const hit = lib?.[2]?.hit;
        const opts = { ...(o || {}), pick: o?.pick ?? hitHash(name), bottom, ...(hit ? { hit } : {}), ...(fxAway ? { light: true } : {}) };
        safeFx({}, () => fxWithTimers(fxMoveGen, () => typeImpact(r.left + r.width / 2, r.top + r.height * 0.55, s, type, P, !!big, dst.left ? 1 : -1, r.width, opts)));
    },
    /** 필살기 — 일반 모드처럼 번쩍 · 어두워짐 · 컷인 · 큰 글씨 · 그 포켓몬의 필살기 (전용 연출 포함). 상대 = dst. 걸리는 시간 (ms), 못 쓰면 0.
     *  onHit = 상대를 처음 맞힌 순간 (게임은 그때 피해를 넣고, 남은 연출은 흘러가게 둠) · avoid = 피할 필살기 이름 (그 포켓몬이 배운 기술) */
    ult(src, dst, onHit, avoid, o) {
        fxGameStop(true);
        if (!POKEMON_SHAPE[src.form] || ultActive || fxWidth(src) < 1 || fxWidth(dst) < 1) {
            return 0;
        }
        // o.entry = 이 필살기로 (ULT_LIB 한 줄 — 개발 창 dev/ult-fx.py 가 필살기마다 맞는 때를 잼) · o.pick = 이 이름으로 (게임 개발 모드 (임시) — 그 포켓몬이 가진 것만)
        let entry = o?.entry || (o?.pick && (POKEMON_ULT[src.form] || []).map((k) => ULT_LIB[k]).find((v) => v && v[0] === o.pick)) || fxUltPick(src.form, avoid);
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
        // 3:3 — 큰 맞음 (빛줄기 닿음 · 대폭발 번쩍) 에 피해 (처음 닿음이 아니라), 자기 둘레 터짐은 그때 상대 자리로 (1:1 은 그대로 처음 닿음)
        const tm = fxTeamOn() && !o?.sub ? fxUltTiming(src.form, entry) : null;
        // 박자표 — 1:1 · 3:3 모두 (반격기 빼고): 부른 쪽에 큰 맞음 · 덮음 끝을 알림 (쓰러진 포켓몬이 연출이 걷힌 뒤 넘어지게 — 디자인팀). 피해 때는 3:3 (tm) 만
        // 덮음 끝은 실제 내 · 상대 거리로 (자기 둘레 터짐)
        const tmAll = !o?.sub ? fxUltTiming(src.form, entry, fxGap(src, dst)) : null;
        if (tm) {
            fxTagged.add(gen);
        }
        // 3:3 용 판 (orders #95 · 기본 — 반격기 빼고): 무대 상자 · 큰 순간 0.6초 앞까지 앞 감기 · 맞은 뒤 1.3초 · 흐려짐
        if (o?.stage && !o?.sub && fxTeamOn()) {
            return fxStageUlt(A, B, entry, gen, onHit, o);
        }
        // 위 끝 층 (#107) — 기둥 · 회오리 · 날씨 필살기 입자에 번호를 붙여 따로 그림 (끝나면 뺌 — 아래 total 뒤)
        const soft = fxInGame() && fxSoftTopOk(entry);
        if (soft) {
            fxTagged.add(gen);
            fxSoftGens.add(gen);
        }
        // o.sub = 반격기 — 패널 전체 번쩍 없음 (fxFlashCap)
        fxGame = { A, B, gen, tick: setInterval(fxGameTick, 100), onHit: tm ? null : onHit, hit: false, noFlash: !!o?.sub };
        let total = 0;
        // 본편 시작 (기 모으기 + 컷인 뒤 — 대상 다시 그리기 구간의 기준)
        let mainStart = 0;
        try {
            // o.quick = 같은 전투에서 다시 보는 필살기 — 컷인 없이 짧게 (ult/core.js ULT_QUICK_INTRO_MS)
            // 쓰기 전 기 모으기 (일반 모드 꾹 누르기와 같은 연출, 2026-10-20 태현 님) — 첫 필살기 0.8초 · 다시 보는 필살기 0.4초 · 반격기 (sub) 는 바로
            // o.charge = 기 모으기 길이를 정함 (3:3 합동 빔 · 오라 앞장 — 동료가 기를 모아 주는 구간 +1초, #96)
            const charge = o?.charge ?? (o?.sub ? 0 : o?.quick ? 400 : 800);
            // o.hitShift = 연출 틀이 스스로 늘리는 ms (3:3 합동 — 구 · 메가진화 o.track.extraG) · 맞는 때 · 자기 둘레 줄기 · 박자표 · 끝을 그만큼 늦춤
            const shift = Math.max(0, o?.hitShift || 0);
            // o.mainAt = 큰 맞음 (본편 시작부터 ms) 을 연출이 알려 줌 — 1:1 측정값 (ULT_HIT) 이 합동에서 빠진 장면 (메가런처 팔 대포 연사) 때라 회색 · 끝 장식이 0.7초 이르던 것 (#96 UX 큼 2)
            const mainAt = typeof o?.mainAt === 'number' ? o.mainAt : null;
            // o.noIntro = 1:1 컷인 없이 (3:3 장면 전환 합동 — 이름은 화면 큰 컷인, #99)
            const introMs = o?.noIntro ? 0 : o?.quick ? ULT_QUICK_INTRO_MS : ULT_INTRO_MS;
            mainStart = charge + introMs;
            // o.titleFoe = 3:3 장면 전환 상대 혼자 필살기 — 큰 이름을 상대 색 (혼자는 금 · 합동은 빨강으로 한 판에 "상대" 가 둘이던 것, 아트 디렉터 #98 ⑥)
            total = fxWithTimers(gen, () => useUltimate(A, entry, { quick: !!o?.quick, charge, ...(shift ? { extraMs: shift } : {}), ...(o?.sub ? { sub: o.sub } : {}), ...(o?.noIntro ? { noIntro: true } : {}), ...(o?.titleFoe ? { titleCols: ULT_FOE_TITLE } : {}) })) || 0;
            if (tmAll && total) {
                const at0 = charge + introMs + (mainAt ?? tmAll.main) + shift;
                // 부른 쪽에 박자 — main = 큰 맞음 · cover = 상대를 덮는 연출이 끝나는 때 (없으면 −1) · 지금부터 ms
                try {
                    o?.timing?.({ main: at0, cover: tmAll.cover >= 0 ? at0 - tmAll.main + tmAll.cover : -1, total });
                } catch (err) {
                    ultError('ult timing', err);
                }
            }
            if (tm && total) {
                const at = charge + introMs + (mainAt ?? tm.main) + shift;
                // 자기 둘레 필살기 (블래스트번 등) 는 제자리에서 원래대로 터지고, 대폭발 번쩍 뒤 기운이 줄기로 맞을 상대 모두에게 → 닿을 때 피해 (태현 님 #92)
                // 쏘는 필살기는 큰 맞음 (줄기가 상대에 닿음) 에 피해
                const hitNow = () => {
                    try {
                        onHit?.();
                    } catch (err) {
                        ultError('game hit', err);
                    }
                };
                if (tm.self && tm.flash >= 0) {
                    const targets = [B, ...(o?.others || []).filter((x) => x && fxWidth(x) >= 1)];
                    const flowAt = at - tm.main + tm.flash + FX_FLOW_DELAY_MS;
                    // 줄기 색 = 그 대폭발 색 (캔버스에서 뽑음 — 메가리자몽X 파란 불, 디자인팀 7판) · 피해는 닿는 때 타이머 (그리기에 묶지 않음 — 코드 리뷰어)
                    setTimeout(fxGuard(gen, () => fxSoloFlow(gen, A, targets, fxCols4(ultCols(entry[2] || {}, entry[1])), FX_SPIN_COLS[entry[0]])), flowAt);
                    setTimeout(fxGuard(gen, hitNow), flowAt + FX_FLOW_MS);
                } else {
                    setTimeout(fxGuard(gen, hitNow), at);
                }
            }
        } catch (err) {
            ultError('game ult', err);
        }
        if (soft) {
            setTimeout(() => fxSoftGens.delete(gen), (total || 0) + 1500);
        }
        // 대상 다시 그리기 (#107) — 덮는 구간 (본편 시작부터) 마다 맞는 포켓몬을 연출 맨 위에 · 지금은 꺼 둠 (FX_COVER_REDRAW · #115)
        if (total && fxInGame() && (FX_COVER_REDRAW || window.__fxCoverRedraw)) {
            const spans = fxCoverSpans(entry);
            if (spans.length) {
                const col = ultCols(entry[2] || {}, entry[1])[1];
                for (const [a, b] of spans) {
                    setTimeout(fxGuard(gen, () => fxCoverRedraw(gen, B, b - a, col)), mainStart + a);
                }
            }
        }
        if (!total) {
            fxGameStop(true);
            return 0;
        }
        fxGame.done = setTimeout(fxGameStop, total + 200);
        return total;
    },
    /**
     * 3:3 장면 전환 합동 (#101 시안 3 — 태현 님 "처음에 쓴 포켓몬한테 기를 모아서 주는 형식 · 구는 원기옥을 모으듯이 · 빔이면 나선형으로 2가지 기운이 돌거나 스파크가 튀듯이", 후레쉬맨 팀 필살기):
     * 앞장 (합동을 처음 쓴 포켓몬) = 자기 1:1 필살기를 처음부터 끝까지 그대로 (끊지 않음 · 마무리 폭발 그대로 — 시안 2 의 끊고 가는 빔으로 바꾸던 것을 없앰, 태현 님 "허접한 빔 하나").
     * 동료 = 쏘지 않고 같이 기 모으기 (0.8초) → 앞장이 기를 모으는 동안 자기 타입 색 기운을 앞장에게 넘겨줌 (모양 = ult/fx-team33 t11Gather — #102 시안 A 빛의 끈 · B 오라 리본 · C 빛 알갱이 강).
     * 앞장 연출이 매 장면 알려 주는 자리 (o.track — fx-sky 플레어드라이브 불꽃 구 · 하이드로캐논 대포 끝 · 물줄기) 로:
     *  구 = 들어올 때마다 구 둘레 기운 막 · 고리가 커짐 (원기옥) · 다 모이면 구 안에 동료 색 점이 뜀 /
     *  빔 = 물줄기에 동료 색 나선 (뒤로 가는 반은 물줄기에 가림) + 스파크 /
     *  그 밖 (알려 주지 않는 연출 — 돌진 · 범위) = 쏘기 0.5초 앞까지 앞장 입으로 모이고 앞장 몸에 동료 색 오라 (규칙 — 시안은 구 · 빔).
     * 맞을 때 = 앞장 진짜 폭발 그대로 + 참가자 색 고리 · 파편 (번갈아). 어둠은 앞장 연출 것 그대로 · 참가자 · 대상 밝게 (구멍 가장자리 바둑판 — #100).
     * o.timing = { main: 맞는 때, total } (같은 판 두 번째는 실행기가 맞고 1.5초 뒤 끊음 — #140)
     */
    team11Joint(srcs, dst, onHit, o = {}) {
        const list = (srcs || []).map((s, i) => ({ s, i })).filter(({ s }) => s && POKEMON_SHAPE[s.form] && fxWidth(s) >= 1);
        if (!list.length || fxWidth(dst) < 1) {
            return 0;
        }
        const lead = list[0];
        const want = o.pick?.[lead.i];
        const e = (want && (POKEMON_ULT[lead.s.form] || []).map((k) => ULT_LIB[k]).find((v) => v && v[0] === want)) || fxUltPick(lead.s.form, o.avoid?.[lead.i]);
        if (!e) {
            return 0;
        }
        // 앞장 연출이 채우는 자리 (구 · 빔) — 없으면 입 · 몸
        // half = 주는 동안만 앞장 혜성 반 (마무리 · 유성 그대로 — 태현 님 "응 그러자", 동료 별이 주인공으로 보이게) · avoid = 혜성이 피해 갈 동료 상자 (아래에서 채움)
        // 구 합동 = 일반 구 틀 (fx-energy runOrb) 만 — 전용 구는 연출 자리를 안 알려 별 · 번개가 안 나오고 박자만 1초 늦던 것 (#96 코드 리뷰)
        const orbUlt = e[1] === 'ultorb' && !e[2]?.sky && !fxJ11Special(e);
        const kind = fxJ11Kind(e);
        // 동료가 기를 모아 주는 구간 (모으기 · 별 보내기 · 앞장 구 커짐) 을 늘림 (#106 — 태현 님 "기모으는 시간만 1초정도 더 늘려서 하자") ·
        // 구 (fx-energy runOrb) = 연출 틀이 모으기를 그만큼 길게 · 여기서 맞는 때 · 피해 (엔진) · 끝을 그만큼 늦춤 /
        // 메가진화 (fxJ11Morph) = 연출 틀이 메가진화 뒤 기 모으기를 그만큼 길게 (번개 · 오라 혀는 메가진화 뒤부터라 — #96 디자인) · 박자는 구와 같이 /
        // 그 밖 (빔 · 오라 — #96) = 앞장 꾹 누르기 기 모으기를 그만큼 길게 (박자는 this.ult 가 기 모으기만큼 늦춤) — 그동안 동료 별이 입 (빔 시작) · 몸으로
        const gather = list.length >= 2 ? FX_J11_GATHER_EXTRA_MS : 0;
        const morph = fxJ11Morph(e);
        const extra = orbUlt || morph ? gather : 0;
        const track = { half: true, extraG: extra / 1000, willMorph: morph };
        // 빔은 모두 (일반 runBeam 도 o.track 을 채움 — #96 ②) · 이상해꽃 솔라빔처럼 안 채우는 틀은 입으로 (gatherTo 가 track.kind 를 봄)
        const tracked = (e[1] === 'ultdive' && !!e[2]?.flare) || (e[1] === 'ultbeam' && (!!e[2]?.turtle || !fxJ11Special(e))) || orbUlt;
        // 늘린 만큼 (extra) 은 this.ult 가 맞는 때 · 자기 둘레 줄기 · 박자표 · 끝을 한 곳에서 늦춤 (hitShift — 따로 늦추던 onHit1 · total 고치기가
        // 타이머 피해가 아닌 경로에서 두 번 늦고 자기 둘레 줄기는 안 늦던 것, #96 코드 리뷰)
        let hitAt = -1;
        // 메가런처 합동 = 연사 없음 (fx-sky runMegaLauncher volley) → 큰 맞음 = 물 구가 닿는 때 (발사 TS 4.5초 + 날아감 0.4초)
        const mainAt = e[1] === 'ultorb' && e[2]?.turtle ? 4900 : undefined;
        const total = this.ult(lead.s, dst, onHit, o.avoid?.[lead.i], { noIntro: true, hitShift: extra, ...(mainAt ? { mainAt } : {}), charge: 800 + (extra ? 0 : gather), entry: [e[0], e[1], { ...(e[2] || {}), track }], timing: (t) => {
            hitAt = t.main;
            try {
                o.timing?.(t);
            } catch (err) {
                ultError('joint11 timing', err);
            }
        } }) || 0;
        if (!total || !fxGame || list.length < 2) {
            return total;
        }
        const g = fxGame;
        const gen = g.gen;
        // 시험 창 (모양 스위치를 쓴 때만) — 길이 기록
        if (typeof window !== 'undefined' && window.__pgJointStyle) {
            window.__pgBoomLog = { total0: total - extra, total, hit: hitAt };
        }
        // 빔 합동 (하이드로캐논) — 해일이 끝난 뒤 남는 0.8초를 줄임 (마무리는 그대로 — 태현 님 #146 A "추천으로")
        const cut = e[1] === 'ultbeam' && e[2]?.turtle ? 800 : 0;
        if (cut) {
            setTimeout(fxGuard(gen, () => fxGame === g && fxGameStop(true)), total - cut);
        }
        const As = list.map(({ s }) => fxActor(s));
        const LA = As[0];
        const B = fxActor(dst);
        g.many = As;
        // 어둠 (앞장 연출의 ultDark) — 참가자 · 대상 밝게 · 구멍 가장자리 바둑판 (앞장만 밝아 기운을 보내는 동료가 어둠에 묻히던 것)
        // 상대는 안 밝힘 · 동료 구멍은 가장자리 바둑판 없이 (동료 색 1칸 테는 t11Gather) — 동료 · 상대 둘레가 같은 지름 90px 바둑판 원이라 뜻 없는 얼룩 둘로 보이던 것 (#96 아트 5바퀴 8)
        //   동료 구멍은 맞은 뒤 0.3초까지만 (그 뒤엔 어둠 속 밝은 원판만 남아 얼룩으로 보이던 것 — #96 6바퀴)
        fxJ11 = { g, lit: [...As], edgeOf: (u) => (u === LA ? 3 : 0), allyUntil: performance.now() + (hitAt > 0 ? hitAt : 2000) + 300, track };
        const allies = list.slice(1).map(({ i }, n) => ({ A: As[n + 1], c: t33Cols(o.types?.[i] || 'normal'), n, type: o.types?.[i] || 'normal' }));
        const leadC = t33Cols(o.types?.[lead.i] || 'normal');
        const cell = (A) => Math.max(1, Math.round(fxBody(A).w / (A._originalSpriteSize || 32)));
        const kL = cell(LA);
        const t0 = performance.now();
        // 모으는 자리 — 연출이 알려 주면 그 자리 (구 가운데 · 대포 끝) · 아니면 기 모으기부터 맞기 0.5초 앞까지 빔 = 입 (빔 시작) · 오라 = 몸 가운데 (#96)
        // 빔 · 플레어드라이브 (알려 주는 틀) 도 앞장 기 모으기 동안 (틀이 아직 안 시작) 은 입 · 몸으로
        const homeOf = () => {
            if (kind === 'aura') {
                const b = t11LeadBody(LA, track);
                return { x: b.x, y: b.y, r: 0 };
            }
            return { ...sigGeometry(LA, fxFacesLeft(LA, B)).mouth, r: 0 };
        };
        const gatherTo = (now) => {
            // 전용 구 (fx-unique jointOrb) 는 연출이 시작되면 스스로 구 자리를 알림 → 그때부터 그 자리 (#96 아트 5바퀴 1)
            if ((tracked && (orbUlt || track.kind)) || track.kind === 'orb') {
                if (track.kind === 'orb') {
                    return track.gather && track.r > 0 ? { x: track.x, y: track.y, r: track.r } : null;
                }
                // 빔 — 대포 끝에서 모으는 동안은 그 자리 · 그 앞 (대포가 솟는 동안 — 별이 0.9초 끊기던 것) 은 입 · 쏜 뒤는 끝
                if (track.kind === 'beam') {
                    st.fired = st.fired || !!track.on;
                    return track.gather ? { x: track.gx, y: track.gy, r: 0 } : st.fired ? null : homeOf();
                }
                return null;
            }
            return now - t0 < (hitAt > 0 ? hitAt - 500 : 2000) ? homeOf() : null;
        };
        const st = { arrivals: 0, on: false };
        // 모으기가 시작되면 동료도 기 모으기 빛 (일반 모드 꾹 누르기 — ms 에 다 차고 hold 동안 계속, t11Gather 갈래마다) · 모으기가 끝나면 멈춤
        const onGatherEnd = () => allies.forEach((a) => ultChargeStop(a.A));
        const onGather = (ms = 1800, hold = 0, star = false) => fxWithTimers(gen, () => {
            allies.forEach((a) => {
                try {
                    ultChargeFor(a.A, ms, true, hold, star ? { cols: T11_STAR_COLS[a.type] || T11_STAR_COLS.normal } : undefined);
                } catch (err) {
                    ultError('joint11 send', err);
                }
            });
            // 구 필살기 — 모으기부터 맞을 때까지 무대 어둡게 (1:1 기 모으기 어둠과 같은 0.32) · 앞장 · 동료 모두 둥근 조명 (셋이 같이 빛남 = 합동감 — 아트 #103 ② · 1:1 구 연출엔 제 어둠이 없어서)
            if (star && orbUlt && hitAt > 0) {
                const sec = Math.max(0.3, (t0 + hitAt - performance.now()) / 1000);
                ultDimLayer((life) => 0.32 * Math.min(1, life / 0.3, Math.max(0, sec - life) / 0.1), sec, () => As.filter((u) => u?.el?.isConnected), undefined, { edge: 3, minA: 0.3, j11: true, edgeOf: fxJ11?.edgeOf });
            }
        });
        // 진짜 구 안 (fx-energy drawOrb mid) — 섞임 바둑판 · 동료 색 소용돌이 (상대 쪽이면 시계 방향)
        const foe = fxBody(LA).x > fxBody(B).x;
        // 구 필살기 — 구가 생길 자리를 미리 알림 (화면 합동 이름 판이 뜰 때 한 번 견줘 자리를 정함 · 1.08 부풂 포함 — 구가 생기는 순간 판이 245px 뛰던 것, 아트 #103)
        if (typeof window !== 'undefined') {
            window.__pgJointOrbPlan = null;
            if (orbUlt && typeof fxOrbPreview === 'function') {
                try {
                    const pv = fxOrbPreview(ultGeometry(LA, fxFacesLeft(LA, B)), e[2] || {});
                    window.__pgJointOrbPlan = { x: pv.x, y: pv.y, R: pv.r * 1.08 + 2 * kL, at: performance.now() };
                } catch (err) {
                    ultError('joint11 orb plan', err);
                }
            }
        }
        // 주는 동안 앞장 혜성이 동료 몸 (그림 상자 + 둘레 8px) 을 피해 감 — 혜성이 동료를 덮던 것 (아트 #103)
        track.avoid = () => allies.map((a) => {
            const b = fxBody(a.A);
            return { l: b.x - b.w / 2 - 8, r: b.x + b.w / 2 + 8, t: b.y - b.h / 2 - 8, b: b.y + b.h / 2 + 8 };
        });
        track.inner = (ctx, x, y, r, armsPer) => t11OrbInner(ctx, { now: performance.now(), allies, kL, st, x, y, r, foe, armsPer, small: !!armsPer });
        fxWithTimers(gen, () => {
            allies.forEach((a) => {
                try {
                    ultChargeFor(a.A, 800);
                } catch (err) {
                    ultError('joint11 charge', err);
                }
            });
            sigParticle({ x: 0, y: 0, s: kL, max: total / 1000 + 0.3, z: 1, draw: (ctx) => {
                if (fxGame !== g) {
                    return;
                }
                try {
                    // 대비 장면 — 동료 그림 (연출 층 위라 어둠 · 하양에 안 덮임): 'dark' = 어둡게 0.35 · 'white' · 'neg' (하양 · 반전 장) = #1a1626 한 색 실루엣
                    //   (앞장 실루엣은 연출 틀이 그림 — 디자인 #108) · 끝나면 되돌림
                    const cv = fxJ11?.g === g ? fxJ11?.track?.contrast || false : false;
                    const contrast = !!cv;
                    if (cv !== st.contrastV) {
                        st.contrastV = cv;
                        st.contrast = contrast;
                        const filt = cv === 'white' || cv === 'neg' ? 'brightness(0) invert(0.09)' : cv ? 'brightness(0.35)' : '';
                        allies.forEach((a) => a.A?.el && (a.A.el.style.filter = filt));
                    }
                    t11Gather(ctx, { now: performance.now(), allies, kL, track, tracked, gatherTo, st, LA, hitEnd: t0 + (hitAt > 0 ? hitAt : 2000), onGather, onGatherEnd, leadType: o.types?.[lead.i] || 'normal', kind, foe, contrast });
                } catch (err) {
                    ultError('joint11 draw', err);
                }
            } });
        });
        // 대비 장면 중에 그림이 끝나도 (끊김 · 접힘) 동료 어둡게를 되돌림
        setTimeout(() => {
            if (st.contrastV) {
                st.contrast = false;
                st.contrastV = false;
                allies.forEach((a) => a.A?.el && (a.A.el.style.filter = ''));
            }
        }, total + 400);
        // 맞을 때 — 참가자 색 고리 (번갈아) · 파편
        if (hitAt > 0) {
            setTimeout(fxGuard(gen, () => {
                if (fxWidth(dst) < 1) {
                    return;
                }
                const r = fxRect0.call(dst.box || dst.el);
                const k = Math.max(1, Math.round(r.width / (dst.size || 32)));
                const tb = fxBody(B);
                const pairs = [leadC, ...allies.map((a) => a.c)].map((c) => [c[1], c[2]]);
                // 끝을 동료 타입으로 (합동에서만 — 혼자 판 터짐 + 고리 하나라 "증기 폭발" 인데 김이 안 보이던 것, 아트 #103 ①) — 물 = 김 + 물 왕관 · 풀 = 잎 · 그 밖 = 동료 별
                try {
                    // 일반 틀 풀 앞장 = 잎 16 (+ 페어리 동료 하트 8) · 땅 고리 — 그 동료 몫 (풀 잎 10 · 페어리 하트 10) 은 빼고 (#108 디자인 — 상대 합동 숲의 분노)
                    const grassLead = (o.types?.[lead.i] || 'normal') === 'grass';
                    const types = allies.map((a) => a.type);
                    t11Finale(grassLead && !track.uniq ? types.filter((t) => t !== 'grass' && t !== 'fairy') : types, tb, k);
                    if (grassLead && track.uniq) {
                        t11LeafBurst(tb, k);
                    } else if (grassLead) {
                        t11ForestBurst(tb, k, types, foe);
                    }
                } catch (err) {
                    ultError('joint11 finale', err);
                }
                sigParticle({ x: 0, y: 0, s: k, max: 0.6, z: 1, draw: (ctx, p) => {
                    const step = Math.min(5, Math.floor(p.life / 0.08));
                    ctx.globalAlpha = 1;
                    ctx.imageSmoothingEnabled = false;
                    const rMax = Math.max(6, Math.floor(Math.min(window.innerWidth - tb.x, tb.x) / k) - 2);
                    t33Ring(ctx, k, tb.x, tb.y, Math.min(rMax, [10, 15, 20, 24, 26, 26][step]), pairs, 'dot', step >= 5 ? (x, y) => (Math.round(x) + Math.round(y)) % 2 === 0 : null);
                    // 파편 — 참가자 색 2칸 조각 12개가 바깥으로 (0.08초마다 한 걸음)
                    const fly = (1 + Math.floor(p.life / 0.08)) * 3 * k;
                    for (let j = 0; j < 12; j++) {
                        const a = (j / 12) * Math.PI * 2 + 0.26;
                        const c = pairs[j % pairs.length];
                        ctx.fillStyle = j % 2 ? c[0] : c[1];
                        ctx.fillRect(Math.round((tb.x + Math.cos(a) * (12 * k + fly) * 1.4) / k) * k, Math.round((tb.y + Math.sin(a) * (8 * k + fly * 0.7)) / k) * k, 2 * k, 2 * k);
                    }
                } });
            }), hitAt);
        }
        return total - cut;
    },
    /**
     * 합동 필살기 (3:3 — 2026-10-21 태현 님 "필살기 연출은 그대로 (메가 변신 · 큰 폭발까지) · 필살기가 합쳐져서 멋진 형태로, 어색하지 않게")
     * 참가자마다 진짜 필살기 연출 전부 (일반 모드 그대로 — 전용 연출 · 변신 · 큰 폭발) 를 같은 상대로 동시에 돌리되,
     * 필살기마다 처음 맞는 때 (ULT_HIT — dev/ult-fx.py 가 잼) 가 같게 늦은 쪽을 먼저 시작하고, 그 순간 상대 한 점에서 마리 수만큼 큰 합체 폭발 (참가자 색 섞음).
     * 흐름: 다 같이 기 모으기 (0.8초) → 컷인 한 번 (앞장 + "이름 × 이름 / 합동 필살기!") → 각자 필살기 (같은 때 맞음) → 합체 폭발 (이때 onHit — 게임 피해) → 각자 연출 끝까지.
     * o.types = 참가자 타입 · o.avoid = 참가자마다 피할 이름 · o.pick = 참가자마다 고를 이름 · o.sure = 3:1 압도 (더 크게) · o.sub = 큰 이름 위 작은 글.
     * 걸리는 시간 (ms), 못 쓰면 0
     */
    ultJoint(srcs, dst, onHit, o = {}) {
        fxGameStop(true);
        // 그림이 없는 참가자는 그 타입 · 피할 이름 · 고를 이름과 같이 뺌 (순번이 어긋나 다른 포켓몬 것이 붙지 않게 — 코드 리뷰어)
        const list = (srcs || []).map((s, i) => ({ s, i })).filter(({ s }) => s && POKEMON_SHAPE[s.form] && fxWidth(s) >= 1);
        if (!list.length || ultActive || fxWidth(dst) < 1) {
            return 0;
        }
        const B = fxActor(dst);
        const gen = ++fxGen;
        const parts = list.map(({ s, i }) => {
            // o.pick = 참가자마다 고를 필살기 이름 (개발 창 · 개발 모드 (임시) — 그 포켓몬이 가진 것만), 없으면 늘 고르는 대로 (돌아가며 — 기획 #90 A)
            const want = o.pick?.[i];
            let e = (want && (POKEMON_ULT[s.form] || []).map((k) => ULT_LIB[k]).find((v) => v && v[0] === want)) || fxUltPick(s.form, o.avoid?.[i]);
            if (!e || ULT_SPECIALS.includes(e[1])) {
                e = [e ? e[0] : '필살기', 'ultgeneric', {}];
            }
            const T = ULT_FX[e[1]] || ULT_FX.ultgeneric;
            let ms = 3000;
            try {
                ms = ultClamp(T.ms(POKEMON_SHAPE[s.form][0], e[2] || {}) || 3000, 800, 15000);
            } catch (err) {
                ultError('joint ms', err);
            }
            const tm = fxUltTiming(s.form, e);
            const A = fxActor(s);
            // 참가자마다 번호 — 멈춤 · 계단 · 번쩍 빼기를 따로, 멈출 때 다 같이
            const pg = ++fxGen;
            fxTagged.add(pg);
            // 번쩍 · 화면 판은 합동 것 하나만 (참가자 모두 — 메가런처 본편 번쩍이 3장면 남던 것, 아트 디렉터 #80 둘째 바퀴 ⑦)
            fxNoFlashGens.add(pg);
            const self = (!!tm && FX_JOINT_AREA.has(e[1])) || (!!tm?.self && tm.flash >= 0);
            // 박자표 번쩍이 쏘는 때가 아닌 필살기는 따로 적은 때로 (FX_JOINT_FIRE — 거북왕 하이드로캐논 · 메가런처)
            const fire = fxTurtleFire(e);
            // 맞출 순간 = 대폭발 "크게" (자기 둘레 — 번쩍이 없으면 큰 맞음) · 빔이 나가는 번쩍 (쏘는 — 없으면 큰 맞음 0.26초 전)
            const anchor = fire ? fire[0] : tm ? (self ? (tm.flash >= 0 ? tm.flash : tm.main) : tm.flash >= 0 && tm.flash < tm.main ? tm.flash : Math.max(0, tm.main - 260)) : Math.round(ms * 0.4);
            // 빔이 나가서 상대에 닿기까지 (쏘는 — 꽃 터짐 = 큰 맞음)
            const reach = fire ? fire[1] - fire[0] : tm && !self ? Math.max(0, tm.main - anchor) : 0;
            // 대상 쪽을 봄 (화면 가운데가 아니라 — #91)
            return { A, e, T, ms, anchor, reach, self, gen: pg, left: fxFacesLeft(A, B), cols: fxCols4(ultCols(e[2] || {}, e[1])), type: o.types?.[i] || 'normal', freeze: 0 };
        });
        const As = parts.map((p) => p.A);
        // 어둠 속에서 밝게 둘 포켓몬 — 참가자 · 닿는 때부터 맞는 상대 (어두워짐 아래 흐린 그림자로 남던 것 — 디자인팀 7판)
        const lit = [...As];
        const lead = parts[0];
        // quick = 힘겨루기를 이긴 합동 — 참가자 필살기는 대결에서 이미 나감 → 기 모으기 · 각자 필살기를 다시 쓰지 않고 컷인 → 빛줄 → 기운이 모여 큰 구슬 → 폭발 (orders #86 —
        // "처음에 썼던 포켓몬의 기술이 먼저 나간후에 갑자기 기를 모으면서 3명이 또 다시 쓰는")
        const quick = !!o.quick;
        const charge = quick ? 0 : 800;
        const introMs = ULT_INTRO_MS;
        const shooters = parts.filter((p) => !p.self);
        const selfs = parts.filter((p) => p.self);
        // 나선 감기 (#98 D) = 쏘는 줄기가 하나라도 있고 함께가 있을 때 — 쏘는 + 자기 둘레 (기운 나선) · 쏘는 + 쏘는 (두 색 나선) / 자기 둘레끼리는 기운이 모여 큰 구슬 (fxJointFinish)
        const spiral = !quick && shooters.length > 0 && parts.length > 1;
        const beam = spiral ? shooters[0] : null;
        const partner = spiral ? (selfs[0] ?? shooters[1]) : null;
        // 같은 때 맞게 — 늦은 쪽에 맞춤. 쏘는 쪽이 이르면 늦추지 않고 모으기를 늘림 (같이 시작 — 빛 구슬이 커짐), 자기 둘레가 이르면 늦게 시작
        const big = quick ? 0 : Math.max(...parts.map((p) => p.anchor));
        parts.forEach((p) => {
            if (quick) {
                p.start = 0;
            } else if (spiral && !p.self && p.anchor < big) {
                p.start = 0;
                p.freeze = big - p.anchor;
            } else {
                p.start = big - p.anchor;
            }
        });
        // 빔 끝 (꽃 터짐) 을 나선이 닿는 때로 — 큰 맞음 바로 앞에서 그만큼 멈춤
        const run = spiral ? Math.max(FX_SPIRAL_RUN_MS, ...shooters.map((p) => p.reach)) : 0;
        shooters.forEach((p) => (p.hold = spiral ? Math.max(0, run - p.reach) : 0));
        const finishAt = spiral ? big + run : big + FX_JOINT_FLOW_MS + FX_JOINT_GO_MS;
        const base = charge + introMs + FX_LINK_MS;
        const now = performance.now();
        // 끝 = 맞음 + FX_JOINT_END_MS (참가자는 +600 에 다 지워짐 · 섞인 폭발 0.9초) + 어둠이 걷힘 — 엔진이 다시 달리기 (맞음 + tailMs) 0.1초 전까지
        // (본편 끝 — 해일 · 꽃 터짐 · 메가 되돌림, 맞음 뒤 약 5초 — 까지 기다리지 않음, #80 진단 ②)
        const tailMs = o.tailMs ?? FX_JOINT_TAIL_MS;
        const until = now + base + finishAt + Math.max(0, Math.min(FX_JOINT_END_MS, tailMs - 100 - ULT_OUTRO_MS)) + ULT_OUTRO_MS;
        const g = { A: lead.A, B, many: As, gen, gens: parts.map((p) => p.gen), tick: setInterval(fxGameTick, 100), hit: false, joint: true };
        fxGame = g;
        try {
        // 합동 층 (맨 위 · 맞은 뒤 참가자 층) — 칸 = 첫 참가자 점 1칸
        const J = { g, gen, gens: new Set(parts.map((p) => p.gen)), selfGens: new Set(parts.filter((p) => p.self).map((p) => p.gen)), p: Math.max(1, Math.round(fxBody(lead.A).w / (lead.A._originalSpriteSize || 32))), dissolveAt: 0, top: {} };
        fxJointTop = J;
        // 기 모으기를 먼저 (ultActive 가 걸리면 기 모으기가 바로 끝남 — useUltimate 와 같은 순서, 코드 리뷰어)
        if (!quick) {
            fxWithTimers(gen, () => parts.forEach((p) => ultChargeFor(p.A, charge)));
        }
        ultActive = { pokemon: lead.A, until, name: lead.e[0], fx: lead.e[1] };
        moveCanvasReady();
        moveCanvas.style.zIndex = '6';
        for (const p of parts) {
            p.A.currentState = new UltState(p.left, until);
            p.A.currentStateEnum = 'swipe';
            p.A.hideSpeechBubble();
            // quick 은 참가자 필살기 연출이 안 돌아 색만 바뀌던 것 (웨더볼 · 섀도크루 등 — 코드 리뷰어 #86)
            if (!quick && p.e[2]?.tint) {
                p.A.el.style.filter = p.e[2].tint;
            }
        }
        const names = parts.map((p) => p.e[0]);
        const others = (o.others || []).filter((x) => x && fxWidth(x) >= 1);
        const hitNow = () => {
            try {
                onHit?.();
            } catch (err) {
                ultError('joint hit', err);
            }
            // 맞은 뒤 — 참가자 히트스톱 120ms → 자름 → +300 부터 바둑판 3걸음 (FX_JOINT_* 설명) · 진짜 그림은 꼭두각시가 4분의 1 남을 때 (+450)
            if (fxGame !== g) {
                return;
            }
            J.dissolveAt = performance.now() + FX_JOINT_DISSOLVE_MS;
            // 자기 둘레 참가자 (돔 · 불기둥 · 덩굴) 는 맞는 순간 — 합동 번쩍이 덮는 장면 — 에 빼고 진짜 그림 (+300 에 한 장면에 빠져 "툭 꺼지던" 것 — 여섯째 바퀴)
            parts.filter((p) => p.self).forEach((p) => p.A.fxReset());
            fxJointDrop(J);
            parts.forEach((p) => fxFreeze(p.gen, FX_JOINT_STOP_MS));
            setTimeout(() => {
                if (fxGame === g) {
                    fxJointCut(J);
                }
            }, FX_JOINT_STOP_MS);
            // 진짜 그림은 바둑판이 시작하는 장면에 한 번에 (꼭두각시가 바둑판 유령 · 두 겹으로 남던 것 — 아트 디렉터 #80 둘째 바퀴 ⑤) · 줄기 보기의 입 뒤도 그때부터 안 그림 (fxStairBlit)
            setTimeout(() => {
                if (fxGame === g) {
                    parts.filter((p) => !p.self).forEach((p) => p.A.fxReset());
                }
            }, FX_JOINT_DISSOLVE_MS);
        };
        fxWithTimers(gen, () => {
            // 기 모으기 (0.8초) → 컷인 한 번 → 머리 위 빛줄 0.3초 → 각자 필살기
            setTimeout(() => {
                try {
                    ultIntro(lead.A, lead.left, names.join(' × '), o.sub ?? (o.sure ? '압도하는 합동 필살기!' : '합동 필살기!'), lead.e[2] || {}, lead.e[1], until, introMs, () => lit);
                } catch (err) {
                    ultError('joint intro', err);
                }
            }, charge);
            setTimeout(() => {
                const heads = parts.map((p) => {
                    const r = p.A.collision.getBoundingClientRect();
                    return { x: r.left + r.width / 2, y: r.top + r.height * 0.15 };
                });
                const u0 = 2 * Math.max(1, Math.round(fxBody(lead.A).w / (lead.A._originalSpriteSize || 32)));
                for (let i = 1; i < heads.length; i++) {
                    fxLinkLine(heads[i - 1], heads[i], u0);
                }
            }, charge + introMs);
            (quick ? [] : parts).forEach((p) => {
                setTimeout(() => {
                    fxWithTimers(p.gen, () => {
                        try {
                            p.T.run(ultGeometry(p.A, p.left), p.e[2] || {}, p.ms, p.A);
                        } catch (err) {
                            ultError(`joint ${p.e[1]}.run`, err);
                        }
                    });
                    // 쏘는 쪽 모으기를 늘림 — 빔이 나가기 0.5초 전에서 멈춰 (빛 구슬이 커짐) 대폭발 "크게" 에 빔이 나감
                    if (p.freeze > 0) {
                        const at = Math.max(0, p.anchor - 500);
                        fxSetTimeout0(() => {
                            if (gen <= fxDeadBelow || fxKilled.has(gen)) {
                                return;
                            }
                            fxFreeze(p.gen, p.freeze);
                            const gm = ultGeometry(p.A, p.left);
                            const S = Math.max(1, Math.round(gm.s));
                            // 구슬 = 원래 모으기 빛 자리 (입 − 8칸 · 빔 축 − 1칸) · 빔이 나가는 동안 (닿을 때까지) 도 남아 빔 뿌리를 덮음
                            fxGrowOrb({ x: gm.mouth.x - gm.dir * 8 * S, y: gm.mouth.y - S }, p.cols, S, (p.freeze + Math.min(500, p.anchor)) / 1000, fxBeamView.get(p.gen));
                        }, at);
                    }
                }, base + p.start);
            });
            if (spiral) {
                // 쏘는 + 쏘는 = Y 자 (아트 디렉터 #80 ② [제안]) — 두 줄기가 합류점 M (두 입 가운데 → 상대 55%) 까지 각자 · M 너머는 합친 줄기 하나 (fxMergeRun).
                // 나란히 따로 가다 상대 앞에서만 만나던 것 · 나선이 갈고리처럼 매달려 보이던 것 대신
                // 빔 (ultbeam) 둘 · 입 높이가 다를 때만 — 구슬 · 소용돌이 · 불길은 팔로 안 읽히고, 한 줄 (낮은 패널) 이면 가운데 줄로 나눈 팔이 사라짐 (#80 다섯째 바퀴) → 그 밖은 나선
                const beamers = shooters.filter((p) => p.e[1] === 'ultbeam');
                const geos2 = beamers.slice(0, 2).map((p) => ultGeometry(p.A, p.left));
                const mouths2 = geos2.map((gm) => gm.mouth);
                // 입 높이 차가 빔 굵기 (반 높이 5칸 × 2) 보다 커야 위 · 아래 팔이 나뉨 (480 에서 15px 차로 Y 가 되어 위 팔이 잘려 사라지던 것 — 여섯째 바퀴)
                const yMerge = beamers.length >= 2 && Math.abs(mouths2[0].y - mouths2[1].y) >= 2 * 5 * Math.max(1, Math.round(geos2[0].s));
                const bB = fxBody(B);
                let M = null;
                if (yMerge) {
                    const ms = mouths2;
                    const mx = ms.reduce((a, m) => a + m.x, 0) / ms.length;
                    const my = ms.reduce((a, m) => a + m.y, 0) / ms.length;
                    M = { x: mx + (bB.x - mx) * 0.55, y: my + (bB.y - my) * 0.55 };
                }
                const mAt = now + base + big + (finishAt - big) * 0.55;
                // 빔 (첫 쏘는 쪽) 보기 — 대폭발 크게부터 앞끝이 FX_SPIRAL_RUN_MS 에 상대 가슴까지 (Y 자는 M 까지) · 앞끝 너머 안 그림 · 줄이 다르면 계단
                const views = shooters.map((p) => {
                    const gm = ultGeometry(p.A, p.left);
                    const b = bB;
                    const me = fxBody(p.A);
                    const dir = b.x >= gm.mouth.x ? 1 : -1;
                    const S = Math.max(1, Math.round(gm.s));
                    // 빔 뿌리 = 입 (그림 앞쪽 끝 — 그림 가운데 + 0.28 × 그림 크기보다 안쪽이면 거기로, 몸을 뚫고 지나가지 않게)
                    const x0 = dir > 0 ? Math.max(gm.mouth.x, me.x + 0.28 * me.w) : Math.min(gm.mouth.x, me.x - 0.28 * me.w);
                    // 겨누는 곳 — Y 자면 M (입보다 앞 8칸은 넘게), 아니면 상대 가슴
                    const ex = yMerge ? (dir > 0 ? Math.max(M.x, x0 + 8 * S) : Math.min(M.x, x0 - 8 * S)) : b.x;
                    const ey = yMerge ? M.y : b.y;
                    // 점 = 포켓몬 점 1칸 (p) · 계단 = 2칸 폭 (u) · 빔 반 높이 = 5칸 (원래 줄기 20px — ×2)
                    const v = { x0, y0: gm.mouth.y, dir, slope: ((ey - gm.mouth.y) / Math.max(20, Math.abs(ex - x0))) * dir, u: 2 * S, p: S, half: 5 * S, tx: ex, bigAt: now + base + big, hitAt: now + base + finishAt };
                    v.orbX = gm.mouth.x - dir * 8 * S;
                    // 닿은 뒤는 상대 + 40px 까지 (줄기가 상대를 뚫고 나가 보이지 않게 — 디자인팀 8판 끝). 100ms 뒤 풀던 것 → 꼬리가 흐려질 때까지 묶음 (본편 빔이 화면 끝까지 1.5 ~ 2.5초 보이던 것 — #80 진단 ③)
                    // Y 자면 M 까지 mAt 에 닿고 거기서 멈춤 (M 너머는 합친 줄기)
                    v.front = yMerge
                        ? (t) => (t < v.bigAt ? Infinity * v.dir : t < mAt ? v.x0 + (v.tx - v.x0) * Math.min(1, (t - v.bigAt) / Math.max(1, mAt - v.bigAt)) : v.tx)
                        : (t) => (t < v.bigAt ? Infinity * v.dir : t < v.hitAt ? v.x0 + (v.tx - v.x0) * Math.min(1, (t - v.bigAt) / (v.hitAt - v.bigAt)) : v.tx + v.dir * 40);
                    v.cols = p.cols;
                    fxBeamView.set(p.gen, v);
                    // 꽃 터짐 뒤 화면 전체 번쩍 장은 뺌 (흰 돔이 회색으로 깜빡이던 것) — 번쩍은 닿는 순간 한 번
                    fxNoFlashGens.add(p.gen);
                    return v;
                });
                // Y 자 — 위 입 쪽 팔은 가운데 줄 위 · 아래 입 쪽은 아래 · 합친 줄기 위 반 = 위 팔 색 (두 색이 들어와 하나가 됨)
                const arms = yMerge ? views.filter((_, i) => shooters[i].e[1] === 'ultbeam').slice(0, 2).sort((a, b2) => a.y0 - b2.y0) : [];
                if (arms.length === 2) {
                    const mid = { x1: (arms[0].x0 + arms[1].x0) / 2, y1: (arms[0].y0 + arms[1].y0) / 2, x2: M.x, y2: M.y };
                    arms[0].clip = -1;
                    arms[1].clip = 1;
                    arms[0].mid = mid;
                    arms[1].mid = mid;
                }
                // 빔 끝 (꽃 터짐) 을 나선이 닿는 때로 — 큰 맞음 0.04초 전에서 멈춤
                shooters.forEach((p) => {
                    if (p.hold > 0) {
                        fxSetTimeout0(() => {
                            if (gen > fxDeadBelow && !fxKilled.has(gen)) {
                                fxFreeze(p.gen, p.hold);
                            }
                        }, base + big + Math.max(0, p.reach - 40));
                    }
                });
                setTimeout(() => {
                    const v = views[0];
                    const pb = fxBody(partner.A);
                    // 기운 색 = 자기 둘레 대폭발 색 (캔버스에서 — 메가리자몽X 파란 불) · 쏘는 + 쏘는 은 둘째 줄기 색
                    const spin = FX_SPIN_COLS[partner.e[0]] ?? partner.cols;
                    if (yMerge) {
                        fxMergeRun(M, B, (arms[0] ?? v).cols ?? beam.cols, (arms[1] ?? v).cols ?? spin, v.p, v.half, mAt, v.hitAt);
                    } else {
                        fxSpiralRun(v, beam.cols, spin);
                    }
                    // 처음 0.3초 — 돔 끝 세 곳에서 기운 줄기 셋이 빔 뿌리로
                    if (partner.self && !yMerge) {
                        const scan = fxDomeScan(pb, v.dir, Math.abs(v.tx - pb.x));
                        const ex = scan.edge ?? pb.x + v.dir * pb.w * 0.6;
                        // 합동에서 빔으로 드는 기운 셋은 1칸 점 · 빔 위 / 아래 끝에서 끝남 (혼자 기운 줄기는 2칸 그대로 — 아트 2차)
                        const root = (from) => ({ x: v.x0 + v.dir * 40, y: from.y < v.y0 ? v.y0 - 8 * v.p : v.y0 + 8 * v.p });
                        [[{ x: ex - v.dir * pb.w * 0.6, y: pb.y - pb.h * 1.2 }, 0, 12], [{ x: ex, y: pb.y - pb.h * 0.7 }, 50, 8], [{ x: ex - v.dir * pb.w * 0.2, y: pb.y + pb.h * 0.2 }, 100, -10]].forEach(([from, d, lift]) => {
                            setTimeout(() => fxFlow(from, root(from), spin, v.p, 300, lift), d);
                        });
                    }
                    // 닿는 순간 — 불꽃 맞음 + 섞인 큰 폭발 + 번쩍 한 번 + 범위면 나머지 상대 · 맞는 상대 밝게
                    setTimeout(() => {
                        try {
                            const b = fxBody(B);
                            const hy = yMerge ? b.y : v.y0 + fxStairDy(v, v.tx);
                            // 혼자용 불꽃 맞음은 뺌 (빈 고리 가운데를 막아 꽃이 안 보이던 것 — 아트 2차)
                            fxMixBurst8(b.x, hy, spin, beam.cols, v.p, Math.max(2, parts.length));
                            screenFlash(Math.max(1, v.u / 2), 0.55, '#ffffff', 0.08);
                            lit.push(B);
                            others.forEach((spec, i) => setTimeout(() => {
                                const q = (spec.box || spec.el).getBoundingClientRect();
                                if (q.width >= 1) {
                                    typeImpact(q.left + q.width / 2, q.top + q.height * 0.55, v.u / 2, parts[i % parts.length].type, 0.5, false, q.left > b.x ? 1 : -1, q.width, { scale: 0.9 });
                                }
                            }, 150 + i * 60));
                        } catch (err) {
                            ultError('joint spiral hit', err);
                        }
                    }, finishAt - big);
                }, base + big);
                // 피해 = 빔 앞끝 + 나선이 닿는 때 (타이머 — 그리기와 따로, 한 번)
                setTimeout(hitNow, base + finishAt);
            } else {
                // 자기 둘레끼리 — 대폭발 뒤 기운이 모여 큰 구슬이 상대를 침 (fxJointFinish) · 피해 = 닿는 때 (타이머)
                let finishMs = FX_JOINT_FLOW_MS + FX_JOINT_GO_MS;
                setTimeout(() => {
                    try {
                        // quick — 참가자 모두에게서 기운이 모여 큰 구슬 (쏘는 쪽도 제자리에서 기운만 — 빔을 다시 쏘지 않음)
                        finishMs = fxJointFinish(quick ? parts.map((p) => ({ ...p, self: true })) : parts, B, !!o.sure, others);
                    } catch (err) {
                        ultError('joint finish', err);
                        finishMs = 0;
                    }
                    lit.push(B);
                    setTimeout(hitNow, finishMs);
                }, base + big);
            }
        });
        g.done = setTimeout(() => {
            parts.forEach((p) => {
                p.A.el.style.filter = '';
                fxBeamView.delete(p.gen);
                fxNoFlashGens.delete(p.gen);
            });
            if (fxGame === g) {
                fxGameStop(false);
            }
        }, until - now);
        } catch (err) {
            // 시작하다 던지면 (그림이 떨어져 나감 등) 멈춤 — 0 을 돌려 게임은 엔진 박자로 (코드 리뷰어)
            ultError('joint start', err);
            fxGameStop(true);
            return 0;
        }
        return until - now;
    },
    /** 힘대결 시작 — a = 내 포켓몬 (왼쪽), b = 상대. spec = { kind: 'ult' | 'move', a: 기술 | null, b: 기술 | null }, live() = 내가 이길 확률 (연타 반영, 0 ~ 1).
     *  필살기 대결은 VS 연출 (1.5초) 뒤에. { meetMs: 시작에서 가운데서 만나는 때 } · 못 하면 null */
    duelReady(a, b) {
        return !!POKEMON_SHAPE[a.form] && !!POKEMON_SHAPE[b.form] && fxWidth(a) >= 1 && fxWidth(b) >= 1;
    },
    duel(a, b, spec, live) {
        fxGameStop(true);
        if (!POKEMON_SHAPE[a.form] || !POKEMON_SHAPE[b.form] || ultActive || fxWidth(a) < 1 || fxWidth(b) < 1) {
            return null;
        }
        const A = fxActor(a);
        const B = fxActor(b);
        // 앞장 뒤에 선 같은 편 (3:3 힘겨루기 장면) — 진 쪽이 밀려날 거리를 그 앞까지 (duel.js duelKnockRoom)
        for (const [X, side] of [[A, 'a'], [B, 'b']]) {
            X.duelBehind = () => {
                try {
                    return (spec.behind && spec.behind(side)) || [];
                } catch (err) {
                    ultError('duel behind', err);
                    return [];
                }
            };
        }
        const gen = ++fxGen;
        fxGame = { A, B, gen, tick: setInterval(fxGameTick, 100) };
        let meetMs = 0;
        const ok = safeFx({}, () => fxWithTimers(gen, () => {
            const ultA = fxDuelEntry(spec.kind, a.form, spec.a, spec.aAvoid, spec.aName);
            const ultB = fxDuelEntry(spec.kind, b.form, spec.b, spec.bAvoid, spec.bName);
            const leftA = !!a.left;
            const leftB = !!b.left;
            // 승패는 게임 엔진이 4초 끝에 정함 — 처음엔 가운데 (무승부 모양) 로 짜고, 밀기는 승자가 올 때까지 (duelWin)
            const D = duelPlan(A, ultA, leftA, B, ultB, leftB, 'draw', { mouth: true });
            D.draw = false;
            D.winner = null;
            D.loser = null;
            D.tO = Infinity;
            D.total = FX_DUEL_LONG;
            // 3:3 합류가 있던 쪽이 이기면 부제 = "거북왕 · 리자몽 · 이상해꽃 합동!" (셋이 합류해 이겼는데 앞장 필살기 이름만 나와 합동이라는 말이 없던 것 — UX 리뷰어 #116 작음 5)
            D.winTitle = (Wn) => {
                const names = ((D.joins && D.joins[Wn === D.A ? 'a' : 'b']) || []).map((j) => j.name).filter(Boolean);
                // 1.5초 (1.3 이면 다 보이는 때가 0.98 ~ 1.02초로 U1 경계 — UX 리뷰어 #116 3바퀴 작음 1)
                return [Wn === D.A ? '힘대결에서 이겼다!' : '힘대결에서 졌다…', names.length ? `${[Wn.p.name, ...names].join(' · ')} 합동!` : `${Wn.p.name}의 ${Wn.name}!`, 1.5];
            };
            // 이길 확률은 0.4초에 걸쳐 따라감 (합류 · 연타로 확률이 계단으로 바뀌면 만나는 곳이 한 장면에 140px 튀던 것 — #116 UX 큼 · 1:1 도 같이)
            let pS = null;
            let tS = 0;
            D.live = (t, s) => {
                let p = 0.5;
                try {
                    p = Math.min(1, Math.max(0, Number(live()) || 0.5));
                } catch (err) {
                    ultError('duel live', err);
                }
                pS = pS === null ? p : pS + (p - pS) * Math.min(1, Math.max(0, t - tS) / 0.4);
                tS = t;
                p = pS;
                // 연타로 기운 만큼 + 일반 모드 밀고 밀리기 리듬 (반만)
                return Math.min(0.85, Math.max(-0.85, (p - 0.5) * 1.4 + 0.5 * s));
            };
            const vs = spec.kind === 'ult' ? ULT_VS_MS : 0;
            meetMs = vs + D.tm * 1000;
            const now = performance.now();
            ultActive = { pokemon: A, rival: B, until: now + FX_DUEL_LONG * 1000, name: ultA[0], fx: 'clash' };
            const start = () => {
                duelStart(D);
                duelJoinStart(D);
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
    /**
     * 3:3 용 판 합동 한 장면 (2026-10-22 태현 님 #126 · #127 · orders #95 — ult/fx-team33.js t33Joint): 모이기 → 발사 하나 → 터짐 하나 · 약 3초 (quick = 힘겨루기 뒤 짧은 마무리 · 혼자 이겨도).
     * 맞는 때 (보통 2.25초 · quick 0.9초 — 엔진 jointHitMs · clashJointHitMs) 에 피해. 돌려줌 = 길이 (ms)
     */
    teamJoint(srcs, dst, onHit, o = {}) {
        // 힘겨루기를 이긴 짧은 마무리 — 이긴 줄기를 끊지 않고 이어받음 (줄기가 사라지고 0.4초 멈췄다 새 줄기를 다시 쏘던 것 — 디자인 UX #95 ③ · #86 두 번 나감과 같은 종류)
        const keep = o.quick && fxGame && fxGame.duel33 ? fxGame.duel33 : null;
        if (keep) {
            fxGame.duel33 = null;
        }
        fxGameStop(true);
        const list = (srcs || []).map((s, i) => ({ spec: s, type: o.types?.[i] || 'normal' })).filter((x) => x.spec && fxWidth(x.spec) >= 1);
        if (!list.length || fxWidth(dst) < 1) {
            if (keep) {
                keep.p.max = keep.p.life;
            }
            return 0;
        }
        // 이어받은 힘겨루기 줄기는 지우지 않음 (줄기가 0.1초 만에 사라지고 0.7초 비던 것)
        fxQuietOthers(keep?.p);
        const gen = ++fxGen;
        const g = { A: fxActor(list[0].spec), B: fxActor(dst), gen, tick: setInterval(fxGameTick, 100), onHit: null, hit: false, duel33: keep };
        fxGame = g;
        // 참가자 몸도 구멍 안 냄 — 모으기 기운 · 입 앞 구슬은 앞 층 (아트 디렉터 #95 9바퀴 ②) · 쏘는 줄기는 포켓몬 아래 캔버스라 상관없음
        fxLiftBystanders(g, [dst, ...(o.others || []), ...list.map((x) => x.spec)]);
        let total = 0;
        try {
            // 고리 크기 — 맞는 상대 가운데에서 가장 가까운 옆 몸 (보이는 몸 상자) 끝까지 가로 거리 · 발밑 판 위 끝 (아트 디렉터 #95 4바퀴 ⑤ — 가운데 거리 ×1.6 이라 옆 몸 · 판에 닿던 것)
            const tbx = fxShapeBox(dst) || (() => {
                const r = fxRect0.call(dst.box || dst.el);
                return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
            })();
            const dcx = (tbx.left + tbx.right) / 2;
            let nearDx = Infinity;
            for (const q of o.near || []) {
                const b = q && fxWidth(q) >= 1 ? fxShapeBox(q) : null;
                // 위아래로 고리 (가장 클 때 반지름 ≈ 몸 높이) 밖이면 안 셈
                if (!b || b.bottom < tbx.top - (tbx.bottom - tbx.top) || b.top > tbx.bottom + 8) {
                    continue;
                }
                nearDx = Math.min(nearDx, b.left >= dcx ? b.left - dcx : b.right <= dcx ? dcx - b.right : 0);
            }
            total = fxWithTimers(gen, () => t33Joint(list, dst, { quick: !!o.quick, hitMs: o.hitMs, finish: !!keep, others: (o.others || []).filter((x) => x && fxWidth(x) >= 1), nearDx, floorY: tbx.bottom + 4 })) || 0;
            // 이어받은 줄기 — 맞기 0.2초 앞부터 꼬리부터 걷어 0.1초 앞에 다 걷힘 (걷히는 줄기 · 별 · 터짐 · 고리가 한 장면에 겹치던 것 — 아트 디렉터 #95 4바퀴 ④) · 그 전에 진 쪽 입에 닿게 (t33Duel)
            if (keep) {
                keep.st.hitAt = keep.p.life + (o.hitMs ?? 900) / 1000;
                keep.p.max = Math.min(keep.p.max, keep.st.hitAt - 0.1);
            }
        } catch (err) {
            ultError('team joint', err);
        }
        if (!total) {
            fxGameStop(true);
            return 0;
        }
        fxSetTimeout0(fxGuard(gen, () => {
            try {
                onHit?.();
            } catch (err) {
                ultError('game hit', err);
            }
        }), Math.round(o.hitMs ?? (o.quick ? 900 : 2250)));
        g.done = fxSetTimeout0(() => fxGame === g && fxGameStop(true), total + 200);
        return total;
    },
    /** 3:3 용 판 필살기 힘겨루기 (#132 — t33Duel): 두 앞장 줄기가 무대 가운데서 밀고 밀림 · 결과는 teamDuelWin · 합류는 teamDuelJoin. 돌려줌 = 만나는 때 */
    teamDuel(a, b, spec, live) {
        fxGameStop(true);
        if (fxWidth(a) < 1 || fxWidth(b) < 1) {
            return null;
        }
        fxQuietOthers();
        const gen = ++fxGen;
        const g = { A: fxActor(a), B: fxActor(b), gen, tick: setInterval(fxGameTick, 100) };
        fxGame = g;
        fxLiftBystanders(g, []);
        const st = { win: null, joinA: 0, joinB: 0 };
        let p = null;
        try {
            p = fxWithTimers(gen, () => t33Duel(a, b, spec.typeA || 'normal', spec.typeB || 'normal', live, st, spec));
        } catch (err) {
            ultError('team duel', err);
        }
        if (!p) {
            fxGameStop(true);
            return null;
        }
        g.duel33 = { p, st };
        // 맞부딪힘 한 번 — 날아가던 필살기 (구 · 줄기) 가 한 장면에 사라지고 줄기가 만나기까지 0.9초 빈 무대이던 것 (UX 리뷰어 #98 · bugs 1833)
        try {
            const ra = (a.box || a.el).getBoundingClientRect();
            const rb = (b.box || b.el).getBoundingClientRect();
            // 자리 = 끊긴 필살기가 가던 대상 바로 앞 (쓰던 쪽에서 85% — 구 · 줄기는 대상까지 거의 다 가 있음) · 모르면 가운데
            const f = spec.by === 'me' ? 0.85 : spec.by === 'foe' ? 0.15 : 0.5;
            const ax = (ra.left + ra.right) / 2;
            const ay = (ra.top + ra.bottom) / 2;
            const mx = ax + ((rb.left + rb.right) / 2 - ax) * f;
            const my = ay + ((rb.top + rb.bottom) / 2 - ay) * f;
            const S = Math.max(2, Math.round(ra.width / (a.size || 32)));
            const cols = sigPal(spec.typeA || 'normal');
            sigRing(mx, my, S, 4, Math.max(ra.width, 30) * 1.4, 1, 0.35, ['#ffffff', cols[1], cols[2]]);
            sigBurst(mx, my, S, [...cols, '#ffffff'], 28, 150);
            ultShake(2, 160);
        } catch (err) {
            ultError('team duel meet', err);
        }
        return { meetMs: Math.round(spec.leadMs ?? 1100) };
    },
    teamDuelJoin(side, type) {
        const d = fxGame && fxGame.duel33;
        if (d) {
            d.st[side === 'a' ? 'joinA' : 'joinB'] += 1;
            // 합류한 동료 색 — 그쪽 줄기에 나선 (2:1 · 3:1 에서 동료 몫이 안 보이던 것)
            (d.st[side === 'a' ? 'typesA' : 'typesB'] ||= []).push(type || 'normal');
        }
    },
    teamDuelWin(who) {
        const d = fxGame && fxGame.duel33;
        if (d) {
            d.st.win = who;
        }
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
    /** 1:1 힘겨루기에 동료 합류 (#116 3:3 힘겨루기 장면) — 합류 목록만 적음 (D.joins.a · b = { type, at }) · 섞임 · 굵기 그림은 디자인 #116 (design-system "3:3 힘겨루기") 이 이 목록을 읽어 그림 */
    duelJoin(side, type, who) {
        const D = fxGame && fxGame.duel && fxGame.duel.D;
        if (!D) {
            return;
        }
        // 동료 몸 가운데 — 별이 여기서 줄기 뿌리로 날아감 (디자인 #116 · 상자 안이면 상자 기준)
        const r = who ? (who.box || who.el).getBoundingClientRect() : null;
        const from = r && r.width > 0 ? { x: r.left + r.width / 2 - (moveFrame ? moveFrame.x : 0), y: r.top + r.height * 0.45 - (moveFrame ? moveFrame.y : 0) } : undefined;
        (D.joins ||= { a: [], b: [] })[side === 'a' ? 'a' : 'b'].push({ type: type || 'normal', at: D.t || 0, ...(from ? { from } : {}), ...(who && who.name ? { name: who.name } : {}) });
    },
    /** 힘대결이 끝남 — soft = 터지는 여운까지 그리고 정리 (전투가 이어질 때), 아니면 바로 */
    stopDuel(soft) {
        // 3:3 힘겨루기 줄기 — 그 입자만 끝냄
        if (fxGame && fxGame.duel33) {
            fxGame.duel33.p.max = fxGame.duel33.p.life;
        }
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
    fadeUlt(ms, steps = 3) {
        const g = fxGame;
        if (!g || typeof moveCanvas === 'undefined' || !moveCanvas) {
            return;
        }
        const c = moveCanvas;
        c.style.transition = `opacity ${ms}ms steps(${steps}, end)`;
        c.style.opacity = '0';
        setTimeout(() => {
            // 그사이 새 필살기 · 대결이 시작했으면 그건 두고 캔버스만 다시 보이게
            if (fxGame === g) {
                window.pokemonFx.stopUlt();
            } else if (!fxGame) {
                moveEmitters.length = 0;
                moveParticles.length = 0;
            }
            // 캔버스를 비우고 되돌림 — 마지막 장이 다음 그리기 전에 한 장면 진하게 다시 보이던 것 (1860 — #80 다시 찍기)
            if (!fxGame) {
                const cx = c.getContext('2d');
                cx.save();
                cx.setTransform(1, 0, 0, 1, 0, 0);
                cx.clearRect(0, 0, c.width, c.height);
                cx.restore();
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
    hitStop(ms = 80, all) {
        // 3:3 은 6마리가 겹쳐 맞으니 전체 멈춤은 마지막 한 방 (all) 과 필살기 · 대결 중에만 — 맞은 포켓몬만 멈추는 것은 게임 쪽 (fx/team knock)
        if (fxAway || (fxTeamQuiet() && !all)) {
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
            // 3:3 은 0.7배 (보통 공격 장면에 큰 효과가 둘 — 아트 디렉터 #95 3바퀴 ④)
            fxWithTimers(fxMoveGen, () => hitKO(sigGeometry(fxActor(dst), !!dst.left), fxTeamOn() ? 0.7 : 1));
        });
    },
    /** 완벽 패링 — 쳐내기 (2026-10-20 태현 님 그림 docs: 날아온 줄이 내 포켓몬 앞에서 위쪽 대각선으로 튕겨 나감).
     *  dst = 막은 쪽 (내 포켓몬) · src = 친 쪽 · type = 기술 타입 · kind = 연출 틀 (fx.plan().fx) — 광선은 위로 꺾여 흩어지고, 날아오는 것은 회전하며 튕겨 나감, 하늘 · 땅 · 둘레 기술은 휙 피함 */
    swat(dst, src, type, kind, quick) {
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
                swatUp(g, x0, y0, cols, !!quick);
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
                    // 하얀 실루엣이 옛 ↔ 새 로 일정하게 (EVO_FLIP_HZ · 끝 10% 는 새 모습) · 바뀔 때마다 부풀었다 줄어듦
                    const flips = (L - T0) * EVO_FLIP_HZ;
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
    /** 3:3 — 쏜 기술 하나만 멈춤 (기술 힘겨루기에 들어감 · 쏜 포켓몬이 쓰러짐). soft = 남은 입자는 0.12초에 사라짐, 아니면 바로 */
    stopMove(tag, soft) {
        const gen = fxTagGen.get(tag);
        if (gen === undefined) {
            return;
        }
        fxTagGen.delete(tag);
        fxTagged.delete(gen);
        fxMoveTagged.delete(gen);
        fxKill(gen);
        for (let i = moveEmitters.length - 1; i >= 0; i--) {
            if (moveEmitters[i]._g === gen) {
                moveEmitters.splice(i, 1);
            }
        }
        for (let i = moveParticles.length - 1; i >= 0; i--) {
            const q = moveParticles[i];
            if (q._g !== gen) {
                continue;
            }
            if (soft && typeof q.max === 'number') {
                q.max = Math.min(q.max, q.life + 0.12);
            } else {
                moveParticles.splice(i, 1);
            }
        }
    },
    /** 3:3 모드 켜고 끄기 — 켜면 기술은 패널 번쩍 · 흔들기 · 전체 멈춤 없이 (1.5초 뒤 저절로 꺼짐 — 게임이 상태마다 다시 켬) */
    /** 보이는 몸 위 끝 (화면 px — POKEMON_SHAPE) · 모르면 null (3:3 달려가기 끝자리) */
    shapeTop(q) {
        const b = fxShapeBox(q);
        return b ? b.top : null;
    },
    team(on) {
        fxTeamUntil = on ? fxRealNow() + 1500 : 0;
        if (on) {
            fxHoldForeground();
        }
    },
    /** 남은 연출을 지움 — 전투가 갑자기 끝나거나 화면이 바뀔 때 */
    clear() {
        fxGameStop(true);
        fxKill(fxMoveGen);
        fxDeadBelow = fxGen;
        fxTagged.clear();
        fxMoveTagged.clear();
        fxTagGen.clear();
        fxMoveGen = ++fxGen;
        moveEmitters.length = 0;
        moveParticles.length = 0;
    },
};
