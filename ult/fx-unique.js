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
