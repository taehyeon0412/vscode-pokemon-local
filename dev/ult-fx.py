"""필살기마다 "시작해서 처음 맞는 때" · 연출 길이 재기 → ult/ult-hit.json (2026-10-21 — 3:3 합동 필살기 맞는 순간 맞추기 · 기획 #88 시뮬)
  python dev/ult-fx.py [창 수=6]
  개발 창 (머리 없는 크롬) 여러 개에서 필살기 모음 (ULT_LIB) 한 줄씩 window.pokemonFx.ult(…, { entry }) 로 돌려,
  필살기 본편 (기 모으기 0.8 + 컷인 0.9초 뒤) 이 시작한 때부터 상대를 처음 맞힌 때 (onHit) 까지 · 본편 길이를 잼.
  열쇠 = "이름|틀" (make-moves.py 가 모음 순서를 바꿔도 같음). 필살기 연출을 고치면 다시 돌림 → make-moves.py 가 묶음에 ULT_HIT 로 넣음"""
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
OUT = os.path.join(ROOT, "ult", "ult-hit.json")
FORMS = list(json.load(open(os.path.join(ROOT, "src", "game", "data", "generated", "forms.json"), encoding="utf-8")).keys())
# 일반 모드 필살기 앞 — 기 모으기 (게임 첫 필살기) · 컷인 · 끝 밝아짐 (ult/core.js · ult/bridge.js)
CHARGE_MS, INTRO_MS, OUTRO_MS = 800, 900, 500
WAIT_MAX_MS = 9000


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
        n = len(p)
        h = bytes([0x81]) + (bytes([0x80 | n]) if n < 126 else bytes([0x80 | 126]) + struct.pack(">H", n) if n < 65536 else bytes([0x80 | 127]) + struct.pack(">Q", n))
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


# 모음의 필살기마다 처음 가진 모습 — 열쇠 "이름|틀"
KEYS = r"""
((forms) => {
  const w = document.querySelector('iframe').contentWindow;
  const lib = w.__ult.lib();
  const out = {};
  for (const f of forms) for (const e of w.__ult.of(f) || []) {
    const key = `${e[0]}|${e[1]}`;
    if (!(key in out)) out[key] = [f, lib.indexOf(e)];
  }
  return out;
})(%FORMS%)
"""
# 한 줄 재기 — 맞는 때 (본편 시작부터 ms, 못 맞히면 -1) · 본편 길이
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
  const src = { el: meBox.querySelector('.pg-sprite'), box: meBox, form, size: 32, left: false, name: 'x' };
  const dst = { el: foeBox.querySelector('.pg-sprite'), box: foeBox, form: 'butterfree', size: 32, left: true };
  let hit = -1;
  const t0 = w.performance.now();
  const total = fx.ult(src, dst, () => { if (hit < 0) hit = w.performance.now() - t0; }, [], { entry: lib[idx] });
  if (!total) return [-2, 0];
  const lead = cfg.charge + cfg.intro;
  const limit = Math.min(total, lead + cfg.wait);
  while (hit < 0 && w.performance.now() - t0 < limit) await new Promise((r) => w.setTimeout(r, 40));
  fx.clear();
  return [hit < 0 ? -1 : Math.round(hit - lead), Math.round(total - lead - cfg.outro)];
})(%FORM%, %IDX%, %CFG%)
"""


def browser_page():
    spec = importlib.util.spec_from_file_location("gs", os.path.join(ROOT, "dev", "game-shots.py"))
    gs = importlib.util.module_from_spec(spec)
    argv = sys.argv
    sys.argv = [argv[0]]
    spec.loader.exec_module(gs)
    sys.argv = argv
    httpd, port = gs.serve()
    url = f"http://127.0.0.1:{port}/dev/frame.html?" + urllib.parse.urlencode({"w": 860, "h": 187, "page": "game.html", "q": urllib.parse.urlencode({"screen": "game", "battle": "choose", "fx": "1", "shim": "1", "foe": "butterfree:12"})})
    dbg = 9300 + os.getpid() % 600
    prof = tempfile.mkdtemp()
    p = subprocess.Popen([gs.browser(), "--headless=new", "--disable-gpu", f"--remote-debugging-port={dbg}", f"--user-data-dir={prof}", "--window-size=860,187", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    ws_url = None
    for _ in range(150):
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
    ws.call("Emulation.setDeviceMetricsOverride", {"width": 860, "height": 187, "deviceScaleFactor": 1, "mobile": False})
    ws.call("Page.navigate", {"url": url})
    time.sleep(3)
    return ws, p, httpd


def worker(k, n, out):
    ws, p, httpd = browser_page()
    try:
        keys = ws.call("Runtime.evaluate", {"expression": KEYS.replace("%FORMS%", json.dumps(FORMS)), "returnByValue": True})["result"]["value"]
        mine = sorted(keys)[k::n]
        res = {}
        cfg = json.dumps({"charge": CHARGE_MS, "intro": INTRO_MS, "outro": OUTRO_MS, "wait": WAIT_MAX_MS})
        for key in mine:
            form, idx = keys[key]
            r = ws.call("Runtime.evaluate", {"expression": ONE.replace("%FORM%", json.dumps(form)).replace("%IDX%", str(idx)).replace("%CFG%", cfg), "awaitPromise": True, "returnByValue": True})
            res[key] = r.get("result", {}).get("value") or [-3, 0]
        json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False)
    finally:
        subprocess.run(["taskkill", "/PID", str(p.pid), "/T", "/F"], capture_output=True)
        httpd.shutdown()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--worker":
        worker(int(sys.argv[2]), int(sys.argv[3]), sys.argv[4])
        sys.exit(0)
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 6
    tmp = tempfile.mkdtemp()
    t0 = time.time()
    procs = [subprocess.Popen([sys.executable, __file__, "--worker", str(k), str(n), os.path.join(tmp, f"w{k}.json")]) for k in range(n)]
    for q in procs:
        q.wait()
    merged = {}
    for k in range(n):
        f = os.path.join(tmp, f"w{k}.json")
        if os.path.exists(f):
            merged.update(json.load(open(f, encoding="utf-8")))
    out = dict(sorted(merged.items()))
    open(OUT, "w", encoding="utf-8", newline="\n").write(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n")
    hits = sorted(v[0] for v in out.values() if v[0] >= 0)
    miss = sum(1 for v in out.values() if v[0] < 0)
    print(f"필살기 {len(out)} · 맞음 {len(hits)} · 못 맞힘 {miss} · 맞는 때 가운데 {hits[len(hits) // 2] if hits else '-'}ms (최소 {hits[0] if hits else '-'} · 최대 {hits[-1] if hits else '-'}) · {time.time() - t0:.0f}초 → {os.path.relpath(OUT, ROOT)}")
