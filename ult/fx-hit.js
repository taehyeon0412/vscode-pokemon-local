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
// 맞는 곳에서 가까운 패널 끝까지 남은 가로 (px) — 땅 금 · 고리 · 바위가 240 에서 패널 밖으로 잘리지 않게 크기를 여기서 자름 · 860 은 전 크기 그대로 (#122 2단계 기획 — 센 기술 넷 되돌림)
//   3:3 판 (moveFrame — 판 좌표) 은 자르지 않음
const hitRoom = (x, s) => (typeof moveFrame !== 'undefined' && moveFrame ? Infinity : Math.max(6 * s, Math.min(x, window.innerWidth - x) - 4 * s));
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

// 돌 조각 모양 (hitBit 'rock')
const HIT_ROCK_BIG = ['.###..', '#####.', '######', '.#####'];
const HIT_ROCK = ['.##..', '####.', '#####', '.####'];
// 돌 모양 (mask '#') 그리기 — 1칸 짙은 테 · 속은 한 색 (왼쪽 위 두 칸 밝게 · 오른쪽 아래 안 한 칸 어둡게)
//   shade = 큰 바위 (무덤 · 깨지는 바위) — 속 윗줄 · 왼줄 앞쪽 밝게 · 오른줄 · 아랫줄 그늘 (한 색 판이면 큰 바위가 납작한 판자로 읽혀서)
function hitRockMask(ctx, px, s, x, y, mask, cols, shade) {
    const c = (i) => cols[Math.min(3, Math.max(0, i))];
    const on = (dx, dy) => mask[dy]?.[dx] === '#';
    const solid = (dx, dy) => on(dx - 1, dy) && on(dx + 1, dy) && on(dx, dy - 1) && on(dx, dy + 1);
    let inner = 0;
    const last = mask.reduce((m, row, dy) => m + [...row].filter((ch, dx) => ch === '#' && solid(dx, dy)).length, 0);
    for (let dy = 0; dy < mask.length; dy++) {
        for (let dx = 0; dx < mask[dy].length; dx++) {
            if (!on(dx, dy)) {
                continue;
            }
            const edge = !solid(dx, dy);
            let col = edge ? '#3a2e20' : inner < 2 ? c(0) : inner === last - 1 ? c(3) : c(1);
            if (shade && !edge) {
                const lit = (!solid(dx, dy - 1) && dx < mask[dy].length * 0.6) || (!solid(dx - 1, dy) && dy < mask.length * 0.5);
                // 속 띄엄띄엄 그늘 점 (돌 결 — 한 색 판은 매끈한 기둥으로 읽혀서, 자기 비평)
                col = lit ? c(0) : !solid(dx + 1, dy) || !solid(dx, dy + 1) || (dx * 7 + dy * 13) % 11 === 0 ? c(2) : c(1);
            }
            if (!edge) {
                inner += 1;
            }
            dotAt(ctx, px, s, x + dx * s, y + dy * s, col);
        }
    }
}
// 큰 바위 모양 w × h 칸 — 위 두 줄 · 아래 한 줄을 깎고 옆에 가끔 1칸 홈 (네모 · 삼각형으로 안 읽히게)
function hitBoulderMask(w, h) {
    const rows = [];
    for (let j = 0; j < h; j++) {
        let l = j === 0 ? 2 : j === 1 || j === h - 1 ? 1 : 0;
        let r = l;
        if (j > 1 && j < h - 1 && Math.random() < 0.3) {
            if (Math.random() < 0.5) {
                l += 1;
            } else {
                r += 1;
            }
        }
        rows.push('.'.repeat(l) + '#'.repeat(Math.max(1, w - l - r)) + '.'.repeat(r));
    }
    return rows;
}

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
            // 돌 — 두 톤 + 1칸 짙은 테 · 속은 한 색 (왼쪽 위 두 칸 밝게 · 오른쪽 아래 안 한 칸 어둡게) — 속을 바둑판으로 칠해 1배에서 X 무늬 상자로 보이던 것 (아트 디렉터 #122)
            //   큰 돌 6 × 4 · 작은 돌 5 × 4 (모서리 하나씩 더 깎음 — 네모로 안 읽히게)
            hitRockMask(ctx, px, s, x, y, big ? HIT_ROCK_BIG : HIT_ROCK, cols, false);
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
        case 'bee':
            // 벌 — 3 × 2 (노랑 · 검정 · 노랑 세로 줄) + 위 흰 날개 1칸 (공격지령 — 2 × 2 는 1배에서 노란 점으로만 보이던 것, #122 2단계 아트 2바퀴)
            dotAt(ctx, px, s, x - s, y, '#ffd76a', 1, 2);
            dotAt(ctx, px, s, x, y, '#1a1626', 1, 2);
            dotAt(ctx, px, s, x + s, y, '#ffd76a', 1, 2);
            dotAt(ctx, px, s, x, y - s, '#ffffff');
            break;
        case 'bone':
            // 뼈 조각 — 3 × 1 막대 + 양끝 2칸 (뼈다귀치기 · 본러시 · 뼈다귀부메랑 — 크림 퍽만이라 "뼈" 가 안 보이던 것)
            dotAt(ctx, px, s, x - s, y, c(1), 3, 1);
            dotAt(ctx, px, s, x - 2 * s, y - s, c(0), 1, 2);
            dotAt(ctx, px, s, x + 2 * s, y - s, c(0), 1, 2);
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
//   opt.n = 처음 큰 조각 수 (기본 6) · opt.only = 큰 조각만 (내뿜기 없음 — 큰 별 · 돌 몇 개만, 뭉게 덩이가 안 되게) · opt.rate = 내뿜기 1초 수 (#122 2단계 아트)
function hitBloom(x, y, s, R, cols, shape, sec, big, opt = {}) {
    const n0 = opt.n ?? 6;
    for (let i = 0; i < n0; i++) {
        const a = (i / n0) * Math.PI * 2 + moveRand(-0.2, 0.2);
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
    if (opt.only) {
        return;
    }
    const until = performance.now() + Math.min(300, sec * 400);
    sigEmitter({ until, rate: opt.rate ?? (big ? 130 : 90), fx: () => {
        const a = moveRand(0, Math.PI * 2);
        const v = moveRand(1, 1.8) * R * 3.2;
        sigParticle({ x, y, s, vx: Math.cos(a) * v, vy: Math.sin(a) * v * (opt.flat ?? 0.85), g: (opt.g ?? 30) * s, drag: opt.drag ?? 3.2, max: moveRand(0.45, 0.75) * (sec / 0.7), cols, shape, big: Math.random() < 0.7, draw: (ctx, p, t, px) => {
            ctx.globalAlpha = hitFade(t, 0.05, 0.4);
            hitBit(ctx, px, p.s, p.x, p.y, p.shape, p.cols, t, p.big);
        } });
    } });
}

// ── 짜임: 기둥 — 발밑에서 위로 솟구치는 기둥 (불기둥 · 독 기둥 · 비늘 기둥)
//   top = 불똥이 넘지 않는 위 끝 (맞는 쪽 HP 묶음 아래 — 대지의힘 불똥이 기둥보다 1.5배 높이 올라 HP 막대 · Lv 를 덮던 것, #122 2단계 아트 2바퀴)
function hitPillar(x, ground, s, R, H, cols, shape, sec, big, top) {
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
        sigParticle({ x: x + moveRand(-0.7, 0.7) * R, y: ground - moveRand(0, 0.3) * H, s, vx: moveRand(-15, 15) * s, vy: -moveRand(1.2, 2.2) * H, drag: 1.5, max: moveRand(0.3, 0.55), cols, shape, big, top, update: (p) => {
            if (p.top !== undefined && p.y < p.top) {
                p.life = p.max;
            }
        }, draw: (ctx, p, t, px) => {
            ctx.globalAlpha = hitFade(t, 0.05, 0.4);
            hitBit(ctx, px, p.s, p.x, p.y, p.shape, p.cols, t, false);
        } });
    } });
}

// ── 짜임: 분수 — 위로 부채꼴로 튀어 올랐다 떨어짐 (물보라 왕관 · 독방울 · 돌 부스러기 · 불똥) · 바닥 물결은 opt.ring 일 때만
//   돌 ('rock') 은 적게 (1초 60 · 큰 돌 25 / 15%) · 발 쪽 (y + 0.7R) 에서 — 덩이 터짐은 개수를 적게 하나하나 또렷하게 (테 있는 돌 50 ~ 68개가 몸 가운데서 겹쳐 솔방울 덩이가 되던 것, 아트 디렉터 #122 2바퀴)
//   opt.rate = 1초 수 (별 · 방울은 30 안팎 — 190개가 0.3 ~ 0.9R 안에 겹쳐 머리 위 덩이가 되던 것, #122 2단계 아트)
function hitFountain(x, y, s, R, cols, shape, sec, big, dir, opt = {}) {
    const rock = shape === 'rock';
    sigEmitter({ until: performance.now() + 260, rate: opt.rate ?? (rock ? 60 : big ? 260 : 190), fx: () => {
        const a = -Math.PI / 2 + moveRand(-(opt.spread ?? 1.15), opt.spread ?? 1.15) + dir * (opt.spread ? 0 : 0.2);
        const v = moveRand(1, 1.5) * R * 4.6;
        sigParticle({ x: x + moveRand(-0.3, 0.3) * R, y: y + R * (rock ? 0.7 : 0.3), s, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: R * 9, drag: 0.5, max: moveRand(0.5, 0.8) * (sec / 0.7), cols, shape, big: Math.random() < (rock ? (big ? 0.25 : 0.15) : big ? 0.6 : 0.35), draw: (ctx, p, t, px) => {
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
//   opt.slim = 가는 가시 넷이 몸 양옆에서 (가운데 없음 · 왼쪽 반 cols[1] · 오른쪽 반 cols[3] · 끝 cols[0] · 1칸 짙은 테) — 붙은 가시 다섯이 줄무늬 피라미드로 상대를 0.33초 가리던 것 (양날박치기, 아트 디렉터 #122)
function hitSpikes(x, ground, s, R, cols, n, sec, opt = {}) {
    const slim = !!opt.slim;
    const at = slim ? [-2, -1, 1, 2].map((k) => k * R * 0.75) : [...Array(n).keys()].map((i) => (i - (n - 1) / 2) * R * 0.55);
    at.forEach((ox, i) => {
        const hMax = R * moveRand(0.9, slim ? 1.5 : 1.6) * (1 - Math.abs(ox) / (R * (slim ? 3 : 2.2)));
        sigParticle({ x: x + ox, y: ground, s, max: sec, d: slim ? (Math.abs(ox) / R) * 0.04 : Math.abs(i - (n - 1) / 2) * 0.05, hMax, cols, draw: (ctx, p, t, px) => {
            const k = t < p.d ? 0 : Math.min(1, (t - p.d) / 0.18);
            const fall = t > 0.7 ? (1 - t) / 0.3 : 1;
            const h = Math.round((p.hMax * k * fall) / p.s);
            ctx.globalAlpha = 1;
            for (let j = 0; j < h; j++) {
                const y = p.y - j * p.s;
                if (!slim) {
                    const half = Math.max(0, Math.round((h - j) * 0.35));
                    dotAt(ctx, px, p.s, p.x - half * p.s, y, j === h - 1 ? p.cols[0] : p.cols[2 + (j % 2)], 2 * half + 1, 1);
                    continue;
                }
                const half = Math.max(0, Math.round((h - j) * 0.18));
                dotAt(ctx, px, p.s, p.x - (half + 1) * p.s, y, '#3a2e20', 2 * half + 3, 1);
                if (j === h - 1) {
                    dotAt(ctx, px, p.s, p.x - half * p.s, y, p.cols[0], 2 * half + 1, 1);
                    continue;
                }
                dotAt(ctx, px, p.s, p.x - half * p.s, y, p.cols[1], half + 1, 1);
                if (half > 0) {
                    dotAt(ctx, px, p.s, p.x + p.s, y, p.cols[3], half, 1);
                }
            }
            if (slim && h > 0) {
                dotAt(ctx, px, p.s, p.x, p.y - h * p.s, '#3a2e20');
            }
        } });
    });
    hitDust(x, ground, s, R, cols, 10);
}

// 땅 금 — 발밑에서 옆으로 뻗는 1칸 짙은 금 셋 (이판사판태클 — 퍽만으로는 노말 돌진 묶음이 크기만 달라서, 아트 디렉터 #122)
//   금 = 위 #3a2e20 (흙 · 돌 테 — design-system #122) 홈 1칸 + 아래 cols[2] 빛 받는 아랫단 1칸 (짙은 1칸만은 밤 숲 땅에 묻히고, 밝은 줄이 위면 솟은 발판으로 읽혀서 — 아트 디렉터 2 · 3바퀴)
//   셋은 시작 x 를 ±0.2R 엇갈리고 끝 y 를 3칸씩 벌림 (겹쳐 베이지 판자 하나가 되던 것)
function hitCracks(x, ground, s, R, cols, sec) {
    const paths = [-1, 1, -1].map((side, i) => {
        const x0 = x + (i - 1) * R * 0.2;
        // 〔#122 2단계 · bugs 2666〕 꺾임 3 → 1.5칸 — 땅선 아래 25 ~ 33px 까지 내려가 그루터기 · 판처럼 보이던 것 (깊이 0.4R 안)
        return zigzag(x0, ground, x0 + side * R * moveRand(0.7, 1.2), ground + (i - 1) * 3 * s, s, 1.5, 3);
    });
    sigParticle({ x, y: ground, s, max: sec, paths, cols, draw: (ctx, p, t, px) => {
        ctx.globalAlpha = hitStep(t > 0.6 ? (1 - t) / 0.4 : 1);
        const k = Math.min(1, t / 0.15);
        p.paths.forEach((path) => {
            const part = path.slice(0, Math.max(2, Math.ceil(path.length * k)));
            zapLine(ctx, px, p.s, part.map(([px0, py0]) => [px0, py0 + p.s]), 1, p.cols[2], p.cols[2]);
            zapLine(ctx, px, p.s, part, 1, '#3a2e20', '#3a2e20');
        });
    } });
}

// 땅 고리 여럿 — 발밑에서 퍼지는 납작한 고리 (반지름 r1s · 고리 사이 every ms · 하나 sec 초) · 패널 끝 (hitRoom) 안으로 자름
function hitGroundRings(x, ground, s, R, cols, r1s, every, sec) {
    const room = hitRoom(x, s);
    r1s.forEach((m, i) => setTimeout(() => hitRing(x, ground, s, R * 0.3, Math.min(room, R * m), 0.3, sec, cols), i * every));
}

// 무덤 — 상대 양옆에 돌무더기 (넓은 밑돌 위에 작은 윗돌 · 바깥 발치에 작은 돌) 가 차례로 떨어져 쌓이고 (높이 = 몸 높이쯤) 0.6초 머문 뒤 윗돌부터 무너짐 (암석봉인)
//   #122 2단계 기획: 돌 하나 + 조약돌로 끝나 "무덤" 이 안 보이던 것 · 줄무늬 삼각형 (hitSpikes) 은 안 씀 · 몸은 덮지 않게 몸 옆에 · 좁고 높은 돌 하나는 기둥으로 읽혀서 (자기 비평) 밑돌 + 윗돌
function hitTomb(x, y, s, R, cols, ground, top) {
    const room = hitRoom(x, s);
    // 높이 = 몸 높이쯤 (발 − 맞는 곳 × 1.2 — 1.7 은 몸의 1.44배로 머리 위 14px, 픽셀 5바퀴)
    const H = Math.max(8, Math.round(Math.min(ground - top, (ground - y) * 1.2) / s));
    const BW = 10;
    const ix = Math.max(0, Math.min(R * 0.7, room - BW * s));
    const baseH = Math.max(4, Math.round(H * 0.55));
    const topH = Math.max(3, H - baseH + 1);
    const stones = [];
    [-1, 1].forEach((side, k) => {
        const left = (w, off) => (side > 0 ? x + ix + off * s : x - ix - (off + w) * s);
        stones.push({ left: left(BW, 0), w: BW, h: baseH, bottom: ground, d: 0.05 * k, sink: 1.0, side });
        // 윗돌은 몸 쪽 끝에 맞춰 얹음 (안으로 기운 더미 — 가운데 얹으면 눈사람 · 토템으로 읽혀서, 자기 비평 2)
        stones.push({ left: left(8, 0), w: 8, h: topH, bottom: ground - (baseH - 1) * s, d: 0.12 + 0.05 * k, sink: 0.86, side });
        // 바깥 발치 돌은 패널 끝 안에 들어갈 때만 (240)
        if (ix + (BW + 5) * s <= room) {
            stones.push({ left: left(6, BW - 1), w: 6, h: 4, bottom: ground, d: 0.22 + 0.04 * k, sink: 1.0, side });
        }
    });
    // 바깥 · 밑돌 먼저 그려 윗돌 · 안쪽이 1칸 겹쳐 앞에 옴 (쌓인 더미)
    stones.sort((a, b) => a.d - b.d).forEach((st) => {
        const mask = hitBoulderMask(st.w, st.h);
        const fall = Math.max(0, Math.min(st.h * s * 1.5, st.bottom - st.h * s - top));
        sigParticle({ x: st.left, y: st.bottom, s, max: st.sink + 0.2, d: st.d, sink: st.sink, side: st.side, mask, fall, cols,
            update: (p) => {
                const cx = p.x + (p.mask[0].length * p.s) / 2;
                if (!p.landed && p.life >= p.d + 0.12) {
                    p.landed = true;
                    sigBurst(cx, p.y, p.s, p.cols, 4, 25);
                }
                if (!p.broke && p.life >= p.sink) {
                    p.broke = true;
                    // 바깥으로 튀는 조각은 패널 끝까지 남은 칸 안 (240 끝 0px 에 닿던 것, 픽셀 5바퀴) — 0.5초에 갈 거리로 빠르기를 자름 (오른쪽은 작은 돌 폭 5칸 더)
                    const out = Math.max(0, p.side > 0 ? x + room - (cx + 7 * p.s) : cx - 3 * p.s - (x - room));
                    for (let i = 0; i < 3; i++) {
                        const side = i % 2 ? -1 : 1;
                        sigParticle({ x: cx + side * moveRand(0, 2) * p.s, y: p.y - p.mask.length * p.s * moveRand(0.3, 0.7), s: p.s, vx: side * (side === p.side ? Math.min(moveRand(10, 30) * p.s, out / 0.5) : moveRand(10, 30) * p.s), vy: -moveRand(20, 45) * p.s, g: 260 * p.s, max: moveRand(0.3, 0.4), cols: p.cols, ground,
                            update: (q) => {
                                if (q.vy > 0 && q.y >= q.ground - 4 * q.s) {
                                    q.life = q.max;
                                }
                            },
                            draw: (ctx, q, t, px) => {
                                ctx.globalAlpha = 1;
                                hitBit(ctx, px, q.s, q.x, q.y, 'rock', q.cols, t, false);
                            } });
                    }
                }
            },
            draw: (ctx, p, t, px) => {
                const L = p.life - p.d;
                if (L < 0) {
                    return;
                }
                const k = Math.min(1, L / 0.12);
                // 무너짐 = 위 줄부터 0.15초에 걸쳐 가라앉음
                const rows = p.life > p.sink ? p.mask.slice(Math.ceil(p.mask.length * Math.min(1, (p.life - p.sink) / 0.15))) : p.mask;
                if (!rows.length) {
                    return;
                }
                ctx.globalAlpha = 1;
                hitRockMask(ctx, px, p.s, p.x, p.y - rows.length * p.s - (1 - k * k) * p.fall, rows, p.cols, true);
            } });
    });
}

// 돌 조각 튐 — 가운데에서 위 · 옆 부채꼴로 튀어 땅에 떨어지는 돌 n개 (빠르기 · 각도 제각각 — 같은 빠르기면 공중에 동그란 고리로 떠 있어서, 자기 비평)
//   땅에 닿으면 굴러 멈춤
function hitScatter(x, y, s, R, cols, n, ground, top) {
    // 조각마다 따로 자르면 멀리 가려던 조각이 모두 같은 한계에 모여 240 에서 세로 기둥 · 860 에서 머리 높이 한 줄이 되던 것 (UX 8 · 9바퀴)
    //   → 쪽마다 공통 배를 곱해 퍼진 모양을 지킴: 옆 배 kr · kl = 그쪽 남은 칸 ÷ 그쪽으로 실제로 가는 거리 (240 에서 좁은 쪽 하나로 부채꼴 전체가 쪼그라들어서) · 위 배 ku = 공통
    //   거리는 moveStep 과 같은 셈 (끌림 exp(−drag·dt) · 무게) 으로 미리 굴려 봄
    const inFrame = typeof moveFrame !== 'undefined' && moveFrame;
    const roomR = inFrame ? Infinity : window.innerWidth - x - 10 * s;
    const roomL = inFrame ? Infinity : x - 4 * s;
    const G = R * 12;
    const DRAG = 1.2;
    const bits = [...Array(n).keys()].map((i) => {
        const a = -Math.PI / 2 + (i / Math.max(1, n - 1) - 0.5) * 2.6 + moveRand(-0.15, 0.15);
        // 빠르기 × 6.5 (5 는 전 반경의 78% — 픽셀 5바퀴)
        const v = moveRand(0.7, 1.25) * R * 6.5;
        return { vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.8, max: moveRand(0.65, 0.85), big: Math.random() < 0.4 };
    });
    const reach = (kr, kl, ku) => {
        const m = { r: 0, l: 0, up: 0 };
        const keep = Math.exp(-DRAG / 60);
        for (const b of bits) {
            let px = 0;
            let py = 0;
            let vx = b.vx * (b.vx > 0 ? kr : kl) * ku;
            let vy = b.vy * ku;
            for (let t = 0; t < b.max; t += 1 / 60) {
                vx *= keep;
                vy = vy * keep + G / 60;
                px += vx / 60;
                py += vy / 60;
                m.r = Math.max(m.r, px);
                m.l = Math.max(m.l, -px);
                m.up = Math.max(m.up, -py);
                if (vy > 0 && y + py >= ground - 4 * s) {
                    break;
                }
            }
        }
        return m;
    };
    let kr = 1;
    let kl = 1;
    let ku = 1;
    for (let pass = 0; pass < 2; pass++) {
        const m = reach(kr, kl, ku);
        ku *= Math.min(1, Math.sqrt(Math.max(0, y - top) / Math.max(1, m.up)));
        kr *= Math.min(1, roomR / Math.max(1, m.r));
        kl *= Math.min(1, roomL / Math.max(1, m.l));
    }
    for (const b of bits) {
        sigParticle({ x, y, s, vx: b.vx * (b.vx > 0 ? kr : kl) * ku, vy: b.vy * ku, g: G, drag: DRAG, max: b.max, cols, big: b.big, ground,
            update: (p) => {
                if (p.vy > 0 && p.y >= p.ground - 4 * p.s) {
                    p.y = p.ground - 4 * p.s;
                    p.vy = 0;
                    p.vx *= 0.5;
                }
            },
            draw: (ctx, p, t, px) => {
                ctx.globalAlpha = t > 0.8 ? 0.5 : 1;
                hitBit(ctx, px, p.s, p.x, p.y, 'rock', p.cols, t, p.big);
            } });
    }
}

// 깨지는 큰 바위 — 맞는 곳 가운데에 12 × 8 칸 바위가 0.05초 보였다 금이 가고 0.14초에 양쪽으로 쪼개짐 (암석포 — 날아온 바위가 깨지는 한 장면)
function hitBreakRock(x, y, s, cols) {
    const W = 12;
    const H = 8;
    const mask = hitBoulderMask(W, H);
    const crack = [...Array(H).keys()].map((j) => Math.round(W / 2 + (j % 3 === 1 ? 1 : 0) - j * 0.25));
    sigParticle({ x: x - (W * s) / 2, y: y - (H * s) / 2, s, max: 0.16, mask, crack, cols, draw: (ctx, p, t, px) => {
        ctx.globalAlpha = 1;
        const L = p.life;
        const gap = L < 0.09 ? 0 : Math.ceil((L - 0.09) / 0.025);
        const halves = [p.mask.map((row, j) => row.slice(0, p.crack[j]) + '.'.repeat(row.length - p.crack[j])), p.mask.map((row, j) => '.'.repeat(p.crack[j]) + row.slice(p.crack[j]))];
        hitRockMask(ctx, px, p.s, p.x - gap * p.s, p.y, halves[0], p.cols, true);
        hitRockMask(ctx, px, p.s, p.x + gap * p.s, p.y, halves[1], p.cols, true);
        if (L >= 0.05 && gap === 0) {
            p.crack.forEach((cx, j) => dotAt(ctx, px, p.s, p.x + cx * p.s, p.y + j * p.s, '#3a2e20'));
        }
    } });
}

// 얼음 구름 — 0.1초 늦게 피기 시작 (뿜기 앞머리 · 회오리가 가장 진한 첫 0.1초와 겹쳐 몸 가림이 0.2초 경계이던 것, 리드 8바퀴) · 몸 둘레 (반지름 0.7 ~ 1 × R — 0.55 는 쓰러뜨린 한 방의 금빛과 더해 몸 50% 를 0.24 ~ 0.38초 덮어서, 픽셀 5바퀴) 를 감도는 작은 눈 점 n개 · 가끔 5칸 눈송이 · sec 초 머묾 (눈보라 — 맞는 곳 얼음 터짐이 작고 빨리 사라지던 것, #122 2단계 기획)
//   점은 1칸 (네모 덩어리 아님) · 몸 가운데는 비움 (몸을 덮지 않게) · 위 끝 top · 패널 끝 (hitRoom) 안
function hitSnowCloud(x, y, s, R, cols, n, sec, dir, top, ground, hole) {
    // 점을 하나씩 위 끝 · 땅 · 패널 끝에 붙잡으면 그 줄에 점이 일자로 늘어서 점선 네모 (고르기 상자) 가 되던 것 (UX 8바퀴 큼) → 타원 반지름을 처음부터 남은 칸에 맞춤
    const DROP = 4 * s;
    const rx = Math.max(4 * s, Math.min(R, hitRoom(x, s)));
    // 가운데 = 위 끝 ~ 땅 사이 가운데보다 낮지 않게 · 아래는 땅 2칸 아래까지 (맞는 곳 가운데 · 땅 − 떨어짐으로 자르면 세로가 늘 8px 안팎으로 납작해져서, 리드 7 · 9바퀴)
    const cy = Math.min(y, (top + ground + 2 * s) / 2);
    const ry = Math.max(3 * s, Math.min(R * 0.8, cy - top - 2 * s, ground + 2 * s - cy - DROP));
    for (let i = 0; i < n; i++) {
        // 납작한 구름 (세로 < 가로 0.6 — HP 묶음이 가까움) 은 위아래 호가 몸을 가로질러 가운데를 비워도 몸을 덮어서 (픽셀 6바퀴) 점 4개 중 3개를 몸 양옆 (±50°) 에 둠
        const side = ry < rx * 0.6 && Math.random() < 0.75;
        const a = side ? moveRand(-0.87, 0.87) + (Math.random() < 0.5 ? Math.PI : 0) : moveRand(0, Math.PI * 2);
        const k = 0.7 + 0.3 * Math.sqrt(Math.random());
        sigParticle({ x: x + Math.cos(a) * rx * k, y: cy + Math.sin(a) * ry * k, s, max: moveRand(0.75, 1) * sec + 0.3, d: moveRand(0.1, 0.3), a, k, w: dir * moveRand(1.5, 2.6), drop: 0, cols, star: Math.random() < 0.2, c: movePick([0, 0, 1, 2]),
            update: (p, dt) => {
                p.a += p.w * dt;
                p.drop += DROP * dt;
                p.x = x + Math.cos(p.a) * rx * p.k;
                p.y = cy + Math.sin(p.a) * ry * p.k + p.drop;
            },
            draw: (ctx, p, t, px) => {
                if (p.life < p.d) {
                    return;
                }
                // 몸 앞 (hole 타원 — 몸 반높이 (발 − 맞는 곳) 로 잼 · R 로 재면 효과가 별로일 때 R 이 작아 구멍이 몸보다 작았음) 을 지나는 점은 안 그림 = 몸 뒤로 도는 것처럼 (240 에서 가로가 몸 반폭까지 눌려 몸 50% 를 0.23초 덮던 것, 리드 7바퀴)
                if (hole && ((p.x - x) / hole.rx) ** 2 + ((p.y - hole.y) / hole.ry) ** 2 < 1) {
                    return;
                }
                ctx.globalAlpha = hitFade((p.life - p.d) / (p.max - p.d), 0.1, 0.35);
                dotAt(ctx, px, p.s, p.x, p.y, p.cols[p.c]);
                if (p.star) {
                    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                        dotAt(ctx, px, p.s, p.x + dx * p.s, p.y + dy * p.s, p.cols[1]);
                    }
                }
            } });
    }
}

// 솟는 빛 — 몸 위로 곧게 솟는 빛 줄 (흰 심 1칸 + 색 1칸 · 위 끝 top 아래까지) — 어퍼컷 (스카이어퍼 — 블레이즈킥과 같은 주황 퍽으로 보이던 것, 아트 디렉터 #122)
//   머리 위 (y − R) 에서 0.6R 조각이 위로 달려감 · 가운데 100% · 옆 60% 높이 (몸 가운데부터 이은 기둥 셋이 몸 위 "|||" 창살이 되던 것, 아트 디렉터 2바퀴)
function hitRise(x, y, s, R, cols, n, sec, top) {
    for (let i = 0; i < n; i++) {
        const mid = i === (n - 1) / 2;
        //   〔3바퀴〕 조각 0.4R · 옆 줄 ±15° 기울임 · 위 끝 (HP 묶음 아래) 에 닿은 조각은 사라짐 (위 끝 아래에 쌓여 "|||" 왕관처럼 멈춰 보이던 것)
        sigParticle({ x: x + (i - (n - 1) / 2) * R * 0.45, y: y - R, s, max: sec, d: i * 0.04, L: R * 2 * (mid ? 1 : 0.6), seg: R * 0.4, tilt: (i - (n - 1) / 2) * 0.27, top, cols, draw: (ctx, p, t, px) => {
            const k = t < p.d ? 0 : Math.min(1, (t - p.d) / 0.25);
            const y1 = p.y - p.L * k;
            if (p.top !== undefined && y1 <= p.top) {
                return;
            }
            ctx.globalAlpha = hitStep(t > 0.5 ? (1 - t) / 0.5 : 1);
            for (let yy = Math.min(p.y, y1 + p.seg); yy >= y1; yy -= p.s) {
                const xx = p.x + Math.round((p.tilt * (p.y - yy)) / p.s) * p.s;
                dotAt(ctx, px, p.s, xx, yy, p.cols[0]);
                dotAt(ctx, px, p.s, xx + p.s, yy, p.cols[2]);
            }
        } });
    }
}

// 어질 — 금별 셋이 머리 위 납작한 둘레 (반지름 0.5R · 세로 0.4) 를 1바퀴 반 돎 (로켓박치기 — 퍼져 나가는 감돌기는 1배에서 흙먼지처럼 보여서, 아트 디렉터 2바퀴)
function hitDizzy(x, y, s, R, sec) {
    sigParticle({ x, y, s, max: sec, R, draw: (ctx, p, t, px) => {
        ctx.globalAlpha = hitFade(t, 0.1, 0.3);
        for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2 + t * Math.PI * 3;
            hitBit(ctx, px, p.s, p.x + Math.cos(a) * p.R * 0.5, p.y + Math.sin(a) * p.R * 0.2, 'star', HIT_GOLD, t, false);
        }
    } });
}

// 이빨 — 위 · 아래 흰 삼각 이빨 셋씩 (1칸 짙은 테) 이 0.15초에 다물림 (물기 · 깨물어부수기 — 사선 자국 둘은 "이빨" 로 안 읽혀서, 아트 디렉터 #122)
function hitFangs(x, y, s, R, cols, scale = 1, sec = 0.5) {
    const w = Math.round(3 * scale);
    const h = Math.round(4 * scale);
    const tooth = (ctx, px, x0, yBase, dirY) => {
        for (let j = 0; j < h; j++) {
            const ww = Math.max(1, w - Math.floor((j * w) / h));
            const xo = x0 + Math.floor((w - ww) / 2) * s;
            dotAt(ctx, px, s, xo - s, yBase + dirY * j * s, '#1a1626', ww + 2, 1);
            dotAt(ctx, px, s, xo, yBase + dirY * j * s, cols[0], ww, 1);
        }
        dotAt(ctx, px, s, x0 + Math.floor((w - 1) / 2) * s, yBase + dirY * h * s, '#1a1626');
    };
    sigParticle({ x, y, s, max: sec, R, draw: (ctx, p, t, px) => {
        const k = Math.min(0.85, t / 0.3);
        // 다문 틈은 1칸 남김 · 아래 줄은 (w + 1) / 2 칸 밀어 둘만 — 위 셋 · 아래 둘이 맞물림 (끝끼리 만나 모래시계 바코드가 되던 것, 아트 디렉터 2바퀴 · GBA 물기 아이콘)
        const g = Math.max(p.s, Math.round((p.R * 0.7 * (1 - k)) / p.s) * p.s);
        ctx.globalAlpha = hitStep(t > 0.7 ? (1 - t) / 0.3 : 1);
        for (let i = -1; i <= 1; i++) {
            const x0 = p.x + (i * (w + 1) - Math.floor(w / 2)) * p.s;
            tooth(ctx, px, x0, p.y - g - h * p.s, 1);
            if (i < 1) {
                tooth(ctx, px, x0 + Math.ceil((w + 1) / 2) * p.s, p.y + g + h * p.s, -1);
            }
        }
    } });
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

// ── 짜임: 붙은 불씨 — 몸 여기저기에 작은 조각이 붙어 제자리에서 타오름 (태현 님 불꽃세례 "몸에 붙어 0.3 ~ 0.5초") · 하나씩 0.04초 늦게 붙고 위로 1 ~ 2칸 일렁임
function hitCling(x, y, s, R, cols, shape, n, sec, big = false) {
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + moveRand(-0.5, 0.5);
        const r = R * moveRand(0.3, 0.75);
        setTimeout(() => {
            sigParticle({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * 0.75, s, max: sec * moveRand(0.8, 1.1), cols, shape, big: big || i % 2 === 0, draw: (ctx, p, t, px) => {
                ctx.globalAlpha = hitFade(t, 0.1, 0.3);
                hitBit(ctx, px, p.s, p.x, p.y - Math.round(t * 2) * p.s, p.shape, p.cols, t, p.big);
            } });
        }, i * 40);
    }
}

// ── 짜임: 감돌기 — 조각이 몸 둘레를 빙글 돌다 밖으로 흩어짐 (잎 · 깃털 · 하트) · inward = 바깥에서 안으로 빨려 듦 (염동력)
// 꽂힌 바늘 — 1 × len 칸 바늘이 친 쪽 (−dir) 으로 꼬리를 내밀고 몸에 꽂혀 sec 동안 남음 (꼬리 끝 cols[0] · 몸 cols[2] · 1칸 짙은 그림자 #1a1626) · spread = 부채꼴 반각
//   벌레 · 독 바늘 (더블니들 · 바늘미사일 · 마지막일침 · 독침이 1배에서 "얼굴에 작은 연두 반짝" 으로 똑같이 보이던 것, #122 2단계 아트)
function hitNeedles(x, y, s, R, cols, n, spread, len, sec, dir) {
    for (let i = 0; i < n; i++) {
        const off = n > 1 ? (i / (n - 1) - 0.5) * 2 * spread : 0;
        sigParticle({ x: x - dir * R * 0.15 + moveRand(-0.1, 0.1) * R, y: y + (n > 1 ? (i / (n - 1) - 0.5) * 0.5 * R : 0), s, max: sec, d: i * 0.05, a: (dir > 0 ? Math.PI : 0) + off, len, cols, draw: (ctx, p, t, px) => {
            if (p.life < p.d) {
                return;
            }
            ctx.globalAlpha = hitStep(t > 0.7 ? (1 - t) / 0.3 : 1);
            const cx = Math.cos(p.a) * p.s;
            const cy = Math.sin(p.a) * p.s;
            for (let k = 0; k <= p.len; k++) {
                dotAt(ctx, px, p.s, p.x + cx * k, p.y + cy * k + p.s, '#1a1626');
            }
            for (let k = 0; k < p.len; k++) {
                dotAt(ctx, px, p.s, p.x + cx * k, p.y + cy * k, k === p.len - 1 ? p.cols[0] : p.cols[2]);
            }
        } });
    }
}

// 반쪽 호 — 2칸 굵기 납작 반원이 r0 → r1 로 퍼짐 (part 'top' = 위 반 — 배대뒤치기 몸을 넘겨 메침 · 'front' = 앞 (아래) 반 — 드래곤테일 발밑 쓸기)
function hitArc(x, y, s, r0, r1, flat, sec, cols, part) {
    sigParticle({ x, y, s, max: sec, cols, draw: (ctx, p, t, px) => {
        const r = r0 + (r1 - r0) * Math.min(1, t / 0.6);
        ctx.globalAlpha = hitStep(t > 0.6 ? (1 - t) / 0.4 : 1);
        const dots = Math.ceil((Math.PI * r) / p.s) + 1;
        for (let j = 0; j <= dots; j++) {
            const a = (part === 'top' ? Math.PI : 0) + (j / dots) * Math.PI;
            dotAt(ctx, px, p.s, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * flat, j % 4 === 0 ? p.cols[0] : p.cols[1], 1, 2);
        }
    } });
}

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
//   opt.len = [최소, 최대] × R (기본 1.4 ~ 2.4) · opt.every = 모양 바꾸는 간격 (기본 0.12초) · opt.top = 갈래 끝이 넘지 않는 위 끝 (맞는 쪽 HP 판 아래)
function hitBolts(x, y, s, R, cols, n, sec, opt = {}) {
    const [l0, l1] = opt.len ?? [1.4, 2.4];
    sigParticle({ x, y, s, max: sec, R, n, cols, drawn: -1, update: (p) => {
        if (p.drawn >= 0 && p.life - p.drawn < (opt.every ?? 0.12)) {
            return;
        }
        p.drawn = p.life;
        p.paths = [];
        for (let i = 0; i < p.n; i++) {
            const a = (i / p.n) * Math.PI * 2 + moveRand(-0.35, 0.35);
            const L = p.R * moveRand(l0, l1);
            const path = zigzag(p.x, p.y, p.x + Math.cos(a) * L, Math.max(opt.top ?? -Infinity, p.y + Math.sin(a) * L), p.s, 3, 5);
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
//   top = 줄기가 시작하는 위 끝 (맞는 쪽 HP 판 아래 — 번개 87: R × 4 위에서 내려와 정보줄 위 끝에 0.36 ~ 0.57초 일자로 걸치고 HP 묶음을 덮던 것, 픽셀 검사원 #122 · 하늘 번개는 틀이 이미 그림)
//   줄기 = 밝은 노랑 (cols[1]) 테 + 흰 심 — 짙은 금 굵은 테 + 흰 심 3칸이 1배에서 베이지 · 흰 막대로 보여 번개 같지 않던 것 (기획 #122 — 번개 87 이 10만볼트보다 약해 보임)
//   opt.w = 줄기 심 굵기 (기본 1) · opt.branches = 줄기 아래쪽에서 아래로 갈라지는 갈래 수 (기본 1)
function hitThunder(x, y, s, R, cols, sec, top, opt = {}) {
    sigParticle({ x, y, s, max: sec, R, cols, drawn: -1, update: (p) => {
        if (p.drawn >= 0 && p.life - p.drawn < 0.12) {
            return;
        }
        p.drawn = p.life;
        p.path = zigzag(p.x + moveRand(-1, 1) * p.s, Math.max(top ?? -Infinity, p.y - p.R * 4), p.x, p.y + p.R * 0.6, p.s, 3);
        p.branches = [];
        for (let i = 0; i < (opt.branches ?? 1); i++) {
            const at = p.path[Math.floor((p.path.length - 1) * moveRand(0.45, 0.85))];
            const a = Math.PI / 2 + (i % 2 ? -1 : 1) * moveRand(0.6, 1.0);
            const len = p.R * moveRand(0.7, 1.2);
            p.branches.push(zigzag(at[0], at[1], at[0] + Math.cos(a) * len, at[1] + Math.sin(a) * len, p.s, 1.5));
        }
    }, draw: (ctx, p, t, px) => {
        if (!p.path || (t > 0.3 && t < 0.42)) {
            return;
        }
        ctx.globalAlpha = t > 0.75 ? 0.5 : 1;
        p.branches.forEach((b) => zapLine(ctx, px, p.s, b, 1, p.cols[1], p.cols[0]));
        zapLine(ctx, px, p.s, p.path, opt.w ?? 1, p.cols[1]);
    } });
    hitRing(x, y + R * 0.8, s, s * 2, R * 1.3, 0.28, 0.4, cols);
}

// 충격선 — 바깥으로 뻗는 선 (뿌리 2칸 → 끝 1칸으로 가늘어짐 · 가운데 십자 없음 — 조준경 같아서)
//   opt.dir · opt.spread = 미는 쪽 (dir) ± spread 부채꼴로만 (돌진 — 밀려남, 아트 디렉터 #122)
function hitLines(x, y, s, R, cols, n, sec, opt = {}) {
    sigParticle({ x, y, s, max: sec * 1.3, R, n, cols, draw: (ctx, p, t, px) => {
        ctx.globalAlpha = hitStep(1 - t);
        for (let i = 0; i < p.n; i++) {
            const a = opt.dir ? (opt.dir > 0 ? 0 : Math.PI) + (p.n > 1 ? (i / (p.n - 1) - 0.5) * 2 * opt.spread : 0) : (i / p.n) * Math.PI * 2 + (i % 2) * 0.2;
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
//   flat = 고리 납작함 (기본 0.3 — 땅 기술은 0.18: 큰 고리 아래 반이 땅선 아래 판처럼 내려가서, #122 2단계 아트)
function hitPulses(x, ground, s, R, cols, n, flat = 0.3) {
    // 닿는 기술 · 1 공격이면 고리 없이 (타이머가 나중에 그려서 부를 때 확인)
    if (hitQuiet) {
        return;
    }
    for (let i = 0; i < n; i++) {
        setTimeout(() => hitRing(x, ground, s, R * 0.3, R * (1.4 + 0.3 * i), flat, 0.5, cols), i * 100);
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
// k = 크기 배 (게임 3:3 0.7)
function hitKO(g, k = 1) {
    const R = Math.max(14 * g.s, g.w * 0.6) * k;
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

// 기술마다 맞는 짜임 (#122 — 태현 님 "맞는 순간도 기술마다" · 표 dev/move-look.json 의 hit 칸 → 다리 impact → o.hit) — 같은 타입 안에서도 기술마다 다른 모양 · 위력이 크면 크고 길게
//   core = 가운데 번쩍 크기 배 (0 = 없음 — 줄기가 이어 들어오거나 자국만 남는 기술) · shake = 화면 살짝 흔들기 (가장 센 것만) · 번쩍은 맞을 때 한 번 (1초 3번 규칙)
const HIT_MOVES = {
    // 불꽃세례 — 불꽃 여섯이 몸에 붙어 0.4 ~ 0.55초 타오름 + 불똥 조금 (기획 "맞는 순간이 너무 작아요 — 몸에 붙어 0.3 ~ 0.5초" · 불꽃튀기기보다는 작게)
    ember: { core: 0.4, run: (x, y, s, R, c, big, dir, g, n) => { hitCling(x, y, s, R * 1.05, c, 'flame', n(6), 0.5, true); hitFountain(x, y, s, R * 0.35, c, 'dot', 0.3, false, dir); } },
    // 불꽃튀기기 — 사방으로 튀는 불꽃 + 터짐 고리 한 겹 (날아온 불덩이의 pop 과 이어짐)
    flameburst: { core: 0.8, run: (x, y, s, R, c, big) => { hitBloom(x, y, s, R * 1.1, c, 'flame', 0.6, big, { g: -20, drag: 2.6 }); hitRing(x, y, s, R * 0.4, R * 1.3, 0.35, 0.4, c); } },
    // 화염방사 — 몸을 감싸는 불 (몸 둘레를 도는 불꽃 — 회오리는 예전 불꽃 타입 짜임과 같아 안 바뀐 것처럼 보이던 것) + 발밑 그을음 · 번쩍 없음 (줄기가 이어 들어와서)
    wrapfire: { core: 0, run: (x, y, s, R, c, big, dir, g, n) => { hitOrbit(x, y, s, R * 1.35, c, 'flame', n(26), 0.95, true); hitPuddle(x, g, s, R, c, 0.6); } },
    // 연옥 — 불기둥 (3.6R · 0.9초) + 위로 튀는 불똥 + 큰 번쩍 · 흔들림 (가장 큼)
    pillar: { core: 1, shake: true, run: (x, y, s, R, c, big, dir, g, n, h) => { hitPillar(x, g, s, R, h(3.6), c, 'flame', 0.9, true); hitFountain(x, y, s, R * 0.6, c, 'dot', 0.6, false, dir); } },
    // 할퀴기 — 짧은 발톱 자국 셋 + 흰 점 튐 · 번쩍 없음
    claw3: { core: 0, run: (x, y, s, R, c, big, dir) => { hitClaws(x, y, s, R * 0.7, c, 3); hitFountain(x, y, s, R * 0.4, c, 'dot', 0.35, false, dir); } },
    // 베어가르기 — 몸을 가로지르는 긴 섬광 한 줄 + 작은 별 둘 · 번쩍 작게
    slashline: { core: 0.5, run: (x, y, s, R, c) => { hitClaws(x, y, s, R * 1.4, c, 1); hitBloom(x, y, s, R * 0.5, c, 'star', 0.4, false, { g: 60 }); } },
    // ── 1단계 (스타팅 계열 + 피카츄 · 라이츄 — 태현 님 10-28 "추천대로 전부") — 같은 포켓몬 안에서 겹치지 않게 · 위력이 크면 크게 ──
    // 노말 돌진 (몸이 달려듦 — 틀 값이 빠르기 · 구르기뿐이라 맞는 순간으로 나눔): 작은 퍽 → 큰 퍽 + 충격선 → 충격파 → 흔들림
    puffS: { core: 0.5, run: (x, y, s, R, c) => sigPow(x, y, s, c, 0.3, false) },
    streak: { core: 0.4, run: (x, y, s, R, c, big, dir, g) => { hitLines(x, y, s, R * 0.9, c, 2, 0.3); hitDust(x, g, s, R * 0.6, c, 4); } },
    tick: { core: 0.3, run: (x, y, s, R, c, big, dir) => hitFountain(x, y, s, R * 0.35, c, 'dot', 0.3, false, dir) },
    spinring: { core: 0.4, run: (x, y, s, R, c, big, dir) => { hitRing(x, y, s, R * 0.3, R * 1.0, 0.45, 0.35, c); hitFountain(x, y, s, R * 0.4, c, 'dot', 0.35, false, dir); } },
    redpuff: { core: 0.5, run: (x, y, s, R) => { const r = sigPal('fight'); sigPow(x, y, s, r, 0.4, false); hitLines(x, y, s, R * 0.7, r, 4, 0.3); } },
    squeeze: { core: 0, run: (x, y, s, R, c) => { hitRing(x, y, s, R * 1.1, R * 0.45, 0.35, 0.5, c); setTimeout(() => hitRing(x, y, s, R * 1.1, R * 0.45, 0.35, 0.45, c), 220); } },
    chime: { core: 0.3, run: (x, y, s, R, c) => hitBloom(x, y, s, R * 0.7, c, 'sparkle', 0.5, false, { g: -10, drag: 3 }) },
    heart: { core: 0.3, run: (x, y, s, R, c, big, dir, g, n) => hitOrbit(x, y, s, R * 0.9, sigPal('fairy'), 'heart', n(6), 0.6, false) },
    nibble: { core: 0.3, run: (x, y, s, R, c, big, dir, g, n) => hitFlurry(x, y, s, R * 0.6, c, n(3)) },
    double: { core: 0.6, run: (x, y, s, R, c, big, dir) => { sigPow(x, y, s, c, 0.5, false); setTimeout(() => sigPow(x + dir * 4 * s, y - 3 * s, s, c, 0.6, false), 220); } },
    puffM: { core: 0.7, run: (x, y, s, R, c) => { sigPow(x, y, s, c, 0.6, true); hitLines(x, y, s, R, c, 6, 0.32); } },
    slam: { core: 0.6, run: (x, y, s, R, c, big, dir, g, n) => { hitDust(x, g, s, R * 1.2, c, n(14)); hitPulses(x, g, s, R, c, 2); } },
    // 돌진 — 퍽 0.6 + 미는 쪽 ±25° 충격선 + 뒤로 흙먼지 (밀려남) · 로켓박치기 — 퍽 + 머리 위 도는 별 셋 (어질) · 이판사판태클 — 가장 큰 퍽 + 충격파 + 발밑 땅 금 (아트 디렉터 #122 — 크기만 다른 퍽 묶음이던 것)
    puffL: { core: 0.7, run: (x, y, s, R, c, big, dir, g, n) => { sigPow(x, y, s, c, 0.6, true); hitLines(x, y, s, R * 1.1, c, n(5), 0.34, { dir, spread: 0.44 }); hitDust(x + dir * R * 0.6, g, s, R * 0.7, c, 6); } },
    rocket: { core: 0.9, run: (x, y, s, R, c) => { sigPow(x, y, s, c, 0.85, true); hitLines(x, y, s, R, c, 6, 0.3); hitDizzy(x, y - R * 0.8, s, R, 0.7); } },
    crash: { core: 1, shake: true, run: (x, y, s, R, c, big, dir, g, n) => { sigPow(x, y, s, c, 1, true); hitPulses(x, g, s, R * 1.3, c, 3); hitLines(x, y, s, R * 1.3, c, n(10), 0.36); hitDust(x, g, s, R, c, n(10)); hitCracks(x, g, s, R * 1.2, c, 0.5); } },
    // 불꽃 · 전기 · 바위 돌진
    flamewheel: { core: 0.6, run: (x, y, s, R, c, big, dir) => { hitRing(x, y, s, R * 0.3, R * 1.1, 0.5, 0.4, c); hitFountain(x, y, s, R * 0.6, c, 'flame', 0.5, false, dir); } },
    embers: { core: 0.5, run: (x, y, s, R, c, big, dir) => { hitFountain(x, y, s, R * 0.7, c, 'dot', 0.5, false, dir); hitLines(x, y, s, R * 0.8, c, 3, 0.25); } },
    flare: { core: 1, shake: true, run: (x, y, s, R, c, big, dir, g) => { hitBloom(x, y, s, R * 1.3, c, 'flame', 0.75, true, { g: -40, drag: 3 }); hitPulses(x, g, s, R, c, 2); } },
    forkbolt: { core: 0.6, run: (x, y, s, R, c, big, dir, g, n) => hitBolts(x, y, s, R, c, n(3), 0.45) },
    bigbolt: { core: 0.9, shake: true, run: (x, y, s, R, c, big, dir, g, n, h) => { hitThunder(x, y, s, R, c, 0.55, g - h(100)); hitBolts(x, y, s, R * 0.8, c, 3, 0.4, { top: g - h(100) }); } },
    cheek: { core: 0.3, run: (x, y, s, R, c, big, dir, g, n) => hitOrbit(x, y, s, R * 0.8, c, 'sparkle', n(8), 0.5, false) },
    rubble: { core: 0.5, run: (x, y, s, R, c, big, dir, g) => { hitFountain(x, y, s, R * 0.8, c, 'rock', 0.6, false, dir); hitDust(x, g, s, R * 0.7, c, 6); } },
    rockspike: { core: 1, shake: true, run: (x, y, s, R, c, big, dir, g) => { hitSpikes(x, g, s, R * 1.1, c, 4, 0.55, { slim: true }); hitFountain(x, y, s, R * 0.7, c, 'rock', 0.6, big, dir); } },
    // 풀 · 물 · 흡수
    leafcut: { core: 0.5, run: (x, y, s, R, c) => { hitClaws(x, y, s, R * 0.8, c, 2); hitBloom(x, y, s, R * 0.5, c, 'leaf', 0.5, false, { g: 40, drag: 2.6 }); } },
    leafglow: { core: 0.4, run: (x, y, s, R, c, big, dir, g, n) => { hitOrbit(x, y, s, R, c, 'leaf', n(12), 0.6, false); hitBloom(x, y, s, R * 0.5, c, 'sparkle', 0.5, false, { g: -10, drag: 3 }); } },
    seedburst: { core: 0.7, run: (x, y, s, R, c, big, dir, g) => { hitBloom(x, y, s, R, c, 'dot', 0.6, false, { g: 80 }); hitDust(x, g, s, R * 0.8, c, 8); } },
    bigfire: { core: 1, shake: true, run: (x, y, s, R, c, big, dir, g, n, h) => { hitPillar(x, g, s, R * 1.1, h(3.4), c, 'flame', 0.85, true); hitBloom(x, y, s, R * 1.2, c, 'flame', 0.7, true, { g: -40, drag: 3 }); } },
    splash: { core: 0.4, run: (x, y, s, R, c, big, dir) => hitFountain(x, y, s, R * 0.7, c, 'drop', 0.5, false, dir) },
    geyser: { core: 0.9, shake: true, run: (x, y, s, R, c, big, dir, g, n, h) => hitHelix(x, g, s, R * 1.1, h(3.2), c, 'drop', 0.85, dir * 10, true) },
    crown: { core: 0.6, run: (x, y, s, R, c, big, dir, g, n) => { hitFountain(x, y, s, R, c, 'drop', 0.7, false, dir, { ring: true }); hitOrbit(x, y, s, R * 0.7, c, 'sparkle', n(6), 0.5, false); } },
    waterslash: { core: 0.5, run: (x, y, s, R, c, big, dir) => { hitClaws(x, y, s, R * 1.3, c, 1); hitFountain(x, y, s, R * 0.5, c, 'drop', 0.45, false, dir); } },
    bubblepop: { core: 0.3, run: (x, y, s, R, c) => hitBloom(x, y, s, R * 0.7, c, 'bubble', 0.6, false, { g: -30, drag: 3.6 }) },
    bubblebig: { core: 0.6, run: (x, y, s, R, c, big) => { hitBloom(x, y, s, R * 1.1, c, 'bubble', 0.8, big, { g: -30, drag: 3.6 }); hitRing(x, y, s, R * 0.3, R * 1.2, 0.4, 0.4, c); } },
    drainS: { core: 0.2, run: (x, y, s, R, c, big, dir, g, n) => hitOrbit(x, y, s, R * 0.8, c, 'dot', n(8), 0.6, false, true) },
    drainM: { core: 0.3, run: (x, y, s, R, c, big, dir, g, n) => hitOrbit(x, y, s, R, c, 'leaf', n(14), 0.7, false, true) },
    drainL: { core: 0.5, run: (x, y, s, R, c, big, dir, g, n) => { hitOrbit(x, y, s, R * 1.2, c, 'leaf', n(22), 0.8, true, true); hitPuddle(x, g, s, R, c, 0.6); } },
    // 물기 · 할퀴기 · 쪼기 · 에스퍼 · 전기
    // 물기 — 위아래 이빨이 다물림 · 깨물어부수기 — 이빨 × 1.4 + 결정 조각 (사선 자국 둘이 비슷하고 이빨로 안 읽히던 것, 아트 디렉터 #122)
    fang: { core: 0.4, run: (x, y, s, R, c) => hitFangs(x, y, s, R, c, 1) },
    crunch: { core: 0.7, run: (x, y, s, R, c, big) => { hitFangs(x, y, s, R * 1.2, c, 1.4); hitBloom(x, y, s, R * 0.8, c, 'shard', 0.6, big, { g: 10, drag: 3.4 }); } },
    claw5: { core: 0.3, run: (x, y, s, R, c, big, dir, g, n) => hitFlurry(x, y, s, R * 0.8, c, n(5)) },
    // 막치기 — 퍽 대신 흰 + 반짝 하나 (몸통박치기 작은 퍽과 같아 보이던 것, 아트 디렉터 #122)
    tap: { core: 0.2, run: (x, y, s, R, c) => sigParticle({ x, y: y - R * 0.2, s, max: 0.3, cols: c, draw: (ctx, p, t, px) => { ctx.globalAlpha = hitFade(t, 0.05, 0.4); hitBit(ctx, px, p.s, p.x, p.y, 'sparkle', p.cols, t, true); } }) },
    peck: { core: 0.4, run: (x, y, s, R, c, big, dir, g, n) => { hitFlurry(x, y, s, R * 0.6, c, n(3)); hitFountain(x, y, s, R * 0.3, c, 'dot', 0.3, false, dir); } },
    psywave: { core: 0.6, run: (x, y, s, R, c) => hitWaves(x, y, s, R, c, 4, 0.6) },
    psyshards: { core: 0.5, run: (x, y, s, R, c) => hitBloom(x, y, s, R * 0.9, c, 'sparkle', 0.6, false, { g: 0, drag: 4 }) },
    zap: { core: 0.4, run: (x, y, s, R, c) => hitBolts(x, y, s, R * 0.7, c, 2, 0.35) },
    // 10만볼트 — 갈래 짧게 (R 0.9 ~ 1.4 · HP 판 아래까지 · 0.2초마다) — 번개 (110) 보다 커 보이고 이름표 · HP · 피해 숫자를 덮던 것 (아트 디렉터 #122)
    thunderbolt: { core: 0.8, run: (x, y, s, R, c, big, dir, g, n, h) => { hitBolts(x, y, s, R * 1.1, c, n(5), 0.5, { len: [0.9, 1.4], every: 0.2, top: g - h(100) }); hitOrbit(x, y, s, R * 1.1, c, 'sparkle', n(6), 0.55, false); } },
    discharge: { core: 0.8, run: (x, y, s, R, c, big, dir, g, n) => { hitBolts(x, y, s, R * 1.3, c, n(7), 0.5); hitRing(x, y, s, R * 0.3, R * 1.4, 0.6, 0.45, c); } },
    // 번개 — 굵은 낙뢰 (심 2칸) + 아래로 갈라지는 갈래 셋 + 바닥에서 사방으로 튀는 갈래 번개 (10만볼트 터짐보다 크게 — R 1.3 · 일곱 · 1.0 ~ 1.7) + 발밑 충격파 (기획 #122 — 전기 중 가장 큼이 약해 보이던 것)
    thunder: { core: 1, shake: true, run: (x, y, s, R, c, big, dir, g, n, h) => { hitThunder(x, y, s, R * 1.2, c, 0.6, g - h(100), { w: 2, branches: 3 }); hitBolts(x, y + R * 0.3, s, R * 1.3, c, n(7), 0.5, { len: [1.0, 1.7], every: 0.2, top: g - h(100) }); hitPulses(x, g, s, R, c, 2); } },
    // 불사르기 — 낮은 불꽃 혀 셋 + 바닥 빛 (연옥 불기둥과 넓이만 다르던 것 — 아트 디렉터 #122 1 ~ 3바퀴 · 연기는 안 보여 뺌)
    //   〔2바퀴〕 큰 원뿔 하나가 상대를 0.66초 다 가려서 → 낮은 불길 셋 · 〔3바퀴〕 그래도 붙어 벽이 되어 → 높이 0.8 · 1.1 · 0.8 (불길 끝이 머리 끝보다 아래 — 머리 위 1/3 보임) · 옆 ±1.0R · 0.45초 · 불티 작게 · 넓이는 바닥 빛 (웅덩이 R 1.6 — 모닥불 레퍼런스: 불은 낮게 · 넓이는 바닥 빛)
    burnup: { core: 1, shake: true, run: (x, y, s, R, c, big, dir, g, n, h) => { [-1, 0, 1].forEach((o, i) => hitPillar(x + o * R, g, s, R * 0.45, h(i === 1 ? 1.1 : 0.8), c, 'flame', 0.45, i === 1)); hitFountain(x, y, s, R * 0.6, c, 'dot', 0.7, false, dir); hitPuddle(x, g, s, R * 1.6, c, 0.8); } },
    // ── 1단계 더함 (진화형이 배우는 15기술 — 같은 계열 안 같은 모양 0) ──
    // 따라가때리기 — 빠르게 따라붙어 작은 퍽 + 충격선 셋 · 깜짝베기 — 긴 어둠 자국 하나 + 결정 조각
    pursuit: { core: 0.4, run: (x, y, s, R, c) => { sigPow(x, y, s, c, 0.35, false); hitLines(x, y, s, R * 0.7, c, 3, 0.26); } },
    // 깜짝베기 — 틀 slash 가 긴 자국 하나를 그리니 맞는 순간은 결정 조각만 (자국을 하나 더 그어 보라 X 가 되어 깨물어부수기와 비슷하던 것, 아트 디렉터 2바퀴)
    nightslash: { core: 0.6, run: (x, y, s, R, c) => hitBloom(x, y, s, R * 0.7, c, 'shard', 0.5, false, { g: 10, drag: 3.4 }) },
    // 연속자르기 — 작은 자국 연타 · 시저크로스 — X 자 두 줄 + 반짝
    // 연속자르기 — 짧은 자르기 자국 셋 (야금야금 연타와 코드가 같던 것, 아트 디렉터 2바퀴)
    furycut: { core: 0.3, run: (x, y, s, R, c) => hitClaws(x, y, s, R * 0.5, c, 3) },
    xscissor: { core: 0.7, run: (x, y, s, R, c) => { hitClaws(x, y, s, R * 1.1, c, 2, true); hitBloom(x, y, s, R * 0.6, c, 'sparkle', 0.45, false, { g: 0, drag: 4 }); } },
    // 우드해머 — 큰 퍽 + 잎 폭발 + 발밑 충격파 · 흔들림 · 바늘팔 — 바늘 조각이 바깥으로 + 충격선
    woodhammer: { core: 1, shake: true, run: (x, y, s, R, c, big, dir, g) => { sigPow(x, y, s, c, 1, true); hitBloom(x, y, s, R * 1.2, c, 'leaf', 0.7, true, { g: 40, drag: 2.6 }); hitPulses(x, g, s, R * 1.2, c, 2); } },
    needlearm: { core: 0.5, run: (x, y, s, R, c) => { hitBloom(x, y, s, R * 0.8, c, 'shard', 0.5, false, { g: 20, drag: 3.4 }); hitLines(x, y, s, R * 0.7, c, 4, 0.26); } },
    // 두번차기 — 작은 퍽 두 번 (조금 아래로) · 스카이어퍼 — 큰 퍽 + 별이 위로 솟음
    kick2: { core: 0.5, run: (x, y, s, R, c, big, dir) => { sigPow(x, y, s, c, 0.4, false); setTimeout(() => sigPow(x - dir * 4 * s, y + 3 * s, s, c, 0.45, false), 180); } },
    // 스카이어퍼 — 퍽 + 위로 솟는 빛 줄 셋 + 별이 위로만 (± 20°) · 블레이즈킥 — 퍽 없이 불꽃 혀 + 발밑 불씨 (둘 다 주황 별꼴 퍽으로 같아 보이던 것, 아트 디렉터 #122)
    uppercut: { core: 0.6, run: (x, y, s, R, c, big, dir, g, n, h) => { sigPow(x, y, s, c, 0.5, true); hitRise(x, y, s, R, c, 3, 0.5, g - h(100)); hitFountain(x, y, s, R * 0.9, c, 'star', 0.4, false, dir, { spread: 0.35 }); } },
    // 블레이즈킥 — 불꽃이 사방으로 + 충격선 · 불꽃펀치 — 퍽 + 불꽃이 위로 튐
    blazekick: { core: 0.5, run: (x, y, s, R, c, big, dir, g) => { hitBloom(x, y, s, R * 1.1, c, 'flame', 0.6, big, { g: -30, drag: 3 }); hitFountain(x, g - R * 0.5, s, R * 0.5, c, 'dot', 0.45, false, dir); } },
    firepunch: { core: 0.7, run: (x, y, s, R, c, big, dir) => { sigPow(x, y, s, c, 0.6, true); hitFountain(x, y, s, R * 0.6, c, 'flame', 0.5, false, dir); } },
    // 진흙 셋 — 튐 (작게) < 터짐 + 흙먼지 < 바위 터짐 + 진흙 웅덩이
    mudsplat: { core: 0.3, run: (x, y, s, R, c, big, dir) => hitFountain(x, y, s, R * 0.5, c, 'dot', 0.4, false, dir) },
    mudshot: { core: 0.6, run: (x, y, s, R, c, big, dir, g) => { hitBloom(x, y, s, R * 0.9, c, 'dot', 0.55, false, { g: 60 }); hitDust(x, g, s, R * 0.8, c, 6); } },
    mudbomb: { core: 0.7, run: (x, y, s, R, c, big, dir, g) => { hitBloom(x, y, s, R * 1.1, c, 'rock', 0.6, true, { g: 80 }); hitPuddle(x, g, s, R * 1.1, c, 0.7); } },
    // 돌떨구기 — 돌 부스러기 튐 + 흙먼지 · 스톤샤워 — 큰 돌 튐 + 넓은 흙먼지 + 발밑 충격파 · 흔들림
    rockthrow: { core: 0.5, run: (x, y, s, R, c, big, dir, g) => { hitFountain(x, y, s, R * 0.6, c, 'rock', 0.5, false, dir); hitDust(x, g, s, R * 0.6, c, 5); } },
    rockslide: { core: 0.8, shake: true, run: (x, y, s, R, c, big, dir, g, n) => { hitFountain(x, y, s, R * 0.8, c, 'rock', 0.6, true, dir); hitDust(x, g, s, R * 1.3, c, n(12)); hitPulses(x, g, s, R, c, 2); } },
    // ── 2단계 (숲 · 해변 · 화산 야생 · 트레이너 · 관장 계열 67 — 태현 님 10-28 "추천대로") — 같은 계열 안에서 겹치지 않게 · 위력이 크면 크게 ──
    // 벌레: 엉겨붙기 = 작은 벌레가 몸에 붙어 기어다님 · 벌레의저항 = 윙윙 물결 · 마지막일침 = 긴 바늘 하나가 몸을 꿰뚫음 · 더블니들 = 꽂힌 바늘 둘 (±20°) + 독방울 · 벌레먹기 = 이빨이 주인공 · 바늘미사일 = 꽂힌 바늘 다섯 부채꼴 · 덤벼들기 = X 턱 · 공격지령 = 벌 (2 × 2) 떼가 넓게 감돌며 쏨 (아트 #122 2단계 1바퀴)
    swarm: { core: 0.2, run: (x, y, s, R, c, big, dir, g, n) => { hitCling(x, y, s, R, c, 'dot', n(9), 0.9); hitOrbit(x, y, s, R * 0.8, c, 'dot', n(5), 0.7, false); } },
    bugbuzz: { core: 0.4, run: (x, y, s, R, c, big, dir) => { hitWaves(x, y, s, R * 0.9, c, 3, 0.5); hitFountain(x, y, s, R * 0.4, c, 'dot', 0.35, false, dir); } },
    stinger: { core: 0.6, run: (x, y, s, R, c, big, dir) => { hitNeedles(x + dir * R * 0.3, y, s, R, c, 1, 0, 9, 0.55, dir); hitLines(x, y, s, R * 1.1, c, 3, 0.3, { dir, spread: 0.12 }); } },
    needle2: { core: 0.4, run: (x, y, s, R, c, big, dir) => { hitNeedles(x, y, s, R, c, 2, 0.35, 5, 0.5, dir); hitFountain(x, y, s, R * 0.35, sigPal('poison'), 'drop', 0.4, false, dir, { rate: 15 }); } },
    bugbite: { core: 0.4, run: (x, y, s, R, c) => { hitFangs(x, y, s, R * 0.85, c, 1); hitBloom(x, y, s, R * 0.5, c, 'leaf', 0.4, false, { g: 15, drag: 3 }); } },
    pins: { core: 0.5, run: (x, y, s, R, c, big, dir) => { hitNeedles(x, y, s, R, c, 5, 0.6, 5, 0.55, dir); hitLines(x, y, s, R * 0.7, c, 3, 0.25); } },
    lunge: { core: 0.5, run: (x, y, s, R, c, big, dir, g) => { sigPow(x, y, s, c, 0.45, false); hitClaws(x, y, s, R, c, 2, true); hitDust(x + dir * R * 0.5, g, s, R * 0.8, c, 8); } },
    beeswarm: { core: 0.6, run: (x, y, s, R, c, big, dir, g, n) => { hitOrbit(x, y, s, R * 1.5, c, 'bee', n(8), 0.75, false, true); hitFlurry(x, y, s, R * 0.8, c, n(4)); } },
    // 노말: 휘감기 = 조이는 고리 하나 · 조이기 = 고리 셋이 차례로 · 칼등치기 = 베기 + 반짝 (봐 줌) · 칼바람 = 바람 칼 셋 · 뿔찌르기 = 곧은 찌르기 줄 · 박치기 = 머리 높이 퍽 + 고리 · 기가임팩트 = 금빛 큰 퍽 + 고리 둘 + 별 (흔들림)
    constrict: { core: 0, run: (x, y, s, R, c, big, dir) => { hitRing(x, y, s, R, R * 0.4, 0.35, 0.4, c); hitFountain(x, y, s, R * 0.3, c, 'dot', 0.25, false, dir); } },
    bind: { core: 0, run: (x, y, s, R, c) => [-0.35, 0, 0.35].forEach((o, i) => setTimeout(() => hitRing(x, y + o * R, s, R * 1.05, R * 0.5, 0.3, 0.4, c), i * 120)) },
    falseswipe: { core: 0.3, run: (x, y, s, R, c, big, dir, g, n) => { hitClaws(x, y, s, R * 0.9, c, 1); hitOrbit(x, y, s, R * 0.6, c, 'sparkle', n(4), 0.5, false); } },
    razorwind: { core: 0.4, run: (x, y, s, R, c, big, dir, g, n) => { const w = sigPal('wind'); hitClaws(x, y, s, R * 1.1, w, 3); hitLines(x, y, s, R, w, n(6), 0.3); } },
    horn: { core: 0.5, run: (x, y, s, R, c, big, dir) => { hitLines(x, y, s, R * 1.2, c, 3, 0.3, { dir, spread: 0.15 }); sigPow(x + dir * R * 0.2, y, s, c, 0.45, false); } },
    headbutt: { core: 0.6, run: (x, y, s, R, c) => { sigPow(x, y - R * 0.3, s, c, 0.6, true); hitRing(x, y - R * 0.3, s, R * 0.2, R * 0.9, 0.5, 0.3, c); } },
    gigaimpact: { core: 0.6, shake: true, run: (x, y, s, R) => { const o = sigPal('hyper'); sigPow(x, y, s, o, 0.55, false); hitRing(x, y, s, R * 0.3, R * 1.4, 0.45, 0.45, o); setTimeout(() => hitRing(x, y, s, R * 0.3, R * 1.6, 0.45, 0.4, o), 160); hitBloom(x, y, s, R * 1.3, o, 'star', 0.7, true, { only: true, n: 6 }); } },
    // 바위: 떨어뜨리기 = 퍽 + 흙먼지 (끌어내림) · 암석봉인 = 바위가 둘레를 돌며 가둠 (솟는 피라미드는 상대를 가려서) · 록블라스트 = 연타 + 부스러기 · 파워젬 = 금빛 반짝 + 보석 조각 · 암석포 = 바위 조각 폭발 + 고리 (스톤샤워 돌 분수와 다르게 · 흔들림)
    smackdown: { core: 0.5, run: (x, y, s, R, c, big, dir, g, n) => { sigPow(x, y, s, c, 0.35, false, { size: 5 }); hitDust(x, g, s, R, c, n(10)); hitFountain(x, y, s, R * 0.5, c, 'rock', 0.4, false, dir); } },
    // 암석봉인 — 무덤 (바위 넷이 양옆에 쌓였다 무너짐 · #122 2단계 기획: 돌 하나 + 조약돌로 끝나 무덤이 안 보이던 것)
    rocktomb: { core: 0.3, run: (x, y, s, R, c, big, dir, g, n, h) => { hitTomb(x, y, s, R, c, g, g - h(100) + 2 * s); hitDust(x, g, s, Math.min(R, hitRoom(x, s) / 1.5), c, 8); } },
    rockblast: { core: 0.5, run: (x, y, s, R, c, big, dir, g, n) => { hitFlurry(x, y, s, R * 0.6, hitCols('normal'), n(4)); hitFountain(x, y, s, R * 0.4, c, 'rock', 0.45, false, dir, { rate: 30, spread: 0.6 }); } },
    gemshine: { core: 0.6, run: (x, y, s, R, c, big, dir, g, n) => { hitBloom(x, y, s, R * 0.45, HIT_GOLD, 'sparkle', 0.5, false, { g: 0, drag: 3.6, rate: 40 }); hitOrbit(x, y, s, R * 0.6, c, 'shard', n(6), 0.55, false); } },
    // 암석포 — 번쩍 0.5 (1 이면 큰 바위 온전한 0.09초가 마름모 아래 숨어서, UX 8바퀴) · 큰 바위가 깨지고 (0.14초) 조각 12개가 튀어 전 반경 (±1R 넘게) 에 떨어짐 · 땅 고리 둘 · 흙먼지 (#122 2단계 기획: 지진보다 약해 보이던 것 — 조각 6 · 고리 0.8R 에서 되돌림, 패널 끝은 hitRoom)
    wrecker: { core: 0.5, shake: true, run: (x, y, s, R, c, big, dir, g, n, h) => { hitBreakRock(x, y, s, c); setTimeout(() => hitScatter(x, y, s, R, c, 12, g, g - h(100) + 2 * s), 90); hitGroundRings(x, g, s, R * 1.2, c, [1.4, 1.7], 100, 0.6); hitDust(x, g, s, Math.min(R * 1.2, hitRoom(x, s) / 1.5), c, n(12)); } },
    // 악: 기어오르기 = 작은 퍽 + 솟는 줄 (힘이 오름) · 승부굳히기 = 할퀴기 둘 + 조각 · 탁쳐서떨구기 = 퍽 + 금빛 물건이 튕겨 나감 · 속임수 = X 베기 + 어둠 혼
    powertrip: { core: 0.3, run: (x, y, s, R, c, big, dir, g, n, h) => { sigPow(x, y, s, c, 0.35, false); hitRise(x, y, s, R * 0.6, c, 3, 0.5, g - h(4)); } },
    assurance: { core: 0.4, run: (x, y, s, R, c, big, dir) => { hitClaws(x, y, s, R * 0.9, c, 2); hitFountain(x, y, s, R * 0.45, c, 'shard', 0.4, false, dir); } },
    knockoff: { core: 0.5, run: (x, y, s, R, c, big, dir) => { sigPow(x, y, s, c, 0.5, false); hitFountain(x, y, s, R * 0.9, HIT_GOLD, 'star', 0.6, true, dir, { spread: 0.35, rate: 20 }); } },
    foulplay: { core: 0.8, run: (x, y, s, R, c, big, dir, g, n) => { hitClaws(x, y, s, R * 1.1, c, 2, true); hitWisps(x, y + R * 0.2, s, R * 0.6, c, n(5), 0.6); } },
    // 고스트: 놀래키기 = 깜짝 줄 + 혼 셋 · 야습 = 발밑 그림자에서 가시 · 고스트다이브 = 혼이 피어오르며 퍽 + 고리 · 병상첨병 = 안으로 감기는 점 + 혼
    boo: { core: 0.3, run: (x, y, s, R, c, big, dir, g, n) => { hitLines(x, y - R * 0.5, s, R * 0.7, c, n(6), 0.3); hitWisps(x, y, s, R * 0.7, c, n(3), 0.5); } },
    sneak: { core: 0.2, run: (x, y, s, R, c, big, dir, g) => { hitPuddle(x, g, s, R, sigPal('dark'), 0.55); hitSpikes(x, g, s, R * 0.8, c, 3, 0.45); } },
    phantom: { core: 0.5, run: (x, y, s, R, c, big, dir, g, n) => { hitWisps(x, y, s, R, c, n(7), 0.7); sigPow(x, y, s, c, 0.4, false); hitRing(x, y, s, R * 0.3, R * 1.2, 0.5, 0.4, c); } },
    hex: { core: 0.4, run: (x, y, s, R, c, big, dir, g, n) => { hitOrbit(x, y, s, R * 1.1, c, 'sparkle', n(8), 0.7, true, true); hitWisps(x, y, s, R * 0.8, c, n(4), 0.6); } },
    // 땅: 구멍파기 = 발밑 구멍 + 흙 분수 · 대지의힘 = 땅에서 가늘게 솟구치는 흙빛 불똥 + 금 + 충격파 (꽉 찬 기둥은 상대를 덮어서) · 지진 = 넓은 금 + 충격파 셋 + 돌 (흔들림) · 분함의발구르기 = 쿵쿵쿵 세 번 충격파
    dig: { core: 0.5, run: (x, y, s, R, c, big, dir, g, n) => { hitPuddle(x, g, s, R * 0.9, c, 0.6); hitFountain(x, y, s, R * 0.8, c, 'rock', 0.6, false, dir); hitDust(x, g, s, R, c, n(10)); } },
    earthpower: { core: 0.7, run: (x, y, s, R, c, big, dir, g, n, h) => { const e = ['#fff0b0', '#ffd76a', '#e09a3a', '#8a5a26']; const top = g - h(100) + 2 * s; hitPillar(x - R * 0.6, g, s, R * 0.25, h(2.2), e, 'dot', 0.6, false, top); hitPillar(x + R * 0.6, g, s, R * 0.25, h(2.2), e, 'dot', 0.6, false, top); hitPulses(x, g, s, R * 0.9, c, 1, 0.18); } },
    // 지진 — 땅 금 셋 (0.85초 · 땅선 3칸 아래 — 발을 덮어 몸 가림 0.2초를 넘던 것, 픽셀 5바퀴) · 튀는 돌 1초 50 (60) 을 몸 양옆 두 곳에서 (가운데 하나면 몸 위를 지나 가림 0.2초 경계 — 픽셀 6바퀴) · 패널 끝 안 + 땅 고리 셋 (0.75초씩 · 전 반경 1.96 ~ 2.8R) + 튀는 돌 (#122 2단계 기획: 고리 0.9R · 금 없음으로 줄여 전의 60% 폭 · 일찍 사라지던 것 — 240 은 hitRoom 으로 자름)
    earthquake: { core: 0.8, shake: true, run: (x, y, s, R, c, big, dir, g) => { hitCracks(x, g + 3 * s, s, Math.min(R * 1.3, hitRoom(x, s) / 1.45), c, 0.85); hitGroundRings(x, g, s, R * 1.4, c, [1.4, 1.7, 2], 120, 0.75); const rf = Math.min(R * 0.6, hitRoom(x, s) / 4); const off = Math.min(R * 0.8, hitRoom(x, s) / 3); hitFountain(x - off, y, s, rf, c, 'rock', 0.6, false, -1, { rate: 25 }); hitFountain(x + off, y, s, rf, c, 'rock', 0.6, false, 1, { rate: 25 }); } },
    tantrum: { core: 0.5, run: (x, y, s, R, c, big, dir, g) => [0, 180, 360].forEach((d, i) => setTimeout(() => { hitPulses(x + (i - 1) * R * 0.3, g, s, R * 0.55, c, 1, 0.18); hitDust(x + (i - 1) * R * 0.3, g, s, R * 0.5, c, 5); }, d)) },
    // 비행 (바람 색): 에어커터 = 짧은 바람 칼 둘 + 바람 줄 · 제비반환 = 긴 베기 하나 + 깃털 조금 · 에어슬래시 = X 베기 + 깃털 많이
    aircutter: { core: 0.4, run: (x, y, s, R, c, big, dir, g, n) => { const w = sigPal('wind'); hitClaws(x, y, s, R * 0.8, w, 2); hitLines(x, y, s, R * 0.8, w, n(4), 0.25, { dir, spread: 0.6 }); } },
    aerialace: { core: 0.5, run: (x, y, s, R) => { const w = sigPal('wind'); hitClaws(x, y, s, R * 1.3, w, 1); hitBloom(x, y, s, R * 0.5, w, 'feather', 0.45, false, { g: 20, drag: 2.4 }); } },
    airslash: { core: 0.6, run: (x, y, s, R) => { const w = sigPal('wind'); hitClaws(x, y, s, R, w, 2, true); hitBloom(x, y, s, R * 0.9, w, 'feather', 0.65, false, { g: 20, drag: 2.4 }); } },
    // 격투: 마하펀치 = 작은 퍽 + 빠른 줄 · 발경 = 둥근 손바닥 물결 둘 + 마비 지직 · 폭발펀치 = 큰 별 터짐 + 어질 (흔들림)
    machpunch: { core: 0.4, run: (x, y, s, R, c, big, dir, g, n) => { sigPow(x, y, s, c, 0.35, false); hitLines(x, y, s, R * 1.1, c, n(4), 0.25, { dir, spread: 0.15 }); } },
    forcepalm: { core: 0.5, run: (x, y, s, R, c) => { hitRing(x, y, s, R * 0.3, R * 1.1, 0.9, 0.35, c); setTimeout(() => hitRing(x, y, s, R * 0.3, R * 1.3, 0.9, 0.3, c), 120); hitBolts(x, y, s, R * 0.7, sigPal('paralyze'), 2, 0.35); } },
    dynamicpunch: { core: 0.6, shake: true, run: (x, y, s, R, c) => { sigPow(x, y, s, c, 0.5, false); hitBloom(x, y, s, R * 1.2, c, 'star', 0.6, true, { only: true, n: 6 }); hitDizzy(x, y - R * 0.9, s, R, 0.8); } },
    // 독: 독침 = 작은 독방울 · 애시드봄 = 몸에 붙는 산 방울 + 김 · 베놈쇼크 = 독 거품 터짐 + 고리
    poisonsting: { core: 0.2, run: (x, y, s, R, c, big, dir) => { hitNeedles(x, y, s, R, c, 1, 0, 4, 0.45, dir); hitFountain(x, y, s, R * 0.3, c, 'drop', 0.3, false, dir, { rate: 15 }); } },
    acidspray: { core: 0.3, run: (x, y, s, R, c, big, dir, g, n) => { const p = sigPal('poison'); for (let i = 0; i < 7; i++) { const side = i % 2 ? 1 : -1; sigParticle({ x: x + side * R * moveRand(0.35, 0.75), y: y + moveRand(-0.35, 0.25) * R, s, max: 0.7, d: i * 0.04, cols: p, draw: (ctx, q, t, px) => { if (q.life < q.d) { return; } ctx.globalAlpha = hitStep(t > 0.7 ? (1 - t) / 0.3 : 1); const yy = q.y + Math.round(t * 3) * q.s; dotAt(ctx, px, q.s, q.x, yy + q.s, '#1a1626', 1, 2); hitBit(ctx, px, q.s, q.x, yy, 'drop', q.cols, 0.3, true); } }); } hitWisps(x, y, s, R * 0.6, ['#ffffff', '#d8c8f0', '#b9a6d6', '#8f78b0'], n(3), 0.5); } },
    venoshock: { core: 0.6, run: (x, y, s, R, c, big, dir) => { hitBloom(x, y, s, R * 0.9, c, 'bubble', 0.6, false, { g: -30, drag: 3.6 }); hitRing(x, y, s, R * 0.3, R * 1.1, 0.45, 0.35, c); hitFountain(x, y, s, R * 0.5, c, 'drop', 0.45, false, dir); } },
    // 얼음: 얼음뭉치 = 작은 얼음 조각 터짐 · 얼어붙은바람 = 바람 줄 + 몸에 서리 · 고드름침 = 연타 + 얼음 조각 · 눈싸라기 = 몸에 반짝 눈 · 눈보라 = 얼음 회오리 기둥 (흔들림) · 오로라빔 = 물결 + 무지개 반짝 · 냉동빔 = 큰 얼음 결정이 붙음 + 고리
    iceshard: { core: 0.4, run: (x, y, s, R, c) => hitBloom(x, y, s, R * 0.6, c, 'shard', 0.45, false, { g: 30, drag: 3 }) },
    icywind: { core: 0, run: (x, y, s, R, c, big, dir, g, n) => { hitLines(x, y, s, R, sigPal('wind'), n(5), 0.3, { dir, spread: 0.3 }); hitCling(x, y, s, R * 0.9, c, 'shard', n(5), 0.55); } },
    icicles: { core: 0.5, run: (x, y, s, R, c, big, dir, g, n) => { hitFlurry(x, y, s, R * 0.8, c, n(4)); hitBloom(x, y, s, R * 0.5, c, 'shard', 0.4, false, { g: 60, drag: 3 }); } },
    powdersnow: { core: 0, run: (x, y, s, R, c, big, dir, g, n) => hitCling(x, y, s, R * 0.9, c, 'sparkle', n(6), 0.55) },
    // 눈보라 — 얼음 회오리 (짧게 · 몸 가림 때문) + 몸 둘레 얼음 구름 (max(1.4R, 몸 반높이 × 2.2) — 몸의 1.5 ~ 2배 · 상성으로 R 이 작아도 (효과가 별로) 몸 앞 구멍보다 작아져 안 보이지 않게, 리드 9바퀴 · 점 160 (몸 앞 점은 안 그려 가림에 안 들어가서 — 90 은 양옆이 듬성해 전보다 약해 보임) · 0.7초 — #122 2단계 기획: 맞는 곳 얼음 터짐이 작고 빨리 사라지던 것)
    blizzard: { core: 0.6, shake: true, run: (x, y, s, R, c, big, dir, g, n, h) => { hitHelix(x, g, s, R * 0.85, h(1.8), c, 'shard', 0.3, dir * 10, false); hitBloom(x, y, s, R * 0.9, c, 'sparkle', 0.5, false, { only: true, n: 6 }); hitSnowCloud(x, y - R * 0.15, s, Math.max(R * 1.4, (g - y) * 2.2), c, 160, 0.7, dir || 1, g - h(100) + 2 * s, g, { rx: (g - y) * 1.4, ry: (g - y) * 1.15, y }); } },
    aurora: { core: 0.5, run: (x, y, s, R, c, big, dir, g, n) => { hitWaves(x, y, s, R, c, 3, 0.55); hitOrbit(x, y, s, R * 0.8, sigPal('fairy'), 'sparkle', n(6), 0.5, false); } },
    icebeam: { core: 0.8, run: (x, y, s, R, c, big, dir, g, n) => { hitCling(x, y, s, R, c, 'shard', n(8), 0.75, true); hitRing(x, y, s, R * 0.3, R * 1.2, 0.45, 0.35, c); } },
    // 드래곤: 용의숨결 = 용 혼 + 마비 지직 · 드래곤클로 = 할퀴기 셋 + 비늘 조각 · 더블촙 = 베기 둘 (0.2초 차) · 드래곤테일 = 낮게 쓸어치기 + 흙먼지 · 드래곤다이브 = 큰 퍽 + 비늘 폭발 + 충격파 (흔들림)
    dragonbreath: { core: 0.3, run: (x, y, s, R, c, big, dir, g, n) => { hitWisps(x, y + R * 0.2, s, R * 0.6, c, n(5), 0.55); hitBolts(x, y, s, R * 0.6, sigPal('paralyze'), 2, 0.3); } },
    dragonclaw: { core: 0.6, run: (x, y, s, R, c) => { hitClaws(x, y, s, R, c, 3); hitBloom(x, y, s, R * 0.7, c, 'shard', 0.5, false, { g: 10, drag: 3.4 }); } },
    dualchop: { core: 0.6, run: (x, y, s, R, c) => { hitClaws(x, y, s, R * 0.85, c, 1); setTimeout(() => hitClaws(x, y, s, R * 0.85, c, 1, true), 200); } },
    dragontail: { core: 0.5, run: (x, y, s, R, c, big, dir, g) => { hitArc(x, g - R * 0.3, s, R * 0.4, R * 1.4, 0.25, 0.45, c, 'front'); hitDust(x, g, s, R, c, 8); } },
    dragonrush: { core: 0.6, shake: true, run: (x, y, s, R, c, big, dir, g) => { sigPow(x, y, s, c, 0.5, false); hitBloom(x, y, s, R * 1.2, c, 'shard', 0.7, true, { g: 10, drag: 3, rate: 60 }); hitPulses(x, g, s, R, c, 2, 0.18); } },
    // 격투 2: 배대뒤치기 = 둘레를 도는 별 + 흙먼지 (메침) · 잠깨움뺨치기 = 짝짝 둘 + 금별 · 지옥의바퀴 = 구르며 퍽 + 고리 + 별 분수
    circlethrow: { core: 0.4, run: (x, y, s, R, c, big, dir, g) => { hitArc(x, y, s, R * 0.5, R, 1, 0.5, sigPal('fight'), 'top'); hitDust(x, g, s, R, c, 12); } },
    slap: { core: 0, run: (x, y, s, R, c, big, dir) => { const w = sigPal('normal'); hitRing(x, y - R * 0.3, s, R * 0.3, R * 0.9, 0.9, 0.25, w); setTimeout(() => hitRing(x, y - R * 0.3, s, R * 0.3, R * 0.9, 0.9, 0.25, w), 100); hitLines(x, y - R * 0.4, s, R * 0.6, w, 3, 0.25, { dir: -dir, spread: 0.5 }); hitBloom(x, y - R * 0.5, s, R * 0.5, HIT_GOLD, 'star', 0.45, false, { only: true, n: 3 }); } },
    submission: { core: 0.7, run: (x, y, s, R, c) => { sigPow(x, y, s, c, 0.5, false); hitRing(x, y, s, R * 0.3, R * 1.1, 0.5, 0.4, c); hitOrbit(x, y, s, R * 0.9, c, 'star', 4, 0.6, true); } },
    // 뼈 (땅): 뼈다귀치기 = 뼈색 퍽 + 충격선 + 흙먼지 · 본러시 = 뼈 연타 · 뼈다귀부메랑 = 갈 때 · 올 때 두 번 퍽 + 충격선
    boneclub: { core: 0.5, run: (x, y, s, R, c, big, dir, g) => { const b = sigPal('bone'); hitLines(x, y, s, R * 0.9, b, 3, 0.3); hitDust(x, g, s, R * 0.7, c, 6); hitBloom(x, y, s, R * 0.6, b, 'bone', 0.45, false, { only: true, n: 2, flat: 0.4 }); } },
    bonerush: { core: 0.4, run: (x, y, s, R, c, big, dir, g, n) => { const b = sigPal('bone'); hitFlurry(x, y, s, R * 0.9, b, n(4)); hitBloom(x, y, s, R * 0.6, b, 'bone', 0.45, false, { only: true, n: 4, flat: 0.4 }); } },
    bonemerang: { core: 0.7, run: (x, y, s, R, c, big, dir) => { const b = sigPal('bone'); sigPow(x, y, s, b, 0.45, false); setTimeout(() => sigPow(x - dir * R * 0.3, y - R * 0.2, s, b, 0.4, false), 260); hitLines(x, y, s, R * 0.35, b, 4, 0.3); hitBloom(x, y, s, R * 0.6, b, 'bone', 0.45, false, { only: true, n: 2, flat: 0.4 }); } },
    // 풀 채찍: 덩굴채찍 = 채찍 자국 하나 + 잎 조금 + 짧은 줄 · 파워휩 = X 채찍 자국 + 잎 폭발 + 충격선 (흔들림)
    vinewhip: { core: 0.3, run: (x, y, s, R, c) => { hitClaws(x, y, s, R * 0.9, c, 1); hitBloom(x, y, s, R * 0.4, c, 'leaf', 0.4, false, { g: 40, drag: 2.6 }); hitLines(x, y, s, R * 0.6, c, 3, 0.25); } },
    powerwhip: { core: 1, shake: true, run: (x, y, s, R, c, big, dir, g, n) => { hitClaws(x, y, s, R * 1.1, c, 2, true); hitBloom(x, y, s, R * 1.1, c, 'leaf', 0.7, true, { g: 40, drag: 2.6 }); hitLines(x, y, s, R * 1.1, c, n(8), 0.34); } },
    // 에스퍼: 염동력 = 물결 둘 + 어질 · 신통력 = 보라 둥근 고리 둘 + 감도는 반짝
    confusion: { core: 0.4, run: (x, y, s, R, c) => { hitWaves(x, y, s, R * 0.8, c, 2, 0.5); hitDizzy(x, y - R * 0.9, s, R, 0.6); } },
    extrasensory: { core: 0.6, run: (x, y, s, R, c, big, dir, g, n) => { const p = sigPal('hypno'); hitRing(x, y, s, R * 0.2, R * 1.2, 0.9, 0.4, p); setTimeout(() => hitRing(x, y, s, R * 0.2, R * 1.4, 0.9, 0.35, p), 150); hitOrbit(x, y, s, R * 0.9, c, 'sparkle', n(8), 0.55, false); } },
    // 비행 2: 바람일으키기 = 깃털 + 바람 줄 · 뛰어오르기 = 위에서 내리찍는 퍽 + 충격파 + 흙먼지
    gust: { core: 0.3, run: (x, y, s, R, c, big, dir) => { const w = sigPal('wind'); hitBloom(x, y, s, R * 0.8, w, 'feather', 0.55, false, { g: 10, drag: 2.4 }); hitLines(x, y, s, R * 0.8, w, 4, 0.28, { dir, spread: 0.5 }); } },
    bounce: { core: 0.6, run: (x, y, s, R, c, big, dir, g) => { sigPow(x, y - R * 0.4, s, c, 0.55, true); hitPulses(x, g, s, R, c, 2); hitDust(x, g, s, R * 0.8, c, 8); } },
    // 불꽃 2: 분연 = 불꽃 터짐 + 발밑 용암 + 돌 (흔들림) · 열풍 = 뜨거운 물결 넷 + 몸에 붙는 불꽃
    eruption: { core: 0.8, shake: true, run: (x, y, s, R, c, big, dir, g) => { hitBloom(x, y, s, R * 0.7, c, 'flame', 0.6, true, { g: 10, drag: 3 }); hitPuddle(x, g, s, R * 1.1, c, 0.7); hitFountain(x, y, s, R * 0.7, sigPal('rock'), 'rock', 0.6, false, dir); } },
    heatwave: { core: 0.4, run: (x, y, s, R, c, big, dir, g, n) => { hitWaves(x, y, s, R, c, 4, 0.6); hitCling(x, y, s, R * 0.9, c, 'flame', n(5), 0.5); } },
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
    // 높이는 HP 묶음 아래 (room) 안 — 아래 끝 R × 1.6 이 room 을 넘으면 대지의힘 기둥이 HP 막대를 13px 덮던 것 (#122 2단계 픽셀 3바퀴)
    const h = (m) => Math.min(room, Math.max(R * 1.6, R * m));
    // 1 공격 (몸통박치기) 은 노말 별 터짐을 작게, 색만 타입 — 기술 · 필살기보다 수수하게 (플레이 리뷰어)
    const styles = o.basic ? HIT_STYLES.normal : HIT_STYLES[type] || HIT_STYLES.normal;
    const style = styles[(o.pick ?? 0) % styles.length];
    // 기술마다 맞는 짜임 (표 hit 칸 — 1 공격 basic 은 그대로 수수하게)
    const mv = !o.basic && o.hit ? HIT_MOVES[o.hit] : null;
    hitQuiet = !!(o.light || o.basic);
    try {
        if (mv) {
            if (mv.core) hitCore(x, y, s, R * 0.8 * mv.core, cols);
            mv.run(x, y, s, R, cols, big, dir || 1, ground, n, h);
        } else {
            hitCore(x, y, s, R * 0.8, cols);
            style(x, y, s, R, cols, big, dir || 1, ground, n, h);
        }
    } finally {
        hitQuiet = false;
    }
    // 센 기술 · 효과가 굉장하면 화면도 살짝 (게임 중엔 배경 · 포켓몬만 2 ~ 3px — ult/core.js ultShake) · 기술 짜임은 shake 를 적은 것만
    if ((mv ? mv.shake : big || (o.scale ?? 1) > 1) && !o.light && typeof ultShake === 'function') {
        ultShake(2, 200);
    }
}
