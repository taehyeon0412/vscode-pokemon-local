
// ───── 필살기 연출 C — 하늘 · 날씨 · 날리기 (설계 · 약속은 ult/SPEC.md) ─────
// ultstorm 날씨 폭격 · ultskyfall 하늘에서 떨어짐 · ultthunder 번개 창 / 번개 기둥 · ultvolt 1000만볼트 · ultswarm 화면 가득 날리기
// 다른 fx 파일과 한 덩어리로 이어 붙으니 이름이 겹치지 않게 전부 이 안에
(() => {
    const TAU = Math.PI * 2;
    const rnd = moveRand;
    const pick = movePick;
    const clamp = ultClamp;
    const lerp = (a, b, k) => a + (b - a) * k;
    const easeOut = (k) => 1 - (1 - clamp(k, 0, 1)) ** 3;
    const easeIn = (k) => clamp(k, 0, 1) ** 2;
    // 번호로 정하는 가짜 난수 0~1 — 날씨 알갱이 자리 (입자를 만들지 않고 그때그때 계산)
    const hash = (i, k = 0) => {
        const v = Math.sin(i * 127.1 + k * 311.7 + 7.13) * 43758.5453;
        return v - Math.floor(v);
    };
    const wrap = (v, span, off = 0) => ((((v - off) % span) + span) % span) + off;
    const LIVE_MAX = 1250; // 살아 있는 입자가 이만큼이면 조각을 더 안 만듦
    const room = (n = 1) => moveParticles.length + n <= LIVE_MAX;
    const strength = (u) => 0.4 + 0.6 * clamp(u.P || 0, 0, 1);
    const fail = (where, err) => ultError(`fx-sky ${where}`, err);
    const hsl = (h, l = 60) => `hsl(${Math.round(((h % 360) + 360) % 360)}, 100%, ${l}%)`;
    const away = (u, x) => Math.sign(x - u.body.cx) || u.dir;
    const short = (u) => Math.min(u.W, u.H);
    // 다른 포켓몬의 지금 자리 (맞아서 밀려났을 수 있어서)
    const where = (u, q) => u.others().find((r) => r.pokemon === q.pokemon) || q;
    // 맞히기 — 넘어지거나 떠오른 애는 gap 초 동안 다시 안 맞힘 (움직임이 겹치지 않게). shake 는 기록 안 함
    function makeHit() {
        const last = new Map();
        return (r, d, kind = 'tumble', gap = 1.6) => {
            const p = r?.pokemon ?? r;
            const now = performance.now();
            if (!p || now - (last.get(p) ?? -1e9) < gap * 1000) {
                return false;
            }
            if (kind !== 'shake') {
                last.set(p, now);
            }
            ultHit(r, d, kind);
            return true;
        };
    }
    // 가장 가까운 다른 포켓몬 — 앞쪽을 먼저
    function nearest(u) {
        let best;
        let bd = Infinity;
        for (const q of u.others()) {
            const dx = q.x - u.body.cx;
            const d = Math.abs(dx) * (Math.sign(dx) === u.dir ? 1 : 1.7);
            if (d < bd) {
                bd = d;
                best = q;
            }
        }
        return best;
    }

    // ── 장면 — 넣은 것을 넣은 순서대로 그림 (moveTick 은 나중 입자를 먼저 그려서 겹침 순서를 여기서 정함) ──
    // sc.at(초, fn) 그때 한 번 · sc.tick(fn) 매 프레임 · sc.add({ max, update, draw }) 그릴 것
    function scene(u, sec, name) {
        const sc = { u, t: 0, items: [], events: [], ticks: [] };
        const guard = (fn, a, b) => {
            try {
                fn(a, b);
                return true;
            } catch (err) {
                fail(name, err);
                return false;
            }
        };
        sc.at = (t, fn) => sc.events.push({ t, fn });
        sc.tick = (fn) => sc.ticks.push(fn);
        sc.add = (it) => {
            it.life = 0;
            it.max = it.max ?? sec;
            sc.items.push(it);
            return it;
        };
        sigParticle({ x: 0, y: 0, s: u.S, max: sec,
            update: (p, dt) => {
                sc.t = p.life;
                for (let i = 0; i < sc.events.length; i++) {
                    const e = sc.events[i];
                    if (!e.done && sc.t >= e.t) {
                        e.done = true;
                        guard(e.fn, sc.t);
                    }
                }
                for (let i = sc.ticks.length - 1; i >= 0; i--) {
                    if (!guard(sc.ticks[i], sc.t, dt)) {
                        sc.ticks.splice(i, 1);
                    }
                }
                for (let i = sc.items.length - 1; i >= 0; i--) {
                    const it = sc.items[i];
                    it.life += dt;
                    if (it.life >= it.max) {
                        sc.items.splice(i, 1);
                        continue;
                    }
                    if (it.update && !guard(() => it.update(it, dt, sc.t))) {
                        sc.items.splice(i, 1);
                    }
                }
            },
            draw: (ctx, p, t, px) => {
                for (const it of sc.items) {
                    if (!it.draw) {
                        continue;
                    }
                    ctx.save();
                    try {
                        it.draw(ctx, it, it.life / it.max, px);
                    } catch (err) {
                        fail(name, err);
                        it.max = 0;
                    }
                    ctx.restore();
                }
            },
        });
        return sc;
    }

    // ── 점 · 선 ──
    // 굵은 점 선을 path 에 더함 (w 칸 굵기) — 다 더한 뒤 fill 한 번이라 겹쳐도 진하기 그대로
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
    // 번개 길 — 가운데를 옆으로 밀며 쪼갬 (seg: 가장 짧은 마디, amp: 흔들림)
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
    // 가지 — 줄기 중간에서 비스듬히
    function branchOf(pts, len, seg) {
        const i = Math.floor((pts.length - 1) * rnd(0.15, 0.75));
        const [ax, ay] = pts[i];
        const [bx, by] = pts[Math.min(pts.length - 1, i + 1)];
        const a = Math.atan2(by - ay, bx - ax) + pick([-1, 1]) * rnd(0.4, 1.0);
        return jag(ax, ay, ax + Math.cos(a) * len, ay + Math.sin(a) * len, seg, 0.3);
    }
    // 번개 한 줄 — 옅은 바깥 빛 · 색 · 하얀 심
    function drawBolt(ctx, px, s, pts, w, mid, glow, alpha = 1) {
        if (glow) {
            fillPts(ctx, px, s, pts, w * 2 + 3, glow, alpha * 0.3);
        }
        fillPts(ctx, px, s, pts, w + 2, mid, alpha);
        fillPts(ctx, px, s, pts, Math.max(1, w - 1), '#ffffff', alpha);
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
                        continue; // 안쪽 줄은 듬성듬성 (가볍게)
                    }
                    const rr = r - k * s;
                    path.rect(px(x + Math.cos(a) * rr), px(y + Math.sin(a) * rr * flat), s, s);
                }
            }
            ctx.fillStyle = cols[c];
            ctx.fill(path);
        }
    }

    // ── 장면에 넣는 것 ──
    // 퍼지는 고리 (th = 굵기 칸)
    function ring(sc, x, y, r0, r1, flat, dur, cols, th = 1) {
        return sc.add({ max: dur, draw: (ctx, it, t, px) => ringDots(ctx, px, sc.u.S, x, y, r0 + (r1 - r0) * easeOut(t), flat, cols, (1 - t) ** 1.2, th) });
    }
    // 번개 내리침 — 0.05초마다 모양이 바뀌며 지직, 처음엔 하얗게 굵게, 가끔 깜빡
    function strike(sc, x0, y0, x1, y1, o = {}) {
        const s = sc.u.S;
        const w = o.w ?? 2;
        const nb = o.branches ?? 2;
        const L = Math.hypot(x1 - x0, y1 - y0);
        const seg = Math.max(2 * s, L / 22);
        const make = (q) => {
            q.drawn = q.life;
            q.pts = jag(x0, y0, x1, y1, seg, o.amp ?? 0.22);
            q.br = [];
            for (let b = 0; b < nb; b++) {
                q.br.push(branchOf(q.pts, L * rnd(0.15, 0.35), seg));
            }
        };
        const it = sc.add({ max: o.dur ?? 0.35,
            update: (q) => q.life - q.drawn > 0.05 && make(q),
            draw: (ctx, q, t, px) => {
                if (t > 0.2 && Math.floor(q.life / 0.035) % 4 === 3) {
                    return;
                }
                const a = t > 0.55 ? (1 - t) / 0.45 : 1;
                const hot = q.life < 0.06 ? 2 : 0;
                const mid = o.rainbow ? hsl((o.hue ?? 0) + q.life * 900) : o.mid ?? '#ffe53b';
                const glow = o.rainbow ? hsl((o.hue ?? 0) + q.life * 900 + 40, 50) : o.glow ?? '#f2b600';
                q.br.forEach((b) => drawBolt(ctx, px, s, b, Math.max(1, Math.round(w / 2)), mid, null, a));
                drawBolt(ctx, px, s, q.pts, w + hot, mid, glow, a);
            },
        });
        make(it);
        return it;
    }
    // 땅을 기어가는 전기 — (x, y) 에서 옆으로 퍼짐
    function groundArcs(sc, x, y, reach, dur, mid, n = 2, w = 1, maxY = Infinity) {
        const s = sc.u.S;
        for (let k = 0; k < n; k++) {
            const side = k % 2 ? -1 : 1;
            const len = reach * rnd(0.6, 1);
            const y1 = Math.min(maxY, y + rnd(-1, 1) * s * 2);
            sc.add({ max: dur, drawn: -1,
                update: (q) => {
                    if (q.life - q.drawn > 0.05) {
                        q.drawn = q.life;
                        const x1 = x + side * len * easeOut(q.life / (dur * 0.55));
                        q.pts = jag(x, y, x1, y1, Math.max(2 * s, len / 16), 0.07).map(([px0, py0]) => [px0, Math.min(maxY, py0)]);
                    }
                },
                draw: (ctx, q, t, px) => q.pts && drawBolt(ctx, px, s, q.pts, w, typeof mid === 'function' ? mid(q.life) : mid, null, 1 - t * t),
            });
        }
    }
    // 땅에 남는 빛 자국
    function glowMark(sc, x, y, rx, cols, dur) {
        const s = sc.u.S;
        sc.add({ max: dur, draw: (ctx, it, t, px) => {
            const a = (1 - t) ** 1.5;
            ellipse(ctx, px, s, x, y, rx, rx * 0.16, cols[2], a * 0.6);
            ellipse(ctx, px, s, x, y, rx * 0.6, rx * 0.1, cols[1], a * 0.85);
            ellipse(ctx, px, s, x, y, rx * 0.3, rx * 0.05, cols[0], a);
        } });
    }

    // ── 전체 입자 (나중에 만든 게 밑에 깔림) ──
    // 튀는 조각 — 땅에 닿으면 통 튀다 멈춤
    function debris(x, y, s, cols, n, speed, o = {}) {
        const ground = o.ground ?? 1e9;
        const g = o.g ?? speed * 2.2;
        const sizes = o.size ?? [1, 1, 2];
        n = Math.min(Math.round(n), Math.max(0, LIVE_MAX - moveParticles.length));
        for (let i = 0; i < n; i++) {
            const a = (o.angle ?? -Math.PI / 2) + rnd(-0.5, 0.5) * (o.spread ?? TAU);
            const sp = speed * rnd(0.3, 1);
            sigParticle({ x: x + rnd(-1, 1) * (o.r ?? 0), y: y + rnd(-0.5, 0.5) * (o.r ?? 0), s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g, drag: o.drag ?? 0.6,
                max: rnd(0.5, 1) * (o.life ?? 1), color: pick(cols), size: pick(sizes), ground, hop: 0,
                update: (p) => {
                    if (p.y > p.ground && p.vy > 0) {
                        p.y = p.ground;
                        p.vy *= -0.35;
                        p.vx *= 0.6;
                        if (++p.hop > 2) {
                            p.vy = 0;
                            p.g = 0;
                        }
                    }
                },
                draw: DRAW.dot });
        }
    }
    // 뭉게 연기 · 먼지 — 커지며 옅어짐
    function puff(x, y, s, color, r0, r1, max, vx = 0, vy = 0, alpha = 0.4) {
        if (!room()) {
            return;
        }
        sigParticle({ x, y, s, vx, vy, drag: 2.2, max, draw: (ctx, p, t, px) => {
            ctx.globalAlpha = alpha * (1 - t) * Math.min(1, t * 8);
            sigDisc(ctx, px, p.s, p.x, p.y, r0 + (r1 - r0) * easeOut(t), color);
        } });
    }
    // 솟는 불길
    function flames(x, y, s, cols, n, rise, spread = 6) {
        n = Math.min(Math.round(n), Math.max(0, LIVE_MAX - moveParticles.length));
        for (let i = 0; i < n; i++) {
            sigParticle({ x: x + rnd(-1, 1) * spread * s, y, s, vx: rnd(-0.15, 0.15) * rise, vy: -rnd(0.4, 1) * rise, drag: 2.4, max: rnd(0.35, 0.65), cols, grow: 2.5, smoke: true, draw: DRAW.stream });
        }
    }
    // 반짝이 (십자)
    function sparkles(x, y, s, cols, n, r, rise = 20) {
        n = Math.min(Math.round(n), Math.max(0, LIVE_MAX - moveParticles.length));
        for (let i = 0; i < n; i++) {
            sigParticle({ x: x + rnd(-1, 1) * r, y: y + rnd(-1, 1) * r * 0.6, s, vy: -rnd(0.3, 1) * rise, max: rnd(0.4, 0.8), cols, draw: DRAW.sparkle });
        }
    }
    // 큰 조각 — n×n 칸 (칸 C), 왼쪽 위 밝게 / ice 면 뾰족한 얼음 조각
    function chunk(x, y, C, cols, n, vx, vy, g, ground, ice) {
        if (!room()) {
            return;
        }
        sigParticle({ x, y, s: C, vx, vy, g, drag: 0.3, max: rnd(1.0, 1.5), n, ground, hop: 0,
            update: (p) => {
                if (p.y > p.ground && p.vy > 0) {
                    p.y = p.ground;
                    p.vy *= -0.3;
                    p.vx *= 0.55;
                    if (++p.hop > 2) {
                        p.vy = 0;
                        p.g = 0;
                    }
                }
            },
            draw: (ctx, p, t, px) => {
                ctx.globalAlpha = t > 0.75 ? (1 - t) / 0.25 : 1;
                const k = p.n;
                if (ice) {
                    // 날아가는 쪽으로 뾰족 — 가운데 밝은 줄
                    const sp = Math.hypot(p.vx, p.vy) || 1;
                    const ax = p.hop ? 1 : p.vx / sp;
                    const ay = p.hop ? 0 : p.vy / sp;
                    for (let j = -k; j <= k; j++) {
                        const wdt = Math.max(1, Math.round((k - Math.abs(j)) * 0.6));
                        for (let m = -wdt + 1; m < wdt; m++) {
                            dotAt(ctx, px, C, p.x + ax * j * C - ay * m * C, p.y + ay * j * C + ax * m * C, m === 0 ? cols[0] : Math.abs(m) === wdt - 1 ? cols[3] : cols[1]);
                        }
                    }
                    return;
                }
                const x0 = px(p.x - (k * C) / 2);
                const y0 = px(p.y - (k * C) / 2);
                ctx.fillStyle = cols[2];
                ctx.fillRect(x0, y0, k * C, k * C);
                ctx.fillStyle = cols[1];
                ctx.fillRect(x0, y0, (k - 1) * C, C);
                ctx.fillRect(x0, y0, C, (k - 1) * C);
                ctx.fillStyle = cols[0];
                ctx.fillRect(x0, y0, C, C);
                ctx.fillStyle = cols[3];
                ctx.fillRect(x0 + C, y0 + (k - 1) * C, (k - 1) * C, C);
                ctx.fillRect(x0 + (k - 1) * C, y0 + C, C, (k - 1) * C);
            } });
    }

    // ── 하늘 띠 · 구름 ──
    // 하늘 띠 — 위로 갈수록 진하게 (4계단), 나중 효과 밑으로 깔림
    function skyBand(sc, color, h, alpha, sec) {
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const a = alpha * clamp(it.life / 0.45, 0, 1) * clamp((it.max - it.life) / 0.5, 0, 1);
            if (a <= 0.01) {
                return;
            }
            ctx.globalCompositeOperation = 'destination-over';
            ctx.fillStyle = color;
            ctx.globalAlpha = a * 0.32;
            for (let k = 0; k < 4; k++) {
                ctx.fillRect(0, 0, sc.u.W, px(h * (1 - k * 0.24)));
            }
        } });
    }
    // 먹구름 한 덩어리 — 위 밝게 · 아래 어둡게, lit 이면 번쩍
    function lump(ctx, px, s, x, y, rw, rh, cols, lit, litCols, puffs) {
        // 뭉게 — 동그라미 몇 개를 겹치고 아래는 평평하게, 위 테두리는 밝게
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
        const C = lit > 0 ? litCols : cols;
        [C[0], C[1], C[2], lit > 0 ? '#ffffff' : C[0]].forEach((c, k) => {
            ctx.fillStyle = c;
            ctx.fill(paths[k]);
        });
    }
    const PUFFS = [
        [[-0.55, 0.12, 0.42], [-0.12, -0.25, 0.55], [0.35, -0.08, 0.48], [0.72, 0.2, 0.32]],
        [[-0.6, 0.18, 0.36], [-0.2, -0.1, 0.5], [0.25, -0.3, 0.5], [0.65, 0.05, 0.4]],
        [[-0.45, -0.05, 0.5], [0.1, -0.28, 0.45], [0.55, 0.1, 0.45]],
    ];
    // 구름 띠 — 위에서 내려와 흘러감. gather 면 양옆에서 cx 쪽으로 몰려듦
    function cloudBank(sc, o) {
        const u = sc.u;
        const s = u.S;
        const { y, h, cols, sec, lit = () => 0, gather = false, cx = u.W / 2, speed = 10 * u.dir, alpha = 0.95 } = o;
        const litCols = o.litCols ?? ['#ffffff', '#fffbe0', '#ffe680'];
        const step = h * 1.45;
        const span = gather ? u.W * (o.width ?? 0.8) : u.W + step * 2;
        const n = Math.max(4, Math.ceil(span / step) + 1);
        const lumps = [];
        for (let i = 0; i < n; i++) {
            const back = i % 2 === 1;
            lumps.push({
                bx: gather ? cx + (i / (n - 1) - 0.5) * span : i * step - step + rnd(-0.2, 0.2) * step,
                y: y + (back ? -0.35 : 0.1) * h + rnd(-0.15, 0.15) * h,
                rw: step * rnd(0.75, 1.05) * (back ? 1.15 : 1), rh: h * rnd(0.6, 0.85) * (back ? 0.9 : 1), back,
                puffs: PUFFS[i % PUFFS.length],
            });
        }
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = it.life;
            const drop = (1 - easeOut(life / 0.6)) + easeIn((life - (sec - 0.5)) / 0.5);
            const L = lit();
            ctx.globalAlpha = alpha;
            for (const pass of [true, false]) {
                for (const q of lumps) {
                    if (q.back !== pass) {
                        continue;
                    }
                    let x;
                    if (gather) {
                        const side = Math.sign(q.bx - cx) || 1;
                        x = q.bx + side * u.W * 0.75 * (1 - easeOut(life / 0.9)) + Math.sin(life * 1.3 + q.y) * s * 2;
                    } else {
                        x = wrap(q.bx + speed * life, n * step, -step);
                    }
                    const yy = q.y - drop * (q.y + q.rh * 2);
                    lump(ctx, px, s, x, yy, q.rw, q.rh, pass ? [cols[1], cols[2], cols[2]] : cols, pass ? L * 0.6 : L, litCols, q.puffs);
                }
            }
        } });
    }

    // ═════ ultstorm — 화면 전체 날씨 폭격 ═════
    const STORM = {
        thunder: { c: 'electric', sky: '#0b0e1c', cloud: ['#6b7090', '#454a63', '#2c3045'], n: 140, hit: 'tumble', flash: '#ffffff' },
        blizzard: { c: 'ice', sky: '#cfeaff', cloud: ['#ffffff', '#d6e8f4', '#a9c2d6'], n: 560, tint: '#e8f6ff', hit: 'shake', light: 1, flash: '#eafaff' },
        wind: { c: 'wind', sky: '#a9d2e6', n: 110, tint: '#dff0f8', hit: 'spin', light: 1, flash: '#ffffff' },
        acid: { c: 'poison', sky: '#2e0b40', cloud: ['#a46cc4', '#74409a', '#4a2266'], n: 230, tint: '#b060e0', hit: 'shake', flash: '#e8b8ff' },
        petal: { c: 'petal', sky: '#ff9fcb', n: 420, tint: '#ff9fcb', hit: 'spin', light: 1, flash: '#ffe6f2' },
        leaf: { c: 'grass', sky: '#1f4a16', n: 380, tint: '#6fd35a', hit: 'tumble', flash: '#e6ffb8' },
        sand: { c: 'ground', sky: '#c8994d', n: 620, hit: 'shake', light: 1, flash: '#f0dcae' },
        rain: { c: 'water', sky: '#0d1828', cloud: ['#5d6b80', '#3e4a5c', '#283242'], n: 420, hit: 'shake', flash: '#dff2ff' },
        fire: { c: 'fire', sky: '#5e1003', cloud: ['#6e4a40', '#4a2e28', '#2e1c18'], n: 110, tint: '#ff5a1a', hit: 'lift', flash: '#fff0c0' },
    };
    // 꽃잎 · 잎 그림 — [dx, dy, 색 번호] 네 장면 (빙글 도는 것처럼)
    const PETAL = [
        [[0, 0, 1], [1, 0, 2]],
        [[0, 0, 1], [0, 1, 2]],
        [[0, 0, 0], [1, 1, 2]],
        [[1, 0, 1], [0, 1, 2]],
    ];
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

    // 날씨 알갱이 — F = { W, H, G, t, n, dir, cols, a }, s = 알갱이 칸. 깊이(먼 · 중간 · 가까운)마다 크기 · 빠르기 · 밝기가 다름
    const depth = (i) => {
        const d = hash(i, 5);
        return d < 0.5 ? 0 : d < 0.86 ? 1 : 2;
    };
    const DEPTH_A = [0.5, 0.8, 1];
    // 비 · 독비 (땅에 닿으면 톡 튐)
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
                    splash.rect(px(x - dd), px(gy), px(2 * dd) + s, s);
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
    // 눈보라 — 비스듬히 휘몰아침, 가까운 건 큰 눈송이, 중간은 날린 줄
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
    // 폭풍 — 길게 휙휙 지나가는 바람 줄 · 끝이 말린 바람 · 굽이치는 바람띠 · 날아가는 잎 · 돌 · 나뭇가지
    const TWIG = [[[0, 0, 2], [1, 0, 2], [2, 0, 2]], [[0, 0, 2], [1, 1, 2], [2, 2, 2]], [[0, 0, 2], [0, 1, 2], [0, 2, 2]], [[2, 0, 2], [1, 1, 2], [0, 2, 2]]];
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
    // 꽃잎 · 잎 폭풍 — 빙글빙글 맴돌며 휩쓸려 감 + 굽이치는 꽃잎 띠
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
    // 모래바람 — 땅 가까이 많이, 휙휙 지나가는 알갱이 + 굴러가는 먼지구름
    function fieldSand(ctx, px, s, F) {
        const { W, H, G, t, n, dir, cols } = F;
        const span = W + 40;
        for (let j = 0; j < 9; j++) {
            const R = H * (0.08 + 0.08 * hash(j, 10));
            const sp2 = W + R * 6;
            const x = wrap(hash(j, 8) * sp2 + dir * W * (0.45 + 0.3 * hash(j, 11)) * t, sp2, -R * 3);
            ellipse(ctx, px, s, x, G - R * 0.45 - hash(j, 9) * H * 0.15, R * 1.8, R * 0.65, j % 2 ? cols[1] : cols[2], 0.28 * F.a);
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
    // 불비 — 꼬리 달린 불덩이가 비스듬히, 땅에 닿으면 확 + 솟는 불씨
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

    function runStorm(u, o, ms) {
        const hit = makeHit();
        const kind = STORM[o.kind] ? o.kind : 'thunder';
        const K = STORM[kind];
        const cols = sigPal(o.c || K.c);
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const bandH = Math.max(40, H * 0.32);
        const area = clamp((W * H) / (480 * 300), 0.45, 2.2);
        const N = Math.round(K.n * area * (0.55 + 0.45 * P));
        const climax = sec * 0.5;
        // 세기 0~1 — 들어왔다 빠짐, 절정에서 더 세게
        const env = (t) => clamp(t / 0.5, 0, 1) * clamp((sec - t) / 0.6, 0, 1);
        const bump = (t) => Math.max(0, 1 - Math.abs(t - climax - 0.25) / 0.55);
        // 꽃잎 · 잎은 절정 소용돌이가 잘 보이게 둘레를 줄임
        const boost = (t) => (kind === 'petal' || kind === 'leaf' ? 1 - 0.55 * bump(t) : 1 + 0.6 * bump(t));
        const sc = scene(u, sec + 0.2, 'ultstorm');
        const others = u.others();
        // 알갱이 칸 — 패널이 크면 굵게
        const c = Math.max(s, Math.round(short(u) / 110));
        const pxc = (v) => Math.round(v / c) * c;
        let lit = 0; // 구름 번쩍 남은 시간
        sc.tick((t, dt) => {
            lit = Math.max(0, lit - dt);
        });
        skyBand(sc, o.c ? cols[3] : K.sky, bandH, K.light ? 0.34 : 0.6, sec);
        // 땅 — 서리 · 독늪 · 불길 · 물결 · 꽃잎 더미
        const grow = (t, from = 0.3, dur = 2.2) => easeOut((t - from) / dur) * clamp((sec - t) / 0.6, 0, 1);
        if (kind === 'blizzard') {
            sc.add({ max: sec, draw: (ctx, it, t, px) => {
                const g = grow(it.life);
                if (g <= 0) {
                    return;
                }
                const colW = 2 * s;
                const maxH = Math.max(5 * s, H * 0.05) * g;
                const paths = [new Path2D(), new Path2D(), new Path2D()];
                for (let x = 0, col = 0; x < W; x += colW, col++) {
                    const h = maxH * (0.55 + 0.45 * hash(col, 11));
                    paths[1].rect(px(x), px(G - h), colW, px(h) + 3 * s);
                    paths[0].rect(px(x), px(G - h), colW, s);
                    if (hash(col, 12) > 0.84) {
                        // 얼음 가시
                        const sh = maxH * (1.4 + 1.6 * hash(col, 13));
                        for (let r = 0; r < sh; r += s) {
                            const wdt = Math.max(1, Math.round((1 - r / sh) * 2.5));
                            paths[r < sh * 0.3 ? 2 : 0].rect(px(x + colW / 2 - wdt * s / 2), px(G - h - r), wdt * s, s);
                        }
                    }
                }
                fillPaths(ctx, paths, ['#ffffff', cols[2], cols[1]], 0.88);
            } });
        } else if (kind === 'acid') {
            const spots = others.map((q) => q.x);
            while (spots.length < 6) {
                spots.push(rnd(0.05, 0.95) * W);
            }
            const pools = spots.map((x, i) => ({ x, w: W * rnd(0.06, 0.11) * (0.8 + 0.4 * P), at: 0.3 + i * 0.15 }));
            sc.add({ max: sec, draw: (ctx, it, t, px) => {
                const life = it.life;
                const bub = [new Path2D(), new Path2D()];
                for (const q of pools) {
                    const g = grow(life, q.at, 1.2);
                    if (g <= 0) {
                        continue;
                    }
                    const rx = q.w * g;
                    const py = G - 3 * s;
                    ellipse(ctx, px, s, q.x, py, rx, rx * 0.16, cols[3], 0.85);
                    ellipse(ctx, px, s, q.x, py, rx * 0.8, rx * 0.1, cols[2], 0.9);
                    ellipse(ctx, px, s, q.x - rx * 0.2, py - rx * 0.04, rx * 0.35, s * 0.5, cols[1], 0.9);
                    // 부글부글 — 거품이 솟아 터짐
                    for (let j = 0; j < 4; j++) {
                        const cyc = 0.45 + 0.3 * hash(j, q.x);
                        const k = ((life + hash(j, q.x + 1) * 3) % cyc) / cyc;
                        const bx = q.x + (hash(j + Math.floor((life + hash(j, q.x + 1) * 3) / cyc), q.x) - 0.5) * rx * 1.4;
                        const by = G - 3 * s - k * 8 * s;
                        if (k < 0.85) {
                            const r = 1 + Math.round(k * 2);
                            for (let a = 0; a < 8; a++) {
                                bub[0].rect(px(bx + Math.cos((a / 8) * TAU) * r * s), px(by + Math.sin((a / 8) * TAU) * r * s), s, s);
                            }
                        } else {
                            for (const [dx, dy] of [[-3, -1], [3, -1], [-2, -3], [2, -3]]) {
                                bub[1].rect(px(bx + dx * s), px(by + dy * s), s, s);
                            }
                        }
                    }
                }
                fillPaths(ctx, bub, [cols[1], cols[0]], 0.95 * env(life));
            } });
        } else if (kind === 'fire') {
            sc.add({ max: sec, draw: (ctx, it, t, px) => {
                const g = grow(it.life, 0.25, 1.4);
                if (g <= 0) {
                    return;
                }
                const life = it.life;
                const colW = 2 * s;
                const maxH = Math.max(6 * s, H * 0.1) * g;
                const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
                for (let x = 0, col = 0; x < W; x += colW, col++) {
                    const n1 = Math.sin(x * 0.09 + life * 11) * 0.5 + 0.5;
                    const n2 = Math.sin(x * 0.031 - life * 6.3 + 1.7) * 0.5 + 0.5;
                    const h = maxH * (0.2 + 0.5 * n1 * n2 + 0.3 * hash(col, Math.floor(life * 12)));
                    let y = G + 2 * s;
                    for (const [f, k] of [[0.35, 0], [0.3, 1], [0.22, 2], [0.13, 3]]) {
                        const hh = Math.max(s, px(h * f));
                        y -= hh;
                        paths[k].rect(px(x), px(y), colW, hh);
                    }
                }
                fillPaths(ctx, paths, [cols[0], cols[1], cols[2], cols[3]], 0.92);
            } });
        } else if (kind === 'rain' || kind === 'thunder') {
            sc.add({ max: sec, draw: (ctx, it, t, px) => {
                const life = it.life;
                const m = Math.round((kind === 'rain' ? 26 : 12) * area * env(life));
                const path = new Path2D();
                for (let j = 0; j < m; j++) {
                    const cyc = 0.5 + 0.3 * hash(j, 20);
                    const tt = life + hash(j, 21) * 5;
                    const k = (tt % cyc) / cyc;
                    const x = hash(j, Math.floor(tt / cyc) + 30) * W;
                    const r = (1 + k * 6) * s;
                    for (let a = 0; a < 10; a++) {
                        path.rect(px(x + Math.cos((a / 10) * TAU) * r), px(G - s + Math.sin((a / 10) * TAU) * r * 0.25), s, s);
                    }
                }
                ctx.globalAlpha = 0.5;
                ctx.fillStyle = kind === 'rain' ? cols[1] : '#bcd0ee';
                ctx.fill(path);
                // 땅 물안개
                ctx.globalAlpha = 0.14 * env(life);
                ctx.fillStyle = '#dfefff';
                ctx.fillRect(0, px(G - 3 * s), W, 4 * s);
            } });
        } else if (kind === 'petal' || kind === 'leaf') {
            sc.add({ max: sec, draw: (ctx, it, t, px) => {
                const g = grow(it.life, 0.5, 2.4);
                const m = Math.round(70 * area * g);
                const paths = [new Path2D(), new Path2D(), new Path2D()];
                for (let j = 0; j < m; j++) {
                    glyphRects(paths, px, s, hash(j, 13) * W, G - hash(j, 14) * 3 * s, (kind === 'leaf' ? LEAF : PETAL)[j % 4]);
                }
                fillPaths(ctx, paths, [cols[0], cols[1], cols[2]], 0.9);
            } });
        }
        // 날씨 알갱이
        const field = {
            thunder: (ctx, F) => fieldRain(ctx, pxc, c, F, { color: '#8fa6c9', near: '#d6e4ff', splash: '#cfe0ff' }),
            rain: (ctx, F) => fieldRain(ctx, pxc, c, F, { color: cols[2], near: cols[0], splash: cols[0] }),
            acid: (ctx, F) => fieldRain(ctx, pxc, c, F, { acid: true, color: cols[2], near: cols[1], head: cols[0], splash: cols[1] }),
            blizzard: (ctx, F) => fieldSnow(ctx, pxc, c, F),
            wind: (ctx, F) => fieldWind(ctx, pxc, c, F),
            petal: (ctx, F) => fieldPetal(ctx, pxc, c, F, false),
            leaf: (ctx, F) => fieldPetal(ctx, pxc, c, F, true),
            sand: (ctx, F) => fieldSand(ctx, pxc, c, F),
            fire: (ctx, F) => fieldFire(ctx, pxc, c, F),
        }[kind];
        sc.add({ max: sec, draw: (ctx, it) => {
            const life = it.life;
            field(ctx, { W, H, G, dir, cols, t: life, n: Math.round(N * env(life) * boost(life)), a: 1 });
        } });
        // 화면 물들이기 — 아래로 갈수록 진하게 (계단)
        if (K.tint) {
            const tint = o.c ? cols[1] : K.tint;
            sc.add({ max: sec, draw: (ctx, it, t, px) => {
                const a = env(it.life) * (kind === 'fire' ? 0.8 + 0.2 * Math.sin(it.life * 23) : 1);
                ctx.fillStyle = tint;
                ctx.globalAlpha = 0.07 * a;
                ctx.fillRect(0, 0, W, H);
                for (let k = 1; k <= 3; k++) {
                    ctx.globalAlpha = 0.05 * a;
                    ctx.fillRect(0, px(G - H * 0.12 * k), W, H);
                }
            } });
        }
        // 구름 (빗줄기 위로)
        if (K.cloud) {
            const cc = kind === 'acid' && o.c ? [cols[1], cols[2], cols[3]] : K.cloud;
            cloudBank(sc, { y: bandH * 0.3, h: bandH * 0.36, cols: cc, sec, lit: () => (lit > 0 ? 1 : 0), speed: (kind === 'thunder' ? 22 : 12) * dir,
                litCols: kind === 'thunder' || kind === 'rain' ? ['#ffffff', '#fffbe0', o.c ? cols[1] : '#ffe680'] : ['#ffffff', cols[0], cols[1]] });
        }
        // 모래 — 화면 전체가 누렇게
        if (kind === 'sand') {
            sc.add({ max: sec, draw: (ctx, it, t, px) => {
                const a = env(it.life);
                ctx.fillStyle = cols[1];
                ctx.globalAlpha = 0.12 * a;
                ctx.fillRect(0, 0, W, H);
                ctx.globalAlpha = 0.1 * a;
                ctx.fillRect(0, px(G - H * 0.3), W, H);
                ctx.fillRect(0, px(G - H * 0.15), W, H);
            } });
        }

        // ── 일 ──
        const flash = (a, color = K.flash, d = 0.25) => screenFlash(s, a, color, d);
        const bw = clamp(Math.round(H / (70 * s)) + 1, 2, 5);
        const cloudY = bandH * 0.42;
        const bolt = (x, y1, w, big) => {
            strike(sc, x + rnd(-1, 1) * W * 0.04, cloudY, x, y1, { w, mid: cols[2], glow: cols[3], dur: big ? 0.55 : 0.32, branches: big ? 4 : 2 });
            lit = Math.max(lit, big ? 0.16 : 0.08);
            flash(big ? 0.65 : 0.18, big ? '#ffffff' : cols[1], big ? 0.35 : 0.14);
            ring(sc, x, G, s * 2, (big ? 0.4 : 0.13) * W, 0.25, big ? 0.6 : 0.35, ['#ffffff', cols[1], cols[2]], big ? 2 : 1);
            debris(x, Math.min(y1, G - s), s, ['#ffffff', cols[0], cols[1], cols[2]], big ? 34 : 8, H * (big ? 1.1 : 0.7), { ground: G });
            glowMark(sc, x, G, (big ? 0.12 : 0.05) * W, cols, big ? 1.4 : 0.8);
            if (big) {
                ultShake(6 + 2 * P, 650);
                groundArcs(sc, x, G - s, W * 0.3, 0.6, cols[1], 4, 1, G);
            } else if (Math.random() < 0.35) {
                ultShake(2, 160);
            }
        };
        if (kind === 'thunder') {
            // 화면 여기저기 — 고루 퍼지게
            let t = 0.4;
            let k = 0;
            while (t < sec - 0.55) {
                const x = W * (0.04 + 0.92 * ((k * 0.618 + 0.31) % 1));
                sc.at(t, () => bolt(x, G - rnd(0, H * 0.04), bw, false));
                t += rnd(0.1, 0.22) / (0.75 + 0.25 * P);
                k++;
            }
            // 다른 포켓몬마다 한 번씩 직격
            const gapT = Math.min(0.3, (sec - 1.3) / Math.max(1, others.length));
            others.forEach((q, i) => sc.at(0.6 + i * gapT + rnd(0, 0.12), () => {
                const r = where(u, q);
                bolt(r.x, r.y, bw + 1, false);
                sparkles(r.x, r.y, s, cols, 8, r.w * 0.6, H * 0.2);
                hit(r, away(u, r.x), 'tumble');
            }));
        } else {
            const iceBlock = (r) => sc.add({ max: 1.5, draw: (ctx, it, t, px) => {
                const k = easeOut(it.life / 0.2);
                const hw = (r.w * 0.55 + 2 * s) * k;
                const top = r.bottom - (r.h + 3 * s) * k;
                const a = t > 0.8 ? (1 - t) / 0.2 : 1;
                ctx.globalAlpha = 0.3 * a;
                ctx.fillStyle = cols[1];
                ctx.fillRect(px(r.x - hw), px(top), px(2 * hw), px(r.bottom - top));
                const path = new Path2D();
                for (let x = -hw; x <= hw; x += s) {
                    path.rect(px(r.x + x), px(top), s, s);
                    path.rect(px(r.x + x), px(r.bottom - s), s, s);
                }
                for (let y = top; y <= r.bottom; y += s) {
                    path.rect(px(r.x - hw), px(y), s, s);
                    path.rect(px(r.x + hw), px(y), s, s);
                }
                for (let j = 0; j < 4; j++) {
                    const x = r.x - hw + (j + 0.5) * (hw / 2);
                    for (let h = 0; h < 3 + (j % 2) * 2; h++) {
                        path.rect(px(x), px(top - h * s), s, s);
                    }
                }
                ctx.globalAlpha = a;
                ctx.fillStyle = '#ffffff';
                ctx.fill(path);
            } });
            const swirl = (r, glyphs, cc, n = 12) => sc.add({ max: 1.2, draw: (ctx, it, t, px) => {
                const paths = [new Path2D(), new Path2D(), new Path2D()];
                for (let j = 0; j < n; j++) {
                    const a = (j / n) * TAU + it.life * 9;
                    const rr = r.w * (0.6 + 0.5 * t) + 4 * s;
                    const x = r.x + Math.cos(a) * rr;
                    const y = r.y - t * r.h * 0.8 + Math.sin(a) * rr * 0.35 + (j % 3) * s * 2;
                    if (glyphs) {
                        glyphRects(paths, px, s, x, y, glyphs[(j + Math.floor(it.life * 10)) % 4]);
                    } else {
                        paths[j % 3].rect(px(x), px(y), 3 * s, s);
                    }
                }
                fillPaths(ctx, paths, cc, 1 - t * t);
            } });
            const HITFX = {
                blizzard: (r) => {
                    iceBlock(r);
                    sparkles(r.x, r.y, s, ['#ffffff', '#ffffff', cols[1]], 10, r.w * 0.7);
                },
                acid: (r) => {
                    debris(r.x, r.bottom - s, s, cols, 12, H * 0.5, { angle: -Math.PI / 2, spread: 1.2, g: H * 0.7, ground: r.bottom });
                    puff(r.x, r.y, s, cols[2], 4, r.w * 0.9, 0.9, 0, -H * 0.1);
                },
                fire: (r) => {
                    flames(r.x, r.bottom, s, cols, 26, H * 0.9, r.w / (2 * s));
                    ring(sc, r.x, r.bottom, s * 2, r.w * 1.6, 0.3, 0.4, [cols[0], cols[1]]);
                },
                petal: (r) => swirl(r, PETAL_BIG, [cols[0], cols[1], cols[2]], 14),
                leaf: (r) => swirl(r, LEAF, [cols[0], cols[1], cols[2]], 14),
                sand: (r) => {
                    for (let j = 0; j < 4; j++) {
                        puff(r.x + rnd(-0.5, 0.5) * r.w, r.bottom - rnd(0, 0.5) * r.h, s, cols[1], 3, r.w * 0.7, 0.8, dir * H * 0.4, -H * 0.05);
                    }
                },
                wind: (r) => swirl(r, null, ['#ffffff', cols[1], cols[2]], 16),
                rain: (r) => debris(r.x, r.bottom - s, s, cols, 14, H * 0.55, { ground: r.bottom }),
            };
            const gapT = Math.min(0.28, (sec - 1.4) / Math.max(1, others.length));
            others.forEach((q, i) => sc.at(0.7 + i * gapT + rnd(0, 0.2), () => {
                const r = where(u, q);
                hit(r, kind === 'wind' ? dir : away(u, r.x), K.hit);
                HITFX[kind]?.(r);
            }));
        }
        // 얼음 조각 · 큰 불덩이 — 비스듬히 떨어져 땅에서 깨짐 / 터짐
        const faller = (big) => {
            const fire = kind === 'fire';
            const x1 = rnd(0.03, 0.97) * W;
            const gy = G - rnd(0, H * 0.05);
            const vy = H * (fire ? 1.25 : 1.6) * (big ? 0.8 : 1);
            const vx = dir * vy * (fire ? 0.45 : 0.6);
            const T = (gy + 20) / vy;
            const it = sc.add({ max: T + 0.02, x: x1 - vx * T, y: gy - vy * T, trail: [],
                update: (q, dt) => {
                    q.x += vx * dt;
                    q.y += vy * dt;
                    q.trail.unshift([q.x, q.y]);
                    q.trail.length = Math.min(q.trail.length, fire ? 9 : 5);
                    if (q.y >= gy) {
                        q.max = 0;
                        if (fire) {
                            flames(q.x, gy, s, cols, big ? 40 : 12, H * (big ? 1.1 : 0.6), big ? 8 : 3);
                            ring(sc, q.x, gy, s * 2, W * (big ? 0.35 : 0.1), 0.25, 0.45, [cols[0], cols[1], cols[2]], big ? 2 : 1);
                            glowMark(sc, q.x, gy, W * (big ? 0.1 : 0.04), cols, 0.9);
                            if (big) {
                                flash(0.5, cols[0], 0.3);
                                ultShake(6 + 2 * P, 600);
                                debris(q.x, gy - s, s, [cols[0], cols[1], cols[2], '#7a7a7a'], 30, H * 1.1, { ground: G });
                                u.others().forEach((r) => Math.abs(r.x - q.x) < W * 0.22 && hit(r, away(u, r.x), 'tumble'));
                            }
                        } else {
                            chunk(q.x, gy - s, s, ['#ffffff', cols[1], cols[2], cols[3]], 2, -vx * 0.2, -H * 0.4, H * 2, G, true);
                            debris(q.x, gy - s, s, ['#ffffff', cols[0], cols[1]], 8, H * 0.6, { ground: G });
                            sparkles(q.x, gy - 2 * s, s, ['#ffffff', '#ffffff', cols[1]], 3, 4 * s);
                        }
                    }
                },
                draw: (ctx, q, t, px) => {
                    const sp = Math.hypot(vx, vy);
                    if (fire) {
                        const r = (big ? 4 : 2) * s;
                        q.trail.forEach(([x, y], j) => {
                            const k = j / q.trail.length;
                            ellipse(ctx, px, s, x, y, r * (1 - k * 0.7), r * (1 - k * 0.7), cols[Math.min(3, 1 + Math.floor(k * 3))], 1 - k);
                        });
                        sigDisc(ctx, px, s, q.x, q.y, r * 1.3, cols[1]);
                        sigDisc(ctx, px, s, q.x, q.y, r * 0.7, cols[0]);
                        return;
                    }
                    const len = big ? 9 : 6;
                    const path = [new Path2D(), new Path2D(), new Path2D()];
                    for (let k = 0; k < len; k++) {
                        const x = q.x - (vx / sp) * k * s;
                        const y = q.y - (vy / sp) * k * s;
                        path[k === 0 ? 0 : 1].rect(px(x), px(y), s, s);
                        if (k > 0 && k < len - 2) {
                            path[2].rect(px(x + s), px(y), s, s);
                        }
                    }
                    fillPaths(ctx, path, ['#ffffff', cols[1], cols[2]], 1);
                },
            });
            return it;
        };
        if (kind === 'blizzard' || kind === 'fire') {
            for (let t = 0.5; t < sec - 0.7; t += (kind === 'fire' ? 0.3 : 0.11) / (0.7 + 0.3 * P)) {
                sc.at(t, () => faller(false));
            }
        }
        // 비 — 먹구름 속이 번쩍
        if (kind === 'rain' || kind === 'acid') {
            [0.8, 1.9, sec - 0.9].forEach((t) => sc.at(t + rnd(-0.15, 0.15), () => {
                lit = 0.1;
                flash(0.15, '#dfe8ff', 0.15);
            }));
        }
        // 폭풍 · 꽃잎 · 모래 — 가끔 큰 돌풍
        const gust = (thick) => sc.add({ max: 0.8, draw: (ctx, it, t, px) => {
            const paths = [new Path2D(), new Path2D()];
            const n = Math.round(26 * area);
            for (let j = 0; j < n; j++) {
                const len = W * (0.25 + 0.35 * hash(j, 40));
                const x0 = dir > 0 ? -len : W;
                const x = x0 + dir * (W + len) * clamp(t * 1.4 - hash(j, 41) * 0.4, 0, 1);
                const y = hash(j, 42) * G;
                paths[j % 2].rect(px(dir > 0 ? x : x), px(y), px(len), (thick && j % 3 === 0 ? 2 : 1) * s);
            }
            fillPaths(ctx, paths, ['#ffffff', cols[1]], 0.7 * (1 - t));
        } });
        [0.6, 1.5, 2.4].forEach((t) => t < sec - 0.6 && sc.at(t + rnd(-0.1, 0.1), () => {
            if (kind === 'wind' || kind === 'sand' || kind === 'blizzard') {
                gust(kind !== 'blizzard');
            }
            ultShake(2.5 + P, 300);
        }));

        // ── 절정 ──
        sc.at(climax, () => {
            flash(K.light ? 0.45 : 0.6, K.flash, 0.35);
            ultShake(5 + 3 * P, 800);
            const target = nearest(u);
            const cxs = target ? target.x : W / 2;
            if (kind === 'thunder' || kind === 'rain') {
                bolt(cxs, target ? target.y : G, bw * 2, true);
                if (kind === 'thunder') {
                    sc.at(climax + 0.12, () => bolt(clamp(cxs - W * 0.22, 8, W - 8), G, bw + 1, false));
                    sc.at(climax + 0.2, () => bolt(clamp(cxs + W * 0.22, 8, W - 8), G, bw + 1, false));
                }
                if (target) {
                    hit(where(u, target), away(u, target.x), 'tumble');
                }
            } else if (kind === 'blizzard') {
                sc.add({ max: 0.7, draw: (ctx, it, t) => {
                    ctx.globalAlpha = 0.45 * (1 - t);
                    ctx.fillStyle = '#f2fbff';
                    ctx.fillRect(0, 0, W, H);
                } });
                for (let j = 0; j < 12; j++) {
                    sc.at(climax + j * 0.03, () => faller(true));
                }
            } else if (kind === 'fire') {
                faller(true);
                sc.at(climax + 0.15, () => faller(true));
            } else if (kind === 'acid') {
                others.forEach((q) => debris(q.x, G - s, s, cols, 18, H * 0.9, { angle: -Math.PI / 2, spread: 1.4, ground: G }));
                for (let j = 0; j < 6; j++) {
                    puff(rnd(0, W), G - rnd(0, H * 0.2), s, cols[2], 6 * s, H * 0.18, 1.2, 0, -H * 0.05, 0.3);
                }
            } else if (kind === 'wind' || kind === 'sand') {
                gust(true);
                gust(false);
                u.others().forEach((r) => hit(r, dir, kind === 'wind' ? 'spin' : 'tumble'));
            } else if (kind === 'petal' || kind === 'leaf') {
                // 화면 가운데 큰 소용돌이
                const cx = W / 2;
                const cy = Math.min(G - H * 0.2, H * 0.5);
                sc.add({ max: 1.3, draw: (ctx, it, t, px) => {
                    // 나선 팔 두 개 — 꽃잎이 줄지어 빙글
                    const paths = [new Path2D(), new Path2D(), new Path2D()];
                    const n = Math.round(60 * Math.sqrt(area));
                    const grow = 0.45 + 0.75 * easeOut(t * 1.6);
                    for (let arm = 0; arm < 2; arm++) {
                        for (let j = 0; j < n; j++) {
                            const f = j / n;
                            const a = f * TAU * 1.6 + arm * Math.PI + it.life * 6 * dir;
                            const rr = (0.06 + 0.94 * f) * Math.min(W * 0.48, H * 0.9) * grow;
                            glyphRects(paths, px, s, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.42, (kind === 'leaf' ? LEAF : PETAL_BIG)[(j + Math.floor(it.life * 9)) % 4], f < 0.5 ? 1 : 2);
                        }
                    }
                    fillPaths(ctx, paths, ['#ffffff', cols[0], cols[1]], t > 0.7 ? (1 - t) / 0.3 : 1);
                } });
                u.others().forEach((r) => hit(r, away(u, r.x), K.hit));
            }
        });
        // 시작 — 휘몰아치는 소리 대신 살짝 흔들림
        sc.at(0.3, () => ultShake(2, sec * 1000 * 0.5));
    }

    // ═════ ultskyfall — 하늘에서 떨어짐 ═════
    // 거대한 바위 · 얼음 — 칸 하나를 1px 로 작은 canvas 에 그려 두고 크게 늘려 그림 (흐리게 안 함)
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
            // 얼음 결정 세 덩이 — 마름모, 면마다 밝기 · 가운데 능선 · 진한 테두리
            const gems = [[-0.48, 0.32, 0.3, 0.62, -0.45], [0.5, 0.3, 0.28, 0.6, 0.5], [0, 0.04, 0.46, 0.95, 0]];
            for (let j = 0; j < N; j++) {
                for (let i = 0; i < N; i++) {
                    const x = ((i + 0.5) / N) * 2 - 1;
                    const y = ((j + 0.5) / N) * 2 - 1;
                    for (let k = gems.length - 1; k >= 0; k--) {
                        const [gx, gy, hw, hh, tilt] = gems[k];
                        const c = Math.cos(tilt);
                        const sn = Math.sin(tilt);
                        const lx = (x - gx) * c + (y - gy) * sn;
                        const ly = -(x - gx) * sn + (y - gy) * c;
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
        // 바위 — 모난 덩어리 (면마다 밝기가 조금씩), 왼쪽 위가 밝음, 작은 구덩이, 달아오른 금 · 아래 테두리
        const nv = 10;
        const verts = [];
        for (let k = 0; k < nv; k++) {
            verts.push({ a: (k / nv) * TAU + rnd(-0.18, 0.18), r: rnd(0.8, 0.98) });
        }
        verts.sort((a, b) => a.a - b.a);
        // 각도 → 반지름 · 면 번호
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
                // 가장자리로 갈수록 면 방향으로 기울어 보이게
                const lean = (r / R) ** 2;
                let shade = 0.5 - 0.55 * lean * ((x * 0.62 + y * 0.78) / Math.max(r, 0.01)) - 0.12 * (x * 0.62 + y * 0.78) + (hash(face, 9) - 0.5) * 0.22 + (hash(i * 57 + j, 3) - 0.5) * 0.1;
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
                // 대기권에서 달아오른 아래 테두리
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

    function runGiantFall(u, o, ms, shape) {
        const ice = shape === 'ice';
        // 바위 기본색은 조금 어둡게 (밝은 하늘에 묻히지 않게)
        const cols = o.c ? sigPal(o.c) : ice ? sigPal('ice') : ['#c9b08a', '#97805e', '#6a5640', '#463828'];
        const heat = ice ? ['#ffffff', '#e3faff', '#9fe8ff', '#55c2ef'] : sigPal('fire');
        const P = strength(u);
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const sec = ms / 1000;
        const D0 = clamp(Math.min(W * 0.45, H * 0.55), 60, 260) * (0.8 + 0.25 * P);
        const C = s * Math.max(1, Math.round(D0 / (s * 34)));
        const N = Math.max(14, Math.round(D0 / C));
        const D = N * C;
        let giant;
        try {
            giant = makeGiant(ice ? 'ice' : 'rock', N, cols);
        } catch (err) {
            fail('makeGiant', err);
        }
        // 떨어질 곳 — 가장 가까운 다른 포켓몬 (쓰는 애 바로 위는 피함), 없으면 앞
        const q = nearest(u);
        let tx = q ? q.x : u.body.cx + dir * Math.max(D * 0.9, W * 0.3);
        if (Math.abs(tx - u.body.cx) < D * 0.62) {
            tx = u.body.cx + (Math.sign(tx - u.body.cx) || dir) * D * 0.62;
        }
        tx = clamp(tx, D * 0.5, W - D * 0.5);
        const tHit = 1.35;
        const tBreak = tHit + 0.5;
        const x0 = tx - dir * W * 0.16;
        const y0 = -D * 0.8;
        const yEnd = G - D * 0.42;
        const pos = (t) => {
            const k = clamp(t / tHit, 0, 1);
            return [lerp(x0, tx, k), lerp(y0, yEnd, k ** 2.2)];
        };
        const sc = scene(u, sec + 0.3, 'ultskyfall');
        ultDark(0.25, ms - 200);
        skyBand(sc, ice ? '#0a2a40' : '#2a0c04', Math.max(40, H * 0.35), 0.5, sec);
        // 땅 그림자 — 점점 커지고 진해짐 + 깜빡이는 과녁
        sc.add({ max: tHit + 0.05, draw: (ctx, it, t, px) => {
            const k = clamp(it.life / tHit, 0, 1);
            const rx = D * 0.55 * (0.12 + 0.88 * k ** 1.4);
            ellipse(ctx, px, s, tx, G - s, rx, rx * 0.16, '#000000', 0.25 + 0.45 * k);
            ellipse(ctx, px, s, tx, G - s, rx * 0.6, rx * 0.1, '#000000', 0.3 + 0.4 * k);
            if (Math.floor(it.life / 0.12) % 2 === 0) {
                ringDots(ctx, px, s, tx, G - s, rx * 1.25, 0.18, ['#ff5040', '#ffffff'], 0.4 + 0.5 * k);
            }
        } });
        // 공기 — 화면 양쪽으로 위로 휙휙 지나가는 줄 (떨어지는 느낌)
        sc.add({ max: tHit, draw: (ctx, it, t, px) => {
            const path = new Path2D();
            const n = Math.round(14 * clamp(W / 480, 0.6, 2));
            for (let j = 0; j < n; j++) {
                const x = hash(j, 1) * W;
                const len = H * (0.12 + 0.2 * hash(j, 2));
                const y = wrap(hash(j, 3) * (H + len) - it.life * H * 2.5, H + len, -len);
                path.rect(px(x), px(y), s, px(len));
            }
            ctx.globalAlpha = 0.3 * clamp(it.life / 0.4, 0, 1);
            ctx.fillStyle = '#ffffff';
            ctx.fill(path);
        } });
        // 꼬리 — 위로 길게 남는 불꽃 / 냉기 줄
        sc.add({ max: tHit + 0.04, draw: (ctx, it, t, px) => {
            const life = it.life;
            const [bx, by] = pos(life);
            const [ax, ay] = pos(Math.max(0, life - 0.05));
            const vx = (bx - ax) / 0.05;
            const vy = (by - ay) / 0.05 || 1;
            const sp = Math.hypot(vx, vy);
            const ux = -vx / sp;
            const uy = -vy / sp;
            const frame = Math.floor(life / 0.05);
            const n = 26;
            const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
            for (let j = 0; j < n; j++) {
                const off = (hash(j, 1) - 0.5) * D * 0.9;
                const sx = bx + off - ux * 0;
                const sy = by - D * 0.25 + Math.abs(off) * 0.35;
                const len = (0.3 + 0.7 * hash(j, 2)) * (0.6 + 0.4 * hash(j, frame)) * Math.min(H * 0.9, sp * 0.22);
                const w = hash(j, 4) > 0.6 ? 2 : 1;
                for (let d = 0; d < len; d += s) {
                    const f = d / len;
                    paths[Math.min(3, Math.floor(f * 4))].rect(px(sx + ux * d), px(sy + uy * d), w * s, s);
                }
            }
            fillPaths(ctx, paths, [heat[0], heat[1], heat[2], ice ? heat[3] : '#6e6e6e'], 0.85 * clamp(life / 0.3, 0, 1));
        } });
        // 거대한 것
        sc.add({ max: tBreak, draw: (ctx, it, t, px) => {
            const life = it.life;
            let [bx, by] = pos(life);
            let glow = clamp(life / tHit, 0, 1);
            if (life > tHit) {
                bx += rnd(-1, 1) * s * (1 - (life - tHit) / 0.5) * 2;
                by = yEnd + D * 0.05;
                glow = Math.max(0, 1 - (life - tHit) / 0.5);
            }
            if (!giant) {
                ellipse(ctx, px, C, bx, by, D / 2, D / 2, cols[2]);
                return;
            }
            ctx.imageSmoothingEnabled = false;
            ctx.globalAlpha = 1;
            const X = Math.round((bx - D / 2) / C) * C;
            const Y = Math.round((by - D / 2) / C) * C;
            ctx.drawImage(giant.cv, X, Y, N * C, N * C);
            if (glow > 0.02) {
                ctx.globalAlpha = (ice ? 0.6 : 0.95) * glow * (0.85 + 0.15 * Math.sin(life * 40));
                ctx.drawImage(giant.hot, X, Y, N * C, N * C);
            }
        } });
        // 떨어지는 동안 — 연기 · 불똥 / 눈가루, 땅 울림
        let nextPuff = 0;
        let nextRumble = 0;
        sc.tick((t) => {
            if (t < tHit && t >= nextPuff) {
                nextPuff = t + 0.04;
                const [bx, by] = pos(t);
                if (ice) {
                    sparkles(bx + rnd(-0.4, 0.4) * D, by - D * 0.3, s, ['#ffffff', '#ffffff', cols[1]], 2, D * 0.1, -H * 0.3);
                } else {
                    puff(bx + rnd(-0.35, 0.35) * D, by - D * 0.3, s, '#3a3430', D * 0.04, D * 0.12, 0.5, 0, -H * 0.1, 0.22);
                    debris(bx + rnd(-0.4, 0.4) * D, by, s, heat, 2, H * 0.3, { angle: -Math.PI / 2, spread: 2, g: H * 0.5 });
                }
            }
            if (t < tHit && t >= nextRumble) {
                nextRumble = t + 0.25;
                ultShake(1 + 3 * (t / tHit), 260);
            }
        });
        // 쾅
        sc.at(tHit, () => {
            screenFlash(s, 0.85, '#ffffff', 0.45);
            sc.at(tHit + 0.08, () => screenFlash(s, 0.4, ice ? cols[1] : '#ffb347', 0.35));
            ultShake(9 + 3 * P, 1100);
            for (let k = 0; k < 3; k++) {
                sc.at(tHit + k * 0.09, () => ring(sc, tx, G - s, D * 0.3, W * (1 - k * 0.15), 0.22, 0.6 + k * 0.15, ['#ffffff', cols[1], cols[0]], 3 - k));
            }
            // 위로 솟는 빛기둥
            sc.add({ max: 0.3, draw: (ctx, it, t, px) => {
                const w = D * (0.5 + 0.6 * t);
                ctx.globalAlpha = 0.45 * (1 - t);
                ctx.fillStyle = ice ? '#e3faff' : '#fff1c2';
                ctx.fillRect(px(tx - w / 2), 0, px(w), px(G));
                ctx.globalAlpha = 0.8 * (1 - t);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(px(tx - w / 6), 0, px(w / 3), px(G));
            } });
            // 땅이 갈라짐 — 빛나는 금이 옆으로 뻗음
            const cracks = [];
            for (let k = 0; k < 8; k++) {
                const side = k % 2 ? -1 : 1;
                const len = rnd(0.5, 1) * Math.max(D, W * 0.35);
                cracks.push(jag(tx, G - s, tx + side * len, G - s + rnd(-1, 1) * H * 0.035, Math.max(2 * s, len / 14), 0.12).map(([x, y]) => [x, Math.min(G + 2 * s, y)]));
            }
            sc.add({ max: sec - tHit, draw: (ctx, it, t, px) => {
                const k = easeOut(it.life / 0.3);
                const a = t > 0.6 ? (1 - t) / 0.4 : 1;
                for (const c of cracks) {
                    const part = c.slice(0, Math.max(2, Math.ceil(c.length * k)));
                    fillPts(ctx, px, s, part, 3, '#1a120c', a * 0.8);
                    fillPts(ctx, px, s, part, 1, ice ? cols[1] : '#ff9d3c', a * (0.7 + 0.3 * Math.sin(it.life * 20)));
                }
            } });
            glowMark(sc, tx, G - s, D * 0.75, ice ? cols : heat, 1.6);
            // 흙 · 돌 · 먼지
            debris(tx, G - 2 * s, s, ice ? ['#ffffff', cols[0], cols[1], cols[2]] : [cols[1], cols[2], cols[3], '#d1b178'], 60, H * 1.5, { ground: G, size: [1, 2, 2, 3], angle: -Math.PI / 2, spread: 2.4, r: D * 0.3 });
            for (let k = 0; k < 16; k++) {
                const side = k % 2 ? -1 : 1;
                puff(tx + side * rnd(0.2, 0.6) * D, G - rnd(0, 0.25) * D, s, ice ? '#e8f8ff' : '#7a6650', D * 0.06, D * rnd(0.18, 0.3), rnd(0.9, 1.4), side * rnd(0.3, 1) * W * 0.6, -rnd(0, 0.3) * H, 0.35);
            }
            // 모두 튀어오름 — 가까우면 벌러덩
            u.others().forEach((r) => {
                const d = Math.abs(r.x - tx);
                sc.at(tHit + d / (W * 1.6), () => ultHit(where(u, r), away(u, r.x), d < D * 0.9 ? 'tumble' : 'lift'));
            });
        });
        // 깨짐 — 큰 조각이 사방으로 / 얼음은 산산조각 + 땅에서 얼음 가시
        sc.at(tBreak, () => {
            screenFlash(s, 0.35, ice ? '#e3faff' : '#fff1c2', 0.25);
            ultShake(4, 400);
            ring(sc, tx, yEnd, D * 0.2, D * 1.4, 0.8, 0.45, ['#ffffff', cols[1]], 2);
            const n = ice ? 22 : 16;
            for (let k = 0; k < n; k++) {
                const x = tx + rnd(-0.4, 0.4) * D;
                const y = yEnd + rnd(-0.3, 0.3) * D;
                chunk(x, y, C, ice ? ['#ffffff', cols[1], cols[2], cols[3]] : cols, ice ? Math.round(rnd(2, 4)) : Math.round(rnd(2, 5)), (x - tx) * rnd(2.5, 5) + rnd(-30, 30), -rnd(0.6, 1.5) * H, H * 2.6, G - s, ice);
            }
            if (ice) {
                sparkles(tx, yEnd, s, ['#ffffff', '#ffffff', cols[1]], 30, D * 0.6, H * 0.3);
                // 땅에서 얼음 가시가 솟음
                const spikes = [];
                for (let k = 0; k < 10; k++) {
                    const side = k % 2 ? -1 : 1;
                    const j = Math.floor(k / 2);
                    spikes.push({ x: tx + side * (D * 0.35 + j * D * 0.28), h: D * rnd(0.35, 0.75) * (1 - j * 0.12), w: D * rnd(0.12, 0.18), at: j * 0.06 });
                }
                sc.add({ max: sec - tBreak, draw: (ctx, it, t, px) => {
                    const a = t > 0.75 ? (1 - t) / 0.25 : 1;
                    const paths = [new Path2D(), new Path2D(), new Path2D()];
                    for (const sp of spikes) {
                        const k = easeOut((it.life - sp.at) / 0.15);
                        if (k <= 0) {
                            continue;
                        }
                        const h = sp.h * k;
                        for (let r = 0; r < h; r += C) {
                            const half = (sp.w / 2) * (1 - r / h);
                            if (half < C / 2) {
                                continue;
                            }
                            paths[1].rect(px(sp.x - half), px(G - r), px(half), C);
                            paths[2].rect(px(sp.x), px(G - r), px(half), C);
                            paths[0].rect(px(sp.x - half), px(G - r), C, C);
                        }
                    }
                    fillPaths(ctx, paths, ['#ffffff', cols[1], cols[2]], a);
                } });
            } else {
                for (let k = 0; k < 10; k++) {
                    puff(tx + rnd(-0.4, 0.4) * D, yEnd + rnd(-0.3, 0.3) * D, s, '#8a7a60', D * 0.1, D * 0.35, rnd(1, 1.5), rnd(-1, 1) * W * 0.2, -H * 0.1, 0.4);
                }
            }
        });
        // 여운 — 불씨 / 눈가루
        let nextBit = 0;
        sc.tick((t) => {
            if (t > tHit + 0.2 && t < sec - 0.3 && t >= nextBit) {
                nextBit = t + 0.05;
                if (ice) {
                    sparkles(tx + rnd(-1, 1) * D, G - rnd(0, 0.6) * D, s, ['#ffffff', '#ffffff', cols[1]], 1, 0, H * 0.1);
                } else if (room()) {
                    sigParticle({ x: tx + rnd(-1, 1) * D * 0.8, y: G - rnd(0, 0.3) * D, s, vy: -rnd(0.1, 0.3) * H, vx: rnd(-10, 10), max: rnd(0.6, 1.1), color: pick(heat), draw: DRAW.dot });
                }
            }
        });
    }

    function runMeteors(u, o, ms, n, shape) {
        const hit = makeHit();
        const star = shape === 'star';
        const cols = sigPal(o.c || (star ? 'star' : shape === 'ice' ? 'ice' : shape === 'rock' ? 'rock' : 'fire'));
        const tcol = shape === 'rock' ? sigPal('fire') : cols;
        const P = strength(u);
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const sec = ms / 1000;
        n = clamp(Math.round(n), 2, 24);
        const sc = scene(u, sec + 0.3, 'ultskyfall');
        const bandH = Math.max(40, H * 0.4);
        const R0 = clamp(short(u) * 0.04, 6, 18) * (0.85 + 0.3 * P);
        const th = 1.05; // 기울기 (땅에서 위로, 라디안)
        const ux = dir * Math.cos(th);
        const uy = Math.sin(th);
        ultDark(0.3, ms - 200);
        skyBand(sc, star ? '#0a0a2a' : '#1e0806', bandH, 0.65, sec);
        // 하늘 별 반짝
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const path = new Path2D();
            const m = Math.round(30 * clamp(W / 480, 0.6, 2));
            for (let j = 0; j < m; j++) {
                if (Math.sin(it.life * (3 + 4 * hash(j, 3)) + j) > 0.1) {
                    path.rect(px(hash(j, 1) * W), px(hash(j, 2) * bandH * 0.9), s, s);
                }
            }
            ctx.globalAlpha = 0.8 * clamp(it.life / 0.4, 0, 1) * clamp((sec - it.life) / 0.5, 0, 1);
            ctx.fillStyle = '#ffffff';
            ctx.fill(path);
        } });
        // 멀리서 쏟아지는 별똥별 — 하늘을 가로지르는 가는 줄
        sc.add({ max: sec - 0.3, draw: (ctx, it, t, px) => {
            const m = Math.round(16 * clamp(W / 480, 0.6, 2));
            const paths = [new Path2D(), new Path2D(), new Path2D()];
            const L = H * 0.22;
            for (let j = 0; j < m; j++) {
                const cyc = 0.5 + 0.4 * hash(j, 4);
                const tt = it.life + hash(j, 5) * 3;
                const k = (tt % cyc) / cyc;
                const seed = Math.floor(tt / cyc) * 7 + j;
                const x0 = hash(seed, 6) * (W + H) - (dir > 0 ? H * 0.5 : 0);
                const y0 = hash(seed, 7) * H * 0.4 - H * 0.1;
                const hx = x0 + ux * L * 2.2 * k;
                const hy = y0 + uy * L * 2.2 * k;
                for (let d = 0; d < L; d += s) {
                    paths[Math.min(2, Math.floor((d / L) * 3))].rect(px(hx - ux * d), px(hy - uy * d), s, s);
                }
            }
            ctx.globalAlpha = 0.7 * clamp(it.life / 0.3, 0, 1);
            [cols[0], tcol[1], tcol[2]].forEach((c, i) => {
                ctx.globalAlpha = (0.85 - i * 0.25) * clamp(it.life / 0.3, 0, 1);
                ctx.fillStyle = c;
                ctx.fill(paths[i]);
            });
        } });
        // 떨어질 곳 — 다른 포켓몬 먼저, 나머지는 쓰는 애를 피해 고루
        const spots = u.others().slice(0, n - 1).map((q) => q.x);
        let k = 0;
        while (spots.length < n - 1 && k < 200) {
            const x = W * (0.05 + 0.9 * ((k * 0.618 + 0.17) % 1));
            if (Math.abs(x - u.body.cx) > Math.max(u.w, W * 0.08)) {
                spots.push(x);
            }
            k++;
        }
        while (spots.length < n - 1) {
            spots.push(rnd(0.05, 0.95) * W);
        }
        for (let i = spots.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [spots[i], spots[j]] = [spots[j], spots[i]];
        }
        const near = nearest(u);
        spots.push(near ? near.x : clamp(u.body.cx + dir * W * 0.35, W * 0.1, W * 0.9)); // 마지막 큰 것
        // 다섯 꼭지 별 (7×7) — 2 는 하얀 가운데
        const STAR = [];
        ['...1...', '..121..', '1112111', '.12221.', '..121..', '.11.11.', '.1...1.'].forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && STAR.push([x - 3, y - 3, ch === '2' ? 0 : 1])));
        const impact = (x, gy, R, big) => {
            screenFlash(s, big ? 0.75 : 0.3, big ? '#ffffff' : cols[1], big ? 0.45 : 0.2);
            ultShake(big ? 8 + 2 * P : 3.5 + P, big ? 1000 : 300);
            ring(sc, x, gy, s * 2, W * (big ? 0.95 : 0.26), 0.25, big ? 0.9 : 0.5, ['#ffffff', cols[1], cols[2]], big ? 3 : 2);
            // 땅에서 터지는 빛 덩어리 (땅 밑은 안 그림)
            const Rd = R * (big ? 6 : 3.5);
            sc.add({ max: big ? 0.7 : 0.4, draw: (ctx, it, t, px) => {
                const r = Rd * easeOut(t * 2.5);
                const a = t < 0.4 ? 1 : (1 - t) / 0.6;
                ellipse(ctx, px, s, x, gy, r, r * 0.8, tcol[3], 0.45 * a, gy);
                ellipse(ctx, px, s, x, gy, r * 0.75, r * 0.6, tcol[2], a, gy);
                ellipse(ctx, px, s, x, gy, r * 0.5, r * 0.4, tcol[1], a, gy);
                ellipse(ctx, px, s, x, gy, r * 0.28, r * 0.22, '#ffffff', a, gy);
            } });
            if (big) {
                sc.at(sc.t + 0.1, () => ring(sc, x, gy, s * 2, W * 0.7, 0.3, 0.8, [cols[0], cols[2]], 2));
                sc.add({ max: 0.4, draw: (ctx, it, t, px) => {
                    const w = R * 3 * (1 + t);
                    ctx.globalAlpha = 0.55 * (1 - t);
                    ctx.fillStyle = cols[1];
                    ctx.fillRect(px(x - w / 2), 0, px(w), px(gy));
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(px(x - w / 6), 0, px(w / 3), px(gy));
                } });
            }
            glowMark(sc, x, gy, R * (big ? 7 : 3.5), tcol, big ? 1.5 : 1.0);
            debris(x, gy - s, s, [...cols, '#8a7252'], big ? 50 : 16, H * (big ? 1.3 : 0.85), { ground: G, size: [1, 2, 2], spread: 2.4 });
            if (star) {
                sparkles(x, gy - R, s, cols, big ? 20 : 8, R * 2, H * 0.3);
            } else {
                flames(x, gy, s, tcol, big ? 30 : 10, H * (big ? 0.9 : 0.55), big ? 6 : 3);
            }
            const rad = big ? W * 0.55 : W * 0.1;
            u.others().forEach((r) => {
                const d = Math.abs(r.x - x);
                if (d < rad) {
                    hit(r, away(u, r.x), big && d > W * 0.15 ? 'lift' : 'tumble');
                }
            });
        };
        spots.forEach((x1, i) => {
            const big = i === n - 1;
            const t0 = big ? 2.0 : 0.1 + (i / Math.max(1, n - 2)) * 1.5 + rnd(-0.06, 0.06);
            const gy = G - (big ? 0 : rnd(0, H * 0.03));
            const T = big ? 0.8 : rnd(0.5, 0.62);
            const R = R0 * (big ? 2.3 : rnd(0.75, 1.15));
            const dy = gy + R * 3;
            const sx = x1 - (ux / uy) * dy;
            const sy = gy - dy;
            sc.at(t0, () => sc.add({ max: T + 0.03, trail: [],
                update: (q) => {
                    const k = clamp(q.life / T, 0, 1) ** 1.15;
                    q.x = lerp(sx, x1, k);
                    q.y = lerp(sy, gy, k);
                    q.trail.unshift([q.x, q.y]);
                    q.trail.length = Math.min(q.trail.length, big ? 12 : 8);
                    if (room(4)) {
                        for (let j = 0; j < (big ? 3 : 1); j++) {
                            sigParticle({ x: q.x + rnd(-1, 1) * R, y: q.y + rnd(-1, 1) * R, s, vx: -ux * rnd(20, 60), vy: -uy * rnd(20, 60), g: H * 0.3, max: rnd(0.25, 0.5), color: pick(tcol), draw: DRAW.dot });
                        }
                    }
                },
                draw: (ctx, q, t, px) => {
                    if (q.x === undefined) {
                        return;
                    }
                    // 지나온 길 — 옅은 빛 줄
                    fillPts(ctx, px, s, [[sx, sy], [q.x, q.y]], Math.max(1, Math.round(R / (2 * s))), tcol[2], 0.25);
                    // 꼬리 — 머리에서 멀어질수록 가늘고 어둡게 (끊김 없이)
                    const L = q.trail.length;
                    for (let j = L - 1; j >= 1; j--) {
                        const f = j / L;
                        const w = Math.max(1, Math.round(((R * 2) / s) * (1 - f) * 0.9));
                        const c = star ? hsl(j * 30 + q.life * 600, 70) : tcol[Math.min(3, Math.floor(f * 4))];
                        fillPts(ctx, px, s, [q.trail[j], q.trail[j - 1]], w + 2, tcol[3], (1 - f) * 0.35);
                        fillPts(ctx, px, s, [q.trail[j], q.trail[j - 1]], w, c, 1 - f * 0.6);
                    }
                    // 머리
                    if (star) {
                        const k2 = Math.max(1, Math.round((R * 1.3) / (3 * s)));
                        const paths = [new Path2D(), new Path2D()];
                        for (const [dx0, dy0, c] of STAR) {
                            paths[c].rect(px(q.x + dx0 * s * k2 - (s * k2) / 2), px(q.y + dy0 * s * k2 - (s * k2) / 2), s * k2, s * k2);
                        }
                        ringDots(ctx, px, s, q.x, q.y, R * (1.7 + 0.2 * Math.sin(q.life * 30)), 1, [cols[1], '#ffffff'], 0.7);
                        fillPaths(ctx, paths, ['#ffffff', cols[2]], 1);
                        return;
                    }
                    ellipse(ctx, px, s, q.x, q.y, R * 1.8, R * 1.8, tcol[3], 0.3);
                    ellipse(ctx, px, s, q.x, q.y, R * 1.3, R * 1.3, tcol[2], 1);
                    ellipse(ctx, px, s, q.x, q.y, R, R, shape === 'rock' ? cols[2] : tcol[1], 1);
                    ellipse(ctx, px, s, q.x - R * 0.2, q.y - R * 0.2, R * 0.55, R * 0.55, shape === 'rock' ? cols[1] : tcol[0], 1);
                },
            }));
            sc.at(t0 + T, () => impact(x1, gy, R, big));
        });
    }

    // ═════ ultthunder — 번개 창 (스파킹기가볼트) / 번개 기둥 ═════
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
                    // 꼬리 깃 — 두 갈래
                    hw = Wd * (0.72 - 3.2 * f);
                    if (f < 0.1 && b < Wd * 0.3 * (1 - f / 0.1)) {
                        continue;
                    }
                } else if (f < 0.6) {
                    // 자루 — 마디마다 살짝 굵게
                    hw = Wd * (0.26 + 0.08 * (Math.round(a / (C * 3)) & 1));
                } else if (f < 0.67) {
                    // 날 밑동 — 미늘이 넓게
                    hw = Wd * (0.3 + (0.7 * (f - 0.6)) / 0.07);
                } else {
                    // 날 — 끝으로 곧게
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

    function runSpear(u, o, ms, pokemon) {
        const cols = sigPal(o.c || 'electric');
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const cx = u.body.cx;
        const cy = u.body.cy;
        const bandH = Math.max(40, H * 0.3);
        const cloudY = bandH * 0.4;
        const L = clamp(Math.min(W * 0.55, H * 1.0), 90, 340) * (0.82 + 0.22 * P);
        const Wd = L * 0.15;
        const C = s * Math.max(1, Math.round(L / (70 * s)));
        const bw = clamp(Math.round(H / (70 * s)) + 1, 2, 5);
        // 머리 위 조금 뒤쪽 높이 — 던질 때 비스듬히 날아가게
        const hx = W < L + 8 ? W / 2 : clamp(cx - dir * L * 0.25, L * 0.5 + 4, W - L * 0.5 - 4);
        const hy = clamp(Math.min(u.body.top - H * 0.3, H * 0.34), bandH * 0.7 + Wd, Math.max(bandH * 0.7 + Wd, G - H * 0.35));
        const tq = nearest(u);
        const tX = tq ? tq.x : clamp(cx + dir * W * 0.4, W * 0.1, W * 0.9);
        const tY = tq ? tq.y : G - 2 * s;
        const aim = Math.atan2(tY - hy, tX - hx);
        const tStrike = [0.45, 0.68, 0.9, 1.1];
        const tForm = 1.0;
        const tPull = 2.15;
        const tThrow = 2.3;
        const tBoom = 2.55;
        const sc = scene(u, sec + 0.3, 'ultthunder');
        let lit = 0;
        sc.tick((t, dt) => {
            lit = Math.max(0, lit - dt);
        });
        ultDark(0.3, ms - 200);
        skyBand(sc, '#070914', bandH * 1.2, 0.65, sec);
        cloudBank(sc, { y: cloudY, h: bandH * 0.38, cols: ['#6b7090', '#454a63', '#2c3045'], sec, lit: () => (lit > 0 ? 1 : 0), gather: true, cx: hx, width: 1.0,
            litCols: ['#ffffff', cols[1], cols[2]] });
        // 몸 둘레 전기 — 번개를 맞을수록 세짐
        sc.add({ max: tBoom, drawn: -1, arcs: [],
            update: (q) => {
                if (q.life - q.drawn > 0.05) {
                    q.drawn = q.life;
                    const k = clamp((q.life - 0.4) / 1.0, 0, 1);
                    const m = 2 + Math.round(8 * k);
                    const R = Math.max(u.body.rx, u.body.ry, 10);
                    q.arcs = [];
                    for (let j = 0; j < m; j++) {
                        const a = rnd(0, TAU);
                        const r1 = R * rnd(1.3, 2.2) * (1 + k);
                        q.arcs.push(jag(cx + Math.cos(a) * R * 0.7, cy + Math.sin(a) * R * 0.7, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, 2 * s, 0.35));
                    }
                }
            },
            draw: (ctx, q, t, px) => q.arcs.forEach((a) => drawBolt(ctx, px, s, a, 1, cols[2], null, 0.9)),
        });
        // 하늘의 번개를 몸에 받음
        tStrike.forEach((t, i) => sc.at(t, () => {
            strike(sc, cx + rnd(-0.12, 0.12) * W, cloudY, cx, cy, { w: bw + (i === 3 ? 1 : 0), mid: cols[2], glow: cols[3], dur: 0.3, branches: 2 });
            lit = 0.1;
            screenFlash(s, 0.3, '#ffffff', 0.15);
            ring(sc, cx, cy, s * 2, u.R * (1.2 + i * 0.3), 0.85, 0.35, ['#ffffff', cols[1]], 2);
            debris(cx, cy, s, ['#ffffff', cols[1], cols[2]], 12, H * 0.6, { ground: G });
            ultShake(2 + i, 200);
        }));
        // 몸에서 창 자리로 오르는 전기 줄기
        sc.add({ max: tThrow, drawn: -1,
            update: (q) => {
                if (sc.t > tForm && q.life - q.drawn > 0.05) {
                    q.drawn = q.life;
                    q.pts = [jag(cx, u.body.top, hx + rnd(-0.15, 0.15) * L, hy, 3 * s, 0.22)];
                }
            },
            draw: (ctx, q, t, px) => q.pts && sc.t < tPull && q.pts.forEach((p) => drawBolt(ctx, px, s, p, 1, cols[1], cols[3], 0.9)),
        });
        // 창 — 생기고 · 맴돌고 · 뒤로 당겼다 던짐
        const spearAt = (t) => {
            const ux = Math.cos(aim);
            const uy = Math.sin(aim);
            if (t < tPull) {
                return [hx, hy + Math.sin(t * 6) * s, 0];
            }
            if (t < tThrow) {
                const k = easeOut((t - tPull) / (tThrow - tPull));
                return [hx - ux * L * 0.15 * k, hy - uy * L * 0.15 * k, 0];
            }
            const k = easeIn((t - tThrow) / (tBoom - tThrow));
            const bx = hx - ux * L * 0.15;
            const by = hy - uy * L * 0.15;
            return [lerp(bx, tX - ux * L * 0.4, k), lerp(by, tY - uy * L * 0.4, k), k];
        };
        sc.add({ max: tBoom, drawn: -1, ghosts: [],
            update: (q) => {
                if (sc.t >= tForm && q.life - q.drawn > 0.05) {
                    q.drawn = q.life;
                    const [x, y] = spearAt(sc.t);
                    q.core = jag(x - Math.cos(aim) * L * 0.45, y - Math.sin(aim) * L * 0.45, x + Math.cos(aim) * L * 0.42, y + Math.sin(aim) * L * 0.42, 2 * s, 0.06);
                    q.arcs = [];
                    for (let j = 0; j < 2; j++) {
                        const f = rnd(-0.45, 0.45);
                        const ax = x + Math.cos(aim) * L * f;
                        const ay = y + Math.sin(aim) * L * f;
                        const a = aim + pick([-1, 1]) * Math.PI / 2 + rnd(-0.6, 0.6);
                        const len = Wd * rnd(1.2, 2.5);
                        q.arcs.push(jag(ax, ay, ax + Math.cos(a) * len, ay + Math.sin(a) * len, s * 2, 0.35));
                    }
                }
                if (sc.t >= tThrow) {
                    q.ghosts.unshift(spearAt(sc.t));
                    q.ghosts.length = Math.min(q.ghosts.length, 4);
                }
            },
            draw: (ctx, q, t, px) => {
                const life = sc.t;
                if (life < tForm) {
                    return;
                }
                const grow = easeOut((life - tForm) / 0.7);
                const [x, y] = spearAt(life);
                // 날아가는 동안 — 지나온 자리에 굵은 번개 꼬리 + 잔상
                if (life >= tThrow) {
                    const [gx, gy] = q.ghosts[q.ghosts.length - 1] || [x, y];
                    const bx = hx - Math.cos(aim) * L * 0.15;
                    const by = hy - Math.sin(aim) * L * 0.15;
                    drawBolt(ctx, px, s, jag(bx, by, x, y, 3 * s, 0.1), bw, cols[2], cols[3], 0.8);
                    fillPts(ctx, px, s, [[gx, gy], [x, y]], Math.max(2, Math.round(Wd / s)), cols[2], 0.3);
                }
                const pulse = 1 + 0.06 * Math.sin(life * 30);
                drawSpear(ctx, x, y, aim, L * pulse, Wd * pulse, C, cols, life, grow, 1);
                if (q.core) {
                    fillPts(ctx, px, s, q.core, 1, '#ffffff', grow);
                    q.arcs.forEach((a) => drawBolt(ctx, px, s, a, 1, cols[1], null, grow));
                }
            },
        });
        // 창으로 빨려 드는 빛
        sc.tick((t) => {
            if (t > tForm && t < tPull && room(3)) {
                for (let j = 0; j < 2; j++) {
                    const a = rnd(0, TAU);
                    const r = L * rnd(0.5, 0.9);
                    const x0 = hx + Math.cos(a) * r;
                    const y0 = hy + Math.sin(a) * r * 0.6;
                    sigParticle({ x: x0, y: y0, x0, y0, s, max: rnd(0.22, 0.32), color: pick(cols),
                        update: (p) => {
                            const k = Math.min(1, (p.life / p.max) ** 2);
                            p.x = p.x0 + (hx - p.x0) * k;
                            p.y = p.y0 + (hy - p.y0) * k;
                        },
                        draw: DRAW.dot });
                }
            }
        });
        sc.at(tForm, () => {
            screenFlash(s, 0.3, cols[1], 0.2);
            ring(sc, hx, hy, L * 0.8, Wd, 0.5, 0.5, ['#ffffff', cols[2]], 2);
        });
        // 창으로 좁혀 드는 고리 — 기를 모으는 두근
        for (let t = tForm + 0.2; t < tPull; t += 0.28) {
            sc.at(t, () => sc.add({ max: 0.35, draw: (ctx, it, tt, px) => ringDots(ctx, px, s, hx, hy, lerp(L * 0.9, L * 0.12, easeIn(tt)), 0.55, ['#ffffff', cols[2]], 0.3 + 0.7 * tt, 2) }));
        }
        sc.at(tPull, () => ultShake(2, 200));
        sc.at(tThrow, () => {
            screenFlash(s, 0.25, '#ffffff', 0.12);
            ring(sc, hx, hy, Wd, L * 0.7, 0.6, 0.35, ['#ffffff', cols[1]], 2);
        });
        // 대폭발
        sc.at(tBoom, () => {
            const Rmax = clamp(short(u) * 0.45, 50, 230) * (0.8 + 0.3 * P);
            const bx = tX;
            const by = Math.min(tY, G - s);
            screenFlash(s, 0.85, '#ffffff', 0.3);
            sc.at(tBoom + 0.1, () => screenFlash(s, 0.4, cols[1], 0.25));
            ultShake(9 + 3 * P, 1300);
            lit = 0.2;
            // 빛 덩어리 — 커졌다 사그라듦 (땅 밑은 안 그림)
            sc.add({ max: 1.0, drawn: -1,
                update: (q) => {
                    if (q.life - q.drawn > 0.05) {
                        q.drawn = q.life;
                        const r = Rmax * easeOut(q.life / 0.3);
                        q.spikes = [];
                        for (let j = 0; j < 10; j++) {
                            const a = (j / 10) * TAU + rnd(-0.2, 0.2);
                            const len = r * rnd(1.1, 1.6);
                            q.spikes.push(jag(bx, by, bx + Math.cos(a) * len, Math.min(G, by + Math.sin(a) * len), 3 * s, 0.25));
                        }
                    }
                },
                draw: (ctx, q, t, px) => {
                    const r = Rmax * easeOut(q.life / 0.3);
                    const a = q.life < 0.35 ? 1 : Math.max(0, 1 - (q.life - 0.35) / 0.65);
                    const cut = G + 2 * s;
                    ellipse(ctx, px, s, bx, by, r, r * 0.92, cols[3], 0.35 * a, cut);
                    ellipse(ctx, px, s, bx, by, r * 0.82, r * 0.76, cols[2], 0.75 * a, cut);
                    ellipse(ctx, px, s, bx, by, r * 0.62, r * 0.58, cols[1], a, cut);
                    ellipse(ctx, px, s, bx, by, r * 0.38 * (1 - t * 0.6), r * 0.36 * (1 - t * 0.6), '#ffffff', a, cut);
                    q.spikes.forEach((p) => drawBolt(ctx, px, s, p, 2, cols[2], cols[3], a));
                },
            });
            for (let k = 0; k < 3; k++) {
                sc.at(tBoom + k * 0.1, () => ring(sc, bx, by, Rmax * 0.3, W * (1.1 - k * 0.2), 0.35, 0.7 + k * 0.1, ['#ffffff', cols[1], cols[2]], 3 - k));
            }
            groundArcs(sc, bx, G - s, W * 0.6, 1.1, cols[1], 6, 2, G);
            sc.at(tBoom + 0.35, () => groundArcs(sc, bx, G - s, W * 0.45, 0.9, cols[2], 4, 1, G));
            // 위로 솟는 번개
            for (let k = 0; k < 3; k++) {
                sc.at(tBoom + 0.05 + k * 0.08, () => strike(sc, bx + rnd(-0.3, 0.3) * Rmax, by, bx + rnd(-0.5, 0.5) * Rmax, 0, { w: bw, mid: cols[2], glow: cols[3], dur: 0.35 }));
            }
            debris(bx, by, s, ['#ffffff', cols[0], cols[1], cols[2]], 70, H * 1.4, { ground: G, size: [1, 2, 2] });
            for (let k = 0; k < 10; k++) {
                puff(bx + rnd(-1, 1) * Rmax * 0.6, G - rnd(0, 0.4) * Rmax, s, '#4a4a5a', Rmax * 0.08, Rmax * 0.3, rnd(1, 1.5), rnd(-1, 1) * W * 0.2, -H * 0.15, 0.35);
            }
            glowMark(sc, bx, G - s, Rmax * 0.8, cols, sec - tBoom);
            u.others().forEach((r) => {
                const d = Math.hypot(r.x - bx, r.y - by);
                sc.at(tBoom + d / (W * 2), () => ultHit(where(u, r), away(u, r.x), d < Rmax * 1.4 ? 'tumble' : 'lift'));
            });
        });
        // 여운 — 땅에서 지직지직
        let nextZap = tBoom + 0.5;
        sc.tick((t) => {
            if (t >= nextZap && t < sec - 0.3) {
                nextZap = t + rnd(0.08, 0.16);
                const x = tX + rnd(-1, 1) * W * 0.3;
                const len = rnd(0.04, 0.1) * W;
                strike(sc, x, G - s - rnd(0, 3) * s, x + rnd(-1, 1) * len, G - s, { w: 1, mid: cols[1], glow: null, dur: 0.18, branches: 0, amp: 0.4 });
            }
        });
    }

    function runPillars(u, o, ms) {
        const hit = makeHit();
        const cols = sigPal(o.c || 'electric');
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const bandH = Math.max(40, H * 0.3);
        const cloudY = bandH * 0.38;
        const k = 5 + Math.round(2 * P);
        const pw0 = clamp(W * 0.06, 14, 46) * (0.85 + 0.3 * P);
        const xs = u.body.cx + dir * Math.max(u.w * 0.9, W * 0.13);
        const far = dir > 0 ? W - pw0 * 1.3 : pw0 * 1.3;
        const spacing = Math.abs(far - xs) > pw0 * 2 ? (far - xs) / (k - 1) : dir * pw0 * 1.2;
        const sc = scene(u, sec + 0.3, 'ultthunder');
        let lit = 0;
        sc.tick((t, dt) => {
            lit = Math.max(0, lit - dt);
        });
        ultDark(0.3, ms - 200);
        skyBand(sc, '#070914', bandH * 1.2, 0.65, sec);
        cloudBank(sc, { y: cloudY, h: bandH * 0.4, cols: ['#6b7090', '#454a63', '#2c3045'], sec, lit: () => (lit > 0 ? 1 : 0), speed: 25 * dir, litCols: ['#ffffff', cols[1], cols[2]] });
        // 모으기 — 몸에 스파크, 구름 속 번쩍
        sc.at(0.05, () => SIG_FX.spark.run({ ...u, P: 1 }, {}, 900));
        [0.25, 0.45].forEach((t) => sc.at(t, () => {
            lit = 0.08;
            screenFlash(s, 0.12, cols[1], 0.12);
        }));
        sc.at(0.2, () => ultShake(1.5, 500));
        // 기둥 하나 — 하늘에서 땅까지: 옅은 빛기둥 + 굵은 번개 세 줄이 꼬이며 지직, 옆으로 가지, 땅에 닿는 곳은 하얗게
        const pillar = (x, pw, big) => {
            const top = cloudY;
            const bottom = G;
            const h = bottom - top;
            const bwid = Math.max(2, Math.round(pw / (3.2 * s)));
            sc.add({ max: big ? 0.8 : 0.55, drawn: -1,
                update: (q) => {
                    if (q.life - q.drawn > 0.045) {
                        q.drawn = q.life;
                        q.seed = rnd(0, 1000);
                        q.bolts = [0, 1, 2].map((j) => jag(x + (j - 1) * pw * 0.22 + rnd(-0.1, 0.1) * pw, top, x + rnd(-0.15, 0.15) * pw, bottom, Math.max(3 * s, h / 10), 0.16));
                        q.br = [0, 1, 2].map(() => {
                            const y = top + h * rnd(0.15, 0.85);
                            const side = pick([-1, 1]);
                            return jag(x + side * pw * 0.3, y, x + side * pw * rnd(1.4, 2.6), y + h * rnd(0.05, 0.3), 2 * s, 0.3);
                        });
                    }
                },
                draw: (ctx, q, t, px) => {
                    const life = q.life;
                    const reach = top + h * clamp(life / 0.05, 0, 1);
                    const hot = life < 0.08;
                    const w = pw * (hot ? 1.5 : 1.1 - 0.5 * t);
                    const a = t > 0.55 ? (1 - t) / 0.45 : 1;
                    const cut = (pts) => pts.filter(([, y]) => y <= reach);
                    // 옅은 빛기둥 (가장자리 지직)
                    const glow = new Path2D();
                    for (let r = 0; top + r * s < reach; r += 2) {
                        const j = (hash(r, q.seed) - 0.5) * w * 0.3;
                        glow.rect(px(x - w * 0.75 + j), px(top + r * s), Math.max(s, px(w * 1.5)), 2 * s);
                    }
                    ctx.globalAlpha = (hot ? 0.6 : 0.3) * a;
                    ctx.fillStyle = hot ? '#ffffff' : cols[2];
                    ctx.fill(glow);
                    // 꼬이는 굵은 번개 + 가지
                    const bw2 = Math.max(1, Math.round(bwid * (hot ? 1.4 : 1 - 0.4 * t)));
                    q.br.forEach((b) => drawBolt(ctx, px, s, cut(b), 1, cols[2], null, a));
                    q.bolts.forEach((b, j) => drawBolt(ctx, px, s, cut(b), j === 1 ? bw2 + 1 : bw2, cols[j === 1 ? 1 : 2], j === 1 ? cols[3] : null, a));
                    // 땅에 닿는 곳
                    if (reach >= bottom) {
                        const r = pw * (hot ? 1.3 : 0.9) * (1 - 0.4 * t);
                        ellipse(ctx, px, s, x, bottom - s, r * 1.6, r * 0.35, cols[1], a, bottom + s);
                        ellipse(ctx, px, s, x, bottom - s, r, r * 0.22, '#ffffff', a, bottom + s);
                    }
                },
            });

            // 땅 — 충격파 · 번쩍 · 튀는 흙과 불똥 · 기어가는 전기
            lit = 0.12;
            screenFlash(s, big ? 0.7 : 0.16, big ? '#ffffff' : cols[1], big ? 0.35 : 0.12);
            ultShake(big ? 8 + 2 * P : 3.5 + 2 * P, big ? 900 : 320);
            ring(sc, x, G - s, pw * 0.5, pw * (big ? 6 : 3.5), 0.25, big ? 0.8 : 0.5, ['#ffffff', cols[1], cols[2]], big ? 3 : 2);
            debris(x, G - 2 * s, s, ['#ffffff', cols[1], cols[2], '#a88a55', '#7a6238'], big ? 50 : 22, H * (big ? 1.3 : 1), { ground: G, size: [1, 2, 2], angle: -Math.PI / 2, spread: 2.2 });
            groundArcs(sc, x, G - s, pw * (big ? 5 : 2.6), big ? 0.9 : 0.5, cols[1], big ? 4 : 2, 1, G);
            glowMark(sc, x, G - s, pw * (big ? 2.2 : 1.3), cols, big ? 1.4 : 1.0);
            for (let j = 0; j < (big ? 8 : 3); j++) {
                puff(x + rnd(-1, 1) * pw, G - rnd(0, 1) * pw, s, '#4a4a5a', pw * 0.2, pw * 0.7, rnd(0.8, 1.2), rnd(-1, 1) * pw * 3, -H * 0.1, 0.35);
            }
            u.others().forEach((r) => {
                if (Math.abs(r.x - x) < pw * (big ? 4 : 1.8) + r.w * 0.5) {
                    hit(r, big ? away(u, r.x) : dir, big ? 'tumble' : 'lift');
                }
            });
        };
        for (let i = 0; i < k; i++) {
            const big = i === k - 1;
            const x = xs + spacing * i;
            sc.at(0.65 + i * 0.27 + (big ? 0.12 : 0), () => pillar(x, pw0 * (1 + i * 0.06) * (big ? 1.5 : 1), big));
        }
        // 맨 끝 — 남은 애들도 전부
        sc.at(0.65 + k * 0.27 + 0.3, () => u.others().forEach((r) => hit(r, away(u, r.x), 'spin')));
    }

    // ═════ ultvolt — 1000만볼트 ═════
    function runVolt(u, o, ms, pokemon) {
        const rainbow = !(o.rainbow === 0 || o.rainbow === false || o.rainbow === '0');
        const cols = sigPal(o.c || 'electric');
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s } = u;
        const G = u.ground;
        const cx = u.body.cx;
        const cy = u.body.cy;
        const MX = !!o.max; // 극대 — 줄기 11개 · 더 굵게 · 네 번 두근 · 마지막에 거대 번개 기둥
        const charge = MX ? 1.15 : 0.9;
        const end = sec - 0.7;
        const pulses = MX ? [charge, charge + 0.7, charge + 1.35, charge + 2] : [charge, charge + 0.85, charge + 1.65];
        const R0 = clamp(short(u) * 0.06, 10, 34) * (0.8 + 0.3 * P) * (MX ? 1.25 : 1);
        const bw = clamp(Math.round((clamp(short(u) * 0.028, 5, 18) * (0.8 + 0.4 * P) * (MX ? 1.35 : 1)) / s), 2, MX ? 10 : 8);
        const nb = MX ? 11 : 7;
        // 색 — 무지개면 번호 · 시간에 따라 돌아감
        const col = (i, t, l = 60) => (rainbow ? hsl(i * 51 + t * 700, l) : l >= 75 ? cols[1] : l <= 50 ? cols[3] : cols[2]);
        const sc = scene(u, sec + 0.3, 'ultvolt');
        ultDark(0.25, ms - 200);
        // ── 모으기 ──
        for (let k = 0; k < (MX ? 5 : 3); k++) {
            sc.at(k * (MX ? 0.22 : 0.28), () => sc.add({ max: 0.45, draw: (ctx, it, t, px) => {
                const r = lerp(Math.max(W, H) * 0.35, R0 * 0.6, easeIn(t));
                ringDots(ctx, px, s, cx, cy, r, 0.85, [col(k, it.life, 70), '#ffffff'], 0.3 + 0.7 * t, 2);
            } }));
        }
        sc.tick((t) => {
            if (t < charge - 0.05 && room(4)) {
                const m = 2 + Math.floor(t * 4);
                for (let j = 0; j < m; j++) {
                    const a = rnd(0, TAU);
                    const r = Math.max(W, H) * rnd(0.12, 0.3);
                    const x0 = cx + Math.cos(a) * r;
                    const y0 = cy + Math.sin(a) * r * 0.8;
                    sigParticle({ x: x0, y: y0, x0, y0, s, max: rnd(0.2, 0.3), color: col(j, t, 70), size: pick([1, 2]),
                        update: (p) => {
                            const k = Math.min(1, (p.life / p.max) ** 2);
                            p.x = p.x0 + (cx - p.x0) * k;
                            p.y = p.y0 + (cy - p.y0) * k;
                        },
                        draw: (ctx, p, tt, px) => {
                            ctx.globalAlpha = Math.min(1, tt * 4);
                            dotAt(ctx, px, p.s, p.x, p.y, p.color, p.size, p.size);
                        } });
                }
            }
        });
        sc.at(0.05, () => {
            ultShake(1.5, 850);
            try {
                pokemon.el.animate([{ translate: `-${s * 0.6}px 0` }, { translate: `${s * 0.6}px 0` }], { duration: 40, iterations: 22, direction: 'alternate', composite: 'add' });
            } catch (err) {
                fail('tremble', err);
            }
        });
        // 모으는 동안 — 하늘까지 솟는 빛기둥, 쏘는 순간 확 퍼졌다 사라짐
        sc.add({ max: charge + 0.2, draw: (ctx, it, t, px) => {
            const life = it.life;
            const k = clamp(life / charge, 0, 1);
            const over = Math.max(0, life - charge) / 0.2;
            const w = Math.max(u.w, 16) * (0.25 + 0.75 * k + 2 * over) * (1 + 0.15 * Math.sin(life * 50));
            const a = (0.2 + 0.6 * k) * (1 - over);
            ctx.globalAlpha = a * 0.45;
            ctx.fillStyle = col(0, life, 55);
            ctx.fillRect(px(cx - w / 2), 0, px(w), px(cy));
            ctx.globalAlpha = a;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(px(cx - w / 7), 0, Math.max(s, px((w * 2) / 7)), px(cy));
            // 기둥 따라 솟는 빛 알갱이
            const path = new Path2D();
            for (let j = 0; j < 14; j++) {
                const y = cy - wrap(hash(j, 1) * cy + life * cy * 1.6, cy);
                path.rect(px(cx + (hash(j, 2) - 0.5) * w), px(y), s, 2 * s);
            }
            ctx.fillStyle = col(2, life, 75);
            ctx.fill(path);
        } });
        // 발밑 고리
        sc.add({ max: end, draw: (ctx, it, t, px) => {
            const k = clamp(it.life / charge, 0, 1);
            const n = 24;
            const rx = Math.max(u.w * 0.7, 12) * (1 + k);
            ctx.globalAlpha = 0.8;
            for (let j = 0; j < n; j++) {
                const a = (j / n) * TAU + it.life * 5;
                dotAt(ctx, px, s, cx + Math.cos(a) * rx, u.ground - s + Math.sin(a) * rx * 0.2, col(j, it.life, 65));
            }
        } });
        // 몸 둘레 지직 — 점점 많고 길게
        sc.add({ max: sec, drawn: -1, arcs: [],
            update: (q) => {
                if (q.life - q.drawn > 0.05) {
                    q.drawn = q.life;
                    const k = clamp(q.life / charge, 0, 1);
                    const fade = clamp((sec - q.life) / 0.5, 0, 1);
                    const m = Math.round((3 + 9 * k) * fade);
                    const R = Math.max(u.body.rx, u.body.ry, 10);
                    q.arcs = [];
                    for (let j = 0; j < m; j++) {
                        const a = rnd(0, TAU);
                        const r1 = R * rnd(1.4, 2.4) * (1 + k * 0.8);
                        q.arcs.push({ i: j, pts: jag(cx + Math.cos(a) * R * 0.6, cy + Math.sin(a) * R * 0.6, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, 2 * s, 0.35) });
                    }
                }
            },
            draw: (ctx, q, t, px) => q.arcs.forEach((a) => drawBolt(ctx, px, s, a.pts, 1, col(a.i, q.life), null, 0.95)),
        });
        // ── 일곱 줄기 — 화면 끝까지 굵게, 0.05초마다 다시 그려 지직, 천천히 돌아감 ──
        const base = rnd(0, TAU);
        const rayEnd = (a) => {
            const c = Math.cos(a);
            const sn = Math.sin(a);
            const m = 10;
            const tx = c > 0 ? (W + m - cx) / c : c < 0 ? (-m - cx) / c : Infinity;
            const ty = sn > 0 ? (G - cy) / sn : sn < 0 ? (-m - cy) / sn : Infinity;
            const tt = Math.max(R0 * 2, Math.min(tx, ty));
            return [cx + c * tt, cy + sn * tt, sn > 0 && ty <= tx];
        };
        const pulseAt = (t) => pulses.reduce((m, p) => (t >= p ? Math.max(m, Math.exp(-(t - p) * 5)) : m), 0);
        sc.add({ max: end + 0.45, drawn: -1, bolts: [], nextSpray: 0,
            update: (q) => {
                const t = sc.t;
                if (t < charge) {
                    return;
                }
                if (q.life - q.drawn > 0.05) {
                    q.drawn = q.life;
                    q.bolts = [];
                    for (let i = 0; i < nb; i++) {
                        const a = base + (i / nb) * TAU + 0.28 * Math.sin(t * 1.1 + i * 1.7) + (t - charge) * 0.22;
                        const [ex, ey, ground] = rayEnd(a);
                        const L = Math.hypot(ex - cx, ey - cy);
                        const pts = jag(cx, cy, ex, ey, Math.max(3 * s, L / 18), 0.3);
                        const br = [];
                        for (let b = 0; b < 3; b++) {
                            const p = branchOf(pts, L * rnd(0.15, 0.32), Math.max(2 * s, L / 30));
                            br.push(p);
                            if (b === 0) {
                                br.push(branchOf(p, L * 0.12, 2 * s));
                            }
                        }
                        q.bolts.push({ i, pts, br, ex, ey, ground });
                    }
                }
                // 끝에서 튀는 불똥
                if (t >= q.nextSpray && t < end) {
                    q.nextSpray = t + 0.09;
                    for (const b of q.bolts) {
                        debris(b.ex, Math.min(b.ey, G - s), s, ['#ffffff', col(b.i, t, 70), col(b.i, t, 55)], 3, H * 0.6, { ground: G });
                    }
                }
            },
            draw: (ctx, q, t, px) => {
                const life = sc.t;
                if (life < charge) {
                    return;
                }
                const a = life > end ? Math.max(0, 1 - (life - end) / 0.45) : 1;
                const pu = pulseAt(life);
                for (const b of q.bolts) {
                    if (pu < 0.3 && hash(b.i, Math.floor(life / 0.03)) < 0.12) {
                        continue; // 깜빡
                    }
                    const w = Math.max(1, Math.round(bw * (1 + 0.7 * pu) * (0.85 + 0.15 * Math.sin(life * 40 + b.i))));
                    b.br.forEach((p) => {
                        fillPts(ctx, px, s, p, Math.max(1, Math.round(w / 2)) + 2, col(b.i, life), a);
                        fillPts(ctx, px, s, p, Math.max(1, Math.round(w / 3)), '#ffffff', a);
                    });
                    fillPts(ctx, px, s, b.pts, w * 2 + 4, col(b.i, life, 48), a * 0.32);
                    fillPts(ctx, px, s, b.pts, w + 2, col(b.i, life, 60), a);
                    fillPts(ctx, px, s, b.pts, Math.max(1, w - 1), col(b.i, life, 82), a);
                    fillPts(ctx, px, s, b.pts, Math.max(1, w - 3), '#ffffff', a);
                }
            },
        });
        // 몸 한가운데 빛 구슬 — 모으며 커지고, 쏠 때마다 두근
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = it.life;
            const k = clamp(life / charge, 0, 1);
            const fade = clamp((sec - life) / 0.6, 0, 1);
            const r = R0 * (0.35 + 0.65 * k) * (1 + 0.5 * pulseAt(life)) * (1 + 0.1 * Math.sin(life * 45)) * (0.4 + 0.6 * fade);
            ellipse(ctx, px, s, cx, cy, r * 1.8, r * 1.8, col(0, life, 50), 0.3 * fade);
            ellipse(ctx, px, s, cx, cy, r * 1.3, r * 1.3, col(1, life, 62), fade);
            ellipse(ctx, px, s, cx, cy, r, r, col(2, life, 80), fade);
            ellipse(ctx, px, s, cx, cy, r * 0.6, r * 0.6, '#ffffff', fade);
            const rays = 12;
            const path = new Path2D();
            for (let j = 0; j < rays; j++) {
                const a = life * (3 + 5 * k) + (j / rays) * TAU;
                const len = r * (j % 2 ? 2.2 : 3.3) * (0.8 + 0.2 * Math.sin(life * 30 + j));
                for (let d = r * 1.2; d < len; d += s) {
                    path.rect(px(cx + Math.cos(a) * d), px(cy + Math.sin(a) * d), s, s);
                }
            }
            ctx.globalAlpha = (0.4 + 0.6 * k) * fade;
            ctx.fillStyle = '#ffffff';
            ctx.fill(path);
        } });
        // ── 쏘기 · 두근 ──
        pulses.forEach((t, k) => sc.at(t, () => {
            const first = k === 0;
            screenFlash(s, first ? 0.8 : 0.4, '#ffffff', first ? 0.3 : 0.18);
            sc.at(t + 0.07, () => screenFlash(s, 0.3, col(k * 2, t, 70), 0.22));
            ultShake(first ? 8 + 3 * P : 5 + 2 * P, first ? 1000 : 600);
            const reach = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy));
            for (let j = 0; j < (first ? 4 : 2); j++) {
                sc.at(t + j * 0.11, () => ring(sc, cx, cy, R0, reach * (1.05 - j * 0.15), 0.8, 0.7, rainbow ? [hsl(j * 90 + t * 300, 70), '#ffffff', hsl(j * 90 + 180, 60)] : ['#ffffff', cols[1], cols[2]], 3 - Math.min(2, j)));
            }
            groundArcs(sc, cx, G - s, W * (first ? 0.55 : 0.4), 0.9, (life) => col(k + 3, life + t, 65), first ? 6 : 4, 1, G);
            debris(cx, cy, s, rainbow ? ['#ffffff', '#fff59d', '#ff7ad9', '#6fdcff', '#9dff6f'] : ['#ffffff', cols[1], cols[2]], first ? 60 : 30, H * 1.3, { ground: G });
            if (first) {
                strike(sc, cx + rnd(-0.05, 0.05) * W, -4, cx, cy, { w: bw, rainbow, hue: 0, mid: cols[2], glow: cols[3], dur: 0.5, branches: 3 });
            }
        }));
        // 다른 포켓몬 — 충격파가 닿는 순서로 튕겨 나감
        u.others().forEach((r) => {
            const d = Math.hypot(r.x - cx, r.y - cy);
            sc.at(charge + 0.05 + d / (Math.max(W, H) * 1.8), () => {
                const q = where(u, r);
                ultHit(q, away(u, q.x), 'tumble');
                sparkles(q.x, q.y, s, rainbow ? ['#ffffff', '#ff7ad9', '#6fdcff'] : cols, 8, q.w * 0.6, H * 0.2);
            });
        });
        // 하늘 번개 — 화면 여기저기
        let nextSky = charge + 0.15;
        let hue = 0;
        sc.tick((t) => {
            if (t >= nextSky && t < end) {
                nextSky = t + (MX ? rnd(0.06, 0.12) : rnd(0.12, 0.22));
                hue += 70;
                const x = rnd(0.04, 0.96) * W;
                const gy = G - rnd(0, H * 0.04);
                strike(sc, x + rnd(-1, 1) * W * 0.05, -4, x, gy, { w: Math.max(2, bw - 1), rainbow, hue, mid: cols[2], glow: cols[3], dur: 0.3, branches: 2 });
                ring(sc, x, G - s, s * 2, W * 0.12, 0.25, 0.35, rainbow ? [hsl(hue, 70), '#ffffff'] : ['#ffffff', cols[1]], 1);
                debris(x, gy, s, ['#ffffff', col(hue / 51, t, 70)], 6, H * 0.6, { ground: G });
            }
            // 쏟아지는 불똥
            if (t > charge && t < end && room(2)) {
                const m = Math.random() < 0.5 ? 1 : 2;
                for (let j = 0; j < m; j++) {
                    sigParticle({ x: rnd(0, W), y: -4, s, vx: rnd(-20, 20), vy: H * rnd(0.6, 1), g: H * 0.6, max: rnd(0.8, 1.3), color: col(j * 3 + Math.floor(t * 10), t, 70), size: pick([1, 1, 2]), ground: G, hop: 0,
                        update: (p) => {
                            if (p.y > p.ground && p.vy > 0) {
                                p.y = p.ground;
                                p.vy *= -0.3;
                                if (++p.hop > 1) {
                                    p.life = p.max;
                                }
                            }
                        },
                        draw: DRAW.dot });
                }
            }
        });
        // 극대 — 마지막 두근 뒤 하늘에서 거대한 무지개 번개 기둥이 몸으로 · 화면이 하얗게 · 화면 끝까지 고리 여러 겹
        if (MX) {
            const fin = pulses[pulses.length - 1] + 0.35;
            sc.at(fin, () => {
                screenFlash(s, 0.95, '#ffffff', 0.45);
                sc.at(fin + 0.1, () => screenFlash(s, 0.45, col(5, fin, 70), 0.3));
                ultShake(12, 1200);
                for (let j = -1; j <= 1; j++) {
                    strike(sc, cx + j * Math.max(u.w, 16) * 0.6, -4, cx + j * Math.max(u.w, 16) * 0.2, cy, { w: Math.round(bw * (j ? 1.3 : 2.2)), rainbow, hue: j * 60, mid: cols[2], glow: cols[3], dur: 0.7, branches: j ? 3 : 5 });
                }
                const reach = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy));
                for (let j = 0; j < 6; j++) {
                    sc.at(fin + j * 0.08, () => ring(sc, cx, cy, R0, reach * (1.15 - j * 0.1), 0.75, 0.8, rainbow ? [hsl(j * 60 + fin * 300, 70), '#ffffff', hsl(j * 60 + 180, 60)] : ['#ffffff', cols[1], cols[2]], 3));
                }
                groundArcs(sc, cx, G - s, W, 1.1, (life) => col(7, life + fin, 65), 10, 1, G);
                debris(cx, cy, s, rainbow ? ['#ffffff', '#fff59d', '#ff7ad9', '#6fdcff', '#9dff6f'] : ['#ffffff', cols[1], cols[2]], 110, H * 1.6, { ground: G });
                u.others().forEach((r) => ultHit(where(u, r), away(u, r.x), 'spin'));
            });
        }
        // 끝 — 연기
        sc.at(end, () => {
            for (let k = 0; k < 6; k++) {
                puff(cx + rnd(-1, 1) * u.w, cy + rnd(-0.5, 0.5) * u.h, s, '#5a5a6a', u.w * 0.2, u.w * 0.7, rnd(0.8, 1.2), rnd(-20, 20), -H * 0.15, 0.35);
            }
        });
    }

    // ═════ ultswarm — 화면 가득 날리기 / 거대한 것 하나 ═════
    const SWARM_C = { needle: 'bug', star: 'star', ball: 'ghost', rock: 'rock', leaf: 'grass', coin: 'gold', egg: 'egg', bone: 'bone', heart: 'fairy', shuriken: 'water' };
    const HEAVY = { rock: 1, egg: 1, coin: 1, bone: 1 };
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
            // 날아가는 쪽으로 — 하얀 끝 · 굵은 몸통
            const ax = q.vx / sp;
            const ay = q.vy / sp;
            const c = [cols[0], cols[0], cols[1], cols[2], cols[2], cols[3], cols[3], cols[3]];
            const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
            for (let k = 0; k < c.length; k++) {
                const ci = [cols[0], cols[1], cols[2], cols[3]].indexOf(c[k]);
                paths[ci].rect(px(q.x - ax * k * cs), px(q.y - ay * k * cs), cs, cs);
            }
            fillPaths(ctx, paths, [cols[0], cols[1], cols[2], cols[3]], ctx.globalAlpha);
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

    function runSwarm(u, o, ms, pokemon) {
        const hit = makeHit();
        const shape = SHAPES[o.shape] || o.shape === 'shuriken' ? o.shape : 'star';
        const cols = sigPal(o.c || SWARM_C[shape]);
        const P = strength(u);
        const n = clamp(Math.round(o.n ?? 30 + 14 * P), 6, 80);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        // 날리는 것 한 칸 — 패널이 크면 크게
        const cs = Math.max(s, Math.round(short(u) / 75));
        const pxc = (v) => Math.round(v / cs) * cs;
        const waves = n >= 18 ? 4 : 3;
        const per = Math.ceil(n / waves);
        const gap = 0.38;
        const t0 = 0.4;
        const sc = scene(u, sec + 0.3, 'ultswarm');
        const heavy = HEAVY[shape];
        const ox = u.mouth.x;
        const oy = u.mouth.y;
        const R = Math.max(u.w, 24);
        let targets = u.others();
        let nextLook = 0;
        sc.tick((t) => {
            if (t >= nextLook) {
                nextLook = t + 0.12;
                targets = u.others();
            }
        });
        const hits = new Map();
        ultDark(0.22, ms - 200);
        // 뒤에 깔리는 속도선 — 날리는 쪽으로 휙휙
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const a = clamp((it.life - 0.3) / 0.3, 0, 1) * clamp((sec - 0.4 - it.life) / 0.4, 0, 1);
            if (a <= 0) {
                return;
            }
            const path = new Path2D();
            const m = Math.round(22 * clamp(W / 480, 0.6, 2));
            for (let j = 0; j < m; j++) {
                const len = W * (0.1 + 0.2 * hash(j, 2));
                const span = W + len * 2;
                const x = wrap(hash(j, 3) * span + dir * W * (2 + hash(j, 4)) * it.life, span, -len);
                path.rect(px(dir > 0 ? x - len : x), px(hash(j, 1) * G), px(len), s);
            }
            ctx.globalAlpha = 0.25 * a;
            ctx.fillStyle = cols[1];
            ctx.fill(path);
        } });
        // 멀리 — 작고 옅은 것들이 끝없이 쏟아짐 (깊이감 · 화면 가득)
        const tEnd = t0 + waves * gap + 0.3;
        sc.add({ max: sec, draw: (ctx, it) => {
            const life = it.life;
            const a = clamp((life - t0) / 0.3, 0, 1) * clamp((tEnd + 0.5 - life) / 0.5, 0, 1);
            if (a <= 0) {
                return;
            }
            const m = Math.round(34 * clamp(W / 480, 0.6, 2));
            for (let j = 0; j < m; j++) {
                const cyc = 0.9 + 0.5 * hash(j, 1);
                const tt = life + hash(j, 2) * 3;
                const k = (tt % cyc) / cyc;
                const seed = Math.floor(tt / cyc) * 13 + j;
                const ang = lerp(-1.15, -0.05, hash(seed, 3));
                const dist = k * W * 1.1;
                ctx.globalAlpha = 0.5 * a * (1 - k * 0.5);
                drawShot(ctx, shape, { x: ox + dir * Math.cos(ang) * dist, y: oy + Math.sin(ang) * dist, vx: dir * Math.cos(ang), vy: Math.sin(ang), life: tt }, s, cols);
            }
        } });
        // 쓰는 애 둘레에 하나씩 나타나 맴돎 → 첫 물결로 날아감
        const halo = (j) => {
            const a = (j / per) * TAU + sc.t * 4;
            return [u.body.cx + Math.cos(a) * R * 1.3, u.body.cy - u.h * 0.3 + Math.sin(a) * R * 0.7];
        };
        sc.add({ max: t0, draw: (ctx, it, t, px) => {
            for (let j = 0; j < per; j++) {
                const k = clamp((it.life / t0) * per * 1.3 - j, 0, 1);
                if (k <= 0) {
                    continue;
                }
                const [x, y] = halo(j);
                ctx.globalAlpha = k;
                drawShot(ctx, shape, { x, y, vx: Math.cos((j / per) * TAU) || dir, vy: Math.sin((j / per) * TAU), life: it.life + j * 0.03 }, cs, cols);
            }
            ringDots(ctx, px, s, u.body.cx, u.body.cy - u.h * 0.3, R * (1.9 - 0.5 * t), 0.6, [cols[1], '#ffffff'], 0.7 * t, 2);
        } });
        // 맞은 자리 — 별 모양으로 번쩍
        const pop = (x, y, big) => {
            sc.add({ max: big ? 0.35 : 0.25, draw: (ctx, it, t, px) => {
                const len = Math.round(2 + t * (big ? 10 : 6));
                const path = [new Path2D(), new Path2D()];
                for (let i = 0; i < 8; i++) {
                    const a = (i / 8) * TAU;
                    for (let k = Math.round(t * 3) + 1; k <= len; k++) {
                        path[k === len ? 0 : 1].rect(px(x + Math.cos(a) * k * s), px(y + Math.sin(a) * k * s), s, s);
                    }
                }
                const r = Math.round(1 + t * (big ? 3 : 2));
                path[0].rect(px(x - r * s), px(y - r * s), (2 * r + 1) * s, (2 * r + 1) * s);
                fillPaths(ctx, path, ['#ffffff', cols[2]], 1 - t * t);
            } });
            debris(x, y, s, cols, big ? 12 : 5, H * 0.55, { ground: G });
            if (big) {
                ring(sc, x, y, s * 2, R * 1.6, 0.8, 0.35, ['#ffffff', cols[1]], 2);
            }
        };
        const fire = (w, j) => {
            const last = w === waves - 1;
            // 부채꼴로 쓸듯이 — 물결마다 위→아래 / 아래→위
            const f = per > 1 ? j / (per - 1) : 0.5;
            const sweep = w % 2 ? f : 1 - f;
            let ang = lerp(-1.15, -0.02, sweep) + rnd(-0.06, 0.06);
            const aimed = targets.length && (j % 3 === 1 || (last && j % 2 === 0)) ? targets[(j + w) % targets.length] : null;
            const [sx, sy] = w === 0 ? halo(j) : [ox + rnd(-1, 1) * s * 2, oy + rnd(-1, 1) * s * 2];
            const speed = Math.max(180, W * rnd(0.5, 0.7));
            let vx = dir * Math.cos(ang) * speed;
            let vy = Math.sin(ang) * speed;
            let g = 0;
            if (w === 2 && waves > 3 && !aimed) {
                // 높이 던져 올려 들판에 쏟아짐
                g = H * 3;
                const xt = lerp(u.body.cx + dir * W * 0.12, dir > 0 ? W * 0.98 : W * 0.02, (j + rnd(0, 1)) / per);
                vy = -Math.sqrt(2 * g * Math.max(20, sy - H * 0.08));
                const tl = (-vy + Math.sqrt(vy * vy + 2 * g * Math.max(0, G - sy))) / g;
                vx = (xt - sx) / tl;
            } else if (aimed) {
                const dist = Math.hypot(aimed.x - sx, aimed.y - sy) || 1;
                vx = ((aimed.x - sx) / dist) * speed;
                vy = ((aimed.y - sy) / dist) * speed;
                if (heavy) {
                    g = H * 1.2;
                    vy -= (g * dist) / speed / 2;
                }
            } else if (heavy) {
                g = H * 0.8;
                vy -= H * 0.2;
            }
            sc.add({ max: 3, x: sx, y: sy, vx, vy, trail: [], done: new Set(),
                update: (q, dt) => {
                    q.vy += g * dt;
                    q.x += q.vx * dt;
                    q.y += q.vy * dt;
                    q.trail.unshift([q.x, q.y]);
                    q.trail.length = Math.min(q.trail.length, 9);
                    for (const r of targets) {
                        if (!q.done.has(r.pokemon) && Math.abs(q.x - r.x) < r.w * 0.45 + cs * 1.5 && Math.abs(q.y - r.y) < r.h * 0.5 + cs * 1.5) {
                            q.done.add(r.pokemon);
                            const c = (hits.get(r.pokemon) || 0) + 1;
                            hits.set(r.pokemon, c);
                            pop(q.x, q.y, c >= 3);
                            hit(r, Math.sign(q.vx) || dir, c >= 3 || last ? 'tumble' : 'shake');
                            if (c % 2 === 0) {
                                ultShake(2.5, 160);
                            }
                            q.max = 0;
                            return;
                        }
                    }
                    if (q.y >= G - cs && q.vy > 0) {
                        pop(q.x, G - cs, false);
                        q.max = 0;
                    } else if (q.x < -40 || q.x > W + 40 || q.y < -H) {
                        q.max = 0;
                    }
                },
                draw: (ctx, q, t, px) => {
                    // 꼬리 — 뒤로 갈수록 옅게
                    if (q.trail.length > 2) {
                        const pts = q.trail.slice(1);
                        fillPts(ctx, pxc, cs, pts, 1, cols[1], 0.35);
                        fillPts(ctx, pxc, cs, pts.slice(0, 4), 1, cols[0], 0.5);
                    }
                    if (shape === 'star' || shape === 'heart' || shape === 'coin') {
                        const [x, y] = q.trail[5] || [q.x, q.y];
                        ctx.globalAlpha = 0.9;
                        dotAt(ctx, px, s, x + rnd(-2, 2) * s, y + rnd(-2, 2) * s, '#ffffff');
                    }
                    ctx.globalAlpha = 1;
                    drawShot(ctx, shape, q, cs, cols);
                },
            });
        };
        let fired = 0;
        for (let w = 0; w < waves; w++) {
            const tw = t0 + w * gap;
            sc.at(tw, () => {
                screenFlash(s, w === waves - 1 ? 0.3 : 0.14, cols[0], 0.14);
                ring(sc, ox, oy, s * 2, R * 1.8, 0.8, 0.3, ['#ffffff', cols[1]], 2);
                sparkles(ox, oy, s, cols, 5, s * 3, H * 0.1);
                ultShake(w === waves - 1 ? 3.5 : 2, 220);
                try {
                    pokemon.el.animate([{ translate: `${-dir * 3 * s}px 0` }, { translate: '0 0' }], { duration: 200, easing: 'ease-out', composite: 'add' });
                } catch (err) {
                    fail('recoil', err);
                }
            });
            for (let j = 0; j < per && fired < n; j++, fired++) {
                sc.at(tw + j * (0.26 / per), () => fire(w, j));
            }
        }
        // 마지막 — 여러 번 맞은 애 둘레가 번쩍
        sc.at(t0 + waves * gap + 0.6, () => {
            for (const [p, c] of hits) {
                if (c >= 2) {
                    const r = u.others().find((q) => q.pokemon === p);
                    if (r) {
                        ring(sc, r.x, r.y, s * 2, r.w * 2, 0.8, 0.45, ['#ffffff', cols[1]], 2);
                        sparkles(r.x, r.y, s, cols, 10, r.w * 0.7, H * 0.2);
                    }
                }
            }
        });
    }

    // 거대 표창 — 칸마다 날 안인지 따져서 그림 (돌아가도 도트 그대로)
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
                // 표창은 날이 휘고, 별은 곧은 네 꼭지
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

    function runGiantThrow(u, o, ms, pokemon) {
        const shape = SHAPES[o.shape] && o.shape !== 'shuriken' ? o.shape : 'shuriken';
        const cols = sigPal(o.c || SWARM_C[shape] || 'water');
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const D = Math.min(Math.max(H / 3, short(u) * 0.38) * (0.88 + 0.2 * P), W * 0.4, H * 0.6);
        const C = s * Math.max(1, Math.round(D / (26 * s)));
        const sx = clamp(u.body.cx + dir * (u.w * 0.5 + D * 0.55), D * 0.5, W - D * 0.5);
        const sy = clamp(G - D * 0.5, D * 0.5 + 2, G - D * 0.3);
        const fx = dir > 0 ? W - D * 0.3 : D * 0.3;
        const yr = Math.max(D * 0.55, sy - D * 0.95);
        const tForm = 0.7;
        const tTurn = 1.5;
        const tBack = 1.8;
        const tCatch = 2.55;
        const sc = scene(u, sec + 0.3, 'ultswarm');
        // 거대한 것 — 표창은 칸마다 돌려 그림, 나머지 모양은 SHAPES 를 아주 크게 (모양마다 도는 그림)
        const giant = (ctx, x, y, size, a, alpha, life) => {
            if (shape === 'shuriken' || shape === 'star') {
                drawBigShuriken(ctx, x, y, size, C, a, cols, alpha, shape === 'star');
                return;
            }
            const cell = Math.max(s, Math.round(size / 6 / s) * s);
            const px = (v) => Math.round(v / cell) * cell;
            ctx.globalAlpha = alpha;
            (SHAPES[shape] || SHAPES.star)(ctx, { x, y, s: cell, dir, cols, big: true, life: life * 0.6 }, px);
        };
        // 자리 — 나감 · 돌아섬 · 돌아옴
        const pos = (t) => {
            if (t < tForm) {
                return [sx, sy];
            }
            if (t < tTurn) {
                const k = (t - tForm) / (tTurn - tForm);
                return [lerp(sx, fx, 1 - (1 - k) ** 2), sy - Math.sin(k * Math.PI) * D * 0.12];
            }
            if (t < tBack) {
                const k = (t - tTurn) / (tBack - tTurn);
                return [fx + dir * D * 0.12 * Math.sin(k * Math.PI), lerp(sy, yr, k * k * (3 - 2 * k))];
            }
            const k = clamp((t - tBack) / (tCatch - tBack), 0, 1);
            return [lerp(fx, u.body.cx, k * k), yr + Math.sin(k * Math.PI) * D * 0.15 + (u.body.cy - yr) * k ** 3];
        };
        let ang = 0;
        let spin = 0;
        const hist = [];
        const cut = new Set();
        sc.tick((t, dt) => {
            spin = t < tForm ? 4 + 18 * (t / tForm) : 22;
            ang += spin * dt * dir;
            hist.unshift([...pos(t), ang]);
            hist.length = Math.min(hist.length, 8);
        });
        // 모으기 — 물이 소용돌이치며 모여 표창이 커짐
        sc.tick((t) => {
            if (t < tForm - 0.1 && room(3)) {
                for (let j = 0; j < 3; j++) {
                    const a0 = rnd(0, TAU);
                    const r0 = D * rnd(0.8, 1.3);
                    sigParticle({ x: sx, y: sy, s, max: rnd(0.3, 0.4), a0, r0, color: pick(cols),
                        update: (p) => {
                            const k = p.life / p.max;
                            const a = p.a0 + k * 5 * dir;
                            const r = p.r0 * (1 - k);
                            p.x = sx + Math.cos(a) * r;
                            p.y = sy + Math.sin(a) * r * 0.8;
                        },
                        draw: DRAW.dot });
                }
            }
        });
        sc.add({ max: tForm, draw: (ctx, it, t, px) => ringDots(ctx, px, s, sx, sy, D * (1.1 - 0.5 * t), 0.85, [cols[1], '#ffffff'], t, 2) });
        // 잔상 · 물보라 꼬리
        sc.add({ max: tCatch, draw: (ctx, it, t, px) => {
            if (sc.t < tForm) {
                return;
            }
            for (let k = 6; k >= 2; k -= 2) {
                const h = hist[k];
                if (h) {
                    giant(ctx, h[0], h[1], D, h[2], 0.12 + (6 - k) * 0.05, sc.t - k * 0.016);
                }
            }
            // 속도선
            const path = new Path2D();
            const [x, y] = pos(sc.t);
            const [x2, y2] = hist[7] || [x, y];
            for (let j = 0; j < 8; j++) {
                const oy2 = (j / 7 - 0.5) * D * 0.9;
                const len = Math.hypot(x - x2, y - y2) * 1.8 + D * 0.3;
                const ux = (x - x2) / (Math.hypot(x - x2, y - y2) || 1);
                const uy = (y - y2) / (Math.hypot(x - x2, y - y2) || 1);
                for (let d = D * 0.4; d < len; d += 2 * s) {
                    path.rect(px(x - ux * d - uy * oy2), px(y - uy * d + ux * oy2), s, s);
                }
            }
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = '#ffffff';
            ctx.fill(path);
        } });
        // 표창
        sc.add({ max: tCatch + 0.12, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp(life / tForm, 0, 1);
            let size = D * easeOut(k);
            if (life > tCatch) {
                size *= 1 - (life - tCatch) / 0.12;
            }
            if (size < C * 2) {
                return;
            }
            const [x, y] = pos(life);
            giant(ctx, x, y, size, ang, 1, life);
            // 테두리 반짝
            ctx.globalAlpha = 0.8;
            for (let j = 0; j < 4; j++) {
                const a = ang + (j / 4) * TAU + 0.6;
                dotAt(ctx, px, s, x + Math.cos(a) * size * 0.47, y + Math.sin(a) * size * 0.47, '#ffffff', 2, 2);
            }
        } });
        // 날아가는 동안 — 물보라, 지나가며 베기
        sc.tick((t) => {
            if (t < tForm || t > tCatch) {
                return;
            }
            const [x, y] = pos(t);
            if (room(4)) {
                for (let j = 0; j < 2; j++) {
                    const a = rnd(0, TAU);
                    sigParticle({ x: x + Math.cos(a) * D * 0.45, y: y + Math.sin(a) * D * 0.45, s, vx: Math.cos(a + Math.PI / 2 * dir) * H * 0.4, vy: Math.sin(a + Math.PI / 2 * dir) * H * 0.4, g: H * 1.2, drag: 1, max: rnd(0.3, 0.6), color: pick(cols), size: pick([1, 2]), draw: DRAW.dot });
                }
            }
            for (const r of u.others()) {
                const key = r.pokemon;
                const pass = t < tBack ? 1 : 2;
                if (!cut.has(key) && Math.abs(x - r.x) < D * 0.45 + r.w * 0.3 && Math.abs(y - r.y) < D * 0.5 + r.h * 0.3) {
                    cut.add(key);
                    const vdir = pass === 1 ? dir : -dir;
                    // 베인 자국 — 큰 X
                    sc.add({ max: 0.45, draw: (ctx, it, tt, px) => {
                        const L = Math.max(r.w, r.h) * 0.9 + 6 * s;
                        const shown = Math.min(1, it.life / 0.06);
                        const paths = [new Path2D(), new Path2D()];
                        for (const f of [1, -1]) {
                            for (let d = -L / 2; d < -L / 2 + L * shown; d += s) {
                                paths[0].rect(px(r.x + d), px(r.y + f * d * 0.7), s, s);
                                paths[1].rect(px(r.x + d), px(r.y + f * d * 0.7 + s), s, s);
                            }
                        }
                        fillPaths(ctx, paths, ['#ffffff', cols[2]], tt > 0.5 ? (1 - tt) / 0.5 : 1);
                    } });
                    screenFlash(s, 0.25, '#ffffff', 0.12);
                    ultShake(4, 250);
                    debris(r.x, r.y, s, cols, 16, H * 0.8, { ground: G });
                    ring(sc, r.x, r.y, s * 2, r.w * 1.6, 0.8, 0.35, ['#ffffff', cols[1]], 2);
                    ultHit(r, vdir, 'tumble');
                }
            }
        });
        sc.at(tForm, () => {
            screenFlash(s, 0.35, cols[0], 0.2);
            ultShake(3, 250);
            ring(sc, sx, sy, D * 0.3, D * 1.2, 0.8, 0.4, ['#ffffff', cols[1]], 2);
            try {
                pokemon.el.animate([{ translate: `${-dir * 4 * s}px 0` }, { translate: '0 0' }], { duration: 250, easing: 'ease-out', composite: 'add' });
            } catch (err) {
                fail('recoil', err);
            }
        });
        // 받음 — 펑 물보라
        sc.at(tCatch, () => {
            screenFlash(s, 0.5, cols[0], 0.3);
            ultShake(5, 400);
            ring(sc, u.body.cx, u.body.cy, s * 2, D * 1.6, 0.8, 0.5, ['#ffffff', cols[1], cols[2]], 2);
            debris(u.body.cx, u.body.cy, s, cols, 40, H * 1.1, { ground: G, size: [1, 2, 2] });
            sparkles(u.body.cx, u.body.cy, s, ['#ffffff', cols[0], cols[1]], 14, u.w, H * 0.25);
        });
    }

    // ═════ 개굴닌자 — ninja: 거대 물수리검 / clones: 그림자분신 물수리검 ═════
    // 물빛 테두리 — 그림에 거는 CSS filter (흐림 없이 상하좌우로 밀어 찍어 도트 그대로). 필살기가 끝나면 core 가 지움
    const waterAura = (s) => {
        const d = Math.max(1, Math.round(s * 0.75));
        return `drop-shadow(${d}px 0 0 #8fe3ff) drop-shadow(-${d}px 0 0 #8fe3ff) drop-shadow(0 ${d}px 0 #4fb4ff) drop-shadow(0 -${d}px 0 #c8f4ff)`;
    };
    // 캔버스에 그릴 때 뒤집을지 — _left_ 그림은 이미 왼쪽을 봄
    const faceFlip = (img, left) => left !== (img.src || '').includes('_left_');
    // 한 색 실루엣 (번쩍 · 테두리) — 그림이 바뀔 수 있어 0.1초마다 새로
    const silCache = new Map();
    function silhouette(img, w, h, color) {
        w = Math.max(1, Math.round(w));
        h = Math.max(1, Math.round(h));
        const key = `${img.src}|${color}|${w}|${h}`;
        let c = silCache.get(key);
        if (!c) {
            if (silCache.size > 24) {
                silCache.clear();
            }
            c = { cv: document.createElement('canvas'), t: -1e9 };
            silCache.set(key, c);
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
    // 포켓몬 그림 (발 가운데 x · bottom, 몸 가운데를 축으로 rot 만큼 기울임) — color 면 그 색 실루엣
    function drawMon(ctx, img, x, bottom, w, left, alpha = 1, color = null, rot = 0) {
        if (!img?.naturalWidth || w < 2 || alpha <= 0.01) {
            return;
        }
        const h = w * (img.naturalHeight / img.naturalWidth);
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = Math.min(1, alpha);
        ctx.translate(Math.round(x), Math.round(bottom - h / 2));
        if (rot) {
            ctx.rotate(rot);
        }
        if (faceFlip(img, left)) {
            ctx.scale(-1, 1);
        }
        ctx.drawImage(color ? silhouette(img, w, h, color) : img, -w / 2, -h / 2, w, h);
        ctx.restore();
    }
    // 테두리 두른 그림 — 상하좌우로 d 만큼 밀어 찍은 실루엣 위에 그림
    function drawLitMon(ctx, img, x, bottom, w, left, edgeColor, d, alpha = 1, rot = 0) {
        for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) {
            drawMon(ctx, img, x + dx, bottom + dy, w, left, alpha * 0.9, edgeColor, rot);
        }
        drawMon(ctx, img, x, bottom, w, left, alpha, null, rot);
    }
    // 쓰는 애의 진짜 그림 자리 · 크기 — 꼭두각시를 똑같은 곳에 그려서 바꿔치기가 티 나지 않게
    function monBox(pokemon) {
        const r = pokemon.el.getBoundingClientRect();
        return { x: r.left + r.width / 2, b: r.bottom, w: r.width, h: r.height };
    }
    // 진짜 그림 숨기기 — visibility 만으로는 그림이 남아 보일 때가 있어(점검 화면에서 확인) 투명도까지.
    // 장면이 끊겨도(패널이 가려짐) 그림이 사라진 채 남지 않게 끝날 때 타이머로 한 번 더 되돌림
    function hideMon(pokemon, on) {
        const el = pokemon.el;
        ultHide(pokemon, on);
        if (on && el.ninjaOpacity === undefined) {
            el.ninjaOpacity = [el.style.getPropertyValue('opacity'), el.style.getPropertyPriority('opacity')];
            el.style.setProperty('opacity', '0', 'important');
        } else if (!on && el.ninjaOpacity !== undefined) {
            const [v, pri] = el.ninjaOpacity;
            el.ninjaOpacity = undefined;
            if (v) {
                el.style.setProperty('opacity', v, pri);
            } else {
                el.style.removeProperty('opacity');
            }
        }
    }
    function hideUntil(pokemon, ms) {
        setTimeout(() => {
            try {
                hideMon(pokemon, false);
            } catch (err) {
                fail('show', err);
            }
        }, ms);
    }
    // 악 타입 보랏빛 — 잔상 · 분신 연기 · 베기 테두리 (물빛과 둘이서)
    const DARK = SIG_PALETTE.dark;
    // 보랏빛 연기 펑
    function darkPoof(sc, x, y, r) {
        const s = sc.u.S;
        for (let j = 0; j < 4; j++) {
            puff(x + rnd(-1, 1) * r * 0.5, y + rnd(-1, 1) * r * 0.3, s, pick(['#b9a8e6', DARK[1], '#d8d0f0']), r * 0.25, r * 0.7, rnd(0.35, 0.5), rnd(-1, 1) * 20, -rnd(10, 30), 0.55);
        }
        ring(sc, x, y, s * 2, r * 1.5, 0.8, 0.3, ['#ffffff', DARK[1]], 2);
    }
    // 표창 조각 — 터질 때 작은 표창들이 사방으로 튀어 떨어짐
    function shards(x, y, s, cell, cols, n, speed, ground) {
        n = Math.min(n, Math.max(0, LIVE_MAX - moveParticles.length));
        for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU + rnd(-0.2, 0.2);
            const sp = speed * rnd(0.6, 1);
            sigParticle({ x, y, s: cell, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - speed * 0.2, g: speed * 1.6, drag: 0.8, max: rnd(0.6, 0.9), ground,
                update: (p) => {
                    if (p.y > p.ground) {
                        p.y = p.ground;
                        p.vy = 0;
                        p.vx *= 0.5;
                    }
                },
                draw: (ctx, p, t, px) => {
                    ctx.globalAlpha = Math.min(1, (1 - t) * 1.5);
                    miniShuriken(ctx, px, p.s, p.x, p.y, p.life, cols);
                } });
        }
    }
    // 물 띠 꼬리 — pts 는 지금 자리부터 뒤로. 앞이 굵고(w0 칸) 뒤로 갈수록 가늘게, 바깥 물색 · 안 밝게 · 심 하얗게
    // (2칸마다 굵기를 다시 재서 — 빨리 날아 점 사이가 멀어도 계단 없이 부드럽게 가늘어짐)
    function waterRibbon(ctx, px, s, pts, w0, cols, alpha = 1) {
        if (pts.length < 2 || alpha <= 0.01) {
            return;
        }
        let total = 0;
        for (let i = 1; i < pts.length; i++) {
            total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        }
        if (total < s) {
            return;
        }
        const paths = [new Path2D(), new Path2D(), new Path2D()];
        const step = 2 * s;
        let along = 0;
        for (let i = 1; i < pts.length; i++) {
            const [x0, y0] = pts[i - 1];
            const [x1, y1] = pts[i];
            const L = Math.hypot(x1 - x0, y1 - y0);
            for (let d = 0; d < L; d += step) {
                const k = 1 - (along + d) / total;
                const x = x0 + ((x1 - x0) * d) / L;
                const y = y0 + ((y1 - y0) * d) / L;
                const w = w0 * s * k;
                for (const [path, f] of [[paths[0], 1], [paths[1], 0.55], [paths[2], 0.2]]) {
                    const size = Math.round((w * f) / s) * s;
                    if (size >= s) {
                        path.rect(px(x - size / 2), px(y - size / 2), size, size);
                    }
                }
            }
            along += L;
        }
        fillPaths(ctx, paths, [cols[2], cols[1], '#ffffff'], alpha);
    }
    // 반짝 — 십자 빛살 (r 길이)
    function glint(ctx, px, s, x, y, r, alpha) {
        const paths = [new Path2D(), new Path2D()];
        const n = Math.max(2, Math.round(r / s));
        for (let i = 1; i <= n; i++) {
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                paths[i < n * 0.5 ? 0 : 1].rect(px(x + dx * i * s), px(y + dy * i * s), s, s);
            }
        }
        paths[0].rect(px(x - s), px(y - s), 3 * s, 3 * s);
        fillPaths(ctx, paths, ['#ffffff', '#bfe9ff'], alpha);
    }
    // 물기둥 — 땅(G)에서 솟았다 무너짐 (hw 반폭 · hTop 높이 · dur 초). 꼭대기에서 물보라가 튀고 밑동엔 물결
    function geyser(sc, x, G, hw, hTop, dur, cols) {
        const s = sc.u.S;
        let spray = 0;
        const it = sc.add({ max: dur,
            update: (it, dt) => {
                const t = it.life / dur;
                if (t > 0.55) {
                    return;
                }
                spray += dt * 50;
                const top = G - hTop * easeOut(t / 0.3);
                while (spray >= 1) {
                    spray -= 1;
                    if (!room()) {
                        continue;
                    }
                    const a = -Math.PI / 2 + rnd(-0.9, 0.9);
                    const sp = hTop * rnd(0.4, 0.9);
                    sigParticle({ x: x + rnd(-1, 1) * hw * 0.5, y: top, s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: hTop * 2.4, drag: 0.4, max: rnd(0.5, 0.9), color: pick(cols), size: pick([1, 2, 2]), draw: DRAW.dot });
                }
            },
            draw: (ctx, it, t, px) => {
                const up = easeOut(t / 0.3);
                const down = t > 0.5 ? easeIn((t - 0.5) / 0.5) : 0;
                const top = G - hTop * up * (1 - 0.9 * down);
                const width = hw * (0.55 + 0.45 * up) * (1 + 0.5 * down);
                const a = 0.95 * (1 - 0.8 * down);
                const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
                for (let y = G - s; y > top; y -= s) {
                    const k = (G - y) / Math.max(1, G - top);
                    const wob = Math.sin(y * 0.11 + it.life * 24) * s * 1.5;
                    const half = Math.max(s, width * (1 - 0.3 * k));
                    paths[0].rect(px(x - half + wob), px(y), Math.max(s, px(half * 2)), s);
                    paths[1].rect(px(x - half * 0.72 - wob * 0.5), px(y), Math.max(s, px(half * 1.44)), s);
                    paths[2].rect(px(x - half * 0.38 + wob * 0.5), px(y), Math.max(s, px(half * 0.76)), s);
                    if ((Math.floor(y / s) + Math.floor(it.life * 40)) % 6 < 2) {
                        paths[3].rect(px(x - half * 0.12), px(y), Math.max(s, px(half * 0.24)), s);
                    }
                }
                fillPaths(ctx, paths, [cols[3], cols[2], cols[1], cols[0]], a);
                // 꼭대기 — 둥근 물 머리
                ellipse(ctx, px, s, x, top, width * 1.25, width * 0.55, cols[2], a);
                ellipse(ctx, px, s, x, top - s, width * 0.8, width * 0.32, cols[1], a);
                ellipse(ctx, px, s, x, top - s, width * 0.35, width * 0.14, '#ffffff', a);
            } });
        ring(sc, x, G - s, hw, hw * 4, 0.18, dur * 0.7, [cols[1], '#ffffff'], 2);
        return it;
    }
    // 나선 물 돔 (나선수리검처럼) — 땅에 반원이 솟아 점점 커지며 세로축으로 팽이처럼 돎:
    // 층마다 가로 물결 줄기가 한쪽 가장자리에서 뒤로부터 휘어 나와 앞면을 가로질러 rot 쪽(+1: 왼쪽)으로 쓩 흘러가 반대편으로 감겨 듦
    // (뒷면엔 옅은 줄기가 거꾸로). 속은 하얗게 빛나고 줄기는 하양 · 밝은 물빛 · 보랏빛, 자잘한 바람 결이 빠르게 흐르고
    // 가장자리에서 물보라가 도는 쪽으로 흩날림 → 다 돌면 물보라로 터지며 사라짐.
    // x0 에서 솟아 커지면서 가운데가 x1 로 옮겨 감. 높이는 vmax 까지 (넘으면 옆으로 넓게). touch(r) — 커지는 돔에 닿은 애 (휘말리게)
    function swirlDome(sc, x0, x1, G, R0, Rmax, vmax, dur, cols, rot, touch, pal = null) {
        const u = sc.u;
        // 색 — 기본은 물빛(하얀 속 · 보랏빛 테두리), pal 을 주면 그 색으로 (그림자분신은 보랏빛)
        pal = pal || { rim: DARK[1], body: [cols[2], cols[1], '#ffffff', '#ffffff'], tail: cols[2], mid: cols[1], head: '#ffffff', accent: DARK[0], wind: '#ffffff', back: cols[1], spray: cols, spray2: [DARK[0], DARK[1]] };
        // 세로 납작함 — 낮은 패널이면 꼭대기가 vmax 를 넘지 않게 옆으로 넓은 반원으로
        const V = Math.min(0.92, vmax / Rmax);
        const s = u.S;
        const H = u.H;
        const TILT = 0.2; // 위에서 살짝 내려다본 고리 납작함
        const tGrow = dur * 0.55;
        const tBreak = dur * 0.8;
        const grow = (life) => clamp(life / tGrow, 0, 1);
        let cx = x0;
        let R = R0;
        let phase = 0;
        let spray = 0;
        let broke = false;
        let look = 0;
        // 높이 h(0 바닥 → 1 꼭대기) 고리 위 한 점 — f 0 → 1 이 앞면을 rot 쪽으로 가로지름, back 이면 뒷면(거꾸로 · 위쪽)
        const ringAt = (h, f, back = false) => {
            const hw = R * Math.sqrt(Math.max(0, 1 - h * h));
            const phi = f * Math.PI;
            const b = back ? -1 : 1;
            return [cx + rot * b * Math.cos(phi) * hw, G - h * R * V + b * Math.sin(phi) * hw * TILT];
        };
        const headOf = (seed, span, speed) => (hash(seed, 6) * (1 + span) + phase * speed) % (1 + span);
        sc.add({ max: dur,
            update: (it, dt) => {
                const life = it.life;
                const k = grow(life);
                cx = lerp(x0, x1, easeOut(k));
                R = lerp(R0, Rmax, easeOut(k)) * (life > tBreak ? 1 + 0.12 * ((life - tBreak) / (dur - tBreak)) : 1);
                phase += dt * (1.0 + 1.4 * k);
                if (life < tBreak) {
                    // 닿은 애 휘말림
                    look -= dt;
                    if (look <= 0) {
                        look = 0.1;
                        for (const r of u.others()) {
                            if (((r.x - cx) / R) ** 2 + ((G - r.y) / (R * V)) ** 2 < 1) {
                                touch(r);
                            }
                        }
                    }
                    // 물보라 — 앞면이 빠져나가는 가장자리에서 도는 쪽으로
                    spray += dt * 90;
                    while (spray >= 1) {
                        spray -= 1;
                        if (!room()) {
                            continue;
                        }
                        const [ex, ey] = ringAt(Math.random() ** 0.7 * 0.95, rnd(0.85, 1));
                        const sp = H * rnd(0.4, 0.8);
                        sigParticle({ x: ex, y: ey, s, vx: -rot * sp, vy: -sp * rnd(0.1, 0.5), g: H * 1.4, drag: 0.7, max: rnd(0.4, 0.7), color: pick(Math.random() < 0.2 ? pal.spray2 : pal.spray), size: pick([1, 2, 2]), draw: DRAW.dot });
                    }
                } else if (!broke) {
                    // 터짐 — 온 겉면이 물보라로 흩어짐
                    broke = true;
                    ultShake(5, 350);
                    for (let i = 0; i < 70 && room(); i++) {
                        const [ex, ey] = ringAt(Math.random() * 0.95, Math.random(), Math.random() < 0.3);
                        const dx = ex - cx;
                        const dy = ey - (G - R * 0.4);
                        const L = Math.hypot(dx, dy) || 1;
                        const sp = H * rnd(0.4, 0.9);
                        sigParticle({ x: ex, y: ey, s, vx: (dx / L) * sp - rot * sp * 0.3, vy: (dy / L) * sp - sp * 0.3, g: H * 1.8, drag: 0.5, max: rnd(0.5, 1), color: pick(Math.random() < 0.2 ? pal.spray2 : pal.spray), size: pick([1, 2, 2]), draw: DRAW.dot });
                    }
                    ring(sc, cx, G - s, R * 0.6, R * 1.6, 0.18, 0.5, [pal.mid, '#ffffff'], 2);
                }
            },
            draw: (ctx, it, t, px) => {
                const life = it.life;
                const ry = R * V;
                const a = life < tBreak ? 1 : Math.max(0, 1 - (life - tBreak) / (dur - tBreak));
                const thick = clamp(Math.round(R / (55 * s)), 1, 4);
                const rows = clamp(Math.round(ry / (8 * s)), 7, 18);
                // 줄기 하나 — 높이 h, 앞머리 f0, 길이 span (머리가 굵고 하얗게, 가로로 납작하게)
                const streak = (h, f0, span, back, heads, mids, tails, w0, cap) => {
                    const hw = R * Math.sqrt(Math.max(0, 1 - h * h));
                    const n = clamp(Math.round((span * Math.PI * hw) / (2.5 * s)), 4, cap);
                    for (let j = 0; j < n; j++) {
                        const f = f0 - (j / (n - 1)) * span;
                        if (f < 0 || f > 1) {
                            continue;
                        }
                        const [qx, qy] = ringAt(h, f, back);
                        if (qy > G - s) {
                            continue;
                        }
                        const head = j < n * 0.25;
                        const w = head ? w0 + 1 : j < n * 0.6 ? w0 : Math.max(1, w0 - 1);
                        (head ? heads : j < n * 0.6 ? mids : tails).rect(px(qx - ((w + 1) * s) / 2), px(qy - (w * s) / 2), (w + 1) * s, Math.max(s, w * s - s));
                    }
                };
                // 뒷면 — 옅은 줄기가 거꾸로 (몸 뒤에)
                const back = new Path2D();
                for (let k = 0; k < rows; k++) {
                    const seed = 500 + k;
                    const span = 0.3 + 0.25 * hash(seed, 4);
                    streak(((k + 0.5) / rows) * 0.95, headOf(seed, span, 0.8 + 0.4 * hash(seed, 5)), span, true, back, back, back, Math.max(1, thick - 1), 40);
                }
                ctx.globalAlpha = 0.35 * a;
                ctx.fillStyle = pal.back;
                ctx.fill(back);
                // 몸 — 속이 하얗게 빛나는 반투명 겹
                const fill = (f, c, al) => {
                    const path = new Path2D();
                    const rx = R * f;
                    const rr = ry * f;
                    for (let dy = 0; dy < rr; dy += s) {
                        const half = rx * Math.sqrt(Math.max(0, 1 - (dy / rr) ** 2));
                        if (half >= s / 2) {
                            path.rect(px(cx - half), px(G - dy - s), Math.max(s, px(2 * half)), s);
                        }
                    }
                    ctx.globalAlpha = a * al;
                    ctx.fillStyle = c;
                    ctx.fill(path);
                };
                fill(1.04, pal.rim, 0.4);
                fill(1, pal.body[0], 0.42);
                fill(0.82, pal.body[1], 0.48);
                fill(0.6, pal.body[2], 0.45);
                fill(0.36, pal.body[3], 0.75);
                // 앞면 줄기 — 층마다 셋, 위층일수록 조금 느리게 (뒤틀린 회오리). 0 꼬리(물빛) 1 가운데(밝은 물빛) 2 머리(하양) 3 보랏빛 4 바람 결 · 테두리
                const P0 = [new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D()];
                for (let k = 0; k < rows; k++) {
                    const h = ((k + 0.5) / rows) * 0.95;
                    for (let m = 0; m < 3; m++) {
                        const seed = k * 7 + m;
                        const span = 0.32 + 0.3 * hash(seed, 4);
                        const f0 = headOf(seed, span, (0.9 + 0.6 * hash(seed, 5)) * (1.15 - 0.35 * h));
                        if (hash(seed, 8) < 0.18) {
                            streak(h, f0, span, false, P0[3], P0[3], P0[3], thick, 50);
                        } else {
                            streak(h, f0, span, false, P0[2], P0[1], P0[0], thick, 50);
                        }
                    }
                }
                // 바람 결 — 자잘한 하얀 대시가 빠르게
                for (let i = 0; i < 70; i++) {
                    const [qx, qy] = ringAt(hash(i, 11) * 0.95, (hash(i, 12) + phase * (1.6 + hash(i, 13))) % 1);
                    if (qy < G - s) {
                        P0[4].rect(px(qx - 2 * s), px(qy + (hash(i, 14) - 0.5) * 4 * s), 4 * s, s);
                    }
                }
                // 테두리
                const n = clamp(Math.round((Math.PI * R) / s), 12, 500);
                for (let i = 0; i <= n; i++) {
                    const th = (i / n) * Math.PI;
                    P0[4].rect(px(cx + Math.cos(th) * R), px(G - Math.sin(th) * ry), s, s);
                }
                fillPaths(ctx, P0, [pal.tail, pal.mid, pal.head, pal.accent, pal.wind], a);
            } });
    }
    // 끝에 내리는 물방울 비 (t0 부터)
    function waterRain(sc, t0, sec, cols) {
        const { W, H, S: s, ground: G } = sc.u;
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const k = sc.t - t0;
            if (k <= 0) {
                return;
            }
            const a = clamp(k / 0.2, 0, 1) * clamp((sec - sc.t) / 0.35, 0, 1);
            const path = new Path2D();
            const m = Math.round(36 * clamp(W / 480, 0.6, 2));
            for (let j = 0; j < m; j++) {
                const y = wrap(hash(j, 2) * H + k * H * (1.2 + hash(j, 3) * 0.6), H + 20, -20);
                if (y < G) {
                    path.rect(px(hash(j, 1) * W), px(y), s, 3 * s);
                }
            }
            ctx.globalAlpha = 0.6 * a;
            ctx.fillStyle = cols[1];
            ctx.fill(path);
        } });
    }
    // 몸 둘레에서 물방울이 피어오름 (물빛 오라)
    function auraBubbles(sc, t0, t1, cols) {
        const u = sc.u;
        let acc = 0;
        sc.tick((t, dt) => {
            if (t < t0 || t > t1) {
                return;
            }
            acc += dt * 22;
            while (acc >= 1) {
                acc -= 1;
                if (room()) {
                    sigParticle({ x: u.body.cx + rnd(-1, 1) * u.w * 0.55, y: u.body.bottom - rnd(0, u.h * 0.8), s: u.S, vy: -u.H * rnd(0.12, 0.25), max: rnd(0.4, 0.7), color: pick([cols[0], cols[1], cols[2]]), draw: DRAW.dot });
                }
            }
        });
    }
    const recoil = (pokemon, frames, ms) => {
        try {
            pokemon.el.animate(frames, { duration: ms, easing: 'ease-out', composite: 'add' });
        } catch (err) {
            fail('recoil', err);
        }
    };

    // 거대 물수리검 — 물 회오리가 감싸 펑(물빛 테두리) → 뛰어오르는 순간부터 작은 표창이 돌며 물빛 · 보랏빛 기운을 빨아들여 커짐(두근두근 · 반짝)
    // → 내리꽂듯 던짐(물빛 · 보랏빛 꼬리 · 물방울과 보랏빛 기운이 흩날림 · 허공에 베인 자국 · 지나가며 베기) → 화면 끝에 꽂혀 멈칫
    // → 물기둥이 솟고 그 안에서 표창이 하얗게 달아오르다 물기둥째 대폭발 — 나선 물 돔(나선수리검처럼)이 처음 돔의 1.5배 동그란 반원으로 커지며 개굴닌자 쪽으로 팽이처럼 돎
    // → 개굴닌자는 돔 앞에 착지해 서 있다가, 돔이 물보라로 터지는 순간 허공의 베인 자국도 한꺼번에 터짐 → 물방울 비
    // 뛰는 동안 · 돔이 있는 동안은 진짜 그림을 숨기고 캔버스에 꼭두각시로 (돔보다 앞에 보이게, 같은 자리에 내려와서 다시 보임)
    function runNinjaShuriken(u, o, ms, pokemon) {
        const cols = sigPal(o.c || 'water');
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const img = pokemon.el;
        const me = monBox(pokemon);
        const edge = Math.max(1, Math.round(u.s * 0.75));
        const D = Math.min(Math.max(H / 3, short(u) * 0.4) * (0.9 + 0.2 * P), W * 0.42, H * 0.62);
        const C = s * Math.max(1, Math.round(D / (26 * s)));
        const HOT = ['#ffffff', '#ffffff', '#e6f6ff', '#9fd8ff'];
        // 때 — 회오리 펑(뛰어오르며 모으기 시작) · 꼭대기 · 던짐 · 꽂힘(멈칫) · 물기둥 · 대폭발 · 내려옴 · 착지 · 베인 자국 터짐
        const T1 = 0.7;
        const TJ = 1.05;
        const T2 = 1.9;
        const T3 = 2.35;
        const T3b = 2.5;
        const TB = 2.9;
        const TD = 2.4; // 나선 물 돔이 솟아 커지며 도는 시간 (0.8 지점에서 터짐)
        const T5 = TB + 0.25;
        const TL = TB + 0.55;
        const T6 = TB + TD * 0.8;
        const TR = TB + TD; // 진짜 그림이 다시 보임 (돔이 사라진 뒤 — 돔은 캔버스라 진짜 그림을 덮어서)
        const tFull = T2 - 0.1;
        const pulses = [T1 + 0.45, T1 + 0.8];
        const still = (t) => (t >= T3 && t < T3b ? T3 : t); // 멈칫 — 그동안 꼭두각시 · 표창이 그대로
        // 뛰기 — 꼭대기에서도 머리 위 표창이 화면 안에 (낮은 패널이면 낮게)
        const jumpH = Math.max(0, Math.min(H * 0.42, me.b - me.h - D * 0.95 - 4));
        const ax = clamp(me.x - dir * me.w * 0.4, me.w * 0.6, W - me.w * 0.6);
        const aB = me.b - jumpH;
        // 꼭두각시 [x, 발 높이, 기울기]
        const pup = (t) => {
            t = still(t);
            if (t < TJ) {
                const e = easeOut((t - T1) / (TJ - T1));
                return [lerp(me.x, ax, e), lerp(me.b, aB, e), -dir * 0.3 * (1 - e)];
            }
            if (t < T5) {
                // 던지기 전 뒤로 젖혔다가 휙 앞으로
                const lean = t > T2 - 0.2 && t < T2 ? -(t - T2 + 0.2) / 0.2 : t >= T2 && t < T2 + 0.25 ? 1 - (t - T2) / 0.25 : 0;
                return [ax + dir * lean * 3 * s, aB + Math.sin(t * 5) * s * 1.5, dir * lean * 0.35];
            }
            const k = clamp((t - T5) / (TL - T5), 0, 1);
            return [lerp(ax, me.x, easeIn(k)), lerp(aB, me.b, easeIn(k)) - Math.sin(k * Math.PI) * me.h * 0.3, 0];
        };
        // 표창 자리 — 머리 위(뛰어오르는 꼭두각시를 따라감) · 내리꽂힘 · 꽂혀 부르르(달아오를수록 세게)
        const over = (t) => {
            const [x, b] = pup(t);
            return [clamp(x - dir * me.w * 0.15, D * 0.5, W - D * 0.5), Math.max(D * 0.5 + 2, b - me.h - D * 0.42)];
        };
        const [bx, by] = over(T2);
        // 꽂히는 곳 — 화면 끝에서 조금 안쪽 (물기둥 · 대폭발이 화면 안에 다 보이게)
        const fx = dir > 0 ? W - Math.max(D * 0.75, W * 0.14) : Math.max(D * 0.75, W * 0.14);
        const fy = clamp(G - D * 0.5, D * 0.5 + 2, G - D * 0.45);
        const heatAt = (t) => (t >= T3b ? clamp((t - T3b) / (TB - T3b), 0, 1) : 0);
        const pos = (t) => {
            t = still(t);
            if (t < T2) {
                return over(t);
            }
            if (t < T3) {
                const k = (t - T2) / (T3 - T2);
                const e = 0.4 * k + 0.6 * k * k;
                return [lerp(bx, fx, e), lerp(by, fy, e)];
            }
            return [fx + Math.sin(t * 90) * s * (1.5 + 2 * heatAt(t)), fy];
        };
        // 크기 — 기운이 모일수록 커지고 두근할 때 툭 부풂, 달아오르며 조금 더
        const sizeAt = (t) => {
            if (t < T1 || t >= TB) {
                return 0;
            }
            let size = t < tFull ? D * (0.15 + 0.85 * ((t - T1) / (tFull - T1)) ** 1.3) : D;
            for (const tp of pulses) {
                size *= 1 + 0.12 * clamp(1 - Math.abs(t - tp) / 0.12, 0, 1);
            }
            return size * (1 + 0.15 * heatAt(t));
        };
        const flying = (t) => t >= T2 && t < T3;
        const sc = scene(u, sec + 0.3, 'ultswarm');
        ultDark(0.25, ms - 200);
        let ang = 0;
        sc.tick((t, dt) => {
            const spin = t < T1 ? 0 : t < T2 ? 6 + 24 * clamp((t - T1) / (T2 - T1), 0, 1) : t < T3 ? 28 : t < T3b ? 0 : 44;
            ang += spin * dt * dir;
        });
        waterRain(sc, T6, sec, cols);

        // ① 물 회오리 — 물줄기 네 가닥이 발밑에서 감아 올라가며 조여듦 (뒤 가닥은 옅게, 앞 가닥은 굵게)
        const vx = u.body.cx;
        const vTop = Math.max(4, u.body.top - Math.max(u.h * 0.9, short(u) * 0.2));
        const vR = Math.max(u.w * 0.9, short(u) * 0.12);
        sc.add({ max: T1 + 0.05, draw: (ctx, it, t, px) => {
            const life = it.life;
            const yTop = G - (G - vTop) * easeOut(life / 0.3);
            const squeeze = 1 - 0.35 * easeIn(life / T1);
            const back = new Path2D();
            const paths = [new Path2D(), new Path2D(), new Path2D()];
            for (let j = 0; j < 4; j++) {
                for (let y = G - s; y > yTop; y -= s) {
                    const k = (G - y) / Math.max(1, G - vTop);
                    const a = (j / 4) * TAU + k * 7 + life * 16 * dir;
                    const z = Math.sin(a);
                    const x = vx + Math.cos(a) * vR * squeeze * (0.75 + 0.35 * k);
                    const th = z > 0.3 ? 3 : 2;
                    (z < -0.2 ? back : paths[z > 0.85 ? 2 : z > 0.3 ? 1 : 0]).rect(px(x - s), px(y), th * s, s);
                }
            }
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = cols[3];
            ctx.fill(back);
            fillPaths(ctx, paths, [cols[2], cols[1], '#ffffff'], 0.95);
        } });
        sc.tick((t) => {
            if (t < T1 - 0.1 && room(4)) {
                for (let j = 0; j < 4; j++) {
                    const a0 = rnd(0, TAU);
                    const r0 = vR * rnd(2, 3.2);
                    sigParticle({ x: vx, y: u.body.cy, s, max: rnd(0.3, 0.45), a0, r0, color: pick(cols),
                        update: (p) => {
                            const k = p.life / p.max;
                            p.x = vx + Math.cos(p.a0 + k * 4 * dir) * p.r0 * (1 - k);
                            p.y = u.body.cy + Math.sin(p.a0 + k * 4 * dir) * p.r0 * (1 - k) * 0.7;
                        },
                        draw: DRAW.dot });
                }
            }
        });
        // 펑 → 물빛 테두리 · 땅을 차고 뛰어오름 (진짜는 숨기고 꼭두각시로)
        sc.at(T1, () => {
            screenFlash(s, 0.3, cols[1], 0.2);
            ultShake(3, 260);
            ring(sc, vx, u.body.cy, u.w * 0.5, Math.max(u.w * 3, short(u) * 0.4), 0.8, 0.45, ['#ffffff', cols[1], cols[2]], 2);
            ring(sc, me.x, me.b - s, me.w * 0.4, me.w * 2.5, 0.2, 0.4, [cols[1], '#ffffff'], 2);
            debris(vx, u.body.cy, s, cols, 36, H * 0.9, { ground: G, size: [1, 2, 2] });
            sparkles(vx, u.body.cy, s, ['#ffffff', cols[0], cols[1]], 12, u.w, H * 0.2);
            try {
                pokemon.el.style.filter = waterAura(u.s);
            } catch (err) {
                fail('aura', err);
            }
            hideMon(pokemon, true);
        });
        hideUntil(pokemon, ms + 100);
        auraBubbles(sc, TR, sec - 0.3, cols);

        // 베인 자국 — 지나간 자리에 남았다가, 착지하면(T6) 굵게 번쩍하고 사라짐 (하얀 심 · 보라 테두리)
        const cuts = [];
        let lastCut = null;
        const drawCuts = (ctx, it, t, px) => {
            const life = sc.t;
            if (!cuts.length || life > T6 + 0.35) {
                return;
            }
            const hot = life >= T6 && life < T6 + 0.1;
            const w = hot ? 3 : 1;
            const paths = [new Path2D(), new Path2D()];
            for (const c of cuts) {
                const L = c.len * Math.min(1, (life - c.t0) / 0.06);
                const ux0 = Math.cos(c.a);
                const uy0 = Math.sin(c.a);
                for (let d = -c.len / 2; d < -c.len / 2 + L; d += s) {
                    paths[0].rect(px(c.x + ux0 * d - uy0 * s), px(c.y + uy0 * d + ux0 * s), w * s, w * s);
                    paths[1].rect(px(c.x + ux0 * d), px(c.y + uy0 * d), w * s, w * s);
                }
            }
            fillPaths(ctx, paths, [DARK[1], '#ffffff'], life < T6 ? 0.85 : hot ? 1 : 1 - (life - T6 - 0.1) / 0.25);
        };
        sc.add({ max: TB, draw: drawCuts });
        // 꼭두각시 — 물빛 테두리, 뛰고 내릴 때 보랏빛 잔상 (돔이 생기면 돔 위에 다시 그림)
        const ghosts = [];
        let lastGhost = -1;
        sc.tick((t) => {
            if (((t > T1 && t < TJ) || (t > T5 && t < TL)) && t - lastGhost > 0.03) {
                lastGhost = t;
                const [x, b, r] = pup(t);
                ghosts.unshift({ x, b, r, t });
                ghosts.length = Math.min(ghosts.length, 8);
            }
        });
        const drawPup = (ctx) => {
            const t = sc.t;
            for (const g of ghosts) {
                drawMon(ctx, img, g.x, g.b, me.w, u.left, 0.45 * (1 - (t - g.t) / 0.25), DARK[1], g.r);
            }
            if (t >= T1 && t < TR) {
                const [x, b, r] = pup(t);
                drawLitMon(ctx, img, x, b, me.w, u.left, '#8fe3ff', edge, 1, r);
            }
        };
        sc.add({ max: TB, draw: drawPup });
        // ② 모으기 — 물빛 · 보랏빛 두 줄기씩 소용돌이치며 표창으로 빨려 듦 (점이 안쪽으로 흘러감) + 알갱이, 두 번 두근, 다 되면 반짝
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < T1 + 0.05 || life > T2) {
                return;
            }
            const k = (life - T1) / (T2 - T1);
            const a = clamp(Math.min(k / 0.15, (1 - k) / 0.1), 0, 1);
            const [cx, cy] = over(life);
            const R0 = D * (1.5 - 0.4 * k);
            const inner = sizeAt(life) * 0.3;
            const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
            for (let j = 0; j < 4; j++) {
                const water = j % 2 === 0;
                const n = 34;
                for (let i = 0; i < n; i++) {
                    const f = (i / n + life * 1.2) % 1;
                    const r = lerp(R0, inner, f);
                    const an = (j / 4) * TAU + f * 4.2 * dir + life * 7 * dir;
                    const th = f < 0.15 ? 1 : f < 0.6 ? 2 : 3;
                    const path = water ? paths[f > 0.6 ? 1 : 0] : paths[f > 0.6 ? 3 : 2];
                    path.rect(px(cx + Math.cos(an) * r - s), px(cy + Math.sin(an) * r * 0.8 - s), th * s, th * s);
                }
            }
            fillPaths(ctx, paths, [cols[2], cols[0], DARK[1], DARK[0]], 0.95 * a);
        } });
        sc.tick((t) => {
            if (t < T1 + 0.05 || t > T2 - 0.1 || !room(4)) {
                return;
            }
            for (let j = 0; j < 4; j++) {
                const a0 = rnd(0, TAU);
                const r0 = D * rnd(0.9, 1.6);
                const dark = j % 2 === 1;
                sigParticle({ x: 0, y: 0, s, max: rnd(0.3, 0.45), a0, r0, color: pick(dark ? [DARK[0], DARK[1], DARK[2]] : cols), size: pick([1, 2]),
                    update: (p) => {
                        const k = p.life / p.max;
                        const [cx, cy] = over(sc.t);
                        const an = p.a0 + k * 5 * dir;
                        p.x = cx + Math.cos(an) * p.r0 * (1 - k);
                        p.y = cy + Math.sin(an) * p.r0 * (1 - k) * 0.8;
                    },
                    draw: DRAW.dot });
            }
        });
        for (const tp of pulses) {
            sc.at(tp, () => {
                const [cx, cy] = over(tp);
                ring(sc, cx, cy, D * 1.25, D * 0.4, 0.85, 0.3, [cols[1], DARK[1], '#ffffff'], 2);
                ultShake(1.5, 150);
            });
        }
        // ③ 날아감 — 허공에 베인 자국 · 물방울 · 보랏빛 기운이 흩날림 · 지나가며 베기
        let wisp = 0;
        sc.tick((t, dt) => {
            if (!flying(t)) {
                return;
            }
            const [x, y] = pos(t);
            if (!lastCut || Math.hypot(x - lastCut[0], y - lastCut[1]) > D * 0.75) {
                lastCut = [x, y];
                if (cuts.length < 10) {
                    cuts.push({ x, y, a: pick([-1, 1]) * rnd(0.55, 1.0), len: D * rnd(0.8, 1.1), t0: t });
                }
            }
            if (room(6)) {
                for (let j = 0; j < 3; j++) {
                    const a = rnd(0, TAU);
                    sigParticle({ x: x + Math.cos(a) * D * 0.45, y: y + Math.sin(a) * D * 0.45, s, vx: Math.cos(a + (Math.PI / 2) * dir) * H * 0.4, vy: Math.sin(a + (Math.PI / 2) * dir) * H * 0.4, g: H * 1.2, drag: 1, max: rnd(0.3, 0.6), color: pick(cols), size: pick([1, 2]), draw: DRAW.dot });
                }
                // 보랏빛 기운 — 천천히 퍼지며 피어오름
                for (let j = 0; j < 3; j++) {
                    const a = rnd(0, TAU);
                    sigParticle({ x: x + Math.cos(a) * D * 0.4, y: y + Math.sin(a) * D * 0.4, s, vx: Math.cos(a) * H * 0.2 - dir * H * 0.12, vy: Math.sin(a) * H * 0.2 - H * 0.1, drag: 2, max: rnd(0.45, 0.8), color: pick([DARK[0], DARK[1], DARK[2]]), size: pick([1, 2, 2]), draw: DRAW.dot });
                }
            }
            wisp += dt;
            if (wisp > 0.07) {
                wisp = 0;
                puff(x - dir * D * 0.3, y + rnd(-1, 1) * D * 0.2, s, DARK[1], D * 0.04, D * 0.14, 0.4, -dir * 20, -12, 0.35);
            }
            for (const r of u.others()) {
                if (Math.abs(x - r.x) < D * 0.45 + r.w * 0.3 && Math.abs(y - r.y) < D * 0.55 + r.h * 0.5 && hit(r, dir, 'tumble')) {
                    ultShake(4, 250);
                    debris(r.x, r.y, s, cols, 16, H * 0.8, { ground: G });
                    ring(sc, r.x, r.y, s * 2, r.w * 1.6, 0.8, 0.35, ['#ffffff', cols[1]], 2);
                }
            }
        });
        // 꼬리(물빛 위에 보랏빛 바깥 띠) · 표창(달아오르면 하얗게 깜빡) · 반짝 — 물기둥이 솟은 뒤엔 물기둥 위에 다시 그림(drawShuriken)
        const drawShuriken = (ctx, px, life) => {
            const size = sizeAt(life);
            if (size < C * 2) {
                return;
            }
            const [x, y] = pos(life);
            if (flying(life)) {
                const pts = [];
                for (let k = 0; k <= 10; k++) {
                    const tt = Math.max(T2, life - k * 0.025);
                    pts.push(pos(tt));
                    if (tt === T2) {
                        break;
                    }
                }
                waterRibbon(ctx, px, s, pts, (size / s) * 0.55, [null, DARK[1], DARK[2]], 0.55);
                waterRibbon(ctx, px, s, pts, (size / s) * 0.4, cols, 0.85);
            }
            const heat = heatAt(life);
            drawBigShuriken(ctx, x, y, size, C, ang, heat > 0.3 && Math.floor(life * 30) % 2 ? HOT : cols, 1);
            ctx.globalAlpha = 0.8;
            for (let j = 0; j < 4; j++) {
                const a = ang + (j / 4) * TAU + 0.6;
                dotAt(ctx, px, s, x + Math.cos(a) * size * 0.47, y + Math.sin(a) * size * 0.47, '#ffffff', 2, 2);
            }
            // 다 모였을 때 · 터지기 직전 반짝
            for (const tg of [T2 - 0.14, TB - 0.22]) {
                const k = life - tg;
                if (k >= 0 && k < 0.3) {
                    glint(ctx, px, s, x + size * 0.3, y - size * 0.3, D * 0.55 * Math.sin((k / 0.3) * Math.PI), 1);
                }
            }
        };
        sc.add({ max: T3b, draw: (ctx, it, t, px) => drawShuriken(ctx, px, sc.t) });
        sc.at(T2, () => {
            ultShake(4, 300);
            ring(sc, bx, by, D * 0.3, D * 1.3, 0.8, 0.4, ['#ffffff', cols[1], DARK[1]], 2);
        });
        // ④ 꽂힘 — 멈칫(작은 번쩍) → 물기둥(둘레 애들 떠오름) → 물기둥째 대폭발
        sc.at(T3, () => {
            screenFlash(s, 0.15, '#ffffff', 0.08);
            ultShake(2, 120);
            ring(sc, fx, fy, D * 0.2, D * 0.7, 0.8, 0.15, ['#ffffff', DARK[0]], 2);
        });
        const hTop = Math.min(H * 0.8, G - 4);
        let column = null;
        sc.at(T3b, () => {
            ultShake(5, 350);
            column = geyser(sc, fx, G, D * 0.3, hTop, 0.8, cols);
            sc.add({ max: TB - T3b, draw: (ctx, it, t, px) => drawShuriken(ctx, px, sc.t) });
            ring(sc, fx, fy, D * 0.3, D * 1.5, 0.8, 0.4, ['#ffffff', cols[1], cols[2]], 2);
            debris(fx, fy, s, cols, 30, H * 1.0, { ground: G, size: [1, 2, 2] });
            for (const r of u.others()) {
                if (Math.abs(r.x - fx) < D * 1.1) {
                    hit(r, dir, 'lift');
                }
            }
        });
        sc.at(TB, () => {
            screenFlash(s, 0.6, '#ffffff', 0.3);
            ultShake(8, 550);
            // 물기둥째 터짐 — 기둥은 사라지고 물보라로 (아래)
            if (column) {
                column.max = 0;
            }
            // 나선 물 돔 — 꽂힌 자리에서 솟아 처음 돔의 1.5배까지 커지며 개굴닌자 쪽으로 팽이처럼 돎 (커지면서 가운데가 화면 쪽으로)
            // → 그 위에 베인 자국 · 꼭두각시를 다시 그림 (돔보다 앞에)
            // 처음 돔의 1.5배 · 늘 동그란 반원 — 패널이 낮으면 꼭대기가 패널 안(위에 조금 여유)에 들어오는 만큼만. 화면에 다 들어가면 커지면서 개굴닌자 쪽으로 굴러와 반원이 통째로 보이게
            const vmax = G - Math.max(10, H * 0.05);
            const Rd = Math.min(Math.max(D * 1.5, short(u) * 0.5) * 1.5, Math.max(W, G) * 0.9, vmax / 0.92);
            const m = Math.max(10, W * 0.02);
            const x1 = 2 * Rd + 2 * m <= W ? (dir > 0 ? Math.min(fx, W - Rd - m) : Math.max(fx, Rd + m)) : W / 2;
            swirlDome(sc, fx, x1, G, D * 0.4, Rd, vmax, TD, cols, dir, (r) => hit(r, -dir, 'spin'));
            sc.add({ max: sec, draw: drawCuts });
            sc.add({ max: sec, draw: drawPup });
            ring(sc, fx, fy, D * 0.3, Math.max(W, H) * 0.7, 0.8, 0.6, ['#ffffff', cols[1], cols[2]], 3);
            ring(sc, fx, fy, D * 0.2, Math.max(W, H) * 0.45, 0.8, 0.5, ['#ffffff', DARK[1]], 2);
            ring(sc, fx, G - s, D * 0.4, D * 3, 0.2, 0.5, [cols[1], '#ffffff'], 2);
            debris(fx, fy, s, cols, 50, H * 1.3, { ground: G, size: [1, 2, 2] });
            debris(fx, fy, s, [DARK[0], DARK[1], DARK[2]], 24, H * 0.9, { ground: G, size: [1, 2] });
            // 물기둥이 터지며 — 기둥 높이마다 물보라
            for (let k = 1; k <= 4; k++) {
                debris(fx, G - (hTop * k) / 5, s, cols, 8, H * 0.7, { ground: G, r: D * 0.2 });
            }
            sparkles(fx, fy, s, ['#ffffff', cols[0], cols[1]], 16, D * 0.6, H * 0.3);
            shards(fx, fy, s, Math.max(s, Math.round(D / 22 / s) * s), cols, 14, H * 0.9, G - s);
        });
        // ⑤ 돔이 커지는 동안 내려와 착지(돔 앞에 섬) → 돔이 터지는 순간 베인 자국도 한꺼번에 터짐 → 돔이 사라지면 진짜 그림으로
        sc.at(TL, () => {
            ultShake(3, 200);
            ring(sc, me.x, me.b - s, me.w * 0.4, me.w * 3, 0.2, 0.4, [cols[1], '#ffffff'], 2);
        });
        sc.at(TR, () => hideMon(pokemon, false));
        sc.at(T6, () => {
            screenFlash(s, 0.25, '#ffffff', 0.12);
            ultShake(4, 300);
            for (const c of cuts) {
                debris(c.x, c.y, s, cols, 8, H * 0.5, { ground: G, r: c.len * 0.4 });
            }
        });
    }

    // 그림자분신 물수리검 — 보랏빛 연기로 분신이 펑 펑 → 차례로 뛰어올라 한 점에 던짐 (모일수록 표창이 커짐) → 진짜도 던짐
    // → 진짜 · 분신 모두 X 자로 교차 돌진 → 멈칫 → 합쳐진 표창이 터지며 보랏빛 나선 돔(거대 물수리검보다 조금 작게)이 솟아 진짜 쪽으로 돎,
    // 분신들은 돔 둘레에 서서 빛남 → 돔이 터지는 순간 화면 가르는 X 베기 · 분신이 한꺼번에 연기로 펑 → 진짜는 연기로 순간이동해 제자리로 → 물방울 비
    function runShadowClones(u, o, ms, pokemon) {
        const cols = sigPal(o.c || 'water');
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const img = pokemon.el;
        const me = monBox(pokemon);
        const edge = Math.max(1, Math.round(u.s * 0.75));
        const n = Math.min(clamp(Math.round(o.clones ?? 5), 2, 8), W < 360 ? 3 : W < 560 ? 4 : 8);
        const D = Math.min(Math.max(H / 3, short(u) * 0.4) * (0.9 + 0.2 * P), W * 0.42, H * 0.62);
        const C = s * Math.max(1, Math.round(D / (26 * s)));
        const cw = me.w;
        const ch = me.h;
        const d = Math.max(10 * s, Math.min(cw, short(u) * 0.16));
        const c2 = s * Math.max(1, Math.round(d / (22 * s)));
        // 노리는 곳 — 가장 가까운 애, 없으면 앞쪽. 높이는 합쳐진 거대 표창이 땅 밑으로 잘리지 않게
        const q = nearest(u);
        const tx = q ? clamp(q.x, W * 0.12, W * 0.88) : clamp(u.body.cx + dir * W * 0.36, W * 0.18, W * 0.82);
        const ty = Math.max(D * 0.55, Math.min(q ? q.y : G - u.h * 0.6, G - D * 0.55));
        // 때
        const tIn = 0.15;
        const gap = 0.1;
        const jumpDur = 0.34;
        const fly = 0.3;
        const tReal = tIn + n * gap + 0.45;
        const tAll = tReal + fly;
        const tDash = tAll + 0.4;
        const dashDur = 0.22;
        const tStop = tDash + dashDur;
        const tBoom = tStop + 0.18;
        const TDc = 2.2; // 보랏빛 나선 돔이 솟아 도는 시간 (0.8 지점에서 터짐)
        const tX = tBoom + TDc * 0.8; // 돔이 터지는 순간 — 화면 가르는 X · 분신이 한꺼번에 사라짐
        const tOut = tX + 0.3;
        const tBack = tX + 0.5;
        const fit = (v) => clamp(v, cw * 0.6, W - cw * 0.6);
        // 돌진 — 노리는 곳을 지나 반대편으로 (몸 가운데가 노리는 곳을 꿰뚫게)
        const across = (x, b) => {
            const yc = b - ch / 2;
            return [fit(2 * tx - x), clamp(2 * ty - yc, ch / 2 + 2, G - ch / 2) + ch / 2];
        };
        // 분신 자리 — 노리는 곳 둘레에 왼쪽 땅 → 하늘 → 오른쪽 땅 (진짜와 겹치면 비켜 섬), 나타나는 차례는 섞어서
        const rx = clamp(W * 0.3, cw * 2, W * 0.42);
        const air = Math.max(0, Math.min(H * 0.42, (G - ch - 4) * 0.7));
        const seq = [...Array(n).keys()].sort((a, b) => hash(a, 9) - hash(b, 9));
        const dashers = [];
        for (let j = 0; j < n; j++) {
            const a = Math.PI + (n === 1 ? 0.5 : j / (n - 1)) * Math.PI;
            const lift = Math.max(0, -Math.sin(a)) * air;
            let x = fit(tx + Math.cos(a) * rx);
            if (lift < u.h && Math.abs(x - u.body.cx) < cw * 1.5) {
                // 진짜에게서 비켜 섬 — 화면 끝에 막히면 반대쪽으로
                const side = Math.sign(x - u.body.cx) || -dir;
                x = fit(u.body.cx + side * cw * 1.6);
                if (Math.abs(x - u.body.cx) < cw * 1.5) {
                    x = fit(u.body.cx - side * cw * 1.6);
                }
            }
            const b = G - lift;
            const order = seq.indexOf(j);
            const tA = tIn + order * gap;
            dashers.push({ x, b, left: tx < x, tIn: tA, tJump: tA + 0.2, jh: Math.max(0, Math.min(ch * 1.1, b - ch - d - 4)), to: across(x, b), tOut: tX + order * 0.02 });
        }
        // 진짜 (돌진 때만 꼭두각시)
        const real = { x: me.x, b: me.b, left: tx < me.x, real: true, to: across(me.x, me.b) };
        dashers.push(real);
        // 꼭두각시 자리 [x, 발 높이, 왼쪽을 보나, 기울기]
        const at = (c, t) => {
            if (t >= tDash) {
                const k = clamp((t - tDash) / dashDur, 0, 1);
                const goLeft = c.to[0] < c.x;
                return [lerp(c.x, c.to[0], k), lerp(c.b, c.to[1], k), goLeft, k >= 1 ? (goLeft ? -1 : 1) * 0.25 : 0];
            }
            let b = c.b;
            if (!c.real && t > c.tJump && t < c.tJump + jumpDur) {
                b -= Math.sin(((t - c.tJump) / jumpDur) * Math.PI) * c.jh;
            } else if (c.b < G - s) {
                b += Math.sin(t * 5 + c.x) * s * 1.5;
            }
            return [c.x, b, c.left, 0];
        };
        // 던지는 표창 — 머리 위에서 커지고(분신은 나타나면 바로 · 진짜는 처음부터), 뛰어오른 꼭대기에서 / 진짜는 맨 끝에 한 점으로
        const throws = dashers.map((c) => {
            const t0 = c.real ? tReal : c.tJump + jumpDur / 2;
            const head = (t) => {
                const [x, b] = c.real ? [me.x, me.b] : at(c, t);
                return [x, b - ch - d * 0.6];
            };
            return { c, t0, tForm: c.real ? 0.2 : c.tIn + 0.08, size: c.real ? d * 1.3 : d, head,
                pos: (t) => {
                    if (t < t0) {
                        return head(t);
                    }
                    const [hx0, hy0] = head(t0);
                    const k = clamp((t - t0) / fly, 0, 1);
                    return [lerp(hx0, tx, k * k), lerp(hy0, ty, k * k) - Math.sin(k * Math.PI) * d * 0.5];
                } };
        });
        const arrived = (t) => throws.filter((th) => t >= th.t0 + fly).length;
        const sc = scene(u, sec + 0.3, 'ultswarm');
        ultDark(0.3, ms - 200);
        let ang = 0;
        sc.tick((t, dt) => {
            ang += (t >= tStop && t < tBoom ? 0 : t < tAll ? 24 : 34) * dt;
        });
        waterRain(sc, tX, sec, cols);
        // 진짜도 물빛 테두리 · 둘레에 보랏빛 고리 (인을 맺음)
        sc.at(0.05, () => {
            try {
                pokemon.el.style.filter = waterAura(u.s);
            } catch (err) {
                fail('aura', err);
            }
            ring(sc, u.body.cx, u.body.cy, u.w * 0.4, u.w * 2, 0.8, 0.35, ['#ffffff', DARK[1]], 2);
        });
        auraBubbles(sc, 0.05, tDash, cols);
        auraBubbles(sc, tBack, sec - 0.3, cols);

        // 돌진 자국 — 보랏빛 · 하얀 심, 멈춘 뒤 흐려짐
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < tDash || life > tStop + 0.3) {
                return;
            }
            const paths = [new Path2D(), new Path2D()];
            for (const c of dashers) {
                const [x, b] = at(c, life);
                const seg = [[c.x, c.b - ch / 2], [x, b - ch / 2]];
                addLine(paths[0], px, s, seg, 4);
                addLine(paths[1], px, s, seg, 1);
            }
            fillPaths(ctx, paths, [DARK[1], '#ffffff'], life < tStop ? 0.9 : 0.9 * (1 - (life - tStop) / 0.3));
        } });
        // 분신 · 진짜 꼭두각시 — 분신은 보랏빛 테두리, 진짜는 물빛 테두리. 나타날 때 · 사라질 때 하얗게 번쩍, 돌진 땐 잔상,
        // 돔이 도는 동안 분신이 보랏빛으로 두근두근 빛남 (돔이 생기면 돔 위에 다시 그림)
        const drawDashers = (ctx) => {
            const life = sc.t;
            for (const c of dashers) {
                const from = c.real ? tDash : c.tIn;
                const until = c.real ? tOut : c.tOut + 0.08;
                if (life < from || life > until) {
                    continue;
                }
                if (life > tDash && life < tStop + 0.1) {
                    for (let k = 1; k <= 3; k++) {
                        const [gx, gb, gl] = at(c, life - k * 0.03);
                        drawMon(ctx, img, gx, gb, cw, gl, 0.4 - k * 0.1, DARK[1]);
                    }
                }
                const [x, b, left, rot] = at(c, life);
                const alpha = !c.real && life > c.tOut ? 1 - (life - c.tOut) / 0.08 : 1;
                drawLitMon(ctx, img, x, b, cw, left, c.real ? '#8fe3ff' : DARK[1], c.real ? edge : s, c.real ? 1 : alpha * 0.92, rot);
                if (!c.real && life >= tBoom && life < c.tOut) {
                    drawMon(ctx, img, x, b, cw, left, 0.25 + 0.2 * Math.sin(life * 12 + c.x), DARK[0], rot);
                }
                const k = life - from;
                const flash = !c.real && k < 0.12 ? 1 - k / 0.12 : !c.real && life > c.tOut ? 1 : 0;
                if (flash > 0) {
                    drawMon(ctx, img, x, b, cw, left, flash, '#ffffff', rot);
                }
            }
        };
        sc.add({ max: tBoom, draw: drawDashers });
        for (const c of dashers) {
            if (c.real) {
                continue;
            }
            sc.at(c.tIn, () => {
                darkPoof(sc, c.x, c.b - ch / 2, cw);
                ultShake(1.2, 120);
            });
            sc.at(c.tOut, () => darkPoof(sc, c.to[0], c.to[1] - ch / 2, cw * 0.8));
        }
        // 표창 — 머리 위에서 물이 감겨 커짐 → 한 점으로 (물 띠 꼬리)
        sc.add({ max: tAll + 0.02, draw: (ctx, it, t, px) => {
            const life = sc.t;
            for (const th of throws) {
                if (life < th.tForm || life >= th.t0 + fly) {
                    continue;
                }
                const size = th.size * easeOut((life - th.tForm) / 0.3);
                if (size < c2 * 2) {
                    continue;
                }
                if (life > th.t0) {
                    const pts = [];
                    for (let k = 0; k <= 8; k++) {
                        const tt = Math.max(th.t0, life - k * 0.025);
                        pts.push(th.pos(tt));
                        if (tt === th.t0) {
                            break;
                        }
                    }
                    waterRibbon(ctx, px, s, pts, Math.max(2, (size / s) * 0.35), cols, 0.8);
                }
                const [x, y] = th.pos(life);
                drawBigShuriken(ctx, x, y, size, c2, th.c.left ? -ang : ang, cols, 1);
            }
        } });
        for (const th of throws) {
            sc.at(th.t0, () => {
                const [x, y] = th.head(th.t0);
                ring(sc, x, y, s * 2, th.size * 1.2, 0.8, 0.2, ['#ffffff', cols[1]], 1);
                if (th.c.real) {
                    ultShake(3, 220);
                    recoil(pokemon, [{ translate: `${(tx < me.x ? -1 : 1) * 5 * u.s}px 0` }, { translate: '0 0' }], 260);
                }
            });
            // 하나씩 꽂힐 때마다 — 물보라 · 맞은 애 흔들
            sc.at(th.t0 + fly, () => {
                ring(sc, tx, ty, d * 0.4, d * 2, 0.8, 0.25, ['#ffffff', cols[1], DARK[1]], 2);
                debris(tx, ty, s, cols, 10, H * 0.6, { ground: G });
                ultShake(th.c.real ? 3 : 1.5, 140);
                for (const r of u.others()) {
                    if (Math.abs(r.x - tx) < D * 0.8 && Math.abs(r.y - ty) < D) {
                        hit(r, r.x < tx ? -1 : 1, 'shake');
                    }
                }
            });
        }
        const cross = (ctx, px, cx, cy, L, w, alpha) => {
            const paths = [new Path2D(), new Path2D()];
            for (const f of [1, -1]) {
                addLine(paths[0], px, s, [[cx - L, cy - f * L * 0.55], [cx + L, cy + f * L * 0.55]], w + 2);
                addLine(paths[1], px, s, [[cx - L, cy - f * L * 0.55], [cx + L, cy + f * L * 0.55]], w);
            }
            fillPaths(ctx, paths, [DARK[1], '#ffffff'], alpha);
        };
        // 합쳐진 거대 표창 (하나 꽂힐 때마다 커지고 툭 부풂 → 두 번 두근 · 반짝 → 멈칫 동안 부르르) · X 베기
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life >= tStop && life < tStop + 0.3) {
                const k = (life - tStop) / 0.3;
                cross(ctx, px, tx, ty, D * 0.9 * easeOut(k * 4), 2, 1 - k * 0.5);
            }
            const m = arrived(life);
            if (m === 0 || life >= tBoom) {
                return;
            }
            const last = Math.max(...throws.filter((th) => life >= th.t0 + fly).map((th) => th.t0 + fly));
            const pop = 1 + 0.18 * Math.max(0, 1 - (life - last) / 0.12);
            const tremble = life >= tStop ? Math.sin(life * 90) * s * 1.5 : 0;
            const size = lerp(d * 1.3, D, m / throws.length) * pop * (1 + 0.05 * Math.sin(life * 40));
            drawBigShuriken(ctx, tx + tremble, ty, size, C, ang, cols, 1);
            const kg = life - (tDash - 0.25);
            if (kg >= 0 && kg < 0.3) {
                glint(ctx, px, s, tx + size * 0.3, ty - size * 0.3, D * 0.5 * Math.sin((kg / 0.3) * Math.PI), 1);
            }
        } });
        for (const tb of [tAll + 0.1, tAll + 0.26]) {
            sc.at(tb, () => {
                ring(sc, tx, ty, D * 1.3, D * 0.5, 0.85, 0.25, [cols[1], '#ffffff'], 2);
                ultShake(2, 150);
            });
        }
        // 교차 돌진 → 멈칫 (X 베기 · 맞은 애 벌러덩)
        hideUntil(pokemon, ms + 100);
        sc.at(tDash, () => {
            hideMon(pokemon, true);
            screenFlash(s, 0.2, DARK[0], 0.1);
        });
        sc.at(tStop, () => {
            screenFlash(s, 0.3, '#ffffff', 0.1);
            ultShake(5, 200);
            for (const r of u.others()) {
                if (Math.abs(r.x - tx) < D * 0.9 && Math.abs(r.y - ty) < D) {
                    hit(r, r.x < tx ? -1 : 1, 'tumble');
                }
            }
        });
        // 대폭발 — 하얀 번쩍 · 큰 고리 · 표창 조각 → 보랏빛 나선 돔이 솟아 진짜 쪽으로 돎 (닿은 애 휘말림)
        // → 그 위에 분신 · 진짜 · 화면 가르는 X 를 다시 그림 (돔보다 앞에)
        const PURPLE = { rim: DARK[3], body: [DARK[2], DARK[1], DARK[0], '#ffffff'], tail: DARK[1], mid: '#c9b8ff', head: '#ffffff', accent: cols[2], wind: '#f0eaff', back: DARK[1], spray: [DARK[0], DARK[1], DARK[2]], spray2: cols };
        const drawBigX = (ctx, it, t, px) => {
            const life = sc.t;
            if (life >= tX && life < tX + 0.45) {
                const k = (life - tX) / 0.45;
                cross(ctx, px, tx, ty, W * 0.7 * easeOut(k * 4), k < 0.2 ? 3 : 2, 1 - k * k);
            }
        };
        sc.at(tBoom, () => {
            screenFlash(s, 0.6, '#ffffff', 0.3);
            ultShake(8, 520);
            const vmax = G - Math.max(10, H * 0.05);
            const Rc = Math.min(Math.max(D * 1.5, short(u) * 0.5), Math.max(W, G) * 0.9, vmax / 0.92);
            const m = Math.max(10, W * 0.02);
            const x1 = 2 * Rc + 2 * m <= W ? clamp(tx, Rc + m, W - Rc - m) : W / 2;
            swirlDome(sc, tx, x1, G, D * 0.4, Rc, vmax, TDc, cols, real.to[0] < tx ? 1 : -1, (r) => hit(r, r.x < tx ? -1 : 1, 'spin'), PURPLE);
            sc.add({ max: sec, draw: drawDashers });
            sc.add({ max: sec, draw: drawBigX });
            ring(sc, tx, ty, D * 0.4, Math.max(W, H) * 0.7, 0.75, 0.6, ['#ffffff', cols[1], cols[2]], 3);
            ring(sc, tx, ty, D * 0.3, Math.max(W, H) * 0.45, 0.75, 0.5, ['#ffffff', DARK[1]], 2);
            debris(tx, ty, s, cols, 60, H * 1.3, { ground: G, size: [1, 2, 2] });
            sparkles(tx, ty, s, ['#ffffff', cols[0], cols[1]], 16, D * 0.6, H * 0.3);
            shards(tx, ty, s, Math.max(s, Math.round(D / 22 / s) * s), cols, 12, H * 0.9, G - s);
        });
        // 돔이 터지는 순간 — 하얀 번쩍 · 화면 가르는 X (분신은 c.tOut 에 한꺼번에 펑)
        sc.at(tX, () => {
            screenFlash(s, 0.45, '#ffffff', 0.2);
            ultShake(6, 400);
        });
        // 진짜 — 반대편에서 연기로 사라졌다가 제자리에 펑
        sc.at(tOut, () => darkPoof(sc, real.to[0], real.to[1] - ch / 2, cw));
        sc.at(tBack, () => {
            darkPoof(sc, me.x, me.b - ch / 2, cw);
            hideMon(pokemon, false);
            ring(sc, u.body.cx, u.body.cy, u.w * 0.4, u.w * 2.2, 0.8, 0.35, ['#ffffff', cols[1]], 2);
        });
    }

    // ═════ 루카리오 — lucario: 진 파동탄 (ultorb 위에 덮어씀, 아래 Object.assign) ═════
    const NAVY = ['#0b1020', '#141a33', '#26305a']; // 검은 파동
    const FLAME_DARK = ['#1d2a55', '#2e3d73', '#3b4a8a']; // 검은 파동 불꽃 — 어두운 화면에서도 보이게 짙은 남색
    // 파란 파동 테두리 — 그림에 거는 CSS filter (물빛 테두리와 같은 방식)
    const auraLine = (s) => {
        const d = Math.max(1, Math.round(s * 0.75));
        return `drop-shadow(${d}px 0 0 #7ab8ff) drop-shadow(-${d}px 0 0 #7ab8ff) drop-shadow(0 ${d}px 0 #26305a) drop-shadow(0 -${d}px 0 #d8ecff)`;
    };
    // 보이는 그대로 다른 포켓몬 그림 방향 — 인라인 transform 이 -1 이면 뒤집혀 보임
    const shownLeft = (el) => (el.style.transform || '').includes('-1') !== (el.src || '').includes('_left_');
    // 파동 구체 — 검은 테두리 · 파랑 겹 · 하얀 심, 가장자리에 도는 점 고리 두 겹
    function auraOrb(ctx, px, s, x, y, r, cols, life, alpha = 1) {
        if (r < s) {
            return;
        }
        ellipse(ctx, px, s, x, y, r * 1.18, r * 1.18, NAVY[1], alpha * 0.85);
        ellipse(ctx, px, s, x, y, r, r, cols[3], alpha);
        ellipse(ctx, px, s, x, y, r * 0.8, r * 0.8, cols[2], alpha);
        ellipse(ctx, px, s, x - r * 0.1, y - r * 0.1, r * 0.55, r * 0.55, cols[1], alpha);
        ellipse(ctx, px, s, x - r * 0.15, y - r * 0.15, r * 0.28, r * 0.28, '#ffffff', alpha);
        ringDots(ctx, px, s, x, y, r * 1.05 + Math.sin(life * 20) * s, 1, ['#ffffff', cols[1]], alpha * 0.9);
        ringDots(ctx, px, s, x, y, r * 1.32 + Math.cos(life * 17) * s, 1, [NAVY[2], cols[2]], alpha * 0.6);
    }
    // 파동 기둥 — 땅에서 하늘까지 빛기둥이 솟아 일렁이고 고리가 타고 오름. it.burst = 지금 시각 이면 넓게 퍼지며 사라짐
    function auraPillar(sc, x, G, hw, cols) {
        const s = sc.u.S;
        return sc.add({ max: 10, burst: -1, draw: (ctx, it, t, px) => {
            const life = it.life;
            const b = it.burst >= 0 ? clamp((life - it.burst) / 0.35, 0, 1) : 0;
            const a = 1 - b;
            if (a <= 0) {
                it.max = 0;
                return;
            }
            const top = G - (G + 10) * easeOut(life / 0.25);
            const w = hw * (1 + 0.12 * Math.sin(life * 30)) * (1 + 1.5 * b);
            for (const [f, c, al] of [[1.3, NAVY[1], 0.6], [1, cols[3], 0.8], [0.65, cols[2], 0.9], [0.35, cols[1], 1], [0.12, '#ffffff', 1]]) {
                const half = Math.max(s, Math.round((w * f) / s) * s);
                ctx.globalAlpha = al * a;
                ctx.fillStyle = c;
                ctx.fillRect(px(x - half), px(top), 2 * half, px(G - top));
            }
            for (let j = 0; j < 4; j++) {
                const y = G - ((life * 1.5 + j / 4) % 1) * (G - top);
                ringDots(ctx, px, s, x, y, w * 1.6, 0.25, ['#ffffff', cols[1]], 0.8 * a);
            }
        } });
    }

    // 진 파동탄 — 눈을 감으면 화면이 어두워지고 파동이 물결처럼 퍼져 다른 포켓몬이 파란 실루엣으로 보임(파동 감지)
    // → 눈을 번쩍 뜨고 두 손 앞에 파랑 · 검정 파동이 소용돌이치며 모여 구체가 커짐(세 번 두근 · 지지직 · 반짝)
    // → 쏘면 여러 갈래로 갈라져 휘어지며 하나씩 따라가 반드시 맞음(파랑 · 검정 꼬리) → 맞은 곳마다 파동 기둥
    // → 기둥끼리 · 루카리오와 파동 줄기로 이어졌다 한꺼번에 터짐 → 파동 입자가 피어오름. 내내 몸에서 파랑 · 검정 파동 불꽃
    function runTrueAuraSphere(u, o, ms, pokemon) {
        const cols = sigPal(o.c || 'aura');
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const D = Math.min(Math.max(H / 3, short(u) * 0.4) * (0.9 + 0.2 * P), W * 0.42, H * 0.62);
        const R = D * 0.32; // 다 모인 구체 반지름
        // 때 — 파동 감지(물결 둘) · 눈을 뜸 · 두근 셋 · 쏨 · 갈라짐
        const sonar = [0.15, 0.6];
        const TE = 1.15;
        const pulses = [1.5, 1.85, 2.2];
        const TF = 2.6;
        const TSp = 2.75;
        const ox = clamp(me.x + dir * me.w * 0.8, R * 1.4, W - R * 1.4);
        const oy = clamp(me.b - me.h * 0.55, R * 1.4, G - R);
        const sx = clamp(ox + dir * D * 0.6, R, W - R);
        // 노리는 곳 — 가까운 애부터 넷, 모자라면 앞쪽 땅 (적어도 셋)
        const tgts = u.others().sort((a, b) => Math.abs(a.x - me.x) - Math.abs(b.x - me.x)).slice(0, 4).map((q) => ({ q }));
        for (let j = 0; tgts.length < 3; j++) {
            tgts.push({ fx: clamp(me.x + dir * W * (0.3 + 0.2 * j), W * 0.08, W * 0.92), fy: G - Math.max(me.h * 0.5, s * 6) });
        }
        const live = (tg) => (tg.q ? where(u, tg.q) : { x: tg.fx, y: tg.fy });
        // 갈래마다 — 부채꼴로 퍼졌다가 휘어져 노리는 곳으로 (베지에), 차례로 조금씩 늦게
        tgts.forEach((tg, i) => {
            const n = tgts.length;
            tg.t0 = TSp + 0.06 * i;
            tg.dur = 0.55 + 0.08 * i;
            tg.fan = (n === 1 ? 0 : i / (n - 1) - 0.5) * 2;
        });
        const sphereAt = (tg, t) => {
            const k = clamp((t - tg.t0) / tg.dur, 0, 1);
            const e = k * k * (3 - 2 * k);
            const p = live(tg);
            const c1 = [sx + dir * D * 0.9, oy + tg.fan * H * 0.35];
            const c2 = [p.x - Math.sign(p.x - sx || dir) * D * 0.6, p.y - H * 0.3];
            const m = 1 - e;
            return [m * m * m * sx + 3 * m * m * e * c1[0] + 3 * m * e * e * c2[0] + e * e * e * p.x, m * m * m * oy + 3 * m * m * e * c1[1] + 3 * m * e * e * c2[1] + e * e * e * p.y];
        };
        const arrive = Math.max(...tgts.map((tg) => tg.t0 + tg.dur));
        const TLk = arrive + 0.3; // 파동 줄기로 이어짐
        const TBu = TLk + 0.25; // 한꺼번에 터짐
        const sc = scene(u, sec + 0.3, 'ultorb');
        ultDark(0.3, ms - 200);
        // 파동 감지 동안 더 어둡게
        ultDimLayer((life) => 0.35 * Math.min(1, life / 0.2) * clamp((TE + 0.25 - life) / 0.3, 0, 1), TE + 0.3);

        // 몸에서 피어오르는 파랑 · 검정 파동 불꽃 · 파란 테두리
        try {
            pokemon.el.style.filter = auraLine(u.s);
        } catch (err) {
            fail('aura', err);
        }
        let flame = 0;
        sc.tick((t, dt) => {
            flame += dt * (t > TE && t < TF ? 70 : 35);
            while (flame >= 1) {
                flame -= 1;
                if (room()) {
                    const dark = Math.random() < 0.4;
                    sigParticle({ x: me.x + rnd(-1, 1) * me.w * 0.45, y: me.b - rnd(0, me.h * 0.8), s, vx: rnd(-1, 1) * H * 0.03, vy: -H * rnd(0.25, 0.5), drag: 1.5, max: rnd(0.35, 0.6), color: pick(dark ? FLAME_DARK : [cols[1], cols[2], cols[3]]), size: pick([1, 2, 2]), draw: DRAW.dot });
                }
            }
        });
        // ① 파동 감지 — 파동이 물결처럼 퍼지고, 다른 포켓몬이 파란 파동 실루엣으로 (물결이 지나갈 때 밝게)
        for (const ts of sonar) {
            sc.at(ts, () => {
                ring(sc, me.x, me.b - me.h * 0.5, me.w * 0.5, Math.max(W, H) * 1.1, 0.6, 0.9, [cols[1], '#ffffff', cols[2]], 2);
                ultShake(1, 120);
            });
        }
        sc.add({ max: sec, draw: (ctx) => {
            const life = sc.t;
            if (life < 0.2 || life > TE + 0.3) {
                return;
            }
            const fade = clamp((TE + 0.3 - life) / 0.3, 0, 1) * clamp((life - 0.2) / 0.2, 0, 1);
            for (const r of u.others()) {
                const el = r.pokemon.el;
                const box = el.getBoundingClientRect();
                if (!box.width) {
                    continue;
                }
                const dist = Math.hypot(r.x - me.x, r.y - me.b);
                const wave = Math.max(...sonar.map((ts) => Math.exp(-(((life - ts) * Math.max(W, H) * 1.2 - dist) ** 2) / (2 * (Math.max(W, H) * 0.08) ** 2))));
                const a = fade * (0.55 + 0.45 * wave);
                const x = box.left + box.width / 2;
                const left = shownLeft(el);
                for (const [dx, dy] of [[s, 0], [-s, 0], [0, s], [0, -s]]) {
                    drawMon(ctx, el, x + dx, box.bottom + dy, box.width, left, a, '#ffffff');
                }
                drawMon(ctx, el, x, box.bottom, box.width, left, a, cols[2]);
            }
        } });
        // 눈을 번쩍 뜸 — 머리에 하얀 반짝
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const k = sc.t - TE;
            if (k < 0 || k > 0.3) {
                return;
            }
            const hx = me.x + dir * me.w * 0.12;
            const hy = me.b - me.h * 0.78;
            glint(ctx, px, s, hx, hy, me.w * 0.9 * Math.sin((k / 0.3) * Math.PI), 1);
        } });
        sc.at(TE, () => {
            ultShake(2, 160);
            ring(sc, me.x, me.b - me.h * 0.5, me.w * 0.4, me.w * 2.5, 0.8, 0.35, ['#ffffff', cols[1]], 2);
        });

        // ② 모으기 — 두 손 앞에 파랑 · 검정 두 줄기씩 소용돌이치며 빨려 듦 + 알갱이 · 지지직, 세 번 두근, 다 되면 반짝
        const orbR = (t) => {
            if (t < TE) {
                return 0;
            }
            let r = t < TF ? R * (0.15 + 0.85 * ((t - TE) / (TF - TE)) ** 1.2) : R;
            for (const tp of pulses) {
                r *= 1 + 0.15 * clamp(1 - Math.abs(t - tp) / 0.12, 0, 1);
            }
            return r;
        };
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TE + 0.05 || life > TF) {
                return;
            }
            const k = (life - TE) / (TF - TE);
            const a = clamp(Math.min(k / 0.15, (1 - k) / 0.1), 0, 1);
            const R0 = D * (1.4 - 0.4 * k);
            const inner = orbR(life) * 0.9;
            const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
            for (let j = 0; j < 4; j++) {
                const blue = j % 2 === 0;
                for (let i = 0; i < 34; i++) {
                    const f = (i / 34 + life * 1.2) % 1;
                    const r = lerp(R0, inner, f);
                    const an = (j / 4) * TAU + f * 4.2 * dir + life * 7 * dir;
                    const th = f < 0.15 ? 1 : f < 0.6 ? 2 : 3;
                    (blue ? paths[f > 0.6 ? 1 : 0] : paths[f > 0.6 ? 3 : 2]).rect(px(ox + Math.cos(an) * r - s), px(oy + Math.sin(an) * r * 0.8 - s), th * s, th * s);
                }
            }
            fillPaths(ctx, paths, [cols[2], cols[0], NAVY[2], '#9fb2e8'], 0.95 * a);
        } });
        sc.tick((t) => {
            if (t < TE + 0.05 || t > TF - 0.1 || !room(4)) {
                return;
            }
            for (let j = 0; j < 4; j++) {
                const a0 = rnd(0, TAU);
                const r0 = D * rnd(0.8, 1.4);
                sigParticle({ x: ox, y: oy, s, max: rnd(0.3, 0.45), a0, r0, color: pick(j % 2 ? NAVY : cols), size: pick([1, 2]),
                    update: (p) => {
                        const k = p.life / p.max;
                        const an = p.a0 + k * 5 * dir;
                        p.x = ox + Math.cos(an) * p.r0 * (1 - k);
                        p.y = oy + Math.sin(an) * p.r0 * (1 - k) * 0.8;
                    },
                    draw: DRAW.dot });
            }
        });
        let zap = 0;
        sc.tick((t, dt) => {
            if (t < TE + 0.3 || t > TF) {
                return;
            }
            zap += dt;
            if (zap > 0.09) {
                zap = 0;
                const r = orbR(t);
                const a = rnd(0, TAU);
                strike(sc, ox + Math.cos(a) * r, oy + Math.sin(a) * r, ox + Math.cos(a) * r * 2.2, oy + Math.sin(a) * r * 2.2, { w: 1, branches: 1, dur: 0.12, amp: 0.35, mid: cols[1], glow: NAVY[2] });
            }
        });
        for (const tp of pulses) {
            sc.at(tp, () => {
                ring(sc, ox, oy, D * 1.2, orbR(tp), 0.85, 0.3, [cols[1], NAVY[2], '#ffffff'], 2);
                ultShake(1.5, 150);
            });
        }
        // 구체 — 모일 때는 두 손 앞, 쏘면 앞으로 조금 나갔다가 갈라짐
        sc.add({ max: TSp, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const r = orbR(life);
            const x = life < TF ? ox : lerp(ox, sx, easeOut((life - TF) / (TSp - TF)));
            auraOrb(ctx, px, s, x, oy, r, cols, life);
            const kg = life - (TF - 0.18);
            if (kg >= 0 && kg < 0.3) {
                glint(ctx, px, s, x + r * 0.5, oy - r * 0.5, D * 0.5 * Math.sin((kg / 0.3) * Math.PI), 1);
            }
        } });
        sc.at(TF - 0.22, () => recoil(pokemon, [{ translate: '0 0' }, { translate: `${-dir * 3 * u.s}px 0` }], 220));
        sc.at(TF, () => {
            screenFlash(s, 0.25, cols[1], 0.12);
            ultShake(4, 280);
            ring(sc, ox, oy, R, D * 1.5, 0.85, 0.35, ['#ffffff', cols[1], NAVY[2]], 2);
            recoil(pokemon, [{ translate: `${dir * 6 * u.s}px 0` }, { translate: '0 0' }], 300);
        });
        sc.at(TSp, () => {
            ring(sc, sx, oy, R * 0.5, D * 1.1, 0.85, 0.3, ['#ffffff', cols[2]], 2);
            sparkles(sx, oy, s, ['#ffffff', cols[1]], 10, R, H * 0.15);
        });

        // ③ 갈래 — 휘어지며 따라가 반드시 맞음 (파랑 · 검정 꼬리), 맞은 곳마다 파동 기둥
        const pillars = [];
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            for (const tg of tgts) {
                if (life < tg.t0 || life >= tg.t0 + tg.dur) {
                    continue;
                }
                const pts = [];
                for (let k = 0; k <= 10; k++) {
                    const tt = Math.max(tg.t0, life - k * 0.025);
                    pts.push(sphereAt(tg, tt));
                    if (tt === tg.t0) {
                        break;
                    }
                }
                const r = R * 0.55;
                waterRibbon(ctx, px, s, pts, (r / s) * 1.4, [null, NAVY[2], NAVY[1]], 0.7);
                waterRibbon(ctx, px, s, pts, (r / s) * 0.9, cols, 0.9);
                const [x, y] = sphereAt(tg, life);
                auraOrb(ctx, px, s, x, y, r, cols, life);
            }
        } });
        for (const tg of tgts) {
            sc.at(tg.t0 + tg.dur, () => {
                const p = live(tg);
                ultShake(3, 200);
                ring(sc, p.x, p.y, R * 0.4, D * 1.2, 0.8, 0.4, ['#ffffff', cols[1], NAVY[2]], 2);
                debris(p.x, p.y, s, [cols[0], cols[1], cols[2], NAVY[2]], 18, H * 0.8, { ground: G });
                pillars.push({ x: p.x, it: auraPillar(sc, p.x, G, Math.max(R * 0.55, s * 4), cols) });
                if (tg.q) {
                    hit(tg.q, Math.sign(p.x - me.x) || dir, 'lift');
                }
            });
        }
        // ④ 기둥끼리 · 루카리오와 파동 줄기로 이어짐 → 한꺼번에 터짐
        sc.at(TLk, () => {
            const order = [...pillars].sort((a, b) => Math.abs(a.x - me.x) - Math.abs(b.x - me.x));
            let x0 = me.x;
            let y0 = me.b - me.h * 0.5;
            for (const pl of order) {
                const y1 = G - H * rnd(0.3, 0.6);
                strike(sc, x0, y0, pl.x, y1, { w: 2, branches: 2, dur: 0.3, amp: 0.25, mid: cols[1], glow: NAVY[2] });
                x0 = pl.x;
                y0 = y1;
            }
            ultShake(3, 220);
        });
        sc.at(TBu, () => {
            screenFlash(s, 0.55, '#ffffff', 0.28);
            ultShake(7, 500);
            for (const pl of pillars) {
                pl.it.burst = pl.it.life;
                ring(sc, pl.x, G - H * 0.4, R * 0.5, D * 1.8, 0.8, 0.5, ['#ffffff', cols[1], cols[2]], 3);
                debris(pl.x, G - H * 0.4, s, [cols[0], cols[1], cols[2], NAVY[2]], 26, H * 1.1, { ground: G, size: [1, 2, 2], r: R });
                sparkles(pl.x, G - H * 0.5, s, ['#ffffff', cols[1]], 8, R, H * 0.3);
            }
            ring(sc, me.x, me.b - me.h * 0.5, me.w, Math.max(W, H) * 1.1, 0.6, 0.7, ['#ffffff', cols[1], NAVY[2]], 3);
            for (const r of u.others()) {
                hit(r, Math.sign(r.x - me.x) || dir, 'tumble');
            }
        });
        // 파동 입자가 피어오름 (끝까지)
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const k = sc.t - TBu;
            if (k <= 0) {
                return;
            }
            const a = clamp(k / 0.2, 0, 1) * clamp((sec - sc.t) / 0.35, 0, 1);
            const paths = [new Path2D(), new Path2D()];
            const m = Math.round(40 * clamp(W / 480, 0.6, 2));
            for (let j = 0; j < m; j++) {
                const y = wrap(G - hash(j, 2) * G - k * H * (0.35 + hash(j, 3) * 0.4), G + 10, -10);
                paths[j % 3 === 0 ? 1 : 0].rect(px(hash(j, 1) * W + Math.sin(k * 3 + j) * s * 3), px(y), s, s * (j % 3 === 0 ? 1 : 2));
            }
            fillPaths(ctx, paths, [cols[2], '#ffffff'], 0.7 * a);
        } });
    }

    // ═════ 리자몽 — flare: 플레어드라이브 (ultdive 위에 덮어씀) · blast: 블래스트번 (ultpillar 위에 덮어씀, 아래 Object.assign) ═════
    // 불꽃은 파이어 필살기와 같은 그림 — 불꽃 혀(불새 · fx-body drawAura) · 땅 불길 띠(열풍) · 불비 줄기(열풍 fieldFire)
    const EMBER = ['#7a1a0e', '#b8290f']; // 짙은 불 (바깥 테두리)
    const SMOKE = '#7a7a7a'; // 연기
    // 불꽃 테두리 — 그림에 거는 CSS filter
    const fireLine = (s) => {
        const d = Math.max(1, Math.round(s * 0.75));
        return `drop-shadow(${d}px 0 0 #ffc93c) drop-shadow(-${d}px 0 0 #ffc93c) drop-shadow(0 ${d}px 0 #d9381e) drop-shadow(0 -${d}px 0 #fff6b3)`;
    };
    // 불꽃 혀 — 아래가 넓고 위로 뾰족하게 일렁이는 불꽃 (가로줄로, 바깥 빨강 → 주황 → 노랑 → 하얀 심). 발(bottom) 기준, 폭 w · 높이 h,
    // T 로 일렁임, k 세기(0~1), lean 은 꼭대기가 기우는 정도 (+ 오른쪽)
    function flameTongue(ctx, px, s, cx, bottom, w, h, cols, T, k = 1, lean = 0, alpha = 1) {
        if (k <= 0.02 || h < s * 2) {
            return;
        }
        const half0 = Math.max(w * 0.5, s * 2);
        const sy = Math.max(1, h / (40 * s)); // 큰 불꽃은 일렁임 물결도 길게 (털처럼 삐죽해지지 않게)
        for (const [m, c, a] of [[1, cols[3], 0.6], [0.78, cols[2], 0.8], [0.52, cols[1], 0.9], [0.28, cols[0], 0.95]]) {
            ctx.globalAlpha = Math.min(1, a * Math.min(1, k * 1.4) * alpha);
            ctx.fillStyle = c;
            const top = h * (0.55 + 0.45 * m);
            for (let yy = 0; yy < top; yy += s) {
                const f = yy / h;
                const shape = Math.sqrt(Math.max(0, Math.sin(Math.PI * Math.min(1, (f + 0.14) / 1.14)))) * (1 - f * 0.5);
                const flick = 1 + 0.2 * Math.sin(T * 23 + (yy / sy) * 0.33 + m * 3) + 0.1 * Math.sin(T * 41 - (yy / sy) * 0.7);
                const half = half0 * m * shape * flick;
                if (half < s * 0.5) {
                    continue;
                }
                const x = cx + lean * f * h * 0.45;
                ctx.fillRect(px(x - half), px(bottom - yy - s), Math.max(s, px(2 * half)), s);
            }
        }
    }
    // 땅 불길 띠 — x0 ~ x1 땅 위로 2칸 기둥마다 높이가 파도처럼 일렁임 (아래 하얀 · 노랑 → 위 주황 · 빨강)
    function groundFlames(ctx, px, s, x0, x1, G, maxH, life, cols, alpha = 1) {
        if (alpha <= 0.01 || maxH < s || x1 <= x0) {
            return;
        }
        const colW = 2 * s;
        const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
        for (let x = Math.floor(x0 / colW) * colW; x < x1; x += colW) {
            const col = Math.round(x / colW);
            const n1 = Math.sin(x * 0.09 + life * 11) * 0.5 + 0.5;
            const n2 = Math.sin(x * 0.031 - life * 6.3 + 1.7) * 0.5 + 0.5;
            const h = maxH * (0.2 + 0.5 * n1 * n2 + 0.3 * hash(col, Math.floor(life * 12)));
            let y = G + 2 * s;
            for (const [f, k] of [[0.35, 0], [0.3, 1], [0.22, 2], [0.13, 3]]) {
                const hh = Math.max(s, px(h * f));
                y -= hh;
                paths[k].rect(px(x), px(y), colW, hh);
            }
        }
        fillPaths(ctx, paths, [cols[0], cols[1], cols[2], cols[3]], alpha);
    }
    // 불꽃 꼬리 — (x, y) 머리가 (ux, uy) 쪽으로 날아가고 뒤로 불꽃 혀가 끌림 (둥근 머리 → 가늘어지며 일렁이는 꼬리,
    // 겹친 색: 바깥 빨강 → 주황 → 노랑 → 하얀 심). 가파르면 가로줄, 누우면 세로줄로 그려 계단처럼 보이지 않게
    function fireTail(ctx, px, s, x, y, ux, uy, len, w, cols, T, alpha = 1) {
        const rows = Math.abs(uy) >= Math.abs(ux);
        const d = Math.max(0.3, rows ? Math.abs(uy) : Math.abs(ux)); // 한 줄 넘어갈 때 축으로 s / d
        for (const [m, c, a] of [[1, cols[3], 0.6], [0.78, cols[2], 0.8], [0.52, cols[1], 0.9], [0.28, cols[0], 0.95]]) {
            ctx.globalAlpha = Math.min(1, a * alpha);
            ctx.fillStyle = c;
            const L = len * (0.3 + 0.7 * m);
            const rm = w * 0.5 * m;
            const j1 = Math.ceil((L * d) / s);
            for (let j = Math.floor((-rm * d) / s); j <= j1; j++) {
                const at = (j * s) / d;
                let half;
                if (at < 0) {
                    half = Math.sqrt(Math.max(0, rm * rm - at * at));
                } else {
                    const f = at / L;
                    half = rm * (1 - f) ** 0.7 * (1 + f * (0.25 * Math.sin(T * 23 + at * 0.3 + m * 3) + 0.12 * Math.sin(T * 41 - at * 0.6)));
                }
                if (half < s * 0.5) {
                    continue;
                }
                const hh = half / d;
                const cx = x - ux * at;
                const cy = y - uy * at;
                if (rows) {
                    ctx.fillRect(px(cx - hh), px(cy), Math.max(s, px(2 * hh)), s);
                } else {
                    ctx.fillRect(px(cx), px(cy - hh), s, Math.max(s, px(2 * hh)));
                }
            }
        }
    }
    // 불꽃 구 — (x, y) 둘레로 동그랗게 타오르는 불덩이: 겹친 색(바깥 빨강 → 주황 → 노랑 → 하얀 심)의 테두리가 저마다 일렁이고
    // 위쪽은 불꽃이 조금 더 솟음. 반지름 R × k, maxY 아래(땅 속)는 안 그림, cool(0 ~ 1)만큼 안쪽 색부터 줄어듦(식음).
    // 테두리는 각도 128칸으로 미리 계산 (칸마다 sin 을 안 하게). lay = 색 겹 크기(바깥 → 심), lick = 위로 솟는 불꽃 세기
    function fireOrb(ctx, px, s, x, y, R, cols, T, k = 1, maxY = Infinity, alpha = 1, cool = 0, lay = [1, 0.8, 0.6, 0.38], lick = 1) {
        if (k <= 0.02 || alpha <= 0.01 || R < s * 2) {
            return;
        }
        const NA = 128;
        const edges = [];
        let Rm = 0;
        for (let j = 0; j < 4; j++) {
            const m = lay[j];
            const row = new Float32Array(NA);
            for (let i = 0; i < NA; i++) {
                const a = (i / NA) * TAU - Math.PI;
                const up = Math.max(0, -Math.sin(a));
                const lk = lick * (up * up * (0.3 - 0.06 * j) * (0.7 + 0.3 * Math.sin(a * 5 - T * 11 + j)) + up * 0.08 * Math.sin(a * 9 + T * 13 + j));
                row[i] = R * k * m * Math.max(0, 1 - cool * (0.3 + 0.35 * j)) * (1 + 0.06 * Math.sin(a * 7 + T * 9 + j * 2) + 0.04 * Math.sin(a * 12 - T * 14 + j) + lk);
                Rm = Math.max(Rm, row[i]);
            }
            edges.push(row);
        }
        const c = s * Math.max(1, Math.round((R * k) / (60 * s))); // 아주 큰 구는 칸을 키움 (가볍게)
        const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
        const y1 = Math.min(y + Rm, maxY);
        for (let gy = Math.floor((y - Rm) / c) * c; gy < y1; gy += c) {
            const dy = gy + c / 2 - y;
            for (let gx = Math.floor((x - Rm) / c) * c; gx < x + Rm; gx += c) {
                const dx = gx + c / 2 - x;
                const d = Math.hypot(dx, dy);
                if (d >= Rm) {
                    continue;
                }
                const i = Math.min(NA - 1, Math.floor(((Math.atan2(dy, dx) + Math.PI) / TAU) * NA));
                let layer = -1;
                while (layer < 3 && d < edges[layer + 1][i]) {
                    layer++;
                }
                if (layer >= 0) {
                    paths[layer].rect(px(gx), px(gy), c, c);
                }
            }
        }
        fillPaths(ctx, paths, [cols[3], cols[2], cols[1], cols[0]], alpha);
    }
    // 도는 불씨 고리 — (x, y) 둘레 반지름 r 로 불씨 세 줄이 꼬리를 끌며 빙글빙글 (dirn 방향)
    function orbitEmbers(ctx, px, s, x, y, r, cols, T, dirn, alpha = 1) {
        if (alpha <= 0.01) {
            return;
        }
        ringDots(ctx, px, s, x, y, r, 1, [cols[1], cols[2]], 0.45 * alpha);
        const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
        for (let j = 0; j < 3; j++) {
            for (let i = 0; i < 26; i++) {
                const a = T * 6 * dirn + (j / 3) * TAU - i * 0.06 * dirn;
                const ci = i < 3 ? 0 : i < 9 ? 1 : i < 17 ? 2 : 3;
                const z = i < 3 ? 2 * s : s;
                paths[ci].rect(px(x + Math.cos(a) * r - z / 2), px(y + Math.sin(a) * r - z / 2), z, z);
            }
        }
        fillPaths(ctx, paths, [cols[0], cols[1], cols[2], cols[3]], alpha);
    }
    // 불기둥 대폭발 — 땅(x, G)에서: 동그란 불꽃이 확 퍼짐(반쯤 땅에 묻힌 불꽃 구, 안쪽부터 식음) · 사방으로 뻗는 불꽃 줄기
    // · 포물선으로 날아가 떨어지는 불덩이 파편 · 둘레에서 차례로 펑펑 터지는 작은 폭발 다섯
    // · 화면 꼭대기 너머까지 일자로 곧고 넓은 불기둥(겹친 색, 안쪽 밝은 띠가 위로 흐름) → 가늘어지며 사그라듦. 밑동 양옆 불꽃 혀, 기둥을 따라 불씨가 솟음
    function firePillar(sc, x, G, w, dur, cols) {
        const { S: s, H, W } = sc.u;
        const R = w * 1.5; // 폭발 구 반지름
        const top = G + H * 0.1; // 기둥 높이 — 화면 위 밖까지
        // 불꽃 줄기 — 위쪽 반원으로 14 가닥
        const rays = [];
        for (let i = 0; i < 14; i++) {
            rays.push(-Math.PI + ((i + 0.5) / 14) * Math.PI + (hash(i, 51) - 0.5) * 0.15);
        }
        // 불덩이 파편 — 기둥 밖 양옆으로 비스듬히 튀어 포물선을 그리며 떨어짐
        const g = H * 2.2;
        const bits = [];
        for (let i = 0; i < 12; i++) {
            const a = i % 2 ? -Math.PI + rnd(0.3, 0.95) : -rnd(0.3, 0.95);
            const sp = H * rnd(1.2, 1.8);
            bits.push({ x, y: G - s * 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, on: true });
        }
        // 작은 폭발 — 양옆으로 번갈아, 0.1초 간격
        const pops = [];
        for (let i = 0; i < 5; i++) {
            const side = i % 2 ? -1 : 1;
            pops.push({ x: clamp(x + side * R * (0.7 + 0.18 * i + 0.2 * hash(i, 52)), 0, W), t0: 0.1 + i * 0.1, r: R * (0.32 + 0.1 * hash(i, 53)), on: false });
        }
        let spark = 0;
        return sc.add({ max: dur,
            update: (it, dt) => {
                const life = it.life;
                spark += dt * 100 * (1 - life / dur);
                while (spark >= 1) {
                    spark -= 1;
                    fireBits(x + rnd(-1, 1) * w * 0.5, G - rnd(0, G * 0.8), s, cols, 1, { angle: -Math.PI / 2, spread: 0.4, speed: H * 0.9, drag: 1, life: 0.6 });
                }
                for (const b of bits) {
                    if (!b.on) {
                        continue;
                    }
                    b.vy += g * dt;
                    b.x += b.vx * dt;
                    b.y += b.vy * dt;
                    if (b.y > G && b.vy > 0) {
                        b.on = false;
                        fireBits(b.x, G - s, s, cols, 8, { angle: -Math.PI / 2, spread: Math.PI, speed: H * 0.4, drag: 2.4, life: 0.5 });
                    }
                }
                for (const q of pops) {
                    if (!q.on && life >= q.t0) {
                        q.on = true;
                        ultShake(3, 150);
                        fireBits(q.x, G - q.r * 0.5, s, cols, 14, { angle: -Math.PI / 2, spread: Math.PI * 1.2, speed: H * 0.6, drag: 2.2, life: 0.6 });
                    }
                }
            },
            draw: (ctx, it, t, px) => {
                const life = it.life;
                // 폭발 구 — 0.25초 만에 확 커지고, 안쪽(하양 → 노랑)부터 식어 줄어들다 끝에만 빨리 옅어짐
                if (life < 0.75) {
                    const grow = easeOut(Math.min(1, life / 0.25));
                    const cool = clamp((life - 0.25) / 0.5, 0, 1);
                    fireOrb(ctx, px, s, x, G, R, cols, life, grow * (1 + cool * 0.15), G + s, life > 0.6 ? (0.75 - life) / 0.15 : 1, cool);
                }
                // 작은 폭발들
                pops.forEach((q, i) => {
                    const l = life - q.t0;
                    if (l > 0 && l < 0.5) {
                        fireOrb(ctx, px, s, q.x, G, q.r, cols, life + i, easeOut(Math.min(1, l / 0.15)) * (l > 0.4 ? (0.5 - l) / 0.1 : 1), G + s, 1, clamp((l - 0.15) / 0.35, 0, 1)); // 끝엔 옅어지지 않고 작아짐 (탁한 갈색이 안 남게)
                    }
                });
                // 사방으로 뻗는 불꽃 줄기
                if (life < 0.45) {
                    const k = life / 0.45;
                    const d = R * (0.3 + 1.5 * easeOut(k));
                    rays.forEach((a, i) => {
                        fireTail(ctx, px, s, x + Math.cos(a) * d, G + Math.sin(a) * d * 0.85, Math.cos(a), Math.sin(a) * 0.85, R * 0.95 * (1 - k), R * 0.17 * Math.sqrt(1 - k), cols, life + i, 1);
                    });
                }
                // 불기둥 — 일자로 곧고 넓게 (가장자리만 살짝 일렁, 안쪽 밝은 띠가 위로 흐름)
                const up = easeOut(Math.min(1, life / 0.18));
                const down = t > 0.62 ? easeIn((t - 0.62) / 0.38) : 0;
                const Hp = top * up;
                const half0 = w * 0.5 * (1 - down);
                if (half0 >= s) {
                    for (const [m, c, a] of [[1, cols[3], 0.8], [0.84, cols[2], 0.9], [0.62, cols[1], 1], [0.36, cols[0], 1]]) {
                        ctx.globalAlpha = a * (1 - down * 0.4);
                        ctx.fillStyle = c;
                        for (let yy = 0; yy < Hp; yy += s) {
                            const f = yy / Hp;
                            const tip = up < 1 && f > 0.9 ? Math.sqrt((1 - f) / 0.1) : 1; // 솟는 동안만 끝이 둥글게
                            const band = m < 0.7 ? 0.14 * Math.max(0, Math.sin((yy / w) * 3 - life * 22)) : 0;
                            const half = half0 * m * tip * (1 + 0.035 * Math.sin(life * 30 + (yy / w) * 9 + m * 5) + band);
                            if (half < s * 0.5) {
                                continue;
                            }
                            ctx.fillRect(px(x - half), px(G - yy - s), Math.max(s, px(2 * half)), s);
                        }
                    }
                }
                // 밑동 양옆 불꽃 혀
                for (const f of [-1, 1]) {
                    flameTongue(ctx, px, s, x + f * w * 0.62, G, w * 0.6, w * 1.4 * up * (1 - down), cols, life + f, 1 - down, f * 0.25);
                }
                // 불덩이 파편 — 날아가는 쪽으로 머리, 뒤로 불꽃 꼬리
                bits.forEach((b, i) => {
                    if (b.on) {
                        const sp = Math.hypot(b.vx, b.vy) || 1;
                        fireTail(ctx, px, s, b.x, b.y, b.vx / sp, b.vy / sp, Math.min(R * 0.7, sp * 0.12), Math.max(4 * s, R * 0.12), cols, life + i, 1);
                    }
                });
            } });
    }
    // 기 모으기 — t0 ~ t1 동안 둘레(반지름 pullR)의 불꽃 줄기 9 가닥이 소용돌이치며 at(t) 자리의 불꽃 구(반지름 Ro)로 빨려 들고
    // 불씨도 모여듦, 점점 빨라짐 (dirn 쪽으로 돎)
    function chargeSwirl(sc, at, t0, t1, pullR, Ro, cols, dirn) {
        const s = sc.u.S;
        sc.add({ max: t1 + 0.1, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < t0 || life > t1) {
                return;
            }
            const [cx, cy] = at(life);
            const k = life - t0;
            const ramp = clamp(k / 0.4, 0, 1) * clamp((t1 - life) / 0.12, 0, 1);
            for (let i = 0; i < 9; i++) {
                const ph = (k * (1.3 + 0.5 * k) + i / 9) % 1; // 빠르기 1.3 → 점점 빨라짐
                const a0 = hash(i, 41) * TAU + i * 2.4;
                const pos = (q) => {
                    const r = lerp(pullR, Ro * 0.8, q ** 1.6);
                    const an = a0 + q * 2.4 * dirn;
                    return [cx + Math.cos(an) * r, cy + Math.sin(an) * r * 0.8];
                };
                const [x, y] = pos(ph);
                const [x2, y2] = pos(Math.min(1, ph + 0.02));
                const dl = Math.hypot(x2 - x, y2 - y) || 1;
                fireTail(ctx, px, s, x, y, (x2 - x) / dl, (y2 - y) / dl, Ro * (0.9 + 0.8 * (1 - ph)), Ro * 0.55 * (1 - 0.5 * ph), cols, life + i, ramp * Math.sqrt(Math.sin(ph * Math.PI)));
            }
        } });
        let pull = 0;
        sc.tick((t, dt) => {
            if (t < t0 || t > t1 - 0.1) {
                return;
            }
            pull += dt * (40 + 40 * (t - t0));
            while (pull >= 1 && room(4)) {
                pull -= 1;
                sigParticle({ x: 0, y: 0, s, max: rnd(0.35, 0.6), a0: rnd(0, TAU), r0: pullR * rnd(0.6, 1.2), color: pick(cols), size: pick([1, 1, 2]),
                    update: (p) => {
                        const [cx, cy] = at(sc.t);
                        const e = (p.life / p.max) ** 2;
                        p.x = cx + Math.cos(p.a0 + e * 3 * dirn) * p.r0 * (1 - e);
                        p.y = cy + Math.sin(p.a0 + e * 3 * dirn) * p.r0 * (1 - e) * 0.8;
                    },
                    draw: DRAW.dot });
            }
            if (pull >= 1) {
                pull = 0;
            }
        });
    }
    // 반구 대폭발 (드래곤볼 베지터 자폭처럼) — 땅(x, G)에서 매끈한 빛의 반구가 0.6초 동안 서서히 부풀어 눈부시게 빛나다 사그라듦.
    // 거의 하얀 심 · 얇게 번지는 테두리(색 사이는 도트를 섞어 부드럽게) · 바깥으로 번지는 빛 무리 · 반구 안을 비스듬히 흐르는 옅은 빛줄기
    // · 화면 전체가 빛에 물듦 · 밑동의 돌덩이들이 빛 앞에서 검은 실루엣으로 천천히 떠오름. cols = 하양 → 짙은 색
    const ROCK = ['#2e2620', '#4a3d33', '#6b5a4a', '#8a7660'];
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]; // 4×4 도트 섞기 차례
    function blastDome(sc, x, G, R, dur, cols) {
        const { S: s, H, W } = sc.u;
        // 빛줄기 — 반구 안에서 오른쪽 위로 천천히 흐르는 옅은 줄
        const streaks = [];
        for (let i = 0; i < 14; i++) {
            streaks.push({ a: -Math.PI * (0.1 + 0.8 * hash(i, 62)), r: 0.1 + 0.65 * hash(i, 63), len: 0.25 + 0.2 * hash(i, 64), sp: 0.15 + 0.2 * hash(i, 65) });
        }
        // 돌덩이 — 밑동 곳곳에서 빛에 밀려 천천히 떠오르며 바깥으로
        const rocks = [];
        for (let i = 0; i < 28; i++) {
            const side = i % 2 ? -1 : 1;
            const off = R * (0.15 + 1.05 * hash(i, 71));
            rocks.push({ x: x + side * off, y: G - s * 2 * hash(i, 72), vx: side * R * (0.04 + 0.16 * hash(i, 73)), vy: -H * (0.05 + 0.18 * hash(i, 74)), t0: (off / R) * 0.45, z: s * (3 + Math.floor(hash(i, 75) * 3)), col: ROCK[Math.floor(hash(i, 76) * 3)] });
        }
        let spark = 0;
        return sc.add({ max: dur,
            update: (it, dt) => {
                const life = it.life;
                for (const r of rocks) {
                    if (life > r.t0) {
                        r.x += r.vx * dt;
                        r.y += r.vy * dt;
                        r.vy *= 1 - dt * 0.5;
                    }
                }
                spark += dt * 40 * (1 - life / dur);
                while (spark >= 1) {
                    spark -= 1;
                    const a = rnd(-Math.PI, 0);
                    fireBits(x + Math.cos(a) * R * 1.02, G + Math.sin(a) * R * 1.02, s, cols, 1, { angle: a, spread: 0.5, speed: H * 0.4, drag: 1.5, life: 0.6 });
                }
            },
            draw: (ctx, it, t, px) => {
                const life = it.life;
                const grow = 1 - (1 - Math.min(1, life / 0.6)) ** 2; // 처음에 확 튀어나가지 않고 서서히 커짐
                const fade = life > dur - 0.6 ? Math.max(0, (dur - life) / 0.6) : 1;
                const rr = R * grow;
                // 화면 전체가 빛에 물듦
                ctx.globalAlpha = 0.22 * grow * fade;
                ctx.fillStyle = cols[1];
                ctx.fillRect(0, 0, W, H);
                domeLight(ctx, px, s, x, G, rr, cols, life, fade);
                // 빛줄기 — 하얀 심 안에서만
                if (rr > s * 10) {
                    const path = new Path2D();
                    const ux = Math.cos(-0.6);
                    const uy = Math.sin(-0.6);
                    for (const st of streaks) {
                        const shift = ((life * st.sp * 0.8 + st.r) % 1) * rr * 0.4 - rr * 0.2;
                        const x0 = x + Math.cos(st.a) * rr * st.r + ux * shift;
                        const y0 = G + Math.sin(st.a) * rr * st.r + uy * shift;
                        const x1 = x0 + ux * rr * st.len;
                        const y1 = y0 + uy * rr * st.len;
                        if (Math.hypot(x0 - x, y0 - G) < rr * 0.7 && Math.hypot(x1 - x, y1 - G) < rr * 0.7 && y0 < G && y1 < G) {
                            addLine(path, px, s, [[x0, y0], [x1, y1]], 1);
                        }
                    }
                    ctx.globalAlpha = 0.45 * fade;
                    ctx.fillStyle = cols[1];
                    ctx.fill(path);
                }
                // 돌덩이 — 빛 앞에서 검게
                const rp = [new Path2D(), new Path2D(), new Path2D()];
                for (const r of rocks) {
                    if (life > r.t0) {
                        const k = ROCK.indexOf(r.col);
                        rp[k].rect(px(r.x - r.z / 2), px(r.y - r.z), r.z, r.z);
                        rp[k].rect(px(r.x - r.z / 2 + s), px(r.y - r.z - s), Math.max(s, r.z - 2 * s), s); // 위가 좁은 돌 모양
                    }
                }
                fillPaths(ctx, rp, [ROCK[0], ROCK[1], ROCK[2]], Math.min(1, fade * 1.5));
            } });
    }
    // 빛의 반구 그림 — 반지름 R, 하얀 심 · 하늘 · 파랑 테두리(도트 섞기로 부드럽게) · 바깥 빛 무리(반 · 4분의 1 도트로 반투명처럼).
    // 가장자리는 거의 매끈하게, 아주 잘게만 일렁. show(1 → 0)에 따라 색이 한 단계씩 어두워지다(하양 → 연하늘 → 하늘 → 파랑 → 짙은 파랑) 사라짐
    // (옛날 게임처럼 — 옅게 하면 하양이 회색으로 탁해짐)
    function domeLight(ctx, px, s, x, G, R, cols, T, show = 1) {
        if (R < s * 3 || show <= 0.01) {
            return;
        }
        const c = s * Math.max(1, Math.round(R / (70 * s))); // 아주 큰 반구는 칸을 키움 (가볍게)
        const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D()];
        const Rm = R * 1.15;
        for (let gy = Math.floor((G - Rm) / c) * c; gy < G; gy += c) {
            const dy = gy + c / 2 - G;
            const by = ((gy / c) & 3) * 4;
            for (let gx = Math.floor((x - Rm) / c) * c; gx < x + Rm; gx += c) {
                const dx = gx + c / 2 - x;
                const d = Math.hypot(dx, dy);
                if (d >= Rm) {
                    continue;
                }
                const a = Math.atan2(dy, dx);
                const edge = R * (1 + 0.012 * Math.sin(a * 31 + T * 24) + 0.01 * Math.sin(a * 17 - T * 17));
                const dith = BAYER[by + ((gx / c) & 3)] / 16;
                const f = d / edge + (dith - 0.5) * 0.06;
                let k = -1;
                if (f < 0.7 + 0.03 * Math.sin(T * 14)) {
                    k = 5; // 하얀 심
                } else if (f < 0.85) {
                    k = 4;
                } else if (f < 0.95) {
                    k = 3;
                } else if (f < 1) {
                    k = 2; // 테두리
                } else if (f < 1.06) {
                    k = (((gx + gy) / c) & 1) === 0 ? 1 : -1; // 빛 무리 — 반만
                } else if (f < 1.13 && dith < 0.25) {
                    k = 0; // 바깥 빛 무리 — 4분의 1만
                }
                if (k >= 0) {
                    paths[k].rect(px(gx), px(gy), c, c);
                }
            }
        }
        const pal = [cols[3], cols[2], cols[1], cols[0], '#ffffff']; // 어두운 → 밝은
        const step = Math.floor((1 - show) * 5.99); // 사라지는 단계
        [[2, 0.6], [2, 0.9], [1, 1], [2, 1], [3, 1], [4, 1]].forEach(([base, a], k) => {
            const i = base - step;
            if (i >= 0) {
                ctx.globalAlpha = a;
                ctx.fillStyle = pal[i];
                ctx.fill(paths[k]);
            }
        });
    }
    // 불씨 — 작은 불 점들이 튀어 날아감 (한꺼번에 n 개)
    function fireBits(x, y, s, cols, n, o = {}) {
        n = Math.min(Math.round(n), Math.max(0, LIVE_MAX - moveParticles.length));
        for (let i = 0; i < n; i++) {
            const a = (o.angle ?? -Math.PI / 2) + rnd(-0.5, 0.5) * (o.spread ?? TAU);
            const sp = (o.speed ?? 100) * rnd(0.35, 1);
            sigParticle({ x: x + rnd(-1, 1) * (o.rx ?? 0), y: y + rnd(-1, 1) * (o.ry ?? 0), s, vx: Math.cos(a) * sp + (o.vx ?? 0), vy: Math.sin(a) * sp + (o.vy ?? 0), g: o.g ?? 0, drag: o.drag ?? 2, max: rnd(0.5, 1) * (o.life ?? 0.8), color: pick(cols), size: pick([1, 1, 2]), draw: DRAW.dot });
        }
    }
    // 불똥이 피어오름 (t0 부터 끝까지)
    function emberRise(sc, t0, sec, cols) {
        const { W, H, S: s, ground: G } = sc.u;
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const k = sc.t - t0;
            if (k <= 0) {
                return;
            }
            const a = clamp(k / 0.3, 0, 1) * clamp((sec - sc.t) / 0.4, 0, 1);
            const paths = [new Path2D(), new Path2D()];
            const m = Math.round(36 * clamp(W / 480, 0.6, 2));
            for (let j = 0; j < m; j++) {
                const y = wrap(G - hash(j, 2) * G - k * H * (0.3 + hash(j, 3) * 0.4), G + 10, -10);
                paths[j % 3 === 0 ? 1 : 0].rect(px(hash(j, 1) * W + Math.sin(k * 3 + j) * s * 3), px(y), s, s);
            }
            fillPaths(ctx, paths, [cols[2], cols[0]], 0.8 * a);
        } });
    }

    // 플레어드라이브 — 몸을 웅크려 불꽃을 모으고 땅을 차고 하늘 높이 솟음(날갯짓하듯 몸이 들썩 · 바람 고리 · 불비 같은 불꽃 꼬리)
    // → 꼭대기에서 동그란 불꽃 구에 감싸임(둘레로 불씨 세 줄이 빙글빙글) → 2초 동안 기를 모으듯 둘레의 불꽃 줄기 · 불씨가 소용돌이치며 빨려 듦
    // (점점 빨라짐, 네 번 두근하며 구가 커짐) → 점화하듯 확 — 하늘에서 불꽃 유성이 하나씩 천천히 쏟아지기 시작 (용성군처럼)
    // → 불꽃 구째로 굵은 혜성 꼬리를 끌며 대각선으로 급강하 → 내리꽂히는 순간 대폭발(firePillar): 퍼지는 불꽃 구 · 뻗는 불꽃 줄기 · 불덩이 파편
    // · 차례로 터지는 작은 폭발 · 화면 꼭대기까지 일자로 넓은 불기둥
    // · 불길 띠가 땅을 따라 양옆으로 번짐(닿은 애 떠오름) → 불기둥 속에서 솟아올라 날갯짓하며 제자리로 → 불똥이 피어오름
    // 나는 동안은 진짜 그림을 숨기고 캔버스에 꼭두각시로 (같은 자리에 내려와서 다시 보임)
    function runFlareDrive(u, o, ms, pokemon) {
        const cols = sigPal(o.c || 'fire');
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const img = pokemon.el;
        const me = monBox(pokemon);
        const edge = Math.max(1, Math.round(u.s * 0.75));
        const D = Math.min(Math.max(H / 3, short(u) * 0.4) * (0.9 + 0.2 * P), W * 0.42, H * 0.62);
        // 노리는 곳 — 가장 가까운 애, 없으면 앞쪽
        const q = nearest(u);
        const tx = q ? clamp(q.x, W * 0.1, W * 0.9) : clamp(me.x + dir * W * 0.4, W * 0.15, W * 0.85);
        const fd = Math.sign(tx - me.x) || dir; // 날아갈 쪽
        // 때 — 땅을 참 · 꼭대기 · (기 모으기) · 점화 · 급강하 · 내리꽂힘(대폭발) · 솟아오름 · 돌아옴 · 착지
        const T0 = 0.45;
        const T1 = 1.15;
        const TG = T1 + 2.0; // 기 모으기 끝 · 점화
        const T2 = TG + 0.25;
        const TI = T2 + 0.4;
        const TU = TI + 0.55;
        const TH = TU + 0.6;
        const TL = TH + 0.7;
        const pulses = [T1 + 0.55, T1 + 1.05, T1 + 1.45, T1 + 1.8];
        // 꼭대기 — 불꽃이 화면 밖으로 잘리지 않게 (위 · 양옆에 여유)
        const marg = Math.max(me.w * 1.4, short(u) * 0.16);
        const topB = Math.max(me.h * 2 + marg * 0.5 + 4, H * 0.25 + me.h * 0.5);
        const ax = clamp(me.x + fd * W * 0.05, marg + 4, W - marg - 4);
        const vxN = (tx - ax) / (Math.hypot(tx - ax, G - topB) || 1);
        const vyN = (G - topB) / (Math.hypot(tx - ax, G - topB) || 1);
        const diveRot = fd * 0.6 * Math.atan2(G - topB, Math.abs(tx - ax) || 1); // 머리부터 — 그림이 너무 눕지 않게 반쯤만
        const upB = G - H * 0.25;
        const Ro = Math.max(me.w, me.h) * 0.95; // 불꽃 구 반지름
        // 날갯짓 — 0.28초마다 몸이 들썩 (아래로 바람 고리)
        const BEAT = 0.28;
        const flapBob = (t) => -Math.abs(Math.sin((t / BEAT) * Math.PI)) * s * 3;
        const flying = (t) => (t > T0 && t < T2) || (t > TU && t < TL);
        // 꼭두각시 [x, 발 높이, 기울기]
        const pup = (t) => {
            if (t < T0) {
                return [me.x, me.b, 0];
            }
            if (t < T1) {
                const e = easeOut((t - T0) / (T1 - T0));
                return [lerp(me.x, ax, e), lerp(me.b, topB, e) + flapBob(t), -fd * 0.2 * (1 - e)];
            }
            if (t < T2) {
                return [ax, topB + flapBob(t), 0];
            }
            if (t < TI) {
                const e = ((t - T2) / (TI - T2)) ** 2;
                return [lerp(ax, tx, e), lerp(topB, G, e), diveRot];
            }
            if (t < TU) {
                return [tx, G, diveRot];
            }
            if (t < TH) {
                const e = easeOut((t - TU) / (TH - TU));
                return [tx, lerp(G, upB, e) + flapBob(t), lerp(diveRot, 0, e)];
            }
            const k = clamp((t - TH) / (TL - TH), 0, 1);
            const e = k * k * (3 - 2 * k);
            return [lerp(tx, me.x, e), lerp(upB, me.b, e) - Math.sin(k * Math.PI) * H * 0.12 + flapBob(t) * (1 - k), 0];
        };
        const center = (t) => {
            const [x, b] = pup(t);
            return [x, b - me.h * 0.5];
        };
        // 불꽃에 휩싸인 세기 — 꼭대기에서 휩싸이고, 솟아오르며 식음
        const fireAt = (t) => (t < T1 ? 0 : t < T1 + 0.3 ? (t - T1) / 0.3 : t < TU ? 1 : t < TH ? 1 - (t - TU) / (TH - TU) : 0);
        // 불꽃 구 크기 — 꼭대기에서 커지고(두근두근), 불기둥 속에선 없다가, 솟아오를 때 작게 남아 사그라듦
        const orbAt = (t) => {
            if (t < T1 || t >= TH || (t >= TI && t < TU)) {
                return 0;
            }
            if (t >= TU) {
                return 0.75 * (1 - (t - TU) / (TH - TU));
            }
            const beat = pulses.reduce((m, tp) => Math.max(m, clamp(1 - Math.abs(t - tp) / 0.1, 0, 1)), 0);
            const fire = clamp((t - TG) / 0.08, 0, 1) * clamp(1 - (t - TG - 0.08) / 0.25, 0, 1); // 점화 때 확
            return easeOut(clamp((t - T1) / 0.3, 0, 1)) * (0.6 + 0.4 * clamp((t - T1) / (TG - T1), 0, 1)) * (1 + 0.15 * beat + 0.3 * fire);
        };
        const sc = scene(u, sec + 0.3, 'ultdive');
        ultDark(0.25, ms - 200);
        emberRise(sc, TI, sec, cols);
        try {
            pokemon.el.style.filter = fireLine(u.s);
        } catch (err) {
            fail('fire', err);
        }

        // ① 모으기 — 발밑에 작은 불꽃 혀가 타오르고 몸을 웅크림 → 땅을 차고 솟음
        sc.add({ max: T0 + 0.1, draw: (ctx, it, t, px) => {
            flameTongue(ctx, px, s, me.x, me.b, me.w * 1.1, me.h * (0.8 + 1.2 * (it.life / T0)), cols, it.life, clamp(it.life / 0.15, 0, 1) * (1 - clamp((it.life - T0) / 0.1, 0, 1)));
        } });
        sc.at(0.05, () => recoil(pokemon, [{ translate: '0 0' }, { translate: `0 ${u.s * 3}px` }], 400));
        sc.at(T0, () => {
            hideMon(pokemon, true);
            ultShake(3, 220);
            ring(sc, me.x, me.b - s, me.w * 0.5, me.w * 3, 0.2, 0.4, [cols[1], '#ffffff'], 2);
            debris(me.x, me.b - s, s, cols, 24, H * 0.6, { ground: G, angle: -Math.PI / 2, spread: 2.2 });
        });
        hideUntil(pokemon, ms + 100);
        // 날갯짓 바람 — 들썩일 때마다 몸 아래로 납작한 바람 고리
        let lastBeat = -1;
        sc.tick((t) => {
            if (flying(t) && t - lastBeat >= BEAT) {
                lastBeat = t;
                const [x, b] = pup(t);
                ring(sc, x, b + s * 2, me.w * 0.4, me.w * 1.8, 0.3, 0.3, ['#ffffff', '#ffe2b0'], 1);
            }
        });
        // 꼬리 · 불꽃 구 · 도는 불씨 · 꼭두각시 (한 덩어리 — 폭발이 생기면 그 위에 다시 그림)
        const drawFlyer = (ctx, it, t, px) => {
            const life = sc.t;
            if (life < T0 || life >= TL) {
                return;
            }
            const [x, b, rot] = pup(life);
            const [cx, cy] = center(life);
            // 불비 같은 꼬리 — 솟을 땐 아래로 가늘게, 내리꽂을 땐 뒤로 굵고 길게
            if (life < T1) {
                fireTail(ctx, px, s, cx, cy + me.h * 0.1, 0, -1, me.h * 2.6 * clamp((life - T0) / 0.2, 0, 1), me.w * 0.8, cols, life, 0.95);
            } else if (life >= T2 && life < TI) {
                fireTail(ctx, px, s, cx, cy, vxN, vyN, marg * 3.6, Ro * 1.7, cols, life, 1);
            }
            const fire = fireAt(life);
            const orb = orbAt(life);
            if (orb > 0.01) {
                // 동그란 불꽃 구 — 리자몽이 그 안에 · 둘레로 불씨 세 줄이 빙글빙글 (내리꽂을 때까지)
                fireOrb(ctx, px, s, cx, cy, Ro, cols, life, orb, G, 0.95);
                if (life < TI) {
                    orbitEmbers(ctx, px, s, cx, cy, Ro * orb * 1.3, cols, life, fd, clamp((life - T1 - 0.2) / 0.2, 0, 1));
                }
            }
            drawLitMon(ctx, img, x, b, me.w, fd < 0, '#ffc93c', edge, 1, rot);
            // 달아오름 — 하얀 · 노란 실루엣이 두근두근
            if (fire > 0.01) {
                drawMon(ctx, img, x, b, me.w, fd < 0, fire * (0.2 + 0.15 * Math.sin(life * 18)), cols[0], rot);
            }
        };
        sc.add({ max: TI, draw: drawFlyer });
        // 불씨 — 휩싸인 동안 몸에서 튀어 오름
        let bits = 0;
        sc.tick((t, dt) => {
            const f = fireAt(t);
            if (f <= 0 || t > TU) {
                bits = 0;
                return;
            }
            bits += dt * 50 * f;
            const [cx, cy] = center(t);
            while (bits >= 1) {
                bits -= 1;
                fireBits(cx, cy - Ro * 0.9, s, cols, 1, { angle: -Math.PI / 2, spread: 1, speed: H * 0.4, drag: 1.6, life: 0.6, rx: Ro * 0.6 });
            }
        });
        // 기 모으기 — 꼭대기에서 2초 동안 둘레의 불꽃 줄기 · 불씨가 소용돌이치며 불꽃 구로 빨려 듦, 점점 빨라짐
        const pullR = Math.max(Ro * 3.5, D * 1.1);
        chargeSwirl(sc, center, T1 + 0.1, TG, pullR, Ro, cols, fd);
        // 점화 — 다 모으면 확 (번쩍 · 고리 · 불씨)
        sc.at(TG, () => {
            const [cx, cy] = center(TG);
            screenFlash(s, 0.3, cols[1], 0.15);
            ultShake(4, 260);
            ring(sc, cx, cy, Ro, marg * 2.8, 1, 0.45, ['#ffffff', cols[1], cols[2]], 2);
            fireBits(cx, cy, s, cols, 60, { spread: TAU, speed: H * 0.7, drag: 2.4, life: 0.7, rx: Ro * 0.6, ry: Ro * 0.6 });
        });
        for (const tp of pulses) {
            sc.at(tp, () => {
                const [cx, cy] = center(tp);
                ring(sc, cx, cy, marg * 1.6, Ro * 1.1, 1, 0.3, [cols[1], '#ffffff', cols[3]], 2);
                ultShake(1.5, 150);
            });
        }
        sc.at(T2, () => {
            ultShake(3, 250);
            const [cx, cy] = center(T2);
            ring(sc, cx, cy, me.w * 0.5, marg * 1.6, 0.8, 0.35, ['#ffffff', cols[1]], 2);
        });
        // 불꽃 유성 — 점화 무렵부터 하늘(화면 위 밖)에서 하나씩 천천히(1 ~ 1.3초) 비슷한 방향으로 쏟아져 리자몽이 떨어질 곳 둘레에 펑펑 (용성군처럼)
        // 떨어질 자리는 화면의 80% 너비를 유성 수만큼 칸으로 나눠 한 칸에 하나씩 (리자몽이 끝에 있어도 한 줄로 겹치지 않게),
        // 차례는 칸을 건너뛰며 섞고, 날아오는 각도도 ±0.15 쯤 달리 (나란히 겹쳐 보이지 않게).
        // 리자몽이 떨어질 자리 근처 칸은 리자몽이 내리꽂힌 뒤에 출발 (혜성 꼬리 옆에 나란히 붙어 날지 않게)
        const nMet = clamp(Math.round(W / 90), 6, 12);
        const span = W * 0.8;
        const left0 = clamp(tx - span / 2, W * 0.05, W * 0.95 - span);
        let stride = Math.max(2, Math.round(nMet * 0.4));
        const gcd = (a, b) => (b ? gcd(b, a % b) : a);
        while (gcd(stride, nMet) !== 1) {
            stride++;
        }
        const base = Math.atan2(vyN, vxN);
        const mets = [];
        for (let i = 0; i < nMet; i++) {
            const slot = (i * stride) % nMet;
            const lx = left0 + ((slot + 0.5 + (hash(i, 31) - 0.5) * 0.5) / nMet) * span;
            const an = base + (hash(i, 35) - 0.5) * 0.3;
            const ux = Math.cos(an);
            const uy = Math.max(0.3, Math.sin(an));
            const len = (G + 30) / uy;
            const t0 = Math.abs(lx - tx) < span * 0.18 ? TI + 0.1 + 0.3 * hash(i, 36) : TG - 0.3 + (i / nMet) * 1.15 + (hash(i, 32) - 0.5) * 0.08;
            mets.push({ lx, t0, land: t0 + 1 + 0.3 * hash(i, 33), r: Math.max(s * 3, me.w * (0.26 + 0.14 * hash(i, 34))), ux, uy, sx: lx - ux * len, sy: G - uy * len });
        }
        const metAt = (m, t) => {
            const k = clamp((t - m.t0) / (m.land - m.t0), 0, 1);
            const e = 0.7 * k + 0.3 * k * k;
            return [lerp(m.sx, m.lx, e), lerp(m.sy, G - m.r * 0.5, e)];
        };
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            for (const m of mets) {
                if (life >= m.t0 && life < m.land) {
                    const [x, y] = metAt(m, life);
                    fireTail(ctx, px, s, x, y, m.ux, m.uy, m.r * 7, m.r * 2.2, cols, life + m.r, 1);
                }
                // 떨어진 자리 — 작은 화톳불이 잠깐
                const k = (life - m.land) / 0.6;
                if (k >= 0 && k < 1) {
                    flameTongue(ctx, px, s, m.lx, G, m.r * 2.4, m.r * 5 * Math.sin(Math.min(1, k * 2.5) * Math.PI * 0.5) * (1 - k), cols, life + m.lx, 1 - k);
                }
            }
        } });
        let metBits = 0;
        sc.tick((t, dt) => {
            metBits += dt * 30;
            while (metBits >= 1) {
                metBits -= 1;
                for (const m of mets) {
                    if (t > m.t0 && t < m.land) {
                        const [x, y] = metAt(m, t);
                        fireBits(x, y, s, cols, 1, { angle: Math.atan2(-m.uy, -m.ux), spread: 0.9, speed: H * 0.3, drag: 2.4, life: 0.5, rx: m.r * 0.5, ry: m.r * 0.5 });
                    }
                }
            }
        });
        for (const m of mets) {
            sc.at(m.land, () => {
                fireBits(m.lx, G - m.r, s, cols, 18, { angle: -Math.PI / 2, spread: Math.PI, speed: H * 0.7, drag: 2.2, life: 0.6 });
                ring(sc, m.lx, G - s, m.r, m.r * 4, 0.2, 0.35, [cols[1], '#ffffff'], 2);
                ultShake(2.5, 150);
                for (const r of u.others()) {
                    if (Math.abs(r.x - m.lx) < m.r * 3 + r.w * 0.5) {
                        hit(r, Math.sign(r.x - m.lx) || fd, 'lift');
                    }
                }
            });
        }
        // ② 내리꽂힘 — 닿는 순간 대폭발: 동그란 불꽃이 확 퍼지고 불기둥이 화면 꼭대기까지 · 불길 띠가 땅을 따라 양옆으로
        const spread = W * 0.75; // 땅 불길이 번지는 빠르기 (px/초)
        const fireEnd = TL + 0.7;
        sc.at(TI, () => {
            screenFlash(s, 0.55, cols[0], 0.3);
            ultShake(9, 650);
            firePillar(sc, tx, G, Math.max(me.w * 2.4, D * 0.8), 1.9, cols);
            ring(sc, tx, G - H * 0.2, D * 0.3, Math.max(W, H) * 0.7, 0.7, 0.55, ['#ffffff', cols[1], cols[2]], 3);
            ring(sc, tx, G - s, D * 0.4, D * 3, 0.18, 0.5, [cols[1], '#ffffff'], 2);
            debris(tx, G - H * 0.1, s, cols, 40, H * 1.2, { ground: G, size: [1, 2, 2] });
            fireBits(tx, G - s, s, cols, 60, { angle: -Math.PI / 2, spread: Math.PI * 1.3, speed: H * 1.1, drag: 2, life: 0.9 });
            sc.add({ max: sec, draw: drawFlyer });
        });
        // 땅 불길 띠 — 폭발 자리에서 양옆으로 번지며 타오르다 사그라듦 (불길에 닿은 애 떠오름)
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TI || life > fireEnd) {
                return;
            }
            const k = life - TI;
            const reach = spread * k;
            const fade = clamp((fireEnd - life) / 0.6, 0, 1);
            groundFlames(ctx, px, s, clamp(tx - reach, 0, W), clamp(tx + reach, 0, W), G, Math.max(6 * s, H * 0.12) * clamp(k / 0.2, 0, 1), life, cols, 0.92 * fade);
        } });
        sc.tick((t) => {
            if (t < TI || t > fireEnd - 0.4) {
                return;
            }
            const reach = spread * (t - TI);
            for (const r of u.others()) {
                if (Math.abs(r.x - tx) < reach) {
                    hit(r, Math.sign(r.x - tx) || fd, 'lift');
                }
            }
        });
        // ③ 불기둥 속에서 솟아오름 → 날갯짓하며 돌아와 착지 (진짜가 다시 보임)
        sc.at(TU, () => {
            ultShake(3, 220);
            ring(sc, tx, G - me.h * 0.5, me.w * 0.5, marg * 1.8, 0.8, 0.35, ['#ffffff', cols[1], cols[2]], 2);
            fireBits(tx, G - me.h * 0.5, s, cols, 30, { angle: -Math.PI / 2, spread: Math.PI * 1.2, speed: H * 0.6, drag: 2.2, life: 0.7 });
        });
        sc.at(TL, () => {
            hideMon(pokemon, false);
            ultShake(3, 200);
            ring(sc, me.x, me.b - s, me.w * 0.4, me.w * 3, 0.2, 0.4, [cols[1], '#ffffff'], 2);
            debris(me.x, me.b - s, s, cols, 14, H * 0.5, { ground: G, angle: -Math.PI / 2, spread: 2.2 });
        });
    }

    // 블래스트번 (메가리자몽 X) — 리자몽이 살짝 떠올라 동그란 불꽃 구에 감싸이고 1.5초 동안 기를 모음(불꽃 줄기 · 불씨가 소용돌이치며 빨려 듦)
    // → 진화 모션: 하얀 실루엣이 리자몽 ↔ 메가리자몽X 로 점점 빠르게 바뀌고 둘레로 빛줄기가 돎 → 하얗게 펑! 메가리자몽X
    // (진짜 그림은 숨기고 같은 폴더의 megax 그림 — add-form.py · PMD SpriteCollab) → 파란 불꽃 구 안에서 파란 기를 1.6초 더 모음(점점 빨라짐 · 두근두근)
    // → 화면이 하얗게 번쩍! → 땅에서 거대한 파란 빛의 반구 대폭발(blastDome — 베지터 자폭처럼) · 화면 끝까지 번지는 파란 땅 불길(닿은 애 날아감)
    // → 터지는 동안은 안 보이다가 빛이 사그라들 때 메가리자몽X 가 땅에 선 채로 나타남 → 하얀 실루엣이 깜빡이며 원래 모습으로
    const BLUE = ['#eaf6ff', '#8fd8ff', '#3fa2ff', '#1b4fd1']; // 파란 불꽃 (하양 → 하늘 → 파랑 → 짙은 파랑)
    const GLOW = ['#dfe9ff', '#a9c2ff', '#7d97e6', '#4f63b8']; // 진화 빛 (하얀 실루엣이 잘 보이게 푸른빛으로 은은하게)
    function runBlastBurn(u, o, ms, pokemon) {
        const cols = sigPal(o.c || 'fire');
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const img = pokemon.el;
        const me = monBox(pokemon);
        const edge = Math.max(1, Math.round(u.s * 0.75));
        const D = Math.min(Math.max(H / 3, short(u) * 0.4) * (0.9 + 0.2 * P), W * 0.42, H * 0.62);
        const left = dir < 0;
        // 메가 그림 — 같은 폴더의 megax_idle (정면). 도트 크기는 원래 그림과 같게 (u.s 배)
        const mega = new Image();
        mega.src = (img.src || '').replace(/[^/]+\.gif(\?.*)?$/, 'megax_idle_8fps.gif');
        const megaW = () => (mega.naturalWidth || 64) * u.s;
        const megaReady = () => mega.complete && mega.naturalWidth > 0;
        // 때 — 떠오름 · (불꽃 기 모으기) · 진화 모션 · 펑(메가) · (파란 기 모으기) · 번쩍 · 대폭발 · 다시 나타남 · 원래대로
        const TL0 = 0.4;
        const TE = 1.75;
        const TM = 3.0;
        const TF = 4.6;
        const TX = TF + 0.12;
        const DOME = 2.5; // 반구 대폭발 길이
        const TR2 = TX + DOME - 0.25; // 빛이 사그라들 때 메가리자몽X 가 다시 보임
        const TBack = sec - 0.5;
        const firePulses = [0.8, 1.25, 1.6];
        const bluePulses = [TM + 0.6, TM + 1.0, TM + 1.3, TM + 1.5];
        const Ro = Math.max(me.w, me.h) * 0.95; // 리자몽 불꽃 구
        const RoM = megaW() * 0.75; // 메가 파란 불꽃 구
        const lift = Math.max(s * 4, Math.max(Ro, RoM) * 1.1 - me.h * 0.5 + s * 2); // 구가 땅에 묻히지 않게 떠오름
        const pullR = Math.max(Ro * 3.5, D * 1.1);
        const R = Math.min(Math.max(D * 1.7, megaW() * 2.5), W * 0.6, G * 0.95); // 반구 반지름
        const ex = me.x;
        // 떠 있는 발 높이 — 날갯짓하듯 살짝 들썩
        const bob = (t) => -Math.abs(Math.sin((t / 0.3) * Math.PI)) * s * 2;
        const footAt = (t) => {
            if (t < TL0) {
                return lerp(me.b, me.b - lift, easeOut(t / TL0));
            }
            if (t < TX) {
                return me.b - lift + bob(t);
            }
            return me.b; // 터진 뒤엔 땅에 선 채로
        };
        const isMega = (t) => t >= TM;
        const center = (t) => [ex, footAt(t) - (isMega(t) ? megaW() : me.h) * 0.5];
        const beatAt = (t, list) => list.reduce((m, tp) => Math.max(m, clamp(1 - Math.abs(t - tp) / 0.1, 0, 1)), 0);
        const sc = scene(u, sec + 0.3, 'ultpillar');
        ultDark(0.3, ms - 200);
        emberRise(sc, TX, sec, BLUE);
        hideMon(pokemon, true);
        hideUntil(pokemon, ms + 100);

        // 구 · 도는 불씨 · 꼭두각시 (한 덩어리 — 대폭발이 생기면 그 위에 다시 그림)
        const drawMon2 = (ctx, it, t, px) => {
            const life = sc.t;
            if (life >= TBack || (life >= TX && life < TR2)) {
                return; // 터지는 동안은 안 보임
            }
            const [cx, cy] = center(life);
            const b = footAt(life);
            if (life < TE + 0.25) {
                // 리자몽 — 불꽃 구가 커지며 두근두근, 둘레로 불씨 세 줄
                const k = easeOut(clamp((life - 0.1) / 0.3, 0, 1)) * (0.6 + 0.4 * clamp((life - 0.25) / 1.5, 0, 1)) * (1 + 0.15 * beatAt(life, firePulses)) * (1 - clamp((life - TE) / 0.25, 0, 1));
                fireOrb(ctx, px, s, cx, cy, Ro, cols, life, k, G, 0.95);
                orbitEmbers(ctx, px, s, cx, cy, Ro * k * 1.3, cols, life, dir, clamp((life - 0.3) / 0.2, 0, 1) * (1 - clamp((life - TE) / 0.15, 0, 1)));
            }
            if (life < TE) {
                drawLitMon(ctx, img, ex, b, me.w, left, '#ffc93c', edge, 1);
                drawMon(ctx, img, ex, b, me.w, left, clamp((life - 0.3) / 0.5, 0, 1) * (0.2 + 0.12 * Math.sin(life * 18)), cols[0]);
                return;
            }
            if (life < TM) {
                // 진화 모션 — 하얀 빛 구 · 도는 빛줄기 · 하얀 실루엣이 리자몽 ↔ 메가로 점점 빠르게
                const k = (life - TE) / (TM - TE);
                const ramp = clamp(k / 0.15, 0, 1);
                const paths = [new Path2D(), new Path2D()];
                for (let i = 0; i < 12; i++) {
                    const a = (i / 12) * TAU + life * 0.9 * dir;
                    const L = pullR * (0.55 + 0.35 * Math.sin(life * 6 + i * 1.7)) * ramp;
                    addLine(paths[i % 2], px, s, [[cx + Math.cos(a) * Ro * 0.9, cy + Math.sin(a) * Ro * 0.9], [cx + Math.cos(a) * L, cy + Math.sin(a) * L]], i % 2 ? 1 : 2);
                }
                fillPaths(ctx, paths, ['#ffffff', '#ffe9a0'], 0.8 * ramp);
                fireOrb(ctx, px, s, cx, cy, Ro, GLOW, life, (0.6 + 0.5 * k) * ramp, G, 0.6);
                const flips = (life - TE) * (3 + 8.5 * k); // 점점 빨라짐 (초당 3번 → 20번)
                const showMega = megaReady() && (k > 0.9 || Math.floor(flips) % 2 === 1);
                const im = showMega ? mega : img;
                // 바뀔 때마다 부풀었다 줄어듦 (원작 진화처럼) — 발 대신 가운데를 기준으로
                const swell = 1.1 + (k > 0.9 ? 0.15 : 0.3 * Math.sin((flips % 1) * Math.PI));
                const w = (showMega ? megaW() : me.w) * swell;
                const fb = cy + (showMega ? megaW() : me.h) * swell * 0.5;
                const lf = showMega ? false : left;
                drawLitMon(ctx, im, ex, fb, w, lf, showMega ? BLUE[1] : '#ffe08a', edge * 2, 1);
                drawMon(ctx, im, ex, fb, w, lf, 1, '#ffffff');
                return;
            }
            if (!megaReady()) {
                return;
            }
            // 메가리자몽X — 파란 기 모으기 동안 파란 불꽃 구, 번쩍 때 확 커졌다 대폭발에 섞여 사라짐
            const w = megaW();
            if (life < TX) {
                const flash = clamp((life - TF) / 0.08, 0, 1);
                const k = (0.7 + 0.5 * clamp((life - TM) / (TF - TM), 0, 1)) * (1 + 0.15 * beatAt(life, bluePulses)) * (1 + 0.4 * flash) * easeOut(clamp((life - TM) / 0.25, 0, 1));
                fireOrb(ctx, px, s, cx, cy, RoM, BLUE, life, k, G, 0.95);
                orbitEmbers(ctx, px, s, cx, cy, RoM * k * 1.3, BLUE, life, -dir, clamp((life - TM - 0.2) / 0.2, 0, 1));
            }
            drawLitMon(ctx, mega, ex, b, w, false, BLUE[2], edge, 1);
            // 하얗게 — 나타날 때(메가진화 · 빛 속에서 다시), 그리고 원래대로 돌아가기 직전엔 메가 ↔ 리자몽 실루엣이 빠르게 깜빡
            const appear = clamp(1 - (life - (life >= TR2 ? TR2 : TM)) / 0.35, 0, 1);
            if (appear > 0) {
                drawMon(ctx, mega, ex, b, w, false, appear, '#ffffff');
            }
            if (life > TBack - 0.4) {
                const back = Math.floor((life - TBack + 0.4) / 0.06) % 2 === 1;
                drawMon(ctx, back ? img : mega, ex, b, back ? me.w : w, back ? left : false, 1, '#ffffff');
            }
        };
        sc.add({ max: TX, draw: drawMon2 });

        // ① 떠오르며 불꽃 구 · 불꽃 기 모으기
        sc.at(0.05, () => {
            ring(sc, ex, me.b - s, me.w * 0.5, me.w * 3, 0.2, 0.4, [cols[1], '#ffffff'], 2);
            fireBits(ex, me.b - s, s, cols, 20, { angle: -Math.PI / 2, spread: 2, speed: H * 0.5, drag: 2.4, life: 0.6 });
        });
        chargeSwirl(sc, center, 0.25, TE, pullR, Ro, cols, dir);
        for (const tp of firePulses) {
            sc.at(tp, () => {
                const [cx, cy] = center(tp);
                ring(sc, cx, cy, pullR * 0.6, Ro * 1.1, 1, 0.3, [cols[1], '#ffffff', cols[3]], 2);
                ultShake(1.5, 150);
            });
        }
        // ② 진화 모션 — 시작할 때 하얀 고리, 반짝이가 피어오름
        sc.at(TE, () => {
            const [cx, cy] = center(TE);
            screenFlash(s, 0.25, '#ffffff', 0.15);
            ring(sc, cx, cy, Ro * 0.5, pullR, 1, 0.45, ['#ffffff', '#fff2b0'], 2);
        });
        let glint = 0;
        sc.tick((t, dt) => {
            if (t < TE || t > TM) {
                return;
            }
            glint += dt * 14;
            while (glint >= 1) {
                glint -= 1;
                const [cx, cy] = center(t);
                sparkles(cx, cy, s, ['#ffffff', '#fff2b0', BLUE[1]], 1, Ro * 1.6, H * 0.15);
            }
        });
        // ③ 펑 — 메가리자몽X (하얀 번쩍 · 큰 고리 · 파란 불씨)
        sc.at(TM, () => {
            const [cx, cy] = center(TM);
            screenFlash(s, 0.6, '#ffffff', 0.3);
            ultShake(6, 450);
            ring(sc, cx, cy, Ro * 0.5, Math.max(W, H) * 0.6, 1, 0.5, ['#ffffff', BLUE[1], BLUE[2]], 3);
            fireBits(cx, cy, s, BLUE, 60, { spread: TAU, speed: H * 0.9, drag: 2.4, life: 0.8, rx: RoM * 0.5, ry: RoM * 0.5 });
            sparkles(cx, cy, s, ['#ffffff', BLUE[1]], 16, RoM * 1.5, H * 0.2);
        });
        // ④ 파란 기 모으기 → 번쩍!
        chargeSwirl(sc, center, TM + 0.15, TF, pullR * 1.15, RoM, BLUE, -dir);
        for (const tp of bluePulses) {
            sc.at(tp, () => {
                const [cx, cy] = center(tp);
                ring(sc, cx, cy, pullR * 0.7, RoM * 1.1, 1, 0.3, [BLUE[1], '#ffffff', BLUE[3]], 2);
                ultShake(1.5 + (tp - TM), 150);
            });
        }
        sc.at(TF, () => {
            screenFlash(s, 0.95, '#ffffff', 0.35);
            ultShake(5, 200);
        });
        // ⑤ 파란 반구 대폭발 · 돌 파편 · 먼지 · 충격파 · 화면 끝까지 번지는 파란 땅 불길
        const spread = W * 0.64;
        const fireEnd = TX + 2.75;
        sc.at(TX, () => {
            ultShake(10, 1000);
            blastDome(sc, ex, G, R, DOME, BLUE);
            ring(sc, ex, G - R * 0.4, R * 0.4, Math.max(W, H) * 0.9, 0.7, 0.6, ['#ffffff', BLUE[1], BLUE[2]], 3);
            ring(sc, ex, G - s, R * 0.5, Math.max(W, H), 0.16, 0.7, [BLUE[1], '#ffffff'], 2);
            ring(sc, ex, G - s, R * 0.4, R * 2.2, 0.12, 0.6, ['#c9b9a6', '#8a7660'], 2);
            debris(ex, G - s, s, ROCK, 50, H * 1.3, { ground: G, size: [2, 2, 3], angle: -Math.PI / 2, spread: 2.6 });
            fireBits(ex, G - R * 0.4, s, BLUE, 80, { spread: TAU, speed: H * 1.2, drag: 2.2, life: 0.9, rx: R * 0.4 });
            for (const r of u.others()) {
                if (Math.abs(r.x - ex) < R + r.w * 0.5) {
                    hit(r, Math.sign(r.x - ex) || dir, 'tumble');
                }
            }
        });
        sc.at(TX + 0.15, () => debris(ex, G - s, s, ROCK, 30, H * 1.0, { ground: G, size: [1, 2, 3], angle: -Math.PI / 2, spread: 2.8 }));
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TX || life > fireEnd) {
                return;
            }
            const k = life - TX;
            const reach = spread * k;
            const fade = clamp((fireEnd - life) / 0.6, 0, 1);
            groundFlames(ctx, px, s, clamp(ex - reach, 0, W), clamp(ex + reach, 0, W), G, Math.max(6 * s, H * 0.13) * clamp(k / 0.2, 0, 1), life, BLUE, 0.92 * fade);
        } });
        sc.tick((t) => {
            if (t < TX || t > fireEnd - 0.4) {
                return;
            }
            const reach = spread * (t - TX);
            for (const r of u.others()) {
                if (Math.abs(r.x - ex) < reach) {
                    hit(r, Math.sign(r.x - ex) || dir, 'tumble');
                }
            }
        });
        // ⑥ 빛이 사그라들 때 메가리자몽X 가 땅에 선 채로 다시 → 원래대로 (진짜 그림이 다시 보임)
        sc.at(TR2, () => {
            sc.add({ max: sec, draw: drawMon2 });
            ring(sc, ex, me.b - s, me.w * 0.5, me.w * 3, 0.2, 0.4, [BLUE[1], '#ffffff'], 2);
        });
        sc.at(TBack, () => {
            hideMon(pokemon, false);
            sparkles(ex, me.b - me.h * 0.5, s, ['#ffffff', BLUE[1], cols[1]], 16, me.w, H * 0.2);
            ring(sc, ex, me.b - me.h * 0.5, me.w * 0.4, me.w * 2.5, 0.8, 0.35, ['#ffffff', cols[1]], 2);
        });
    }

    // ═════ 이상해꽃 — venus: 솔라빔 (ultbeam 위에 덮어씀) · 하드플랜트 (ultpillar 위에 덮어씀) — 아래 Object.assign ═════
    const SUN = ['#ffffff', '#fff7c2', '#ffe066', '#9be05a']; // 햇빛 (하양 → 연노랑 → 금빛 → 연두 테두리)
    const PINK = ['#fff0f5', '#ffc2d6', '#ff8fb8', '#e0507e']; // 꽃잎 (연분홍 → 진분홍)
    // 광선 몸통 — (x0, y0)에서 (ux, uy) 쪽으로 len, 굵기 w. 겹친 색(바깥 cols[3] → 하얀 심), 가장자리 물결이 앞으로 흐르고
    // 굵어진 마디(에너지 고리)가 광선을 따라 달려감. 시작은 둥글게, maxY(땅) 아래는 안 그림. 거의 가로면 세로줄, 거의 세로면 가로줄로
    function beamBody(ctx, px, s, x0, y0, ux, uy, len, w, cols, T, alpha = 1, maxY = Infinity) {
        if (len < s || w < s || alpha <= 0.01) {
            return;
        }
        const colsMode = Math.abs(ux) >= Math.abs(uy);
        const d = Math.max(0.3, colsMode ? Math.abs(ux) : Math.abs(uy));
        const n = Math.ceil((len * d) / s);
        for (const [m, c, a] of [[1, cols[3], 0.75], [0.8, cols[2], 0.9], [0.58, cols[1], 1], [0.34, cols[0], 1]]) {
            ctx.globalAlpha = a * alpha;
            ctx.fillStyle = c;
            for (let j = 0; j <= n; j++) {
                const at = (j * s) / d;
                const wave = 1 + 0.07 * Math.sin((at / w) * 3 - T * 30 + m * 2) + 0.05 * Math.sin((at / w) * 7 + T * 19);
                const knot = 0.35 * Math.max(0, Math.sin((at / w) * 1.2 - T * 18)) ** 6;
                const cap = Math.sqrt(Math.min(1, at / (w * 0.5) + 0.25));
                const half = w * 0.5 * m * wave * (1 + knot) * cap;
                if (half < s * 0.5) {
                    continue;
                }
                const cx = x0 + ux * at;
                const cy = y0 + uy * at;
                const hh = half / d;
                if (colsMode) {
                    const top = cy - hh;
                    const bot = Math.min(cy + hh, maxY);
                    if (bot > top) {
                        ctx.fillRect(px(cx), px(top), s, Math.max(s, px(bot - top)));
                    }
                } else if (cy < maxY) {
                    ctx.fillRect(px(cx - hh), px(cy), Math.max(s, px(2 * hh)), s);
                }
            }
        }
        // 하얀 에너지 고리 — 광선을 가로지르는 밝은 띠가 앞으로 달려감
        ctx.globalAlpha = 0.75 * alpha;
        ctx.fillStyle = '#ffffff';
        const nRing = Math.max(2, Math.round(len / (w * 1.6)));
        for (let k = 0; k < nRing; k++) {
            const at = ((T * 2.5 + k / nRing) % 1) * len;
            if (at < w * 0.6) {
                continue;
            }
            const cx = x0 + ux * at;
            const cy = y0 + uy * at;
            const hh = (w * 0.62) / d;
            if (colsMode) {
                const top = cy - hh;
                const bot = Math.min(cy + hh, maxY);
                if (bot > top) {
                    ctx.fillRect(px(cx - s), px(top), 2 * s, Math.max(s, px(bot - top)));
                }
            } else if (cy < maxY) {
                ctx.fillRect(px(cx - hh), px(cy - s), Math.max(s, px(2 * hh)), 2 * s);
            }
        }
    }
    // 꽃잎 한 장 — 팔랑팔랑 (가로 · 세로로 번갈아 뒤집힘)
    function petalAt(path, px, s, x, y, z, flip) {
        if (flip) {
            path.rect(px(x - z), px(y), 2 * z, z);
            path.rect(px(x), px(y - z), z, z);
        } else {
            path.rect(px(x), px(y - z), z, 2 * z);
            path.rect(px(x - z), px(y), z, z);
        }
    }
    // 꽃잎이 흩날림 — 한꺼번에 n 장, 바람에 살랑이며 천천히 떨어짐
    function petalBurst(x, y, s, n, speed, o = {}) {
        n = Math.min(Math.round(n), Math.max(0, LIVE_MAX - moveParticles.length));
        for (let i = 0; i < n; i++) {
            const a = (o.angle ?? -Math.PI / 2) + rnd(-0.5, 0.5) * (o.spread ?? TAU);
            const sp = speed * rnd(0.3, 1);
            sigParticle({ x: x + rnd(-1, 1) * (o.r ?? 0), y: y + rnd(-1, 1) * (o.r ?? 0) * 0.6, s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: speed * 0.5, drag: 2.2, max: rnd(0.8, 1.4) * (o.life ?? 1.4), color: pick(PINK.slice(1)), ph: rnd(0, TAU), z: pick([1, 1, 2]),
                update: (p, dt) => {
                    p.vx += Math.sin(p.life * 6 + p.ph) * speed * 0.6 * (dt || 0.016);
                    p.vy = Math.min(p.vy, speed * 0.35); // 천천히 떨어짐
                },
                draw: (ctx, p, t, px) => {
                    ctx.globalAlpha = Math.min(1, (1 - t) * 3);
                    ctx.fillStyle = p.color;
                    const path = new Path2D();
                    petalAt(path, px, p.s, p.x, p.y, p.s * p.z, Math.sin(p.life * 10 + p.ph) > 0);
                    ctx.fill(path);
                } });
        }
    }

    // 솔라빔 — 등의 꽃이 활짝 → 2초 동안 하늘에서 햇빛 줄기가 내려오고 둘레의 빛 줄기 · 빛가루가 소용돌이치며 꽃으로 모여듦
    // (꽃잎이 꽃 둘레를 돌며 좁혀 들고, 꽃 위의 햇빛 구가 네 번 두근하며 커짐) → 번쩍! → 꽃 앞 빛 폭발과 함께 굵은 햇빛 광선이 땅과 나란히 화면 끝까지
    // (광선 아래가 땅 위에 오게 · 굵기는 이상해꽃 크기에 맞춰, 하얀 에너지 고리 · 마디가 달리고 꽃잎이 나선으로 감아 돎, 반동으로 몸이 밀리며 떨림)
    // · 가장 가까운 애 자리에서 빛 폭발(빛 덩이 · 빛나는 땅 · 도는 빛살 · 분수 같은 빛가루 · 충격파) → 광선이 가늘어지며 그 자리에 거대한 빛의 꽃이 피었다 꽃잎 폭풍.
    // 이상해꽃은 진짜 그림을 숨기고 광선 앞에 꼭두각시로 그림 (광선에 가려 안 보이지 않게), 꽃 위 햇빛 구만 그 위에
    function runSolarBeam(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const img = pokemon.el;
        const me = monBox(pokemon);
        const edge = Math.max(1, Math.round(u.s * 0.75));
        const left = dir < 0;
        const D = Math.min(Math.max(H / 3, short(u) * 0.4) * (0.9 + 0.2 * P), W * 0.42, H * 0.62);
        // 꽃 — 이상해꽃 그림(32칸)에서 꽃 가운데는 가로 한가운데 · 아래에서 61% 높이
        const mx = me.x + dir * me.w * 0.08;
        const my = me.b - me.h * 0.66;
        const Ro = Math.max(s * 6, me.w * 0.45); // 햇빛 구
        const bw = clamp(H * 0.12 * (0.9 + 0.2 * P), 12, Math.max(16, me.h * 1.3)); // 광선 굵기 — 이상해꽃 크기에 맞춰
        // 광선 — 땅과 나란히, 아래가 땅 위에 오는 높이로 꽃 앞에서 화면 끝까지
        const yb = Math.max(bw, Math.min(my, G - bw * 0.8));
        const bx = me.x + dir * me.w * 0.45; // 광선 시작 — 이상해꽃 앞쪽 (몸을 덮지 않게)
        const blen = (dir > 0 ? W - bx : bx) + bw;
        // 빛 폭발 자리 — 앞쪽에서 가장 가까운 애, 없으면 앞쪽 55%
        const q = nearest(u);
        const ahead = q && Math.sign(q.x - me.x) === dir && Math.abs(q.x - me.x) > me.w * 0.6;
        const ix = clamp(ahead ? q.x : me.x + dir * W * 0.55, W * 0.05, W * 0.95);
        // 때 — (기 모으기) · 번쩍 · 광선 · 다 닿음 · 가늘어짐 · 빛의 꽃 · 꽃잎 폭풍
        const TC0 = 0.25;
        const TF = 2.3;
        const TB = 2.42;
        const TH = TB + 0.14;
        const TN = TH + 1.9;
        const TBL = TN + 0.25;
        const TP = TBL + 0.6;
        const pulses = [0.95, 1.45, 1.85, 2.15];
        const pullR = Math.max(Ro * 4, D * 1.1);
        const sc = scene(u, sec + 0.3, 'ultbeam');
        ultDark(0.35, ms - 200);
        hideMon(pokemon, true);
        hideUntil(pokemon, ms + 100);
        const beatAt = (t) => pulses.reduce((m, tp) => Math.max(m, clamp(1 - Math.abs(t - tp) / 0.1, 0, 1)), 0);
        const reachAt = (t) => blen * easeOut(clamp((t - TB) / (TH - TB), 0, 1));
        const widthAt = (t) => {
            if (t < TB) {
                return 0;
            }
            const burst = 1 + 0.35 * clamp(1 - (t - TB) / 0.3, 0, 1); // 쏘는 순간 굵게
            const thin = t > TN ? Math.max(0, 1 - (t - TN) / 0.35) : 1;
            return bw * burst * thin * (1 + 0.04 * Math.sin(t * 40));
        };

        // ③ 광선 (이상해꽃 뒤) — 몸통 · 날아가는 머리 · 감아 도는 꽃잎 · 빛 폭발 자리
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const w = widthAt(life);
            if (w < s) {
                return;
            }
            const len = reachAt(life);
            beamBody(ctx, px, s, bx, yb, dir, 0, len, w, SUN, life, 1, G);
            if (life < TH + 0.05) {
                fireOrb(ctx, px, s, bx + dir * len, yb, w * 0.8, SUN, life, 1, G, 1, 0, [1, 0.8, 0.6, 0.38], 0.3); // 날아가는 광선 머리
            }
            const pp = new Path2D();
            for (let i = 0; i < 16; i++) {
                const f = (life * 1.4 + i / 16) % 1;
                const ph = life * 12 * dir + i * 0.9;
                const y = yb + Math.sin(ph) * w * 0.8;
                if (y < G) {
                    petalAt(pp, px, s, bx + dir * f * len, y, s * (Math.cos(ph) > 0 ? 2 : 1), Math.sin(life * 10 + i) > 0);
                }
            }
            ctx.globalAlpha = 1;
            ctx.fillStyle = PINK[2];
            ctx.fill(pp);
            // 빛 폭발 자리 — 빛나는 땅 · 도는 빛살 · 빛 덩이
            if (life >= TH && Math.abs(ix - bx) <= len) {
                const kk = Math.min(1, w / bw);
                ellipse(ctx, px, s, ix, G, w * 2.4 * kk, w * 0.25 * kk, SUN[3], 0.6);
                ellipse(ctx, px, s, ix, G, w * 1.5 * kk, w * 0.16 * kk, SUN[1], 0.8);
                const ir = new Path2D();
                for (let i = 0; i < 12; i++) {
                    const a = (i / 12) * TAU + life * 1.5;
                    const L = w * (1.5 + 0.8 * Math.sin(life * 11 + i * 2.3)) * kk;
                    addLine(ir, px, s, [[ix + Math.cos(a) * w * 0.6, yb + Math.sin(a) * w * 0.6], [ix + Math.cos(a) * L, Math.min(G, yb + Math.sin(a) * L)]], 2);
                }
                ctx.globalAlpha = 0.6;
                ctx.fillStyle = SUN[1];
                ctx.fill(ir);
                fireOrb(ctx, px, s, ix, yb, w * 1.15, SUN, life + 3, (1 + 0.12 * Math.sin(life * 25)) * kk, G, 1, 0, [1, 0.8, 0.6, 0.38], 0.6);
            }
        } });
        // 이상해꽃 (광선 앞) — 쏘는 동안 반동으로 뒤로 밀리며 떨림
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life >= sec - 0.12) {
                return;
            }
            const firing = life > TB && life < TN + 0.2;
            const kick = firing ? -dir * s * (1.5 + Math.sin(life * 60)) * (life < TB + 0.15 ? 2 : 1) : 0;
            drawLitMon(ctx, img, me.x + kick, me.b, me.w, left, SUN[2], edge, 1);
            const glow = clamp((life - TC0) / 1.5, 0, 1) * (life < TN + 0.3 ? 1 : 0);
            drawMon(ctx, img, me.x + kick, me.b, me.w, left, glow * (0.15 + 0.1 * Math.sin(life * 18)), SUN[1]);
        } });
        sc.at(sec - 0.12, () => hideMon(pokemon, false));
        // 꽃이 활짝
        sc.at(0.1, () => {
            petalBurst(mx, my, s, 14, H * 0.5, { r: Ro });
            ring(sc, mx, my, Ro * 0.5, Ro * 3, 0.8, 0.4, [PINK[1], '#ffffff'], 2);
        });

        // ① 기 모으기 — 하늘에서 내려오는 햇빛 줄기 · 꽃 둘레를 도는 꽃잎 · 햇빛 구 · 빛 줄기와 빛가루가 소용돌이치며 빨려 듦
        chargeSwirl(sc, () => [mx, my], TC0, TF, pullR, Ro, SUN, dir);
        sc.add({ max: TB + 0.1, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - TC0) / (TF - TC0), 0, 1);
            const ramp = clamp((life - TC0) / 0.4, 0, 1) * clamp((TB - life) / 0.12, 0, 1);
            if (ramp <= 0) {
                return;
            }
            const rays = [new Path2D(), new Path2D()];
            const motes = new Path2D();
            for (let i = 0; i < 5; i++) {
                const top = mx + (i - 2) * W * 0.12 + Math.sin(life * 2 + i) * W * 0.02;
                addLine(rays[i % 2], px, s, [[top, -s * 2], [mx, my]], 1);
                for (let j = 0; j < 4; j++) {
                    const f = ((life - TC0) * (0.8 + 1.2 * k) + j / 4 + i * 0.13) % 1;
                    motes.rect(px(lerp(top, mx, f * f) - s), px(lerp(-s * 2, my, f * f) - s), 2 * s, 2 * s);
                }
            }
            ctx.globalAlpha = ramp * (0.45 + 0.35 * k) * (0.8 + 0.2 * Math.sin(life * 9));
            ctx.fillStyle = SUN[1];
            ctx.fill(rays[0]);
            ctx.fillStyle = SUN[2];
            ctx.fill(rays[1]);
            ctx.globalAlpha = ramp;
            ctx.fillStyle = '#ffffff';
            ctx.fill(motes);
            const pp = new Path2D();
            const rr = lerp(Ro * 2.6, Ro * 1.3, k);
            for (let i = 0; i < 10; i++) {
                const a = (i / 10) * TAU + (life - TC0) * (2 + 3 * k) * dir;
                petalAt(pp, px, s, mx + Math.cos(a) * rr, my + Math.sin(a) * rr * 0.6, s * (i % 3 ? 1 : 2), Math.sin(life * 10 + i) > 0);
            }
            ctx.globalAlpha = ramp;
            ctx.fillStyle = PINK[2];
            ctx.fill(pp);
            const flash = clamp((life - TF) / 0.06, 0, 1);
            const orb = (0.45 + 0.55 * k) * (1 + 0.15 * beatAt(life) + 0.4 * flash);
            fireOrb(ctx, px, s, mx, my, Ro, SUN, life, orb * ramp, Infinity, 0.95, 0, [1, 0.8, 0.6, 0.38], 0.5);
            orbitEmbers(ctx, px, s, mx, my, Ro * orb * 1.35, SUN, life, dir, ramp * clamp((life - TC0 - 0.3) / 0.3, 0, 1));
        } });
        // 쏘는 동안 꽃 위 햇빛 구 · 도는 빛살 (이상해꽃 위)
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const w = widthAt(life);
            if (w < s) {
                return;
            }
            // 꽃 위에 작게 — 이상해꽃 몸이 보이게
            const oy = my - Ro * 0.35;
            const rays = new Path2D();
            for (let i = 0; i < 10; i++) {
                const a = -Math.PI + ((i + 0.5) / 10) * Math.PI + Math.sin(life * 2 + i) * 0.1;
                const L = Ro * (1.2 + 0.5 * Math.sin(life * 13 + i * 1.9));
                addLine(rays, px, s, [[mx + Math.cos(a) * Ro * 0.5, oy + Math.sin(a) * Ro * 0.5], [mx + Math.cos(a) * L, oy + Math.sin(a) * L]], 1);
            }
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = SUN[1];
            ctx.fill(rays);
            const blast = 1 + 0.6 * clamp(1 - (life - TB) / 0.25, 0, 1); // 쏘는 순간 크게 터졌다 줄어듦
            fireOrb(ctx, px, s, mx, oy, Ro * 0.5, SUN, life, blast + 0.1 * Math.sin(life * 30), G, 1, 0, [1, 0.8, 0.6, 0.38], 0.3);
        } });
        for (const tp of pulses) {
            sc.at(tp, () => {
                ring(sc, mx, my, pullR * 0.6, Ro * 1.1, 1, 0.3, [SUN[2], '#ffffff', SUN[3]], 2);
                ultShake(1.5 + (tp - pulses[0]), 150);
            });
        }
        // ② 번쩍! — 하얀 임팩트 · 고리
        sc.at(TF, () => {
            screenFlash(s, 0.7, '#ffffff', 0.14);
            ultShake(5, 250);
            ring(sc, mx, my, Ro, pullR * 1.2, 1, 0.35, ['#ffffff', SUN[1], SUN[2]], 3);
        });
        // 쏘는 순간 — 꽃 앞 큰 고리 · 빛가루
        sc.at(TB, () => {
            ultShake(6, 400);
            ring(sc, bx, yb, bw * 0.5, bw * 3.5, 1, 0.35, ['#ffffff', SUN[1]], 3);
            fireBits(bx, yb, s, SUN, 40, { spread: TAU, speed: H * 0.8, drag: 2.4, life: 0.6, rx: bw * 0.3, ry: bw * 0.3 });
        });
        // 빛 폭발 자리에 닿는 순간 — 큰 충격파 · 흙 · 빛가루
        const TX = TB + (TH - TB) * clamp(Math.abs(ix - bx) / blen, 0, 1);
        sc.at(TX, () => {
            screenFlash(s, 0.4, SUN[0], 0.12);
            ultShake(9, 700);
            ring(sc, ix, yb, bw * 0.6, Math.max(W, H) * 0.6, 0.6, 0.55, ['#ffffff', SUN[1], SUN[2]], 3);
            ring(sc, ix, G - s, bw * 0.5, bw * 4, 0.18, 0.5, [SUN[2], '#ffffff'], 2);
            debris(ix, G - s, s, ['#6b5a3e', '#8a7350', '#4f8a2e', '#7cc24a'], 36, H * 1.1, { ground: G, angle: -Math.PI / 2 - dir * 0.5, spread: 1.6 });
            fireBits(ix, yb, s, SUN, 50, { angle: -Math.PI / 2 - dir * 0.4, spread: Math.PI * 1.2, speed: H * 1.1, drag: 2, life: 0.8 });
        });
        // 광선이 쏟아지는 동안 — 0.3초마다 충격파, 빛가루가 분수처럼, 광선에 닿은 애 날아감
        let pulse = 0;
        let bits = 0;
        sc.tick((t, dt) => {
            if (t < TH || t > TN) {
                return;
            }
            pulse += dt;
            if (pulse >= 0.3) {
                pulse = 0;
                ring(sc, ix, yb, bw * 0.5, bw * 2.2, 0.7, 0.3, [SUN[1], '#ffffff'], 2);
                ultShake(3, 200);
            }
            bits += dt * 90;
            while (bits >= 1) {
                bits -= 1;
                fireBits(ix, yb - bw * 0.3, s, SUN, 1, { angle: -Math.PI / 2 - dir * 0.5, spread: 1.6, speed: H * 1.1, drag: 1.6, g: H * 1.2, life: 0.8 });
            }
            for (const r of u.others()) {
                const along = (r.x - bx) * dir;
                if (along > 0 && Math.abs(r.y - yb) < bw * 0.6 + r.h * 0.5) {
                    hit(r, dir, 'tumble');
                }
            }
        });
        // ④ 빛의 꽃 — 빛 폭발 자리 땅에서 꽃잎 여덟 장이 활짝 피었다 → 꽃잎 폭풍
        const bloomR = Math.min(bw * 2.4, G * 0.6);
        const iy = G - s * 2;
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TBL || life > TP + 0.1) {
                return;
            }
            const k = easeOut(clamp((life - TBL) / 0.35, 0, 1));
            const end = clamp((life - TP) / 0.1, 0, 1);
            const r = bloomR * k * (1 + 0.15 * end);
            for (let i = 0; i < 8; i++) {
                const a = -Math.PI + (i / 7) * Math.PI + (life - TBL) * 0.4 * dir;
                const ex = Math.cos(a);
                const ey = Math.sin(a) * 0.85;
                fireTail(ctx, px, s, ix + ex * r, iy + ey * r, ex, ey, r * 0.95, r * 0.55, PINK, life + i, 1 - end);
            }
            fireOrb(ctx, px, s, ix, iy, bloomR * 0.35, SUN, life, k * (1 - end), G, 1, 0, [1, 0.8, 0.6, 0.38], 0.2);
        } });
        sc.at(TBL, () => {
            ultShake(4, 300);
            ring(sc, ix, iy, bw * 0.3, bloomR * 1.5, 0.8, 0.4, [PINK[1], '#ffffff'], 2);
        });
        sc.at(TP, () => {
            screenFlash(s, 0.45, PINK[0], 0.15);
            ultShake(7, 500);
            petalBurst(ix, iy - bloomR * 0.3, s, 70, H * 1.2, { r: bloomR * 0.5 });
            ring(sc, ix, iy, bloomR * 0.5, Math.max(W, H) * 0.7, 0.7, 0.6, ['#ffffff', PINK[1], PINK[2]], 3);
            sparkles(ix, iy - bloomR * 0.5, s, ['#ffffff', SUN[1], PINK[1]], 20, bloomR, H * 0.25);
            for (const r of u.others()) {
                if (Math.hypot(r.x - ix, r.y - iy) < bloomR * 1.6) {
                    hit(r, Math.sign(r.x - ix) || dir, 'lift');
                }
            }
        });
        // 꽃잎이 화면 위에서 살랑살랑 떨어짐
        let fall = 0;
        sc.tick((t, dt) => {
            if (t < TP || t > sec - 0.6) {
                return;
            }
            fall += dt * 18;
            while (fall >= 1) {
                fall -= 1;
                petalBurst(rnd(0, W), -s * 2, s, 1, H * 0.25, { angle: Math.PI / 2, spread: 0.6, life: 2 });
            }
        });
    }

    // 하드플랜트 (메가이상해꽃) — 초록 기운 · 잎이 소용돌이치며 모이고 발밑이 초록으로 빛남(초록 빛 구 · 덩굴 싹이 꿈틀) 1.5초
    // → 진화 모션(하얀 실루엣이 이상해꽃 ↔ 메가이상해꽃으로 점점 빠르게, 빛줄기) → 펑! 메가이상해꽃 (PMD SpriteCollab 에 메가이상해꽃 몸 그림이 없어서(초상화만)
    // 진짜 그림을 숨기고 원래 그림을 1.35배로 키워 등에 거대한 꽃을 그려 올림 — megaVenus) → 앞발로 땅을 쿵 — 빛나는 금이 앞으로 달려가고 그 자리마다 거대한 덩굴 · 나무뿌리가 파도처럼 연달아 솟아 휘감음(닿은 애 떠오름)
    // → 끝에서 거대한 꽃이 피어 꽃잎 폭풍이 화면을 휩쓺 → 덩굴이 땅속으로 → 하얀 실루엣이 깜빡이며 원래 모습으로
    const VINE = ['#e9ffb0', '#9be05a', '#4fa83a', '#1f5a2a']; // 잎 · 덩굴 (연두 → 짙은 초록)
    const BARK = ['#2e2014', '#5a4030', '#7a5a40']; // 나무뿌리 (짙은 → 옅은 갈색)
    const WHITE4 = ['#ffffff', '#ffffff', '#ffffff', '#ffffff'];
    // 메가이상해꽃 — 원래 그림(img)을 1.35배로, 등의 꽃 자리(가운데 · 아래에서 61%)에 거대한 꽃: 바깥 꽃잎 일곱 장 · 안쪽 꽃잎 · 노란 꽃술 · 양옆 큰 잎.
    // white 1 이면 하얀 실루엣(진화 모션), 0 ~ 1 이면 그만큼 하얗게 덮음
    function megaVenus(ctx, px, s, img, x, b, w, left, T, edge, white = 0) {
        const wM = w * 1.35;
        const fx = x;
        const fy = b - wM * 0.62;
        const rf = wM * 0.36;
        const solid = white >= 1;
        if (solid) {
            drawLitMon(ctx, img, x, b, wM, left, PINK[2], edge, 1);
            drawMon(ctx, img, x, b, wM, left, 1, '#ffffff');
        } else {
            drawLitMon(ctx, img, x, b, wM, left, VINE[2], edge, 1);
        }
        // 양옆 큰 잎
        for (const sd of [-1, 1]) {
            const a = Math.PI / 2 - sd * (Math.PI / 2 + 0.35) + Math.sin(T * 3 + sd) * 0.05;
            fireTail(ctx, px, s, fx + Math.cos(a) * rf * 1.15, fy + Math.sin(a) * rf * 1.15, Math.cos(a), Math.sin(a), rf * 0.9, rf * 0.5, solid ? WHITE4 : VINE, T + sd, 1);
        }
        // 바깥 꽃잎 · 안쪽 꽃잎
        for (const [n, len, wid, cols, off] of [[7, 1, 0.72, PINK, 0], [6, 0.68, 0.6, ['#fff7fb', '#ffe0ec', '#ffc2d6', '#ff8fb8'], 0.25]]) {
            for (let i = 0; i < n; i++) {
                const a = -Math.PI - 0.2 + ((i + off) / (n - 1)) * (Math.PI + 0.4) + Math.sin(T * 3 + i) * 0.05;
                const L = rf * len;
                fireTail(ctx, px, s, fx + Math.cos(a) * L, fy + Math.sin(a) * L * 0.8, Math.cos(a), Math.sin(a) * 0.8, L * 0.95, L * wid, solid ? WHITE4 : cols, T + i, 1);
            }
        }
        // 노란 꽃술
        ellipse(ctx, px, s, fx, fy, rf * 0.3, rf * 0.2, solid ? '#ffffff' : '#ff9f1c', 1);
        ellipse(ctx, px, s, fx, fy - s, rf * 0.2, rf * 0.13, solid ? '#ffffff' : '#ffe066', 1);
        if (!solid && white > 0) {
            drawMon(ctx, img, x, b, wM, left, white, '#ffffff');
            fireOrb(ctx, px, s, fx, fy, rf * 0.9, WHITE4, T, 1, Infinity, white * 0.8);
        }
    }
    // 덩굴 한 줄기 — 땅(x, G)에서 솟아 끝이 side 쪽으로 갈고리처럼 말림. 길이 h, 밑동 굵기 w → 끝으로 가늘게, grow(0 ~ 1)만큼 자람.
    // 짙은 테두리 · 초록 몸통 · 밝은 줄 · 마디 무늬, 가는 덩굴이 나선으로 휘감고(앞쪽일 때만 보임), 큰 잎 몇 장 · 밑동엔 갈색 뿌리가 땅을 뚫고 퍼짐
    function vine(ctx, px, s, x, G, h, w, T, grow, side, seed) {
        if (grow <= 0.02 || h < s * 2) {
            return;
        }
        const L = h * 1.15 * grow;
        const N = Math.max(8, Math.round(L / (s * 2)));
        const step = L / N;
        const pts = [];
        let a = -Math.PI / 2;
        let px0 = x;
        let py0 = G;
        for (let i = 0; i <= N; i++) {
            const f = (i / N) * grow;
            pts.push([px0, py0, f, a]);
            // 처음엔 거의 곧게, 위로 갈수록 휘고 끝은 갈고리처럼 말림 · 살랑살랑
            a = -Math.PI / 2 + side * (0.35 * f * f + 12 * Math.max(0, f - 0.62) ** 2) + Math.sin(T * 2 + seed + f * 3) * 0.12 * f;
            px0 += Math.cos(a) * step;
            py0 += Math.sin(a) * step;
        }
        const wAt = (f) => w * (1 - 0.72 * f);
        // 밑동 뿌리 — 양옆으로 갈라져 땅을 뚫고 퍼짐
        const roots = [new Path2D(), new Path2D()];
        for (const sd of [-1, 1]) {
            for (let r = 0; r < 2; r++) {
                const len = w * (1.6 + r * 0.9) * grow;
                const pts2 = [[x + sd * w * 0.3, G - w * 0.4], [x + sd * len * 0.6, G - w * 0.15 + r * s], [x + sd * len, G + s]];
                addLine(roots[0], px, s, pts2, Math.max(2, (w * (0.5 - r * 0.15)) / s) + 2);
                addLine(roots[1], px, s, pts2, Math.max(1, (w * (0.5 - r * 0.15)) / s));
            }
        }
        fillPaths(ctx, roots, [BARK[0], BARK[1]], 1);
        // 몸통 — 테두리 · 몸 · 밝은 줄 · 마디
        const body = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
        for (let i = 1; i < pts.length; i++) {
            const f = pts[i][2];
            const wc = Math.max(1, wAt(f) / s);
            const seg = [[pts[i - 1][0], pts[i - 1][1]], [pts[i][0], pts[i][1]]];
            addLine(body[0], px, s, seg, wc + 2);
            addLine(body[1], px, s, seg, wc);
            const nx = -Math.sin(pts[i][3]) * wAt(f) * 0.25 * -side;
            const ny = Math.cos(pts[i][3]) * wAt(f) * 0.25 * -side;
            addLine(body[2], px, s, seg.map(([p, q]) => [p + nx, q + ny]), Math.max(1, wc * 0.3));
            if (i % 5 === 0) {
                addLine(body[3], px, s, [[pts[i][0] - ny * 3.5, pts[i][1] + nx * 3.5], [pts[i][0] + ny * 3.5, pts[i][1] - nx * 3.5]], 1); // 마디
            }
        }
        fillPaths(ctx, body, [VINE[3], VINE[2], VINE[1], VINE[3]], 1);
        // 휘감는 가는 덩굴 — 나선 (앞쪽일 때만 보임)
        const wrap = [new Path2D(), new Path2D()];
        for (let i = 1; i < pts.length; i++) {
            const f = pts[i][2];
            if (f > 0.8) {
                break;
            }
            const ph = f * 16 + seed;
            if (Math.cos(ph) < 0) {
                continue;
            }
            const off = Math.sin(ph) * wAt(f) * 0.55;
            const off0 = Math.sin(ph - 16 / N) * wAt(f) * 0.55;
            const nx = -Math.sin(pts[i][3]);
            const ny = Math.cos(pts[i][3]);
            const seg = [[pts[i - 1][0] + nx * off0, pts[i - 1][1] + ny * off0], [pts[i][0] + nx * off, pts[i][1] + ny * off]];
            const wc = Math.max(1, (wAt(f) * 0.22) / s);
            addLine(wrap[0], px, s, seg, wc + 2);
            addLine(wrap[1], px, s, seg, wc);
        }
        fillPaths(ctx, wrap, [VINE[3], VINE[1]], 1);
        // 큰 잎 — 몸통 중간중간에서 바깥으로 (물방울 모양: 끝이 둥글고 줄기 쪽이 뾰족)
        for (let k = 0; k < 3; k++) {
            const i = Math.round((0.3 + 0.2 * k) * N);
            if (i >= pts.length) {
                break;
            }
            const [lx, ly, f, la] = pts[i];
            const sd = k % 2 ? 1 : -1;
            const la2 = la + sd * (1.1 + 0.15 * Math.sin(T * 4 + k + seed));
            const ll = Math.max(4 * s, w * 1.8 * (1 - 0.3 * f));
            fireTail(ctx, px, s, lx + Math.cos(la2) * ll, ly + Math.sin(la2) * ll, Math.cos(la2), Math.sin(la2), ll, ll * 0.55, VINE, T + k, 1);
        }
    }
    function runHardPlant(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const img = pokemon.el;
        const me = monBox(pokemon);
        const edge = Math.max(1, Math.round(u.s * 0.75));
        const D = Math.min(Math.max(H / 3, short(u) * 0.4) * (0.9 + 0.2 * P), W * 0.42, H * 0.62);
        const left = dir < 0;
        // 때 — (기 모으기) · 진화 모션 · 펑(메가) · 쿵 · (덩굴 파도) · 꽃 · 꽃잎 폭풍 · 덩굴이 들어감 · 원래대로
        const TE = 1.5;
        const TM = 2.8;
        const TS = 3.5;
        const TV = TS + 0.15;
        const NV = 6;
        const GAP = 0.17;
        const TFL = TV + NV * GAP + 0.25;
        const TST = TFL + 0.55;
        const TIN = TST + 1.0;
        const TBack = sec - 0.5;
        const Ro = Math.max(me.w, me.h) * 0.75;
        const pullR = Math.max(Ro * 3.5, D * 1.1);
        const cx = me.x;
        const cy = me.b - me.h * 0.45;
        // 덩굴이 솟을 자리 — 앞쪽 끝까지 고르게 (앞이 좁으면 뒤쪽으로)
        const fwd = dir > 0 ? W - me.x : me.x;
        const vd = fwd > W * 0.35 ? dir : -dir;
        const x0 = me.x + vd * me.w * 0.7;
        const span = Math.max(W * 0.3, (vd > 0 ? W - x0 : x0) - W * 0.04);
        const spots = [];
        for (let i = 0; i < NV; i++) {
            const f = (i + 0.6) / NV;
            spots.push({ x: x0 + vd * span * f, t0: TV + i * GAP, h: Math.min(G * 0.8, lerp(H * 0.3, H * 0.62, i / (NV - 1))), w: Math.max(5 * s, Math.max(H * 0.04, lerp(me.w * 0.45, me.w * 0.75, i / (NV - 1)))), seed: i * 1.7 });
        }
        const bloomR = Math.min(G * 0.45, Math.max(D * 0.9, me.w * 2.2));
        const fx = clamp(spots[NV - 1].x, bloomR * 0.8, W - bloomR * 0.8); // 거대한 꽃 — 화면 밖으로 잘리지 않게
        const growAt = (sp, t) => {
            const k = (t - sp.t0) / 0.35;
            if (k <= 0) {
                return 0;
            }
            const up = k < 1 ? 1 - (1 - k) ** 3 + Math.sin(k * Math.PI) * 0.12 : 1; // 쑥 솟으며 살짝 넘침
            return up * (1 - easeIn(clamp((t - TIN) / 0.5, 0, 1)));
        };
        const sc = scene(u, sec + 0.3, 'ultpillar');
        ultDark(0.3, ms - 200);
        hideMon(pokemon, true);
        hideUntil(pokemon, ms + 100);

        // 꼭두각시 — 기 모으기(초록 빛 구) · 진화 모션 · 메가 · 원래대로 깜빡
        const pulses = [0.7, 1.05, 1.35];
        const beatAt = (t) => pulses.reduce((m, tp) => Math.max(m, clamp(1 - Math.abs(t - tp) / 0.1, 0, 1)), 0);
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life >= TBack) {
                return;
            }
            if (life < TE + 0.25) {
                const k = easeOut(clamp((life - 0.1) / 0.3, 0, 1)) * (0.6 + 0.4 * clamp(life / TE, 0, 1)) * (1 + 0.15 * beatAt(life)) * (1 - clamp((life - TE) / 0.25, 0, 1));
                fireOrb(ctx, px, s, cx, cy, Ro, VINE, life, k, G, 0.9, 0, [1, 0.8, 0.6, 0.38], 0.4);
                orbitEmbers(ctx, px, s, cx, cy, Ro * k * 1.3, VINE, life, dir, clamp((life - 0.3) / 0.2, 0, 1) * (1 - clamp((life - TE) / 0.15, 0, 1)));
            }
            if (life < TE) {
                drawLitMon(ctx, img, cx, me.b, me.w, left, VINE[1], edge, 1);
                drawMon(ctx, img, cx, me.b, me.w, left, clamp((life - 0.3) / 0.5, 0, 1) * (0.2 + 0.12 * Math.sin(life * 18)), VINE[0]);
                return;
            }
            if (life < TM) {
                const k = (life - TE) / (TM - TE);
                const ramp = clamp(k / 0.15, 0, 1);
                const paths = [new Path2D(), new Path2D()];
                for (let i = 0; i < 12; i++) {
                    const a = (i / 12) * TAU + life * 0.9 * dir;
                    const L = pullR * (0.55 + 0.35 * Math.sin(life * 6 + i * 1.7)) * ramp;
                    addLine(paths[i % 2], px, s, [[cx + Math.cos(a) * Ro * 0.9, cy + Math.sin(a) * Ro * 0.9], [cx + Math.cos(a) * L, cy + Math.sin(a) * L]], i % 2 ? 1 : 2);
                }
                fillPaths(ctx, paths, ['#ffffff', '#e9ffb0'], 0.8 * ramp);
                fireOrb(ctx, px, s, cx, cy, Ro, GLOW, life, (0.6 + 0.5 * k) * ramp, G, 0.6);
                const flips = (life - TE) * (3 + 8.5 * k);
                const showMega = k > 0.9 || Math.floor(flips) % 2 === 1;
                const swell = 1.1 + (k > 0.9 ? 0.15 : 0.3 * Math.sin((flips % 1) * Math.PI));
                if (showMega) {
                    megaVenus(ctx, px, s, img, cx, me.b, me.w * swell, left, life, edge * 2, 1);
                } else {
                    drawLitMon(ctx, img, cx, me.b, me.w * swell, left, VINE[1], edge * 2, 1);
                    drawMon(ctx, img, cx, me.b, me.w * swell, left, 1, '#ffffff');
                }
                return;
            }
            const stomp = life > TS - 0.25 && life < TS ? -Math.sin(((life - TS + 0.25) / 0.25) * Math.PI) * s * 4 : 0; // 앞발을 들었다 쿵
            if (life > TBack - 0.4 && Math.floor((life - TBack + 0.4) / 0.06) % 2 === 1) {
                drawMon(ctx, img, cx, me.b, me.w, left, 1, '#ffffff'); // 원래대로 — 깜빡
                return;
            }
            megaVenus(ctx, px, s, img, cx, me.b + stomp, me.w, left, life, edge, life > TBack - 0.4 ? 1 : clamp(1 - (life - TM) / 0.35, 0, 0.99));
        } });

        // ① 기 모으기 — 초록 기운 · 잎이 소용돌이치며 모이고, 발밑이 빛나며 덩굴 싹이 꿈틀
        chargeSwirl(sc, () => [cx, cy], 0.2, TE, pullR, Ro, VINE, dir);
        sc.add({ max: TM, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp(life / TE, 0, 1) * clamp((TM - life) / 0.3, 0, 1);
            if (k <= 0) {
                return;
            }
            ellipse(ctx, px, s, cx, G, me.w * (1 + k), me.w * 0.18 * (1 + k), VINE[2], 0.5 * k);
            ellipse(ctx, px, s, cx, G, me.w * 0.6 * (1 + k), me.w * 0.1 * (1 + k), VINE[1], 0.7 * k);
            for (let i = 0; i < 4; i++) {
                const sx = cx + (i - 1.5) * me.w * 0.55;
                vine(ctx, px, s, sx, G, me.h * (0.35 + 0.15 * Math.sin(life * 3 + i)), Math.max(2 * s, me.w * 0.07), life, k, i < 2 ? -1 : 1, i * 2.1);
            }
        } });
        for (const tp of pulses) {
            sc.at(tp, () => {
                ring(sc, cx, cy, pullR * 0.6, Ro * 1.1, 1, 0.3, [VINE[1], '#ffffff', VINE[3]], 2);
                ultShake(1.5, 150);
            });
        }
        // ② 진화 모션 — 하얀 고리 · 반짝이
        sc.at(TE, () => {
            screenFlash(s, 0.25, '#ffffff', 0.15);
            ring(sc, cx, cy, Ro * 0.5, pullR, 1, 0.45, ['#ffffff', VINE[0]], 2);
        });
        let glint = 0;
        sc.tick((t, dt) => {
            if (t < TE || t > TM) {
                return;
            }
            glint += dt * 14;
            while (glint >= 1) {
                glint -= 1;
                sparkles(cx, cy, s, ['#ffffff', VINE[0], PINK[1]], 1, Ro * 1.6, H * 0.15);
            }
        });
        // ③ 펑 — 메가이상해꽃 (하얀 번쩍 · 큰 고리 · 꽃잎 · 잎)
        sc.at(TM, () => {
            screenFlash(s, 0.6, '#ffffff', 0.3);
            ultShake(6, 450);
            ring(sc, cx, cy, Ro * 0.5, Math.max(W, H) * 0.6, 1, 0.5, ['#ffffff', PINK[1], VINE[1]], 3);
            petalBurst(cx, cy, s, 30, H * 0.9, { r: Ro * 0.6 });
            fireBits(cx, cy, s, VINE, 40, { spread: TAU, speed: H * 0.8, drag: 2.4, life: 0.7 });
        });
        // ④ 쿵 — 빛나는 금이 덩굴 자리를 따라 앞으로 달려감
        sc.at(TS, () => {
            ultShake(8, 500);
            ring(sc, cx, G - s, me.w * 0.5, me.w * 4, 0.18, 0.45, [VINE[1], '#ffffff'], 2);
            debris(cx, G - s, s, ['#6b5a3e', '#8a7350', '#4f8a2e'], 24, H * 0.7, { ground: G, angle: -Math.PI / 2, spread: 2.2 });
        });
        const crack = jag(x0, G - s, x0 + vd * span, G - s, Math.max(3 * s, span / 24), 0.04);
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TS || life > TIN + 0.5) {
                return;
            }
            const k = clamp((life - TS) / (TV + (NV - 1) * GAP - TS), 0, 1);
            const n = Math.max(2, Math.round(crack.length * k));
            const fade = 1 - clamp((life - TIN) / 0.5, 0, 1);
            fillPts(ctx, px, s, crack.slice(0, n), 3, BARK[0], fade);
            fillPts(ctx, px, s, crack.slice(0, n), 1, VINE[0], fade * (0.7 + 0.3 * Math.sin(life * 20)));
        } });
        // ⑤ 덩굴 파도 — 자리마다 가운데 큰 덩굴 + 양옆 작은 덩굴 + 나무뿌리, 흙이 튀고 닿은 애 떠오름
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            for (const sp of spots) {
                const g = growAt(sp, life);
                if (g <= 0.01) {
                    continue;
                }
                vine(ctx, px, s, sp.x - vd * sp.w * 1.3, G, sp.h * 0.6, sp.w * 0.55, life, g, -vd, sp.seed + 2); // 작은 덩굴
                vine(ctx, px, s, sp.x, G, sp.h, sp.w, life, g, vd, sp.seed); // 굵은 덩굴
            }
        } });
        for (const sp of spots) {
            sc.at(sp.t0, () => {
                ultShake(4, 180);
                debris(sp.x, G - s, s, ['#6b5a3e', '#8a7350', '#4f8a2e', '#7cc24a'], 16, H * 0.8, { ground: G, angle: -Math.PI / 2, spread: 1.8 });
                fireBits(sp.x, G - s, s, VINE, 10, { angle: -Math.PI / 2, spread: 1.4, speed: H * 0.6, drag: 2.2, life: 0.6 });
                for (const r of u.others()) {
                    if (Math.abs(r.x - sp.x) < sp.w * 3 + r.w * 0.5) {
                        hit(r, vd, 'lift');
                    }
                }
            });
        }
        // ⑥ 끝에서 거대한 꽃이 핌 → 꽃잎 폭풍이 화면을 휩쓺
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TFL || life > TST + 0.1) {
                return;
            }
            const k = easeOut(clamp((life - TFL) / 0.35, 0, 1));
            const end = clamp((life - TST) / 0.1, 0, 1);
            const r = bloomR * k * (1 + 0.15 * end);
            for (let i = 0; i < 8; i++) {
                const a = -Math.PI + (i / 7) * Math.PI + (life - TFL) * 0.4 * vd;
                const ex = Math.cos(a);
                const ey = Math.sin(a) * 0.85;
                fireTail(ctx, px, s, fx + ex * r, G - s + ey * r, ex, ey, r * 0.95, r * 0.55, PINK, life + i, 1 - end);
            }
            fireOrb(ctx, px, s, fx, G - s, bloomR * 0.35, SUN, life, k * (1 - end), G, 1, 0, [1, 0.8, 0.6, 0.38], 0.2);
        } });
        sc.at(TFL, () => {
            ultShake(5, 300);
            ring(sc, fx, G - s, bloomR * 0.2, bloomR * 1.5, 0.8, 0.4, [PINK[1], '#ffffff'], 2);
        });
        sc.at(TST, () => {
            screenFlash(s, 0.4, PINK[0], 0.15);
            ultShake(7, 500);
            petalBurst(fx, G - bloomR * 0.4, s, 60, H * 1.2, { r: bloomR * 0.5 });
            ring(sc, fx, G - s, bloomR * 0.5, Math.max(W, H) * 0.7, 0.7, 0.6, ['#ffffff', PINK[1], PINK[2]], 3);
        });
        // 꽃잎 바람 — 꽃 쪽에서 화면을 가로질러 휩쓸고 지나감 (닿은 애 벌러덩)
        let gust = 0;
        sc.tick((t, dt) => {
            if (t < TST || t > TST + 1.1) {
                return;
            }
            gust += dt * 70;
            while (gust >= 1) {
                gust -= 1;
                petalBurst(vd > 0 ? W + s * 4 : -s * 4, rnd(G * 0.15, G - s * 2), s, 1, H * 1.6, { angle: vd > 0 ? Math.PI : 0, spread: 0.3, life: 1.1 });
            }
            for (const r of u.others()) {
                hit(r, -vd, 'tumble');
            }
        });
        // ⑦ 덩굴이 땅속으로 → 원래대로
        sc.at(TIN, () => ultShake(3, 300));
        sc.at(TBack, () => {
            hideMon(pokemon, false);
            sparkles(cx, me.b - me.h * 0.5, s, ['#ffffff', VINE[0], PINK[1]], 16, me.w, H * 0.2);
            ring(sc, cx, me.b - me.h * 0.5, me.w * 0.4, me.w * 2.5, 0.8, 0.35, ['#ffffff', VINE[1]], 2);
        });
    }

    // ═════ 거북왕 — turtle: 하이드로캐논 (ultbeam 위에 덮어씀) · 메가런처 (ultorb 위에 덮어씀) — 아래 Object.assign ═════
    const TIDE = ['#ffffff', '#bfe9ff', '#6cc3ff', '#2468c8']; // 물 (하양 → 하늘 → 물빛 → 짙은 파랑)
    const GUNM = ['#262c36', '#56606e', '#939eae', '#d3dbe6']; // 대포 쇠 (짙은 → 밝은)
    // 물줄기 — (x0, y0)에서 dir 쪽으로 len, 굵기 w. 가운데가 amp 만큼 위아래로 꼬이며(phase) 나아가고(입구에선 곧게), 겹친 색 · 가장자리 하얀 물거품
    function waterJet(ctx, px, s, x0, y0, dir, len, w, cols, T, phase, amp, maxY = Infinity, alpha = 1, prof = null) {
        if (len < s || w < s || alpha <= 0.01) {
            return;
        }
        const n = Math.ceil(len / s);
        const foam = new Path2D();
        for (const [m, c, a] of [[1, cols[3], 0.85], [0.78, cols[2], 0.95], [0.52, cols[1], 1], [0.26, cols[0], 0.95]]) {
            ctx.globalAlpha = a * alpha;
            ctx.fillStyle = c;
            for (let j = 0; j <= n; j++) {
                const at = j * s;
                const f = prof ? Math.min(1, at / prof.L) : 1;
                const sm = f * f * (3 - 2 * f); // 퍼지는 정도
                const ws = prof ? lerp(prof.w0, 1, sm) : 1;
                const twist = amp * ws * Math.sin(at / (w * 2.2) - T * 12 + phase) * Math.min(1, at / (w * 1.5));
                const cy = y0 + twist + (prof ? prof.dy * sm : 0);
                const half = w * ws * 0.5 * m * (1 + 0.1 * Math.sin(at / w * 4 - T * 26 + m * 3)) * Math.sqrt(Math.min(1, at / (w * ws * 0.4) + 0.3));
                if (half < s * 0.5) {
                    continue;
                }
                const top = cy - half;
                const bot = Math.min(cy + half, maxY);
                if (bot > top) {
                    ctx.fillRect(px(x0 + dir * at), px(top), s, Math.max(s, px(bot - top)));
                }
                if (m === 1 && hash(j, Math.floor(T * 14)) > 0.82) {
                    foam.rect(px(x0 + dir * at), px(hash(j, 7) > 0.5 ? top - s : Math.min(bot, maxY - s)), s, s);
                }
            }
        }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffffff';
        ctx.fill(foam);
    }
    // 큰 파도 — 땅(G)을 따라 xf 에서 dir 쪽으로 밀려가는 물 벽: 앞이 가장 높고(높이 hw) 뒤로 낮아짐, 앞머리는 말리며 하얀 물거품
    function waveFront(ctx, px, s, xf, G, dir, hw, len, cols, T, alpha = 1) {
        if (hw < s * 2 || alpha <= 0.01) {
            return;
        }
        const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
        for (let d = 0; d < len; d += s) {
            const f = d / len; // 0 = 앞
            const rise = Math.min(1, (f + 0.04) / 0.18);
            const h = hw * Math.sqrt(rise) * (1 - 0.75 * f) * (1 + 0.06 * Math.sin(d * 0.08 - T * 9));
            const x = xf - dir * d;
            const top = G - h;
            paths[0].rect(px(x), px(top), s, Math.max(s, px(h)));
            paths[1].rect(px(x), px(top + h * 0.22), s, Math.max(s, px(h * 0.78)));
            paths[2].rect(px(x), px(top + h * 0.55), s, Math.max(s, px(h * 0.45)));
            if (f < 0.35) {
                paths[3].rect(px(x), px(top - s), s, Math.max(s, px(h * 0.12 * (1 - f / 0.35) + s)));
            }
        }
        // 말리는 앞머리 — 물마루가 앞으로 넘어감
        const crest = new Path2D();
        for (let i = 0; i < 6; i++) {
            const a = -Math.PI / 2 + (i / 5) * Math.PI * 0.9;
            const r = hw * 0.22;
            crest.rect(px(xf + dir * Math.cos(a) * r - dir * r * 0.4), px(G - hw * 0.95 + Math.sin(a) * r), 2 * s, 2 * s);
        }
        fillPaths(ctx, paths, [cols[3], cols[2], cols[1], '#ffffff'], alpha);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffffff';
        ctx.fill(crest);
    }
    // 물방울 — 위로 튀어 포물선으로 떨어짐 (한꺼번에 n 개)
    function splash(x, y, s, cols, n, speed, o = {}) {
        n = Math.min(Math.round(n), Math.max(0, LIVE_MAX - moveParticles.length));
        for (let i = 0; i < n; i++) {
            const a = (o.angle ?? -Math.PI / 2) + rnd(-0.5, 0.5) * (o.spread ?? 2);
            const sp = speed * rnd(0.35, 1);
            sigParticle({ x: x + rnd(-1, 1) * (o.r ?? 0), y, s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: speed * 2.2, drag: 0.5, max: rnd(0.5, 1) * (o.life ?? 0.9), color: pick(cols), size: pick([1, 1, 2]), draw: DRAW.dot });
        }
    }
    // 도는 물 고리 — (x, y) 둘레 납작한 고리를 점선(4칸 그리고 2칸 비움)으로, T 에 따라 돎 (dirn 쪽)
    function swirlRing(ctx, px, s, x, y, r, flat, T, dirn, cols, alpha = 1) {
        if (alpha <= 0.01 || r < s * 2) {
            return;
        }
        const n = clamp(Math.round((r * TAU) / (s * 2)), 16, 240);
        const off = Math.floor(T * 30) * dirn;
        const paths = [new Path2D(), new Path2D()];
        for (let i = 0; i < n; i++) {
            if ((((i + off) % 6) + 6) % 6 >= 4) {
                continue;
            }
            const a = (i / n) * TAU;
            const back = Math.sin(a) < 0; // 뒤쪽은 옅게
            paths[back ? 1 : 0].rect(px(x + Math.cos(a) * r), px(y + Math.sin(a) * r * flat), 2 * s, s);
        }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = cols[0];
        ctx.fill(paths[0]);
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle = cols[1];
        ctx.fill(paths[1]);
    }
    // 왕관 물보라 — 땅(x, G)에서 물 가시 열두 개가 둥글게 솟았다(0.3초) 끝이 방울로 떨어지며 사그라듦 · 가운데 물 덩이
    function crownSplash(sc, x, G, R, dur, cols) {
        const s = sc.u.S;
        return sc.add({ max: dur, draw: (ctx, it, t, px) => {
            const k = it.life;
            const up = easeOut(clamp(k / 0.3, 0, 1));
            const down = clamp((k - dur * 0.5) / (dur * 0.5), 0, 1);
            for (let i = 0; i < 12; i++) {
                const f = (i + 0.5) / 12;
                const xo = (f - 0.5) * 2 * R * (0.8 + 0.4 * up);
                const hgt = R * (0.55 + 0.35 * Math.sin(f * Math.PI)) * up * (1 - down) * (0.8 + 0.2 * hash(i, 81));
                fireTail(ctx, px, s, x + xo * 1.05, G - hgt, (xo / R) * 0.35, -1, hgt, R * 0.16, cols, k + i, 1 - down * 0.5);
            }
            fireOrb(ctx, px, s, x, G, R * 0.6, cols, k, up * (1 - down), G + s, 1, down, [1, 0.82, 0.62, 0.4], 0.3);
        } });
    }
    // 물 불꽃놀이 — 땅에서 물줄기 폭죽이 하나씩 솟아(0.45초) 하늘에서 물방울 고리 두 겹으로 활짝 터짐 (가운데 번쩍 · 반짝이는 물방울이
    // 꼬리를 끌며 흩어져 천천히 떨어짐). x0 ~ x1 사이에 n 발이 0.22초 간격으로 (t0 부터)
    const SPARKW = ['#ffffff', '#bfe9ff', '#6cc3ff', '#7ff3ff']; // 물 불꽃 (하양 · 하늘 · 물빛 · 청록)
    const dropDraw = (ctx, p, t, px) => {
        const sp = Math.hypot(p.vx, p.vy) || 1;
        const tw = 0.7 + 0.3 * Math.sin(p.life * 30 + p.ph); // 반짝반짝
        const z = p.s * (p.z || 1);
        const n = p.z > 1 ? 5 : 3; // 굵은 물방울은 꼬리가 길게
        ctx.fillStyle = p.color;
        for (let k = 0; k < n; k++) {
            ctx.globalAlpha = Math.min(1, (1 - t) * 1.3) * tw * (1 - k / n);
            const zz = k === 0 ? z : Math.max(p.s, z - p.s);
            ctx.fillRect(px(p.x - (p.vx / sp) * k * z * 1.1 - zz / 2), px(p.y - (p.vy / sp) * k * z * 1.1 - zz / 2), zz, zz);
        }
    };
    function waterFireworks(sc, t0, n, x0, x1) {
        const { W, H, S: s, ground: G } = sc.u;
        for (let i = 0; i < n; i++) {
            const x = clamp(lerp(x0, x1, (i + 0.5) / n) + (hash(i, 95) - 0.5) * W * 0.08, W * 0.06, W * 0.94);
            const top = Math.max(H * 0.1, G * (0.18 + 0.22 * hash(i, 96)));
            const tl = t0 + i * 0.22;
            const R = Math.min(W * 0.22, G * (0.22 + 0.08 * hash(i, 97)));
            sc.add({ max: tl + 0.5, draw: (ctx, it, t, px) => {
                const k = (sc.t - tl) / 0.45;
                if (k < 0 || k > 1) {
                    return;
                }
                const y = lerp(G - s, top, easeOut(k));
                fireTail(ctx, px, s, x, y, 0, -1, Math.min(G - y, H * 0.18), s * 5, TIDE, sc.t + i, 1);
            } });
            sc.at(tl + 0.45, () => {
                ultShake(2, 120);
                ring(sc, x, top, s * 2, R * 0.9, 1, 0.4, ['#ffffff', SPARKW[3]], 2);
                for (const [m, sp0, z] of [[40, 2.4, 2], [20, 1.3, 1]]) {
                    for (let j = 0; j < m && room(); j++) {
                        const a = (j / m) * TAU + rnd(-0.04, 0.04);
                        const sp = R * sp0 * rnd(0.9, 1.1);
                        sigParticle({ x, y: top, s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: H * 0.28, drag: 1.7, max: rnd(1.2, 1.7), color: z > 1 ? SPARKW[(i + j) % 4] : '#ffffff', ph: rnd(0, TAU), z, draw: dropDraw });
                    }
                }
                sparkles(x, top, s, ['#ffffff', SPARKW[3]], 14, R * 0.6, H * 0.05);
            });
            sc.add({ max: tl + 0.7, draw: (ctx, it, t, px) => {
                const k = (sc.t - tl - 0.45) / 0.2;
                if (k < 0 || k > 1) {
                    return;
                }
                fireOrb(ctx, px, s, x, top, R * 0.35, SPARKW, sc.t, (1 - k) * 1.2, Infinity, 1, k, [1, 0.8, 0.6, 0.38], 0.2); // 가운데 번쩍 (둥글게)
            } });
        }
    }
    // 하이드로캐논 — 어깨의 두 대포에 2초 동안 물이 모임(물 소용돌이 고리 · 물웅덩이에서 빨려 오르는 물줄기 · 대포 끝 물 구가 두근두근)
    // → 정적 0.4초 (화면이 거의 까매지고 대포만 빛남 · 집중선이 거북왕으로 빨려 듦 · 물 구가 꽉 압축) → 임팩트 프레임 (하양 · 검정 번쩍, 각 0.06초)
    // → 굵은 물줄기 두 가닥이 서로 꼬이며 화면 끝까지 (발이 땅에 박히며 금이 가고 충격파 세 겹 · 하얀 압력 고리 · 흩날리는 물보라)
    // · 가장 가까운 애 자리에 왕관 물보라 · 거대한 물기둥 → 1초 뒤 출력 최대: 두 가닥이 하나로 합쳐지며 두 배로 굵은 거대한 물 광선 (새 충격파 · 큰 흔들림)
    // → 물줄기가 그치면 맞는 자리에서 거대한 물 폭발 → 높은 해일 두 겹 (물마루 물보라) → 비 → 물 불꽃놀이.
    // 거북왕은 진짜 그림을 숨기고 물줄기 앞에 꼭두각시로 (정면 그림 — 대포는 양 어깨, 아래에서 58% 높이)
    function runHydroCannon(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const img = pokemon.el;
        const me = monBox(pokemon);
        const edge = Math.max(1, Math.round(u.s * 0.75));
        const left = dir < 0;
        const D = Math.min(Math.max(H / 3, short(u) * 0.4) * (0.9 + 0.2 * P), W * 0.42, H * 0.62);
        const cyM = me.b - me.h * 0.58; // 대포 높이
        const cF = me.x + dir * me.w * 0.33; // 앞 대포
        const cB = me.x - dir * me.w * 0.33; // 뒤 대포
        const Ro = Math.max(s * 4, me.w * 0.24); // 대포 끝 물 구
        const bw = clamp(H * 0.16 * (0.9 + 0.2 * P), 16, Math.max(20, me.h * 1.7)); // 물줄기 두 가닥을 합친 굵기
        const yb = Math.max(bw * 0.65, Math.min(cyM, G - bw * 0.45)); // 대포 높이 — 아래 가닥이 땅을 스치며 물보라
        const ybBig = Math.max(bw * 1.1, Math.min(yb, G - bw * 1.05)); // 출력 최대 — 두 배 굵기의 아래가 땅 위에 오게
        const blenF = (dir > 0 ? W - cF : cF) + bw * 2;
        const q = nearest(u);
        const ahead = q && Math.sign(q.x - me.x) === dir && Math.abs(q.x - me.x) > me.w * 0.6;
        const ix = clamp(ahead ? q.x : me.x + dir * W * 0.55, W * 0.05, W * 0.95);
        // 때 — (모으기) · 정적 · 임팩트 프레임 · 발사 · 다 닿음 · 출력 최대 · 그침 · 해일
        const TC0 = 0.25;
        const TQ = 2.2;
        const TF = TQ + 0.4;
        const TB = TF + 0.12;
        const TH = TB + 0.16;
        const TMAX = TB + 1.0;
        const TN = TMAX + 1.3;
        const TW = TN + 0.2;
        const pulses = [0.95, 1.45, 1.85, 2.1];
        const pullR = Math.max(Ro * 6, D * 1.2);
        const sc = scene(u, sec + 0.3, 'ultbeam');
        ultDark(0.4, ms - 200);
        hideMon(pokemon, true);
        hideUntil(pokemon, ms + 100);
        const beatAt = (t) => pulses.reduce((m, tp) => Math.max(m, clamp(1 - Math.abs(t - tp) / 0.1, 0, 1)), 0);
        const reachAt = (t) => blenF * easeOut(clamp((t - TB) / (TH - TB), 0, 1));
        const mergeAt = (t) => easeOut(clamp((t - TMAX) / 0.25, 0, 1)); // 출력 최대 — 두 가닥이 하나로
        const widthAt = (t) => {
            if (t < TB) {
                return 0;
            }
            const burst = 1 + 0.35 * clamp(1 - (t - TB) / 0.3, 0, 1) + 0.3 * clamp(1 - (t - TMAX) / 0.3, 0, 1) * (t > TMAX ? 1 : 0);
            const thin = t > TN ? Math.max(0, 1 - (t - TN) / 0.35) : 1;
            return bw * burst * thin;
        };
        // 출력 최대 — 광선은 대포 높이 · 거북왕 크기만 한 굵기에서 시작해 flareL 동안 굵어지며 위로 퍼짐 (허공에서 시작하지 않게)
        const flareL = Math.max(me.w * 3, W * 0.18);
        const spreadAt = (t, x) => {
            const f = Math.min(1, Math.abs(x - (cF + slideAt(t))) / flareL);
            return f * f * (3 - 2 * f);
        };
        const centerAt = (t, x) => yb + (ybBig - yb) * mergeAt(t) * spreadAt(t, x);
        // 반동 — 쏘는 동안 땅을 긁으며 뒤로 밀리고 덜덜 떨림 (출력 최대 때 한 번 더)
        const slideAt = (t) => (t < TB ? 0 : -dir * Math.min(s * 12, (t - TB) * s * 22)) - (t > TMAX ? dir * Math.min(s * 6, (t - TMAX) * s * 30) : 0) + (t > TB && t < TN ? -dir * Math.sin(t * 55) * s * (1 + mergeAt(t)) : 0);
        // 쏘는 순간 대포 앞 물 폭발 — 앞 대포는 거북왕 위, 뒤 대포는 거북왕 뒤 (몸을 덮지 않게)
        const muzzleBlast = (cx) => (ctx, it, t, px) => {
            const life = sc.t;
            for (const [t0, big] of [[TB, 1], [TMAX, 1.4]]) {
                const k = (life - t0) / 0.45;
                if (k >= 0 && k <= 1) {
                    fireOrb(ctx, px, s, cx + slideAt(life) + dir * Ro, yb, bw * 0.45 * big, TIDE, life + cx, (1 + 1.3 * (1 - k)) * (1 - k * k), G, 1, k, [1, 0.8, 0.6, 0.38], 0.2);
                }
            }
        };

        // ③ 물줄기 (거북왕 뒤) — 두 가닥이 꼬이다가 출력 최대 때 하나로 합쳐진 거대한 물 광선 · 날아가는 물 머리 · 맞는 자리 물 덩이
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const w = widthAt(life);
            if (w < s) {
                return;
            }
            const len = reachAt(life);
            const sx = slideAt(life);
            const mk = mergeAt(life);
            const dy = (ybBig - yb) * mk;
            for (const [cx, ph] of [[cB, Math.PI], [cF, 0]]) {
                const L = len + (cx === cB ? Math.abs(cF - cB) : 0);
                waterJet(ctx, px, s, cx + sx, yb, dir, L, w * 0.62 * (1 + 0.5 * mk), TIDE, life, ph, w * 0.32 * (1 - mk), G, 1, mk > 0 ? { w0: 1 / (1 + 0.5 * mk), L: flareL, dy } : null);
            }
            if (mk > 0) {
                const wBig = w * 2 * mk;
                waterJet(ctx, px, s, cF + sx, yb, dir, len, wBig, TIDE, life, 0, 0, G, 1, { w0: clamp((me.h * 1.1) / wBig, 0.15, 1), L: flareL, dy }); // 합쳐진 거대한 물 광선 — 대포에서 뿜어져 퍼짐
            }
            const half = w * (0.68 + 0.4 * mk);
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = '#ffffff';
            const nRing = Math.max(2, Math.round(len / (w * 2)));
            for (let k = 0; k < nRing; k++) {
                const at = ((life * (2.2 + mk) + k / nRing) % 1) * len;
                if (at < w || (mk > 0 && at < flareL)) {
                    continue; // 퍼지는 동안엔 고리를 안 그림
                }
                const y0 = centerAt(life, cF + sx + dir * at);
                const top = y0 - half;
                const bot = Math.min(G, y0 + half);
                ctx.fillRect(px(cF + sx + dir * at - s), px(top), 2 * s, Math.max(s, px(bot - top)));
            }
            if (life < TH + 0.05) {
                fireOrb(ctx, px, s, cF + sx + dir * len, yb, w * 0.85, TIDE, life, 1, G, 1, 0, [1, 0.8, 0.6, 0.38], 0.2); // 날아가는 물 머리
            }
            if (life >= TH && Math.abs(ix - cF) <= len) {
                const kk = Math.min(1, w / bw) * (1 + 0.5 * mk);
                ellipse(ctx, px, s, ix, G, w * 2.8 * kk, w * 0.24 * kk, TIDE[2], 0.6);
                ellipse(ctx, px, s, ix, G, w * 1.7 * kk, w * 0.15 * kk, TIDE[1], 0.8);
                fireOrb(ctx, px, s, ix, centerAt(life, ix), w * 1.15, TIDE, life + 3, (1 + 0.1 * Math.sin(life * 25)) * kk, G, 1, 0, [1, 0.82, 0.62, 0.4], 0.5);
            }
        } });
        // 발밑 금 — 쏘는 순간 발이 땅에 박히며 양옆으로 갈라짐
        const cracks = [-1, 1].map((d) => jag(me.x, G - s, me.x + d * me.w * 2.2, G - s, Math.max(3 * s, me.w * 0.15), 0.08));
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TB || life > TN + 0.8) {
                return;
            }
            const k = clamp((life - TB) / 0.25, 0, 1);
            const fade = 1 - clamp((life - TN) / 0.8, 0, 1);
            for (const c of cracks) {
                const n = Math.max(2, Math.round(c.length * k));
                fillPts(ctx, px, s, c.slice(0, n), 2, '#2a2620', fade);
                fillPts(ctx, px, s, c.slice(0, n), 1, TIDE[1], fade * (0.6 + 0.4 * Math.sin(life * 20)));
            }
        } });
        sc.add({ max: sec, draw: muzzleBlast(cB) }); // 뒤 대포 물 폭발 (거북왕 뒤)
        // 거북왕 (물줄기 앞) — 쏘는 동안 발이 땅에 박혀 조금 내려앉음
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life >= sec - 0.12) {
                return;
            }
            const back = life > TN ? clamp((life - TN - 0.4) / 0.5, 0, 1) : 0; // 다 쏘고 제자리로
            const squeeze = life > TQ && life < TB ? s * 1.5 : 0; // 압축 — 움츠림
            const dig = life > TB && life < TN + 0.4 ? s * 1.5 : 0; // 발이 땅에 박힘
            const x = me.x + slideAt(Math.min(life, TN)) * (1 - back);
            drawLitMon(ctx, img, x, me.b + squeeze + dig, me.w, left, TIDE[2], edge, 1);
            const glow = clamp((life - TC0) / 1.5, 0, 1) * (life < TN + 0.3 ? 1 : 0);
            drawMon(ctx, img, x, me.b + squeeze + dig, me.w, left, glow * (0.12 + 0.1 * Math.sin(life * 18)), TIDE[1]);
        } });
        sc.at(sec - 0.12, () => hideMon(pokemon, false));
        sc.add({ max: sec, draw: muzzleBlast(cF) });

        // ① 기 모으기 — 대포 끝 물 구 · 물 소용돌이 고리 · 물웅덩이에서 빨려 오르는 물줄기 · 빨려 드는 물줄기와 물방울
        chargeSwirl(sc, () => [me.x, cyM], TC0, TQ, pullR, Ro * 2, TIDE, dir);
        const feeds = [-2.1, -1.3, 1.3, 2.1].map((f, i) => ({ x: me.x + f * me.w * 0.8, to: f < 0 ? cB : cF, seed: i }));
        sc.add({ max: TB + 0.1, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - TC0) / (TQ - TC0), 0, 1);
            const ramp = clamp((life - TC0) / 0.4, 0, 1) * clamp((TQ + 0.1 - life) / 0.15, 0, 1);
            if (ramp <= 0) {
                return;
            }
            ellipse(ctx, px, s, me.x, G, me.w * (1.2 + 1.2 * k), me.w * 0.16 * (1 + k), TIDE[3], 0.5 * ramp);
            ellipse(ctx, px, s, me.x, G, me.w * (0.8 + 0.8 * k) * (1 + 0.08 * Math.sin(life * 9)), me.w * 0.1 * (1 + k), TIDE[2], 0.7 * ramp);
            const streams = [new Path2D(), new Path2D()];
            const beads = new Path2D();
            for (const fd of feeds) {
                const pts = [];
                for (let j = 0; j <= 12; j++) {
                    const f = j / 12;
                    const sway = Math.sin(f * 5 + life * 6 + fd.seed) * me.w * 0.08 * Math.sin(f * Math.PI);
                    pts.push([lerp(fd.x, fd.to, f * f) + sway, lerp(G, cyM, Math.sqrt(f))]);
                }
                const grow = clamp((life - TC0 - 0.2 - fd.seed * 0.12) / 0.4, 0, 1);
                const n = Math.max(2, Math.round(pts.length * grow));
                addLine(streams[0], px, s, pts.slice(0, n), Math.max(2, (me.w * 0.1) / s) + 1);
                addLine(streams[1], px, s, pts.slice(0, n), Math.max(1, (me.w * 0.05) / s));
                for (let b = 0; b < 3; b++) {
                    const f = ((life * (1 + k) + b / 3 + fd.seed * 0.17) % 1) * (n - 1);
                    const p = pts[Math.floor(f)];
                    beads.rect(px(p[0] - s), px(p[1] - s), 2 * s, 2 * s);
                }
            }
            ctx.globalAlpha = 0.85 * ramp;
            ctx.fillStyle = TIDE[2];
            ctx.fill(streams[0]);
            ctx.fillStyle = TIDE[1];
            ctx.fill(streams[1]);
            ctx.fillStyle = '#ffffff';
            ctx.fill(beads);
            for (let j = 0; j < 3; j++) {
                const h = (life * 0.6 + j / 3) % 1;
                swirlRing(ctx, px, s, me.x, G - me.h * (0.1 + 1.0 * h), me.w * (1.1 - 0.35 * h) * (0.8 + 0.4 * k), 0.28, life, j % 2 ? dir : -dir, [TIDE[1], TIDE[2]], ramp * Math.sin(h * Math.PI));
            }
            const orb = (0.4 + 0.6 * k) * (1 + 0.15 * beatAt(life));
            for (const cx of [cB, cF]) {
                fireOrb(ctx, px, s, cx, cyM, Ro, TIDE, life + cx, orb * ramp, G, 0.95, 0, [1, 0.8, 0.6, 0.38], 0.3);
            }
            orbitEmbers(ctx, px, s, me.x, cyM, me.w * 0.8 * (1 + 0.1 * beatAt(life)), TIDE, life, dir, ramp * clamp((life - TC0 - 0.3) / 0.3, 0, 1));
        } });
        let drops = 0;
        sc.tick((t, dt) => {
            if (t < TC0 || t > TQ) {
                return;
            }
            drops += dt * 18;
            while (drops >= 1) {
                drops -= 1;
                splash(me.x + rnd(-1, 1) * me.w * 1.2, G - s, s, TIDE, 1, H * 0.4, { spread: 0.6, life: 0.7 });
            }
        });
        for (const tp of pulses) {
            sc.at(tp, () => {
                ring(sc, me.x, cyM, pullR * 0.6, me.w * 0.6, 1, 0.3, [TIDE[1], '#ffffff', TIDE[3]], 2);
                ultShake(1.5 + (tp - pulses[0]) * 1.5, 150);
            });
        }
        // ② 정적 — 화면이 거의 까매지고 대포만 빛남 · 집중선이 거북왕으로 빨려 듦 · 물 구가 꽉 압축되며 하얗게
        const focusX = me.x;
        const focusY = cyM;
        const rays = [];
        for (let i = 0; i < 64; i++) {
            rays.push({ a: (i / 64) * TAU + (hash(i, 101) - 0.5) * 0.08, len: 0.2 + 0.3 * hash(i, 102), sp: 0.8 + 0.6 * hash(i, 103), ph: hash(i, 105), w: hash(i, 104) > 0.6 ? 2 : 1 });
        }
        const farR = Math.hypot(Math.max(focusX, W - focusX), Math.max(focusY, H - focusY)) * 1.05;
        sc.add({ max: TB + 0.05, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = (life - TQ) / (TF - TQ);
            if (k < 0 || life > TF) {
                return;
            }
            const dark = clamp(k / 0.25, 0, 1);
            // 합동 줄기 보기 캔버스에 그릴 때는 화면 판 (어둠 · 집중선) 을 뺌 — 앞끝 · 계단으로 잘려 네모가 되던 것 (#80 다시 찍기, ult/bridge.js fxViewDrawing). 합동은 제 어둠이 있음
            if (typeof fxViewDrawing === 'undefined' || !fxViewDrawing) {
                ctx.globalAlpha = 0.78 * dark;
                ctx.fillStyle = '#05070c';
                ctx.fillRect(0, 0, W, H);
                const lines = [new Path2D(), new Path2D()];
                for (const r of rays) {
                    const head = farR * (0.9 - (((life - TQ) * r.sp * 2.2 + r.ph) % 1) * 0.75); // 바깥에서 가운데로 빨려 듦
                    const tail = head + farR * r.len;
                    const inner = Math.max(me.w * 1.4, head);
                    addLine(lines[r.w - 1], px, s, [[focusX + Math.cos(r.a) * inner, focusY + Math.sin(r.a) * inner], [focusX + Math.cos(r.a) * tail, focusY + Math.sin(r.a) * tail]], r.w);
                }
                ctx.globalAlpha = 0.75 * dark;
                ctx.fillStyle = '#ffffff';
                ctx.fill(lines[0]);
                ctx.fillStyle = TIDE[1];
                ctx.fill(lines[1]);
            }
            const press = 1 - 0.45 * easeIn(k);
            for (const cx of [cB, cF]) {
                fireOrb(ctx, px, s, cx, cyM, Ro, TIDE, life + cx, press * (1 + 0.1 * Math.sin(life * 50)), G, 1, 0, [1, 0.92, 0.84, 0.7], 0.2);
            }
        } });
        sc.at(TQ, () => ultShake(2, 400));
        // ③ 임팩트 프레임 — 하양 → 검정(거북왕과 대포 빛만 하얗게) 번쩍, 각 0.06초
        sc.add({ max: TB + 0.05, draw: (ctx, it, t, px) => {
            const life = sc.t;
            // 합동 줄기 보기 캔버스면 임팩트 프레임 (화면 전체 하양 · 검정) 을 뺌 — 계단으로 밀리던 것 · 합동 번쩍은 닿는 순간 한 번 (#80 다시 찍기)
            if (life < TF || life >= TB || (typeof fxViewDrawing !== 'undefined' && fxViewDrawing)) {
                return;
            }
            if (life < TF + 0.06) {
                ctx.globalAlpha = 0.92;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, W, H);
                return;
            }
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, W, H);
            drawMon(ctx, img, me.x, me.b, me.w, left, 1, '#ffffff');
            for (const cx of [cB, cF]) {
                ellipse(ctx, px, s, cx, cyM, Ro * 1.2, Ro * 1.2, '#ffffff', 1);
            }
        } });
        // 쏘는 순간 — 충격파 세 겹 · 물보라 원뿔 · 발밑 흙 · 큰 흔들림
        sc.at(TB, () => {
            ultShake(11, 650);
            splash(cF, yb, s, TIDE, 60, H * 1.0, { angle: -Math.PI / 2 - dir * 0.6, spread: 2.4 });
            debris(me.x, G - s, s, ['#6b5a3e', '#8a7350', '#4a4038'], 20, H * 0.6, { ground: G, angle: -Math.PI / 2, spread: 2.4 });
        });
        [0, 0.08, 0.16].forEach((dt, i) => sc.at(TB + dt, () => ring(sc, cF, yb, bw * 0.5, bw * (3 + i * 1.6), 1 - i * 0.2, 0.4, ['#ffffff', TIDE[1]], 3 - i)));
        // 쏘는 동안 — 물줄기에서 흩날리는 물보라 · 땅을 긁는 발밑 물보라 (출력 최대 때 더 많이)
        let skid = 0;
        let shed = 0;
        sc.tick((t, dt) => {
            if (t < TB || t > TN) {
                return;
            }
            const mk = mergeAt(t);
            skid += dt * 40 * (1 + mk);
            while (skid >= 1) {
                skid -= 1;
                splash(me.x + slideAt(t) - dir * me.w * 0.3, G - s, s, TIDE, 1, H * 0.5, { angle: -Math.PI / 2 - dir * 0.7, spread: 0.8, life: 0.6 });
            }
            shed += dt * 60 * (1 + mk);
            const len = reachAt(t);
            while (shed >= 1) {
                shed -= 1;
                const x = cF + slideAt(t) + dir * rnd(0.1, 1) * len;
                const y0 = centerAt(t, x);
                const half = widthAt(t) * (0.55 + 0.45 * mk) * lerp(1, 1, spreadAt(t, x)) * (mk > 0 ? lerp(clamp((me.h * 1.1) / (widthAt(t) * 2), 0.15, 1), 1, spreadAt(t, x)) : 1);
                const up = Math.random() < 0.5;
                splash(x, up ? y0 - half : Math.min(G - s, y0 + half), s, TIDE, 1, H * 0.45, { angle: up ? -Math.PI / 2 : -Math.PI / 2 + dir * 0.4, spread: 0.9, life: 0.6 });
            }
        });
        // 맞는 자리 — 왕관 물보라 · 거대한 물기둥 · 충격파 · 물방울
        const TX = TB + (TH - TB) * clamp(Math.abs(ix - cF) / blenF, 0, 1);
        sc.at(TX, () => {
            screenFlash(s, 0.3, TIDE[1], 0.12);
            ultShake(10, 800);
            ring(sc, ix, yb, bw * 0.6, Math.max(W, H) * 0.7, 0.6, 0.55, ['#ffffff', TIDE[1], TIDE[2]], 3);
            ring(sc, ix, G - s, bw * 0.5, bw * 5, 0.18, 0.5, [TIDE[1], '#ffffff'], 2);
            crownSplash(sc, ix, G, Math.min(G * 0.45, bw * 1.6), 1.0, TIDE);
            geyser(sc, ix, G, bw * 0.75, Math.min(G * 0.92, H * 0.75), TN - TX + 0.7, TIDE);
            splash(ix, yb, s, TIDE, 70, H * 1.2, { spread: 2.6 });
        });
        // 출력 최대 — 새 충격파 · 번쩍 · 큰 흔들림 · 맞는 자리에 더 큰 왕관 물보라
        sc.at(TMAX, () => {
            screenFlash(s, 0.35, '#ffffff', 0.12);
            ultShake(12, 900);
            const iyBig = yb + (ybBig - yb) * spreadAt(TMAX, ix);
            ring(sc, cF, yb, bw, bw * 6, 1, 0.45, ['#ffffff', TIDE[1], TIDE[2]], 3);
            ring(sc, ix, iyBig, bw, Math.max(W, H) * 0.8, 0.6, 0.6, ['#ffffff', TIDE[1]], 3);
            crownSplash(sc, ix, G, Math.min(G * 0.55, bw * 2.4), 1.2, TIDE);
            splash(ix, iyBig, s, TIDE, 90, H * 1.4, { spread: 2.6 });
        });
        let pulse = 0;
        let fount = 0;
        sc.tick((t, dt) => {
            if (t < TH || t > TN) {
                return;
            }
            const mk = mergeAt(t);
            pulse += dt;
            if (pulse >= 0.25 - 0.08 * mk) {
                pulse = 0;
                ring(sc, ix, centerAt(t, ix), bw * 0.5, bw * (2.5 + 1.5 * mk), 0.7, 0.3, [TIDE[1], '#ffffff'], 2);
                ultShake(4 + 3 * mk, 200);
            }
            fount += dt * 100 * (1 + mk);
            while (fount >= 1) {
                fount -= 1;
                splash(ix, centerAt(t, ix) - bw * 0.3, s, TIDE, 1, H * (1.2 + 0.3 * mk), { angle: -Math.PI / 2 - dir * 0.4, spread: 1.8 });
            }
            const band = bw * (0.7 + 0.6 * mk);
            for (const r of u.others()) {
                if ((r.x - cF) * dir > 0 && Math.abs(r.y - centerAt(t, r.x)) < band + r.h * 0.5) {
                    hit(r, dir, 'tumble');
                }
            }
        });
        // ④ 거대한 물 폭발 — 물줄기가 그치면 맞는 자리에서 물 구가 확 부풀어 터짐
        const boomR = Math.min(G * 0.7, Math.max(W * 0.22, bw * 3));
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const k = sc.t - TN;
            if (k < 0 || k > 0.7) {
                return;
            }
            const grow = easeOut(clamp(k / 0.3, 0, 1));
            fireOrb(ctx, px, s, ix, G - s, boomR, TIDE, sc.t, grow * (1 + 0.1 * k), G + s, 1, clamp((k - 0.25) / 0.45, 0, 1), [1, 0.86, 0.7, 0.5], 0.2);
        } });
        sc.at(TN, () => {
            screenFlash(s, 0.45, TIDE[0], 0.18);
            ultShake(12, 900);
            ring(sc, ix, G - boomR * 0.3, boomR * 0.3, Math.max(W, H) * 0.9, 0.7, 0.6, ['#ffffff', TIDE[1], TIDE[2]], 3);
            splash(ix, G - s, s, TIDE, 120, H * 1.5, { spread: 2.6, r: boomR * 0.3 });
            for (const r of u.others()) {
                if (Math.abs(r.x - ix) < boomR + r.w * 0.5) {
                    hit(r, Math.sign(r.x - ix) || dir, 'lift');
                }
            }
        });
        // ⑤ 높은 해일 두 겹 — 맞는 자리에서 양옆으로 밀려가 화면을 휩쓺 (물마루에서 물보라, 닿은 애 벌러덩)
        const waveH = Math.min(G * 0.62, Math.max(bw * 2.4, H * 0.42));
        const waveSp = W * 0.85;
        const waves = [{ t0: TW, h: 1 }, { t0: TW + 0.35, h: 0.65 }];
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            for (const wv of waves) {
                const k = life - wv.t0;
                if (k < 0 || k > 1.6) {
                    continue;
                }
                const up = easeOut(clamp(k / 0.25, 0, 1));
                const down = clamp((k - 1.0) / 0.6, 0, 1);
                for (const d of [-1, 1]) {
                    waveFront(ctx, px, s, ix + d * (boomR * 0.5 + waveSp * k), G, d, waveH * wv.h * up * (1 - 0.8 * down), waveH * 2.2 * wv.h, TIDE, life + d + wv.h, 1 - down);
                }
            }
        } });
        let crest = 0;
        sc.tick((t, dt) => {
            const k = t - TW;
            if (k < 0 || k > 1.1) {
                return;
            }
            crest += dt * 50;
            while (crest >= 1) {
                crest -= 1;
                const d = Math.random() < 0.5 ? -1 : 1;
                splash(ix + d * (boomR * 0.5 + waveSp * k), G - waveH * easeOut(clamp(k / 0.25, 0, 1)) * 0.95, s, TIDE, 1, H * 0.6, { angle: -Math.PI / 2 + d * 0.5, spread: 1, life: 0.7 });
            }
            for (const r of u.others()) {
                if (Math.abs(r.x - ix) < boomR * 0.5 + waveSp * k) {
                    hit(r, Math.sign(r.x - ix) || dir, 'tumble');
                }
            }
        });
        sc.at(TW, () => ultShake(8, 700));
        waterRain(sc, TW + 0.3, sec, TIDE);
        waterFireworks(sc, TW + 0.9, 4, W * 0.15, W * 0.85);
    }
    // 메가거북왕 — PMD SpriteCollab 에 몸 그림이 없어서(초상화만) 원래 그림(정면)을 1.3배로 키우고 대포를 그려 올림:
    // 등딱지 위 거대한 대포 하나(앞 위로 비스듬히, 끝에 굵은 포구) + 양팔 작은 대포. white 1 이면 하얀 실루엣, 0 ~ 1 이면 그만큼 하얗게.
    // 거대한 대포 포구 자리를 돌려줌 (.arm = 팔 대포 포구)
    function megaTurtle(ctx, px, s, img, x, b, w, left, dir, edge, white = 0, aim = -0.5) {
        const wM = w * 1.3;
        const solid = white >= 1;
        if (solid) {
            drawLitMon(ctx, img, x, b, wM, left, TIDE[2], edge, 1);
            drawMon(ctx, img, x, b, wM, left, 1, '#ffffff');
        } else {
            drawLitMon(ctx, img, x, b, wM, left, TIDE[3], edge, 1);
        }
        const cols = solid ? ['#ffffff', '#ffffff', '#ffffff', '#ffffff'] : GUNM;
        // 포신 — 둥근 받침 · 테두리 · 몸 · 밝은 줄 · 띠 두 줄 · 굵은 포구 · 검은 구멍
        const barrel = (x0, y0, ang, len, th) => {
            const ca = Math.cos(ang);
            const sa = Math.sin(ang);
            const x1 = x0 + ca * len;
            const y1 = y0 + sa * len;
            const nx = -sa;
            const ny = ca;
            const tc = Math.max(1, th / s);
            ellipse(ctx, px, s, x0, y0, th * 1.05, th * 0.75, cols[0], 1); // 받침
            ellipse(ctx, px, s, x0, y0 - s, th * 0.8, th * 0.5, cols[1], 1);
            const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D()];
            addLine(paths[0], px, s, [[x0, y0], [x1, y1]], tc + 2);
            addLine(paths[1], px, s, [[x0, y0], [x1, y1]], tc);
            addLine(paths[2], px, s, [[x0 + nx * th * 0.25 * -1, y0 - Math.abs(ny) * th * 0.25], [x1 + nx * th * 0.25 * -1, y1 - Math.abs(ny) * th * 0.25]], Math.max(1, tc * 0.3));
            for (const f of [0.35, 0.62]) {
                const bx = x0 + ca * len * f;
                const by = y0 + sa * len * f;
                addLine(paths[3], px, s, [[bx + nx * th * 0.55, by + ny * th * 0.55], [bx - nx * th * 0.55, by - ny * th * 0.55]], 1);
            }
            const mx0 = x1 - ca * th * 0.7;
            const my0 = y1 - sa * th * 0.7;
            addLine(paths[0], px, s, [[mx0, my0], [x1, y1]], tc * 1.6 + 2);
            addLine(paths[4], px, s, [[mx0, my0], [x1, y1]], tc * 1.6);
            fillPaths(ctx, paths, [cols[0], cols[1], cols[3], cols[0], cols[2]], 1);
            ellipse(ctx, px, s, x1, y1, th * 0.42, th * 0.42, cols[0], 1); // 구멍
            return [x1 + ca * th * 0.4, y1 + sa * th * 0.4];
        };
        // 양팔 대포
        const armMz = barrel(x - dir * wM * 0.05, b - wM * 0.33, dir > 0 ? 0 : Math.PI, wM * 0.32, wM * 0.07);
        // 등딱지 위 거대한 대포
        const ang = dir > 0 ? aim : Math.PI - aim;
        const m = barrel(x - dir * wM * 0.12, b - wM * 0.72, ang, wM * 0.6, wM * 0.15);
        if (!solid && white > 0) {
            drawMon(ctx, img, x, b, wM, left, white, '#ffffff');
        }
        m.arm = armMz;
        return m;
    }
    // 메가런처 — 물 구 안에서 1.5초 기 모으기(물줄기 · 물방울이 소용돌이치며 빨려 듦) → 진화 모션(하얀 실루엣이 거북왕 ↔ 메가거북왕으로 점점 빠르게)
    // → 펑! 메가거북왕 → 등의 거대한 대포를 치켜들고 포구에 1.6초 동안 거대한 물 구가 커짐(표면에 물살이 휘감아 돌고 도는 물 고리 · 빨려 드는 물줄기 · 두근두근)
    // — 그동안 팔 대포가 작은 물탄을 앞쪽 곳곳에 연달아 쏴 작은 물기둥이 터짐 → 대포가 과녁으로 내려와 쾅! 물 구 발사 (큰 반동으로 땅을 긁으며 밀림,
    // 나선 물살 · 물의파동 고리를 끌며 날아감) → 맞은 자리: 거대한 물 구가 확 부풀어 터짐 · 왕관 물보라 · 물기둥 셋 · 충격파 · 높은 해일 두 겹(물마루 물보라)
    // → 비 → 물 불꽃놀이 → 하얀 실루엣이 깜빡이며 원래 모습으로
    function runMegaLauncher(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const img = pokemon.el;
        const me = monBox(pokemon);
        const edge = Math.max(1, Math.round(u.s * 0.75));
        const left = dir < 0;
        const D = Math.min(Math.max(H / 3, short(u) * 0.4) * (0.9 + 0.2 * P), W * 0.42, H * 0.62);
        const TE = 1.5;
        const TM = 2.8;
        const TS = 4.5; // 발사
        const TFLY = 0.4;
        const TX = TS + TFLY; // 맞음
        const TBack = sec - 0.5;
        const Ro = Math.max(me.w, me.h) * 0.75;
        const cx = me.x;
        const cy = me.b - me.h * 0.45;
        const pullR = Math.max(Ro * 3.5, D * 1.1);
        const Rb = clamp(H * 0.13, me.w * 0.45, me.w * 1.1); // 발사할 물 구
        const q = nearest(u);
        const ahead = q && Math.sign(q.x - me.x) === dir && Math.abs(q.x - me.x) > me.w;
        const ix = clamp(ahead ? q.x : me.x + dir * W * 0.5, W * 0.08, W * 0.92);
        let mz = [cx + dir * me.w * 0.5, me.b - me.h * 1.1]; // 거대한 대포 포구 (그릴 때마다 갱신)
        let arm = [cx + dir * me.w * 0.5, me.b - me.h * 0.4]; // 팔 대포 포구
        const pulses = [0.7, 1.05, 1.35];
        const bpulses = [TM + 0.6, TM + 1.0, TM + 1.3, TM + 1.55];
        const beatAt = (t, list) => list.reduce((m, tp) => Math.max(m, clamp(1 - Math.abs(t - tp) / 0.1, 0, 1)), 0);
        const sc = scene(u, sec + 0.3, 'ultorb');
        ultDark(0.35, ms - 200);
        hideMon(pokemon, true);
        hideUntil(pokemon, ms + 100);
        const aimAng = clamp(Math.atan2(G - me.h * 0.3 - (me.b - me.h * 1.1), Math.abs(ix - cx)), -0.6, 0.15);
        const kickAt = (t) => (t > TS && t < TS + 0.9 ? -dir * s * 10 * Math.sin(Math.min(1, (t - TS) / 0.15) * Math.PI * 0.5) * (1 - clamp((t - TS - 0.3) / 0.6, 0, 1)) : 0);

        // 꼭두각시 · 물 구
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life >= TBack) {
                return;
            }
            if (life < TE + 0.25) {
                const k = easeOut(clamp((life - 0.1) / 0.3, 0, 1)) * (0.6 + 0.4 * clamp(life / TE, 0, 1)) * (1 + 0.15 * beatAt(life, pulses)) * (1 - clamp((life - TE) / 0.25, 0, 1));
                fireOrb(ctx, px, s, cx, cy, Ro, TIDE, life, k, G, 0.9, 0, [1, 0.8, 0.6, 0.38], 0.3);
                orbitEmbers(ctx, px, s, cx, cy, Ro * k * 1.3, TIDE, life, dir, clamp((life - 0.3) / 0.2, 0, 1) * (1 - clamp((life - TE) / 0.15, 0, 1)));
            }
            if (life < TE) {
                drawLitMon(ctx, img, cx, me.b, me.w, left, TIDE[2], edge, 1);
                drawMon(ctx, img, cx, me.b, me.w, left, clamp((life - 0.3) / 0.5, 0, 1) * (0.2 + 0.12 * Math.sin(life * 18)), TIDE[0]);
                return;
            }
            if (life < TM) {
                const k = (life - TE) / (TM - TE);
                const ramp = clamp(k / 0.15, 0, 1);
                const paths = [new Path2D(), new Path2D()];
                for (let i = 0; i < 12; i++) {
                    const a = (i / 12) * TAU + life * 0.9 * dir;
                    const L = pullR * (0.55 + 0.35 * Math.sin(life * 6 + i * 1.7)) * ramp;
                    addLine(paths[i % 2], px, s, [[cx + Math.cos(a) * Ro * 0.9, cy + Math.sin(a) * Ro * 0.9], [cx + Math.cos(a) * L, cy + Math.sin(a) * L]], i % 2 ? 1 : 2);
                }
                fillPaths(ctx, paths, ['#ffffff', TIDE[1]], 0.8 * ramp);
                fireOrb(ctx, px, s, cx, cy, Ro, GLOW, life, (0.6 + 0.5 * k) * ramp, G, 0.6);
                const flips = (life - TE) * (3 + 8.5 * k);
                const showMega = k > 0.9 || Math.floor(flips) % 2 === 1;
                const swell = 1.1 + (k > 0.9 ? 0.15 : 0.3 * Math.sin((flips % 1) * Math.PI));
                if (showMega) {
                    megaTurtle(ctx, px, s, img, cx, me.b, me.w * swell, left, dir, edge * 2, 1);
                } else {
                    drawLitMon(ctx, img, cx, me.b, me.w * swell, left, TIDE[1], edge * 2, 1);
                    drawMon(ctx, img, cx, me.b, me.w * swell, left, 1, '#ffffff');
                }
                return;
            }
            if (life > TBack - 0.4 && Math.floor((life - TBack + 0.4) / 0.06) % 2 === 1) {
                drawMon(ctx, img, cx, me.b, me.w, left, 1, '#ffffff');
                return;
            }
            const aim = lerp(-0.5, aimAng, easeOut(clamp((life - TS + 0.5) / 0.4, 0, 1))); // 모을 땐 치켜들고 쏘기 직전 과녁으로
            mz = megaTurtle(ctx, px, s, img, cx + kickAt(life), me.b, me.w, left, dir, edge, life > TBack - 0.4 ? 1 : clamp(1 - (life - TM) / 0.35, 0, 0.99), aim);
            arm = mz.arm || arm;
        } });
        // ① 기 모으기
        chargeSwirl(sc, () => [cx, cy], 0.2, TE, pullR, Ro, TIDE, dir);
        for (const tp of pulses) {
            sc.at(tp, () => {
                ring(sc, cx, cy, pullR * 0.6, Ro * 1.1, 1, 0.3, [TIDE[1], '#ffffff', TIDE[3]], 2);
                ultShake(1.5, 150);
            });
        }
        // ② 진화 모션
        sc.at(TE, () => {
            screenFlash(s, 0.25, '#ffffff', 0.15);
            ring(sc, cx, cy, Ro * 0.5, pullR, 1, 0.45, ['#ffffff', TIDE[0]], 2);
        });
        let glint = 0;
        sc.tick((t, dt) => {
            if (t < TE || t > TM) {
                return;
            }
            glint += dt * 14;
            while (glint >= 1) {
                glint -= 1;
                sparkles(cx, cy, s, ['#ffffff', TIDE[0], TIDE[1]], 1, Ro * 1.6, H * 0.15);
            }
        });
        sc.at(TM, () => {
            screenFlash(s, 0.6, '#ffffff', 0.3);
            ultShake(7, 450);
            ring(sc, cx, cy, Ro * 0.5, Math.max(W, H) * 0.6, 1, 0.5, ['#ffffff', TIDE[1], TIDE[2]], 3);
            splash(cx, cy, s, TIDE, 50, H * 0.9, { spread: TAU });
        });
        // ③ 메가런처 — 포구에 거대한 물 구 (표면 물살 · 도는 물 고리 · 빨려 드는 물줄기 · 두근두근)
        chargeSwirl(sc, () => mz, TM + 0.3, TS, pullR, Rb, TIDE, -dir);
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TM + 0.2 || life >= TS) {
                return;
            }
            const k = easeOut(clamp((life - TM - 0.2) / (TS - TM - 0.3), 0, 1));
            const r = Rb * (0.2 + 0.8 * k) * (1 + 0.12 * beatAt(life, bpulses));
            const [x, y] = mz;
            for (let j = 0; j < 3; j++) {
                swirlRing(ctx, px, s, x, y, r * (1.35 + 0.25 * j), [0.35, 0.6, 0.85][j], life + j, j % 2 ? dir : -dir, [TIDE[j % 2 ? 1 : 0], TIDE[2]], 0.9);
            }
            fireOrb(ctx, px, s, x, y, r, TIDE, life, 1, Infinity, 0.97, 0, [1, 0.82, 0.62, 0.4], 0.2);
            // 표면에 휘감아 도는 물살 — 하얀 곡선 두 줄
            const sw = new Path2D();
            for (let j = 0; j < 2; j++) {
                for (let i = 0; i < 14; i++) {
                    const a = (i / 14) * Math.PI + life * 5 * (j ? 1 : -1) + j * 1.5;
                    sw.rect(px(x + Math.cos(a) * r * 0.75), px(y + Math.sin(a) * r * 0.35 + (j ? -1 : 1) * r * 0.2 * Math.cos(a)), s, s);
                }
            }
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = '#ffffff';
            ctx.fill(sw);
        } });
        for (const tp of bpulses) {
            sc.at(tp, () => {
                const [x, y] = mz;
                ring(sc, x, y, pullR * 0.5, Rb, 1, 0.3, [TIDE[1], '#ffffff', TIDE[3]], 2);
                ultShake(1.5 + (tp - bpulses[0]) * 2.5, 150);
            });
        }
        // 팔 대포 연사 — 작은 물탄이 앞쪽 곳곳으로 날아가 작은 물기둥 · 합동에선 뺌 (상대 앞에 물기둥이 피해 1.4 ~ 2초 전에 서서 먼저 맞은 것처럼 보이던 것 — #80 UX)
        const bullets = [];
        const volley = !(typeof fxJointTop !== 'undefined' && fxJointTop);
        for (let i = 0; i < (volley ? 6 : 0); i++) {
            const f = (i + 0.5) / 6;
            const tx = clamp(me.x + dir * (me.w * 1.5 + (Math.abs(ix - me.x) + W * 0.15) * f) + (hash(i, 91) - 0.5) * W * 0.06, W * 0.04, W * 0.96);
            bullets.push({ t0: TM + 0.45 + i * 0.19, tx, x0: 0, y0: 0, on: false, done: false });
        }
        const bulletAt = (b, t) => {
            const k = clamp((t - b.t0) / 0.32, 0, 1);
            return [lerp(b.x0, b.tx, k), lerp(b.y0, G - s * 2, k) - Math.sin(k * Math.PI) * H * 0.06];
        };
        sc.tick((t) => {
            for (const b of bullets) {
                if (!b.on && t >= b.t0) {
                    b.on = true;
                    [b.x0, b.y0] = arm;
                    ring(sc, b.x0, b.y0, s * 2, Rb * 0.8, 1, 0.2, ['#ffffff', TIDE[1]], 1);
                    ultShake(2, 100);
                }
                if (b.on && !b.done && t >= b.t0 + 0.32) {
                    b.done = true;
                    geyser(sc, b.tx, G, Rb * 0.25, Math.min(G * 0.5, H * 0.3), 0.7, TIDE);
                    splash(b.tx, G - s, s, TIDE, 16, H * 0.7, { spread: 2 });
                    for (const r of u.others()) {
                        if (Math.abs(r.x - b.tx) < Rb * 0.8 + r.w * 0.5) {
                            hit(r, dir, 'lift');
                        }
                    }
                }
            }
        });
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            for (const b of bullets) {
                if (!b.on || b.done) {
                    continue;
                }
                const [x, y] = bulletAt(b, life);
                const [x2, y2] = bulletAt(b, Math.max(b.t0, life - 0.03));
                const dl = Math.hypot(x - x2, y - y2) || 1;
                fireTail(ctx, px, s, x, y, (x - x2) / dl, (y - y2) / dl, Rb * 1.4, Rb * 0.5, TIDE, life, 1);
            }
        } });
        // ④ 쾅! 발사 — 큰 반동 · 포구 물 폭발 · 물 구가 나선 물살과 물의파동 고리를 끌며 과녁 땅으로
        let shot = null;
        sc.at(TS, () => {
            screenFlash(s, 0.55, '#ffffff', 0.12);
            ultShake(11, 600);
            const [x, y] = mz;
            shot = { x0: x, y0: y };
            ring(sc, x, y, Rb * 0.5, Rb * 5, 1, 0.4, ['#ffffff', TIDE[1]], 3);
            ring(sc, x, y, Rb * 0.4, Rb * 3, 0.6, 0.3, [TIDE[1], '#ffffff'], 2);
            splash(x, y, s, TIDE, 50, H * 0.9, { angle: -Math.PI / 2 - dir * 0.8, spread: 2 });
        });
        let skid = 0;
        sc.tick((t, dt) => {
            if (t < TS || t > TS + 0.6) {
                return;
            }
            skid += dt * 60;
            while (skid >= 1) {
                skid -= 1;
                splash(cx + kickAt(t) - dir * me.w * 0.3, G - s, s, TIDE, 1, H * 0.5, { angle: -Math.PI / 2 - dir * 0.7, spread: 0.8, life: 0.6 });
            }
        });
        const shotAt = (t) => {
            const k = clamp((t - TS) / TFLY, 0, 1);
            const e = k * k * (3 - 2 * k);
            return [lerp(shot.x0, ix, e), lerp(shot.y0, G - Rb * 0.6, e) - Math.sin(k * Math.PI) * H * 0.08];
        };
        let ringT = 0;
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (!shot || life < TS || life >= TX) {
                return;
            }
            const [x, y] = shotAt(life);
            const [x2, y2] = shotAt(Math.max(TS, life - 0.03));
            const dl = Math.hypot(x - x2, y - y2) || 1;
            const ux = (x - x2) / dl;
            const uy = (y - y2) / dl;
            fireTail(ctx, px, s, x, y, ux, uy, Rb * 4.5, Rb * 1.8, TIDE, life, 1);
            // 나선 물살 — 꼬리를 감고 도는 하얀 · 물빛 점 두 줄
            const hx = new Path2D();
            for (let j = 0; j < 2; j++) {
                for (let i = 0; i < 18; i++) {
                    const d = (i / 18) * Rb * 5;
                    const off = Math.sin(i * 0.7 - life * 30 + j * Math.PI) * Rb * 0.9;
                    hx.rect(px(x - ux * d - uy * off), px(y - uy * d + ux * off), 2 * s, 2 * s);
                }
            }
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = '#ffffff';
            ctx.fill(hx);
            fireOrb(ctx, px, s, x, y, Rb, TIDE, life, 1 + 0.08 * Math.sin(life * 40), Infinity, 1, 0, [1, 0.82, 0.62, 0.4], 0.2);
        } });
        sc.tick((t, dt) => {
            if (!shot || t < TS || t >= TX) {
                return;
            }
            ringT += dt;
            if (ringT >= 0.06) {
                ringT = 0;
                const [x, y] = shotAt(t);
                ring(sc, x, y, Rb, Rb * 2.4, 1, 0.3, [TIDE[1], '#ffffff'], 1); // 물의파동 고리
            }
        });
        // ⑤ 맞음 — 거대한 물 구가 확 부풀어 터짐 · 왕관 물보라 · 물기둥 셋 · 충격파 · 높은 해일 두 겹
        const crownR = Math.min(G * 0.5, Math.max(D * 0.85, Rb * 3));
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const k = sc.t - TX;
            if (k < 0 || k > 0.6) {
                return;
            }
            const grow = easeOut(clamp(k / 0.25, 0, 1));
            fireOrb(ctx, px, s, ix, G - s, crownR * 1.3, TIDE, sc.t, grow * (1 + 0.1 * k), G + s, 1, clamp((k - 0.2) / 0.4, 0, 1), [1, 0.85, 0.68, 0.48], 0.2);
        } });
        sc.at(TX, () => {
            screenFlash(s, 0.6, TIDE[0], 0.22);
            ultShake(12, 900);
            crownSplash(sc, ix, G, crownR, 1.2, TIDE);
            geyser(sc, ix, G, crownR * 0.38, Math.min(G * 0.95, H * 0.85), 1.7, TIDE);
            ring(sc, ix, G - crownR * 0.3, crownR * 0.3, Math.max(W, H) * 0.85, 0.7, 0.6, ['#ffffff', TIDE[1], TIDE[2]], 3);
            ring(sc, ix, G - s, crownR * 0.4, Math.max(W, H), 0.16, 0.7, [TIDE[1], '#ffffff'], 2);
            splash(ix, G - s, s, TIDE, 110, H * 1.4, { spread: 2.6, r: crownR * 0.3 });
            for (const r of u.others()) {
                if (Math.abs(r.x - ix) < crownR * 1.3 + r.w * 0.5) {
                    hit(r, Math.sign(r.x - ix) || dir, 'lift');
                }
            }
        });
        for (const d of [-1, 1]) {
            sc.at(TX + 0.15, () => geyser(sc, clamp(ix + d * crownR * 1.15, W * 0.03, W * 0.97), G, crownR * 0.2, Math.min(G * 0.7, H * 0.5), 1.2, TIDE));
        }
        const waveH = Math.min(G * 0.6, Math.max(Rb * 2.8, H * 0.4));
        const waveSp = W * 0.85;
        const waves = [{ t0: TX + 0.35, h: 1 }, { t0: TX + 0.7, h: 0.65 }];
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            for (const wv of waves) {
                const k = life - wv.t0;
                if (k < 0 || k > 1.6) {
                    continue;
                }
                const up = easeOut(clamp(k / 0.25, 0, 1));
                const down = clamp((k - 1.0) / 0.6, 0, 1);
                for (const d of [-1, 1]) {
                    waveFront(ctx, px, s, ix + d * (crownR * 0.6 + waveSp * k), G, d, waveH * wv.h * up * (1 - 0.8 * down), waveH * 2.2 * wv.h, TIDE, life + d + wv.h, 1 - down);
                }
            }
        } });
        let crest = 0;
        sc.tick((t, dt) => {
            const k = t - waves[0].t0;
            if (k < 0 || k > 1.1) {
                return;
            }
            crest += dt * 50;
            while (crest >= 1) {
                crest -= 1;
                const d = Math.random() < 0.5 ? -1 : 1;
                splash(ix + d * (crownR * 0.6 + waveSp * k), G - waveH * easeOut(clamp(k / 0.25, 0, 1)) * 0.95, s, TIDE, 1, H * 0.6, { angle: -Math.PI / 2 + d * 0.5, spread: 1, life: 0.7 });
            }
            for (const r of u.others()) {
                if (Math.abs(r.x - ix) < crownR * 0.6 + waveSp * k) {
                    hit(r, Math.sign(r.x - ix) || dir, 'tumble');
                }
            }
        });
        waterRain(sc, TX + 0.6, sec, TIDE);
        waterFireworks(sc, TX + 1.4, 5, W * 0.12, W * 0.88);
        sc.at(TBack, () => {
            hideMon(pokemon, false);
            sparkles(cx, me.b - me.h * 0.5, s, ['#ffffff', TIDE[0], TIDE[1]], 16, me.w, H * 0.2);
            ring(sc, cx, me.b - me.h * 0.5, me.w * 0.4, me.w * 2.5, 0.8, 0.35, ['#ffffff', TIDE[1]], 2);
        });
    }

    // ═════ 뮤츠 — mewtwo: 사이코브레이크 (ultorb 위에 덮어씀) · 사이코키네시스 (ultpsy 위에 덮어씀, 메가뮤츠Y) — 아래 Object.assign ═════
    const MEWP = ['#ffffff', '#e8c8ff', '#a66bff', '#4b2390']; // 뮤츠 염력 (하양 → 연보라 → 보라 → 짙은 보라)
    // 염력에 들린 바위 — 울퉁불퉁한 돌덩이 (보랏빛 테두리가 빛남)
    function psyRock(ctx, px, s, x, y, z, glow, gc = MEWP[2]) {
        const r = [[-0.5, -0.35, 1, 0.75], [-0.35, -0.6, 0.65, 0.35], [-0.6, -0.1, 0.4, 0.4]];
        ctx.globalAlpha = 0.75 * glow;
        ctx.fillStyle = gc;
        for (const [a, b, w, h] of r) {
            ctx.fillRect(px(x + a * z - s), px(y + b * z - s), px(w * z) + 2 * s, px(h * z) + 2 * s);
        }
        ctx.globalAlpha = 1;
        r.forEach(([a, b, w, h], i) => {
            ctx.fillStyle = ROCK[i === 1 ? 2 : 1];
            ctx.fillRect(px(x + a * z), px(y + b * z), Math.max(s, px(w * z)), Math.max(s, px(h * z)));
        });
        ctx.fillStyle = ROCK[0];
        ctx.fillRect(px(x - 0.5 * z), px(y + 0.3 * z), Math.max(s, px(z)), s);
    }
    // 사이코브레이크 — 뮤츠가 떠올라 한 손에 2초 동안 보랏빛 염력을 모음 (뒤로 보랏빛 오라가 활활 · 둘레의 돌덩이들이 염력에 떠올라 맴돎 ·
    // 공기가 일그러지는 고리가 퍼짐 · 빨려 드는 염력 줄기) → 눈이 번뜩 → 거대한 염력 구를 던짐 (떠 있던 돌덩이들도 함께 날아감, 일그러짐 고리를 남기며)
    // → 맞은 자리: 한순간 안으로 빨려 들었다(내파) 공간이 일그러지는 대폭발 · 보랏빛 번개가 사방으로 · 충격파 세 겹 · 돌덩이가 사방으로 → 내려앉음.
    // 뮤츠는 진짜 그림을 숨기고 꼭두각시로 (정면 그림 — 손은 양옆, 아래에서 38% 높이)
    function runPsystrike(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const img = pokemon.el;
        const me = monBox(pokemon);
        const edge = Math.max(1, Math.round(u.s * 0.75));
        const left = dir < 0;
        const D = Math.min(Math.max(H / 3, short(u) * 0.4) * (0.9 + 0.2 * P), W * 0.42, H * 0.62);
        const lift = me.h * 0.3;
        const TC0 = 0.3;
        const TEYE = 2.4;
        const TT = 2.75; // 던짐
        const TFLY = 0.55;
        const TX = TT + TFLY; // 맞음 — 내파
        const TB = TX + 0.35; // 대폭발 (그 전 0.35초는 블랙홀처럼 빨려 듦)
        const DOME = 2.0;
        const TD = TB + DOME + 0.1; // 내려앉음
        const Ro = Math.max(s * 5, me.w * 0.38);
        const pullR = Math.max(Ro * 4, D * 1.1);
        const q = nearest(u);
        const ahead = q && Math.sign(q.x - me.x) === dir && Math.abs(q.x - me.x) > me.w;
        const ix = clamp(ahead ? q.x : me.x + dir * W * 0.5, W * 0.08, W * 0.92);
        const boomR = Math.min(G * 0.7, Math.max(D * 1.3, me.w * 3));
        const domeR = Math.min(Math.max(D * 1.5, me.w * 3.2), W * 0.5, G * 0.9); // 보랏빛 빛의 반구
        const iy = G - Math.min(boomR * 0.35, G * 0.3);
        const bob = (t) => Math.sin(t * 3) * s * 1.5;
        const footAt = (t) => {
            if (t < 0.4) {
                return me.b - lift * easeOut(t / 0.4);
            }
            if (t < TD) {
                return me.b - lift + bob(t);
            }
            return lerp(me.b - lift, me.b, easeIn(clamp((t - TD) / 0.4, 0, 1)));
        };
        const hand = (t) => [me.x + dir * me.w * 0.42, footAt(t) - me.h * 0.42];
        const sc = scene(u, sec + 0.3, 'ultorb');
        ultDark(0.4, ms - 200);
        hideMon(pokemon, true);
        hideUntil(pokemon, ms + 100);
        // 떠오르는 돌덩이
        const rocks = [];
        for (let i = 0; i < 14; i++) {
            const side = i % 2 ? -1 : 1;
            const x0 = clamp(me.x + side * (me.w * 0.8 + D * 1.2 * hash(i, 111)), W * 0.03, W * 0.97);
            rocks.push({ x0, t0: TC0 + 0.1 + i * 0.09, h: G * (0.2 + 0.35 * hash(i, 112)), z: Math.max(3 * s, me.w * (0.12 + 0.22 * hash(i, 113))), ph: hash(i, 114) * TAU, lt: TT + 0.05 + i * 0.025 });
        }
        const rockAt = (r, t) => {
            const up = easeOut(clamp((t - r.t0) / 0.6, 0, 1));
            const x = r.x0 + Math.sin(t * 1.5 + r.ph) * s * 3;
            const y = G - r.z * 0.3 - r.h * up + Math.sin(t * 2.4 + r.ph) * s * 2;
            if (t < r.lt) {
                return [x, y];
            }
            const k = clamp((t - r.lt) / 0.45, 0, 1);
            return [lerp(x, ix + (hash(r.ph, 1) - 0.5) * boomR * 0.4, k * k), lerp(y, iy, k * k)];
        };

        // 화면이 보랏빛으로 (모을수록 · 빨려 들 때 짙게)
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp((life - TC0) / 1.5, 0, 1) * 0.14 + (life > TX && life < TB ? 0.18 : 0);
            const fade = 1 - clamp((life - TB) / 0.3, 0, 1);
            if (a * fade > 0.01) {
                ctx.globalAlpha = a * fade;
                ctx.fillStyle = MEWP[3];
                ctx.fillRect(0, 0, W, H);
            }
        } });
        // 보랏빛 오라 · 돌덩이 (뮤츠 뒤)
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - TC0) / 0.5, 0, 1) * (1 - clamp((life - TD) / 0.4, 0, 1));
            if (k > 0.02) {
                flameTongue(ctx, px, s, me.x, footAt(life) + s * 2, me.w * 1.15, me.h * (1.5 + 0.2 * Math.sin(life * 4)), MEWP, life, k);
            }
            for (const r of rocks) {
                if (life < r.t0 || life > TX + 0.02) {
                    continue;
                }
                const [x, y] = rockAt(r, life);
                psyRock(ctx, px, s, x, y, r.z, 0.6 + 0.4 * Math.sin(life * 8 + r.ph));
            }
        } });
        // 뮤츠 (꼭두각시) — 떠서 살랑살랑, 던질 때 몸을 내뻗음
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life >= sec - 0.12) {
                return;
            }
            const push = life > TT - 0.1 && life < TT + 0.3 ? dir * s * 3 * Math.sin(((life - TT + 0.1) / 0.4) * Math.PI) : 0;
            drawLitMon(ctx, img, me.x + push, footAt(life), me.w, left, MEWP[2], edge, 1);
            const glow = clamp((life - TC0) / 1.5, 0, 1) * (life < TD ? 1 : 0);
            drawMon(ctx, img, me.x + push, footAt(life), me.w, left, glow * (0.15 + 0.1 * Math.sin(life * 18)), MEWP[1]);
            // 눈이 번뜩
            const eye = clamp(1 - Math.abs(life - TEYE - 0.12) / 0.15, 0, 1);
            if (eye > 0) {
                const ey = footAt(life) - me.h * 0.69;
                for (const sd of [-1, 1]) {
                    glint(ctx, px, s, me.x + sd * me.w * 0.07, ey, me.w * 0.25 * eye, eye);
                }
            }
        } });
        sc.at(sec - 0.12, () => hideMon(pokemon, false));
        // ① 기 모으기 — 손의 염력 구 · 빨려 드는 염력 줄기 · 일그러짐 고리
        chargeSwirl(sc, hand, TC0, TT - 0.1, pullR, Ro, MEWP, dir);
        sc.add({ max: TT + 0.05, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - TC0) / (TEYE - TC0), 0, 1);
            if (life < TC0) {
                return;
            }
            const [hx, hy] = hand(life);
            const beat = Math.max(0, Math.sin(life * 9)) ** 4;
            fireOrb(ctx, px, s, hx, hy, Ro, MEWP, life, (0.3 + 0.7 * k) * (1 + 0.12 * beat), G, 0.97, 0, [1, 0.8, 0.6, 0.38], 0.3);
            // 구 안 어두운 소용돌이
            const sw = new Path2D();
            for (let i = 0; i < 16; i++) {
                const a = (i / 16) * TAU + life * 6 * dir;
                const rr = Ro * (0.3 + 0.4 * k) * (0.5 + 0.5 * ((i % 4) / 3));
                sw.rect(px(hx + Math.cos(a) * rr), px(hy + Math.sin(a) * rr), s, s);
            }
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = MEWP[3];
            ctx.fill(sw);
            // 구에 지직거리는 하양 · 보라 전기 줄기 (0.05초마다 모양이 바뀜)
            const r0 = Ro * (0.3 + 0.7 * k);
            const seed = Math.floor(life * 20);
            for (let j = 0; j < 3; j++) {
                const a0 = hash(seed, j) * TAU;
                const pts = [];
                for (let q = 0; q <= 5; q++) {
                    const rr = r0 * (0.6 + 0.9 * (q / 5));
                    const aa = a0 + (hash(seed + q, j + 7) - 0.5) * 0.9;
                    pts.push([hx + Math.cos(aa) * rr, hy + Math.sin(aa) * rr]);
                }
                drawBolt(ctx, px, s, pts, 1, MEWP[0], MEWP[2], 0.9 * k);
            }
        } });
        let warp = 0;
        sc.tick((t, dt) => {
            if (t < TC0 + 0.3 || t > TT) {
                return;
            }
            warp += dt;
            if (warp >= 0.42) {
                warp = 0;
                ring(sc, me.x, footAt(t) - me.h * 0.5, me.w * 0.6, pullR * 1.2, 0.85, 0.6, [MEWP[1], MEWP[2]], 1); // 일그러짐 고리
                ultShake(1.5, 150);
            }
        });
        let zap = 0;
        sc.tick((t, dt) => {
            if (t < TC0 + 0.3 || t > TT) {
                return;
            }
            zap += dt;
            if (zap >= 0.11) {
                zap = 0;
                const [hx, hy] = Math.random() < 0.5 ? hand(t) : [me.x, footAt(t) - me.h * 0.5];
                const a = rnd(0, TAU);
                const L = me.w * rnd(0.8, 1.6);
                strike(sc, hx, hy, hx + Math.cos(a) * L, Math.min(G, hy + Math.sin(a) * L), { mid: MEWP[0], glow: MEWP[2], dur: 0.16, branches: 1, w: 1 }); // 둘레에 튀는 보랏빛 번개
            }
        });
        for (const r of rocks) {
            sc.at(r.t0, () => debris(r.x0, G - s, s, ['#6b5a3e', '#8a7350', '#4a4038'], 5, H * 0.3, { ground: G, angle: -Math.PI / 2, spread: 1.6 }));
        }
        // ② 눈이 번뜩 → 던짐
        sc.at(TEYE, () => {
            screenFlash(s, 0.25, MEWP[1], 0.12);
            ultShake(4, 300);
        });
        sc.at(TT, () => {
            ultShake(7, 400);
            const [hx, hy] = hand(TT);
            ring(sc, hx, hy, Ro * 0.6, Ro * 4, 1, 0.35, ['#ffffff', MEWP[1]], 3);
        });
        const shotAt = (t) => {
            const [hx, hy] = hand(TT);
            const k = clamp((t - TT) / TFLY, 0, 1);
            const e = k * k * (3 - 2 * k);
            return [lerp(hx, ix, e), lerp(hy, iy, e) - Math.sin(k * Math.PI) * H * 0.06];
        };
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TT || life >= TB) {
                return;
            }
            const [x, y] = shotAt(life);
            const [x2, y2] = shotAt(Math.max(TT, life - 0.03));
            const dl = Math.hypot(x - x2, y - y2) || 1;
            const implode = life > TX ? 1 - 0.6 * easeIn((life - TX) / (TB - TX)) : 1; // 내파 — 안으로 빨려 듦
            if (life < TX) {
                fireTail(ctx, px, s, x, y, (x - x2) / dl, (y - y2) / dl, Ro * 4, Ro * 1.6, MEWP, life, 1);
            }
            fireOrb(ctx, px, s, x, y, Ro * 1.4, MEWP, life, implode * (1 + 0.08 * Math.sin(life * 40)), G, 1, 0, [1, 0.8, 0.6, 0.38], 0.2);
            for (const r of rocks) {
                if (life >= r.lt && life < TX) {
                    const [rx, ry] = rockAt(r, life);
                    psyRock(ctx, px, s, rx, ry, r.z, 1);
                }
            }
        } });
        let trail = 0;
        sc.tick((t, dt) => {
            if (t < TT || t >= TX) {
                return;
            }
            trail += dt;
            if (trail >= 0.06) {
                trail = 0;
                const [x, y] = shotAt(t);
                ring(sc, x, y, Ro, Ro * 2.6, 1, 0.3, [MEWP[1], MEWP[2]], 1);
            }
        });
        // 내파 — 빛가루가 안으로 빨려 듦
        sc.at(TX, () => {
            ultShake(3, 200);
            for (let j = 0; j < 30 && room(); j++) {
                const a = rnd(0, TAU);
                const r0 = boomR * rnd(0.6, 1.1);
                sigParticle({ x: ix, y: iy, s, max: TB - TX + 0.02, a0: a, r0, color: pick(MEWP), size: pick([1, 2]),
                    update: (p) => {
                        const e = (p.life / p.max) ** 2;
                        p.x = ix + Math.cos(p.a0) * p.r0 * (1 - e);
                        p.y = iy + Math.sin(p.a0) * p.r0 * (1 - e);
                    },
                    draw: DRAW.dot });
            }
        });
        // 블랙홀 — 맞은 자리가 검게 빨려 듦 (어두운 구 · 도는 보랏빛 고리)
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const k = (sc.t - TX) / (TB - TX);
            if (k < 0 || k > 1) {
                return;
            }
            const r = boomR * 0.28 * Math.sin(Math.min(1, k * 1.2) * Math.PI * 0.5) * (1 - easeIn(clamp((k - 0.8) / 0.2, 0, 1)));
            for (let j = 0; j < 3; j++) {
                swirlRing(ctx, px, s, ix, iy, r * (1.4 + 0.4 * j) + s * 2, 0.45, sc.t + j, j % 2 ? dir : -dir, [MEWP[1], MEWP[2]], 0.9);
            }
            ellipse(ctx, px, s, ix, iy, r * 1.1, r * 1.1, MEWP[3], 1);
            ellipse(ctx, px, s, ix, iy, r * 0.85, r * 0.85, '#0c0414', 1);
        } });
        // ③ 대폭발 — 보랏빛 빛의 반구(blastDome) · 공간이 일그러지는 줄 · 보랏빛 번개 · 충격파 세 겹 · 돌덩이
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const k = sc.t - TB;
            if (k < 0 || k > 0.9) {
                return;
            }
            // 일그러짐 — 가로로 어긋난 보랏빛 줄들이 깜빡
            if (k < 0.5) {
                const lines = new Path2D();
                for (let i = 0; i < 10; i++) {
                    const y = iy - boomR * (0.9 - i * 0.2) + Math.sin(sc.t * 40 + i) * s * 2;
                    const L = boomR * (0.6 + 0.6 * hash(i, Math.floor(sc.t * 20)));
                    lines.rect(px(ix - L + Math.sin(sc.t * 30 + i * 2) * boomR * 0.2), px(y), px(L * 2), s);
                }
                ctx.globalAlpha = 0.5 * (1 - k / 0.5);
                ctx.fillStyle = MEWP[1];
                ctx.fill(lines);
            }
        } });
        sc.at(TB, () => {
            screenFlash(s, 0.8, '#ffffff', 0.14);
            ultShake(12, 1000);
            blastDome(sc, ix, G, domeR, DOME, MEWP);
            ring(sc, ix, G - s, boomR * 0.4, Math.max(W, H), 0.16, 0.7, [MEWP[1], '#ffffff'], 2);
            for (let i = 0; i < 10; i++) {
                const a = -Math.PI + ((i + 0.5) / 10) * Math.PI + rnd(-0.15, 0.15);
                const L = domeR * rnd(1.0, 1.6);
                strike(sc, ix, G - domeR * 0.3, ix + Math.cos(a) * L, Math.min(G, G - domeR * 0.3 + Math.sin(a) * L), { mid: MEWP[0], glow: MEWP[2], dur: 0.5, branches: 2, w: 2 });
            }
            debris(ix, G - s, s, ROCK, 40, H * 1.3, { ground: G, size: [2, 2, 3], angle: -Math.PI / 2, spread: 2.6 });
            fireBits(ix, iy, s, MEWP, 70, { spread: TAU, speed: H * 1.2, drag: 2, life: 0.9 });
            for (const r of u.others()) {
                if (Math.abs(r.x - ix) < boomR + r.w * 0.5) {
                    hit(r, Math.sign(r.x - ix) || dir, 'lift');
                }
            }
        });
        sc.at(TB + 0.12, () => screenFlash(s, 0.4, MEWP[2], 0.25));
        [0, 0.1, 0.2].forEach((dt, i) => sc.at(TB + dt, () => ring(sc, ix, iy, boomR * 0.3, Math.max(W, H) * (0.6 + 0.2 * i), 0.75, 0.6, ['#ffffff', MEWP[1], MEWP[2]], 3 - i)));
        // 남은 보랏빛 반짝이 · 내려앉음
        let glim = 0;
        sc.tick((t, dt) => {
            if (t < TB + 0.4 || t > TD + 0.6) {
                return;
            }
            glim += dt * 20;
            while (glim >= 1) {
                glim -= 1;
                sparkles(ix + rnd(-1, 1) * domeR, G - rnd(0, domeR), s, ['#ffffff', MEWP[1], MEWP[2]], 1, s * 2, H * 0.15);
            }
        });
        sc.at(TD + 0.4, () => ring(sc, me.x, me.b - s, me.w * 0.4, me.w * 2.5, 0.2, 0.4, [MEWP[1], '#ffffff'], 2));
    }

    // 사이코키네시스 (메가뮤츠Y) — 떠올라 보랏빛 염력 구 안에서 1.5초 기 모으기 → 진화 모션(하얀 실루엣이 뮤츠 ↔ 메가뮤츠Y 로 점점 빠르게)
    // → 펑! 메가뮤츠Y (진짜 그림은 숨기고 같은 폴더의 megay 그림 — add-form.py · PMD SpriteCollab) → 화면의 다른 포켓몬들이 보랏빛 오라에 감싸여
    // 전부 떠오르고(돌덩이도) 메가뮤츠Y 둘레를 소용돌이치며 돎(점점 빨라짐 · 보랏빛 꼬리) → 꼭대기에서 멈칫 · 눈이 번뜩 → 손을 내리치면 한꺼번에 땅에 내리꽂힘
    // → 떨어진 자리마다 충격파 · 거대한 염력 충격파 · 땅이 갈라짐 → 하얀 실루엣이 깜빡이며 원래 모습으로.
    // 다른 포켓몬도 진짜 그림을 잠깐 숨기고 꼭두각시로 띄움 (원래 자리에 내리꽂힌 뒤 다시 보이고 벌러덩)
    function runPsychokinesis(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const img = pokemon.el;
        const me = monBox(pokemon);
        const edge = Math.max(1, Math.round(u.s * 0.75));
        const left = dir < 0;
        const D = Math.min(Math.max(H / 3, short(u) * 0.4) * (0.9 + 0.2 * P), W * 0.42, H * 0.62);
        const mega = new Image();
        mega.src = (img.src || '').replace(/[^/]+\.gif(\?.*)?$/, 'megay_idle_8fps.gif');
        const megaReady = () => mega.complete && mega.naturalWidth > 0;
        const megaImg = () => (megaReady() ? mega : img);
        const megaW = () => (megaReady() ? mega.naturalWidth * u.s : me.w);
        const megaLeft = () => (megaReady() ? false : left);
        const TE = 1.5;
        const TM = 2.8;
        const TL1 = 3.1; // 떠오르기 시작
        const TO1 = TL1 + 0.6; // 돌기 시작
        const TS = TO1 + 1.5; // 꼭대기에서 멈칫
        const TSL = TS + 0.3; // 내리치기
        const TI = TSL + 0.2; // 땅에 닿음
        const TBack = sec - 0.5;
        const lift = me.h * 0.35;
        const Ro = Math.max(me.w, me.h) * 0.75;
        const pullR = Math.max(Ro * 3.5, D * 1.1);
        const bob = (t) => Math.sin(t * 3) * s * 1.5;
        const footAt = (t) => {
            const up = t < 0.4 ? easeOut(t / 0.4) : 1;
            const high = t > TL1 && t < TSL ? easeOut(clamp((t - TL1) / 0.6, 0, 1)) * me.h * 0.25 : t >= TSL && t < TI + 0.3 ? me.h * 0.25 * (1 - clamp((t - TSL) / 0.3, 0, 1)) : 0;
            const down = t > TBack - 0.6 ? easeIn(clamp((t - TBack + 0.6) / 0.4, 0, 1)) : 0;
            return me.b - (lift * up + high) * (1 - down) + bob(t) * (1 - down);
        };
        const cy = (t) => footAt(t) - me.h * 0.5;
        const ocx = me.x;
        const ocy = Math.max(H * 0.18, G - me.h * 1.4 - D * 0.35); // 소용돌이 가운데
        const orx = Math.min(W * 0.42, Math.max(D * 1.3, me.w * 3));
        const ory = Math.min(orx * 0.32, (G - me.h) * 0.4);
        const sc = scene(u, sec + 0.3, 'ultpsy');
        ultDark(0.4, ms - 200);
        hideMon(pokemon, true);
        hideUntil(pokemon, ms + 100);
        // 띄울 포켓몬 — 지금 자리 · 크기 · 보는 쪽을 잡아 둠
        const lifted = u.others().map((r, i) => {
            const box = monBox(r.pokemon);
            return { r, img: r.pokemon.el, x: box.x, b: box.b, w: box.w, h: box.h, left: shownLeft(r.pokemon.el), a0: (i / Math.max(1, u.others().length)) * TAU + 0.3, t0: TL1 + i * 0.07 };
        });
        // 돌덩이 — 늘 함께 떠서 안쪽 고리를 돎
        const rocks = [];
        for (let i = 0; i < (lifted.length ? 8 : 14); i++) {
            const x0 = clamp(me.x + (hash(i, 121) - 0.5) * W * 0.8, W * 0.03, W * 0.97);
            rocks.push({ x0, z: Math.max(3 * s, me.w * (0.12 + 0.12 * hash(i, 122))), a0: hash(i, 123) * TAU, t0: TL1 + 0.05 * i, rr: 0.55 + 0.25 * hash(i, 124) });
        }
        const spinAt = (t) => {
            const k = clamp((t - TO1) / (TS - TO1), 0, 1);
            return (t - TO1 > 0 ? (t - TO1) * (1.4 + 1.8 * k) : 0) * dir; // 점점 빨라짐
        };
        // 꼭두각시 자리 [x, 발 높이] — 떠오름 → 돎 → 멈칫(조금 더 위) → 원래 자리로 내리꽂힘
        const liftAt = (L, t, rx = orx, ry = ory, homeX = L.x, homeB = L.b, h = L.h) => {
            const a = L.a0 + spinAt(t);
            const ox = ocx + Math.cos(a) * rx;
            const oy = ocy + Math.sin(a) * ry + h * 0.5;
            if (t < L.t0) {
                return [homeX, homeB];
            }
            if (t < TO1) {
                const k = easeOut(clamp((t - L.t0) / (TO1 - L.t0), 0, 1));
                return [lerp(homeX, ox, k), lerp(homeB, oy, k) + Math.sin(t * 8) * s];
            }
            if (t < TS) {
                return [ox, oy];
            }
            const aS = L.a0 + spinAt(TS);
            const sx = ocx + Math.cos(aS) * rx;
            const sy = ocy + Math.sin(aS) * ry + h * 0.5 - H * 0.05 * easeOut(clamp((t - TS) / 0.3, 0, 1));
            if (t < TSL) {
                return [sx, sy];
            }
            const k = easeIn(clamp((t - TSL) / (TI - TSL), 0, 1));
            return [lerp(sx, homeX, k), lerp(sy, homeB, k)];
        };
        const beatAt = (t, list) => list.reduce((m, tp) => Math.max(m, clamp(1 - Math.abs(t - tp) / 0.1, 0, 1)), 0);
        const pulses = [0.7, 1.05, 1.35];
        // 화면이 보랏빛으로 (띄우고 돌릴 때 짙게)
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = 0.08 * clamp(life / 1, 0, 1) + 0.12 * clamp((life - TL1) / 0.5, 0, 1) * (1 - clamp((life - TI) / 0.5, 0, 1));
            if (a > 0.01) {
                ctx.globalAlpha = a;
                ctx.fillStyle = MEWP[3];
                ctx.fillRect(0, 0, W, H);
            }
        } });

        // 보랏빛 꼬리 · 돌덩이 · 떠오른 포켓몬들 (메가뮤츠Y 뒤)
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TL1 || life > TI + 0.05) {
                return;
            }
            const tails = new Path2D();
            for (const L of lifted) {
                if (life < TO1) {
                    continue;
                }
                for (let j = 1; j < 8; j++) {
                    const [x, b] = liftAt(L, Math.max(TO1, life - j * 0.03));
                    tails.rect(px(x - s), px(b - L.h * 0.5 - s), 2 * s, 2 * s);
                }
            }
            ctx.globalAlpha = 0.6;
            ctx.fillStyle = MEWP[2];
            ctx.fill(tails);
            // 두꺼운 보랏빛 염력 소용돌이 띠 — 도는 길을 따라
            const vk = clamp((life - TO1 + 0.3) / 0.4, 0, 1) * (1 - clamp((life - TS) / 0.3, 0, 1));
            for (let j = 0; j < 3; j++) {
                swirlRing(ctx, px, s, ocx, ocy, orx * (0.92 + 0.08 * j), ory / orx, life * (1 + 0.3 * j) + j, dir, [j === 1 ? '#ffffff' : MEWP[1], MEWP[2]], 0.85 * vk);
            }
            // 염력 사슬 — 메가뮤츠Y 손에서 띄운 애들로 지직거리는 보랏빛 번개 (0.06초마다 모양이 바뀜)
            if (life < TSL) {
                const w = megaW();
                const hx = me.x + dir * w * 0.3;
                const hy = footAt(life) - w * 0.55;
                const seed = Math.floor(life / 0.06);
                lifted.forEach((L, i) => {
                    const [x, b] = liftAt(L, life);
                    const tx = x;
                    const ty = b - L.h * 0.5;
                    const pts = [[hx, hy]];
                    for (let q = 1; q < 6; q++) {
                        const f = q / 6;
                        const off = (hash(seed + i * 13, q) - 0.5) * Math.hypot(tx - hx, ty - hy) * 0.18;
                        pts.push([lerp(hx, tx, f) - (ty - hy) / (Math.hypot(tx - hx, ty - hy) || 1) * off, lerp(hy, ty, f) + (tx - hx) / (Math.hypot(tx - hx, ty - hy) || 1) * off]);
                    }
                    pts.push([tx, ty]);
                    drawBolt(ctx, px, s, pts, 1, MEWP[0], MEWP[2], 0.8 * clamp((life - L.t0) / 0.2, 0, 1));
                });
            }
            for (const R of rocks) {
                const RL = { x: R.x0, b: G, h: R.z, a0: R.a0, t0: R.t0 };
                const [x, b] = liftAt(RL, life, orx * R.rr, ory * R.rr);
                psyRock(ctx, px, s, x, b - R.z * 0.5, R.z, 0.6 + 0.4 * Math.sin(life * 8 + R.a0));
            }
            for (const L of lifted) {
                const [x, b] = liftAt(L, life);
                drawLitMon(ctx, L.img, x, b, L.w, L.left, MEWP[2], edge, 1);
                drawMon(ctx, L.img, x, b, L.w, L.left, 0.25 + 0.1 * Math.sin(life * 14), MEWP[1]);
            }
        } });
        // 메가뮤츠Y (꼭두각시) · 진화 모션
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life >= TBack) {
                return;
            }
            const c = cy(life);
            if (life < TE + 0.25) {
                const k = easeOut(clamp((life - 0.1) / 0.3, 0, 1)) * (0.6 + 0.4 * clamp(life / TE, 0, 1)) * (1 + 0.15 * beatAt(life, pulses)) * (1 - clamp((life - TE) / 0.25, 0, 1));
                fireOrb(ctx, px, s, me.x, c, Ro, MEWP, life, k, G, 0.9, 0, [1, 0.8, 0.6, 0.38], 0.3);
                orbitEmbers(ctx, px, s, me.x, c, Ro * k * 1.3, MEWP, life, dir, clamp((life - 0.3) / 0.2, 0, 1) * (1 - clamp((life - TE) / 0.15, 0, 1)));
            }
            if (life < TE) {
                drawLitMon(ctx, img, me.x, footAt(life), me.w, left, MEWP[2], edge, 1);
                drawMon(ctx, img, me.x, footAt(life), me.w, left, clamp((life - 0.3) / 0.5, 0, 1) * (0.2 + 0.12 * Math.sin(life * 18)), MEWP[0]);
                return;
            }
            if (life < TM) {
                const k = (life - TE) / (TM - TE);
                const ramp = clamp(k / 0.15, 0, 1);
                const paths = [new Path2D(), new Path2D()];
                for (let i = 0; i < 12; i++) {
                    const a = (i / 12) * TAU + life * 0.9 * dir;
                    const L = pullR * (0.55 + 0.35 * Math.sin(life * 6 + i * 1.7)) * ramp;
                    addLine(paths[i % 2], px, s, [[me.x + Math.cos(a) * Ro * 0.9, c + Math.sin(a) * Ro * 0.9], [me.x + Math.cos(a) * L, c + Math.sin(a) * L]], i % 2 ? 1 : 2);
                }
                fillPaths(ctx, paths, ['#ffffff', MEWP[1]], 0.8 * ramp);
                fireOrb(ctx, px, s, me.x, c, Ro, GLOW, life, (0.6 + 0.5 * k) * ramp, G, 0.6);
                const flips = (life - TE) * (3 + 8.5 * k);
                const showMega = megaReady() && (k > 0.9 || Math.floor(flips) % 2 === 1);
                const im = showMega ? mega : img;
                const swell = 1.1 + (k > 0.9 ? 0.15 : 0.3 * Math.sin((flips % 1) * Math.PI));
                const w = (showMega ? megaW() : me.w) * swell;
                const lf = showMega ? false : left;
                const fb = c + (showMega ? megaW() : me.h) * swell * 0.5;
                drawLitMon(ctx, im, me.x, fb, w, lf, showMega ? MEWP[2] : MEWP[1], edge * 2, 1);
                drawMon(ctx, im, me.x, fb, w, lf, 1, '#ffffff');
                return;
            }
            if (life > TBack - 0.4 && Math.floor((life - TBack + 0.4) / 0.06) % 2 === 1) {
                drawMon(ctx, img, me.x, footAt(life), me.w, left, 1, '#ffffff');
                return;
            }
            const w = megaW();
            const b = footAt(life);
            // 뒤로 보랏빛 오라 (돌릴 때 · 내리칠 때 크게)
            const big = life > TL1 && life < TI + 0.3 ? 1.3 : 1;
            flameTongue(ctx, px, s, me.x, b + s * 2, w * 1.0 * big, w * 1.35 * big, MEWP, life, clamp((life - TM) / 0.3, 0, 1));
            drawLitMon(ctx, megaImg(), me.x, b, w, megaLeft(), MEWP[2], edge, 1);
            const appear = clamp(1 - (life - TM) / 0.35, 0, 1);
            if (appear > 0) {
                drawMon(ctx, megaImg(), me.x, b, w, megaLeft(), appear, '#ffffff');
            }
            const eye = clamp(1 - Math.abs(life - TS - 0.15) / 0.15, 0, 1); // 눈이 번뜩
            if (eye > 0) {
                glint(ctx, px, s, me.x, b - w * 0.7, w * 0.35 * eye, eye);
            }
        } });
        // ① 기 모으기 · ② 진화 모션
        chargeSwirl(sc, (t) => [me.x, cy(t)], 0.2, TE, pullR, Ro, MEWP, dir);
        for (const tp of pulses) {
            sc.at(tp, () => {
                ring(sc, me.x, cy(tp), pullR * 0.6, Ro * 1.1, 1, 0.3, [MEWP[1], '#ffffff', MEWP[3]], 2);
                ultShake(1.5, 150);
            });
        }
        sc.at(TE, () => {
            screenFlash(s, 0.25, '#ffffff', 0.15);
            ring(sc, me.x, cy(TE), Ro * 0.5, pullR, 1, 0.45, ['#ffffff', MEWP[0]], 2);
        });
        let glintT = 0;
        sc.tick((t, dt) => {
            if (t < TE || t > TM) {
                return;
            }
            glintT += dt * 14;
            while (glintT >= 1) {
                glintT -= 1;
                sparkles(me.x, cy(t), s, ['#ffffff', MEWP[0], MEWP[1]], 1, Ro * 1.6, H * 0.15);
            }
        });
        sc.at(TM, () => {
            screenFlash(s, 0.6, '#ffffff', 0.3);
            ultShake(7, 450);
            ring(sc, me.x, cy(TM), Ro * 0.5, Math.max(W, H) * 0.6, 1, 0.5, ['#ffffff', MEWP[1], MEWP[2]], 3);
            fireBits(me.x, cy(TM), s, MEWP, 50, { spread: TAU, speed: H * 0.9, drag: 2.4, life: 0.8 });
        });
        // ③ 염력으로 띄움 — 다른 포켓몬 숨기고 꼭두각시로 · 발밑에서 흙 · 보랏빛 오라 고리
        sc.at(TL1, () => {
            ultShake(5, 500);
            ring(sc, me.x, cy(TL1), Ro, Math.max(W, H) * 0.7, 0.6, 0.6, [MEWP[1], MEWP[2]], 2);
            for (const L of lifted) {
                hideMon(L.r.pokemon, true);
                hideUntil(L.r.pokemon, ms + 100);
            }
        });
        for (const L of lifted) {
            sc.at(L.t0, () => {
                ring(sc, L.x, L.b - s, L.w * 0.4, L.w * 1.6, 0.25, 0.35, [MEWP[1], '#ffffff'], 1);
                debris(L.x, L.b - s, s, ['#6b5a3e', '#8a7350'], 8, H * 0.4, { ground: G, angle: -Math.PI / 2, spread: 1.4 });
            });
        }
        let warp = 0;
        sc.tick((t, dt) => {
            if (t < TO1 || t > TSL) {
                return;
            }
            warp += dt;
            if (warp >= 0.3) {
                warp = 0;
                ring(sc, ocx, ocy, orx * 0.3, orx * 1.2, 0.35, 0.45, [MEWP[1], MEWP[2]], 1); // 소용돌이 일그러짐
                ultShake(2, 150);
            }
        });
        // ④ 멈칫 → 내리치기 → 땅에 닿음 (떨어진 자리마다 충격파 · 거대한 염력 충격파 · 갈라진 땅)
        sc.at(TS, () => {
            screenFlash(s, 0.2, MEWP[1], 0.12);
            ultShake(3, 250);
        });
        sc.at(TSL, () => ultShake(6, 250));
        sc.at(TI, () => {
            screenFlash(s, 0.65, '#ffffff', 0.15);
            ultShake(12, 900);
            ring(sc, me.x, G - s, me.w, Math.max(W, H), 0.18, 0.7, ['#ffffff', MEWP[1], MEWP[2]], 3);
            ring(sc, me.x, cy(TI), me.w, Math.max(W, H) * 0.9, 0.7, 0.6, [MEWP[1], MEWP[2]], 2);
            for (const L of lifted) {
                hideMon(L.r.pokemon, false);
                ultHit(L.r, Math.sign(L.x - me.x) || dir, 'tumble');
                ring(sc, L.x, G - s, L.w * 0.5, L.w * 3, 0.2, 0.45, ['#ffffff', MEWP[1]], 2);
                fireBits(L.x, G - s, s, MEWP, 18, { angle: -Math.PI / 2, spread: Math.PI, speed: H * 0.6, drag: 2.2, life: 0.6 });
                debris(L.x, G - s, s, ROCK, 12, H * 0.8, { ground: G, angle: -Math.PI / 2, spread: 2 });
            }
            for (const R of rocks) {
                debris(R.x0, G - s, s, ROCK, 5, H * 0.6, { ground: G, angle: -Math.PI / 2, spread: 2 });
            }
        });
        // 내리꽂힌 자리마다 작은 보랏빛 폭발 · 메가뮤츠Y 둘레 거대한 염력 폭발
        const bigR = Math.min(G * 0.75, Math.max(D * 1.2, me.w * 3.5));
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const k = sc.t - TI;
            if (k < 0 || k > 0.8) {
                return;
            }
            const grow = easeOut(clamp(k / 0.25, 0, 1)) * (1 - easeIn(clamp((k - 0.55) / 0.25, 0, 1)));
            const cool = clamp((k - 0.25) / 0.45, 0, 1);
            fireOrb(ctx, px, s, me.x, footAt(TI) - me.h * 0.5, bigR, MEWP, sc.t, grow, G + s, 1, cool, [1, 0.86, 0.68, 0.46], 0.25);
            lifted.forEach((L, i) => {
                fireOrb(ctx, px, s, L.x, G, Math.max(L.w * 1.3, s * 6), MEWP, sc.t + i, grow, G + s, 1, cool, [1, 0.82, 0.62, 0.4], 0.3);
            });
        } });
        sc.at(TI, () => {
            for (const L of lifted) {
                strike(sc, L.x, G - s, L.x + rnd(-1, 1) * L.w, Math.max(s * 2, G - L.h * 4), { mid: MEWP[0], glow: MEWP[2], dur: 0.4, branches: 1, w: 2 }); // 위로 솟는 번개
            }
            for (let i = 0; i < 8; i++) {
                const a = -Math.PI + ((i + 0.5) / 8) * Math.PI;
                const cy0 = footAt(TI) - me.h * 0.5;
                strike(sc, me.x, cy0, me.x + Math.cos(a) * bigR * 1.4, Math.min(G, cy0 + Math.sin(a) * bigR * 1.4), { mid: MEWP[0], glow: MEWP[2], dur: 0.45, branches: 1, w: 2 });
            }
        });
        // 갈라진 땅 — 메가뮤츠Y 발밑에서 양옆으로
        const cracks = [-1, 1].map((d) => jag(me.x, G - s, clamp(me.x + d * W * 0.45, 0, W), G - s, Math.max(3 * s, W * 0.02), 0.05));
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TI || life > TBack) {
                return;
            }
            const k = clamp((life - TI) / 0.3, 0, 1);
            const fade = 1 - clamp((life - TBack + 0.6) / 0.6, 0, 1);
            for (const c of cracks) {
                const n = Math.max(2, Math.round(c.length * k));
                fillPts(ctx, px, s, c.slice(0, n), 2, '#1c1428', fade);
                fillPts(ctx, px, s, c.slice(0, n), 1, MEWP[2], fade * (0.6 + 0.4 * Math.sin(life * 20)));
            }
        } });
        let glim = 0;
        sc.tick((t, dt) => {
            if (t < TI + 0.2 || t > TBack - 0.3) {
                return;
            }
            glim += dt * 18;
            while (glim >= 1) {
                glim -= 1;
                sparkles(rnd(0, W), G - rnd(0, G * 0.6), s, ['#ffffff', MEWP[1], MEWP[2]], 1, s * 2, H * 0.15);
            }
        });
        sc.at(TBack, () => {
            hideMon(pokemon, false);
            sparkles(me.x, me.b - me.h * 0.5, s, ['#ffffff', MEWP[0], MEWP[1]], 16, me.w, H * 0.2);
            ring(sc, me.x, me.b - me.h * 0.5, me.w * 0.4, me.w * 2.5, 0.8, 0.35, ['#ffffff', MEWP[1]], 2);
        });
    }

    // ═════ 뮤 — mew: 오리진즈슈퍼노바 (ultorb 위에 덮어씀) · 메트로놈 연속기 (ultpsy 위에 덮어씀) — 아래 Object.assign ═════
    const MEWPK = ['#ffffff', '#ffd9f0', '#ff8fd0', '#c4469b']; // 뮤 (하양 → 연분홍 → 분홍 → 짙은 분홍)
    const STARC = ['#ffffff', '#fff3b0', '#ffd9f0', '#b9e6ff']; // 별빛
    // 분홍 은하 소용돌이 — (x, y) 둘레로 팔 세 개가 감기며 돎, 반지름 R, 세기 k
    function galaxy(ctx, px, s, x, y, R, T, k, dirn) {
        if (k <= 0.02) {
            return;
        }
        const paths = [new Path2D(), new Path2D(), new Path2D()];
        for (let arm = 0; arm < 3; arm++) {
            for (let i = 0; i < 26; i++) {
                const f = i / 26;
                const a = (arm / 3) * TAU + f * 4.2 * dirn + T * 2.2 * dirn;
                const r = R * (0.15 + 0.85 * f) * k;
                paths[f < 0.35 ? 0 : f < 0.7 ? 1 : 2].rect(px(x + Math.cos(a) * r), px(y + Math.sin(a) * r * 0.55), f < 0.35 ? 2 * s : s, s);
            }
        }
        fillPaths(ctx, paths, ['#ffffff', MEWPK[1], MEWPK[2]], 0.85 * k);
    }
    // 오리진즈슈퍼노바 — 뮤가 하늘로 날아올라 2초 동안 우주의 기를 모음(분홍 은하 소용돌이 · 별빛이 빨려 듦 · 분홍 기운 줄기)
    // → 머리 위에 거대한 분홍 태양이 생겨 커짐(별빛 고리가 돎, 화면이 분홍빛으로) → 땅으로 내던짐 → 분홍 초신성 대폭발
    // (빛의 반구 — blastDome 분홍 · 하늘로 솟는 빛기둥 · 별 반짝이) → 땅이 분홍빛 사이코필드로 물들어 반짝임 → 내려앉음.
    // 뮤는 진짜 그림을 숨기고 꼭두각시로
    function runGenesisSupernova(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const img = pokemon.el;
        const me = monBox(pokemon);
        const edge = Math.max(1, Math.round(u.s * 0.75));
        const left = dir < 0;
        const D = Math.min(Math.max(H / 3, short(u) * 0.4) * (0.9 + 0.2 * P), W * 0.42, H * 0.62);
        const T0 = 0.6; // 날아오름 끝
        const TC1 = 2.7; // 기 모으기 끝
        const TSUN = 3.5; // 태양 다 커짐
        const TTH = 3.7; // 던짐
        const TX = TTH + 0.6; // 땅에 닿음 — 초신성
        const DOME = 2.2;
        const TDN = TX + DOME + 0.2; // 내려앉음
        const q = nearest(u);
        const ix = clamp(q ? q.x : W * 0.5, W * 0.15, W * 0.85);
        const sx = clamp(lerp(me.x, ix, 0.35), W * 0.12, W * 0.88); // 하늘 자리
        const sy = Math.max(me.h * 1.6, G * 0.6); // 발 높이
        const Rsun = Math.max(s * 6, Math.min(Math.max(D * 0.55, me.w * 1.6), (sy - me.h) * 0.5)); // 머리 위 남은 자리에 맞춰 (화면 위로 잘리지 않게)
        const sunY = Math.max(Rsun * 1.05, sy - me.h - Rsun * 0.9);
        const R = Math.min(Math.max(D * 1.6, me.w * 4), W * 0.55, G * 0.92); // 반구
        const bob = (t) => Math.sin(t * 3.2) * s * 2;
        const posAt = (t) => {
            if (t < T0) {
                const e = easeOut(t / T0);
                return [lerp(me.x, sx, e), lerp(me.b, sy, e) - Math.sin(e * Math.PI) * H * 0.05];
            }
            if (t < TDN) {
                return [sx, sy + bob(t)];
            }
            const k = clamp((t - TDN) / 0.6, 0, 1);
            const e = k * k * (3 - 2 * k);
            return [lerp(sx, me.x, e), lerp(sy, me.b, e)];
        };
        const sc = scene(u, sec + 0.3, 'ultorb');
        ultDark(0.4, ms - 200);
        hideMon(pokemon, true);
        hideUntil(pokemon, ms + 100);
        const sunAt = (t) => {
            if (t < TC1) {
                return null;
            }
            if (t < TTH) {
                return [sx, sunY, easeOut(clamp((t - TC1) / (TSUN - TC1), 0, 1))];
            }
            const k = clamp((t - TTH) / (TX - TTH), 0, 1);
            return [lerp(sx, ix, k * k), lerp(sunY, G - Rsun * 0.4, k * k), 1];
        };

        // 화면이 분홍빛으로 (태양이 클 때)
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp((life - TC1) / 0.6, 0, 1) * (1 - clamp((life - TX) / 0.3, 0, 1));
            if (a > 0) {
                ctx.globalAlpha = 0.18 * a;
                ctx.fillStyle = MEWPK[2];
                ctx.fillRect(0, 0, W, H);
            }
        } });
        // 은하 소용돌이 (뮤 뒤)
        sc.add({ max: TC1 + 0.4, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - T0) / 0.4, 0, 1) * clamp((TC1 + 0.3 - life) / 0.3, 0, 1);
            const [x, b] = posAt(life);
            galaxy(ctx, px, s, x, b - me.h * 0.5, Math.max(D * 1.1, me.w * 3), life, k, dir);
        } });
        // 뮤 (꼭두각시) — 분홍 테두리 · 반짝 · 날 때 분홍 꼬리
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life >= sec - 0.12) {
                return;
            }
            const [x, b] = posAt(life);
            if (life < T0 || (life > TDN && life < TDN + 0.6)) {
                fireTail(ctx, px, s, x, b - me.h * 0.5, 0, life < T0 ? -1 : 1, me.h * 1.4, me.w * 0.4, MEWPK, life, 0.9);
            }
            const throwPose = life > TTH - 0.1 && life < TTH + 0.25 ? s * 2 * Math.sin(((life - TTH + 0.1) / 0.35) * Math.PI) : 0;
            drawLitMon(ctx, img, x, b + throwPose, me.w, left, MEWPK[2], edge, 1);
            drawMon(ctx, img, x, b + throwPose, me.w, left, clamp((life - T0) / 1, 0, 1) * (life < TDN ? 1 : 0) * (0.2 + 0.12 * Math.sin(life * 16)), '#ffffff');
        } });
        sc.at(sec - 0.12, () => hideMon(pokemon, false));
        sc.at(0.05, () => {
            ring(sc, me.x, me.b - s, me.w * 0.4, me.w * 3, 0.2, 0.4, [MEWPK[1], '#ffffff'], 2);
            sparkles(me.x, me.b - me.h * 0.5, s, STARC, 10, me.w, H * 0.2);
        });
        // ① 기 모으기 — 빨려 드는 분홍 기운 줄기 · 별빛 · 두근두근 고리
        chargeSwirl(sc, (t) => { const [x, b] = posAt(t); return [x, b - me.h * 0.5]; }, T0, TC1, Math.max(D * 1.2, me.w * 4), me.w * 0.6, MEWPK, dir);
        let star = 0;
        sc.tick((t, dt) => {
            if (t < T0 || t > TC1) {
                return;
            }
            star += dt * 30;
            const [x, b] = posAt(t);
            while (star >= 1 && room(3)) {
                star -= 1;
                const a0 = rnd(0, TAU);
                const r0 = Math.max(D * 1.3, me.w * 4) * rnd(0.7, 1.3);
                const cx = x;
                const cy = b - me.h * 0.5;
                sigParticle({ x: cx, y: cy, s, max: rnd(0.5, 0.8), a0, r0, cols: STARC,
                    update: (p) => {
                        const e = (p.life / p.max) ** 2;
                        p.x = cx + Math.cos(p.a0 + e * 2 * dir) * p.r0 * (1 - e);
                        p.y = cy + Math.sin(p.a0 + e * 2 * dir) * p.r0 * (1 - e) * 0.6;
                    },
                    draw: DRAW.sparkle });
            }
            if (star >= 1) {
                star = 0;
            }
        });
        [1.1, 1.6, 2.0, 2.35].forEach((tp) => sc.at(tp, () => {
            const [x, b] = posAt(tp);
            ring(sc, x, b - me.h * 0.5, Math.max(D, me.w * 3), me.w * 0.6, 1, 0.3, [MEWPK[1], '#ffffff', MEWPK[3]], 2);
            ultShake(1.5, 150);
        }));
        // ② 분홍 태양 — 머리 위에서 커지고 별빛 고리가 돎 → 땅으로 내던짐
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const sn = sunAt(life);
            if (!sn || life >= TX) {
                return;
            }
            const [x, y, k] = sn;
            const r = Rsun * (0.15 + 0.85 * k);
            if (life >= TTH) {
                fireTail(ctx, px, s, x, y, (ix - sx) / (Math.hypot(ix - sx, G - sunY) || 1), (G - sunY) / (Math.hypot(ix - sx, G - sunY) || 1), r * 2.5, r * 1.6, MEWPK, life, 1);
            }
            // 빛살 — 태양 둘레를 도는 빛줄기
            const rays = new Path2D();
            for (let i = 0; i < 16; i++) {
                const a = (i / 16) * TAU + life * 1.2;
                const L = r * (1.25 + 0.35 * Math.sin(life * 9 + i * 1.7));
                addLine(rays, px, s, [[x + Math.cos(a) * r * 1.02, y + Math.sin(a) * r * 1.02], [x + Math.cos(a) * L, y + Math.sin(a) * L]], 2);
            }
            ctx.globalAlpha = 0.6 * k;
            ctx.fillStyle = MEWPK[1];
            ctx.fill(rays);
            fireOrb(ctx, px, s, x, y, r, MEWPK, life, 1 + 0.05 * Math.sin(life * 20), Infinity, 1, 0, [1, 0.86, 0.7, 0.5], 0.25);
            swirlRing(ctx, px, s, x, y, r * 1.45, 0.4, life, dir, ['#ffffff', MEWPK[2]], 0.9 * k);
        } });
        sc.at(TC1, () => {
            screenFlash(s, 0.3, MEWPK[1], 0.15);
            ultShake(4, 400);
        });
        sc.at(TTH, () => {
            ultShake(6, 300);
            ring(sc, sx, sunY, Rsun, Rsun * 2.5, 1, 0.35, ['#ffffff', MEWPK[1]], 3);
        });
        // ③ 분홍 초신성 — 빛의 반구 · 하늘로 솟는 빛기둥 · 별 반짝이 · 충격파
        sc.at(TX, () => {
            screenFlash(s, 0.9, '#ffffff', 0.3);
            ultShake(12, 1000);
            blastDome(sc, ix, G, R, DOME, MEWPK);
            ring(sc, ix, G - R * 0.4, R * 0.4, Math.max(W, H) * 0.9, 0.7, 0.6, ['#ffffff', MEWPK[1], MEWPK[2]], 3);
            ring(sc, ix, G - s, R * 0.5, Math.max(W, H), 0.16, 0.7, [MEWPK[1], '#ffffff'], 2);
            sparkles(ix, G - R * 0.5, s, STARC, 40, R, H * 0.4);
            for (const r of u.others()) {
                if (Math.abs(r.x - ix) < R + r.w * 0.5) {
                    hit(r, Math.sign(r.x - ix) || dir, 'lift');
                }
            }
        });
        const pillars = [];
        for (let i = 0; i < 7; i++) {
            pillars.push({ x: ix + (i - 3) * R * 0.28 + (hash(i, 131) - 0.5) * R * 0.1, t0: TX + 0.15 + Math.abs(i - 3) * 0.08, w: R * (0.06 + 0.04 * hash(i, 132)) });
        }
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            for (const pl of pillars) {
                const k = (life - pl.t0) / 1.4;
                if (k < 0 || k > 1) {
                    continue;
                }
                const up = easeOut(clamp(k / 0.15, 0, 1));
                const w = pl.w * (1 - k) * (1 + 0.2 * Math.sin(life * 30));
                const top = G - (G + H * 0.1) * up;
                for (const [m, c, a] of [[1, MEWPK[2], 0.6], [0.6, MEWPK[1], 0.85], [0.25, '#ffffff', 1]]) {
                    ctx.globalAlpha = a * (1 - k * 0.5);
                    ctx.fillStyle = c;
                    ctx.fillRect(px(pl.x - w * m), px(top), Math.max(s, px(2 * w * m)), Math.max(s, px(G - top)));
                }
            }
        } });
        // ④ 사이코필드 — 땅이 분홍빛으로 물들어 반짝임 (끝까지)
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - TX - 0.6) / 0.5, 0, 1) * clamp((sec - life) / 0.5, 0, 1);
            if (k <= 0) {
                return;
            }
            const band = new Path2D();
            const glow = new Path2D();
            for (let x = 0; x < W; x += 2 * s) {
                const h = s * (3 + 2 * Math.sin(x * 0.05 + life * 4));
                band.rect(px(x), px(G - h), 2 * s, px(h) + s);
                if (hash(Math.floor(x / (2 * s)), Math.floor(life * 6)) > 0.93) {
                    glow.rect(px(x), px(G - h - s * 3), s, s);
                }
            }
            ctx.globalAlpha = 0.45 * k;
            ctx.fillStyle = MEWPK[2];
            ctx.fill(band);
            ctx.globalAlpha = 0.9 * k;
            ctx.fillStyle = '#ffffff';
            ctx.fill(glow);
        } });
        let fieldT = 0;
        sc.tick((t, dt) => {
            if (t < TX + 0.8 || t > sec - 0.4) {
                return;
            }
            fieldT += dt * 10;
            while (fieldT >= 1) {
                fieldT -= 1;
                sparkles(rnd(0, W), G - s * 3, s, STARC, 1, s * 2, H * 0.2);
            }
        });
        sc.at(TDN + 0.6, () => ring(sc, me.x, me.b - s, me.w * 0.4, me.w * 2.5, 0.2, 0.4, [MEWPK[1], '#ffffff'], 2));
    }

    // 메트로놈 (환상의 연속기) — 뮤가 분홍 거품 방울에 싸여 떠올라 손가락을 까딱 → 화면 곳곳을 통통 튀어 다니며 다른 포켓몬의 기술을 작게 연달아 씀:
    // 불꽃(리자몽 불꽃 줄기 · 화톳불) → 물(거북왕 물줄기 · 물기둥) → 햇빛(이상해꽃 햇빛 광선 · 꽃잎) → 번개(하늘에서 내리침) → 얼음(고드름 비 · 서리 고리)
    // → 가운데로 돌아와 거품이 펑 터지며 분홍 대폭발(별 반짝이 · 충격파) → 내려앉음. 뮤는 진짜 그림을 숨기고 꼭두각시로
    const ICEC = ['#ffffff', '#e3faff', '#9fe8ff', '#55c2ef'];
    const ZAPC = ['#ffffff', '#fff8a8', '#ffe53b', '#f2b600'];
    function runMewMetronome(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const img = pokemon.el;
        const me = monBox(pokemon);
        const edge = Math.max(1, Math.round(u.s * 0.75));
        const left = dir < 0;
        const D = Math.min(Math.max(H / 3, short(u) * 0.4) * (0.9 + 0.2 * P), W * 0.42, H * 0.62);
        const fireC = sigPal('fire');
        const KINDS = ['fire', 'water', 'solar', 'zap', 'ice'];
        const T0 = 0.8; // 거품 · 까딱 끝
        const STEP = 0.95; // 기술 하나 (튀어 옮겨 가기 0.3 + 쓰기 0.65)
        const TFIN = T0 + KINDS.length * STEP; // 가운데로
        const TPOP = TFIN + 0.45; // 거품이 펑
        const TDN = TPOP + 0.9;
        const bubR = Math.max(me.w, me.h) * 0.75;
        const hy = Math.max(me.h + bubR, G * 0.55); // 떠다니는 발 높이
        const spots = KINDS.map((k, i) => [clamp(W * (0.18 + 0.64 * ((i * 3) % 5) / 4), bubR + 4, W - bubR - 4), hy - (i % 2) * H * 0.12]);
        const homeAir = [clamp(me.x, bubR + 4, W - bubR - 4), hy];
        const center = [W * 0.5, hy - H * 0.05];
        const bob = (t) => Math.sin(t * 4) * s * 2;
        const hop = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k) - Math.sin(k * Math.PI) * H * 0.12];
        const posAt = (t) => {
            if (t < T0) {
                const e = easeOut(clamp(t / 0.5, 0, 1));
                return [lerp(me.x, homeAir[0], e), lerp(me.b, homeAir[1], e)];
            }
            if (t < TFIN) {
                const i = Math.floor((t - T0) / STEP);
                const k = (t - T0 - i * STEP) / 0.3;
                const from = i === 0 ? homeAir : spots[i - 1];
                if (k < 1) {
                    return hop(from, spots[i], easeOut(k));
                }
                return [spots[i][0], spots[i][1] + bob(t)];
            }
            if (t < TPOP) {
                return hop(spots[KINDS.length - 1], center, easeOut(clamp((t - TFIN) / 0.35, 0, 1)));
            }
            if (t < TDN) {
                return [center[0], center[1] + bob(t)];
            }
            const k = clamp((t - TDN) / 0.6, 0, 1);
            return [lerp(center[0], me.x, k * k * (3 - 2 * k)), lerp(center[1], me.b, k * k)];
        };
        // 기술마다 노리는 곳 — 그 자리에서 가장 가까운 애, 없으면 앞쪽 땅
        const targetFor = (x) => {
            let best = null;
            let bd = Infinity;
            for (const r of u.others()) {
                const d = Math.abs(r.x - x);
                if (d < bd && d > me.w * 0.5) {
                    bd = d;
                    best = r;
                }
            }
            const tx = best ? best.x : clamp(x + (x < W / 2 ? 1 : -1) * W * 0.3, W * 0.05, W * 0.95);
            return [tx, G - s * 2];
        };
        const tgts = spots.map((sp) => targetFor(sp[0]));
        const sc = scene(u, sec + 0.3, 'ultpsy');
        ultDark(0.3, ms - 200);
        hideMon(pokemon, true);
        hideUntil(pokemon, ms + 100);

        // 기술 연출 (뮤 뒤)
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const i = Math.floor((life - T0) / STEP);
            if (life < T0 || i >= KINDS.length) {
                return;
            }
            const k = (life - T0 - i * STEP - 0.3) / 0.65; // 쓰는 중 0 ~ 1
            if (k < 0) {
                return;
            }
            const [mx, my] = [spots[i][0], spots[i][1] - me.h * 0.5];
            const [tx, ty] = tgts[i];
            const dx = tx - mx;
            const dy = ty - my;
            const L = Math.hypot(dx, dy) || 1;
            const ux = dx / L;
            const uy = dy / L;
            const reach = L * easeOut(clamp(k / 0.3, 0, 1));
            const fade = 1 - clamp((k - 0.8) / 0.2, 0, 1);
            switch (KINDS[i]) {
                case 'fire':
                    fireTail(ctx, px, s, mx + ux * reach, my + uy * reach, ux, uy, Math.min(reach, L * 0.6), me.w * 0.7, fireC, life, fade);
                    if (k > 0.3) {
                        flameTongue(ctx, px, s, tx, G, me.w * 1.4, me.w * 2.6 * Math.sin(Math.min(1, (k - 0.3) / 0.3) * Math.PI * 0.5), fireC, life, fade);
                    }
                    break;
                case 'water':
                    fireTail(ctx, px, s, mx + ux * reach, my + uy * reach, ux, uy, reach, me.w * 0.6, TIDE, life, fade);
                    break;
                case 'solar':
                    beamBody(ctx, px, s, mx, my, ux, uy, reach, me.w * 0.55 * fade, SUN, life, 1, G);
                    fireOrb(ctx, px, s, mx, my, me.w * 0.35, SUN, life, fade, Infinity, 1, 0, [1, 0.8, 0.6, 0.38], 0.3);
                    break;
                case 'zap':
                    break; // 번개는 sc.at 에서 strike
                case 'ice':
                    for (let j = 0; j < 5; j++) {
                        const fx = tx + (j - 2) * me.w * 0.7;
                        const fall = clamp((k - j * 0.06) / 0.35, 0, 1);
                        const y = lerp(-s * 4, G - me.w * 0.4, fall * fall);
                        if (fall > 0 && fall < 1) {
                            fireTail(ctx, px, s, fx, y, 0, 1, me.w * 1.4, me.w * 0.35, ICEC, life + j, 1);
                        }
                    }
                    break;
            }
        } });
        // 뮤 (꼭두각시) — 분홍 거품 방울 · 손가락 까딱(좌우로 흔들림)
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life >= sec - 0.12) {
                return;
            }
            const [x, b] = posAt(life);
            const wag = life > 0.3 && life < T0 ? Math.sin((life - 0.3) * 22) * s * 2 : 0;
            drawLitMon(ctx, img, x + wag, b, me.w, left, MEWPK[2], edge, 1);
            drawMon(ctx, img, x + wag, b, me.w, left, 0.15 + 0.1 * Math.sin(life * 14), '#ffffff');
            // 거품 — 둥근 테두리 · 반짝이는 무지갯빛 하이라이트
            const bk = clamp(life / 0.4, 0, 1) * (life < TPOP ? 1 : 0);
            if (bk > 0) {
                const cy = b - me.h * 0.5;
                const r = bubR * bk * (1 + 0.04 * Math.sin(life * 7));
                ringDots(ctx, px, s, x, cy, r, 1, [MEWPK[1], '#ffffff', '#b9e6ff'], 0.85, 2);
                ellipse(ctx, px, s, x - r * 0.4, cy - r * 0.45, r * 0.22, r * 0.12, '#ffffff', 0.8);
                ellipse(ctx, px, s, x + r * 0.35, cy + r * 0.4, r * 0.1, r * 0.06, '#ffffff', 0.5);
            }
        } });
        sc.at(sec - 0.12, () => hideMon(pokemon, false));
        sc.at(0.05, () => sparkles(me.x, me.b - me.h * 0.5, s, STARC, 10, me.w, H * 0.2));
        // 기술마다 — 쓰는 순간 · 맞는 순간
        KINDS.forEach((kind, i) => {
            const tUse = T0 + i * STEP + 0.3;
            const tHit = tUse + 0.65 * 0.3;
            const [tx, ty] = tgts[i];
            sc.at(tUse, () => {
                const [mx, my] = [spots[i][0], spots[i][1] - me.h * 0.5];
                ring(sc, mx, my, me.w * 0.3, me.w * 1.8, 1, 0.3, ['#ffffff', MEWPK[1]], 2);
                ultShake(2, 120);
            });
            sc.at(tHit, () => {
                ultShake(5, 300);
                if (kind === 'fire') {
                    fireBits(tx, G - me.w * 0.5, s, fireC, 30, { angle: -Math.PI / 2, spread: Math.PI, speed: H * 0.7, drag: 2.2, life: 0.6 });
                } else if (kind === 'water') {
                    geyser(sc, tx, G, me.w * 0.5, Math.min(G * 0.6, H * 0.4), 0.9, TIDE);
                    splash(tx, G - s, s, TIDE, 30, H * 0.8, { spread: 2 });
                } else if (kind === 'solar') {
                    ring(sc, tx, G - me.w * 0.5, me.w * 0.3, me.w * 3, 0.8, 0.4, ['#ffffff', SUN[1], SUN[2]], 2);
                    sparkles(tx, G - me.w * 0.6, s, ['#ffffff', SUN[1], SUN[2]], 14, me.w, H * 0.15);
                    petalBurst(tx, G - me.w * 0.5, s, 24, H * 0.8, { r: me.w * 0.5 });
                } else if (kind === 'zap') {
                    strike(sc, tx + rnd(-1, 1) * s * 4, -s * 4, tx, G - s, { dur: 0.45, w: 3, branches: 3 });
                    ring(sc, tx, G - s, me.w * 0.4, me.w * 3, 0.25, 0.4, [ZAPC[1], '#ffffff'], 2);
                    fireBits(tx, G - s, s, ZAPC, 24, { angle: -Math.PI / 2, spread: Math.PI, speed: H * 0.6, drag: 2.4, life: 0.5 });
                } else if (kind === 'ice') {
                    ring(sc, tx, G - s, me.w * 0.5, me.w * 4, 0.2, 0.5, ['#ffffff', ICEC[2]], 2);
                    sparkles(tx, G - me.w, s, ICEC, 16, me.w * 2, H * 0.1);
                }
                ring(sc, tx, G - me.w * 0.4, me.w * 0.3, me.w * 2.5, 0.7, 0.35, ['#ffffff', MEWPK[1]], 2);
                for (const r of u.others()) {
                    if (Math.abs(r.x - tx) < me.w * 2 + r.w * 0.5) {
                        hit(r, Math.sign(r.x - spots[i][0]) || dir, kind === 'water' || kind === 'ice' ? 'lift' : 'tumble');
                    }
                }
            });
        });
        // ⑥ 거품이 펑 — 분홍 대폭발 · 별 반짝이 · 충격파
        const boomR = Math.min(G * 0.6, Math.max(D * 1.1, me.w * 3));
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const k = sc.t - TPOP;
            if (k < 0 || k > 0.8) {
                return;
            }
            const grow = easeOut(clamp(k / 0.25, 0, 1)) * (1 - easeIn(clamp((k - 0.5) / 0.3, 0, 1)));
            fireOrb(ctx, px, s, center[0], center[1] - me.h * 0.5, boomR, MEWPK, sc.t, grow, Infinity, 1, clamp((k - 0.25) / 0.4, 0, 1), [1, 0.86, 0.68, 0.46], 0.2);
        } });
        sc.at(TPOP, () => {
            screenFlash(s, 0.6, '#ffffff', 0.2);
            ultShake(10, 700);
            const cy = center[1] - me.h * 0.5;
            ring(sc, center[0], cy, boomR * 0.3, Math.max(W, H) * 0.9, 1, 0.6, ['#ffffff', MEWPK[1], MEWPK[2]], 3);
            sparkles(center[0], cy, s, STARC, 40, boomR, H * 0.3);
            fireBits(center[0], cy, s, MEWPK, 70, { spread: TAU, speed: H * 1.1, drag: 2, life: 0.9 });
            for (const r of u.others()) {
                hit(r, Math.sign(r.x - center[0]) || dir, 'lift');
            }
        });
        sc.at(TDN + 0.6, () => ring(sc, me.x, me.b - s, me.w * 0.4, me.w * 2.5, 0.2, 0.4, [MEWPK[1], '#ffffff'], 2));
    }

    Object.assign(ULT_FX, {
        // 화면 전체 날씨 폭격 — kind: thunder blizzard wind acid petal leaf sand rain fire, c
        ultstorm: {
            ms: (P) => 3300 + 500 * P,
            run: (u, o, ms) => runStorm(u, o, ms),
        },
        // 하늘에서 떨어짐 — n 1: 거대한 바위 · 얼음 하나 / 여럿: 유성군 (shape rock ice meteor star, c)
        ultskyfall: {
            ms: (P, o) => ((o.n ?? (['meteor', 'star'].includes(o.shape) ? 8 : 1)) > 1 ? 3500 + 300 * P : 3200 + 200 * P),
            run: (u, o, ms) => {
                const shape = ['rock', 'ice', 'meteor', 'star'].includes(o.shape) ? o.shape : 'rock';
                const n = o.n ?? (shape === 'meteor' || shape === 'star' ? 8 : 1);
                if (n > 1) {
                    runMeteors(u, o, ms, n, shape);
                } else {
                    runGiantFall(u, o, ms, shape === 'ice' ? 'ice' : 'rock');
                }
            },
        },
        // 번개 — spear: 번개를 모아 거대한 창을 던짐 (스파킹기가볼트) / pillar: 굵은 번개 기둥이 앞으로 연달아
        ultthunder: {
            ms: (P, o) => (o.mode === 'pillar' ? 3300 + 300 * P : 3700 + 300 * P),
            run: (u, o, ms, pokemon) => (o.mode === 'pillar' ? runPillars(u, o, ms) : runSpear(u, o, ms, pokemon)),
        },
        // 1000만볼트 — 굵은 무지개 번개 일곱 줄기가 화면 끝까지 (rainbow 기본 1, 0 이면 c 색 — 100만볼트) · max: 극대(11줄기 · 네 번 두근 · 거대 번개 기둥)
        ultvolt: {
            ms: (P, o) => (o.max ? 5000 : 3800) + 400 * P,
            run: (u, o, ms, pokemon) => runVolt(u, o, ms, pokemon),
        },
        // 화면 가득 날리기 — shape (needle star ball rock leaf coin egg bone heart shuriken) c n / giant: 거대한 것 하나
        // ninja: 개굴닌자 거대 물수리검 (변신 · 꽂혀서 물기둥) / clones: 그림자분신 물수리검 (분신 수)
        ultswarm: {
            ms: (P, o) => (o.clones ? 5400 + 200 * P : o.ninja ? 5900 + 200 * P : o.giant ? 3300 : 2900 + 300 * P),
            run: (u, o, ms, pokemon) => {
                if (o.clones) {
                    runShadowClones(u, o, ms, pokemon);
                } else if (o.ninja) {
                    runNinjaShuriken(u, o, ms, pokemon);
                } else if (o.giant) {
                    runGiantThrow(u, o, ms, pokemon);
                } else {
                    runSwarm(u, o, ms, pokemon);
                }
            },
        },
    });
    // 루카리오 전용 — 진 파동탄은 ultorb(fx-energy.js) 위에 덮어씀: lucario 옵션일 때만, 나머지 포켓몬은 원래 구체 그대로.
    // 틀 이름이 그대로라 필살기 대결 모양(orb)도 그대로
    const baseOrb = ULT_FX.ultorb;
    if (baseOrb) {
        ULT_FX.ultorb = {
            ms: (P, o) => (o.lucario ? 5600 + 200 * P : o.turtle ? 8500 + 200 * P : o.mewtwo ? 8600 + 200 * P : o.mew ? 8200 + 200 * P : baseOrb.ms(P, o)),
            run: (u, o, ms, pokemon) => (o.lucario ? runTrueAuraSphere(u, o, ms, pokemon) : o.turtle ? runMegaLauncher(u, o, ms, pokemon) : o.mewtwo ? runPsystrike(u, o, ms, pokemon) : o.mew ? runGenesisSupernova(u, o, ms, pokemon) : baseOrb.run(u, o, ms, pokemon)),
        };
    }
    // 리자몽 전용 — 플레어드라이브는 ultdive(fx-body.js), 블래스트번은 ultpillar(fx-earth.js) 위에 덮어씀: flare · blast 옵션일 때만.
    // 틀 이름이 그대로라 필살기 대결 모양(rush · ground)도 그대로
    const baseDive = ULT_FX.ultdive;
    if (baseDive) {
        ULT_FX.ultdive = {
            ms: (P, o) => (o.flare ? 7400 + 200 * P : baseDive.ms(P, o)),
            run: (u, o, ms, pokemon) => (o.flare ? runFlareDrive(u, o, ms, pokemon) : baseDive.run(u, o, ms, pokemon)),
        };
    }
    const basePillar = ULT_FX.ultpillar;
    if (basePillar) {
        ULT_FX.ultpillar = {
            ms: (P, o) => (o.blast ? 8500 + 200 * P : o.venus ? 8000 + 200 * P : basePillar.ms(P, o)),
            run: (u, o, ms, pokemon) => (o.blast ? runBlastBurn(u, o, ms, pokemon) : o.venus ? runHardPlant(u, o, ms, pokemon) : basePillar.run(u, o, ms, pokemon)),
        };
    }
    const baseBeam = ULT_FX.ultbeam;
    if (baseBeam) {
        ULT_FX.ultbeam = {
            ms: (P, o) => (o.venus ? 7000 + 200 * P : o.turtle ? 8600 + 200 * P : baseBeam.ms(P, o)),
            run: (u, o, ms, pokemon) => (o.venus ? runSolarBeam(u, o, ms, pokemon) : o.turtle ? runHydroCannon(u, o, ms, pokemon) : baseBeam.run(u, o, ms, pokemon)),
        };
    }
    const basePsy = ULT_FX.ultpsy;
    if (basePsy) {
        ULT_FX.ultpsy = {
            ms: (P, o) => (o.mewtwo ? 8800 + 200 * P : o.mew ? 8000 + 200 * P : basePsy.ms(P, o)),
            run: (u, o, ms, pokemon) => (o.mewtwo ? runPsychokinesis(u, o, ms, pokemon) : o.mew ? runMewMetronome(u, o, ms, pokemon) : basePsy.run(u, o, ms, pokemon)),
        };
    }
    // ═════ 전용 필살기(fx-unique.js) 도구 — 임팩트 프레임 · 거대한 꽃 마무리(ultFinale('bloom', …)) ═════
    // 임팩트 프레임(하양 · 검정 한순간) — 번쩍은 적당히
    function impactFrames(sc, W, H, white = 0.7, black = 0.45) {
        sc.add({ max: 0.05, draw: (ctx) => {
            ctx.globalAlpha = white;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, W, H);
        } });
        sc.at(0.05, () => sc.add({ max: 0.06, draw: (ctx) => {
            ctx.globalAlpha = black;
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, W, H);
        } }));
    }
    // bloom — 땅(x)에서 거대한 꽃이 활짝 피었다(꽃잎 여덟 장 · 가운데 햇빛 구) 꽃잎 폭풍 · 꽃잎이 살랑살랑 떨어짐 (솔라빔 · 하드플랜트처럼). pc = 꽃잎 색 (없으면 분홍)
    ULT_FINALE.bloom = (u, x, R, pc) => {
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const pcol = pc || PINK;
        const bloomR = clamp(R, s * 10, G * 0.6);
        const xx = clamp(x, bloomR * 0.8, W - bloomR * 0.8);
        const TP = 0.95; // 꽃잎 폭풍
        const sc = scene(u, 2.8, 'finale bloom');
        sc.add({ max: TP + 0.12, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = easeOut(clamp(life / 0.35, 0, 1));
            const end = clamp((life - TP) / 0.1, 0, 1);
            const r = bloomR * k * (1 + 0.15 * end);
            for (let i = 0; i < 8; i++) {
                const a = -Math.PI + (i / 7) * Math.PI + life * 0.4 * dir;
                const ex = Math.cos(a);
                const ey = Math.sin(a) * 0.85;
                fireTail(ctx, px, s, xx + ex * r, G - s + ey * r, ex, ey, r * 0.95, r * 0.55, pcol, life + i, 1 - end);
            }
            fireOrb(ctx, px, s, xx, G - s, bloomR * 0.35, SUN, life, k * (1 - end), G, 1, 0, [1, 0.8, 0.6, 0.38], 0.2);
        } });
        ultShake(4, 300);
        ring(sc, xx, G - s, bloomR * 0.2, bloomR * 1.5, 0.8, 0.4, [pcol[1], '#ffffff'], 2);
        sc.at(TP, () => {
            impactFrames(sc, W, H, 0.5, 0.3);
            ultShake(7, 500);
            petalBurst(xx, G - bloomR * 0.4, s, 60, H * 1.2, { r: bloomR * 0.5 });
            ring(sc, xx, G - s, bloomR * 0.5, Math.max(W, H) * 0.7, 0.7, 0.6, ['#ffffff', pcol[1], pcol[2]], 3);
            sparkles(xx, G - bloomR * 0.5, s, ['#ffffff', SUN[1], pcol[1]], 20, bloomR, H * 0.25);
        });
        let fall = 0;
        sc.tick((t, dt) => {
            if (t < TP || t > TP + 1.5) {
                return;
            }
            fall += dt * 16;
            while (fall >= 1) {
                fall -= 1;
                petalBurst(rnd(0, W), -s * 2, s, 1, H * 0.25, { angle: Math.PI / 2, spread: 0.6, life: 2 });
            }
        });
    };
    // 전용 필살기(fx-unique.js)가 쓰는 도구 — 이 파일 안 이름을 밖으로
    Object.assign(ULT_KIT, {
        TAU, rnd, pick, clamp, lerp, easeOut, easeIn, hash, wrap, room, strength, fail, short, away, where, makeHit, nearest, scene,
        addLine, fillPts, jag, branchOf, drawBolt, ellipse, ringDots, ring, strike, groundArcs, glowMark, debris, puff, flames, sparkles, chunk, skyBand, lump, cloudBank, fillPaths,
        faceFlip, silhouette, drawMon, drawLitMon, monBox, hideMon, hideUntil, darkPoof, shards, waterRibbon, glint, geyser, swirlDome, waterRain, auraBubbles, recoil,
        flameTongue, groundFlames, fireTail, fireOrb, orbitEmbers, firePillar, chargeSwirl, blastDome, domeLight, fireBits, emberRise, beamBody, petalAt, petalBurst,
        vine, waterJet, waveFront, splash, swirlRing, crownSplash, waterFireworks, psyRock, galaxy, impactFrames, megaVenus, megaTurtle,
        pal: { SUN, PINK, VINE, BARK, TIDE, GUNM, MEWP, MEWPK, STARC, BLUE, GLOW, ROCK, ICEC, ZAPC, SPARKW, DARK, BAYER },
    });
})();
