"""연출 장면을 한 번 불러온 페이지에서 실제 시간으로 연달아 찍기 (Chrome DevTools Protocol · 표준 라이브러리 websocket, 2026-10-20)
  python dev/cdp-frames.py <out_dir> <win> <start_ms> <dur_ms> k=v ...
  예) python dev/cdp-frames.py out 860x187 600 1500 battle=move side=foe mv=10 parry=perfect
  dev/frame.html → game.html (k=v = dev/game-host.js 매개변수). 찍은 장면 = <out_dir>/f_<불러온 뒤 ms>.png (0.05 ~ 0.08초 간격)
  game-shots.py 처럼 장면마다 새로 불러 찍으면 불러오는 시간이 0.2 ~ 0.4초씩 달라 짧은 순간 (닿는 때 · 패링) 이 어긋남 — 이건 한 번만 불러서 안 어긋남"""
import base64
import importlib.util
import json
import os
import socket
import struct
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("gs", os.path.join(ROOT, "dev", "game-shots.py"))
gs = importlib.util.module_from_spec(spec)
a = sys.argv[1:]
sys.argv = [sys.argv[0]]
spec.loader.exec_module(gs)
out, win, start_ms, dur_ms = a[0], a[1], int(a[2]), int(a[3])
extra = dict(kv.split("=", 1) for kv in a[4:])
os.makedirs(out, exist_ok=True)
for f in os.listdir(out):
    if f.startswith("f_"):
        os.remove(os.path.join(out, f))


class WS:
    def __init__(self, url):
        u = urllib.parse.urlparse(url)
        self.s = socket.create_connection((u.hostname, u.port))
        key = base64.b64encode(os.urandom(16)).decode()
        req = f"GET {u.path} HTTP/1.1\r\nHost: {u.hostname}:{u.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
        self.s.sendall(req.encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            c = self.s.recv(1)
            # 브라우저가 인사 중에 끊기면 recv 가 빈 값을 바로 돌려줘 끝없이 돎 (코드 리뷰어 #98)
            if not c:
                raise EOFError("브라우저 연결이 끊김")
            buf += c
        self.n = 0

    def _read(self, n):
        b = b""
        while len(b) < n:
            c = self.s.recv(n - len(b))
            if not c:
                raise EOFError
            b += c
        return b

    def send(self, obj):
        self.n += 1
        obj["id"] = self.n
        p = json.dumps(obj).encode()
        h = bytes([0x81])
        n = len(p)
        if n < 126:
            h += bytes([0x80 | n])
        elif n < 65536:
            h += bytes([0x80 | 126]) + struct.pack(">H", n)
        else:
            h += bytes([0x80 | 127]) + struct.pack(">Q", n)
        m = os.urandom(4)
        self.s.sendall(h + m + bytes(b ^ m[i % 4] for i, b in enumerate(p)))
        return self.n

    def recv(self):
        data = b""
        while True:
            b0, b1 = self._read(2)
            n = b1 & 0x7F
            if n == 126:
                n = struct.unpack(">H", self._read(2))[0]
            elif n == 127:
                n = struct.unpack(">Q", self._read(8))[0]
            data += self._read(n)
            if b0 & 0x80:
                return json.loads(data.decode("utf-8", "replace"))

    def call(self, method, params=None):
        i = self.send({"method": method, "params": params or {}})
        while True:
            m = self.recv()
            if m.get("id") == i:
                return m.get("result", {})


httpd, port = gs.serve()
w, h = win.split("x")
q = {"screen": "game", "look": "may", "size": "medium", "dur": "900", "fx": "1", "shim": "1", **extra}
url = f"http://127.0.0.1:{port}/dev/frame.html?" + urllib.parse.urlencode({"w": w, "h": h, "page": "game.html", "q": urllib.parse.urlencode(q)})
# 빈 포트 (OS 가 고름) — pid % 500 이면 두 세션 (워크트리) 이 같은 포트를 잡아 결과가 섞이던 것 (2026-10-22 워크트리 시험 ⑥)
_dbg_sock = socket.socket()
_dbg_sock.bind(("127.0.0.1", 0))
dbg = _dbg_sock.getsockname()[1]
_dbg_sock.close()
# 브라우저를 끈 뒤에도 잠깐 파일을 잡고 있어 지우기가 실패할 수 있음 — 무시 (임시 폴더)
with tempfile.TemporaryDirectory(prefix=gs.PROF_PREFIX, ignore_cleanup_errors=True) as prof:
    p = subprocess.Popen([gs.browser(), "--headless=new", "--disable-gpu", "--edge-skip-compat-layer-relaunch", f"--remote-debugging-port={dbg}", f"--user-data-dir={prof}", f"--window-size={w},{h}", "--hide-scrollbars", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        ws_url = None
        for _ in range(100):
            try:
                tl = json.load(urllib.request.urlopen(f"http://127.0.0.1:{dbg}/json/list", timeout=1))
                pages = [t for t in tl if t.get("type") == "page"]
                if pages:
                    ws_url = pages[0]["webSocketDebuggerUrl"]
                    break
            except Exception:
                pass
            time.sleep(0.1)
        ws = WS(ws_url)
        ws.call("Page.enable")
        ws.call("Emulation.setDeviceMetricsOverride", {"width": int(w), "height": int(h), "deviceScaleFactor": 1, "mobile": False})
        ws.call("Page.navigate", {"url": url})
        t0 = time.time()
        n = 0
        while True:
            el = (time.time() - t0) * 1000
            if el > start_ms + dur_ms:
                break
            if el < start_ms:
                time.sleep(0.005)
                continue
            r = ws.call("Page.captureScreenshot", {"format": "png"})
            ms = int((time.time() - t0) * 1000)
            open(os.path.join(out, f"f_{ms:05d}.png"), "wb").write(base64.b64decode(r["data"]))
            n += 1
        print("frames", n)
    finally:
        gs.kill_browser(p, prof)
        httpd.shutdown()
