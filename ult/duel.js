
// ───── 필살기 대결 — 서로의 고유 필살기가 가운데서 맞부딪힘 (설계 · 약속은 ult/SPEC.md "필살기 대결") ─────
// core.js 의 ultClash 가 VS 연출 뒤에 duelStart 를 부름. 필살기 틀을 DUEL_KIND 로 묶고, 종류마다 DUEL_FX[종류] 가 모양을 그림 (ult/duel-*.js)
// 흐름: 모으기 → 각자 필살기 모양으로 앞으로 → 둘 다 닿으면 밀고 밀림 → 센 쪽이 뚫고 나가 진 쪽에서 그 필살기로 터짐 / 무승부면 가운데 대폭발
const DUEL_FX = {};
const DUEL_KIND = {
    ultbeam: 'beam', ultvolt: 'bolt', ultthunder: 'bolt', ultorb: 'orb', ultblackhole: 'orb', ultnova: 'dome',
    ultquake: 'ground', ultpillar: 'ground', ultbloom: 'ground', ultvortex: 'tornado', ultstorm: 'storm', ultskyfall: 'meteor',
    ultswarm: 'swarm', ultrush: 'rush', ultdive: 'rush', ultbarrage: 'rush', ultpsy: 'wave', ultshadow: 'wave',
};
const duelKind = (fx, o = {}) => (fx === 'ultsparkle' ? (o.mode === 'moon' ? 'orb' : 'swarm') : DUEL_KIND[fx] || 'beam');
// 앞으로 나가는 빠르기 (px/초) — 광선 · 번개는 순식간, 몸 · 회오리는 천천히
const DUEL_SPEED = { beam: 2600, bolt: 3200, orb: 900, dome: 1100, ground: 1000, tornado: 650, storm: 900, meteor: 1000, swarm: 1300, rush: 800, wave: 1100 };
const DUEL_CHARGE = 0.7; // 모으기
const DUEL_SEC = 3.6; // 밀고 밀리기
const DUEL_THROUGH = 0.4; // 이긴 쪽이 뚫고 나가는 시간
const DUEL_AFTER = 1.5; // 터진 뒤 여운
const DUEL_DRAW = 0.25; // 무승부 확률

// 대결 준비 — 위치 · 높이 · 승패 · 시간표 (VS 연출 전에, 시간을 알아야 해서)
// force = 'a' | 'b' | 'draw' 면 승패를 정함 (점검용)
function duelPlan(a, ultA, leftA, b, ultB, leftB, force) {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const side = (p, ult, left) => {
        const [name, fx, o = {}] = ult;
        const g = sigGeometry(p, left);
        const rect = p.collision.getBoundingClientRect();
        const S = Math.max(2, Math.round(g.s));
        return {
            p, name, fx, o, kind: duelKind(fx, o), cols: ultCols(o, fx), dir: g.dir, left, s: g.s, S, P: g.P, g,
            body: g.body, w: g.w, h: g.h, mouth: g.mouth,
            ground: Math.min(H, rect.bottom + Math.max(0, p.bottom - p.floor)),
            x0: g.body.front + g.dir * Math.max(2 * S, g.w * 0.1), // 필살기가 나가기 시작하는 곳 (몸 앞)
            front: 0, fade: 1, pushing: 0, pa: 0, st: {},
        };
    };
    const A = side(a, ultA, leftA);
    const B = side(b, ultB, leftB);
    const ground = Math.max(A.ground, B.ground);
    const lane = ultClamp(H * 0.09, 10, 34); // 맞부딪히는 줄의 반 굵기 기준
    const y0 = ultClamp(Math.min(A.mouth.y, B.mouth.y), H * 0.3, ground - lane * 1.7); // 맞부딪히는 높이 — 바닥에 잘리지 않게
    A.front = A.x0;
    B.front = B.x0;
    A.y0 = y0;
    B.y0 = y0;
    A.ground = ground;
    B.ground = ground;
    const mid = (A.x0 + B.x0) / 2;
    const half = Math.abs(B.x0 - A.x0) / 2;
    const arrive = (X) => DUEL_CHARGE + half / DUEL_SPEED[X.kind];
    const tm = Math.max(arrive(A), arrive(B));
    const tO = tm + DUEL_SEC;
    const draw = force ? force === 'draw' : Math.random() < DUEL_DRAW;
    const winner = draw ? null : force ? (force === 'a' ? A : B) : Math.random() < Math.min(0.85, Math.max(0.15, 0.5 + (A.P - B.P) * 1.2)) ? A : B;
    const loser = winner ? (winner === A ? B : A) : null;
    // 밀고 밀리기 — 0.9초쯤마다 한쪽이 밀어붙임, 마지막은 이길 쪽으로 (무승부면 가운데로)
    const n = Math.max(3, Math.round(DUEL_SEC / 0.9));
    const pushes = [];
    let sgn = Math.random() < 0.5 ? 1 : -1;
    for (let i = 0; i < n; i++) {
        pushes.push(i === n - 1 ? (winner ? (winner === A ? 0.55 : -0.55) : moveRand(-0.06, 0.06)) : sgn * moveRand(0.22, 0.45));
        sgn = -sgn;
    }
    const total = tO + (winner ? DUEL_THROUGH : 0) + DUEL_AFTER;
    return { A, B, W, H, ground, lane, y0, mid, half, tm, tO, n, pushes, winner, loser, draw, total, S: Math.max(A.S, B.S), t: 0, phase: 'charge', xm: mid, ym: y0, climax: 0, seg: -1, blobR: duelBlobR(lane, 0) };
}

// 만나는 곳 빛 덩어리 반지름 (바깥 가장자리) — 양쪽 앞머리가 보이게 줄 굵기 정도로
function duelBlobR(lane, climax) {
    return lane * 0.8 * (1 + 0.35 * climax) * 1.45;
}

const duelSmooth = (f) => f * f * (3 - 2 * f);
// 밀고 밀리기 구간 — 몇 번째 구간, 그 안 진행, 시작 · 끝 위치
function duelSeg(D, t) {
    const u = Math.min(0.9999, Math.max(0, (t - D.tm) / DUEL_SEC)) * D.n;
    const k = Math.floor(u);
    return { k, f: u - k, from: k ? D.pushes[k - 1] : 0, to: D.pushes[k] };
}
// 만나는 곳 (A 기준 -1 ~ +1, +1 이면 B 쪽 끝까지 밀어붙임)
function duelShift(D, t) {
    if (t < D.tO) {
        const { f, from, to } = duelSeg(D, t);
        return from + (to - from) * duelSmooth(f) + 0.02 * Math.sin(t * 5);
    }
    return D.pushes[D.n - 1];
}

// 맞부딪히는 곳 — 두 색이 섞인 빛 덩어리 · 가시 · 번개 · 튀는 에너지 (크기는 줄 굵기 기준이라 패널을 덮지 않음)
function duelContactDraw(ctx, px, D) {
    const { A, B, S, lane } = D;
    const t = D.t;
    const strong = D.pushDir < 0 ? B : A;
    const weak = strong === A ? B : A;
    const c = D.climax;
    const r = lane * 0.8 * (1 + 0.35 * c) * (1 + 0.08 * Math.sin(t * 22));
    for (const [m, col, a0] of [[1.45, strong.cols[2], 0.85], [1.1, weak.cols[1], 1], [0.7, '#ffffff', 1]]) {
        ctx.globalAlpha = a0;
        sigDisc(ctx, px, S, D.xm, D.ym, r * m, col);
    }
    ctx.globalAlpha = 0.9;
    const spikes = 10;
    for (let j = 0; j < spikes; j++) {
        const an = t * 1.4 + (j * Math.PI * 2) / spikes;
        const len = r * (2 + 0.5 * Math.sin(t * 7 + j * 1.7)) * (1 + 0.4 * c);
        for (let d = r * 1.3; d < len; d += S) {
            dotAt(ctx, px, S, D.xm + Math.cos(an) * d, D.ym + Math.sin(an) * d, d < len * 0.7 ? '#ffffff' : (j % 2 ? A : B).cols[1]);
        }
    }
    ctx.globalAlpha = 1;
    (D.arcs || []).forEach((arc) => zapLine(ctx, px, S, arc.path, arc.w, strong.cols[1]));
}

// 솟구친 에너지 — 포물선으로 떨어져 바닥에서 톡
function duelSplash(D, up) {
    const { S, ground } = D;
    const cols = [...D.A.cols, ...D.B.cols, '#ffffff'];
    const an = up ? moveRand(-Math.PI * 0.85, -Math.PI * 0.15) : moveRand(0, Math.PI * 2);
    const sp = moveRand(60, up ? 230 : 140) * (S / 2);
    sigParticle({ x: D.xm, y: D.ym, s: S, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, g: 260 * (S / 2), drag: 0.6, max: 1.6, color: movePick(cols), size: movePick([1, 1, 2]),
        update: (q) => {
            if (q.y >= ground && q.vy > 0) {
                q.life = q.max;
                sigBurst(q.x, ground - S, S, [q.color, '#ffffff'], 3, 30);
            }
        },
        draw: (ctx, q, t, px) => {
            ctx.globalAlpha = 1;
            dotAt(ctx, px, S, q.x, q.y, q.color, q.size, q.size);
            ctx.globalAlpha = 0.4;
            dotAt(ctx, px, S, q.x - q.vx * 0.025, q.y - q.vy * 0.025, q.color, q.size, q.size);
        },
    });
}

// 펑 — 번쩍 · 흔들림 · 고리 · 조각 (big 이면 화면 끝까지)
function duelBoom(D, x, y, cols, big) {
    const { S, lane } = D;
    screenFlash(S, big ? 0.65 : 0.4, '#ffffff', big ? 0.4 : 0.25);
    ultShake(big ? 9 : 4, big ? 900 : 350);
    sigRing(x, y, S, 2 * S, lane * (big ? 6 : 3.5), 1, 0.5, [cols[0], '#ffffff']);
    setTimeout(() => sigRing(x, y, S, 2 * S, big ? Math.hypot(D.W, D.H) : lane * 5, 0.7, big ? 0.85 : 0.55, [cols[1], cols[2], '#ffffff']), 90);
    sigBurst(x, y, S, [...cols, '#ffffff'], big ? 60 : 30, big ? 300 : 180);
}

// 그림 대신 캔버스에 포켓몬을 그림 (몸으로 부딪히는 필살기 — 진짜 그림은 duelHide 로 숨김). bottom = 발 높이, rot = 도, scale, alpha, tint
function duelPuppet(ctx, X, cx, bottom, opt = {}) {
    const img = X.p.el;
    if (!img.naturalWidth) {
        return;
    }
    const w = X.w * (opt.scale ?? 1);
    const h = w * (img.naturalHeight / img.naturalWidth);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = opt.alpha ?? 1;
    if (X.o.tint) {
        ctx.filter = X.o.tint;
    }
    ctx.translate(Math.round(cx), Math.round(bottom - h / 2));
    if (opt.rot) {
        ctx.rotate((opt.rot * Math.PI) / 180);
    }
    if (ultFlip(img, X.left)) {
        ctx.scale(-1, 1);
    }
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
}
function duelHide(X, on) {
    X.p.el.style.visibility = on ? 'hidden' : '';
}

// 기본 모으기 — 빛 알갱이가 x0 · y0 로 빨려 듦 (모양에 charge 가 없을 때)
function duelGather(D, X, k, dt) {
    X.st.gacc = (X.st.gacc ?? 0) + dt * (50 + 120 * k);
    while (X.st.gacc >= 1) {
        X.st.gacc -= 1;
        const a = moveRand(0, Math.PI * 2);
        const r = D.lane * moveRand(1.6, 3);
        const x0 = X.x0 + Math.cos(a) * r;
        const y0 = X.y0 + Math.sin(a) * r * 0.8;
        sigParticle({ x: x0, y: y0, x0, y0, s: X.S, max: moveRand(0.2, 0.3), color: movePick(X.cols),
            update: (q) => {
                const f = Math.min(1, (q.life / q.max) ** 2);
                q.x = q.x0 + (X.x0 - q.x0) * f;
                q.y = q.y0 + (X.y0 - q.y0) * f;
            },
            draw: DRAW.dot,
        });
    }
}

// 종류 모양이 아직 없을 때 대신 — 필살기 색의 기운 줄기
DUEL_FX._stream = {
    draw: (ctx, px, D, X) => {
        const len = Math.abs(X.front - X.x0);
        if (len < 1) {
            return;
        }
        const S = X.S;
        const seg = 2 * S;
        for (const [k, col, a0] of [[1.3, X.cols[3], 0.35], [1, X.cols[2], 0.9], [0.7, X.cols[1], 1], [0.4, X.cols[0], 1]]) {
            ctx.globalAlpha = a0 * X.fade;
            ctx.fillStyle = col;
            const th = Math.max(S, Math.round(D.lane * k * (1 + 0.25 * X.pa)));
            for (let d = 0; d < len; d += seg) {
                ctx.fillRect(px(X.dir > 0 ? X.x0 + d : X.x0 - d - seg), px(X.y0 - th / 2), seg, th);
            }
        }
    },
};

// 시작 — 0.05초마다 front · 만나는 곳을 정하고 종류 모양을 그림
function duelStart(D) {
    const { A, B, S } = D;
    const sides = [A, B];
    const fx = (X) => DUEL_FX[X.kind] || DUEL_FX._stream;
    const call = (X, name, ...args) => {
        try {
            fx(X)[name]?.(...args);
        } catch (err) {
            ultError(`duel.${X.kind}.${name}`, err);
        }
    };
    const st = { acc: 0, nextArc: 0, nextBolt: 0, nextRing: 0, nextShake: 0, met: false, end: false, won: false, hits: 0 };
    D.arcs = [];
    D.pushDir = 0;
    const end = D.total;
    // 모양 (맨 밑 층 — 튀는 조각 · 불꽃이 그 위에 보이게)
    sigParticle({ x: 0, y: 0, s: S, max: end, z: -1,
        update: (q, dt) => {
            const t = q.life;
            D.t = t;
            // ── 시간표 ──
            if (t < DUEL_CHARGE) {
                D.phase = 'charge';
                for (const X of sides) {
                    X.front = X.x0;
                    if (fx(X).charge) {
                        call(X, 'charge', D, X, t / DUEL_CHARGE, dt);
                    } else {
                        duelGather(D, X, t / DUEL_CHARGE, dt);
                    }
                }
                return;
            }
            if (t < D.tm) {
                D.phase = 'go';
                for (const X of sides) {
                    X.front = X.x0 + X.dir * Math.min(D.half, DUEL_SPEED[X.kind] * (t - DUEL_CHARGE));
                }
            } else if (t < D.tO) {
                D.phase = 'push';
                const sh = duelShift(D, t);
                D.xm = D.mid + A.dir * D.half * sh;
                A.front = D.xm;
                B.front = D.xm;
                D.climax = Math.min(1, Math.max(0, ((t - D.tm) / DUEL_SEC - 0.72) / 0.28));
                D.blobR = duelBlobR(D.lane, D.climax);
                const { k, f, from, to } = duelSeg(D, t);
                D.pushDir = Math.sign(to - from);
                const pa = Math.sin(f * Math.PI);
                A.pushing = D.pushDir;
                B.pushing = -D.pushDir;
                A.pa = D.pushDir > 0 ? pa : 0;
                B.pa = D.pushDir < 0 ? pa : 0;
                if (!st.met) {
                    // 처음 맞부딪힘
                    st.met = true;
                    duelBoom(D, D.xm, D.ym, [...A.cols.slice(0, 2), ...B.cols.slice(0, 2)], false);
                    for (const X of sides) {
                        X.p.el.animate([{ translate: `-${S * 0.6}px 0` }, { translate: `${S * 0.6}px 0` }], { duration: 45, iterations: Math.round((DUEL_SEC * 1000) / 45), direction: 'alternate', composite: 'add' });
                    }
                }
                if (k !== D.seg) {
                    // 한쪽이 밀어붙이기 시작 — 고리 · 에너지가 확
                    D.seg = k;
                    sigRing(D.xm, D.ym, S, D.lane * 0.5, D.lane * (2.4 + D.climax), 1, 0.55, [A.cols[1], B.cols[1], '#ffffff']);
                    for (let j = 0; j < 12; j++) {
                        duelSplash(D, true);
                    }
                    ultShake(2 + 2 * D.climax, 300);
                    if (k > 0) {
                        screenFlash(S, 0.15, '#ffffff', 0.2);
                    }
                    for (const X of sides) {
                        call(X, 'push', D, X, X.pushing > 0);
                    }
                }
                // 계속 튀는 에너지 · 둘레 번개 · 땅에 꽂히는 번개 · 흔들림
                st.acc += dt * (16 + 40 * D.climax + 12 * pa);
                while (st.acc >= 1) {
                    st.acc -= 1;
                    duelSplash(D, Math.random() < 0.7);
                }
                if (t >= st.nextArc) {
                    st.nextArc = t + 0.16 - 0.08 * D.climax;
                    const an = moveRand(0, Math.PI * 2);
                    const rr = D.lane * moveRand(1.4, 2.4);
                    D.arcs.push({ until: t + 0.14, w: 1, path: zigzag(D.xm, D.ym, D.xm + Math.cos(an) * rr, D.ym + Math.sin(an) * rr, S, 2) });
                }
                if (t >= st.nextBolt && D.ground - D.ym > 6 * S) {
                    st.nextBolt = t + moveRand(0.45, 0.7) - 0.25 * D.climax;
                    const gx = D.xm + moveRand(-1.5, 1.5) * D.lane;
                    D.arcs.push({ until: t + 0.18, w: 2, path: zigzag(D.xm, D.ym, gx, D.ground, S, 3) });
                    sigBurst(gx, D.ground - S, S, [...A.cols.slice(0, 2), ...B.cols.slice(0, 2)], 8, 60);
                }
                if (t >= st.nextShake) {
                    st.nextShake = t + (D.climax > 0 ? 0.25 : 0.8);
                    ultShake(1.5 + 2.5 * D.climax, D.climax > 0 ? 200 : 300);
                }
            } else {
                // ── 결과 ──
                const k = Math.min(1, (t - D.tO) / DUEL_THROUGH);
                if (!st.end) {
                    st.end = true;
                    A.pushing = 0;
                    B.pushing = 0;
                    A.pa = 0;
                    B.pa = 0;
                    D.endXm = D.xm;
                    if (!D.winner) {
                        // 무승부 — 가운데서 대폭발, 둘 다 뒤로 벌러덩
                        D.phase = 'draw';
                        duelBoom(D, D.xm, D.ym, [...A.cols.slice(0, 2), ...B.cols.slice(0, 2), '#ffffff'], true);
                        for (let j = 0; j < 24; j++) {
                            duelSplash(D, true);
                        }
                        for (const X of sides) {
                            duelHide(X, false);
                            knockBack(X.p, X.left, -X.dir, spriteSize(X.p) * 0.8);
                        }
                        setTimeout(() => ultTitle('무승부!', '둘 다 쓰러졌다!', sigPal('silver'), 1.8), 200);
                    } else {
                        D.phase = 'through';
                    }
                }
                if (!D.winner) {
                    for (const X of sides) {
                        X.fade = Math.max(0, 1 - (t - D.tO) / 0.35);
                    }
                } else {
                    const Wn = D.winner;
                    const L = D.loser;
                    const target = L.body.cx;
                    const e = k * k;
                    Wn.front = D.endXm + (target - D.endXm) * e;
                    L.front = D.endXm + (L.x0 - D.endXm) * e;
                    L.fade = Math.max(0, 1 - k * 1.2);
                    if (k >= 1 && !st.won) {
                        // 뚫고 나가 진 쪽에서 터짐 — 이긴 쪽 필살기 모양으로
                        st.won = true;
                        D.phase = 'after';
                        call(Wn, 'win', D, Wn, L);
                        duelBoom(D, L.body.cx, L.body.cy, Wn.cols, true);
                        duelHide(L, false);
                        knockBack(L.p, L.left, -L.dir, spriteSize(L.p) * 1.4);
                        // 둘 사이에 있던 구경꾼도 휩쓸림
                        const lo = Math.min(A.x0, B.x0);
                        const hi = Math.max(A.x0, B.x0);
                        ultOthers(A.p).forEach((o) => o.pokemon !== B.p && o.x > lo && o.x < hi && ultHit(o, Wn.dir, 'tumble'));
                        setTimeout(() => ultTitle('효과는 굉장했다!', `${Wn.p.name}의 ${Wn.name}!`, null, 1.8), 150);
                    }
                    if (st.won) {
                        Wn.fade = Math.max(0, 1 - (t - D.tO - DUEL_THROUGH - 0.5) / 0.6);
                    }
                }
            }
            for (const X of sides) {
                if (X.fade > 0.01) {
                    call(X, 'tick', D, X, dt);
                }
            }
            D.arcs = D.arcs.filter((arc) => arc.until > t);
        },
        draw: (ctx, q, t, px) => {
            for (const X of sides) {
                if (X.fade > 0.01 && D.phase !== 'charge') {
                    call(X, 'draw', ctx, px, D, X);
                    ctx.globalAlpha = 1;
                    ctx.globalCompositeOperation = 'source-over';
                }
            }
        },
    });
    // 맞부딪히는 곳 (맨 위 층)
    sigParticle({ x: 0, y: 0, s: S, max: end, z: 1, draw: (ctx, q, t, px) => {
        if (D.phase === 'push' || (D.phase === 'through' && D.t - D.tO < DUEL_THROUGH * 0.6)) {
            duelContactDraw(ctx, px, D);
        }
    } });
}
