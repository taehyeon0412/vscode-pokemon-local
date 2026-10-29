"""기술 박자 자동 표 — 날아온 것이 닿는 때 ↔ 맞는 때 (맞는 빛 · 패링 원) 를 기술마다 재서 표로 (ideas 1658 · #122 3단계 도구, 2026-10-29)
  python dev/move-timing.py <폴더> [mv=22,59,…|look|@목록.json] [side=me,foe] [w=240,860] [h=187] [rep=3] [big=onix:95] [who=<모습>:<번호>] [contact=1] [raw=1]
  예) python dev/move-timing.py out mv=41,59,317          (세 기술 × 내 것 · 상대 것 × 240 · 860)
      워크트리에서는 PG_ROOT=<워크트리 경로> (그 폴더의 빌드 · 시험 창) · raw=1 = 지난번 <폴더>/raw 기록으로 다시 판정만 (브라우저 안 띄움)
  mv       기술 번호 (쉼표) · look = dev/move-look.json 의 모든 기술 · @파일 = JSON 목록 (번호, 또는 [번호, …] 줄 — 디자인 stage2-todo.json 처럼)
  side     me = 내가 씀 · foe = 상대가 씀 (패링 원)            w · h  패널 크기 (U2 — 뿜기 · 포물선은 상대까지 거리로 박자가 바뀜)
  rep      뿜기를 몇 번 잴지 (알갱이가 무작위 — 가장 이른 값)   big    뿜기에 더하는 큰 포켓몬 (입 높이 — 빈 값이면 안 함)
  who      쓰는 포켓몬을 모두 이것으로 (없으면 기술마다 지역 포켓몬 중 그 기술을 배우는 가장 앞 단계)
  contact  닿는 기술 (punch · slash · dash — 맞는 순간 상대 몸에 바로 그려져 어긋날 수 없음) 도 잼
결과: <폴더>/timing.json (판마다 값 · 걸림) · <폴더>/raw/<판>.json (rAF 기록) · 화면에 기술마다 한 줄 + 끝 요약.
값 = 맞는 때 (impact) 기준 ms (+ 늦음 · − 이름) · ±80 (한 장면) 넘으면 ✗ — ux-rules U2:
  날리기 first · last = 앞 끝 (가운데) 이 몸 상자 (그림 가운데 60% 폭 · 위 15% 아래) 에 처음 든 때 (다발은 첫 발 · 마지막 발) · px1 = 그린 점이 몸 상자에 처음 4개
  고리 first · last = 고리 앞 끝 (가운데 + 반지름) · 돌 first · last = 땅에 닿은 때 · 뿜기 t2 = 같은 높이 줄에서 앞머리가 실루엣 겉면을 2px 들어감 (rep 번 중 가장 이름 —
  기다리는 동안 겉면을 0 ~ 1px 스치는 touch 는 참고, UX 리뷰어 7바퀴와 같게)
  광선 · 그 밖 = px1 · 땅 흔들기 (quake) gpeak = 발밑 점 수가 가장 많은 장면 · shake = 맞는 쪽 그림이 가장 멀리 흔들린 첫 장면 (가장 큰 순간 = 맞는 때 — 기획 10-29)
  상대 것은 pring (패링 원이 닫힌 때) 도 · 판정 밖 (닿는 때가 없음): aura = 쓰는 쪽 둘레에서 퍼지는 고리 (상대엔 맞는 짜임만)
  참고 (판정 밖): touch · cov1 · mask2 실루엣 0px · 1% · 2% · pop 피해 숫자 · len 시전 → 맞는 때
머리 없는 브라우저 1개 (빈 디버그 포트 · 40판마다 새로) · 판마다 20초 안에 답이 없으면 "멈춤" 한 줄 · 남은 메모리 4 GB 아래면 시작 안 함 · 3 GB 아래면 멈추고 그때까지 표를 씀 (끝 코드 2)
게임 코드는 바꾸지 않음 — 맞는 짜임 (impact) 은 그리지 않고 부른 시각만 적음 (날아온 것 · 뿜기 그림만 남게)"""
import base64
import ctypes
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
a = sys.argv[1:]
sys.argv = [sys.argv[0]]
spec.loader.exec_module(gs)
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# 기술표 · 지역 · 모양표는 찍는 폴더 (PG_ROOT — 디자인 워크트리의 바뀐 move-look · move-fx) 에서
DATA = os.environ.get("PG_ROOT") or ROOT
GEN = os.path.join(DATA, "src", "game", "data", "generated")
TOL = 80
CASE_S = 20  # 판 하나 상한 (불러오기 + 시전 + 맞은 뒤 1.2초)
AFTER_MS = 1200  # 맞은 뒤 더 기록 (마지막 발 · 돌 · 피해 숫자)
RESTART = 40  # 이만큼마다 브라우저를 새로 (오래 쓰면 메모리가 늚)


class Stalled(Exception):
    """브라우저가 답하지 않음 (페이지가 멈춤 — bugs 1885 와 같은 종류)"""


class WS:
    def __init__(self, url):
        u = urllib.parse.urlparse(url)
        self.end = time.time() + CASE_S
        self.s = socket.create_connection((u.hostname, u.port))
        self._wait()
        key = base64.b64encode(os.urandom(16)).decode()
        self.s.sendall(f"GET {u.path} HTTP/1.1\r\nHost: {u.hostname}:{u.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n".encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            self._wait()
            c = self.s.recv(1)
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

    def eval(self, expr):
        return self.call("Runtime.evaluate", {"expression": expr, "returnByValue": True}).get("result", {}).get("value")


def free_gb():
    class M(ctypes.Structure):
        _fields_ = [("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong)] + [(f"q{i}", ctypes.c_ulonglong) for i in range(7)]
    m = M()
    m.dwLength = ctypes.sizeof(M)
    ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m))
    return m.q1 / 2**30


def load(name):
    return json.load(open(os.path.join(GEN, name), encoding="utf-8"))


def move_ids(spec_):
    if spec_ == "look":
        return [k for k in json.load(open(os.path.join(DATA, "dev", "move-look.json"), encoding="utf-8")) if not k.startswith("_")]
    if spec_.startswith("@"):
        return [str(x[0] if isinstance(x, list) else x) for x in json.load(open(spec_[1:], encoding="utf-8"))]
    return [x.strip() for x in spec_.split(",") if x.strip()]


def pickers():
    """기술마다 쓰는 포켓몬 — 지역 (core/rules/region.ts) 포켓몬 계열 중 그 기술을 배우는 가장 앞 단계 (디자인 shoot2.py 와 같게) · 없으면 아무나 · 그것도 없으면 이상해씨"""
    S, L, F = load("species.json"), load("learnsets.json"), load("forms.json")
    src = open(os.path.join(DATA, "src", "game", "core", "rules", "region.ts"), encoding="utf-8").read()
    ids = {int(x) for m in re.finditer(r"\[(\d+(?:\s*,\s*\d+)+)\]", src) for x in m.group(1).split(",")}

    def base(d):
        while S[str(d)].get("evolvesFrom") and str(S[str(d)]["evolvesFrom"]) in S:
            d = S[str(d)]["evolvesFrom"]
        return d

    fams = {base(d) for d in ids if str(d) in S}
    form_of = {}
    for name, f in F.items():
        form_of.setdefault(f["species"], name)
    key = lambda d: (S[str(d)].get("stage", 1), d)  # noqa: E731
    pool = sorted((int(k) for k in S if base(int(k)) in fams and int(k) in form_of), key=key)
    rest = sorted((int(k) for k in L if k in S and int(k) in form_of and int(k) not in set(pool)), key=key)

    def learns(d, mid):
        return any(str(r[1] if isinstance(r, list) else r) == mid for r in (L.get(str(d)) or []))

    def pick(mid):
        who = next((d for d in pool if learns(d, mid)), None) or next((d for d in rest if learns(d, mid)), None)
        return (form_of[who], who) if who else ("bulbasaur", 1)

    return pick


def plan(opt):
    fxs, moves = load("move-fx.json"), load("moves.json")
    pick = pickers()
    sides = opt.get("side", "me,foe").split(",")
    widths = [int(x) for x in opt.get("w", "240,860").split(",")]
    h = int(opt.get("h", "187"))
    rep = int(opt.get("rep", "3"))
    big = opt.get("big", "onix:95")
    who = opt.get("who")
    cases, skipped, unknown = [], [], []
    for mid in move_ids(opt.get("mv", "look")):
        fx = fxs.get(mid)
        if not fx:
            unknown.append(mid)
            continue
        tmpl, contact = fx[3], fx[2]
        if contact and opt.get("contact") != "1":
            skipped.append(mid)
            continue
        if who:
            form, dex = who.split(":")
            users = [(form, int(dex))]
        else:
            users = [pick(mid)]
        if tmpl == "breath" and big and not who:
            bf, bd = big.split(":")
            if (bf, int(bd)) != users[0]:
                users.append((bf, int(bd)))
        reps = rep if tmpl == "breath" else 1
        name = moves.get(mid, {}).get("name", {}).get("ko", "?")
        for side in sides:
            for w in widths:
                for form, dex in users:
                    for r in range(reps):
                        cid = f"{side}-{w}x{h}-{mid}-{form}" + (f"-r{r + 1}" if reps > 1 else "")
                        q = {"screen": "game", "look": "may", "size": "medium", "dur": "900", "fx": "1", "shim": "1",
                             "battle": "move", "side": side, "mv": mid, "fhp": "500", ("me" if side == "me" else "foe"): f"{form}:{dex}"}
                        cases.append(dict(id=cid, group=f"{side}-{w}x{h}-{mid}-{form}", mv=mid, name=name, tmpl=tmpl, side=side, w=w, h=h, form=form, q=q))
    return cases, skipped, unknown


def rel(x, imp):
    return None if x is None or imp is None else x - imp


def analyze(c, L):
    """한 판 → 값 (맞는 때 기준 ms) · 종류"""
    ev, fr = L["ev"], L["fr"]
    cast = next((e["t"] for e in ev if e["k"] == "move"), None)
    imp = next((e["t"] for e in ev if e["k"] in ("impact", "swat", "contactParry")), None)
    if cast is None or imp is None:
        return dict(err="연출 부름 없음 (move · impact)")
    after = [r for r in fr if r["t"] >= cast]
    v = dict(len=imp - cast)
    v["px1"] = rel(next((r["t"] for r in after if (r.get("body") or 0) >= 4), None), imp)
    v["mask2"] = rel(next((r["t"] for r in after if (r.get("mcov") or 0) >= 0.02), None), imp)
    v["pop"] = rel(next((r["t"] for r in fr if r.get("pop")), None), imp)
    if c["side"] == "foe":
        v["pring"] = rel(next((r["t"] for r in fr if r.get("ring") and r["ring"][1] is not None and r["ring"][0] <= r["ring"][1] + 0.01), None), imp)
    tr = sorted(L.get("tr", []), key=lambda u: u["t0"])
    P = [u for u in tr if u["k"] == "proj"]
    RG = [u for u in tr if u["k"] == "ring"]
    K = [u for u in tr if u["k"] == "rock"]
    look = LOOK.get(c["mv"], {})
    if c["tmpl"] == "quake":
        # 땅 흔들기 — 날아가는 것 없이 시전부터 상대 발밑이라 "가장 큰 순간" 을 잼 (기획 10-29: 금 · 튀어 오름 · 가장 센 흔들림 = 맞는 때 ±80)
        #   gpeak = 발밑 띠 점 수가 가장 많은 장면 (90% 에 처음 닿은 때) · shake = 맞는 쪽 그림이 제자리 (시전 전) 에서 가장 멀리 간 때 (가장 센 흔들림의 첫 장면)
        kind = "ground"
        win = [r for r in after if r["t"] <= imp + AFTER_MS]
        top = max((r.get("foot") or 0 for r in win), default=0)
        v["gpeak"] = rel(next((r["t"] for r in win if top and (r.get("foot") or 0) >= 0.9 * top), None), imp)
        rest = sorted(r["spr"][0] for r in fr if r["t"] < cast and r.get("spr") and r["spr"][2] > r["spr"][0])
        if rest:
            x0 = rest[len(rest) // 2]
            # 피해 숫자가 뜨면 맞은 쪽이 밀려남 (+11px 한쪽 — 흔들림 아님) → 그 전까지만 (숫자가 없으면 맞는 때 + 80ms)
            end = next((r["t"] for r in fr if r["t"] >= imp and r.get("pop")), imp + TOL)
            off = [(r["t"], abs(r["spr"][0] - x0)) for r in win if r["t"] < end and r.get("spr") and r["spr"][2] > r["spr"][0]]
            far = max((d for t_, d in off), default=0)
            v["shake"] = rel(next((t_ for t_, d in off if far >= 1 and d >= far), None), imp)
    elif RG and all(u.get("vx") == 0 for u in RG):
        # 쓰는 쪽 둘레에서 퍼지는 고리 (moves.js rings — forward 아님) — 상대에 닿는 것 없이 맞는 짜임만 맞는 때에 → 판정 밖
        kind = "aura"
    elif K:
        kind = "rock"
        land = [rel(u.get("tL", u.get("td")), imp) for u in K]
        ld = [x for x in land if x is not None]
        v.update(first=min(ld) if ld else None, last=max(ld) if ld else None, n=len(K))
    elif RG:
        kind = "ring"
        rb = [rel(u.get("tB"), imp) for u in RG]
        v.update(first=rb[0], last=rb[-1], n=len(RG))
    elif P:
        kind = "boomer" if look.get("boomerang") else ("multi" if len(P) > 1 else "single")
        tb = [x for x in (rel(u.get("tB"), imp) for u in P) if x is not None]
        v.update(first=min(tb) if tb else None, n=len(P))
        if kind == "multi":
            v["last"] = max(tb) if tb else None
    elif c["tmpl"] == "breath":
        kind = "breath"
        # touch = 겉면에 닿음 (0px) · t2 = 2px 들어감 (판정 — 기다리는 동안 겉면을 0 ~ 1px 스치는 것은 UX 리뷰어 7바퀴도 받아들임) · cov1 = 실루엣 1% 덮음
        dep = lambda k: rel(next((r["t"] for r in after if r.get("rdep") is not None and r["rdep"] >= k), None), imp)  # noqa: E731
        v["touch"], v["t2"] = dep(0), dep(2)
        v["cov1"] = rel(next((r["t"] for r in after if (r.get("mcov") or 0) >= 0.01), None), imp)
    else:
        kind = "px"
    return dict(kind=kind, v=v)


JUDGE = {"single": ["first", "px1"], "multi": ["first", "last", "px1"], "boomer": ["first", "px1"],
         "ring": ["first", "last", "px1"], "rock": ["first", "last"], "breath": ["t2"], "px": ["px1"], "ground": ["gpeak", "shake"], "aura": []}
NOTE = ["touch", "px1", "cov1", "mask2", "pop", "len"]


def judge(kind, side, v):
    keys = JUDGE[kind] + (["pring"] if side == "foe" else [])
    bad = [k for k in keys if v.get(k) is None or abs(v[k]) > TOL]
    return keys, bad


def fmt(x):
    return "없음" if x is None else f"{x:+d}"


def run(cases, out):
    httpd, port = gs.serve()
    rawd = os.path.join(out, "raw")
    os.makedirs(rawd, exist_ok=True)
    res, stop = {}, None
    p = prof = ws = None
    tmp = None
    poll = ("(() => { const f = document.querySelector('iframe'); const w = f && f.contentWindow; const L = w && w.__moveTiming;"
            " if (!L) return null; const e = L.ev.find((e) => e.k === 'impact' || e.k === 'swat' || e.k === 'contactParry');"
            " return e ? w.performance.now() - e.t : -1; })()")
    take = "JSON.stringify(document.querySelector('iframe').contentWindow.__moveTiming || null)"
    try:
        for i, c in enumerate(cases):
            if free_gb() < 3:
                stop = f"멈춤 — 남은 메모리 {free_gb():.1f} GB (3 GB 아래) · {i}/{len(cases)} 판에서"
                break
            if ws is None or i % RESTART == 0:
                if p:
                    gs.kill_browser(p, prof)
                    tmp.cleanup()
                tmp = tempfile.TemporaryDirectory(prefix=gs.PROF_PREFIX, ignore_cleanup_errors=True)
                prof = tmp.name
                s0 = socket.socket()
                s0.bind(("127.0.0.1", 0))
                dbg = s0.getsockname()[1]
                s0.close()
                p = subprocess.Popen([gs.browser(), "--headless=new", "--disable-gpu", "--edge-skip-compat-layer-relaunch", f"--remote-debugging-port={dbg}",
                                      f"--user-data-dir={prof}", "--window-size=1900,400", *gs.hide_scrollbars(), "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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
                ws = WS(ws_url)
                ws.call("Page.enable")
                ws.call("Page.addScriptToEvaluateOnNewDocument", {"source": LOGGER})
            ws.end = time.time() + CASE_S
            url = f"http://127.0.0.1:{port}/dev/frame.html?" + urllib.parse.urlencode({"w": c["w"], "h": c["h"], "page": "game.html", "q": urllib.parse.urlencode(c["q"])})
            ws.call("Emulation.setDeviceMetricsOverride", {"width": c["w"], "height": c["h"], "deviceScaleFactor": 1, "mobile": False})
            ws.call("Page.navigate", {"url": url})
            t0 = time.time()
            while time.time() - t0 < CASE_S - 2:
                time.sleep(0.25)
                since = ws.eval(poll)
                if since is not None and since >= AFTER_MS:
                    break
            raw = ws.eval(take)
            open(os.path.join(rawd, c["id"] + ".json"), "w", encoding="utf-8").write(raw or "null")
            L = json.loads(raw) if raw else None
            res[c["id"]] = analyze(c, L) if L else dict(err="기록 없음")
            ws.call("Page.navigate", {"url": "about:blank"})
            if (i + 1) % 20 == 0:
                print(f"  … {i + 1}/{len(cases)} 판", flush=True)
    except (Stalled, TimeoutError, EOFError, ConnectionError) as e:
        stop = f"멈춤 — {e if isinstance(e, Stalled) else '답이 없음'} · 판마다 상한 {CASE_S}초 · {len(res)}/{len(cases)} 판에서"
    finally:
        if p:
            gs.kill_browser(p, prof)
        if tmp:
            tmp.cleanup()
        httpd.shutdown()
    return res, stop


def table(cases, res):
    """판 → 묶음 (같은 기술 · 쪽 · 크기 · 포켓몬). 뿜기 rep 번은 값마다 가장 이른 것"""
    groups = {}
    for c in cases:
        r = res.get(c["id"])
        if r is None:
            continue
        g = groups.setdefault(c["group"], dict(mv=c["mv"], name=c["name"], tmpl=c["tmpl"], side=c["side"], size=f"{c['w']}x{c['h']}", form=c["form"], runs=[], errs=[]))
        (g["errs"] if "err" in r else g["runs"]).append(r)
    rows = []
    for g in groups.values():
        runs = [r for r in g["runs"] if "kind" in r]
        if not runs:
            rows.append(dict(**{k: g[k] for k in ("mv", "name", "tmpl", "side", "size", "form")}, kind=None, v={}, keys=[], bad=["기록 없음"], note=[e["err"] for e in g["errs"]]))
            continue
        kind = runs[0]["kind"]
        v = {}
        for k in set().union(*(r["v"] for r in runs)):
            xs = [r["v"].get(k) for r in runs if r["v"].get(k) is not None]
            v[k] = (min(xs) if k != "n" else max(xs)) if xs else None
        keys, bad = judge(kind, g["side"], v)
        rows.append(dict(**{k: g[k] for k in ("mv", "name", "tmpl", "side", "size", "form")}, kind=kind, runs=len(runs), v=v, keys=keys, bad=bad))
    return rows


def main():
    if not a or "=" in a[0]:
        print(__doc__)
        sys.exit(2)
    out = a[0]
    opt = dict(kv.split("=", 1) for kv in a[1:])
    os.makedirs(out, exist_ok=True)
    g = free_gb()
    if g < 4 and opt.get("raw") != "1":
        print(f"멈춤 — 남은 메모리 {g:.1f} GB (4 GB 아래 · 정리부터: python dev/cleanup.py)")
        sys.exit(2)
    cases, skipped, unknown = plan(opt)
    nmv = len({c["mv"] for c in cases})
    print(f"기술 {nmv} · 판 {len(cases)} · 닿는 기술 건너뜀 {len(skipped)}" + (f" · 모르는 번호 {','.join(unknown)}" if unknown else ""), flush=True)
    t = time.time()
    if opt.get("raw") == "1":
        # 다시 판정만 — 지난번 <폴더>/raw 기록으로 (브라우저 안 띄움)
        res, stop = {}, None
        for c in cases:
            f = os.path.join(out, "raw", c["id"] + ".json")
            if os.path.exists(f):
                L = json.load(open(f, encoding="utf-8"))
                res[c["id"]] = analyze(c, L) if L else dict(err="기록 없음")
    else:
        res, stop = run(cases, out)
    rows = table(cases, res)
    order = {m: i for i, m in enumerate(dict.fromkeys(c["mv"] for c in cases))}
    rows.sort(key=lambda r: (order[r["mv"]], r["side"], int(r["size"].split("x")[0]), r["form"]))
    red = os.isatty(1)
    for r in rows:
        js = " ".join(f"{k} {fmt(r['v'].get(k))}" for k in r["keys"])
        ns = " ".join(f"{k} {fmt(r['v'].get(k))}" for k in NOTE if k in r["v"] and k not in r["keys"])
        line = f"{'✗' if r['bad'] else ' '} {r['mv']} {r['name']} {r['kind'] or '-'} {r['side']} {r['size']} {r['form']} | {js} · {ns}"
        print(f"\033[31m{line}\033[0m" if red and r["bad"] else line)
    secs = round(time.time() - t)
    bad = [r for r in rows if r["bad"]]
    json.dump(dict(tol=TOL, secs=secs, stop=stop, skipped_contact=skipped, unknown=unknown, cases=len(cases), done=len(res), rows=rows),
              open(os.path.join(out, "timing.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{'멈춤 · ' if stop else ''}기술 {nmv} · 판 {len(res)}/{len(cases)} · 묶음 {len(rows)} · ✗ {len(bad)} (기술 {len({r['mv'] for r in bad})}) · {secs // 60}분 {secs % 60}초 · 표 {os.path.join(out, 'timing.json')}")
    if stop:
        print(stop)
        sys.exit(2)


LOGGER = open(os.path.join(ROOT, "dev", "move-timing.js"), encoding="utf-8").read()
LOOK = {k: v for k, v in json.load(open(os.path.join(DATA, "dev", "move-look.json"), encoding="utf-8")).items() if not k.startswith("_")}
main()
