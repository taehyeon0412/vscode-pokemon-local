"""게임 성능 재기 (orders #139 · #140 최적화 — 2026-10-30): team-run 판을 검사 · 연속 캡처 없이 돌려 프레임 · 멈칫 · 그리기 수 · 메모리 · 켜기 시간을 잼
  PG_ROOT=<잴 빌드 폴더> python dev/perf-run.py <out_dir> [file=dev/perf-runs.json] [from=1] [to=N] [rep=3] [dpr=1.5] [gpu=1] [draws=1] [trace=0]
  rep    판마다 몇 번 (가운데 값을 표에 — 기획 #140 "3번 재서 가운데")
  dpr    화면 배율 (태현 님 윈도우 1.5 · 맥 2) · gpu 1 = GPU 켬 (VS Code 처럼 — 0 이면 지금까지 찍던 시험 창 · 멈칫이 안 보임, #139)
  draws  1 = 한 번 더 돌려 프레임마다 캔버스 그리기 수를 셈 (세는 동안은 느려져 시간 지표엔 안 씀)
  trace  1 = CDP Tracing (devtools.timeline · v8.gc) 을 <판>/trace.jsonl 로 (크다 — 원인 찾을 때만)
  잴 빌드: PG_ROOT 의 dev/ · extension/media 를 띄움 (도구는 늘 이 파일 옆 team-run.py) — 기준 판 = dev/perf-base.md 의 해시
결과: <out>/<판>/r<k>/perf.json · <out>/summary.json · <out>/summary.md (판마다 가운데 값 표)
지표: 50ms 넘는 멈칫 수 · 가장 긴 프레임 ms · 평균 프레임 ms · 1초 장 수 (평균 · 가장 나쁜 1%) · 그리기 수 (평균 · 최대) · JS 힙 · 캔버스 · 그림 · 렌더러 · GPU 프로세스 메모리 · 켜기 (불러옴 → 게임 손잡이) ms
끝나면 브라우저는 team-run 이 PID 로 끔 (판마다 dev/cleanup.py 로 0 확인 — 배율 글을 넣는 Popen 바꾸기는 브라우저 실행 파일일 때만, 10-30 5묶음이 안 꺼지던 것)"""
import base64
import importlib.util
import json
import os
import statistics
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
argv = sys.argv[1:]
sys.argv = [sys.argv[0]]
spec = importlib.util.spec_from_file_location("tr", os.path.join(HERE, "team-run.py"))
tr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tr)

if not argv:
    print(__doc__)
    sys.exit(0)
out_root = argv[0]
kv = dict(a.split("=", 1) for a in argv[1:] if "=" in a)
REP = int(kv.get("rep", 3))
DPR = float(kv.get("dpr", "1.5"))
GPU = kv.get("gpu", "1") == "1"
DRAWS = kv.get("draws", "1") == "1"
TRACE = kv.get("trace", "0") == "1"
CATS = "toplevel,devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,v8,disabled-by-default-v8.gc,blink.user_timing"
# prof=1 — JS 표본 (함수마다 걸린 시간 — 무엇이 메인 스레드를 쓰나)
if kv.get("prof", "0") == "1":
    CATS += ",disabled-by-default-v8.cpu_profiler"

# 검사기 대신 가벼운 기록기 — 장면 · 프레임 사이 (rAF 시각 = 진짜 시계) 모두 · 긴 일 · 힙 · 켜기 (탐색 시작 → 기록기 = 게임 손잡이가 뜬 뒤)
LIGHT = r"""
(() => {
  if (window.__tr) return 'again';
  const t0 = Date.now();
  const K = { phases: [], texts: {}, clip: {}, overlap: {}, cover: {}, straddle: [], hidden: [], down: {}, koText: {}, dts: [], long: [], heap: [], views: [], boot: Math.round(Date.now() - performance.timeOrigin) };
  let lastPhase = '', lastView = '';
  const tick = () => {
    const now = Date.now() - t0;
    const d = window.__pgDebug; const st = d && d.state();
    const ph = st ? (st.runtime.stage ? st.runtime.stage.phase : 'walk') + (st.runtime.stage && st.runtime.stage.phase === 'team' ? ':' + st.runtime.stage.team.phase : st.runtime.stage && st.runtime.stage.phase === 'battle' ? ':' + st.runtime.stage.battle.phase : '') : '?';
    if (ph !== lastPhase) { K.phases.push([now, ph]); lastPhase = ph; }
    const v = d && d.view ? d.view() : null;
    const vk = v ? v.kind + ':' + v.side + ':' + v.phase : '';
    if (vk !== lastView) { K.views.push([now, vk]); lastView = vk; try { performance.mark('pg-view:' + (vk || '-')); } catch (e) {} }
    if (ph !== K.markPh) { K.markPh = ph; try { performance.mark('pg-phase:' + ph); } catch (e) {} }
  };
  const id = setInterval(() => { try { tick(); } catch (e) { K.err = String(e); } }, 100);
  let prev = 0;
  const loop = (t) => { if (prev) K.dts.push([Date.now() - t0, Math.round((t - prev) * 10) / 10]); prev = t; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => K.long.push([Math.round(Date.now() - t0 - (performance.now() - e.startTime)), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true }); } catch (e) { K.longErr = String(e); }
  const mem = () => {
    const m = performance.memory;
    let cv = 0, img = 0;
    for (const c of document.querySelectorAll('canvas')) cv += c.width * c.height * 4;
    for (const i of document.querySelectorAll('img')) if (i.complete) img += (i.naturalWidth || 0) * (i.naturalHeight || 0) * 4;
    K.heap.push([Date.now() - t0, m ? Math.round(m.usedJSHeapSize / 1048576 * 10) / 10 : null, Math.round(cv / 1048576 * 10) / 10, Math.round(img / 1048576 * 10) / 10]);
  };
  const hid = setInterval(mem, 1000);
  // 그림을 그리는 GPU (머리 없는 브라우저가 진짜 그래픽 카드인지 · SwiftShader (CPU 흉내) 인지 — 큰 칠하기 값이 크게 달라짐)
  try { const g = document.createElement('canvas').getContext('webgl'); const x = g && g.getExtension('WEBGL_debug_renderer_info'); K.gl = g ? (x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER)) : 'webgl 없음'; } catch (e) { K.gl = String(e); }
  window.__tr = { K, t0, stop: () => { clearInterval(id); clearInterval(hid); mem(); return K; }, fx: () => [] };
  return 'ok';
})()
"""
# 그리기 셈 — 프레임마다 그린 수 (fillRect · fill · stroke · drawImage · 글 · putImageData · clearRect)
DRAWJS = r"""(() => {
  if (window.__dc) return 'again';
  const P = CanvasRenderingContext2D.prototype;
  const c = window.__dc = { cur: 0, frames: [] };
  for (const n of ['fillRect', 'strokeRect', 'clearRect', 'fill', 'stroke', 'drawImage', 'fillText', 'strokeText', 'putImageData']) {
    const f = P[n];
    P[n] = function (...a) { c.cur++; return f.apply(this, a); };
  }
  const loop = () => { c.frames.push(c.cur); c.cur = 0; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  return 'ok';
})()"""
DRAWDUMP = r"""(() => JSON.stringify((window.__dc || { frames: [] }).frames))()"""
def _png1():
    import io
    from PIL import Image
    b = io.BytesIO()
    Image.new("RGB", (1, 1)).save(b, "PNG")
    return base64.b64encode(b.getvalue()).decode()


PNG1 = _png1()

tr.COLLECT = LIGHT
tr.lum_series = lambda out: []
_orig_call = tr.WS.call
_orig_recv = tr.WS.recv
_orig_popen = subprocess.Popen
W = "document.getElementById('f').contentWindow"
state = {"draws": False, "dc": None, "shot": 0.0, "trace": None, "tracing": False, "done": False, "out": None, "nav": None, "tag": None, "proc": None}


def recv(self):
    m = _orig_recv(self)
    meth = m.get("method")
    if meth == "Tracing.dataCollected" and state["trace"]:
        for e in m["params"]["value"]:
            state["trace"].write(json.dumps(e) + "\n")
    elif meth == "Tracing.tracingComplete":
        state["done"] = True
    return m


def proc_mem():
    """이 판 브라우저 (임시 프로필 글이 명령줄에 든 msedge) 의 렌더러 · GPU · 전체 사설 메모리 MB"""
    tag = state["tag"]
    if not tag:
        return None
    # 종류만 (renderer · gpu-process · browser) — 명령줄을 그대로 내면 사용자 폴더 한글이 cp949 로 깨져 stdout 이 None (10-30)
    ps = ("Get-CimInstance Win32_Process -Filter \"Name='msedge.exe' OR Name='chrome.exe'\" | Where-Object { $_.CommandLine -like '*" + tag + "*' } | "
          "ForEach-Object { $k = 'browser'; if ($_.CommandLine -match '--type=([a-z-]+)') { $k = $matches[1] }; '{0}|{1}' -f $_.PrivatePageCount, $k }")
    q = subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True, encoding="utf-8", errors="replace")
    out = {"renderer": 0.0, "gpu": 0.0, "all": 0.0}
    for line in q.stdout.splitlines():
        if "|" not in line:
            continue
        b, kind = line.split("|", 1)
        mb = int(b) / 1048576
        out["all"] += mb
        if kind == "renderer":
            out["renderer"] += mb
        elif kind == "gpu-process":
            out["gpu"] += mb
    return {k: round(v, 1) for k, v in out.items()}


def call(self, method, params=None):
    if method == "Page.captureScreenshot":
        # 1초에 한 장만 진짜로 (찍기가 프레임을 흔들지 않게) — 나머지는 1 × 1 빈 그림
        # 진짜로 안 찍음 — GPU 켬에서 찍기가 가끔 30초 안에 안 돌아와 판이 깨지고 (10-30 그리기 셈 넷 중 셋 · 3인 합동 둘 다) 찍기 자체가 프레임을 흔듦. 퀄리티 그림은 따로 (같은 순간 찍기)
        if True:
            return {"data": PNG1}
        state["shot"] = time.time()
    if method == "Emulation.setDeviceMetricsOverride":
        params = {**(params or {}), "deviceScaleFactor": DPR}
    if method == "Page.navigate":
        state["nav"] = time.time()
    if method == "Runtime.evaluate":
        ex = (params or {}).get("expression", "")
        if "__tr ? " in ex and ".stop()" in ex:
            # 끝 — 메모리 (기록기를 멈추기 전 · 같은 때) · Tracing 끝
            state["mem"] = proc_mem()
            if state["draws"]:
                r = _orig_call(self, "Runtime.evaluate", {"expression": f"{W}.eval({json.dumps(DRAWDUMP)})", "returnByValue": True})
                state["dc"] = r.get("result", {}).get("value")
            if state["tracing"]:
                _orig_call(self, "Tracing.end")
                t_end = time.time() + 60
                while not state["done"] and time.time() < t_end:
                    self.recv()
                state["tracing"] = False
                state["trace"].close()
                state["trace"] = None
        elif json.dumps(LIGHT)[:40] in ex:
            r = _orig_call(self, method, params)
            state["ready"] = time.time()
            if state["draws"]:
                _orig_call(self, "Runtime.evaluate", {"expression": f"{W}.eval({json.dumps(DRAWJS)})", "returnByValue": True})
            if TRACE and not state["tracing"]:
                state["trace"] = open(os.path.join(state["out"], "trace.jsonl"), "w", encoding="utf-8")
                state["done"] = False
                _orig_call(self, "Tracing.start", {"categories": CATS, "transferMode": "ReportEvents"})
                state["tracing"] = True
            return r
    return _orig_call(self, method, params)


def popen(args, *a, **k):
    # 브라우저 띄우기만 바꿈 (taskkill · powershell 은 그대로 — 바꾸면 브라우저가 안 꺼짐, 10-30)
    if isinstance(args, list) and args and os.path.basename(str(args[0])).lower() in ("msedge.exe", "chrome.exe"):
        if GPU:
            args = [x for x in args if x != "--disable-gpu"]
        if DPR != 1:
            args = args[:1] + [f"--force-device-scale-factor={DPR}"] + args[1:]
        state["tag"] = next((os.path.basename(x.split("=", 1)[1]) for x in args if str(x).startswith("--user-data-dir=")), None)
    return _orig_popen(args, *a, **k)


tr.WS.recv = recv
tr.WS.call = call
tr.subprocess.Popen = popen


def pct(xs, p):
    if not xs:
        return 0
    s = sorted(xs)
    return s[min(len(s) - 1, int(len(s) * p))]


def metrics(K):
    dts = [d for _, d in K.get("dts", [])]
    if not dts:
        return {}
    # 판이 시작된 뒤 (불러오기 첫 1초는 뺌 — 켜기는 따로)
    dts = [d for t, d in K["dts"] if t > 1000]
    fps = [1000 / d for d in dts if d > 0]
    heap = K.get("heap") or []
    return {
        "frames": len(dts),
        "stall50": sum(1 for d in dts if d > 50),
        "stall100": sum(1 for d in dts if d > 100),
        "max_ms": round(max(dts), 1),
        "avg_ms": round(statistics.mean(dts), 2),
        "fps_avg": round(statistics.mean(fps), 1),
        "fps_low1": round(1000 / pct(dts, 0.99), 1),
        "long_tasks": len(K.get("long") or []),
        "heap_mb": max((h[1] or 0) for h in heap) if heap else None,
        "canvas_mb": max(h[2] for h in heap) if heap else None,
        "img_mb": max(h[3] for h in heap) if heap else None,
        "boot_ms": K.get("boot"),
    }


MSAMP_S = float(kv.get("msamp", "3"))


def sampler(stop, rows, t0):
    """프로세스 메모리 (렌더러 · GPU · 전체) 를 몇 초마다 — 판 끝 한 번이 아니라 흐름으로 (4/5 메모리 · 30분 켜 두기)"""
    while not stop.wait(MSAMP_S):
        m = proc_mem()
        if m and m.get("all"):
            rows.append([round(time.time() - t0, 1), m["renderer"], m["gpu"], m["all"]])


def run(cfg, out, draws=False):
    os.makedirs(out, exist_ok=True)
    state.update(out=out, shot=0.0, mem=None, draws=draws, dc=None)
    import threading
    stop, rows = threading.Event(), []
    th = threading.Thread(target=sampler, args=(stop, rows, time.time()), daemon=True)
    th.start()
    try:
        tr.run_one(out, dict(cfg))
    finally:
        stop.set()
        th.join(timeout=10)
    K = json.load(open(os.path.join(out, "raw.json"), encoding="utf-8"))["K"]
    m = metrics(K)
    m["gl"] = K.get("gl")
    m["mem"] = state.get("mem")
    if rows:
        m["mem_max"] = {"renderer": max(r[1] for r in rows), "gpu": max(r[2] for r in rows), "all": max(r[3] for r in rows)}
        m["msamp"] = rows
    if draws:
        fr = json.loads(state["dc"]) if isinstance(state.get("dc"), str) else []
        fr = [n for n in fr if n > 0]
        m = {"draw_avg": round(statistics.mean(fr), 1) if fr else 0, "draw_max": max(fr) if fr else 0}
    json.dump({"cfg": cfg, "m": m, "views": K.get("views"), "phases": K.get("phases"), "long": K.get("long"), "stalls": [x for x in K.get("dts", []) if x[1] > 50]}, open(os.path.join(out, "perf.json"), "w", encoding="utf-8"), ensure_ascii=False)
    return m


def cleanup_check():
    q = subprocess.run([sys.executable, os.path.join(HERE, "cleanup.py")], capture_output=True, text=True, encoding="utf-8", errors="replace")
    line = next((l for l in q.stdout.splitlines() if "머리 없는 브라우저" in l), "")
    return line.strip()


def main():
    runs = json.load(open(kv.get("file", os.path.join(HERE, "perf-runs.json")), encoding="utf-8"))["runs"]
    start, to = int(kv.get("from", 1)), int(kv.get("to", len(runs)))
    os.makedirs(out_root, exist_ok=True)
    sum_path = os.path.join(out_root, "summary.json")
    summary = json.load(open(sum_path, encoding="utf-8")) if os.path.exists(sum_path) else {}
    for i, cfg in enumerate(runs, 1):
        if i < start or i > to:
            continue
        name = cfg["name"]
        print(f"run{i:02d} {name}", flush=True)
        reps = []
        for k in range(REP):
            for attempt in range(2):
                try:
                    m = run(cfg, os.path.join(out_root, f"run{i:02d}", f"r{k + 1}"))
                    break
                except Exception as err:
                    print(f"  r{k + 1} 실패: {type(err).__name__} {err}", flush=True)
                    m = None
            if m:
                reps.append(m)
                print(f"  r{k + 1} 멈칫50 {m.get('stall50')} · 가장 긴 {m.get('max_ms')}ms · 평균 {m.get('avg_ms')}ms · 1% {m.get('fps_low1')}fps · 힙 {m.get('heap_mb')}MB · 프로세스 {m.get('mem')} · {cleanup_check()}", flush=True)
        row = {"name": name, "reps": reps}
        if reps:
            keys = [k for k in reps[0] if isinstance(reps[0][k], (int, float))]
            row["median"] = {k: statistics.median([r[k] for r in reps if isinstance(r.get(k), (int, float))]) for k in keys}
            mems = [r["mem"] for r in reps if r.get("mem")]
            if mems:
                row["median"]["mem"] = {k: statistics.median([x[k] for x in mems]) for k in mems[0]}
            peaks = [r["mem_max"] for r in reps if r.get("mem_max")]
            if peaks:
                row["median"]["mem_max"] = {k: statistics.median([x[k] for x in peaks]) for k in peaks[0]}
        if DRAWS:
            try:
                row["draws"] = run(cfg, os.path.join(out_root, f"run{i:02d}", "draws"), draws=True)
                print(f"  그리기 {row['draws']} · {cleanup_check()}", flush=True)
            except Exception as err:
                print(f"  그리기 실패: {type(err).__name__} {err}", flush=True)
                import traceback
                traceback.print_exc(limit=6)
        summary[f"run{i:02d}"] = row
        json.dump(summary, open(sum_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    write_md(summary, os.path.join(out_root, "summary.md"))
    print(open(os.path.join(out_root, "summary.md"), encoding="utf-8").read())


def write_md(summary, path):
    keys = ["stall50", "stall100", "max_ms", "avg_ms", "fps_avg", "fps_low1", "long_tasks", "heap_mb", "canvas_mb", "img_mb", "boot_ms"]
    lines = [f"# 성능 — 배율 {DPR} · GPU {'켬' if GPU else '끔'} · {REP}번 가운데 값", "", "| 판 | " + " | ".join(keys) + " | 렌더러 MB (최대) | GPU MB (최대) | 전체 MB (최대) | 그리기 평균 | 그리기 최대 |", "|" + "---|" * (len(keys) + 6)]
    for k in sorted(summary):
        r = summary[k]
        m = r.get("median", {})
        mem = m.get("mem_max") or (m.get("mem", {}) if isinstance(m.get("mem"), dict) else {})
        d = r.get("draws") or {}
        lines.append(f"| {r['name']} | " + " | ".join(str(m.get(x, "")) for x in keys) + f" | {mem.get('renderer', '')} | {mem.get('gpu', '')} | {mem.get('all', '')} | {d.get('draw_avg', '')} | {d.get('draw_max', '')} |")
    open(path, "w", encoding="utf-8").write("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
