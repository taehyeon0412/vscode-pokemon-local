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
    // 게임 화면 연출 위 끝 (bridge fxStageTop — 정보줄 · 지도 줄 아래 끝) · 일반 모드 · 3:3 무대 상자 안은 0 — 위로 던지는 불덩이 · 뛰어오른 몸이 그 뒤로 숨지 않게 (#105)
    const gameTop = () => (typeof fxStageTop === 'function' ? fxStageTop() : 0);
    // 하늘에서 퍼지는 고리 (fx-sky ring 과 같음) — 위 끝 층 (위 끝 위는 지우고 바둑판 띠로 흩어짐 · #107)
    const ringSoft = (sc, x, y, r0, r1, flat, dur, cols, th = 1) => sc.soft({ max: dur, draw: (ctx, it, t, px) => K.ringDots(ctx, px, sc.u.S, x, y, r0 + (r1 - r0) * easeOut(t), flat, cols, (1 - t) ** 1.2, th) });
    // 3:3 장면 전환 합동 — 전용 구도 구 자리를 알림 (fx-sky jointOrb · #96 아트 5바퀴 1)
    const jointOrb = K.jointOrb;

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
        const cloudY = K.cloudAt(u, bandH * 0.38, bandH * 0.4);
        const TC0 = 0.3;
        const strikesAt = [0.65, 1.05, 1.38, 1.66, 1.9, 2.08];
        const TJ = 2.3; // 뛰어오름
        const TR = 3.3; // 무지개 번개
        const TP = 4.55; // 하늘 번개 기둥
        const TB = 4.85; // 대폭발
        const TD = TB + 2.0; // 내려앉음
        const Rs = clamp(Math.max(me.w * 0.9, short(u) * 0.13), 10 * s, Math.min(H * 0.22, W * 0.2));
        // 게임 화면 = 위 끝 + 몸 반 + 구 (커지는 1.3배까지) + 4칸 아래 (#96 ④)
        const top = clamp(me.b - H * 0.32, Math.max(bandH + me.h * 0.5 + Rs * 1.2, gameTop() > 0 ? gameTop() + me.h * 0.5 + Rs * 1.45 + 4 * s : 0), me.b - me.h * 0.3);
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
        skyBand(sc, '#070914', bandH * 1.2 + cloudY - bandH * 0.38, 0.65, sec);
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
        // 게임 화면 = 웃는 얼굴 (위 끝 ≈ y − 0.46 R − 3칸) · 공 (≈ 1.56 Rb) 이 위 끝 + 4칸 아래 · 던지는 길 꼭대기도 (위 끝에 반쯤 걸쳐 머물던 것 — #96 디자인 4바퀴 · ult-top 걸쳐 머묾)
        const fy0 = Math.max(clamp(H * 0.3, faceR * 0.7, Math.max(faceR * 0.7, G - faceR * 1.6)), gameTop() > 0 ? gameTop() + faceR * 0.5 + 6 * s : 0);
        const Rb = clamp(Math.max(me.w * 0.55, short(u) * 0.1), 6 * s, H * 0.14);
        const ballMin = gameTop() > 0 ? gameTop() + Rb * 1.6 + 4 * s : -Infinity;
        const footAt = (t) => me.b - lift * easeOut(clamp((t - 0.2) / 0.5, 0, 1)) * (t > sec - 0.6 ? clamp((sec - 0.15 - t) / 0.45, 0, 1) : 1) + Math.sin(t * 3) * s;
        const ball = (t) => [me.x + dir * me.w * 0.1, Math.max(ballMin, footAt(t) - me.h - Rb * 1.2)];
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
            jointOrb(o, ctx, x, y, Rb * k, true);
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
            const y = lerp(y0, ey, k * k) - Math.sin(k * Math.PI) * clamp(y0 - ballMin, 0, H * 0.08);
            shadowBall(ctx, px, x, y, Rb * 1.1, life);
            jointOrb(o, ctx, x, y, Rb * 1.1, false, true);
        } });
        sc.at(TB, () => {
            jointOrb(o);
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
        const gcy = K.cloudAt(u, bandH * 0.38, bandH * 0.42);
        skyBand(sc, '#060c18', bandH * 1.2 + gcy - bandH * 0.38, 0.7, sec);
        cloudBank(sc, { y: gcy, h: bandH * 0.42, cols: ['#5f6b86', '#3d4660', '#272e42'], sec, lit: () => (lit > 0 ? 1 : 0), speed: 30 * dir, litCols: ['#ffffff', '#dbe8ff', '#9fb4e0'] });
        K.waterRain(sc, 0.2, sec - 0.4, K.pal.TIDE);
        [0.5, 1.3, 2.2, 3.6].forEach((tb) => sc.at(tb, () => {
            lit = 0.1;
            strike(sc, rnd(0.1, 0.9) * W, gcy - bandH * 0.08, rnd(0.1, 0.9) * W, gcy + bandH * 0.52 + rnd(0, H * 0.1), { w: 1, mid: '#dbe8ff', glow: '#6c88c8', dur: 0.2, branches: 1 });
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
        // 게임 화면 — 진화형 (점 고리 r = 폭 × 0.62 · 둥실 1.5칸까지) 은 연출 위 끝 아래 (#107 — 위쪽 셋이 정보줄 · 지도 줄에 걸쳐 머물던 것 · 크기 그대로) ·
        //   위가 막혀 반원이 납작해지면 가로로 넓혀 일곱이 겹치지 않게
        const bTop = gameTop() > 0 ? gameTop() + ew0 * 1.1 + 4 * s : ew0 * 1.1;
        const squeezed = gameTop() > 0 && cy0 - Rr * 0.85 + ew0 * 0.45 < bTop;
        const Rx = squeezed ? Math.max(Rr, Math.min(W * 0.42, ew0 * 2.8)) : Rr;
        const axw = clamp(me.x, Math.min(W / 2, Rx + ew0 * 0.6), Math.max(W / 2, W - Rx - ew0 * 0.6));
        const evos = EVOS.map(([name, gen, c], i) => {
            const a = -Math.PI * (0.08 + (0.84 * i) / (EVOS.length - 1));
            return { img: evoImg(pokemon.pokemonRoot || '', name, gen), cols: sigPal(c), t0: TA + i * 0.17,
                x: clamp((squeezed ? axw : ax) + Math.cos(a) * Rx, ew0 * 0.6, W - ew0 * 0.6), b: clamp(cy0 + Math.sin(a) * Rr * 0.85 + ew0 * 0.45, Math.min(bTop, G), G), w: ew0 };
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
        // 게임 화면 — 하늘로 솟은 꼭대기에서도 몸은 위 끝 띠 (8px) 아래 (#107 — 오라 윗부분만 위 끝 층)
        const topY = Math.max(me.h * 1.2, G * 0.25, gameTop() > 0 ? gameTop() + 8 + me.h + 2 * s : 0);
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
        // 붉은 분노의 오라 (망나뇽 뒤) — 질주 중엔 뒤로 눕힌 불꽃 꼬리 (위 끝을 넘는 윗부분만 위 끝 층 — #107)
        sc.split({ max: TDIZZY, draw: (ctx, it, tt, px) => {
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
            // 게임 화면 = 오로라 띠 윗끝이 위 끝 + 4칸 아래 (머무는 하늘 장식 — #96 ④)
            const ay = gameTop() > 0 ? Math.max(0, gameTop() + 4 * s - H * 0.065) : 0;
            for (const [col, yk, al] of bands) {
                const path = new Path2D();
                for (let x = 0; x < W; x += c) {
                    const y = ay + H * yk + Math.sin(x * 0.012 + life * 0.9 + yk * 9) * H * 0.04 + Math.sin(x * 0.031 - life * 0.6) * H * 0.015;
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
        // 하늘 꼭대기 초록 별 · 혜성 출발 높이 — 연출 위 끝 + 별 (폭 × 0.45) + 4칸 아래 (정보줄에 반쯤 걸친 빛 덩어리가 1.2초 머물던 것 — UX 리뷰어 #105) · 솟구침 · 내려옴은 화면 밖까지 그대로
        const top0 = gameTop();
        const starY = Math.max(sky * 0.55, top0 > 0 ? top0 + me.w * 0.45 + 4 * s : 0);
        // 혜성이 나타나는 하늘 자리 — 과녁에서 비스듬히 떨어진 곳 (화면 안, 한쪽이 모자라면 반대쪽)
        let sx0 = tx - dir * W * 0.35;
        if (sx0 < W * 0.12 || sx0 > W * 0.88) {
            sx0 = tx + dir * W * 0.35;
        }
        sx0 = clamp(sx0, W * 0.12, W * 0.88);
        const cometAt = (t) => {
            const k = easeIn(clamp((t - TCOMET) / (TI - TCOMET), 0, 1));
            return [lerp(sx0, tx, k), lerp(starY, G - me.h * 0.4, k)];
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
            fireOrb(ctx, px, s, sx0, starY, Math.max(4 * s, me.w * 0.35), RAYQ, life, k, Infinity, 1, 0, [1, 0.8, 0.6, 0.38], 0.4);
            glint(ctx, px, s, sx0, starY, me.w * 0.8 * k, 0.9);
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
            const dy = G - me.h * 0.4 - starY;
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
            ring(sc, sx0, starY, me.w * 0.3, me.w * (1.6 + i * 0.6), 1, 0.4, ['#ffffff', RAYQ[2]], 2);
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
        skyBand(sc, '#08101c', bandH * 1.2 + K.cloudAt(u, bandH * 0.38, bandH * 0.42) - bandH * 0.38, 0.7, sec);
        cloudBank(sc, { y: K.cloudAt(u, bandH * 0.38, bandH * 0.42), h: bandH * 0.42, cols: ['#7a8aa8', '#55617d', '#38405a'], sec, lit: () => (lit > 0 ? 1 : 0), speed: 60 * dir, litCols: ['#ffffff', SILV[1], SILV[2]] });
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
        // 회오리 — 광선 끝에 솟아 감아올림 (하늘까지 닿는 회오리 — 위 끝 층 · #107)
        sc.soft({ max: TB + 0.1, draw: (ctx, it, t, px) => {
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
        // 무지개 (하늘에 걸린 큰 반원 — 몸 뒤 · 위 끝 띠 위만 위 끝 층 · #107)
        sc.split({ max: sec, draw: (ctx, it, t, px) => {
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
        skyBand(sc, '#040a16', bandH * 1.3 + K.cloudAt(u, bandH * 0.38, bandH * 0.45) - bandH * 0.38, 0.75, sec);
        cloudBank(sc, { y: K.cloudAt(u, bandH * 0.38, bandH * 0.45), h: bandH * 0.45, cols: ['#4f5c78', '#323b55', '#20263a'], sec, lit: () => (lit > 0 ? 1 : 0), speed: 35 * dir, litCols: ['#ffffff', ORIGIN[1], ORIGIN[2]] });
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
        // 일그러진 공간 — 분홍 격자 (화면 전체 무늬 — 위 끝 띠만 위 끝 층 · #107)
        sc.split({ max: sec, draw: (ctx, it, t, px) => {
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
        // 화면을 가르는 틈 (화면 끝까지 — 위 끝 층 · #107)
        sc.soft({ max: TCLOSE + 0.1, draw: (ctx, it, t, px) => {
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
                // 게임 화면 — 떠오르는 바위섬은 연출 위 끝 아래에서 멈춰 뜸 (위 끝을 뚫고 올라가 걸쳐 머물던 것 — #107)
                const y = Math.max(isl.y0 - (life - TWORLD) * H * isl.sp, gameTop() > 0 ? gameTop() + isl.z + 2 * s : -Infinity);
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
        const Ro = clamp(me.w * 0.5, 5 * s, H * 0.12);
        // 게임 화면 — 머리 위 빛 구 (불꽃 혀까지 r × 1.45) 는 연출 위 끝 아래 (#107 — 크기 그대로)
        const orbMin = gameTop() > 0 ? gameTop() + Ro * 1.45 + 2 * s : -Infinity;
        const orbAt = (t) => [me.x, Math.max(footAt(t) - me.h - Math.max(me.w * 0.5, 8 * s), orbMin)];
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
        // 쏘아 올림 — 빛 구가 하늘로 (빛줄기 — 하늘로 나가는 빛이라 위 끝 층 · #107)
        sc.soft({ max: TSPLIT + 0.3, draw: (ctx, it, t, px) => {
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
            ringSoft(sc, me.x, gameTop() + s * 4, Ro, W * 0.6, 0.4, 0.6, ['#ffffff', JUDGE[1], JUDGE[2]], 2);
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
            jointOrb(o, ctx, holeX, holeY, R, life < TB - 0.15);
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
            jointOrb(o);
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
        const cloudY = K.cloudAt(u, bandH * 0.38, bandH * 0.42);
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
        skyBand(sc, '#070914', bandH * 1.2 + cloudY - bandH * 0.38, 0.7, sec);
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
        const cloudY = K.cloudAt(u, bandH * 0.38, bandH * 0.42);
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
        skyBand(sc, '#0a0716', bandH * 1.2 + cloudY - bandH * 0.38, 0.7, sec);
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
            // 게임 화면 = 커튼 윗끝이 위 끝 + 4칸 아래 (#96 ④)
            const c0 = gameTop() > 0 ? gameTop() + 4 * s + H * 0.01 : 0;
            for (let x = 0; x < W; x += c) {
                const k = Math.sin(x * 0.015 + life * 0.8) * 0.5 + 0.5;
                const top = c0 + H * (0.05 + 0.06 * Math.sin(x * 0.03 + life));
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
            const gt = gameTop();
            const g0 = gt > 0 ? gt + 3 * s : 0;
            for (let j = 0; j < 30; j++) {
                const x = hash(j, 701) * W;
                const y = g0 + ((hash(j, 702) * (G - g0) + (life - TPUR) * (G - g0) * 0.1) % (G - g0));
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
        // 하늘 번쩍 · 용 머리 (반지름 폭 × 0.7) 출발 자리 — 연출 위 끝 + 반지름 + 4칸 아래 (정보줄에 반쯤 걸친 채 0.5초 머물던 것 — UX 리뷰어 #105)
        const top0 = gameTop();
        const sy0 = Math.max(20, H * 0.12, top0 > 0 ? top0 + Math.max(6 * s, me.w * 0.7) + 4 * s : 0);
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
            return [lerp(tx - dir * W * 0.15, tx, k), lerp(gameTop() > 0 ? Math.max(-me.h, gameTop() - me.h * 0.5) : -me.h, G - me.h * 0.4, k)];
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
        const rl = Math.min(W * 0.15, H * 0.15);
        // 게임 화면 = 공중 몸 (고리 꼬리 rl × 0.6) · 주황 구 (반지름 × 1.3) 가 위 끝 + 4칸 아래 (#96 ④)
        const cy0 = Math.max(H * 0.22, 30, gameTop() > 0 ? gameTop() + me.h * 0.5 + rl * 0.6 + 4 * s : 0);
        const orbY = Math.max(0.6 * cy0, gameTop() > 0 ? gameTop() + Math.max(5 * s, me.w * 0.4) * 1.3 + 4 * s : 0);
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
            fireOrb(ctx, px, s, lerp(x0, cx0, k), lerp(y0 - me.h * 0.5, orbY, k), Math.max(5 * s, me.w * 0.4), DRACO, life, 1, G, 1, 0, [1, 0.8, 0.6, 0.38], 0.5);
        } });
        sc.at(TBURST, () => {
            impactFrames(sc, W, H, 0.5, 0.3);
            ring(sc, cx0, orbY, me.w * 0.3, W * 0.5, 1, 0.5, ['#ffffff', DRACO[1], DRACO[2]], 2);
            ultShake(4, 300);
        });
        // 용성 — 비스듬히 줄지어 (떨어지는 혜성 꼬리가 위 끝 너머로 길게 — 위 끝 층 · #107)
        const fall = (m, big) => {
            const sx = m.x - dir * W * 0.25;
            sc.soft({ max: sec, draw: (ctx, it, t, px) => {
                const life = sc.t;
                const k = (life - m.t0) / m.T;
                if (k < 0 || k > 1) {
                    return;
                }
                const x = lerp(sx, m.x, k);
                const y = lerp(orbY, G - m.r, easeIn(k));
                const dx = m.x - sx;
                const dy = G - orbY;
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
        const Rm = clamp(Math.min(W, H) * 0.12, 14, 70);
        // 게임 화면 — 달 (빛 무리 r × 1.4 까지) 은 연출 위 끝 아래 (#107 — 일반 달 runMoon 과 같은 값 · 크기 그대로)
        const my = Math.max(26, H * 0.2, gameTop() > 0 ? gameTop() + Rm * 1.4 + 2 * s : 0);
        const footAt = (t) => me.b - lift * easeOut(clamp((t - 0.4) / 0.6, 0, 1)) * (1 - easeIn(clamp((t - (sec - 0.6)) / 0.45, 0, 1))) + Math.sin(t * 2.5) * s * 1.5;
        const hand = (t) => [me.x + dir * me.w * 0.35, footAt(t) - me.h * 0.55];
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * W * 0.45, W * 0.1, W * 0.9);
        const sc = scene(u, sec + 0.4, 'uniq gardevoir');
        ultDark(0.5, ms - 200);
        // 보름달 — 떠오름 · 크게 빛남 (달 몸은 위 끝 아래 · 빛날 때 커지는 빛 무리 (r × 2.4) 는 위 끝 층에서 흩어짐 — #107)
        sc.split({ max: sec, draw: (ctx, it, t, px) => {
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
            ringSoft(sc, mx, my, Rm, Rm * 3, 1, 0.5, ['#ffffff', MOON[1]], 2);
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
        const Rm = clamp(Math.min(W, H) * 0.1, 12, 60);
        // 게임 화면 — 달 · 일식 빛살 (r × 1.9 까지) 은 연출 위 끝 아래 (#107 — 크기 그대로)
        const my = Math.min(Math.max(28, H * 0.2, gameTop() > 0 ? gameTop() + Rm * 1.9 + 2 * s : 0), G - Rm * 1.2);
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
            jointOrb(o, ctx, x, y, R, true);
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
            jointOrb(o);
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
        // 거품 (에브이 뒤 — 몸 가운데에서 무대 높이보다 크게 부풀어 자리를 옮길 수 없음: 크기 그대로 위 끝 층 · #107)
        //   옅은 속 · 테 · 반짝 · 반사광 모두 위 끝 띠 아래는 큰 캔버스 (몸 뒤 그대로) · 띠 위만 위 끝 층 (sc.split — 코드 리뷰어 #107)
        sc.split({ max: TB + 0.02, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life >= TBUB) {
                ellipse(ctx, px, s, me.x, cy, bubR(life), bubR(life) * 0.9, ESPC[2], 0.14 * clamp((life - TBUB) / 0.3, 0, 1));
            }
        } });
        sc.split({ max: TB + 0.02, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TBUB) {
                return;
            }
            const R = bubR(life);
            const a = clamp((life - TBUB) / 0.3, 0, 1);
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
        const rr = Math.min(W * 0.3, H * 0.2);
        // 게임 화면 — 하늘에서 그리는 원 (발 높이 · 위로 rr × 0.6) 은 몸 전체가 연출 위 끝 아래 (#107 — 정보줄 · 지도 줄에 걸쳐 1.3초 돌던 것)
        const cy0 = Math.min(Math.max(H * 0.28, 40, gameTop() > 0 ? gameTop() + me.h + rr * 0.6 + 2 * s : 0), G - rr * 0.6);
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
            // 게임 화면 — 별 · 하트는 연출 위 끝 아래에서만 (#107)
            const y0 = gameTop() > 0 ? gameTop() + z * 3 : 0;
            for (let j = 0; j < 26; j++) {
                const x = hash(j, 781) * W;
                const y = y0 + hash(j, 782) * Math.max(s, G * 0.7 - y0);
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
                    // 하트 불꽃놀이 — 터지는 곳은 위 끝 아래 · 퍼지는 고리는 위 끝 층 (#107)
                    const y = Math.max(G * (0.25 + 0.2 * hash(i, 792)), gameTop() + 4 * s);
                    sparkles(x, y, s, ['#ffffff', LOVELY[2], LOVELY[3], '#ffd6f0'], 18, Math.max(W * 0.06, 12), H * 0.15);
                    ringSoft(sc, x, y, s * 2, W * 0.07, 1, 0.5, [LOVELY[2], LOVELY[3]], 2);
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
            stMergePillar(sc, me.x, G, clamp(me.w * 0.9, 8 * s, W * 0.16), ringR * 0.6, 1.9, FIRE);
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
            for (const sd of [-1, 1]) {
                const gx = clamp(tx + sd * Math.max(Rg * 1.6, W * 0.12), W * 0.05, W * 0.95);
                sc.at(TB + 0.18, () => K.geyser(sc, gx, G, Math.max(3 * s, Rg * 0.2), G * 0.55, 1.0, TIDE));
            }
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
        // 꼭대기 (발) — 불꽃 바퀴 (몸 위로 폭 × 0.35 · ±2칸 출렁임 · 불꽃 가시) 가 연출 위 끝 + 8칸 아래 (꼭대기 바퀴가 정보줄 뒤로 숨던 것 — #105) · 그래도 몸 키 × 0.35 는 뜀
        const top0 = gameTop();
        const topY = Math.min(me.b - me.h * 0.35, Math.max(me.h * 1.2, G * 0.25, top0 > 0 ? top0 + me.h + me.w * 0.35 + 10 * s : 0));
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
            stGroundBlaze(sc, tx, G, W * 0.4, me.h * 0.9, sec - TI, FIRE);
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
            const mx0 = clamp(me.x + dir * far * 0.7, W * 0.08, W * 0.92);
            groundArcs(sc, mx0, G - s, W * 0.45, sec - TB, MUD[MUD.length - 1], 8, 2, G - s);
            ring(sc, mx0, G - s, me.w * 0.5, W * 0.4, 0.2, 0.7, [MUD[0], MUD[1]], 3);
            for (let i = 0; i < 4; i++) {
                sc.at(TB + 0.3 + i * 0.35, () => {
                    for (let j = 0; j < 12; j++) {
                        debris(rnd(0, W), -s * 4, s, MUD, 1, H * 0.2, { angle: Math.PI / 2, spread: 0.4, ground: G, life: 1.4 });
                    }
                });
            }
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
        // 거대한 잎 칼날 — 화면을 비스듬히 가름 (화면 끝에서 끝까지 — 위 끝 층 · #107)
        sc.soft({ max: TB + 0.6, draw: (ctx, it, t, px) => {
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
            ring(sc, tx, G - me.h * 0.5, me.w * 0.4, W * 0.35, 0.6, 0.6, ['#ffffff', VINEC[0], VINEC[1]], 3);
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
            stLineBlasts(sc, me.x, G, Math.max(me.w * 1.1, W * 0.1), 5, TB + 0.05, FIRE, Math.max(me.w * 0.5, 8 * s));
            stFlameCrown(sc, me.x, me.b - me.h * 1.05, Math.max(me.w * 0.6, 8 * s), sec - TB, FIRE);
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
            K.crownSplash(sc, clamp(bx, W * 0.08, W * 0.92), G, Math.max(bw * 2, H * 0.15), 0.9, TIDE);
            K.geyser(sc, clamp(bx, W * 0.08, W * 0.92), G, Math.max(4 * s, bw * 0.6), G * 0.75, 1.2, TIDE);
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
            ring(sc, clamp(last.x, W * 0.08, W * 0.92), G - s, me.w * 0.5, W * 0.35, 0.22, 0.6, ['#ffffff', VINEC[0], VINEC[1]], 3);
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
        // 게임 화면 — 제트 원 꼭대기에서도 몸 전체가 연출 위 끝 아래 (세로 반지름만 줄임 — #107)
        const ryMax = gameTop() > 0 ? Math.max(s, (hoverY - gameTop() - me.h - 2 * s) / 1.3) : Infinity;
        const posAt = (t) => {
            if (t < TJ0) {
                return [me.x, lerp(me.b, hoverY, easeOut(t / TJ0))];
            }
            if (t < TJ0 + JET) {
                const k = (t - TJ0) / JET;
                const an = Math.PI + k * TAU * dir;
                const rx = W * 0.38;
                const ry = Math.min(H * 0.22, ryMax);
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
                jointOrb(o, ctx, x, y, Rb * easeOut((life - TC0) / (TT - TC0)), true);
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
            jointOrb(o, ctx, x, y, Rb, false, true);
        } });
        sc.at(TT, () => {
            impactFrames(sc, W, H, 0.5, 0.3);
            ultShake(3, 200);
        });
        sc.at(TB, () => {
            jointOrb(o);
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
            // 게임 화면 — 별은 연출 위 끝 아래에서만 (반짝이며 머무는 별이 위 끝에 걸쳐 2초 — #107)
            const y0 = gameTop() > 0 ? gameTop() + 3 * s : 0;
            for (let j = 0; j < 30; j++) {
                if (life - TQUIET < j * 0.04) {
                    continue;
                }
                const x = hash(j, 851) * W;
                const y = y0 + hash(j, 852) * Math.max(s, G * 0.6 - y0);
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
        // 하늘로 빛줄기 (하늘로 나가는 빛 — 위 끝 층 · #107)
        sc.soft({ max: TQUIET + 0.2, draw: (ctx, it, t, px) => {
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
        // 빛기둥 비 (하늘에서 내려오는 빛기둥 — 위 끝 층 · #107)
        spots.slice(0, NL).forEach((sp, i) => {
            const t0 = TRAIN + i * 0.14;
            sc.soft({ max: sec, draw: (ctx, it, t, px) => {
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
        // 커다란 별 (하늘에서 떨어짐 — 위 끝에서 나타남: 위 끝 층 · #107)
        sc.soft({ max: TBIG + 0.05, draw: (ctx, it, t, px) => {
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
            stLavaRing(sc, tx, G, Math.max(me.w * 2.4, W * 0.24), sec - TI);
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
            K.geyser(sc, bx, G, Math.max(5 * s, me.w * 0.5), G * 0.8, 1.2, TIDE);
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
            const mid = clamp(vines[Math.floor(NV / 2)].x, W * 0.12, W * 0.88);
            stSpikeBurst(sc, mid, G, Math.max(me.h * 0.8, 10 * s), 15);
            ring(sc, mid, G - s, me.w * 0.5, W * 0.3, 0.22, 0.5, ['#ffffff', VINEC[0], VINEC[1]], 3);
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
            stMagicRise(sc, tx, G, Math.max(me.w * 1.6, W * 0.13), sec - TB, FIRE);
            ultShake(9 + 3 * P, 1100);
            for (const r of u.others()) {
                sc.at(TB + 0.1, () => hit(where(u, r), away(u, tx), 'tumble', 0.3));
            }
        });
        emberRise(sc, TB + 0.4, sec, FIRE);
    }

    // ═════ 샤미드 — 하이드로보텍스 (ultvortex) ═════
    // 몸이 물에 녹듯 투명해지며 물웅덩이로 사라짐(녹기) → 앞쪽에 거대한 물 회오리가 솟고 그 꼭대기에 샤미드가 나타나 빙글빙글 돎
    // → 회오리가 과녁 쪽으로 밀려가 닿은 애를 감아올림 → 물기둥째 터지며 왕관 물보라 · 물빛 빛의 반구 → 물웅덩이에서 다시 나타남 (약 7.2초)
    UNIQ.vaporeon = { fx: 'ultvortex', ms: (P) => 7200 + 200 * P, run: runVaporVortex };
    function runVaporVortex(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TIDE = K.pal.TIDE;
        const TMELT = 0.4;
        const TGONE = 1.2;
        const TV = 1.5; // 회오리
        const VSEC = 2.2;
        const TB = TV + VSEC;
        const TBACK = sec - 0.7;
        const x0 = clamp(me.x + dir * W * 0.25, W * 0.12, W * 0.88);
        const q = nearest(u);
        const x1 = clamp(q ? q.x : me.x + dir * W * 0.6, W * 0.12, W * 0.88);
        const vx = (t) => lerp(x0, x1, easeOut(clamp((t - TV - 0.5) / (VSEC - 0.5), 0, 1)));
        const topAt = (t) => G - (G - Math.max(me.h * 1.4, H * 0.15)) * easeOut(clamp((t - TV) / 0.5, 0, 1));
        const sc = scene(u, sec + 0.4, 'uniq vaporeon');
        ultDark(0.4, ms - 200);
        // 물웅덩이 — 사라진 자리 · 돌아올 자리
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - TMELT) / 0.4, 0, 1) * (1 - clamp((life - TBACK - 0.4) / 0.3, 0, 1));
            if (k > 0.02) {
                ellipse(ctx, px, s, me.x, G - s, me.w * 0.7 * k, me.w * 0.12 * k, TIDE[2], 0.8, G + s);
                K.swirlRing(ctx, px, s, me.x, G - s, me.w * 0.6 * k, 0.2, life, dir, TIDE, k);
            }
        } });
        // 물 회오리 — 층마다 도는 물살
        sc.add({ max: TB + 0.1, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TV) {
                return;
            }
            const top = topAt(life);
            const fade = life > TB ? 1 - (life - TB) / 0.1 : 1;
            const cx = vx(life);
            const rows = Math.max(8, Math.round((G - top) / (2 * s)));
            for (let i = 0; i < rows; i++) {
                const f = i / rows;
                const y = G - f * (G - top);
                const rw = (W * 0.03 + f * f * W * 0.11) * (0.9 + 0.1 * Math.sin(life * 8 + i));
                for (let j = 0; j < 4; j++) {
                    const an = life * 9 + i * 0.5 + (j * TAU) / 4;
                    const front = Math.sin(an) > 0;
                    const z = Math.max(s, Math.round((rw * 0.15) / s) * s);
                    ctx.globalAlpha = (front ? 0.95 : 0.45) * fade;
                    ctx.fillStyle = front ? (j % 2 ? '#ffffff' : TIDE[1]) : TIDE[3];
                    ctx.fillRect(px(cx + Math.cos(an) * rw - z), px(y), z * 2.5, Math.max(s, z * 0.7));
                }
            }
        } });
        // 샤미드 (꼭두각시) — 녹아 사라짐 · 회오리 꼭대기 · 다시 나타남
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
                const k = clamp((life - TMELT) / (TGONE - TMELT), 0, 1);
                drawLitMon(ctx, img, me.x, me.b + me.h * 0.3 * k * k, me.w, dir < 0, TIDE[2], edge, 1 - k);
                if (k > 0) {
                    drawMon(ctx, img, me.x, me.b + me.h * 0.3 * k * k, me.w, dir < 0, 0.6 * k * (1 - k), TIDE[1]);
                }
                return;
            }
            if (life > TV + 0.4 && life < TB) {
                const an = life * 6;
                drawLitMon(ctx, img, vx(life) + Math.cos(an) * W * 0.03, topAt(life) - s * 2, me.w * 0.9, Math.cos(an) > 0 ? dir > 0 : dir < 0, TIDE[2], edge, 1);
                return;
            }
            if (life > TBACK) {
                const k = clamp((life - TBACK) / 0.5, 0, 1);
                drawLitMon(ctx, img, me.x, me.b + me.h * 0.3 * (1 - k) * (1 - k), me.w, dir < 0, TIDE[2], edge, k);
            }
        } });
        sc.at(TV, () => {
            impactFrames(sc, W, H, 0.5, 0.3);
            K.splash(x0, G - s, s, TIDE, 20, H * 0.7);
            ultShake(4, VSEC * 1000);
        });
        sc.tick((t) => {
            if (t < TV + 0.3 || t > TB) {
                return;
            }
            const cx = vx(t);
            for (const r of u.others()) {
                if (Math.abs(r.x - cx) < W * 0.08 + r.w * 0.4) {
                    hit(where(u, r), dir, 'spin', 0.8);
                }
            }
        });
        sc.at(TB, () => {
            impactFrames(sc, W, H, 0.6, 0.4);
            K.crownSplash(sc, x1, G, Math.max(me.w, H * 0.15), 1.0, TIDE);
            blastDome(sc, x1, G, clamp(Math.max(H * 0.48, W * 0.22), 30, Math.min(G * 0.92, W * 0.48)), 1.8, TIDE);
            ultShake(8 + 2 * P, 1000);
        });
        K.waterRain(sc, TB + 0.4, sec - 0.2, TIDE);
    }

    // ═════ 쥬피썬더 — 번개 (ultthunder) ═════
    // 털이 바늘처럼 곤두서며 전기가 지직 · 몸 둘레로 노란 가시 후광 → 번개 바늘을 사방으로 연달아 쏨(닿은 애 벌러덩)
    // → 하늘에서 번개가 차례로 내리꽂힘 → 마지막 굵은 번개 기둥 · 노란 빛의 반구 (약 7.0초)
    UNIQ.jolteon = { fx: 'ultthunder', ms: (P) => 7000 + 200 * P, run: runJolteonThunder };
    function runJolteonThunder(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const bandH = Math.max(40, H * 0.28);
        const cloudY = K.cloudAt(u, bandH * 0.38, bandH * 0.4);
        const TSPIKE = 0.3;
        const TNEED = 1.3; // 번개 바늘
        const NN = 16;
        const TBOLT = TNEED + 1.0; // 번개
        const NB = 6;
        const TI = TBOLT + NB * 0.15 + 0.3;
        const cy = me.b - me.h * 0.5;
        const q = nearest(u);
        const fx0 = clamp(q ? q.x : me.x + dir * W * 0.45, W * 0.1, W * 0.9);
        const sc = scene(u, sec + 0.4, 'uniq jolteon');
        ultDark(0.45, ms - 200);
        let lit = 0;
        sc.tick((t, dt) => {
            lit = Math.max(0, lit - dt);
        });
        skyBand(sc, '#070914', bandH * 1.2 + cloudY - bandH * 0.38, 0.65, sec);
        cloudBank(sc, { y: cloudY, h: bandH * 0.4, cols: ['#6b7090', '#454a63', '#2c3045'], sec, lit: () => (lit > 0 ? 1 : 0), speed: 25 * dir, litCols: ['#ffffff', ZAPC[1], ZAPC[2]] });
        // 가시 후광 (쥬피썬더 뒤)
        sc.add({ max: TI + 0.3, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - TSPIKE) / 0.3, 0, 1) * (1 - clamp((life - TI) / 0.3, 0, 1));
            if (k <= 0.02) {
                return;
            }
            for (let j = 0; j < 18; j++) {
                const an = (j / 18) * TAU + Math.sin(life * 20 + j) * 0.05;
                const r0 = Math.max(me.w, me.h) * 0.5;
                const len = Math.max(me.w, me.h) * (0.35 + 0.15 * Math.sin(life * 15 + j * 2)) * k;
                for (let d = 0; d < len; d += s) {
                    const w = Math.max(s, Math.round(((1 - d / len) * s * 3) / s) * s);
                    ctx.globalAlpha = 0.95;
                    ctx.fillStyle = d > len * 0.6 ? '#ffffff' : ZAPC[2];
                    ctx.fillRect(px(me.x + Math.cos(an) * (r0 + d) - w / 2), px(cy + Math.sin(an) * (r0 + d) - w / 2), w, w);
                }
            }
        } });
        puppet(sc, pokemon, u, () => me.b, ZAPC[2], sec - 0.1, { glow: (t) => clamp((t - TSPIKE) / 0.5, 0, 1) * 0.15 * (1 + Math.sin(t * 20)), glowColor: '#ffffff' });
        // 번개 바늘 — 사방으로
        for (let i = 0; i < NN; i++) {
            const t0 = TNEED + i * 0.05;
            const an = -Math.PI + (i / (NN - 1)) * Math.PI;
            const L = Math.max(W, H) * 0.7;
            sc.add({ max: sec, draw: (ctx, it, t, px) => {
                const life = sc.t;
                const k = (life - t0) / 0.4;
                if (k < 0 || k > 1) {
                    return;
                }
                const d = L * easeOut(k);
                const x = me.x + Math.cos(an) * d;
                const y = cy + Math.sin(an) * d * 0.7;
                const ux = Math.cos(an);
                const uy = Math.sin(an) * 0.7;
                ctx.globalAlpha = 1 - k * 0.5;
                for (let j = 0; j < 6; j++) {
                    ctx.fillStyle = j < 2 ? '#ffffff' : ZAPC[2];
                    ctx.fillRect(px(x - ux * j * s * 1.5), px(y - uy * j * s * 1.5), s * (j < 2 ? 2 : 1), s * (j < 2 ? 2 : 1));
                }
            } });
        }
        sc.at(TNEED, () => {
            ring(sc, me.x, cy, me.w * 0.5, me.w * 2.6, 0.85, 0.35, ['#ffffff', ZAPC[2]], 2);
            ultShake(3, 300);
            for (const r of u.others()) {
                sc.at(TNEED + 0.2, () => hit(where(u, r), away(u, me.x), 'tumble', 0.8));
            }
        });
        // 하늘 번개 — 차례로
        for (let i = 0; i < NB; i++) {
            sc.at(TBOLT + i * 0.15, () => {
                const x = clamp(fx0 + (hash(i, 881) - 0.5) * W * 0.6, W * 0.05, W * 0.95);
                strike(sc, x + rnd(-1, 1) * W * 0.03, cloudY, x, G - s, { w: 3, mid: ZAPC[1], glow: ZAPC[3], dur: 0.3, branches: 2 });
                lit = 0.1;
                ring(sc, x, G - s, s * 2, W * 0.08, 0.25, 0.35, ['#ffffff', ZAPC[2]], 2);
                fireBits(x, G - s, s, ZAPC, 8, { angle: -Math.PI / 2, spread: 2, speed: H * 0.5, g: H * 1.5, life: 0.5 });
                ultShake(2.5, 120);
            });
        }
        sc.at(TI, () => {
            impactFrames(sc, W, H, 0.8, 0.5);
            strike(sc, fx0, 0, fx0, G - s, { w: 7, mid: ZAPC[1], glow: ZAPC[3], dur: 0.6, branches: 4 });
            K.firePillar(sc, fx0, G, clamp(W * 0.1, 8 * s, W * 0.18), 1.4, ZAPC);
            blastDome(sc, fx0, G, clamp(Math.max(H * 0.48, W * 0.22), 30, Math.min(G * 0.92, W * 0.48)), 1.8, ZAPC);
            lit = 0.4;
            ultShake(9 + 3 * P, 1100);
            for (const r of u.others()) {
                sc.at(TI + 0.1, () => hit(where(u, r), away(u, fx0), 'lift', 0.3));
            }
        });
        emberRise(sc, TI + 0.4, sec, ZAPC);
    }

    // ═════ 부스터 — 오버히트 (ultorb) ═════
    // 목털이 부풀며 점점 하얗게 달아오름(아지랑이 · 김) → 머리 위 불꽃 구가 주황 → 노랑 → 하얀 푸른빛으로 끓어오름 → 던짐
    // → 닿은 자리 하얀 대폭발 · 주황빛 빛의 반구 → 원작처럼 지쳐서 머리 위에 푸른 화살표가 내려감(특수공격이 떨어졌다!) · 김이 모락 (약 7.2초)
    UNIQ.flareon = { fx: 'ultorb', ms: (P) => 7200 + 200 * P, run: runOverheat };
    function runOverheat(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TC0 = 0.4;
        const TT = 2.6; // 던짐
        const FLY = 0.5;
        const TB = TT + FLY;
        const TDROP = TB + 1.0; // 지침
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * W * 0.45, W * 0.1, W * 0.9);
        const Rb = clamp(Math.max(me.w * 0.6, H * 0.08), 6 * s, H * 0.16);
        // 게임 화면 = 구 (불 혀 · 반짝 1.5 Rb) 가 위 끝 + 4칸 아래 · 던지는 길 꼭대기도 (위 끝에 반쯤 걸쳐 머물던 것 — #96 디자인 4바퀴 · ult-top 걸쳐 머묾)
        const bTop = gameTop() > 0 ? gameTop() + Rb * 1.5 + 4 * s : -Infinity;
        const ballY = Math.max(bTop, me.b - me.h - Rb * 1.1);
        const ball = () => [me.x, ballY];
        const heat = (t) => clamp((t - TC0) / (TT - TC0), 0, 1);
        const palAt = (k) => (k < 0.4 ? ['#ffffff', '#fff3a0', '#ff8a2a', '#c8201a'] : k < 0.75 ? ['#ffffff', '#ffffd0', '#ffd23b', '#ff7a1a'] : ['#ffffff', '#f0f8ff', '#bfe9ff', '#ffb04a']);
        const sc = scene(u, sec + 0.4, 'uniq flareon');
        ultDark(0.4, ms - 200);
        // 아지랑이 · 김
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp((life - TC0) / 0.6, 0, 1) * clamp((sec - 0.3 - life) / 0.5, 0, 1);
            ctx.globalAlpha = 0.5 * a;
            ctx.fillStyle = '#ffe8c0';
            for (let j = 0; j < 12; j++) {
                const ph = (life * 0.6 + j / 12) % 1;
                const x = me.x + (hash(j, 891) - 0.5) * me.w * 1.6 + Math.sin(life * 4 + j) * s * 2;
                const y = me.b - me.h * (0.5 + ph * 1.5);
                ctx.fillRect(px(x), px(y), s * 2, s);
            }
        } });
        puppet(sc, pokemon, u, () => me.b, '#ff8a2a', sec - 0.1, { glow: (t) => (t < TT ? heat(t) * 0.45 * (0.7 + 0.3 * Math.sin(t * 14)) : t < TDROP ? 0.1 : 0), glowColor: '#fff3d0' });
        // 불꽃 구 — 끓어오르며 색이 바뀜
        chargeSwirl(sc, ball, TC0, TT - 0.05, Math.max(me.w * 3.5, short(u) * 0.42), Math.max(s * 4, Rb * 0.6), ['#ffffff', '#fff3a0', '#ff8a2a', '#c8201a'], dir);
        sc.add({ max: TB + 0.02, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TC0) {
                return;
            }
            const k = heat(life);
            let [x, y] = ball(life);
            if (life > TT) {
                const f = (life - TT) / FLY;
                x = lerp(x, tx, f);
                y = lerp(y, G - Rb, f * f) - Math.sin(f * Math.PI) * clamp(ballY - bTop, 0, H * 0.08);
            }
            fireOrb(ctx, px, s, x, y, Rb * (0.3 + 0.7 * easeOut(k)) * (1 + 0.08 * Math.sin(life * 25)), palAt(k), life, 1, G, 1, 0, [1, 0.85, 0.65, 0.4], 0.7);
            jointOrb(o, ctx, x, y, Rb * (0.3 + 0.7 * easeOut(k)), life <= TT, life > TT);
            if (k > 0.75) {
                glint(ctx, px, s, x, y, Rb * 1.3, 0.8);
            }
        } });
        sc.at(TT, () => {
            impactFrames(sc, W, H, 0.6, 0.35);
            ultShake(4, 300);
        });
        sc.at(TB, () => {
            jointOrb(o);
            impactFrames(sc, W, H, 0.85, 0.5);
            const FIRE = ['#ffffff', '#fff3a0', '#ff8a2a', '#c8201a'];
            K.firePillar(sc, tx, G, clamp(Rb * 2, 8 * s, W * 0.2), 1.3, FIRE);
            blastDome(sc, tx, G, clamp(Math.max(H * 0.52, W * 0.25), 30, Math.min(G * 0.92, W * 0.5)), 1.9, FIRE);
            ultShake(10 + 3 * P, 1300);
            for (const r of u.others()) {
                sc.at(TB + 0.1, () => hit(where(u, r), away(u, tx), Math.abs(r.x - tx) < W * 0.2 ? 'tumble' : 'lift', 0.3));
            }
        });
        // 지침 — 푸른 화살표가 내려감 · 김
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TDROP) {
                return;
            }
            const a = clamp((life - TDROP) / 0.2, 0, 1) * clamp((sec - 0.2 - life) / 0.3, 0, 1);
            const z = Math.max(s, Math.round((me.w * 0.06) / s) * s);
            for (let i = 0; i < 2; i++) {
                const ph = ((life - TDROP) * 1.2 + i * 0.5) % 1;
                const x = me.x + (i - 0.5) * me.w * 0.4;
                const y = me.b - me.h * 1.3 + ph * me.h * 0.5;
                ctx.globalAlpha = a * Math.sin(ph * Math.PI);
                ctx.fillStyle = '#5aa0ff';
                ctx.fillRect(px(x - z * 0.5), px(y - z * 3), z, z * 3);
                ctx.fillRect(px(x - z * 2), px(y), z * 4, z);
                ctx.fillRect(px(x - z), px(y + z), z * 2, z);
                ctx.fillStyle = '#d8ecff';
                ctx.fillRect(px(x - z * 0.5), px(y - z * 3), Math.max(s, z * 0.5), z * 3);
            }
        } });
    }

    // ═════ 리피아 — 리프블레이드 (ultbarrage) ═════
    // 하늘에서 햇살 줄기가 꼬리 잎으로 모여 잎이 금빛으로 길게 자라남 → 높이 뛰어올라 몸을 돌리며 꼬리로 내리벰
    // → 위에서 아래로 내리긋는 거대한 햇빛 잎 칼날(초록 · 금빛) → 베인 땅에서 햇빛이 솟고 잎 폭풍 · 초록 빛의 반구 (약 7.0초)
    UNIQ.leafeon = { fx: 'ultbarrage', ms: (P) => 7000 + 200 * P, run: runSolarLeafBlade };
    function runSolarLeafBlade(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const VINEC = K.pal.VINE;
        const SUNC = K.pal.SUN;
        const TSUN = 0.4;
        const TJ = 2.0;
        const TTOP = TJ + 0.4;
        const TCUT = TTOP + 0.25; // 내리벰
        const TB = TCUT + 0.3;
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * W * 0.4, W * 0.12, W * 0.88);
        // 게임 화면 — 뛰어오른 꼭대기 (발 높이) 는 몸 · 꼬리 칼날까지 연출 위 끝 아래 (#107)
        const topY = Math.max(me.h * 1.2, G * 0.2, gameTop() > 0 ? gameTop() + me.h * 1.15 + 2 * s : 0);
        const posAt = (t) => {
            if (t < TJ) {
                return [me.x, me.b, 0];
            }
            if (t < TTOP) {
                const k = easeOut((t - TJ) / (TTOP - TJ));
                return [lerp(me.x, tx - dir * me.w * 0.6, k), lerp(me.b, topY, k), k * TAU * dir];
            }
            if (t < TB + 0.8) {
                const k = easeIn(clamp((t - TTOP) / 0.35, 0, 1));
                return [tx - dir * me.w * 0.6, lerp(topY, G, k), 0];
            }
            const k = easeOut(clamp((t - TB - 0.8) / 0.5, 0, 1));
            return [lerp(tx - dir * me.w * 0.6, me.x, k), G - Math.sin(k * Math.PI) * me.h * 0.5, 0];
        };
        const tail = (t) => {
            const [x, b] = posAt(t);
            return [x - dir * me.w * 0.4, b - me.h * 0.6];
        };
        const sc = scene(u, sec + 0.4, 'uniq leafeon');
        ultDark(0.4, ms - 200);
        // 햇살 줄기 — 하늘에서 꼬리로 (하늘에서 내려오는 빛 — 몸 뒤 · 위 끝 띠 위만 위 끝 층 · #107)
        sc.split({ max: TJ + 0.2, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TSUN) {
                return;
            }
            const k = clamp((life - TSUN) / 0.4, 0, 1) * (1 - clamp((life - TJ) / 0.2, 0, 1));
            const [x, y] = tail(life);
            for (let j = 0; j < 3; j++) {
                const sx = x + (j - 1) * W * 0.12;
                const dx = x - sx;
                const dy = y;
                const L = Math.hypot(dx, dy) || 1;
                beamBody(ctx, px, s, sx, 0, dx / L, dy / L, L, Math.max(2 * s, me.w * 0.12), SUNC, life + j, 0.55 * k);
            }
        } });
        // 금빛 잎 칼날 (꼬리)
        sc.add({ max: TCUT + 0.1, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TSUN + 0.3) {
                return;
            }
            const k = easeOut(clamp((life - TSUN - 0.3) / 1.2, 0, 1));
            const [x, y] = tail(life);
            const L = me.w * (0.4 + 0.8 * k);
            const ang = life > TJ ? -Math.PI / 2 + (life - TJ) * 8 * dir : -Math.PI / 2 - dir * 0.6;
            for (let d = 0; d < L; d += s) {
                const w = Math.max(s, Math.round((Math.sin((d / L) * Math.PI) * me.w * 0.14) / s) * s);
                ctx.globalAlpha = 1;
                ctx.fillStyle = d > L * 0.7 ? SUNC[1] : VINEC[1];
                ctx.fillRect(px(x + Math.cos(ang) * d - w / 2), px(y + Math.sin(ang) * d - w / 2), w, w);
            }
            glint(ctx, px, s, x + Math.cos(ang) * L, y + Math.sin(ang) * L, me.w * 0.2 * k, k);
        } });
        // 리피아 (꼭두각시)
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
            drawLitMon(ctx, img, x, b, me.w, dir < 0, VINEC[1], edge, 1, rot);
            if (life > TSUN && life < TJ) {
                drawMon(ctx, img, x, b, me.w, dir < 0, 0.12 * (1 + Math.sin(life * 10)), SUNC[1], rot);
            }
        } });
        sc.at(TJ, () => {
            ring(sc, me.x, G - s, me.w * 0.4, me.w * 2.5, 0.25, 0.4, ['#ffffff', VINEC[1]], 2);
            ultShake(3, 250);
        });
        // 거대한 햇빛 잎 칼날 — 위에서 아래로 (하늘 끝에서 내리그음 — 위 끝 층 · #107)
        sc.soft({ max: TB + 0.6, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TCUT) {
                return;
            }
            const k = clamp((life - TCUT) / 0.15, 0, 1);
            const fade = clamp(1 - (life - TCUT - 0.35) / 0.5, 0, 1);
            const L = G * 0.95;
            const x0 = tx + dir * me.w * 0.3;
            for (let d = 0; d < L * k; d += s) {
                const f = d / L;
                const w = Math.max(s, Math.round((Math.sin(f * Math.PI) * Math.max(me.w * 0.6, W * 0.06)) / s) * s);
                const x = x0 - dir * Math.sin(f * Math.PI) * w * 0.4;
                const y = G * 0.03 + d;
                ctx.globalAlpha = fade;
                ctx.fillStyle = VINEC[3];
                ctx.fillRect(px(x - w / 2 - s), px(y), w + 2 * s, s);
                ctx.fillStyle = VINEC[1];
                ctx.fillRect(px(x - w / 2), px(y), w, s);
                ctx.fillStyle = SUNC[1];
                ctx.fillRect(px(x - w * 0.15), px(y), Math.max(s, w * 0.3), s);
            }
        } });
        sc.at(TCUT, () => {
            impactFrames(sc, W, H, 0.7, 0.45);
            ultShake(5, 300);
        });
        sc.at(TB, () => {
            K.firePillar(sc, tx, G, clamp(me.w * 0.8, 8 * s, W * 0.16), 1.2, SUNC);
            blastDome(sc, tx, G, clamp(Math.max(H * 0.45, me.w * 2.8), 30, Math.min(G * 0.92, W * 0.45)), 1.8, VINEC);
            ultShake(9 + 3 * P, 1100);
            for (const r of u.others()) {
                sc.at(TB + 0.08, () => hit(where(u, r), away(u, tx), Math.abs(r.x - tx) < W * 0.2 ? 'tumble' : 'lift', 0.3));
            }
            for (let i = 0; i < 50 && room(1); i++) {
                const a = rnd(-Math.PI, 0);
                const sp = H * rnd(0.4, 1);
                sigParticle({ x: tx, y: G - s * 4, s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: H * 0.3, drag: 1.4, max: rnd(0.8, 1.4), color: pick([VINEC[0], VINEC[1], SUNC[1]]), ph: rnd(0, TAU),
                    draw: (ctx, p, tt, px) => {
                        ctx.globalAlpha = Math.min(1, (1 - tt) * 3);
                        ctx.fillStyle = p.color;
                        const path = new Path2D();
                        K.petalAt(path, px, p.s, p.x, p.y, p.s * 2, Math.sin(p.life * 10 + p.ph) > 0);
                        ctx.fill(path);
                    } });
            }
        });
    }

    // ═════ 글레이시아 — 냉동빔 (ultbeam) ═════
    // 몸에서 다이아몬드 가루가 반짝이며 둘레에 얼음 거울(육각 결정) 여섯이 떠오름 → 입 앞에 얼음 빛이 모임
    // → 냉동빔이 거울에서 거울로 튕기며 지그재그로 날아가 과녁에 꽂힘(튕길 때마다 번쩍) → 과녁이 얼음 덩어리에 갇혔다 와장창 · 하늘빛 빛의 반구 (약 7.2초)
    UNIQ.glaceon = { fx: 'ultbeam', ms: (P) => 7200 + 200 * P, run: runIceMirrors };
    function runIceMirrors(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const ICEP = ['#ffffff', '#e8fbff', '#9fe8ff', '#4aa8e0'];
        const TM = 0.6; // 거울
        const TC0 = 1.4;
        const TF = 2.4; // 쏨
        const SEG = 0.14; // 거울 하나 지나는 시간
        const NM = 6;
        const q = nearest(u);
        const tq = q || null;
        const tx = clamp(q ? q.x : me.x + dir * W * 0.7, W * 0.08, W * 0.92);
        const ty = q ? q.y : G - me.h * 0.5;
        const [mx, my] = [u.mouth.x + dir * s * 2, u.mouth.y];
        const mirrors = [];
        // 게임 화면 — 위쪽 거울 (육각 r 최대 min(W, H) × 0.05 · 번쩍 빛 × 1.6) 은 연출 위 끝 아래 (#107 — 거울 셋이 정보줄 · 지도 줄에 걸쳐 3초 머물던 것)
        const mTop = gameTop() > 0 ? gameTop() + Math.max(5 * s, Math.min(W, H) * 0.05) * 1.6 + 2 * s : 0;
        for (let i = 0; i < NM; i++) {
            const f = (i + 0.5) / NM;
            mirrors.push({ x: clamp(lerp(mx, tx, f), W * 0.05, W * 0.95), y: i % 2 ? Math.max(H * 0.15, G - H * 0.65, mTop) : G - H * 0.15, t0: TM + i * 0.1 });
        }
        const path = [[mx, my], ...mirrors.map((m) => [m.x, m.y]), [tx, ty]];
        const TEND = TF + SEG * (path.length - 1);
        const TS = TEND + 0.7; // 와장창
        const sc = scene(u, sec + 0.4, 'uniq glaceon');
        ultDark(0.45, ms - 200);
        // 다이아몬드 가루
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp((life - 0.2) / 0.5, 0, 1) * clamp((sec - 0.3 - life) / 0.5, 0, 1);
            // 게임 화면 — 가루는 연출 위 끝 아래에서만 (반짝이 한 점이 위 끝에 걸쳐 머물던 것 — #107)
            const y0 = gameTop() > 0 ? gameTop() + 3 * s : 0;
            for (let j = 0; j < 24; j++) {
                const x = hash(j, 901) * W;
                const y = y0 + ((hash(j, 902) * (G - y0) + life * (G - y0) * 0.06) % (G - y0));
                if (Math.sin(life * 7 + j * 1.3) > 0.4) {
                    glint(ctx, px, s, x, y, s * 2, 0.8 * a);
                }
            }
        } });
        puppet(sc, pokemon, u, () => me.b, ICEP[2], sec - 0.1, { glow: (t) => (t > TF - 0.05 && t < TF + 0.1 ? 0.7 : clamp((t - 0.3) / 0.6, 0, 1) * (t < TF ? 0.12 * (1 + Math.sin(t * 10)) : 0)), glowColor: '#ffffff' });
        // 얼음 거울 — 육각 결정 (튕길 때 번쩍)
        sc.add({ max: TS + 0.05, draw: (ctx, it, t, px) => {
            const life = sc.t;
            mirrors.forEach((m, i) => {
                if (life < m.t0) {
                    return;
                }
                const k = easeOut((life - m.t0) / 0.3);
                const R = Math.max(5 * s, Math.min(W, H) * 0.05) * k;
                const hitT = TF + SEG * (i + 1);
                const fl = clamp(1 - Math.abs(life - hitT) / 0.08, 0, 1);
                const rot = life * 0.8 + i;
                for (let j = 0; j < 6; j++) {
                    const a0 = rot + (j * TAU) / 6;
                    const a1 = rot + ((j + 1) * TAU) / 6;
                    K.fillPts(ctx, px, s, [[m.x + Math.cos(a0) * R, m.y + Math.sin(a0) * R], [m.x + Math.cos(a1) * R, m.y + Math.sin(a1) * R]], 1, fl > 0 ? '#ffffff' : ICEP[2], 1);
                }
                ellipse(ctx, px, s, m.x, m.y, R * 0.8, R * 0.8, ICEP[1], 0.35 + 0.5 * fl);
                glint(ctx, px, s, m.x, m.y, R * (0.4 + 1.2 * fl), 0.7 + 0.3 * fl);
            });
        } });
        mirrors.forEach((m) => sc.at(m.t0, () => sparkles(m.x, m.y, s, ICEP, 6, s * 6, H * 0.05)));
        chargeSwirl(sc, () => [mx, my], TC0, TF - 0.05, Math.max(me.w * 3, short(u) * 0.4), Math.max(s * 4, me.w * 0.25), ICEP, dir);
        // 냉동빔 — 거울 사이를 튕김
        sc.add({ max: TEND + 0.5, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TF) {
                return;
            }
            const fade = life > TEND ? 1 - (life - TEND) / 0.5 : 1;
            const prog = (life - TF) / SEG;
            const pts = [];
            for (let i = 0; i < path.length; i++) {
                if (i <= prog) {
                    pts.push(path[i]);
                } else {
                    const f = prog - (i - 1);
                    if (f > 0) {
                        pts.push([lerp(path[i - 1][0], path[i][0], f), lerp(path[i - 1][1], path[i][1], f)]);
                    }
                    break;
                }
            }
            if (pts.length > 1) {
                K.fillPts(ctx, px, s, pts, 6, ICEP[3], 0.5 * fade);
                K.fillPts(ctx, px, s, pts, 4, ICEP[2], fade);
                K.fillPts(ctx, px, s, pts, 2, '#ffffff', fade);
            }
        } });
        sc.at(TF, () => {
            impactFrames(sc, W, H, 0.6, 0.35);
            ultShake(3, (TEND - TF) * 1000);
        });
        mirrors.forEach((m, i) => sc.at(TF + SEG * (i + 1), () => {
            ring(sc, m.x, m.y, s * 2, Math.min(W, H) * 0.1, 1, 0.3, ['#ffffff', ICEP[2]], 2);
            ultShake(1.5, 80);
        }));
        let frozen = false;
        sc.at(TEND, () => {
            frozen = true;
            ring(sc, tx, ty, s * 2, me.w * 2, 0.85, 0.35, ['#ffffff', ICEP[2]], 2);
            if (tq) {
                hit(where(u, tq), dir, 'shake', 0);
            }
        });
        sc.add({ max: TS + 0.05, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (!frozen || !tq) {
                return;
            }
            iceBlock(ctx, px, s, where(u, tq), easeOut((life - TEND) / 0.15), ICEP);
        } });
        sc.at(TS, () => {
            impactFrames(sc, W, H, 0.7, 0.4);
            K.shards(tx, ty, s, Math.max(s, Math.round(me.w / (12 * s)) * s), ICEP, 14, H * 0.8, G);
            for (const m of mirrors) {
                K.shards(m.x, m.y, s, s, ICEP, 4, H * 0.5, G);
            }
            blastDome(sc, tx, G, clamp(Math.max(H * 0.45, W * 0.22), 30, Math.min(G * 0.92, W * 0.45)), 1.8, ICEP);
            ultShake(8 + 2 * P, 1000);
            for (const r of u.others()) {
                sc.at(TS + 0.08, () => hit(where(u, r), away(u, tx), 'lift', 0.3));
            }
        });
        emberRise(sc, TS + 0.4, sec, ICEP);
    }

    // ═════ 스타팅 진화 전 · 중간 — 그리기 도구 (2026-10-19 태현 님: 스타팅은 포켓몬마다 따로, 연출이 겹치지 않게) ═════
    const ST_FIRE = ['#ffffff', '#fff3a0', '#ff9a2a', '#d0301a'];
    const ST_SHELL = ['#3a2412', '#8a5a26', '#c98a3a', '#f2e2a0'];
    // 잎 여러 장 — {x, y, len, ang}: (x, y) 가운데, ang 쪽으로 뾰족. 테두리 · 잎몸 · 잎맥 세 겹을 한 번에
    function stLeaves(ctx, px, s, list, cols, alpha = 1) {
        if (alpha <= 0.01 || !list.length) {
            return;
        }
        const paths = [new Path2D(), new Path2D(), new Path2D()];
        for (const lf of list) {
            const L = Math.max(3 * s, lf.len);
            const ux = Math.cos(lf.ang);
            const uy = Math.sin(lf.ang);
            const half = L * 0.26;
            for (let d = -L / 2; d <= L / 2; d += s * 0.8) {
                const f = (2 * d) / L;
                const w = half * (1 - f * f) * (f < 0 ? 1 : 1 - 0.25 * f);
                for (let e = -w - s * 0.7; e <= w + s * 0.7; e += s * 0.85) {
                    const x = lf.x + ux * d - uy * e;
                    const y = lf.y + uy * d + ux * e;
                    const k = Math.abs(e) > w ? 0 : Math.abs(e) < s * 0.55 && Math.abs(f) < 0.8 ? 2 : 1;
                    paths[k].rect(px(x), px(y), s, s);
                }
            }
        }
        K.fillPaths(ctx, paths, [cols[3], cols[1], cols[0]], alpha);
    }
    // 새싹 — 땅(x, G)에서 h 높이로 솟고(k 0 → 1) 끝에 떡잎 두 장이 벌어짐
    function stSprout(ctx, px, s, x, G, h, k, cols, T, alpha = 1) {
        if (k <= 0.02 || alpha <= 0.01) {
            return;
        }
        const hh = h * k;
        const sway = Math.sin(T * 5 + x * 0.1) * s * 0.8 * Math.min(1, k);
        const stem = [new Path2D(), new Path2D()];
        K.addLine(stem[0], px, s, [[x, G + s], [x + sway, G - hh]], 3);
        K.addLine(stem[1], px, s, [[x, G + s], [x + sway, G - hh]], 1);
        K.fillPaths(ctx, stem, [cols[3], cols[2]], alpha);
        const open = clamp(k, 0, 1);
        const L = Math.max(4 * s, h * 0.55);
        const tx = x + sway;
        const ty = G - hh;
        const leaves = [];
        for (const sd of [-1, 1]) {
            const a = sd < 0 ? Math.PI + 0.35 + 0.9 * (1 - open) : -0.35 - 0.9 * (1 - open);
            leaves.push({ x: tx + Math.cos(a) * L * 0.45, y: ty + Math.sin(a) * L * 0.45, len: L * (0.5 + 0.5 * open), ang: a });
        }
        stLeaves(ctx, px, s, leaves, cols, alpha);
    }
    // 덩굴 길 — (x0, y0) → (x1, y1) 을 위로 휘게(bend: 길이에 대한 비율), wave 만큼 물결
    function stVinePts(x0, y0, x1, y1, bend, s, wave = 0, T = 0) {
        const L = Math.hypot(x1 - x0, y1 - y0) || 1;
        let nx = -(y1 - y0) / L;
        let ny = (x1 - x0) / L;
        if (ny > 0) {
            nx = -nx;
            ny = -ny;
        }
        const cx = (x0 + x1) / 2 + nx * bend * L;
        const cy = (y0 + y1) / 2 + ny * bend * L;
        const n = Math.max(6, Math.round(L / (2 * s)));
        const pts = [];
        for (let i = 0; i <= n; i++) {
            const f = i / n;
            const w = wave * Math.sin(f * 9 - T * 14) * f * (1 - f) * L * 0.12;
            pts.push([(1 - f) * (1 - f) * x0 + 2 * (1 - f) * f * cx + f * f * x1 + nx * w, (1 - f) * (1 - f) * y0 + 2 * (1 - f) * f * cy + f * f * y1 + ny * w]);
        }
        return pts;
    }
    // 덩굴 여러 줄 — 테두리 · 몸 · 밝은 줄 (wc 칸 굵기)
    function stVines(ctx, px, s, list, wc, cols, alpha = 1) {
        if (alpha <= 0.01 || !list.length) {
            return;
        }
        const paths = [new Path2D(), new Path2D(), new Path2D()];
        for (const pts of list) {
            K.addLine(paths[0], px, s, pts, wc + 2);
            K.addLine(paths[1], px, s, pts, wc);
            K.addLine(paths[2], px, s, pts.map(([x, y]) => [x, y - s * 0.5 * wc]), Math.max(1, Math.round(wc * 0.35)));
        }
        K.fillPaths(ctx, paths, [cols[3], cols[2], cols[1]], alpha);
    }
    // 등껍질 — (x, y) 가운데, 반지름 r, rot 만큼 무늬가 돎 (팽이처럼 빙글빙글)
    function stShell(ctx, px, s, x, y, r, rot, alpha = 1) {
        ellipse(ctx, px, s, x, y, r + s, r * 0.82 + s, ST_SHELL[0], alpha);
        ellipse(ctx, px, s, x, y, r, r * 0.82, ST_SHELL[2], alpha);
        const path = new Path2D();
        for (let j = 0; j < 3; j++) {
            const a = rot + (j * Math.PI) / 3;
            for (let d = -r * 0.82; d <= r * 0.82; d += s) {
                path.rect(px(x + Math.cos(a) * d), px(y + Math.sin(a) * d * 0.82), s, s);
            }
        }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = ST_SHELL[1];
        ctx.fill(path);
        ellipse(ctx, px, s, x, y, r * 0.32, r * 0.26, ST_SHELL[1], alpha);
        ellipse(ctx, px, s, x, y + r * 0.62, r * 0.7, r * 0.18, ST_SHELL[3], alpha);
        ellipse(ctx, px, s, x - r * 0.35, y - r * 0.42, r * 0.2, r * 0.1, '#ffffff', alpha * 0.75);
    }
    // 불 회오리 — 땅(x, G)에서 h 높이로 휘몰아치는 불꽃 기둥: 아래 좁고 위 넓은 주황 불꽃 몸통(빨간 테두리)에 노란 띠가 앞쪽에서만
    // 은은하게 감겨 돌고(띠는 군데군데 끊김), 하얀 불티 · 아래쪽 하얀 심, 가장자리에서 불꽃 혀가 비스듬히 핥아 오름, 위로 갈수록 휘청, 밑동과 꼭대기는 불꽃 혀
    function stFireWhirl(ctx, px, s, x, G, h, rb, rt, T, k, cols, alpha = 1) {
        if (k <= 0.02 || alpha <= 0.01) {
            return;
        }
        const top = h * k;
        const pitch = TAU / Math.max(top / 2.6, 8 * s);
        const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
        const swayAt = (f) => Math.sin(f * 3 + T * 2.5) * rt * 0.3 * f;
        const rAt = (yy, f) => lerp(rb, rt, f ** 0.8) * (0.7 + 0.3 * k) * (1 + 0.14 * Math.sin(yy * 0.07 - T * 9) + 0.09 * Math.sin(yy * 0.19 + T * 13));
        const tongues = [];
        for (let yy = 0; yy < top; yy += s) {
            const f = yy / Math.max(1, top);
            const r = rAt(yy, f);
            const cx = x + swayAt(f);
            const y = G - yy - s;
            paths[0].rect(px(cx - r - s), px(y), Math.max(s, px(2 * r + 2 * s)), s);
            paths[1].rect(px(cx - r), px(y), Math.max(s, px(2 * r)), s);
            for (let j = 0; j < 2; j++) {
                const th = yy * pitch - T * 11 + j * Math.PI;
                const sn = Math.sin(th);
                if (sn < 0.15 || hash(Math.floor(yy / (3 * s)), j + Math.floor(T * 6)) < 0.18) {
                    continue;
                }
                const bw = Math.max(s, r * 0.7 * sn);
                paths[2].rect(px(cx + Math.cos(th) * r * 0.6 - bw / 2), px(y), Math.max(s, px(bw)), s);
            }
            if (f < 0.5) {
                paths[3].rect(px(cx - r * 0.2 * (1 - f)), px(y), Math.max(s, px(r * 0.4 * (1 - f))), s);
            } else if (hash(Math.floor(yy / s), Math.floor(T * 12)) > 0.9) {
                paths[3].rect(px(cx + (hash(Math.floor(yy / s), 3) - 0.5) * r), px(y), s, s);
            }
            const row = Math.floor(yy / (5 * s));
            if (yy % (5 * s) < s && f > 0.15 && hash(row, Math.floor(T * 5)) > 0.45) {
                tongues.push([cx, y, r, row % 2 ? 1 : -1]);
            }
        }
        // 가장자리를 핥는 불꽃 혀 (몸통 뒤)
        for (const [cx, y, r, sd] of tongues) {
            K.fireTail(ctx, px, s, cx + sd * r * 1.25, y - r * 0.3, sd * 0.75, -0.66, r * 0.9, Math.max(2 * s, r * 0.45), cols, T + y, 0.85 * alpha);
        }
        K.fillPaths(ctx, paths, [cols[3], cols[2], cols[1], cols[0]], 0.95 * alpha);
        K.flameTongue(ctx, px, s, x, G + s, rb * 4, rb * 3, cols, T + 2, k, 0, alpha);
        K.flameTongue(ctx, px, s, x + swayAt(1), G - top + rt * 0.5, rt * 1.7, rt * 1.5, cols, T, k, 0, alpha);
    }
    // 햇빛 줄기 — 하늘에서 x 로 내려오는 빛 기둥 (가운데 밝게, 일렁)
    function stSunShaft(ctx, px, s, x, G, w, a, T) {
        if (a <= 0.01) {
            return;
        }
        const SUN = K.pal.SUN;
        for (const [m, c, al] of [[1, SUN[3], 0.16], [0.7, SUN[2], 0.24], [0.42, SUN[1], 0.34], [0.16, SUN[0], 0.5]]) {
            ctx.globalAlpha = al * a;
            ctx.fillStyle = c;
            for (let y = 0; y < G; y += s * 2) {
                const half = w * m * (0.55 + 0.45 * (y / G)) * (1 + 0.06 * Math.sin(y * 0.05 + T * 6));
                ctx.fillRect(px(x - half), px(y), Math.max(s, px(2 * half)), s * 2);
            }
        }
    }

    // ═════ 이상해씨 — 덩굴채찍 (ultbloom) ═════
    // 등의 씨앗에서 덩굴 두 줄기가 쑥 자라 공중에서 휘휘 · 철썩철썩(하얀 섬광) → 쭉 뻗어 상대를 칭칭 감아 번쩍 들어 올렸다 땅에 내리꽂음
    // (임팩트 프레임 · 먼지 고리 · 갈라진 금) → 내리꽂힌 자리부터 양옆으로 새싹이 퐁퐁퐁 솟음(새싹 밑의 애도 들썩) → 덩굴이 등으로 쏙 (약 4.6초)
    UNIQ.bulbasaur = { fx: 'ultbloom', ms: (P) => 4600 + 200 * P, run: runBulbaWhip };
    function runBulbaWhip(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const VC = K.pal.VINE;
        const DIRT = ['#d1b178', '#a88a55', '#6b5536'];
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * Math.min(W * 0.35, me.w * 5 + 40), W * 0.06, W * 0.94);
        const TOUT = 0.25;
        const TWHIP = 0.8;
        const TGRAB = 1.35;
        const TSLAM = TGRAB + 1.35; // 들려 올라간 애가 떨어지는 때 (ultHit lift 1.5초의 0.9)
        const TREL = TSLAM + 0.12;
        const base = [me.x - dir * me.w * 0.1, me.b - me.h * 0.72];
        const wc = clamp(Math.round((me.w * 0.07) / s), 1, 4);
        const lift = Math.min(H * 0.4, me.w * 2 + 24);
        const sc = scene(u, sec + 0.3, 'uniq bulbasaur');
        ultDark(0.3, ms - 200);
        const tbox = () => {
            if (q) {
                const r = q.pokemon.el.getBoundingClientRect();
                if (r.width > 0) {
                    return { x: r.left + r.width / 2, y: r.top + r.height * 0.55, w: r.width, h: r.height };
                }
            }
            return { x: tx, y: G - s, w: me.w, h: me.h };
        };
        const whipAt = (t, side) => {
            const a = (t - TOUT) * 14 * side;
            return [base[0] + side * me.w * (0.6 + 0.35 * Math.cos(a)), base[1] - me.h * (0.75 + 0.35 * Math.sin(a))];
        };
        const rel = {};
        const tipAt = (t, side) => {
            if (t < TOUT) {
                const k = easeOut(t / TOUT);
                return [base[0] + side * me.w * 0.5 * k, base[1] - me.h * 0.5 * k];
            }
            if (t < TWHIP) {
                return whipAt(t, side);
            }
            if (t >= TREL) {
                const k = easeIn(clamp((t - TREL) / 0.5, 0, 1));
                const [rx, ry] = rel[side] || base;
                return [lerp(rx, base[0], k), lerp(ry, base[1], k)];
            }
            const B = tbox();
            const gx = B.x + side * B.w * 0.18;
            if (t < TGRAB) {
                const k = easeIn((t - TWHIP) / (TGRAB - TWHIP));
                const [sx, sy] = whipAt(TWHIP, side);
                return [lerp(sx, gx, k), lerp(sy, B.y, k) - Math.sin(k * Math.PI) * me.h * 0.8];
            }
            if (q) {
                return [gx, B.y];
            }
            // 상대가 없으면 높이 들었다 땅을 내리침
            const k = clamp((t - TGRAB) / (TSLAM - TGRAB), 0, 1);
            const up = k < 0.6 ? easeOut(k / 0.6) : 1 - easeIn((k - 0.6) / 0.4);
            return [gx, lerp(G - s, G - lift, up)];
        };
        // 이상해씨 (꼭두각시) — 등의 씨앗이 초록빛으로 두근
        puppet(sc, pokemon, u, () => me.b, VC[2], sec - 0.1, { glow: (t) => (t < TREL + 0.5 ? 0.12 + 0.1 * Math.sin(t * 16) : 0), glowColor: VC[0] });
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < 0.4) {
                glint(ctx, px, s, base[0], base[1], me.w * 0.35 * Math.sin((life / 0.4) * Math.PI), 1);
            }
        } });
        // 덩굴 두 줄기 + 상대를 감은 고리
        sc.add({ max: TREL + 0.55, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const list = [];
            for (const side of [-1, 1]) {
                const [x1, y1] = tipAt(life, side);
                const bend = life < TWHIP ? 0.35 : life < TGRAB ? 0.3 : 0.18;
                list.push(stVinePts(base[0], base[1], x1, y1, bend, s, life < TGRAB ? 1 : 0.3, life));
            }
            stVines(ctx, px, s, list, wc, VC, 1);
            if (q && life >= TGRAB - 0.02 && life < TREL) {
                const B = tbox();
                const tight = 1 + 0.5 * (1 - easeOut(clamp((life - TGRAB) / 0.15, 0, 1)));
                const coils = [];
                for (const dy of [-0.18, 0.12]) {
                    const pts = [];
                    for (let i = 0; i <= 26; i++) {
                        const a = (i / 26) * TAU;
                        pts.push([B.x + Math.cos(a) * B.w * 0.55 * tight, B.y + B.h * dy + Math.sin(a) * B.w * 0.16 * tight]);
                    }
                    coils.push(pts);
                }
                stVines(ctx, px, s, coils, Math.max(1, wc - 1), VC, 1);
            }
        } });
        // 공중에서 철썩철썩
        [TOUT + 0.2, TOUT + 0.4].forEach((tc, i) => sc.at(tc, () => {
            const [x, y] = tipAt(tc, i ? 1 : -1);
            ring(sc, x, y, s * 2, me.w * 0.6, 1, 0.2, ['#ffffff', VC[0]], 1);
            sparkles(x, y, s, ['#ffffff', VC[0]], 5, s * 3, 10);
            ultShake(1.5, 80);
        }));
        // 감아 들어 올림
        sc.at(TGRAB, () => {
            if (q) {
                hit(where(u, q), dir, 'lift', 0);
                const B = tbox();
                ring(sc, B.x, B.y, B.w * 0.3, B.w * 1.2, 0.5, 0.3, ['#ffffff', VC[1]], 2);
            }
            ultShake(2, 150);
        });
        // 땅에 내리꽂음
        sc.at(TSLAM, () => {
            impactFrames(sc, W, H, 0.55, 0.35);
            ultShake(5 + 2 * P, 420);
            ring(sc, tx, G - s, me.w * 0.4, me.w * 3.2, 0.22, 0.6, ['#ffffff', DIRT[0], DIRT[1]], 3);
            debris(tx, G - s, s, DIRT, 22, H * 0.55, { angle: -Math.PI / 2, spread: 2.2, ground: G - s });
            groundArcs(sc, tx, G - s, me.w * 2.4, 1.4, DIRT[2], 4, 1, G - s);
            const B = tbox();
            for (const side of [-1, 1]) {
                rel[side] = [B.x + side * B.w * 0.18, G - Math.min(B.h, me.h) * 0.45];
            }
        });
        sc.at(TSLAM + 0.17, () => q && hit(where(u, q), dir, 'tumble', 0));
        // 새싹 퐁퐁퐁 — 내리꽂힌 자리부터 양옆으로
        const gap = Math.max(me.w * 0.75, 14 * s);
        const sprouts = [{ x: tx, t: TSLAM + 0.1, h: Math.max(me.h * 0.9, 14 * s) }];
        for (let i = 0; i < 6; i++) {
            for (const sd of [-1, 1]) {
                const x = tx + sd * (i + 1) * gap;
                if (x > s * 4 && x < W - s * 4) {
                    sprouts.push({ x, t: TSLAM + 0.22 + i * 0.11, h: Math.max(me.h * (0.62 - i * 0.05), 8 * s) });
                }
            }
        }
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const fade = clamp((sec - 0.15 - life) / 0.5, 0, 1);
            for (const sp of sprouts) {
                const k = (life - sp.t) / 0.24;
                if (k <= 0) {
                    continue;
                }
                const grow = k < 1 ? easeOut(k) * 1.15 : 1 + 0.15 * Math.exp(-(k - 1) * 3) * Math.cos((k - 1) * 9);
                stSprout(ctx, px, s, sp.x, G, sp.h, grow, VC, life, fade);
            }
        } });
        for (const sp of sprouts) {
            sc.at(sp.t, () => {
                debris(sp.x, G - s, s, DIRT, 6, H * 0.35, { angle: -Math.PI / 2, spread: 1.4, ground: G - s, life: 0.6 });
                fireBits(sp.x, G - sp.h, s, [VC[0], VC[1]], 4, { speed: H * 0.25, life: 0.5 });
                for (const r of u.others()) {
                    if (Math.abs(r.x - sp.x) < gap * 0.5 && (!q || r.pokemon !== q.pokemon)) {
                        hit(r, away(u, r.x), 'lift');
                    }
                }
            });
        }
        sc.at(TSLAM + 0.9, () => ultShake(2, 200));
    }

    // ═════ 이상해풀 — 잎날가르기 (ultswarm) ═════
    // 등의 봉오리가 떨리며 날카로운 잎이 하나씩 돋아나 몸 둘레를 빙글빙글 (점점 빠르게) → 휙 — 잎 고리가 부메랑처럼 상대에게 날아가
    // 번쩍번쩍 베고(초록 베기 자국) 크게 돌아 되돌아옴 → 잎이 봉오리로 쏙쏙 → 봉오리가 반쯤 벌어지며 하늘에서 햇빛이 내려와 반짝 (약 5.6초)
    UNIQ.ivysaur = { fx: 'ultswarm', ms: (P) => 5600 + 200 * P, run: runIvyRazor };
    function runIvyRazor(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const VC = K.pal.VINE;
        const PINK = K.pal.PINK;
        const SUN = K.pal.SUN;
        const N = 10;
        const bud = [me.x - dir * me.w * 0.1, me.b - me.h * 0.84];
        const cy = me.b - me.h * 0.5;
        const R0 = Math.max(me.w * 0.85, 12 * s);
        const TSPAWN = 0.3;
        const TFLING = 1.7;
        const TFLY = 1.6;
        const TABS = TFLING + TFLY + N * 0.05 + 0.3;
        const TOPEN = TABS + 0.1;
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * W * 0.4, W * 0.08, W * 0.92);
        const ty = q ? q.y : G - me.h * 0.5;
        const D = tx - me.x;
        const LL = Math.max(5 * s, me.w * 0.34);
        // 게임 화면 — 잎 무리가 그리는 길 꼭대기 (잎 길이까지) 는 연출 위 끝 아래 (#107 — 길 높이만)
        const hh = Math.min(Math.max(me.h * 1.2, H * 0.18), gameTop() > 0 ? Math.max(me.h * 0.4, cy - gameTop() - LL - 2 * s) : Infinity);
        const leafPos = (i, t) => {
            const ph = (i / N) * TAU;
            if (t < TFLING) {
                const k = clamp((t - TSPAWN - i * 0.08) / 0.25, 0, 1);
                if (k <= 0) {
                    return null;
                }
                const sp = 3 + 6 * clamp((t - TSPAWN) / 1.2, 0, 1);
                const a = ph + t * sp * dir;
                const e = easeOut(k);
                return { x: lerp(bud[0], me.x + Math.cos(a) * R0, e), y: lerp(bud[1], cy + Math.sin(a) * R0 * 0.35, e), ang: a + (Math.PI / 2) * dir };
            }
            const f = clamp((t - TFLING - i * 0.05) / TFLY, 0, 1);
            if (f >= 1) {
                const k = clamp((t - TFLING - i * 0.05 - TFLY) / 0.3, 0, 1);
                if (k >= 1) {
                    return null;
                }
                return { x: lerp(me.x, bud[0], easeIn(k)), y: lerp(cy, bud[1], easeIn(k)), ang: t * 25 + i };
            }
            const th = f * TAU;
            const spread = (i - (N - 1) / 2) * s * 1.6;
            return {
                x: me.x + (D / 2) * (1 - Math.cos(th)) + spread * Math.sin(th),
                y: Math.min(G - s * 3, cy - Math.sin(th) * hh * (th < Math.PI ? 1 : 0.4) + spread * 0.4),
                ang: t * 25 + i,
            };
        };
        const sc = scene(u, sec + 0.3, 'uniq ivysaur');
        ultDark(0.3, ms - 200);
        // 햇빛 줄기 (이상해풀 뒤 — 하늘에서 내려오는 빛: 위 끝 띠만 위 끝 층 · #107)
        sc.split({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const a = clamp((life - TOPEN) / 0.5, 0, 1) * clamp((sec - 0.1 - life) / 0.5, 0, 1);
            stSunShaft(ctx, px, s, bud[0], me.b, Math.max(me.w * 0.7, 9 * s), a, life);
        } });
        puppet(sc, pokemon, u, (t) => me.b + (t > TFLING - 0.12 && t < TFLING + 0.1 ? -s * 2 : 0), VC[2], sec - 0.1, {
            glow: (t) => (t > TOPEN ? clamp((t - TOPEN) / 0.4, 0, 1) * 0.25 * (1 + 0.3 * Math.sin(t * 8)) : 0.08 * (1 + Math.sin(t * 14))),
            glowColor: SUN[1],
        });
        // 봉오리 — 떨리다가 마지막에 반쯤 벌어짐 (분홍 꽃잎)
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const shake = life < TFLING ? Math.sin(life * 50) * s * 0.6 : 0;
            const rb = Math.max(me.w * 0.16, 3 * s);
            const open = easeOut(clamp((life - TOPEN) / 0.6, 0, 1)) * 0.55;
            if (open > 0.01) {
                const petals = [new Path2D(), new Path2D()];
                for (let j = 0; j < 5; j++) {
                    const a = -Math.PI / 2 + (j - 2) * (0.25 + 0.5 * open);
                    const lx = bud[0] + Math.cos(a) * rb * (0.6 + open);
                    const ly = bud[1] + Math.sin(a) * rb * (0.6 + open);
                    for (let d = 0; d < rb * 1.3; d += s) {
                        const w = rb * 0.42 * Math.sin((d / (rb * 1.3)) * Math.PI);
                        for (let e = -w; e <= w; e += s) {
                            petals[Math.abs(e) > w - s ? 0 : 1].rect(px(lx + Math.cos(a) * d - Math.sin(a) * e), px(ly + Math.sin(a) * d + Math.cos(a) * e), s, s);
                        }
                    }
                }
                K.fillPaths(ctx, petals, [PINK[3], PINK[1]], 1);
                ellipse(ctx, px, s, bud[0], bud[1] - rb * 0.3, rb * 0.45, rb * 0.35, SUN[2], 1);
                glint(ctx, px, s, bud[0], bud[1] - rb * 0.4, rb * (1.2 + 0.4 * Math.sin(life * 6)), clamp((life - TOPEN) / 0.3, 0, 1));
            } else if (life < TFLING) {
                glint(ctx, px, s, bud[0] + shake, bud[1], rb * 0.9 * clamp((life - TSPAWN) / 0.5, 0, 1), 0.6);
            }
        } });
        // 잎 — 잔상(옅게 두 장 뒤) · 잎
        sc.add({ max: TABS + 0.1, draw: (ctx, it, t, px) => {
            const life = sc.t;
            for (const [dt0, al] of [[0.06, 0.25], [0.03, 0.5], [0, 1]]) {
                const list = [];
                for (let i = 0; i < N; i++) {
                    const p = leafPos(i, life - dt0);
                    if (p) {
                        list.push({ x: p.x, y: p.y, len: LL, ang: p.ang });
                    }
                }
                if (life > TFLING || dt0 === 0) {
                    stLeaves(ctx, px, s, list, VC, al);
                }
            }
        } });
        // 초록 베기 자국 — 잎 무리가 상대를 지날 때
        const crescent = (ctx, px, x, y, R, ang, k, alpha) => {
            for (let i = 0; i <= 16; i++) {
                const f = i / 16;
                if (f > k) {
                    break;
                }
                const an = ang - 1.1 + 2.2 * f;
                const th = Math.sin(f * Math.PI) * Math.max(2 * s, R * 0.13);
                for (let d = R - th; d < R; d += s) {
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = d > R - s * 1.2 ? '#ffffff' : VC[1];
                    ctx.fillRect(px(x + Math.cos(an) * d), px(y + Math.sin(an) * d), s, s);
                }
            }
        };
        const cuts = [0, 1, 2, 3].map((i) => ({ t: TFLING + TFLY * 0.5 + i * 0.12, a: (i % 2 ? 0.6 : -0.6) + (dir > 0 ? Math.PI : 0) }));
        cuts.forEach((c, i) => {
            sc.add({ max: sec, draw: (ctx, it, t, px) => {
                const k = (sc.t - c.t) / 0.32;
                if (k > 0 && k < 1) {
                    crescent(ctx, px, tx, ty, Math.max(me.w, me.h) * 0.85, c.a, Math.min(1, k * 3), 1 - k);
                }
            } });
            sc.at(c.t, () => {
                ultShake(1.5 + i * 0.5, 90);
                fireBits(tx, ty, s, [VC[0], VC[1], '#ffffff'], 6, { speed: H * 0.35, life: 0.4 });
                if (q) {
                    hit(where(u, q), Math.sign(q.x - me.x) || dir, i === cuts.length - 1 ? 'tumble' : 'shake', 0);
                }
            });
        });
        // 돌아오는 길에 스친 애
        sc.at(TFLING + TFLY * 0.75, () => {
            for (const r of u.others()) {
                if ((!q || r.pokemon !== q.pokemon) && Math.sign(r.x - me.x) === Math.sign(D) && Math.abs(r.x - me.x) < Math.abs(D)) {
                    hit(r, away(u, r.x), 'shake');
                }
            }
        });
        sc.at(TFLING, () => {
            ring(sc, me.x, cy, R0 * 0.8, R0 * 1.8, 0.4, 0.3, ['#ffffff', VC[1]], 2);
            ultShake(2, 120);
        });
        // 봉오리가 벌어짐 — 햇빛 · 반짝
        sc.at(TOPEN, () => {
            ring(sc, bud[0], bud[1], s * 3, me.w * 1.6, 0.8, 0.5, [SUN[0], SUN[2]], 2);
            ultShake(2, 200);
        });
        let glit = 0;
        sc.tick((t, dt) => {
            if (t < TOPEN || t > sec - 0.4) {
                return;
            }
            glit += dt * 14;
            while (glit >= 1 && room(1)) {
                glit -= 1;
                sparkles(bud[0] + rnd(-1, 1) * me.w * 0.5, rnd(0.1, 0.9) * me.b, s, [SUN[0], SUN[1], SUN[2]], 1, s * 2, -30);
            }
        });
        K.glowMark(sc, bud[0], me.b - s, me.w * 1.3, [SUN[0], SUN[1], SUN[2]], sec - TOPEN);
    }

    // ═════ 파이리 — 니트로차지 (ultrush) ═════
    // 꼬리 불꽃이 점점 커지고 발을 쿵쿵쿵 구를 때마다 불씨가 튐 → 온몸이 불꽃 옷으로 확 → 불꽃 꼬리를 끌며 상대에게 돌진해 쾅(불꽃 튐)
    // → 뒤로 공중제비하며 제자리로 → 꼬리 불꽃이 하늘 높이 활활 솟구치며 불똥이 피어오름 (약 4.6초)
    UNIQ.charmander = { fx: 'ultrush', ms: (P) => 4600 + 200 * P, run: runCharNitro };
    function runCharNitro(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const F = ST_FIRE;
        const stomps = [0.5, 0.82, 1.1];
        const TCOAT = 1.3;
        const TDASH = 1.55;
        const TD1 = TDASH + 0.3;
        const THOME = TD1 + 0.65;
        const TBLAZE = THOME + 0.05;
        const q = nearest(u);
        const ax = clamp(q ? q.x - Math.sign(q.x - me.x || dir) * me.w * 0.7 : me.x + dir * Math.min(W * 0.32, me.w * 4 + 30), me.w * 0.5, W - me.w * 0.5);
        const dd = Math.sign(ax - me.x) || dir;
        const xAt = (t) => (t < TDASH ? me.x : t < TD1 ? lerp(me.x, ax, easeIn((t - TDASH) / (TD1 - TDASH))) : t < THOME ? lerp(ax, me.x, easeOut((t - TD1) / (THOME - TD1))) : me.x);
        const footAt = (t) => {
            for (const ts of stomps) {
                const k = (t - ts + 0.12) / 0.24;
                if (k > 0 && k < 1) {
                    return me.b - Math.sin(k * Math.PI) * me.h * 0.18;
                }
            }
            if (t > TD1 && t < THOME) {
                return me.b - Math.sin(((t - TD1) / (THOME - TD1)) * Math.PI) * hopH;
            }
            return me.b;
        };
        // 게임 화면 — 되돌아 공중제비 꼭대기에서도 몸이 연출 위 끝 아래 (#107)
        const hopH = Math.min(me.h * 1.3, gameTop() > 0 ? Math.max(me.h * 0.3, me.b - me.h - gameTop() - 2 * s) : Infinity);
        const rotAt = (t) => (t > TD1 && t < THOME ? -dd * TAU * easeOut((t - TD1) / (THOME - TD1)) : 0);
        const tailAt = (t) => [xAt(t) - dir * me.w * 0.36, footAt(t) - me.h * 0.42];
        const sc = scene(u, sec + 0.3, 'uniq charmander');
        ultDark(0.32, ms - 200);
        // 꼬리 불꽃 (파이리 뒤) — 점점 커지다 돌진 땐 작게, 마지막에 하늘 높이 (하늘까지 솟는 마지막 불꽃은 위 끝 층 — #107)
        const tail = (soft) => ({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if ((life > TDASH && life < THOME) || (life >= TBLAZE) !== soft) {
                return;
            }
            const [x, y] = tailAt(life);
            let h = me.h * (0.35 + 0.65 * clamp(life / TCOAT, 0, 1));
            let w = me.w * (0.3 + 0.25 * clamp(life / TCOAT, 0, 1));
            if (life >= TBLAZE) {
                const up = easeOut(clamp((life - TBLAZE) / 0.5, 0, 1)) * clamp((sec - 0.2 - life) / 0.6, 0, 1);
                h = lerp(me.h * 0.4, Math.min(H * 0.55, me.h * 5.5), up);
                w = lerp(me.w * 0.3, me.w * 1.0, up);
                if (up > 0.2) {
                    K.flameTongue(ctx, px, s, x - me.w * 0.25, y + s, w * 0.6, h * 0.7, F, life + 1, up, -0.25);
                    K.flameTongue(ctx, px, s, x + me.w * 0.25, y + s, w * 0.6, h * 0.7, F, life + 2, up, 0.25);
                }
            }
            K.flameTongue(ctx, px, s, x, y + s, w, h, F, life, 1, -dir * 0.15);
        } });
        sc.add(tail(false));
        sc.split(tail(true));
        // 불꽃 옷 · 돌진 꼬리 (공중제비 때 위 끝을 넘는 윗부분만 위 끝 층 — #107)
        sc.split({ max: THOME + 0.2, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TCOAT) {
                return;
            }
            const x = xAt(life);
            const foot = footAt(life);
            const k = clamp((life - TCOAT) / 0.2, 0, 1) * (1 - clamp((life - TD1 - 0.2) / 0.4, 0, 1));
            if (life > TDASH && life < TD1 + 0.15) {
                const len = Math.max(me.w * 1.6, Math.abs(x - me.x) + me.w);
                K.fireTail(ctx, px, s, x + dd * me.w * 0.25, foot - me.h * 0.5, dd, 0, len, me.h * 1.1, F, life, 0.9);
            }
            K.flameTongue(ctx, px, s, x, foot + s * 2, me.w * 1.35, me.h * 1.55, F, life, k);
        } });
        // 지나간 땅이 그을림 — 땅 불길이 잠깐
        sc.add({ max: THOME + 0.6, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TDASH) {
                return;
            }
            const x = life < TD1 ? xAt(life) : ax;
            const a = clamp(1 - (life - TD1) / 0.9, 0, 1);
            K.groundFlames(ctx, px, s, Math.min(me.x, x), Math.max(me.x, x), G, me.h * 0.35, life, F, a * 0.9);
        } });
        puppet(sc, pokemon, u, footAt, F[2], sec - 0.1, { x: xAt, rot: rotAt, glow: (t) => (t > TCOAT && t < THOME ? 0.35 : t > TBLAZE ? 0.15 * (1 + Math.sin(t * 12)) : 0.06 * (1 + Math.sin(t * 20))), glowColor: F[1] });
        stomps.forEach((ts, i) => sc.at(ts, () => {
            K.puff(me.x - me.w * 0.3, G - s, s, '#8a7252', s * 2, me.w * 0.5, 0.5, -30, -10, 0.45);
            K.puff(me.x + me.w * 0.3, G - s, s, '#8a7252', s * 2, me.w * 0.5, 0.5, 30, -10, 0.45);
            const [x, y] = tailAt(ts);
            fireBits(x, y - me.h * 0.3, s, F, 6 + i * 3, { angle: -Math.PI / 2, spread: 1.6, speed: H * 0.45, g: H * 0.9, life: 0.6 });
            ring(sc, me.x, G - s, me.w * 0.4, me.w * (1.2 + 0.3 * i), 0.25, 0.3, [F[1], F[2]], 1);
            ultShake(1.5 + i, 120);
        }));
        sc.at(TCOAT, () => {
            ring(sc, me.x, me.b - me.h * 0.5, me.w * 0.3, me.w * 1.8, 0.85, 0.3, ['#ffffff', F[2]], 2);
            fireBits(me.x, me.b - me.h * 0.5, s, F, 14, { speed: H * 0.4, life: 0.5 });
        });
        sc.at(TD1, () => {
            const bx = ax + dd * me.w * 0.5;
            impactFrames(sc, W, H, 0.45, 0.3);
            ring(sc, bx, me.b - me.h * 0.5, me.w * 0.3, me.w * 2.4, 0.85, 0.35, ['#ffffff', F[1], F[2]], 2);
            fireBits(bx, me.b - me.h * 0.5, s, F, 26, { speed: H * 0.75, life: 0.7 });
            ultShake(4 + 2 * P, 300);
            for (const r of u.others()) {
                if (Math.abs(r.x - bx) < me.w * 1.6) {
                    hit(r, dd, 'tumble');
                }
            }
        });
        // 꼬리 불꽃이 하늘 높이
        sc.at(TBLAZE + 0.3, () => {
            const [x, y] = tailAt(TBLAZE + 0.3);
            ring(sc, x, y, me.w * 0.3, me.w * 2.2, 0.6, 0.45, ['#ffffff', F[1], F[2]], 2);
            fireBits(x, y - me.h * 2, s, F, 22, { angle: -Math.PI / 2, spread: 1.2, speed: H * 0.8, g: H * 0.6, life: 0.9 });
            ultShake(3 + P, 400);
        });
        emberRise(sc, TBLAZE + 0.2, sec, F);
    }

    // ═════ 리자드 — 화염방사 (ultbeam) ═════
    // 숨을 크게 들이마심(앞의 공기가 입으로 빨려 듦 · 콧김 연기 · 몸이 달아오름 · 꼬리 불꽃이 커짐) → 겹겹의 불꽃 줄기를 위에서 아래로 쓸며 뿜음
    // → 불길이 닿은 땅을 따라 불길 띠가 양옆으로 번지고 → 상대 자리에서 불 회오리 하나가 휘몰아쳐 솟음 (약 5.6초)
    UNIQ.charmeleon = { fx: 'ultbeam', ms: (P) => 5600 + 200 * P, run: runCharmeleonFlame };
    function runCharmeleonFlame(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const F = ST_FIRE;
        const mx = u.mouth.x;
        const my = u.mouth.y;
        const TIN = 0.2;
        const TFIRE = 1.7;
        const TSW = 1.0;
        const TEND = TFIRE + 1.9;
        const TWH = TFIRE + 1.5;
        const q = nearest(u);
        const tx = clamp(q && Math.sign(q.x - mx) === dir ? q.x : mx + dir * Math.min(W * 0.45, me.w * 6 + 40), W * 0.06, W * 0.94);
        const aT = Math.atan2(G - s - my, Math.max(me.w, Math.abs(tx - mx)));
        const a0 = -0.42;
        const angAt = (t) => lerp(a0, aT, easeOut(clamp((t - TFIRE) / TSW, 0, 1))) + Math.sin(t * 9) * 0.03;
        const lenAt = (t, a) => {
            const reach = easeOut(clamp((t - TFIRE) / 0.25, 0, 1));
            const toGround = a > 0.02 ? (G - s - my) / Math.sin(a) : Infinity;
            return Math.min(toGround, W * 0.75) * reach;
        };
        const hitX = () => mx + dir * Math.cos(aT) * lenAt(TEND, aT);
        const sc = scene(u, sec + 0.3, 'uniq charmeleon');
        ultDark(0.34, ms - 200);
        // 땅 불길 띠 — 불길이 닿은 자리부터 양옆으로
        const TG = TFIRE + TSW * 0.8;
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TG) {
                return;
            }
            const hx = hitX();
            const spread = easeOut(clamp((life - TG) / 1.4, 0, 1)) * W * 0.3 + me.w;
            const a = clamp((sec - 0.2 - life) / 0.6, 0, 1);
            K.groundFlames(ctx, px, s, Math.max(0, hx - spread), Math.min(W, hx + spread), G, me.h * 0.75, life, F, a);
        } });
        // 불 회오리 (무대 높이 0.85배까지 솟음 — 위 끝 띠 위만 위 끝 층, #107)
        sc.split({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TWH) {
                return;
            }
            const k = easeOut(clamp((life - TWH) / 0.35, 0, 1));
            const a = clamp((sec - 0.15 - life) / 0.5, 0, 1);
            stFireWhirl(ctx, px, s, tx, G, Math.min(G * 0.85, Math.max(H * 0.55, me.h * 4)), Math.max(me.w * 0.22, 4 * s), Math.max(me.w * 0.85, 12 * s), life, k, F, a);
        } });
        // 숨 들이마시기 — 앞의 공기 줄기가 입으로
        sc.add({ max: TFIRE, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - TIN) / 0.3, 0, 1);
            ctx.fillStyle = '#ffe9c8';
            for (let j = 0; j < 14; j++) {
                const f = (life * 1.4 + hash(j, 11)) % 1;
                const d = me.w * 3.2 * (1 - f);
                const off = (hash(j, 12) - 0.5) * me.h * 2 * (1 - f);
                ctx.globalAlpha = 0.6 * k * f;
                for (let c = 0; c < 3; c++) {
                    ctx.fillRect(px(mx + dir * (d + c * s * 1.5)), px(my + off * (1 + c * 0.1)), s, s);
                }
            }
        } });
        puppet(sc, pokemon, u, () => me.b, F[2], sec - 0.1, { glow: (t) => (t < TFIRE ? clamp((t - TIN) / 1.4, 0, 1) * 0.32 : t < TEND ? 0.3 + 0.1 * Math.sin(t * 25) : 0.1), glowColor: F[1] });
        // 꼬리 불꽃 (몸 앞에 그려지지 않게 꼭두각시 다음이지만 꼬리 자리)
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = 0.5 + 0.5 * clamp((life - TIN) / 1.4, 0, 1);
            K.flameTongue(ctx, px, s, me.x - dir * me.w * 0.42, me.b - me.h * 0.3, me.w * 0.35 * k, me.h * 0.75 * k, F, life, 1, -dir * 0.2, 0.9);
        } });
        // 불꽃 줄기 — 입에서 굴러 나가는 불꽃 덩이(멀수록 크고 굵게) + 그 밑에 깔리는 긴 불꽃 줄기 세 겹 (위에서 쓸어내려 화면 끝까지 — 위 끝 층, #107)
        sc.soft({ max: TEND + 0.3, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TFIRE) {
                return;
            }
            const fade = clamp(1 - (life - TEND) / 0.3, 0, 1);
            const a = angAt(life);
            const L = lenAt(life, a);
            const ux = dir * Math.cos(a);
            const uy = Math.sin(a);
            const M = 9;
            for (let j = M - 1; j >= 0; j--) {
                const d = (((j + life * 6) % M) / M) * L;
                const r = Math.min(me.h * 0.9, s * 2 + d * 0.16) * (1 + 0.15 * Math.sin(life * 27 + j * 2));
                const wob = Math.sin(life * 17 + j * 1.7) * r * 0.25;
                K.fireTail(ctx, px, s, mx + ux * (d + r) - uy * wob, my + uy * (d + r) + ux * wob, ux, uy, r * 3.2, r * 2, F, life + j, fade * (0.85 + 0.15 * (d / Math.max(1, L))));
            }
            for (let j = 0; j < 3; j++) {
                const a = angAt(life) + (j - 1) * 0.06 * Math.sin(life * 13 + j);
                const L = lenAt(life, a) * (1 - j * 0.12);
                if (L < s * 3) {
                    continue;
                }
                const ux = dir * Math.cos(a);
                const uy = Math.sin(a);
                const w = Math.max(me.h * 0.55, 8 * s) * (1 - j * 0.2) * (1 + 0.12 * Math.sin(life * 31 + j));
                K.fireTail(ctx, px, s, mx + ux * L, my + uy * L, ux, uy, L, w, F, life + j, fade * (1 - j * 0.15));
            }
        } });
        let bits = 0;
        sc.tick((t, dt) => {
            if (t < TFIRE || t > TEND) {
                return;
            }
            const a = angAt(t);
            const L = lenAt(t, a);
            bits += dt * 40;
            while (bits >= 1 && room(1)) {
                bits -= 1;
                fireBits(mx + dir * Math.cos(a) * L, my + Math.sin(a) * L, s, F, 1, { angle: a > 0.3 ? -Math.PI / 2 : dir > 0 ? a : Math.PI - a, spread: 1.4, speed: H * 0.4, life: 0.5 });
            }
            const hx = mx + dir * Math.cos(a) * L;
            for (const r of u.others()) {
                if (Math.abs(r.x - hx) < me.w * 0.9 && Math.abs(r.y - (my + Math.sin(a) * L)) < me.h * 1.2) {
                    hit(r, dir, 'tumble');
                }
            }
        });
        let smoke = 0;
        sc.tick((t, dt) => {
            if (t < TIN || t > TFIRE) {
                return;
            }
            smoke += dt * 3;
            if (smoke >= 1) {
                smoke -= 1;
                K.puff(mx, my - s * 2, s, '#6e6470', s, me.w * 0.25, 0.7, dir * 10, -25, 0.5);
            }
        });
        sc.at(TFIRE, () => {
            ring(sc, mx, my, s * 2, me.w * 1.2, 0.9, 0.25, ['#ffffff', F[1]], 2);
            ultShake(3 + P, 300);
        });
        sc.at(TG, () => ultShake(3, 500));
        // 땅 불길에 닿은 애 떠오름
        sc.at(TG + 0.7, () => {
            const hx = hitX();
            for (const r of u.others()) {
                if (Math.abs(r.x - hx) < W * 0.3 && (!q || r.pokemon !== q.pokemon)) {
                    hit(r, away(u, r.x), 'lift');
                }
            }
        });
        sc.at(TWH, () => {
            ring(sc, tx, G - s, me.w * 0.4, me.w * 3, 0.22, 0.5, ['#ffffff', F[1], F[2]], 3);
            ultShake(5 + 2 * P, 700);
            if (q) {
                hit(where(u, q), dir, 'spin', 0);
            }
        });
        emberRise(sc, TWH, sec, F);
    }

    // ═════ 꼬부기 — 로케트박치기 (ultrush) ═════
    // 머리 · 팔다리를 등껍질에 쏙 → 껍질이 제자리에서 팽이처럼 돌며 물을 뿜어 들썩 → 물줄기를 뒤로 뿜으며 로켓처럼 날아가 쾅
    // → 높이 튕겨 올라 빙글빙글 제자리로 → 첨벙 — 왕관 물보라 · 껍질에서 머리를 쏙 내밀며 반짝 (약 4.6초)
    UNIQ.squirtle = { fx: 'ultrush', ms: (P) => 4600 + 200 * P, run: runSquirtRocket };
    function runSquirtRocket(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TIDE = K.pal.TIDE;
        const r = Math.max(me.w * 0.42, 5 * s);
        const TIN = 0.15;
        const TSHELL = 0.45;
        const TGO = 1.3;
        const THIT = TGO + 0.32;
        const TLAND = THIT + 0.95;
        const TPOP = TLAND + 0.15;
        const q = nearest(u);
        const ax = clamp(q ? q.x - Math.sign(q.x - me.x || dir) * (q.w * 0.5 + r) : me.x + dir * Math.min(W * 0.35, me.w * 5 + 30), r, W - r);
        const dd = Math.sign(ax - me.x) || dir;
        const peak = Math.min(H * 0.45, me.h * 3.2 + 20);
        const posAt = (t) => {
            if (t < TGO) {
                const hop = t > TSHELL ? Math.abs(Math.sin((t - TSHELL) * 9)) * s * 2 * clamp((t - TSHELL) / 0.4, 0, 1) : 0;
                return [me.x, G - r * 0.85 - hop];
            }
            if (t < THIT) {
                const k = easeIn((t - TGO) / (THIT - TGO));
                return [lerp(me.x, ax, k), G - r * 0.85 - Math.sin(k * Math.PI) * s * 4];
            }
            if (t < TLAND) {
                const k = (t - THIT) / (TLAND - THIT);
                return [lerp(ax, me.x, k), G - r * 0.85 - Math.sin(k * Math.PI) * peak];
            }
            return [me.x, G - r * 0.85];
        };
        const rotAt = (t) => (t < TSHELL ? 0 : t < TGO ? (t - TSHELL) ** 2 * 18 : t < THIT ? 11 + (t - TGO) * 40 : t < TLAND ? 24 - (t - THIT) * 18 * dd : 0);
        const sc = scene(u, sec + 0.3, 'uniq squirtle');
        ultDark(0.3, ms - 200);
        // 물줄기 (껍질 뒤) — 들썩일 땐 짧게 사방으로, 날아갈 땐 뒤로 길게
        sc.add({ max: TLAND, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const [x, y] = posAt(life);
            if (life > TGO && life < THIT + 0.05) {
                const len = Math.max(me.w * 1.5, Math.abs(x - me.x) + r);
                K.waterJet(ctx, px, s, x - dd * r * 0.8, y, -dd, len, r * 0.9, TIDE, life, 0, s * 1.5, G);
            }
        } });
        // 꼬부기 (꼭두각시) — 껍질에 쏙 들어갔다가 마지막에 쏙 나옴
        puppet(sc, pokemon, u, () => me.b, TIDE[2], sec - 0.1, {
            scale: (t) => (t < TIN ? 1 : t < TSHELL ? lerp(1, 0.55, (t - TIN) / (TSHELL - TIN)) : t < TPOP ? 0.001 : 1 + 0.3 * Math.exp(-(t - TPOP) * 6) * Math.cos((t - TPOP) * 18)),
            glow: (t) => (t > TPOP && t < TPOP + 0.25 ? 0.6 * (1 - (t - TPOP) / 0.25) : 0),
            glowColor: '#ffffff',
        });
        // 등껍질
        sc.add({ max: TPOP + 0.05, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TIN + 0.1) {
                return;
            }
            const [x, y] = posAt(life);
            const a = clamp((life - TIN - 0.1) / 0.15, 0, 1) * (life > TPOP - 0.02 ? 0 : 1);
            stShell(ctx, px, s, x, y, r, rotAt(life), a);
        } });
        let spurt = 0;
        sc.tick((t, dt) => {
            if (t < TSHELL || t > TGO) {
                return;
            }
            spurt += dt * 30;
            const [x, y] = posAt(t);
            while (spurt >= 1 && room(1)) {
                spurt -= 1;
                K.splash(x + rnd(-1, 1) * r, y, s, TIDE, 1, H * 0.35, { angle: -Math.PI / 2 + rnd(-1.2, 1.2), spread: 0.3, life: 0.5 });
            }
        });
        sc.at(TSHELL, () => {
            ring(sc, me.x, G - s, r, me.w * 1.8, 0.25, 0.4, [TIDE[1], '#ffffff'], 2);
            ultShake(1.5, 150);
        });
        sc.at(TGO, () => {
            ring(sc, me.x - dd * r, G - r, s * 2, me.w * 1.4, 0.8, 0.25, ['#ffffff', TIDE[1]], 2);
            K.splash(me.x - dd * r, G - s, s, TIDE, 14, H * 0.45, { angle: -Math.PI / 2 - dd * 0.6, spread: 0.9 });
            ultShake(2.5, 160);
        });
        sc.at(THIT, () => {
            const bx = ax + dd * r;
            impactFrames(sc, W, H, 0.45, 0.3);
            ring(sc, bx, G - r, me.w * 0.3, me.w * 2.6, 0.8, 0.35, ['#ffffff', TIDE[1], TIDE[2]], 2);
            K.splash(bx, G - r, s, TIDE, 24, H * 0.6, { spread: 2.6 });
            ultShake(4 + 2 * P, 320);
            for (const q2 of u.others()) {
                if (Math.abs(q2.x - bx) < me.w * 1.5) {
                    hit(q2, dd, 'tumble');
                }
            }
        });
        // 물방울 꼬리 — 튕겨 오를 때
        let drip = 0;
        sc.tick((t, dt) => {
            if (t < THIT || t > TLAND) {
                return;
            }
            drip += dt * 25;
            const [x, y] = posAt(t);
            while (drip >= 1 && room(1)) {
                drip -= 1;
                K.splash(x, y, s, TIDE, 1, H * 0.15, { angle: Math.PI / 2, spread: 1.2, life: 0.6 });
            }
        });
        // 첨벙 — 왕관 물보라 · 머리 쏙
        sc.at(TLAND, () => {
            K.crownSplash(sc, me.x, G, Math.max(me.w * 0.9, 12 * s), 1.1, TIDE);
            ring(sc, me.x, G - s, me.w * 0.5, me.w * 3, 0.2, 0.6, ['#ffffff', TIDE[1]], 2);
            ultShake(3, 250);
        });
        sc.at(TPOP, () => {
            sparkles(me.x, me.b - me.h * 0.7, s, ['#ffffff', TIDE[1]], 10, me.w * 0.6, 30);
            ring(sc, me.x, me.b - me.h * 0.5, me.w * 0.3, me.w * 1.4, 0.9, 0.3, ['#ffffff', TIDE[1]], 1);
        });
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = (life - TPOP - 0.1) / 0.35;
            if (k > 0 && k < 1) {
                glint(ctx, px, s, me.x + dir * me.w * 0.22, me.b - me.h * 0.78, me.w * 0.45 * Math.sin(k * Math.PI), 1);
            }
        } });
        // 물결 고리 — 첨벙 뒤로 잔잔하게
        [0.25, 0.6, 0.95].forEach((dt0) => sc.at(TLAND + dt0, () => ring(sc, me.x, G - s, me.w * 0.6, me.w * 2.4, 0.18, 0.7, [TIDE[1], TIDE[2]], 1)));
    }

    // ═════ 어니부기 — 아쿠아테일 (ultrush) ═════
    // 복슬복슬한 꼬리를 휘휘 젓자 둘레의 물방울이 소용돌이치며 모여 꼬리 끝에 물 구가 차오름 → 높이 뛰어 공중제비하며 물 구를 상대에게 내려침
    // (쾅 · 물 고리) → 내려친 자리 둘레로 물기둥 셋이 차례로 솟고 양옆으로 큰 파도가 밀려감 → 폴짝 제자리로 · 물방울 비 (약 5.6초)
    UNIQ.wartortle = { fx: 'ultrush', ms: (P) => 5600 + 200 * P, run: runWartAquaTail };
    function runWartAquaTail(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TIDE = K.pal.TIDE;
        const TSW = 0.2;
        const TJ = 1.5;
        const TSL = TJ + 0.65;
        const TBACK = TSL + 0.35;
        const THOME = TBACK + 0.55;
        const TP = [TSL + 0.2, TSL + 0.45, TSL + 0.7];
        const TW = TSL + 0.15;
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * Math.min(W * 0.4, me.w * 5 + 40), W * 0.1, W * 0.9);
        const dd = Math.sign(tx - me.x) || dir;
        const land = clamp(tx - dd * me.w * 0.6, me.w * 0.5, W - me.w * 0.5);
        const peak = Math.min(H * 0.4, me.h * 2.8 + 20);
        const xAt = (t) => (t < TJ ? me.x : t < TSL ? lerp(me.x, land, (t - TJ) / (TSL - TJ)) : t < TBACK ? land : t < THOME ? lerp(land, me.x, easeOut((t - TBACK) / (THOME - TBACK))) : me.x);
        const footAt = (t) => {
            if (t > TJ && t < TSL) {
                const k = (t - TJ) / (TSL - TJ);
                return me.b - 4 * peak * k * (1 - k);
            }
            if (t > TBACK && t < THOME) {
                return me.b - Math.sin(((t - TBACK) / (THOME - TBACK)) * Math.PI) * me.h * 1.1;
            }
            return me.b;
        };
        const rotAt = (t) => (t > TJ && t < TSL ? dd * TAU * easeOut((t - TJ) / (TSL - TJ)) : 0);
        const tailAt = (t) => {
            const a = rotAt(t);
            const ox = -dir * me.w * 0.45;
            const oy = -me.h * 0.3;
            const cx = xAt(t);
            const cy = footAt(t) - me.h * 0.5;
            return [cx + ox * Math.cos(a) - (oy + me.h * 0.2) * Math.sin(a), cy + ox * Math.sin(a) + (oy + me.h * 0.2) * Math.cos(a)];
        };
        const Rb = Math.max(me.w * 0.38, 6 * s);
        const ballK = (t) => (t < TSW ? 0 : t < TSL ? easeOut(clamp((t - TSW) / 1.2, 0, 1)) : 0);
        const sc = scene(u, sec + 0.3, 'uniq wartortle');
        ultDark(0.32, ms - 200);
        // 소용돌이 · 물 구 (어니부기 뒤)
        sc.add({ max: TSL + 0.05, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const [x, y] = tailAt(life);
            const k = ballK(life);
            if (life < TJ) {
                K.swirlRing(ctx, px, s, x, y, Rb * (2.4 - 1.2 * k), 0.5, life, dir, [TIDE[1], TIDE[2]], clamp((life - TSW) / 0.3, 0, 1));
                K.swirlRing(ctx, px, s, x, y, Rb * (1.6 - 0.6 * k), 0.5, life * 1.4, -dir, [TIDE[0], TIDE[2]], clamp((life - TSW - 0.3) / 0.3, 0, 1));
            }
            if (k > 0.05) {
                fireOrb(ctx, px, s, x, y, Rb * (0.4 + 0.6 * k), TIDE, life, 1, G, 0.95, 0, [1, 0.78, 0.55, 0.3], 0);
                glint(ctx, px, s, x - Rb * 0.3 * k, y - Rb * 0.35 * k, Rb * 0.35 * k, 0.8);
            }
        } });
        puppet(sc, pokemon, u, footAt, TIDE[2], sec - 0.1, { x: xAt, rot: rotAt, glow: (t) => (t < TSL ? 0.06 * (1 + Math.sin(t * 16)) : 0), glowColor: TIDE[0] });
        // 빨려 드는 물방울
        let pull = 0;
        sc.tick((t, dt) => {
            if (t < TSW || t > TJ - 0.1) {
                return;
            }
            pull += dt * 26;
            while (pull >= 1 && room(1)) {
                pull -= 1;
                const [x, y] = tailAt(t);
                const a = rnd(0, TAU);
                const rr = Rb * rnd(2.5, 4);
                const x0 = x + Math.cos(a) * rr;
                const y0 = y + Math.sin(a) * rr * 0.7;
                sigParticle({ x: x0, y: y0, x0, y0, s, max: rnd(0.25, 0.4), color: pick(TIDE.slice(0, 3)),
                    update: (d) => {
                        const f = Math.min(1, (d.life / d.max) ** 2);
                        d.x = d.x0 + (x - d.x0) * f;
                        d.y = d.y0 + (y - d.y0) * f;
                    },
                    draw: (ctx, d, tt, px) => {
                        ctx.globalAlpha = Math.min(1, tt * 4);
                        ctx.fillStyle = d.color;
                        ctx.fillRect(px(d.x), px(d.y), s, s);
                    },
                });
            }
        });
        // 큰 파도 둘 — 내려친 자리에서 양옆으로
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = (life - TW) / 1.7;
            if (k <= 0 || k >= 1) {
                return;
            }
            const hw = Math.max(me.h * 1.3, H * 0.16) * (1 - 0.6 * k) * Math.min(1, k * 6);
            const reach = W * 0.55 * easeOut(k);
            for (const sd of [-1, 1]) {
                K.waveFront(ctx, px, s, tx + sd * reach, G, sd, hw, Math.min(reach, W * 0.3), TIDE, life, 1 - k * k);
            }
        } });
        sc.at(TJ, () => {
            ring(sc, me.x, G - s, me.w * 0.4, me.w * 2, 0.25, 0.35, ['#ffffff', TIDE[1]], 2);
            K.splash(me.x, G - s, s, TIDE, 10, H * 0.4);
        });
        // 내려침
        sc.at(TSL, () => {
            impactFrames(sc, W, H, 0.5, 0.35);
            ultShake(6 + 2 * P, 500);
            ring(sc, tx, G - s, me.w * 0.4, me.w * 3.6, 0.22, 0.55, ['#ffffff', TIDE[1], TIDE[2]], 3);
            K.splash(tx, G - s, s, TIDE, 30, H * 0.7, { spread: 2.4 });
            if (q) {
                hit(where(u, q), dd, 'tumble', 0);
            }
        });
        // 물기둥 셋 — 가운데 → 양옆
        const d = Math.max(me.w * 1.6, W * 0.12);
        [tx, tx - d, tx + d].forEach((x0, i) => {
            const x = clamp(x0, W * 0.05, W * 0.95);
            sc.at(TP[i], () => {
                K.geyser(sc, x, G, Math.max(me.w * 0.35, 5 * s), Math.min(G * 0.85, H * 0.6), 1.3, TIDE);
                ultShake(3 + i, 250);
                for (const r of u.others()) {
                    if (Math.abs(r.x - x) < me.w * 0.9 && (!q || r.pokemon !== q.pokemon || i > 0)) {
                        hit(r, away(u, r.x), 'lift');
                    }
                }
            });
        });
        // 파도에 휩쓸림
        sc.at(TW + 0.8, () => {
            for (const r of u.others()) {
                if (Math.abs(r.x - tx) < W * 0.4) {
                    hit(r, Math.sign(r.x - tx) || dd, 'tumble');
                }
            }
        });
        K.waterRain(sc, TSL + 0.9, sec, TIDE);
    }

    // 불꽃 꽃 — (x, y) 가운데서 불꽃 꽃잎 여섯 장이 활짝 (k 0 → 1 피고, 끝에 식으며 사그라듦)
    function stFireFlower(ctx, px, s, x, y, R, k, T, cols, alpha = 1, rot = 0) {
        if (k <= 0.02 || alpha <= 0.01) {
            return;
        }
        for (let i = 0; i < 6; i++) {
            const a = rot + (i * TAU) / 6 - Math.PI / 2;
            const L = R * k;
            K.fireTail(ctx, px, s, x + Math.cos(a) * L, y + Math.sin(a) * L, Math.cos(a), Math.sin(a), L, Math.max(2 * s, R * 0.42 * k), cols, T + i, alpha);
        }
        fireOrb(ctx, px, s, x, y, Math.max(2 * s, R * 0.32 * k), cols, T, 1, Infinity, alpha, 0, [1, 0.78, 0.55, 0.3], 0);
    }
    // 물 이빨 턱 — (x, y) 가운데로 위아래 턱이 gap 만큼 벌어짐 (물 띠 + 하얀 송곳니)
    function stWaterJaws(ctx, px, s, x, y, w, gap, cols, alpha = 1) {
        if (alpha <= 0.01) {
            return;
        }
        const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
        const th = Math.max(3 * s, w * 0.18);
        const nT = 6;
        for (const sd of [-1, 1]) {
            const y0 = y + sd * gap;
            for (let dx = -w / 2; dx <= w / 2; dx += s) {
                const f = (2 * dx) / w;
                const bow = (1 - f * f) * w * 0.07 * sd; // 턱이 둥글게
                const yy = y0 + bow;
                const top = sd < 0 ? yy - th : yy;
                paths[0].rect(px(x + dx), px(top - s), s, th + 2 * s);
                paths[1].rect(px(x + dx), px(top), s, th);
                paths[2].rect(px(x + dx), px(sd < 0 ? top + th * 0.15 : top + th * 0.5), s, Math.max(s, th * 0.3));
                // 송곳니 — 안쪽으로 뾰족
                const ti = Math.floor(((dx + w / 2) / w) * nT);
                const tf = ((dx + w / 2) / w) * nT - ti;
                const fang = (1 - Math.abs(tf - 0.5) * 2) * th * 1.1 * (1 - Math.abs(f) * 0.3);
                if (fang > s * 0.5) {
                    paths[3].rect(px(x + dx), px(sd < 0 ? yy : yy - fang), s, Math.max(s, px(fang)));
                }
            }
        }
        K.fillPaths(ctx, paths, [cols[3], cols[2], cols[1], '#ffffff'], alpha);
    }

    // ═════ 치코리타 — 매지컬리프 (ultswarm) ═════
    // 머리의 잎이 반짝이며 빙글 → 휙휙 흔들 때마다 반짝이는 마법 잎이 부채꼴로 흩어졌다가 저마다 굽은 길로 상대를 쫓아감(반짝 꼬리)
    // → 하나씩 꽂힐 때마다 반짝 · 마지막엔 상대 둘레를 맴돌던 잎들이 분홍 꽃잎으로 바뀌어 팡 흩날림 (약 4.6초)
    UNIQ.chikorita = { fx: 'ultswarm', ms: (P) => 4600 + 200 * P, run: runChikoMagical };
    function runChikoMagical(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const VC = K.pal.VINE;
        const PINK = K.pal.PINK;
        const MAG = ['#ffffff', '#f6ffd0', '#c8ff7a', '#ff9ad0'];
        const head = [me.x + dir * me.w * 0.1, me.b - me.h * 0.95];
        const q = nearest(u);
        const tgt = () => {
            if (q) {
                const r = q.pokemon.el.getBoundingClientRect();
                if (r.width > 0) {
                    return [r.left + r.width / 2, r.top + r.height * 0.5, r.width];
                }
            }
            return [clamp(me.x + dir * W * 0.4, W * 0.08, W * 0.92), G - me.h * 0.6, me.w];
        };
        const N = 8;
        const TL = [0.7, 0.95, 1.2]; // 잎을 흔드는 때 — 세 번에 나눠 날림
        const FLY = 1.1;
        const leaves = [];
        for (let i = 0; i < N; i++) {
            const t0 = TL[i % 3] + Math.floor(i / 3) * 0.06;
            const a = -Math.PI / 2 + (i / (N - 1) - 0.5) * 2.4 + rnd(-0.1, 0.1);
            leaves.push({ t0, a, out: Math.max(me.w * 2, H * 0.22) * rnd(0.7, 1.1), arr: t0 + FLY + rnd(-0.08, 0.08), ph: rnd(0, TAU) });
        }
        const TORB = Math.max(...leaves.map((l) => l.arr));
        const TPETAL = TORB + 0.5;
        const leafPos = (l, t) => {
            const k = (t - l.t0) / (l.arr - l.t0);
            if (k < 0) {
                return null;
            }
            const [x2, y2, tw] = tgt();
            if (k >= 1) {
                // 상대 둘레를 맴돎
                const a = l.ph + (t - l.arr) * 9;
                const r = tw * 0.8 * (1 - clamp((t - TPETAL + 0.25) / 0.25, 0, 1) * 0.6);
                return [x2 + Math.cos(a) * r, y2 + Math.sin(a) * r * 0.45, a * 2];
            }
            const x1 = head[0] + Math.cos(l.a) * l.out;
            // 게임 화면 — 날아가는 길 꼭대기 (곡선 가운데 ≈ (시작 + 2 × 꺾는 점 + 끝) / 4) 가 잎 길이까지 연출 위 끝 아래 (#107 — 길 높이만)
            const yTop = gameTop() > 0 ? gameTop() + Math.max(5 * s, me.w * 0.32) + 2 * s : -Infinity;
            const y1 = Math.max(head[1] + Math.sin(l.a) * l.out, 2 * yTop - (head[1] + y2) / 2);
            const e = k * k * (3 - 2 * k);
            const bx = (1 - e) * (1 - e) * head[0] + 2 * (1 - e) * e * x1 + e * e * x2;
            const by = (1 - e) * (1 - e) * head[1] + 2 * (1 - e) * e * y1 + e * e * y2;
            return [bx + Math.sin(t * 9 + l.ph) * s * 2 * (1 - k), by, t * 14 + l.ph];
        };
        const sc = scene(u, sec + 0.3, 'uniq chikorita');
        ultDark(0.3, ms - 200);
        // 치코리타 — 잎을 흔들 때마다 고개가 까딱
        puppet(sc, pokemon, u, (t) => me.b - (TL.some((tl) => t > tl - 0.08 && t < tl + 0.08) ? s * 2 : 0), VC[1], sec - 0.1, {
            rot: (t) => (TL.some((tl) => t > tl - 0.1 && t < tl + 0.1) ? dir * 0.12 : 0),
            glow: (t) => (t < TL[2] + 0.2 ? 0.12 * (1 + Math.sin(t * 18)) : 0),
            glowColor: MAG[2],
        });
        // 머리 잎 반짝 · 빙글 도는 빛
        sc.add({ max: TL[2] + 0.4, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp(life / 0.4, 0, 1) * clamp((TL[2] + 0.4 - life) / 0.3, 0, 1);
            glint(ctx, px, s, head[0], head[1], me.w * 0.4 * (1 + 0.3 * Math.sin(life * 12)), k);
            for (let j = 0; j < 6; j++) {
                const a = life * 7 + (j * TAU) / 6;
                ctx.globalAlpha = k;
                ctx.fillStyle = MAG[j % 2 ? 2 : 3];
                ctx.fillRect(px(head[0] + Math.cos(a) * me.w * 0.55), px(head[1] + Math.sin(a) * me.w * 0.25), s, s);
            }
        } });
        // 마법 잎 — 반짝 꼬리 (지난 자리 셋)
        sc.add({ max: TPETAL + 0.05, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life >= TPETAL) {
                return;
            }
            const LL = Math.max(5 * s, me.w * 0.32);
            for (const [back, al] of [[0.09, 0.2], [0.05, 0.4], [0, 1]]) {
                const list = [];
                for (const l of leaves) {
                    const p = leafPos(l, life - back);
                    if (p) {
                        list.push({ x: p[0], y: p[1], len: back ? LL * 0.8 : LL, ang: p[2] });
                    }
                }
                stLeaves(ctx, px, s, list, back ? [MAG[0], MAG[1], MAG[2], MAG[3]] : VC, al);
            }
        } });
        let tw = 0;
        sc.tick((t, dt) => {
            if (t < TL[0] || t > TPETAL) {
                return;
            }
            tw += dt * 30;
            while (tw >= 1 && room(1)) {
                tw -= 1;
                const l = pick(leaves);
                const p = leafPos(l, t);
                if (p) {
                    sparkles(p[0], p[1], s, MAG, 1, s * 2, 8);
                }
            }
        });
        TL.forEach((tl, i) => sc.at(tl, () => {
            ring(sc, head[0], head[1], s * 2, me.w * (0.9 + i * 0.2), 0.7, 0.25, [MAG[0], MAG[2]], 1);
            ultShake(1, 80);
        }));
        leaves.forEach((l, i) => sc.at(l.arr, () => {
            const [x2, y2] = tgt();
            sparkles(x2, y2, s, MAG, 6, s * 4, 15);
            ring(sc, x2, y2, s * 2, me.w * 0.8, 0.8, 0.2, ['#ffffff', MAG[3]], 1);
            if (q) {
                hit(where(u, q), Math.sign(q.x - me.x) || dir, 'shake', 0);
            }
            ultShake(1 + (i % 3) * 0.4, 70);
        }));
        // 잎이 꽃잎으로 — 팡
        sc.at(TPETAL, () => {
            const [x2, y2, w2] = tgt();
            impactFrames(sc, W, H, 0.4, 0.25);
            K.petalBurst(x2, y2, s, 46, H * 0.55, { r: w2 * 0.4, life: 2 });
            ring(sc, x2, y2, w2 * 0.3, w2 * 2.6, 0.8, 0.5, [PINK[0], PINK[2], MAG[2]], 2);
            sparkles(x2, y2, s, [PINK[0], PINK[1], MAG[2]], 14, w2, 20);
            ultShake(3 + P, 300);
            if (q) {
                hit(where(u, q), Math.sign(q.x - me.x) || dir, 'tumble', 0);
            }
            for (const r of u.others()) {
                if ((!q || r.pokemon !== q.pokemon) && Math.abs(r.x - x2) < W * 0.15) {
                    hit(r, Math.sign(r.x - x2) || dir, 'shake');
                }
            }
        });
        sc.at(TPETAL + 0.5, () => {
            const [x2, y2, w2] = tgt();
            K.petalBurst(x2, y2 - w2, s, 24, H * 0.3, { r: w2, life: 1.8, angle: -Math.PI / 2, spread: 2 });
        });
    }

    // ═════ 베이리프 — 꽃잎댄스 (ultstorm) ═════
    // 좌우로 살랑 춤추며 빙글 · 둘레의 꽃잎이 모여 몸을 감싸는 꽃잎 회오리 → 회오리가 커지며 상대에게 밀고 나가 휘감음(빙글)
    // → 회오리가 하늘로 펑 솟구쳐 터지고 화면 가득 꽃잎 비가 살랑살랑 내림 (약 5.6초)
    UNIQ.bayleef = { fx: 'ultstorm', ms: (P) => 5600 + 200 * P, run: runBayleefPetal };
    function runBayleefPetal(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const PINK = K.pal.PINK;
        const VC = K.pal.VINE;
        const TGATH = 0.3;
        const TGO = 1.9;
        const TARR = TGO + 0.9;
        const TPOP = TARR + 0.6;
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * W * 0.4, W * 0.1, W * 0.9);
        const cxAt = (t) => (t < TGO ? me.x : lerp(me.x, tx, easeOut(clamp((t - TGO) / (TARR - TGO), 0, 1))));
        const hAt = (t) => Math.max(me.h * 1.4, 12 * s) * (1 + 1.6 * easeOut(clamp((t - TGATH) / 1.8, 0, 1))) * (t > TPOP ? 1 + 3 * easeIn(clamp((t - TPOP) / 0.35, 0, 1)) : 1);
        const rAt = (t) => Math.max(me.w * 0.8, 10 * s) * (1 + 0.5 * clamp((t - TGO) / 0.8, 0, 1));
        const NP = 150;
        const pts = [];
        for (let i = 0; i < NP; i++) {
            pts.push({ y: hash(i, 3), ph: hash(i, 4) * TAU, sp: 6 + 4 * hash(i, 5), c: i % 5 === 0 ? 3 : 1 + (i % 2), t0: TGATH + hash(i, 6) * 1.2, z: hash(i, 8) < 0.5 ? 2 : 1 });
        }
        const sc = scene(u, sec + 0.3, 'uniq bayleef');
        ultDark(0.28, ms - 200);
        // 꽃잎 회오리 뒤쪽 (몸 뒤)
        const drawTwist = (front) => (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TGATH || life > TPOP + 0.4) {
                return;
            }
            const cx = cxAt(life);
            const h = hAt(life);
            const R = rAt(life);
            const fade = life > TPOP ? clamp(1 - (life - TPOP) / 0.4, 0, 1) : 1;
            const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
            for (const p of pts) {
                const k = clamp((life - p.t0) / 0.5, 0, 1);
                if (k <= 0) {
                    continue;
                }
                const a = p.ph + life * p.sp * dir;
                if ((Math.sin(a) > 0) !== front) {
                    continue;
                }
                const yy = p.y * h;
                const r = R * (0.45 + 0.75 * p.y) * (0.6 + 0.4 * k);
                const x0 = cx + Math.cos(a) * r;
                const y0 = G - yy - s;
                // 모일 때는 바깥에서 날아옴
                const fx = lerp(cx + Math.cos(p.ph) * W * 0.5, x0, easeOut(k));
                const fy = lerp(G - H * hash(p.ph, 2), y0, easeOut(k));
                K.petalAt(paths[p.c], px, s, fx, fy, s * p.z, Math.sin(life * 10 + p.ph) > 0);
            }
            K.fillPaths(ctx, paths, [PINK[0], PINK[1], PINK[2], PINK[3]], (front ? 1 : 0.55) * fade);
        };
        // 회오리 몸통 — 옅은 분홍 깔때기
        sc.add({ max: TPOP + 0.4, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - TGATH - 0.5) / 0.6, 0, 1) * (life > TPOP ? clamp(1 - (life - TPOP) / 0.4, 0, 1) : 1);
            if (k <= 0.01) {
                return;
            }
            const cx = cxAt(life);
            const h = hAt(life);
            const R = rAt(life);
            ctx.globalAlpha = 0.16 * k;
            ctx.fillStyle = PINK[1];
            for (let yy = 0; yy < h; yy += s * 2) {
                const r = R * (0.45 + 0.75 * (yy / h)) * (1 + 0.08 * Math.sin(yy * 0.1 - life * 8));
                ctx.fillRect(px(cx - r), px(G - yy - 2 * s), Math.max(s, px(2 * r)), 2 * s);
            }
        } });
        sc.add({ max: sec, draw: drawTwist(false) });
        // 베이리프 — 좌우로 살랑, 빙글
        puppet(sc, pokemon, u, (t) => me.b - Math.abs(Math.sin(t * 6)) * s * 2 * (t < TPOP ? 1 : 0), PINK[2], sec - 0.1, {
            dx: (t) => (t < TGO ? Math.sin(t * 5) * me.w * 0.15 : 0),
            rot: (t) => (t < TGO ? Math.sin(t * 5) * 0.15 : 0),
            glow: (t) => 0.1 * (1 + Math.sin(t * 9)),
            glowColor: PINK[1],
        });
        sc.add({ max: sec, draw: drawTwist(true) });
        // 바람 줄기 — 회오리를 감는 하얀 선
        sc.add({ max: TPOP + 0.3, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TGATH + 0.4) {
                return;
            }
            const cx = cxAt(life);
            const h = hAt(life);
            const R = rAt(life);
            const a0 = clamp((life - TGATH - 0.4) / 0.4, 0, 1) * (life > TPOP ? clamp(1 - (life - TPOP) / 0.3, 0, 1) : 1);
            ctx.fillStyle = '#ffffff';
            for (let j = 0; j < 3; j++) {
                for (let yy = 0; yy < h; yy += s) {
                    const f = yy / h;
                    const a = yy * 0.08 - life * 9 * dir + (j * TAU) / 3;
                    if (Math.sin(a) < 0.2) {
                        continue;
                    }
                    ctx.globalAlpha = 0.35 * a0 * Math.sin(a);
                    ctx.fillRect(px(cx + Math.cos(a) * R * (0.45 + 0.75 * f)), px(G - yy - s), s * 2, s);
                }
            }
        } });
        sc.at(TGO, () => {
            ring(sc, me.x, G - s, me.w * 0.5, me.w * 2.4, 0.25, 0.4, [PINK[0], PINK[2]], 2);
            ultShake(2, 200);
        });
        // 지나가는 길의 애는 빙글
        sc.tick((t) => {
            if (t < TGO || t > TPOP) {
                return;
            }
            const cx = cxAt(t);
            for (const r of u.others()) {
                if (Math.abs(r.x - cx) < rAt(t)) {
                    hit(r, Math.sign(r.x - me.x) || dir, 'spin');
                }
            }
        });
        // 하늘로 펑 — 꽃잎 비
        sc.at(TPOP + 0.3, () => {
            impactFrames(sc, W, H, 0.35, 0.2);
            ultShake(4 + P, 400);
            const top = G - hAt(TPOP + 0.3);
            K.petalBurst(tx, Math.max(H * 0.1, top), s, 40, H * 0.6, { r: me.w, life: 1.6 });
            ring(sc, tx, Math.max(H * 0.12, top), me.w * 0.5, W * 0.3, 0.6, 0.5, [PINK[0], PINK[2]], 2);
        });
        // 꽃잎 비 — 화면 가득 살랑살랑 (위에서 천천히)
        const RAIN = Math.round(90 * clamp(W / 480, 0.6, 2));
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = life - TPOP - 0.4;
            if (k <= 0) {
                return;
            }
            const a = clamp(k / 0.4, 0, 1) * clamp((sec - life) / 0.5, 0, 1);
            const paths = [new Path2D(), new Path2D(), new Path2D()];
            for (let j = 0; j < RAIN; j++) {
                const sp = H * (0.12 + 0.12 * hash(j, 21));
                const y = -10 + ((hash(j, 22) * H * 0.6 + k * sp) % (G + 10));
                const x = hash(j, 23) * W + Math.sin(k * 2.4 + j) * s * 6;
                K.petalAt(paths[j % 3], px, s, x, y, s * (hash(j, 24) < 0.3 ? 2 : 1), Math.sin(k * 8 + j) > 0);
            }
            K.fillPaths(ctx, paths, [PINK[1], PINK[2], PINK[3]], a);
        } });
        K.glowMark(sc, tx, G - s, W * 0.3, [PINK[0], PINK[1], PINK[2]], sec - TPOP);
        sc.at(TPOP + 0.6, () => {
            for (const r of u.others()) {
                if (Math.abs(r.x - tx) < W * 0.25) {
                    hit(r, Math.sign(r.x - tx) || dir, 'lift');
                }
            }
        });
    }

    // ═════ 브케인 — 분연 (ultnova) ═════
    // 몸을 웅크리자 등의 불꽃이 화산처럼 활활 · 땅이 우르릉 → 등에서 불덩이가 하나씩 하늘 높이 솟아올라 포물선으로 화면 곳곳에 떨어지며 펑
    // → 떨어진 자리마다 작은 불꽃 꽃이 차례로 활짝 피었다 사그라듦 (약 4.6초)
    UNIQ.cyndaquil = { fx: 'ultnova', ms: (P) => 4600 + 200 * P, run: runCyndaErupt };
    function runCyndaErupt(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const F = ST_FIRE;
        const back = [me.x - dir * me.w * 0.15, me.b - me.h * 0.8];
        const TC = 0.2;
        const TE = 1.2;
        const NB = 7;
        const q = nearest(u);
        const spots = [];
        for (let i = 0; i < NB; i++) {
            const x = i === 2 && q ? q.x : clamp(me.x + dir * (W * 0.12 + (W * 0.75 * (i + 0.5)) / NB) * (i % 2 ? 1 : 0.8) + (hash(i, 31) - 0.5) * W * 0.1, W * 0.05, W * 0.95);
            spots.push({ x: Math.abs(x - me.x) < me.w ? clamp(me.x + dir * me.w * 2, W * 0.05, W * 0.95) : x, t0: TE + i * 0.17, fly: 0.75 + hash(i, 32) * 0.2 });
        }
        const peak = Math.min(H * 0.75, G * 0.9);
        const sc = scene(u, sec + 0.3, 'uniq cyndaquil');
        ultDark(0.34, ms - 200);
        // 등의 불꽃 (몸 뒤) — 웅크릴수록 커지고 분출 땐 크게 일렁
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - TC) / 0.6, 0, 1) * clamp((sec - 0.3 - life) / 0.5, 0, 1);
            // 불꽃 혀 크기 × 0.7 · 밑동을 등 위쪽 (몸 가운데 → 등 위 끝) 으로 — 몸 칸 60% 넘게 2.9초 덮어 브케인이 불덤불에 발만 보이던 것 (#108 훑기 C) ·
            //   대신 혀 5 → 7 (가는 혀 둘) 로 일렁임 밀도는 그대로
            const erupt = life > TE && life < TE + NB * 0.17 + 0.2 ? 1.08 + 0.06 * Math.sin(life * 30) : 1; // 혀 끝 ≤ 몸 높이 (HP 판을 덮던 것 — 아트 1바퀴)
            if (k > 0.02) {
                for (const [ox, ww, hh, lean] of [[-0.42, 0.32, 0.3, -0.7], [0.42, 0.32, 0.3, 0.7], [-0.22, 0.38, 0.43, -0.35], [0.22, 0.38, 0.43, 0.35], [0, 0.52, 0.57, -dir * 0.1], [-0.32, 0.2, 0.36, -0.55], [0.32, 0.2, 0.36, 0.55]]) {
                    K.flameTongue(ctx, px, s, back[0] + ox * me.w, back[1] + me.h * 0.25, me.w * ww, me.h * hh * erupt, F, life + ox * 7, k, lean); // 밑동 = 등 위쪽 (몸 칸 위 끝이면 왕관처럼 떠 보이던 것 — 아트 1바퀴)
                }
            }
        } });
        puppet(sc, pokemon, u, (t) => me.b, F[2], sec - 0.1, {
            scale: (t) => (t < TE ? 1 - 0.08 * clamp((t - TC) / 0.8, 0, 1) : 1),
            dx: (t) => (t > TC && t < TE ? Math.sin(t * 60) * s * 0.6 : 0),
            glow: (t) => (t < TE ? clamp((t - TC) / 0.8, 0, 1) * 0.3 : 0.12),
            glowColor: F[1],
        });
        // 불덩이 — 등에서 솟아 포물선
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const R = Math.max(me.w * 0.28, 4 * s);
            for (const b of spots) {
                const k = (life - b.t0) / b.fly;
                if (k < 0 || k >= 1) {
                    continue;
                }
                const x = lerp(back[0], b.x, k);
                const y = lerp(back[1], G - R, k) - 4 * peak * k * (1 - k) * 0.8;
                const vx = (b.x - back[0]) / b.fly;
                const vy = (G - back[1]) / b.fly - 4 * peak * 0.8 * (1 - 2 * k) / b.fly;
                const sp = Math.hypot(vx, vy) || 1;
                K.fireTail(ctx, px, s, x, y, vx / sp, vy / sp, R * 4, R * 2, F, life + b.x);
            }
        } });
        // 불꽃 꽃 — 떨어진 자리마다
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            for (const b of spots) {
                const k = (life - b.t0 - b.fly - 0.08) / 0.9;
                if (k <= 0 || k >= 1) {
                    continue;
                }
                const open = easeOut(Math.min(1, k * 2.5));
                const fade = 1 - clamp((k - 0.6) / 0.4, 0, 1);
                stFireFlower(ctx, px, s, b.x, G - Math.max(me.h * 0.9, 10 * s) * 0.75, Math.max(me.h * 0.9, 10 * s), open, life, F, fade, hash(b.x, 1));
            }
        } });
        sc.at(TC, () => groundArcs(sc, me.x, G - s, me.w * 2.5, TE - TC + 0.4, F[3], 4, 1, G - s));
        [0.45, 0.75, 1.0].forEach((tb, i) => sc.at(tb, () => {
            ultShake(1.5 + i, 150);
            fireBits(back[0], back[1], s, F, 6, { angle: -Math.PI / 2, spread: 1, speed: H * 0.5, life: 0.5 });
        }));
        spots.forEach((b, i) => {
            sc.at(b.t0, () => {
                fireBits(back[0], back[1], s, F, 8, { angle: -Math.PI / 2, spread: 0.8, speed: H * 0.6, life: 0.5 });
                ultShake(2, 120);
            });
            sc.at(b.t0 + b.fly, () => {
                ring(sc, b.x, G - s, me.w * 0.3, me.w * 1.8, 0.25, 0.35, ['#ffffff', F[1], F[2]], 2);
                fireBits(b.x, G - s * 2, s, F, 12, { angle: -Math.PI / 2, spread: 1.6, speed: H * 0.5, g: H, life: 0.6 });
                debris(b.x, G - s, s, ['#5c4a33', '#8a7252', F[2]], 6, H * 0.4, { angle: -Math.PI / 2, spread: 1.6, ground: G - s, life: 0.6 });
                ultShake(2.5 + (i === 2 ? 2 : 0), 200);
                for (const r of u.others()) {
                    if (Math.abs(r.x - b.x) < me.w * 1.2) {
                        hit(r, Math.sign(r.x - b.x) || dir, i % 2 ? 'lift' : 'tumble');
                    }
                }
            });
        });
        emberRise(sc, TE + 0.8, sec, F);
    }

    // ═════ 마그케인 — 화염자동차 (ultrush) ═════
    // 몸을 말아 불꽃 바퀴로 활활 → 땅에 불길 자국을 남기며 상대에게 굴러가 쾅 → 되굴러 제자리를 지나쳤다 다시 쾅
    // → 바퀴째 높이 뛰어올라 제자리에 착지, 상대 자리에 불꽃 고리가 남아 활활 타다 사그라듦 (약 5.6초)
    UNIQ.quilava = { fx: 'ultrush', ms: (P) => 5600 + 200 * P, run: runQuilavaWheel };
    function runQuilavaWheel(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const F = ST_FIRE;
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * Math.min(W * 0.4, me.w * 5 + 40), me.w, W - me.w);
        const dd = Math.sign(tx - me.x) || dir;
        const R = Math.max(me.w * 0.5, 6 * s);
        const TCURL = 0.25;
        const T1 = 1.2; // 첫 굴러감
        const H1 = T1 + 0.45;
        const T2 = H1 + 0.1; // 되굴러 지나침
        const B2 = T2 + 0.55;
        const H2 = B2 + 0.45; // 다시 쾅
        const TJ = H2 + 0.1; // 뛰어오름
        const TL = TJ + 0.75;
        const over = clamp(me.x - dd * me.w * 1.6, R, W - R);
        const hx = tx - dd * R * 1.1;
        const xAt = (t) => {
            if (t < T1) {
                return me.x;
            }
            if (t < H1) {
                return lerp(me.x, hx, easeIn((t - T1) / (H1 - T1)));
            }
            if (t < T2) {
                return hx;
            }
            if (t < B2) {
                return lerp(hx, over, easeOut((t - T2) / (B2 - T2)));
            }
            if (t < H2) {
                return lerp(over, hx, easeIn((t - B2) / (H2 - B2)));
            }
            if (t < TJ) {
                return hx;
            }
            return lerp(hx, me.x, clamp((t - TJ) / (TL - TJ), 0, 1));
        };
        // 게임 화면 — 뛰어오른 꼭대기에서도 불꽃 바퀴 (가운데 = 발 − R · 불꽃 구 r × 1.2 · 불꽃 혀까지 × 1.45) 가 연출 위 끝 아래 (#107)
        const jumpH = Math.min(H * 0.45, me.h * 3.5, gameTop() > 0 ? Math.max(R, me.b - R - R * 1.2 * 1.45 - gameTop() - 2 * s) : Infinity);
        const footAt = (t) => (t > TJ && t < TL ? me.b - Math.sin(((t - TJ) / (TL - TJ)) * Math.PI) * jumpH : me.b);
        const wheel = (t) => t > TCURL + 0.2 && t < TL;
        let ang = 0;
        let lastT = 0;
        const sc = scene(u, sec + 0.3, 'uniq quilava');
        ultDark(0.33, ms - 200);
        sc.tick((t) => {
            const v = Math.abs(xAt(t) - xAt(lastT)) / Math.max(1e-3, t - lastT);
            ang += (t - lastT) * (wheel(t) ? 10 + v / R : 0) * dd;
            lastT = t;
        });
        // 땅에 남는 불길 자국 — 굴러간 길
        let lo = me.x;
        let hi = me.x;
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < T1) {
                return;
            }
            if (life < TJ) {
                lo = Math.min(lo, xAt(life));
                hi = Math.max(hi, xAt(life));
            }
            const a = clamp((sec - 0.3 - life) / 0.8, 0, 1);
            K.groundFlames(ctx, px, s, lo - R * 0.5, hi + R * 0.5, G, me.h * 0.4, life, F, 0.85 * a);
        } });
        // 불꽃 고리 — 마지막에 상대 자리에 남아 탐 (뒤쪽 반)
        const ringR = Math.max(me.w * 1.2, 16 * s);
        const ringDraw = (front) => (ctx, it, t, px) => {
            const life = sc.t;
            const k = (life - H2) / (sec - H2);
            if (k <= 0) {
                return;
            }
            const grow = easeOut(clamp((life - H2) / 0.4, 0, 1));
            const fade = clamp((sec - 0.15 - life) / 0.6, 0, 1);
            const n = 14;
            for (let i = 0; i < n; i++) {
                const a = (i / n) * TAU + life * 0.6;
                if ((Math.sin(a) > 0) !== front) {
                    continue;
                }
                const x = tx + Math.cos(a) * ringR * grow;
                const y = G + Math.sin(a) * ringR * 0.22 * grow;
                K.flameTongue(ctx, px, s, x, y + s, Math.max(3 * s, ringR * 0.32), Math.max(me.h * 0.9, 10 * s) * (0.75 + 0.25 * Math.sin(life * 7 + i)), F, life + i, grow, 0, fade * (front ? 1 : 0.7));
            }
        };
        sc.add({ max: sec, draw: ringDraw(false) });
        // 불꽃 바퀴 (몸 뒤) · 꼬리
        sc.add({ max: TL + 0.1, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (!wheel(life)) {
                return;
            }
            const x = xAt(life);
            const y = footAt(life) - R;
            const k = clamp((life - TCURL - 0.2) / 0.25, 0, 1);
            const vx = (xAt(life + 0.02) - xAt(life)) / 0.02;
            if (Math.abs(vx) > W * 0.3) {
                K.fireTail(ctx, px, s, x + Math.sign(vx) * R * 0.6, y, Math.sign(vx), 0, R * 3.5, R * 2.1, F, life, 0.9);
            }
            fireOrb(ctx, px, s, x, y, R * 1.2, F, life, k, G, 0.92, 0, [1, 0.8, 0.6, 0.38], 0.4);
        } });
        puppet(sc, pokemon, u, (t) => (wheel(t) ? footAt(t) - R + me.h * 0.5 * 0.7 : footAt(t)), F[2], sec - 0.1, {
            x: xAt,
            rot: (t) => (wheel(t) ? ang : 0),
            scale: (t) => (wheel(t) ? 0.75 : 1),
            glow: (t) => (wheel(t) ? 0.4 : t > TL ? 0.12 * (1 + Math.sin(t * 12)) : 0.2 * clamp(t / TCURL, 0, 1)),
            glowColor: F[1],
        });
        sc.add({ max: sec, draw: ringDraw(true) });
        sc.at(TCURL, () => {
            ring(sc, me.x, me.b - me.h * 0.5, me.w * 0.3, me.w * 1.8, 0.85, 0.3, ['#ffffff', F[2]], 2);
            fireBits(me.x, me.b - me.h * 0.5, s, F, 12, { speed: H * 0.4, life: 0.5 });
        });
        for (const th of [H1, H2]) {
            sc.at(th, () => {
                const bx = hx + dd * R;
                impactFrames(sc, W, H, 0.4, 0.28);
                ring(sc, bx, G - R, me.w * 0.3, me.w * 2.4, 0.85, 0.35, ['#ffffff', F[1], F[2]], 2);
                fireBits(bx, G - R, s, F, 22, { speed: H * 0.7, life: 0.6 });
                ultShake(4 + 2 * P, 300);
                for (const r of u.others()) {
                    if (Math.abs(r.x - bx) < me.w * 1.5) {
                        hit(r, dd, 'tumble', 0.5);
                    }
                }
            });
        }
        sc.at(TJ, () => {
            ring(sc, hx, G - s, me.w * 0.4, ringR * 1.6, 0.22, 0.45, ['#ffffff', F[1]], 2);
            fireBits(hx, G - s, s, F, 16, { angle: -Math.PI / 2, spread: 1.4, speed: H * 0.6, g: H, life: 0.7 });
        });
        sc.at(TL, () => {
            K.puff(me.x, G - s, s, '#8a7252', s * 2, me.w * 0.8, 0.5, 0, -10, 0.4);
            ultShake(2, 150);
        });
        emberRise(sc, H2 + 0.3, sec, F);
    }

    // ═════ 리아코 — 깨물어부수기 (ultbarrage) ═════
    // 신나게 좌우로 깡충깡충 춤(물방울이 튐) → 상대 앞으로 폴짝 · 상대 위에 거대한 물 이빨 턱이 쩍 벌어졌다 콱!(임팩트 프레임 · 물보라)
    // → 땅에 이빨 자국 모양으로 금이 쩍 · 그 금에서 물 폭죽이 퐁퐁 솟아 물방울 별로 터짐 → 폴짝 제자리 (약 4.6초)
    UNIQ.totodile = { fx: 'ultbarrage', ms: (P) => 4600 + 200 * P, run: runTotoCrunch };
    function runTotoCrunch(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TIDE = K.pal.TIDE;
        const TD = 0.15;
        const TJ = 1.2;
        const TA = TJ + 0.4;
        const TBITE = TA + 0.55;
        const TCRACK = TBITE + 0.15;
        const TBACK = TBITE + 0.5;
        const THOME = TBACK + 0.45;
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * Math.min(W * 0.35, me.w * 5 + 30), W * 0.1, W * 0.9);
        const dd = Math.sign(tx - me.x) || dir;
        const ax = clamp(tx - dd * Math.max(me.w * 1.2, 12 * s), me.w * 0.5, W - me.w * 0.5);
        const ty = q ? q.y : G - me.h * 0.5;
        const xAt = (t) => (t < TJ ? me.x + Math.sin(t * 7) * me.w * 0.25 * clamp((t - TD) / 0.3, 0, 1) : t < TA ? lerp(me.x, ax, (t - TJ) / (TA - TJ)) : t < TBACK ? ax : t < THOME ? lerp(ax, me.x, (t - TBACK) / (THOME - TBACK)) : me.x);
        const footAt = (t) => {
            if (t < TJ) {
                return me.b - Math.abs(Math.sin(t * 7)) * me.h * 0.3 * clamp((t - TD) / 0.3, 0, 1);
            }
            if (t < TA) {
                return me.b - Math.sin(((t - TJ) / (TA - TJ)) * Math.PI) * me.h * 1.4;
            }
            if (t > TBACK && t < THOME) {
                return me.b - Math.sin(((t - TBACK) / (THOME - TBACK)) * Math.PI) * me.h * 1.2;
            }
            return me.b;
        };
        const jw = clamp(me.w * 1.7, 24 * s, W * 0.3);
        const jy = G - jw * 0.62 - Math.max(3 * s, jw * 0.18); // 턱 가운데 — 가장 벌어져도 아래턱(물 띠까지)이 땅 위
        const sc = scene(u, sec + 0.3, 'uniq totodile');
        ultDark(0.32, ms - 200);
        puppet(sc, pokemon, u, footAt, TIDE[2], sec - 0.1, { x: xAt, rot: (t) => (t < TJ ? Math.sin(t * 7) * 0.2 : 0), glow: (t) => (t > TA && t < TBITE ? 0.3 : 0), glowColor: TIDE[1] });
        // 물 이빨 턱 — 벌어졌다 콱 (낮은 패널에서 크게 벌린 윗턱이 위 끝을 넘는 부분만 위 끝 층 — #107)
        sc.split({ max: TBITE + 0.5, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TA - 0.1) {
                return;
            }
            const open = life < TBITE - 0.12 ? easeOut(clamp((life - TA + 0.1) / 0.3, 0, 1)) : 1 - easeIn(clamp((life - TBITE + 0.12) / 0.12, 0, 1));
            const gap = jw * 0.08 + jw * 0.45 * open;
            const fade = life > TBITE ? clamp(1 - (life - TBITE) / 0.4, 0, 1) : clamp((life - TA + 0.1) / 0.15, 0, 1);
            stWaterJaws(ctx, px, s, tx, jy, jw, gap, TIDE, fade);
        } });
        // 이빨 자국 금 — 위아래 두 줄의 뾰족한 금 (땅에)
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = (life - TCRACK) / 0.25;
            if (k <= 0) {
                return;
            }
            const a = clamp((sec - 0.2 - life) / 0.6, 0, 1);
            const path = new Path2D();
            const glow = new Path2D();
            const reach = jw * 0.6 * easeOut(Math.min(1, k));
            for (const sd of [-1, 1]) {
                const y0 = G + sd * s * 2;
                for (let dx = -reach; dx <= reach; dx += s) {
                    const ti = (dx + jw) / (jw / 6);
                    const tooth = (1 - Math.abs((ti % 1) - 0.5) * 2) * s * 4;
                    path.rect(px(tx + dx), px(y0 - (sd < 0 ? tooth : 0)), s, Math.max(s, px(sd < 0 ? tooth : s)));
                    glow.rect(px(tx + dx), px(y0 - (sd < 0 ? tooth : 0) - s), s, s);
                }
            }
            ctx.globalAlpha = a;
            ctx.fillStyle = '#1a2a3a';
            ctx.fill(path);
            ctx.fillStyle = TIDE[1];
            ctx.globalAlpha = a * (0.5 + 0.5 * Math.sin(life * 10));
            ctx.fill(glow);
        } });
        // 물 폭죽 — 금에서 솟아 물방울 별로
        const pops = [];
        for (let i = 0; i < 5; i++) {
            pops.push({ x: clamp(tx + (i - 2) * jw * 0.28, W * 0.05, W * 0.95), t0: TCRACK + 0.25 + i * 0.14 + (i % 2) * 0.05, h: Math.min(H * 0.55, G * 0.7) * (0.6 + 0.4 * hash(i, 41)) });
        }
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            for (const p of pops) {
                const k = (life - p.t0) / 0.4;
                if (k < 0 || k >= 1) {
                    continue;
                }
                const y = G - p.h * easeOut(k);
                K.fireTail(ctx, px, s, p.x, y, 0, -1, Math.max(4 * s, p.h * 0.3 * (1 - k)), 3 * s, TIDE, life, 1);
            }
        } });
        pops.forEach((p, i) => sc.at(p.t0 + 0.4, () => {
            const y = G - p.h;
            for (let j = 0; j < 10; j++) {
                const a = (j / 10) * TAU;
                K.splash(p.x, y, s, j % 2 ? [TIDE[0], TIDE[1]] : [TIDE[1], TIDE[2]], 2, H * 0.4, { angle: a, spread: 0.12, life: 0.9 });
            }
            ring(sc, p.x, y, s * 2, Math.max(me.w, 14 * s), 1, 0.35, ['#ffffff', TIDE[1]], 1);
            sparkles(p.x, y, s, ['#ffffff', TIDE[1]], 4, s * 4, 10);
            ultShake(1.5, 90);
        }));
        // 춤 — 물방울
        let drip = 0;
        sc.tick((t, dt) => {
            if (t < TD || t > TJ) {
                return;
            }
            drip += dt * 14;
            while (drip >= 1 && room(1)) {
                drip -= 1;
                K.splash(xAt(t), footAt(t) - me.h * 0.6, s, TIDE, 1, H * 0.3, { spread: 2.4, life: 0.5 });
            }
        });
        sc.at(TBITE, () => {
            impactFrames(sc, W, H, 0.55, 0.4);
            ultShake(6 + 2 * P, 450);
            K.splash(tx, jy, s, TIDE, 30, H * 0.65, { spread: TAU });
            ring(sc, tx, jy, jw * 0.2, jw * 1.1, 0.8, 0.35, ['#ffffff', TIDE[1], TIDE[2]], 2);
            if (q) {
                hit(where(u, q), dd, 'tumble', 0);
            }
        });
        sc.at(TCRACK, () => {
            ultShake(3, 250);
            debris(tx, G - s, s, ['#5c4a33', '#8a7252', TIDE[2]], 12, H * 0.4, { angle: -Math.PI / 2, spread: 2, ground: G - s, life: 0.7 });
            for (const r of u.others()) {
                if ((!q || r.pokemon !== q.pokemon) && Math.abs(r.x - tx) < jw * 0.7) {
                    hit(r, Math.sign(r.x - tx) || dd, 'lift');
                }
            }
        });
    }

    // ═════ 엘리게이 — 하이드로보텍스 (ultvortex) ═════
    // 엘리게이가 빙글 돌며 손짓하자 상대 발밑에 소용돌이 물웅덩이(겹겹이 도는 물 고리) → 물이 깔때기 모양 회오리로 솟구쳐 상대를 휘감음
    // (물 띠가 감겨 돌고 거품이 솟음, 닿은 애 빙글) → 회오리가 펑 터지며 굵은 물방울 비가 쏟아지고 땅마다 톡톡 물방울 왕관 (약 5.6초)
    UNIQ.croconaw = { fx: 'ultvortex', ms: (P) => 5600 + 200 * P, run: runCrocoVortex };
    function runCrocoVortex(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TIDE = K.pal.TIDE;
        const TPOOL = 0.5;
        const TUP = 1.6;
        const TBURST = TUP + 2.0;
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * Math.min(W * 0.4, me.w * 5 + 40), W * 0.12, W * 0.88);
        const vh = Math.min(G * 0.92, Math.max(H * 0.65, me.h * 5));
        const rb = Math.max(me.w * 0.35, 5 * s);
        const rt = Math.max(me.w * 1.5, W * 0.12);
        const sc = scene(u, sec + 0.3, 'uniq croconaw');
        ultDark(0.32, ms - 200);
        // 소용돌이 물웅덩이 (땅)
        sc.add({ max: TBURST + 0.4, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = easeOut(clamp((life - TPOOL) / 0.5, 0, 1)) * clamp(1 - (life - TBURST) / 0.4, 0, 1);
            if (k <= 0.02) {
                return;
            }
            const R = rt * 1.1 * k;
            ellipse(ctx, px, s, tx, G, R, R * 0.2, TIDE[3], 0.7 * k);
            ellipse(ctx, px, s, tx, G, R * 0.7, R * 0.14, TIDE[2], 0.7 * k);
            for (let j = 0; j < 3; j++) {
                K.swirlRing(ctx, px, s, tx, G, R * (0.35 + j * 0.28), 0.2, life * (1.5 - j * 0.3), dir, [TIDE[0], TIDE[1]], k);
            }
        } });
        // 깔때기 회오리 — 아래 좁고 위 넓은 물 몸통 · 감겨 도는 하얀 물 띠 · 위쪽 물보라
        sc.add({ max: TBURST + 0.2, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TUP) {
                return;
            }
            const k = easeOut(clamp((life - TUP) / 0.5, 0, 1));
            const pop = life > TBURST - 0.15 ? 1 + 0.4 * easeIn(clamp((life - TBURST + 0.15) / 0.15, 0, 1)) : 1;
            const top = vh * k;
            const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
            for (let yy = 0; yy < top; yy += s) {
                const f = yy / Math.max(1, top);
                const r = lerp(rb, rt, f * f) * pop * (1 + 0.06 * Math.sin(yy * 0.1 - life * 10));
                const cx = tx + Math.sin(f * 2.5 + life * 2) * rt * 0.12 * f;
                const y = G - yy - s;
                paths[0].rect(px(cx - r), px(y), Math.max(s, px(2 * r)), s);
                paths[1].rect(px(cx - r * 0.8), px(y), Math.max(s, px(1.6 * r)), s);
                for (let j = 0; j < 2; j++) {
                    const th = yy * (TAU / Math.max(top / 3, 8 * s)) - life * 13 * dir + j * Math.PI;
                    const sn = Math.sin(th);
                    if (sn < 0.1) {
                        continue;
                    }
                    const bw = Math.max(s, r * 0.5 * sn);
                    paths[2].rect(px(cx + Math.cos(th) * r * 0.7 - bw / 2), px(y), Math.max(s, px(bw)), s);
                }
                if (hash(Math.floor(yy / s), Math.floor(life * 15)) > 0.93) {
                    paths[3].rect(px(cx + (hash(Math.floor(yy / s), 2) - 0.5) * r * 1.6), px(y), s, s);
                }
            }
            K.fillPaths(ctx, paths, [TIDE[3], TIDE[2], TIDE[1], '#ffffff'], 0.85);
            // 위쪽 가장자리 물보라
            ellipse(ctx, px, s, tx, G - top, rt * pop, rt * 0.18, TIDE[1], 0.8);
            ellipse(ctx, px, s, tx, G - top, rt * 0.7 * pop, rt * 0.1, '#ffffff', 0.6);
        } });
        puppet(sc, pokemon, u, () => me.b, TIDE[2], sec - 0.1, {
            rot: (t) => (t < TUP ? Math.sin(t * 9) * 0.25 : 0),
            dx: (t) => (t < TUP ? Math.sin(t * 9) * s * 2 : 0),
            glow: (t) => (t < TBURST ? 0.1 * (1 + Math.sin(t * 14)) : 0),
            glowColor: TIDE[1],
        });
        // 솟는 거품 · 위로 흩뿌리는 물
        let foam = 0;
        sc.tick((t, dt) => {
            if (t < TUP || t > TBURST) {
                return;
            }
            foam += dt * 30;
            while (foam >= 1 && room(1)) {
                foam -= 1;
                const f = rnd(0.2, 1);
                const r = lerp(rb, rt, f * f);
                K.splash(tx + rnd(-1, 1) * r, G - vh * f, s, TIDE, 1, H * 0.3, { angle: -Math.PI / 2 + rnd(-1, 1), spread: 0.3, life: 0.6 });
            }
        });
        sc.at(TPOOL, () => {
            ring(sc, tx, G, me.w * 0.4, rt * 1.4, 0.2, 0.5, [TIDE[1], '#ffffff'], 2);
            ultShake(1.5, 200);
        });
        sc.at(TUP, () => {
            ultShake(4 + P, 600);
            K.splash(tx, G - s, s, TIDE, 20, H * 0.6, { spread: 1.4 });
            if (q) {
                hit(where(u, q), dir, 'spin', 0);
            }
        });
        sc.tick((t) => {
            if (t < TUP || t > TBURST) {
                return;
            }
            for (const r of u.others()) {
                if (Math.abs(r.x - tx) < rt * 0.8) {
                    hit(r, Math.sign(r.x - tx) || dir, 'spin');
                }
            }
        });
        // 펑 — 굵은 물방울 비 · 물방울 왕관
        sc.at(TBURST, () => {
            impactFrames(sc, W, H, 0.5, 0.3);
            ultShake(6 + 2 * P, 500);
            ring(sc, tx, G - vh * 0.6, rt * 0.5, W * 0.5, 0.5, 0.5, ['#ffffff', TIDE[1], TIDE[2]], 3);
            K.splash(tx, G - vh * 0.7, s, TIDE, 40, H * 0.7, { spread: TAU, life: 1.2 });
        });
        const DROPS = Math.round(44 * clamp(W / 480, 0.6, 2));
        const drops = [];
        for (let j = 0; j < DROPS; j++) {
            drops.push({ x: clamp(tx + (hash(j, 51) - 0.5) * W * 0.9, s * 2, W - s * 2), t0: TBURST + 0.1 + hash(j, 52) * 1.2, z: hash(j, 53) < 0.6 ? 2 : 1 });
        }
        const fall = Math.max(0.45, G / (H * 1.6));
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            for (const d of drops) {
                const k = (life - d.t0) / fall;
                if (k < 0 || k >= 1) {
                    continue;
                }
                const y = lerp(-10, G - s, k * k);
                const z = s * d.z;
                ctx.globalAlpha = 0.95;
                ctx.fillStyle = TIDE[2];
                ctx.fillRect(px(d.x - z / 2), px(y - z * 3), Math.max(s, z), z * 3);
                ctx.fillStyle = TIDE[0];
                ctx.fillRect(px(d.x - z / 2), px(y - z * 3), s, z);
            }
        } });
        drops.forEach((d, j) => sc.at(d.t0 + fall, () => {
            if (j % 2 === 0) {
                K.splash(d.x, G - s, s, TIDE, 4 + d.z * 2, H * 0.2, { spread: 1.2, life: 0.4 });
                ring(sc, d.x, G - s, s, me.w * 0.5 * d.z, 0.25, 0.35, [TIDE[1], TIDE[2]], 1);
            }
        }));
    }

    // 불꽃 깃털 — (x, y) 가운데, ang 쪽으로 깃대, 양옆으로 비스듬한 깃가지 (불꽃 색)
    function stFeather(ctx, px, s, x, y, len, ang, cols, alpha = 1) {
        if (alpha <= 0.01) {
            return;
        }
        const ux = Math.cos(ang);
        const uy = Math.sin(ang);
        const paths = [new Path2D(), new Path2D(), new Path2D()];
        for (let d = -len / 2; d <= len / 2; d += s * 0.8) {
            const f = (d + len / 2) / len; // 0 = 뿌리
            const x0 = x + ux * d;
            const y0 = y + uy * d;
            paths[2].rect(px(x0), px(y0), s, s);
            if (f < 0.15) {
                continue;
            }
            const bw = len * 0.28 * Math.sin(f * Math.PI) ** 0.7;
            for (const sd of [-1, 1]) {
                for (let e = s; e < bw; e += s * 0.9) {
                    const back = e * 0.45; // 깃가지는 뿌리 쪽으로 비스듬히
                    paths[e > bw - s * 1.2 ? 0 : 1].rect(px(x0 - ux * back - uy * e * sd), px(y0 - uy * back + ux * e * sd), s, s);
                }
            }
        }
        K.fillPaths(ctx, paths, [cols[3], cols[2], cols[0]], alpha);
    }
    // 진흙 덩이 — (x, y) 둥근 진흙(테두리 · 몸 · 밝은 점)
    const ST_MUD = ['#e0c08e', '#a37a4a', '#6b4a2a', '#3a2614'];
    function stMudBall(ctx, px, s, x, y, r, alpha = 1) {
        ellipse(ctx, px, s, x, y, r + s, r * 0.9 + s, ST_MUD[3], alpha);
        ellipse(ctx, px, s, x, y, r, r * 0.9, ST_MUD[2], alpha);
        ellipse(ctx, px, s, x - r * 0.15, y - r * 0.2, r * 0.6, r * 0.5, ST_MUD[1], alpha);
        ellipse(ctx, px, s, x - r * 0.35, y - r * 0.4, r * 0.18, r * 0.14, ST_MUD[0], alpha);
    }

    // ═════ 나무지기 — 에너지볼 (ultorb) ═════
    // 두 손 사이로 초록 기운이 빨려 들어 에너지볼이 커짐 → 폴짝 뛰어 화면 끝 허공을 차고(벽 차기) 반대로 높이 솟아
    // → 상대 머리 위에서 에너지볼을 내리꽂음(임팩트 프레임 · 초록 폭발) → 그 자리에서 초록 거품이 보글보글 떠올라 하나씩 톡톡 (약 4.6초)
    UNIQ.treecko = { fx: 'ultorb', ms: (P) => 4600 + 200 * P, run: runTreeckoBall };
    function runTreeckoBall(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const GE = ['#ffffff', '#e0ffc0', '#7be05a', '#2f8a3a'];
        const TC = 0.2;
        const TJ = 1.3;
        const TK = TJ + 0.45; // 허공을 참
        const TTOP = TK + 0.45; // 상대 위
        const TSLAM = TTOP + 0.22;
        const THOME = TSLAM + 0.7;
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * Math.min(W * 0.4, me.w * 5 + 40), W * 0.1, W * 0.9);
        const dd = Math.sign(tx - me.x) || dir;
        let kx = clamp(me.x - dd * Math.max(me.w * 1.8, W * 0.12), me.w * 0.6, W - me.w * 0.6); // 차는 자리 (뒤쪽 허공)
        // 3:3 합동 — 차는 자리가 동료 둘레 (그림 + 8px · 테 16px) 안이면 그 바깥 앞쪽으로 (구가 동료 머리 위에 떠 동료가 쏘는 것처럼 보이던 것, #96 아트 6바퀴 4)
        for (const bx of o.track?.avoid?.() || []) {
            if (kx > bx.l - 16 && kx < bx.r + 16) {
                kx = clamp(dd > 0 ? bx.r + 16 + me.w * 0.3 : bx.l - 16 - me.w * 0.3, me.w * 0.6, W - me.w * 0.6);
            }
        }
        const Rb = Math.max(me.w * 0.32, 5 * s);
        // 벽 차는 자리 — 게임 화면은 머리 위 공 (몸 키 1.15 + 뛰는 호 0.3 + 둘레 고리 Rb × 1.5) 이 위 끝 + 4칸 아래 (공이 정보줄에 반쯤 걸치던 것 — #96 아트 4바퀴 1)
        const ky0 = me.b - Math.min(H * 0.3, me.h * 2.2);
        const ky = gameTop() > 0 ? Math.min(me.b - me.h * 0.2, Math.max(ky0, gameTop() + me.h * 1.45 + Rb * 1.5 + 4 * s)) : ky0;
        // 게임 화면 = 꼭대기의 몸 · 머리 위 공 (둘레 고리 Rb × 1.5) 이 위 끝 + 4칸 아래 · 그래도 몸 키 0.35 는 뜀 (#96 ④)
        const topY0 = Math.max(me.h * 1.2, G - Math.min(H * 0.62, G * 0.75));
        const topY = gameTop() > 0 ? Math.min(me.b - me.h * 0.35, Math.max(topY0, gameTop() + me.h * 1.15 + Rb * 1.5 + 4 * s)) : topY0;
        const P0 = [me.x, me.b];
        const P1 = [kx, ky];
        const P2 = [tx - dd * me.w * 0.3, topY];
        const posAt = (t) => {
            if (t < TJ) {
                return P0;
            }
            if (t < TK) {
                const k = (t - TJ) / (TK - TJ);
                return [lerp(P0[0], P1[0], k), lerp(P0[1], P1[1], easeOut(k)) - Math.sin(k * Math.PI) * me.h * 0.3];
            }
            if (t < TTOP) {
                const k = (t - TK) / (TTOP - TK);
                return [lerp(P1[0], P2[0], easeOut(k)), lerp(P1[1], P2[1], easeOut(k))];
            }
            if (t < TSLAM + 0.15) {
                return P2;
            }
            const k = clamp((t - TSLAM - 0.15) / (THOME - TSLAM - 0.15), 0, 1);
            return [lerp(P2[0], P0[0], k), lerp(P2[1], P0[1], k * k) - Math.sin(k * Math.PI) * me.h * 0.6];
        };
        // 게임 화면 = 구 (둘레 고리 Rb × 1.5) 가 늘 위 끝 + 4칸 아래 — 벽을 차고 오르는 호 꼭대기에서 윗면이 위 끝에 0.2 ~ 0.4초 일자로 잘리던 것 (#96 UX 6바퀴 큼 1 · 같은 구 세 번째)
        const ballTop = gameTop() > 0 ? gameTop() + Rb * 1.5 + 4 * s : -Infinity;
        const ballAt = (t) => {
            const [bx, by] = ballAt0(t);
            return [bx, Math.max(ballTop, by)];
        };
        const ballAt0 = (t) => {
            const [x, y] = posAt(t);
            if (t < TJ) {
                // 기 모으는 동안 = 입 앞 +12px · 위 6px (작은 몸이 구 · 별에 가려지던 것 — #96 아트 4바퀴 3)
                return u.mouth ? [u.mouth.x + dir * 12, u.mouth.y - 6] : [x + dir * me.w * 0.1, y - me.h * 0.55];
            }
            if (t < TTOP + 0.05) {
                return [x, y - me.h * 1.15];
            }
            const k = clamp((t - TTOP - 0.05) / (TSLAM - TTOP - 0.05), 0, 1);
            return [lerp(x, tx, k), lerp(y - me.h * 1.15, G - Rb, k * k)];
        };
        const sc = scene(u, sec + 0.3, 'uniq treecko');
        ultDark(0.32, ms - 200);
        // 에너지볼 (나무지기 앞)
        puppet(sc, pokemon, u, (t) => posAt(t)[1], GE[2], sec - 0.1, {
            x: (t) => posAt(t)[0],
            rot: (t) => (t > TK - 0.08 && t < TK + 0.12 ? -dd * 0.5 : t > TTOP && t < TSLAM + 0.15 ? dd * 0.3 : 0),
            glow: (t) => (t < TSLAM ? 0.1 + 0.1 * clamp((t - TC) / 1, 0, 1) : 0),
            glowColor: GE[1],
        });
        sc.add({ max: TSLAM + 0.05, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TC) {
                return;
            }
            const [x, y] = ballAt(life);
            const k = easeOut(clamp((life - TC) / 1.0, 0, 1));
            fireOrb(ctx, px, s, x, y, Rb * (0.3 + 0.7 * k), GE, life, 1, G, 0.95, 0, [1, 0.75, 0.5, 0.28], 0);
            jointOrb(o, ctx, x, y, Rb * (0.3 + 0.7 * k), life < TTOP + 0.05, life >= TTOP + 0.05);
            K.swirlRing(ctx, px, s, x, y, Rb * (1.3 + 0.2 * Math.sin(life * 9)), 0.9, life, dir, [GE[0], GE[2]], 0.8 * k);
            glint(ctx, px, s, x - Rb * 0.3, y - Rb * 0.3, Rb * 0.4 * k, 0.9);
        } });
        // 떨어지는 공의 꼬리
        sc.add({ max: TSLAM + 0.05, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TTOP + 0.05) {
                return;
            }
            const [x, y] = ballAt(life);
            const [x0, y0] = ballAt(TTOP + 0.05);
            const L = Math.hypot(x - x0, y - y0);
            if (L > s * 2) {
                // 불투명 (반투명 연두 기둥 한 장이 "유리" 로 읽히던 것 — #96 아트 6바퀴 8)
                K.fireTail(ctx, px, s, x, y, (x - x0) / L, (y - y0) / L, L, Rb * 1.8, GE, life, 1);
            }
        } });
        K.chargeSwirl(sc, (t) => ballAt(t), TC, TJ - 0.05, Math.max(me.w * 3, short(u) * 0.35), Rb, GE, dir);
        sc.at(TJ, () => {
            K.puff(me.x, G - s, s, '#8a7252', s * 2, me.w * 0.6, 0.4, 0, -10, 0.4);
            ultShake(1.5, 100);
        });
        sc.at(TK, () => {
            ring(sc, kx - dd * me.w * 0.4, ky - me.h * 0.4, s * 2, me.w * 1.2, 0.35, 0.3, ['#ffffff', GE[1]], 2);
            sparkles(kx - dd * me.w * 0.4, ky - me.h * 0.4, s, ['#ffffff', GE[1]], 6, s * 3, 10);
            ultShake(1.5, 100);
        });
        sc.at(TSLAM, () => {
            jointOrb(o);
            impactFrames(sc, W, H, 0.55, 0.35);
            ultShake(5 + 2 * P, 450);
            // 바닥 고리 = 점선 (2px 점 · 4px 간격 — 1px 매끈한 큰 타원이 다른 점 · 선 말투와 달라 보이던 것, #96 아트 4바퀴 3)
            sc.add({ max: 0.55, draw: (ctx, it, t, px) => {
                const r = me.w * 0.4 + (me.w * 3 * easeOut(Math.min(1, t)));
                const n = Math.max(12, Math.round((Math.PI * 2 * r) / 6));
                ctx.globalAlpha = (1 - Math.min(1, t)) ** 1.2;
                ctx.fillStyle = GE[1];
                for (let i = 0; i < n; i++) {
                    const a = (i / n) * Math.PI * 2;
                    ctx.fillRect(px(tx + Math.cos(a) * r), px(G - s + Math.sin(a) * r * 0.24), 2, 2);
                }
                ctx.globalAlpha = 1;
            } });
            fireBits(tx, G - Rb, s, GE, 30, { angle: -Math.PI / 2, spread: 2.6, speed: H * 0.7, g: H, life: 0.8 });
            for (const r of u.others()) {
                if (Math.abs(r.x - tx) < me.w * 2) {
                    hit(r, Math.sign(r.x - tx) || dd, 'tumble');
                }
            }
        });
        // 잎 흩날림 — 맞은 자리에서 잎 16장이 솟았다가 팔랑이며 (0.12초마다 뒤집힘) 내려앉음 · 8 × 5칸 세 톤 (밝은 위 #b8ec6c · 테 · 잎맥 · 꼭지 #1f4a1c · 아래 #6cc04a) ·
        //   초록 거품만 보여 "꽃잎 해일" 끝이 거품처럼 읽히던 것 (#108 기획 — 잎 모양이 보이게 키움 · #159 태현 님 "추천대로" 다시 넣음) · 거품은 16 → 8 ·
        //   게임 화면 — 솟는 꼭대기는 연출 위 끝 아래 (#107 — 솟는 빠르기만 줄임)
        const LEAF = [[2, 0, 1], [3, 0, 0], [4, 0, 0], [5, 0, 0], [6, 0, 1],
            [0, 1, 1], [1, 1, 0], [2, 1, 0], [3, 1, 0], [4, 1, 0], [5, 1, 0], [6, 1, 0], [7, 1, 1],
            [0, 2, 1], [1, 2, 2], [2, 2, 1], [3, 2, 1], [4, 2, 1], [5, 2, 1], [6, 2, 2], [7, 2, 1],
            [1, 3, 1], [2, 3, 2], [3, 3, 2], [4, 3, 2], [5, 3, 2], [6, 3, 1],
            [2, 4, 1], [3, 4, 1], [4, 4, 1], [5, 4, 1]];
        const leafG = H * 1.2;
        const leafUp = gameTop() > 0 ? Math.sqrt(2 * leafG * Math.max(0, G - Rb - gameTop() - 4 * s - 4)) : Infinity; // 4px 더 — 사라지는 말 줄을 스치던 것 (#107 아트 작음 ②)
        const leaves = [];
        for (let i = 0; i < 16; i++) {
            const a = -Math.PI / 2 + (hash(i, 71) - 0.5) * 2.4;
            const v0 = H * (0.6 + 0.5 * hash(i, 72));
            leaves.push({ a, v: Math.min(v0, leafUp / Math.max(0.2, -Math.sin(a))), t0: TSLAM + 0.05 + hash(i, 73) * 0.2, life: 1.2 + hash(i, 74) * 0.5 });
        }
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const pl = [new Path2D(), new Path2D(), new Path2D()];
            leaves.forEach((lf, i) => {
                const k = life - lf.t0;
                if (k < 0 || k >= lf.life) {
                    return;
                }
                const x0 = tx + Math.cos(lf.a) * lf.v * k * 0.9 + Math.sin(life * 6 + i) * s * 3;
                const y0 = Math.min(G - 4 * s, G - Rb + Math.sin(lf.a) * lf.v * k + 0.5 * leafG * k * k);
                const flip = (Math.floor(life / 0.12) + i) % 2 === 1;
                for (const [cx, cy, tone] of LEAF) {
                    pl[tone].rect(px(x0 + (flip ? 3.5 - cx : cx - 3.5) * s), px(y0 + (cy - 2) * s), s, s);
                }
            });
            K.fillPaths(ctx, pl, ['#b8ec6c', '#1f4a1c', '#6cc04a'], 1);
        } });
        // 초록 거품 — 보글보글 떠올라 톡
        const NBUB = 8;
        const bubs = [];
        for (let i = 0; i < NBUB; i++) {
            bubs.push({ x: tx + (hash(i, 61) - 0.5) * me.w * 4, t0: TSLAM + 0.15 + hash(i, 62) * 0.9, life: 0.7 + hash(i, 63) * 0.7, r: Math.max(2 * s, me.w * (0.12 + 0.14 * hash(i, 64))), rise: H * (0.12 + 0.16 * hash(i, 65)) });
        }
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            for (const b of bubs) {
                const k = (life - b.t0) / b.life;
                if (k < 0 || k >= 1) {
                    continue;
                }
                const x = b.x + Math.sin(life * 5 + b.x) * s * 2;
                const y = G - s - b.r - b.rise * k;
                const r = b.r * (0.6 + 0.4 * Math.min(1, k * 3));
                K.ringDots(ctx, px, s, x, y, r, 1, [GE[2], GE[1]], 0.9, 1);
                ellipse(ctx, px, s, x, y, r * 0.8, r * 0.8, GE[2], 0.25);
                ctx.globalAlpha = 0.9;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(px(x - r * 0.4), px(y - r * 0.45), s, s);
            }
        } });
        bubs.forEach((b) => sc.at(b.t0 + b.life, () => {
            const y = G - s - b.r - b.rise;
            ring(sc, b.x, y, b.r * 0.6, b.r * 2, 1, 0.2, ['#ffffff', GE[1]], 1);
            sparkles(b.x, y, s, ['#ffffff', GE[1]], 2, b.r, 6);
        }));
    }

    // ═════ 나무돌이 — 시저크로스 (ultbarrage) ═════
    // 몸을 낮추자 팔의 잎이 번뜩 → 초록 잔상을 남기며 상대를 지그재그로 휙휙 가로질러 X 자 베기 둘(가는 베기 선이 허공에 남음)
    // → 상대 뒤에서 등을 돌린 채 멈칫 … → 남은 X 자가 한꺼번에 번쩍 터지며 잎이 흩날림 → 폴짝 제자리 (약 5.6초)
    UNIQ.grovyle = { fx: 'ultbarrage', ms: (P) => 5600 + 200 * P, run: runGrovyleX };
    function runGrovyleX(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const VC = K.pal.VINE;
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * Math.min(W * 0.4, me.w * 5 + 40), W * 0.15, W * 0.85);
        const dd = Math.sign(tx - me.x) || dir;
        const ty = q ? q.y : G - me.h * 0.5;
        const R = Math.max(me.w * 1.3, 18 * s);
        const TC = 0.3;
        const TS0 = 1.1;
        const STEP = 0.28;
        // X 자 둘 — 대각선 넷 (끝 → 끝)
        const segs = [
            [[tx - R, ty - R * 0.8], [tx + R, ty + R * 0.6]],
            [[tx + R, ty - R * 0.8], [tx - R, ty + R * 0.6]],
            [[tx - R * 0.7, ty - R * 1.1], [tx + R * 0.7, ty + R * 0.3]],
            [[tx + R * 0.7, ty - R * 1.1], [tx - R * 0.7, ty + R * 0.3]],
        ];
        const TEND = TS0 + segs.length * STEP;
        const back = [clamp(tx + dd * me.w * 1.6, me.w * 0.5, W - me.w * 0.5), me.b];
        const TBURST = TEND + 0.6;
        const THOP = TBURST + 0.6;
        const THOME = THOP + 0.55;
        const footOf = (y) => Math.min(G, y + me.h * 0.5);
        const posAt = (t) => {
            if (t < TS0) {
                return [me.x, me.b];
            }
            if (t < TEND) {
                const i = Math.floor((t - TS0) / STEP);
                const k = clamp(((t - TS0) % STEP) / (STEP * 0.6), 0, 1);
                const [a, b] = segs[i];
                return [lerp(a[0], b[0], easeIn(k)), footOf(lerp(a[1], b[1], easeIn(k)))];
            }
            if (t < THOP) {
                return back;
            }
            const k = clamp((t - THOP) / (THOME - THOP), 0, 1);
            return [lerp(back[0], me.x, k), me.b - Math.sin(k * Math.PI) * me.h * 1.2];
        };
        const sc = scene(u, sec + 0.3, 'uniq grovyle');
        ultDark(0.36, ms - 200);
        // 허공에 남는 베기 선 — 그은 뒤 은은히, 터질 때 번쩍 굵게
        sc.add({ max: TBURST + 0.6, draw: (ctx, it, t, px) => {
            const life = sc.t;
            segs.forEach(([a, b], i) => {
                const t0 = TS0 + i * STEP;
                const k = clamp((life - t0) / (STEP * 0.6), 0, 1);
                if (k <= 0) {
                    return;
                }
                const burst = life > TBURST ? 1 - clamp((life - TBURST) / 0.5, 0, 1) : 0;
                const a0 = life > TBURST ? burst : 0.45 + 0.25 * Math.sin(life * 14 + i);
                const end = [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
                const w = life > TBURST ? 2 + Math.round(4 * burst) : 1;
                const p0 = new Path2D();
                const p1 = new Path2D();
                K.addLine(p0, px, s, [a, end], w + 2);
                K.addLine(p1, px, s, [a, end], w);
                K.fillPaths(ctx, [p0, p1], [VC[2], '#ffffff'], a0);
            });
        } });
        // 잔상 — 지나간 자리마다 옅은 초록 실루엣
        const img = pokemon.el;
        const ghost = (ctx, px, x, foot, al, left) => drawMon(ctx, img, x, foot, me.w, left, al, VC[1]);
        sc.add({ max: TEND + 0.4, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TS0) {
                return;
            }
            for (let j = 1; j <= 5; j++) {
                const tt = life - j * 0.04;
                if (tt < TS0 || tt > TEND) {
                    continue;
                }
                const [x, f] = posAt(tt);
                const i = Math.min(segs.length - 1, Math.floor((tt - TS0) / STEP));
                ghost(ctx, px, x, f, 0.5 * (1 - j / 6), segs[i][1][0] < segs[i][0][0]);
            }
        } });
        puppet(sc, pokemon, u, (t) => posAt(t)[1], VC[1], sec - 0.1, {
            x: (t) => posAt(t)[0],
            scale: (t) => (t > TS0 && t < TEND ? 0.95 : 1),
            rot: (t) => (t > TS0 && t < TEND ? dd * 0.25 : 0),
            glow: (t) => (t < TS0 ? clamp((t - TC) / 0.5, 0, 1) * 0.2 : t > TEND && t < TBURST ? 0.12 : 0),
            glowColor: VC[0],
        });
        // 팔의 잎 번뜩
        sc.at(TC + 0.4, () => {
            sparkles(me.x + dir * me.w * 0.3, me.b - me.h * 0.5, s, ['#ffffff', VC[0]], 6, me.w * 0.3, 10);
            ring(sc, me.x, me.b - me.h * 0.5, s * 2, me.w * 1.2, 0.8, 0.25, ['#ffffff', VC[1]], 1);
        });
        segs.forEach((sg, i) => sc.at(TS0 + i * STEP + STEP * 0.3, () => {
            ultShake(1.5 + i * 0.4, 90);
            fireBits(tx, ty, s, [VC[0], VC[1], '#ffffff'], 5, { speed: H * 0.3, life: 0.35 });
            if (q) {
                hit(where(u, q), Math.sign(sg[1][0] - sg[0][0]) || dd, 'shake', 0);
            }
        }));
        // 멈칫 … 번쩍 — X 자가 한꺼번에 터짐
        sc.at(TBURST, () => {
            impactFrames(sc, W, H, 0.6, 0.45);
            ultShake(6 + 2 * P, 500);
            ring(sc, tx, ty, R * 0.3, R * 2.4, 0.85, 0.45, ['#ffffff', VC[0], VC[1]], 3);
            if (q) {
                hit(where(u, q), dd, 'tumble', 0);
            }
            for (const r of u.others()) {
                if ((!q || r.pokemon !== q.pokemon) && Math.abs(r.x - tx) < R * 1.4) {
                    hit(r, Math.sign(r.x - tx) || dd, 'lift');
                }
            }
        });
        // 흩날리는 잎
        const NLV = 26;
        const lv = [];
        for (let i = 0; i < NLV; i++) {
            const a = (i / NLV) * TAU + hash(i, 71);
            lv.push({ a, sp: H * (0.25 + 0.35 * hash(i, 72)), ph: hash(i, 73) * TAU });
        }
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = life - TBURST;
            if (k <= 0) {
                return;
            }
            const a0 = clamp((sec - life) / 0.6, 0, 1);
            const list = [];
            for (const l of lv) {
                const d = l.sp * (1 - Math.exp(-k * 2.2)) * 0.6;
                const x = tx + Math.cos(l.a) * d + Math.sin(k * 4 + l.ph) * s * 3;
                const y = ty + Math.sin(l.a) * d * 0.7 + H * 0.12 * k * k;
                if (y < G) {
                    list.push({ x, y, len: Math.max(4 * s, me.w * 0.28), ang: k * 6 + l.ph });
                }
            }
            stLeaves(ctx, px, s, list, VC, a0);
        } });
    }

    // ═════ 아차모 — 불꽃세례 (ultorb) ═════
    // 콩콩 제자리 뛰기 — 뛸 때마다 부리에서 불씨 다섯이 포물선으로 상대에게 퐁퐁퐁(닿은 자리 작은 불) → 세 번째엔 크게
    // → 하늘에서 불꽃 깃털이 살랑살랑 내려와 닿는 곳마다 반짝 · 아차모 둘레엔 깃털이 빙글 (약 4.6초)
    UNIQ.torchic = { fx: 'ultorb', ms: (P) => 4600 + 200 * P, run: runTorchicEmber };
    function runTorchicEmber(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const F = ST_FIRE;
        const hops = [0.4, 1.0, 1.6];
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * Math.min(W * 0.35, me.w * 5 + 30), W * 0.08, W * 0.92);
        const TFEATH = 2.6;
        const beak = () => [u.mouth.x, u.mouth.y];
        const footAt = (t) => {
            for (const h of hops) {
                const k = (t - h + 0.15) / 0.3;
                if (k > 0 && k < 1) {
                    return me.b - Math.sin(k * Math.PI) * me.h * 0.5;
                }
            }
            return me.b;
        };
        const embers = [];
        hops.forEach((h, v) => {
            for (let i = 0; i < 5; i++) {
                embers.push({ t0: h + 0.05 + i * 0.03, fly: 0.55 + 0.1 * hash(v * 5 + i, 81), x1: tx + (i - 2) * me.w * (0.35 + 0.15 * v), up: H * (0.15 + 0.1 * hash(v * 5 + i, 82)), big: v === 2 });
            }
        });
        const sc = scene(u, sec + 0.3, 'uniq torchic');
        ultDark(0.3, ms - 200);
        puppet(sc, pokemon, u, footAt, F[2], sec - 0.1, { glow: (t) => 0.08 * (1 + Math.sin(t * 14)), glowColor: F[1] });
        sc.add({ max: TFEATH + 0.6, draw: (ctx, it, t, px) => {
            const life = sc.t;
            for (const e of embers) {
                const k = (life - e.t0) / e.fly;
                if (k < 0 || k >= 1) {
                    continue;
                }
                const [bx, by] = beak();
                const x = lerp(bx, e.x1, k);
                const y = lerp(by, G - s * 2, k) - 4 * e.up * k * (1 - k);
                const vx = e.x1 - bx;
                const vy = G - by - 4 * e.up * (1 - 2 * k);
                const L = Math.hypot(vx, vy) || 1;
                const r = Math.max(2 * s, me.w * (e.big ? 0.2 : 0.12));
                K.fireTail(ctx, px, s, x, y, vx / L, vy / L, r * 3, r * 2, F, life + e.x1);
            }
        } });
        // 닿은 자리 작은 불
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            for (const e of embers) {
                const k = (life - e.t0 - e.fly) / 0.8;
                if (k <= 0 || k >= 1) {
                    continue;
                }
                K.flameTongue(ctx, px, s, e.x1, G + s, me.w * (e.big ? 0.4 : 0.25), me.h * (e.big ? 0.8 : 0.5) * (1 - k * 0.5), F, life + e.x1, 1 - k);
            }
        } });
        hops.forEach((h, i) => sc.at(h, () => {
            const [bx, by] = beak();
            ring(sc, bx, by, s, me.w * (0.6 + i * 0.3), 0.9, 0.2, ['#ffffff', F[1]], 1);
            K.puff(me.x, G - s, s, '#8a7252', s, me.w * 0.4, 0.35, 0, -10, 0.35);
        }));
        embers.forEach((e, i) => sc.at(e.t0 + e.fly, () => {
            fireBits(e.x1, G - s * 2, s, F, e.big ? 6 : 3, { angle: -Math.PI / 2, spread: 1.4, speed: H * 0.3, life: 0.4 });
            if (i % 5 === 2) {
                ultShake(e.big ? 3 : 1.5, 120);
                for (const r of u.others()) {
                    if (Math.abs(r.x - e.x1) < me.w * 1.4) {
                        hit(r, Math.sign(r.x - me.x) || dir, e.big ? 'tumble' : 'shake');
                    }
                }
            }
        }));
        // 불꽃 깃털 — 하늘에서 살랑살랑
        const NF = Math.round(14 * clamp(W / 480, 0.7, 2));
        const fe = [];
        for (let i = 0; i < NF; i++) {
            fe.push({ x: hash(i, 91) * W, t0: TFEATH + hash(i, 92) * 1.0, sp: H * (0.18 + 0.1 * hash(i, 93)), ph: hash(i, 94) * TAU, len: Math.max(6 * s, me.w * (0.45 + 0.3 * hash(i, 95))) });
        }
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const fade = clamp((sec - life) / 0.5, 0, 1);
            const gt = gameTop();
            for (const f of fe) {
                const k = life - f.t0;
                if (k <= 0) {
                    continue;
                }
                // 게임 화면 = 위 끝 바로 밑에서 나타나 내려옴 (위 끝에 반쯤 걸쳐 천천히 내려오던 것 — #96 ④)
                const y = (gt > 0 ? gt + 4 * s + f.len * 0.5 + s : -f.len) + f.sp * k; // y = 깃털 가운데 (키 len)
                if (y > G) {
                    continue;
                }
                const sway = Math.sin(k * 2.6 + f.ph);
                stFeather(ctx, px, s, f.x + sway * f.len * 0.8, y, f.len, Math.PI / 2 + sway * 0.6, F, fade * clamp(k / 0.3, 0, 1));
            }
            // 아차모 둘레 깃털 셋
            const k2 = clamp((life - TFEATH) / 0.4, 0, 1) * fade;
            for (let j = 0; j < 3; j++) {
                const a = life * 3 * dir + (j * TAU) / 3;
                stFeather(ctx, px, s, me.x + Math.cos(a) * me.w * 0.8, me.b - me.h * 0.5 + Math.sin(a) * me.h * 0.3, Math.max(5 * s, me.w * 0.35), a + Math.PI / 2, F, k2);
            }
        } });
        sc.at(TFEATH, () => {
            ring(sc, me.x, me.b - me.h * 0.5, me.w * 0.3, me.w * 2, 0.85, 0.4, ['#ffffff', F[1], F[2]], 2);
            fireBits(me.x, me.b - me.h * 0.6, s, F, 16, { speed: H * 0.4, life: 0.6 });
            ultShake(2.5 + P, 250);
        });
        let glit = 0;
        sc.tick((t, dt) => {
            if (t < TFEATH + 0.5) {
                return;
            }
            glit += dt * 6;
            while (glit >= 1 && room(1)) {
                glit -= 1;
                sparkles(rnd(0.05, 0.95) * W, G - s * 2, s, [F[0], F[1]], 1, s * 2, 15);
            }
        });
        emberRise(sc, TFEATH, sec, F);
    }

    // ═════ 영치코 — 두번킥 (ultbarrage) ═════
    // 상대에게 달려들어 불꽃 발차기 하나(아래) · 둘(위, 불꽃 반달 자국) → 그대로 상대 위로 회전하며 솟아 불꽃 바퀴가 됨
    // → 불꽃 바퀴가 상대 위에서 활활 돌다가 아래로 쾅 터져 불길이 쏟아짐 → 착지 · 폴짝 제자리 (약 5.6초)
    UNIQ.combusken = { fx: 'ultbarrage', ms: (P) => 5600 + 200 * P, run: runCombuskenKick };
    function runCombuskenKick(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const F = ST_FIRE;
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * Math.min(W * 0.4, me.w * 5 + 40), W * 0.12, W * 0.88);
        const dd = Math.sign(tx - me.x) || dir;
        const ty = q ? q.y : G - me.h * 0.5;
        const ax = clamp(tx - dd * me.w * 0.9, me.w * 0.5, W - me.w * 0.5);
        const TRUN = 0.6;
        const TK1 = TRUN + 0.35;
        const TK2 = TK1 + 0.3;
        const TUP = TK2 + 0.15;
        const TWH = TUP + 0.45;
        const TBANG = TWH + 1.0;
        const TLAND = TBANG + 0.3;
        const THOME = TLAND + 0.6;
        const wy = Math.max(me.h * 1.5, ty - Math.max(me.h * 2.2, H * 0.28));
        const WR = Math.max(me.w * 1.1, 14 * s);
        const posAt = (t) => {
            if (t < TRUN) {
                return [me.x, me.b];
            }
            if (t < TK1) {
                return [lerp(me.x, ax, easeIn((t - TRUN) / (TK1 - TRUN))), me.b];
            }
            if (t < TK2) {
                return [ax, me.b - Math.sin(((t - TK1) / (TK2 - TK1)) * Math.PI) * me.h * 0.4];
            }
            if (t < TWH) {
                const k = easeOut((t - TK2) / (TWH - TK2));
                return [lerp(ax, tx, k), lerp(me.b, wy + me.h * 0.5, k)];
            }
            if (t < TBANG) {
                return [tx, wy + me.h * 0.5];
            }
            if (t < TLAND) {
                const k = (t - TBANG) / (TLAND - TBANG);
                return [tx, lerp(wy + me.h * 0.5, G, k * k)];
            }
            const k = clamp((t - TLAND - 0.1) / (THOME - TLAND - 0.1), 0, 1);
            return [lerp(tx, me.x, k), me.b - Math.sin(k * Math.PI) * me.h * 1.1];
        };
        let spin = 0;
        let lastT = 0;
        const sc = scene(u, sec + 0.3, 'uniq combusken');
        ultDark(0.34, ms - 200);
        sc.tick((t) => {
            spin += (t - lastT) * (t > TK2 && t < TBANG ? 22 : 0) * dd;
            lastT = t;
        });
        // 불꽃 바퀴 (영치코 뒤) — 둘레 불꽃 혀가 바퀴살처럼 돎 (무대보다 커서 위 끝을 넘는 윗부분만 위 끝 층 — #107)
        sc.split({ max: TBANG + 0.1, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TUP) {
                return;
            }
            const k = easeOut(clamp((life - TUP) / 0.4, 0, 1));
            const [x, f] = posAt(life);
            const y = f - me.h * 0.5;
            const n = 10;
            for (let i = 0; i < n; i++) {
                const a = spin + (i * TAU) / n;
                const rr = WR * k;
                K.fireTail(ctx, px, s, x + Math.cos(a) * rr, y + Math.sin(a) * rr, -Math.sin(a) * dd, Math.cos(a) * dd, WR * 0.9, Math.max(3 * s, WR * 0.4), F, life + i, k);
            }
            fireOrb(ctx, px, s, x, y, WR * 0.55 * k, F, life, 1, Infinity, 0.6, 0, [1, 0.75, 0.5, 0.3], 0.2);
        } });
        puppet(sc, pokemon, u, (t) => posAt(t)[1], F[2], sec - 0.1, {
            x: (t) => posAt(t)[0],
            rot: (t) => (t > TK2 && t < TBANG ? spin : t > TK1 && t < TK2 ? -dd * 0.5 : 0),
            scale: (t) => (t > TUP && t < TBANG ? 0.8 : 1),
            glow: (t) => (t > TRUN && t < TLAND ? 0.3 : 0.08),
            glowColor: F[1],
        });
        // 발차기 불꽃 반달 자국
        const arc = (ctx, px, x, y, R, a0, k, alpha) => {
            for (let i = 0; i <= 14; i++) {
                const f = i / 14;
                if (f > k) {
                    break;
                }
                const an = a0 - 1.2 * dd + 2.4 * dd * f;
                const th = Math.sin(f * Math.PI) * Math.max(2 * s, R * 0.18);
                for (let d = R - th; d < R; d += s) {
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = d > R - s * 1.2 ? F[0] : d > R - th * 0.5 ? F[1] : F[2];
                    ctx.fillRect(px(x + Math.cos(an) * d), px(y + Math.sin(an) * d), s, s);
                }
            }
        };
        [[TK1, 0.35], [TK2, -0.6]].forEach(([tk, a0]) => {
            sc.add({ max: sec, draw: (ctx, it, t, px) => {
                const k = (sc.t - tk + 0.05) / 0.35;
                if (k > 0 && k < 1) {
                    arc(ctx, px, ax, me.b - me.h * 0.5, Math.max(me.w, me.h) * 0.9, (dd > 0 ? 0 : Math.PI) + a0, Math.min(1, k * 3), 1 - k);
                }
            } });
            sc.at(tk, () => {
                ultShake(3, 140);
                fireBits(ax + dd * me.w * 0.6, me.b - me.h * 0.5, s, F, 12, { speed: H * 0.5, life: 0.5 });
                if (q) {
                    hit(where(u, q), dd, 'shake', 0);
                }
            });
        });
        sc.at(TUP, () => {
            if (q) {
                hit(where(u, q), dd, 'lift', 0);
            }
            ring(sc, ax, G - s, me.w * 0.4, me.w * 2, 0.25, 0.35, ['#ffffff', F[1]], 2);
        });
        // 아래로 쾅 — 불길이 쏟아짐
        sc.at(TBANG, () => {
            impactFrames(sc, W, H, 0.6, 0.4);
            ultShake(6 + 2 * P, 550);
            ring(sc, tx, wy, WR * 0.5, WR * 3, 0.85, 0.4, ['#ffffff', F[1], F[2]], 3);
            fireBits(tx, wy, s, F, 30, { angle: Math.PI / 2, spread: 1.6, speed: H * 0.9, g: H * 0.8, life: 0.8 });
            for (const r of u.others()) {
                if (Math.abs(r.x - tx) < WR * 2) {
                    hit(r, Math.sign(r.x - tx) || dd, 'tumble', 0);
                }
            }
        });
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = (life - TBANG) / 0.9;
            if (k <= 0 || k >= 1) {
                return;
            }
            const a = 1 - k;
            for (let j = 0; j < 7; j++) {
                const ang = Math.PI / 2 + (j - 3) * 0.22;
                const L = (G - wy) * Math.min(1, k * 3);
                K.fireTail(ctx, px, s, tx + Math.cos(ang) * L, wy + Math.sin(ang) * L, Math.cos(ang), Math.sin(ang), L, Math.max(3 * s, WR * 0.35), F, life + j, a * 0.9);
            }
            K.groundFlames(ctx, px, s, tx - WR * 2 * Math.min(1, k * 2), tx + WR * 2 * Math.min(1, k * 2), G, me.h * 0.6, life, F, a);
        } });
        sc.at(TLAND, () => {
            K.puff(tx, G - s, s, '#8a7252', s * 2, me.w * 0.8, 0.5, 0, -10, 0.4);
            ring(sc, tx, G - s, me.w * 0.5, me.w * 3, 0.22, 0.4, [F[1], F[2]], 2);
        });
        emberRise(sc, TBANG, sec, F);
    }

    // ═════ 물짱이 — 하이드로펌프 (ultbeam) ═════
    // 머리 지느러미가 반짝이며 레이더처럼 물결 고리를 쏴 상대를 찾음(상대에 과녁 표시) → 하늘로 굵은 물줄기를 뿜어 올림
    // → 물줄기가 상대 머리 위에서 쏟아져 내리는 소나기 기둥(밑에서 물보라 · 물웅덩이, 닿은 애 벌러덩) (약 4.6초)
    UNIQ.mudkip = { fx: 'ultbeam', ms: (P) => 4600 + 200 * P, run: runMudkipPump };
    function runMudkipPump(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TIDE = K.pal.TIDE;
        const fin = [me.x + dir * me.w * 0.05, me.b - me.h * 0.95];
        const TR = [0.25, 0.55, 0.85];
        const TLOCK = 1.15;
        const TUP = 1.45;
        const TDOWN = TUP + 0.55;
        const TEND = TDOWN + 1.6;
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * Math.min(W * 0.4, me.w * 5 + 40), W * 0.08, W * 0.92);
        const ty = q ? q.y : G - me.h * 0.5;
        const mx = u.mouth.x;
        const my = u.mouth.y;
        const jw = Math.max(me.w * 0.45, 6 * s);
        const cw = Math.max(me.w * 0.7, 9 * s);
        const sc = scene(u, sec + 0.3, 'uniq mudkip');
        ultDark(0.3, ms - 200);
        // 레이더 물결 — 지느러미에서 앞으로 퍼지는 반원
        TR.forEach((tr) => sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const k = (sc.t - tr) / 0.8;
            if (k <= 0 || k >= 1) {
                return;
            }
            const r = Math.abs(tx - fin[0]) * 1.1 * k + s * 3;
            ctx.globalAlpha = 1 - k;
            ctx.fillStyle = TIDE[1];
            for (let i = 0; i <= 20; i++) {
                const a = -0.9 + (i / 20) * 1.8;
                ctx.fillRect(px(fin[0] + dir * Math.cos(a) * r), px(fin[1] + Math.sin(a) * r * 0.6), 2 * s, s);
            }
        } }));
        // 과녁 표시
        sc.add({ max: TEND, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TLOCK) {
                return;
            }
            const k = clamp((life - TLOCK) / 0.2, 0, 1);
            const R = me.w * (1.6 - 0.6 * k);
            const a = k * clamp((TEND - life) / 0.3, 0, 1);
            K.ringDots(ctx, px, s, tx, ty, R, 1, ['#ffffff', TIDE[1]], a, 1);
            ctx.globalAlpha = a;
            ctx.fillStyle = '#ffffff';
            for (const [ux, uy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                ctx.fillRect(px(tx + ux * R * 1.25 - s), px(ty + uy * R * 1.25 - s), 2 * s, 2 * s);
            }
        } });
        puppet(sc, pokemon, u, (t) => me.b + (t > TUP && t < TDOWN ? s : 0), TIDE[2], sec - 0.1, {
            rot: (t) => (t > TUP - 0.1 && t < TDOWN + 0.6 ? -dir * 0.35 : 0),
            glow: (t) => (t < TLOCK ? 0.1 * (1 + Math.sin(t * 16)) : 0),
            glowColor: TIDE[1],
        });
        sc.add({ max: TLOCK + 0.1, draw: (ctx, it, t, px) => {
            glint(ctx, px, s, fin[0], fin[1], me.w * 0.35 * (1 + 0.3 * Math.sin(sc.t * 14)), 1);
        } });
        // 하늘로 뿜는 물줄기 — 입에서 위로 (화면 위까지), 다 쏘면 끝이 끊겨 올라감 (하늘까지 닿는 기둥 — 위 끝 층 · #107)
        sc.soft({ max: TEND, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TUP) {
                return;
            }
            const reach = easeOut(clamp((life - TUP) / 0.3, 0, 1)) * (my + 20);
            const cut = life > TEND - 0.5 ? (life - TEND + 0.5) / 0.5 * (my + 20) : 0;
            const len = reach - cut;
            if (len > s * 2) {
                K.fireTail(ctx, px, s, mx, my - cut - len, 0, -1, len, jw * (1 + 0.1 * Math.sin(life * 30)), TIDE, life, 1);
            }
        } });
        // 쏟아지는 소나기 기둥 — 위에서 상대 자리로 (하늘에서 내려오는 기둥 — 위 끝 층 · #107)
        sc.soft({ max: TEND + 0.5, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TDOWN) {
                return;
            }
            const k = easeIn(clamp((life - TDOWN) / 0.25, 0, 1));
            const end = G * k;
            const fade = clamp(1 - (life - TEND) / 0.5, 0, 1);
            const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
            for (let y = 0; y < end; y += s) {
                const wob = Math.sin(y * 0.09 + life * 20) * s;
                const w = cw * (0.8 + 0.2 * Math.sin(y * 0.05 - life * 15));
                paths[0].rect(px(tx - w + wob), px(y), Math.max(s, px(2 * w)), s);
                paths[1].rect(px(tx - w * 0.7 + wob), px(y), Math.max(s, px(1.4 * w)), s);
                paths[2].rect(px(tx - w * 0.35 - wob), px(y), Math.max(s, px(0.7 * w)), s);
                if ((Math.floor(y / s) - Math.floor(life * 60)) % 7 === 0) {
                    paths[3].rect(px(tx - w * 0.6 + wob), px(y), Math.max(s, px(1.2 * w)), s);
                }
            }
            K.fillPaths(ctx, paths, [TIDE[3], TIDE[2], TIDE[1], '#ffffff'], 0.9 * fade);
            if (k >= 1) {
                ellipse(ctx, px, s, tx, G, cw * 2.6, cw * 0.4, TIDE[2], 0.6 * fade);
                ellipse(ctx, px, s, tx, G, cw * 1.6, cw * 0.25, TIDE[1], 0.6 * fade);
            }
        } });
        let spray = 0;
        sc.tick((t, dt) => {
            if (t < TDOWN + 0.25 || t > TEND) {
                return;
            }
            spray += dt * 50;
            while (spray >= 1 && room(1)) {
                spray -= 1;
                K.splash(tx + rnd(-1, 1) * cw, G - s, s, TIDE, 1, H * 0.35, { spread: 2.2, life: 0.5 });
            }
        });
        TR.forEach((tr) => sc.at(tr, () => ultShake(0.8, 60)));
        sc.at(TLOCK, () => {
            sparkles(tx, ty, s, ['#ffffff', TIDE[1]], 6, me.w * 0.5, 10);
        });
        sc.at(TUP, () => {
            ring(sc, mx, my, s * 2, me.w * 1.2, 0.6, 0.25, ['#ffffff', TIDE[1]], 2);
            ultShake(3, 250);
        });
        sc.at(TDOWN + 0.25, () => {
            impactFrames(sc, W, H, 0.45, 0.3);
            ultShake(5 + 2 * P, 600);
            K.crownSplash(sc, tx, G, Math.max(cw * 1.6, me.w), 1.0, TIDE);
            for (const r of u.others()) {
                if (Math.abs(r.x - tx) < cw * 2.2) {
                    hit(r, Math.sign(r.x - tx) || dir, 'tumble');
                }
            }
        });
        [0.6, 1.1].forEach((d) => sc.at(TDOWN + 0.25 + d, () => ring(sc, tx, G - s, cw, cw * 4, 0.2, 0.6, [TIDE[1], TIDE[2]], 1)));
    }

    // ═════ 늪짱이 — 머드샷 (ultswarm) ═════
    // 진흙을 퍼 올려 진흙 덩이를 하나씩 포물선으로 퐁퐁 던짐(떨어진 자리마다 철퍽 · 진흙 자국) → 마지막 큰 덩이가 상대 앞에 철퍽
    // → 진흙 늪이 땅을 따라 넓게 번지며 보글보글 · 상대가 미끄러져 벌러덩(늪 위의 애도 휘청) (약 5.6초)
    UNIQ.marshtomp = { fx: 'ultswarm', ms: (P) => 5600 + 200 * P, run: runMarshMud };
    function runMarshMud(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * Math.min(W * 0.4, me.w * 5 + 40), W * 0.12, W * 0.88);
        const dd = Math.sign(tx - me.x) || dir;
        const throws = [0.4, 0.75, 1.1, 1.45, 1.9];
        const balls = throws.map((t0, i) => ({
            t0, fly: 0.6, big: i === throws.length - 1,
            x1: i === throws.length - 1 ? tx - dd * me.w * 0.3 : clamp(tx + (i - 1.5) * me.w * 1.1 + (hash(i, 101) - 0.5) * me.w, W * 0.05, W * 0.95),
        }));
        const TSW = throws[throws.length - 1] + 0.6 + 0.1; // 늪이 번짐
        const TSLIP = TSW + 0.7;
        const hand = [me.x + dir * me.w * 0.3, me.b - me.h * 0.75];
        const swampR = Math.max(W * 0.3, me.w * 3);
        const sc = scene(u, sec + 0.3, 'uniq marshtomp');
        ultDark(0.3, ms - 200);
        // 진흙 늪 (땅) — 번지며 보글보글
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = easeOut(clamp((life - TSW) / 0.8, 0, 1));
            const fade = clamp((sec - 0.1 - life) / 0.6, 0, 1);
            if (k > 0.01) {
                const R = swampR * k;
                ellipse(ctx, px, s, tx, G, R + 2 * s, R * 0.22 + s, ST_MUD[3], 0.9 * fade);
                ellipse(ctx, px, s, tx, G, R, R * 0.22, ST_MUD[2], 0.9 * fade);
                ellipse(ctx, px, s, tx - R * 0.15, G - R * 0.05, R * 0.6, R * 0.1, ST_MUD[1], 0.8 * fade);
                ellipse(ctx, px, s, tx - R * 0.3, G - R * 0.08, R * 0.2, R * 0.03, ST_MUD[0], 0.6 * fade);
                for (let j = 0; j < 10; j++) {
                    const cyc = (life * (0.8 + hash(j, 111) * 0.6) + hash(j, 112)) % 1;
                    const bx = tx + (hash(j, 113) - 0.5) * 1.6 * R;
                    const br = Math.max(s, me.w * 0.22 * cyc);
                    if (cyc < 0.9) {
                        K.ringDots(ctx, px, s, bx, G - br * 0.6, br, 0.8, [ST_MUD[0], ST_MUD[1]], 0.8 * fade, 1);
                    }
                }
            }
            // 철퍽 자국
            for (const b of balls) {
                const kk = (life - b.t0 - b.fly) / 0.3;
                if (kk <= 0) {
                    continue;
                }
                const r = me.w * (b.big ? 0.9 : 0.5) * easeOut(Math.min(1, kk));
                ellipse(ctx, px, s, b.x1, G, r, r * 0.22, ST_MUD[2], 0.9 * fade);
                ellipse(ctx, px, s, b.x1, G - s, r * 0.6, r * 0.12, ST_MUD[1], 0.9 * fade);
            }
        } });
        puppet(sc, pokemon, u, (t) => me.b - (throws.some((th) => t > th - 0.1 && t < th + 0.05) ? s * 2 : 0), ST_MUD[1], sec - 0.1, {
            rot: (t) => (throws.some((th) => t > th - 0.12 && t < th + 0.06) ? dir * 0.25 : 0),
            glow: () => 0,
        });
        // 날아가는 진흙 덩이
        sc.add({ max: TSW, draw: (ctx, it, t, px) => {
            const life = sc.t;
            for (const b of balls) {
                const k = (life - b.t0) / b.fly;
                if (k < 0 || k >= 1) {
                    continue;
                }
                const up = Math.min(H * 0.4, me.h * 3) * (b.big ? 1.2 : 1);
                const x = lerp(hand[0], b.x1, k);
                const y = lerp(hand[1], G - s * 3, k) - 4 * up * k * (1 - k);
                stMudBall(ctx, px, s, x, y, Math.max(2.5 * s, me.w * (b.big ? 0.32 : 0.18)) * (1 + 0.1 * Math.sin(life * 20)), 1);
            }
        } });
        balls.forEach((b, i) => {
            sc.at(b.t0 - 0.1, () => debris(hand[0], me.b - s, s, ST_MUD, 4, H * 0.2, { angle: -Math.PI / 2, spread: 1, ground: G - s, life: 0.4 }));
            sc.at(b.t0 + b.fly, () => {
                debris(b.x1, G - s, s, ST_MUD, b.big ? 18 : 9, H * (b.big ? 0.55 : 0.35), { angle: -Math.PI / 2, spread: 2.2, ground: G - s, life: 0.7 });
                ultShake(b.big ? 4 : 1.5, b.big ? 250 : 100);
                for (const r of u.others()) {
                    if (Math.abs(r.x - b.x1) < me.w * (b.big ? 1.4 : 0.8)) {
                        hit(r, Math.sign(r.x - b.x1) || dd, 'shake');
                    }
                }
            });
        });
        sc.at(TSW, () => {
            ring(sc, tx, G - s, me.w * 0.5, swampR, 0.18, 0.7, [ST_MUD[0], ST_MUD[1]], 2);
            ultShake(3, 400);
        });
        // 미끄러져 벌러덩 — 상대 · 늪 위의 애
        sc.at(TSLIP, () => {
            if (q) {
                hit(where(u, q), dd, 'tumble', 0);
                K.splash(q.x, G - s, s, ST_MUD, 14, H * 0.4, { spread: 2 });
                K.crownSplash(sc, q.x, G, Math.max(me.w * 0.9, 12 * s), 0.9, ST_MUD);
            }
            for (const r of u.others()) {
                if ((!q || r.pokemon !== q.pokemon) && Math.abs(r.x - tx) < swampR) {
                    hit(r, Math.sign(r.x - tx) || dd, Math.abs(r.x - tx) < swampR * 0.5 ? 'tumble' : 'shake');
                }
            }
            ultShake(3 + P, 300);
        });
        [0.5, 1.0, 1.5].forEach((d, i) => sc.at(TSW + d, () => {
            const x = tx + (i - 1) * swampR * 0.5;
            debris(x, G - s, s, ST_MUD, 5, H * 0.25, { angle: -Math.PI / 2, spread: 0.8, ground: G - s, life: 0.5 });
        }));
    }

    // 대(大) 자 불꽃 — (x, y) 가운데서 위 · 양옆 · 아래 두 다리로 뻗는 불꽃 다섯 갈래 (불대문자)
    function stDaiFlame(ctx, px, s, x, y, R, k, T, cols, alpha = 1) {
        if (k <= 0.02 || alpha <= 0.01) {
            return;
        }
        const arms = [[-Math.PI / 2, 0.55], [Math.PI, 0.95], [0, 0.95], [Math.PI * 0.68, 1.05], [Math.PI * 0.32, 1.05]];
        for (const [a, L0] of arms) {
            const L = R * L0 * k;
            K.fireTail(ctx, px, s, x + Math.cos(a) * L, y + Math.sin(a) * L, Math.cos(a), Math.sin(a), L, Math.max(3 * s, R * 0.34), cols, T + a, alpha);
        }
        fireOrb(ctx, px, s, x, y, Math.max(3 * s, R * 0.3 * k), cols, T, 1, Infinity, alpha, 0, [1, 0.78, 0.55, 0.3], 0.3);
    }
    // 풀 융단 — 땅 위 x0 ~ x1 에 풀 띠 · 삐죽 풀잎(살랑) · 작은 꽃 (k 로 펼쳐진 정도는 부르는 쪽이 x 로)
    function stGrassCarpet(ctx, px, s, x0, x1, G, h, T, cols, alpha = 1) {
        if (x1 - x0 < s || alpha <= 0.01) {
            return;
        }
        const PINK = K.pal.PINK;
        const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D()];
        for (let x = Math.floor(x0 / s) * s; x < x1; x += s) {
            const c = Math.round(x / s);
            paths[0].rect(px(x), px(G - s * 2), s, s * 3);
            paths[1].rect(px(x), px(G - s * 2), s, s);
            const bh = h * (0.35 + 0.65 * hash(c, 121));
            {
                const sway = Math.round(Math.sin(T * 4 + c * 0.4) * 0.6);
                paths[c % 4 === 0 ? 2 : 1].rect(px(x + sway * s), px(G - s * 2 - bh), s, Math.max(s, px(bh)));
            }
            if (hash(c, 122) > 0.93) {
                paths[hash(c, 123) > 0.5 ? 3 : 4].rect(px(x - s), px(G - s * 3 - bh), 2 * s, 2 * s);
            }
        }
        K.fillPaths(ctx, paths, [cols[3], cols[2], cols[1], PINK[2], '#fff3a0'], alpha);
    }

    // ═════ 모부기 — 씨폭탄 (ultswarm) ═════
    // 머리의 새싹이 부르르 떨며 씨앗을 하나씩 퐁퐁 쏘아 올림(잎 달린 씨앗 폭탄이 포물선으로 땅을 따라 차례로) → 떨어진 자리마다 펑(흙 · 잎)
    // → 모부기 발밑부터 폭탄 자리를 지나 풀 융단이 쭉 펼쳐지며 꽃이 송송 (약 4.6초)
    UNIQ.turtwig = { fx: 'ultswarm', ms: (P) => 4600 + 200 * P, run: runTurtwigSeed };
    function runTurtwigSeed(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const VC = K.pal.VINE;
        const DIRT = ['#d1b178', '#a88a55', '#6b5536'];
        const sprout = [me.x + dir * me.w * 0.15, me.b - me.h * 0.95];
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * Math.min(W * 0.4, me.w * 5 + 40), W * 0.1, W * 0.9);
        const dd = Math.sign(tx - me.x) || dir;
        const NS = 6;
        const seeds = [];
        for (let i = 0; i < NS; i++) {
            const f = (i + 1) / NS;
            seeds.push({ t0: 0.45 + i * 0.22, fly: 0.55, x1: clamp(me.x + (tx + dd * me.w * 0.8 - me.x) * f, W * 0.04, W * 0.96) });
        }
        const TCARP = seeds[NS - 1].t0 + seeds[NS - 1].fly + 0.15;
        const far = clamp(tx + dd * Math.max(W * 0.18, me.w * 2), 0, W);
        const sc = scene(u, sec + 0.3, 'uniq turtwig');
        ultDark(0.3, ms - 200);
        // 풀 융단 — 모부기 발밑부터 쭉 (모부기 뒤)
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = easeOut(clamp((life - TCARP) / 0.9, 0, 1));
            if (k <= 0) {
                return;
            }
            const a = clamp((sec - 0.1 - life) / 0.6, 0, 1);
            const x0 = dd > 0 ? me.x - me.w * 0.5 : me.x + me.w * 0.5;
            const x1 = lerp(x0, far, k);
            stGrassCarpet(ctx, px, s, Math.min(x0, x1), Math.max(x0, x1), G, Math.max(me.h * 0.5, 6 * s), life, VC, a);
            // 말린 융단 끝 — 둥근 두루마리가 굴러감
            if (k < 1) {
                const r = Math.max(me.h * 0.22, 3 * s);
                ellipse(ctx, px, s, x1, G - r, r, r, VC[3], a);
                ellipse(ctx, px, s, x1, G - r, r * 0.7, r * 0.7, VC[2], a);
                K.ringDots(ctx, px, s, x1, G - r, r * 0.4, 1, [VC[1], VC[0]], a, 1);
            }
        } });
        puppet(sc, pokemon, u, (t) => me.b - (seeds.some((sd) => t > sd.t0 - 0.06 && t < sd.t0 + 0.04) ? s : 0), VC[2], sec - 0.1, { glow: (t) => (t < TCARP ? 0.08 * (1 + Math.sin(t * 22)) : 0.15), glowColor: VC[0] });
        // 새싹 떨림
        sc.add({ max: TCARP, draw: (ctx, it, t, px) => {
            const life = sc.t;
            glint(ctx, px, s, sprout[0] + Math.sin(life * 60) * s * 0.6, sprout[1], me.w * 0.25 * clamp(life / 0.3, 0, 1), 0.7);
        } });
        // 씨앗 폭탄 — 둥근 씨앗 + 위에 떡잎
        sc.add({ max: TCARP, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const r = Math.max(2.5 * s, me.w * 0.14);
            for (const sd of seeds) {
                const k = (life - sd.t0) / sd.fly;
                if (k < 0 || k >= 1) {
                    continue;
                }
                const up = Math.min(H * 0.35, me.h * 2.5);
                const x = lerp(sprout[0], sd.x1, k);
                const y = lerp(sprout[1], G - r, k) - 4 * up * k * (1 - k);
                ellipse(ctx, px, s, x, y, r + s, r + s, VC[3], 1);
                ellipse(ctx, px, s, x, y, r, r, '#8a6a3a', 1);
                ellipse(ctx, px, s, x - r * 0.3, y - r * 0.3, r * 0.35, r * 0.3, '#c9a868', 1);
                stLeaves(ctx, px, s, [{ x: x + r * 0.4, y: y - r * 1.2, len: r * 1.6, ang: -0.6 + Math.sin(life * 20) * 0.3 }], VC, 1);
            }
        } });
        seeds.forEach((sd, i) => {
            sc.at(sd.t0, () => {
                ring(sc, sprout[0], sprout[1], s, me.w * 0.6, 0.8, 0.2, ['#ffffff', VC[1]], 1);
            });
            sc.at(sd.t0 + sd.fly, () => {
                ring(sc, sd.x1, G - s, me.w * 0.3, me.w * 1.6, 0.25, 0.35, ['#ffffff', VC[1], VC[2]], 2);
                debris(sd.x1, G - s, s, DIRT, 10, H * 0.45, { angle: -Math.PI / 2, spread: 1.8, ground: G - s, life: 0.7 });
                fireBits(sd.x1, G - s * 3, s, [VC[0], VC[1], '#ffffff'], 8, { angle: -Math.PI / 2, spread: 1.6, speed: H * 0.45, g: H * 0.8, life: 0.6 });
                K.puff(sd.x1, G - s * 3, s, '#a88a55', s * 2, me.w * 0.6, 0.6, 0, -15, 0.35);
                ultShake(2 + (i === NS - 1 ? 2 : 0), 140);
                for (const r of u.others()) {
                    if (Math.abs(r.x - sd.x1) < me.w * 1.1) {
                        hit(r, dd, i === NS - 1 || (q && r.pokemon === q.pokemon) ? 'tumble' : 'lift');
                    }
                }
            });
        });
        sc.at(TCARP, () => {
            ultShake(2, 300);
            sparkles(me.x, G - s * 2, s, [VC[0], VC[1]], 8, me.w * 0.5, 15);
        });
        let glit = 0;
        sc.tick((t, dt) => {
            if (t < TCARP + 0.3) {
                return;
            }
            glit += dt * 10;
            while (glit >= 1 && room(1)) {
                glit -= 1;
                const x = lerp(me.x, far, Math.random());
                sparkles(x, G - s * 3, s, ['#ffffff', VC[0], K.pal.PINK[1]], 1, s * 2, 18);
            }
        });
    }

    // ═════ 수풀부기 — 기가드레인 (ultbloom) ═════
    // 등의 덤불이 초록빛으로 두근 → 상대(와 둘레 애들)에게서 초록 빛 알갱이가 곡선을 그리며 줄줄이 빨려 나와 등 덤불로
    // (빨릴 때 상대가 하얗게 깜빡 · 휘청) → 등의 덤불이 쑥쑥 크게 자라며 반짝 · 초록 + 기호가 보글보글 떠오름 (약 5.6초)
    UNIQ.grotle = { fx: 'ultbloom', ms: (P) => 5600 + 200 * P, run: runGrotleDrain };
    function runGrotleDrain(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const VC = K.pal.VINE;
        const HEAL = ['#ffffff', '#d8ffc8', '#7fe07a', '#2f8a3a'];
        const bush = [me.x - dir * me.w * 0.12, me.b - me.h * 0.8];
        const TD = 0.6;
        const TDE = 3.2;
        const TGROW = TDE + 0.1;
        const q = nearest(u);
        const srcs = u.others().filter((r) => Math.abs(r.x - me.x) < W * 0.55).slice(0, 3);
        if (!srcs.length) {
            srcs.push({ x: clamp(me.x + dir * W * 0.35, W * 0.1, W * 0.9), y: G - me.h * 0.5, w: me.w, pokemon: null });
        }
        const srcPos = (r) => {
            if (r.pokemon) {
                const b = r.pokemon.el.getBoundingClientRect();
                if (b.width > 0) {
                    return [b.left + b.width / 2, b.top + b.height * 0.5];
                }
            }
            return [r.x, r.y];
        };
        const sc = scene(u, sec + 0.3, 'uniq grotle');
        ultDark(0.32, ms - 200);
        // 빨려 나오는 빛 알갱이 줄 — 소스마다 곡선 위를 흘러 등 덤불로
        sc.add({ max: TDE + 0.5, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TD) {
                return;
            }
            const a0 = clamp((life - TD) / 0.3, 0, 1) * clamp((TDE + 0.4 - life) / 0.4, 0, 1);
            srcs.forEach((r, si) => {
                const [sx, sy] = srcPos(r);
                const cx = (sx + bush[0]) / 2;
                const cy = Math.min(sy, bush[1]) - Math.max(me.h * 1.5, Math.abs(sx - bush[0]) * 0.35) * (si % 2 ? 0.7 : 1);
                for (let j = 0; j < 22; j++) {
                    const f = (j / 22 + life * 0.9 + si * 0.21) % 1;
                    const x = (1 - f) * (1 - f) * sx + 2 * (1 - f) * f * cx + f * f * bush[0];
                    const y = (1 - f) * (1 - f) * sy + 2 * (1 - f) * f * cy + f * f * bush[1];
                    const z = (j % 3 === 0 ? 3 : 2) * s;
                    ctx.globalAlpha = a0 * (0.5 + 0.5 * Math.sin(f * Math.PI));
                    ctx.fillStyle = HEAL[j % 3 === 0 ? 0 : 2];
                    ctx.fillRect(px(x - z / 2), px(y - z / 2), z, z);
                }
                // 빨리는 애 둘레 초록 빛
                K.ringDots(ctx, px, s, sx, sy, me.w * (0.6 + 0.15 * Math.sin(life * 10 + si)), 0.8, [HEAL[2], HEAL[1]], a0 * 0.8, 1);
            });
        } });
        // 등 덤불 — 쑥쑥 자람 (잎 뭉치)
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const pulse = life < TGROW ? 1 + 0.06 * Math.sin(life * 12) * clamp((life - TD) / 0.5, 0, 1) : 1;
            const g = 1 + 0.9 * easeOut(clamp((life - TGROW) / 0.8, 0, 1)) * clamp((sec - 0.2 - life) / 0.6, 0, 1);
            const k = clamp(life / 0.4, 0, 1) * clamp((sec - 0.1 - life) / 0.4, 0, 1);
            const R = Math.max(me.w * 0.32, 4 * s) * g * pulse;
            const list = [];
            for (let j = 0; j < 9; j++) {
                const a = -Math.PI / 2 + (j - 4) * 0.36 + Math.sin(life * 3 + j) * 0.05;
                list.push({ x: bush[0] + Math.cos(a) * R * 0.75, y: bush[1] + R * 0.3 + Math.sin(a) * R * 0.75, len: R * 0.95, ang: a });
            }
            stLeaves(ctx, px, s, list, VC, k * (g > 1.02 ? 1 : 0.85));
            if (life > TGROW) {
                glint(ctx, px, s, bush[0], bush[1] - R * 0.2, R * (0.8 + 0.3 * Math.sin(life * 7)), clamp((life - TGROW) / 0.3, 0, 1) * k);
            }
        } });
        puppet(sc, pokemon, u, () => me.b, VC[2], sec - 0.1, { glow: (t) => (t > TD && t < TDE ? 0.15 + 0.1 * Math.sin(t * 9) : t > TGROW ? 0.25 * clamp((sec - 0.3 - t) / 0.8, 0, 1) : 0), glowColor: HEAL[1] });
        // 빨리는 애 — 하얗게 깜빡 · 휘청
        [TD + 0.3, TD + 1.1, TD + 1.9].forEach((tt) => sc.at(tt, () => {
            for (const r of srcs) {
                if (r.pokemon) {
                    hit(r, Math.sign(r.x - me.x) || dir, 'shake', 0);
                    const [sx, sy] = srcPos(r);
                    sparkles(sx, sy, s, [HEAL[0], HEAL[2]], 4, me.w * 0.4, 10);
                }
            }
        }));
        sc.at(TDE - 0.3, () => {
            for (const r of srcs) {
                if (r.pokemon) {
                    hit(r, Math.sign(r.x - me.x) || dir, 'tumble', 0);
                }
            }
        });
        sc.at(TGROW, () => {
            ring(sc, bush[0], bush[1], me.w * 0.3, me.w * 2.4, 0.8, 0.5, [HEAL[0], HEAL[2]], 2);
            ultShake(3 + P, 300);
            sparkles(bush[0], bush[1], s, [HEAL[0], HEAL[1], HEAL[2]], 14, me.w * 0.8, 25);
        });
        // + 기호가 보글보글
        const plus = [];
        for (let i = 0; i < 10; i++) {
            plus.push({ x: me.x + (hash(i, 131) - 0.5) * me.w * 2.2, t0: TGROW + 0.1 + hash(i, 132) * 1.4, z: hash(i, 133) < 0.4 ? 2 : 1 });
        }
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            for (const p of plus) {
                const k = (life - p.t0) / 1.0;
                if (k < 0 || k >= 1) {
                    continue;
                }
                const x = p.x + Math.sin(life * 4 + p.x) * s * 2;
                const y = me.b - me.h * 0.4 - k * Math.max(me.h * 2, H * 0.2);
                const z = s * p.z;
                ctx.globalAlpha = Math.min(1, (1 - k) * 2);
                ctx.fillStyle = HEAL[3];
                ctx.fillRect(px(x - z * 2), px(y - z), z * 5, z * 3);
                ctx.fillRect(px(x - z), px(y - z * 2), z * 3, z * 5);
                ctx.fillStyle = HEAL[1];
                ctx.fillRect(px(x - z * 1.5), px(y - z * 0.5), z * 4, z * 2);
                ctx.fillRect(px(x - z * 0.5), px(y - z * 1.5), z * 2, z * 4);
            }
        } });
    }

    // ═════ 불꽃숭이 — 불대문자 (ultorb) ═════
    // 제자리 공중제비 두 번(꼬리 불꽃이 동그라미를 그림) → 두 손 위로 불덩이를 크게 키워 휙 던짐
    // → 날아간 불덩이가 상대 앞에서 거대한 '大' 자 불꽃으로 활짝 · 활활 타다가 펑 (약 4.6초)
    UNIQ.chimchar = { fx: 'ultorb', ms: (P) => 4600 + 200 * P, run: runChimcharBlast };
    function runChimcharBlast(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const F = ST_FIRE;
        const TF0 = 0.2;
        const TF1 = 1.2;
        const TBALL = TF1;
        const TTHROW = TBALL + 0.6;
        const TOPEN = TTHROW + 0.45;
        const TBANG = TOPEN + 1.1;
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * Math.min(W * 0.4, me.w * 5 + 40), W * 0.15, W * 0.85);
        const DR = clamp(Math.max(me.h * 1.6, H * 0.22), 16 * s, Math.min(H * 0.38, W * 0.22));
        const ty = Math.max(DR * 1.1, G - DR * 1.15, gameTop() > 0 ? gameTop() + DR * 0.8 + 4 * s : 0); // 大 자 위 팔 머리 ≈ ty − 0.75 DR (위 끝에 반쯤 걸쳐 머물던 것 — #96 디자인 4바퀴 · ult-top 걸쳐 머묾)
        // 불덩이 가운데 ≥ 연출 위 끝 + 가장 큰 반지름 + 6칸 (붉은 테 · 꼬리) — 손 위에서 키우는 자리도 · 날아가는 길은 높이를 줄여 꼭대기가 그 선에 닿게 (187 에서 던진 불덩이가 정보줄 뒤로 숨던 것 — #105 ·
        // 길만 자르면 던지는 순간 25px 튀고 일자로 날던 것, 코드 리뷰어)
        const top0 = gameTop();
        const ballTop = top0 > 0 ? top0 + Math.max(me.w * 0.35, 5 * s) * 1.6 + 6 * s : -Infinity;
        const hold = [me.x, Math.max(ballTop, me.b - me.h * 1.35)];
        const footAt = (t) => (t > TF0 && t < TF1 ? me.b - Math.sin(((t - TF0) / (TF1 - TF0)) * Math.PI * 2 % Math.PI) * me.h * 0.8 : me.b);
        const rotAt = (t) => (t > TF0 && t < TF1 ? -dir * TAU * 2 * easeOut((t - TF0) / (TF1 - TF0)) : 0);
        const ballAt = (t) => {
            if (t < TTHROW) {
                return hold;
            }
            const k = clamp((t - TTHROW) / (TOPEN - TTHROW), 0, 1);
            const amp = clamp((hold[1] + ty) / 2 - ballTop, 0, me.h);
            return [lerp(hold[0], tx, k), lerp(hold[1], ty, k) - Math.sin(k * Math.PI) * amp];
        };
        const sc = scene(u, sec + 0.3, 'uniq chimchar');
        ultDark(0.34, ms - 200);
        // 공중제비 — 꼬리 불꽃이 그리는 동그라미 (자국)
        sc.add({ max: TF1 + 0.4, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TF0) {
                return;
            }
            const a = clamp(1 - (life - TF1) / 0.4, 0, 1);
            const k = clamp((life - TF0) / (TF1 - TF0), 0, 1);
            const n = Math.round(30 * k);
            for (let i = 0; i < n; i++) {
                const an = (i / 30) * TAU * 2;
                const r = me.h * 0.7;
                ctx.globalAlpha = a * (0.4 + 0.6 * (i / Math.max(1, n)));
                ctx.fillStyle = i % 3 ? F[2] : F[1];
                ctx.fillRect(px(me.x + Math.cos(an) * r * -dir), px(me.b - me.h * 0.9 + Math.sin(an) * r), 2 * s, 2 * s);
            }
        } });
        puppet(sc, pokemon, u, footAt, F[2], sec - 0.1, { rot: rotAt, glow: (t) => (t > TBALL && t < TTHROW ? 0.3 : 0.08 * (1 + Math.sin(t * 14))), glowColor: F[1] });
        // 불덩이 — 두 손 위에서 커져 날아감
        sc.add({ max: TOPEN + 0.05, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TBALL) {
                return;
            }
            const k = easeOut(clamp((life - TBALL) / 0.5, 0, 1));
            const [x, y] = ballAt(life);
            const R = Math.max(me.w * 0.35, 5 * s) * k * (life > TTHROW ? 1 + 0.6 * clamp((life - TTHROW) / 0.45, 0, 1) : 1);
            if (life > TTHROW) {
                const [x0, y0] = ballAt(life - 0.06);
                const L = Math.hypot(x - x0, y - y0) || 1;
                K.fireTail(ctx, px, s, x, y, (x - x0) / L, (y - y0) / L, R * 3, R * 2, F, life, 0.9);
            }
            fireOrb(ctx, px, s, x, y, R, F, life, 1, G, 1, 0, [1, 0.8, 0.6, 0.38], 0.5);
            jointOrb(o, ctx, x, y, R, life <= TTHROW, life > TTHROW);
        } });
        // 大 자 불꽃
        sc.add({ max: TBANG + 0.3, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TOPEN) {
                return;
            }
            const k = easeOut(clamp((life - TOPEN) / 0.3, 0, 1)) * (1 + 0.05 * Math.sin(life * 20));
            const fade = life > TBANG ? clamp(1 - (life - TBANG) / 0.3, 0, 1) : 1;
            stDaiFlame(ctx, px, s, tx, ty, DR, k, life, F, fade);
        } });
        sc.at(TBALL, () => {
            ring(sc, hold[0], hold[1], s * 2, me.w * 1.2, 0.8, 0.3, ['#ffffff', F[1]], 2);
            fireBits(hold[0], hold[1], s, F, 10, { speed: H * 0.35, life: 0.5 });
        });
        sc.at(TTHROW, () => ultShake(2, 120));
        sc.at(TOPEN, () => {
            jointOrb(o);
            impactFrames(sc, W, H, 0.45, 0.3);
            ultShake(4 + P, 400);
            ring(sc, tx, ty, DR * 0.3, DR * 1.6, 0.9, 0.4, ['#ffffff', F[1], F[2]], 2);
            for (const r of u.others()) {
                if (Math.abs(r.x - tx) < DR * 1.1) {
                    hit(r, Math.sign(r.x - tx) || dir, 'lift', 0);
                }
            }
        });
        sc.at(TBANG, () => {
            ultShake(6 + 2 * P, 500);
            ring(sc, tx, ty, DR * 0.5, DR * 2.6, 0.85, 0.45, ['#ffffff', F[1], F[2]], 3);
            fireBits(tx, ty, s, F, 36, { speed: H * 0.9, g: H * 0.6, life: 0.9 });
            for (const r of u.others()) {
                if (Math.abs(r.x - tx) < DR * 1.4) {
                    hit(r, Math.sign(r.x - tx) || dir, 'tumble', 0);
                }
            }
        });
        emberRise(sc, TOPEN, sec, F);
    }

    // ═════ 파이숭이 — 마하펀치 (ultbarrage) ═════
    // 몸을 낮추고 주먹에 불 · 바닥을 차는 순간 사라져 상대 옆에 나타나 주먹이 닿음 → 0.2초 모든 게 멈춤(하양 · 검정 정지 화면)
    // → 쾅 — 한 박자 늦게 충격파 고리 셋이 퍼지며 상대가 날아가고, 맞은 자리에 불꽃 별 자국이 남음 → 휙 제자리 (약 5.6초)
    UNIQ.monferno = { fx: 'ultbarrage', ms: (P) => 5600 + 200 * P, run: runMonfernoMach };
    function runMonfernoMach(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const F = ST_FIRE;
        const TC = 0.3;
        const TGO = 1.5;
        const TP = TGO + 0.08; // 주먹이 닿음
        const TFREEZE = 0.25;
        const TBOOM = TP + TFREEZE;
        const TBACK = TBOOM + 1.2;
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * Math.min(W * 0.4, me.w * 5 + 40), W * 0.12, W * 0.88);
        const dd = Math.sign(tx - me.x) || dir;
        const ty = q ? q.y : G - me.h * 0.5;
        const ax = clamp(tx - dd * me.w * 0.75, me.w * 0.5, W - me.w * 0.5);
        const xAt = (t) => (t < TGO ? me.x : t < TBACK ? ax : lerp(ax, me.x, easeOut(clamp((t - TBACK) / 0.35, 0, 1))));
        const fist = () => [ax + dd * me.w * 0.45, me.b - me.h * 0.55];
        const sc = scene(u, sec + 0.3, 'uniq monferno');
        ultDark(0.36, ms - 200);
        // 정지 화면 — 맞는 순간 화면을 가로지르는 집중선 (멈춘 동안)
        sc.add({ max: TBOOM + 0.05, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TP || life > TBOOM) {
                return;
            }
            const [fx, fy] = fist();
            ctx.globalAlpha = 0.85;
            ctx.fillStyle = '#ffffff';
            for (let j = 0; j < 28; j++) {
                const a = (j / 28) * TAU + hash(j, 141) * 0.2;
                const r0 = me.w * (1.2 + hash(j, 142));
                const r1 = Math.max(W, H);
                for (let d = r0; d < r1; d += s * 3) {
                    ctx.fillRect(px(fx + Math.cos(a) * d), px(fy + Math.sin(a) * d), s, s);
                }
            }
            K.ringDots(ctx, px, s, fx, fy, me.w * 0.6, 1, ['#ffffff', F[1]], 1, 2);
        } });
        // 불꽃 별 자국 — 맞은 자리 (공중 → 서서히 사그라듦)
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = (life - TBOOM) / 0.3;
            if (k <= 0) {
                return;
            }
            const [fx, fy] = fist();
            const a = clamp((sec - 0.2 - life) / 0.8, 0, 1);
            const R = Math.max(me.w * 1.1, 14 * s) * (1 + 0.08 * Math.sin(life * 9));
            starOutline(ctx, px, s, fx, fy, R, life * 0.6, Math.min(1, k), F, 1);
            if (k > 1) {
                fireOrb(ctx, px, s, fx, fy, R * 0.35 * a, F, life, 1, Infinity, a, 0, [1, 0.78, 0.55, 0.3], 0.3);
            }
        } });
        puppet(sc, pokemon, u, () => me.b, F[2], sec - 0.1, {
            x: xAt,
            scale: (t) => (t < TGO && t > TC ? 1 - 0.08 * clamp((t - TC) / 0.6, 0, 1) : 1),
            rot: (t) => (t > TP && t < TBACK ? dd * 0.18 : 0),
            glow: (t) => (t > TC && t < TGO ? clamp((t - TC) / 0.6, 0, 1) * 0.35 : t > TP && t < TBOOM ? 0.9 : 0.06),
            glowColor: F[1],
        });
        // 주먹 불꽃
        sc.add({ max: TBACK, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TC) {
                return;
            }
            const k = clamp((life - TC) / 0.4, 0, 1);
            const x = xAt(life) + dir * me.w * 0.42 * (life < TGO ? 1 : dd * dir);
            K.flameTongue(ctx, px, s, x, me.b - me.h * 0.4, me.w * 0.4, me.h * 0.8, F, life, k);
        } });
        // 사라졌다 나타나는 잔상 줄
        sc.add({ max: TGO + 0.4, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = (life - TGO) / 0.4;
            if (k < 0 || k >= 1) {
                return;
            }
            const y = me.b - me.h * 0.5;
            for (let j = 0; j < 5; j++) {
                ctx.globalAlpha = (1 - k) * 0.8;
                ctx.fillStyle = j % 2 ? F[1] : '#ffffff';
                ctx.fillRect(px(Math.min(me.x, ax)), px(y + (j - 2) * me.h * 0.18), Math.abs(ax - me.x), s);
            }
        } });
        sc.at(TC, () => {
            K.puff(me.x - dir * me.w * 0.3, G - s, s, '#8a7252', s * 2, me.w * 0.5, 0.4, -dir * 20, -10, 0.4);
        });
        sc.at(TGO, () => {
            K.puff(me.x, G - s, s, '#8a7252', s * 2, me.w * 0.8, 0.4, 0, -10, 0.5);
            ultShake(1.5, 80);
        });
        // 멈춤 — 효과 입자도 잠깐 멈춤 (흔들림 없음), 그 뒤 쾅
        sc.at(TP, () => {
            impactFrames(sc, W, H, 0.7, 0.5);
            if (q) {
                hit(where(u, q), dd, 'shake', 0);
            }
        });
        sc.at(TBOOM, () => {
            const [fx, fy] = fist();
            ultShake(8 + 2 * P, 500);
            for (let i = 0; i < 3; i++) {
                sc.at(TBOOM + i * 0.1, () => ring(sc, fx, fy, me.w * 0.4, me.w * (2.4 + i * 1.2), 0.85, 0.45, ['#ffffff', F[1], F[2]], 3 - i));
            }
            fireBits(fx, fy, s, F, 34, { speed: H * 0.9, life: 0.8 });
            if (q) {
                hit(where(u, q), dd, 'tumble', 0);
            }
            for (const r of u.others()) {
                if ((!q || r.pokemon !== q.pokemon) && Math.abs(r.x - fx) < me.w * 3) {
                    hit(r, Math.sign(r.x - fx) || dd, 'lift');
                }
            }
        });
        sc.at(TBACK, () => K.puff(ax, G - s, s, '#8a7252', s * 2, me.w * 0.6, 0.4, 0, -10, 0.4));
    }

    // ═════ 팽도리 — 거품광선 (ultswarm) ═════
    // 볼을 부풀려 거품을 뽀글뽀글 잔뜩 뿜음(크고 작은 거품이 둥실둥실 상대 쪽으로) → 거품이 상대 둘레에 모여 거품 덩이가 되어 상대를 둥실 띄움
    // → 거품이 차례로 톡톡톡 연달아 터지다 마지막 큰 거품이 펑 — 상대가 툭 떨어짐 (약 4.6초)
    UNIQ.piplup = { fx: 'ultswarm', ms: (P) => 4600 + 200 * P, run: runPiplupBubble };
    function runPiplupBubble(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TIDE = K.pal.TIDE;
        const TBL = 0.3;
        const TBLE = 1.7;
        const TLIFT = 2.0;
        const TPOP = TLIFT + 1.0;
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * Math.min(W * 0.4, me.w * 5 + 40), W * 0.1, W * 0.9);
        const tyAt = (t) => {
            if (q) {
                const r = q.pokemon.el.getBoundingClientRect();
                if (r.width > 0) {
                    return r.top + r.height * 0.5;
                }
            }
            return G - me.h * 0.6 - (t > TLIFT ? Math.min(H * 0.25, me.h * 2) * easeOut(clamp((t - TLIFT) / 0.5, 0, 1)) : 0);
        };
        const mx = u.mouth.x;
        const my = u.mouth.y;
        const NB = 26;
        const bubs = [];
        for (let i = 0; i < NB; i++) {
            const a = hash(i, 151) * TAU;
            bubs.push({ t0: TBL + (i / NB) * (TBLE - TBL), fly: 0.7 + 0.3 * hash(i, 152), r: Math.max(2 * s, me.w * (0.1 + 0.14 * hash(i, 153))), a, d: 0.55 + 0.45 * hash(i, 154), pop: TPOP + (i / NB) * 0.7 + hash(i, 155) * 0.1, ph: hash(i, 156) * TAU });
        }
        const big = { r: Math.max(me.w * 0.85, 12 * s), pop: TPOP + 0.85 };
        const sc = scene(u, sec + 0.3, 'uniq piplup');
        ultDark(0.28, ms - 200);
        const bubble = (ctx, px, x, y, r, a) => {
            ellipse(ctx, px, s, x, y, r, r, TIDE[2], 0.18 * a);
            K.ringDots(ctx, px, s, x, y, r, 1, [TIDE[1], TIDE[0]], 0.9 * a, 1);
            ctx.globalAlpha = 0.95 * a;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(px(x - r * 0.45), px(y - r * 0.5), s, s);
            if (r > 4 * s) {
                ctx.fillRect(px(x - r * 0.3), px(y - r * 0.62), s, s);
            }
        };
        puppet(sc, pokemon, u, () => me.b, TIDE[2], sec - 0.1, {
            scale: (t) => (t > TBL && t < TBLE ? 1 + 0.04 * Math.sin(t * 30) : 1),
            glow: () => 0,
        });
        // 거품 (상대를 감싼 큰 거품이 위 끝을 넘는 부분만 위 끝 층 — #107)
        sc.split({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const ty = tyAt(life);
            // 큰 거품 (상대를 감쌈)
            if (life > TLIFT - 0.3 && life < big.pop) {
                const k = easeOut(clamp((life - TLIFT + 0.3) / 0.4, 0, 1));
                bubble(ctx, px, tx, ty, big.r * k * (1 + 0.04 * Math.sin(life * 8)), k);
            }
            for (const b of bubs) {
                const k = (life - b.t0) / b.fly;
                if (k < 0 || life >= b.pop) {
                    continue;
                }
                let x;
                let y;
                if (k < 1) {
                    const e = easeOut(k);
                    x = lerp(mx, tx + Math.cos(b.a) * big.r * b.d, e) + Math.sin(life * 6 + b.ph) * s * 3 * (1 - k);
                    y = lerp(my, ty + Math.sin(b.a) * big.r * b.d * 0.9, e) - Math.sin(k * Math.PI) * me.h * 0.6;
                } else {
                    x = tx + Math.cos(b.a + (life - b.t0 - b.fly) * 1.2) * big.r * b.d;
                    y = ty + Math.sin(b.a + (life - b.t0 - b.fly) * 1.2) * big.r * b.d * 0.9;
                }
                bubble(ctx, px, x, y, b.r * (0.5 + 0.5 * Math.min(1, k * 2)), 1);
            }
        } });
        sc.at(TLIFT, () => {
            if (q) {
                hit(where(u, q), dir, 'lift', 0);
            }
            ring(sc, tx, G - s, me.w * 0.4, me.w * 2, 0.25, 0.4, [TIDE[1], '#ffffff'], 1);
        });
        bubs.forEach((b, i) => sc.at(b.pop, () => {
            const ty = tyAt(b.pop);
            const x = tx + Math.cos(b.a + (b.pop - b.t0 - b.fly) * 1.2) * big.r * b.d;
            const y = ty + Math.sin(b.a + (b.pop - b.t0 - b.fly) * 1.2) * big.r * b.d * 0.9;
            ring(sc, x, y, b.r * 0.6, b.r * 2, 1, 0.18, ['#ffffff', TIDE[1]], 1);
            K.splash(x, y, s, [TIDE[0], TIDE[1]], 3, H * 0.2, { spread: TAU, life: 0.4 });
            if (i % 4 === 0) {
                ultShake(1, 60);
            }
        }));
        sc.at(big.pop, () => {
            const ty = tyAt(big.pop);
            impactFrames(sc, W, H, 0.35, 0.2);
            ultShake(4 + P, 350);
            ring(sc, tx, ty, big.r * 0.6, big.r * 2.8, 1, 0.4, ['#ffffff', TIDE[1], TIDE[2]], 2);
            K.splash(tx, ty, s, TIDE, 30, H * 0.5, { spread: TAU, life: 0.8 });
            sparkles(tx, ty, s, ['#ffffff', TIDE[1]], 10, big.r, 15);
            for (const r of u.others()) {
                if ((!q || r.pokemon !== q.pokemon) && Math.abs(r.x - tx) < big.r * 2) {
                    hit(r, Math.sign(r.x - tx) || dir, 'shake');
                }
            }
        });
    }

    // ═════ 팽태자 — 메탈클로 (ultbarrage) ═════
    // 은빛 발톱이 번뜩 · 은빛 물보라를 두르고 팽이처럼 돌며 상대를 향해 미끄러져 가로지름(은빛 베기 자국 셋)
    // → 상대 둘레로 은빛 물 칼날 고리가 퍼져 나가며 번쩍 · 물방울이 반짝이며 떨어짐 → 미끄러져 제자리 (약 5.6초)
    UNIQ.prinplup = { fx: 'ultbarrage', ms: (P) => 5600 + 200 * P, run: runPrinplupClaw };
    function runPrinplupClaw(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TIDE = K.pal.TIDE;
        const SIL = ['#ffffff', '#e8f2ff', '#a9bcd6', '#4f6a8f'];
        const TC = 0.3;
        const TSP = 1.1;
        const TGO = 1.6;
        const TTHRU = TGO + 0.6;
        const TRING = TTHRU + 0.2;
        const TBACK = TRING + 1.3;
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * Math.min(W * 0.4, me.w * 5 + 40), W * 0.12, W * 0.88);
        const dd = Math.sign(tx - me.x) || dir;
        const ty = q ? q.y : G - me.h * 0.5;
        const past = clamp(tx + dd * me.w * 1.4, me.w * 0.5, W - me.w * 0.5);
        const xAt = (t) => (t < TGO ? me.x : t < TTHRU ? lerp(me.x, past, easeIn((t - TGO) / (TTHRU - TGO))) : t < TBACK ? past : lerp(past, me.x, easeOut(clamp((t - TBACK) / 0.6, 0, 1))));
        let spin = 0;
        let lastT = 0;
        const sc = scene(u, sec + 0.3, 'uniq prinplup');
        ultDark(0.34, ms - 200);
        sc.tick((t) => {
            spin += (t - lastT) * (t > TSP && t < TTHRU + 0.3 ? 24 * clamp((t - TSP) / 0.4, 0, 1) : 0) * dd;
            lastT = t;
        });
        // 은빛 물보라 두르기 (몸 뒤)
        sc.add({ max: TTHRU + 0.4, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TSP) {
                return;
            }
            const k = clamp((life - TSP) / 0.3, 0, 1) * clamp(1 - (life - TTHRU) / 0.4, 0, 1);
            const x = xAt(life);
            const y = me.b - me.h * 0.5;
            K.swirlRing(ctx, px, s, x, y, me.w * 0.75, 0.45, life * 1.5, dd, [SIL[0], TIDE[1]], k);
            K.swirlRing(ctx, px, s, x, y - me.h * 0.2, me.w * 0.6, 0.45, life * 1.8, dd, [SIL[1], SIL[2]], k);
            K.swirlRing(ctx, px, s, x, y + me.h * 0.25, me.w * 0.85, 0.4, life * 1.3, dd, [TIDE[1], SIL[2]], k);
        } });
        puppet(sc, pokemon, u, () => me.b, SIL[2], sec - 0.1, {
            x: xAt,
            rot: (t) => (t > TSP && t < TTHRU + 0.3 ? Math.sin(spin) * 0.3 : 0),
            glow: (t) => (t > TC && t < TSP ? clamp((t - TC) / 0.4, 0, 1) * 0.3 : t > TSP && t < TTHRU ? 0.25 : 0),
            glowColor: SIL[1],
        });
        // 은빛 베기 자국 셋 — 지나가며
        const slash = (ctx, px, x, y, R, ang, k, alpha) => {
            for (let i = 0; i <= 14; i++) {
                const f = i / 14;
                if (f > k) {
                    break;
                }
                const an = ang - 1 + 2 * f;
                const th = Math.sin(f * Math.PI) * Math.max(3 * s, R * 0.2);
                for (let d = R - th; d < R; d += s) {
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = d > R - s * 1.2 ? '#ffffff' : d > R - th * 0.5 ? SIL[1] : d > R - th * 0.8 ? SIL[2] : TIDE[2];
                    ctx.fillRect(px(x + Math.cos(an) * d), px(y + Math.sin(an) * d), s, s);
                }
            }
        };
        [-0.5, 0.1, 0.7].forEach((a0, i) => {
            const t0 = TGO + 0.3 + i * 0.07;
            sc.add({ max: sec, draw: (ctx, it, t, px) => {
                const k = (sc.t - t0) / 0.3;
                if (k > 0 && k < 1) {
                    slash(ctx, px, tx, ty, Math.max(me.w, me.h) * (0.8 + i * 0.15), (dd > 0 ? 0 : Math.PI) + a0, Math.min(1, k * 3), 1 - k);
                }
            } });
            sc.at(t0, () => {
                ultShake(2, 90);
                fireBits(tx, ty, s, SIL, 6, { speed: H * 0.4, life: 0.4 });
                if (q) {
                    hit(where(u, q), dd, i === 2 ? 'tumble' : 'shake', 0);
                }
            });
        });
        // 은빛 물 칼날 고리 — 상대 둘레로 퍼짐
        const NBL = 10;
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = (life - TRING) / 0.9;
            if (k <= 0 || k >= 1) {
                return;
            }
            const R = Math.max(me.w * 0.8, 10 * s) + W * 0.35 * easeOut(k);
            const a = 1 - k * k;
            for (let i = 0; i < NBL; i++) {
                const an = (i / NBL) * TAU + k * 1.5 * dd;
                const cx = tx + Math.cos(an) * R;
                const cy = ty + Math.sin(an) * R * 0.45;
                slash(ctx, px, cx - Math.cos(an) * me.w * 0.8, cy - Math.sin(an) * me.w * 0.4, Math.max(me.w * 0.9, 12 * s), an, 1, a);
            }
            K.ringDots(ctx, px, s, tx, ty, R * 0.95, 0.45, [SIL[0], TIDE[1]], a * 0.7, 1);
        } });
        sc.at(TC, () => {
            sparkles(me.x + dir * me.w * 0.35, me.b - me.h * 0.45, s, ['#ffffff', SIL[1]], 6, me.w * 0.3, 8);
            ring(sc, me.x + dir * me.w * 0.35, me.b - me.h * 0.45, s, me.w * 0.9, 0.9, 0.25, ['#ffffff', SIL[2]], 1);
        });
        sc.at(TRING, () => {
            impactFrames(sc, W, H, 0.5, 0.35);
            ultShake(5 + 2 * P, 500);
            for (const r of u.others()) {
                if ((!q || r.pokemon !== q.pokemon) && Math.abs(r.x - tx) < W * 0.35) {
                    hit(r, Math.sign(r.x - tx) || dd, 'tumble');
                }
            }
        });
        // 반짝이며 떨어지는 물방울
        let drip = 0;
        sc.tick((t, dt) => {
            if (t < TRING + 0.3 || t > sec - 0.4) {
                return;
            }
            drip += dt * 16;
            while (drip >= 1 && room(1)) {
                drip -= 1;
                const x = tx + rnd(-1, 1) * W * 0.35;
                K.splash(x, rnd(0.1, 0.5) * G, s, [SIL[0], TIDE[1], SIL[1]], 1, H * 0.1, { angle: Math.PI / 2, spread: 0.4, life: 1 });
                if (Math.random() < 0.3) {
                    sparkles(x, rnd(0.2, 0.8) * G, s, [SIL[0], TIDE[1]], 1, s * 2, -10);
                }
            }
        });
    }

    // 가리비 칼 (수댕이 · 쌍검자비) — (x, y) 가운데, 반지름 r, spin 으로 납작해지며 돎 (크림색 · 골)
    const ST_SHELLC = ['#ffffff', '#fff2c8', '#e0c27a', '#8a6a34'];
    function stScalchop(ctx, px, s, x, y, r, spin, alpha = 1) {
        const sq = Math.max(0.25, Math.abs(Math.cos(spin)));
        ellipse(ctx, px, s, x, y, r * sq + s, r * 0.85 + s, ST_SHELLC[3], alpha);
        ellipse(ctx, px, s, x, y, r * sq, r * 0.85, ST_SHELLC[2], alpha);
        ellipse(ctx, px, s, x, y - r * 0.1, r * sq * 0.7, r * 0.6, ST_SHELLC[1], alpha);
        const path = new Path2D();
        for (let j = -2; j <= 2; j++) {
            for (let d = 0; d < r * 0.75; d += s) {
                path.rect(px(x + j * r * 0.18 * sq * (d / (r * 0.75))), px(y + r * 0.6 - d), s, s);
            }
        }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = ST_SHELLC[3];
        ctx.fill(path);
    }

    // ═════ 주리비얀 — 그래스믹서 (ultvortex) ═════
    // 꼬리를 휘휘 돌리자 상대 발밑에 낮고 넓은 잎 회오리(겹겹이 도는 잎 고리)가 생겨 점점 조여 들며 빙글 → 잎이 하늘로 풀려 올라가
    // 긴 잎 리본 여러 줄로 너울너울 · 주리비얀은 새침하게 고개를 홱 돌리며 반짝 (약 4.6초)
    UNIQ.snivy = { fx: 'ultvortex', ms: (P) => 4600 + 200 * P, run: runSnivyMixer };
    function runSnivyMixer(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const VC = K.pal.VINE;
        const TW = 0.4;
        const TTIGHT = 1.8;
        const TREL = 2.6;
        const TSASS = TREL + 0.3;
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * Math.min(W * 0.4, me.w * 5 + 40), W * 0.12, W * 0.88);
        const R0 = Math.max(me.w * 1.8, W * 0.14);
        const NLF = 36;
        const lf = [];
        for (let i = 0; i < NLF; i++) {
            lf.push({ ring: i % 4, ph: hash(i, 161) * TAU, t0: TW + hash(i, 162) * 0.6 });
        }
        const sc = scene(u, sec + 0.3, 'uniq snivy');
        ultDark(0.3, ms - 200);
        // 잎 회오리 — 땅 가까이 납작한 고리 넷, 조여 들고 마지막에 위로 풀림
        const drawRing = (front) => (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TW || life > TREL + 0.6) {
                return;
            }
            const tight = 1 - 0.45 * easeIn(clamp((life - TTIGHT + 0.6) / 0.6, 0, 1));
            const rel = clamp((life - TREL) / 0.6, 0, 1);
            const list = [];
            for (const l of lf) {
                const k = clamp((life - l.t0) / 0.3, 0, 1);
                if (k <= 0) {
                    continue;
                }
                const a = l.ph + life * (5 + l.ring) * dir;
                if ((Math.sin(a) > 0) !== front) {
                    continue;
                }
                const R = R0 * (0.45 + 0.18 * l.ring) * tight * (1 + rel * 0.5);
                const y = G - s * 2 - l.ring * me.h * 0.28 - rel * H * 0.5 * (0.5 + l.ring * 0.2);
                list.push({ x: tx + Math.cos(a) * R * k, y: y + Math.sin(a) * R * 0.18, len: Math.max(4 * s, me.w * 0.3), ang: a + Math.PI / 2 * dir });
            }
            stLeaves(ctx, px, s, list, VC, (front ? 1 : 0.6) * (1 - rel));
        };
        sc.add({ max: sec, draw: drawRing(false) });
        // 바람 줄 — 회오리를 감는 하얀 선
        sc.add({ max: TREL + 0.3, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - TW) / 0.4, 0, 1) * clamp(1 - (life - TREL) / 0.3, 0, 1);
            if (k <= 0.01) {
                return;
            }
            const tight = 1 - 0.45 * easeIn(clamp((life - TTIGHT + 0.6) / 0.6, 0, 1));
            for (let j = 0; j < 3; j++) {
                K.swirlRing(ctx, px, s, tx, G - s * 2 - j * me.h * 0.35, R0 * (0.5 + j * 0.2) * tight, 0.18, life * (1.5 + j * 0.3), dir, ['#ffffff', VC[0]], 0.5 * k);
            }
        } });
        // 주리비얀 — 꼬리 휘휘, 끝에 새침하게 고개를 홱
        puppet(sc, pokemon, u, () => me.b, VC[2], sec - 0.1, {
            rot: (t) => (t < TREL ? Math.sin(t * 10) * 0.08 : 0),
            scale: (t) => (t > TSASS ? 0.001 : 1),
            glow: () => 0.06,
            glowColor: '#ffffff',
        });
        sc.add({ max: sec, draw: drawRing(true) });
        // 고개를 홱 — 원래 보던 쪽 반대로 (그림을 뒤집어 한 번 더 그림)
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TSASS || life > sec - 0.12) {
                return;
            }
            drawLitMon(ctx, pokemon.el, me.x, me.b, me.w, dir > 0, VC[2], Math.max(1, Math.round(u.s * 0.75)), 1, -dir * 0.12);
            const k = (life - TSASS) / 0.4;
            if (k < 1) {
                glint(ctx, px, s, me.x - dir * me.w * 0.25, me.b - me.h * 0.8, me.w * 0.5 * Math.sin(k * Math.PI), 1);
            }
        } });
        // 잎 리본 — 풀려 올라간 잎이 긴 리본 다섯 줄로 너울너울
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = (life - TREL) / (sec - TREL);
            if (k <= 0) {
                return;
            }
            const a = clamp(k * 4, 0, 1) * clamp((sec - 0.1 - life) / 0.5, 0, 1);
            for (let j = 0; j < 5; j++) {
                const list = [];
                const x0 = tx + (j - 2) * R0 * 0.35;
                const top = G - H * (0.25 + 0.5 * easeOut(clamp(k * 1.6, 0, 1))) * (0.8 + 0.2 * hash(j, 171));
                for (let i = 0; i < 10; i++) {
                    const f = i / 9;
                    const y = lerp(G - me.h * 0.6, top, f);
                    const x = x0 + Math.sin(f * 5 + life * 4 + j) * R0 * 0.18 * f;
                    list.push({ x, y, len: Math.max(4 * s, me.w * 0.3), ang: -Math.PI / 2 + Math.cos(f * 5 + life * 4 + j) * 0.8 });
                }
                stLeaves(ctx, px, s, list, VC, a * (j % 2 ? 0.85 : 1));
            }
        } });
        sc.at(TW, () => {
            ring(sc, tx, G - s, me.w * 0.3, R0, 0.2, 0.4, ['#ffffff', VC[1]], 2);
            if (q) {
                hit(where(u, q), dir, 'spin', 0);
            }
        });
        sc.at(TTIGHT, () => {
            ultShake(3 + P, 300);
            for (const r of u.others()) {
                if (Math.abs(r.x - tx) < R0) {
                    hit(r, Math.sign(r.x - tx) || dir, 'spin');
                }
            }
        });
        sc.at(TREL, () => {
            impactFrames(sc, W, H, 0.4, 0.25);
            ring(sc, tx, G - me.h, R0 * 0.3, R0 * 1.6, 0.5, 0.45, ['#ffffff', VC[0], VC[1]], 2);
            ultShake(3, 250);
            if (q) {
                hit(where(u, q), dir, 'tumble', 0);
            }
        });
        sc.at(TSASS, () => sparkles(me.x, me.b - me.h * 0.8, s, ['#ffffff', VC[0]], 8, me.w * 0.4, 12));
    }

    // ═════ 샤비 — 리프블레이드 (ultbarrage) ═════
    // 몸을 둥글게 말자 둘레에 잎 칼날이 돋아 둥근 톱날로 윙윙 → 땅을 긁으며 화면을 가로질러 상대를 베고 지나감(지나간 자리에 밝은 초록 줄)
    // → 화면 끝에서 멈춰 펼침 · 초록 줄이 번쩍 빛나며 천천히 사라짐(줄 위의 애 벌러덩) → 폴짝폴짝 제자리 (약 5.6초)
    UNIQ.servine = { fx: 'ultbarrage', ms: (P) => 5600 + 200 * P, run: runServineSaw };
    function runServineSaw(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const VC = K.pal.VINE;
        const q = nearest(u);
        const dd = q ? Math.sign(q.x - me.x) || dir : dir;
        const end = clamp(me.x + dd * W, me.w * 0.6, W - me.w * 0.6);
        const R = Math.max(me.w * 0.55, 7 * s);
        const TCURL = 0.3;
        const TGO = 1.3;
        const TSTOP = TGO + 0.75;
        const TFLASH = TSTOP + 0.35;
        const TBACK = TFLASH + 1.0;
        const THOME = TBACK + 0.8;
        const xAt = (t) => (t < TGO ? me.x : t < TSTOP ? lerp(me.x, end, easeIn((t - TGO) / (TSTOP - TGO))) : t < TBACK ? end : lerp(end, me.x, clamp((t - TBACK) / (THOME - TBACK), 0, 1)));
        const footAt = (t) => (t > TBACK && t < THOME ? me.b - Math.abs(Math.sin(((t - TBACK) / (THOME - TBACK)) * Math.PI * 2)) * me.h * 0.5 : me.b);
        const saw = (t) => t > TCURL + 0.15 && t < TSTOP + 0.1;
        let spin = 0;
        let lastT = 0;
        const sc = scene(u, sec + 0.3, 'uniq servine');
        ultDark(0.36, ms - 200);
        sc.tick((t) => {
            spin += (t - lastT) * (saw(t) ? 26 : 0) * dd;
            lastT = t;
        });
        // 땅에 남는 초록 줄 — 지나가며 그어지고, 멈추면 번쩍 · 천천히 사라짐
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TGO) {
                return;
            }
            const x = xAt(Math.min(life, TSTOP));
            const flash = life > TFLASH ? Math.max(0, 1 - (life - TFLASH) / 0.25) : 0;
            const a = life > TFLASH ? clamp(1 - (life - TFLASH) / 1.6, 0, 1) : 1;
            const th = (2 + Math.round(flash * 4)) * s;
            const y = G - R * 0.9;
            ctx.globalAlpha = a;
            ctx.fillStyle = VC[3];
            ctx.fillRect(px(Math.min(me.x, x)), px(y - th / 2 - s), Math.abs(x - me.x), th + 2 * s);
            ctx.fillStyle = flash > 0 ? '#ffffff' : VC[1];
            ctx.fillRect(px(Math.min(me.x, x)), px(y - th / 2), Math.abs(x - me.x), th);
            ctx.fillStyle = VC[0];
            ctx.fillRect(px(Math.min(me.x, x)), px(y - s * 0.5), Math.abs(x - me.x), s);
        } });
        // 둥근 톱날 — 잎 칼날 여덟이 둘레에서 돎
        sc.add({ max: TSTOP + 0.15, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (!saw(life)) {
                return;
            }
            const k = clamp((life - TCURL - 0.15) / 0.25, 0, 1);
            const x = xAt(life);
            const y = G - R;
            const list = [];
            for (let i = 0; i < 8; i++) {
                const a = spin + (i * TAU) / 8;
                list.push({ x: x + Math.cos(a) * R * 1.15 * k, y: y + Math.sin(a) * R * 1.15 * k, len: R * 0.9, ang: a + Math.PI / 2 * dd });
            }
            stLeaves(ctx, px, s, list, VC, k);
            K.ringDots(ctx, px, s, x, y, R * 0.95, 1, ['#ffffff', VC[1]], 0.6 * k, 1);
        } });
        puppet(sc, pokemon, u, (t) => (saw(t) ? G - R + me.h * 0.3 : footAt(t)), VC[2], sec - 0.1, {
            x: xAt,
            rot: (t) => (saw(t) ? spin : 0),
            scale: (t) => (saw(t) ? 0.7 : 1),
            glow: (t) => (saw(t) ? 0.25 : t > TFLASH && t < TFLASH + 0.3 ? 0.4 : 0.05),
            glowColor: VC[0],
        });
        // 긁히는 땅 불티 · 잎
        let grind = 0;
        sc.tick((t, dt) => {
            if (t < TGO || t > TSTOP) {
                return;
            }
            grind += dt * 50;
            while (grind >= 1 && room(1)) {
                grind -= 1;
                const x = xAt(t);
                fireBits(x - dd * R * 0.5, G - s * 2, s, ['#ffffff', VC[0], VC[1]], 1, { angle: dd > 0 ? -Math.PI * 0.85 : -Math.PI * 0.15, spread: 0.6, speed: H * 0.5, g: H, life: 0.4 });
            }
            for (const r of u.others()) {
                if (Math.abs(r.x - xAt(t)) < R * 1.2) {
                    hit(r, dd, 'shake');
                }
            }
        });
        sc.at(TCURL, () => {
            ring(sc, me.x, G - R, s * 2, me.w * 1.4, 0.8, 0.3, ['#ffffff', VC[1]], 2);
            sparkles(me.x, G - R, s, ['#ffffff', VC[0]], 6, me.w * 0.4, 10);
        });
        sc.at(TGO, () => {
            K.puff(me.x - dd * me.w * 0.4, G - s, s, '#8a7252', s * 2, me.w * 0.6, 0.4, -dd * 30, -10, 0.45);
            ultShake(2, 150);
        });
        sc.at(TFLASH, () => {
            impactFrames(sc, W, H, 0.5, 0.35);
            ultShake(5 + 2 * P, 450);
            for (const r of u.others()) {
                if (Math.sign(r.x - me.x) === dd && Math.abs(r.x - me.x) <= Math.abs(end - me.x) + R) {
                    hit(r, dd, 'tumble', 0);
                    fireBits(r.x, G - R, s, [VC[0], VC[1], '#ffffff'], 10, { speed: H * 0.5, life: 0.5 });
                }
            }
        });
        let leafy = 0;
        sc.tick((t, dt) => {
            if (t < TFLASH || t > TFLASH + 1.2) {
                return;
            }
            leafy += dt * 20;
            while (leafy >= 1 && room(1)) {
                leafy -= 1;
                const x = lerp(me.x, end, Math.random());
                sparkles(x, G - R, s, ['#ffffff', VC[0], VC[1]], 1, s * 2, 25);
            }
        });
    }

    // ═════ 뚜꾸리 — 회오리불꽃 (ultvortex) ═════
    // 콧구멍에서 연기를 푹푹 → 입김처럼 불을 뿜자 불길이 상대 둘레를 빙빙 감아 불의 고리 소용돌이에 가둠(고리가 겹겹이 돎)
    // → 고리가 꽉 조여 들며 번쩍 — 펑 하고 커다란 잿빛 연기 구름이 피어오르고 상대가 콜록이며 벌러덩 (약 4.6초)
    UNIQ.tepig = { fx: 'ultvortex', ms: (P) => 4600 + 200 * P, run: runTepigSpin };
    function runTepigSpin(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const F = ST_FIRE;
        const mx = u.mouth.x;
        const my = u.mouth.y;
        const TSN = [0.25, 0.55, 0.85];
        const TBR = 1.1;
        const TWRAP = TBR + 0.5;
        const TTIGHT = TWRAP + 1.2;
        const TPOOF = TTIGHT + 0.35;
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * Math.min(W * 0.35, me.w * 5 + 30), W * 0.1, W * 0.9);
        const ty = q ? q.y : G - me.h * 0.5;
        const RR = Math.max(me.w * 1.1, 14 * s);
        const sc = scene(u, sec + 0.3, 'uniq tepig');
        ultDark(0.33, ms - 200);
        // 불의 고리 소용돌이 — 뒤쪽 반 / 앞쪽 반
        const rings = (front) => (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TWRAP - 0.2 || life > TPOOF + 0.05) {
                return;
            }
            const grow = easeOut(clamp((life - TWRAP + 0.2) / 0.4, 0, 1));
            const tight = 1 - 0.55 * easeIn(clamp((life - TTIGHT + 0.5) / 0.5, 0, 1));
            for (let j = 0; j < 4; j++) {
                const yy = ty + (j - 1.5) * me.h * 0.35;
                const R = RR * (1 - Math.abs(j - 1.5) * 0.12) * tight * grow;
                const n = 12;
                for (let i = 0; i < n; i++) {
                    const a = (i / n) * TAU + life * (7 + j) * (j % 2 ? -dir : dir);
                    if ((Math.sin(a) > 0) !== front) {
                        continue;
                    }
                    const x = tx + Math.cos(a) * R;
                    const y = yy + Math.sin(a) * R * 0.28;
                    const ux = -Math.sin(a) * (j % 2 ? -dir : dir);
                    K.fireTail(ctx, px, s, x, y, ux, 0, R * 0.7, Math.max(2 * s, R * 0.22), F, life + i + j, front ? 1 : 0.7);
                }
            }
        };
        sc.add({ max: sec, draw: rings(false) });
        puppet(sc, pokemon, u, (t) => me.b - (TSN.some((ts) => t > ts - 0.05 && t < ts + 0.05) ? s : 0), F[2], sec - 0.1, { glow: (t) => (t > TBR && t < TWRAP + 0.3 ? 0.3 : 0.06), glowColor: F[1] });
        sc.add({ max: sec, draw: rings(true) });
        // 입에서 뿜는 불길 — 상대에게 닿아 감기기 시작
        sc.add({ max: TWRAP + 0.4, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = (life - TBR) / (TWRAP + 0.3 - TBR);
            if (k <= 0 || k >= 1) {
                return;
            }
            const reach = easeOut(Math.min(1, k * 1.8));
            const cut = Math.max(0, (k - 0.6) / 0.4);
            const L = Math.abs(tx - mx) * reach;
            const ux = Math.sign(tx - mx) || dir;
            const uy = (ty - my) / Math.max(1, Math.abs(tx - mx));
            const n = Math.hypot(1, uy);
            K.fireTail(ctx, px, s, mx + ux * L, my + uy * L, ux / n, uy / n, L * (1 - cut), Math.max(me.h * 0.5, 6 * s), F, life, 1 - cut);
        } });
        TSN.forEach((ts) => sc.at(ts, () => {
            K.puff(mx, my, s, '#6e6470', s, me.w * 0.3, 0.6, dir * 25, -15, 0.55);
            K.puff(mx, my + s * 2, s, '#6e6470', s, me.w * 0.25, 0.5, dir * 15, -25, 0.45);
            fireBits(mx, my, s, F, 3, { angle: dir > 0 ? 0 : Math.PI, spread: 0.6, speed: H * 0.2, life: 0.3 });
        }));
        sc.at(TBR, () => {
            ring(sc, mx, my, s * 2, me.w, 0.9, 0.25, ['#ffffff', F[1]], 2);
            ultShake(2, 150);
        });
        sc.at(TWRAP, () => {
            if (q) {
                hit(where(u, q), dir, 'shake', 0);
            }
            ultShake(2, 300);
        });
        sc.at(TTIGHT, () => {
            ring(sc, tx, ty, RR * 0.3, RR * 1.6, 0.6, 0.3, ['#ffffff', F[1], F[2]], 2);
            ultShake(3, 200);
        });
        // 펑 — 잿빛 연기 구름
        sc.at(TPOOF, () => {
            impactFrames(sc, W, H, 0.4, 0.3);
            ultShake(5 + 2 * P, 450);
            for (let i = 0; i < 9; i++) {
                const a = (i / 9) * TAU;
                K.puff(tx + Math.cos(a) * RR * 0.4, ty + Math.sin(a) * RR * 0.3, s, i % 2 ? '#7a7078' : '#a69ca4', RR * 0.3, RR * (0.8 + 0.3 * hash(i, 181)), 1.6, Math.cos(a) * 25, Math.sin(a) * 15 - 20, 0.75);
            }
            K.puff(tx, ty, s, '#c8bfc6', RR * 0.4, RR * 1.3, 1.4, 0, -30, 0.7);
            fireBits(tx, ty, s, F, 16, { speed: H * 0.6, life: 0.5 });
            if (q) {
                hit(where(u, q), dir, 'tumble', 0);
            }
            for (const r of u.others()) {
                if ((!q || r.pokemon !== q.pokemon) && Math.abs(r.x - tx) < RR * 1.5) {
                    hit(r, Math.sign(r.x - tx) || dir, 'shake');
                }
            }
        });
        // 콜록 — 작은 연기 방울 셋이 퐁퐁
        [0.5, 0.8, 1.1].forEach((d, i) => sc.at(TPOOF + d, () => {
            const x = q ? where(u, q).x : tx;
            K.puff(x + (i - 1) * s * 4, G - me.h * 0.8, s, '#8a8088', s, me.w * 0.25, 0.6, 0, -30, 0.6);
        }));
    }

    // ═════ 차오꿀 — 불꽃펀치 (ultbarrage) ═════
    // 두 주먹에 불이 붙어 활활 → 상대 앞으로 쿵쿵 달려가 불꽃 잽 셋(좌 · 우 · 좌, 맞을 때마다 불꽃 펑)
    // → 몸을 낮췄다 불꽃 어퍼컷! 상대가 불기둥과 함께 하늘 높이 솟구치고 차오꿀은 주먹을 치켜든 채 불꽃 고리 (약 5.6초)
    UNIQ.pignite = { fx: 'ultbarrage', ms: (P) => 5600 + 200 * P, run: runPigniteFist };
    function runPigniteFist(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const F = ST_FIRE;
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * Math.min(W * 0.4, me.w * 5 + 40), W * 0.12, W * 0.88);
        const dd = Math.sign(tx - me.x) || dir;
        const ax = clamp(tx - dd * me.w * 0.8, me.w * 0.5, W - me.w * 0.5);
        const TLIT = 0.25;
        const TRUN = 0.9;
        const TJ = [TRUN + 0.55, TRUN + 0.8, TRUN + 1.05];
        const TCROUCH = TJ[2] + 0.3;
        const TUP = TCROUCH + 0.25;
        const xAt = (t) => (t < TRUN ? me.x : t < TJ[0] - 0.1 ? lerp(me.x, ax, (t - TRUN) / (TJ[0] - 0.1 - TRUN)) : ax);
        const footAt = (t) => {
            if (t > TRUN && t < TJ[0] - 0.1) {
                return me.b - Math.abs(Math.sin((t - TRUN) * 14)) * me.h * 0.12;
            }
            if (t > TUP && t < TUP + 0.5) {
                return me.b - Math.sin(((t - TUP) / 0.5) * Math.PI) * upH;
            }
            return me.b;
        };
        // 게임 화면 — 어퍼컷 뛰어오름 꼭대기에서도 몸이 위 끝 띠 아래 (#107)
        const upH = Math.min(me.h * 0.9, gameTop() > 0 ? Math.max(me.h * 0.2, me.b - me.h - gameTop() - 8 - 2 * s) : Infinity);
        const fist = (t, side) => [xAt(t) + dd * me.w * (0.45 + (TJ.some((tj) => t > tj - 0.06 && t < tj + 0.06) ? 0.25 : 0)), footAt(t) - me.h * (side ? 0.45 : 0.6)];
        const sc = scene(u, sec + 0.3, 'uniq pignite');
        ultDark(0.35, ms - 200);
        puppet(sc, pokemon, u, footAt, F[2], sec - 0.1, {
            x: xAt,
            scale: (t) => (t > TCROUCH && t < TUP ? 0.9 : 1),
            rot: (t) => (TJ.some((tj, i) => t > tj - 0.08 && t < tj + 0.06) ? dd * 0.15 : t > TUP && t < TUP + 0.5 ? -dd * 0.25 : 0),
            glow: (t) => (t > TLIT ? 0.12 + 0.1 * Math.sin(t * 14) : 0),
            glowColor: F[1],
        });
        // 주먹 불꽃 둘 (어퍼컷 때 커진 불꽃 윗부분만 위 끝 층 — #107)
        sc.split({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = clamp((life - TLIT) / 0.3, 0, 1) * clamp((sec - 0.2 - life) / 0.4, 0, 1);
            if (k <= 0.02) {
                return;
            }
            for (const side of [0, 1]) {
                const [x, y] = fist(life, side);
                const big = life > TUP && life < TUP + 0.8 && side === 0 ? 1.8 : 1;
                K.flameTongue(ctx, px, s, x, y + me.h * 0.15, me.w * 0.35 * big, me.h * 0.6 * big, F, life + side, k);
            }
        } });
        TJ.forEach((tj, i) => sc.at(tj, () => {
            const [x, y] = fist(tj, i % 2);
            ring(sc, x + dd * me.w * 0.2, y, s * 2, me.w * 1.1, 0.85, 0.25, ['#ffffff', F[1], F[2]], 2);
            fireBits(x + dd * me.w * 0.2, y, s, F, 12, { angle: dd > 0 ? 0 : Math.PI, spread: 1.4, speed: H * 0.5, life: 0.45 });
            ultShake(2 + i, 120);
            if (q) {
                hit(where(u, q), dd, 'shake', 0);
            }
        }));
        // 어퍼컷 — 불기둥과 함께 하늘로
        sc.at(TUP, () => {
            impactFrames(sc, W, H, 0.6, 0.4);
            ultShake(7 + 2 * P, 550);
            if (q) {
                hit(where(u, q), dd, 'spin', 0);
            }
            for (const r of u.others()) {
                if ((!q || r.pokemon !== q.pokemon) && Math.abs(r.x - tx) < me.w * 1.5) {
                    hit(r, Math.sign(r.x - tx) || dd, 'lift');
                }
            }
        });
        // 어퍼컷 불꽃 — 상대를 따라 세 갈래 불꽃이 꼬이며 솟구침 (하늘로 솟는 불기둥 — 위 끝 층 · #107)
        sc.soft({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = (life - TUP) / 1.0;
            if (k <= 0 || k >= 1) {
                return;
            }
            const top = G - Math.min(G * 0.9, H * 0.75) * easeOut(Math.min(1, k * 1.6));
            const a = 1 - clamp((k - 0.6) / 0.4, 0, 1);
            for (let j = 0; j < 3; j++) {
                const L = G - top;
                const x = tx + Math.sin(life * 12 + (j * TAU) / 3) * me.w * 0.45;
                K.fireTail(ctx, px, s, x, top + j * me.h * 0.3, Math.cos(life * 12 + (j * TAU) / 3) * 0.3, -1, L * 0.85, Math.max(3 * s, me.w * 0.45), F, life + j, a);
            }
        } });
        sc.at(TUP + 0.5, () => {
            ring(sc, ax, me.b - me.h * 0.5, me.w * 0.4, me.w * 2.6, 0.85, 0.5, ['#ffffff', F[1], F[2]], 3);
            fireBits(ax, me.b - me.h, s, F, 18, { angle: -Math.PI / 2, spread: 1.2, speed: H * 0.6, g: H * 0.6, life: 0.7 });
        });
        emberRise(sc, TUP, sec, F);
    }

    // ═════ 수댕이 — 껍질검 (ultbarrage) ═════
    // 배의 가리비를 쏙 떼어 들고 반짝 → 휙 던지면 가리비가 물방울 꼬리를 끌며 빙글빙글 부메랑처럼 날아가 상대를 베고(물 베기 자국)
    // → 크게 돌아 되돌아옴 → 수댕이가 탁 받아 들고 한 바퀴 돌며 반짝 포즈 (약 4.6초)
    UNIQ.oshawott = { fx: 'ultbarrage', ms: (P) => 4600 + 200 * P, run: runOshawottShell };
    function runOshawottShell(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TIDE = K.pal.TIDE;
        const TTAKE = 0.3;
        const TTHROW = 0.9;
        const TFLY = 1.7;
        const TCATCH = TTHROW + TFLY;
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * Math.min(W * 0.4, me.w * 5 + 40), W * 0.1, W * 0.9);
        const ty = q ? q.y : G - me.h * 0.5;
        const D = tx - me.x;
        const hold = [me.x + dir * me.w * 0.35, me.b - me.h * 0.55];
        const r = Math.max(me.w * 0.24, 3.5 * s);
        const hh = Math.max(me.h * 1.4, H * 0.18);
        const shellAt = (t) => {
            if (t < TTHROW) {
                return hold;
            }
            if (t < TCATCH) {
                const th = ((t - TTHROW) / TFLY) * TAU;
                return [me.x + (D / 2) * (1 - Math.cos(th)) + dir * me.w * 0.35 * Math.cos(th), Math.min(G - r, hold[1] - Math.sin(th) * hh * (th < Math.PI ? 1 : -0.25))];
            }
            return hold;
        };
        let spin = 0;
        let lastT = 0;
        const sc = scene(u, sec + 0.3, 'uniq oshawott');
        ultDark(0.3, ms - 200);
        sc.tick((t) => {
            spin += (t - lastT) * (t > TTHROW && t < TCATCH ? 22 : 0);
            lastT = t;
        });
        puppet(sc, pokemon, u, () => me.b, TIDE[2], sec - 0.1, {
            rot: (t) => (t > TTHROW - 0.12 && t < TTHROW + 0.05 ? dir * 0.3 : t > TCATCH && t < TCATCH + 0.5 ? dir * TAU * easeOut((t - TCATCH) / 0.5) : 0),
            glow: (t) => (t > TCATCH + 0.5 && t < TCATCH + 0.8 ? 0.5 : 0),
            glowColor: '#ffffff',
        });
        // 물방울 꼬리
        sc.add({ max: TCATCH + 0.1, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TTHROW || life > TCATCH) {
                return;
            }
            for (let j = 1; j <= 8; j++) {
                const tt = life - j * 0.03;
                if (tt < TTHROW) {
                    break;
                }
                const [x, y] = shellAt(tt);
                ctx.globalAlpha = 0.7 * (1 - j / 9);
                ctx.fillStyle = j % 2 ? TIDE[1] : TIDE[2];
                const z = Math.max(s, Math.round((r * (1 - j / 10)) / s) * s);
                ctx.fillRect(px(x - z / 2), px(y - z / 2), z, z);
            }
        } });
        // 가리비
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TTAKE || life > sec - 0.15) {
                return;
            }
            const [x, y] = shellAt(life);
            stScalchop(ctx, px, s, x, y, r, spin, clamp((life - TTAKE) / 0.15, 0, 1));
            if (life > TTHROW && life < TCATCH) {
                K.ringDots(ctx, px, s, x, y, r * 1.5, 0.9, [TIDE[0], TIDE[1]], 0.5, 1);
            }
        } });
        // 물 베기 자국 — 상대를 지날 때
        const TCUT = TTHROW + TFLY * 0.5;
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const k = (sc.t - TCUT + 0.05) / 0.35;
            if (k <= 0 || k >= 1) {
                return;
            }
            const R = Math.max(me.w, me.h) * 0.9;
            for (let i = 0; i <= 16; i++) {
                const f = i / 16;
                if (f > Math.min(1, k * 3)) {
                    break;
                }
                const an = (dir > 0 ? Math.PI : 0) - 1.1 + 2.2 * f;
                const th = Math.sin(f * Math.PI) * Math.max(2 * s, R * 0.14);
                for (let d = R - th; d < R; d += s) {
                    ctx.globalAlpha = 1 - k;
                    ctx.fillStyle = d > R - s * 1.2 ? '#ffffff' : TIDE[1];
                    ctx.fillRect(px(tx + Math.cos(an) * d), px(ty + Math.sin(an) * d), s, s);
                }
            }
        } });
        sc.at(TTAKE, () => {
            sparkles(hold[0], hold[1], s, ['#ffffff', ST_SHELLC[1]], 6, r, 10);
            ring(sc, hold[0], hold[1], s, me.w * 0.8, 0.9, 0.25, ['#ffffff', TIDE[1]], 1);
        });
        sc.at(TTHROW, () => ultShake(1.5, 100));
        sc.at(TCUT, () => {
            ultShake(3 + P, 200);
            K.splash(tx, ty, s, TIDE, 16, H * 0.5, { spread: TAU });
            if (q) {
                hit(where(u, q), Math.sign(q.x - me.x) || dir, 'tumble', 0);
            }
            for (const r2 of u.others()) {
                if ((!q || r2.pokemon !== q.pokemon) && Math.abs(r2.x - tx) < me.w * 1.2) {
                    hit(r2, Math.sign(r2.x - tx) || dir, 'shake');
                }
            }
        });
        // 탁 받기 · 반짝 포즈
        sc.at(TCATCH, () => {
            ring(sc, hold[0], hold[1], s, me.w * 1.2, 0.9, 0.3, ['#ffffff', TIDE[1]], 2);
            K.splash(hold[0], hold[1], s, TIDE, 8, H * 0.25, { spread: TAU, life: 0.4 });
            ultShake(1.5, 100);
        });
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const k = (sc.t - TCATCH - 0.5) / 0.45;
            if (k > 0 && k < 1) {
                glint(ctx, px, s, hold[0], hold[1] - r, me.w * 0.6 * Math.sin(k * Math.PI), 1);
            }
        } });
        sc.at(TCATCH + 0.5, () => sparkles(me.x, me.b - me.h * 0.6, s, ['#ffffff', TIDE[1], ST_SHELLC[1]], 12, me.w * 0.7, 20));
    }

    // ═════ 쌍검자비 — 연속자르기 (ultbarrage) ═════
    // 두 가리비 칼을 뽑아 들고 상대 앞으로 → 좌 · 우로 번갈아 베기, 벨 때마다 점점 빨라짐(물 베기 자국이 겹겹)
    // → 마지막에 한 바퀴 돌며 둥근 물 칼날 → 베인 자리에 하얀 물안개가 퍼지며 반짝반짝 → 폴짝 제자리 (약 5.6초)
    UNIQ.dewott = { fx: 'ultbarrage', ms: (P) => 5600 + 200 * P, run: runDewottFury };
    function runDewottFury(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TIDE = K.pal.TIDE;
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * Math.min(W * 0.4, me.w * 5 + 40), W * 0.12, W * 0.88);
        const dd = Math.sign(tx - me.x) || dir;
        const ty = q ? q.y : G - me.h * 0.5;
        const ax = clamp(tx - dd * me.w * 0.85, me.w * 0.5, W - me.w * 0.5);
        const TDRAW = 0.3;
        const TGO = 0.8;
        const T0 = TGO + 0.4;
        const cuts = [];
        let tc = T0;
        for (let i = 0; i < 9; i++) {
            cuts.push(tc);
            tc += Math.max(0.07, 0.3 * Math.pow(0.78, i));
        }
        const TSPIN = tc + 0.05;
        const TMIST = TSPIN + 0.35;
        const TBACK = TMIST + 0.9;
        const xAt = (t) => (t < TGO ? me.x : t < T0 ? lerp(me.x, ax, easeOut((t - TGO) / (T0 - TGO))) : t < TBACK ? ax : lerp(ax, me.x, clamp((t - TBACK) / 0.5, 0, 1)));
        const footAt = (t) => (t > TBACK && t < TBACK + 0.5 ? me.b - Math.sin(((t - TBACK) / 0.5) * Math.PI) * me.h : me.b);
        const sc = scene(u, sec + 0.3, 'uniq dewott');
        ultDark(0.34, ms - 200);
        puppet(sc, pokemon, u, footAt, TIDE[2], sec - 0.1, {
            x: xAt,
            rot: (t) => {
                if (t > TSPIN && t < TSPIN + 0.3) {
                    return dd * TAU * ((t - TSPIN) / 0.3);
                }
                const i = cuts.findIndex((c) => t > c - 0.04 && t < c + 0.04);
                return i >= 0 ? (i % 2 ? -0.2 : 0.2) * dd : 0;
            },
            glow: (t) => (t > T0 && t < TMIST ? 0.12 + 0.12 * ((t - T0) / (TMIST - T0)) : 0),
            glowColor: TIDE[1],
        });
        // 양손 가리비 칼
        sc.add({ max: TBACK, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TDRAW) {
                return;
            }
            const x = xAt(life);
            const fb = footAt(life);
            const r = Math.max(me.w * 0.2, 3 * s);
            const i = cuts.findIndex((c) => life > c - 0.05 && life < c + 0.05);
            for (const side of [-1, 1]) {
                const swing = i >= 0 && (i % 2 ? side > 0 : side < 0) ? dd * me.w * 0.35 : 0;
                stScalchop(ctx, px, s, x + dd * me.w * 0.3 + swing + side * me.w * 0.15, fb - me.h * (0.5 + side * 0.1), r, life * 3 + side, clamp((life - TDRAW) / 0.15, 0, 1));
            }
        } });
        // 물 베기 자국 — 겹겹이
        const slashAt = (ctx, px, R, ang, k, alpha) => {
            for (let i = 0; i <= 16; i++) {
                const f = i / 16;
                if (f > k) {
                    break;
                }
                const an = ang - 1 + 2 * f;
                const th = Math.sin(f * Math.PI) * Math.max(2 * s, R * 0.15);
                for (let d = R - th; d < R; d += s) {
                    ctx.globalAlpha = alpha;
                    ctx.fillStyle = d > R - s * 1.2 ? '#ffffff' : d > R - th * 0.5 ? TIDE[1] : TIDE[2];
                    ctx.fillRect(px(tx + Math.cos(an) * d), px(ty + Math.sin(an) * d), s, s);
                }
            }
        };
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            cuts.forEach((c, i) => {
                const k = (life - c) / 0.3;
                if (k > 0 && k < 1) {
                    slashAt(ctx, px, Math.max(me.w, me.h) * (0.75 + 0.03 * i), (dd > 0 ? Math.PI : 0) + (i % 2 ? 0.7 : -0.7), Math.min(1, k * 4), 1 - k);
                }
            });
            // 둥근 물 칼날
            const k = (life - TSPIN) / 0.45;
            if (k > 0 && k < 1) {
                K.ringDots(ctx, px, s, ax, me.b - me.h * 0.5, me.w * (0.8 + 2.2 * easeOut(k)), 0.5, ['#ffffff', TIDE[1]], 1 - k, 3);
            }
        } });
        cuts.forEach((c, i) => sc.at(c, () => {
            ultShake(1 + i * 0.3, 70);
            K.splash(tx, ty, s, TIDE, 4 + i, H * 0.35, { spread: TAU, life: 0.4 });
            if (q) {
                hit(where(u, q), dd, 'shake', 0);
            }
        }));
        sc.at(TSPIN + 0.15, () => {
            impactFrames(sc, W, H, 0.5, 0.35);
            ultShake(5 + 2 * P, 400);
            if (q) {
                hit(where(u, q), dd, 'tumble', 0);
            }
            for (const r of u.others()) {
                if ((!q || r.pokemon !== q.pokemon) && Math.abs(r.x - ax) < me.w * 3) {
                    hit(r, Math.sign(r.x - ax) || dd, 'lift');
                }
            }
        });
        // 하얀 물안개 — 땅을 따라 퍼지며 반짝
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = (life - TMIST) / (sec - TMIST);
            if (k <= 0) {
                return;
            }
            const a = clamp(k * 5, 0, 1) * clamp((sec - 0.1 - life) / 0.6, 0, 1);
            const spread = W * 0.15 + W * 0.25 * easeOut(k);
            for (let j = 0; j < 4; j++) {
                const yy = G - me.h * (0.2 + j * 0.35);
                ellipse(ctx, px, s, tx + Math.sin(life + j) * s * 6, yy, spread * (1 - j * 0.15), me.h * 0.35, j % 2 ? TIDE[0] : TIDE[1], 0.16 * a);
            }
        } });
        let glit = 0;
        sc.tick((t, dt) => {
            if (t < TMIST || t > sec - 0.3) {
                return;
            }
            glit += dt * 14;
            while (glit >= 1 && room(1)) {
                glit -= 1;
                sparkles(tx + rnd(-1, 1) * W * 0.3, G - rnd(0.1, 1.4) * me.h, s, ['#ffffff', TIDE[1]], 1, s * 2, 8);
            }
        });
    }

    // 바늘 — (x, y) 끝(뾰족)에서 ang 반대쪽으로 len (몸통 · 밝은 줄 · 하얀 끝)
    const ST_NEEDLE = ['#ffffff', '#e6f5b0', '#8fbf4a', '#3d5a22'];
    function stNeedles(ctx, px, s, list, alpha = 1) {
        if (alpha <= 0.01 || !list.length) {
            return;
        }
        const paths = [new Path2D(), new Path2D(), new Path2D()];
        for (const n of list) {
            const ux = Math.cos(n.ang);
            const uy = Math.sin(n.ang);
            for (let d = 0; d < n.len; d += s * 0.8) {
                const x = n.x - ux * d;
                const y = n.y - uy * d;
                paths[d < s * 1.5 ? 2 : 0].rect(px(x), px(y), s, s);
                if (d > n.len * 0.4) {
                    paths[1].rect(px(x - uy * s), px(y + ux * s), s, s);
                }
            }
        }
        K.fillPaths(ctx, paths, [ST_NEEDLE[3], ST_NEEDLE[2], ST_NEEDLE[0]], alpha);
    }
    // 물수리검 (작은) — (x, y) 가운데, 반지름 r, rot 만큼 돎: 날 넷 · 가운데 구멍
    function stShuriken(ctx, px, s, x, y, r, rot, cols, alpha = 1) {
        if (alpha <= 0.01) {
            return;
        }
        const paths = [new Path2D(), new Path2D(), new Path2D()];
        for (let j = 0; j < 4; j++) {
            const a = rot + (j * Math.PI) / 2;
            const ux = Math.cos(a);
            const uy = Math.sin(a);
            for (let d = 0; d < r; d += s * 0.8) {
                const w = (1 - d / r) * r * 0.32;
                for (let e = -w; e <= w * 0.4; e += s * 0.8) {
                    paths[e > -w * 0.3 ? 1 : 0].rect(px(x + ux * d - uy * e), px(y + uy * d + ux * e), s, s);
                }
            }
        }
        K.fillPaths(ctx, paths, [cols[3], cols[1], '#ffffff'], alpha);
        ellipse(ctx, px, s, x, y, Math.max(s, r * 0.18), Math.max(s, r * 0.18), cols[3], alpha);
    }

    // ═════ 도치마론 — 바늘미사일 (ultswarm) ═════
    // 머리 가시가 삐죽삐죽 곤두섬 · 반짝 → 하늘로 바늘을 연달아 쏘아 올려 바늘 비가 상대 둘레로 쏟아짐(꽂힐 때마다 흙 튐)
    // → 땅에 촘촘히 꽂힌 바늘밭이 반짝반짝 빛나고 밭 위의 애들은 따끔 휘청 (약 4.6초)
    UNIQ.chespin = { fx: 'ultswarm', ms: (P) => 4600 + 200 * P, run: runChespinNeedle };
    function runChespinNeedle(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const DIRT = ['#d1b178', '#a88a55', '#6b5536'];
        const head = [me.x, me.b - me.h * 0.9];
        const TBR = 0.25;
        const TF0 = 0.8;
        const TF1 = 1.9;
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * Math.min(W * 0.4, me.w * 5 + 40), W * 0.12, W * 0.88);
        const field = Math.max(W * 0.18, me.w * 2.2);
        const NN = Math.round(52 * clamp(W / 480, 0.7, 1.8));
        const nd = [];
        for (let i = 0; i < NN; i++) {
            const t0 = TF0 + (i / NN) * (TF1 - TF0);
            nd.push({ t0, x1: tx + (hash(i, 191) - 0.5) * 2 * field, land: t0 + 0.75 + hash(i, 192) * 0.15, tilt: (hash(i, 193) - 0.5) * 0.5, len: Math.max(7 * s, me.h * (0.5 + 0.25 * hash(i, 194))) });
        }
        const TGLOW = Math.max(...nd.map((n) => n.land)) + 0.1;
        const top = -H * 0.1;
        const sc = scene(u, sec + 0.3, 'uniq chespin');
        ultDark(0.3, ms - 200);
        puppet(sc, pokemon, u, (t) => me.b - (t > TF0 && t < TF1 ? Math.abs(Math.sin(t * 22)) * s : 0), ST_NEEDLE[2], sec - 0.1, { glow: (t) => (t > TBR && t < TF1 ? 0.15 : 0), glowColor: ST_NEEDLE[1] });
        // 곤두선 머리 가시
        sc.add({ max: TF1 + 0.3, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = easeOut(clamp((life - TBR) / 0.3, 0, 1)) * clamp((TF1 + 0.3 - life) / 0.3, 0, 1);
            if (k <= 0.02) {
                return;
            }
            const list = [];
            for (let j = 0; j < 7; j++) {
                const a = -Math.PI / 2 + (j - 3) * 0.32;
                const L = me.h * 0.45 * k;
                list.push({ x: head[0] + Math.cos(a) * (me.w * 0.25 + L), y: head[1] + Math.sin(a) * (me.w * 0.2 + L), len: L, ang: a });
            }
            stNeedles(ctx, px, s, list, 1);
        } });
        // 오르는 바늘 → 내리꽂히는 바늘 → 꽂혀 있는 바늘밭 (하늘 너머로 올라갔다 쏟아지는 바늘 — 위 끝 층 · #107)
        sc.soft({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const fly = [];
            const stuck = [];
            const fade = clamp((sec - 0.1 - life) / 0.5, 0, 1);
            for (const n of nd) {
                if (life < n.t0) {
                    continue;
                }
                const up = n.t0 + 0.3;
                if (life < up) {
                    const k = (life - n.t0) / 0.3;
                    fly.push({ x: lerp(head[0], head[0] + (n.x1 - head[0]) * 0.15, k), y: lerp(head[1], top, easeOut(k)), len: n.len, ang: -Math.PI / 2 });
                } else if (life < n.land) {
                    const k = (life - up) / (n.land - up);
                    fly.push({ x: lerp(n.x1 - (n.x1 - head[0]) * 0.05, n.x1, k), y: lerp(top, G - s, k * k), len: n.len, ang: Math.PI / 2 + n.tilt });
                } else {
                    stuck.push({ x: n.x1, y: G + s * 2, len: n.len, ang: Math.PI / 2 + n.tilt });
                }
            }
            stNeedles(ctx, px, s, fly, 1);
            stNeedles(ctx, px, s, stuck, fade);
            // 바늘밭이 반짝반짝 — 차례로 하얗게
            if (life > TGLOW) {
                const glow = [];
                for (let i = 0; i < stuck.length; i++) {
                    if ((Math.floor(life * 10) + i) % 7 === 0) {
                        glow.push(stuck[i]);
                    }
                }
                ctx.globalAlpha = fade;
                ctx.fillStyle = '#ffffff';
                for (const g of glow) {
                    ctx.fillRect(px(g.x - s), px(G - g.len * 0.8 - s), 2 * s, 2 * s);
                }
            }
        } });
        sc.at(TBR, () => {
            ring(sc, head[0], head[1], s * 2, me.w * 1.2, 0.8, 0.25, ['#ffffff', ST_NEEDLE[1]], 2);
            sparkles(head[0], head[1], s, ['#ffffff', ST_NEEDLE[1]], 6, me.w * 0.4, 10);
        });
        nd.forEach((n, i) => {
            if (i % 3 === 0) {
                sc.at(n.t0, () => ultShake(0.8, 50));
            }
            sc.at(n.land, () => {
                debris(n.x1, G - s, s, DIRT, 2, H * 0.25, { angle: -Math.PI / 2, spread: 1.4, ground: G - s, life: 0.4 });
                for (const r of u.others()) {
                    if (Math.abs(r.x - n.x1) < me.w * 0.4) {
                        hit(r, Math.sign(r.x - me.x) || dir, 'shake');
                    }
                }
            });
        });
        sc.at(TGLOW, () => {
            ring(sc, tx, G - s, me.w * 0.5, field * 1.3, 0.2, 0.5, ['#ffffff', ST_NEEDLE[1], ST_NEEDLE[2]], 2);
            ultShake(3 + P, 300);
            if (q) {
                hit(where(u, q), Math.sign(q.x - me.x) || dir, 'tumble', 0);
            }
            for (const r of u.others()) {
                if ((!q || r.pokemon !== q.pokemon) && Math.abs(r.x - tx) < field) {
                    hit(r, Math.sign(r.x - tx) || dir, 'lift');
                }
            }
        });
    }

    // ═════ 도치보구 — 구르기 (ultrush) ═════
    // 몸을 공처럼 말아 가시 공으로 → 핀볼처럼 땅 · 공중을 꺾어 튕기며 화면을 누비고(튕길 때마다 번쩍 · 상대 쾅)
    // → 마지막에 높이 크게 튀어 올랐다 상대 자리로 쿵 — 별이 우수수 튀고 폴짝 풀려 제자리 (약 5.6초)
    UNIQ.quilladin = { fx: 'ultrush', ms: (P) => 5600 + 200 * P, run: runQuilladinRoll };
    function runQuilladinRoll(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const STAR = ['#ffffff', '#fff6b0', '#ffd23c', '#c98a1a'];
        const R = Math.max(me.w * 0.5, 7 * s);
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * Math.min(W * 0.4, me.w * 5 + 40), W * 0.12, W * 0.88);
        const dd = Math.sign(tx - me.x) || dir;
        const TCURL = 0.3;
        const TR0 = 0.8;
        // 핀볼 꺾임 점 — 땅 · 공중을 번갈아 (상대 지점을 두 번 지남)
        const hiY = Math.max(R * 2, G - Math.min(H * 0.5, me.h * 3.5));
        const lo = G - R;
        const pts = [[me.x, lo], [lerp(me.x, tx, 0.5), hiY], [tx, lo], [clamp(tx + dd * W * 0.22, R, W - R), hiY * 1.05], [clamp(tx + dd * W * 0.12, R, W - R), lo], [lerp(me.x, tx, 0.35), (hiY + lo) / 2], [tx - dd * R, lo]];
        const segT = 0.32;
        const TPIN = TR0 + (pts.length - 1) * segT;
        const TJ = TPIN + 0.05;
        const TSLAM = TJ + 0.9;
        const THOME = TSLAM + 0.75;
        const peak = Math.max(R * 2, G - Math.min(G * 0.85, H * 0.75));
        const posAt = (t) => {
            if (t < TR0) {
                return [me.x, lo];
            }
            if (t < TPIN) {
                const i = Math.min(pts.length - 2, Math.floor((t - TR0) / segT));
                const k = (t - TR0 - i * segT) / segT;
                return [lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k)];
            }
            const last = pts[pts.length - 1];
            if (t < TSLAM) {
                const k = (t - TJ) / (TSLAM - TJ);
                const e = clamp(k, 0, 1);
                return [lerp(last[0], tx, e), lo - (lo - peak) * Math.sin(e * Math.PI) ** 0.8 * (e < 0.5 ? 1 : 1)];
            }
            const k = clamp((t - TSLAM - 0.15) / (THOME - TSLAM - 0.15), 0, 1);
            return [lerp(tx, me.x, k), lo - Math.sin(k * Math.PI) * me.h * 1.1];
        };
        const ball = (t) => t > TCURL + 0.15 && t < TSLAM + 0.15;
        let spin = 0;
        let lastT = 0;
        const sc = scene(u, sec + 0.3, 'uniq quilladin');
        ultDark(0.33, ms - 200);
        sc.tick((t) => {
            spin += (t - lastT) * (ball(t) ? 20 : 0) * dd;
            lastT = t;
        });
        // 가시 공 — 둘레 가시 (몸 뒤)
        sc.add({ max: TSLAM + 0.2, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (!ball(life)) {
                return;
            }
            const [x, y] = posAt(life);
            const k = clamp((life - TCURL - 0.15) / 0.2, 0, 1);
            const list = [];
            for (let j = 0; j < 10; j++) {
                const a = spin + (j * TAU) / 10;
                list.push({ x: x + Math.cos(a) * R * 1.35 * k, y: y + Math.sin(a) * R * 1.35 * k, len: R * 0.5, ang: a });
            }
            stNeedles(ctx, px, s, list, k);
            // 잔상
            for (let j = 1; j <= 3; j++) {
                const [gx, gy] = posAt(life - j * 0.05);
                K.ringDots(ctx, px, s, gx, gy, R, 1, [ST_NEEDLE[1], ST_NEEDLE[2]], 0.4 * (1 - j / 4) * k, 1);
            }
        } });
        puppet(sc, pokemon, u, (t) => (ball(t) ? posAt(t)[1] + me.h * 0.35 : t > TSLAM ? posAt(t)[1] + R : me.b), ST_NEEDLE[2], sec - 0.1, {
            x: (t) => posAt(t)[0],
            rot: (t) => (ball(t) ? spin : 0),
            scale: (t) => (ball(t) ? 0.72 : 1),
            glow: (t) => (ball(t) ? 0.15 : 0),
            glowColor: ST_NEEDLE[1],
        });
        // 튕길 때마다 번쩍
        pts.slice(1).forEach(([x, y], i) => sc.at(TR0 + (i + 1) * segT, () => {
            ring(sc, x, y, R * 0.5, R * 2.4, y >= lo - 1 ? 0.3 : 0.9, 0.25, ['#ffffff', STAR[1]], 2);
            sparkles(x, y, s, STAR, 4, R, 10);
            ultShake(1.5 + (y >= lo - 1 ? 1 : 0), 100);
            for (const r of u.others()) {
                if (Math.abs(r.x - x) < R * 2 && y >= lo - 1) {
                    hit(r, Math.sign(r.x - x) || dd, 'shake');
                }
            }
        }));
        // 쿵 — 별이 우수수
        sc.at(TSLAM, () => {
            impactFrames(sc, W, H, 0.55, 0.35);
            ultShake(6 + 2 * P, 500);
            ring(sc, tx, G - s, R, me.w * 3.4, 0.22, 0.5, ['#ffffff', STAR[1], STAR[2]], 3);
            if (q) {
                hit(where(u, q), dd, 'tumble', 0);
            }
            for (const r of u.others()) {
                if ((!q || r.pokemon !== q.pokemon) && Math.abs(r.x - tx) < me.w * 2.5) {
                    hit(r, Math.sign(r.x - tx) || dd, 'lift');
                }
            }
        });
        const stars = [];
        for (let i = 0; i < 9; i++) {
            const a = -Math.PI / 2 + (i - 4) * 0.32;
            stars.push({ a, sp: H * (0.5 + 0.4 * hash(i, 201)), rot: hash(i, 202) * TAU });
        }
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = life - TSLAM;
            if (k <= 0 || k > 1.4) {
                return;
            }
            for (const st of stars) {
                const x = tx + Math.cos(st.a) * st.sp * k;
                const y = G - me.h * 0.3 + Math.sin(st.a) * st.sp * k + H * 0.9 * k * k;
                if (y > G) {
                    continue;
                }
                starOutline(ctx, px, s, x, y, Math.max(3 * s, me.w * 0.28), st.rot + k * 6, 1, STAR, 1);
            }
        } });
        sc.at(THOME, () => K.puff(me.x, G - s, s, '#8a7252', s * 2, me.w * 0.6, 0.4, 0, -10, 0.4));
    }

    // ═════ 푸호꼬 — 도깨비불 (ultorb) ═════
    // 귀에서 보랏빛 도깨비불 셋이 피어올라 푸호꼬 둘레를 둥실둥실 돎 → 상대에게 날아가 둘레를 빙글빙글 좁혀 돌며 깜빡
    // → 셋이 한가운데서 동시에 팡 — 보랏빛 불꽃 꽃잎이 흩날리고 상대가 화들짝 벌러덩 (약 4.6초)
    UNIQ.fennekin = { fx: 'ultorb', ms: (P) => 4600 + 200 * P, run: runFennekinWisp };
    function runFennekinWisp(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const WISP = ['#ffffff', '#e2d4ff', '#9a7aff', '#4a2aa8'];
        const TUP = 0.3;
        const TGO = 1.5;
        const TARR = TGO + 0.6;
        const TPOP = TARR + 1.0;
        const q = nearest(u);
        const tgt = () => {
            if (q) {
                const r = q.pokemon.el.getBoundingClientRect();
                if (r.width > 0) {
                    return [r.left + r.width / 2, r.top + r.height * 0.5];
                }
            }
            return [clamp(me.x + dir * W * 0.35, W * 0.1, W * 0.9), G - me.h * 0.6];
        };
        const Rw = Math.max(me.w * 0.24, 4 * s);
        // 게임 화면 = 도깨비불 (불 위 끝 = y − 1.9 Rw) 이 위 끝 + 4칸 아래 — 맴도는 자리 · 날아가는 호 꼭대기 (위 끝에 반쯤 걸쳐 머물던 것 — #96 디자인 4바퀴 · ult-top 걸쳐 머묾)
        const wTop = gameTop() > 0 ? gameTop() + Rw * 2.2 + 4 * s : -Infinity;
        const wispAt = (i, t) => {
            const ph = (i * TAU) / 3;
            const home = [me.x + Math.cos(ph + t * 3) * me.w * 0.9, Math.max(wTop, me.b - me.h * 0.8 + Math.sin(ph + t * 3) * me.h * 0.3 + Math.sin(t * 5 + i) * s * 2)];
            if (t < TGO) {
                const k = clamp((t - TUP - i * 0.12) / 0.3, 0, 1);
                return [lerp(me.x + (i - 1) * me.w * 0.25, home[0], k), lerp(me.b - me.h, home[1], k), k];
            }
            const [x2, y2] = tgt();
            const r = me.w * (1.2 - 0.9 * clamp((t - TARR) / (TPOP - TARR), 0, 1));
            const sp = 4 + 8 * clamp((t - TARR) / (TPOP - TARR), 0, 1);
            const orbit = [x2 + Math.cos(ph + t * sp) * r, y2 + Math.sin(ph + t * sp) * r * 0.5];
            const k = clamp((t - TGO) / (TARR - TGO), 0, 1);
            const h0 = [me.x + Math.cos(ph + TGO * 3) * me.w * 0.9, me.b - me.h * 0.8 + Math.sin(ph + TGO * 3) * me.h * 0.3];
            const ay = lerp(h0[1], orbit[1], easeOut(k));
            return [lerp(h0[0], orbit[0], easeOut(k)), ay - Math.sin(k * Math.PI) * clamp(ay - wTop, 0, me.h), 1];
        };
        const sc = scene(u, sec + 0.3, 'uniq fennekin');
        ultDark(0.38, ms - 200);
        puppet(sc, pokemon, u, () => me.b, WISP[2], sec - 0.1, { glow: (t) => (t < TGO ? 0.15 * (1 + Math.sin(t * 10)) : 0), glowColor: WISP[1] });
        // 도깨비불 셋 — 위로 흔들리는 보랏빛 불꽃 + 꼬리
        sc.add({ max: TPOP + 0.05, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TUP || life >= TPOP) {
                return;
            }
            const blink = life > TARR ? 0.75 + 0.25 * Math.sin(life * 30) : 1;
            for (let i = 0; i < 3; i++) {
                const [x, y, k] = wispAt(i, life);
                if (k <= 0) {
                    continue;
                }
                const [x0, y0] = wispAt(i, life - 0.08);
                const L = Math.hypot(x - x0, y - y0);
                if (L > s) {
                    K.fireTail(ctx, px, s, x, y, (x - x0) / L, (y - y0) / L, Math.min(Rw * 4, Math.max(Rw * 2, L * 1.2)), Rw * 1.6, WISP, life + i, 0.6 * blink);
                }
                K.flameTongue(ctx, px, s, x, y + Rw * 1.1, Rw * 2.8 * k, Rw * 3 * k, WISP, life * 1.3 + i, 1, Math.sin(life * 4 + i) * 0.2, blink);
                fireOrb(ctx, px, s, x, y + Rw * 0.3, Rw * 0.9 * k, WISP, life + i, 1, Infinity, blink, 0, [1, 0.75, 0.5, 0.28], 0);
                glint(ctx, px, s, x, y, Rw * 0.8, 0.6 * blink);
            }
        } });
        sc.at(TUP, () => sparkles(me.x, me.b - me.h, s, [WISP[0], WISP[1]], 6, me.w * 0.5, 15));
        sc.at(TARR, () => {
            const [x2, y2] = tgt();
            ring(sc, x2, y2, me.w * 0.3, me.w * 1.4, 0.5, 0.3, [WISP[0], WISP[2]], 1);
            if (q) {
                hit(where(u, q), dir, 'shake', 0);
            }
        });
        // 동시에 팡 — 보랏빛 불꽃 꽃잎
        sc.at(TPOP, () => {
            const [x2, y2] = tgt();
            impactFrames(sc, W, H, 0.45, 0.3);
            ultShake(4 + 2 * P, 400);
            ring(sc, x2, y2, me.w * 0.3, me.w * 2.8, 0.85, 0.45, ['#ffffff', WISP[1], WISP[2]], 3);
            fireBits(x2, y2, s, WISP, 30, { speed: H * 0.6, life: 0.8 });
            if (q) {
                hit(where(u, q), dir, 'tumble', 0);
            }
            for (const r of u.others()) {
                if ((!q || r.pokemon !== q.pokemon) && Math.abs(r.x - x2) < me.w * 2) {
                    hit(r, Math.sign(r.x - x2) || dir, 'shake');
                }
            }
        });
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = (life - TPOP) / 0.9;
            if (k <= 0 || k >= 1) {
                return;
            }
            const [x2, y2] = tgt();
            stFireFlower(ctx, px, s, x2, y2, Math.max(me.w * 1.2, 14 * s), easeOut(Math.min(1, k * 2.5)), life, WISP, 1 - clamp((k - 0.5) / 0.5, 0, 1), life * 0.5);
        } });
    }

    // ═════ 테르나 — 매지컬플레임 (ultorb) ═════
    // 꼬리의 나뭇가지를 빙글빙글 돌리자 머리 위에 반짝이는 불꽃 올가미 고리가 돎 → 휙 던지면 올가미가 날아가 상대를 고리째 휘감음
    // → 고리가 꽉 조여 들며 반짝이 · 팡 — 불꽃 별 다섯이 튀어 흩어짐 (약 5.6초)
    UNIQ.braixen = { fx: 'ultorb', ms: (P) => 5600 + 200 * P, run: runBraixenLasso };
    function runBraixenLasso(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const F = ST_FIRE;
        const MAG = ['#ffffff', '#ffe0f4', '#ff9ad0', '#c0408a'];
        const TSP = 0.3;
        const TTHROW = 1.7;
        const TWRAP = TTHROW + 0.55;
        const TTIGHT = TWRAP + 1.2;
        const TPOP = TTIGHT + 0.25;
        const q = nearest(u);
        const tgt = () => {
            if (q) {
                const r = q.pokemon.el.getBoundingClientRect();
                if (r.width > 0) {
                    return [r.left + r.width / 2, r.top + r.height * 0.5, r.width];
                }
            }
            return [clamp(me.x + dir * W * 0.35, W * 0.1, W * 0.9), G - me.h * 0.6, me.w];
        };
        const R0 = Math.max(me.w * 0.9, 12 * s);
        // 게임 화면 = 올가미 (타원 R × 0.32 · 꼬리 · 반짝) 윗끝이 위 끝 + 4칸 아래 · 던지는 호 꼭대기도 (위 끝에 반쯤 걸쳐 머물던 것 — #96 디자인 4바퀴 · ult-top 걸쳐 머묾)
        const lassoTop = gameTop() > 0 ? gameTop() + R0 * 0.5 + 6 * s : -Infinity;
        const over = [me.x, Math.max(lassoTop, me.b - me.h * 1.5)];
        const ringAt = (t) => {
            if (t < TTHROW) {
                return [over[0], over[1], R0 * easeOut(clamp((t - TSP) / 0.4, 0, 1)), 0.32];
            }
            const [x2, y2, w2] = tgt();
            const k = clamp((t - TTHROW) / (TWRAP - TTHROW), 0, 1);
            const tight = t > TWRAP ? 1 - 0.55 * easeIn(clamp((t - TTIGHT + 0.6) / 0.6, 0, 1)) : 1;
            const Rt = Math.max(w2 * 0.9, R0 * 0.8) * tight;
            return [lerp(over[0], x2, easeOut(k)), lerp(over[1], y2, easeOut(k)) - Math.sin(k * Math.PI) * clamp(Math.min(over[1], y2) - lassoTop, 0, me.h * 1.2), lerp(R0, Rt, k), lerp(0.32, 0.3, k)];
        };
        const sc = scene(u, sec + 0.3, 'uniq braixen');
        ultDark(0.34, ms - 200);
        // 올가미 — 뒤쪽 반 / 앞쪽 반 (불꽃 혀가 고리를 따라 돎)
        const lasso = (front) => (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TSP || life >= TPOP) {
                return;
            }
            const [x, y, R, flat] = ringAt(life);
            if (R < s * 2) {
                return;
            }
            const n = 16;
            for (let i = 0; i < n; i++) {
                const a = (i / n) * TAU + life * 6 * dir;
                if ((Math.sin(a) > 0) !== front) {
                    continue;
                }
                K.fireTail(ctx, px, s, x + Math.cos(a) * R, y + Math.sin(a) * R * flat, -Math.sin(a) * dir, Math.cos(a) * dir * flat, R * 0.5, Math.max(2 * s, R * 0.2), F, life + i, front ? 1 : 0.7);
                if (i % 4 === 0) {
                    ctx.globalAlpha = 0.9;
                    ctx.fillStyle = MAG[(i / 4) % 2 ? 0 : 2];
                    ctx.fillRect(px(x + Math.cos(a) * R * 1.15), px(y + Math.sin(a) * R * flat * 1.15 - s * 2), s, s);
                }
            }
        };
        sc.add({ max: sec, draw: lasso(false) });
        puppet(sc, pokemon, u, () => me.b, F[2], sec - 0.1, {
            rot: (t) => (t > TSP && t < TTHROW ? Math.sin(t * 9) * 0.08 : t > TTHROW - 0.1 && t < TTHROW + 0.15 ? dir * 0.25 : 0),
            glow: (t) => (t > TSP && t < TTHROW ? 0.15 : 0),
            glowColor: MAG[1],
        });
        sc.add({ max: sec, draw: lasso(true) });
        // 나뭇가지 — 손에 들고 빙글
        sc.add({ max: TTHROW + 0.3, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TSP - 0.1) {
                return;
            }
            const a = -Math.PI / 2 + Math.sin(life * 9) * 0.6;
            const hx = me.x + dir * me.w * 0.3;
            const hy = me.b - me.h * 0.65;
            const L = me.h * 0.55;
            const p0 = new Path2D();
            const p1 = new Path2D();
            K.addLine(p0, px, s, [[hx, hy], [hx + Math.cos(a) * L, hy + Math.sin(a) * L]], 3);
            K.addLine(p1, px, s, [[hx, hy], [hx + Math.cos(a) * L, hy + Math.sin(a) * L]], 1);
            K.fillPaths(ctx, [p0, p1], ['#4a2e18', '#9a6a3a'], 1);
            K.flameTongue(ctx, px, s, hx + Math.cos(a) * L, hy + Math.sin(a) * L + s * 2, me.w * 0.25, me.h * 0.35, F, life, 1);
        } });
        let glit = 0;
        sc.tick((t, dt) => {
            if (t < TSP || t > TPOP) {
                return;
            }
            glit += dt * 18;
            while (glit >= 1 && room(1)) {
                glit -= 1;
                const [x, y, R, flat] = ringAt(t);
                const a = rnd(0, TAU);
                sparkles(x + Math.cos(a) * R, y + Math.sin(a) * R * flat, s, MAG, 1, s * 2, 10);
            }
        });
        sc.at(TTHROW, () => ultShake(1.5, 100));
        sc.at(TWRAP, () => {
            const [x2, y2] = tgt();
            ring(sc, x2, y2, me.w * 0.3, me.w * 1.6, 0.5, 0.3, [MAG[0], F[1]], 2);
            if (q) {
                hit(where(u, q), dir, 'shake', 0);
            }
            ultShake(2, 200);
        });
        // 팡 — 불꽃 별 다섯
        sc.at(TPOP, () => {
            const [x2, y2] = tgt();
            impactFrames(sc, W, H, 0.45, 0.3);
            ultShake(5 + 2 * P, 450);
            ring(sc, x2, y2, me.w * 0.3, me.w * 2.8, 0.8, 0.45, ['#ffffff', MAG[2], F[2]], 3);
            sparkles(x2, y2, s, MAG, 16, me.w, 20);
            if (q) {
                hit(where(u, q), dir, 'tumble', 0);
            }
            for (const r of u.others()) {
                if ((!q || r.pokemon !== q.pokemon) && Math.abs(r.x - x2) < me.w * 2) {
                    hit(r, Math.sign(r.x - x2) || dir, 'shake');
                }
            }
        });
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            const k = life - TPOP;
            if (k <= 0 || k > 1.1) {
                return;
            }
            const [x2, y2] = tgt();
            const sr = Math.max(3 * s, me.w * 0.3);
            for (let i = 0; i < 5; i++) {
                const a = -Math.PI / 2 + (i * TAU) / 5;
                const d = Math.max(me.w * 2.2, H * 0.22) * easeOut(Math.min(1, k * 1.6));
                const x = x2 + Math.cos(a) * d;
                // 게임 화면 — 위로 튄 별은 연출 위 끝 아래에서 멈춤 (#107)
                const y = Math.max(y2 + Math.sin(a) * d * 0.8 + H * 0.3 * k * k, gameTop() > 0 ? gameTop() + sr + 2 * s : -Infinity);
                starOutline(ctx, px, s, x, y, sr, k * 5 + i, 1, F, 1 - clamp((k - 0.7) / 0.4, 0, 1));
            }
        } });
    }

    // ═════ 개구마르 — 물의파동 (ultorb) ═════
    // 목의 거품(개굴거품)을 모아 뭉실뭉실한 거품 공을 만듦 → 공을 통통 튀기며 상대에게 굴려 보냄(튈 때마다 거품이 퐁)
    // → 상대에게 철썩 — 물보라 고리가 퍼지고 거품이 사방으로 톡톡 터짐 (약 4.6초)
    UNIQ.froakie = { fx: 'ultorb', ms: (P) => 4600 + 200 * P, run: runFroakieBubble };
    function runFroakieBubble(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TIDE = K.pal.TIDE;
        const FOAM = ['#ffffff', '#eaf8ff', '#bfe9ff', '#7fbfe0'];
        const neck = [me.x + dir * me.w * 0.05, me.b - me.h * 0.45];
        const TG = 0.25;
        const TBALL = 1.3;
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * Math.min(W * 0.4, me.w * 5 + 40), W * 0.1, W * 0.9);
        const dd = Math.sign(tx - me.x) || dir;
        const Rb = Math.max(me.w * 0.42, 6 * s);
        const NBNC = 3;
        const bx = [me.x + dd * me.w * 0.4];
        for (let i = 1; i <= NBNC; i++) {
            bx.push(lerp(bx[0], tx, i / NBNC));
        }
        const bounceT = 0.42;
        const THIT = TBALL + 0.2 + NBNC * bounceT;
        const ballAt = (t) => {
            if (t < TBALL + 0.2) {
                const k = clamp((t - TG) / (TBALL - TG), 0, 1);
                return [lerp(neck[0], bx[0], clamp((t - TBALL) / 0.2, 0, 1)), lerp(neck[1], G - Rb, clamp((t - TBALL) / 0.2, 0, 1)) - (1 - k) * 0, k];
            }
            const i = Math.min(NBNC - 1, Math.floor((t - TBALL - 0.2) / bounceT));
            const k = clamp((t - TBALL - 0.2 - i * bounceT) / bounceT, 0, 1);
            const hgt = Math.min(H * 0.3, me.h * 2.2) * (1 - i * 0.25);
            return [lerp(bx[i], bx[i + 1], k), G - Rb - 4 * hgt * k * (1 - k), 1];
        };
        const sc = scene(u, sec + 0.3, 'uniq froakie');
        ultDark(0.3, ms - 200);
        puppet(sc, pokemon, u, (t) => me.b - (t > TBALL - 0.1 && t < TBALL + 0.1 ? s * 2 : 0), TIDE[2], sec - 0.1, { glow: () => 0 });
        // 거품 공 — 뭉실뭉실 작은 거품 덩이
        const blobs = [];
        for (let i = 0; i < 12; i++) {
            blobs.push({ a: hash(i, 211) * TAU, d: 0.35 + 0.45 * hash(i, 212), r: 0.35 + 0.3 * hash(i, 213) });
        }
        sc.add({ max: THIT + 0.05, draw: (ctx, it, t, px) => {
            const life = sc.t;
            if (life < TG) {
                return;
            }
            const [x, y, k] = ballAt(life);
            const R = Rb * (0.3 + 0.7 * easeOut(k));
            const squash = life > TBALL + 0.2 && y > G - Rb * 1.2 ? 0.8 : 1;
            for (const b of blobs) {
                const a = b.a + life * 2;
                const cx = x + Math.cos(a) * R * b.d;
                const cy = y + Math.sin(a) * R * b.d * squash;
                ellipse(ctx, px, s, cx, cy, R * b.r + s, R * b.r * squash + s, FOAM[3], 0.9);
                ellipse(ctx, px, s, cx, cy, R * b.r, R * b.r * squash, FOAM[2], 0.9);
                ctx.globalAlpha = 1;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(px(cx - R * b.r * 0.4), px(cy - R * b.r * 0.45), s, s);
            }
            ellipse(ctx, px, s, x - R * 0.1, y - R * 0.1, R * 0.45, R * 0.4 * squash, FOAM[1], 0.9);
            jointOrb(o, ctx, x, y, R, life < TBALL, life >= TBALL);
        } });
        // 목에서 거품이 모여듦
        let pull = 0;
        sc.tick((t, dt) => {
            if (t < TG || t > TBALL) {
                return;
            }
            pull += dt * 20;
            while (pull >= 1 && room(1)) {
                pull -= 1;
                const x0 = neck[0] + rnd(-1, 1) * me.w * 0.5;
                const y0 = neck[1] + rnd(-0.3, 0.6) * me.h * 0.5;
                const [x1, y1] = ballAt(t);
                sigParticle({ x: x0, y: y0, x0, y0, x1, y1, s, max: 0.3,
                    update: (d) => {
                        const f = Math.min(1, (d.life / d.max) ** 2);
                        d.x = d.x0 + (d.x1 - d.x0) * f;
                        d.y = d.y0 + (d.y1 - d.y0) * f;
                    },
                    draw: (ctx, d, tt, px) => {
                        ctx.globalAlpha = 1;
                        ctx.fillStyle = FOAM[tt < 0.5 ? 0 : 2];
                        ctx.fillRect(px(d.x), px(d.y), s, s);
                    },
                });
            }
        });
        for (let i = 1; i < NBNC; i++) {
            sc.at(TBALL + 0.2 + i * bounceT, () => {
                const x = bx[i];
                ring(sc, x, G - s, Rb * 0.6, Rb * 2.4, 0.25, 0.3, [FOAM[0], FOAM[2]], 1);
                K.splash(x, G - s, s, FOAM, 6, H * 0.3, { spread: 1.6, life: 0.4 });
                ultShake(1.5, 90);
            });
        }
        sc.at(TBALL + 0.2, () => K.splash(bx[0], G - s, s, FOAM, 5, H * 0.25, { spread: 1.4, life: 0.4 }));
        sc.at(THIT, () => {
            jointOrb(o);
            impactFrames(sc, W, H, 0.45, 0.3);
            ultShake(4 + 2 * P, 400);
            ring(sc, tx, G - Rb, Rb * 0.5, Rb * 4, 0.6, 0.45, ['#ffffff', TIDE[1], TIDE[2]], 3);
            K.crownSplash(sc, tx, G, Math.max(Rb * 1.6, me.w), 0.9, TIDE);
            if (q) {
                hit(where(u, q), dd, 'tumble', 0);
            }
            for (const r of u.others()) {
                if ((!q || r.pokemon !== q.pokemon) && Math.abs(r.x - tx) < Rb * 3) {
                    hit(r, Math.sign(r.x - tx) || dd, 'shake');
                }
            }
        });
        // 사방으로 톡톡 터지는 거품
        const pops = [];
        for (let i = 0; i < 14; i++) {
            const a = (i / 14) * TAU;
            pops.push({ a, d: Rb * (1.5 + 2 * hash(i, 221)), t: THIT + 0.15 + hash(i, 222) * 0.8, r: Math.max(2 * s, Rb * (0.25 + 0.2 * hash(i, 223))) });
        }
        sc.add({ max: sec, draw: (ctx, it, t, px) => {
            const life = sc.t;
            for (const p of pops) {
                const k = (life - THIT) / (p.t - THIT);
                if (k <= 0 || k >= 1) {
                    continue;
                }
                const x = tx + Math.cos(p.a) * p.d * easeOut(k);
                const y = G - Rb - Math.abs(Math.sin(p.a)) * p.d * easeOut(k) * 0.8;
                K.ringDots(ctx, px, s, x, y, p.r, 1, [FOAM[0], FOAM[2]], 0.9, 1);
            }
        } });
        pops.forEach((p) => sc.at(p.t, () => {
            const x = tx + Math.cos(p.a) * p.d;
            const y = G - Rb - Math.abs(Math.sin(p.a)) * p.d * 0.8;
            ring(sc, x, y, p.r * 0.5, p.r * 2, 1, 0.18, ['#ffffff', FOAM[2]], 1);
            sparkles(x, y, s, [FOAM[0], TIDE[1]], 2, p.r, 6);
        }));
    }

    // ═════ 개굴반장 — 물수리검 (ultswarm) ═════
    // 몸을 낮췄다 하늘 높이 폴짝 · 꼭대기에서 몸을 비틀며 작은 물수리검을 부채꼴로 우수수 흩뿌림(빙글빙글 날아가 땅 곳곳에 꽂힘)
    // → 착지해 손가락을 탁 — 꽂힌 물수리검이 한꺼번에 물기둥으로 촥 터짐(닿은 애 벌러덩) (약 5.6초)
    UNIQ.frogadier = { fx: 'ultswarm', ms: (P) => 5600 + 200 * P, run: runFrogadierShuriken };
    function runFrogadierShuriken(u, o, ms, pokemon) {
        const P = strength(u);
        const sec = ms / 1000;
        const { W, H, S: s, dir } = u;
        const G = u.ground;
        const hit = makeHit();
        const me = monBox(pokemon);
        const TIDE = K.pal.TIDE;
        const TC = 0.3;
        const TJ = 0.8;
        const TTOP = TJ + 0.5;
        const TTHROW = TTOP + 0.05;
        const TLAND = TTOP + 0.9;
        const TSNAP = TLAND + 0.45;
        const q = nearest(u);
        const tx = clamp(q ? q.x : me.x + dir * Math.min(W * 0.4, me.w * 5 + 40), W * 0.12, W * 0.88);
        // 꼭대기 (발) — 몸 위 끝이 연출 위 끝 + 4칸 아래 (뛰어올라 던지는 순간이 정보줄 뒤로 숨던 것 — #105) · 그래도 몸 키 × 0.35 는 뜀 (땅 속으로 뛰지 않게)
        const top0 = gameTop();
        const topY = Math.min(me.b - me.h * 0.35, Math.max(me.b - Math.min(H * 0.55, G * 0.65), top0 > 0 ? top0 + me.h + 4 * s : -Infinity));
        const NS = 11;
        const sh = [];
        for (let i = 0; i < NS; i++) {
            const x1 = i === Math.floor(NS / 2) && q ? q.x : clamp(tx + (i - (NS - 1) / 2) * Math.max(W * 0.06, me.w * 0.7) + (hash(i, 231) - 0.5) * me.w * 0.4, W * 0.04, W * 0.96);
            sh.push({ x1, t0: TTHROW + Math.abs(i - (NS - 1) / 2) * 0.03, fly: 0.45 + 0.1 * hash(i, 232) });
        }
        const footAt = (t) => {
            if (t > TJ && t < TLAND) {
                const k = (t - TJ) / (TLAND - TJ);
                return me.b - (me.b - topY) * Math.sin(k * Math.PI);
            }
            return me.b - (t > TC && t < TJ ? -s : 0);
        };
        const r = Math.max(me.w * 0.22, 3.5 * s);
        const sc = scene(u, sec + 0.3, 'uniq frogadier');
        ultDark(0.34, ms - 200);
        puppet(sc, pokemon, u, footAt, TIDE[2], sec - 0.1, {
            rot: (t) => (t > TTOP - 0.15 && t < TTOP + 0.3 ? dir * TAU * easeOut((t - TTOP + 0.15) / 0.45) : 0),
            scale: (t) => (t > TC && t < TJ ? 0.92 : 1),
            glow: (t) => (t > TSNAP - 0.05 && t < TSNAP + 0.15 ? 0.6 : 0),
            glowColor: '#ffffff',
        });
        // 물수리검 — 날아감 → 꽂혀 있음
        sc.add({ max: TSNAP + 0.05, draw: (ctx, it, t, px) => {
            const life = sc.t;
            for (const p of sh) {
                const k = (life - p.t0) / p.fly;
                if (k < 0) {
                    continue;
                }
                const x0 = me.x;
                const y0 = topY - me.h * 0.5;
                if (k < 1) {
                    stShuriken(ctx, px, s, lerp(x0, p.x1, k), lerp(y0, G - r * 0.5, k * k), r, life * 25, TIDE, 1);
                } else if (life < TSNAP) {
                    // 꽂힘 — 반쯤 땅에 박혀 떨림
                    stShuriken(ctx, px, s, p.x1 + Math.sin(life * 40) * s * 0.3 * (k < 1.3 ? 1 : 0), G - r * 0.4, r, 0.4, TIDE, 1);
                }
            }
        } });
        sc.at(TJ, () => {
            K.puff(me.x, G - s, s, '#8a7252', s * 2, me.w * 0.7, 0.4, 0, -10, 0.45);
            K.splash(me.x, G - s, s, TIDE, 8, H * 0.3, { spread: 1.4 });
        });
        sc.at(TTHROW, () => {
            ring(sc, me.x, topY - me.h * 0.5, s * 2, me.w * 1.6, 0.9, 0.3, ['#ffffff', TIDE[1]], 2);
            ultShake(2, 120);
        });
        sh.forEach((p, i) => sc.at(p.t0 + p.fly, () => {
            K.splash(p.x1, G - s, s, TIDE, 3, H * 0.2, { spread: 1.4, life: 0.35 });
            if (i % 3 === 0) {
                ultShake(1, 60);
            }
        }));
        sc.at(TLAND, () => K.puff(me.x, G - s, s, '#8a7252', s * 2, me.w * 0.6, 0.4, 0, -10, 0.4));
        // 손가락 탁 — 한꺼번에 물기둥
        sc.at(TSNAP, () => {
            ring(sc, me.x + dir * me.w * 0.3, me.b - me.h * 0.6, s, me.w * 0.9, 0.9, 0.2, ['#ffffff', TIDE[1]], 1);
            impactFrames(sc, W, H, 0.5, 0.35);
            ultShake(6 + 2 * P, 550);
            for (const p of sh) {
                K.geyser(sc, p.x1, G, Math.max(r * 1.1, 3 * s), Math.min(G * 0.7, H * 0.4) * (0.75 + 0.25 * hash(p.x1, 3)), 1.0, TIDE);
            }
            for (const r2 of u.others()) {
                if (sh.some((p) => Math.abs(r2.x - p.x1) < me.w * 0.7)) {
                    hit(r2, Math.sign(r2.x - me.x) || dir, 'tumble', 0);
                }
            }
        });
    }

    // ═════ 스타팅 최종 진화 마무리 (공통 빛의 반구 대신 저마다 — 2026-10-19 태현 님) ═════
    // 불기둥이 모여 하나로 — 양옆 불기둥이 가운데로 기울며 다가와 합쳐지고 가운데 거대한 불기둥이 화면 위까지
    function stMergePillar(sc, x, G, w, d0, dur, cols) {
        const { S: s, H } = sc.u;
        sc.add({ max: dur, draw: (ctx, it, t, px) => {
            const k = it.life;
            const m = easeIn(clamp(k / 0.45, 0, 1));
            const fade = clamp((dur - k) / 0.5, 0, 1);
            if (m < 1) {
                for (const sd of [-1, 1]) {
                    const d = d0 * (1 - m);
                    K.flameTongue(ctx, px, s, x + sd * d, G + s, w * 0.8, H * (0.55 + 0.25 * m), cols, k + sd, 1 - m * 0.5, -sd * 0.5 * (1 - m), fade);
                }
            }
            const grow = easeOut(clamp((k - 0.3) / 0.35, 0, 1));
            K.flameTongue(ctx, px, s, x, G + s, w * (1 + 1.4 * grow), H * 1.25 * grow, cols, k * 1.2, grow, 0, fade);
            K.flameTongue(ctx, px, s, x, G + s, w * (0.5 + 0.7 * grow), H * 0.9 * grow, cols, k * 1.7 + 3, grow, 0, fade);
        } });
    }
    // 땅 불길 띠 — x 에서 양옆으로 번지다 사그라듦
    function stGroundBlaze(sc, x, G, spread, h, dur, cols) {
        const { S: s, W } = sc.u;
        sc.add({ max: dur, draw: (ctx, it, t, px) => {
            const k = it.life;
            const r = spread * easeOut(clamp(k / 0.6, 0, 1));
            K.groundFlames(ctx, px, s, Math.max(0, x - r), Math.min(W, x + r), G, h, k, cols, clamp((dur - k) / 0.6, 0, 1));
        } });
    }
    // 줄줄이 폭발 — x 에서 양옆으로 땅을 따라 차례로 펑펑 (n 개씩)
    function stLineBlasts(sc, x, G, gap, n, t0, cols, R) {
        const { S: s, W, H } = sc.u;
        for (let i = 0; i < n; i++) {
            for (const sd of [-1, 1]) {
                const bx = x + sd * (i + 1) * gap;
                if (bx < s * 4 || bx > W - s * 4) {
                    continue;
                }
                sc.at(t0 + i * 0.12, () => {
                    sc.add({ max: 0.5, draw: (ctx, it, t, px) => fireOrb(ctx, px, s, bx, G - R * 0.6, R * (0.5 + 0.8 * easeOut(Math.min(1, it.life * 4))), cols, it.life, 1, G, 1 - t, t, [1, 0.8, 0.6, 0.38], 0.6) });
                    fireBits(bx, G - R, s, cols, 8, { angle: -Math.PI / 2, spread: 1.8, speed: H * 0.5, g: H, life: 0.6 });
                    ultShake(2 + i * 0.4, 120);
                });
            }
        }
    }
    // 불꽃 왕관 — (x, y) 둘레로 불꽃 혀 일곱이 왕관처럼 솟아 이글
    function stFlameCrown(sc, x, y, R, dur, cols) {
        const { S: s } = sc.u;
        sc.add({ max: dur, draw: (ctx, it, t, px) => {
            const k = easeOut(clamp(it.life / 0.4, 0, 1));
            const fade = clamp((dur - it.life) / 0.5, 0, 1);
            for (let i = 0; i < 7; i++) {
                const f = i / 6;
                const cx = x + (f - 0.5) * 2 * R;
                const tall = R * (0.9 + 0.6 * Math.sin(f * Math.PI)) * (i % 2 ? 0.8 : 1);
                K.flameTongue(ctx, px, s, cx, y + Math.abs(f - 0.5) * R * 0.5, R * 0.45, tall, cols, it.life + i, k, (f - 0.5) * 0.6, fade);
            }
            K.ringDots(ctx, px, s, x, y + R * 0.2, R * 1.05, 0.25, [cols[1], cols[2]], k * fade, 2);
        } });
    }
    // 용암 고리 — 땅에 둥근 용암 띠가 번져 이글이글 · 거품이 톡톡
    function stLavaRing(sc, x, G, R, dur) {
        const { S: s } = sc.u;
        const LAVA = ['#fff3a0', '#ff9a2a', '#d0301a', '#5a1a10'];
        sc.add({ max: dur, draw: (ctx, it, t, px) => {
            const k = easeOut(clamp(it.life / 0.5, 0, 1));
            const fade = clamp((dur - it.life) / 0.6, 0, 1);
            const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
            const n = Math.round(R * 2 * Math.PI / (s * 2));
            for (let i = 0; i < n; i++) {
                const a = (i / n) * TAU;
                const rr = R * k * (1 + 0.04 * Math.sin(a * 5 + it.life * 3));
                const cx = x + Math.cos(a) * rr;
                const cy = G + Math.sin(a) * rr * 0.2;
                const w = 3 + Math.round(2 * Math.sin(a * 3 + it.life * 4));
                for (let j = 0; j < w; j++) {
                    paths[j === 0 || j === w - 1 ? 3 : j === 1 ? 2 : (i + Math.floor(it.life * 8)) % 5 === 0 ? 0 : 1].rect(px(cx), px(cy - (j - w / 2) * s), 2 * s, s);
                }
            }
            K.fillPaths(ctx, paths, [LAVA[0], LAVA[1], LAVA[2], LAVA[3]], fade);
            for (let j = 0; j < 8; j++) {
                const cyc = (it.life * (0.9 + hash(j, 241) * 0.5) + hash(j, 242)) % 1;
                const a = hash(j, 243) * TAU;
                K.ringDots(ctx, px, s, x + Math.cos(a) * R * k, G + Math.sin(a) * R * k * 0.2 - s * 2 - cyc * s * 4, s * (1 + 2 * cyc), 1, [LAVA[0], LAVA[1]], fade * (1 - cyc), 1);
            }
        } });
    }
    // 가시 폭발 — x 땅에서 굵은 가시가 부채꼴로 솟구쳐 튀었다 떨어짐
    function stSpikeBurst(sc, x, G, len, n) {
        const { S: s, H } = sc.u;
        const sp = [];
        for (let i = 0; i < n; i++) {
            const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 2.6;
            sp.push({ a, v: H * (0.9 + 0.5 * hash(i, 251)), len: len * (0.7 + 0.5 * hash(i, 252)) });
        }
        sc.add({ max: 1.6, draw: (ctx, it, t, px) => {
            const k = it.life;
            const list = [];
            for (const p of sp) {
                const vx = Math.cos(p.a) * p.v;
                const vy = Math.sin(p.a) * p.v;
                const xx = x + vx * k;
                const yy = G - s * 2 + vy * k + H * 1.4 * k * k;
                if (yy > G + s * 4) {
                    continue;
                }
                const ang = Math.atan2(vy + H * 2.8 * k, vx);
                list.push({ x: xx, y: yy, len: p.len, ang });
            }
            // 굵은 가시 — 테두리 · 몸(두 칸) · 하얀 끝
            const a = clamp((1.6 - k) / 0.4, 0, 1);
            const paths = [new Path2D(), new Path2D(), new Path2D()];
            for (const n of list) {
                const pts = [[n.x, n.y], [n.x - Math.cos(n.ang) * n.len, n.y - Math.sin(n.ang) * n.len]];
                K.addLine(paths[0], px, s, pts, 4);
                K.addLine(paths[1], px, s, pts, 2);
                K.addLine(paths[2], px, s, [pts[0], [n.x - Math.cos(n.ang) * s * 3, n.y - Math.sin(n.ang) * s * 3]], 2);
            }
            K.fillPaths(ctx, paths, [ST_NEEDLE[3], ST_NEEDLE[1], '#ffffff'], a);
        } });
    }
    // 떠오르는 마법진 → 불비 — 땅의 불꽃 마법진(동그라미 둘 · 별)이 돌며 하늘로 올라가 터지고 불씨 비가 내림
    function stMagicRise(sc, x, G, R, dur, cols) {
        const { S: s, W, H } = sc.u;
        const TOP = Math.max(R * 0.6, H * 0.18);
        const T1 = 0.9;
        sc.add({ max: T1 + 0.1, draw: (ctx, it, t, px) => {
            const k = it.life / T1;
            const y = lerp(G - s * 2, TOP, easeIn(k));
            const flat = lerp(0.25, 0.4, k);
            const a = 1 - clamp((k - 0.85) / 0.15, 0, 1);
            K.ringDots(ctx, px, s, x, y, R, flat, [cols[0], cols[2]], a, 2);
            K.ringDots(ctx, px, s, x, y, R * 0.72, flat, [cols[1], cols[2]], a, 1);
            starOutline(ctx, px, s, x, y, R * 0.68, it.life * 3, 1, cols, flat);
        } });
        sc.at(T1, () => {
            ring(sc, x, TOP, R * 0.4, R * 2.2, 0.5, 0.45, ['#ffffff', cols[1], cols[2]], 3);
            fireBits(x, TOP, s, cols, 26, { speed: H * 0.6, life: 0.7 });
            ultShake(5, 400);
        });
        const NF = Math.round(26 * clamp(W / 480, 0.7, 2));
        const drops = [];
        for (let i = 0; i < NF; i++) {
            drops.push({ x: clamp(x + (hash(i, 261) - 0.5) * W * 0.9, s * 2, W - s * 2), t0: T1 + 0.1 + hash(i, 262) * (dur - T1 - 0.9), fall: 0.55 + 0.2 * hash(i, 263) });
        }
        sc.add({ max: dur, draw: (ctx, it, t, px) => {
            for (const d of drops) {
                const k = (it.life - d.t0) / d.fall;
                if (k < 0 || k >= 1) {
                    continue;
                }
                const y = lerp(TOP * 0.5, G - s, k * k);
                K.fireTail(ctx, px, s, d.x, y, 0.15, 1, s * 7, s * 3, cols, it.life + d.x, 1);
            }
        } });
        drops.forEach((d) => sc.at(d.t0 + d.fall, () => fireBits(d.x, G - s * 2, s, cols, 3, { angle: -Math.PI / 2, spread: 1.4, speed: H * 0.25, life: 0.4 })));
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
