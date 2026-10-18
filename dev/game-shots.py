#!/usr/bin/env python3
"""게임 모드 화면 사진 — 머리 없는 Edge 로 dev/game.html 을 패널 크기마다 띄워 찍음 (npm run build 뒤에)

  python dev/game-shots.py                 기본 묶음 (타이틀 · 확인 · 안내 · 스테이지 · 너무 낮음, 높이 68 ~ 140 · 좁은 패널)
  python dev/game-shots.py --only title    이름에 title 이 들어간 것만
  사진: dev/shots/game/<이름>.png (저장소에 안 올라감)
"""
import argparse
import io
import os
import socket
import struct
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

# 이름 · 패널 너비 x 높이 · 미리보기 주소 값 (dev/game-host.js)
SHOTS = [
    ("title-ok-68", "720x68", {"screen": "title", "save": "ok"}),
    ("title-ok-92-small", "720x92", {"screen": "title", "save": "ok", "size": "small"}),
    ("title-ok-116-medium", "720x116", {"screen": "title", "save": "ok", "size": "medium"}),
    ("title-ok-140-large", "720x140", {"screen": "title", "save": "ok", "size": "large"}),
    ("title-ok-68-large-shrunk", "720x68", {"screen": "title", "save": "ok", "size": "large"}),
    ("title-none-68", "720x68", {"screen": "title", "save": "none"}),
    ("title-confirm-68", "720x68", {"screen": "title", "save": "ok", "click": "new"}),
    ("title-broken-68", "720x68", {"screen": "title", "save": "broken"}),
    ("title-newer-92", "720x92", {"screen": "title", "save": "newer"}),
    ("title-busy-68", "720x68", {"screen": "title", "save": "ok", "busy": "1"}),
    ("title-ok-narrow-320", "320x68", {"screen": "title", "save": "ok"}),
    ("title-ok-light", "720x92", {"screen": "title", "save": "ok", "theme": "light"}),
    ("stage-68", "720x68", {"screen": "game"}),
    ("stage-trace-116", "720x116", {"screen": "game", "progress": "0.0364", "size": "medium"}),
    ("stage-appear-92", "720x92", {"screen": "game", "progress": "0.0463"}),
    ("stage-battle-start-92", "720x92", {"screen": "game", "progress": "0.0483"}),
    ("stage-item-92", "720x92", {"screen": "game", "progress": "0.3092"}),
    ("stage-request-68", "720x68", {"screen": "game", "progress": "0.8866"}),
    ("stage-request-140", "720x140", {"screen": "game", "progress": "0.8866", "size": "large"}),
    ("stage-end-92", "720x92", {"screen": "game", "progress": "0.99999"}),
    ("stage-request-240", "240x92", {"screen": "game", "progress": "0.8866"}),
    ("stage-end-240", "240x92", {"screen": "game", "progress": "0.99999"}),
    ("stage-item-116", "720x116", {"screen": "game", "progress": "0.3097", "size": "medium"}),
    ("stage-light-116", "720x116", {"screen": "game", "progress": "0.0364", "theme": "light", "size": "medium"}),
    ("stage-116-medium", "720x116", {"screen": "game", "size": "medium"}),
    ("stage-140-large", "720x140", {"screen": "game", "size": "large"}),
    ("stage-narrow-320", "320x68", {"screen": "game"}),
    ("stage-from-new-68", "720x68", {"screen": "title", "save": "none", "click": "new"}),
    ("too-small-50", "720x50", {"screen": "game"}),
    ("title-ok-narrow-200", "200x68", {"screen": "title", "save": "ok"}),
    ("title-confirm-narrow-320", "320x68", {"screen": "title", "save": "ok", "click": "new"}),
    ("title-two-warnings-68", "720x68", {"screen": "title", "save": "broken", "busy": "1", "notice": "write-failed"}),
    ("stage-narrow-240", "240x68", {"screen": "game"}),
    ("stage-wide-1858", "1858x160", {"screen": "game"}),
    ("title-wide-1858", "1858x160", {"screen": "title", "save": "ok"}),
    ("battle-choose-68", "720x68", {"screen": "game", "battle": "choose"}),
    ("battle-choose-92", "720x92", {"screen": "game", "battle": "choose"}),
    ("battle-choose-116-medium", "720x116", {"screen": "game", "battle": "choose", "size": "medium"}),
    ("battle-choose-140-large", "720x140", {"screen": "game", "battle": "choose", "size": "large"}),
    ("battle-choose-200-medium", "720x200", {"screen": "game", "battle": "choose", "size": "medium"}),
    ("battle-skills-200", "720x200", {"screen": "game", "battle": "skills", "size": "medium", "click": "skills"}),
    ("battle-skills-68", "720x68", {"screen": "game", "battle": "skills", "click": "skills"}),
    ("battle-counter-200", "720x200", {"screen": "game", "battle": "counter", "size": "medium", "dur": "20000", "animAt": "10"}),
    ("battle-counter-68", "720x68", {"screen": "game", "battle": "counter"}),
    ("battle-clash-200", "720x200", {"screen": "game", "battle": "clash", "size": "medium"}),
    ("battle-clash-68", "720x68", {"screen": "game", "battle": "clash"}),
    ("battle-ult-cut-200", "720x200", {"screen": "game", "battle": "ult-cut", "size": "medium", "dur": "20000", "animAt": "5"}),
    ("battle-ult-beam-200", "720x200", {"screen": "game", "battle": "ult-beam", "size": "medium", "dur": "20000", "animAt": "14"}),
    ("battle-attack-200", "720x200", {"screen": "game", "battle": "attack", "size": "medium", "dur": "20000", "animAt": "10"}),
    ("battle-pick-200", "720x200", {"screen": "game", "battle": "pick", "size": "medium"}),
    ("battle-pick-68", "720x68", {"screen": "game", "battle": "pick"}),
    ("battle-over-116", "720x116", {"screen": "game", "battle": "over", "size": "medium"}),
    ("battle-auto-200", "720x200", {"screen": "game", "battle": "auto", "size": "medium"}),
    ("battle-narrow-320", "320x200", {"screen": "game", "battle": "choose", "size": "medium"}),
    ("battle-narrow-320-68", "320x68", {"screen": "game", "battle": "choose"}),
    ("battle-wide-1858", "1858x160", {"screen": "game", "battle": "choose", "size": "medium"}),
    ("battle-narrow-240", "240x200", {"screen": "game", "battle": "choose", "size": "medium"}),
    ("battle-narrow-240-68", "240x68", {"screen": "game", "battle": "choose"}),
    ("battle-narrow-320-92", "320x92", {"screen": "game", "battle": "choose", "size": "small"}),
    ("battle-skills-320", "320x200", {"screen": "game", "battle": "skills", "size": "medium", "click": "skills"}),
    ("battle-items-200", "720x200", {"screen": "game", "battle": "items", "size": "medium", "click": "items"}),
    ("battle-catch-200", "720x200", {"screen": "game", "battle": "catch", "size": "medium", "budget": "900", "animAt": "0.7"}),
    ("battle-catch-68", "720x68", {"screen": "game", "battle": "catch", "budget": "900", "animAt": "0.7"}),
    ("battle-last-200", "720x200", {"screen": "game", "battle": "last", "size": "medium", "budget": "1500"}),
    ("battle-last-68", "720x68", {"screen": "game", "battle": "last", "budget": "1500"}),
    ("scene-result-116", "720x116", {"screen": "game", "scene": "result", "size": "medium", "budget": "1500"}),
    ("scene-result-68", "720x68", {"screen": "game", "scene": "result", "budget": "1500"}),
    ("scene-learn-116", "720x116", {"screen": "game", "scene": "learn", "size": "medium"}),
    ("scene-learn-68", "720x68", {"screen": "game", "scene": "learn"}),
    ("scene-evolve-200", "720x200", {"screen": "game", "scene": "evolve", "size": "medium", "budget": "1500", "animAt": "2.6"}),
    ("scene-evolve-pick-116", "720x116", {"screen": "game", "scene": "evolve-pick", "size": "medium"}),
    ("scene-evolve-pick-68", "720x68", {"screen": "game", "scene": "evolve-pick"}),
    ("scene-learn-320", "320x116", {"screen": "game", "scene": "learn", "size": "medium"}),
    ("battle-light-200", "720x200", {"screen": "game", "battle": "choose", "size": "medium", "theme": "light"}),
    # 단계 8 · 9
    ("p89-facility-68", "720x68", {"screen": "game", "place": "facility"}),
    ("p89-facility-116", "720x116", {"screen": "game", "place": "facility", "size": "medium"}),
    ("p89-hospital-68", "720x68", {"screen": "game", "place": "hospital"}),
    ("p89-hospital-320", "320x92", {"screen": "game", "place": "hospital"}),
    ("p89-shop-68", "720x68", {"screen": "game", "place": "shop"}),
    ("p89-shop-116", "720x116", {"screen": "game", "place": "shop", "size": "medium"}),
    ("p89-trainer-92", "720x92", {"screen": "game", "place": "trainer", "budget": "600"}),
    ("p89-trainer-140", "720x140", {"screen": "game", "place": "trainer", "size": "large", "budget": "600"}),
    ("p89-trainer-alert-92", "720x92", {"screen": "game", "place": "trainer", "budget": "50"}),
    ("p89-trainer-battle-200", "720x200", {"screen": "game", "place": "trainer-battle", "size": "medium"}),
    ("p89-trainer-battle-68", "720x68", {"screen": "game", "place": "trainer-battle"}),
    ("p89-defeat-68", "720x68", {"screen": "game", "place": "defeat"}),
    ("p89-defeat-320", "320x92", {"screen": "game", "place": "defeat"}),
    ("p89-clear-68", "720x68", {"screen": "game", "place": "clear"}),
    ("p89-clear-116", "720x116", {"screen": "game", "place": "clear", "size": "medium"}),
    ("p89-clear-320", "320x116", {"screen": "game", "place": "clear", "size": "medium"}),
    ("p89-lobby-68", "720x68", {"screen": "game", "place": "lobby"}),
    ("p89-lobby-140", "720x140", {"screen": "game", "place": "lobby", "size": "large"}),
    ("p89-lobby-320", "320x116", {"screen": "game", "place": "lobby", "size": "medium"}),
    ("p89-gym-battle-200", "720x200", {"screen": "game", "place": "gym-battle", "size": "medium"}),
    ("p89-badge-92", "720x92", {"screen": "game", "place": "badge"}),
    ("p89-menus-68", "720x68", {"screen": "game", "place": "walk"}),
    ("p89-menus-240", "240x68", {"screen": "game", "place": "walk"}),
    ("p89-map-68", "720x68", {"screen": "game", "place": "walk", "click": "map"}),
    ("p89-team-68", "720x68", {"screen": "game", "place": "walk", "click": "team"}),
    ("p89-team-116", "720x116", {"screen": "game", "place": "walk", "click": "team", "size": "medium"}),
    ("p89-team-320", "320x116", {"screen": "game", "place": "walk", "click": "team", "size": "medium"}),
    ("p89-bag-92", "720x92", {"screen": "game", "place": "walk", "click": "item"}),
    ("p89-settings-68", "720x68", {"screen": "game", "place": "walk", "click": "settings"}),
    ("p89-profile-200", "720x200", {"screen": "game", "battle": "choose", "size": "medium", "click": "profile"}),
    ("p89-profile-68", "720x68", {"screen": "game", "battle": "choose", "click": "profile"}),
    # 단계 10
    ("p10-hero-68", "720x68", {"screen": "title", "save": "none", "click": "hero"}),
    ("p10-hero-116", "720x116", {"screen": "title", "save": "none", "click": "hero", "size": "medium"}),
    ("p10-starter-68", "720x68", {"screen": "title", "save": "none", "click": "starter"}),
    ("p10-starter-116", "720x116", {"screen": "title", "save": "none", "click": "starter", "size": "medium"}),
    ("p10-starter-320", "320x116", {"screen": "title", "save": "none", "click": "starter", "size": "medium"}),
    ("p10-starter-frog-140", "720x140", {"screen": "title", "save": "none", "click": "starter", "size": "medium", "pick": "17"}),
    ("p10-trainer-140", "720x140", {"screen": "game", "place": "trainer", "size": "large", "budget": "600"}),
    ("p10-lobby-140", "720x140", {"screen": "game", "place": "lobby", "size": "large"}),
    ("p89-light-lobby-116", "720x116", {"screen": "game", "place": "lobby", "size": "medium", "theme": "light"}),
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


def png_size(path):
    with open(path, "rb") as f:
        head = f.read(24)
    return struct.unpack(">II", head[16:24])


def shoot(url, win, path, budget=3500):
    with tempfile.TemporaryDirectory() as prof:
        cmd = [browser(), "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--mute-audio",
               "--force-device-scale-factor=1", f"--user-data-dir={prof}", f"--window-size={win.replace('x', ',')}", f"--virtual-time-budget={budget}",
               f"--screenshot={path}", url]
        subprocess.run(cmd, capture_output=True, timeout=60)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only")
    ap.add_argument("--out", default=os.path.join(HERE, "dev", "shots", "game"))
    a = ap.parse_args()
    if not os.path.exists(os.path.join(HERE, "extension", "media", "game", "game.js")):
        sys.exit("game.js 가 없음 — 먼저 npm run build")
    os.makedirs(a.out, exist_ok=True)
    httpd, port = serve()
    try:
        for name, win, params in SHOTS:
            if a.only and a.only not in name:
                continue
            path = os.path.join(a.out, f"{name}.png")
            if os.path.exists(path):
                os.remove(path)
            # 머리 없는 브라우저는 찍는 순간에야 창 크기가 맞음 → 처음부터 정확한 크기인 iframe 에 띄움 (dev/frame.html), 창 = iframe 크기
            w, h = win.split("x")
            frame = f"http://127.0.0.1:{port}/dev/frame.html?" + urllib.parse.urlencode({"w": w, "h": h, "page": "game.html", "q": urllib.parse.urlencode({**{k: v for k, v in params.items() if k != "budget"}, "shim": "1"})})
            shoot(frame, win, path, int(params.get("budget", 3500)))
            if os.path.exists(path):
                w, h = png_size(path)
                print(f"{path}  ({w}x{h})")
            else:
                print(f"✗ 못 찍음 {path}")
    finally:
        httpd.shutdown()


if __name__ == "__main__":
    main()
