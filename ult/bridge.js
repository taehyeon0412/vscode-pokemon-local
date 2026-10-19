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
function fxActor(spec) {
    const box = () => spec.box || spec.el;
    return {
        el: spec.el,
        collision: box(),
        label: spec.form,
        name: spec.name || '',
        _originalSpriteSize: spec.size || 32,
        _size: 'game',
        calculateSpriteWidth: () => box().getBoundingClientRect().width,
        get left() {
            return box().getBoundingClientRect().left;
        },
        bottom: 0,
        floor: 0,
        positionLeft() {},
        positionBottom() {},
        currentState: { horizontalDirection: spec.left ? 1 : 0, nextFrame: () => 0 },
        hideSpeechBubble() {},
        canSwipe: true,
        speed: 1,
        pokemonRoot: '',
    };
}

function fxPlan(form, m) {
    if (!POKEMON_SHAPE[form] || !m || !m.name) {
        return null;
    }
    const sig = gameMoveEntry(form, m);
    const T = sig && SIG_FX[sig[1]];
    if (!T) {
        return null;
    }
    const o = sig[2] || {};
    return { sig, T, o, ms: Math.round(T.ms(POKEMON_SHAPE[form][0], o)) };
}

window.pokemonFx = {
    version: 1,
    /** 그 기술의 연출 — { fx: 틀 이름, ms: 걸리는 시간, contact: 몸으로 닿는지 } · 없으면 null (게임은 그 기술을 예전 모양으로) */
    plan(form, m) {
        const p = fxPlan(form, m);
        return p && { fx: p.sig[1], ms: p.ms, contact: FX_CONTACT.has(p.sig[1]) };
    },
    /** 기술을 지금 씀 — 쏘는 기술은 입에서 · 닿는 기술은 몸 앞에서 (box 를 달려든 몸으로 주면 상대 바로 앞). 그린 시간 (ms), 못 그리면 0.
     *  reach = 입에서 상대까지 px — 뿜기 (breath: 불꽃세례 · 화염방사 · 독가스 …) 는 일반 모드에선 입 앞에서만 피어서, 전투에선 상대까지 닿게 빠르기를 키움 */
    move(src, m, reach) {
        const p = fxPlan(src.form, m);
        if (!p) {
            return 0;
        }
        if (p.sig[1] === 'dash') {
            return p.ms; // 몸통박치기 — 몸이 달려드는 것이 연출 (게임 pg-lunge), 닿을 때 impact
        }
        const A = fxActor(src);
        const ok = safeFx({}, () => {
            const g = sigGeometry(A, !!src.left);
            let o = p.o;
            if (p.sig[1] === 'breath' && reach > 0) {
                // 입자 한 알이 가는 거리 ≈ 12 × 배율 × (1 + 0.8 × 세기) px (끌림 때문에 생각보다 짧음, 사진으로 잼) — 상대까지 닿게 (1 ~ 8배)
                const k = Math.min(8, Math.max(1, reach / (12 * g.s * (1 + 0.8 * g.P))));
                o = { ...o, speed: (o.speed ?? 1) * k };
            }
            p.T.run(g, o, p.ms, A);
        });
        return ok ? p.ms : 0;
    },
    /** 틀 하나를 그 자리에서 (방어 = shield · 회복 = glow · 잠 = zzz …) — o 는 SIG_FX 옵션 */
    cast(src, fx, o) {
        const T = SIG_FX[fx];
        if (!T || !POKEMON_SHAPE[src.form]) {
            return 0;
        }
        const opts = o || {};
        const ms = Math.round(T.ms(POKEMON_SHAPE[src.form][0], opts));
        const A = fxActor(src);
        return safeFx({}, () => T.run(sigGeometry(A, !!src.left), opts, ms, A)) ? ms : 0;
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
    /** 남은 연출을 지움 — 전투가 갑자기 끝나거나 화면이 바뀔 때 */
    clear() {
        moveEmitters.length = 0;
        moveParticles.length = 0;
    },
};
