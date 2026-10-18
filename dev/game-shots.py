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


def shoot(url, win, path):
    with tempfile.TemporaryDirectory() as prof:
        cmd = [browser(), "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--mute-audio",
               "--force-device-scale-factor=1", f"--user-data-dir={prof}", f"--window-size={win.replace('x', ',')}", "--virtual-time-budget=3000",
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
            frame = f"http://127.0.0.1:{port}/dev/frame.html?" + urllib.parse.urlencode({"w": w, "h": h, "page": "game.html", "q": urllib.parse.urlencode(params)})
            shoot(frame, win, path)
            if os.path.exists(path):
                w, h = png_size(path)
                print(f"{path}  ({w}x{h})")
            else:
                print(f"✗ 못 찍음 {path}")
    finally:
        httpd.shutdown()


if __name__ == "__main__":
    main()
