#!/usr/bin/env python3
"""전용 필살기가 대상을 향하는지 훑기 (2026-10-22 orders #91 — 개굴닌자 필살기가 반대로 · 화면 끝으로 날아감)
  python dev/ult-aim.py [창 수=2] [이름 걸러내기=]   → dev/shots/ult-aim.json + 표 (콘솔)
  머리 없는 크롬 여러 개에서 전용 필살기 (fx-unique uniq · fx-sky 스타팅 특수 키) 마다 쓰는 쪽 · 대상 자리를 바꿔 (3:3 처럼 왼쪽 · 오른쪽 ·
  가운데를 넘어 섬 · 위 줄) window.pokemonFx.ult(…, { entry }) 로 돌리며, 대상 칸 · 거울 칸 (쓰는 쪽 반대편 같은 거리) · 대상 너머 (대상 뒤 ~ 화면 끝) 에
  그려진 점 넓이를 잼. 닿음 = 대상 칸 10% 넘게 칠함 · 반대 = 거울 칸이 대상 칸보다 · 넘어감 = 대상 너머가 대상 칸 넓이 넘게
  dev/ult-fx.py 의 창 · 페이지 도구를 씀 (같은 시험 창 — 1:1 전투 화면에서 두 칸을 옮겨 세움)"""
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

# PG_ROOT = 다른 폴더의 빌드로 잼 (main 견주기 — 그 폴더의 dev/ult-fx.py 가 그 폴더를 띄움)
ROOT = os.environ.get("PG_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("ultfx", os.path.join(ROOT, "dev", "ult-fx.py"))
U = importlib.util.module_from_spec(spec)
_argv = sys.argv
sys.argv = [_argv[0]]
spec.loader.exec_module(U)
sys.argv = _argv
OUT = os.environ.get("AIM_OUT") or os.path.join(ROOT, "dev", "shots", "ult-aim.json")
SPECIAL = ["uniq", "blast", "flare", "venus", "turtle", "ninja", "clones", "lucario", "mew", "mewtwo"]
# 자리 — 860 × 187 · 쓰는 쪽 x · 대상 x · 위로 올림 (위 줄 흉내 px)
CFGS = {
    "L": (215, 625, 0),
    "R": (625, 215, 0),
    "L-past": (480, 735, 0),
    "R-past": (380, 125, 0),
    "L-top": (215, 625, 40),
    "R-top": (625, 215, 40),
}
# AIM_CFGS=L-past,R-past — 자리 몇 개만
if os.environ.get("AIM_CFGS"):
    CFGS = {k: v for k, v in CFGS.items() if k in os.environ["AIM_CFGS"].split(",")}
FORMS_OF = r"""
((special) => {
  const w = document.querySelector('iframe').contentWindow;
  const lib = w.__ult.lib();
  const want = new Set(lib.map((e, i) => (special.some((k) => (e[2] || {})[k]) ? i : -1)).filter((i) => i >= 0));
  const out = {};
  for (const f of %FORMS%) for (const e of w.__ult.of(f) || []) { const i = lib.indexOf(e); if (want.has(i)) out[`${f}|${e[0]}|${e[1]}`] = [f, i]; }
  return out;
})(%SPECIAL%)
"""
ONE = r"""
(async (form, idx, cfg) => {
  const w = document.querySelector('iframe').contentWindow;
  const d = w.document;
  const fx = w.pokemonFx;
  const lib = w.__ult.lib();
  fx.clear();
  await new Promise((r) => w.setTimeout(r, 120));
  const meBox = d.querySelector('.pg-fighter-me');
  const foeBox = d.querySelector('.pg-fighter-foe');
  for (const b of [meBox, foeBox]) { b.style.position = 'relative'; b.style.top = '0px'; b.style.marginLeft = '0px'; }
  const place = (box, cx, up) => {
    box.style.marginLeft = '0px';
    box.style.top = `${-up}px`;
    const r = box.getBoundingClientRect();
    box.style.marginLeft = `${Math.round(cx - (r.left + r.width / 2))}px`;
  };
  place(meBox, cfg.meX, cfg.up);
  place(foeBox, cfg.foeX, 0);
  const src = { el: meBox.querySelector('.pg-sprite'), box: meBox, form, size: 32, left: false, name: 'x' };
  const dst = { el: foeBox.querySelector('.pg-sprite'), box: foeBox, form: 'butterfree', size: 32, left: true };
  w.__fxMeasure = true;
  const t0 = w.performance.now();
  const total = fx.ult(src, dst, () => {}, [], { entry: lib[idx] });
  if (!total) { w.__fxMeasure = false; return null; }
  const W = w.innerWidth;
  const sr = dst.el.getBoundingClientRect();
  const mr = src.el.getBoundingClientRect();
  const meX = mr.left + mr.width / 2;
  const tx = sr.left + sr.width / 2;
  const dir = Math.sign(tx - meX) || 1;
  const pad = sr.width * 0.25;
  const tgt = [sr.left - pad, sr.top - pad, sr.right + pad, sr.bottom];
  const mx = 2 * meX - tx;
  const mir = [mx - sr.width / 2 - pad, sr.top - pad, mx + sr.width / 2 + pad, sr.bottom];
  const farX = dir > 0 ? sr.right + sr.width * 0.6 : sr.left - sr.width * 0.6;
  const beyond = dir > 0 ? [farX, sr.top - sr.height, W, sr.bottom] : [0, sr.top - sr.height, farX, sr.bottom];
  const area = (r) => Math.max(1, (r[2] - r[0]) * (r[3] - r[1]));
  const cellArea = area(tgt);
  const painted = (box) => {
    let n = 0;
    if (box[2] - box[0] < 1) return 0;
    for (const c of d.querySelectorAll('canvas')) {
      const r = c.getBoundingClientRect();
      const x0 = Math.max(box[0], r.left), y0 = Math.max(box[1], r.top), x1 = Math.min(box[2], r.right), y1 = Math.min(box[3], r.bottom);
      if (x1 - x0 < 1 || y1 - y0 < 1 || !r.width || !r.height) continue;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) continue;
      const sx = c.width / r.width, sy = c.height / r.height;
      const px = ctx.getImageData(Math.floor((x0 - r.left) * sx), Math.floor((y0 - r.top) * sy), Math.max(1, Math.round((x1 - x0) * sx)), Math.max(1, Math.round((y1 - y0) * sy))).data;
      let k = 0;
      for (let i = 0; i < px.length; i += 4) if (px[i + 3] >= 96 && Math.max(px[i], px[i + 1], px[i + 2]) >= 48) k += 1;
      n += k / (sx * sy);
    }
    return n;
  };
  const lead = cfg.lead;
  let hit = 0, mirror = 0, over = 0, hitAt = -1;
  while (w.performance.now() - t0 < Math.min(total, lead + 11000)) {
    await new Promise((r) => w.setTimeout(r, 70));
    if (w.performance.now() - t0 < lead) continue;
    const h = painted(tgt) / cellArea;
    if (h > hit) { hit = h; if (h >= 0.1 && hitAt < 0) hitAt = Math.round(w.performance.now() - t0 - lead); }
    mirror = Math.max(mirror, painted(mir) / cellArea);
    over = Math.max(over, painted(beyond) / cellArea);
  }
  w.__fxMeasure = false;
  fx.clear();
  return { hit: +hit.toFixed(2), mirror: +mirror.toFixed(2), over: +over.toFixed(2), hitAt, total: Math.round(total) };
})(%FORM%, %IDX%, %CFG%)
"""


def worker(k, n, out, filt):
    ws, p, httpd = U.browser_page()
    res = {}
    try:
        forms = U.FORMS
        keys = None
        for _ in range(60):
            r = ws.call("Runtime.evaluate", {"expression": FORMS_OF.replace("%FORMS%", json.dumps(forms)).replace("%SPECIAL%", json.dumps(SPECIAL)), "returnByValue": True})
            keys = r.get("result", {}).get("value")
            if isinstance(keys, dict) and keys:
                break
            time.sleep(0.5)
        mine = [key for key in sorted(keys) if filt in key][k::n]
        for key in mine:
            form, idx = keys[key]
            res[key] = {}
            for name, (mx, fxx, up) in CFGS.items():
                cfg = json.dumps({"meX": mx, "foeX": fxx, "up": up, "lead": U.CHARGE_MS + U.INTRO_MS})
                r = ws.call("Runtime.evaluate", {"expression": ONE.replace("%FORM%", json.dumps(form)).replace("%IDX%", str(idx)).replace("%CFG%", cfg), "awaitPromise": True, "returnByValue": True})
                res[key][name] = r.get("result", {}).get("value")
            json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False)
    finally:
        json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False)
        U.kill_browser(p)
        httpd.shutdown()
        shutil.rmtree(getattr(U.browser_page, "prof", ""), ignore_errors=True)


def verdict(v):
    """닿음 · 반대 · 넘어감 — 한 칸"""
    if not v:
        return "못 잼"
    bad = []
    if v["hit"] < 0.1:
        bad.append("안 닿음")
    if v["mirror"] >= 0.1 and v["mirror"] > v["hit"] * 1.5:
        bad.append("반대")
    if v["over"] >= 1.0:
        bad.append("넘어감")
    return " · ".join(bad) if bad else "OK"


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--worker":
        worker(int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5] if len(sys.argv) > 5 else "")
        sys.exit(0)
    # 머리 없는 브라우저는 세션마다 2개까지 (game-dev-team 3장 정리 ④ · 2026-10-24 — 메모리 0.3 GB) · PG_MAX_BROWSERS 로만 늘림
    n = min(int(sys.argv[1]) if len(sys.argv) > 1 else 2, int(os.environ.get("PG_MAX_BROWSERS", 2)))
    filt = sys.argv[2] if len(sys.argv) > 2 else ""
    tmp = tempfile.mkdtemp()
    t0 = time.time()
    procs = [subprocess.Popen([sys.executable, __file__, "--worker", str(k), str(n), os.path.join(tmp, f"w{k}.json"), filt]) for k in range(n)]
    for q in procs:
        q.wait()
    merged = {}
    for k in range(n):
        f = os.path.join(tmp, f"w{k}.json")
        if os.path.exists(f):
            merged.update(json.load(open(f, encoding="utf-8")))
    shutil.rmtree(tmp, ignore_errors=True)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(dict(sorted(merged.items())), open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    sys.stdout.reconfigure(encoding="utf-8")
    bad = 0
    for key, row in sorted(merged.items()):
        cells = {name: verdict(row.get(name)) for name in CFGS}
        if any(c != "OK" for c in cells.values()):
            bad += 1
        print(key, " | ".join(f"{name} {c}" for name, c in cells.items()))
    print(f"전용 필살기 {len(merged)} · 걸린 것 {bad} · {time.time() - t0:.0f}초 → {os.path.relpath(OUT, ROOT)}")
