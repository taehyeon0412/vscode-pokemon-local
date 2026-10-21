"""모습 · 필살기마다 "큰 맞음" 때 · 연출 길이 · 자기 둘레에서 터지는지 재기 → ult/ult-hit.json (2026-10-21 — 3:3 합동 필살기 박자 · 터짐 옮기기 · 기획 #88 시뮬)
  python dev/ult-fx.py [창 수=6]
  개발 창 (머리 없는 크롬) 여러 개에서 필살기 모음 (ULT_LIB) 한 줄씩 window.pokemonFx.ult(…, { entry }) 로 돌려,
  디자인팀 6판 3:3 자리에서 필살기 본편 (기 모으기 0.8 + 컷인 0.9초 뒤) 이 시작한 때부터 큰 맞음 (가장 센 번쩍 뒤 처음 맞음 — 빛줄기 닿음 · 대폭발) 까지 · 본편 길이 · 자기 둘레 터짐 (1/0).
  처음 맞음으로 재면 솔라빔의 하늘 빛기둥처럼 작은 닿음이 잡혀 합동 박자가 어긋났음 (디자인팀 6판). 같은 필살기도 모습마다 박자가 달라 "모습|이름|틀" 로 잼.
  필살기 연출을 고치면 다시 돌림 → make-moves.py 가 묶음에 ULT_HIT 로 넣음"""
import base64
import importlib.util
import json
import os
import shutil
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
WAIT_MAX_MS = 11000


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


# 모습마다 그 모습이 가진 필살기 — 열쇠 "모습|이름|틀" (같은 필살기도 모습 · 몸 크기에 따라 박자가 다름)
KEYS = r"""
((forms) => {
  const w = document.querySelector('iframe').contentWindow;
  const lib = w.__ult.lib();
  const out = {};
  for (const f of forms) for (const e of w.__ult.of(f) || []) out[`${f}|${e[0]}|${e[1]}`] = [f, lib.indexOf(e)];
  return out;
})(%FORMS%)
"""
# 한 줄 재기 — 3:3 자리 (디자인팀 6판: 가운데 줄 x 215 → 645) 에 세워 필살기 끝까지 돌리며 번쩍 · 맞음 · 입자 가운데를 적음.
# 큰 맞음 = 가장 센 번쩍 (컷인 번쩍 빼고) 뒤 처음 맞는 때 (1.5초 안에 없으면 그 번쩍)
# 자기 둘레 = 그 번쩍 0.2초 뒤 입자 가운데가 쓴 쪽에 더 가까움 + 번쩍에서 맞기까지 0.4초 넘게 (퍼져서 닿음 — 블래스트번 약 0.9초) — 광선은 번쩍 뒤 곧 닿아서 아님 (솔라빔 약 0.27초)
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
  const place = (box, cx) => {
    box.style.marginLeft = '0px';
    const r = box.getBoundingClientRect();
    box.style.marginLeft = `${Math.round(cx - (r.left + r.width / 2))}px`;
  };
  place(meBox, cfg.meX);
  place(foeBox, cfg.foeX);
  const src = { el: meBox.querySelector('.pg-sprite'), box: meBox, form, size: 32, left: false, name: 'x' };
  const dst = { el: foeBox.querySelector('.pg-sprite'), box: foeBox, form: 'butterfree', size: 32, left: true };
  w.__fxTrace = [];
  const samples = [];
  const t0 = w.performance.now();
  const total = fx.ult(src, dst, () => {}, [], { entry: lib[idx] });
  if (!total) {
    w.__fxTrace = null;
    return [-2, 0, 0];
  }
  const lead = cfg.charge + cfg.intro;
  const until = Math.min(total, lead + cfg.wait);
  // 상대 둘레 (몸 폭만큼 넓힌 칸) — 덮는 연출 재기
  const fr = foeBox.getBoundingClientRect();
  const box = [fr.left - fr.width * 0.5, fr.top - fr.height * 0.5, fr.right + fr.width * 0.5, fr.bottom + fr.height * 0.25];
  while (w.performance.now() - t0 < until) {
    await new Promise((r) => w.setTimeout(r, 40));
    samples.push([w.performance.now() - t0 - lead, w.__fxDebug.centroid(), w.__fxDebug.near(...box)]);
  }
  const tr = w.__fxTrace.map((x) => [x[0], x[1] - t0 - lead, x[2]]);
  w.__fxTrace = null;
  fx.clear();
  const flashes = tr.filter((x) => x[0] === 'f' && x[1] > 0);
  const hits = tr.filter((x) => x[0] === 'h').map((x) => x[1]);
  const big = flashes.reduce((m, x) => (!m || x[2] > m[2] ? x : m), null);
  let main = -1;
  let self = 0;
  if (big) {
    const after = hits.find((h) => h >= big[1] - 50 && h <= big[1] + 1500);
    main = Math.round(after ?? big[1]);
    const near = samples.reduce((m, s) => (s[1] && (!m || Math.abs(s[0] - big[1] - 200) < Math.abs(m[0] - big[1] - 200)) ? s : m), null);
    // 자기 둘레 = 번쩍 0.2초 뒤에도 · 맞기 직전 (큰 맞음 0.15초 전) 에도 입자 가운데가 쓴 쪽 (느리게 날아가는 구 · 덩굴 (메가런처 · 하드플랜트) 은 맞기 직전엔 상대 쪽 — 코드 리뷰어)
    const pre = samples.reduce((m, s) => (s[1] && (!m || Math.abs(s[0] - main + 150) < Math.abs(m[0] - main + 150)) ? s : m), null);
    const mine = (s) => s && Math.abs(s[1].x - cfg.meX) < Math.abs(s[1].x - cfg.foeX);
    if (near && pre && main - big[1] > 400) self = mine(near) && mine(pre) ? 1 : 0;
    // 쏘는 필살기로 고정 — 쏘는 쪽 둘레 입자 (대포) 가 많아 가운데로는 못 가림 (거북왕 메가런처 = 물 구를 쏨, fx-sky.js — 코드 리뷰어)
    if (['메가런처'].includes(lib[idx][0])) self = 0;
  } else if (hits.length) {
    main = Math.round(hits[0]);
  }
  // 덮음 끝 = 큰 맞음 뒤 상대 둘레에 입자가 3개 이상 있던 마지막 때 (없으면 -1) — 쓰러진 포켓몬이 연출이 다 걷힌 뒤 넘어지게 (디자인팀 — 개구마르 등)
  const covered = samples.filter((s) => s[0] >= main && s[2] >= 3);
  const cover = main >= 0 && covered.length ? Math.round(covered[covered.length - 1][0]) : -1;
  // [큰 맞음, 본편 길이, 자기 둘레, 가장 센 번쩍 (없으면 -1), 덮음 끝 (없으면 -1)]
  return [main, Math.round(total - lead - cfg.outro), self, big ? Math.round(big[1]) : -1, cover];
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
    browser_page.prof = prof
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
        cfg = json.dumps({"charge": CHARGE_MS, "intro": INTRO_MS, "outro": OUTRO_MS, "wait": WAIT_MAX_MS, "meX": 215, "foeX": 645})
        for key in mine:
            form, idx = keys[key]
            r = ws.call("Runtime.evaluate", {"expression": ONE.replace("%FORM%", json.dumps(form)).replace("%IDX%", str(idx)).replace("%CFG%", cfg), "awaitPromise": True, "returnByValue": True})
            res[key] = r.get("result", {}).get("value") or [-3, 0, 0]
        json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False)
    finally:
        subprocess.run(["taskkill", "/PID", str(p.pid), "/T", "/F"], capture_output=True)
        httpd.shutdown()
        # 크롬 프로필 폴더는 지움 (%TEMP% 에 쌓이지 않게 — 코드 리뷰어)
        shutil.rmtree(getattr(browser_page, 'prof', ''), ignore_errors=True)


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
    shutil.rmtree(tmp, ignore_errors=True)
    out = dict(sorted(merged.items()))
    open(OUT, "w", encoding="utf-8", newline="\n").write(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n")
    hits = sorted(v[0] for v in out.values() if v[0] >= 0)
    miss = sum(1 for v in out.values() if v[0] < 0)
    selfs = sum(1 for v in out.values() if len(v) > 2 and v[2] == 1)
    print(f"모습 · 필살기 {len(out)} · 큰 맞음 {len(hits)} · 못 잼 {miss} · 자기 둘레 터짐 {selfs} · 큰 맞음 가운데 {hits[len(hits) // 2] if hits else '-'}ms (최소 {hits[0] if hits else '-'} · 최대 {hits[-1] if hits else '-'}) · {time.time() - t0:.0f}초 → {os.path.relpath(OUT, ROOT)}")
