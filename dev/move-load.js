// 기술 연출 PC 부담 기록 — dev/move-load.py 가 시험 창 (game.html) 에 넣음 (#122 효과 점검 · 2026-10-29 기획)
// window.__moveLoad = { fr: 장면마다 { ts, fx: 효과 고리 (moveTick) 가 쓴 ms, all: rAF 모두 ms, parts: 살아 있는 알갱이 }, ev: 연출 부름 }
// dbl=1 — 기술을 양쪽에서 동시에 (내 것과 같은 기술을 상대도 나에게 — 3:3 에서 센 기술 둘이 겹치는 흉내)
(() => {
  if (!/game\.html/.test(location.pathname)) return;
  const q = new URLSearchParams(location.search);
  const dbl = q.get("dbl") === "1";
  const L = (window.__moveLoad = { fr: [], ev: [] });
  let wrapped = false;
  const wrap = () => {
    const f = window.pokemonFx;
    if (!f || wrapped) return;
    wrapped = true;
    const mv = f.move, im = f.impact;
    let pair = null;
    f.move = function (...a) {
      L.ev.push({ k: "move", t: Math.round(performance.now()) });
      const r = mv.apply(this, a);
      if (dbl && a[4]) {
        pair = a[0];
        try { mv.call(this, a[4], a[1], a[2], a[3], a[0]); } catch (e) { L.err = String(e); }
      }
      return r;
    };
    if (typeof im === "function") {
      f.impact = function (...a) {
        L.ev.push({ k: "impact", t: Math.round(performance.now()) });
        const r = im.apply(this, a);
        if (dbl && pair) {
          try { im.call(this, pair, ...a.slice(1)); } catch (e) { L.err = String(e); }
        }
        return r;
      };
    }
  };
  // 게임은 가만히 있을 때 rAF 를 안 돌려 rAF 안에서만 감싸면 첫 기술을 놓침 — 번들이 pokemonFx 를 만들 때까지 0.02초마다
  const iv = setInterval(() => { wrap(); if (wrapped) clearInterval(iv); }, 20);
  // rAF 를 감싸 부른 것마다 걸린 시간 — 같은 ts 끼리 한 장면 · 효과는 moveTick (기술 · 필살기 · 맞는 짜임 알갱이가 모두 이 고리)
  const raf = window.requestAnimationFrame.bind(window);
  let cur = null;
  window.requestAnimationFrame = function (cb) {
    return raf((ts) => {
      wrap();
      const a = performance.now();
      try {
        cb(ts);
      } finally {
        const d = performance.now() - a;
        if (!cur || cur.ts !== ts) {
          cur = { ts: Math.round(ts * 10) / 10, t: Math.round(a), fx: 0, all: 0 };
          L.fr.push(cur);
        }
        cur.all += d;
        if (cb.name === "moveTick") {
          cur.fx += d;
          cur.parts = window.__ult && window.__ult.count ? window.__ult.count() : undefined;
        }
      }
    });
  };
})();
