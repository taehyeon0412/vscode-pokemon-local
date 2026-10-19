// ───── 기술이 맞는 순간 — 타입마다 · 기술마다 다른 도트 임팩트 (2026-10-19 태현 님 "일반 기술이 밋밋해 보는 맛이 없어 · 불꽃회오리 같은 스타일 · 도트 방식 · 불꽃이든 얼음이든 다양한 방식으로") ─────
// sigImpact (8줄 별) 는 필살기 · 대결도 같이 써서 그대로 두고, 기술 (게임 전투 ult/bridge.js impact) 은 이것을 씀.
// 모양 틀 8가지 (회오리 · 폭발 · 기둥 · 분수 · 떨어짐 · 솟음 · 감돌기 · 갈래 번개) × 타입 조각 (불꽃 혀 · 물방울 · 잎 · 결정 · 돌 · 깃털 · 반짝이 · 거품 …).
// 타입마다 2 ~ 3 가지 짜임이 있고 기술 이름으로 고름 → 같은 불꽃 기술이라도 기술마다 다른 임팩트. 모두 그림 1칸 (s) 도트, 0.1초 동안 계속 뿜어 빽빽하게 (회오리불꽃처럼)
// typeImpact(x, y, s, type, P, big, dir, w, pick): x · y = 맞는 곳 가운데, P = 쓰는 포켓몬 세기, big = 센 기술, dir = 맞는 방향 (+1 오른쪽), w = 맞는 포켓몬 폭, pick = 기술 이름 숫자 (짜임 고르기)

const hitLerp = (a, b, k) => a + (b - a) * k;
const hitFade = (t, a = 0.08, b = 0.3) => fadeInOut(t, a, b);
// 문자열 → 숫자 (기술 이름으로 짜임 고르기)
const hitHash = (text) => {
    let h = 7;
    for (const ch of String(text || '')) {
        h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    }
    return h;
};

// ── 조각 하나 그리기 — 타입마다 다른 도트 모양 (cols = 4색, k = 진행 0 ~ 1, big = 크게)
function hitBit(ctx, px, s, x, y, shape, cols, k, big, dir = 1) {
    const c = (i) => cols[Math.min(3, Math.max(0, i))];
    switch (shape) {
        case 'flame': {
            // 불꽃 혀 — 아래 밝고 위로 갈수록 붉게 가늘어짐 (흔들림)
            const h = big ? 5 : 4;
            const wob = Math.round(Math.sin(x * 0.7 + k * 20));
            for (let j = 0; j < h; j++) {
                const wj = j === 0 ? (big ? 2 : 1) : 1;
                dotAt(ctx, px, s, x + (j === h - 1 ? wob * s : 0), y - j * s, c(Math.round(k * 2) + j), wj, 1);
            }
            break;
        }
        case 'drop':
            dotAt(ctx, px, s, x, y, c(1), 1, big ? 2 : 1);
            dotAt(ctx, px, s, x, y - s, '#ffffff');
            break;
        case 'leaf': {
            const flat = Math.floor(k * 12) % 2 === 0;
            dotAt(ctx, px, s, x, y, c(1), flat ? 2 : 1, flat ? 1 : 2);
            dotAt(ctx, px, s, x + (flat ? 2 : 1) * s, y, c(3));
            break;
        }
        case 'shard':
            // 얼음 결정 — 가운데 흰 마름모 + 끝 진하게
            dotAt(ctx, px, s, x, y - s, c(1));
            dotAt(ctx, px, s, x - s, y, c(2));
            dotAt(ctx, px, s, x, y, '#ffffff');
            dotAt(ctx, px, s, x + s, y, c(2));
            dotAt(ctx, px, s, x, y + s, c(3));
            break;
        case 'rock':
            for (let dy = 0; dy < (big ? 3 : 2); dy++) {
                for (let dx = 0; dx < (big ? 3 : 2); dx++) {
                    dotAt(ctx, px, s, x + dx * s, y + dy * s, dx + dy === 0 ? c(0) : c(2 + ((dx + dy) % 2)));
                }
            }
            break;
        case 'feather':
            for (let j = 0; j < 3; j++) {
                dotAt(ctx, px, s, x + j * s * dir, y - j * s, j === 1 ? c(0) : c(2));
            }
            break;
        case 'sparkle':
            dotAt(ctx, px, s, x, y, '#ffffff');
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                dotAt(ctx, px, s, x + dx * s, y + dy * s, c(1 + (Math.floor(k * 10) % 2)));
            }
            if (big) {
                for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
                    dotAt(ctx, px, s, x + dx * s, y + dy * s, c(2));
                }
            }
            break;
        case 'bubble': {
            const r = big ? 2 : 1;
            for (const [dx, dy] of [[-r, 0], [r, 0], [0, -r], [0, r]]) {
                dotAt(ctx, px, s, x + dx * s, y + dy * s, c(2));
            }
            dotAt(ctx, px, s, x - s, y - s, '#ffffff');
            break;
        }
        case 'heart':
            drawGlyph(ctx, px, s, x - 2 * s, y - 2 * s, GLYPHS.heart, c(2));
            break;
        case 'star':
            dotAt(ctx, px, s, x - s, y - s, c(0), 3, 3);
            for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
                dotAt(ctx, px, s, x + dx * s, y + dy * s, c(2));
            }
            break;
        default:
            dotAt(ctx, px, s, x, y, c(Math.round(k * 3)), big ? 2 : 1, big ? 2 : 1);
    }
}

// 바닥 빛 — 맞는 포켓몬 발밑에서 도는 점 고리 (모든 짜임 아래)
function hitGlow(x, ground, s, R, cols, sec) {
    sigParticle({ x, y: ground, s, max: sec, R, cols, draw: (ctx, p, t, px) => {
        ctx.globalAlpha = hitFade(t, 0.12, 0.35) * (0.55 + 0.45 * Math.abs(Math.sin(p.life * 14)));
        const dots = 20;
        for (let j = 0; j < dots; j++) {
            const a = (j / dots) * Math.PI * 2 + p.life * 5;
            dotAt(ctx, px, p.s, p.x + Math.cos(a) * p.R * 0.95, p.y + Math.sin(a) * p.s * 2.5, p.cols[j % 2 ? 1 : 2]);
        }
    } });
}

// 가운데 흰 번쩍 — 마름모로 확 (아주 짧게)
function hitCore(x, y, s, R, cols) {
    sigParticle({ x, y, s, max: 0.16, R, cols, draw: (ctx, p, t, px) => {
        ctx.globalAlpha = 1 - t;
        const r = Math.max(2, Math.round((p.R / p.s) * (0.3 + 0.55 * t)));
        for (let j = -r; j <= r; j++) {
            const half = r - Math.abs(j);
            dotAt(ctx, px, p.s, p.x - half * p.s, p.y + j * p.s, t < 0.45 ? '#ffffff' : p.cols[0], 2 * half + 1, 1);
        }
    } });
}

// ── 짜임 1: 회오리 — 두 줄 나선 띠가 몸을 감고 + 조각이 돌며 피어오름 (회오리불꽃 · 물기둥 · 잎 소용돌이 · 눈보라 · 회오리바람 · 모래 회오리)
function hitHelix(x, ground, s, R, H, cols, shape, sec, spin, big) {
    const rTop = R * 1.25;
    const rBottom = R * 0.3;
    sigParticle({ x, y: ground, s, max: sec, draw: (ctx, p, t, px) => {
        const grow = Math.min(1, p.life / 0.18);
        const top = H * grow * (t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1);
        for (let strand = 0; strand < 3; strand++) {
            for (let h = 0; h < top; h += p.s) {
                const frac = h / H;
                const r = hitLerp(rBottom, rTop, frac);
                const th = (strand * Math.PI * 2) / 3 + frac * 7 + p.life * spin;
                const front = Math.sin(th) > 0;
                ctx.globalAlpha = (front ? 1 : 0.4) * hitFade(t, 0.04, 0.25);
                // 앞 줄은 굵게 (2칸) + 밝은 심, 뒤 줄은 가늘고 흐리게 — 몸을 감는 느낌
                dotAt(ctx, px, p.s, p.x + Math.cos(th) * r, p.y - h + Math.sin(th) * r * 0.15, cols[Math.min(3, 1 + Math.floor(frac * 3))], front ? 2 : 1, front ? 2 : 1);
                if (front && strand === 0) {
                    dotAt(ctx, px, p.s, p.x + Math.cos(th) * r, p.y - h + Math.sin(th) * r * 0.15, frac < 0.4 ? '#ffffff' : cols[0]);
                }
            }
        }
    } });
    const until = performance.now() + sec * 1000 - 200;
    sigEmitter({ until, rate: big ? 240 : 170, fx: () => {
        sigParticle({ x, y: ground, s, max: moveRand(0.4, 0.7), th: moveRand(0, Math.PI * 2), h: moveRand(0, 0.15) * H, rise: moveRand(1.4, 2) * H, cols, shape, big,
            update: (p, dt) => {
                p.th += spin * dt;
                p.h += p.rise * dt;
                p.frac = Math.min(1, p.h / H);
                const r = hitLerp(rBottom, rTop, p.frac);
                p.depth = Math.sin(p.th);
                p.x = x + Math.cos(p.th) * r;
                p.y = ground - p.h + p.depth * r * 0.15;
            },
            draw: (ctx, p, t, px) => {
                if (p.frac === undefined) {
                    return;
                }
                ctx.globalAlpha = (p.depth > 0 ? 1 : 0.5) * hitFade(t, 0.1, 0.35) * (p.frac > 0.85 ? (1 - p.frac) / 0.15 : 1);
                hitBit(ctx, px, p.s, p.x, p.y, p.shape, p.cols, p.frac, p.big && p.depth > 0);
            },
        });
    } });
}

// ── 짜임 2: 폭발 — 가운데에서 조각이 사방으로 터지며 퍼지고 (계속 뿜어 빽빽) 끝에 고리
function hitBloom(x, y, s, R, cols, shape, sec, big, opt = {}) {
    const until = performance.now() + Math.min(300, sec * 400);
    sigEmitter({ until, rate: big ? 300 : 220, fx: () => {
        const a = moveRand(0, Math.PI * 2);
        const v = moveRand(1, 1.8) * R * 4.2;
        sigParticle({ x, y, s, vx: Math.cos(a) * v, vy: Math.sin(a) * v * (opt.flat ?? 0.85), g: (opt.g ?? 30) * s, drag: opt.drag ?? 3.2, max: moveRand(0.45, 0.75) * (sec / 0.7), cols, shape, big: Math.random() < (big ? 0.6 : 0.35), draw: (ctx, p, t, px) => {
            ctx.globalAlpha = hitFade(t, 0.05, 0.4);
            hitBit(ctx, px, p.s, p.x, p.y, p.shape, p.cols, t, p.big);
        } });
    } });
    sigRing(x, y, s, R * 0.4, R * 2, opt.ringFlat ?? 0.8, 0.5, [cols[0], cols[2], cols[1]]);
    setTimeout(() => sigRing(x, y, s, R * 0.3, R * 1.5, opt.ringFlat ?? 0.8, 0.4, [cols[1], cols[3]]), 120);
}

// ── 짜임 3: 기둥 — 발밑에서 위로 솟구치는 기둥 (불기둥 · 물기둥 · 빛기둥)
function hitPillar(x, ground, s, R, H, cols, shape, sec, big) {
    sigParticle({ x, y: ground, s, max: sec, R, H, cols, draw: (ctx, p, t, px) => {
        const grow = Math.min(1, p.life / 0.15);
        const fade = t > 0.65 ? (1 - t) / 0.35 : 1;
        const half = Math.max(2, Math.round((p.R / p.s) * 0.55 * fade));
        const top = p.H * grow;
        for (let h = 0; h < top; h += p.s) {
            const frac = h / p.H;
            const wob = Math.round(Math.sin(h * 0.35 + p.life * 30) * 0.8);
            const hw = Math.max(1, Math.round(half * (1 - frac * 0.55)));
            ctx.globalAlpha = 0.9 * fade;
            dotAt(ctx, px, p.s, p.x + (wob - hw) * p.s, p.y - h, p.cols[Math.min(3, 1 + Math.floor(frac * 3))], 2 * hw + 1, 1);
            dotAt(ctx, px, p.s, p.x + (wob - Math.max(0, hw - 2)) * p.s, p.y - h, frac < 0.5 ? '#ffffff' : p.cols[0], 2 * Math.max(0, hw - 2) + 1, 1);
        }
    } });
    sigEmitter({ until: performance.now() + sec * 800, rate: big ? 110 : 70, fx: () => {
        sigParticle({ x: x + moveRand(-0.7, 0.7) * R, y: ground - moveRand(0, 0.3) * H, s, vx: moveRand(-15, 15) * s, vy: -moveRand(1.2, 2.2) * H, drag: 1.5, max: moveRand(0.3, 0.55), cols, shape, big, draw: (ctx, p, t, px) => {
            ctx.globalAlpha = hitFade(t, 0.05, 0.4);
            hitBit(ctx, px, p.s, p.x, p.y, p.shape, p.cols, t, false);
        } });
    } });
}

// ── 짜임 4: 분수 — 위로 부채꼴로 튀어 올랐다 떨어짐 (물보라 왕관 · 독방울 · 돌 부스러기 · 불똥)
function hitFountain(x, y, s, R, cols, shape, sec, big, dir) {
    sigEmitter({ until: performance.now() + 260, rate: big ? 260 : 190, fx: () => {
        const a = -Math.PI / 2 + moveRand(-1.15, 1.15) + dir * 0.2;
        const v = moveRand(1, 1.5) * R * 4.6;
        sigParticle({ x: x + moveRand(-0.3, 0.3) * R, y: y + R * 0.3, s, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: R * 9, drag: 0.5, max: moveRand(0.5, 0.8) * (sec / 0.7), cols, shape, big: Math.random() < (big ? 0.6 : 0.35), draw: (ctx, p, t, px) => {
            ctx.globalAlpha = t > 0.8 ? (1 - t) / 0.2 : 1;
            hitBit(ctx, px, p.s, p.x, p.y, p.shape, p.cols, t, p.big, dir);
        } });
    } });
    sigRing(x, y + R * 0.85, s, s * 2, R * 1.8, 0.28, 0.5, [cols[1], cols[2], '#ffffff']);
}

// ── 짜임 5: 떨어짐 — 위에서 맞는 포켓몬 둘레로 쏟아짐 (낙뢰는 따로 · 돌 · 얼음 · 별)
function hitRain(x, y, s, R, cols, shape, sec, big) {
    const top = y - R * 4;
    sigEmitter({ until: performance.now() + sec * 600, rate: big ? 90 : 60, fx: () => {
        const tx = x + moveRand(-1.1, 1.1) * R;
        sigParticle({ x: tx + moveRand(-0.3, 0.3) * R, y: top, s, vx: 0, vy: R * moveRand(6, 8), g: R * 10, max: 0.5, floor: y + R * 0.8, cols, shape, big: big && Math.random() < 0.5,
            update: (p) => {
                if (p.y >= p.floor && !p.hitDone) {
                    p.hitDone = true;
                    p.life = p.max;
                    sigBurst(p.x, p.floor, p.s, p.cols.slice(0, 3), 5, 35);
                }
            },
            draw: (ctx, p, t, px) => {
                ctx.globalAlpha = 1;
                hitBit(ctx, px, p.s, p.x, p.y, p.shape, p.cols, t, p.big);
            },
        });
    } });
}

// ── 짜임 6: 솟음 — 발밑에서 뾰족한 덩이가 솟았다 꺼짐 (땅 · 바위 · 얼음 가시)
function hitSpikes(x, ground, s, R, cols, n, sec) {
    for (let i = 0; i < n; i++) {
        const ox = (i - (n - 1) / 2) * R * 0.55;
        const hMax = R * moveRand(0.9, 1.6) * (1 - Math.abs(ox) / (R * 2.2));
        sigParticle({ x: x + ox, y: ground, s, max: sec, d: Math.abs(i - (n - 1) / 2) * 0.05, hMax, cols, draw: (ctx, p, t, px) => {
            const k = t < p.d ? 0 : Math.min(1, (t - p.d) / 0.18);
            const fall = t > 0.7 ? (1 - t) / 0.3 : 1;
            const h = Math.round((p.hMax * k * fall) / p.s);
            ctx.globalAlpha = 1;
            for (let j = 0; j < h; j++) {
                const half = Math.max(0, Math.round((h - j) * 0.35));
                dotAt(ctx, px, p.s, p.x - half * p.s, p.y - j * p.s, j === h - 1 ? p.cols[0] : p.cols[2 + (j % 2)], 2 * half + 1, 1);
            }
        } });
    }
    hitDust(x, ground, s, R, cols, 10);
}

// 흙먼지 덩이 — 바닥을 따라 양옆으로
function hitDust(x, ground, s, R, cols, n) {
    for (let i = 0; i < n; i++) {
        const side = i % 2 ? -1 : 1;
        sigParticle({ x: x + side * moveRand(0, 0.5) * R, y: ground, s, vx: side * moveRand(1, 2.2) * R, vy: -moveRand(0.1, 0.6) * R, g: R * 0.8, drag: 2.4, max: moveRand(0.45, 0.75), cols, r: movePick([1, 2, 2, 3]), draw: (ctx, p, t, px) => {
            ctx.globalAlpha = (1 - t) * 0.85;
            sigDisc(ctx, px, p.s, p.x, p.y, (p.r + t * 2) * p.s, t < 0.4 ? p.cols[1] : p.cols[2]);
        } });
    }
}

// ── 짜임 7: 감돌기 — 조각이 몸 둘레를 빙글 돌다 밖으로 흩어짐 (잎 · 깃털 · 반짝이 · 하트 · 혼)
function hitOrbit(x, y, s, R, cols, shape, n, sec, big) {
    for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        sigParticle({ x, y, s, max: sec * moveRand(0.85, 1.1), a0, R, cols, shape, spin: moveRand(6, 9), big, draw: (ctx, p, t, px) => {
            const a = p.a0 + t * p.spin;
            const r = p.R * (0.6 + (t < 0.55 ? 0.6 * t : 0.33 + 1.8 * (t - 0.55)));
            ctx.globalAlpha = hitFade(t, 0.1, 0.3);
            hitBit(ctx, px, p.s, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.7, p.shape, p.cols, t, p.big && i % 2 === 0);
        } });
    }
}

// ── 짜임 8: 갈래 번개 — 가운데에서 바깥으로 지직 (0.05초마다 다시) + 흰 심
function hitBolts(x, y, s, R, cols, n, sec) {
    sigParticle({ x, y, s, max: sec, R, n, cols, drawn: -1, update: (p) => {
        if (p.life - p.drawn < 0.05) {
            return;
        }
        p.drawn = p.life;
        p.paths = [];
        for (let i = 0; i < p.n; i++) {
            const a = (i / p.n) * Math.PI * 2 + moveRand(-0.35, 0.35);
            const L = p.R * moveRand(1.2, 2);
            p.paths.push(zigzag(p.x, p.y, p.x + Math.cos(a) * L, p.y + Math.sin(a) * L, p.s, 2.5));
        }
    }, draw: (ctx, p, t, px) => {
        if (!p.paths || Math.floor(p.life / 0.05) % 4 === 3) {
            return;
        }
        ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
        p.paths.forEach((path) => {
            zapLine(ctx, px, p.s, path, 2, p.cols[3]);
            zapLine(ctx, px, p.s, path, 1, '#ffffff');
        });
    } });
}

// 낙뢰 — 위에서 맞는 포켓몬에 굵은 번개 한 줄기 (두 번 번쩍) + 바닥 고리
function hitThunder(x, y, s, R, cols, sec) {
    sigParticle({ x, y, s, max: sec, R, cols, drawn: -1, update: (p) => {
        if (p.life - p.drawn < 0.05) {
            return;
        }
        p.drawn = p.life;
        p.path = zigzag(p.x + moveRand(-1, 1) * p.s, p.y - p.R * 4, p.x, p.y + p.R * 0.6, p.s, 3);
        p.branch = zapBranch(p.path, p.R * 1.2, Math.PI / 2, p.s);
    }, draw: (ctx, p, t, px) => {
        if (!p.path || (t > 0.3 && t < 0.42) || Math.floor(p.life / 0.05) % 3 === 2) {
            return;
        }
        ctx.globalAlpha = t > 0.75 ? (1 - t) / 0.25 : 1;
        zapLine(ctx, px, p.s, p.path, 3, p.cols[3]);
        zapLine(ctx, px, p.s, p.path, 1, '#ffffff');
        zapLine(ctx, px, p.s, p.branch, 1, p.cols[1]);
    } });
    sigRing(x, y + R * 0.8, s, s * 2, R * 2, 0.28, 0.4, [cols[1], '#ffffff', cols[2]]);
}

// 충격선 — 굵은 직선이 바깥으로 쭉 + 네 갈래 별 (격투 · 노말 · 강철)
function hitLines(x, y, s, R, cols, n, sec) {
    sigParticle({ x, y, s, max: sec * 1.3, R, n, cols, draw: (ctx, p, t, px) => {
        ctx.globalAlpha = 1 - t;
        for (let i = 0; i < p.n; i++) {
            const a = (i / p.n) * Math.PI * 2 + (i % 2) * 0.2;
            const r0 = p.R * (0.4 + 0.8 * t);
            const r1 = p.R * (0.9 + 1.2 * t);
            for (let r = r0; r <= r1; r += p.s) {
                dotAt(ctx, px, p.s, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, r > r1 - 2 * p.s ? p.cols[0] : p.cols[2], 2, 2);
            }
        }
        const k = Math.round((p.R / p.s) * (0.6 + 0.6 * t));
        for (let j = -k; j <= k; j++) {
            const c = Math.abs(j) < 3 ? '#ffffff' : p.cols[1];
            dotAt(ctx, px, p.s, p.x + j * p.s, p.y, c, 1, Math.abs(j) < 3 ? 2 : 1);
            dotAt(ctx, px, p.s, p.x, p.y + j * p.s, c, Math.abs(j) < 3 ? 2 : 1, 1);
        }
    } });
}

// 여러 번 맞음 — 몸 둘레 여기저기에 작은 별 번쩍 (연속 기술 느낌)
function hitFlurry(x, y, s, R, cols, n) {
    for (let i = 0; i < n; i++) {
        setTimeout(() => {
            const ox = x + moveRand(-0.8, 0.8) * R;
            const oy = y + moveRand(-0.7, 0.6) * R;
            hitCore(ox, oy, s, R * 0.5, cols);
            hitLines(ox, oy, s, R * 0.45, cols, 4, 0.22);
        }, i * 80);
    }
}

// X 베기 — 두 대각선이 쫙 (악 · 벌레 · 강철)
function hitCross(x, y, s, R, cols, sec) {
    sigParticle({ x, y, s, max: sec * 1.3, R, cols, draw: (ctx, p, t, px) => {
        const k = Math.min(1, t / 0.22);
        ctx.globalAlpha = t > 0.55 ? (1 - t) / 0.45 : 1;
        const L = p.R * 1.6 * k;
        for (const sx of [1, -1]) {
            for (let r = -L; r <= L; r += p.s) {
                const cx = p.x + r * 0.75 * sx;
                const cy = p.y + r * 0.75;
                dotAt(ctx, px, p.s, cx - p.s, cy, p.cols[3], 3, 1);
                dotAt(ctx, px, p.s, cx, cy, Math.abs(r) < p.R * 0.4 ? '#ffffff' : p.cols[0]);
            }
        }
    } });
}

// 겹 고리 — 늦게 시작하는 고리 셋 (에스퍼 · 페어리 · 고스트)
function hitPulses(x, y, s, R, cols, n) {
    for (let i = 0; i < n; i++) {
        setTimeout(() => sigRing(x, y, s, R * 0.3, R * (1.7 + 0.35 * i), 0.8, 0.55, [cols[0], cols[2], cols[1]]), i * 100);
    }
}

// 피어오르는 혼 — 물결치며 떠오르는 꼬리 (고스트 · 독 안개)
function hitWisps(x, y, s, R, cols, n, sec) {
    for (let i = 0; i < n; i++) {
        sigParticle({ x: x + moveRand(-0.9, 0.9) * R, y: y + moveRand(-0.2, 0.6) * R, s, max: sec * moveRand(0.8, 1.1), cols, ph: moveRand(0, 6), R, draw: (ctx, p, t, px) => {
            ctx.globalAlpha = t < 0.2 ? t / 0.2 : (1 - t) * 1.2;
            for (let j = 0; j < 6; j++) {
                const k = t - j * 0.035;
                if (k < 0) {
                    continue;
                }
                const cx = p.x + Math.sin(p.ph + k * 14) * p.R * 0.22;
                const cy = p.y - k * p.R * 2;
                dotAt(ctx, px, p.s, cx, cy, j === 0 ? p.cols[0] : j < 3 ? p.cols[1] : p.cols[2], j === 0 ? 2 : 1, j === 0 ? 2 : 1);
            }
        } });
    }
}

const HIT_TYPE_PAL = {
    normal: 'normal', fire: 'fire', water: 'water', electric: 'electric', grass: 'grass', ice: 'ice', fighting: 'fight', poison: 'poison', ground: 'ground',
    flying: 'wind', psychic: 'psychic', bug: 'bug', rock: 'rock', ghost: 'ghost', dragon: 'dragon', dark: 'dark', steel: 'steel', fairy: 'fairy',
};

// 타입마다 짜임 2 ~ 3 가지 — (x, y, s, R, cols, big, dir, ground, n) → 그림
const HIT_STYLES = {
    fire: [
        (x, y, s, R, c, big, dir, g, n, h) => hitHelix(x, g, s, R, h(3.4), c, 'flame', 0.8, dir * 11, big), // 감아 올라가는 불길 회오리
        (x, y, s, R, c, big, dir, g, n) => hitBloom(x, y, s, R, c, 'flame', 0.75, big, { g: -40, drag: 3 }), // 불꽃 폭발
        (x, y, s, R, c, big, dir, g, n, h) => { hitPillar(x, g, s, R, h(3.6), c, 'flame', 0.75, big); hitFountain(x, y, s, R * 0.6, c, 'dot', 0.6, false, dir); }, // 불기둥 + 불똥
    ],
    water: [
        (x, y, s, R, c, big, dir) => hitFountain(x, y, s, R, c, 'drop', 0.75, big, dir), // 물보라 왕관
        (x, y, s, R, c, big, dir, g, n, h) => hitHelix(x, g, s, R, h(3.2), c, 'drop', 0.8, dir * 10, big), // 물기둥 소용돌이
        (x, y, s, R, c, big) => { hitBloom(x, y, s, R, c, 'bubble', 0.8, big, { g: -30, drag: 3.6 }); }, // 거품 터짐
    ],
    electric: [
        (x, y, s, R, c, big, dir, g, n) => { hitBolts(x, y, s, R, c, n(6), 0.5); hitBloom(x, y, s, R * 0.7, c, 'dot', 0.45, big, { g: 0, drag: 4 }); }, // 갈래 번개
        (x, y, s, R, c, big) => { hitThunder(x, y, s, R, c, 0.55); hitBolts(x, y, s, R * 0.7, c, 4, 0.4); }, // 낙뢰
        (x, y, s, R, c, big, dir, g, n) => { hitOrbit(x, y, s, R * 1.1, c, 'sparkle', n(10), 0.6, big); hitBolts(x, y, s, R * 0.8, c, 5, 0.45); }, // 몸에 감기는 전기
    ],
    grass: [
        (x, y, s, R, c, big, dir, g, n, h) => hitHelix(x, g, s, R, h(3), c, 'leaf', 0.8, dir * 9, big), // 잎 소용돌이
        (x, y, s, R, c, big) => hitBloom(x, y, s, R, c, 'leaf', 0.8, big, { g: 40, drag: 2.6 }), // 잎 터짐
        (x, y, s, R, c, big, dir, g, n) => { hitOrbit(x, y, s, R * 1.1, c, 'leaf', n(14), 0.75, big); hitGlow(x, g, s, R, c, 0.6); }, // 감도는 잎
    ],
    ice: [
        (x, y, s, R, c, big) => { hitBloom(x, y, s, R, c, 'shard', 0.75, big, { g: 0, drag: 4.2 }); hitCore(x, y, s, R, c); }, // 결정 조각 박힘
        (x, y, s, R, c, big, dir, g, n, h) => hitHelix(x, g, s, R, h(3), c, 'sparkle', 0.8, dir * 10, big), // 눈보라 소용돌이
        (x, y, s, R, c, big, dir, g, n) => { hitSpikes(x, g, s, R, c, n(5), 0.8); hitRain(x, y, s, R, c, 'shard', 0.6, big); }, // 얼음 가시 솟음 + 결정 쏟아짐
    ],
    fighting: [
        (x, y, s, R, c, big, dir, g, n) => { hitLines(x, y, s, R, c, n(8), 0.36); sigRing(x, y, s, R * 0.4, R * 1.8, 0.85, 0.32, [c[0], c[2]]); }, // 충격선
        (x, y, s, R, c, big, dir, g, n) => hitFlurry(x, y, s, R, c, n(4)), // 연타
        (x, y, s, R, c, big, dir, g) => { hitPulses(x, y, s, R, c, 2); hitDust(x, g, s, R, c, 8); }, // 충격파 + 먼지
    ],
    poison: [
        (x, y, s, R, c, big, dir) => hitFountain(x, y, s, R, c, 'bubble', 0.75, big, dir), // 독방울 튐
        (x, y, s, R, c, big, dir, g, n) => { hitWisps(x, y, s, R, c, n(8), 0.85); hitGlow(x, g, s, R, c, 0.7); }, // 독 안개
        (x, y, s, R, c, big, dir, g, n, h) => hitPillar(x, g, s, R, h(2.6), c, 'bubble', 0.7, big), // 독 기둥
    ],
    ground: [
        (x, y, s, R, c, big, dir, g, n) => { hitDust(x, g, s, R, c, n(14)); hitFountain(x, y, s, R * 0.8, c, 'rock', 0.6, big, dir); }, // 흙먼지 + 흙덩이
        (x, y, s, R, c, big, dir, g, n) => hitSpikes(x, g, s, R, c, n(5), 0.8), // 땅 솟음
        (x, y, s, R, c, big, dir, g, n, h) => hitHelix(x, g, s, R, h(2.8), c, 'dot', 0.8, dir * 10, big), // 모래 회오리
    ],
    rock: [
        (x, y, s, R, c, big, dir) => hitFountain(x, y, s, R, c, 'rock', 0.75, big, dir), // 돌 부스러기
        (x, y, s, R, c, big) => hitRain(x, y, s, R, c, 'rock', 0.7, big), // 돌 쏟아짐
        (x, y, s, R, c, big, dir, g, n) => hitSpikes(x, g, s, R, c, n(4), 0.8), // 바위 솟음
    ],
    flying: [
        (x, y, s, R, c, big, dir, g, n, h) => hitHelix(x, g, s, R, h(3), c, 'feather', 0.75, dir * 12, big), // 회오리바람
        (x, y, s, R, c, big, dir, g, n) => { hitOrbit(x, y, s, R * 1.1, c, 'feather', n(12), 0.7, big); sigRing(x, y, s, R * 0.4, R * 1.7, 0.6, 0.4, [c[0], c[1]]); }, // 깃털 흩날림
        (x, y, s, R, c, big) => hitBloom(x, y, s, R, c, 'feather', 0.7, big, { g: 20, drag: 3 }), // 바람 터짐
    ],
    psychic: [
        (x, y, s, R, c, big, dir, g, n) => { hitPulses(x, y, s, R, c, big ? 4 : 3); hitOrbit(x, y, s, R, c, 'sparkle', n(6), 0.65, big); }, // 겹 고리 + 반짝이
        (x, y, s, R, c, big) => hitBloom(x, y, s, R, c, 'sparkle', 0.7, big, { g: 0, drag: 4 }), // 염동 폭발
        (x, y, s, R, c, big, dir, g, n, h) => hitHelix(x, g, s, R, h(3), c, 'sparkle', 0.8, dir * 8, big), // 빛 나선
    ],
    bug: [
        (x, y, s, R, c, big, dir, g, n) => { hitLines(x, y, s, R * 0.9, c, n(10), 0.32); hitBloom(x, y, s, R * 0.7, c, 'dot', 0.45, big, { g: 80 }); }, // 가시 별
        (x, y, s, R, c, big, dir, g, n) => hitOrbit(x, y, s, R, c, 'leaf', n(12), 0.65, big), // 은빛 날개 가루
        (x, y, s, R, c) => hitCross(x, y, s, R, c, 0.4), // 집게 베기
    ],
    ghost: [
        (x, y, s, R, c, big, dir, g, n) => { hitWisps(x, y, s, R, c, n(8), 0.85); hitPulses(x, y, s, R, c, 2); }, // 혼 + 그림자 고리
        (x, y, s, R, c, big, dir, g, n, h) => hitHelix(x, g, s, R, h(3.2), c, 'flame', 0.85, dir * 9, big), // 도깨비불 회오리
        (x, y, s, R, c, big) => hitBloom(x, y, s, R, c, 'sparkle', 0.75, big, { g: -20, drag: 3.5 }), // 그림자 폭발
    ],
    dragon: [
        (x, y, s, R, c, big, dir, g, n, h) => hitHelix(x, g, s, R, h(3.4), c, 'flame', 0.85, dir * 11, big), // 용의 불길 회오리
        (x, y, s, R, c, big) => { hitBloom(x, y, s, R, c, 'shard', 0.75, big, { g: 0, drag: 3.6 }); hitPulses(x, y, s, R, c, 2); }, // 비늘 폭발
        (x, y, s, R, c, big, dir, g, n, h) => hitPillar(x, g, s, R, h(3.6), c, 'flame', 0.8, big), // 용 기둥
    ],
    dark: [
        (x, y, s, R, c, big) => { hitCross(x, y, s, R, c, 0.45); hitPulses(x, y, s, R, c, 1); }, // X 베기
        (x, y, s, R, c, big) => hitBloom(x, y, s, R, c, 'dot', 0.7, big, { g: 10, drag: 3.4 }), // 어둠 터짐
        (x, y, s, R, c, big, dir, g, n) => hitFlurry(x, y, s, R, c, n(4)), // 연속 기습
    ],
    steel: [
        (x, y, s, R, c, big, dir, g, n) => { hitFountain(x, y, s, R, c, 'dot', 0.55, big, dir); hitLines(x, y, s, R * 0.8, c, 4, 0.3); }, // 쇳조각 불똥 + 십자
        (x, y, s, R, c) => { hitCross(x, y, s, R, c, 0.4); hitCore(x, y, s, R, c); }, // 강철 베기
        (x, y, s, R, c, big) => { hitPulses(x, y, s, R, c, 3); hitBloom(x, y, s, R * 0.8, c, 'sparkle', 0.55, big, { g: 0, drag: 4 }); }, // 금속 울림
    ],
    fairy: [
        (x, y, s, R, c, big, dir, g, n) => { hitOrbit(x, y, s, R * 1.1, c, 'heart', n(8), 0.75, big); hitPulses(x, y, s, R, c, 2); }, // 하트 · 고리
        (x, y, s, R, c, big) => hitBloom(x, y, s, R, c, 'sparkle', 0.8, big, { g: -10, drag: 3 }), // 반짝 폭발
        (x, y, s, R, c, big, dir, g, n, h) => hitHelix(x, g, s, R, h(3), c, 'sparkle', 0.8, dir * 8, big), // 반짝 나선
    ],
    normal: [
        (x, y, s, R, c, big, dir, g, n) => { hitLines(x, y, s, R, c, n(8), 0.34); hitBloom(x, y, s, R * 0.8, c, 'star', 0.5, big, { g: 60 }); }, // 별 터짐
        (x, y, s, R, c, big, dir, g, n) => hitFlurry(x, y, s, R, c, n(3)), // 연타 별
        (x, y, s, R, c, big, dir, g) => { hitPulses(x, y, s, R, c, 2); hitDust(x, g, s, R, c, 8); }, // 쿵 충격파
    ],
};

// 기술이 맞는 순간 — 타입 · 기술마다 다른 도트 임팩트 (위 설명). 크기 R = 맞는 포켓몬 몸 반쯤 (작은 패널에서도 보이게 최소 12칸)
function typeImpact(x, y, s, type, P = 0.5, big = false, dir = 1, w = 0, pick = 0) {
    const cols = sigPal(HIT_TYPE_PAL[type] || 'normal');
    const k = (big ? 1.3 : 1) * (0.9 + 0.25 * P);
    const R = Math.max(12 * s, (w || 28 * s) * 0.45) * k;
    const n = (m) => Math.round(m * k);
    const styles = HIT_STYLES[type] || HIT_STYLES.normal;
    const style = styles[pick % styles.length];
    const ground = y + R * 0.95;
    // 위로 솟는 짜임 (회오리 · 기둥) 은 게임 정보줄 아래까지만 — 넘으면 잘려 보여서 낮춤 (작은 패널)
    const room = ground - (typeof fxTop === 'function' ? fxTop() : 0) - 2 * s;
    const h = (m) => Math.max(R * 1.6, Math.min(R * m, room));
    hitCore(x, y, s, R * 0.8, cols);
    style(x, y, s, R, cols, big, dir || 1, ground, n, h);
    // 센 기술은 화면도 살짝 (게임 중엔 배경 · 포켓몬만 2 ~ 3px — ult/core.js ultShake)
    if (big && typeof ultShake === 'function') {
        ultShake(3, 240);
    }
}
