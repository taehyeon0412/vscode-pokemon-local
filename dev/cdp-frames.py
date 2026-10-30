"""연출 장면을 한 번 불러온 페이지에서 실제 시간으로 연달아 찍기 (Chrome DevTools Protocol · 표준 라이브러리 websocket, 2026-10-20)
  python dev/cdp-frames.py <out_dir> <win> <start_ms> <dur_ms> k=v ...
  예) python dev/cdp-frames.py out 860x187 600 1500 battle=move side=foe mv=10 parry=perfect
  dev/frame.html → game.html (k=v = dev/game-host.js 매개변수). 찍은 장면 = <out_dir>/f_<불러온 뒤 ms>.png (0.05 ~ 0.08초 간격)
  game-shots.py 처럼 장면마다 새로 불러 찍으면 불러오는 시간이 0.2 ~ 0.4초씩 달라 짧은 순간 (닿는 때 · 패링) 이 어긋남 — 이건 한 번만 불러서 안 어긋남
  브라우저가 (시작 + 길이) + 60초 안에 답하지 않으면 "멈춤" 한 줄을 찍고 브라우저 · 임시 폴더를 정리한 뒤 끝 코드 2 로 끝냄"""
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
PROBE = os.environ.get("PG_PROBE_JS")
probe_log = open(os.path.join(out, "probe.jsonl"), "w", encoding="utf-8") if PROBE else None
for f in os.listdir(out):
    if f.startswith("f_"):
        os.remove(os.path.join(out, f))


class Stalled(Exception):
    """브라우저가 답하지 않거나 찍기를 거절함 (페이지가 멈춤 — bugs 1885)"""


class WS:
    def __init__(self, url, end):
        u = urllib.parse.urlparse(url)
        self.s = socket.create_connection((u.hostname, u.port))
        # 브라우저가 답하지 않으면 (페이지가 멈춤) 끝없이 기다리지 않음 — end (time.time()) 를 넘으면 Stalled (2026-10-28 bugs 1885 — 디자인 다시 찍기 하나가 2시간 동안 Edge 9개를 띄운 채 멈춤 · team-run.py 와 같은 종류)
        self.end = end
        self._wait()
        key = base64.b64encode(os.urandom(16)).decode()
        req = f"GET {u.path} HTTP/1.1\r\nHost: {u.hostname}:{u.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
        self.s.sendall(req.encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            self._wait()
            c = self.s.recv(1)
            # 브라우저가 인사 중에 끊기면 recv 가 빈 값을 바로 돌려줘 끝없이 돎 (코드 리뷰어 #98)
            if not c:
                raise EOFError("브라우저 연결이 끊김")
            buf += c
        self.n = 0

    def _wait(self):
        left = self.end - time.time()
        if left <= 0:
            raise Stalled("답이 없음")
        self.s.settimeout(left)

    def _read(self, n):
        b = b""
        while len(b) < n:
            self._wait()
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
                if "error" in m:
                    raise Stalled(f"{method} 오류 {m['error'].get('message', '')}")
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
limit_s = (start_ms + dur_ms) / 1000 + 60
n = 0
code = 0
# 브라우저를 끈 뒤에도 잠깐 파일을 잡고 있어 지우기가 실패할 수 있음 — 무시 (임시 폴더)
with tempfile.TemporaryDirectory(prefix=gs.PROF_PREFIX, ignore_cleanup_errors=True) as prof:
    p = subprocess.Popen([gs.browser(), "--headless=new", "--disable-gpu", "--edge-skip-compat-layer-relaunch", f"--remote-debugging-port={dbg}", f"--user-data-dir={prof}", f"--window-size={w},{h}", *gs.hide_scrollbars(),
                          # 머리 없는 창을 배경으로 여겨 그림을 멈추지 않게 (team-run 과 같음 — 10-30 Edge 에서 첫 캡처가 "Not attached to an active page" 로 0장이던 것)
                          "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        end = time.time() + limit_s
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
        if not ws_url:
            raise Stalled("브라우저가 안 뜸")
        ws = WS(ws_url, end)
        ws.call("Page.enable")
        ws.call("Page.bringToFront")
        ws.call("Emulation.setDeviceMetricsOverride", {"width": int(w), "height": int(h), "deviceScaleFactor": 1, "mobile": False})
        ws.call("Page.navigate", {"url": url})
        t0 = time.time()
        while True:
            el = (time.time() - t0) * 1000
            if el > start_ms + dur_ms:
                break
            if el < start_ms:
                time.sleep(0.005)
                continue
            # 불러오는 사이 (about:blank → 시험 창, 렌더러가 바뀌는 틈) 찍으면 "Not attached to an active page" — 0.1초 쉬고 다시 (10-30: 첫 장면에서 바로 멈춤으로 끝나 0장이던 것)
            try:
                r = ws.call("Page.captureScreenshot", {"format": "png"})
            except Stalled as e:
                if "Not attached" not in str(e) or el > start_ms + 5000:
                    raise
                time.sleep(0.1)
                continue
            ms = int((time.time() - t0) * 1000)
            open(os.path.join(out, f"f_{ms:05d}.png"), "wb").write(base64.b64decode(r["data"]))
            # PG_PROBE_JS = 장면마다 페이지 (frame.html) 에서 돌릴 식 → <out>/probe.jsonl (게임은 document.getElementById('f').contentWindow — 캔버스 자리 · 층 재기, bugs 2707)
            if PROBE:
                pr = ws.call("Runtime.evaluate", {"expression": PROBE, "returnByValue": True})
                probe_log.write(json.dumps({"ms": ms, "v": pr.get("result", {}).get("value")}, ensure_ascii=False) + "\n")
            n += 1
        print("frames", n)
    except (Stalled, TimeoutError) as e:
        # 끝 코드만 2 — 여러 장면을 이어 찍는 스크립트는 다음 장면으로 넘어가고, 이 줄을 보고 그 장면을 다시 찍음
        print(f"멈춤 — {e if isinstance(e, Stalled) else '답이 없음'} · 상한 {limit_s:.0f}초 · 찍은 장면 {n} · 페이지가 멈췄을 수 있음: {win} {' '.join(a[4:])}")
        code = 2
    finally:
        gs.kill_browser(p, prof)
        httpd.shutdown()
sys.exit(code)
