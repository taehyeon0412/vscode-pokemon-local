
// ───── 필살기 연출 B — 땅 · 자연: ultquake ultpillar ultbloom ultvortex (약속은 ult/SPEC.md) ─────
// 틀마다 큰 장면 입자 하나가 시간표대로 일을 벌이고 바위 · 기둥 · 꽃 · 회오리를 직접 그림
// (입자는 나중 것부터 그려져서, 장면 뒤에 만든 조각 · 먼지 입자는 장면 밑에 깔림)
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
    const hash = (n) => {
        const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
        return v - Math.floor(v);
    };
    const rnd = moveRand;
    const pick = movePick;
    // 세기 — 약한 애도 필살기답게 바닥을 둠
    const power = (P) => 0.4 + 0.6 * clamp(Number(P) || 0, 0, 1);
    // 점 크기 — 패널이 크면 조금 굵게 (nano 도 2 이상)
    const dotSize = (u) => Math.max(u.S || 2, Math.round(Math.min(u.W, u.H * 1.5) / 160));
    // 바라보는 쪽 앞 공간 — 너무 좁으면 반대쪽으로
    function field(u) {
        const room = (d) => (d > 0 ? u.W - u.body.cx : u.body.cx) - u.body.rx;
        let dir = u.dir || 1;
        if (room(dir) < u.W * 0.3 && room(-dir) > room(dir)) {
            dir = -dir;
        }
        return { dir, front: u.body.cx + dir * u.body.rx, room: Math.max(40, room(dir)) };
    }
    const DIRT = ['#f0dcae', '#d1b178', '#a88a55', '#7a6238'];

    // ── 그리기 도구 (장면 그리기 안에서만 — C · Z 는 지금 그리는 ctx · 점 크기) ──
    let C;
    let Z = 2;
    const sn = (v) => Math.round(v / Z) * Z;
    const alpha = (a) => {
        C.globalAlpha = k01(a);
    };
    // 칸에 맞춘 네모 (x0~x1, y0~y1)
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

    // ── 장면 — 시간표([초, 할 일]) · 매 프레임 update(t, dt) · draw(t). 오류가 나도 화면은 안 멈추게 ──
    function safe(p, ctx, fn) {
        try {
            fn();
        } catch (err) {
            p.life = p.max;
            if (!p.failed) {
                p.failed = true;
                ultError('fx-earth', err);
            }
        }
        if (ctx) {
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
        }
    }
    function scene(sec, D, { events = [], update, draw }) {
        const evs = events.filter(Boolean).sort((a, b) => a[0] - b[0]);
        let next = 0;
        sigParticle({ x: 0, y: 0, s: D, max: sec,
            update: (p, dt) => safe(p, null, () => {
                while (next < evs.length && p.life >= evs[next][0]) {
                    const fn = evs[next++][1];
                    try {
                        fn();
                    } catch (err) {
                        ultError('fx-earth event', err);
                    }
                }
                update?.(p.life, dt);
            }),
            draw: (ctx, p) => safe(p, ctx, () => {
                C = ctx;
                Z = D;
                draw?.(p.life);
            }),
        });
    }

    // ── 다른 포켓몬 · 흔들기 (실패해도 연출은 계속) ──
    const others = (u) => {
        try {
            return u.others() || [];
        } catch (err) {
            return [];
        }
    };
    const hit = (q, d, kind) => {
        try {
            ultHit(q, d, kind);
        } catch (err) {
            ultError('fx-earth hit', err);
        }
    };
    // x 둘레 r 안 — from 에서 멀어지는 쪽으로
    function hitAround(u, x, r, kind, from = x) {
        for (const q of others(u)) {
            if (Math.abs(q.x - x) <= r + q.w / 2) {
                hit(q, Math.sign(q.x - from) || u.dir, kind);
            }
        }
    }
    const shake = (amp, ms) => {
        try {
            ultShake(amp, ms);
        } catch (err) {
            // 흔들기 실패는 그냥 넘어감
        }
    };

    // ── 입자 부품 (살아 있는 입자가 너무 많으면 안 만듦) ──
    const full = () => moveParticles.length > 1250;
    const swayUpd = (p, dt) => {
        p.x += Math.sin(p.phase + p.life * p.w) * p.sway * dt;
    };
    const drawBlock = (ctx, p, t, px) => {
        ctx.globalAlpha = t > 0.8 ? (1 - t) / 0.2 : 1;
        dotAt(ctx, px, p.s, p.x, p.y, p.color, p.size, p.size);
        if (p.hi && p.size > 1) {
            dotAt(ctx, px, p.s, p.x, p.y, p.hi, p.size - 1, 1);
        }
        ctx.globalAlpha = 1;
    };
    // 날아가 떨어지는 조각 — 땅(G)에 닿으면 사라짐 (pop 이면 톡)
    function chunk(x, y, s, vx, vy, grav, G, color, size = 1, hi, pop = false, max = 1.8) {
        if (full()) {
            return;
        }
        sigParticle({ x, y, s, vx, vy, g: grav, drag: 0.25, max, color, size, hi, G, pop,
            update: (p) => {
                if (p.vy > 0 && p.y >= p.G - p.size * p.s) {
                    p.life = p.max;
                    if (p.pop && !full()) {
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
        ctx.globalAlpha = 1;
    };
    function puff(x, y, s, color, vx, vy, max = 0.9, grow = 3, a = 0.7, size = 1) {
        if (full()) {
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
        ctx.globalAlpha = 1;
    };
    function flutter(x, y, s, color, vx, vy, max, { g = 40, drag = 1.2, size = 1, sway = 40, hi, flip = 0.09 } = {}) {
        if (full()) {
            return;
        }
        sigParticle({ x, y, s, vx, vy, g, drag, max, color, size, hi, flip, sway, phase: rnd(0, TAU), w: rnd(5, 9), update: swayUpd, draw: drawFlip });
    }
    // 불똥 — 깜박이며 올라감
    const drawEmber = (ctx, p, t, px) => {
        ctx.globalAlpha = (t < 0.7 ? 1 : (1 - t) / 0.3) * (0.6 + 0.4 * Math.abs(Math.sin(p.life * 25 + p.phase)));
        dotAt(ctx, px, p.s, p.x, p.y, t < 0.5 ? p.color : p.c2, p.size, p.size);
        ctx.globalAlpha = 1;
    };
    function ember(x, y, s, color, c2, vx, vy, max, size = 1) {
        if (full()) {
            return;
        }
        sigParticle({ x, y, s, vx, vy, g: -20 * s, drag: 1.6, max, color, c2: c2 || color, size, sway: 25, phase: rnd(0, TAU), w: rnd(4, 8), update: swayUpd, draw: drawEmber });
    }
    // 둥실 — 흔들리며 떠오르다 사라짐 (그림자 기운 · 물안개)
    const drawFloat = (ctx, p, t, px) => {
        ctx.globalAlpha = fadeInOut(t, 0.12, 0.45) * p.a;
        dotAt(ctx, px, p.s, p.x, p.y, p.color, p.size, p.size);
        ctx.globalAlpha = 1;
    };
    function float(x, y, s, color, vx, vy, max, size = 1, a = 0.9) {
        if (full()) {
            return;
        }
        sigParticle({ x, y, s, vx, vy, g: 0, drag: 1.2, max, color, size, a, sway: 30, phase: rnd(0, TAU), w: rnd(3, 6), update: swayUpd, draw: drawFloat });
    }
    function sparkle(x, y, s, cols, vx, vy, max) {
        if (full()) {
            return;
        }
        sigParticle({ x, y, s, vx, vy, drag: 1.5, max, cols, draw: DRAW.sparkle });
    }
    // 한 점으로 빨려 드는 빛
    function mote(x0, y0, x1, y1, s, color, max, size = 1) {
        if (full()) {
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
                ctx.globalAlpha = 1;
            } });
    }

    // 뾰족 바위 — 밑동 yb 에서 h 높이. 두 번 꺾인 가장자리 · 능선을 경계로 밝은 면 / 그늘 면 · 진한 테두리 (clipY 아래는 안 그림)
    const OUTLINE = '#140d09';
    function spikeShape(x, yb, h, bw, lean, seed, rc, clipY, vein) {
        if (h < Z) {
            return;
        }
        const a1 = 0.22 + 0.2 * hash(seed + 1);
        const a2 = 0.55 + 0.25 * hash(seed + 2);
        const kL = [0.8 + 0.4 * hash(seed + 3), 0.7 + 0.6 * hash(seed + 4)];
        const kR = [0.8 + 0.4 * hash(seed + 5), 0.7 + 0.6 * hash(seed + 6)];
        // 높이 비율 fr 에서 폭 (밑동 1 → 끝 0, a1 · a2 에서 꺾임)
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

    // ═════ ultquake — 쿵 구르면 땅이 양쪽으로 갈라지며 바위가 줄줄이 솟고, 한 번 더 크게 들썩 (lava: 틈에서 용암) ═════
    const BASALT = ['#b08a70', '#6e5040', '#4a3428', '#2a1c16'];
    const HOT = ['#ffffff', '#ffffff', '#fff6d8', '#f0dcae'];
    const LAVA = ['#ffffff', '#fff3a0', '#ffb020', '#ff5a10', '#c01808'];
    function quakeRun(u, o, ms, pokemon) {
        const P = power(u.P);
        const D = dotSize(u);
        const W = u.W;
        const H = u.H;
        const G = u.ground;
        const sec = ms / 1000;
        const lava = !!o.lava;
        const cols = sigPal(o.c || 'ground');
        const rock = lava ? BASALT : cols;
        const glow = lava ? LAVA : ['#ffffff', '#fff6d8', cols[0], cols[1]];
        const x0 = u.body.cx;
        const grav = H * 2.6;
        const T0 = 0.34; // 쿵
        const speed = Math.max(W, 360) / 0.8; // 틈이 달리는 빠르기
        const tC = 1.85 + 0.1 * P; // 크게 들썩
        const floorRoom = Math.max(0, H - G);
        const cy = G + Math.min(floorRoom * 0.35, 2 * D);
        const yMax = Math.max(G, H - D);
        // 갈라진 틈 — 양쪽으로 들쭉날쭉 [x, y, 발에서 거리]
        const cracks = [];
        for (const side of [-1, 1]) {
            let x = x0;
            let d = 0;
            const pts = [[x0, cy, 0]];
            while (x > -30 && x < W + 30) {
                const st = rnd(2.5, 5) * D;
                x += side * st;
                d += st;
                const y = clamp(cy + Math.round(rnd(-1.2, 1.2)) * D, G - 2 * D, yMax);
                pts.push([x, y, d]);
                if (Math.random() < 0.3) {
                    const br = [[x, y, d]];
                    let bx = x;
                    let by = y;
                    let bd = d;
                    const vy = floorRoom > 4 * D ? 1 : Math.random() < 0.5 ? -1 : 1;
                    for (let k = 0, m = 2 + Math.floor(rnd(0, 3)); k < m; k++) {
                        bx += side * rnd(1.5, 3) * D;
                        by = clamp(by + vy * rnd(1, 2) * D, G - 2 * D, yMax);
                        bd += 2.5 * D;
                        br.push([bx, by, bd]);
                    }
                    cracks.push({ pts: br, w: 1 });
                }
            }
            cracks.push({ pts, w: 2 });
        }
        // 바위 — 틈 앞머리가 지나가면 솟음, 크게 들썩일 때 부서짐
        const spikes = [];
        const addSpike = (x, h, t0, tEnd, big) => spikes.push({ x, h, bw: h * rnd(0.42, 0.62) * (big ? 0.85 : 1), lean: Math.sign(x - x0 || 1) * rnd(0.02, 0.16), t0, tEnd, seed: rnd(0, 999), big, on: false, off: false });
        const gap = clamp(W / 8, 22, 70);
        for (const side of [-1, 1]) {
            for (let d = Math.max(u.R * 0.55, 4 * D) + rnd(0, gap * 0.4); d < W * 1.2; d += gap * rnd(0.75, 1.25)) {
                const x = x0 + side * d;
                if (x < -gap * 0.3 || x > W + gap * 0.3) {
                    break;
                }
                const h = clamp(G * rnd(0.17, 0.36) * (0.75 + 0.45 * P), 5 * D, G * 0.55);
                addSpike(x, h, T0 + d / speed, tC + rnd(-0.04, 0.1));
                if (Math.random() < 0.45) {
                    addSpike(x + side * gap * rnd(0.3, 0.5), h * rnd(0.35, 0.55), T0 + d / speed + 0.05, tC + rnd(0, 0.12));
                }
            }
        }
        const giants = [];
        for (let i = 0, n = 3 + Math.round(2 * P); i < n; i++) {
            let x = W * ((i + rnd(0.2, 0.8)) / n);
            if (Math.abs(x - x0) < u.R * 0.8) {
                x += (x < x0 ? -1 : 1) * u.R; // 쓰는 애 바로 밑은 피함
            }
            giants.push(x);
            addSpike(x, clamp(G * rnd(0.42, 0.62) * (0.8 + 0.3 * P), 8 * D, G * 0.8), tC + rnd(0, 0.14), tC + 0.95 + rnd(0, 0.15), true);
        }
        // 용암 분출
        const spouts = [];
        const addSpout = (x, t0, dur, h) => spouts.push({ x, t0, dur, h, w: Math.max(1.5 * D, Math.min(W, H) * 0.028 * (0.8 + 0.4 * P)), acc: 0, lit: false });
        if (lava) {
            for (let i = 0, n = 2 + Math.round(3 * P); i < n; i++) {
                const x = W * ((i + rnd(0.15, 0.85)) / n);
                addSpout(x, T0 + Math.abs(x - x0) / speed + rnd(0.15, 0.6), rnd(0.7, 1.0), G * rnd(0.3, 0.55) * (0.8 + 0.3 * P));
            }
        }
        let rays = [];
        let headAcc = 0;
        let plumeAcc = 0;
        const hitSet = new Set();

        const spikeUp = (sp) => {
            const m = sp.big ? 2 : 1;
            for (let i = 0; i < 2 + m; i++) {
                puff(sp.x + rnd(-0.5, 0.5) * sp.bw, G - 2 * D, D, pick(rock.slice(0, 3)), rnd(-40, 40) * m, -rnd(30, 100) * (H / 300), rnd(0.7, 1.1), 5, 0.55);
            }
            for (let i = 0; i < 2 + 3 * m; i++) {
                chunk(sp.x + rnd(-0.4, 0.4) * sp.bw, G - sp.h * rnd(0.2, 0.8), D, rnd(-1, 1) * H * 0.5, -rnd(0.5, 1.1) * Math.sqrt(2 * grav * sp.h * 0.8), grav, G, pick(rock), pick([1, 1, 2]), rock[0], false);
            }
            if (lava) {
                for (let i = 0; i < 2 * m; i++) {
                    chunk(sp.x, G - D, D, rnd(-1, 1) * H * 0.3, -rnd(0.4, 1) * H, grav, G, pick([LAVA[1], LAVA[2]]), 1, undefined, true);
                }
            }
            if (sp.big) {
                sigRing(sp.x, G, D, D * 2, sp.bw * 2.2, 0.2, 0.45, [glow[1], '#ffffff', glow[2]]);
                sigImpact(sp.x, G - D, D, [glow[0], glow[1], glow[2]], 1, true);
            }
        };
        const spikeBreak = (sp) => {
            const m = sp.big ? 2 : 1;
            for (let i = 0; i < 3 + 4 * m; i++) {
                chunk(sp.x + rnd(-0.4, 0.4) * sp.bw, G - sp.h * rnd(0.1, 0.9), D, rnd(-1, 1) * H * 0.6, -rnd(0.3, 1) * H * (sp.big ? 1.3 : 0.9), grav, G, pick(rock), pick([1, 2, 2, 3]), rock[0], Math.random() < 0.4);
            }
            for (let i = 0; i < 1 + 2 * m; i++) {
                puff(sp.x + rnd(-0.5, 0.5) * sp.bw, G - sp.h * rnd(0, 0.6), D, pick(rock.slice(0, 3)), rnd(-30, 30), -rnd(10, 40), rnd(0.6, 1.1), 5, 0.55);
            }
        };
        const update = (t, dt) => {
            const df = (t - T0) * speed;
            for (const sp of spikes) {
                if (!sp.on && t >= sp.t0) {
                    sp.on = true;
                    spikeUp(sp);
                }
                if (sp.on && !sp.off && t >= sp.tEnd) {
                    sp.off = true;
                    spikeBreak(sp);
                }
            }
            if (t >= T0 && df < W + 40) {
                // 달리는 틈 앞머리 — 먼지 · 튀는 빛
                headAcc += dt * 40;
                while (headAcc >= 1) {
                    headAcc -= 1;
                    for (const side of [-1, 1]) {
                        const hx = x0 + side * df;
                        if (hx > -10 && hx < W + 10) {
                            puff(hx, G - 2 * D, D, pick(rock.slice(0, 3)), side * rnd(10, 60), -rnd(40, 120) * (H / 300), rnd(0.7, 1.1), 6, 0.6);
                            chunk(hx, G - D, D, side * rnd(20, 90), -rnd(0.3, 0.8) * H, grav, G, pick(glow.slice(0, 3)), 1);
                        }
                    }
                }
                // 앞머리가 지나가면 튀어 오름 (가끔 벌러덩) + 그 자리 바위
                for (const q of others(u)) {
                    if (!hitSet.has(q.pokemon) && Math.abs(q.x - x0) <= df) {
                        hitSet.add(q.pokemon);
                        hit(q, Math.sign(q.x - x0) || u.dir, Math.random() < 0.35 ? 'tumble' : 'lift');
                        addSpike(q.x + rnd(-0.3, 0.3) * q.w, clamp(G * 0.32 * (0.8 + 0.3 * P), 6 * D, G * 0.55), t, tC + rnd(0, 0.1), false);
                    }
                }
            }
            for (const sp of spouts) {
                const age = t - sp.t0;
                if (age < 0 || age > sp.dur) {
                    continue;
                }
                if (!sp.lit) {
                    sp.lit = true;
                    sigRing(sp.x, G, D, D * 2, sp.w * 8, 0.25, 0.4, [LAVA[1], LAVA[2], LAVA[3]]);
                    shake(2 + P, 260);
                }
                sp.acc += dt * (spouts.length > 6 ? 35 : 55);
                while (sp.acc >= 1) {
                    sp.acc -= 1;
                    chunk(sp.x + rnd(-1, 1) * sp.w, G - sp.h * rnd(0.6, 1), D, rnd(-1, 1) * H * 0.3, -rnd(0.1, 0.5) * Math.sqrt(2 * grav * sp.h), grav, G, pick([LAVA[1], LAVA[2], LAVA[2], LAVA[3]]), pick([1, 1, 2]), LAVA[0], Math.random() < 0.3, 1.6);
                    if (Math.random() < 0.3) {
                        ember(sp.x + rnd(-2, 2) * sp.w, G - sp.h * rnd(0, 0.8), D, LAVA[1], LAVA[3], rnd(-30, 30), -rnd(60, 160), rnd(0.5, 0.9));
                    }
                }
            }
            // 크게 들썩일 때 — 틈에서 흙먼지 기둥
            if (!lava && t >= tC && t < tC + 0.6) {
                plumeAcc += dt * 70;
                while (plumeAcc >= 1) {
                    plumeAcc -= 1;
                    const r = pick(rays);
                    if (r) {
                        puff(r.x + rnd(-1, 1) * D, G - rnd(0, r.h * 0.6), D, pick(rock.slice(0, 3)), rnd(-20, 20), -rnd(60, 160), rnd(0.6, 1.0), 4, 0.55);
                    }
                }
            }
        };
        const drawCracks = (t, df, inten) => {
            const flick = Math.sin(t * 18) > 0;
            for (const cr of cracks) {
                const pts = cr.pts;
                for (let i = 1; i < pts.length; i++) {
                    const a = pts[i - 1];
                    const b = pts[i];
                    if (a[2] > df) {
                        break;
                    }
                    const k = b[2] > df ? (df - a[2]) / (b[2] - a[2]) : 1;
                    const xe = a[0] + (b[0] - a[0]) * k;
                    const ye = a[1] + (b[1] - a[1]) * k;
                    alpha(0.4 * inten);
                    line(a[0], a[1], xe, ye, glow[3], cr.w + 2);
                    alpha(inten);
                    line(a[0], a[1], xe, ye, flick && cr.w > 1 ? glow[1] : glow[2], cr.w);
                }
            }
        };
        const drawSpike = (sp, t) => {
            const age = t - sp.t0;
            if (age < 0) {
                return;
            }
            let a = 1;
            let sink = 0;
            if (t > sp.tEnd) {
                const k = (t - sp.tEnd) / 0.35;
                if (k >= 1) {
                    return;
                }
                a = 1 - k * k;
                sink = k * 0.55;
            }
            const grow = age < 0.09 ? easeOut(age / 0.09) * 1.1 : age < 0.17 ? 1.1 - 0.1 * ((age - 0.09) / 0.08) : 1;
            alpha(a);
            // 끝부터 땅을 뚫고 나옴 — 막 솟은 바위는 하얗게 달아올랐다 식음
            const rc = age < 0.08 ? HOT : age < 0.16 ? [glow[0], glow[1], rock[1], rock[2]] : rock;
            spikeShape(sp.x, G + D + sink * sp.h + sp.h * (1 - Math.min(1, grow)), sp.h * Math.max(1, grow), sp.bw, sp.lean, sp.seed, rc, G + D, lava ? (Math.sin(t * 20 + sp.seed) > 0 ? LAVA[1] : LAVA[2]) : null);
        };
        // 틈에서 새어 나오는 빛 줄기 — 앞쪽 풀에 가려도 보이게 위로
        const seams = [];
        for (const cr of cracks) {
            if (cr.w > 1) {
                for (const [x, y, d] of cr.pts) {
                    if (Math.random() < 0.45) {
                        seams.push({ x, y, d, h: rnd(5, 14) * D * (0.8 + 0.4 * P), ph: rnd(0, TAU) });
                    }
                }
            }
        }
        const drawSeams = (t, df, inten) => {
            for (const sm of seams) {
                if (sm.d > df) {
                    continue;
                }
                const fresh = Math.max(0, 1 - (df - sm.d) / (speed * 0.25)); // 막 갈라진 곳은 더 길게
                const hh = sm.h * (0.55 + 0.45 * Math.sin(t * 17 + sm.ph)) * (1 + 1.5 * fresh) * Math.min(1.6, inten);
                const a = (0.25 + 0.75 * Math.max(fresh, inten - 1)) * Math.min(1, inten);
                alpha(0.45 * a);
                fill(sm.x - Z, sm.y - hh * 0.7, sm.x + Z, sm.y, glow[2]);
                alpha(0.9 * a);
                fill(sm.x - Z / 2, sm.y - hh, sm.x + Z / 2, sm.y, glow[1]);
                dot(sm.x - Z / 2, sm.y - hh * 0.5, '#ffffff', 1, 2);
            }
        };
        const drawSpout = (sp, t) => {
            const age = t - sp.t0;
            if (age < 0 || age > sp.dur + 0.25) {
                return;
            }
            const out = age > sp.dur ? 1 - (age - sp.dur) / 0.25 : 1;
            const hh = sp.h * (age < 0.12 ? easeOut(age / 0.12) : out) * (0.85 + 0.15 * Math.sin(t * 30 + sp.x));
            const w = sp.w * out;
            for (let y = sn(G - hh), row = 0; y < G; y += Z, row++) {
                const f = (G - y) / hh;
                const ww = w * (0.6 + 0.4 * Math.sin(row * 0.9 + t * 25)) * (1 + (1 - f) ** 4 * 0.8);
                alpha(1);
                fill(sp.x - ww, y, sp.x + ww, y + Z, LAVA[3]);
                fill(sp.x - ww * 0.55, y, sp.x + ww * 0.55, y + Z, f > 0.85 ? LAVA[2] : LAVA[1]);
            }
            alpha(0.9);
            disc(sp.x, G, w * 3, Z * 1.5, LAVA[3]);
            disc(sp.x, G, w * 1.8, Z, LAVA[2]);
        };
        const draw = (t) => {
            const df = Math.max(0, (t - T0) * speed);
            const end = t > sec - 0.6 ? Math.max(0, (sec - t) / 0.6) : 1;
            const boost = t > tC && t < tC + 0.5 ? 2 - (t - tC) / 0.5 : 1;
            if (lava && t >= T0) {
                // 열기 — 땅 위 계단 띠
                const xa = Math.max(0, x0 - df);
                const xb = Math.min(W, x0 + df);
                for (let i = 0; i < 3; i++) {
                    alpha((0.13 - i * 0.04) * end * (0.8 + 0.2 * Math.sin(t * 9 + i)) * boost);
                    fill(xa, G - (i + 1) * 4 * Z, xb, G - i * 4 * Z, LAVA[3]);
                }
            }
            if (t >= T0) {
                const xa = Math.max(0, x0 - df);
                const xb = Math.min(W, x0 + df);
                const fl = (0.85 + 0.15 * Math.sin(t * 23)) * end * boost;
                alpha(0.5 * fl);
                fill(xa, G - Z, xb, G + Z, glow[2]);
                alpha(0.25 * fl);
                fill(xa, G - 3 * Z, xb, G - Z, glow[2]);
                alpha(0.1 * fl);
                fill(xa, G - 6 * Z, xb, G - 3 * Z, glow[3]);
                drawCracks(t, df, end * boost);
            }
            for (const sp of spouts) {
                drawSpout(sp, t);
            }
            for (const sp of spikes) {
                drawSpike(sp, t);
            }
            if (t >= T0) {
                drawSeams(t, df, end * boost);
            }
            // 틈 앞머리 — 빛 기둥이 하얗게 달려감
            if (t >= T0 && df < W + 20) {
                const fh = Math.max(8 * D, H * 0.16) * (0.85 + 0.15 * Math.sin(t * 40));
                for (const side of [-1, 1]) {
                    const hx = x0 + side * df;
                    alpha(0.45);
                    fill(hx - 2 * Z, G - fh * 0.6, hx + 2 * Z, G + Z, glow[2]);
                    alpha(0.9);
                    fill(hx - Z, G - fh, hx + Z, G + Z, glow[1]);
                    alpha(1);
                    fill(hx - Z / 2, G - fh * 0.8, hx + Z / 2, G + Z, '#ffffff');
                    dot(hx - 2 * Z, cy - Z, glow[1], 4, 3);
                }
            }
            // 크게 들썩 — 틈에서 빛살
            const rk = (t - tC) / 0.45;
            if (rk > 0 && rk < 1) {
                for (const r of rays) {
                    const hh = r.h * easeOut(rk * 3);
                    alpha(0.5 * (1 - rk));
                    fill(r.x - (r.w + 1) * Z, G - hh * 0.8, r.x + (r.w + 1) * Z, G, glow[2]);
                    alpha(1 - rk);
                    fill(r.x - r.w * Z, G - hh, r.x + r.w * Z, G, glow[1]);
                    fill(r.x - Z / 2, G - hh * 0.95, r.x + Z / 2, G, '#ffffff');
                }
            }
        };
        scene(sec, D, {
            events: [
                [0, () => {
                    // 폴짝 → 쿵 (쓰는 애)
                    try {
                        const hop = Math.max(6, u.h * 0.45);
                        pokemon?.el?.animate([{ translate: '0 0', easing: 'ease-out' }, { translate: `0 -${hop}px`, offset: 0.55, easing: 'ease-in' }, { translate: '0 0' }], { duration: T0 * 1000 - 20, composite: 'add' });
                    } catch (err) {
                        // 그림 움직임 실패는 넘어감
                    }
                    for (let i = 0; i < 26; i++) {
                        const a = rnd(0, TAU);
                        const r = u.R * rnd(1.2, 2.2);
                        mote(x0 + Math.cos(a) * r, G - Math.abs(Math.sin(a)) * r * 0.8, x0, G - D, D, pick(glow.slice(0, 3)), rnd(0.22, T0), pick([1, 2]));
                    }
                    sigRing(x0, G, D, u.R * 1.6, u.R * 0.3, 0.25, T0, [glow[1], glow[2]]);
                }],
                [T0, () => {
                    screenFlash(D, 0.5, glow[1], 0.3);
                    shake(6 + 3 * P, 700);
                    sigImpact(x0, G - D, D, [glow[0], glow[1], glow[2]], 1, true);
                    sigRing(x0, G, D, D * 2, W * 0.55, 0.12, 0.55, [glow[1], '#ffffff', glow[2]]);
                    sigRing(x0, G, D, D * 2, W * 0.3, 0.2, 0.4, [rock[0], rock[1]]);
                    for (let i = 0; i < 22; i++) {
                        const side = i % 2 ? 1 : -1;
                        puff(x0 + rnd(-1, 1) * u.R * 0.5, G - 2 * D, D, pick(rock.slice(0, 3)), side * rnd(40, 200) * (W / 480), -rnd(20, 100) * (H / 300), rnd(0.8, 1.3), 7, 0.6);
                    }
                    for (let i = 0; i < 12; i++) {
                        chunk(x0, G - D, D, rnd(-1, 1) * H * 0.7, -rnd(0.6, 1.0) * H * 1.4, grav, G, pick(rock), pick([1, 2, 2]), rock[0], true);
                    }
                }],
                [T0 + 0.6, () => shake(3 + 2 * P, 1300)],
                // 하늘로 튀었던 바위가 우수수
                ...Array.from({ length: 8 + Math.round(6 * P) }, () => [rnd(1.0, 1.75), () => {
                    chunk(rnd(0, W), -rnd(5, 40), D, rnd(-30, 30), rnd(0, 0.3) * H, grav, G, pick(rock), pick([2, 3, 3]), rock[0], true, 2.5);
                }]),
                [tC, () => {
                    screenFlash(D, 0.6, lava ? LAVA[1] : '#ffffff', 0.4);
                    shake(7 + 3 * P, 850);
                    sigRing(x0, G, D, D * 2, W * 0.9, 0.1, 0.7, [glow[0], glow[1], '#ffffff']);
                    for (const q of others(u)) {
                        hit(q, Math.sign(q.x - x0) || u.dir, Math.random() < 0.5 ? 'lift' : 'spin');
                    }
                    rays = [];
                    for (let i = 0, n = 7 + Math.round(5 * P); i < n; i++) {
                        rays.push({ x: rnd(0, W), h: G * rnd(0.3, 0.75), w: pick([1, 1, 2]) });
                    }
                    if (lava) {
                        for (const x of giants.filter(() => Math.random() < 0.7)) {
                            addSpout(x + rnd(-1, 1) * 4 * D, tC + rnd(0, 0.15), rnd(0.9, 1.2), G * rnd(0.5, 0.75));
                        }
                    }
                    for (let i = 0; i < 30; i++) {
                        puff(rnd(0, W), G - rnd(0, 3) * D, D, pick(rock.slice(0, 3)), rnd(-60, 60), -rnd(20, 90), rnd(0.8, 1.4), 6, 0.5);
                    }
                }],
                [tC + 0.7, () => shake(3 + P, 900)],
            ],
            update,
            draw,
        });
    }

    // ═════ ultpillar — 앞으로 차례차례 거대 기둥 (예고 빛 · 우르릉 → 솟음 → 무너짐) ═════
    const PILLAR_KINDS = ['fire', 'rock', 'ice', 'water', 'light', 'vine', 'shadow'];
    const PILLAR_C = { fire: 'fire', rock: 'rock', ice: 'ice', water: 'water', light: 'star', vine: 'grass', shadow: 'ghost' };
    const KIND_OF_C = { fire: 'fire', water: 'water', ice: 'ice', grass: 'vine', solar: 'light', star: 'light', gold: 'light', moon: 'light', heal: 'light', aura: 'light', ghost: 'shadow', dark: 'shadow', rock: 'rock', ground: 'rock', steel: 'rock', bone: 'rock' };
    const PILLAR_HIT = { fire: 'lift', rock: 'lift', ice: 'lift', water: 'spin', light: 'lift', vine: 'spin', shadow: 'lift' };
    const PILLAR_RATE = { fire: 55, rock: 10, ice: 14, water: 70, light: 30, vine: 16, shadow: 34 };
    const pillarN = (o) => clamp(Math.round(Number(o.n) || 5), 1, 9);
    const pillarPlan = (P, n) => {
        const p = { gap: n > 1 ? clamp(1.45 / (n - 1), 0.2, 0.42) : 0, warn: 0.36, rise: 0.13, hold: 0.75 + 0.2 * P, finale: 0.35, fall: 0.45 };
        p.sec = 0.08 + (n - 1) * p.gap + p.warn + p.rise + p.hold + p.finale + p.fall + 0.15;
        return p;
    };
    function pillarRun(u, o, ms) {
        const P = power(u.P);
        const D = dotSize(u);
        const H = u.H;
        const G = u.ground;
        const sec = ms / 1000;
        const n = pillarN(o);
        const kind = PILLAR_KINDS.includes(o.kind) ? o.kind : KIND_OF_C[o.c] || 'rock';
        const cols = sigPal(o.c || PILLAR_C[kind]);
        const plan = pillarPlan(P, n);
        const grav = H * 2.4;
        const f = field(u);
        const a0 = Math.min(u.R * 0.4, f.room * 0.08);
        const step = (f.room - a0) / n;
        const pillars = [];
        for (let i = 0; i < n; i++) {
            const last = i === n - 1;
            const g = n > 1 ? i / (n - 1) : 1;
            const w = clamp(step * 0.8, 5 * D, Math.max(7 * D, H * 0.26)) * (0.85 + 0.25 * g) * (last ? 1.2 : 1) * (0.85 + 0.25 * P);
            const h = kind === 'light' ? G + 4 * D : Math.min(G - 2 * D, H * (0.6 + 0.3 * P) * (0.9 + 0.1 * g) * (last ? 1.05 : 1));
            const tw = 0.08 + i * plan.gap;
            const te = tw + plan.warn;
            const tf = te + plan.rise + plan.hold + (last ? plan.finale : 0);
            pillars.push({ i, x: f.front + f.dir * (a0 + step * (i + 0.5)), w, h, tw, te, tf, tg: tf + plan.fall, last, seed: rnd(0, 1000), lean: rnd(-0.06, 0.06), acc: 0, pacc: 0 });
        }
        // 지금 상태 — g: 솟음(1.07 까지 넘쳤다 1), k: 무너짐 0~1
        const stateOf = (pl, t) => {
            const age = t - pl.te;
            if (age < 0 || t >= pl.tg) {
                return null;
            }
            const r = age / plan.rise;
            const g = r < 1 ? easeOut(r) * 1.07 : r < 1.6 ? 1.07 - 0.07 * ((r - 1) / 0.6) : 1;
            return { age, g, k: t > pl.tf ? k01((t - pl.tf) / plan.fall) : 0 };
        };

        // ── 모양마다 그리기 ──
        const crystal = (x, yb, h, w, lean, a, white) => {
            for (let y = sn(yb - h), row = 0; y < Math.min(G + D, yb); y += Z, row++) {
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
        };
        const DRAWERS = {
            fire: (pl, t, s) => {
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
            rock: (pl, t, s) => {
                const e = Math.min(1, s.g);
                const yb = G + D + pl.h * (1 - e) + s.k * pl.h * 0.75; // 끝부터 솟아나옴 · 무너지며 가라앉음
                const hh = pl.h * Math.max(1, s.g);
                alpha(1 - s.k * s.k);
                spikeShape(pl.x - pl.w * 0.42, yb + pl.h * 0.05, hh * 0.42, pl.w * 0.55, -0.35, pl.seed + 5, cols, G + D);
                spikeShape(pl.x + pl.w * 0.45, yb + pl.h * 0.03, hh * 0.34, pl.w * 0.5, 0.4, pl.seed + 9, cols, G + D);
                spikeShape(pl.x, yb, hh, pl.w * 1.2, pl.lean, pl.seed, cols, G + D);
            },
            ice: (pl, t, s) => {
                if (s.k > 0.25) {
                    return; // 산산조각 — 조각은 입자로
                }
                const e = Math.min(1, s.g);
                const over = Math.max(1, s.g);
                const yb = G + D + pl.h * (1 - e);
                const a = s.k > 0 ? 1 - s.k / 0.25 : 1;
                const white = s.k > 0;
                crystal(pl.x - pl.w * 0.34, yb, pl.h * 0.5 * over, pl.w * 0.34, -0.4, a, white);
                crystal(pl.x + pl.w * 0.38, yb, pl.h * 0.42 * over, pl.w * 0.3, 0.36, a, white);
                crystal(pl.x + pl.w * 0.12, yb, pl.h * 0.28 * over, pl.w * 0.24, 0.12, a, white);
                crystal(pl.x, yb, pl.h * over, pl.w * 0.48, 0.02, a, white);
                // 반짝 — 큰 결정 가장자리를 타고 오름
                const gy = yb - ((t * 1.6 + pl.seed) % 1) * pl.h * 0.8;
                alpha(a);
                dot(pl.x - pl.w * 0.24 + (yb - gy) * 0.02, gy, '#ffffff', 1, 3);
                dot(pl.x - pl.w * 0.24 + (yb - gy) * 0.02 - Z, gy + Z, '#ffffff', 3, 1);
            },
            water: (pl, t, s) => {
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
            light: (pl, t, s) => {
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
            vine: (pl, t, s) => {
                const e = Math.min(1, s.g);
                const h = pl.h * Math.max(1, s.g);
                const yb = G + D + h * (1 - e) + s.k * h; // 솟아나옴 · 끝엔 땅속으로
                const top = yb - h;
                const tk = Math.max(1, (pl.w * 0.16) / Z);
                const strands = 3;
                for (let pass = 0; pass < 2; pass++) {
                    for (let y = sn(Math.max(top, -Z)), row = 0; y < Math.min(G + D, yb); y += Z, row++) {
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
            shadow: (pl, t, s) => {
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

        // ── 모양마다 입자 ──
        const emitOne = (pl, top) => {
            const x = pl.x + rnd(-0.5, 0.5) * pl.w;
            switch (kind) {
                case 'fire':
                    if (Math.random() < 0.2) {
                        puff(pl.x + rnd(-0.3, 0.3) * pl.w, top + rnd(0, 0.1) * pl.h, D, pick(['#5a5a5a', '#7a7a7a', '#3e3e3e']), rnd(-15, 15), -rnd(30, 70), rnd(0.8, 1.3), 4, 0.45);
                    } else {
                        ember(x, rnd(top, G), D, pick(cols.slice(0, 2)), cols[2], rnd(-30, 30), -rnd(80, 200) * (H / 300), rnd(0.5, 1.0));
                    }
                    break;
                case 'rock':
                    puff(x, G - D, D, pick(cols.slice(0, 3)), rnd(-40, 40), -rnd(5, 30), rnd(0.6, 1), 4, 0.45);
                    if (Math.random() < 0.5) {
                        chunk(x, rnd(top, G), D, rnd(-40, 40), -rnd(0, 60), grav, G, pick(cols), 1);
                    }
                    break;
                case 'ice':
                    sparkle(pl.x + rnd(-0.4, 0.4) * pl.w, rnd(top, G), D, ['#ffffff', cols[1], cols[2]], 0, -rnd(10, 40), rnd(0.4, 0.8));
                    break;
                case 'water':
                    chunk(pl.x + rnd(-0.6, 0.6) * pl.w, top + rnd(-1, 1) * D, D, rnd(-1, 1) * pl.w * 3, -rnd(0, 0.45) * H, grav, G, pick(['#ffffff', cols[1], cols[1], cols[2]]), pick([1, 1, 2]), undefined, Math.random() < 0.15, 1.6);
                    break;
                case 'light':
                    sparkle(pl.x + rnd(-0.9, 0.9) * pl.w, rnd(top, G), D, cols, rnd(-10, 10), -rnd(40, 120), rnd(0.4, 0.8));
                    break;
                case 'vine':
                    flutter(x, rnd(top, G), D, pick([cols[1], cols[2], cols[0]]), rnd(-1, 1) * 80, -rnd(10, 60), rnd(0.9, 1.4), { g: 40, sway: 50 });
                    break;
                case 'shadow':
                    float(x, rnd(top, G), D, pick([cols[1], cols[2], cols[0]]), rnd(-10, 10), -rnd(30, 90), rnd(0.6, 1.1), pick([1, 1, 2]));
                    break;
            }
        };
        const burst = (pl, big) => {
            const m = big ? 2 : 1;
            for (let i = 0; i < 6 * m; i++) {
                chunk(pl.x + rnd(-0.5, 0.5) * pl.w, G - D, D, rnd(-1, 1) * H * 0.5, -rnd(0.5, 1.1) * H * 1.1, grav, G, pick(DIRT), pick([1, 2]), DIRT[0], true);
            }
            switch (kind) {
                case 'fire':
                    for (let i = 0; i < 24 * m; i++) {
                        ember(pl.x + rnd(-0.5, 0.5) * pl.w, G - rnd(0, 0.5) * pl.h, D, pick(cols.slice(0, 3)), cols[3], rnd(-1, 1) * H * 0.5, -rnd(0.3, 1) * H * 1.2, rnd(0.5, 1.1));
                    }
                    break;
                case 'rock':
                    for (let i = 0; i < 10 * m; i++) {
                        chunk(pl.x + rnd(-0.4, 0.4) * pl.w, G - rnd(0.1, 0.7) * pl.h, D, rnd(-1, 1) * H * 0.6, -rnd(0.4, 1) * H * 1.2, grav, G, pick(cols), pick([1, 2, 2, 3]), cols[0], true);
                    }
                    for (let i = 0; i < 5 * m; i++) {
                        puff(pl.x + rnd(-0.6, 0.6) * pl.w, G - D, D, pick(cols.slice(0, 3)), rnd(-80, 80), -rnd(10, 50), rnd(0.7, 1.1), 5, 0.6);
                    }
                    break;
                case 'ice':
                    for (let i = 0; i < 14 * m; i++) {
                        chunk(pl.x + rnd(-0.4, 0.4) * pl.w, G - rnd(0.1, 0.8) * pl.h, D, rnd(-1, 1) * H * 0.6, -rnd(0.3, 1) * H, grav, G, pick(['#ffffff', cols[0], cols[1]]), 1, undefined, false, 1.2);
                    }
                    break;
                case 'water':
                    for (let i = 0; i < 26 * m; i++) {
                        chunk(pl.x + rnd(-0.5, 0.5) * pl.w, G - rnd(0, 1) * pl.h, D, rnd(-1, 1) * H * 0.7, -rnd(0.3, 1.1) * H * 1.1, grav, G, pick(['#ffffff', cols[1], cols[2]]), pick([1, 1, 2]), undefined, false, 1.6);
                    }
                    break;
                case 'light':
                    for (let i = 0; i < 18 * m; i++) {
                        sparkle(pl.x + rnd(-0.8, 0.8) * pl.w, G - rnd(0, 1) * Math.min(pl.h, G), D, cols, rnd(-1, 1) * 60, -rnd(30, 140), rnd(0.4, 0.9));
                    }
                    break;
                case 'vine':
                    for (let i = 0; i < 14 * m; i++) {
                        flutter(pl.x + rnd(-0.5, 0.5) * pl.w, G - rnd(0, 0.8) * pl.h, D, pick([cols[1], cols[2], cols[0]]), rnd(-1, 1) * 160, -rnd(60, 200), rnd(0.9, 1.5), { g: 90, sway: 40 });
                    }
                    break;
                case 'shadow':
                    for (let i = 0; i < 20 * m; i++) {
                        const a = rnd(0, TAU);
                        float(pl.x, G - rnd(0, 0.6) * pl.h, D, pick([cols[0], cols[1], cols[2]]), Math.cos(a) * rnd(40, 140), Math.sin(a) * rnd(40, 140) - 40, rnd(0.6, 1.1), pick([1, 2]));
                    }
                    break;
            }
        };
        const crumble = (pl) => {
            const top = G - pl.h;
            switch (kind) {
                case 'fire':
                    for (let i = 0; i < 10; i++) {
                        puff(pl.x + rnd(-0.4, 0.4) * pl.w, top + rnd(0, 0.4) * pl.h, D, pick(['#5a5a5a', '#7a7a7a', '#3e3e3e']), rnd(-30, 30), -rnd(20, 60), rnd(0.9, 1.4), 6, 0.5);
                    }
                    for (let i = 0; i < 10; i++) {
                        ember(pl.x + rnd(-0.5, 0.5) * pl.w, rnd(top, G), D, cols[1], cols[3], rnd(-60, 60), -rnd(40, 140), rnd(0.5, 0.9));
                    }
                    break;
                case 'rock':
                    for (let i = 0; i < 16; i++) {
                        chunk(pl.x + rnd(-0.4, 0.4) * pl.w, G - rnd(0.05, 0.95) * pl.h, D, rnd(-1, 1) * H * 0.4, -rnd(0, 0.6) * H, grav, G, pick(cols), pick([1, 2, 2, 3]), cols[0], true);
                    }
                    for (let i = 0; i < 6; i++) {
                        puff(pl.x + rnd(-0.5, 0.5) * pl.w, G - rnd(0, 0.5) * pl.h, D, pick(cols.slice(0, 3)), rnd(-40, 40), -rnd(10, 40), rnd(0.7, 1.2), 6, 0.55);
                    }
                    shake(2, 260);
                    break;
                case 'ice':
                    screenFlash(D, 0.15, '#ffffff', 0.15);
                    sigBurst(pl.x, G - pl.h * 0.5, D, ['#ffffff', cols[0], cols[1]], 10, 90);
                    for (let i = 0; i < 30; i++) {
                        chunk(pl.x + rnd(-0.5, 0.5) * pl.w, G - rnd(0, 1) * pl.h, D, rnd(-1, 1) * H * 0.8, -rnd(0.1, 0.9) * H * 1.1, grav, G, pick(['#ffffff', cols[0], cols[1], cols[2]]), pick([1, 1, 2]), undefined, true, 1.4);
                    }
                    for (let i = 0; i < 8; i++) {
                        sparkle(pl.x + rnd(-0.6, 0.6) * pl.w, G - rnd(0, 1) * pl.h, D, ['#ffffff', cols[1], cols[2]], 0, -rnd(10, 40), rnd(0.4, 0.8));
                    }
                    break;
                case 'water':
                    for (let i = 0; i < 24; i++) {
                        chunk(pl.x + rnd(-0.8, 0.8) * pl.w, top + rnd(0, 0.3) * pl.h, D, rnd(-1, 1) * pl.w * 2.5, -rnd(0, 0.3) * H, grav, G, pick(['#ffffff', cols[1], cols[2]]), pick([1, 2]), undefined, true, 1.6);
                    }
                    sigRing(pl.x, G, D, D * 2, pl.w * 1.8, 0.2, 0.5, ['#ffffff', cols[1]]);
                    break;
                case 'light':
                    for (let i = 0; i < 14; i++) {
                        sparkle(pl.x + rnd(-0.4, 0.4) * pl.w, G - rnd(0, 1) * Math.min(pl.h, G), D, cols, rnd(-20, 20), -rnd(60, 160), rnd(0.4, 0.8));
                    }
                    break;
                case 'vine':
                    for (let i = 0; i < 10; i++) {
                        flutter(pl.x + rnd(-0.5, 0.5) * pl.w, G - rnd(0, 1) * pl.h, D, pick([cols[1], cols[2], cols[0]]), rnd(-1, 1) * 70, -rnd(10, 60), rnd(0.9, 1.4), { g: 50, sway: 40 });
                    }
                    break;
                case 'shadow':
                    for (let i = 0; i < 18; i++) {
                        float(pl.x + rnd(-0.5, 0.5) * pl.w, G - rnd(0, 1) * pl.h, D, pick([cols[0], cols[1], cols[2]]), rnd(-30, 30), -rnd(30, 100), rnd(0.6, 1.1), pick([1, 2]));
                    }
                    break;
            }
        };
        const erupt = (pl) => {
            const big = pl.last;
            screenFlash(D, big ? 0.5 : 0.22, cols[0], big ? 0.35 : 0.2);
            shake(big ? 6 + 3 * P : 3 + 1.5 * P, big ? 800 : 380);
            sigRing(pl.x, G, D, D * 2, pl.w * (big ? 3.2 : 2), 0.2, 0.45, [cols[0], '#ffffff', cols[2]]);
            if (big) {
                sigRing(pl.x, G, D, D * 2, pl.w * 4.5, 0.15, 0.65, [cols[1], cols[3]]);
                sigImpact(pl.x, G - 2 * D, D, [cols[0], '#ffffff', cols[1]], 1, true);
            }
            burst(pl, big);
            // 기둥 위는 뜨고, 바로 옆은 밀려 넘어짐
            for (const q of others(u)) {
                const dx = Math.abs(q.x - pl.x);
                const away = Math.sign(q.x - pl.x) || f.dir;
                if (dx <= pl.w * 0.55 + q.w * 0.3) {
                    hit(q, away, PILLAR_HIT[kind]);
                } else if (dx <= pl.w * 1.4 + q.w * 0.5) {
                    hit(q, away, 'tumble');
                }
            }
        };
        // 예고 — 땅이 빛나며 고리 · 미리 비치는 기둥 · 땅 금
        const drawWarn = (pl, t) => {
            const k = (t - pl.tw) / plan.warn;
            if (k < 0 || t > pl.te + 0.25) {
                return;
            }
            const a = k > 1 ? 1 - (t - pl.te) / 0.25 : 0.4 + 0.6 * k;
            const pulse = 0.55 + 0.45 * Math.sin(t * 34);
            const rx = pl.w * (0.5 + 0.4 * Math.min(1, k));
            alpha(0.35 * a);
            disc(pl.x, G, rx, Math.max(Z, rx * 0.16), cols[2]);
            alpha(a * pulse);
            ring(pl.x, G, rx * 1.15, Math.max(2 * Z, rx * 0.2), 22, t * 3, cols[0], cols[1]);
            // 오르는 기운 — 기둥 자리 양쪽에서 점선이 위로
            alpha(0.8 * a);
            for (const side of [-1, 1]) {
                for (let j = 0; j < 5; j++) {
                    const yy = G - ((t * 2.4 + j / 5 + (side > 0 ? 0.1 : 0)) % 1) * Math.min(pl.h, G) * 0.5 * Math.min(1, k);
                    dot(pl.x + side * pl.w * 0.32, yy, j % 2 ? cols[0] : cols[1], 1, 2);
                }
            }
            alpha(a);
            for (let j = 0; j < 4; j++) {
                const ang = Math.PI + (j / 3) * Math.PI + (hash(pl.seed + j) - 0.5) * 0.5;
                const len = pl.w * (0.4 + 0.5 * Math.min(1, k)) * (0.6 + 0.4 * hash(pl.seed * 2 + j));
                const mx = pl.x + Math.cos(ang) * len * 0.5;
                const my = G + Math.sin(ang) * len * 0.08;
                line(pl.x, G, mx + (hash(j + pl.seed) - 0.5) * 2 * Z, my, cols[0], 1);
                line(mx, my, pl.x + Math.cos(ang) * len, G + Math.sin(ang) * len * 0.15, cols[1], 1);
            }
        };
        const drawFrost = (pl, t) => {
            const age = t - pl.te;
            if (age < 0 || t > pl.tg + 0.5) {
                return;
            }
            const spread = Math.min(1, age / 0.4) * pl.w * 1.4;
            const a = t > pl.tg ? 1 - (t - pl.tg) / 0.5 : 1;
            for (let xx = -spread, j = 0; xx <= spread; xx += Z, j++) {
                const hv = hash(pl.seed + j * 0.37);
                if (hv < 0.55) {
                    alpha(a * (1 - Math.abs(xx) / (spread + Z)));
                    dot(pl.x + xx, G - (hv < 0.15 ? 2 : 1) * Z, hv < 0.3 ? '#ffffff' : cols[1]);
                }
            }
        };
        // 쓰는 애에게서 기둥까지 달려가는 땅 금
        const fissSeed = rnd(0, 100);
        const drawFissure = (t, end) => {
            let to = null;
            for (const pl of pillars) {
                if (t >= pl.tw) {
                    const prev = pl.i ? pillars[pl.i - 1].x : f.front;
                    to = lerp(prev, pl.x, k01((t - pl.tw) / 0.15));
                }
            }
            if (to === null) {
                return;
            }
            const len = Math.abs(to - f.front);
            for (let d = 0, j = 0; d < len; d += 2 * Z, j++) {
                const x = f.front + f.dir * d;
                const y = G + Math.round((hash(fissSeed + j * 0.71) - 0.5) * 2.4) * Z;
                alpha(0.45 * end);
                dot(x - Z, y - Z, cols[2], 3, 3);
                alpha(end);
                dot(x, y, j % 2 ? cols[0] : cols[1], 2, 1);
            }
        };
        const update = (t, dt) => {
            for (const pl of pillars) {
                if (t >= pl.tw && !pl.warned) {
                    pl.warned = true;
                    shake(1.5 + P, 320);
                }
                if (t >= pl.tw && t < pl.te) {
                    pl.pacc += dt * 22;
                    while (pl.pacc >= 1) {
                        pl.pacc -= 1;
                        chunk(pl.x + rnd(-0.6, 0.6) * pl.w, G - D, D, rnd(-30, 30), -rnd(0.15, 0.4) * H, grav, G, pick(DIRT), 1);
                    }
                }
                if (t >= pl.te && !pl.up) {
                    pl.up = true;
                    erupt(pl);
                }
                if (pl.up && !pl.down && t >= pl.tf) {
                    pl.down = true;
                    crumble(pl);
                }
                if (pl.up && !pl.down) {
                    pl.acc += dt * PILLAR_RATE[kind];
                    while (pl.acc >= 1) {
                        pl.acc -= 1;
                        emitOne(pl, G - Math.min(pl.h, G) * 0.95);
                    }
                }
            }
        };
        const draw = (t) => {
            const end = t > sec - 0.3 ? Math.max(0, (sec - t) / 0.3) : 1;
            drawFissure(t, end);
            for (const pl of pillars) {
                drawWarn(pl, t);
            }
            if (kind === 'ice') {
                for (const pl of pillars) {
                    drawFrost(pl, t);
                }
            }
            for (const pl of pillars) {
                const s = stateOf(pl, t);
                if (s) {
                    DRAWERS[kind](pl, t, s);
                }
            }
        };
        scene(sec, D, { update, draw });
    }

    // ═════ ultbloom bloom — 꽃밭이 확 피고 거대 꽃이 빛을 모아 피어나면 하늘에서 빛기둥 · 꽃잎 폭풍 ═════
    const PETALS = [['#ffe6f2', '#ff7ab8'], ['#ffffff', '#dcdcc8'], ['#fff8b0', '#ffd23f'], ['#ffd0d8', '#e0405a'], ['#f0e0ff', '#a070ff'], ['#e0f4ff', '#6cc3ff']];
    const STEM = ['#a8f070', '#4cae3c', '#2f7d32'];
    const GLYPH = { s: ['.l.', 'lcl', '.l.'], m: ['.l.l.', 'lpppl', '.pcp.', 'lpppl', '.l.l.'], t: ['p.p', 'ppp', 'lpp', '.p.'] };
    function bloomRun(u, o, ms) {
        const P = power(u.P);
        const D = dotSize(u);
        const W = u.W;
        const H = u.H;
        const G = u.ground;
        const sec = ms / 1000;
        const own = o.c && o.c !== 'grass' ? sigPal(o.c) : null;
        const petals = own ? [[own[0], own[2]], [own[1], own[3]], ['#ffffff', own[1]], [own[0], own[1]]] : PETALS;
        const beamCols = own || sigPal('solar');
        const flowerC = own ? [own[0], own[2], own[3]] : ['#ffe6f2', '#ff7ab8', '#e0508f'];
        const f = field(u);
        const xa = f.front;
        const span = f.room;
        const floorRoom = Math.max(0, H - G);
        // 꽃 — 쓰는 애에서 멀어질수록 늦게 핌
        const flowers = [];
        const addFlower = (x, t0, front) => {
            const pc = pick(petals);
            flowers.push({ x, y: G + (front ? 2 * D : 0), t0, hs: Math.max(3, Math.round(rnd(4, 11) * (front ? 0.8 : 1))), type: pick(['s', 'm', 'm', 't']), big: Math.random() < 0.22 ? 2 : 1, lc: pc[0], pc: pc[1], ph: rnd(0, TAU), pop: false });
        };
        const nF = Math.round(clamp(span / (2.6 * D), 14, 110) * (0.75 + 0.25 * P));
        for (let i = 0; i < nF; i++) {
            const k = (i + rnd(0.1, 0.9)) / nF;
            addFlower(xa + f.dir * span * k, 0.05 + k * 0.75 + rnd(0, 0.12), floorRoom > 3 * D && Math.random() < 0.4);
        }
        const roomB = f.dir > 0 ? u.body.cx - u.body.rx : W - u.body.cx - u.body.rx;
        for (let i = 0, nB = Math.round(nF * 0.3 * Math.min(1, roomB / Math.max(1, span))); i < nB; i++) {
            const k = rnd(0, 1);
            addFlower(u.body.cx - f.dir * (u.body.rx + roomB * k), 0.3 + k * 0.6, false);
        }
        const tufts = [];
        for (let i = 0, m = Math.round(nF * 0.8); i < m; i++) {
            const k = rnd(0, 1);
            tufts.push({ x: xa + f.dir * span * k, t0: k * 0.7, h: Math.round(rnd(2, 4)) });
        }
        // 거대 꽃
        const cxF = xa + f.dir * span * 0.5;
        const hF = clamp(G * 0.42, 6 * D, G * 0.6);
        const yF = G - hF;
        const rb = clamp(Math.min(W, H) * 0.11, 6 * D, 64) * (0.8 + 0.3 * P);
        const tStem = 0.85;
        const tOpen = 1.85;
        const tB = tOpen + 0.3;
        const tLand = tB + 0.12;
        const tE = tLand + 1.0;
        const bw = Math.max(clamp(span * 0.5, 10 * D, W * 0.45) * (0.8 + 0.3 * P), rb * 3);
        let petAcc = 0;
        let frontAcc = 0;
        let moteAcc = 0;
        let stormAcc = 0;
        let stormUntil = 0;
        const fronts = []; // 장면 앞에 그리는 꽃잎
        const petal = (x, y, vx, vy, max, pc, size) => {
            if (fronts.length < 420) {
                fronts.push({ x, y, vx, vy, life: 0, max, c: pc[1], hi: pc[0], size, ph: rnd(0, TAU), w: rnd(5, 9) });
            }
        };
        const stormOne = () => {
            petal(xa + f.dir * span * rnd(0, 1), G - rnd(0.05, 0.3) * G, f.dir * rnd(40, 220) * (W / 480) + rnd(-30, 30), -rnd(80, 260) * (H / 300), rnd(1.0, 1.8), pick(petals), Math.random() < 0.6 ? 2 : 1);
        };
        const frontGrav = 70 * (H / 300);
        const moveFronts = (dt) => {
            const keep = Math.exp(-0.9 * dt);
            for (let i = fronts.length - 1; i >= 0; i--) {
                const q = fronts[i];
                q.life += dt;
                if (q.life >= q.max) {
                    fronts.splice(i, 1);
                    continue;
                }
                q.vx *= keep;
                q.vy = q.vy * keep + frontGrav * dt;
                q.x += q.vx * dt + Math.sin(q.ph + q.life * q.w) * 60 * dt;
                q.y += q.vy * dt;
            }
        };
        const drawFronts = () => {
            for (const q of fronts) {
                const flat = Math.floor(q.life / 0.09 + q.ph) % 2 === 0;
                alpha(fadeInOut(q.life / q.max, 0.06, 0.3));
                dot(q.x, q.y, q.c, flat ? 2 * q.size : q.size, flat ? q.size : 2 * q.size);
                dot(q.x, q.y, q.hi, q.size, q.size);
            }
        };
        const beat = () => {
            sigRing(cxF, yF, D, rb * 3, rb * 0.6, 1, 0.3, [beamCols[0], flowerC[0]]);
            sigBurst(cxF, yF, D, [beamCols[0], flowerC[0]], 8, 50);
        };
        const update = (t, dt) => {
            for (const fl of flowers) {
                if (!fl.pop && t >= fl.t0 + 0.42) {
                    fl.pop = true;
                    if (Math.random() < 0.3) {
                        sigBurst(fl.x, fl.y - (fl.hs + 2) * D, D, [fl.lc, '#ffffff'], 3, 25);
                    }
                }
            }
            // 피어 나가는 앞머리에서 반짝
            const fk = (t - 0.05) / 0.75;
            if (fk > 0 && fk < 1) {
                frontAcc += dt * 45;
                while (frontAcc >= 1) {
                    frontAcc -= 1;
                    sparkle(xa + f.dir * span * fk + rnd(-2, 2) * D, G - rnd(0, 0.1) * G, D, [beamCols[0], '#ffffff', pick(petals)[1]], rnd(-15, 15), -rnd(40, 120) * (H / 300), rnd(0.4, 0.8));
                }
            }
            // 꽃밭에서 꽃잎이 살랑
            if (t > 0.3 && t < tB) {
                petAcc += dt * 16;
                while (petAcc >= 1) {
                    petAcc -= 1;
                    const fl = pick(flowers);
                    if (t > fl.t0 + 0.45) {
                        flutter(fl.x, fl.y - (fl.hs + 2) * D, D, fl.pc, rnd(-20, 20), -rnd(20, 60), rnd(0.8, 1.4), { g: 10, sway: 30, hi: fl.lc });
                    }
                }
            }
            // 거대 봉오리로 빛이 모임 — 갈수록 많이
            if (t > 1.0 && t < tOpen - 0.05) {
                moteAcc += dt * (50 + (90 * (t - 1)) / (tOpen - 1));
                while (moteAcc >= 1) {
                    moteAcc -= 1;
                    const fl = pick(flowers);
                    mote(fl.x, fl.y - fl.hs * D, cxF, yF, D, pick([fl.pc, fl.lc, '#ffffff', beamCols[1]]), rnd(0.3, 0.5), pick([1, 1, 2]));
                }
            }
            moveFronts(dt);
            if (t < stormUntil) {
                stormAcc += dt * 220;
                while (stormAcc >= 1) {
                    stormAcc -= 1;
                    stormOne();
                }
            }
        };
        const glyph = (x, y, rows, fl) => {
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
        };
        const drawFlower = (fl, t) => {
            const age = t - fl.t0;
            if (age < 0) {
                return;
            }
            const hs = Math.max(1, Math.round(fl.hs * Math.min(1, age / 0.22)));
            const sway = Math.round(Math.sin(t * 2.6 + fl.ph) * 0.7);
            for (let k = 0; k < hs; k++) {
                dot(fl.x + (k > hs * 0.6 ? sway * Z : 0), fl.y - (k + 1) * Z, k % 3 === 0 ? STEM[2] : STEM[1]);
            }
            if (hs >= 3) {
                dot(fl.x - Z, fl.y - 2 * Z, STEM[0]);
            }
            const tx = fl.x + sway * Z;
            const ty = fl.y - (hs + 1) * Z;
            if (age < 0.3) {
                dot(tx, ty, STEM[0]); // 싹
            } else if (age < 0.42) {
                dot(tx, ty, fl.pc); // 봉오리
                dot(tx, ty + Z, STEM[1]);
            } else {
                const rows = GLYPH[age < 0.5 && fl.type === 'm' ? 's' : fl.type];
                glyph(tx, fl.type === 't' ? ty + fl.big * Z : ty + Math.floor(rows.length / 2) * fl.big * Z, rows, fl);
            }
        };
        const drawTuft = (tf, t) => {
            const age = t - tf.t0;
            if (age < 0) {
                return;
            }
            const h = Math.max(1, Math.round(tf.h * Math.min(1, age / 0.25)));
            for (let k = 0; k < h; k++) {
                dot(tf.x, G - (k + 1) * Z, STEM[1]);
                if (k > 0) {
                    dot(tf.x - Math.ceil(k / 2) * Z, G - (k + 1) * Z, k % 2 ? STEM[2] : STEM[1]);
                    dot(tf.x + Math.ceil(k / 2) * Z, G - k * Z, STEM[0]);
                }
            }
        };
        const drawGiant = (t) => {
            if (t < tStem) {
                return;
            }
            const g = easeOut((t - tStem) / 0.45);
            const top = G - hF * g;
            const sw = Math.max(Z, rb * 0.14);
            const stemX = (y) => cxF + Math.sin(((G - y) / hF) * 3.2) * rb * 0.25;
            for (let y = G; y > top; y -= Z) {
                const x = stemX(y);
                fill(x - sw, y - Z, x + sw, y, STEM[1]);
                dot(x - sw, y - Z, STEM[0]);
                dot(x + sw - Z, y - Z, STEM[2]);
            }
            // 큰 잎 두 장
            if (g > 0.4) {
                const lk = smooth((g - 0.4) / 0.6);
                for (const [fy, side] of [[0.3, -1], [0.55, 1]]) {
                    const ly = G - hF * fy;
                    const lx = stemX(ly) + side * rb * 0.7 * lk;
                    disc(lx, ly, rb * 0.7 * lk, rb * 0.26 * lk, STEM[1]);
                    disc(lx - side * rb * 0.1, ly - rb * 0.08, rb * 0.45 * lk, rb * 0.1 * lk, STEM[0]);
                }
            }
            const bx = stemX(top);
            const by = top;
            if (t < tOpen) {
                // 봉오리 — 모일수록 커지고 빛남
                const k = k01((t - 1.0) / (tOpen - 1.0));
                const r = rb * (0.45 + 0.25 * k) * (1 + 0.06 * Math.sin(t * 30) * k);
                disc(bx, by, r * 0.8, r, STEM[2]);
                disc(bx, by - r * 0.25, r * 0.6, r * 0.75, flowerC[1]);
                disc(bx - r * 0.15, by - r * 0.45, r * 0.25, r * 0.35, flowerC[0]);
                disc(bx - r * 0.55, by + r * 0.3, r * 0.3, r * 0.5, STEM[1]);
                disc(bx + r * 0.55, by + r * 0.3, r * 0.3, r * 0.5, STEM[1]);
                if (k > 0) {
                    alpha(k);
                    ring(bx, by, r * 1.7, r * 1.7, 16, -t * 6, '#ffffff', beamCols[1]);
                    alpha(1);
                }
                return;
            }
            const k = easeOut((t - tOpen) / 0.25);
            const r = rb * (0.5 + 0.5 * k) * (1 + 0.04 * Math.sin(t * 8));
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * TAU + t * 0.6;
                disc(bx + Math.cos(a) * r * 0.85, by + Math.sin(a) * r * 0.75, r * 0.5, r * 0.42, i % 2 ? flowerC[1] : flowerC[2]);
            }
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * TAU - t * 0.8;
                disc(bx + Math.cos(a) * r * 0.42, by + Math.sin(a) * r * 0.38, r * 0.3, r * 0.26, flowerC[0]);
            }
            disc(bx, by, r * 0.3, r * 0.3, '#ffd23f');
            ring(bx, by, r * 0.22, r * 0.22, 8, t * 2, '#e8a000', '#fff3a0');
        };
        const drawBeam = (t) => {
            if (t < tB || t > tE + 0.35) {
                return;
            }
            const drop = easeIn((t - tB) / 0.12);
            const bottom = G * Math.min(1, drop);
            const narrow = t > tE ? 1 - easeIn((t - tE) / 0.35) : 1;
            const burst = t > tLand ? Math.max(0, 1 - (t - tLand) / 0.25) : 0;
            const w0 = (bw / 2) * narrow * (1 + 0.5 * burst);
            if (w0 < Z * 0.5) {
                return;
            }
            for (let y = 0, row = 0; y < bottom; y += 3 * Z, row++) {
                const hw = w0 * (1 + 0.035 * Math.sin(row * 0.9 + t * 26));
                // 가장자리는 한 칸 건너 점으로 (도트식 번짐)
                alpha(0.8);
                for (let x = hw * 0.9; x < hw * 1.15; x += 2 * Z) {
                    dot(cxF - x - ((row % 2) + 1) * Z, y, beamCols[2]);
                    dot(cxF + x + (row % 2) * Z, y + Z, beamCols[2]);
                }
                alpha(0.75);
                fill(cxF - hw * 0.9, y, cxF + hw * 0.9, y + 3 * Z, beamCols[2]);
                alpha(0.9);
                fill(cxF - hw * 0.64, y, cxF + hw * 0.64, y + 3 * Z, beamCols[1]);
                alpha(1);
                fill(cxF - hw * 0.34, y, cxF + hw * 0.34, y + 3 * Z, '#ffffff');
            }
            // 빛 속을 쏟아져 내리는 줄
            alpha(0.9);
            for (let j = 0; j < 6; j++) {
                const lx = cxF + (hash(j * 3.7) - 0.5) * w0 * 1.5;
                const ly = ((t * 2.2 + hash(j * 1.9)) % 1) * bottom;
                fill(lx - Z / 2, ly, lx + Z / 2, ly + bottom * 0.18, j % 2 ? '#ffffff' : beamCols[1]);
            }
            // 하늘이 열린 자리
            alpha(0.8 * narrow);
            disc(cxF, 0, w0 * 1.5, 3 * Z, beamCols[1]);
            alpha(narrow);
            disc(cxF, 0, w0 * 0.9, 2 * Z, '#ffffff');
            if (drop < 1) {
                alpha(1);
                disc(cxF, bottom, w0 * 0.7, w0 * 0.35, '#ffffff');
                return;
            }
            // 땅 빛 · 내려오는 고리
            const pulse = 0.7 + 0.3 * Math.sin(t * 30);
            alpha(0.8 * narrow * pulse);
            disc(cxF, G, w0 * 1.6, Math.max(2 * Z, w0 * 0.18), beamCols[1]);
            alpha(narrow);
            disc(cxF, G, w0 * 1.0, Math.max(Z, w0 * 0.1), '#ffffff');
            for (let j = 0; j < 3; j++) {
                const ry = ((t * 1.5 + j / 3) % 1) * G;
                alpha(0.8 * narrow);
                ring(cxF, ry, w0 * 1.1, Math.max(Z, w0 * 0.15), 24, t * 5 + j, '#ffffff', beamCols[1]);
            }
        };
        // 빛기둥이 내리꽂힌 뒤 — 꽃밭 곳곳에서 가는 빛살이 솟음
        const rays = [];
        const drawRays = (t) => {
            const k = (t - tLand) / 0.9;
            if (k < 0 || k > 1) {
                return;
            }
            for (const r of rays) {
                const hh = r.h * easeOut(k * 4) * (0.7 + 0.3 * Math.sin(t * 25 + r.ph));
                alpha(0.85 * (1 - k));
                fill(r.x - Z / 2, r.y - hh, r.x + Z / 2, r.y, r.c);
                dot(r.x - Z / 2, r.y - hh - Z, '#ffffff');
            }
        };
        // 꽃이 피어 나가는 앞머리 — 반짝이는 빛 줄
        const drawFront = (t) => {
            const k = (t - 0.05) / 0.75;
            if (k < 0 || k > 1.05) {
                return;
            }
            const x = xa + f.dir * span * Math.min(1, k);
            const hh = Math.max(6 * D, H * 0.12) * (0.8 + 0.2 * Math.sin(t * 30));
            alpha(0.4 * (1.05 - k));
            fill(x - 2 * Z, G - hh * 0.6, x + 2 * Z, G, beamCols[2]);
            alpha(0.9 * (1.05 - k));
            fill(x - Z / 2, G - hh, x + Z / 2, G, '#ffffff');
        };
        const draw = (t) => {
            const fade = t > sec - 0.45 ? Math.max(0, (sec - t) / 0.45) : 1;
            alpha(fade);
            for (const tf of tufts) {
                drawTuft(tf, t);
            }
            for (const fl of flowers) {
                drawFlower(fl, t);
            }
            drawFront(t);
            drawRays(t);
            drawBeam(t);
            alpha(fade);
            drawGiant(t);
            drawFronts();
        };
        scene(sec, D, {
            events: [
                [tStem, () => {
                    sigBurst(cxF, G, D, STEM, 10, 60);
                    for (let i = 0; i < 6; i++) {
                        puff(cxF + rnd(-1, 1) * rb * 0.5, G - D, D, pick(DIRT.slice(0, 3)), rnd(-60, 60), -rnd(10, 40), rnd(0.6, 1.0), 4, 0.6);
                    }
                    shake(2 + P, 350);
                }],
                [1.3, beat],
                [1.55, beat],
                [1.75, beat],
                [tOpen, () => {
                    screenFlash(D, 0.35, flowerC[0], 0.3);
                    sigRing(cxF, yF, D, rb * 0.5, rb * 4, 0.9, 0.5, [flowerC[0], '#ffffff', flowerC[1]]);
                    for (let i = 0; i < 28; i++) {
                        const a = rnd(0, TAU);
                        const sp = rnd(60, 180);
                        petal(cxF, yF, Math.cos(a) * sp, Math.sin(a) * sp - 40, rnd(0.8, 1.4), ['#ffffff', pick(flowerC)], pick([1, 2]));
                    }
                }],
                [tB, () => {
                    for (let i = 0; i < 12; i++) {
                        sparkle(cxF + rnd(-0.5, 0.5) * bw, rnd(0, 0.3) * G, D, beamCols, rnd(-20, 20), rnd(40, 120), rnd(0.3, 0.6));
                    }
                }],
                [tLand, () => {
                    screenFlash(D, 0.75, '#ffffff', 0.45);
                    shake(7 + 3 * P, 1000);
                    sigRing(cxF, G, D, bw * 0.3, W * 0.85, 0.13, 0.75, [beamCols[0], '#ffffff', beamCols[2]]);
                    stormUntil = tLand + 1.1;
                    for (let i = 0, m = 10 + Math.round(8 * P); i < m; i++) {
                        const fl = pick(flowers);
                        rays.push({ x: fl.x, y: fl.y - fl.hs * D, h: G * rnd(0.2, 0.55), c: pick([fl.pc, fl.lc, beamCols[1]]), ph: rnd(0, TAU) });
                    }
                    for (let i = 0; i < 40; i++) {
                        const a = rnd(0, TAU);
                        const sp = rnd(60, 240);
                        petal(cxF, yF, Math.cos(a) * sp, Math.sin(a) * sp - 60, rnd(0.9, 1.6), [flowerC[0], pick(flowerC)], 2);
                    }
                    for (let i = 0; i < 24; i++) {
                        sparkle(cxF + rnd(-0.5, 0.5) * bw, rnd(0.2, 1) * G, D, beamCols, rnd(-30, 30), -rnd(40, 160), rnd(0.5, 1));
                    }
                    for (const q of others(u)) {
                        const dx = Math.abs(q.x - cxF);
                        const away = Math.sign(q.x - cxF) || f.dir;
                        if (dx < bw / 2 + q.w * 0.3) {
                            hit(q, away, 'lift');
                        } else if ((q.x - xa) * f.dir > -q.w) {
                            hit(q, away, 'tumble');
                        } else {
                            hit(q, away, 'shake');
                        }
                    }
                }],
                [tLand + 0.12, () => sigRing(cxF, G, D, bw * 0.3, W * 0.6, 0.2, 0.6, [flowerC[0], flowerC[1]])],
                [tE - 0.3, () => shake(3 + P, 600)],
            ],
            update,
            draw,
        });
    }

    // ═════ ultbloom vine — 땅에서 거대 덩굴이 솟아 크게 휘둘러 내리침, 마지막엔 다 같이 쾅 ═════
    function vineRun(u, o, ms) {
        const P = power(u.P);
        const D = dotSize(u);
        const W = u.W;
        const H = u.H;
        const G = u.ground;
        const sec = ms / 1000;
        const cols = sigPal(o.c || 'grass');
        const dark = '#163a14';
        const f = field(u);
        const nV = 3 + (u.P > 0.33 ? 1 : 0) + (u.P > 0.66 ? 1 : 0);
        const N = 22; // 마디 수
        const LAG = 0.4; // 끝이 늦게 따라옴 (채찍)
        const UP = (t, j) => [-Math.PI / 2 + 0.07 * Math.sin(t * 3 + j), 0.3 * Math.sin(t * 2.2 + j * 1.3)];
        const BACK = [-Math.PI / 2 - 0.35, -0.6];
        const SLAM = [-Math.PI / 2 + 0.38, 2.55];
        const ang = (pose, s) => pose[0] + pose[1] * Math.pow(s, 1.3);
        let reach = 0;
        for (let i = 0; i < N; i++) {
            reach += Math.cos(ang(SLAM, (i + 0.5) / N)) / N;
        }
        reach = Math.max(0.2, reach);
        const vines = [];
        for (let j = 0; j < nV; j++) {
            vines.push({
                j, t0: 0.12 + j * 0.24, pts: new Array(2 * N + 2).fill(0), trail: [], gv: 0, swing: false,
                root: f.front + f.dir * f.room * (0.05 + 0.3 * (nV > 1 ? j / (nV - 1) : 0.5)),
                goal: f.front + f.dir * f.room * (0.38 + (0.6 * (j + 0.5)) / nV),
            });
        }
        // 앞쪽 포켓몬을 노림 — 목표가 가장 가까운 덩굴이 그 애 자리로
        const ahead = others(u).filter((q) => (q.x - f.front) * f.dir > 4 * D).sort((a, b) => Math.abs(a.x - f.front) - Math.abs(b.x - f.front));
        for (const q of ahead) {
            let best = null;
            for (const v of vines) {
                if (!v.aimed && (q.x - v.root) * f.dir > 6 * D && (!best || Math.abs(v.goal - q.x) < Math.abs(best.goal - q.x))) {
                    best = v;
                }
            }
            if (best) {
                best.goal = q.x;
                best.aimed = true;
            }
        }
        for (const v of vines) {
            v.L = clamp(Math.abs(v.goal - v.root) / reach, 10 * D, Math.max(G * 1.6, 40 * D));
            v.T = clamp(Math.round(Math.min(v.L, H) / (8 * D)) + 1, 4, 7);
        }
        const tF = sec - 1.3; // 다 같이 쾅
        const tR = sec - 0.55; // 땅속으로
        // [처음 자세, 나중 자세, 진행, 자란 정도]
        const planOf = (v, t) => {
            const r = t - v.t0;
            if (r < 0) {
                return null;
            }
            if (t >= tF) {
                const q = t - tF;
                const gv = t > tR ? 1 - easeIn((t - tR) / 0.4) : 1;
                if (q < 0.3) {
                    return [SLAM, BACK, q / 0.3, gv];
                }
                if (q < 0.45) {
                    return [BACK, SLAM, (q - 0.3) / 0.15, gv];
                }
                return [SLAM, SLAM, 1, gv];
            }
            const up = UP(t, v.j);
            if (r < 0.32) {
                return [up, up, 1, easeOut(r / 0.32)];
            }
            if (r < 0.56) {
                return [up, BACK, (r - 0.32) / 0.24, 1];
            }
            if (r < 0.72) {
                return [BACK, SLAM, (r - 0.56) / 0.16, 1];
            }
            if (r < 0.95) {
                return [SLAM, SLAM, 1, 1];
            }
            if (r < 1.2) {
                return [SLAM, BACK, (r - 0.95) / 0.25, 1];
            }
            if (r < 1.34) {
                return [BACK, SLAM, (r - 1.2) / 0.14, 1];
            }
            return [SLAM, SLAM, 1, 1];
        };
        const pose = (v, t) => {
            const pl = planOf(v, t);
            if (!pl) {
                v.gv = 0;
                return;
            }
            const [A, B, tau, gv] = pl;
            v.gv = gv;
            v.swing = B === SLAM && A !== SLAM && tau > 0 && tau < 1;
            const pts = v.pts;
            let x = v.root;
            let y = G + D;
            pts[0] = x;
            pts[1] = y;
            for (let i = 0; i < N; i++) {
                const s = (i + 0.5) / N;
                const k = smooth((tau - s * LAG) / (1 - LAG));
                const th = lerp(ang(A, s), ang(B, s), k);
                x += (f.dir * Math.cos(th) * v.L) / N;
                y += (Math.sin(th) * v.L) / N;
                pts[2 * i + 2] = x;
                pts[2 * i + 3] = y;
            }
            // 내리친 끝은 땅에 닿게
            let kt = 0;
            if (A === SLAM && B === SLAM) {
                kt = 1;
            } else if (B === SLAM) {
                kt = smooth((tau - 0.6) / 0.4);
            } else if (A === SLAM) {
                kt = 1 - smooth(tau / 0.35);
            }
            if (kt > 0) {
                const dy = G - D - pts[2 * N + 1];
                for (let i = 1; i <= N; i++) {
                    pts[2 * i + 1] += dy * (i / N) ** 2 * kt;
                }
            }
            for (let i = 1; i <= N; i++) {
                pts[2 * i + 1] = Math.min(pts[2 * i + 1], G);
            }
            // 휘두르는 동안만 끝 자취
            if (v.swing) {
                v.trail.unshift(pts[2 * N], pts[2 * N + 1]);
                if (v.trail.length > 8) {
                    v.trail.length = 8;
                }
            } else {
                v.trail.length = 0;
            }
        };
        const slam = (v, big) => {
            const xt = v.pts[2 * N];
            if (!big) {
                screenFlash(D, 0.22, cols[0], 0.18);
                shake(4 + 2 * P, 380);
            }
            sigImpact(xt, G - 2 * D, D, [cols[0], '#ffffff', cols[1]], 1, true);
            sigRing(xt, G, D, 2 * D, Math.max(u.R * 1.4, W * 0.15), 0.2, 0.45, [cols[0], '#ffffff', cols[2]]);
            for (let i = 0; i < (big ? 5 : 8); i++) {
                chunk(xt, G - D, D, rnd(-1, 1) * H * 0.5, -rnd(0.4, 1) * H * 1.1, H * 2.4, G, pick(DIRT), pick([1, 2]), DIRT[0], true);
            }
            for (let i = 0; i < 5; i++) {
                puff(xt + rnd(-1, 1) * 3 * D, G - D, D, pick(DIRT.slice(0, 3)), rnd(-60, 60), -rnd(10, 50), rnd(0.6, 1.0), 4, 0.6);
            }
            for (let i = 0; i < (big ? 8 : 12); i++) {
                flutter(xt, G - 2 * D, D, pick([cols[1], cols[2], cols[0]]), rnd(-1, 1) * 160, -rnd(60, 220) * (H / 300), rnd(0.9, 1.5), { g: 120, sway: 40 });
            }
            hitAround(u, xt, Math.max(u.R * 0.6, W * 0.07), 'tumble', v.root);
        };
        const sprout = (v) => {
            sigRing(v.root, G, D, D * 2, v.T * D * 4, 0.25, 0.35, [cols[1], DIRT[1]]);
            for (let i = 0; i < 7; i++) {
                chunk(v.root, G - D, D, rnd(-1, 1) * H * 0.4, -rnd(0.4, 0.9) * H, H * 2.4, G, pick(DIRT), pick([1, 2]), DIRT[0], true);
            }
            for (let i = 0; i < 4; i++) {
                puff(v.root + rnd(-1, 1) * 2 * D, G - D, D, pick(DIRT.slice(0, 3)), rnd(-40, 40), -rnd(10, 40), rnd(0.6, 1.0), 4, 0.6);
            }
            shake(2 + P, 260);
        };
        let finaleDone = false;
        const finale = () => {
            screenFlash(D, 0.6, '#ffffff', 0.4);
            shake(7 + 3 * P, 900);
            const mid = f.front + f.dir * f.room * 0.55;
            sigRing(mid, G, D, 2 * D, W * 0.8, 0.12, 0.7, [cols[0], '#ffffff', cols[1]]);
            sigRing(mid, G, D, 2 * D, W * 0.5, 0.2, 0.5, [cols[1], cols[2]]);
            for (let i = 0; i < 80; i++) {
                flutter(f.front + f.dir * f.room * rnd(0, 1), G - rnd(0, 0.3) * G, D, pick(cols), f.dir * rnd(20, 200) * (W / 480) + rnd(-40, 40), -rnd(80, 260) * (H / 300), rnd(1, 1.8), { g: 80 * (H / 300), drag: 0.9, sway: 50 });
            }
            for (const q of others(u)) {
                if ((q.x - f.front) * f.dir > -q.w) {
                    hit(q, Math.sign(q.x - f.front) || f.dir, 'lift');
                }
            }
        };
        const update = (t) => {
            for (const v of vines) {
                pose(v, t);
                const r = t - v.t0;
                if (!v.born && r >= 0) {
                    v.born = true;
                    sprout(v);
                }
                if (!v.h1 && r >= 0.7 && t < tF) {
                    v.h1 = true;
                    slam(v, false);
                }
                if (!v.h2 && r >= 1.32 && t < tF) {
                    v.h2 = true;
                    slam(v, false);
                }
                if (!v.h3 && t >= tF + 0.43 && v.born) {
                    v.h3 = true;
                    slam(v, true);
                }
            }
            if (!finaleDone && t >= tF + 0.43) {
                finaleDone = true;
                finale();
            }
        };
        const drawVine = (v) => {
            const pts = v.pts;
            const segs = Math.max(1, Math.ceil(N * v.gv));
            // 휘두르는 자취
            if (v.swing && v.trail.length >= 4) {
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
                for (let i = 0; i < segs; i++) {
                    const th = Math.max(1, Math.round(v.T * (1 - (0.72 * i) / N)));
                    const xa = pts[2 * i];
                    const ya = pts[2 * i + 1];
                    const xb = pts[2 * i + 2];
                    const yb = pts[2 * i + 3];
                    if (pass === 0) {
                        line(xa, ya, xb, yb, dark, th + 2);
                    } else if (pass === 1) {
                        line(xa, ya, xb, yb, i % 4 === 3 ? cols[3] : cols[2], th);
                    } else if (th >= 3) {
                        line(xa - Z, ya - Z, xb - Z, yb - Z, cols[1], th - 2);
                    }
                }
            }
            // 잎 · 가시
            for (let i = 2; i < segs - 1; i += 2) {
                const xa = pts[2 * i];
                const ya = pts[2 * i + 1];
                const dx = pts[2 * i + 2] - xa;
                const dy = pts[2 * i + 3] - ya;
                const len = Math.hypot(dx, dy) || 1;
                const nx = -dy / len;
                const ny = dx / len;
                const th = Math.max(1, Math.round(v.T * (1 - (0.72 * i) / N)));
                const side = (i / 2) % 2 ? 1 : -1;
                if (i % 4 === 0) {
                    const lx = xa + nx * side * (th / 2 + 1.5) * Z;
                    const ly = ya + ny * side * (th / 2 + 1.5) * Z;
                    disc(lx, ly, 2.2 * Z, 1.3 * Z, cols[1]);
                    dot(lx - Z, ly - Z, cols[0], 2, 1);
                } else {
                    dot(xa + nx * side * (th / 2 + 0.5) * Z, ya + ny * side * (th / 2 + 0.5) * Z, cols[0]);
                }
            }
            // 땅 둔덕
            disc(v.root, G, v.T * Z * 1.2, Z * 1.5, DIRT[2]);
            dot(v.root - Z, G - Z, DIRT[1], 2, 1);
        };
        const draw = (t) => {
            for (const v of vines) {
                if (v.gv > 0) {
                    drawVine(v, t);
                }
            }
        };
        scene(sec, D, { update, draw });
    }

    // ═════ ultvortex — 화면 높이 거대 소용돌이 (물 · 불 · 바람 · 모래 · 용) — 휘말려 빙글, 끝에 펑 ═════
    const VORTEX_BITS = { water: 'drop', ice: 'drop', fire: 'ember', wind: 'leaf', grass: 'leaf', normal: 'leaf', silver: 'leaf', petal: 'leaf', ground: 'rock', rock: 'rock', steel: 'rock', bone: 'rock', spore: 'rock' };
    function vortexRun(u, o, ms) {
        const P = power(u.P);
        const D = dotSize(u);
        const W = u.W;
        const H = u.H;
        const G = u.ground;
        const sec = ms / 1000;
        const c = o.c || 'water';
        const cols = sigPal(c);
        const bits = VORTEX_BITS[c] || 'spark';
        const rockC = sigPal('rock');
        const bitCols = bits === 'drop' ? ['#ffffff', cols[0], cols[1], cols[1]] : bits === 'ember' ? [cols[0], cols[1], cols[1], cols[2]] : bits === 'leaf' ? ['#8be04e', '#4cae3c', '#c9a050', cols[2]] : bits === 'rock' ? [rockC[1], rockC[2], cols[1], cols[2]] : [cols[0], cols[1], cols[2]];
        const n = Number(o.n) >= 2 ? 2 : 1;
        const f = field(u);
        const grav = H * 2.2;
        const rTop = clamp(Math.min(W * 0.17, H * 0.42), 7 * D, 160) * (0.75 + 0.35 * P) * (n === 2 ? 0.78 : 1);
        const Hc = G + 6 * D;
        const tB = sec - 0.95; // 펑
        const spin = f.dir * (5.5 + 2 * P);
        const streaks = 4 + (P > 0.7 ? 1 : 0);
        // 몸통 · 뒤쪽 줄 [색, 진하기] — 불은 밝게
        const body = bits === 'ember' ? [cols[2], 0.26] : [cols[3], 0.18];
        const back = bits === 'ember' ? [cols[3], 0.6] : [cols[2], 0.4];
        const columns = [];
        let dPrev = 0;
        for (let i = 0; i < n; i++) {
            const dmin = rTop * 0.85 + u.body.rx + (i ? dPrev + rTop * 1.5 : 0);
            const want = f.room * (n === 2 ? [0.32, 0.76][i] : 0.45);
            const d = clamp(want, dmin, Math.max(dmin, f.room - rTop * 0.35));
            dPrev = d;
            columns.push({ cx: u.body.cx + f.dir * d, phase: rnd(0, TAU), bits: [], vis: 0, acc: 0 });
        }
        const rAt = (fr) => {
            const base = rTop * 0.16 + rTop * 0.84 * Math.pow(fr, 0.85);
            return fr > 0.85 ? base * (1 + (fr - 0.85) * 2.4) : base;
        };
        const axAt = (col, h, t) => col.cx + (Math.sin(t * 1.8 + (h / H) * 2.4 + col.phase) * 0.16 + Math.sin(t * 3.1 + (h / H) * 5 + col.phase * 2) * 0.05) * rTop * (h / Hc);
        const newBit = (fr) => ({ th: rnd(0, TAU), h: fr * Hc, rf: rnd(0.75, 1.3), rise: Hc * rnd(0.22, 0.5), sm: rnd(0.8, 1.3), size: bits === 'rock' ? pick([2, 2, 3]) : pick([1, 1, 2]), col: pick(bitCols), ph: rnd(0, 10) });
        const nb = Math.round((40 + 60 * P) * (n === 2 ? 0.7 : 1));
        for (const col of columns) {
            for (let i = 0; i < nb; i++) {
                col.bits.push(newBit(rnd(0, 1)));
            }
        }
        const nearest = (x) => columns.reduce((a, b) => (Math.abs(b.cx - x) < Math.abs(a.cx - x) ? b : a));
        const pullR = Math.max(rTop * 2.6, W * 0.38);
        // 날려 보내기 — 모양마다
        const fling = (x, y, vx, vy, max = 1.4) => {
            switch (bits) {
                case 'ember':
                    ember(x, y, D, pick(cols.slice(0, 2)), cols[2], vx, vy, max * 0.7);
                    break;
                case 'leaf':
                    flutter(x, y, D, pick(bitCols), vx, vy, max, { g: 60, sway: 40 });
                    break;
                case 'spark':
                    sparkle(x, y, D, cols, vx, vy, max * 0.5);
                    break;
                default:
                    chunk(x, y, D, vx, vy, grav, G, pick(bitCols), bits === 'rock' ? 2 : 1, bits === 'rock' ? rockC[0] : undefined, bits === 'drop' && Math.random() < 0.3, max);
            }
        };
        const flingOne = (col, t) => {
            const fr = rnd(0.05, 0.9) * (col.vis / Hc);
            const h = fr * Hc;
            const side = Math.random() < 0.5 ? -1 : 1;
            fling(axAt(col, h, t) + side * rAt(fr), G - h, side * rnd(60, 180) * (W / 480), -rnd(20, 120), 1.4);
        };
        // 빨아들이기 — 땅에 선 애는 회오리 쪽으로 끌려가며 빙글, 아니면 그 자리에서 빙글
        const pending = [];
        const pulled = new Set();
        const pullOne = (pk) => {
            const q = others(u).find((v) => v.pokemon === pk);
            if (!q || pulled.has(pk)) {
                return;
            }
            pulled.add(pk);
            const col = nearest(q.x);
            const toward = Math.sign(col.cx - q.x) || 1;
            const st = pk.currentState;
            const free = pk.bottom <= pk.floor + 1 && !(st instanceof DragState || st instanceof TumbleState || st instanceof FallState || st instanceof UltState || st instanceof UltFreezeState || st instanceof FlyState || st instanceof JumpState || st instanceof DashState);
            if (!free) {
                hit(q, toward, 'spin');
                return;
            }
            const startL = pk.left;
            const goal = clamp(startL + (col.cx - q.x) * 0.75, 0, rightEdge(pk));
            try {
                ultMove(pk, (i, state) => {
                    if (i === 0) {
                        state.until = performance.now() + 2200;
                    }
                    pk.positionLeft(lerp(startL, goal, easeIn((i + 1) / 5)));
                    if (i === 1) {
                        hit(pk, toward, 'spin');
                    }
                    return i >= 4;
                });
            } catch (err) {
                hit(q, toward, 'spin');
            }
            for (let i = 0; i < 6; i++) {
                puff(q.x, q.bottom - D, D, pick(DIRT.slice(0, 3)), toward * rnd(20, 80), -rnd(5, 30), rnd(0.5, 0.8), 3, 0.5);
            }
        };
        const update = (t, dt) => {
            const form = easeOut((t - 0.2) / 0.6);
            for (const col of columns) {
                col.vis = Hc * form;
                if (t >= tB) {
                    continue;
                }
                for (const b of col.bits) {
                    b.th += spin * b.sm * dt * (1.35 - 0.5 * (b.h / Hc));
                    b.h += b.rise * dt;
                    if (b.h > col.vis) {
                        b.h = rnd(0, 0.08) * Hc;
                        b.th = rnd(0, TAU);
                    }
                }
                if (t > 0.4) {
                    col.acc += dt * (n === 2 ? 22 : 32);
                    while (col.acc >= 1) {
                        col.acc -= 1;
                        flingOne(col, t);
                    }
                }
            }
            for (let i = pending.length - 1; i >= 0; i--) {
                if (t >= pending[i].at) {
                    pullOne(pending[i].pk);
                    pending.splice(i, 1);
                }
            }
        };
        const burstFx = () => {
            screenFlash(D, 0.65, cols[0], 0.4);
            shake(7 + 3 * P, 800);
            for (const col of columns) {
                sigRing(col.cx, G, D, rTop * 0.3, rTop * 3.6, 0.22, 0.6, [cols[0], '#ffffff', cols[1]]);
                sigRing(col.cx, G - Hc * 0.45, D, rTop * 0.3, rTop * 2.6, 0.55, 0.5, [cols[1], cols[2]]);
                sigImpact(col.cx, G - Hc * 0.3, D, [cols[0], '#ffffff', cols[1]], 1, true);
                // 감겨 있던 것들이 사방으로
                for (const b of col.bits) {
                    if (b.h > col.vis) {
                        continue;
                    }
                    const r = rAt(b.h / Hc) * b.rf;
                    const x = axAt(col, b.h, tB) + Math.cos(b.th) * r;
                    fling(x, G - b.h, Math.cos(b.th) * rnd(150, 420) * (W / 480), -rnd(40, 280) * (H / 300), 1.8);
                }
                col.bits.length = 0;
                for (let i = 0; i < 50; i++) {
                    const fr = rnd(0, 0.9);
                    const a = rnd(0, TAU);
                    fling(col.cx + Math.cos(a) * rAt(fr), G - fr * Hc, Math.cos(a) * rnd(100, 360) * (W / 480), -rnd(20, 300) * (H / 300), 1.8);
                }
                // 물이면 뒤늦게 쏟아지는 비
                if (bits === 'drop') {
                    for (let i = 0; i < 30; i++) {
                        chunk(col.cx + rnd(-1.5, 1.5) * rTop, -rnd(0, 0.3) * H, D, rnd(-20, 20), rnd(0.2, 0.6) * H, grav, G, pick(['#ffffff', cols[1], cols[2]]), 1, undefined, true, 2.2);
                    }
                }
            }
            for (const q of others(u)) {
                const col = nearest(q.x);
                if (Math.abs(q.x - col.cx) < pullR * 1.15) {
                    hit(q, Math.sign(q.x - col.cx) || f.dir, 'tumble');
                }
            }
        };
        const drawBase = (col, t, pass) => {
            const k = Math.min(1, t / 0.4);
            const end = t > tB ? Math.max(0, 1 - (t - tB) / 0.6) : 1;
            if (end <= 0) {
                return;
            }
            const grow = t > tB ? 1 + (t - tB) * 2 : 1;
            for (let i = 0; i < 3; i++) {
                const rx = rTop * (0.45 + 0.42 * i) * (0.4 + 0.6 * k) * grow;
                const ry = Math.max(2 * Z, rx * 0.17);
                const m = 18 + i * 6;
                for (let j = 0; j < m; j++) {
                    const a = (j / m) * TAU + t * spin * (1.5 - 0.35 * i);
                    const dep = Math.sin(a);
                    if ((dep > 0) !== (pass === 1)) {
                        continue;
                    }
                    alpha((pass ? 0.95 : 0.4) * end);
                    dot(col.cx + Math.cos(a) * rx, G + dep * ry - Z, j % 3 ? cols[1] : '#ffffff', 2, 1);
                }
            }
            if (pass === 0) {
                alpha(0.35 * end);
                disc(col.cx, G, rTop * 0.35 * k * grow, Math.max(Z, rTop * 0.06), cols[3]);
            }
        };
        const drawBits = (col, t, pass) => {
            if (t >= tB) {
                return;
            }
            for (const b of col.bits) {
                if (b.h > col.vis) {
                    continue;
                }
                const r = rAt(b.h / Hc) * b.rf;
                const dep = Math.sin(b.th);
                if ((dep > 0) !== (pass === 1)) {
                    continue;
                }
                const x = axAt(col, b.h, t) + Math.cos(b.th) * r;
                const y = G - b.h + dep * r * 0.18;
                alpha(pass ? 1 : 0.45);
                if (bits === 'leaf') {
                    const flat = Math.floor(t * 12 + b.ph) % 2;
                    dot(x, y, b.col, flat ? 2 : 1, flat ? 1 : 2);
                } else if (bits === 'rock') {
                    dot(x, y, b.col, b.size, b.size);
                    dot(x, y, rockC[0], b.size - 1, 1);
                } else if (bits === 'spark') {
                    dot(x, y, '#ffffff');
                    if (pass) {
                        dot(x - Z, y, b.col);
                        dot(x + Z, y, b.col);
                        dot(x, y - Z, b.col);
                        dot(x, y + Z, b.col);
                    }
                } else {
                    dot(x, y, b.col, b.size, bits === 'drop' ? b.size + 1 : b.size);
                }
            }
        };
        const drawColumn = (col, t, pass) => {
            const bk = t > tB ? (t - tB) / 0.4 : 0;
            if (bk >= 1 || col.vis < Z) {
                return;
            }
            const fade = 1 - bk;
            const widen = 1 + 1.6 * bk;
            for (let h = 0, row = 0; h < col.vis; h += Z, row++) {
                const y = G - h;
                if (y < -Z) {
                    break;
                }
                const fr = h / Hc;
                const r = rAt(fr) * widen;
                const ax = axAt(col, h, t);
                if (pass === 0) {
                    alpha(body[1] * fade);
                    fill(ax - r, y, ax + r, y + Z, body[0]);
                    alpha(0.22 * fade);
                    fill(ax - r * 0.3, y, ax + r * 0.3, y + Z, cols[1]); // 속 빛
                }
                const band = Math.floor(fr * 14 - t * 2.5);
                for (let j = 0; j < streaks; j++) {
                    const th = (j * TAU) / streaks + fr * (8.5 + (j % 2) * 1.5) + t * spin * (1 + 0.12 * (j % 3)) + col.phase;
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
                    alpha((pass ? 0.95 : back[1]) * fade);
                    fill(x - len / 2, y, x + len / 2, y + Z, pass ? (nz > 0.6 ? cols[0] : cols[1]) : back[0]);
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
        };
        const draw = (t) => {
            for (const col of columns) {
                drawBase(col, t, 0);
                drawBits(col, t, 0);
            }
            for (const col of columns) {
                drawColumn(col, t, 0);
            }
            for (const col of columns) {
                drawColumn(col, t, 1);
            }
            for (const col of columns) {
                drawBits(col, t, 1);
                drawBase(col, t, 1);
            }
        };
        scene(sec, D, {
            events: [
                [0, () => {
                    shake(2, 400);
                    for (const col of columns) {
                        sigRing(col.cx, G, D, rTop * 1.6, rTop * 0.3, 0.2, 0.5, [cols[0], cols[1]]);
                    }
                }],
                [0.5, () => {
                    screenFlash(D, 0.25, cols[1], 0.25);
                    shake(2.5 + 1.5 * P, Math.max(500, (tB - 0.5) * 1000));
                    for (const col of columns) {
                        sigRing(col.cx, G, D, rTop * 0.3, rTop * 2.4, 0.22, 0.5, [cols[0], '#ffffff', cols[2]]);
                    }
                }],
                [0.6, () => {
                    for (const q of others(u)) {
                        const col = nearest(q.x);
                        const d = Math.abs(q.x - col.cx);
                        if (d < pullR) {
                            pending.push({ pk: q.pokemon, at: 0.6 + (d / pullR) * 0.7 });
                        } else {
                            hit(q, Math.sign(col.cx - q.x) || 1, 'shake');
                        }
                    }
                }],
                [tB, burstFx],
            ],
            update,
            draw,
        });
    }

    Object.assign(ULT_FX, {
        ultquake: {
            ms: (P) => 3500 + 600 * clamp(Number(P) || 0, 0, 1),
            run: quakeRun,
        },
        ultpillar: {
            ms: (P, o) => clamp(pillarPlan(power(P), pillarN(o || {})).sec * 1000, 2500, 4500),
            run: pillarRun,
        },
        ultbloom: {
            ms: (P, o) => (o?.mode === 'vine' ? 3900 + 400 * clamp(Number(P) || 0, 0, 1) : 4000 + 300 * clamp(Number(P) || 0, 0, 1)),
            run: (u, o, ms, pokemon) => (o.mode === 'vine' ? vineRun(u, o, ms, pokemon) : bloomRun(u, o, ms, pokemon)),
        },
        ultvortex: {
            ms: (P) => 3800 + 500 * clamp(Number(P) || 0, 0, 1),
            run: vortexRun,
        },
    });
})();
