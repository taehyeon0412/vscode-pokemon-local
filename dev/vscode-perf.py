"""실제 VS Code 에서 성능 재기 (#140 ⑤ · #142 — 2026-11-02 기획 "실제 VS Code 가 마지막 판정 · 태현 님이 렉을 느낀 곳이 VS Code")

Extension Development Host (임시 사용자 폴더 — 설치 없이 · dev/vscode-shot.py 와 같은 길) 를 디버그 포트로 띄우고, 웹뷰가 뜰 때 CDP 로
시험 창 손잡이 (__pgDevHost → __pgDebug) 를 켠 뒤 perf-runs.json 의 판을 team-run 과 같은 흐름으로 몰며 perf-run 기록기 (진짜 시계) 로 잰다.

    python dev/vscode-perf.py <out> [build=<빌드 폴더 — 그 폴더의 extension 을 띄움 · 없으면 이 저장소>] [runs=8,9,10,11,12] [rep=3] [h=187] [warmup=1]

  build   44df08b3 기준 판 등 — 그 폴더에서 npm run build + node scripts/build.mjs --release --tests --host-only 를 먼저 (테스트 손잡이가 든 확장 쪽)
  runs    dev/perf-runs.json 판 번호 (너비 = 판 size) · 판마다 웹뷰 너비를 창 크기로 맞춤 (vscode-shot fit)
  warmup  1 = 판마다 재기 전 한 번 돌려 따로 적음 (그 VS Code 의 셰이더 캐시가 비어 있을 때 = 업데이트 뒤 처음 그 연출)
결과: <out>/run<NN>/r<k>/perf.json (perf-run 과 같은 모양) · <out>/summary.json · 화면 박자 (모니터 Hz) 는 summary 에
VS Code 창이 뜬다 (재는 동안 몇 분 — 최소화하면 웹뷰가 멈춤). 프로세스는 이 도구가 띄운 것만 PID 로 끈다.
"""
import importlib.util
import json
import os
import re
import select
import shutil
import socket
import statistics
import subprocess
import sys
import tempfile
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, file))
    mod = importlib.util.module_from_spec(spec)
    argv, sys.argv = sys.argv, [sys.argv[0]]
    try:
        spec.loader.exec_module(mod)
    finally:
        sys.argv = argv
    return mod


vs = load("vs", "vscode-shot.py")
tr = load("tr", "team-run.py")
# 기록기 · 지표는 perf-run 과 같은 것 (perf-run 은 불러오면 team-run 을 바꿔 끼우므로 글만 가져옴)
_pr = open(os.path.join(HERE, "perf-run.py"), encoding="utf-8").read()
LIGHT = re.search(r'^LIGHT = r"""(.*?)"""', _pr, re.S | re.M).group(1)
# 게임 문서 (웹뷰 안 active-frame) 의 실행 문맥에서 바로 돌림 — 웹뷰 CSP 가 eval 을 막아 시험 창처럼 W.eval(...) 로는 기록기 · 상태 읽기가 안 돎
W = "window"
# 새 문서가 뜰 때마다 (웹뷰 iframe 안 모든 문서) — 게임 main.ts 가 __pgDebug 를 내줌 (시험 창과 같은 손잡이 · 이 VS Code 사용자 폴더에서만)
INJECT = "try { if (location.protocol === 'vscode-webview:') window.__pgDevHost = true; } catch (e) {}"
# VS Code 는 게임 문서를 새 문서 없이 써 넣어 (document.write) 위 글이 안 돎 → 바깥 웹뷰 문서에서 1ms 마다 iframe 창에 깃발을 꽂음
#   (써 넣기 뒤에도 창은 그대로 · game.js 는 파일로 받아 나중에 돌아 그 전에 꽂힘)
POLL = ("(() => { if (window.__pgPoll) return 'again'; window.__pgPoll = setInterval(() => { for (const f of document.querySelectorAll('iframe')) "
        "{ try { const w = f.contentWindow; if (w && !w.__pgDevHost) w.__pgDevHost = true; } catch (e) {} } }, 1); return 'ok'; })()")


class Mux:
    """한 웹소켓에 여러 세션 (flatten) — 이벤트는 모아 두고 handle 로 처리"""

    def __init__(self, url):
        self.ws = tr.WS(url)
        self.events = []

    def call(self, method, params=None, session=None):
        msg = {"method": method, "params": params or {}}
        if session:
            msg["sessionId"] = session
        i = self.ws.send(msg)
        while True:
            m = self.ws.recv()
            if m.get("id") == i:
                if "error" in m:
                    raise RuntimeError(f"{method}: {m['error']}")
                return m.get("result", {})
            if "method" in m:
                self.events.append(m)

    def pump(self, secs):
        # 읽을 것이 있을 때만 한 통 통째로 (중간에 시간 끊김으로 통이 잘리지 않게)
        end = time.time() + secs
        while time.time() < end:
            if not select.select([self.ws.s], [], [], 0.1)[0]:
                continue
            m = self.ws.recv()
            if "method" in m:
                self.events.append(m)


class Sess:
    """team-run 의 ws.ev 자리에 — 웹뷰에서 식을 돌림 (따로 떨어진 iframe 대상이면 세션 · 같은 프로세스면 그 프레임의 실행 문맥)"""

    def __init__(self, mux, session=None, context=None):
        self.mux, self.session, self.context = mux, session, context

    def ev(self, expr):
        p = {"expression": expr, "returnByValue": True}
        if self.context is not None:
            p["contextId"] = self.context
        r = self.mux.call("Runtime.evaluate", p, self.session)
        return r.get("result", {}).get("value")


seen = set()


def handle(mux, webviews, contexts):
    """붙은 대상 — 웹뷰면 손잡이 글을 넣고, 기다리는 대상은 모두 풀어 줌 (안 풀면 VS Code 가 멈춤) · 웹뷰 프레임 실행 문맥을 모음"""
    while mux.events:
        e = mux.events.pop(0)
        seen.add(e.get("method", ""))
        if e.get("method") == "Runtime.executionContextCreated" and not e.get("sessionId"):
            c = e["params"]["context"]
            if str(c.get("origin", "")).startswith("vscode-webview://"):
                contexts[c["id"]] = c.get("origin")
            continue
        if e.get("method") == "Runtime.executionContextDestroyed" and not e.get("sessionId"):
            contexts.pop(e["params"].get("executionContextId"), None)
            continue
        if e.get("method") != "Target.attachedToTarget":
            continue
        p = e["params"]
        sid, info = p["sessionId"], p["targetInfo"]
        # 웹뷰 iframe 만 (같은 주소의 서비스 워커는 Page 가 없음)
        if info.get("type") == "iframe" and info.get("url", "").startswith("vscode-webview://"):
            try:
                mux.call("Page.enable", {}, sid)
                mux.call("Page.addScriptToEvaluateOnNewDocument", {"source": INJECT}, sid)
                webviews.append(sid)
            except RuntimeError as err:
                print(f"  웹뷰 붙기 실패 {info.get('url', '')[:60]} — {err}", flush=True)
        if p.get("waitingForDebugger"):
            mux.call("Runtime.runIfWaitingForDebugger", {}, sid)


def metrics(K):
    dts = [d for t, d in K.get("dts", []) if t > 1000]
    if not dts:
        return {}
    s = sorted(dts)
    return {"frames": len(dts), "stall50": sum(1 for d in dts if d > 50), "stall100": sum(1 for d in dts if d > 100), "max_ms": round(max(dts), 1),
            "avg_ms": round(statistics.mean(dts), 2), "fps_low1": round(1000 / s[min(len(s) - 1, int(len(s) * 0.99))], 1), "long_tasks": len(K.get("long") or [])}


def one(ws, cfg, out, rnd):
    """판 하나 — team-run run_one 의 준비 · 흐름과 같게 (시험 창 매개변수 대신 개발 동작)"""
    os.makedirs(out, exist_ok=True)
    ws.ev(f"{W}.__pgDebug.dev({{ kind: 'scene', scene: 'stage-1' }})")
    time.sleep(1.0)
    for i, (dex, lv) in enumerate(cfg.get("team", [])):
        ws.ev(f"{W}.__pgDebug.dev({{ kind: 'mon', slot: {i}, dex: {dex}, level: {lv} }})")
    if cfg.get("team"):
        for i in range(5, len(cfg["team"]) - 1, -1):
            ws.ev(f"{W}.__pgDebug.dev({{ kind: 'mon-remove', slot: {i} }})")
    ws.ev(f"{W}.__pgDebug.dev({{ kind: 'heal' }})")
    for i in range(5, -1, -1):
        ws.ev(f"{W}.__pgDebug.dev({{ kind: 'foe-remove', slot: {i} }})")
    for i, (dex, lv) in enumerate(cfg.get("foes", [])):
        ws.ev(f"{W}.__pgDebug.dev({{ kind: 'foe', slot: {i}, dex: {dex}, level: {lv} }})")
    ws.ev(f"{W}.__pgDebug.input({json.dumps({'kind': 'battle-fast', 'on': cfg.get('q', {}).get('bfast') == '1'})})")
    ws.ev(f"(() => {{ try {{ {W}.__pgDebug.state().runtime.rngState = {int(cfg.get('seed', 1)) or 1}; }} catch (e) {{}} }})()")
    if cfg.get("direct"):
        ws.ev(f"{W}.__pgDebug.dev({{ kind: 'scene', scene: 'trainer-team' }})")
    ws.ev("delete window.__tr")
    ws.ev(LIGHT)
    t0 = time.time()
    acts = {"meet": False, "picks": 0, "go": False, "press": {}, "events": list(cfg.get("events", [])), "teamAt": None, "resultAt": None, "mash": 0}
    log = open(os.path.join(out, "log.jsonl"), "w", encoding="utf-8")
    try:
        while time.time() - t0 < cfg.get("limit", tr.LIMIT_S):
            el = time.time() - t0
            s = ws.ev(tr.STATE)
            if s:
                log.write(json.dumps({"el": round(el, 3), **s}, ensure_ascii=False) + "\n")
                tr.step(ws, W, s, acts, el, rnd, cfg)
                if acts["resultAt"] is not None and el - acts["resultAt"] > 3.5:
                    break
            time.sleep(max(0, tr.TICK_S - (time.time() - t0 - el)))
    finally:
        log.close()
    K = ws.ev(f"{W}.__tr ? {W}.__tr.stop() : null") or {}
    if 0 in (K.get("timeline") or [1]):
        print(f"    ⚠ 문서 시계 멈춤 {K.get('timeline')}", flush=True)
    m = metrics(K)
    json.dump({"cfg": cfg, "m": m, "views": K.get("views"), "phases": K.get("phases"), "long": K.get("long"), "stalls": [x for x in K.get("dts", []) if x[1] > 50],
               "timeline": K.get("timeline"), "clock": K.get("clock")}, open(os.path.join(out, "perf.json"), "w", encoding="utf-8"), ensure_ascii=False)
    return m


def refresh_hz():
    q = subprocess.run(["powershell", "-NoProfile", "-Command", "(Get-CimInstance Win32_VideoController | Select-Object -First 1).CurrentRefreshRate"], capture_output=True, text=True)
    return q.stdout.strip()


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    out = sys.argv[1]
    o = {"build": "", "runs": "8,9,10,11,12", "rep": "3", "h": "187", "warmup": "1"}
    for a in sys.argv[2:]:
        k, _, v = a.partition("=")
        if k not in o:
            sys.exit(f"모르는 매개변수: {k}\n{__doc__}")
        o[k] = v
    runs = json.load(open(os.path.join(HERE, "perf-runs.json"), encoding="utf-8"))["runs"]
    picks = [int(x) for x in o["runs"].split(",") if x]
    os.makedirs(out, exist_ok=True)
    talk = tempfile.mkdtemp(prefix="pokemon-shot-talk-")
    user = vs.user_dir("dark")
    name_tag = "pokemon-shot-" + os.urandom(4).hex()
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    env = dict(os.environ, SHOT_DIR=talk, SHOT_USER_DIR=user, SHOT_SAVE="", SHOT_IMPORT="", SHOT_WAIT_MS="1500", SHOT_VERSION="stable", SHOT_NAME=name_tag,
               SHOT_DEBUG_PORT=str(port), SHOT_GO="1", SHOT_HOLD_MS=str(3 * 3600 * 1000), SHOT_EXT_ROOT=os.path.abspath(o["build"]) if o["build"] else "")
    env.pop("ELECTRON_RUN_AS_NODE", None)
    proc = subprocess.Popen(["node", os.path.join(ROOT, ".test-out", "run-shot.cjs")], cwd=ROOT, env=env)
    hwnd, code_pid = None, None
    summary = {"build": o["build"] or ROOT, "hz": refresh_hz(), "runs": {}}
    try:
        page = None
        end = time.time() + 180
        while not page:
            if proc.poll() is not None:
                sys.exit(f"VS Code 가 먼저 끝남 (코드 {proc.returncode})")
            if time.time() > end:
                sys.exit("3분을 기다려도 디버그 포트가 안 열림")
            try:
                ts = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list", timeout=2))
                page = next((t for t in ts if t.get("type") == "page" and "workbench" in t.get("url", "")), None)
            except Exception:
                time.sleep(0.5)
        mux = Mux(page["webSocketDebuggerUrl"])
        # 웹뷰 iframe 이 같은 프로세스면 (VS Code 1.144 — 따로 떨어진 대상이 안 생김) 페이지에 넣은 글이 모든 프레임에 들어감
        mux.call("Page.enable")
        mux.call("Page.addScriptToEvaluateOnNewDocument", {"source": INJECT})
        mux.call("Runtime.enable")
        mux.call("Target.setAutoAttach", {"autoAttach": True, "waitForDebuggerOnStart": True, "flatten": True})
        webviews, contexts = [], {}
        handle(mux, webviews, contexts)
        # 페이지에서 자동 붙기 이벤트가 안 옴 (VS Code 1.144) → 웹뷰 iframe 대상 (/json/list) 에 바로 붙어 글을 넣음 — 일반 모드 웹뷰가 뜬 뒤 · 게임에 들어가기 전
        direct = []
        end = time.time() + 120
        while not direct and time.time() < end:
            for t in json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list", timeout=2)):
                if t.get("type") == "iframe" and t.get("url", "").startswith("vscode-webview://") and t.get("webSocketDebuggerUrl"):
                    m2 = Mux(t["webSocketDebuggerUrl"])
                    m2.call("Page.enable")
                    m2.call("Page.addScriptToEvaluateOnNewDocument", {"source": INJECT})
                    Sess(m2).ev(POLL)
                    direct.append(m2)
            if not direct:
                mux.pump(0.5)
                handle(mux, webviews, contexts)
        open(os.path.join(talk, "go"), "w").close()
        ready = os.path.join(talk, "ready.json")
        end = time.time() + 180
        while not os.path.exists(ready):
            if proc.poll() is not None:
                sys.exit(f"VS Code 가 게임 전에 끝남 (코드 {proc.returncode})")
            if time.time() > end:
                sys.exit("3분을 기다려도 게임에 못 들어감")
            mux.pump(0.3)
            handle(mux, webviews, contexts)
        mux.pump(1.0)
        handle(mux, webviews, contexts)
        ws = None
        probe = f"(() => {{ try {{ return !!{W}.__pgDebug && !!{W}.__pgDebug.state(); }} catch (e) {{ return false; }} }})()"
        cands = []
        for m2 in direct:
            # 바깥 웹뷰 문서의 자식 프레임 (active-frame) 기본 실행 문맥
            m2.call("Runtime.enable")
            m2.pump(0.5)
            kids = [c["frame"]["id"] for c in m2.call("Page.getFrameTree")["frameTree"].get("childFrames", [])]
            for e in m2.events:
                c = e.get("params", {}).get("context") if e.get("method") == "Runtime.executionContextCreated" else None
                if c and c.get("auxData", {}).get("frameId") in kids and c.get("auxData", {}).get("isDefault"):
                    cands.append(Sess(m2, context=c["id"]))
        for cand in cands + [Sess(mux, session=sid) for sid in webviews] + [Sess(mux, context=cid) for cid in list(contexts)]:
            try:
                if cand.ev(probe):
                    ws = cand
                    break
            except Exception:
                continue
        if not ws:
            ts = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list", timeout=2))
            for t in ts:
                print(f"  대상 {t.get('type')} {t.get('url', '')[:90]}", flush=True)
            print(f"  본 이벤트 {sorted(seen)}", flush=True)
            for m2 in direct:
                print("  웹뷰 문서:", Sess(m2).ev("(() => { const f = document.getElementById('active-frame'); let w = null; try { w = f && f.contentWindow; } catch (e) {} "
                                              "return { frames: [...document.querySelectorAll('iframe')].map((x) => x.id || x.name), outerFlag: !!window.__pgDevHost, "
                                              "w: !!w, flag: !!(w && w.__pgDevHost), dbg: w ? typeof w.__pgDebug : null, game: !!(w && w.document && w.document.getElementById('pokemon-game')), href: w ? String(w.location.href).slice(0, 80) : null }; })()"), flush=True)
            sys.exit(f"웹뷰에서 게임 손잡이 (__pgDebug) 를 못 찾음 — 웹뷰 대상 {len(webviews)}개 · 웹뷰 문맥 {len(contexts)}개")
        hwnd = vs.find_window(name_tag)
        pid = vs.wt.DWORD()
        vs.user32.GetWindowThreadProcessId(hwnd, vs.ctypes.byref(pid))
        code_pid = pid.value
        print(f"VS Code 게임 손잡이 ✓ · 화면 {summary['hz']}Hz · 빌드 {summary['build']}", flush=True)
        for idx in picks:
            cfg = runs[idx - 1]
            w, h = (int(x) for x in cfg.get("size", "860x187").split("x"))
            got = vs.fit(hwnd, talk, w, int(o["h"]))
            print(f"run{idx:02d} {cfg['name']} — 웹뷰 {got}", flush=True)
            rows = []
            if o["warmup"] == "1":
                m = one(ws, cfg, os.path.join(out, f"run{idx:02d}", "warmup"), __import__("random").Random(int(cfg.get("seed", 1))))
                print(f"  warmup (첫 판) 멈칫50 {m.get('stall50')} · 가장 긴 {m.get('max_ms')}ms", flush=True)
                summary["runs"].setdefault(cfg["name"], {})["warmup"] = m
            for k in range(int(o["rep"])):
                m = one(ws, cfg, os.path.join(out, f"run{idx:02d}", f"r{k + 1}"), __import__("random").Random(int(cfg.get("seed", 1))))
                rows.append(m)
                print(f"  r{k + 1} 멈칫50 {m.get('stall50')} · 100ms {m.get('stall100')} · 가장 긴 {m.get('max_ms')}ms · 평균 {m.get('avg_ms')}ms · 1% {m.get('fps_low1')}fps", flush=True)
            row = summary["runs"].setdefault(cfg["name"], {})
            row["reps"] = rows
            row["webview"] = got
            ok = [r for r in rows if r]
            if ok:
                row["median"] = {key: statistics.median([r[key] for r in ok]) for key in ok[0]}
            json.dump(summary, open(os.path.join(out, "summary.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        open(os.path.join(talk, "done"), "w").close()
        proc.wait(timeout=60)
    finally:
        if proc.poll() is None:
            subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"], capture_output=True)
        if hwnd and code_pid and vs.user32.IsWindow(hwnd):
            now = vs.wt.DWORD()
            vs.user32.GetWindowThreadProcessId(hwnd, vs.ctypes.byref(now))
            if now.value == code_pid:
                subprocess.run(["taskkill", "/PID", str(code_pid), "/T", "/F"], capture_output=True)
        shutil.rmtree(talk, ignore_errors=True)
        shutil.rmtree(user, ignore_errors=True)


if __name__ == "__main__":
    main()
