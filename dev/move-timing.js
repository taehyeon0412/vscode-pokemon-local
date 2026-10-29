// 기술 박자 기록 — dev/move-timing.py 가 시험 창 (game.html) 에 넣음 (ideas 1658 · UX 리뷰어 #122 2단계 logger.js 를 옮김)
// window.__moveTiming = { ev: 연출 부름 (move · impact · swat …), fr: 장면마다 (rAF) 한 줄, tr: 날아가는 것 (날리기 · 고리 · 돌) 하나씩 }
// 시각은 모두 performance.now() ms — 분석은 dev/move-timing.py (맞는 때 = impact 기준)
(() => {
  if (!/game\.html/.test(location.pathname)) return;
  const q = new URLSearchParams(location.search);
  const side = q.get("side") || "me";
  const tg = side === "me" ? "foe" : "me";
  const L = (window.__moveTiming = { ev: [], fr: [], tr: [], t0: performance.now(), side });

  // 연출이 만드는 알갱이를 붙잡음 — 틀마다 고유한 칸으로 가림 (고리 r0 · r1 / 돌 ground · top · big / 날리기 shape · v0)
  const op = Array.prototype.push;
  const live = [];
  Array.prototype.push = function (...a) {
    if (a.length === 1) {
      const p = a[0];
      if (p && typeof p === "object" && !p.__mt && "life" in p && "drag" in p && "vx" in p && "x" in p) {
        let kind = null;
        if ("r0" in p && "r1" in p) kind = "ring";
        else if ("ground" in p && "top" in p && "big" in p) kind = "rock";
        else if ("shape" in p && "v0" in p) kind = "proj";
        if (kind) {
          // vx — 고리가 0 이면 쓰는 쪽 둘레에서 퍼지는 고리 (염동력 · 병상첨병 — 상대에 닿는 것 없음)
          const u = { k: kind, t0: Math.round(performance.now()), x0: Math.round(p.x), y0: Math.round(p.y), vx: Math.round(p.vx) };
          Object.defineProperty(p, "__mt", { value: u, enumerable: false });
          op.call(live, p);
          op.call(L.tr, u);
        }
      }
    }
    return op.apply(this, a);
  };
  // s = 맞는 쪽 그림 상자 · B = 몸 상자 (가운데 60% 폭 · 위 15% 아래) — tS 그림 상자 · tB 몸 상자 · tC 가운데에 앞 끝이 든 때
  const track = (s, B, t) => {
    const dir = side === "me" ? 1 : -1;
    const cx = (s[0] + s[2]) / 2;
    const inB = (x) => (dir > 0 ? x >= B[0] : x <= B[2]);
    const inS = (x) => (dir > 0 ? x >= s[0] : x <= s[2]);
    for (const p of live) {
      const u = p.__mt;
      if (u.td !== undefined) continue;
      if (p.life >= p.max) { u.td = Math.round(t); continue; }
      if (u.k === "proj" || u.k === "ring") {
        let front = p.x;
        if (u.k === "ring") front = p.x + dir * (p.r0 + (p.r1 - p.r0) * Math.min(1, p.life / p.max)) * p.s;
        if (u.tS === undefined && inS(front)) u.tS = Math.round(t);
        if (u.tB === undefined && inB(front)) u.tB = Math.round(t);
        if (u.tC === undefined && (p.x - cx) * dir >= 0) u.tC = Math.round(t);
      } else if (u.k === "rock") {
        if (u.tL === undefined && p.y >= p.ground - p.s) u.tL = Math.round(t);
      }
    }
  };
  let wrapped = false;
  const wrap = () => {
    const f = window.pokemonFx;
    if (!f || wrapped) return;
    wrapped = true;
    for (const k of ["move", "impact", "swat", "dodge", "contactParry", "clear"]) {
      const fn = f[k];
      if (typeof fn !== "function") continue;
      f[k] = function (...a) {
        const t = performance.now();
        try {
          // 맞는 짜임은 그리지 않음 — 날아온 것 · 뿜기 그림만 남겨 닿는 때를 잼 (부름 시각은 그대로 적음)
          return k === "impact" ? 0 : fn.apply(this, a);
        } finally {
          L.ev.push({ k, t: Math.round(t) });
        }
      };
    }
  };
  let cv = null, ctx = null;
  const R = (el) => { const r = el.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; };
  const len = Number(q.get("mtlen")) || 6000;
  const loop = () => {
    try { step(); } catch (e) { L.err = (L.err || 0) + 1; L.lastErr = String(e); }
    if (performance.now() - L.t0 < len) requestAnimationFrame(loop);
  };
  const step = () => {
    wrap();
    const t = performance.now();
    const row = { t: Math.round(t) };
    const ts = document.querySelector(`.pg-fighter-${tg} .pg-sprite`);
    if (!cv) { cv = document.getElementById("pokemonFxCanvas"); ctx = cv && cv.getContext("2d", { willReadFrequently: true }); }
    if (ts && cv && ctx && cv.width) {
      const s = R(ts);
      row.spr = s.map(Math.round);
      // 맞는 쪽 그림 왼쪽 끝 0.1px — 땅 흔들기 세기가 점점 커질 때 1px 반올림이면 최댓값에 맞는 때보다 일찍 닿던 것 (shake)
      row.sx = Math.round(s[0] * 10) / 10;
      const bar = document.querySelector("#pokemon-game .pg-infobar");
      const top = Math.max(bar ? bar.getBoundingClientRect().bottom : 0, parseFloat(document.body.style.getPropertyValue("--pg-fx-top")) || 0);
      const cr = cv.getBoundingClientRect();
      const sx = cv.width / Math.max(1, cr.width), sy = cv.height / Math.max(1, cr.height);
      const W = cv.width, H = cv.height;
      const d = ctx.getImageData(0, 0, W, H).data;
      const cxm = (s[0] + s[2]) / 2, w = s[2] - s[0], h = s[3] - s[1];
      const B = [cxm - 0.3 * w, s[1] + 0.15 * h, cxm + 0.3 * w, s[3]];
      try { track(s, B, t); } catch (e) { L.terr = String(e); }
      // 캔버스 그림: n 정보줄 아래 모두 · body 몸 상자 안 · foot 발밑 띠 (그림 폭 양옆 반씩 · 키 55% ~ 발 아래 25% — 땅 흔들기 금 · 흙 · 튀는 돌) · rHi / rLo 줄마다 가장 오른쪽 · 왼쪽 (뿜기 앞머리)
      const FT = [s[0] - 0.5 * w, s[1] + 0.55 * h, s[2] + 0.5 * w, s[3] + 0.25 * h];
      // near 상대 둘레 (그림 폭 양옆 반씩 · 키 60% 위 ~ 발 아래 25% — 회오리 기둥 · 가루가 상대 자리에 놓이는 틀) · col 상대 폭 안 점 수 · ctop / cbot 그 점의 위 끝 · 아래 끝 (기둥 높이 · 물결 높이)
      const NZ = [s[0] - 0.5 * w, s[1] - 0.6 * h, s[2] + 0.5 * w, s[3] + 0.25 * h];
      let n = 0, body = 0, foot = 0, near = 0, col = 0, ctop = 1e9, cbot = -1e9;
      const rHi = new Float32Array(H).fill(-1e9), rLo = new Float32Array(H).fill(1e9);
      for (let y = 0; y < H; y++) {
        const Y = y / sy + cr.top;
        if (Y < top) continue;
        const inB = Y >= B[1] && Y < B[3];
        for (let x = 0; x < W; x++) {
          if (d[(y * W + x) * 4 + 3] <= 40) continue;
          const X = x / sx + cr.left;
          n++;
          if (X > rHi[y]) rHi[y] = X;
          if (X < rLo[y]) rLo[y] = X;
          if (inB && X >= B[0] && X < B[2]) body++;
          if (Y >= FT[1] && Y < FT[3] && X >= FT[0] && X < FT[2]) foot++;
          if (Y >= NZ[1] && Y < NZ[3] && X >= NZ[0] && X < NZ[2]) near++;
          if (X >= s[0] && X < s[2]) { col++; if (Y < ctop) ctop = Y; if (Y > cbot) cbot = Y; }
        }
      }
      // 맞는 쪽 실루엣 (그림 알파) — 줄마다 쓰는 쪽을 향한 겉면 (rowF) · 덮음 (mcov)
      L.mk = (L.mk || 0) + 1;
      if ((!L.mask || L.mk % 15 === 0 || Math.abs(L.maskW - Math.round(w)) > 1 || Math.abs(L.maskH - Math.round(h)) > 1) && ts.complete && ts.naturalWidth && w >= 4 && h >= 4) {
        const mw = Math.round(w), mh = Math.round(h);
        const oc = document.createElement("canvas"); oc.width = mw; oc.height = mh;
        const ox = oc.getContext("2d");
        const tf = getComputedStyle(ts).transform;
        const flip = tf && tf.startsWith("matrix(") && parseFloat(tf.slice(7)) < 0;
        if (flip) { ox.translate(mw, 0); ox.scale(-1, 1); }
        ox.drawImage(ts, 0, 0, mw, mh);
        const md = ox.getImageData(0, 0, mw, mh).data;
        const pts = [];
        for (let yy = 0; yy < mh; yy++) for (let xx = 0; xx < mw; xx++) if (md[(yy * mw + xx) * 4 + 3] > 100) pts.push(xx, yy);
        const sizeCh = !L.mask || Math.abs(L.maskW - mw) > 1 || Math.abs(L.maskH - mh) > 1;
        if (sizeCh || pts.length > L.mask.length) {
          L.mask = pts; L.maskW = mw; L.maskH = mh;
          const rf = new Array(mh).fill(null);
          for (let i = 0; i < pts.length; i += 2) {
            const xx = pts[i], yy = pts[i + 1];
            if (side === "me") { if (rf[yy] === null || xx < rf[yy]) rf[yy] = xx; }
            else if (rf[yy] === null || xx + 1 > rf[yy]) rf[yy] = xx + 1;
          }
          L.rowF = rf;
        }
      }
      // rdep = 같은 높이 줄에서 그림 앞머리가 실루엣 겉면을 지난 px (0 이상 = 닿음 — 뿜기 앞머리, UX U2 · br6)
      if (L.rowF) {
        let dep = -1e9;
        for (let yy = 0; yy < L.rowF.length; yy++) {
          const f = L.rowF[yy];
          if (f === null) continue;
          const Y = s[1] + yy + 0.5;
          if (Y < top) continue;
          const py = Math.floor((Y - cr.top) * sy);
          if (py < 0 || py >= H) continue;
          const dd = side === "me" ? (rHi[py] > -1e8 ? rHi[py] - (s[0] + f) : -1e9) : (rLo[py] < 1e8 ? (s[0] + f) - rLo[py] : -1e9);
          if (dd > dep) dep = dd;
        }
        if (dep > -1e8) row.rdep = Math.round(dep);
      }
      if (L.mask && L.mask.length) {
        let cov = 0;
        for (let i = 0; i < L.mask.length; i += 2) {
          const X = s[0] + L.mask[i] + 0.5, Y = s[1] + L.mask[i + 1] + 0.5;
          const px = Math.floor((X - cr.left) * sx), py = Math.floor((Y - cr.top) * sy);
          if (px >= 0 && py >= 0 && px < W && py < H && Y >= top && d[(py * W + px) * 4 + 3] > 100) cov++;
        }
        row.mcov = Math.round((1000 * cov) / (L.mask.length / 2)) / 1000;
      }
      Object.assign(row, { n, body, foot, near, col });
      if (col) Object.assign(row, { ctop: Math.round(ctop), cbot: Math.round(cbot) });
    }
    const pe = document.querySelectorAll("#pokemon-game .pg-pop-damage");
    if (pe.length) row.pop = [...pe].map((p) => p.textContent.trim()).join("|");
    // 패링 원 (상대 것) — 줄어드는 원 r · 목표 원 r
    const ring = document.querySelector(".pg-ring-c");
    if (ring) {
      const tgc = document.querySelector(".pg-ring-target");
      row.ring = [parseFloat(getComputedStyle(ring).r), tgc ? parseFloat(tgc.getAttribute("r")) : null];
    }
    L.fr.push(row);
  };
  requestAnimationFrame(loop);
})();
