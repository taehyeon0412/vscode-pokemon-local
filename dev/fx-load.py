"""3:3 연출 PC 부담 재기 (2026-10-21 orders #17 — "6마리 연출이 겹칠 때 PC 부담은 개발팀이 재 봄")
  python dev/fx-load.py [창=860x187] [초=6]
  전투 장면 (battle=choose — 메뉴를 기다려 조용함) 에서 일반 모드 기술 연출을 0 · 1 · 6 개씩 0.9초마다 쏘고 (3:3 모드, 기술마다 번호),
  그동안 화면 갱신 간격 (requestAnimationFrame) · 입자 수 · 렌더러 일한 시간 (CDP Performance.getMetrics) 을 잼.
  머리 없는 크롬 · GPU 끔이라 실제 VS Code 보다 느림 — 0 · 1 · 6 끼리 견줌"""
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("gs", os.path.join(ROOT, "dev", "game-shots.py"))
gs = importlib.util.module_from_spec(spec)
args = sys.argv[1:]
sys.argv = [sys.argv[0]]
spec.loader.exec_module(gs)
win = args[0] if args else "860x187"
secs = float(args[1]) if len(args) > 1 else 6.0

# cdp-frames.py 의 웹소켓 (표준 라이브러리만)
import base64
import socket
import struct


class WS:
    def __init__(self, url):
        u = urllib.parse.urlparse(url)
        self.s = socket.create_connection((u.hostname, u.port))
        key = base64.b64encode(os.urandom(16)).decode()
        self.s.sendall(f"GET {u.path} HTTP/1.1\r\nHost: {u.hostname}:{u.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n".encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            buf += self.s.recv(1)
        self.n = 0

    def _read(self, n):
        b = b""
        while len(b) < n:
            c = self.s.recv(n - len(b))
            if not c:
                raise EOFError
            b += c
        return b

    def call(self, method, params=None):
        self.n += 1
        p = json.dumps({"id": self.n, "method": method, "params": params or {}}).encode()
        h = bytes([0x81])
        n = len(p)
        h += bytes([0x80 | n]) if n < 126 else bytes([0x80 | 126]) + struct.pack(">H", n) if n < 65536 else bytes([0x80 | 127]) + struct.pack(">Q", n)
        m = os.urandom(4)
        self.s.sendall(h + m + bytes(b ^ m[i % 4] for i, b in enumerate(p)))
        while True:
            data = b""
            while True:
                b0, b1 = self._read(2)
                k = b1 & 0x7F
                if k == 126:
                    k = struct.unpack(">H", self._read(2))[0]
                elif k == 127:
                    k = struct.unpack(">Q", self._read(8))[0]
                data += self._read(k)
                if b0 & 0x80:
                    break
            msg = json.loads(data.decode("utf-8", "replace"))
            if msg.get("id") == self.n:
                return msg.get("result", {})


# 게임 창 (iframe) 안에서 — n 개를 0.9초마다 (0.15초씩 엇갈려), 3:3 모드 · 기술마다 번호 · 0.6초 뒤 맞는 임팩트
PROBE = r"""
(async (n, ms) => {
  const w = document.querySelector('iframe').contentWindow;
  const d = w.document;
  const fx = w.pokemonFx;
  if (!fx) return { error: 'no fx' };
  const act = (side, form) => ({ el: d.querySelector(`.pg-fighter-${side} .pg-sprite`), box: d.querySelector(`.pg-fighter-${side}`), form, size: 40, left: side === 'foe' });
  const me = act('me', 'bulbasaur');
  const foe = act('foe', 'charmander');
  const moves = [{ name: '화염방사', type: 'fire' }, { name: '하이드로펌프', type: 'water' }, { name: '10만볼트', type: 'electric' }, { name: '눈보라', type: 'ice' }, { name: '솔라빔', type: 'grass' }, { name: '파괴광선', type: 'normal' }];
  fx.team?.(true);
  let tag = 1, k = 0, peak = 0;
  const timers = [];
  const fire = () => {
    for (let i = 0; i < n; i++) {
      const mine = i % 2 === 0;
      const m = moves[(i + k) % moves.length];
      timers.push(w.setTimeout(() => {
        fx.move(mine ? me : foe, m, 0, undefined, mine ? foe : me, tag++);
        timers.push(w.setTimeout(() => fx.impact(mine ? foe : me, m.type, false, m.name, {}), 600));
      }, i * 150));
    }
    k++;
  };
  const iv = n > 0 ? w.setInterval(fire, 900) : 0;
  if (n > 0) fire();
  const deltas = [];
  let last = performance.now(), run = true;
  const loop = (t) => { deltas.push(t - last); last = t; peak = Math.max(peak, w.__ult?.count?.() ?? 0); if (run) w.requestAnimationFrame(loop); };
  w.requestAnimationFrame(loop);
  await new Promise((r) => w.setTimeout(r, ms));
  run = false;
  w.clearInterval(iv);
  timers.forEach((t) => w.clearTimeout(t));
  fx.clear();
  fx.team?.(false);
  deltas.shift();
  deltas.sort((a, b) => a - b);
  const avg = deltas.reduce((s, x) => s + x, 0) / deltas.length;
  return { frames: deltas.length, fps: 1000 / avg, p95: deltas[Math.floor(deltas.length * 0.95)], max: deltas[deltas.length - 1], over50: deltas.filter((x) => x > 50).length, peak };
})(%N%, %MS%)
"""

httpd, port = gs.serve()
w, h = win.split("x")
q = {"screen": "game", "look": "may", "size": "medium", "battle": "choose", "fx": "1", "shim": "1"}
url = f"http://127.0.0.1:{port}/dev/frame.html?" + urllib.parse.urlencode({"w": w, "h": h, "page": "game.html", "q": urllib.parse.urlencode(q)})
# 빈 포트 (OS 가 고름) — pid % 500 이면 두 세션 (워크트리) 이 같은 포트를 잡아 결과가 섞이던 것 (2026-10-22 워크트리 시험 ⑥)
_dbg_sock = socket.socket()
_dbg_sock.bind(("127.0.0.1", 0))
dbg = _dbg_sock.getsockname()[1]
_dbg_sock.close()
with tempfile.TemporaryDirectory(prefix=gs.PROF_PREFIX, ignore_cleanup_errors=True) as prof:
    p = subprocess.Popen([gs.browser(), "--headless=new", "--disable-gpu", "--edge-skip-compat-layer-relaunch", f"--remote-debugging-port={dbg}", f"--user-data-dir={prof}", f"--window-size={w},{h}", "--hide-scrollbars", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
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
        ws = WS(ws_url)
        ws.call("Page.enable")
        ws.call("Performance.enable")
        ws.call("Emulation.setDeviceMetricsOverride", {"width": int(w), "height": int(h), "deviceScaleFactor": 1, "mobile": False})
        ws.call("Page.navigate", {"url": url})
        time.sleep(3)

        def metrics():
            return {m["name"]: m["value"] for m in ws.call("Performance.getMetrics")["metrics"]}

        print(f"창 {win} · {secs:g}초씩 (머리 없는 크롬 · GPU 끔)")
        for n in (0, 1, 6):
            m0 = metrics()
            r = ws.call("Runtime.evaluate", {"expression": PROBE.replace("%N%", str(n)).replace("%MS%", str(int(secs * 1000))), "awaitPromise": True, "returnByValue": True})
            m1 = metrics()
            v = r.get("result", {}).get("value") or r
            busy = (m1["TaskDuration"] - m0["TaskDuration"]) / secs * 100
            script = (m1["ScriptDuration"] - m0["ScriptDuration"]) / secs * 100
            if "fps" in v:
                print(f"  동시 {n}개: {v['fps']:.0f} fps · 느린 장면 95% {v['p95']:.0f}ms · 가장 느린 {v['max']:.0f}ms · 50ms 넘은 장면 {v['over50']} · 입자 최대 {v['peak']} · 렌더러 일함 {busy:.0f}% (스크립트 {script:.0f}%)")
            else:
                print("  ", n, v)
    finally:
        gs.kill_browser(p, prof)
        httpd.shutdown()
