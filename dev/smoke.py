#!/usr/bin/env python3
"""필살기 점검 — 머리 없는 Edge 로 dev/panel.html 을 띄워 필살기를 차례로 쓰고 오류 · 입자 수를 보거나, 장면을 찍음

  python dev/smoke.py --fx all                                  틀마다 옵션 여러 벌 (panel.js 의 VARIANTS)
  python dev/smoke.py --fx ultbeam,ultorb --bundle dev/build/a.js
  python dev/smoke.py --pokemon venusaur,dragonite,pikachu      그 포켓몬들 자기 필살기
  python dev/smoke.py --lib 0-80                                 데이터에 있는 필살기 (틀+옵션 중복 없이) 0~80번째
  python dev/smoke.py --duellib 0-60 --p charizard,pikachu,bulbasaur,squirtle   데이터에 있는 필살기를 하나씩 대결로 (상대 · 승패 돌아가며)
  python dev/smoke.py --shot ultbeam --opts '{"c":"hyper"}' --at 500,1500,2500 --out dev/shots/beam
  python dev/smoke.py --shot own --p venusaur --at 1200           자기 필살기 장면
  python dev/smoke.py --fx clash --p charizard,pikachu,squirtle,venusaur   필살기 대결 (양 끝끼리) · 장면은 --shot clash --actor 0 --vs 3
  공통: --win 480x300 (패널 크기) · --size nano|small|medium|large · --p 포켓몬들 · --actor 0 (쓰는 애 번호)

장면 사진은 시작 연출(0.9초)이 끝난 뒤부터가 틀의 연출 — at 은 필살기를 쓴 순간부터 ms.
"""
import argparse
import html
import io
import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import threading
import urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EDGE_CANDIDATES = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]


class Quiet(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=HERE, **k)

    def log_message(self, *a):
        pass


def serve():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    httpd = ThreadingHTTPServer(("127.0.0.1", port), Quiet)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, port


def browser():
    exe = next((c for c in EDGE_CANDIDATES if os.path.exists(c)), None)
    if not exe:
        sys.exit("Edge · Chrome 을 못 찾음")
    return exe


def run(url, win, budget, extra):
    with tempfile.TemporaryDirectory() as prof:
        cmd = [browser(), "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--mute-audio",
               f"--user-data-dir={prof}", f"--window-size={win}", f"--virtual-time-budget={budget}", *extra, url]
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=max(120, budget // 1000 * 3))
        return r.stdout


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bundle")
    ap.add_argument("--fx")
    ap.add_argument("--pokemon")
    ap.add_argument("--lib", help="데이터의 필살기(틀+옵션 중복 없이) 몇 번째부터 몇 번째까지, 예 0-80")
    ap.add_argument("--duellib", help="데이터의 필살기를 대결로 (특수 빼고 틀+옵션 중복 없이) 몇 번째부터 몇 번째까지, 예 0-60")
    ap.add_argument("--shot")
    ap.add_argument("--opts", default="{}")
    ap.add_argument("--name")
    ap.add_argument("--at", default="1500")
    ap.add_argument("--actor", default="0")
    ap.add_argument("--vs", help="--shot clash 에서 받아칠 애 번호 (기본 마지막)")
    ap.add_argument("--ua", help='--shot clash 에서 쓰는 애 필살기 JSON, 예 \'["파괴광선","ultbeam",{"c":"hyper"}]\'')
    ap.add_argument("--ub", help="--shot clash 에서 받아칠 애 필살기 JSON")
    ap.add_argument("--winner", help="--shot clash 승패: a | b | draw")
    ap.add_argument("--x", help="--shot sig 에서 세울 곳 (패널 너비 비율, 예 0.15)")
    ap.add_argument("--p")
    ap.add_argument("--size", default="nano")
    ap.add_argument("--theme", default="forest")
    ap.add_argument("--win", default="480x300")
    ap.add_argument("--out", default=os.path.join(HERE, "dev", "shots"))
    a = ap.parse_args()
    httpd, port = serve()
    base = f"http://127.0.0.1:{port}/dev/panel.html"
    params = {"size": a.size, "theme": a.theme, "shim": 1}
    if a.bundle:
        params["bundle"] = "/" + os.path.relpath(os.path.abspath(a.bundle), HERE).replace(os.sep, "/")
    if a.p:
        params["p"] = a.p
    win = a.win.replace("x", ",")
    try:
        if a.shot:
            os.makedirs(a.out, exist_ok=True)
            for at in a.at.split(","):
                q = {**params, "shot": a.shot, "opts": a.opts, "at": at, "actor": a.actor}
                if a.name:
                    q["name"] = a.name
                if a.vs:
                    q["vs"] = a.vs
                for k in ("ua", "ub"):
                    if getattr(a, k):
                        q[k] = getattr(a, k)
                if a.winner:
                    q["win"] = a.winner
                if a.x:
                    q["x"] = a.x
                path = os.path.join(os.path.abspath(a.out), f"{a.shot}-{at}.png")
                # 정확한 크기의 iframe 에 띄워 찍고 그 부분만 자름 — 띄우기(약 1.5초) + at + 여유
                w, h = (int(v) for v in a.win.split("x"))
                frame = f"http://127.0.0.1:{port}/dev/frame.html?" + urllib.parse.urlencode({"w": w, "h": h, "q": urllib.parse.urlencode(q)})
                run(frame, f"{w + 200},{h + 200}", 12000 + int(at), [f"--screenshot={path}"])  # 페이지가 at 에서 스스로 멈추니 넉넉히
                if os.path.exists(path):
                    from PIL import Image
                    Image.open(path).crop((0, 0, w, h)).save(path)
                print(path if os.path.exists(path) else f"✗ 못 찍음 {path}")
            return
        if a.pokemon:
            params["p"] = a.pokemon
            params["smoke"] = "pokemon"
            n = len(a.pokemon.split(","))
            budget = 4000 + n * 25000  # 필살기가 여러 개인 애도 있어서 넉넉히
        elif a.duellib:
            params["smoke"] = "duellib"
            lo, hi = (int(v) for v in a.duellib.split("-"))
            params["from"], params["to"] = lo, hi
            budget = 4000 + (hi - lo) * 10500
        elif a.lib:
            params["smoke"] = "lib"
            lo, hi = (int(v) for v in a.lib.split("-"))
            params["from"], params["to"] = lo, hi
            budget = 4000 + (hi - lo) * 7000
        else:
            params["smoke"] = a.fx or "all"
            budget = 4000 + 60 * 9000 if (a.fx or "all") == "all" else 4000 + len(a.fx.split(",")) * 6 * 9000
            if a.fx in ("duel", "clash"):
                budget = 4000 + 24 * 11000
        out = run(base + "?" + urllib.parse.urlencode(params), win, budget, ["--dump-dom"])
        m = re.search(r'<pre id="smoke">(.*?)</pre>', out, re.S)
        if not m:
            print("✗ 결과 없음 (끝까지 못 돎) — 페이지 제목:", re.findall(r"<title>(.*?)</title>", out)[:1])
            sys.exit(1)
        res = json.loads(html.unescape(m.group(1)))
        bad = 0
        for r in res["results"]:
            tag = "✗" if r["errors"] else "✓"
            bad += bool(r["errors"])
            what = r.get("label")
            print(f"{tag} {what}  {r['ms']}ms  입자 최대 {r['maxParticles']}")
            for e in r["errors"]:
                print("    ", e.strip().splitlines()[0][:300])
        for e in res.get("log", [])[:5]:
            if not any(e in (r["errors"] or []) for r in res["results"]):
                print("  log:", e.strip().splitlines()[0][:300])
        print(f"모두 {len(res['results'])} · 오류 {bad}")
        sys.exit(1 if bad else 0)
    finally:
        httpd.shutdown()


if __name__ == "__main__":
    main()
