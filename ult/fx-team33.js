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
// 위 끝 (무대) · 아래 끝 (패널) 안으로 줄임 · step = 0 ~ 3 · keep = 바둑판 지우기 (null = 다)
function t33Burst(ctx, k, cx, cy, foot, step, R, colsA, colsB, keep, edge = 'dot', maxR = Infinity) {
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
                const cols = seg % 2 ? colsB : colsA;
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
