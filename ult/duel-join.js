// ───── 3:3 힘겨루기 합류 (#116 — 디자인 값 design-system "## #116") ─────
// 장면 전환 안 1:1 힘겨루기 (duel.js) 에 동료 · 상대가 합류하면 합동처럼 색이 섞이고 줄기가 굵어짐 — 새 색 없이 합동 값 (#98 D 나선 · #103 반짝이 별 · T11_STAR_COLS) 을 다시 씀.
// 약속: 다리 (bridge duelJoin) 가 합류마다 D.joins = { a: [{ type, at, from? }], b: [...] } 에 적음 (at = D.t 초 · from = 동료 몸 가운데) · 쪽마다 줄기 반 굵기 = duelJoinLane(D, X) (duel.js 그리기) · duelStart(D) 뒤에 duelJoinStart(D) 한 번
// 흐름: 동료가 다 나타난 뒤 (0.25초) → 동료 몸 → 줄기 뿌리로 별 9개 (0.45초) → 뿌리 "+" 9 × 9 (0.25초) + 줄기 둘레 동료 색 테 (0.13초) + 굵기 3걸음 (100ms) →
//   줄기 종류마다 섞임 (쏘는 = 나선 · 구 = 쉼표 팔 + 테 · 나머지 = 불꽃 혀) · 만나는 곳 동료 색 불티 · 이긴 쪽 터짐에 동료 타입 모양
// (#116 아트 1바퀴 — 합류 순간 별이 0.3초 4장면에 140px 를 지나 안 보이던 것 · 1860 나선이 울타리 · 860 나선이 이발소 기둥 · 진 쪽 터짐에 동료 색 없음)
const DUEL_JOIN = {
    wait: 0.25, // 별 출발 — 동료가 바둑판으로 다 나타난 뒤 (나타남 0.15초 + 0.1초)
    fly: 0.45, // 별이 뿌리까지 (초)
    plus: 0.25, // 뿌리 "+" (초)
    rim: 0.13, // 닿는 장면 줄기 둘레 동료 색 테 (2장면)
    grow: 0.1, // 굵기 한 걸음 (초 · 3걸음)
    step: 0.25, // 합류 하나마다 굵기 배
    max: 2, // 굵어지는 합류 수 상한 (3:1 = × 1.5)
    turn: 40, // 나선 한 바퀴 (칸) 아래 끝 — 진폭이 크면 진폭 ÷ 칸 × 3 (기울기 고정 · 1860 에서 40px 마다 세로 막대이던 것)
    amp: 3, // 나선 진폭 = 반 굵기 + 3칸 (뿌리 × 0.7 → 앞머리 × 1.0)
    adv: 2, // 50ms 마다 앞으로 (칸)
    bright: 1.5, // 앞머리 쪽 이만큼 (바퀴) 앞 마디만 본색 3칸 · 그 뒤 그림자 2칸 · 뿌리 첫 반 바퀴 = 2칸에 1칸 점
    tongues: 4, // 동료마다 불꽃 혀
    lanes: [-56, -40, -24, -10, 6, 18, 30, 44, 60], // 별 길 — 곧은 선 가운데에서 비켜 둔 칸 (T11_STAR lanes2 + 바깥 셋)
    sizes: [3, 4, 5, 5, 4, 3, 4, 5, 3], // 별 팔 길이 (칸)
    burst: 0.5, // 이긴 쪽 터짐 동료 타입 모양 (초)
    burstN: 6, // 동료마다 모양 수
};
const DUEL_JOIN_STREAM = new Set(['beam', 'bolt', 'wave']);
const DUEL_JOIN_ORB = new Set(['orb', 'dome']);
// 터짐 타입 모양 (W 흰 · L 옅은 · M 본색 · D 짙은 — T11_STAR_COLS [0 1 2 3]) · 바깥 테는 그림자색 (흰 가시에 묻히던 것 — #116 아트 2바퀴 5)
const DUEL_JOIN_SHAPE = {
    fire: ['.M..', '.MM.', 'MLM.', 'MLLM', '.MLM', 'MLLM', 'MLWM', 'MLWM', 'DMMD', '.DD.'],
    grass: ['.M.', 'MLM', 'MLD', 'MLD', 'DM.', '.D.'],
    water: ['.L..', '.LL.', 'LWMM', 'LMMD', 'MMDD', '.DD.'],
    electric: ['..M', '.M.', 'MMM', '.M.', 'M..'],
    star: ['..M..', '..L..', 'MLWLM', '..L..', '..M..'],
};
// 혀 대신 별 (크림 · 회색이라 풀밭 위 혀가 회색 말뚝으로 보이던 것 — #116 아트 2바퀴 2)
const DUEL_JOIN_PALE = new Set(['normal', 'steel', 'flying', 'ice', 'ghost', 'dark', 'rock']);

function duelJoinsOf(D, X) {
    const side = X === D.A ? 'a' : 'b';
    const list = Array.isArray(D.joins) ? D.joins.filter((j) => j.side === side) : (D.joins && D.joins[side]) || [];
    // 동료 자리를 모르면 앞장 뒤 머리 높이에서 (장면 무리 = 앞장 뒤 제 자리)
    return list.map((j) => ({ type: j.type, t: j.t ?? j.at ?? 0, from: j.from || { x: X.x0 - X.dir * X.w * 1.4, y: X.body.top } }));
}

// 별이 뿌리에 닿는 때 (초) — 굵어짐 · 섞임은 여기부터
const duelJoinLand = (j) => j.t + DUEL_JOIN.wait + DUEL_JOIN.fly;

// 쪽 굵기 배 — 별이 닿은 뒤 100ms 마다 한 걸음 (툭 커지지 않게 — U2) · 합류 둘까지
function duelJoinK(D, X) {
    let k = 1;
    for (const j of duelJoinsOf(D, X).slice(0, DUEL_JOIN.max)) {
        const u = D.t - duelJoinLand(j);
        if (u >= 0) {
            k += (DUEL_JOIN.step * Math.min(3, Math.floor(u / DUEL_JOIN.grow) + 1)) / 3;
        }
    }
    return k;
}

// 쪽 줄기 반 굵기 — 정수 칸 (반 칸 금지)
function duelJoinLane(D, X) {
    const k = duelJoinK(D, X);
    return k === 1 ? D.lane : Math.max(D.S, Math.round((D.lane * k) / D.S) * D.S);
}

function duelJoinCols(type) {
    return T11_STAR_COLS[type] || T11_STAR_COLS.normal;
}

function duelJoinStart(D) {
    const S = D.S;
    const reduce = typeof t33Reduce === 'function' && t33Reduce();
    const now = () => (typeof fxRealNow === 'function' ? fxRealNow() : performance.now());
    const live = (X) => X.fade > 0.5 && D.phase !== 'charge';
    const st = { burstAt: null };
    // 동료 몸 → 줄기 뿌리 (입 앞 x0) 로 넓게 날아가는 별 · 닿는 장면에 뿌리 "+" 9 × 9 · 줄기 둘레 동료 색 테
    const stars = (ctx, px, X, j) => {
        const u = D.t - j.t - DUEL_JOIN.wait;
        const cols = duelJoinCols(j.type);
        const to = { x: X.x0, y: D.y0 };
        if (u >= 0 && u < DUEL_JOIN.fly) {
            const nx = -(to.y - j.from.y);
            const ny = to.x - j.from.x;
            const nl = Math.hypot(nx, ny) || 1;
            DUEL_JOIN.lanes.forEach((off, i) => {
                const p = Math.min(1, Math.max(0, (u - (i % 5) * 0.025) / (DUEL_JOIN.fly - 0.1)));
                if (p <= 0 || p >= 1) {
                    return;
                }
                const cx = (j.from.x + to.x) / 2 + (nx / nl) * off * S;
                const cy = (j.from.y + to.y) / 2 + (ny / nl) * off * S;
                const x = (1 - p) * (1 - p) * j.from.x + 2 * (1 - p) * p * cx + p * p * to.x;
                // 바깥 길은 패널 아래 끝 위로 (팔 + 1칸 — 아래 끝에서 잘리던 것, 픽셀 검사원 #116 2바퀴 작음 7)
                const y = Math.min(D.H - (DUEL_JOIN.sizes[i] + 2) * S, (1 - p) * (1 - p) * j.from.y + 2 * (1 - p) * p * cy + p * p * to.y);
                t33Star(ctx, S, x, y, DUEL_JOIN.sizes[i], cols);
            });
        } else if (u >= DUEL_JOIN.fly && u < DUEL_JOIN.fly + DUEL_JOIN.plus) {
            dotAt(ctx, px, S, to.x - 4 * S, to.y, cols[2], 9, 1);
            dotAt(ctx, px, S, to.x, to.y - 4 * S, cols[2], 1, 9);
            dotAt(ctx, px, S, to.x - S, to.y, cols[1], 3, 1);
            dotAt(ctx, px, S, to.x, to.y - S, cols[1], 1, 3);
            dotAt(ctx, px, S, to.x, to.y, '#ffffff');
            // 줄기 위아래 끝을 따라 2칸에 1칸 점 (곧은 1px 선이 "고른 칸" 테두리로 보이던 것 — #116 아트 2바퀴 4)
            if (u < DUEL_JOIN.fly + DUEL_JOIN.rim && live(X)) {
                const half = duelJoinLane(D, X) + S;
                const len = Math.abs(X.front - X.x0);
                for (let d = 0; d < len; d += 2 * S) {
                    dotAt(ctx, px, S, X.x0 + X.dir * d, D.y0 - half, cols[2]);
                    dotAt(ctx, px, S, X.x0 + X.dir * (d + S), D.y0 + half, cols[2]);
                }
            }
        }
    };
    // 쏘는 줄기 — 동료 1마리 = 나선 1줄 (3인 = 2줄 180° 엇갈림) · 앞 마디 = 늘 본색 (앞머리 쪽 1.5바퀴만 3칸 · 그 뒤 2칸 — 몸통 위를 그림자색으로 칠해 줄기가 금 간 것처럼 보이던 것, #116 아트 2바퀴 1) ·
    //   뒤 마디 = 몸통 밖에서만 그림자 2칸 · 뿌리 첫 반 바퀴 = 점 (기운이 앞으로 흐름)
    const spiral = (ctx, px, X, list) => {
        const half = duelJoinLane(D, X);
        const len = Math.abs(X.front - X.x0);
        const adv = reduce ? 0 : Math.floor(now() / 50) * DUEL_JOIN.adv;
        const amp0 = half + DUEL_JOIN.amp * S;
        const turn = Math.max(DUEL_JOIN.turn, Math.round((amp0 / S) * 3));
        list.forEach((j, n) => {
            const cols = duelJoinCols(j.type);
            for (let d = 0; d < len; d += S) {
                const a = (((d / S - adv) / turn) * 2 + n) * Math.PI;
                const amp = amp0 * (0.7 + (0.3 * d) / Math.max(1, len));
                const off = Math.sin(a) * amp;
                const front = Math.cos(a) > 0;
                if (!front && Math.abs(off) < half) {
                    continue;
                }
                const root = d < turn * S * 0.5;
                if (root && Math.round(d / S) % 2) {
                    continue;
                }
                const head = d > len - DUEL_JOIN.bright * turn * S;
                const x = X.x0 + X.dir * d;
                const y = D.y0 + off;
                const big = front && head && !root;
                dotAt(ctx, px, S, x, y - (big ? S : 0), front ? cols[2] : cols[3], 1, big ? 3 : 2);
            }
        });
    };
    // 구 · 돔 — 구 안 동료 색 쉼표 팔 (동료마다 2개) + 테 1칸 (칸마다 번갈아 — 반투명 섞기 금지)
    const orb = (ctx, px, X, list) => {
        // 그린 구 (duel-energy orbDraw — st.at) 안 · 없으면 (돔) 앞머리 둘레 반 굵기 × 1.2
        const at = X.st && X.st.at;
        const R = at ? at.r * 0.9 : duelJoinLane(D, X) * 1.2;
        const cx = at ? at.x : X.front;
        const cy = at ? at.y : D.y0;
        const base = reduce ? 0 : (X === D.A ? -1 : 1) * Math.floor(now() / 80) * (Math.PI / 12);
        const arms = 2 * list.length;
        list.forEach((j, n) => {
            const cols = duelJoinCols(j.type);
            for (let m = 0; m < 2; m++) {
                const j0 = n + m * list.length;
                for (let t = 0; t <= 1; t += 0.08) {
                    const rr = R * (0.8 - 0.5 * t);
                    const an = base + (j0 * 2 * Math.PI) / arms + (X === D.A ? -1 : 1) * t * ((120 * Math.PI) / 180);
                    const w = t < 0.4 ? 2 : 1;
                    dotAt(ctx, px, S, cx + Math.cos(an) * rr, cy + Math.sin(an) * rr, cols[t < 0.3 ? 2 : t < 0.7 ? 1 : 0], w, w);
                }
            }
        });
        const steps = Math.max(12, Math.round((2 * Math.PI * R) / S));
        for (let i = 0; i < steps; i++) {
            const j = list[i % list.length];
            if (i % 2) {
                continue;
            }
            const an = (i / steps) * Math.PI * 2;
            dotAt(ctx, px, S, cx + Math.cos(an) * R, cy + Math.sin(an) * R, duelJoinCols(j.type)[2]);
        }
    };
    // 몸 · 땅 · 회오리 · 무리 — 앞머리 둘레 동료 색 불꽃 혀 (동료마다 4개 · 10 ~ 18칸) — 밑 3칸 → 가운데 2칸 → 끝 1칸 · 3칸 오를 때마다 나가는 쪽 반대로 1칸 눕힘 · 150ms 마다 끝이 좌우로 ·
    //   바깥 테는 아래 40% 바깥 한 줄만 (곧은 막대 + 양옆 테가 바코드 · 말뚝으로 보이던 것 — #116 아트 2바퀴 2 · 파이어 방식 겹친 혀) · 옅은 타입은 혀 대신 "+" 별
    const tongues = (ctx, px, X, list) => {
        const half = duelJoinLane(D, X);
        const tick = reduce ? 0 : Math.floor(now() / 150);
        list.forEach((j, n) => {
            const cols = duelJoinCols(j.type);
            for (let i = 0; i < DUEL_JOIN.tongues; i++) {
                const seed = (tick * 7 + n * 13 + i * 31) % 97;
                const an = Math.PI + ((i + 0.5) / DUEL_JOIN.tongues) * Math.PI + (n ? Math.PI / (2 * DUEL_JOIN.tongues) : 0);
                // 몸으로 달려드는 줄기 (rush) 는 몸 뒤 끝 − 2칸 · 꼬리 윗면을 따라 (앞몸 위에 나란히 그려져 앞장 실루엣을 가리던 것 — #116 아트 3바퀴 1) · 동료마다 4칸 뒤 · 둘째는 꼬리 아래쪽
                const rush = X.kind === 'rush';
                const x0 = rush ? X.front - X.dir * (X.w + (2 + 2 * i + 4 * n) * S) : X.front - X.dir * half * 0.4 + Math.cos(an) * half * 1.3;
                const foot = rush ? D.y0 + (n ? half * 0.5 : -half * 0.3) + (i % 2) * S : D.y0 + Math.abs(Math.sin(an)) * half * 0.6;
                if (DUEL_JOIN_PALE.has(j.type)) {
                    t33Star(ctx, S, x0, foot - (4 + (seed % 5)) * S, 3 + (seed % 3), cols);
                    continue;
                }
                const h = 10 + (seed % 9);
                const sway = reduce ? 0 : (tick + i + n) % 2 ? 1 : -1;
                for (let c = 0; c < h; c++) {
                    const w = c < h * 0.4 ? 3 : c < h - 2 ? 2 : 1;
                    const lean = -X.dir * Math.floor(c / 3) + (c >= h - 2 ? sway : 0);
                    const col = c >= h - 2 ? cols[0] : c >= h * 0.55 ? cols[1] : cols[2];
                    const l = x0 + lean * S - ((w - 1) * S) / 2;
                    dotAt(ctx, px, S, l, foot - c * S, col, w, 1);
                    if (c < h * 0.4) {
                        dotAt(ctx, px, S, X.dir > 0 ? l + w * S : l - S, foot - c * S, cols[3]);
                    }
                }
            }
        });
    };
    // 만나는 곳 동료 색 불티 (1칸 — 가시 · 튀는 에너지 색 목록에 동료 본색)
    const sparks = (ctx, px) => {
        const all = [...duelJoinsOf(D, D.A), ...duelJoinsOf(D, D.B)];
        if (!all.length || D.phase !== 'push') {
            return;
        }
        const tick = reduce ? 0 : Math.floor(now() / 120);
        for (let i = 0; i < 2 * all.length; i++) {
            const j = all[i % all.length];
            if (D.t < duelJoinLand(j)) {
                continue;
            }
            const seed = (tick * 11 + i * 17) % 101;
            const an = (seed / 101) * Math.PI * 2;
            const rr = D.blobR * (1.2 + (seed % 9) / 10);
            dotAt(ctx, px, S, D.xm + Math.cos(an) * rr, D.ym + Math.sin(an) * rr, duelJoinCols(j.type)[2]);
        }
    };
    // 이긴 쪽이 뚫고 나가 터질 때 (after) — 이긴 쪽 동료마다 타입 모양 6개가 0.5초 동안 퍼짐 (섞인 큰 폭발 — 흰 고리 · 가시만이던 것) · 마지막 0.15초는 칸 절반 · 4분의 1 (바둑판)
    const burst = (ctx, px) => {
        if (D.phase === 'after' && st.burstAt === null && D.winner) {
            st.burstAt = D.t;
        }
        if (st.burstAt === null || !D.loser) {
            return;
        }
        // 흰 가시보다 0.1초 늦게 · 0.5초 남김 · 터짐 바깥 (반지름 × 1.1 ~ 1.4)
        const u = (D.t - st.burstAt - 0.1) / DUEL_JOIN.burst;
        const list = duelJoinsOf(D, D.winner).filter((j) => st.burstAt >= duelJoinLand(j));
        if (u < 0 || u >= 1 || !list.length) {
            return;
        }
        const cx = D.loser.body.cx;
        const cy = D.loser.body.cy;
        const R = D.lane * 2.8 * (1 + 0.25 * list.length) * (0.3 + 0.7 * (1 - (1 - u) * (1 - u)));
        const keep = u < 0.7 ? 1 : u < 0.85 ? 2 : 4;
        list.forEach((j, n) => {
            const cols = duelJoinCols(j.type);
            const rows = DUEL_JOIN_SHAPE[j.type] || DUEL_JOIN_SHAPE.star;
            const key = { W: '#ffffff', L: cols[1], M: cols[2], D: cols[3] };
            for (let i = 0; i < DUEL_JOIN.burstN; i++) {
                if ((i + n) % keep) {
                    continue;
                }
                const an = ((i + n * 0.5) / DUEL_JOIN.burstN) * Math.PI * 2;
                const rr = R * (1.1 + (0.3 * ((i * 7 + n) % 4)) / 3);
                const x = cx + Math.cos(an) * rr * 1.3;
                const y = cy + Math.sin(an) * rr * 0.75;
                const ox = x - (rows[0].length * S) / 2;
                const oy = y - (rows.length * S) / 2;
                const filled = (r, c) => !!rows[r] && !!rows[r][c] && rows[r][c] !== '.';
                rows.forEach((row, r) => [...row].forEach((ch, c) => {
                    if (!key[ch]) {
                        return;
                    }
                    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                        if (!filled(r + dr, c + dc)) {
                            dotAt(ctx, px, S, ox + (c + dc) * S, oy + (r + dr) * S, cols[3]);
                        }
                    }
                }));
                rows.forEach((row, r) => [...row].forEach((ch, c) => key[ch] && dotAt(ctx, px, S, ox + c * S, oy + r * S, key[ch])));
            }
        });
    };
    // 합류 목록이 비어 있으면 아무것도 안 그림 (1:1 힘겨루기도 같이 부름)
    sigParticle({ x: 0, y: 0, s: S, max: D.total, z: 0, draw: (ctx, q, t, px) => {
        if (!duelJoinsOf(D, D.A).length && !duelJoinsOf(D, D.B).length) {
            return;
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        for (const X of [D.A, D.B]) {
            const list = duelJoinsOf(D, X);
            if (!list.length) {
                continue;
            }
            list.forEach((j) => stars(ctx, px, X, j));
            const on = list.filter((j) => D.t >= duelJoinLand(j));
            if (!on.length || !live(X)) {
                continue;
            }
            if (DUEL_JOIN_STREAM.has(X.kind) || !DUEL_FX[X.kind]) {
                spiral(ctx, px, X, on.slice(0, 2));
            } else if (DUEL_JOIN_ORB.has(X.kind)) {
                orb(ctx, px, X, on.slice(0, 2));
            } else {
                tongues(ctx, px, X, on.slice(0, 2));
            }
        }
        sparks(ctx, px);
        burst(ctx, px);
    } });
}
