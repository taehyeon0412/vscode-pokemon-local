
// ───── 필살기 대결 모양 — 몸 · 날리기 · 파동: rush · swarm · wave (설계 · 약속은 ult/SPEC.md "필살기 대결") ─────
// rush  — 포켓몬이 직접: 진짜 그림을 숨기고(duelHide) 캔버스 꼭두각시로 돌진(ultrush) · 다이브(ultdive) · 연타(ultbarrage).
//         이기면 진 쪽을 들이받고 공중제비로 제자리에 내려앉은 뒤 진짜 그림을 다시 보임 (진 쪽 · 무승부는 엔진이 다시 보임)
// swarm — 날리기(ultswarm · ultsparkle twinkle)가 쉼 없이 날아가 앞머리에서 톡톡 터짐 / giant 면 거대한 것 하나가 앞머리에서 갈아 댐
// wave  — 사이코(ultpsy): 보랏빛 일렁임 · 굴러가는 물결 · 떠도는 돌멩이 / 그림자(ultshadow): 어둠 · 땅을 기는 촉수 · 앞머리의 그림자 벽
// 모으기 동안에도 그려야 하는 것(꼭두각시 · 둘레를 도는 것)은 쪽마다 장면 입자 하나(보통 층)로, 모양(draw)은 맨 밑 층. 땅(ground) 아래는 잘라 냄
(() => {
    const TAU = Math.PI * 2;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const lerp = (a, b, k) => a + (b - a) * k;
    const k01 = (v) => clamp(v, 0, 1);
    const easeOut = (k) => 1 - (1 - k01(k)) ** 3;
    const easeIn = (k) => k01(k) ** 2;
    const smooth = (k) => {
        k = k01(k);
        return k * k * (3 - 2 * k);
    };
    // 살짝 넘쳤다 돌아옴
    const easeBack = (k) => {
        k = k01(k) - 1;
        return 1 + 2.7 * k ** 3 + 1.7 * k ** 2;
    };
    // 번호로 정하는 가짜 난수 0~1 (입자 없이 그때그때 계산)
    const hash = (i, k = 0) => {
        const v = Math.sin(i * 127.1 + k * 311.7 + 7.13) * 43758.5453;
        return v - Math.floor(v);
    };
    const wrap = (v, span, off = 0) => ((((v - off) % span) + span) % span) + off;
    const rnd = moveRand;
    const pick = movePick;
    const fail = (e) => ultError('duel-body', e);
    // 입자 1500개 넘지 않게 — 꾸밈 입자는 여유 있을 때만 (엔진 · 상대 몫을 남김)
    const roomFor = (n = 1) => moveParticles.length + n < 1150;
    const other = (D, X) => (X === D.A ? D.B : D.A);
    const once = (st, key) => !st.flags.has(key) && !!st.flags.add(key);
    const DUST = ['#e8dcc0', '#d8c9a8', '#bfae8a', '#9c8c6c'];
    const ROCK = SIG_PALETTE.rock;
    const DARK = '#0d0618';
    let CUT = 1e9; // 땅 높이 — 이 아래로는 안 그림 (부를 때마다 D.ground 로)

    // 초당 rate 개 — 이번 프레임에 몇 개 (한 번에 너무 많이는 안 만듦)
    function acc(st, key, dt, rate) {
        const v = (st.acc[key] ?? 0) + dt * Math.max(0, rate);
        const n = Math.floor(v);
        st.acc[key] = v - n;
        return Math.min(n, 8);
    }
    // 땅 아래 잘라 내기
    function clipGround(ctx, y) {
        if (y < 1e8) {
            ctx.beginPath();
            ctx.rect(-4000, -4000, 12000, y + 4000);
            ctx.clip();
        }
    }
    // 입자 — update · draw 오류가 밖으로 안 새고, 그리기는 ctx 상태를 늘 되돌림 · 땅 아래는 잘림
    function part(p) {
        const { update, draw } = p;
        const cut = p.cut ?? CUT;
        if (update) {
            p.update = (q, dt) => {
                try {
                    update(q, dt);
                } catch (e) {
                    q.life = q.max;
                    fail(e);
                }
            };
        }
        if (draw) {
            p.draw = (ctx, q, t, px) => {
                ctx.save();
                try {
                    clipGround(ctx, cut);
                    draw(ctx, q, t, px);
                } catch (e) {
                    q.life = q.max;
                    fail(e);
                }
                ctx.restore();
            };
        }
        sigParticle(p);
    }
    // sec 초 뒤 한 번 (타이머 대신 입자 시간으로 — 화면이 멈추면 같이 멈춤)
    function delay(sec, fn) {
        sigParticle({ x: 0, y: 0, s: 1, max: sec + 0.12, done: false, update: (q) => {
            if (!q.done && q.life >= sec) {
                q.done = true;
                try {
                    fn();
                } catch (e) {
                    fail(e);
                }
            }
        } });
    }

    // ── 점 · 선 ──
    function dotLine(ctx, px, S, x0, y0, x1, y1, color, w = 1) {
        const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / S));
        ctx.fillStyle = color;
        const o = ((w - 1) * S) / 2;
        for (let j = 0; j <= n; j++) {
            ctx.fillRect(px(x0 + ((x1 - x0) * j) / n - o), px(y0 + ((y1 - y0) * j) / n - o), w * S, w * S);
        }
    }
    // 납작한 타원 고리 (도트)
    function ellipseDots(ctx, px, S, x, y, rx, ry, colsList, phase = 0, gap = 0, maxN = 400) {
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
    // 앞쪽(dir)으로 벌어진 타원 호 — span 은 위아래로 벌어진 각
    function arcDots(ctx, px, S, x, y, rx, ry, span, dir, cols, th = 1) {
        const n = clamp(Math.round(((rx + ry) * span) / (S * 1.3)), 6, 240);
        for (let j = 0; j <= n; j++) {
            const a = -span + (2 * span * j) / n;
            ctx.fillStyle = cols[j % cols.length];
            ctx.fillRect(px(x + dir * Math.cos(a) * rx - (dir > 0 ? (th - 1) * S : 0)), px(y + Math.sin(a) * ry), th * S, S);
        }
    }
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
    // 꼬리 남기는 점
    const streak = (ctx, p, t, px) => {
        const sz = p.size || 1;
        ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
        dotAt(ctx, px, p.s, p.x, p.y, p.color, sz, sz);
        ctx.globalAlpha *= 0.45;
        dotAt(ctx, px, p.s, p.x - p.vx * 0.03, p.y - p.vy * 0.03, p.color, sz, sz);
    };
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

    // ── 꼭두각시 — 진짜 그림을 숨기고 캔버스에 대신 그림 (fx-body 와 같은 방식) ──
    const leftSrc = (el) => (el.src || '').includes('_walk_left');
    const ready = (img) => !!img && (img instanceof HTMLCanvasElement ? img.width > 0 : img.complete && img.naturalWidth > 0);
    // 그림 — 발 가운데 (x, y) 기준으로 늘이고(sx, sy), 몸 가운데를 축으로 돌림
    function drawSprite(ctx, img, x, y, w, h, o = {}) {
        if (!ready(img) || w < 1 || h < 1) {
            return;
        }
        // 필살기를 멈춘 뒤 남은 꼭두각시는 안 그림 (진짜 그림이 돌아옴 — ult/bridge.js fxMonSkip)
        if (typeof fxMonSkip === 'function' && fxMonSkip(o.src ?? img)) {
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
        // 쓰러진 칸 지우기 뒤 다시 그릴 수 있게 적어 둠 (ult/bridge.js fxMonNote)
        if (typeof fxMonNote === 'function') {
            fxMonNote(ctx, o.src ?? img, img, w, h);
        }
        ctx.restore();
    }
    // 한 색 실루엣 (잔상 · 테두리 · 번쩍) — 움직이는 그림이라 0.08초마다 새로. 크기는 배율 1 로 만들고 그릴 때 늘림
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
    function drawOutline(ctx, img, x, y, bw, bh, w, h, color, d, o) {
        const sil = silhouette(img, bw, bh, color);
        for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) {
            drawSprite(ctx, sil, x + dx, y + dy, w, h, o);
        }
    }
    // 진짜 그림 숨기고 꼭두각시 준비 — 자리는 클릭 영역(흔들림 없음) 기준
    function makePuppet(X) {
        const r = X.p.collision.getBoundingClientRect();
        const bw = Math.max(4, Math.round(r.width || X.w));
        const bh = Math.max(4, Math.round(r.height || X.h));
        const x = r.width ? r.left + r.width / 2 : X.body.cx;
        const y = r.width ? r.bottom : X.body.bottom;
        const pp = { x, y, home: { x, y }, bw, bh, sc: 1, rot: 0, sx: 1, sy: 1, face: X.dir, show: true, alpha: 1, flash: 0, ghostN: 0, ghostCols: ['#ffffff'], glow: null, hist: [], under: null, over: null };
        X.st.pp = pp;
        X.st.hidden = true;
        duelHide(X, true);
        return pp;
    }
    // 꼭두각시를 그만 그리고 진짜 그림을 다시 보임 (엔진이 이미 보였으면 그대로)
    function release(X) {
        const st = X.st;
        if (st.pp) {
            st.pp.show = false;
        }
        if (st.hidden) {
            st.hidden = false;
            duelHide(X, false);
        }
    }
    function track(pp) {
        pp.hist.unshift({ x: pp.x, y: pp.y, rot: pp.rot, sx: pp.sx, sy: pp.sy, sc: pp.sc, face: pp.face, show: pp.show });
        if (pp.hist.length > 26) {
            pp.hist.length = 26;
        }
    }
    // 잔상 → 몸 뒤(under) → 빛 테두리 → 그림 → 번쩍 → 몸 앞(over)
    function drawPuppet(ctx, px, X, pp) {
        const el = X.p.el;
        if (!ready(el)) {
            return;
        }
        const { bw, bh } = pp;
        const w = bw * pp.sc;
        const h = bh * pp.sc;
        const flipOf = (face) => face < 0 !== leftSrc(el);
        for (let i = pp.ghostN; i >= 1; i--) {
            const g = pp.hist[i * 2];
            if (!g || !g.show) {
                continue;
            }
            ctx.globalAlpha = 0.6 * (1 - i / (pp.ghostN + 1)) * pp.alpha;
            drawSprite(ctx, silhouette(el, bw, bh, pp.ghostCols[i % pp.ghostCols.length]), g.x, g.y, bw * g.sc, bh * g.sc, { rot: g.rot, sx: g.sx, sy: g.sy, flip: flipOf(g.face) });
        }
        ctx.globalAlpha = 1;
        pp.under?.(ctx, px, w, h);
        const o = { rot: pp.rot, sx: pp.sx, sy: pp.sy, flip: flipOf(pp.face) };
        if (pp.glow) {
            const d = Math.max(1, Math.round((X.s || 1) * pp.sc));
            ctx.globalAlpha = 0.55 * pp.alpha;
            drawOutline(ctx, el, pp.x, pp.y, bw, bh, w, h, pp.glow[1], 2 * d, o);
            ctx.globalAlpha = 0.95 * pp.alpha;
            drawOutline(ctx, el, pp.x, pp.y, bw, bh, w, h, pp.glow[0], d, o);
        }
        ctx.globalAlpha = pp.alpha;
        drawSprite(ctx, el, pp.x, pp.y, w, h, { ...o, filter: X.o.tint || undefined });
        if (pp.flash > 0) {
            ctx.globalAlpha = Math.min(1, pp.flash) * pp.alpha;
            drawSprite(ctx, silhouette(el, bw, bh, '#ffffff'), pp.x, pp.y, w, h, o);
        }
        ctx.globalAlpha = 1;
        pp.over?.(ctx, px, w, h);
    }

    // ── 몸 둘레 · 꼬리 (fx-body) — 효과 밑으로 깔림 ──
    const UNDER = 'destination-over';
    // 몸을 감싸는 불꽃 오라 — 가로줄을 쌓은 물방울 모양이 위로 넘실. lean: 꼭대기가 쏠림
    function drawAura(ctx, px, S, cx, bottom, w, h, cols, T, k, lean = 0) {
        if (k <= 0.02) {
            return;
        }
        const H = h * (1.2 + 0.45 * Math.min(k, 1.4));
        const half0 = Math.max(w * (0.45 + 0.22 * Math.min(k, 1.4)), 8);
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
    // 가로 혜성 꼬리 — (cx, cy) 머리에서 dir 쪽으로 길게 가늘어짐
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

    // ── 터지는 것들 (fx-body) ──
    // 대폭발 충격 — 번쩍 원판 · 굵고 가는 빛살 · 고리 두 겹 · 튀는 빛 조각
    function bigBoom(x, y, S, cols, size, o = {}) {
        const flat = o.flat ?? 1;
        part({ x, y, s: S, max: 0.38, draw: (ctx, p, t, px) => {
            const r = size * (0.32 + 0.48 * easeOut(t * 2.5)) * (1 - 0.55 * t);
            ctx.globalAlpha = 1 - t;
            sigDisc(ctx, px, S, p.x, p.y, r, cols[2]);
            sigDisc(ctx, px, S, p.x, p.y, r * 0.72, cols[1]);
            sigDisc(ctx, px, S, p.x, p.y, r * 0.45, '#ffffff');
        } });
        const rays = [];
        const n = o.rays ?? 16;
        for (let i = 0; i < n; i++) {
            rays.push({ a: (i / n) * TAU + rnd(-0.12, 0.12), l: size * (i % 2 ? rnd(0.8, 1.15) : rnd(1.4, 2.1)), w: i % 2 ? 1 : 2 });
        }
        part({ x, y, s: S, max: 0.45, draw: (ctx, p, t, px) => {
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
        } });
        sigRing(x, y, S, size * 0.3, size * 1.7, flat, 0.4, [cols[0], '#ffffff', cols[1]]);
        delay(0.09, () => sigRing(x, y, S, size * 0.3, size * 2.4, flat * 0.8, 0.55, [cols[1], cols[2], '#ffffff']));
        const m = 22 + Math.round(size / 3);
        for (let i = 0; i < m && roomFor(); i++) {
            const a = rnd(0, TAU);
            const sp = rnd(90, 330) * Math.max(0.7, size / 70);
            sigParticle({ x, y, s: S, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * flat - 50, g: 340, drag: 1.5, max: rnd(0.45, 0.85), color: pick([...cols, '#ffffff']), size: pick([1, 1, 2, 2]), draw: streak });
        }
    }
    // 작은 쾅 — 8방향 빛살 + 가운데 번쩍
    function hitStar(x, y, S, cols, r) {
        part({ x, y, s: S, max: 0.17, rot: rnd(0, 0.8), draw: (ctx, p, t, px) => {
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
        } });
    }
    // 튀는 조각 — 땅에 한 번 튀고 구름
    function debris(x, y, S, cols, n, spd, ground, bias = 0) {
        for (let i = 0; i < n && roomFor(); i++) {
            const a = -Math.PI / 2 + rnd(-1.15, 1.15) + bias;
            const v = rnd(0.35, 1) * spd;
            sigParticle({ x, y: Math.min(y, ground - S), s: S, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 640, drag: 0.4, max: rnd(0.7, 1.2), color: pick(cols), size: pick([1, 2, 2, 3]), ground, hop: 0,
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
    // 먼지 뭉게 — 커지며 옅어짐 (땅 위로)
    function dust(x, y, S, n, spread, bias = 0, big = 1) {
        for (let i = 0; i < n && roomFor(); i++) {
            sigParticle({ x: x + rnd(-1, 1) * S * 3, y: y - S * 2 - rnd(0, 3) * S, s: S, vx: (rnd(-1, 1) + bias) * spread, vy: -rnd(8, 35), drag: 2.4, max: rnd(0.5, 0.9), r0: pick([1, 2, 2]) * big, grow: 3 * big, color: pick(DUST),
                draw: (ctx, p, t, px) => {
                    const r = Math.round(p.r0 + t * p.grow);
                    ctx.globalAlpha = 0.65 * (1 - t);
                    dotAt(ctx, px, p.s, p.x - (r * p.s) / 2, p.y - r * p.s, p.color, r, r);
                },
            });
        }
    }
    // 빛 금 — (x, y) 에서 갈라져 뻗는 빛나는 금
    function cracks(x, y, S, cols, n, len, angleAt, flat = 1, sec = 1.2) {
        const paths = [];
        for (let i = 0; i < n; i++) {
            let a = angleAt(i, n);
            let cx = x;
            let cy = y;
            const pts = [[cx, cy]];
            const L = len * rnd(0.55, 1.1);
            const seg = Math.max(3 * S, L / 7);
            for (let d = 0; d < L; d += seg) {
                a += rnd(-0.45, 0.45);
                cx += Math.cos(a) * seg;
                cy += Math.sin(a) * seg * flat;
                pts.push([cx, cy]);
            }
            paths.push(pts);
        }
        part({ x, y, s: S, max: sec, draw: (ctx, p, t, px) => {
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
        } });
    }
    // 땅을 따라 달리는 충격파 — 납작한 고리 + 양쪽 끝에 솟는 물마루
    function groundWave(x, y, S, cols, reach, sec = 0.7) {
        part({ x, y, s: S, max: sec, dusted: 0, update: (p) => {
            const t = p.life / p.max;
            const r = 4 * S + (reach - 4 * S) * easeOut(t * 1.15);
            if (p.life - p.dusted > 0.08 && t < 0.8) {
                p.dusted = p.life;
                for (const sgn of [-1, 1]) {
                    const cx = p.x + sgn * r;
                    if (cx > -10 && cx < window.innerWidth + 10) {
                        dust(cx, CUT, S, 1, 25, sgn * 0.5);
                    }
                }
            }
        }, draw: (ctx, p, t, px) => {
            const r = 4 * S + (reach - 4 * S) * easeOut(t * 1.15);
            ctx.globalAlpha = 1 - t;
            ellipseDots(ctx, px, S, p.x, p.y, r, Math.max(S * 2, r * 0.14), ['#ffffff', cols[0], cols[1]], 0, 0, 320);
            ellipseDots(ctx, px, S, p.x, p.y, r * 0.9, Math.max(S, r * 0.12), [cols[1], cols[2]], 0, 0, 200);
            const crest = Math.round(7 * (1 - t) + 2);
            for (const sgn of [-1, 1]) {
                const cx = p.x + sgn * r;
                for (let j = 0; j < crest; j++) {
                    dotAt(ctx, px, S, cx - S, p.y - (j + 1) * S, j > crest - 3 ? '#ffffff' : cols[j % 2 ? 1 : 2], 2, 1);
                }
            }
        } });
    }
    // 땅에 퍼지는 고리 (발밑)
    function groundRing(x, G, S, r1, cols, sec, flat = 0.28) {
        part({ x, y: G, s: S, max: sec, draw: (ctx, p, t, px) => {
            const r = 4 * S + (r1 - 4 * S) * easeOut(t);
            const ry = Math.max(S, r * flat);
            ctx.globalAlpha = 1 - t;
            ellipseDots(ctx, px, S, p.x, G - S - ry * 0.6, r, ry, cols, 0, 0, 300);
        } });
    }
    // 움푹 팬 자리 — 어두운 타원 + 빛나는 테두리
    function crater(x, y, S, cols, rx, sec) {
        part({ x, y, s: S, max: sec, draw: (ctx, p, t, px) => {
            const R = rx * easeOut(Math.min(1, p.life / 0.12));
            const ry = Math.max(S * 2, R * 0.2);
            ctx.globalAlpha = t > 0.6 ? (1 - t) / 0.4 : 1;
            fillEllipse(ctx, px, S, p.x, p.y, R + S * 2, ry + S, cols[2]);
            fillEllipse(ctx, px, S, p.x, p.y, R, ry, '#140b06');
            ctx.globalAlpha *= 0.7 + 0.3 * Math.sin(p.life * 20);
            ellipseDots(ctx, px, S, p.x, p.y, R + S, ry + S * 0.5, [cols[0], '#ffffff', cols[1]], p.life * 2, 3);
        } });
    }
    // 짧은 번개 — 0.05초마다 모양을 새로 (지직)
    function zap(x0, y0, x1, y1, S, tint, sec = 0.12, w = 1, jit = 2) {
        part({ x: x0, y: y0, s: S, max: sec, at: -1, draw: (ctx, p, t, px) => {
            if (!p.path || p.life - p.at > 0.05) {
                p.at = p.life;
                p.path = zigzag(x0, y0, x1, y1, S, jit);
            }
            ctx.globalAlpha = t > 0.6 ? (1 - t) / 0.4 : 1;
            zapLine(ctx, px, S, p.path, w, tint);
        } });
    }
    // 불길 폭발
    function fireBlast(x, y, S, size, n) {
        const fc = SIG_PALETTE.fire;
        for (let i = 0; i < n && roomFor(); i++) {
            const a = rnd(0, TAU);
            const sp = rnd(40, 210) * Math.max(0.7, size / 70);
            sigParticle({ x, y, s: S, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: -60, drag: 2.3, max: rnd(0.45, 0.85), cols: fc, grow: 3 + size / 30, smoke: 1, draw: DRAW.stream });
        }
        for (let i = 0; i < n / 2 && roomFor(); i++) {
            const a = rnd(0, TAU);
            const sp = rnd(100, 320);
            sigParticle({ x, y, s: S, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, g: 300, drag: 1, max: rnd(0.5, 0.9), color: pick(['#fff6b3', '#ffc93c', '#ff7a21']), draw: streak });
        }
    }
    // 물보라 — 땅에 닿으면 사라짐
    function splashUp(x, y, S, n, bias, ground, spd = 1) {
        const wc = SIG_PALETTE.water;
        for (let i = 0; i < n && roomFor(); i++) {
            sigParticle({ x: x + rnd(-1, 1) * S * 3, y, s: S, vx: (rnd(-1, 1) * 0.8 + bias) * 170 * spd, vy: -rnd(120, 380) * spd, g: 720, drag: 0.3, max: rnd(0.6, 1.1), color: pick(wc), size: pick([1, 2, 2, 3]), ground,
                update: (p) => {
                    if (p.vy > 0 && p.y > p.ground - p.s) {
                        p.life = p.max;
                    }
                },
                draw: streak,
            });
        }
    }
    // 빨려 드는 기 — 바깥에서 (cx(), cy()) 로 모이는 짧은 줄
    function pullIn(cx, cy, r, S, cols) {
        const a = rnd(0, TAU);
        const rr = r * rnd(1, 1.9);
        const x0 = cx() + Math.cos(a) * rr;
        const y0 = cy() + Math.sin(a) * rr * 0.8;
        sigParticle({ x: x0, y: y0, x0, y0, s: S, max: rnd(0.22, 0.32), color: pick([...cols, '#ffffff']),
            update: (q) => {
                const f = Math.min(1, (q.life / q.max) ** 2);
                q.x = q.x0 + (cx() - q.x0) * f;
                q.y = q.y0 + (cy() - q.y0) * f;
            },
            draw: (ctx, q, t, px) => {
                ctx.globalAlpha = Math.min(1, t * 4);
                dotLine(ctx, px, q.s, q.x, q.y, q.x + (q.x0 - q.x) * 0.18, q.y + (q.y0 - q.y) * 0.18, q.color, 1);
            },
        });
    }
    // 휙 지나가는 가로 줄 (속도선 조각)
    function speedBit(x, y, S, dir, cols, v = 120) {
        sigParticle({ x, y, s: S, vx: -dir * rnd(v * 0.5, v), max: 0.25, len: Math.round(rnd(4, 10)), dir, color: pick(cols),
            draw: (ctx, q, t, px) => {
                ctx.globalAlpha = 1 - t;
                dotAt(ctx, px, q.s, q.dir > 0 ? q.x - q.len * q.s : q.x, q.y, q.color, q.len, 1);
            } });
    }
    // 주먹 자국 — 주먹 그림 + 궤적 (gs: 그림 칸 크기)
    function fistHit(x, y, S, cols, side, gs) {
        const map = { o: '#2a1206', '#': cols[2], w: '#ffffff' };
        const big = gs > S * 2;
        part({ x, y, s: S, max: big ? 0.35 : 0.12, draw: (ctx, p, t) => {
            ctx.globalAlpha = t > 0.6 ? (1 - t) / 0.4 : 1;
            const px2 = (v) => Math.round(v / gs) * gs;
            glyph(ctx, px2, gs, p.x - 3.5 * gs - side * gs * 2 * (1 - t), p.y - 3.5 * gs, FIST, map, side < 0);
        } });
        part({ x, y, s: S, max: 0.09, draw: (ctx, p, t, px) => {
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
        part({ x, y, s: S, max: sec, draw: (ctx, p, t, px) => {
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
        } });
    }
    // 발차기 — 휙 쓸고 지나가는 초승달 호 + 발 그림
    function kickArc(x, y, S, cols, r, side, up, gs) {
        const a0 = up ? 1.6 : -1.6;
        const a1 = up ? -0.4 : 0.4;
        const big = gs > S * 2;
        part({ x, y, s: S, max: big ? 0.4 : 0.22, draw: (ctx, p, t, px) => {
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
        } });
        const map = { o: '#2a1206', '#': cols[2], w: '#ffffff' };
        part({ x, y, s: S, max: big ? 0.35 : 0.11, draw: (ctx, p, t) => {
            ctx.globalAlpha = 1 - t;
            const px2 = (v) => Math.round(v / gs) * gs;
            glyph(ctx, px2, gs, p.x - 3.5 * gs, p.y - 3.5 * gs, BOOT, map, side < 0);
        } });
    }
    // 검은 폭발 — 검은 원판이 커지며 보랏빛 테두리, 조각이 튐
    function darkBurst(x, y, S, cols, size) {
        part({ x, y, s: S, max: 0.5, draw: (ctx, p, t, px) => {
            const r = size * easeOut(t * 2.2) * (1 - 0.3 * t);
            ctx.globalAlpha = 1 - t * t;
            sigDisc(ctx, px, S, p.x, p.y, r + S * 2, cols[1]);
            sigDisc(ctx, px, S, p.x, p.y, r, '#0a0412');
            sigDisc(ctx, px, S, p.x, p.y, r * 0.3 * (1 - t), cols[2]);
            ctx.globalAlpha = 1 - t;
            ellipseDots(ctx, px, S, p.x, p.y, r * 1.35, r * 1.35, [cols[0], cols[2]], p.life * 6, 3);
        } });
        sigRing(x, y, S, 4, size * 2.2, 0.85, 0.55, [cols[1], cols[0], '#ffffff']);
        for (let i = 0; i < 20 && roomFor(); i++) {
            const a = rnd(0, TAU);
            const sp = rnd(90, 280);
            sigParticle({ x, y, s: S, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: 200, drag: 1.4, max: rnd(0.4, 0.8), color: pick(['#0a0412', '#1a0d2e', cols[1], cols[0]]), size: pick([1, 2, 2]), draw: streak });
        }
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
            dotAt(ctx, px, S, cx - S, cy, cols[1], wd + 2, 1);
            dotAt(ctx, px, S, cx, cy, j === n - 1 ? '#ffffff' : DARK, wd, 1);
        }
    }
    // 그림자 손가락 — 테두리 → 속 → 발톱
    function finger(ctx, px, S, x0, y0, a1, L1, a2, L2, rim) {
        const x1 = x0 + Math.cos(a1) * L1;
        const y1 = y0 + Math.sin(a1) * L1;
        const x2 = x1 + Math.cos(a2) * L2;
        const y2 = y1 + Math.sin(a2) * L2;
        dotLine(ctx, px, S, x0, y0, x1, y1, rim, 3);
        dotLine(ctx, px, S, x1, y1, x2, y2, rim, 3);
        dotLine(ctx, px, S, x0, y0, x1, y1, DARK, 1);
        dotLine(ctx, px, S, x1, y1, x2, y2, DARK, 1);
        dotAt(ctx, px, S, x2 + Math.cos(a2) * S - S / 2, y2 + Math.sin(a2) * S - S / 2, '#ffffff');
    }
    // 그림자 손 — 땅에서 솟은 팔이 몸 옆으로 올라와 손가락 셋 · 엄지가 몸을 감싸 쥠. sd: 손이 있는 쪽, k 솟음, grip 0~1
    function shadowHand(ctx, px, S, b, sd, gy, k, grip, T, cols) {
        const rim = cols[1];
        const bw = Math.max(b.w, S * 10);
        const bh = Math.max(b.h, S * 10);
        const aw = Math.max(S, Math.round((bh * 0.11) / S) * S); // 팔 반폭
        const cx = b.x + sd * (bw * 0.5 + aw * 1.6); // 손바닥 — 몸 옆
        const cy = lerp(gy + bh * 0.3, b.y - bh * 0.1, Math.min(1.1, k));
        const pw = Math.max(aw * 2.4, S * 5);
        const ph = Math.max(bh * 0.5, aw * 3);
        const bx = b.x + sd * (bw * 0.5 + aw * 3); // 팔 밑동
        const top = cy + ph * 0.3;
        for (let y = gy; y > top; y -= S) {
            const f = (gy - y) / Math.max(1, gy - top);
            const x = lerp(bx, cx, f * (2 - f)) + Math.sin(T * 7 + f * 5 + sd) * S * 0.8 * (1 - f);
            const hw = aw * (1.4 - 0.45 * f);
            ctx.fillStyle = rim;
            ctx.fillRect(px(x - hw - S), px(y - S), px(2 * hw + 2 * S), S);
            ctx.fillStyle = DARK;
            ctx.fillRect(px(x - hw), px(y - S), px(2 * hw), S);
        }
        ctx.fillStyle = rim;
        ctx.fillRect(px(cx - pw / 2), px(cy - ph / 2 - S), px(pw), px(ph + 2 * S));
        ctx.fillRect(px(cx - pw / 2 - S), px(cy - ph / 2), px(pw + 2 * S), px(ph));
        ctx.fillStyle = DARK;
        ctx.fillRect(px(cx - pw / 2), px(cy - ph / 2), px(pw), px(ph));
        // 손가락 — 펼치면 위로, 쥐면 몸 쪽(-sd)으로 굽음
        const x0 = cx - sd * pw * 0.3;
        for (let j = 0; j < 3; j++) {
            const y0 = cy - ph * 0.42 + j * ph * 0.2;
            const wig = Math.sin(T * 9 + j * 2) * 0.15 * (1 - grip);
            const a1 = -Math.PI / 2 - sd * ((Math.PI / 2) * grip * 0.9 + (0.2 - j * 0.15) * (1 - grip)) + wig;
            const a2 = a1 - sd * (0.3 + 0.8 * grip);
            finger(ctx, px, S, x0, y0, a1, bw * (j === 1 ? 0.5 : 0.42), a2, bw * 0.24, rim);
        }
        finger(ctx, px, S, cx, cy + ph * 0.2, -sd * (0.4 + 0.9 * grip) - Math.PI / 2 * (1 - grip) * 0.3, bw * 0.3, -sd * (1.2 + 0.6 * grip), bw * 0.2, rim);
    }

    // ── 날리기 그림 (fx-sky · fx-energy) ──
    function addLine(path, px, s, pts, w) {
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
    }
    function fillPts(ctx, px, s, pts, w, color, alpha = 1) {
        if (!pts || pts.length < 2 || alpha <= 0.01) {
            return;
        }
        const path = new Path2D();
        addLine(path, px, s, pts, w);
        ctx.globalAlpha = Math.min(1, alpha);
        ctx.fillStyle = color;
        ctx.fill(path);
    }
    // 점으로 된 고리 (납작하게 flat)
    function ringDots(ctx, px, s, x, y, r, flat, cols, alpha, th = 1) {
        const n = clamp(Math.round((r * TAU) / (s * 2)), 12, 300);
        ctx.globalAlpha = Math.min(1, alpha);
        for (let c = 0; c < cols.length; c++) {
            const path = new Path2D();
            for (let j = c; j < n; j += cols.length) {
                const a = (j / n) * TAU;
                for (let k = 0; k < th; k++) {
                    if (k > 0 && j % 2) {
                        continue;
                    }
                    const rr = r - k * s;
                    path.rect(px(x + Math.cos(a) * rr), px(y + Math.sin(a) * rr * flat), s, s);
                }
            }
            ctx.fillStyle = cols[c];
            ctx.fill(path);
        }
    }
    const LEAF = [
        [[1, 0, 1], [2, 0, 0], [0, 1, 2], [1, 1, 1]],
        [[0, 0, 2], [1, 0, 1], [2, 0, 0], [3, 0, 1]],
        [[0, 0, 0], [1, 0, 1], [1, 1, 1], [2, 1, 2]],
        [[0, 0, 0], [0, 1, 1], [0, 2, 2]],
    ];
    const glyphRects = (paths, px, s, x, y, cells, k = 1) => {
        for (const [dx, dy, c] of cells) {
            paths[c].rect(px(x + dx * s * k), px(y + dy * s * k), s * k, s * k);
        }
    };
    const fillPaths = (ctx, paths, cols, alpha = 1) => {
        ctx.globalAlpha = alpha;
        paths.forEach((path, i) => {
            ctx.fillStyle = cols[i];
            ctx.fill(path);
        });
    };
    // 작은 표창 — + 와 x 를 번갈아 (도는 것처럼)
    function miniShuriken(ctx, px, s, x, y, life, cols) {
        const plus = Math.floor(life / 0.05) % 2 === 0;
        const paths = [new Path2D(), new Path2D(), new Path2D()];
        for (const [ax, ay] of plus ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            for (let k = 1; k <= (plus ? 3 : 2); k++) {
                paths[k === 1 ? 0 : k === 2 ? 1 : 2].rect(px(x + ax * k * s), px(y + ay * k * s), s, s);
            }
        }
        for (const [ax, ay] of plus ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            paths[1].rect(px(x + ax * s), px(y + ay * s), s, s);
        }
        paths[0].rect(px(x), px(y), s, s);
        fillPaths(ctx, paths, [cols[0], cols[2], cols[3]], ctx.globalAlpha);
    }
    // 날리는 것 하나 (cs = 칸 크기) — SHAPES 를 크게, 바늘은 날아가는 쪽으로
    function drawShot(ctx, shape, q, cs, cols) {
        const px = (v) => Math.round(v / cs) * cs;
        const sp = Math.hypot(q.vx, q.vy) || 1;
        if (shape === 'needle') {
            const ax = q.vx / sp;
            const ay = q.vy / sp;
            const ci = [0, 0, 1, 2, 2, 3, 3, 3];
            const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
            for (let k = 0; k < ci.length; k++) {
                paths[ci[k]].rect(px(q.x - ax * k * cs), px(q.y - ay * k * cs), cs, cs);
            }
            fillPaths(ctx, paths, cols, ctx.globalAlpha);
            return;
        }
        if (shape === 'leaf') {
            const paths = [new Path2D(), new Path2D(), new Path2D()];
            glyphRects(paths, px, cs, q.x - cs * 2, q.y - cs, LEAF[Math.floor(q.life / 0.06) % 4], 2);
            fillPaths(ctx, paths, [cols[0], cols[1], cols[3]], ctx.globalAlpha);
            return;
        }
        if (shape === 'shuriken') {
            miniShuriken(ctx, px, cs, q.x, q.y, q.life, cols);
            return;
        }
        (SHAPES[shape] || SHAPES.star)(ctx, { x: q.x, y: q.y, s: cs, dir: q.vx < 0 ? -1 : 1, cols, big: true, life: q.life }, px);
    }
    // 거대 표창 · 별 — 칸마다 날 안인지 따져서 그림 (돌아가도 도트 그대로)
    function drawBigShuriken(ctx, x, y, D, C, ang, cols, alpha, star = false) {
        const R = D / 2;
        const n = Math.ceil(R / C);
        const gx0 = Math.round(x / C) * C;
        const gy0 = Math.round(y / C) * C;
        const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D()];
        for (let j = -n; j <= n; j++) {
            for (let i = -n; i <= n; i++) {
                const dx = i * C;
                const dy = j * C;
                const r = Math.hypot(dx, dy) / R;
                if (r > 1) {
                    continue;
                }
                const X = gx0 + dx - C / 2;
                const Y = gy0 + dy - C / 2;
                if (r < 0.1) {
                    paths[star ? 0 : 4].rect(X, Y, C, C);
                    continue;
                }
                if (r < (star ? 0.22 : 0.3)) {
                    paths[star ? 0 : r > 0.23 ? 3 : 1].rect(X, Y, C, C);
                    continue;
                }
                const a = Math.atan2(dy, dx) - ang;
                const rel = wrap(a - (star ? 0 : 0.95) * r, TAU / 4) - TAU / 8;
                const half = (TAU / 8) * (star ? 0.75 * (1 - r) ** 1.3 : 0.95 * (1 - r) ** 0.8);
                if (Math.abs(rel) > half) {
                    continue;
                }
                const e = rel / half;
                paths[e > 0.5 ? 0 : e < -0.55 ? 3 : r > 0.72 ? 2 : 1].rect(X, Y, C, C);
            }
        }
        ctx.globalAlpha = alpha;
        [cols[0], cols[1], cols[2], cols[3], '#0b2a4a'].forEach((c, i) => {
            ctx.fillStyle = c;
            ctx.fill(paths[i]);
        });
    }
    // 별 (반지름 r 칸, diag 면 x 모양)
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
    // 하트 — 톡 나타나 두근두근 (입자 그리기)
    const heartDraw = (ctx, p, t, px) => {
        ctx.globalAlpha = fadeInOut(t, 0.05, 0.3);
        const small = p.life < 0.08 || Math.sin(p.life * 10 + p.ph) > 0.8;
        drawHeart(ctx, px, p.s, p.x, p.y, !small, p.color, '#ffffff');
    };

    // ── 공통 — 쪽마다 장면 입자 하나: 모으기부터 끝까지 매 프레임 step · paint ──
    function scene(D, X, step, paint) {
        const st = X.st;
        const cut = D.ground;
        sigParticle({ x: 0, y: 0, s: X.S, max: Math.max(0.5, D.total - D.t + 0.3),
            update: (q, dt) => {
                if (st.dead) {
                    q.life = q.max;
                    return;
                }
                try {
                    CUT = cut;
                    step(D, X, dt);
                } catch (e) {
                    kill(X, e);
                    q.life = q.max;
                }
            },
            draw: (ctx, q, t, px) => {
                if (st.dead) {
                    return;
                }
                ctx.save();
                try {
                    clipGround(ctx, cut);
                    paint(ctx, px, D, X);
                } catch (e) {
                    kill(X, e);
                    q.life = q.max;
                }
                ctx.restore();
            },
        });
    }
    // 오류 — 그 쪽 모양은 엔진 기본 줄기로, 진짜 그림은 바로 다시 보임
    function kill(X, e) {
        X.st.dead = true;
        try {
            release(X);
        } catch (e2) {
            // 그림이 없어졌어도 계속
        }
        fail(e);
    }
    // 종류 하나 — 처음 부를 때 준비(setup), 오류가 나면 그 쪽만 기본 줄기로
    function makeKind(setup, fx) {
        const get = (D, X) => {
            const st = X.st;
            CUT = D.ground;
            if (!st.ok) {
                st.ok = true;
                st.flags = new Set();
                st.acc = {};
                try {
                    setup(D, X);
                } catch (e) {
                    kill(X, e);
                }
            }
            return !st.dead;
        };
        const safe = (X, fn) => {
            try {
                fn();
            } catch (e) {
                kill(X, e);
            }
        };
        return {
            charge: (D, X, k, dt) => (get(D, X) ? safe(X, () => fx.charge?.(D, X, k, dt)) : duelGather(D, X, k, dt)),
            draw: (ctx, px0, D, X) => {
                if (!get(D, X)) {
                    DUEL_FX._stream.draw(ctx, px0, D, X);
                    return;
                }
                const S = X.S;
                const px = (v) => Math.round(v / S) * S;
                ctx.save();
                safe(X, () => {
                    clipGround(ctx, D.ground);
                    fx.draw?.(ctx, px, D, X);
                });
                ctx.restore();
            },
            tick: (D, X, dt) => get(D, X) && safe(X, () => fx.tick?.(D, X, dt)),
            push: (D, X, strong) => get(D, X) && safe(X, () => fx.push?.(D, X, strong)),
            win: (D, X, L) => get(D, X) && safe(X, () => fx.win?.(D, X, L)),
        };
    }
    // 앞머리가 얼마나 나갔나 0~1 (나가기) — 한 번 닿으면 밀려도 1
    const progress = (D, X) => {
        const st = X.st;
        if (st.arrived || (D.phase !== 'charge' && D.phase !== 'go')) {
            st.arrived = D.phase !== 'charge';
            return st.arrived ? 1 : 0;
        }
        const f = k01(Math.abs(X.front - X.x0) / Math.max(1, D.half - 0.5));
        if (f >= 1) {
            st.arrived = true;
        }
        return f;
    };
    // 만나는 곳 빛 덩어리(엔진)의 바깥 반지름 — 이보다 안은 덩어리에 가려짐
    const blobR = (D) => D.blobR ?? D.lane * (1 + 0.5 * D.climax) * 1.7; // 엔진이 알려 주는 빛 덩어리 반지름
    // 보이는 맞닿는 자리 — 밀고 밀리는 동안엔 빛 덩어리 이쪽 가장자리, 아니면 앞머리
    const impactX = (D, X) => (D.phase === 'push' || (D.phase === 'through' && D.t - D.tO < DUEL_THROUGH * 0.6) ? X.front - X.dir * blobR(D) * 0.88 : X.front);
    // 밀어붙이는 힘 −1(밀림) ~ +1 — 부드럽게
    function pressure(D, X, dt) {
        const opp = other(D, X);
        X.st.pr = lerp(X.st.pr || 0, (X.pa || 0) - (opp.pa || 0), Math.min(1, dt * 8));
        return X.st.pr;
    }

    // ═════════════ rush — 몸으로: 꼭두각시가 직접 (ultrush 돌진 · ultdive 다이브 · ultbarrage 연타) ═════════════
    function rushSetup(D, X) {
        const st = X.st;
        const o = X.o;
        const mode = X.fx === 'ultdive' ? 'dive' : X.fx === 'ultbarrage' ? 'barrage' : 'rush';
        const elem = mode === 'barrage' ? '' : o.flame ? 'fire' : o.elec ? 'electric' : mode === 'rush' && o.water ? 'water' : '';
        const cols = sigPal(o.c || (mode === 'barrage' ? 'fight' : elem || 'gold'));
        const ac = mode !== 'barrage' && elem ? sigPal(elem) : cols; // 오라 · 두른 것
        Object.assign(st, {
            mode, elem, cols, ac, hot: elem ? ac : SIG_PALETTE.hyper,
            drill: mode === 'rush' && !!o.drill, fast: mode === 'rush' && !!o.fast, heavy: mode === 'dive' && !!o.heavy,
            strike: ['punch', 'slash', 'kick'].includes(o.kind) ? o.kind : 'punch', spin: mode === 'barrage' && !!o.spin,
            K: 0.4 + 0.6 * clamp(X.P || 0, 0, 1),
            pr: 0, surge: 0, recoil: 0, lunge: 0, thud: 0, combo: 0, pop: 0, nextHit: 0, ang: 0, arcs: [], arcAt: -1, trailX: null,
        });
        const pp = makePuppet(X);
        // 배율 — 작은 그림은 맞부딪히는 줄 굵기에 맞게 크게(그림 1픽셀이 정수 칸), 상대가 가까우면 덜
        let sc = clamp((D.lane * 2.6) / pp.bh, 1, 2);
        const reach = Math.abs(X.x0 - pp.home.x) + D.half - D.lane * 0.8;
        sc = Math.min(sc, Math.max(1, reach / (pp.bw / 2)));
        const s = Math.max(0.5, X.s || 1);
        sc = Math.max(1, Math.round(s * sc) / s);
        if (st.heavy) {
            sc = Math.max(1, Math.min(Math.round(s * sc * 1.5) / s, (pp.home.y - D.H * 0.06) / pp.bh));
        }
        st.SC = sc;
        st.U = Math.max(D.lane * 2.2, pp.bh * sc);
        st.yTop = -pp.bh * sc * 1.4 - 16;
        st.gx = pp.home.x - X.dir * pp.bw * 0.4; // 다이브 — 솟아오른 자리 (여기서 비스듬히 내리꽂음)
        pp.ghostCols = mode === 'barrage' ? [cols[1], '#ffffff', cols[2]] : [ac[1], ac[2], '#ffffff', ac[3]];
        pp.under = (ctx, px) => rushUnder(ctx, px, D, X);
        pp.over = (ctx, px) => rushOver(ctx, px, D, X);
        scene(D, X, rushStep, rushPaint);
    }

    function rushStep(D, X, dt) {
        const st = X.st;
        const pp = st.pp;
        pressure(D, X, dt);
        st.surge = Math.max(0, st.surge - dt * 2.5);
        st.recoil = Math.max(0, st.recoil - dt * 3);
        st.thud = Math.max(0, st.thud - dt * 4);
        st.lunge *= Math.exp(-dt * 14);
        st.pop = Math.max(0, st.pop - dt * 6);
        pp.flash = Math.max(0, pp.flash - dt * 4);
        if (st.drill || st.spin) {
            const v = D.phase === 'charge' ? 3 * k01(D.t / DUEL_CHARGE) : D.phase === 'after' ? 0 : 4.5 + 2 * Math.max(0, st.pr);
            st.ang += X.dir * TAU * v * dt;
        }
        // 진 쪽 · 무승부 — 엔진이 진짜 그림을 다시 보이고 벌러덩 (그 프레임부터 꼭두각시 그만)
        if (D.phase === 'draw' || (D.phase === 'after' && D.loser === X)) {
            st.gone = true;
            release(X);
        }
        if (!st.gone) {
            Object.assign(pp, { ghostN: 0, aura: 0, dash: false, comet: false, rise: false, shadow: 0, glow: null, show: true, tail: null }, rushPose(D, X));
        }
        track(pp);
    }

    // 꼭두각시 자리 · 모양 — 단계마다
    function rushPose(D, X) {
        const st = X.st;
        const pp = st.pp;
        const T = D.t;
        const dir = X.dir;
        const S = X.S;
        const home = pp.home;
        const ph = D.phase;
        const won = D.winner === X;
        const hw = (pp.bw * st.SC) / 2;
        const hh = pp.bh * st.SC;
        // 만나는 곳에서 몸 앞까지 — 돌진은 빛 덩어리 가장자리에 어깨를 들이밂, 드릴은 원뿔이 보이게 더 뒤, 연타는 덩어리 밖에서 주먹을 뻗음
        const gb = blobR(D) * 0.72 + (st.drill ? D.lane * 1.1 : 0) + (st.mode === 'barrage' ? blobR(D) * 0.28 + D.lane * 0.8 : 0);
        // 앞머리 front 에 몸 앞이 닿는 몸 가운데 x — 제자리보다 뒤로는 안 감
        const at = (front, gap = gb) => {
            const c = front - dir * (gap + hw);
            return (c - home.x) * dir < 0 ? home.x : c;
        };
        const f = progress(D, X);
        const pr = st.pr;
        const glow = [st.ac[1], st.ac[3]];
        const jit = ph === 'push' ? rnd(-1, 1) * S * 0.5 * (0.5 + Math.abs(pr)) : 0;
        const tk = k01((T - D.tO) / DUEL_THROUGH);
        // 이긴 뒤 — 들이받은 자리에서 찌부 → 공중제비로 제자리 → 진짜 그림으로
        if (ph === 'after') {
            if (!won) {
                return { show: false };
            }
            const ta = T - D.tO - DUEL_THROUGH;
            if (st.hitX === undefined) {
                st.hitX = pp.x;
                st.hitY = pp.y;
            }
            const sq = st.mode === 'dive' ? [1.45, 0.6] : [0.62, 1.25];
            if (ta < 0.14) {
                const b = easeOut(ta / 0.14);
                return { x: st.hitX, y: st.hitY, sc: st.SC, rot: 0, sx: lerp(sq[0], 1, b), sy: lerp(sq[1], 1, b), aura: 0.8, glow };
            }
            const k = k01((ta - 0.14) / 0.55);
            if (k >= 1) {
                rushLand(D, X);
                return { x: home.x, y: home.y, sc: 1, rot: 0, sx: 1, sy: 1, show: false };
            }
            const hop = clamp(hh * 0.9, 16, D.H * 0.32);
            return {
                x: lerp(st.hitX, home.x, easeOut(k)), y: lerp(st.hitY, home.y, k) - hop * 4 * k * (1 - k), sc: lerp(st.SC, 1, smooth(k)),
                rot: -dir * TAU * smooth(k), sx: 1, sy: 1, ghostN: 3, aura: 0.6 * (1 - k),
            };
        }
        if (st.mode === 'dive') {
            const kc = k01(T / DUEL_CHARGE);
            const scC = lerp(1, st.SC, smooth(kc / 0.45));
            if (ph === 'charge') {
                if (kc < 0.5) {
                    // 웅크리기
                    const k = kc / 0.5;
                    return { x: home.x + Math.sin(T * 90) * S * 0.6 * k, y: home.y, sc: scC, rot: 0, sx: 1 + 0.14 * k, sy: 1 - 0.26 * k, aura: smooth(k) };
                }
                if (kc < 0.85) {
                    // 화면 위로 솟구침
                    const k = (kc - 0.5) / 0.35;
                    return { x: home.x, y: lerp(home.y, st.yTop, k * k), sc: scC, rot: 0, sx: 0.78, sy: 1.38, ghostN: 6, rise: true, glow };
                }
                return { x: st.gx, y: st.yTop, sc: st.SC, show: false };
            }
            // 내리꽂을 자리 — 보통은 만나는 곳에 비스듬히 위에서 버팀, 잠만보(heavy)는 앞머리 땅에 쿵
            const hv = st.heavy ? { x: at(X.front, gb * 0.35), y: home.y } : { x: at(X.front, gb * 0.7), y: Math.min(home.y, D.ym - D.lane * 0.45 + hh / 2) };
            const ang = clamp(Math.atan2(hv.y - st.yTop, Math.abs(hv.x - st.gx) + 1), 0.3, 1.1);
            if (ph === 'go' || ph === 'push') {
                if (st.heavy) {
                    if (f >= 1 && once(st, 'land')) {
                        heavyLand(D, X, hv.x);
                    }
                    return {
                        x: hv.x + jit, y: lerp(st.yTop, hv.y, f * f), sc: st.SC, rot: 0,
                        sx: 1 + 0.05 * pr + 0.35 * st.thud, sy: (1 - 0.04 * pr) * (1 + 0.05 * Math.sin(T * 9)) - 0.3 * st.thud,
                        ghostN: f < 1 ? 5 : 0, comet: f < 1, aura: f < 1 ? 0 : 1, shadow: f < 1 ? Math.max(0.05, f) : 0, glow, tail: [0, -1],
                    };
                }
                const e = f ** 1.15;
                const L0 = Math.hypot(hv.x - st.gx, hv.y - st.yTop) || 1;
                const diving = f < 1;
                return {
                    x: lerp(st.gx, hv.x, e) + jit - dir * S * 4 * st.recoil, y: lerp(st.yTop, hv.y, e) - D.lane * 0.4 * st.recoil, sc: st.SC,
                    rot: dir * (ang + 0.08 * pr - 0.25 * st.recoil), sx: diving ? 0.9 : 1 + 0.06 * Math.max(0, pr), sy: diving ? 1.1 : 1 - 0.05 * Math.max(0, pr),
                    ghostN: diving ? 6 : pr > 0.25 ? 3 : 0, comet: true, glow, tail: [(st.gx - hv.x) / L0, (st.yTop - hv.y) / L0],
                };
            }
            if (ph === 'through') {
                if (st.t0x === undefined) {
                    st.t0x = pp.x;
                    st.t0y = pp.y;
                }
                if (won) {
                    const tx = D.loser.body.cx - dir * hw * 0.2;
                    if (st.heavy) {
                        // 몸통 박치기 — 크게 뛰어올라 덮침
                        const hop = clamp(D.lane * 3, 20, D.H * 0.35);
                        return { x: lerp(st.t0x, tx, tk), y: lerp(st.t0y, home.y, tk) - hop * Math.sin(Math.PI * tk), sc: st.SC, rot: dir * 0.3 * Math.sin(Math.PI * tk), ghostN: 5, glow, comet: tk > 0.5, tail: [-dir * 0.3, -0.95] };
                    }
                    const e = tk ** 1.3;
                    const L1 = Math.hypot(tx - st.t0x, home.y - st.t0y) || 1;
                    return { x: lerp(st.t0x, tx, e), y: lerp(st.t0y, home.y, e), sc: st.SC, rot: dir * lerp(ang, 1.1, tk), sx: 0.9, sy: 1.1, ghostN: 7, comet: true, glow, tail: [-(tx - st.t0x) / L1, -(home.y - st.t0y) / L1] };
                }
                // 진 쪽 — 밀려나 땅으로 떨어지며 제자리로
                return {
                    x: at(X.front, st.heavy ? gb * 0.35 : gb * 0.7), y: lerp(st.t0y, home.y, easeIn(tk)), sc: st.SC,
                    rot: st.heavy ? -dir * 0.3 * tk : dir * ang * (1 - tk) - dir * 0.4 * tk, aura: 1 - tk, flash: 0.45 + 0.45 * Math.sin(T * 50),
                };
            }
            return { x: home.x, y: home.y, sc: 1 };
        }
        // 돌진 · 연타
        if (ph === 'charge') {
            const k = k01(T / DUEL_CHARGE);
            return {
                x: home.x + Math.sin(T * 90) * S * 0.7 * k, y: home.y, sc: lerp(1, st.SC, smooth(k / 0.8)),
                rot: st.drill || st.spin ? st.ang : dir * 0.12 * k, sx: 1 + 0.12 * k, sy: 1 - 0.16 * k, aura: smooth(k),
            };
        }
        if (ph === 'go' || ph === 'push') {
            const moving = ph === 'go' && f < 1;
            const kick = st.mode === 'barrage' && st.strike === 'kick' && !st.spin && ph === 'push';
            return {
                x: at(X.front) + jit - dir * S * 4 * st.recoil + dir * pp.bw * 0.22 * st.lunge,
                y: home.y - (kick ? Math.abs(Math.sin(T * 26)) * hh * 0.18 : 0),
                sc: st.SC,
                rot: st.drill || st.spin ? st.ang : moving ? dir * 0.18 : dir * (0.1 + 0.12 * pr - 0.3 * st.recoil + 0.15 * st.lunge),
                sx: moving ? 1.3 : 1 + 0.1 * Math.max(0, pr) - 0.07 * Math.max(0, -pr) + 0.12 * st.lunge,
                sy: moving ? 0.82 : 1 - 0.08 * Math.max(0, pr) + 0.05 * Math.max(0, -pr) - 0.08 * st.lunge,
                ghostN: moving ? (st.fast ? 10 : 6) : pr > 0.25 ? (st.fast ? 4 : 2) : 0,
                aura: moving ? 0 : 1, dash: moving, glow,
            };
        }
        if (ph === 'through') {
            if (won) {
                return { x: at(X.front, gb * (1 - tk) - hw * 0.8 * tk), y: home.y, sc: st.SC, rot: st.drill || st.spin ? st.ang : dir * 0.2, sx: 1.3, sy: 0.82, ghostN: st.fast ? 10 : 7, dash: true, glow };
            }
            return { x: at(X.front), y: home.y, sc: st.SC, rot: -dir * 0.35 * tk, sx: 1 - 0.1 * tk, sy: 1 + 0.08 * tk, aura: 1 - tk, flash: 0.45 + 0.45 * Math.sin(T * 50) };
        }
        return { x: home.x, y: home.y, sc: 1 };
    }

    // 혜성 꼬리 끝이 위 끝 (정보줄 · 지도 줄 아래 — fxStageTop) 에 걸치지 않게 — 길이는 그대로 두고 눕힘 (U4 — 머무는 모양은 무대 안 · 크기 대신 자리를 옮김)
    //   (리자몽 플레어드라이브 앞장 꼬리가 밀기 3초 동안 정보줄 밑변에 일자로 잘려 머물던 것 — #116 UX 2바퀴) · 게임 밖 · 아래로 난 꼬리는 그대로 · back = 꼬리가 누울 쪽 (몸 뒤)
    // 연타 안내 판 아래 끝 + 4 (없으면 0) — 0.1초마다 한 번만 잼 (그리는 장면마다 querySelector · 레이아웃을 부르던 것, 코드 리뷰어 #116)
    let mashAt = -1e9;
    let mashV = 0;
    function mashBottom() {
        const t = performance.now();
        if (t - mashAt > 100) {
            mashAt = t;
            const el = document.querySelector('#pokemon-game .pg-team-prompt-mash');
            mashV = el ? el.getBoundingClientRect().bottom + 4 : 0;
        }
        return mashV;
    }
    function tailUnderTop(cx, cy, ux, uy, len, r0, S, back) {
        // 3:3 힘겨루기 장면에 연타 안내 (위 가운데) 가 떠 있으면 그 판 아래 끝 + 4 도 위 끝 (눕힌 꼬리가 판 가장자리에 46/48장면 닿던 것 — 픽셀 검사원 #116 3바퀴 큼 1) · 1:1 화면은 그대로
        const top = Math.max(typeof fxStageTop === 'function' ? fxStageTop() : 0, mashBottom());
        if (!top || uy >= 0) {
            return [ux, uy];
        }
        const over = (vx, vy) => {
            for (let i = 0; i <= 12; i++) {
                const d = (len * i) / 12;
                if (cy + vy * d - r0 * 1.14 * (1 - d / len) ** 0.8 < top + S * 2) {
                    return true;
                }
            }
            return false;
        };
        if (!over(ux, uy)) {
            return [ux, uy];
        }
        const sx = Math.abs(ux) > 0.01 ? Math.sign(ux) : back;
        let a = Math.asin(Math.min(1, -uy));
        while (a > 0 && over(sx * Math.cos(a), -Math.sin(a))) {
            a -= 0.05;
        }
        a = Math.max(0, a);
        return [sx * Math.cos(a), -Math.sin(a)];
    }
    // 몸 뒤 — 오라 · 혜성 꼬리
    function rushUnder(ctx, px, D, X) {
        const st = X.st;
        const pp = st.pp;
        const S = X.S;
        const T = D.t;
        const dir = X.dir;
        const w = pp.bw * pp.sc;
        const h = pp.bh * pp.sc;
        const ac = st.ac;
        const U = st.U;
        if (pp.rise) {
            comet(ctx, px, S, pp.x, pp.y - h * 0.5, 0, 1, U * 1.8, Math.max(w, U * 0.5) * 0.55, ac, T);
            return;
        }
        if (pp.comet && pp.tail) {
            const big = st.heavy ? 1.15 : 1;
            const cy = pp.y - h * 0.5 * pp.sy;
            const len = U * (2.2 + 1.1 * st.K) * big * (1 + 0.35 * Math.max(0, st.pr) + 0.4 * st.surge);
            const r0 = Math.max(w, h) * 0.6;
            const [ux, uy] = tailUnderTop(pp.x, cy, pp.tail[0], pp.tail[1], len, r0, S, -dir);
            comet(ctx, px, S, pp.x, cy, ux, uy, len, r0, ac, T);
            return;
        }
        if (pp.dash) {
            hComet(ctx, px, S, pp.x, pp.y - h * 0.45, -dir, Math.min(U * 2.6, Math.abs(pp.x - pp.home.x) + U * 0.6), Math.max(h * 0.6, D.lane * 0.8), ac, T);
            return;
        }
        if (pp.aura > 0.02) {
            const lean = D.phase === 'push' ? -dir * (0.5 + 0.7 * Math.max(0, st.pr)) : 0;
            drawAura(ctx, px, S, pp.x, pp.y, Math.max(w, U * 0.7) * Math.min(pp.sx, 1.1), Math.max(h, U * 0.9), ac, T, pp.aura * (1 + 0.35 * st.surge), lean);
        }
    }

    // 몸 앞 — 드릴 원뿔 · 앞쪽 공기 벽 · 두른 번개 · 물 막 · 팽이 칼바람
    function rushOver(ctx, px, D, X) {
        const st = X.st;
        const pp = st.pp;
        const S = X.S;
        const T = D.t;
        const dir = X.dir;
        const ph = D.phase;
        const w = pp.bw * pp.sc;
        const h = pp.bh * pp.sc;
        const cy = pp.y - h * 0.5;
        const ac = st.ac;
        const cols = st.cols;
        const active = ph === 'charge' || ph === 'go' || ph === 'push' || (ph === 'through' && D.winner === X);
        if (st.drill && active) {
            const k = ph === 'charge' ? smooth(T / DUEL_CHARGE) : 1;
            const bx = pp.x + dir * w * 0.3;
            const len = ph === 'charge' ? Math.max(w, D.lane * 1.6) * 0.7 * k : Math.max(w * 0.45, (X.front - bx) * dir);
            const r0 = Math.max(h * 0.42, D.lane * 0.7);
            if (len > S * 2) {
                ctx.globalAlpha = 0.95;
                for (let d = 0; d < len; d += S) {
                    const rr = r0 * (1 - d / len);
                    for (let yy = -rr; yy <= rr; yy += S) {
                        const band = (Math.floor((d + yy * 1.4 + T * 300) / (S * 3)) & 1) === 0;
                        dotAt(ctx, px, S, bx + dir * d, cy + yy, Math.abs(yy) > rr - S ? cols[3] : band ? cols[0] : cols[2]);
                    }
                }
                // 몸을 감는 나선 두 줄
                for (let j = 0; j < 2; j++) {
                    for (let d = -w * 0.8; d < len; d += S) {
                        const th = d * 0.2 - T * 32 + j * Math.PI;
                        const rr = (d < 0 ? Math.max(h * 0.6, r0) : r0 * (1 - d / len)) + S * 2;
                        const fr = Math.sin(th) > 0;
                        ctx.globalAlpha = (fr ? 0.95 : 0.35) * k;
                        dotAt(ctx, px, S, bx + dir * d, cy + Math.cos(th) * rr, fr ? '#ffffff' : ac[1], fr ? 2 : 1, 1);
                    }
                }
            }
        }
        if (pp.dash) {
            // 앞쪽 공기 벽 — 초승달 두 겹
            for (const [m, c] of [[1, ac[1]], [0.7, '#ffffff']]) {
                ctx.globalAlpha = 0.85;
                const r = Math.max(h * 0.85, D.lane * 1.1) * m;
                for (let a = -1.15; a <= 1.15; a += 0.1) {
                    dotAt(ctx, px, S, pp.x + dir * (w * (st.drill ? 1.1 : 0.5) + Math.cos(a) * r * 0.5), cy + Math.sin(a) * r, Math.abs(a) < 0.45 ? '#ffffff' : c, 1, 2);
                }
            }
        }
        if (st.elem === 'electric' && (active || ph === 'through')) {
            if (T - st.arcAt > 0.05) {
                st.arcAt = T;
                st.arcs = [];
                const R = Math.max(w, h, st.U * 0.8);
                for (let j = 0; j < 4 + Math.round(3 * st.K); j++) {
                    const a = rnd(0, TAU);
                    const r = R * rnd(0.4, 0.75);
                    st.arcs.push(zigzag(pp.x + Math.cos(a) * w * 0.2, cy + Math.sin(a) * h * 0.2, pp.x + Math.cos(a) * r, cy + Math.sin(a) * r, S, 1.5));
                }
            }
            ctx.globalAlpha = 0.9;
            st.arcs.forEach((a) => zapLine(ctx, px, S, a, 1, ac[2]));
        }
        if (st.elem === 'water' && active) {
            ctx.globalAlpha = 0.8;
            ellipseDots(ctx, px, S, pp.x + (pp.dash ? dir * w * 0.15 : dir * w * 0.1), cy, Math.max(w, st.U * 0.5) * 0.7, Math.max(h, st.U * 0.5) * 0.62, [ac[0], ac[2], ac[1], ac[3]], T * 7, 5);
        }
        if (st.spin && (ph !== 'charge' || T > DUEL_CHARGE * 0.4) && active) {
            // 팽이 — 몸을 도는 칼바람 고리 세 줄
            for (let j = 0; j < 3; j++) {
                const r = Math.max(w, st.U * 0.55) * (0.7 + j * 0.22);
                for (let a = 0; a < TAU; a += 0.18) {
                    if ((Math.floor(a / 0.18) + j) % 3 === 0) {
                        continue;
                    }
                    const th = a + T * 26 * dir + j;
                    const fr = Math.sin(th) > 0;
                    const bx = pp.x + Math.cos(th) * r;
                    const by = cy + Math.sin(th) * r * 0.28 + (j - 1) * h * 0.28;
                    ctx.globalAlpha = fr ? 1 : 0.4;
                    if (fr) {
                        // 앞쪽 칼날 — 굵고 밝게 (오라 위에서도 보이게)
                        dotAt(ctx, px, S, bx - S, by - S, cols[3], 3, 2);
                    }
                    dotAt(ctx, px, S, bx, by, fr ? '#ffffff' : cols[1], fr ? 2 : 1, 1);
                }
            }
        }
    }

    // 장면 — 빛 자국 · 하늘 반짝 · 그림자 · 꼭두각시 · 연타 수
    function rushPaint(ctx, px, D, X) {
        const st = X.st;
        const pp = st.pp;
        const S = X.S;
        const T = D.t;
        const dir = X.dir;
        const ph = D.phase;
        const F = X.fade;
        const G = D.ground;
        // 지나간 자리에 남는 빛 자국 (땅 · 몸 높이) — 돌진
        if (st.mode === 'rush' && ph !== 'charge' && !st.gone) {
            // 가장 멀리 나간 자리까지 (밀려도 자국은 남음)
            if ((ph === 'go' || ph === 'push' || (ph === 'through' && D.winner === X)) && pp.y >= G - 4 && (st.trailX === null || (pp.x - st.trailX) * dir > 0)) {
                st.trailX = pp.x;
            }
            if (st.trailX !== null) {
                const len = Math.abs(st.trailX - pp.home.x);
                const a = (ph === 'after' || ph === 'draw' ? 0.5 : 0.85) * F;
                if (len > S * 2 && a > 0.02) {
                    const lo = Math.min(st.trailX, pp.home.x);
                    ctx.globalAlpha = a;
                    ctx.fillStyle = st.hot[2];
                    ctx.fillRect(px(lo), px(G - S * 2), px(len), S * 2);
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(px(lo), px(G - S * 1.5), px(len), Math.max(1, S / 2));
                    ctx.globalAlpha = a * 0.5;
                    const h = pp.bh * st.SC;
                    for (const f of [0.35, 0.7]) {
                        ctx.fillStyle = f > 0.5 ? st.ac[1] : st.ac[0];
                        ctx.fillRect(px(lo), px(G - h * f), px(len), Math.max(1, S / 2));
                    }
                }
            }
        }
        // 다이브 — 솟아 사라진 뒤 하늘에 반짝 (내리꽂을 곳 위)
        if (st.mode === 'dive' && !st.gone) {
            const kc = T / DUEL_CHARGE;
            const f = progress(D, X);
            if ((ph === 'charge' && kc > 0.82) || (ph === 'go' && f < 0.25)) {
                const gx = st.heavy ? pp.x : st.gx;
                const gy = Math.max(10, D.H * 0.09);
                const r = (S * 3 + st.U * 0.25 * st.K) * (0.6 + 0.4 * Math.sin(T * 30));
                ctx.globalAlpha = 1;
                star4(ctx, px, S, gx, gy, r, '#ffffff', st.ac[1]);
                ctx.globalAlpha = 0.6;
                ellipseDots(ctx, px, S, gx, gy, r * 0.6, r * 0.6, [st.ac[1], '#ffffff'], T * 4, 3);
            }
            if (pp.shadow > 0) {
                // 잠만보 — 떨어질 자리에 점점 커지는 그림자
                const rx = lerp(pp.bw * 0.6, Math.max(pp.bw * st.SC * 0.9, D.W * 0.12), pp.shadow * pp.shadow);
                const ry = Math.max(S * 2, rx * 0.16);
                ctx.globalAlpha = 0.35 + 0.45 * pp.shadow;
                fillEllipse(ctx, px, S, pp.x, G - ry, rx, ry, '#000000');
                ctx.globalAlpha = 0.5 + 0.4 * pp.shadow;
                ellipseDots(ctx, px, S, pp.x, G - ry, rx + S, ry + S, [st.ac[1], st.ac[3]], T * 2, 3);
            }
        }
        if (pp.show && !st.gone) {
            drawPuppet(ctx, px, X, pp);
        }
        // 연타 수 — 맞을 때마다 톡, 이기면 금색으로 떠오름
        if (st.mode === 'barrage' && st.combo > 0 && (ph === 'push' || ph === 'through' || ph === 'after' || ph === 'draw')) {
            const fin = ph === 'after' && D.winner === X;
            const ta = ph === 'after' || ph === 'draw' ? T - D.tO - (ph === 'after' ? DUEL_THROUGH : 0) : 0;
            const a = fin ? Math.max(0, 1 - ta / 1.3) : ph === 'push' || ph === 'through' ? F : Math.max(0, 1 - ta / 0.3);
            if (a > 0.02) {
                const fs = Math.round(clamp(D.W / 32, 10, 17) * (fin ? 1.45 : 1) * (1 + 0.3 * st.pop));
                const text = fin ? `${st.combo} HIT!!` : `${st.combo} HIT`;
                ctx.font = `900 ${fs}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const half = ctx.measureText(text).width / 2 + 4;
                const h = pp.bh * st.SC;
                const x = clamp(fin ? st.hitX ?? pp.x : pp.x, half, D.W - half);
                const y = clamp((fin ? st.hitY ?? pp.y : pp.y) - h - fs * 0.9 - (fin ? ta * 22 : 0), fs, D.H - fs);
                ctx.globalAlpha = a;
                ctx.lineJoin = 'round';
                ctx.lineWidth = Math.max(3, fs / 4);
                ctx.strokeStyle = 'rgba(15, 5, 0, 0.9)';
                ctx.strokeText(text, x, y);
                ctx.fillStyle = fin ? '#ffe14d' : st.pop > 0.5 ? '#ffffff' : st.cols[1];
                ctx.fillText(text, x, y);
            }
        }
    }

    // ① 모으기 — 빨려 드는 기 · 솟는 기운 · 발밑 고리 · 들썩이는 돌멩이 · 두른 것 (다이브는 반쯤에서 솟구침)
    function rushCharge(D, X, k, dt) {
        const st = X.st;
        const pp = st.pp;
        const S = X.S;
        const h = pp.bh * pp.sc;
        const w = pp.bw * pp.sc;
        const ac = st.ac;
        const U = st.U;
        const G = D.ground;
        const onGround = pp.home.y >= G - 4;
        const cx = () => st.pp.x;
        const cy = () => st.pp.y - st.pp.bh * st.pp.sc * 0.5;
        const n1 = acc(st, 'pull', dt, k < 0.92 && (st.mode !== 'dive' || k < 0.5) ? 70 + 50 * st.K : 0);
        for (let i = 0; i < n1 && roomFor(); i++) {
            pullIn(cx, cy, U * 0.8, S, ac);
        }
        if (st.mode !== 'dive' || k < 0.5) {
            const n2 = acc(st, 'rise', dt, 45 + 40 * st.K);
            for (let i = 0; i < n2 && roomFor(); i++) {
                const x = pp.x + rnd(-0.45, 0.45) * Math.max(w, U * 0.7);
                const y = pp.y - rnd(0, 0.6) * Math.max(h, U * 0.9);
                if (st.elem === 'fire') {
                    sigParticle({ x, y, s: S, vx: rnd(-10, 10), vy: -rnd(60, 130), g: -30, drag: 1.4, max: rnd(0.3, 0.5), cols: ac, grow: 2 + 2 * st.K, draw: DRAW.stream });
                } else {
                    sigParticle({ x, y, s: S, vx: rnd(-8, 8), vy: -rnd(60, 140), drag: 1.2, max: rnd(0.3, 0.5), color: pick(ac), size: pick([1, 1, 2]), draw: (ctx, q, t, px) => {
                        ctx.globalAlpha = fadeInOut(t, 0.1, 0.4);
                        dotAt(ctx, px, q.s, q.x, q.y, q.color, q.size, q.size * 3);
                    } });
                }
            }
            if (onGround) {
                const n3 = acc(st, 'peb', dt, 25);
                for (let i = 0; i < n3 && roomFor(); i++) {
                    sigParticle({ x: pp.home.x + rnd(-1.4, 1.4) * Math.max(w, U * 0.6), y: G - S * 2, s: S, vy: -rnd(20, 60), drag: 2.5, max: rnd(0.4, 0.7), color: pick(ROCK), size: pick([1, 2, 2]),
                        draw: (ctx, q, t, px) => {
                            ctx.globalAlpha = fadeInOut(t, 0.1, 0.3);
                            dotAt(ctx, px, q.s, q.x + Math.sin(q.life * 70) * q.s * 0.5, q.y, q.color, q.size, q.size);
                        } });
                }
            }
        }
        for (const [key, at] of [['r0', 0], ['r1', 0.33], ['r2', 0.66]]) {
            if (k >= at && (st.mode !== 'dive' || at < 0.5) && once(st, key)) {
                if (st.mode === 'dive') {
                    // 다이브 — 좁혀 드는 고리
                    part({ x: pp.home.x, y: G, s: S, max: 0.3, draw: (ctx, p, t, px) => {
                        const r = lerp(U * 1.5, S * 4, easeOut(t));
                        ctx.globalAlpha = 1 - t * 0.5;
                        ellipseDots(ctx, px, S, p.x, G - S - r * 0.17, r, r * 0.28, [ac[1], '#ffffff']);
                    } });
                } else {
                    groundRing(pp.home.x, G, S, U * (1.2 + 0.5 * st.K), [ac[0], ac[2], '#ffffff'], 0.42);
                }
            }
        }
        if (st.mode === 'rush' && onGround && k >= 0.5 && once(st, 'crack')) {
            cracks(pp.home.x, G - S, S, ac, 4, U * 0.8, (i) => (i % 2 ? Math.PI : 0) + rnd(-0.3, 0.3), 0.25, 0.9);
        }
        if (st.elem === 'electric' && (st.mode !== 'dive' || k < 0.5)) {
            const n4 = acc(st, 'zap', dt, 16);
            for (let i = 0; i < n4; i++) {
                const a = rnd(0, TAU);
                zap(cx(), cy(), cx() + Math.cos(a) * U * 0.8, cy() + Math.sin(a) * U * 0.6, S, ac[2], 0.1, 1);
            }
        }
        if (st.elem === 'water') {
            const n5 = acc(st, 'orb', dt, 55);
            for (let i = 0; i < n5 && roomFor(); i++) {
                const a0 = rnd(0, TAU);
                const r = Math.max(w, U * 0.7) * rnd(0.5, 0.75);
                sigParticle({ x: pp.x, y: pp.y, s: S, max: rnd(0.45, 0.7), a0, r, color: pick(ac), size: pick([1, 2]),
                    update: (q) => {
                        const a = q.a0 + q.life * 11;
                        q.x = st.pp.x + Math.cos(a) * q.r;
                        q.y = st.pp.y - q.life * U * 1.4 + Math.sin(a) * q.r * 0.3;
                    },
                    draw: DRAW.dot });
            }
        }
        if (st.mode === 'dive' && k >= 0.5 && once(st, 'leap')) {
            diveLeap(D, X);
        }
    }

    // 다이브 — 솟구침: 번쩍 · 발밑 충격파 · 먼지 · 남는 빛 기둥
    function diveLeap(D, X) {
        const st = X.st;
        const pp = st.pp;
        const S = X.S;
        const ac = st.ac;
        const U = st.U;
        const G = D.ground;
        const h = pp.bh * pp.sc;
        const hx = pp.home.x;
        screenFlash(S, 0.28, '#ffffff', 0.16);
        groundRing(hx, G, S, U * 2, [ac[0], '#ffffff', ac[2]], 0.45);
        sigRing(hx, pp.home.y - h * 0.5, S, 4, U * 1.2, 1, 0.3, ['#ffffff', ac[1]]);
        if (pp.home.y >= G - 4) {
            dust(hx, G, S, 12, 90, 0, 1.4);
            debris(hx, G - S, S, [...ROCK, ac[2]], 10 + Math.round(8 * st.K), 230, G);
        }
        ultShake(2.5, 250);
        part({ x: hx, y: 0, s: S, max: 0.6, draw: (ctx, q, t, px) => {
            const hw = Math.max(pp.bw * st.SC, U * 0.5) * 0.5 * (1 - t);
            ctx.globalAlpha = 0.6 * (1 - t);
            ctx.fillStyle = ac[1];
            ctx.fillRect(px(hx - hw), 0, Math.max(S, px(2 * hw)), pp.home.y);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(px(hx - hw * 0.35), 0, Math.max(S, px(0.7 * hw)), pp.home.y);
        } });
    }
    // 잠만보 — 앞머리 땅에 쿵
    function heavyLand(D, X, x) {
        const st = X.st;
        const S = X.S;
        const ac = st.ac;
        const G = D.ground;
        const size = st.U * 1.2;
        st.thud = 1;
        screenFlash(S, 0.35, '#ffffff', 0.2);
        ultShake(6, 500);
        groundWave(x, G - S, S, ac, D.W * 0.55, 0.8);
        crater(x, G - S, S, ac, size * 0.7, 1.2);
        dust(x, G, S, 20, 140, 0, 1.6);
        debris(x, G - S * 2, S, [...ROCK, ...ac.slice(1)], 30, 380, G);
    }
    // ② 박차고 나감 (돌진 · 연타) — 번쩍 · 뒤로 튀는 흙 · 고리
    function rushLaunch(D, X) {
        const st = X.st;
        const pp = st.pp;
        const S = X.S;
        const dir = X.dir;
        const ac = st.ac;
        const h = pp.bh * pp.sc;
        const w = pp.bw * pp.sc;
        const G = D.ground;
        screenFlash(S, 0.25, '#ffffff', 0.14);
        sigRing(pp.home.x, pp.home.y - h * 0.5, S, 4, st.U * 1.3, 1, 0.3, [ac[0], '#ffffff']);
        if (pp.home.y >= G - 4) {
            debris(pp.home.x - dir * w * 0.2, G - S, S, [...ROCK, ac[2]], 12 + Math.round(8 * st.K), 260, G, -dir * 0.7);
            dust(pp.home.x - dir * w * 0.3, G, S, 10, 70, -dir, 1.5);
        }
        ultShake(2.5, 220);
    }
    // 제자리에 내려앉음 — 먼지 · 고리, 진짜 그림으로
    function rushLand(D, X) {
        const st = X.st;
        const pp = st.pp;
        const S = X.S;
        if (st.gone) {
            return;
        }
        st.gone = true;
        release(X);
        if (pp.home.y >= D.ground - 4) {
            dust(pp.home.x, D.ground, S, 6, 40, X.dir * 0.5);
        }
        groundRing(pp.home.x, D.ground, S, st.U * 0.8, [st.ac[1], '#ffffff'], 0.3);
    }

    // 매 프레임 입자 — 나가기 · 밀기 · 뚫고 나가기
    function rushTick(D, X, dt) {
        const st = X.st;
        const pp = st.pp;
        if (st.gone || !pp) {
            return;
        }
        const S = X.S;
        const dir = X.dir;
        const T = D.t;
        const ph = D.phase;
        const K = st.K;
        const w = pp.bw * pp.sc;
        const h = pp.bh * pp.sc;
        const ac = st.ac;
        const G = D.ground;
        const onGround = pp.y >= G - 4;
        const won = D.winner === X;
        const f = progress(D, X);
        const moving = (ph === 'go' && f < 1) || (ph === 'through' && won);
        const pushing = ph === 'push' || (ph === 'go' && f >= 1);
        const pr = st.pr;
        const cy = pp.y - h * 0.5;
        const bx = pp.x - dir * w * 0.35;
        if (ph === 'go' && st.mode !== 'dive' && once(st, 'go')) {
            rushLaunch(D, X);
        }
        if (st.mode === 'dive') {
            if (!pp.show) {
                return;
            }
            const n = acc(st, 'd', dt, moving ? 150 : pushing ? 40 + 70 * Math.max(0, pr) : 0);
            for (let i = 0; i < n && roomFor(); i++) {
                const x = pp.x + rnd(-0.5, 0.5) * w;
                const y = pp.y - rnd(0, 1) * h;
                if (st.elem === 'fire') {
                    sigParticle({ x, y, s: S, vx: rnd(-30, 30), vy: -rnd(20, 80), g: -60, drag: 1.5, max: rnd(0.35, 0.65), cols: ac, grow: 3 + 2 * K, smoke: 1, draw: DRAW.stream });
                } else {
                    sigParticle({ x, y, s: S, vx: rnd(-40, 40), vy: -rnd(30, 90), drag: 2, max: rnd(0.3, 0.5), cols: [ac[0], '#ffffff', ac[2]], draw: DRAW.sparkle });
                }
            }
            if (!st.heavy && pushing && once(st, 'arrive')) {
                // 내리꽂혀 맞부딪힘 — 머리에서 고리 · 반짝
                sigRing(pp.x + dir * w * 0.3, cy, S, 4, st.U * 1.1, 1, 0.3, ['#ffffff', ac[1]]);
                sigBurst(pp.x + dir * w * 0.3, cy, S, ['#ffffff', ...ac], 14, 120);
            }
            if (st.heavy && pushing && onGround) {
                const m = acc(st, 'skid', dt, 6 + 16 * Math.abs(pr));
                if (m) {
                    dust(pp.x - dir * w * 0.3, G, S, m, 40, -dir * 0.6);
                }
            }
            if (st.elem === 'electric' && pushing && acc(st, 'ez', dt, 5)) {
                zap(pp.x, cy, X.front, D.ym + rnd(-0.6, 0.6) * D.lane, S, ac[2], 0.14, 1);
            }
            return;
        }
        if (st.mode === 'barrage') {
            if (moving) {
                const n = acc(st, 'b', dt, 160);
                for (let i = 0; i < n && roomFor(); i++) {
                    speedBit(bx, pp.y - rnd(0.1, 0.9) * h, S, dir, st.cols.slice(0, 3));
                }
            }
            if (ph === 'push' && T >= st.nextHit) {
                strikeAt(D, X);
                st.nextHit = T + (pr < -0.3 ? 0.13 : 0.075 - 0.03 * Math.max(0, pr)) * (1.15 - 0.3 * K);
            }
            return;
        }
        // 돌진 — 몸 뒤로 튀는 것 (불 · 번개 · 물 · 속도선)
        const n = acc(st, 'r', dt, moving ? 170 + 80 * K : pushing ? 35 + 110 * Math.max(0, pr) + 40 * st.surge : 0);
        for (let i = 0; i < n && roomFor(); i++) {
            if (onGround && Math.random() < (moving ? 0.5 : 0.3)) {
                sigParticle({ x: bx, y: G - S * 2, s: S, vx: -dir * rnd(60, 240), vy: -rnd(30, 180), g: 440, drag: 1.2, max: rnd(0.25, 0.5), color: pick(['#ffffff', st.hot[1], st.hot[2], ac[1]]), draw: streak });
            }
            if (st.elem === 'fire') {
                sigParticle({ x: bx, y: pp.y - rnd(0.1, 0.9) * h, s: S, vx: -dir * rnd(20, 90), vy: rnd(-50, 0), g: -60, drag: 2, max: rnd(0.35, 0.65), cols: ac, grow: 3 + 2 * K, smoke: 1, draw: DRAW.stream });
            } else if (st.elem === 'electric') {
                if (Math.random() < 0.15) {
                    const y0 = pp.y - h * rnd(0.2, 0.8);
                    zap(pp.x, y0, pp.x - dir * st.U * rnd(0.6, 1.5), y0 + rnd(-0.5, 0.5) * st.U, S, ac[2], 0.14, 1);
                }
                sigParticle({ x: bx, y: pp.y - rnd(0.1, 0.9) * h, s: S, vx: -dir * rnd(30, 120), vy: rnd(-60, 60), drag: 3, max: 0.25, color: pick(ac), draw: DRAW.dot });
            } else if (st.elem === 'water') {
                sigParticle({ x: bx, y: pp.y - rnd(0.2, 0.7) * h, s: S, vx: -dir * rnd(100, 260), vy: rnd(-110, 10), g: 520, drag: 0.4, max: rnd(0.35, 0.7), color: pick(ac), size: pick([1, 2, 2]), draw: streak });
            } else {
                speedBit(bx, pp.y - rnd(0.1, 0.9) * Math.max(h, st.U * 0.7), S, dir, ac.slice(0, 3), 140);
            }
        }
        if (pushing) {
            // 앞머리에서 — 드릴 불꽃 · 물보라 · 번개 · 불똥
            const m = acc(st, 'f', dt, st.drill ? 80 + 90 * Math.max(0, pr) : st.elem ? 20 + 30 * Math.max(0, pr) : 0);
            for (let i = 0; i < m && roomFor(); i++) {
                const y = cy + rnd(-0.35, 0.35) * h;
                const x = X.front - dir * D.lane * rnd(0.6, 1.1);
                if (st.drill) {
                    sigParticle({ x, y, s: S, vx: -dir * rnd(80, 320), vy: rnd(-300, 60), g: 520, drag: 0.8, max: rnd(0.3, 0.55), color: pick(['#ffffff', '#fff6b3', '#ffc93c', st.cols[0]]), draw: streak });
                } else if (st.elem === 'water') {
                    sigParticle({ x, y, s: S, vx: -dir * rnd(60, 200), vy: -rnd(80, 260), g: 620, drag: 0.4, max: rnd(0.4, 0.7), color: pick(ac), size: pick([1, 2]), draw: streak });
                } else if (st.elem === 'fire') {
                    sigParticle({ x, y, s: S, vx: -dir * rnd(20, 80), vy: -rnd(20, 90), g: -50, drag: 1.8, max: rnd(0.35, 0.6), cols: ac, grow: 2 + 2 * K, smoke: 1, draw: DRAW.stream });
                } else if (st.elem === 'electric' && Math.random() < 0.3) {
                    zap(pp.x + dir * w * 0.3, cy, X.front, D.ym + rnd(-0.6, 0.6) * D.lane, S, ac[2], 0.12, 1);
                }
            }
            if (onGround && Math.abs(pr) > 0.2) {
                const k = acc(st, 'skid', dt, 14 * Math.abs(pr));
                if (k) {
                    dust(pp.x - dir * w * 0.35, G, S, k, 45, -dir * 0.7);
                }
            }
        }
    }

    // 연타 한 발 — 만나는 곳 이쪽 끝을 마구 때림 (주먹 · 베기 · 발차기 · 팽이) + 분신
    function strikeAt(D, X) {
        const st = X.st;
        const pp = st.pp;
        const S = X.S;
        const dir = X.dir;
        const cols = st.cols;
        const U = Math.max(D.lane * 2.2, pp.bh * pp.sc);
        const gs = Math.max(S, Math.round(U / 22));
        const w = pp.bw * pp.sc;
        const h = pp.bh * pp.sc;
        // 빛 덩어리 가장자리 (안쪽은 덩어리에 가려서)
        const a = rnd(-0.9, 0.9);
        const rr = blobR(D) * rnd(0.95, 1.15);
        const hx = D.xm - dir * Math.cos(a) * rr;
        const hy = clamp(D.ym + Math.sin(a) * rr * 0.9, 4 * S, D.ground - 3 * S);
        if (st.spin) {
            slashMark(hx, hy, S, cols, U * rnd(0.45, 0.7), a + Math.PI / 2 + rnd(-0.3, 0.3));
        } else if (st.strike === 'punch') {
            fistHit(hx, hy, S, cols, dir, gs);
        } else if (st.strike === 'slash') {
            slashMark(hx, hy, S, cols, U * rnd(0.5, 0.85), pick([0.7, -0.7, 0.35, -0.35, 1.2, -1.2]) + (Math.random() < 0.5 ? 0 : Math.PI));
        } else {
            kickArc(hx, hy, S, cols, U * 0.28, dir, Math.random() < 0.5, gs);
        }
        hitStar(hx, hy, S, ['#ffffff', cols[2], cols[3]], U * rnd(0.28, 0.42));
        for (let j = 0; j < 4 && roomFor(); j++) {
            const an = rnd(0, TAU);
            const sp = rnd(80, 220);
            sigParticle({ x: hx, y: hy, s: S, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp - 40, g: 300, drag: 2, max: rnd(0.2, 0.35), color: pick(['#ffffff', cols[1], cols[2], cols[3]]), draw: streak });
        }
        if (!st.spin && st.strike !== 'slash') {
            // 때린 궤적 — 주먹 · 발에서 맞은 자리까지
            const fx0 = pp.x + dir * w * 0.3;
            const fy0 = pp.y - h * rnd(0.35, 0.65);
            part({ x: fx0, y: fy0, s: S, max: 0.07, draw: (ctx, q, t, px) => {
                ctx.globalAlpha = 0.85 * (1 - t);
                dotLine(ctx, px, S, q.x, q.y, hx, hy, cols[2], 2);
                dotLine(ctx, px, S, q.x, q.y, hx, hy, '#ffffff', 1);
            } });
        }
        st.combo += 1;
        st.pop = 1;
        st.lunge = 1;
        // 분신 — 위아래 여기저기서 동시에 때리는 것처럼
        if (!st.spin && st.combo % 2 === 0) {
            const el = X.p.el;
            const sd = Math.random() < 0.5 ? -1 : 1;
            const cx = hx - dir * w * rnd(0.35, 0.6);
            const cyb = clamp(hy + sd * h * rnd(0.3, 0.6) + h * 0.5, h + S, D.ground);
            const col = pick([cols[2], cols[3], '#ffffff']);
            const { bw, bh } = pp;
            const sc = pp.sc;
            part({ x: cx, y: cyb, s: 1, max: 0.18, draw: (ctx, q, t) => {
                ctx.globalAlpha = 0.8 * (1 - t);
                drawSprite(ctx, silhouette(el, bw, bh, col), q.x, q.y, bw * sc, bh * sc, { flip: dir < 0 !== leftSrc(el), rot: dir * 0.2 });
            } });
        }
    }

    // 밀어붙이기 시작 (strong) — 오라가 확 · 발밑 고리 · 먼지 / 밀리기 시작 — 휘청 · 번쩍
    function rushPush(D, X, strong) {
        const st = X.st;
        const pp = st.pp;
        if (st.gone || !pp) {
            return;
        }
        const S = X.S;
        const dir = X.dir;
        const h = pp.bh * pp.sc;
        const w = pp.bw * pp.sc;
        const G = D.ground;
        if (strong) {
            st.surge = 1;
            if (pp.y >= G - 4) {
                groundRing(pp.x, G, S, st.U * 0.9, [st.ac[1], '#ffffff'], 0.35);
                dust(pp.x - dir * w * 0.4, G, S, 8, 60, -dir, 1.3);
            }
            if (st.heavy) {
                st.thud = 1;
                groundWave(pp.x, G - S, S, st.ac, D.W * 0.25, 0.5);
            }
            if (st.mode === 'dive' && !st.heavy) {
                sigRing(pp.x, pp.y - h * 0.5, S, 4, st.U, 1, 0.3, ['#ffffff', st.ac[1]]);
            }
        } else {
            st.recoil = 1;
            pp.flash = Math.max(pp.flash, 0.6);
            sigBurst(pp.x + dir * w * 0.4, pp.y - h * 0.5, S, ['#ffffff', st.ac[1], st.ac[2]], 8, 90);
        }
    }

    // 이김 — 진 쪽 몸에서 그 필살기 방식으로 쾅 (돌진: 들이받기 · 다이브: 내리꽂기 · 연타: 마지막 한 방)
    function rushWin(D, X, L) {
        const st = X.st;
        const pp = st.pp;
        const S = X.S;
        const dir = X.dir;
        const K = st.K;
        const ac = st.ac;
        const cols = st.cols;
        const G = D.ground;
        st.hitX = pp.x;
        st.hitY = pp.y;
        pp.flash = 1;
        const x = L.body.cx;
        const y = L.body.cy;
        const size = Math.max(D.lane * 2.2, L.h, pp.bh * pp.sc) * (0.9 + 0.5 * K);
        const lOnGround = L.body.bottom >= G - L.h * 0.3;
        if (st.mode === 'barrage') {
            // 마지막 한 방 — 큰 주먹 · X 베기 · 큰 발차기 + 앞으로 뻗는 충격파
            const gs = Math.max(S, Math.round(Math.max(D.lane * 2.2, pp.bh * pp.sc) / 22));
            bigBoom(x, y, S, ['#ffffff', ...cols.slice(0, 3)], size);
            if (st.spin || st.strike === 'slash') {
                const len = Math.max(L.h, D.lane * 1.5) * 2.6;
                slashMark(x, y, S, cols, len, 0.8, 0.55, 2);
                slashMark(x, y, S, cols, len, -0.8, 0.55, 2);
                if (st.spin) {
                    slashMark(x, y, S, cols, len * 1.1, Math.PI / 2, 0.55, 2);
                }
            } else if (st.strike === 'punch') {
                fistHit(x, y, S, cols, dir, gs * 2.5);
            } else {
                kickArc(x, y, S, cols, Math.max(L.h, D.lane * 1.5) * 1.3, dir, true, gs * 2.5);
            }
            part({ x, y, s: S, max: 0.55, draw: (ctx, q, t, px) => {
                ctx.globalAlpha = 1 - t;
                for (let j = 0; j < 3; j++) {
                    const r = D.lane * (1.2 + j * 0.7) + t * D.W * 0.35;
                    for (let a = -1; a <= 1; a += 0.08) {
                        dotAt(ctx, px, S, q.x + dir * Math.cos(a) * r, q.y + Math.sin(a) * r * 0.9, j === 1 ? '#ffffff' : cols[j], 1, 2);
                    }
                }
            } });
            if (lOnGround) {
                groundWave(x, G - S, S, cols, D.W * 0.4, 0.6);
            }
            return;
        }
        if (st.mode === 'dive') {
            // 내리꽂힘 — 충격파 여러 겹 · 팬 자리 · 땅 금 · 파편 · 빛 기둥
            const sz = size * (st.heavy ? 1.4 : 1.05);
            const bc = ['#ffffff', ...ac.slice(0, 3)];
            bigBoom(x, G - S * 3, S, bc, sz, { flat: 0.6 });
            crater(x, G - S, S, ac, sz * 0.7, 1.6);
            groundWave(x, G - S, S, ac, st.heavy ? D.W * 1.1 : D.W * 0.4 + sz, st.heavy ? 0.9 : 0.75);
            delay(st.heavy ? 0.24 : 0.14, () => groundWave(x, G - S, S, ac, (st.heavy ? D.W : D.W * 0.4 + sz) * 0.7, 0.65));
            cracks(x, G - S, S, ac, st.heavy ? 9 : 6, sz * (st.heavy ? 2.4 : 1.6), (i) => (i % 2 ? Math.PI : 0) + rnd(-0.35, 0.35), 0.22, 1.3);
            debris(x, G - S * 2, S, [...ROCK, ...ac.slice(1)], st.heavy ? 70 : 34 + Math.round(26 * K), st.heavy ? 460 : 390, G);
            dust(x, G, S, st.heavy ? 30 : 18, st.heavy ? 200 : 140, 0, 1.6);
            part({ x, y: 0, s: S, max: 0.42, draw: (ctx, q, t, px) => {
                const hw = Math.max(pp.bw * pp.sc, D.lane * 1.4) * 0.6 * (1 - t * 0.6);
                ctx.globalAlpha = 0.75 * (1 - t);
                ctx.fillStyle = ac[1];
                ctx.fillRect(px(x - hw), 0, px(2 * hw), G);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(px(x - hw * 0.4), 0, Math.max(S, px(0.8 * hw)), G);
            } });
            if (st.elem === 'fire') {
                fireBlast(x, y, S, sz, 46);
            } else if (st.elem === 'electric') {
                for (let i = 0; i < 3; i++) {
                    delay(i * 0.09, () => zap(x + rnd(-1, 1) * sz * 0.6, 0, x, G - S * 2, S, ac[2], 0.3, 2, 3));
                }
                for (let i = 0; i < 6; i++) {
                    const sgn = i % 2 ? -1 : 1;
                    zap(x, G - S * 2, x + sgn * sz * rnd(1, 2), G - S * 2 + rnd(-1, 1) * S * 3, S, ac[2], rnd(0.3, 0.5), 1, 2);
                }
            }
            return;
        }
        // 돌진 — 들이받아 쾅
        const bc = st.elem ? ['#ffffff', ...ac.slice(0, 3)] : ['#ffffff', ac[0], st.hot[1], st.hot[2]];
        bigBoom(x, y, S, bc, size);
        hitStar(x, y, S, ['#ffffff', ac[1], ac[2]], size * 0.6);
        cracks(x, y, S, ac, 6 + Math.round(3 * K), size * 1.3, (i, n) => (dir > 0 ? 0 : Math.PI) + (i / Math.max(1, n - 1) - 0.5) * 2.6, 1, 1.1);
        debris(x, y, S, [...ROCK, ...ac.slice(1), st.hot[1]], 22 + Math.round(20 * K), 360, G, dir * 0.6);
        if (lOnGround) {
            groundWave(x, G - S, S, ac, D.W * 0.45, 0.7);
            dust(x, G, S, 12, 80, dir * 0.6, 1.5);
        }
        if (st.elem === 'fire') {
            fireBlast(x, y, S, size, 40 + Math.round(20 * K));
        } else if (st.elem === 'electric') {
            for (let i = 0; i < 6 + Math.round(3 * K); i++) {
                const a = (dir > 0 ? 0 : Math.PI) + rnd(-1.3, 1.3);
                const len = size * rnd(1, 1.9);
                zap(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, S, ac[2], rnd(0.3, 0.5), 2, 2.5);
            }
        } else if (st.elem === 'water') {
            splashUp(x, y, S, 60, dir * 0.8, G, 1.1);
            sigRing(x, y, S, 4, size * 2, 1.2, 0.6, [ac[1], ac[2], '#ffffff']);
        }
        if (st.drill) {
            for (let i = 0; i < 26 && roomFor(); i++) {
                sigParticle({ x, y: y + rnd(-1, 1) * size * 0.3, s: S, vx: -dir * rnd(60, 300), vy: rnd(-320, 40), g: 520, drag: 0.8, max: rnd(0.3, 0.6), color: pick(['#ffffff', '#fff6b3', '#ffc93c', cols[0]]), draw: streak });
            }
        }
    }

    // ═════════════ swarm — 날리기 (ultswarm · ultsparkle twinkle) ═════════════
    const SWARM_C = { needle: 'bug', star: 'star', ball: 'ghost', rock: 'rock', leaf: 'grass', coin: 'gold', egg: 'egg', bone: 'bone', heart: 'fairy', shuriken: 'water' };
    const HEAVY_SHOT = { rock: 1, egg: 1, coin: 1, bone: 1 };
    function swarmSetup(D, X) {
        const st = X.st;
        const o = X.o;
        const twinkle = X.fx === 'ultsparkle';
        const giant = !twinkle && !!o.giant;
        let shape;
        let cols;
        if (twinkle) {
            shape = 'twinkle';
            cols = sigPal(o.c || 'fairy');
        } else if (giant) {
            shape = SHAPES[o.shape] && o.shape !== 'shuriken' ? o.shape : 'shuriken';
            cols = sigPal(o.c || SWARM_C[shape] || 'water');
        } else {
            shape = SHAPES[o.shape] || o.shape === 'shuriken' ? o.shape : 'star';
            cols = sigPal(o.c || SWARM_C[shape]);
        }
        const n = clamp(Math.round(o.n ?? 30 + 14 * (X.P || 0)), 6, 80);
        const pink = sigPal('fairy');
        Object.assign(st, {
            twinkle, giant, shape, cols, n, heavy: !!HEAVY_SHOT[shape],
            K: 0.4 + 0.6 * clamp(X.P || 0, 0, 1),
            cs: Math.max(X.S, Math.round(Math.min(D.W, D.H) / 75)),
            // 수 ×1.5 — 하트 · 별이 1 ~ 3개 점선이라 줄기로 안 읽히던 것 (#116 아트 2바퀴 ①)
            rate: (9 + n * 0.45) * 1.5, shots: [], pr: 0, muzzle: 0, recoil: 0, riddleUntil: -1,
            ox: X.x0, oy: clamp(X.mouth.y, D.H * 0.1, D.ground - 4 * X.S),
            R: Math.max(X.w, 24), per: clamp(Math.round(n / 5), 5, 12),
            pink, hearts: [pink[2], pink[3], '#ff7ab8', cols[2]], starCols: ['#ffffff', cols[0], cols[1], cols[2]],
        });
        if (giant) {
            const Dg = Math.max(X.S * 8, Math.min(D.lane * 3.4, 2 * (D.ground - D.ym) - 2 * X.S, 2 * D.ym - 4, D.W * 0.3));
            let gx0 = X.x0 + X.dir * Dg * 0.55;
            if ((gx0 + X.dir * Dg * 0.45 - D.mid) * X.dir > 0) {
                gx0 = D.mid - X.dir * Dg * 0.45;
            }
            Object.assign(st, { Dg, C: Math.max(X.S, Math.round(Dg / 26)), gx0, gpos: [gx0, D.ym], gang: 0, gsize: 0, ghist: [] });
        }
        scene(D, X, swarmStep, swarmPaint);
    }
    // 둘레에 하나씩 나타나 맴도는 자리 (모으기)
    const haloAt = (X, j, T) => {
        const st = X.st;
        const a = (j / st.per) * TAU + T * 4;
        return [X.body.cx + Math.cos(a) * st.R * 1.3, X.body.cy - X.h * 0.3 + Math.sin(a) * st.R * 0.7];
    };
    function swarmStep(D, X, dt) {
        const st = X.st;
        pressure(D, X, dt);
        st.muzzle = Math.max(0, st.muzzle - dt * 6);
        if (st.giant) {
            giantStep(D, X, dt);
        }
    }
    // 한 발 — 입 앞에서 앞머리(또는 진 쪽 몸)로
    function fire(D, X, from, target, speed) {
        const st = X.st;
        const S = X.S;
        const [sx, sy] = from || [st.ox + rnd(-1, 1) * S * 2, st.oy + rnd(-1, 1) * S * 2];
        const [tx, ty] = target;
        const dx = tx - sx;
        const v = speed ?? (st.heavy ? 560 : 760) * rnd(0.9, 1.1) * clamp(D.W / 640, 0.7, 1.4);
        const dist = Math.max(8, Math.abs(dx));
        const tf = dist / v;
        const g = st.heavy ? D.H * 1.5 : 0;
        const q = { x: sx, y: sy, vx: Math.sign(dx || X.dir) * v, vy: (ty - sy) / tf - 0.5 * g * tf, g, life: 0, trail: [], aim: !!target.aim, tx, depth: rnd(-0.25, 0.1) * D.lane, ph: rnd(0, TAU) };
        if (st.twinkle) {
            q.tw = Math.random() < 0.5 ? 'heart' : 'star';
            q.color = pick(st.hearts);
        }
        st.shots.push(q);
        st.muzzle = 1;
    }
    function swarmTick(D, X, dt) {
        const st = X.st;
        CUT = D.ground;
        if (st.giant) {
            giantTick(D, X, dt);
            return;
        }
        const ph = D.phase;
        const dir = X.dir;
        const S = X.S;
        const T = D.t;
        const won = D.winner === X;
        const L = D.loser;
        const f = progress(D, X);
        const ride = ph === 'go' && f < 1;
        const lane = D.lane;
        // 첫 물결 — 둘레를 맴돌던 것들이 앞머리를 타고 감
        if (ph === 'go' && once(st, 'go')) {
            for (let j = 0; j < st.per; j++) {
                const [hx, hy] = haloAt(X, j, T);
                fire(D, X, [(hx - X.x0) * dir > 0 ? X.x0 - dir * j * S : hx, hy], [X.x0 + dir * D.half, D.ym + rnd(-0.6, 0.6) * lane], DUEL_SPEED.swarm * (1 - j * 0.03));
            }
            screenFlash(S, 0.16, st.cols[0], 0.14);
            sigRing(st.ox, st.oy, S, S * 2, st.R * 1.6, 0.8, 0.3, ['#ffffff', st.cols[1]]);
            recoil(X, 3);
        }
        let rate = 0;
        let aimL = false;
        if (ph === 'go') {
            rate = st.rate * 0.8;
        } else if (ph === 'push') {
            rate = st.rate * (1 + 0.8 * Math.max(0, st.pr) - 0.45 * Math.max(0, -st.pr));
        } else if (ph === 'through' && won) {
            // 진 쪽을 겨누는 수는 ×1.5 전 그대로 (모여서 덩어리가 되던 것 — #116 아트 3바퀴 ⑤)
            rate = (st.rate / 1.5) * 2.2;
            aimL = true;
            if (once(st, 'thr')) {
                for (let j = 0; j < 8; j++) {
                    fire(D, X, null, Object.assign([L.body.cx, L.body.cy + rnd(-0.45, 0.45) * L.h], { aim: true }));
                }
                recoil(X, 4);
            }
        } else if (ph === 'after' && won && T < st.riddleUntil) {
            rate = (st.rate / 1.5) * 1.6;
            aimL = true;
        }
        const n = acc(st, 'shot', dt, rate);
        for (let i = 0; i < n && st.shots.length < 90; i++) {
            if (aimL) {
                const r = L.p.collision.getBoundingClientRect();
                const tx = r.width ? r.left + r.width / 2 : L.body.cx;
                const ty = r.width ? r.top + r.height * rnd(0.25, 0.75) : L.body.cy;
                fire(D, X, null, Object.assign([tx, ty], { aim: true }));
            } else {
                fire(D, X, null, [X.front, D.ym + rnd(-0.6, 0.6) * lane]);
            }
        }
        // 움직이기 — 앞머리(밀고 밀릴 땐 빛 덩어리 가장자리)를 넘으면 톡, 나가는 동안엔 앞머리를 타고 감
        const G = D.ground;
        const edge = impactX(D, X);
        for (let i = st.shots.length - 1; i >= 0; i--) {
            const q = st.shots[i];
            q.life += dt;
            q.vy += q.g * dt;
            q.x += q.vx * dt;
            q.y += q.vy * dt;
            let gone = false;
            if (!q.aim) {
                const hitX = edge + dir * q.depth;
                const ahead = (q.x - hitX) * dir;
                if (ride && ahead > 0) {
                    q.x = hitX;
                } else if (!ride && ahead >= 0) {
                    shotPop(D, X, hitX, q.y, Math.random() < 0.12);
                    gone = true;
                }
            } else if ((q.x - q.tx) * dir >= 0) {
                shotPop(D, X, q.x, q.y, Math.random() < 0.35);
                gone = true;
            }
            if (!gone && q.y >= G - st.cs && q.vy > 0) {
                shotPop(D, X, q.x, G - st.cs, false);
                gone = true;
            }
            if (gone || q.life > 3 || q.x < -60 || q.x > D.W + 60) {
                st.shots.splice(i, 1);
                continue;
            }
            q.trail.unshift([q.x, q.y]);
            if (q.trail.length > 8) {
                q.trail.length = 8;
            }
        }
    }
    // 쏠 때 몸이 뒤로 살짝 (보이는 그림만 — 끝나면 원래대로)
    function recoil(X, k) {
        try {
            X.p.el.animate([{ translate: `${-X.dir * k * (X.s || 1)}px 0` }, { translate: '0 0' }], { duration: 200, easing: 'ease-out', composite: 'add' });
        } catch (e) {
            // 그림이 없어졌어도 계속
        }
    }
    // 앞머리에서 톡 — 별 모양 번쩍 + 조각 (twinkle 은 반짝 별 · 하트)
    function shotPop(D, X, x, y, big) {
        const st = X.st;
        const S = X.S;
        const cols = st.cols;
        if (!roomFor(5)) {
            return;
        }
        if (st.twinkle) {
            part({ x, y, s: S, max: big ? 0.5 : 0.34, r: big ? 4 : 2, draw: (ctx, p, t, px) => {
                ctx.globalAlpha = 1;
                drawStar(ctx, px, S, p.x, p.y, Math.round(p.r * Math.sin(Math.PI * t)), st.starCols);
            } });
            if (big || Math.random() < 0.3) {
                sigParticle({ x, y, s: S, vx: rnd(-20, 20), vy: -rnd(20, 60), max: rnd(0.6, 1), color: pick(st.hearts), ph: rnd(0, TAU), draw: heartDraw });
            }
            return;
        }
        part({ x, y, s: S, max: big ? 0.32 : 0.22, draw: (ctx, p, t, px) => {
            const len = Math.round(2 + t * (big ? 9 : 5));
            ctx.globalAlpha = 1 - t * t;
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * TAU;
                for (let k = Math.round(t * 3) + 1; k <= len; k++) {
                    dotAt(ctx, px, S, p.x + Math.cos(a) * k * S, p.y + Math.sin(a) * k * S, k === len ? '#ffffff' : cols[2]);
                }
            }
            const r = Math.round(1 + t * (big ? 3 : 2));
            dotAt(ctx, px, S, p.x - r * S, p.y - r * S, '#ffffff', 2 * r + 1, 2 * r + 1);
        } });
        const m = big ? 6 : 2;
        for (let i = 0; i < m && roomFor(); i++) {
            const a = rnd(-Math.PI * 0.95, -Math.PI * 0.05);
            const sp = rnd(60, 200);
            sigParticle({ x, y, s: S, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 500, drag: 0.6, max: rnd(0.35, 0.7), color: pick(cols), size: pick([1, 1, 2]), ground: D.ground,
                update: (p) => {
                    if (p.y > p.ground - p.s && p.vy > 0) {
                        p.life = p.max;
                    }
                },
                draw: DRAW.dot });
        }
    }
    // 날리는 것들 · 먼 것들 · 앞머리 번쩍 (맨 밑 층)
    function swarmDraw(ctx, px, D, X) {
        const st = X.st;
        const S = X.S;
        const T = D.t;
        const F = X.fade;
        const dir = X.dir;
        const lane = D.lane;
        const cols = st.cols;
        const ph = D.phase;
        if (st.giant) {
            giantBack(ctx, px, D, X);
            return;
        }
        const live = ph === 'go' || ph === 'push' || (ph === 'through' && D.winner === X);
        const dist = (X.front - st.ox) * dir;
        // 줄기 몸 — 입 ~ 앞머리 밑에 그 색 (cols[2]) 바둑판 띠 · 높이 = 반 굵기 × 1.2 · 25%, 앞머리 쪽 1/3 은 50% (#108 B 문법 — 한 색 면 없이)
        //   (하트 · 별 점선만이라 상대 줄기에 몸이 없어 한쪽 공격으로 읽히던 것 — #116 아트 2바퀴 ①)
        //   띠 안 밝은 (cols[1]) 3칸 줄이 12칸마다 · 0.05초마다 2칸 앞으로 · 위아래 끝은 0.15초마다 1칸 들쭉날쭉 (멈춘 방충망처럼 보이던 것 — #116 아트 3바퀴 ③)
        //   뚫고 나가는 동안 (through) 은 25% 만 — 진 쪽에 닿은 앞머리가 네모 덩어리로 보이던 것 (#116 아트 3바퀴 ⑤)
        if (live && dist > S * 6) {
            const k = S;
            const ex = impactX(D, X);
            const n = Math.max(1, Math.floor(((ex - st.ox) * dir) / k));
            const hh = lane * 0.6;
            const flow = Math.floor(T / 0.05) * 2;
            const jt = Math.floor(T / 0.15);
            const thr = ph === 'through';
            ctx.globalAlpha = F;
            for (let i = 0; i <= n; i++) {
                const f = i / n;
                const gx = Math.round((st.ox + dir * i * k) / k);
                const cy = lerp(st.oy, D.ym, f);
                const dense = f >= 2 / 3 && !thr;
                const g0 = Math.round((cy - hh) / k) + (hash(i, jt) < 0.5 ? 1 : 0);
                const g1 = Math.round((cy + hh) / k) - (hash(i, jt + 7) < 0.5 ? 1 : 0);
                const gm = Math.round(cy / k);
                const lit = (((i - flow) % 12) + 12) % 12 < 3;
                const lit2 = (((i - flow + 6) % 12) + 12) % 12 < 3;
                for (let gy = g0; gy <= g1; gy++) {
                    const line = (lit && gy === gm - 2) || (lit2 && gy === gm + 2);
                    const on = line || (dense ? (((gx + gy) % 2) + 2) % 2 === 0 : ((gx % 2) + 2) % 2 === 0 && ((gy % 2) + 2) % 2 === 0);
                    if (on) {
                        ctx.fillStyle = line ? cols[1] : cols[2];
                        ctx.fillRect(px(gx * k), px(gy * k), k, k);
                    }
                }
            }
        }
        // 먼 것들 — 작고 옅은 것들이 앞머리까지 끝없이 (입자 없이 계산)
        if (live && dist > S * 6) {
            const m = 27;
            for (let j = 0; j < m; j++) {
                const cyc = 0.4 + 0.25 * hash(j, 1);
                const tt = T + hash(j, 2) * 3;
                const k = (tt % cyc) / cyc;
                const seed = Math.floor(tt / cyc) * 13 + j;
                const dy = (hash(seed, 3) * 2 - 1) * lane * 1.15;
                const x = st.ox + dir * dist * k;
                const y = lerp(st.oy, D.ym + dy, k) - Math.sin(Math.PI * k) * lane * 0.5 * (hash(seed, 4) - 0.3);
                ctx.globalAlpha = 0.45 * F * (1 - k * 0.4);
                const q = { x, y, vx: dir, vy: 0, life: tt };
                if (st.twinkle) {
                    if (j % 2) {
                        drawStar(ctx, px, S, x, y, 1, st.starCols, Math.floor(tt / 0.07) % 2 === 1);
                    } else {
                        drawHeart(ctx, px, S, x, y, false, st.hearts[j % 4]);
                    }
                } else {
                    drawShot(ctx, st.shape, q, S, cols);
                }
            }
        }
        // 날리는 것들 — 꼬리 + 모양
        const cs = st.cs;
        const pxc = (v) => Math.round(v / cs) * cs;
        const hc = cs * 7 > 24 ? Math.max(S, S * Math.floor(24 / (7 * S))) : cs;
        const pxh = (v) => Math.round(v / hc) * hc;
        // 바늘은 긴 꼬리, 나머지는 짧고 옅게 (하나하나 보이게) · 잎 · 하트는 팔랑팔랑
        const longTail = st.shape === 'needle';
        const flutter = st.twinkle || st.shape === 'leaf' || st.shape === 'heart';
        for (const q of st.shots) {
            if (q.trail.length > 2) {
                const pts = q.trail.slice(1, longTail ? 8 : 4);
                fillPts(ctx, pxc, cs, pts, 1, st.twinkle ? st.pink[1] : cols[1], (longTail ? 0.35 : 0.22) * F);
                if (longTail) {
                    fillPts(ctx, pxc, cs, pts.slice(0, 4), 1, cols[0], 0.5 * F);
                }
            }
            const qy = q.y;
            if (flutter) {
                q.y += Math.sin(q.life * 16 + q.ph) * cs * 1.2;
            }
            if (st.twinkle || st.shape === 'star' || st.shape === 'heart' || st.shape === 'coin') {
                const [x, y] = q.trail[5] || [q.x, q.y];
                ctx.globalAlpha = 0.9 * F;
                dotAt(ctx, px, S, x + rnd(-2, 2) * S, y + rnd(-2, 2) * S, '#ffffff');
            }
            ctx.globalAlpha = F;
            if (st.twinkle) {
                if (q.tw === 'heart') {
                    // 큰 하트 7×6칸 (칸 크기는 그대로 — 5×5 가 점처럼 보이던 것, #116 아트 2바퀴 ①) · 너비 24px 까지 (높은 패널 칸 6px 이면 42px 한 색 덩어리 — 3바퀴 ④)
                    drawHeart(ctx, pxh, hc, q.x, q.y, true, q.color, '#ffffff');
                } else {
                    // 진 쪽을 겨눈 별은 + 모양만 (× 로 깜빡이는 별이 모여 흰 바둑판 덩어리 — 3바퀴 ⑤)
                    drawStar(ctx, pxc, cs, q.x, q.y, 2, st.starCols, !q.aim && Math.floor(q.life / 0.07) % 2 === 1);
                }
            } else {
                drawShot(ctx, st.shape, q, cs, cols);
            }
            q.y = qy;
        }
        // 앞머리 — 맞는 자리가 반짝반짝
        if (live && dist > S * 4) {
            const tick = Math.floor(T * 30);
            const ex = impactX(D, X);
            for (let j = 0; j < 9; j++) {
                const y = D.ym + (hash(j, tick) * 2 - 1) * lane * 0.9;
                const x = ex - dir * S * Math.round(hash(j, tick + 7) * 4);
                ctx.globalAlpha = F * (0.5 + 0.5 * hash(j, tick + 3));
                dotAt(ctx, px, S, x - S / 2, y - S / 2, j % 2 ? '#ffffff' : st.twinkle ? st.pink[1] : cols[0], hash(j, tick + 5) < 0.3 ? 2 : 1, 1);
            }
        }
        // 입 앞 번쩍
        if (st.muzzle > 0.05 && live) {
            ctx.globalAlpha = F * st.muzzle;
            star4(ctx, px, S, st.ox, st.oy, S * 2 + S * 2 * st.muzzle, '#ffffff', st.twinkle ? st.pink[1] : cols[1]);
        }
    }
    // 장면 — 모으기 때 둘레에 하나씩 나타나 맴돎 · twinkle 은 내내 도는 별 · 거대한 것
    function swarmPaint(ctx, px, D, X) {
        const st = X.st;
        const S = X.S;
        const T = D.t;
        const F = X.fade;
        const cols = st.cols;
        if (st.giant) {
            giantPaint(ctx, px, D, X);
            return;
        }
        if (D.phase === 'charge') {
            const kc = k01(T / DUEL_CHARGE);
            for (let j = 0; j < st.per; j++) {
                const k = clamp(kc * st.per * 1.3 - j, 0, 1);
                if (k <= 0) {
                    continue;
                }
                const [x, y] = haloAt(X, j, T);
                ctx.globalAlpha = k;
                const q = { x, y, vx: Math.cos((j / st.per) * TAU) || X.dir, vy: Math.sin((j / st.per) * TAU), life: T + j * 0.03 };
                if (st.twinkle) {
                    if (j % 2) {
                        drawStar(ctx, (v) => Math.round(v / st.cs) * st.cs, st.cs, x, y, 2, st.starCols, Math.floor(T / 0.07) % 2 === 1);
                    } else {
                        drawHeart(ctx, (v) => Math.round(v / st.cs) * st.cs, st.cs, x, y, false, st.hearts[j % 4], '#ffffff');
                    }
                } else {
                    drawShot(ctx, st.shape, q, st.cs, cols);
                }
            }
            ringDots(ctx, px, S, X.body.cx, X.body.cy - X.h * 0.3, st.R * (1.9 - 0.5 * kc), 0.6, [cols[1], '#ffffff'], 0.7 * kc, 1);
        }
        if (st.twinkle && F > 0.02) {
            // 쓰는 애 둘레를 도는 별
            const cx = X.body.cx;
            const cy = X.body.cy;
            const rr = Math.max(X.w, X.h) * 0.75 + 2 * S;
            ctx.globalAlpha = F * Math.min(1, T / 0.3);
            for (let j = 0; j < 8; j++) {
                const a = T * 4 + (j * TAU) / 8;
                drawStar(ctx, px, S, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.8, Math.sin(T * 12 + j) > 0 ? 2 : 1, j % 2 ? st.starCols : ['#ffffff', st.pink[1], st.pink[2], st.pink[3]]);
            }
        }
    }
    function swarmCharge(D, X, k, dt) {
        const st = X.st;
        const S = X.S;
        if (st.giant) {
            // 물(색)이 소용돌이치며 모여 거대한 것이 커짐
            const n = acc(st, 'g', dt, k < 0.85 ? 140 : 0);
            for (let i = 0; i < n && roomFor(); i++) {
                const a0 = rnd(0, TAU);
                const r0 = st.Dg * rnd(0.8, 1.3);
                const [sx, sy] = st.gpos;
                sigParticle({ x: sx, y: sy, s: S, max: rnd(0.3, 0.4), a0, r0, color: pick(st.cols),
                    update: (p) => {
                        const kk = p.life / p.max;
                        const a = p.a0 + kk * 5 * X.dir;
                        const r = p.r0 * (1 - kk);
                        p.x = sx + Math.cos(a) * r;
                        p.y = sy + Math.sin(a) * r * 0.8;
                    },
                    draw: DRAW.dot });
            }
            return;
        }
        if (st.twinkle) {
            // 하트 · 별이 피어남
            const n = acc(st, 'tw', dt, 26);
            for (let i = 0; i < n && roomFor(); i++) {
                const x = X.body.cx + rnd(-1, 1) * st.R * 2;
                const y = X.body.cy + rnd(-1.2, 0.4) * st.R * 1.2;
                if (Math.random() < 0.4) {
                    sigParticle({ x, y, s: S, vx: rnd(-6, 6), vy: -rnd(10, 30), max: rnd(0.6, 1.1), color: pick(st.hearts), ph: rnd(0, TAU), draw: heartDraw });
                } else {
                    part({ x, y, s: S, max: rnd(0.4, 0.8), r: pick([1, 2, 2, 3]), draw: (ctx, p, t, px) => {
                        drawStar(ctx, px, S, p.x, p.y, Math.round(p.r * Math.sin(Math.PI * t)), st.starCols);
                    } });
                }
            }
        }
    }
    function swarmPush(D, X, strong) {
        const st = X.st;
        CUT = D.ground;
        if (st.giant) {
            if (strong) {
                sigRing(st.gpos[0], st.gpos[1], X.S, st.Dg * 0.3, st.Dg * 1.1, 0.8, 0.35, ['#ffffff', st.cols[1]]);
            }
            return;
        }
        if (strong) {
            // 한꺼번에 한 줌 — 번쩍 · 몸이 뒤로
            for (let j = 0; j < 6; j++) {
                fire(D, X, null, [X.front, D.ym + rnd(-0.7, 0.7) * D.lane]);
            }
            sigRing(st.ox, st.oy, X.S, X.S * 2, st.R * 1.5, 0.8, 0.3, ['#ffffff', st.cols[1]]);
            recoil(X, 4);
        } else {
            recoil(X, 2);
        }
    }
    function swarmWin(D, X, L) {
        const st = X.st;
        const S = X.S;
        const cols = st.cols;
        const x = L.body.cx;
        const y = L.body.cy;
        st.riddleUntil = D.t + 0.45;
        if (st.giant) {
            // 베고 지나감 — 큰 X 자국
            const len = Math.max(L.w, L.h, st.Dg) * 1.2 + 6 * S;
            part({ x, y, s: S, max: 0.5, draw: (ctx, p, t, px) => {
                const shown = Math.min(1, p.life / 0.06);
                ctx.globalAlpha = t > 0.5 ? (1 - t) / 0.5 : 1;
                for (const sg of [1, -1]) {
                    for (let d = -len / 2; d < -len / 2 + len * shown; d += S) {
                        dotAt(ctx, px, S, x + d, y + sg * d * 0.7, '#ffffff', 1, 1);
                        dotAt(ctx, px, S, x + d, y + sg * d * 0.7 + S, cols[2], 1, 1);
                    }
                }
            } });
            debris(x, y, S, cols, 18, 360, D.ground);
            sigRing(x, y, S, S * 2, L.w * 1.8 + st.Dg * 0.5, 0.8, 0.4, ['#ffffff', cols[1]]);
            return;
        }
        if (st.twinkle) {
            // 반짝이며 박치기 — 큰 별이 사방으로 · 하트 터짐 · 하트 고리 · 큰 반짝
            const pink = st.pink;
            sigImpact(x, y, S, ['#ffffff', pink[1], pink[2], cols[2]], 1, true);
            for (let i = 0; i < 14 && roomFor(); i++) {
                const a = (i / 14) * TAU + rnd(-0.2, 0.2);
                const sp = rnd(140, 320);
                part({ x, y, s: S * 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 2.4, max: rnd(0.6, 0.95), draw: (ctx, p, t, px) => {
                    ctx.globalAlpha = fadeInOut(t, 0.04, 0.35);
                    // + 모양 그대로 크기만 반짝 (× 로 바뀌는 큰 별 14개가 진 쪽에 모여 흰 바둑판 덩어리 — #116 아트 3바퀴 ⑤)
                    drawStar(ctx, px, p.s, p.x, p.y, Math.floor(p.life / 0.07) % 2 === 1 ? 1 : 2, st.starCols);
                } });
            }
            for (let i = 0; i < 10 && roomFor(); i++) {
                const a = rnd(0, TAU);
                const sp = rnd(60, 180);
                sigParticle({ x, y, s: S, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, drag: 2, max: rnd(0.8, 1.3), color: pick(st.hearts), ph: rnd(0, TAU), draw: heartDraw });
            }
            const R = Math.max(L.w, 30);
            part({ x, y, s: S, max: 0.45, draw: (ctx, p, t, px) => bigSparkle(ctx, px, S, p.x, p.y, R * 1.8 * Math.sin(Math.PI * t), '#ffffff', pink[1], 4) });
            part({ x, y, s: S, max: 0.7, draw: (ctx, p, t, px) => {
                const sc = 4 * S + (R * 2.2 - 4 * S) * easeOut(t);
                ctx.globalAlpha = 1 - t;
                const n = clamp(Math.round((sc / S) * 4), 24, 200);
                for (let j = 0; j < n; j++) {
                    const a = (j / n) * TAU;
                    const hx = 16 * Math.sin(a) ** 3;
                    const hy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
                    dotAt(ctx, px, S, p.x + (hx / 16) * sc, p.y + (hy / 16) * sc, ['#ffffff', pink[1], pink[2]][j % 3], 2, 2);
                }
            } });
            return;
        }
        // 마구 박힘 — 여기저기 번쩍 · 조각 · 고리
        for (let i = 0; i < 6; i++) {
            const bx = x + rnd(-0.5, 0.5) * L.w;
            const by = y + rnd(-0.5, 0.5) * L.h;
            delay(i * 0.05, () => shotPop(D, X, bx, by, i < 3));
        }
        sigRing(x, y, S, S * 2, Math.max(L.w, 24) * 2, 0.8, 0.45, ['#ffffff', cols[1]]);
        debris(x, y, S, cols, 14, 300, D.ground);
    }

    // ── 거대한 것 하나 (giant — 거대 물수리검) ──
    function giantDrawAt(ctx, X, x, y, size, ang, alpha, life) {
        const st = X.st;
        if (st.shape === 'shuriken' || st.shape === 'star') {
            drawBigShuriken(ctx, x, y, size, st.C, ang, st.cols, alpha, st.shape === 'star');
            return;
        }
        const cell = Math.max(X.S, Math.round(size / 6 / X.S) * X.S);
        const px = (v) => Math.round(v / cell) * cell;
        ctx.globalAlpha = alpha;
        (SHAPES[st.shape] || SHAPES.star)(ctx, { x, y, s: cell, dir: X.dir, cols: st.cols, big: true, life: life * 0.6 }, px);
    }
    function giantStep(D, X, dt) {
        const st = X.st;
        const dir = X.dir;
        const T = D.t;
        const ph = D.phase;
        const Dg = st.Dg;
        const won = D.winner === X;
        const L = D.loser;
        let [x, y] = st.gpos;
        let spin = 22;
        if (ph === 'charge') {
            const k = k01(T / DUEL_CHARGE);
            x = st.gx0;
            y = D.ym;
            spin = 4 + 18 * k;
            st.gsize = Dg * easeOut(k / 0.85);
        } else if (ph === 'go' || ph === 'push') {
            // 밀고 밀릴 땐 앞 끝이 빛 덩어리 가장자리에 걸리게 (가운데가 덩어리에 안 가려지게)
            const c = ph === 'push' ? X.front - dir * (blobR(D) * 0.75 + Dg * 0.5) : X.front - dir * Dg * 0.42;
            x = ph === 'go' && (c - st.gx0) * dir < 0 ? st.gx0 : c;
            if (ph === 'push') {
                st.gsx = st.gsx === undefined ? st.gpos[0] : lerp(st.gsx, x, Math.min(1, dt * 10));
                x = st.gsx + rnd(-1, 1) * X.S * 0.8;
                y = D.ym + rnd(-1, 1) * X.S * 0.6 * (1 + 2 * Math.max(0, -st.pr));
            } else {
                y = D.ym;
            }
            spin = 22 + 14 * Math.max(0, st.pr) - 8 * Math.max(0, -st.pr);
            st.gsize = Dg;
        } else if (ph === 'through') {
            const k = k01((T - D.tO) / DUEL_THROUGH);
            if (st.gt0 === undefined) {
                st.gt0 = st.gpos[0];
            }
            if (won) {
                x = lerp(st.gt0, L.body.cx, k * k);
                y = lerp(D.ym, L.body.cy, k);
                spin = 30;
            } else {
                x = st.gt0 + (X.front - D.endXm);
                y = D.ym + Math.sin(T * 40) * X.S;
                spin = 10;
            }
        } else if (ph === 'after' && won) {
            // 부메랑처럼 돌아와 받음
            const ta = T - D.tO - DUEL_THROUGH;
            const k = k01(ta / 0.5);
            x = lerp(L.body.cx, X.body.cx, smooth(k));
            y = Math.max(Dg * 0.5, lerp(L.body.cy, X.body.cy, k) - Math.sin(Math.PI * k) * Dg * 0.6);
            spin = 26;
            if (k >= 1 && once(st, 'catch')) {
                giantCatch(D, X);
            }
        }
        if (!won && X.fade < 0.35 && once(st, 'shatter')) {
            giantShatter(D, X, x, y);
        }
        st.gang += spin * dt * dir;
        st.gpos = [x, y];
        st.ghist.unshift([x, y, st.gang]);
        if (st.ghist.length > 8) {
            st.ghist.length = 8;
        }
    }
    function giantTick(D, X, dt) {
        const st = X.st;
        const S = X.S;
        const dir = X.dir;
        const ph = D.phase;
        if (st.caught || st.shattered) {
            return;
        }
        const [x, y] = st.gpos;
        const Dg = st.Dg;
        if (ph === 'push') {
            // 앞머리에서 갈아 댐 — 튀는 물보라 · 불꽃
            const n = acc(st, 'sp', dt, 110 + 90 * Math.max(0, st.pr));
            for (let i = 0; i < n && roomFor(); i++) {
                sigParticle({ x: x + dir * Dg * 0.45, y: D.ym + rnd(-0.45, 0.45) * Dg, s: S, vx: -dir * rnd(60, 260), vy: rnd(-260, 40), g: 520, drag: 0.8, max: rnd(0.3, 0.55), color: pick(['#ffffff', ...st.cols]), size: pick([1, 1, 2]), draw: streak });
            }
        } else if (ph === 'go' || (ph === 'through' && D.winner === X) || (ph === 'after' && D.winner === X)) {
            const n = acc(st, 'sp', dt, 70);
            for (let i = 0; i < n && roomFor(); i++) {
                const a = rnd(0, TAU);
                sigParticle({ x: x + Math.cos(a) * Dg * 0.45, y: y + Math.sin(a) * Dg * 0.45, s: S, vx: Math.cos(a + (Math.PI / 2) * dir) * D.H * 0.4, vy: Math.sin(a + (Math.PI / 2) * dir) * D.H * 0.4, g: D.H * 1.2, drag: 1, max: rnd(0.3, 0.5), color: pick(st.cols), size: pick([1, 2]), draw: DRAW.dot });
            }
        }
    }
    // 진 쪽 — 거대한 것이 산산이
    function giantShatter(D, X, x, y) {
        const st = X.st;
        st.shattered = true;
        debris(x, y, X.S, [...st.cols, '#ffffff'], 26, 320, D.ground);
        sigRing(x, y, X.S, st.Dg * 0.2, st.Dg, 0.8, 0.3, ['#ffffff', st.cols[1]]);
    }
    // 이긴 쪽 — 돌아온 것을 받음 (펑)
    function giantCatch(D, X) {
        const st = X.st;
        const S = X.S;
        st.caught = true;
        screenFlash(S, 0.3, st.cols[0], 0.2);
        sigRing(X.body.cx, X.body.cy, S, S * 2, st.Dg * 1.4, 0.8, 0.45, ['#ffffff', st.cols[1], st.cols[2]]);
        debris(X.body.cx, X.body.cy, S, st.cols, 24, D.H * 1.1, D.ground);
    }
    // 맨 밑 층 — 날아가는 동안 속도선
    function giantBack(ctx, px, D, X) {
        const st = X.st;
        if (st.caught || st.shattered || D.phase === 'charge') {
            return;
        }
        const S = X.S;
        const [x, y] = st.gpos;
        const [x2, y2] = st.ghist[7] || [x, y];
        const L = Math.hypot(x - x2, y - y2);
        if (L < S) {
            return;
        }
        const ux = (x - x2) / L;
        const uy = (y - y2) / L;
        const Dg = st.Dg;
        ctx.globalAlpha = 0.5 * X.fade;
        ctx.fillStyle = '#ffffff';
        for (let j = 0; j < 8; j++) {
            const o = (j / 7 - 0.5) * Dg * 0.9;
            for (let d = Dg * 0.4; d < L * 1.8 + Dg * 0.3; d += 2 * S) {
                ctx.fillRect(px(x - ux * d - uy * o), px(y - uy * d + ux * o), S, S);
            }
        }
    }
    // 장면 — 거대한 것 (모으기 · 잔상 · 테두리 반짝)
    function giantPaint(ctx, px, D, X) {
        const st = X.st;
        if (st.caught || st.shattered) {
            return;
        }
        const S = X.S;
        const T = D.t;
        const won = D.winner === X;
        const alpha = won && D.phase === 'after' ? 1 : X.fade;
        if (alpha <= 0.02) {
            return;
        }
        const size = st.gsize;
        if (D.phase === 'charge') {
            const kc = k01(T / DUEL_CHARGE);
            ringDots(ctx, px, S, st.gx0, D.ym, st.Dg * (1.1 - 0.5 * kc), 0.85, [st.cols[1], '#ffffff'], kc, 2);
        }
        if (size < st.C * 2) {
            return;
        }
        if (D.phase !== 'charge') {
            for (let k = 6; k >= 2; k -= 2) {
                const h = st.ghist[k];
                if (h) {
                    giantDrawAt(ctx, X, h[0], h[1], size, h[2], (0.12 + (6 - k) * 0.05) * alpha, T - k * 0.016);
                }
            }
        }
        const [x, y] = st.gpos;
        giantDrawAt(ctx, X, x, y, size, st.gang, alpha, T);
        ctx.globalAlpha = 0.8 * alpha;
        for (let j = 0; j < 4; j++) {
            const a = st.gang + (j / 4) * TAU + 0.6;
            dotAt(ctx, px, S, x + Math.cos(a) * size * 0.47, y + Math.sin(a) * size * 0.47, '#ffffff', 2, 2);
        }
    }

    // ═════════════ wave — 파동 (ultpsy 사이코 · ultshadow 그림자) ═════════════
    function waveSetup(D, X) {
        const st = X.st;
        const shadow = X.fx === 'ultshadow';
        const cols = ultCols(X.o, X.fx);
        Object.assign(st, {
            shadow, cols, K: 0.4 + 0.6 * clamp(X.P || 0, 0, 1), pr: 0, roll: 0, flares: [], glare: 0, lunge: 0, blink: -9,
            rocks: [], wisps: [], U: Math.max(D.lane * 2.2, X.h),
            eye: { x: X.mouth.x - X.dir * 3 * (X.s || 1), y: clamp(X.mouth.y - 3 * (X.s || 1), X.body.top + (X.s || 1), X.body.bottom) },
            tn: 3 + Math.round(2 * clamp(X.P || 0, 0, 1)),
        });
        const pp = makePuppet(X);
        pp.glow = [cols[1], cols[3]];
        pp.under = (ctx, px) => waveUnder(ctx, px, D, X);
        pp.over = (ctx, px) => waveOver(ctx, px, D, X);
        if (!shadow) {
            // 떠도는 돌멩이 — 쓰는 애와 만나는 곳 사이
            const rs = Math.max(X.S, Math.round(D.lane / 11));
            const n = 4 + Math.round(2 * st.K);
            for (let i = 0; i < n; i++) {
                st.rocks.push(newRock(D, X, rs, rnd(0.05, 0.45)));
            }
        } else {
            const n = 4 + Math.round(3 * st.K);
            for (let i = 0; i < n; i++) {
                st.wisps.push({ r: st.U * 0.7 * rnd(0.7, 1.25), a: rnd(0, TAU), sp: pick([-1, 1]) * rnd(2.5, 4.5), bob: rnd(0, TAU), tr: [], out: 0 });
            }
        }
        scene(D, X, waveStep, wavePaint);
    }
    function newRock(D, X, rs, t1) {
        const dir = X.dir;
        const span = Math.max(D.lane * 2, (D.mid - X.x0) * dir - D.lane * 2);
        const shape = pick(ROCKS);
        const rh = shape.length * rs;
        return {
            rs, shape, rh, w: shape[0].length * rs, t1, state: 'wait', ph: rnd(0, TAU),
            bx: X.x0 + dir * rnd(0.1, 0.9) * span, x: 0, y: 0,
            top: clamp(D.ym + rnd(-1.7, 1.7) * D.lane, D.H * 0.08, D.ground - rh - X.S * 3),
        };
    }
    function waveStep(D, X, dt) {
        const st = X.st;
        const pp = st.pp;
        const T = D.t;
        const ph = D.phase;
        const S = X.S;
        const dir = X.dir;
        pressure(D, X, dt);
        st.glare = Math.max(0, st.glare - dt * 2);
        st.lunge = Math.max(0, st.lunge - dt * 3);
        pp.flash = Math.max(0, pp.flash - dt * 3);
        st.roll += dt * (ph === 'charge' ? 120 : 240 + 260 * Math.max(0, st.pr) - 110 * Math.max(0, -st.pr));
        if (ph === 'draw' || (ph === 'after' && D.loser === X)) {
            st.gone = true;
            release(X);
        }
        if (ph === 'after' && D.winner === X && T - D.tO - DUEL_THROUGH > 0.85 && !st.gone) {
            st.gone = true;
            release(X);
        }
        if (!st.gone) {
            pp.x = pp.home.x + (ph === 'push' ? rnd(-1, 1) * S * 0.4 : 0);
            pp.sy = st.shadow ? 1 : 1 + 0.04 * Math.sin(T * 6);
            pp.aura = ph === 'charge' ? smooth(T / 0.4) : ph === 'go' || ph === 'push' ? 1 : D.winner === X ? Math.max(0, 1 - (T - D.tO - DUEL_THROUGH) / 0.8) : X.fade;
        }
        track(pp);
        if (st.shadow) {
            const cx = pp.home.x;
            const cy = pp.home.y - pp.bh * 0.5;
            for (const ws of st.wisps) {
                ws.a += ws.sp * dt;
                if (ph === 'after' || ph === 'draw' || ph === 'through') {
                    ws.out += dt * 260;
                }
                const r = ws.r + ws.out;
                ws.tr.unshift([cx + Math.cos(ws.a) * r, cy + Math.sin(ws.a) * r * 0.45 + Math.sin(T * 3 + ws.bob) * S * 2 - ws.out * 0.3]);
                if (ws.tr.length > 8) {
                    ws.tr.length = 8;
                }
            }
            return;
        }
        // 돌멩이 — 떠올라 흔들흔들, 앞머리에 닿으면(또는 밀어붙일 때) 앞머리로 날아가 쾅
        const G = D.ground;
        const won = D.winner === X;
        for (const r of st.rocks) {
            if (r.state === 'wait') {
                if (T >= r.t1 && ph !== 'draw' && ph !== 'after' && ph !== 'through') {
                    Object.assign(r, newRock(D, X, r.rs, 0), { state: 'rise', t0: T });
                    r.x = r.bx;
                    r.y = G - r.rh;
                }
                continue;
            }
            if (r.state === 'rise') {
                const k = (T - r.t0) / 0.5;
                r.y = lerp(G - r.rh, r.top, easeOut(k));
                if (k >= 1) {
                    r.state = 'float';
                }
            } else if (r.state === 'float') {
                r.y = r.top + Math.sin(T * 3 + r.ph) * S * 1.5;
                r.x = r.bx + Math.sin(T * 2.3 + r.ph) * S;
                // 밀려서 앞머리가 덮치면 그 자리에서 앞머리로 날아감 (나가는 동안엔 앞머리가 지나가도 둠)
                if (ph === 'push' && (r.x + dir * r.w - (impactX(D, X) - dir * D.lane * 0.3)) * dir > 0) {
                    flingRock(D, X, r);
                }
            } else if (r.state === 'fly') {
                const tx = r.tx ?? impactX(D, X) + dir * rnd(-0.3, 0) * D.lane;
                r.x += dir * r.v * dt;
                r.y = lerp(r.y, r.ty, Math.min(1, dt * 9));
                if ((r.x - tx) * dir >= 0) {
                    rockBurst(D, X, r.x, r.y, r);
                    r.state = 'wait';
                    r.t1 = T + rnd(0.3, 0.7);
                    r.tx = undefined;
                }
            } else if (r.state === 'drop') {
                r.vy = (r.vy ?? 0) + 900 * dt;
                r.y += r.vy * dt;
                if (r.y >= G - r.rh) {
                    r.y = G - r.rh;
                    r.state = 'rest';
                    dust(r.x, G, S, 2, 30);
                }
            }
            // 진 쪽 · 무승부 — 힘이 풀려 툭 떨어짐
            if ((ph === 'draw' || (ph === 'through' && !won)) && (r.state === 'float' || r.state === 'rise')) {
                r.state = 'drop';
            }
        }
    }
    function flingRock(D, X, r, target) {
        r.state = 'fly';
        r.v = 700 + 300 * X.st.K;
        r.tx = target ? target[0] : undefined;
        r.ty = target ? target[1] : D.ym + rnd(-0.6, 0.6) * D.lane;
    }
    function rockBurst(D, X, x, y, r) {
        const S = X.S;
        hitStar(x, y, S, ['#ffffff', X.st.cols[1], X.st.cols[2]], D.lane * 0.8);
        debris(x, y, S, [...ROCK, X.st.cols[1]], 7, 220, D.ground);
        sigBurst(x, y, S, ['#ffffff', ...X.st.cols], 6, 80);
    }
    // 몸 뒤 오라 (사이코 — 분홍 / 그림자 — 검보라)
    function waveUnder(ctx, px, D, X) {
        const st = X.st;
        const pp = st.pp;
        const k = (pp.aura ?? 0) * (1 + 0.3 * Math.max(0, st.pr));
        if (k <= 0.02) {
            return;
        }
        const w = pp.bw * pp.sc;
        const h = pp.bh * pp.sc;
        const cols = st.shadow ? [st.cols[1], st.cols[2], st.cols[3], '#0a0412'] : st.cols;
        drawAura(ctx, px, X.S, pp.x, pp.y, Math.max(w, st.U * 0.7), Math.max(h, st.U * 0.9), cols, D.t, k * 0.9, 0);
    }
    // 몸 앞 — 눈 (사이코: 번쩍 / 그림자: 빨간 눈)
    function waveOver(ctx, px, D, X) {
        const st = X.st;
        const S = X.S;
        const T = D.t;
        const { x: ex, y: ey } = st.eye;
        const dx0 = st.pp.x - st.pp.home.x;
        if (!st.shadow) {
            for (const t1 of st.flares) {
                const k = (T - t1) / 0.4;
                if (k > 0 && k < 1) {
                    const r = (S * 2 + st.U * 0.4 * st.K) * Math.sin(Math.PI * k);
                    ctx.globalAlpha = 1;
                    star4(ctx, px, S, ex + dx0, ey, r, '#ffffff', st.cols[1]);
                    ctx.globalAlpha = 0.6 * Math.sin(Math.PI * k);
                    dotLine(ctx, px, S, ex + dx0 - r * 1.8, ey, ex + dx0 + r * 1.8, ey, st.cols[0], 1);
                }
            }
            return;
        }
        if (T < 0.1) {
            return;
        }
        const k = Math.min(1, (T - 0.1) / 0.2);
        const flare = Math.max(T < 0.5 ? Math.sin(Math.PI * clamp((T - 0.1) / 0.4, 0, 1)) : 0, st.glare);
        for (const dx of [0, -X.dir * 3 * Math.max(1, X.s || 1)]) {
            ctx.globalAlpha = k;
            dotAt(ctx, px, S, ex + dx0 + dx - S / 2, ey - S / 2, '#ff3b5c');
            dotAt(ctx, px, S, ex + dx0 + dx - S / 2, ey - S / 2 - S, '#ffffff');
            if (flare > 0.05) {
                ctx.globalAlpha = flare;
                dotLine(ctx, px, S, ex + dx0 + dx - st.U * 0.6 * flare, ey, ex + dx0 + dx + st.U * 0.6 * flare, ey, '#ff8aa0', 1);
                star4(ctx, px, S, ex + dx0 + dx, ey, S * 2 + st.U * 0.25 * flare, '#ffffff', '#ff3b5c');
            }
        }
    }
    // 장면 — 꼭두각시 · 몸 둘레 고리 · 돌멩이 (사이코) / 하늘의 거대한 눈 · 도깨비불 (그림자)
    function wavePaint(ctx, px, D, X) {
        const st = X.st;
        const pp = st.pp;
        const S = X.S;
        const T = D.t;
        const F = waveFade(D, X);
        const cols = st.cols;
        const live = D.phase === 'charge' || D.phase === 'go' || D.phase === 'push';
        if (!st.shadow) {
            // 몸 둘레를 도는 고리
            const ra = live ? Math.min(1, T / 0.3) : F;
            if (ra > 0.02 && !st.gone) {
                const cx = pp.home.x;
                const cy = pp.home.y - pp.bh * 0.5;
                ctx.globalAlpha = 0.85 * ra;
                for (let j = 0; j < 2; j++) {
                    ellipseDots(ctx, px, S, cx, cy, st.U * (0.6 + 0.25 * j), st.U * (0.2 + 0.08 * j), [cols[0], cols[2]], T * (j ? -3 : 4), 4);
                }
            }
        }
        if (pp.show && !st.gone) {
            drawPuppet(ctx, px, X, pp);
        }
        if (!st.shadow) {
            const map = { o: cols[1], '#': ROCK[2], w: ROCK[0] };
            for (const r of st.rocks) {
                if (r.state === 'wait') {
                    continue;
                }
                const a = r.state === 'rest' || r.state === 'drop' ? F : 1;
                if (a <= 0.02) {
                    continue;
                }
                ctx.globalAlpha = a;
                const px2 = (v) => Math.round(v / r.rs) * r.rs;
                glyph(ctx, px2, r.rs, r.x, r.y, r.shape, map, false);
                if (r.state === 'float' || r.state === 'fly') {
                    ctx.globalAlpha = 0.7 * a;
                    ellipseDots(ctx, px, S, r.x + r.w / 2, r.y + r.rh * 0.6, r.w * 0.8, r.rh * 0.25, [cols[0], cols[2]], T * 5, 3, 40);
                }
            }
            return;
        }
        // 하늘의 거대한 눈 — 떴다가 밀릴 때 깜빡, 밀어붙이면 부릅뜸
        const fa = live ? 1 : F;
        if (T > 0.15 && fa > 0.02) {
            let open = smooth((T - 0.15) / 0.3);
            const bl = T - st.blink;
            if (bl > 0 && bl < 0.16) {
                open *= Math.abs(bl - 0.08) / 0.08;
            }
            const W = D.W;
            const eyeW = clamp(W * 0.075, 16, 52);
            const eyeH = eyeW * (0.42 - 0.1 * st.glare);
            const exc0 = lerp(pp.home.x, X.front, 0.42);
            const eyy = Math.max(eyeH, D.H * 0.17);
            const look = Math.sin(T * 1.3) * eyeW * 0.12 + X.dir * eyeW * 0.1;
            for (const sgn of [-1, 1]) {
                const exc = exc0 + sgn * eyeW * 0.85;
                for (let yy = -eyeH / 2; yy <= eyeH / 2; yy += S) {
                    const f = yy / (eyeH / 2);
                    if (Math.abs(f) > open) {
                        continue;
                    }
                    const hw = (eyeW / 2) * Math.sqrt(Math.max(0, 1 - f * f));
                    const slant = -sgn * yy * 0.6;
                    const x0 = exc - hw + slant;
                    ctx.globalAlpha = 0.5 * fa;
                    ctx.fillStyle = cols[2];
                    ctx.fillRect(px(x0 - S), px(eyy + yy), Math.max(S, px(2 * hw + 2 * S)), S);
                    ctx.globalAlpha = 0.95 * fa;
                    ctx.fillStyle = Math.abs(f) < 0.35 ? (st.glare > 0.3 ? '#ffb0c0' : cols[0]) : cols[1];
                    ctx.fillRect(px(x0), px(eyy + yy), Math.max(S, px(2 * hw)), S);
                    ctx.fillStyle = '#12061f';
                    ctx.fillRect(px(exc + slant + look - S), px(eyy + yy), S * 2, S);
                }
            }
        }
        // 도깨비불 — 빙글빙글 감도는 혼
        const wa = Math.min(1, Math.max(0, (T - 0.2) / 0.4)) * (live ? 1 : F);
        if (wa > 0.02) {
            for (const ws of st.wisps) {
                ws.tr.forEach(([x, y], i) => {
                    ctx.globalAlpha = wa * (1 - i / 8) * 0.85;
                    dotAt(ctx, px, S, x, y, i < 2 ? cols[1] : i < 5 ? cols[2] : cols[3], i < 3 ? 2 : 1, i < 3 ? 2 : 1);
                });
                const [x, y] = ws.tr[0] || [0, 0];
                ctx.globalAlpha = wa;
                dotAt(ctx, px, S, x - S / 2, y - S / 2, cols[0], 1, 1);
                dotAt(ctx, px, S, x - S / 2, y - S * 1.5, cols[1], 1, 1);
            }
        }
    }
    // 이긴 뒤엔 0.6초 만에 걷힘 — 진 쪽에서 터지는 마무리가 잘 보이게 (엔진 fade 는 1.1초)
    const waveFade = (D, X) => X.fade * (D.phase === 'after' ? k01(1 - (D.t - D.tO - DUEL_THROUGH) / 0.6) : 1);
    // 모양 (맨 밑 층)
    function waveDraw(ctx, px, D, X) {
        if (X.st.shadow) {
            shadowDraw(ctx, px, D, X);
        } else {
            psyDraw(ctx, px, D, X);
        }
    }
    // 사이코 — 쓰는 애 쪽이 보랏빛으로 일렁(물결치는 가로줄), 물결 고리가 앞머리로 굴러가 빛 렌즈로 쌓임
    function psyDraw(ctx, px, D, X) {
        const st = X.st;
        const S = X.S;
        const dir = X.dir;
        const cols = st.cols;
        const T = D.t;
        const F = waveFade(D, X);
        const G = D.ground;
        const W = D.W;
        const front = X.front;
        const pr = st.pr;
        const xa = dir > 0 ? 0 : front;
        const xb = dir > 0 ? front : W;
        if (xb - xa < S) {
            return;
        }
        ctx.globalAlpha = F * (0.13 + 0.04 * Math.sin(T * 5) + 0.08 * Math.max(0, pr));
        ctx.fillStyle = cols[3];
        ctx.fillRect(Math.round(xa), 0, Math.round(xb - xa), Math.round(G));
        const n = Math.round(clamp(G / 17, 6, 15));
        const step = S * 3;
        for (let j = 0; j < n; j++) {
            const y0 = ((j + 0.5) * G) / n + Math.sin(T * 1.3 + j * 1.7) * (G / n) * 0.25;
            const amp = (G / n) * (0.18 + 0.12 * Math.sin(T * 2 + j)) * (1 + 0.6 * Math.max(0, -pr));
            const th = j % 3 === 0 ? S : Math.max(1, S / 2);
            ctx.globalAlpha = F * (j % 2 ? 0.34 : 0.22) * (1 + 0.5 * Math.max(0, pr));
            ctx.fillStyle = j % 3 === 0 ? cols[0] : cols[1];
            let k = (j * 37) % 5;
            for (let x = xa; x < xb; x += step, k++) {
                if (k % 9 > 5) {
                    continue;
                }
                const y = y0 + Math.sin(x * 0.028 + T * (4 + (j % 3)) + j) * amp;
                ctx.fillRect(Math.round(x), px(y), Math.max(1, Math.min(step, xb - x)), th);
            }
        }
        // 굴러가는 물결 — 쓰는 애에게서 맞닿는 자리까지, 갈수록 크고 밝게
        const cx = st.pp.home.x;
        const cy = D.ym;
        const lane = D.lane;
        const ex = impactX(D, X);
        const dist = (ex - cx) * dir;
        if (dist > S * 6) {
            const gap = lane * (1.05 - 0.3 * Math.max(0, -pr));
            for (let r = wrap(st.roll, gap) + S * 4; r < dist - lane * 0.4; r += gap) {
                const f = r / dist;
                const rl = lane * (0.7 + 0.7 * f);
                const ry = lane * (0.6 + 1.0 * f);
                ctx.globalAlpha = F * (0.3 + 0.6 * f);
                arcDots(ctx, px, S, cx + dir * (r - rl), cy, rl, ry, 1.2, dir, f > 0.6 ? ['#ffffff', cols[1], cols[0]] : [cols[1], cols[2], cols[0]], f > 0.7 ? 2 : 1);
            }
            // 맞닿는 자리 — 물결이 부딪혀 쌓인 빛 렌즈 (겹 호, 두근두근)
            const pulse = 1 + 0.08 * Math.sin(T * 18) + 0.15 * Math.max(0, pr);
            const rl = lane * 1.3;
            for (const [dr, c, a] of [[-S * 6, cols[3], 0.5], [-S * 4, cols[2], 0.7], [-S * 2, cols[1], 0.95], [0, '#ffffff', 1]]) {
                ctx.globalAlpha = F * a;
                arcDots(ctx, px, S, ex - dir * rl + dir * dr, cy, rl, lane * 1.75 * pulse, 1.2, dir, [c], 2);
            }
            // 렌즈 둘레 반짝
            const tick = Math.floor(T * 20);
            for (let j = 0; j < 4; j++) {
                const a = (hash(j, tick) * 2 - 1) * 1.1;
                ctx.globalAlpha = F * 0.9;
                star4(ctx, px, S, ex - dir * rl + dir * Math.cos(a) * rl, cy + Math.sin(a) * lane * 1.75, S * (1 + Math.round(hash(j, tick + 3) * 2)), '#ffffff', cols[1]);
            }
        }
    }
    // 그림자 — 쓰는 애 쪽에 보랏빛 어둠, 땅을 따라 그림자 · 촉수가 기어가 맞닿는 자리에서 그림자 벽으로 솟음
    // (어두운 화면에서도 보이게 — 검은 몸은 늘 보랏빛 테두리 · 안개 위에)
    function shadowDraw(ctx, px, D, X) {
        const st = X.st;
        const S = X.S;
        const dir = X.dir;
        const cols = st.cols;
        const T = D.t;
        const F = waveFade(D, X);
        const G = D.ground;
        const W = D.W;
        const lane = D.lane;
        const pr = st.pr;
        const hx = st.pp.home.x;
        const ex = impactX(D, X);
        // 보랏빛 어둠 — 화면 끝부터 맞닿는 자리까지, 끝은 들쭉날쭉
        const edge = ex - dir * lane * 1.2;
        const xa = dir > 0 ? 0 : edge;
        const xb = dir > 0 ? edge : W;
        const da = F * (0.32 + 0.1 * Math.max(0, pr));
        ctx.fillStyle = '#1d0f33';
        if (xb > xa) {
            ctx.globalAlpha = da;
            ctx.fillRect(Math.round(xa), 0, Math.round(xb - xa), Math.round(G));
        }
        const cw = S * 3;
        const nc = Math.ceil((lane * 1.2) / cw);
        for (let i = 0; i < nc; i++) {
            const f = i / nc;
            const x = edge + dir * i * cw;
            const top = G * (0.05 + 0.5 * f + 0.12 * Math.sin(T * 3 + i * 1.7));
            ctx.globalAlpha = da * (1 - f * 0.6);
            ctx.fillRect(px(dir > 0 ? x : x - cw), px(top), cw, Math.max(0, Math.round(G - top)));
        }
        // 땅을 따라 번지는 그림자 — 앞쪽이 두껍고, 위로 보랏빛 안개
        const len = (ex - hx) * dir;
        if (len > S * 2) {
            for (let d = 0; d < len; d += S) {
                const f = d / len;
                const x = hx + dir * d;
                const th = S * (2 + 4 * f + Math.sin(T * 6 + d * 0.08) * 1.2);
                ctx.globalAlpha = F * 0.45;
                ctx.fillStyle = cols[2];
                ctx.fillRect(px(x), px(G - th - S * 3), S, S * 2);
                ctx.globalAlpha = F;
                ctx.fillStyle = (Math.floor(d / S + T * 12) % 9) === 0 ? '#ffffff' : cols[1];
                ctx.fillRect(px(x), px(G - th - S), S, S);
                ctx.fillStyle = DARK;
                ctx.fillRect(px(x), px(G - th), S, Math.max(S, Math.round(th)));
            }
        }
        // 맞닿는 자리 — 그림자 벽 (꼭대기는 불꽃처럼 일렁, 앞면 · 꼭대기 보랏빛 테두리, 속엔 올라가는 결, 꼭대기 근처에 빨간 눈)
        const wallW = lane * 2;
        const top0 = D.ym - lane * (2.3 + 0.35 * Math.max(0, pr)) - lane * 0.3 * st.lunge;
        const ncol = Math.max(4, Math.ceil(wallW / S));
        const tops = [];
        for (let c = 0; c < ncol; c++) {
            const f = c / ncol;
            tops.push(Math.max(2, top0 + f * f * lane * 1.8 + (Math.sin(T * 9 + c * 0.9) + Math.sin(T * 5.3 - c * 1.7)) * S * 1.3));
        }
        // 안개 — 벽보다 한두 칸 크게
        ctx.globalAlpha = F * 0.45;
        ctx.fillStyle = cols[2];
        for (let c = -2; c < ncol + 2; c++) {
            const top = tops[clamp(c, 0, ncol - 1)] - S * 2;
            ctx.fillRect(px(ex - dir * (c + 1) * S), px(top), S, Math.max(S, Math.round(G - top)));
        }
        for (let c = 0; c < ncol; c++) {
            const x = ex - dir * (c + 1) * S;
            const top = tops[c];
            ctx.globalAlpha = F;
            ctx.fillStyle = DARK;
            ctx.fillRect(px(x), px(top), S, Math.max(S, Math.round(G - top)));
            if (c % 3 === 1) {
                // 올라가는 결
                ctx.fillStyle = cols[3];
                for (let y = G - wrap(T * 40 + c * 7, S * 6); y > top + S; y -= S * 6) {
                    ctx.fillRect(px(x), px(y), S, S * 2);
                }
            }
            ctx.fillStyle = c === 0 || hash(c, Math.floor(T * 8)) < 0.15 ? '#ffffff' : cols[1];
            ctx.fillRect(px(x), px(top - S), S, S);
            if (c === 0) {
                ctx.fillStyle = cols[1];
                ctx.fillRect(px(x + dir * S), px(top), S, Math.max(S, Math.round(G - top)));
                ctx.fillStyle = '#ffffff';
                for (let y = top; y < G; y += S * 4) {
                    if (hash(Math.round(y), Math.floor(T * 20)) < 0.35) {
                        ctx.fillRect(px(x + dir * S), px(y), S, S);
                    }
                }
            }
        }
        // 벽 속 눈 — 밀어붙이면 부릅뜸, 밀리면 깜빡
        const bl = T - st.blink;
        if (!(bl > 0 && bl < 0.12)) {
            const eyY = top0 + lane * 0.55;
            const big = st.glare > 0.3 ? 2 : 1;
            ctx.globalAlpha = F;
            for (const k of [0.3, 0.62]) {
                const exX = ex - dir * wallW * k;
                dotAt(ctx, px, S, exX - S, eyY, '#ff3b5c', 2, big);
                dotAt(ctx, px, S, exX - S + (dir > 0 ? S : 0), eyY - S, '#ffffff', 1, 1);
            }
        }
        // 촉수 (벽 위로) — 땅을 기다가 맞닿는 자리 쪽에서 솟아 움켜쥠 (안개 → 테두리 → 검은 속)
        const n = st.tn;
        for (let j = 0; j < n; j++) {
            const off = (n > 1 ? j / (n - 1) - 0.5 : 0) * lane * 1.5;
            const sx0 = hx + dir * (j - 1) * S * 3;
            const tipX = ex - dir * S * (1 + 2 * hash(j)) + dir * S * 3 * st.lunge;
            const tipY = D.ym + off + Math.sin(T * 4 + j) * S;
            const riseX = lerp(sx0, tipX, 0.5 + 0.15 * hash(j, 1));
            if ((tipX - sx0) * dir < S * 4) {
                continue;
            }
            const total = Math.abs(tipX - sx0) + Math.abs(G - tipY);
            const pts = [];
            const steps = Math.max(6, Math.round(total / (S * 2)));
            const gy = G - S * 2;
            for (let i = 0; i <= steps; i++) {
                const u = i / steps;
                const ug = 0.5;
                let x;
                let y;
                if (u < ug) {
                    x = lerp(sx0, riseX, u / ug);
                    y = gy;
                } else {
                    const v = (u - ug) / (1 - ug);
                    const cxq = lerp(riseX, tipX, 0.85);
                    x = (1 - v) ** 2 * riseX + 2 * (1 - v) * v * cxq + v * v * tipX;
                    y = (1 - v * v) * gy + v * v * tipY;
                }
                const wig = Math.sin(T * 7 + i * 0.5 + j * 2) * S * 1.4 * u * (1 + 0.8 * Math.max(0, -pr) + st.lunge);
                pts.push([x, y - wig, u]);
            }
            for (const pass of [0, 1, 2]) {
                ctx.globalAlpha = F * (pass === 0 ? 0.4 : 1);
                ctx.fillStyle = pass === 0 ? cols[2] : pass === 1 ? cols[1] : DARK;
                for (const [x, y, u] of pts) {
                    const wd = (u < 0.35 ? 4 : u < 0.7 ? 3 : 2) + (pass === 0 ? 4 : pass === 1 ? 2 : 0);
                    ctx.fillRect(px(x - (S * wd) / 2), px(y - (S * wd) / 2), wd * S, wd * S);
                }
            }
            // 끝 — 발톱 셋
            ctx.globalAlpha = F;
            for (const a of [-0.75, 0, 0.75]) {
                const ang = (dir > 0 ? 0 : Math.PI) + dir * a + Math.sin(T * 9 + j) * 0.15;
                dotLine(ctx, px, S, tipX, tipY, tipX + Math.cos(ang) * S * 4, tipY + Math.sin(ang) * S * 4, cols[1], 2);
                dotAt(ctx, px, S, tipX + Math.cos(ang) * S * 5 - S / 2, tipY + Math.sin(ang) * S * 5 - S / 2, '#ffffff');
            }
        }
    }
    function waveCharge(D, X, k, dt) {
        const st = X.st;
        const S = X.S;
        const pp = st.pp;
        const cols = st.cols;
        if (st.shadow) {
            // 발밑에서 그림자 기운이 피어오름
            const n = acc(st, 'sh', dt, 40);
            for (let i = 0; i < n && roomFor(); i++) {
                sigParticle({ x: pp.home.x + rnd(-1.2, 1.2) * st.U * 0.6, y: D.ground - S, s: S, vy: -rnd(30, 80), max: rnd(0.5, 0.8), color: pick([cols[2], cols[3], cols[1]]), size: pick([1, 1, 2]), draw: (ctx, q, t, px) => {
                    ctx.globalAlpha = fadeInOut(t, 0.15, 0.4) * 0.85;
                    dotAt(ctx, px, q.s, q.x + Math.sin(q.life * 6) * q.s, q.y, q.color, q.size, q.size * 2);
                } });
            }
            return;
        }
        // 눈이 번쩍 · 빨려 드는 기 · 맥박 고리
        if (once(st, 'eye')) {
            st.flares.push(0.05);
        }
        const n = acc(st, 'pl', dt, 60);
        for (let i = 0; i < n && roomFor(); i++) {
            pullIn(() => pp.home.x, () => pp.home.y - pp.bh * 0.5, st.U * 0.8, S, cols);
        }
        if (k > 0.4 && once(st, 'ring')) {
            sigRing(pp.home.x, pp.home.y - pp.bh * 0.5, S, st.U * 0.4, st.U * 1.8, 0.6, 0.45, [cols[1], cols[2], '#ffffff']);
        }
    }
    function waveTick(D, X, dt) {
        const st = X.st;
        const S = X.S;
        const dir = X.dir;
        const ph = D.phase;
        const cols = st.cols;
        const live = ph === 'go' || ph === 'push';
        if (!live) {
            return;
        }
        if (ph === 'go' && once(st, 'go')) {
            st.flares.push(D.t);
            if (st.shadow) {
                st.glare = 1;
            }
        }
        const front = X.front;
        const hx = st.pp.home.x;
        const span = (front - hx) * dir;
        if (st.shadow) {
            // 그림자 벽 · 땅에서 피어오르는 기운
            const n = acc(st, 'm', dt, 30 + 30 * Math.max(0, st.pr));
            for (let i = 0; i < n && roomFor(); i++) {
                const atWall = Math.random() < 0.55;
                const x = atWall ? front - dir * rnd(0, D.lane * 1.6) : hx + dir * rnd(0, 1) * Math.max(0, span);
                const y = atWall ? D.ym - D.lane * rnd(1.6, 2.4) : D.ground - S * 3;
                sigParticle({ x, y, s: S, vx: rnd(-10, 10), vy: -rnd(20, 70), max: rnd(0.6, 1.0), color: pick([cols[2], cols[3], cols[1], DARK]), size: pick([1, 1, 2]), draw: (ctx, q, t, px) => {
                    ctx.globalAlpha = fadeInOut(t, 0.15, 0.4) * 0.8;
                    dotAt(ctx, px, q.s, q.x + Math.sin(q.life * 6) * q.s, q.y, q.color, q.size, q.size * 2);
                } });
            }
            return;
        }
        // 사이코 — 일렁이는 띠 안의 반짝이
        const n = acc(st, 'sp', dt, 22 + 20 * Math.max(0, st.pr));
        for (let i = 0; i < n && roomFor() && span > 0; i++) {
            sigParticle({ x: hx + dir * rnd(0.1, 1) * span, y: D.ym + rnd(-1.6, 1.6) * D.lane, s: S, vy: -rnd(10, 30), max: rnd(0.4, 0.7), cols, draw: DRAW.sparkle });
        }
    }
    function wavePush(D, X, strong) {
        const st = X.st;
        const S = X.S;
        if (st.gone) {
            return;
        }
        if (st.shadow) {
            if (strong) {
                st.glare = 1;
                st.lunge = 1;
                sigBurst(X.front - X.dir * D.lane * 0.8, D.ym, S, [DARK, st.cols[1], st.cols[0]], 12, 110);
            } else {
                st.blink = D.t;
            }
            return;
        }
        if (strong) {
            st.flares.push(D.t);
            // 맥박 — 빛 호가 앞머리로 휙
            const cx = st.pp.home.x;
            part({ x: cx, y: D.ym, s: S, max: 0.28, draw: (ctx, p, t, px) => {
                const x = lerp(cx, X.front, easeOut(t));
                const rl = D.lane * (0.8 + 0.6 * t);
                ctx.globalAlpha = 1 - t * 0.6;
                arcDots(ctx, px, S, x - X.dir * rl, D.ym, rl, D.lane * (0.8 + 1.0 * t), 1.25, X.dir, ['#ffffff', st.cols[0]], 2);
            } });
            const fl = st.rocks.find((r) => r.state === 'float');
            if (fl) {
                flingRock(D, X, fl);
            }
        } else {
            st.pp.flash = 0.4;
        }
    }
    function waveWin(D, X, L) {
        const st = X.st;
        const S = X.S;
        const cols = st.cols;
        const G = D.ground;
        const el = L.p.el;
        if (st.shadow) {
            // 진 쪽 둘레에서 거대한 그림자 손이 솟아 움켜쥠 → 검은 폭발
            st.glare = 1;
            try {
                el.animate([{ translate: '-2px 0' }, { translate: '2px -1px' }], { duration: 55, iterations: 8, direction: 'alternate', composite: 'add', delay: 280 });
            } catch (e) {
                // 그림이 없어졌어도 계속
            }
            const boxOf = () => {
                const r = L.p.collision.getBoundingClientRect();
                return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height } : { x: L.body.cx, y: L.body.cy, w: L.w, h: L.h };
            };
            part({ x: 0, y: 0, s: S, max: 1.15, fired: false,
                update: (q) => {
                    if (!q.fired && q.life >= 0.55) {
                        q.fired = true;
                        const b = boxOf();
                        darkBurst(b.x, b.y, S, cols, Math.max(b.w, b.h, D.lane * 1.5) * (1.2 + 0.5 * st.K));
                        screenFlash(S, 0.35, cols[1], 0.22);
                        for (const sd of [-1, 1]) {
                            for (let i = 0; i < 10 && roomFor(); i++) {
                                sigParticle({ x: b.x + sd * b.w * 0.5, y: lerp(G, b.y, Math.random()), s: S, vx: sd * rnd(30, 160), vy: -rnd(20, 180), g: 120, drag: 1.5, max: rnd(0.5, 0.9), color: pick([DARK, cols[2], cols[1]]), size: pick([1, 2, 2]), draw: DRAW.dot });
                            }
                        }
                    }
                },
                draw: (ctx, q, t, px) => {
                    const life = q.life;
                    const b = boxOf();
                    const out = life > 0.75 ? Math.max(0, 1 - (life - 0.75) / 0.35) : 1;
                    const kPool = smooth(life / 0.15) * out;
                    const kRise = life < 0.05 ? 0 : easeBack((life - 0.05) / 0.28) * (life > 0.6 ? Math.max(0, 1 - (life - 0.6) / 0.4) : 1);
                    const grip = smooth((life - 0.28) / 0.14);
                    const size = Math.max(b.h * 1.2, D.lane * 1.4);
                    const rx = Math.max(b.w * 1.2, size * 0.9) * kPool;
                    const ry = Math.max(S * 2, rx * 0.2);
                    ctx.globalAlpha = 0.95;
                    fillEllipse(ctx, px, S, b.x, G - ry, rx + S * 2, ry + S, cols[2]);
                    fillEllipse(ctx, px, S, b.x, G - ry, rx, ry, DARK);
                    ctx.globalAlpha = 0.8;
                    ellipseDots(ctx, px, S, b.x, G - ry, rx + S, ry + S * 0.5, [cols[1], cols[0]], life * 3, 4);
                    if (kRise > 0.02) {
                        ctx.globalAlpha = 1;
                        for (const [f, l] of [[-1, 0.5], [-0.55, 0.8], [0.6, 0.65], [1, 0.45]]) {
                            claw(ctx, px, S, b.x + f * rx * 0.9, G - S, size * l * Math.min(1, kRise), -f * 1.2, life, cols);
                        }
                        for (const sd of [-1, 1]) {
                            shadowHand(ctx, px, S, b, sd, G, kRise, grip, life + sd, cols);
                        }
                    }
                },
            });
            return;
        }
        // 사이코 — 떠올랐다 바닥으로 쾅 (보이는 그림만 잠깐 — 엔진의 벌러덩과 겹쳐도 끝나면 원래대로)
        st.flares.push(D.t);
        const up = Math.min(D.H * 0.3, L.h * 1.4 + 10);
        try {
            el.animate([
                { translate: '0 0', easing: 'ease-out' },
                { translate: `0 ${-up}px`, offset: 0.55, easing: 'ease-in' },
                { translate: '0 0', offset: 0.8 },
                { translate: `0 ${-up * 0.12}px`, offset: 0.9 },
                { translate: '0 0' },
            ], { duration: 650, composite: 'add' });
        } catch (e) {
            // 그림이 없어졌어도 계속
        }
        // 떠도는 돌멩이도 진 쪽으로
        for (const r of st.rocks) {
            if (r.state === 'float' || r.state === 'rise') {
                flingRock(D, X, r, [L.body.cx, L.body.cy + rnd(-0.4, 0.4) * L.h]);
            }
        }
        part({ x: 0, y: 0, s: S, max: 0.95, fired: false,
            update: (q) => {
                if (!q.fired && q.life >= 0.5) {
                    q.fired = true;
                    const r = L.p.collision.getBoundingClientRect();
                    const x = r.width ? r.left + r.width / 2 : L.body.cx;
                    screenFlash(S, 0.45, cols[0], 0.25);
                    hitStar(x, G - S * 2, S, ['#ffffff', cols[1], cols[2]], D.lane * 1.6);
                    groundRing(x, G, S, D.lane * 3, [cols[0], '#ffffff', cols[2]], 0.45);
                    groundWave(x, G - S, S, cols, D.W * 0.35, 0.6);
                    dust(x, G, S, 10, 80, 0, 1.4);
                    debris(x, G - S, S, [...ROCK, cols[1]], 12, 240, G);
                    cracks(x, G - S, S, cols, 4, D.lane * 2, (i) => (i % 2 ? Math.PI : 0) + rnd(-0.3, 0.3), 0.25, 0.9);
                }
            },
            draw: (ctx, q, t, px) => {
                const life = q.life;
                const er = el.getBoundingClientRect();
                if (!er.width) {
                    return;
                }
                const x = er.left + er.width / 2;
                if (life < 0.52) {
                    // 떠 있는 동안 — 묶는 고리
                    ctx.globalAlpha = 0.85;
                    ellipseDots(ctx, px, S, x, er.top + er.height * 0.55, er.width * 0.75, er.height * 0.18, [cols[0], cols[2]], life * 5, 3);
                    ellipseDots(ctx, px, S, x, er.top + er.height * 0.3, er.width * 0.55, er.height * 0.13, [cols[1], '#ffffff'], -life * 4, 3);
                }
                if (life > 0.42 && life < 0.8) {
                    // 위에서 내리누르는 빛 기둥
                    const k = (life - 0.42) / 0.38;
                    const hw = Math.max(er.width, D.lane * 1.2) * 0.45 * (1 - k * 0.7);
                    ctx.globalAlpha = 0.7 * (1 - k);
                    ctx.fillStyle = cols[1];
                    ctx.fillRect(px(x - hw), 0, Math.max(S, px(2 * hw)), G);
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(px(x - hw * 0.3), 0, Math.max(S, px(0.6 * hw)), G);
                }
            },
        });
    }

    Object.assign(DUEL_FX, {
        rush: makeKind(rushSetup, { charge: rushCharge, tick: rushTick, push: rushPush, win: rushWin }),
        swarm: makeKind(swarmSetup, { charge: swarmCharge, draw: swarmDraw, tick: swarmTick, push: swarmPush, win: swarmWin }),
        wave: makeKind(waveSetup, { charge: waveCharge, draw: waveDraw, tick: waveTick, push: wavePush, win: waveWin }),
    });
})();
