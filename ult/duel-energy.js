
// ───── 필살기 대결 모양 A — 에너지 (ult/SPEC.md "필살기 대결"): beam 광선 · bolt 번개 · orb 구체 · dome 충격파 ─────
// 각자 자기 필살기(ultbeam · ultvolt · ultthunder · ultorb · ultblackhole · ultsparkle moon · ultnova) 모양 그대로 X.x0 → X.front 까지
// 다른 파일과 한 덩어리로 이어 붙으니 전부 이 안에 (이름 겹침 방지)
(() => {
    const TAU = Math.PI * 2;
    const CAP = 1150; // 살아 있는 입자가 이만큼 넘으면 꾸밈 입자는 건너뜀 (한도 1500 — 엔진 · 상대 몫을 남김)
    const room = (n = 1) => moveParticles.length + n <= CAP;
    const rnd = moveRand;
    const pick = movePick;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const lerp = (a, b, k) => a + (b - a) * k;
    const k01 = (v) => clamp(v, 0, 1);
    const smooth = (v) => {
        const k = k01(v);
        return k * k * (3 - 2 * k);
    };
    const easeOut = (v) => 1 - (1 - k01(v)) ** 3;
    const easeIn = (v) => k01(v) ** 2;
    const hash = (a, b = 0) => {
        const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
        return v - Math.floor(v);
    };
    const fail = (err) => ultError('duel-energy', err);
    const later = (ms, fn) => setTimeout(() => {
        try {
            fn();
        } catch (err) {
            fail(err);
        }
    }, Math.max(0, ms));
    // 무지개 색 (12도 칸으로 모아 둠)
    const HUES = {};
    const hue = (h, l = 60) => {
        const i = ((Math.round(h / 12) % 30) + 30) % 30;
        const key = i * 1000 + l;
        return HUES[key] || (HUES[key] = `hsl(${i * 12}, 100%, ${l}%)`);
    };
    const ORB_C = { energy: 'gold', flame: 'fire', shadow: 'ghost', aura: 'aura', water: 'water', ice: 'ice', leaf: 'grass' };
    const other = (D, X) => (X === D.A ? D.B : D.A);

    // ── 공통 ──
    // 처음 한 번 — 점 칸 · 세기 · 패널 비율, 그다음 종류마다 준비
    function setup(D, X, init) {
        const st = X.st;
        if (!st.ok) {
            st.ok = true;
            const S = X.S;
            st.px = (v) => Math.round(v / S) * S;
            st.P = 0.4 + 0.6 * clamp(X.P ?? 0.5, 0, 1);
            st.Z = clamp(Math.min(D.W, D.H * 1.6) / 480, 0.55, 2.2);
            st.surge = 0;
            st.acc = 0;
            st.edge = X.dir > 0 ? D.W + 2 * S : -2 * S;
            init(D, X, st);
        }
        return st;
    }
    function clipFloor(ctx, bottom) {
        ctx.beginPath();
        ctx.rect(-64, -64, window.innerWidth + 128, bottom + 64);
        ctx.clip();
    }
    // 종류 하나 — 처음 부를 때 준비, 그리기는 땅 밑을 잘라 내고 ctx 를 꼭 되돌림
    function kind(init, k) {
        const ready = (D, X) => setup(D, X, init);
        return {
            charge: (D, X, kk, dt) => {
                ready(D, X);
                X.st.ck = kk;
                k.charge(D, X, kk, dt);
            },
            draw: (ctx, px, D, X) => {
                ready(D, X);
                ctx.save();
                try {
                    clipFloor(ctx, D.ground);
                    k.draw(ctx, X.st.px, D, X);
                } finally {
                    ctx.restore();
                }
            },
            tick: (D, X, dt) => {
                ready(D, X);
                X.st.surge = Math.max(0, X.st.surge - dt * 2.5);
                k.tick(D, X, dt);
            },
            push: (D, X, strong) => {
                ready(D, X);
                if (strong) {
                    X.st.surge = 1;
                }
                k.push(D, X, strong);
            },
            win: (D, X, L) => {
                ready(D, X);
                X.st.wonAt = D.t;
                k.win(D, X, L);
            },
        };
    }
    // 밀 땐 굵고 밝게 · 밀릴 땐 움츠러듦 · 밀기 시작할 때 확 (surge) · 막판(climax) 더
    function force(D, X) {
        const O = other(D, X);
        const up = X.pushing > 0 ? X.pa : 0;
        const down = X.pushing < 0 ? O.pa : 0;
        return (1 + 0.28 * up - 0.18 * down + 0.2 * X.st.surge) * (1 + 0.12 * D.climax);
    }
    const hot = (X) => Math.min(1, (X.pushing > 0 ? X.pa : 0) + 0.6 * X.st.surge);
    // 앞머리 — 이긴 뒤엔 진 쪽을 뚫고 화면 끝까지 (sec 초 동안)
    function tipOf(D, X, sec) {
        const w = X.st.wonAt;
        return w === undefined || !sec ? X.front : lerp(X.front, X.st.edge, easeOut((D.t - w) / sec));
    }
    // 모으기 그림 — draw 는 나가기부터라서, 모으는 동안만 사는 입자 하나로
    function chargeArt(D, X, fn) {
        sigParticle({ x: X.x0, y: X.y0, s: X.S, max: DUEL_CHARGE + 0.5, floorY: D.ground,
            update: (p) => {
                if (D.phase !== 'charge') {
                    p.life = p.max;
                }
            },
            draw: floorDraw((ctx) => fn(ctx, X.st.px, X.st.ck ?? 0, D.t)),
        });
    }
    // 땅 밑을 잘라 내고 그림 (큰 덩어리 입자)
    function floorDraw(fn) {
        return (ctx, p, t, px) => {
            ctx.save();
            try {
                clipFloor(ctx, p.floorY);
                fn(ctx, p, t, px);
            } finally {
                ctx.restore();
            }
        };
    }
    // 그림 떨기 · 밝히기 · 반동 (o.tint 위에 겹침)
    function tremble(X, amp, ms, period = 40) {
        X.p?.el?.animate?.([{ translate: `-${amp}px 0` }, { translate: `${amp}px 0` }], { duration: period, iterations: Math.max(2, Math.round(ms / period)), direction: 'alternate', composite: 'add' });
    }
    function glowSprite(X, levels, ms) {
        const el = X.p?.el;
        if (!el?.animate) {
            return;
        }
        const base = el.style.filter && el.style.filter !== 'none' ? `${el.style.filter} ` : '';
        el.animate(levels.map((b) => ({ filter: `${base}brightness(${b})` })), { duration: ms, easing: 'ease-in-out' });
    }
    function recoil(X, amt, ms = 300) {
        X.p?.el?.animate?.([{ translate: `${-X.dir * amt}px 0` }, { translate: '0 0' }], { duration: ms, easing: 'ease-out', composite: 'add' });
    }

    // ── 그리기 도구 (점 칸 단위) ──
    // 점 고리 (flat = 세로 납작, step = 점 사이 칸, cut 아래는 안 찍음)
    function ringDots(ctx, px, s, x, y, r, flat, cols, step = 1.5, size = 1, phase = 0, cut = Infinity) {
        if (!(r > 0)) {
            return;
        }
        const W = window.innerWidth;
        const H = Math.min(window.innerHeight, cut);
        const n = clamp(Math.round((TAU * r) / (s * step)), 8, 720);
        const off = ((size - 1) * s) / 2;
        for (let j = 0; j < n; j++) {
            const a = (j / n) * TAU + phase;
            const X = px(x + Math.cos(a) * r - off);
            const Y = px(y + Math.sin(a) * r * flat - off);
            if (X < -8 || Y < -8 || X > W + 8 || Y > H) {
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
        for (let dy = -r; dy <= r; dy += s) {
            const half = Math.sqrt(Math.max(0, r * r - dy * dy)) + (hash(Math.round(dy / s), seed) - 0.5) * 2 * jit;
            if (half <= 0) {
                continue;
            }
            ctx.fillRect(px(x - half), px(y + dy), Math.max(s, px(2 * half)), s);
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
    // 빛 구슬 — 겹 원 + 도는 빛살 + 둘레 점 (광선 입 앞 · 모으기)
    function orbGlow(ctx, px, s, x, y, r, cols, life, ray, hotC, alpha = 1) {
        if (r <= 0) {
            return;
        }
        discs(ctx, px, s, x, y, r, [[1.9, cols[3], 0.28], [1.45, cols[2], 0.8], [1.12, hotC ? cols[0] : cols[1], 1], [0.78, cols[0], 1], [0.42, '#ffffff', 1]], alpha);
        const n = 8;
        ctx.globalAlpha = ray * alpha;
        for (let j = 0; j < n; j++) {
            const a = life * 4 + (j * TAU) / n;
            const len = r * (j % 2 ? 2.1 : 3) * (0.8 + 0.25 * Math.sin(life * 31 + j)) * (hotC ? 1.3 : 1);
            const w = j % 2 ? 1 : 2;
            const ca = Math.cos(a);
            const sa = Math.sin(a);
            for (let d = r * 1.15; d < len; d += s) {
                dotAt(ctx, px, s, x + ca * d - ((w - 1) * s) / 2, y + sa * d - ((w - 1) * s) / 2, d < len * 0.6 ? cols[0] : cols[2], w, w);
            }
        }
        for (let j = 0; j < 6; j++) {
            const a = life * 9 + (j * TAU) / 6;
            dotAt(ctx, px, s, x + Math.cos(a) * r * 2.2, y + Math.sin(a) * r * 2.2, j % 2 ? cols[0] : '#ffffff');
        }
    }
    // 꽉 찬 타원 (가로줄로) — cut 아래 줄은 안 그림 (땅 밑)
    function ellipse(ctx, px, s, x, y, rx, ry, color, alpha = 1, cut = Infinity) {
        if (alpha <= 0.01 || rx < s / 2) {
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
        ctx.globalAlpha = Math.min(1, alpha);
        ctx.fillStyle = color;
        ctx.fill(path);
    }
    // ── 번개 ──
    // 번개 길 — 가운데를 옆으로 밀며 쪼갬 (seg: 가장 짧은 마디, amp: 흔들림, cap: 한 번에 밀리는 최대 px — 넓은 패널에서 너무 휘지 않게)
    function jag(x0, y0, x1, y1, seg, amp = 0.25, cap = Infinity) {
        let pts = [[x0, y0], [x1, y1]];
        for (let d = 0; d < 8; d++) {
            const next = [pts[0]];
            let more = false;
            for (let i = 1; i < pts.length; i++) {
                const [ax, ay] = pts[i - 1];
                const [bx, by] = pts[i];
                const L = Math.hypot(bx - ax, by - ay);
                if (L > seg * 2) {
                    const off = rnd(-1, 1) * Math.min(amp * L, cap);
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
    // 가지 — 줄기 중간에서 비스듬히
    function branchOf(pts, len, seg, cap = Infinity) {
        const i = Math.floor((pts.length - 1) * rnd(0.15, 0.75));
        const [ax, ay] = pts[i];
        const [bx, by] = pts[Math.min(pts.length - 1, i + 1)];
        const a = Math.atan2(by - ay, bx - ax) + pick([-1, 1]) * rnd(0.4, 1.0);
        return jag(ax, ay, ax + Math.cos(a) * len, ay + Math.sin(a) * len, seg, 0.3, cap);
    }
    // 굵은 점 선 (w 칸 굵기) — 다 더한 뒤 fill 한 번이라 겹쳐도 진하기 그대로
    function fillPts(ctx, px, s, pts, w, color, alpha = 1) {
        if (!pts || pts.length < 2 || alpha <= 0.01) {
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
        ctx.globalAlpha = Math.min(1, alpha);
        ctx.fillStyle = color;
        ctx.fill(path);
    }
    // 번개 한 줄 — 옅은 바깥 빛 · 색 · 하얀 심
    function drawBolt(ctx, px, s, pts, w, mid, glow, alpha = 1) {
        if (glow) {
            fillPts(ctx, px, s, pts, w * 2 + 3, glow, alpha * 0.3);
        }
        fillPts(ctx, px, s, pts, w + 2, mid, alpha);
        fillPts(ctx, px, s, pts, Math.max(1, w - 1), '#ffffff', alpha);
    }
    // 번개 창 — 갈라진 꼬리 깃 · 마디진 자루 · 톱니 날. (x, y) 가운데, ang 쪽이 끝, grow 0~1 가운데부터 생김
    function drawSpear(ctx, x, y, ang, L, Wd, C, cols, life, grow, alpha) {
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        const half = L / 2;
        const ext = Math.abs(ca) * half + Math.abs(sa) * Wd + C * 2;
        const eyt = Math.abs(sa) * half + Math.abs(ca) * Wd + C * 2;
        const frame = Math.floor(life / 0.05);
        const snap = (v) => Math.round(v / C) * C;
        const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D()];
        const vis = half * grow;
        for (let gy = snap(y - eyt); gy <= y + eyt; gy += C) {
            for (let gx = snap(x - ext); gx <= x + ext; gx += C) {
                const dx = gx + C / 2 - x;
                const dy = gy + C / 2 - y;
                const a = dx * ca + dy * sa;
                if (Math.abs(a) > vis) {
                    continue;
                }
                const b = Math.abs(-dx * sa + dy * ca);
                const f = (a + half) / L;
                let hw;
                if (f < 0.14) {
                    hw = Wd * (0.72 - 3.2 * f);
                    if (f < 0.1 && b < Wd * 0.3 * (1 - f / 0.1)) {
                        continue;
                    }
                } else if (f < 0.6) {
                    hw = Wd * (0.26 + 0.08 * (Math.round(a / (C * 3)) & 1));
                } else if (f < 0.67) {
                    hw = Wd * (0.3 + (0.7 * (f - 0.6)) / 0.07);
                } else {
                    hw = Wd * (1 - (f - 0.67) / 0.33);
                }
                hw += (hash(Math.round(a / C), frame) - 0.5) * C * 0.8;
                if (b > hw * 1.25 + C * 2) {
                    continue;
                }
                const r = b / Math.max(C, hw);
                paths[r > 1 ? 4 : r > 0.8 ? 3 : r > 0.52 ? 2 : r > 0.24 ? 1 : 0].rect(gx, gy, C, C);
            }
        }
        ctx.globalAlpha = alpha * 0.4;
        ctx.fillStyle = cols[2];
        ctx.fill(paths[4]);
        ctx.globalAlpha = alpha;
        ['#ffffff', cols[1], cols[2], cols[3]].forEach((c, i) => {
            ctx.fillStyle = c;
            ctx.fill(paths[i]);
        });
    }

    // ── 입자 모양 · 움직임 (한 번만 만들어 둔 함수) ──
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
        // 땅 밑으로 가면 사라짐
        under: (p) => {
            if (p.y > p.floorY) {
                p.life = p.max;
            }
        },
        // 좌우로 하늘하늘 (땅 밑이면 사라짐)
        sway: (p) => {
            p.x += Math.sin(p.ph + p.life * 6) * 0.35 * p.s;
            if (p.y > p.floorY) {
                p.life = p.max;
            }
        },
    };
    const DR = {
        pull: (ctx, p, t, px) => {
            if (p.y > p.floorY) {
                return;
            }
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
        leaf: (ctx, p, t, px) => {
            const flat = Math.floor(p.life / 0.08) % 2 === 0;
            ctx.globalAlpha = fadeInOut(t, 0.1, 0.3);
            dotAt(ctx, px, p.s, p.x, p.y, p.color, flat ? 2 : 1, flat ? 1 : 2);
        },
        // 번쩍 — 큰 반짝이 커졌다 작아짐
        flare: floorDraw((ctx, p, t, px) => {
            ctx.globalAlpha = 1;
            bigSparkle(ctx, px, p.s, p.x, p.y, p.len * Math.sin(Math.PI * k01(t)), p.cols[0], p.cols[1], p.thick ?? 3);
        }),
        // 퍼지는 · 좁혀 드는 고리 (life 가 음수면 아직 기다림)
        ring: (ctx, p, t, px) => {
            if (p.life < 0) {
                return;
            }
            const r = p.r0 + (p.r1 - p.r0) * easeOut(t);
            ctx.globalAlpha = p.a * (1 - t);
            ringDots(ctx, px, p.s, p.x, p.y, r, p.flat, p.cols, p.step, p.size, 0, p.cut);
        },
        // 불덩이 — 하얀 속부터 식어 가며 커지고, 처음엔 빛살 (땅 밑은 안 그림)
        fireball: floorDraw((ctx, p, t, px) => {
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
        }),
        // 멀리 뻗는 빛살
        rays: floorDraw((ctx, p, t, px) => {
            ctx.globalAlpha = (1 - t) * (Math.floor(p.life / 0.05) % 2 ? 0.65 : 1);
            for (let j = 0; j < p.n; j++) {
                const a = (j / p.n) * TAU + hash(j, 5) * 0.25 + p.a0;
                const len = p.far * (0.4 + 0.6 * easeOut(t * 3)) * (0.75 + 0.25 * hash(j, 6));
                const ca = Math.cos(a);
                const sa = Math.sin(a);
                for (let d = p.r0; d < len; d += p.s * 2) {
                    const w = d < len * 0.35 ? 3 : d < len * 0.7 ? 2 : 1;
                    dotAt(ctx, px, p.s, p.x + ca * d - ((w - 1) * p.s) / 2, p.y + sa * d - ((w - 1) * p.s) / 2, d < len * 0.5 ? '#ffffff' : p.cols[j % 2 ? 0 : 1], w, w);
                }
            }
        }),
        // 땅에 남는 빛 자국 — 땅 위 반쪽만
        scorch: (ctx, p, t, px) => {
            ctx.globalAlpha = 0.6 * (1 - t);
            const rx = p.R * 1.1;
            const ry = Math.max(p.s * 2, p.R * 0.12);
            for (let dy = -ry; dy < 0; dy += p.s) {
                const half = rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2));
                ctx.fillStyle = t < 0.5 && dy > -ry * 0.5 ? p.hot : '#1a120c';
                ctx.fillRect(px(p.x - half), px(p.y + dy), Math.max(p.s, px(2 * half)), p.s);
            }
        },
    };

    // ── 입자 만들기 ──
    // 한 점으로 빨려 드는 빛 — floorY 를 주면 땅 밑에서 시작하지 않게 위쪽으로 뒤집음
    function pullIn(c, r0, s, cols, max, o = {}) {
        if (!room()) {
            return;
        }
        const flat = o.flat ?? 1;
        const floorY = o.floorY ?? 1e9;
        let a0 = o.a0 ?? rnd(0, TAU);
        if (c.y + Math.sin(a0) * r0 * flat > floorY - s) {
            a0 = -a0;
        }
        sigParticle({ x: c.x + Math.cos(a0) * r0, y: c.y + Math.sin(a0) * r0 * flat, s, c, a0, r0, max, flat, floorY, spin: o.spin ?? 0, pow: o.pow ?? 2, color: pick(cols), size: o.size ?? (Math.random() < 0.3 ? 2 : 1), update: UP.pull, draw: DR.pull });
    }
    // 튀는 조각 — ang ± spread 쪽으로 (없으면 사방). floorY 를 주면 땅에서 튐
    function spray(x, y, s, cols, n, sp0, sp1, o = {}) {
        for (let i = 0; i < n && room(); i++) {
            const a = o.spread === undefined ? rnd(0, TAU) : (o.ang ?? 0) + rnd(-o.spread, o.spread);
            const sp = rnd(sp0, sp1);
            sigParticle({
                x: x + (o.jx ? rnd(-o.jx, o.jx) : 0), y: y + (o.jy ? rnd(-o.jy, o.jy) : 0), s,
                vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + (o.up ?? 0), g: o.g ?? 0, drag: o.drag ?? 1.5, max: rnd(o.life0 ?? 0.35, o.life1 ?? 0.7),
                color: pick(cols), cols: o.cols || cols, size: o.size ?? pick([1, 1, 2]), r: o.r ?? 2, floorY: o.floorY ?? 1e9,
                update: o.floorY === undefined ? undefined : o.g ? UP.bounce : UP.under, draw: o.draw || DR.streak,
            });
        }
    }
    function ring(x, y, s, r0, r1, flat, sec, cols, o = {}) {
        sigParticle({ x, y, s, r0, r1, flat, max: sec, cols, size: o.size ?? 1, step: o.step ?? 1.5, a: o.a ?? 1, cut: o.cut ?? Infinity, life: -(o.delay ?? 0), draw: DR.ring });
    }
    // 반짝이 — 사방으로
    function glitter(x, y, s, cols, n, sp0, sp1, floorY) {
        for (let i = 0; i < n && room(); i++) {
            const a = rnd(0, TAU);
            const sp = rnd(sp0, sp1);
            sigParticle({ x, y, s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 2, max: rnd(0.4, 0.8), cols, floorY, update: UP.under, draw: DRAW.sparkle });
        }
    }
    // 발밑에서 솟는 기운
    function riseAt(D, X, cols) {
        if (!room()) {
            return;
        }
        const Z = X.st.Z;
        const R = Math.max(X.w, 40);
        sigParticle({ x: X.body.cx + rnd(-1, 1) * R * 0.5, y: D.ground - rnd(1, 3) * X.S, s: X.S, vx: rnd(-6, 6) * Z, vy: -rnd(60, 140) * Z, drag: 0.8, max: rnd(0.35, 0.7), color: pick(cols), size: pick([1, 1, 2]), draw: DR.streak });
    }
    // 구체 스타일마다 튀는 것 (불티 · 그림자 연기 · 물방울 · 얼음 · 잎 · 빛)
    function orbBits(style, x, y, s, cols, n, Z, o = {}) {
        const floorY = o.floorY ?? 1e9;
        for (let i = 0; i < n && room(); i++) {
            const a = o.ang !== undefined ? o.ang + rnd(-(o.spread ?? 0.6), o.spread ?? 0.6) : rnd(0, TAU);
            const sp = rnd(o.sp0 ?? 20, o.sp1 ?? 80) * (o.raw ? 1 : Z);
            const jit = o.jit ?? 0;
            const b = { x: x + rnd(-1, 1) * jit, y: y + rnd(-1, 1) * jit, s, vx: Math.cos(a) * sp + (o.vx ?? 0), vy: Math.sin(a) * sp + (o.vy ?? 0), floorY, update: UP.under };
            if (style === 'flame') {
                if (Math.random() < 0.3) {
                    sigParticle({ ...b, g: 60 * Z, drag: 1, max: rnd(0.5, 1), color: pick([cols[0], cols[1], '#ffffff']), ph: rnd(0, TAU), draw: DR.ember });
                } else {
                    sigParticle({ ...b, g: -50 * Z, drag: 2.2, max: rnd(0.3, 0.55), cols, grow: 2.5, draw: DRAW.stream });
                }
            } else if (style === 'shadow') {
                sigParticle({ ...b, vy: b.vy - 15 * Z, drag: 1.6, max: rnd(0.5, 0.9), size: pick([2, 2, 3]), grow: 0.8, cols: [cols[2], cols[3], '#1a0b2e'], a: 0.8, ph: rnd(0, TAU), update: UP.sway, draw: DR.puff });
            } else if (style === 'water') {
                sigParticle({ ...b, g: 380 * Z, drag: 0.5, max: rnd(0.4, 0.8), color: pick(cols), size: pick([1, 2]), draw: DR.streak });
            } else if (style === 'ice') {
                sigParticle({ ...b, g: 60 * Z, drag: 1.2, max: rnd(0.4, 0.8), cols: ['#ffffff', '#ffffff', cols[1], cols[2]], draw: DRAW.sparkle });
            } else if (style === 'leaf') {
                sigParticle({ ...b, g: 30 * Z, drag: 1, max: rnd(0.6, 1.1), color: pick(cols.slice(1)), ph: rnd(0, TAU), update: UP.sway, draw: DR.leaf });
            } else if (style === 'aura') {
                sigParticle({ ...b, drag: 2, max: rnd(0.3, 0.6), cols, draw: DRAW.sparkle });
            } else {
                sigParticle({ ...b, drag: 2, max: rnd(0.3, 0.6), color: pick([...cols, '#ffffff']), size: pick([1, 1, 2]), draw: DR.streak });
            }
        }
    }
    // 대폭발 — 튀는 조각 · 불덩이 · 충격파 · 연기 · 불똥 · 그을린 땅. R = 불덩이 반지름 (땅 밑은 안 그림)
    function explode(D, X, x, y, R, cols, o = {}) {
        const S = X.S;
        const Z = X.st.Z;
        const ground = D.ground;
        const n = Math.round(o.n ?? 50);
        for (let i = 0; i < n && room(); i++) {
            const a = rnd(0, TAU);
            const sp = rnd(1.2, 3.2) * Math.min(R, 200) + 50 * Z;
            sigParticle({ x, y, s: S, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60 * Z, g: 380 * Z, drag: 1.6, max: rnd(0.6, 1.1), color: pick(o.debris || [...cols, '#ffffff']), size: pick([1, 2, 2, 3]), floorY: ground, update: UP.bounce, draw: DR.streak });
        }
        if (o.style) {
            orbBits(o.style, x, y, S, cols, Math.round(n * 0.5), Z, { sp0: Math.min(R, 200) * 0.8, sp1: Math.min(R, 200) * 2.2, raw: true, floorY: ground });
        }
        if (o.sparkle) {
            glitter(x, y, S, o.sparkle, Math.round(n * 0.6), 80 * Z, 300 * Z, ground);
        }
        sigParticle({ x, y, s: S, max: o.sec ?? 0.9, R, cols, rays: o.rays ?? 12, floorY: ground, draw: DR.fireball });
        ring(x, y, S, R * 0.3, R * 2.2, 1, 0.5, ['#ffffff', cols[0], '#ffffff'], { size: 2, cut: ground });
        ring(x, y, S, R * 0.4, R * 1.6, 0.85, 0.75, [cols[1], cols[2]], { delay: 0.08, cut: ground });
        if (ground - y < R * 1.5) {
            ring(x, ground - S, S, R * 0.5, R * 3.2, clamp(14 / (R * 3.2), 0.04, 0.2), 0.8, [cols[1], '#ffffff', cols[2]], { size: 2, cut: ground });
        }
        for (let i = 0; i < (o.smoke ?? 10) && room(); i++) {
            const a = rnd(0, TAU);
            const rr = rnd(0.2, 0.8) * R;
            sigParticle({ x: x + Math.cos(a) * rr, y: Math.min(ground - 3 * S, y + Math.sin(a) * rr * 0.7), s: S, vx: Math.cos(a) * rnd(5, 25) * Z, vy: -rnd(10, 35) * Z, drag: 0.6, max: rnd(1.0, 1.6), size: Math.round(rnd(3, 6)), grow: 1, cols: ['#d9d9d9', '#a8a8a8', '#7a7a7a', '#4a4a4a'], a: 0.5, draw: DR.puff });
        }
        for (let i = 0; i < (o.embers ?? 18) && room(); i++) {
            sigParticle({ x: x + rnd(-1, 1) * R, y: Math.min(ground - S, y + rnd(-0.6, 0.6) * R), s: S, vx: rnd(-20, 20) * Z, vy: -rnd(20, 70) * Z, drag: 0.5, max: rnd(0.9, 1.6), color: pick([cols[0], cols[1], '#ffffff']), ph: rnd(0, TAU), draw: DR.ember });
        }
        if (ground - y < R * 1.4) {
            sigParticle({ x, y: ground, s: S, max: (o.sec ?? 0.9) + 0.9, R: Math.min(R, D.W * 0.6), hot: cols[2], draw: DR.scorch });
        }
    }
    // 멀리 뻗는 빛살 한 번
    function burstRays(D, X, x, y, r0, cols, n = 16) {
        sigParticle({ x, y, s: X.S, max: 0.6, far: Math.hypot(D.W, D.H) * 0.7, n, r0, a0: rnd(0, 1), cols, floorY: D.ground, draw: DR.rays });
    }

    // ══════════ beam — ultbeam: 곧은 굵은 광선 (겹 빛 · 흐르는 빛줄 · 고리 · 반짝이 · 나선 · 두 줄 · 물결 · 무지개) ══════════
    const BEATS = [0.3, 0.55, 0.8];
    function beamInit(D, X, st) {
        const o = X.o;
        const S = X.S;
        const base = o.c || (o.solar ? 'solar' : 'hyper');
        st.cols = sigPal(base);
        st.spk = sigPal(o.sparkle || base);
        const roomY = Math.max(3 * S, (D.ground - X.y0 - S) / 1.42); // 바깥 빛까지 땅 위에
        st.h = clamp(D.lane * 0.8 * clamp(o.width ?? 1, 0.6, 2) * (0.9 + 0.2 * st.P), 3 * S, roomY); // 반 굵기
        st.dbl = !!o.double;
        st.hb = st.dbl ? st.h * 0.64 : st.h; // 한 줄 반 굵기
        st.sep = st.dbl ? st.h * 0.55 : 0; // 두 줄이 가운데서 떨어진 정도
        st.lines = st.dbl ? [-1, 1] : [0];
        st.flow = Math.max(700, D.W * 1.6); // 빛이 흐르는 빠르기
        st.orbR = Math.max(3 * S, (st.sep + st.hb) * 1.1);
        st.layers = [[1.35, st.cols[3], 0.32], [1, st.cols[2], 0.95], [0.74, st.cols[1], 1], [0.5, st.cols[0], 1], [0.24, '#ffffff', 1]];
        st.rings = [];
        st.nextRing = 0;
        st.spray = 0;
        st.dust = 0;
        st.edgeAcc = 0;
        st.arcs = [];
        st.nextArc = 0;
        st.beats = 0;
        st.ys = [];
        st.hs = [];
    }
    // 모으는 구슬 크기 — 커지며 세 번 두근, 끝에 확 움츠러듦
    function beamChargeR(st, k, t) {
        let r = st.orbR * (0.12 + 0.88 * smooth(k / 0.85));
        for (const b of BEATS) {
            const d = (k - b) / 0.07;
            if (d > 0 && d < 1) {
                r *= 1 + 0.35 * Math.sin(d * Math.PI);
            }
        }
        if (k > 0.9) {
            r *= 1 - 0.45 * ((k - 0.9) / 0.1);
        }
        return r * (1 + 0.08 * Math.sin(t * 40));
    }
    // 솔라 — 하늘에서 햇빛 기둥이 내려와 x0 로 모임
    function solarPillar(D, X, st) {
        const S = X.S;
        const hw = Math.max(D.lane * 0.9, st.h * 1.1);
        const sx = X.x0;
        sigParticle({ x: sx, y: 0, s: S, max: DUEL_CHARGE + 0.6, floorY: D.ground, draw: floorDraw((ctx, p) => {
            const px = st.px;
            const k = smooth(p.life / DUEL_CHARGE);
            const a = p.life > DUEL_CHARGE ? Math.max(0, 1 - (p.life - DUEL_CHARGE) / 0.6) : 1;
            const x0 = px(sx - hw);
            const x1 = px(sx + hw);
            ctx.globalAlpha = (0.1 + 0.2 * k) * a;
            ctx.fillStyle = '#fff6a8';
            ctx.fillRect(x0, 0, x1 - x0, D.ground);
            ctx.globalAlpha = (0.1 + 0.3 * k) * a;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(px(sx - hw * 0.35), 0, px(hw * 0.7), D.ground);
            const tick = Math.floor(p.life * 12);
            for (let j = 0; j < 6; j++) {
                ctx.globalAlpha = (0.15 + 0.25 * hash(j, tick)) * k * a;
                ctx.fillRect(px(sx + (hash(j, 9) - 0.5) * 1.8 * hw + Math.sin(p.life * 3 + j) * S * 2), 0, S, D.ground);
            }
            discs(ctx, px, S, sx, 0, hw * (0.7 + 0.1 * Math.sin(p.life * 8)), [[1.6, '#fff6a8', 0.25], [1.2, '#fffbd0', 0.6], [0.85, '#ffffff', 1]], k * a);
            ctx.globalAlpha = 0.6 * k * a;
            ringDots(ctx, px, S, sx, D.ground - S, hw * (0.9 + 0.1 * Math.sin(p.life * 10)), 0.22, ['#fffbd0', '#ffffff'], 1.5, 1);
        }) });
    }
    function beamCharge(D, X, k, dt) {
        const st = X.st;
        const S = X.S;
        const Z = st.Z;
        const C = { x: X.x0, y: X.y0 };
        if (!st.charging) {
            st.charging = true;
            chargeArt(D, X, (ctx, px, kk, t) => {
                orbGlow(ctx, px, S, C.x, C.y, beamChargeR(st, kk, t) * Math.min(0.8, (D.half * 0.3) / st.orbR), st.cols, t, 0.3 + 0.5 * kk, kk > 0.9);
                ctx.globalAlpha = 1;
                st.arcs.forEach((a) => zapLine(ctx, px, S, a, 1, st.cols[1]));
            });
            if (X.o.solar) {
                solarPillar(D, X, st);
            }
        }
        // 빛이 빨려 듦 (솔라면 하늘에서)
        st.acc += dt * (50 + 60 * st.P) * (1 + 2.2 * k) * Math.min(1.4, Z);
        while (st.acc >= 1) {
            st.acc -= 1;
            if (X.o.solar && Math.random() < 0.55) {
                pullIn(C, rnd(0.5, 1) * Math.max(C.y, 30), S, ['#ffffff', ...st.cols], rnd(0.3, 0.45), { a0: -Math.PI / 2 + rnd(-0.2, 0.2), pow: 1.6, floorY: D.ground });
            } else {
                pullIn(C, Math.max(st.h * 2.6, D.lane * 2.2) * rnd(0.9, 1.7), S, [...st.cols, '#ffffff'], rnd(0.22, 0.34) * (1 - 0.3 * k), { spin: X.dir * rnd(0.3, 0.9), floorY: D.ground });
            }
        }
        // 두근 — 좁혀 드는 고리 · 튀는 빛 · 몸 떨림
        while (st.beats < BEATS.length && k >= BEATS[st.beats]) {
            st.beats += 1;
            const r = st.orbR * (0.5 + 0.25 * st.beats);
            ring(C.x, C.y, S, r * 4, r * 0.8, 1, 0.25, [st.cols[0], '#ffffff', st.cols[2]], { cut: D.ground });
            spray(C.x, C.y, S, [...st.cols, '#ffffff'], 8, 60 * Z, 130 * Z, { drag: 3, floorY: D.ground });
            tremble(X, 0.4 * S * st.beats, 200);
        }
        // 구슬 둘레 번개 — 0.07초마다 새로
        if (D.t >= st.nextArc) {
            st.nextArc = D.t + 0.07;
            st.arcs = [];
            if (k > 0.3) {
                for (let j = 0; j < 2; j++) {
                    const a = rnd(0, TAU);
                    const r0 = beamChargeR(st, k, D.t) * 1.2;
                    const r1 = r0 + st.orbR * rnd(1, 2);
                    st.arcs.push(zigzag(C.x + Math.cos(a) * r0, C.y + Math.sin(a) * r0, C.x + Math.cos(a) * r1, C.y + Math.sin(a) * r1, S, 1.5));
                }
            }
        }
    }
    // 나선 띠 — 광선을 감고 돎 (뒤쪽은 광선 밑, 앞쪽은 위)
    function beamSpiral(ctx, px, D, X, n, L, front, fade) {
        const st = X.st;
        const S = X.S;
        const t = D.t;
        const pitch = st.h * 0.64;
        for (let strand = 0; strand < 2; strand++) {
            ctx.globalAlpha = fade * (front ? 1 : 0.7);
            const c = front ? (strand ? '#ffffff' : st.spk[1]) : strand ? st.cols[2] : st.spk[2];
            const sz = front ? 2 : 1;
            for (let d = st.h * 0.8; d < L; d += S) {
                const ph = d / pitch - t * 13 + strand * Math.PI;
                const depth = Math.cos(ph);
                if (depth > 0 !== front) {
                    continue;
                }
                const i = Math.min(n - 1, Math.floor(d / (2 * S)));
                const y = st.ys[i] + Math.sin(ph) * st.hs[i] * 1.38;
                const w = front && depth > 0.5 ? sz + 1 : sz;
                const x = X.x0 + X.dir * d;
                if (front) {
                    // 테두리 (진한 색) — 밝은 광선 위에서도 띠가 보이게
                    dotAt(ctx, px, S, x - (w * S) / 2, y - (w * S) / 2 - S, st.cols[3], w, 1);
                }
                dotAt(ctx, px, S, x - ((w - 1) * S) / 2, y - ((w - 1) * S) / 2, c, w, w);
            }
        }
    }
    function beamDraw(ctx, px, D, X) {
        const st = X.st;
        const S = X.S;
        const o = X.o;
        const { cols, spk, layers, lines, sep, ys, hs } = st;
        const t = D.t;
        const dir = X.dir;
        const x0 = X.x0;
        const tip = tipOf(D, X, 0.14);
        const L = Math.abs(tip - x0);
        const fade = X.fade;
        if (L < S) {
            return;
        }
        const burst = 1 + 0.45 * Math.max(0, 1 - (t - DUEL_CHARGE) / 0.2);
        const pulse = 1 + 0.06 * Math.sin(t * 44) + 0.035 * Math.sin(t * 97);
        const sc = force(D, X) * burst * pulse; // 굵기 — 길이 따라 같고 시간에 따라서만 두근 (휘거나 불룩하지 않게)
        const glow = hot(X);
        const seg = 2 * S;
        const n = Math.max(1, Math.ceil(L / seg));
        const tick = Math.floor(t * 30);
        const flare = st.h * 2.8;
        // 물결 — 입 쪽 · 앞머리 쪽은 줄여서 앞머리는 ym 에
        const wave = (d) => (o.wave ? Math.sin(d / st.h - t * 15) * st.h * 0.45 * smooth(d / flare) * smooth((L - d) / flare) : 0);
        const xAt = (d, w) => (dir > 0 ? x0 + d : x0 - d - w);
        for (const ln of lines) {
            for (let i = 0; i < n; i++) {
                const spread = lerp(clamp((st.orbR * 0.75) / st.hb, 0.25, 1), 1, smooth((i * seg) / (st.h * 3))); // 나팔 모양 — 입 앞 빛 구에서 가늘게 시작
                ys[i] = X.y0 + ln * sep * spread + wave(i * seg + seg / 2);
                hs[i] = st.hb * sc * spread;
            }
            if (o.spiral) {
                beamSpiral(ctx, px, D, X, n, L, false, fade);
            }
            // 겹겹 빛줄기 — 바깥 두 겹은 가장자리가 지글지글, 밀 땐 하얀 속이 굵게
            for (let li = 0; li < layers.length; li++) {
                const [m0, col, a] = layers[li];
                const m = li >= 3 ? m0 * (1 + 0.5 * glow) : m0;
                ctx.globalAlpha = a * fade;
                ctx.fillStyle = o.rainbow && li >= 3 ? '#ffffff' : col;
                for (let i = 0; i < n; i++) {
                    const h = hs[i] * m + (li < 2 ? (hash(i, tick + li * 7) - 0.5) * 2.5 * S : 0);
                    if (h < S * 0.5) {
                        continue;
                    }
                    if (o.rainbow && li < 3) {
                        ctx.fillStyle = hue(((i * seg) / S) * 5 - t * 700 + li * 40, [45, 58, 72][li]);
                    }
                    const d = i * seg;
                    const w = Math.min(seg, L - d);
                    const top = px(ys[i] - h);
                    ctx.fillRect(px(xAt(d, w)), top, Math.max(S, px(w)), Math.max(S, px(ys[i] + h) - top));
                }
            }
            // 빠르게 흐르는 빛줄 — 하얀 속엔 진한 줄, 바깥 겹엔 하얀 줄
            ctx.globalAlpha = 0.9 * fade;
            for (let j = 0; j < 16; j++) {
                const core = j % 3 === 0;
                const len = (5 + hash(j, 2) * 12) * S;
                const d = (hash(j, 4) * 1000 + t * st.flow * (0.45 + hash(j, 3) * 0.5)) % Math.max(L, 1);
                const ll = Math.min(len, L - d);
                if (ll < S) {
                    continue;
                }
                const i = Math.min(n - 1, Math.floor(d / seg));
                const off = core ? (hash(j, 1) - 0.5) * 0.5 : (hash(j, 1) < 0.5 ? -1 : 1) * (0.55 + 0.4 * hash(j, 5));
                ctx.fillStyle = core ? (o.rainbow ? hue(j * 40 + t * 500, 60) : cols[2]) : '#ffffff';
                ctx.fillRect(px(xAt(d, ll)), px(ys[i] + off * hs[i]), Math.max(S, px(ll)), S);
            }
            // 속 반짝
            ctx.globalAlpha = fade;
            for (let j = 0; j < 4; j++) {
                const d = Math.random() * L;
                const i = Math.min(n - 1, Math.floor(d / seg));
                drawStar(ctx, px, S, x0 + dir * d, ys[i] + (Math.random() - 0.5) * 1.5 * hs[i], Math.random() < 0.3 ? 2 : 1, spk);
            }
            // 광선을 따라 나가는 고리 (밀어붙일 때 굵은 고리)
            for (const r of st.rings) {
                const d = (t - r.b) * st.flow * 0.5;
                if (d > L) {
                    continue;
                }
                const i = Math.min(n - 1, Math.floor(d / seg));
                const ry = hs[i] * (r.big ? 1.8 : 1.45) + 3 * S;
                const sz = r.big ? 2 : 1;
                ctx.globalAlpha = fade * (1 - (0.5 * d) / Math.max(L, 1));
                const m = Math.max(16, Math.round(ry / S) * 3);
                for (let q = 0; q < m; q++) {
                    const a = (q / m) * TAU;
                    dotAt(ctx, px, S, x0 + dir * d + Math.cos(a) * (r.big ? 4 : 3) * S, ys[i] + Math.sin(a) * ry, q % 2 ? '#ffffff' : o.rainbow ? hue(q * 30 + t * 600, 62) : cols[2], sz, sz);
                }
            }
            if (o.spiral) {
                beamSpiral(ctx, px, D, X, n, L, true, fade);
            }
            // 앞머리 빛 덩어리
            const ie = n - 1;
            discs(ctx, px, S, tip, ys[ie], hs[ie] * 1.25, [[1, cols[1], 1], [0.65, cols[0], 1], [0.35, '#ffffff', 1]], fade);
        }
        // 이긴 뒤 — 화면 끝에 부딪혀 튐
        if (st.wonAt !== undefined && Math.abs(tip - st.edge) < 2 * S) {
            const ex = dir > 0 ? D.W : 0;
            const er = (st.sep + st.hb) * sc * (1.4 + 0.25 * Math.random());
            discs(ctx, px, S, ex, X.y0, er, [[1.25, cols[3], 0.4], [1, cols[2], 0.9], [0.75, cols[1], 1], [0.5, cols[0], 1], [0.28, '#ffffff', 1]], fade);
            ctx.globalAlpha = fade;
            for (let j = 0; j < 9; j++) {
                const a = (dir > 0 ? Math.PI : 0) + (j - 4) * 0.33 + (Math.random() - 0.5) * 0.2;
                const len = er * (1.3 + Math.random() * 1.2);
                for (let d = er * 0.8; d < len; d += S) {
                    const w = d < len * 0.55 ? 2 : 1;
                    dotAt(ctx, px, S, ex + Math.cos(a) * d, X.y0 + Math.sin(a) * d, d < len * 0.6 ? '#ffffff' : cols[1], w, w);
                }
            }
        }
        // 입 앞 구슬 (쓰는 애를 가리지 않게 작게 · 가까운 상대면 더 작게)
        const r = Math.min(st.orbR * 0.55 * (0.8 + 0.2 * sc), Math.max(2 * S, D.half * 0.2)) * (1 + 0.1 * Math.sin(t * 50));
        orbGlow(ctx, px, S, x0, X.y0, r, cols, t, 0.45, glow > 0.3, fade);
    }
    function beamTick(D, X, dt) {
        const st = X.st;
        const S = X.S;
        const Z = st.Z;
        const t = D.t;
        const dir = X.dir;
        const tip = tipOf(D, X, 0.14);
        const L = Math.abs(tip - X.x0);
        if (t >= st.nextRing) {
            st.nextRing = t + (X.pushing > 0 ? 0.055 : 0.085);
            st.rings.push({ b: t });
        }
        st.rings = st.rings.filter((r) => (t - r.b) * st.flow * 0.5 < L + st.h);
        if (L < 2 * S || X.fade < 0.3) {
            return;
        }
        // 흩날리는 빛 (sparkle 색)
        st.spray = Math.min(6, st.spray + dt * (60 + 60 * st.P) * (1 + hot(X)) * Z);
        while (st.spray >= 1 && room()) {
            st.spray -= 1;
            const d = Math.random() * L;
            const side = Math.random() < 0.5 ? -1 : 1;
            const y = X.y0 + pick(st.lines) * st.sep + side * st.hb * 0.6;
            sigParticle({ x: X.x0 + dir * d, y, s: S, vx: dir * rnd(30, 160) * Z, vy: side * rnd(30, 130) * Z, drag: 2.2, max: rnd(0.3, 0.55), cols: st.spk, floorY: D.ground, update: UP.under, draw: DRAW.sparkle });
        }
        // 아직 안 만났을 때 · 뚫고 나갈 때 — 앞머리에서 튀는 빛
        if ((D.phase === 'go' || D.phase === 'through') && room(3)) {
            spray(tip, X.y0, S, [...st.cols, '#ffffff'], 2, 80 * Z, 220 * Z, { ang: dir > 0 ? 0 : Math.PI, spread: 1.2, drag: 2.5, floorY: D.ground });
        }
        // 광선 밑 땅 먼지
        if (D.ground - (X.y0 + st.sep + st.hb) < st.h * 2.5) {
            st.dust = Math.min(3, st.dust + dt * 30 * Z);
            while (st.dust >= 1 && room()) {
                st.dust -= 1;
                sigParticle({ x: X.x0 + dir * Math.random() * L, y: D.ground - S, s: S, vx: dir * rnd(10, 60) * Z, vy: -rnd(40, 110) * Z, g: 200 * Z, drag: 1, max: rnd(0.35, 0.6), color: pick([st.cols[3], st.cols[2], '#9a9a9a']), size: pick([1, 2]), floorY: D.ground, update: UP.bounce, draw: DR.streak });
            }
        }
        // 이긴 뒤 — 화면 끝에서 튀는 빛
        if (st.wonAt !== undefined && Math.abs(tip - st.edge) < 2 * S && X.fade > 0.5) {
            st.edgeAcc = Math.min(5, st.edgeAcc + dt * 80 * Z);
            while (st.edgeAcc >= 1 && room()) {
                st.edgeAcc -= 1;
                const a = (dir > 0 ? Math.PI : 0) + rnd(-1.2, 1.2);
                const sp = rnd(80, 280) * Z;
                sigParticle({ x: dir > 0 ? D.W - S : S, y: X.y0 + rnd(-0.5, 0.5) * st.h, s: S, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 300 * Z, drag: 1.2, max: rnd(0.35, 0.6), color: pick([...st.cols, ...st.spk, '#ffffff']), size: pick([1, 2, 2]), floorY: D.ground, update: UP.bounce, draw: DR.streak });
            }
        }
    }
    function beamPush(D, X, strong) {
        if (!strong) {
            return;
        }
        const st = X.st;
        const S = X.S;
        const Z = st.Z;
        st.rings.push({ b: D.t, big: true });
        ring(X.x0, X.y0, S, st.orbR, st.orbR * 3.2, 1, 0.4, ['#ffffff', st.cols[0], st.cols[1]], { size: 2, cut: D.ground });
        spray(X.x0, X.y0, S, [...st.spk, '#ffffff'], 14, 140 * Z, 320 * Z, { ang: X.dir > 0 ? 0 : Math.PI, spread: 0.6, drag: 2.4, floorY: D.ground });
        recoil(X, 3 * S);
    }
    // 이김 — 진 쪽 몸을 뚫고 화면 끝까지 · 몸에서 빛 대폭발
    function beamWin(D, X, L) {
        const st = X.st;
        const S = X.S;
        const Z = st.Z;
        const { cx, cy } = L.body;
        const y = Math.min(cy, D.ground - 2 * S);
        const R = clamp(D.lane * 2.2 * (0.85 + 0.3 * st.P) * Math.sqrt(clamp(X.o.width ?? 1, 0.6, 2)), 14, D.H * 0.42);
        explode(D, X, cx, y, R, st.cols, { n: 40, rays: 12, smoke: 6, embers: 14, sparkle: st.spk });
        // 뚫고 나감 — 앞으로 길게 튀는 빛 · 광선에 수직인 고리
        spray(cx, X.y0, S, [...st.spk, '#ffffff', st.cols[1]], 30, 220 * Z, 520 * Z, { ang: X.dir > 0 ? 0 : Math.PI, spread: 0.45, drag: 2, floorY: D.ground, life0: 0.3, life1: 0.6 });
        ring(cx, X.y0, S, 2 * S, st.h * 1.6, 2.2, 0.35, ['#ffffff', st.cols[0]], { size: 2, cut: D.ground });
        ring(cx, X.y0, S, st.h, st.h * 4.5, 1, 0.5, [st.cols[1], '#ffffff', st.spk[2]], { delay: 0.05, cut: D.ground });
        sigParticle({ x: cx, y, s: S, max: 0.45, len: R * 1.8, thick: 4, cols: ['#ffffff', st.spk[1]], floorY: D.ground, draw: DR.flare });
        recoil(X, 6 * S, 420);
    }

    // ══════════ bolt — ultvolt 1000만볼트(무지개 번개 다발) · ultthunder spear(번개 창) / pillar(번개 사슬 + 기둥) ══════════
    function boltInit(D, X, st) {
        const o = X.o;
        const S = X.S;
        st.mode = X.fx === 'ultvolt' ? 'volt' : o.mode === 'pillar' ? 'pillar' : 'spear';
        st.cols = sigPal(o.c || 'electric');
        st.rainbow = X.fx === 'ultvolt' ? !(o.rainbow === 0 || o.rainbow === false || o.rainbow === '0') : !!o.rainbow;
        st.bw = clamp(Math.round((D.lane * 0.3 * (0.8 + 0.4 * st.P)) / S), 2, 6); // 줄기 굵기 (칸)
        st.nb = 4 + (st.P > 0.8 ? 1 : 0);
        st.bolts = [];
        st.arcs = [];
        st.drawn = -1;
        st.lastTip = X.x0;
        st.R0 = clamp(D.lane * 0.55, 3 * S, D.lane);
        st.spark = 0;
        // 창 — 길이 · 굵기 · 칸, 모으는 자리 (머리 위 조금 뒤)
        st.Ls = clamp(D.lane * 6.5 * (0.85 + 0.25 * st.P), 40, Math.max(40, D.W * 0.3));
        st.Wd = Math.max(2 * S, Math.min(st.Ls * 0.15, D.lane * 1.1, (D.ground - X.y0) * 0.75));
        st.C = S * Math.max(1, Math.round(st.Ls / (70 * S)));
        st.hold = { x: X.x0 - X.dir * st.Ls * 0.3, y: Math.max(st.Wd * 2 + 2 * S, X.y0 - D.lane * 2.2) };
        st.strikes = 0;
        // 기둥 — 굵기 · 마디 간격
        st.pw = clamp(D.W * 0.035, 8, 26) * (0.85 + 0.3 * st.P);
        st.gap = clamp(D.lane * 3.2, 28, 110);
        st.pillars = [];
        st.nodes = [];
        st.chain = [];
        st.nextPillar = 0;
    }
    // 색 — 무지개면 번호 · 시간에 따라 돌아감
    const bcol = (st, i, t, l = 60) => (st.rainbow ? hue(i * 51 + t * 700, l) : l >= 75 ? st.cols[1] : l <= 50 ? st.cols[3] : st.cols[2]);
    // 번개 한 줄기 입자 — 0.05초마다 다시 그어 지직 (가지 몇 개)
    function strike(D, X, x0, y0, x1, y1, o = {}) {
        const st = X.st;
        const S = X.S;
        const L = Math.hypot(x1 - x0, y1 - y0);
        const seg = Math.max(2 * S, L / 22);
        const make = (q) => {
            q.pts = jag(x0, y0, x1, y1, seg, o.amp ?? 0.2);
            q.br = [];
            for (let b = 0; b < (o.branches ?? 2); b++) {
                q.br.push(branchOf(q.pts, L * rnd(0.12, 0.3), seg));
            }
        };
        const q0 = { x: x1, y: y1, s: S, max: o.dur ?? 0.35, floorY: D.ground, drawn: 0 };
        make(q0);
        sigParticle({ ...q0,
            update: (q) => {
                if (q.life - q.drawn > 0.05) {
                    q.drawn = q.life;
                    make(q);
                }
            },
            draw: floorDraw((ctx, q, t, px) => {
                if (t > 0.2 && Math.floor(q.life / 0.035) % 4 === 3) {
                    return;
                }
                const a = t > 0.55 ? (1 - t) / 0.45 : 1;
                const w = (o.w ?? 2) + (q.life < 0.06 ? 2 : 0);
                const mid = o.rainbow ? hue((o.hue ?? 0) + q.life * 900, 62) : o.mid ?? st.cols[2];
                const glow = o.rainbow ? hue((o.hue ?? 0) + q.life * 900 + 40, 50) : o.glow ?? st.cols[3];
                q.br.forEach((b) => drawBolt(ctx, px, S, b, Math.max(1, Math.round(w / 2)), mid, null, a));
                drawBolt(ctx, px, S, q.pts, w, mid, glow, a);
            }),
        });
    }
    // 땅을 기어가는 전기
    function groundArcs(D, X, x, reach, dur, n, w = 1) {
        const st = X.st;
        const S = X.S;
        const y = D.ground - S;
        for (let k = 0; k < n; k++) {
            const side = k % 2 ? -1 : 1;
            const len = reach * rnd(0.6, 1);
            sigParticle({ x, y, s: S, max: dur, drawn: -1, pts: null, k,
                update: (q) => {
                    if (q.life - q.drawn > 0.05) {
                        q.drawn = q.life;
                        const x1 = x + side * len * easeOut(q.life / (dur * 0.55));
                        q.pts = jag(x, y, x1, y + rnd(-1, 1) * S * 2, Math.max(2 * S, len / 16), 0.07).map(([a, b]) => [a, Math.min(D.ground - S, b)]);
                    }
                },
                draw: (ctx, q, t, px) => q.pts && drawBolt(ctx, px, S, q.pts, w, bcol(st, q.k + 3, q.life, 65), null, 1 - t * t),
            });
        }
    }
    // 전기 대폭발 — 빛 덩어리가 커졌다 사그라듦 + 가시 번개 (땅 밑은 안 그림)
    function zapBoom(D, X, x, y, R) {
        const st = X.st;
        const S = X.S;
        const cols = st.cols;
        sigParticle({ x, y, s: S, max: 0.9, floorY: D.ground, drawn: -1, spikes: [],
            update: (q) => {
                if (q.life - q.drawn > 0.05) {
                    q.drawn = q.life;
                    const r = R * easeOut(q.life / 0.25);
                    q.spikes = [];
                    for (let j = 0; j < 9; j++) {
                        const a = (j / 9) * TAU + rnd(-0.2, 0.2);
                        const len = r * rnd(1.1, 1.6);
                        q.spikes.push(jag(x, y, x + Math.cos(a) * len, Math.min(D.ground, y + Math.sin(a) * len), 3 * S, 0.25));
                    }
                }
            },
            draw: floorDraw((ctx, q, t, px) => {
                const r = R * easeOut(q.life / 0.25);
                const a = q.life < 0.3 ? 1 : Math.max(0, 1 - (q.life - 0.3) / 0.6);
                ellipse(ctx, px, S, x, y, r, r * 0.92, bcol(st, 0, q.life, 48), 0.35 * a);
                ellipse(ctx, px, S, x, y, r * 0.8, r * 0.75, bcol(st, 1, q.life, 60), 0.75 * a);
                ellipse(ctx, px, S, x, y, r * 0.6, r * 0.56, bcol(st, 2, q.life, 82), a);
                ellipse(ctx, px, S, x, y, r * 0.36 * (1 - t * 0.6), r * 0.34 * (1 - t * 0.6), '#ffffff', a);
                q.spikes.forEach((p) => drawBolt(ctx, px, S, p, 2, cols[2], cols[3], a));
            }),
        });
    }
    // 몸 둘레 지직
    function bodyArcs(D, X, st, m) {
        const S = X.S;
        const b = X.body;
        const R = Math.max(b.rx, b.ry, 8);
        st.arcs = [];
        for (let j = 0; j < m; j++) {
            const a = rnd(0, TAU);
            const r1 = R * rnd(1.3, 2.2);
            st.arcs.push({ i: j, pts: jag(b.cx + Math.cos(a) * R * 0.6, b.cy + Math.sin(a) * R * 0.6, b.cx + Math.cos(a) * r1, b.cy + Math.sin(a) * r1, 2 * S, 0.35) });
        }
    }
    // 빛 구슬 (번개가 나가는 곳 · 앞머리)
    function boltOrb(ctx, px, D, X, st, x, y, r, a) {
        const S = X.S;
        const t = D.t;
        ellipse(ctx, px, S, x, y, r * 1.8, r * 1.8, bcol(st, 0, t, 48), 0.3 * a);
        ellipse(ctx, px, S, x, y, r * 1.3, r * 1.3, bcol(st, 1, t, 62), a);
        ellipse(ctx, px, S, x, y, r, r, bcol(st, 2, t, 82), a);
        ellipse(ctx, px, S, x, y, r * 0.6, r * 0.6, '#ffffff', a);
        const path = new Path2D();
        for (let j = 0; j < 12; j++) {
            const an = t * 6 + (j / 12) * TAU;
            const len = r * (j % 2 ? 2.1 : 3) * (0.8 + 0.2 * Math.sin(t * 30 + j));
            for (let d = r * 1.2; d < len; d += S) {
                path.rect(px(x + Math.cos(an) * d), px(y + Math.sin(an) * d), S, S);
            }
        }
        ctx.globalAlpha = 0.8 * a;
        ctx.fillStyle = '#ffffff';
        ctx.fill(path);
    }
    // 1000만볼트 — 다발 (가운데서 벌어졌다 앞머리에서 모임)
    function voltPaths(D, X, st, tip) {
        const S = X.S;
        const L = Math.abs(tip - X.x0);
        st.bolts = [];
        if (L < 2 * S) {
            return;
        }
        const spread = Math.min(D.lane * 1.1, L * 0.2);
        const seg = Math.max(3 * S, L / 14);
        for (let i = 0; i < st.nb; i++) {
            const f = st.nb > 1 ? i / (st.nb - 1) - 0.5 : 0;
            const mx = X.x0 + X.dir * L * rnd(0.35, 0.6);
            const my = X.y0 + f * 2 * spread + rnd(-0.3, 0.3) * spread;
            const a = jag(X.x0, X.y0 + f * D.lane * 0.3, mx, my, seg, 0.18, D.lane * 0.5);
            const b = jag(mx, my, tip, X.y0, seg, 0.18, D.lane * 0.5);
            const pts = a.concat(b.slice(1));
            const br = [];
            for (let k = 0; k < 2; k++) {
                br.push(branchOf(pts, Math.min(L * rnd(0.08, 0.2), D.lane * rnd(1.5, 3)), Math.max(2 * S, L / 30), D.lane * 0.4));
            }
            st.bolts.push({ i, pts, br });
        }
    }
    function voltDraw(ctx, px, D, X, st) {
        const S = X.S;
        const t = D.t;
        const a = X.fade;
        const f = force(D, X);
        for (const b of st.bolts) {
            if (hash(b.i, Math.floor(t / 0.03)) < 0.08) {
                continue; // 깜빡
            }
            const w = Math.max(1, Math.round(st.bw * f * (0.85 + 0.15 * Math.sin(t * 40 + b.i))));
            b.br.forEach((p) => {
                fillPts(ctx, px, S, p, Math.max(1, Math.round(w / 2)) + 1, bcol(st, b.i, t), a);
                fillPts(ctx, px, S, p, 1, '#ffffff', a);
            });
            fillPts(ctx, px, S, b.pts, w * 2 + 3, bcol(st, b.i, t, 48), a * 0.3);
            fillPts(ctx, px, S, b.pts, w + 1, bcol(st, b.i, t, 60), a);
            fillPts(ctx, px, S, b.pts, Math.max(1, w - 1), bcol(st, b.i, t, 82), a);
            if (w > 3) {
                fillPts(ctx, px, S, b.pts, w - 3, '#ffffff', a);
            }
        }
    }
    // 번개 창 — 앞 끝이 front (짧으면 줄어듦), 나가는 동안 머리 위에서 줄로 내려옴
    function spearPose(D, X, st) {
        const L = Math.abs(X.front - X.x0);
        const Ls = clamp(L * 0.95, st.Ls * 0.4, st.Ls);
        const sh = Math.sqrt(Ls / st.Ls);
        const Wd = st.Wd * sh * (0.88 + 0.12 * force(D, X));
        let y = X.y0;
        if (D.phase === 'go') {
            y = lerp(st.hold.y, X.y0, smooth(L / Math.max(1, D.half)));
        }
        return { tip: X.front, Ls, Wd, y };
    }
    function spearPaths(D, X, st) {
        const S = X.S;
        const dir = X.dir;
        const g = spearPose(D, X, st);
        const tail = g.tip - dir * g.Ls;
        st.tail = (tail - X.x0) * dir > 3 * S ? jag(X.x0, X.y0, tail + dir * g.Ls * 0.1, g.y, 3 * S, 0.12, D.lane * 0.4) : null;
        st.core = jag(g.tip - dir * g.Ls * 0.95, g.y, g.tip - dir * g.Ls * 0.08, g.y, 2 * S, 0.06);
        st.sarcs = [];
        for (let j = 0; j < 2; j++) {
            const fx = g.tip - dir * g.Ls * rnd(0.1, 0.9);
            const an = (Math.random() < 0.5 ? -1 : 1) * (Math.PI / 2) + rnd(-0.6, 0.6);
            const len = g.Wd * rnd(1.2, 2.4);
            st.sarcs.push(jag(fx, g.y, fx + Math.cos(an) * len, g.y + Math.sin(an) * len, 2 * S, 0.35));
        }
    }
    function spearDraw(ctx, px, D, X, st) {
        const S = X.S;
        const t = D.t;
        const a = X.fade;
        const g = spearPose(D, X, st);
        if (st.tail) {
            drawBolt(ctx, px, S, st.tail, st.bw, st.cols[2], st.cols[3], 0.8 * a);
        }
        const pulse = 1 + 0.05 * Math.sin(t * 30);
        const Ls = g.Ls * pulse;
        drawSpear(ctx, g.tip - (X.dir * Ls) / 2, g.y, X.dir > 0 ? 0 : Math.PI, Ls, g.Wd * pulse, st.C, st.cols, t, 1, a);
        if (st.core) {
            fillPts(ctx, px, S, st.core, 1, '#ffffff', a);
        }
        (st.sarcs || []).forEach((p) => drawBolt(ctx, px, S, p, 1, st.cols[1], null, a));
    }
    // 번개 기둥 — 사슬 마디 (gap 마다, 마지막은 앞머리)
    function chainPaths(D, X, st, tip) {
        const S = X.S;
        const L = Math.abs(tip - X.x0);
        st.chain = [];
        st.nodes = [];
        if (L < 2 * S) {
            return;
        }
        const n = Math.max(1, Math.round(L / st.gap));
        let prev = [X.x0, X.y0];
        for (let j = 1; j <= n; j++) {
            const x = X.x0 + (X.dir * L * j) / n;
            const y = j === n ? X.y0 : X.y0 + rnd(-0.3, 0.3) * D.lane;
            st.nodes.push([x, y]);
            for (let k = 0; k < 2; k++) {
                st.chain.push(jag(prev[0], prev[1], x, y, 2 * S, 0.2, D.lane * 0.45));
            }
            prev = [x, y];
        }
    }
    function regenPillar(D, X, q) {
        const S = X.S;
        const h = D.ground;
        q.drawn = D.t;
        q.bolts = [0, 1, 2].map((j) => jag(q.x + (j - 1) * q.pw * 0.22 + rnd(-0.1, 0.1) * q.pw, 0, q.x + rnd(-0.15, 0.15) * q.pw, D.ground, Math.max(3 * S, h / 10), 0.16));
        q.br = [0, 1].map(() => {
            const y = h * rnd(0.15, 0.8);
            const side = pick([-1, 1]);
            return jag(q.x + side * q.pw * 0.3, y, q.x + side * q.pw * rnd(1.4, 2.4), y + h * rnd(0.05, 0.25), 2 * S, 0.3);
        });
    }
    function addPillar(D, X, st, x, pw, big) {
        const S = X.S;
        const Z = st.Z;
        const q = { x, pw, big, born: D.t, dur: big ? 0.8 : 0.42, drawn: -1 };
        regenPillar(D, X, q);
        st.pillars.push(q);
        // 땅 — 고리 · 흙 · 불똥 · 기어가는 전기
        ring(x, D.ground - S, S, pw * 0.5, pw * (big ? 5 : 2.6), 0.25, big ? 0.7 : 0.4, ['#ffffff', st.cols[1], st.cols[2]], { size: big ? 2 : 1, cut: D.ground });
        spray(x, D.ground - 2 * S, S, ['#ffffff', st.cols[1], st.cols[2], '#a88a55', '#7a6238'], big ? 30 : 9, 80 * Z, 260 * Z, { ang: -Math.PI / 2, spread: 1.1, g: 420 * Z, drag: 0.8, floorY: D.ground, life0: 0.4, life1: 0.8 });
        if (big) {
            groundArcs(D, X, x, pw * 5, 0.9, 4, 1);
        }
    }
    function pillarDraw(ctx, px, D, X, st, q) {
        const S = X.S;
        const life = D.t - q.born;
        const t = k01(life / q.dur);
        const top = 0;
        const bottom = D.ground;
        const h = bottom - top;
        const reach = top + h * k01(life / 0.05);
        const hotP = life < 0.08;
        const w = q.pw * (hotP ? 1.5 : 1.1 - 0.5 * t);
        const a = (t > 0.55 ? (1 - t) / 0.45 : 1) * (q.big ? 1 : X.fade);
        const cut = (pts) => pts.filter(([, y]) => y <= reach);
        // 옅은 빛기둥 (가장자리 지직)
        const glowP = new Path2D();
        const seed = Math.floor(life / 0.045);
        for (let r = 0; top + r * S < reach; r += 2) {
            const j = (hash(r, seed + q.x) - 0.5) * w * 0.3;
            glowP.rect(px(q.x - w * 0.75 + j), px(top + r * S), Math.max(S, px(w * 1.5)), 2 * S);
        }
        ctx.globalAlpha = (hotP ? 0.6 : 0.3) * a;
        ctx.fillStyle = hotP ? '#ffffff' : bcol(st, 1, life);
        ctx.fill(glowP);
        // 꼬이는 굵은 번개 + 가지
        const bwid = Math.max(2, Math.round(q.pw / (3.2 * S)));
        const bw2 = Math.max(1, Math.round(bwid * (hotP ? 1.4 : 1 - 0.4 * t)));
        q.br.forEach((b) => drawBolt(ctx, px, S, cut(b), 1, bcol(st, 2, life), null, a));
        q.bolts.forEach((b, j) => drawBolt(ctx, px, S, cut(b), j === 1 ? bw2 + 1 : bw2, j === 1 ? bcol(st, 0, life, 82) : bcol(st, j, life), j === 1 ? bcol(st, 3, life, 48) : null, a));
        // 땅에 닿는 곳
        if (reach >= bottom) {
            const r = q.pw * (hotP ? 1.3 : 0.9) * (1 - 0.4 * t);
            ellipse(ctx, px, S, q.x, bottom - S, r * 1.6, r * 0.35, st.cols[1], a, bottom);
            ellipse(ctx, px, S, q.x, bottom - S, r, r * 0.22, '#ffffff', a, bottom);
        }
    }
    function pillarTick(D, X, st) {
        const t = D.t;
        const tip = X.front;
        const L = Math.abs(tip - X.x0);
        if (t >= st.nextPillar && L > st.gap * 0.5 && X.fade > 0.5 && st.wonAt === undefined && D.phase !== 'charge') {
            st.nextPillar = t + rnd(0.17, 0.27) * (X.pushing > 0 ? 0.7 : 1);
            const node = st.nodes.length > 1 && Math.random() < 0.5 ? st.nodes[Math.max(0, st.nodes.length - 1 - Math.floor(Math.random() * 3))] : null;
            const x = node ? node[0] : tip - X.dir * rnd(0, 0.15) * st.gap;
            addPillar(D, X, st, x, st.pw * rnd(0.85, 1.15), false);
        }
        for (const q of st.pillars) {
            if (t - q.drawn > 0.045) {
                regenPillar(D, X, q);
            }
        }
        st.pillars = st.pillars.filter((q) => t - q.born < q.dur);
    }
    function boltCharge(D, X, k, dt) {
        const st = X.st;
        const S = X.S;
        const Z = st.Z;
        const b = X.body;
        if (!st.charging) {
            st.charging = true;
            chargeArt(D, X, (ctx, px, kk, t) => {
                if (st.mode === 'volt') {
                    // 하늘까지 솟는 빛기둥
                    const w = Math.max(X.w, 16) * (0.25 + 0.75 * kk) * (1 + 0.15 * Math.sin(t * 50));
                    ctx.globalAlpha = (0.15 + 0.4 * kk) * 0.45;
                    ctx.fillStyle = bcol(st, 0, t, 55);
                    ctx.fillRect(px(b.cx - w / 2), 0, px(w), px(b.cy));
                    ctx.globalAlpha = 0.15 + 0.45 * kk;
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(px(b.cx - w / 7), 0, Math.max(S, px((w * 2) / 7)), px(b.cy));
                } else if (st.mode === 'spear') {
                    // 머리 위에 번개 창이 생김
                    const grow = easeOut((kk - 0.25) / 0.6);
                    if (grow > 0) {
                        drawSpear(ctx, st.hold.x, st.hold.y + Math.sin(t * 6) * S, X.dir > 0 ? 0 : Math.PI, st.Ls, st.Wd, st.C, st.cols, t, grow, 1);
                    }
                }
                boltOrb(ctx, px, D, X, st, X.x0, X.y0, st.R0 * (0.3 + 0.7 * kk) * (1 + 0.1 * Math.sin(t * 45)), 1);
                st.arcs.forEach((a) => drawBolt(ctx, px, S, a.pts, 1, bcol(st, a.i, t), null, 0.9));
            });
            tremble(X, 0.6 * S, DUEL_CHARGE * 1000);
            if (st.mode === 'volt') {
                // 좁혀 드는 무지개 고리
                for (let j = 0; j < 3; j++) {
                    ring(b.cx, b.cy, S, Math.max(D.W, D.H) * 0.3, st.R0 * 0.6, 0.85, 0.45, [bcol(st, j * 2, j * 0.2, 70), '#ffffff'], { size: 2, delay: j * 0.2, cut: D.ground });
                }
            }
        }
        if (D.t - st.drawn > 0.05) {
            st.drawn = D.t;
            bodyArcs(D, X, st, 2 + Math.round(7 * k));
        }
        // 빨려 드는 불똥
        st.acc += dt * (40 + 60 * k) * Math.min(1.4, Z);
        while (st.acc >= 1) {
            st.acc -= 1;
            const c = st.mode === 'spear' && k > 0.25 ? st.hold : { x: X.x0, y: X.y0 };
            pullIn(c, Math.max(D.lane * 2.5, st.R0 * 4) * rnd(0.8, 1.5), S, st.rainbow ? [hue(rnd(0, 360), 70), '#ffffff'] : [...st.cols, '#ffffff'], rnd(0.2, 0.3), { spin: rnd(-0.5, 0.5), floorY: D.ground });
        }
        // 하늘에서 내리꽂힘 — 창이면 창 자리로, 기둥이면 앞 땅에, 1000만볼트면 몸에
        const hits = [0.12, 0.42, 0.72];
        while (st.strikes < hits.length && k >= hits[st.strikes]) {
            st.strikes += 1;
            if (st.mode === 'spear') {
                strike(D, X, st.hold.x + rnd(-0.6, 0.6) * st.Ls, -4, st.hold.x, st.hold.y, { w: 2, dur: 0.28, branches: 2 });
                ring(st.hold.x, st.hold.y, S, st.Wd, st.Ls * 0.5, 0.5, 0.3, ['#ffffff', st.cols[1]], { cut: D.ground });
            } else if (st.mode === 'pillar') {
                const x = X.x0 + X.dir * st.gap * (0.4 + 0.3 * st.strikes);
                strike(D, X, x + rnd(-1, 1) * st.pw, -4, x, D.ground - S, { w: 2, dur: 0.3, branches: 2 });
                ring(x, D.ground - S, S, 2 * S, st.pw * 2.5, 0.25, 0.35, ['#ffffff', st.cols[1]], { cut: D.ground });
            } else if (st.strikes === 3) {
                strike(D, X, b.cx + rnd(-0.05, 0.05) * D.W, -4, b.cx, b.cy, { w: st.bw, rainbow: st.rainbow, hue: 0, dur: 0.4, branches: 3 });
            }
            screenFlash(S, 0.15, st.cols[1], 0.12);
        }
    }
    function boltDraw(ctx, px, D, X) {
        const st = X.st;
        const S = X.S;
        const t = D.t;
        const a = X.fade;
        if (st.mode === 'pillar') {
            // 번개 사슬 — 마디마다 빛 매듭
            const w = Math.max(1, Math.round((st.bw - 1) * force(D, X)));
            st.chain.forEach((p, j) => drawBolt(ctx, px, S, p, j % 2 ? 1 : w, bcol(st, j, t), j % 2 ? null : bcol(st, j, t, 48), a));
            for (const [x, y] of st.nodes) {
                const r = st.R0 * 0.55 * (1 + 0.2 * Math.sin(t * 40 + x));
                ellipse(ctx, px, S, x, y, r * 1.5, r * 1.5, st.cols[2], 0.4 * a);
                ellipse(ctx, px, S, x, y, r, r, '#ffffff', a);
            }
            for (const q of st.pillars) {
                pillarDraw(ctx, px, D, X, st, q);
            }
        } else if (st.mode === 'spear') {
            spearDraw(ctx, px, D, X, st);
        } else {
            voltDraw(ctx, px, D, X, st);
            // 앞머리 매듭
            if (Math.abs(X.front - X.x0) > 2 * S) {
                boltOrb(ctx, px, D, X, st, X.front, X.y0, st.R0 * 0.6 * force(D, X), a);
            }
        }
        // 나가는 곳 빛 구슬 · 몸 둘레 지직
        const r = st.R0 * force(D, X) * (1 + 0.4 * st.surge) * (1 + 0.1 * Math.sin(t * 45));
        boltOrb(ctx, px, D, X, st, X.x0, X.y0, st.mode === 'volt' ? r : r * 0.7, a);
        st.arcs.forEach((q) => drawBolt(ctx, px, S, q.pts, 1, bcol(st, q.i, t), null, 0.9 * a));
    }
    function boltTick(D, X, dt) {
        const st = X.st;
        const S = X.S;
        const Z = st.Z;
        const t = D.t;
        const tip = X.front;
        // 0.05초마다 (앞머리가 움직이면 바로) 다시 그어 지직
        if (t - st.drawn >= 0.05 || Math.abs(tip - st.lastTip) > 3 * S) {
            st.drawn = t;
            st.lastTip = tip;
            if (st.mode === 'volt') {
                voltPaths(D, X, st, tip);
            } else if (st.mode === 'spear') {
                spearPaths(D, X, st);
            } else {
                chainPaths(D, X, st, tip);
            }
            bodyArcs(D, X, st, X.fade > 0.5 ? 3 + Math.round(4 * hot(X)) : 0);
        }
        if (st.mode === 'pillar') {
            pillarTick(D, X, st);
        }
        // 앞머리에서 튀는 불똥
        if (X.fade > 0.4 && Math.abs(tip - X.x0) > 2 * S) {
            st.spark = Math.min(4, st.spark + dt * (25 + 30 * hot(X)) * Z);
            while (st.spark >= 1 && room()) {
                st.spark -= 1;
                const a = rnd(0, TAU);
                const sp = rnd(60, 200) * Z;
                sigParticle({ x: tip, y: X.y0, s: S, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40 * Z, g: 380 * Z, drag: 0.8, max: rnd(0.4, 0.8), color: st.rainbow ? hue(rnd(0, 360), 70) : pick(['#ffffff', st.cols[1], st.cols[2]]), size: pick([1, 1, 2]), floorY: D.ground, update: UP.bounce, draw: DRAW.dot });
            }
        }
    }
    function boltPush(D, X, strong) {
        const st = X.st;
        const S = X.S;
        if (!strong) {
            return;
        }
        ring(X.x0, X.y0, S, st.R0, st.R0 * 4, 0.85, 0.35, st.rainbow ? [hue(D.t * 300, 70), '#ffffff', hue(D.t * 300 + 180, 60)] : ['#ffffff', st.cols[1], st.cols[2]], { size: 2, cut: D.ground });
        groundArcs(D, X, X.body.cx, D.lane * 3, 0.5, 2, 1);
        if (st.mode === 'pillar') {
            st.nextPillar = 0;
        }
        recoil(X, 2 * S);
    }
    // 이김 — 진 쪽에 번개가 내리꽂히고 전기 대폭발
    function boltWin(D, X, L) {
        const st = X.st;
        const S = X.S;
        const Z = st.Z;
        const { cx, cy } = L.body;
        const y = Math.min(cy, D.ground - 2 * S);
        const R = clamp(D.lane * 2.3 * (0.85 + 0.3 * st.P), 16, D.H * 0.42);
        zapBoom(D, X, cx, y, R);
        if (st.mode === 'volt') {
            for (let j = 0; j < 4; j++) {
                later(j * 70, () => strike(D, X, cx + rnd(-0.6, 0.6) * R, -4, cx + rnd(-0.3, 0.3) * R, y, { w: st.bw, rainbow: st.rainbow, hue: j * 90, dur: 0.35, branches: 2 }));
            }
            for (let j = 0; j < 3; j++) {
                ring(cx, y, S, R * 0.4, R * (2.4 - j * 0.4), 0.8, 0.6, st.rainbow ? [hue(j * 90, 70), '#ffffff', hue(j * 90 + 180, 60)] : ['#ffffff', st.cols[1], st.cols[2]], { size: 2, delay: j * 0.1, cut: D.ground });
            }
        } else if (st.mode === 'spear') {
            // 창이 꽂힌 자리에서 위로 솟는 번개
            for (let j = 0; j < 3; j++) {
                later(50 + j * 80, () => strike(D, X, cx + rnd(-0.3, 0.3) * R, y, cx + rnd(-0.6, 0.6) * R, -4, { w: st.bw, dur: 0.35 }));
            }
            ring(cx, y, S, R * 0.3, R * 2.6, 0.35, 0.7, ['#ffffff', st.cols[1], st.cols[2]], { size: 3, cut: D.ground });
        } else {
            addPillar(D, X, st, cx, st.pw * 2.2, true);
        }
        groundArcs(D, X, cx, R * 2.4, 1, 4, 1);
        spray(cx, y, S, ['#ffffff', st.cols[0], st.cols[1], st.cols[2]], 40, 120 * Z, 360 * Z, { g: 500 * Z, drag: 0.8, floorY: D.ground, life0: 0.5, life1: 1 });
    }

    // ══════════ orb — ultorb 거대 구체(style) · ultblackhole 블랙홀 · ultsparkle moon 달 ══════════
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
    // 구체 — 스타일마다 (ultorb 그대로)
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
    // 블랙홀 — 감겨 드는 팔 · 휘어진 빛 고리 · 기울어진 원반(뒤 · 앞) · 검은 구 + 빛 테두리
    function drawHole(ctx, px, S, bx, by, rB, life, cols, spin, alpha) {
        if (rB < S * 0.5) {
            return;
        }
        const disk = rB * 2.3;
        const tilt = -0.18 * spin;
        const ct = Math.cos(tilt);
        const sn = Math.sin(tilt);
        const reachR = disk * 1.1;
        for (let j = 0; j < 3; j++) {
            for (let k = 0; k < 26; k++) {
                const f = k / 26;
                const rr = rB * 1.4 + f * reachR;
                const a = life * spin * 1.3 + (j * TAU) / 3 - spin * f * 4.2;
                const ex = Math.cos(a) * rr;
                const ey = Math.sin(a) * rr * 0.45;
                ctx.globalAlpha = 0.45 * (1 - f) * alpha;
                dotAt(ctx, px, S, bx + ex * ct - ey * sn, by + ex * sn + ey * ct, k % 2 ? cols[1] : cols[2], k < 10 ? 2 : 1, 1);
            }
        }
        for (let j = 0; j < 2; j++) {
            ctx.globalAlpha = (0.35 + 0.15 * Math.sin(life * 6 + j)) * alpha;
            ringDots(ctx, px, S, bx, by, rB * (1.5 + j * 0.45), 1, [cols[2], cols[3]], 2 + j, 1, life * spin * (0.5 + j));
        }
        const diskPass = (front) => {
            const n = 120;
            for (let j = 0; j < n; j++) {
                const lane = j % 4;
                const speed = (2.8 - lane * 0.5) * spin;
                const a = (j / n) * TAU + life * speed;
                const rr = disk * (0.55 + 0.16 * lane + 0.05 * hash(j, 1));
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
                    ctx.globalAlpha = (front ? 1 : 0.55) * (1 - q * 0.3) * alpha;
                    dotAt(ctx, px, S, bx + ex * ct - ey * sn - ((sz - 1) * S) / 2, by + ex * sn + ey * ct - ((sz - 1) * S) / 2, col, sz, sz);
                }
            }
        };
        diskPass(false);
        ctx.globalAlpha = alpha;
        sigDisc(ctx, px, S, bx, by, rB * 1.14, cols[1]);
        sigDisc(ctx, px, S, bx, by, rB * 1.06, cols[0]);
        sigDisc(ctx, px, S, bx, by, rB, '#000000');
        diskPass(true);
    }
    // 달 — 겹 빛 · 후광 고리 · 밝은 면과 그늘 · 분화구
    const CRATERS = [[-0.35, -0.25, 0.18], [0.22, 0.3, 0.14], [-0.12, 0.48, 0.09], [0.38, -0.32, 0.1], [-0.5, 0.18, 0.08], [0.05, -0.05, 0.07]];
    function drawMoon(ctx, px, S, x, y, r, life, cols, glow, alpha) {
        if (r < S) {
            return;
        }
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
    }
    function orbInit(D, X, st) {
        const o = X.o;
        const S = X.S;
        st.mode = X.fx === 'ultblackhole' ? 'hole' : X.fx === 'ultsparkle' ? 'moon' : 'orb';
        st.style = ORB_C[o.style] ? o.style : 'energy';
        st.cols = sigPal(o.c || (st.mode === 'hole' ? 'dark' : st.mode === 'moon' ? 'moon' : ORB_C[st.style]));
        st.size = clamp(o.size ?? 1, 0.5, 2);
        const lim = Math.max(4 * S, Math.min((D.ground - X.y0) * 1.5, (D.ground - 4 * S) / 2.6));
        const base = st.mode === 'hole' ? 1.15 : st.mode === 'moon' ? 1.55 : 1.65 * Math.sqrt(st.size) * (o.sky ? 1.2 : 1);
        st.r = clamp(D.lane * base * (0.88 + 0.25 * st.P), 4 * S, lim);
        st.reachK = st.mode === 'hole' ? 2 : 1; // 앞 끝까지 (블랙홀은 원반 끝 쪽)
        const top = st.r * (st.mode === 'hole' ? 1.6 : 1.4) + 2 * S;
        st.home = st.mode === 'hole'
            ? { x: X.x0 + X.dir * st.r * 2.5, y: Math.max(top, X.y0 - D.lane * 1.6) }
            : { x: X.body.cx, y: Math.max(top, X.body.top - st.r - 3 * S) };
        if (o.sky) {
            st.home.y = top; // 하늘 높이
        }
        st.c = { x: st.home.x, y: st.home.y };
        st.spin = X.dir;
        st.bits = 0;
        st.aura = 0;
        st.hist = [];
    }
    // 구체 자리 — 앞 끝이 front 에 (ym 높이에서 맞닿게, 땅에 묻히면 위로 올리고 그만큼 뒤로)
    function orbPos(D, X, st, r) {
        const reach = r * st.reachK;
        const cyL = Math.min(X.y0, D.ground - r * (st.mode === 'hole' ? 0.6 : 1) - 2 * X.S);
        const dy = Math.min(reach * 0.9, X.y0 - cyL);
        const cxL = X.front - X.dir * Math.sqrt(Math.max(0, reach * reach - dy * dy));
        if (D.phase !== 'go') {
            return { x: cxL, y: cyL };
        }
        // 나가는 동안 — 머리 위에서 줄로 휙 (살짝 포물선)
        const k = smooth(Math.abs(X.front - X.x0) / Math.max(1, D.half));
        return { x: lerp(st.home.x, cxL, k), y: lerp(st.home.y, cyL, k) - Math.sin(k * Math.PI) * D.lane * 0.6 };
    }
    const orbR = (D, X, st) => st.r * (1 + 0.6 * (force(D, X) - 1)) * (1 + 0.04 * Math.sin(D.t * 30));
    // 몸 → 구체로 먹이는 기운 줄기 (스타일 색) + 꼬이며 흐르는 알갱이
    function orbStream(ctx, px, D, X, st, c, r, a) {
        if (a <= 0.01) {
            return;
        }
        const S = X.S;
        const t = D.t;
        const dir = X.dir;
        const x1 = c.x - dir * r * 0.4;
        const L = (x1 - X.x0) * dir;
        if (L < 2 * S) {
            return;
        }
        const style = st.mode === 'orb' ? st.style : st.mode;
        const cols = st.cols;
        const th = Math.max(1.5 * S, r * (st.mode === 'hole' ? 0.45 : 0.36));
        const dark = style === 'shadow' || style === 'hole';
        const L3 = dark ? ['#1a0b2e', cols[3], cols[2]] : style === 'moon' ? [cols[2], cols[1], '#ffffff'] : style === 'ice' ? [cols[3], cols[2], '#ffffff'] : [cols[3], cols[2], cols[1]];
        const AL = style === 'moon' ? [0.16, 0.26, 0.4] : [0.45, 0.8, 0.95];
        const wob = style === 'water' || style === 'flame' || style === 'leaf' ? 0.3 : style === 'hole' ? 0.2 : 0.12;
        const seg = 2 * S;
        const tick = Math.floor(t * 20);
        const yAt = (d) => lerp(X.y0, c.y, smooth(d / L));
        for (let li = 0; li < 3; li++) {
            ctx.globalAlpha = AL[li] * a;
            ctx.fillStyle = L3[li];
            const m = [1, 0.62, 0.3][li];
            for (let d = 0; d < L; d += seg) {
                const f = d / L;
                const y = yAt(d) + Math.sin(d / (5 * S) - t * 14) * th * wob * f;
                const jit = style === 'flame' ? (hash(Math.floor(d / seg), tick + li) - 0.5) * 2 * S : 0;
                const h = th * m * (0.35 + 0.65 * f) + jit;
                if (h < S * 0.5) {
                    continue;
                }
                const w = Math.min(seg, L - d);
                const top = px(y - h);
                ctx.fillRect(px(dir > 0 ? X.x0 + d : X.x0 - d - w), top, Math.max(S, px(w)), Math.max(S, px(y + h) - top));
            }
        }
        ctx.globalAlpha = a;
        for (let j = 0; j < 3; j++) {
            for (let d = (t * 260 * st.Z + j * 11 * S) % (6 * S); d < L; d += 6 * S) {
                const f = d / L;
                const y = yAt(d) + Math.sin(d / (6 * S) - t * 9 + j * 2.1) * th * 0.7 * (0.35 + 0.65 * f);
                dotAt(ctx, px, S, X.x0 + dir * d, y, j === 1 ? '#ffffff' : cols[dark ? 1 : 0]);
            }
        }
    }
    function orbBody(ctx, px, D, X, st, x, y, r, a, glow = 0) {
        const S = X.S;
        if (st.mode === 'hole') {
            drawHole(ctx, px, S, x, y, r, D.t, st.cols, st.spin, a);
        } else if (st.mode === 'moon') {
            drawMoon(ctx, px, S, x, y, r, D.t, st.cols, glow, a);
        } else {
            drawOrb(ctx, px, S, x, y, r, st.style, st.cols, D.t, a);
        }
    }
    function orbCharge(D, X, k, dt) {
        const st = X.st;
        const S = X.S;
        const Z = st.Z;
        if (!st.charging) {
            st.charging = true;
            chargeArt(D, X, (ctx, px, kk, t) => {
                const h = st.home;
                if (st.mode === 'hole') {
                    // 하얀 금이 가로로 쫙 → 검은 구멍이 열림
                    const ko = k01(kk / 0.45);
                    if (kk < 0.5) {
                        ctx.globalAlpha = 1;
                        ctx.fillStyle = '#ffffff';
                        const hw = st.r * 3 * easeOut(ko * 1.6);
                        ctx.fillRect(px(h.x - hw), px(h.y - S / 2), px(2 * hw), S);
                    }
                    drawHole(ctx, px, S, h.x, h.y, st.r * easeOut(ko), t, st.cols, st.spin, 1);
                } else if (st.mode === 'moon') {
                    // 달이 떠오름
                    const e = easeOut(kk);
                    drawMoon(ctx, px, S, h.x, h.y + (1 - e) * D.lane * 1.5, st.r * (0.6 + 0.4 * e), t, st.cols, kk > 0.85 ? (kk - 0.85) / 0.15 : 0, Math.min(1, kk * 3));
                } else {
                    // 머리 위에서 구체를 키움 — 몸에서 올라가는 기운 줄기
                    const r = st.r * (0.1 + 0.9 * easeOut(kk / 0.9)) * (1 + 0.05 * Math.sin(t * 30));
                    const yTop = h.y + r * 0.8;
                    const yBot = X.body.top;
                    if (yBot - yTop > 2 * S) {
                        ctx.globalAlpha = 0.75;
                        for (let j = 0; j < 3; j++) {
                            for (let y = yBot; y > yTop; y -= 2 * S) {
                                const ph = (y + t * 160 * Z) / (6 * S) + j * 2.1;
                                dotAt(ctx, px, S, h.x + Math.sin(ph) * Math.max(2 * S, r * 0.35) * (j - 1), y, j === 1 ? '#ffffff' : st.cols[1]);
                            }
                        }
                    }
                    drawOrb(ctx, px, S, h.x, h.y, r, st.style, st.cols, t, 1);
                }
            });
            glowSprite(X, [1, 1.5, 1.2, 1.7, 1], (DUEL_CHARGE + 0.2) * 1000);
            tremble(X, 0.4 * S, DUEL_CHARGE * 1000);
            if (st.mode === 'hole') {
                screenFlash(S, 0.2, st.cols[1], 0.3);
            }
        }
        const r = st.r * easeOut(k / 0.9);
        st.acc += dt * (40 + 50 * st.P) * (1 + 1.5 * k) * Math.min(1.4, Z);
        while (st.acc >= 1) {
            st.acc -= 1;
            if (st.mode === 'hole') {
                pullIn(st.c, st.r * rnd(5, 9), S, ['#ffffff', '#ffffff', st.cols[0], st.cols[1]], rnd(0.4, 0.6), { spin: st.spin * rnd(2, 4), pow: 2.2, size: pick([1, 1, 2]), floorY: D.ground });
            } else if (st.mode === 'moon') {
                if (room()) {
                    sigParticle({ x: st.home.x + rnd(-1, 1) * st.r * 3, y: Math.min(D.ground - 2 * S, st.home.y + rnd(-1, 1) * st.r * 1.6), s: S, max: rnd(0.4, 0.8), r: pick([0, 1, 1, 2]), cols: ['#ffffff', st.cols[0], st.cols[1], st.cols[2]], draw: DR.twinkle });
                }
            } else if (Math.random() < 0.3) {
                pullIn(st.c, Math.max(8, X.body.top - st.c.y + r), S, st.cols, rnd(0.25, 0.4), { a0: Math.PI / 2 + rnd(-0.5, 0.5), pow: 1.3, floorY: D.ground });
            } else {
                pullIn(st.c, Math.max(st.r, 12) * rnd(2, 3.2), S, [...st.cols, '#ffffff'], rnd(0.3, 0.45), { spin: X.dir * rnd(2.5, 4), pow: 1.5, floorY: D.ground });
            }
        }
        if (st.mode === 'orb') {
            st.aura += dt * 20;
            while (st.aura >= 1) {
                st.aura -= 1;
                riseAt(D, X, st.cols);
            }
            st.bits += dt * (st.style === 'energy' ? 6 : 16) * (0.3 + k);
            while (st.bits >= 1) {
                st.bits -= 1;
                const a = rnd(0, TAU);
                orbBits(st.style, st.c.x + Math.cos(a) * r * 0.9, st.c.y + Math.sin(a) * r * 0.9, S, st.cols, 1, Z, { ang: st.style === 'flame' || st.style === 'shadow' ? -Math.PI / 2 : a, spread: 0.7, sp0: 15, sp1: 50, floorY: D.ground });
            }
        }
    }
    function orbDraw(ctx, px, D, X) {
        const st = X.st;
        const S = X.S;
        const t = D.t;
        const a = X.fade;
        const won = st.wonAt !== undefined;
        const r = orbR(D, X, st);
        const c = orbPos(D, X, st, r);
        // 터진 뒤엔 줄기만 사라져 감
        orbStream(ctx, px, D, X, st, c, r, won ? a * Math.max(0, 1 - (t - st.wonAt) / 0.3) : a);
        if (won) {
            return;
        }
        // 날아가는 동안 잔상
        if (D.phase === 'go' || D.phase === 'through') {
            for (let i = st.hist.length - 1; i >= 1; i--) {
                ctx.globalAlpha = 0.3 * (1 - i / st.hist.length) * a;
                sigDisc(ctx, px, S, st.hist[i].x, st.hist[i].y, r * (st.mode === 'hole' ? 1.2 : 1) * (1 - i * 0.08), i < 3 ? st.cols[1] : st.cols[2]);
            }
        }
        const glow = st.mode === 'moon' ? 0.35 * hot(X) : 0;
        orbBody(ctx, px, D, X, st, c.x, c.y, r, a, glow);
        // 밀어붙일 때 — 빛 테두리가 돎
        const h = hot(X);
        if (h > 0.15 && st.mode !== 'hole') {
            ctx.globalAlpha = a * h * 0.8;
            ringDots(ctx, px, S, c.x, c.y, r * 1.18, 1, [st.cols[0], '#ffffff'], 2, 1, t * 5);
        }
    }
    function orbTick(D, X, dt) {
        const st = X.st;
        const S = X.S;
        const Z = st.Z;
        if (st.wonAt !== undefined || X.fade < 0.3) {
            return;
        }
        const r = orbR(D, X, st);
        const c = orbPos(D, X, st, r);
        st.c.x = c.x;
        st.c.y = c.y;
        st.hist.unshift({ x: c.x, y: c.y });
        if (st.hist.length > 6) {
            st.hist.pop();
        }
        st.bits = Math.min(5, st.bits + dt * (st.mode === 'orb' ? (st.style === 'energy' ? 14 : 30) : st.mode === 'hole' ? 45 : 18) * (1 + hot(X)) * Math.min(1.4, Z));
        while (st.bits >= 1 && room()) {
            st.bits -= 1;
            if (st.mode === 'orb') {
                // 스타일 조각 (불티 · 연기 · 물방울 · 얼음 · 잎 · 빛)
                const an = rnd(0, TAU);
                orbBits(st.style, c.x + Math.cos(an) * r * 0.9, c.y + Math.sin(an) * r * 0.9, S, st.cols, 1, Z, { ang: st.style === 'flame' || st.style === 'shadow' ? -Math.PI / 2 : an, spread: 0.7, sp0: 15, sp1: 60, floorY: D.ground });
            } else if (st.mode === 'hole') {
                // 빛 · 별 · 땅 먼지가 빨려 듦
                if (Math.random() < 0.3) {
                    pullIn(st.c, Math.max(r * 2, D.ground - 2 * S - c.y), S, ['#a88a55', '#7a6238', st.cols[2]], rnd(0.5, 0.8), { a0: Math.PI / 2 + rnd(-0.9, 0.9), spin: st.spin * 0.8, pow: 1.8, floorY: D.ground });
                } else {
                    pullIn(st.c, r * rnd(4, 7), S, ['#ffffff', '#ffffff', st.cols[0], st.cols[1]], rnd(0.5, 0.8), { spin: st.spin * rnd(2, 4), pow: 2.2, size: pick([1, 1, 2]), floorY: D.ground });
                }
            } else {
                // 달빛 반짝
                sigParticle({ x: c.x + rnd(-1, 1) * r * 1.6, y: Math.min(D.ground - S, c.y + rnd(-1, 1) * r * 1.4), s: S, max: rnd(0.4, 0.8), r: pick([1, 1, 2]), cols: ['#ffffff', st.cols[0], st.cols[1], st.cols[2]], draw: DR.twinkle });
            }
        }
    }
    function orbPush(D, X, strong) {
        if (!strong) {
            return;
        }
        const st = X.st;
        const S = X.S;
        const Z = st.Z;
        const r = orbR(D, X, st);
        const c = orbPos(D, X, st, r);
        ring(c.x, c.y, S, r, r * 2.4, 1, 0.4, [st.cols[0], '#ffffff', st.cols[1]], { size: 2, cut: D.ground });
        if (st.mode === 'orb') {
            orbBits(st.style, c.x, c.y, S, st.cols, 12, Z, { jit: r * 0.6, sp0: 40, sp1: 120, floorY: D.ground });
        } else {
            glitter(c.x, c.y, S, ['#ffffff', st.cols[0], st.cols[1], st.cols[2]], 10, 60 * Z, 180 * Z, D.ground);
        }
        recoil(X, 3 * S);
    }
    // 블랙홀 이김 — 진 쪽 앞에서 다시 열려 빨아들이다 무너지며 폭발
    function holeCollapse(D, X, st, x, y, R) {
        const S = X.S;
        const Z = st.Z;
        const cols = st.cols;
        const rB = st.r * 1.1;
        sigParticle({ x, y, s: S, max: 0.36, floorY: D.ground, done: false,
            update: (q) => {
                if (!q.done && q.life >= 0.28) {
                    q.done = true;
                    screenFlash(S, 0.3, '#ffffff', 0.35);
                    burstRays(D, X, x, y, rB * 0.3, [cols[0], cols[1], cols[2], cols[3]], 16);
                    for (let i = 0; i < 36 && room(); i++) {
                        const a = rnd(0, TAU);
                        const sp = rnd(150, 400) * Z;
                        sigParticle({ x, y, s: S, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 1.4, max: rnd(0.5, 1), r: pick([1, 1, 2]), cols: ['#ffffff', cols[0], cols[1], cols[2]], floorY: D.ground, update: UP.under, draw: DR.star });
                    }
                    explode(D, X, x, y, R, cols, { n: 40, sec: 0.9, rays: 0, smoke: 6, embers: 16 });
                    for (let j = 0; j < 3; j++) {
                        ring(x, y, S, rB, R * (2.4 + j * 0.4), 1 - j * 0.12, 0.6 + j * 0.15, j % 2 ? [cols[1], cols[2]] : ['#ffffff', cols[0]], { size: 2, delay: j * 0.1, cut: D.ground });
                    }
                }
            },
            draw: floorDraw((ctx, q, t, px) => {
                if (q.life > 0.3) {
                    return;
                }
                const e = k01(q.life / 0.28);
                drawHole(ctx, px, S, x, y, rB * (1 - easeIn(e)), D.t, cols, st.spin, 1);
                ctx.globalAlpha = e;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(px(x - D.W * 0.5 * e), px(y - S / 2), px(D.W * e), S);
                sigDisc(ctx, px, S, x, y, S * (1 + 3 * e), '#ffffff');
            }),
        });
        // 빨려 드는 빛
        for (let i = 0; i < 24; i++) {
            pullIn({ x, y }, rB * rnd(4, 8), S, ['#ffffff', cols[0], cols[1]], rnd(0.2, 0.28), { spin: st.spin * rnd(2, 3), pow: 2, floorY: D.ground });
        }
    }
    // 달 이김 — 진 쪽에 달빛 기둥이 쾅 · 빛살 · 별
    function moonBurst(D, X, st, x, y, R) {
        const S = X.S;
        const Z = st.Z;
        const cols = st.cols;
        const starCols = ['#ffffff', cols[0], cols[1], cols[2]];
        screenFlash(S, 0.25, cols[0], 0.5);
        const hw = Math.max(X.w * 0.5, D.lane * 1.2);
        sigParticle({ x, y: D.ground, s: S, max: 0.7, draw: (ctx, p, t, px) => {
            const a = 1 - t;
            ctx.globalAlpha = 0.5 * a;
            ctx.fillStyle = cols[1];
            ctx.fillRect(px(x - hw), 0, px(2 * hw), D.ground);
            ctx.globalAlpha = 0.8 * a;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(px(x - hw * 0.35), 0, px(hw * 0.7), D.ground);
        } });
        burstRays(D, X, x, y, st.r * 0.8, [cols[1], cols[2], cols[0], cols[3]], 16);
        for (let i = 0; i < 36 && room(); i++) {
            const a = rnd(0, TAU);
            const sp = rnd(120, 340) * Z;
            sigParticle({ x, y, s: Math.random() < 0.35 ? S * 2 : S, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 60 * Z, drag: 1.6, max: rnd(0.6, 1.1), r: 2, cols: starCols, floorY: D.ground, update: UP.under, draw: DR.star });
        }
        for (let j = 0; j < 3; j++) {
            ring(x, y, S, st.r, R * (2.6 + j * 0.5), 1, 0.7 + j * 0.12, j % 2 ? [cols[2], cols[1]] : ['#ffffff', cols[0]], { size: 2, delay: j * 0.1, cut: D.ground });
        }
        // 달이 부딪혀 하얗게 번쩍
        sigParticle({ x, y, s: S, max: 0.4, floorY: D.ground, draw: floorDraw((ctx, p, t, px) => drawMoon(ctx, px, S, x, y, st.r * (1 + 0.6 * t), D.t, cols, 1 - t, 1 - t)) });
        glitter(x, D.ground - S, S, starCols, 16, 60 * Z, 200 * Z, D.ground);
    }
    function orbWin(D, X, L) {
        const st = X.st;
        const S = X.S;
        const x = L.body.cx;
        const y = Math.min(L.body.cy, D.ground - 2 * S);
        const R = clamp(D.lane * 2.4 * Math.sqrt(st.size) * (0.85 + 0.25 * st.P) * (X.o.sky ? 1.3 : 1), 16, D.H * 0.45);
        if (st.mode === 'hole') {
            holeCollapse(D, X, st, x, y, R);
            return;
        }
        if (st.mode === 'moon') {
            moonBurst(D, X, st, x, y, R);
            return;
        }
        if (st.style === 'shadow') {
            screenFlash(S, 0.3, '#1a0830', 0.6);
        }
        explode(D, X, x, y, R, st.cols, { style: st.style, n: 45 + 30 * st.P, sec: 0.95 });
        if (st.style === 'aura' || st.style === 'water' || st.style === 'ice') {
            for (let j = 0; j < 3; j++) {
                ring(x, y, S, R * 0.3, R * (1.4 + j * 0.5), 1, 0.6, [st.cols[0], st.cols[1], '#ffffff'], { delay: 0.12 + j * 0.1, cut: D.ground });
            }
        }
        if (X.o.sky) {
            screenFlash(S, 0.3, '#ffffff', 0.5);
            burstRays(D, X, x, y, R * 0.5, st.cols, 20);
        }
    }

    // ══════════ dome — ultnova: 몸에서 퍼지는 반구 충격파 (껍질 · 속에서 끓는 불덩이 · 날름거리는 불꽃 · 튀는 돌) ══════════
    function domeInit(D, X, st) {
        const o = X.o;
        const S = X.S;
        st.cols = sigPal(o.c || 'hyper');
        st.white = !!o.white;
        st.cx = X.body.cx;
        st.dy = Math.max(2 * S, D.ground - X.y0); // 땅에서 맞부딪히는 높이까지
        st.ryMax = Math.max(st.dy + D.lane * 0.8, Math.min(D.ground - 3 * S, Math.max(st.dy + D.lane * 3, D.ground * 0.5)));
        st.th = Math.max(3 * S, D.lane * 0.85 * (0.9 + 0.2 * st.P)); // 껍질 굵기
        st.R0 = Math.max(D.lane * 0.9, Math.max(X.body.rx, X.body.ry) * 1.6, 10);
        st.waves = [];
        st.rocks = 0;
        st.embers = 0;
        st.arcs = [];
        st.nextArc = 0;
    }
    // 반구 크기 — ym 높이의 가장자리가 정확히 front
    function domeGeom(D, X, st, tip) {
        const F = Math.max(2 * X.S, (tip - st.cx) * X.dir);
        const ry = clamp(F * 0.8, st.dy + D.lane * 0.7, st.ryMax);
        return { rx: F / Math.sqrt(Math.max(0.05, 1 - (st.dy / ry) ** 2)), ry };
    }
    function domeCharge(D, X, k, dt) {
        const st = X.st;
        const S = X.S;
        const Z = st.Z;
        const C = { x: st.cx, y: X.body.cy };
        const W = D.W;
        if (!st.charging) {
            st.charging = true;
            const R0 = st.R0;
            chargeArt(D, X, (ctx, px, kk, t) => {
                // 좁혀 드는 고리
                for (let j = 0; j < 3; j++) {
                    const ph = (t * (1.6 + 1.6 * kk) + j / 3) % 1;
                    ctx.globalAlpha = ph * (0.4 + 0.6 * kk);
                    ringDots(ctx, px, S, C.x, C.y, R0 * (0.5 + 2.6 * (1 - ph)), 0.85, [st.cols[0], st.cols[1], '#ffffff'], 1.6, 1, t * 3);
                }
                // 도는 빛살 — 점점 길고 굵게
                ctx.globalAlpha = 0.5 + 0.5 * kk;
                for (let j = 0; j < 16; j++) {
                    const a = t * (1.5 + 3 * kk) + (j * TAU) / 16;
                    const len = R0 * (0.5 + 1.8 * kk) * (j % 2 ? 0.65 : 1) * (0.85 + 0.15 * Math.sin(t * 37 + j));
                    const w = kk > 0.6 && j % 2 === 0 ? 2 : 1;
                    const ca = Math.cos(a);
                    const sa = Math.sin(a);
                    for (let d = R0 * 0.55; d < R0 * 0.55 + len; d += S) {
                        dotAt(ctx, px, S, C.x + ca * d - ((w - 1) * S) / 2, C.y + sa * d - ((w - 1) * S) / 2, d < R0 * 0.55 + len * 0.5 ? '#ffffff' : st.cols[1], w, w);
                    }
                }
                // 몸을 감싼 빛 · 지직
                ctx.globalAlpha = 0.18 + 0.32 * kk;
                sigDisc(ctx, px, S, C.x, C.y, R0 * 0.55 * (1 - 0.2 * kk), st.cols[0]);
                ctx.globalAlpha = 1;
                st.arcs.forEach((a) => zapLine(ctx, px, S, a, 1, st.cols[1]));
                // 마지막 — 한 점으로 모여 십자로 번쩍
                if (kk > 0.8) {
                    const e = (kk - 0.8) / 0.2;
                    ctx.globalAlpha = e;
                    ctx.fillStyle = '#ffffff';
                    const hw = W * 0.4 * e;
                    ctx.fillRect(px(C.x - hw), px(C.y - S / 2), px(2 * hw), S);
                    ctx.fillRect(px(C.x - S / 2), px(C.y - D.H * 0.3 * e), S, px(D.H * 0.6 * e));
                    sigDisc(ctx, px, S, C.x, C.y, S * (1 + 4 * e), '#ffffff');
                }
            });
            // 몸 — 점점 하얗게 빛나며 움츠러듦 → 펑 하고 커졌다 돌아옴
            const dur = (DUEL_CHARGE + 0.5) * 1000;
            const at = DUEL_CHARGE / (DUEL_CHARGE + 0.5);
            glowSprite(X, [1, 1.6, 2.6, 3.4, 1.8, 1], dur);
            X.p?.el?.animate?.([{ scale: '1' }, { scale: '0.86', offset: at }, { scale: '1.2', offset: Math.min(0.95, at + 0.1) }, { scale: '1' }], { duration: dur });
            tremble(X, 0.5 * S, DUEL_CHARGE * 1000);
        }
        st.acc += dt * (60 + 80 * st.P) * (1 + 2 * k) * Math.min(1.4, Z);
        while (st.acc >= 1) {
            st.acc -= 1;
            pullIn(C, Math.max(D.lane * 4, st.R0 * 3) * rnd(0.8, 1.6), S, [...st.cols, '#ffffff'], rnd(0.25, 0.4) * (1 - 0.3 * k), { spin: rnd(-0.6, 0.6), floorY: D.ground });
        }
        // 땅에서 돌이 둥실 떠오름
        st.rocks += dt * 14 * k;
        while (st.rocks >= 1 && room()) {
            st.rocks -= 1;
            sigParticle({ x: st.cx + rnd(-1, 1) * st.R0 * 2.2, y: D.ground - S, s: S, vy: -rnd(15, 45) * Z, drag: 0.3, max: rnd(0.5, 0.9), color: pick(['#bda27a', '#8a7252', '#5c4a33']), size: pick([1, 2]), ph: rnd(0, TAU), floorY: D.ground + S, update: UP.sway, draw: DR.streak });
        }
        if (D.t >= st.nextArc) {
            st.nextArc = D.t + 0.06;
            st.arcs = [];
            for (let j = 0; j < 1 + Math.round(3 * k); j++) {
                const a = rnd(0, TAU);
                const r0 = st.R0 * 0.45;
                const r1 = st.R0 * rnd(0.9, 1.5) * (0.6 + k);
                st.arcs.push(zigzag(C.x + Math.cos(a) * r0, C.y + Math.sin(a) * r0, C.x + Math.cos(a) * r1, C.y + Math.sin(a) * r1, S, 1.6));
            }
        }
    }
    function domeDraw(ctx, px, D, X) {
        const st = X.st;
        const S = X.S;
        const t = D.t;
        const a = X.fade;
        const cols = st.cols;
        const tip = tipOf(D, X, 0.3);
        const { rx, ry } = domeGeom(D, X, st, tip);
        const th = Math.min(st.th * force(D, X), rx * 0.6, ry * 0.6);
        const gy = D.ground;
        const cx = st.cx;
        const tick = Math.floor(t * 20);
        const h = hot(X);
        // 겹 — [껍질 바깥에서 안으로 들어간 거리 시작, 끝, 색, 진하기] (바깥 → 안, 끝이 1e9 면 가운데까지)
        const layers = [
            [-th * 0.45, 0, cols[3], 0.35],
            [0, th * 0.22, '#ffffff', 1],
            [th * 0.22, th * 0.45, st.white ? '#ffffff' : cols[0], 1],
            [th * 0.45, th * 0.75, st.white ? cols[0] : cols[1], 1],
            [th * 0.75, th * 1.1, cols[2], 0.9],
            [th * 1.1, th * 1.9, cols[2], 0.5],
            [th * 1.9, th * 3, cols[3], 0.32],
            [th * 3, 1e9, cols[3], 0.14 + 0.1 * h],
        ];
        const half = (dyr, ins) => {
            const ax = rx - ins;
            const ay = ry - ins;
            if (ax <= 0 || ay <= 0 || dyr >= ay) {
                return -1;
            }
            return ax * Math.sqrt(1 - (dyr / ay) ** 2);
        };
        const y0 = px(gy - ry - th * 0.4);
        for (const [i0, i1, col, al] of layers) {
            ctx.globalAlpha = al * a;
            ctx.fillStyle = col;
            for (let y = y0; y < gy; y += S) {
                const dyr = gy - (y + S / 2);
                if (dyr < 0) {
                    continue;
                }
                const o = half(dyr, i0);
                if (o < 0) {
                    continue;
                }
                const jit = (hash(Math.round(y / S), tick) - 0.5) * 3 * S; // 껍질이 지글지글
                const oo = o + jit;
                const ii = i1 >= 1e8 ? -1 : half(dyr, i1);
                if (ii <= 0) {
                    ctx.fillRect(px(cx - oo), y, Math.max(S, px(2 * oo)), S);
                } else {
                    const ij = ii + jit * 0.6;
                    const w = Math.max(S, px(oo - ij));
                    ctx.fillRect(px(cx + ij), y, w, S);
                    ctx.fillRect(px(cx - oo), y, w, S);
                }
            }
        }
        // 몸에서 나오는 빛 (쓰는 애가 보이게 옅게)
        discs(ctx, px, S, cx, X.body.cy, st.R0 * 0.45 * (1 + 0.1 * Math.sin(t * 30)), [[1.4, cols[1], 0.25], [1, cols[0], 0.35], [0.5, '#ffffff', 0.45]], a);
        // 속에서 끓어오르는 불덩이 — 몸에서 껍질 쪽으로 퍼지며 식음
        const seed = Math.floor(t * 14);
        for (let j = 0; j < 12; j++) {
            const ph = (t * 0.9 + hash(j, 1)) % 1;
            const an = Math.PI * (0.06 + 0.88 * hash(j, 2));
            const rr = 0.2 + 0.7 * ph;
            const bx = cx + Math.cos(an) * rx * rr;
            const by = Math.min(gy - S, gy - Math.sin(an) * ry * rr);
            const rb = th * (0.5 + 0.4 * hash(j, 3)) * (1 - ph * 0.35);
            const fa = Math.min(1, (1 - ph) * 1.6) * a;
            ctx.globalAlpha = 0.45 * fa;
            fuzzDisc(ctx, px, S, bx, by, rb, cols[2], S * 1.5, seed + j);
            ctx.globalAlpha = 0.7 * fa;
            fuzzDisc(ctx, px, S, bx, by, rb * 0.62, cols[1], S, seed + j + 30);
            ctx.globalAlpha = 0.8 * fa * (1 - ph);
            fuzzDisc(ctx, px, S, bx, by, rb * 0.3, st.white ? '#ffffff' : cols[0], S, seed + j + 60);
        }
        // 미는 순간의 속 충격파
        for (const w of st.waves) {
            const e = easeOut((t - w) / 0.35);
            ctx.globalAlpha = (1 - e) * a;
            for (let j = 0; j <= 40; j++) {
                const an = (Math.PI * j) / 40;
                dotAt(ctx, px, S, cx + Math.cos(an) * rx * e, gy - Math.sin(an) * ry * e, j % 2 ? '#ffffff' : cols[0], 2, 2);
            }
        }
        // 껍질 바깥으로 날름거리는 불꽃 혀
        ctx.globalAlpha = a;
        for (let j = 0; j < 14; j++) {
            const an = Math.PI * (0.06 + (0.88 * (j + 0.5)) / 14) + Math.sin(t * 3 + j) * 0.04;
            const ex = cx + Math.cos(an) * rx;
            const ey = gy - Math.sin(an) * ry;
            const nx = Math.cos(an) * ry;
            const ny = -Math.sin(an) * rx;
            const nl = Math.hypot(nx, ny) || 1;
            const len = th * (0.5 + 0.9 * hash(j, seed)) * (1 + 0.5 * h);
            const ux = nx / nl;
            const uy = ny / nl;
            for (let d = 0; d < len; d += S) {
                const w = Math.max(1, Math.round(3 * (1 - d / len)));
                const sway = Math.sin(t * 18 + j * 1.7 + d / (3 * S)) * S;
                dotAt(ctx, px, S, ex + ux * d - uy * sway - (w * S) / 2, ey + uy * d + ux * sway - (w * S) / 2, d < len * 0.4 ? cols[1] : cols[2], w, w);
            }
        }
    }
    function domeTick(D, X, dt) {
        const st = X.st;
        const S = X.S;
        const Z = st.Z;
        const t = D.t;
        if (!st.released) {
            // 펑 — 몸에서 터져 나감
            st.released = true;
            screenFlash(S, st.white ? 0.6 : 0.3, '#ffffff', st.white ? 0.45 : 0.25);
            ring(st.cx, X.body.cy, S, st.R0 * 0.5, st.R0 * 3, 1, 0.4, ['#ffffff', st.cols[0], st.cols[1]], { size: 2, cut: D.ground });
            spray(st.cx, D.ground - S, S, ['#bda27a', '#8a7252', '#5c4a33', st.cols[2]], 16, 120 * Z, 300 * Z, { ang: -Math.PI / 2, spread: 1, g: 450 * Z, drag: 0.6, floorY: D.ground, life0: 0.6, life1: 1 });
        }
        st.waves = st.waves.filter((w) => t - w < 0.35);
        if (X.fade < 0.3) {
            return;
        }
        const tip = tipOf(D, X, 0.3);
        const { rx, ry } = domeGeom(D, X, st, tip);
        // 앞쪽 밑동에서 돌 · 흙이 튐
        st.rocks = Math.min(4, st.rocks + dt * (16 + 20 * hot(X)) * Z);
        while (st.rocks >= 1 && room()) {
            st.rocks -= 1;
            const side = Math.random() < 0.75 ? X.dir : -X.dir;
            const gx = st.cx + side * rx * rnd(0.85, 1.02);
            sigParticle({ x: gx, y: D.ground - S, s: S, vx: side * rnd(20, 90) * Z, vy: -rnd(90, 220) * Z, g: 450 * Z, drag: 0.6, max: rnd(0.5, 0.9), color: pick(['#bda27a', '#8a7252', '#5c4a33', st.cols[2]]), size: pick([1, 2, 2]), floorY: D.ground, update: UP.bounce, draw: DR.streak });
        }
        // 껍질에서 날리는 불똥
        st.embers = Math.min(4, st.embers + dt * 24 * Z);
        while (st.embers >= 1 && room()) {
            st.embers -= 1;
            const an = Math.PI * rnd(0.1, 0.9);
            sigParticle({ x: st.cx + Math.cos(an) * rx, y: D.ground - Math.sin(an) * ry, s: S, vx: Math.cos(an) * rnd(20, 60) * Z, vy: -rnd(20, 70) * Z, drag: 0.6, max: rnd(0.6, 1.1), color: pick([st.cols[0], st.cols[1], '#ffffff']), ph: rnd(0, TAU), draw: DR.ember });
        }
    }
    function domePush(D, X, strong) {
        if (!strong) {
            return;
        }
        const st = X.st;
        st.waves.push(D.t);
        ring(st.cx, X.body.cy, X.S, st.R0 * 0.5, st.R0 * 2.2, 1, 0.35, ['#ffffff', st.cols[0]], { cut: D.ground });
        glowSprite(X, [1, 2, 1], 350);
    }
    // 이김 — 충격파가 진 쪽을 덮치며 대폭발, 껍질은 화면 끝까지
    function domeWin(D, X, L) {
        const st = X.st;
        const S = X.S;
        const Z = st.Z;
        const x = L.body.cx;
        const y = Math.min(L.body.cy, D.ground - 2 * S);
        const R = clamp(D.lane * 2.8 * (0.85 + 0.3 * st.P), 18, D.H * 0.5);
        if (st.white) {
            screenFlash(S, 0.4, '#ffffff', 0.6);
        }
        explode(D, X, x, y, R, st.cols, { n: 55, sec: 1.0, rays: 14, smoke: 12, embers: 22 });
        burstRays(D, X, x, y, R * 0.4, st.cols, 14);
        spray(x, D.ground - S, S, ['#bda27a', '#8a7252', '#5c4a33', st.cols[2]], 20, 120 * Z, 320 * Z, { ang: -Math.PI / 2 + X.dir * 0.3, spread: 0.7, g: 450 * Z, drag: 0.6, floorY: D.ground, life0: 0.6, life1: 1.1 });
    }

    Object.assign(DUEL_FX, {
        beam: kind(beamInit, { charge: beamCharge, draw: beamDraw, tick: beamTick, push: beamPush, win: beamWin }),
        bolt: kind(boltInit, { charge: boltCharge, draw: boltDraw, tick: boltTick, push: boltPush, win: boltWin }),
        orb: kind(orbInit, { charge: orbCharge, draw: orbDraw, tick: orbTick, push: orbPush, win: orbWin }),
        dome: kind(domeInit, { charge: domeCharge, draw: domeDraw, tick: domeTick, push: domePush, win: domeWin }),
    });
})();
