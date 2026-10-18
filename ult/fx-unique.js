// ───── 전용 필살기 — 인기 · 전설 포켓몬 (2026-10-19 태현 님: 모든 포켓몬 필살기를 리자몽 · 거북왕처럼) ─────
// 데이터 옵션 uniq: '<이름>' 이면 그 틀(fx) 대신 여기 연출 — 틀 이름이 그대로라 필살기 대결 모양도 그대로.
// 그리기 도구는 fx-sky.js 가 ULT_KIT 으로 내줌 (장면 · 꼭두각시 · 불꽃 구 · 빛의 반구 · 번개 …). 이 파일은 fx-sky.js 다음에 붙음 (이름 순)
(() => {
    const K = ULT_KIT;
    const { TAU, rnd, pick, clamp, lerp, easeOut, easeIn, hash, room, strength, short, away, where, makeHit, nearest, scene, jag, drawBolt, ellipse, ring,
        strike, groundArcs, debris, sparkles, skyBand, cloudBank, drawMon, drawLitMon, monBox, hideMon, hideUntil, glint, fireOrb, chargeSwirl, blastDome,
        fireBits, emberRise, impactFrames, beamBody } = K;
    const { ZAPC } = K.pal;
    const hsl = (h, l = 60) => `hsl(${Math.round(((h % 360) + 360) % 360)}, 100%, ${l}%)`;
    const UNIQ = {}; // 이름 → { fx, ms(P, o), run(u, o, ms, pokemon) }

    // 꼭두각시 — 진짜 그림을 숨기고 footAt(t) 높이에 테두리 두른 그림. until 초까지 (그 뒤 진짜 그림이 다시 보임)
    // extra: x(t) 자리 · dx(t) 옆으로 · scale(t) 크기 · rot(t) 기울기 · glow(t) 한 색으로 빛남(glowColor)
    function puppet(sc, pokemon, u, footAt, edgeColor, until, extra) {
        const img = pokemon.el;
        const me = monBox(pokemon);
        const edge = Math.max(1, Math.round(u.s * 0.75));
        hideMon(pokemon, true);
        hideUntil(pokemon, until * 1000 + 100);
        sc.at(until - 0.02, () => hideMon(pokemon, false));
        return sc.add({ max: until, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life >= until - 0.02) {
                return;
            }
            const x = extra?.x ? extra.x(life) : me.x + (extra?.dx?.(life) ?? 0);
            const w = me.w * (extra?.scale?.(life) ?? 1);
            const rot = extra?.rot?.(life) ?? 0;
            drawLitMon(ctx, img, x, footAt(life), w, u.dir < 0, edgeColor, edge, 1, rot);
            const glow = extra?.glow?.(life) ?? 0;
            if (glow > 0.01) {
                drawMon(ctx, img, x, footAt(life), w, u.dir < 0, glow, extra?.glowColor ?? '#ffffff', rot);
            }
        } });
    }

    // ═════ 피카츄 — 1000만볼트 (ultvolt) ═════
    // 먹구름이 몰려와 하늘의 번개가 피카츄에게 연달아 내리꽂히며 충전(몸에 지직 · 빨려 드는 빛줄기) → 폴짝 뛰어올라 전기 구에 감싸임(둘레로 무지개 빛 일곱이 돎)
    // → 임팩트 프레임 · 무지개 번개 일곱 줄기가 부채꼴로 화면 곳곳 땅에 내리꽂힘(닿은 애 벌러덩, 꽂힌 자리마다 전기가 기어감)
    // → 하늘에서 거대한 번개 기둥이 전기 구에 쾅 → 노란 빛의 반구 대폭발 → 사뿐히 내려앉음 (약 7.6초)
    UNIQ.pikachu = { fx: 'ultvolt', ms: (P) => 7600 + 200 * P, run: runPikaVolt };
    function runPikaVolt(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const bandH = Math.max(40, H * 0.3);
        const cloudY = bandH * 0.38;
        const TC0 = 0.3;
        const strikesAt = [0.65, 1.05, 1.38, 1.66, 1.9, 2.08];
        const TJ = 2.3; // 뛰어오름
        const TR = 3.3; // 무지개 번개
        const TP = 4.55; // 하늘 번개 기둥
        const TB = 4.85; // 대폭발
        const TD = TB + 2.0; // 내려앉음
        const Rs = clamp(Math.max(me.w * 0.9, short(u) * 0.13), 10 * s, Math.min(H * 0.22, W * 0.2));
        const top = clamp(me.b - H * 0.32, bandH + me.h * 0.5 + Rs * 1.2, me.b - me.h * 0.3);
        const footAt = (t) => {
            if (t < TJ) {
                return me.b;
            }
            if (t < TD) {
                return lerp(me.b, top, easeOut((t - TJ) / 0.35)) + Math.sin(t * 3.2) * s * 1.2;
            }
            return lerp(top, me.b, easeIn(clamp((t - TD) / 0.45, 0, 1)));
        };
        const core = (t) => [me.x, footAt(t) - me.h * 0.5];
        const sc = scene(u, sec + 0.4, 'uniq pikachu');
        ultDark(0.35, ms - 200);
        let lit = 0;
        let flash = 0;
        sc.tick((t, dt) => {
            lit = Math.max(0, lit - dt);
            flash = Math.max(0, flash - dt * 4);
        });
        skyBand(sc, '#070914', bandH * 1.2, 0.65, sec);
        cloudBank(sc, { y: cloudY, h: bandH * 0.4, cols: ['#6b7090', '#454a63', '#2c3045'], sec, lit: () => (lit > 0 ? 1 : 0), speed: 25 * dir, litCols: ['#ffffff', ZAPC[1], ZAPC[2]] });
        // 전기 구 (피카츄 뒤) — 뛰어오르면 커지고, 대폭발 때 사라짐
        sc.add({ max: TB + 0.05, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TJ + 0.1) {
                return;
            }
            const [x, y] = core(life);
            const k = easeOut((life - TJ - 0.1) / 0.5) * (1 + 0.08 * Math.sin(life * 22)) * (life > TP ? 1 + 0.3 * easeOut((life - TP) / 0.3) : 1);
            fireOrb(ctx, px, s, x, y, Rs, ZAPC, life, k, G, 0.85, 0, [1, 0.85, 0.65, 0.42], 0.4);
            // 무지개 빛 일곱 — 구 둘레를 돎 (꼬리를 끌며)
            for (let i = 0; i < 7; i++) {
                for (let j = 0; j < 6; j++) {
                    const a = life * 4 * dir + (i * TAU) / 7 - j * 0.09 * dir;
                    const rr = Rs * k * 1.3;
                    ctx.globalAlpha = 1 - j / 6;
                    ctx.fillStyle = hsl(i * 51, j ? 62 : 80);
                    const z = j < 2 ? 2 * s : s;
                    ctx.fillRect(px(x + Math.cos(a) * rr - z / 2), px(y + Math.sin(a) * rr * 0.55 - z / 2), z, z);
                }
            }
        } });
        // 몸에 지직 — 오라 가장자리에서 바깥으로 뻗는 짧은 번개 (모을수록 많이)
        sc.add({ max: TB, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TC0) {
                return;
            }
            const [x, y] = core(life);
            const n = 1 + Math.round(3 * clamp((life - TC0) / 1.6, 0, 1));
            for (let j = 0; j < n; j++) {
                const seed = Math.floor(life * 12 + j * 0.41);
                if (hash(seed, j + 40) < 0.3) {
                    continue;
                }
                const a = hash(seed, j) * TAU;
                const r0 = Math.max(me.w, me.h) * 0.45;
                const len = Math.max(me.w, me.h) * (0.4 + 0.4 * hash(seed, j + 9));
                const x0 = x + Math.cos(a) * r0;
                const y0 = y + Math.sin(a) * r0;
                drawBolt(ctx, px, s, jag(x0, y0, x0 + Math.cos(a) * len, y0 + Math.sin(a) * len, Math.max(2 * s, len / 5), 0.3), 1, ZAPC[2], ZAPC[3], 0.9);
            }
        } });
        // 피카츄 (꼭두각시) — 번개에 맞을 때마다 하얗게 번쩍
        puppet(sc, pokemon, u, footAt, ZAPC[2], sec - 0.1, { glow: (t) => flash * 0.8 + clamp((t - TC0) / 1.6, 0, 1) * 0.12 * (1 + Math.sin(t * 20)), glowColor: '#ffffff' });
        // ① 충전 — 빨려 드는 빛줄기 · 하늘 번개가 연달아 내리꽂힘
        chargeSwirl(sc, core, TC0, TJ - 0.05, Math.max(me.w * 4, short(u) * 0.42), Math.max(s * 4, me.w * 0.3), ZAPC, dir);
        strikesAt.forEach((ts, i) => sc.at(ts, () => {
            const [x, y] = core(ts);
            strike(sc, x + rnd(-1, 1) * me.w * 0.8, cloudY, x, y, { w: 2 + (i > 3 ? 1 : 0), mid: ZAPC[2], glow: ZAPC[3], dur: 0.28 });
            lit = 0.12;
            flash = 1;
            ring(sc, x, y, me.w * 0.4, me.w * (1.6 + i * 0.25), 0.85, 0.35, ['#ffffff', ZAPC[2]], 2);
            fireBits(x, y, s, ZAPC, 10, { speed: H * 0.5, life: 0.5 });
            ultShake(1.5 + i * 0.5, 160);
        }));
        // ② 뛰어오름
        sc.at(TJ, () => {
            ring(sc, me.x, G - s, me.w * 0.5, me.w * 3, 0.25, 0.45, ['#ffffff', ZAPC[2]], 2);
            debris(me.x, G - s, s, ['#8a7252', '#5c4a33', ZAPC[2]], 12, H * 0.5);
            ultShake(3, 250);
        });
        // ③ 무지개 번개 일곱 줄기 — 부채꼴로 땅에 내리꽂힘 (다른 포켓몬 자리를 먼저)
        sc.at(TR, () => {
            impactFrames(sc, W, H, 0.7, 0.45);
            ultShake(6 + 2 * P, 1200);
            const [x, y] = core(TR);
            const spots = u.others().map((q) => q.x).slice(0, 7);
            for (let i = spots.length; i < 7; i++) {
                spots.push(clamp(x + (i % 2 ? -1 : 1) * W * (0.12 + 0.11 * i) * (i % 2 ? 0.6 : 1) * dir, W * 0.04, W * 0.96));
            }
            spots.forEach((tx, i) => {
                sc.at(TR + i * 0.06, () => {
                    strike(sc, x, y, tx, G - s, { w: 3, rainbow: 1, hue: i * 105, dur: 1.0, branches: 1, amp: 0.14 }); // 0.06초씩 늦게 시작해서 색이 겹치지 않게 105도씩
                    ring(sc, tx, G - s, s * 2, W * 0.12, 0.25, 0.5, ['#ffffff', hsl(i * 51, 70)], 2);
                    groundArcs(sc, tx, G - s, W * 0.14, 1.0, hsl(i * 51, 70), 2, 1, G - s);
                    fireBits(tx, G - s, s, ['#ffffff', hsl(i * 51, 75), hsl(i * 51 + 30, 60)], 14, { angle: -Math.PI / 2, spread: 2, speed: H * 0.6, g: H * 1.5, life: 0.7 });
                });
            });
            for (const q of u.others()) {
                sc.at(TR + 0.1, () => hit(where(u, q), away(u, q.x), 'tumble'));
            }
        });
        // ④ 하늘에서 거대한 번개 기둥이 전기 구에 쾅
        sc.at(TP, () => {
            const [x, y] = core(TP);
            strike(sc, x, 0, x, y, { w: 6, mid: ZAPC[1], glow: ZAPC[3], dur: 0.45, branches: 4 });
            lit = 0.3;
            flash = 1;
            ultShake(5, 400);
            sc.add({ max: 0.5, draw: (ctx, it, t, px) => {
                const hw = Rs * (0.9 - 0.5 * t);
                ctx.globalAlpha = 0.5 * (1 - t);
                ctx.fillStyle = ZAPC[2];
                ctx.fillRect(px(x - hw), 0, px(2 * hw), px(y));
                ctx.globalAlpha = 0.9 * (1 - t);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(px(x - hw * 0.35), 0, px(hw * 0.7), px(y));
            } });
        });
        // ⑤ 대폭발 — 노란 빛의 반구 (피카츄는 그 위에 다시 그림)
        sc.at(TB, () => {
            impactFrames(sc, W, H, 0.75, 0.5);
            blastDome(sc, me.x, G, clamp(Math.max(H * 0.5, W * 0.3), 30, Math.min(G * 0.92, W * 0.5)), 2.0, ZAPC);
            ring(sc, me.x, G - s, Rs, W * 0.8, 0.25, 0.8, ['#ffffff', ZAPC[1], ZAPC[2]], 3);
            ultShake(9 + 3 * P, 1300);
            for (const q of u.others()) {
                sc.at(TB + 0.2, () => hit(where(u, q), away(u, q.x), 'lift', 0.5));
            }
            puppet(sc, pokemon, u, footAt, ZAPC[2], sec - 0.1, { glow: (t) => (t < TB + 0.3 ? 0.9 : 0.15 * (1 + Math.sin(t * 20))), glowColor: '#ffffff' });
        });
        emberRise(sc, TB + 0.5, sec, ZAPC);
        sc.at(TD + 0.45, () => {
            ring(sc, me.x, G - s, me.w * 0.4, me.w * 2, 0.25, 0.4, [ZAPC[1], ZAPC[2]], 1);
            sparkles(me.x, me.b - me.h * 0.5, s, ZAPC, 12, me.w, H * 0.15);
        });
    }

    // ═════ 팬텀 — 섀도볼 (ultorb) ═════
    // 화면이 새까매지고 땅에 보랏빛 안개가 깔림 → 하늘에 거대한 웃는 얼굴(빨간 눈 · 이빨 웃음)이 스르륵 → 팬텀이 둥실 떠서 머리 위에 섀도볼을 키움
    // (유령 기운이 소용돌이치며 빨려 듦) → 작은 섀도볼을 여러 개 난사(유령 꼬리를 끌며 다른 포켓몬 · 땅에 하나씩 펑) → 하늘 얼굴이 크게 웃음
    // → 거대한 섀도볼을 던짐 → 임팩트 프레임 · 보랏빛 빛의 반구 → 얼굴이 히죽 웃으며 사라짐 (약 6.8초)
    const GHOST = ['#efe0ff', '#a87ee6', '#6b3fb0', '#3a1f66'];
    UNIQ.gengar = { fx: 'ultorb', ms: (P) => 6800 + 200 * P, run: runGengarBall };
    // 하늘의 웃는 얼굴 — (x, y) 가운데, 크기 R. open 0~1 웃음 크기, eye 0~1 눈 번쩍
    function grinFace(ctx, px, s, x, y, R, alpha, open, eye) {
        if (alpha <= 0.01) {
            return;
        }
        const c = s * Math.max(1, Math.round(R / (40 * s)));
        const fill = (x0, y0, w, h, col, a) => {
            ctx.globalAlpha = a * alpha;
            ctx.fillStyle = col;
            ctx.fillRect(px(x0), px(y0), Math.max(c, px(w)), Math.max(c, px(h)));
        };
        // 눈 — 안쪽이 아래로 처진 빨간 아몬드 (화난 눈) · 하얀 눈동자
        const ew = R * 0.36;
        const eh = R * 0.2;
        for (const sd of [-1, 1]) {
            const ex = x + sd * R * 0.4;
            const ey = y - R * 0.3;
            for (let gx = -ew / 2; gx <= ew / 2; gx += c) {
                const f = (gx + ew / 2) / ew; // 0 → 1 (왼쪽 → 오른쪽)
                const inner = sd > 0 ? 1 - f : f; // 안쪽(얼굴 가운데) 쪽 1
                const top = ey - eh * 0.5 + eh * 0.55 * inner;
                const bot = ey + eh * 0.5 * (1 - 0.25 * inner) * Math.sqrt(Math.max(0, Math.sin(Math.PI * Math.min(1, f * 0.98 + 0.01))));
                if (bot - top < c) {
                    continue;
                }
                fill(ex + gx, top - c, c, bot - top + 2 * c, '#2a0010', 0.9);
                fill(ex + gx, top, c, bot - top, eye > 0.5 ? '#ffffff' : '#ff2a4a', 1);
            }
            fill(ex + sd * -ew * 0.12 - c, ey - c * 0.5, c * 2, c * 2, '#ffffff', 0.95);
        }
        // 웃음 — 입꼬리가 올라간 초승달 · 위아래 뾰족한 이빨
        const mw = R * 0.95;
        const deep = R * (0.26 + 0.22 * open);
        for (let gx = -mw; gx <= mw; gx += c) {
            const f = gx / mw;
            const top = y + R * 0.18 - R * 0.22 * f * f;
            const hgt = deep * Math.pow(Math.max(0, 1 - f * f), 0.7);
            if (hgt < c) {
                continue;
            }
            const bot = top + hgt;
            fill(x + gx, top - c, c, hgt + 2 * c, '#2a0a3a', 0.95);
            fill(x + gx, top, c, hgt, '#1a0522', 1);
            const k = (Math.round(gx / c) % 6 + 6) % 6;
            const toothUp = hgt * 0.45 * (1 - Math.abs(k - 2.5) / 3);
            const toothDn = hgt * 0.4 * (1 - Math.abs(((k + 3) % 6) - 2.5) / 3);
            fill(x + gx, top, c, toothUp, '#ffffff', 1);
            fill(x + gx, bot - toothDn, c, toothDn, '#f0e8ff', 1);
        }
    }
    function runGengarBall(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const lift = me.h * 0.25;
        const TF = 0.35; // 얼굴
        const TC0 = 0.6; // 모으기
        const TS = 2.2; // 작은 섀도볼 난사
        const TL = 3.0; // 크게 웃음
        const TT = 3.25; // 거대한 섀도볼 던짐
        const TFLY = 0.5;
        const TB = TT + TFLY; // 맞음
        const faceR = clamp(Math.min(W * 0.26, H * 0.32), 30, 180);
        const fx0 = W / 2;
        const fy0 = clamp(H * 0.3, faceR * 0.7, Math.max(faceR * 0.7, G - faceR * 1.6));
        const Rb = clamp(Math.max(me.w * 0.55, short(u) * 0.1), 6 * s, H * 0.14);
        const footAt = (t) => me.b - lift * easeOut(clamp((t - 0.2) / 0.5, 0, 1)) * (t > sec - 0.6 ? clamp((sec - 0.15 - t) / 0.45, 0, 1) : 1) + Math.sin(t * 3) * s;
        const ball = (t) => [me.x + dir * me.w * 0.1, footAt(t) - me.h - Rb * 1.2];
        const q = nearest(u);
        const tx = q ? q.x : clamp(me.x + dir * W * 0.45, W * 0.1, W * 0.9);
        const sc = scene(u, sec + 0.4, 'uniq gengar');
        ultDark(0.6, ms - 200);
        // 땅에 깔리는 보랏빛 안개
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp(life / 0.6, 0, 1) * clamp((sec - life) / 0.6, 0, 1);
            const paths = [new Path2D(), new Path2D()];
            const c = Math.max(s, Math.round(short(u) / 90));
            for (let x = 0; x < W; x += c * 2) {
                const hgt = (Math.sin(x * 0.03 + life * 1.5) * 0.5 + 0.7 + 0.4 * Math.sin(x * 0.011 - life)) * H * 0.07;
                paths[0].rect(Math.round(x / c) * c, Math.round((G - hgt) / c) * c, c * 2, hgt + c);
                paths[1].rect(Math.round(x / c) * c, Math.round((G - hgt * 0.5) / c) * c, c * 2, hgt * 0.5 + c);
            }
            ctx.globalAlpha = 0.35 * a;
            ctx.fillStyle = GHOST[2];
            ctx.fill(paths[0]);
            ctx.globalAlpha = 0.45 * a;
            ctx.fillStyle = GHOST[1];
            ctx.fill(paths[1]);
        } });
        // 하늘의 웃는 얼굴
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp((life - TF) / 0.7, 0, 1) * clamp((sec - 0.3 - life) / 0.6, 0, 1) * 0.75;
            const open = life > TL ? 0.6 + 0.4 * Math.abs(Math.sin((life - TL) * 9)) * clamp((TB + 0.6 - life) / 0.3, 0, 1) : 0.2;
            const eye = (life > TL && life < TL + 0.12) || (life > TB && life < TB + 0.1) ? 1 : 0;
            grinFace(ctx, px, s, fx0, fy0 + Math.sin(life * 1.4) * s * 2, faceR * (1 + 0.04 * Math.sin(life * 2)), a, open, eye);
        } });
        // 팬텀 (꼭두각시) — 둥실
        puppet(sc, pokemon, u, footAt, GHOST[1], sec - 0.1, { glow: (t) => clamp((t - TC0) / 1.5, 0, 1) * 0.15 * (1 + Math.sin(t * 9)), glowColor: GHOST[0] });
        // 머리 위 섀도볼 — 키움 (던질 때까지)
        chargeSwirl(sc, ball, TC0, TT - 0.1, Math.max(me.w * 4, short(u) * 0.45), Math.max(s * 4, Rb * 0.6), GHOST, dir);
        const shadowBall = (ctx, px, x, y, r, life, a = 1) => {
            fireOrb(ctx, px, s, x, y, r, GHOST, life, 1, G, a, 0, [1.1, 0.92, 0.7, 0.45], 0.5);
            // 속은 검게 · 보랏빛 소용돌이
            const sw = new Path2D();
            for (let i = 0; i < 14; i++) {
                const an = (i / 14) * TAU - life * 7;
                const rr = r * (0.2 + 0.4 * ((i % 3) / 2));
                sw.rect(px(x + Math.cos(an) * rr), px(y + Math.sin(an) * rr), s, s);
            }
            ctx.globalAlpha = a;
            ctx.fillStyle = '#12061f';
            ctx.fillRect(px(x - r * 0.3), px(y - r * 0.3), px(r * 0.6), px(r * 0.6));
            ctx.fillStyle = GHOST[1];
            ctx.fill(sw);
        };
        sc.add({ max: TT + 0.02, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TC0) {
                return;
            }
            const [x, y] = ball(life);
            const k = easeOut((life - TC0) / 1.4) * (1 + 0.1 * Math.max(0, Math.sin(life * 8)) ** 4);
            shadowBall(ctx, px, x, y, Rb * k, life);
        } });
        // 작은 섀도볼 난사 — 다른 포켓몬 (모자라면 땅 곳곳)
        const spots = u.others().map((r) => ({ r, x: r.x }));
        while (spots.length < 5) {
            spots.push({ x: clamp(me.x + dir * W * (0.2 + 0.16 * spots.length) * (spots.length % 2 ? 1 : 0.7), W * 0.05, W * 0.95) });
        }
        spots.slice(0, 6).forEach((sp, i) => {
            const t0 = TS + i * 0.12;
            sc.at(t0, () => {
                const [x0, y0] = ball(t0);
                const r0 = Rb * 0.45;
                ultShake(1.5, 120);
                sc.add({ max: 0.6, trail: [],
                    update: (b) => {
                        const k = clamp(b.life / 0.45, 0, 1);
                        const cur = sp.r ? where(u, sp.r) : null;
                        const ex = cur ? cur.x : sp.x;
                        const ey = cur ? cur.y : G - r0;
                        const cxq = (x0 + ex) / 2;
                        const cyq = Math.min(y0, ey) - H * 0.15;
                        b.x = (1 - k) * (1 - k) * x0 + 2 * (1 - k) * k * cxq + k * k * ex;
                        b.y = (1 - k) * (1 - k) * y0 + 2 * (1 - k) * k * cyq + k * k * ey;
                        b.trail.unshift([b.x, b.y]);
                        b.trail.length = Math.min(b.trail.length, 7);
                        if (k >= 1 && !b.done) {
                            b.done = true;
                            b.max = 0;
                            ring(sc, b.x, b.y, r0, r0 * 4, 0.85, 0.35, ['#ffffff', GHOST[1], GHOST[2]], 2);
                            fireBits(b.x, b.y, s, GHOST, 14, { speed: H * 0.5, life: 0.6 });
                            if (sp.r) {
                                hit(where(u, sp.r), away(u, sp.r.x), 'tumble');
                            }
                            ultShake(2.5, 160);
                        }
                    },
                    draw: (ctx, b, tt, px) => {
                        b.trail.forEach(([x, y], j) => {
                            ctx.globalAlpha = 0.5 * (1 - j / 7);
                            ctx.fillStyle = j < 3 ? GHOST[1] : GHOST[2];
                            const z = Math.max(s, r0 * (1 - j / 7));
                            ctx.fillRect(px(x - z / 2), px(y - z / 2), z, z);
                        });
                        shadowBall(ctx, px, b.x, b.y, r0, b.life + i);
                    } });
            });
        });
        // 거대한 섀도볼 — 가장 가까운 애 (없으면 앞쪽)에게
        sc.at(TT, () => ultShake(3, 200));
        sc.add({ max: TB + 0.02, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TT) {
                return;
            }
            const k = (life - TT) / TFLY;
            const [x0, y0] = ball(TT);
            const ey = G - Rb;
            const x = lerp(x0, tx, k);
            const y = lerp(y0, ey, k * k) - Math.sin(k * Math.PI) * H * 0.08;
            shadowBall(ctx, px, x, y, Rb * 1.1, life);
        } });
        sc.at(TB, () => {
            impactFrames(sc, W, H, 0.6, 0.6);
            blastDome(sc, tx, G, clamp(Math.max(H * 0.45, Rb * 5), 30, Math.min(G * 0.92, W * 0.5)), 2.0, GHOST);
            ring(sc, tx, G - s, Rb, W * 0.7, 0.25, 0.8, ['#ffffff', GHOST[1], GHOST[2]], 3);
            ultShake(8 + 3 * P, 1100);
            for (const r of u.others()) {
                sc.at(TB + 0.15, () => hit(where(u, r), away(u, r.x), 'lift', 0.5));
            }
        });
        emberRise(sc, TB + 0.4, sec, GHOST);
    }

    // ═════ 잠만보 — 기가임팩트 (ultdive) ═════
    // 쿨쿨 자다(Z 가 피어오름) 번쩍 눈을 뜨고 "!" → 하얀 기운이 활활 · 땅이 우르릉, 돌덩이가 떠오름 → 땅을 박차고 화면 위로 휙 (먼지 고리)
    // → 과녁 땅에 그림자가 점점 커짐 · 바람 가르는 줄 → 1.6배로 커진 잠만보가 쿵! 내리꽂힘 — 임팩트 프레임 · 화면 전체 흔들림 · 땅 충격파 세 겹
    // · 땅 금이 화면 끝까지 · 모두 튀어 오름 · 흙먼지 · 주황빛 빛의 반구 → 깡충 제자리로 돌아와 다시 쿨쿨 (약 7.2초)
    const SNOR = ['#ffffff', '#fff4c2', '#ffb94d', '#ff7a1a'];
    UNIQ.snorlax = { fx: 'ultdive', ms: (P) => 7200 + 200 * P, run: runGigaImpact };
    // Z — 작은 도트 글자
    function zGlyph(ctx, px, s, x, y, z, color, a) {
        ctx.globalAlpha = a;
        ctx.fillStyle = color;
        const n = 4;
        for (let i = 0; i < n; i++) {
            ctx.fillRect(px(x + i * z), px(y), z, z);
            ctx.fillRect(px(x + i * z), px(y + (n - 1) * z), z, z);
            ctx.fillRect(px(x + (n - 1 - i) * z), px(y + i * z), z, z);
        }
    }
    function runGigaImpact(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TWAKE = 0.75; // 눈 번쩍
        const TC0 = 0.9; // 기운
        const TJ = 2.1; // 뛰어오름
        const TGONE = TJ + 0.3;
        const TF = 3.2; // 내려옴
        const TI = 3.55; // 쿵
        const TBACK = TI + 2.1; // 돌아감
        const THOME = TBACK + 0.55;
        const BIG = 1.6;
        const q = nearest(u);
        let tx = q ? q.x : me.x + dir * W * 0.4;
        if (Math.abs(tx - me.x) < me.w * 1.2) {
            tx = me.x + (Math.sign(tx - me.x) || dir) * me.w * 1.2;
        }
        tx = clamp(tx, me.w * BIG * 0.5, W - me.w * BIG * 0.5);
        const scaleAt = (t) => (t < TF ? 1 : t < TBACK ? lerp(BIG, 1, easeOut(clamp((t - TI - 0.8) / 0.9, 0, 1))) : 1);
        const xAt = (t) => (t < TF ? me.x : t < TBACK ? tx : lerp(tx, me.x, clamp((t - TBACK) / (THOME - TBACK), 0, 1)));
        const footAt = (t) => {
            if (t < TJ) {
                return me.b;
            }
            if (t < TF) {
                return lerp(me.b, -me.h * 0.2, easeIn((t - TJ) / (TGONE - TJ)));
            }
            if (t < TI) {
                return lerp(-me.h * BIG, G, easeIn((t - TF) / (TI - TF)));
            }
            if (t < TBACK) {
                return G;
            }
            const k = clamp((t - TBACK) / (THOME - TBACK), 0, 1);
            return lerp(G, me.b, k) - Math.sin(k * Math.PI) * me.h * 0.6;
        };
        const sc = scene(u, sec + 0.4, 'uniq snorlax');
        ultDark(0.3, ms - 200);
        // Z — 자는 동안 · 끝에 다시
        const zzz = (t0, t1) => sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < t0 || life > t1) {
                return;
            }
            for (let i = 0; i < 3; i++) {
                const ph = ((life - t0) * 0.9 + i / 3) % 1;
                const z = Math.max(s, Math.round((me.w * (0.05 + 0.04 * ph)) / s) * s);
                zGlyph(ctx, px, s, xAt(life) + dir * me.w * (0.25 + ph * 0.3), footAt(life) - me.h * (0.9 + ph * 0.9), z, '#ffffff', Math.sin(ph * Math.PI) * 0.9);
            }
        } });
        zzz(0, TWAKE);
        zzz(THOME + 0.2, sec);
        // 하얀 기운 · 떠오르는 돌덩이
        sc.add({ max: TJ + 0.1, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - TC0) / 0.4, 0, 1);
            if (k > 0.02) {
                K.flameTongue(ctx, px, s, me.x, me.b + s * 2, me.w * 1.2, me.h * (1.3 + 0.1 * Math.sin(life * 9)), SNOR, life, k);
            }
        } });
        const rocks = [];
        for (let i = 0; i < 12; i++) {
            const side = i % 2 ? -1 : 1;
            rocks.push({ x: clamp(me.x + side * (me.w * 0.7 + W * 0.25 * hash(i, 301)), s * 3, W - s * 3), t0: TC0 + i * 0.06, h: me.h * (0.4 + 0.9 * hash(i, 302)), z: Math.max(2 * s, me.w * (0.08 + 0.1 * hash(i, 303))), ph: hash(i, 304) * TAU });
        }
        sc.add({ max: TI + 0.1, draw: (ctx, it, t, px) => {
            const life = sc.t;
            for (const r of rocks) {
                if (life < r.t0) {
                    continue;
                }
                const fall = life > TJ ? easeIn(clamp((life - TJ) / 0.5, 0, 1)) : 0;
                const y = G - r.z * 0.3 - r.h * easeOut((life - r.t0) / 0.6) * (1 - fall) + Math.sin(life * 3 + r.ph) * s;
                K.psyRock(ctx, px, s, r.x, y, r.z, 0.4, SNOR[2]);
            }
        } });
        // 과녁 그림자 — 점점 커지고 진해짐
        sc.add({ max: TI, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TGONE) {
                return;
            }
            const k = clamp((life - TGONE) / (TI - TGONE), 0, 1);
            ellipse(ctx, px, s, tx, G - s, me.w * BIG * 0.6 * (0.3 + 0.7 * k), me.w * 0.12 * (0.3 + 0.7 * k), '#000000', 0.25 + 0.35 * k, G + s);
            if (Math.floor(life * 8) % 2 === 0) {
                ellipse(ctx, px, s, tx, G - s, me.w * BIG * 0.7, me.w * 0.15, SNOR[3], 0.25, G + s);
            }
        } });
        // 바람 가르는 줄 — 떨어지는 동안 위에서 아래로
        sc.add({ max: TI, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TF - 0.1) {
                return;
            }
            const y = footAt(life);
            ctx.globalAlpha = 0.6;
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 6; i++) {
                const x = tx + (hash(i, 311) - 0.5) * me.w * BIG;
                const len = H * (0.15 + 0.2 * hash(i, 312));
                ctx.fillRect(px(x), px(y - me.h * BIG - len), s, px(len));
            }
        } });
        // 잠만보 (꼭두각시)
        puppet(sc, pokemon, u, footAt, SNOR[2], sec - 0.1, {
            x: xAt, scale: scaleAt,
            glow: (t) => (t > TWAKE && t < TJ ? clamp((t - TC0) / 0.6, 0, 1) * 0.15 * (1 + Math.sin(t * 12)) : t > TI && t < TI + 0.2 ? 0.8 : 0),
            glowColor: '#ffffff',
        });
        // "!" — 눈 번쩍
        sc.add({ max: TWAKE + 0.7, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TWAKE) {
                return;
            }
            const k = easeOut((life - TWAKE) / 0.15);
            const z = Math.max(s, Math.round((me.w * 0.07) / s) * s);
            const x = me.x + dir * me.w * 0.35;
            const y = me.b - me.h * 1.05 - (1 - k) * me.h * 0.2;
            ctx.globalAlpha = 1;
            ctx.fillStyle = SNOR[3];
            ctx.fillRect(px(x - z), px(y - z * 5), z * 3, z * 6);
            ctx.fillRect(px(x - z), px(y + z * 2), z * 3, z * 3);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(px(x), px(y - z * 4), z, z * 4);
            ctx.fillRect(px(x), px(y + z * 3), z, z);
        } });
        sc.at(TWAKE, () => {
            ring(sc, me.x, me.b - me.h * 0.5, me.w * 0.4, me.w * 1.8, 0.85, 0.3, ['#ffffff', SNOR[2]], 2);
            ultShake(2, 200);
        });
        [1.2, 1.55, 1.85].forEach((tb, i) => sc.at(tb, () => {
            ring(sc, me.x, G - s, me.w * 0.5, me.w * (2 + i), 0.25, 0.4, [SNOR[1], SNOR[2]], 1);
            ultShake(2 + i, 200);
        }));
        // 뛰어오름
        sc.at(TJ, () => {
            ring(sc, me.x, G - s, me.w * 0.4, me.w * 3.5, 0.25, 0.5, ['#ffffff', SNOR[1]], 2);
            debris(me.x, G - s, s, ['#8a7252', '#5c4a33', '#bda27a'], 24, H * 0.7, { ground: G });
            for (let i = 0; i < 3; i++) {
                K.puff(me.x + rnd(-0.6, 0.6) * me.w, G - s * 2, s, '#c9b896', me.w * 0.15, me.w * 0.4, rnd(0.5, 0.8), rnd(-60, 60), -rnd(10, 30), 0.25);
            }
            ultShake(5, 400);
        });
        // 쿵!
        sc.at(TI, () => {
            impactFrames(sc, W, H, 0.8, 0.55);
            ultShake(12 + 3 * P, 1600);
            blastDome(sc, tx, G, clamp(Math.max(H * 0.5, me.w * BIG * 1.6), 30, Math.min(G * 0.92, W * 0.5)), 1.9, SNOR);
            for (let j = 0; j < 3; j++) {
                sc.at(TI + j * 0.15, () => ring(sc, tx, G - s, me.w, W * (0.6 + j * 0.25), 0.18, 0.8, j ? [SNOR[1], SNOR[2]] : ['#ffffff', SNOR[1], SNOR[2]], 3 - j));
            }
            groundArcs(sc, tx, G - s, W, 1.2, SNOR[1], 6, 2, G - s);
            debris(tx, G - s, s, ['#8a7252', '#5c4a33', '#bda27a', SNOR[2]], 50, H * 1.2, { ground: G, size: [1, 2, 3] });
            for (let i = 0; i < 6; i++) {
                const side = i % 2 ? -1 : 1;
                K.puff(tx + side * rnd(0.6, 1.6) * me.w * BIG, G - s * 2, s, '#c9b896', me.w * 0.2, me.w * 0.55, rnd(0.6, 1), side * rnd(60, 180), -rnd(10, 30), 0.28);
            }
            debris(tx, G - s, s, ['#c9b896', '#bda27a', '#e6d6b8'], 40, H * 0.5, { angle: -Math.PI / 2, spread: 2.6, ground: G, life: 1.2 });
            for (const r of u.others()) {
                sc.at(TI + Math.abs(r.x - tx) / (W * 2), () => hit(where(u, r), away(u, r.x), 'lift', 0.4));
            }
        });
        sc.at(THOME, () => {
            ring(sc, me.x, G - s, me.w * 0.4, me.w * 2, 0.25, 0.35, [SNOR[1], SNOR[2]], 1);
            ultShake(3, 200);
        });
    }

    // ═════ 갸라도스 — 파괴광선 (ultbeam) ═════
    // 먹구름 · 장대비 · 구름 속 번쩍 → 발밑에 물 소용돌이, 몸이 솟으며 세 번 포효(입에서 퍼지는 고리 · 흔들림) → 입에 주황 빛이 빨려 들어 커짐
    // → 임팩트 프레임 · 굵은 파괴광선이 바로 앞 땅부터 저 멀리까지 휩쓸며 지나감 (닿은 땅마다 차례로 폭발 · 흙 · 닿은 애 벌러덩)
    // → 마지막 자리에서 주황빛 빛의 반구 → 비가 그침 (약 7.6초)
    const HYPER = ['#ffffff', '#fff4c2', '#ffb94d', '#ff7a1a'];
    UNIQ.gyarados = { fx: 'ultbeam', ms: (P) => 7600 + 200 * P, run: runGyaraBeam };
    function runGyaraBeam(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const bandH = Math.max(40, H * 0.3);
        const lift = me.h * 0.18;
        const roars = [0.75, 1.15, 1.55];
        const TC0 = 1.4; // 모으기
        const TF = 2.5; // 쏨
        const SW = 1.5; // 휩쓰는 시간
        const TE = TF + SW; // 마지막 자리 대폭발
        const footAt = (t) => me.b - lift * easeOut(clamp((t - 0.4) / 0.6, 0, 1)) * (1 - easeIn(clamp((t - (sec - 0.7)) / 0.5, 0, 1))) + Math.sin(t * 2.6) * s;
        const mouthAt = (t) => [u.mouth.x + dir * s * 2, u.mouth.y - (me.b - footAt(t))];
        const bw = clamp(H * 0.11 * (0.9 + 0.3 * P), 8 * s, H * 0.2);
        // 휩쓰는 각도 — 바로 앞 땅 → 화면 끝 땅
        const [mx0, my0] = mouthAt(TF);
        const drop = Math.max(s * 6, G - my0 - bw * 0.3);
        const far = dir > 0 ? W - mx0 : mx0;
        const d0 = Math.max(me.w * 0.6, far * 0.12);
        const d1 = Math.max(far * 0.98, me.w);
        // 닿는 땅이 고르게 앞으로 (각도로 나누면 끝에서만 확 빨라짐)
        const angAt = (t) => {
            const k = clamp((t - TF - 0.15) / (SW - 0.15), 0, 1);
            return Math.atan2(drop, lerp(d0, d1, k * k * (3 - 2 * k)));
        };
        const contactX = (t) => {
            const [mx, my] = mouthAt(t);
            return mx + (dir * (G - my)) / Math.tan(angAt(t));
        };
        const sc = scene(u, sec + 0.4, 'uniq gyarados');
        ultDark(0.4, ms - 200);
        let lit = 0;
        sc.tick((t, dt) => {
            lit = Math.max(0, lit - dt);
        });
        skyBand(sc, '#060c18', bandH * 1.2, 0.7, sec);
        cloudBank(sc, { y: bandH * 0.38, h: bandH * 0.42, cols: ['#5f6b86', '#3d4660', '#272e42'], sec, lit: () => (lit > 0 ? 1 : 0), speed: 30 * dir, litCols: ['#ffffff', '#dbe8ff', '#9fb4e0'] });
        K.waterRain(sc, 0.2, sec - 0.4, K.pal.TIDE);
        [0.5, 1.3, 2.2, 3.6].forEach((tb) => sc.at(tb, () => {
            lit = 0.1;
            strike(sc, rnd(0.1, 0.9) * W, bandH * 0.3, rnd(0.1, 0.9) * W, bandH * 0.9 + rnd(0, H * 0.1), { w: 1, mid: '#dbe8ff', glow: '#6c88c8', dur: 0.2, branches: 1 });
        }));
        // 발밑 물 소용돌이
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp((life - 0.3) / 0.4, 0, 1) * clamp((sec - 0.4 - life) / 0.4, 0, 1);
            if (a > 0.02) {
                K.swirlRing(ctx, px, s, me.x, G - s, me.w * (0.9 + 0.1 * Math.sin(life * 5)), 0.22, life, dir, K.pal.TIDE, a);
                K.swirlRing(ctx, px, s, me.x, G - s, me.w * 0.55, 0.22, life * 1.4, dir, K.pal.TIDE, a * 0.8);
            }
        } });
        // 갸라도스 (꼭두각시)
        puppet(sc, pokemon, u, footAt, '#6cc3ff', sec - 0.1, { glow: (t) => (t > TF - 0.05 && t < TF + 0.12 ? 0.8 : clamp((t - TC0) / 1, 0, 1) * (t < TF ? 0.15 * (1 + Math.sin(t * 16)) : 0)), glowColor: '#fff4c2' });
        // 포효 — 입에서 퍼지는 고리
        roars.forEach((tr, i) => sc.at(tr, () => {
            const [mx, my] = mouthAt(tr);
            for (let j = 0; j < 2; j++) {
                sc.at(tr + j * 0.08, () => ring(sc, mx, my, me.w * 0.3, me.w * (2.2 + i * 0.6), 0.9, 0.5, ['#ffffff', '#bfe9ff'], 2 - j));
            }
            K.splash(me.x, G - s, s, K.pal.TIDE, 10, H * 0.6);
            ultShake(3 + i * 1.5, 300);
            lit = 0.08;
        }));
        // 모으기 — 입 앞 주황 빛
        chargeSwirl(sc, mouthAt, TC0, TF - 0.05, Math.max(me.w * 3.5, short(u) * 0.4), Math.max(s * 4, bw * 0.4), HYPER, dir);
        sc.add({ max: TF + 0.1, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TC0) {
                return;
            }
            const [mx, my] = mouthAt(life);
            const k = easeOut((life - TC0) / (TF - TC0)) * (1 + 0.1 * Math.max(0, Math.sin(life * 10)) ** 4);
            fireOrb(ctx, px, s, mx, my, bw * 0.55, HYPER, life, k, G, 1, 0, [1, 0.8, 0.6, 0.38], 0.3);
        } });
        // 쏨 — 휩쓰는 파괴광선
        sc.at(TF, () => {
            impactFrames(sc, W, H, 0.75, 0.5);
            ultShake(6 + 2 * P, (SW + 0.3) * 1000);
        });
        sc.add({ max: TE + 0.35, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TF) {
                return;
            }
            const [mx, my] = mouthAt(life);
            const a = angAt(life);
            const ux = Math.cos(a) * dir;
            const uy = Math.sin(a);
            const len = (G - my) / Math.max(0.05, uy);
            const fade = life > TE ? 1 - (life - TE) / 0.35 : 1;
            const ww = bw * (life < TF + 0.15 ? 1.4 - 0.4 * ((life - TF) / 0.15) : 1) * (0.92 + 0.08 * Math.sin(life * 40)) * fade;
            beamBody(ctx, px, s, mx, my, ux, uy, len + bw * 0.3, ww, HYPER, life, 1, G);
            fireOrb(ctx, px, s, mx, my, bw * 0.5, HYPER, life, 1, G, fade, 0, [1, 0.8, 0.6, 0.38], 0.3);
            // 닿은 땅 — 빛 덩이
            const cx = mx + ux * len;
            ellipse(ctx, px, s, cx, G - s, bw * 1.3, bw * 0.35, HYPER[2], 0.7 * fade, G + s);
            ellipse(ctx, px, s, cx, G - s, bw * 0.7, bw * 0.2, '#ffffff', 0.9 * fade, G + s);
        } });
        // 지나간 땅마다 차례로 폭발
        let lastX = null;
        sc.tick((t) => {
            if (t < TF + 0.05 || t > TE) {
                return;
            }
            const cx = contactX(t);
            if (lastX === null || Math.abs(cx - lastX) > bw * 0.9) {
                lastX = cx;
                if (cx > -bw && cx < W + bw) {
                    const R = bw * rnd(0.8, 1.25);
                    sc.add({ max: 0.55, draw: (ctx, q, tt, px) => {
                        fireOrb(ctx, px, s, cx, G, R, HYPER, q.life + cx, easeOut(Math.min(1, tt / 0.3)), G + s, tt > 0.7 ? (1 - tt) / 0.3 : 1, clamp((tt - 0.3) / 0.6, 0, 1));
                    } });
                    debris(cx, G - s, s, ['#8a7252', '#5c4a33', HYPER[2], HYPER[3]], 8, H * 0.6, { ground: G });
                    ultShake(2, 120);
                    for (const r of u.others()) {
                        if (Math.abs(r.x - cx) < bw * 1.5 + r.w * 0.5) {
                            hit(where(u, r), dir, 'tumble');
                        }
                    }
                }
            }
        });
        // 마지막 자리 — 주황빛 빛의 반구
        sc.at(TE, () => {
            const cx = clamp(contactX(TE), W * 0.06, W * 0.94);
            impactFrames(sc, W, H, 0.6, 0.4);
            blastDome(sc, cx, G, clamp(Math.max(H * 0.42, bw * 3.5), 30, Math.min(G * 0.92, W * 0.45)), 1.9, HYPER);
            ring(sc, cx, G - s, bw, W * 0.6, 0.25, 0.8, ['#ffffff', HYPER[1], HYPER[2]], 3);
            ultShake(8 + 2 * P, 1000);
        });
        emberRise(sc, TE + 0.4, sec, HYPER);
    }

    // ═════ 이브이 — 나인에볼부스트 (ultsparkle) ═════
    // 이브이 둘레 하늘에 진화형 일곱(샤미드 · 쥬피썬더 · 부스터 · 에브이 · 블래키 · 리피아 · 글레이시아)이 하나씩 반짝 나타남(각자 제 색 빛)
    // → 일곱이 제 색 빛줄기를 이브이에게 쏘아 넣음 · 이브이가 무지갯빛으로 빛나며 두근 → 진화형들은 빛가루로 흩어지고 임팩트 프레임
    // → 무지개 꼬리를 끌며 가장 가까운 애에게 박치기 → 무지갯빛 빛의 반구 → 제자리로 (약 7.2초)
    const EVOS = [['vaporeon', 1, 'water'], ['jolteon', 1, 'electric'], ['flareon', 1, 'fire'], ['espeon', 2, 'psychic'], ['umbreon', 2, 'dark'], ['leafeon', 4, 'grass'], ['glaceon', 4, 'ice']];
    const PRISM = ['#ffffff', '#fff3b0', '#ffb3e6', '#9ec5ff'];
    const evoImgs = new Map();
    function evoImg(root, name, gen) {
        const src = root.replace(/\/gen\d+\/[a-z]+(_[^/]*)?\/([^/]*)$/, `/gen${gen}/${name}/default`) + '_walk_8fps.gif';
        let img = evoImgs.get(src);
        if (!img) {
            img = new Image();
            img.src = src;
            evoImgs.set(src, img);
        }
        return img;
    }
    UNIQ.eevee = { fx: 'ultsparkle', ms: (P) => 7200 + 200 * P, run: runNineEvo };
    function runNineEvo(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const left = dir < 0;
        const edge = Math.max(1, Math.round(u.s * 0.75));
        const TA = 0.35; // 진화형 나타남 (하나씩)
        const TBEAM = 1.75; // 빛줄기
        const TGO = 3.25; // 흩어짐 · 박치기 시작
        const TDASH = 0.35;
        const THIT = TGO + 0.2 + TDASH;
        const TBACK = THIT + 1.9;
        const q = nearest(u);
        let tx = q ? q.x : me.x + dir * W * 0.4;
        tx = clamp(tx - Math.sign(tx - me.x || dir) * me.w * 0.4, me.w * 0.5, W - me.w * 0.5);
        const cy0 = me.b - me.h * 0.5;
        const Rr = clamp(Math.min(W * 0.3, (G - me.h) * 0.75), me.w * 1.8, Math.max(me.w * 1.8, H * 0.6));
        const ew0 = me.w * 0.95;
        // 반원 가운데 — 패널 끝에 선 애라도 일곱이 다 보이게 안쪽으로
        const ax = clamp(me.x, Math.min(W / 2, Rr + ew0 * 0.6), Math.max(W / 2, W - Rr - ew0 * 0.6));
        const evos = EVOS.map(([name, gen, c], i) => {
            const a = -Math.PI * (0.08 + (0.84 * i) / (EVOS.length - 1));
            return { img: evoImg(pokemon.pokemonRoot || '', name, gen), cols: sigPal(c), t0: TA + i * 0.17,
                x: clamp(ax + Math.cos(a) * Rr, ew0 * 0.6, W - ew0 * 0.6), b: clamp(cy0 + Math.sin(a) * Rr * 0.85 + ew0 * 0.45, ew0 * 1.1, G), w: ew0 };
        });
        const xAt = (t) => (t < TGO + 0.2 ? me.x : t < THIT ? lerp(me.x, tx, easeIn((t - TGO - 0.2) / TDASH)) : t < TBACK ? tx : lerp(tx, me.x, clamp((t - TBACK) / 0.45, 0, 1)));
        const footAt = (t) => (t > TBACK ? me.b - Math.sin(clamp((t - TBACK) / 0.45, 0, 1) * Math.PI) * me.h * 0.4 : me.b);
        const sc = scene(u, sec + 0.4, 'uniq eevee');
        ultDark(0.4, ms - 200);
        // 진화형 — 둥실 · 제 색 테두리 · 발밑 빛
        sc.add({ max: TGO + 0.4, draw: (ctx, it, t, px) => {
            const life = sc.t;
            evos.forEach((e, i) => {
                if (life < e.t0) {
                    return;
                }
                const k = easeOut((life - e.t0) / 0.25);
                const gone = clamp((life - TGO) / 0.3, 0, 1);
                const a = k * (1 - gone);
                if (a <= 0.01) {
                    return;
                }
                const b = e.b + Math.sin(life * 2.5 + i) * s * 1.5;
                K.ringDots(ctx, px, s, e.x, b - e.w * 0.45, e.w * 0.62, 0.9, [e.cols[1], e.cols[2]], 0.6 * a, 1);
                for (const [dx, dy] of [[edge, 0], [-edge, 0], [0, edge], [0, -edge]]) {
                    drawMon(ctx, e.img, e.x + dx, b + dy, e.w * (0.6 + 0.4 * k), left, 0.9 * a, e.cols[1]);
                }
                drawMon(ctx, e.img, e.x, b, e.w * (0.6 + 0.4 * k), left, a);
                if (life < e.t0 + 0.15 || gone > 0) {
                    drawMon(ctx, e.img, e.x, b, e.w * (0.6 + 0.4 * k), left, gone > 0 ? gone : 1 - (life - e.t0) / 0.15, '#ffffff');
                }
            });
        } });
        evos.forEach((e) => sc.at(e.t0, () => {
            ring(sc, e.x, e.b - e.w * 0.45, s * 2, e.w * 1.3, 0.85, 0.35, ['#ffffff', e.cols[1], e.cols[2]], 2);
            sparkles(e.x, e.b - e.w * 0.45, s, ['#ffffff', ...e.cols.slice(0, 3)], 8, e.w * 0.6, H * 0.1);
            ultShake(1.2, 100);
        }));
        // 빛줄기 — 진화형마다 제 색으로 이브이에게
        sc.add({ max: TGO + 0.1, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TBEAM) {
                return;
            }
            evos.forEach((e, i) => {
                const k = clamp((life - TBEAM - i * 0.06) / 0.2, 0, 1);
                if (k <= 0) {
                    return;
                }
                const x0 = e.x;
                const y0 = e.b - e.w * 0.45;
                const dx = me.x - x0;
                const dy = cy0 - y0;
                const L = Math.hypot(dx, dy) || 1;
                beamBody(ctx, px, s, x0, y0, dx / L, dy / L, L * k, Math.max(3 * s, me.w * 0.16), e.cols, life + i, 0.9 * (1 - clamp((life - TGO + 0.1) / 0.2, 0, 1)));
            });
        } });
        [TBEAM + 0.4, TBEAM + 0.8, TBEAM + 1.15].forEach((tb, i) => sc.at(tb, () => {
            ring(sc, me.x, cy0, me.w * 0.4, me.w * (1.8 + i * 0.5), 0.85, 0.4, ['#ffffff', hsl(i * 120, 75)], 2);
            ultShake(1.5 + i, 160);
        }));
        // 무지갯빛 오라 (이브이 뒤)
        sc.add({ max: TBACK, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - TBEAM) / 0.6, 0, 1) * (1 - clamp((life - THIT) / 0.4, 0, 1));
            if (k > 0.02) {
                const h0 = life * 300;
                K.flameTongue(ctx, px, s, xAt(life), footAt(life) + s * 2, me.w * 1.2, me.h * 1.5, [hsl(h0, 90), hsl(h0 + 60, 70), hsl(h0 + 120, 60), hsl(h0 + 180, 50)], life, k);
            }
        } });
        // 박치기 꼬리
        sc.add({ max: THIT + 0.3, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TGO + 0.2) {
                return;
            }
            const x1 = xAt(Math.min(life, THIT));
            const fade = life > THIT ? 1 - (life - THIT) / 0.3 : 1;
            for (let j = 0; j < 7; j++) {
                ctx.globalAlpha = 0.8 * fade;
                ctx.fillStyle = hsl(j * 51 + life * 400, 65);
                const y = cy0 - me.h * 0.3 + (j / 6) * me.h * 0.6;
                ctx.fillRect(Math.min(me.x, x1), Math.round(y), Math.abs(x1 - me.x), Math.max(s, Math.round(me.h * 0.09)));
            }
        } });
        // 이브이 (꼭두각시) — 무지갯빛으로 빛남
        const img = pokemon.el;
        hideMon(pokemon, true);
        hideUntil(pokemon, (sec - 0.1) * 1000 + 100);
        sc.at(sec - 0.12, () => hideMon(pokemon, false));
        sc.add({ max: sec - 0.1, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life >= sec - 0.12) {
                return;
            }
            const x = xAt(life);
            const fy = footAt(life);
            drawLitMon(ctx, img, x, fy, me.w, left, hsl(life * 300, 70), edge, 1);
            const glow = clamp((life - TBEAM) / 1, 0, 1) * (life < THIT ? 0.25 + 0.2 * Math.sin(life * 14) : 0) + (life > TGO && life < TGO + 0.15 ? 0.7 : 0);
            if (glow > 0.01) {
                drawMon(ctx, img, x, fy, me.w, left, glow, hsl(life * 300, 85));
            }
        } });
        // 흩어짐 · 임팩트 프레임
        sc.at(TGO, () => {
            impactFrames(sc, W, H, 0.6, 0.35);
            evos.forEach((e) => sparkles(e.x, e.b - e.w * 0.45, s, ['#ffffff', ...e.cols.slice(0, 2)], 10, e.w * 0.5, H * 0.15));
            ring(sc, me.x, cy0, me.w * 0.5, me.w * 3, 0.85, 0.4, ['#ffffff', PRISM[2], PRISM[3]], 2);
            ultShake(3, 250);
        });
        // 박치기 — 무지갯빛 빛의 반구
        sc.at(THIT, () => {
            impactFrames(sc, W, H, 0.7, 0.45);
            blastDome(sc, clamp(tx + dir * me.w * 0.4, W * 0.06, W * 0.94), G, clamp(Math.max(H * 0.45, me.w * 3), 30, Math.min(G * 0.92, W * 0.45)), 1.8, PRISM);
            ultShake(7 + 2 * P, 1000);
            for (const r of u.others()) {
                sc.at(THIT + 0.1, () => hit(where(u, r), away(u, r.x), Math.abs(r.x - tx) < W * 0.25 ? 'spin' : 'lift', 0.5));
            }
        });
        emberRise(sc, THIT + 0.4, sec, PRISM);
    }

    // ═════ 망나뇽 — 역린 (ultrush) ═════
    // 포효 · 눈이 붉게 번뜩 → 붉은 분노의 오라가 활활 · 발밑 땅이 갈라지고 붉은 번개가 튐 → 화면을 세 번 왕복 질주(붉은 혜성 꼬리 · 벽마다 쾅 · 지나가며 다 튕겨냄)
    // → 하늘로 솟았다 가운데로 내리꽂힘 → 붉은 빛의 반구 → 원작처럼 혼란 — 머리 위로 별이 빙글빙글 돌며 비틀비틀 제자리로 (약 7.6초)
    const RAGE = ['#ffffff', '#ffd0a0', '#ff5a3a', '#a8182a'];
    UNIQ.dragonite = { fx: 'ultrush', ms: (P) => 7600 + 200 * P, run: runOutrage };
    function runOutrage(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TC0 = 0.25; // 오라
        const TEYE = 0.6;
        const TR0 = 1.6; // 질주 시작
        const PASS = 0.5;
        const TURN = 0.18;
        const xL = me.w * 0.6;
        const xR = W - me.w * 0.6;
        const ends = dir > 0 ? [xR, xL, xR] : [xL, xR, xL];
        const legs = [];
        let t = TR0;
        let x = me.x;
        for (const xe of ends) {
            legs.push({ t0: t, t1: t + PASS * (Math.abs(xe - x) / Math.max(1, W * 0.8)) ** 0.5, x0: x, x1: xe });
            t = legs[legs.length - 1].t1 + TURN;
            x = xe;
        }
        const TUP = t; // 하늘로
        const TDIVE = TUP + 0.55;
        const TI = TDIVE + 0.3; // 내리꽂힘
        const cxF = clamp(W / 2, me.w, W - me.w);
        const TDIZZY = TI + 0.5;
        const THOME = sec - 0.6;
        const topY = Math.max(me.h * 1.2, G * 0.25);
        const xAt = (tt) => {
            if (tt < TR0) {
                return me.x;
            }
            for (const L of legs) {
                if (tt < L.t1) {
                    return tt < L.t0 ? L.x0 : lerp(L.x0, L.x1, easeIn((tt - L.t0) / (L.t1 - L.t0)));
                }
                if (tt < L.t1 + TURN) {
                    return L.x1;
                }
            }
            if (tt < TI) {
                return lerp(x, cxF, easeOut(clamp((tt - TUP) / (TI - TUP), 0, 1)));
            }
            if (tt < THOME) {
                return cxF + Math.sin((tt - TDIZZY) * 5) * me.w * 0.15 * (tt > TDIZZY ? 1 : 0);
            }
            return lerp(cxF, me.x, easeOut(clamp((tt - THOME) / 0.5, 0, 1)));
        };
        const footAt = (tt) => {
            if (tt < TUP) {
                return me.b - (tt > TR0 ? Math.abs(Math.sin((tt - TR0) * 14)) * s * 2 : 0);
            }
            if (tt < TDIVE) {
                return lerp(me.b, topY, easeOut((tt - TUP) / (TDIVE - TUP)));
            }
            if (tt < TI) {
                return lerp(topY, G, easeIn((tt - TDIVE) / (TI - TDIVE)));
            }
            return tt < THOME ? G : lerp(G, me.b, clamp((tt - THOME) / 0.5, 0, 1)) - Math.sin(clamp((tt - THOME) / 0.5, 0, 1) * Math.PI) * me.h * 0.3;
        };
        const facingLeft = (tt) => {
            for (const L of legs) {
                if (tt >= L.t0 && tt < L.t1 + TURN) {
                    return L.x1 < L.x0;
                }
            }
            if (tt >= TUP && tt < TI) {
                return cxF < x;
            }
            return dir < 0;
        };
        const sc = scene(u, sec + 0.4, 'uniq dragonite');
        ultDark(0.45, ms - 200);
        // 붉게 물든 화면
        sc.add({ max: sec, draw: (ctx, it, tt, px) => {
            const life = sc.t;
            const a = clamp((life - TC0) / 0.6, 0, 1) * clamp((TDIZZY - life) / 0.5, 0, 1);
            if (a > 0.01) {
                ctx.globalAlpha = 0.14 * a;
                ctx.fillStyle = RAGE[3];
                ctx.fillRect(0, 0, W, H);
            }
        } });
        // 붉은 분노의 오라 (망나뇽 뒤) — 질주 중엔 뒤로 눕힌 불꽃 꼬리
        sc.add({ max: TDIZZY, draw: (ctx, it, tt, px) => {
            const life = sc.t;
            const k = clamp((life - TC0) / 0.4, 0, 1) * (1 - clamp((life - TI) / 0.4, 0, 1));
            if (k <= 0.02) {
                return;
            }
            const xx = xAt(life);
            const fy = footAt(life);
            const v = (xAt(life + 0.02) - xx) / 0.02;
            if (Math.abs(v) > W * 0.6) {
                K.fireTail(ctx, px, s, xx, fy - me.h * 0.5, Math.sign(v), 0, me.w * 2.6, me.h * 1.1, RAGE, life, k); // 가는 쪽 — 꼬리는 뒤로
            } else {
                K.flameTongue(ctx, px, s, xx, fy + s * 2, me.w * 1.25, me.h * (1.45 + 0.15 * Math.sin(life * 9)), RAGE, life, k);
            }
        } });
        // 붉은 번개 — 오라 둘레 (모으는 동안)
        sc.add({ max: TR0, draw: (ctx, it, tt, px) => {
            const life = sc.t;
            if (life < TEYE) {
                return;
            }
            for (let j = 0; j < 3; j++) {
                const seed = Math.floor(life * 10 + j * 0.37);
                if (hash(seed, j + 40) < 0.35) {
                    continue;
                }
                const a = -Math.PI * (0.05 + 0.9 * hash(seed, j));
                const r0 = Math.max(me.w, me.h) * 0.55;
                const len = Math.max(me.w, me.h) * (0.4 + 0.3 * hash(seed, j + 9));
                const x0 = me.x + Math.cos(a) * r0;
                const y0 = me.b - me.h * 0.5 + Math.sin(a) * r0;
                drawBolt(ctx, px, s, jag(x0, y0, x0 + Math.cos(a) * len, y0 + Math.sin(a) * len, Math.max(2 * s, len / 5), 0.3), 1, RAGE[2], RAGE[3], 0.9);
            }
        } });
        // 망나뇽 (꼭두각시)
        const img = pokemon.el;
        const edge = Math.max(1, Math.round(u.s * 0.75));
        hideMon(pokemon, true);
        hideUntil(pokemon, (sec - 0.1) * 1000 + 100);
        sc.at(sec - 0.12, () => hideMon(pokemon, false));
        sc.add({ max: sec - 0.1, draw: (ctx, it, tt, px) => {
            const life = sc.t;
            if (life >= sec - 0.12) {
                return;
            }
            const xx = xAt(life);
            const fy = footAt(life);
            const lf = facingLeft(life);
            const rot = life > TDIVE && life < TI ? (lf ? -0.6 : 0.6) : life > TDIZZY && life < THOME ? Math.sin((life - TDIZZY) * 5) * 0.15 : 0;
            drawLitMon(ctx, img, xx, fy, me.w, lf, RAGE[2], edge, 1, rot);
            const glow = (life > TEYE && life < TEYE + 0.15 ? 0.7 : 0) + clamp((life - TC0) / 0.6, 0, 1) * (life < TI ? 0.12 * (1 + Math.sin(life * 18)) : 0);
            if (glow > 0.01) {
                drawMon(ctx, img, xx, fy, me.w, lf, glow, RAGE[1], rot);
            }
            // 눈 번뜩
            const eye = clamp(1 - Math.abs(life - TEYE - 0.08) / 0.12, 0, 1);
            if (eye > 0) {
                glint(ctx, px, s, xx + dir * me.w * 0.18, fy - me.h * 0.78, me.w * 0.3 * eye, eye);
            }
        } });
        sc.at(TEYE, () => {
            ring(sc, me.x, me.b - me.h * 0.6, me.w * 0.4, me.w * 2.2, 0.9, 0.45, ['#ffffff', RAGE[2]], 2);
            ultShake(3, 300);
            groundArcs(sc, me.x, G - s, me.w * 2.5, 1.2, RAGE[2], 4, 1, G - s);
        });
        // 벽마다 쾅 · 지나가며 튕겨냄
        legs.forEach((L) => sc.at(L.t1, () => {
            const wx = L.x1 > L.x0 ? W - s * 2 : s * 2;
            ring(sc, wx, G - me.h * 0.5, me.w * 0.3, me.w * 2.4, 0.6, 0.4, ['#ffffff', RAGE[1], RAGE[2]], 2);
            K.fireBits(wx, G - me.h * 0.5, s, RAGE, 18, { angle: L.x1 > L.x0 ? Math.PI : 0, spread: 2.2, speed: H * 0.7, life: 0.6 });
            debris(wx, G - s, s, ['#8a7252', '#5c4a33', RAGE[2]], 10, H * 0.5, { ground: G });
            ultShake(5, 250);
        }));
        sc.tick((tt) => {
            if (tt < TR0 || tt > TUP) {
                return;
            }
            const xx = xAt(tt);
            for (const r of u.others()) {
                if (Math.abs(r.x - xx) < me.w * 0.7 + r.w * 0.3) {
                    hit(where(u, r), Math.sign(xAt(tt + 0.02) - xx) || dir, 'spin');
                }
            }
        });
        // 내리꽂힘 — 붉은 빛의 반구
        sc.at(TI, () => {
            impactFrames(sc, W, H, 0.75, 0.5);
            blastDome(sc, cxF, G, clamp(Math.max(H * 0.48, me.w * 3), 30, Math.min(G * 0.92, W * 0.48)), 1.9, RAGE);
            ring(sc, cxF, G - s, me.w, W * 0.8, 0.22, 0.8, ['#ffffff', RAGE[1], RAGE[2]], 3);
            groundArcs(sc, cxF, G - s, W * 0.6, 1.0, RAGE[1], 6, 2, G - s);
            ultShake(10 + 3 * P, 1300);
            for (const r of u.others()) {
                sc.at(TI + 0.15, () => hit(where(u, r), away(u, r.x), 'lift', 0.4));
            }
        });
        emberRise(sc, TI + 0.4, sec, RAGE);
        // 혼란 — 머리 위로 별이 빙글빙글
        sc.add({ max: sec, draw: (ctx, it, tt, px) => {
            const life = sc.t;
            if (life < TDIZZY || life > THOME + 0.2) {
                return;
            }
            const xx = xAt(life);
            const yy = footAt(life) - me.h * 1.05;
            for (let i = 0; i < 3; i++) {
                const a = life * 6 + (i * TAU) / 3;
                const z = Math.max(s, Math.round((me.w * 0.06) / s) * s);
                const sx = xx + Math.cos(a) * me.w * 0.4;
                const sy = yy + Math.sin(a) * me.w * 0.12;
                ctx.globalAlpha = Math.sin(a) > -0.3 ? 1 : 0.5;
                ctx.fillStyle = '#ffe14d';
                ctx.fillRect(px(sx - z), px(sy), z * 3, z);
                ctx.fillRect(px(sx), px(sy - z), z, z * 3);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(px(sx), px(sy), z, z);
            }
        } });
    }

    // ═════ 라프라스 — 냉동빔 (ultbeam) ═════
    // 노래(음표가 피어오름) → 밤하늘에 오로라가 일렁이고 눈이 내림 → 입 앞에 얼음 결정이 빨려 들며 얼음 구가 커짐 → 냉동빔이 화면 끝까지
    // (지나간 땅마다 얼음 가시가 차례로 솟고, 맞은 애는 얼음 덩어리에 갇힘) → 빔이 그치고 잠깐 정적 → 얼음이 한꺼번에 와장창 깨지며 얼음 조각 · 하늘빛 빛의 반구 (약 7.4초)
    const ICE = ['#ffffff', '#e3faff', '#9fe8ff', '#4aa8e0'];
    const NOTE = ['..##', '..#.', '..#.', '###.', '###.'];
    UNIQ.lapras = { fx: 'ultbeam', ms: (P) => 7400 + 200 * P, run: runIceBeam };
    function runIceBeam(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TC0 = 1.0; // 얼음 모으기
        const TF = 2.3; // 쏨
        const FIRE = 1.3;
        const TS = TF + FIRE + 0.35; // 깨짐
        const [mx, my] = [u.mouth.x + dir * s * 2, Math.min(u.mouth.y, G - me.h * 0.3)];
        const bw = clamp(H * 0.08 * (0.9 + 0.3 * P), 6 * s, H * 0.15);
        const far = dir > 0 ? W - mx : mx;
        const speed = Math.max(far / 0.45, 600);
        const frontAt = (t) => clamp((t - TF) * speed, 0, far);
        // 얼음 가시 — 빔 아래 땅을 따라
        const spikes = [];
        for (let d = me.w * 0.6; d < far; d += Math.max(bw * 0.9, W * 0.05)) {
            spikes.push({ x: mx + dir * (d + rnd(-0.2, 0.2) * bw), h: Math.max(bw * 1.2, (G - my) * (0.45 + 0.4 * hash(d, 401))) , w: bw * (0.55 + 0.4 * hash(d, 402)), lean: (hash(d, 403) - 0.5) * 0.3, t0: TF + d / speed });
        }
        const frozen = [];
        const sc = scene(u, sec + 0.4, 'uniq lapras');
        ultDark(0.45, ms - 200);
        // 오로라 — 하늘 위쪽에 일렁이는 초록 · 하늘 · 보라 띠
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp((life - 0.3) / 0.8, 0, 1) * clamp((sec - 0.3 - life) / 0.6, 0, 1);
            if (a <= 0.01) {
                return;
            }
            const c = Math.max(s, Math.round(short(u) / 100));
            const bands = [['#5dffb0', 0.12, 0.3], ['#7fe8ff', 0.2, 0.25], ['#c99cff', 0.28, 0.2]];
            for (const [col, yk, al] of bands) {
                const path = new Path2D();
                for (let x = 0; x < W; x += c) {
                    const y = H * yk + Math.sin(x * 0.012 + life * 0.9 + yk * 9) * H * 0.04 + Math.sin(x * 0.031 - life * 0.6) * H * 0.015;
                    const hgt = H * 0.06 * (0.6 + 0.4 * Math.sin(x * 0.02 + life * 1.3));
                    path.rect(Math.round(x / c) * c, Math.round(y / c) * c, c, Math.max(c, Math.round(hgt / c) * c));
                }
                ctx.globalAlpha = al * a;
                ctx.fillStyle = col;
                ctx.fill(path);
            }
        } });
        // 눈
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp((life - 0.5) / 0.5, 0, 1) * clamp((sec - life) / 0.5, 0, 1);
            const path = new Path2D();
            const m = Math.round(40 * clamp(W / 480, 0.6, 2));
            for (let j = 0; j < m; j++) {
                const y = K.hash(j, 2) * H + life * H * (0.12 + K.hash(j, 3) * 0.1);
                const yy = ((y % (G + 10)) + G + 10) % (G + 10);
                path.rect(px(K.hash(j, 1) * W + Math.sin(life * 2 + j) * s * 3), px(yy), s, s);
            }
            ctx.globalAlpha = 0.85 * a;
            ctx.fillStyle = '#ffffff';
            ctx.fill(path);
        } });
        // 음표 — 노래
        sc.add({ max: TF, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const z = Math.max(s, Math.round((me.w * 0.05) / s) * s);
            for (let i = 0; i < 4; i++) {
                const ph = (life * 0.7 + i / 4) % 1;
                const nx = me.x + dir * me.w * (0.1 + 0.25 * Math.sin(ph * 6 + i)) + (i - 1.5) * me.w * 0.2;
                const ny = me.b - me.h * (1 + ph * 0.9);
                ctx.globalAlpha = Math.sin(ph * Math.PI) * clamp((TF - 0.2 - life) / 0.3, 0, 1);
                ctx.fillStyle = ['#bfe9ff', '#ffd9f0', '#fff3b0', '#c8ffd9'][i];
                NOTE.forEach((row, ry) => [...row].forEach((ch, rx) => ch === '#' && ctx.fillRect(px(nx + rx * z), px(ny + ry * z), z, z)));
            }
        } });
        // 라프라스 (꼭두각시)
        puppet(sc, pokemon, u, () => me.b, ICE[2], sec - 0.1, { glow: (t) => (t > TF - 0.05 && t < TF + 0.1 ? 0.7 : clamp((t - TC0) / 1, 0, 1) * (t < TS ? 0.12 * (1 + Math.sin(t * 12)) : 0)), glowColor: '#ffffff' });
        // 얼음 모으기
        chargeSwirl(sc, () => [mx, my], TC0, TF - 0.05, Math.max(me.w * 3.5, short(u) * 0.4), Math.max(s * 4, bw * 0.5), ICE, dir);
        sc.add({ max: TF + FIRE + 0.2, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TC0) {
                return;
            }
            const k = easeOut((life - TC0) / (TF - TC0)) * (1 + 0.08 * Math.sin(life * 20));
            const fade = life > TF + FIRE ? 1 - (life - TF - FIRE) / 0.2 : 1;
            fireOrb(ctx, px, s, mx, my, bw * 0.75, ICE, life, k, G, fade, 0, [1, 0.8, 0.6, 0.38], 0.2);
        } });
        // 냉동빔
        sc.at(TF, () => {
            impactFrames(sc, W, H, 0.65, 0.4);
            ultShake(4 + 2 * P, FIRE * 1000);
        });
        sc.add({ max: TF + FIRE + 0.25, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TF) {
                return;
            }
            const fade = life > TF + FIRE ? 1 - (life - TF - FIRE) / 0.25 : 1;
            beamBody(ctx, px, s, mx, my, dir, 0, frontAt(life) + bw, bw * (0.9 + 0.1 * Math.sin(life * 35)) * fade, ICE, life, 1, G);
            // 빔을 따라 반짝이는 얼음 결정
            for (let j = 0; j < 10; j++) {
                const d = ((life * 0.8 + j / 10) % 1) * frontAt(life);
                const yy = my + Math.sin(j * 2.3 + life * 5) * bw * 0.7;
                glint(ctx, px, s, mx + dir * d, yy, bw * 0.3, 0.8 * fade);
            }
        } });
        // 얼음 가시 · 얼음 덩어리
        const iceSpike = (ctx, px, x, h, w, lean, k, white) => {
            const hh = h * k;
            for (let y = 0; y < hh; y += s) {
                const f = y / Math.max(1, hh);
                const half = (w / 2) * (f > 0.6 ? (1 - f) / 0.4 : 1);
                if (half < s * 0.5) {
                    continue;
                }
                const cx = x + lean * y;
                const yy = px(G - y - s);
                ctx.globalAlpha = 0.85;
                ctx.fillStyle = white ? '#ffffff' : ICE[2];
                ctx.fillRect(px(cx - half), yy, Math.max(s, px(2 * half)), s);
                ctx.fillStyle = white ? '#ffffff' : ICE[1];
                ctx.fillRect(px(cx - half), yy, Math.max(s, px(half * 0.6)), s);
                ctx.fillStyle = ICE[3];
                ctx.fillRect(px(cx + half * 0.5), yy, Math.max(s, px(half * 0.5)), s);
            }
        };
        sc.add({ max: TS + 0.05, draw: (ctx, it, t, px) => {
            const life = sc.t;
            for (const sp of spikes) {
                if (life >= sp.t0) {
                    iceSpike(ctx, px, sp.x, sp.h, sp.w, sp.lean, easeOut((life - sp.t0) / 0.18), life > TS - 0.12);
                }
            }
            for (const f of frozen) {
                const r = where(u, f.r);
                const k = easeOut((life - f.t0) / 0.15);
                const bwid = r.w * 1.2 * k;
                const bh = r.h * 1.2 * k;
                // 얼음 덩어리 — 옅은 하늘빛 · 위는 들쭉날쭉 · 왼쪽 위 밝은 테 · 오른쪽 아래 짙은 테 · 비스듬한 빛
                const x0 = r.x - bwid / 2;
                const y0 = r.bottom - bh;
                for (let xx = 0; xx < bwid; xx += s) {
                    const jag = (Math.floor(xx / (2 * s)) % 3) * s;
                    ctx.globalAlpha = 0.38;
                    ctx.fillStyle = ICE[1];
                    ctx.fillRect(px(x0 + xx), px(y0 + jag), s, px(bh - jag));
                    ctx.globalAlpha = 0.95;
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(px(x0 + xx), px(y0 + jag), s, s);
                }
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(px(x0), px(y0), s, px(bh));
                ctx.fillStyle = ICE[3];
                ctx.fillRect(px(x0 + bwid - s), px(y0 + s * 2), s, px(bh - s * 2));
                ctx.fillRect(px(x0), px(r.bottom - s), px(bwid), s);
                ctx.globalAlpha = 0.8;
                ctx.fillStyle = '#ffffff';
                for (let i = 0; i < Math.min(bwid, bh) * 0.5; i += s) {
                    ctx.fillRect(px(x0 + bwid * 0.2 + i), px(y0 + bh * 0.25 + i), s, s);
                }
            }
        } });
        sc.tick((t) => {
            if (t < TF || t > TF + FIRE) {
                return;
            }
            const front = frontAt(t);
            for (const r of u.others()) {
                if (frozen.some((f) => f.r.pokemon === r.pokemon)) {
                    continue;
                }
                const d = (r.x - mx) * dir;
                if (d > 0 && d < front + r.w * 0.5) {
                    frozen.push({ r, t0: t });
                    ring(sc, r.x, r.y, r.w * 0.3, r.w * 1.6, 0.85, 0.35, ['#ffffff', ICE[2]], 2);
                    hit(r, dir, 'shake');
                }
            }
        });
        // 와장창
        sc.at(TS, () => {
            impactFrames(sc, W, H, 0.6, 0.35);
            ultShake(7 + 2 * P, 900);
            for (const sp of spikes) {
                K.shards(sp.x, G - sp.h * 0.5, s, Math.max(s, Math.round(sp.w / (9 * s)) * s), ICE, 4, H * 0.7, G);
            }
            let bx = mx + dir * far * 0.6;
            for (const f of frozen) {
                const r = where(u, f.r);
                K.shards(r.x, r.y, s, Math.max(s, Math.round(r.w / (12 * s)) * s), ICE, 9, H * 0.8, G);
                sc.at(TS + 0.05, () => hit(r, away(u, r.x), 'lift', 0.3));
                bx = Math.abs(r.x - mx) < Math.abs(bx - mx) ? r.x : bx;
            }
            blastDome(sc, clamp(bx, W * 0.06, W * 0.94), G, clamp(Math.max(H * 0.42, bw * 4), 30, Math.min(G * 0.92, W * 0.45)), 1.8, ICE);
        });
        emberRise(sc, TS + 0.3, sec, ICE);
    }

    // 하늘 끝 우주 — 위쪽이 짙은 밤하늘 · 별 반짝 · 오존층처럼 옅은 초록 띠 (a 0~1)
    function spaceBand(ctx, px, s, W, h, life, a, glow) {
        if (a <= 0.01) {
            return;
        }
        ctx.globalAlpha = 0.8 * a;
        ctx.fillStyle = '#04060f';
        ctx.fillRect(0, 0, W, Math.round(h));
        ctx.globalAlpha = 0.35 * a;
        ctx.fillStyle = glow;
        ctx.fillRect(0, Math.round(h), W, Math.max(s, Math.round(h * 0.06)));
        ctx.globalAlpha = 0.18 * a;
        ctx.fillRect(0, Math.round(h * 1.06), W, Math.max(s, Math.round(h * 0.1)));
        const path = new Path2D();
        const m = Math.round(40 * clamp(W / 480, 0.6, 2));
        for (let j = 0; j < m; j++) {
            if (Math.sin(life * (2 + 3 * hash(j, 7)) + j) > -0.2) {
                path.rect(px(hash(j, 5) * W), px(hash(j, 6) * h * 0.95), s, s);
            }
        }
        ctx.globalAlpha = 0.9 * a;
        ctx.fillStyle = '#ffffff';
        ctx.fill(path);
    }

    // ═════ 레쿠쟈 — 화룡점정 (ultdive) ═════
    // 초록 기운이 몸을 감고 바람이 솟음 → 나선을 그리며 하늘 끝으로 솟구침(초록 띠 꼬리) → 하늘이 우주처럼 짙어지고 오존층 초록 띠 · 하늘 꼭대기에 초록 별이 두근
    // → 거대한 초록 혜성이 되어 비스듬히 내리꽂힘(레쿠쟈가 혜성 머리 속에) → 임팩트 프레임 · 초록 빛의 반구 · 하늘까지 닿는 초록 빛기둥
    // → 빛기둥을 타고 솟았다가 제자리로 내려옴 (약 7.4초)
    const RAYQ = ['#ffffff', '#d8ffb0', '#4fe07a', '#16804a'];
    UNIQ.rayquaza = { fx: 'ultdive', ms: (P) => 7400 + 200 * P, run: runDragonAscent };
    function runDragonAscent(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TC0 = 0.15;
        const TUP = 0.55; // 솟구침
        const TGONE = TUP + 0.55;
        const TSKY = 1.2; // 하늘이 우주처럼
        const TCOMET = 2.7; // 혜성
        const TI = TCOMET + 0.55; // 내리꽂힘
        const TRISE = TI + 1.9; // 빛기둥 타고 솟음
        const THOME = sec - 0.15;
        const q = nearest(u);
        let tx = q ? q.x : me.x + dir * W * 0.4;
        if (Math.abs(tx - me.x) < me.w) {
            tx = me.x + (Math.sign(tx - me.x) || dir) * me.w;
        }
        tx = clamp(tx, W * 0.1, W * 0.9);
        const sky = Math.max(30, H * 0.22);
        // 혜성이 나타나는 하늘 자리 — 과녁에서 비스듬히 떨어진 곳 (화면 안, 한쪽이 모자라면 반대쪽)
        let sx0 = tx - dir * W * 0.35;
        if (sx0 < W * 0.12 || sx0 > W * 0.88) {
            sx0 = tx + dir * W * 0.35;
        }
        sx0 = clamp(sx0, W * 0.12, W * 0.88);
        const cometAt = (t) => {
            const k = easeIn(clamp((t - TCOMET) / (TI - TCOMET), 0, 1));
            return [lerp(sx0, tx, k), lerp(sky * 0.55, G - me.h * 0.4, k)];
        };
        const pathUp = (t) => {
            const k = easeIn(clamp((t - TUP) / (TGONE - TUP), 0, 1));
            return [me.x + Math.sin(k * 7) * me.w * 0.6 * k, lerp(me.b, -me.h * 1.2, k)];
        };
        const homeDrop = (t) => {
            const k = easeOut(clamp((t - TRISE - 0.5) / (THOME - TRISE - 0.5), 0, 1));
            return [lerp(tx, me.x, k), lerp(-me.h, me.b, k)];
        };
        const sc = scene(u, sec + 0.4, 'uniq rayquaza');
        ultDark(0.45, ms - 200);
        // 우주 하늘
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            spaceBand(ctx, px, s, W, sky, life, clamp((life - TSKY) / 0.6, 0, 1) * clamp((sec - 0.4 - life) / 0.6, 0, 1), RAYQ[2]);
        } });
        // 하늘 꼭대기 초록 별 — 두근
        sc.add({ max: TCOMET + 0.05, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TSKY + 0.2) {
                return;
            }
            const k = easeOut((life - TSKY - 0.2) / 0.8) * (1 + 0.25 * Math.max(0, Math.sin(life * 9)) ** 4);
            fireOrb(ctx, px, s, sx0, sky * 0.55, Math.max(4 * s, me.w * 0.35), RAYQ, life, k, Infinity, 1, 0, [1, 0.8, 0.6, 0.38], 0.4);
            glint(ctx, px, s, sx0, sky * 0.55, me.w * 0.8 * k, 0.9);
        } });
        // 솟구침 꼬리 · 초록 기운
        sc.add({ max: TGONE + 0.4, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - TC0) / 0.3, 0, 1) * (1 - clamp((life - TUP) / 0.2, 0, 1));
            if (k > 0.02) {
                K.flameTongue(ctx, px, s, me.x, me.b + s * 2, me.w * 1.2, me.h * 1.5, RAYQ, life, k);
            }
            if (life > TUP) {
                for (let j = 0; j < 12; j++) {
                    const tt = life - j * 0.03;
                    if (tt < TUP) {
                        break;
                    }
                    const [x, y] = pathUp(tt);
                    ctx.globalAlpha = (1 - j / 12) * (1 - clamp((life - TGONE) / 0.4, 0, 1));
                    ctx.fillStyle = j < 3 ? RAYQ[1] : j < 7 ? RAYQ[2] : RAYQ[3];
                    const z = Math.max(s, Math.round((me.w * 0.35 * (1 - j / 14)) / s) * s);
                    ctx.fillRect(px(x - z / 2), px(y - me.h * 0.5 - z / 2), z, z);
                }
            }
        } });
        // 혜성
        sc.add({ max: TI + 0.02, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TCOMET) {
                return;
            }
            const [x, y] = cometAt(life);
            const dx = tx - sx0;
            const dy = G - me.h * 0.4 - sky * 0.55;
            const L = Math.hypot(dx, dy) || 1;
            K.fireTail(ctx, px, s, x, y, dx / L, dy / L, Math.max(H * 0.6, me.w * 4), Math.max(me.w * 1.3, 8 * s), RAYQ, life, 1);
            fireOrb(ctx, px, s, x, y, Math.max(me.w * 0.7, 5 * s), RAYQ, life, 1, G, 0.9, 0, [1, 0.8, 0.6, 0.38], 0.5);
        } });
        // 레쿠쟈 (꼭두각시) — 솟구침 · 혜성 머리 · 빛기둥 타고 솟음 · 내려옴
        const img = pokemon.el;
        const edge = Math.max(1, Math.round(u.s * 0.75));
        const left = dir < 0;
        hideMon(pokemon, true);
        hideUntil(pokemon, (sec - 0.1) * 1000 + 100);
        sc.at(sec - 0.12, () => hideMon(pokemon, false));
        sc.add({ max: sec - 0.1, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life >= sec - 0.12) {
                return;
            }
            let x;
            let b;
            let rot = 0;
            if (life < TGONE) {
                [x, b] = pathUp(life);
                rot = life > TUP ? (left ? 0.5 : -0.5) : 0;
            } else if (life < TCOMET) {
                return;
            } else if (life < TI) {
                const [cx, cy] = cometAt(life);
                x = cx;
                b = cy + me.h * 0.5;
                rot = left ? -0.9 : 0.9;
            } else if (life < TRISE) {
                x = tx;
                b = G;
            } else if (life < TRISE + 0.5) {
                x = tx;
                b = lerp(G, -me.h, easeIn((life - TRISE) / 0.5));
                rot = left ? 0.4 : -0.4;
            } else {
                [x, b] = homeDrop(life);
            }
            drawLitMon(ctx, img, x, b, me.w, left, RAYQ[2], edge, 1, rot);
            const glow = life > TI && life < TI + 0.25 ? 0.8 : life < TGONE ? clamp((life - TC0) / 0.3, 0, 1) * 0.2 : 0;
            if (glow > 0.01) {
                drawMon(ctx, img, x, b, me.w, left, glow, RAYQ[1], rot);
            }
        } });
        sc.at(TUP, () => {
            ring(sc, me.x, G - s, me.w * 0.5, me.w * 3, 0.25, 0.5, ['#ffffff', RAYQ[2]], 2);
            debris(me.x, G - s, s, ['#8a7252', '#5c4a33', RAYQ[2]], 16, H * 0.6, { ground: G });
            ultShake(4, 300);
        });
        [TSKY + 0.5, TSKY + 0.9, TSKY + 1.25].forEach((tb, i) => sc.at(tb, () => {
            ring(sc, sx0, sky * 0.55, me.w * 0.3, me.w * (1.6 + i * 0.6), 1, 0.4, ['#ffffff', RAYQ[2]], 2);
            ultShake(1.5 + i, 150);
        }));
        // 내리꽂힘 — 초록 빛의 반구 · 하늘까지 빛기둥
        sc.at(TI, () => {
            impactFrames(sc, W, H, 0.8, 0.5);
            blastDome(sc, tx, G, clamp(Math.max(H * 0.5, me.w * 3), 30, Math.min(G * 0.92, W * 0.48)), 1.9, RAYQ);
            K.firePillar(sc, tx, G, clamp(me.w * 1.4, 8 * s, W * 0.22), 1.6, RAYQ);
            ring(sc, tx, G - s, me.w, W * 0.85, 0.22, 0.8, ['#ffffff', RAYQ[1], RAYQ[2]], 3);
            groundArcs(sc, tx, G - s, W * 0.5, 1.0, RAYQ[1], 6, 2, G - s);
            ultShake(10 + 3 * P, 1300);
            for (const r of u.others()) {
                sc.at(TI + 0.12, () => hit(where(u, r), away(u, r.x), 'lift', 0.4));
            }
        });
        emberRise(sc, TI + 0.4, sec, RAYQ);
        sc.at(THOME - 0.05, () => {
            ring(sc, me.x, G - s, me.w * 0.4, me.w * 2, 0.25, 0.35, [RAYQ[1], RAYQ[2]], 1);
            ultShake(3, 200);
        });
    }

    // ═════ 루기아 — 에어로블라스트 (ultbeam) ═════
    // 먹구름이 소용돌이치고 바람 줄이 가로지름 → 루기아가 떠올라 날갯짓 · 바람이 입으로 빨려 들며 은빛 구가 커짐
    // → 임팩트 프레임 · 은빛 광선이 화면 끝으로 (두 줄 나선 띠가 감고 돌고 바람 고리가 줄지어 달림, 닿은 애 벌러덩)
    // → 광선 끝에 거대한 회오리가 솟아 닿은 애를 빙글빙글 감아올림 → 회오리가 터지며 은빛 빛의 반구 (약 7.4초)
    const SILV = ['#ffffff', '#e6f2ff', '#a8c8f0', '#5a7cc8'];
    UNIQ.lugia = { fx: 'ultbeam', ms: (P) => 7400 + 200 * P, run: runAeroblast };
    function runAeroblast(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const bandH = Math.max(40, H * 0.3);
        const lift = me.h * 0.3;
        const TC0 = 0.8;
        const TF = 2.2;
        const FIRE = 1.2;
        const TT = TF + 0.55; // 회오리
        const TB = TF + FIRE + 0.9; // 회오리 터짐
        const footAt = (t) => me.b - lift * easeOut(clamp((t - 0.2) / 0.6, 0, 1)) * (1 - easeIn(clamp((t - (sec - 0.6)) / 0.45, 0, 1))) + Math.sin(t * 3) * s * 1.5;
        const mouthAt = (t) => [u.mouth.x + dir * s * 2, u.mouth.y - (me.b - footAt(t))];
        const bw = clamp(H * 0.1 * (0.9 + 0.3 * P), 7 * s, H * 0.18);
        const q = nearest(u);
        const tx = clamp(q && Math.sign(q.x - me.x) === dir ? q.x : me.x + dir * W * 0.6, W * 0.12, W * 0.88);
        const sc = scene(u, sec + 0.4, 'uniq lugia');
        ultDark(0.45, ms - 200);
        let lit = 0;
        sc.tick((t, dt) => {
            lit = Math.max(0, lit - dt);
        });
        skyBand(sc, '#08101c', bandH * 1.2, 0.7, sec);
        cloudBank(sc, { y: bandH * 0.38, h: bandH * 0.42, cols: ['#7a8aa8', '#55617d', '#38405a'], sec, lit: () => (lit > 0 ? 1 : 0), speed: 60 * dir, litCols: ['#ffffff', SILV[1], SILV[2]] });
        // 바람 줄 — 화면을 가로지름
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp((life - 0.3) / 0.4, 0, 1) * clamp((sec - 0.4 - life) / 0.5, 0, 1);
            ctx.globalAlpha = 0.5 * a;
            ctx.fillStyle = SILV[1];
            for (let j = 0; j < 14; j++) {
                const y = bandH + hash(j, 11) * (G - bandH - s * 4);
                const len = W * (0.08 + 0.12 * hash(j, 12));
                const x = ((hash(j, 13) * W + life * W * (0.6 + 0.6 * hash(j, 14)) * dir) % (W + len) + W + len) % (W + len) - len;
                ctx.fillRect(px(x), px(y), px(len), s);
            }
        } });
        // 루기아 (꼭두각시)
        puppet(sc, pokemon, u, footAt, SILV[2], sec - 0.1, { glow: (t) => (t > TF - 0.05 && t < TF + 0.1 ? 0.7 : clamp((t - TC0) / 1, 0, 1) * (t < TF ? 0.15 * (1 + Math.sin(t * 12)) : 0)), glowColor: '#ffffff' });
        // 바람 모으기
        chargeSwirl(sc, mouthAt, TC0, TF - 0.05, Math.max(me.w * 3.5, short(u) * 0.45), Math.max(s * 4, bw * 0.45), SILV, dir);
        sc.add({ max: TF + FIRE + 0.2, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TC0) {
                return;
            }
            const [mx, my] = mouthAt(life);
            const k = easeOut((life - TC0) / (TF - TC0)) * (1 + 0.08 * Math.sin(life * 18));
            fireOrb(ctx, px, s, mx, my, bw * 0.6, SILV, life, k, G, life > TF + FIRE ? 1 - (life - TF - FIRE) / 0.2 : 1, 0, [1, 0.8, 0.6, 0.38], 0.3);
        } });
        // 에어로블라스트 — 은빛 광선 · 나선 띠 · 바람 고리
        sc.at(TF, () => {
            impactFrames(sc, W, H, 0.7, 0.45);
            ultShake(5 + 2 * P, FIRE * 1000);
            lit = 0.15;
        });
        sc.add({ max: TF + FIRE + 0.25, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TF) {
                return;
            }
            const [mx, my] = mouthAt(life);
            const far = dir > 0 ? W - mx : mx;
            const front = Math.min(far, (life - TF) * Math.max(1500, W * 3.6));
            const ty = G - bw * 0.8;
            const dy = (ty - my) / Math.max(1, far);
            const L = Math.hypot(1, dy);
            const ux = dir / L;
            const uy = dy / L;
            const fade = life > TF + FIRE ? 1 - (life - TF - FIRE) / 0.25 : 1;
            beamBody(ctx, px, s, mx, my, ux, uy, front * L, bw * (0.95 + 0.05 * Math.sin(life * 40)) * fade, SILV, life, 1, G);
            // 나선 띠 두 줄
            for (let strand = 0; strand < 2; strand++) {
                for (let d = bw * 0.5; d < front; d += s) {
                    const ph = d / (bw * 0.9) - life * 14 + strand * Math.PI;
                    const x = mx + dir * d;
                    const y = my + dy * d + Math.sin(ph) * bw * 0.85;
                    const frontSide = Math.cos(ph) > 0;
                    ctx.globalAlpha = (frontSide ? 1 : 0.5) * fade;
                    ctx.fillStyle = strand ? '#ffffff' : SILV[3];
                    ctx.fillRect(px(x), px(y), s, frontSide ? 2 * s : s);
                }
            }
            // 바람 고리 — 광선을 감싸는 세로 고리가 줄지어 달림
            for (let k = 0; k < 6; k++) {
                const d = ((life * 1.6 + k / 6) % 1) * front;
                if (d < bw) {
                    continue;
                }
                const cx = mx + dir * d;
                const cy = my + dy * d;
                ctx.globalAlpha = 0.85 * fade;
                ctx.fillStyle = SILV[1];
                for (let a = 0; a < TAU; a += 0.35) {
                    ctx.fillRect(px(cx + Math.cos(a) * bw * 0.35), px(cy + Math.sin(a) * bw * 1.1), s, s);
                }
            }
        } });
        sc.tick((t) => {
            if (t < TF || t > TF + FIRE) {
                return;
            }
            for (const r of u.others()) {
                if (Math.sign(r.x - me.x) === dir) {
                    hit(where(u, r), dir, 'tumble');
                }
            }
        });
        // 회오리 — 광선 끝에 솟아 감아올림
        sc.add({ max: TB + 0.1, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TT) {
                return;
            }
            const grow = easeOut((life - TT) / 0.4);
            const top = G - (G - s) * grow;
            const fade = life > TB ? 1 - (life - TB) / 0.1 : 1;
            const rows = Math.max(8, Math.round((G - top) / (2 * s)));
            for (let i = 0; i < rows; i++) {
                const f = i / rows; // 0 아래 → 1 위
                const y = G - f * (G - top);
                const rw = (W * 0.025 + f * f * W * 0.13) * (0.9 + 0.1 * Math.sin(life * 8 + i));
                const sway = Math.sin(life * 3 + f * 4) * W * 0.02 * f;
                const a0 = life * 10 + i * 0.6;
                for (let j = 0; j < 4; j++) {
                    const a = a0 + (j * TAU) / 4;
                    const front = Math.sin(a) > 0;
                    ctx.globalAlpha = (front ? 0.95 : 0.45) * fade;
                    ctx.fillStyle = front ? (j % 2 ? '#ffffff' : SILV[1]) : SILV[3];
                    const z = Math.max(s, Math.round((rw * 0.14) / s) * s);
                    ctx.fillRect(px(tx + sway + Math.cos(a) * rw - z), px(y), z * 2.5, Math.max(s, z * 0.8));
                }
            }
        } });
        sc.at(TT, () => {
            for (const r of u.others()) {
                if (Math.abs(r.x - tx) < W * 0.2) {
                    hit(where(u, r), away(u, r.x), 'spin', 0.3);
                }
            }
            debris(tx, G - s, s, ['#8a7252', '#5c4a33', SILV[2]], 20, H * 0.9, { angle: -Math.PI / 2, spread: 1.2, ground: G });
            ultShake(4, 1000);
        });
        sc.at(TB, () => {
            impactFrames(sc, W, H, 0.7, 0.4);
            blastDome(sc, tx, G, clamp(Math.max(H * 0.45, W * 0.2), 30, Math.min(G * 0.92, W * 0.45)), 1.8, SILV);
            ring(sc, tx, G - s, bw, W * 0.7, 0.25, 0.8, ['#ffffff', SILV[1], SILV[2]], 3);
            ultShake(8 + 2 * P, 1000);
        });
        emberRise(sc, TB + 0.4, sec, SILV);
    }

    // ═════ 칠색조 — 성스러운불꽃 (ultbeam) ═════
    // 하늘에 무지개가 걸리고 금빛 깃털이 팔랑팔랑 → 칠색조 둘레로 금빛 성스러운 불꽃이 활활 · 부리에 불꽃이 빨려 듦
    // → 임팩트 프레임 · 성스러운 불꽃 줄기가 과녁으로 쏟아짐 → 과녁에서 하늘까지 닿는 금빛 불기둥 · 땅을 따라 무지갯빛 불길이 번짐
    // → 금빛 불티가 피어오르고 무지개가 사라짐 (약 7.2초)
    const SACRED = ['#ffffff', '#fff3a0', '#ffb020', '#e8501a'];
    const RAINBOW = ['#ff4d4d', '#ff9a3d', '#ffe14d', '#5fe06a', '#4dc3ff', '#5f6bff', '#b06bff'];
    UNIQ.hooh = { fx: 'ultbeam', ms: (P) => 7200 + 200 * P, run: runSacredFire };
    function runSacredFire(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const lift = me.h * 0.2;
        const TC0 = 0.8;
        const TF = 2.2;
        const FIRE = 1.1;
        const TP = TF + 0.45; // 불기둥
        const footAt = (t) => me.b - lift * easeOut(clamp((t - 0.2) / 0.6, 0, 1)) * (1 - easeIn(clamp((t - (sec - 0.6)) / 0.45, 0, 1))) + Math.sin(t * 3) * s * 1.5;
        const mouthAt = (t) => [u.mouth.x + dir * s * 2, u.mouth.y - (me.b - footAt(t))];
        // 과녁 — 앞쪽에서 조금 떨어진 애 (불기둥이 칠색조를 덮지 않게), 없으면 앞쪽 땅
        const ahead = u.others().filter((r) => (r.x - me.x) * dir > Math.max(W * 0.22, me.w * 1.3)).sort((a, b) => Math.abs(a.x - me.x) - Math.abs(b.x - me.x));
        const tx = clamp(ahead[0] ? ahead[0].x : me.x + dir * W * 0.45, W * 0.1, W * 0.9);
        const pw = clamp(Math.max(me.w * 0.6, W * 0.08), 8 * s, W * 0.15);
        const sc = scene(u, sec + 0.4, 'uniq hooh');
        ultDark(0.35, ms - 200);
        // 무지개
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp((life - 0.2) / 0.8, 0, 1) * clamp((sec - 0.3 - life) / 0.7, 0, 1);
            if (a <= 0.01) {
                return;
            }
            const cx = W / 2;
            const cy = G + H * 0.1;
            const R0 = Math.max(W * 0.55, H * 0.75);
            const bwid = Math.max(s, Math.round(H * 0.025 / s) * s);
            RAINBOW.forEach((col, i) => {
                const r = R0 - i * bwid;
                const path = new Path2D();
                for (let x = Math.max(0, cx - r); x < Math.min(W, cx + r); x += s) {
                    const dy = Math.sqrt(Math.max(0, r * r - (x - cx) ** 2));
                    path.rect(px(x), px(cy - dy), s, bwid);
                }
                ctx.globalAlpha = 0.35 * a;
                ctx.fillStyle = col;
                ctx.fill(path);
            });
        } });
        // 금빛 깃털 — 팔랑팔랑
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp((life - 0.4) / 0.5, 0, 1) * clamp((sec - 0.3 - life) / 0.5, 0, 1);
            const z = Math.max(s, Math.round(short(u) / 120));
            for (let j = 0; j < 16; j++) {
                const y = ((hash(j, 21) * G + life * G * (0.15 + 0.1 * hash(j, 22))) % G);
                const x = hash(j, 23) * W + Math.sin(life * 2 + j) * W * 0.03;
                const flip = Math.sin(life * 6 + j) > 0;
                ctx.globalAlpha = 0.9 * a;
                ctx.fillStyle = j % 3 ? SACRED[2] : '#ff6a3a';
                ctx.fillRect(px(x), px(y), flip ? z * 3 : z, flip ? z : z * 3);
                ctx.fillStyle = SACRED[1];
                ctx.fillRect(px(x), px(y), z, z);
            }
        } });
        // 성스러운 불꽃 오라 (칠색조 뒤)
        sc.add({ max: TF + FIRE, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - 0.5) / 0.5, 0, 1) * (1 - clamp((life - TF - FIRE + 0.3) / 0.3, 0, 1));
            if (k > 0.02) {
                K.flameTongue(ctx, px, s, me.x, footAt(life) + s * 2, me.w * 1.2, me.h * (1.4 + 0.1 * Math.sin(life * 9)), SACRED, life, k);
            }
        } });
        // 칠색조 (꼭두각시)
        puppet(sc, pokemon, u, footAt, SACRED[2], sec - 0.1, { glow: (t) => (t > TF - 0.05 && t < TF + 0.1 ? 0.7 : clamp((t - TC0) / 1, 0, 1) * (t < TF ? 0.12 * (1 + Math.sin(t * 12)) : 0)), glowColor: SACRED[1] });
        chargeSwirl(sc, mouthAt, TC0, TF - 0.05, Math.max(me.w * 3.5, short(u) * 0.42), Math.max(s * 4, me.w * 0.25), SACRED, dir);
        // 성스러운 불꽃 줄기 — 부리에서 과녁 땅으로
        sc.at(TF, () => {
            impactFrames(sc, W, H, 0.6, 0.4);
            ultShake(4, FIRE * 1000);
        });
        sc.add({ max: TF + FIRE + 0.2, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TF) {
                return;
            }
            const [mx, my] = mouthAt(life);
            const dx = tx - mx;
            const dy = G - pw * 0.2 - my;
            const L = Math.hypot(dx, dy) || 1;
            const k = clamp((life - TF) / 0.3, 0, 1);
            const fade = life > TF + FIRE ? 1 - (life - TF - FIRE) / 0.2 : 1;
            beamBody(ctx, px, s, mx, my, dx / L, dy / L, L * k, clamp(me.w * 0.5, 5 * s, H * 0.12) * fade, SACRED, life, 1, G);
            fireOrb(ctx, px, s, mx, my, clamp(me.w * 0.3, 3 * s, H * 0.07), SACRED, life, 1, G, fade, 0, [1, 0.8, 0.6, 0.38], 0.5);
        } });
        // 불기둥 · 무지갯빛 땅 불길
        sc.at(TP, () => {
            impactFrames(sc, W, H, 0.7, 0.45);
            K.firePillar(sc, tx, G, pw, 2.0, SACRED);
            ring(sc, tx, G - s, pw * 0.5, W * 0.8, 0.22, 0.8, ['#ffffff', SACRED[1], SACRED[2]], 3);
            ultShake(8 + 3 * P, 1300);
            for (const r of u.others()) {
                sc.at(TP + Math.abs(r.x - tx) / (W * 1.5), () => hit(where(u, r), away(u, r.x), Math.abs(r.x - tx) < pw ? 'lift' : 'tumble', 0.4));
            }
        });
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TP) {
                return;
            }
            const k = easeOut((life - TP) / 0.9);
            const fade = clamp((sec - 0.3 - life) / 0.8, 0, 1);
            const reach = W * 0.75 * k;
            // 무지갯빛 불길 — 칸마다 색이 돌아감
            const seg = Math.max(W / 7, s * 6);
            for (let x = Math.max(0, tx - reach); x < Math.min(W, tx + reach); x += seg) {
                const i = Math.floor((x - (tx - reach)) / seg + life * 3) % 7;
                const c = RAINBOW[i];
                K.groundFlames(ctx, px, s, x, Math.min(x + seg, tx + reach), G, H * 0.12 * (1 - Math.abs(x - tx) / (W * 0.9)), life, ['#ffffff', SACRED[1], c, c], 0.85 * fade);
            }
        } });
        emberRise(sc, TP + 0.3, sec, SACRED);
    }

    // ═════ 그란돈 — 단애의칼 (ultquake) ═════
    // 하늘 한쪽에 이글거는 해가 뜨고 화면이 달아오름(아지랑이) → 몸의 용암 줄무늬가 붉게 빛나며 두 번 쿵쿵(땅이 갈라져 빛남)
    // → 거대한 바위 칼날이 그란돈 앞부터 화면 끝까지 차례로 솟구침(칼날 가운데 용암 틈 · 솟을 때마다 용암이 튐 · 닿은 애 떠오름)
    // → 칼날마다 금이 가며 용암이 뿜어져 나오고 맨 끝에서 용암 빛의 반구 (약 7.4초)
    const LAVAC = ['#fff3a0', '#ffb020', '#ff5a10', '#b01808'];
    const BASALT = ['#2a1e1a', '#4a3530', '#6e5248', '#8e7064'];
    UNIQ.groudon = { fx: 'ultquake', ms: (P) => 7400 + 200 * P, run: runPrecipice };
    function runPrecipice(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const stomps = [1.0, 1.5];
        const TB0 = 2.0; // 칼날 시작
        const n = clamp(Math.round(W / Math.max(me.w * 0.9, 60)), 4, 8);
        const far = dir > 0 ? W - me.x : me.x;
        const blades = [];
        for (let i = 0; i < n; i++) {
            const d = me.w * 0.7 + ((far - me.w * 0.7) * (i + 0.5)) / n;
            const h = Math.min(G * 0.85, H * (0.35 + 0.35 * ((i + 1) / n)) * (0.85 + 0.25 * P));
            blades.push({ x: clamp(me.x + dir * d, s * 4, W - s * 4), h, w: Math.max(8 * s, Math.min(h * 0.48, (far / n) * 0.9)), lean: dir * (0.08 + 0.1 * hash(i, 501)), t0: TB0 + i * 0.16, seed: hash(i, 502) * 99 });
        }
        const TCRACK = blades[n - 1].t0 + 0.55; // 금 · 용암
        const TBOOM = TCRACK + 0.35;
        const sunX = dir > 0 ? W * 0.82 : W * 0.18;
        const sunY = Math.max(24, H * 0.16);
        const sc = scene(u, sec + 0.4, 'uniq groudon');
        ultDark(0.3, ms - 200);
        // 달아오른 하늘 · 이글거리는 해 · 아지랑이
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp(life / 0.8, 0, 1) * clamp((sec - 0.3 - life) / 0.6, 0, 1);
            if (a <= 0.01) {
                return;
            }
            ctx.globalAlpha = 0.18 * a;
            ctx.fillStyle = LAVAC[2];
            ctx.fillRect(0, 0, W, H);
            fireOrb(ctx, px, s, sunX, sunY, Math.max(10 * s, H * 0.09), ['#ffffff', '#fff3a0', '#ffc93c', '#ff7a21'], life, a, Infinity, a, 0, [1, 0.8, 0.6, 0.38], 0.6);
            ctx.globalAlpha = 0.25 * a;
            ctx.fillStyle = '#fff3a0';
            for (let j = 0; j < 10; j++) {
                const y = G - H * 0.05 - hash(j, 511) * H * 0.4;
                const x = ((hash(j, 512) * W + Math.sin(life * 2 + j) * s * 6) % W + W) % W;
                ctx.fillRect(px(x), px(y), px(W * 0.06), s);
            }
        } });
        // 그란돈 (꼭두각시) — 용암 줄무늬가 빛남
        puppet(sc, pokemon, u, () => me.b, LAVAC[2], sec - 0.1, { glow: (t) => clamp((t - 0.4) / 0.8, 0, 1) * 0.2 * (1 + Math.sin(t * 7)) + (stomps.some((ts) => t > ts && t < ts + 0.1) ? 0.6 : 0), glowColor: LAVAC[1] });
        stomps.forEach((ts, i) => sc.at(ts, () => {
            ring(sc, me.x, G - s, me.w * 0.5, me.w * (3 + i), 0.22, 0.5, ['#ffffff', LAVAC[1], LAVAC[2]], 2);
            groundArcs(sc, me.x, G - s, me.w * (2.5 + i), 1.5, LAVAC[1], 4, 1, G - s);
            debris(me.x, G - s, s, [...BASALT, LAVAC[2]], 14, H * 0.6, { ground: G });
            ultShake(5 + i * 2, 350);
        }));
        // 바위 칼날
        const blade = (ctx, px, b, k, crack, alpha) => {
            const hh = b.h * k;
            const half0 = b.w / 2;
            for (let y = 0; y < hh; y += s) {
                const f = y / Math.max(1, b.h);
                const half = half0 * (1 - f) ** 0.8 * (1 + 0.1 * Math.sin(y * 0.2 + b.seed));
                if (half < s * 0.5) {
                    continue;
                }
                const cx = b.x + b.lean * y;
                const yy = px(G - y - s);
                ctx.globalAlpha = alpha;
                ctx.fillStyle = BASALT[1];
                ctx.fillRect(px(cx - half), yy, Math.max(s, px(2 * half)), s);
                ctx.fillStyle = BASALT[3];
                ctx.fillRect(px(cx - half), yy, Math.max(s, px(half * 0.5)), s);
                ctx.fillStyle = BASALT[0];
                ctx.fillRect(px(cx + half * 0.55), yy, Math.max(s, px(half * 0.45)), s);
                // 가운데 용암 틈 (금이 가면 넓어짐)
                const seam = Math.max(s, half * (0.12 + 0.35 * crack)) * (0.7 + 0.3 * Math.sin(y * 0.5 + b.seed));
                ctx.fillStyle = crack > 0.3 ? LAVAC[0] : LAVAC[2];
                ctx.fillRect(px(cx - seam / 2 + Math.sin(y * 0.15 + b.seed) * half * 0.2), yy, Math.max(s, px(seam)), s);
            }
        };
        sc.add({ max: TBOOM + 0.4, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const crack = clamp((life - TCRACK) / 0.35, 0, 1);
            const fade = life > TBOOM ? 1 - (life - TBOOM) / 0.4 : 1;
            for (const b of blades) {
                if (life >= b.t0) {
                    blade(ctx, px, b, easeOut((life - b.t0) / 0.14) * (1 + 0.05 * Math.sin(life * 30) * crack), crack, fade);
                }
            }
        } });
        blades.forEach((b) => sc.at(b.t0, () => {
            ring(sc, b.x, G - s, b.w * 0.4, b.w * 2.4, 0.25, 0.4, [LAVAC[0], LAVAC[2]], 2);
            fireBits(b.x, G - s, s, LAVAC, 16, { angle: -Math.PI / 2, spread: 1.4, speed: H * 0.9, g: H * 2, life: 0.8 });
            debris(b.x, G - s, s, [...BASALT, LAVAC[2]], 10, H * 0.7, { ground: G });
            ultShake(4, 200);
            for (const r of u.others()) {
                if (Math.abs(r.x - b.x) < b.w * 0.8 + r.w * 0.4) {
                    hit(where(u, r), away(u, r.x), 'lift', 0.6);
                }
            }
        }));
        // 금 · 용암 뿜음 → 끝에서 용암 반구
        sc.at(TCRACK, () => {
            ultShake(4, 400);
            for (const b of blades) {
                fireBits(b.x, G - b.h * 0.5, s, LAVAC, 10, { speed: H * 0.6, life: 0.6 });
            }
        });
        sc.at(TBOOM, () => {
            impactFrames(sc, W, H, 0.7, 0.45);
            const last = blades[n - 1];
            blastDome(sc, clamp(last.x, W * 0.08, W * 0.92), G, clamp(Math.max(H * 0.5, last.w * 2.5), 30, Math.min(G * 0.92, W * 0.45)), 1.9, LAVAC);
            for (const b of blades) {
                fireBits(b.x, G - b.h * 0.4, s, LAVAC, 14, { speed: H * 0.9, life: 0.8 });
                debris(b.x, G - b.h * 0.5, s, BASALT, 10, H * 0.8, { ground: G, size: [1, 2, 3] });
            }
            ultShake(9 + 3 * P, 1200);
            for (const r of u.others()) {
                sc.at(TBOOM + 0.1, () => hit(where(u, r), away(u, r.x), 'tumble', 0.4));
            }
        });
        emberRise(sc, TBOOM + 0.3, sec, LAVAC);
    }

    // ═════ 가이오가 — 근원의파동 (ultbeam) ═════
    // 하늘이 캄캄해지고 장대비 · 땅 위로 바닷물이 차오름 → 몸의 푸른 줄무늬가 빛나며 둥실 → 푸른 빛줄기 여러 갈래가 포물선을 그리며 솟았다 곳곳에 꽂힘
    // (꽂힌 자리마다 물기둥 · 닿은 애 빙글) → 임팩트 프레임 · 거대한 해일이 화면을 휩쓺 → 물빛 빛의 반구 · 물이 빠짐 (약 7.4초)
    const ORIGIN = ['#ffffff', '#bff4ff', '#4fd0ff', '#1a64c8'];
    UNIQ.kyogre = { fx: 'ultbeam', ms: (P) => 7400 + 200 * P, run: runOriginPulse };
    function runOriginPulse(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const bandH = Math.max(40, H * 0.3);
        const lift = me.h * 0.25;
        const TC0 = 0.8;
        const TRAYS = 2.1; // 빛줄기
        const NR = 8;
        const TWAVE = TRAYS + 1.25; // 해일
        const WSEC = 1.1;
        const TB = TWAVE + WSEC * 0.75; // 반구
        const footAt = (t) => me.b - lift * easeOut(clamp((t - 0.6) / 0.6, 0, 1)) * (1 - easeIn(clamp((t - (sec - 0.6)) / 0.45, 0, 1))) + Math.sin(t * 2.4) * s * 1.5;
        const core = (t) => [me.x, footAt(t) - me.h * 0.55];
        // 빛줄기 꽂힐 곳 — 다른 포켓몬 먼저, 모자라면 화면 곳곳
        const spots = u.others().map((r) => ({ r, x: r.x }));
        for (let i = 0; spots.length < NR; i++) {
            spots.push({ x: clamp(W * (0.08 + 0.84 * hash(i, 521)), W * 0.05, W * 0.95) });
        }
        spots.length = NR;
        const water = (t) => H * 0.06 * easeOut(clamp((t - 0.4) / 1.4, 0, 1)) * (1 - easeIn(clamp((t - TB - 0.6) / 1.2, 0, 1)));
        const sc = scene(u, sec + 0.4, 'uniq kyogre');
        ultDark(0.45, ms - 200);
        let lit = 0;
        sc.tick((t, dt) => {
            lit = Math.max(0, lit - dt);
        });
        skyBand(sc, '#040a16', bandH * 1.3, 0.75, sec);
        cloudBank(sc, { y: bandH * 0.38, h: bandH * 0.45, cols: ['#4f5c78', '#323b55', '#20263a'], sec, lit: () => (lit > 0 ? 1 : 0), speed: 35 * dir, litCols: ['#ffffff', ORIGIN[1], ORIGIN[2]] });
        K.waterRain(sc, 0.15, sec - 0.3, ORIGIN);
        K.waterRain(sc, 0.4, sec - 0.3, ['#ffffff', '#8fd8ff', '#3fa2ff', '#1b4fd1']);
        // 차오르는 바닷물 — 땅 위 물결
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const h = water(life);
            if (h < s) {
                return;
            }
            const paths = [new Path2D(), new Path2D(), new Path2D()];
            for (let x = 0; x < W; x += s) {
                const wv = h * (1 + 0.25 * Math.sin(x * 0.05 + life * 4) + 0.1 * Math.sin(x * 0.13 - life * 6));
                paths[0].rect(px(x), px(G - wv), s, Math.max(s, px(wv)));
                paths[1].rect(px(x), px(G - wv), s, s);
                if (Math.sin(x * 0.05 + life * 4) > 0.85) {
                    paths[2].rect(px(x), px(G - wv - s), s, s);
                }
            }
            ctx.globalAlpha = 0.55;
            ctx.fillStyle = ORIGIN[3];
            ctx.fill(paths[0]);
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = ORIGIN[1];
            ctx.fill(paths[1]);
            ctx.fillStyle = '#ffffff';
            ctx.fill(paths[2]);
        } });
        // 가이오가 (꼭두각시) — 푸른 줄무늬가 빛남
        puppet(sc, pokemon, u, footAt, ORIGIN[2], sec - 0.1, { glow: (t) => clamp((t - TC0) / 0.8, 0, 1) * (t < TWAVE ? 0.2 * (1 + Math.sin(t * 9)) : 0) + (t > TRAYS - 0.05 && t < TRAYS + 0.1 ? 0.7 : 0), glowColor: ORIGIN[1] });
        chargeSwirl(sc, core, TC0, TRAYS - 0.05, Math.max(me.w * 3.5, short(u) * 0.45), Math.max(s * 4, me.w * 0.25), ORIGIN, dir);
        // 푸른 빛줄기 — 포물선
        sc.at(TRAYS, () => {
            impactFrames(sc, W, H, 0.6, 0.4);
            ultShake(4, 600);
            lit = 0.15;
        });
        const arcAt = (sp, k) => {
            const [x0, y0] = core(TRAYS);
            const x1 = sp.r ? where(u, sp.r).x : sp.x;
            const apex = Math.max(bandH * 1.1, y0 - H * 0.35);
            const x = lerp(x0, x1, k);
            const y = (1 - k) * (1 - k) * y0 + 2 * (1 - k) * k * apex + k * k * (G - s);
            return [x, y];
        };
        sc.add({ max: TRAYS + 1.2, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TRAYS) {
                return;
            }
            spots.forEach((sp, i) => {
                const t0 = TRAYS + i * 0.06;
                const k = clamp((life - t0) / 0.55, 0, 1);
                if (k <= 0) {
                    return;
                }
                const fade = life > t0 + 0.75 ? 1 - (life - t0 - 0.75) / 0.3 : 1;
                if (fade <= 0) {
                    return;
                }
                const pts = [];
                for (let q = Math.max(0, k - 0.45); q <= k; q += 0.02) {
                    pts.push(arcAt(sp, q));
                }
                if (pts.length > 1) {
                    K.fillPts(ctx, px, s, pts, 4, ORIGIN[3], 0.5 * fade);
                    K.fillPts(ctx, px, s, pts, 2, ORIGIN[2], fade);
                    K.fillPts(ctx, px, s, pts, 1, '#ffffff', fade);
                }
            });
        } });
        spots.forEach((sp, i) => sc.at(TRAYS + i * 0.06 + 0.55, () => {
            const x = sp.r ? where(u, sp.r).x : sp.x;
            K.geyser(sc, x, G, Math.max(4 * s, W * 0.025), G * (0.45 + 0.3 * hash(i, 531)), 1.0, K.pal.TIDE);
            ring(sc, x, G - s, s * 2, W * 0.08, 0.25, 0.4, ['#ffffff', ORIGIN[2]], 2);
            ultShake(2.5, 150);
            if (sp.r) {
                hit(where(u, sp.r), away(u, x), 'spin', 0.6);
            }
        }));
        // 거대한 해일 — 가이오가 쪽에서 화면 끝으로
        sc.add({ max: TWAVE + WSEC + 0.3, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TWAVE) {
                return;
            }
            const k = (life - TWAVE) / WSEC;
            const xf = me.x + dir * (me.w * 0.5 + (dir > 0 ? W - me.x : me.x) * 1.1 * easeOut(Math.min(1, k)));
            const hw = clamp(H * 0.5, me.h, G * 0.85) * (k < 0.2 ? k / 0.2 : 1);
            const fade = k > 1 ? 1 - (k - 1) / 0.27 : 1;
            K.waveFront(ctx, px, s, xf, G, dir, hw, Math.max(W * 0.6, hw * 2.4), ORIGIN, life, fade);
        } });
        sc.at(TWAVE, () => ultShake(6 + 2 * P, WSEC * 1000));
        sc.tick((t) => {
            if (t < TWAVE || t > TWAVE + WSEC) {
                return;
            }
            const xf = me.x + dir * (me.w * 0.5 + (dir > 0 ? W - me.x : me.x) * 1.1 * easeOut((t - TWAVE) / WSEC));
            for (const r of u.others()) {
                if ((xf - r.x) * dir > 0 && (r.x - me.x) * dir > 0) {
                    hit(where(u, r), dir, 'tumble', 0.8);
                }
            }
        });
        sc.at(TB, () => {
            impactFrames(sc, W, H, 0.6, 0.4);
            blastDome(sc, clamp(me.x + dir * W * 0.5, W * 0.1, W * 0.9), G, clamp(Math.max(H * 0.48, W * 0.22), 30, Math.min(G * 0.92, W * 0.48)), 1.8, ORIGIN);
            ultShake(8 + 2 * P, 1000);
        });
        K.waterFireworks(sc, TB + 0.8, 4, W * 0.15, W * 0.85); // 물 불꽃놀이
    }

    // ═════ 디아루가 — 시간의포효 (ultbeam) ═════
    // 시간이 멈춘 듯 화면이 푸르스름하게 → 하늘에 거대한 시계가 떠올라 바늘이 거꾸로 빙글빙글 · 가슴 금강석이 빛남
    // → 세 번 포효(입에서 고리 · 시간의 물결이 화면으로 퍼짐) → 입에 푸른 빛 → 임팩트 프레임 · 굵은 푸른 광선(시간의 고리가 줄지어 달림, 닿은 애 벌러덩)
    // → 시계가 금 가며 산산조각 · 광선 끝에서 푸른 빛의 반구 (약 7.4초)
    const TIMEC = ['#ffffff', '#cfe6ff', '#6fa8ff', '#2a4ab8'];
    UNIQ.dialga = { fx: 'ultbeam', ms: (P) => 7400 + 200 * P, run: runRoarOfTime };
    function runRoarOfTime(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const roars = [0.9, 1.25, 1.6];
        const TC0 = 1.5;
        const TF = 2.5;
        const FIRE = 1.4;
        const TSH = TF + FIRE; // 시계 깨짐 · 반구
        const clockR = clamp(Math.min(W * 0.18, H * 0.24), 24, 140);
        const cx = clamp(me.x + dir * W * 0.35, clockR + 4, W - clockR - 4);
        const cy = clamp(H * 0.26, clockR + 4, Math.max(clockR + 4, G - me.h * 1.4 - clockR));
        const [mx, my] = [u.mouth.x + dir * s * 2, u.mouth.y];
        const bw = clamp(H * 0.13 * (0.9 + 0.3 * P), 9 * s, H * 0.22);
        const far = dir > 0 ? W - mx : mx;
        const ty = Math.min(my + far * 0.12, G - bw * 0.6);
        const dyU = (ty - my) / Math.max(1, far);
        const q = nearest(u);
        const bx = q && Math.sign(q.x - me.x) === dir ? q.x : mx + dir * far * 0.75;
        const sc = scene(u, sec + 0.4, 'uniq dialga');
        ultDark(0.45, ms - 200);
        // 멈춘 시간 — 푸르스름
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp(life / 0.5, 0, 1) * clamp((sec - 0.3 - life) / 0.5, 0, 1);
            ctx.globalAlpha = 0.16 * a;
            ctx.fillStyle = TIMEC[3];
            ctx.fillRect(0, 0, W, H);
        } });
        // 거대한 시계 — 눈금 열둘 · 거꾸로 도는 바늘 두 개
        sc.add({ max: TSH + 0.05, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp((life - 0.3) / 0.6, 0, 1);
            if (a <= 0.01) {
                return;
            }
            const shake = life > TSH - 0.4 ? (Math.random() - 0.5) * s * 3 : 0;
            K.ringDots(ctx, px, s, cx + shake, cy, clockR, 1, [TIMEC[1], TIMEC[2]], 0.85 * a, 2);
            K.ringDots(ctx, px, s, cx + shake, cy, clockR * 0.82, 1, [TIMEC[3]], 0.5 * a, 1);
            ctx.globalAlpha = 0.9 * a;
            for (let i = 0; i < 12; i++) {
                const an = (i / 12) * TAU;
                const r0 = clockR * (i % 3 ? 0.86 : 0.78);
                for (let d = r0; d < clockR * 0.95; d += s) {
                    ctx.fillStyle = i % 3 ? TIMEC[1] : '#ffffff';
                    ctx.fillRect(px(cx + shake + Math.cos(an) * d), px(cy + Math.sin(an) * d), s, s);
                }
            }
            const spin = -(life * life) * 4; // 거꾸로, 점점 빠르게
            for (const [len, w, sp, col] of [[0.7, 2, 1, '#ffffff'], [0.5, 3, 1 / 12, TIMEC[1]]]) {
                const an = spin * sp - Math.PI / 2;
                for (let d = 0; d < clockR * len; d += s) {
                    ctx.fillStyle = col;
                    ctx.fillRect(px(cx + shake + Math.cos(an) * d - (w * s) / 2), px(cy + Math.sin(an) * d - (w * s) / 2), w * s, w * s);
                }
            }
            glint(ctx, px, s, cx + shake, cy, clockR * 0.18, a);
            // 금 — 깨지기 직전
            if (life > TSH - 0.4) {
                const k = (life - (TSH - 0.4)) / 0.4;
                for (let j = 0; j < 4; j++) {
                    const an = hash(j, 541) * TAU;
                    drawBolt(ctx, px, s, jag(cx, cy, cx + Math.cos(an) * clockR * k, cy + Math.sin(an) * clockR * k, 3 * s, 0.3), 1, '#ffffff', null, 0.9);
                }
            }
        } });
        // 시간의 물결 — 디아루가에서 화면으로 퍼지는 고리
        let wave = 0;
        sc.tick((t, dt) => {
            if (t < 0.6 || t > TF) {
                return;
            }
            wave += dt;
            if (wave > 0.35) {
                wave = 0;
                ring(sc, me.x, me.b - me.h * 0.5, me.w * 0.6, Math.max(W, H) * 0.7, 0.85, 1.0, [TIMEC[1], TIMEC[2]], 1);
            }
        });
        // 디아루가 (꼭두각시) — 가슴 금강석
        puppet(sc, pokemon, u, () => me.b, TIMEC[2], sec - 0.1, { glow: (t) => (t > TF - 0.05 && t < TF + 0.1 ? 0.7 : clamp((t - TC0) / 0.8, 0, 1) * (t < TF ? 0.15 * (1 + Math.sin(t * 12)) : 0)), glowColor: TIMEC[1] });
        sc.add({ max: TSH, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp((life - 0.4) / 0.5, 0, 1) * (0.6 + 0.4 * Math.sin(life * 8));
            glint(ctx, px, s, me.x + dir * me.w * 0.05, me.b - me.h * 0.5, me.w * 0.35 * a, a);
        } });
        roars.forEach((tr, i) => sc.at(tr, () => {
            for (let j = 0; j < 2; j++) {
                sc.at(tr + j * 0.08, () => ring(sc, mx, my, me.w * 0.3, me.w * (2.4 + i * 0.6), 0.9, 0.5, ['#ffffff', TIMEC[1]], 2 - j));
            }
            ultShake(3 + i * 1.5, 300);
        }));
        chargeSwirl(sc, () => [mx, my], TC0, TF - 0.05, Math.max(me.w * 3.5, short(u) * 0.42), Math.max(s * 4, bw * 0.45), TIMEC, dir);
        sc.add({ max: TF + FIRE + 0.2, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TC0) {
                return;
            }
            const k = easeOut((life - TC0) / (TF - TC0)) * (1 + 0.08 * Math.sin(life * 20));
            fireOrb(ctx, px, s, mx, my, bw * 0.6, TIMEC, life, k, G, life > TF + FIRE ? 1 - (life - TF - FIRE) / 0.2 : 1, 0, [1, 0.8, 0.6, 0.38], 0.3);
        } });
        sc.at(TF, () => {
            impactFrames(sc, W, H, 0.75, 0.5);
            ultShake(6 + 2 * P, FIRE * 1000);
        });
        sc.add({ max: TF + FIRE + 0.25, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TF) {
                return;
            }
            const front = Math.min(far, (life - TF) * Math.max(1500, W * 3.6));
            const L = Math.hypot(1, dyU);
            const fade = life > TF + FIRE ? 1 - (life - TF - FIRE) / 0.25 : 1;
            beamBody(ctx, px, s, mx, my, dir / L, dyU / L, front * L, bw * (0.95 + 0.05 * Math.sin(life * 40)) * fade, TIMEC, life, 1, G);
            // 시간의 고리 — 광선을 감싸는 세로 고리 (안쪽에 눈금)
            for (let k = 0; k < 5; k++) {
                const d = ((life * 1.3 + k / 5) % 1) * front;
                if (d < bw) {
                    continue;
                }
                const rx = mx + dir * d;
                const ry = my + dyU * d;
                ctx.globalAlpha = 0.9 * fade;
                for (let a = 0; a < TAU; a += 0.3) {
                    ctx.fillStyle = Math.round(a / 0.3) % 3 ? TIMEC[1] : '#ffffff';
                    ctx.fillRect(px(rx + Math.cos(a) * bw * 0.3), px(ry + Math.sin(a) * bw * 1.05), s, s);
                }
            }
        } });
        sc.tick((t) => {
            if (t < TF || t > TF + FIRE) {
                return;
            }
            for (const r of u.others()) {
                if ((r.x - me.x) * dir > 0) {
                    hit(where(u, r), dir, 'tumble');
                }
            }
        });
        sc.at(TSH, () => {
            impactFrames(sc, W, H, 0.7, 0.45);
            K.shards(cx, cy, s, Math.max(s, Math.round(clockR / (18 * s)) * s), TIMEC, 14, H * 0.9, G);
            blastDome(sc, clamp(bx, W * 0.08, W * 0.92), G, clamp(Math.max(H * 0.5, bw * 3.5), 30, Math.min(G * 0.92, W * 0.48)), 1.9, TIMEC);
            ring(sc, cx, cy, clockR, Math.max(W, H) * 0.8, 1, 0.7, ['#ffffff', TIMEC[1], TIMEC[2]], 2);
            ultShake(9 + 3 * P, 1200);
        });
        emberRise(sc, TSH + 0.4, sec, TIMEC);
    }

    // ═════ 펄기아 — 아공절단 (ultbarrage) ═════
    // 공간이 일그러짐(화면에 분홍 격자가 물결치며 휨) · 어깨 진주가 빛남 → 팔을 들어 분홍 초승달 칼날이 커짐
    // → 세 번 벰 — 화면을 가르는 선을 따라 공간이 찢어져 별이 보이는 우주가 드러남(분홍 테두리 · 닿은 애 벌러덩)
    // → 찢어진 틈이 두근거리다 한꺼번에 닫히며 선을 따라 터짐 → 가운데에서 분홍 빛의 반구 (약 7.2초)
    const SPACEC = ['#ffffff', '#ffd6f0', '#ff7ac8', '#9a2a8a'];
    UNIQ.palkia = { fx: 'ultbarrage', ms: (P) => 7200 + 200 * P, run: runSpacialRend };
    function runSpacialRend(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TC0 = 0.6;
        const cuts = [2.0, 2.4, 2.8];
        const TCLOSE = 3.9;
        const q = nearest(u);
        const fx0 = clamp(q && Math.sign(q.x - me.x) === dir ? q.x : me.x + dir * W * 0.42, W * 0.18, W * 0.82);
        const fy0 = clamp(G - H * 0.28, H * 0.3, G - me.h * 0.5);
        const span = Math.hypot(W, H);
        // 세 줄 — 비스듬히 X · 가로 (가운데 fx0, fy0 를 지남)
        const lines = [0.55, -0.55, 0.08].map((a, i) => ({ a: a * dir, t0: cuts[i] }));
        const sc = scene(u, sec + 0.4, 'uniq palkia');
        ultDark(0.45, ms - 200);
        // 일그러진 공간 — 분홍 격자
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp((life - 0.2) / 0.6, 0, 1) * clamp((sec - 0.4 - life) / 0.6, 0, 1) * 0.3;
            if (a <= 0.01) {
                return;
            }
            const gap = Math.max(16, Math.min(W, H) / 7);
            ctx.globalAlpha = a;
            ctx.fillStyle = SPACEC[2];
            for (let gx = 0; gx <= W; gx += gap) {
                for (let y = 0; y < G; y += s * 2) {
                    const off = Math.sin(y * 0.03 + life * 3 + gx * 0.01) * gap * 0.25 * Math.sin(life * 1.5);
                    ctx.fillRect(px(gx + off), px(y), s, s);
                }
            }
            for (let gy = gap / 2; gy < G; gy += gap) {
                for (let x = 0; x < W; x += s * 2) {
                    const off = Math.sin(x * 0.03 - life * 3 + gy * 0.01) * gap * 0.25 * Math.sin(life * 1.5);
                    ctx.fillRect(px(x), px(gy + off), s, s);
                }
            }
        } });
        // 펄기아 (꼭두각시) — 어깨 진주
        puppet(sc, pokemon, u, () => me.b, SPACEC[2], sec - 0.1, { glow: (t) => clamp((t - TC0) / 0.8, 0, 1) * (t < TCLOSE ? 0.15 * (1 + Math.sin(t * 10)) : 0), glowColor: SPACEC[1] });
        sc.add({ max: TCLOSE, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp((life - 0.3) / 0.4, 0, 1) * (0.7 + 0.3 * Math.sin(life * 9));
            for (const sd of [-1, 1]) {
                glint(ctx, px, s, me.x + sd * me.w * 0.28, me.b - me.h * 0.62, me.w * 0.22 * a, a);
            }
        } });
        // 초승달 칼날 — 머리 위에서 커짐
        sc.add({ max: cuts[0] + 0.1, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TC0) {
                return;
            }
            const k = easeOut((life - TC0) / (cuts[0] - TC0));
            const R = Math.max(me.w * 0.9, H * 0.18) * k;
            const ccx = me.x;
            const ccy = me.b - me.h * 1.1;
            for (let i = 0; i <= 24; i++) {
                const an = -Math.PI * (0.15 + 0.7 * (i / 24));
                const th = Math.sin((i / 24) * Math.PI) * Math.max(2 * s, R * 0.18);
                for (let d = R - th; d < R; d += s) {
                    ctx.globalAlpha = 0.95;
                    ctx.fillStyle = d > R - s * 1.5 ? '#ffffff' : d > R - th * 0.5 ? SPACEC[1] : SPACEC[2];
                    ctx.fillRect(px(ccx + Math.cos(an) * d), px(ccy + Math.sin(an) * d * 0.7), s, s);
                }
            }
        } });
        chargeSwirl(sc, () => [me.x, me.b - me.h * 1.1], TC0, cuts[0] - 0.05, Math.max(me.w * 3.5, short(u) * 0.42), Math.max(s * 4, me.w * 0.25), SPACEC, dir);
        // 찢어진 틈 — 선을 따라 렌즈 모양으로 벌어진 우주 (별 · 분홍 테두리)
        const rift = (ctx, px, L, k, close, life) => {
            // 세로 칸마다 한 번에 — 선 위 y 에서 위아래로 벌어진 만큼 (선이 눕혀져 있어서 세로로 칠해도 됨)
            const c = Math.cos(L.a);
            const tn = Math.tan(L.a);
            const half = span * 0.55 * Math.min(1, k * 1.6);
            const wmax = Math.max(4 * s, H * 0.06) * Math.min(1, k * 1.2) * (1 - close) * (1 + 0.15 * Math.sin(life * 18));
            if (wmax < s * 0.5) {
                return;
            }
            const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()]; // 우주 · 바깥 테 · 안쪽 테 · 별
            const x0 = Math.max(0, fx0 - half * Math.abs(c));
            const x1 = Math.min(W, fx0 + half * Math.abs(c));
            for (let x = Math.floor(x0 / s) * s; x < x1; x += s) {
                const d = (x - fx0) / c;
                const f = 1 - Math.abs(d) / Math.max(1, half);
                const hh = (wmax * Math.sqrt(Math.max(0, f))) / Math.abs(c);
                if (hh < s * 0.5) {
                    continue;
                }
                const y = fy0 + tn * (x - fx0);
                if (y - hh > G) {
                    continue;
                }
                const top = px(y - hh);
                const bot = Math.min(px(y + hh), G);
                paths[0].rect(px(x), top, s, Math.max(s, bot - top));
                paths[1].rect(px(x), top - s, s, s);
                paths[1].rect(px(x), bot, s, s);
                paths[2].rect(px(x), top, s, s);
                paths[2].rect(px(x), bot - s, s, s);
                const col = Math.round(x / s);
                if (hash(col, 571) > 0.75) {
                    paths[3].rect(px(x), px(y + (hash(col, 572) - 0.5) * hh * 1.4), s, s);
                }
            }
            K.fillPaths(ctx, paths, ['#07020f', SPACEC[2], SPACEC[1], '#ffffff'], 1);
        };
        sc.add({ max: TCLOSE + 0.1, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const close = clamp((life - TCLOSE + 0.12) / 0.12, 0, 1);
            for (const L of lines) {
                if (life >= L.t0) {
                    rift(ctx, px, L, (life - L.t0) / 0.25, close, life);
                }
            }
        } });
        lines.forEach((L, i) => sc.at(L.t0, () => {
            impactFrames(sc, W, H, 0.45, 0.3);
            ultShake(4 + i, 300);
            const ux = Math.cos(L.a);
            const uy = Math.sin(L.a);
            for (const r of u.others()) {
                // 선까지 거리
                const dx = r.x - fx0;
                const dy = r.y - fy0;
                if (Math.abs(dx * -uy + dy * ux) < r.h * 0.8) {
                    hit(where(u, r), away(u, r.x), 'tumble', 0.3);
                }
            }
            fireBits(fx0, fy0, s, SPACEC, 14, { speed: H * 0.6, life: 0.6 });
        }));
        // 닫히며 선을 따라 터짐 → 분홍 빛의 반구
        sc.at(TCLOSE, () => {
            impactFrames(sc, W, H, 0.7, 0.45);
            for (const L of lines) {
                for (let j = -3; j <= 3; j++) {
                    const x = fx0 + Math.cos(L.a) * j * W * 0.12;
                    const y = fy0 + Math.sin(L.a) * j * W * 0.12;
                    if (x > 0 && x < W && y < G) {
                        sc.at(TCLOSE + Math.abs(j) * 0.05, () => {
                            ring(sc, x, y, s * 2, W * 0.08, 0.85, 0.35, ['#ffffff', SPACEC[2]], 2);
                            fireBits(x, y, s, SPACEC, 8, { speed: H * 0.5, life: 0.5 });
                        });
                    }
                }
            }
            blastDome(sc, fx0, G, clamp(Math.max(H * 0.5, W * 0.22), 30, Math.min(G * 0.92, W * 0.48)), 1.9, SPACEC);
            ultShake(9 + 3 * P, 1200);
            for (const r of u.others()) {
                sc.at(TCLOSE + 0.15, () => hit(where(u, r), away(u, r.x), 'lift', 0.3));
            }
        });
        emberRise(sc, TCLOSE + 0.4, sec, SPACEC);
    }

    // ═════ 기라티나 — 섀도다이브 (ultshadow) ═════
    // 붉은 기운 → 발밑에 그림자 구멍이 열려 기라티나가 스르륵 빠져듦 → 세상이 반전 세계로(보랏빛 · 청록 하늘, 떠오르는 바위섬, 땅에서 솟는 검은 줄기)
    // → 가장 가까운 애 뒤에 구멍이 열리고 기라티나가 튀어나와 들이받음 → 임팩트 프레임 · 어둠의 빛의 반구 → 다시 구멍으로 사라져 제자리 구멍에서 나옴 (약 7.2초)
    const DIST = ['#efe0ff', '#b07ee6', '#5b2fa0', '#1e0a3a'];
    UNIQ.giratina = { fx: 'ultshadow', ms: (P) => 7200 + 200 * P, run: runShadowForce };
    function runShadowForce(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TOPEN = 0.5;
        const TSINK = 0.9;
        const TGONE = 1.5;
        const TWORLD = 1.4;
        const TP2 = 3.0; // 과녁 뒤 구멍
        const THIT = 3.35;
        const TBACK = THIT + 1.9; // 다시 빠져듦
        const TOUT = TBACK + 0.7; // 제자리에서 나옴
        const q = nearest(u);
        const tq = q ? q.x : me.x + dir * W * 0.45;
        const px2 = clamp(tq + (Math.sign(tq - me.x) || dir) * me.w * 0.7, me.w * 0.6, W - me.w * 0.6); // 튀어나올 구멍
        const hx = clamp(tq, W * 0.08, W * 0.92);
        const portals = [{ x: me.x, t0: TOPEN, t1: TGONE + 0.2 }, { x: px2, t0: TP2 - 0.3, t1: TBACK + 0.4 }, { x: me.x, t0: TBACK + 0.3, t1: TOUT + 0.4 }];
        const sc = scene(u, sec + 0.4, 'uniq giratina');
        ultDark(0.5, ms - 200);
        // 반전 세계 — 보랏빛 · 청록 하늘 · 떠오르는 바위섬 · 검은 줄기
        const isles = [];
        for (let i = 0; i < 7; i++) {
            isles.push({ x: hash(i, 551) * W, y0: G - H * (0.15 + 0.5 * hash(i, 552)), z: Math.max(4 * s, W * (0.03 + 0.04 * hash(i, 553))), sp: 0.04 + 0.05 * hash(i, 554) });
        }
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp((life - TWORLD) / 0.5, 0, 1) * clamp((TOUT - life) / 0.6, 0, 1);
            if (a <= 0.01) {
                return;
            }
            ctx.globalAlpha = 0.3 * a;
            ctx.fillStyle = '#123a3a';
            ctx.fillRect(0, 0, W, H * 0.45);
            ctx.globalAlpha = 0.22 * a;
            ctx.fillStyle = DIST[3];
            ctx.fillRect(0, H * 0.45, W, H);
            for (const isl of isles) {
                const y = isl.y0 - (life - TWORLD) * H * isl.sp;
                K.psyRock(ctx, px, s, isl.x + Math.sin(life + isl.x) * s * 3, y, isl.z, 0.4 * a, DIST[1]);
            }
            // 검은 줄기 — 땅에서 솟아 일렁임
            ctx.globalAlpha = 0.8 * a;
            ctx.fillStyle = '#0a0414';
            for (let j = 0; j < 9; j++) {
                const bx0 = hash(j, 561) * W;
                const hgt = H * (0.15 + 0.25 * hash(j, 562)) * (0.7 + 0.3 * Math.sin(life * 2 + j));
                for (let y = 0; y < hgt; y += s) {
                    const sw = Math.sin(y * 0.06 + life * 3 + j) * s * 3 * (y / hgt);
                    const w = Math.max(s, Math.round((s * 3 * (1 - y / hgt)) / s) * s);
                    ctx.fillRect(px(bx0 + sw), px(G - y - s), w, s);
                }
            }
        } });
        // 그림자 구멍 — 땅에 납작한 검은 타원 · 도는 보랏빛 테두리
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            for (const p of portals) {
                const k = clamp((life - p.t0) / 0.25, 0, 1) * clamp((p.t1 - life) / 0.25, 0, 1);
                if (k <= 0.01) {
                    continue;
                }
                const rx = me.w * 0.8 * k;
                ellipse(ctx, px, s, p.x, G - s, rx, rx * 0.25, '#05020a', 0.95, G + s);
                K.ringDots(ctx, px, s, p.x, G - s, rx, 0.25, [DIST[1], DIST[2], '#e0303a'], 0.9, 1);
                for (let j = 0; j < 6; j++) {
                    const an = life * 5 + (j * TAU) / 6;
                    ctx.globalAlpha = 0.8;
                    ctx.fillStyle = DIST[1];
                    ctx.fillRect(px(p.x + Math.cos(an) * rx * 0.7), px(G - s + Math.sin(an) * rx * 0.18 - s * 2 - ((life * 30 + j * 7) % 12) * s * 0.5), s, s);
                }
            }
        } });
        // 붉은 기운 (빠져들기 전, 기라티나 뒤)
        sc.add({ max: TSINK + 0.3, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - 0.1) / 0.3, 0, 1) * (1 - clamp((life - TSINK) / 0.3, 0, 1));
            if (k > 0.02) {
                K.flameTongue(ctx, px, s, me.x, me.b + s * 2, me.w * 1.15, me.h * 1.4, ['#ffd0d0', '#ff6a6a', '#c0202a', '#5a0a14'], life, k);
            }
        } });
        // 기라티나 (꼭두각시) — 빠져듦 · 튀어나옴 · 다시 빠져듦 · 제자리
        const img = pokemon.el;
        const edge = Math.max(1, Math.round(u.s * 0.75));
        hideMon(pokemon, true);
        hideUntil(pokemon, (sec - 0.1) * 1000 + 100);
        sc.at(sec - 0.12, () => hideMon(pokemon, false));
        sc.add({ max: sec - 0.1, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life >= sec - 0.12) {
                return;
            }
            let x = me.x;
            let b = me.b;
            let a = 1;
            let rot = 0;
            let lf = dir < 0;
            if (life > TSINK && life < TGONE) {
                const k = (life - TSINK) / (TGONE - TSINK);
                b = me.b + me.h * easeIn(k);
                a = 1 - k;
            } else if (life >= TGONE && life < THIT - 0.15) {
                return;
            } else if (life >= THIT - 0.15 && life < TBACK) {
                const k = clamp((life - (THIT - 0.15)) / 0.15, 0, 1);
                x = lerp(px2, hx + (px2 > hx ? 1 : -1) * me.w * 0.5, easeOut(clamp((life - THIT + 0.15) / 0.3, 0, 1)));
                b = lerp(G + me.h, G - me.h * 0.3, easeOut(k)) + (life > THIT + 0.3 ? me.h * 0.3 * easeOut(clamp((life - THIT - 0.3) / 0.3, 0, 1)) : 0);
                lf = hx < px2;
                rot = life < THIT + 0.2 ? (lf ? -0.4 : 0.4) : 0;
                x = life > THIT + 0.3 ? lerp(x, px2, easeOut(clamp((life - THIT - 0.3) / 0.5, 0, 1))) : x;
            } else if (life >= TBACK && life < TBACK + 0.5) {
                const k = (life - TBACK) / 0.5;
                x = px2;
                b = G + me.h * easeIn(k);
                a = 1 - k;
                lf = hx < px2;
            } else if (life >= TBACK + 0.5 && life < TOUT - 0.3) {
                return;
            } else if (life >= TOUT - 0.3) {
                const k = clamp((life - (TOUT - 0.3)) / 0.4, 0, 1);
                b = lerp(me.b + me.h, me.b, easeOut(k));
            }
            drawLitMon(ctx, img, x, b, me.w, lf, '#e0303a', edge, a, rot);
            if (life > THIT - 0.05 && life < THIT + 0.15) {
                drawMon(ctx, img, x, b, me.w, lf, 0.7, DIST[0], rot);
            }
        } });
        sc.at(TSINK, () => {
            ring(sc, me.x, G - s, me.w * 0.4, me.w * 2.2, 0.25, 0.4, [DIST[1], DIST[2]], 2);
            ultShake(2, 250);
        });
        sc.at(TP2, () => {
            ultShake(2, 300);
            ring(sc, px2, G - s, me.w * 0.3, me.w * 1.8, 0.25, 0.35, [DIST[1], '#e0303a'], 2);
        });
        // 들이받음 — 어둠의 빛의 반구
        sc.at(THIT, () => {
            impactFrames(sc, W, H, 0.6, 0.6);
            blastDome(sc, hx, G, clamp(Math.max(H * 0.48, me.w * 2.5), 30, Math.min(G * 0.92, W * 0.48)), 1.8, DIST);
            ring(sc, hx, G - s, me.w * 0.5, W * 0.7, 0.25, 0.8, ['#ffffff', DIST[1], '#e0303a'], 3);
            ultShake(9 + 3 * P, 1200);
            for (const r of u.others()) {
                sc.at(THIT + 0.08, () => hit(where(u, r), away(u, r.x), Math.abs(r.x - hx) < W * 0.2 ? 'tumble' : 'lift', 0.3));
            }
        });
        emberRise(sc, THIT + 0.4, sec, DIST);
        sc.at(TOUT, () => {
            ring(sc, me.x, G - s, me.w * 0.4, me.w * 2, 0.25, 0.35, [DIST[1], DIST[2]], 1);
            ultShake(2, 200);
        });
    }

    // ═════ 아르세우스 — 심판의뭉치 (ultskyfall) ═════
    // 둥실 떠올라 몸 둘레 금빛 바퀴가 돌고 뒤로 빛살이 퍼짐 → 머리 위에 거대한 금빛 구를 모음 → 하늘로 쏘아 올림(빛줄기)
    // → 하늘에서 수십 개의 빛 구로 갈라져 화면 전체에 쏟아짐(떨어진 자리마다 금빛 폭발 · 다 맞음) → 가운데에 하늘에서 금빛 기둥 · 금빛 빛의 반구 (약 7.4초)
    const JUDGE = ['#ffffff', '#fff6c0', '#ffd84d', '#d9a400'];
    UNIQ.arceus = { fx: 'ultskyfall', ms: (P) => 7400 + 200 * P, run: runJudgment };
    function runJudgment(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const lift = me.h * 0.25;
        const TC0 = 0.6;
        const TUP = 2.0; // 쏘아 올림
        const TSPLIT = TUP + 0.35;
        const NRAIN = clamp(Math.round(W / 26), 14, 28);
        const TRAIN = TSPLIT + 0.15;
        const TFIN = TRAIN + 1.5; // 금빛 기둥 · 반구
        const footAt = (t) => me.b - lift * easeOut(clamp((t - 0.2) / 0.6, 0, 1)) * (1 - easeIn(clamp((t - (sec - 0.6)) / 0.45, 0, 1))) + Math.sin(t * 2.5) * s * 1.2;
        const orbAt = (t) => [me.x, footAt(t) - me.h - Math.max(me.w * 0.5, 8 * s)];
        const Ro = clamp(me.w * 0.5, 5 * s, H * 0.12);
        const drops = [];
        for (let i = 0; i < NRAIN; i++) {
            drops.push({ x: W * ((i + 0.5) / NRAIN) + (hash(i, 581) - 0.5) * (W / NRAIN), t0: TRAIN + hash(i, 582) * 1.2, T: 0.45 + 0.15 * hash(i, 583), r: Math.max(3 * s, Ro * (0.35 + 0.25 * hash(i, 584))) });
        }
        const fxC = clamp(me.x + dir * W * 0.4, W * 0.15, W * 0.85);
        const sc = scene(u, sec + 0.4, 'uniq arceus');
        ultDark(0.45, ms - 200);
        // 빛살 · 금빛 바퀴 (아르세우스 뒤)
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - 0.3) / 0.6, 0, 1) * clamp((sec - 0.5 - life) / 0.5, 0, 1);
            if (k <= 0.01) {
                return;
            }
            const cx = me.x;
            const cy = footAt(life) - me.h * 0.5;
            ctx.globalAlpha = 0.25 * k;
            ctx.fillStyle = JUDGE[2];
            for (let j = 0; j < 16; j++) {
                const an = (j / 16) * TAU + life * 0.4;
                for (let d = me.w * 0.6; d < me.w * (1.6 + 0.4 * Math.sin(life * 3 + j)); d += s) {
                    ctx.fillRect(px(cx + Math.cos(an) * d), px(cy + Math.sin(an) * d), s, s);
                }
            }
            K.ringDots(ctx, px, s, cx, cy, me.w * 0.62, 0.55, [JUDGE[0], JUDGE[2], JUDGE[3]], 0.9 * k, 2);
            for (let j = 0; j < 8; j++) {
                const an = life * 2 + (j * TAU) / 8;
                glint(ctx, px, s, cx + Math.cos(an) * me.w * 0.62, cy + Math.sin(an) * me.w * 0.62 * 0.55, me.w * 0.08, 0.9 * k);
            }
        } });
        puppet(sc, pokemon, u, footAt, JUDGE[2], sec - 0.1, { glow: (t) => clamp((t - TC0) / 0.8, 0, 1) * (t < TUP ? 0.15 * (1 + Math.sin(t * 10)) : 0) + (t > TUP && t < TUP + 0.12 ? 0.6 : 0), glowColor: JUDGE[1] });
        chargeSwirl(sc, orbAt, TC0, TUP - 0.05, Math.max(me.w * 3.5, short(u) * 0.45), Math.max(s * 4, Ro * 0.6), JUDGE, dir);
        sc.add({ max: TUP + 0.05, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TC0) {
                return;
            }
            const [x, y] = orbAt(life);
            fireOrb(ctx, px, s, x, y, Ro, JUDGE, life, easeOut((life - TC0) / (TUP - TC0)) * (1 + 0.1 * Math.max(0, Math.sin(life * 9)) ** 4), G, 1, 0, [1, 0.8, 0.6, 0.38], 0.4);
        } });
        // 쏘아 올림 — 빛 구가 하늘로 (빛줄기)
        sc.add({ max: TSPLIT + 0.3, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TUP) {
                return;
            }
            const [x0, y0] = orbAt(TUP);
            const k = easeIn(clamp((life - TUP) / (TSPLIT - TUP), 0, 1));
            const y = lerp(y0, -Ro, k);
            const fade = life > TSPLIT ? 1 - (life - TSPLIT) / 0.3 : 1;
            beamBody(ctx, px, s, x0, y0, 0, -1, y0 - y, Ro * 0.7 * fade, JUDGE, life, 1);
            if (life < TSPLIT) {
                fireOrb(ctx, px, s, x0, y, Ro * 0.8, JUDGE, life, 1, G, 1, 0, [1, 0.8, 0.6, 0.38], 0.4);
            }
        } });
        sc.at(TUP, () => {
            impactFrames(sc, W, H, 0.5, 0.3);
            ultShake(4, 300);
        });
        sc.at(TSPLIT, () => {
            ring(sc, me.x, s * 4, Ro, W * 0.6, 0.4, 0.6, ['#ffffff', JUDGE[1], JUDGE[2]], 2);
        });
        // 쏟아지는 빛 구
        drops.forEach((d) => {
            sc.add({ max: TFIN + 0.1, draw: (ctx, it, t, px) => {
                const life = sc.t;
                const k = (life - d.t0) / d.T;
                if (k < 0 || k > 1) {
                    return;
                }
                const sx = me.x + (d.x - me.x) * 0.3;
                const x = lerp(sx, d.x, k);
                const y = lerp(-d.r, G - d.r * 0.5, easeIn(k));
                const L = Math.hypot(d.x - sx, G);
                K.fireTail(ctx, px, s, x, y, (d.x - sx) / L, G / L, d.r * 6, d.r * 1.6, JUDGE, life + d.x, 1);
            } });
            sc.at(d.t0 + d.T, () => {
                sc.add({ max: 0.5, draw: (ctx, q, tt, px) => {
                    fireOrb(ctx, px, s, d.x, G, d.r * 2.2, JUDGE, q.life + d.x, easeOut(Math.min(1, tt / 0.3)), G + s, tt > 0.7 ? (1 - tt) / 0.3 : 1, clamp((tt - 0.3) / 0.6, 0, 1));
                } });
                ring(sc, d.x, G - s, d.r, d.r * 5, 0.25, 0.4, ['#ffffff', JUDGE[2]], 1);
                ultShake(2, 100);
                for (const r of u.others()) {
                    if (Math.abs(r.x - d.x) < d.r * 3 + r.w * 0.4) {
                        hit(where(u, r), away(u, d.x), 'tumble', 0.8);
                    }
                }
            });
        });
        // 금빛 기둥 · 반구
        sc.at(TFIN, () => {
            impactFrames(sc, W, H, 0.75, 0.45);
            K.firePillar(sc, fxC, G, clamp(W * 0.14, 8 * s, W * 0.2), 1.7, JUDGE);
            blastDome(sc, fxC, G, clamp(Math.max(H * 0.5, W * 0.25), 30, Math.min(G * 0.92, W * 0.48)), 1.9, JUDGE);
            ring(sc, fxC, G - s, W * 0.05, W * 0.9, 0.22, 0.8, ['#ffffff', JUDGE[1], JUDGE[2]], 3);
            ultShake(10 + 3 * P, 1300);
            for (const r of u.others()) {
                sc.at(TFIN + 0.12, () => hit(where(u, r), away(u, fxC), 'lift', 0.3));
            }
        });
        emberRise(sc, TFIN + 0.4, sec, JUDGE);
    }

    // ═════ 다크라이 — 다크홀 (ultblackhole) ═════
    // 화면이 칠흑같이 어두워지고 다크라이의 푸른 눈이 번뜩 → 손을 들자 다른 포켓몬 발밑마다 검은 구멍(보랏빛 테두리가 소용돌이)이 열려 빨아들이듯 — 모두 잠듦(Z)
    // → 악몽 — 잠든 애들 둘레로 검은 그림자가 맴돎 → 화면 가운데 거대한 다크홀이 열려 빛 부스러기를 빨아들임 → 무너지며 임팩트 프레임 · 어둠의 빛의 반구 (약 7.2초)
    const VOID = ['#d8ccff', '#7a5ad8', '#2e1868', '#0a0418'];
    UNIQ.darkrai = { fx: 'ultblackhole', ms: (P) => 7200 + 200 * P, run: runDarkVoid };
    function runDarkVoid(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TEYE = 0.5;
        const THAND = 0.9;
        const TSLEEP = 1.7;
        const TBIG = 3.0; // 거대한 다크홀
        const TB = TBIG + 1.3; // 무너짐
        const targets = u.others();
        const holeX = clamp(me.x + dir * W * 0.4, W * 0.2, W * 0.8);
        const holeY = clamp(G - H * 0.35, H * 0.25, G - me.h);
        const holeR = clamp(Math.min(W, H) * 0.16, 16, 110);
        const sc = scene(u, sec + 0.4, 'uniq darkrai');
        ultDark(0.75, ms - 200);
        // 발밑 검은 구멍 — 다른 포켓몬마다 (없으면 땅 곳곳)
        const spots = targets.length ? targets.map((r) => ({ r })) : [0.3, 0.55, 0.8].map((k) => ({ x: me.x + dir * W * k * 0.8 }));
        sc.add({ max: TB + 0.2, draw: (ctx, it, t, px) => {
            const life = sc.t;
            spots.forEach((sp, i) => {
                const k = clamp((life - THAND - i * 0.1) / 0.4, 0, 1) * clamp((TB - life) / 0.3, 0, 1);
                if (k <= 0.01) {
                    return;
                }
                const r = sp.r ? where(u, sp.r) : null;
                const x = r ? r.x : sp.x;
                const rx = (r ? r.w * 0.9 : W * 0.06) * k;
                ellipse(ctx, px, s, x, G - s, rx, rx * 0.28, VOID[3], 0.95, G + s);
                K.ringDots(ctx, px, s, x, G - s, rx, 0.28, [VOID[1], VOID[2]], 0.9, 1);
                for (let j = 0; j < 8; j++) {
                    const an = -life * 4 + (j * TAU) / 8;
                    const rr = rx * (0.4 + 0.5 * (((life * 1.5 + j / 8) % 1)));
                    ctx.globalAlpha = 0.8;
                    ctx.fillStyle = VOID[1];
                    ctx.fillRect(px(x + Math.cos(an) * rr), px(G - s + Math.sin(an) * rr * 0.28), s, s);
                }
            });
        } });
        // 잠듦 — Z · 악몽 그림자
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TSLEEP) {
                return;
            }
            for (const sp of spots) {
                if (!sp.r) {
                    continue;
                }
                const r = where(u, sp.r);
                for (let i = 0; i < 3; i++) {
                    const ph = ((life - TSLEEP) * 0.8 + i / 3) % 1;
                    const z = Math.max(s, Math.round((r.w * (0.05 + 0.04 * ph)) / s) * s);
                    zGlyph(ctx, px, s, r.x + r.w * (0.2 + ph * 0.25), r.bottom - r.h * (1 + ph * 0.8), z, VOID[0], Math.sin(ph * Math.PI) * 0.9);
                }
                if (life < TB) {
                    for (let j = 0; j < 3; j++) {
                        const an = life * 3 + (j * TAU) / 3;
                        const gx = r.x + Math.cos(an) * r.w * 0.8;
                        const gy = r.y + Math.sin(an) * r.h * 0.35;
                        ctx.globalAlpha = 0.7;
                        ctx.fillStyle = '#05020a';
                        ctx.fillRect(px(gx - s * 2), px(gy - s * 3), s * 4, s * 5);
                        ctx.fillStyle = '#5ad8ff';
                        ctx.fillRect(px(gx - s), px(gy - s * 2), s, s);
                        ctx.fillRect(px(gx + s), px(gy - s * 2), s, s);
                    }
                }
            }
        } });
        targets.forEach((r, i) => sc.at(TSLEEP + i * 0.08, () => {
            hit(where(u, r), away(u, r.x), 'shake', 0);
            ring(sc, r.x, r.y, r.w * 0.3, r.w * 1.4, 0.85, 0.35, [VOID[0], VOID[1]], 1);
        }));
        // 다크라이 (꼭두각시) — 푸른 눈 번뜩
        puppet(sc, pokemon, u, (t) => me.b - Math.sin(t * 2) * s * 2, VOID[1], sec - 0.1, { glow: (t) => clamp((t - THAND) / 0.6, 0, 1) * 0.15 * (1 + Math.sin(t * 8)), glowColor: VOID[0] });
        sc.add({ max: TEYE + 0.5, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const e = clamp(1 - Math.abs(life - TEYE - 0.1) / 0.15, 0, 1);
            if (e > 0) {
                glint(ctx, px, s, me.x + dir * me.w * 0.12, me.b - me.h * 0.78, me.w * 0.35 * e, e);
            }
        } });
        // 거대한 다크홀 — 가운데 · 빛 부스러기를 빨아들임
        sc.add({ max: TB + 0.05, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TBIG) {
                return;
            }
            const k = easeOut((life - TBIG) / 0.5) * (life > TB - 0.15 ? 1 - (life - (TB - 0.15)) / 0.15 : 1);
            const R = holeR * k;
            ellipse(ctx, px, s, holeX, holeY, R * 1.6, R * 1.6 * 0.3, VOID[1], 0.5);
            ellipse(ctx, px, s, holeX, holeY, R * 1.25, R * 1.25 * 0.3, VOID[0], 0.6);
            ellipse(ctx, px, s, holeX, holeY, R, R, '#000000', 1);
            K.ringDots(ctx, px, s, holeX, holeY, R, 1, [VOID[1], VOID[0]], 0.9, 2);
            for (let j = 0; j < 14; j++) {
                const an = -life * 3 + (j * TAU) / 14;
                const rr = R * (1.1 + 1.6 * (1 - ((life * 1.2 + j / 14) % 1)));
                ctx.globalAlpha = 0.85;
                ctx.fillStyle = j % 2 ? VOID[0] : VOID[1];
                ctx.fillRect(px(holeX + Math.cos(an) * rr), px(holeY + Math.sin(an) * rr * 0.6), s, s);
            }
        } });
        chargeSwirl(sc, () => [holeX, holeY], TBIG + 0.2, TB - 0.1, Math.max(holeR * 4, short(u) * 0.5), Math.max(s * 4, holeR * 0.5), VOID, -dir);
        sc.at(TBIG, () => {
            ultShake(3, 1200);
            ring(sc, holeX, holeY, holeR * 3, holeR * 0.5, 1, 0.5, [VOID[0], VOID[1]], 2);
        });
        sc.at(TB, () => {
            impactFrames(sc, W, H, 0.55, 0.65);
            blastDome(sc, holeX, G, clamp(Math.max(H * 0.5, holeR * 3.5), 30, Math.min(G * 0.92, W * 0.48)), 1.9, VOID);
            ring(sc, holeX, holeY, holeR, Math.max(W, H) * 0.8, 1, 0.7, ['#ffffff', VOID[0], VOID[1]], 2);
            ultShake(9 + 3 * P, 1200);
            for (const r of targets) {
                sc.at(TB + 0.1, () => hit(where(u, r), away(u, holeX), 'tumble', 0.3));
            }
        });
        emberRise(sc, TB + 0.4, sec, VOID);
    }

    // 얼음 덩어리 — 갇힌 애 (r = { x, bottom, w, h }) 위에, k 0~1 커짐
    function iceBlock(ctx, px, s, r, k, pal) {
        const bwid = r.w * 1.2 * k;
        const bh = r.h * 1.2 * k;
        if (bwid < s * 2) {
            return;
        }
        const x0 = r.x - bwid / 2;
        const y0 = r.bottom - bh;
        for (let xx = 0; xx < bwid; xx += s) {
            const jg = (Math.floor(xx / (2 * s)) % 3) * s;
            ctx.globalAlpha = 0.38;
            ctx.fillStyle = pal[1];
            ctx.fillRect(px(x0 + xx), px(y0 + jg), s, px(bh - jg));
            ctx.globalAlpha = 0.95;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(px(x0 + xx), px(y0 + jg), s, s);
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px(x0), px(y0), s, px(bh));
        ctx.fillStyle = pal[3];
        ctx.fillRect(px(x0 + bwid - s), px(y0 + s * 2), s, px(bh - s * 2));
        ctx.fillRect(px(x0), px(r.bottom - s), px(bwid), s);
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < Math.min(bwid, bh) * 0.5; i += s) {
            ctx.fillRect(px(x0 + bwid * 0.2 + i), px(y0 + bh * 0.25 + i), s, s);
        }
    }
    // 눈 결정 — 가지 여섯, 가지마다 곁가지 둘 (rot 돌기)
    function snowflake(ctx, px, s, x, y, R, rot, cols, alpha) {
        if (R < s * 2 || alpha <= 0.01) {
            return;
        }
        const path = [new Path2D(), new Path2D()];
        for (let i = 0; i < 6; i++) {
            const a = rot + (i * TAU) / 6;
            for (let d = 0; d < R; d += s) {
                path[d > R * 0.7 ? 1 : 0].rect(px(x + Math.cos(a) * d), px(y + Math.sin(a) * d), s, s);
            }
            for (const at of [0.45, 0.72]) {
                for (const sd of [-1, 1]) {
                    const b = a + sd * 0.8;
                    const bx = x + Math.cos(a) * R * at;
                    const by = y + Math.sin(a) * R * at;
                    for (let d = 0; d < R * (0.95 - at) * 0.9; d += s) {
                        path[1].rect(px(bx + Math.cos(b) * d), px(by + Math.sin(b) * d), s, s);
                    }
                }
            }
        }
        path[0].rect(px(x - s), px(y - s), 3 * s, 3 * s);
        K.fillPaths(ctx, path, [cols[0], cols[2]], alpha);
    }

    // ═════ 프리저 — 절대영도 (ultnova) ═════
    // 눈보라가 비스듬히 몰아치고 땅에 서리가 번짐 → 프리저가 떠올라 날갯짓 · 둘레로 눈 결정이 돌고 등 뒤에 거대한 눈 결정이 돌며 커짐
    // → 임팩트 프레임 · 절대영도의 파동 — 땅을 따라 얼음 가시가 양옆으로 퍼지며 솟고 다른 포켓몬이 모두 얼음 덩어리에 갇힘
    // → 정적 → 와장창 깨지며 얼음 조각 · 하얀 빛의 반구 (약 7.2초)
    const FROST = ['#ffffff', '#e8fbff', '#a8e8ff', '#5aa8e0'];
    UNIQ.articuno = { fx: 'ultnova', ms: (P) => 7200 + 200 * P, run: runSheerCold };
    function runSheerCold(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const lift = me.h * 0.35;
        const TC0 = 0.6;
        const TW = 2.4; // 파동
        const WSEC = 0.9;
        const TS = TW + WSEC + 0.55; // 깨짐
        const footAt = (t) => me.b - lift * easeOut(clamp((t - 0.3) / 0.6, 0, 1)) * (1 - easeIn(clamp((t - (sec - 0.6)) / 0.45, 0, 1))) + Math.sin(t * 3) * s * 1.5;
        const core = (t) => [me.x, footAt(t) - me.h * 0.5];
        const reach = Math.max(me.x, W - me.x);
        const spikes = [];
        for (const sd of [-1, 1]) {
            for (let d = me.w * 0.7; d < reach; d += Math.max(W * 0.045, 8 * s)) {
                const x = me.x + sd * d;
                if (x < -s * 4 || x > W + s * 4) {
                    continue;
                }
                spikes.push({ x, h: Math.max(6 * s, H * (0.08 + 0.12 * hash(d, 591 + sd))), w: Math.max(4 * s, W * (0.02 + 0.015 * hash(d, 592))), lean: sd * 0.15 * hash(d, 593), t0: TW + (d / reach) * WSEC });
            }
        }
        const frozen = [];
        const sc = scene(u, sec + 0.4, 'uniq articuno');
        ultDark(0.45, ms - 200);
        // 차가운 하늘 · 비스듬한 눈보라
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp(life / 0.6, 0, 1) * clamp((sec - 0.3 - life) / 0.6, 0, 1);
            ctx.globalAlpha = 0.14 * a;
            ctx.fillStyle = FROST[3];
            ctx.fillRect(0, 0, W, H);
            ctx.globalAlpha = 0.75 * a;
            ctx.fillStyle = '#ffffff';
            const m = Math.round(50 * clamp(W / 480, 0.6, 2));
            for (let j = 0; j < m; j++) {
                const k = (hash(j, 601) + life * (0.5 + 0.4 * hash(j, 602))) % 1;
                const x = ((hash(j, 603) * W * 1.4 - k * W * 0.4 * dir) % W + W) % W;
                const y = k * G;
                ctx.fillRect(px(x), px(y), s * 2, s);
            }
        } });
        // 땅에 번지는 서리
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = easeOut(clamp((life - 0.3) / 2, 0, 1)) * clamp((sec - 0.3 - life) / 0.6, 0, 1);
            const half = reach * k;
            const path = new Path2D();
            for (let x = Math.max(0, me.x - half); x < Math.min(W, me.x + half); x += s * 2) {
                const hgt = s * (1 + Math.round(2 * hash(Math.round(x / s), 611)));
                path.rect(px(x), px(G - hgt), s * 2, hgt);
            }
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = FROST[1];
            ctx.fill(path);
        } });
        // 등 뒤 거대한 눈 결정 (프리저 뒤)
        sc.add({ max: TS, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = easeOut(clamp((life - TC0) / 1.4, 0, 1)) * (1 - clamp((life - TS + 0.15) / 0.15, 0, 1));
            const [x, y] = core(life);
            snowflake(ctx, px, s, x, y, Math.max(me.w * 1.2, H * 0.25) * k, life * 0.6, FROST, 0.85 * k);
        } });
        puppet(sc, pokemon, u, footAt, FROST[2], sec - 0.1, { glow: (t) => (t > TW - 0.05 && t < TW + 0.1 ? 0.7 : clamp((t - TC0) / 1, 0, 1) * (t < TW ? 0.15 * (1 + Math.sin(t * 10)) : 0)), glowColor: '#ffffff' });
        // 둘레로 도는 작은 눈 결정
        sc.add({ max: TW + 0.2, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - TC0) / 0.5, 0, 1);
            const [x, y] = core(life);
            for (let i = 0; i < 6; i++) {
                const a = life * 2.5 * dir + (i * TAU) / 6;
                snowflake(ctx, px, s, x + Math.cos(a) * me.w * 0.9, y + Math.sin(a) * me.w * 0.45, Math.max(3 * s, me.w * 0.12), -life * 2, FROST, 0.9 * k);
            }
        } });
        chargeSwirl(sc, core, TC0, TW - 0.05, Math.max(me.w * 4, short(u) * 0.45), Math.max(s * 4, me.w * 0.3), FROST, dir);
        // 절대영도 파동 — 얼음 가시 · 얼음 덩어리
        sc.at(TW, () => {
            impactFrames(sc, W, H, 0.75, 0.4);
            ring(sc, me.x, G - s, me.w * 0.5, reach * 1.1, 0.2, WSEC, ['#ffffff', FROST[1], FROST[2]], 3);
            ring(sc, me.x, footAt(TW) - me.h * 0.5, me.w * 0.5, Math.max(W, H) * 0.8, 0.85, WSEC + 0.2, [FROST[0], FROST[2]], 2);
            ultShake(5 + 2 * P, 700);
        });
        const spikeDraw = (ctx, px, sp, k, white) => {
            const hh = sp.h * k;
            for (let y = 0; y < hh; y += s) {
                const f = y / Math.max(1, hh);
                const half = (sp.w / 2) * (f > 0.55 ? (1 - f) / 0.45 : 1);
                if (half < s * 0.5) {
                    continue;
                }
                const cx = sp.x + sp.lean * y;
                const yy = px(G - y - s);
                ctx.globalAlpha = 0.9;
                ctx.fillStyle = white ? '#ffffff' : FROST[2];
                ctx.fillRect(px(cx - half), yy, Math.max(s, px(2 * half)), s);
                ctx.fillStyle = white ? '#ffffff' : FROST[1];
                ctx.fillRect(px(cx - half), yy, Math.max(s, px(half * 0.6)), s);
                ctx.fillStyle = FROST[3];
                ctx.fillRect(px(cx + half * 0.5), yy, Math.max(s, px(half * 0.5)), s);
            }
        };
        sc.add({ max: TS + 0.05, draw: (ctx, it, t, px) => {
            const life = sc.t;
            for (const sp of spikes) {
                if (life >= sp.t0) {
                    spikeDraw(ctx, px, sp, easeOut((life - sp.t0) / 0.15), life > TS - 0.12);
                }
            }
            for (const f of frozen) {
                iceBlock(ctx, px, s, where(u, f.r), easeOut((life - f.t0) / 0.15), FROST);
            }
        } });
        for (const r of u.others()) {
            const tf = TW + (Math.abs(r.x - me.x) / reach) * WSEC;
            sc.at(tf, () => {
                frozen.push({ r, t0: tf });
                hit(where(u, r), away(u, r.x), 'shake', 0);
            });
        }
        // 와장창 · 하얀 반구
        sc.at(TS, () => {
            impactFrames(sc, W, H, 0.7, 0.4);
            for (const sp of spikes) {
                if (hash(sp.x, 621) > 0.5) {
                    K.shards(sp.x, G - sp.h * 0.5, s, Math.max(s, Math.round(sp.w / (6 * s)) * s), FROST, 3, H * 0.6, G);
                }
            }
            for (const f of frozen) {
                const r = where(u, f.r);
                K.shards(r.x, r.y, s, Math.max(s, Math.round(r.w / (12 * s)) * s), FROST, 9, H * 0.8, G);
                sc.at(TS + 0.05, () => hit(r, away(u, r.x), 'lift', 0.3));
            }
            blastDome(sc, me.x, G, clamp(Math.max(H * 0.52, W * 0.25), 30, Math.min(G * 0.92, W * 0.5)), 1.9, FROST);
            ultShake(9 + 3 * P, 1100);
        });
        emberRise(sc, TS + 0.4, sec, FROST);
    }

    // ═════ 썬더 — 번개 (ultstorm) ═════
    // 먹구름이 몰려와 구름 속이 번쩍 → 썬더가 구름 아래로 솟아 날개에 번개 깃이 돋고 구름에서 번개가 썬더에게 연달아 이어짐(충전)
    // → 번개가 화면 곳곳에 차례로 내리꽂힘(다른 포켓몬 먼저, 꽂힌 땅마다 터짐 · 전기가 기어감) → 하늘을 가로지르는 거대한 번개 새가 번쩍
    // → 가운데로 내리꽂혀 굵은 번개 기둥 · 노란 빛의 반구 → 제자리로 (약 7.4초)
    UNIQ.zapdos = { fx: 'ultstorm', ms: (P) => 7400 + 200 * P, run: runZapdosThunder };
    function runZapdosThunder(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const bandH = Math.max(40, H * 0.3);
        const cloudY = bandH * 0.38;
        const lift = me.h * 0.5;
        const charges = [0.8, 1.15, 1.45, 1.7, 1.9];
        const TRAIN = 2.15; // 번개 비
        const NB = 10;
        const TBIRD = TRAIN + NB * 0.11 + 0.25; // 번개 새
        const TI = TBIRD + 0.45; // 내리꽂힘
        const footAt = (t) => me.b - lift * easeOut(clamp((t - 0.4) / 0.5, 0, 1)) * (1 - easeIn(clamp((t - (sec - 0.6)) / 0.45, 0, 1))) + Math.sin(t * 3) * s * 1.5;
        const core = (t) => [me.x, footAt(t) - me.h * 0.5];
        const spots = u.others().map((r) => ({ r }));
        while (spots.length < NB) {
            spots.push({ x: W * (0.06 + 0.88 * hash(spots.length, 631)) });
        }
        const cxF = clamp(me.x + dir * W * 0.4, W * 0.15, W * 0.85);
        const sc = scene(u, sec + 0.4, 'uniq zapdos');
        ultDark(0.45, ms - 200);
        let lit = 0;
        sc.tick((t, dt) => {
            lit = Math.max(0, lit - dt);
        });
        skyBand(sc, '#070914', bandH * 1.2, 0.7, sec);
        cloudBank(sc, { y: cloudY, h: bandH * 0.42, cols: ['#6b7090', '#454a63', '#2c3045'], sec, lit: () => (lit > 0 ? 1 : 0), speed: 30 * dir, litCols: ['#ffffff', ZAPC[1], ZAPC[2]] });
        // 날개 번개 깃 (썬더 뒤)
        sc.add({ max: TI + 0.3, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - 0.6) / 0.4, 0, 1) * (1 - clamp((life - TI) / 0.3, 0, 1));
            if (k <= 0.02) {
                return;
            }
            const [x, y] = core(life);
            for (let j = 0; j < 7; j++) {
                const seed = Math.floor(life * 14 + j);
                const a = -Math.PI * (0.1 + 0.8 * (j / 6)) + (hash(seed, j) - 0.5) * 0.2;
                const len = Math.max(me.w, me.h) * (0.6 + 0.4 * hash(seed, j + 3)) * k;
                drawBolt(ctx, px, s, jag(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, Math.max(2 * s, len / 5), 0.3), 1, ZAPC[2], ZAPC[3], 0.9 * k);
            }
        } });
        puppet(sc, pokemon, u, footAt, ZAPC[2], sec - 0.1, { glow: (t) => (charges.some((c) => t > c && t < c + 0.08) ? 0.8 : clamp((t - 0.6) / 0.6, 0, 1) * 0.12 * (1 + Math.sin(t * 18))), glowColor: '#ffffff' });
        // 충전 — 구름에서 썬더로
        charges.forEach((tc, i) => sc.at(tc, () => {
            const [x, y] = core(tc);
            strike(sc, x + rnd(-1, 1) * me.w, cloudY, x, y, { w: 2, mid: ZAPC[2], glow: ZAPC[3], dur: 0.25, branches: 1 });
            lit = 0.1;
            ring(sc, x, y, me.w * 0.4, me.w * (1.4 + i * 0.25), 0.85, 0.3, ['#ffffff', ZAPC[2]], 2);
            ultShake(1.5 + i * 0.4, 140);
        }));
        // 번개 비
        spots.slice(0, NB).forEach((sp, i) => sc.at(TRAIN + i * 0.11, () => {
            const x = sp.r ? where(u, sp.r).x : sp.x;
            strike(sc, x + rnd(-0.5, 0.5) * W * 0.05, cloudY, x, G - s, { w: 3, mid: ZAPC[1], glow: ZAPC[3], dur: 0.35, branches: 2 });
            lit = 0.12;
            ring(sc, x, G - s, s * 2, W * 0.1, 0.25, 0.4, ['#ffffff', ZAPC[2]], 2);
            groundArcs(sc, x, G - s, W * 0.1, 0.6, ZAPC[2], 2, 1, G - s);
            fireBits(x, G - s, s, ZAPC, 10, { angle: -Math.PI / 2, spread: 2, speed: H * 0.5, g: H * 1.5, life: 0.6 });
            ultShake(3, 160);
            if (sp.r) {
                hit(where(u, sp.r), away(u, x), 'tumble', 0.5);
            }
        }));
        // 거대한 번개 새 — 하늘을 가로지르며 번쩍, 가운데로 내리꽂힘
        sc.add({ max: TI + 0.05, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TBIRD) {
                return;
            }
            const k = clamp((life - TBIRD) / (TI - TBIRD), 0, 1);
            const bx = lerp(cxF - dir * W * 0.35, cxF, easeIn(k));
            const by = lerp(bandH * 0.9, G - H * 0.15, easeIn(k));
            const span = Math.min(W * 0.6, H * 1.0) * (1 - 0.35 * k);
            const flap = Math.sin(life * 16) * 0.18;
            const seedT = Math.floor(life * 20);
            const jit = (i, sd) => (hash(seedT + i, sd + 9) - 0.5) * s * 4;
            // 날개 — 앞쪽 가장자리 (활처럼) + 뒤로 늘어진 깃 세 줄
            for (const sd of [-1, 1]) {
                const edge = [];
                for (let i = 0; i <= 7; i++) {
                    const f = i / 7;
                    edge.push([bx + sd * span * f * 0.5, by - Math.sin(f * Math.PI * 0.85) * span * (0.26 + flap) + f * f * span * 0.1 + jit(i, sd)]);
                }
                drawBolt(ctx, px, s, edge, 3, ZAPC[1], ZAPC[3], 1);
                for (const at of [3, 5, 7]) {
                    const [ex, ey] = edge[at];
                    drawBolt(ctx, px, s, jag(ex, ey, ex - sd * span * 0.06 - dir * span * 0.05, ey + span * (0.16 + at * 0.012), 3 * s, 0.25), 1, ZAPC[2], ZAPC[3], 0.9);
                }
            }
            // 몸통 · 꼬리 부채 · 부리
            drawBolt(ctx, px, s, jag(bx + dir * span * 0.1, by - span * 0.06, bx - dir * span * 0.18, by + span * 0.06, 3 * s, 0.15), 3, '#ffffff', ZAPC[2], 1);
            for (const tl of [-0.5, 0, 0.5]) {
                const tx0 = bx - dir * span * 0.18;
                const ty0 = by + span * 0.06;
                drawBolt(ctx, px, s, jag(tx0, ty0, tx0 - dir * span * 0.2, ty0 + span * (0.1 + tl * 0.12), 3 * s, 0.25), 2, ZAPC[1], ZAPC[3], 0.95);
            }
            drawBolt(ctx, px, s, [[bx + dir * span * 0.1, by - span * 0.06], [bx + dir * span * 0.22, by - span * 0.02]], 2, '#ffffff', ZAPC[2], 1);
            fireOrb(ctx, px, s, bx, by - span * 0.03, Math.max(4 * s, span * 0.07), ZAPC, life, 1, G, 1, 0, [1, 0.8, 0.6, 0.38], 0.4);
        } });
        sc.at(TBIRD, () => {
            lit = 0.4;
            impactFrames(sc, W, H, 0.45, 0.25);
            ultShake(4, 500);
        });
        sc.at(TI, () => {
            impactFrames(sc, W, H, 0.8, 0.5);
            strike(sc, cxF, 0, cxF, G - s, { w: 7, mid: ZAPC[1], glow: ZAPC[3], dur: 0.6, branches: 4 });
            K.firePillar(sc, cxF, G, clamp(W * 0.12, 8 * s, W * 0.2), 1.5, ZAPC);
            blastDome(sc, cxF, G, clamp(Math.max(H * 0.5, W * 0.24), 30, Math.min(G * 0.92, W * 0.48)), 1.9, ZAPC);
            groundArcs(sc, cxF, G - s, W * 0.6, 1.2, ZAPC[1], 6, 2, G - s);
            lit = 0.5;
            ultShake(10 + 3 * P, 1300);
            for (const r of u.others()) {
                sc.at(TI + 0.12, () => hit(where(u, r), away(u, cxF), 'lift', 0.3));
            }
        });
        emberRise(sc, TI + 0.4, sec, ZAPC);
    }

    // ═════ 라이코 — 번개 (ultthunder) ═════
    // 포효 · 먹구름 → 등의 비구름에 번개가 연달아 내리꽂혀 충전(보랏빛 · 노란 기운) → 번개처럼 화면 세 곳으로 순간이동(잔상 · 이어지는 번개 줄)하며
    // 자리마다 굵은 번개 기둥이 쾅 → 가운데로 돌아와 포효 — 하늘에서 거대한 번개 기둥 · 노란 빛의 반구 → 제자리로 (약 7.2초)
    const RAIKO = ['#ffffff', '#fff8a8', '#ffd23b', '#8a5ad8'];
    UNIQ.raikou = { fx: 'ultthunder', ms: (P) => 7200 + 200 * P, run: runRaikouThunder };
    function runRaikouThunder(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const bandH = Math.max(40, H * 0.3);
        const cloudY = bandH * 0.38;
        const charges = [0.7, 1.05, 1.35, 1.6, 1.8];
        const TJ0 = 2.1; // 순간이동 시작
        const STEP = 0.42;
        const stops = [0.25, 0.65, 0.9].map((k) => clamp(me.x + dir * W * k * 0.85, me.w * 0.6, W - me.w * 0.6));
        const cxF = clamp(W / 2, me.w, W - me.w);
        const TCEN = TJ0 + stops.length * STEP; // 가운데로
        const TI = TCEN + 0.45; // 거대 기둥
        const THOME = sec - 0.45;
        const xAt = (t) => {
            if (t < TJ0) {
                return me.x;
            }
            const i = Math.floor((t - TJ0) / STEP);
            if (i < stops.length) {
                return stops[i];
            }
            if (t < THOME) {
                return cxF;
            }
            return lerp(cxF, me.x, easeOut(clamp((t - THOME) / 0.35, 0, 1)));
        };
        const sc = scene(u, sec + 0.4, 'uniq raikou');
        ultDark(0.45, ms - 200);
        let lit = 0;
        sc.tick((t, dt) => {
            lit = Math.max(0, lit - dt);
        });
        skyBand(sc, '#0a0716', bandH * 1.2, 0.7, sec);
        cloudBank(sc, { y: cloudY, h: bandH * 0.42, cols: ['#6b6090', '#463e63', '#2c2645'], sec, lit: () => (lit > 0 ? 1 : 0), speed: 25 * dir, litCols: ['#ffffff', RAIKO[1], RAIKO[2]] });
        // 기운 (라이코 뒤)
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - 0.6) / 0.4, 0, 1) * clamp((THOME - life) / 0.3, 0, 1);
            if (k > 0.02) {
                K.flameTongue(ctx, px, s, xAt(life), me.b + s * 2, me.w * 1.15, me.h * 1.35, [RAIKO[0], RAIKO[1], RAIKO[2], RAIKO[3]], life, k);
            }
        } });
        // 잔상 · 이어지는 번개 줄 (순간이동)
        sc.add({ max: TI, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TJ0) {
                return;
            }
            const pts = [me.x, ...stops, cxF];
            const n = Math.min(pts.length - 1, Math.floor((life - TJ0) / STEP) + 1);
            for (let i = 0; i < n; i++) {
                const age = life - (TJ0 + i * STEP);
                const a = clamp(1 - age / 0.6, 0, 1);
                if (a <= 0) {
                    continue;
                }
                const y = me.b - me.h * 0.5;
                drawBolt(ctx, px, s, jag(pts[i], y, pts[i + 1], y, 3 * s, 0.12), 2, RAIKO[2], RAIKO[3], a);
                drawMon(ctx, pokemon.el, pts[i], me.b, me.w, pts[i + 1] < pts[i], 0.4 * a, RAIKO[3]);
            }
        } });
        puppet(sc, pokemon, u, () => me.b, RAIKO[2], sec - 0.1, { x: xAt, glow: (t) => (charges.some((c) => t > c && t < c + 0.08) ? 0.8 : clamp((t - 0.6) / 0.6, 0, 1) * 0.12 * (1 + Math.sin(t * 16))), glowColor: '#ffffff' });
        sc.at(0.4, () => {
            ring(sc, me.x, me.b - me.h * 0.6, me.w * 0.4, me.w * 2.2, 0.9, 0.45, ['#ffffff', RAIKO[2]], 2);
            ultShake(3, 300);
        });
        charges.forEach((tc, i) => sc.at(tc, () => {
            strike(sc, me.x + rnd(-0.5, 0.5) * me.w, cloudY, me.x, me.b - me.h * 0.7, { w: 2, mid: RAIKO[2], glow: RAIKO[3], dur: 0.25, branches: 1 });
            lit = 0.1;
            ring(sc, me.x, me.b - me.h * 0.5, me.w * 0.4, me.w * (1.4 + i * 0.25), 0.85, 0.3, ['#ffffff', RAIKO[2]], 2);
            ultShake(1.5 + i * 0.4, 140);
        }));
        // 자리마다 번개 기둥
        stops.forEach((x, i) => sc.at(TJ0 + i * STEP + 0.05, () => {
            strike(sc, x, cloudY, x, G - s, { w: 5, mid: RAIKO[1], glow: RAIKO[3], dur: 0.4, branches: 3 });
            lit = 0.15;
            ring(sc, x, G - s, me.w * 0.4, W * 0.18, 0.22, 0.5, ['#ffffff', RAIKO[2], RAIKO[3]], 2);
            groundArcs(sc, x, G - s, W * 0.15, 0.7, RAIKO[2], 3, 1, G - s);
            fireBits(x, G - s, s, RAIKO, 14, { angle: -Math.PI / 2, spread: 2, speed: H * 0.6, g: H * 1.5, life: 0.6 });
            ultShake(5, 250);
            for (const r of u.others()) {
                if (Math.abs(r.x - x) < W * 0.12 + r.w * 0.5) {
                    hit(where(u, r), away(u, x), 'tumble', 0.5);
                }
            }
        }));
        // 거대 기둥 · 반구
        sc.at(TCEN + 0.1, () => {
            ring(sc, cxF, me.b - me.h * 0.6, me.w * 0.4, me.w * 2.6, 0.9, 0.45, ['#ffffff', RAIKO[2]], 2);
            ultShake(4, 300);
        });
        sc.at(TI, () => {
            impactFrames(sc, W, H, 0.8, 0.5);
            strike(sc, cxF, 0, cxF, G - s, { w: 8, mid: RAIKO[1], glow: RAIKO[3], dur: 0.6, branches: 4 });
            K.firePillar(sc, cxF, G, clamp(W * 0.12, 8 * s, W * 0.2), 1.5, RAIKO);
            blastDome(sc, cxF, G, clamp(Math.max(H * 0.5, W * 0.24), 30, Math.min(G * 0.92, W * 0.48)), 1.9, RAIKO);
            lit = 0.5;
            ultShake(10 + 3 * P, 1300);
            for (const r of u.others()) {
                sc.at(TI + 0.12, () => hit(where(u, r), away(u, cxF), 'lift', 0.3));
            }
        });
        emberRise(sc, TI + 0.4, sec, RAIKO);
    }

    // ═════ 앤테이 — 분화 (ultquake) ═════
    // 포효 · 땅이 달아올라 붉은 금 · 연기 → 앤테이 둘레 땅에서 용암 분수 셋이 치솟고 하늘이 붉게 · 재가 날림
    // → 불타는 바위들이 높이 솟구쳤다 화면 곳곳에 쏟아져 터짐(닿은 애 벌러덩) → 과녁 땅이 터지며 거대한 용암 기둥 · 용암 빛의 반구 (약 7.2초)
    UNIQ.entei = { fx: 'ultquake', ms: (P) => 7200 + 200 * P, run: runEruption };
    function runEruption(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TROAR = 0.4;
        const TFOUNT = 1.0; // 용암 분수
        const TBOMB = 1.8; // 불타는 바위
        const NB = clamp(Math.round(W / 45), 8, 16);
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * W * 0.45, W * 0.1, W * 0.9);
        const TP = TBOMB + 1.7; // 용암 기둥
        const bombs = [];
        for (let i = 0; i < NB; i++) {
            bombs.push({ x: W * (0.05 + 0.9 * hash(i, 651)), t0: TBOMB + i * 0.09, T: 0.7 + 0.2 * hash(i, 652), r: Math.max(3 * s, W * (0.012 + 0.012 * hash(i, 653))) });
        }
        const sc = scene(u, sec + 0.4, 'uniq entei');
        ultDark(0.35, ms - 200);
        // 붉은 하늘 · 재
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp((life - 0.6) / 0.8, 0, 1) * clamp((sec - 0.3 - life) / 0.6, 0, 1);
            if (a <= 0.01) {
                return;
            }
            ctx.globalAlpha = 0.22 * a;
            ctx.fillStyle = '#b02a0a';
            ctx.fillRect(0, 0, W, H);
            ctx.globalAlpha = 0.6 * a;
            ctx.fillStyle = '#3a2a24';
            for (let j = 0; j < 30; j++) {
                const y = ((hash(j, 661) * G + life * G * 0.12) % G);
                const x = ((hash(j, 662) * W + Math.sin(life + j) * s * 8) % W + W) % W;
                ctx.fillRect(px(x), px(y), s, s);
            }
        } });
        // 달아오른 땅 금 · 연기
        sc.at(TROAR, () => {
            groundArcs(sc, me.x, G - s, W * 0.5, 2.5, LAVAC[1], 6, 1, G - s);
            ring(sc, me.x, me.b - me.h * 0.6, me.w * 0.4, me.w * 2.4, 0.9, 0.45, ['#ffffff', LAVAC[1]], 2);
            ultShake(4, 400);
        });
        // 기운 (앤테이 뒤)
        sc.add({ max: TP + 0.5, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - 0.3) / 0.4, 0, 1) * (1 - clamp((life - TP) / 0.5, 0, 1));
            if (k > 0.02) {
                K.flameTongue(ctx, px, s, me.x, me.b + s * 2, me.w * 1.2, me.h * 1.45, ['#ffffff', '#fff3a0', '#ff8a2a', '#c02a0a'], life, k);
            }
        } });
        puppet(sc, pokemon, u, () => me.b, LAVAC[2], sec - 0.1, { glow: (t) => clamp((t - 0.3) / 0.6, 0, 1) * 0.15 * (1 + Math.sin(t * 10)), glowColor: LAVAC[0] });
        // 용암 분수 셋
        [-1.4, 1.4, 2.6].forEach((k, i) => sc.at(TFOUNT + i * 0.15, () => {
            const x = clamp(me.x + dir * me.w * k, W * 0.04, W * 0.96);
            K.firePillar(sc, x, G, Math.max(5 * s, me.w * 0.35), 1.4, LAVAC);
            ultShake(4, 250);
        }));
        // 불타는 바위 — 솟구쳤다 떨어짐
        bombs.forEach((b) => {
            const x0 = me.x + dir * me.w * 0.3;
            sc.add({ max: sec, draw: (ctx, it, t, px) => {
                const life = sc.t;
                const k = (life - b.t0) / b.T;
                if (k < 0 || k > 1) {
                    return;
                }
                const x = lerp(x0, b.x, k);
                const y = lerp(G - me.h, G - b.r, k) - Math.sin(k * Math.PI) * G * 0.85;
                const vx = b.x - x0;
                const vy = -Math.cos(k * Math.PI) * G * 0.85 * Math.PI + (G - b.r - (G - me.h));
                const L = Math.hypot(vx, vy) || 1;
                K.fireTail(ctx, px, s, x, y, vx / L, vy / L, b.r * 6, b.r * 2.2, LAVAC, life + b.x, 1);
                ctx.globalAlpha = 1;
                ctx.fillStyle = BASALT[1];
                ctx.fillRect(px(x - b.r * 0.6), px(y - b.r * 0.6), px(b.r * 1.2), px(b.r * 1.2));
            } });
            sc.at(b.t0 + b.T, () => {
                sc.add({ max: 0.5, draw: (ctx, q2, tt, px) => {
                    fireOrb(ctx, px, s, b.x, G, b.r * 3, LAVAC, q2.life + b.x, easeOut(Math.min(1, tt / 0.3)), G + s, tt > 0.7 ? (1 - tt) / 0.3 : 1, clamp((tt - 0.3) / 0.6, 0, 1));
                } });
                debris(b.x, G - s, s, [...BASALT, LAVAC[2]], 8, H * 0.5, { ground: G });
                ultShake(2.5, 120);
                for (const r of u.others()) {
                    if (Math.abs(r.x - b.x) < b.r * 4 + r.w * 0.4) {
                        hit(where(u, r), away(u, b.x), 'tumble', 0.8);
                    }
                }
            });
        });
        // 거대한 용암 기둥 · 반구
        sc.at(TP, () => {
            impactFrames(sc, W, H, 0.75, 0.45);
            K.firePillar(sc, tx, G, clamp(me.w * 0.9, 8 * s, W * 0.18), 1.8, LAVAC);
            blastDome(sc, tx, G, clamp(Math.max(H * 0.5, W * 0.24), 30, Math.min(G * 0.92, W * 0.48)), 1.9, LAVAC);
            ultShake(10 + 3 * P, 1300);
            for (const r of u.others()) {
                sc.at(TP + 0.12, () => hit(where(u, r), away(u, tx), 'lift', 0.3));
            }
        });
        emberRise(sc, TP + 0.4, sec, LAVAC);
    }

    // ═════ 스이쿤 — 오로라빔 (ultbeam) ═════
    // 땅에 맑은 물이 깔리고 북풍이 붐 · 하늘에 오로라 커튼이 드리움 → 이마 수정에 빛이 모임 → 임팩트 프레임 · 무지개 띠 광선이 화면 끝까지
    // (지나간 물이 반짝이는 얼음 결정으로 굳음, 닿은 애 벌러덩) → 정화 — 수정 기둥이 솟고 다이아몬드 가루가 반짝이며 물빛 빛의 반구 (약 7.2초)
    const AQUA = ['#ffffff', '#d8fbff', '#7fe8ff', '#2aa8d8'];
    UNIQ.suicune = { fx: 'ultbeam', ms: (P) => 7200 + 200 * P, run: runAuroraBeam };
    function runAuroraBeam(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TC0 = 0.9;
        const TF = 2.2;
        const FIRE = 1.3;
        const TPUR = TF + FIRE + 0.3; // 정화
        const [mx, my] = [u.mouth.x + dir * s * 2, Math.min(u.mouth.y, G - me.h * 0.3)];
        const far = dir > 0 ? W - mx : mx;
        const bw = clamp(H * 0.1 * (0.9 + 0.3 * P), 7 * s, H * 0.17);
        const speed = Math.max(far / 0.45, 600);
        const frontAt = (t) => clamp((t - TF) * speed, 0, far);
        const bands = ['#ff7a9a', '#ffd06a', '#9effa0', '#7fe0ff', '#c9a0ff'];
        const sc = scene(u, sec + 0.4, 'uniq suicune');
        ultDark(0.4, ms - 200);
        // 오로라 커튼 — 세로로 드리운 빛 줄기들이 일렁임
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp((life - 0.4) / 0.8, 0, 1) * clamp((sec - 0.3 - life) / 0.6, 0, 1);
            if (a <= 0.01) {
                return;
            }
            const c = Math.max(s, Math.round(short(u) / 90));
            for (let x = 0; x < W; x += c) {
                const k = Math.sin(x * 0.015 + life * 0.8) * 0.5 + 0.5;
                const top = H * (0.05 + 0.06 * Math.sin(x * 0.03 + life));
                const len = H * (0.15 + 0.2 * k);
                const col = k > 0.66 ? '#5dffb0' : k > 0.33 ? '#7fe8ff' : '#e0a0ff';
                ctx.globalAlpha = (0.12 + 0.18 * k) * a;
                ctx.fillStyle = col;
                ctx.fillRect(Math.round(x / c) * c, Math.round(top / c) * c, c, Math.round(len / c) * c);
            }
        } });
        // 맑은 물 · 반짝이는 결정
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp((life - 0.2) / 0.6, 0, 1) * clamp((sec - 0.3 - life) / 0.6, 0, 1);
            if (a <= 0.01) {
                return;
            }
            const h = Math.max(2 * s, H * 0.025);
            const front = frontAt(life);
            for (let x = 0; x < W; x += s) {
                const d = (x - mx) * dir;
                const frozen = life > TF && d > 0 && d < front;
                ctx.globalAlpha = 0.6 * a;
                ctx.fillStyle = frozen ? AQUA[1] : AQUA[3];
                ctx.fillRect(px(x), px(G - h), s, px(h));
                if (frozen && hash(Math.round(x / s), 671) > 0.85) {
                    ctx.globalAlpha = 0.9 * a;
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(px(x), px(G - h - s * (1 + Math.round(2 * hash(Math.round(x / s), 672)))), s, s);
                } else if (!frozen && Math.sin(x * 0.07 + life * 4) > 0.9) {
                    ctx.globalAlpha = 0.8 * a;
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(px(x), px(G - h), s, s);
                }
            }
        } });
        // 북풍 줄
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp((life - 0.3) / 0.4, 0, 1) * clamp((TPUR - life) / 0.5, 0, 1);
            ctx.globalAlpha = 0.45 * a;
            ctx.fillStyle = AQUA[1];
            for (let j = 0; j < 10; j++) {
                const y = H * 0.35 + hash(j, 681) * (G - H * 0.35 - s * 6);
                const len = W * (0.06 + 0.1 * hash(j, 682));
                const x = ((hash(j, 683) * W + life * W * 0.8 * dir) % (W + len) + W + len) % (W + len) - len;
                ctx.fillRect(px(x), px(y), px(len), s);
            }
        } });
        puppet(sc, pokemon, u, () => me.b, AQUA[2], sec - 0.1, { glow: (t) => (t > TF - 0.05 && t < TF + 0.1 ? 0.7 : clamp((t - TC0) / 1, 0, 1) * (t < TF ? 0.15 * (1 + Math.sin(t * 10)) : 0)), glowColor: '#ffffff' });
        chargeSwirl(sc, () => [mx, my], TC0, TF - 0.05, Math.max(me.w * 3.5, short(u) * 0.42), Math.max(s * 4, bw * 0.45), AQUA, dir);
        sc.add({ max: TF + FIRE + 0.2, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TC0) {
                return;
            }
            const k = easeOut((life - TC0) / (TF - TC0)) * (1 + 0.08 * Math.sin(life * 20));
            fireOrb(ctx, px, s, mx, my, bw * 0.6, AQUA, life, k, G, life > TF + FIRE ? 1 - (life - TF - FIRE) / 0.2 : 1, 0, [1, 0.8, 0.6, 0.38], 0.3);
            glint(ctx, px, s, mx, my, bw * 0.8 * k, 0.9);
        } });
        sc.at(TF, () => {
            impactFrames(sc, W, H, 0.65, 0.4);
            ultShake(4 + 2 * P, FIRE * 1000);
        });
        // 무지개 띠 광선 — 띠 다섯이 나란히, 하얀 심
        sc.add({ max: TF + FIRE + 0.25, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TF) {
                return;
            }
            const fade = life > TF + FIRE ? 1 - (life - TF - FIRE) / 0.25 : 1;
            const front = frontAt(life);
            const ww = bw * (0.95 + 0.05 * Math.sin(life * 35)) * fade;
            const bh = ww / bands.length;
            for (let x = 0; x < front; x += s) {
                const xx = mx + dir * x;
                const wv = Math.sin(x * 0.05 - life * 20) * s;
                const cap = Math.sqrt(Math.min(1, x / (ww * 0.5) + 0.2));
                bands.forEach((col, i) => {
                    const off = (i - (bands.length - 1) / 2) * bh * cap;
                    ctx.globalAlpha = 0.95 * fade;
                    ctx.fillStyle = col;
                    ctx.fillRect(px(xx), px(my + off - bh / 2 + wv), s, Math.max(s, px(bh * cap)));
                });
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(px(xx), px(my - bh * 0.25 * cap + wv), s, Math.max(s, px(bh * 0.5 * cap)));
            }
            for (let j = 0; j < 8; j++) {
                const d = ((life * 0.9 + j / 8) % 1) * front;
                glint(ctx, px, s, mx + dir * d, my + Math.sin(j * 2.1 + life * 6) * ww * 0.7, ww * 0.25, 0.85 * fade);
            }
        } });
        sc.tick((t) => {
            if (t < TF || t > TF + FIRE) {
                return;
            }
            const front = frontAt(t);
            for (const r of u.others()) {
                const d = (r.x - mx) * dir;
                if (d > 0 && d < front + r.w * 0.5) {
                    hit(where(u, r), dir, 'tumble');
                }
            }
        });
        // 정화 — 수정 기둥 · 다이아몬드 가루 · 반구
        sc.at(TPUR, () => {
            impactFrames(sc, W, H, 0.6, 0.35);
            for (let i = 0; i < 6; i++) {
                const x = mx + dir * far * (0.15 + 0.15 * i);
                if (x > 0 && x < W) {
                    sc.at(TPUR + i * 0.06, () => K.geyser(sc, x, G, Math.max(3 * s, W * 0.018), G * (0.3 + 0.2 * hash(i, 691)), 0.9, AQUA));
                }
            }
            blastDome(sc, clamp(mx + dir * far * 0.6, W * 0.08, W * 0.92), G, clamp(Math.max(H * 0.45, W * 0.22), 30, Math.min(G * 0.92, W * 0.45)), 1.8, AQUA);
            ultShake(8 + 2 * P, 1000);
        });
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TPUR) {
                return;
            }
            const a = clamp((life - TPUR) / 0.3, 0, 1) * clamp((sec - 0.2 - life) / 0.6, 0, 1);
            for (let j = 0; j < 30; j++) {
                const x = hash(j, 701) * W;
                const y = ((hash(j, 702) * G + (life - TPUR) * G * 0.1) % G);
                if (Math.sin(life * 8 + j * 1.7) > 0.3) {
                    glint(ctx, px, s, x, y, s * 2, 0.8 * a);
                }
            }
        } });
    }

    // 모래 바람 — 화면을 가로지르는 모래 알갱이 · 옅은 갈색 물듦 (a 0~1)
    function sandWind(ctx, px, s, W, G, life, a, dirn, cols) {
        if (a <= 0.01) {
            return;
        }
        ctx.globalAlpha = 0.16 * a;
        ctx.fillStyle = cols[2];
        ctx.fillRect(0, 0, W, G);
        const m = Math.round(70 * clamp(W / 480, 0.6, 2));
        const paths = [new Path2D(), new Path2D()];
        for (let j = 0; j < m; j++) {
            const y = hash(j, 711) * G;
            const sp = 0.6 + 0.8 * hash(j, 712);
            const x = ((hash(j, 713) * W + life * W * sp * dirn) % W + W) % W;
            paths[j % 3 ? 0 : 1].rect(px(x), px(y + Math.sin(life * 3 + j) * s * 2), s * (j % 4 ? 2 : 3), s);
        }
        K.fillPaths(ctx, paths, [cols[1], cols[0]], 0.8 * a);
    }
    const SANDC = ['#fff0c8', '#e8c890', '#b8925a', '#7a5a34'];

    // ═════ 한카리아스 — 드래곤다이브 (ultdive) ═════
    // 몸 둘레로 모래 회오리가 일어 화면이 모래바람에 휩싸임 → 땅을 파고 들어가 사라짐(흙먼지) → 하늘 높은 곳에서 푸른 용의 기운이 번쩍
    // → 거대한 용 머리 모양 혜성(송곳니 · 붉은 눈)이 되어 과녁으로 내리꽂힘 → 임팩트 프레임 · 모래 폭발 · 용빛 반구 → 땅에서 튀어나와 제자리로 (약 7.2초)
    const DRAGC = ['#ffffff', '#b8c8ff', '#6a5cff', '#2a1a8a'];
    UNIQ.garchomp = { fx: 'ultdive', ms: (P) => 7200 + 200 * P, run: runDragonRush };
    function runDragonRush(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TDIG = 1.2; // 파고 들어감
        const TSKY = 2.2; // 하늘에서 번쩍
        const TDIVE = 2.6;
        const TI = TDIVE + 0.5;
        const TOUT = TI + 2.2; // 땅에서 튀어나옴
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * W * 0.45, W * 0.1, W * 0.9);
        const sx0 = clamp(tx - dir * W * 0.3, W * 0.08, W * 0.92);
        const sy0 = Math.max(20, H * 0.12);
        const headAt = (t) => {
            const k = easeIn(clamp((t - TDIVE) / (TI - TDIVE), 0, 1));
            return [lerp(sx0, tx, k), lerp(sy0, G - me.h * 0.5, k)];
        };
        const sc = scene(u, sec + 0.4, 'uniq garchomp');
        ultDark(0.4, ms - 200);
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            sandWind(ctx, px, s, W, G, life, clamp((life - 0.2) / 0.6, 0, 1) * clamp((sec - 0.4 - life) / 0.6, 0, 1), dir, SANDC);
        } });
        // 몸 둘레 모래 회오리
        sc.add({ max: TDIG + 0.3, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - 0.2) / 0.4, 0, 1) * (1 - clamp((life - TDIG) / 0.3, 0, 1));
            for (let j = 0; j < 40; j++) {
                const f = j / 40;
                const an = life * 8 + j * 0.9;
                const r = me.w * (0.4 + 0.6 * f);
                ctx.globalAlpha = (Math.sin(an) > 0 ? 0.9 : 0.4) * k;
                ctx.fillStyle = j % 3 ? SANDC[1] : SANDC[2];
                ctx.fillRect(px(me.x + Math.cos(an) * r), px(me.b - f * me.h * 1.3), s * 2, s);
            }
        } });
        // 한카리아스 (꼭두각시) — 파고 들어감 · 튀어나옴
        const img = pokemon.el;
        const edge = Math.max(1, Math.round(u.s * 0.75));
        const left = dir < 0;
        hideMon(pokemon, true);
        hideUntil(pokemon, (sec - 0.1) * 1000 + 100);
        sc.at(sec - 0.12, () => hideMon(pokemon, false));
        sc.add({ max: sec - 0.1, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life >= sec - 0.12) {
                return;
            }
            let b = me.b;
            let a = 1;
            let x = me.x;
            if (life > TDIG - 0.3 && life < TDIG + 0.2) {
                const k = (life - (TDIG - 0.3)) / 0.5;
                b = me.b + me.h * easeIn(k);
                a = 1 - k;
            } else if (life >= TDIG + 0.2 && life < TOUT) {
                return;
            } else if (life >= TOUT) {
                const k = clamp((life - TOUT) / 0.35, 0, 1);
                b = me.b - Math.sin(k * Math.PI) * me.h * 0.8;
                x = me.x;
            }
            drawLitMon(ctx, img, x, b, me.w, left, DRAGC[2], edge, a);
        } });
        sc.at(TDIG - 0.2, () => {
            debris(me.x, G - s, s, [...SANDC, '#8a7252'], 30, H * 0.6, { ground: G });
            ring(sc, me.x, G - s, me.w * 0.4, me.w * 2.5, 0.25, 0.4, [SANDC[0], SANDC[2]], 2);
            ultShake(4, 300);
        });
        // 하늘에서 번쩍 · 용 머리 혜성
        sc.at(TSKY, () => {
            ring(sc, sx0, sy0, me.w * 0.3, me.w * 2.4, 1, 0.4, ['#ffffff', DRAGC[1], DRAGC[2]], 2);
            sparkles(sx0, sy0, s, DRAGC, 14, me.w, H * 0.1);
            ultShake(2, 200);
        });
        sc.add({ max: TI + 0.02, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TSKY) {
                return;
            }
            if (life < TDIVE) {
                const k = (life - TSKY) / (TDIVE - TSKY);
                fireOrb(ctx, px, s, sx0, sy0, Math.max(5 * s, me.w * 0.5) * easeOut(k), DRAGC, life, 1, G, 1, 0, [1, 0.8, 0.6, 0.38], 0.5);
                return;
            }
            const [x, y] = headAt(life);
            const dx = tx - sx0;
            const dy = G - me.h * 0.5 - sy0;
            const L = Math.hypot(dx, dy) || 1;
            const ux = dx / L;
            const uy = dy / L;
            const R = Math.max(6 * s, me.w * 0.7);
            K.fireTail(ctx, px, s, x, y, ux, uy, Math.max(H * 0.55, R * 5), R * 1.6, DRAGC, life, 1);
            fireOrb(ctx, px, s, x, y, R * 0.8, DRAGC, life, 1, G, 1, 0, [1, 0.8, 0.6, 0.38], 0.4);
            // 송곳니 — 머리 앞 위아래로 하얀 이빨
            const nx = -uy;
            const ny = ux;
            for (const sd of [-1, 1]) {
                for (let i = 0; i < 4; i++) {
                    const bx = x + ux * R * 0.7 + nx * sd * R * (0.25 + i * 0.12);
                    const by = y + uy * R * 0.7 + ny * sd * R * (0.25 + i * 0.12);
                    for (let d = 0; d < R * 0.45; d += s) {
                        ctx.globalAlpha = 1;
                        ctx.fillStyle = d > R * 0.3 ? DRAGC[1] : '#ffffff';
                        ctx.fillRect(px(bx + ux * d - nx * sd * d * 0.3), px(by + uy * d - ny * sd * d * 0.3), s, s);
                    }
                }
                // 붉은 눈
                ctx.fillStyle = '#ff3a3a';
                ctx.fillRect(px(x - ux * R * 0.2 + nx * sd * R * 0.5), px(y - uy * R * 0.2 + ny * sd * R * 0.5), s * 2, s * 2);
            }
            // 뿔 — 뒤로 뻗은 두 줄
            for (const sd of [-1, 1]) {
                drawBolt(ctx, px, s, [[x + nx * sd * R * 0.4, y + ny * sd * R * 0.4], [x - ux * R * 1.6 + nx * sd * R * 1.1, y - uy * R * 1.6 + ny * sd * R * 1.1]], 1, DRAGC[1], DRAGC[3], 0.9);
            }
        } });
        sc.at(TI, () => {
            impactFrames(sc, W, H, 0.8, 0.5);
            blastDome(sc, tx, G, clamp(Math.max(H * 0.5, me.w * 3), 30, Math.min(G * 0.92, W * 0.48)), 1.9, DRAGC);
            debris(tx, G - s, s, [...SANDC, '#8a7252'], 50, H * 1.1, { ground: G, size: [1, 2, 3] });
            ring(sc, tx, G - s, me.w, W * 0.8, 0.22, 0.8, ['#ffffff', DRAGC[1], DRAGC[2]], 3);
            ultShake(10 + 3 * P, 1300);
            for (const r of u.others()) {
                sc.at(TI + 0.12, () => hit(where(u, r), away(u, tx), Math.abs(r.x - tx) < W * 0.2 ? 'tumble' : 'lift', 0.3));
            }
        });
        emberRise(sc, TI + 0.4, sec, DRAGC);
        sc.at(TOUT, () => {
            debris(me.x, G - s, s, [...SANDC, '#8a7252'], 20, H * 0.6, { ground: G });
            ring(sc, me.x, G - s, me.w * 0.4, me.w * 2.2, 0.25, 0.4, [SANDC[0], DRAGC[2]], 2);
            ultShake(3, 200);
        });
    }

    // ═════ 마기라스 — 스톤에지 (ultpillar) ═════
    // 포효 · 거센 모래바람 · 검은 기운 → 몸 둘레로 날카로운 바위 조각이 하나씩 떠올라 빙글빙글 돎
    // → 바위가 하나씩 과녁 쪽 땅에 비스듬히 날아가 꽂히며 거대한 바위 가시로 솟음(닿은 애 떠오름) → 가시가 한꺼번에 깨지며 바위 조각 · 흙빛 빛의 반구 (약 7.2초)
    const STONE = ['#f0e0c0', '#c0a078', '#806448', '#4a3828'];
    UNIQ.tyranitar = { fx: 'ultpillar', ms: (P) => 7200 + 200 * P, run: runStoneEdge };
    function runStoneEdge(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const N = 6;
        const TA = 0.9; // 바위 떠오름
        const TT = 2.4; // 던지기 시작
        const GAP = 0.2;
        const FLY = 0.3;
        const far = dir > 0 ? W - me.x : me.x;
        const stones = [];
        for (let i = 0; i < N; i++) {
            const d = me.w * 0.9 + (far - me.w * 0.9) * ((i + 0.6) / N);
            stones.push({ i, t0: TA + i * 0.12, tt: TT + i * GAP, tx: clamp(me.x + dir * d, s * 4, W - s * 4), h: Math.min(G * 0.8, H * (0.3 + 0.3 * ((i + 1) / N))), w: Math.max(8 * s, Math.min(H * 0.15, ((far - me.w) / N) * 0.85)), z: Math.max(3 * s, me.w * 0.2) });
        }
        const TB = TT + N * GAP + FLY + 0.5; // 깨짐
        const orbit = (st, t) => {
            const an = t * 2.4 * dir + (st.i * TAU) / N;
            return [me.x + Math.cos(an) * me.w * 0.95, me.b - me.h * 0.55 + Math.sin(an) * me.h * 0.35];
        };
        const sc = scene(u, sec + 0.4, 'uniq tyranitar');
        ultDark(0.4, ms - 200);
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            sandWind(ctx, px, s, W, G, life, clamp((life - 0.2) / 0.5, 0, 1) * clamp((sec - 0.4 - life) / 0.6, 0, 1), dir, SANDC);
        } });
        // 검은 기운 (마기라스 뒤)
        sc.add({ max: TB, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - 0.3) / 0.4, 0, 1) * (1 - clamp((life - TB + 0.3) / 0.3, 0, 1));
            if (k > 0.02) {
                K.flameTongue(ctx, px, s, me.x, me.b + s * 2, me.w * 1.2, me.h * 1.4, ['#c8b8a0', '#6a5a4a', '#3a2e26', '#1a1410'], life, k);
            }
        } });
        puppet(sc, pokemon, u, () => me.b, STONE[2], sec - 0.1, { glow: (t) => (t > 0.4 && t < 0.52 ? 0.6 : 0), glowColor: STONE[0] });
        sc.at(0.4, () => {
            ring(sc, me.x, me.b - me.h * 0.6, me.w * 0.4, me.w * 2.4, 0.9, 0.45, ['#ffffff', STONE[1]], 2);
            ultShake(4, 400);
        });
        // 날카로운 바위 조각
        const shard = (ctx, px, x, y, z, ang) => {
            const pts = [[1.2, 0], [0.2, 0.45], [-0.8, 0.25], [-0.6, -0.3], [0.3, -0.4]];
            const ca = Math.cos(ang);
            const sa = Math.sin(ang);
            for (let gy = -z; gy <= z; gy += s) {
                for (let gx = -z * 1.2; gx <= z * 1.2; gx += s) {
                    const lx = (gx * ca + gy * sa) / z;
                    const ly = (-gx * sa + gy * ca) / z;
                    // 간단한 볼록 다각형 안쪽 판정
                    let inside = true;
                    for (let i = 0; i < pts.length; i++) {
                        const [ax, ay] = pts[i];
                        const [bx, by] = pts[(i + 1) % pts.length];
                        if ((bx - ax) * (ly - ay) - (by - ay) * (lx - ax) < 0) {
                            inside = false;
                            break;
                        }
                    }
                    if (inside) {
                        ctx.fillStyle = ly < -0.1 ? STONE[1] : ly > 0.2 ? STONE[3] : STONE[2];
                        ctx.fillRect(px(x + gx), px(y + gy), s, s);
                    }
                }
            }
        };
        sc.add({ max: TB, draw: (ctx, it, t, px) => {
            const life = sc.t;
            ctx.globalAlpha = 1;
            for (const st of stones) {
                if (life < st.t0 || life > st.tt + FLY) {
                    continue;
                }
                let x;
                let y;
                let ang;
                if (life < st.tt) {
                    const up = easeOut((life - st.t0) / 0.4);
                    [x, y] = orbit(st, life);
                    y = lerp(G, y, up);
                    ang = life * 3 + st.i;
                } else {
                    const k = (life - st.tt) / FLY;
                    const [ox, oy] = orbit(st, st.tt);
                    x = lerp(ox, st.tx, k);
                    y = lerp(oy, G - st.z, k * k);
                    ang = Math.atan2(G - oy, st.tx - ox);
                }
                shard(ctx, px, x, y, st.z, ang);
            }
        } });
        // 바위 가시 — 꽂힌 자리에 솟음
        const spike = (ctx, px, st, k, crack) => {
            const hh = st.h * k;
            for (let y = 0; y < hh; y += s) {
                const f = y / Math.max(1, st.h);
                const half = (st.w / 2) * (1 - f) ** 0.7 * (1 + 0.12 * Math.sin(y * 0.3 + st.i));
                if (half < s * 0.5) {
                    continue;
                }
                const cx = st.tx + dir * 0.1 * y;
                const yy = px(G - y - s);
                ctx.globalAlpha = 1;
                ctx.fillStyle = STONE[2];
                ctx.fillRect(px(cx - half), yy, Math.max(s, px(2 * half)), s);
                ctx.fillStyle = STONE[1];
                ctx.fillRect(px(cx - half), yy, Math.max(s, px(half * 0.6)), s);
                ctx.fillStyle = STONE[3];
                ctx.fillRect(px(cx + half * 0.5), yy, Math.max(s, px(half * 0.5)), s);
                if (crack > 0 && Math.round(y / s) % 5 === 0) {
                    ctx.fillStyle = '#fff3c0';
                    ctx.fillRect(px(cx - half * 0.3), yy, Math.max(s, px(half * 0.6 * crack)), s);
                }
            }
        };
        sc.add({ max: TB + 0.05, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const crack = clamp((life - TB + 0.35) / 0.35, 0, 1);
            for (const st of stones) {
                const tl = st.tt + FLY;
                if (life >= tl) {
                    spike(ctx, px, st, easeOut((life - tl) / 0.15), crack);
                }
            }
        } });
        stones.forEach((st) => sc.at(st.tt + FLY, () => {
            ring(sc, st.tx, G - s, st.w * 0.4, st.w * 3, 0.25, 0.4, [STONE[0], STONE[2]], 2);
            debris(st.tx, G - s, s, [...STONE, '#8a7252'], 12, H * 0.7, { ground: G });
            ultShake(4, 200);
            for (const r of u.others()) {
                if (Math.abs(r.x - st.tx) < st.w + r.w * 0.4) {
                    hit(where(u, r), away(u, me.x), 'lift', 0.6);
                }
            }
        }));
        sc.at(TB, () => {
            impactFrames(sc, W, H, 0.7, 0.45);
            for (const st of stones) {
                K.shards(st.tx, G - st.h * 0.5, s, Math.max(s, Math.round(st.w / (6 * s)) * s), STONE, 6, H * 0.8, G);
            }
            const last = stones[N - 1];
            blastDome(sc, clamp(last.tx, W * 0.08, W * 0.92), G, clamp(Math.max(H * 0.48, W * 0.22), 30, Math.min(G * 0.92, W * 0.45)), 1.8, STONE);
            ultShake(9 + 3 * P, 1100);
            for (const r of u.others()) {
                sc.at(TB + 0.1, () => hit(where(u, r), away(u, me.x), 'tumble', 0.3));
            }
        });
        emberRise(sc, TB + 0.4, sec, STONE);
    }

    // ═════ 메타그로스 — 코멧펀치 (ultdive) ═════
    // 떠오르며 몸의 X 무늬가 푸르게 빛나고 자기장 고리가 돎 → 과녁에 조준경(네모 틀 · 십자선 · 눈금)이 겹치며 잠금 "LOCK" 깜빡
    // → 하늘로 솟구쳐 사라짐 → 강철 혜성이 되어 조준한 자리로 내리꽂힘 → 임팩트 프레임 · 강철 조각 · 은빛 빛의 반구 → 제자리로 내려옴 (약 7.2초)
    const STEELC = ['#ffffff', '#dceaff', '#8ab0e0', '#3a5a9a'];
    UNIQ.metagross = { fx: 'ultdive', ms: (P) => 7200 + 200 * P, run: runMeteorMash };
    function runMeteorMash(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const lift = me.h * 0.3;
        const TLOCK = 1.1;
        const TUP = 2.2;
        const TGONE = TUP + 0.35;
        const TDIVE = TGONE + 0.4;
        const TI = TDIVE + 0.45;
        const THOME = sec - 0.6;
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * W * 0.45, W * 0.1, W * 0.9);
        const tyB = q ? q.bottom : G;
        const tH = q ? q.h : me.h;
        const footAt = (t) => {
            if (t < TUP) {
                return me.b - lift * easeOut(clamp((t - 0.2) / 0.6, 0, 1)) + Math.sin(t * 3) * s;
            }
            if (t < TGONE) {
                return lerp(me.b - lift, -me.h, easeIn((t - TUP) / (TGONE - TUP)));
            }
            if (t < THOME) {
                return -me.h * 2;
            }
            return lerp(-me.h, me.b, easeOut(clamp((t - THOME) / 0.5, 0, 1)));
        };
        const cometAt = (t) => {
            const k = easeIn(clamp((t - TDIVE) / (TI - TDIVE), 0, 1));
            return [lerp(tx - dir * W * 0.15, tx, k), lerp(-me.h, G - me.h * 0.4, k)];
        };
        const sc = scene(u, sec + 0.4, 'uniq metagross');
        ultDark(0.4, ms - 200);
        // 자기장 고리 (메타그로스 둘레)
        sc.add({ max: TUP + 0.2, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - 0.3) / 0.4, 0, 1);
            const cy = footAt(life) - me.h * 0.5;
            for (let j = 0; j < 3; j++) {
                K.ringDots(ctx, px, s, me.x, cy, me.w * (0.7 + j * 0.2) * (1 + 0.05 * Math.sin(life * 6 + j)), 0.3 + j * 0.15, [STEELC[1], STEELC[2]], 0.7 * k, 1);
            }
        } });
        puppet(sc, pokemon, u, footAt, STEELC[2], THOME + 0.55, { glow: (t) => clamp((t - 0.3) / 0.6, 0, 1) * (t < TUP ? 0.18 * (1 + Math.sin(t * 9)) : 0), glowColor: STEELC[1] });
        // 조준경 — 과녁 둘레 네모 틀 · 십자선 · 눈금, 잠기면 붉게 깜빡
        sc.add({ max: TI, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TLOCK - 0.4) {
                return;
            }
            const k = easeOut(clamp((life - (TLOCK - 0.4)) / 0.4, 0, 1));
            const locked = life > TLOCK;
            const blink = locked && Math.floor(life * 8) % 2 === 0;
            const col = locked ? (blink ? '#ff4a4a' : '#ffffff') : STEELC[1];
            const cy = tyB - tH * 0.5;
            const half = Math.max(tH, me.w) * (1.6 - 0.8 * k);
            const L = half * 0.4;
            ctx.globalAlpha = 0.95;
            ctx.fillStyle = col;
            for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
                ctx.fillRect(px(tx + sx * half - (sx > 0 ? s : 0)), px(cy + sy * half - (sy > 0 ? s : 0)), px(-sx * L) || s, s);
                ctx.fillRect(px(tx + sx * half - (sx > 0 ? s : 0)), px(cy + sy * half - (sy > 0 ? s : 0)), s, px(-sy * L) || s);
            }
            for (let d = half * 0.3; d < half * 1.2; d += s * 2) {
                ctx.fillRect(px(tx + d), px(cy), s, s);
                ctx.fillRect(px(tx - d), px(cy), s, s);
                ctx.fillRect(px(tx), px(cy + d), s, s);
                ctx.fillRect(px(tx), px(cy - d), s, s);
            }
            if (locked) {
                // LOCK 글자 대신 네 칸 점 막대
                for (let i = 0; i < 4; i++) {
                    ctx.fillRect(px(tx - half + i * s * 3), px(cy - half - s * 4), s * 2, s * 2);
                }
            }
        } });
        sc.at(TLOCK, () => {
            ring(sc, tx, tyB - tH * 0.5, s * 2, tH * 1.6, 1, 0.3, ['#ff4a4a', '#ffffff'], 2);
            ultShake(1.5, 120);
        });
        sc.at(TUP, () => {
            ring(sc, me.x, G - s, me.w * 0.4, me.w * 2.6, 0.25, 0.4, ['#ffffff', STEELC[2]], 2);
            ultShake(4, 300);
        });
        // 강철 혜성
        sc.add({ max: TI + 0.02, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TDIVE) {
                return;
            }
            const [x, y] = cometAt(life);
            const dx = W * 0.15 * dir;
            const dy = G - me.h * 0.4 + me.h;
            const L = Math.hypot(dx, dy) || 1;
            K.fireTail(ctx, px, s, x, y, dx / L, dy / L, Math.max(H * 0.6, me.w * 4), Math.max(me.w * 1.2, 8 * s), STEELC, life, 1);
            drawLitMon(ctx, pokemon.el, x, y + me.h * 0.5, me.w, dir < 0, STEELC[1], Math.max(1, Math.round(u.s * 0.75)), 1);
        } });
        sc.at(TI, () => {
            impactFrames(sc, W, H, 0.8, 0.5);
            blastDome(sc, tx, G, clamp(Math.max(H * 0.5, me.w * 3), 30, Math.min(G * 0.92, W * 0.48)), 1.9, STEELC);
            K.shards(tx, G - me.h * 0.4, s, Math.max(s, Math.round(me.w / (10 * s)) * s), STEELC, 14, H * 0.9, G);
            ring(sc, tx, G - s, me.w, W * 0.8, 0.22, 0.8, ['#ffffff', STEELC[1], STEELC[2]], 3);
            groundArcs(sc, tx, G - s, W * 0.5, 1.0, STEELC[1], 5, 2, G - s);
            ultShake(10 + 3 * P, 1300);
            for (const r of u.others()) {
                sc.at(TI + 0.1, () => hit(where(u, r), away(u, tx), Math.abs(r.x - tx) < W * 0.2 ? 'tumble' : 'lift', 0.3));
            }
        });
        emberRise(sc, TI + 0.4, sec, STEELC);
    }

    // ═════ 보만다 — 용성군 (ultskyfall) ═════
    // 날개가 붉게 빛나며 하늘로 솟구쳐 붉은 꼬리로 하늘에 고리를 그림 → 고리 가운데로 커다란 주황 구를 쏘아 올림
    // → 구가 터지며 용성(바위 덩이에 푸른 · 주황 불꽃)이 비스듬히 줄지어 쏟아짐(떨어진 자리마다 폭발) → 마지막 거대한 용성 · 주황빛 빛의 반구 → 내려앉음 (약 7.4초)
    const DRACO = ['#ffffff', '#ffd8a0', '#ff7a3a', '#5a3ad8'];
    UNIQ.salamence = { fx: 'ultskyfall', ms: (P) => 7400 + 200 * P, run: runDracoMeteor };
    function runDracoMeteor(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TUP = 0.6;
        const TLOOP = 1.0; // 고리
        const LOOP = 1.0;
        const TSHOT = TLOOP + LOOP + 0.1; // 주황 구
        const TBURST = TSHOT + 0.5;
        const NM = clamp(Math.round(W / 50), 7, 14);
        const TBIG = TBURST + 1.5; // 거대 용성
        const TDOWN = sec - 0.7;
        const cx0 = clamp(me.x + dir * W * 0.3, W * 0.2, W * 0.8);
        const cy0 = Math.max(H * 0.22, 30);
        const rl = Math.min(W * 0.15, H * 0.15);
        const posAt = (t) => {
            if (t < TUP) {
                return [me.x, me.b];
            }
            if (t < TLOOP) {
                const k = easeOut((t - TUP) / (TLOOP - TUP));
                return [lerp(me.x, cx0 - rl, k), lerp(me.b, cy0 + me.h * 0.5, k)];
            }
            if (t < TLOOP + LOOP) {
                const an = Math.PI + ((t - TLOOP) / LOOP) * TAU * dir;
                return [cx0 + Math.cos(an) * rl, cy0 + me.h * 0.5 + Math.sin(an) * rl * 0.6];
            }
            if (t < TDOWN) {
                return [cx0 - rl, cy0 + me.h * 0.5 + Math.sin(t * 3) * s * 2];
            }
            const k = easeOut(clamp((t - TDOWN) / 0.55, 0, 1));
            return [lerp(cx0 - rl, me.x, k), lerp(cy0 + me.h * 0.5, me.b, k)];
        };
        const meteors = [];
        for (let i = 0; i < NM; i++) {
            meteors.push({ x: W * (0.05 + 0.9 * ((i + 0.5) / NM)) + (hash(i, 721) - 0.5) * W * 0.05, t0: TBURST + i * 0.1, T: 0.55, r: Math.max(3 * s, W * (0.012 + 0.008 * hash(i, 722))) });
        }
        const q = nearest(u);
        const bigX = clamp(q ? q.x : me.x + dir * W * 0.45, W * 0.1, W * 0.9);
        const sc = scene(u, sec + 0.4, 'uniq salamence');
        ultDark(0.45, ms - 200);
        skyBand(sc, '#1e0806', Math.max(40, H * 0.4), 0.6, sec);
        // 붉은 고리 꼬리
        sc.add({ max: TBIG, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TLOOP) {
                return;
            }
            const end = Math.min(life, TLOOP + LOOP);
            const fade = 1 - clamp((life - TLOOP - LOOP) / 1.2, 0, 1);
            for (let tt = TLOOP; tt < end; tt += 0.012) {
                const [x, y] = posAt(tt);
                const age = end - tt;
                ctx.globalAlpha = 0.9 * fade * clamp(1 - age / 1.2, 0.3, 1);
                ctx.fillStyle = age < 0.15 ? '#ffffff' : DRACO[2];
                ctx.fillRect(px(x), px(y - me.h * 0.5), s * 2, s * 2);
            }
        } });
        // 보만다 (꼭두각시)
        const img = pokemon.el;
        const edge = Math.max(1, Math.round(u.s * 0.75));
        hideMon(pokemon, true);
        hideUntil(pokemon, (sec - 0.1) * 1000 + 100);
        sc.at(sec - 0.12, () => hideMon(pokemon, false));
        sc.add({ max: sec - 0.1, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life >= sec - 0.12) {
                return;
            }
            const [x, b] = posAt(life);
            const [x2] = posAt(life + 0.02);
            const lf = Math.abs(x2 - x) > 0.5 ? x2 < x : dir < 0;
            drawLitMon(ctx, img, x, b, me.w, lf, DRACO[2], edge, 1);
            const glow = clamp((life - 0.2) / 0.4, 0, 1) * (life < TBURST ? 0.15 * (1 + Math.sin(life * 12)) : 0);
            if (glow > 0.01) {
                drawMon(ctx, img, x, b, me.w, lf, glow, DRACO[1]);
            }
        } });
        sc.at(TUP, () => {
            ring(sc, me.x, G - s, me.w * 0.4, me.w * 2.6, 0.25, 0.4, ['#ffffff', DRACO[2]], 2);
            ultShake(3, 250);
        });
        // 주황 구 — 고리 가운데로 쏘아 올림
        sc.add({ max: TBURST + 0.05, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TSHOT) {
                return;
            }
            const [x0, y0] = posAt(TSHOT);
            const k = easeOut((life - TSHOT) / (TBURST - TSHOT));
            fireOrb(ctx, px, s, lerp(x0, cx0, k), lerp(y0 - me.h * 0.5, cy0 * 0.6, k), Math.max(5 * s, me.w * 0.4), DRACO, life, 1, G, 1, 0, [1, 0.8, 0.6, 0.38], 0.5);
        } });
        sc.at(TBURST, () => {
            impactFrames(sc, W, H, 0.5, 0.3);
            ring(sc, cx0, cy0 * 0.6, me.w * 0.3, W * 0.5, 1, 0.5, ['#ffffff', DRACO[1], DRACO[2]], 2);
            ultShake(4, 300);
        });
        // 용성 — 비스듬히 줄지어
        const fall = (m, big) => {
            const sx = m.x - dir * W * 0.25;
            sc.add({ max: sec, draw: (ctx, it, t, px) => {
                const life = sc.t;
                const k = (life - m.t0) / m.T;
                if (k < 0 || k > 1) {
                    return;
                }
                const x = lerp(sx, m.x, k);
                const y = lerp(cy0 * 0.6, G - m.r, easeIn(k));
                const dx = m.x - sx;
                const dy = G - cy0 * 0.6;
                const L = Math.hypot(dx, dy) || 1;
                K.fireTail(ctx, px, s, x, y, dx / L, dy / L, m.r * 7, m.r * 2.6, DRACO, life + m.x, 1);
                ctx.globalAlpha = 1;
                ctx.fillStyle = '#5a4a40';
                ctx.fillRect(px(x - m.r * 0.6), px(y - m.r * 0.6), px(m.r * 1.2), px(m.r * 1.2));
                ctx.fillStyle = '#8a7a6a';
                ctx.fillRect(px(x - m.r * 0.6), px(y - m.r * 0.6), px(m.r * 0.6), px(m.r * 0.4));
            } });
            sc.at(m.t0 + m.T, () => {
                if (big) {
                    impactFrames(sc, W, H, 0.8, 0.5);
                    blastDome(sc, m.x, G, clamp(Math.max(H * 0.5, W * 0.24), 30, Math.min(G * 0.92, W * 0.48)), 1.9, DRACO);
                    ultShake(10 + 3 * P, 1300);
                    for (const r of u.others()) {
                        sc.at(m.t0 + m.T + 0.1, () => hit(where(u, r), away(u, m.x), 'lift', 0.3));
                    }
                    return;
                }
                sc.add({ max: 0.5, draw: (ctx, q2, tt, px) => {
                    fireOrb(ctx, px, s, m.x, G, m.r * 3, DRACO, q2.life + m.x, easeOut(Math.min(1, tt / 0.3)), G + s, tt > 0.7 ? (1 - tt) / 0.3 : 1, clamp((tt - 0.3) / 0.6, 0, 1));
                } });
                debris(m.x, G - s, s, ['#5a4a40', '#8a7a6a', DRACO[2]], 8, H * 0.5, { ground: G });
                ultShake(2.5, 120);
                for (const r of u.others()) {
                    if (Math.abs(r.x - m.x) < m.r * 4 + r.w * 0.4) {
                        hit(where(u, r), away(u, m.x), 'tumble', 0.8);
                    }
                }
            });
        };
        meteors.forEach((m) => fall(m, false));
        fall({ x: bigX, t0: TBIG - 0.6, T: 0.6, r: Math.max(8 * s, W * 0.04) }, true);
        emberRise(sc, TBIG + 0.4, sec, DRACO);
    }

    // ═════ 가디안 — 문포스 (ultsparkle) ═════
    // 밤하늘에 커다란 보름달이 떠오르고 분홍 꽃잎 · 반짝이가 흩날림 → 가디안이 두 손을 모아 달빛을 받아 둥실(분홍 오라)
    // → 달이 한 번 크게 빛나며 달빛 줄기가 가디안 손으로 → 손 앞에 분홍 빛 구가 커짐 → 과녁으로 쏘아 보냄 → 분홍 빛의 반구 · 하트 모양 반짝이 (약 7.2초)
    const MOON = ['#ffffff', '#ffe6f6', '#ff9ad8', '#b04aa8'];
    UNIQ.gardevoir = { fx: 'ultsparkle', ms: (P) => 7200 + 200 * P, run: runMoonblast };
    function runMoonblast(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const lift = me.h * 0.25;
        const TMOON = 0.3;
        const TBEAM = 1.6; // 달빛 줄기
        const TFIRE = 2.8; // 쏨
        const FLY = 0.5;
        const TB = TFIRE + FLY;
        const mx = clamp(W * 0.5 + dir * W * 0.12, W * 0.2, W * 0.8);
        const my = Math.max(26, H * 0.2);
        const Rm = clamp(Math.min(W, H) * 0.12, 14, 70);
        const footAt = (t) => me.b - lift * easeOut(clamp((t - 0.4) / 0.6, 0, 1)) * (1 - easeIn(clamp((t - (sec - 0.6)) / 0.45, 0, 1))) + Math.sin(t * 2.5) * s * 1.5;
        const hand = (t) => [me.x + dir * me.w * 0.35, footAt(t) - me.h * 0.55];
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * W * 0.45, W * 0.1, W * 0.9);
        const sc = scene(u, sec + 0.4, 'uniq gardevoir');
        ultDark(0.5, ms - 200);
        // 보름달 — 떠오름 · 크게 빛남
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = easeOut(clamp((life - TMOON) / 0.8, 0, 1)) * clamp((sec - 0.3 - life) / 0.6, 0, 1);
            if (k <= 0.01) {
                return;
            }
            const y = lerp(my + H * 0.15, my, k);
            const glow = life > TBEAM - 0.2 && life < TBEAM + 0.6 ? 1 + 0.4 * Math.sin(clamp((life - TBEAM + 0.2) / 0.8, 0, 1) * Math.PI) : 1;
            ellipse(ctx, px, s, mx, y, Rm * 1.7 * glow, Rm * 1.7 * glow, MOON[2], 0.12 * k);
            ellipse(ctx, px, s, mx, y, Rm * 1.3 * glow, Rm * 1.3 * glow, MOON[1], 0.2 * k);
            fireOrb(ctx, px, s, mx, y, Rm, ['#ffffff', '#fff6fb', '#ffd6ee', '#ff9ad8'], life, k, Infinity, k, 0, [1, 0.85, 0.65, 0.4], 0.1);
        } });
        // 꽃잎 · 반짝이
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp((life - 0.4) / 0.5, 0, 1) * clamp((sec - 0.3 - life) / 0.5, 0, 1);
            const z = Math.max(s, Math.round(short(u) / 120));
            for (let j = 0; j < 22; j++) {
                const y = ((hash(j, 731) * G + life * G * (0.1 + 0.08 * hash(j, 732))) % G);
                const x = hash(j, 733) * W + Math.sin(life * 1.8 + j) * W * 0.03;
                ctx.globalAlpha = 0.85 * a;
                if (j % 3) {
                    ctx.fillStyle = MOON[2];
                    const flip = Math.sin(life * 5 + j) > 0;
                    ctx.fillRect(px(x), px(y), flip ? z * 2 : z, flip ? z : z * 2);
                } else if (Math.sin(life * 6 + j) > 0.2) {
                    glint(ctx, px, s, x, y, z * 2, 0.8 * a);
                }
            }
        } });
        // 분홍 오라 (가디안 뒤)
        sc.add({ max: TB, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - 0.5) / 0.5, 0, 1) * (1 - clamp((life - TFIRE) / 0.4, 0, 1));
            if (k > 0.02) {
                K.flameTongue(ctx, px, s, me.x, footAt(life) + s * 2, me.w * 1.15, me.h * 1.4, MOON, life, k);
            }
        } });
        puppet(sc, pokemon, u, footAt, MOON[2], sec - 0.1, { glow: (t) => (t > TBEAM && t < TBEAM + 0.15 ? 0.6 : clamp((t - 0.5) / 0.8, 0, 1) * (t < TFIRE ? 0.12 * (1 + Math.sin(t * 9)) : 0)), glowColor: '#ffffff' });
        // 달빛 줄기 — 달에서 손으로
        sc.add({ max: TFIRE + 0.1, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TBEAM) {
                return;
            }
            const [hx, hy] = hand(life);
            const dx = hx - mx;
            const dy = hy - my;
            const L = Math.hypot(dx, dy) || 1;
            const k = clamp((life - TBEAM) / 0.3, 0, 1);
            const fade = 1 - clamp((life - TFIRE + 0.2) / 0.2, 0, 1);
            beamBody(ctx, px, s, mx, my, dx / L, dy / L, L * k, Math.max(3 * s, Rm * 0.35), ['#ffffff', '#fff6fb', MOON[1], MOON[2]], life, 0.7 * fade);
        } });
        sc.at(TBEAM, () => {
            ring(sc, mx, my, Rm, Rm * 3, 1, 0.5, ['#ffffff', MOON[1]], 2);
            ultShake(2, 200);
        });
        // 손 앞 분홍 빛 구 → 날아감
        const Rb = clamp(me.w * 0.4, 4 * s, H * 0.1);
        sc.add({ max: TB + 0.02, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TBEAM + 0.2) {
                return;
            }
            const [hx, hy] = hand(Math.min(life, TFIRE));
            let x = hx;
            let y = hy;
            if (life > TFIRE) {
                const k = (life - TFIRE) / FLY;
                x = lerp(hx, tx, k);
                y = lerp(hy, G - Rb, k * k) - Math.sin(k * Math.PI) * H * 0.08;
            }
            const k0 = easeOut((life - TBEAM - 0.2) / (TFIRE - TBEAM - 0.2));
            fireOrb(ctx, px, s, x, y, Rb, MOON, life, life > TFIRE ? 1 : k0 * (1 + 0.1 * Math.sin(life * 18)), G, 1, 0, [1, 0.8, 0.6, 0.38], 0.3);
            glint(ctx, px, s, x, y, Rb * 1.5, 0.8);
        } });
        sc.at(TFIRE, () => {
            impactFrames(sc, W, H, 0.5, 0.3);
            ultShake(3, 200);
        });
        sc.at(TB, () => {
            impactFrames(sc, W, H, 0.7, 0.4);
            blastDome(sc, tx, G, clamp(Math.max(H * 0.48, W * 0.22), 30, Math.min(G * 0.92, W * 0.48)), 1.9, MOON);
            ring(sc, tx, G - s, Rb, W * 0.7, 0.25, 0.8, ['#ffffff', MOON[1], MOON[2]], 3);
            ultShake(8 + 2 * P, 1000);
            for (const r of u.others()) {
                sc.at(TB + 0.1, () => hit(where(u, r), away(u, tx), Math.abs(r.x - tx) < W * 0.2 ? 'spin' : 'lift', 0.3));
            }
        });
        emberRise(sc, TB + 0.4, sec, MOON);
    }

    // ═════ 후딘 — 사이코키네시스 (ultpsy) ═════
    // 두 숟가락이 번쩍 · 이마에서 보랏빛 고리가 연달아 퍼짐 → 화면이 일렁이고 다른 포켓몬 · 돌덩이가 떠올라 공중에서 빙글빙글
    // → 숟가락 끝에서 보랏빛 번개가 이어져 그들을 붙잡음 → 숟가락을 교차하자 한꺼번에 서로 부딪혀 한가운데로 모였다 → 땅으로 내던짐 → 보랏빛 빛의 반구 (약 7.2초)
    const ALAK = ['#ffffff', '#ffd6f8', '#e070d8', '#7a2a9a'];
    UNIQ.alakazam = { fx: 'ultpsy', ms: (P) => 7200 + 200 * P, run: runAlakazamPsy };
    function runAlakazamPsy(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TSPOON = 0.3;
        const TLIFT = 0.9; // 떠오름
        const TGRAB = 1.7; // 번개 사슬
        const TPULL = 2.9; // 한가운데로
        const TSLAM = 3.6; // 내던짐
        const cx = clamp(me.x + dir * W * 0.4, W * 0.15, W * 0.85);
        const cy = clamp(H * 0.35, H * 0.2, G - me.h);
        const victims = u.others().slice(0, 6);
        const rocks = [];
        for (let i = 0; i < 8; i++) {
            rocks.push({ x0: clamp(me.x + dir * W * (0.15 + 0.7 * hash(i, 741)), s * 4, W - s * 4), h: G * (0.25 + 0.3 * hash(i, 742)), z: Math.max(3 * s, me.w * (0.12 + 0.12 * hash(i, 743))), ph: hash(i, 744) * TAU });
        }
        const rockAt = (r, t) => {
            const up = easeOut(clamp((t - TLIFT) / 0.6, 0, 1));
            let x = r.x0 + Math.sin(t * 1.4 + r.ph) * s * 4;
            let y = G - r.z * 0.3 - r.h * up + Math.sin(t * 2.2 + r.ph) * s * 3;
            if (t > TPULL) {
                const k = easeIn(clamp((t - TPULL) / (TSLAM - TPULL), 0, 1));
                x = lerp(x, cx + Math.cos(r.ph) * r.z, k);
                y = lerp(y, cy + Math.sin(r.ph) * r.z, k);
            }
            if (t > TSLAM) {
                const k = easeIn(clamp((t - TSLAM) / 0.25, 0, 1));
                y = lerp(cy, G - r.z * 0.3, k);
            }
            return [x, y];
        };
        const spoons = (t) => [[me.x - me.w * 0.42, footAt(t) - me.h * 0.55], [me.x + me.w * 0.42, footAt(t) - me.h * 0.55]];
        const footAt = (t) => me.b - Math.sin(t * 2.4) * s * 1.5;
        const sc = scene(u, sec + 0.4, 'uniq alakazam');
        ultDark(0.45, ms - 200);
        // 일렁이는 화면 — 보랏빛 가로 물결
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp((life - TLIFT) / 0.5, 0, 1) * clamp((sec - 0.4 - life) / 0.5, 0, 1);
            if (a <= 0.01) {
                return;
            }
            ctx.globalAlpha = 0.14 * a;
            ctx.fillStyle = ALAK[3];
            ctx.fillRect(0, 0, W, H);
            ctx.globalAlpha = 0.25 * a;
            ctx.fillStyle = ALAK[2];
            for (let y = s * 3; y < G; y += s * 6) {
                const off = Math.sin(y * 0.05 + life * 4) * W * 0.03;
                ctx.fillRect(px(off), px(y), W, s);
            }
        } });
        puppet(sc, pokemon, u, footAt, ALAK[2], sec - 0.1, { glow: (t) => (t > TSPOON && t < TSPOON + 0.15 ? 0.6 : clamp((t - TLIFT) / 0.6, 0, 1) * (t < TSLAM ? 0.15 * (1 + Math.sin(t * 10)) : 0)), glowColor: ALAK[1] });
        // 숟가락 번쩍 · 이마 고리
        sc.add({ max: TSLAM + 0.3, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp((life - TSPOON) / 0.2, 0, 1) * (0.7 + 0.3 * Math.sin(life * 12));
            for (const [x, y] of spoons(life)) {
                glint(ctx, px, s, x, y, me.w * 0.22 * a, a);
            }
        } });
        let ripple = 0;
        sc.tick((t, dt) => {
            if (t < TSPOON || t > TSLAM) {
                return;
            }
            ripple += dt;
            if (ripple > 0.4) {
                ripple = 0;
                ring(sc, me.x, footAt(t) - me.h * 0.8, me.w * 0.3, me.w * 3, 0.85, 0.6, [ALAK[1], ALAK[2]], 1);
            }
        });
        // 돌덩이
        sc.add({ max: TSLAM + 0.3, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TLIFT) {
                return;
            }
            for (const r of rocks) {
                const [x, y] = rockAt(r, life);
                K.psyRock(ctx, px, s, x, y, r.z, 0.6 + 0.3 * Math.sin(life * 7 + r.ph), ALAK[2]);
            }
        } });
        // 다른 포켓몬 — 떠올라 빙글 (ultHit lift), 번개 사슬
        victims.forEach((r, i) => sc.at(TLIFT + i * 0.08, () => hit(where(u, r), away(u, me.x), 'spin', 2)));
        sc.add({ max: TSLAM, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TGRAB) {
                return;
            }
            const [[lx, ly], [rx, ry]] = spoons(life);
            const targets = [...victims.map((r) => { const w = where(u, r); return [w.x, w.y]; }), ...rocks.slice(0, 4).map((r) => rockAt(r, life))];
            targets.forEach(([x, y], i) => {
                const [sx, sy] = i % 2 ? [rx, ry] : [lx, ly];
                if (Math.floor(life * 15 + i) % 4 !== 0) {
                    drawBolt(ctx, px, s, jag(sx, sy, x, y, Math.max(3 * s, Math.hypot(x - sx, y - sy) / 8), 0.18), 1, ALAK[2], ALAK[3], 0.8);
                }
            });
        } });
        sc.at(TPULL, () => {
            ring(sc, cx, cy, W * 0.5, me.w * 0.5, 0.9, 0.6, [ALAK[1], ALAK[2]], 2);
            ultShake(4, 700);
        });
        // 내던짐 — 반구
        sc.at(TSLAM + 0.25, () => {
            impactFrames(sc, W, H, 0.7, 0.45);
            blastDome(sc, cx, G, clamp(Math.max(H * 0.5, W * 0.24), 30, Math.min(G * 0.92, W * 0.48)), 1.9, ALAK);
            ring(sc, cx, G - s, me.w, W * 0.8, 0.22, 0.8, ['#ffffff', ALAK[1], ALAK[2]], 3);
            groundArcs(sc, cx, G - s, W * 0.5, 1.0, ALAK[1], 5, 1, G - s);
            ultShake(9 + 3 * P, 1100);
            for (const r of victims) {
                hit(where(u, r), away(u, cx), 'tumble', 0);
            }
        });
        emberRise(sc, TSLAM + 0.6, sec, ALAK);
    }

    // ═════ 괴력몬 — 다이너마이트펀치 (ultbarrage) ═════
    // 네 팔에 불꽃이 활활 · 근육이 부풀며 두 번 쿵쿵 → 가장 가까운 애에게 달려가 네 주먹으로 불꽃 연타(주먹마다 작은 폭발 · 숫자가 올라감)
    // → 마지막에 네 팔을 모아 한 방 — 거대한 다이너마이트 폭발(불꽃 구 · 불꽃 줄기 · 파편) · 주황빛 빛의 반구 → 제자리로 (약 7.2초)
    const DYNA = ['#ffffff', '#fff3a0', '#ff9a2a', '#c8301a'];
    UNIQ.machamp = { fx: 'ultbarrage', ms: (P) => 7200 + 200 * P, run: runDynamicPunch };
    function runDynamicPunch(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const stomps = [0.7, 1.15];
        const TGO = 1.6; // 달려감
        const TRUN = 0.35;
        const THIT0 = TGO + TRUN;
        const NP = 16;
        const TFIN = THIT0 + 1.6; // 마지막 한 방
        const TBACK = TFIN + 1.6;
        const q = nearest(u);
        const tq = q ? q.x : me.x + dir * W * 0.4;
        const side = Math.sign(tq - me.x) || dir;
        const ax = clamp(tq - side * (me.w * 0.7 + (q ? q.w * 0.3 : 0)), me.w * 0.5, W - me.w * 0.5);
        const xAt = (t) => (t < TGO ? me.x : t < THIT0 ? lerp(me.x, ax, easeIn((t - TGO) / TRUN)) : t < TBACK ? ax + (t < TFIN ? Math.sin(t * 40) * s : 0) : lerp(ax, me.x, easeOut(clamp((t - TBACK) / 0.45, 0, 1))));
        const footAt = (t) => (t > TBACK ? me.b - Math.sin(clamp((t - TBACK) / 0.45, 0, 1) * Math.PI) * me.h * 0.3 : me.b);
        const hitX = () => (q ? where(u, q).x : ax + side * me.w * 0.7);
        const hitY = () => (q ? where(u, q).y : me.b - me.h * 0.5);
        let count = 0;
        const sc = scene(u, sec + 0.4, 'uniq machamp');
        ultDark(0.4, ms - 200);
        // 팔 불꽃 (괴력몬 뒤)
        sc.add({ max: TBACK, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - 0.3) / 0.4, 0, 1) * (1 - clamp((life - TFIN - 0.5) / 0.4, 0, 1));
            if (k > 0.02) {
                K.flameTongue(ctx, px, s, xAt(life), footAt(life) + s * 2, me.w * 1.3, me.h * 1.35, DYNA, life, k);
            }
        } });
        puppet(sc, pokemon, u, footAt, DYNA[2], sec - 0.1, { x: xAt, glow: (t) => (stomps.some((ts) => t > ts && t < ts + 0.1) || (t > TFIN - 0.05 && t < TFIN + 0.1) ? 0.6 : 0), glowColor: DYNA[1] });
        stomps.forEach((ts, i) => sc.at(ts, () => {
            ring(sc, me.x, G - s, me.w * 0.5, me.w * (2.5 + i), 0.22, 0.45, ['#ffffff', DYNA[2]], 2);
            debris(me.x, G - s, s, ['#8a7252', '#5c4a33', DYNA[2]], 12, H * 0.5, { ground: G });
            ultShake(4 + i * 2, 300);
        }));
        // 불꽃 연타 — 점점 빨라짐
        for (let i = 0; i < NP; i++) {
            const tp = THIT0 + 1.5 * (1 - (1 - i / NP) ** 1.6);
            sc.at(tp, () => {
                const x = hitX() + rnd(-0.4, 0.4) * me.w * 0.5;
                const y = hitY() + rnd(-0.5, 0.5) * me.h * 0.5;
                sc.add({ max: 0.3, draw: (ctx, q2, tt, px) => {
                    fireOrb(ctx, px, s, x, y, Math.max(3 * s, me.w * 0.25), DYNA, q2.life + i, easeOut(Math.min(1, tt / 0.2)), G, 1 - tt, clamp((tt - 0.2) / 0.6, 0, 1));
                } });
                ring(sc, x, y, s * 2, me.w * 0.7, 0.9, 0.2, ['#ffffff', DYNA[1]], 1);
                ultShake(2, 80);
                count += 1;
                if (q && i % 4 === 0) {
                    hit(where(u, q), side, 'shake', 0);
                }
            });
        }
        // 숫자 — 연타 수
        sc.add({ max: TFIN + 0.8, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < THIT0 || count === 0) {
                return;
            }
            const z = Math.max(s, Math.round((me.w * 0.07) / s) * s);
            const str = String(count);
            const DIG = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];
            const x0 = hitX() - (str.length * 4 * z) / 2;
            const y0 = hitY() - me.h * 0.9 - z * 6;
            ctx.globalAlpha = 1;
            [...str].forEach((ch, ci) => {
                const g = DIG[+ch];
                for (let k = 0; k < 15; k++) {
                    if (g[k] === '1') {
                        const gx = x0 + ci * 4 * z + (k % 3) * z;
                        const gy = y0 + Math.floor(k / 3) * z;
                        ctx.fillStyle = '#3a1004';
                        ctx.fillRect(px(gx + s), px(gy + s), z, z);
                        ctx.fillStyle = DYNA[1];
                        ctx.fillRect(px(gx), px(gy), z, z);
                    }
                }
            });
        } });
        // 마지막 한 방 — 다이너마이트 폭발 · 반구
        sc.at(TFIN, () => {
            impactFrames(sc, W, H, 0.8, 0.5);
            const x = hitX();
            K.firePillar(sc, x, G, clamp(me.w * 0.9, 8 * s, W * 0.18), 1.3, DYNA);
            blastDome(sc, x, G, clamp(Math.max(H * 0.5, me.w * 3), 30, Math.min(G * 0.92, W * 0.48)), 1.9, DYNA);
            ultShake(10 + 3 * P, 1300);
            for (const r of u.others()) {
                sc.at(TFIN + 0.08, () => hit(where(u, r), away(u, x), Math.abs(r.x - x) < W * 0.2 ? 'tumble' : 'lift', 0.3));
            }
        });
        emberRise(sc, TFIN + 0.4, sec, DYNA);
    }

    // ═════ 윈디 — 신속 (ultrush) ═════
    // 갈기에 불꽃이 일며 바람이 붐 → 눈 깜짝할 새 사라짐 — 화면 곳곳에 하얀 섬광 줄 · 잔상이 번쩍번쩍(다른 포켓몬마다 차례로 튕겨 나감)
    // → 화면을 가로지르는 마지막 일직선 질주(하얀 · 주황 꼬리) → 늦게 따라오는 충격파 · 빛의 반구 → 갈기를 휘날리며 제자리 (약 7.0초)
    const SPEED = ['#ffffff', '#fff4d0', '#ffb04a', '#d8602a'];
    UNIQ.arcanine = { fx: 'ultrush', ms: (P) => 7000 + 200 * P, run: runExtremeSpeed };
    function runExtremeSpeed(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TGONE = 1.3;
        const targets = u.others();
        const NF = Math.max(5, targets.length + 3);
        const flashes = [];
        for (let i = 0; i < NF; i++) {
            const r = targets[i % Math.max(1, targets.length)];
            const x = r && i < targets.length ? r.x : W * (0.1 + 0.8 * hash(i, 751));
            flashes.push({ x, t: TGONE + 0.1 + i * 0.16, r: i < targets.length ? r : null, a: (hash(i, 752) - 0.5) * 0.6 });
        }
        const TDASH = TGONE + 0.1 + NF * 0.16 + 0.2; // 마지막 일직선
        const DASH = 0.25;
        const TB = TDASH + DASH + 0.25; // 늦게 오는 충격파
        const x0 = dir > 0 ? -me.w : W + me.w;
        const x1 = dir > 0 ? W + me.w : -me.w;
        const sc = scene(u, sec + 0.4, 'uniq arcanine');
        ultDark(0.4, ms - 200);
        // 갈기 불꽃 · 바람 (윈디 뒤)
        sc.add({ max: TGONE + 0.2, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - 0.2) / 0.4, 0, 1) * (1 - clamp((life - TGONE + 0.1) / 0.2, 0, 1));
            if (k > 0.02) {
                K.flameTongue(ctx, px, s, me.x, me.b + s * 2, me.w * 1.2, me.h * 1.4, SPEED, life, k, -dir * 0.6);
            }
            ctx.globalAlpha = 0.6 * k;
            ctx.fillStyle = '#ffffff';
            for (let j = 0; j < 8; j++) {
                const y = me.b - me.h * (0.1 + 0.9 * hash(j, 761));
                const len = me.w * (0.6 + 0.8 * hash(j, 762));
                const xx = me.x - dir * (me.w * 0.6 + ((life * 4 + j / 8) % 1) * me.w * 1.5);
                ctx.fillRect(px(xx - (dir > 0 ? len : 0)), px(y), px(len), s);
            }
        } });
        // 윈디 (꼭두각시) — 사라짐 · 마지막 질주 · 돌아옴
        const img = pokemon.el;
        const edge = Math.max(1, Math.round(u.s * 0.75));
        hideMon(pokemon, true);
        hideUntil(pokemon, (sec - 0.1) * 1000 + 100);
        sc.at(sec - 0.12, () => hideMon(pokemon, false));
        sc.add({ max: sec - 0.1, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life >= sec - 0.12) {
                return;
            }
            let x = me.x;
            let a = 1;
            if (life > TGONE - 0.1 && life < TGONE) {
                a = 1 - (life - (TGONE - 0.1)) / 0.1;
            } else if (life >= TGONE && life < TDASH) {
                return;
            } else if (life >= TDASH && life < TDASH + DASH) {
                x = lerp(x0, x1, (life - TDASH) / DASH);
            } else if (life >= TDASH + DASH && life < sec - 0.6) {
                return;
            } else if (life >= sec - 0.6) {
                const k = easeOut(clamp((life - (sec - 0.6)) / 0.35, 0, 1));
                x = lerp(x0, me.x, k);
            }
            drawLitMon(ctx, img, x, me.b, me.w, dir < 0, SPEED[2], edge, a);
        } });
        sc.at(TGONE - 0.1, () => {
            ring(sc, me.x, me.b - me.h * 0.5, me.w * 0.3, me.w * 2.2, 0.85, 0.3, ['#ffffff', SPEED[2]], 2);
            debris(me.x, G - s, s, ['#8a7252', '#5c4a33'], 10, H * 0.4, { ground: G });
            ultShake(3, 200);
        });
        // 섬광 줄 · 잔상
        flashes.forEach((f) => {
            sc.add({ max: sec, draw: (ctx, it, t, px) => {
                const life = sc.t;
                const k = (life - f.t) / 0.25;
                if (k < 0 || k > 1) {
                    return;
                }
                const len = W * 0.35 * (1 - k * 0.5);
                const y = G - me.h * (0.4 + 0.3 * hash(f.x, 771));
                const ca = Math.cos(f.a);
                const sa = Math.sin(f.a);
                ctx.globalAlpha = 1 - k;
                for (let d = -len / 2; d < len / 2; d += s) {
                    const w = Math.max(s, Math.round(((1 - Math.abs(d) / (len / 2)) * me.h * 0.12) / s) * s);
                    ctx.fillStyle = Math.abs(d) < len * 0.15 ? '#ffffff' : SPEED[2];
                    ctx.fillRect(px(f.x + d * ca), px(y + d * sa - w / 2), s, w);
                }
                drawMon(ctx, img, f.x, me.b, me.w, f.a > 0, 0.5 * (1 - k), SPEED[1]);
            } });
            sc.at(f.t, () => {
                ultShake(2.5, 100);
                if (f.r) {
                    hit(where(u, f.r), Math.sign(f.r.x - me.x) || dir, 'spin', 0.5);
                    ring(sc, f.x, f.r.y, s * 2, f.r.w * 1.5, 0.9, 0.3, ['#ffffff', SPEED[2]], 2);
                }
            });
        });
        // 마지막 일직선 질주 꼬리 · 늦게 오는 충격파
        sc.add({ max: TB + 0.4, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TDASH) {
                return;
            }
            const k = clamp((life - TDASH) / DASH, 0, 1);
            const fade = life > TDASH + DASH ? 1 - (life - TDASH - DASH) / 0.6 : 1;
            const xx = lerp(x0, x1, k);
            const y = me.b - me.h * 0.5;
            ctx.globalAlpha = 0.9 * fade;
            for (const [m, c] of [[1, SPEED[3]], [0.7, SPEED[2]], [0.4, SPEED[1]], [0.18, '#ffffff']]) {
                ctx.fillStyle = c;
                const hh = me.h * 0.5 * m;
                ctx.fillRect(Math.min(x0, xx), px(y - hh), Math.abs(xx - x0), Math.max(s, px(2 * hh)));
            }
        } });
        sc.at(TB, () => {
            impactFrames(sc, W, H, 0.7, 0.45);
            blastDome(sc, W / 2, G, clamp(Math.max(H * 0.45, W * 0.24), 30, Math.min(G * 0.92, W * 0.5)), 1.8, SPEED);
            ring(sc, W / 2, me.b - me.h * 0.5, me.w, W * 0.9, 0.5, 0.7, ['#ffffff', SPEED[1], SPEED[2]], 3);
            ultShake(9 + 3 * P, 1100);
            for (const r of targets) {
                hit(where(u, r), dir, 'tumble', 0);
            }
        });
        emberRise(sc, TB + 0.3, sec, SPEED);
    }

    // ═════ 블래키 — 블랙홀이클립스 (ultblackhole) ═════
    // 칠흑 같은 밤 · 블래키의 노란 고리 무늬가 빛남 → 하늘에 달이 떠오르고 검은 원이 미끄러져 와 개기일식(빛 고리 · 빛살)
    // → 일식 자리에서 블랙홀이 열려 내려오며 빛 부스러기 · 다른 포켓몬을 빨아들임 → 땅에 닿아 무너지며 어둠의 빛의 반구 (약 7.2초)
    const ECLIPSE = ['#fff6c0', '#ffd84d', '#6a50c8', '#0a0418'];
    UNIQ.umbreon = { fx: 'ultblackhole', ms: (P) => 7200 + 200 * P, run: runEclipse };
    function runEclipse(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TMOON = 0.4;
        const TEC = 1.3; // 일식 시작
        const TFULL = 2.1; // 개기일식
        const TDROP = 2.6; // 블랙홀 내려옴
        const TB = 4.0; // 땅에 닿음
        const mx = clamp(me.x + dir * W * 0.35, W * 0.2, W * 0.8);
        const my = Math.max(28, H * 0.2);
        const Rm = clamp(Math.min(W, H) * 0.1, 12, 60);
        const holeAt = (t) => {
            const k = easeIn(clamp((t - TDROP) / (TB - TDROP), 0, 1));
            return [mx, lerp(my, G - Rm * 1.2, k), Rm * (1 + 0.8 * k)];
        };
        const sc = scene(u, sec + 0.4, 'uniq umbreon');
        ultDark(0.75, ms - 200);
        // 달 · 일식
        sc.add({ max: TB + 0.1, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = easeOut(clamp((life - TMOON) / 0.6, 0, 1));
            if (k <= 0.01) {
                return;
            }
            if (life < TDROP) {
                fireOrb(ctx, px, s, mx, my, Rm, ['#ffffff', '#fffbe6', '#ffe8a3', '#f0c96a'], life, k, Infinity, k, 0, [1, 0.85, 0.65, 0.4], 0.05);
                const e = easeOut(clamp((life - TEC) / (TFULL - TEC), 0, 1));
                ellipse(ctx, px, s, lerp(mx - dir * Rm * 2.4, mx, e), my, Rm * 0.98, Rm * 0.98, '#05020a', 1);
                if (life > TFULL - 0.1) {
                    const c = clamp((life - TFULL + 0.1) / 0.3, 0, 1);
                    K.ringDots(ctx, px, s, mx, my, Rm * 1.05, 1, [ECLIPSE[0], ECLIPSE[1]], c, 2);
                    ctx.globalAlpha = 0.7 * c;
                    ctx.fillStyle = ECLIPSE[0];
                    for (let j = 0; j < 16; j++) {
                        const an = (j / 16) * TAU + life * 0.3;
                        for (let d = Rm * 1.1; d < Rm * (1.5 + 0.4 * Math.sin(life * 5 + j)); d += s) {
                            ctx.fillRect(px(mx + Math.cos(an) * d), px(my + Math.sin(an) * d), s, s);
                        }
                    }
                }
            }
        } });
        sc.at(TFULL, () => {
            impactFrames(sc, W, H, 0.4, 0.6);
            ultShake(3, 400);
        });
        // 블랙홀 — 일식 자리에서 내려오며 빨아들임
        sc.add({ max: TB + 0.05, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TDROP) {
                return;
            }
            const [x, y, R] = holeAt(life);
            ellipse(ctx, px, s, x, y, R * 1.7, R * 1.7 * 0.32, ECLIPSE[2], 0.55);
            ellipse(ctx, px, s, x, y, R * 1.3, R * 1.3 * 0.32, ECLIPSE[1], 0.6);
            ellipse(ctx, px, s, x, y, R, R, '#000000', 1);
            K.ringDots(ctx, px, s, x, y, R * 1.02, 1, [ECLIPSE[0], ECLIPSE[1]], 0.9, 2);
            for (let j = 0; j < 16; j++) {
                const an = -life * 3 + (j * TAU) / 16;
                const rr = R * (1.1 + 1.8 * (1 - ((life * 1.3 + j / 16) % 1)));
                ctx.globalAlpha = 0.85;
                ctx.fillStyle = j % 2 ? ECLIPSE[0] : ECLIPSE[2];
                ctx.fillRect(px(x + Math.cos(an) * rr), px(y + Math.sin(an) * rr * 0.6), s, s);
            }
        } });
        chargeSwirl(sc, (t) => holeAt(t), TDROP + 0.1, TB - 0.05, Math.max(Rm * 5, short(u) * 0.5), Math.max(s * 4, Rm * 0.5), ['#ffffff', ECLIPSE[0], ECLIPSE[2], ECLIPSE[3]], -dir);
        for (const r of u.others()) {
            sc.at(TDROP + 0.4, () => hit(where(u, r), Math.sign(mx - r.x) || dir, 'shake', 0));
        }
        // 블래키 (꼭두각시) — 노란 고리 무늬가 빛남
        puppet(sc, pokemon, u, () => me.b, ECLIPSE[1], sec - 0.1, { glow: (t) => clamp((t - 0.2) / 0.5, 0, 1) * (0.2 + 0.15 * Math.sin(t * 6)), glowColor: ECLIPSE[1] });
        sc.at(TB, () => {
            impactFrames(sc, W, H, 0.6, 0.6);
            blastDome(sc, mx, G, clamp(Math.max(H * 0.5, Rm * 4.5), 30, Math.min(G * 0.92, W * 0.48)), 1.9, [ECLIPSE[0], ECLIPSE[1], ECLIPSE[2], ECLIPSE[3]]);
            ring(sc, mx, G - s, Rm, W * 0.8, 0.22, 0.8, ['#ffffff', ECLIPSE[1], ECLIPSE[2]], 3);
            ultShake(9 + 3 * P, 1200);
            for (const r of u.others()) {
                sc.at(TB + 0.1, () => hit(where(u, r), away(u, mx), 'tumble', 0.3));
            }
        });
        emberRise(sc, TB + 0.4, sec, ECLIPSE);
    }

    // ═════ 에브이 — 사이코키네시스 (ultpsy) ═════
    // 이마 보석이 반짝 · 꼬리 끝이 갈라지며 분홍 빛 → 에브이를 감싼 분홍 염력 거품이 부풀며 다른 포켓몬을 둥실 띄움(반짝이 · 물결)
    // → 거품이 세 번 두근하며 커짐 → 펑 터지며 임팩트 프레임 · 분홍 빛의 반구 · 보석 조각 같은 반짝이 (약 7.0초)
    const ESPC = ['#ffffff', '#ffe0fa', '#f08ae0', '#a03ab0'];
    UNIQ.espeon = { fx: 'ultpsy', ms: (P) => 7000 + 200 * P, run: runEspeonPsy };
    function runEspeonPsy(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TGEM = 0.3;
        const TBUB = 0.8;
        const beats = [2.0, 2.5, 2.9];
        const TB = 3.4;
        const cy = me.b - me.h * 0.5;
        const Rmax = clamp(Math.max(W * 0.35, H * 0.4), me.w * 2, Math.min(W * 0.6, G * 0.9));
        const bubR = (t) => {
            let r = me.w * 0.8 + (Rmax * 0.55 - me.w * 0.8) * easeOut(clamp((t - TBUB) / 1.1, 0, 1));
            beats.forEach((b, i) => {
                const d = (t - b) / 0.25;
                if (d > 0 && d < 1) {
                    r *= 1 + (0.12 + 0.05 * i) * Math.sin(d * Math.PI);
                }
                if (t > b + 0.25) {
                    r *= 1.06;
                }
            });
            return r;
        };
        const sc = scene(u, sec + 0.4, 'uniq espeon');
        ultDark(0.45, ms - 200);
        // 거품 (에브이 뒤)
        sc.add({ max: TB + 0.02, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TBUB) {
                return;
            }
            const R = bubR(life);
            const a = clamp((life - TBUB) / 0.3, 0, 1);
            ellipse(ctx, px, s, me.x, cy, R, R * 0.9, ESPC[2], 0.14 * a);
            K.ringDots(ctx, px, s, me.x, cy, R, 0.9, [ESPC[1], ESPC[2]], 0.85 * a, 2);
            K.ringDots(ctx, px, s, me.x, cy, R * 0.92, 0.9, [ESPC[3]], 0.35 * a, 1);
            for (let j = 0; j < 10; j++) {
                const an = life * 1.5 + (j * TAU) / 10;
                glint(ctx, px, s, me.x + Math.cos(an) * R * 0.7, cy + Math.sin(an) * R * 0.6, Math.max(s * 2, R * 0.05), 0.7 * a);
            }
            // 반사광 — 위 왼쪽
            ctx.globalAlpha = 0.6 * a;
            ctx.fillStyle = '#ffffff';
            for (let i = 0; i < 6; i++) {
                const an = -2.2 + i * 0.12;
                ctx.fillRect(px(me.x + Math.cos(an) * R * 0.82), px(cy + Math.sin(an) * R * 0.74), s * 2, s * 2);
            }
        } });
        puppet(sc, pokemon, u, () => me.b - Math.sin(sc.t * 2) * s, ESPC[2], sec - 0.1, { glow: (t) => clamp((t - TGEM) / 0.5, 0, 1) * (t < TB ? 0.15 * (1 + Math.sin(t * 10)) : 0), glowColor: ESPC[1] });
        sc.add({ max: TB, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp((life - TGEM) / 0.2, 0, 1) * (0.7 + 0.3 * Math.sin(life * 10));
            glint(ctx, px, s, me.x + dir * me.w * 0.18, me.b - me.h * 0.82, me.w * 0.3 * a, a);
        } });
        // 떠오르는 다른 포켓몬
        for (const r of u.others()) {
            sc.at(TBUB + 0.5, () => hit(where(u, r), away(u, me.x), 'spin', 2));
        }
        beats.forEach((b, i) => sc.at(b, () => {
            ring(sc, me.x, cy, bubR(b), bubR(b) * 1.4, 0.9, 0.35, ['#ffffff', ESPC[2]], 2);
            ultShake(2 + i * 1.5, 200);
        }));
        sc.at(TB, () => {
            impactFrames(sc, W, H, 0.7, 0.4);
            blastDome(sc, me.x, G, clamp(Rmax, 30, Math.min(G * 0.92, W * 0.5)), 1.9, ESPC);
            ring(sc, me.x, cy, bubR(TB), Math.max(W, H) * 0.8, 0.9, 0.7, ['#ffffff', ESPC[1], ESPC[2]], 2);
            K.shards(me.x, cy, s, s * 2, ESPC, 16, H * 0.8, G);
            ultShake(8 + 3 * P, 1100);
            for (const r of u.others()) {
                sc.at(TB + 0.1, () => hit(where(u, r), away(u, me.x), 'tumble', 0));
            }
        });
        emberRise(sc, TB + 0.4, sec, ESPC);
    }

    // ═════ 토게키스 — 러블리스타임팩트 (ultsparkle) ═════
    // 하늘 높이 날아올라 반짝이 꼬리를 남기며 크게 원을 그림 · 하늘에 별 · 하트가 가득 → 과녁으로 내리꽂히며 땅에 거대한 별 모양 빛이 그려짐
    // → 별이 번쩍 터지며 임팩트 프레임 · 파스텔 빛의 반구 · 하트 불꽃놀이 → 사뿐히 제자리 (약 7.2초)
    const LOVELY = ['#ffffff', '#fff3fa', '#ffb3e6', '#9ec5ff'];
    UNIQ.togekiss = { fx: 'ultsparkle', ms: (P) => 7200 + 200 * P, run: runLovelyStar };
    // 다섯 꼭지 별 윤곽 — (x, y) 가운데, R 바깥 반지름, k 0~1 그려진 정도
    function starOutline(ctx, px, s, x, y, R, rot, k, cols, flat = 1) {
        const pts = [];
        for (let i = 0; i <= 10; i++) {
            const an = rot - Math.PI / 2 + (i * Math.PI) / 5;
            const rr = i % 2 ? R * 0.42 : R;
            pts.push([x + Math.cos(an) * rr, y + Math.sin(an) * rr * flat]);
        }
        const n = Math.max(2, Math.ceil(pts.length * k));
        K.fillPts(ctx, px, s, pts.slice(0, n), 5, cols[3], 0.5);
        K.fillPts(ctx, px, s, pts.slice(0, n), 3, cols[2], 0.9);
        K.fillPts(ctx, px, s, pts.slice(0, n), 1, '#ffffff', 1);
    }
    function runLovelyStar(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TUP = 0.4;
        const TCIRC = 1.0;
        const CIRC = 1.3;
        const TDIVE = TCIRC + CIRC;
        const TI = TDIVE + 0.45;
        const TSTAR = TI + 0.5; // 별 터짐
        const THOME = sec - 0.6;
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * W * 0.45, W * 0.12, W * 0.88);
        const cx0 = W / 2;
        const cy0 = Math.max(H * 0.28, 40);
        const rr = Math.min(W * 0.3, H * 0.2);
        const posAt = (t) => {
            if (t < TUP) {
                return [me.x, me.b];
            }
            if (t < TCIRC) {
                const k = easeOut((t - TUP) / (TCIRC - TUP));
                return [lerp(me.x, cx0 - rr, k), lerp(me.b, cy0, k)];
            }
            if (t < TDIVE) {
                const an = Math.PI + ((t - TCIRC) / CIRC) * TAU * dir;
                return [cx0 + Math.cos(an) * rr, cy0 + Math.sin(an) * rr * 0.6];
            }
            if (t < TI) {
                const k = easeIn((t - TDIVE) / (TI - TDIVE));
                return [lerp(cx0 - rr, tx, k), lerp(cy0, G, k)];
            }
            if (t < THOME) {
                const k = easeOut(clamp((t - TI) / 0.6, 0, 1));
                return [tx, lerp(G, G - me.h * 0.8, k)];
            }
            const k = easeOut(clamp((t - THOME) / 0.5, 0, 1));
            return [lerp(tx, me.x, k), lerp(G - me.h * 0.8, me.b, k)];
        };
        const sc = scene(u, sec + 0.4, 'uniq togekiss');
        ultDark(0.4, ms - 200);
        // 별 · 하트 하늘
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp((life - 0.4) / 0.6, 0, 1) * clamp((sec - 0.3 - life) / 0.6, 0, 1);
            const z = Math.max(s, Math.round(short(u) / 110));
            for (let j = 0; j < 26; j++) {
                const x = hash(j, 781) * W;
                const y = hash(j, 782) * G * 0.7;
                const tw = Math.sin(life * (3 + 3 * hash(j, 783)) + j);
                if (tw < -0.2) {
                    continue;
                }
                if (j % 3 === 0) {
                    ctx.globalAlpha = 0.85 * a;
                    ctx.fillStyle = LOVELY[2];
                    ctx.fillRect(px(x - z), px(y), z, z);
                    ctx.fillRect(px(x + z), px(y), z, z);
                    ctx.fillRect(px(x - z * 1.5), px(y + z), z * 4, z);
                    ctx.fillRect(px(x - z * 0.5), px(y + z * 2), z * 2, z);
                } else {
                    glint(ctx, px, s, x, y, z * (1.5 + tw), 0.8 * a);
                }
            }
        } });
        // 반짝이 꼬리
        sc.add({ max: TI + 0.6, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TUP) {
                return;
            }
            for (let j = 0; j < 30; j++) {
                const tt = life - j * 0.03;
                if (tt < TUP) {
                    break;
                }
                const [x, b] = posAt(tt);
                ctx.globalAlpha = (1 - j / 30) * (1 - clamp((life - TI) / 0.6, 0, 1));
                ctx.fillStyle = hsl(j * 18 + life * 200, 80);
                ctx.fillRect(px(x), px(b - me.h * 0.5), s * 2, s * 2);
            }
        } });
        // 토게키스 (꼭두각시)
        const img = pokemon.el;
        const edge = Math.max(1, Math.round(u.s * 0.75));
        hideMon(pokemon, true);
        hideUntil(pokemon, (sec - 0.1) * 1000 + 100);
        sc.at(sec - 0.12, () => hideMon(pokemon, false));
        sc.add({ max: sec - 0.1, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life >= sec - 0.12) {
                return;
            }
            const [x, b] = posAt(life);
            const [x2] = posAt(life + 0.02);
            const lf = Math.abs(x2 - x) > 0.5 ? x2 < x : dir < 0;
            drawLitMon(ctx, img, x, b, me.w, lf, LOVELY[2], edge, 1);
        } });
        // 땅에 그려지는 거대한 별
        const Rs = clamp(Math.min(W * 0.22, G * 0.5), 20, 140);
        sc.add({ max: TSTAR + 0.05, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TI) {
                return;
            }
            const k = easeOut((life - TI) / (TSTAR - TI - 0.1));
            starOutline(ctx, px, s, tx, G - Rs * 0.3, Rs, life * 0.5, k, LOVELY, 0.55);
        } });
        sc.at(TI, () => {
            ring(sc, tx, G - s, me.w * 0.3, Rs * 1.4, 0.3, 0.4, ['#ffffff', LOVELY[2]], 2);
            ultShake(4, 300);
        });
        sc.at(TSTAR, () => {
            impactFrames(sc, W, H, 0.6, 0.35);
            blastDome(sc, tx, G, clamp(Math.max(H * 0.48, Rs * 1.5), 30, Math.min(G * 0.92, W * 0.48)), 1.9, LOVELY);
            ultShake(8 + 2 * P, 1000);
            for (const r of u.others()) {
                sc.at(TSTAR + 0.1, () => hit(where(u, r), away(u, tx), 'spin', 0.3));
            }
            for (let i = 0; i < 4; i++) {
                sc.at(TSTAR + 0.7 + i * 0.22, () => {
                    const x = clamp(tx + (hash(i, 791) - 0.5) * W * 0.6, W * 0.08, W * 0.92);
                    const y = G * (0.25 + 0.2 * hash(i, 792));
                    sparkles(x, y, s, ['#ffffff', LOVELY[2], LOVELY[3], '#ffd6f0'], 18, Math.max(W * 0.06, 12), H * 0.15);
                    ring(sc, x, y, s * 2, W * 0.07, 1, 0.5, [LOVELY[2], LOVELY[3]], 2);
                });
            }
        });
        emberRise(sc, TSTAR + 0.4, sec, LOVELY);
    }

    // ═════ 핫삼 — 불릿펀치 (ultbarrage) ═════
    // 붉은 강철 몸이 번쩍 · 집게를 맞부딪쳐 불꽃 → 사라졌다가 과녁 둘레 여러 방향에서 번쩍번쩍 나타나며 탄환 같은 주먹(빨강 · 은빛 줄 · 잔상)
    // → 마지막에 거대한 붉은 X 자 베기(시저크로스) → 임팩트 프레임 · 은빛 빛의 반구 → 제자리에 착지 (약 7.0초)
    const SCIZ = ['#ffffff', '#ffd0d0', '#e83a3a', '#7a1020'];
    UNIQ.scizor = { fx: 'ultbarrage', ms: (P) => 7000 + 200 * P, run: runBulletPunch };
    function runBulletPunch(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TCLANG = 0.6;
        const TGONE = 1.2;
        const NP = 12;
        const TP0 = TGONE + 0.2;
        const STEP = 0.14;
        const TX = TP0 + NP * STEP + 0.15; // X 자 베기
        const TB = TX + 0.35;
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * W * 0.45, W * 0.12, W * 0.88);
        const ty = q ? q.y : G - me.h * 0.5;
        const pops = [];
        for (let i = 0; i < NP; i++) {
            const an = (i * 2.4) % TAU;
            pops.push({ t: TP0 + i * STEP, x: clamp(tx + Math.cos(an) * me.w * 1.2, me.w * 0.5, W - me.w * 0.5), y: clamp(ty + Math.sin(an) * me.h * 0.5, me.h, G) });
        }
        const sc = scene(u, sec + 0.4, 'uniq scizor');
        ultDark(0.45, ms - 200);
        // 핫삼 (꼭두각시) — 사라짐 · 번쩍번쩍 · 돌아옴
        const img = pokemon.el;
        const edge = Math.max(1, Math.round(u.s * 0.75));
        hideMon(pokemon, true);
        hideUntil(pokemon, (sec - 0.1) * 1000 + 100);
        sc.at(sec - 0.12, () => hideMon(pokemon, false));
        sc.add({ max: sec - 0.1, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life >= sec - 0.12) {
                return;
            }
            if (life < TGONE) {
                drawLitMon(ctx, img, me.x, me.b, me.w, dir < 0, SCIZ[2], edge, 1);
                if ((life > TCLANG && life < TCLANG + 0.1) || life > TGONE - 0.1) {
                    drawMon(ctx, img, me.x, me.b, me.w, dir < 0, 0.7, '#ffffff');
                }
                return;
            }
            const i = pops.findIndex((p) => life >= p.t && life < p.t + STEP);
            if (i >= 0) {
                const p = pops[i];
                drawLitMon(ctx, img, p.x, p.y + me.h * 0.5, me.w, p.x > tx, SCIZ[2], edge, 1);
                return;
            }
            if (life > TB + 0.8) {
                const k = easeOut(clamp((life - TB - 0.8) / 0.4, 0, 1));
                drawLitMon(ctx, img, me.x, me.b - (1 - k) * me.h * 0.6, me.w, dir < 0, SCIZ[2], edge, k);
            }
        } });
        sc.at(TCLANG, () => {
            fireBits(me.x, me.b - me.h * 0.6, s, ['#ffffff', '#fff3a0', SCIZ[2]], 16, { speed: H * 0.5, life: 0.5 });
            ring(sc, me.x, me.b - me.h * 0.6, me.w * 0.3, me.w * 1.8, 0.9, 0.3, ['#ffffff', SCIZ[2]], 2);
            ultShake(2, 150);
        });
        // 탄환 주먹 — 잔상 · 빨강 · 은빛 줄 · 맞은 자리 번쩍
        pops.forEach((p, i) => {
            sc.add({ max: sec, draw: (ctx, it, t, px) => {
                const life = sc.t;
                const k = (life - p.t) / 0.3;
                if (k < 0 || k > 1) {
                    return;
                }
                drawMon(ctx, img, p.x, p.y + me.h * 0.5, me.w, p.x > tx, 0.35 * (1 - k), SCIZ[2]);
                const L = Math.hypot(tx - p.x, ty - p.y) || 1;
                const ux = (tx - p.x) / L;
                const uy = (ty - p.y) / L;
                ctx.globalAlpha = 1 - k;
                for (let d = 0; d < L * (0.3 + 0.7 * Math.min(1, k * 4)); d += s) {
                    ctx.fillStyle = d > L * 0.7 ? '#ffffff' : i % 2 ? '#d8e0ea' : SCIZ[2];
                    ctx.fillRect(px(p.x + ux * d), px(p.y + uy * d), s, s * 2);
                }
            } });
            sc.at(p.t + 0.05, () => {
                ring(sc, tx, ty, s * 2, me.w * 0.8, 0.9, 0.2, ['#ffffff', SCIZ[1]], 2);
                fireBits(tx, ty, s, ['#ffffff', '#e0e8f0', SCIZ[2]], 6, { speed: H * 0.4, life: 0.4 });
                ultShake(2, 80);
                if (q && i % 3 === 0) {
                    hit(where(u, q), Math.sign(q.x - p.x) || dir, 'shake', 0);
                }
            });
        });
        // 시저크로스 — 거대한 붉은 X
        sc.add({ max: TB + 0.5, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TX) {
                return;
            }
            const L = Math.max(me.h * 2.5, H * 0.5);
            for (const [sd, t0] of [[1, TX], [-1, TX + 0.12]]) {
                const k = clamp((life - t0) / 0.12, 0, 1);
                if (k <= 0) {
                    continue;
                }
                const fade = clamp(1 - (life - t0 - 0.35) / 0.4, 0, 1);
                const ux = Math.cos(Math.PI / 4) * sd;
                const uy = Math.sin(Math.PI / 4);
                const x0 = tx - ux * L * 0.5;
                const y0 = ty - uy * L * 0.5;
                for (let d = 0; d < L * k; d += s) {
                    const f = d / L;
                    const w = Math.max(s, Math.round((Math.sin(f * Math.PI) * me.w * 0.18) / s) * s);
                    ctx.globalAlpha = fade;
                    ctx.fillStyle = SCIZ[3];
                    ctx.fillRect(px(x0 + ux * d - w / 2 - s), px(y0 + uy * d), w + 2 * s, s);
                    ctx.fillStyle = SCIZ[2];
                    ctx.fillRect(px(x0 + ux * d - w / 2), px(y0 + uy * d), w, s);
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(px(x0 + ux * d - w / 4), px(y0 + uy * d), Math.max(s, w / 2), s);
                }
            }
        } });
        sc.at(TX, () => ultShake(5, 300));
        sc.at(TB, () => {
            impactFrames(sc, W, H, 0.75, 0.5);
            blastDome(sc, tx, G, clamp(Math.max(H * 0.45, me.w * 2.8), 30, Math.min(G * 0.92, W * 0.45)), 1.8, ['#ffffff', '#e8eef6', '#b0bccc', SCIZ[2]]);
            ultShake(9 + 3 * P, 1100);
            for (const r of u.others()) {
                sc.at(TB + 0.08, () => hit(where(u, r), away(u, tx), Math.abs(r.x - tx) < W * 0.2 ? 'tumble' : 'lift', 0.3));
            }
        });
        emberRise(sc, TB + 0.4, sec, ['#ffffff', '#e8eef6', '#b0bccc', SCIZ[2]]);
    }

    // ═════ 블레이범 — 블라스트번 (ultnova) ═════
    // 목의 불꽃 갈기가 화산처럼 활활 솟구침 · 땅이 달아올라 붉은 금 → 몸을 웅크렸다 쾅 — 불의 고리가 땅을 따라 퍼지고
    // 둘레 땅에서 불기둥이 원을 그리며 차례로 솟음(닿은 애 떠오름) → 가운데 거대한 불꽃 폭발 · 주황빛 빛의 반구 (약 7.0초)
    UNIQ.typhlosion = { fx: 'ultnova', ms: (P) => 7000 + 200 * P, run: runTyphloBurn };
    function runTyphloBurn(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const FIRE = ['#ffffff', '#fff3a0', '#ff9a2a', '#d0301a'];
        const TC0 = 0.3;
        const TBANG = 2.0; // 쾅
        const NP = 6;
        const TP0 = TBANG + 0.2;
        const TB = TP0 + NP * 0.15 + 0.35; // 가운데 대폭발
        const ringR = Math.min(Math.max(me.x, W - me.x), W * 0.42);
        const pillars = [];
        for (let i = 0; i < NP; i++) {
            const side = i % 2 ? -1 : 1;
            const d = me.w * 0.9 + (ringR - me.w * 0.9) * ((Math.floor(i / 2) + 1) / Math.ceil(NP / 2));
            const x = me.x + side * d;
            if (x > s * 4 && x < W - s * 4) {
                pillars.push({ x, t: TP0 + i * 0.15 });
            }
        }
        const sc = scene(u, sec + 0.4, 'uniq typhlosion');
        ultDark(0.35, ms - 200);
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp((life - 0.3) / 0.6, 0, 1) * clamp((sec - 0.3 - life) / 0.6, 0, 1);
            ctx.globalAlpha = 0.16 * a;
            ctx.fillStyle = FIRE[3];
            ctx.fillRect(0, 0, W, H);
        } });
        // 화산 같은 불꽃 갈기 (블레이범 뒤) — 점점 높이
        sc.add({ max: TB + 0.3, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - TC0) / 0.4, 0, 1) * (1 - clamp((life - TB) / 0.3, 0, 1));
            if (k > 0.02) {
                const tall = 1.3 + 1.0 * easeOut(clamp((life - TC0) / 1.6, 0, 1));
                K.flameTongue(ctx, px, s, me.x, me.b + s * 2, me.w * 1.3, me.h * tall, FIRE, life, k);
                K.flameTongue(ctx, px, s, me.x - me.w * 0.35, me.b + s * 2, me.w * 0.7, me.h * tall * 0.8, FIRE, life + 1, k, -0.3);
                K.flameTongue(ctx, px, s, me.x + me.w * 0.35, me.b + s * 2, me.w * 0.7, me.h * tall * 0.8, FIRE, life + 2, k, 0.3);
            }
        } });
        puppet(sc, pokemon, u, () => me.b, FIRE[2], sec - 0.1, { glow: (t) => (t > TBANG - 0.05 && t < TBANG + 0.1 ? 0.7 : clamp((t - TC0) / 0.8, 0, 1) * 0.15 * (1 + Math.sin(t * 10))), glowColor: FIRE[1] });
        sc.at(TC0 + 0.4, () => groundArcs(sc, me.x, G - s, W * 0.4, 2.2, FIRE[2], 6, 1, G - s));
        [0.9, 1.3, 1.65].forEach((tb, i) => sc.at(tb, () => {
            ring(sc, me.x, me.b - me.h * 0.5, me.w * 0.4, me.w * (1.8 + i * 0.4), 0.85, 0.35, ['#ffffff', FIRE[2]], 2);
            fireBits(me.x, me.b - me.h, s, FIRE, 12, { angle: -Math.PI / 2, spread: 1.2, speed: H * 0.7, life: 0.6 });
            ultShake(2 + i, 200);
        }));
        // 쾅 — 불의 고리 · 둘레 불기둥
        sc.at(TBANG, () => {
            impactFrames(sc, W, H, 0.7, 0.45);
            ring(sc, me.x, G - s, me.w * 0.5, ringR * 1.2, 0.22, 0.9, ['#ffffff', FIRE[1], FIRE[2]], 3);
            ultShake(6 + 2 * P, 900);
        });
        sc.add({ max: TB + 0.5, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TBANG) {
                return;
            }
            const k = easeOut((life - TBANG) / 0.9);
            const fade = 1 - clamp((life - TB) / 0.5, 0, 1);
            const half = ringR * 1.1 * k;
            K.groundFlames(ctx, px, s, Math.max(0, me.x - half), Math.min(W, me.x + half), G, H * 0.08, life, FIRE, 0.9 * fade);
        } });
        pillars.forEach((p) => sc.at(p.t, () => {
            K.firePillar(sc, p.x, G, Math.max(5 * s, me.w * 0.4), 1.1, FIRE);
            ultShake(3, 150);
            for (const r of u.others()) {
                if (Math.abs(r.x - p.x) < me.w * 0.5 + r.w * 0.4) {
                    hit(where(u, r), away(u, me.x), 'lift', 0.6);
                }
            }
        }));
        sc.at(TB, () => {
            impactFrames(sc, W, H, 0.8, 0.5);
            blastDome(sc, me.x, G, clamp(Math.max(H * 0.55, ringR * 0.8), 30, Math.min(G * 0.92, W * 0.5)), 1.9, FIRE);
            ultShake(10 + 3 * P, 1300);
            for (const r of u.others()) {
                sc.at(TB + 0.1, () => hit(where(u, r), away(u, me.x), 'tumble', 0.3));
            }
        });
        emberRise(sc, TB + 0.3, sec, FIRE);
    }

    // ═════ 장크로다일 — 하이드로캐논 (ultbeam) ═════
    // 물보라가 몸을 감싸며 크게 입을 벌림 · 입 앞에 물이 소용돌이치며 모임 → 임팩트 프레임 · 물로 된 거대한 악어 머리(위아래 턱 · 이빨 · 눈)가
    // 물살 꼬리를 끌며 과녁으로 돌진 → 덥석 물며 턱이 닫힘 → 물 폭발 · 물기둥 · 물빛 빛의 반구 (약 7.0초)
    UNIQ.feraligatr = { fx: 'ultbeam', ms: (P) => 7000 + 200 * P, run: runGatorCannon };
    function runGatorCannon(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TIDE = K.pal.TIDE;
        const TC0 = 0.6;
        const TGO = 2.1; // 물 악어 출발
        const FLY = 0.75;
        const TBITE = TGO + FLY; // 덥석
        const TB = TBITE + 0.25;
        const [mx, my] = [u.mouth.x + dir * s * 2, u.mouth.y];
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * W * 0.5, W * 0.1, W * 0.9);
        const ty = q ? q.y : G - me.h * 0.5;
        const Rg = clamp(Math.max(me.h * 0.8, H * 0.2), 10 * s, H * 0.35);
        const headAt = (t) => {
            const k = easeIn(clamp((t - TGO) / FLY, 0, 1));
            return [lerp(mx, tx - dir * Rg * 0.4, k), lerp(my, ty, k)];
        };
        const sc = scene(u, sec + 0.4, 'uniq feraligatr');
        ultDark(0.4, ms - 200);
        // 물보라 (몸 둘레)
        sc.add({ max: TGO + 0.3, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp((life - 0.2) / 0.4, 0, 1) * (1 - clamp((life - TGO) / 0.3, 0, 1));
            if (a > 0.02) {
                K.swirlRing(ctx, px, s, me.x, G - s, me.w * 0.9, 0.22, life, dir, TIDE, a);
                K.swirlRing(ctx, px, s, me.x, me.b - me.h * 0.5, me.w * 0.75, 0.35, life * 1.3, -dir, TIDE, a * 0.8);
            }
        } });
        puppet(sc, pokemon, u, () => me.b, TIDE[2], sec - 0.1, { glow: (t) => (t > TGO - 0.05 && t < TGO + 0.1 ? 0.7 : clamp((t - TC0) / 1, 0, 1) * (t < TGO ? 0.12 * (1 + Math.sin(t * 10)) : 0)), glowColor: '#ffffff' });
        chargeSwirl(sc, () => [mx, my], TC0, TGO - 0.05, Math.max(me.w * 3.5, short(u) * 0.42), Math.max(s * 4, Rg * 0.3), TIDE, dir);
        // 물 악어 머리 — 위턱 · 아래턱 · 이빨 · 눈 · 물살 꼬리
        const gator = (ctx, px, x, y, R, open, life) => {
            const fx = dir;
            // 물살 꼬리 (뒤로)
            K.waterJet(ctx, px, s, x - fx * R * 0.3, y, -fx, R * 2.6, R * 0.9, TIDE, life, life * 6, R * 0.12);
            for (const [jaw, sgn] of [[open, -1], [open * 0.7, 1]]) {
                const ang = sgn * (0.12 + 0.45 * jaw);
                const ca = Math.cos(ang);
                const sa = Math.sin(ang);
                for (let d = 0; d < R * 1.4; d += s) {
                    const f = d / (R * 1.4);
                    const th = R * (sgn < 0 ? 0.42 : 0.3) * (1 - f * 0.6);
                    const cx = x + fx * d * ca;
                    const cy = y + d * sa;
                    for (let e = 0; e < th; e += s) {
                        const yy = cy + sgn * e;
                        ctx.globalAlpha = 0.9;
                        ctx.fillStyle = e > th - s * 1.5 ? TIDE[3] : e < s * 1.5 ? '#ffffff' : TIDE[2];
                        ctx.fillRect(px(cx), px(yy), s, s);
                    }
                    // 이빨 — 턱 안쪽에 하얀 세모
                    if (Math.round(d / s) % 4 === 0 && f > 0.15) {
                        for (let e = 0; e < R * 0.12; e += s) {
                            ctx.fillStyle = '#ffffff';
                            ctx.fillRect(px(cx), px(cy - sgn * e), s, s);
                        }
                    }
                }
                if (sgn < 0) {
                    // 눈 — 위턱 뒤쪽
                    const ex = x + fx * R * 0.25;
                    const ey = y + R * Math.sin(ang) * 0.25 - R * 0.32;
                    ctx.globalAlpha = 1;
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(px(ex - s), px(ey - s), s * 3, s * 3);
                    ctx.fillStyle = '#c0202a';
                    ctx.fillRect(px(ex), px(ey), s, s);
                }
            }
        };
        sc.add({ max: TB + 0.02, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TGO) {
                return;
            }
            const [x, y] = headAt(life);
            const k = clamp((life - TGO) / 0.2, 0, 1);
            const open = life < TBITE - 0.08 ? 0.9 + 0.1 * Math.sin(life * 20) : Math.max(0, 1 - (life - TBITE + 0.08) / 0.12);
            gator(ctx, px, x, y, Rg * (0.5 + 0.5 * k), open, life);
        } });
        sc.at(TGO, () => {
            impactFrames(sc, W, H, 0.7, 0.45);
            K.splash(mx, my, s, TIDE, 20, H * 0.6);
            ultShake(5, 400);
        });
        sc.at(TBITE, () => {
            ultShake(6, 300);
            if (q) {
                hit(where(u, q), dir, 'tumble', 0);
            }
        });
        sc.at(TB, () => {
            impactFrames(sc, W, H, 0.6, 0.4);
            K.crownSplash(sc, tx, G, Rg * 1.2, 1.0, TIDE);
            K.geyser(sc, tx, G, Math.max(4 * s, Rg * 0.25), G * 0.7, 1.1, TIDE);
            blastDome(sc, tx, G, clamp(Math.max(H * 0.48, Rg * 2.2), 30, Math.min(G * 0.92, W * 0.48)), 1.8, TIDE);
            ultShake(9 + 3 * P, 1100);
            for (const r of u.others()) {
                sc.at(TB + 0.1, () => hit(where(u, r), away(u, tx), 'lift', 0.3));
            }
        });
        K.waterRain(sc, TB + 0.5, sec - 0.2, TIDE);
    }

    // ═════ 메가니움 — 하드플랜트 (ultbloom) ═════
    // 목둘레 꽃잎이 활짝 · 달콤한 향기(분홍 · 노란 꽃가루가 물결치며 퍼짐) → 땅이 우르릉 → 꽃을 피운 거대한 덩굴들이 앞으로 차례로 솟아 휘감음
    // (덩굴 끝마다 꽃이 핌 · 닿은 애 떠오름) → 맨 앞에서 거대한 꽃이 피어 꽃잎 폭풍 (약 7.2초)
    UNIQ.meganium = { fx: 'ultbloom', ms: (P) => 7200 + 200 * P, run: runMeganiumPlant };
    function runMeganiumPlant(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const VINEC = K.pal.VINE;
        const PINKC = K.pal.PINK;
        const TAROMA = 0.3;
        const TV0 = 1.8; // 덩굴
        const NV = 5;
        const far = dir > 0 ? W - me.x : me.x;
        const vines = [];
        for (let i = 0; i < NV; i++) {
            const d = me.w * 0.8 + (far - me.w * 0.8) * ((i + 0.5) / NV);
            vines.push({ x: clamp(me.x + dir * d, s * 4, W - s * 4), h: Math.min(G * 0.85, H * (0.3 + 0.35 * ((i + 1) / NV))), w: Math.max(4 * s, me.w * 0.22), t0: TV0 + i * 0.22, seed: hash(i, 801) * 99 });
        }
        const TBL = vines[NV - 1].t0 + 0.6; // 거대한 꽃
        const sc = scene(u, sec + 0.4, 'uniq meganium');
        ultDark(0.3, ms - 200);
        // 향기 — 물결치며 퍼지는 꽃가루
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TAROMA) {
                return;
            }
            const a = clamp((life - TAROMA) / 0.5, 0, 1) * clamp((sec - 0.3 - life) / 0.6, 0, 1);
            for (let j = 0; j < 40; j++) {
                const k = ((life - TAROMA) * 0.35 + hash(j, 811)) % 1;
                const x = me.x + dir * k * far * 1.1 + Math.sin(life * 2 + j) * s * 6;
                const y = me.b - me.h * 0.6 + Math.sin(k * 9 + j) * H * 0.12 - k * H * 0.15;
                ctx.globalAlpha = 0.8 * a * Math.sin(k * Math.PI);
                ctx.fillStyle = j % 3 ? PINKC[1] : '#fff3a0';
                ctx.fillRect(px(x), px(y), s * (j % 4 ? 1 : 2), s * (j % 4 ? 1 : 2));
            }
        } });
        puppet(sc, pokemon, u, () => me.b, VINEC[1], sec - 0.1, { glow: (t) => clamp((t - 0.2) / 0.5, 0, 1) * 0.15 * (1 + Math.sin(t * 6)), glowColor: PINKC[1] });
        sc.at(TV0 - 0.3, () => {
            groundArcs(sc, me.x, G - s, far, 1.2, VINEC[1], 3, 1, G - s);
            ultShake(3, 500);
        });
        // 꽃 핀 덩굴 — K.vine 으로 솟고 끝마다 꽃
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            for (const v of vines) {
                if (life < v.t0) {
                    continue;
                }
                const grow = easeOut((life - v.t0) / 0.4);
                const fall = clamp((life - (sec - 0.8)) / 0.6, 0, 1);
                K.vine(ctx, px, s, v.x, G, v.h * (1 - fall), v.w, life, grow, dir, v.seed);
                // 꽃 — 덩굴 끝
                const k = clamp((life - v.t0 - 0.35) / 0.3, 0, 1) * (1 - fall);
                if (k > 0.02) {
                    const fx = v.x + dir * v.w * 0.5;
                    const fy = G - v.h * grow * (1 - fall);
                    const R = v.w * 1.1 * k;
                    for (let i = 0; i < 6; i++) {
                        const an = life * 0.6 + (i * TAU) / 6;
                        ellipse(ctx, px, s, fx + Math.cos(an) * R * 0.6, fy + Math.sin(an) * R * 0.6, R * 0.45, R * 0.45, i % 2 ? PINKC[2] : PINKC[1], 1);
                    }
                    ellipse(ctx, px, s, fx, fy, R * 0.32, R * 0.32, '#fff3a0', 1);
                }
            }
        } });
        vines.forEach((v) => sc.at(v.t0, () => {
            debris(v.x, G - s, s, ['#8a7252', '#5c4a33', VINEC[1]], 10, H * 0.5, { ground: G });
            ultShake(3, 160);
            for (const r of u.others()) {
                if (Math.abs(r.x - v.x) < v.w * 1.5 + r.w * 0.4) {
                    hit(where(u, r), away(u, me.x), 'lift', 0.6);
                }
            }
        }));
        sc.at(TBL, () => ultFinale('bloom', u, vines[NV - 1].x, H * 0.38, PINKC));
    }

    // ═════ 번치코 — 블레이즈킥 (ultbarrage) ═════
    // 손목 불꽃이 활활 커지며 땅을 박차 하늘 높이 솟구침(불꽃 꼬리) → 꼭대기에서 몸을 말아 불꽃 바퀴가 되어 빙글빙글
    // → 과녁으로 내리꽂히는 불꽃 발차기 → 임팩트 프레임 · 불기둥 · 주황빛 빛의 반구 → 공중제비로 제자리 (약 7.0초)
    UNIQ.blaziken = { fx: 'ultbarrage', ms: (P) => 7000 + 200 * P, run: runBlazeKick };
    function runBlazeKick(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const FIRE = ['#ffffff', '#fff3a0', '#ff8a2a', '#c8201a'];
        const TC0 = 0.3;
        const TUP = 1.5;
        const TTOP = TUP + 0.45;
        const TWHEEL = TTOP + 0.6;
        const TI = TWHEEL + 0.35;
        const THOME = TI + 1.9;
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * W * 0.4, W * 0.1, W * 0.9);
        const topY = Math.max(me.h * 1.2, G * 0.25);
        const posAt = (t) => {
            if (t < TUP) {
                return [me.x, me.b, 0];
            }
            if (t < TTOP) {
                const k = easeOut((t - TUP) / (TTOP - TUP));
                return [lerp(me.x, (me.x + tx) / 2, k), lerp(me.b, topY, k), 0];
            }
            if (t < TWHEEL) {
                return [(me.x + tx) / 2, topY + Math.sin(t * 6) * s * 2, (t - TTOP) * 18 * dir];
            }
            if (t < TI) {
                const k = easeIn((t - TWHEEL) / (TI - TWHEEL));
                return [lerp((me.x + tx) / 2, tx, k), lerp(topY, G, k), dir * 0.9];
            }
            if (t < THOME) {
                const k = easeOut(clamp((t - TI - 0.4) / 0.6, 0, 1));
                return [lerp(tx, me.x, k), G - Math.sin(k * Math.PI) * me.h * 1.2, k * TAU * -dir];
            }
            return [me.x, me.b, 0];
        };
        const sc = scene(u, sec + 0.4, 'uniq blaziken');
        ultDark(0.4, ms - 200);
        // 손목 불꽃 · 불꽃 바퀴 (번치코 뒤)
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const [x, b] = posAt(life);
            if (life < TUP) {
                const k = clamp((life - TC0) / 0.4, 0, 1);
                for (const sd of [-1, 1]) {
                    K.flameTongue(ctx, px, s, me.x + sd * me.w * 0.4, me.b - me.h * 0.35, me.w * 0.45, me.h * (0.6 + 0.5 * easeOut(clamp((life - TC0) / 1, 0, 1))), FIRE, life + sd, k);
                }
            } else if (life > TTOP && life < TI) {
                const R = me.w * 0.8;
                for (let j = 0; j < 8; j++) {
                    const an = life * 16 * dir + (j * TAU) / 8;
                    K.fireTail(ctx, px, s, x + Math.cos(an) * R * 0.6, b - me.h * 0.5 + Math.sin(an) * R * 0.6, -Math.sin(an) * dir, Math.cos(an) * dir, R * 0.9, R * 0.4, FIRE, life + j, 1);
                }
            }
            if (life > TUP && life < TTOP + 0.1) {
                K.fireTail(ctx, px, s, x, b - me.h * 0.5, 0, -1, me.h * 1.5, me.w * 0.6, FIRE, life, 1);
            }
            if (life > TWHEEL && life < TI) {
                const dx = tx - (me.x + tx) / 2;
                const dy = G - topY;
                const L = Math.hypot(dx, dy) || 1;
                K.fireTail(ctx, px, s, x, b - me.h * 0.5, dx / L, dy / L, H * 0.5, me.w * 1.1, FIRE, life, 1);
            }
        } });
        // 번치코 (꼭두각시)
        const img = pokemon.el;
        const edge = Math.max(1, Math.round(u.s * 0.75));
        hideMon(pokemon, true);
        hideUntil(pokemon, (sec - 0.1) * 1000 + 100);
        sc.at(sec - 0.12, () => hideMon(pokemon, false));
        sc.add({ max: sec - 0.1, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life >= sec - 0.12) {
                return;
            }
            const [x, b, rot] = posAt(life);
            drawLitMon(ctx, img, x, b, me.w, dir < 0, FIRE[2], edge, 1, rot);
            if (life > TC0 && life < TUP) {
                drawMon(ctx, img, x, b, me.w, dir < 0, 0.15 * (1 + Math.sin(life * 12)), FIRE[1], rot);
            }
        } });
        sc.at(TUP, () => {
            ring(sc, me.x, G - s, me.w * 0.5, me.w * 3, 0.25, 0.45, ['#ffffff', FIRE[2]], 2);
            debris(me.x, G - s, s, ['#8a7252', '#5c4a33', FIRE[2]], 14, H * 0.6, { ground: G });
            ultShake(4, 300);
        });
        sc.at(TTOP, () => {
            ring(sc, (me.x + tx) / 2, topY - me.h * 0.5, me.w * 0.4, me.w * 2.5, 1, 0.4, ['#ffffff', FIRE[1], FIRE[2]], 2);
            ultShake(2, 200);
        });
        sc.at(TI, () => {
            impactFrames(sc, W, H, 0.8, 0.5);
            K.firePillar(sc, tx, G, clamp(me.w * 0.9, 8 * s, W * 0.18), 1.3, FIRE);
            blastDome(sc, tx, G, clamp(Math.max(H * 0.48, me.w * 3), 30, Math.min(G * 0.92, W * 0.48)), 1.8, FIRE);
            ultShake(10 + 3 * P, 1200);
            for (const r of u.others()) {
                sc.at(TI + 0.08, () => hit(where(u, r), away(u, tx), Math.abs(r.x - tx) < W * 0.2 ? 'tumble' : 'lift', 0.3));
            }
        });
        emberRise(sc, TI + 0.4, sec, FIRE);
    }

    // ═════ 대짱이 — 지진 (ultquake) ═════
    // 두 팔을 들어 땅을 쾅 · 쾅 → 땅이 갈라지며 진흙이 솟고 거대한 진흙 해일이 바위를 싣고 화면을 휩쓺(닿은 애 휩쓸려 벌러덩)
    // → 해일이 부서지며 진흙비 · 흙빛 빛의 반구 (약 7.0초)
    const MUD = ['#f0dcae', '#b08a58', '#7a5a34', '#4a3420'];
    UNIQ.swampert = { fx: 'ultquake', ms: (P) => 7000 + 200 * P, run: runMudQuake };
    function runMudQuake(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const slams = [0.9, 1.4];
        const TWAVE = 2.0;
        const WSEC = 1.4;
        const TB = TWAVE + WSEC * 0.8;
        const far = dir > 0 ? W - me.x : me.x;
        const front = (t) => me.x + dir * (me.w * 0.6 + far * 1.15 * easeOut(clamp((t - TWAVE) / WSEC, 0, 1)));
        const sc = scene(u, sec + 0.4, 'uniq swampert');
        ultDark(0.35, ms - 200);
        puppet(sc, pokemon, u, (t) => me.b - (slams.some((ts) => t > ts - 0.25 && t < ts) ? me.h * 0.15 : 0), MUD[2], sec - 0.1, { glow: (t) => (slams.some((ts) => t > ts && t < ts + 0.1) ? 0.5 : 0), glowColor: MUD[0] });
        slams.forEach((ts, i) => sc.at(ts, () => {
            ring(sc, me.x, G - s, me.w * 0.5, me.w * (3 + i * 1.2), 0.22, 0.5, [MUD[0], MUD[2]], 2);
            groundArcs(sc, me.x, G - s, W * 0.35, 1.0, MUD[1], 4, 2, G - s);
            debris(me.x, G - s, s, MUD, 18, H * 0.7, { ground: G });
            ultShake(6 + i * 2, 400);
        }));
        // 진흙 해일
        sc.add({ max: TWAVE + WSEC + 0.4, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TWAVE) {
                return;
            }
            const k = (life - TWAVE) / WSEC;
            const hw = clamp(H * 0.45, me.h, G * 0.8) * (k < 0.2 ? k / 0.2 : 1);
            const fade = k > 1 ? 1 - (k - 1) / 0.28 : 1;
            K.waveFront(ctx, px, s, front(life), G, dir, hw, Math.max(W * 0.5, hw * 2.4), MUD, life, fade);
            // 실려 가는 바위
            for (let j = 0; j < 6; j++) {
                const d = (hash(j, 821) * 0.8 + 0.1) * Math.max(W * 0.5, hw * 2.4);
                const x = front(life) - dir * d;
                const y = G - hw * (1 - d / Math.max(W * 0.5, hw * 2.4)) * 0.8 + Math.sin(life * 4 + j) * s * 3;
                K.psyRock(ctx, px, s, x, y, Math.max(3 * s, me.w * 0.15), 0.3 * fade, MUD[1]);
            }
        } });
        sc.at(TWAVE, () => ultShake(6 + 2 * P, WSEC * 1000));
        sc.tick((t) => {
            if (t < TWAVE || t > TWAVE + WSEC) {
                return;
            }
            const xf = front(t);
            for (const r of u.others()) {
                if ((xf - r.x) * dir > 0 && (r.x - me.x) * dir > 0) {
                    hit(where(u, r), dir, 'tumble', 0.8);
                }
            }
        });
        sc.at(TB, () => {
            impactFrames(sc, W, H, 0.6, 0.4);
            blastDome(sc, clamp(me.x + dir * far * 0.7, W * 0.08, W * 0.92), G, clamp(Math.max(H * 0.48, W * 0.22), 30, Math.min(G * 0.92, W * 0.48)), 1.8, MUD);
            ultShake(9 + 3 * P, 1100);
            for (let i = 0; i < 30; i++) {
                debris(rnd(0, W), -s * 4, s, MUD, 1, H * 0.2, { angle: Math.PI / 2, spread: 0.4, ground: G, life: 1.4 });
            }
        });
    }

    // ═════ 나무킹 — 리프블레이드 (ultbarrage) ═════
    // 팔의 잎이 초록빛으로 길게 자라나 반짝 · 둘레로 잎이 소용돌이 → 과녁으로 초록 잔상을 남기며 번쩍번쩍 여러 번 벰(초록 초승달 자국)
    // → 뒤로 물러나 두 팔을 모아 화면을 가르는 거대한 잎 칼날 → 베인 자리에서 잎 폭풍 · 초록 빛의 반구 (약 7.0초)
    UNIQ.sceptile = { fx: 'ultbarrage', ms: (P) => 7000 + 200 * P, run: runLeafBlade };
    function runLeafBlade(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const VINEC = K.pal.VINE;
        const TC0 = 0.4;
        const NSL = 6;
        const TS0 = 1.4;
        const STEP = 0.2;
        const TBIG = TS0 + NSL * STEP + 0.35; // 거대한 잎 칼날
        const TB = TBIG + 0.3;
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * W * 0.4, W * 0.12, W * 0.88);
        const ty = q ? q.y : G - me.h * 0.5;
        const spots = [];
        for (let i = 0; i < NSL; i++) {
            const side = i % 2 ? -1 : 1;
            spots.push({ t: TS0 + i * STEP, x: clamp(tx + side * me.w * 0.8, me.w * 0.5, W - me.w * 0.5), a: (i % 3 - 1) * 0.6 + (side > 0 ? 0 : Math.PI) });
        }
        const sc = scene(u, sec + 0.4, 'uniq sceptile');
        ultDark(0.4, ms - 200);
        // 둘레 잎 소용돌이
        sc.add({ max: TS0 + 0.2, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - TC0) / 0.4, 0, 1) * (1 - clamp((life - TS0) / 0.2, 0, 1));
            for (let j = 0; j < 14; j++) {
                const an = life * 5 * dir + (j * TAU) / 14;
                const r = me.w * (0.8 + 0.2 * Math.sin(life * 3 + j));
                const path = new Path2D();
                K.petalAt(path, px, s, me.x + Math.cos(an) * r, me.b - me.h * 0.5 + Math.sin(an) * r * 0.5, s * 2, Math.sin(life * 8 + j) > 0);
                ctx.globalAlpha = k;
                ctx.fillStyle = j % 2 ? VINEC[1] : VINEC[2];
                ctx.fill(path);
            }
        } });
        // 나무킹 (꼭두각시) — 번쩍번쩍 · 돌아옴
        const img = pokemon.el;
        const edge = Math.max(1, Math.round(u.s * 0.75));
        hideMon(pokemon, true);
        hideUntil(pokemon, (sec - 0.1) * 1000 + 100);
        sc.at(sec - 0.12, () => hideMon(pokemon, false));
        const bx = clamp(tx - dir * me.w * 2, me.w * 0.5, W - me.w * 0.5);
        sc.add({ max: sec - 0.1, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life >= sec - 0.12) {
                return;
            }
            if (life < TS0) {
                drawLitMon(ctx, img, me.x, me.b, me.w, dir < 0, VINEC[1], edge, 1);
                if (life > TC0) {
                    drawMon(ctx, img, me.x, me.b, me.w, dir < 0, 0.15 * (1 + Math.sin(life * 10)), VINEC[0]);
                }
                return;
            }
            const i = spots.findIndex((p) => life >= p.t && life < p.t + STEP);
            if (i >= 0) {
                drawLitMon(ctx, img, spots[i].x, G, me.w, spots[i].x > tx, VINEC[1], edge, 1);
                return;
            }
            if (life < TB + 0.6) {
                drawLitMon(ctx, img, bx, G, me.w, bx > tx, VINEC[1], edge, 1);
                return;
            }
            const k = easeOut(clamp((life - TB - 0.6) / 0.5, 0, 1));
            drawLitMon(ctx, img, lerp(bx, me.x, k), lerp(G, me.b, k) - Math.sin(k * Math.PI) * me.h * 0.4, me.w, dir < 0, VINEC[1], edge, 1);
        } });
        // 초록 초승달 베기 자국
        const crescent = (ctx, px, x, y, R, ang, k, alpha) => {
            for (let i = 0; i <= 18; i++) {
                const f = i / 18;
                if (f > k) {
                    break;
                }
                const an = ang - 1.2 + 2.4 * f;
                const th = Math.sin(f * Math.PI) * Math.max(2 * s, R * 0.14);
                for (let d = R - th; d < R; d += s) {
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = d > R - s * 1.2 ? '#ffffff' : d > R - th * 0.5 ? VINEC[0] : VINEC[1];
                    ctx.fillRect(px(x + Math.cos(an) * d), px(y + Math.sin(an) * d), s, s);
                }
            }
        };
        spots.forEach((p, i) => {
            sc.add({ max: sec, draw: (ctx, it, t, px) => {
                const life = sc.t;
                const k = (life - p.t) / 0.3;
                if (k < 0 || k > 1) {
                    return;
                }
                crescent(ctx, px, tx, ty, Math.max(me.w, me.h) * 0.8, p.a, Math.min(1, k * 3), 1 - k);
            } });
            sc.at(p.t + 0.05, () => {
                ultShake(2, 90);
                fireBits(tx, ty, s, VINEC, 6, { speed: H * 0.4, life: 0.4 });
                if (q && i % 2 === 0) {
                    hit(where(u, q), Math.sign(q.x - p.x) || dir, 'shake', 0);
                }
            });
        });
        // 거대한 잎 칼날 — 화면을 비스듬히 가름
        sc.add({ max: TB + 0.6, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TBIG) {
                return;
            }
            const k = clamp((life - TBIG) / 0.18, 0, 1);
            const fade = clamp(1 - (life - TBIG - 0.4) / 0.5, 0, 1);
            const L = Math.hypot(W, H) * 0.9;
            const ang = dir > 0 ? 0.35 : Math.PI - 0.35;
            const ux = Math.cos(ang);
            const uy = Math.sin(ang);
            const x0 = tx - ux * L * 0.5;
            const y0 = ty - uy * L * 0.5;
            for (let d = 0; d < L * k; d += s) {
                const f = d / L;
                const w = Math.max(s, Math.round((Math.sin(f * Math.PI) * Math.max(me.h * 0.45, H * 0.08)) / s) * s);
                const x = x0 + ux * d;
                const y = y0 + uy * d;
                ctx.globalAlpha = fade;
                ctx.fillStyle = VINEC[3];
                ctx.fillRect(px(x), px(y - w / 2 - s), s, w + 2 * s);
                ctx.fillStyle = VINEC[1];
                ctx.fillRect(px(x), px(y - w / 2), s, w);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(px(x), px(y - w * 0.12), s, Math.max(s, w * 0.24));
            }
        } });
        sc.at(TBIG, () => {
            impactFrames(sc, W, H, 0.6, 0.4);
            ultShake(5, 300);
        });
        sc.at(TB, () => {
            blastDome(sc, tx, G, clamp(Math.max(H * 0.45, me.w * 2.8), 30, Math.min(G * 0.92, W * 0.45)), 1.8, VINEC);
            ultShake(9 + 3 * P, 1100);
            for (const r of u.others()) {
                sc.at(TB + 0.08, () => hit(where(u, r), away(u, tx), Math.abs(r.x - tx) < W * 0.2 ? 'tumble' : 'lift', 0.3));
            }
        });
        // 잎 폭풍 — 베인 자리에서 사방으로
        let leaf = 0;
        sc.tick((t, dt) => {
            if (t < TB || t > TB + 1.2) {
                return;
            }
            leaf += dt * 60;
            while (leaf >= 1 && room(1)) {
                leaf -= 1;
                const a = rnd(0, TAU);
                const sp = H * rnd(0.3, 0.9);
                sigParticle({ x: tx, y: ty, s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - H * 0.2, g: H * 0.3, drag: 1.4, max: rnd(0.8, 1.4), color: pick([VINEC[0], VINEC[1], VINEC[2]]), ph: rnd(0, TAU),
                    draw: (ctx, p, tt, px) => {
                        ctx.globalAlpha = Math.min(1, (1 - tt) * 3);
                        ctx.fillStyle = p.color;
                        const path = new Path2D();
                        K.petalAt(path, px, p.s, p.x, p.y, p.s * 2, Math.sin(p.life * 10 + p.ph) > 0);
                        ctx.fill(path);
                    } });
            }
            leaf = Math.min(leaf, 1);
        });
    }

    // ═════ 초염몽 — 블래스트번 (ultnova) ═════
    // 머리 불꽃이 왕관처럼 커짐 → 몸을 휘감는 불꽃 회오리로 빙글빙글 솟구침 → 땅을 내리치자 폭발이 양옆으로 줄지어 퍼져 나감(닿은 애 떠오름)
    // → 가운데 거대한 불꽃 폭발 · 주황빛 빛의 반구 (약 7.0초)
    UNIQ.infernape = { fx: 'ultnova', ms: (P) => 7000 + 200 * P, run: runInfernoBurn };
    function runInfernoBurn(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const FIRE = ['#ffffff', '#fff3a0', '#ff8a2a', '#c8201a'];
        const TCROWN = 0.3;
        const TSPIN = 1.0;
        const TUP = 1.6;
        const TSLAM = 2.4; // 내리침
        const NB = 6;
        const TB = TSLAM + NB * 0.12 + 0.4;
        const footAt = (t) => {
            if (t < TUP) {
                return me.b;
            }
            if (t < TSLAM - 0.2) {
                return me.b - me.h * 1.2 * easeOut((t - TUP) / (TSLAM - 0.2 - TUP));
            }
            if (t < TSLAM) {
                return lerp(me.b - me.h * 1.2, me.b, easeIn((t - TSLAM + 0.2) / 0.2));
            }
            return me.b;
        };
        const sc = scene(u, sec + 0.4, 'uniq infernape');
        ultDark(0.35, ms - 200);
        // 불꽃 왕관 · 회오리 (초염몽 뒤)
        sc.add({ max: TB + 0.3, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - TCROWN) / 0.4, 0, 1) * (1 - clamp((life - TB) / 0.3, 0, 1));
            if (k <= 0.02) {
                return;
            }
            K.flameTongue(ctx, px, s, me.x, footAt(life) - me.h * 0.6, me.w * 0.9, me.h * (0.8 + 0.6 * easeOut(clamp((life - TCROWN) / 0.8, 0, 1))), FIRE, life, k);
            if (life > TSPIN && life < TSLAM) {
                const kk = clamp((life - TSPIN) / 0.3, 0, 1);
                for (let j = 0; j < 10; j++) {
                    const f = j / 10;
                    const an = life * 14 * dir + j * 1.3;
                    const r = me.w * (0.5 + 0.4 * f);
                    const x = me.x + Math.cos(an) * r;
                    const y = footAt(life) - f * me.h * 1.6;
                    K.fireTail(ctx, px, s, x, y, -Math.sin(an) * dir, -0.3, me.w * 0.6, me.w * 0.25, FIRE, life + j, kk * (Math.sin(an) > 0 ? 1 : 0.5));
                }
            }
        } });
        puppet(sc, pokemon, u, footAt, FIRE[2], sec - 0.1, { rot: (t) => (t > TSPIN && t < TSLAM - 0.2 ? Math.sin(t * 20) * 0.3 : 0), glow: (t) => (t > TSLAM - 0.02 && t < TSLAM + 0.1 ? 0.7 : clamp((t - TCROWN) / 0.6, 0, 1) * 0.12 * (1 + Math.sin(t * 12))), glowColor: FIRE[1] });
        sc.at(TUP, () => {
            ring(sc, me.x, G - s, me.w * 0.4, me.w * 2.4, 0.25, 0.4, ['#ffffff', FIRE[2]], 2);
            ultShake(3, 250);
        });
        // 내리침 — 양옆으로 줄지은 폭발
        sc.at(TSLAM, () => {
            impactFrames(sc, W, H, 0.7, 0.45);
            ring(sc, me.x, G - s, me.w * 0.5, W * 0.6, 0.22, 0.6, ['#ffffff', FIRE[1], FIRE[2]], 3);
            groundArcs(sc, me.x, G - s, W * 0.5, 1.0, FIRE[1], 6, 2, G - s);
            ultShake(7, 600);
        });
        for (let i = 0; i < NB; i++) {
            for (const sd of [-1, 1]) {
                const x = me.x + sd * (me.w * 0.8 + i * Math.max(me.w * 0.8, W * 0.08));
                if (x < -s * 4 || x > W + s * 4) {
                    continue;
                }
                sc.at(TSLAM + 0.1 + i * 0.12, () => {
                    const R = Math.max(5 * s, me.w * (0.45 + 0.05 * i));
                    sc.add({ max: 0.6, draw: (ctx, q, tt, px) => {
                        fireOrb(ctx, px, s, x, G, R, FIRE, q.life + x, easeOut(Math.min(1, tt / 0.25)), G + s, tt > 0.7 ? (1 - tt) / 0.3 : 1, clamp((tt - 0.25) / 0.6, 0, 1));
                    } });
                    fireBits(x, G - s, s, FIRE, 10, { angle: -Math.PI / 2, spread: 1.6, speed: H * 0.6, g: H * 1.5, life: 0.6 });
                    ultShake(3, 120);
                    for (const r of u.others()) {
                        if (Math.abs(r.x - x) < R + r.w * 0.4) {
                            hit(where(u, r), sd, 'lift', 0.6);
                        }
                    }
                });
            }
        }
        sc.at(TB, () => {
            impactFrames(sc, W, H, 0.75, 0.5);
            blastDome(sc, me.x, G, clamp(Math.max(H * 0.52, W * 0.25), 30, Math.min(G * 0.92, W * 0.5)), 1.9, FIRE);
            ultShake(10 + 3 * P, 1200);
        });
        emberRise(sc, TB + 0.3, sec, FIRE);
    }

    // ═════ 엠페르트 — 하이드로캐논 (ultbeam) ═════
    // 삼지창 볏이 번쩍 · 강철 날개가 펼쳐지며 은빛 칼날 반짝 → 부리 앞에 물이 소용돌이치며 모임
    // → 임팩트 프레임 · 물줄기 두 가닥이 꼬인 회전 물 드릴이 과녁을 뚫음(드릴 앞에 은빛 고리 · 나선 물보라) → 물빛 빛의 반구 (약 7.0초)
    UNIQ.empoleon = { fx: 'ultbeam', ms: (P) => 7000 + 200 * P, run: runDrillCannon };
    function runDrillCannon(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TIDE = K.pal.TIDE;
        const TCREST = 0.4;
        const TWING = 0.9;
        const TC0 = 1.2;
        const TF = 2.3;
        const FIRE = 1.3;
        const TB = TF + FIRE + 0.1;
        const [mx, my] = [u.mouth.x + dir * s * 2, u.mouth.y];
        const far = dir > 0 ? W - mx : mx;
        const ty = Math.min(my + far * 0.1, G - me.h * 0.3);
        const dyU = (ty - my) / Math.max(1, far);
        const bw = clamp(H * 0.09 * (0.9 + 0.3 * P), 6 * s, H * 0.15);
        const speed = Math.max(far / 0.5, 600);
        const frontAt = (t) => clamp((t - TF) * speed, 0, far);
        const q = nearest(u);
        const bx = q && Math.sign(q.x - me.x) === dir ? q.x : mx + dir * far * 0.8;
        const sc = scene(u, sec + 0.4, 'uniq empoleon');
        ultDark(0.4, ms - 200);
        puppet(sc, pokemon, u, () => me.b, TIDE[2], sec - 0.1, { glow: (t) => (t > TCREST && t < TCREST + 0.12 ? 0.6 : clamp((t - TC0) / 0.8, 0, 1) * (t < TF ? 0.12 * (1 + Math.sin(t * 10)) : 0)), glowColor: '#ffffff' });
        // 볏 번쩍 · 날개 칼날 반짝
        sc.add({ max: TF, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const c = clamp(1 - Math.abs(life - TCREST - 0.1) / 0.15, 0, 1);
            if (c > 0) {
                glint(ctx, px, s, me.x + dir * me.w * 0.1, me.b - me.h * 0.95, me.w * 0.4 * c, c);
            }
            const w = clamp((life - TWING) / 0.3, 0, 1);
            if (w > 0) {
                for (const sd of [-1, 1]) {
                    const x0 = me.x + sd * me.w * 0.35;
                    const y0 = me.b - me.h * 0.5;
                    for (let d = 0; d < me.w * 0.7 * w; d += s) {
                        ctx.globalAlpha = 0.9;
                        ctx.fillStyle = d > me.w * 0.5 ? '#ffffff' : '#c8d4e0';
                        ctx.fillRect(px(x0 + sd * d), px(y0 - d * 0.6), s, s * 2);
                    }
                    if (Math.floor(life * 8) % 3 === 0) {
                        glint(ctx, px, s, x0 + sd * me.w * 0.6 * w, y0 - me.w * 0.36 * w, me.w * 0.15, 0.9);
                    }
                }
            }
        } });
        chargeSwirl(sc, () => [mx, my], TC0, TF - 0.05, Math.max(me.w * 3.5, short(u) * 0.42), Math.max(s * 4, bw * 0.5), TIDE, dir);
        sc.add({ max: TF + FIRE + 0.2, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TC0) {
                return;
            }
            const k = easeOut((life - TC0) / (TF - TC0)) * (1 + 0.08 * Math.sin(life * 20));
            fireOrb(ctx, px, s, mx, my, bw * 0.6, TIDE, life, k, G, life > TF + FIRE ? 1 - (life - TF - FIRE) / 0.2 : 1, 0, [1, 0.8, 0.6, 0.38], 0.3);
        } });
        sc.at(TF, () => {
            impactFrames(sc, W, H, 0.7, 0.45);
            ultShake(5 + 2 * P, FIRE * 1000);
        });
        // 회전 물 드릴 — 두 가닥이 꼬임
        sc.add({ max: TF + FIRE + 0.25, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TF) {
                return;
            }
            const front = frontAt(life);
            const fade = life > TF + FIRE ? 1 - (life - TF - FIRE) / 0.25 : 1;
            for (let strand = 0; strand < 2; strand++) {
                for (let d = 0; d < front; d += s) {
                    const ph = d / (bw * 0.8) - life * 22 + strand * Math.PI;
                    const r = bw * 0.55 * Math.min(1, d / (bw * 2) + 0.3);
                    const x = mx + dir * d;
                    const y = my + dyU * d + Math.sin(ph) * r;
                    const frontSide = Math.cos(ph) > 0;
                    const z = frontSide ? 3 : 2;
                    ctx.globalAlpha = (frontSide ? 1 : 0.55) * fade;
                    ctx.fillStyle = frontSide ? (strand ? '#ffffff' : TIDE[1]) : TIDE[3];
                    ctx.fillRect(px(x), px(y - (z * s) / 2), s, z * s);
                }
            }
            beamBody(ctx, px, s, mx, my, dir / Math.hypot(1, dyU), dyU / Math.hypot(1, dyU), front * Math.hypot(1, dyU), bw * 0.45 * fade, TIDE, life, 0.8, G);
            // 드릴 앞 은빛 고리 · 나선 물보라
            const fx = mx + dir * front;
            const fy = my + dyU * front;
            for (let a = 0; a < TAU; a += 0.3) {
                const an = a + life * 15;
                ctx.globalAlpha = 0.9 * fade;
                ctx.fillStyle = Math.round(a / 0.3) % 2 ? '#e0e8f0' : '#ffffff';
                ctx.fillRect(px(fx + Math.cos(an) * bw * 0.25), px(fy + Math.sin(an) * bw * 0.85), s, s);
            }
        } });
        sc.tick((t) => {
            if (t < TF || t > TF + FIRE) {
                return;
            }
            const front = frontAt(t);
            for (const r of u.others()) {
                const d = (r.x - mx) * dir;
                if (d > 0 && d < front + r.w * 0.5) {
                    hit(where(u, r), dir, 'spin');
                }
            }
            if (Math.random() < 0.4) {
                K.splash(mx + dir * front, my + dyU * front, s, TIDE, 2, H * 0.4);
            }
        });
        sc.at(TB, () => {
            impactFrames(sc, W, H, 0.6, 0.4);
            blastDome(sc, clamp(bx, W * 0.08, W * 0.92), G, clamp(Math.max(H * 0.45, bw * 4), 30, Math.min(G * 0.92, W * 0.45)), 1.8, TIDE);
            K.crownSplash(sc, clamp(bx, W * 0.08, W * 0.92), G, Math.max(bw * 2, H * 0.15), 0.9, TIDE);
            ultShake(8 + 2 * P, 1000);
        });
        K.waterRain(sc, TB + 0.5, sec - 0.2, TIDE);
    }

    // ═════ 토대부기 — 하드플랜트 (ultpillar) ═════
    // 등의 나무가 쑥쑥 자라 거대한 나무가 됨(잎 무리가 커짐) · 땅이 우르릉 → 앞쪽 땅 곳곳에서 커다란 나무들이 차례로 솟아남(줄기 · 잎 무리 · 흙)
    // → 나무마다 잎이 우수수 · 닿은 애 떠오름 → 초록 빛의 반구 · 잎비 (약 7.2초)
    UNIQ.torterra = { fx: 'ultpillar', ms: (P) => 7200 + 200 * P, run: runTorterraPlant };
    function runTorterraPlant(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const VINEC = K.pal.VINE;
        const BARKC = K.pal.BARK;
        const TGROW = 0.3;
        const TT0 = 1.8;
        const NT = 5;
        const far = dir > 0 ? W - me.x : me.x;
        const trees = [];
        for (let i = 0; i < NT; i++) {
            const d = me.w * 0.9 + (far - me.w * 0.9) * ((i + 0.5) / NT);
            trees.push({ x: clamp(me.x + dir * d, s * 6, W - s * 6), h: Math.min(G * 0.8, H * (0.35 + 0.3 * ((i + 1) / NT))), t0: TT0 + i * 0.22, seed: hash(i, 831) * 99 });
        }
        const TB = trees[NT - 1].t0 + 0.9;
        const sc = scene(u, sec + 0.4, 'uniq torterra');
        ultDark(0.3, ms - 200);
        // 잎 무리 — 둥근 초록 덩이 여럿 (밝은 왼쪽 위)
        const canopy = (ctx, px, x, y, R, k, seed, life) => {
            if (R * k < s * 2) {
                return;
            }
            const blobs = [[0, 0, 1], [-0.6, 0.2, 0.7], [0.6, 0.2, 0.7], [-0.3, -0.45, 0.65], [0.35, -0.4, 0.6]];
            for (const [bx, by, br] of blobs) {
                const sway = Math.sin(life * 2 + seed + bx) * s;
                ellipse(ctx, px, s, x + bx * R * k + sway, y + by * R * k, br * R * k, br * R * k * 0.85, VINEC[3], 1);
                ellipse(ctx, px, s, x + bx * R * k + sway - br * R * k * 0.15, y + by * R * k - br * R * k * 0.15, br * R * k * 0.75, br * R * k * 0.62, VINEC[2], 1);
                ellipse(ctx, px, s, x + bx * R * k + sway - br * R * k * 0.3, y + by * R * k - br * R * k * 0.3, br * R * k * 0.35, br * R * k * 0.3, VINEC[1], 1);
            }
        };
        const trunk = (ctx, px, x, hgt, w) => {
            for (let y = 0; y < hgt; y += s) {
                const ww = w * (1 - (y / hgt) * 0.4) * (y < s * 3 ? 1.4 : 1);
                ctx.globalAlpha = 1;
                ctx.fillStyle = BARKC[1];
                ctx.fillRect(px(x - ww / 2), px(G - y - s), Math.max(s, px(ww)), s);
                ctx.fillStyle = BARKC[2];
                ctx.fillRect(px(x - ww / 2), px(G - y - s), Math.max(s, px(ww * 0.3)), s);
                ctx.fillStyle = BARKC[0];
                ctx.fillRect(px(x + ww * 0.25), px(G - y - s), Math.max(s, px(ww * 0.25)), s);
            }
        };
        // 등의 나무 — 쑥쑥
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = easeOut(clamp((life - TGROW) / 1.2, 0, 1)) * (1 - easeIn(clamp((life - (sec - 0.7)) / 0.5, 0, 1)));
            if (k > 0.02) {
                canopy(ctx, px, me.x, me.b - me.h * (0.95 + 0.4 * k), Math.max(me.w * 0.45, me.w * 0.9 * k), 1, 7, life);
            }
        } });
        puppet(sc, pokemon, u, () => me.b, VINEC[2], sec - 0.1, { glow: (t) => clamp((t - 0.2) / 0.5, 0, 1) * 0.12 * (1 + Math.sin(t * 6)), glowColor: VINEC[0] });
        [1.0, 1.4].forEach((ts, i) => sc.at(ts, () => {
            ring(sc, me.x, G - s, me.w * 0.5, me.w * (3 + i), 0.22, 0.45, [VINEC[0], VINEC[2]], 2);
            groundArcs(sc, me.x, G - s, far, 1.0, VINEC[1], 3, 1, G - s);
            ultShake(4 + i * 2, 400);
        }));
        // 솟는 나무
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            for (const tr of trees) {
                if (life < tr.t0) {
                    continue;
                }
                const k = easeOut((life - tr.t0) / 0.35);
                const fall = clamp((life - (sec - 0.8)) / 0.6, 0, 1);
                const hgt = tr.h * k * (1 - fall);
                trunk(ctx, px, tr.x, hgt * 0.65, Math.max(3 * s, tr.h * 0.1));
                canopy(ctx, px, tr.x, G - hgt * 0.75, tr.h * 0.32, k * (1 - fall), tr.seed, life);
            }
        } });
        trees.forEach((tr) => sc.at(tr.t0, () => {
            debris(tr.x, G - s, s, ['#8a7252', '#5c4a33', VINEC[2]], 12, H * 0.6, { ground: G });
            ring(sc, tr.x, G - s, s * 4, tr.h * 0.6, 0.25, 0.4, [VINEC[0], VINEC[2]], 2);
            ultShake(3, 160);
            for (const r of u.others()) {
                if (Math.abs(r.x - tr.x) < tr.h * 0.25 + r.w * 0.4) {
                    hit(where(u, r), away(u, me.x), 'lift', 0.6);
                }
            }
        }));
        sc.at(TB, () => {
            impactFrames(sc, W, H, 0.6, 0.4);
            const last = trees[NT - 1];
            blastDome(sc, clamp(last.x, W * 0.08, W * 0.92), G, clamp(Math.max(H * 0.45, W * 0.22), 30, Math.min(G * 0.92, W * 0.45)), 1.8, VINEC);
            ultShake(8 + 2 * P, 1000);
        });
        // 잎비
        let leaf = 0;
        sc.tick((t, dt) => {
            if (t < TT0 + 0.5 || t > sec - 0.5) {
                return;
            }
            leaf += dt * 22;
            while (leaf >= 1 && room(1)) {
                leaf -= 1;
                sigParticle({ x: rnd(0, W), y: -s * 2, s, vx: rnd(-20, 20), vy: H * rnd(0.15, 0.3), max: rnd(1.5, 2.4), color: pick([VINEC[1], VINEC[2], VINEC[0]]), ph: rnd(0, TAU),
                    update: (p, dt2) => {
                        p.vx = Math.sin(p.life * 3 + p.ph) * 30;
                    },
                    draw: (ctx, p, tt, px) => {
                        ctx.globalAlpha = Math.min(1, (1 - tt) * 3);
                        ctx.fillStyle = p.color;
                        const path = new Path2D();
                        K.petalAt(path, px, p.s, p.x, p.y, p.s * 2, Math.sin(p.life * 8 + p.ph) > 0);
                        ctx.fill(path);
                    } });
            }
            leaf = Math.min(leaf, 1);
        });
    }

    // ═════ 라티오스 — 러스터퍼지 (ultbeam) ═════
    // 하늘로 떠올라 푸른 제트 꼬리를 끌며 화면을 크게 가로질러 날았다 돌아옴 → 가슴 앞에 하얀 · 푸른 빛 구가 커짐(빛이 빨려 듦)
    // → 임팩트 프레임 · 하얀 심의 굵은 빛줄기 · 지나간 자리에 빛가루 → 푸른 빛의 반구 (약 7.2초)
    const LUSTER = ['#ffffff', '#d8ecff', '#6aa8ff', '#2a4ab8'];
    UNIQ.latios = { fx: 'ultbeam', ms: (P) => 7200 + 200 * P, run: runLusterPurge };
    function runLusterPurge(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TJ0 = 0.3;
        const JET = 1.3; // 제트 비행
        const TC0 = TJ0 + JET + 0.1;
        const TF = TC0 + 1.0;
        const FIRE = 1.3;
        const TB = TF + FIRE + 0.1;
        const hoverY = me.b - me.h * 0.4;
        const posAt = (t) => {
            if (t < TJ0) {
                return [me.x, lerp(me.b, hoverY, easeOut(t / TJ0))];
            }
            if (t < TJ0 + JET) {
                const k = (t - TJ0) / JET;
                const an = Math.PI + k * TAU * dir;
                const rx = W * 0.38;
                const ry = H * 0.22;
                const cx = clamp(me.x + dir * rx * 0.95, rx * 0.6, W - rx * 0.6);
                return [cx + Math.cos(an) * rx * (1 - 0.05 * Math.sin(k * 9)), hoverY - ry * 0.3 + Math.sin(an) * ry];
            }
            if (t < sec - 0.6) {
                return [me.x, hoverY + Math.sin(t * 3) * s * 1.5];
            }
            return [me.x, lerp(hoverY, me.b, easeOut(clamp((t - (sec - 0.6)) / 0.45, 0, 1)))];
        };
        const core = (t) => {
            const [x, b] = posAt(t);
            return [x + dir * me.w * 0.55, b - me.h * 0.45];
        };
        const bw = clamp(H * 0.12 * (0.9 + 0.3 * P), 8 * s, H * 0.2);
        const q = nearest(u);
        const bx = q && Math.sign(q.x - me.x) === dir ? q.x : me.x + dir * W * 0.6;
        const sc = scene(u, sec + 0.4, 'uniq latios');
        ultDark(0.45, ms - 200);
        // 제트 꼬리
        sc.add({ max: TJ0 + JET + 0.6, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TJ0) {
                return;
            }
            const end = Math.min(life, TJ0 + JET);
            const fade = 1 - clamp((life - TJ0 - JET) / 0.6, 0, 1);
            for (let tt = Math.max(TJ0, end - 0.5); tt < end; tt += 0.01) {
                const [x, b] = posAt(tt);
                const age = end - tt;
                ctx.globalAlpha = (1 - age / 0.5) * fade;
                ctx.fillStyle = age < 0.08 ? '#ffffff' : age < 0.25 ? LUSTER[2] : LUSTER[3];
                const z = Math.max(s, Math.round((me.h * 0.2 * (1 - age / 0.5)) / s) * s);
                ctx.fillRect(px(x - z / 2), px(b - me.h * 0.5 - z / 2), z, z);
            }
        } });
        // 라티오스 (꼭두각시)
        const img = pokemon.el;
        const edge = Math.max(1, Math.round(u.s * 0.75));
        hideMon(pokemon, true);
        hideUntil(pokemon, (sec - 0.1) * 1000 + 100);
        sc.at(sec - 0.12, () => hideMon(pokemon, false));
        sc.add({ max: sec - 0.1, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life >= sec - 0.12) {
                return;
            }
            const [x, b] = posAt(life);
            const [x2, b2] = posAt(life + 0.02);
            const lf = Math.abs(x2 - x) > 0.5 ? x2 < x : dir < 0;
            const rot = life > TJ0 && life < TJ0 + JET ? clamp((b2 - b) / Math.max(1, Math.abs(x2 - x)), -0.6, 0.6) * (lf ? -1 : 1) : 0;
            drawLitMon(ctx, img, x, b, me.w, lf, LUSTER[2], edge, 1, rot);
            if (life > TC0 && life < TF + 0.1) {
                drawMon(ctx, img, x, b, me.w, lf, 0.15 * (1 + Math.sin(life * 12)), LUSTER[1], rot);
            }
        } });
        chargeSwirl(sc, core, TC0, TF - 0.05, Math.max(me.w * 3.5, short(u) * 0.42), Math.max(s * 4, bw * 0.45), LUSTER, dir);
        sc.add({ max: TF + FIRE + 0.2, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TC0) {
                return;
            }
            const [x, y] = core(life);
            const k = easeOut((life - TC0) / (TF - TC0)) * (1 + 0.08 * Math.sin(life * 20));
            fireOrb(ctx, px, s, x, y, bw * 0.65, LUSTER, life, k, G, life > TF + FIRE ? 1 - (life - TF - FIRE) / 0.2 : 1, 0, [1, 0.8, 0.6, 0.38], 0.3);
        } });
        sc.at(TF, () => {
            impactFrames(sc, W, H, 0.75, 0.45);
            ultShake(5 + 2 * P, FIRE * 1000);
        });
        sc.add({ max: TF + FIRE + 0.25, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TF) {
                return;
            }
            const [x0, y0] = core(life);
            const far = dir > 0 ? W - x0 : x0;
            const front = Math.min(far, (life - TF) * Math.max(1500, W * 3.6));
            const ty = G - bw * 0.7;
            const dy = (ty - y0) / Math.max(1, far);
            const L = Math.hypot(1, dy);
            const fade = life > TF + FIRE ? 1 - (life - TF - FIRE) / 0.25 : 1;
            beamBody(ctx, px, s, x0, y0, dir / L, dy / L, front * L, bw * (0.95 + 0.05 * Math.sin(life * 40)) * fade, LUSTER, life, 1, G);
            for (let j = 0; j < 12; j++) {
                const d = ((life * 0.7 + j / 12) % 1) * front;
                glint(ctx, px, s, x0 + dir * d, y0 + dy * d + Math.sin(j * 2.3 + life * 5) * bw * 0.9, bw * 0.25, 0.8 * fade);
            }
        } });
        sc.tick((t) => {
            if (t < TF || t > TF + FIRE) {
                return;
            }
            for (const r of u.others()) {
                if ((r.x - me.x) * dir > 0) {
                    hit(where(u, r), dir, 'tumble');
                }
            }
        });
        sc.at(TB, () => {
            impactFrames(sc, W, H, 0.6, 0.4);
            blastDome(sc, clamp(bx, W * 0.08, W * 0.92), G, clamp(Math.max(H * 0.48, bw * 3.5), 30, Math.min(G * 0.92, W * 0.48)), 1.9, LUSTER);
            ultShake(8 + 2 * P, 1000);
        });
        emberRise(sc, TB + 0.4, sec, LUSTER);
    }

    // ═════ 라티아스 — 미스트볼 (ultorb) ═════
    // 몸이 빛을 굴절시켜 투명하게 일렁 · 분홍 · 하얀 안개가 땅에 깔리며 밀려옴 → 두 손 앞에 깃털 같은 솜털이 소용돌이치는 안개 구가 커짐
    // → 과녁으로 던짐(안개 꼬리) → 펑 — 반짝이는 안개구름이 퍼지며 분홍 빛의 반구 (약 7.0초)
    const MIST = ['#ffffff', '#fff0f8', '#ffc0e0', '#c86aa8'];
    UNIQ.latias = { fx: 'ultorb', ms: (P) => 7000 + 200 * P, run: runMistBall };
    function runMistBall(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const lift = me.h * 0.3;
        const TFADE = 0.3;
        const TC0 = 1.0;
        const TT = 2.6; // 던짐
        const FLY = 0.55;
        const TB = TT + FLY;
        const footAt = (t) => me.b - lift * easeOut(clamp((t - 0.2) / 0.5, 0, 1)) * (1 - easeIn(clamp((t - (sec - 0.6)) / 0.45, 0, 1))) + Math.sin(t * 3) * s * 1.5;
        const hand = (t) => [me.x + dir * me.w * 0.55, footAt(t) - me.h * 0.5];
        const Rb = clamp(me.w * 0.45, 5 * s, H * 0.12);
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * W * 0.45, W * 0.1, W * 0.9);
        const sc = scene(u, sec + 0.4, 'uniq latias');
        ultDark(0.4, ms - 200);
        // 밀려오는 안개 — 땅에 깔린 둥근 안개 띠
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp((life - 0.3) / 0.8, 0, 1) * clamp((sec - 0.3 - life) / 0.6, 0, 1);
            if (a <= 0.01) {
                return;
            }
            const c = Math.max(s, Math.round(short(u) / 80));
            const paths = [new Path2D(), new Path2D()];
            for (let x = 0; x < W; x += c) {
                const hgt = H * (0.08 + 0.05 * Math.sin(x * 0.02 + life * 0.8) + 0.03 * Math.sin(x * 0.05 - life * 1.2));
                paths[0].rect(Math.round(x / c) * c, Math.round((G - hgt) / c) * c, c, Math.round(hgt / c) * c + c);
                paths[1].rect(Math.round(x / c) * c, Math.round((G - hgt * 0.5) / c) * c, c, Math.round((hgt * 0.5) / c) * c + c);
            }
            ctx.globalAlpha = 0.3 * a;
            ctx.fillStyle = MIST[2];
            ctx.fill(paths[0]);
            ctx.globalAlpha = 0.35 * a;
            ctx.fillStyle = MIST[1];
            ctx.fill(paths[1]);
        } });
        // 라티아스 (꼭두각시) — 투명하게 일렁
        const img = pokemon.el;
        const edge = Math.max(1, Math.round(u.s * 0.75));
        hideMon(pokemon, true);
        hideUntil(pokemon, (sec - 0.1) * 1000 + 100);
        sc.at(sec - 0.12, () => hideMon(pokemon, false));
        sc.add({ max: sec - 0.1, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life >= sec - 0.12) {
                return;
            }
            const clear = clamp((life - TFADE) / 0.4, 0, 1) * (1 - clamp((life - TT) / 0.3, 0, 1));
            const a = 1 - 0.55 * clear * (0.7 + 0.3 * Math.sin(life * 6));
            const wob = Math.sin(life * 9) * s * clear;
            drawLitMon(ctx, img, me.x + wob, footAt(life), me.w, dir < 0, MIST[2], edge, a);
        } });
        // 안개 구 — 깃털 솜털 소용돌이
        const mistBall = (ctx, px, x, y, R, life, a = 1) => {
            fireOrb(ctx, px, s, x, y, R, MIST, life, 1, G, 0.85 * a, 0, [1.1, 0.9, 0.7, 0.45], 0.2);
            for (let j = 0; j < 10; j++) {
                const an = life * 6 + (j * TAU) / 10;
                const rr = R * (0.4 + 0.5 * ((j % 3) / 2));
                ctx.globalAlpha = 0.9 * a;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(px(x + Math.cos(an) * rr), px(y + Math.sin(an) * rr), s * 2, s);
            }
        };
        chargeSwirl(sc, hand, TC0, TT - 0.05, Math.max(me.w * 3.5, short(u) * 0.42), Math.max(s * 4, Rb * 0.6), MIST, dir);
        sc.add({ max: TB + 0.02, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TC0) {
                return;
            }
            if (life < TT) {
                const [x, y] = hand(life);
                mistBall(ctx, px, x, y, Rb * easeOut((life - TC0) / (TT - TC0)) * (1 + 0.06 * Math.sin(life * 18)), life);
                return;
            }
            const k = (life - TT) / FLY;
            const [x0, y0] = hand(TT);
            const x = lerp(x0, tx, k);
            const y = lerp(y0, G - Rb, k * k) - Math.sin(k * Math.PI) * H * 0.06;
            for (let j = 1; j < 6; j++) {
                const kk = Math.max(0, k - j * 0.05);
                mistBall(ctx, px, lerp(x0, tx, kk), lerp(y0, G - Rb, kk * kk) - Math.sin(kk * Math.PI) * H * 0.06, Rb * (1 - j * 0.12), life, 0.3);
            }
            mistBall(ctx, px, x, y, Rb, life);
        } });
        sc.at(TT, () => {
            impactFrames(sc, W, H, 0.5, 0.3);
            ultShake(3, 200);
        });
        sc.at(TB, () => {
            impactFrames(sc, W, H, 0.6, 0.35);
            blastDome(sc, tx, G, clamp(Math.max(H * 0.45, W * 0.22), 30, Math.min(G * 0.92, W * 0.48)), 1.8, MIST);
            for (let j = 0; j < 8; j++) {
                K.puff(tx + rnd(-1, 1) * W * 0.15, G - rnd(0.1, 0.5) * H * 0.4, s, j % 2 ? MIST[1] : MIST[2], W * 0.03, W * 0.09, rnd(1, 1.6), rnd(-30, 30), -rnd(5, 20), 0.35);
            }
            sparkles(tx, G - H * 0.2, s, MIST, 24, W * 0.15, H * 0.2);
            ultShake(8 + 2 * P, 1000);
            for (const r of u.others()) {
                sc.at(TB + 0.1, () => hit(where(u, r), away(u, tx), 'lift', 0.3));
            }
        });
        emberRise(sc, TB + 0.4, sec, MIST);
    }

    // ═════ 지라치 — 파멸의소원 (ultskyfall) ═════
    // 머리의 소원 쪽지가 빛나고 배의 셋째 눈이 번쩍 뜨임 → 하늘로 빛줄기를 쏘아 올림 → 잠깐 정적 · 밤하늘에 별이 하나둘
    // → 하늘에서 빛기둥이 화면 곳곳에 차례로 쏟아짐(별 모양 반짝 · 다 맞음) → 마지막에 커다란 별이 떨어져 금빛 빛의 반구 (약 7.4초)
    const WISH = ['#ffffff', '#fff8c0', '#ffe14d', '#5aa0ff'];
    UNIQ.jirachi = { fx: 'ultskyfall', ms: (P) => 7400 + 200 * P, run: runDoomDesire };
    function runDoomDesire(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const lift = me.h * 0.4;
        const TEYE = 0.8;
        const TUP = 1.5;
        const TQUIET = TUP + 0.4;
        const TRAIN = TQUIET + 0.8;
        const NL = clamp(Math.round(W / 60), 6, 12);
        const TBIG = TRAIN + NL * 0.14 + 0.4;
        const footAt = (t) => me.b - lift * easeOut(clamp((t - 0.2) / 0.5, 0, 1)) * (1 - easeIn(clamp((t - (sec - 0.6)) / 0.45, 0, 1))) + Math.sin(t * 3) * s * 1.5;
        const spots = u.others().map((r) => ({ r, x: r.x }));
        while (spots.length < NL) {
            spots.push({ x: W * (0.06 + 0.88 * hash(spots.length, 841)) });
        }
        const q = nearest(u);
        const bigX = clamp(q ? q.x : me.x + dir * W * 0.45, W * 0.1, W * 0.9);
        const sc = scene(u, sec + 0.4, 'uniq jirachi');
        ultDark(0.5, ms - 200);
        // 밤하늘 별
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp((life - TQUIET) / 0.6, 0, 1) * clamp((sec - 0.3 - life) / 0.6, 0, 1);
            if (a <= 0.01) {
                return;
            }
            for (let j = 0; j < 30; j++) {
                if (life - TQUIET < j * 0.04) {
                    continue;
                }
                const x = hash(j, 851) * W;
                const y = hash(j, 852) * G * 0.6;
                const tw = Math.sin(life * (3 + 3 * hash(j, 853)) + j);
                glint(ctx, px, s, x, y, s * (1.5 + tw), 0.85 * a);
            }
        } });
        puppet(sc, pokemon, u, footAt, WISH[2], sec - 0.1, { glow: (t) => (t > TEYE && t < TEYE + 0.15 ? 0.7 : clamp((t - 0.3) / 0.6, 0, 1) * (t < TUP ? 0.15 * (1 + Math.sin(t * 9)) : 0)), glowColor: WISH[1] });
        // 셋째 눈 · 쪽지
        sc.add({ max: TQUIET, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const e = clamp((life - TEYE) / 0.2, 0, 1) * (1 - clamp((life - TQUIET + 0.2) / 0.2, 0, 1));
            if (e > 0) {
                glint(ctx, px, s, me.x, footAt(life) - me.h * 0.4, me.w * 0.5 * e, e);
            }
            const tg = clamp((life - 0.3) / 0.4, 0, 1);
            for (const sd of [-1, 0, 1]) {
                glint(ctx, px, s, me.x + sd * me.w * 0.25, footAt(life) - me.h * 0.95, me.w * 0.12 * tg, 0.8 * tg);
            }
        } });
        // 하늘로 빛줄기
        sc.add({ max: TQUIET + 0.2, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TUP) {
                return;
            }
            const y0 = footAt(TUP) - me.h;
            const k = easeOut((life - TUP) / 0.2);
            const fade = 1 - clamp((life - TUP - 0.3) / 0.3, 0, 1);
            beamBody(ctx, px, s, me.x, y0, 0, -1, (y0 + s) * k, Math.max(4 * s, me.w * 0.35) * fade, WISH, life, 1);
        } });
        sc.at(TUP, () => {
            impactFrames(sc, W, H, 0.5, 0.3);
            ultShake(3, 250);
        });
        // 빛기둥 비
        spots.slice(0, NL).forEach((sp, i) => {
            const t0 = TRAIN + i * 0.14;
            sc.add({ max: sec, draw: (ctx, it, t, px) => {
                const life = sc.t;
                const k = (life - t0) / 0.5;
                if (k < 0 || k > 1) {
                    return;
                }
                const x = sp.r ? where(u, sp.r).x : sp.x;
                const hw = Math.max(3 * s, W * 0.03) * (1 - k * 0.6);
                const a = 1 - k;
                ctx.globalAlpha = 0.5 * a;
                ctx.fillStyle = WISH[2];
                ctx.fillRect(px(x - hw), 0, px(2 * hw), G);
                ctx.globalAlpha = 0.95 * a;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(px(x - hw * 0.35), 0, px(hw * 0.7), G);
                glint(ctx, px, s, x, G - s * 3, hw * 2.2, a);
            } });
            sc.at(t0, () => {
                const x = sp.r ? where(u, sp.r).x : sp.x;
                ring(sc, x, G - s, s * 2, W * 0.08, 0.25, 0.4, ['#ffffff', WISH[2]], 2);
                sparkles(x, G - H * 0.1, s, WISH, 8, W * 0.03, H * 0.15);
                ultShake(2.5, 120);
                if (sp.r) {
                    hit(where(u, sp.r), away(u, x), 'lift', 0.5);
                }
            });
        });
        // 커다란 별
        sc.add({ max: TBIG + 0.05, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TBIG - 0.6) {
                return;
            }
            const k = easeIn(clamp((life - TBIG + 0.6) / 0.6, 0, 1));
            const x = lerp(bigX - dir * W * 0.2, bigX, k);
            const y = lerp(-H * 0.1, G - me.h * 0.5, k);
            const dx = dir * W * 0.2;
            const dy = G - me.h * 0.5 + H * 0.1;
            const L = Math.hypot(dx, dy) || 1;
            K.fireTail(ctx, px, s, x, y, dx / L, dy / L, H * 0.5, Math.max(8 * s, me.w * 0.9), WISH, life, 1);
            starOutline(ctx, px, s, x, y, Math.max(6 * s, me.w * 0.6), life * 4, 1, WISH, 1);
        } });
        sc.at(TBIG, () => {
            impactFrames(sc, W, H, 0.8, 0.5);
            blastDome(sc, bigX, G, clamp(Math.max(H * 0.5, W * 0.24), 30, Math.min(G * 0.92, W * 0.48)), 1.9, WISH);
            ultShake(10 + 3 * P, 1200);
            for (const r of u.others()) {
                sc.at(TBIG + 0.1, () => hit(where(u, r), away(u, bigX), 'tumble', 0.3));
            }
        });
        emberRise(sc, TBIG + 0.4, sec, WISH);
    }

    // ═════ 테오키스 — 사이코부스트 (ultbeam) ═════
    // 가슴의 수정 핵이 보랏빛으로 두근 · 몸 둘레로 DNA 이중나선(주황 · 하늘 두 가닥과 가로대)이 돌며 감김
    // → 이중나선이 앞으로 뻗어 나가며 보랏빛 광선을 감싼 채 화면 끝까지(닿은 애 벌러덩) → 보랏빛 빛의 반구 (약 7.2초)
    const DNA = ['#ffffff', '#ffd6ff', '#c060ff', '#5a1a9a'];
    UNIQ.deoxys = { fx: 'ultbeam', ms: (P) => 7200 + 200 * P, run: runPsychoBoost };
    function runPsychoBoost(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const lift = me.h * 0.25;
        const TC0 = 0.4;
        const TF = 2.3;
        const FIRE = 1.4;
        const TB = TF + FIRE + 0.1;
        const footAt = (t) => me.b - lift * easeOut(clamp((t - 0.2) / 0.5, 0, 1)) * (1 - easeIn(clamp((t - (sec - 0.6)) / 0.45, 0, 1))) + Math.sin(t * 3) * s;
        const core = (t) => [me.x + dir * me.w * 0.1, footAt(t) - me.h * 0.5];
        const bw = clamp(H * 0.11 * (0.9 + 0.3 * P), 8 * s, H * 0.18);
        const q = nearest(u);
        const bx = q && Math.sign(q.x - me.x) === dir ? q.x : me.x + dir * W * 0.6;
        const sc = scene(u, sec + 0.4, 'uniq deoxys');
        ultDark(0.45, ms - 200);
        // 몸 둘레 이중나선 (세로로 감김)
        sc.add({ max: TF + 0.2, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - TC0) / 0.5, 0, 1) * (1 - clamp((life - TF) / 0.2, 0, 1));
            if (k <= 0.02) {
                return;
            }
            const [cx] = core(life);
            const top = footAt(life) - me.h * 1.3;
            const bot = footAt(life) + s * 2;
            for (let y = top; y < bot; y += s) {
                const ph = y / (me.h * 0.25) + life * 6;
                const r = me.w * 0.7;
                const xa = cx + Math.sin(ph) * r;
                const xb = cx + Math.sin(ph + Math.PI) * r;
                ctx.globalAlpha = k * (Math.cos(ph) > 0 ? 1 : 0.45);
                ctx.fillStyle = '#ffa040';
                ctx.fillRect(px(xa), px(y), s * 2, s);
                ctx.globalAlpha = k * (Math.cos(ph) > 0 ? 0.45 : 1);
                ctx.fillStyle = '#60d8ff';
                ctx.fillRect(px(xb), px(y), s * 2, s);
                if (Math.round(y / s) % 6 === 0) {
                    ctx.globalAlpha = 0.6 * k;
                    ctx.fillStyle = DNA[1];
                    ctx.fillRect(px(Math.min(xa, xb)), px(y), Math.max(s, px(Math.abs(xa - xb))), s);
                }
            }
        } });
        puppet(sc, pokemon, u, footAt, DNA[2], sec - 0.1, { glow: (t) => (t > TF - 0.05 && t < TF + 0.1 ? 0.7 : clamp((t - TC0) / 0.8, 0, 1) * (t < TF ? 0.15 * (1 + Math.sin(t * 9)) : 0)), glowColor: DNA[1] });
        // 수정 핵 두근
        sc.add({ max: TF + FIRE, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const [x, y] = core(life);
            const beat = Math.max(0, Math.sin(life * 8)) ** 4;
            const k = clamp((life - TC0) / 0.5, 0, 1);
            fireOrb(ctx, px, s, x, y, Math.max(3 * s, me.w * 0.15) * (1 + 0.4 * beat), DNA, life, k, G, 1, 0, [1, 0.8, 0.6, 0.38], 0.2);
        } });
        chargeSwirl(sc, core, TC0 + 0.4, TF - 0.05, Math.max(me.w * 3.5, short(u) * 0.42), Math.max(s * 4, me.w * 0.25), DNA, dir);
        sc.at(TF, () => {
            impactFrames(sc, W, H, 0.75, 0.45);
            ultShake(5 + 2 * P, FIRE * 1000);
        });
        // 이중나선 광선
        sc.add({ max: TF + FIRE + 0.25, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TF) {
                return;
            }
            const [x0, y0] = core(life);
            const far = dir > 0 ? W - x0 : x0;
            const front = Math.min(far, (life - TF) * Math.max(1500, W * 3.6));
            const fade = life > TF + FIRE ? 1 - (life - TF - FIRE) / 0.25 : 1;
            beamBody(ctx, px, s, x0, y0, dir, 0, front, bw * 0.7 * fade, DNA, life, 0.9, G);
            for (let d = 0; d < front; d += s) {
                const ph = d / (bw * 1.1) - life * 12;
                const r = bw * 0.75 * Math.min(1, d / (bw * 2) + 0.3) * fade;
                const x = x0 + dir * d;
                const ya = y0 + Math.sin(ph) * r;
                const yb = y0 + Math.sin(ph + Math.PI) * r;
                ctx.globalAlpha = (Math.cos(ph) > 0 ? 1 : 0.5) * fade;
                ctx.fillStyle = '#ffa040';
                ctx.fillRect(px(x), px(ya), s, s * 2);
                ctx.globalAlpha = (Math.cos(ph) > 0 ? 0.5 : 1) * fade;
                ctx.fillStyle = '#60d8ff';
                ctx.fillRect(px(x), px(yb), s, s * 2);
                if (Math.round(d / s) % 7 === 0) {
                    ctx.globalAlpha = 0.7 * fade;
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(px(x), px(Math.min(ya, yb)), s, Math.max(s, px(Math.abs(ya - yb))));
                }
            }
        } });
        sc.tick((t) => {
            if (t < TF || t > TF + FIRE) {
                return;
            }
            for (const r of u.others()) {
                if ((r.x - me.x) * dir > 0) {
                    hit(where(u, r), dir, 'tumble');
                }
            }
        });
        sc.at(TB, () => {
            impactFrames(sc, W, H, 0.6, 0.4);
            blastDome(sc, clamp(bx, W * 0.08, W * 0.92), G, clamp(Math.max(H * 0.48, bw * 3.5), 30, Math.min(G * 0.92, W * 0.48)), 1.9, DNA);
            ultShake(8 + 2 * P, 1000);
        });
        emberRise(sc, TB + 0.4, sec, DNA);
    }

    // ═════ 세레비 — 리프스톰 (ultstorm) ═════
    // 시간의 물결 — 초록 고리가 시계처럼 퍼지며 화면이 연둣빛으로 → 세레비가 빙글빙글 날며 잎을 불러 모음
    // → 앞쪽에 거대한 잎 회오리가 솟아 화면을 가로질러 감(닿은 애 빙글빙글) → 회오리가 흩어지며 거대한 꽃이 핌 · 꽃잎 폭풍 (약 7.4초)
    UNIQ.celebi = { fx: 'ultstorm', ms: (P) => 7400 + 200 * P, run: runCelebiStorm };
    function runCelebiStorm(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const VINEC = K.pal.VINE;
        const TT0 = 1.6; // 회오리
        const TSEC = 2.2;
        const TBL = TT0 + TSEC; // 꽃
        const x0 = clamp(me.x + dir * W * 0.2, W * 0.08, W * 0.92);
        const x1 = clamp(me.x + dir * W * 0.85, W * 0.08, W * 0.92);
        const twX = (t) => lerp(x0, x1, easeOut(clamp((t - TT0) / TSEC, 0, 1)));
        const footAt = (t) => me.b - me.h * 0.4 * easeOut(clamp((t - 0.2) / 0.5, 0, 1)) * (1 - easeIn(clamp((t - (sec - 0.6)) / 0.45, 0, 1))) + Math.sin(t * 4) * s * 2;
        const sc = scene(u, sec + 0.4, 'uniq celebi');
        ultDark(0.35, ms - 200);
        // 시간의 물결
        let ripple = 0;
        sc.tick((t, dt) => {
            if (t > TBL) {
                return;
            }
            ripple += dt;
            if (ripple > 0.45) {
                ripple = 0;
                ring(sc, me.x, footAt(t) - me.h * 0.5, me.w * 0.4, Math.max(W, H) * 0.7, 0.85, 1.0, [VINEC[0], VINEC[1]], 1);
            }
        });
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp((life - 0.2) / 0.6, 0, 1) * clamp((sec - 0.3 - life) / 0.6, 0, 1);
            ctx.globalAlpha = 0.12 * a;
            ctx.fillStyle = VINEC[1];
            ctx.fillRect(0, 0, W, H);
        } });
        puppet(sc, pokemon, u, footAt, VINEC[1], sec - 0.1, { rot: (t) => (t > 0.5 && t < TT0 ? Math.sin(t * 10) * 0.25 : 0), glow: (t) => clamp((t - 0.3) / 0.6, 0, 1) * 0.15 * (1 + Math.sin(t * 8)), glowColor: VINEC[0] });
        // 불러 모이는 잎
        sc.add({ max: TT0 + 0.2, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - 0.4) / 0.4, 0, 1) * (1 - clamp((life - TT0) / 0.2, 0, 1));
            for (let j = 0; j < 20; j++) {
                const ph = (life * 0.8 + j / 20) % 1;
                const an = j * 2.4 + life * 3;
                const r = me.w * (0.8 + 2.4 * (1 - ph));
                const path = new Path2D();
                K.petalAt(path, px, s, me.x + Math.cos(an) * r, footAt(life) - me.h * 0.5 + Math.sin(an) * r * 0.6, s * 2, Math.sin(life * 8 + j) > 0);
                ctx.globalAlpha = k * Math.sin(ph * Math.PI);
                ctx.fillStyle = j % 2 ? VINEC[1] : VINEC[2];
                ctx.fill(path);
            }
        } });
        // 거대한 잎 회오리
        sc.add({ max: TBL + 0.3, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TT0) {
                return;
            }
            const grow = easeOut((life - TT0) / 0.4);
            const fade = life > TBL ? 1 - (life - TBL) / 0.3 : 1;
            const top = G - (G - s) * grow;
            const cx = twX(life);
            const rows = Math.max(10, Math.round((G - top) / (3 * s)));
            for (let i = 0; i < rows; i++) {
                const f = i / rows;
                const y = G - f * (G - top);
                const rw = (W * 0.02 + f * f * W * 0.12) * (0.9 + 0.1 * Math.sin(life * 8 + i));
                for (let j = 0; j < 3; j++) {
                    const an = life * 9 + i * 0.5 + (j * TAU) / 3;
                    const front = Math.sin(an) > 0;
                    const path = new Path2D();
                    K.petalAt(path, px, s, cx + Math.cos(an) * rw, y, s * 2, Math.floor(life * 12 + i + j) % 2 === 0);
                    ctx.globalAlpha = (front ? 1 : 0.45) * fade;
                    ctx.fillStyle = front ? (j % 2 ? VINEC[0] : VINEC[1]) : VINEC[3];
                    ctx.fill(path);
                }
            }
        } });
        sc.at(TT0, () => ultShake(4, TSEC * 1000));
        sc.tick((t) => {
            if (t < TT0 || t > TBL) {
                return;
            }
            const cx = twX(t);
            for (const r of u.others()) {
                if (Math.abs(r.x - cx) < W * 0.08 + r.w * 0.4) {
                    hit(where(u, r), dir, 'spin', 0.8);
                }
            }
        });
        sc.at(TBL, () => ultFinale('bloom', u, x1, H * 0.38, null));
    }

    // ═════ 샤로다 — 리프스톰 (ultstorm) ═════
    // 위엄 있는 눈빛(붉게 번뜩) · 몸 둘레로 잎이 리본처럼 감겨 돎 → 잎으로 된 거대한 뱀이 일어나 화면을 꿈틀거리며 가로지름(닿은 애 빙글)
    // → 과녁을 휘감아 똬리를 틀었다 펑 흩어지며 잎 폭풍 · 거대한 꽃 (약 7.4초)
    UNIQ.serperior = { fx: 'ultstorm', ms: (P) => 7400 + 200 * P, run: runLeafSerpent };
    function runLeafSerpent(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const VINEC = K.pal.VINE;
        const TEYE = 0.4;
        const TS0 = 1.4; // 잎 뱀 출발
        const TRAVEL = 1.6;
        const TCOIL = TS0 + TRAVEL; // 똬리
        const TB = TCOIL + 0.9; // 펑
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * W * 0.6, W * 0.1, W * 0.9);
        const ty = q ? q.y : G - me.h * 0.6;
        const NSEG = 26;
        const segR = Math.max(3 * s, Math.min(H * 0.045, W * 0.03));
        // 머리 자리 — 출발 · 꿈틀대며 과녁으로 · 과녁 둘레 똬리
        const headAt = (t) => {
            if (t < TS0) {
                return [me.x, me.b - me.h * 0.6];
            }
            if (t < TCOIL) {
                const k = (t - TS0) / TRAVEL;
                const x = lerp(me.x, tx, k);
                const y = lerp(me.b - me.h * 0.6, ty, k) - Math.sin(k * Math.PI) * H * 0.25 + Math.sin(k * 14) * H * 0.05;
                return [x, y];
            }
            const an = (t - TCOIL) * 9 * dir;
            const r = Math.max(me.w, segR * 6) * (1 - 0.3 * clamp((t - TCOIL) / 0.9, 0, 1));
            return [tx + Math.cos(an) * r, ty + Math.sin(an) * r * 0.5];
        };
        const sc = scene(u, sec + 0.4, 'uniq serperior');
        ultDark(0.4, ms - 200);
        // 몸 둘레 잎 리본
        sc.add({ max: TS0 + 0.3, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - 0.3) / 0.4, 0, 1) * (1 - clamp((life - TS0) / 0.3, 0, 1));
            for (let j = 0; j < 30; j++) {
                const f = j / 30;
                const an = life * 5 * dir + f * TAU * 2;
                const path = new Path2D();
                K.petalAt(path, px, s, me.x + Math.cos(an) * me.w * 0.75, me.b - f * me.h * 1.3 + Math.sin(an) * s * 2, s * 2, Math.sin(life * 8 + j) > 0);
                ctx.globalAlpha = k * (Math.sin(an) > 0 ? 1 : 0.45);
                ctx.fillStyle = j % 2 ? VINEC[1] : VINEC[0];
                ctx.fill(path);
            }
        } });
        puppet(sc, pokemon, u, () => me.b, VINEC[2], sec - 0.1, { glow: (t) => clamp((t - 0.3) / 0.5, 0, 1) * 0.12 * (1 + Math.sin(t * 8)), glowColor: VINEC[0] });
        sc.add({ max: TEYE + 0.5, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const e = clamp(1 - Math.abs(life - TEYE - 0.1) / 0.15, 0, 1);
            if (e > 0) {
                glint(ctx, px, s, me.x + dir * me.w * 0.25, me.b - me.h * 0.8, me.w * 0.3 * e, e);
            }
        } });
        // 잎 뱀 — 마디마다 잎 덩이 · 머리에 붉은 눈
        sc.add({ max: TB + 0.05, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TS0) {
                return;
            }
            for (let i = NSEG - 1; i >= 0; i--) {
                const tt = life - i * 0.035;
                if (tt < TS0) {
                    continue;
                }
                const [x, y] = headAt(tt);
                const r = segR * (i === 0 ? 1.5 : 1.15 - (i / NSEG) * 0.6);
                for (let j = 0; j < 5; j++) {
                    const an = life * 6 + j * 1.25 + i;
                    const path = new Path2D();
                    K.petalAt(path, px, s, x + Math.cos(an) * r * 0.6, y + Math.sin(an) * r * 0.6, Math.max(s, r * 0.5), Math.floor(life * 10 + i + j) % 2 === 0);
                    ctx.globalAlpha = 1;
                    ctx.fillStyle = j % 2 ? VINEC[1] : i % 3 ? VINEC[2] : VINEC[0];
                    ctx.fill(path);
                }
                if (i === 0) {
                    ctx.fillStyle = '#ff3a3a';
                    ctx.fillRect(px(x + dir * r * 0.3), px(y - r * 0.4), s * 2, s * 2);
                    ctx.fillStyle = '#fff3a0';
                    for (const sd of [-1, 1]) {
                        ctx.fillRect(px(x + dir * r * 1.1), px(y + sd * r * 0.5), s * 2, s);
                    }
                }
            }
        } });
        sc.at(TS0, () => {
            ring(sc, me.x, me.b - me.h * 0.6, me.w * 0.4, me.w * 2.4, 0.85, 0.4, ['#ffffff', VINEC[1]], 2);
            ultShake(3, 300);
        });
        sc.tick((t) => {
            if (t < TS0 || t > TCOIL) {
                return;
            }
            const [x, y] = headAt(t);
            for (const r of u.others()) {
                if (Math.hypot(r.x - x, r.y - y) < segR * 3 + r.w * 0.5) {
                    hit(where(u, r), dir, 'spin', 0.8);
                }
            }
        });
        sc.at(TCOIL, () => ultShake(3, 900));
        sc.at(TB, () => {
            impactFrames(sc, W, H, 0.6, 0.35);
            for (let i = 0; i < 60 && room(1); i++) {
                const a = rnd(0, TAU);
                const sp = H * rnd(0.4, 1);
                sigParticle({ x: tx, y: ty, s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - H * 0.2, g: H * 0.3, drag: 1.4, max: rnd(0.8, 1.4), color: pick([VINEC[0], VINEC[1], VINEC[2]]), ph: rnd(0, TAU),
                    draw: (ctx, p, tt, px) => {
                        ctx.globalAlpha = Math.min(1, (1 - tt) * 3);
                        ctx.fillStyle = p.color;
                        const path = new Path2D();
                        K.petalAt(path, px, p.s, p.x, p.y, p.s * 2, Math.sin(p.life * 10 + p.ph) > 0);
                        ctx.fill(path);
                    } });
            }
            ultFinale('bloom', u, tx, H * 0.36, null);
            for (const r of u.others()) {
                sc.at(TB + 0.1, () => hit(where(u, r), away(u, tx), 'lift', 0.3));
            }
        });
    }

    // ═════ 염무왕 — 블라스트번 (ultnova) ═════
    // 불꽃 수염이 활활 · 가슴을 두드리며 하늘로 불을 뿜음(불기둥) → 높이 뛰어올라 몸을 둥글게 말고 불덩이가 되어 내리찍음
    // → 땅이 움푹 꺼지며 용암 고리가 번짐 · 불기둥이 둥글게 솟음 → 주황빛 빛의 반구 → 구덩이에서 걸어 나옴 (약 7.2초)
    UNIQ.emboar = { fx: 'ultnova', ms: (P) => 7200 + 200 * P, run: runHeatCrash };
    function runHeatCrash(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const FIRE = ['#ffffff', '#fff3a0', '#ff8a2a', '#c8201a'];
        const beats = [0.5, 0.8];
        const TROAR = 1.1; // 하늘로 불
        const TJ = 2.0; // 뛰어오름
        const TTOP = TJ + 0.45;
        const TI = TTOP + 0.4; // 내리찍음
        const THOME = sec - 0.6;
        const q = nearest(u);
        const tx = clamp(q ? lerp(me.x, q.x, 0.7) : me.x + dir * W * 0.3, me.w, W - me.w);
        const topY = Math.max(me.h * 1.2, G * 0.22);
        const posAt = (t) => {
            if (t < TJ) {
                return [me.x, me.b, 0];
            }
            if (t < TTOP) {
                const k = easeOut((t - TJ) / (TTOP - TJ));
                return [lerp(me.x, (me.x + tx) / 2, k), lerp(me.b, topY, k), k * 3 * dir];
            }
            if (t < TI) {
                const k = easeIn((t - TTOP) / (TI - TTOP));
                return [lerp((me.x + tx) / 2, tx, k), lerp(topY, G, k), (3 + k * 5) * dir];
            }
            if (t < THOME) {
                return [tx, G, 0];
            }
            const k = easeOut(clamp((t - THOME) / 0.5, 0, 1));
            return [lerp(tx, me.x, k), G - Math.sin(k * Math.PI) * me.h * 0.3, 0];
        };
        const sc = scene(u, sec + 0.4, 'uniq emboar');
        ultDark(0.4, ms - 200);
        // 불꽃 수염 · 불덩이 (염무왕 뒤)
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const [x, b] = posAt(life);
            const k = clamp((life - 0.2) / 0.4, 0, 1) * (1 - clamp((life - TI - 0.5) / 0.5, 0, 1));
            if (k > 0.02 && life < TJ) {
                K.flameTongue(ctx, px, s, x + dir * me.w * 0.15, b - me.h * 0.25, me.w * 0.9, me.h * 0.9, FIRE, life, k);
            }
            if (life > TTOP - 0.1 && life < TI) {
                fireOrb(ctx, px, s, x, b - me.h * 0.5, me.w * 0.75, FIRE, life, 1, G, 1, 0, [1, 0.8, 0.6, 0.38], 0.6);
            }
        } });
        const img = pokemon.el;
        const edge = Math.max(1, Math.round(u.s * 0.75));
        hideMon(pokemon, true);
        hideUntil(pokemon, (sec - 0.1) * 1000 + 100);
        sc.at(sec - 0.12, () => hideMon(pokemon, false));
        sc.add({ max: sec - 0.1, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life >= sec - 0.12) {
                return;
            }
            const [x, b, rot] = posAt(life);
            drawLitMon(ctx, img, x, b, me.w, dir < 0, FIRE[2], edge, 1, rot);
            if (beats.some((tb) => life > tb && life < tb + 0.1) || (life > TI && life < TI + 0.12)) {
                drawMon(ctx, img, x, b, me.w, dir < 0, 0.6, FIRE[1], rot);
            }
        } });
        beats.forEach((tb, i) => sc.at(tb, () => {
            ring(sc, me.x, me.b - me.h * 0.5, me.w * 0.4, me.w * (1.6 + i * 0.4), 0.85, 0.3, ['#ffffff', FIRE[2]], 2);
            ultShake(2 + i, 150);
        }));
        // 하늘로 불
        sc.add({ max: TJ + 0.2, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TROAR) {
                return;
            }
            const k = easeOut((life - TROAR) / 0.2);
            const fade = 1 - clamp((life - TJ + 0.2) / 0.3, 0, 1);
            const y0 = me.b - me.h * 0.8;
            beamBody(ctx, px, s, me.x + dir * me.w * 0.2, y0, 0, -1, (y0 + s) * k, Math.max(4 * s, me.w * 0.4) * fade, FIRE, life, 1);
        } });
        sc.at(TROAR, () => {
            ultShake(4, 600);
            ring(sc, me.x, me.b - me.h * 0.8, me.w * 0.3, me.w * 2, 0.9, 0.4, ['#ffffff', FIRE[2]], 2);
        });
        sc.at(TJ, () => {
            ring(sc, me.x, G - s, me.w * 0.5, me.w * 3, 0.22, 0.45, ['#ffffff', FIRE[2]], 2);
            debris(me.x, G - s, s, ['#8a7252', '#5c4a33', FIRE[2]], 14, H * 0.6, { ground: G });
            ultShake(4, 300);
        });
        // 내리찍음 — 용암 고리 · 둥글게 솟는 불기둥
        sc.at(TI, () => {
            impactFrames(sc, W, H, 0.8, 0.5);
            blastDome(sc, tx, G, clamp(Math.max(H * 0.5, me.w * 3), 30, Math.min(G * 0.92, W * 0.48)), 1.9, FIRE);
            ultShake(11 + 3 * P, 1400);
            for (let i = 0; i < 6; i++) {
                const x = tx + (i - 2.5) * Math.max(me.w * 0.9, W * 0.09);
                if (x > s * 4 && x < W - s * 4) {
                    sc.at(TI + 0.15 + Math.abs(i - 2.5) * 0.08, () => K.firePillar(sc, x, G, Math.max(5 * s, me.w * 0.35), 1.0, FIRE));
                }
            }
            for (const r of u.others()) {
                sc.at(TI + 0.1, () => hit(where(u, r), away(u, tx), Math.abs(r.x - tx) < W * 0.2 ? 'tumble' : 'lift', 0.3));
            }
        });
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TI) {
                return;
            }
            const k = easeOut((life - TI) / 0.8);
            const fade = clamp((sec - 0.3 - life) / 0.6, 0, 1);
            const half = Math.max(me.w * 1.5, W * 0.35) * k;
            ellipse(ctx, px, s, tx, G, half * 0.5, half * 0.08, '#2a1008', 0.9 * fade, G + s);
            K.groundFlames(ctx, px, s, Math.max(0, tx - half), Math.min(W, tx + half), G, H * 0.08, life, FIRE, 0.9 * fade);
        } });
        emberRise(sc, TI + 0.4, sec, FIRE);
    }

    // ═════ 대검귀 — 껍질검 (ultbarrage) ═════
    // 앞다리의 껍질 칼을 뽑아 들고 자세를 낮춤 · 칼날에 물빛이 모임 → 한 번 휘둘러 거대한 물 초승달이 화면을 가르며 날아감(닿은 애 벌러덩)
    // → 칼을 거두는 순간(잠깐 정적) 베인 자리마다 물이 터짐 → 물빛 빛의 반구 (약 7.0초)
    UNIQ.samurott = { fx: 'ultbarrage', ms: (P) => 7000 + 200 * P, run: runSeamitar };
    function runSeamitar(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TIDE = K.pal.TIDE;
        const TDRAW = 0.5;
        const TC0 = 0.8;
        const TSWING = 2.2;
        const FLY = 0.6;
        const TSHEATH = TSWING + FLY + 0.35; // 칼을 거둠 — 정적
        const TB = TSHEATH + 0.25; // 베인 자리 터짐
        const blade = (t) => [me.x + dir * me.w * 0.55, me.b - me.h * 0.4];
        const cuts = [];
        const sc = scene(u, sec + 0.4, 'uniq samurott');
        ultDark(0.45, ms - 200);
        puppet(sc, pokemon, u, () => me.b, TIDE[2], sec - 0.1, { glow: (t) => (t > TSWING - 0.03 && t < TSWING + 0.1 ? 0.7 : 0), glowColor: '#ffffff' });
        // 껍질 칼 — 앞으로 뻗은 은빛 칼날 · 물빛이 모임
        sc.add({ max: TSWING + 0.2, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TDRAW) {
                return;
            }
            const k = easeOut((life - TDRAW) / 0.25);
            const [bx, by] = blade(life);
            const L = me.w * 0.9 * k;
            for (let d = 0; d < L; d += s) {
                const w = Math.max(s, Math.round((me.h * 0.08 * (1 - d / L) + s) / s) * s);
                ctx.globalAlpha = 1;
                ctx.fillStyle = '#e0e8f0';
                ctx.fillRect(px(bx + dir * d), px(by - d * 0.35 - w / 2), s, w);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(px(bx + dir * d), px(by - d * 0.35 - w / 2), s, s);
            }
            const charge = clamp((life - TC0) / (TSWING - TC0), 0, 1);
            if (charge > 0) {
                fireOrb(ctx, px, s, bx + dir * L * 0.6, by - L * 0.2, Math.max(3 * s, me.w * 0.2) * charge, TIDE, life, 1, G, 0.8, 0, [1, 0.8, 0.6, 0.38], 0.2);
                glint(ctx, px, s, bx + dir * L, by - L * 0.35, me.w * 0.25 * charge, charge);
            }
        } });
        chargeSwirl(sc, (t) => { const [bx, by] = blade(t); return [bx + dir * me.w * 0.5, by - me.w * 0.2]; }, TC0, TSWING - 0.05, Math.max(me.w * 3.5, short(u) * 0.42), Math.max(s * 4, me.w * 0.2), TIDE, dir);
        // 물 초승달 — 화면을 가르며 날아감
        sc.add({ max: TSWING + FLY + 0.15, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TSWING) {
                return;
            }
            const k = (life - TSWING) / FLY;
            const far = dir > 0 ? W - me.x : me.x;
            const cx = me.x + dir * (me.w * 0.6 + far * 1.1 * easeOut(Math.min(1, k)));
            const cy = me.b - me.h * 0.45;
            const R = Math.max(me.h * 1.1, H * 0.25);
            const fade = k > 1 ? 1 - (k - 1) / 0.25 : 1;
            for (let i = 0; i <= 24; i++) {
                const f = i / 24;
                const an = -1.1 + 2.2 * f;
                const th = Math.sin(f * Math.PI) * Math.max(3 * s, R * 0.2);
                for (let d = R - th; d < R; d += s) {
                    ctx.globalAlpha = fade;
                    ctx.fillStyle = d > R - s * 1.5 ? '#ffffff' : d > R - th * 0.5 ? TIDE[1] : TIDE[2];
                    ctx.fillRect(px(cx - dir * R * 0.7 + dir * Math.cos(an) * d), px(cy + Math.sin(an) * d), s, s);
                }
            }
            if (life < TSWING + FLY && Math.random() < 0.6) {
                K.splash(cx, cy + rnd(-0.5, 0.5) * R, s, TIDE, 2, H * 0.3);
            }
        } });
        sc.at(TSWING, () => {
            impactFrames(sc, W, H, 0.7, 0.45);
            ultShake(5, 400);
        });
        sc.tick((t) => {
            if (t < TSWING || t > TSWING + FLY) {
                return;
            }
            const k = (t - TSWING) / FLY;
            const far = dir > 0 ? W - me.x : me.x;
            const cx = me.x + dir * (me.w * 0.6 + far * 1.1 * easeOut(k));
            for (const r of u.others()) {
                if (!cuts.some((c) => c.r.pokemon === r.pokemon) && (cx - r.x) * dir > 0 && (r.x - me.x) * dir > 0) {
                    cuts.push({ r, x: r.x, y: r.y });
                    hit(where(u, r), dir, 'shake', 0);
                }
            }
        });
        // 베인 자리 — 비스듬한 하얀 금 · 정적 뒤 물 폭발
        sc.add({ max: TB + 0.3, draw: (ctx, it, t, px) => {
            const life = sc.t;
            for (const c of cuts) {
                const fade = life > TB ? 1 - (life - TB) / 0.3 : 1;
                const L = Math.max(c.r.h, me.h) * 1.3;
                for (let d = -L / 2; d < L / 2; d += s) {
                    ctx.globalAlpha = fade;
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(px(c.x + d * 0.8 * dir), px(c.y + d * 0.6), s * 2, s);
                }
            }
        } });
        sc.at(TB, () => {
            impactFrames(sc, W, H, 0.6, 0.4);
            for (const c of cuts) {
                K.crownSplash(sc, c.x, G, Math.max(me.w * 0.8, H * 0.12), 0.9, TIDE);
                hit(where(u, c.r), dir, 'tumble', 0);
            }
            const bx = cuts.length ? cuts[0].x : clamp(me.x + dir * W * 0.5, W * 0.1, W * 0.9);
            blastDome(sc, bx, G, clamp(Math.max(H * 0.45, W * 0.22), 30, Math.min(G * 0.92, W * 0.45)), 1.8, TIDE);
            ultShake(9 + 3 * P, 1100);
        });
        K.waterRain(sc, TB + 0.5, sec - 0.2, TIDE);
    }

    // ═════ 브리가론 — 하드플랜트 (ultpillar) ═════
    // 가시 방패(니들가드)를 펼쳐 초록 가시 반구가 몸을 감쌈 → 방패째 땅을 내리치자 가시 돋은 거대한 덩굴이 앞으로 차례로 솟음(닿은 애 떠오름)
    // → 덩굴의 가시가 사방으로 튀어 나감 · 초록 빛의 반구 (약 7.2초)
    UNIQ.chesnaught = { fx: 'ultpillar', ms: (P) => 7200 + 200 * P, run: runSpikyPlant };
    function runSpikyPlant(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const VINEC = K.pal.VINE;
        const TSHIELD = 0.4;
        const TSLAM = 1.8;
        const NV = 5;
        const far = dir > 0 ? W - me.x : me.x;
        const vines = [];
        for (let i = 0; i < NV; i++) {
            const d = me.w * 0.8 + (far - me.w * 0.8) * ((i + 0.5) / NV);
            vines.push({ x: clamp(me.x + dir * d, s * 4, W - s * 4), h: Math.min(G * 0.85, H * (0.3 + 0.35 * ((i + 1) / NV))), w: Math.max(5 * s, me.w * 0.28), t0: TSLAM + 0.15 + i * 0.18, seed: hash(i, 861) * 99 });
        }
        const TB = vines[NV - 1].t0 + 0.7;
        const sc = scene(u, sec + 0.4, 'uniq chesnaught');
        ultDark(0.35, ms - 200);
        puppet(sc, pokemon, u, (t) => me.b - (t > TSLAM - 0.3 && t < TSLAM ? me.h * 0.2 * Math.sin(((t - TSLAM + 0.3) / 0.3) * Math.PI) : 0), VINEC[2], sec - 0.1, { glow: (t) => (t > TSLAM && t < TSLAM + 0.1 ? 0.6 : 0), glowColor: VINEC[0] });
        // 가시 방패 — 몸을 감싼 초록 가시 반구
        sc.add({ max: TSLAM + 0.3, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = easeOut(clamp((life - TSHIELD) / 0.3, 0, 1)) * (1 - clamp((life - TSLAM) / 0.3, 0, 1));
            if (k <= 0.02) {
                return;
            }
            const R = me.w * 0.85 * k;
            const cy = me.b - me.h * 0.45;
            ellipse(ctx, px, s, me.x, cy, R, R * 0.95, VINEC[2], 0.25);
            K.ringDots(ctx, px, s, me.x, cy, R, 0.95, [VINEC[0], VINEC[1]], 0.9, 2);
            for (let j = 0; j < 16; j++) {
                const an = (j / 16) * TAU + life * 0.5;
                for (let d = R; d < R * 1.3; d += s) {
                    ctx.globalAlpha = 0.95;
                    ctx.fillStyle = d > R * 1.2 ? '#ffffff' : VINEC[1];
                    ctx.fillRect(px(me.x + Math.cos(an) * d), px(cy + Math.sin(an) * d * 0.95), s, s);
                }
            }
        } });
        sc.at(TSLAM, () => {
            impactFrames(sc, W, H, 0.6, 0.35);
            ring(sc, me.x, G - s, me.w * 0.5, me.w * 3.5, 0.22, 0.45, ['#ffffff', VINEC[1]], 2);
            groundArcs(sc, me.x, G - s, far, 1.2, VINEC[1], 4, 2, G - s);
            debris(me.x, G - s, s, ['#8a7252', '#5c4a33', VINEC[2]], 18, H * 0.6, { ground: G });
            ultShake(7, 500);
        });
        // 가시 덩굴 — K.vine + 둘레 가시
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            for (const v of vines) {
                if (life < v.t0) {
                    continue;
                }
                const grow = easeOut((life - v.t0) / 0.35);
                const fall = clamp((life - (sec - 0.8)) / 0.6, 0, 1);
                const hh = v.h * (1 - fall);
                K.vine(ctx, px, s, v.x, G, hh, v.w, life, grow, dir, v.seed);
                ctx.globalAlpha = 1;
                for (let y = v.w; y < hh * grow; y += Math.max(3 * s, v.w * 0.6)) {
                    for (const sd of [-1, 1]) {
                        const x0 = v.x + sd * v.w * 0.5 + Math.sin(y * 0.05 + v.seed) * v.w * 0.2;
                        for (let d = 0; d < v.w * 0.45; d += s) {
                            ctx.fillStyle = d > v.w * 0.3 ? '#ffffff' : '#c8e890';
                            ctx.fillRect(px(x0 + sd * d), px(G - y - d * 0.5), s, s);
                        }
                    }
                }
            }
        } });
        vines.forEach((v) => sc.at(v.t0, () => {
            debris(v.x, G - s, s, ['#8a7252', '#5c4a33', VINEC[2]], 10, H * 0.5, { ground: G });
            ultShake(3, 160);
            for (const r of u.others()) {
                if (Math.abs(r.x - v.x) < v.w * 1.2 + r.w * 0.4) {
                    hit(where(u, r), away(u, me.x), 'lift', 0.6);
                }
            }
        }));
        // 가시가 사방으로
        sc.at(TB, () => {
            impactFrames(sc, W, H, 0.6, 0.4);
            for (const v of vines) {
                for (let j = 0; j < 8 && room(1); j++) {
                    const a = rnd(-Math.PI, 0);
                    const sp = H * rnd(0.6, 1.1);
                    sigParticle({ x: v.x, y: G - v.h * rnd(0.3, 0.8), s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: H, drag: 0.8, max: rnd(0.6, 1), a, draw: (ctx, p, tt, px) => {
                        const L = 4;
                        const ang = Math.atan2(p.vy, p.vx);
                        ctx.globalAlpha = 1 - tt;
                        for (let i = 0; i < L; i++) {
                            ctx.fillStyle = i === 0 ? '#ffffff' : '#c8e890';
                            ctx.fillRect(px(p.x - Math.cos(ang) * i * p.s), px(p.y - Math.sin(ang) * i * p.s), p.s, p.s);
                        }
                    } });
                }
            }
            const last = vines[NV - 1];
            blastDome(sc, clamp(last.x, W * 0.08, W * 0.92), G, clamp(Math.max(H * 0.45, W * 0.22), 30, Math.min(G * 0.92, W * 0.45)), 1.8, VINEC);
            ultShake(8 + 2 * P, 1000);
        });
    }

    // ═════ 마폭시 — 매지컬플레임 (ultvortex) ═════
    // 꼬리에서 불붙은 나뭇가지 지팡이를 뽑아 공중에 불꽃 마법진(동그라미 둘 · 별 · 둘레 글자)을 그림 → 마법진이 돌며 빛나다
    // 가운데서 불꽃 소용돌이 기둥이 솟아 과녁 쪽으로 감(닿은 애 빙글빙글) · 불꽃 구가 쏟아짐 → 주황빛 빛의 반구 (약 7.2초)
    UNIQ.delphox = { fx: 'ultvortex', ms: (P) => 7200 + 200 * P, run: runMysticalFire };
    function runMysticalFire(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const FIRE = ['#ffffff', '#fff3a0', '#ff9a2a', '#d0301a'];
        const TWAND = 0.4;
        const TCIRC = 0.8; // 마법진 그리기
        const TVORT = 2.4; // 소용돌이
        const VSEC = 1.6;
        const TB = TVORT + VSEC;
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * W * 0.5, W * 0.12, W * 0.88);
        const cx0 = clamp(me.x + dir * W * 0.25, W * 0.15, W * 0.85);
        const cy0 = clamp(G - H * 0.35, H * 0.25, G - me.h);
        const Rc = clamp(Math.min(W, H) * 0.16, 16, 100);
        const vx = (t) => lerp(cx0, tx, easeOut(clamp((t - TVORT - 0.3) / (VSEC - 0.3), 0, 1)));
        const sc = scene(u, sec + 0.4, 'uniq delphox');
        ultDark(0.45, ms - 200);
        puppet(sc, pokemon, u, () => me.b, FIRE[2], sec - 0.1, { glow: (t) => clamp((t - TWAND) / 0.5, 0, 1) * (t < TB ? 0.12 * (1 + Math.sin(t * 10)) : 0), glowColor: FIRE[1] });
        // 지팡이 — 손에 든 불붙은 나뭇가지
        sc.add({ max: TB, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TWAND) {
                return;
            }
            const k = easeOut((life - TWAND) / 0.25);
            const hx = me.x + dir * me.w * 0.4;
            const hy = me.b - me.h * 0.55;
            for (let d = 0; d < me.h * 0.4 * k; d += s) {
                ctx.globalAlpha = 1;
                ctx.fillStyle = '#8a5a34';
                ctx.fillRect(px(hx + dir * d * 0.5), px(hy - d), s, s);
            }
            K.flameTongue(ctx, px, s, hx + dir * me.h * 0.2 * k, hy - me.h * 0.4 * k + s * 2, me.w * 0.3, me.w * 0.5, FIRE, life, k);
        } });
        // 불꽃 마법진
        sc.add({ max: TB + 0.3, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TCIRC) {
                return;
            }
            const k = clamp((life - TCIRC) / 0.8, 0, 1);
            const fade = life > TB ? 1 - (life - TB) / 0.3 : 1;
            const rot = life * 1.2;
            const pulse = 0.85 + 0.15 * Math.sin(life * 8);
            const pts = (n, R, off = 0) => Array.from({ length: n + 1 }, (_, i) => {
                const an = rot + off + (i / n) * TAU * Math.min(1, k * 1.2);
                return [cx0 + Math.cos(an) * R, cy0 + Math.sin(an) * R * 0.45];
            });
            K.fillPts(ctx, px, s, pts(40, Rc), 2, FIRE[2], fade * pulse);
            K.fillPts(ctx, px, s, pts(40, Rc * 0.78), 1, FIRE[1], fade * pulse);
            // 별 (다섯 꼭지)
            if (k > 0.5) {
                const star = [];
                for (let i = 0; i <= 5; i++) {
                    const an = rot * -1 + (i * 2 * TAU) / 5;
                    star.push([cx0 + Math.cos(an) * Rc * 0.75, cy0 + Math.sin(an) * Rc * 0.75 * 0.45]);
                }
                K.fillPts(ctx, px, s, star.slice(0, Math.max(2, Math.ceil(star.length * clamp((k - 0.5) * 2, 0, 1)))), 1, '#ffffff', fade);
            }
            // 둘레 글자 — 작은 도트 무늬
            ctx.globalAlpha = 0.9 * fade * k;
            ctx.fillStyle = FIRE[1];
            for (let j = 0; j < 16; j++) {
                const an = rot + (j / 16) * TAU;
                const x = cx0 + Math.cos(an) * Rc * 0.89;
                const y = cy0 + Math.sin(an) * Rc * 0.89 * 0.45;
                ctx.fillRect(px(x), px(y), s * (1 + (j % 3)), s);
            }
        } });
        sc.at(TCIRC + 0.8, () => {
            ring(sc, cx0, cy0, Rc, Rc * 1.8, 0.45, 0.4, ['#ffffff', FIRE[2]], 2);
            ultShake(2, 200);
        });
        // 불꽃 소용돌이 기둥 — 마법진에서 솟아 과녁 쪽으로
        sc.add({ max: TB + 0.2, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TVORT) {
                return;
            }
            const grow = easeOut((life - TVORT) / 0.35);
            const fade = life > TB ? 1 - (life - TB) / 0.2 : 1;
            const top = G - (G - s) * grow;
            const x = vx(life);
            const rows = Math.max(8, Math.round((G - top) / (3 * s)));
            for (let i = 0; i < rows; i++) {
                const f = i / rows;
                const y = G - f * (G - top);
                const rw = (W * 0.025 + f * f * W * 0.1) * (0.9 + 0.1 * Math.sin(life * 8 + i));
                const an = life * 10 + i * 0.6;
                for (let j = 0; j < 3; j++) {
                    const a = an + (j * TAU) / 3;
                    const front = Math.sin(a) > 0;
                    K.fireTail(ctx, px, s, x + Math.cos(a) * rw, y, -Math.sin(a), 0, rw * 0.7, Math.max(2 * s, rw * 0.25), FIRE, life + i + j, (front ? 1 : 0.5) * fade);
                }
            }
        } });
        sc.at(TVORT, () => {
            impactFrames(sc, W, H, 0.6, 0.35);
            ultShake(5, VSEC * 1000);
        });
        sc.tick((t) => {
            if (t < TVORT || t > TB) {
                return;
            }
            const x = vx(t);
            for (const r of u.others()) {
                if (Math.abs(r.x - x) < W * 0.08 + r.w * 0.4) {
                    hit(where(u, r), dir, 'spin', 0.8);
                }
            }
        });
        // 쏟아지는 불꽃 구
        for (let i = 0; i < 8; i++) {
            const t0 = TVORT + 0.3 + i * 0.15;
            const x1 = clamp(tx + (hash(i, 871) - 0.5) * W * 0.5, W * 0.05, W * 0.95);
            sc.add({ max: sec, draw: (ctx, it, t, px) => {
                const life = sc.t;
                const k = (life - t0) / 0.45;
                if (k < 0 || k > 1) {
                    return;
                }
                const x = lerp(cx0, x1, k);
                const y = lerp(cy0, G - s * 3, k * k) - Math.sin(k * Math.PI) * H * 0.15;
                fireOrb(ctx, px, s, x, y, Math.max(3 * s, Rc * 0.15), FIRE, life + i, 1, G, 1, 0, [1, 0.8, 0.6, 0.38], 0.5);
            } });
            sc.at(t0 + 0.45, () => {
                fireBits(x1, G - s, s, FIRE, 8, { angle: -Math.PI / 2, spread: 2, speed: H * 0.4, g: H, life: 0.5 });
                ultShake(1.5, 80);
            });
        }
        sc.at(TB, () => {
            impactFrames(sc, W, H, 0.7, 0.45);
            blastDome(sc, tx, G, clamp(Math.max(H * 0.48, W * 0.22), 30, Math.min(G * 0.92, W * 0.48)), 1.9, FIRE);
            ultShake(9 + 3 * P, 1100);
            for (const r of u.others()) {
                sc.at(TB + 0.1, () => hit(where(u, r), away(u, tx), 'tumble', 0.3));
            }
        });
        emberRise(sc, TB + 0.4, sec, FIRE);
    }

    // ── 틀에 끼워 넣기 — uniq 가 이 파일에 있는 이름이면 그 연출, 아니면 원래 틀 그대로 ──
    for (const fx of new Set(Object.values(UNIQ).map((d) => d.fx))) {
        const base = ULT_FX[fx];
        if (!base) {
            continue;
        }
        const mine = (o) => UNIQ[o?.uniq]?.fx === fx;
        ULT_FX[fx] = {
            plain: base.plain ?? base,
            ms: (P, o) => (mine(o) ? UNIQ[o.uniq].ms(P, o) : base.ms(P, o)),
            run: (u, o, ms, pokemon) => (mine(o) && pokemon?.el ? UNIQ[o.uniq].run(u, o, ms, pokemon) : base.run(u, o, ms, pokemon)),
        };
    }
})();
