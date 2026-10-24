"""기술마다 일반 모드 연출 길이 · 맞는 때 · 닿는 기술인지 → src/game/data/generated/move-fx.json (2026-10-21 orders #19 · 3:3 연출 방향)
  python dev/move-fx.py
  3:3 은 엔진이 연출을 기다리지 않아서 (실시간) 기술 박자를 연출 길이에 맞춰 둠 — 맞는 순간과 피해 숫자가 같게 (UX U2).
  개발 창 (머리 없는 크롬) 에서 window.pokemonFx.plan(모습, 기술) 을 여러 모습으로 불러 가운데 값 · 틀 이름으로 정함.
  맞는 때 = 틀마다 (BattleFx SHOT_HIT_AT 와 같은 값) · 연출 묶음 (make-moves.py) 이 바뀌면 다시 돌림"""
import base64
import importlib.util
import json
import os
import re
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
sys.argv = [sys.argv[0]]
spec.loader.exec_module(gs)
OUT = os.path.join(ROOT, "src", "game", "data", "generated", "move-fx.json")
MOVES = json.load(open(os.path.join(ROOT, "src", "game", "data", "generated", "moves.json"), encoding="utf-8"))
# 몸 모양 (POKEMON_SHAPE 세기) 이 다른 여럿 — 가운데 값
FORMS = ["bulbasaur", "charmander", "squirtle", "pikachu", "pidgey", "geodude", "gastly", "onix", "snorlax", "caterpie", "mew", "dragonite"]
# 쏘는 기술이 상대에 닿는 때 (연출 길이의 몇 %) — features/battle/fx/shot-hit.ts 에서 읽음 (표가 한 벌이게 — 코드 리뷰어)
_SRC = open(os.path.join(ROOT, "src", "game", "features", "battle", "fx", "shot-hit.ts"), encoding="utf-8").read()
HIT_AT = {k: float(v) for k, v in re.findall(r"(\w+): ([\d.]+)", re.search(r"SHOT_HIT_AT[^{]*\{([^}]*)\}", _SRC).group(1))}
HIT_DEFAULT = float(re.search(r"SHOT_HIT_DEFAULT = ([\d.]+)", _SRC).group(1))


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


moves = [{"id": int(k), "name": v["name"]["ko"], "type": v["type"]} for k, v in MOVES.items()]
PROBE = r"""
((moves, forms) => {
  const fx = document.querySelector('iframe').contentWindow.pokemonFx;
  return moves.map((m) => forms.map((f) => fx.plan(f, { name: m.name, type: m.type })).filter(Boolean).map((p) => [p.fx, p.ms, p.contact]));
})(%MOVES%, %FORMS%)
"""

httpd, port = gs.serve()
url = f"http://127.0.0.1:{port}/dev/frame.html?" + urllib.parse.urlencode({"w": 860, "h": 187, "page": "game.html", "q": urllib.parse.urlencode({"screen": "game", "battle": "choose", "fx": "1", "shim": "1"})})
# 빈 포트 (OS 가 고름) — pid % 500 이면 두 세션 (워크트리) 이 같은 포트를 잡아 결과가 섞이던 것 (2026-10-22 워크트리 시험 ⑥)
_dbg_sock = socket.socket()
_dbg_sock.bind(("127.0.0.1", 0))
dbg = _dbg_sock.getsockname()[1]
_dbg_sock.close()
with tempfile.TemporaryDirectory(prefix=gs.PROF_PREFIX, ignore_cleanup_errors=True) as prof:
    p = subprocess.Popen([gs.browser(), "--headless=new", "--disable-gpu", "--edge-skip-compat-layer-relaunch", f"--remote-debugging-port={dbg}", f"--user-data-dir={prof}", "--window-size=860,187", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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
        ws.call("Page.navigate", {"url": url})
        time.sleep(3)
        r = ws.call("Runtime.evaluate", {"expression": PROBE.replace("%MOVES%", json.dumps(moves, ensure_ascii=False)).replace("%FORMS%", json.dumps(FORMS)), "returnByValue": True})
        rows = r.get("result", {}).get("value")
        if not isinstance(rows, list):
            sys.exit(f"plan 실패: {r}")
    finally:
        gs.kill_browser(p, prof)
        httpd.shutdown()

out = {}
for m, plans in zip(moves, rows):
    if not plans:
        continue
    kinds = {}
    for k, _, _ in plans:
        kinds[k] = kinds.get(k, 0) + 1
    kind = max(kinds, key=kinds.get)
    ms = sorted(ms for k, ms, _ in plans if k == kind)
    contact = any(c for k, _, c in plans if k == kind)
    med = ms[len(ms) // 2]
    # [연출 ms, 맞는 때 ‰, 닿는 기술 1/0, 틀]
    out[str(m["id"])] = [int(round(med)), int(round(HIT_AT.get(kind, HIT_DEFAULT) * 1000)), 1 if contact else 0, kind]
open(OUT, "w", encoding="utf-8", newline="\n").write(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n")
lens = sorted(v[0] for v in out.values())
print(f"기술 {len(out)}/{len(moves)} · 닿는 기술 {sum(v[2] for v in out.values())} · 길이 가운데 {lens[len(lens) // 2]}ms (최소 {lens[0]} · 최대 {lens[-1]}) → {os.path.relpath(OUT, ROOT)}")
