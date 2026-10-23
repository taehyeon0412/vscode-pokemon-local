
// ───── 필살기 연출 A — 에너지 (ult/SPEC.md): ultbeam 광선 · ultorb 거대 구체 · ultnova 대폭발 · ultblackhole 블랙홀 · ultsparkle 반짝 ─────
// 입자는 먼저 만든 것이 위에 그려짐 (moveTick 이 나중 것부터 그림) — 그래서 덮개(화면 번쩍) → 본체 → 조각 순서로 만듦
// 다른 연출 파일과 한 덩어리로 이어 붙으니 전부 이 안에 (이름 겹침 방지)
(() => {
    const CAP = 1250; // 살아 있는 입자가 이만큼 넘으면 꾸밈 입자는 건너뜀 (한도 1500)
    const TAU = Math.PI * 2;
    const room = (n = 1) => moveParticles.length + n <= CAP;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const lerp = (a, b, k) => a + (b - a) * k;
    const k01 = (v) => clamp(v, 0, 1);
    const smooth = (v) => {
        const k = k01(v);
        return k * k * (3 - 2 * k);
    };
    const easeOut = (v) => 1 - (1 - k01(v)) ** 3;
    const easeIn = (v) => k01(v) ** 2;
    const strength = (u) => 0.4 + 0.6 * clamp(u.P ?? 0.5, 0, 1); // 약한 애도 필살기답게 바닥을 둠
    const sceneScale = (u) => clamp(Math.min(u.W, u.H * 1.6) / 480, 0.55, 2.2); // 패널 크기 비율 (속도 · 개수)
    const areaScale = (u) => clamp((u.W * u.H) / 144000, 0.4, 3); // 화면 넓이 비율 (화면 가득 뿌릴 때)
    const hash = (a, b = 0) => {
        const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
        return v - Math.floor(v);
    };
    const fail = (err) => ultError('fx-energy', err);
    const later = (ms, fn) => setTimeout(() => {
        try {
            fn();
        } catch (err) {
            fail(err);
        }
    }, Math.max(0, ms));
    // 무지개 색 (12도 칸으로 모아 둠)
    const HUES = {};
    const hue = (h, l) => {
        const i = ((Math.round(h / 12) % 30) + 30) % 30;
        const key = i * 1000 + l;
        return HUES[key] || (HUES[key] = `hsl(${i * 12}, 100%, ${l}%)`);
    };

    // ── 입자 도구 ──
    // 본체 입자 — update · draw 에서 오류가 나도 전체 그리기가 멈추지 않게 (진짜 입자를 돌려줌)
    function part(p) {
        const { update, draw } = p;
        if (update) {
            p.update = (q, dt) => {
                try {
                    update(q, dt);
                } catch (err) {
                    q.life = q.max;
                    fail(err);
                }
            };
        }
        if (draw) {
            p.draw = (ctx, q, t, px) => {
                try {
                    draw(ctx, q, t, px);
                } catch (err) {
                    q.life = q.max;
                    fail(err);
                }
                ctx.globalCompositeOperation = 'source-over';
            };
        }
        sigParticle(p);
        return moveParticles[moveParticles.length - 1];
    }
    // 초당 rate 개씩 sec 동안
    function emit(sec, rate, fn) {
        sigEmitter({ until: performance.now() + sec * 1000, rate, fx: () => {
            try {
                if (room()) {
                    fn();
                }
            } catch (err) {
                fail(err);
            }
        } });
    }
    // 맨 위 덮개 — 화면 전체 번쩍 · 하얗게 (연출 처음에 만들어야 맨 위). flash(색, 진하기, 사라지는 초, 머무는 초, 늦춤)
    function overlay(sec) {
        const list = [];
        const p = part({ x: 0, y: 0, s: 1, max: sec + 0.6, _screen: true, draw: (ctx, q) => {
            for (let i = list.length - 1; i >= 0; i--) {
                const f = list[i];
                const age = q.life - f.at;
                if (age < 0) {
                    continue;
                }
                const a = age < f.hold ? f.alpha : f.alpha * (1 - (age - f.hold) / f.fade);
                if (a <= 0) {
                    list.splice(i, 1);
                    continue;
                }
                ctx.globalAlpha = Math.min(typeof fxFlashCap === 'function' ? fxFlashCap() : 1, a); // 게임 모드 번쩍 상한 (ult/bridge.js)
                ctx.fillStyle = f.color;
                ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
            }
        } });
        return (color, alpha, fade, hold = 0, delay = 0) => list.push({ at: p.life + delay, color, alpha, fade: Math.max(0.01, fade), hold });
    }
    // 그림 떨기 · 밝히기 (o.tint 위에 겹침)
    function tremble(el, amp, ms, period = 40) {
        el?.animate?.([{ translate: `-${amp}px 0` }, { translate: `${amp}px 0` }], { duration: period, iterations: Math.max(2, Math.round(ms / period)), direction: 'alternate', composite: 'add' });
    }
    function glowSprite(el, levels, ms) {
        if (!el?.animate) {
            return;
        }
        const base = el.style.filter && el.style.filter !== 'none' ? `${el.style.filter} ` : '';
        el.animate(levels.map((b) => ({ filter: `${base}brightness(${b})` })), { duration: ms, easing: 'ease-in-out' });
    }
    // 가장 가까운 다른 포켓몬
    function nearest(u, x) {
        let best = null;
        for (const q of u.others()) {
            if (!best || Math.abs(q.x - x) < Math.abs(best.x - x)) {
                best = q;
            }
        }
        return best;
    }
    function refind(u, q) {
        return q ? u.others().find((v) => v.pokemon === q.pokemon) || null : null;
    }

    // ── 그리기 도구 (점 칸 단위) ──
    // 점 고리 (flat = 세로 납작, step = 점 사이 칸)
    function ringDots(ctx, px, s, x, y, r, flat, cols, step = 1.5, size = 1, phase = 0) {
        if (!(r > 0)) {
            return;
        }
        const W = window.innerWidth;
        const H = window.innerHeight;
        const n = clamp(Math.round((TAU * r) / (s * step)), 8, 720);
        const off = ((size - 1) * s) / 2;
        for (let j = 0; j < n; j++) {
            const a = (j / n) * TAU + phase;
            const X = px(x + Math.cos(a) * r - off);
            const Y = px(y + Math.sin(a) * r * flat - off);
            if (X < -8 || Y < -8 || X > W + 8 || Y > H + 8) {
                continue;
            }
            ctx.fillStyle = cols[j % cols.length];
            ctx.fillRect(X, Y, size * s, size * s);
        }
    }
    // 겹 원 — [[배수, 색, 진하기], …]. shade 를 주면 안쪽 겹이 왼쪽 위로 (입체)
    function discs(ctx, px, s, x, y, r, layers, alpha = 1, shade = 0) {
        for (const [m, c, a] of layers) {
            if (r * m < s * 0.5) {
                continue;
            }
            const off = r * (1 - Math.min(1, m)) * shade;
            ctx.globalAlpha = a * alpha;
            sigDisc(ctx, px, s, x - off, y - off, r * m, c);
        }
    }
    // 가장자리가 들쭉날쭉한 원 (불꽃 · 폭발)
    function fuzzDisc(ctx, px, s, x, y, r, color, jit, seed) {
        if (r < s * 0.5) {
            return;
        }
        ctx.fillStyle = color;
        const H = window.innerHeight;
        for (let dy = -r; dy <= r; dy += s) {
            const yy = px(y + dy);
            if (yy < -s || yy > H) {
                continue;
            }
            const half = Math.sqrt(Math.max(0, r * r - dy * dy)) + (hash(Math.round(dy / s), seed) - 0.5) * 2 * jit;
            if (half <= 0) {
                continue;
            }
            ctx.fillRect(px(x - half), yy, Math.max(s, px(2 * half)), s);
        }
    }
    // 출렁이는 원 (물)
    function wobDisc(ctx, px, s, x, y, r, color, amp, life) {
        ctx.fillStyle = color;
        for (let dy = -r; dy <= r; dy += s) {
            const half = Math.sqrt(Math.max(0, r * r - dy * dy)) * (1 + amp * Math.sin((dy / r) * 6 + life * 7));
            ctx.fillRect(px(x - half), px(y + dy), Math.max(s, px(2 * half)), s);
        }
    }
    // 반짝 별 — 가운데 + 팔 r 칸 (diag 면 x 모양)
    function drawStar(ctx, px, s, x, y, r, cols, diag = false) {
        const X = px(x);
        const Y = px(y);
        ctx.fillStyle = cols[0];
        ctx.fillRect(X, Y, s, s);
        if (r <= 0) {
            return;
        }
        const dirs = diag ? [[1, 1], [-1, 1], [1, -1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (let k = 1; k <= r; k++) {
            ctx.fillStyle = k === 1 ? cols[1] : k === r ? cols[3] : cols[2];
            for (const [dx, dy] of dirs) {
                ctx.fillRect(X + dx * k * s, Y + dy * k * s, s, s);
            }
        }
        if (r >= 3 && !diag) {
            ctx.fillStyle = cols[2];
            for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
                ctx.fillRect(X + dx * s, Y + dy * s, s, s);
            }
        }
    }
    // 큰 반짝 — 네 갈래 빛, 가운데가 굵고 끝으로 가늘어짐
    function bigSparkle(ctx, px, s, x, y, len, c0, c1, thick = 3) {
        for (let d = 0; d < len; d += s) {
            const w = Math.max(1, Math.round(thick * (1 - d / len))) * s;
            ctx.fillStyle = d < len * 0.45 ? c0 : c1;
            ctx.fillRect(px(x + d), px(y - w / 2), s, w);
            ctx.fillRect(px(x - d), px(y - w / 2), s, w);
            ctx.fillRect(px(x - w / 2), px(y + d), w, s);
            ctx.fillRect(px(x - w / 2), px(y - d), w, s);
        }
    }
    // 하트 (big 이면 7x6)
    const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
    function drawHeart(ctx, px, s, x, y, big, color, hi) {
        const rows = big ? HEART : GLYPHS.heart;
        const x0 = x - Math.floor(rows[0].length / 2) * s;
        const y0 = y - Math.floor(rows.length / 2) * s;
        drawGlyph(ctx, px, s, x0, y0, rows, color);
        if (hi) {
            dotAt(ctx, px, s, x0 + s, y0 + s, hi);
        }
    }
    // 집중선 — 바깥에서 한 점으로 모이는 선 (만화 느낌)
    function speedLines(ctx, px, s, cx, cy, rIn, rOut, n, color, life, alpha) {
        if (alpha <= 0) {
            return;
        }
        ctx.globalAlpha = Math.min(1, alpha);
        ctx.fillStyle = color;
        const tick = Math.floor(life * 18);
        for (let j = 0; j < n; j++) {
            if (hash(j, tick) < 0.3) {
                continue;
            }
            const a = (j / n) * TAU + hash(j, 7) * 0.25;
            const ca = Math.cos(a);
            const sa = Math.sin(a);
            const w = hash(j, 3) < 0.35 ? 2 : 1;
            for (let r = rIn * (1 + hash(j, tick + 1) * 0.5); r < rOut; r += s * 3) {
                ctx.fillRect(px(cx + ca * r), px(cy + sa * r), s * w, s * w);
            }
        }
    }
    // 빛 구슬 — 겹 원 + 도는 빛살 + 둘레 점 (광선 모으기 · 입 앞)
    function orbGlow(ctx, px, s, x, y, r, cols, life, ray, hot) {
        if (r <= 0) {
            return;
        }
        discs(ctx, px, s, x, y, r, [[1.9, cols[3], 0.28], [1.45, cols[2], 0.8], [1.12, hot ? cols[0] : cols[1], 1], [0.78, cols[0], 1], [0.42, '#ffffff', 1]]);
        const n = 8;
        ctx.globalAlpha = ray;
        for (let j = 0; j < n; j++) {
            const a = life * 4 + (j * TAU) / n;
            const len = r * (j % 2 ? 2.3 : 3.4) * (0.8 + 0.25 * Math.sin(life * 31 + j)) * (hot ? 1.35 : 1);
            const w = j % 2 ? 1 : 2;
            const ca = Math.cos(a);
            const sa = Math.sin(a);
            for (let d = r * 1.15; d < len; d += s) {
                dotAt(ctx, px, s, x + ca * d - ((w - 1) * s) / 2, y + sa * d - ((w - 1) * s) / 2, d < len * 0.6 ? cols[0] : cols[2], w, w);
            }
        }
        ctx.globalAlpha = ray;
        for (let j = 0; j < 6; j++) {
            const a = life * 9 + (j * TAU) / 6;
            dotAt(ctx, px, s, x + Math.cos(a) * r * 2.3, y + Math.sin(a) * r * 2.3, j % 2 ? cols[0] : '#ffffff');
        }
    }

    // ── 입자 모양 · 움직임 (한 번만 만들어 둔 함수 — 입자마다 새로 만들지 않음) ──
    const UP = {
        // 한 점(c = {x, y}, 움직여도 따라감)으로 빨려 듦 — spin 만큼 돌며
        pull: (p) => {
            const k = Math.min(1, (p.life / p.max) ** p.pow);
            const a = p.a0 + p.spin * k;
            const r = p.r0 * (1 - k);
            p.ox = p.x;
            p.oy = p.y;
            p.x = p.c.x + Math.cos(a) * r;
            p.y = p.c.y + Math.sin(a) * r * p.flat;
        },
        // 땅에 닿으면 통 튐
        bounce: (p) => {
            if (p.y > p.floorY && p.vy > 0) {
                p.y = p.floorY;
                p.vy *= -0.35;
                p.vx *= 0.6;
            }
        },
        // 좌우로 하늘하늘
        sway: (p) => {
            p.x += Math.sin(p.ph + p.life * 6) * 0.35 * p.s;
        },
    };
    const DR = {
        pull: (ctx, p, t, px) => {
            const a = Math.min(1, t * 5);
            const sz = p.size;
            if (p.ox !== undefined) {
                ctx.globalAlpha = a * 0.45;
                dotAt(ctx, px, p.s, p.x + (p.ox - p.x) * 2.5, p.y + (p.oy - p.y) * 2.5, p.color, sz, sz);
            }
            ctx.globalAlpha = a;
            dotAt(ctx, px, p.s, p.x, p.y, p.color, sz, sz);
        },
        // 꼬리 달린 점
        streak: (ctx, p, t, px) => {
            const a = fadeInOut(t, 0.05, 0.45);
            const sz = p.size || 1;
            ctx.globalAlpha = a * 0.45;
            dotAt(ctx, px, p.s, p.x - p.vx * 0.035, p.y - p.vy * 0.035, p.color, sz, sz);
            ctx.globalAlpha = a;
            dotAt(ctx, px, p.s, p.x, p.y, p.color, sz, sz);
        },
        // 연기 — 커지며 옅어짐 (cols 를 차례로)
        puff: (ctx, p, t, px) => {
            const sz = Math.max(1, Math.round(p.size * (1 + t * (p.grow ?? 1.2))));
            ctx.globalAlpha = fadeInOut(t, 0.12, 0.55) * (p.a ?? 0.75);
            dotAt(ctx, px, p.s, p.x - (sz * p.s) / 2, p.y - (sz * p.s) / 2, p.cols[Math.min(p.cols.length - 1, Math.floor(t * p.cols.length))], sz, sz);
        },
        // 불똥 — 깜빡깜빡
        ember: (ctx, p, t, px) => {
            ctx.globalAlpha = fadeInOut(t, 0.05, 0.5) * (Math.sin(p.life * 31 + p.ph) > -0.4 ? 1 : 0.25);
            dotAt(ctx, px, p.s, p.x, p.y, p.color, p.size || 1, p.size || 1);
        },
        // 제자리 반짝 — 커졌다 작아짐
        twinkle: (ctx, p, t, px) => {
            ctx.globalAlpha = 1;
            drawStar(ctx, px, p.s, p.x, p.y, Math.round(p.r * Math.sin(Math.PI * k01(t))), p.cols);
        },
        // 날아가는 별 (+ · x 번갈아)
        star: (ctx, p, t, px) => {
            ctx.globalAlpha = fadeInOut(t, 0.04, 0.35);
            drawStar(ctx, px, p.s, p.x, p.y, p.r, p.cols, Math.floor(p.life / 0.07) % 2 === 1);
        },
        // 하트 — 톡 나타나 두근두근
        heart: (ctx, p, t, px) => {
            ctx.globalAlpha = fadeInOut(t, 0.05, 0.3);
            const small = p.life < 0.08 || Math.sin(p.life * 10 + p.ph) > 0.8;
            drawHeart(ctx, px, p.s, p.x, p.y, !small, p.color, '#ffffff');
        },
        leaf: (ctx, p, t, px) => {
            const flat = Math.floor(p.life / 0.08) % 2 === 0;
            ctx.globalAlpha = fadeInOut(t, 0.1, 0.3);
            dotAt(ctx, px, p.s, p.x, p.y, p.color, flat ? 2 : 1, flat ? 1 : 2);
        },
        // 번쩍 — 큰 반짝이 커졌다 작아짐
        flare: (ctx, p, t, px) => {
            ctx.globalAlpha = 1;
            const k = Math.sin(Math.PI * k01(t));
            bigSparkle(ctx, px, p.s, p.x, p.y, p.len * k, p.cols[0], p.cols[1], p.thick ?? 3);
        },
        // 퍼지는 하트 모양 고리
        heartRing: (ctx, p, t, px) => {
            const sc = p.r0 + (p.r1 - p.r0) * easeOut(t);
            ctx.globalAlpha = 1 - t;
            const n = clamp(Math.round((sc / p.s) * 4), 24, 200);
            for (let j = 0; j < n; j++) {
                const a = (j / n) * TAU;
                const hx = 16 * Math.sin(a) ** 3;
                const hy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
                dotAt(ctx, px, p.s, p.x + (hx / 16) * sc, p.y + (hy / 16) * sc, p.cols[j % p.cols.length], p.size, p.size);
            }
        },
        // 퍼지는 고리 (life 가 음수면 아직 기다림)
        ring: (ctx, p, t, px) => {
            if (p.life < 0) {
                return;
            }
            const r = p.r0 + (p.r1 - p.r0) * easeOut(t);
            ctx.globalAlpha = p.a * (1 - t);
            ringDots(ctx, px, p.s, p.x, p.y, r, p.flat, p.cols, p.step, p.size);
        },
        // 불덩이 — 하얀 속부터 식어 가며 커지고, 처음엔 빛살
        fireball: (ctx, p, t, px) => {
            const grow = easeOut(Math.min(1, p.life / 0.2));
            const R = p.R * (0.2 + 0.8 * grow) * (1 + 0.12 * t);
            const seed = Math.floor(p.life * 16);
            const fade = t > 0.4 ? Math.max(0, 1 - (t - 0.4) / 0.6) : 1;
            const cool = k01((t - 0.12) / 0.6);
            const L = [[1, p.cols[3], 0.5, 0], [0.84, p.cols[2], 0.92, 0.3], [0.64, p.cols[1], 1, 0.6], [0.44, p.cols[0], 1, 0.9], [0.24, '#ffffff', 1, 1]];
            for (let i = 0; i < L.length; i++) {
                const [m, c, a, sh] = L[i];
                const r = R * m * (1 - cool * sh);
                if (r < p.s) {
                    continue;
                }
                ctx.globalAlpha = a * fade;
                fuzzDisc(ctx, px, p.s, p.x, p.y, r, c, Math.max(p.s, r * 0.1), seed + i * 13);
            }
            if (p.rays && p.life < 0.45) {
                ctx.globalAlpha = 1 - p.life / 0.45;
                for (let j = 0; j < p.rays; j++) {
                    const a = (j / p.rays) * TAU + hash(j, 3) * 0.3;
                    const len = R * (1.3 + 1.1 * hash(j, seed));
                    const ca = Math.cos(a);
                    const sa = Math.sin(a);
                    for (let d = R * 0.5; d < len; d += p.s) {
                        const w = d < len * 0.5 ? 2 : 1;
                        dotAt(ctx, px, p.s, p.x + ca * d, p.y + sa * d, d < len * 0.7 ? '#ffffff' : p.cols[0], w, w);
                    }
                }
            }
        },
        // 화면 끝까지 뻗는 빛살
        rays: (ctx, p, t, px) => {
            ctx.globalAlpha = (1 - t) * (Math.floor(p.life / 0.05) % 2 ? 0.65 : 1);
            const n = p.n;
            for (let j = 0; j < n; j++) {
                const a = (j / n) * TAU + hash(j, 5) * 0.25 + p.a0;
                const len = p.far * (0.4 + 0.6 * easeOut(t * 3)) * (0.75 + 0.25 * hash(j, 6));
                const ca = Math.cos(a);
                const sa = Math.sin(a);
                for (let d = p.r0; d < len; d += p.s * 2) {
                    const w = d < len * 0.35 ? 3 : d < len * 0.7 ? 2 : 1;
                    dotAt(ctx, px, p.s, p.x + ca * d - ((w - 1) * p.s) / 2, p.y + sa * d - ((w - 1) * p.s) / 2, d < len * 0.5 ? '#ffffff' : p.cols[j % 2 ? 0 : 1], w, w);
                }
            }
        },
        // 그을린 땅 — 가운데가 달아올랐다 식음
        scorch: (ctx, p, t, px) => {
            ctx.globalAlpha = 0.6 * (1 - t);
            const rx = p.R * 1.1;
            const ry = Math.max(p.s * 2, p.R * 0.12);
            for (let dy = -ry; dy <= ry; dy += p.s) {
                const half = rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2));
                ctx.fillStyle = t < 0.5 && Math.abs(dy) < ry * 0.5 ? p.hot : '#1a120c';
                ctx.fillRect(px(p.x - half), px(p.y + dy), Math.max(p.s, px(2 * half)), p.s);
            }
        },
    };

    // ── 입자 만들기 ──
    function pullIn(c, r0, s, cols, max, o = {}) {
        if (!room()) {
            return;
        }
        const a0 = o.a0 ?? moveRand(0, TAU);
        const flat = o.flat ?? 1;
        sigParticle({ x: c.x + Math.cos(a0) * r0, y: c.y + Math.sin(a0) * r0 * flat, s, c, a0, r0, max, flat, spin: o.spin ?? 0, pow: o.pow ?? 2, color: movePick(cols), size: o.size ?? (Math.random() < 0.3 ? 2 : 1), update: UP.pull, draw: DR.pull });
    }
    // 튀는 조각 — ang ± spread 쪽으로 (없으면 사방)
    function spray(x, y, s, cols, n, sp0, sp1, o = {}) {
        for (let i = 0; i < n && room(); i++) {
            const a = o.spread === undefined ? moveRand(0, TAU) : (o.ang ?? 0) + moveRand(-o.spread, o.spread);
            const sp = moveRand(sp0, sp1);
            sigParticle({
                x: x + (o.jx ? moveRand(-o.jx, o.jx) : 0), y: y + (o.jy ? moveRand(-o.jy, o.jy) : 0), s,
                vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + (o.up ?? 0), g: o.g ?? 0, drag: o.drag ?? 1.5, max: moveRand(o.life0 ?? 0.35, o.life1 ?? 0.7),
                color: movePick(cols), cols: o.cols || cols, size: o.size ?? movePick([1, 1, 2]), r: o.r ?? 2, floorY: o.floorY,
                update: o.floorY !== undefined ? UP.bounce : undefined, draw: o.draw || DR.streak,
            });
        }
    }
    function ring(x, y, s, r0, r1, flat, sec, cols, o = {}) {
        sigParticle({ x, y, s, r0, r1, flat, max: sec, cols, size: o.size ?? 1, step: o.step ?? 1.5, a: o.a ?? 1, life: -(o.delay ?? 0), draw: DR.ring });
    }
    // 발밑에서 솟는 기운
    function riseAt(u, cols, Z) {
        if (!room()) {
            return;
        }
        sigParticle({ x: u.body.cx + moveRand(-1, 1) * u.R * 0.6, y: u.ground - moveRand(0, 3) * u.S, s: u.S, vx: moveRand(-6, 6) * Z, vy: -moveRand(60, 140) * Z, drag: 0.8, max: moveRand(0.35, 0.7), color: movePick(cols), size: movePick([1, 1, 2]), draw: DR.streak });
    }

    // 구체 스타일마다 튀는 것 (불티 · 그림자 연기 · 물방울 · 얼음 · 잎 · 빛)
    function orbBits(style, x, y, s, cols, n, Z, o = {}) {
        for (let i = 0; i < n && room(); i++) {
            const a = o.ang !== undefined ? o.ang + moveRand(-(o.spread ?? 0.6), o.spread ?? 0.6) : moveRand(0, TAU);
            const sp = moveRand(o.sp0 ?? 20, o.sp1 ?? 80) * (o.raw ? 1 : Z);
            const jit = o.jit ?? 0;
            const b = { x: x + moveRand(-1, 1) * jit, y: y + moveRand(-1, 1) * jit, s, vx: Math.cos(a) * sp + (o.vx ?? 0), vy: Math.sin(a) * sp + (o.vy ?? 0) };
            if (style === 'flame') {
                if (Math.random() < 0.3) {
                    sigParticle({ ...b, g: 60 * Z, drag: 1, max: moveRand(0.5, 1), color: movePick([cols[0], cols[1], '#ffffff']), ph: moveRand(0, TAU), draw: DR.ember });
                } else {
                    sigParticle({ ...b, g: -50 * Z, drag: 2.2, max: moveRand(0.3, 0.55), cols, grow: 2.5, draw: DRAW.stream });
                }
            } else if (style === 'shadow') {
                sigParticle({ ...b, vy: b.vy - 15 * Z, drag: 1.6, max: moveRand(0.5, 0.9), size: movePick([2, 2, 3]), grow: 0.8, cols: [cols[2], cols[3], '#1a0b2e'], a: 0.8, ph: moveRand(0, TAU), update: UP.sway, draw: DR.puff });
            } else if (style === 'water') {
                sigParticle({ ...b, g: 380 * Z, drag: 0.5, max: moveRand(0.4, 0.8), color: movePick(cols), size: movePick([1, 2]), draw: DR.streak });
            } else if (style === 'ice') {
                sigParticle({ ...b, g: 60 * Z, drag: 1.2, max: moveRand(0.4, 0.8), cols: ['#ffffff', '#ffffff', cols[1], cols[2]], draw: DRAW.sparkle });
            } else if (style === 'leaf') {
                sigParticle({ ...b, g: 30 * Z, drag: 1, max: moveRand(0.6, 1.1), color: movePick(cols.slice(1)), ph: moveRand(0, TAU), update: UP.sway, draw: DR.leaf });
            } else if (style === 'aura') {
                sigParticle({ ...b, drag: 2, max: moveRand(0.3, 0.6), cols, draw: DRAW.sparkle });
            } else {
                sigParticle({ ...b, drag: 2, max: moveRand(0.3, 0.6), color: movePick([...cols, '#ffffff']), size: movePick([1, 1, 2]), draw: DR.streak });
            }
        }
    }

    // 대폭발 — 튀는 조각(맨 위) · 불덩이 · 충격파 · 연기 · 불똥(여운) · 그을린 땅. R = 불덩이 반지름
    function explode(u, x, y, R, cols, o = {}) {
        const S = u.S;
        const Z = sceneScale(u);
        const ground = u.ground;
        const n = Math.round(o.n ?? 60);
        for (let i = 0; i < n && room(); i++) {
            const a = moveRand(0, TAU);
            const sp = moveRand(1.2, 3.4) * Math.min(R, 260) + 60 * Z;
            sigParticle({ x, y, s: S, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60 * Z, g: 380 * Z, drag: 1.6, max: moveRand(0.6, 1.2), color: movePick(o.debris || [...cols, '#ffffff']), size: movePick([1, 2, 2, 3]), floorY: ground, update: UP.bounce, draw: DR.streak });
        }
        if (o.style) {
            orbBits(o.style, x, y, S, cols, Math.round(n * 0.6), Z, { sp0: Math.min(R, 200) * 0.8, sp1: Math.min(R, 200) * 2.4, raw: true });
        }
        part({ x, y, s: S, max: o.sec ?? 0.9, R, cols, rays: o.rays ?? 14, draw: DR.fireball });
        ring(x, y, S, R * 0.3, R * 2.3, 1, 0.5, ['#ffffff', cols[0], '#ffffff'], { size: 2 });
        ring(x, y, S, R * 0.4, R * 1.7, 0.85, 0.75, [cols[1], cols[2]], { delay: 0.08 });
        if (ground - y < R * 1.5) {
            ring(x, ground - S, S, R * 0.5, R * 3.4, clamp(14 / (R * 3.4), 0.04, 0.2), 0.8, [cols[1], '#ffffff', cols[2]], { size: 2 });
        }
        for (let i = 0; i < (o.smoke ?? 14) && room(); i++) {
            const a = moveRand(0, TAU);
            const rr = moveRand(0.2, 0.8) * R;
            sigParticle({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr * 0.7, s: S, vx: Math.cos(a) * moveRand(5, 25) * Z, vy: -moveRand(10, 35) * Z, drag: 0.6, max: moveRand(1.0, 1.7), size: Math.round(moveRand(3, 6)), grow: 1, cols: ['#d9d9d9', '#a8a8a8', '#7a7a7a', '#4a4a4a'], a: 0.55, draw: DR.puff });
        }
        for (let i = 0; i < (o.embers ?? 24) && room(); i++) {
            sigParticle({ x: x + moveRand(-1, 1) * R, y: y + moveRand(-0.6, 0.6) * R, s: S, vx: moveRand(-20, 20) * Z, vy: -moveRand(20, 70) * Z, drag: 0.5, max: moveRand(0.9, 1.8), color: movePick([cols[0], cols[1], '#ffffff']), ph: moveRand(0, TAU), draw: DR.ember });
        }
        if (ground - y < R * 1.4) {
            part({ x, y: ground - S, s: S, max: (o.sec ?? 0.9) + 0.9, R: Math.min(R, u.W * 0.6), hot: cols[2], draw: DR.scorch });
        }
    }

    // ══════════ ultbeam — 모으기(빛이 빨려 듦 · 구슬 두근 · 몸 떨림) → 화면 끝까지 굵은 광선 → 가늘어지며 빛가루로 ══════════
    const beamCharge = (o) => clamp((o.charge ?? 0.9) * 1000, 300, 1600);

    function runBeam(u, o, ms, pokemon) {
        const P = strength(u);
        const Z = sceneScale(u);
        const { S, W, H, dir } = u;
        const el = pokemon?.el;
        const base = o.c || (o.solar ? 'solar' : 'hyper');
        const cols = sigPal(base);
        const spk = sigPal(o.sparkle || base);
        const total = ms / 1000;
        const charge = Math.min(beamCharge(o), ms * 0.34) / 1000;
        const fire = Math.max(0.8, total - charge);
        const fadeAt = fire - Math.min(0.6, fire * 0.3); // 여기서부터 가늘어짐
        const T = clamp(H * 0.2 * (o.width ?? 1) * (0.9 + 0.25 * P), 14, H * 0.5); // 굵기 — 패널 높이의 1/5 넘게
        const dbl = !!o.double;
        const Tb = dbl ? T * 0.64 : T; // 한 줄 굵기
        const sep = dbl ? T * 0.52 : 0; // 두 줄이 가운데서 떨어진 정도
        // 입 앞 빛 구 — 포켓몬 크기에 맞춰 작게 (빔 굵기에 맞추면 쓰는 애를 통째로 가림)
        // 빛 구 크기는 실제 그림 너비로 (작은 애는 작게 — 겉 빛까지 1.45배라 쓰는 애를 덮지 않게), 입보다 조금 앞에 (2026-10-19)
        const orbR = Math.max(2.5 * S, Math.min(T * 0.6, u.w * 0.22));
        const ox = u.mouth.x + dir * Math.max(2 * S, orbR * 1.3);
        const oy = u.mouth.y;
        const reach = Math.max(1, dir > 0 ? W - ox : ox);
        const span = sep + Tb * 0.68;
        const yFar = Math.max(Math.min(oy, u.ground - span), Math.min(span, H * 0.5)); // 땅에 묻히지 않는 높이 — 입이 땅에 가까우면 입 앞 위쪽에서 쏨
        const yMouth = Math.min(oy, u.ground - orbR * 1.3);
        const flare = T * 1.4; // 물결(wave)이 이 거리까지 서서히 커짐
        // 나팔 모양 — 빛 구에서 가늘게 시작해 spreadL 동안 굵어지고, 높이도 입에서 광선 높이로 부드럽게
        const spreadL = Math.max(T * 1.6, orbR * 6);
        const spreadK = (d) => smooth(d / spreadL);
        const th0 = clamp((orbR * 1.3) / Tb, 0.2, 1);
        const lineY = (d) => lerp(yMouth, yFar, smooth(d / (spreadL * 1.1)));
        const offAt = (d) => (dbl ? sep * lerp(th0, 1, spreadK(d)) : 0);
        const waveAt = (d, f) => (o.wave ? Math.sin(d / (T * 0.5) - f * 15) * T * 0.22 * smooth(d / flare) : 0);
        const thAt = (d) => Tb * (1 + (0.1 * d) / reach) * lerp(th0, 1, spreadK(d)); // 멀리 갈수록 아주 살짝 넓게
        const lines = dbl ? [-1, 1] : [0];
        const speed = Math.max(1500, W * 3.6);
        const C = { x: ox, y: yMouth }; // 모이는 곳 — 입 앞
        const flash = overlay(total);
        const beats = [0.3, 0.55, 0.76];
        const st = { fired: false, acc: 0, aura: 0, beats: 0, arcs: [], nextArc: 0, rings: [], nextRing: 0, spray: 0, edge: 0, dust: 0, hit: new Set(), nextHit: 0, gone: false, sc: 1 };
        const ys = [];
        const hs = [];
        const layers = [[1.35, cols[3], 0.32], [1, cols[2], 0.95], [0.74, cols[1], 1], [0.5, cols[0], 1], [0.24, '#ffffff', 1]];

        // 모으는 구슬 크기 — 커지며 세 번 두근, 끝에 확 움츠러듦
        const chargeR = (k, life) => {
            let r = orbR * (0.12 + 0.88 * smooth(k / 0.85));
            for (const b of beats) {
                const d = (k - b) / 0.07;
                if (d > 0 && d < 1) {
                    r *= 1 + 0.35 * Math.sin(d * Math.PI);
                }
            }
            if (k > 0.88) {
                r *= 1 - 0.5 * ((k - 0.88) / 0.12);
            }
            return r * (1 + 0.08 * Math.sin(life * 40));
        };
        const chargeTick = (dt, k, life) => {
            st.acc += dt * (55 + 70 * P) * (1 + 2.6 * k) * Math.min(1.5, Z);
            while (st.acc >= 1) {
                st.acc -= 1;
                if (o.solar && Math.random() < 0.55) {
                    // 하늘 햇빛 기둥에서 내려옴
                    pullIn(C, moveRand(0.4, 1) * Math.max(C.y, 30), S, ['#ffffff', ...cols], moveRand(0.35, 0.5), { a0: -Math.PI / 2 + moveRand(-0.2, 0.2), pow: 1.6 });
                } else {
                    pullIn(C, Math.max(T * 1.3, u.R * 1.4) * moveRand(0.9, 1.8), S, [...cols, '#ffffff'], moveRand(0.26, 0.4) * (1 - 0.35 * k), { spin: dir * moveRand(0.3, 0.9) });
                }
            }
            st.aura += dt * (20 + 30 * k);
            while (st.aura >= 1) {
                st.aura -= 1;
                riseAt(u, cols, Z);
            }
            while (st.beats < beats.length && k >= beats[st.beats]) {
                st.beats += 1;
                const r = orbR * (0.5 + 0.25 * st.beats);
                ring(C.x, C.y, S, r * 4, r * 0.8, 1, 0.28, [cols[0], '#ffffff', cols[2]]);
                spray(C.x, C.y, S, [...cols, '#ffffff'], 10, 60 * Z, 140 * Z, { drag: 3 });
                ultShake(1 + st.beats * 0.6, 160);
                tremble(el, 0.4 * S * st.beats, 220);
            }
            // 구슬 둘레 번개 — 0.07초마다 새로
            if (life >= st.nextArc) {
                st.nextArc = life + 0.07;
                st.arcs = [];
                if (k > 0.3) {
                    for (let j = 0; j < 2; j++) {
                        const a = moveRand(0, TAU);
                        const r0 = chargeR(k, life) * 1.2;
                        const r1 = r0 + orbR * moveRand(1, 2);
                        st.arcs.push(zigzag(C.x + Math.cos(a) * r0, C.y + Math.sin(a) * r0, C.x + Math.cos(a) * r1, C.y + Math.sin(a) * r1, S, 1.5));
                    }
                }
            }
        };
        const drawCharge = (ctx, px, k, life) => {
            speedLines(ctx, px, S, C.x, C.y, Math.max(T * 1.5, 50) * (1.5 - 0.5 * k), Math.max(W, H), 22, cols[0], life, 0.08 + 0.3 * k);
            orbGlow(ctx, px, S, C.x, C.y, chargeR(k, life), cols, life, 0.4 + 0.6 * k, k > 0.88);
            ctx.globalAlpha = 1;
            st.arcs.forEach((a) => zapLine(ctx, px, S, a, 1, cols[1]));
        };

        // 펑 — 하얗게 번쩍 · 흔들림 · 반동 · 충격파 · 앞으로 튀는 빛
        const release = () => {
            const y0 = lineY(0);
            flash('#ffffff', 0.85, 0.28, 0.04);
            ultShake(4 + 3 * P, 500);
            later(350, () => ultShake(2 + P, Math.max(300, (fadeAt - 0.35) * 1000)));
            el?.animate?.([{ translate: `${-dir * 6 * S}px 0` }, { translate: '0 0' }], { duration: 420, easing: 'ease-out', composite: 'add' });
            tremble(el, 0.5 * S, fadeAt * 1000);
            ring(ox, y0, S, orbR, T * 2.4, 1, 0.45, ['#ffffff', cols[0], cols[1]], { size: 2 });
            ring(ox, y0, S, orbR, T * 3.6, 0.6, 0.6, [cols[1], cols[2], '#ffffff'], { delay: 0.06 });
            ring(ox + dir * T * 0.3, y0, S, S * 2, T * 0.55, 2.2, 0.35, ['#ffffff', cols[0]]);
            spray(ox, y0, S, [...cols, '#ffffff'], 40 + 30 * P, 160 * Z, 420 * Z, { ang: dir > 0 ? 0 : Math.PI, spread: 0.9, drag: 2.2, life0: 0.3, life1: 0.6, size: movePick([1, 2]) });
        };

        const beamTick = (dt, f) => {
            const front = Math.min(reach, f * speed);
            const live = f < fadeAt;
            const at = (d, ln) => lineY(d) + ln * offAt(d) + waveAt(d, f);
            // 따라 나가는 고리
            if (live && f >= st.nextRing) {
                st.nextRing = f + 0.07;
                st.rings.push(f);
            }
            st.rings = st.rings.filter((b) => (f - b) * speed * 0.5 < reach + T);
            // 흩날리는 빛
            if (f < fadeAt + 0.15) {
                st.spray = Math.min(8, st.spray + dt * (130 + 110 * P) * Z);
                while (st.spray >= 1 && room()) {
                    st.spray -= 1;
                    const d = Math.random() * front;
                    const side = Math.random() < 0.5 ? -1 : 1;
                    const y = at(d, movePick(lines)) + side * thAt(d) * st.sc * 0.5;
                    sigParticle({ x: ox + dir * d, y, s: S, vx: dir * moveRand(30, 160) * Z, vy: side * moveRand(30, 150) * Z, drag: 2.2, max: moveRand(0.3, 0.6), cols: spk, draw: DRAW.sparkle });
                }
            }
            // 화면 끝 — 부딪혀 튀는 빛
            if (front >= reach && live) {
                st.edge = Math.min(6, st.edge + dt * 90 * Z);
                while (st.edge >= 1 && room()) {
                    st.edge -= 1;
                    const y = at(reach, movePick(lines)) + moveRand(-0.5, 0.5) * thAt(reach) * st.sc;
                    const a = (dir > 0 ? Math.PI : 0) + moveRand(-1.2, 1.2);
                    const sp = moveRand(80, 300) * Z;
                    sigParticle({ x: dir > 0 ? W - S : S, y, s: S, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 300 * Z, drag: 1.2, max: moveRand(0.35, 0.7), color: movePick([...cols, ...spk, '#ffffff']), size: movePick([1, 2, 2]), draw: DR.streak });
                }
            }
            // 광선 밑 땅 먼지
            const yb = lineY(front * 0.5) + thAt(front * 0.5) * 0.7;
            if (live && u.ground - yb < T * 1.2) {
                st.dust = Math.min(4, st.dust + dt * 40 * Z);
                while (st.dust >= 1 && room()) {
                    st.dust -= 1;
                    sigParticle({ x: ox + dir * Math.random() * front, y: u.ground - S, s: S, vx: dir * moveRand(10, 60) * Z, vy: -moveRand(40, 120) * Z, g: 200 * Z, drag: 1, max: moveRand(0.4, 0.7), color: movePick([cols[3], cols[2], '#9a9a9a']), size: movePick([1, 2]), draw: DR.streak });
                }
            }
            // 광선에 닿은 포켓몬 — 벌러덩
            if (live && f >= st.nextHit) {
                st.nextHit = f + 0.05;
                for (const q of u.others()) {
                    if (st.hit.has(q.pokemon)) {
                        continue;
                    }
                    const qd = (q.x - ox) * dir;
                    if (qd < -q.w / 2 || qd - q.w / 2 > front) {
                        continue;
                    }
                    const d = clamp(qd, 0, reach);
                    const half = sep + thAt(d) * st.sc * 0.5;
                    if (Math.abs(q.y - (lineY(d) + waveAt(d, f))) > half + q.h / 2 + 4) {
                        continue;
                    }
                    st.hit.add(q.pokemon);
                    ultHit(q, dir, 'tumble');
                    sigImpact(q.x, q.y, S, ['#ffffff', cols[0], cols[1], cols[2]], 1, true);
                    ring(q.x, q.y, S, 2 * S, Math.max(q.w, 20) * 1.6, 1, 0.4, ['#ffffff', cols[1]]);
                    spray(q.x, q.y, S, [...cols, '#ffffff'], 18, 80 * Z, 240 * Z, { g: 250 * Z, drag: 1 });
                }
            }
            // 사라지며 빛가루
            if (!st.gone && f >= fire - Math.min(0.35, fire * 0.15)) {
                st.gone = true;
                const n = Math.min(170, CAP - moveParticles.length);
                for (let i = 0; i < n; i++) {
                    const d = Math.random() * front;
                    const y = at(d, movePick(lines)) + moveRand(-0.5, 0.5) * thAt(d) * 0.6;
                    sigParticle({ x: ox + dir * d, y, s: S, vx: dir * moveRand(5, 40) * Z, vy: moveRand(-40, 20) * Z, drag: 1, max: moveRand(0.4, 0.9), cols: Math.random() < 0.5 ? spk : cols, draw: DRAW.sparkle });
                }
            }
        };

        // 나선 띠 — 광선을 감고 돎 (뒤쪽은 광선 밑, 앞쪽은 위)
        const spiralPass = (ctx, px, f, front, n, frontSide, alpha) => {
            const pitch = T * 0.32;
            for (let strand = 0; strand < 2; strand++) {
                ctx.globalAlpha = alpha * (frontSide ? 1 : 0.7);
                const c = frontSide ? (strand ? '#ffffff' : spk[1]) : strand ? cols[2] : spk[2];
                const sz = frontSide ? 2 : 1;
                for (let d = flare * 0.3; d < front; d += S) {
                    const ph = d / pitch - f * 13 + strand * Math.PI;
                    const depth = Math.cos(ph);
                    if (depth > 0 !== frontSide) {
                        continue;
                    }
                    const i = Math.min(n - 1, Math.floor(d / (2 * S)));
                    const y = ys[i] + Math.sin(ph) * hs[i] * 1.38;
                    const w = frontSide && depth > 0.5 ? sz + 1 : sz;
                    if (frontSide) {
                        // 테두리 (진한 색) — 밝은 광선 위에서도 띠가 보이게
                        dotAt(ctx, px, S, ox + dir * d - (w * S) / 2, y - (w * S) / 2 - S, cols[3], w, 1);
                    }
                    dotAt(ctx, px, S, ox + dir * d - ((w - 1) * S) / 2, y - ((w - 1) * S) / 2, c, w, w);
                }
            }
        };
        const drawBeam = (ctx, px, f) => {
            const front = Math.min(reach, f * speed);
            const burst = 1 + 0.5 * Math.max(0, 1 - f / 0.22);
            const pulse = 1 + 0.07 * Math.sin(f * 44) + 0.04 * Math.sin(f * 97);
            const e = f > fadeAt ? k01((f - fadeAt) / (fire - fadeAt)) : 0;
            st.sc = burst * pulse * Math.max(0.04, (1 - e) ** 1.6);
            const alpha = e > 0.6 ? (1 - e) / 0.4 : 1;
            if (alpha <= 0.01) {
                return;
            }
            // 광선 빛이 화면을 물들임 (모든 것 밑에 깔림) — 합동 줄기 보기 캔버스에 그릴 때는 뺌 (앞끝 · 계단으로 잘려 회색 네모 — #80 진단 ④, ult/bridge.js)
            if (typeof fxViewDrawing === 'undefined' || !fxViewDrawing) {
                ctx.globalCompositeOperation = 'destination-over';
                ctx.globalAlpha = (0.07 + 0.03 * Math.sin(f * 40)) * alpha;
                ctx.fillStyle = o.rainbow ? hue(f * 300, 60) : cols[1];
                ctx.fillRect(0, 0, W, H);
                ctx.globalCompositeOperation = 'source-over';
            }
            const seg = 2 * S;
            const n = Math.max(1, Math.ceil(front / seg));
            const tick = Math.floor(f * 30);
            for (const ln of lines) {
                for (let i = 0; i < n; i++) {
                    const d = i * seg;
                    ys[i] = lineY(d) + ln * offAt(d) + waveAt(d, f);
                    hs[i] = thAt(d) * st.sc * 0.5; // 곧게 — 흐르는 느낌은 속 빛줄 · 고리로 (굵기를 출렁이면 넓은 패널에서 구불구불해 보임)
                }
                if (o.spiral) {
                    spiralPass(ctx, px, f, front, n, false, alpha);
                }
                // 겹겹 빛줄기 — 바깥 두 겹은 가장자리가 지글지글
                for (let li = 0; li < layers.length; li++) {
                    const [m, col, a] = layers[li];
                    ctx.globalAlpha = a * alpha;
                    ctx.fillStyle = o.rainbow && li >= 3 ? '#ffffff' : col;
                    for (let i = 0; i < n; i++) {
                        const h = hs[i] * m + (li < 2 ? (hash(i, tick + li * 7) - 0.5) * 2.5 * S : 0);
                        if (h < S * 0.5) {
                            continue;
                        }
                        if (o.rainbow && li < 3) {
                            ctx.fillStyle = hue(((i * seg) / S) * 5 - f * 700 + li * 40, [45, 58, 72][li]);
                        }
                        const x = dir > 0 ? ox + i * seg : ox - i * seg - seg;
                        const top = px(ys[i] - h);
                        ctx.fillRect(px(x), top, seg, Math.max(S, px(ys[i] + h) - top));
                    }
                }
                // 빠르게 흐르는 빛줄 — 하얀 속엔 진한 줄, 바깥 겹엔 하얀 줄
                ctx.globalAlpha = 0.9 * alpha;
                for (let j = 0; j < 18; j++) {
                    const core = j % 3 === 0;
                    const len = (5 + hash(j, 2) * 12) * S;
                    const d = (hash(j, 4) * reach + f * speed * (0.45 + hash(j, 3) * 0.5)) % Math.max(front, 1);
                    const i = Math.min(n - 1, Math.floor(d / seg));
                    const off = core ? (hash(j, 1) - 0.5) * 0.5 : (hash(j, 1) < 0.5 ? -1 : 1) * (0.55 + 0.4 * hash(j, 5));
                    ctx.fillStyle = core ? (o.rainbow ? hue(j * 40 + f * 500, 60) : cols[2]) : '#ffffff';
                    ctx.fillRect(px(dir > 0 ? ox + d : ox - d - len), px(ys[i] + off * hs[i]), len, S);
                }
                // 속 반짝
                ctx.globalAlpha = alpha;
                for (let j = 0; j < 5; j++) {
                    const d = Math.random() * front;
                    const i = Math.min(n - 1, Math.floor(d / seg));
                    drawStar(ctx, px, S, ox + dir * d, ys[i] + (Math.random() - 0.5) * 1.5 * hs[i], Math.random() < 0.3 ? 2 : 1, spk);
                }
                // 광선을 따라 나가며 커지는 고리
                for (const b of st.rings) {
                    const d = (f - b) * speed * 0.5;
                    if (d > front) {
                        continue;
                    }
                    const i = Math.min(n - 1, Math.floor(d / seg));
                    const ry = hs[i] * 1.5 + 3 * S;
                    ctx.globalAlpha = alpha * (1 - (0.6 * d) / reach);
                    const m = Math.max(16, Math.round(ry / S) * 3);
                    for (let q = 0; q < m; q++) {
                        const a = (q / m) * TAU;
                        dotAt(ctx, px, S, ox + dir * d + Math.cos(a) * 3 * S, ys[i] + Math.sin(a) * ry, q % 2 ? '#ffffff' : o.rainbow ? hue(q * 30 + f * 600, 62) : cols[2]);
                    }
                }
                if (o.spiral) {
                    spiralPass(ctx, px, f, front, n, true, alpha);
                }
                const ie = n - 1;
                if (front < reach) {
                    // 앞머리 빛 덩어리
                    discs(ctx, px, S, ox + dir * front, ys[ie], hs[ie] * 1.25, [[1, cols[1], 1], [0.65, cols[0], 1], [0.35, '#ffffff', 1]], alpha);
                } else if (f < fadeAt + 0.1) {
                    // 화면 끝에 부딪혀 튐
                    const ex = dir > 0 ? W : 0;
                    const er = hs[ie] * (1.4 + 0.25 * Math.random());
                    discs(ctx, px, S, ex, ys[ie], er, [[1.25, cols[3], 0.4], [1, cols[2], 0.9], [0.75, cols[1], 1], [0.5, cols[0], 1], [0.28, '#ffffff', 1]], alpha);
                    ctx.globalAlpha = alpha;
                    for (let j = 0; j < 9; j++) {
                        const a = (dir > 0 ? Math.PI : 0) + (j - 4) * 0.33 + (Math.random() - 0.5) * 0.2;
                        const len = er * (1.3 + Math.random() * 1.2);
                        for (let d = er * 0.8; d < len; d += S) {
                            const w = d < len * 0.55 ? 2 : 1;
                            dotAt(ctx, px, S, ex + Math.cos(a) * d, ys[ie] + Math.sin(a) * d, d < len * 0.6 ? '#ffffff' : cols[1], w, w);
                        }
                    }
                }
            }
            // 입 앞 구슬
            const r = orbR * (0.6 + 0.4 * st.sc) * (1 + 0.1 * Math.sin(f * 50)) * alpha;
            orbGlow(ctx, px, S, ox, lineY(0), r, cols, f, alpha, true);
        };

        part({ x: ox, y: C.y, s: S, max: total + 0.05,
            update: (p, dt) => {
                if (p.life < charge) {
                    chargeTick(dt, p.life / charge, p.life);
                    return;
                }
                if (!st.fired) {
                    st.fired = true;
                    st.arcs = [];
                    release();
                }
                beamTick(dt, p.life - charge);
            },
            draw: (ctx, p, t, px) => {
                if (p.life < charge) {
                    drawCharge(ctx, px, p.life / charge, p.life);
                } else {
                    drawBeam(ctx, px, p.life - charge);
                }
            },
        });
        // 솔라 — 하늘에서 햇빛 기둥이 내려와 모임 (밖은 더 어둡게)
        if (o.solar) {
            const hw = Math.max(u.R * 0.8, T * 0.7);
            const sx = u.body.cx;
            const yb = u.ground;
            part({ x: sx, y: 0, s: S, max: charge + 0.7, draw: (ctx, p, t, px) => {
                // 합동 줄기 보기 캔버스면 뺌 — 화면 높이 어둠 · 빛기둥이 앞끝 · 계단으로 잘려 맞은 뒤 한 장면 네모 (#80 넷째 바퀴 · bugs #758). 합동은 제 어둠이 있음
                if (typeof fxViewDrawing !== 'undefined' && fxViewDrawing) {
                    return;
                }
                const k = smooth(p.life / charge);
                const a = p.life > charge ? Math.max(0, 1 - (p.life - charge) / 0.7) : 1;
                const x0 = px(sx - hw);
                const x1 = px(sx + hw);
                ctx.globalCompositeOperation = 'destination-over';
                ctx.globalAlpha = 0.35 * k * a;
                ctx.fillStyle = '#05080f';
                ctx.fillRect(0, 0, x0, H);
                ctx.fillRect(x1, 0, W - x1, H);
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = (0.1 + 0.22 * k) * a;
                ctx.fillStyle = '#fff6a8';
                ctx.fillRect(x0, 0, x1 - x0, yb);
                ctx.globalAlpha = (0.1 + 0.3 * k) * a;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(px(sx - hw * 0.35), 0, px(hw * 0.7), yb);
                const tick = Math.floor(p.life * 12);
                for (let j = 0; j < 7; j++) {
                    ctx.globalAlpha = (0.15 + 0.25 * hash(j, tick)) * k * a;
                    ctx.fillRect(px(sx + (hash(j, 9) - 0.5) * 1.8 * hw + Math.sin(p.life * 3 + j) * S * 2), 0, S, yb);
                }
                const sr = hw * (0.7 + 0.1 * Math.sin(p.life * 8));
                discs(ctx, px, S, sx, 0, sr, [[1.6, '#fff6a8', 0.25], [1.2, '#fffbd0', 0.6], [0.85, '#ffffff', 1]], k * a);
                ctx.globalAlpha = 0.6 * k * a;
                ringDots(ctx, px, S, sx, yb - S, hw * (0.9 + 0.1 * Math.sin(p.life * 10)), 0.22, ['#fffbd0', '#ffffff'], 1.5, 1);
            } });
        }
    }

    // ══════════ ultorb — 머리 위에서 거대한 구체를 키워 던짐 → 대폭발 / sky: 하늘 높이 올라가 커지다 화면 전체 폭발 ══════════
    const ORB_C = { energy: 'gold', flame: 'fire', shadow: 'ghost', aura: 'aura', water: 'water', ice: 'ice', leaf: 'grass' };

    // 구체 둘레를 도는 잎 (front 면 앞쪽만)
    function orbLeaves(ctx, px, s, x, y, r, cols, life, alpha, front) {
        ctx.globalAlpha = alpha;
        const big = r > 14 * s ? 2 : 1;
        for (let j = 0; j < 20; j++) {
            const a = life * 3 + (j * TAU) / 20;
            const depth = Math.sin(a);
            if (depth > 0 !== front) {
                continue;
            }
            const rr = r * (1.35 + 0.15 * Math.sin(j * 2.3));
            const flat = Math.floor(life / 0.08 + j) % 2 === 0;
            dotAt(ctx, px, s, x + Math.cos(a) * rr, y + depth * rr * 0.35 - Math.cos(a) * rr * 0.12, front ? (j % 3 ? cols[1] : cols[0]) : cols[3], (flat ? 2 : 1) * big, (flat ? 1 : 2) * big);
        }
    }
    // 구체 — 스타일마다
    function drawOrb(ctx, px, s, x, y, r, style, cols, life, alpha = 1) {
        if (r < s) {
            ctx.globalAlpha = alpha;
            dotAt(ctx, px, s, x, y, cols[0]);
            return;
        }
        const seed = Math.floor(life * 14);
        const spin = life * 3;
        if (style === 'leaf') {
            orbLeaves(ctx, px, s, x, y, r, cols, life, alpha, false);
        }
        if (style === 'flame') {
            ctx.globalAlpha = 0.35 * alpha;
            fuzzDisc(ctx, px, s, x, y - r * 0.1, r * 1.3, cols[3], r * 0.14 + s, seed);
            ctx.globalAlpha = alpha;
            fuzzDisc(ctx, px, s, x, y, r * 1.04, cols[3], r * 0.1 + s, seed + 1);
            fuzzDisc(ctx, px, s, x, y + r * 0.03, r * 0.86, cols[2], r * 0.08 + s, seed + 2);
            fuzzDisc(ctx, px, s, x, y + r * 0.08, r * 0.62, cols[1], r * 0.06, seed + 3);
            fuzzDisc(ctx, px, s, x, y + r * 0.12, r * 0.36, cols[0], s, seed + 4);
            // 위로 날름거리는 불꽃 혀
            const w0 = Math.max(1, Math.round((r * 0.24) / s));
            for (let j = 0; j < 7; j++) {
                const a = -Math.PI / 2 + (j - 3) * 0.34;
                const len = r * (0.35 + 0.55 * hash(j, seed));
                const bx = x + Math.cos(a) * r * 0.82;
                const by = y + Math.sin(a) * r * 0.82;
                for (let k = 0; k < len; k += s) {
                    const w = Math.max(1, Math.round(w0 * (1 - k / len)));
                    dotAt(ctx, px, s, bx - (w * s) / 2 + Math.sin(life * 18 + j * 1.7 + k / (3 * s)) * s, by - k, k < len * 0.45 ? cols[2] : cols[3], w, 1);
                }
            }
        } else if (style === 'shadow') {
            ctx.globalAlpha = 0.45 * alpha;
            fuzzDisc(ctx, px, s, x, y, r * 1.32, cols[2], r * 0.16 + s, seed);
            discs(ctx, px, s, x, y, r, [[1.04, cols[1], 1], [0.95, cols[3], 1], [0.8, '#1a0b2e', 1], [0.52, '#060208', 1]], alpha);
            // 속 소용돌이 (보라)
            ctx.globalAlpha = 0.9 * alpha;
            for (let j = 0; j < 4; j++) {
                for (let k = 3; k < 12; k++) {
                    const a = -spin * 1.4 + (j * TAU) / 4 + k * 0.4;
                    const rr = (r * 0.9 * k) / 12;
                    dotAt(ctx, px, s, x + Math.cos(a) * rr, y + Math.sin(a) * rr, k > 8 ? cols[1] : k > 5 ? cols[2] : cols[3], k > 8 ? 2 : 1, 1);
                }
            }
            ctx.globalAlpha = alpha;
            ringDots(ctx, px, s, x, y, r * 1.02, 1, [cols[0], cols[1], cols[3], cols[3]], 1.4, 1, -life * 2);
        } else if (style === 'aura') {
            for (let j = 0; j < 3; j++) {
                const ph = (life * 2.2 + j / 3) % 1;
                ctx.globalAlpha = (1 - ph) * 0.8 * alpha;
                ringDots(ctx, px, s, x, y, r * (1.05 + 1.3 * ph), 1, [cols[1], cols[0], cols[2]], 2, 1);
            }
            ctx.globalAlpha = 0.35 * alpha;
            fuzzDisc(ctx, px, s, x, y, r * 1.22, cols[2], r * 0.08 + s, seed);
            discs(ctx, px, s, x, y, r, [[1, cols[3], 1], [0.86, cols[2], 1], [0.62, cols[1], 1], [0.38, cols[0], 1], [0.18, '#ffffff', 1]], alpha, 0.3);
            ctx.globalAlpha = alpha;
            for (let j = 0; j < 2; j++) {
                const a = hash(j, seed) * TAU;
                zapLine(ctx, px, s, zigzag(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9, x + Math.cos(a) * r * 1.6, y + Math.sin(a) * r * 1.6, s, 1.5), 1, cols[1]);
            }
        } else if (style === 'water') {
            ctx.globalAlpha = 0.3 * alpha;
            wobDisc(ctx, px, s, x, y, r * 1.25, cols[2], 0.08, life);
            ctx.globalAlpha = alpha;
            wobDisc(ctx, px, s, x, y, r, cols[3], 0.06, life);
            wobDisc(ctx, px, s, x, y, r * 0.86, cols[2], 0.06, life + 1);
            wobDisc(ctx, px, s, x, y, r * 0.62, cols[1], 0.05, life + 2);
            sigDisc(ctx, px, s, x - r * 0.1, y - r * 0.1, r * 0.34, cols[0]);
            // 속에서 도는 물살 · 떠오르는 거품
            ctx.globalAlpha = 0.9 * alpha;
            for (let k = 0; k < 24; k++) {
                const a = spin * 2 + k * 0.5;
                const rr = r * (0.25 + (0.65 * k) / 24);
                dotAt(ctx, px, s, x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8, '#ffffff');
            }
            for (let j = 0; j < 5; j++) {
                const ph = (life * 0.8 + hash(j, 1)) % 1;
                const bx = x + (hash(j, 2) - 0.5) * r * 1.1;
                const by = y + r * 0.7 - ph * r * 1.4;
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    dotAt(ctx, px, s, bx + dx * s, by + dy * s, cols[0]);
                }
            }
        } else if (style === 'ice') {
            ctx.globalAlpha = alpha;
            for (let j = 0; j < 8; j++) {
                const a = life * 0.6 + (j * TAU) / 8;
                const len = r * (j % 2 ? 1.45 : 1.75);
                const ca = Math.cos(a);
                const sa = Math.sin(a);
                for (let d = r * 0.7; d < len; d += s) {
                    const w = Math.max(1, Math.round(((len - d) / (len - r * 0.7)) * 2.5));
                    dotAt(ctx, px, s, x + ca * d - ((w - 1) * s) / 2, y + sa * d - ((w - 1) * s) / 2, d > len * 0.8 ? '#ffffff' : cols[1], w, w);
                }
            }
            ctx.globalAlpha = 0.3 * alpha;
            sigDisc(ctx, px, s, x, y, r * 1.25, cols[2]);
            discs(ctx, px, s, x, y, r, [[1, cols[3], 1], [0.86, cols[2], 1], [0.64, cols[1], 1], [0.36, cols[0], 1]], alpha, 0.3);
            ctx.globalAlpha = 0.85 * alpha;
            for (let k = -r * 0.6; k < r * 0.6; k += s) {
                dotAt(ctx, px, s, x + k, y - k * 0.5 - r * 0.1, '#ffffff');
            }
            for (let k = -r * 0.4; k < r * 0.5; k += s) {
                dotAt(ctx, px, s, x + k * 0.3 + r * 0.2, y + k, cols[0]);
            }
            ctx.globalAlpha = alpha;
            drawStar(ctx, px, s, x + Math.cos(life * 5) * r * 1.2, y + Math.sin(life * 5) * r * 1.2, 2, ['#ffffff', '#ffffff', cols[1], cols[2]]);
        } else if (style === 'leaf') {
            ctx.globalAlpha = 0.3 * alpha;
            fuzzDisc(ctx, px, s, x, y, r * 1.25, cols[2], r * 0.1, seed);
            discs(ctx, px, s, x, y, r, [[1, cols[3], 1], [0.84, cols[2], 1], [0.6, cols[1], 1], [0.34, cols[0], 1], [0.15, '#ffffff', 1]], alpha, 0.3);
            ctx.globalAlpha = 0.8 * alpha;
            for (let j = 0; j < 3; j++) {
                for (let k = 2; k < 11; k++) {
                    const a = spin + (j * TAU) / 3 + k * 0.28;
                    const rr = (r * 0.9 * k) / 11;
                    dotAt(ctx, px, s, x + Math.cos(a) * rr, y + Math.sin(a) * rr, cols[3]);
                }
            }
        } else {
            // 기본 에너지 — 지글거리는 겉불 · 입체 겹 원 · 도는 빛 팔 · 속 번개
            ctx.globalAlpha = 0.45 * alpha;
            fuzzDisc(ctx, px, s, x, y, r * 1.2, cols[2], r * 0.07 + s, seed);
            discs(ctx, px, s, x, y, r, [[1, cols[3], 1], [0.88, cols[2], 1], [0.66, cols[1], 1], [0.42, cols[0], 1], [0.2, '#ffffff', 1]], alpha, 0.35);
            ctx.globalAlpha = 0.9 * alpha;
            for (let j = 0; j < 3; j++) {
                for (let k = 2; k < 14; k++) {
                    const a = spin * 1.8 + (j * TAU) / 3 + k * 0.3;
                    const rr = (r * 0.95 * k) / 14;
                    dotAt(ctx, px, s, x + Math.cos(a) * rr, y + Math.sin(a) * rr, k < 7 ? cols[2] : '#ffffff', k < 10 ? 2 : 1, k < 10 ? 2 : 1);
                }
            }
            ctx.globalAlpha = alpha;
            for (let j = 0; j < 2; j++) {
                const a = hash(j, seed) * TAU;
                const b = a + 2 + hash(j + 5, seed) * 1.5;
                zapLine(ctx, px, s, zigzag(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75, x + Math.cos(b) * r * 0.75, y + Math.sin(b) * r * 0.75, s, 1.5), 1, cols[1]);
            }
            ringDots(ctx, px, s, x, y, r * 1.12, 1, [cols[0], cols[2], cols[1]], 3, 1, life * 4);
        }
        if (style !== 'shadow') {
            ctx.globalAlpha = alpha;
            sigDisc(ctx, px, s, x - r * 0.38, y - r * 0.38, Math.max(s, r * 0.14), '#ffffff');
        }
        if (style === 'leaf') {
            orbLeaves(ctx, px, s, x, y, r, cols, life, alpha, true);
        }
    }

    function runOrb(u, o, ms, pokemon) {
        const P = strength(u);
        const Z = sceneScale(u);
        const { S, W, H, dir } = u;
        const el = pokemon?.el;
        const style = ORB_C[o.style] ? o.style : 'energy';
        const cols = sigPal(o.c || ORB_C[style]);
        const size = clamp(o.size ?? 1, 0.5, 2);
        const total = ms / 1000;
        const flash = overlay(total);
        // 게임 화면 — 구 가운데 ≥ 연출 위 끝 (정보줄 · 지도 줄 아래 끝 — bridge fxStageTop) + 바깥 끝 (불꽃 혀까지 r × 1.75 · 그 밖 r × 1.3) + 4칸 ·
        // 던지기 직전 · 던지는 길 진짜 꼭대기도 그 아래 (187 에서 던진 구가 정보줄 뒤로 숨던 것 — #105 · 모양 그대로) · 일반 모드 · 3:3 무대 상자 안은 위 끝 0 이라 그대로
        const top0 = typeof fxStageTop === 'function' ? fxStageTop() : 0;
        const edge = style === 'flame' ? 1.75 : 1.3;
        const rF = clamp(Math.min(H * 0.15, W * 0.13) * size * (0.85 + 0.3 * P), 9, Math.min(W, H) * 0.3);
        const minY = top0 > 0 ? top0 + rF * edge + 4 * S : 0;
        // 위 끝에 막혀 머리 위에 못 서면 (낮은 패널 · 큰 구) 크기는 그대로 두고 몸 앞쪽 (대상 쪽) 으로 — 위 끝 아래로 끌어내린 구가 몸을 덮던 것 (UX 리뷰어 · 코드 리뷰어 #105) ·
        // 던지기 직전은 들어 올림 대신 뒤로 당김 (막힌 자리에서 올리면 들어 올림이 사라짐)
        const capped = top0 > 0 && minY > u.body.top - rF - 4 * S;
        // 앞으로 옮기는 양은 대상까지 거리 × 0.25 까지 (240 에서 옮긴 구가 상대를 덮고 던지는 길이 짧아지던 것 — UX 리뷰어 #105)
        const near0 = capped ? nearest(u, u.body.cx) : null;
        const fwd = capped ? Math.min(u.body.rx + rF * 0.9, near0 ? Math.abs(near0.x - u.body.cx) * 0.25 : Infinity) : 0;
        const C = {
            x: clamp(u.body.cx + dir * fwd, rF + 2, W - rF - 2),
            y: Math.max(rF + 3, u.body.top - rF - 4 * S, minY),
        };
        const home = { x: C.x, y: C.y };
        const st = { acc: 0, aura: 0, bits: 0, trail: [], thrown: false, boom: false };
        // 몸 → 구체로 올라가는 기운 줄기
        const channel = (ctx, px, life, r) => {
            const yTop = C.y + r * 0.8;
            const yBot = u.body.top;
            if (yBot - yTop < 2 * S || Math.abs(C.x - u.body.cx) > r) {
                return;
            }
            ctx.globalAlpha = 0.75;
            for (let j = 0; j < 3; j++) {
                for (let y = yBot; y > yTop; y -= 2 * S) {
                    const ph = (y + life * 160 * Z) / (6 * S) + j * 2.1;
                    dotAt(ctx, px, S, C.x + Math.sin(ph) * Math.max(2 * S, r * 0.35) * (j - 1), y, j === 1 ? '#ffffff' : cols[1]);
                }
            }
        };
        // 키우는 동안 — 기운이 나선으로 빨려 듦 · 몸에서 솟음 · 스타일 조각
        const growTick = (dt, k, r) => {
            st.acc += dt * (50 + 60 * P) * (1 + 1.5 * k) * Math.min(1.5, Z);
            while (st.acc >= 1) {
                st.acc -= 1;
                if (Math.random() < 0.3) {
                    pullIn(C, Math.max(8, u.body.top - C.y + r), S, cols, moveRand(0.3, 0.45), { a0: Math.PI / 2 + moveRand(-0.5, 0.5), pow: 1.3 });
                } else {
                    pullIn(C, Math.max(rF, 12) * moveRand(2, 3.2), S, [...cols, '#ffffff'], moveRand(0.4, 0.6), { spin: dir * moveRand(2.5, 4), pow: 1.5 });
                }
            }
            st.aura += dt * 24;
            while (st.aura >= 1) {
                st.aura -= 1;
                riseAt(u, cols, Z);
            }
            st.bits += dt * (style === 'energy' ? 6 : 18) * (0.3 + k);
            while (st.bits >= 1) {
                st.bits -= 1;
                const a = moveRand(0, TAU);
                orbBits(style, C.x + Math.cos(a) * r * 0.9, C.y + Math.sin(a) * r * 0.9, S, cols, 1, Z, { ang: style === 'flame' || style === 'shadow' ? -Math.PI / 2 : a, spread: 0.7, sp0: 15, sp1: 50 });
            }
        };

        if (o.sky) {
            runOrbSky(u, o, total, el, { P, Z, S, W, H, dir, style, cols, size, flash, rF, C, home, st, channel, growTick });
            return;
        }

        const G = total * 0.38; // 키우기
        const TH = 0.5; // 날아가기
        const tB = G + TH;
        const Rb = clamp((H / 3) * Math.sqrt(size) * (0.85 + 0.25 * P), 24, Math.min(W, H) * 0.6); // 폭발 반지름
        // 과녁 — 가장 가까운 다른 포켓몬, 없으면 앞쪽 땅
        const tgt = nearest(u, u.body.cx);
        tremble(el, 0.4 * S, G * 1000);
        glowSprite(el, [1, 1.5, 1.2, 1.7, 1], G * 1000 + 300);
        const throwStart = () => {
            const q = refind(u, tgt) || tgt;
            const tx = q ? q.x : clamp(u.body.cx + dir * Math.max(W * 0.4, u.R * 2), 10, W - 10);
            const ty = Math.min(q ? q.y : u.ground - Math.max(4, rF * 0.3), u.ground - Rb * 0.35);
            st.from = { x: C.x, y: C.y };
            st.to = { x: tx, y: ty };
            // 진짜 꼭대기 = v (2차 곡선 꼭짓점 — 출발 · 끝 높이가 달라도 v 를 넘지 않게: 조절점 = v − √((출발 − v)(끝 − v)))
            const v = Math.min(Math.max(rF * 0.7, minY, Math.min(C.y, ty) - Math.max(20, Math.abs(tx - C.x) * 0.3)), C.y, ty);
            st.cy = v - Math.sqrt(Math.max(0, (C.y - v) * (ty - v)));
            el?.animate?.([{ translate: '0 0' }, { translate: `${dir * 2 * S}px ${-5 * S}px`, offset: 0.3 }, { translate: '0 0' }], { duration: 400, easing: 'ease-out', composite: 'add' });
            ring(C.x, C.y, S, rF, rF * 2.2, 1, 0.35, [cols[0], '#ffffff']);
            flash(cols[0], 0.18, 0.2);
        };
        const boom = () => {
            const { x, y } = st.to;
            flash('#ffffff', 0.8, 0.4, 0.06);
            if (style === 'shadow') {
                flash('#1a0830', 0.45, 0.6, 0.1, 0.12);
            }
            ultShake(6 + 3 * P, 900);
            explode(u, x, y, Rb, cols, { style, n: 60 + 40 * P, sec: 0.95 });
            if (style === 'aura' || style === 'water' || style === 'ice') {
                for (let j = 0; j < 3; j++) {
                    ring(x, y, S, Rb * 0.3, Rb * (1.4 + j * 0.5), 1, 0.6, [cols[0], cols[1], '#ffffff'], { delay: 0.12 + j * 0.1 });
                }
            }
            for (const q of u.others()) {
                if (Math.abs(q.x - x) < Rb * 1.15 + q.w / 2 && Math.abs(q.y - y) < Rb * 1.2 + q.h / 2) {
                    ultHit(q, Math.sign(q.x - x) || dir, 'tumble');
                }
            }
        };
        part({ x: 0, y: 0, s: S, max: total,
            update: (p, dt) => {
                const life = p.life;
                if (life < G) {
                    const k = life / G;
                    growTick(dt, k, rF * easeOut(k / 0.9));
                    // 던지기 직전 — 살짝 들어 올림
                    if (life > G - 0.18) {
                        const e = smooth((life - (G - 0.18)) / 0.18);
                        if (capped) {
                            C.x = home.x - dir * rF * 0.3 * e;
                        } else {
                            C.y = home.y - rF * 0.3 * e;
                        }
                    }
                    return;
                }
                if (!st.thrown) {
                    st.thrown = true;
                    throwStart();
                }
                if (life < tB) {
                    const k = ((life - G) / TH) ** 1.25;
                    C.x = lerp(st.from.x, st.to.x, k);
                    C.y = (1 - k) * (1 - k) * st.from.y + 2 * (1 - k) * k * st.cy + k * k * st.to.y;
                    st.trail.unshift({ x: C.x, y: C.y });
                    if (st.trail.length > 8) {
                        st.trail.pop();
                    }
                    st.bits = Math.min(6, st.bits + dt * 70);
                    while (st.bits >= 1) {
                        st.bits -= 1;
                        orbBits(style, C.x, C.y, S, cols, 1, Z, { jit: rF * 0.6, sp0: 10, sp1: 40 });
                    }
                    return;
                }
                if (!st.boom) {
                    st.boom = true;
                    boom();
                }
            },
            draw: (ctx, p, t, px) => {
                const life = p.life;
                if (life >= tB) {
                    return;
                }
                if (life < G) {
                    const k = life / G;
                    const r = rF * (0.1 + 0.9 * easeOut(k / 0.9)) * (1 + 0.05 * Math.sin(life * 30));
                    channel(ctx, px, life, r);
                    if (k > 0.55) {
                        speedLines(ctx, px, S, C.x, C.y, rF * 2.2, Math.max(W, H), 20, cols[0], life, (k - 0.55) * 0.7);
                    }
                    drawOrb(ctx, px, S, C.x, C.y, r, style, cols, life);
                    return;
                }
                // 날아감 — 잔상
                for (let i = st.trail.length - 1; i >= 1; i--) {
                    ctx.globalAlpha = 0.35 * (1 - i / st.trail.length);
                    sigDisc(ctx, px, S, st.trail[i].x, st.trail[i].y, rF * (1 - i * 0.07), i < 3 ? cols[1] : cols[2]);
                }
                drawOrb(ctx, px, S, C.x, C.y, rF * 0.95, style, cols, life);
            },
        });
    }

    // sky — 구체가 화면 위 가운데로 올라가 거대해졌다가 화면 전체 폭발
    function runOrbSky(u, o, total, el, k) {
        const { P, Z, S, W, H, dir, style, cols, size, flash, rF, C, home, st, channel, growTick } = k;
        const rS = clamp(H * 0.26 * Math.sqrt(size), 18, Math.min(W * 0.28, H * 0.42));
        const top = { x: W / 2, y: clamp(H * 0.06 + rS, rS + 3, H * 0.5) };
        const r1 = Math.min(rF, rS) * 0.8;
        const G1 = 0.75;
        const R1 = 0.8;
        const R2 = clamp(total - 2.95, 0.6, 1.3);
        const tC = G1 + R1 + R2;
        const tD = tC + 0.2;
        const far = Math.hypot(W, H);
        st.dark = false;
        st.rocks = 0;
        tremble(el, 0.4 * S, (G1 + R1) * 1000);
        glowSprite(el, [1, 1.6, 1.3, 1.8, 1.2, 1], tD * 1000);
        const radiusAt = (life) => {
            if (life < G1) {
                return r1 * easeOut(life / G1);
            }
            if (life < G1 + R1) {
                return lerp(r1, rS * 0.6, smooth((life - G1) / R1));
            }
            if (life < tC) {
                const kk = (life - G1 - R1) / R2;
                return lerp(rS * 0.6, rS, easeOut(kk)) * (1 + 0.06 * Math.sin(life * 22) * kk);
            }
            return rS * (1 - 0.25 * smooth((life - tC) / 0.2));
        };
        const detonate = () => {
            flash('#ffffff', 1, 1.0, 0.28);
            ultShake(9 + 3 * P, 1400);
            part({ x: C.x, y: C.y, s: S, max: 0.7, far, n: 20, r0: rS * 0.5, a0: 0, cols, draw: DR.rays });
            explode(u, C.x, C.y, far * 0.62, cols, { style, n: 100, sec: 1.3, rays: 0, smoke: 12, embers: 30 });
            for (let j = 0; j < 3; j++) {
                ring(C.x, C.y, S, rS, far * (1.05 + j * 0.1), 1, 0.8 + j * 0.15, j % 2 ? [cols[1], cols[2]] : ['#ffffff', cols[0]], { size: 2, delay: j * 0.12 });
            }
            // 땅 곳곳에서 터져 오름
            for (let j = 0; j < 5; j++) {
                const gx = ((j + 0.5) / 5) * W + moveRand(-0.08, 0.08) * W;
                spray(gx, u.ground - S, S, [...cols, '#ffffff', '#a88a55'], 14, 120 * Z, 320 * Z, { ang: -Math.PI / 2, spread: 0.8, g: 420 * Z, drag: 0.8, life0: 0.6, life1: 1.1, floorY: u.ground, size: movePick([1, 2, 2]) });
            }
            for (const q of u.others()) {
                ultHit(q, Math.sign(q.x - C.x) || dir, 'tumble');
            }
            // 여운 — 하늘에서 불티가 내려옴
            emit(1.3, 40 * areaScale(u), () => sigParticle({ x: moveRand(0, W), y: -4, s: S, vx: moveRand(-15, 15) * Z, vy: moveRand(40, 110) * Z, drag: 0.3, max: moveRand(0.9, 1.6), color: movePick([cols[0], cols[1], '#ffffff']), ph: moveRand(0, TAU), draw: DR.ember }));
        };
        part({ x: 0, y: 0, s: S, max: total,
            update: (p, dt) => {
                const life = p.life;
                if (life >= tD) {
                    if (!st.boom) {
                        st.boom = true;
                        detonate();
                    }
                    return;
                }
                const r = radiusAt(life);
                if (life < G1) {
                    growTick(dt, life / G1, r);
                    return;
                }
                if (life < G1 + R1) {
                    const kk = smooth((life - G1) / R1);
                    C.x = lerp(home.x, top.x, kk);
                    C.y = lerp(home.y, top.y, kk);
                    st.bits = Math.min(6, st.bits + dt * 50);
                    while (st.bits >= 1) {
                        st.bits -= 1;
                        orbBits(style, C.x, C.y + r * 0.6, S, cols, 1, Z, { ang: Math.PI / 2, spread: 0.6, sp0: 20, sp1: 60, jit: r * 0.5 });
                    }
                    return;
                }
                if (!st.dark) {
                    st.dark = true;
                    ultDark(0.3, (tD - life + 0.4) * 1000);
                    ultShake(1.5, (tD - life) * 1000);
                }
                // 화면 곳곳에서 기운이 빨려 듦 · 땅에서 돌이 떠오름
                st.acc += dt * (90 + 70 * P) * Math.min(1.6, Z);
                while (st.acc >= 1) {
                    st.acc -= 1;
                    pullIn(C, far * moveRand(0.35, 0.7), S, [...cols, '#ffffff'], moveRand(0.45, 0.7), { spin: moveRand(-1, 1), pow: 2.2 });
                }
                st.rocks += dt * 16 * Z;
                while (st.rocks >= 1 && room()) {
                    st.rocks -= 1;
                    sigParticle({ x: moveRand(0, W), y: u.ground - S, s: S, vy: -moveRand(30, 80) * Z, drag: 0.2, max: moveRand(0.8, 1.3), color: movePick(['#bda27a', '#8a7252', cols[2]]), size: movePick([1, 2, 2, 3]), ph: moveRand(0, TAU), update: UP.sway, draw: DR.streak });
                }
                // 구체에서 땅으로 번개가 내리꽂힘
                if (life >= (st.nextBolt ?? 0)) {
                    st.nextBolt = life + moveRand(0.12, 0.26);
                    const gx = clamp(C.x + moveRand(-0.45, 0.45) * W, 4, W - 4);
                    const a = Math.atan2(u.ground - C.y, gx - C.x);
                    const x0 = C.x + Math.cos(a) * r * 0.9;
                    const y0 = C.y + Math.sin(a) * r * 0.9;
                    const path = zigzag(x0, y0, gx, u.ground - S, S, 3);
                    const branch = zapBranch(path, (u.ground - y0) * 0.3, a, S);
                    part({ x: gx, y: u.ground, s: S, max: 0.16, draw: (ctx, q, tt, px) => {
                        ctx.globalAlpha = tt < 0.6 ? 1 : (1 - tt) / 0.4;
                        zapLine(ctx, px, S, path, 2, cols[1]);
                        zapLine(ctx, px, S, branch, 1, cols[2]);
                    } });
                    spray(gx, u.ground - S, S, [...cols, '#ffffff'], 8, 60 * Z, 160 * Z, { ang: -Math.PI / 2, spread: 1.1, g: 300 * Z, drag: 1 });
                    ring(gx, u.ground - S, S, 2 * S, Math.max(20, rS * 0.6), 0.2, 0.3, [cols[0], '#ffffff']);
                    flash(cols[0], 0.08, 0.1);
                }
            },
            draw: (ctx, p, t, px) => {
                const life = p.life;
                if (life >= tD) {
                    return;
                }
                const r = radiusAt(life);
                if (life < G1) {
                    channel(ctx, px, life, r);
                } else if (life >= G1 + R1) {
                    const kk = k01((life - G1 - R1) / R2);
                    speedLines(ctx, px, S, C.x, C.y, r * 1.6, far, 26, cols[0], life, 0.15 + 0.3 * kk);
                    for (let j = 0; j < 2; j++) {
                        const ph = (life * 1.8 + j / 2) % 1;
                        ctx.globalAlpha = (1 - ph) * 0.6;
                        ringDots(ctx, px, S, C.x, C.y, r * (1.2 + 1.6 * ph), 1, [cols[0], cols[2]], 2.5, 1, life);
                    }
                }
                drawOrb(ctx, px, S, C.x, C.y, r, style, cols, life);
                if (life > tC) {
                    ctx.globalAlpha = Math.floor(life / 0.04) % 2 ? 0.8 : 0.3;
                    sigDisc(ctx, px, S, C.x, C.y, r * 0.9, '#ffffff');
                }
            },
        });
    }

    // ══════════ ultnova — 몸이 빛나며 움츠러들다 화면 전체 대폭발 (white: 화면이 하얗게) ══════════
    function runNova(u, o, ms, pokemon) {
        const P = strength(u);
        const Z = sceneScale(u);
        const { S, W, H } = u;
        const dir = u.dir;
        const el = pokemon?.el;
        const cols = sigPal(o.c || 'hyper');
        const total = ms / 1000;
        const flash = overlay(total);
        const C = { x: u.body.cx, y: u.body.cy };
        const Tc = clamp(total * 0.32, 0.8, 1.3);
        const far = Math.hypot(Math.max(C.x, W - C.x), Math.max(C.y, H - C.y)) + 8;
        const Rn = clamp(Math.max(W, H) * 0.28 * (0.8 + 0.35 * P), 50, far * 0.9);
        const R0 = Math.max(u.R * 0.7, Math.max(u.body.rx, u.body.ry) * 2, 14);
        const st = { acc: 0, rocks: 0, arcs: [], nextArc: 0, boom: false };
        // 몸 — 점점 하얗게 빛나며 움츠러듦 → 펑 하고 커졌다 돌아옴
        const dur = (Tc + 0.6) * 1000;
        const at = Tc / (Tc + 0.6);
        glowSprite(el, [1, 1.6, 3, 4, 2.5, 1], dur);
        el?.animate?.([{ scale: '1' }, { scale: '0.88', offset: at * 0.5 }, { scale: '0.74', offset: at }, { scale: '1.3', offset: Math.min(0.95, at + 0.08) }, { scale: '1' }], { duration: dur });
        tremble(el, 0.3 * S, Tc * 500);
        later(Tc * 500, () => tremble(el, 0.9 * S, Tc * 500));
        ultDark(0.3, Tc * 1000 + 300);
        const boom = () => {
            if (o.white) {
                flash('#ffffff', 1, 1.1, 0.32);
            } else {
                flash('#ffffff', 0.9, 0.45, 0.06);
                flash(cols[1], 0.35, 0.6, 0, 0.1);
            }
            ultShake(9 + 3 * P, 1400);
            part({ x: C.x, y: C.y, s: S, max: 0.65, far, n: 18, r0: R0 * 0.5, a0: 0, cols, draw: DR.rays });
            explode(u, C.x, C.y, Rn, cols, { n: 120 + 60 * P, sec: 1.2, rays: 0, smoke: 26, embers: 50 });
            for (let j = 0; j < 4; j++) {
                ring(C.x, C.y, S, R0, far * (1 + j * 0.06), 1 - j * 0.08, 0.7 + j * 0.15, j % 2 ? [cols[1], cols[2]] : ['#ffffff', cols[0]], { size: 2, delay: j * 0.12 });
            }
            ring(C.x, u.ground - S, S, R0, far * 1.2, clamp(14 / (far * 1.2), 0.03, 0.2), 0.9, [cols[1], '#ffffff', cols[2]], { size: 2, delay: 0.05 });
            // 땅에서 돌이 튀어 오름
            for (let j = 0; j < 6; j++) {
                const gx = C.x + moveRand(-1, 1) * Rn * 1.3;
                spray(gx, u.ground - S, S, ['#bda27a', '#8a7252', '#5c4a33', cols[2]], 6, 120 * Z, 300 * Z, { ang: -Math.PI / 2 + Math.sign(gx - C.x) * 0.4, spread: 0.5, g: 450 * Z, drag: 0.6, life0: 0.6, life1: 1.1, floorY: u.ground, size: movePick([1, 2, 2, 3]) });
            }
            for (const q of u.others()) {
                ultHit(q, Math.sign(q.x - C.x) || dir, 'tumble');
            }
            // 여운 — 불티가 떠오르고 연기가 깔림
            later(500, () => emit(1.4, 30 * areaScale(u), () => sigParticle({ x: C.x + moveRand(-1, 1) * Rn * 1.2, y: u.ground - moveRand(0, 0.3) * Rn, s: S, vx: moveRand(-10, 10) * Z, vy: -moveRand(20, 60) * Z, drag: 0.4, max: moveRand(0.9, 1.6), color: movePick([cols[0], cols[1], cols[2]]), ph: moveRand(0, TAU), draw: DR.ember })));
        };
        part({ x: C.x, y: C.y, s: S, max: total,
            update: (p, dt) => {
                const life = p.life;
                if (life >= Tc) {
                    if (!st.boom) {
                        st.boom = true;
                        boom();
                    }
                    return;
                }
                const k = life / Tc;
                st.acc += dt * (70 + 90 * P) * (1 + 2 * k) * Math.min(1.5, Z);
                while (st.acc >= 1) {
                    st.acc -= 1;
                    pullIn(C, Math.max(W, H) * moveRand(0.2, 0.55), S, [...cols, '#ffffff'], moveRand(0.3, 0.5) * (1 - 0.4 * k), { spin: moveRand(-0.6, 0.6) });
                }
                // 땅에서 돌이 둥실 떠오름
                st.rocks += dt * 16 * k;
                while (st.rocks >= 1 && room()) {
                    st.rocks -= 1;
                    sigParticle({ x: C.x + moveRand(-1, 1) * R0 * 2.5, y: u.ground - S, s: S, vy: -moveRand(15, 45) * Z, drag: 0.3, max: moveRand(0.5, 0.9), color: movePick(['#bda27a', '#8a7252', '#5c4a33']), size: movePick([1, 2]), ph: moveRand(0, TAU), update: UP.sway, draw: DR.streak });
                }
                if (life >= st.nextArc) {
                    st.nextArc = life + 0.06;
                    st.arcs = [];
                    for (let j = 0; j < 1 + Math.round(3 * k); j++) {
                        const a = moveRand(0, TAU);
                        const r0 = R0 * 0.45;
                        const r1 = R0 * moveRand(0.9, 1.6) * (0.6 + k);
                        st.arcs.push(zigzag(C.x + Math.cos(a) * r0, C.y + Math.sin(a) * r0, C.x + Math.cos(a) * r1, C.y + Math.sin(a) * r1, S, 1.6));
                    }
                }
            },
            draw: (ctx, p, t, px) => {
                const life = p.life;
                if (life >= Tc) {
                    return;
                }
                const k = life / Tc;
                // 좁혀 드는 고리
                for (let j = 0; j < 3; j++) {
                    const ph = (life * (1.6 + 1.6 * k) + j / 3) % 1;
                    ctx.globalAlpha = ph * (0.4 + 0.6 * k);
                    ringDots(ctx, px, S, C.x, C.y, R0 * (0.5 + 3 * (1 - ph)), 0.85, [cols[0], cols[1], '#ffffff'], 1.6, 1, life * 3);
                }
                if (k > 0.35) {
                    speedLines(ctx, px, S, C.x, C.y, R0 * (2.4 - k), Math.max(W, H), 24, cols[0], life, (k - 0.35) * 0.6);
                }
                // 도는 빛살 — 점점 길고 굵게
                const n = 16;
                ctx.globalAlpha = 0.5 + 0.5 * k;
                for (let j = 0; j < n; j++) {
                    const a = life * (1.5 + 3 * k) + (j * TAU) / n;
                    const len = R0 * (0.6 + 2.4 * k) * (j % 2 ? 0.65 : 1) * (0.85 + 0.15 * Math.sin(life * 37 + j));
                    const w = k > 0.6 && j % 2 === 0 ? 2 : 1;
                    const ca = Math.cos(a);
                    const sa = Math.sin(a);
                    for (let d = R0 * 0.55; d < R0 * 0.55 + len; d += S) {
                        dotAt(ctx, px, S, C.x + ca * d - ((w - 1) * S) / 2, C.y + sa * d - ((w - 1) * S) / 2, d < R0 * 0.55 + len * 0.5 ? '#ffffff' : cols[1], w, w);
                    }
                }
                // 몸을 감싼 빛
                ctx.globalAlpha = 0.18 + 0.32 * k;
                sigDisc(ctx, px, S, C.x, C.y, R0 * 0.55 * (1 - 0.2 * k), cols[0]);
                ctx.globalAlpha = 1;
                st.arcs.forEach((a) => zapLine(ctx, px, S, a, 1, cols[1]));
                // 마지막 — 한 점으로 모여 십자로 번쩍
                if (k > 0.8) {
                    const e = (k - 0.8) / 0.2;
                    ctx.globalAlpha = e;
                    ctx.fillStyle = '#ffffff';
                    const hw = W * e;
                    ctx.fillRect(px(C.x - hw), px(C.y - S / 2), px(2 * hw), S);
                    ctx.fillRect(px(C.x - S / 2), px(C.y - H * 0.5 * e), S, px(H * e));
                    sigDisc(ctx, px, S, C.x, C.y, S * (1 + 4 * e), '#ffffff');
                }
            },
        });
    }

    // ══════════ ultblackhole — 앞에 검은 구멍이 열려 빛 · 입자 · 다른 포켓몬을 빨아들이다 무너지며 폭발 ══════════
    function runBlackhole(u, o, ms, pokemon) {
        const P = strength(u);
        const Z = sceneScale(u);
        const { S, W, H, dir } = u;
        const cols = sigPal(o.c || 'dark');
        const total = ms / 1000;
        const flash = overlay(total);
        const rB = clamp(Math.min(H, W) * 0.12 * (0.85 + 0.3 * P), 9, 64);
        const disk = rB * 2.3;
        const lo = disk * 0.8 + 2;
        const hi = W - disk * 0.8 - 2;
        const bx = lo < hi ? clamp(u.body.cx + dir * Math.max(W * 0.28, u.R * 1.8), lo, hi) : W / 2;
        const by = clamp(u.ground - Math.max(H * 0.3, rB * 2.6), rB * 1.6, Math.max(rB * 1.6, u.ground - rB * 1.6));
        const C = { x: bx, y: by };
        const tOpen = 0.45;
        const tCol = Math.max(tOpen + 1.2, total * 0.7);
        const tBoom = tCol + 0.28;
        const far = Math.hypot(Math.max(bx, W - bx), Math.max(by, H - by)) + 8;
        const spinDir = dir;
        const caught = [];
        const st = { acc: 0, dust: 0, nextDrag: 0, lastDrag: 0, boom: false };
        ultDark(0.4, (tBoom + 0.25) * 1000);
        flash(cols[1], 0.25, 0.3);
        // 다른 포켓몬을 붙잡음 — 멈춰 세우고 바들바들
        later(tOpen * 1000, () => {
            for (const q of u.others()) {
                const p = q.pokemon;
                ultFreeze(p, (tBoom - tOpen) * 1000 + 300);
                if (!(p.currentState instanceof UltFreezeState)) {
                    continue;
                }
                caught.push({ p, w: spriteSize(p) });
                p.el.animate?.([{ rotate: '-12deg' }, { rotate: '12deg' }], { duration: 140, iterations: Math.max(2, Math.round(((tBoom - tOpen) * 1000) / 140)), direction: 'alternate', composite: 'add' });
            }
        });
        // 끌어당기기 — 0.05초마다 조금씩 (그림은 0.15초 늦게 미끄러져 따라옴)
        const drag = (life) => {
            const dt = life - st.lastDrag;
            st.lastDrag = life;
            const k = (life - tOpen) / (tCol - tOpen);
            for (const c of caught) {
                const p = c.p;
                if (!(p.currentState instanceof UltFreezeState)) {
                    continue;
                }
                const cx = p.left + c.w / 2;
                const d = bx - cx;
                const stop = rB * 0.9 + c.w * 0.35;
                if (Math.abs(d) > stop) {
                    const mv = Math.sign(d) * Math.min(Math.abs(d) - stop, (30 + 320 * k * k) * Z * dt, 30);
                    p.positionLeft(clamp(p.left + mv, 0, rightEdge(p)));
                }
                // 가까울수록 떠오름
                const r = p.collision.getBoundingClientRect();
                const cy = r.top + r.height / 2;
                const near = 1 - clamp((Math.abs(d) - stop) / (W * 0.5), 0, 1);
                if (cy - by > rB * 1.3) {
                    p.positionBottom(p.bottom + Math.min(12, (cy - by) * 0.07 * near * k));
                }
            }
        };
        const boom = () => {
            flash('#ffffff', 0.9, 0.5, 0.08);
            flash(cols[1], 0.4, 0.6, 0, 0.1);
            ultShake(8 + 2 * P, 1100);
            part({ x: bx, y: by, s: S, max: 0.6, far, n: 16, r0: rB * 0.3, a0: 0.2, cols: [cols[0], cols[1], cols[2], cols[3]], draw: DR.rays });
            // 별이 사방으로 — 길게
            for (let i = 0; i < 50 && room(); i++) {
                const a = moveRand(0, TAU);
                const sp = moveRand(150, 420) * Z;
                sigParticle({ x: bx, y: by, s: S, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 1.4, max: moveRand(0.5, 1), r: movePick([1, 1, 2]), cols: ['#ffffff', cols[0], cols[1], cols[2]], draw: DR.star });
            }
            explode(u, bx, by, Math.max(rB * 3, H * 0.26), cols, { n: 70, sec: 0.9, rays: 0, smoke: 8, embers: 24 });
            for (let j = 0; j < 3; j++) {
                ring(bx, by, S, rB, far * (1 + j * 0.08), 1 - j * 0.12, 0.7 + j * 0.15, j % 2 ? [cols[1], cols[2]] : ['#ffffff', cols[0]], { size: 2, delay: j * 0.1 });
            }
            // 잡혀 있던 애들 — 튕겨 나가 벌러덩
            for (const c of caught) {
                const p = c.p;
                if (!(p.currentState instanceof UltFreezeState)) {
                    continue;
                }
                const sgn = Math.sign(p.left + c.w / 2 - bx) || dir;
                p.positionLeft(clamp(p.left + sgn * Math.min(36, c.w), 0, rightEdge(p)));
                ultHit(p, sgn, 'tumble');
                if (p.currentState instanceof UltFreezeState && p.bottom > p.floor + 1) {
                    p.holdState = undefined;
                    p.holdStateEnum = undefined;
                    p.currentState = new FallState(p, sgn < 0);
                }
            }
            for (const q of u.others()) {
                if (Math.abs(q.x - bx) < rB * 4) {
                    ultHit(q, Math.sign(q.x - bx) || dir, 'tumble');
                }
            }
        };
        // 원반 (앞쪽 · 뒤쪽 따로) — 기울어진 타원을 도는 빛 줄기
        const tilt = -0.22 * dir;
        const ct = Math.cos(tilt);
        const sn = Math.sin(tilt);
        const drawDisk = (ctx, px, life, sc, front) => {
            const n = 176;
            for (let j = 0; j < n; j++) {
                const lane = j % 4;
                const speed = (2.8 - lane * 0.5) * spinDir;
                const a = (j / n) * TAU + life * speed;
                const rr = disk * sc * (0.55 + 0.16 * lane + 0.05 * hash(j, 1));
                const col = lane === 0 ? '#ffffff' : lane === 1 ? cols[0] : lane === 2 ? cols[1] : cols[2];
                const sz = lane === 0 && front ? 2 : 1;
                for (let q = 0; q < 3; q++) {
                    const aa = a - q * 0.06 * Math.sign(speed);
                    const depth = Math.sin(aa);
                    if (depth > 0 !== front) {
                        continue;
                    }
                    const ex = Math.cos(aa) * rr;
                    const ey = depth * rr * 0.3;
                    ctx.globalAlpha = (front ? 1 : 0.55) * (1 - q * 0.3);
                    dotAt(ctx, px, S, bx + ex * ct - ey * sn - ((sz - 1) * S) / 2, by + ex * sn + ey * ct - ((sz - 1) * S) / 2, col, sz, sz);
                }
            }
        };
        // 소용돌이 팔 — 바깥에서 감겨 듦
        const drawArms = (ctx, px, life, sc) => {
            const reachR = disk * 2.6 * sc;
            for (let j = 0; j < 3; j++) {
                for (let k = 0; k < 36; k++) {
                    const f = k / 36;
                    const rr = rB * 1.4 * sc + f * reachR;
                    const a = life * spinDir * 1.3 + (j * TAU) / 3 - spinDir * f * 4.2;
                    const ex = Math.cos(a) * rr;
                    const ey = Math.sin(a) * rr * 0.45;
                    ctx.globalAlpha = 0.5 * (1 - f);
                    dotAt(ctx, px, S, bx + ex * ct - ey * sn, by + ex * sn + ey * ct, k % 2 ? cols[1] : cols[2], k < 12 ? 2 : 1, 1);
                }
            }
        };
        part({ x: bx, y: by, s: S, max: total,
            update: (p, dt) => {
                const life = p.life;
                if (life >= tBoom) {
                    if (!st.boom) {
                        st.boom = true;
                        boom();
                    }
                    return;
                }
                if (life < tOpen) {
                    return;
                }
                const k = k01((life - tOpen) / (tCol - tOpen));
                if (life < tCol) {
                    // 별 · 빛이 나선으로 빨려 듦
                    st.acc += dt * (90 + 70 * P) * Math.min(1.6, Z) * (0.6 + 0.6 * k);
                    while (st.acc >= 1) {
                        st.acc -= 1;
                        pullIn(C, far * moveRand(0.3, 0.85), S, ['#ffffff', '#ffffff', cols[0], cols[1]], moveRand(0.7, 1.2), { spin: spinDir * moveRand(2, 4), pow: 2.2, size: movePick([1, 1, 2]) });
                    }
                    // 땅 먼지가 들려 올라감
                    st.dust += dt * 24 * Z;
                    while (st.dust >= 1) {
                        st.dust -= 1;
                        pullIn(C, Math.max(rB * 2, u.ground - by) * moveRand(1, 1.6), S, ['#a88a55', '#7a6238', cols[2]], moveRand(0.6, 0.9), { a0: Math.PI / 2 + moveRand(-0.9, 0.9), spin: spinDir * 0.8, pow: 1.8 });
                    }
                    if (life >= st.nextDrag) {
                        st.nextDrag = life + 0.05;
                        if (!st.lastDrag) {
                            st.lastDrag = life - 0.05;
                        }
                        drag(life);
                    }
                }
            },
            draw: (ctx, p, t, px) => {
                const life = p.life;
                if (life >= tBoom) {
                    return;
                }
                let r;
                if (life < tOpen) {
                    // 열림 — 하얀 금이 가로로 쫙 → 검은 구멍
                    const k = life / tOpen;
                    ctx.globalAlpha = 1;
                    ctx.fillStyle = '#ffffff';
                    const hw = disk * 1.3 * easeOut(k * 1.6);
                    ctx.fillRect(px(bx - hw), px(by - S / 2), px(2 * hw), S);
                    r = rB * easeOut(k);
                } else if (life < tCol) {
                    r = rB * (1 + 0.05 * Math.sin(life * 9));
                } else {
                    r = rB * (1 - easeIn((life - tCol) / (tBoom - tCol)));
                }
                const sc = r / rB;
                drawArms(ctx, px, life, sc);
                // 휘어진 빛 고리 (흐릿)
                for (let j = 0; j < 2; j++) {
                    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(life * 6 + j);
                    ringDots(ctx, px, S, bx, by, r * (1.5 + j * 0.45), 1, [cols[2], cols[3]], 2 + j, 1, life * spinDir * (0.5 + j));
                }
                drawDisk(ctx, px, life, sc, false);
                // 검은 구 + 빛나는 테두리
                ctx.globalAlpha = 1;
                sigDisc(ctx, px, S, bx, by, r * 1.14, cols[1]);
                sigDisc(ctx, px, S, bx, by, r * 1.06, cols[0]);
                sigDisc(ctx, px, S, bx, by, r, '#000000');
                drawDisk(ctx, px, life, sc, true);
                if (life > tCol) {
                    // 무너지는 순간 — 한 점이 번쩍
                    const e = (life - tCol) / (tBoom - tCol);
                    ctx.globalAlpha = e;
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(px(bx - W * e), px(by - S / 2), px(2 * W * e), S);
                    sigDisc(ctx, px, S, bx, by, S * (1 + 3 * e), '#ffffff');
                }
            },
        });
    }

    // ══════════ ultsparkle — twinkle: 화면 가득 하트 · 별 + 반짝이며 박치기 / moon: 하늘에 거대한 달이 떠서 빛이 쏟아짐 ══════════
    function runTwinkle(u, o, ms, pokemon) {
        const P = strength(u);
        const Z = sceneScale(u);
        const A = areaScale(u);
        const { S, W, H, dir } = u;
        const el = pokemon?.el;
        const cols = sigPal(o.c || 'fairy');
        const pink = sigPal('fairy');
        const hearts = [pink[2], pink[3], '#ff7ab8', cols[2]];
        const starCols = ['#ffffff', cols[0], cols[1], cols[2]];
        const total = ms / 1000;
        const flash = overlay(total);
        const tDash = 1.0;
        const st = { hearts: 0, stars: 0, trail: 0, dashing: false, hit: false, shower: false };
        const tgt = nearest(u, u.body.cx);
        glowSprite(el, [1, 1.7, 1.3, 1.8, 1.4, 1.7, 1], total * 900);
        // 화면 가득 하트 · 별
        const heartAt = (x, y, big) => {
            if (!room()) {
                return;
            }
            sigParticle({ x, y, s: big ? S * 2 : S, vx: moveRand(-6, 6) * Z, vy: -moveRand(6, 20) * Z, max: moveRand(1.4, 2.4), color: movePick(hearts), ph: moveRand(0, TAU), update: UP.sway, draw: DR.heart });
        };
        const starAt = (x, y, r) => {
            if (!room()) {
                return;
            }
            sigParticle({ x, y, s: S, max: moveRand(0.45, 0.9), r, cols: starCols, draw: DR.twinkle });
        };
        // 박치기 — 큰 별이 사방으로 · 하트 터짐 · 고리
        const impact = (x, y, q) => {
            flash('#ffe6f4', 0.6, 0.35, 0.04);
            ultShake(4 + 2 * P, 500);
            sigImpact(x, y, S, ['#ffffff', pink[1], pink[2], cols[2]], 1, true);
            for (let i = 0; i < 14 && room(); i++) {
                const a = (i / 14) * TAU + moveRand(-0.2, 0.2);
                const sp = moveRand(140, 320) * Z;
                sigParticle({ x, y, s: S * 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 2.4, max: moveRand(0.6, 0.95), r: 2, cols: starCols, draw: DR.star });
            }
            spray(x, y, S, [...starCols, ...hearts], 30, 80 * Z, 260 * Z, { drag: 1.8, life0: 0.4, life1: 0.8, size: movePick([1, 2]) });
            for (let i = 0; i < 10 && room(); i++) {
                const a = moveRand(0, TAU);
                const sp = moveRand(60, 180) * Z;
                sigParticle({ x, y, s: S, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40 * Z, drag: 2, max: moveRand(0.8, 1.3), color: movePick(hearts), ph: moveRand(0, TAU), draw: DR.heart });
            }
            sigParticle({ x, y, s: S, max: 0.45, len: Math.max(u.R, 30) * 1.8, thick: 4, cols: ['#ffffff', pink[1]], draw: DR.flare });
            sigParticle({ x, y, s: S, max: 0.7, r0: 4 * S, r1: Math.max(u.R, 30) * 2.2, size: 2, cols: ['#ffffff', pink[1], pink[2]], draw: DR.heartRing });
            ring(x, y, S, 3 * S, Math.max(u.R, 30) * 2.6, 1, 0.5, ['#ffffff', pink[1], cols[1]], { size: 2 });
            ring(x, y, S, 3 * S, Math.max(u.R, 30) * 4, 0.7, 0.7, [pink[2], '#ffffff', cols[2]], { delay: 0.08 });
            if (q) {
                ultHit(q, Math.sign(q.x - u.body.cx) || dir, 'spin');
            }
        };
        // 반짝이며 돌진 (그림이 0.1초마다 34px 넘게 안 움직이게 나눠서 — 넘으면 미끄러지지 않고 순간이동)
        later(tDash * 1000, () => {
            const p0 = pokemon;
            if (!p0) {
                return;
            }
            const q = refind(u, tgt);
            const w = spriteSize(p0);
            const cx0 = p0.left + w / 2;
            const dT = q ? Math.sign(q.x - cx0) || dir : dir;
            const dist = q ? Math.max(0, Math.abs(q.x - cx0) - (q.w / 2 + w / 2) * 0.5) : Math.min(W * 0.3, dT > 0 ? rightEdge(p0) - p0.left : p0.left);
            const startLeft = p0.left;
            const out = clamp(Math.ceil(dist / 34), 2, 8); // 아주 멀면 휙휙 순간이동처럼
            const back = clamp(Math.ceil(dist / 30), 3, 8);
            st.dashing = true;
            st.dT = dT;
            flash(pink[1], 0.2, 0.2);
            ring(cx0, u.body.cy, S, 2 * S, u.R * 1.5, 1, 0.3, ['#ffffff', pink[1]]);
            const state = ultMove(p0, (i, s2) => {
                if (i < out) {
                    p0.positionLeft(clamp(startLeft + (dT * dist * (i + 1)) / out, 0, rightEdge(p0)));
                    return false;
                }
                if (i === out) {
                    later(120, () => {
                        const r = p0.collision.getBoundingClientRect();
                        const x = q ? lerp(r.left + r.width / 2, q.x, 0.6) : dT > 0 ? r.right : r.left;
                        impact(x, r.top + r.height * 0.5, q);
                        st.dashing = false;
                        st.shower = true;
                    });
                    return false;
                }
                if (i < out + 3) {
                    return false;
                }
                const k = Math.min(1, (i - out - 2) / back);
                p0.positionLeft(clamp(startLeft + dT * dist * (1 - k), 0, rightEdge(p0)));
                if (k >= 1) {
                    faceState(s2, u.dir < 0);
                    return true;
                }
                return false;
            });
            faceState(state, dT < 0);
        });
        // 분홍빛 — 화면 전체 (밑에 깔림)
        part({ x: 0, y: 0, s: S, max: total, draw: (ctx, p, t) => {
            ctx.globalCompositeOperation = 'destination-over';
            ctx.globalAlpha = 0.16 * fadeInOut(t, 0.1, 0.25);
            ctx.fillStyle = '#ff7ab8';
            ctx.fillRect(0, 0, W, H);
        } });
        part({ x: 0, y: 0, s: S, max: total,
            update: (p, dt) => {
                const life = p.life;
                const busy = life < 1.1 ? 1 : 0.2; // 돌진 · 박치기가 잘 보이게 그 뒤엔 조금만
                st.hearts += dt * (18 + 12 * P) * A * busy;
                while (st.hearts >= 1) {
                    st.hearts -= 1;
                    heartAt(moveRand(4 * S, W - 4 * S), moveRand(H * 0.05, u.ground - 4 * S), Math.random() < 0.3);
                }
                st.stars += dt * 40 * A * busy;
                while (st.stars >= 1) {
                    st.stars -= 1;
                    starAt(moveRand(0, W), moveRand(0, u.ground), movePick([1, 2, 2, 3]));
                }
                // 돌진 꼬리 — 반짝이 · 하트
                if (st.dashing && el) {
                    const r = el.getBoundingClientRect();
                    st.trail += dt * 90;
                    while (st.trail >= 1 && room()) {
                        st.trail -= 1;
                        const x = r.left + r.width / 2 + moveRand(-0.4, 0.4) * r.width;
                        const y = r.top + r.height * moveRand(0.2, 0.9);
                        if (Math.random() < 0.2) {
                            sigParticle({ x, y, s: S, vy: -moveRand(10, 40) * Z, max: moveRand(0.4, 0.7), color: movePick(hearts), ph: 0, draw: DR.heart });
                        } else {
                            sigParticle({ x, y, s: S, vx: moveRand(-30, 30) * Z, vy: moveRand(-30, 30) * Z, drag: 2, max: moveRand(0.3, 0.6), r: movePick([1, 2]), cols: starCols, draw: DR.star });
                        }
                    }
                }
                // 끝 — 하늘에서 별이 쏟아짐
                if (st.shower && life < total - 0.3) {
                    st.trail += dt * 35 * A;
                    while (st.trail >= 1 && room()) {
                        st.trail -= 1;
                        sigParticle({ x: moveRand(0, W), y: -4, s: S, vx: moveRand(-20, 20) * Z, vy: moveRand(60, 140) * Z, max: moveRand(0.8, 1.4), r: movePick([1, 1, 2]), cols: starCols, draw: DR.star });
                    }
                }
            },
            draw: (ctx, p, t, px) => {
                // 쓰는 애 둘레를 도는 별
                if (!el) {
                    return;
                }
                const r = el.getBoundingClientRect();
                const cx = r.left + r.width / 2;
                const cy = r.top + r.height / 2;
                const rr = Math.max(r.width, r.height) * 0.75 + 2 * S;
                // 돌진 — 뒤로 길게 끌리는 별똥별 꼬리 (분홍 · 하양 · 노랑 줄)
                if (st.dashing) {
                    const band = ['#ffffff', pink[1], '#fff8b0', pink[2], cols[1], '#ffffff'];
                    const back = st.dT > 0 ? r.left + r.width * 0.3 : r.right - r.width * 0.3;
                    const bh = Math.max(S, px(r.height * 0.11));
                    for (let j = 0; j < band.length; j++) {
                        const len = (22 + 16 * hash(j, Math.floor(p.life * 20))) * S * (1 - Math.abs(j - 2.5) * 0.18);
                        ctx.globalAlpha = 0.85;
                        ctx.fillStyle = band[j];
                        ctx.fillRect(px(st.dT > 0 ? back - len : back), px(r.top + r.height * (0.2 + j * 0.11)), px(len), bh);
                    }
                    ctx.globalAlpha = 0.9;
                    bigSparkle(ctx, px, S, cx, cy, Math.max(r.width, r.height) * (0.9 + 0.25 * Math.sin(p.life * 40)), '#ffffff', pink[1]);
                }
                ctx.globalAlpha = fadeInOut(t, 0.05, 0.15);
                for (let j = 0; j < 8; j++) {
                    const a = p.life * 4 + (j * TAU) / 8;
                    drawStar(ctx, px, S, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.8, Math.sin(p.life * 12 + j) > 0 ? 2 : 1, j % 2 ? starCols : ['#ffffff', pink[1], pink[2], pink[3]]);
                }
            },
        });
    }

    const CRATERS = [[-0.35, -0.25, 0.18], [0.22, 0.3, 0.14], [-0.12, 0.48, 0.09], [0.38, -0.32, 0.1], [-0.5, 0.18, 0.08], [0.05, -0.05, 0.07]];
    function runMoon(u, o, ms, pokemon) {
        const P = strength(u);
        const Z = sceneScale(u);
        const A = areaScale(u);
        const { S, W, H, dir } = u;
        const el = pokemon?.el;
        const cols = sigPal(o.c || 'moon');
        const starCols = ['#ffffff', cols[0], cols[1], cols[2]];
        const total = ms / 1000;
        const flash = overlay(total);
        const Rm = clamp(Math.min(H * 0.2, W * 0.16) * (0.9 + 0.2 * P), 14, 90);
        const lo = Rm * 1.5;
        const hi = W - Rm * 1.5;
        const mx = lo < hi ? clamp(lerp(u.body.cx, W / 2, 0.55), lo, hi) : W / 2;
        const my1 = clamp(H * 0.07 + Rm, Rm + 4, H * 0.45);
        const my0 = Math.max(my1, Math.min(u.ground - Rm, my1 + H * 0.35));
        const M = { x: mx, y: my0 };
        const tRise = 1.2;
        const tGlow = 1.4;
        const tBurst = Math.max(tGlow + 1.2, total - 1.0);
        const st = { stars: 0, rain: 0, glowed: false, shook: false, burst: false };
        ultDark(0.32, (total - 0.2) * 1000);
        glowSprite(el, [1, 1.3, 1.6, 1.3, 1.7, 1], total * 900);
        // 달 — 겹 빛 · 후광 고리 · 밝은 면과 그늘 · 분화구
        const drawMoon = (ctx, px, x, y, r, life, glow, alpha) => {
            discs(ctx, px, S, x, y, r, [[1.75, cols[3], 0.1], [1.42, cols[2], 0.16], [1.18, cols[1], 0.28]], alpha);
            for (let j = 0; j < 3; j++) {
                ctx.globalAlpha = alpha * 0.5 * (0.6 + 0.4 * Math.sin(life * 4 + j));
                ringDots(ctx, px, S, x, y, r * (1.35 + j * 0.32), 1, [cols[0], cols[2]], 2.2 + j, 1, life * (0.3 + j * 0.2));
            }
            ctx.globalAlpha = alpha;
            for (let dy = -r; dy <= r; dy += S) {
                const half = Math.sqrt(Math.max(0, r * r - dy * dy));
                const yy = px(y + dy);
                ctx.fillStyle = cols[1];
                ctx.fillRect(px(x - half), yy, Math.max(S, px(2 * half)), S);
                const sh = x + half * 0.55 - dy * 0.15;
                ctx.fillStyle = cols[2];
                ctx.fillRect(px(sh), yy, Math.max(0, px(x + half) - px(sh)), S);
            }
            for (const [cx, cy, cr] of CRATERS) {
                sigDisc(ctx, px, S, x + cx * r, y + cy * r, Math.max(S * 0.6, cr * r), cols[2]);
                dotAt(ctx, px, S, x + cx * r - cr * r * 0.5, y + cy * r - cr * r * 0.5, cols[3]);
            }
            sigDisc(ctx, px, S, x - r * 0.45, y - r * 0.45, Math.max(S * 0.6, r * 0.1), '#ffffff');
            if (glow > 0) {
                ctx.globalAlpha = alpha * glow;
                sigDisc(ctx, px, S, x, y, r * 1.04, '#ffffff');
            }
        };
        // 달빛 기둥 — 달에서 땅으로 비스듬히, 천천히 훑음
        const drawShafts = (ctx, px, life, k) => {
            const yTop = M.y + Rm * 0.6;
            const yBot = u.ground;
            if (yBot - yTop < 4 * S) {
                return;
            }
            for (let j = 0; j < 4; j++) {
                const gx = mx + W * 0.5 * Math.sin(life * 0.9 + j * 1.6);
                const wt = Rm * 0.45;
                const wb = Rm * 1.2 + W * 0.04;
                const flick = 0.85 + 0.15 * Math.sin(life * 13 + j * 3);
                for (let y = yTop; y < yBot; y += 2 * S) {
                    const f = (y - yTop) / (yBot - yTop);
                    const cx = lerp(mx, gx, f);
                    const hw = lerp(wt, wb, f);
                    ctx.globalAlpha = 0.14 * k * flick;
                    ctx.fillStyle = cols[1];
                    ctx.fillRect(px(cx - hw), px(y), px(2 * hw), 2 * S);
                    ctx.globalAlpha = 0.14 * k * flick;
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(px(cx - hw * 0.35), px(y), px(hw * 0.7), 2 * S);
                }
            }
        };
        const burst = () => {
            flash(cols[0], 0.75, 0.55, 0.06);
            ultShake(5 + 2 * P, 800);
            part({ x: M.x, y: M.y, s: S, max: 0.6, far: Math.hypot(W, H), n: 16, r0: Rm * 1.1, a0: 0.1, cols: [cols[1], cols[2], cols[0], cols[3]], draw: DR.rays });
            for (let i = 0; i < 40 && room(); i++) {
                const a = moveRand(0, TAU);
                const sp = moveRand(120, 360) * Z;
                sigParticle({ x: M.x, y: M.y, s: Math.random() < 0.35 ? S * 2 : S, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 60 * Z, drag: 1.6, max: moveRand(0.6, 1.1), r: 2, cols: starCols, draw: DR.star });
            }
            for (let j = 0; j < 3; j++) {
                ring(M.x, M.y, S, Rm, Math.hypot(W, H) * (0.9 + j * 0.15), 1, 0.8 + j * 0.12, j % 2 ? [cols[2], cols[1]] : ['#ffffff', cols[0]], { size: 2, delay: j * 0.1 });
            }
            // 다른 포켓몬마다 달빛 기둥이 쾅 — 떠올랐다 툭
            for (const q of u.others()) {
                ultHit(q, Math.sign(q.x - u.body.cx) || dir, 'lift');
                part({ x: q.x, y: q.bottom, s: S, max: 0.55, hw: Math.max(q.w * 0.6, 10), draw: (ctx, p, t, px) => {
                    const a = 1 - t;
                    ctx.globalAlpha = 0.5 * a;
                    ctx.fillStyle = cols[1];
                    ctx.fillRect(px(p.x - p.hw), 0, px(2 * p.hw), p.y);
                    ctx.globalAlpha = 0.8 * a;
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(px(p.x - p.hw * 0.35), 0, px(p.hw * 0.7), p.y);
                } });
                spray(q.x, q.bottom - S, S, starCols, 14, 80 * Z, 220 * Z, { ang: -Math.PI / 2, spread: 1.2, g: 200 * Z, drag: 1, draw: DRAW.sparkle, cols: starCols });
            }
        };
        part({ x: 0, y: 0, s: S, max: total,
            update: (p, dt) => {
                const life = p.life;
                M.y = lerp(my0, my1, easeOut(life / tRise));
                // 밤하늘 별
                st.stars += dt * 26 * A;
                while (st.stars >= 1) {
                    st.stars -= 1;
                    if (room()) {
                        sigParticle({ x: moveRand(0, W), y: moveRand(0, u.ground * 0.7), s: S, max: moveRand(0.5, 1.1), r: movePick([0, 1, 1, 2]), cols: starCols, draw: DR.twinkle });
                    }
                }
                if (!st.glowed && life >= tGlow) {
                    st.glowed = true;
                    flash(cols[1], 0.3, 0.4);
                    ring(M.x, M.y, S, Rm, Rm * 3.5, 1, 0.6, ['#ffffff', cols[0], cols[2]], { size: 2 });
                    spray(M.x, M.y, S, starCols, 24, 60 * Z, 200 * Z, { drag: 2, draw: DRAW.sparkle, cols: starCols });
                }
                // 달빛이 비처럼 쏟아짐
                if (life >= tGlow && life < tBurst + 0.4) {
                    if (!st.shook) {
                        st.shook = true;
                        for (const q of u.others()) {
                            ultHit(q, 1, 'shake');
                        }
                    }
                    st.rain += dt * (60 + 40 * P) * A;
                    while (st.rain >= 1 && room()) {
                        st.rain -= 1;
                        const x0 = M.x + moveRand(-1, 1) * Rm * 0.8;
                        const y0 = M.y + Rm * 0.5;
                        const tx = moveRand(-0.05, 1.05) * W;
                        const d = Math.hypot(tx - x0, u.ground - y0) || 1;
                        const sp = moveRand(160, 300) * Z;
                        sigParticle({ x: x0, y: y0, s: S, vx: ((tx - x0) / d) * sp, vy: ((u.ground - y0) / d) * sp, max: Math.min(2, d / sp + 0.05), cols: starCols, draw: DRAW.sparkle });
                    }
                }
                if (!st.burst && life >= tBurst) {
                    st.burst = true;
                    burst();
                }
            },
            draw: (ctx, p, t, px) => {
                const life = p.life;
                const alpha = Math.min(1, life / 0.3) * (life > total - 0.5 ? Math.max(0, (total - life) / 0.5) : 1);
                if (life >= tGlow) {
                    drawShafts(ctx, px, life, Math.min(1, (life - tGlow) / 0.3) * alpha);
                }
                // 느리게 도는 긴 빛살
                ctx.globalAlpha = 0.25 * alpha;
                for (let j = 0; j < 12; j++) {
                    const a = life * 0.3 + (j * TAU) / 12;
                    const len = Rm * (j % 2 ? 2.4 : 3.2);
                    for (let d = Rm * 1.3; d < len; d += S * 2) {
                        dotAt(ctx, px, S, M.x + Math.cos(a) * d, M.y + Math.sin(a) * d, cols[0]);
                    }
                }
                let glow = 0;
                if (life >= tGlow) {
                    glow = Math.max(0, 1 - (life - tGlow) / 0.35) * 0.8;
                }
                if (life >= tBurst) {
                    glow = Math.max(glow, Math.max(0, 1 - (life - tBurst) / 0.4));
                }
                drawMoon(ctx, px, M.x, M.y, Rm * (1 + 0.04 * Math.sin(life * 5)), life, glow, alpha);
            },
        });
    }

    Object.assign(ULT_FX, {
        ultbeam: {
            ms: (P, o) => clamp(beamCharge(o) + 2400 + 600 * P, 2500, 4500),
            run: (u, o, ms, pokemon) => runBeam(u, o, ms, pokemon || u.pokemon),
        },
        ultorb: {
            ms: (P, o) => (o.sky ? 4200 : 3400) + 300 * P,
            run: (u, o, ms, pokemon) => runOrb(u, o, ms, pokemon || u.pokemon),
        },
        ultnova: {
            ms: (P) => 3300 + 400 * P,
            run: (u, o, ms, pokemon) => runNova(u, o, ms, pokemon || u.pokemon),
        },
        ultblackhole: {
            ms: (P) => 3800 + 400 * P,
            run: (u, o, ms, pokemon) => runBlackhole(u, o, ms, pokemon || u.pokemon),
        },
        ultsparkle: {
            ms: (P, o) => (o.mode === 'moon' ? 4000 : 3600) + 300 * P,
            run: (u, o, ms, pokemon) => (o.mode === 'moon' ? runMoon : runTwinkle)(u, o, ms, pokemon || u.pokemon),
        },
    });
})();
