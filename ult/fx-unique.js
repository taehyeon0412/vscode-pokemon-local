// ───── 전용 필살기 — 인기 · 전설 포켓몬 (2026-10-19 태현 님: 모든 포켓몬 필살기를 리자몽 · 거북왕처럼) ─────
// 데이터 옵션 uniq: '<이름>' 이면 그 틀(fx) 대신 여기 연출 — 틀 이름이 그대로라 필살기 대결 모양도 그대로.
// 그리기 도구는 fx-sky.js 가 ULT_KIT 으로 내줌 (장면 · 꼭두각시 · 불꽃 구 · 빛의 반구 · 번개 …). 이 파일은 fx-sky.js 다음에 붙음 (이름 순)
(() => {
    const K = ULT_KIT;
    const { TAU, rnd, pick, clamp, lerp, easeOut, easeIn, hash, room, strength, short, away, where, makeHit, nearest, scene, jag, drawBolt, ellipse, ring,
        strike, groundArcs, debris, sparkles, skyBand, cloudBank, drawMon, drawLitMon, monBox, hideMon, hideUntil, glint, fireOrb, chargeSwirl, blastDome,
        fireBits, emberRise, impactFrames } = K;
    const { ZAPC } = K.pal;
    const hsl = (h, l = 60) => `hsl(${Math.round(((h % 360) + 360) % 360)}, 100%, ${l}%)`;
    const UNIQ = {}; // 이름 → { fx, ms(P, o), run(u, o, ms, pokemon) }

    // 꼭두각시 — 진짜 그림을 숨기고 footAt(t) 높이에 테두리 두른 그림. until 초까지 (그 뒤 진짜 그림이 다시 보임)
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
            const x = me.x + (extra?.dx?.(life) ?? 0);
            drawLitMon(ctx, img, x, footAt(life), me.w, u.dir < 0, edgeColor, edge, 1);
            const glow = extra?.glow?.(life) ?? 0;
            if (glow > 0.01) {
                drawMon(ctx, img, x, footAt(life), me.w, u.dir < 0, glow, extra?.glowColor ?? '#ffffff');
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
