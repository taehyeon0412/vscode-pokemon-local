"""모습 · 필살기마다 "큰 맞음" 때 · 연출 길이 · 자기 둘레에서 터지는지 재기 → ult/ult-hit.json (2026-10-21 — 3:3 합동 필살기 박자 · 터짐 옮기기 · 기획 #88 시뮬)
  python dev/ult-fx.py [창 수=2] [이름 걸러내기=]   (걸러내기 = "모습|이름|틀" 일부 · 쉼표로 여럿 — 그 줄만 다시 재고 나머지는 예전 값 그대로, #113 블래스트번처럼 연출 하나를 바꿨을 때)
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

# PG_ROOT = 다른 워크트리의 빌드로 잼 (디자인 브랜치 연출) · FX_OUT = 결과 파일 (그 워크트리 파일을 안 건드리게 — 시작 값은 그 파일)
ROOT = os.environ.get("PG_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get("FX_OUT") or os.path.join(ROOT, "ult", "ult-hit.json")
FORMS = list(json.load(open(os.path.join(ROOT, "src", "game", "data", "generated", "forms.json"), encoding="utf-8")).keys())
# 일반 모드 필살기 앞 — 기 모으기 (게임 첫 필살기) · 컷인 · 끝 밝아짐 (ult/core.js · ult/bridge.js)
CHARGE_MS, INTRO_MS, OUTRO_MS = 800, 900, 500
WAIT_MAX_MS = 11000
# 덮음 = 상대 몸 칸 (그림 칸에서 발 쪽 아래 1/4 뺌) 안에 그려진 점이 그 넓이의 이만큼 이상 (흩어진 불씨 · 반짝이 빼기 — 디자인팀 UX 8차 · 바닥을 따라 퍼진 불 띠가 발만 덮는 것도 빼기 — UX 9차 블래스트번 480)
COVER_AREA = 0.1
# 자기 둘레 터짐 (self=1) 은 화면마다 덮음이 달라 (좁은 패널은 돔이 상대까지 덮음 — 디자인팀 UX 9차) 실제 1:1 화면 폭에서 자리를 옮기지 않고 잼 → 6번째 칸 [[내 · 상대 가운데 거리 px, 덮음 끝] …]
# (860 화면에서 거리만 바꾸면 그림 배율이 달라 돔 크기가 다르게 보임 — 240 에서 돔이 걷히기 전에 넘어지던 것)
SELF_WIDTHS = [240, 480, 860, 1860]
GAP = r"""
(() => {
  const d = document.querySelector('iframe').contentWindow.document;
  const c = (sel) => { const r = d.querySelector(sel).getBoundingClientRect(); return r.left + r.width / 2; };
  return Math.round(Math.abs(c('.pg-fighter-foe') - c('.pg-fighter-me')));
})()
"""


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
  // natural = 그 폭의 실제 1:1 자리 그대로 (자기 둘레 터짐 — 화면 폭마다 덮음 끝)
  if (!cfg.natural) {
    place(meBox, cfg.meX);
    place(foeBox, cfg.foeX);
  }
  const src = { el: meBox.querySelector('.pg-sprite'), box: meBox, form, size: 32, left: false, name: 'x' };
  const dst = { el: foeBox.querySelector('.pg-sprite'), box: foeBox, form: 'butterfree', size: 32, left: true };
  w.__fxTrace = [];
  // 어두워짐 · 번쩍 판은 안 그림 (화면 전체에 깔려 상대 칸이 늘 칠해진 것으로 셈 — 2026-10-21)
  w.__fxMeasure = true;
  const samples = [];
  const t0 = w.performance.now();
  const total = fx.ult(src, dst, () => {}, [], { entry: lib[idx] });
  if (!total) {
    w.__fxTrace = null;
    w.__fxMeasure = false;
    return [-2, 0, 0];
  }
  const lead = cfg.charge + cfg.intro;
  const until = Math.min(total, lead + cfg.wait);
  // 상대 둘레 (몸 폭만큼 넓힌 칸) — 덮는 연출 재기
  const fr = foeBox.getBoundingClientRect();
  const box = [fr.left - fr.width * 0.5, fr.top - fr.height * 0.5, fr.right + fr.width * 0.5, fr.bottom + fr.height * 0.25];
  // 상대 그림 칸 안에 실제로 그려진 연출 점 수 (캔버스 — 어두워짐 #05080f · 거의 투명한 점은 뺌). 흩어진 불씨 · 반짝이 몇 점 · 발만 덮는 바닥 불 띠는 덮음이 아님 (디자인팀 UX 8 · 9차)
  const sr = dst.el.getBoundingClientRect();
  const cell = [sr.left, sr.top, sr.right, sr.bottom - sr.height * 0.25];
  const cellArea = Math.max(1, (cell[2] - cell[0]) * (cell[3] - cell[1]));
  const painted = () => {
    let n = 0;
    for (const c of d.querySelectorAll('canvas')) {
      const r = c.getBoundingClientRect();
      const x0 = Math.max(cell[0], r.left);
      const y0 = Math.max(cell[1], r.top);
      const x1 = Math.min(cell[2], r.right);
      const y1 = Math.min(cell[3], r.bottom);
      if (x1 - x0 < 1 || y1 - y0 < 1 || !r.width || !r.height) continue;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) continue;
      const sx = c.width / r.width;
      const sy = c.height / r.height;
      const px = ctx.getImageData(Math.floor((x0 - r.left) * sx), Math.floor((y0 - r.top) * sy), Math.max(1, Math.round((x1 - x0) * sx)), Math.max(1, Math.round((y1 - y0) * sy))).data;
      let k = 0;
      for (let i = 0; i < px.length; i += 4) if (px[i + 3] >= 96 && Math.max(px[i], px[i + 1], px[i + 2]) >= 48) k += 1;
      n += k / (sx * sy);
    }
    return n;
  };
  while (w.performance.now() - t0 < until) {
    await new Promise((r) => w.setTimeout(r, 40));
    samples.push([w.performance.now() - t0 - lead, w.__fxDebug.centroid(), w.__fxDebug.near(...box), painted() / cellArea, w.__fxDebug.flashing?.() === true]);
  }
  const tr = w.__fxTrace.map((x) => [x[0], x[1] - t0 - lead, x[2]]);
  w.__fxTrace = null;
  w.__fxMeasure = false;
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
    if (['메가런처', '블래스트번'].includes(lib[idx][0])) self = 0; // 블래스트번 = 메가리자몽X 화염구를 쏨 (#113 — 디자인)
  } else if (hits.length) {
    main = Math.round(hits[0]);
  }
  // 덮음 끝 = 큰 맞음 뒤 상대 몸 칸에 그려진 점이 그 넓이의 10% 이상이던 마지막 때 (어두워짐 · 번쩍 판은 안 그리고 잼 · 없으면 -1) — 쓰러진 포켓몬이 연출이 다 걷힌 뒤 넘어지게 (디자인팀 — 개구마르 등).
  // 넓이 문턱 = 흩어진 불씨 · 반짝이만 떠 있을 때 1.6초 넘게 서 있던 것 (플레어드라이브 7163 → 보이는 불은 약 5800, 디자인팀 UX 8차).
  // 입자 개수는 안 봄 — 큰 돔 하나 (블래스트번, 가운데는 쓴 쪽) 는 상대 칸 안 입자가 0 이라 덮지 않는 것으로 재던 것 (240 에서 돔 밑에 넘어짐 — 디자인팀 UX 9차)
  const covered = samples.filter((s) => s[0] >= main && s[3] >= cfg.coverArea);
  const cover = main >= 0 && covered.length ? Math.round(covered[covered.length - 1][0]) : -1;
  // [큰 맞음, 본편 길이, 자기 둘레, 가장 센 번쩍 (없으면 -1), 덮음 끝 (없으면 -1)]
  return [main, Math.round(total - lead - cfg.outro), self, big ? Math.round(big[1]) : -1, cover];
})(%FORM%, %IDX%, %CFG%)
"""


def kill_browser(p):
    """browser_page 로 띄운 브라우저 끄기 (game-shots kill_browser — 같은 프로필의 남은 Edge 까지)"""
    browser_page.gs.kill_browser(p, getattr(browser_page, "prof", ""))


def browser_page():
    spec = importlib.util.spec_from_file_location("gs", os.path.join(ROOT, "dev", "game-shots.py"))
    gs = importlib.util.module_from_spec(spec)
    argv = sys.argv
    sys.argv = [argv[0]]
    spec.loader.exec_module(gs)
    sys.argv = argv
    httpd, port = gs.serve()
    browser_page.port = port
    url = f"http://127.0.0.1:{port}/dev/frame.html?" + urllib.parse.urlencode({"w": 860, "h": 187, "page": "game.html", "q": urllib.parse.urlencode({"screen": "game", "battle": "choose", "fx": "1", "shim": "1", "foe": "butterfree:12"})})
    # 빈 포트 (OS 가 고름) — pid % 500 이면 두 세션 (워크트리) 이 같은 포트를 잡아 결과가 섞이던 것 (2026-10-22 워크트리 시험 ⑥)
    _dbg_sock = socket.socket()
    _dbg_sock.bind(("127.0.0.1", 0))
    dbg = _dbg_sock.getsockname()[1]
    _dbg_sock.close()
    prof = tempfile.mkdtemp(prefix=gs.PROF_PREFIX)
    browser_page.prof = prof
    browser_page.gs = gs
    p = subprocess.Popen([gs.browser(), "--headless=new", "--disable-gpu", "--edge-skip-compat-layer-relaunch", f"--remote-debugging-port={dbg}", f"--user-data-dir={prof}", "--window-size=860,187", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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


def open_page(ws, w, form):
    """재는 화면 (1:1 전투) 을 그 폭으로 다시 엶"""
    url = f"http://127.0.0.1:{browser_page.port}/dev/frame.html?" + urllib.parse.urlencode({"w": w, "h": 187, "page": "game.html", "q": urllib.parse.urlencode({"screen": "game", "battle": "choose", "fx": "1", "shim": "1", "foe": "butterfree:12"})})
    ws.call("Emulation.setDeviceMetricsOverride", {"width": w, "height": 187, "deviceScaleFactor": 1, "mobile": False})
    ws.call("Page.navigate", {"url": url})
    time.sleep(1.5)
    page_keys(ws, [form])


def self_covers(ws, form, idx, far_cover):
    """자기 둘레 터짐 — 실제 1:1 화면 폭마다 [[내 · 상대 거리 px, 덮음 끝 (없으면 −1)] …] (3:3 자리 430px 값도 · 끝나면 860 재는 화면으로 되돌림)"""
    out = []
    try:
        for w in SELF_WIDTHS:
            open_page(ws, w, form)
            gap = ws.call("Runtime.evaluate", {"expression": GAP, "returnByValue": True}).get("result", {}).get("value") or 0
            cfg = json.dumps({"charge": CHARGE_MS, "intro": INTRO_MS, "outro": OUTRO_MS, "wait": WAIT_MAX_MS, "coverArea": COVER_AREA, "natural": True})
            r = ws.call("Runtime.evaluate", {"expression": ONE.replace("%FORM%", json.dumps(form)).replace("%IDX%", str(idx)).replace("%CFG%", cfg), "awaitPromise": True, "returnByValue": True})
            v = r.get("result", {}).get("value") or []
            out.append([gap, v[4] if len(v) >= 5 else -1])
    finally:
        open_page(ws, 860, form)
    return sorted(out + [[645 - 215, far_cover]])


def page_keys(ws, forms):
    """필살기 목록 — 페이지 (게임 · 연출) 가 다 뜰 때까지 기다림 (3초 고정으로는 크롬 여섯이 같이 뜰 때 늦어 한 몫 (약 230개) 이 통째로 빠지던 것, 2026-10-21)"""
    for _ in range(60):
        r = ws.call("Runtime.evaluate", {"expression": KEYS.replace("%FORMS%", json.dumps(forms)), "returnByValue": True})
        v = r.get("result", {}).get("value")
        if isinstance(v, dict) and v:
            return v
        time.sleep(0.5)
    raise RuntimeError("페이지가 안 뜸")


def worker(k, n, out, filt=""):
    ws, p, httpd = browser_page()
    res = {}
    try:
        keys = page_keys(ws, FORMS)
        mine = [key for key in sorted(keys) if not filt or any(f in key for f in filt.split(","))][k::n]
        cfg = json.dumps({"charge": CHARGE_MS, "intro": INTRO_MS, "outro": OUTRO_MS, "wait": WAIT_MAX_MS, "coverArea": COVER_AREA, "meX": 215, "foeX": 645})
        for key in mine:
            form, idx = keys[key]
            r = ws.call("Runtime.evaluate", {"expression": ONE.replace("%FORM%", json.dumps(form)).replace("%IDX%", str(idx)).replace("%CFG%", cfg), "awaitPromise": True, "returnByValue": True})
            res[key] = r.get("result", {}).get("value") or [-3, 0, 0]
            if len(res[key]) >= 5 and res[key][2] == 1:
                res[key] = res[key][:5] + [self_covers(ws, form, idx, res[key][4])]
    finally:
        # 도중에 끊겨도 잰 데까지는 남김
        json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False)
        kill_browser(p)
        httpd.shutdown()
        # 크롬 프로필 폴더는 지움 (%TEMP% 에 쌓이지 않게 — 코드 리뷰어)
        shutil.rmtree(getattr(browser_page, 'prof', ''), ignore_errors=True)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--worker":
        worker(int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5] if len(sys.argv) > 5 else "")
        sys.exit(0)
    # 머리 없는 브라우저는 세션마다 2개까지 (game-dev-team 3장 정리 ④ · 2026-10-24 — 메모리 0.3 GB) · PG_MAX_BROWSERS 로만 늘림
    n = min(int(sys.argv[1]) if len(sys.argv) > 1 else 2, int(os.environ.get("PG_MAX_BROWSERS", 2)))
    filt = sys.argv[2] if len(sys.argv) > 2 else ""
    tmp = tempfile.mkdtemp()
    t0 = time.time()
    procs = [subprocess.Popen([sys.executable, __file__, "--worker", str(k), str(n), os.path.join(tmp, f"w{k}.json"), filt]) for k in range(n)]
    for q in procs:
        q.wait()
    merged = {}
    for k in range(n):
        f = os.path.join(tmp, f"w{k}.json")
        if os.path.exists(f):
            merged.update(json.load(open(f, encoding="utf-8")))
    shutil.rmtree(tmp, ignore_errors=True)
    # 못 잰 몫이 있으면 예전 값을 그대로 두고 알림 (표에서 통째로 빠지지 않게)
    try:
        prev = json.load(open(OUT, encoding="utf-8"))
    except (OSError, ValueError):
        prev = {}
    lost = [key for key in prev if key not in merged]
    if filt:
        print("다시 잰 줄:", {key: merged[key] for key in sorted(merged)})
    elif lost:
        print(f"못 잰 줄 {len(lost)}개 — 예전 값 그대로 (다시 재 보세요)")
    merged.update({key: prev[key] for key in lost})
    out = dict(sorted(merged.items()))
    open(OUT, "w", encoding="utf-8", newline="\n").write(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n")
    hits = sorted(v[0] for v in out.values() if v[0] >= 0)
    miss = sum(1 for v in out.values() if v[0] < 0)
    selfs = sum(1 for v in out.values() if len(v) > 2 and v[2] == 1)
    print(f"모습 · 필살기 {len(out)} · 큰 맞음 {len(hits)} · 못 잼 {miss} · 자기 둘레 터짐 {selfs} · 큰 맞음 가운데 {hits[len(hits) // 2] if hits else '-'}ms (최소 {hits[0] if hits else '-'} · 최대 {hits[-1] if hits else '-'}) · {time.time() - t0:.0f}초 → {os.path.relpath(OUT, ROOT)}")
