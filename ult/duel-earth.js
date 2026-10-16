
// ───── 필살기 대결 모양 — 땅 · 하늘: ground · tornado · storm · meteor (약속은 ult/SPEC.md "필살기 대결") ─────
// ground = ultquake 갈라짐 · 바위 가시 / ultpillar 기둥 / ultbloom 꽃밭 · 덩굴, tornado = ultvortex 회오리, storm = ultstorm 날씨 벽, meteor = ultskyfall 낙하
// 원래 필살기(ult/fx-earth.js · fx-sky.js)의 색 · 옵션 · 모양 그대로 X.x0 에서 X.front 까지 — 앞머리는 D.ym 높이에서 상대와 맞닿고, 땅(D.ground) 아래로는 안 그림
// 상태는 X.st, 시간은 D.t. 그리기는 칸(Z) 단위 네모로만
(() => {
    const TAU = Math.PI * 2;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const k01 = (v) => clamp(v, 0, 1);
    const lerp = (a, b, k) => a + (b - a) * k;
    const easeOut = (k) => 1 - (1 - k01(k)) ** 3;
    const easeIn = (k) => k01(k) ** 2;
    const smooth = (k) => {
        const v = k01(k);
        return v * v * (3 - 2 * v);
    };
    // 번호로 정하는 가짜 난수 0~1 — 그때그때 계산 (입자를 안 만듦)
    const hash = (i, k = 0) => {
        const v = Math.sin(i * 127.1 + k * 311.7 + 7.13) * 43758.5453;
        return v - Math.floor(v);
    };
    const wrap = (v, span, off = 0) => ((((v - off) % span) + span) % span) + off;
    const rnd = moveRand;
    const pick = movePick;
    const power = (P) => 0.4 + 0.6 * clamp(Number(P) || 0, 0, 1);
    const LIVE_MAX = 1100; // 살아 있는 입자가 이만큼이면 더 안 만듦 (엔진 · 상대 몫을 남김)
    const room = (n = 1) => moveParticles.length + n <= LIVE_MAX;
    let fails = 0;
    const fail = (where, err) => {
        if (fails++ < 8) {
            ultError(`duel-earth ${where}`, err);
        }
    };
    const reach = (X) => Math.max(0, (X.front - X.x0) * X.dir);
    const along = (X, d) => X.x0 + X.dir * d;
    // 계속 뿌려도 되는 때 — 진 쪽이 사라지는 중 · 이긴 뒤 · 무승부엔 그만
    const live = (D, X) => X.fade > 0.6 && !X.st.won && D.phase !== 'draw';
    // 한쪽 공통 상태 — 점 크기 · 세기 · 땅 · 앞머리 높이
    function base(D, X) {
        const st = X.st;
        if (!st.base) {
            st.base = true;
            st.Z = Math.max(D.S, Math.round(Math.min(D.W, D.H * 1.5) / 160));
            st.P = power(X.P);
            st.G = D.ground;
            st.hRef = Math.max(D.lane * 1.4, D.ground - D.ym); // 땅에서 맞부딪히는 높이까지
            st.seed = rnd(0, 1000);
            st.acc = [0, 0, 0, 0, 0];
        }
        return st;
    }
    // 초당 rate 번 fn
    function every(st, i, dt, rate, fn) {
        st.acc[i] += dt * Math.max(0, rate);
        for (let n = 0; st.acc[i] >= 1 && n < 12; n++) {
            st.acc[i] -= 1;
            fn();
        }
        st.acc[i] = Math.min(st.acc[i], 1);
    }

    // ── 그리기 도구 (그리는 동안만 — C · Z · FA 는 지금 ctx · 점 크기 · 사라짐) ──
    let C;
    let Z = 2;
    let FA = 1;
    const sn = (v) => Math.round(v / Z) * Z;
    const alpha = (a) => {
        C.globalAlpha = k01(a) * FA;
    };
    const fill = (x0, y0, x1, y1, col) => {
        if (x1 < x0) {
            [x0, x1] = [x1, x0];
        }
        const a = sn(x0);
        const b = sn(y0);
        C.fillStyle = col;
        C.fillRect(a, b, Math.max(Z, sn(x1) - a), Math.max(Z, sn(y1) - b));
    };
    const dot = (x, y, col, w = 1, h = w) => {
        C.fillStyle = col;
        C.fillRect(sn(x), sn(y), w * Z, h * Z);
    };
    // 꽉 찬 타원 (칸 단위 가로줄)
    const disc = (x, y, rx, ry, col) => {
        if (!(rx > 0 && ry > 0)) {
            return;
        }
        C.fillStyle = col;
        for (let dy = -ry; dy <= ry; dy += Z) {
            const half = rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2));
            if (half < Z * 0.4) {
                continue;
            }
            const a = sn(x - half);
            C.fillRect(a, sn(y + dy), Math.max(Z, sn(x + half) - a), Z);
        }
    };
    // 점 고리 (납작한 타원)
    const ring = (x, y, rx, ry, n, rot, colA, colB) => {
        for (let i = 0; i < n; i++) {
            const a = rot + (i / n) * TAU;
            dot(x + Math.cos(a) * rx, y + Math.sin(a) * ry, i % 2 ? colB : colA);
        }
    };
    // 점 줄 (굵기 th 칸)
    const line = (x0, y0, x1, y1, col, th = 1) => {
        const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / Z));
        const o = ((th - 1) * Z) / 2;
        C.fillStyle = col;
        for (let i = 0; i <= n; i++) {
            C.fillRect(sn(x0 + ((x1 - x0) * i) / n - o), sn(y0 + ((y1 - y0) * i) / n - o), th * Z, th * Z);
        }
    };
    // 그리기 — 땅(floor) 아래는 잘라 내고, 끝나면 ctx 상태를 꼭 되돌림
    function paint(ctx, z, fa, floor, fn) {
        ctx.save();
        try {
            ctx.beginPath();
            ctx.rect(-100, -100, window.innerWidth + 200, Math.floor(floor) + 100);
            ctx.clip();
            C = ctx;
            Z = z;
            FA = k01(fa);
            fn();
        } finally {
            ctx.restore();
        }
    }
    // 마무리 그림 하나 (win 등) — 오류가 나도 그 그림만 사라짐
    function art(max, z, floor, draw, update) {
        sigParticle({ x: 0, y: 0, s: z, max,
            update: (p, dt) => {
                if (!update) {
                    return;
                }
                try {
                    update(p.life, dt);
                } catch (err) {
                    p.life = p.max;
                    fail('art', err);
                }
            },
            draw: (ctx, p) => {
                try {
                    paint(ctx, z, 1, floor, () => draw(p.life));
                } catch (err) {
                    p.life = p.max;
                    fail('art', err);
                }
            } });
    }

    // ── 입자 부품 (살아 있는 입자가 많으면 안 만듦) ──
    const swayUpd = (p, dt) => {
        p.x += Math.sin(p.phase + p.life * p.w) * p.sway * dt;
    };
    const drawBlock = (ctx, p, t, px) => {
        ctx.globalAlpha = t > 0.8 ? (1 - t) / 0.2 : 1;
        dotAt(ctx, px, p.s, p.x, p.y, p.color, p.size, p.size);
        if (p.hi && p.size > 1) {
            dotAt(ctx, px, p.s, p.x, p.y, p.hi, p.size - 1, 1);
        }
    };
    // 날아가 떨어지는 조각 — 땅(G)에 닿으면 사라짐 (pop 이면 톡)
    function chunk(x, y, s, vx, vy, grav, G, color, size = 1, hi, pop = false, max = 1.8) {
        if (!room()) {
            return;
        }
        sigParticle({ x, y, s, vx, vy, g: grav, drag: 0.25, max, color, size, hi, G, pop,
            update: (p) => {
                if (p.vy > 0 && p.y >= p.G - p.size * p.s) {
                    p.life = p.max;
                    if (p.pop && room(3)) {
                        sigBurst(p.x, p.G - p.s, p.s, [p.color, p.hi || p.color], 3, 22);
                    }
                }
            },
            draw: drawBlock });
    }
    // 먼지 — 퍼지며 옅어짐
    const drawPuff = (ctx, p, t, px) => {
        const n = Math.max(1, Math.round(p.size + t * p.grow));
        ctx.globalAlpha = p.a * (1 - t) * (1 - t);
        dotAt(ctx, px, p.s, p.x - ((n - 1) * p.s) / 2, p.y - ((n - 1) * p.s) / 2, p.color, n, n);
    };
    function puff(x, y, s, color, vx, vy, max = 0.9, grow = 3, a = 0.7, size = 1) {
        if (!room()) {
            return;
        }
        sigParticle({ x, y, s, vx, vy, g: -6 * s, drag: 2.2, max, color, size, grow, a, draw: drawPuff });
    }
    // 잎 · 꽃잎 — 뒤집히며 살랑
    const drawFlip = (ctx, p, t, px) => {
        const flat = Math.floor(p.life / p.flip + p.phase) % 2 === 0;
        ctx.globalAlpha = fadeInOut(t, 0.06, 0.3);
        dotAt(ctx, px, p.s, p.x, p.y, p.color, flat ? 2 * p.size : p.size, flat ? p.size : 2 * p.size);
        if (p.hi) {
            dotAt(ctx, px, p.s, p.x, p.y, p.hi, p.size, p.size);
        }
    };
    function flutter(x, y, s, color, vx, vy, max, { g = 40, drag = 1.2, size = 1, sway = 40, hi, flip = 0.09 } = {}) {
        if (!room()) {
            return;
        }
        sigParticle({ x, y, s, vx, vy, g, drag, max, color, size, hi, flip, sway, phase: rnd(0, TAU), w: rnd(5, 9), update: swayUpd, draw: drawFlip });
    }
    // 불똥 — 깜박이며 올라감
    const drawEmber = (ctx, p, t, px) => {
        ctx.globalAlpha = (t < 0.7 ? 1 : (1 - t) / 0.3) * (0.6 + 0.4 * Math.abs(Math.sin(p.life * 25 + p.phase)));
        dotAt(ctx, px, p.s, p.x, p.y, t < 0.5 ? p.color : p.c2, p.size, p.size);
    };
    function ember(x, y, s, color, c2, vx, vy, max, size = 1) {
        if (!room()) {
            return;
        }
        sigParticle({ x, y, s, vx, vy, g: -20 * s, drag: 1.6, max, color, c2: c2 || color, size, sway: 25, phase: rnd(0, TAU), w: rnd(4, 8), update: swayUpd, draw: drawEmber });
    }
    // 둥실 — 흔들리며 떠오르다 사라짐 (그림자 기운 · 물안개)
    const drawFloat = (ctx, p, t, px) => {
        ctx.globalAlpha = fadeInOut(t, 0.12, 0.45) * p.a;
        dotAt(ctx, px, p.s, p.x, p.y, p.color, p.size, p.size);
    };
    function float(x, y, s, color, vx, vy, max, size = 1, a = 0.9) {
        if (!room()) {
            return;
        }
        sigParticle({ x, y, s, vx, vy, g: 0, drag: 1.2, max, color, size, a, sway: 30, phase: rnd(0, TAU), w: rnd(3, 6), update: swayUpd, draw: drawFloat });
    }
    function sparkle(x, y, s, cols, vx, vy, max) {
        if (!room()) {
            return;
        }
        sigParticle({ x, y, s, vx, vy, drag: 1.5, max, cols, draw: DRAW.sparkle });
    }
    // 한 점으로 빨려 드는 빛
    function mote(x0, y0, x1, y1, s, color, max, size = 1) {
        if (!room()) {
            return;
        }
        sigParticle({ x: x0, y: y0, x0, y0, x1, y1, s, max, color, size,
            update: (p) => {
                const k = Math.min(1, (p.life / p.max) ** 2);
                p.x = p.x0 + (p.x1 - p.x0) * k;
                p.y = p.y0 + (p.y1 - p.y0) * k;
            },
            draw: (ctx, p, t, px) => {
                ctx.globalAlpha = Math.min(1, t * 4);
                dotAt(ctx, px, p.s, p.x, p.y, p.color, p.size, p.size);
            } });
    }
    // 솟는 불길
    function flames(x, y, s, cols, n, rise, spread = 6) {
        n = Math.min(Math.round(n), Math.max(0, LIVE_MAX - moveParticles.length));
        for (let i = 0; i < n; i++) {
            sigParticle({ x: x + rnd(-1, 1) * spread * s, y, s, vx: rnd(-0.15, 0.15) * rise, vy: -rnd(0.4, 1) * rise, drag: 2.4, max: rnd(0.35, 0.65), cols, grow: 2.5, smoke: true, draw: DRAW.stream });
        }
    }
    // 둥근 연기 덩이 — (x0, y0) 에서 (x1, y1) 로 모여듦 (모으기)
    function gatherPuff(x0, y0, x1, y1, s, r, color, max) {
        if (!room()) {
            return;
        }
        sigParticle({ x: x0, y: y0, x0, y0, x1, y1, s, r, color, max,
            update: (p) => {
                const k = easeOut(p.life / p.max);
                p.x = lerp(p.x0, p.x1, k);
                p.y = lerp(p.y0, p.y1, k);
            },
            draw: (ctx, p, t, px) => {
                ctx.globalAlpha = 0.8 * Math.min(1, t * 4) * (t > 0.8 ? (1 - t) / 0.2 : 1);
                sigDisc(ctx, px, p.s, p.x, p.y, p.r * (0.6 + 0.4 * t), p.color);
            } });
    }
    // 부딪힌 애 흔들기 (실패해도 그냥 넘어감)
    const shake = (amp, ms) => {
        try {
            ultShake(amp, ms);
        } catch (err) {
            // 흔들기 실패는 넘어감
        }
    };

    // ═════════════════ ground — 땅에서 솟음 (ultquake · ultpillar · ultbloom) ═════════════════
    const DIRT = ['#f0dcae', '#d1b178', '#a88a55', '#7a6238'];
    const SMOKE = ['#5a5a5a', '#7a7a7a', '#3e3e3e'];
    const OUTLINE = '#140d09';
    const BASALT = ['#b08a70', '#6e5040', '#4a3428', '#2a1c16'];
    const HOT = ['#ffffff', '#ffffff', '#fff6d8', '#f0dcae'];
    const LAVA = ['#ffffff', '#fff3a0', '#ffb020', '#ff5a10', '#c01808'];

    // 뾰족 바위 — 밑동 yb 에서 h 높이. 두 번 꺾인 가장자리 · 능선 경계로 밝은 면 / 그늘 면 · 진한 테두리 (clipY 아래는 안 그림)
    function spikeShape(x, yb, h, bw, lean, seed, rc, clipY, vein) {
        if (h < Z) {
            return;
        }
        const a1 = 0.22 + 0.2 * hash(seed + 1);
        const a2 = 0.55 + 0.25 * hash(seed + 2);
        const kL = [0.8 + 0.4 * hash(seed + 3), 0.7 + 0.6 * hash(seed + 4)];
        const kR = [0.8 + 0.4 * hash(seed + 5), 0.7 + 0.6 * hash(seed + 6)];
        const prof = (fr, k) => {
            if (fr < a1) {
                return lerp(1, (1 - a1) * k[0], fr / a1);
            }
            if (fr < a2) {
                return lerp((1 - a1) * k[0], (1 - a2) * k[1], (fr - a1) / (a2 - a1));
            }
            return lerp((1 - a2) * k[1], 0, (fr - a2) / (1 - a2));
        };
        const ridge = 0.32 + 0.2 * hash(seed + 7);
        for (let y = sn(yb - h), row = 0; y < Math.min(clipY, yb); y += Z, row++) {
            const fr = (yb - y) / h;
            if (fr > 1 || fr < 0) {
                continue;
            }
            const ledge = fr < 0.9 ? (hash(seed + Math.floor(row / 3) * 1.3) - 0.5) * Z * 1.4 : 0; // 3줄마다 턱
            const cx = x + lean * h * fr;
            const xl = cx - (bw / 2) * prof(fr, kL) + ledge;
            const xr = cx + (bw / 2) * prof(fr, kR) + ledge * 0.5;
            if (xr - xl < Z * 1.5) {
                dot(cx - Z / 2, y - Z, OUTLINE);
                dot(cx - Z / 2, y, rc[0]);
                continue;
            }
            const xm = lerp(xl, xr, ridge + (0.5 - ridge) * fr);
            fill(xl - Z, y, xr + Z, y + Z, OUTLINE);
            fill(xl, y, xm, y + Z, rc[1]);
            fill(xm, y, xr, y + Z, rc[2]);
            fill(xr - Math.max(Z, (xr - xm) * 0.35), y, xr, y + Z, rc[3]);
            dot(xm - Z, y, rc[0]);
            const hv = hash(seed * 3.1 + row * 0.7);
            if (hv < 0.1) {
                dot(lerp(xl, xr, 0.25 + hv * 5), y, vein || rc[3], 2, 1);
            }
        }
    }

    // ── 기둥 (ultpillar 와 같은 그림) — E = { G, H, cols, P, z, grav }, s = { age, g(솟음 1.07 까지), k(무너짐 0~1) } ──
    const PILLAR_KINDS = ['fire', 'rock', 'ice', 'water', 'light', 'vine', 'shadow'];
    const PILLAR_C = { fire: 'fire', rock: 'rock', ice: 'ice', water: 'water', light: 'star', vine: 'grass', shadow: 'ghost' };
    const KIND_OF_C = { fire: 'fire', water: 'water', ice: 'ice', grass: 'vine', solar: 'light', star: 'light', gold: 'light', moon: 'light', heal: 'light', aura: 'light', ghost: 'shadow', dark: 'shadow', rock: 'rock', ground: 'rock', steel: 'rock', bone: 'rock' };
    const PILLAR_RATE = { fire: 55, rock: 10, ice: 14, water: 40, light: 30, vine: 16, shadow: 34 };
    const pillarState = (pl, t) => {
        const age = t - pl.te;
        if (age < 0 || t >= pl.tg) {
            return null;
        }
        const r = age / 0.13;
        const g = r < 1 ? easeOut(r) * 1.07 : r < 1.6 ? 1.07 - 0.07 * ((r - 1) / 0.6) : 1;
        return { age, g, k: t > pl.tf ? k01((t - pl.tf) / (pl.tg - pl.tf)) : 0 };
    };
    function crystal(E, x, yb, h, w, lean, a, white) {
        const cols = E.cols;
        for (let y = sn(yb - h), row = 0; y < Math.min(E.G, yb); y += Z, row++) {
            const up = yb - y;
            const fr = up / h;
            const hw = fr > 0.75 ? ((w / 2) * (1 - fr)) / 0.25 : w / 2;
            const cx = x + lean * up;
            if (hw < Z * 0.5) {
                alpha(a);
                dot(cx - Z / 2, y, '#ffffff');
                continue;
            }
            alpha(0.86 * a);
            fill(cx - hw, y, cx + hw, y + Z, white ? '#ffffff' : cols[2]);
            fill(cx - hw, y, cx - hw / 3, y + Z, white ? '#ffffff' : cols[1]);
            fill(cx + hw / 3, y, cx + hw, y + Z, white ? cols[0] : cols[3]);
            alpha(a);
            dot(cx - hw, y, '#ffffff');
            if (row % 6 === 0 && fr < 0.7) {
                dot(cx - hw / 3, y, '#ffffff');
            }
        }
    }
    const PILLAR_DRAW = {
        fire: (pl, t, s, E) => {
            const { G, cols } = E;
            const lift = s.k * pl.h * 0.9; // 밑동이 떨어져 올라감
            const hc = pl.h * s.g * (1 + 0.15 * s.k);
            const top = G - hc;
            const fade = 1 - s.k;
            const w = pl.w * (1 - 0.45 * s.k);
            for (let y = sn(top); y < G - lift; y += Z) {
                const fr = (G - y) / hc;
                let hw = (w / 2) * (0.8 + 0.12 * Math.sin(y * 0.11 + t * 23 + pl.seed) + 0.08 * Math.sin(y * 0.27 - t * 37));
                if (fr > 0.8) {
                    hw *= Math.pow(Math.max(0, (1 - fr) / 0.2), 0.7);
                }
                hw *= 1 + 0.45 * Math.pow(Math.max(0, 1 - fr), 8);
                const cx = pl.x + Math.sin(y * 0.045 + t * 8 + pl.seed) * w * 0.07;
                alpha(0.88 * fade);
                fill(cx - hw, y, cx + hw, y + Z, cols[3]);
                alpha(fade);
                fill(cx - hw * 0.72, y, cx + hw * 0.72, y + Z, cols[2]);
                fill(cx - hw * 0.46, y, cx + hw * 0.46, y + Z, cols[1]);
                if (fr < 0.7) {
                    fill(cx - hw * 0.2, y, cx + hw * 0.2, y + Z, cols[0]);
                }
            }
            // 꼭대기에서 날름대는 불꽃 혀
            for (let j = 0; j < 3; j++) {
                const lx = pl.x + (j - 1) * w * 0.26 + Math.sin(t * 9 + j * 2) * w * 0.05;
                const lh = hc * (0.1 + 0.08 * Math.sin(t * 19 + j * 2.1 + pl.seed)) * (j === 1 ? 1.5 : 1);
                const lw = w * 0.14;
                const y0 = top + hc * 0.14;
                for (let y = 0; y < lh; y += Z) {
                    const ww = lw * (1 - y / lh);
                    alpha(fade);
                    fill(lx - ww, y0 - y, lx + ww, y0 - y + Z, y < lh * 0.5 ? cols[2] : cols[1]);
                }
            }
        },
        rock: (pl, t, s, E) => {
            const { G, cols } = E;
            const e = Math.min(1, s.g);
            const yb = G + Z + pl.h * (1 - e) + s.k * pl.h * 0.75; // 끝부터 솟아나옴 · 무너지며 가라앉음
            const hh = pl.h * Math.max(1, s.g);
            alpha(1 - s.k * s.k);
            spikeShape(pl.x - pl.w * 0.42, yb + pl.h * 0.05, hh * 0.42, pl.w * 0.55, -0.35, pl.seed + 5, cols, G);
            spikeShape(pl.x + pl.w * 0.45, yb + pl.h * 0.03, hh * 0.34, pl.w * 0.5, 0.4, pl.seed + 9, cols, G);
            spikeShape(pl.x, yb, hh, pl.w * 1.2, pl.lean, pl.seed, cols, G);
        },
        ice: (pl, t, s, E) => {
            if (s.k > 0.25) {
                return; // 산산조각 — 조각은 입자로
            }
            const e = Math.min(1, s.g);
            const over = Math.max(1, s.g);
            const yb = E.G + Z + pl.h * (1 - e);
            const a = s.k > 0 ? 1 - s.k / 0.25 : 1;
            const white = s.k > 0;
            crystal(E, pl.x - pl.w * 0.34, yb, pl.h * 0.5 * over, pl.w * 0.34, -0.4, a, white);
            crystal(E, pl.x + pl.w * 0.38, yb, pl.h * 0.42 * over, pl.w * 0.3, 0.36, a, white);
            crystal(E, pl.x + pl.w * 0.12, yb, pl.h * 0.28 * over, pl.w * 0.24, 0.12, a, white);
            crystal(E, pl.x, yb, pl.h * over, pl.w * 0.48, 0.02 + (pl.lean || 0), a, white);
            // 반짝 — 큰 결정 가장자리를 타고 오름
            const gy = yb - ((t * 1.6 + pl.seed) % 1) * pl.h * 0.8;
            alpha(a);
            dot(pl.x - pl.w * 0.24 + (yb - gy) * 0.02, gy, '#ffffff', 1, 3);
            dot(pl.x - pl.w * 0.24 + (yb - gy) * 0.02 - Z, gy + Z, '#ffffff', 3, 1);
        },
        water: (pl, t, s, E) => {
            const { G, cols, H } = E;
            const hc = pl.h * s.g * (1 - s.k * s.k); // 무너질 땐 위에서부터 내려앉음
            if (hc < Z) {
                return;
            }
            const top = G - hc;
            const w = pl.w;
            for (let y = sn(top); y < G; y += Z) {
                const fr = (G - y) / hc;
                let hw = (w / 2) * (0.72 + 0.12 * Math.sin(y * 0.13 - t * 28 + pl.seed) + 0.07 * Math.sin(y * 0.33 + t * 15));
                hw *= 1 + 0.6 * Math.pow(1 - fr, 6);
                const cx = pl.x + Math.sin(y * 0.04 + t * 6) * w * 0.05;
                alpha(0.85);
                fill(cx - hw, y, cx + hw, y + Z, cols[3]);
                fill(cx - hw * 0.7, y, cx + hw * 0.7, y + Z, cols[2]);
                alpha(0.92);
                fill(cx - hw * 0.35, y, cx + hw * 0.35, y + Z, cols[1]);
                // 위로 달리는 흰 줄
                alpha(1);
                const q = Math.floor((y + t * H * 1.8) / Z);
                for (let j = -1; j <= 1; j++) {
                    if ((((q + j * 5) % 7) + 7) % 7 < 2) {
                        dot(cx + j * hw * 0.5, y, '#ffffff');
                    }
                }
            }
            // 꼭대기 물보라 — 거품 덩어리가 부글부글
            const cr = Math.max(3 * Z, w * 0.5);
            const wob = (j) => 1 + 0.14 * Math.sin(t * 21 + j * 2.3 + pl.seed);
            alpha(0.95);
            disc(pl.x - cr * 0.75, top + cr * 0.2, cr * 0.55 * wob(1), cr * 0.42, cols[1]);
            disc(pl.x + cr * 0.75, top + cr * 0.2, cr * 0.55 * wob(2), cr * 0.42, cols[1]);
            disc(pl.x, top - cr * 0.15, cr * 0.75 * wob(3), cr * 0.6 * wob(4), '#ffffff');
            disc(pl.x - cr * 0.4, top + cr * 0.05, cr * 0.42 * wob(5), cr * 0.34, '#ffffff');
            disc(pl.x + cr * 0.35, top - cr * 0.05, cr * 0.38, cr * 0.3 * wob(6), cols[0]);
            alpha(1);
            ring(pl.x, top, cr * 1.25, cr * 0.65, 14, t * 3, '#ffffff', cols[1]);
            // 밑동 거품
            alpha(0.9);
            disc(pl.x, G, w * 0.95, 2 * Z, cols[1]);
            ring(pl.x, G - Z, w * 0.9, 2 * Z, 16, t * 6, '#ffffff', cols[0]);
        },
        light: (pl, t, s, E) => {
            const { G, cols } = E;
            const hc = pl.h * Math.min(1, s.g);
            const narrow = 1 - s.k * s.k; // 끝엔 가늘어짐
            const w = pl.w * narrow * (1 + 0.05 * Math.sin(t * 40));
            const top = G - hc;
            if (w < Z * 0.5) {
                return;
            }
            // 바깥 빛은 아른대는 계단 띠로
            for (let y = sn(top), row = 0; y < G; y += 3 * Z, row++) {
                const ww = w * 0.62 * (1 + 0.08 * Math.sin(row * 0.9 + t * 25));
                alpha(0.3);
                fill(pl.x - ww, y, pl.x + ww, y + 3 * Z, cols[3]);
            }
            alpha(0.55);
            fill(pl.x - w * 0.45, top, pl.x + w * 0.45, G, cols[2]);
            alpha(0.9);
            fill(pl.x - w * 0.3, top, pl.x + w * 0.3, G, cols[1]);
            alpha(1);
            fill(pl.x - w * 0.14, top, pl.x + w * 0.14, G, '#ffffff');
            // 오르는 빛 띠 · 고리
            for (let j = 0; j < 4; j++) {
                const by = G - ((t * 1.3 + j / 4 + pl.seed) % 1) * hc;
                alpha(0.8 * narrow);
                fill(pl.x - w * 0.5, by, pl.x + w * 0.5, by + Z, cols[0]);
                ring(pl.x, by, w * 0.75, Math.max(Z, w * 0.12), 18, t * 4 + j, cols[0], cols[2]);
            }
            alpha(0.9 * narrow);
            fill(pl.x - w * 1.1, G - Z, pl.x + w * 1.1, G + Z, cols[1]);
        },
        vine: (pl, t, s, E) => {
            const { G, cols } = E;
            const e = Math.min(1, s.g);
            const h = pl.h * Math.max(1, s.g);
            const yb = G + Z + h * (1 - e) + s.k * h; // 솟아나옴 · 끝엔 땅속으로
            const top = yb - h;
            const tk = Math.max(1, (pl.w * 0.16) / Z);
            const strands = 3;
            for (let pass = 0; pass < 2; pass++) {
                for (let y = sn(Math.max(top, -Z)); y < Math.min(G, yb); y += Z) {
                    const up = yb - y;
                    const fr = up / h;
                    const th = Math.max(1, Math.round(tk * (1 - 0.6 * fr)));
                    for (let j = 0; j < strands; j++) {
                        const a = (up / (pl.w * 1.1)) * Math.PI + (j * TAU) / strands + t * 1.2 + pl.seed;
                        const front = Math.cos(a) >= 0;
                        if (front !== (pass === 1)) {
                            continue;
                        }
                        const xx = pl.x + Math.sin(a) * pl.w * 0.32 * (1 - 0.25 * fr) + Math.sin(fr * 4 + t * 2) * pl.w * 0.06 * fr;
                        const half = (th * Z) / 2;
                        alpha(1);
                        fill(xx - half - Z, y, xx + half + Z, y + Z, '#173d12');
                        fill(xx - half, y, xx + half, y + Z, pass ? cols[2] : cols[3]);
                        if (pass) {
                            dot(xx - half, y, cols[1]);
                        }
                        // 잎
                        if ((Math.floor(up / Z) + j * 4) % 9 === 0 && fr < 0.95 && fr > 0.05) {
                            const side = (Math.floor(up / Z / 9) + j) % 2 ? 1 : -1;
                            const lx = xx + side * (half + Z);
                            fill(lx, y - Z, lx + side * 3 * Z, y + Z, pass ? cols[1] : cols[2]);
                            dot(lx + side * 2 * Z - (side < 0 ? Z : 0), y - Z, cols[0]);
                        }
                    }
                }
            }
            // 덩굴 끝 꽃봉오리
            if (s.k < 0.5) {
                alpha(1);
                for (let j = 0; j < strands; j++) {
                    const a = (h / (pl.w * 1.1)) * Math.PI + (j * TAU) / strands + t * 1.2 + pl.seed;
                    const xx = pl.x + Math.sin(a) * pl.w * 0.24 + Math.sin(4 + t * 2) * pl.w * 0.06;
                    dot(xx - Z, top - Z, cols[0], 2, 2);
                }
            }
        },
        shadow: (pl, t, s, E) => {
            const { G, cols, P } = E;
            const e = Math.min(1, s.g);
            const fade = 1 - s.k;
            const h = pl.h * Math.max(1, s.g) * (1 - 0.3 * s.k) * e;
            const m = 3 + Math.round(P);
            const tk = clamp(Math.round((pl.w * 0.13) / Z), 2, 5);
            // 뒤에 어둠 아지랑이 + 번뜩이는 눈
            for (let y = sn(G - h), row = 0; y < G; y += 2 * Z, row++) {
                const fr = (G - y) / h;
                const hw = pl.w * 0.55 * (0.7 + 0.3 * Math.sin(row * 0.8 + t * 6)) * (1 - 0.5 * fr);
                alpha(0.45 * fade);
                fill(pl.x - hw, y, pl.x + hw, y + 2 * Z, cols[3]);
            }
            if (s.age > 0.2 && Math.sin(t * 2.5 + pl.seed) < 0.93) {
                const ey = G - h * 0.72;
                alpha(fade);
                for (const side of [-1, 1]) {
                    dot(pl.x + side * pl.w * 0.13 - Z, ey, '#ff3d6e', 2, 1);
                    dot(pl.x + side * pl.w * 0.13 - (side > 0 ? 0 : Z), ey, '#ffffff');
                }
            }
            for (let j = 0; j < m; j++) {
                const hj = h * (0.7 + 0.3 * hash(pl.seed + j));
                const off = m > 1 ? (j - (m - 1) / 2) / (m - 1) : 0;
                const bx = pl.x + off * pl.w * 0.7;
                const ph = hash(pl.seed * 2 + j) * TAU;
                let tx = bx;
                for (let up = 0; up < hj; up += Z) {
                    const fr = up / hj;
                    const xx = bx + Math.sin(fr * 3.4 + t * (3 + j * 0.5) + ph) * pl.w * 0.32 * fr + off * fr * pl.w * 0.45;
                    const th = Math.max(1, Math.round((1 - fr * 0.85) * tk));
                    const half = (th * Z) / 2;
                    const y = G - up;
                    alpha(fade);
                    fill(xx - half - Z, y, xx + half + Z, y + Z, cols[1]);
                    fill(xx - half, y, xx + half, y + Z, '#12061f');
                    if (th > 2) {
                        dot(xx - half, y, cols[2]);
                    }
                    tx = xx;
                }
                // 끝 — 갈고리 손톱
                const side = off < 0 ? -1 : 1;
                alpha(fade);
                dot(tx, G - hj - Z, cols[0]);
                dot(tx + side * Z, G - hj - 2 * Z, cols[0]);
                dot(tx + side * 2 * Z, G - hj - 2 * Z, cols[1]);
            }
        },
    };
    // 기둥 둘레 입자 하나 (모양마다)
    function pillarEmit(kind, pl, E, top) {
        const { G, H, cols, z, grav } = E;
        const x = pl.x + rnd(-0.5, 0.5) * pl.w;
        switch (kind) {
            case 'fire':
                if (Math.random() < 0.2) {
                    puff(pl.x + rnd(-0.3, 0.3) * pl.w, top + rnd(0, 0.1) * pl.h, z, pick(SMOKE), rnd(-15, 15), -rnd(30, 70), rnd(0.8, 1.3), 4, 0.45);
                } else {
                    ember(x, rnd(top, G), z, pick(cols.slice(0, 2)), cols[2], rnd(-30, 30), -rnd(80, 200) * (H / 300), rnd(0.5, 1.0));
                }
                break;
            case 'rock':
                puff(x, G - z, z, pick(cols.slice(0, 3)), rnd(-40, 40), -rnd(5, 30), rnd(0.6, 1), 4, 0.45);
                if (Math.random() < 0.5) {
                    chunk(x, rnd(top, G), z, rnd(-40, 40), -rnd(0, 60), grav, G, pick(cols), 1);
                }
                break;
            case 'ice':
                sparkle(pl.x + rnd(-0.4, 0.4) * pl.w, rnd(top, G), z, ['#ffffff', cols[1], cols[2]], 0, -rnd(10, 40), rnd(0.4, 0.8));
                break;
            case 'water':
                chunk(pl.x + rnd(-0.6, 0.6) * pl.w, top + rnd(-1, 1) * z, z, rnd(-1, 1) * pl.w * 3, -rnd(0, 0.45) * H, grav, G, pick(['#ffffff', cols[1], cols[1], cols[2]]), pick([1, 1, 2]), undefined, Math.random() < 0.15, 1.6);
                break;
            case 'light':
                sparkle(pl.x + rnd(-0.9, 0.9) * pl.w, rnd(Math.max(0, top), G), z, cols, rnd(-10, 10), -rnd(40, 120), rnd(0.4, 0.8));
                break;
            case 'vine':
                flutter(x, rnd(top, G), z, pick([cols[1], cols[2], cols[0]]), rnd(-1, 1) * 80, -rnd(10, 60), rnd(0.9, 1.4), { g: 40, sway: 50 });
                break;
            case 'shadow':
                float(x, rnd(top, G), z, pick([cols[1], cols[2], cols[0]]), rnd(-10, 10), -rnd(30, 90), rnd(0.6, 1.1), pick([1, 1, 2]));
                break;
        }
    }
    // 솟을 때 — 흙 · 모양 조각이 확 (m 배)
    function pillarBurst(kind, pl, E, m) {
        const { G, H, cols, z, grav } = E;
        const n = (v) => Math.max(1, Math.round(v * m));
        const top = Math.min(pl.h, G);
        for (let i = 0; i < n(6); i++) {
            chunk(pl.x + rnd(-0.5, 0.5) * pl.w, G - z, z, rnd(-1, 1) * H * 0.5, -rnd(0.5, 1.1) * H * 1.1, grav, G, pick(DIRT), pick([1, 2]), DIRT[0], true);
        }
        switch (kind) {
            case 'fire':
                for (let i = 0; i < n(24); i++) {
                    ember(pl.x + rnd(-0.5, 0.5) * pl.w, G - rnd(0, 0.5) * top, z, pick(cols.slice(0, 3)), cols[3], rnd(-1, 1) * H * 0.5, -rnd(0.3, 1) * H * 1.2, rnd(0.5, 1.1));
                }
                break;
            case 'rock':
                for (let i = 0; i < n(10); i++) {
                    chunk(pl.x + rnd(-0.4, 0.4) * pl.w, G - rnd(0.1, 0.7) * top, z, rnd(-1, 1) * H * 0.6, -rnd(0.4, 1) * H * 1.2, grav, G, pick(cols), pick([1, 2, 2, 3]), cols[0], true);
                }
                for (let i = 0; i < n(5); i++) {
                    puff(pl.x + rnd(-0.6, 0.6) * pl.w, G - z, z, pick(cols.slice(0, 3)), rnd(-80, 80), -rnd(10, 50), rnd(0.7, 1.1), 5, 0.6);
                }
                break;
            case 'ice':
                for (let i = 0; i < n(14); i++) {
                    chunk(pl.x + rnd(-0.4, 0.4) * pl.w, G - rnd(0.1, 0.8) * top, z, rnd(-1, 1) * H * 0.6, -rnd(0.3, 1) * H, grav, G, pick(['#ffffff', cols[0], cols[1]]), 1, undefined, false, 1.2);
                }
                break;
            case 'water':
                for (let i = 0; i < n(26); i++) {
                    chunk(pl.x + rnd(-0.5, 0.5) * pl.w, G - rnd(0, 1) * top, z, rnd(-1, 1) * H * 0.7, -rnd(0.3, 1.1) * H * 1.1, grav, G, pick(['#ffffff', cols[1], cols[2]]), pick([1, 1, 2]), undefined, false, 1.6);
                }
                break;
            case 'light':
                for (let i = 0; i < n(18); i++) {
                    sparkle(pl.x + rnd(-0.8, 0.8) * pl.w, G - rnd(0, 1) * top, z, cols, rnd(-1, 1) * 60, -rnd(30, 140), rnd(0.4, 0.9));
                }
                break;
            case 'vine':
                for (let i = 0; i < n(14); i++) {
                    flutter(pl.x + rnd(-0.5, 0.5) * pl.w, G - rnd(0, 0.8) * top, z, pick([cols[1], cols[2], cols[0]]), rnd(-1, 1) * 160, -rnd(60, 200), rnd(0.9, 1.5), { g: 90, sway: 40 });
                }
                break;
            case 'shadow':
                for (let i = 0; i < n(20); i++) {
                    const a = rnd(0, TAU);
                    float(pl.x, G - rnd(0, 0.6) * top, z, pick([cols[0], cols[1], cols[2]]), Math.cos(a) * rnd(40, 140), Math.sin(a) * rnd(40, 140) - 40, rnd(0.6, 1.1), pick([1, 2]));
                }
                break;
        }
    }
    // 무너질 때 (m 배)
    function pillarCrumble(kind, pl, E, m) {
        const { G, H, cols, z, grav } = E;
        const n = (v) => Math.max(1, Math.round(v * m));
        const hh = Math.min(pl.h, G);
        const top = G - hh;
        switch (kind) {
            case 'fire':
                for (let i = 0; i < n(10); i++) {
                    puff(pl.x + rnd(-0.4, 0.4) * pl.w, top + rnd(0, 0.4) * hh, z, pick(SMOKE), rnd(-30, 30), -rnd(20, 60), rnd(0.9, 1.4), 6, 0.5);
                    ember(pl.x + rnd(-0.5, 0.5) * pl.w, rnd(top, G), z, cols[1], cols[3], rnd(-60, 60), -rnd(40, 140), rnd(0.5, 0.9));
                }
                break;
            case 'rock':
                for (let i = 0; i < n(16); i++) {
                    chunk(pl.x + rnd(-0.4, 0.4) * pl.w, G - rnd(0.05, 0.95) * hh, z, rnd(-1, 1) * H * 0.4, -rnd(0, 0.6) * H, grav, G, pick(cols), pick([1, 2, 2, 3]), cols[0], true);
                }
                for (let i = 0; i < n(6); i++) {
                    puff(pl.x + rnd(-0.5, 0.5) * pl.w, G - rnd(0, 0.5) * hh, z, pick(cols.slice(0, 3)), rnd(-40, 40), -rnd(10, 40), rnd(0.7, 1.2), 6, 0.55);
                }
                break;
            case 'ice':
                sigBurst(pl.x, G - hh * 0.5, z, ['#ffffff', cols[0], cols[1]], n(10), 90);
                for (let i = 0; i < n(30); i++) {
                    chunk(pl.x + rnd(-0.5, 0.5) * pl.w, G - rnd(0, 1) * hh, z, rnd(-1, 1) * H * 0.8, -rnd(0.1, 0.9) * H * 1.1, grav, G, pick(['#ffffff', cols[0], cols[1], cols[2]]), pick([1, 1, 2]), undefined, true, 1.4);
                }
                break;
            case 'water':
                for (let i = 0; i < n(24); i++) {
                    chunk(pl.x + rnd(-0.8, 0.8) * pl.w, top + rnd(0, 0.3) * hh, z, rnd(-1, 1) * pl.w * 2.5, -rnd(0, 0.3) * H, grav, G, pick(['#ffffff', cols[1], cols[2]]), pick([1, 2]), undefined, true, 1.6);
                }
                break;
            case 'light':
                for (let i = 0; i < n(14); i++) {
                    sparkle(pl.x + rnd(-0.4, 0.4) * pl.w, G - rnd(0, 1) * hh, z, cols, rnd(-20, 20), -rnd(60, 160), rnd(0.4, 0.8));
                }
                break;
            case 'vine':
                for (let i = 0; i < n(10); i++) {
                    flutter(pl.x + rnd(-0.5, 0.5) * pl.w, G - rnd(0, 1) * hh, z, pick([cols[1], cols[2], cols[0]]), rnd(-1, 1) * 70, -rnd(10, 60), rnd(0.9, 1.4), { g: 50, sway: 40 });
                }
                break;
            case 'shadow':
                for (let i = 0; i < n(18); i++) {
                    float(pl.x + rnd(-0.5, 0.5) * pl.w, G - rnd(0, 1) * hh, z, pick([cols[0], cols[1], cols[2]]), rnd(-30, 30), -rnd(30, 100), rnd(0.6, 1.1), pick([1, 2]));
                }
                break;
        }
    }
    // 얼음 기둥 밑 서리
    function frost(E, x, w, seed, age, a0) {
        const spread = Math.min(1, age / 0.4) * w * 1.4;
        for (let xx = -spread, j = 0; xx <= spread; xx += Z, j++) {
            const hv = hash(seed + j * 0.37);
            if (hv < 0.55) {
                alpha(a0 * (1 - Math.abs(xx) / (spread + Z)));
                dot(x + xx, E.G - (hv < 0.15 ? 2 : 1) * Z, hv < 0.3 ? '#ffffff' : E.cols[1]);
            }
        }
    }

    // ── 꽃 (ultbloom bloom 과 같은 그림) ──
    const PETALS = [['#ffe6f2', '#ff7ab8'], ['#ffffff', '#dcdcc8'], ['#fff8b0', '#ffd23f'], ['#ffd0d8', '#e0405a'], ['#f0e0ff', '#a070ff'], ['#e0f4ff', '#6cc3ff']];
    const STEM = ['#a8f070', '#4cae3c', '#2f7d32'];
    const GLYPH = { s: ['.l.', 'lcl', '.l.'], m: ['.l.l.', 'lpppl', '.pcp.', 'lpppl', '.l.l.'], t: ['p.p', 'ppp', 'lpp', '.p.'] };
    function glyph(x, y, rows, fl) {
        const h = rows.length;
        const w = rows[0].length;
        const c = fl.big * Z;
        for (let j = 0; j < h; j++) {
            for (let i = 0; i < w; i++) {
                const ch = rows[j][i];
                if (ch !== '.') {
                    dot(x + (i - Math.floor(w / 2)) * c, y + (j - h + 1) * c, ch === 'p' ? fl.pc : ch === 'l' ? fl.lc : '#ffd23f', fl.big);
                }
            }
        }
    }
    function drawFlower(fl, x, G, t) {
        const age = t - fl.t0;
        if (age < 0) {
            return;
        }
        const hs = Math.max(1, Math.round(fl.hs * Math.min(1, age / 0.22)));
        const sway = Math.round(Math.sin(t * 2.6 + fl.ph) * 0.7);
        for (let k = 0; k < hs; k++) {
            dot(x + (k > hs * 0.6 ? sway * Z : 0), G - (k + 1) * Z, k % 3 === 0 ? STEM[2] : STEM[1]);
        }
        if (hs >= 3) {
            dot(x - Z, G - 2 * Z, STEM[0]);
        }
        const tx = x + sway * Z;
        const ty = G - (hs + 1) * Z;
        if (age < 0.3) {
            dot(tx, ty, STEM[0]); // 싹
        } else if (age < 0.42) {
            dot(tx, ty, fl.pc); // 봉오리
            dot(tx, ty + Z, STEM[1]);
        } else {
            const rows = GLYPH[age < 0.5 && fl.type === 'm' ? 's' : fl.type];
            glyph(tx, fl.type === 't' ? ty + fl.big * Z : ty + Math.floor(rows.length / 2) * fl.big * Z, rows, fl);
        }
    }
    function drawTuft(tf, x, G, t) {
        const age = t - tf.t0;
        if (age < 0) {
            return;
        }
        const h = Math.max(1, Math.round(tf.h * Math.min(1, age / 0.25)));
        for (let k = 0; k < h; k++) {
            dot(x, G - (k + 1) * Z, STEM[1]);
            if (k > 0) {
                dot(x - Math.ceil(k / 2) * Z, G - (k + 1) * Z, k % 2 ? STEM[2] : STEM[1]);
                dot(x + Math.ceil(k / 2) * Z, G - k * Z, STEM[0]);
            }
        }
    }
    // 하늘에서 내리꽂는 빛기둥 (블룸샤인 — win)
    function lightBeam(cx, w0, bottom, t, beamCols, a0) {
        for (let y = 0, row = 0; y < bottom; y += 3 * Z, row++) {
            const hw = w0 * (1 + 0.035 * Math.sin(row * 0.9 + t * 26));
            alpha(0.8 * a0);
            for (let x = hw * 0.9; x < hw * 1.15; x += 2 * Z) {
                dot(cx - x - ((row % 2) + 1) * Z, y, beamCols[2]);
                dot(cx + x + (row % 2) * Z, y + Z, beamCols[2]);
            }
            alpha(0.75 * a0);
            fill(cx - hw * 0.9, y, cx + hw * 0.9, y + 3 * Z, beamCols[2]);
            alpha(0.9 * a0);
            fill(cx - hw * 0.64, y, cx + hw * 0.64, y + 3 * Z, beamCols[1]);
            alpha(a0);
            fill(cx - hw * 0.34, y, cx + hw * 0.34, y + 3 * Z, '#ffffff');
        }
        // 빛 속을 쏟아져 내리는 줄
        alpha(0.9 * a0);
        for (let j = 0; j < 5; j++) {
            const lx = cx + (hash(j * 3.7) - 0.5) * w0 * 1.5;
            const ly = ((t * 2.2 + hash(j * 1.9)) % 1) * bottom;
            fill(lx - Z / 2, ly, lx + Z / 2, ly + bottom * 0.18, j % 2 ? '#ffffff' : beamCols[1]);
        }
    }

    // ── ground 상태 — 필살기 틀(X.fx) · 옵션(X.o) 에 따라 ──
    function groundSt(D, X) {
        const st = base(D, X);
        if (st.M) {
            return st;
        }
        const o = X.o || {};
        const z = st.Z;
        const P = st.P;
        const G = st.G;
        st.items = [];
        st.next = 0;
        if (X.fx === 'ultpillar') {
            st.kind = PILLAR_KINDS.includes(o.kind) ? o.kind : KIND_OF_C[o.c] || 'rock';
            st.cols = sigPal(o.c || PILLAR_C[st.kind]);
            st.E = { G, H: D.H, cols: st.cols, P, z, grav: D.H * 2.4 };
            const n = clamp(Math.round(Number(o.n) || 5), 1, 9);
            st.pw = clamp(D.lane * 1.5, 5 * z, Math.max(7 * z, D.H * 0.2)) * (0.85 + 0.25 * P);
            st.gap = Math.max(st.pw * 1.2, (D.half * 0.9) / n); // 기둥 사이 — n 이 많을수록 촘촘히
            st.ww = st.pw * 1.6; // 앞머리 벽
            st.wh = st.kind === 'light' ? G + 4 * z : clamp(st.hRef * 2.7 * (0.85 + 0.2 * P), 8 * z, G - 2 * z);
            st.wseed = rnd(0, 999);
            st.next = Math.max(st.pw * 0.2, z);
            st.M = PILLAR;
        } else if (X.fx === 'ultbloom' && o.mode === 'vine') {
            st.cols = sigPal(o.c || 'grass');
            const nV = 2 + (X.P > 0.5 ? 1 : 0);
            st.vines = [];
            for (let j = 0; j < nV; j++) {
                st.vines.push({ off: j - (nV - 1) / 2, ph: rnd(0, TAU), w: rnd(6.5, 9), hump: st.hRef * rnd(0.3, 0.55), per: st.hRef * rnd(1.4, 2.2), T: clamp(Math.round(st.hRef / (5 * z)) + 1, 3, 7) - (j % 2), trail: [], q: 0 });
            }
            st.M = VINE;
        } else if (X.fx === 'ultbloom') {
            const own = o.c && o.c !== 'grass' ? sigPal(o.c) : null;
            st.petals = own ? [[own[0], own[2]], [own[1], own[3]], ['#ffffff', own[1]], [own[0], own[1]]] : PETALS;
            st.beamCols = own || sigPal('solar');
            st.flowerC = own ? [own[0], own[2], own[3]] : ['#ffe6f2', '#ff7ab8', '#e0508f'];
            st.rb = Math.min(clamp(st.hRef * 0.75, 5 * z, 56) * (0.8 + 0.3 * P), Math.max(4 * z, D.half * 0.28));
            st.tufts = [];
            st.next = rnd(1, 3) * z;
            st.M = BLOOM;
        } else {
            st.lava = !!o.lava;
            const cols = sigPal(o.c || 'ground');
            st.rock = st.lava ? BASALT : cols;
            st.glow = st.lava ? LAVA : ['#ffffff', '#fff6d8', cols[0], cols[1]];
            st.gap = clamp(st.hRef * 0.95, 6 * z, 80);
            st.fh = clamp(st.hRef * 2.6, 6 * z, G * 0.8) * (0.85 + 0.2 * P); // 앞머리 큰 가시
            st.fbw = st.fh * 0.55;
            st.fseed = rnd(0, 999);
            st.next = Math.max(st.gap * 0.5, z);
            st.spouts = [];
            st.M = QUAKE;
        }
        return st;
    }

    // ── ultquake — 땅을 따라 달리는 갈라짐 · 줄줄이 솟는 바위 가시, 앞머리엔 가장 큰 가시 (lava: 용암 틈 · 분출) ──
    const QUAKE = {
        charge(D, X, st, k, dt) {
            const G = st.G;
            const z = st.Z;
            if (!st.hop) {
                st.hop = true;
                try {
                    const hop = Math.max(6, X.h * 0.4);
                    X.p.el.animate([{ translate: '0 0', easing: 'ease-out' }, { translate: `0 -${hop}px`, offset: 0.6, easing: 'ease-in' }, { translate: '0 0' }], { duration: DUEL_CHARGE * 1000 - 40, composite: 'add' });
                } catch (err) {
                    // 그림 움직임 실패는 넘어감
                }
            }
            // 발밑으로 빛이 모이고 땅이 부르르
            every(st, 0, dt, 26 + 50 * k, () => {
                const a = rnd(0, TAU);
                const r = D.lane * rnd(1.5, 3);
                mote(X.x0 + Math.cos(a) * r, G - Math.abs(Math.sin(a)) * r * 0.8, X.x0, G - z, z, pick(st.glow.slice(0, 3)), rnd(0.18, 0.3), pick([1, 2]));
            });
            every(st, 1, dt, 10 + 20 * k, () => {
                puff(X.x0 + rnd(-1, 1) * D.lane, G - z, z, pick(st.rock.slice(0, 3)), rnd(-30, 30), -rnd(10, 40), rnd(0.5, 0.9), 4, 0.5);
                chunk(X.x0 + rnd(-1.5, 1.5) * D.lane, G - z, z, rnd(-20, 20), -rnd(0.1, 0.3) * D.H, D.H * 2.6, G, pick(st.rock), 1);
            });
            if (k > 0.9 && !st.stomp) {
                // 쿵
                st.stomp = true;
                sigImpact(X.x0, G - z, z, [st.glow[0], st.glow[1], st.glow[2]], 1, true);
                sigRing(X.x0, G, z, 2 * z, D.lane * 3, 0.2, 0.4, [st.glow[1], '#ffffff', st.glow[2]]);
                for (let i = 0; i < 6; i++) {
                    chunk(X.x0, G - z, z, rnd(-1, 1) * D.H * 0.5, -rnd(0.5, 1) * D.H, D.H * 2.6, G, pick(st.rock), pick([1, 2]), st.rock[0], true);
                }
                shake(3, 300);
            }
        },
        tick(D, X, st, dt) {
            const t = D.t;
            const len = reach(X);
            const G = st.G;
            const z = st.Z;
            const H = D.H;
            const grav = H * 2.6;
            const { rock, glow } = st;
            const on = live(D, X);
            if (st.pop === undefined) {
                st.pop = t;
            }
            const lim = len - st.fbw * 1.7;
            const newSpike = (d, t0) => {
                const h = clamp(st.hRef * rnd(0.7, 1.35) * (0.8 + 0.3 * st.P), 4 * z, G * 0.6);
                return { d, h, bw: h * rnd(0.42, 0.62), lean: X.dir * rnd(-0.04, 0.14), seed: rnd(0, 999), t0, tEnd: t0 + rnd(0.9, 1.5), on: false, off: false };
            };
            if (on) {
                while (st.next < lim) {
                    st.items.push(newSpike(st.next, t));
                    if (Math.random() < 0.4) {
                        const sp = newSpike(st.next + st.gap * rnd(0.3, 0.5), t + 0.05);
                        sp.h *= rnd(0.4, 0.6);
                        sp.bw = sp.h * 0.55;
                        st.items.push(sp);
                    }
                    st.next += st.gap * rnd(0.75, 1.25);
                }
                if (st.next > lim + st.gap * 2) {
                    st.next = Math.max(st.gap * 0.5, lim); // 밀려났다 다시 나가면 그 자리부터
                }
            }
            for (let i = st.items.length - 1; i >= 0; i--) {
                const sp = st.items[i];
                const x = along(X, sp.d);
                if (!sp.on && t >= sp.t0) {
                    // 솟음 — 흙먼지 · 조각
                    sp.on = true;
                    for (let j = 0; j < 2; j++) {
                        puff(x + rnd(-0.5, 0.5) * sp.bw, G - 2 * z, z, pick(rock.slice(0, 3)), rnd(-40, 40), -rnd(30, 90) * (H / 300), rnd(0.6, 1.0), 5, 0.55);
                    }
                    for (let j = 0; j < 3; j++) {
                        chunk(x + rnd(-0.4, 0.4) * sp.bw, G - sp.h * rnd(0.2, 0.8), z, rnd(-1, 1) * H * 0.4, -rnd(0.5, 1) * Math.sqrt(2 * grav * sp.h * 0.8), grav, G, pick(rock), pick([1, 1, 2]), rock[0]);
                    }
                    if (st.lava) {
                        chunk(x, G - z, z, rnd(-1, 1) * H * 0.3, -rnd(0.4, 1) * H, grav, G, pick([LAVA[1], LAVA[2]]), 1, undefined, true);
                    }
                }
                if (sp.on && !sp.off && (t >= sp.tEnd || sp.d > lim + st.fbw * 0.4)) {
                    // 무너짐 (앞머리가 밀려 물러나도)
                    sp.off = true;
                    sp.tEnd = Math.min(sp.tEnd, t);
                    for (let j = 0; j < 4; j++) {
                        chunk(x + rnd(-0.4, 0.4) * sp.bw, G - sp.h * rnd(0.1, 0.9), z, rnd(-1, 1) * H * 0.5, -rnd(0.3, 0.9) * H * 0.8, grav, G, pick(rock), pick([1, 2, 2]), rock[0], Math.random() < 0.4);
                    }
                    puff(x, G - sp.h * rnd(0, 0.5), z, pick(rock.slice(0, 3)), rnd(-30, 30), -rnd(10, 40), rnd(0.6, 1.0), 5, 0.5);
                }
                if (sp.off && t > sp.tEnd + 0.35) {
                    if (on && lim > st.gap * 0.6) {
                        // 다시 솟음 — 갈라진 틈을 따라 계속 터져 나옴
                        Object.assign(sp, newSpike(rnd(st.gap * 0.5, lim), t + rnd(0.05, 0.4)));
                    } else {
                        st.items.splice(i, 1);
                    }
                }
            }
            // 앞머리 — 땅을 갈아엎는 흙먼지 · 튀는 빛
            if (on) {
                every(st, 0, dt, D.phase === 'go' ? 45 : 14 + 26 * X.pa + 12 * D.climax, () => {
                    puff(X.front + rnd(-2, 2) * z, G - 2 * z, z, pick(rock.slice(0, 3)), -X.dir * rnd(10, 60), -rnd(30, 110) * (H / 300), rnd(0.6, 1.0), 5, 0.55);
                    if (Math.random() < 0.5) {
                        chunk(X.front, G - z, z, X.dir * rnd(-30, 90), -rnd(0.3, 0.8) * H, grav, G, pick(glow.slice(0, 3)), 1);
                    }
                    if (Math.random() < 0.3) {
                        chunk(X.front - X.dir * st.fbw * 0.3, G - st.fh * rnd(0.2, 0.7), z, rnd(-1, 1) * H * 0.3, -rnd(0.2, 0.6) * H, grav, G, pick(rock), pick([1, 2]), rock[0]);
                    }
                });
            }
            // 용암 분출
            if (st.lava) {
                if (on && st.spouts.length < 2 && lim > st.gap && Math.random() < dt * 1.6) {
                    st.spouts.push({ d: rnd(st.gap * 0.5, lim), t0: t, dur: rnd(0.6, 0.9), h: st.hRef * rnd(0.9, 1.6), w: Math.max(1.5 * z, Math.min(D.W, H) * 0.022 * (0.8 + 0.4 * st.P)), acc: 0, lit: false });
                }
                for (let i = st.spouts.length - 1; i >= 0; i--) {
                    const sp = st.spouts[i];
                    const age = t - sp.t0;
                    const x = along(X, sp.d);
                    if (age > sp.dur + 0.25 || sp.d > len) {
                        st.spouts.splice(i, 1);
                        continue;
                    }
                    if (!sp.lit) {
                        sp.lit = true;
                        sigRing(x, G, z, z * 2, sp.w * 7, 0.25, 0.4, [LAVA[1], LAVA[2], LAVA[3]]);
                    }
                    if (age < sp.dur) {
                        sp.acc += dt * 30;
                        while (sp.acc >= 1) {
                            sp.acc -= 1;
                            chunk(x + rnd(-1, 1) * sp.w, G - sp.h * rnd(0.6, 1), z, rnd(-1, 1) * H * 0.3, -rnd(0.1, 0.5) * Math.sqrt(2 * grav * sp.h), grav, G, pick([LAVA[1], LAVA[2], LAVA[2], LAVA[3]]), pick([1, 1, 2]), LAVA[0], Math.random() < 0.3, 1.6);
                            if (Math.random() < 0.3) {
                                ember(x + rnd(-2, 2) * sp.w, G - sp.h * rnd(0, 0.8), z, LAVA[1], LAVA[3], rnd(-30, 30), -rnd(60, 160), rnd(0.5, 0.9));
                            }
                        }
                    }
                }
            }
        },
        draw(D, X, st) {
            const t = D.t;
            const len = reach(X);
            const G = st.G;
            const { rock, glow } = st;
            const dir = X.dir;
            const xa = X.x0;
            const xb = X.front;
            const fl = (0.85 + 0.15 * Math.sin(t * 23)) * (1 + 0.3 * X.pa);
            if (st.lava) {
                // 열기 — 땅 위 계단 띠
                for (let i = 0; i < 3; i++) {
                    alpha((0.14 - i * 0.04) * (0.8 + 0.2 * Math.sin(t * 9 + i)));
                    fill(xa, G - (i + 1) * 4 * Z, xb, G - i * 4 * Z, LAVA[3]);
                }
            }
            // 땅 빛 띠
            alpha(0.5 * fl);
            fill(xa, G - Z, xb, G, glow[2]);
            alpha(0.25 * fl);
            fill(xa, G - 3 * Z, xb, G - Z, glow[2]);
            alpha(0.1 * fl);
            fill(xa, G - 6 * Z, xb, G - 3 * Z, glow[3]);
            // 갈라진 틈 — 들쭉날쭉한 빛 줄 · 가지
            const step = 3 * Z;
            const n = Math.ceil(len / step);
            const flick = Math.sin(t * 18) > 0;
            const cy = (j) => G - Z - Math.round(hash(st.seed + j, 1) * 2) * Z;
            for (let j = 1; j <= n; j++) {
                const d0 = (j - 1) * step;
                const d1 = Math.min(len, j * step);
                const x0 = along(X, d0);
                const x1 = along(X, d1);
                alpha(0.4);
                line(x0, cy(j - 1), x1, cy(j), glow[3], 4);
                alpha(1);
                line(x0, cy(j - 1), x1, cy(j), flick ? glow[1] : glow[2], 2);
                if (hash(st.seed + j, 2) < 0.18 && d1 < len - step) {
                    let bx = x1;
                    let by = cy(j);
                    for (let k = 0; k < 3; k++) {
                        const nx = bx + dir * (1.5 + hash(j, k + 3)) * Z;
                        const ny = by - (1 + Math.round(hash(j, k + 6))) * Z;
                        line(bx, by, nx, ny, glow[2], 1);
                        bx = nx;
                        by = ny;
                    }
                }
            }
            // 용암 분출
            for (const sp of st.spouts) {
                const age = t - sp.t0;
                if (age < 0) {
                    continue;
                }
                const x = along(X, sp.d);
                const out = age > sp.dur ? 1 - (age - sp.dur) / 0.25 : 1;
                const hh = sp.h * (age < 0.12 ? easeOut(age / 0.12) : out) * (0.85 + 0.15 * Math.sin(t * 30 + sp.d));
                const w = sp.w * out;
                for (let y = sn(G - hh), row = 0; y < G; y += Z, row++) {
                    const f = (G - y) / Math.max(1, hh);
                    const ww = w * (0.6 + 0.4 * Math.sin(row * 0.9 + t * 25)) * (1 + (1 - f) ** 4 * 0.8);
                    alpha(1);
                    fill(x - ww, y, x + ww, y + Z, LAVA[3]);
                    fill(x - ww * 0.55, y, x + ww * 0.55, y + Z, f > 0.85 ? LAVA[2] : LAVA[1]);
                }
                alpha(0.9);
                disc(x, G, w * 3, Z * 1.5, LAVA[3]);
                disc(x, G, w * 1.8, Z, LAVA[2]);
            }
            // 뒤쪽 바위 가시
            for (const sp of st.items) {
                const age = t - sp.t0;
                if (age < 0 || !sp.on) {
                    continue;
                }
                let a = 1;
                let sink = 0;
                if (sp.off) {
                    const k = (t - sp.tEnd) / 0.35;
                    if (k >= 1) {
                        continue;
                    }
                    a = 1 - k * k;
                    sink = k * 0.55;
                }
                const grow = age < 0.09 ? easeOut(age / 0.09) * 1.1 : age < 0.17 ? 1.1 - 0.1 * ((age - 0.09) / 0.08) : 1;
                alpha(a);
                const rc = age < 0.08 ? HOT : age < 0.16 ? [glow[0], glow[1], rock[1], rock[2]] : rock;
                spikeShape(along(X, sp.d), G + Z + sink * sp.h + sp.h * (1 - Math.min(1, grow)), sp.h * Math.max(1, grow), sp.bw, sp.lean, sp.seed, rc, G, st.lava ? (Math.sin(t * 20 + sp.seed) > 0 ? LAVA[1] : LAVA[2]) : null);
            }
            // 틈에서 새어 나오는 빛 줄기 — 막 갈라진 앞쪽일수록 길게
            for (let j = 1; j <= n; j++) {
                const hv = hash(st.seed + j, 4);
                if (hv > 0.4) {
                    continue;
                }
                const d = j * step;
                const fresh = Math.max(0, 1 - (len - d) / (st.hRef * 2));
                const hh = (3 + 6 * hash(j, 5)) * Z * (0.55 + 0.45 * Math.sin(t * 17 + j)) * (1 + 1.2 * fresh) * (1 + 0.4 * X.pa);
                const x = along(X, Math.min(d, len));
                const y = cy(j);
                alpha(0.45 * (0.4 + 0.6 * fresh));
                fill(x - Z, y - hh * 0.7, x + Z, y, glow[2]);
                alpha(0.9 * (0.4 + 0.6 * fresh));
                fill(x - Z / 2, y - hh, x + Z / 2, y, glow[1]);
            }
            if (st.won) {
                return; // 앞머리 가시는 진 쪽 밑에서 솟는 거대 가시(win)로
            }
            // 앞머리 — 가장 큰 가시가 상대를 밀어붙임 (밀 땐 크고 앞으로 기울고, 밀릴 땐 움츠러듦)
            const age = t - (st.pop ?? t);
            const grow = age < 0.09 ? lerp(0.6, 1.12, easeOut(age / 0.09)) : age < 0.17 ? 1.12 - 0.12 * ((age - 0.09) / 0.08) : 1;
            const h = st.fh * grow * (1 + 0.18 * X.pa) * (X.pushing < 0 ? 0.9 : 1) * (1 + 0.025 * Math.sin(t * 37));
            const bw = st.fbw * (1 + 0.1 * X.pa);
            // 밑동은 맞부딪히는 빛 뒤에 보이게 물러서고, 끝은 비스듬히 찔러 들어감
            const lean = dir * (0.3 + 0.1 * X.pa - (X.pushing < 0 ? 0.1 : 0));
            const x = X.front - dir * bw * 0.85;
            const rc = age < 0.06 ? HOT : age < 0.15 ? [glow[0], glow[1], rock[1], rock[2]] : rock;
            const vein = st.lava ? (Math.sin(t * 20) > 0 ? LAVA[1] : LAVA[2]) : null;
            alpha(1);
            spikeShape(x - dir * bw * 0.95, G + Z, h * 0.42, bw * 0.5, -lean * 0.5, st.fseed + 5, rc, G, vein);
            spikeShape(x - dir * bw * 0.55, G + Z, h * 0.62, bw * 0.62, lean * 0.4, st.fseed + 3, rc, G, vein);
            spikeShape(x, G + Z, h, bw, lean, st.fseed, rc, G, vein);
            // 앞머리 밑 — 갈아엎는 빛
            alpha(0.9);
            fill(X.front - 2 * Z, G - 2 * Z, X.front + 2 * Z, G, glow[1]);
            alpha(0.6);
            fill(X.front - Z / 2, G - st.hRef * 0.5 * (0.7 + 0.3 * Math.sin(t * 40)), X.front + Z / 2, G, '#ffffff');
        },
        push(D, X, st, strong) {
            const G = st.G;
            const z = st.Z;
            const x = X.front - X.dir * st.fbw * 0.85;
            if (strong) {
                // 다시 솟구침 — 하얗게 달아오른 가시
                st.pop = D.t;
                st.fseed = rnd(0, 999);
                sigRing(x, G, z, 2 * z, st.fbw * 2.2, 0.2, 0.45, [st.glow[1], '#ffffff', st.glow[2]]);
                sigImpact(x, G - z, z, [st.glow[0], st.glow[1], st.glow[2]], 1, true);
                for (let i = 0; i < 6; i++) {
                    chunk(x + rnd(-0.4, 0.4) * st.fbw, G - st.fh * rnd(0.2, 0.9), z, rnd(-1, 1) * D.H * 0.5, -rnd(0.5, 1) * D.H, D.H * 2.6, G, pick(st.rock), pick([1, 2, 2]), st.rock[0], true);
                }
            } else {
                // 깎여 나감
                for (let i = 0; i < 4; i++) {
                    chunk(X.front, G - st.fh * rnd(0.3, 0.8), z, -X.dir * rnd(30, 120), -rnd(0.1, 0.4) * D.H, D.H * 2.6, G, pick(st.rock), pick([1, 2]), st.rock[0]);
                }
            }
        },
        win(D, X, st, L) {
            // 진 쪽 바로 밑에서 거대 가시가 솟구침
            const G = st.G;
            const z = st.Z;
            const H = D.H;
            const { rock, glow } = st;
            const x = L.body.cx;
            const h = clamp(Math.max(L.h * 2.2, st.hRef * 2.3), 8 * z, G * 0.7);
            const bw = h * 0.55;
            const seeds = [rnd(0, 999), rnd(0, 999), rnd(0, 999)];
            let broke = false;
            art(1.5, z, G, (life) => {
                const grow = life < 0.1 ? easeOut(life / 0.1) * 1.1 : life < 0.18 ? 1.1 - 0.1 * ((life - 0.1) / 0.08) : 1;
                const k = life > 1.1 ? (life - 1.1) / 0.4 : 0;
                const sink = k * 0.55;
                const rc = life < 0.08 ? HOT : life < 0.2 ? [glow[0], glow[1], rock[1], rock[2]] : rock;
                const vein = st.lava ? (Math.sin(life * 20) > 0 ? LAVA[1] : LAVA[2]) : null;
                const yb = (hh) => G + Z + sink * hh + hh * (1 - Math.min(1, grow));
                alpha(1 - k * k);
                spikeShape(x - bw * 0.55, yb(h * 0.5), h * 0.5 * Math.max(1, grow), bw * 0.55, -0.3, seeds[1], rc, G, vein);
                spikeShape(x + bw * 0.55, yb(h * 0.45), h * 0.45 * Math.max(1, grow), bw * 0.5, 0.3, seeds[2], rc, G, vein);
                spikeShape(x, yb(h), h * Math.max(1, grow), bw, 0, seeds[0], rc, G, vein);
                if (life < 0.4) {
                    // 땅을 뚫는 빛
                    alpha((0.4 - life) / 0.4);
                    fill(x - bw * 0.7, G - 2 * Z, x + bw * 0.7, G, glow[1]);
                }
            }, (life) => {
                if (!broke && life >= 1.1) {
                    broke = true;
                    for (let i = 0; i < 12; i++) {
                        chunk(x + rnd(-0.4, 0.4) * bw, G - h * rnd(0.1, 0.9), z, rnd(-1, 1) * H * 0.6, -rnd(0.3, 1) * H, H * 2.6, G, pick(rock), pick([1, 2, 2, 3]), rock[0], Math.random() < 0.4);
                    }
                }
            });
            sigRing(x, G, z, 2 * z, bw * 3, 0.2, 0.5, [glow[1], '#ffffff', glow[2]]);
            sigImpact(x, G - z, z, [glow[0], glow[1], glow[2]], 1, true);
            for (let i = 0; i < 14; i++) {
                chunk(x + rnd(-0.4, 0.4) * bw, G - h * rnd(0.2, 0.8), z, rnd(-1, 1) * H * 0.6, -rnd(0.6, 1.2) * H, H * 2.6, G, pick(rock), pick([1, 2, 2]), rock[0], true);
            }
            for (let i = 0; i < 6; i++) {
                puff(x + rnd(-0.6, 0.6) * bw, G - 2 * z, z, pick(rock.slice(0, 3)), rnd(-60, 60), -rnd(30, 100), rnd(0.7, 1.1), 6, 0.55);
            }
            if (st.lava) {
                for (let i = 0; i < 14; i++) {
                    chunk(x, G - z, z, rnd(-1, 1) * H * 0.4, -rnd(0.5, 1.2) * H, H * 2.6, G, pick([LAVA[1], LAVA[2], LAVA[3]]), pick([1, 2]), LAVA[0], true);
                    ember(x + rnd(-1, 1) * bw * 0.5, G - h * rnd(0, 0.8), z, LAVA[1], LAVA[3], rnd(-40, 40), -rnd(60, 180), rnd(0.5, 1));
                }
            }
        },
    };

    // ── ultpillar — 앞으로 차례차례 기둥이 솟고(무너지면 다시), 앞머리엔 가장 큰 기둥이 벽처럼 밀어붙임 ──
    const PILLAR = {
        charge(D, X, st, k, dt) {
            const G = st.G;
            const z = st.Z;
            const E = st.E;
            if (!st.rang) {
                st.rang = true;
                sigRing(X.x0 + X.dir * st.pw * 0.5, G, z, st.pw * 1.4, st.pw * 0.3, 0.25, DUEL_CHARGE * 0.6, [st.cols[0], st.cols[1]]);
                // 예고 — 땅이 빛나며 고리 · 기둥 자리 양쪽에서 점선이 위로
                const wx = X.x0 + X.dir * st.pw * 0.6;
                const sec = DUEL_CHARGE + 0.1;
                art(sec, z, G, (life) => {
                    const f = life / sec;
                    const a = 0.4 + 0.6 * f;
                    const rx = st.pw * (0.5 + 0.5 * f);
                    alpha(0.35 * a);
                    disc(wx, G, rx, Math.max(Z, rx * 0.16), st.cols[2]);
                    alpha(a * (0.55 + 0.45 * Math.sin(life * 34)));
                    ring(wx, G - Z, rx * 1.15, Math.max(2 * Z, rx * 0.2), 22, life * 3, st.cols[0], st.cols[1]);
                    alpha(0.8 * a);
                    for (const side of [-1, 1]) {
                        for (let j = 0; j < 5; j++) {
                            const yy = G - ((life * 2.4 + j / 5 + (side > 0 ? 0.1 : 0)) % 1) * st.hRef * 1.2 * f;
                            dot(wx + side * st.pw * 0.32, yy, j % 2 ? st.cols[0] : st.cols[1], 1, 2);
                        }
                    }
                });
            }
            if (k > 0.5 && !st.rang2) {
                st.rang2 = true;
                sigRing(X.x0 + X.dir * st.pw * 0.5, G, z, st.pw * 1.2, st.pw * 0.3, 0.25, DUEL_CHARGE * 0.45, [st.cols[1], '#ffffff']);
            }
            // 땅이 들썩 · 모양 기운이 새어 나옴
            every(st, 0, dt, 18 + 30 * k, () => chunk(X.x0 + X.dir * rnd(0, 1.5) * st.pw, G - z, z, rnd(-30, 30), -rnd(0.15, 0.4) * D.H, E.grav, G, pick(DIRT), 1));
            every(st, 1, dt, 10 + 25 * k, () => pillarEmit(st.kind, { x: X.x0 + X.dir * st.pw * 0.6, w: st.pw * 1.2, h: st.hRef }, E, G - st.hRef * 0.6));
        },
        tick(D, X, st, dt) {
            const t = D.t;
            const len = reach(X);
            const E = st.E;
            const on = live(D, X);
            if (st.t1 === undefined) {
                st.t1 = t;
                st.pop = -9;
            }
            const back = len - st.ww * 1.05; // 이보다 뒤에만 기둥
            const cycle = (pl, t0) => {
                pl.tw = t0;
                pl.te = t0 + 0.12;
                pl.tf = pl.te + 0.13 + rnd(0.6, 1.0) + 0.2 * st.P;
                pl.tg = pl.tf + 0.45;
                pl.rest = rnd(0.05, 0.35);
                pl.up = false;
                pl.down = false;
            };
            if (on) {
                while (st.next + st.pw * 0.5 < back) {
                    const d = st.next + st.pw * 0.5;
                    const h = st.kind === 'light' ? E.G + 4 * st.Z : clamp(st.hRef * (1.25 + 0.75 * k01(d / Math.max(1, D.half))) * rnd(0.9, 1.1) * (0.85 + 0.2 * st.P), 6 * st.Z, E.G - 2 * st.Z);
                    const pl = { d, w: st.pw * rnd(0.9, 1.1), h, seed: rnd(0, 999), lean: rnd(-0.06, 0.06), x: along(X, d) };
                    cycle(pl, t);
                    st.items.push(pl);
                    st.next += st.gap * rnd(0.9, 1.1);
                }
            }
            let ups = 0;
            for (const pl of st.items) {
                pl.x = along(X, pl.d);
                const behind = pl.d + pl.w * 0.5 < back;
                if (!behind && t < pl.tf) {
                    // 앞머리가 밀려 물러남 — 아직 안 솟았으면 그만, 솟았으면 무너짐
                    if (t < pl.te) {
                        pl.tg = t;
                        pl.tf = t;
                        pl.up = true;
                        pl.down = true;
                    } else {
                        pl.tf = t;
                        pl.tg = t + 0.45;
                    }
                }
                if (!pl.up && t >= pl.te) {
                    pl.up = true;
                    pillarBurst(st.kind, pl, E, 0.35);
                    sigRing(pl.x, E.G, st.Z, st.Z * 2, pl.w * 1.8, 0.2, 0.4, [st.cols[0], '#ffffff', st.cols[2]]);
                }
                if (pl.up && !pl.down && t >= pl.tf) {
                    pl.down = true;
                    pillarCrumble(st.kind, pl, E, 0.35);
                }
                if (pl.up && !pl.down) {
                    ups++;
                }
                if (t > pl.tg + pl.rest && behind && on) {
                    cycle(pl, t); // 다시 솟음
                }
            }
            if (on) {
                const wall = PILLAR.wall(D, X, st);
                every(st, 0, dt, PILLAR_RATE[st.kind] * (0.6 + 0.4 * X.pa), () => pillarEmit(st.kind, wall, E, E.G - Math.min(wall.h, E.G) * 0.95));
                if (ups) {
                    every(st, 1, dt, PILLAR_RATE[st.kind] * 0.2 * Math.min(4, ups), () => {
                        const pl = pick(st.items.filter((p) => p.up && !p.down));
                        if (pl) {
                            pillarEmit(st.kind, pl, E, E.G - Math.min(pl.h, E.G) * 0.95);
                        }
                    });
                }
            }
        },
        // 앞머리 벽 — 앞 끝이 X.front
        wall(D, X, st) {
            const w = st.ww * (1 + 0.15 * X.pa);
            const h = st.kind === 'light' ? st.wh : st.wh * (1 + 0.1 * X.pa) * (X.pushing < 0 ? 0.93 : 1);
            return { x: X.front - X.dir * w * 0.55, w, h, seed: st.wseed, lean: X.dir * 0.03 * (1 + X.pa) };
        },
        draw(D, X, st) {
            const t = D.t;
            const len = reach(X);
            const E = st.E;
            const G = E.G;
            const cols = st.cols;
            // 쓰는 애에게서 앞머리까지 달려가는 땅 금
            for (let d = 0, j = 0; d < len; d += 2 * Z, j++) {
                const x = along(X, d);
                const y = G - 2 * Z - Math.round(hash(st.seed + j * 0.71) * 1.5) * Z;
                alpha(0.45);
                dot(x - Z, y - Z, cols[2], 3, 3);
                alpha(1);
                dot(x, y, j % 2 ? cols[0] : cols[1], 2, 1);
            }
            // 솟기 전 — 땅이 빛나며 고리
            for (const pl of st.items) {
                const k = (t - pl.tw) / (pl.te - pl.tw);
                if (k < 0 || t > pl.te + 0.2) {
                    continue;
                }
                const a = k > 1 ? 1 - (t - pl.te) / 0.2 : 0.4 + 0.6 * k;
                const rx = pl.w * (0.5 + 0.4 * Math.min(1, k));
                alpha(0.35 * a);
                disc(pl.x, G, rx, Math.max(Z, rx * 0.16), cols[2]);
                alpha(a * (0.55 + 0.45 * Math.sin(t * 34)));
                ring(pl.x, G - Z, rx * 1.15, Math.max(2 * Z, rx * 0.2), 22, t * 3, cols[0], cols[1]);
            }
            if (st.kind === 'ice') {
                for (const pl of st.items) {
                    const s = pillarState(pl, t);
                    if (s) {
                        frost(E, pl.x, pl.w, pl.seed, s.age, 1);
                    }
                }
            }
            for (const pl of st.items) {
                const s = pillarState(pl, t);
                if (s) {
                    PILLAR_DRAW[st.kind](pl, t, s, E);
                }
            }
            if (st.won) {
                return; // 벽은 진 쪽 밑 거대 기둥(win)으로
            }
            // 앞머리 벽 — 처음엔 솟아오르고, 밀어붙일 때마다 한 번 더 들썩
            const wall = PILLAR.wall(D, X, st);
            const age = t - (st.t1 ?? t);
            const r = age / 0.13;
            const bump = Math.sin(Math.PI * k01((t - st.pop) / 0.25));
            const g = (r < 1 ? easeOut(r) * 1.07 : r < 1.6 ? 1.07 - 0.07 * ((r - 1) / 0.6) : 1) * (1 + 0.1 * bump);
            if (st.kind === 'ice') {
                frost(E, wall.x, wall.w, wall.seed, age, 1);
            }
            PILLAR_DRAW[st.kind](wall, t, { age: age + 1, g, k: 0 }, E);
        },
        push(D, X, st, strong) {
            const wall = PILLAR.wall(D, X, st);
            if (strong) {
                st.pop = D.t;
                pillarBurst(st.kind, wall, st.E, 0.5);
                sigRing(wall.x, st.G, st.Z, st.Z * 2, wall.w * 2.6, 0.2, 0.45, [st.cols[0], '#ffffff', st.cols[2]]);
                sigImpact(wall.x, st.G - 2 * st.Z, st.Z, [st.cols[0], '#ffffff', st.cols[1]], 1, true);
            } else {
                pillarCrumble(st.kind, wall, st.E, 0.2);
            }
        },
        win(D, X, st, L) {
            // 진 쪽 바로 밑에서 거대 기둥
            const E = st.E;
            const z = st.Z;
            const G = E.G;
            const pl = {
                x: L.body.cx, w: Math.max(L.w * 1.3, st.ww * 1.2), seed: rnd(0, 999), lean: 0,
                h: st.kind === 'light' ? G + 4 * z : clamp(Math.max(L.h * 2.4, st.hRef * 2.4), 8 * z, G - 2 * z),
                te: 0.02, tf: 1.1, tg: 1.55,
            };
            let fell = false;
            art(1.55, z, G, (life) => {
                const s = pillarState(pl, life);
                if (!s) {
                    return;
                }
                if (st.kind === 'ice') {
                    frost(E, pl.x, pl.w, pl.seed, s.age, 1 - s.k);
                }
                PILLAR_DRAW[st.kind](pl, life, s, E);
            }, (life) => {
                if (!fell && life >= pl.tf) {
                    fell = true;
                    pillarCrumble(st.kind, pl, E, 0.8);
                }
            });
            pillarBurst(st.kind, pl, E, 1);
            sigRing(pl.x, G, z, z * 2, pl.w * 3.2, 0.2, 0.5, [st.cols[0], '#ffffff', st.cols[2]]);
            sigRing(pl.x, G, z, z * 2, pl.w * 4.5, 0.15, 0.65, [st.cols[1], st.cols[3]]);
            sigImpact(pl.x, G - 2 * z, z, [st.cols[0], '#ffffff', st.cols[1]], 1, true);
        },
    };

    // ── ultbloom bloom — 땅을 따라 꽃이 피어 나가고, 앞머리엔 빛기둥 속 거대 꽃이 밀어붙임 ──
    const BLOOM = {
        charge(D, X, st, k, dt) {
            const G = st.G;
            const z = st.Z;
            const tx = X.x0 + X.dir * D.lane * 0.6;
            const ty = G - st.hRef * 0.5;
            // 꽃빛이 한 점으로 모임 · 두근
            every(st, 0, dt, 30 + 60 * k, () => {
                const a = rnd(0, TAU);
                const r = D.lane * rnd(1.5, 3);
                const pc = pick(st.petals);
                mote(tx + Math.cos(a) * r, Math.min(G - z, ty + Math.sin(a) * r * 0.8), tx, ty, z, pick([pc[0], pc[1], '#ffffff', st.beamCols[1]]), rnd(0.25, 0.4), pick([1, 1, 2]));
            });
            for (const [i, at] of [[0, 0.25], [1, 0.55], [2, 0.85]]) {
                if (k >= at && !(st.beats & (1 << i))) {
                    st.beats = (st.beats || 0) | (1 << i);
                    sigRing(tx, ty, z, st.rb * 2.4, st.rb * 0.5, 1, 0.3, [st.beamCols[0], st.flowerC[0]]);
                    sigBurst(tx, ty, z, [st.beamCols[0], st.flowerC[0]], 6, 45);
                }
            }
        },
        tick(D, X, st, dt) {
            const t = D.t;
            const len = reach(X);
            const G = st.G;
            const z = st.Z;
            const H = D.H;
            const on = live(D, X);
            if (st.t1 === undefined) {
                st.t1 = t;
            }
            if (on) {
                while (st.next < len - st.rb * 0.6) {
                    const pc = pick(st.petals);
                    st.items.push({ d: st.next, t0: t, hs: Math.max(3, Math.round(rnd(4, 11) * clamp(st.hRef / 45, 0.6, 1.2))), type: pick(['s', 'm', 'm', 't']), big: Math.random() < 0.2 ? 2 : 1, lc: pc[0], pc: pc[1], ph: rnd(0, TAU) });
                    if (Math.random() < 0.8) {
                        st.tufts.push({ d: st.next + rnd(0.5, 1.5) * z, t0: t, h: Math.round(rnd(2, 4)) });
                    }
                    st.next += rnd(1.8, 3.4) * z;
                }
            }
            // 앞머리에 덮인 꽃은 숨었다 다시 나오면 새로 핌
            for (const fl of st.items) {
                if (fl.d > len) {
                    fl.hid = true;
                } else if (fl.hid) {
                    fl.hid = false;
                    fl.t0 = t;
                }
            }
            if (!on) {
                return;
            }
            const vis = st.items.filter((fl) => !fl.hid && t > fl.t0 + 0.45);
            // 꽃밭에서 꽃잎 · 빛기둥 속 반짝 · 거대 꽃에서 꽃잎 흐름
            every(st, 0, dt, 9, () => {
                const fl = pick(vis);
                if (fl) {
                    flutter(along(X, fl.d), G - (fl.hs + 2) * z, z, fl.pc, rnd(-20, 20), -rnd(20, 60), rnd(0.8, 1.4), { g: 10, sway: 30, hi: fl.lc });
                }
            });
            const r = st.rb;
            const bx = X.front - X.dir * r * 1.2;
            every(st, 1, dt, 14 + 12 * X.pa, () => sparkle(bx + rnd(-1, 1) * r * 1.2, rnd(0.1, 1) * G, z, [st.beamCols[0], '#ffffff', st.beamCols[1]], rnd(-10, 10), -rnd(40, 120) * (H / 300), rnd(0.4, 0.8)));
            every(st, 2, dt, 8 + 14 * X.pa, () => {
                const pc = pick(st.flowerC);
                flutter(bx + rnd(-0.5, 0.5) * r, D.ym + rnd(-0.6, 0.6) * r, z, pc, X.dir * rnd(40, 160), -rnd(20, 90), rnd(0.8, 1.3), { g: 30, sway: 40, hi: '#ffffff', size: pick([1, 2]) });
            });
            if (D.phase === 'go') {
                // 피어 나가는 앞머리에서 반짝
                every(st, 3, dt, 40, () => sparkle(X.front + rnd(-2, 2) * z, G - rnd(0, 0.1) * G, z, [st.beamCols[0], '#ffffff', pick(st.petals)[1]], rnd(-15, 15), -rnd(40, 120) * (H / 300), rnd(0.4, 0.8)));
            }
        },
        draw(D, X, st) {
            const t = D.t;
            const len = reach(X);
            const G = st.G;
            for (const tf of st.tufts) {
                if (tf.d <= len) {
                    drawTuft(tf, along(X, tf.d), G, t);
                }
            }
            alpha(1);
            for (const fl of st.items) {
                if (!fl.hid) {
                    drawFlower(fl, along(X, fl.d), G, t);
                }
            }
            if (st.won) {
                return; // 거대 꽃은 진 쪽에 내리꽂는 빛기둥(win)으로
            }
            // 앞머리 — 빛기둥 속 거대 꽃
            const r = st.rb * (1 + 0.15 * X.pa) * (X.pushing < 0 ? 0.88 : 1);
            const bx = X.front - X.dir * r * 1.2;
            const by = clamp(D.ym, r + 2 * Z, G - r * 0.6);
            const w0 = Math.min(r * 1.2, D.half * 0.3) * (1 + 0.25 * X.pa) * (0.95 + 0.05 * Math.sin(t * 40));
            const open = easeOut((t - (st.t1 ?? t)) / 0.3);
            lightBeam(bx, w0 * Math.max(0.2, open), G, t, st.beamCols, 0.5 + 0.25 * X.pa);
            alpha(0.8);
            disc(bx, 0, w0 * 1.5, 3 * Z, st.beamCols[1]);
            // 땅 빛 · 내려오는 고리
            alpha(0.7 + 0.3 * Math.sin(t * 30));
            disc(bx, G, w0 * 1.5, Math.max(2 * Z, w0 * 0.18), st.beamCols[1]);
            for (let j = 0; j < 2; j++) {
                alpha(0.7);
                ring(bx, ((t * 1.5 + j / 2) % 1) * G, w0 * 1.1, Math.max(Z, w0 * 0.15), 20, t * 5 + j, '#ffffff', st.beamCols[1]);
            }
            // 줄기 · 큰 잎
            alpha(1);
            const hF = G - by;
            const sw = Math.max(Z, r * 0.14);
            const stemX = (y) => bx + Math.sin(((G - y) / Math.max(1, hF)) * 3.2) * r * 0.25;
            for (let y = G; y > by; y -= Z) {
                const x = stemX(y);
                fill(x - sw, y - Z, x + sw, y, STEM[1]);
                dot(x - sw, y - Z, STEM[0]);
                dot(x + sw - Z, y - Z, STEM[2]);
            }
            for (const [fy, side] of [[0.3, -1], [0.6, 1]]) {
                const ly = G - hF * fy;
                const lx = stemX(ly) + side * r * 0.7;
                disc(lx, ly, r * 0.7, r * 0.26, STEM[1]);
                disc(lx - side * r * 0.1, ly - r * 0.08, r * 0.45, r * 0.1, STEM[0]);
            }
            // 꽃 — 꽃잎 두 겹이 빙글
            const rr = r * (0.5 + 0.5 * open) * (1 + 0.04 * Math.sin(t * 8));
            const fc = st.flowerC;
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * TAU + t * 0.6 * X.dir;
                disc(bx + Math.cos(a) * rr * 0.85, by + Math.sin(a) * rr * 0.75, rr * 0.5, rr * 0.42, i % 2 ? fc[1] : fc[2]);
            }
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * TAU - t * 0.8 * X.dir;
                disc(bx + Math.cos(a) * rr * 0.42, by + Math.sin(a) * rr * 0.38, rr * 0.3, rr * 0.26, fc[0]);
            }
            disc(bx, by, rr * 0.3, rr * 0.3, '#ffd23f');
            ring(bx, by, rr * 0.22, rr * 0.22, 8, t * 2, '#e8a000', '#fff3a0');
        },
        push(D, X, st, strong) {
            const r = st.rb;
            const bx = X.front - X.dir * r * 1.2;
            const by = clamp(D.ym, r + 2 * st.Z, st.G - r * 0.6);
            const z = st.Z;
            if (strong) {
                sigRing(bx, by, z, r * 0.5, r * 3.2, 0.9, 0.4, [st.flowerC[0], '#ffffff', st.flowerC[1]]);
                for (let i = 0; i < 14; i++) {
                    const a = rnd(0, TAU);
                    const sp = rnd(60, 180);
                    flutter(bx, by, z, pick(st.flowerC), Math.cos(a) * sp + X.dir * 60, Math.sin(a) * sp - 40, rnd(0.8, 1.3), { g: 50, sway: 40, hi: '#ffffff', size: pick([1, 2]) });
                }
                for (let i = 0; i < 6; i++) {
                    sparkle(bx + rnd(-1, 1) * r, by + rnd(-1, 1) * r, z, st.beamCols, rnd(-30, 30), -rnd(30, 90), rnd(0.4, 0.8));
                }
            } else {
                for (let i = 0; i < 6; i++) {
                    flutter(bx, by, z, pick(st.flowerC), -X.dir * rnd(30, 120), -rnd(10, 60), rnd(0.8, 1.2), { g: 60, sway: 40 });
                }
            }
        },
        win(D, X, st, L) {
            // 진 쪽에 하늘 빛기둥이 내리꽂힘 · 꽃잎 폭풍
            const G = st.G;
            const z = st.Z;
            const cx = L.body.cx;
            const bw = Math.max(L.w * 1.8, st.rb * 3.2);
            const tLand = 0.12;
            const tE = 1.0;
            const rays = [];
            for (let i = 0; i < 10; i++) {
                rays.push({ x: cx + rnd(-1.6, 1.6) * bw, h: G * rnd(0.15, 0.45), c: pick([...st.flowerC, st.beamCols[1]]), ph: rnd(0, TAU) });
            }
            let landed = false;
            art(1.45, z, G, (life) => {
                const drop = easeIn(life / tLand);
                const bottom = G * Math.min(1, drop);
                const narrow = life > tE ? 1 - easeIn((life - tE) / 0.4) : 1;
                const burst = life > tLand ? Math.max(0, 1 - (life - tLand) / 0.25) : 0;
                const w0 = (bw / 2) * narrow * (1 + 0.5 * burst);
                // 꽃밭 곳곳에서 솟는 가는 빛살
                const rk = (life - tLand) / 0.9;
                if (rk > 0 && rk < 1) {
                    for (const r of rays) {
                        const hh = r.h * easeOut(rk * 4) * (0.7 + 0.3 * Math.sin(life * 25 + r.ph));
                        alpha(0.85 * (1 - rk));
                        fill(r.x - Z / 2, G - hh, r.x + Z / 2, G, r.c);
                        dot(r.x - Z / 2, G - hh - Z, '#ffffff');
                    }
                }
                if (w0 < Z * 0.5) {
                    return;
                }
                lightBeam(cx, w0, bottom, life, st.beamCols, 1);
                alpha(0.8 * narrow);
                disc(cx, 0, w0 * 1.5, 3 * Z, st.beamCols[1]);
                if (drop < 1) {
                    alpha(1);
                    disc(cx, bottom, w0 * 0.7, w0 * 0.35, '#ffffff');
                    return;
                }
                alpha(0.8 * narrow);
                disc(cx, G, w0 * 1.6, Math.max(2 * Z, w0 * 0.18), st.beamCols[1]);
                for (let j = 0; j < 3; j++) {
                    alpha(0.8 * narrow);
                    ring(cx, ((life * 1.5 + j / 3) % 1) * G, w0 * 1.1, Math.max(Z, w0 * 0.15), 24, life * 5 + j, '#ffffff', st.beamCols[1]);
                }
            }, (life) => {
                if (!landed && life >= tLand) {
                    landed = true;
                    sigRing(cx, G, z, bw * 0.3, bw * 3, 0.13, 0.6, [st.beamCols[0], '#ffffff', st.beamCols[2]]);
                    for (let i = 0; i < 30; i++) {
                        const a = rnd(0, TAU);
                        const sp = rnd(60, 240);
                        flutter(cx, L.body.cy, z, pick(st.flowerC), Math.cos(a) * sp, Math.sin(a) * sp - 60, rnd(0.9, 1.6), { g: 70, sway: 50, hi: '#ffffff', size: 2 });
                    }
                    for (let i = 0; i < 18; i++) {
                        sparkle(cx + rnd(-0.5, 0.5) * bw, rnd(0.2, 1) * G, z, st.beamCols, rnd(-30, 30), -rnd(40, 160), rnd(0.5, 1));
                    }
                }
            });
        },
    };

    // ── ultbloom vine — 굵은 가시 덩굴이 땅을 기어 나가고, 앞머리에선 덩굴 끝이 솟아 채찍질 ──
    const VINE_DARK = '#163a14';
    // 덩굴 끝 — 휘두르는 정도 · 끝 자리 (끝은 front · ym 둘레)
    function vineTip(D, X, st, v, t) {
        const z = st.Z;
        const sw = Math.sin(t * v.w + v.ph);
        const lying = st.G - z * (v.T / 2 + 0.5);
        const ty = clamp(D.ym + v.off * D.lane * 0.5 + sw * D.lane * 0.45 * (1 + 0.8 * X.pa), z * 3, lying);
        return { sw, lying, tx: X.front - X.dir * Math.abs(sw) * D.lane * 0.3, ty };
    }
    // 덩굴 한 줄 — [x, y, 굵기] 점들. 땅을 아치로 기어 나가다, 앞머리에서 맞부딪히는 곳 위로 솟아 갈고리처럼 내리침
    function vinePts(D, X, st, v, t) {
        const len = reach(X);
        const { sw, lying, tx, ty } = vineTip(D, X, st, v, t);
        const rr = Math.min(len * 0.75, st.hRef * 2.2);
        const gl = len - rr;
        const nG = clamp(Math.ceil(gl / (3 * Z)), 1, 50);
        const pts = [];
        for (let i = 0; i <= nG; i++) {
            const u = (gl * i) / nG;
            const arch = Math.abs(Math.sin((u / v.per) * Math.PI + v.ph + t * 1.3)) * v.hump * k01(u / (v.per * 0.5));
            pts.push([along(X, u), lying - arch, v.T]);
        }
        // 솟는 갈고리 — 꼭대기가 맞부딪히는 빛 위로 보이게 (2차 곡선)
        const [x0, y0] = pts[pts.length - 1];
        const apex = clamp(D.ym - D.lane * (2 + 0.35 * v.off) - sw * D.lane * 0.5 * (1 + X.pa), Z * 3, lying);
        const x1 = along(X, gl + rr * 0.7);
        const y1 = Math.max(Z, 2 * apex - (y0 + ty) / 2);
        const nR = 16;
        for (let i = 1; i <= nR; i++) {
            const s = i / nR;
            const a = (1 - s) * (1 - s);
            const b = 2 * (1 - s) * s;
            const c = s * s;
            pts.push([a * x0 + b * x1 + c * tx, Math.min(lying, a * y0 + b * y1 + c * ty), Math.max(1, Math.round(v.T * (1 - 0.65 * s)))]);
        }
        return pts;
    }
    function drawVineLine(v, pts, cols) {
        const n = pts.length - 1;
        // 휘두르는 자취
        if (v.trail.length >= 4) {
            for (let i = 2; i < v.trail.length; i += 2) {
                const k = i / v.trail.length;
                alpha(0.5 * (1 - k));
                line(v.trail[i - 2], v.trail[i - 1], v.trail[i], v.trail[i + 1], cols[1], 4 - Math.round(2 * k));
                alpha(0.9 * (1 - k));
                line(v.trail[i - 2], v.trail[i - 1], v.trail[i], v.trail[i + 1], '#ffffff', 2 - Math.round(k));
            }
        }
        // 테두리 → 몸통 → 밝은 줄
        for (let pass = 0; pass < 3; pass++) {
            alpha(1);
            for (let i = 0; i < n; i++) {
                const [xa, ya, th] = pts[i];
                const [xb, yb] = pts[i + 1];
                if (pass === 0) {
                    line(xa, ya, xb, yb, VINE_DARK, th + 2);
                } else if (pass === 1) {
                    line(xa, ya, xb, yb, i % 4 === 3 ? cols[3] : cols[2], th);
                } else if (th >= 3) {
                    line(xa - Z, ya - Z, xb - Z, yb - Z, cols[1], th - 2);
                }
            }
        }
        // 잎 · 가시
        for (let i = 1; i < n; i++) {
            const [xa, ya, th] = pts[i];
            const dx = pts[i + 1][0] - xa;
            const dy = pts[i + 1][1] - ya;
            const L = Math.hypot(dx, dy) || 1;
            let nx = -dy / L;
            let ny = dx / L;
            if (ny > 0) {
                nx = -nx;
                ny = -ny; // 바깥(위)쪽
            }
            const side = i % 2 ? 1 : -1;
            if (i % 5 === 0) {
                const lx = xa + nx * side * (th / 2 + 1.5) * Z;
                const ly = ya + ny * side * (th / 2 + 1.5) * Z;
                disc(lx, ly, 2.2 * Z, 1.3 * Z, cols[1]);
                dot(lx - Z, ly - Z, cols[0], 2, 1);
            } else if (i % 2 === 0) {
                // 가시 — 진한 밑동 · 밝은 끝
                dot(xa + nx * (th / 2 + 0.5) * Z, ya + ny * (th / 2 + 0.5) * Z, VINE_DARK);
                dot(xa + nx * (th / 2 + 1.5) * Z, ya + ny * (th / 2 + 1.5) * Z, '#e6ffb8');
            }
        }
    }
    const VINE = {
        charge(D, X, st, k, dt) {
            const G = st.G;
            const z = st.Z;
            if (!st.rang) {
                st.rang = true;
                sigRing(X.x0, G, z, z * 2, D.lane * 1.6, 0.25, 0.35, [st.cols[1], DIRT[1]]);
            }
            // 땅속에서 꿈틀 — 흙 · 잎
            every(st, 0, dt, 14 + 22 * k, () => chunk(X.x0 + X.dir * rnd(-0.5, 1.5) * D.lane, G - z, z, rnd(-30, 30), -rnd(0.15, 0.45) * D.H, D.H * 2.4, G, pick(DIRT), pick([1, 2]), DIRT[0]));
            every(st, 1, dt, 5 + 12 * k, () => flutter(X.x0 + X.dir * rnd(0, 1) * D.lane, G - rnd(0, 2) * z, z, pick([st.cols[1], st.cols[2], st.cols[0]]), rnd(-40, 40), -rnd(40, 120), rnd(0.8, 1.2), { g: 60, sway: 40 }));
        },
        tick(D, X, st, dt) {
            const t = D.t;
            const on = live(D, X);
            const G = st.G;
            const z = st.Z;
            for (const v of st.vines) {
                const { tx, ty } = vineTip(D, X, st, v, t);
                // 휘두르는 동안 끝 자취
                if (X.pa > 0.25 && on) {
                    v.trail.unshift(tx, ty);
                    v.trail.length = Math.min(v.trail.length, 10);
                } else {
                    v.trail.length = 0;
                }
                // 한 번 휘두를 때마다 맞부딪히는 곳에 착
                const q = Math.floor((t * v.w + v.ph) / Math.PI);
                if (q !== v.q) {
                    v.q = q;
                    if (on && D.phase === 'push' && Math.random() < 0.6) {
                        sigImpact(tx, ty, z, [st.cols[0], '#ffffff', st.cols[1]], 0.3, false);
                        flutter(tx, ty, z, pick([st.cols[1], st.cols[2]]), -X.dir * rnd(40, 120), -rnd(40, 120), rnd(0.8, 1.2), { g: 80, sway: 40 });
                    }
                }
            }
            if (on) {
                every(st, 0, dt, 7 + 6 * X.pa, () => {
                    const v = pick(st.vines);
                    const pts = v.pts;
                    if (pts && pts.length) {
                        const p = pick(pts);
                        flutter(p[0], p[1], z, pick([st.cols[1], st.cols[2], st.cols[0]]), rnd(-60, 60), -rnd(30, 90), rnd(0.8, 1.3), { g: 60, sway: 40 });
                    }
                });
                if (D.phase === 'go') {
                    every(st, 1, dt, 30, () => chunk(X.front, G - z, z, rnd(-40, 40), -rnd(0.2, 0.5) * D.H, D.H * 2.4, G, pick(DIRT), 1));
                }
            }
        },
        draw(D, X, st) {
            const t = D.t;
            const G = st.G;
            if (reach(X) < Z) {
                return;
            }
            // 뿌리 둔덕
            alpha(1);
            for (const v of st.vines) {
                v.pts = vinePts(D, X, st, v, t);
                drawVineLine(v, v.pts, st.cols);
            }
            const T = st.vines[0].T;
            disc(X.x0, G, T * Z * 1.4, Z * 1.5, DIRT[2]);
            dot(X.x0 - Z, G - Z, DIRT[1], 2, 1);
        },
        push(D, X, st, strong) {
            const z = st.Z;
            const tx = X.front;
            const ty = D.ym;
            if (strong) {
                sigImpact(tx, ty, z, [st.cols[0], '#ffffff', st.cols[1]], 1, true);
                sigRing(tx, ty, z, z * 2, D.lane * 2.4, 0.6, 0.35, [st.cols[0], '#ffffff', st.cols[2]]);
                for (let i = 0; i < 10; i++) {
                    flutter(tx, ty, z, pick([st.cols[1], st.cols[2], st.cols[0]]), rnd(-1, 1) * 160, -rnd(60, 200), rnd(0.9, 1.4), { g: 100, sway: 40 });
                }
            } else {
                for (let i = 0; i < 5; i++) {
                    flutter(tx, ty, z, pick([st.cols[1], st.cols[2]]), -X.dir * rnd(30, 120), -rnd(20, 80), rnd(0.8, 1.2), { g: 80, sway: 40 });
                }
            }
        },
        win(D, X, st, L) {
            // 진 쪽 밑에서 거대 덩굴이 솟아 휘감음
            const z = st.Z;
            const G = st.G;
            const E = { G, H: D.H, cols: st.cols, P: st.P, z, grav: D.H * 2.4 };
            const pl = { x: L.body.cx, w: Math.max(L.w * 1.5, st.hRef * 0.9), seed: rnd(0, 999), lean: 0, h: clamp(Math.max(L.h * 2.4, st.hRef * 2.4), 8 * z, G - 2 * z), te: 0.02, tf: 1.1, tg: 1.55 };
            let fell = false;
            art(1.55, z, G, (life) => {
                const s = pillarState(pl, life);
                if (s) {
                    PILLAR_DRAW.vine(pl, life * 3, s, E);
                }
            }, (life) => {
                if (!fell && life >= pl.tf) {
                    fell = true;
                    pillarCrumble('vine', pl, E, 1);
                }
            });
            pillarBurst('vine', pl, E, 1.4);
            sigRing(pl.x, G, z, z * 2, pl.w * 3, 0.2, 0.5, [st.cols[0], '#ffffff', st.cols[2]]);
            sigImpact(pl.x, G - 2 * z, z, [st.cols[0], '#ffffff', st.cols[1]], 1, true);
        },
    };

    // ═════════════════ tornado — 회오리 기둥이 나아가 앞쪽 옆구리로 상대를 갈아 댐 (ultvortex) ═════════════════
    const VORTEX_BITS = { water: 'drop', ice: 'drop', fire: 'ember', wind: 'leaf', grass: 'leaf', normal: 'leaf', silver: 'leaf', petal: 'leaf', ground: 'rock', rock: 'rock', steel: 'rock', bone: 'rock', spore: 'rock' };
    function tornSt(D, X) {
        const st = base(D, X);
        if (st.cc) {
            return st;
        }
        const o = X.o || {};
        const z = st.Z;
        const P = st.P;
        const c = o.c || 'water';
        const cols = (st.cols = sigPal(c));
        const bits = (st.bits = VORTEX_BITS[c] || 'spark');
        const rockC = (st.rockC = sigPal('rock'));
        st.bitCols = bits === 'drop' ? ['#ffffff', cols[0], cols[1], cols[1]] : bits === 'ember' ? [cols[0], cols[1], cols[1], cols[2]] : bits === 'leaf' ? ['#8be04e', '#4cae3c', '#c9a050', cols[2]] : bits === 'rock' ? [rockC[1], rockC[2], cols[1], cols[2]] : [cols[0], cols[1], cols[2]];
        st.n = Number(o.n) >= 2 ? 2 : 1;
        st.rTop = Math.min(clamp(Math.min(D.W * 0.13, D.H * 0.34), 6 * z, 120) * (0.75 + 0.35 * P) * (st.n === 2 ? 0.85 : 1), Math.max(6 * z, D.half * 0.5));
        st.Hc = st.G + 6 * z;
        st.H = D.H;
        st.spin = X.dir * (5.5 + 2 * P);
        st.streaks = 4 + (P > 0.7 ? 1 : 0);
        st.body = bits === 'ember' ? [cols[2], 0.26] : [cols[3], 0.18];
        st.back = bits === 'ember' ? [cols[3], 0.6] : [cols[2], 0.4];
        st.grav = D.H * 2.2;
        st.form = 0;
        st.widen = 1;
        st.cc = [];
        const nb = Math.round((30 + 40 * P) * (st.n === 2 ? 0.7 : 1));
        for (let i = 0; i < st.n; i++) {
            const col = { lead: i === 0, phase: rnd(0, TAU), bits: [], vis: 0, acc: 0, cx: X.x0, show: i === 0 ? 1 : 0 };
            for (let j = 0; j < nb; j++) {
                col.bits.push(tornBit(st, rnd(0, 1)));
            }
            st.cc.push(col);
        }
        return st;
    }
    const tornBit = (st, fr) => ({ th: rnd(0, TAU), h: fr * st.Hc, rf: rnd(0.75, 1.3), rise: st.Hc * rnd(0.22, 0.5), sm: rnd(0.8, 1.3), size: st.bits === 'rock' ? pick([2, 2, 3]) : pick([1, 1, 2]), col: pick(st.bitCols), ph: rnd(0, 10) });
    const rAt = (st, fr) => {
        const b = st.rTop * 0.16 + st.rTop * 0.84 * Math.pow(Math.max(0, fr), 0.85);
        return fr > 0.85 ? b * (1 + (fr - 0.85) * 2.4) : b;
    };
    // 기둥 축 — 흔들림 + 밀릴 땐 위가 뒤로 젖혀짐
    function axAt(st, col, h, t, X) {
        const sway = (Math.sin(t * 1.8 + (h / st.H) * 2.4 + col.phase) * 0.16 + Math.sin(t * 3.1 + (h / st.H) * 5 + col.phase * 2) * 0.05) * st.rTop * (h / st.Hc);
        const lean = col.lead && !st.won ? X.dir * (h / st.Hc) * st.rTop * (X.pushing < 0 ? -0.35 : 0.1 * X.pa) : 0;
        return col.cx + sway + lean;
    }
    function tornFling(st, x, y, vx, vy, max = 1.4) {
        const z = st.Z;
        switch (st.bits) {
            case 'ember':
                ember(x, y, z, pick(st.cols.slice(0, 2)), st.cols[2], vx, vy, max * 0.7);
                break;
            case 'leaf':
                flutter(x, y, z, pick(st.bitCols), vx, vy, max, { g: 60, sway: 40 });
                break;
            case 'spark':
                sparkle(x, y, z, st.cols, vx, vy, max * 0.5);
                break;
            default:
                chunk(x, y, z, vx, vy, st.grav, st.G, pick(st.bitCols), st.bits === 'rock' ? 2 : 1, st.bits === 'rock' ? st.rockC[0] : undefined, st.bits === 'drop' && Math.random() < 0.3, max);
        }
    }
    const TORNADO = {
        charge(D, X, k, dt) {
            const st = tornSt(D, X);
            const G = st.G;
            const z = st.Z;
            const cx = X.x0 + X.dir * D.lane * 0.6;
            if (!st.rang) {
                st.rang = true;
                sigRing(cx, G, z, D.lane * 2.2, D.lane * 0.3, 0.22, DUEL_CHARGE * 0.7, [st.cols[0], st.cols[1]]);
            }
            // 발밑에서 바람이 빙글빙글 감겨 오름
            every(st, 0, dt, 30 + 60 * k, () => {
                if (!room()) {
                    return;
                }
                const r0 = D.lane * rnd(0.6, 1.6);
                const rise = st.hRef * rnd(1, 2.4);
                sigParticle({ x: cx, y: G - z, s: z, max: rnd(0.4, 0.7), a0: rnd(0, TAU), r0, rise, color: pick(st.bitCols),
                    update: (p) => {
                        const f = p.life / p.max;
                        const a = p.a0 + p.life * st.spin * 1.6;
                        const r = p.r0 * (1 - 0.4 * f) * (0.5 + f);
                        p.x = cx + Math.cos(a) * r;
                        p.y = G - z - f * p.rise + Math.sin(a) * r * 0.2;
                    },
                    draw: DRAW.dot });
            });
            every(st, 1, dt, 8 + 14 * k, () => puff(cx + rnd(-1, 1) * D.lane, G - z, z, pick(DIRT.slice(0, 3)), rnd(-40, 40), -rnd(5, 30), rnd(0.5, 0.8), 3, 0.5));
        },
        tick(D, X, dt) {
            const st = tornSt(D, X);
            const t = D.t;
            const len = reach(X);
            const on = live(D, X);
            const z = st.Z;
            const G = st.G;
            st.form = Math.min(1, st.form + dt / 0.45);
            st.widen = st.won ? lerp(st.widen, 1.35, 1 - Math.exp(-dt * 6)) : (1 + 0.15 * X.pa) * (X.pushing < 0 ? 0.88 : 1);
            // 자리 — 앞장선 기둥은 ym 높이 옆구리가 front, 진 쪽에 닿으면 그 애를 한가운데로 삼킴
            const frY = clamp((G - D.ym) / st.Hc, 0, 1);
            const lead = st.cc[0];
            if (st.won) {
                lead.cx = lerp(lead.cx, X.front, 1 - Math.exp(-dt * 12));
            } else {
                lead.cx = X.front - X.dir * Math.max(rAt(st, frY) * st.widen, st.rTop * 0.3);
            }
            if (st.n === 2) {
                const c2 = st.cc[1];
                c2.cx = X.x0 + X.dir * len * 0.4;
                const want = len > st.rTop * 2.8 && !st.burst ? 1 : 0;
                c2.show = clamp(c2.show + (want ? dt : -dt) / 0.35, 0, 1);
            }
            for (const col of st.cc) {
                col.vis = st.Hc * easeOut(st.form) * col.show;
                if (st.burst) {
                    continue;
                }
                for (const b of col.bits) {
                    b.th += st.spin * b.sm * dt * (1.35 - 0.5 * (b.h / st.Hc)) * (st.won ? 1.6 : 1);
                    b.h += b.rise * dt;
                    if (b.h > col.vis) {
                        b.h = rnd(0, 0.08) * st.Hc;
                        b.th = rnd(0, TAU);
                    }
                }
                if (on && col.vis > st.Hc * 0.3) {
                    every(st, col.lead ? 0 : 1, dt, col.lead ? 20 : 10, () => {
                        const fr = rnd(0.05, 0.9) * (col.vis / st.Hc);
                        const h = fr * st.Hc;
                        const side = Math.random() < 0.5 ? -1 : 1;
                        tornFling(st, axAt(st, col, h, t, X) + side * rAt(st, fr), G - h, side * rnd(60, 180) * (D.W / 480), -rnd(20, 120), 1.4);
                    });
                }
            }
            if (on && D.phase === 'push') {
                // 맞부딪히는 곳 — 갈려 튀는 조각
                every(st, 2, dt, 10 + 22 * X.pa + 10 * D.climax, () => tornFling(st, X.front, D.ym + rnd(-0.6, 0.6) * D.lane, -X.dir * rnd(40, 160), -rnd(60, 200), 1.2));
            }
            if (on) {
                every(st, 3, dt, 8, () => puff(lead.cx + rnd(-1, 1) * st.rTop * 0.5, G - z, z, pick(DIRT.slice(0, 3)), rnd(-40, 40), -rnd(5, 30), rnd(0.5, 0.8), 3, 0.45));
            }
            // 삼키고 펑 — 감겨 있던 것들이 사방으로
            if (st.won && !st.burst && t >= st.wonT + 0.55) {
                st.burst = t;
                for (const col of st.cc) {
                    sigRing(col.cx, G, z, st.rTop * 0.3, st.rTop * 3.2, 0.22, 0.55, [st.cols[0], '#ffffff', st.cols[1]]);
                    sigRing(col.cx, G - st.Hc * 0.45, z, st.rTop * 0.3, st.rTop * 2.4, 0.55, 0.5, [st.cols[1], st.cols[2]]);
                    sigImpact(col.cx, G - st.Hc * 0.3, z, [st.cols[0], '#ffffff', st.cols[1]], 1, true);
                    for (const b of col.bits.slice(0, 40)) {
                        if (b.h > col.vis) {
                            continue;
                        }
                        const r = rAt(st, b.h / st.Hc) * b.rf * st.widen;
                        tornFling(st, axAt(st, col, b.h, t, X) + Math.cos(b.th) * r, G - b.h, Math.cos(b.th) * rnd(150, 380) * (D.W / 480), -rnd(40, 260) * (D.H / 300), 1.6);
                    }
                }
                if (st.bits === 'drop') {
                    for (let i = 0; i < 20; i++) {
                        chunk(lead.cx + rnd(-1.5, 1.5) * st.rTop, -rnd(0, 0.3) * D.H, z, rnd(-20, 20), rnd(0.2, 0.6) * D.H, st.grav, G, pick(['#ffffff', st.cols[1], st.cols[2]]), 1, undefined, true, 2.2);
                    }
                }
            }
        },
        draw(ctx, px, D, X) {
            const st = tornSt(D, X);
            paint(ctx, st.Z, X.fade, st.G, () => {
                const t = D.t;
                TORNADO.wake(D, X, st, t);
                for (const col of st.cc) {
                    TORNADO.base(st, col, t, 0);
                    TORNADO.bits(st, col, t, 0, X);
                }
                for (const col of st.cc) {
                    TORNADO.column(st, col, t, 0, X);
                }
                for (const col of st.cc) {
                    TORNADO.column(st, col, t, 1, X);
                }
                for (const col of st.cc) {
                    TORNADO.bits(st, col, t, 1, X);
                    TORNADO.base(st, col, t, 1);
                }
            });
        },
        // 쓰는 애에게서 회오리 밑동까지 — 땅을 타고 빨려 드는 바람 줄 · 납작한 소용돌이
        wake(D, X, st, t) {
            const G = st.G;
            const lead = st.cc[0];
            const from = X.x0;
            const L = (lead.cx - X.dir * st.rTop * 0.3 - from) * X.dir;
            if (L < 2 * Z) {
                return;
            }
            for (let s = 0; s < 2; s++) {
                for (let d = 0; d < L; d += Z) {
                    const k = d / L;
                    const y = G - Z - (1 + Math.sin(d * 0.07 - t * 16 + s * Math.PI)) * (1.5 + 4 * k) * Z * 0.5;
                    alpha((0.3 + 0.6 * k) * (s ? 0.7 : 1));
                    dot(along(X, d), y, (Math.floor(d / Z) + s * 3) % 6 ? st.cols[1] : '#ffffff');
                }
            }
            const step = Math.max(st.rTop * 0.9, 6 * Z);
            for (let d = step * 0.5; d < L; d += step) {
                const k = d / L;
                const rx = st.rTop * (0.2 + 0.25 * k);
                alpha(0.25 + 0.5 * k);
                ring(along(X, d), G - Z, rx, Math.max(Z, rx * 0.2), 12, t * st.spin * 1.2 + d, '#ffffff', st.cols[1]);
            }
        },
        base(st, col, t, pass) {
            const k = st.form * col.show;
            if (k <= 0) {
                return;
            }
            const end = st.burst ? Math.max(0, 1 - (t - st.burst) / 0.6) : 1;
            if (end <= 0) {
                return;
            }
            const grow = (st.burst ? 1 + (t - st.burst) * 2 : 1) * st.widen;
            for (let i = 0; i < 3; i++) {
                const rx = st.rTop * (0.45 + 0.42 * i) * (0.4 + 0.6 * k) * grow;
                const ry = Math.max(2 * Z, rx * 0.17);
                const m = 18 + i * 6;
                for (let j = 0; j < m; j++) {
                    const a = (j / m) * TAU + t * st.spin * (1.5 - 0.35 * i);
                    const dep = Math.sin(a);
                    if ((dep > 0) !== (pass === 1)) {
                        continue;
                    }
                    alpha((pass ? 0.95 : 0.4) * end);
                    dot(col.cx + Math.cos(a) * rx, st.G + dep * ry - Z, j % 3 ? st.cols[1] : '#ffffff', 2, 1);
                }
            }
            if (pass === 0) {
                alpha(0.35 * end);
                disc(col.cx, st.G, st.rTop * 0.35 * k * grow, Math.max(Z, st.rTop * 0.06), st.cols[3]);
            }
        },
        bits(st, col, t, pass, X) {
            if (st.burst) {
                return;
            }
            const G = st.G;
            for (const b of col.bits) {
                if (b.h > col.vis) {
                    continue;
                }
                const r = rAt(st, b.h / st.Hc) * b.rf * st.widen;
                const dep = Math.sin(b.th);
                if ((dep > 0) !== (pass === 1)) {
                    continue;
                }
                const x = axAt(st, col, b.h, t, X) + Math.cos(b.th) * r;
                const y = G - b.h + dep * r * 0.18;
                alpha(pass ? 1 : 0.45);
                if (st.bits === 'leaf') {
                    const flat = Math.floor(t * 12 + b.ph) % 2;
                    dot(x, y, b.col, flat ? 2 : 1, flat ? 1 : 2);
                } else if (st.bits === 'rock') {
                    dot(x, y, b.col, b.size, b.size);
                    dot(x, y, st.rockC[0], b.size - 1, 1);
                } else if (st.bits === 'spark') {
                    dot(x, y, '#ffffff');
                    if (pass) {
                        dot(x - Z, y, b.col);
                        dot(x + Z, y, b.col);
                        dot(x, y - Z, b.col);
                        dot(x, y + Z, b.col);
                    }
                } else {
                    dot(x, y, b.col, b.size, st.bits === 'drop' ? b.size + 1 : b.size);
                }
            }
        },
        column(st, col, t, pass, X) {
            const bk = st.burst ? (t - st.burst) / 0.4 : 0;
            if (bk >= 1 || col.vis < Z) {
                return;
            }
            const G = st.G;
            const cols = st.cols;
            const fade = 1 - bk;
            const widen = (1 + 1.6 * bk) * st.widen;
            const spin = st.spin * (st.won ? 1.5 : 1) * (1 + 0.3 * X.pa);
            for (let h = 0, row = 0; h < col.vis; h += Z, row++) {
                const y = G - h;
                if (y < -Z) {
                    break;
                }
                const fr = h / st.Hc;
                const r = rAt(st, fr) * widen;
                const ax = axAt(st, col, h, t, X);
                if (pass === 0) {
                    alpha(st.body[1] * fade * (1 + 0.5 * X.pa));
                    fill(ax - r, y, ax + r, y + Z, st.body[0]);
                    alpha(0.22 * fade);
                    fill(ax - r * 0.3, y, ax + r * 0.3, y + Z, cols[1]); // 속 빛
                }
                const band = Math.floor(fr * 14 - t * 2.5);
                for (let j = 0; j < st.streaks; j++) {
                    const th = (j * TAU) / st.streaks + fr * (8.5 + (j % 2) * 1.5) + t * spin * (1 + 0.12 * (j % 3)) + col.phase;
                    const dep = Math.sin(th);
                    if ((dep > 0) !== (pass === 1)) {
                        continue;
                    }
                    const nz = hash(j * 13.1 + band * 0.77 + col.phase);
                    if (nz < 0.12) {
                        continue; // 군데군데 끊김
                    }
                    const x = ax + Math.cos(th) * r;
                    const len = Math.max(Z, r * (0.25 + 0.5 * nz) * Math.abs(dep));
                    alpha((pass ? 0.95 : st.back[1]) * fade);
                    fill(x - len / 2, y, x + len / 2, y + Z, pass ? (nz > 0.6 ? cols[0] : cols[1]) : st.back[0]);
                }
                if (pass === 1) {
                    // 가장자리에서 튀는 물보라
                    const fl = hash(row * 0.37 + Math.floor(t * 14) + col.phase);
                    if (fl < 0.45) {
                        alpha(0.7 * fade);
                        const side = fl < 0.22 ? -1 : 1;
                        dot(ax + side * (r + Z * (1 + 4 * fl)) - (side < 0 ? Z : 0), y, fl < 0.1 ? '#ffffff' : cols[1], 2, 1);
                    } else if (row % 2 === 0) {
                        alpha(0.6 * fade);
                        dot(ax - r, y, cols[1]);
                        dot(ax + r - Z, y, cols[1]);
                    }
                }
            }
        },
        push(D, X, strong) {
            const st = tornSt(D, X);
            const lead = st.cc[0];
            const z = st.Z;
            if (strong) {
                sigRing(lead.cx, st.G, z, st.rTop * 0.3, st.rTop * 2.2, 0.22, 0.45, [st.cols[0], '#ffffff', st.cols[2]]);
                for (let i = 0; i < 10; i++) {
                    tornFling(st, X.front, D.ym + rnd(-1, 1) * D.lane, X.dir * rnd(40, 200), -rnd(60, 220), 1.3);
                }
            } else {
                for (let i = 0; i < 5; i++) {
                    tornFling(st, X.front, D.ym + rnd(-1, 1) * D.lane, -X.dir * rnd(60, 200), -rnd(40, 160), 1.2);
                }
            }
        },
        win(D, X, L) {
            // 회오리가 진 쪽을 삼켜 빙글빙글 띄웠다 내던짐
            const st = tornSt(D, X);
            st.won = true;
            st.wonT = D.t;
            try {
                const up = Math.min(D.H * 0.4, L.h * 1.6 + 20);
                L.p.el.animate([
                    { translate: '0 0', rotate: '0deg', easing: 'ease-out' },
                    { translate: `0 -${up}px`, rotate: `${X.dir * 540}deg`, offset: 0.45 },
                    { translate: `0 -${up * 0.85}px`, rotate: `${X.dir * 900}deg`, offset: 0.62, easing: 'ease-in' },
                    { translate: '0 0', rotate: `${X.dir * 1080}deg` },
                ], { duration: 1000, composite: 'add' });
            } catch (err) {
                // 그림 움직임 실패는 넘어감
            }
            sigRing(L.body.cx, st.G, st.Z, st.rTop * 0.3, st.rTop * 2.6, 0.22, 0.5, [st.cols[0], '#ffffff', st.cols[2]]);
        },
    };

    // ═════════════════ storm — 쓰는 애 쪽에서 날씨 벽이 밀고 나감 (ultstorm) ═════════════════
    const STORM = {
        thunder: { c: 'electric', sky: '#0b0e1c', cloud: ['#6b7090', '#454a63', '#2c3045'], n: 140, flash: '#ffffff' },
        blizzard: { c: 'ice', sky: '#cfeaff', cloud: ['#ffffff', '#d6e8f4', '#a9c2d6'], n: 560, tint: '#e8f6ff', light: 1, flash: '#eafaff' },
        wind: { c: 'wind', sky: '#a9d2e6', n: 110, tint: '#dff0f8', light: 1, flash: '#ffffff' },
        acid: { c: 'poison', sky: '#2e0b40', cloud: ['#a46cc4', '#74409a', '#4a2266'], n: 230, tint: '#b060e0', flash: '#e8b8ff' },
        petal: { c: 'petal', sky: '#ff9fcb', n: 420, tint: '#ff9fcb', light: 1, flash: '#ffe6f2' },
        leaf: { c: 'grass', sky: '#1f4a16', n: 380, tint: '#6fd35a', flash: '#e6ffb8' },
        sand: { c: 'ground', sky: '#c8994d', n: 620, light: 1, flash: '#f0dcae' },
        rain: { c: 'water', sky: '#0d1828', cloud: ['#5d6b80', '#3e4a5c', '#283242'], n: 420, flash: '#dff2ff' },
        fire: { c: 'fire', sky: '#5e1003', cloud: ['#6e4a40', '#4a2e28', '#2e1c18'], n: 110, tint: '#ff5a1a', flash: '#fff0c0' },
    };
    // 꽃잎 · 잎 그림 — [dx, dy, 색 번호] 네 장면 (빙글 도는 것처럼)
    const PETAL = [[[0, 0, 1], [1, 0, 2]], [[0, 0, 1], [0, 1, 2]], [[0, 0, 0], [1, 1, 2]], [[1, 0, 1], [0, 1, 2]]];
    const PETAL_BIG = [
        [[0, 0, 0], [1, 0, 1], [2, 0, 1], [1, 1, 2], [2, 1, 2]],
        [[0, 0, 1], [0, 1, 1], [1, 1, 0], [1, 2, 2], [0, 2, 2]],
        [[1, 0, 1], [2, 0, 0], [0, 1, 2], [1, 1, 1]],
        [[0, 0, 1], [1, 0, 1], [0, 1, 2]],
    ];
    const LEAF = [
        [[1, 0, 1], [2, 0, 0], [0, 1, 2], [1, 1, 1]],
        [[0, 0, 2], [1, 0, 1], [2, 0, 0], [3, 0, 1]],
        [[0, 0, 0], [1, 0, 1], [1, 1, 1], [2, 1, 2]],
        [[0, 0, 0], [0, 1, 1], [0, 2, 2]],
    ];
    const TWIG = [[[0, 0, 2], [1, 0, 2], [2, 0, 2]], [[0, 0, 2], [1, 1, 2], [2, 2, 2]], [[0, 0, 2], [0, 1, 2], [0, 2, 2]], [[2, 0, 2], [1, 1, 2], [0, 2, 2]]];
    const glyphRects = (paths, px, s, x, y, cells, k = 1) => {
        for (const [dx, dy, c] of cells) {
            paths[c].rect(px(x + dx * s * k), px(y + dy * s * k), s * k, s * k);
        }
    };
    const fillPaths = (ctx, paths, cols, a = 1) => {
        ctx.globalAlpha = k01(a);
        paths.forEach((path, i) => {
            ctx.fillStyle = cols[i];
            ctx.fill(path);
        });
    };
    // 꽉 찬 타원 (Path2D 로 한 번에) — cut 아래 줄은 안 그림
    function ellipse(ctx, px, s, x, y, rx, ry, color, a = 1, cut = Infinity) {
        if (a <= 0.01 || rx < s / 2) {
            return;
        }
        ry = Math.max(s, ry);
        const path = new Path2D();
        for (let dy = -ry; dy <= ry; dy += s) {
            if (y + dy > cut) {
                break;
            }
            const half = rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2));
            if (half >= s / 2) {
                path.rect(px(x - half), px(y + dy), Math.max(s, px(2 * half)), s);
            }
        }
        ctx.globalAlpha = k01(a);
        ctx.fillStyle = color;
        ctx.fill(path);
    }
    // 번개 길 — 가운데를 옆으로 밀며 쪼갬
    function jag(x0, y0, x1, y1, seg, amp = 0.25) {
        let pts = [[x0, y0], [x1, y1]];
        for (let d = 0; d < 8; d++) {
            const next = [pts[0]];
            let more = false;
            for (let i = 1; i < pts.length; i++) {
                const [ax, ay] = pts[i - 1];
                const [bx, by] = pts[i];
                const L = Math.hypot(bx - ax, by - ay);
                if (L > seg * 2) {
                    const off = rnd(-1, 1) * amp * L;
                    next.push([(ax + bx) / 2 - ((by - ay) / L) * off, (ay + by) / 2 + ((bx - ax) / L) * off]);
                    more = true;
                }
                next.push(pts[i]);
            }
            pts = next;
            if (!more) {
                break;
            }
        }
        return pts;
    }
    function branchOf(pts, len, seg) {
        const i = Math.floor((pts.length - 1) * rnd(0.15, 0.75));
        const [ax, ay] = pts[i];
        const [bx, by] = pts[Math.min(pts.length - 1, i + 1)];
        const a = Math.atan2(by - ay, bx - ax) + pick([-1, 1]) * rnd(0.4, 1.0);
        return jag(ax, ay, ax + Math.cos(a) * len, ay + Math.sin(a) * len, seg, 0.3);
    }
    function fillPts(ctx, px, s, pts, w, color, a = 1) {
        if (!pts || pts.length < 2 || a <= 0.01) {
            return;
        }
        const path = new Path2D();
        const size = Math.max(1, Math.round(w)) * s;
        const step = s * Math.max(1, Math.floor(w / (w >= 4 ? 2 : 3)));
        for (let k = 1; k < pts.length; k++) {
            const [x0, y0] = pts[k - 1];
            const [x1, y1] = pts[k];
            const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
            for (let j = k === 1 ? 0 : 1; j <= n; j++) {
                path.rect(px(x0 + ((x1 - x0) * j) / n - size / 2), px(y0 + ((y1 - y0) * j) / n - size / 2), size, size);
            }
        }
        ctx.globalAlpha = Math.min(1, a);
        ctx.fillStyle = color;
        ctx.fill(path);
    }
    // 번개 한 줄 — 옅은 바깥 빛 · 색 · 하얀 심
    function drawBolt(ctx, px, s, pts, w, mid, glow, a = 1) {
        if (glow) {
            fillPts(ctx, px, s, pts, w * 2 + 3, glow, a * 0.3);
        }
        fillPts(ctx, px, s, pts, w + 2, mid, a);
        fillPts(ctx, px, s, pts, Math.max(1, w - 1), '#ffffff', a);
    }
    // 날씨 알갱이 — 깊이(먼 · 중간 · 가까운)마다 크기 · 빠르기 · 밝기가 다름 (fx-sky ultstorm 과 같은 그림)
    const depth = (i) => {
        const d = hash(i, 5);
        return d < 0.5 ? 0 : d < 0.86 ? 1 : 2;
    };
    const DEPTH_A = [0.5, 0.8, 1];
    function fieldRain(ctx, px, s, F, o) {
        const { W, H, G, t, n, dir } = F;
        const slant = (o.acid ? 0.1 : 0.22) * dir;
        const top = -H * 0.1;
        const span = W + 40;
        const drops = [new Path2D(), new Path2D(), new Path2D()];
        const heads = new Path2D();
        const splash = new Path2D();
        for (let i = 0; i < n; i++) {
            const d = depth(i);
            const b = hash(i, 2);
            const vy = H * (o.acid ? 1.0 + 0.4 * b : 1.9 + 0.8 * b) * (1 + 0.35 * d);
            const gy = G - (hash(i, 3) * Math.min(22, H * 0.08) * (2 - d)) / 2;
            const fall = (gy - top) / vy;
            const cyc = fall + 0.15;
            const ph = (t + hash(i, 1) * 9) % cyc;
            const x0 = hash(i, 4) * span;
            const L = Math.max(2, Math.round(o.acid ? 2 + d * 1.5 + b : 3 + 3 * d + 2 * b)) * s;
            const th = (o.acid ? (d > 0 ? 2 : 1) : d === 2 ? 2 : 1) * s;
            if (ph < fall) {
                const y = top + ph * vy;
                const x = wrap(x0 + slant * (y - top), span, -20);
                drops[d].rect(px(x), px(y - L / 2), th, px(L / 2) || s);
                drops[d].rect(px(x - (slant * L) / 2), px(y - L), th, px(L / 2) || s);
                if (o.acid && d > 0) {
                    heads.rect(px(x), px(y), th, s);
                }
            } else if (d > 0) {
                const k = (ph - fall) / 0.15;
                const x = wrap(x0 + slant * (gy - top), span, -20);
                const dd = (1 + 3 * k) * s;
                const hop = 4 * k * (1 - k) * 3 * s;
                splash.rect(px(x - dd), px(gy - hop), s, s);
                splash.rect(px(x + dd), px(gy - hop), s, s);
                if (k < 0.5) {
                    splash.rect(px(x - dd), px(gy - s), px(2 * dd) + s, s);
                }
            }
        }
        drops.forEach((path, d) => {
            ctx.globalAlpha = DEPTH_A[d] * 0.9 * F.a;
            ctx.fillStyle = d === 2 ? o.near ?? o.color : o.color;
            ctx.fill(path);
        });
        ctx.globalAlpha = F.a;
        ctx.fillStyle = o.head ?? o.color;
        ctx.fill(heads);
        ctx.globalAlpha = 0.9 * F.a;
        ctx.fillStyle = o.splash;
        ctx.fill(splash);
    }
    function fieldSnow(ctx, px, s, F) {
        const { W, H, G, t, n, dir, cols } = F;
        const span = W + 40;
        const spanY = G + 30;
        const paths = [new Path2D(), new Path2D(), new Path2D()];
        for (let i = 0; i < n; i++) {
            const d = depth(i);
            const b = hash(i, 2);
            const vy = H * (0.45 + 0.4 * b) * (1 + 0.6 * d);
            const vx = dir * vy * (1.2 + 0.8 * hash(i, 3));
            const y = wrap(hash(i, 1) * spanY + vy * t, spanY, -20);
            const x = wrap(hash(i, 4) * span + vx * t + Math.sin(t * 4 + i) * 2 * s, span, -20);
            if (d === 2) {
                paths[0].rect(px(x), px(y), s, s);
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    paths[0].rect(px(x + dx * s), px(y + dy * s), s, s);
                    paths[1].rect(px(x + dx * 2 * s), px(y + dy * 2 * s), s, s);
                }
            } else if (d === 1) {
                const sp = Math.hypot(vx, vy);
                for (let k = 0; k < 4; k++) {
                    paths[k ? 1 : 0].rect(px(x - (vx / sp) * k * s * 1.3), px(y - (vy / sp) * k * s * 1.3), s, s);
                }
            } else {
                paths[2].rect(px(x), px(y), s, s);
            }
        }
        fillPaths(ctx, paths, ['#ffffff', cols[1], cols[2]], 0.95 * F.a);
    }
    function fieldWind(ctx, px, s, F) {
        const { W, H, G, t, n, dir, cols } = F;
        const lines = [new Path2D(), new Path2D(), new Path2D()];
        for (let i = 0; i < n; i++) {
            const d = depth(i);
            const b = hash(i, 2);
            const len = W * (0.08 + 0.25 * b) * (1 + 0.5 * d);
            const speed = W * (1.3 + 1.2 * hash(i, 3)) * (1 + 0.4 * d);
            const span = W + len * 2;
            const x = wrap(hash(i, 4) * span + dir * speed * t, span, -len);
            const y = hash(i, 1) * G * 0.96 + Math.sin(t * 3 + i) * H * 0.015;
            const th = d === 2 ? 2 * s : s;
            lines[d].rect(px(dir > 0 ? x - len : x), px(y), px(len), th);
            if (i % 7 === 0 && d > 0) {
                // 머리가 위로 돌돌 말림
                const r0 = (3 + d) * s;
                for (let k = 0; k <= 9; k++) {
                    const a = Math.PI / 2 - dir * k * ((1.7 * Math.PI) / 9);
                    const rr = r0 * (1 - k * 0.06);
                    lines[d].rect(px(x + Math.cos(a) * rr), px(y - r0 + Math.sin(a) * rr), th, th);
                }
            }
        }
        // 굽이치는 바람띠
        for (let j = 0; j < 4; j++) {
            const y0 = G * (0.15 + 0.22 * j);
            const segL = W * 0.7;
            const span = W + segL;
            const head = wrap(hash(j, 30) * span + dir * W * 1.6 * t, span, dir > 0 ? 0 : -segL);
            for (let d = 0; d < segL; d += s) {
                const x = head - dir * d;
                const y = y0 + Math.sin(x / (W * 0.18) + t * 4 + j) * H * 0.05;
                lines[1].rect(px(x), px(y), s, s);
            }
        }
        [0.35, 0.6, 0.9].forEach((al, d) => {
            ctx.globalAlpha = al * F.a;
            ctx.fillStyle = ['#cfe6f2', cols[1], '#ffffff'][d];
            ctx.fill(lines[d]);
        });
        // 날아가는 것들 — 가까운 건 크게
        const bits = [new Path2D(), new Path2D(), new Path2D()];
        const m = Math.round(n * 0.5);
        for (let i = 0; i < m; i++) {
            const d = depth(i + 500);
            const k = d === 2 ? 2 : 1;
            const span = W + 60;
            const x = wrap(hash(i, 7) * span + dir * W * (0.9 + 0.8 * hash(i, 6)) * (1 + 0.4 * d) * t, span, -30);
            const y = hash(i, 8) * G * 0.92 + Math.sin(t * 7 + i * 1.3) * H * 0.06;
            const f = Math.floor(t * 12 + i) % 4;
            if (i % 3 === 0) {
                glyphRects(bits, px, s, x, y, LEAF[f], k);
            } else if (i % 3 === 1) {
                bits[2].rect(px(x), px(y), 2 * k * s, 2 * k * s);
            } else {
                glyphRects(bits, px, s, x, y, TWIG[f], k);
            }
        }
        fillPaths(ctx, bits, ['#c5f07a', '#6fbf3a', '#8a7252'], F.a);
    }
    function fieldPetal(ctx, px, s, F, leaf) {
        const { W, H, G, t, n, dir, cols } = F;
        const span = W + 40;
        const spanY = G + 30;
        const paths = [new Path2D(), new Path2D(), new Path2D()];
        const near = [new Path2D(), new Path2D(), new Path2D()];
        for (let i = 0; i < n; i++) {
            const d = depth(i);
            const b = hash(i, 2);
            const vx = dir * W * (leaf ? 0.55 + 0.5 * b : 0.25 + 0.3 * b) * (1 + 0.5 * d);
            const vy = H * (leaf ? 0.14 + 0.16 * hash(i, 3) : 0.06 + 0.1 * hash(i, 3));
            const R = H * (0.04 + 0.1 * hash(i, 6));
            const om = (leaf ? 4 : 2.6) + 3 * hash(i, 7);
            const ph = hash(i, 9) * TAU;
            const x = wrap(hash(i, 4) * span + vx * t + R * Math.cos(om * t + ph), span, -20);
            const y = wrap(hash(i, 1) * spanY + vy * t + R * 0.7 * Math.sin(om * t + ph) + Math.sin((x / W) * TAU + t * 2) * H * 0.04, spanY, -20);
            const f = Math.floor(t * (leaf ? 11 : 7) + i) % 4;
            glyphRects(d === 2 ? near : paths, px, s, x, y, leaf ? LEAF[f] : d > 0 ? PETAL_BIG[f] : PETAL[f], d === 2 ? 2 : 1);
        }
        // 굽이치는 띠 — 꽃잎이 줄지어 나선으로 휩쓸려 감
        const m = Math.round(n / 8);
        for (let j = 0; j < 3; j++) {
            const y0 = G * (0.22 + 0.24 * j);
            for (let g = 0; g < m; g++) {
                const bx = wrap((g / m) * span + dir * W * (leaf ? 0.9 : 0.6) * t + j * 97, span, -20);
                const ph = g * 0.7 + t * 6 * dir + j;
                const x = bx + Math.cos(ph) * H * 0.04;
                const y = y0 + Math.sin((bx / W) * TAU * 0.8 + t * 2 + j * 2) * H * 0.12 + Math.sin(ph) * H * 0.05;
                glyphRects(paths, px, s, x, y, (leaf ? LEAF : PETAL_BIG)[(g + Math.floor(t * 9)) % 4]);
            }
        }
        fillPaths(ctx, paths, [cols[0], cols[1], cols[2]], 0.85 * F.a);
        fillPaths(ctx, near, [cols[0], cols[1], cols[2]], F.a);
    }
    function fieldSand(ctx, px, s, F) {
        const { W, H, G, t, n, dir, cols } = F;
        const span = W + 40;
        for (let j = 0; j < 9; j++) {
            const R = H * (0.08 + 0.08 * hash(j, 10));
            const sp2 = W + R * 6;
            const x = wrap(hash(j, 8) * sp2 + dir * W * (0.45 + 0.3 * hash(j, 11)) * t, sp2, -R * 3);
            ellipse(ctx, px, s, x, G - R * 0.45 - hash(j, 9) * H * 0.15, R * 1.8, R * 0.65, j % 2 ? cols[1] : cols[2], 0.28 * F.a, G);
        }
        const paths = [new Path2D(), new Path2D(), new Path2D()];
        for (let i = 0; i < n; i++) {
            const d = depth(i);
            const b = hash(i, 2);
            const x = wrap(hash(i, 4) * span + dir * W * (0.9 + 0.9 * b) * (1 + 0.5 * d) * t, span, -20);
            const y = G - hash(i, 1) ** 1.7 * G + Math.sin(t * 5 + i) * H * 0.02;
            const len = [1, 3, 7][d] * s;
            paths[d].rect(px(dir > 0 ? x - len : x), px(y), len, s);
        }
        [0.55, 0.85, 1].forEach((al, d) => {
            ctx.globalAlpha = al * F.a;
            ctx.fillStyle = [cols[2], cols[1], cols[0]][d];
            ctx.fill(paths[d]);
        });
    }
    function fieldFire(ctx, px, s, F) {
        const { W, H, G, t, n, dir, cols } = F;
        const span = W + 60;
        const top = -H * 0.1;
        const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D()];
        for (let i = 0; i < n; i++) {
            const d = depth(i);
            const b = hash(i, 2);
            const vy = H * (0.8 + 0.5 * b) * (1 + 0.3 * d);
            const vx = dir * vy * 0.5;
            const gy = G - hash(i, 3) * Math.min(20, H * 0.07);
            const fall = (gy - top) / vy;
            const cyc = fall + 0.25;
            const ph = (t + hash(i, 1) * 9) % cyc;
            const x0 = hash(i, 4) * span;
            const big = d === 2 ? 2 : 1;
            if (ph < fall) {
                const y = top + ph * vy;
                const x = wrap(x0 + (vx * (y - top)) / vy, span, -30);
                const sp = Math.hypot(vx, vy);
                paths[0].rect(px(x), px(y), big * s, big * s);
                const len = d === 0 ? 3 : d === 1 ? 6 : 9;
                for (let k = 1; k <= len; k++) {
                    paths[Math.min(4, 1 + Math.floor(((k - 1) / len) * 4))].rect(px(x - (vx / sp) * k * s), px(y - (vy / sp) * k * s), big * s, big * s);
                }
            } else if (d > 0) {
                const k = (ph - fall) / 0.25;
                const x = wrap(x0 + (vx * (gy - top)) / vy, span, -30);
                for (let j = -1; j <= 1; j++) {
                    paths[1 + Math.min(3, Math.floor(k * 4))].rect(px(x + j * 2 * s * (1 + k)), px(gy - k * (6 - Math.abs(j) * 2) * s * big), s * big, s * big);
                }
            }
        }
        // 땅에서 솟는 불씨
        const m = Math.round(n * 0.8);
        for (let i = 0; i < m; i++) {
            const cyc = 1 + hash(i, 12);
            const k = ((t + hash(i, 13) * 5) % cyc) / cyc;
            const x = hash(i, 14) * W + Math.sin(t * 5 + i) * 3 * s;
            paths[k < 0.4 ? 1 : k < 0.75 ? 2 : 3].rect(px(x), px(G - k * H * 0.45), s, s);
        }
        fillPaths(ctx, paths, [cols[0], cols[1], cols[2], cols[3], '#7a7a7a'], F.a);
    }
    // 먹구름 한 덩어리 — 위 밝게 · 아래 어둡게, lit 이면 번쩍
    const PUFFS = [
        [[-0.55, 0.12, 0.42], [-0.12, -0.25, 0.55], [0.35, -0.08, 0.48], [0.72, 0.2, 0.32]],
        [[-0.6, 0.18, 0.36], [-0.2, -0.1, 0.5], [0.25, -0.3, 0.5], [0.65, 0.05, 0.4]],
        [[-0.45, -0.05, 0.5], [0.1, -0.28, 0.45], [0.55, 0.1, 0.45]],
    ];
    function lump(ctx, px, s, x, y, rw, rh, cols, lit, litCols, puffs, a) {
        const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
        const flat = y + rh * 0.55;
        for (const [ox, oy, rr] of puffs) {
            const pcx = x + ox * rw;
            const pcy = y + oy * rh;
            const rx = rr * rw;
            const ry = rr * rh * 1.5;
            let first = true;
            for (let dy = -ry; dy <= ry; dy += s) {
                const yy = pcy + dy;
                if (yy > flat) {
                    break;
                }
                const half = rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2));
                if (half < s) {
                    continue;
                }
                const f = (yy - y) / rh;
                paths[first ? 3 : f < -0.3 ? 0 : f < 0.25 ? 1 : 2].rect(px(pcx - half), px(yy), Math.max(s, px(2 * half)), s);
                first = false;
            }
        }
        const Cc = lit > 0 ? litCols : cols;
        ctx.globalAlpha = k01(a);
        [Cc[0], Cc[1], Cc[2], lit > 0 ? '#ffffff' : Cc[0]].forEach((c, k) => {
            ctx.fillStyle = c;
            ctx.fill(paths[k]);
        });
    }
    function stormSt(D, X) {
        const st = base(D, X);
        if (st.K) {
            return st;
        }
        const o = X.o || {};
        const z = st.Z;
        st.kind = STORM[o.kind] ? o.kind : 'thunder';
        const K = (st.K = STORM[st.kind]);
        const cols = (st.cols = sigPal(o.c || K.c));
        st.bandH = Math.max(36, D.H * 0.3);
        st.area = clamp((D.W * D.H) / (480 * 300), 0.45, 2.2);
        st.N = Math.round(K.n * st.area * (0.55 + 0.45 * st.P));
        st.c = Math.max(z, Math.round(Math.min(D.W, D.H) / 110));
        st.sky = o.c ? cols[3] : K.sky;
        st.tint = K.tint ? (o.c ? cols[1] : K.tint) : null;
        st.cloud = K.cloud ? (st.kind === 'acid' && o.c ? [cols[1], cols[2], cols[3]] : K.cloud) : null;
        st.litCols = st.kind === 'thunder' || st.kind === 'rain' ? ['#ffffff', '#fffbe0', o.c ? cols[1] : '#ffe680'] : ['#ffffff', cols[0], cols[1]];
        // 앞 가장자리 벽 색 — [밝은, 중간, 어두운]
        st.wall = st.cloud ? st.cloud : st.kind === 'blizzard' || st.kind === 'wind' ? ['#ffffff', cols[1], cols[2]] : [cols[0], cols[1], cols[2]];
        st.bw = clamp(Math.round(D.H / (70 * z)) + 1, 2, 5); // 번개 굵기 (칸)
        st.bolts = [];
        st.fall = [];
        st.gusts = [];
        st.lit = 0;
        st.nextBolt = 0;
        st.nextLit = 0;
        st.nextGust = 0;
        // 구름 덩이 — 화면 너비 전체에 깔아 두고 영역 안만 보임
        const h = st.bandH * 0.36;
        const step = h * 1.45;
        const n = Math.max(4, Math.ceil((D.W + step * 2) / step) + 1);
        st.lumps = [];
        for (let i = 0; i < n; i++) {
            const back = i % 2 === 1;
            st.lumps.push({ bx: i * step - step + rnd(-0.2, 0.2) * step, y: st.bandH * 0.3 + (back ? -0.35 : 0.1) * h + rnd(-0.15, 0.15) * h, rw: step * rnd(0.75, 1.05) * (back ? 1.15 : 1), rh: h * rnd(0.6, 0.85) * (back ? 0.9 : 1), back, puffs: PUFFS[i % PUFFS.length] });
        }
        st.lumpSpan = n * step;
        st.lumpStep = step;
        return st;
    }
    // 번개 — 구름에서 (x, y1) 로 지직
    function stormBolt(st, D, X, x, big, y1 = st.G) {
        const y0 = st.bandH * 0.42;
        const L = Math.hypot(y1 - y0, 1);
        const b = { x0: x + rnd(-1, 1) * D.lane * 0.6, y0, x1: x, y1, w: big ? st.bw * 2 : st.bw, life: 0, max: big ? 0.5 : 0.3, seg: Math.max(2 * st.Z, L / 20), nb: big ? 4 : 2, drawn: -1 };
        const make = () => {
            b.drawn = b.life;
            b.pts = jag(b.x0, b.y0, b.x1, b.y1, b.seg, 0.22);
            b.br = [];
            for (let i = 0; i < b.nb; i++) {
                b.br.push(branchOf(b.pts, L * rnd(0.15, 0.35), b.seg));
            }
        };
        b.make = make;
        make();
        st.bolts.push(b);
        st.lit = Math.max(st.lit, big ? 0.16 : 0.08);
        const z = st.Z;
        sigRing(x, Math.min(y1, st.G - z), z, 2 * z, D.lane * (big ? 4 : 1.6), y1 < st.G - z * 2 ? 0.8 : 0.25, big ? 0.5 : 0.3, ['#ffffff', st.cols[1], st.cols[2]]);
        for (let i = 0; i < (big ? 10 : 3); i++) {
            chunk(x, Math.min(y1, st.G - z), z, rnd(-1, 1) * D.H * 0.4, -rnd(0.2, 0.7) * D.H, D.H * 2.2, st.G, pick(['#ffffff', st.cols[0], st.cols[1], st.cols[2]]), 1);
        }
        if (big) {
            screenFlash(z, 0.3, '#ffffff', 0.18);
        }
    }
    // 얼음 조각 · 불덩이 — 비스듬히 떨어져 땅에서 깨짐 / 터짐
    function stormFaller(st, D, X, x1, big) {
        const fire = st.kind === 'fire';
        const gy = st.G - rnd(0, 2) * st.Z;
        const vy = D.H * (fire ? 1.25 : 1.6) * (big ? 0.8 : 1);
        const vx = X.dir * vy * (fire ? 0.45 : 0.6);
        const T = (gy + 20) / vy;
        st.fall.push({ x: x1 - vx * T, y: gy - vy * T, vx, vy, gy, big, trail: [] });
    }
    const STORMY = {
        charge(D, X, k, dt) {
            const st = stormSt(D, X);
            const z = st.Z;
            const tx = X.x0 + X.dir * D.lane;
            const ty = st.bandH * 0.4;
            // 쓰는 애 위로 구름 · 날씨 기운이 몰려듦
            every(st, 0, dt, 16 + 26 * k, () => {
                const side = Math.random() < 0.5 ? -1 : 1;
                const sx = tx + side * D.lane * rnd(3, 6);
                gatherPuff(sx, ty + rnd(-1, 1) * D.lane, tx + rnd(-1.5, 1.5) * D.lane, ty + rnd(-0.6, 0.6) * D.lane, z, D.lane * rnd(0.35, 0.7), pick(st.wall), rnd(0.35, 0.55));
            });
            every(st, 1, dt, 14 + 30 * k, () => STORMY.bit(st, D, X, tx + rnd(-1.5, 1.5) * D.lane, ty + rnd(0, 1) * (st.G - ty), false));
            if (st.kind === 'thunder' && k > 0.6 && !st.crack) {
                st.crack = true;
                art(0.22, z, st.G, (life) => {
                    if (!st.cpts || Math.floor(life / 0.05) !== st.cfr) {
                        st.cfr = Math.floor(life / 0.05);
                        st.cpts = jag(tx, ty, tx + rnd(-1, 1) * D.lane, st.G, Math.max(2 * z, (st.G - ty) / 16), 0.22);
                    }
                    drawBolt(C, sn, Z, st.cpts, 2, st.cols[2], st.cols[3], 1 - life / 0.22);
                });
            }
        },
        // 날씨 알갱이 하나 (모양마다) — 가장자리 · 모으기에서 뿌림
        bit(st, D, X, x, y, out) {
            const z = st.Z;
            const cols = st.cols;
            const H = D.H;
            const vx = out ? X.dir * rnd(30, 120) : rnd(-20, 20);
            switch (st.kind) {
                case 'blizzard':
                    sparkle(x, y, z, ['#ffffff', '#ffffff', cols[1]], vx + X.dir * 40, rnd(20, 60), rnd(0.4, 0.8));
                    break;
                case 'petal':
                case 'leaf':
                    flutter(x, y, z, pick(cols.slice(0, 3)), vx + X.dir * rnd(20, 80), rnd(-40, 20), rnd(0.8, 1.3), { g: 30, sway: 50, hi: cols[0] });
                    break;
                case 'fire':
                    ember(x, y, z, pick(cols.slice(0, 2)), cols[2], vx, -rnd(40, 120), rnd(0.4, 0.8));
                    break;
                case 'sand':
                    puff(x, y, z, pick(cols.slice(0, 3)), vx + X.dir * rnd(60, 160), rnd(-10, 10), rnd(0.5, 0.9), 3, 0.5);
                    break;
                case 'wind':
                    puff(x, y, z, pick(['#ffffff', cols[1]]), vx + X.dir * rnd(80, 200), rnd(-10, 10), rnd(0.3, 0.6), 2, 0.5);
                    break;
                default:
                    // 비 · 독비 · 번개구름 — 떨어지는 방울
                    chunk(x, y, z, vx * 0.3, rnd(0.2, 0.5) * H, H * 2, st.G, pick(st.kind === 'acid' ? [cols[0], cols[1], cols[2]] : ['#ffffff', st.kind === 'thunder' ? '#bcd0ee' : cols[1], cols[2]]), 1, undefined, Math.random() < 0.3, 1.2);
            }
        },
        tick(D, X, dt) {
            const st = stormSt(D, X);
            const t = D.t;
            const on = live(D, X);
            const len = reach(X);
            const z = st.Z;
            if (st.t1 === undefined) {
                st.t1 = t;
            }
            st.lit = Math.max(0, st.lit - dt);
            const pickX = (bias) => (Math.random() < bias ? X.front - X.dir * rnd(0, D.lane * 1.5) : along(X, len * rnd(0.05, 0.95)));
            if (on && len > 4 * z) {
                if (st.kind === 'thunder' && t >= st.nextBolt) {
                    st.nextBolt = t + rnd(0.16, 0.36) / (1 + 0.6 * X.pa + 0.5 * D.climax);
                    stormBolt(st, D, X, pickX(0.35), false);
                }
                if ((st.kind === 'rain' || st.kind === 'acid') && t >= st.nextLit) {
                    st.nextLit = t + rnd(0.8, 1.6);
                    st.lit = 0.1;
                }
                if (st.kind === 'blizzard') {
                    every(st, 0, dt, 7 + 6 * X.pa, () => stormFaller(st, D, X, pickX(0.3), false));
                }
                if (st.kind === 'fire') {
                    every(st, 0, dt, 3.5 + 3 * X.pa, () => stormFaller(st, D, X, pickX(0.3), false));
                }
                if ((st.kind === 'wind' || st.kind === 'sand' || st.kind === 'blizzard') && t >= st.nextGust) {
                    st.nextGust = t + rnd(0.7, 1.2);
                    st.gusts.push({ t0: t, thick: st.kind !== 'blizzard' });
                }
                // 앞 가장자리에서 튀어 나가는 알갱이
                every(st, 1, dt, 8 + 18 * X.pa + 8 * D.climax, () => STORMY.bit(st, D, X, X.front, rnd(st.bandH * 0.2, st.G - z), true));
            }
            for (let i = st.bolts.length - 1; i >= 0; i--) {
                const b = st.bolts[i];
                b.life += dt;
                if (b.life >= b.max) {
                    st.bolts.splice(i, 1);
                } else if (b.life - b.drawn > 0.05) {
                    b.make();
                }
            }
            for (let i = st.fall.length - 1; i >= 0; i--) {
                const q = st.fall[i];
                q.x += q.vx * dt;
                q.y += q.vy * dt;
                q.trail.unshift([q.x, q.y]);
                q.trail.length = Math.min(q.trail.length, st.kind === 'fire' ? 9 : 5);
                if (q.y >= q.gy) {
                    st.fall.splice(i, 1);
                    if (st.kind === 'fire') {
                        flames(q.x, q.gy, z, st.cols, q.big ? 24 : 7, D.H * (q.big ? 1 : 0.55), q.big ? 6 : 3);
                        sigRing(q.x, q.gy, z, z * 2, D.lane * (q.big ? 4 : 1.4), 0.25, 0.4, [st.cols[0], st.cols[1], st.cols[2]]);
                    } else {
                        for (let j = 0; j < 2; j++) {
                            chunk(q.x, q.gy - z, z, rnd(-1, 1) * D.H * 0.3, -rnd(0.2, 0.5) * D.H, D.H * 2, st.G, pick(['#ffffff', st.cols[1], st.cols[2]]), 1);
                        }
                        sparkle(q.x, q.gy - 2 * z, z, ['#ffffff', '#ffffff', st.cols[1]], 0, -rnd(10, 30), rnd(0.3, 0.6));
                    }
                }
            }
            st.gusts = st.gusts.filter((g) => t - g.t0 < 0.8);
        },
        draw(ctx, px, D, X) {
            const st = stormSt(D, X);
            paint(ctx, st.Z, X.fade, st.G, () => STORMY.paint(D, X, st));
        },
        paint(D, X, st) {
            const t = D.t;
            const len = reach(X);
            if (len < Z) {
                return;
            }
            const { G, cols, K, kind } = st;
            const W = D.W;
            const H = D.H;
            const dir = X.dir;
            const lane = D.lane;
            const life = t - (st.t1 ?? t);
            const env = k01(life / 0.4);
            const surge = 1 + 0.35 * X.pa - (X.pushing < 0 ? 0.15 : 0);
            // 뒤쪽 끝 — 쓰는 애 등 뒤로 조금, 들쭉날쭉하게 (딱 잘린 벽처럼 안 보이게)
            const back = (y) => X.x0 - dir * lane * (1.4 + 0.5 * Math.sin(y * 0.09 + t * 3 + st.seed) + 0.3 * Math.sin(y * 0.23 - t * 5));
            const xBack = X.x0 - dir * lane * 2.2;
            const bulge = (y) => k01(1 - Math.abs(y - D.ym) / (lane * 1.8));
            // 들쭉날쭉한 앞 가장자리 — ym 높이는 정확히 front 까지
            const edge = (y) => X.front - dir * lane * (0.5 * (1 - bulge(y)) + 0.2 * (1 - bulge(y)) * (0.5 + 0.5 * Math.sin(y * 0.11 + t * 7 + st.seed)));
            const lo = Math.min(xBack, X.front);
            const hi = Math.max(xBack, X.front);
            // 영역 — 칸 단위 가로 띠로 자름
            const clip = new Path2D();
            const rowH = 3 * Z;
            for (let y = 0; y < G; y += rowH) {
                const xe = edge(y + rowH / 2);
                const xb = back(y + rowH / 2);
                const a = sn(Math.min(xb, xe));
                const b = sn(Math.max(xb, xe));
                if (b > a) {
                    clip.rect(a, y, b - a, Math.min(rowH, G - y));
                }
            }
            C.save();
            C.clip(clip);
            // 하늘 띠 — 위로 갈수록 진하게
            C.fillStyle = st.sky;
            for (let k = 0; k < 4; k++) {
                alpha((K.light ? 0.34 : 0.6) * 0.32 * env);
                C.fillRect(lo, 0, hi - lo, sn(st.bandH * (1 - k * 0.24)));
            }
            // 물들이기 — 아래로 갈수록 진하게
            if (st.tint) {
                C.fillStyle = st.tint;
                const a = env * (kind === 'fire' ? 0.8 + 0.2 * Math.sin(t * 23) : 1);
                alpha(0.08 * a);
                C.fillRect(lo, 0, hi - lo, G);
                for (let k = 1; k <= 3; k++) {
                    alpha(0.05 * a);
                    C.fillRect(lo, sn(G - H * 0.12 * k), hi - lo, G);
                }
            }
            if (kind === 'sand') {
                C.fillStyle = cols[1];
                alpha(0.14 * env);
                C.fillRect(lo, 0, hi - lo, G);
                alpha(0.1 * env);
                C.fillRect(lo, sn(G - H * 0.3), hi - lo, G);
            }
            STORMY.ground(D, X, st, lo, hi, env);
            // 날씨 알갱이 (화면 전체 자리 — 영역 안만 보임)
            const F = { W, H, G, dir, cols, t: life + st.seed, n: Math.round(st.N * (1 + 0.3 * X.pa)), a: FA * env };
            const c = st.c;
            const pxc = (v) => Math.round(v / c) * c;
            if (kind === 'thunder') {
                fieldRain(C, pxc, c, F, { color: '#8fa6c9', near: '#d6e4ff', splash: '#cfe0ff' });
            } else if (kind === 'rain') {
                fieldRain(C, pxc, c, F, { color: cols[2], near: cols[0], splash: cols[0] });
            } else if (kind === 'acid') {
                fieldRain(C, pxc, c, F, { acid: true, color: cols[2], near: cols[1], head: cols[0], splash: cols[1] });
            } else if (kind === 'blizzard') {
                fieldSnow(C, pxc, c, F);
            } else if (kind === 'wind') {
                fieldWind(C, pxc, c, F);
            } else if (kind === 'petal' || kind === 'leaf') {
                fieldPetal(C, pxc, c, F, kind === 'leaf');
            } else if (kind === 'sand') {
                fieldSand(C, pxc, c, F);
            } else {
                fieldFire(C, pxc, c, F);
            }
            // 떨어지는 얼음 조각 · 불덩이
            for (const q of st.fall) {
                const sp = Math.hypot(q.vx, q.vy);
                if (kind === 'fire') {
                    const r = (q.big ? 4 : 2) * Z;
                    q.trail.forEach(([x, y], j) => {
                        const k = j / q.trail.length;
                        ellipse(C, sn, Z, x, y, r * (1 - k * 0.7), r * (1 - k * 0.7), cols[Math.min(3, 1 + Math.floor(k * 3))], (1 - k) * FA);
                    });
                    alpha(1);
                    disc(q.x, q.y, r * 1.3, r * 1.3, cols[1]);
                    disc(q.x, q.y, r * 0.7, r * 0.7, cols[0]);
                } else {
                    const n = q.big ? 9 : 6;
                    const path = [new Path2D(), new Path2D(), new Path2D()];
                    for (let k = 0; k < n; k++) {
                        const x = q.x - (q.vx / sp) * k * Z;
                        const y = q.y - (q.vy / sp) * k * Z;
                        path[k === 0 ? 0 : 1].rect(sn(x), sn(y), Z, Z);
                        if (k > 0 && k < n - 2) {
                            path[2].rect(sn(x + Z), sn(y), Z, Z);
                        }
                    }
                    fillPaths(C, path, ['#ffffff', cols[1], cols[2]], FA);
                }
            }
            // 돌풍 — 휙 지나가는 바람 줄
            for (const g of st.gusts) {
                const k = (t - g.t0) / 0.8;
                const paths = [new Path2D(), new Path2D()];
                const n = Math.round(14 * Math.sqrt(st.area));
                const span = hi - lo;
                for (let j = 0; j < n; j++) {
                    const L = span * (0.25 + 0.35 * hash(j, 40));
                    const x0 = dir > 0 ? lo - L : hi;
                    const x = x0 + dir * (span + L) * clamp(k * 1.4 - hash(j, 41) * 0.4, 0, 1);
                    paths[j % 2].rect(sn(x), sn(hash(j, 42) * G), sn(L), (g.thick && j % 3 === 0 ? 2 : 1) * Z);
                }
                fillPaths(C, paths, ['#ffffff', cols[1]], 0.7 * (1 - k) * FA);
            }
            // 구름 (빗줄기 위로)
            if (st.cloud) {
                const drift = (kind === 'thunder' ? 22 : 12) * dir * life;
                const drop = 1 - easeOut(life / 0.5);
                for (const pass of [true, false]) {
                    for (const q of st.lumps) {
                        if (q.back !== pass) {
                            continue;
                        }
                        const x = wrap(q.bx + drift, st.lumpSpan, -st.lumpStep);
                        if (x + q.rw < lo || x - q.rw > hi) {
                            continue;
                        }
                        const yy = q.y - drop * (q.y + q.rh * 2);
                        lump(C, sn, Z, x, yy, q.rw, q.rh, pass ? [st.cloud[1], st.cloud[2], st.cloud[2]] : st.cloud, st.lit > 0 ? (pass ? 0.6 : 1) : 0, st.litCols, q.puffs, 0.95 * FA);
                    }
                }
            }
            C.restore();
            // 앞 가장자리 — 휘몰아치는 날씨 벽
            STORMY.wall(D, X, st, edge, bulge, surge);
            // 번개는 영역 밖까지 보이게
            for (const b of st.bolts) {
                if (b.life / b.max > 0.2 && Math.floor(b.life / 0.035) % 4 === 3) {
                    continue;
                }
                const k = b.life / b.max;
                const a = (k > 0.55 ? (1 - k) / 0.45 : 1) * FA;
                const hot = b.life < 0.06 ? 2 : 0;
                b.br.forEach((p) => drawBolt(C, sn, Z, p, Math.max(1, Math.round(b.w / 2)), cols[2], null, a));
                drawBolt(C, sn, Z, b.pts, b.w + hot, cols[2], cols[3], a);
            }
        },
        // 땅 — 눈 더미 · 독늪 · 불길 · 물결 · 꽃잎 더미 (영역 안)
        ground(D, X, st, lo, hi, env) {
            const { G, cols, kind } = st;
            const t = D.t;
            const H = D.H;
            const s = Z;
            if (kind === 'blizzard') {
                const colW = 2 * s;
                const maxH = Math.max(5 * s, H * 0.05) * env;
                for (let x = Math.floor(lo / colW) * colW; x < hi; x += colW) {
                    const col = Math.round(x / colW);
                    const h = maxH * (0.55 + 0.45 * hash(col, 11));
                    alpha(0.88);
                    fill(x, G - h, x + colW, G, cols[2]);
                    fill(x, G - h, x + colW, G - h + s, '#ffffff');
                    if (hash(col, 12) > 0.84) {
                        const sh = maxH * (1.4 + 1.6 * hash(col, 13));
                        for (let r = 0; r < sh; r += s) {
                            const wdt = Math.max(1, Math.round((1 - r / sh) * 2.5));
                            dot(x + colW / 2 - (wdt * s) / 2, G - h - r, r < sh * 0.3 ? cols[1] : '#ffffff', wdt, 1);
                        }
                    }
                }
            } else if (kind === 'acid') {
                const gap = Math.max(D.lane * 3, D.W * 0.12);
                for (let i = Math.floor(lo / gap) - 1; i * gap < hi + gap; i++) {
                    const x = (i + 0.2 + 0.6 * hash(i, 20)) * gap;
                    const rx = gap * (0.3 + 0.15 * hash(i, 21)) * env;
                    if (rx < Z) {
                        continue;
                    }
                    const py = G - 2 * s;
                    alpha(0.85);
                    disc(x, py, rx, Math.max(Z, rx * 0.16), cols[3]);
                    alpha(0.9);
                    disc(x, py, rx * 0.8, Math.max(Z, rx * 0.1), cols[2]);
                    disc(x - rx * 0.2, py - rx * 0.04, rx * 0.35, Z * 0.5, cols[1]);
                    // 부글부글
                    for (let j = 0; j < 3; j++) {
                        const cyc = 0.45 + 0.3 * hash(j, i);
                        const tt = t + hash(j, i + 1) * 3;
                        const k = (tt % cyc) / cyc;
                        const bx = x + (hash(j + Math.floor(tt / cyc), i) - 0.5) * rx * 1.4;
                        const by = py - k * 8 * s;
                        alpha(0.95);
                        if (k < 0.85) {
                            ring(bx, by, (1 + Math.round(k * 2)) * s, (1 + Math.round(k * 2)) * s, 8, 0, cols[1], cols[1]);
                        } else {
                            for (const [dx, dy] of [[-3, -1], [3, -1], [-2, -3], [2, -3]]) {
                                dot(bx + dx * s, by + dy * s, cols[0]);
                            }
                        }
                    }
                }
            } else if (kind === 'fire') {
                const colW = 2 * s;
                const maxH = Math.max(6 * s, H * 0.1) * env;
                for (let x = Math.floor(lo / colW) * colW; x < hi; x += colW) {
                    const col = Math.round(x / colW);
                    const n1 = Math.sin(x * 0.09 + t * 11) * 0.5 + 0.5;
                    const n2 = Math.sin(x * 0.031 - t * 6.3 + 1.7) * 0.5 + 0.5;
                    const h = maxH * (0.2 + 0.5 * n1 * n2 + 0.3 * hash(col, Math.floor(t * 12)));
                    let y = G;
                    for (const [f, k] of [[0.35, 0], [0.3, 1], [0.22, 2], [0.13, 3]]) {
                        const hh = Math.max(s, sn(h * f));
                        y -= hh;
                        alpha(0.92);
                        fill(x, y, x + colW, y + hh, cols[k]);
                    }
                }
            } else if (kind === 'rain' || kind === 'thunder') {
                // 땅 물결 · 물안개
                const m = Math.round((kind === 'rain' ? 20 : 10) * st.area);
                for (let j = 0; j < m; j++) {
                    const cyc = 0.5 + 0.3 * hash(j, 20);
                    const tt = t + hash(j, 21) * 5;
                    const k = (tt % cyc) / cyc;
                    const x = hash(j, Math.floor(tt / cyc) + 30) * D.W;
                    if (x < lo || x > hi) {
                        continue;
                    }
                    const r = (1 + k * 6) * s;
                    alpha(0.5);
                    ring(x, G - s, r, r * 0.25, 10, 0, kind === 'rain' ? cols[1] : '#bcd0ee', '#ffffff');
                }
                alpha(0.14 * env);
                fill(lo, G - 3 * s, hi, G, '#dfefff');
            } else if (kind === 'petal' || kind === 'leaf') {
                const gap = 2.5 * s;
                for (let i = Math.floor(lo / gap); i * gap < hi; i++) {
                    if (hash(i, 13) > 0.7 * env) {
                        continue;
                    }
                    const cells = (kind === 'leaf' ? LEAF : PETAL)[i % 4];
                    const x = i * gap;
                    const y = G - (1 + Math.floor(hash(i, 14) * 3)) * s;
                    alpha(0.9);
                    for (const [dx, dy, ci] of cells) {
                        dot(x + dx * s, y + dy * s - s, cols[ci]);
                    }
                }
            }
        },
        // 날씨 벽 — 뭉게뭉게 휘몰아치는 가장자리 (불은 날름대는 불길)
        wall(D, X, st, edge, bulge, surge) {
            const { G, cols, kind } = st;
            const t = D.t;
            const dir = X.dir;
            const lane = D.lane;
            const top = st.bandH * 0.15;
            const wc = st.wall;
            if (kind === 'fire') {
                for (let y = sn(top); y < G; y += Z) {
                    const n1 = 0.5 + 0.5 * Math.sin(y * 0.13 + t * 19);
                    const n2 = 0.5 + 0.5 * Math.sin(y * 0.05 - t * 11 + 1.3);
                    const dd = lane * (0.7 + 0.9 * n1 * n2 + 0.6 * bulge(y)) * surge;
                    const xe = edge(y) + dir * lane * 0.25 * n1 * (1 - bulge(y));
                    // 앞 가장자리는 검붉게, 안쪽일수록 밝게 (가운데 심)
                    for (const [f, ci, a] of [[1, 3, 0.85], [0.78, 2, 0.95], [0.55, 1, 1], [0.3, 0, 1]]) {
                        alpha(a);
                        fill(xe - dir * dd * (1.6 - 0.15 * (1 - f)), y, xe - dir * dd * 1.6 * (1 - f) * 0.5, y + Z, cols[ci]);
                    }
                }
            } else if (kind === 'wind') {
                // 바람 벽 — 돌돌 말리는 바람 줄
                for (let j = 0; j < 9; j++) {
                    const y0 = top + ((j + 0.5) / 9) * (G - top);
                    const r = lane * (0.35 + 0.2 * hash(j, 3)) * surge * (1 + 0.4 * bulge(y0));
                    const cx = edge(y0) - dir * r;
                    alpha(0.85);
                    for (let k = 0; k < 14; k++) {
                        const a = t * 9 * dir + j + (k / 14) * TAU * 0.85;
                        const rr = r * (1 - k * 0.04);
                        dot(cx + Math.cos(a) * rr, y0 + Math.sin(a) * rr * 0.6, k < 5 ? '#ffffff' : cols[1]);
                    }
                    alpha(0.6);
                    fill(cx - dir * lane * 1.6, y0 + r * 0.6, cx, y0 + r * 0.6 + Z, j % 2 ? '#ffffff' : cols[1]);
                }
            } else {
                // 뭉게 벽 — 겹친 덩어리가 꿈틀
                const m = Math.max(4, Math.ceil((G - top) / (lane * 0.7)));
                for (let j = 0; j < m; j++) {
                    let y = top + ((j + 0.5) / m) * (G - top) + Math.sin(t * 5 + j * 1.7) * Z * 2;
                    const r = lane * (0.42 + 0.22 * hash(j, 3) + 0.1 * Math.sin(t * 9 + j * 2.1)) * surge * (1 + 0.35 * bulge(y));
                    y = Math.min(y, G - r * 0.75);
                    const x = edge(y) - dir * r * 0.55;
                    alpha(0.92);
                    disc(x, y, r, r * 0.8, wc[2]);
                    alpha(0.95);
                    disc(x - dir * r * 0.12, y - r * 0.18, r * 0.72, r * 0.55, wc[1]);
                    alpha(0.9);
                    disc(x - dir * r * 0.25, y - r * 0.35, r * 0.36, r * 0.26, wc[0]);
                }
            }
            // 벽 속에서 휘몰아치는 알갱이
            const n = Math.round(30 * Math.sqrt(st.area) * surge);
            const span = G - top;
            for (let i = 0; i < n; i++) {
                const ph = hash(i, 7);
                let x;
                let y;
                if (kind === 'thunder' || kind === 'rain' || kind === 'acid') {
                    y = top + wrap(hash(i, 1) * span + t * D.H * 1.6, span);
                    x = edge(y) - dir * ph * lane * 1.3;
                    alpha(0.9);
                    dot(x, y, kind === 'acid' ? cols[1] : '#d6e4ff', 1, 3);
                } else if (kind === 'fire') {
                    y = G - wrap(hash(i, 1) * span + t * D.H * 0.8, span);
                    x = edge(y) - dir * ph * lane * 1.2 + Math.sin(t * 9 + i) * Z * 2;
                    alpha(0.9);
                    dot(x, y, i % 2 ? cols[0] : cols[1]);
                } else if (kind === 'sand' || kind === 'wind') {
                    y = top + hash(i, 1) * span;
                    x = edge(y) - dir * wrap(ph * lane * 1.6 - t * lane * 5, lane * 1.6);
                    alpha(0.85);
                    fill(x, y, x - dir * 3 * Z, y + Z, kind === 'sand' ? cols[0] : '#ffffff');
                } else if (kind === 'blizzard') {
                    y = top + wrap(hash(i, 1) * span + t * D.H * 0.7, span);
                    x = edge(y) - dir * wrap(ph * lane * 1.4 - t * lane * 3, lane * 1.4);
                    alpha(1);
                    dot(x, y, '#ffffff');
                    dot(x - Z, y, cols[1]);
                    dot(x + Z, y, cols[1]);
                    dot(x, y - Z, cols[1]);
                    dot(x, y + Z, cols[1]);
                } else {
                    const a = t * 5 * dir + ph * TAU;
                    y = top + hash(i, 1) * span + Math.sin(a) * lane * 0.4;
                    x = edge(y) - dir * (0.5 + 0.5 * Math.cos(a)) * lane * 1.2;
                    alpha(1);
                    for (const [dx, dy, ci] of (kind === 'leaf' ? LEAF : PETAL_BIG)[(i + Math.floor(t * 9)) % 4]) {
                        dot(x + dx * Z, y + dy * Z, cols[ci]);
                    }
                }
            }
        },
        push(D, X, strong) {
            const st = stormSt(D, X);
            if (!strong) {
                return;
            }
            const z = st.Z;
            const fx = X.front - X.dir * D.lane * 0.4;
            switch (st.kind) {
                case 'thunder':
                case 'rain':
                    stormBolt(st, D, X, X.front, true, D.ym);
                    break;
                case 'blizzard':
                    for (let i = 0; i < 6; i++) {
                        stormFaller(st, D, X, fx - X.dir * rnd(0, D.lane * 2), i === 0);
                    }
                    screenFlash(z, 0.15, '#f2fbff', 0.2);
                    break;
                case 'fire':
                    stormFaller(st, D, X, fx, true);
                    stormFaller(st, D, X, fx - X.dir * D.lane, true);
                    break;
                case 'wind':
                case 'sand':
                    st.gusts.push({ t0: D.t, thick: true });
                    st.gusts.push({ t0: D.t + 0.1, thick: false });
                    break;
                case 'acid':
                    for (let i = 0; i < 10; i++) {
                        chunk(fx, st.G - z, z, rnd(-0.5, 1) * X.dir * D.H * 0.3, -rnd(0.5, 1) * D.H, D.H * 2, st.G, pick(st.cols), pick([1, 2]), st.cols[0], true);
                    }
                    break;
                default:
                    for (let i = 0; i < 14; i++) {
                        STORMY.bit(st, D, X, X.front, D.ym + rnd(-1, 1) * D.lane, true);
                    }
            }
        },
        win(D, X, L) {
            // 날씨가 진 쪽을 덮침 — 번개 직격 · 얼음 덩이 · 불길 · 독 · 꽃잎 · 바람 소용돌이
            const st = stormSt(D, X);
            st.won = true;
            const z = st.Z;
            const cols = st.cols;
            const G = st.G;
            const r = { x: L.body.cx, y: L.body.cy, w: L.w, h: L.h, bottom: Math.min(G, L.body.bottom + 2) };
            const swirl = (glyphs, cc, n = 14) => art(1.2, z, G, (life) => {
                const t = life / 1.2;
                for (let j = 0; j < n; j++) {
                    const a = (j / n) * TAU + life * 9;
                    const rr = r.w * (0.6 + 0.5 * t) + 4 * Z;
                    const x = r.x + Math.cos(a) * rr;
                    const y = r.y - t * r.h * 0.8 + Math.sin(a) * rr * 0.35 + (j % 3) * Z * 2;
                    alpha(1 - t * t);
                    if (glyphs) {
                        for (const [dx, dy, ci] of glyphs[(j + Math.floor(life * 10)) % 4]) {
                            dot(x + dx * Z, y + dy * Z, cc[ci]);
                        }
                    } else {
                        fill(x, y, x + 3 * Z, y + Z, cc[j % 3]);
                    }
                }
            });
            switch (st.kind) {
                case 'thunder':
                case 'rain':
                    stormBolt(st, D, X, r.x, true, r.y);
                    art(1.4, z, G, (life) => {
                        const a = (1 - life / 1.4) ** 1.5;
                        const rx = Math.max(r.w, D.lane * 2) * 1.4;
                        ellipse(C, sn, Z, r.x, G, rx, rx * 0.16, cols[2], a * 0.6, G);
                        ellipse(C, sn, Z, r.x, G, rx * 0.6, rx * 0.1, cols[1], a * 0.85, G);
                        ellipse(C, sn, Z, r.x, G, rx * 0.3, rx * 0.05, cols[0], a, G);
                    });
                    for (let i = 0; i < 8; i++) {
                        sparkle(r.x + rnd(-1, 1) * r.w * 0.6, r.y + rnd(-1, 1) * r.h * 0.4, z, cols, 0, -rnd(20, 60), rnd(0.4, 0.8));
                    }
                    break;
                case 'blizzard':
                    art(1.5, z, G, (life) => {
                        const t = life / 1.5;
                        const k = easeOut(life / 0.2);
                        const hw = (r.w * 0.55 + 2 * Z) * k;
                        const top = r.bottom - (r.h + 3 * Z) * k;
                        const a = t > 0.8 ? (1 - t) / 0.2 : 1;
                        alpha(0.3 * a);
                        fill(r.x - hw, top, r.x + hw, r.bottom, cols[1]);
                        alpha(a);
                        for (let x = -hw; x <= hw; x += Z) {
                            dot(r.x + x, top, '#ffffff');
                            dot(r.x + x, r.bottom - Z, '#ffffff');
                        }
                        for (let y = top; y <= r.bottom; y += Z) {
                            dot(r.x - hw, y, '#ffffff');
                            dot(r.x + hw, y, '#ffffff');
                        }
                        for (let j = 0; j < 4; j++) {
                            const x = r.x - hw + (j + 0.5) * (hw / 2);
                            for (let h = 0; h < 3 + (j % 2) * 2; h++) {
                                dot(x, top - h * Z, '#ffffff');
                            }
                        }
                    });
                    for (let i = 0; i < 10; i++) {
                        sparkle(r.x + rnd(-0.7, 0.7) * r.w, r.y + rnd(-0.5, 0.5) * r.h, z, ['#ffffff', '#ffffff', cols[1]], 0, -rnd(10, 40), rnd(0.4, 0.8));
                    }
                    for (let i = 0; i < 6; i++) {
                        stormFaller(st, D, X, r.x + rnd(-1, 1) * r.w, i < 2);
                    }
                    break;
                case 'fire':
                    flames(r.x, r.bottom, z, cols, 26, D.H * 0.9, r.w / (2 * z));
                    sigRing(r.x, r.bottom, z, z * 2, r.w * 1.6, 0.3, 0.4, [cols[0], cols[1]]);
                    stormFaller(st, D, X, r.x, true);
                    break;
                case 'acid':
                    for (let i = 0; i < 14; i++) {
                        chunk(r.x + rnd(-0.5, 0.5) * r.w, r.bottom - z, z, rnd(-1, 1) * D.H * 0.3, -rnd(0.4, 1) * D.H * 0.8, D.H * 1.6, G, pick(cols), pick([1, 2]), cols[0], true);
                    }
                    for (let i = 0; i < 6; i++) {
                        puff(r.x + rnd(-0.5, 0.5) * r.w, r.y + rnd(-0.3, 0.3) * r.h, z, pick([cols[1], cols[2]]), rnd(-30, 30), -rnd(10, 40), rnd(0.8, 1.2), 6, 0.5, 2);
                    }
                    break;
                case 'petal':
                    swirl(PETAL_BIG, [cols[0], cols[1], cols[2]], 14);
                    break;
                case 'leaf':
                    swirl(LEAF, [cols[0], cols[1], cols[2]], 14);
                    break;
                case 'sand':
                    for (let j = 0; j < 6; j++) {
                        puff(r.x + rnd(-0.5, 0.5) * r.w, r.bottom - rnd(0, 0.5) * r.h, z, pick([cols[1], cols[2]]), X.dir * D.H * 0.4, -D.H * 0.05, rnd(0.6, 1), 6, 0.6, 2);
                    }
                    swirl(null, [cols[0], cols[1], cols[2]], 14);
                    break;
                default:
                    swirl(null, ['#ffffff', cols[1], cols[2]], 16);
            }
        },
    };

    // ═════════════════ meteor — 하늘에서 떨어짐 (ultskyfall): 여럿이면 유성이 비처럼, 하나면 거대한 바위 · 얼음이 앞머리를 짓누름 ═════════════════
    // 거대한 바위 · 얼음 — 칸 하나를 1px 로 작은 canvas 에 그려 두고 크게 늘려 그림 (fx-sky 와 같은 그림)
    function makeGiant(shape, N, cols) {
        const cv = document.createElement('canvas');
        cv.width = N;
        cv.height = N;
        const g = cv.getContext('2d');
        const hot = document.createElement('canvas');
        hot.width = N;
        hot.height = N;
        const h = hot.getContext('2d');
        const put = (c, i, j, color) => {
            c.fillStyle = color;
            c.fillRect(i, j, 1, 1);
        };
        if (shape === 'ice') {
            const gems = [[-0.48, 0.32, 0.3, 0.62, -0.45], [0.5, 0.3, 0.28, 0.6, 0.5], [0, 0.04, 0.46, 0.95, 0]];
            for (let j = 0; j < N; j++) {
                for (let i = 0; i < N; i++) {
                    const x = ((i + 0.5) / N) * 2 - 1;
                    const y = ((j + 0.5) / N) * 2 - 1;
                    for (let k = gems.length - 1; k >= 0; k--) {
                        const [gx, gy, hw, hh, tilt] = gems[k];
                        const c = Math.cos(tilt);
                        const sn2 = Math.sin(tilt);
                        const lx = (x - gx) * c + (y - gy) * sn2;
                        const ly = -(x - gx) * sn2 + (y - gy) * c;
                        const d = Math.abs(lx) / hw + Math.abs(ly) / hh;
                        if (d > 1) {
                            continue;
                        }
                        const facet = (lx < 0 ? 0 : 1) + (ly < 0 ? 0 : 2);
                        let color = [cols[0], cols[1], cols[2], cols[3]][facet];
                        if (d > 1 - 2.2 / N / hw) {
                            color = '#2c6e9e';
                        } else if (Math.abs(lx) < 1 / N && ly < 0) {
                            color = '#ffffff';
                        } else if (hash(i * 31 + j, 5) > 0.97) {
                            color = '#ffffff';
                        }
                        put(g, i, j, color);
                        if (d > 0.8 && y > -0.2) {
                            put(h, i, j, d > 0.9 ? '#ffffff' : '#cff6ff');
                        }
                        break;
                    }
                }
            }
            return { cv, hot };
        }
        const nv = 10;
        const verts = [];
        for (let k = 0; k < nv; k++) {
            verts.push({ a: (k / nv) * TAU + rnd(-0.18, 0.18), r: rnd(0.8, 0.98) });
        }
        verts.sort((a, b) => a.a - b.a);
        const edge = (a) => {
            a = wrap(a, TAU);
            for (let k = 0; k < nv; k++) {
                const v0 = verts[k];
                const v1 = verts[(k + 1) % nv];
                const a0 = wrap(v0.a, TAU);
                let a1 = wrap(v1.a, TAU);
                if (a1 <= a0) {
                    a1 += TAU;
                }
                const aa = a < a0 ? a + TAU : a;
                if (aa >= a0 && aa <= a1) {
                    return [lerp(v0.r, v1.r, (aa - a0) / (a1 - a0)), k];
                }
            }
            return [0.85, 0];
        };
        const craters = [];
        for (let k = 0; k < 3; k++) {
            craters.push({ x: rnd(-0.45, 0.45), y: rnd(-0.5, 0.3), r: rnd(0.1, 0.17) });
        }
        const deep = '#3a2e22';
        for (let j = 0; j < N; j++) {
            for (let i = 0; i < N; i++) {
                const x = ((i + 0.5) / N) * 2 - 1;
                const y = ((j + 0.5) / N) * 2 - 1;
                const r = Math.hypot(x, y);
                const [R, face] = edge(Math.atan2(y, x));
                if (r > R) {
                    continue;
                }
                const lean = (r / R) ** 2;
                const shade = 0.5 - 0.55 * lean * ((x * 0.62 + y * 0.78) / Math.max(r, 0.01)) - 0.12 * (x * 0.62 + y * 0.78) + (hash(face, 9) - 0.5) * 0.22 + (hash(i * 57 + j, 3) - 0.5) * 0.1;
                let color;
                for (const c of craters) {
                    const d = Math.hypot(x - c.x, y - c.y) / c.r;
                    if (d < 1) {
                        const lit = (x - c.x) * 0.62 + (y - c.y) * 0.78 > 0;
                        color = d < 0.7 ? (lit ? cols[2] : deep) : lit ? cols[1] : cols[3];
                    }
                }
                color = color ?? (shade > 0.8 ? cols[0] : shade > 0.6 ? cols[1] : shade > 0.38 ? cols[2] : shade > 0.18 ? cols[3] : deep);
                if (r > R - 2.2 / N) {
                    color = '#1e160e';
                }
                put(g, i, j, color);
                if (y > -0.05 && r > R - 4.5 / N) {
                    put(h, i, j, r > R - 2.2 / N ? '#ffe680' : '#ff7a21');
                }
            }
        }
        // 갈라진 금 — 안에서 용암빛
        for (let k = 0; k < 3; k++) {
            const a = rnd(0, TAU);
            const pts = jag(Math.cos(a) * 0.15, Math.sin(a) * 0.15, Math.cos(a + rnd(2, 3.5)) * 0.8, Math.sin(a + rnd(2, 3.5)) * 0.8, 0.08, 0.3);
            for (let m = 1; m < pts.length; m++) {
                const [x0, y0] = pts[m - 1];
                const [x1, y1] = pts[m];
                const steps = Math.max(1, Math.ceil((Math.hypot(x1 - x0, y1 - y0) * N) / 2));
                for (let q = 0; q <= steps; q++) {
                    const x = lerp(x0, x1, q / steps);
                    const y = lerp(y0, y1, q / steps);
                    const i = Math.floor(((x + 1) / 2) * N);
                    const j = Math.floor(((y + 1) / 2) * N);
                    if (Math.hypot(x, y) < edge(Math.atan2(y, x))[0] - 3 / N) {
                        put(g, i, j, '#1e160e');
                        put(h, i, j, q % 3 ? '#ff9d3c' : '#ffe680');
                    }
                }
            }
        }
        return { cv, hot };
    }
    // 다섯 꼭지 별 (7×7) — 0 은 하얀 가운데
    const STAR = [];
    ['...1...', '..121..', '1112111', '.12221.', '..121..', '.11.11.', '.1...1.'].forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && STAR.push([x - 3, y - 3, ch === '2' ? 0 : 1])));
    const hsl = (h, l = 60) => `hsl(${Math.round(((h % 360) + 360) % 360)}, 100%, ${l}%)`;
    function metSt(D, X) {
        const st = base(D, X);
        if (st.shape) {
            return st;
        }
        const o = X.o || {};
        const z = st.Z;
        const P = st.P;
        st.shape = ['rock', 'ice', 'meteor', 'star'].includes(o.shape) ? o.shape : 'rock';
        st.n = Math.round(Number(o.n ?? (st.shape === 'meteor' || st.shape === 'star' ? 8 : 1)) || 1);
        st.giant = st.n <= 1;
        st.star = st.shape === 'star' && !st.giant;
        st.ice = st.shape === 'ice';
        st.ux = X.dir * Math.cos(1.05);
        st.uy = Math.sin(1.05);
        st.bandH = Math.max(36, D.H * 0.36);
        st.rocks = [];
        st.flashes = [];
        st.marks = [];
        if (st.giant) {
            st.cols = o.c ? sigPal(o.c) : st.ice ? sigPal('ice') : ['#c9b08a', '#97805e', '#6a5640', '#463828'];
            st.tcol = st.ice ? ['#ffffff', '#e3faff', '#9fe8ff', '#55c2ef'] : sigPal('fire');
            let d0 = clamp(Math.max(st.hRef * 2.3, D.lane * 3.5), 36, Math.min(st.G * 0.7, 200)) * (0.85 + 0.2 * P);
            d0 = Math.min(d0, Math.max(D.lane * 3, D.half * 1.1));
            st.Cc = z * Math.max(1, Math.round(d0 / (z * 30)));
            st.N = Math.max(12, Math.round(d0 / st.Cc));
            st.Dg = st.N * st.Cc;
            st.R0 = Math.max(2 * z, st.Dg * 0.07);
            st.rate = 4;
            try {
                st.img = makeGiant(st.ice ? 'ice' : 'rock', st.N, st.cols);
            } catch (err) {
                fail('makeGiant', err);
            }
            st.hotT = -9;
        } else {
            st.cols = sigPal(o.c || (st.shape === 'star' ? 'star' : st.ice ? 'ice' : st.shape === 'rock' ? 'rock' : 'fire'));
            st.tcol = st.shape === 'rock' ? sigPal('fire') : st.cols;
            st.R0 = clamp(Math.min(D.W, D.H) * 0.035, 4, 14) * (0.85 + 0.3 * P);
            st.rate = clamp(st.n * 0.55, 3, 8);
        }
        return st;
    }
    // 거대한 것 자리 — ym 높이 둘레가 front, 처음엔 하늘에서 비스듬히 내려옴
    function giantPos(D, X, st) {
        const R = st.Dg / 2;
        const G = st.G;
        const cy = Math.min(D.ym, G - R - st.Z);
        const dy = D.ym - cy;
        const dx = Math.sqrt(Math.max(R * R - dy * dy, (R * 0.35) ** 2));
        let x = X.front - X.dir * dx * (1 - 0.04 * X.pa);
        let y = cy;
        if (!st.landed) {
            const k = k01(reach(X) / Math.max(1, D.half));
            if (k >= 0.999 || D.phase !== 'go') {
                st.landed = true;
            } else {
                y = lerp(-R * 1.4, cy, easeOut(k));
                x -= X.dir * (1 - k) * R * 1.2;
            }
        }
        // 짓누르는 동안 덜덜
        const j = (1 + 2 * X.pa) * st.Z * 0.5;
        return [x + Math.sin(D.t * 53) * j, y + Math.sin(D.t * 41 + 1) * j * 0.6, R];
    }
    function metRock(D, X, st, front) {
        const R = st.R0 * (front ? rnd(0.9, 1.25) : rnd(0.7, 1.1));
        const tx = front ? X.front : along(X, reach(X) * rnd(0.08, 0.92));
        const ty = front ? D.ym + rnd(-0.4, 0.4) * D.lane : st.G - rnd(0, 2) * st.Z;
        const dy = ty + R * 3 + 10;
        st.rocks.push({ front, R, sx: tx - (st.ux / st.uy) * dy, sy: ty - dy, tx, ty, T: front ? rnd(0.32, 0.42) : rnd(0.45, 0.6), life: 0, trail: [] });
    }
    function metImpact(D, X, st, q) {
        const z = st.Z;
        const G = st.G;
        const t = D.t;
        if (q.front) {
            // 맞부딪히는 곳에서 펑
            st.flashes.push({ x: q.x, y: q.y, r: q.R * 3, t0: t, dur: 0.3, air: true });
            sigBurst(q.x, q.y, z, [...st.cols.slice(0, 3), '#ffffff'], 7, 50);
            if (st.star) {
                for (let i = 0; i < 3; i++) {
                    sparkle(q.x, q.y, z, st.cols, rnd(-40, 40), -rnd(20, 60), rnd(0.3, 0.6));
                }
            } else {
                flames(q.x, q.y, z, st.tcol, 3, D.H * 0.3, 2);
            }
            return;
        }
        st.flashes.push({ x: q.tx, y: G, r: q.R * 3.5, t0: t, dur: 0.4 });
        st.marks.push({ x: q.tx, rx: q.R * 3.5, t0: t, dur: 1.0 });
        sigRing(q.tx, G - z, z, 2 * z, q.R * 6, 0.25, 0.45, ['#ffffff', st.cols[1], st.cols[2]]);
        for (let i = 0; i < 5; i++) {
            chunk(q.tx, G - z, z, rnd(-1, 1) * D.H * 0.4, -rnd(0.3, 0.9) * D.H, D.H * 2.4, G, pick([...st.cols, '#8a7252']), pick([1, 1, 2]), undefined, false, 1.2);
        }
        if (st.star) {
            for (let i = 0; i < 4; i++) {
                sparkle(q.tx + rnd(-1, 1) * q.R, G - q.R, z, st.cols, rnd(-30, 30), -rnd(30, 90), rnd(0.4, 0.8));
            }
        } else {
            flames(q.tx, G, z, st.tcol, 5, D.H * 0.5, 3);
        }
    }
    // 유성 하나 그리기 — 지나온 길 · 꼬리 · 머리
    function drawRock(st, q, big) {
        if (q.x === undefined) {
            return;
        }
        const R = q.R;
        const tc = st.tcol;
        fillPts(C, sn, Z, [[q.sx, q.sy], [q.x, q.y]], Math.max(1, Math.round(R / (2 * Z))), tc[2], 0.25 * FA);
        const L = q.trail.length;
        for (let j = L - 1; j >= 1; j--) {
            const f = j / L;
            const w = Math.max(1, Math.round(((R * 2) / Z) * (1 - f) * 0.9));
            const c = st.star ? hsl(j * 30 + q.life * 600, 70) : tc[Math.min(3, Math.floor(f * 4))];
            fillPts(C, sn, Z, [q.trail[j], q.trail[j - 1]], w + 2, tc[3], (1 - f) * 0.35 * FA);
            fillPts(C, sn, Z, [q.trail[j], q.trail[j - 1]], w, c, (1 - f * 0.6) * FA);
        }
        if (st.star) {
            const k2 = Math.max(1, Math.round((R * 1.3) / (3 * Z)));
            alpha(1);
            for (const [dx0, dy0, c] of STAR) {
                C.fillStyle = c ? st.cols[2] : '#ffffff';
                C.fillRect(sn(q.x + dx0 * Z * k2 - (Z * k2) / 2), sn(q.y + dy0 * Z * k2 - (Z * k2) / 2), Z * k2, Z * k2);
            }
            alpha(0.7);
            ring(q.x, q.y, R * (1.7 + 0.2 * Math.sin(q.life * 30)), R * (1.7 + 0.2 * Math.sin(q.life * 30)), 16, 0, st.cols[1], '#ffffff');
            return;
        }
        const rock = st.shape === 'rock' || st.giant;
        ellipse(C, sn, Z, q.x, q.y, R * 1.8, R * 1.8, tc[3], 0.3 * FA);
        ellipse(C, sn, Z, q.x, q.y, R * 1.3, R * 1.3, tc[2], FA);
        ellipse(C, sn, Z, q.x, q.y, R, R, rock ? st.cols[2] : tc[1], FA);
        ellipse(C, sn, Z, q.x - R * 0.2, q.y - R * 0.2, R * 0.55, R * 0.55, rock ? st.cols[1] : tc[0], FA);
        if (big) {
            ellipse(C, sn, Z, q.x - R * 0.35, q.y - R * 0.35, R * 0.25, R * 0.25, '#ffffff', FA);
        }
    }
    const METEOR = {
        charge(D, X, k, dt) {
            const st = metSt(D, X);
            const z = st.Z;
            const G = st.G;
            if (st.giant) {
                // 하늘 높이 붉은 / 시린 반짝 — 점점 커짐 + 앞쪽 땅에 그림자가 번짐
                if (!st.glint) {
                    st.glint = true;
                    const gx = X.x0 + X.dir * D.half * 0.35;
                    const gy = st.bandH * 0.25;
                    const sx = X.x0 + X.dir * D.half * 0.85;
                    const sec = DUEL_CHARGE + 0.15;
                    art(sec, z, G, (life) => {
                        const f = life / sec;
                        const r = Z * (1 + 4 * f);
                        alpha(0.5 + 0.5 * Math.abs(Math.sin(life * 18)));
                        for (let i = 1; i <= Math.round(r / Z) + 1; i++) {
                            dot(gx + i * Z, gy, st.tcol[1]);
                            dot(gx - i * Z, gy, st.tcol[1]);
                            dot(gx, gy + i * Z, st.tcol[1]);
                            dot(gx, gy - i * Z, st.tcol[1]);
                        }
                        disc(gx, gy, r * 0.6, r * 0.6, st.tcol[0]);
                        const rx = st.Dg * 0.5 * (0.2 + 0.8 * f);
                        ellipse(C, sn, Z, sx, G - Z, rx, rx * 0.16, '#000000', 0.35 * f, G);
                        if (Math.floor(life / 0.12) % 2 === 0) {
                            alpha(0.5 * f);
                            ring(sx, G - Z, rx * 1.25, rx * 0.2, 20, 0, '#ff5040', '#ffffff');
                        }
                    });
                }
                every(st, 0, dt, 8 + 20 * k, () => sparkle(X.x0 + X.dir * D.half * rnd(0.1, 0.7), rnd(0.05, 1) * st.bandH, z, ['#ffffff', st.tcol[1], st.tcol[2]], 0, 0, rnd(0.3, 0.6)));
                return;
            }
            // 하늘 곳곳이 반짝 · 멀리서 별똥별
            every(st, 0, dt, 20 + 40 * k, () => sparkle(X.x0 + X.dir * D.half * rnd(0, 1.1), rnd(0.05, 1) * st.bandH, z, st.star ? st.cols : ['#ffffff', st.cols[1], st.tcol[2]], 0, 0, rnd(0.3, 0.6)));
            every(st, 1, dt, 4 + 8 * k, () => {
                if (!room()) {
                    return;
                }
                const L = st.bandH * 0.5;
                sigParticle({ x: X.x0 + X.dir * D.half * rnd(-0.3, 0.8), y: rnd(-0.2, 0.5) * st.bandH, s: z, vx: st.ux * D.H * 1.6, vy: st.uy * D.H * 1.6, max: rnd(0.25, 0.4), draw: (ctx, p, t, px) => {
                    for (let d = 0; d < L; d += p.s) {
                        ctx.globalAlpha = (1 - t) * (1 - d / L);
                        dotAt(ctx, px, p.s, p.x - st.ux * d, p.y - st.uy * d, d < 3 * p.s ? '#ffffff' : st.tcol[1]);
                    }
                } });
            });
        },
        tick(D, X, dt) {
            const st = metSt(D, X);
            const on = live(D, X);
            const len = reach(X);
            const z = st.Z;
            const t = D.t;
            if (on && len > 4 * z) {
                if (st.giant) {
                    every(st, 0, dt, 3 + 2 * X.pa, () => metRock(D, X, st, false));
                    // 거대한 것에서 연기 · 불똥 / 눈가루
                    const [gx, gy, R] = giantPos(D, X, st);
                    every(st, 1, dt, 16, () => {
                        if (st.ice) {
                            sparkle(gx + rnd(-0.5, 0.5) * R * 2, gy - R * 0.6, z, ['#ffffff', '#ffffff', st.cols[1]], -st.ux * 40, -rnd(20, 60), rnd(0.4, 0.7));
                        } else {
                            puff(gx + rnd(-0.6, 0.6) * R, gy - R * 0.5, z, pick(['#3a3430', '#5a4e44', '#2e2824']), -st.ux * rnd(20, 60), -rnd(20, 60), rnd(0.5, 0.9), 4, 0.4, 2);
                            if (Math.random() < 0.5) {
                                ember(gx + rnd(-0.6, 0.6) * R, gy + rnd(-0.3, 0.6) * R, z, pick(st.tcol.slice(0, 2)), st.tcol[2], rnd(-30, 30), -rnd(40, 120), rnd(0.4, 0.7));
                            }
                        }
                    });
                } else {
                    every(st, 0, dt, st.rate * (1 + 0.4 * X.pa + 0.4 * D.climax), () => metRock(D, X, st, false));
                    every(st, 1, dt, 2.2 + 3 * X.pa + 2 * D.climax + (D.phase === 'go' ? 3 : 0), () => metRock(D, X, st, true));
                }
            }
            for (let i = st.rocks.length - 1; i >= 0; i--) {
                const q = st.rocks[i];
                q.life += dt;
                if (q.front && on) {
                    q.tx = X.front;
                }
                const k = clamp(q.life / q.T, 0, 1) ** 1.15;
                q.x = lerp(q.sx, q.tx, k);
                q.y = lerp(q.sy, q.ty, k);
                q.trail.unshift([q.x, q.y]);
                q.trail.length = Math.min(q.trail.length, 8);
                if (room(30) && Math.random() < 0.3) {
                    sigParticle({ x: q.x + rnd(-1, 1) * q.R, y: q.y + rnd(-1, 1) * q.R, s: z, vx: -st.ux * rnd(20, 60), vy: -st.uy * rnd(20, 60), g: D.H * 0.3, max: rnd(0.25, 0.45), color: pick(st.tcol), draw: DRAW.dot });
                }
                if (q.life >= q.T) {
                    st.rocks.splice(i, 1);
                    metImpact(D, X, st, q);
                }
            }
            st.flashes = st.flashes.filter((f) => t - f.t0 < f.dur);
            st.marks = st.marks.filter((m) => t - m.t0 < m.dur);
        },
        draw(ctx, px, D, X) {
            const st = metSt(D, X);
            paint(ctx, st.Z, X.fade, st.G, () => METEOR.paint(D, X, st));
        },
        paint(D, X, st) {
            const t = D.t;
            const len = reach(X);
            const G = st.G;
            const lo = Math.min(X.x0, X.front);
            const hi = Math.max(X.x0, X.front);
            // 하늘 — 영역 위쪽이 어두워지고 별이 반짝
            if (len > Z) {
                // 하늘 띠 — 위로 갈수록 진하게, 양 끝은 계단으로 옅어짐
                C.fillStyle = st.giant ? (st.ice ? '#0a2a40' : '#2a0c04') : st.star ? '#0a0a2a' : '#1e0806';
                const e = Math.min((hi - lo) / 3, D.lane * 0.8);
                for (let s = 0; s < 3; s++) {
                    const a = sn(lo + s * e);
                    const b = sn(hi - s * e);
                    if (b <= a) {
                        break;
                    }
                    for (let k = 0; k < 4; k++) {
                        alpha(0.055);
                        C.fillRect(a, 0, b - a, sn(st.bandH * (1 - k * 0.24)));
                    }
                }
                C.save();
                C.beginPath();
                C.rect(sn(lo), 0, Math.max(Z, sn(hi) - sn(lo)), G);
                C.clip();
                const m = Math.round(24 * clamp(D.W / 480, 0.6, 2));
                alpha(0.8);
                for (let j = 0; j < m; j++) {
                    if (Math.sin(t * (3 + 4 * hash(j, 3)) + j) > 0.1) {
                        dot(hash(j, 1) * D.W, hash(j, 2) * st.bandH * 0.9, '#ffffff');
                    }
                }
                // 멀리서 쏟아지는 별똥별
                const L = D.H * 0.18;
                for (let j = 0; j < 8; j++) {
                    const cyc = 0.5 + 0.4 * hash(j, 4);
                    const tt = t + hash(j, 5) * 3;
                    const k = (tt % cyc) / cyc;
                    const seed = Math.floor(tt / cyc) * 7 + j;
                    const hx = lo + hash(seed, 6) * (hi - lo + D.H * 0.4) - (X.dir > 0 ? D.H * 0.3 : 0) + st.ux * L * 2.2 * k;
                    const hy = hash(seed, 7) * st.bandH * 0.8 - D.H * 0.1 + st.uy * L * 2.2 * k;
                    for (let d = 0; d < L; d += Z) {
                        alpha(0.7 * (1 - d / L));
                        dot(hx - st.ux * d, hy - st.uy * d, d < 3 * Z ? '#ffffff' : st.tcol[1]);
                    }
                }
                C.restore();
            }
            // 땅에 남은 빛 자국 · 터지는 빛 덩어리
            for (const mk of st.marks) {
                const a = (1 - (t - mk.t0) / mk.dur) ** 1.5 * FA;
                ellipse(C, sn, Z, mk.x, G, mk.rx, mk.rx * 0.16, st.tcol[2], a * 0.6, G);
                ellipse(C, sn, Z, mk.x, G, mk.rx * 0.6, mk.rx * 0.1, st.tcol[1], a * 0.85, G);
            }
            for (const f of st.flashes) {
                const k = (t - f.t0) / f.dur;
                const r = f.r * easeOut(k * 2.5);
                const a = (k < 0.4 ? 1 : (1 - k) / 0.6) * FA;
                const cut = f.air ? Infinity : f.y;
                ellipse(C, sn, Z, f.x, f.y, r, r * 0.8, st.tcol[3], 0.45 * a, cut);
                ellipse(C, sn, Z, f.x, f.y, r * 0.75, r * 0.6, st.tcol[2], a, cut);
                ellipse(C, sn, Z, f.x, f.y, r * 0.5, r * 0.4, st.tcol[1], a, cut);
                ellipse(C, sn, Z, f.x, f.y, r * 0.28, r * 0.22, '#ffffff', a, cut);
            }
            for (const q of st.rocks) {
                drawRock(st, q, false);
            }
            if (st.giant && !st.won) {
                METEOR.giant(D, X, st);
            }
        },
        // 거대한 바위 · 얼음 — 땅 그림자 · 위 뒤로 남는 꼬리 · 달아오른 테두리
        giant(D, X, st) {
            const t = D.t;
            const G = st.G;
            const [gx, gy, R] = giantPos(D, X, st);
            const near = k01(1 - (G - gy - R) / Math.max(1, G));
            ellipse(C, sn, Z, gx, G - Z, R * 0.9 * (0.4 + 0.6 * near), R * 0.14, '#000000', 0.35 * FA, G);
            // 꼬리
            const ux = -st.ux;
            const uy = -st.uy;
            const tail = (st.landed ? 1.1 + 0.6 * X.pa : 1.9) * R * (1 + 0.15 * Math.sin(t * 20));
            const frame = Math.floor(t / 0.05);
            const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
            for (let j = 0; j < 22; j++) {
                // 뒤 위쪽 테두리에서 뻗어 나감
                const off = (hash(j, 1) - 0.5) * R * 1.6;
                const sx = gx + ux * R * 0.55 - uy * off;
                const sy = gy + uy * R * 0.55 + ux * off;
                const len = (0.3 + 0.7 * hash(j, 2)) * (0.6 + 0.4 * hash(j, frame)) * tail;
                const w = hash(j, 4) > 0.6 ? 2 : 1;
                for (let d = 0; d < len; d += Z) {
                    paths[Math.min(3, Math.floor((d / len) * 4))].rect(sn(sx + ux * d), sn(sy + uy * d), w * Z, Z);
                }
            }
            fillPaths(C, paths, [st.tcol[0], st.tcol[1], st.tcol[2], st.ice ? st.tcol[3] : '#6e6e6e'], 0.8 * FA);
            if (!st.img) {
                ellipse(C, sn, Z, gx, gy, R, R, st.cols[2], FA);
                return;
            }
            C.imageSmoothingEnabled = false;
            const Xs = Math.round((gx - R) / st.Cc) * st.Cc;
            const Ys = Math.round((gy - R) / st.Cc) * st.Cc;
            alpha(1);
            C.drawImage(st.img.cv, Xs, Ys, st.N * st.Cc, st.N * st.Cc);
            const pop = Math.max(0, 1 - (t - st.hotT) / 0.4);
            const glow = st.landed ? 0.35 + 0.45 * X.pa + 0.5 * pop : 0.9;
            alpha((st.ice ? 0.6 : 0.95) * Math.min(1, glow) * (0.85 + 0.15 * Math.sin(t * 40)));
            C.drawImage(st.img.hot, Xs, Ys, st.N * st.Cc, st.N * st.Cc);
        },
        push(D, X, strong) {
            const st = metSt(D, X);
            const z = st.Z;
            if (st.giant) {
                const [gx, gy, R] = giantPos(D, X, st);
                if (strong) {
                    st.hotT = D.t;
                    sigRing(X.front, D.ym, z, z * 2, R * 1.4, 0.8, 0.4, ['#ffffff', st.tcol[1], st.tcol[2]]);
                    for (let i = 0; i < 8; i++) {
                        chunk(X.front, D.ym + rnd(-0.5, 0.5) * R, z, X.dir * rnd(-40, 160), -rnd(0.3, 0.8) * D.H, D.H * 2.4, st.G, pick(st.cols), pick([1, 2, 2]), st.cols[0], true);
                    }
                } else {
                    for (let i = 0; i < 3; i++) {
                        chunk(gx + X.dir * R * 0.6, gy + rnd(-0.5, 0.5) * R, z, -X.dir * rnd(40, 120), -rnd(0.1, 0.4) * D.H, D.H * 2.4, st.G, pick(st.cols), pick([1, 2]), st.cols[0]);
                    }
                }
                return;
            }
            if (strong) {
                // 한꺼번에 몰아침
                for (let i = 0; i < 3; i++) {
                    metRock(D, X, st, true);
                    st.rocks[st.rocks.length - 1].life = -i * 0.07;
                }
            }
        },
        win(D, X, L) {
            const st = metSt(D, X);
            const z = st.Z;
            const G = st.G;
            const H = D.H;
            const cols = st.cols;
            const tx = L.body.cx;
            const [gx, gy, R0] = st.giant ? giantPos(D, X, st) : [0, 0, 0];
            st.won = true;
            if (st.giant) {
                // 거대한 것이 진 쪽 위로 내리찍고 깨짐
                const R = R0;
                const yEnd = G - R * 0.84;
                const tHit = 0.14;
                const tBreak = 0.6;
                const cracks = [];
                for (let k = 0; k < 6; k++) {
                    const side = k % 2 ? -1 : 1;
                    const len = rnd(0.5, 1) * Math.max(R * 2, D.lane * 5);
                    cracks.push(jag(tx, G - z, tx + side * len, G - z - rnd(0, 1) * z * 2, Math.max(2 * z, len / 12), 0.12).map(([x, y]) => [x, Math.min(G - z, y)]));
                }
                const spikes = [];
                if (st.ice) {
                    for (let k = 0; k < 8; k++) {
                        const side = k % 2 ? -1 : 1;
                        const j = Math.floor(k / 2);
                        spikes.push({ x: tx + side * (R * 0.7 + j * R * 0.55), h: R * 2 * rnd(0.35, 0.7) * (1 - j * 0.12), w: R * 2 * rnd(0.12, 0.18), at: j * 0.06 });
                    }
                }
                let hit = false;
                let broke = false;
                art(1.5, z, G, (life) => {
                    // 땅 금
                    if (life > tHit) {
                        const k = easeOut((life - tHit) / 0.3);
                        const a = life > 1.1 ? (1.5 - life) / 0.4 : 1;
                        for (const c of cracks) {
                            const part = c.slice(0, Math.max(2, Math.ceil(c.length * k)));
                            fillPts(C, sn, Z, part, 3, '#1a120c', a * 0.8);
                            fillPts(C, sn, Z, part, 1, st.ice ? cols[1] : '#ff9d3c', a * (0.7 + 0.3 * Math.sin(life * 20)));
                        }
                        // 위로 솟는 빛기둥
                        const lk = (life - tHit) / 0.3;
                        if (lk < 1) {
                            const w = R * 2 * (0.5 + 0.6 * lk);
                            alpha(0.45 * (1 - lk));
                            fill(tx - w / 2, 0, tx + w / 2, G, st.ice ? '#e3faff' : '#fff1c2');
                            alpha(0.8 * (1 - lk));
                            fill(tx - w / 6, 0, tx + w / 6, G, '#ffffff');
                        }
                    }
                    if (life < tBreak) {
                        const k = easeIn(life / tHit);
                        let x = lerp(gx, tx, k);
                        const y = lerp(gy, yEnd, k);
                        if (life > tHit) {
                            x += Math.sin(life * 60) * Z * (1 - (life - tHit) / (tBreak - tHit)) * 2;
                        }
                        if (st.img) {
                            C.imageSmoothingEnabled = false;
                            const Xs = Math.round((x - R) / st.Cc) * st.Cc;
                            const Ys = Math.round((y - R) / st.Cc) * st.Cc;
                            alpha(1);
                            C.drawImage(st.img.cv, Xs, Ys, st.N * st.Cc, st.N * st.Cc);
                            alpha((st.ice ? 0.6 : 0.95) * Math.max(0, 1 - Math.max(0, life - tHit) / (tBreak - tHit)));
                            C.drawImage(st.img.hot, Xs, Ys, st.N * st.Cc, st.N * st.Cc);
                        } else {
                            ellipse(C, sn, Z, x, y, R, R, cols[2], 1, G);
                        }
                    }
                    // 땅에서 얼음 가시
                    if (spikes.length && life > tBreak) {
                        const a = life > 1.25 ? (1.5 - life) / 0.25 : 1;
                        for (const sp of spikes) {
                            const k = easeOut((life - tBreak - sp.at) / 0.15);
                            if (k <= 0) {
                                continue;
                            }
                            const h = sp.h * k;
                            for (let r = 0; r < h; r += Z) {
                                const half = (sp.w / 2) * (1 - r / h);
                                if (half < Z / 2) {
                                    continue;
                                }
                                alpha(a);
                                fill(sp.x - half, G - r - Z, sp.x, G - r, cols[1]);
                                fill(sp.x, G - r - Z, sp.x + half, G - r, cols[2]);
                                dot(sp.x - half, G - r - Z, '#ffffff');
                            }
                        }
                    }
                }, (life) => {
                    if (!hit && life >= tHit) {
                        hit = true;
                        sigRing(tx, G - z, z, R * 0.6, D.W * 0.6, 0.22, 0.6, ['#ffffff', cols[1], cols[0]]);
                        sigRing(tx, G - z, z, R * 0.6, D.W * 0.4, 0.22, 0.75, [st.tcol[1], st.tcol[2]]);
                        for (let i = 0; i < 20; i++) {
                            chunk(tx + rnd(-0.6, 0.6) * R, G - z, z, rnd(-1, 1) * H * 0.6, -rnd(0.5, 1.3) * H, H * 2.6, G, pick(st.ice ? ['#ffffff', cols[0], cols[1], cols[2]] : [cols[1], cols[2], cols[3], '#d1b178']), pick([1, 2, 2, 3]), undefined, true);
                        }
                        for (let i = 0; i < 8; i++) {
                            const side = i % 2 ? -1 : 1;
                            puff(tx + side * rnd(0.4, 1.2) * R, G - rnd(0, 0.5) * R, z, st.ice ? '#e8f8ff' : '#7a6650', side * rnd(40, 160), -rnd(10, 60), rnd(0.8, 1.2), 6, 0.45, 2);
                        }
                        shake(9, 700);
                    }
                    if (!broke && life >= tBreak) {
                        broke = true;
                        screenFlash(z, 0.3, st.ice ? '#e3faff' : '#fff1c2', 0.25);
                        for (let i = 0; i < 16; i++) {
                            const x = tx + rnd(-0.8, 0.8) * R;
                            chunk(x, yEnd + rnd(-0.6, 0.6) * R, z, (x - tx) * rnd(3, 6) + rnd(-30, 30), -rnd(0.6, 1.4) * H, H * 2.6, G, pick(st.ice ? ['#ffffff', cols[1], cols[2]] : cols), pick([2, 3, 3, 4]), st.ice ? '#ffffff' : cols[0], true);
                        }
                        if (st.ice) {
                            for (let i = 0; i < 16; i++) {
                                sparkle(tx + rnd(-1, 1) * R, yEnd + rnd(-1, 1) * R, z, ['#ffffff', '#ffffff', cols[1]], rnd(-40, 40), -rnd(20, 80), rnd(0.4, 0.9));
                            }
                        }
                    }
                });
                return;
            }
            // 여럿 — 마지막 큰 유성이 진 쪽에 내리꽂힘
            const R = st.R0 * 2.4;
            const T = 0.28;
            const dy = G + R * 3;
            const q = { R, sx: tx - (st.ux / st.uy) * dy, sy: G - dy, life: 0, trail: [] };
            let hit = false;
            art(1.5, z, G, (life) => {
                if (life < T) {
                    drawRock(st, q, true);
                    return;
                }
                const k = (life - T) / 1.2;
                const a = (1 - k) ** 1.5;
                const rx = R * 7;
                ellipse(C, sn, Z, tx, G, rx, rx * 0.16, st.tcol[2], a * 0.6, G);
                ellipse(C, sn, Z, tx, G, rx * 0.6, rx * 0.1, st.tcol[1], a * 0.85, G);
                const fk = (life - T) / 0.7;
                if (fk < 1) {
                    const r = R * 6 * easeOut(fk * 2.5);
                    const fa = fk < 0.4 ? 1 : (1 - fk) / 0.6;
                    ellipse(C, sn, Z, tx, G, r, r * 0.8, st.tcol[3], 0.45 * fa, G);
                    ellipse(C, sn, Z, tx, G, r * 0.75, r * 0.6, st.tcol[2], fa, G);
                    ellipse(C, sn, Z, tx, G, r * 0.5, r * 0.4, st.tcol[1], fa, G);
                    ellipse(C, sn, Z, tx, G, r * 0.28, r * 0.22, '#ffffff', fa, G);
                }
                const lk = (life - T) / 0.4;
                if (lk < 1) {
                    const w = R * 3 * (1 + lk);
                    alpha(0.55 * (1 - lk));
                    fill(tx - w / 2, 0, tx + w / 2, G, cols[1]);
                    fill(tx - w / 6, 0, tx + w / 6, G, '#ffffff');
                }
            }, (life, dt) => {
                if (life < T) {
                    q.life = life;
                    const k = clamp(life / T, 0, 1) ** 1.15;
                    q.x = lerp(q.sx, tx, k);
                    q.y = lerp(q.sy, G, k);
                    q.trail.unshift([q.x, q.y]);
                    q.trail.length = Math.min(q.trail.length, 12);
                } else if (!hit) {
                    hit = true;
                    sigRing(tx, G - z, z, z * 2, D.W * 0.7, 0.25, 0.8, ['#ffffff', cols[1], cols[2]]);
                    for (let i = 0; i < 22; i++) {
                        chunk(tx, G - z, z, rnd(-1, 1) * H * 0.6, -rnd(0.5, 1.3) * H, H * 2.4, G, pick([...cols, '#8a7252']), pick([1, 2, 2]), undefined, true);
                    }
                    if (st.star) {
                        for (let i = 0; i < 16; i++) {
                            sparkle(tx + rnd(-1, 1) * R * 2, G - rnd(0, 3) * R, z, cols, rnd(-40, 40), -rnd(40, 120), rnd(0.4, 0.9));
                        }
                    } else {
                        flames(tx, G, z, st.tcol, 22, H * 0.9, 6);
                    }
                    shake(8, 700);
                }
            });
        },
    };

    // ── ground 묶음 — 틀마다 다른 모양 (st.M) ──
    const GROUND = {
        charge: (D, X, k, dt) => {
            const st = groundSt(D, X);
            st.M.charge(D, X, st, k, dt);
        },
        draw: (ctx, px, D, X) => {
            const st = groundSt(D, X);
            paint(ctx, st.Z, X.fade, st.G, () => st.M.draw(D, X, st));
        },
        tick: (D, X, dt) => {
            const st = groundSt(D, X);
            st.M.tick(D, X, st, dt);
        },
        push: (D, X, strong) => {
            const st = groundSt(D, X);
            st.M.push(D, X, st, strong);
        },
        win: (D, X, L) => {
            const st = groundSt(D, X);
            st.won = true;
            st.M.win(D, X, st, L);
        },
    };

    Object.assign(DUEL_FX, { ground: GROUND, tornado: TORNADO, storm: STORMY, meteor: METEOR });
})();
