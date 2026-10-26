#!/usr/bin/env python3
"""기 모으는 구 · 원이 앞장 몸에서 벗어나는지 훑기 (2026-10-25 bugs 1799 — 태현 님 "리자몽이 있는 위치와 기를 모으는 원의 위치가 안맞잖아":
  187 에서 합동 블래스트번 모으는 점선 원 · 파란 불꽃 구가 메가리자몽X 보다 약 110 ~ 120px 대상 쪽 — fx-sky runBlastBurn orbAt 이 구만 몸 앞쪽으로 옮김)
  python dev/ult-orb.py [창 수=1] [이름 걸러내기=] [--joint] [h=187]   → dev/shots/ult-orb.json + 표 (콘솔) · 벗어남이 있으면 exit 1
  연출이 그리는 동안 pokemon.el.__orbProbe (또는 window.__pgOrbProbe) = { orb: [x, y], body: [x, y], w } (구 가운데 · 그때 그린 몸 가운데 · 몸 폭 — 화면 px) 를 매 장면 적으면
  40ms 마다 읽어 |구 − 몸| 가로 거리가 몸 폭 × 0.25 넘는 장면을 셈 (세로는 머리 위 · 몸 앞에 모으는 틀도 있어 보고만). 적지 않는 필살기는 "안 잼" 으로 따로.
  창 · 필살기 고르기 · 자리는 dev/ult-top.py 와 같음 (860 × 패널 높이 · 둘 다 땅) · 머리 없는 브라우저는 세션마다 2개까지 (PG_MAX_BROWSERS)"""
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

ROOT = os.environ.get("PG_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _load(name, file):
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, "dev", file))
    mod = importlib.util.module_from_spec(spec)
    argv = sys.argv
    sys.argv = [argv[0]]
    try:
        spec.loader.exec_module(mod)
    finally:
        sys.argv = argv
    return mod


U = _load("ultfx", "ult-fx.py")
T = _load("ulttop", "ult-top.py")
JOINT = "--joint" in sys.argv or os.environ.get("ORB_JOINT") == "1"
if JOINT:
    sys.argv = [a for a in sys.argv if a != "--joint"]
    os.environ["ORB_JOINT"] = "1"
OUT = os.environ.get("ORB_OUT") or os.path.join(ROOT, "dev", "shots", "ult-orb-joint.json" if JOINT else "ult-orb.json")
# 벗어남 = 가로 거리가 몸 폭의 이만큼 넘게 · 이만큼 넘게 이어지면 실패
OFF_FRAC = 0.25
OFF_MS = 200
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
  const place = (box, cx) => {
    box.style.marginLeft = '0px';
    const r = box.getBoundingClientRect();
    box.style.marginLeft = `${Math.round(cx - (r.left + r.width / 2))}px`;
  };
  place(meBox, cfg.meX);
  place(foeBox, cfg.foeX);
  for (const b of [meBox, foeBox]) {
    const r = b.getBoundingClientRect();
    b.style.top = `${Math.round(w.innerHeight - 14 - r.bottom)}px`;
  }
  const src = { el: meBox.querySelector('.pg-sprite'), box: meBox, form, size: 32, left: false, name: 'x' };
  const dst = { el: foeBox.querySelector('.pg-sprite'), box: foeBox, form: 'butterfree', size: 32, left: true };
  let entry = lib[idx];
  if (cfg.joint) {
    const o = entry[2] || {};
    const special = %SPECIAL%.some((k) => o[k]);
    const orbUlt = entry[1] === 'ultorb' && !o.sky && !special;
    const morph = (entry[1] === 'ultpillar' && !!(o.blast || o.venus)) || (entry[1] === 'ultorb' && !!o.turtle);
    entry = [entry[0], entry[1], { ...o, track: { half: true, extraG: orbUlt || morph ? 1 : 0, willMorph: morph } }];
  }
  w.__pgOrbProbe = null;
  src.el.__orbProbe = null;
  const t0 = w.performance.now();
  const total = fx.ult(src, dst, () => {}, [], { entry });
  if (!total) return null;
  let seen = 0, off = 0, run = 0, runAt = -1, worst = 0, worstAt = -1, maxDy = 0, prev = null;
  while (w.performance.now() - t0 < total) {
    await new Promise((r) => w.setTimeout(r, 40));
    const ms = Math.round(w.performance.now() - t0 - cfg.lead);
    // 고리 = 쓰는 그림 (pokemon.el) 의 __orbProbe (디자인 runBlastBurn) 또는 window.__pgOrbProbe
    const p = src.el.__orbProbe || w.__pgOrbProbe;
    src.el.__orbProbe = null;
    w.__pgOrbProbe = null;
    if (!p || !p.orb || !p.body || !(p.w > 0)) { prev = null; continue; }
    seen += 1;
    const dx = Math.abs(p.orb[0] - p.body[0]) / p.w;
    maxDy = Math.max(maxDy, Math.abs(p.orb[1] - p.body[1]) / p.w);
    if (dx > cfg.frac) {
      if (prev === null) runAt = ms;
      run = ms - runAt;
      prev = ms;
      off = Math.max(off, run);
      if (dx > worst) { worst = dx; worstAt = ms; }
    } else {
      prev = null;
      run = 0;
    }
  }
  fx.clear();
  return { seen, off, worst: +worst.toFixed(2), worstAt, maxDy: +maxDy.toFixed(2), total: Math.round(total - cfg.lead) };
})(%FORM%, %IDX%, %CFG%)
"""


def worker(k, n, out, filt, h):
    ws, p, httpd = U.browser_page()
    res = {}
    try:
        # 패널 높이 — 기본 187 (태현 님 화면 · 3:3 장면 전환)
        ws.call("Emulation.setDeviceMetricsOverride", {"width": 860, "height": h, "deviceScaleFactor": 1, "mobile": False})
        keys = None
        for _ in range(60):
            r = ws.call("Runtime.evaluate", {"expression": T.PICK.replace("%FORMS%", json.dumps(U.FORMS)).replace("%SPECIAL%", json.dumps(T.SPECIAL)), "returnByValue": True})
            keys = r.get("result", {}).get("value")
            if isinstance(keys, dict) and keys:
                break
            time.sleep(0.5)
        mine = [key for key in sorted(keys) if any(f in key for f in filt.split(','))][k::n]
        for key in mine:
            form, idx, uniq, sig = keys[key]
            res[key] = {"uniq": uniq, "sig": sig}
            for name, (mx, fxx) in T.CFGS.items():
                cfg = json.dumps({"meX": mx, "foeX": fxx, "lead": U.CHARGE_MS + U.INTRO_MS, "joint": JOINT, "frac": OFF_FRAC})
                r = ws.call("Runtime.evaluate", {"expression": ONE.replace("%FORM%", json.dumps(form)).replace("%IDX%", str(idx)).replace("%CFG%", cfg).replace("%SPECIAL%", json.dumps(T.SPECIAL)), "awaitPromise": True, "returnByValue": True})
                res[key][name] = r.get("result", {}).get("value")
            json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False)
    finally:
        json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False)
        U.kill_browser(p)
        httpd.shutdown()
        shutil.rmtree(getattr(U.browser_page, "prof", ""), ignore_errors=True)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--worker":
        worker(int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5] if len(sys.argv) > 5 else "", int(sys.argv[6]) if len(sys.argv) > 6 else 187)
        sys.exit(0)
    hs = [a for a in sys.argv[1:] if a.startswith("h=")]
    h = int(hs[0][2:]) if hs else 187
    args = [a for a in sys.argv[1:] if not a.startswith("h=")]
    t0 = time.time()
    n = min(int(args[0]) if args else 1, int(os.environ.get("PG_MAX_BROWSERS", 2)))
    filt = args[1] if len(args) > 1 else ""
    tmp = tempfile.mkdtemp()
    procs = [subprocess.Popen([sys.executable, __file__, "--worker", str(k), str(n), os.path.join(tmp, f"w{k}.json"), filt, str(h)]) for k in range(n)]
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
    off = lambda row: max(((row.get(nm) or {}).get("off", 0) for nm in T.CFGS), default=0)
    seen = lambda row: max(((row.get(nm) or {}).get("seen", 0) for nm in T.CFGS), default=0)
    bad = sorted(((k, r) for k, r in merged.items() if off(r) > OFF_MS), key=lambda kv: -off(kv[1]))
    for key, row in bad:
        cells = " | ".join(f"{nm} 벗어남 {(row.get(nm) or {}).get('off', 0)}ms · 가장 큼 몸 폭 × {(row.get(nm) or {}).get('worst', 0)} @{(row.get(nm) or {}).get('worstAt', -1)}" for nm in T.CFGS)
        print(key, "|", cells)
    unprobed = sorted(k for k, r in merged.items() if seen(r) == 0)
    print(f"{'합동 (o.track) · ' if JOINT else ''}860 × {h} · 구 · 원이 몸에서 가로 몸 폭 × {OFF_FRAC} 넘게 {OFF_MS}ms 넘게 벗어남 {len(bad)} · 잰 것 {len(merged) - len(unprobed)} · 안 잼 (__orbProbe 없음) {len(unprobed)} · {time.time() - t0:.0f}초 → {os.path.relpath(OUT, ROOT)}")
    sys.exit(1 if bad else 0)
