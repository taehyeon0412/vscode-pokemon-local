// ───── 기술이 맞는 순간 — 타입마다 · 기술마다 다른 도트 임팩트 (2026-10-19 태현 님 "일반 기술이 밋밋해 보는 맛이 없어 · 불꽃회오리 같은 스타일 · 도트 방식 · 불꽃이든 얼음이든 다양한 방식으로") ─────
// sigImpact (8줄 별) 는 필살기 · 대결도 같이 써서 그대로 두고, 기술 (게임 전투 ult/bridge.js impact) 은 이것을 씀.
// 모양 틀 (회오리 · 폭발 · 기둥 · 분수 · 떨어짐 · 솟음 · 감돌기 · 갈래 번개 · 칼자국 …) × 타입 조각 (불꽃 혀 · 물방울 · 잎 · 결정 · 돌 · 깃털 · 반짝이 · 거품 …).
// 타입마다 3 가지 짜임이 있고 기술 칸 (없으면 이름) 으로 고름 → 같은 불꽃 기술이라도 기술마다 다른 임팩트. 모두 그림 1칸 (s) 도트
// 아트 디렉터 (2026-10-20, 13/25): 흰 덩이 대신 색이 든 밝은 끝 (HIT_COLS) · 순백은 맞는 순간 0.08초만 · 점선 원 대신 끊김 없는 픽셀 호 (hitRing) · 번쩍 1초 3번 아래 · 짜임 하나에 큰 모양 하나
// typeImpact(x, y, s, type, P, big, dir, w, o): x · y = 맞는 곳 가운데, P = 맞는 포켓몬 세기 (크기), big = 센 기술, dir = 맞는 방향 (+1 오른쪽), w = 맞는 포켓몬 폭
//   o = { pick: 짜임 번호, scale: 크기 배 (상성 · 막음), light: 닿는 기술 (가운데 번쩍 · 고리 없이 작게), basic: 1 공격 (노말 별 · 타입 색), none: 효과 없음 (연기만), bottom: 발밑 y }

const hitLerp = (a, b, k) => a + (b - a) * k;
// 밝기는 4단계로만 (픽셀 박자 — 반투명 중간색이 탁해지지 않게)
const hitStep = (v) => Math.ceil(Math.max(0, Math.min(1, v)) * 4) / 4;
const hitFade = (t, a = 0.08, b = 0.3) => hitStep(fadeInOut(t, a, b));
// 문자열 → 숫자 (기술 칸을 모를 때 이름으로 짜임 고르기)
const hitHash = (text) => {
    let h = 7;
    for (const ch of String(text || '')) {
        h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    }
    return h;
};
// 닿는 기술 · 1 공격 — 가운데 번쩍 · 고리를 빼고 작게 (칼자국 · 퍽이 주인공)
let hitQuiet = false;

// 임팩트 색 — 밝은 끝이 순백이면 맞는 포켓몬을 흰 덩이로 덮어서, 색이 든 흰색으로 (아트 디렉터). 없는 타입은 SIG_PALETTE (ult/bridge.js FX_TYPE_PAL)
const HIT_COLS = {
    normal: ['#f5efe0', '#dccfb0', '#a8987a', '#6e6450'],
    steel: ['#e6ecf2', '#b9c6d4', '#7d8ea3', '#4a5868'],
    flying: ['#eaf6ff', '#c9e6f5', '#9cc9e0', '#5f9ab8'],
    ice: ['#effcff', '#9fe8ff', '#55c2ef', '#2a7fb8'],
    water: ['#e8f8ff', '#6cc3ff', '#2f8fe0', '#1a5aa8'],
    electric: ['#fffbe0', '#ffe53b', '#f2b600', '#a87a00'],
    fighting: ['#fff0e0', '#ffc98f', '#ff8a3d', '#b8401f'],
    dragon: ['#fff0c0', '#ffb84d', '#7a5cff', '#3a1f99'],
    // 악 · 고스트 가장 짙은 색은 밤 숲보다 어두우면 테두리가 묻혀서 한 단계 밝게 (아트 디렉터 2바퀴)
    dark: ['#ffd6d0', '#ff6b5a', '#4f3a85', '#33245e'],
    ghost: ['#e8dcff', '#a87ee6', '#4a2a80', '#2e1d52'],
};
// 쇠 갈리는 불똥 (강철)
const HIT_GOLD = ['#fff6c2', '#ffd76a', '#f2b600', '#a87a00'];
const hitCols = (type) => HIT_COLS[type] || sigPal(FX_TYPE_PAL[type] || 'normal');
// 연출 팔레트 이름 (SIG_PALETTE: fight · wind …) → 그 타입 임팩트 색 (없으면 그대로) — 게임 전투의 할퀴기 · 주먹이 임팩트와 같은 흰색을 쓰게
const hitColsOfPal = (pal) => {
    const type = Object.keys(FX_TYPE_PAL).find((t) => FX_TYPE_PAL[t] === pal && HIT_COLS[t]);
    return type ? HIT_COLS[type] : pal;
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
            dotAt(ctx, px, s, x, y, c(2), 1, big ? 2 : 1);
            dotAt(ctx, px, s, x, y - s, c(0));
            break;
        case 'leaf': {
            const flat = Math.floor(k * 12) % 2 === 0;
            dotAt(ctx, px, s, x, y, c(1), flat ? 2 : 1, flat ? 1 : 2);
            dotAt(ctx, px, s, x + (flat ? 2 : 1) * s, y, c(3));
            break;
        }
        case 'shard':
            // 얼음 결정 · 비늘 — 가운데 밝은 마름모 + 끝 진하게
            dotAt(ctx, px, s, x, y - s, c(1));
            dotAt(ctx, px, s, x - s, y, c(2));
            dotAt(ctx, px, s, x, y, c(0));
            dotAt(ctx, px, s, x + s, y, c(2));
            dotAt(ctx, px, s, x, y + s, c(3));
            break;
        case 'rock': {
            // 돌 — 4 · 5칸 · 1칸 짙은 테두리 · 왼쪽 위만 밝게 (작은 돌은 모래알처럼 보여서, 아트 디렉터)
            const n = big ? 5 : 4;
            for (let dy = 0; dy < n; dy++) {
                for (let dx = 0; dx < n; dx++) {
                    const corner = (dx === 0 || dx === n - 1) && (dy === 0 || dy === n - 1);
                    if (corner) {
                        continue;
                    }
                    const edge = dx === 0 || dy === 0 || dx === n - 1 || dy === n - 1;
                    dotAt(ctx, px, s, x + dx * s, y + dy * s, edge ? '#3a2e20' : dx === 1 && dy === 1 ? c(0) : c(1 + ((dx + dy) % 2)));
                }
            }
            break;
        }
        case 'feather':
            for (let j = 0; j < 3; j++) {
                dotAt(ctx, px, s, x + j * s * dir, y - j * s, j === 1 ? c(0) : c(2));
            }
            break;
        case 'sparkle':
            dotAt(ctx, px, s, x, y, c(0));
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                dotAt(ctx, px, s, x + dx * s, y + dy * s, c(1));
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
            dotAt(ctx, px, s, x - s, y - s, c(0));
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

// 발밑 충격파 — 두꺼운 초승달 호 3조각 (100° 칠 · 20° 빔): 앞 (아래) 반은 2칸 cols[1], 뒤 (위) 반은 1칸 cols[3]. 몸 둘레 원은 패링 원과 헷갈려서 발밑에만 (아트 디렉터 2바퀴)
function hitRing(x, y, s, r0, r1, flat, max, cols) {
    if (hitQuiet) {
        return;
    }
    const a0 = moveRand(0, (Math.PI * 2) / 3);
    const fl = Math.min(flat, 0.35);
    sigParticle({ x, y, s, max, cols, draw: (ctx, p, t, px) => {
        const r = r0 + (r1 - r0) * t;
        ctx.globalAlpha = hitStep(1 - t);
        const dots = Math.ceil((2 * Math.PI * r) / p.s);
        for (let j = 0; j < dots; j++) {
            const a = (j / dots) * Math.PI * 2 + a0;
            if ((((j / dots) * 3) % 1) > 5 / 6) {
                continue;
            }
            const cx = p.x + Math.cos(a) * r;
            const cy = p.y + Math.sin(a) * r * fl;
            const front = Math.sin(a) > 0;
            dotAt(ctx, px, p.s, cx, cy, front ? p.cols[1] : p.cols[3], 1, front && t < 0.6 ? 2 : 1);
        }
    } });
}

// 바닥 빛 웅덩이 — 맞는 포켓몬 발밑을 넓고 연하게 물들임 (모닥불 바닥 빛처럼 · 가운데 줄이 넓고 위아래 줄은 반쯤 · 양끝 25% 바둑판)
function hitPuddle(x, ground, s, R, cols, sec) {
    sigParticle({ x, y: ground, s, max: sec, R, cols, draw: (ctx, p, t, px) => {
        ctx.globalAlpha = hitStep(0.35 * hitFade(t, 0.15, 0.4)) || 0.25;
        const rx = p.R * 1.2 * (0.6 + 0.4 * Math.min(1, t / 0.15));
        [0.55, 1, 0.55].forEach((k, j) => {
            const half = Math.round((rx * k) / p.s);
            for (let i = -half; i <= half; i++) {
                const edge = Math.abs(i) > half * 0.75;
                if (edge && (i + j) % 2) {
                    continue;
                }
                dotAt(ctx, px, p.s, p.x + i * p.s, p.y + (j - 1) * p.s, p.cols[2]);
            }
        });
    } });
}

// 가운데 번쩍 — 마름모로 확 (0.08초, 처음 반만 순백)
function hitCore(x, y, s, R, cols) {
    if (hitQuiet) {
        return;
    }
    sigParticle({ x, y, s, max: 0.08, R, cols, draw: (ctx, p, t, px) => {
        ctx.globalAlpha = 1;
        const r = Math.max(2, Math.round((p.R / p.s) * (0.15 + 0.3 * t)));
        for (let j = -r; j <= r; j++) {
            const half = r - Math.abs(j);
            dotAt(ctx, px, p.s, p.x - half * p.s, p.y + j * p.s, t < 0.5 ? '#ffffff' : p.cols[0], 2 * half + 1, 1);
        }
    } });
}

// ── 짜임: 회오리 — 세 줄 나선 띠가 몸을 감고 + 조각이 돌며 피어오름 (회오리불꽃 · 물기둥 · 회오리바람 · 모래 회오리 — 4타입만)
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
                ctx.globalAlpha = (front ? 1 : 0.5) * hitFade(t, 0.04, 0.25);
                // 앞 줄은 굵게 (2칸) + 밝은 심, 뒤 줄은 가늘고 흐리게 — 몸을 감는 느낌
                dotAt(ctx, px, p.s, p.x + Math.cos(th) * r, p.y - h + Math.sin(th) * r * 0.15, cols[Math.min(3, 1 + Math.floor(frac * 3))], front ? 2 : 1, front ? 2 : 1);
                if (front && strand === 0) {
                    dotAt(ctx, px, p.s, p.x + Math.cos(th) * r, p.y - h + Math.sin(th) * r * 0.15, cols[0]);
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
                ctx.globalAlpha = hitStep((p.depth > 0 ? 1 : 0.5) * hitFade(t, 0.1, 0.35) * (p.frac > 0.85 ? (1 - p.frac) / 0.15 : 1));
                hitBit(ctx, px, p.s, p.x, p.y, p.shape, p.cols, p.frac, p.big && p.depth > 0);
            },
        });
    } });
}

// ── 짜임: 폭발 — 처음 0.15초에 큰 조각 6개 (주인공 모양 — 얼음 = 바깥을 향한 1×3 결정, 그 밖 = 그 타입 큰 조각) + 작은 조각을 조금만 (점 구름이 되지 않게, 아트 디렉터 2바퀴)
function hitBloom(x, y, s, R, cols, shape, sec, big, opt = {}) {
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + moveRand(-0.2, 0.2);
        sigParticle({ x, y, s, a, vx: Math.cos(a) * R * 5, vy: Math.sin(a) * R * 5 * (opt.flat ?? 0.85), drag: 7, max: 0.5 * (sec / 0.7) + 0.1, cols, shape, draw: (ctx, p, t, px) => {
            ctx.globalAlpha = hitFade(t, 0.05, 0.35);
            if (p.shape === 'shard') {
                // 바깥을 향한 결정 1 × 3 (심 밝게 → 끝 진하게)
                for (let k = 0; k < 3; k++) {
                    dotAt(ctx, px, p.s, p.x + Math.cos(p.a) * k * p.s, p.y + Math.sin(p.a) * k * p.s, p.cols[k]);
                }
                return;
            }
            hitBit(ctx, px, p.s, p.x, p.y, p.shape, p.cols, t, true);
        } });
    }
    const until = performance.now() + Math.min(300, sec * 400);
    sigEmitter({ until, rate: big ? 130 : 90, fx: () => {
        const a = moveRand(0, Math.PI * 2);
        const v = moveRand(1, 1.8) * R * 3.2;
        sigParticle({ x, y, s, vx: Math.cos(a) * v, vy: Math.sin(a) * v * (opt.flat ?? 0.85), g: (opt.g ?? 30) * s, drag: opt.drag ?? 3.2, max: moveRand(0.45, 0.75) * (sec / 0.7), cols, shape, big: Math.random() < 0.7, draw: (ctx, p, t, px) => {
            ctx.globalAlpha = hitFade(t, 0.05, 0.4);
            hitBit(ctx, px, p.s, p.x, p.y, p.shape, p.cols, t, p.big);
        } });
    } });
}

// ── 짜임: 기둥 — 발밑에서 위로 솟구치는 기둥 (불기둥 · 독 기둥 · 비늘 기둥)
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
            ctx.globalAlpha = hitStep(0.9 * fade);
            dotAt(ctx, px, p.s, p.x + (wob - hw) * p.s, p.y - h, p.cols[Math.min(3, 1 + Math.floor(frac * 3))], 2 * hw + 1, 1);
            dotAt(ctx, px, p.s, p.x + (wob - Math.max(0, hw - 2)) * p.s, p.y - h, p.cols[0], 2 * Math.max(0, hw - 2) + 1, 1);
        }
    } });
    sigEmitter({ until: performance.now() + sec * 800, rate: big ? 110 : 70, fx: () => {
        sigParticle({ x: x + moveRand(-0.7, 0.7) * R, y: ground - moveRand(0, 0.3) * H, s, vx: moveRand(-15, 15) * s, vy: -moveRand(1.2, 2.2) * H, drag: 1.5, max: moveRand(0.3, 0.55), cols, shape, big, draw: (ctx, p, t, px) => {
            ctx.globalAlpha = hitFade(t, 0.05, 0.4);
            hitBit(ctx, px, p.s, p.x, p.y, p.shape, p.cols, t, false);
        } });
    } });
}

// ── 짜임: 분수 — 위로 부채꼴로 튀어 올랐다 떨어짐 (물보라 왕관 · 독방울 · 돌 부스러기 · 불똥) · 바닥 물결은 opt.ring 일 때만
function hitFountain(x, y, s, R, cols, shape, sec, big, dir, opt = {}) {
    sigEmitter({ until: performance.now() + 260, rate: big ? 260 : 190, fx: () => {
        const a = -Math.PI / 2 + moveRand(-1.15, 1.15) + dir * 0.2;
        const v = moveRand(1, 1.5) * R * 4.6;
        sigParticle({ x: x + moveRand(-0.3, 0.3) * R, y: y + R * 0.3, s, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: R * 9, drag: 0.5, max: moveRand(0.5, 0.8) * (sec / 0.7), cols, shape, big: Math.random() < (big ? 0.6 : 0.35), draw: (ctx, p, t, px) => {
            ctx.globalAlpha = t > 0.8 ? 0.5 : 1;
            hitBit(ctx, px, p.s, p.x, p.y, p.shape, p.cols, t, p.big, dir);
        } });
    } });
    if (opt.ring) {
        hitRing(x, y + R * 0.85, s, s * 2, R * 1.4, 0.28, 0.45, cols);
    }
}

// ── 짜임: 떨어짐 — 위에서 맞는 포켓몬 둘레로 쏟아짐 (돌 · 고드름 · 도깨비불 · 하트)
function hitRain(x, y, s, R, cols, shape, sec, big) {
    const top = y - R * 4;
    sigEmitter({ until: performance.now() + sec * 600, rate: big ? 90 : 60, fx: () => {
        const tx = x + moveRand(-1.1, 1.1) * R;
        // max 는 넉넉히 — 바닥 (floor) 에서 어차피 끝냄 (0.5초면 절반이 공중에서 사라짐, 코드 리뷰어)
        sigParticle({ x: tx + moveRand(-0.3, 0.3) * R, y: top, s, vx: 0, vy: R * moveRand(6, 8), g: R * 10, max: 0.9, floor: y + R * 0.8, cols, shape, big: big && Math.random() < 0.5,
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

// ── 짜임: 솟음 — 발밑에서 뾰족한 덩이가 솟았다 꺼짐 (땅 · 바위 · 얼음 · 그림자 · 쇠 가시)
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

// 흙먼지 — 작은 반원 덩이가 바닥에서 위로 피어 흩어짐 (꽉 찬 공이 겹쳐 뭉게 쿠션이 되지 않게 — 위 반원 · 가운데 1칸 빔 · 빛보다 어두운 색, 아트 디렉터 2바퀴)
function hitDust(x, ground, s, R, cols, n) {
    for (let i = 0; i < n; i++) {
        const side = i % 2 ? -1 : 1;
        sigParticle({ x: x + side * moveRand(0, 0.5) * R, y: ground, s, vx: side * moveRand(1, 2.2) * R, vy: -moveRand(0.6, 1) * R, g: R * 1.2, drag: 2.4, max: moveRand(0.3, 0.45), cols, r: movePick([1, 1, 2]), draw: (ctx, p, t, px) => {
            ctx.globalAlpha = hitStep((1 - t) * 0.6);
            const r = Math.round(p.r + t);
            for (let dy = -r; dy <= 0; dy++) {
                const half = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
                for (let dx = -half; dx <= half; dx++) {
                    if (dx === 0 && dy === 0 && r > 1) {
                        continue;
                    }
                    dotAt(ctx, px, p.s, p.x + dx * p.s, p.y + dy * p.s, dy === -r ? p.cols[2] : p.cols[3]);
                }
            }
        } });
    }
}

// ── 짜임: 감돌기 — 조각이 몸 둘레를 빙글 돌다 밖으로 흩어짐 (잎 · 깃털 · 하트) · inward = 바깥에서 안으로 빨려 듦 (염동력)
function hitOrbit(x, y, s, R, cols, shape, n, sec, big, inward = false) {
    for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        sigParticle({ x, y, s, max: sec * moveRand(0.85, 1.1), a0, R, cols, shape, spin: moveRand(6, 9), big, draw: (ctx, p, t, px) => {
            const a = p.a0 + t * p.spin * (inward ? 1.4 : 1);
            const r = inward ? p.R * (1.8 - 1.5 * t) : p.R * (0.6 + (t < 0.55 ? 0.6 * t : 0.33 + 1.8 * (t - 0.55)));
            ctx.globalAlpha = hitFade(t, 0.1, 0.3);
            hitBit(ctx, px, p.s, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.7, p.shape, p.cols, t, p.big && i % 2 === 0);
        } });
    }
}

// ── 짜임: 갈래 번개 — 가는 선 (1칸 심 + 둘레) · 곧은 5칸 마디 · 날카로운 꺾임 · 줄마다 끝 갈래 하나 (벽에 난 번개 금처럼). 모양은 0.12초마다 새로 (밝기 그대로)
function hitBolts(x, y, s, R, cols, n, sec) {
    sigParticle({ x, y, s, max: sec, R, n, cols, drawn: -1, update: (p) => {
        if (p.drawn >= 0 && p.life - p.drawn < 0.12) {
            return;
        }
        p.drawn = p.life;
        p.paths = [];
        for (let i = 0; i < p.n; i++) {
            const a = (i / p.n) * Math.PI * 2 + moveRand(-0.35, 0.35);
            const L = p.R * moveRand(1.4, 2.4);
            const path = zigzag(p.x, p.y, p.x + Math.cos(a) * L, p.y + Math.sin(a) * L, p.s, 3, 5);
            p.paths.push(path, zapBranch(path, L * 0.4, a, p.s));
        }
    }, draw: (ctx, p, t, px) => {
        if (!p.paths) {
            return;
        }
        ctx.globalAlpha = t > 0.7 ? 0.5 : 1;
        p.paths.forEach((path) => zapLine(ctx, px, p.s, path, 1, p.cols[2], p.cols[0]));
    } });
}

// 낙뢰 — 위에서 맞는 포켓몬에 굵은 번개 한 줄기 · 딱 두 번 번쩍 (가운데 빈틈 하나) + 바닥 호
function hitThunder(x, y, s, R, cols, sec) {
    sigParticle({ x, y, s, max: sec, R, cols, drawn: -1, update: (p) => {
        if (p.drawn >= 0 && p.life - p.drawn < 0.12) {
            return;
        }
        p.drawn = p.life;
        p.path = zigzag(p.x + moveRand(-1, 1) * p.s, p.y - p.R * 4, p.x, p.y + p.R * 0.6, p.s, 3);
        p.branch = zapBranch(p.path, p.R * 1.2, Math.PI / 2, p.s);
    }, draw: (ctx, p, t, px) => {
        if (!p.path || (t > 0.3 && t < 0.42)) {
            return;
        }
        ctx.globalAlpha = t > 0.75 ? 0.5 : 1;
        zapLine(ctx, px, p.s, p.path, 3, p.cols[3]);
        zapLine(ctx, px, p.s, p.path, 1, p.cols[0]);
        zapLine(ctx, px, p.s, p.branch, 1, p.cols[1]);
    } });
    hitRing(x, y + R * 0.8, s, s * 2, R * 1.3, 0.28, 0.4, cols);
}

// 충격선 — 바깥으로 뻗는 선 (뿌리 2칸 → 끝 1칸으로 가늘어짐 · 가운데 십자 없음 — 조준경 같아서)
function hitLines(x, y, s, R, cols, n, sec) {
    sigParticle({ x, y, s, max: sec * 1.3, R, n, cols, draw: (ctx, p, t, px) => {
        ctx.globalAlpha = hitStep(1 - t);
        for (let i = 0; i < p.n; i++) {
            const a = (i / p.n) * Math.PI * 2 + (i % 2) * 0.2;
            const r0 = p.R * (0.2 + 0.8 * t);
            const r1 = p.R * (0.9 + 1.2 * t);
            for (let r = r0; r <= r1; r += p.s) {
                const root = r < hitLerp(r0, r1, 0.5);
                dotAt(ctx, px, p.s, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, r > r1 - 2 * p.s ? p.cols[0] : p.cols[2], root ? 2 : 1, root ? 2 : 1);
            }
        }
    } });
}

// 연타 — 몸 둘레 여기저기에 작은 퍽 (0.11초마다 · 흰 심은 첫 번만 — 번쩍이 1초 3번을 넘지 않게)
function hitFlurry(x, y, s, R, cols, n) {
    for (let i = 0; i < n; i++) {
        setTimeout(() => {
            const ox = x + moveRand(-0.8, 0.8) * R;
            const oy = y + moveRand(-0.7, 0.6) * R;
            sigPow(ox, oy, s, cols, 0.3, false, { size: Math.max(4, Math.round(R / s / 3)), white: i === 0 });
        }, i * 110);
    }
}

// X 베기 · 용 발톱 — 칼자국 화풍 하나로 (moves.js sigSlashMark: 굽고 가운데 굵고 끝이 가는 자국)
function hitClaws(x, y, s, R, cols, n, cross) {
    const L = Math.max(10, Math.round((R / s) * 2.4));
    if (cross) {
        sigSlashMark(x, y, s, 1, 1, L, cols);
        setTimeout(() => sigSlashMark(x, y, s, -1, 1, L, cols), 70);
        return;
    }
    for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * 4 * s;
        setTimeout(() => sigSlashMark(x + off * 0.6, y + off, s, 1, 1, L, cols), i * 60);
    }
}

// 겹 충격파 — 발밑에서 늦게 시작하는 초승달 호 (에스퍼 · 고스트 · 격투 · 노말)
function hitPulses(x, ground, s, R, cols, n) {
    // 닿는 기술 · 1 공격이면 고리 없이 (타이머가 나중에 그려서 부를 때 확인)
    if (hitQuiet) {
        return;
    }
    for (let i = 0; i < n; i++) {
        setTimeout(() => hitRing(x, ground, s, R * 0.3, R * (1.4 + 0.3 * i), 0.3, 0.5, cols), i * 100);
    }
}

// 염동 물결 — 몸을 가로지르는 1칸 가로 물결 띠 3 ~ 4줄 (±1칸 sin, 위아래로 퍼짐)
function hitWaves(x, y, s, R, cols, n, sec) {
    for (let i = 0; i < n; i++) {
        sigParticle({ x, y: y + (i - (n - 1) / 2) * R * 0.45, s, max: sec, R, cols, i, draw: (ctx, p, t, px) => {
            ctx.globalAlpha = hitFade(t, 0.1, 0.35);
            const half = Math.round((p.R * (0.8 + 0.6 * t)) / p.s);
            const spread = (p.i - (n - 1) / 2) * t * p.R * 0.4;
            for (let k = -half; k <= half; k++) {
                const yo = Math.round(Math.sin(k * 0.6 + p.life * 14 + p.i)) * p.s;
                dotAt(ctx, px, p.s, p.x + k * p.s, p.y + spread + yo, Math.abs(k) < half * 0.4 ? p.cols[0] : p.cols[1 + (p.i % 2)]);
            }
        } });
    }
}

// 피어오르는 혼 — 물결치며 떠오르는 꼬리 (고스트 · 독 안개)
function hitWisps(x, y, s, R, cols, n, sec) {
    for (let i = 0; i < n; i++) {
        sigParticle({ x: x + moveRand(-0.9, 0.9) * R, y: y + moveRand(-0.2, 0.6) * R, s, max: sec * moveRand(0.8, 1.1), cols, ph: moveRand(0, 6), R, draw: (ctx, p, t, px) => {
            ctx.globalAlpha = hitStep(t < 0.2 ? t / 0.2 : (1 - t) * 1.2);
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

// 몸으로 부딪힘 (몸통박치기 · 전광석화 · 날개치기 — 게임 전투) — 맞는 곳에서 몸을 꿰뚫고 뒤로 지나가는 바람줄 + 발밑 먼지 (x = 맞는 쪽 몸 앞, dir = 맞는 쪽이 보는 쪽 = 친 쪽)
function hitRush(x, y, s, dir, ry, cols) {
    for (let i = 0; i < 9; i++) {
        const oy = y + moveRand(-1, 1) * ry * 0.9;
        sigParticle({ x: x + dir * moveRand(0, 6) * s, y: oy, s, vx: -dir * moveRand(160, 260) * s, drag: 3, max: moveRand(0.22, 0.34), len: Math.round(moveRand(6, 12)), dir, color: cols[i % 3], draw: (ctx, p, t, px) => {
            ctx.globalAlpha = hitStep(1 - t);
            const len = Math.max(2, Math.round(p.len * (1 - t * 0.6)));
            // 줄은 지나간 쪽 (친 쪽) 으로 꼬리
            dotAt(ctx, px, p.s, p.dir > 0 ? p.x : p.x - len * p.s, p.y, p.color, len, 1);
        } });
    }
    hitDust(x - dir * ry * 0.5, y + ry, s, ry, cols, 6);
}

// 상태 이상이 걸리는 순간 (2026-10-20 ideas #110 — 가루 · 노래하기 결과가 글로만 나오던 것): g = 걸린 포켓몬 모양 (sigGeometry)
//   독 = 보라 방울이 몸에서 떠올라 톡 터짐 · 화상 = 몸 위 작은 불꽃 혀 셋이 일렁 + 연기 · 마비 = 작은 지직 (moves.js sigNumb) · 잠 = Z (SIG_FX.zzz) · 나음 = 반짝 (SIG_FX.glow)
function hitStatus(g, kind) {
    const s = g.s;
    if (kind === 'poison') {
        const cols = sigPal('poison');
        for (let i = 0; i < 6; i++) {
            sigParticle({ x: g.body.cx + moveRand(-0.8, 0.8) * g.body.rx, y: g.body.cy + moveRand(-0.2, 0.6) * g.body.ry, s, vy: -moveRand(18, 32) * s, max: moveRand(0.5, 0.8), d: i * 0.07, cols, big: i % 2 === 0, draw: (ctx, p, t, px) => {
                if (p.life < p.d) {
                    return;
                }
                ctx.globalAlpha = 1;
                if (t > 0.85) {
                    // 톡 — 네 귀퉁이 점
                    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
                        dotAt(ctx, px, p.s, p.x + dx * 2 * p.s, p.y + dy * 2 * p.s, p.cols[1]);
                    }
                    return;
                }
                hitBit(ctx, px, p.s, p.x, p.y, 'bubble', p.cols, t, p.big);
            } });
        }
        return;
    }
    if (kind === 'burn') {
        const cols = sigPal('fire');
        for (let i = 0; i < 3; i++) {
            sigParticle({ x: g.body.cx + (i - 1) * g.body.rx * 0.6, y: g.body.top + g.body.ry * 0.6, s, max: 0.8, d: i * 0.1, cols, draw: (ctx, p, t, px) => {
                if (p.life < p.d) {
                    return;
                }
                ctx.globalAlpha = hitFade(t, 0.1, 0.35);
                hitBit(ctx, px, p.s, p.x, p.y, 'flame', p.cols, (p.life * 3) % 1, true);
            } });
        }
        for (let i = 0; i < 4; i++) {
            sigParticle({ x: g.body.cx + moveRand(-0.6, 0.6) * g.body.rx, y: g.body.top, s, vy: -moveRand(10, 20) * s, max: moveRand(0.6, 0.9), r: 1, cols: ['#c8c0b8', '#a09890', '#7a7068', '#5a524a'], draw: (ctx, p, t, px) => {
                ctx.globalAlpha = hitStep((1 - t) * 0.6);
                sigDisc(ctx, px, p.s, p.x, p.y, (1 + t) * p.s, p.cols[1]);
            } });
        }
        return;
    }
    if (kind === 'paralysis') {
        sigNumb(g);
        return;
    }
    if (kind === 'sleep') {
        SIG_FX.zzz.run(g, {}, SIG_FX.zzz.ms(g.P, {}));
        return;
    }
    if (kind === 'cure') {
        SIG_FX.glow.run(g, { c: 'heal' }, 600);
    }
}

// 쓰러뜨린 한 방 (2026-10-20 ideas #109) — 금색 별빛 살 8줄이 크게 뻗고 + 큰 조각 별 + 발밑 충격파 (히트스톱 0.1초와 같이 — BattleFx)
function hitKO(g) {
    const R = Math.max(14 * g.s, g.w * 0.6);
    const cols = HIT_GOLD;
    hitLines(g.body.cx, g.body.cy, g.s, R, cols, 8, 0.45);
    hitBloom(g.body.cx, g.body.cy, g.s, R * 0.8, cols, 'star', 0.6, true, { g: 40 });
    hitRing(g.body.cx, g.body.bottom, g.s, R * 0.3, R * 1.8, 0.3, 0.55, cols);
}

// 타입마다 짜임 3가지 — (x, y, s, R, cols, big, dir, ground, n, h) → 그림. n(m) = 크기만큼 수, h(m) = 솟는 높이 (정보줄 · HP 아래까지)
// 회오리는 불꽃 · 물 · 비행 · 땅만 (10타입에 있으면 모양이 다 같아 보여서, 아트 디렉터 · 플레이 리뷰어)
const HIT_STYLES = {
    fire: [
        (x, y, s, R, c, big, dir, g, n, h) => hitHelix(x, g, s, R, h(3.4), c, 'flame', 0.8, dir * 11, big), // 감아 올라가는 불길 회오리
        (x, y, s, R, c, big) => hitBloom(x, y, s, R, c, 'flame', 0.75, big, { g: -40, drag: 3 }), // 불꽃 폭발
        (x, y, s, R, c, big, dir, g, n, h) => { hitPillar(x, g, s, R, h(3.6), c, 'flame', 0.75, big); hitFountain(x, y, s, R * 0.6, c, 'dot', 0.6, false, dir); }, // 불기둥 + 불똥
    ],
    water: [
        (x, y, s, R, c, big, dir) => hitFountain(x, y, s, R, c, 'drop', 0.75, big, dir, { ring: true }), // 물보라 왕관 + 물결
        (x, y, s, R, c, big, dir, g, n, h) => hitHelix(x, g, s, R, h(3.2), c, 'drop', 0.8, dir * 10, big), // 물기둥 소용돌이
        (x, y, s, R, c, big) => hitBloom(x, y, s, R, c, 'bubble', 0.8, big, { g: -30, drag: 3.6 }), // 거품 터짐
    ],
    electric: [
        (x, y, s, R, c, big, dir, g, n) => hitBolts(x, y, s, R, c, n(4), 0.5), // 갈래 번개 (벽 금처럼 가늘게)
        (x, y, s, R, c) => hitThunder(x, y, s, R, c, 0.55), // 낙뢰
        (x, y, s, R, c, big, dir, g, n) => { hitOrbit(x, y, s, R * 1.1, c, 'sparkle', n(12), 0.6, big); hitBolts(x, y, s, R * 0.8, c, 4, 0.45); }, // 몸에 감기는 전기
    ],
    grass: [
        (x, y, s, R, c, big) => { hitClaws(x, y, s, R, c, 2); hitBloom(x, y, s, R * 0.6, c, 'leaf', 0.6, big, { g: 40, drag: 2.6 }); }, // 잎 칼날 두 줄 + 잎
        (x, y, s, R, c, big) => hitBloom(x, y, s, R, c, 'leaf', 0.8, big, { g: 40, drag: 2.6 }), // 잎 터짐
        (x, y, s, R, c, big, dir, g, n) => { hitOrbit(x, y, s, R * 1.1, c, 'leaf', n(22), 0.75, big); hitPuddle(x, g, s, R, c, 0.6); }, // 감도는 잎 + 바닥 빛
    ],
    ice: [
        (x, y, s, R, c, big) => { hitBloom(x, y, s, R, c, 'shard', 0.75, big, { g: 0, drag: 4.2 }); hitCore(x, y, s, R, c); }, // 결정 조각 박힘
        (x, y, s, R, c, big, dir, g) => { hitRain(x, y, s, R, c, 'shard', 0.7, big); hitPuddle(x, g, s, R, c, 0.7); }, // 고드름 쏟아짐 + 서리
        (x, y, s, R, c, big, dir, g, n) => hitSpikes(x, g, s, R, c, n(5), 0.8), // 얼음 가시 솟음
    ],
    fighting: [
        (x, y, s, R, c, big, dir, g) => { sigPow(x, y, s, c, 0.5, big); hitDust(x, g, s, R, c, 8); }, // 퍽 + 먼지
        (x, y, s, R, c, big, dir, g, n) => hitFlurry(x, y, s, R, c, n(4)), // 연타
        (x, y, s, R, c, big, dir, g) => { hitPulses(x, g, s, R, c, 2); hitLines(x, y, s, R, c, 4, 0.3); }, // 발밑 충격파 + 충격선
    ],
    poison: [
        (x, y, s, R, c, big, dir) => hitFountain(x, y, s, R, c, 'bubble', 0.75, big, dir), // 독방울 튐
        (x, y, s, R, c, big, dir, g, n) => { hitWisps(x, y, s, R, c, n(8), 0.85); hitPuddle(x, g, s, R, c, 0.7); }, // 독 안개 + 웅덩이
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
        (x, y, s, R, c, big, dir, g, n) => { hitOrbit(x, y, s, R * 1.1, c, 'feather', n(20), 0.7, big); hitRing(x, g, s, R * 0.4, R * 1.4, 0.3, 0.4, c); }, // 깃털 흩날림 + 발밑 바람 호
        (x, y, s, R, c, big) => hitBloom(x, y, s, R, c, 'feather', 0.7, big, { g: 20, drag: 3 }), // 바람 터짐
    ],
    psychic: [
        (x, y, s, R, c, big, dir, g, n) => { hitWaves(x, y, s, R, c, big ? 4 : 3, 0.6); hitOrbit(x, y, s, R, c, 'sparkle', n(6), 0.65, big); }, // 염동 물결 + 반짝이
        (x, y, s, R, c, big) => hitBloom(x, y, s, R, c, 'sparkle', 0.7, big, { g: 0, drag: 4 }), // 염동 폭발
        (x, y, s, R, c, big, dir, g, n) => hitOrbit(x, y, s, R, c, 'sparkle', n(18), 0.7, big, true), // 안으로 빨려 드는 빛
    ],
    bug: [
        (x, y, s, R, c, big, dir, g, n) => { hitLines(x, y, s, R * 0.9, c, n(10), 0.32); hitBloom(x, y, s, R * 0.7, c, 'dot', 0.45, big, { g: 80 }); }, // 가시 별
        (x, y, s, R, c, big, dir, g, n) => hitOrbit(x, y, s, R, c, 'leaf', n(22), 0.65, big), // 날개 가루
        (x, y, s, R, c) => hitClaws(x, y, s, R, c, 2, true), // 집게 X 베기
    ],
    ghost: [
        (x, y, s, R, c, big, dir, g, n) => { hitWisps(x, y, s, R, c, n(8), 0.85); hitPulses(x, g, s, R, c, 1); }, // 혼 + 발밑 그림자 호
        (x, y, s, R, c, big, dir, g, n) => { hitWisps(x, y, s, R, c, n(12), 0.85); hitRain(x, y, s, R, c, 'flame', 0.6, big); }, // 혼 + 떨어지는 도깨비불
        (x, y, s, R, c, big, dir, g, n) => hitSpikes(x, g, s, R, [c[0], c[0], c[1], c[2]], n(5), 0.8), // 그림자 가시 (짙은 두 색은 숲 밤 배경에 묻혀서 한 단계 밝게)
    ],
    dragon: [
        (x, y, s, R, c) => hitClaws(x, y, s, R, c, 3), // 용 발톱 세 줄
        (x, y, s, R, c, big) => hitBloom(x, y, s, R, c, 'shard', 0.75, big, { g: 0, drag: 3.6 }), // 비늘 폭발
        (x, y, s, R, c, big, dir, g, n, h) => hitPillar(x, g, s, R, h(3.6), c, 'shard', 0.8, big), // 비늘 기둥
    ],
    dark: [
        (x, y, s, R, c) => hitClaws(x, y, s, R, c, 2, true), // X 베기
        (x, y, s, R, c, big) => hitBloom(x, y, s, R, c, 'shard', 0.7, big, { g: 10, drag: 3.4 }), // 어둠 조각 터짐
        (x, y, s, R, c, big, dir, g, n) => hitFlurry(x, y, s, R, c, n(4)), // 연속 기습
    ],
    steel: [
        (x, y, s, R, c, big, dir, g, n) => { hitFountain(x, y, s, R, HIT_GOLD, 'dot', 0.55, big, dir); hitLines(x, y, s, R * 0.8, c, 4, 0.3); }, // 쇳조각 불똥 + 충격선
        (x, y, s, R, c) => { hitClaws(x, y, s, R, c, 2, true); hitCore(x, y, s, R, c); }, // 강철 베기
        (x, y, s, R, c, big, dir, g, n) => { hitSpikes(x, g, s, R, c, n(4), 0.75); hitFountain(x, y, s, R * 0.6, HIT_GOLD, 'dot', 0.5, false, dir); }, // 쇠 가시 + 불똥
    ],
    fairy: [
        (x, y, s, R, c, big, dir, g, n) => hitOrbit(x, y, s, R * 1.1, c, 'heart', n(10), 0.75, big), // 감도는 하트
        (x, y, s, R, c, big) => hitBloom(x, y, s, R, c, 'sparkle', 0.8, big, { g: -10, drag: 3 }), // 반짝 폭발
        (x, y, s, R, c, big) => hitRain(x, y, s, R, c, 'heart', 0.7, big), // 하트 쏟아짐
    ],
    normal: [
        (x, y, s, R, c, big, dir, g, n) => { hitLines(x, y, s, R, c, n(8), 0.34); hitBloom(x, y, s, R * 0.8, c, 'star', 0.5, big, { g: 60 }); }, // 별 터짐
        (x, y, s, R, c, big, dir, g, n) => hitFlurry(x, y, s, R, c, n(3)), // 연타 퍽
        (x, y, s, R, c, big, dir, g) => { hitPulses(x, g, s, R, c, 2); hitLines(x, y, s, R, c, 4, 0.3); }, // 쿵 발밑 충격파 + 충격선
    ],
};

// 기술이 맞는 순간 — 타입 · 기술마다 다른 도트 임팩트 (위 설명). 크기 R = 맞는 포켓몬 몸 반쯤 (작은 패널에서도 보이게 최소 12칸) × 상성 · 막음 배
function typeImpact(x, y, s, type, P = 0.5, big = false, dir = 1, w = 0, o = {}) {
    const cols = hitCols(type);
    const k = (big ? 1.3 : 1) * (0.9 + 0.25 * P) * (o.scale ?? 1) * (o.light ? 0.6 : 1) * (o.basic ? 0.7 : 1);
    const R = Math.max(12 * s * Math.min(1, o.scale ?? 1), (w || 28 * s) * 0.45) * k;
    const n = (m) => Math.max(1, Math.round(m * k));
    // 발밑 = 맞는 포켓몬 그림 아래 끝 (없으면 어림) — 센 기술에서 R 이 커져도 땅 아래로 안 내려감
    const ground = o.bottom ?? y + R * 0.95;
    // 효과가 없음 — 회색 연기만 조금
    if (o.none) {
        hitDust(x, ground, s, R, sigPal('normal'), 6);
        return;
    }
    // 위로 솟는 짜임 (회오리 · 기둥) 은 정보줄 · 맞는 쪽 HP 묶음 아래까지만 — 넘으면 잘리거나 HP 글자를 덮어서
    let ceil = typeof fxTop === 'function' ? fxTop() : 0;
    if (typeof fxHudRects === 'function') {
        for (const r of fxHudRects()) {
            if (x >= r.left - R && x <= r.right + R && r.bottom < ground) {
                ceil = Math.max(ceil, r.bottom);
            }
        }
    }
    const room = ground - ceil - 2 * s;
    const h = (m) => Math.max(R * 1.6, Math.min(R * m, room));
    // 1 공격 (몸통박치기) 은 노말 별 터짐을 작게, 색만 타입 — 기술 · 필살기보다 수수하게 (플레이 리뷰어)
    const styles = o.basic ? HIT_STYLES.normal : HIT_STYLES[type] || HIT_STYLES.normal;
    const style = styles[(o.pick ?? 0) % styles.length];
    hitQuiet = !!(o.light || o.basic);
    try {
        hitCore(x, y, s, R * 0.8, cols);
        style(x, y, s, R, cols, big, dir || 1, ground, n, h);
    } finally {
        hitQuiet = false;
    }
    // 센 기술 · 효과가 굉장하면 화면도 살짝 (게임 중엔 배경 · 포켓몬만 2 ~ 3px — ult/core.js ultShake)
    if ((big || (o.scale ?? 1) > 1) && !o.light && typeof ultShake === 'function') {
        ultShake(2, 200);
    }
}
