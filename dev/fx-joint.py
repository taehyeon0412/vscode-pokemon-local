"""3:3 합동 필살기 합쳐지는 마무리 찍기 (2026-10-21 — 디자인팀 시안 6판 "솔라빔 + 블라스트번")
  python dev/fx-joint.py <out_dir> [창=860x187] [초=6] [k=v ...]
    a=venusaur:솔라빔:grass  b=charizard:블래스트번:fire  [c=<모습>:<필살기 이름>:<타입>]  foe=butterfree:12  sure=1 (3:1 압도)  list=1 (그 포켓몬 필살기 이름만 보기)  fps=1 (찍지 않고 PC 부담만)  layout=team (디자인팀 6판 3:3 자리)
  전투 장면 (battle=choose) 의 내 포켓몬을 a 로 바꾸고 b · c 를 뒤에 세워 window.pokemonFx.ultJoint 를 부름 — 0.06 ~ 0.08초마다 찍음 (f_<ms>.png)
  모양 · 박자는 엔진 없이 연출만 (게임에 붙는 건 3:3 화면 단계)"""
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
args = sys.argv[1:]
sys.argv = [sys.argv[0]]
spec.loader.exec_module(gs)
pos = [a for a in args if "=" not in a]
kv = dict(a.split("=", 1) for a in args if "=" in a)
out = pos[0] if pos else os.path.join(ROOT, "dev", "out-joint")
win = pos[1] if len(pos) > 1 else "860x187"
secs = float(pos[2]) if len(pos) > 2 else 6.0
os.makedirs(out, exist_ok=True)
for f in os.listdir(out):
    if f.startswith("f_"):
        os.remove(os.path.join(out, f))


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


def part(v):
    form, name, typ = (v.split(":") + ["", ""])[:3]
    return {"form": form, "pick": name or None, "type": typ or "normal"}


parts = [part(kv.get("a", "venusaur:솔라빔:grass")), part(kv.get("b", "charizard:블라스트번:fire"))] + ([part(kv["c"])] if kv.get("c") else [])
foe_form = kv.get("foe", "butterfree:12").split(":")[0]

# 내 칸 그림을 바꾸고 · 뒤에 복제 칸을 세움 (그림 주소의 모습 이름만 바꿈)
PROBE = r"""
((parts, foeForm, sure, list, team) => {
  const w = document.querySelector('iframe').contentWindow;
  const d = w.document;
  const fx = w.pokemonFx;
  if (!fx || !fx.ultJoint) return { error: 'no ultJoint' };
  if (list) return parts.map((p) => ({ form: p.form, ults: (w.__ult.of(p.form) || []).map((e) => e[0]) }));
  // 1:1 메뉴 · 말 상자는 숨김 (사진에 3:3 처럼 연출만)
  d.querySelectorAll('.pg-bmenu-wrap, .pg-bmsg').forEach((el) => (el.style.visibility = 'hidden'));
  const meBox = d.querySelector('.pg-fighter-me');
  const meImg = meBox.querySelector('.pg-sprite');
  const src0 = meImg.getAttribute('src');
  const from = (src0.match(/\/([a-z0-9-]+)\/[^/]*$/) || [])[1];
  const actors = parts.map((p, i) => {
    let box = meBox;
    if (i > 0) {
      box = meBox.cloneNode(true);
      box.classList.remove('pg-fighter-me');
      meBox.parentNode.appendChild(box);
      box.style.marginLeft = `${-46 * i}px`;
      box.style.marginBottom = `${18 * i}px`;
      box.style.zIndex = String(2 - i);
    }
    const img = box.querySelector('.pg-sprite');
    if (from) img.setAttribute('src', src0.replace(`/${from}/`, `/${p.form}/`));
    return { el: img, box, form: p.form, size: 32, left: false };
  });
  const foeBox = d.querySelector('.pg-fighter-foe');
  const foe = { el: foeBox.querySelector('.pg-sprite'), box: foeBox, form: foeForm, size: 32, left: true };
  // layout=team — 디자인팀 6판 3:3 자리 (860 × 187: 내 편 x 155 · 215 · 275 / 상대 가운데 x 645, 발 y 112 · 138 · 164) 에 세움
  if (team) {
    const place = (box, cx, feet) => {
      box.style.marginLeft = '0px';
      box.style.marginTop = '0px';
      box.style.marginBottom = '0px';
      const r = box.getBoundingClientRect();
      box.style.marginLeft = `${Math.round(cx - (r.left + r.width / 2))}px`;
      box.style.marginTop = `${Math.round(feet - r.bottom)}px`;
      const r2 = box.getBoundingClientRect();
      if (Math.abs(r2.bottom - feet) > 2) {
        box.style.marginTop = '0px';
        box.style.marginBottom = `${Math.round(r2.bottom - feet)}px`;
      }
    };
    actors.forEach((a, i) => place(a.box, [155, 215, 275][i], [112, 138, 164][i]));
    place(foeBox, 645, 138);
  }
  w.__jointHit = 0;
  // 화면 갱신 간격 (fps=1 — PC 부담)
  w.__fd = [];
  let last = w.performance.now();
  const loop = (t) => { w.__fd.push(t - last); last = t; if (w.__fd.length < 2000) w.requestAnimationFrame(loop); };
  w.requestAnimationFrame(loop);
  const t0 = performance.now();
  const ms = fx.ultJoint(actors, foe, () => { w.__jointHit = performance.now() - t0; }, { types: parts.map((p) => p.type), pick: parts.map((p) => p.pick), sure });
  return { ms };
})(%PARTS%, %FOE%, %SURE%, %LIST%, %TEAM%)
"""

httpd, port = gs.serve()
w, h = win.split("x")
q = {"screen": "game", "look": "may", "size": "medium", "battle": "choose", "fx": "1", "shim": "1", "foe": kv.get("foe", "butterfree:12")}
url = f"http://127.0.0.1:{port}/dev/frame.html?" + urllib.parse.urlencode({"w": w, "h": h, "page": "game.html", "q": urllib.parse.urlencode(q)})
dbg = 9300 + os.getpid() % 500
with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as prof:
    p = subprocess.Popen([gs.browser(), "--headless=new", "--disable-gpu", f"--remote-debugging-port={dbg}", f"--user-data-dir={prof}", f"--window-size={w},{h}", "--hide-scrollbars", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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
        ws.call("Emulation.setDeviceMetricsOverride", {"width": int(w), "height": int(h), "deviceScaleFactor": 1, "mobile": False})
        ws.call("Page.navigate", {"url": url})
        time.sleep(3)
        expr = PROBE.replace("%PARTS%", json.dumps(parts, ensure_ascii=False)).replace("%FOE%", json.dumps(foe_form)).replace("%SURE%", "true" if kv.get("sure") == "1" else "false").replace("%LIST%", "true" if kv.get("list") == "1" else "false").replace("%TEAM%", "true" if kv.get("layout") == "team" else "false")
        t0 = time.time()
        r = ws.call("Runtime.evaluate", {"expression": expr, "returnByValue": True})
        print(json.dumps(r.get("result", {}).get("value") or r, ensure_ascii=False))
        if kv.get("fps") == "1":
            time.sleep(secs)
            st = ws.call("Runtime.evaluate", {"expression": "(() => { const d = [...document.querySelector('iframe').contentWindow.__fd].slice(1).sort((a, b) => a - b); const avg = d.reduce((s, x) => s + x, 0) / d.length; return { fps: Math.round(1000 / avg), p95: Math.round(d[Math.floor(d.length * 0.95)]), max: Math.round(d[d.length - 1]), over50: d.filter((x) => x > 50).length, peak: document.querySelector('iframe').contentWindow.__ult.count() }; })()", "returnByValue": True})
            print("부담", json.dumps(st.get("result", {}).get("value"), ensure_ascii=False))
        elif kv.get("list") != "1":
            n = 0
            while (time.time() - t0) < secs:
                shot = ws.call("Page.captureScreenshot", {"format": "png"})
                ms = int((time.time() - t0) * 1000)
                if "data" in shot:
                    open(os.path.join(out, f"f_{ms:05d}.png"), "wb").write(base64.b64decode(shot["data"]))
                    n += 1
            hit = ws.call("Runtime.evaluate", {"expression": "document.querySelector('iframe').contentWindow.__jointHit", "returnByValue": True})
            print("frames", n, "· 합쳐진 폭발", hit.get("result", {}).get("value"), "ms")
    finally:
        subprocess.run(["taskkill", "/PID", str(p.pid), "/T", "/F"], capture_output=True)
        httpd.shutdown()
