// ── 3:3 용 판 — 합동 한 장면 · 필살기 힘겨루기 (2026-10-22 태현 님 #126 · #127 · #132 — orders #95, 디자인 시안 A) ──
// 합동: 모이기 (동료 기운이 앞장 입으로 · 입 앞 빛 구슬) → 발사 하나 (앞장 타입 줄기 + 동료 색 나선) → 터짐 하나 (참가자 색 고리) · 큰 효과는 한 번에 하나.
// 힘겨루기: 두 앞장 입에서 줄기가 무대 가운데서 만나 밀고 밀림 (0.9초 박자로 느리게) → 이긴 쪽 짧은 마무리는 합동 (quick) 이 그림.
// 모든 점은 포켓몬 그림 점 칸 (k) 에 맞춤 · 무대 위 끝 (--pg-fx-top) 아래 · 번쩍은 맞는 때 한 번 무대만 (흰색 55% 80ms). 게임 다리 (ult/bridge.js) 가 부름

// 타입 → 네 색 (흰 심 · 밝은 · 가운데 · 가장자리)
function t33Cols(type) {
    const name = (typeof FX_TYPE_PAL !== 'undefined' && FX_TYPE_PAL[type]) || type || 'normal';
    const p = sigPal(name);
    return ['#ffffff', p[1] ?? p[0], p[2] ?? p[1] ?? p[0], p[3] ?? p[p.length - 1]];
}
// 그림 점 칸 (k) — 그 포켓몬 그림 배율
function t33Cell(spec) {
    const r = (spec.box || spec.el).getBoundingClientRect();
    return Math.max(1, Math.round(r.width / (spec.size || 32)));
}
// 입 · 몸 가운데 (화면 px) — 대상 쪽을 봄
function t33Mouth(spec, toward) {
    const A = fxActor(spec);
    const left = fxFacesLeft(A, fxActor(toward));
    if (POKEMON_SHAPE[spec.form]) {
        return sigGeometry(A, left).mouth;
    }
    const b = fxBody(A);
    return { x: b.x + (left ? -b.w * 0.4 : b.w * 0.4), y: b.y - b.h * 0.15 };
}
// 몸 — 보이는 몸 상자 (그림 모양 — bridge fxShapeBox) · 없으면 칸 · y = 발 − 키 × 0.55 (가슴 — 칸 기준이라 작은 포켓몬은 머리 위 허공이던 것, 아트 디렉터 #95 4바퀴 ③)
function t33Body(spec) {
    const b = typeof fxShapeBox === 'function' ? fxShapeBox(spec) : null;
    if (b) {
        return { x: (b.left + b.right) / 2, y: b.bottom - (b.bottom - b.top) * 0.55, top: b.top, bottom: b.bottom, w: b.right - b.left, h: b.bottom - b.top };
    }
    const r = (spec.box || spec.el).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height * 0.55, top: r.top, bottom: r.bottom, w: r.width, h: r.height };
}
// 뒤 층 (bridge fxBackCtx — 포켓몬 몸 뒤) · 없으면 그대로
const t33Back = (ctx) => (typeof fxBackCtx === 'function' ? fxBackCtx(ctx) : ctx);
// 작은 별 — 8갈래 · 길이 L 칸 · 1칸 (안쪽 반 흰색) — 같이 맞아 쓰러진 상대 (고리 없음)
function t33Star(ctx, k, cx, cy, L, cols) {
    const px = (v) => Math.round(v / k) * k;
    const top = t33Top();
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        for (let j = 1; j < L; j++) {
            const y = cy + Math.sin(a) * j * k * (i % 2 ? 0.7 : 1);
            if (y < top) {
                continue;
            }
            ctx.fillStyle = j < L * 0.5 ? '#ffffff' : cols[1];
            ctx.fillRect(px(cx + Math.cos(a) * j * k * (i % 2 ? 0.7 : 1)), px(y), k, k);
        }
    }
}
// 먼지 — 2칸 네 점 (발 양옆으로 퍼짐 · step 0 ~ 3) — 맞는 상대 말고 같이 맞은 상대 (고리 대신, 아트 디렉터 #95 4바퀴 ④)
function t33Dust(ctx, k, cx, foot, step) {
    const px = (v) => Math.round(v / k) * k;
    for (const side of [-1, 1]) {
        for (let j = 0; j < 2; j++) {
            ctx.fillStyle = j ? '#a88a55' : '#d1b178';
            ctx.fillRect(px(cx + side * (4 + step * 2 + j * 3) * k), px(foot - (j + (step >> 1)) * k), 2 * k, 2 * k);
        }
    }
}
const t33Top = () => Math.max(typeof fxTop === 'function' ? fxTop() : 0, parseFloat(document.body.style.getPropertyValue('--pg-fx-top')) || 0);
const T33_BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const t33Reduce = () => document.getElementById('pokemon-game')?.classList.contains('pg-reduce-motion') === true;

// 줄기 — p0 (입) → p1 (끝) · 두께 T 칸 · head = 0 ~ 1 (앞끝이 간 만큼) · 열 2칸마다 높이를 칸 단위로 (계단 — 줄이 달라도 기울기는 칸 계단, 아트 fxAimRow)
// style: fire (6칸마다 위로 눕힌 불꽃 혀) · water (5칸마다 흰 거품 마루) · 그 밖은 반짝 점
// 1칸 열 · 높이는 1칸 계단 — 겹 (가장자리 → 심) 마다 내려앉는 x 를 엇갈림 (모든 겹이 같은 x 에서 한꺼번에 내려앉아 벽돌 마디로 보이던 것 — 아트 디렉터 #95 9바퀴 ① · 태현 님 대각선) ·
// edges = [위 가장자리 색, 아래 가장자리 색] — 합동 동료 몫 (줄기 가장자리 1칸 줄, 한 색 심 + 감는 고리)
const T33_STAGGER = [-0.375, -0.125, 0.125, 0.375];
function t33Beam(ctx, k, p0, p1, T, head, cols, style, t, edges = null) {
    const px = (v) => Math.round(v / k) * k;
    const dir = p1.x >= p0.x ? 1 : -1;
    const len = Math.abs(p1.x - p0.x);
    const reach = len * Math.max(0, Math.min(1, head));
    const half = (T * k) / 2;
    const layers = [
        [1, cols[3]],
        [0.78, cols[2]],
        [0.5, cols[1]],
        [0.22, cols[0]],
    ];
    const shimmer = Math.floor(t / 0.08) % 2;
    for (let d = 0; d <= reach; d += k) {
        const x = px(p0.x + dir * d);
        const f = len ? d / len : 0;
        const yf = p0.y + (p1.y - p0.y) * f;
        const cell = Math.round(d / k);
        let top0 = 0;
        let bot0 = 0;
        layers.forEach(([w, c], li) => {
            const h = Math.max(k, px(half * 2 * w));
            const yc = Math.round(yf / k + T33_STAGGER[li]) * k;
            const top = yc - Math.round(h / 2 / k) * k;
            ctx.fillStyle = c;
            ctx.fillRect(x, top, k, h);
            if (li === 0) {
                top0 = top;
                bot0 = top + h;
            }
        });
        // 동료 색 줄은 바깥 짙은 테 한 칸 안쪽 (테 위에 두면 풀밭 초록에 묻히던 것)
        if (edges) {
            ctx.fillStyle = edges[0];
            ctx.fillRect(x, top0 + k, k, k);
            ctx.fillStyle = edges[1];
            ctx.fillRect(x, bot0 - 2 * k, k, k);
        }
        // 불꽃 혀 — 간격 · 높이를 칸 해시로 들쭉날쭉 (6칸마다 똑같아 톱날 같던 것 — 아트 디렉터 #95 3바퀴 ②)
        const hh = ((Math.floor(cell / 2) * 2654435761) >>> 0) % 13;
        if (style === 'fire' && cell % 2 === 0 && hh < 3 && d > 3 * k) {
            const tall = 2 + ((hh + shimmer) % 4);
            for (let j = 0; j < tall; j++) {
                ctx.fillStyle = j < 1 ? cols[1] : j < tall - 1 ? cols[2] : cols[3];
                ctx.fillRect(px(x - dir * j * k * 0.6), top0 - (j + 1) * k, 2 * k, k);
            }
        } else if (style === 'water' && cell % 5 === 0) {
            // 거품 마루 — 위 가장자리에 붙은 2칸 (떠 있는 흰 네모 점이 아니게 — 아트 디렉터 #95 ④)
            ctx.fillStyle = cols[1];
            ctx.fillRect(x, top0 - k, 2 * k, k);
        }
    }
    // 앞끝 — 둥근 머리 (반지름 T/2 + 1 칸)
    if (head > 0) {
        const hx = p0.x + dir * reach;
        const hy = p0.y + (p1.y - p0.y) * (len ? reach / len : 0);
        t33Disc(ctx, k, hx, hy, Math.round(T / 2) + 1, [cols[3], cols[2], cols[1], cols[0]]);
    }
}
// 칸 원판 — 반지름 R 칸 · 바깥부터 색 (cols 4개 — 비율 1 · 0.75 · 0.5 · 0.25)
function t33Disc(ctx, k, cx, cy, R, cols) {
    const px = (v) => Math.round(v / k) * k;
    const steps = [1, 0.75, 0.5, 0.25];
    for (let i = 0; i < 4; i++) {
        const r = Math.max(1, Math.round(R * steps[i]));
        ctx.fillStyle = cols[i];
        for (let dy = -r; dy <= r; dy++) {
            const w = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
            ctx.fillRect(px(cx) - w * k, px(cy) + dy * k, (2 * w + 1) * k, k);
        }
    }
}
// 섞인 큰 폭발 (시안 A ⑤ — 아트 디렉터 #95 2바퀴): 8갈래 별 (2칸 · 반지름 12 → 20 → 24칸, 80ms 씩) + 두꺼운 고리 (가운데 45% 빈 · 8조각 두 색 번갈아 · 가로 ×1.4) + 발밑 충격파 호 3조각.
// 위 끝 (무대) · 아래 끝 (패널) 안으로 줄임 · step = 0 ~ 3 · keep = 바둑판 지우기 (null = 다) · colsC = 셋째 색 (고리 조각을 세 색 번갈아 — 3인 합동)
function t33Burst(ctx, k, cx, cy, foot, step, R, colsA, colsB, keep, edge = 'dot', maxR = Infinity, colsC = null) {
    const px = (v) => Math.round(v / k) * k;
    const top = t33Top();
    const H0 = window.innerHeight;
    // 반지름 — 무대 위 끝 · 패널 아래 끝 · 옆 포켓몬 (가로 ×1.6 로 닿기 2칸 앞) 안으로 (옆 상대를 덮던 것 — 아트 디렉터 #95 3바퀴 ⑤)
    const fitR = Math.max(4, Math.min(R, maxR, Math.floor((cy - top) / k) - 1, Math.floor((H0 - 2 - cy) / k)));
    const ok = (x, y) => y >= top && y < H0 && (!keep || keep(Math.round(x / k), Math.round(y / k)));
    const put = (x, y, w, h, c) => {
        if (ok(x, y)) {
            ctx.fillStyle = c;
            ctx.fillRect(px(x), px(y), w * k, h * k);
        }
    };
    // 별 — 처음 0.24초 (3걸음)
    if (step < 3) {
        const L = Math.min(fitR + 4, [12, 20, 24][step]);
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            for (let j = 2; j < L; j++) {
                const x = cx + Math.cos(a) * j * k * (i % 2 ? 0.8 : 1.15);
                const y = cy + Math.sin(a) * j * k * (i % 2 ? 0.8 : 1);
                put(x, y, 2, 2, j < L * 0.5 ? '#ffffff' : colsA[0]);
            }
        }
    }
    // 고리 — 얇게 (안쪽 75% 빔 · 두께 최대 2칸) · 가로 ×1.6 · 8조각 두 색 · 4걸음째부터 호 6조각 (40° 칠 · 20° 빔) 으로 끊고 걸음마다 1칸씩 얇아지며 사라짐 · 조각마다 혀
    // (두께 55% 칠한 도넛이 납작한 벡터 · 구명 튜브처럼 보이던 것 — 아트 디렉터 #95 3바퀴 ①, design-system 265)
    const Rr = Math.max(4, Math.min(fitR, [6, 11, 16, 20][Math.min(3, step)]));
    // 호 6조각은 같은 걸음에 2칸 → 없음 (1칸씩 얇아지다 조각 하나가 ^ 처럼 혼자 남던 것 — 아트 디렉터 #95 4바퀴 ⑥)
    const thick = step <= 3 ? 2 : 0;
    const arcs = step >= 3;
    if (thick > 0) {
        for (let dy = -Rr; dy <= Rr; dy++) {
            for (let dx = -Math.round(Rr * 1.6); dx <= Math.round(Rr * 1.6); dx++) {
                const nx = dx / 1.6;
                const d = Math.sqrt(nx * nx + dy * dy);
                if (d > Rr || d < Math.max(Rr * 0.75, Rr - thick)) {
                    continue;
                }
                const deg = ((Math.atan2(dy, nx) * 180) / Math.PI + 360) % 360;
                if (arcs && deg % 60 >= 40) {
                    continue;
                }
                const seg = Math.floor(deg / 45) % 8;
                const cols = colsC ? [colsA, colsB, colsC][seg % 3] : seg % 2 ? colsB : colsA;
                put(cx + dx * k, cy + dy * k, 1, 1, d > Rr - 1 ? cols[1] : cols[0]);
            }
        }
        // 호 조각마다 혀 (불 = 불꽃 혀 · 풀 = 꽃잎 · 물 = 물방울)
        if (arcs) {
            for (let i = 0; i < 6; i++) {
                const a = ((i * 60 + 20) * Math.PI) / 180;
                const x = cx + Math.cos(a) * (Rr + 1) * 1.6 * k;
                const y = cy + Math.sin(a) * (Rr + 1) * k;
                if (edge === 'fire') {
                    put(x, y - 2 * k, 1, 2, '#ff7a21');
                    put(x - k, y - k, 1, 1, '#ffc93c');
                } else if (edge === 'grass') {
                    put(x, y, 2, 1, '#ffb3d1');
                    put(x, y - k, 1, 1, '#ffb3d1');
                } else if (edge === 'water') {
                    put(x, y, 1, 2, '#5cb8f6');
                    put(x, y, 1, 1, '#ffffff');
                } else {
                    put(x, y, 1, 1, colsA[0]);
                }
            }
        }
    }
    // 발밑 충격파 호 3조각 (가운데 · 양옆) — 고리와 같은 걸음에 없앰 (고리가 걷힌 뒤 발밑 ^ 셋이 0.35초 혼자 남던 것 — 아트 디렉터 #95 6바퀴 ⑥)
    if (step > 3) {
        return;
    }
    // 고리 가로 폭 안 (옆 발밑 판에 닿던 것 — 아트 디렉터 #95 4바퀴 ⑤)
    const sw = Math.max(2, Math.min(Math.floor(fitR * 1.6) - 3, 8 + step * 5));
    for (const side of [-1, 0, 1]) {
        for (let j = -3; j <= 3; j++) {
            const x = cx + (side * sw + j) * k;
            const y = foot - Math.round(Math.cos((j / 3) * Math.PI * 0.5) * 2) * k;
            put(x, y, 1, 1, colsA[1]);
        }
    }
}
// 고리 — 가로 타원 (가로 × 1.6) · 두께 2칸 · 8조각 (cols 번갈아) · 가운데 빔 · 조각 끝마다 모양 (fire 불꽃 혀 · grass 꽃잎 · water 물방울)
function t33Ring(ctx, k, cx, cy, R, cols, edge, keep) {
    const px = (v) => Math.round(v / k) * k;
    const n = Math.max(16, Math.round(R * 7));
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const seg = Math.floor((i / n) * 8);
        for (let w = 0; w < 3; w++) {
            const rr = R - w;
            const x = cx + Math.cos(a) * rr * 1.6 * k;
            const y = cy + Math.sin(a) * rr * k;
            if (keep && !keep(px(x) / k, px(y) / k)) {
                continue;
            }
            ctx.fillStyle = w === 1 ? cols[seg % cols.length][0] : cols[seg % cols.length][1];
            ctx.fillRect(px(x), px(y), k, k);
        }
    }
    for (let s = 0; s < 8; s++) {
        const a = ((s + 0.5) / 8) * Math.PI * 2;
        const x = px(cx + Math.cos(a) * (R + 1) * 1.6 * k);
        const y = px(cy + Math.sin(a) * (R + 1) * k);
        if (keep && !keep(x / k, y / k)) {
            continue;
        }
        if (edge === 'fire') {
            ctx.fillStyle = '#ff7a21';
            ctx.fillRect(x, y - 2 * k, k, 2 * k);
            ctx.fillStyle = '#ffc93c';
            ctx.fillRect(x - k, y - k, k, k);
        } else if (edge === 'grass') {
            ctx.fillStyle = '#ffb3d1';
            ctx.fillRect(x, y, 2 * k, k);
            ctx.fillRect(x, y - k, k, k);
        } else if (edge === 'water') {
            ctx.fillStyle = '#5cb8f6';
            ctx.fillRect(x, y, k, 2 * k);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x, y, k, k);
        } else {
            ctx.fillStyle = cols[0][1];
            ctx.fillRect(x, y, k, k);
        }
    }
}
// 맞는 곳 둘레만 번쩍 (가로 타원 · 반지름 R 칸 · 흰색 a — 무대 전체 흰 막이던 것, UX 리뷰어 #95 ⑥) · 위 끝은 넘지 않음
// 반투명 대신 바둑판 점 (a = 남길 비율 — 반투명 흰 원판으로 보이던 것, #95 ⑨)
function t33Flash(ctx, k, cx, cy, R, a) {
    const top = t33Top();
    const lvl = Math.round(a * 16);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    const x0 = Math.round(cx / k);
    const y0 = Math.round(cy / k);
    for (let dy = -R; dy <= R; dy++) {
        const y = (y0 + dy) * k;
        if (y < top) {
            continue;
        }
        const w = Math.round(Math.sqrt(Math.max(0, R * R - dy * dy)) * 1.6);
        for (let dx = -w; dx <= w; dx++) {
            const cxk = x0 + dx;
            if (T33_BAYER[(((cxk % 4) + 4) % 4) + ((((y0 + dy) % 4) + 4) % 4) * 4] < lvl) {
                ctx.fillRect(cxk * k, y, k, k);
            }
        }
    }
}
const t33Edge = (type) => (type === 'fire' ? 'fire' : type === 'grass' ? 'grass' : type === 'water' ? 'water' : 'dot');
// 동료 나선 색 [몸 · 그림자 (같은 색 진하게)] — 금색 (UI 금) · 검은 그림자 쓰지 않음 (아트 디렉터 #95 ④ ⑤)
const T33_SPIRAL = { fire: ['#ff9f5a', '#a83a1c'], water: ['#5cb8f6', '#2466d0'], grass: ['#7bd04a', '#2f8a2f'], electric: ['#ffe066', '#b08a00'], ice: ['#bff0ff', '#4a9ec4'], psychic: ['#ff8fd0', '#a33a7a'] };
const t33Spiral2 = (type) => T33_SPIRAL[type] || [t33Cols(type)[2], t33Cols(type)[3]];
const t33Style = (type) => (type === 'fire' ? 'fire' : type === 'water' ? 'water' : 'plain');
// 동료 타입들 → 줄기 가장자리 색 [위, 아래] (없으면 null)
const t33Edges = (types) => (types.length ? [t33Spiral2(types[0])[0], t33Spiral2(types[1] ?? types[0])[0]] : null);

/**
 * 합동 한 장면 — parts = [{ spec, type }] (첫째 = 앞장) · dst = 맞는 상대 (spec) · quick = 힘겨루기 뒤 짧은 마무리.
 * 박자 (초): 보통 = 모이기 0.6 ~ 1.3 · 발사 1.3 (0.3초에 뻗음) · 맞음 2.25 · 터짐 ~ 2.9 · 사그라짐 ~ 3.3 / quick = 발사 0.3 · 맞음 0.9 · 사그라짐 ~ 1.9.
 * 피해는 다리가 맞는 때 타이머 (엔진 jointHitMs · clashJointHitMs 와 같게). 돌려줌 = 끝 (ms)
 */
function t33Joint(parts, dst, o = {}) {
    const lead = parts[0];
    const k = t33Cell(lead.spec);
    const quick = !!o.quick;
    // finish = 힘겨루기 줄기가 이미 뚫고 닿음 (다리가 이어받음) — 구슬 · 줄기 없이 맞음 · 터짐만
    const finish = !!o.finish;
    const triple = parts.length >= 3;
    const T = triple ? 13 : 11;
    const cL = t33Cols(lead.type);
    const c2 = t33Cols(parts[1]?.type ?? lead.type);
    const style = t33Style(lead.type);
    const edge = t33Edge(parts[1]?.type ?? lead.type);
    // 맞는 때 = 엔진 박자 (o.hitMs — TIMING.team.jointHitMs · clashJointHitMs) · 발사는 그 0.95초 (quick 0.6초) 앞
    const tHit = (o.hitMs ?? (quick ? 900 : 2250)) / 1000;
    const tGather = quick ? 0 : Math.min(0.6, tHit * 0.27);
    // 줄기는 맞기 0.35초 앞에 뻗음 (0.3초) — 닿고 0.6초 동안 아무 일 없던 것 (UX 리뷰어 #95 ⑧) · 그 앞은 모으기 · 구슬
    const tFire = Math.max(tGather + 0.1, tHit - 0.35);
    const tGone = tHit + 0.65;
    const tEnd = tGone + 0.4;
    // 고리 6 → 11 → 16 → 20 칸 (셋이면 +4) — 혼자 필살기보다 작아 보이던 것 (아트 디렉터 #95 ⑤)
    const ringR = triple ? [10, 15, 20, 24] : [6, 11, 16, 20];
    const reduce = t33Reduce();
    sigParticle({
        x: 0, y: 0, s: k, max: tEnd, z: 0,
        draw: (ctx, p) => {
            const t = p.life;
            // 앞 입자가 남긴 투명도를 이어받지 않게 (반짝이가 사그라질 때 줄기 · 고리가 같이 깜빡이던 것 — UX 리뷰어 #95 ③)
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
            // 자리는 장마다 다시 잼 (맞음 밀림 · 쓰러짐 — 줄기 끝이 몸을 따라감)
            const m = t33Mouth(lead.spec, dst);
            const tb = t33Body(dst);
            const tgt = { x: tb.x, y: Math.min(tb.y, tb.bottom - T * k * 0.6) };
            ctx.imageSmoothingEnabled = false;
            // 모이기 · 구슬 · 줄기 · 나선 = 포켓몬 뒤 층 (bk) · 터짐 = 위 (ctx)
            const bk = t33Back(ctx);
            // ③ 모이기 — 동료 몸 → 앞장 입 (위로 볼록 점선 · 3칸 · 80ms 마다 한 칸) · 입 앞 빛 구슬 3 → 7칸
            if (!quick && t >= tGather && t < tFire + 0.1) {
                // 동료 → 앞장 기운 = 동료 색 2칸 점선 (2칸 찍고 1칸 비움 · 80ms 마다 한 칸 흐름) · 앞 층 (앞줄 꽃 뒤에 숨어 동료 몫이 1칸 점 몇 개로만 보이던 것 — 아트 디렉터 #95 9바퀴 ②)
                parts.slice(1).forEach((q, i) => {
                    const b = t33Body(q.spec);
                    const cq = t33Cols(q.type);
                    const steps = Math.max(6, Math.round(Math.hypot(m.x - b.x, m.y - b.y) / (2 * k)));
                    const adv = Math.floor((t - tGather) / 0.08);
                    for (let j = 0; j < steps; j++) {
                        if ((j - adv + 3000) % 3 === 2) {
                            continue;
                        }
                        const f = j / steps;
                        const x = b.x + (m.x - b.x) * f;
                        const y = b.y + (m.y - b.y) * f - Math.sin(f * Math.PI) * (10 + i * 4) * k * 0.6;
                        ctx.fillStyle = j > steps * 0.8 ? '#ffffff' : cq[1];
                        ctx.fillRect(Math.round(x / k) * k, Math.round(y / k) * k, 2 * k, 2 * k);
                    }
                });
            }
            const orbR = quick ? 4 : t < tFire ? Math.min(7, 3 + Math.floor(Math.max(0, t - tGather) / 0.14)) : 4;
            if (t < tHit + 0.1 && !finish) {
                // 입 앞 구슬도 앞 층 (앞줄 동료 몸에 반쯤 숨던 것)
                t33Disc(ctx, k, m.x, m.y, orbR, [cL[3], cL[2], cL[1], cL[0]]);
                // 바깥 고리 — 동료 색 45° 조각 번갈아
                if (parts.length > 1) {
                    const n = Math.max(12, orbR * 7);
                    for (let i = 0; i < n; i++) {
                        const a = (i / n) * Math.PI * 2;
                        const seg = Math.floor((i / n) * 8) % (parts.length - 1);
                        ctx.fillStyle = t33Cols(parts[1 + seg].type)[2];
                        ctx.fillRect(Math.round((m.x + Math.cos(a) * (orbR + 1) * k) / k) * k, Math.round((m.y + Math.sin(a) * (orbR + 1) * k) / k) * k, k, k);
                    }
                }
            }
            // ④ 발사 하나 — 0.3초에 6단으로 뻗음 · 맞을 때까지 머묾 (동작 줄이기면 다 뻗은 모양)
            if (t >= tFire && t < tHit + 0.12 && !finish) {
                const head = reduce ? 1 : Math.min(1, Math.floor(((t - tFire) / 0.3) * 6) / 6);
                // 맞은 뒤 0.12초 — 꼬리 (입 쪽) 부터 2걸음에 걷어 냄 (반투명 0.5 이던 것 — 아트 디렉터 #95 3바퀴 ③)
                const cut = t > tHit ? Math.min(2, 1 + Math.floor((t - tHit) / 0.06)) / 2 : 0;
                const from = { x: m.x + (tgt.x - m.x) * cut, y: m.y + (tgt.y - m.y) * cut };
                // 동료 몫 = 줄기 위 가장자리 (동료 1) · 아래 가장자리 (동료 2 — 둘이면 동료 1) 1칸 줄 (흩뿌린 물결 점이 안 보이던 것 — 아트 디렉터 #95 9바퀴 ②)
                t33Beam(bk, k, from, tgt, T, head, cL, style, t, t33Edges(parts.slice(1).map((q) => q.type)));
            }
            // ⑤ 터짐 하나 — 섞인 큰 폭발 (별 + 두꺼운 고리 + 발밑 충격파 · 앞장 + 두 번째 참가자 색만) · 다른 상대는 발밑 작은 터짐 · 사그라짐은 바둑판 (흰 원판 · 몸 둘레 점 고리이던 것 — 아트 디렉터 #95 2바퀴)
            if (t >= tHit && t < tEnd) {
                // 0 ~ 3 = 커짐 (80ms 씩) · 3 = 호 6조각으로 머묾 · tGone 부터 80ms 마다 1칸씩 얇아지며 사라짐 (바둑판 지우기 대신)
                const step = reduce ? 3 : t < tGone ? Math.min(3, Math.floor((t - tHit) / 0.08)) : 3 + 1 + Math.floor((t - tGone) / 0.08);
                // 고리 가로 반지름 ≤ 옆 몸 끝 − 2칸 · 세로 (= 가로 ÷ 1.6) 아래 끝 ≤ 발밑 판 − 1칸 (아트 디렉터 #95 4바퀴 ⑤)
                const nearR = Number.isFinite(o.nearDx) ? Math.floor((o.nearDx - 2 * k) / (1.6 * k)) : Infinity;
                const floorR = o.floorY ? Math.floor((o.floorY - tgt.y) / k) - 1 : Infinity;
                t33Burst(ctx, k, tgt.x, tgt.y, tb.bottom - k, step, ringR[3], [cL[1], cL[2]], [c2[1], c2[2]], null, edge, Math.min(nearR, floorR));
                // 같이 맞은 상대 = 발밑 2칸 먼지만 (고리는 맞는 상대 하나 — 큰 것이 한 장면에 6 ~ 7개이던 것, 아트 디렉터 #95 4바퀴 ④) ·
                // 그 상대가 쓰러졌으면 맞고 0.15초 뒤 작은 별 두 걸음 (고리 없이 0.16초 — 쓰러진 쪽은 아무 일 없이 회색이 되고 살아남은 쪽에만 터지던 것, 디자인 UX #95 6바퀴 ④)
                if (step <= 3) {
                    for (const q of o.others || []) {
                        const ob = t33Body(q);
                        t33Dust(ctx, k, ob.x, ob.bottom - 2 * k, step);
                        const down = !!(q.box && q.box.classList && q.box.classList.contains('pg-team-down'));
                        const ks = Math.floor((t - tHit - 0.15) / 0.08);
                        if (down && ks >= 0 && ks < 2) {
                            t33Star(ctx, k, ob.x, ob.y, [6, 9][ks], cL);
                        }
                    }
                }
            }
        },
    });
    return Math.round(tEnd * 1000);
}

/**
 * 필살기 힘겨루기 (3:3 용 판) — 두 앞장 입에서 줄기가 나와 (0.8초 뒤 · 0.3초에 뻗음) 무대 가운데서 만나 밀고 밀림.
 * 만나는 곳 = 가운데 + 이길 확률 (live) 만큼 · 0.9초마다 한쪽씩 천천히 (빠른 떨림 없음 — 태현 님). 합류한 포켓몬은 앞장 입으로 기운이 흘러가고 줄기가 2칸씩 굵어짐.
 * st = { win: 'a' | 'b' | null, joinA, joinB } — 다리가 바꿈. 끝은 다리가 particle 수명을 줄여서
 */
function t33Duel(a, b, typeA, typeB, live, st, o = {}) {
    const k = t33Cell(a);
    const cA = t33Cols(typeA);
    const cB = t33Cols(typeB);
    const sA = t33Style(typeA);
    const sB = t33Style(typeB);
    // 줄기가 나가는 때 = 만나는 때 (엔진 ultClashLeadMs) 0.3초 앞 · 수명 = 만남 + 힘겨루기 + 1초 (다리가 결과 · 멈춤에서 끝냄)
    const t0 = Math.max(0.2, ((o.leadMs ?? 1100) - 300) / 1000);
    const life = ((o.leadMs ?? 1100) + (o.clashMs ?? 3800)) / 1000 + 1;
    const reduce = t33Reduce();
    let push = 0;
    let goal = 0;
    let lastBeat = -1;
    const p = {
        x: 0, y: 0, s: k, max: life, z: 0,
        update: (q, dt) => {
            const t = q.life;
            const beat = Math.floor((t - t0 - 0.3) / 0.9);
            if (t > t0 + 0.3 && beat !== lastBeat) {
                lastBeat = beat;
                let pr = 0.5;
                try {
                    pr = Math.min(1, Math.max(0, Number(live()) || 0.5));
                } catch (err) {
                    ultError('team duel live', err);
                }
                // 이길 확률만큼 기울고 · 박자마다 반대쪽으로 조금 (밀고 밀림)
                goal = Math.max(-0.6, Math.min(0.6, (pr - 0.5) * 1.2 + (beat % 2 ? 0.12 : -0.12)));
            }
            if (st.win) {
                goal = st.win === 'a' ? 1 : -1;
            }
            // 만나는 곳은 목표로 천천히 (1초에 0.6 — 0.9초마다 한 장면에 42 ~ 68px 순간이동하던 것, UX 리뷰어 #95 ④) · 이기면 1초에 1.2 이상 — 맞기 (st.hitAt) 0.3초 앞에는 진 쪽 입에 닿게
            // (그 뒤 꼬리부터 걷혀 맞기 0.1초 앞에 다 걷힘 — 아트 디렉터 #95 4바퀴 ④) · 동작 줄이기면 바로
            const left = st.hitAt ? Math.max(0.05, st.hitAt - 0.3 - t) : 0.6;
            const rate = st.win ? Math.max(1.2, Math.abs(goal - push) / left) : 0.6;
            const step = reduce ? 1 : rate * (dt || 0);
            push += Math.max(-step, Math.min(step, goal - push));
        },
        draw: (ctx, q) => {
            const t = q.life;
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
            ctx.imageSmoothingEnabled = false;
            const mA = t33Mouth(a, b);
            const mB = t33Mouth(b, a);
            // 줄기 · 나선 · 구슬 = 포켓몬 뒤 층 (bk) · 만나는 곳 별 = 위
            const bk = t33Back(ctx);
            // 이긴 줄기 걷기 — 맞기 0.2초 앞 반 · 0.15초 앞 4분의 3 (꼬리 = 입 쪽부터)
            const cut = st.hitAt ? (t < st.hitAt - 0.2 ? 0 : t < st.hitAt - 0.15 ? 0.5 : 0.75) : 0;
            // 모으기 구슬 (0 ~ 0.8 · VS 띠 동안) · 결과가 나면 진 쪽 구슬은 없음 · 걷기 시작하면 이긴 쪽도
            const r = Math.min(5, 2 + Math.floor(t / 0.2));
            if (st.win !== 'b' && !cut) {
                t33Disc(bk, k, mA.x, mA.y, r, [cA[3], cA[2], cA[1], cA[0]]);
            }
            if (st.win !== 'a' && !cut) {
                t33Disc(bk, k, mB.x, mB.y, r, [cB[3], cB[2], cB[1], cB[0]]);
            }
            if (t < t0) {
                return;
            }
            const head = reduce ? 1 : Math.min(1, Math.floor(((t - t0) / 0.3) * 6) / 6);
            const mid = { x: (mA.x + mB.x) / 2, y: (mA.y + mB.y) / 2 };
            const span = Math.abs(mB.x - mA.x) / 2;
            const dirAB = mB.x >= mA.x ? 1 : -1;
            const meet = { x: mid.x + dirAB * push * span, y: mid.y + (mB.y - mA.y) * (push * 0.5) };
            const TA = 9 + 2 * (st.joinA || 0);
            const TB = 9 + 2 * (st.joinB || 0);
            const fromA = cut ? { x: mA.x + (meet.x - mA.x) * cut, y: mA.y + (meet.y - mA.y) * cut } : mA;
            const fromB = cut ? { x: mB.x + (meet.x - mB.x) * cut, y: mB.y + (meet.y - mB.y) * cut } : mB;
            // 합류한 동료 = 그쪽 줄기 가장자리 1칸 줄 (합동과 같은 문법)
            if (st.win !== 'b') {
                t33Beam(bk, k, fromA, meet, TA, head, cA, sA, t, t33Edges(st.typesA || []));
            }
            if (st.win !== 'a') {
                t33Beam(bk, k, fromB, meet, TB, head, cB, sB, t, t33Edges(st.typesB || []));
            }
            // 만나는 곳 — 별 빛 (두 색 · 0.16초마다 돎) · 동작 줄이기면 멈춘 모양
            if (head >= 1 && !st.win) {
                const rot = reduce ? 0 : Math.floor(t / 0.16) % 2;
                const px = (v) => Math.round(v / k) * k;
                const R = 6;
                for (let i = -R; i <= R; i++) {
                    ctx.fillStyle = Math.abs(i) < 2 ? '#ffffff' : i % 2 ? cA[1] : cB[1];
                    if (rot) {
                        ctx.fillRect(px(meet.x + i * k), px(meet.y + i * k), k, k);
                        ctx.fillRect(px(meet.x + i * k), px(meet.y - i * k), k, k);
                    } else {
                        ctx.fillRect(px(meet.x + i * k), px(meet.y), k, k);
                        ctx.fillRect(px(meet.x), px(meet.y + i * k), k, k);
                    }
                }
                t33Disc(ctx, k, meet.x, meet.y, 3, ['#ffffff', cA[1], '#ffffff', '#ffffff']);
            }
        },
    };
    sigParticle(p);
    // sigParticle 은 복사해 넣음 — 실제 입자를 돌려줌 (다리가 수명을 줄이고 · 지우기에서 뺄 때 같은 것을 보게)
    return moveParticles[moveParticles.length - 1];
}

/**
 * 장면 전환 합동 — 넘겨주기 (#101 앞장에게 기를 모아 주기 · #102 모양 시안 A · B · C — 디자인 값): 다리 (team11Joint) 의 입자가 매 장면 부름.
 * q = { now, allies: [{ A, c, n, type }], kL, track (앞장 연출이 채움), tracked, gatherTo(now), st, LA, hitEnd, onGather }
 * 색 4단 = 흰 심 #fff8e0 · 옅은 (타입 + 흰 50%) · 본색 · 짙은 (타입 + 남색 #0c101e 50%) · 반투명 없이 (바둑판) · 자리는 매 장면 칸에 맞춤 · 고리 번쩍은 1초 3번 아래
 * 모양 = window.__pgJointStyle (시안 — 기본 A):
 *  A 빛의 끈 — 동료 가슴 → 구 가장자리 · 대포 끝 (2차 곡선 · 꼭짓점 거리 × 0.35 위 / 셋째 × 0.2 아래) · 단면 7칸 (흰 1 · 옅은 · 본색 · 짙은 테) 200ms 마다 5칸으로 숨쉼 ·
 *    50ms 마다 4칸 뻗음 (머리 흰 3×3 + 옅은 십자) · 흐르는 빛 (흰 2×2 + 옅은 테 · 50ms 마다 4칸 · 28칸 간격) · 닿을 때 구 +1칸 (× 1.5 까지) · 끝나면 동료 쪽부터 50ms 마다 6칸 걷힘 ·
 *    빔은 쏠 때 나선을 따라 흐르는 빛 · 3인은 두 끈이 구 −60° · +30° 에 닿고 흐르는 빛이 반 박자 어긋남
 *  B 오라 리본 — 동료 몸 둘레 불꽃 혀 7개 (폭 2 ~ 3 · 높이 8 ~ 16칸 · 100ms 마다 바뀜) · 400ms 마다 오라 꼭대기가 4칸 솟고 리본 (40칸 · 폭 5 ↔ 3 — 8칸마다) 이 S 자 길로 50ms 마다 4칸 ·
 *    구 둘레 (반지름 + 3칸) 를 3/4 바퀴 감고 바둑판 두 걸음으로 사라짐 · 구 +1칸 · 빔은 물줄기보다 넓은 나선 리본 · 3인은 200ms 어긋나 번갈아 · 구 둘레에서 반대로 감음
 *  C 빛 알갱이 강 — 타입 모양 알갱이 (불꽃 혀 3×5 · 잎 5×3 · 물방울 3×5 · 별 3×3) 1초에 20개 · 분수처럼 10 ~ 16칸 솟고 머리 위를 나선으로 돈 뒤 (반지름 6칸) 강을 타고
 *    마지막 0.4초에 구 가운데로 좁아지는 나선 (20 → 0칸 · 크기 5 → 3 → 1) · 네 개 중 하나 흰 십자 반짝 · 6개마다 구 +1칸 (× 1.6 까지) · 구 둘레 타입 색 점 4개가 돎 · 구 안 동료 색 점 ·
 *    빔은 쏠 때 물줄기 둘레 나선 (반폭 + 4칸) 을 타고 대상 쪽으로 · 3인은 위 · 뒤 아래 두 강
 * 공통: 구 (원기옥) — 고리 안 기운 막 (동료 색 바둑판) + 1칸 고리 · 무대 위 끝에 닿으면 세로를 줄인 타원 · 날아갈 때 구 안 동료 색 점 / 빔 — 물줄기를 감는 동료 색 나선 + 스파크 /
 * 그 밖 (알려 주지 않는 연출) — 맞을 때까지 앞장 몸에 동료 색 점선 오라
 */
const T11_STYLES = ['A', 'B', 'C', 'S1'];
const t11Style = () => {
    const s = typeof window !== 'undefined' ? window.__pgJointStyle : '';
    return T11_STYLES.includes(s) ? s : 'S1'; // 기본 = #103 반짝이 별 (태현 님 #106 "그냥 이걸로") · A · B · C 는 시험 창 스위치로만
};
// #103 반짝이 별 (태현 님 "리자몽 변신 필살기 끝 반짝이 + 일반 모드 꾹 누르기 기 모으기, 2개 합쳐서 기를 넘겨준다") — 디자인 값 (칸 · 초)
//  S1 = 별이 넓게 날아감 (갈래 ② 끈은 태현 님 "넓게 들어가야돼" 로 뺌) · 별 색 = 동료 타입 4단 (태현 님 "속성에 따라서 별 색깔은 바껴야 되는거 알지?" · 3인은 두 색으로 누구 기운인지)
// 18타입 별 4단 [심, 팔, 팔 끝, 그림자 (악 · 고스트는 별 둘레 1칸 밝은 테)] — 디자인 #103 (TYPE_COLOR 에서 셈: 심 흰 85% · 팔 흰 45% · 끝 본색 · 그림자 남색 55%)
const T11_STAR_COLS = { normal: ['#f7f7f2', '#e1e1cf', '#c8c8a8', '#61635c'], fire: ['#ffebe0', '#ffb68c', '#ff7a2e', '#794025'], water: ['#e4f0ff', '#9bc9ff', '#4a9cff', '#284f83'], electric: ['#fff9e0', '#ffe88c', '#ffd52e', '#796925'], grass: ['#e7f8e4', '#a7e59b', '#5fcf4a', '#316632'], ice: ['#eefcff', '#c1f2ff', '#8fe8ff', '#477183'], fighting: ['#f8e5e1', '#e59f93', '#d0503a', '#642d2b'], poison: ['#f3e6f9', '#d4a4ea', '#b05ad8', '#563172'], ground: ['#f9f3e7', '#ead4a8', '#d8b060', '#68583c'], flying: ['#f2f6ff', '#cfdcff', '#a8c0ff', '#525f83'], psychic: ['#ffe6f1', '#ffa4cb', '#ff5aa0', '#793158'], bug: ['#f2f7e0', '#cfe18d', '#a8c830', '#526326'], rock: ['#f4f1e6', '#d8cba3', '#b8a058', '#595138'], ghost: ['#ebe7f4', '#b6a9d8', '#9b89ca', '#d0c8e6'], dragon: ['#ebe6ff', '#b6a4ff', '#7a5aff', '#3d3183'], dark: ['#e6e4e2', '#a49b96', '#837770', '#c5c0bc'], steel: ['#f4f6f8', '#d8dce5', '#b8c0d0', '#595f6e'], fairy: ['#fff2f9', '#ffcfea', '#ffa8d8', '#795472'] };
const T11_STAR_RIM = new Set(['ghost', 'dark']);
// 넘겨주기 별만 온 테를 두르는 타입 · 테 색 — 풀 별은 숲 그림자색 (연두 별이 풀밭 바닥에 묻히던 것 — 상대 합동 숲의 분노, #96 아트 5바퀴 4)
const T11_STAR_RIM_COL = { grass: '#1c2e30' };
// 앞장 번개 3단 (디자인 #103 — r = 닿은 무더기 ÷ 전체) [간격 ms, 개수, 길이 칸, 꺾임, 갈래]
const T11_BOLT = [{ every: 900, n: 1, len: [8, 10], bends: [2, 2], br: [0, 0] }, { every: 600, n: 2, len: [10, 12], bends: [3, 3], br: [0, 1] }, { every: 400, n: 3, len: [12, 14], bends: [3, 4], br: [1, 2] }];
// 모으기는 0.3초에 다 차고 주는 구간 끝까지 같은 세기로 계속 (hold — 끝나면 다리가 멈춤) · 별은 0.3초부터 무더기마다 갈래 수만큼 한꺼번에 (모으면서 동시에 보냄 · 넓게 — 디자인 #103)
// lanes = 갈래마다 곧은 선 가운데에서 수직으로 비켜 둔 조절점 (칸 · 위가 −) · sizes = 갈래 크기 (무더기마다 한 칸씩 돌림) · stopLeft = 모으기가 이만큼 (초) 남으면 새 무더기 없음 (마지막이 끝에 닿게)
const T11_STAR = { charge: 0.3, hold: 6000, first: 0.3, every2: 0.25, every3: 0.3, lanes2: [-40, -24, -10, 6, 18, 30], lanes3: [-36, -14, 6, 24], sizes2: ['tiny', 'small', 'big', 'big', 'small', 'tiny'], sizes3: ['small', 'big', 'big', 'tiny'], pop: [6, 10], dur: [0.45, 0.6], stopLeft: 0.55, ringN: 14, ringR: 150, ringDur: 0.8, ringStop: 0.85 };
// 색 섞기 (#rrggbb 만 — 아니면 그대로)
function t11Mix(a, b, t) {
    if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) {
        return a;
    }
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const x = p(a);
    const y = p(b);
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
// 넘겨주기 4단 색 — [흰 심, 옅은, 본색, 짙은]
function t11Cols(type) {
    const m = t33Cols(type)[2];
    return ['#fff8e0', t11Mix(m, '#ffffff', 0.5), m, t11Mix(m, '#0c101e', 0.5)];
}
// 알갱이 모양 (W 흰 심 · L 옅은 · M 본색 · D 짙은)
const T11_GRAIN = {
    fire: ['.D.', '.M.', 'MLM', 'LWL', '.M.'],
    grass: ['.MMD.', 'MLLLD', '.DMD.'],
    water: ['.L.', '.M.', 'WLM', 'LMM', 'DMD'],
    star: ['.L.', 'LWL', '.L.'],
    mid: ['.M.', 'MLM', '.M.'],
};
function t11Gather(ctx, q) {
    const { now, allies, track, st } = q;
    const k = q.kL;
    const px = (v) => Math.round(v / k) * k;
    const top = t33Top();
    const style = t11Style();
    const dot = (x, y, c, n = 1) => {
        if (y < top) {
            return;
        }
        ctx.fillStyle = c;
        ctx.fillRect(px(x), px(y), n * k, n * k);
    };
    // 가운데에 n 칸 네모
    const blk = (x, y, c, n) => dot(x - ((n - 1) * k) / 2, y - ((n - 1) * k) / 2, c, n);
    const cross = (x, y, c, arm = 1) => {
        dot(x, y, c[0]);
        for (let i = 1; i <= arm; i++) {
            for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                dot(x + ox * i * k, y + oy * i * k, c[1]);
            }
        }
    };
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = false;
    allies.forEach((a) => {
        a.cols = a.cols || t11Cols(a.type);
    });
    // 메가진화 · 풀림 (1:1 하얀 실루엣 — 태현 님 10-20) 동안은 그 상자 안에 안 그림 (별은 실루엣 둘레에서 멈칫한 것처럼 · 번개 · 오라 불꽃 혀는 끝난 뒤부터 — #96 디자인)
    const late = !track.willMorph || !!track.morphed;
    let lbCache = null;
    const leadBody = () => lbCache || (lbCache = t11LeadBody(q.LA, track));
    // 빔 모으는 동안 (쏘기 전) · 오라 모으는 동안은 앞장 몸 상자 + 2px 안에 합동 별 · 꼬리 · 번개를 안 그림 (거북왕이 묻히던 것 · 동료 별이 이상해꽃 꽃 · 얼굴 위에 내려앉던 것 — #96 아트 2 · 2바퀴 1)
    // 전용 구 (track.uniq) 는 구 자리를 알려도 모으는 동안 몸 비움을 그대로 (구가 입 앞이라 작은 몸이 별에 묻히던 것 — 나무지기, 4바퀴 3)
    const beamGather = (q.kind === 'beam' && !track.on) || (q.kind === 'aura' && now < q.hitEnd) || (q.kind === 'orb' && (track.kind !== 'orb' || (track.uniq && track.gather)) && now < q.hitEnd);
    const holes = [];
    if (track.morph && track.morphBox) {
        const mb = track.morphBox;
        holes.push([mb.x - mb.w / 2, mb.b - mb.w * 1.1, mb.w, mb.w * 1.1 + 4 * k]);
    }
    if (beamGather) {
        const lb = leadBody();
        // 구를 안 알리는 구 앞장 (전용 구) 은 몸 16px 안 (작은 몸이 구 · 별에 가려지던 것 — 나무지기, #96 아트 4바퀴 3)
        const pad = q.kind === 'orb' ? 16 : 2;
        holes.push([lb.x - lb.w / 2 - pad, lb.y - lb.h * 0.55 - pad, lb.w + pad * 2, lb.h + pad * 2]);
    }
    let clipped = false;
    let lateDraw = null;
    if (holes.length) {
        ctx.save();
        for (const [x, y, w, h] of holes) {
            ctx.beginPath();
            ctx.rect(0, 0, window.innerWidth, window.innerHeight);
            ctx.rect(x, y, w, h);
            ctx.clip('evenodd');
        }
        clipped = true;
    }
    try {
    // 빔 쏘는 쪽 (+1 = 오른쪽) — 쏜 뒤는 빔 방향 · 그 전은 상대 쪽 (q.foe = 앞장이 상대보다 오른쪽)
    const bdir = track.kind === 'beam' && track.dir ? Math.sign(track.dir) : q.foe ? -1 : 1;
    const ballR = Math.round(4 + 4 * Math.min(1, (st.hitWaves || 0) / Math.max(1, st.waves || 1))) * k;
    // 빔 · 좁은 패널 (400 아래) = 별 꼬리 선 끔 · 무더기 별 반 (240 에서 앞장이 물 돔 · 별 꼬리에 묻히던 것 — #96 아트 2바퀴 4)
    const thin = (q.kind === 'beam' || !!track.uniq) && window.innerWidth < 400;
    const to0 = q.gatherTo(now);
    // 빔 앞장 모이는 곳 = 대포 끝 · 입에서 쏘는 쪽으로 (구슬 반지름 + 2칸) 민 자리 (#96 아트 2)
    const to = to0 && q.kind === 'beam' && track.kind !== 'orb' && !track.here ? { ...to0, x: to0.x + bdir * (ballR + 2 * k) } : to0;
    const starStyle = style === 'S1';
    if (to && !st.on) {
        st.on = true;
        q.onGather?.(starStyle ? T11_STAR.charge * 1000 : 1800, starStyle ? T11_STAR.hold : 0, starStyle);
    }
    if (!to && st.on && !st.ended) {
        st.ended = true;
        q.onGatherEnd?.();
    }
    // 구 — 지금 반지름 (닿을수록 커짐 · A · B × 1.5 · C × 1.6) · 위 끝에 닿으면 세로를 줄인 타원
    const orb = track.kind === 'orb' && track.r > 0;
    // 커짐 상한 = 구 가운데에서 (앞장 발 − 2칸) 까지 − 바깥 고리 1칸 − 2칸 (187 에서 커진 구 밑이 일자로 잘리던 것 — 아트 #103 ③)
    const lb0 = fxBody(q.LA);
    const R = orb ? Math.max(track.r + k, Math.min(track.r + k + Math.min(track.r * (style === 'C' ? 0.6 : 0.5), Math.floor(st.arrivals) * k), lb0.y + lb0.h / 2 - 5 * k - track.y, track.y - top - 4 * k)) : 0;
    // 구 상자 — 화면 합동 이름 판이 비켜 섬 (TeamCutin JointNamePlate)
    if (typeof window !== 'undefined') {
        window.__pgJointOrb = orb ? { x: track.x, y: track.y, R: Math.max(R, track.r * 1.3) + 2 * k, at: now } : null;
    }
    const ryOf = (cy, rr) => Math.max(4 * k, Math.min(rr, cy - top - 2 * k));
    // 닿음 고리 번쩍 (1장면 옅은 → 1장면 본색) — 0.34초에 한 번까지 (1초 3번 아래)
    const ringFlash = (a) => {
        if (now - (st.ringAt ?? -1e9) >= 340) {
            st.ringAt = now;
            st.ringC = a.cols;
        }
    };
    // 베지어 (2차 · 3차) — at(t) · nrm(t) · cells (칸 길이)
    const bez = (P) => {
        const n = P.length - 1;
        const at = (t) => {
            const pts = P.map((p) => ({ x: p.x, y: p.y }));
            for (let r = 1; r <= n; r++) {
                for (let i = 0; i <= n - r; i++) {
                    pts[i] = { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t };
                }
            }
            return pts[0];
        };
        const nrm = (t) => {
            const a = at(Math.max(0, t - 0.01));
            const b = at(Math.min(1, t + 0.01));
            const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
            return { x: -(b.y - a.y) / l, y: (b.x - a.x) / l };
        };
        let L = 0;
        let prev = P[0];
        for (let s = 1; s <= 16; s++) {
            const p = at(s / 16);
            L += Math.hypot(p.x - prev.x, p.y - prev.y);
            prev = p;
        }
        return { at, nrm, cells: Math.max(1, Math.round(L / k)), end: P[n] };
    };
    const lb = fxBody(q.LA);
    const feet = lb.y + lb.h / 2;
    // 모이는 곳 — 구면 가장자리 위 왼쪽 (동료 쪽) 에서 각도만 달리: 둘 = 60° · 셋 = 가까운 동료 35° · 먼 동료 70° (셋째 +30° 아래로 들어와 동료 발밑을 뚫던 것 — 아트 #102 ②) · 아니면 그 점
    const entryOf = (a, ctr, src, pad = 0) => {
        if (q.kind === 'aura' && !orb) {
            const lb = leadBody();
            return { x: lb.x + (src.x < lb.x ? -1 : 1) * (lb.w / 2 + 2 + pad), y: lb.y - lb.h * 0.1 };
        }
        if (!(ctr.r > 0) || !orb) {
            return { x: ctr.x, y: ctr.y };
        }
        const rr = R + pad;
        const sx = src.x < ctr.x ? -1 : 1;
        const rad = ((allies.length < 2 ? 60 : a.n % 2 ? 70 : 35) * Math.PI) / 180;
        return { x: ctr.x + sx * Math.cos(rad) * rr, y: ctr.y - Math.sin(rad) * ryOf(ctr.y, rr) };
    };
    // 2차 곡선 — 위로 (꼭짓점 거리 × up) · 셋째는 아래로 (× down · 앞장 발 4칸 위까지)
    const quad = (a, src, dst, up = 0.35, down = 0.2) => {
        const dist = Math.hypot(dst.x - src.x, dst.y - src.y) || 1;
        const my = (src.y + dst.y) / 2;
        let cy = a.n % 2 ? my + dist * down * 2 : my - dist * up * 2;
        cy = a.n % 2 ? Math.min(cy, 2 * (feet - 4 * k) - my) : Math.max(cy, top + 2 * k);
        return bez([src, { x: (src.x + dst.x) / 2, y: cy }, dst]);
    };
    const chest = (a) => {
        const b = fxBody(a.A);
        return { x: b.x, y: b.y - b.h / 2 + b.h * 0.4 };
    };
    // 위로 휘는 길 (A · B) — 꼭짓점: 가까운 동료 = 거리 × 0.35 위 · 먼 동료 (셋째) = 가운데 동료 머리보다 6칸 · 가까운 끈 꼭짓점보다 6칸 위 (두 끈이 겹치지 않게 —
    // 아래로 휘어 동료 발밑 · 땅을 가로지르던 것, 아트 #102 ② ③)
    const apexOf = (a, src, dst, ctr) => {
        let y = (src.y + dst.y) / 2 - (Math.hypot(dst.x - src.x, dst.y - src.y) || 1) * 0.35;
        const near = a.n % 2 ? allies.find((x) => x.n === 0) : null;
        if (near) {
            const ns = chest(near);
            const nd = entryOf(near, ctr, ns);
            const nb = fxBody(near.A);
            y = Math.min(y, (ns.y + nd.y) / 2 - (Math.hypot(nd.x - ns.x, nd.y - ns.y) || 1) * 0.35 - 6 * k, nb.y - nb.h / 2 - 6 * k);
        }
        return Math.max(top + 2 * k, y);
    };
    const upPath = (a, src, dst, ctr) => bez([src, { x: (src.x + dst.x) / 2, y: 2 * apexOf(a, src, dst, ctr) - (src.y + dst.y) / 2 }, dst]);
    // #96 빔 앞장 (디자인) — 빔 시작 (대포 끝 · 입) 충전 구슬: 반지름 4 → 8칸 (받을수록) · 앞장 별 색 4단 (심 [0]) + 동료마다 굵은 팔 2개 (구 소용돌이를 작게 — t11OrbInner)
    const ball = q.kind === 'beam' && to && !orb ? { x: to.x, y: to.y, r: ballR } : null;
    if (ball && ball.y - ball.r >= top) {
        // 몸 상자 비우기 밖에서 (끝에) 그림 — 대포 끝에 걸쳐도 잘리지 않게
        lateDraw = () => {
            const LC0 = T11_STAR_COLS[q.leadType] || T11_STAR_COLS.normal;
            t33Disc(ctx, k, ball.x, ball.y, Math.round(ball.r / k), [LC0[3], LC0[2], LC0[1], LC0[0]]);
            t11OrbInner(ctx, { now, allies, kL: k, st, x: ball.x, y: ball.y, r: ball.r, foe: q.foe, armsPer: 2 });
        };
    }
    // 동료 둘레 — 동료 색 1칸 테 (어둠 구멍 = 그림 반 + 2칸 — ult/core ultDimLayer 와 같은 셈) · 모으기부터 맞은 뒤 0.3초까지 · 셋에 하나는 비움
    // (동료 · 상대 둘레가 같은 바둑판 원이라 뜻 없는 얼룩으로 보이던 것 — 상대 구멍은 없앰 · 동료는 테로만, #96 아트 5바퀴 8)
    if (st.on && now < q.hitEnd + 300 && !q.contrast) {
        allies.forEach((a) => {
            const el = a.A?.collision;
            if (!el || a.A.el?.style?.visibility === 'hidden') {
                return;
            }
            const r = el.getBoundingClientRect();
            if (r.width < 1) {
                return;
            }
            const pxA = Math.max(1, Math.round(r.width / (a.A._originalSpriteSize || 32)));
            const RR = (Math.round(Math.max(r.width, r.height) / 2 / pxA) + 2) * pxA;
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            const C = (T11_STAR_COLS[a.type] || T11_STAR_COLS.normal)[2];
            const n = Math.max(24, Math.round((2 * Math.PI * RR) / k));
            for (let j = 0; j < n; j++) {
                if (j % 3 === 2) {
                    continue;
                }
                const ang = (j / n) * Math.PI * 2;
                dot(cx + Math.cos(ang) * RR, cy + Math.sin(ang) * RR, C);
            }
        });
    }
    // ① 넘겨주기
    allies.forEach((a) => {
        const f = (a.flow = a.flow || { parts: [], ribs: [], seq: 0 });
        if (to) {
            f.ctr = to;
            f.on = f.on ?? now;
            f.off = undefined;
        } else if (f.on !== undefined && f.off === undefined) {
            f.off = now;
        }
        // 끝난 뒤엔 지금 자리를 따라감 (구가 날아가도 · 대포가 밀려도 — 옛 자리에 토막이 남던 것, 아트 #102 ①)
        if (!to && f.off !== undefined) {
            if (orb) {
                f.ctr = { x: track.x, y: track.y, r: track.r };
            } else if (track.kind === 'beam') {
                f.ctr = { x: track.gx, y: track.gy, r: 0 };
            }
        }
        if (!f.ctr || f.on === undefined) {
            return;
        }
        if (starStyle) {
            drawStars(a, f);
        } else if (style === 'A') {
            drawCord(a, f);
        } else if (style === 'B') {
            drawRibbon(a, f);
        } else {
            drawRiver(a, f);
        }
    });
    // 앞장 번개 (초사이어인 2 — 태현 님 #103 "기를 받아서 필살기를 쓰는 포켓몬이 그렇게" · 디자인 값) — 기운을 받는 쪽만 · 처음 무더기가 닿을 때부터 맞는 때 + 0.3초까지 ·
    // 3단 (T11_BOLT — r = 닿은 무더기 ÷ 전체 · 쏘는 동안은 3단) · 한 번 = 2장면 (80ms → 80ms 꺾임만 반대로) · 진짜 시계 (▶▶ 에서도 1초 3번 아래) · 1칸 테두리 ·
    // 자리 규칙 (기획): 구 필살기 = 구 (겉면 1 · 1 · 2 — 테두리를 가로질러 r × 0.7 → 바깥 · clamp(r × 0.6, 14, 22)칸 · 1장면 흰 심 + 양옆 동료 본색 3칸 굵기 · 2장면 동료 본색 · 테 = 동료 짙은
    //   + 둘레 0 · 1 · 3 — 반지름 방향 ±30° · r + 3 ~ 10칸) / 빔 쏘는 동안 = 빔 둘레 (가장자리 바깥 2칸 · 빔 방향 ±20° · 25 ~ 85% 4토막 위아래) /
    // 그 밖 = 몸 둘레 45° 7자리 · 반지름 방향 ±30° (머리 위 가로 지그재그가 만화 화남 표시처럼 읽히던 것) · 동작 줄이기면 안 그림 (아트 #103 — 번개가 노란 심 · 파랑 팔에 묻혀 안 보이던 것)
    // 구 필살기는 구가 터진 뒤 (몸 둘레) 엔 번개 없음 — 날아가는 구 겉면을 따라가다 맞을 때 끝 (리자드 몸의 꺾은선이 낙서처럼 보이던 것 — 아트 #103)
    if (starStyle && !t33Reduce() && st.hitWaves && now < q.hitEnd + 300 && !(track.kind === 'orb' && !orb) && late) {
        const RN = typeof fxRealNow === 'function' ? fxRealNow() : now;
        const LC = T11_STAR_COLS[q.leadType] || T11_STAR_COLS.normal;
        const C2 = T11_STAR_RIM.has(q.leadType) ? LC[3] : LC[2];
        const ratio = st.ended ? 1 : st.hitWaves / Math.max(1, st.waves || 1);
        const li = ratio < 1 / 3 ? 0 : ratio < 2 / 3 ? 1 : 2;
        const L = T11_BOLT[li];
        const beamOn = track.kind === 'beam' && track.on && track.len > 8 * k;
        const where = orb ? 'orb' : beamOn ? 'beam' : ball ? 'ball' : 'body';
        const angD = (a1, b1) => Math.abs((((a1 - b1) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
        let bx;
        let by;
        let rx;
        let ry2;
        let sc = 1;
        if (orb) {
            bx = track.x;
            by = track.y;
            rx = R;
            ry2 = ryOf(track.y, R);
            sc = Math.max(12, Math.min(18, (R / k) * 0.5)) / 14;
        } else if (where === 'ball') {
            // 빔 앞장 쏘기 전 — 충전 구슬 둘레 (#96 디자인 "대포 · 입 둘레")
            bx = ball.x;
            by = ball.y;
            rx = ball.r;
            ry2 = ball.r;
            sc = 0.8;
        } else {
            const lb2 = leadBody();
            bx = lb2.x;
            by = lb2.y;
            rx = lb2.w / 2;
            ry2 = lb2.h / 2;
            sc = Math.max(0.6, Math.min(1, lb2.h / k / 24));
        }
        const rint = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
        const mk = () => ({ bends: rint(L.bends[0], L.bends[1]), br: rint(L.br[0], L.br[1]), jit: [rint(2, 3), rint(2, 3), rint(2, 3), rint(2, 3)], brs: [Math.random(), Math.random()], spark: Math.random() < 0.5 ? -1 : 1 });
        // 자리가 바뀌어도 (구 → 몸 · 몸 → 빔) 다음 차례까지 기다림 — 바로 내면 19 ~ 280ms 만에 또 번쩍여 1초 3번을 넘던 것
        if (!st.bolt || RN >= st.bolt.next) {
            const prev = st.bolt && st.bolt.where === where ? st.bolt : { slots: [], segs: [], surfs: [] };
            const bolts = [];
            const slots = [];
            const segs = [];
            const surfs = [];
            if (where === 'orb') {
                // 겉면 1 · 1 · 2 — 불꽃 혀 자리 (위 ±30°) 빼고 · 앞 번 · 같은 번과 60° 넘게
                const nSurf = li === 2 ? 2 : 1;
                for (let tries = 0; tries < 24 && surfs.length < nSurf; tries++) {
                    const a0 = Math.random() * Math.PI * 2;
                    if (angD(a0, -Math.PI / 2) < Math.PI / 6 || prev.surfs.some((b0) => angD(a0, b0) < Math.PI / 3) || surfs.some((b0) => angD(a0, b0) < Math.PI / 3)) {
                        continue;
                    }
                    surfs.push(a0);
                    st.boltN = (st.boltN || 0) + 1;
                    bolts.push({ kind: 'surf', a0, tilt: ((Math.random() * 2 - 1) * Math.PI) / 12, ally: st.boltN % allies.length, len: Math.round(Math.max(14, Math.min(22, (track.r / k) * 0.6))), jit: [2, 2] });
                }
            }
            const nRest = where === 'orb' ? [0, 1, 3][li] : L.n;
            if (where === 'beam') {
                for (const sg of [0, 1, 2, 3].sort(() => Math.random() - 0.5)) {
                    if (bolts.length >= nRest) {
                        break;
                    }
                    if (prev.segs.includes(sg)) {
                        continue;
                    }
                    segs.push(sg);
                    bolts.push({ kind: 'beam', seg: sg, side: sg % 2 ? 1 : -1, tilt: ((Math.random() * 2 - 1) * Math.PI) / 9, ...mk() });
                }
            } else {
                for (const sl of [0, 1, 3, 4, 5, 6, 7].sort(() => Math.random() - 0.5)) {
                    if (slots.length >= nRest) {
                        break;
                    }
                    // 45° 자리 (0 = 오른쪽 · 2 = 발밑 가운데 — 뺌) · 바로 앞 번 자리 · 같은 번 90° 안 자리는 건너뜀
                    if (prev.slots.includes(sl) || slots.some((o2) => Math.min((sl - o2 + 8) % 8, (o2 - sl + 8) % 8) < 2)) {
                        continue;
                    }
                    const th = (sl * Math.PI) / 4;
                    // 구 = r + 3 ~ 10칸 · 몸 = 가장자리 바깥 1 ~ 3칸
                    const out = (orb ? rint(3, 10) : where === 'ball' ? rint(2, 5) : rint(1, 3)) * k;
                    const cx0 = bx + Math.cos(th) * (rx + out);
                    const cy0 = by + Math.sin(th) * (ry2 + out);
                    if ((track.kind === 'beam' && Math.cos(th) * (track.dir || 1) > 0.5) || cy0 < top + 4 * k || cy0 > feet - 2 * k) {
                        continue;
                    }
                    // 반지름 방향 ±30° (구 · 몸 둘 다)
                    const ta = th + ((Math.random() * 2 - 1) * Math.PI) / 6;
                    bolts.push({ kind: orb ? 'rim' : 'body', cx: cx0 - bx, cy: cy0 - by, ta, len: Math.round(rint(L.len[0], L.len[1]) * sc), ...mk() });
                    slots.push(sl);
                }
            }
            st.bolt = { at: RN, next: RN + Math.max(360, L.every + (Math.random() * 2 - 1) * 40), slots, segs, surfs, bolts, where };
            // 시험 창 (모양 스위치를 쓴 때만) — 번개 뜬 진짜 시각 기록 (1초 3번 아래인지 셈)
            if (typeof window !== 'undefined' && window.__pgJointStyle && bolts.length) {
                (window.__j11 = window.__j11 || []).push(Math.round(RN));
            }
        }
        const age = RN - st.bolt.at;
        if (age < 160) {
            const first = age < 80;
            // 1칸 계단 선 — 칸을 모아 두고 (색 · 테 색) 끝에 1칸 테두리 → 칠
            const cells = [];
            const line = (x0, y0, x1, y1, c, rim = LC[3]) => {
                const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / k));
                for (let i = 0; i <= n; i++) {
                    cells.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c, rim]);
                }
            };
            const one = (x, y, c) => cells.push([x, y, c, LC[3]]);
            for (const bt of st.bolt.bolts) {
                let cx0;
                let cy0;
                let ang;
                let len = bt.len;
                if (bt.kind === 'surf') {
                    if (!orb) {
                        continue;
                    }
                    // 겉면 — r × 0.7 에서 바깥으로 테두리를 가로지름 (반은 구 밖 풀 위)
                    ang = bt.a0 + bt.tilt;
                    cx0 = track.x + Math.cos(bt.a0) * track.r * 0.7 + Math.cos(ang) * (len / 2) * k;
                    cy0 = track.y + Math.sin(bt.a0) * track.r * 0.7 + Math.sin(ang) * (len / 2) * k;
                } else if (bt.kind === 'beam') {
                    if (!beamOn) {
                        continue;
                    }
                    const d = track.len * (0.25 + (bt.seg + 0.5) * 0.15);
                    const xx = track.x0 + track.dir * d;
                    cx0 = xx;
                    cy0 = track.yAt(xx) + bt.side * (track.w / 2 + 2 * k);
                    ang = (track.dir > 0 ? 0 : Math.PI) + bt.tilt;
                    len = Math.round(Math.max(10, Math.min(16, (track.w / 2 / k) * 1.5)));
                } else {
                    cx0 = bx + bt.cx;
                    cy0 = by + bt.cy;
                    ang = bt.ta;
                }
                const ux = Math.cos(ang);
                const uy = Math.sin(ang);
                const nx = -uy;
                const ny = ux;
                const x0 = cx0 - ux * (len / 2) * k;
                const y0 = cy0 - uy * (len / 2) * k;
                const bends = bt.kind === 'surf' ? 2 : bt.bends;
                const pts = [{ x: x0, y: y0 }];
                for (let m = 1; m <= bends; m++) {
                    const along = (len * m) / (bends + 1);
                    const side = (m % 2 ? 1 : -1) * (first ? 1 : -1) * bt.jit[(m - 1) % bt.jit.length];
                    pts.push({ x: x0 + (ux * along + nx * side) * k, y: y0 + (uy * along + ny * side) * k, side });
                }
                pts.push({ x: x0 + ux * len * k, y: y0 + uy * len * k });
                if (bt.kind === 'surf') {
                    // 1장면 = 흰 심 + 양옆 동료 본색 (3칸 굵기) · 2장면 = 동료 본색 · 테 = 동료 짙은 (흰 심 · 파랑 팔에 묻히던 것)
                    const AC = T11_STAR_COLS[allies[bt.ally % allies.length].type] || T11_STAR_COLS.normal;
                    for (let m = 0; m < pts.length - 1; m++) {
                        if (first) {
                            for (const sd of [-1, 1]) {
                                line(pts[m].x + nx * sd * k, pts[m].y + ny * sd * k, pts[m + 1].x + nx * sd * k, pts[m + 1].y + ny * sd * k, AC[2], AC[3]);
                            }
                        }
                        line(pts[m].x, pts[m].y, pts[m + 1].x, pts[m + 1].y, first ? LC[0] : AC[2], AC[3]);
                    }
                    continue;
                }
                const AB = T11_STAR_COLS[allies[(bt.ally ?? 0) % allies.length].type] || T11_STAR_COLS.normal;
                for (let m = 0; m < pts.length - 1; m++) {
                    line(pts[m].x, pts[m].y, pts[m + 1].x, pts[m + 1].y, first ? LC[0] : AB[2]);
                }
                if (!first) {
                    continue;
                }
                // 꺾인 점 바깥 1칸 본색 · 갈래 (꺾인 점에서 30 ~ 60° · 3 ~ 5칸 · 꺾임 1번) · 불똥 (한쪽 끝 너머 1칸 띄우고)
                for (let m = 1; m < pts.length - 1; m++) {
                    const sd = Math.sign(pts[m].side) || 1;
                    one(pts[m].x + nx * sd * k, pts[m].y + ny * sd * k, C2);
                }
                for (let b2 = 0; b2 < bt.br && b2 < pts.length - 2; b2++) {
                    const pm = pts[1 + b2];
                    const sd = Math.sign(pm.side) || 1;
                    const a2 = ang + sd * (Math.PI / 6 + (bt.brs[b2] * Math.PI) / 6);
                    const bl = 3 + Math.floor(bt.brs[b2] * 3);
                    const mx = pm.x + Math.cos(a2) * (bl / 2) * k;
                    const my = pm.y + Math.sin(a2) * (bl / 2) * k;
                    const a3 = a2 - sd * (Math.PI / 6);
                    line(pm.x, pm.y, mx, my, C2);
                    line(mx, my, mx + Math.cos(a3) * (bl / 2) * k, my + Math.sin(a3) * (bl / 2) * k, C2);
                }
                const end = bt.spark < 0 ? pts[0] : pts[pts.length - 1];
                one(end.x + ux * bt.spark * 2 * k, end.y + uy * bt.spark * 2 * k, C2);
            }
            for (const [x, y, , rim] of cells) {
                for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                    dot(x + ox * k, y + oy * k, rim);
                }
            }
            for (const [x, y, c] of cells) {
                dot(x, y, c);
            }
        }
    }
    // A 빛의 끈 (o.cols = 색 4단 · o.delay = 늦게 뻗음 ms)
    function drawCord(a, f, o = {}) {
        const src = chest(a);
        const P = upPath(a, src, entryOf(a, f.ctr, src), f.ctr);
        const C = o.cols || a.cols;
        const age = now - f.on - (o.delay || 0);
        if (age < 0) {
            return;
        }
        const grown = Math.min(P.cells, Math.floor(age / 50) * 4 + 4);
        // 끝나면 한 줄인 채로 3걸음 (150ms) 에 구 · 대포 쪽으로 빨려 듦 (지금 자리를 따라감) · 꼬리가 닿는 장면에 흰 번쩍 1장면
        // (동료 쪽부터 걷혀 30 ~ 60px 토막이 구 위 · 패널 바닥에 2 ~ 3장면 떠 있던 것 — 아트 #102 ①)
        let c0 = 0;
        if (f.off !== undefined) {
            const s3 = Math.floor((now - f.off) / 50) + 1;
            if (s3 >= 3) {
                if (s3 === 3) {
                    cross(P.end.x, P.end.y, C, 2);
                }
                return;
            }
            c0 = Math.ceil((P.cells * s3) / 3);
        }
        if (c0 >= grown) {
            return;
        }
        // 단면 — 짙은 테 → 본색 → 옅은 → 흰 심 (바깥부터 칠해 심이 남게) · 숨쉬기 200ms 마다 2장면 짙은 테를 뺌
        const half = now % 200 < 100 ? 2 : 3;
        for (let w = half; w >= 0; w--) {
            for (let c = c0; c <= grown; c += 0.5) {
                const t = c / P.cells;
                const p = P.at(t);
                const nn = P.nrm(t);
                for (const s of w ? [-w, w] : [0]) {
                    dot(p.x + nn.x * s * k, p.y + nn.y * s * k, C[w]);
                }
            }
        }
        if (grown < P.cells) {
            const p = P.at(grown / P.cells);
            blk(p.x, p.y, C[0], 3);
            for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) {
                dot(p.x + ox * k, p.y + oy * k, C[1]);
            }
        }
        // 흐르는 빛 — 28칸 간격 · 50ms 마다 4칸 (셋째는 반 박자 어긋남)
        const flow = Math.floor(age / 50) * 4 + (a.n % 2 ? 14 : 0);
        for (let c = flow % 28; c <= grown; c += 28) {
            if (c < c0) {
                continue;
            }
            const p = P.at(c / P.cells);
            blk(p.x, p.y, C[1], 4);
            blk(p.x, p.y, C[0], 2);
        }
        if (grown >= P.cells && f.off === undefined) {
            const passed = Math.floor((flow - P.cells) / 28);
            if (f.passed === undefined) {
                f.passed = passed;
            } else if (passed > f.passed) {
                st.arrivals += passed - f.passed;
                f.passed = passed;
                ringFlash(a);
            }
        }
    }
    // 반짝이 별 "+" — big 7×7 (팔 3칸 · 150ms 마다 3 → 2 → 3) · small 5×5 · tiny 3×3 · 동료 타입 4단 (T11_STAR_COLS): 가운데 심 · 팔 · 팔 끝 1칸 (작은 별 이상) ·
    // 그림자 1칸 아래 (풀밭에 묻히지 않게) · 악 · 고스트는 그림자 대신 별 둘레 1칸 밝은 테 (어둠 바탕에서 보이게)
    function starAt(x, y, a, size) {
        const G = T11_STAR_COLS[a.type] || T11_STAR_COLS.normal;
        const arms = size === 'big' ? (Math.floor(now / 150) % 3 === 1 ? 2 : 3) : size === 'small' ? 2 : 1;
        const cells = [[0, 0, G[0]]];
        for (let i = 1; i <= arms; i++) {
            const c = i === arms && arms >= 2 ? G[2] : G[1];
            cells.push([i, 0, c], [-i, 0, c], [0, i, c], [0, -i, c]);
        }
        const rimAll = T11_STAR_RIM.has(a.type) || !!T11_STAR_RIM_COL[a.type];
        if (rimAll) {
            const rim = T11_STAR_RIM_COL[a.type] || G[3];
            for (const [ox, oy] of cells) {
                for (const [rx, ry] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                    dot(x + (ox + rx) * k, y + (oy + ry) * k, rim);
                }
            }
        }
        for (const [ox, oy] of cells) {
            if (!rimAll) {
                dot(x + ox * k, y + (oy + 1) * k, G[3]);
            }
        }
        for (const [ox, oy, c] of cells) {
            dot(x + ox * k, y + oy * k, c);
        }
    }
    // #103 S1 — 넘겨주기 별 (디자인 값): 동료 꾹 누르기 기 모으기는 모으는 구간 내내 (다리 onGather — 0.3초에 차고 계속 · 끝나면 멈춤) ·
    // 0.3초부터 무더기마다 갈래 수 (둘 = 6 · 셋 = 동료마다 4) 만큼 별이 한꺼번에 (±40ms) 떠남 — 몸 위쪽 반 둘레 타원 (폭 × 1.2 · 높이 × 0.8) 의 갈래마다 다른 점에서
    // 바깥으로 6 ~ 10칸 튀어 나간 뒤 (0.1초) 앞장 쪽으로 — 곧은 선 가운데에서 수직으로 갈래마다 비켜 둔 2차 곡선 (위 두 갈래는 받는 쪽 위로 넘어가 위에서 들어옴 ·
    // 무대 위 끝 + 4칸 · 앞장 발 − 2칸 밖으로 안 나감) · 구 테두리 −80° ~ +40° (동료 쪽 기준 · 위가 −) 에 고르게 · 빔은 대포 끝 둘레 6 ~ 10칸 원 위 ·
    // 0.45 ~ 0.6초 (바깥 갈래가 늦게 — 물결처럼) · 50ms 걸음 · 빨라짐 · 꼬리 = 전 두 걸음 자리 1칸 점 · 무더기마다 처음 닿은 갈래 = 바깥 4칸에 큰 별 하나 + 작은 별 둘 (2장면) ·
    // 나머지 = 아주 작은 별 1장면 · 구는 무더기마다 반 칸 (태현 님 #103 — "별은 한줄씩 순서대로 가는게 아니고 넓게 들어가야돼", 원기옥처럼 사방에서 모임)
    function drawStars(a, f) {
        const V = T11_STAR;
        const b = fxBody(a.A);
        const t = (now - f.on) / 1000;
        const many = allies.length >= 2;
        const few = many || (track.kind !== 'orb' && window.innerWidth < 400);
        const lanes = thin ? V.lanes3.slice(1, 3) : few ? V.lanes3 : V.lanes2;
        const sizes = thin ? V.sizes3.slice(1, 3) : few ? V.sizes3 : V.sizes2;
        const every = many ? V.every3 : V.every2;
        const nL = lanes.length;
        const maxOff = Math.max(...lanes.map((v) => Math.abs(v)));
        // 솟기 × clamp(무대 높이칸 ÷ 100, 0.5, 1) — 187 에서 출발점에 반짝이가 쌓이지 않게 (아트 #103 ②)
        const popK = Math.max(0.5, Math.min(1, (window.innerHeight - top) / k / 100));
        if (f.off === undefined) {
            f.wave = f.wave ?? 0;
            // 이 동료가 낼 무더기 수 (번개 3단 비율 r) — 처음 낼 때 모으기 남은 초로 셈
            if (f.total === undefined) {
                f.total = typeof track.gLeft === 'number' ? Math.max(1, Math.floor((track.gLeft + t - V.first - V.stopLeft) / every) + 1) : 6;
                st.waves = (st.waves || 0) + f.total;
            }
            while (t >= V.first + f.wave * every) {
                const tw = V.first + f.wave * every;
                // 그 무더기를 낼 때 모으기가 남은 초 (지금 남은 초 + 지난 시간)
                const left = typeof track.gLeft === 'number' ? track.gLeft + (t - tw) : 9;
                if (left > V.stopLeft) {
                    for (let i = 0; i < nL; i++) {
                        f.parts.push({ t0: f.on + tw * 1000 + (Math.random() * 2 - 1) * 40, lane: i, wave: f.wave, size: sizes[(i + f.wave) % nL], id: f.seq++, pop: (V.pop[0] + Math.random() * (V.pop[1] - V.pop[0])) * popK });
                    }
                }
                // 사방 별 (디자인 #103 d4dc1b9 — 원기옥처럼): 구 둘레 지름 약 300px 원 위 14곳 (위 · 오른쪽 포함) — 무더기마다 반씩 번갈아 (3인은 동료끼리 나눠) · 0.8초에 구로 빨려 듦
                if (left > V.ringStop) {
                    const A2 = 2 * allies.length;
                    for (let i = 0; i < V.ringN; i++) {
                        if (i % A2 === 2 * a.n + (f.wave % 2) && !(thin && i % 4 >= 2)) {
                            // 빔 = 쏘는 반대쪽 120° 부채 (빔 방향 180° ± 60° — 상대 쪽 앞에서도 오던 것, #96 아트 3)
                            const ang = q.kind === 'beam' ? (bdir > 0 ? Math.PI : 0) - Math.PI / 3 + ((i + 0.5) / V.ringN) * ((Math.PI * 2) / 3) : (i / V.ringN) * Math.PI * 2 + 0.2;
                            f.parts.push({ ring: true, t0: f.on + tw * 1000 + (Math.random() * 2 - 1) * 40, ang, wave: f.wave, size: sizes[(i + f.wave) % nL], id: f.seq++ });
                        }
                    }
                }
                f.wave += 1;
            }
        }
        const gone = f.off !== undefined ? 1 + Math.floor((now - f.off) / 50) : 0;
        if (gone > 2) {
            f.parts.length = 0;
        }
        const ctr = f.ctr;
        const sx = b.x < ctr.x ? -1 : 1;
        const tc = T11_STAR_COLS[a.type] || T11_STAR_COLS.normal;
        f.waveHit = f.waveHit || {};
        // 사방 별 하나 — 원 위 점 (위 · 아래는 무대 안으로 줄인 타원 · 양옆은 패널 안) → 구 테두리 (그 방향) 로 곧게 · 50ms 걸음 · 빨라짐 · 꼬리 = 이동 칸 × 2 · 닿으면 아주 작은 별 1장면
        const H0 = window.innerHeight;
        const ringStar = (g, i) => {
            // 구가 없어진 구 필살기 (날아감) 는 거둠 · 빔 · 오라는 그 점 둘레 6칸으로 (#96)
            if (track.kind === 'orb' && !orb) {
                f.parts.splice(i, 1);
                return;
            }
            const Rt = orb && ctr.r > 0 ? R : 6 * k;
            // 원 반지름 — 구는 #103 그대로 · 빔 · 오라는 min(150, 앞장 몸 폭 × 1.5, 패널 폭 × 0.3) (흩어짐이 너무 넓던 것 — #96 아트 4 · 860 약 110 · 240 약 72)
            const ringR = track.kind === 'orb' ? V.ringR : Math.max(Rt + 8 * k, Math.min(V.ringR, leadBody().w * 1.5, window.innerWidth * 0.3));
            const RY = Math.max(Rt + 8 * k, Math.min(ringR, Math.max(ctr.y - top - 4 * k, H0 - 2 * k - ctr.y)));
            const s0 = { x: Math.max(2 * k, Math.min(window.innerWidth - 2 * k, ctr.x + Math.cos(g.ang) * ringR)), y: Math.max(top + 4 * k, Math.min(H0 - 2 * k, ctr.y + Math.sin(g.ang) * RY)) };
            const ang = Math.atan2(s0.y - ctr.y, s0.x - ctr.x);
            const alb = q.kind === 'aura' && !orb ? leadBody() : null;
            const d1 = alb ? { x: alb.x + Math.cos(ang) * (alb.w / 2 + 2), y: alb.y + Math.sin(ang) * (alb.h / 2 + 2) } : { x: ctr.x + Math.cos(ang) * Rt, y: ctr.y + Math.sin(ang) * (orb && ctr.r > 0 ? ryOf(ctr.y, R) : Rt) };
            const L = Math.hypot(d1.x - s0.x, d1.y - s0.y) / k;
            const u = Math.floor((now - g.t0) / 50) * 0.05;
            const v = u / V.ringDur;
            if (v >= 1) {
                g.hit = g.hit ?? now;
                if (now - g.hit < 50) {
                    starAt(d1.x, d1.y, a, 'tiny');
                } else {
                    f.parts.splice(i, 1);
                }
                return;
            }
            const ease = (w) => Math.pow(Math.max(0, w), 1.6);
            const dH = ease(v) * L;
            const moved = Math.max(1, dH - ease(v - 0.05 / V.ringDur) * L);
            const at = (d) => ({ x: s0.x + ((d1.x - s0.x) * Math.max(0, d)) / (L || 1), y: s0.y + ((d1.y - s0.y) * Math.max(0, d)) / (L || 1) });
            const n = Math.max(1, Math.round(moved * 2));
            for (let j = 1; j <= n && dH - j > 0; j++) {
                const pt = at(dH - j);
                dot(pt.x, pt.y, j === n ? tc[2] : tc[1]);
            }
            const pp = at(dH);
            starAt(pp.x, pp.y, a, g.size);
        };
        for (let i = f.parts.length - 1; i >= 0; i--) {
            const g = f.parts[i];
            if (now < g.t0 || (gone === 1 && g.id % 2)) {
                continue;
            }
            if (g.ring) {
                ringStar(g, i);
                continue;
            }
            const off = lanes[g.lane];
            // 떠나는 점 — 몸 위쪽 반 타원 (위로 휘는 갈래일수록 뒤쪽 위 · 아래로 휘는 갈래일수록 앞쪽 위)
            const fr = nL > 1 ? g.lane / (nL - 1) : 0.5;
            const ang = Math.PI * (sx < 0 ? 1.2 + 0.6 * fr : 1.8 - 0.6 * fr);
            const ex = Math.cos(ang);
            const ey = Math.sin(ang);
            let p0 = { x: b.x + ex * b.w * 0.6, y: b.y + ey * b.h * 0.4 };
            // 전용 구 — 출발점 셋: 동료 몸 50% · 구 위 (위 끝 + 8px · 구 x ± 120px) 25% · 앞장 뒤 화면 가장자리 25% (늘 동료 몸 → 구 한 줄기라 "사방에서 넓게" 가 빠지던 것, #96 아트 6바퀴 3)
            const src = track.uniq && orb && !thin ? g.id % 4 : 0;
            if (src === 2) {
                p0 = { x: Math.max(4 * k, Math.min(window.innerWidth - 4 * k, ctr.x + (g.id % 8 < 4 ? -120 : 120))), y: top + 8 };
            } else if (src === 3) {
                p0 = { x: bdir > 0 ? 8 : window.innerWidth - 8, y: top + 8 * k + (((g.id * 37) % 10) / 10) * Math.max(8 * k, feet - top - 16 * k) };
            }
            const p1 = src >= 2 ? p0 : { x: p0.x + ex * g.pop * k, y: p0.y + ey * g.pop * k };
            const u = Math.floor((now - g.t0) / 50) * 0.05;
            if (u < 0.1) {
                const e = u / 0.1;
                starAt(p0.x + (p1.x - p0.x) * e, p0.y + (p1.y - p0.y) * e, a, g.size);
                continue;
            }
            // 닿는 자리 — 구 테두리 −80° ~ +40° (갈래 순서) · 빔은 대포 끝 둘레 6 ~ 10칸
            const th = ((-80 + 120 * fr) * Math.PI) / 180;
            let dst;
            if (ctr.r > 0 && orb) {
                dst = { x: ctr.x + sx * Math.cos(th) * R, y: ctr.y + Math.sin(th) * ryOf(ctr.y, R) };
            } else {
                const rr = (6 + (g.lane % 3) * 2) * k;
                dst = { x: ctr.x + sx * Math.cos(th) * rr, y: ctr.y + Math.sin(th) * rr };
            }
            const dx = dst.x - p1.x;
            const dy = dst.y - p1.y;
            const dist = Math.hypot(dx, dy) || 1;
            let cxp;
            let cyp;
            // 갈래 비킴 × clamp(길 길이칸 ÷ 80, 0.6, 1.8) — 먼 길은 넓게 · 187 짧은 길은 줄여 위 · 아래 끝에 잘려 한 띠로 뭉치지 않게 (아트 #103 ②)
            const spread = Math.max(0.6, Math.min(1.8, dist / k / 80), (dist * 0.3) / (maxOff * k));
            if (g.lane < 2 && off < 0) {
                // 바깥 위 두 갈래 — 받는 쪽 위로 넘어가 위에서 내려와 들어감
                cxp = dst.x - dx * 0.15;
                cyp = dst.y - (38 - g.lane * 6) * k * spread;
            } else {
                let nx = dy / dist;
                let ny = -dx / dist;
                if (ny > 0) {
                    nx = -nx;
                    ny = -ny;
                }
                cxp = (p1.x + dst.x) / 2 + nx * -off * k * spread;
                cyp = (p1.y + dst.y) / 2 + ny * -off * k * spread;
            }
            // 무대 위 끝 + 4칸 · 앞장 발 − 2칸 밖으로 안 나가게 (꼭짓점 = 조절점과 양 끝 가운데의 반)
            const mid2 = (p1.y + dst.y) / 2;
            cyp = Math.max(2 * (top + 4 * k) - mid2, Math.min(2 * (feet - 2 * k) - mid2, cyp));
            const P = bez([p1, { x: cxp, y: cyp }, dst]);
            const D = V.dur[0] + ((V.dur[1] - V.dur[0]) * Math.abs(off)) / maxOff;
            const v = (u - 0.1) / D;
            const ease = (w) => Math.pow(Math.max(0, w), 1.6);
            // 갈래마다 별 2개 기차 (간격 6칸 · 뒤 별은 한 단계 작게) — 길 위 거리 (칸) 로
            const dH = ease(v) * P.cells;
            const dPrev = ease(v - 0.05 / D) * P.cells;
            const dR = dH - 6;
            const posAt = (d) => P.at(Math.max(0, Math.min(1, d / P.cells)));
            const rearSize = g.size === 'big' ? 'small' : 'tiny';
            // 꼬리 선 — 1칸 · 팔 색 · 길이 = 그 장면 이동 칸 × 2 · 끝 1칸 본색 (솟아 멈칫하는 동안은 없음)
            const tail = (d, lenC) => {
                if (thin) {
                    return;
                }
                const n = Math.max(1, Math.round(lenC));
                for (let j = 1; j <= n; j++) {
                    const pt = posAt(d - j);
                    dot(pt.x, pt.y, j === n ? tc[2] : tc[1]);
                }
            };
            const moved = Math.max(1, dH - dPrev);
            if (dH >= P.cells) {
                if (!g.hit) {
                    g.hit = now;
                    if (!f.waveHit[g.wave]) {
                        f.waveHit[g.wave] = true;
                        st.hitWaves = (st.hitWaves || 0) + 1;
                        g.big = true;
                        st.arrivals += 0.5;
                        ringFlash(a);
                        // 구 안 굵은 팔 번쩍 (t11OrbInner — 진짜 시계로 340ms 에 한 번까지)
                        const rn = typeof fxRealNow === 'function' ? fxRealNow() : now;
                        if (rn - (st.armHit?.at ?? -1e9) >= 340) {
                            st.armHit = { at: rn, ang: Math.atan2(dst.y - ctr.y, dst.x - ctr.x) };
                        }
                    }
                }
                const life = now - g.hit;
                if (g.big && life < 100) {
                    // 바깥 4칸 — 큰 별 하나 + 작은 별 둘
                    const ox = ctr.r > 0 ? (dst.x - ctr.x) / (Math.hypot(dst.x - ctr.x, dst.y - ctr.y) || 1) : sx;
                    const oy = ctr.r > 0 ? (dst.y - ctr.y) / (Math.hypot(dst.x - ctr.x, dst.y - ctr.y) || 1) : 0;
                    const qx = dst.x + ox * 4 * k;
                    const qy = dst.y + oy * 4 * k;
                    starAt(qx, qy, a, 'big');
                    starAt(qx - oy * 5 * k, qy + ox * 5 * k, a, 'small');
                    starAt(qx + oy * 5 * k, qy - ox * 5 * k, a, 'small');
                } else if (!g.big && life < 50) {
                    starAt(dst.x, dst.y, a, 'tiny');
                }
            } else {
                tail(dH, moved * 2);
                const pp = posAt(dH);
                starAt(pp.x, pp.y, a, g.size);
            }
            // 뒤 별
            if (dR >= P.cells) {
                g.hitR = g.hitR ?? now;
                if (now - g.hitR < 50) {
                    starAt(dst.x, dst.y, a, 'tiny');
                } else if (now - (g.hit ?? now) >= 100) {
                    f.parts.splice(i, 1);
                }
            } else if (dR > 0) {
                tail(dR, moved * 2);
                const pr = posAt(dR);
                starAt(pr.x, pr.y, a, rearSize);
            }
        }
    }
    // B 오라 — 몸 둘레 (위 · 양옆 타원 — 동료 그림이 연출 층 위라 안쪽은 몸에 가림) 불꽃 혀 7개 · 100ms 마다 높이 · 자리 바뀜 · bump = 리본이 떨어지기 전 꼭대기 +4칸
    // (몸 가운데에서 솟아 대부분 몸에 가려 가는 풀잎 세 가닥처럼 보이던 것)
    function drawAura(a, f) {
        const b = fxBody(a.A);
        const C = a.cols;
        const step = Math.floor(now / 100);
        const bump = now - (f.bump ?? -1e9) < 100 ? 4 : 0;
        for (let j = 0; j < 7; j++) {
            const off = j - 3;
            const ang = Math.PI * (1.08 + (j / 6) * 0.84);
            const bx = b.x + Math.cos(ang) * b.w * 0.5 + ((step + j) % 2 ? k : 0);
            const by = b.y + Math.sin(ang) * b.h * 0.5 + 3 * k;
            const h = 8 + ((j * 5 + step * 3) % 9) + (Math.abs(off) <= 1 ? bump : 0);
            // 폭 3 ~ 4칸 · 끝 쪽에서만 좁아짐 (2칸 혀가 1칸 줄로 보여 풀잎 같던 것)
            const w = j % 2 ? 3 : 4;
            for (let i = 0; i < h; i++) {
                const rw = Math.max(1, Math.round(w * (1 - Math.pow(i / h, 2) * 0.75)));
                const col = i === h - 1 ? C[0] : i < h * 0.25 ? C[3] : i < h * 0.6 ? C[2] : C[1];
                for (let x = 0; x < rw; x++) {
                    dot(bx + (x - (rw - 1) / 2) * k, by - i * k, col);
                }
            }
        }
    }
    // B 리본 길 — 오라 꼭대기 → S 자 (위로 솟았다 앞장 쪽으로 내려옴) → 구 가장자리 + 3칸 → 구 둘레 3/4 바퀴 (셋째는 반대로)
    function ribbonPath(a, ctr) {
        const b = fxBody(a.A);
        const s0 = { x: b.x, y: b.y - b.h / 2 - 8 * k };
        const e = entryOf(a, ctr, s0, 3 * k);
        const dx = e.x - s0.x;
        const dist = Math.hypot(dx, e.y - s0.y) || 1;
        // 3차 곡선 S 자 — 두 손잡이 높이 Y 로 꼭짓점 (가운데) 이 위로 휘는 길 (A 와 같은 꼭짓점 — 셋째 리본이 곧은 사선으로 이상해꽃을 뚫던 것, 아트 #102 ③)
        const Y = Math.max(top + 2 * k, (apexOf(a, s0, e, ctr) - (s0.y + e.y) / 8) / 0.75);
        const P = bez([s0, { x: s0.x - dx * 0.15, y: Y }, { x: e.x - dx * 0.45, y: Y }, e]);
        let W = 0;
        let pos = (c) => P.at(Math.min(1, c / P.cells));
        if (orb) {
            const rr = R + 3 * k;
            const ry = ryOf(ctr.y, rr);
            const a0 = Math.atan2((e.y - ctr.y) / (ry / rr), e.x - ctr.x);
            const dir = a.n % 2 ? -1 : 1;
            W = Math.max(8, Math.round((0.75 * 2 * Math.PI * rr) / k));
            pos = (c) => {
                if (c <= P.cells) {
                    return P.at(c / P.cells);
                }
                const ang = a0 + dir * ((c - P.cells) / W) * 1.5 * Math.PI;
                return { x: ctr.x + Math.cos(ang) * rr, y: ctr.y + Math.sin(ang) * ry };
            };
        }
        return { pos, total: P.cells + W };
    }
    function drawRibbon(a, f) {
        const C = a.cols;
        // 오라 — 모으는 동안 + 끝난 뒤 0.2초
        if (f.off === undefined || now - f.off < 200) {
            drawAura(a, f);
        }
        if (f.off === undefined) {
            f.next = f.next ?? f.on + (a.n % 2 ? 200 : 0);
            while (now >= f.next) {
                f.bump = f.next;
                f.ribs.push({ t0: f.next + 100 });
                f.next += 400;
            }
        }
        const RP = ribbonPath(a, f.ctr);
        for (let i = f.ribs.length - 1; i >= 0; i--) {
            const r = f.ribs[i];
            if (now < r.t0) {
                continue;
            }
            const head = Math.min(RP.total, Math.floor((now - r.t0) / 50) * 4);
            // 다 감으면 바둑판 두 걸음 (50ms 씩) 으로 사라짐 · 구 +1칸 · 모으기가 끝나면 날던 리본도 바둑판 두 걸음으로 (빈자리로 날아가지 않게)
            let mask = f.off !== undefined ? 1 + Math.floor((now - f.off) / 50) : 0;
            if (mask > 2) {
                f.ribs.splice(i, 1);
                continue;
            }
            if (head >= RP.total && f.off === undefined) {
                r.end = r.end ?? now;
                if (!r.counted) {
                    r.counted = true;
                    st.arrivals += 1;
                    ringFlash(a);
                }
                mask = 1 + Math.floor((now - r.end) / 50);
                if (mask > 2) {
                    f.ribs.splice(i, 1);
                    continue;
                }
            }
            const tail = Math.max(0, head - 40);
            for (let c = tail; c <= head; c += 0.5) {
                const p = RP.pos(c);
                const q2 = RP.pos(c + 0.5);
                const l = Math.hypot(q2.x - p.x, q2.y - p.y) || 1;
                const nn = { x: -(q2.y - p.y) / l, y: (q2.x - p.x) / l };
                const wide = Math.floor(c / 8) % 2 === 0;
                const band = wide ? [[-2, 3], [-1, 2], [0, 1], [1, 1], [2, 2]] : [[-1, 3], [0, 2], [1, 1]];
                for (const [s, ci] of band) {
                    const x = p.x + nn.x * s * k;
                    const y = p.y + nn.y * s * k;
                    if (mask === 1 && (Math.round(x / k) + Math.round(y / k)) % 2) {
                        continue;
                    }
                    dot(x, y, C[ci]);
                }
            }
        }
    }
    // C 알갱이 — 타입 모양 · size 5 (모양) · 3 · 1 · 짙은 그림자 없이 (모양에 짙은 테)
    function grain(x, y, a, size) {
        const C = a.cols;
        const map = size >= 5 ? T11_GRAIN[a.type] || T11_GRAIN.star : size >= 3 ? T11_GRAIN.mid : null;
        if (!map) {
            dot(x, y, C[1]);
            return;
        }
        const h = map.length;
        const w = map[0].length;
        for (let r = 0; r < h; r++) {
            for (let c = 0; c < w; c++) {
                const ch = map[r][c];
                if (ch === '.') {
                    continue;
                }
                dot(x + (c - (w - 1) / 2) * k, y + (r - (h - 1) / 2) * k, ch === 'W' ? C[0] : ch === 'L' ? C[1] : ch === 'M' ? C[2] : C[3]);
            }
        }
    }
    // C 빛 알갱이 강 — 솟음 0.3 · 머리 위 나선 0.3 · 강 0.5 · 빨려 듦 0.4 (초 · 50ms 걸음)
    function drawRiver(a, f) {
        const b = fxBody(a.A);
        if (f.off === undefined) {
            f.next = f.next ?? f.on + (a.n % 2 ? 25 : 0);
            while (now >= f.next) {
                f.parts.push({ t0: f.next, id: f.seq++, ox: (Math.random() - 0.5) * 0.6, oy: Math.random() * 0.3, dx: (Math.random() * 2 - 1) * 3, up: 10 + Math.random() * 6, a0: Math.random() * Math.PI * 2 });
                f.next += 50;
            }
        }
        const ctr = f.ctr;
        const spin = a.n % 2 ? -1 : 1;
        // 모으기가 끝나면 날던 알갱이는 바둑판 두 걸음으로 (빈자리로 빨려 들지 않게)
        const gone = f.off !== undefined ? 1 + Math.floor((now - f.off) / 50) : 0;
        if (gone > 2) {
            f.parts.length = 0;
        }
        for (let i = f.parts.length - 1; i >= 0; i--) {
            const g = f.parts[i];
            if (gone === 1 && g.id % 2) {
                continue;
            }
            const u = Math.floor((now - g.t0) / 50) * 0.05;
            const sx = b.x + g.ox * b.w;
            const sy = b.y - b.h * 0.1 - g.oy * b.h;
            const topY = sy - g.up * k;
            let x;
            let y;
            let size = 5;
            if (u < 0.3) {
                const e = Math.sin((u / 0.3) * Math.PI * 0.5);
                x = sx + g.dx * k * (u / 0.3);
                y = sy - g.up * k * e;
            } else if (u < 0.6) {
                const v = (u - 0.3) / 0.3;
                const ang = g.a0 + spin * v * Math.PI * 1.2;
                x = b.x + Math.cos(ang) * 6 * k;
                y = topY - 2 * k + Math.sin(ang) * 2 * k - v * 4 * k;
            } else {
                const s1 = { x: b.x + Math.cos(g.a0 + spin * Math.PI * 1.2) * 6 * k, y: topY - 6 * k + Math.sin(g.a0 + spin * Math.PI * 1.2) * 2 * k };
                const e1 = entryOf(a, ctr, s1, 20 * k);
                if (u < 1.1) {
                    const P = quad(a, s1, e1, 0.25, 0.15);
                    const p = P.at((u - 0.6) / 0.5);
                    x = p.x;
                    y = p.y;
                } else if (u < 1.5) {
                    const v = (u - 1.1) / 0.4;
                    const r0 = Math.hypot(e1.x - ctr.x, e1.y - ctr.y);
                    const a1 = Math.atan2(e1.y - ctr.y, e1.x - ctr.x);
                    const rr = r0 * (1 - v);
                    const ang = a1 + spin * v * Math.PI * 2.5;
                    x = ctr.x + Math.cos(ang) * rr;
                    y = ctr.y + Math.sin(ang) * rr;
                    size = v < 1 / 3 ? 5 : v < 2 / 3 ? 3 : 1;
                } else {
                    st.arrivals += 1 / 6;
                    if (g.id % 6 === 5) {
                        ringFlash(a);
                    }
                    f.parts.splice(i, 1);
                    continue;
                }
            }
            grain(x, y, a, size);
            // 네 개 중 하나 — 흰 십자 반짝 한 번 (2장면)
            if (g.id % 4 === 0 && u >= 0.6 && u < 0.7) {
                cross(x + 3 * k, y - 3 * k, a.cols);
            }
        }
    }
    if (!st.arrivals) {
        return;
    }
    // ② 구 (원기옥) — 기운 막 = 구 가장자리 2칸 바둑판 띠 (동료 색 · 닿을수록 바깥으로 커짐) · 닿음 번쩍 고리 (1장면 옅은 → 1장면 본색)
    // (r+8 ~ 10 에 따로 뜬 가는 고리 · 바둑판 막이 겹쳐 고리 4겹으로 보이던 것 — 아트 #102 작음)
    if (orb && starStyle) {
        // 별 갈래 (#103) — 합동 점선 고리 하나 (1:1 구 점선 말투에 맞춤 · 바둑판 띠 · 닿음 번쩍 고리 대신 — 고리 화풍 넷이 겹치던 것, 디자인 #103):
        // 반지름 R + 1칸 · 1칸 · 대시 2칸 칠 + 1칸 빔 · 동료 [2] (3인 45° 조각마다 번갈아) · 80ms 마다 1칸 돎 · 받을수록 밝아짐 (R ⅓ 부터 [1] · ⅔ 부터 대시 4개 중 1개 [0]) ·
        // 무더기가 닿으면 대시 1장면 [0] → 1장면 [1] (진짜 시계 340ms 에 한 번 — st.armHit) · 앞장 발 줄 아래 안 그림
        const RN2 = typeof fxRealNow === 'function' ? fxRealNow() : now;
        const Rv = Math.min(1, (st.hitWaves || 0) / Math.max(1, st.waves || 1));
        const rr = R + k;
        const ryy = ryOf(track.y, rr);
        const n = Math.max(24, Math.round((2 * Math.PI * rr) / k));
        const rot = t33Reduce() ? 0 : Math.floor(RN2 / 80);
        const fa = st.armHit ? RN2 - st.armHit.at : 1e9;
        for (let j = 0; j < n; j++) {
            const ci = j + rot;
            if (ci % 3 === 2) {
                continue;
            }
            const a = (j / n) * Math.PI * 2;
            const yy = track.y + Math.sin(a) * ryy;
            if (yy > feet) {
                continue;
            }
            const C = T11_STAR_COLS[allies[Math.floor(a / (Math.PI / 4)) % allies.length].type] || T11_STAR_COLS.normal;
            let c = Rv < 1 / 3 ? C[2] : Rv >= 2 / 3 && Math.floor(ci / 3) % 4 === 0 ? C[0] : C[1];
            if (fa < 80) {
                c = C[0];
            } else if (fa < 160) {
                c = C[1];
            }
            dot(track.x + Math.cos(a) * rr, yy, c);
        }
    } else if (orb) {
        const ry = ryOf(track.y, R);
        const sy = ry / R;
        const x0 = Math.round(track.x / k);
        const y0 = Math.round(track.y / k);
        const Rk = R / k;
        for (let dy = -Math.ceil(Rk); dy <= Math.ceil(Rk); dy++) {
            for (let dx = -Math.ceil(Rk); dx <= Math.ceil(Rk); dx++) {
                const d = Math.hypot(dx, dy);
                if (d > Rk || d < Rk - 2) {
                    continue;
                }
                const cx = x0 + dx;
                const cy = Math.round(y0 + dy * sy);
                // 앞장 발 줄 아래는 안 그림 — 1:1 불꽃은 땅에 앉은 돔이라 온전한 원 고리가 패널 끝까지 내려가면 "원 안의 돔 = 잘림" 으로 보이던 것 (아트 #103)
                if ((cx + cy) % 2 || cy * k > feet) {
                    continue;
                }
                const aa = allies[(((Math.floor(cx / 4) + Math.floor(cy / 4)) % allies.length) + allies.length) % allies.length];
                const ac = starStyle ? (T11_STAR_COLS[aa.type] || T11_STAR_COLS.normal)[2] : aa.cols[1];
                dot(cx * k, cy * k, ac);
            }
        }
        const fl = now - (st.ringAt ?? -1e9);
        if (fl < 100) {
            const n = Math.max(24, Math.round((2 * Math.PI * R) / k));
            for (let j = 0; j < n; j++) {
                const a = (j / n) * Math.PI * 2;
                const yy = track.y + Math.sin(a) * (ry + k);
                if (yy <= feet) {
                    dot(track.x + Math.cos(a) * (R + k), yy, fl < 50 ? st.ringC[1] : st.ringC[2]);
                }
            }
        }
        // C — 구 둘레 타입 색 2칸 점 (동료마다 4개) 이 돎 · 구 안 동료 색 점이 떠다님
        if (style === 'C') {
            allies.forEach((a, ai) => {
                for (let j = 0; j < 4; j++) {
                    const ang = now / 400 + (j * Math.PI) / 2 + ai * (Math.PI / 4);
                    blk(track.x + Math.cos(ang) * (R + k), track.y + Math.sin(ang) * (ry + k), a.cols[2], 2);
                }
            });
        }
        if (track.fly || style === 'C') {
            const step = Math.floor(now / 120);
            for (let j = 0; j < 3 * allies.length; j++) {
                const a = (j * 2.1 + step * 1.3) % (Math.PI * 2);
                const rr = track.r * (0.25 + 0.2 * ((step + j) % 3));
                dot(track.x + Math.cos(a) * rr, track.y + Math.sin(a) * rr, allies[j % allies.length].cols[1], track.fly ? 2 : 1);
            }
        }
    }
    // 전용 구가 날아가는 동안 — 꼬리에 동료 색 2칸 점 10개 (4칸 간격 · 앞 4개 [1] · 뒤 [2]) (#96 아트 5바퀴 1 — 날아가는 구가 앞장 한 색이던 것)
    if (track.uniq) {
        const tr = (st.trail = st.trail || []);
        if (orb && track.fly) {
            if (!tr.length || Math.hypot(track.x - tr[0].x, track.y - tr[0].y) >= 4 * k) {
                tr.unshift({ x: track.x, y: track.y });
                tr.length = Math.min(tr.length, 11);
            }
            tr.forEach((p, j) => {
                if (j) {
                    blk(p.x, p.y, (T11_STAR_COLS[allies[j % allies.length].type] || T11_STAR_COLS.normal)[j <= 4 ? 1 : 2], 2);
                }
            });
        } else {
            tr.length = 0;
        }
    }
    // ③ 빔 — 물줄기를 감는 동료 색 나선 두 가닥 (뒤로 가는 반은 물줄기에 가림) + 갈래마다: A 흐르는 빛 · B 리본 (넓게) · C 알갱이
    if (track.kind === 'beam' && track.on && track.len > 2 * k) {
        st.beamAt = st.beamAt ?? now;
        // 별 갈래 — 나선 위 별 · 튀는 작은 별은 쏜 뒤 0.3초까지 (그 뒤엔 물줄기 위가 어수선해서 — 아트 #103 · 나선 두 가닥은 #101 그대로)
        const starsOn = !starStyle || now - st.beamAt < 300;
        const flow = Math.floor(now / 50) * (style === 'A' ? 4 : 2);
        const amp = Math.max(6 * k, track.w / 2 + (style === 'B' ? 6 : 4) * k);
        const lighter = (c) => [c[0], c[0], c[1], c[2]];
        const cs = [allies[0].cols, allies[1] ? allies[1].cols : lighter(allies[0].cols)];
        const edgeLo = (allies[1] || allies[0]).cols;
        const frame = Math.floor(now / 100);
        const at = (c, s) => {
            const x = track.x0 + track.dir * c * k;
            const yc = track.yAt(x);
            const ph = ((c - flow) / 24) * Math.PI * 2 + s * Math.PI;
            return { x, yc, y: yc + Math.sin(ph) * amp, front: Math.cos(ph) > 0 };
        };
        const cells = Math.floor(track.len / k);
        // 빔 가장자리 안쪽 1칸 줄 — 위 = 첫 동료 · 아래 = 둘째 (없으면 첫) 동료 [1] (#96 디자인)
        for (let c = 0; c <= cells; c++) {
            const ex = track.x0 + track.dir * c * k;
            const ey = track.yAt(ex);
            dot(ex, ey - track.w / 2 + k, cs[0][1]);
            dot(ex, ey + track.w / 2 - 2 * k, edgeLo[1]);
        }
        for (let c = 0; c <= cells; c++) {
            for (let s = 0; s < 2; s++) {
                const p = at(c, s);
                if (!p.front && Math.abs(p.y - p.yc) < track.w / 2) {
                    continue;
                }
                if (style === 'B') {
                    // 리본 — 40칸 · 16칸 틈 · 폭 5 ↔ 3 (8칸마다)
                    if ((((c - flow) % 56) + 56) % 56 >= 40) {
                        continue;
                    }
                    const band = Math.floor(c / 8) % 2 === 0 ? [[-2, 3], [-1, 2], [0, 1], [1, 1], [2, 2]] : [[-1, 3], [0, 2], [1, 1]];
                    for (const [o, ci] of band) {
                        dot(p.x, p.y + o * k, p.front ? cs[s][ci] : cs[s][3]);
                    }
                } else {
                    dot(p.x, p.y, p.front ? cs[s][2] : cs[s][3]);
                    dot(p.x, p.y + k, p.front ? cs[s][1] : cs[s][3]);
                }
            }
            if ((((c - flow) % 8) + 8) % 8 === 0) {
                const h = ((c * 73856093) ^ (frame * 19349663)) >>> 0;
                const yc = at(c, 0).yc;
                // 스파크 — 1칸 십자 1 ~ 2개 (네모 알갱이로 보이던 것 — 아트 #102 작음)
                for (let m = 0; m < 1 + (h % 2); m++) {
                    const side = (h >> (m + 1)) & 1 ? 1 : -1;
                    const off = (4 + ((h >> (m * 3 + 2)) % 4)) * k;
                    if (starStyle) {
                        if (starsOn) {
                            starAt(at(c, 0).x + m * 4 * k, yc + side * (track.w / 2 + off), allies[m % allies.length], 'tiny');
                        }
                    } else {
                        cross(at(c, 0).x + m * 4 * k, yc + side * (track.w / 2 + off), [cs[m % 2][0], cs[m % 2][1]]);
                    }
                }
            }
        }
        // A — 나선을 따라 흐르는 빛 (28칸 간격) · C — 나선을 타는 알갱이 (10칸 간격) · S1 · S2 — 나선을 타는 반짝이 별 (14칸 간격)
        if (style !== 'B' && starsOn) {
            const gap = style === 'A' ? 28 : starStyle ? 14 : 10;
            for (let s = 0; s < 2; s++) {
                for (let c = ((flow % gap) + gap) % gap; c <= cells; c += gap) {
                    const p = at(c, s);
                    if (!p.front) {
                        continue;
                    }
                    if (style === 'A') {
                        blk(p.x, p.y, cs[s][1], 4);
                        blk(p.x, p.y, cs[s][0], 2);
                    } else if (starStyle) {
                        starAt(p.x, p.y, allies[s % allies.length], (c / gap) % 3 < 1 ? 'big' : 'small');
                    } else {
                        grain(p.x, p.y, allies[s % allies.length], 5);
                    }
                }
            }
        }
    }
    // ④ 오라 앞장 (#96 디자인) — 몸 둘레 안쪽 1칸 테 (동료 [1] · 3인 반씩) + 바깥 동료 색 불꽃 혀 7개 (몸 위쪽 둘레 · 폭 2 ~ 3칸 · 높이 6 ~ 14칸 — 받을수록 높게 ·
    //   100ms 마다 높이 바뀜 · 동료 번갈아 · 끝 [0] · 몸 [1] · 밑 [2] · 테 [3]) / 달려드는 동안 뒤로 끌리는 동료 색 줄 2 (2칸 · [2] / [1] · 지난 3장면 자리)
    if (q.kind === 'aura') {
        const b = leadBody();
        const AC = (n) => T11_STAR_COLS[allies[n % allies.length].type] || T11_STAR_COLS.normal;
        // 불 앞장 메가진화 (블래스트번 — 메가리자몽X 파란 불) + 물 동료 = 동료 몫을 김 덩어리로 — 파란 혀가 파란 불에 묻혀 동료가 안 보이고 "증기 폭발" 인데 김이 없던 것
        //   (#96 아트 5바퀴 2 · 같은 색이 셋 넘게 겹치면 모양으로 나눔): 몸 양옆 8덩이 (원 2 ~ 3개 · 지름 6 ~ 10px · #e8eef2 + 밑 1칸 #b8c4cc) · 100ms 마다 5px 위로 · 위에서 작아짐
        const steam = q.leadType === 'fire' && !!track.willMorph && allies.every((al) => al.type === 'water');
        // 김은 몸 · 메가진화 상자 비움 (clip) 밖에서 그림 — 메가진화가 끝난 뒤에도 남은 상자 구멍에 김 안쪽 반이 세로 일자로 잘리던 것 (#96 UX 7바퀴 큼 2)
        if (steam && to && now < q.hitEnd && late) {
            const prevLate = lateDraw;
            lateDraw = () => {
                prevLate?.();
                // 김 (6바퀴 값): 10덩이 · 반지름 3칸 → 2걸음마다 1칸 커져 4칸 (187 에서 12 ~ 16px) · 세 톤 (위 1칸 #ffffff · 몸 #e8eef2 · 밑 1칸 #b8c4cc) · 가장자리 1칸 바둑판 ·
                // 마지막 두 걸음은 바둑판으로 사라짐 · 몸 위쪽 양옆 (불꽃 혀 끝 높이) 에서 생김 (6 ~ 10px 흰 점이 자갈 · 팝콘처럼 읽히던 것 — #96 아트 6바퀴 2)
                const f100 = Math.floor(now / 100);
                const STEPS = 8;
                for (let i = 0; i < 10; i++) {
                    const sd = i % 2 ? 1 : -1;
                    const step = (f100 + i * 3) % STEPS;
                    const cx = b.x + sd * (b.w * 0.5 + (2 + (i % 3) * 3) * k);
                    const cy = b.y - b.h * 0.1 - step * 5 - (i % 4) * 2 * k;
                    const rc = 3 + Math.min(1, Math.floor(step / 4));
                    const fade = step >= STEPS - 2 ? step - (STEPS - 3) : 0;
                    for (let dy = -rc; dy <= rc; dy++) {
                        for (let dx = -rc; dx <= rc; dx++) {
                            const d2 = dx * dx + dy * dy;
                            if (d2 > rc * rc + rc) {
                                continue;
                            }
                            const rim = d2 > (rc - 1) * (rc - 1) + (rc - 1);
                            const gx = Math.round(cx / k) + dx;
                            const gy = Math.round(cy / k) + dy;
                            if ((rim || fade) && (((gx + gy + fade) % 2) + 2) % 2 === 0) {
                                continue;
                            }
                            if (fade >= 2 && ((gx + 2 * gy) % 3 + 3) % 3 === 0) {
                                continue;
                            }
                            dot(gx * k, gy * k, dy === -rc || (dy === 1 - rc && !rim) ? '#ffffff' : dy === rc ? '#b8c4cc' : '#e8eef2');
                        }
                    }
                }
            };
        }
        if (!steam && to && now < q.hitEnd && late) {
            const rx0 = b.w * 0.5 + 2 * k;
            const ry0 = b.h * 0.5 + 2 * k;
            const ring = Math.max(24, Math.round((Math.PI * (rx0 + ry0)) / k));
            for (let j = 0; j < ring; j++) {
                const a = (j / ring) * Math.PI * 2;
                dot(b.x + Math.cos(a) * rx0, b.y + Math.sin(a) * ry0, AC(Math.floor((j / ring) * 2 * allies.length))[1]);
            }
            // 불꽃 혀 7 (#96 아트 1 — 곧은 쐐기 · 같은 길이 · 끝 흰색이라 "가시 왕관" 으로 읽히던 것): 길이 [7, 11, 8, 14, 9, 12, 6]칸 을 100ms 마다 한 칸씩 돌림 ·
            // 각도 ±6° 흔듦 · 칸마다 옆으로 sin(t/h·π) × 2칸 (혀마다 좌우 번갈아) · 끝 1/3 은 위쪽 40% 섞음 · 밑동 3 ~ 4칸 → 끝 1칸 ·
            // 색 = 밑 1/3 [0] 흰 심 → [1] → 끝 [2] · 테 [3] (불꽃은 밑이 가장 밝음) · 3인 = 동료가 선 쪽 반을 그 동료 색 · 발밑에 동료 색 1칸 빛 줄
            const LENS = [7, 11, 8, 14, 9, 12, 6];
            const f100 = Math.floor(now / 100);
            const byX = allies.length >= 2 ? [...allies].sort((p1, p2) => fxBody(p1.A).x - fxBody(p2.A).x) : null;
            const colAt = (i, ux) => (byX ? T11_STAR_COLS[(ux < -0.05 ? byX[0] : ux > 0.05 ? byX[byX.length - 1] : byX[i % 2]).type] || T11_STAR_COLS.normal : AC(0));
            const tongues = [];
            for (let i = 0; i < 7; i++) {
                const a = Math.PI * (1.12 + (i / 6) * 0.76) + ((((f100 + i) % 3) - 1) * 6 * Math.PI) / 180;
                const ux = Math.cos(a);
                const uy = Math.sin(a);
                const h = LENS[(i + f100) % 7];
                const w0 = i % 2 ? 3 : 4;
                const sd = i % 2 ? 1 : -1;
                // 끝 1/3 방향 = 0.6 × 바깥 + 0.25 × 위 + 0.35 × 옆 (혀마다 + − 번갈아)
                const tx0 = ux * 0.6 - uy * sd * 0.35;
                const ty0 = uy * 0.6 - 0.25 + ux * sd * 0.35;
                const up = Math.hypot(tx0, ty0);
                const cells = [];
                let x = b.x + ux * (rx0 + k);
                let y = b.y + uy * (ry0 + k);
                for (let t = 0; t <= h; t++) {
                    const f = t / h;
                    const [dx, dy] = t > (h * 2) / 3 ? [tx0 / up, ty0 / up] : [ux, uy];
                    const side = Math.sin(f * Math.PI) * 2 * sd * k;
                    cells.push({ x: x - dy * side, y: y + dx * side, dx, dy, w: f < 2 / 3 ? Math.max(2, Math.round(w0 * Math.pow(1 - f, 0.8))) : 1, ci: f < 1 / 3 ? 0 : f < 2 / 3 ? 1 : 2 });
                    x += dx * k;
                    y += dy * k;
                }
                tongues.push({ cells, C: colAt(i, ux) });
            }
            // 테 먼저 (모든 혀 — 한 칸 넓게) → 몸
            for (const pass of [0, 1]) {
                for (const tg of tongues) {
                    for (const c of tg.cells) {
                        const wv = c.w + (pass === 0 ? 2 : 0);
                        for (let m = 0; m < wv; m++) {
                            const o = m - (wv - 1) / 2;
                            dot(c.x - c.dy * o * k, c.y + c.dx * o * k, pass === 0 ? tg.C[3] : tg.C[c.ci]);
                        }
                    }
                }
            }
            const feet = b.y + b.h * 0.45 + k;
            const half = Math.round((b.w * 0.6) / k);
            for (let c = -half; c <= half; c++) {
                dot(b.x + c * k, feet, colAt(Math.abs(c), c / Math.max(1, half))[1]);
            }
        }
        // 달려드는 동안 끌리는 줄
        st.lpos = st.lpos || [];
        st.lpos.push({ x: b.x, y: b.y });
        if (st.lpos.length > 4) {
            st.lpos.shift();
        }
        const p0 = st.lpos[0];
        const dd = Math.hypot(b.x - p0.x, b.y - p0.y);
        if (!to && dd > 6 * k && now < q.hitEnd + 300) {
            const ux = (b.x - p0.x) / dd;
            const uy = (b.y - p0.y) / dd;
            const L = Math.round(dd / k);
            for (const [side, n, ci] of [[-1, 0, 2], [1, 1, 1]]) {
                for (let t = 0; t <= L; t++) {
                    const cx = b.x - ux * t * k - uy * side * 2 * k;
                    const cy = b.y - uy * t * k + ux * side * 2 * k;
                    dot(cx, cy, AC(n)[ci], 2);
                }
            }
        }
    } else if (!q.tracked && q.kind !== 'beam' && q.kind !== 'orb' && now < q.hitEnd && late) {
        const b = leadBody();
        const rr = Math.max(b.w, b.h) / 2 + 3 * k;
        const n = Math.max(24, Math.round((2 * Math.PI * rr) / k));
        const rot = Math.floor(now / 50);
        for (let j = 0; j < n; j++) {
            const ci = j + rot;
            if (ci % 12 >= 8) {
                continue;
            }
            const c = allies[Math.floor(ci / 12) % allies.length].cols;
            const a = (j / n) * Math.PI * 2;
            dot(b.x + Math.cos(a) * rr, b.y + Math.sin(a) * rr, c[2]);
        }
    }
    } finally {
        if (clipped) {
            ctx.restore();
        }
        lateDraw?.();
    }
}

/**
 * 장면 전환 합동 — 앞장 몸 상자 (fxBody). 메가진화한 동안 (연출 틀이 track.mega = { scale · dx · lift } 를 알림 — 블래스트번 · 하드플랜트 · 메가런처) 은
 * 메가 크기 (발 기준으로 scale 배 · 옆 dx · 위로 lift) — 오라 혀 · 테 · 번개가 원래 크기 몸 둘레에서 나와 메가 그림 위를 덮던 것 (#96)
 */
function t11LeadBody(LA, track) {
    const b = fxBody(LA);
    const m = track && track.mega;
    if (!m) {
        return b;
    }
    const foot = b.y + b.h * 0.45 - (m.lift || 0);
    return { x: b.x + (m.dx || 0), y: foot - b.h * m.scale * 0.45, w: b.w * m.scale, h: b.h * m.scale, ok: b.ok };
}

/**
 * 장면 전환 합동 — 진짜 구 안 (fx-energy drawOrb mid — 불꽃 구 0.62 원판 뒤 · 0.36 심 앞 — 동료 색이 흰 심으로 빨려 들어가 녹는 모양 · 디자인 #103 — "쉼표 모양 팔이 도는 태풍"):
 * 굵은 팔 (r ≥ 10칸) — 동료마다 3개 (120° · 3인 6개 번갈아) · 반지름 r × (1.0 − 0.8t) · 각 t × 200° · 굵기 3 → 2 → 1칸 (t < 0.25 / < 0.6) · 색 [2] → [1] → [0] ·
 * 보이는 길이 t ≤ 0.3 + 0.7R (받을수록 안쪽까지) · 받은 양 R ⅓ 부터 팔 사이 60° 짧은 토막 (1칸 [1] — 고리로 안 이어지게) · ⅔ 부터 흘러 드는 빛 (팔마다 [0] 2 × 2 · 80ms 마다 안쪽으로 3칸) ·
 * 섞임 바둑판 (r × 0.36 ~ 0.62 · R ⅓ 25% · ⅔ 50% · 팔 사이에만 · 3인은 칸마다 번갈아) · 80ms 마다 15° 돎 (내 쪽 시계 반대 · 상대 시계) ·
 * 무더기가 닿으면 가장 가까운 굵은 팔 바깥 30% 1장면 [0] · 동작 줄이기면 멈춘 모양 · 흘러 드는 빛 없음 (5겹 동그라미 · 무지개 과녁처럼 보이던 것 — 아트 #103)
 */
function t11OrbInner(ctx, q) {
    const { now, allies, st, x, y, r } = q;
    const k = q.kL;
    if (!st.hitWaves || !allies.length) {
        return;
    }
    const RN = typeof fxRealNow === 'function' ? fxRealNow() : now;
    const Rv = Math.min(1, st.hitWaves / Math.max(1, st.waves || 1));
    const reduce = t33Reduce();
    const px = (v) => Math.round(v / k) * k;
    const dot = (xx, yy, c, n = 1) => {
        ctx.fillStyle = c;
        ctx.fillRect(px(xx - ((n - 1) * k) / 2), px(yy - ((n - 1) * k) / 2), n * k, n * k);
    };
    const cols = allies.map((a) => T11_STAR_COLS[a.type] || T11_STAR_COLS.normal);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = false;
    const sgn = q.foe ? 1 : -1;
    const base = reduce ? 0 : sgn * Math.floor(RN / 80) * (Math.PI / 12);
    const arms = (q.armsPer || 3) * cols.length;
    const SWEEP = (200 * Math.PI) / 180;
    const armAng = (j, t, off = 0) => base + off + (j * 2 * Math.PI) / arms + sgn * t * SWEEP;
    const armAt = (j, t, off = 0) => {
        const rr = r * (1.0 - 0.8 * t);
        const ang = armAng(j, t, off);
        return [x + Math.cos(ang) * rr, y + Math.sin(ang) * rr];
    };
    const angD = (a1, b1) => Math.abs((((a1 - b1) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
    // 섞임 바둑판 — 팔 사이에만
    if (Rv >= 1 / 3) {
        const x0 = Math.round(x / k);
        const y0 = Math.round(y / k);
        const ro = (r * 0.62) / k;
        const ri = (r * 0.36) / k;
        for (let dy = -Math.ceil(ro); dy <= Math.ceil(ro); dy++) {
            for (let dx = -Math.ceil(ro); dx <= Math.ceil(ro); dx++) {
                const d = Math.hypot(dx, dy);
                if (d > ro || d < ri) {
                    continue;
                }
                const cx = x0 + dx;
                const cy = y0 + dy;
                const on = Rv >= 2 / 3 ? (((cx + cy) % 2) + 2) % 2 === 0 : (((cx % 2) + 2) % 2 === 0 && ((cy % 2) + 2) % 2 === 0);
                if (!on) {
                    continue;
                }
                // 이 반지름에서 팔 각도와 가까우면 (팔 간격의 0.3 안) 건너뜀
                const t = (1 - (d * k) / r) / 0.8;
                const a = Math.atan2(dy, dx);
                let near = false;
                for (let j = 0; j < arms && !near; j++) {
                    near = angD(a, armAng(j, t)) < (Math.PI / arms) * 0.6;
                }
                if (near) {
                    continue;
                }
                dot(cx * k, cy * k, cols[(((cx + 2 * cy) % cols.length) + cols.length) % cols.length][1]);
            }
        }
    }
    if (r / k < 10) {
        // 작은 구 (전용 구 jointOrb — small) — 1칸 쉼표 팔 (밖 ⅓ 2칸 · 색 [1] → [0]) · 받을수록 안쪽까지 (작은 구엔 굵은 팔이 안 들어가 섞임 점만 보이던 것 — #96 아트 5바퀴 1) ·
        // 빔 충전 구슬 (armsPer 2 · small 없음) 은 그대로 (#96 코드 리뷰 낮음 1)
        if (q.small) {
            // 팔 2칸 + 바깥 1칸 #1c2e30 (1칸 팔이 860 초록 구에서 안 보이던 것 — #96 아트 6바퀴 4) · 안쪽 끝 0.4 는 1칸
            const tEnd = Math.min(1, 0.3 + 0.7 * Rv);
            const n = Math.max(8, Math.ceil((r / k) * 3));
            for (const pass of [0, 1]) {
                for (let j = 0; j < arms; j++) {
                    const c = cols[j % cols.length];
                    for (let i = 0; i <= n; i++) {
                        const t = (tEnd * i) / n;
                        const [ax, ay] = armAt(j, t);
                        const w = t < 0.6 ? 2 : 1;
                        dot(ax, ay, pass === 0 ? '#1c2e30' : t < 0.5 ? c[1] : c[0], pass === 0 ? w + 1 : w);
                    }
                }
            }
        }
        return;
    }
    const tMax = Math.min(1, 0.3 + 0.7 * Rv);
    const n = Math.max(12, Math.ceil((r / k) * 4));
    // 무더기가 닿은 팔 — 바깥 30% 1장면 [0]
    let hitArm = -1;
    if (st.armHit && RN - st.armHit.at < 80) {
        let best = Infinity;
        for (let j = 0; j < arms; j++) {
            const dd = angD(armAng(j, 0), st.armHit.ang);
            if (dd < best) {
                best = dd;
                hitArm = j;
            }
        }
    }
    // 팔 사이 60° 짧은 토막 (R ⅓ 부터)
    if (Rv >= 1 / 3) {
        for (let j = 0; j < arms; j++) {
            const c = cols[j % cols.length];
            for (let i = 0; i <= n; i++) {
                const t = 0.25 + (0.3 * i) / n;
                const [ax, ay] = armAt(j, t, Math.PI / arms);
                dot(ax, ay, c[1]);
            }
        }
    }
    // 굵은 팔
    for (let j = 0; j < arms; j++) {
        const c = cols[j % cols.length];
        for (let i = 0; i <= n; i++) {
            const t = (tMax * i) / n;
            const [ax, ay] = armAt(j, t);
            const col = j === hitArm && t <= 0.3 ? c[0] : t < 0.4 ? c[2] : t < 0.75 ? c[1] : c[0];
            dot(ax, ay, col, t < 0.25 ? 3 : t < 0.6 ? 2 : 1);
        }
    }
    // 흘러 드는 빛
    if (Rv >= 2 / 3 && !reduce) {
        const armLen = (r * 0.8 * SWEEP) / k;
        for (let j = 0; j < arms; j++) {
            const t = ((((Math.floor(RN / 80) * 3) / armLen + j / arms) % 1) + 1) % 1;
            const [ax, ay] = armAt(j, t * tMax);
            dot(ax, ay, cols[j % cols.length][0], 2);
        }
    }
}

/**
 * 장면 전환 합동 끝 — 동료 타입 (합동에서만 · 맞을 때 · tb = 맞는 몸 { x, y, w, h } · k = 그림 칸):
 *  물 = 김 덩어리 7개 (6 ~ 10px 원 3 ~ 4개를 2px 칸 계단으로 묶음 · #e8eef2 · #b8c4cc) 가 터짐 아래 테두리에서 24 ~ 40px 위로 0.8초 (steps 6) +
 *    물 왕관 6갈래 — 터짐 0.2초 뒤 (불 심이 줄 때) 맞은 자리에서 20 ~ 28칸 (187 에서 40 ~ 56px) 위로 솟아 불 심 위까지 · 0.5초 · 갈래 2칸 굵기 (속 #e8f6ff + 바깥쪽 테 #3c8ce0)
 *    (가는 파란 점선 호가 불 심에 묻히던 것 — 디자인 #103 d4dc1b9) /
 *  풀 = 잎 9장 (3 × 2칸 = 187 에서 6 × 4px · 두 톤 #7cd050 · #2f7a2c · 100ms 마다 뒤집힘) 이 바깥으로 0.6초 (2 ~ 3px 점으로 읽히던 것) /
 *  불 = 불꽃 혀 8 나선 + 불티 / 그 밖 15 타입 = T11_FINALE (디자인 #152 A) · 3인 (둘 다) 은 둘 다 (15 타입은 조각 반씩) · add = 입자를 받을 곳 (기본 = 연출 캔버스)
 */
/**
 * 장면 전환 합동 — 전용 풀 구 (나무지기 에너지볼 등) 가 맞을 때 잎 흩뿌림 (#96 아트 5바퀴 3 — 끝 터짐이 상대 둘레 27% 로 작던 것):
 * 잎 18장 (6 × 4px — 몸 #7cd050 · 결 #2f7a2c) 이 맞는 점에서 반지름 패널 폭 × 0.25 까지 0.6초 6걸음 · 끝 0.3초 바둑판으로 사라짐 · 무대 위 끝 위로는 안 그림
 */
function t11LeafBurst(tb, k, add = sigParticle) {
    const W = window.innerWidth;
    // 화면 안쪽으로 치우침 (안쪽 W × 0.35 · 바깥 W × 0.2) — 맞는 점이 끝 150px 안이라 반이 화면 밖으로 나가던 것 (#96 아트 6바퀴 4)
    const inSide = tb.x > W / 2 ? -1 : 1;
    const top = t33Top();
    const leaves = Array.from({ length: 24 }, (_, i) => ({ a: (i / 24) * Math.PI * 2 + ((i * 37) % 11) * 0.03, d: 0.55 + ((i * 53) % 9) * 0.05, fall: ((i * 29) % 5) * k }));
    add({ x: 0, y: 0, s: k, max: 0.9, z: 1, draw: (ctx, p) => {
        const step = Math.min(6, 1 + Math.floor(p.life / 0.1));
        const fade = p.life > 0.6 ? 1 + Math.floor((p.life - 0.6) / 0.1) : 0;
        ctx.globalAlpha = 1;
        ctx.imageSmoothingEnabled = false;
        const dot = (x, y, c) => {
            const cx = Math.round(x / k);
            const cy = Math.round(y / k);
            if (cy * k < top || (fade && (cx + cy + fade) % 2 === 0) || fade >= 3) {
                return;
            }
            ctx.fillStyle = c;
            ctx.fillRect(cx * k, cy * k, k, k);
        };
        // 맞는 순간 연두 빛살 8줄 (2칸 굵기 · 0.3초 · 끝 바둑판)
        if (p.life < 0.3) {
            const L = Math.round((W * 0.12 * Math.min(1, p.life / 0.15)) / k);
            for (let j = 0; j < 8; j++) {
                const a = (j / 8) * Math.PI * 2 + Math.PI / 8;
                for (let t = 2; t <= L; t++) {
                    if (t > L - 3 && t % 2) {
                        continue;
                    }
                    for (const w of [0, 1]) {
                        dot(tb.x + Math.cos(a) * t * k - Math.sin(a) * w * k, tb.y + Math.sin(a) * t * k * 0.7 + Math.cos(a) * w * k, t < L / 2 ? '#e8ffd0' : '#7cd050');
                    }
                }
            }
        }
        for (const lf of leaves) {
            const R = W * (Math.sign(Math.cos(lf.a)) === inSide ? 0.35 : 0.2);
            const dd = (R * lf.d * step) / 6;
            const x = tb.x + Math.cos(lf.a) * dd;
            const y = tb.y + Math.sin(lf.a) * dd * 0.6 + (step * lf.fall) / 3;
            const flat = Math.abs(Math.cos(lf.a + step * 0.4)) > 0.5;
            // 잎 4 × 2칸 · 몸 #7cd050 · 결 (아래 줄) #1c2e30 · 끝 1칸 #e8ffd0 (풀밭과 밝기가 같아 점으로 읽히던 것 — #96 아트 6바퀴 4)
            const [w, h] = flat ? [4, 2] : [2, 4];
            for (let j = 0; j < h; j++) {
                for (let i = 0; i < w; i++) {
                    const tip = flat ? i === w - 1 && j === 0 : j === 0 && i === 0;
                    const edge = flat ? j === h - 1 : i === w - 1;
                    dot(x + (i - 1) * k, y + (j - 1) * k, tip ? '#e8ffd0' : edge ? '#1c2e30' : '#7cd050');
                }
            }
        }
    } });
}

function t11Finale(types, tb, k, add = sigParticle) {
    const px = (v) => Math.round(v / k) * k;
    const bottom = tb.y + tb.h / 2;
    const want = new Set(types);
    const dot = (ctx, x, y, c, n = 1) => {
        ctx.fillStyle = c;
        ctx.fillRect(px(x), px(y), n * k, n * k);
    };
    if (want.has('water')) {
        // 김 (#96 아트 3바퀴 1 — 흰 띠 한 장으로 붙어 상대 발을 가리던 것) — 덩어리 4 (3인 2) · 몸 상자 양옆 바깥에만 · 덩어리 = 6 ~ 10px 원 2 ~ 3개 ·
        //   덩어리 사이 틈 4px 넘게 (26px 간격) · 높이 0 · 4 · 8px 엇갈림 · 걸음마다 4 ~ 6px 오름 (0.8초 · 6걸음) · 2걸음마다 1px 작아짐
        const NP = want.size >= 2 ? 2 : 4;
        const puffs = Array.from({ length: NP }, (_, i) => {
            const side = i % 2 ? 1 : -1;
            const lane = Math.floor(i / 2);
            return { x: tb.x + side * (tb.w / 2 + 8 + lane * 26), y: bottom - 4 - [0, 4, 8, 4][i % 4], rise: 24 + ((i * 7) % 17), blobs: Array.from({ length: 2 + (i % 2) }, (_, j) => ({ dx: side * j * 5, dy: -(j % 2) * 3, r: 3 + ((i + j) % 3) })), c: '#e8eef2' };
        });
        add({ x: 0, y: 0, s: k, max: 0.8, z: 1, draw: (ctx, p) => {
            const st = Math.min(6, Math.floor(p.life / (0.8 / 6)));
            ctx.globalAlpha = 1;
            ctx.imageSmoothingEnabled = false;
            for (const f of puffs) {
                const yy = f.y - (f.rise * st) / 6;
                for (const b of f.blobs) {
                    // 원을 2px 칸 계단으로 · 걸음마다 1칸 (2px) 씩 작아지며 오름 (땅에 누운 흰 덩어리처럼 보이던 것 — #96 아트 2바퀴 6) · 밑 1칸만 짙게
                    const rr = Math.max(2, b.r - (st >> 1));
                    for (let dy = -rr; dy <= rr; dy += 2) {
                        const w = Math.round(Math.sqrt(Math.max(0, rr * rr - dy * dy)) / 2) * 2;
                        ctx.fillStyle = dy + 2 > rr ? '#b8c4cc' : f.c;
                        ctx.fillRect(Math.round((f.x + b.dx - w) / 2) * 2, Math.round((yy + b.dy + dy) / 2) * 2, w * 2, 2);
                    }
                }
            }
        } });
        // 물 왕관 — 터짐 0.2초 뒤 · 0.5초: 솟음 3걸음 (40 · 70 · 100%) → 끝 물방울이 떨어져 나감 · 갈래마다 속 1칸 + 바깥쪽 테 1칸 · 끝 2 × 2칸 방울
        const top0 = t33Top();
        // 3인 (동료 타입 둘) = 갈래 4 · 높이 × 0.6 (왕관이 몸 상자를 덮어 다른 타입 장식이 안 보이던 것 — #96 아트 2바퀴 2)
        const crown = (want.size >= 2 ? [-44, -16, 16, 44].map((deg, i) => ({ a: (deg * Math.PI) / 180, len: Math.round([22, 28, 28, 22][i] * 0.6) })) : [-52, -32, -12, 12, 32, 52].map((deg, i) => ({ a: (deg * Math.PI) / 180, len: [20, 24, 28, 28, 24, 20][i] })));
        add({ x: 0, y: 0, s: k, max: 0.7, z: 1, draw: (ctx, p) => {
            const t = p.life - 0.2;
            if (t < 0) {
                return;
            }
            const st = Math.floor(t / 0.1);
            const grow = [0.4, 0.7, 1, 1, 1][Math.min(4, st)];
            const drop = st >= 3 ? (st - 2) * 2 : 0;
            ctx.globalAlpha = 1;
            for (const c of crown) {
                const sx = Math.sign(c.a);
                const n = Math.round(c.len * grow);
                const at = (j) => ({ x: tb.x + Math.sin(c.a) * j * k * (1 + (0.4 * j) / c.len), y: tb.y - Math.cos(c.a) * j * k });
                // 끝 3칸은 떨어져 나간 방울 (걸음마다 2칸 아래로)
                const body = drop ? n - 3 : n;
                // 짙은 1칸 테 (#96 아트 6 — 덩굴 벽 연두 위에서 안 보이던 것) → 바깥쪽 테 · 속
                for (let j = 0; j <= body; j++) {
                    const q = at(j);
                    if (q.y < top0) {
                        continue;
                    }
                    dot(ctx, q.x - sx * k, q.y, '#284f83');
                    dot(ctx, q.x + 2 * sx * k, q.y, '#284f83');
                    dot(ctx, q.x + sx * k, q.y, '#3c8ce0');
                    dot(ctx, q.x, q.y, '#e8f6ff');
                }
                const tip = at(n);
                const ty = tip.y + drop * k;
                if (ty - 2 * k >= top0) {
                    dot(ctx, tip.x - 2 * k, ty - 2 * k, '#284f83', 5);
                    dot(ctx, tip.x - k, ty - k, '#3c8ce0', 3);
                    dot(ctx, tip.x - k, ty - k, '#e8f6ff', 2);
                }
            }
        } });
    }
    if (want.has('grass')) {
        // 풀 (#96 아트 2바퀴 8) — 잎 6 × 4 (#7cd050 · 잎맥 1칸 #2f7a2c) 10장 · 90ms 마다 −30° → 0 → +30° 돌며 바깥으로 · 0.7초
        const LEAVES = [['221...', '.1221.', '..1121', '....11'], ['..111.', '.11111', '222221', '..111.'], ['....11', '..1121', '.1221.', '221...']];
        add({ x: 0, y: 0, s: k, max: 0.7, z: 1, draw: (ctx, p) => {
            const st = Math.floor(p.life / 0.09);
            ctx.globalAlpha = 1;
            for (let i = 0; i < 10; i++) {
                const a = (i / 10) * Math.PI * 2 + 0.3;
                const d = Math.max(tb.w, tb.h) * 0.55 + st * 3 * k;
                const x = tb.x + Math.cos(a) * d * 1.3;
                const y = tb.y + Math.sin(a) * d * 0.8;
                const L = LEAVES[(st + i) % 3];
                const fx = Math.cos(a) < 0;
                for (let r = 0; r < 4; r++) {
                    for (let c = 0; c < 6; c++) {
                        const ch = L[r][fx ? 5 - c : c];
                        if (ch !== '.') {
                            dot(ctx, x + (c - 2.5) * k, y + (r - 1.5) * k, ch === '1' ? '#7cd050' : '#2f7a2c');
                        }
                    }
                }
            }
        } });
    }
    if (want.has('fire')) {
        // 불 (#96 디자인) — 불꽃 혀 3 × 5 (T11_GRAIN fire) 8개가 나선으로 솟음 (반지름 + 2칸 · 위로 3칸 / 90ms 걸음) + 불티 1칸 점 6 · 0.7초
        const F = T11_STAR_COLS.fire;
        const GL = T11_GRAIN.fire;
        const col = { W: F[0], L: F[1], M: F[2], D: F[3] };
        const r0 = Math.max(tb.w, tb.h) * 0.55;
        add({ x: 0, y: 0, s: k, max: 0.7, z: 1, draw: (ctx, p) => {
            const st = Math.floor(p.life / 0.09);
            ctx.globalAlpha = 1;
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2 + st * 0.45;
                const x = tb.x + Math.cos(a) * (r0 + st * 2 * k) * 1.2;
                const y = tb.y + Math.sin(a) * (r0 + st * 2 * k) * 0.7 - st * 3 * k;
                for (let r = 0; r < GL.length; r++) {
                    for (let c = 0; c < GL[r].length; c++) {
                        const ch = GL[r][c];
                        if (ch !== '.') {
                            dot(ctx, x + (c - 1) * k, y + (r - 2) * k, col[ch]);
                        }
                    }
                }
            }
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2 + 0.4;
                dot(ctx, tb.x + Math.cos(a) * (r0 * 0.8 + st * 3 * k), tb.y - st * (2 + (i % 3)) * k + Math.sin(a) * r0 * 0.4, i % 2 ? F[1] : F[2]);
            }
        } });
    }
    // 나머지 15 타입 (#96 ② 디자인 #152 A) — 2px 칸 · 6 ~ 10조각 · 터짐 가장자리에서 시작 · 90ms 걸음 · 0.6 ~ 0.8초 · 별 4단 색 · 터짐 덮개 위 ·
    // 3인 (동료 타입 둘) 은 타입마다 조각 반씩 · 위 끝 (정보줄 · 지도 줄) 위로는 안 그림
    // 큰 장식 (얼음 반원) 먼저 = 아래 층 · 나머지는 그 위 (#96 아트 2바퀴 2)
    for (const type of [...want].sort((p1, p2) => (p2 === 'ice') - (p1 === 'ice'))) {
        const fin = T11_FINALE[type];
        if (!fin) {
            continue;
        }
        const S = T11_STAR_COLS[type] || T11_STAR_COLS.normal;
        // [심 · 옅은 · 본색 · 짙은] — 악 · 고스트는 [3] 이 밝은 테라 짙은 색을 따로
        const C = [S[0], S[1], S[2], T11_STAR_RIM.has(type) ? t11Mix(S[2], '#0c101e', 0.55) : S[3]];
        const top0 = t33Top();
        const r0 = Math.max(tb.w, tb.h) * 0.55;
        const trio = want.size >= 2;
        const n = (v) => v; // 조각 수 그대로 (3인도 반으로 안 줄임 — #96 아트 2바퀴 2) · 큰 장식 (얼음) 만 trio 로 작게
        const at = (ctx, x, y, c, m = 1) => {
            if (y >= top0) {
                dot(ctx, x, y, c, m);
            }
        };
        // 작은 그림 (글자 줄 — 0 ~ 3 = 색 4단 · 그 밖 글자 = X 색 · . = 빔) 을 (x, y) 가운데에
        const spr = (ctx, x, y, rows, X = {}, fx = false, fy = false) => {
            const h = rows.length;
            const w = rows[0].length;
            for (let r = 0; r < h; r++) {
                const row = rows[fy ? h - 1 - r : r];
                for (let c = 0; c < w; c++) {
                    const ch = row[fx ? w - 1 - c : c];
                    if (ch !== '.') {
                        at(ctx, x + (c - (w - 1) / 2) * k, y + (r - (h - 1) / 2) * k, ch >= '0' && ch <= '3' ? C[+ch] : X[ch]);
                    }
                }
            }
        };
        const life = fin.max;
        add({ x: 0, y: 0, s: k, max: life, z: 1, draw: (ctx, p) => {
            ctx.globalAlpha = 1;
            fin.draw({ ctx, st: Math.floor(p.life / 0.09), tb, k, C, S, r0, floor: bottom, n, at, spr, trio, top0 });
        } });
    }
}

// 동료 타입 끝 장식 (물 · 풀 · 불 빼고 — t11Finale 위) · draw({ ctx, st = 90ms 걸음, tb = 맞는 몸, k = 칸, C = 4단, r0 = 터짐 가장자리, floor = 발밑, n = 조각 수 (3인 반), at = 점, spr = 그림 })
const T11_SPR = {
    flake: ['1..1..1', '.1.0.1.', '..000..', '1000001', '..000..', '.1.0.1.', '1..1..1'],
    icicle: ['.0.', '.0.', '010', '121', '232'],
    bubble: ['.222.', '2..02', '2...2', '2...2', '.222.'],
    pop: ['1...1', '.....', '..0..', '.....', '1...1'],
    clod3: ['112', '123', '233'],
    clod4: ['1122', '1223', '2233', '.33.'],
    feather: ['.1.1.1.', '1111111', '3333333', '.22222.'],
    plus3: ['.1.', '101', '.1.'],
    scale: ['.0.', '121'],
    rock: ['.12.', '1223', '2333'],
    wisp: ['.0.', '010', '020', '020', '.0.'],
    diamond: ['..3..', '.313.', '31013', '.313.', '..3..'],
    crescent: ['.3311..', '331....', '31.....', '331....', '.3311..'],
    shardH: ['.0112', '01223', '1223.'],
    shardV: ['.01', '012', '122', '123', '23.'],
    heart: ['.2.2.', '20222', '22222', '.222.', '..2..'],
    plus5: ['..1..', '..1..', '11011', '..1..', '..1..'],
    twinkle: ['..2..', '..1..', '21012', '..1..', '..2..'],
    spark3: ['0..', '.1.', '.00'],
    rock5: ['.111.', '12221', '22222', '23332', '.333.'],
    ghostA: ['.RRRR.', 'R2222R', 'R2002R', 'R2002R', 'R2222R', 'R2222R', '.R22R.', '..R2R.'],
    ghostB: ['.RRRR.', 'R2222R', 'R2002R', 'R2002R', 'R2222R', 'R2222R', '.R22R.', '.R2R..'],
    moon: ['..RRR..', '.R22...', 'R22....', 'R22....', 'R22....', '.R22...', '..RRR..'],
};
const T11_FINALE = {
    // 전기 — 지그재그 6 (6 ~ 10칸 · 심 [0] 1칸 + 테 [3]) 은 2장면만 한 번 (1초 3번 넘게 번쩍이지 않게) · 360ms 에 작은 지그재그 (6칸 · [2]) 한 번 더 + 한 번 꺾인 3 × 3 불티 8개가 바깥으로 (#96 아트 2바퀴 8)
    electric: { max: 0.7, draw: ({ ctx, st, tb, k, C, r0, n, at, spr }) => {
        const z = n(6);
        if (st >= 1 && st <= 2) {
            for (const pass of [0, 1]) {
                for (let i = 0; i < z; i++) {
                    const a = (i / z) * Math.PI * 2 + 0.25;
                    const ux = Math.cos(a);
                    const uy = Math.sin(a);
                    const len = 6 + ((i * 3) % 5);
                    // 꼭짓점 = 2칸마다 · 옆으로 ±2칸 번갈아 (첫 점은 가운데) → 칸마다 이어 그음
                    const x0 = tb.x + ux * r0 * 1.2;
                    const y0 = tb.y + uy * r0 * 0.8;
                    const vtx = (m) => {
                        const side = m === 0 ? 0 : m % 2 ? 2 : -2;
                        return [x0 + ux * m * 2 * k - uy * side * k, y0 + uy * m * 2 * k + ux * side * k];
                    };
                    for (let m = 0; m < len / 2; m++) {
                        const [ax, ay] = vtx(m);
                        const [bx, by] = vtx(m + 1);
                        const cells = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / k));
                        for (let j = 0; j <= cells; j++) {
                            const cx = ax + ((bx - ax) * j) / cells;
                            const cy = ay + ((by - ay) * j) / cells;
                            if (pass === 0) {
                                at(ctx, cx - k, cy, C[3]);
                                at(ctx, cx + k, cy, C[3]);
                                at(ctx, cx, cy - k, C[3]);
                                at(ctx, cx, cy + k, C[3]);
                            } else {
                                at(ctx, cx, cy, C[0]);
                            }
                        }
                    }
                }
            }
        }
        // 360ms — 작은 지그재그 (6칸 · 본색 [2] · 흰 심 아님) 한 번 더
        if (st === 4) {
            for (let i = 0; i < z; i++) {
                const a = (i / z) * Math.PI * 2 + 0.25 + Math.PI / z;
                const ux = Math.cos(a);
                const uy = Math.sin(a);
                for (let j = 0; j < 6; j++) {
                    const side = (j >> 1) % 2 ? 1 : -1;
                    at(ctx, tb.x + ux * (r0 * 1.6 + j * k) - uy * side * k, tb.y + uy * (r0 * 1.0 + j * k) + ux * side * k, C[2]);
                }
            }
        }
        const m = n(8);
        for (let i = 0; i < m; i++) {
            const a = (i / m) * Math.PI * 2 + 0.6;
            const d = r0 + st * 3 * k;
            spr(ctx, tb.x + Math.cos(a) * d * 1.3, tb.y + Math.sin(a) * d * 0.8, T11_SPR.spark3, {}, Math.cos(a) < 0);
        }
    } },
    // 얼음 — 눈송이 7 × 7 8개가 터짐 가장자리 위쪽에서 흔들리며 떨어짐 + 발밑 고드름 4개가 3걸음에 솟음
    ice: { max: 0.8, draw: ({ ctx, st, tb, k, r0, floor, n, spr, trio }) => {
        const m = trio ? 4 : n(8);
        const rk = trio ? 0.6 : 1;
        for (let i = 0; i < m; i++) {
            const a = Math.PI * (1.05 + (i / Math.max(1, m - 1)) * 0.9);
            const x = tb.x + Math.cos(a) * r0 * 1.4 * rk + Math.sin(st * 0.8 + i) * 2 * k;
            const y = tb.y + Math.sin(a) * r0 * 0.9 * rk + st * 2 * k;
            spr(ctx, x, Math.min(y, floor - 4 * k), T11_SPR.flake);
        }
        const g = Math.min(5, 2 + st);
        for (const [i, f] of [-1.2, -0.6, 0.6, 1.2].entries()) {
            if (i >= n(4)) {
                break;
            }
            // 밑 줄을 발밑 1칸 위에 붙이고 위로 자람
            spr(ctx, tb.x + f * r0, floor - k - ((g - 1) / 2) * k, T11_SPR.icicle.slice(5 - g));
        }
    } },
    // 격투 — 충격 호 조각 8 (두 겹 고리 · [2] 2칸 + [3] 그림자 — 연분홍 1칸이라 에스퍼처럼 읽히던 것) 이 퍼짐 + 발밑 금 4줄 (#642d2b)
    fighting: { max: 0.6, draw: ({ ctx, st, tb, k, C, r0, floor, n, at }) => {
        const m = n(8);
        if (st < 6) {
            for (let i = 0; i < m; i++) {
                const ring = i % 2;
                const R = ring ? r0 * 0.8 + st * 2 * k : r0 + st * 3 * k;
                const a0 = (Math.floor(i / 2) / Math.max(1, Math.ceil(m / 2))) * Math.PI * 2 + (ring ? Math.PI / 4 : 0);
                const cells = Math.max(3, Math.round((R * 0.5) / k));
                for (let j = 0; j <= cells; j++) {
                    const a = a0 - 0.25 + (0.5 * j) / cells;
                    at(ctx, tb.x + Math.cos(a) * (R + 2 * k) * 1.2, tb.y + Math.sin(a) * (R + 2 * k) * 0.8 + k, C[3]);
                    at(ctx, tb.x + Math.cos(a) * (R + k) * 1.2, tb.y + Math.sin(a) * (R + k) * 0.8, C[2]);
                    at(ctx, tb.x + Math.cos(a) * R * 1.2, tb.y + Math.sin(a) * R * 0.8, C[2]);
                }
            }
        }
        const len = Math.min(7, 2 + st);
        for (const [i, [dir, y0]] of [[-1, 0], [1, 0], [-1, 1], [1, 1]].entries()) {
            if (i >= n(4)) {
                break;
            }
            for (let j = 0; j < len - y0 * 2; j++) {
                at(ctx, tb.x + dir * (r0 * (0.2 + y0 * 0.5) + j * k), floor - k + ((j + i) % 3 === 1 ? -k : 0) + y0 * k, '#642d2b');
            }
        }
    } },
    // 독 — 거품 고리 5 × 5 8개가 솟다가 터짐 (조각마다 4 ~ 6걸음) + 발밑 웅덩이 (두 줄 · 퍼졌다 마름)
    poison: { max: 0.8, draw: ({ ctx, st, tb, k, C, r0, floor, n, at, spr }) => {
        const m = n(8);
        for (let i = 0; i < m; i++) {
            const popAt = 4 + (i % 3);
            if (st > popAt) {
                continue;
            }
            const a = Math.PI * (1.0 + (i / Math.max(1, m - 1)) * 1.0);
            const x = tb.x + Math.cos(a) * r0 * 1.2;
            const y = tb.y + Math.sin(a) * r0 * 0.6 - st * 2 * k;
            spr(ctx, x, y, st === popAt ? T11_SPR.pop : T11_SPR.bubble);
        }
        if (st < 8) {
            const rw = Math.round((tb.w * 0.6) / k) + Math.min(st, 4) - Math.max(0, st - 5) * 2;
            for (let c = -rw; c <= rw; c++) {
                at(ctx, tb.x + c * k, floor - k, c % 4 === 0 ? C[1] : C[2]);
                if (Math.abs(c) < rw - 1) {
                    at(ctx, tb.x + c * k, floor, C[3]);
                }
            }
        }
    } },
    // 땅 — 흙덩이 3 × 3 · 4 × 4 10개가 포물선 + 발밑 먼지 띠 (바둑판 두 줄)
    ground: { max: 0.8, draw: ({ ctx, st, tb, k, C, r0, floor, n, at, spr }) => {
        const m = n(10);
        const t = st * 0.09;
        for (let i = 0; i < m; i++) {
            const dir = i % 2 ? 1 : -1;
            const vx = (r0 * (1.4 + (i % 5) * 0.35)) / 0.8;
            const vy = r0 * (4 + (i % 3));
            const x = tb.x + dir * (r0 * 0.4 + vx * t);
            const y = Math.min(floor - 2 * k, tb.y - vy * t + r0 * 6 * t * t);
            spr(ctx, x, y, i % 3 ? T11_SPR.clod3 : T11_SPR.clod4);
        }
        const L = Math.round(r0 / k) + st * 3;
        for (let c = -L; c <= L; c++) {
            for (const r of [0, 1]) {
                if ((c + r) % 2 === 0) {
                    at(ctx, tb.x + c * k, floor - (r + 1) * k, r ? C[1] : C[2]);
                }
            }
        }
    } },
    // 비행 — 깃털 7 × 3 8개가 흔들리며 내려옴 + 바람 곡선 3개 (옅은 1칸 호 · 돌며 퍼짐)
    flying: { max: 0.8, draw: ({ ctx, st, tb, k, C, r0, floor, n, at, spr }) => {
        const m = n(8);
        for (let i = 0; i < m; i++) {
            const a = (i / m) * Math.PI * 2 + 0.4;
            const sway = Math.sin(st * 0.9 + i * 1.7);
            const x = tb.x + Math.cos(a) * (r0 + st * 1.5 * k) * 1.3 + sway * 2 * k;
            const y = Math.min(floor - 2 * k, tb.y + Math.sin(a) * r0 * 0.7 + st * 1.5 * k);
            spr(ctx, x, y, T11_SPR.feather, {}, sway < 0);
        }
        for (let w = 0; w < n(3); w++) {
            const R = r0 * 1.3 + st * 2 * k;
            const a0 = (w / 3) * Math.PI * 2 + st * 0.35;
            for (let j = 0; j < 10; j++) {
                const a = a0 + j * 0.09;
                at(ctx, tb.x + Math.cos(a) * R * 1.3, tb.y + Math.sin(a) * R * 0.7, j > 6 ? C[2] : C[1]);
            }
        }
    } },
    // 에스퍼 — 점선 고리 3개가 120ms 씩 늦게 퍼짐 + 둘레를 도는 "+" 4개
    psychic: { max: 0.7, draw: ({ ctx, st, tb, k, C, r0, n, at, spr }) => {
        for (let i = 0; i < 3; i++) {
            const s2 = st - Math.round((i * 0.12) / 0.09);
            if (s2 < 0 || s2 > 6) {
                continue;
            }
            const R = r0 * 0.7 + s2 * 3 * k;
            const cells = Math.max(16, Math.round((Math.PI * 2 * R) / k));
            for (let j = 0; j < cells; j += 2) {
                const a = (j / cells) * Math.PI * 2;
                at(ctx, tb.x + Math.cos(a) * R * 1.2, tb.y + Math.sin(a) * R * 0.6, i % 2 ? C[1] : C[2]);
            }
        }
        const m = n(4);
        for (let i = 0; i < m; i++) {
            const a = (i / m) * Math.PI * 2 + st * 0.5;
            spr(ctx, tb.x + Math.cos(a) * r0 * 1.5, tb.y + Math.sin(a) * r0 * 0.7, T11_SPR.plus3);
        }
    } },
    // 벌레 — 몸 2 × 2 [2] + 날개 1칸 [0] (90ms 마다 위 ↔ 아래 파닥) 12마리가 6마리씩 두 무리로 지름 12칸 원을 돎 (#96 아트 2바퀴 8)
    bug: { max: 0.7, draw: ({ ctx, st, tb, k, C, r0, n, at }) => {
        const m = n(8);
        for (let i = 0; i < m; i++) {
            const g = i % 2;
            const cx = tb.x + (g ? 1 : -1) * r0 * 1.1;
            const cy = tb.y - r0 * 0.3 - st * k;
            const a = (Math.floor(i / 2) / Math.ceil(m / 2)) * Math.PI * 2 + st * 0.5 * (g ? 1 : -1);
            const x = cx + Math.cos(a) * 8 * k;
            const y = cy + Math.sin(a) * 8 * k * 0.7;
            for (let c = 0; c < 3; c++) {
                at(ctx, x + (c - 1) * k, y, C[2]);
                at(ctx, x + (c - 1) * k, y + k, C[2]);
            }
            at(ctx, x, (st >> 1) % 2 ? y - k : y + 2 * k, C[0]);
        }
    } },
    // 바위 — 5 × 5 팔각 돌 3단 6개가 무대 위 + 4칸에서 떨어져 발 줄에 닿고 1칸 튄 뒤 멈춤 + 닿을 때 2 × 1 먼지 둘 (땅 = 솟는 흙덩이와 갈리게 — #96 아트 2바퀴 8)
    rock: { max: 0.8, draw: ({ ctx, st, tb, k, C, r0, floor, n, at, spr, top0 }) => {
        const m = n(6);
        const y0 = Math.max(top0, 0) + 4 * k;
        const yEnd = floor - 3 * k;
        for (let i = 0; i < m; i++) {
            const x = tb.x + (i % 2 ? 1 : -1) * r0 * (0.4 + 0.3 * Math.floor(i / 2));
            const s2 = st - (i % 3);
            if (s2 < 0) {
                continue;
            }
            // 떨어짐 (걸음마다 빨라짐) → 닿은 걸음은 1칸 위 (튐) → 그 뒤 멈춤
            const fall = y0 + (s2 * (s2 + 1) * k * 3) / 2;
            const land = fall >= yEnd;
            const first = land && y0 + ((s2 - 1) * s2 * k * 3) / 2 < yEnd;
            const y = land ? (first ? yEnd - k : yEnd) : fall;
            spr(ctx, x, y, T11_SPR.rock5);
            if (first) {
                at(ctx, x - 3 * k, floor - k, C[1], 1);
                at(ctx, x - 2 * k, floor - k, C[1], 1);
                at(ctx, x + 2 * k, floor - k, C[1], 1);
                at(ctx, x + 3 * k, floor - k, C[1], 1);
            }
        }
    } },
    // 고스트 — 몸 4 × 6 [2] + 심 2 × 2 [0] + 밝은 테 1칸 6개 · 꼬리 2칸이 90ms 마다 좌우 · ±1칸 떠다니며 천천히 떠남 (#96 아트 2바퀴 8)
    ghost: { max: 0.8, draw: ({ ctx, st, tb, r0, k, n, spr, S }) => {
        const m = n(6);
        for (let i = 0; i < m; i++) {
            const a = Math.PI * (0.95 + (i / Math.max(1, m - 1)) * 1.1);
            const x = tb.x + Math.cos(a) * (r0 * 1.2 + st * k);
            const y = tb.y + Math.sin(a) * r0 * 0.7 - st * k + ((st + i) % 4 < 2 ? -k : k);
            spr(ctx, x, y, (st + i) % 2 ? T11_SPR.ghostA : T11_SPR.ghostB, { R: S[3] });
        }
    } },
    // 드래곤 — 비늘 마름모 5 × 5 8개가 나선으로 솟음 + S 자 기운 줄기 2 (심 [1] · 테 [3])
    dragon: { max: 0.8, draw: ({ ctx, st, tb, k, C, r0, floor, n, at, spr }) => {
        const m = n(8);
        for (let i = 0; i < m; i++) {
            const a = (i / m) * Math.PI * 2 + st * 0.5;
            const d = r0 + st * 1.5 * k;
            spr(ctx, tb.x + Math.cos(a) * d * 1.2, tb.y + Math.sin(a) * d * 0.6 - st * 2 * k, T11_SPR.diamond);
        }
        const L = Math.min(16, st * 3);
        for (const [i, sd] of [-1, 1].entries()) {
            if (i >= n(2)) {
                break;
            }
            const sx = (j) => tb.x + sd * r0 * 0.5 + Math.round(Math.sin(j * 0.6 + st * 0.8) * 3) * k * sd;
            const sy = (j) => floor - 2 * k - j * k * 1.5;
            for (let j = 0; j < L; j++) {
                at(ctx, sx(j) - k, sy(j), C[3]);
                at(ctx, sx(j) + k, sy(j), C[3]);
                at(ctx, sx(j), sy(j), C[1]);
            }
            // 줄기 위 비늘 셋 (#96 아트 3바퀴 7 — 비늘이 안 보이던 것)
            for (const f of [0.3, 0.6, 0.9]) {
                const j = Math.floor(L * f);
                if (j > 0) {
                    spr(ctx, sx(j), sy(j), T11_SPR.diamond);
                }
            }
        }
    } },
    // 악 — 초승달 (2칸 굵기 호 [2] + 바깥 밝은 테 1칸) 6개가 양옆으로 미끄러져 나감 + 발밑 그림자 점 2 × 1 넷 (#1a1626 — #96 아트 2바퀴 8)
    dark: { max: 0.7, draw: ({ ctx, st, tb, k, r0, floor, n, at, spr, S }) => {
        const m = n(6);
        const rx = tb.w / 2 + 6 * k + st * k;
        const ry = tb.h / 2 + 4 * k + st * k;
        for (let i = 0; i < m; i++) {
            const a = (i / m) * Math.PI * 2 + (st * 15 * Math.PI) / 180;
            const x = tb.x + Math.cos(a) * rx;
            spr(ctx, x, Math.min(floor - 4 * k, tb.y + Math.sin(a) * ry), T11_SPR.moon, { R: S[3] }, x < tb.x); // 땅 아래로는 안 감
        }
        for (let j = 0; j < 4; j++) {
            const x = tb.x + (j - 1.5) * (r0 * 0.6 + st * 2 * k);
            at(ctx, x, floor - k, '#1a1626');
            at(ctx, x + k, floor - k, '#1a1626');
        }
    } },
    // 강철 — 쇳조각 5 × 3 8개가 돌며 (가로 ↔ 세로) 퍼짐 + "+" 반짝 4개 (2 ~ 6걸음 · 깜빡이지 않음)
    steel: { max: 0.7, draw: ({ ctx, st, tb, k, r0, n, spr }) => {
        const m = n(8);
        for (let i = 0; i < m; i++) {
            const a = (i / m) * Math.PI * 2 + 0.2;
            const d = r0 + st * 3 * k;
            spr(ctx, tb.x + Math.cos(a) * d * 1.3, tb.y + Math.sin(a) * d * 0.8, (st + i) % 2 ? T11_SPR.shardV : T11_SPR.shardH);
        }
        if (st >= 2 && st <= 6) {
            const s4 = n(4);
            for (let i = 0; i < s4; i++) {
                const a = (i / s4) * Math.PI * 2 + Math.PI / 4;
                spr(ctx, tb.x + Math.cos(a) * r0 * 1.5, tb.y + Math.sin(a) * r0 * 0.8, T11_SPR.plus3);
            }
        }
    } },
    // 페어리 — 하트 5 × 5 6개 + "+" 5 × 5 4개가 위로 오름
    // 페어리 — 하트 10 (넓게 — 같은 타입 짝 상대 합동에서 분홍 동료가 끝에만 조금이던 것, #96 아트 6바퀴 5) + 십자 4
    fairy: { max: 0.8, draw: ({ ctx, st, tb, k, r0, n, spr }) => {
        const m = n(10);
        for (let i = 0; i < m; i++) {
            const a = (i / m) * Math.PI * 2 + 0.3;
            spr(ctx, tb.x + Math.cos(a) * (r0 + st * 1.5 * k) * 1.5, tb.y + Math.sin(a) * r0 * 0.75 - st * 2 * k, T11_SPR.heart);
        }
        const s4 = n(4);
        for (let i = 0; i < s4; i++) {
            const a = (i / s4) * Math.PI * 2 + 1.0;
            spr(ctx, tb.x + Math.cos(a) * r0 * 1.4, tb.y + Math.sin(a) * r0 * 0.5 - st * 2.5 * k, T11_SPR.plus5);
        }
    } },
    // 노말 — "✦" 8개가 바깥으로 + 발밑 베이지 먼지 뭉치 4 (천천히 오름)
    normal: { max: 0.6, draw: ({ ctx, st, tb, k, r0, floor, n, at, spr }) => {
        const m = n(8);
        for (let i = 0; i < m; i++) {
            const a = (i / m) * Math.PI * 2;
            const d = r0 + st * 3 * k;
            spr(ctx, tb.x + Math.cos(a) * d * 1.3, tb.y + Math.sin(a) * d * 0.8, T11_SPR.twinkle);
        }
        const p4 = n(4);
        for (let i = 0; i < p4; i++) {
            const x = tb.x + [-1.1, -0.5, 0.5, 1.1][i] * r0;
            const y = floor - 2 * k - st * k;
            for (const [dx, dy, c] of [[0, 0, '#d8c8a8'], [1, 0, '#d8c8a8'], [0, -1, '#b8a888'], [1, -1, '#d8c8a8'], [2, 0, '#b8a888']]) {
                at(ctx, x + dx * k, y + dy * k, c);
            }
        }
    } },
};
