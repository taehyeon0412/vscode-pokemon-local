#!/usr/bin/env python3
"""필살기 연출이 맞는 포켓몬 (대상) 을 오래 가리는지 훑기 (2026-10-25 #107 — 기획: 플레어 불기둥 · 하이드로캐논 물기둥 · 하드플랜트 덩굴이 860 에서 대상을 1.2 ~ 2.9초 가림)
  python dev/ult-cover.py [창 수=2] [이름 걸러내기=] [--joint]   → dev/shots/ult-cover.json + 표 (콘솔)
  dev/ult-top.py 와 같은 창 · 같은 필살기 고르기 (전용 전부 + 일반은 틀 · 옵션 하나씩) · 같은 자리 (860 × 187 · 쓰는 쪽 215 / 대상 625 와 거꾸로 · 둘 다 땅).
  40ms 마다 대상 그림 칸 (발 쪽 아래 1/8 뺌 — 바닥 불 띠가 발만 덮는 것은 가림이 아님) 안에 연출 캔버스가 짙게 칠한 점 (불투명 160 넘게 · 어둡지 않음) 의 비율을 재고,
  그 비율이 60% 넘게 이어진 가장 긴 구간 (ms) 을 적음. 어두워짐 · 화면 번쩍 판은 그리지 않고 잼 (window.__fxMeasure — ult-fx.py 와 같음).
  가림 0.5초 넘게 = 표에 (ux-rules U1 "다음 연출이 그 순간을 가리지 않는다") — 고칠 곳은 크기를 0.6배 아래로 줄이지 않고 대상을 연출 위에 다시 그리기 (bridge fxOnTop · 기획 10-25)
  --report <json> = 다시 돌리지 않고 저장된 결과로 셈 · 머리 없는 브라우저는 세션마다 2개까지 (PG_MAX_BROWSERS 로만 늘림)
  대상 다시 그리기 (bridge fxCoverRedraw) 가 그 대상을 연출 맨 위에 그리는 동안은 가림 0 으로 셈 (다시 그린 그림이 칸을 채워 가림으로 잡히지 않게)
  --data = 다시 그리기를 끄고 재서 가림 구간 (0.3초 넘는 것 모두) 을 적음 → --write-data 로 ult/ult-cover.json (1:1 = dev/shots/ult-cover.json · 합동 = ult-cover-joint.json 을 합침) →
  make-moves.py 가 묶음에 ULT_COVER 로 넣음 (열쇠 = 틀 · 옵션 — 색 · track 빼고, 값 = { o: 1:1 구간, j: 합동 구간 } · 구간 = [본편 시작부터 ms, 길이])"""
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
JOINT = "--joint" in sys.argv or os.environ.get("COVER_JOINT") == "1"
if JOINT:
    sys.argv = [a for a in sys.argv if a != "--joint"]
    os.environ["COVER_JOINT"] = "1"  # 일꾼 (--worker) 에게도
OUT = os.environ.get("COVER_OUT") or os.path.join(ROOT, "dev", "shots", "ult-cover-joint.json" if JOINT else "ult-cover.json")
# 가림 = 대상 칸의 이만큼 넘게 짙은 연출 점 · 이만큼 넘게 이어지면 표에
COVER_FRAC = 0.6
COVER_MS = 500
SAMPLE_MS = 40
# --data — 이만큼 넘는 가림 구간은 모두 적음 (0.5초 기준보다 짧게 — 패널 폭마다 조금 길어지는 것까지)
RUN_MS = 300
DATA = "--data" in sys.argv or os.environ.get("COVER_DATA") == "1"
if DATA:
    sys.argv = [a for a in sys.argv if a != "--data"]
    os.environ["COVER_DATA"] = "1"
DATA_OUT = os.path.join(ROOT, "ult", "ult-cover.json")
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
    // 3:3 장면 전환 합동처럼 — bridge team11Joint 와 같은 규칙 (ult-top.py 와 같음)
    const o = entry[2] || {};
    const special = %SPECIAL%.some((k) => o[k]);
    const orbUlt = entry[1] === 'ultorb' && !o.sky && !special;
    const morph = (entry[1] === 'ultpillar' && !!(o.blast || o.venus)) || (entry[1] === 'ultorb' && !!o.turtle);
    entry = [entry[0], entry[1], { ...o, track: { half: true, extraG: orbUlt || morph ? 1 : 0, willMorph: morph } }];
  }
  w.__fxMeasure = true;
  // --data = 대상 다시 그리기를 끄고 잼 (가림 구간 데이터 만들기)
  w.__fxNoCoverRedraw = !!cfg.data;
  // 열쇠 = 틀 · 옵션 (색 · track 빼고) — bridge fxCoverSig 와 같음
  const o0 = lib[idx][2] || {};
  const csig = JSON.stringify([lib[idx][1], Object.keys(o0).filter((k) => k !== 'c' && k !== 'track').sort().map((k) => [k, o0[k]])]);
  const t0 = w.performance.now();
  const total = fx.ult(src, dst, () => {}, [], { entry });
  if (!total) {
    w.__fxMeasure = false;
    return null;
  }
  // 대상 그림 칸 (그때그때 — 밀려남 · 쓰러짐을 따라감) 안 짙은 점 비율
  const cover = () => {
    // 대상 다시 그리기가 맨 위에 그리는 동안 = 보임 (bridge 가 칸 상자에 적음)
    if ((dst.box.__fxRedrawUntil || 0) > w.performance.now()) return 0;
    const sr = dst.el.getBoundingClientRect();
    if (sr.width < 2 || sr.height < 2) return 0;
    const cell = [sr.left, sr.top, sr.right, sr.bottom - sr.height / 8];
    const area = Math.max(1, (cell[2] - cell[0]) * (cell[3] - cell[1]));
    let n = 0;
    for (const c of d.querySelectorAll('canvas')) {
      const r = c.getBoundingClientRect();
      const x0 = Math.max(cell[0], r.left), y0 = Math.max(cell[1], r.top);
      const x1 = Math.min(cell[2], r.right), y1 = Math.min(cell[3], r.bottom);
      if (x1 - x0 < 1 || y1 - y0 < 1 || !r.width || !r.height) continue;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) continue;
      const sx = c.width / r.width, sy = c.height / r.height;
      const px = ctx.getImageData(Math.floor((x0 - r.left) * sx), Math.floor((y0 - r.top) * sy), Math.max(1, Math.round((x1 - x0) * sx)), Math.max(1, Math.round((y1 - y0) * sy))).data;
      let k = 0;
      for (let i = 0; i < px.length; i += 4) if (px[i + 3] >= 160 && Math.max(px[i], px[i + 1], px[i + 2]) >= 48) k += 1;
      n += k / (sx * sy);
    }
    return Math.min(1, n / area);
  };
  const lead = cfg.lead;
  let run = 0, runAt = -1, best = 0, bestAt = -1, prev = null, peak = 0;
  const runs = [];
  while (w.performance.now() - t0 < total) {
    await new Promise((r) => w.setTimeout(r, cfg.sample));
    const ms = Math.round(w.performance.now() - t0 - lead);
    const f = cover();
    peak = Math.max(peak, f);
    if (f >= cfg.frac) {
      if (prev === null) { runAt = ms; prev = ms; }
      run = ms - runAt;
      prev = ms;
      if (run > best) { best = run; bestAt = runAt; }
    } else {
      if (prev !== null && run >= cfg.runMs) runs.push([runAt, run]);
      prev = null;
      run = 0;
    }
  }
  if (prev !== null && run >= cfg.runMs) runs.push([runAt, run]);
  w.__fxMeasure = false;
  w.__fxNoCoverRedraw = false;
  fx.clear();
  return { cover: best, at: bestAt, peak: +peak.toFixed(2), total: Math.round(total - lead), runs, csig };
})(%FORM%, %IDX%, %CFG%)
"""


def worker(k, n, out, filt):
    ws, p, httpd = U.browser_page()
    res = {}
    try:
        keys = None
        for _ in range(60):
            r = ws.call("Runtime.evaluate", {"expression": T.PICK.replace("%FORMS%", json.dumps(U.FORMS)).replace("%SPECIAL%", json.dumps(T.SPECIAL)), "returnByValue": True})
            keys = r.get("result", {}).get("value")
            if isinstance(keys, dict) and keys:
                break
            time.sleep(0.5)
        # COVER_SKIP=1 = 이미 잰 줄은 건너뜀 (--data 를 멈춘 데서 이어 재기 — 결과 파일에 runs 가 있는 줄)
        done = set()
        if os.environ.get("COVER_SKIP") == "1" and os.path.exists(OUT):
            done = {key for key, row in json.load(open(OUT, encoding="utf-8")).items() if all((row.get(nm) or {}).get("runs") is not None for nm in T.CFGS)}
        mine = [key for key in sorted(keys) if any(f in key for f in filt.split(',')) and key not in done][k::n]
        for key in mine:
            form, idx, uniq, sig = keys[key]
            res[key] = {"uniq": uniq, "sig": sig}
            for name, (mx, fxx) in T.CFGS.items():
                cfg = json.dumps({"meX": mx, "foeX": fxx, "lead": U.CHARGE_MS + U.INTRO_MS, "joint": JOINT, "frac": COVER_FRAC, "sample": SAMPLE_MS, "data": DATA, "runMs": RUN_MS})
                r = ws.call("Runtime.evaluate", {"expression": ONE.replace("%FORM%", json.dumps(form)).replace("%IDX%", str(idx)).replace("%CFG%", cfg).replace("%SPECIAL%", json.dumps(T.SPECIAL)), "awaitPromise": True, "returnByValue": True})
                res[key][name] = r.get("result", {}).get("value")
            json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False)
    finally:
        json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False)
        U.kill_browser(p)
        httpd.shutdown()
        shutil.rmtree(getattr(U.browser_page, "prof", ""), ignore_errors=True)


def spans_of(row):
    """가림 구간 [시작, 끝] ms — 자리 둘 (L · R) 을 합치고 겹치거나 붙은 것 (0.2초 안) 은 하나로"""
    out = []
    for a, n in sorted(r for name in T.CFGS for r in ((row.get(name) or {}).get("runs") or [])):
        if out and a <= out[-1][1] + 200:
            out[-1][1] = max(out[-1][1], a + n)
        else:
            out.append([a, a + n])
    return out


def write_data():
    """dev/shots/ult-cover.json (1:1) · ult-cover-joint.json (합동) 의 --data 결과를 ult/ult-cover.json { 열쇠: { o: [[시작, 길이] …], j: […] } } 에 덮어 합침 —
    잰 열쇠 · 모드만 바꾸고 (가림이 없어졌으면 지움) 안 잰 것은 그대로 (다른 워크트리에서 한 줄만 다시 재도 나머지가 지워지지 않게)"""
    data = json.load(open(DATA_OUT, encoding="utf-8")) if os.path.exists(DATA_OUT) else {}
    for mode, f in (("o", "ult-cover.json"), ("j", "ult-cover-joint.json")):
        path = os.path.join(ROOT, "dev", "shots", f)
        if not os.path.exists(path):
            continue
        seen = {}
        for row in json.load(open(path, encoding="utf-8")).values():
            sig = next(((row.get(name) or {}).get("csig") for name in T.CFGS if (row.get(name) or {}).get("csig")), None)
            if not sig or any((row.get(name) or {}).get("runs") is None for name in T.CFGS):
                continue
            # 같은 열쇠 (일반 틀 — 대표 하나) 가 둘이면 합침
            merged = seen.setdefault(sig, [])
            allsp = sorted(merged + spans_of(row))
            out = []
            for a, b in allsp:
                if out and a <= out[-1][1] + 200:
                    out[-1][1] = max(out[-1][1], b)
                else:
                    out.append([a, b])
            seen[sig] = out
        for sig, spans in seen.items():
            if spans:
                data.setdefault(sig, {})[mode] = [[a, b - a] for a, b in spans]
            elif sig in data:
                data[sig].pop(mode, None)
                if not data[sig]:
                    del data[sig]
    json.dump(dict(sorted(data.items())), open(DATA_OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    return data


def cover_of(row):
    """가림 (ms) — 자리 둘 중 긴 것"""
    return max(((row.get(name) or {}).get("cover", 0) for name in T.CFGS), default=0)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--worker":
        worker(int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5] if len(sys.argv) > 5 else "")
        sys.exit(0)
    if "--write-data" in sys.argv:
        d = write_data()
        sys.stdout.reconfigure(encoding="utf-8")
        print(f"가림 구간 {len(d)}개 (1:1 {sum(1 for v in d.values() if 'o' in v)} · 합동 {sum(1 for v in d.values() if 'j' in v)}) → {os.path.relpath(DATA_OUT, ROOT)}")
        sys.exit(0)
    args = list(sys.argv[1:])
    report = args[args.index("--report") + 1] if "--report" in args else None
    if report:
        args = [a for a in args if a not in ("--report", report)]
    t0 = time.time()
    if report:
        merged = json.load(open(report, encoding="utf-8"))
    else:
        n = min(int(args[0]) if args else 2, int(os.environ.get("PG_MAX_BROWSERS", 2)))
        filt = args[1] if len(args) > 1 else ""
        tmp = tempfile.mkdtemp()
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
        # --data 를 걸러서 다시 재면 (고친 필살기만) 앞 결과에 덮어 합침 — --write-data 가 모두를 씀
        keep = json.load(open(OUT, encoding="utf-8")) if DATA and os.path.exists(OUT) else {}
        json.dump(dict(sorted({**keep, **merged}.items())), open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    sys.stdout.reconfigure(encoding="utf-8")
    bad = sorted(((key, row) for key, row in merged.items() if cover_of(row) > COVER_MS), key=lambda kv: -cover_of(kv[1]))
    for key, row in bad:
        cells = " | ".join(f"{name} 가림 {(row.get(name) or {}).get('cover', '못 잼')}ms @{(row.get(name) or {}).get('at', -1)} · 가장 짙음 {round(100 * (row.get(name) or {}).get('peak', 0))}%" for name in T.CFGS)
        print(("전용 " if row.get("uniq") else "일반 ") + key, "|", cells)
    miss = sorted(key for key, row in merged.items() if any(row.get(name) is None for name in T.CFGS))
    for key in miss:
        print("못 잼", key)
    nu = sum(1 for r in merged.values() if r.get("uniq"))
    bu = sum(1 for _, r in bad if r.get("uniq"))
    print(f"{'합동 (o.track) · ' if JOINT else ''}대상 가림 {COVER_MS}ms 넘게 (칸 {round(COVER_FRAC * 100)}% 넘게 짙은 점) — 전용 {nu} 중 {bu} · 일반 {len(merged) - nu} 중 {len(bad) - bu} · 못 잼 {len(miss)} · {time.time() - t0:.0f}초 → {os.path.relpath(OUT, ROOT)}")
