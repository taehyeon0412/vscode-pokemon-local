"""기술 연출 PC 부담 표 — 기술마다 한 장면 그리는 시간 · 알갱이 수 (#122 효과 점검 · 2026-10-29 기획 · 태현 님 10-24 "컴퓨터가 터질뻔했어")
  python dev/move-load.py <폴더> [mv=22,59,…|look|@목록.json] [size=860x187,1860x315] [dbl=0,1] [who=<모습>:<번호>]
  예) python dev/move-load.py out mv=59,439,89 dbl=0,1
  mv     dev/move-timing.py 와 같음 (닿는 기술도 잼 — 맞는 짜임 · 자국도 효과 고리)   size  패널 크기들
  dbl    1 = 같은 기술을 양쪽에서 동시에 (3:3 에서 센 기술 둘이 겹치는 흉내) · 0,1 이면 둘 다
  숨김은 재지 않음: 패널을 접거나 다른 탭이면 웹뷰를 버리고 (retainContextWhenHidden 안 씀 — src/game/README.md) · 창이 숨으면 rAF 가 멈춰 효과 고리 (moveTick) 도 멈춤 ·
  돌아오면 1.5초 넘게 빈 남은 알갱이는 버림 (moves.js moveTick) — 머리 없는 브라우저는 다른 탭을 앞으로 해도 문서가 "보임" 이라 시험 창으로 못 만듦
판마다 첫 연출 부름부터 3초: fx = 효과 고리 (moveTick — 기술 · 맞는 짜임 · 필살기 알갱이) 가 한 장면에 쓴 ms (최대 · 95%) · all = rAF 모두 · parts = 살아 있는 알갱이 최대 ·
  slow = 장면 사이 50ms 넘음 · ✗ = fx 최대 8ms 넘음 (한 장면 16.7ms 의 절반) 또는 연출을 안 부름
결과: <폴더>/load.json · 화면에 판마다 한 줄 (무거운 순) + 끝 요약. 머리 없는 브라우저 · GPU 끔이라 실제 VS Code 보다 느림 — 기술끼리 · 크기끼리 견줌.
브라우저 1개 · 판마다 20초 상한 · 남은 메모리 4 GB 아래면 시작 안 함 (dev/move-timing.py 의 도구를 빌려 씀)"""
import importlib.util
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
a = sys.argv[1:]
sys.argv = [sys.argv[0]]
spec = importlib.util.spec_from_file_location("mt", os.path.join(ROOT, "dev", "move-timing.py"))
mt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mt)
gs = mt.gs

FX_MS = 8  # 한 장면 효과 고리 상한 (60 fps 한 장면 16.7ms 의 절반 — 기획 예시)
SPAN = 3000  # 첫 연출 부름부터 재는 길이
REC = open(os.path.join(ROOT, "dev", "move-load.js"), encoding="utf-8").read()


def plan(opt):
    moves = mt.load("moves.json")
    fxs = mt.load("move-fx.json")
    pick = mt.pickers()
    sizes = [tuple(int(x) for x in s.split("x")) for s in opt.get("size", "860x187,1860x315").split(",")]
    dbls = opt.get("dbl", "0").split(",")
    who = opt.get("who")
    cases = []
    # shim=1 (rAF → setTimeout 16ms — 사진용) 은 안 씀: 진짜 rAF 로 돌아야 장면마다 일한 시간을 잼
    for mid in mt.move_ids(opt.get("mv", "look")):
        if mid not in fxs:
            continue
        form, dex = (who.split(":")[0], int(who.split(":")[1])) if who else pick(mid)
        name = moves.get(mid, {}).get("name", {}).get("ko", "?")
        for w, h in sizes:
            for d in dbls:
                q = {"screen": "game", "look": "may", "size": "medium", "dur": "900", "fx": "1",
                     "battle": "move", "side": "me", "mv": mid, "fhp": "500", "me": f"{form}:{dex}"}
                if d == "1":
                    q["dbl"] = "1"
                cases.append(dict(id=f"{w}x{h}-{mid}-{form}" + ("-dbl" if d == "1" else ""),
                                  mv=mid, name=name, tmpl=fxs[mid][3], w=w, h=h, dbl=d == "1", form=form, q=q))
    return cases


def summarize(L):
    ev = L.get("ev") or []
    fr = L.get("fr") or []
    t0 = next((e["t"] for e in ev if e["k"] == "move"), None)
    if t0 is None:
        return dict(called=False)
    win = [f for f in fr if t0 <= f["t"] <= t0 + SPAN]
    fx = sorted(f["fx"] for f in win)
    al = sorted(f["all"] for f in win)
    gaps = [b["ts"] - a_["ts"] for a_, b in zip(win, win[1:])]
    p95 = lambda xs: xs[min(len(xs) - 1, int(len(xs) * 0.95))] if xs else 0  # noqa: E731
    return dict(called=True, frames=len(win), fxMax=round(fx[-1], 2) if fx else 0, fxP95=round(p95(fx), 2), allMax=round(al[-1], 2) if al else 0,
                parts=max((f.get("parts") or 0 for f in win), default=0), slow=sum(1 for g in gaps if g > 50), fxframes=sum(1 for f in win if f["fx"] > 0), err=L.get("err"))


def run(cases, out):
    httpd, port = gs.serve()
    # 판을 넘기는 중 받다 끊긴 파일 (ConnectionReset) 은 결과와 상관없음 — 긴 오류 글을 안 찍음
    httpd.handle_error = lambda *_: None
    res, stop = {}, None
    p = prof = ws = tmp = None
    poll = ("(() => { const w = document.querySelector('iframe')?.contentWindow; const L = w && w.__moveLoad; if (!L) return null;"
            " const e = L.ev.find((e) => e.k === 'move'); return e ? w.performance.now() - e.t : -1; })()")
    take = "JSON.stringify(document.querySelector('iframe').contentWindow.__moveLoad || null)"
    try:
        for i, c in enumerate(cases):
            if mt.free_gb() < 3:
                stop = f"멈춤 — 남은 메모리 {mt.free_gb():.1f} GB (3 GB 아래) · {i}/{len(cases)} 판에서"
                break
            if ws is None or i % mt.RESTART == 0:
                if p:
                    gs.kill_browser(p, prof)
                    tmp.cleanup()
                tmp = tempfile.TemporaryDirectory(prefix=gs.PROF_PREFIX, ignore_cleanup_errors=True)
                prof = tmp.name
                s0 = socket.socket()
                s0.bind(("127.0.0.1", 0))
                dbg = s0.getsockname()[1]
                s0.close()
                p = subprocess.Popen([gs.browser(), "--headless=new", "--disable-gpu", "--edge-skip-compat-layer-relaunch", f"--remote-debugging-port={dbg}",
                                      f"--user-data-dir={prof}", "--window-size=1900,400", *gs.hide_scrollbars(), "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                ws_url = None
                for _ in range(100):
                    try:
                        pages = [t for t in json.load(urllib.request.urlopen(f"http://127.0.0.1:{dbg}/json/list", timeout=1)) if t.get("type") == "page"]
                        if pages:
                            ws_url = pages[0]["webSocketDebuggerUrl"]
                            break
                    except Exception:
                        pass
                    time.sleep(0.1)
                if not ws_url:
                    raise mt.Stalled("브라우저가 안 뜸")
                ws = mt.WS(ws_url)
                ws.call("Page.enable")
                ws.call("Page.addScriptToEvaluateOnNewDocument", {"source": REC})
            ws.end = time.time() + mt.CASE_S
            url = f"http://127.0.0.1:{port}/dev/frame.html?" + urllib.parse.urlencode({"w": c["w"], "h": c["h"], "page": "game.html", "q": urllib.parse.urlencode(c["q"])})
            ws.call("Emulation.setDeviceMetricsOverride", {"width": c["w"], "height": c["h"], "deviceScaleFactor": 1, "mobile": False})
            ws.call("Page.navigate", {"url": url})
            t0 = time.time()
            while time.time() - t0 < mt.CASE_S - 2:
                time.sleep(0.25)
                since = ws.eval(poll)
                if since is not None and since >= SPAN + 200:
                    break
            raw = ws.eval(take)
            L = json.loads(raw) if raw else None
            res[c["id"]] = summarize(L) if L else dict(called=False, err="기록 없음")
            ws.call("Page.navigate", {"url": "about:blank"})
            if (i + 1) % 20 == 0:
                print(f"  … {i + 1}/{len(cases)} 판", flush=True)
    except (mt.Stalled, TimeoutError, EOFError, ConnectionError) as e:
        stop = f"멈춤 — {e if isinstance(e, mt.Stalled) else '답이 없음'} · 판마다 상한 {mt.CASE_S}초 · {len(res)}/{len(cases)} 판에서"
    finally:
        if p:
            gs.kill_browser(p, prof)
        if tmp:
            tmp.cleanup()
        httpd.shutdown()
    return res, stop


def main():
    if not a or "=" in a[0]:
        print(__doc__)
        sys.exit(2)
    out = a[0]
    opt = dict(kv.split("=", 1) for kv in a[1:])
    os.makedirs(out, exist_ok=True)
    g = mt.free_gb()
    if g < 4:
        print(f"멈춤 — 남은 메모리 {g:.1f} GB (4 GB 아래 · 정리부터: python dev/cleanup.py)")
        sys.exit(2)
    cases = plan(opt)
    print(f"기술 {len({c['mv'] for c in cases})} · 판 {len(cases)}", flush=True)
    t = time.time()
    res, stop = run(cases, out)
    rows = []
    for c in cases:
        r = res.get(c["id"])
        if r is None:
            continue
        bad = not r.get("called") or r.get("fxMax", 0) > FX_MS
        rows.append(dict(id=c["id"], mv=c["mv"], name=c["name"], tmpl=c["tmpl"], size=f"{c['w']}x{c['h']}", dbl=c["dbl"], form=c["form"], bad=bad, **r))
    rows.sort(key=lambda r: -(r.get("fxMax") or 0))
    for r in rows:
        if not r.get("called"):
            line = f"✗ {r['mv']} {r['name']} {r['size']}{' 둘' if r['dbl'] else ''} | 연출 부름 없음 {r.get('err') or ''}"
        else:
            line = (f"{'✗' if r['bad'] else ' '} {r['mv']} {r['name']} {r['tmpl']} {r['size']}{' 둘' if r['dbl'] else ''} | fx 최대 {r['fxMax']:.1f}ms · 95% {r['fxP95']:.1f}"
                    f" · all 최대 {r['allMax']:.1f} · 알갱이 {r['parts']} · 느린 장면 {r['slow']}/{r['frames']}")
        print(line)
    secs = round(time.time() - t)
    bad = [r for r in rows if r["bad"]]
    json.dump(dict(fx_ms=FX_MS, span=SPAN, secs=secs, stop=stop, rows=rows), open(os.path.join(out, "load.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    top = rows[0] if rows else None
    print(f"{'멈춤 · ' if stop else ''}판 {len(rows)}/{len(cases)} · ✗ {len(bad)} · 가장 무거움 {top['mv'] + ' ' + top['name'] + ' ' + top['size'] + (' 둘' if top['dbl'] else '') + ' fx ' + str(top.get('fxMax')) + 'ms · 알갱이 ' + str(top.get('parts')) if top and top.get('called') else '-'}"
          f" · 알갱이 최대 {max((r.get('parts') or 0 for r in rows), default=0)} · {secs // 60}분 {secs % 60}초 · 표 {os.path.join(out, 'load.json')}")
    if stop:
        print(stop)
        sys.exit(2)


main()
