
// ───── 필살기 연출 D — 몸 · 마음: ultrush · ultdive · ultbarrage · ultpsy · ultshadow (설계 · 약속은 ult/SPEC.md) ─────
// 쓰는 애는 캔버스 '꼭두각시'로 그림 — 진짜 그림은 잠깐 숨기고(ultHide), 60fps 로 빠르게 달리고 · 돌고 · 늘어나고 · 잔상을 남김.
// 진짜 그림은 ultMove 로 멈춰 둔 채(보는 쪽만 따라감) 제자리에 두었다가, 끝나면 마지막 자리로 옮기고 다시 보임 —
// 도중에 패널이 가려져 끊겨도 하늘 위 같은 엉뚱한 곳에 남지 않게. 꼭두각시는 어둠 위에 그려져 밝게 보임
// 크기는 그림(32px 남짓)이 아니라 패널 기준 U = max(R, 짧은 변 × 0.24) — nano 에서도 화면을 채우게
(() => {
    const TAU = Math.PI * 2;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const lerp = (a, b, k) => a + (b - a) * k;
    const easeOut = (k) => 1 - (1 - clamp(k, 0, 1)) ** 3;
    const easeIn = (k) => clamp(k, 0, 1) ** 2;
    const smooth = (k) => {
        k = clamp(k, 0, 1);
        return k * k * (3 - 2 * k);
    };
    // 살짝 넘쳤다 돌아옴
    const easeBack = (k) => {
        k = clamp(k, 0, 1) - 1;
        return 1 + 2.7 * k ** 3 + 1.7 * k ** 2;
    };
    const unit = (u) => Math.max(u.R, Math.min(u.W, u.H) * 0.24);
    const fail = (e) => ultError('fx-body', e);
    // 타이머 · 그리기 — 오류가 나도 밖으로 안 새게 (그리기는 ctx 상태도 늘 되돌림)
    const later = (ms, fn) => setTimeout(() => {
        try {
            fn();
        } catch (e) {
            fail(e);
        }
    }, Math.max(0, ms));
    const safeDraw = (fn) => (ctx, p, t, px) => {
        ctx.save();
        try {
            fn(ctx, p, t, px);
        } catch (e) {
            p.life = p.max;
            fail(e);
        }
        ctx.restore();
    };
    const safeUpd = (fn) => (p, dt) => {
        try {
            fn(p, dt);
        } catch (e) {
            p.life = p.max;
            fail(e);
        }
    };
    const emit = (ms, rate, fx) => sigEmitter({ until: performance.now() + ms, rate, fx: (e) => {
        try {
            fx(e);
        } catch (err) {
            e.until = 0;
            fail(err);
        }
    } });
    // 입자 1500개 넘지 않게 — 꾸밈 입자는 여유 있을 때만
    const roomFor = (n = 1) => moveParticles.length + n < 1250;
    const DUST = ['#e8dcc0', '#d8c9a8', '#bfae8a', '#9c8c6c'];
    const ROCK = SIG_PALETTE.rock;

    // ── 그림 ──
    const flipped = (el) => (el.style.transform || '').includes('-1');
    const leftSrc = (el) => (el.src || '').includes('_walk_left');
    const ready = (img) => !!img && (img instanceof HTMLCanvasElement ? img.width > 0 : img.complete && img.naturalWidth > 0);
    // 포켓몬 그림 — 발 가운데 (x, y) 기준으로 늘이고(sx, sy), 몸 가운데를 축으로 돌림
    function drawSprite(ctx, img, x, y, w, h, o = {}) {
        if (!ready(img) || w < 1 || h < 1) {
            return;
        }
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha *= o.alpha ?? 1;
        if (o.filter) {
            ctx.filter = o.filter;
        }
        ctx.translate(Math.round(x), Math.round(y));
        ctx.scale(o.sx ?? 1, o.sy ?? 1);
        ctx.translate(0, -h / 2);
        if (o.rot) {
            ctx.rotate(o.rot);
        }
        if (o.flip) {
            ctx.scale(-1, 1);
        }
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
    }
    // 한 색 실루엣 (잔상 · 테두리 · 번쩍) — 움직이는 그림이라 0.08초마다 새로
    const silCache = new Map();
    function silhouette(img, w, h, color) {
        w = Math.max(1, Math.round(w));
        h = Math.max(1, Math.round(h));
        const key = `${img.src}|${color}|${w}|${h}`;
        let c = silCache.get(key);
        if (!c) {
            if (silCache.size > 48) {
                silCache.clear();
            }
            c = { cv: document.createElement('canvas'), t: -1e9 };
            silCache.set(key, c);
        }
        const now = performance.now();
        if (now - c.t > 80 && ready(img)) {
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
    // 빛나는 테두리 — 실루엣을 d 만큼 사방으로 밀어 찍음
    function drawOutline(ctx, img, x, y, w, h, color, d, o = {}) {
        const sil = silhouette(img, w, h, color);
        for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) {
            drawSprite(ctx, sil, x + dx, y + dy, w, h, o);
        }
    }
    // 다른 포켓몬을 캔버스에 다시 그림 — 어둠 · 보랏빛 위로 테두리 빛과 함께 보이게 (넘어져 돌아간 동안은 건너뜀)
    function drawLit(ctx, qp, d, cols, alpha = 1) {
        const el = qp.el;
        const r = el.getBoundingClientRect();
        if (!r.width || Math.abs(r.width - el.offsetWidth) > 2 || Math.abs(r.height - el.offsetHeight) > 2) {
            return;
        }
        const x = r.left + r.width / 2;
        const o = { flip: flipped(el) };
        ctx.globalAlpha = alpha * 0.55;
        drawOutline(ctx, el, x, r.bottom, r.width, r.height, cols[3], 2 * d, o);
        ctx.globalAlpha = alpha;
        drawOutline(ctx, el, x, r.bottom, r.width, r.height, cols[1], d, o);
        drawSprite(ctx, el, x, r.bottom, r.width, r.height, { ...o, filter: el.style.filter || undefined });
    }
    // 맞은 애 번쩍 (하얀 실루엣)
    function hitFlash(qp, sec = 0.12, color = '#ffffff') {
        sigParticle({ x: 0, y: 0, s: 1, max: sec, draw: safeDraw((ctx, p, t) => {
            const el = qp.el;
            const r = el.getBoundingClientRect();
            if (!r.width || Math.abs(r.width - el.offsetWidth) > 2) {
                return;
            }
            ctx.globalAlpha = 1 - t;
            drawSprite(ctx, silhouette(el, r.width, r.height, color), r.left + r.width / 2, r.bottom, r.width, r.height, { flip: flipped(el) });
        }) });
    }
    // 여러 색 도트 그림 — map: 글자 → 색
    function glyph(ctx, px, S, x, y, rows, map, flip) {
        const n = rows[0].length;
        rows.forEach((row, j) => {
            for (let i = 0; i < n; i++) {
                const c = map[row[i]];
                if (c) {
                    dotAt(ctx, px, S, x + (flip ? n - 1 - i : i) * S, y + j * S, c);
                }
            }
        });
    }
    const FIST = ['..oooo.', '.o####o', 'o#w##wo', 'o#o#o#o', 'o#####o', '.o###o.', '..ooo..'];
    const BOOT = ['.ooo...', '.o#o...', '.o#o...', '.o#oooo', 'o#w###o', 'o#####o', '.ooooo.'];
    const ROCKS = [['..oo..', '.o#wo.', 'o###oo', 'o####o', '.oooo.'], ['.ooo.', 'o#wo.', 'o##oo', 'o###o', '.ooo.'], ['.oooo..', 'o#w##o.', 'o####oo', '.o####o', '..oooo.']];
    // 반짝 별 — 십자 빛살 + 짧은 대각선
    function star4(ctx, px, S, x, y, r, c0, c1) {
        const n = Math.max(1, Math.round(r / S));
        for (let i = 1; i <= n; i++) {
            const c = i <= n * 0.45 ? c0 : c1;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                dotAt(ctx, px, S, x + dx * i * S - S / 2, y + dy * i * S - S / 2, c);
            }
            if (i <= Math.max(1, n * 0.3)) {
                for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
                    dotAt(ctx, px, S, x + dx * i * S - S / 2, y + dy * i * S - S / 2, c1);
                }
            }
        }
        dotAt(ctx, px, S, x - S, y - S, c0, 2, 2);
    }
    // 도트 줄 (w 칸 굵기)
    function dotLine(ctx, px, S, x0, y0, x1, y1, color, w = 1) {
        const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / S));
        ctx.fillStyle = color;
        const o = ((w - 1) * S) / 2;
        for (let j = 0; j <= n; j++) {
            ctx.fillRect(px(x0 + ((x1 - x0) * j) / n - o), px(y0 + ((y1 - y0) * j) / n - o), w * S, w * S);
        }
    }
    // 납작한 타원 고리 (도트) — 점은 maxN 개까지
    function ellipseDots(ctx, px, S, x, y, rx, ry, colsList, phase = 0, gap = 0, maxN = 600) {
        const n = Math.min(maxN, Math.max(16, Math.round((rx + ry) / S) * 2));
        for (let j = 0; j < n; j++) {
            if (gap && (j + Math.floor(phase * 6)) % gap === 0) {
                continue;
            }
            const a = (j / n) * TAU + phase;
            dotAt(ctx, px, S, x + Math.cos(a) * rx, y + Math.sin(a) * ry, colsList[j % colsList.length]);
        }
    }
    // 꽉 찬 납작 타원 (가로줄)
    function fillEllipse(ctx, px, S, x, y, rx, ry, color) {
        ctx.fillStyle = color;
        for (let yy = -ry; yy <= ry; yy += S) {
            const hw = rx * Math.sqrt(Math.max(0, 1 - (yy / ry) ** 2));
            if (hw >= S / 2) {
                ctx.fillRect(px(x - hw), px(y + yy), Math.max(S, px(2 * hw)), S);
            }
        }
    }
    // 꼬리 남기는 점
    const streak = (ctx, p, t, px) => {
        const sz = p.size || 1;
        ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
        dotAt(ctx, px, p.s, p.x, p.y, p.color, sz, sz);
        ctx.globalAlpha *= 0.45;
        dotAt(ctx, px, p.s, p.x - p.vx * 0.03, p.y - p.vy * 0.03, p.color, sz, sz);
    };

    // 효과 밑으로 깔기 — 같은 프레임에 먼저 그린(= 나중에 만든) 효과 밑, 어둠 위. 겹은 안쪽부터
    const UNDER = 'destination-over';
    // 몸을 감싸는 불꽃 오라 — 가로줄을 쌓은 물방울 모양이 위로 넘실. lean: 꼭대기가 뒤로 쏠림
    function drawAura(ctx, px, S, cx, bottom, w, h, cols, T, k, lean = 0) {
        if (k <= 0.02) {
            return;
        }
        const H = h * (1.2 + 0.45 * k);
        const half0 = Math.max(w * (0.45 + 0.22 * k), 8);
        ctx.save();
        ctx.globalCompositeOperation = UNDER;
        for (const [m, c, a] of [[0.28, cols[0], 0.55], [0.52, cols[1], 0.62], [0.78, cols[2], 0.62], [1, cols[3], 0.45]]) {
            ctx.globalAlpha = a * Math.min(1, k * 1.4);
            ctx.fillStyle = c;
            const top = H * (0.55 + 0.45 * m);
            for (let yy = 0; yy < top; yy += S) {
                const f = yy / H;
                const shape = Math.sqrt(Math.max(0, Math.sin(Math.PI * Math.min(1, (f + 0.14) / 1.14)))) * (1 - f * 0.5);
                const flick = 1 + 0.2 * Math.sin(T * 23 + yy * 0.33 + m * 3) + 0.1 * Math.sin(T * 41 - yy * 0.7);
                const half = half0 * m * shape * flick;
                if (half < S * 0.5) {
                    continue;
                }
                const x = cx + lean * f * h * 0.45;
                ctx.fillRect(px(x - half), px(bottom - yy - S), Math.max(S, px(2 * half)), S);
            }
        }
        ctx.restore();
    }
    // 가로 혜성 꼬리 — (cx, cy) 머리에서 dir 쪽으로 길게 가늘어짐 (가로줄 한 번씩)
    function hComet(ctx, px, S, cx, cy, dir, len, r0, cols, T) {
        ctx.save();
        ctx.globalCompositeOperation = UNDER;
        for (const [m, c, a] of [[0.24, '#ffffff', 0.95], [0.48, cols[1], 0.9], [0.74, cols[2], 0.7], [1, cols[3], 0.42]]) {
            ctx.globalAlpha = a;
            ctx.fillStyle = c;
            const R0 = r0 * m;
            for (let y = -R0; y <= R0; y += S) {
                const f = Math.abs(y) / R0;
                const L = len * m * (1 - f ** 1.3) * (1 + 0.1 * Math.sin(T * 50 + y * 0.6));
                const head = Math.sqrt(Math.max(0, R0 * R0 - y * y)) * 0.7;
                const x0 = dir > 0 ? cx - head : cx - L;
                ctx.fillRect(px(x0), px(cy + y), Math.max(S, px(L + head)), S);
            }
        }
        ctx.restore();
    }
    // 비스듬한 혜성 꼬리 — (ux, uy) 쪽으로 겹겹 원판
    function comet(ctx, px, S, cx, cy, ux, uy, len, r0, cols, T) {
        ctx.save();
        ctx.globalCompositeOperation = UNDER;
        for (const [m, c, a] of [[0.22, '#ffffff', 0.95], [0.44, cols[1], 0.95], [0.7, cols[2], 0.75], [1, cols[3], 0.42]]) {
            ctx.globalAlpha = a;
            for (let d = 0; d < len * m; d += S * 3) {
                const r = r0 * m * (1 - d / (len * m)) ** 0.8 * (1 + 0.14 * Math.sin(T * 40 + d * 0.2));
                if (r < S) {
                    break;
                }
                sigDisc(ctx, px, S, cx + ux * d, cy + uy * d, r, c);
            }
        }
        ctx.restore();
    }

    // ── 터지는 것들 ──
    // 대폭발 충격 — 번쩍 원판 · 굵고 가는 빛살 · 고리 두 겹 · 튀는 빛 조각
    function bigBoom(x, y, S, cols, size, o = {}) {
        const flat = o.flat ?? 1;
        sigParticle({ x, y, s: S, max: 0.38, draw: safeDraw((ctx, p, t, px) => {
            const r = size * (0.32 + 0.48 * easeOut(t * 2.5)) * (1 - 0.55 * t);
            ctx.globalAlpha = 1 - t;
            sigDisc(ctx, px, S, p.x, p.y, r, cols[2]);
            sigDisc(ctx, px, S, p.x, p.y, r * 0.72, cols[1]);
            sigDisc(ctx, px, S, p.x, p.y, r * 0.45, '#ffffff');
        }) });
        const rays = [];
        const n = o.rays ?? 18;
        for (let i = 0; i < n; i++) {
            rays.push({ a: (i / n) * TAU + moveRand(-0.12, 0.12), l: size * (i % 2 ? moveRand(0.8, 1.15) : moveRand(1.4, 2.1)), w: i % 2 ? 1 : 2 });
        }
        sigParticle({ x, y, s: S, max: 0.45, draw: safeDraw((ctx, p, t, px) => {
            ctx.globalAlpha = 1 - t * t;
            for (const r of rays) {
                const L = r.l * easeOut(t * 4);
                const from = L * Math.max(0, t - 0.15) * 1.15;
                const ca = Math.cos(r.a);
                const sa = Math.sin(r.a) * flat;
                for (let d = from; d < L; d += r.w > 1 ? S * 1.5 : S) {
                    dotAt(ctx, px, S, p.x + ca * d, p.y + sa * d, d > L * 0.75 ? cols[0] : r.w > 1 ? '#ffffff' : cols[1], r.w, r.w);
                }
            }
        }) });
        sigRing(x, y, S, size * 0.3, size * 1.7, flat, 0.4, [cols[0], '#ffffff', cols[1]]);
        later(90, () => sigRing(x, y, S, size * 0.3, size * 2.6, flat * 0.8, 0.55, [cols[1], cols[2], '#ffffff']));
        const m = 30 + Math.round(size / 2.5);
        for (let i = 0; i < m && roomFor(); i++) {
            const a = moveRand(0, TAU);
            const sp = moveRand(90, 340) * Math.max(0.7, size / 70);
            sigParticle({ x, y, s: S, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * flat - 50, g: 340, drag: 1.5, max: moveRand(0.45, 0.85), color: movePick([...cols, '#ffffff']), size: movePick([1, 1, 2, 2]), draw: streak });
        }
    }
    // 작은 쾅 — 8방향 빛살 + 가운데 번쩍 (연타 한 발)
    function hitStar(x, y, S, cols, r) {
        sigParticle({ x, y, s: S, max: 0.17, rot: moveRand(0, 0.8), draw: safeDraw((ctx, p, t, px) => {
            ctx.globalAlpha = 1 - t * t;
            const L = r * (0.5 + 0.5 * easeOut(t * 3));
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * TAU + p.rot;
                const len = i % 2 ? L * 0.6 : L;
                const wd = i % 2 ? 1 : 2;
                for (let d = L * 0.3 * t + S; d < len; d += S) {
                    dotAt(ctx, px, S, p.x + Math.cos(a) * d - ((wd - 1) * S) / 2, p.y + Math.sin(a) * d - ((wd - 1) * S) / 2, d > len * 0.7 ? cols[1] : '#ffffff', wd, wd);
                }
            }
            const c = Math.max(0, Math.round((r * 0.22 * (1 - t)) / S));
            dotAt(ctx, px, S, p.x - c * S - S / 2, p.y - c * S - S / 2, '#ffffff', 2 * c + 1, 2 * c + 1);
        }) });
    }
    // 튀는 바위 조각 — 땅에 한 번 튀고 구름
    function debris(x, y, S, cols, n, spd, ground, bias = 0) {
        for (let i = 0; i < n && roomFor(); i++) {
            const a = -Math.PI / 2 + moveRand(-1.15, 1.15) + bias;
            const v = moveRand(0.35, 1) * spd;
            sigParticle({ x, y, s: S, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 640, drag: 0.4, max: moveRand(0.8, 1.3), color: movePick(cols), size: movePick([1, 2, 2, 3]), ground, hop: 0,
                update: (p) => {
                    const g = p.ground - p.size * p.s;
                    if (p.vy > 0 && p.y >= g) {
                        p.y = g;
                        p.hop += 1;
                        p.vy = p.hop > 1 ? 0 : -p.vy * 0.35;
                        p.vx *= p.hop > 1 ? 0.5 : 0.65;
                        if (p.hop > 1) {
                            p.g = 0;
                        }
                    }
                },
                draw: (ctx, p, t, px) => {
                    ctx.globalAlpha = t > 0.75 ? (1 - t) / 0.25 : 1;
                    dotAt(ctx, px, p.s, p.x, p.y, p.color, p.size, p.size);
                },
            });
        }
    }
    // 먼지 뭉게 — 커지며 옅어짐
    function dust(x, y, S, n, spread, bias = 0, big = 1) {
        for (let i = 0; i < n && roomFor(); i++) {
            sigParticle({ x: x + moveRand(-1, 1) * S * 3, y: y - moveRand(0, 3) * S, s: S, vx: (moveRand(-1, 1) + bias) * spread, vy: -moveRand(8, 35), drag: 2.4, max: moveRand(0.5, 0.95), r0: movePick([1, 2, 2]) * big, grow: 3 * big, color: movePick(DUST),
                draw: (ctx, p, t, px) => {
                    const r = Math.round(p.r0 + t * p.grow);
                    ctx.globalAlpha = 0.65 * (1 - t);
                    dotAt(ctx, px, p.s, p.x - (r * p.s) / 2, p.y - (r * p.s) / 2, p.color, r, r);
                },
            });
        }
    }
    // 빛 금 — (x, y) 에서 갈라져 뻗는 빛나는 금 (angleAt(i, n) 쪽으로, flat 은 세로 눌림)
    function cracks(x, y, S, cols, n, len, angleAt, flat = 1, sec = 1.2) {
        const paths = [];
        for (let i = 0; i < n; i++) {
            let a = angleAt(i, n);
            let cx = x;
            let cy = y;
            const pts = [[cx, cy]];
            const L = len * moveRand(0.55, 1.1);
            const seg = Math.max(3 * S, L / 7);
            for (let d = 0; d < L; d += seg) {
                a += moveRand(-0.45, 0.45);
                cx += Math.cos(a) * seg;
                cy += Math.sin(a) * seg * flat;
                pts.push([cx, cy]);
            }
            paths.push(pts);
            if (pts.length > 3 && Math.random() < 0.7) {
                const at = pts[Math.floor(pts.length / 2)];
                const b = a + movePick([-1, 1]) * moveRand(0.6, 1.1);
                const bl = L * 0.4;
                paths.push([at, [at[0] + Math.cos(b) * bl * 0.5, at[1] + Math.sin(b) * bl * 0.5 * flat], [at[0] + Math.cos(b + 0.3) * bl, at[1] + Math.sin(b + 0.3) * bl * flat]]);
            }
        }
        sigParticle({ x, y, s: S, max: sec, draw: safeDraw((ctx, p, t, px) => {
            const grow = Math.min(1, p.life / 0.12);
            ctx.globalAlpha = t > 0.55 ? (1 - t) / 0.45 : 1;
            for (const pts of paths) {
                const m = Math.max(2, Math.ceil(pts.length * grow));
                for (let k = 1; k < m; k++) {
                    dotLine(ctx, px, S, pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], cols[3], 3);
                }
                for (let k = 1; k < m; k++) {
                    dotLine(ctx, px, S, pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], t < 0.3 ? '#ffffff' : cols[0], 1);
                }
            }
        }) });
    }
    // 땅을 따라 달리는 충격파 — 납작한 고리 + 양쪽 끝에 솟는 물마루(먼지)
    function groundWave(x, y, S, cols, reach, sec = 0.7) {
        sigParticle({ x, y, s: S, max: sec, dusted: 0, update: safeUpd((p) => {
            const t = p.life / p.max;
            const r = 4 * S + (reach - 4 * S) * easeOut(t * 1.15);
            if (p.life - p.dusted > 0.06 && t < 0.8) {
                p.dusted = p.life;
                for (const sgn of [-1, 1]) {
                    const cx = p.x + sgn * r;
                    if (cx > -10 && cx < window.innerWidth + 10) {
                        dust(cx, p.y, S, 1, 25, sgn * 0.5);
                    }
                }
            }
        }), draw: safeDraw((ctx, p, t, px) => {
            const r = 4 * S + (reach - 4 * S) * easeOut(t * 1.15);
            ctx.globalAlpha = 1 - t;
            ellipseDots(ctx, px, S, p.x, p.y, r, Math.max(S * 2, r * 0.14), ['#ffffff', cols[0], cols[1]], 0, 0, 320);
            ellipseDots(ctx, px, S, p.x, p.y, r * 0.9, Math.max(S, r * 0.12), [cols[1], cols[2]], 0, 0, 200);
            const crest = Math.round((7 * (1 - t) + 2) * (reach > 200 ? 1.3 : 1));
            for (const sgn of [-1, 1]) {
                const cx = p.x + sgn * r;
                for (let j = 0; j < crest; j++) {
                    dotAt(ctx, px, S, cx - S, p.y - (j + 1) * S, j > crest - 3 ? '#ffffff' : cols[j % 2 ? 1 : 2], 2, 1);
                }
            }
        }) });
    }
    // 움푹 팬 자리 — 어두운 타원 + 빛나는 테두리
    function crater(x, y, S, cols, rx, sec) {
        sigParticle({ x, y, s: S, max: sec, draw: safeDraw((ctx, p, t, px) => {
            const R = rx * easeOut(Math.min(1, p.life / 0.12));
            const ry = Math.max(S * 2, R * 0.2);
            ctx.globalAlpha = t > 0.6 ? (1 - t) / 0.4 : 1;
            fillEllipse(ctx, px, S, p.x, p.y, R + S * 2, ry + S, cols[2]);
            fillEllipse(ctx, px, S, p.x, p.y, R, ry, '#140b06');
            ctx.globalAlpha *= 0.7 + 0.3 * Math.sin(p.life * 20);
            ellipseDots(ctx, px, S, p.x, p.y, R + S, ry + S * 0.5, [cols[0], '#ffffff', cols[1]], p.life * 2, 3);
        }) });
    }
    // 짧은 번개 — 0.05초마다 모양을 새로 (지직)
    function zap(x0, y0, x1, y1, S, tint, sec = 0.12, w = 1, jit = 2) {
        sigParticle({ x: x0, y: y0, s: S, max: sec, draw: safeDraw((ctx, p, t, px) => {
            if (!p.path || p.life - p.at > 0.05) {
                p.at = p.life;
                p.path = zigzag(x0, y0, x1, y1, S, jit);
            }
            ctx.globalAlpha = t > 0.6 ? (1 - t) / 0.4 : 1;
            zapLine(ctx, px, S, p.path, w, tint);
        }) });
    }
    // 불길 폭발
    function fireBlast(x, y, S, size, n) {
        const fc = SIG_PALETTE.fire;
        for (let i = 0; i < n && roomFor(); i++) {
            const a = moveRand(0, TAU);
            const sp = moveRand(40, 210) * Math.max(0.7, size / 70);
            sigParticle({ x, y, s: S, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: -60, drag: 2.3, max: moveRand(0.45, 0.9), cols: fc, grow: 3 + size / 30, smoke: 1, draw: DRAW.stream });
        }
        for (let i = 0; i < n / 2 && roomFor(); i++) {
            const a = moveRand(0, TAU);
            const sp = moveRand(100, 320);
            sigParticle({ x, y, s: S, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, g: 300, drag: 1, max: moveRand(0.5, 1), color: movePick(['#fff6b3', '#ffc93c', '#ff7a21']), draw: streak });
        }
    }
    // 물보라
    function splashUp(x, y, S, n, bias, ground, spd = 1) {
        const wc = SIG_PALETTE.water;
        for (let i = 0; i < n && roomFor(); i++) {
            sigParticle({ x: x + moveRand(-1, 1) * S * 3, y, s: S, vx: (moveRand(-1, 1) * 0.8 + bias) * 170 * spd, vy: -moveRand(120, 400) * spd, g: 720, drag: 0.3, max: moveRand(0.6, 1.1), color: movePick(wc), size: movePick([1, 2, 2, 3]), ground,
                update: (p) => {
                    if (p.vy > 0 && p.y > p.ground) {
                        p.life = p.max;
                    }
                },
                draw: streak,
            });
        }
    }
    // 속도선 — 화면 전체엔 옅게, band() = [위, 아래] 띠엔 진하게. 보는 쪽 반대로 휙휙
    function speedLines(sec, S, band, dir, cols) {
        sigParticle({ x: 0, y: 0, s: S, max: sec, lines: [], at: -1, draw: safeDraw((ctx, p, t, px) => {
            const W = window.innerWidth;
            const H = window.innerHeight;
            const [y0, y1] = band();
            if (p.life - p.at > 0.035) {
                p.at = p.life;
                p.lines = Array.from({ length: 26 }, (_, i) => {
                    const strong = i < 16;
                    return { x: moveRand(-60, W), y: strong ? moveRand(y0, y1) : moveRand(0, H), len: moveRand(30, 140) * (strong ? 1 : 1.5), c: movePick(['#ffffff', '#ffffff', cols[0], cols[1]]), th: Math.random() < 0.35 ? S : Math.max(1, S / 2), a: strong ? 0.65 : 0.22 };
                });
            }
            const f = fadeInOut(t, 0.08, 0.3);
            for (const l of p.lines) {
                ctx.globalAlpha = l.a * f;
                ctx.fillStyle = l.c;
                ctx.fillRect(Math.round(l.x - dir * p.life * 500), px(l.y), Math.round(l.len), l.th);
            }
        }) });
    }
    // 집중선 — 둘레에서 한 점으로 모이는 짧은 선 (만화처럼)
    function focusLines(sec, S, center, cols) {
        sigParticle({ x: 0, y: 0, s: S, max: sec, lines: [], at: -1, draw: safeDraw((ctx, p, t, px) => {
            const [cx, cy, r0, r1] = center();
            if (p.life - p.at > 0.05) {
                p.at = p.life;
                p.lines = Array.from({ length: 30 }, () => ({ a: moveRand(0, TAU), i: moveRand(0, 0.6), c: Math.random() < 0.35 ? cols[1] : '#ffffff' }));
            }
            const f = fadeInOut(t, 0.08, 0.2);
            for (const l of p.lines) {
                const ca = Math.cos(l.a);
                const sa = Math.sin(l.a) * 0.85;
                const d0 = r0 + (r1 - r0) * l.i;
                ctx.globalAlpha = 0.5 * f;
                ctx.fillStyle = l.c;
                for (let d = d0; d < r1; d += S) {
                    ctx.fillRect(px(cx + ca * d), px(cy + sa * d), S, S);
                }
            }
        }) });
    }
    // 빨려 드는 기 — 바깥에서 (cx(), cy()) 로 모이는 짧은 줄
    function pullIn(cx, cy, r, S, cols) {
        const a = moveRand(0, TAU);
        const rr = r * moveRand(1, 1.9);
        const x0 = cx() + Math.cos(a) * rr;
        const y0 = cy() + Math.sin(a) * rr * 0.8;
        sigParticle({ x: x0, y: y0, x0, y0, s: S, max: moveRand(0.22, 0.32), color: movePick([...cols, '#ffffff']),
            update: (q) => {
                const f = Math.min(1, (q.life / q.max) ** 2);
                q.px0 = q.x;
                q.py0 = q.y;
                q.x = q.x0 + (cx() - q.x0) * f;
                q.y = q.y0 + (cy() - q.y0) * f;
            },
            draw: (ctx, q, t, px) => {
                ctx.globalAlpha = Math.min(1, t * 4);
                const dx = (q.x0 - q.x) * 0.18;
                const dy = (q.y0 - q.y) * 0.18;
                dotLine(ctx, px, q.s, q.x, q.y, q.x + dx, q.y + dy, q.color, 1);
            },
        });
    }
    // 가장 가까운 다른 포켓몬
    function nearest(u, x) {
        let best;
        for (const q of u.others()) {
            if (q.w > 0 && q.x > -q.w && q.x < u.W + q.w && (!best || Math.abs(q.x - x) < Math.abs(best.x - x))) {
                best = q;
            }
        }
        return best;
    }
    // 날던 애가 땅에 내려왔으면 — 끝난 뒤 다시 하늘 높이로 순간이동하지 않게 내려앉기로
    function groundFly(pokemon) {
        const hs = pokemon.holdState;
        if (hs instanceof FlyState) {
            hs.phase = 'down';
        }
    }

    // ── 꼭두각시 — 쓰는 애 그림을 숨기고 캔버스에 대신 그림 ──
    function makePuppet(u, pokemon, ms) {
        const el = pokemon.el;
        // 자리 · 크기는 그림 기준 (메타몽 변신은 그림만 커짐), 없으면 클릭 영역
        const er0 = el.getBoundingClientRect();
        const cr = er0.width > 0 ? er0 : pokemon.collision.getBoundingClientRect();
        const er = er0.width > 0 ? er0 : cr;
        const pp = {
            el, pokemon,
            w: Math.max(4, Math.round(er.width || cr.width)), h: Math.max(4, Math.round(er.height || cr.height)),
            cw: cr.width || er.width, x: cr.left + cr.width / 2, y: cr.bottom,
            left0: pokemon.left, bottom0: pokemon.bottom, rl: cr.left, rb: cr.bottom,
            rot: 0, sx: 1, sy: 1, alpha: 1, show: true, live: true, flash: 0, k: 0, d: Math.max(1, Math.round(u.s)),
            face: u.dir, ghosts: [], ghostN: 0, ghostGap: 2, ghostCols: ['#ffffff'], glow: null, under: null, over: null,
        };
        pp.x0 = pp.x;
        pp.y0 = pp.y;
        ultHide(pokemon, true);
        // 진짜 위치를 꼭두각시에 맞춤 (화면 안으로)
        const sync = () => {
            const left = clamp(pp.left0 + (pp.x - pp.cw / 2 - pp.rl), 0, rightEdge(pokemon));
            const bottom = clamp(pp.bottom0 + (pp.rb - pp.y), pokemon.floor, Math.max(pokemon.floor, window.innerHeight - pp.h));
            if (Math.abs(left - pokemon.left) > 0.5) {
                pokemon.positionLeft(left);
            }
            if (Math.abs(bottom - pokemon.bottom) > 0.5) {
                pokemon.positionBottom(bottom);
            }
        };
        pp.state = ultMove(pokemon, (i, st) => {
            if (!pp.live) {
                return true;
            }
            faceState(st, pp.face < 0);
            return false;
        });
        pp.home = [pp.x, pp.y]; // 끝자리 (틀이 정함)
        // 끝 — 마지막 자리로 옮기고 진짜 그림을 다시 보임 (잡혀 있으면 위치는 그대로)
        pp.finish = (x = pp.x, y = pp.y) => {
            if (!pp.live) {
                return;
            }
            pp.x = x;
            pp.y = y;
            pp.live = false;
            pp.show = false;
            if (!(pokemon.currentState instanceof DragState)) {
                if (pokemon.currentState === pp.state) {
                    faceState(pp.state, pp.face < 0);
                }
                sync();
                el.glideAnim?.cancel?.();
            }
            pp.onFinish?.();
            ultHide(pokemon, false);
        };
        // 그리기가 멈춰 끝을 못 맺었을 때 대비 — 틀이 끝난 뒤(밝아지기 전) 끝자리로
        later(ms + 80, () => pp.finish(pp.home[0], pp.home[1]));
        sigParticle({ x: 0, y: 0, s: u.S, max: ms / 1000 + 0.6,
            update: safeUpd((p) => {
                if (!pp.live) {
                    p.life = p.max;
                    return;
                }
                pp.ghosts.unshift({ x: pp.x, y: pp.y, rot: pp.rot, sx: pp.sx, sy: pp.sy, flip: flipped(el), show: pp.show });
                if (pp.ghosts.length > 40) {
                    pp.ghosts.length = 40;
                }
            }),
            draw: safeDraw((ctx, p, t, px) => {
                if (!pp.show || !pp.live) {
                    return;
                }
                const flip = flipped(el);
                const { w, h } = pp;
                // 잔상 — 오래된 것부터 옅게
                for (let i = pp.ghostN; i >= 1; i--) {
                    const g = pp.ghosts[i * pp.ghostGap];
                    if (!g || !g.show) {
                        continue;
                    }
                    ctx.globalAlpha = 0.65 * (1 - i / (pp.ghostN + 1)) * pp.alpha;
                    drawSprite(ctx, silhouette(el, w, h, pp.ghostCols[i % pp.ghostCols.length]), g.x, g.y, w, h, { rot: g.rot, sx: g.sx, sy: g.sy, flip: g.flip });
                }
                ctx.globalAlpha = 1;
                pp.under?.(ctx, px, flip);
                const o = { rot: pp.rot, sx: pp.sx, sy: pp.sy, flip };
                if (pp.glow) {
                    ctx.globalAlpha = 0.55 * pp.alpha;
                    drawOutline(ctx, el, pp.x, pp.y, w, h, pp.glow[1], 2 * pp.d, o);
                    ctx.globalAlpha = 0.95 * pp.alpha;
                    drawOutline(ctx, el, pp.x, pp.y, w, h, pp.glow[0], pp.d, o);
                }
                ctx.globalAlpha = pp.alpha;
                drawSprite(ctx, el, pp.x, pp.y, w, h, { ...o, filter: el.style.filter || undefined });
                if (pp.flash > 0) {
                    ctx.globalAlpha = Math.min(1, pp.flash) * pp.alpha;
                    drawSprite(ctx, silhouette(el, w, h, '#ffffff'), pp.x, pp.y, w, h, o);
                }
                ctx.globalAlpha = 1;
                pp.over?.(ctx, px, flip);
            }),
        });
        return pp;
    }

    Object.assign(ULT_FX, {
        // ── 돌진 — 오라 · 웅크리기 → 화면 끝까지 돌진(혜성 꼬리 · 잔상 · 불탄 자국 · 지나가며 튕겨냄) → 벽에 쾅(화면 금 · 파편 · 땅 충격파) → 공중제비로 튕겨 나와 제자리로 ──
        ultrush: {
            ms: (P, o) => (o.fast ? 2900 : 3300) + 300 * P,
            run: (u, o, ms, pokemon) => {
                const K = 0.4 + 0.6 * u.P;
                const S = u.S;
                const kind = o.flame ? 'fire' : o.elec ? 'electric' : o.water ? 'water' : '';
                const cols = sigPal(o.c || kind || 'gold');
                const ac = kind ? sigPal(kind) : cols; // 오라 · 두른 것
                const hot = kind ? ac : SIG_PALETTE.hyper; // 불똥 · 빛 자국 덧색
                const W = u.W;
                const U = unit(u);
                const pp = makePuppet(u, pokemon, ms);
                const { w, h } = pp;
                const half = pp.cw / 2;
                const xs = pp.x;
                const ys = pp.y;
                let dir = u.dir;
                const room = (d) => (d > 0 ? W - half - xs : xs - half);
                if (room(dir) < w * 1.5 && room(-dir) > room(dir)) {
                    dir = -dir;
                }
                const xe = dir > 0 ? W - half : half;
                const dist = Math.abs(xe - xs);
                const C = o.fast ? 0.55 : 0.85; // 모으기
                const speed = (o.fast ? 2300 : 1400) * (0.85 + 0.3 * K);
                const D = clamp(dist / speed, 0.15, 0.45); // 돌진
                const G = o.drill ? 0.42 : 0.14; // 벽에 박힘 (드릴은 갈아 댐)
                const tHit = C + D;
                const tBoom = o.drill ? tHit + G - 0.04 : tHit;
                const RB = 0.42; // 공중제비로 튕겨 나옴
                const xr = xe - dir * Math.min(Math.max(w * 1.8, U), dist * 0.45);
                const tLand = tHit + G + RB;
                const xr2 = xr - dir * S * 5;
                const tTurn = tLand + 0.22;
                const D2 = clamp(Math.abs(xr2 - xs) / (speed * 0.7), 0.16, 0.45);
                const tHome = tTurn + D2;
                const end = ms / 1000;
                const tDone = Math.min(tHome + 0.5, end - 0.05);
                const hop = clamp(h * 1.1, 16, u.H * 0.3);
                const onGround = ys >= u.ground - 4;
                const aw = Math.max(w, U * 0.75); // 오라 크기
                const ah = Math.max(h, U * 0.95);
                const t0 = performance.now();
                const clock = () => (performance.now() - t0) / 1000;
                const spin = (T) => dir * TAU * (T < C ? (1.5 * T * T) / C : 1.5 * C + 4.5 * (T - C));
                const path = (T) => {
                    if (T < C) {
                        const k = T / C;
                        return { x: xs + Math.sin(T * 90) * S * 0.7 * k, y: ys, rot: o.drill ? spin(T) : dir * 0.12 * k, sx: 1 + 0.12 * k, sy: 1 - 0.16 * k };
                    }
                    if (T < tHit) {
                        const k = (T - C) / D;
                        return { x: xs + (xe - xs) * k ** 1.25, y: ys, rot: o.drill ? spin(T) : dir * 0.18, sx: 1.3, sy: 0.82 };
                    }
                    if (T < tHit + G) {
                        const k = (T - tHit) / G;
                        return { x: xe + (o.drill ? Math.sin(T * 130) * S * 0.8 : 0), y: ys, rot: o.drill ? spin(T) : 0, sx: lerp(0.62, 1, easeOut(k)), sy: lerp(1.25, 1, easeOut(k)) };
                    }
                    if (T < tLand) {
                        const k = (T - tHit - G) / RB;
                        return { x: xe + (xr - xe) * easeOut(k), y: ys - hop * 4 * k * (1 - k), rot: -dir * TAU * smooth(k), sx: 1, sy: 1 };
                    }
                    if (T < tTurn) {
                        const k = (T - tLand) / (tTurn - tLand);
                        return { x: xr + (xr2 - xr) * easeOut(k), y: ys, rot: 0, sx: 1 + 0.14 * (1 - k), sy: 1 - 0.18 * (1 - k) };
                    }
                    if (T < tHome) {
                        const k = (T - tTurn) / D2;
                        return { x: xr2 + (xs - xr2) * smooth(k), y: ys, rot: -dir * 0.12, sx: 1.15, sy: 0.9 };
                    }
                    const k = clamp((T - tHome) / 0.2, 0, 1);
                    return { x: xs, y: ys, rot: 0, sx: 1 + 0.12 * (1 - k), sy: 1 - 0.14 * (1 - k) };
                };
                const auraK = (T) => (T < C ? smooth(T / C) : T < tHit + G ? 1 : T < tHome ? 0.65 : 0.65 * Math.max(0, 1 - (T - tHome) / 0.45));
                pp.ghostCols = [ac[1], ac[2], '#ffffff', ac[3]];
                pp.face = dir;
                pp.home = [xs, ys];
                // 몸 뒤 — 오라 · 돌진 중엔 혜성 꼬리
                pp.under = (ctx, px) => {
                    const T = clock();
                    if (T >= C && T < tHit + 0.05) {
                        const len = Math.min(U * 2.8, Math.abs(pp.x - xs) + U * 0.6);
                        hComet(ctx, px, S, pp.x, pp.y - h * 0.45, -dir, len, Math.max(h * 0.62, U * 0.4), ac, T);
                        return;
                    }
                    drawAura(ctx, px, S, pp.x, pp.y, aw * Math.min(pp.sx, 1.1), ah, ac, T, pp.k, 0);
                };
                // 몸 앞 — 드릴 원뿔 · 앞쪽 충격파 · 두른 번개 · 물 막
                let arcs = [];
                let arcAt = -1;
                pp.over = (ctx, px) => {
                    const T = clock();
                    const dash = T >= C && T < tHit;
                    const cy = pp.y - h * 0.5;
                    if (o.drill && T < tHit + G) {
                        const k = T < C ? smooth(T / C) : 1;
                        const len = Math.max(w, U * 0.7) * (0.6 + 0.4 * K) * k;
                        const r0 = Math.max(h * 0.45, U * 0.3);
                        const bx = pp.x + dir * w * 0.3;
                        if (len > S * 2) {
                            for (let d = 0; d < len; d += S) {
                                const rr = r0 * (1 - d / len);
                                for (let yy = -rr; yy <= rr; yy += S) {
                                    const band = (Math.floor((d + yy * 1.4 + T * 300) / (S * 3)) & 1) === 0;
                                    ctx.globalAlpha = 0.95;
                                    dotAt(ctx, px, S, bx + dir * d, cy + yy, Math.abs(yy) > rr - S ? cols[3] : band ? cols[0] : cols[2]);
                                }
                            }
                            // 몸을 감는 나선 두 줄
                            for (let j = 0; j < 2; j++) {
                                for (let d = -w * 0.8; d < len; d += S) {
                                    const th = d * 0.2 - T * 32 + j * Math.PI;
                                    const rr = (d < 0 ? Math.max(h * 0.6, r0) : r0 * (1 - d / len)) + S * 2;
                                    const front = Math.sin(th) > 0;
                                    ctx.globalAlpha = (front ? 0.95 : 0.35) * k;
                                    dotAt(ctx, px, S, bx + dir * d, cy + Math.cos(th) * rr, front ? '#ffffff' : ac[1], front ? 2 : 1, 1);
                                }
                            }
                        }
                    }
                    if (dash) {
                        // 앞쪽 공기 벽 — 초승달 두 겹
                        for (const [m, c] of [[1, ac[1]], [0.7, '#ffffff']]) {
                            ctx.globalAlpha = 0.85;
                            const r = Math.max(h * 0.85, U * 0.55) * m;
                            for (let a = -1.15; a <= 1.15; a += 0.1) {
                                dotAt(ctx, px, S, pp.x + dir * (w * (o.drill ? 1.1 : 0.5) + Math.cos(a) * r * 0.5), cy + Math.sin(a) * r, Math.abs(a) < 0.45 ? '#ffffff' : c, 1, 2);
                            }
                        }
                    }
                    if (kind === 'electric' && T < tHome) {
                        if (T - arcAt > 0.05) {
                            arcAt = T;
                            arcs = [];
                            for (let j = 0; j < 4 + Math.round(3 * K); j++) {
                                const a = moveRand(0, TAU);
                                const r = Math.max(aw, ah) * moveRand(0.4, 0.75) * (0.6 + 0.4 * pp.k);
                                arcs.push(zigzag(pp.x + Math.cos(a) * w * 0.2, cy + Math.sin(a) * h * 0.2, pp.x + Math.cos(a) * r, cy + Math.sin(a) * r, S, 1.5));
                            }
                        }
                        ctx.globalAlpha = 0.9 * pp.k;
                        arcs.forEach((a) => zapLine(ctx, px, S, a, 1, ac[2]));
                    }
                    if (kind === 'water' && T < tHome) {
                        ctx.globalAlpha = 0.8 * pp.k;
                        ellipseDots(ctx, px, S, pp.x + (dash ? dir * w * 0.15 : 0), cy, Math.max(w, U * 0.5) * (dash ? 0.8 : 0.65), Math.max(h, U * 0.5) * 0.65, [ac[0], ac[2], ac[1], ac[3]], T * 7, 5);
                    }
                };
                const victims = u.others().filter((q) => (q.x - xs) * dir > -q.w * 0.3).map((q) => ({ q, hit: false }));
                const smash = (q) => {
                    ultHit(q, dir, 'spin');
                    hitFlash(q.pokemon, 0.15);
                    hitStar(q.x, q.y, S, ['#ffffff', ac[1], ac[2]], U * 0.6);
                    sigRing(q.x, q.y, S, 4, U * 0.9, 1, 0.3, ['#ffffff', ac[1]]);
                    sigBurst(q.x, q.y, S, ['#ffffff', ...ac], 14 + Math.round(8 * K), 150);
                    ultShake(2 + K, 180);
                    screenFlash(S, 0.15, '#ffffff', 0.1);
                };
                sigParticle({ x: 0, y: 0, s: S, max: end + 0.3, update: safeUpd((p) => {
                    const T = clock();
                    Object.assign(pp, path(T));
                    pp.k = auraK(T);
                    pp.face = T >= tTurn - 0.12 && T < tHome + 0.15 ? -dir : dir;
                    pp.ghostN = T >= C && T < tHit + G * 0.5 ? (o.fast ? 10 : 6) : T >= tTurn && T < tHome ? 3 : T >= tHit + G && T < tLand ? 2 : 0;
                    pp.flash = Math.max(0, pp.flash - 0.07);
                    pp.glow = T >= C && T < tHit + G ? [ac[1], ac[3]] : null;
                    if (T >= C && T < tHit + 0.1) {
                        const front = pp.x + dir * w * 0.45;
                        for (const v of victims) {
                            if (!v.hit && (front - (v.q.x - dir * v.q.w * 0.3)) * dir >= 0 && Math.abs(v.q.y - (pp.y - h / 2)) < (v.q.h + h) * 0.8 + U * 0.3) {
                                v.hit = true;
                                smash(v.q);
                            }
                        }
                    }
                    if (T >= tDone) {
                        pp.finish(xs, ys);
                        p.life = p.max;
                    }
                }) });
                // ① 모으기 — 빨려 드는 기 · 발밑 빛 · 고리 · 들썩이는 돌멩이 · 솟는 불꽃 · 두른 것
                emit(C * 1000 - 40, 70 + 50 * K, () => roomFor() && pullIn(() => pp.x, () => pp.y - h * 0.5, U * 1.1, S, ac));
                emit(C * 1000 + 80, 60 + 40 * K, () => {
                    if (!roomFor()) {
                        return;
                    }
                    const x = pp.x + moveRand(-0.45, 0.45) * aw;
                    const y = pp.y - moveRand(0, 0.6) * ah;
                    if (kind === 'fire') {
                        sigParticle({ x, y, s: S, vx: moveRand(-10, 10), vy: -moveRand(60, 130), g: -30, drag: 1.4, max: moveRand(0.3, 0.55), cols: ac, grow: 2 + 2 * K, draw: DRAW.stream });
                    } else {
                        sigParticle({ x, y, s: S, vx: moveRand(-8, 8), vy: -moveRand(60, 140), drag: 1.2, max: moveRand(0.3, 0.5), color: movePick(ac), size: movePick([1, 1, 2]), draw: (ctx, q, t, px) => {
                            ctx.globalAlpha = fadeInOut(t, 0.1, 0.4);
                            dotAt(ctx, px, q.s, q.x, q.y, q.color, q.size, q.size * 3);
                        } });
                    }
                });
                if (onGround) {
                    sigParticle({ x: xs, y: ys, s: S, max: C + 0.2, draw: safeDraw((ctx, q, t, px) => {
                        const k = Math.min(1, q.life / C);
                        ctx.globalAlpha = (0.35 + 0.25 * Math.sin(q.life * 30)) * k * (t > 0.85 ? (1 - t) / 0.15 : 1);
                        fillEllipse(ctx, px, S, xs, ys - S, aw * (0.7 + 0.4 * k), Math.max(S * 2, aw * 0.16), ac[1]);
                        ctx.globalAlpha *= 1.4;
                        fillEllipse(ctx, px, S, xs, ys - S, aw * 0.4 * (0.7 + 0.4 * k), Math.max(S, aw * 0.08), '#ffffff');
                    }) });
                    emit(C * 1000, 30, () => roomFor() && sigParticle({ x: xs + moveRand(-1.4, 1.4) * aw, y: ys - S, s: S, vy: -moveRand(20, 60), drag: 2.5, max: moveRand(0.5, 0.8), color: movePick(ROCK), size: movePick([1, 2, 2]),
                        draw: (ctx, q, t, px) => {
                            ctx.globalAlpha = fadeInOut(t, 0.1, 0.3);
                            dotAt(ctx, px, q.s, q.x + Math.sin(q.life * 70) * q.s * 0.5, q.y, q.color, q.size, q.size);
                        } }));
                    later(C * 500, () => cracks(xs, ys - S, S, ac, 4, U * 0.8, (i) => (i % 2 ? Math.PI : 0) + moveRand(-0.3, 0.3), 0.25, C * 0.5 + 0.6));
                }
                [0, 0.33, 0.66].forEach((f) => later(f * C * 1000, () => sigRing(xs, ys, S, 4, U * (1.3 + 0.5 * K), 0.28, 0.42, [ac[0], ac[2], '#ffffff'])));
                if (kind === 'electric') {
                    emit(C * 1000, 16, () => {
                        const a = moveRand(0, TAU);
                        const cy = pp.y - h * 0.5;
                        zap(pp.x, cy, pp.x + Math.cos(a) * U * 0.9, cy + Math.sin(a) * U * 0.7, S, ac[2], 0.1, 1);
                    });
                } else if (kind === 'water') {
                    emit(C * 1000, 60, () => {
                        if (!roomFor()) {
                            return;
                        }
                        const a0 = moveRand(0, TAU);
                        sigParticle({ x: pp.x, y: pp.y, s: S, max: moveRand(0.5, 0.8), a0, r: aw * moveRand(0.5, 0.75), color: movePick(ac), size: movePick([1, 2]),
                            update: (q) => {
                                const a = q.a0 + q.life * 11;
                                q.x = pp.x + Math.cos(a) * q.r;
                                q.y = pp.y - q.life * ah * 1.6 + Math.sin(a) * q.r * 0.3;
                            },
                            draw: DRAW.dot });
                    });
                }
                // ② 박차고 나감 — 번쩍 · 뒤로 튀는 흙 · 혜성 · 속도선 · 불탄 자국
                later(C * 1000, () => {
                    screenFlash(S, 0.3, '#ffffff', 0.16);
                    sigRing(xs, ys - h * 0.5, S, 4, U * 1.6, 1, 0.3, [ac[0], '#ffffff']);
                    if (onGround) {
                        debris(xs - dir * w * 0.2, ys, S, [...ROCK, ac[2]], 14 + Math.round(10 * K), 260, u.ground, -dir * 0.7);
                        dust(xs - dir * w * 0.3, ys, S, 12, 70, -dir, 1.5);
                    }
                    ultShake(2.5, 220);
                    speedLines(D + 0.15, S, () => [pp.y - Math.max(h, U) * 1.6, pp.y + S * 2], dir, ac);
                    // 지나간 자리에 남는 빛 자국 (땅 · 몸 높이)
                    sigParticle({ x: xs, y: ys, s: S, max: D + 0.75, draw: safeDraw((ctx, q, t, px) => {
                        const T = clock();
                        const x1 = T < tHit ? pp.x : xe;
                        const fade = T < tHit ? 1 : Math.max(0, 1 - (T - tHit) / 0.7);
                        const lo = Math.min(xs, x1);
                        const len = Math.abs(x1 - xs);
                        ctx.globalAlpha = 0.85 * fade;
                        ctx.fillStyle = hot[2];
                        ctx.fillRect(px(lo), px(ys - S * 2), px(len), S * 2);
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(px(lo), px(ys - S * 1.5), px(len), Math.max(1, S / 2));
                        ctx.globalAlpha = 0.45 * fade;
                        for (const f of [0.35, 0.7]) {
                            ctx.fillStyle = f > 0.5 ? ac[1] : ac[0];
                            ctx.fillRect(px(lo), px(ys - h * f), px(len), Math.max(1, S / 2));
                        }
                    }) });
                    emit(D * 1000 + 40, 190 + 90 * K, () => {
                        if (!roomFor()) {
                            return;
                        }
                        const bx = pp.x - dir * w * 0.35;
                        if (onGround && Math.random() < 0.55) {
                            sigParticle({ x: bx, y: ys - S, s: S, vx: -dir * moveRand(60, 260), vy: -moveRand(30, 190), g: 440, drag: 1.2, max: moveRand(0.25, 0.55), color: movePick(['#ffffff', hot[1], hot[2], ac[1]]), draw: streak });
                        }
                        if (kind === 'fire') {
                            sigParticle({ x: bx, y: pp.y - moveRand(0.1, 0.9) * h, s: S, vx: -dir * moveRand(20, 90), vy: moveRand(-50, 0), g: -60, drag: 2, max: moveRand(0.35, 0.7), cols: ac, grow: 3 + 2 * K, smoke: 1, draw: DRAW.stream });
                        } else if (kind === 'electric') {
                            if (Math.random() < 0.2) {
                                const y0 = pp.y - h * moveRand(0.2, 0.8);
                                zap(pp.x, y0, pp.x - dir * U * moveRand(0.8, 2), y0 + moveRand(-0.5, 0.5) * U, S, ac[2], 0.15, 1);
                            }
                            sigParticle({ x: bx, y: pp.y - moveRand(0.1, 0.9) * h, s: S, vx: -dir * moveRand(30, 120), vy: moveRand(-60, 60), drag: 3, max: 0.25, color: movePick(ac), draw: DRAW.dot });
                        } else if (kind === 'water') {
                            sigParticle({ x: bx, y: pp.y - moveRand(0.2, 0.7) * h, s: S, vx: -dir * moveRand(100, 280), vy: moveRand(-110, 10), g: 520, drag: 0.4, max: moveRand(0.4, 0.8), color: movePick(ac), size: movePick([1, 2, 2]), draw: streak });
                        } else {
                            sigParticle({ x: bx, y: pp.y - moveRand(0.1, 0.9) * Math.max(h, U * 0.7), s: S, vx: -dir * moveRand(60, 140), max: 0.25, len: Math.round(moveRand(4, 10)), dir, color: movePick(ac.slice(0, 3)),
                                draw: (ctx, q, t, px) => {
                                    ctx.globalAlpha = 1 - t;
                                    dotAt(ctx, px, q.s, q.dir > 0 ? q.x - q.len * q.s : q.x, q.y, q.color, q.len, 1);
                                } });
                        }
                    });
                });
                // ③ 벽에 쾅 (드릴은 불꽃 튀기며 갈아 대다가)
                const wx = dir > 0 ? W - 2 : 2;
                if (o.drill) {
                    later(tHit * 1000, () => {
                        ultShake(2, (G - 0.04) * 1000);
                        emit((G - 0.04) * 1000, 300, () => roomFor() && sigParticle({ x: wx - dir * S, y: pp.y - h * 0.5 + moveRand(-1, 1) * h * 0.35, s: S, vx: -dir * moveRand(80, 340), vy: moveRand(-300, 60), g: 520, drag: 0.8, max: moveRand(0.3, 0.6), color: movePick(['#ffffff', '#fff6b3', '#ffc93c', cols[0]]), draw: streak }));
                        cracks(wx, pp.y - h * 0.5, S, ac, 5, U * 0.9, () => (dir > 0 ? Math.PI : 0) + moveRand(-1.2, 1.2), 1, G + 0.3);
                    });
                }
                later(tBoom * 1000, () => {
                    const cy = pp.y - h * 0.5;
                    const size = U * (1.15 + 0.55 * K);
                    const bc = kind ? ['#ffffff', ...ac.slice(0, 3)] : ['#ffffff', ac[0], hot[1], hot[2]];
                    screenFlash(S, 0.7, '#ffffff', 0.25);
                    ultShake(4 + 5 * K, 900);
                    pp.flash = 1;
                    bigBoom(wx, cy, S, bc, size);
                    // 벽이 번쩍
                    // 게임 화면 = 벽 번쩍은 위 끝부터 · 금은 세로만 눌러 위 끝 아래 · 솟는 불길도 무대 높이만큼 (위 끝에 반쯤 걸쳐 머물던 것 — #96 디자인 4바퀴 · ult-top 걸쳐 머묾)
                    const gT = typeof fxStageTop === 'function' ? fxStageTop() : 0;
                    sigParticle({ x: wx, y: 0, s: S, max: 0.35, draw: safeDraw((ctx, q, t, px) => {
                        ctx.globalAlpha = 0.8 * (1 - t);
                        const bw = S * 4;
                        ctx.fillStyle = ac[1];
                        ctx.fillRect(dir > 0 ? W - bw * 2 : 0, gT, bw * 2, u.H - gT);
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(dir > 0 ? W - bw : 0, gT, bw, u.H - gT);
                    }) });
                    for (let k = 0; k < 2; k++) {
                        later(70 + k * 120, () => sigRing(wx, cy, S, 4, size * (1.4 + 0.8 * k), 1.6, 0.55, [ac[0], ac[2], '#ffffff']));
                    }
                    if (onGround) {
                        groundWave(wx, u.ground - S, S, ac, W * 0.6, 0.75);
                    }
                    const cl = Math.max(size * 1.4, u.H * 0.55);
                    cracks(wx, cy, S, ac, 7 + Math.round(3 * K), cl, (i, n) => (dir > 0 ? Math.PI : 0) + (i / (n - 1) - 0.5) * 2.9, gT > 0 ? clamp((cy - gT - 4 * S) / (cl * 1.26), 0.2, 1) : 1, 1.3);
                    debris(wx - dir * S * 2, cy, S, [...ROCK, ...ac.slice(1), hot[1]], 30 + Math.round(28 * K), 380, u.ground, -dir * 0.75);
                    dust(wx - dir * S * 4, u.ground, S, 16, 80, -dir * 0.8, 1.6);
                    // 벽 앞에 있던 애도 휘말림
                    u.others().forEach((q) => Math.abs(q.x - wx) < U * 1.4 + q.w / 2 && ultHit(q, -dir, 'tumble'));
                    if (kind === 'fire') {
                        fireBlast(wx - dir * S * 3, cy, S, size, 44 + Math.round(20 * K));
                        const rk = gT > 0 ? clamp((u.ground - gT - 16 * S) / 155, 0.35, 1) : 1;
                        emit(600, 80, () => roomFor() && sigParticle({ x: wx - dir * moveRand(0, U), y: u.ground - S, s: S, vx: moveRand(-15, 15), vy: -moveRand(130, 280) * rk, g: -40, drag: 1.2, max: moveRand(0.4, 0.8), cols: ac, grow: 3 + 2 * K, smoke: 1, draw: DRAW.stream }));
                    } else if (kind === 'electric') {
                        for (let i = 0; i < 7 + Math.round(3 * K); i++) {
                            const a = (dir > 0 ? Math.PI : 0) + moveRand(-1.3, 1.3);
                            const L = size * moveRand(1.1, 2.1);
                            zap(wx, cy, wx + Math.cos(a) * L, cy + Math.sin(a) * L, S, ac[2], moveRand(0.3, 0.5), 2, 2.5);
                        }
                        zap(wx - dir * S * 3, 0, wx - dir * S * 3, cy, S, ac[2], 0.35, 2, 3);
                    } else if (kind === 'water') {
                        splashUp(wx - dir * S * 3, cy, S, 80, -dir * 0.9, u.ground, 1.15);
                        sigRing(wx, cy, S, 4, size * 2.2, 1.2, 0.6, [ac[1], ac[2], '#ffffff']);
                    }
                });
                // ④ 착지 · ⑤ 제자리 — 먼지 · 마지막 기운
                later(tLand * 1000, () => {
                    if (onGround) {
                        dust(xr, ys, S, 8, 40, -dir * 0.5);
                    }
                    sigRing(xr, ys, S, 4, U * 0.8, 0.3, 0.3, [ac[1], '#ffffff']);
                });
                later(tHome * 1000, () => {
                    sigRing(xs, ys - h * 0.5, S, 4, U * 1.5, 1, 0.35, [ac[0], ac[1], '#ffffff']);
                    sigBurst(xs, ys - h * 0.5, S, [...ac, '#ffffff'], 16, 100);
                    if (onGround) {
                        dust(xs, ys, S, 6, 40, dir * 0.5);
                    }
                });
            },
        },

        // ── 다이브 — 웅크렸다 화면 위로 솟아 사라짐 → 하늘에 반짝 · 땅에 과녁 → 빛을 두르고 비스듬히 내리꽂힘 → 큰 충격파 · 팬 자리 · 파편 · 주변 튕겨 오름 ──
        ultdive: {
            ms: (P, o) => (o.heavy ? 3900 : 3500 + 200 * P),
            run: (u, o, ms, pokemon) => {
                const K = 0.4 + 0.6 * u.P;
                const S = u.S;
                const heavy = !!o.heavy;
                const kind = o.flame ? 'fire' : o.elec ? 'electric' : '';
                const cols = sigPal(o.c || kind || 'gold');
                const ac = kind ? sigPal(kind) : cols;
                const W = u.W;
                const H = u.H;
                const U = unit(u);
                const pp = makePuppet(u, pokemon, ms);
                const { w, h } = pp;
                const half = pp.cw / 2;
                const xs = pp.x;
                const ys = pp.y;
                const ty = u.ground;
                const tgt = nearest(u, xs);
                const tx = tgt ? clamp(tgt.x, half, W - half) : clamp(xs + u.dir * W * 0.3, half, W - half);
                // 하늘 반짝 별 (내리꽂기 출발) — 게임 화면 = 위 끝 + 별 (마지막 번쩍 2.6배) + 4칸 아래 (#96 ④)
                const top0 = typeof fxStageTop === 'function' ? fxStageTop() : 0;
                const gy = Math.max(10, H * 0.1, top0 > 0 ? top0 + (S * 3 + U * 0.45 * K) * 2.6 + 4 * S : 0);
                // 내리꽂는 자리 — 솟은 쪽에서 비스듬히, 화면 밖이면 반대쪽에서
                const off = Math.min(W * 0.32, (ty - gy) * 0.8);
                let side0 = Math.sign(xs - tx) || -u.dir;
                if (tx + side0 * off < W * 0.08 || tx + side0 * off > W * 0.92) {
                    side0 = -side0;
                }
                const gx = heavy ? tx : clamp(tx + side0 * off, W * 0.08, W * 0.92);
                const dT = Math.sign(tx - gx) || u.dir;
                const big = heavy ? 1.7 : 1;
                const yTop = -h * big - 16;
                const tUp = 0.45;
                const tGone = 0.74;
                const tDive = heavy ? 1.9 : 1.72;
                const tImp = tDive + (heavy ? 0.34 : 0.26);
                const end = ms / 1000;
                const ang = Math.atan2(ty - yTop, tx - gx);
                const rotDive = heavy ? 0 : clamp(dT > 0 ? ang : ang - Math.PI, -1.25, 1.25);
                const aw = Math.max(w, U * 0.75);
                const ah = Math.max(h, U * 0.95);
                const t0 = performance.now();
                const clock = () => (performance.now() - t0) / 1000;
                const tgtBox = () => {
                    if (tgt) {
                        const r = tgt.pokemon.collision.getBoundingClientRect();
                        return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, top: r.top };
                    }
                    return { x: tx, y: ty - h * 0.5, w, h, top: ty - h };
                };
                const path = (T) => {
                    if (T < tUp) {
                        const k = T / tUp;
                        return { x: xs + Math.sin(T * 90) * S * 0.6 * k, y: ys, rot: 0, sx: 1 + 0.14 * k, sy: 1 - 0.26 * k, show: true };
                    }
                    if (T < tGone) {
                        const k = (T - tUp) / (tGone - tUp);
                        return { x: xs, y: ys + (yTop - ys) * k * k, rot: 0, sx: 0.78, sy: 1.38, show: true };
                    }
                    if (T < tDive) {
                        return { x: gx, y: yTop, show: false };
                    }
                    if (T < tImp) {
                        const k = (T - tDive) / (tImp - tDive);
                        const e = heavy ? k * k : k ** 1.15;
                        return { x: gx + (tx - gx) * e, y: yTop + (ty - yTop) * e, rot: rotDive, sx: big * (heavy ? 1 : 0.9), sy: big * (heavy ? 1 : 1.1), show: true };
                    }
                    const k = clamp((T - tImp) / (heavy ? 0.55 : 0.4), 0, 1);
                    const b = easeOut(k);
                    return { x: tx, y: ty, rot: 0, sx: lerp(1.5 * (heavy ? 1.3 : 1), 1, b), sy: lerp(0.55, 1, b) * (heavy ? 1 + 0.06 * Math.sin(k * 9) * (1 - k) : 1), show: true };
                };
                pp.ghostCols = [ac[1], ac[2], '#ffffff'];
                pp.face = u.dir;
                pp.home = [tx, ty];
                pp.onFinish = () => groundFly(pokemon);
                pp.under = (ctx, px) => {
                    const T = clock();
                    if (T < tUp) {
                        drawAura(ctx, px, S, pp.x, pp.y, aw, ah, ac, T, smooth(T / tUp), 0);
                        return;
                    }
                    if (T < tGone) {
                        // 솟구치는 혜성 — 꼬리는 아래로
                        comet(ctx, px, S, pp.x, pp.y - h * 0.5, 0, 1, U * 2, Math.max(w, U * 0.6) * 0.55, ac, T);
                        return;
                    }
                    if (T >= tDive && T < tImp) {
                        const L0 = Math.hypot(tx - gx, ty - yTop) || 1;
                        comet(ctx, px, S, pp.x, pp.y - h * 0.5 * pp.sy, -(tx - gx) / L0, -(ty - yTop) / L0, U * (2.6 + 1.2 * K) * (heavy ? 1.2 : 1), Math.max(w, h, U * 0.6) * 0.62 * big, ac, T);
                        return;
                    }
                    if (T >= tImp) {
                        drawAura(ctx, px, S, pp.x, pp.y, aw, ah, ac, T, Math.max(0, 0.8 - (T - tImp) / 0.9), 0);
                    }
                };
                let arcs = [];
                let arcAt = -1;
                pp.over = (ctx, px) => {
                    const T = clock();
                    if (kind !== 'electric' || T > tImp + 0.6) {
                        return;
                    }
                    if (T - arcAt > 0.05) {
                        arcAt = T;
                        arcs = [];
                        for (let j = 0; j < 5; j++) {
                            const a = moveRand(0, TAU);
                            const r = Math.max(w, h, U * 0.6) * moveRand(0.5, 1) * big;
                            const cy = pp.y - h * 0.5;
                            arcs.push(zigzag(pp.x, cy, pp.x + Math.cos(a) * r, cy + Math.sin(a) * r, S, 1.5));
                        }
                    }
                    ctx.globalAlpha = 0.9;
                    arcs.forEach((a) => zapLine(ctx, px, S, a, 1, ac[2]));
                };
                sigParticle({ x: 0, y: 0, s: S, max: end + 0.3, update: safeUpd((p) => {
                    const T = clock();
                    const q = path(T);
                    pp.x = q.x;
                    pp.y = q.y;
                    pp.rot = q.rot ?? 0;
                    pp.sx = q.sx ?? 1;
                    pp.sy = q.sy ?? 1;
                    pp.show = q.show;
                    pp.face = T >= tDive ? dT : u.dir;
                    pp.ghostN = (T >= tUp && T < tGone) || (T >= tDive && T < tImp) ? 6 : 0;
                    pp.flash = Math.max(0, pp.flash - 0.06);
                    if (T >= end - 0.05) {
                        pp.finish(tx, ty);
                        p.life = p.max;
                    }
                }) });
                // ① 웅크리기 — 빨려 드는 기 · 좁혀 드는 고리
                emit(tUp * 1000, 80 + 40 * K, () => roomFor() && pullIn(() => xs, () => ys - h * 0.5, U, S, ac));
                [0, 0.5].forEach((f) => later(f * tUp * 1000, () => sigRing(xs, ys, S, U * 1.6, 4, 0.3, 0.3, [ac[1], '#ffffff'])));
                // ② 솟구침 — 발밑 충격파 · 먼지 · 남는 빛 기둥
                later(tUp * 1000, () => {
                    screenFlash(S, 0.3, '#ffffff', 0.16);
                    sigRing(xs, ys, S, 4, U * 2.2, 0.3, 0.45, [ac[0], '#ffffff', ac[2]]);
                    sigRing(xs, ys - h * 0.5, S, 4, U * 1.3, 1, 0.3, ['#ffffff', ac[1]]);
                    if (ys >= u.ground - 4) {
                        dust(xs, ys, S, 14, 90, 0, 1.4);
                        debris(xs, ys, S, [...ROCK, ac[2]], 12 + Math.round(8 * K), 230, u.ground);
                    }
                    ultShake(2.5, 250);
                    sigParticle({ x: xs, y: 0, s: S, max: 0.6, draw: safeDraw((ctx, q, t, px) => {
                        const hw = Math.max(w, U * 0.5) * 0.5 * (1 - t);
                        ctx.globalAlpha = 0.6 * (1 - t);
                        ctx.fillStyle = ac[1];
                        ctx.fillRect(px(xs - hw), 0, Math.max(S, px(2 * hw)), ys);
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(px(xs - hw * 0.35), 0, Math.max(S, px(0.7 * hw)), ys);
                    }) });
                    emit((tGone - tUp) * 1000 + 100, 100, () => roomFor() && sigParticle({ x: pp.x + moveRand(-0.5, 0.5) * aw, y: pp.y, s: S, vy: moveRand(40, 120), drag: 2, max: moveRand(0.3, 0.5), cols: [ac[0], '#ffffff', ac[2]], draw: DRAW.sparkle }));
                });
                // ③ 하늘에 반짝 · 땅에 과녁 (잠만보는 커지는 그림자)
                later((tGone + 0.1) * 1000, () => sigParticle({ x: gx, y: gy, s: S, max: tDive - tGone - 0.05, draw: safeDraw((ctx, q, t, px) => {
                    const T = clock();
                    const tw = 0.5 + 0.5 * Math.sin(T * 20);
                    const flare = t > 0.8 ? 1 + ((t - 0.8) / 0.2) * 1.6 : 1;
                    const r = (S * 3 + U * 0.45 * K) * (0.55 + 0.45 * tw) * flare * Math.min(1, t * 5);
                    ctx.globalAlpha = 1;
                    star4(ctx, px, S, gx, gy, r, '#ffffff', ac[1]);
                    ctx.globalAlpha = 0.6;
                    ellipseDots(ctx, px, S, gx, gy, r * 0.6, r * 0.6, [ac[1], '#ffffff'], T * 4, 3);
                }) }));
                later((tGone - 0.05) * 1000, () => sigParticle({ x: tx, y: ty, s: S, max: tImp - tGone + 0.05, draw: safeDraw((ctx, q, t, px) => {
                    const T = clock();
                    const k = clamp((T - tGone) / (tDive - tGone), 0, 1);
                    const b = tgtBox();
                    const blink = Math.floor(T * 12) % 2 === 0;
                    const red = '#ff4a4a';
                    if (heavy) {
                        // 점점 커지는 그림자
                        const kk = clamp((T - tGone) / (tImp - tGone), 0, 1);
                        const rx = lerp(w * 0.4, Math.max(w * 2.4, W * 0.22), kk * kk);
                        ctx.globalAlpha = 0.35 + 0.45 * kk;
                        fillEllipse(ctx, px, S, tx, ty - S, rx, Math.max(S * 2, rx * 0.16), '#000000');
                        ctx.globalAlpha = 0.5 + 0.4 * kk;
                        ellipseDots(ctx, px, S, tx, ty - S, rx + S, Math.max(S * 2, rx * 0.16) + S, [ac[1], ac[3]], T * 2, 3);
                    }
                    // 겨냥 줄 — 하늘 반짝에서 과녁까지 깜빡이는 점선
                    if (!heavy && T > tGone + 0.15) {
                        const n = Math.max(6, Math.round(Math.hypot(tx - gx, ty - gy) / (S * 6)));
                        ctx.globalAlpha = blink ? 0.7 : 0.35;
                        for (let j = 1; j < n; j++) {
                            if ((j + Math.floor(T * 20)) % 3 === 0) {
                                continue;
                            }
                            dotAt(ctx, px, S, lerp(gx, tx, j / n) - S / 2, lerp(gy, b.y, j / n) - S / 2, j % 2 ? red : '#ffffff');
                        }
                    }
                    // 땅의 고리 — 바깥에서 좁혀 듦
                    const rx = Math.max(b.w, U * 0.6) * (2.6 - 1.6 * k);
                    ctx.globalAlpha = 0.95;
                    ellipseDots(ctx, px, S, tx, ty - S, rx, Math.max(S * 2, rx * 0.2), blink ? [red, '#ffffff'] : [red, red, '#ffffff'], T * 3);
                    ellipseDots(ctx, px, S, tx, ty - S, rx * 1.04, Math.max(S * 2, rx * 0.2) + S, [red], T * 3, 2);
                    ellipseDots(ctx, px, S, tx, ty - S, rx * 0.5, Math.max(S, rx * 0.1), [red, '#ffffff'], -T * 4, 3);
                    // 몸 둘레 꺾쇠 — 좁혀 들며 깜빡
                    const hx = Math.max(b.w, U * 0.5) * (1.6 - 0.6 * k) * 0.5 + S * 2;
                    const hy = Math.max(b.h, U * 0.5) * (1.6 - 0.6 * k) * 0.5 + S * 2;
                    const arm = Math.max(3, Math.round((Math.max(b.w, U * 0.5) * 0.2) / S));
                    ctx.globalAlpha = blink ? 1 : 0.55;
                    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
                        const cx = b.x + sx * hx;
                        const cy = b.y + sy * hy;
                        for (let j = 0; j < arm; j++) {
                            dotAt(ctx, px, S, cx - sx * j * S, cy, red, 1, 2);
                            dotAt(ctx, px, S, cx, cy - sy * j * S, red, 2, 1);
                        }
                    }
                    // 머리 위 ! 표시
                    if (tgt && blink) {
                        const ex = b.x - S / 2;
                        const ey = b.top - S * 7;
                        ctx.globalAlpha = 1;
                        dotAt(ctx, px, S, ex - S, ey - S, '#3a0a0a', 3, 6);
                        dotAt(ctx, px, S, ex, ey, '#ffffff', 1, 3);
                        dotAt(ctx, px, S, ex, ey + S * 4, '#ffffff');
                    }
                }) }));
                // ④ 내리꽂힘 — 긴 빛줄기 · 비스듬한 속도선 · 두른 불
                later(tDive * 1000, () => {
                    screenFlash(S, 0.2, '#ffffff', 0.12);
                    sigParticle({ x: gx, y: yTop, s: S, max: tImp - tDive + 0.75, draw: safeDraw((ctx, q, t, px) => {
                        const T = clock();
                        const k = clamp((T - tDive) / (tImp - tDive), 0, 1);
                        const e = heavy ? k * k : k ** 1.15;
                        const hx = gx + (tx - gx) * e;
                        const hy = yTop + (ty - h * 0.5 - yTop) * e;
                        const fade = T < tImp ? 1 : Math.max(0, 1 - (T - tImp) / 0.7);
                        const wd = Math.max(1, Math.round((2 + 2 * K) * big * (0.4 + 0.6 * fade)));
                        ctx.globalAlpha = 0.5 * fade;
                        dotLine(ctx, px, S, gx, yTop, hx, hy, ac[3], wd + 2);
                        ctx.globalAlpha = 0.9 * fade;
                        dotLine(ctx, px, S, gx, yTop, hx, hy, ac[1], wd);
                        dotLine(ctx, px, S, gx, yTop, hx, hy, '#ffffff', Math.max(1, wd - 2));
                    }) });
                    // 내리꽂는 쪽으로 쏟아지는 빗금
                    const L0 = Math.hypot(tx - gx, ty - yTop) || 1;
                    const vx = (tx - gx) / L0;
                    const vy = (ty - yTop) / L0;
                    for (let i = 0; i < 18 && roomFor(); i++) {
                        const sp = moveRand(500, 900);
                        sigParticle({ x: moveRand(-0.2, 1.2) * W, y: moveRand(-0.4, 0.6) * H, s: S, vx: vx * sp, vy: vy * sp, max: moveRand(0.25, 0.4), len: moveRand(0.04, 0.08), c: movePick(['#ffffff', ac[0], ac[1]]),
                            draw: (ctx, q, t, px) => {
                                ctx.globalAlpha = 0.55 * (1 - t);
                                dotLine(ctx, px, S, q.x, q.y, q.x - q.vx * q.len, q.y - q.vy * q.len, q.c, 1);
                            } });
                    }
                    if (kind === 'fire') {
                        emit((tImp - tDive) * 1000, 220, () => roomFor() && sigParticle({ x: pp.x + moveRand(-0.5, 0.5) * aw, y: pp.y - moveRand(0, 1) * h * big, s: S, vx: moveRand(-30, 30), vy: -moveRand(20, 80), g: -60, drag: 1.5, max: moveRand(0.35, 0.7), cols: ac, grow: 3 + 2 * K, smoke: 1, draw: DRAW.stream }));
                    } else {
                        emit((tImp - tDive) * 1000, 130, () => roomFor() && sigParticle({ x: pp.x + moveRand(-0.6, 0.6) * aw, y: pp.y - moveRand(0, 1) * h * big, s: S, vx: moveRand(-40, 40), vy: -moveRand(30, 90), drag: 2, max: moveRand(0.3, 0.5), cols: [ac[0], '#ffffff', ac[2]], draw: DRAW.sparkle }));
                    }
                });
                // ⑤ 쾅 — 충격파 여러 겹 · 팬 자리 · 땅 금 · 파편 · 먼지 · 빛 기둥 · 주변 튕겨 오름
                later(tImp * 1000, () => {
                    const size = U * (1.25 + 0.6 * K) * (heavy ? 1.5 : 1);
                    const bc = ['#ffffff', ...ac.slice(0, 3)];
                    screenFlash(S, heavy ? 0.85 : 0.72, '#ffffff', 0.26);
                    ultShake(heavy ? 11 : 5 + 4 * K, heavy ? 1500 : 900);
                    pp.flash = 1;
                    bigBoom(tx, ty - S * 2, S, bc, size, { flat: 0.6 });
                    crater(tx, ty - S, S, ac, size * 0.75, 1.8);
                    const reach = heavy ? W * 1.1 : W * 0.4 + size;
                    groundWave(tx, ty - S, S, ac, reach, heavy ? 0.9 : 0.8);
                    later(heavy ? 260 : 150, () => groundWave(tx, ty - S, S, ac, reach * (heavy ? 0.85 : 0.7), 0.7));
                    sigRing(tx, ty - h * 0.5, S, 4, size * 1.9, 0.85, 0.5, [ac[0], '#ffffff', ac[2]]);
                    cracks(tx, ty - S, S, ac, heavy ? 10 : 7, size * (heavy ? 2.6 : 1.7), (i) => (i % 2 ? Math.PI : 0) + moveRand(-0.35, 0.35), 0.22, 1.5);
                    debris(tx, ty - S * 2, S, [...ROCK, ...ac.slice(1)], heavy ? 100 : 40 + Math.round(36 * K), heavy ? 480 : 400, u.ground);
                    dust(tx, ty, S, heavy ? 40 : 22, heavy ? 220 : 150, 0, 1.6);
                    // 빛 기둥
                    sigParticle({ x: tx, y: 0, s: S, max: 0.42, draw: safeDraw((ctx, q, t, px) => {
                        const hw = Math.max(w, U * 0.6) * 0.6 * big * (1 - t * 0.6);
                        ctx.globalAlpha = 0.75 * (1 - t);
                        ctx.fillStyle = ac[1];
                        ctx.fillRect(px(tx - hw), 0, px(2 * hw), ty);
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(px(tx - hw * 0.4), 0, Math.max(S, px(0.8 * hw)), ty);
                    }) });
                    if (kind === 'fire') {
                        fireBlast(tx, ty - h * 0.4, S, size, 54);
                        emit(700, 100, () => roomFor() && sigParticle({ x: tx + moveRand(-1, 1) * size * 0.8, y: ty - S, s: S, vx: moveRand(-10, 10), vy: -moveRand(130, 300), g: -40, drag: 1.2, max: moveRand(0.4, 0.8), cols: ac, grow: 3 + 2 * K, smoke: 1, draw: DRAW.stream }));
                    } else if (kind === 'electric') {
                        for (let i = 0; i < 3; i++) {
                            later(i * 90, () => zap(tx + moveRand(-1, 1) * size * 0.6, 0, tx, ty - S * 2, S, ac[2], 0.3, 2, 3));
                        }
                        for (let i = 0; i < 8; i++) {
                            const sgn = i % 2 ? -1 : 1;
                            const L = size * moveRand(1, 2.2);
                            zap(tx, ty - S, tx + sgn * L, ty - S + moveRand(-1, 1) * S * 3, S, ac[2], moveRand(0.3, 0.5), 1, 2);
                        }
                    }
                    // 맞기 — 가까우면 벌러덩, 좀 멀면 떠오름 (잠만보는 모두 통)
                    for (const q of u.others()) {
                        const d = Math.abs(q.x - tx);
                        const away = Math.sign(q.x - tx) || dT;
                        if (d < Math.max(U * 0.9, q.w)) {
                            ultHit(q, away, 'tumble');
                        } else if (heavy || d < W * 0.45) {
                            ultHit(q, away, heavy || d > W * 0.25 ? 'lift' : 'spin');
                        }
                    }
                });
            },
        },

        // ── 연타 — 가장 가까운 포켓몬에게 달려가 수십 발(분신 · 집중선 · 연타 수) → 끌어당겼다 마지막 한 방 → 공중제비로 제자리 ──
        // aura: 파동 인파이트 (루카리오) — 처음에 파동을 모으고 · 내내 파랑 · 검정 파동 불꽃 · 마지막에 동그란 파동 고리가 연달아 앞으로 날아감
        ultbarrage: {
            ms: (P, o) => (o.aura ? 5200 : 3800) + 200 * P,
            run: (u, o, ms, pokemon) => {
                const K = 0.4 + 0.6 * u.P;
                const S = u.S;
                const kind = ['punch', 'slash', 'kick'].includes(o.kind) ? o.kind : 'punch';
                const spinning = !!o.spin;
                const cols = sigPal(o.c || 'fight');
                const W = u.W;
                const U = unit(u);
                const gs = Math.max(S, Math.round(U / 24)); // 주먹 · 발 그림 칸
                const pp = makePuppet(u, pokemon, ms);
                const { w, h } = pp;
                const half = pp.cw / 2;
                const xs = pp.x;
                const ys = pp.y;
                const tgt = nearest(u, xs);
                const side = tgt ? Math.sign(tgt.x - xs) || u.dir : u.dir;
                let vx = xs + side * Math.min(W * 0.25, Math.max(w * 1.5, (side > 0 ? W - xs : xs) * 0.5));
                vx = clamp(vx, half + w, W - half - w * 0.2);
                const box0 = tgt ? { x: tgt.x, y: tgt.y, w: tgt.w, h: tgt.h, bottom: tgt.bottom, top: tgt.bottom - tgt.h } : { x: vx, y: ys - h * 0.5, w: Math.max(w, 24), h: Math.max(h, 24), bottom: ys, top: ys - Math.max(h, 24) };
                const ax = clamp(box0.x - side * (box0.w * 0.4 + w * 0.42), half, W - half);
                const ay = tgt ? box0.bottom : ys;
                const tGo = o.aura ? 0.85 : 0.3;
                const A = clamp(Math.abs(ax - xs) / 1600, 0.12, 0.35);
                const tF0 = tGo + A;
                const F = 1.45 + 0.35 * K;
                const tF1 = tF0 + F;
                const tBlow = tF1 + 0.2;
                const WAVE = o.aura ? 1.0 : 0; // 파동 장타가 화면 끝까지 뻗는 동안 자세를 잡고 버팀
                const tBack = tBlow + 0.42 + WAVE;
                const BK = 0.45;
                const tHome = tBack + BK;
                const end = ms / 1000;
                const hop = clamp(h * 1.2, 16, u.H * 0.3);
                const aw = Math.max(w, U * 0.7);
                const ah = Math.max(h, U * 0.9);
                // 맞는 시각 — 점점 빨라짐
                const hits = [];
                for (let t = tF0 + 0.02; t < tF1 - 0.04;) {
                    hits.push(t);
                    const f = (t - tF0) / F;
                    t += (0.075 - 0.04 * f) * (1.15 - 0.3 * K);
                }
                let hitN = 0;
                let combo = 0;
                let pop = 0;
                if (tgt) {
                    ultFreeze(tgt.pokemon, (tBlow + 0.3) * 1000);
                }
                const box = () => {
                    if (!tgt) {
                        return box0;
                    }
                    const r = tgt.pokemon.el.getBoundingClientRect();
                    const c = tgt.pokemon.collision.getBoundingClientRect();
                    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: c.width, h: c.height, bottom: r.bottom, top: r.top };
                };
                const t0 = performance.now();
                const clock = () => (performance.now() - t0) / 1000;
                const spinRot = (T) => side * TAU * 4.5 * Math.max(0, T - tGo * 0.5);
                let lunge = 0;
                const path = (T) => {
                    if (T < tGo) {
                        const k = T / tGo;
                        return { x: xs - side * S * 2 * k, y: ys, rot: spinning ? spinRot(T) : 0, sx: 1 + 0.1 * k, sy: 1 - 0.14 * k };
                    }
                    if (T < tF0) {
                        const k = smooth((T - tGo) / A);
                        return { x: xs + (ax - xs) * k, y: ys + (ay - ys) * k - (ay !== ys ? 0 : hop * 0.3 * Math.sin(Math.PI * k)), rot: spinning ? spinRot(T) : side * 0.2, sx: 1.25, sy: 0.85 };
                    }
                    if (T < tF1) {
                        lunge *= 0.82;
                        const bob = kind === 'kick' ? Math.abs(Math.sin(T * 26)) * h * 0.22 : 0;
                        return { x: ax + side * w * 0.22 * lunge + moveRand(-1, 1) * S * 0.6, y: ay - bob, rot: spinning ? spinRot(T) : side * (0.1 + 0.15 * lunge), sx: 1 + 0.12 * lunge, sy: 1 - 0.08 * lunge };
                    }
                    if (T < tBlow) {
                        const k = easeOut((T - tF1) / 0.2);
                        return { x: ax - side * w * 0.4 * k, y: ay, rot: -side * 0.25 * k, sx: 1 - 0.12 * k, sy: 1 + 0.12 * k };
                    }
                    if (T < tBack) {
                        const k = clamp((T - tBlow) / 0.06, 0, 1);
                        return { x: ax - side * w * 0.4 + side * w * 0.75 * k, y: ay, rot: side * 0.28 * k, sx: 1 + 0.25 * k, sy: 1 - 0.15 * k };
                    }
                    if (T < tHome) {
                        const k = (T - tBack) / BK;
                        const x1 = ax + side * w * 0.35;
                        return { x: x1 + (xs - x1) * easeOut(k), y: lerp(ay, ys, k) - hop * 4 * k * (1 - k), rot: -side * TAU * smooth(k), sx: 1, sy: 1 };
                    }
                    const k = clamp((T - tHome) / 0.2, 0, 1);
                    return { x: xs, y: ys, rot: 0, sx: 1 + 0.12 * (1 - k), sy: 1 - 0.15 * (1 - k) };
                };
                pp.ghostCols = [cols[1], '#ffffff', cols[2]];
                pp.face = side;
                pp.home = [xs, ys];
                pp.under = (ctx, px) => {
                    const T = clock();
                    if (T >= tGo && T < tF0 + 0.03) {
                        hComet(ctx, px, S, pp.x, pp.y - h * 0.45, -side, Math.min(U * 2.2, Math.abs(pp.x - xs) + U * 0.4), Math.max(h * 0.6, U * 0.35), cols, T);
                    }
                    const k = T < tGo ? smooth(T / tGo) : T < tF0 ? 1 : T < tF1 ? 0.55 : T < tBack ? 1 : Math.max(0, 1 - (T - tBack) / 0.7);
                    drawAura(ctx, px, S, pp.x, pp.y, aw, ah, cols, T, k * 0.85, T >= tGo && T < tF0 ? -side * 1.2 : 0);
                };
                pp.over = (ctx, px) => {
                    const T = clock();
                    if (!spinning || T < tGo || T > tBlow) {
                        return;
                    }
                    // 팽이 — 몸을 도는 칼바람 고리 세 줄
                    const cy = pp.y - h * 0.5;
                    for (let j = 0; j < 3; j++) {
                        const r = Math.max(w, U * 0.6) * (0.7 + j * 0.22);
                        for (let a = 0; a < TAU; a += 0.18) {
                            if ((Math.floor(a / 0.18) + j) % 3 === 0) {
                                continue;
                            }
                            const th = a + T * 26 * side + j;
                            const front = Math.sin(th) > 0;
                            ctx.globalAlpha = front ? 0.9 : 0.35;
                            dotAt(ctx, px, S, pp.x + Math.cos(th) * r, cy + Math.sin(th) * r * 0.28 + (j - 1) * h * 0.28, front ? '#ffffff' : cols[1], front ? 2 : 1, 1);
                        }
                    }
                };
                // 맞을 때마다 — 종류별 자국 · 분신 · 흔들림 · 연타 수
                const strike = (i) => {
                    const b = box();
                    let hx = b.x + moveRand(-0.55, 0.55) * Math.max(b.w, U * 0.5);
                    let hy = b.y + moveRand(-0.5, 0.5) * Math.max(b.h, U * 0.5);
                    if (spinning) {
                        const a = i * 1.1 + moveRand(-0.2, 0.2);
                        hx = b.x + Math.cos(a) * Math.max(b.w, U * 0.5) * 0.5;
                        hy = b.y + Math.sin(a) * Math.max(b.h, U * 0.5) * 0.45;
                        slashMark(hx, hy, S, cols, Math.max(b.w, U * 0.6) * moveRand(0.8, 1.2), a + Math.PI / 2);
                    } else if (kind === 'punch') {
                        fistHit(hx, hy, S, cols, side, gs);
                    } else if (kind === 'slash') {
                        slashMark(hx, hy, S, cols, Math.max(b.w, U * 0.6) * moveRand(0.9, 1.4), movePick([0.7, -0.7, 0.35, -0.35, 1.2, -1.2]) + (Math.random() < 0.5 ? 0 : Math.PI));
                    } else {
                        kickArc(hx, hy, S, cols, Math.max(b.h, U * 0.5) * 0.55, side, Math.random() < 0.5, gs);
                    }
                    hitStar(hx, hy, S, ['#ffffff', cols[2], cols[3]], U * moveRand(0.35, 0.55));
                    // 맞는 순간 번쩍 원판 · 튀는 불똥 · 때린 궤적
                    sigParticle({ x: hx, y: hy, s: S, max: 0.08, r: U * moveRand(0.12, 0.2), draw: (ctx, q, t, px) => {
                        ctx.globalAlpha = 1 - t;
                        sigDisc(ctx, px, S, q.x, q.y, q.r * (1 + t), cols[2]);
                        sigDisc(ctx, px, S, q.x, q.y, q.r * 0.6 * (1 + t), '#ffffff');
                    } });
                    for (let j = 0; j < 6 && roomFor(); j++) {
                        const a = moveRand(0, TAU);
                        const sp = moveRand(80, 220);
                        sigParticle({ x: hx, y: hy, s: S, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: 300, drag: 2, max: moveRand(0.2, 0.4), color: movePick(['#ffffff', cols[1], cols[2], cols[3]]), draw: streak });
                    }
                    if (!spinning && kind !== 'slash') {
                        const fx0 = pp.x + side * w * 0.3;
                        const fy0 = pp.y - h * moveRand(0.35, 0.65);
                        sigParticle({ x: fx0, y: fy0, s: S, max: 0.07, draw: (ctx, q, t, px) => {
                            ctx.globalAlpha = 0.85 * (1 - t);
                            dotLine(ctx, px, S, q.x, q.y, hx, hy, cols[2], 2);
                            dotLine(ctx, px, S, q.x, q.y, hx, hy, '#ffffff', 1);
                        } });
                    }
                    combo += 1;
                    pop = 1;
                    lunge = 1;
                    if (tgt) {
                        tgt.pokemon.el.animate([{ translate: `${side * S}px 0` }, { translate: '0 0' }], { duration: 70, composite: 'add' });
                        if (i % 3 === 0) {
                            hitFlash(tgt.pokemon, 0.07);
                        }
                    }
                    if (i % 4 === 3) {
                        ultShake(1.2 + K, 110);
                    }
                    if (i % 8 === 7) {
                        sigRing(b.x, b.y, S, 4, U * 1.1, 1, 0.25, ['#ffffff', cols[1]]);
                    }
                    // 분신 — 여기저기서 동시에 때리는 것처럼
                    if (!spinning && i % 2 === 0) {
                        const sd = Math.random() < 0.6 ? -side : side;
                        const cx = b.x - sd * (b.w * 0.5 + w * moveRand(0.3, 0.6));
                        const cyb = b.bottom - moveRand(0, 0.8) * Math.max(b.h, U * 0.4);
                        const el = pp.el;
                        const col = movePick([cols[2], cols[3], '#ffffff']);
                        sigParticle({ x: cx, y: cyb, s: 1, max: 0.18, draw: safeDraw((ctx, q, t) => {
                            ctx.globalAlpha = 0.85 * (1 - t);
                            drawSprite(ctx, silhouette(el, w, h, col), q.x, q.y, w, h, { flip: (sd < 0) !== leftSrc(el), rot: sd * 0.2 });
                        }) });
                    }
                };
                sigParticle({ x: 0, y: 0, s: S, max: end + 0.3, update: safeUpd((p) => {
                    const T = clock();
                    while (hitN < hits.length && T >= hits[hitN]) {
                        strike(hitN++);
                    }
                    Object.assign(pp, path(T));
                    pp.face = side;
                    pp.ghostN = T >= tGo && T < tF0 ? 6 : T >= tF0 && T < tF1 ? 2 : T >= tBlow && T < tBack ? 4 : T >= tBack && T < tHome ? 2 : 0;
                    pp.flash = Math.max(0, pp.flash - 0.07);
                    pop = Math.max(0, pop - 0.12);
                    if (T >= end - 0.05) {
                        pp.finish(xs, ys);
                        p.life = p.max;
                    }
                }) });
                // ① 준비 — 빨려 드는 기
                emit(tGo * 1000, 90, () => roomFor() && pullIn(() => pp.x, () => pp.y - h * 0.5, U, S, cols));
                if (o.aura) {
                    // 파랑 · 검정 파동 불꽃 — 내내 몸에서 피어오름 / 모을 때 파동이 확 피어오르는 고리 두 번 (검정은 어두운 화면에서도 보이게 짙은 남색)
                    const NAVY = ['#1d2a55', '#2e3d73', '#3b4a8a'];
                    emit(end * 1000, 60, () => {
                        if (!roomFor()) {
                            return;
                        }
                        const dark = Math.random() < 0.45;
                        sigParticle({ x: pp.x + moveRand(-0.5, 0.5) * w, y: pp.y - moveRand(0, 0.85) * h, s: S, vx: moveRand(-10, 10), vy: -moveRand(50, 110), drag: 1.5, max: moveRand(0.3, 0.55), color: movePick(dark ? NAVY : [cols[1], cols[2], cols[3]]), size: movePick([1, 2, 2]), draw: DRAW.dot });
                    });
                    later(tGo * 300, () => sigRing(xs, ys - h * 0.5, S, 4, U * 1.6, 1, 0.35, ['#ffffff', cols[1], NAVY[2]]));
                    later(tGo * 700, () => {
                        sigRing(xs, ys - h * 0.5, S, 4, U * 2.2, 1, 0.35, ['#ffffff', cols[2], NAVY[1]]);
                        ultShake(2, 160);
                    });
                }
                // 연타 수 · 집중선 (맞는 동안)
                later(tF0 * 1000, () => {
                    focusLines(tBlow - tF0 + 0.15, S, () => {
                        const b = box();
                        const r0 = Math.max(b.w, b.h, U * 0.5) * 0.9;
                        return [b.x, b.y, r0, r0 + U * 1.8];
                    }, cols);
                    sigParticle({ x: 0, y: 0, s: S, max: tBlow - tF0 + 1.1, draw: safeDraw((ctx, q, t, px) => {
                        const T = clock();
                        const b = box();
                        const fin = T >= tBlow;
                        const fs = Math.round(clamp(W / 22, 11, 20) * (fin ? 1.5 : 1) * (1 + 0.35 * pop));
                        const text = fin ? `${combo} HIT!!` : `${combo} HIT`;
                        ctx.font = `900 ${fs}px sans-serif`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        const hw = ctx.measureText(text).width / 2 + 4;
                        const x = clamp(b.x, hw, W - hw);
                        const gT = typeof fxStageTop === 'function' ? fxStageTop() : 0;
                        const yMin = Math.max(fs, gT > 0 ? gT + 4 * S + fs * 0.6 + Math.max(3, fs / 4) / 2 : 0); // 게임 화면 = 글씨 윗끝이 위 끝 + 4칸 아래 (위 끝에 반쯤 걸쳐 머물던 것 — #96 디자인 4바퀴 · ult-top 걸쳐 머묾)
                        const y = clamp(b.top - Math.max(U * 0.5, fs) - (fin ? (T - tBlow) * 20 : 0), yMin, u.H - fs);
                        ctx.globalAlpha = t > 0.85 ? (1 - t) / 0.15 : 1;
                        ctx.lineJoin = 'round';
                        ctx.lineWidth = Math.max(3, fs / 4);
                        ctx.strokeStyle = 'rgba(15, 5, 0, 0.9)';
                        ctx.strokeText(text, x, y);
                        ctx.fillStyle = fin ? '#ffe14d' : pop > 0.5 ? '#ffffff' : cols[1];
                        ctx.fillText(text, x, y);
                    }) });
                });
                // 박차고 나감
                later(tGo * 1000, () => {
                    sigRing(xs, ys - h * 0.5, S, 4, U * 1.3, 1, 0.3, [cols[0], '#ffffff']);
                    if (ys >= u.ground - 4) {
                        dust(xs, ys, S, 10, 60, -side, 1.4);
                    }
                    speedLines(A + 0.1, S, () => [Math.min(ys, ay) - Math.max(h, U) * 1.4, Math.max(ys, ay) + S], side, cols);
                });
                // 끌어당기기 — 빛이 주먹으로 모임
                later(tF1 * 1000, () => {
                    const b = box();
                    sigRing(b.x, b.y, S, U * 2, 4, 1, 0.2, ['#ffffff', cols[1]]);
                    emit(180, 140, () => roomFor() && pullIn(() => pp.x + side * w * 0.3, () => pp.y - h * 0.5, U, S, ['#ffffff', cols[0], cols[1]]));
                });
                // 마지막 한 방
                later(tBlow * 1000 + 40, () => {
                    const b = box();
                    const size = U * (1.2 + 0.6 * K);
                    screenFlash(S, 0.72, '#ffffff', 0.25);
                    ultShake(5 + 5 * K, 850);
                    pp.flash = 1;
                    bigBoom(b.x, b.y, S, ['#ffffff', ...cols.slice(0, 3)], size);
                    if (spinning || kind === 'slash') {
                        const L = Math.max(b.h, U * 0.6) * 3;
                        slashMark(b.x, b.y, S, cols, L, 0.8, 0.55, 2);
                        slashMark(b.x, b.y, S, cols, L, -0.8, 0.55, 2);
                        if (spinning) {
                            slashMark(b.x, b.y, S, cols, L * 1.1, Math.PI / 2, 0.55, 2);
                        }
                    } else if (kind === 'punch') {
                        fistHit(b.x, b.y, S, cols, side, gs * 2.5);
                    } else {
                        kickArc(b.x, b.y, S, cols, Math.max(b.h, U * 0.6) * 1.4, side, true, gs * 2.5);
                    }
                    // 앞으로 뻗는 충격파
                    sigParticle({ x: b.x, y: b.y, s: S, max: 0.55, draw: safeDraw((ctx, q, t, px) => {
                        ctx.globalAlpha = 1 - t;
                        for (let j = 0; j < 3; j++) {
                            const r = U * (0.5 + j * 0.3) + t * W * 0.4;
                            for (let a = -1; a <= 1; a += 0.08) {
                                dotAt(ctx, px, S, q.x + side * Math.cos(a) * r, q.y + Math.sin(a) * r * 0.9, j === 1 ? '#ffffff' : cols[j], 1, 2);
                            }
                        }
                    }) });
                    if (b.bottom >= u.ground - 4) {
                        groundWave(b.x, u.ground - S, S, cols, W * 0.45, 0.6);
                    }
                    if (tgt) {
                        ultHit(tgt, side, 'tumble');
                        const up = Math.min(u.H * 0.3, tgt.h * 1.6 + 10);
                        tgt.pokemon.el.animate([
                            { translate: '0 0', easing: 'ease-out' },
                            { translate: `${side * S * 3}px ${-up}px`, offset: 0.4, easing: 'ease-in' },
                            { translate: '0 0', offset: 0.75 },
                            { translate: `0 ${-up * 0.15}px`, offset: 0.87 },
                            { translate: '0 0' },
                        ], { duration: 700, composite: 'add' });
                        later(500, () => {
                            const r = tgt.pokemon.collision.getBoundingClientRect();
                            dust(r.left + r.width / 2, r.bottom, S, 12, 70, side * 0.5, 1.4);
                        });
                    }
                    // 뒤에 있던 애들도 충격파에
                    u.others().forEach((q) => {
                        if (q.pokemon !== tgt?.pokemon && (q.x - b.x) * side > -q.w * 0.5 && Math.abs(q.x - b.x) < W * 0.35) {
                            ultHit(q, side, 'tumble');
                        }
                    });
                    if (o.aura) {
                        // 파동 장타 — 주먹 끝에서 동그란 파동 고리(가운데가 빈 도넛)가 다섯 겹 연달아 앞으로 날아가며 점점 커짐
                        // (검정 테두리 · 파랑 · 하얀 심, 속은 옅게 빛남, 가장자리에서 파동 불똥이 흩날림) — 지나가는 길의 애는 고리가 닿을 때 날아감
                        const x0 = pp.x + side * w * 0.45;
                        const reach = Math.max(U, side > 0 ? W - x0 : x0) + U;
                        const rMax = clamp(Math.max(h, U) * 1.8, U, u.H * 0.4);
                        const yc = clamp(b.y, rMax * 0.9 + 4, u.ground - rMax * 0.9);
                        const travel = 0.75;
                        const far = (e) => reach * (1 - (1 - e) ** 1.6); // 빠르게 나가 끝에서 조금 느려짐
                        for (let k = 0; k < 5; k++) {
                            later(k * 120, () => {
                                ultShake(k === 0 ? 5 : 1.5, k === 0 ? 450 : 120);
                                sigParticle({ x: x0, y: yc, s: S, max: travel, spark: 0,
                                    update: safeUpd((q, dt) => {
                                        const e = q.life / travel;
                                        q.cx = x0 + side * far(e);
                                        q.r = rMax * (0.3 + 0.7 * easeOut(e)) * (0.85 + 0.15 * (k / 4));
                                        q.spark += dt * 45;
                                        while (q.spark >= 1 && roomFor()) {
                                            q.spark -= 1;
                                            const an = moveRand(0, TAU);
                                            sigParticle({ x: q.cx + Math.cos(an) * q.r * 0.38, y: q.y + Math.sin(an) * q.r, s: S, vx: Math.cos(an) * 50 + side * 90, vy: Math.sin(an) * 60, drag: 2, max: moveRand(0.3, 0.5), color: movePick(['#ffffff', cols[1], cols[2], '#2e3d73']), size: movePick([1, 2]), draw: DRAW.dot });
                                        }
                                        q.spark = Math.min(q.spark, 1);
                                    }),
                                    draw: safeDraw((ctx, q, t, px) => {
                                        if (!q.r) {
                                            return;
                                        }
                                        const a = t < 0.8 ? 1 : (1 - t) / 0.2;
                                        const rx = q.r * 0.38;
                                        // 속 — 아주 옅은 빛 (고리만 또렷하게, 도넛처럼)
                                        ctx.globalAlpha = 0.06 * a;
                                        ctx.fillStyle = cols[1];
                                        for (let dy = -q.r * 0.79; dy <= q.r * 0.79; dy += S) {
                                            const half = rx * 0.79 * Math.sqrt(Math.max(0, 1 - (dy / (q.r * 0.79)) ** 2));
                                            ctx.fillRect(px(q.cx - half), px(q.y + dy), Math.max(S, px(2 * half)), S);
                                        }
                                        // 고리 — 바깥부터 검정 · 짙은 파랑 · 파랑 · 하얀 심
                                        for (const [f, c, th] of [[1, '#141a33', 2], [0.93, cols[3], 2], [0.86, cols[2], 2], [0.79, '#ffffff', 1]]) {
                                            const path = new Path2D();
                                            const n = clamp(Math.round((TAU * q.r * f) / (2 * S)), 24, 220);
                                            for (let i = 0; i < n; i++) {
                                                const an = (i / n) * TAU;
                                                path.rect(px(q.cx + Math.cos(an) * rx * f - S), px(q.y + Math.sin(an) * q.r * f - S), th * S, th * S);
                                            }
                                            ctx.globalAlpha = a;
                                            ctx.fillStyle = c;
                                            ctx.fill(path);
                                        }
                                    }) });
                            });
                        }
                        // 지나가는 길에 있는 애 — 첫 고리가 닿는 때 날아감
                        u.others().forEach((q) => {
                            const dx = (q.x - x0) * side;
                            if (dx > -q.w * 0.5 && Math.abs(q.y - yc) < rMax + q.h * 0.5) {
                                const e = 1 - (1 - clamp(dx / reach, 0, 1)) ** (1 / 1.6);
                                later(e * travel * 1000, () => ultHit(q, side, 'tumble'));
                            }
                        });
                    }
                });
                later(tHome * 1000, () => {
                    if (ys >= u.ground - 4) {
                        dust(xs, ys, S, 6, 40);
                    }
                    sigRing(xs, ys, S, 4, U * 0.8, 0.3, 0.3, [cols[1], '#ffffff']);
                });
            },
        },

        // ── 사이코 — 화면이 보랏빛으로 일렁(물결치는 줄 · 퍼지는 고리), 눈이 번쩍, 다른 포켓몬과 돌멩이가 공중에 떠올라 흔들흔들 → 한꺼번에 바닥으로 쾅 ──
        ultpsy: {
            ms: (P) => 3800 + 300 * P,
            run: (u, o, ms, pokemon) => {
                const K = 0.4 + 0.6 * u.P;
                const S = u.S;
                const cols = ultCols(o, 'ultpsy');
                const W = u.W;
                const H = u.H;
                const U = unit(u);
                const end = ms / 1000;
                const tLift = 0.5;
                const tSlam = 2.45 + 0.25 * K;
                const t0 = performance.now();
                const clock = () => (performance.now() - t0) / 1000;
                // 보랏빛 물듦 + 물결치는 가로줄 — 꼭두각시 · 효과 밑, 어둠 위로 (destination-over — 꼭두각시보다 먼저 만들어야 그 밑)
                sigParticle({ x: 0, y: 0, s: S, max: end, draw: safeDraw((ctx, p, t, px) => {
                    const T = p.life;
                    const a = Math.min(1, T / 0.35) * (T > end - 0.5 ? Math.max(0, (end - T) / 0.5) : 1);
                    if (a <= 0.01) {
                        return;
                    }
                    const slam = T > tSlam && T < tSlam + 0.3 ? 1 - (T - tSlam) / 0.3 : 0;
                    ctx.globalCompositeOperation = 'destination-over';
                    const n = Math.round(clamp(H / 16, 7, 18));
                    const step = S * 3;
                    for (let j = 0; j < n; j++) {
                        const y0 = ((j + 0.5) * H) / n + Math.sin(T * 1.3 + j * 1.7) * (H / n) * 0.25 + slam * H * 0.03 * (j % 2 ? 1 : -1);
                        const amp = (H / n) * (0.18 + 0.12 * Math.sin(T * 2 + j));
                        const th = j % 3 === 0 ? S : Math.max(1, S / 2);
                        ctx.globalAlpha = a * (j % 2 ? 0.32 : 0.2) * (1 + slam);
                        ctx.fillStyle = j % 3 === 0 ? cols[0] : cols[1];
                        const seg0 = (j * 37) % 5;
                        for (let x = 0, k = seg0; x < W; x += step, k++) {
                            if (k % 9 > 5) {
                                continue; // 사이사이 끊김
                            }
                            const y = y0 + Math.sin(x * 0.028 + T * (4 + (j % 3)) + j) * amp;
                            ctx.fillRect(Math.round(x), px(y), step, th);
                        }
                    }
                    ctx.globalAlpha = a * (0.22 + 0.06 * Math.sin(T * 5) + 0.25 * slam);
                    ctx.fillStyle = cols[3];
                    ctx.fillRect(0, 0, W, H);
                }) });
                const pp = makePuppet(u, pokemon, ms);
                const { w, h } = pp;
                const cx = pp.x;
                const cy = pp.y - h * 0.5;
                pp.glow = [cols[1], cols[3]];
                pp.under = (ctx, px) => {
                    const T = clock();
                    const k = T < 0.4 ? smooth(T / 0.4) : T < tSlam + 0.3 ? 1 : Math.max(0, 1 - (T - tSlam - 0.3) / 0.6);
                    drawAura(ctx, px, S, pp.x, pp.y, Math.max(w, U * 0.7), Math.max(h, U * 0.9), cols, T, k * 0.9, 0);
                };
                // 눈 번쩍 (두 번)
                const ex = u.mouth.x - u.dir * 3 * u.s;
                const ey = clamp(u.mouth.y - 3 * u.s, u.body.top + u.s, u.body.bottom);
                pp.over = (ctx, px) => {
                    const T = clock();
                    for (const [t1, big] of [[0.05, 0.8], [tLift - 0.15, 1.1], [tSlam - 0.35, 1.4]]) {
                        const k = (T - t1) / 0.4;
                        if (k > 0 && k < 1) {
                            const r = (S * 2 + U * 0.5 * K) * big * Math.sin(Math.PI * k);
                            ctx.globalAlpha = 1;
                            star4(ctx, px, S, ex, ey, r, '#ffffff', cols[1]);
                            ctx.globalAlpha = 0.6 * Math.sin(Math.PI * k);
                            dotLine(ctx, px, S, ex - r * 1.8, ey, ex + r * 1.8, ey, cols[0], 1);
                        }
                    }
                };
                sigParticle({ x: 0, y: 0, s: S, max: end + 0.3, update: safeUpd((p) => {
                    const T = clock();
                    pp.sy = 1 + 0.04 * Math.sin(T * 6);
                    pp.flash = Math.max(0, pp.flash - 0.05);
                    if (T >= end - 0.05) {
                        pp.finish();
                        p.life = p.max;
                    }
                }) });
                // 퍼지는 고리 — 맥박처럼
                for (let t = 0.1; t < tSlam; t += 0.32) {
                    later(t * 1000, () => sigRing(cx, cy, S, U * 0.5, Math.max(W, H) * 0.75, 0.6, 0.95, [cols[1], cols[2], '#ffffff']));
                }
                // 몸 둘레를 도는 고리
                sigParticle({ x: cx, y: cy, s: S, max: tSlam + 0.3, draw: safeDraw((ctx, p, t, px) => {
                    ctx.globalAlpha = 0.85 * fadeInOut(t, 0.1, 0.15);
                    for (let j = 0; j < 2; j++) {
                        ellipseDots(ctx, px, S, cx, cy, U * (0.75 + 0.3 * j), U * (0.26 + 0.1 * j), [cols[0], cols[2]], p.life * (j ? -3 : 4), 4);
                    }
                }) });
                // 다른 포켓몬 — 떠올라 흔들흔들, 쾅
                const lift = u.others();
                lift.forEach((q, i) => {
                    ultFreeze(q.pokemon, (tSlam + 0.6) * 1000);
                    const up = clamp(Math.min(H * 0.4, q.h * 1.6 + 16), 10, Math.max(10, q.bottom - q.h - 6));
                    levitate(q, (tLift + i * 0.08) * 1000, tSlam * 1000, up);
                });
                // 떠 있는 동안 — 보랏빛 테두리 · 묶는 고리
                sigParticle({ x: 0, y: 0, s: S, max: tSlam + 0.35, draw: safeDraw((ctx, p, t, px) => {
                    const T = clock();
                    if (T < tLift) {
                        return;
                    }
                    for (const q of lift) {
                        const r = q.pokemon.el.getBoundingClientRect();
                        drawLit(ctx, q.pokemon, pp.d, cols, Math.min(1, (T - tLift) / 0.25));
                        ctx.globalAlpha = 0.85;
                        ellipseDots(ctx, px, S, r.left + r.width / 2, r.top + r.height * 0.55, r.width * 0.75, r.height * 0.18, [cols[0], cols[2]], T * 5, 3);
                        ellipseDots(ctx, px, S, r.left + r.width / 2, r.top + r.height * 0.3, r.width * 0.55, r.height * 0.13, [cols[1], '#ffffff'], -T * 4, 3);
                    }
                }) });
                emit(tSlam * 1000, 30 + 10 * lift.length, () => {
                    if (!roomFor() || clock() < tLift) {
                        return;
                    }
                    const q = lift.length ? movePick(lift) : null;
                    const r = q ? q.pokemon.el.getBoundingClientRect() : { left: moveRand(0, W), top: moveRand(0, H), width: 0, height: 0 };
                    sigParticle({ x: r.left + moveRand(0, r.width), y: r.top + moveRand(0, r.height), s: S, vy: -moveRand(10, 30), max: moveRand(0.4, 0.7), cols, draw: DRAW.sparkle });
                });
                // 떠오르는 돌멩이 — 쾅 때 같이 떨어짐
                const nRocks = 6 + Math.round(5 * K);
                const rs = Math.max(S, Math.round(U / 30));
                const rmap = { o: cols[1], '#': ROCK[2], w: ROCK[0] };
                for (let i = 0; i < nRocks; i++) {
                    const x = moveRand(0.05, 0.95) * W;
                    const top = Math.max(H * 0.12, u.ground - moveRand(0.25, 0.6) * Math.min(H * 0.8, 260));
                    const t1 = tLift + moveRand(0, 0.5);
                    const shape = movePick(ROCKS);
                    const rh = shape.length * rs;
                    sigParticle({ x, y: u.ground, s: S, max: end, vis: false, done: false, ph: moveRand(0, TAU),
                        update: safeUpd((p) => {
                            const T = clock();
                            p.vis = T >= t1 && T < tSlam + 0.4;
                            if (T < t1) {
                                return;
                            }
                            if (T < t1 + 0.6) {
                                p.y = lerp(u.ground - rh, top, easeOut((T - t1) / 0.6));
                            } else if (T < tSlam - 0.12) {
                                p.y = top + Math.sin(T * 3 + p.ph) * S * 1.5;
                                p.x = x + Math.sin(T * 2.3 + p.ph) * S;
                            } else if (T < tSlam) {
                                p.y = lerp(top, u.ground - rh, easeIn((T - tSlam + 0.12) / 0.12));
                            } else if (!p.done) {
                                p.done = true;
                                p.y = u.ground - rh;
                                dust(p.x, u.ground, S, 3, 40);
                                debris(p.x, u.ground - S, S, ROCK, 4, 160, u.ground);
                            }
                        }),
                        draw: (ctx, p) => {
                            if (!p.vis) {
                                return;
                            }
                            ctx.globalAlpha = 1;
                            const px2 = (v) => Math.round(v / rs) * rs;
                            glyph(ctx, px2, rs, p.x, p.y, shape, rmap, false);
                        },
                    });
                }
                // 쾅 — 한꺼번에 내리꽂힘
                later(tSlam * 1000, () => {
                    screenFlash(S, 0.5, cols[0], 0.28);
                    ultShake(5 + 3 * K, 750);
                    pp.flash = 0.8;
                    groundWave(cx, u.ground - S, S, cols, W * 0.9, 0.8);
                    for (const q of lift) {
                        const r = q.pokemon.collision.getBoundingClientRect();
                        const x = r.left + r.width / 2;
                        // 위에서 내리누르는 힘 — 빛 기둥이 쾅
                        sigParticle({ x, y: r.bottom, s: S, max: 0.3, hw: Math.max(r.width, U * 0.5) * 0.45, draw: (ctx, q2, t, px) => {
                            const hw = q2.hw * (1 - t * 0.7);
                            ctx.globalAlpha = 0.7 * (1 - t);
                            ctx.fillStyle = cols[1];
                            ctx.fillRect(px(q2.x - hw), 0, Math.max(S, px(2 * hw)), q2.y);
                            ctx.fillStyle = '#ffffff';
                            ctx.fillRect(px(q2.x - hw * 0.3), 0, Math.max(S, px(0.6 * hw)), q2.y);
                        } });
                        hitStar(x, r.bottom - S * 2, S, ['#ffffff', cols[1], cols[2]], U * 0.7);
                        sigRing(x, r.bottom - S, S, 4, U * 1.2, 0.25, 0.45, [cols[0], '#ffffff', cols[2]]);
                        dust(x, r.bottom, S, 10, 80, 0, 1.4);
                        debris(x, r.bottom - S, S, [...ROCK, cols[1]], 12, 240, r.bottom);
                        cracks(x, r.bottom - S, S, cols, 4, U * 0.9, (i) => (i % 2 ? Math.PI : 0) + moveRand(-0.3, 0.3), 0.25, 0.9);
                    }
                    if (!lift.length) {
                        bigBoom(cx + u.dir * W * 0.25, u.ground - S * 2, S, ['#ffffff', ...cols.slice(0, 3)], U * (1 + 0.5 * K), { flat: 0.5 });
                    }
                });
                later((tSlam + 0.3) * 1000, () => lift.forEach((q) => ultHit(q, Math.sign(q.x - cx) || u.dir, 'tumble')));
            },
        },

        // ── 그림자 — 화면이 새까매지고 하늘에 거대한 눈이 뜨고, 바닥 그림자 웅덩이에서 손이 솟아 다른 포켓몬을 붙잡아 흔듦 → 검은 폭발로 내동댕이 ──
        ultshadow: {
            ms: (P) => 3900 + 200 * P,
            run: (u, o, ms, pokemon) => {
                const K = 0.4 + 0.6 * u.P;
                const S = u.S;
                const cols = ultCols(o, 'ultshadow');
                const W = u.W;
                const H = u.H;
                const U = unit(u);
                const end = ms / 1000;
                const tEyes = 0.3;
                const tPool = 0.5;
                const tHands = 0.9;
                const tGrip = 1.35;
                const tFling = 2.85 + 0.15 * K;
                const t0 = performance.now();
                const clock = () => (performance.now() - t0) / 1000;
                ultDark(0.82, (tFling + 0.3) * 1000);
                const pp = makePuppet(u, pokemon, ms);
                const { w, h } = pp;
                const xs = pp.x;
                pp.glow = [cols[1], cols[3]];
                pp.under = (ctx, px) => {
                    const T = clock();
                    const k = T < 0.4 ? smooth(T / 0.4) : T < tFling ? 1 : Math.max(0, 1 - (T - tFling) / 0.7);
                    drawAura(ctx, px, S, pp.x, pp.y, Math.max(w, U * 0.7), Math.max(h, U * 0.9), [cols[1], cols[2], cols[3], '#0a0412'], T, k * 0.9, 0);
                };
                // 빛나는 눈 — 쓰는 애
                const ex = u.mouth.x - u.dir * 3 * u.s;
                const ey = clamp(u.mouth.y - 3 * u.s, u.body.top + u.s, u.body.bottom);
                pp.over = (ctx, px) => {
                    const T = clock();
                    if (T < 0.1 || T > tFling + 0.5) {
                        return;
                    }
                    const k = Math.min(1, (T - 0.1) / 0.2);
                    const flare = T < 0.5 ? Math.sin(Math.PI * clamp((T - 0.1) / 0.4, 0, 1)) : 0;
                    for (const dx of [0, -u.dir * 3 * Math.max(1, u.s)]) {
                        ctx.globalAlpha = k;
                        dotAt(ctx, px, S, ex + dx - S / 2, ey - S / 2, '#ff3b5c');
                        dotAt(ctx, px, S, ex + dx - S / 2, ey - S / 2 - S, '#ffffff');
                        if (flare > 0) {
                            ctx.globalAlpha = flare;
                            dotLine(ctx, px, S, ex + dx - U * 0.9 * flare, ey, ex + dx + U * 0.9 * flare, ey, '#ff8aa0', 1);
                            star4(ctx, px, S, ex + dx, ey, S * 2 + U * 0.3 * flare, '#ffffff', '#ff3b5c');
                        }
                    }
                };
                sigParticle({ x: 0, y: 0, s: S, max: end + 0.3, update: safeUpd((p) => {
                    const T = clock();
                    pp.flash = Math.max(0, pp.flash - 0.05);
                    if (T >= end - 0.05) {
                        pp.finish();
                        p.life = p.max;
                    }
                }) });
                // 하늘에 거대한 눈 — 떴다가 한 번 깜빡, 폭발 때 사라짐
                sigParticle({ x: 0, y: 0, s: S, max: tFling + 0.6, draw: safeDraw((ctx, p, t, px) => {
                    const T = clock();
                    if (T < tEyes) {
                        return;
                    }
                    let open = smooth((T - tEyes) / 0.3);
                    const blink = T - (tHands + 0.05);
                    if (blink > 0 && blink < 0.16) {
                        open *= Math.abs(blink - 0.08) / 0.08;
                    }
                    const fade = T > tFling ? Math.max(0, 1 - (T - tFling) / 0.5) : 1;
                    const eyeW = clamp(W * 0.14, 26, 90);
                    const eyeH = eyeW * 0.42;
                    const ey2 = Math.max(eyeH, H * 0.2);
                    const look = Math.sin(T * 1.3) * eyeW * 0.12;
                    for (const sgn of [-1, 1]) {
                        const exc = W / 2 + sgn * eyeW * 0.85;
                        for (let yy = -eyeH / 2; yy <= eyeH / 2; yy += S) {
                            const f = yy / (eyeH / 2);
                            if (Math.abs(f) > open) {
                                continue;
                            }
                            const hw = (eyeW / 2) * Math.sqrt(Math.max(0, 1 - f * f));
                            const slant = -sgn * yy * 0.6; // 안쪽 아래로 — 성난 눈
                            const x0 = exc - hw + slant;
                            ctx.globalAlpha = 0.5 * fade;
                            ctx.fillStyle = cols[2];
                            ctx.fillRect(px(x0 - S), px(ey2 + yy), Math.max(S, px(2 * hw + 2 * S)), S);
                            ctx.globalAlpha = 0.95 * fade;
                            ctx.fillStyle = Math.abs(f) < 0.35 ? cols[0] : cols[1];
                            ctx.fillRect(px(x0), px(ey2 + yy), Math.max(S, px(2 * hw)), S);
                            // 세로로 갈라진 눈동자 — 두리번
                            ctx.fillStyle = '#12061f';
                            ctx.fillRect(px(exc + slant + look - S), px(ey2 + yy), S * 2, S);
                        }
                    }
                }) });
                // 붙잡을 애들 (없으면 앞쪽 허공)
                const victims = u.others();
                const fx = clamp(xs + u.dir * W * 0.28, 20, W - 20);
                // 손은 쓰는 애 반대쪽 뒤에서 올라옴
                const grabs = victims.length ? victims.map((q) => ({ q, sd: Math.sign(q.x - xs) || u.dir })) : [{ q: null, sd: u.dir }];
                victims.forEach((q) => ultFreeze(q.pokemon, (tFling + 0.2) * 1000));
                const boxOf = (g) => {
                    if (!g.q) {
                        return { x: fx, y: u.ground - Math.max(h, 24) * 0.6, w: Math.max(w, 24), h: Math.max(h, 24), lit: false };
                    }
                    const el = g.q.pokemon.el;
                    const r = el.getBoundingClientRect();
                    const rotated = Math.abs(r.width - el.offsetWidth) > 2;
                    return rotated ? { x: g.q.x, y: g.q.y, w: g.q.w, h: g.q.h, lit: false } : { x: r.left + r.width / 2, y: r.top + r.height / 2, w: g.q.w, h: g.q.h, lit: true };
                };
                // 웅덩이 · 손 · 붙잡힌 애 (어둠 위로)
                sigParticle({ x: 0, y: 0, s: S, max: tFling + 0.05, draw: safeDraw((ctx, p, t, px) => {
                    const T = clock();
                    if (T < tPool) {
                        return;
                    }
                    const kPool = smooth((T - tPool) / 0.5);
                    const kRise = T < tHands ? 0 : easeBack((T - tHands) / 0.4);
                    const grip = smooth((T - tGrip) / 0.15);
                    for (const g of grabs) {
                        const b = boxOf(g);
                        const size = Math.max(b.h * 1.2, U * 0.6);
                        const gy = u.ground;
                        // 웅덩이 — 일렁이는 테두리
                        const rx = Math.max(b.w * 1.1, size * 0.9) * kPool;
                        const ry = Math.max(S * 2, rx * 0.2);
                        ctx.globalAlpha = 0.95;
                        fillEllipse(ctx, px, S, b.x, gy - S, rx + S * 2, ry + S, cols[2]);
                        fillEllipse(ctx, px, S, b.x, gy - S, rx, ry, '#0d0618');
                        ctx.globalAlpha = 0.8;
                        ellipseDots(ctx, px, S, b.x, gy - S, rx + S, ry + S * 0.5, [cols[1], cols[0]], T * 3, 4);
                        // 가시 · 팔 · 손바닥 (몸 뒤)
                        if (kRise > 0) {
                            for (const [f, l] of [[-1, 0.5], [-0.55, 0.8], [0.6, 0.65], [1, 0.45]]) {
                                claw(ctx, px, S, b.x + f * rx * 0.9, gy - S, size * l * Math.min(1, kRise), -f * 1.2, T, cols);
                            }
                            handPart(ctx, px, S, b, g.sd, gy, kRise, grip, T, cols, size, 'arm');
                        }
                        // 붙잡힌 애 — 어둠 위로 보이게
                        if (g.q && b.lit) {
                            drawLit(ctx, g.q.pokemon, pp.d, cols, Math.min(1, (T - tPool) / 0.3));
                        }
                        // 손가락 (몸 앞)
                        if (kRise > 0) {
                            handPart(ctx, px, S, b, g.sd, gy, kRise, grip, T, cols, size, 'fingers');
                        }
                    }
                }) });
                // 도깨비불 — 빙글빙글 감도는 혼
                const wisps = [];
                const addWisps = (center, r, n) => {
                    for (let i = 0; i < n; i++) {
                        wisps.push({ center, r: r * moveRand(0.7, 1.25), a: moveRand(0, TAU), sp: movePick([-1, 1]) * moveRand(2.5, 4.5), bob: moveRand(0, TAU), tr: [], out: 0 });
                    }
                };
                addWisps(() => [pp.x, pp.y - h * 0.5], U * 0.8, 4 + Math.round(3 * K));
                grabs.forEach((g) => addWisps(() => {
                    const b = boxOf(g);
                    return [b.x, b.y];
                }, Math.max(U * 0.7, (g.q?.w ?? w) * 0.9), 4 + Math.round(2 * K)));
                sigParticle({ x: 0, y: 0, s: S, max: end - 0.1,
                    update: safeUpd((p, dt) => {
                        const T = clock();
                        for (const ws of wisps) {
                            const [wcx, wcy] = ws.center();
                            ws.a += ws.sp * dt;
                            if (T > tFling) {
                                ws.out += dt * 260;
                            }
                            const r = ws.r + ws.out;
                            ws.tr.unshift([wcx + Math.cos(ws.a) * r, wcy + Math.sin(ws.a) * r * 0.45 + Math.sin(T * 3 + ws.bob) * S * 2 - ws.out * 0.3]);
                            if (ws.tr.length > 8) {
                                ws.tr.length = 8;
                            }
                        }
                    }),
                    draw: safeDraw((ctx, p, t, px) => {
                        const T = clock();
                        const a0 = Math.min(1, (T - 0.2) / 0.4) * (T > tFling ? Math.max(0, 1 - (T - tFling) / 0.8) : 1);
                        if (a0 <= 0) {
                            return;
                        }
                        for (const ws of wisps) {
                            ws.tr.forEach(([x, y], i) => {
                                ctx.globalAlpha = a0 * (1 - i / 8) * 0.85;
                                dotAt(ctx, px, S, x, y, i < 2 ? cols[1] : i < 5 ? cols[2] : cols[3], i < 3 ? 2 : 1, i < 3 ? 2 : 1);
                            });
                            const [x, y] = ws.tr[0] || [0, 0];
                            ctx.globalAlpha = a0;
                            dotAt(ctx, px, S, x - S / 2, y - S / 2, cols[0], 1, 1);
                            dotAt(ctx, px, S, x - S / 2, y - S * 1.5, cols[1], 1, 1);
                        }
                    }),
                });
                // 바닥에서 올라오는 그림자 기운
                emit(tFling * 1000, 40 + 20 * K, () => roomFor() && sigParticle({ x: moveRand(0, W), y: u.ground, s: S, vy: -moveRand(20, 70), max: moveRand(0.6, 1.1), color: movePick([cols[2], cols[3], cols[1]]), size: movePick([1, 1, 2]), draw: (ctx, q, t, px) => {
                    ctx.globalAlpha = fadeInOut(t, 0.15, 0.4) * 0.8;
                    dotAt(ctx, px, q.s, q.x + Math.sin(q.life * 6) * q.s, q.y, q.color, q.size, q.size * 2);
                } }));
                // 붙잡고 흔들기
                later(tGrip * 1000, () => {
                    ultShake(1.5, 300);
                    grabs.forEach((g) => {
                        const b = boxOf(g);
                        sigBurst(b.x, b.y, S, [cols[0], cols[1], '#ffffff'], 10, 70);
                        if (!g.q) {
                            return;
                        }
                        ultHit(g.q, u.dir, 'shake');
                        const lift = Math.min(g.q.h * 0.3, 14);
                        const dur = (tFling - tGrip) * 1000;
                        const el = g.q.pokemon.el;
                        el.animate([{ translate: '0 0' }, { translate: `0 ${-lift}px`, offset: 0.25 }, { translate: `0 ${-lift}px`, offset: 0.92 }, { translate: '0 0' }], { duration: dur, composite: 'add' });
                        el.animate([{ translate: '-2px 0' }, { translate: '2px -1px' }], { duration: 55, iterations: Math.max(2, Math.round(dur / 55)), direction: 'alternate', composite: 'add' });
                    });
                });
                // 검은 폭발 — 내동댕이
                later(tFling * 1000, () => {
                    screenFlash(S, 0.42, cols[1], 0.24);
                    later(70, () => screenFlash(S, 0.3, '#ffffff', 0.16));
                    ultShake(5 + 4 * K, 850);
                    pp.flash = 0.7;
                    grabs.forEach((g) => {
                        const b = boxOf(g);
                        darkBurst(b.x, b.y, S, cols, Math.max(b.w, b.h, U * 0.6) * (1.3 + 0.6 * K));
                        for (const sd of [-1, 1]) {
                            for (let i = 0; i < 12 && roomFor(); i++) {
                                sigParticle({ x: b.x + sd * b.w * 0.5, y: lerp(u.ground, b.y, Math.random()), s: S, vx: sd * moveRand(30, 160), vy: -moveRand(20, 180), g: 120, drag: 1.5, max: moveRand(0.5, 0.9), color: movePick(['#0d0618', cols[2], cols[1]]), size: movePick([1, 2, 2]), draw: DRAW.dot });
                            }
                        }
                        if (g.q) {
                            ultHit(g.q, Math.sign(g.q.x - xs) || u.dir, 'tumble');
                        }
                    });
                });
            },
        },
    });

    // ── 부품 ──
    // 주먹 자국 — 주먹 그림 + 궤적 (gs: 그림 칸 크기)
    function fistHit(x, y, S, cols, side, gs) {
        const map = { o: '#2a1206', '#': cols[2], w: '#ffffff' };
        const big = gs > S * 2;
        sigParticle({ x, y, s: S, max: big ? 0.35 : 0.12, draw: safeDraw((ctx, p, t) => {
            ctx.globalAlpha = t > 0.6 ? (1 - t) / 0.4 : 1;
            const px2 = (v) => Math.round(v / gs) * gs;
            glyph(ctx, px2, gs, p.x - 3.5 * gs - side * gs * 2 * (1 - t), p.y - 3.5 * gs, FIST, map, side < 0);
        }) });
        sigParticle({ x, y, s: S, max: 0.09, draw: (ctx, p, t, px) => {
            ctx.globalAlpha = 0.8 * (1 - t);
            for (let j = -1; j <= 1; j++) {
                dotLine(ctx, px, S, p.x - side * gs * 9, p.y + j * gs * 2, p.x - side * gs * 4, p.y + j * gs * 2, j ? cols[1] : '#ffffff', 1);
            }
        } });
    }
    // 베기 자국 — 빠르게 그어지고 남았다 사라짐 (가운데 굵게)
    function slashMark(x, y, S, cols, len, ang, sec = 0.3, w = 1) {
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        sigParticle({ x, y, s: S, max: sec, draw: safeDraw((ctx, p, t, px) => {
            const grow = Math.min(1, p.life / 0.05);
            ctx.globalAlpha = t > 0.4 ? (1 - t) / 0.6 : 1;
            for (let d = -len / 2; d < -len / 2 + len * grow; d += S) {
                const thick = Math.sin((Math.PI * (d + len / 2)) / len) * (w + 0.6);
                const x1 = p.x + ca * d;
                const y1 = p.y + sa * d;
                if (thick > 0.4) {
                    dotAt(ctx, px, S, x1 - sa * S, y1 + ca * S, cols[2]);
                    dotAt(ctx, px, S, x1 + sa * S, y1 - ca * S, cols[1]);
                }
                if (thick > 1.2) {
                    dotAt(ctx, px, S, x1 - sa * S * 2, y1 + ca * S * 2, cols[3]);
                    dotAt(ctx, px, S, x1 + sa * S * 2, y1 - ca * S * 2, cols[2]);
                }
                dotAt(ctx, px, S, x1, y1, '#ffffff');
            }
        }) });
        sigBurst(x + (ca * len) / 2, y + (sa * len) / 2, S, ['#ffffff', cols[1]], 3, 60);
    }
    // 발차기 — 휙 쓸고 지나가는 초승달 호 + 발 그림 (gs: 그림 칸 크기)
    function kickArc(x, y, S, cols, r, side, up, gs) {
        const a0 = up ? 1.6 : -1.6;
        const a1 = up ? -0.4 : 0.4;
        const big = gs > S * 2;
        sigParticle({ x, y, s: S, max: big ? 0.4 : 0.22, draw: safeDraw((ctx, p, t, px) => {
            const sweep = Math.min(1, p.life / 0.06);
            ctx.globalAlpha = t > 0.4 ? (1 - t) / 0.6 : 1;
            const cx = p.x - side * r;
            const steps = Math.max(8, Math.round((r * 2) / S));
            const thick = big ? 4 : 2;
            for (let j = 0; j <= steps * sweep; j++) {
                const a = a0 + ((a1 - a0) * j) / steps;
                const lead = j > steps * sweep - 3;
                for (let k = 0; k < thick; k++) {
                    const rr = r - k * S;
                    dotAt(ctx, px, S, cx + side * Math.cos(a) * rr, p.y - Math.sin(a) * rr, lead ? '#ffffff' : k ? cols[2] : cols[1]);
                }
            }
        }) });
        const map = { o: '#2a1206', '#': cols[2], w: '#ffffff' };
        sigParticle({ x, y, s: S, max: big ? 0.35 : 0.11, draw: safeDraw((ctx, p, t) => {
            ctx.globalAlpha = 1 - t;
            const px2 = (v) => Math.round(v / gs) * gs;
            glyph(ctx, px2, gs, p.x - 3.5 * gs, p.y - 3.5 * gs, BOOT, map, side < 0);
        }) });
    }
    // 염력으로 띄웠다 쾅 — t1(ms) 부터 떠올라 흔들흔들 매달려 있다가 slam(ms) 에 바닥으로 (보이는 그림만 WAAPI translate — 끝나면 원래대로)
    function levitate(q, t1, slam, up) {
        const el = q.pokemon.el;
        const sr = slam - t1;
        const total = sr + 260;
        if (sr < 300) {
            return;
        }
        const rise = Math.min(650, sr * 0.4);
        const keys = [[0, 0, 0, 'ease-out'], [rise, 0, -up]];
        for (let tt = rise + 150, j = 0; tt < sr - 260; tt += 160, j++) {
            keys.push([tt, j % 2 ? 2 : -2, -up + (j % 2 ? 2 : -3)]);
        }
        keys.push([sr - 130, 0, -up * 1.06, 'ease-in']);
        keys.push([sr, 0, 0]);
        keys.push([sr + 80, 0, -Math.max(2, up * 0.08)]);
        keys.push([total, 0, 0]);
        const frames = keys.map(([tt, x, y, easing]) => ({ offset: clamp(tt / total, 0, 1), translate: `${x}px ${y}px`, ...(easing ? { easing } : {}) }));
        for (let i = 1; i < frames.length; i++) {
            frames[i].offset = Math.max(frames[i].offset, frames[i - 1].offset);
        }
        frames[0].offset = 0;
        frames[frames.length - 1].offset = 1;
        later(t1, () => el.animate(frames, { duration: total, composite: 'add' }));
    }
    // 그림자 손 — 웅덩이에서 솟은 팔이 몸 뒤로 올라와 손가락 셋이 몸 앞을 감싸 쥠 (엄지는 머리 위로).
    // part 'arm': 팔 · 손바닥 (몸 뒤), 'fingers': 손가락 (몸 앞). sd: 팔이 올라오는 쪽, grip 0~1
    function handPart(ctx, px, S, b, sd, gy, k, grip, T, cols, size, part) {
        const dark = '#0d0618';
        const rim = cols[1];
        const aw = Math.max(S, Math.round((size * 0.09) / S) * S); // 팔 반폭
        const bw = Math.max(b.w, S * 10);
        const bh = Math.max(b.h, S * 10);
        const cx = b.x + sd * bw * 0.3; // 손바닥 가운데 (몸 뒤 한쪽)
        const cy = lerp(gy + bh * 0.3, b.y, Math.min(1.1, k));
        const pw = Math.max(aw * 2.6, S * 5);
        const ph = Math.max(bh * 0.6, aw * 3);
        const bx = b.x + sd * (bw * 0.5 + size * 0.22); // 팔 밑동
        if (part === 'arm') {
            const top = cy + ph * 0.3;
            const len = gy - top;
            for (let y = gy; y > top; y -= S) {
                const f = (gy - y) / Math.max(1, len);
                const x = lerp(bx, cx, f * (2 - f)) + Math.sin(T * 7 + f * 5 + sd) * S * 0.8 * (1 - f);
                const hw = aw * (1.4 - 0.45 * f);
                ctx.globalAlpha = 1;
                ctx.fillStyle = rim;
                ctx.fillRect(px(x - hw - S), px(y - S), px(2 * hw + 2 * S), S);
                ctx.fillStyle = dark;
                ctx.fillRect(px(x - hw), px(y - S), px(2 * hw), S);
            }
            // 손바닥 — 모서리 깎은 세로 네모
            ctx.fillStyle = rim;
            ctx.fillRect(px(cx - pw / 2), px(cy - ph / 2 - S), px(pw), px(ph + 2 * S));
            ctx.fillRect(px(cx - pw / 2 - S), px(cy - ph / 2), px(pw + 2 * S), px(ph));
            ctx.fillStyle = dark;
            ctx.fillRect(px(cx - pw / 2), px(cy - ph / 2), px(pw), px(ph));
            return;
        }
        // 손가락 — 펼치면 위로, 쥐면 몸을 가로질러(-sd) 끝이 아래로 굽음. 테두리 → 속 → 발톱
        const finger = (x0, y0, a1, L1, a2, L2) => {
            const x1 = x0 + Math.cos(a1) * L1;
            const y1 = y0 + Math.sin(a1) * L1;
            const x2 = x1 + Math.cos(a2) * L2;
            const y2 = y1 + Math.sin(a2) * L2;
            dotLine(ctx, px, S, x0, y0, x1, y1, rim, 3);
            dotLine(ctx, px, S, x1, y1, x2, y2, rim, 3);
            dotLine(ctx, px, S, x0, y0, x1, y1, dark, 1);
            dotLine(ctx, px, S, x1, y1, x2, y2, dark, 1);
            dotAt(ctx, px, S, x2 + Math.cos(a2) * S - S / 2, y2 + Math.sin(a2) * S - S / 2, '#ffffff');
        };
        ctx.globalAlpha = 1;
        const x0 = cx - sd * pw * 0.45;
        for (let j = 0; j < 3; j++) {
            const y0 = cy - ph * 0.28 + j * ph * 0.26;
            const wig = Math.sin(T * 9 + j * 2) * 0.15 * (1 - grip);
            const a1 = -Math.PI / 2 - sd * ((Math.PI / 2) * grip + (0.25 - j * 0.2) * (1 - grip)) + wig;
            const a2 = a1 - sd * (0.3 + 0.7 * grip);
            finger(x0, y0, a1, bw * (j === 1 ? 0.62 : 0.55), a2, bw * 0.26);
        }
        // 엄지 — 머리 위로 넘어감
        finger(cx, cy - ph / 2, -Math.PI / 2 - sd * (0.25 + 0.55 * grip), bh * 0.3, -Math.PI / 2 - sd * (0.9 + 0.7 * grip), bw * 0.25);
    }
    // 웅덩이 둘레 그림자 가시 — 흔들리며 솟음
    function claw(ctx, px, S, x, gy, len, lean, T, cols) {
        let cx = x;
        let cy = gy;
        const n = Math.max(3, Math.round(len / S));
        for (let j = 0; j < n; j++) {
            const f = j / n;
            cx += (lean + Math.sin(T * 6 + x) * 0.5) * f * S * 0.6;
            cy -= S;
            const wd = f < 0.4 ? 2 : 1;
            ctx.globalAlpha = 1;
            dotAt(ctx, px, S, cx - S, cy, cols[1], wd + 2, 1);
            dotAt(ctx, px, S, cx, cy, j === n - 1 ? '#ffffff' : '#0d0618', wd, 1);
        }
    }
    // 검은 폭발 — 검은 원판이 커지며 보랏빛 테두리, 조각이 튐
    function darkBurst(x, y, S, cols, size) {
        sigParticle({ x, y, s: S, max: 0.5, draw: safeDraw((ctx, p, t, px) => {
            const r = size * easeOut(t * 2.2) * (1 - 0.3 * t);
            ctx.globalAlpha = 1 - t * t;
            sigDisc(ctx, px, S, p.x, p.y, r + S * 2, cols[1]);
            sigDisc(ctx, px, S, p.x, p.y, r, '#0a0412');
            sigDisc(ctx, px, S, p.x, p.y, r * 0.3 * (1 - t), cols[2]);
            ctx.globalAlpha = 1 - t;
            ellipseDots(ctx, px, S, p.x, p.y, r * 1.35, r * 1.35, [cols[0], cols[2]], p.life * 6, 3);
        }) });
        sigRing(x, y, S, 4, size * 2.2, 0.85, 0.55, [cols[1], cols[0], '#ffffff']);
        for (let i = 0; i < 20 && roomFor(); i++) {
            const a = moveRand(0, TAU);
            const sp = moveRand(90, 280);
            sigParticle({ x, y, s: S, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: 200, drag: 1.4, max: moveRand(0.4, 0.8), color: movePick(['#0a0412', '#1a0d2e', cols[1], cols[0]]), size: movePick([1, 2, 2]), draw: streak });
        }
    }
})();
