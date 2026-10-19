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

window.pokemonFx = {
    version: 2,
    /** 그 기술의 연출 — { fx: 틀 이름, ms: 걸리는 시간, contact: 몸으로 닿는지 } · 없으면 null (게임은 그 기술을 예전 모양으로) */
    plan(form, m) {
        const p = fxPlan(form, m);
        return p && { fx: p.sig[1], ms: p.ms, contact: FX_CONTACT.has(p.sig[1]) };
    },
    /** 기술을 지금 씀 — 쏘는 기술은 입에서 · 닿는 기술은 몸 앞에서 (box 를 달려든 몸으로 주면 상대 바로 앞). 그린 시간 (ms), 못 그리면 0.
     *  reach = 입에서 상대까지 px — 뿜기 (breath: 불꽃세례 · 화염방사 · 독가스 …) 는 일반 모드에선 입 앞에서만 피어서, 전투에선 상대까지 닿게 빠르기를 키움
     *  form = 기술 모양을 고를 포켓몬 (닿는 기술 자국을 맞는 쪽에 그릴 때 쓰는 쪽 모양 그대로 — 없으면 src) */
    move(src, m, reach, form) {
        const p = fxPlan(form || src.form, m);
        if (!p || fxWidth(src) < 1) {
            return 0;
        }
        if (p.sig[1] === 'dash') {
            return p.ms; // 몸통박치기 — 몸이 달려드는 것이 연출 (게임 pg-lunge), 닿을 때 impact
        }
        const A = fxActor(src);
        const ok = safeFx({}, () => fxWithTimers(fxMoveGen, () => {
            const g = sigGeometry(A, !!src.left);
            let o = p.o;
            if (p.sig[1] === 'breath' && reach > 0) {
                // 입자 한 알이 가는 거리 ≈ 12 × 배율 × (1 + 0.8 × 세기) px (끌림 때문에 생각보다 짧음, 사진으로 잼) — 상대까지 닿게 (1 ~ 8배)
                const k = Math.min(8, Math.max(1, reach / (12 * g.s * (1 + 0.8 * g.P))));
                o = { ...o, speed: (o.speed ?? 1) * k };
            }
            p.T.run(g, o, p.ms, A);
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
    /** 맞는 곳에 번쩍 — dst = 맞는 포켓몬 spec, type = 기술 타입 (게임), big = 세게 */
    impact(dst, type, big) {
        const r = (dst.box || dst.el).getBoundingClientRect();
        if (!r.width) {
            return;
        }
        const s = r.width / (dst.size || 32);
        const P = (POKEMON_SHAPE[dst.form] || [0.5])[0];
        safeFx({}, () => sigImpact(r.left + r.width / 2, r.top + r.height * 0.55, s, sigPal(FX_TYPE_PAL[type] || 'normal'), P, !!big));
    },
    /** 필살기 — 일반 모드처럼 번쩍 · 어두워짐 · 컷인 · 큰 글씨 · 그 포켓몬의 필살기 (전용 연출 포함). 상대 = dst. 걸리는 시간 (ms), 못 쓰면 0 */
    ult(src, dst) {
        fxGameStop(true);
        if (!POKEMON_SHAPE[src.form] || ultActive || fxWidth(src) < 1 || fxWidth(dst) < 1) {
            return 0;
        }
        let entry = ultEntry(src.form);
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
        fxGame = { A, B, gen, tick: setInterval(fxGameTick, 100) };
        let total = 0;
        try {
            total = fxWithTimers(gen, () => useUltimate(A, entry)) || 0;
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
    /** 쓰는 중인 필살기를 멈춤 (맞받아치기 · 전투 끝) — 몸 자리 · 그림 · 어둠을 되돌림 */
    stopUlt() {
        const was = !!fxGame;
        fxGameStop(true);
        if (was) {
            moveEmitters.length = 0;
            moveParticles.length = 0;
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
