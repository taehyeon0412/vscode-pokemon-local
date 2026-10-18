
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
        sc.add({ max: dur,
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
    // → 물기둥이 솟고 그 안에서 표창이 하얗게 달아오르다 물기둥째 대폭발(조각이 사방으로) → 착지하면 베인 자국이 한꺼번에 터짐 → 물방울 비
    // 뛰는 동안은 진짜 그림을 숨기고 캔버스에 꼭두각시로 (같은 자리에 내려와서 다시 보임)
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
        const T5 = 2.95;
        const TL = 3.25;
        const T6 = 3.3;
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
        waterRain(sc, TB + 0.15, sec, cols);

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
        auraBubbles(sc, TL, sec - 0.3, cols);

        // 베인 자국 — 지나간 자리에 남았다가, 착지하면(T6) 굵게 번쩍하고 사라짐 (하얀 심 · 보라 테두리)
        const cuts = [];
        let lastCut = null;
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
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
        } });
        // 꼭두각시 — 물빛 테두리, 뛰고 내릴 때 보랏빛 잔상
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
        sc.add({ max: sec, draw: (ctx) => {
            const t = sc.t;
            for (const g of ghosts) {
                drawMon(ctx, img, g.x, g.b, me.w, u.left, 0.45 * (1 - (t - g.t) / 0.25), DARK[1], g.r);
            }
            if (t >= T1 && t < TL) {
                const [x, b, r] = pup(t);
                drawLitMon(ctx, img, x, b, me.w, u.left, '#8fe3ff', edge, 1, r);
            }
        } });
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
        sc.at(T3b, () => {
            ultShake(5, 350);
            geyser(sc, fx, G, D * 0.3, hTop, 0.8, cols);
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
            // 불덩이 — 하얀 속 · 물빛 · 보랏빛 가장자리가 확 퍼졌다 사그라듦
            sc.add({ max: 0.45, draw: (ctx, it, t, px) => {
                const r = D * (0.3 + 1.0 * easeOut(t / 0.5));
                const a = t < 0.4 ? 1 : 1 - (t - 0.4) / 0.6;
                ellipse(ctx, px, s, fx, fy, r * 1.08, r * 0.9, DARK[1], a * 0.7, G);
                ellipse(ctx, px, s, fx, fy, r, r * 0.82, cols[2], a, G);
                ellipse(ctx, px, s, fx, fy, r * 0.75, r * 0.6, cols[1], a, G);
                ellipse(ctx, px, s, fx, fy, r * 0.45 * (1 - 0.5 * t), r * 0.38 * (1 - 0.5 * t), '#ffffff', a, G);
            } });
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
            for (const r of u.others()) {
                if (Math.abs(r.x - fx) < W * 0.4) {
                    hit(r, r.x < fx ? -1 : 1, 'spin');
                }
            }
        });
        // ⑤ 내려와 착지(진짜가 다시 보임) → 베인 자국이 한꺼번에 터짐
        sc.at(TL, () => {
            hideMon(pokemon, false);
            ultShake(3, 200);
            ring(sc, me.x, me.b - s, me.w * 0.4, me.w * 3, 0.2, 0.4, [cols[1], '#ffffff'], 2);
            debris(me.x, me.b - s, s, cols, 16, H * 0.5, { ground: G, angle: -Math.PI / 2, spread: 2.4 });
            recoil(pokemon, [{ translate: `0 ${u.s * 2}px` }, { translate: '0 0' }], 200);
        });
        sc.at(T6, () => {
            screenFlash(s, 0.25, '#ffffff', 0.12);
            ultShake(4, 300);
            for (const c of cuts) {
                debris(c.x, c.y, s, cols, 8, H * 0.5, { ground: G, r: c.len * 0.4 });
            }
        });
    }

    // 그림자분신 물수리검 — 보랏빛 연기로 분신이 펑 펑 → 차례로 뛰어올라 한 점에 던짐 (모일수록 표창이 커짐) → 진짜도 던짐
    // → 진짜 · 분신 모두 X 자로 교차 돌진 → 멈칫 → 합쳐진 표창이 터지며 대폭발(물기둥 셋 · 화면 가르는 X · 조각)
    // → 분신은 연기로 사라지고, 진짜는 연기로 순간이동해 제자리로 → 물방울 비
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
        const tOut = tBoom + 0.4;
        const tBack = tOut + 0.15;
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
            dashers.push({ x, b, left: tx < x, tIn: tA, tJump: tA + 0.2, jh: Math.max(0, Math.min(ch * 1.1, b - ch - d - 4)), to: across(x, b), tOut: tOut + order * 0.06 });
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
        waterRain(sc, tBoom + 0.2, sec, cols);
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
        // 분신 · 진짜 꼭두각시 — 분신은 보랏빛 테두리, 진짜는 물빛 테두리. 나타날 때 · 사라질 때 하얗게 번쩍, 돌진 땐 잔상
        sc.add({ max: sec, draw: (ctx) => {
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
                const k = life - from;
                const flash = !c.real && k < 0.12 ? 1 - k / 0.12 : !c.real && life > c.tOut ? 1 : 0;
                if (flash > 0) {
                    drawMon(ctx, img, x, b, cw, left, flash, '#ffffff', rot);
                }
            }
        } });
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
            if (life >= tBoom && life < tBoom + 0.45) {
                const k = (life - tBoom) / 0.45;
                cross(ctx, px, tx, ty, W * 0.7 * easeOut(k * 4), k < 0.2 ? 3 : 2, 1 - k * k);
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
        // 대폭발 — 하얀 번쩍 · 물기둥 셋 · 큰 고리 · 화면 가르는 X · 표창 조각, 둘레 애들 빙글
        sc.at(tBoom, () => {
            screenFlash(s, 0.6, '#ffffff', 0.3);
            ultShake(8, 520);
            geyser(sc, tx, G, D * 0.35, Math.min(H * 0.85, G - 4), 1.2, cols);
            ring(sc, tx, ty, D * 0.4, Math.max(W, H) * 0.7, 0.75, 0.6, ['#ffffff', cols[1], cols[2]], 3);
            ring(sc, tx, ty, D * 0.3, Math.max(W, H) * 0.45, 0.75, 0.5, ['#ffffff', DARK[1]], 2);
            debris(tx, ty, s, cols, 60, H * 1.3, { ground: G, size: [1, 2, 2] });
            sparkles(tx, ty, s, ['#ffffff', cols[0], cols[1]], 16, D * 0.6, H * 0.3);
            shards(tx, ty, s, Math.max(s, Math.round(D / 22 / s) * s), cols, 12, H * 0.9, G - s);
            for (const r of u.others()) {
                if (Math.abs(r.x - tx) < W * 0.35) {
                    hit(r, r.x < tx ? -1 : 1, 'spin');
                }
            }
        });
        sc.at(tBoom + 0.1, () => {
            for (const f of [-1, 1]) {
                const gx = tx + f * D * 0.9;
                if (gx > D * 0.2 && gx < W - D * 0.2) {
                    geyser(sc, gx, G, D * 0.22, Math.min(H * 0.6, G - 4), 1.0, cols);
                }
            }
        });
        // 진짜 — 반대편에서 연기로 사라졌다가 제자리에 펑
        sc.at(tOut, () => darkPoof(sc, real.to[0], real.to[1] - ch / 2, cw));
        sc.at(tBack, () => {
            darkPoof(sc, me.x, me.b - ch / 2, cw);
            hideMon(pokemon, false);
            ring(sc, u.body.cx, u.body.cy, u.w * 0.4, u.w * 2.2, 0.8, 0.35, ['#ffffff', cols[1]], 2);
        });
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
            ms: (P, o) => (o.clones ? 3500 + 200 * P : o.ninja ? 4000 + 200 * P : o.giant ? 3300 : 2900 + 300 * P),
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
})();
