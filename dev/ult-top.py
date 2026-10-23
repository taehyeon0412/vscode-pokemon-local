#!/usr/bin/env python3
"""필살기 연출이 위 끝 (정보줄 · 지도 줄) 뒤로 숨는지 훑기 (2026-10-23 orders #105 — 1:1 다이내믹풀플레임 구가 187 에서 정보줄 뒤로 던져짐)
  python dev/ult-top.py [창 수=6] [이름 걸러내기=]   → dev/shots/ult-top.json + 표 (콘솔)
  머리 없는 크롬 여러 개 (860 × 187 · 1:1 전투 화면 · 위 끝 = 3:3 장면 전환과 같은 지도 줄 아래 52px 로 맞춤) 에서 필살기마다 window.pokemonFx.ult(…, { entry }) 로 돌리며,
  연출 캔버스에 그려졌지만 위 끝에서 잘려 안 보이는 점 (위 끝 위 40px 띠 — 캔버스는 CSS 로만 잘려 그린 점은 남음) 넓이를 본편 (기 모으기 · 컷인 뒤) 동안 70ms 마다 잼.
  패널 폭 85% 넘게 칠한 줄은 뺌 (번쩍 · 어둠 같은 화면 판). 숨음 = 한 장면에 위 끝 위 점이 1500px² 넘고 그 장면 연출 점 (위 끝 위 띠 + 아래 무대) 의 60% 넘게
  (구 · 덩어리가 통째로 넘어감 — 다이내믹풀플레임 81 ~ 95% · 솔라빔 하늘 빛기둥처럼 위에서 들어오는 것은 약 40% 라 빠짐)
  고르는 필살기 = 전용 (fx-unique uniq · fx-sky 스타팅 특수 키) 전부 + 일반 필살기는 틀 · 옵션 (색 c 빼고) 이 같은 것끼리 하나씩
  TOP_REAL=1 = 실제 1:1 전투 화면 그대로 (위 끝 = 정보줄 아래 끝 · 내 칸 자리 그대로) · TOP_DUMP=<폴더> = 가장 많이 숨은 장면 캔버스 PNG · 이름 걸러내기는 쉼표로 여럿
  dev/ult-fx.py 의 창 · 페이지 도구를 씀"""
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

# PG_ROOT = 다른 폴더의 빌드로 잼 (main 견주기)
ROOT = os.environ.get("PG_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("ultfx", os.path.join(ROOT, "dev", "ult-fx.py"))
U = importlib.util.module_from_spec(spec)
_argv = sys.argv
sys.argv = [_argv[0]]
spec.loader.exec_module(U)
sys.argv = _argv
OUT = os.environ.get("TOP_OUT") or os.path.join(ROOT, "dev", "shots", "ult-top.json")
SPECIAL = ["uniq", "blast", "flare", "venus", "turtle", "ninja", "clones", "lucario", "mew", "mewtwo"]
# 3:3 장면 전환 187 의 위 끝 (정보줄 + 지도 줄 아래 끝)
TOP_PX = 52
BAND_PX = 40
HIDE_PX2 = 1500
HIDE_FRAC = 0.6
# 자리 — 860 × 187 · 쓰는 쪽 x · 대상 x
CFGS = {"L": (215, 625), "R": (625, 215)}
PICK = r"""
((special) => {
  const w = document.querySelector('iframe').contentWindow;
  const lib = w.__ult.lib();
  const out = {};
  const seen = new Set();
  for (const f of %FORMS%) for (const e of w.__ult.of(f) || []) {
    const i = lib.indexOf(e);
    const o = e[2] || {};
    const uniq = special.some((k) => o[k]);
    // 일반 필살기 — 틀 · 옵션 (색 빼고) 이 같으면 하나만
    const sig = uniq ? `u${i}` : JSON.stringify([e[1], Object.keys(o).filter((k) => k !== 'c').sort().map((k) => [k, o[k]])]);
    if (seen.has(sig)) continue;
    seen.add(sig);
    out[`${f}|${e[0]}|${e[1]}`] = [f, i, uniq ? 1 : 0];
  }
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
  // 위 끝을 3:3 장면 전환 값으로 고정 (1:1 BattleFx 가 그릴 때마다 정보줄 아래 끝으로 다시 씀) · real = 실제 1:1 전투 화면 그대로 (위 끝 · 자리 안 바꿈)
  if (!cfg.real && !w.__topPinned) {
    w.__topPinned = true;
    const sp = d.body.style.setProperty.bind(d.body.style);
    d.body.style.setProperty = (k, v, p) => sp(k, k === '--pg-fx-top' ? `${cfg.top}px` : v, p);
  }
  if (!cfg.real) d.body.style.setProperty('--pg-fx-top', `${cfg.top}px`);
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
  // 둘 다 땅 (패널 아래 − 14px) 에 — 3:3 장면 전환 1:1 자리처럼 (1:1 전투 화면은 내 칸이 위쪽이라 몸 둘레 연출까지 위 끝 뒤로 들어가 잘못 셈)
  for (const b of cfg.real ? [] : [meBox, foeBox]) {
    const r = b.getBoundingClientRect();
    b.style.top = `${Math.round(w.innerHeight - 14 - r.bottom)}px`;
  }
  const src = { el: meBox.querySelector('.pg-sprite'), box: meBox, form, size: 32, left: false, name: 'x' };
  const dst = { el: foeBox.querySelector('.pg-sprite'), box: foeBox, form: 'butterfree', size: 32, left: true };
  const t0 = w.performance.now();
  const total = fx.ult(src, dst, () => {}, [], { entry: lib[idx] });
  if (!total) return null;
  const W = w.innerWidth;
  const bar = d.querySelector('#pokemon-game .pg-infobar');
  const top = cfg.real ? Math.max(bar ? Math.round(bar.getBoundingClientRect().bottom) : 0, parseFloat(d.body.style.getPropertyValue('--pg-fx-top')) || 0) : cfg.top;
  // 위 끝 위 띠에 그려진 점 (화면 판 줄 — 폭 85% 넘게 칠한 줄 — 은 뺌) · 위 끝 바로 아래 띠도 (잘린 덩어리인지 — 아래로 이어짐)
  const painted = (ya, yb) => {
    let n = 0;
    for (const c of d.querySelectorAll('canvas')) {
      const r = c.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const y0 = Math.max(r.top, ya);
      const y1 = Math.min(r.bottom, yb);
      if (y1 - y0 < 1) continue;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) continue;
      const sx = c.width / r.width, sy = c.height / r.height;
      const cw = Math.round(W * sx);
      const ch = Math.max(1, Math.round((y1 - y0) * sy));
      const px = ctx.getImageData(Math.floor((0 - r.left) * sx), Math.floor((y0 - r.top) * sy), cw, ch).data;
      for (let y = 0; y < ch; y++) {
        let k = 0;
        for (let x = 0; x < cw; x++) {
          const i = (y * cw + x) * 4;
          if (px[i + 3] >= 96 && Math.max(px[i], px[i + 1], px[i + 2]) >= 48) k += 1;
        }
        if (k < cw * 0.85) n += k / (sx * sy);
      }
    }
    return n;
  };
  let most = 0, at = -1, frac = 0, peak = 0, img = null;
  while (w.performance.now() - t0 < Math.min(total, 15000)) {
    await new Promise((r) => w.setTimeout(r, 70));
    // 기 모으기 · 컷인 (번쩍 · 고리 · 이름 띠 — 모든 필살기 같음) 뒤 본편만
    if (w.performance.now() - t0 < cfg.lead) continue;
    const h = painted(top - cfg.band, top);
    peak = Math.max(peak, h);
    if (h < cfg.min) continue;
    const f = h / Math.max(1, h + painted(top, w.innerHeight));
    if (f > frac) {
      frac = f; most = h; at = Math.round(w.performance.now() - t0);
      if (cfg.dump) img = [...d.querySelectorAll('canvas')].filter((c) => c.width > 100).map((c) => c.toDataURL('image/png'));
    }
  }
  fx.clear();
  return { hid: Math.round(most), frac: +frac.toFixed(2), peak: Math.round(peak), at, total: Math.round(total), img };
})(%FORM%, %IDX%, %CFG%)
"""


def worker(k, n, out, filt):
    ws, p, httpd = U.browser_page()
    res = {}
    try:
        keys = None
        for _ in range(60):
            r = ws.call("Runtime.evaluate", {"expression": PICK.replace("%FORMS%", json.dumps(U.FORMS)).replace("%SPECIAL%", json.dumps(SPECIAL)), "returnByValue": True})
            keys = r.get("result", {}).get("value")
            if isinstance(keys, dict) and keys:
                break
            time.sleep(0.5)
        mine = [key for key in sorted(keys) if any(f in key for f in filt.split(','))][k::n]
        for key in mine:
            form, idx, uniq = keys[key]
            res[key] = {"uniq": uniq}
            for name, (mx, fxx) in CFGS.items():
                cfg = json.dumps({"meX": mx, "foeX": fxx, "top": TOP_PX, "band": BAND_PX, "lead": U.CHARGE_MS + U.INTRO_MS, "min": HIDE_PX2, "dump": bool(os.environ.get("TOP_DUMP")), "real": bool(os.environ.get("TOP_REAL"))})
                r = ws.call("Runtime.evaluate", {"expression": ONE.replace("%FORM%", json.dumps(form)).replace("%IDX%", str(idx)).replace("%CFG%", cfg), "awaitPromise": True, "returnByValue": True})
                v = r.get("result", {}).get("value")
                if v and v.get("img") and os.environ.get("TOP_DUMP"):
                    import base64
                    os.makedirs(os.environ["TOP_DUMP"], exist_ok=True)
                    for ci, url in enumerate(v["img"]):
                        open(os.path.join(os.environ["TOP_DUMP"], f"{form}_{idx}_{name}_{ci}.png"), "wb").write(base64.b64decode(url.split(",", 1)[1]))
                if v:
                    v.pop("img", None)
                res[key][name] = v
            json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False)
    finally:
        json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False)
        subprocess.run(["taskkill", "/PID", str(p.pid), "/T", "/F"], capture_output=True)
        httpd.shutdown()
        shutil.rmtree(getattr(U.browser_page, "prof", ""), ignore_errors=True)


def hid_of(row):
    """숨음 칸 — 1500px² 넘는 장면 중 가장 큰 비율 (자리 둘 중)"""
    return max(((row.get(name) or {}).get("frac", 0) for name in CFGS), default=0)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--worker":
        worker(int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5] if len(sys.argv) > 5 else "")
        sys.exit(0)
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 6
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
    bad = [(key, row) for key, row in merged.items() if hid_of(row) >= HIDE_FRAC]
    for key, row in sorted(bad, key=lambda kv: -hid_of(kv[1])):
        cells = " | ".join(f"{name} {(row.get(name) or {}).get('hid', '못 잼')}px² {round(100 * (row.get(name) or {}).get('frac', 0))}% @{(row.get(name) or {}).get('at', -1)}ms" for name in CFGS)
        print(("전용 " if row.get("uniq") else "일반 ") + key, "|", cells)
    nu = sum(1 for r in merged.values() if r.get("uniq"))
    bu = sum(1 for _, r in bad if r.get("uniq"))
    # 못 잰 것 (연출이 0 을 돌려줌 · 평가 오류) 은 통과로 세지 않고 따로 (코드 리뷰어 #105)
    miss = sorted(key for key, row in merged.items() if any(row.get(name) is None for name in CFGS))
    for key in miss:
        print("못 잼", key)
    print(f"전용 {nu} 중 숨음 {bu} · 일반 (틀 · 옵션 하나씩) {len(merged) - nu} 중 숨음 {len(bad) - bu} · 못 잼 {len(miss)} · {time.time() - t0:.0f}초 → {os.path.relpath(OUT, ROOT)}")
    sys.exit(1 if miss else 0)
