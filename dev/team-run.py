"""3:3 한 판을 처음부터 끝까지 자동으로 돌려 연속 캡처 + 자동 검사 (2026-10-26 #98 준비 — "팀 10판 큼 0 → 태현 님 10판")
  python dev/team-run.py <out_dir> run=<번호>        dev/team-runs.json 의 그 판 (1 ~)
  python dev/team-run.py <out_dir> --all [from=<번호>] [to=<번호>]   표의 판 차례로 (<out_dir>/run01 … · 12 · 13 = 내 혼자 필살기 only 0) · 브라우저는 한 번에 1개
  python dev/team-run.py <out_dir> run=<번호> bfast=1   남은 k=v 는 그 판 시험 창 매개변수에 더함 (bfast=1 빠르게 켬 — 켬 · 끔 견주기는 dev/team-breakdown.py)
  python dev/team-run.py <out_dir> [size=860x187] [seed=7] [k=v …]   표 없이 한 판 (k=v = dev/game-host.js 매개변수)
  python dev/team-run.py <out_dir> --rejudge   돌리지 않고 저장된 기록 (판 폴더의 raw.json) 으로 검사만 다시
  흐름 = 트레이너 만남 → 3:3 고르기 → 3마리 → VS → 3:3 판 → 결과 상자 (체육관 판 = 개발 메뉴 "관장 3:3" 바로 시작).
  같은 seed 면 엔진 난수가 같음 (화면 박자는 브라우저마다 조금 다를 수 있음 — 판 흐름은 같음).
  플레이어 흉내: 필살기가 차면 그 칸 숫자 (사람처럼 0.6 ~ 1.6초 뒤) · 같이 쓰기 창이면 다른 찬 칸도 · 상대 필살기 기다림이면 끼어들기 · 힘겨루기면 Space 연타.
  판마다 <out>/f_<ms>.png (0.07초 안팎) · log.jsonl (상태) · checks.json · summary.md · sheet.png (걸린 장면 모음)
  자동 검사 (페이지 안에서 진짜 시계 Date.now 로 잼 — ux-rules):
    걸침 = 연출 캔버스 위 끝 (--pg-fx-top · 정보줄) 위아래 4px 에 같은 세로줄 8px 넘게 0.3초 넘게 (U4) · 숨음 = 위 끝 위 40px 띠 점이 아래보다 많음 (60% · 1500px² 넘게)
    1초 = 한글 글이 1초 안에 나타났다 사라짐 (U1 — 숫자 · 키 칸 · 짧은 낱말은 뺌) · 잘림 = 글 실제 너비가 칸보다 넓음 (U4) · 겹침 말 = 글 상자끼리 30px² 넘게 (U1 가림)
    깜빡임 = 실제로 그린 화면 번쩍 (__fxTrace 'F' — 0.34초 상한을 지난 것) 이 1초에 3번 넘게 · 쓰러짐 박자 = "쓰러졌다" 글이 그 칸이 쓰러진 모습보다 80ms 넘게 먼저 (U2)
  dev/game-shots.py 의 시험 서버 · 브라우저 도구를 씀 · 끝나면 브라우저를 PID 로 끔 (정리 — python dev/cleanup.py --mine dev)"""
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

ROOT = os.environ.get("PG_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("gs", os.path.join(ROOT, "dev", "game-shots.py"))
gs = importlib.util.module_from_spec(spec)
_argv = sys.argv
sys.argv = [_argv[0]]
spec.loader.exec_module(gs)
sys.argv = _argv
RUNS = os.path.join(ROOT, "dev", "team-runs.json")
TICK_S = 0.07
LIMIT_S = 150


class WS:
    """Chrome DevTools 웹소켓 (표준 라이브러리만 — dev/cdp-frames.py 와 같음)"""

    def __init__(self, url):
        u = urllib.parse.urlparse(url)
        self.s = socket.create_connection((u.hostname, u.port))
        # 브라우저가 답하지 않으면 (페이지가 멈춤) 기다리지 않고 그 판을 실패로 (10-26 6판이 1시간 넘게 멈춰 있던 것)
        self.s.settimeout(30)
        key = base64.b64encode(os.urandom(16)).decode()
        self.s.sendall(f"GET {u.path} HTTP/1.1\r\nHost: {u.hostname}:{u.port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n".encode())
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
        h += bytes([0x80 | n]) if n < 126 else bytes([0x80 | 126]) + struct.pack(">H", n) if n < 65536 else bytes([0x80 | 127]) + struct.pack(">Q", n)
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

    def ev(self, expr):
        r = self.call("Runtime.evaluate", {"expression": expr, "returnByValue": True})
        return r.get("result", {}).get("value")


# 페이지 안 기록기 — 게임 iframe 안에서 돎 (진짜 시계 Date.now · 50ms 마다)
COLLECT = r"""
(() => {
  if (window.__tr) return 'again';
  const K = { texts: {}, clip: {}, overlap: {}, straddle: [], hidden: [], down: {}, koText: {}, phases: [] };
  window.__fxTrace = [];
  const t0 = Date.now();
  // 번쩍 기록 (__fxTrace 'F' — 진짜 시계 __fxRealNow, #136) 을 기록기 시각 (Date.now − t0) 에 맞추는 기준 (빠르게 ▶▶ ×3 에서도 같은 흐름)
  const realNow = window.__fxRealNow || performance.now.bind(performance);
  const perf0 = realNow();
  const game = () => document.getElementById('pokemon-game');
  const hangul = /[가-힣]/;
  let lastPhase = '';
  let strOn = null;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return null;
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return null;
    }
    return r;
  };
  const ownText = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
  const tick = () => {
    const now = Date.now() - t0;
    const g = game();
    const dbg = window.__pgDebug;
    const st = dbg && dbg.state();
    const ph = st ? (st.runtime.stage ? st.runtime.stage.phase : 'walk') + (st.runtime.stage && st.runtime.stage.phase === 'team' ? ':' + st.runtime.stage.team.phase : '') : '?';
    if (ph !== lastPhase) { K.phases.push([now, ph]); lastPhase = ph; }
    if (!g) return;
    // 숫자 · 말 칩이 처음 뜬 자리 ↔ 칸마다 지금 가운데 · 달려나간 거리 (bugs 1907 — 달려나간 칸이 맞으면 그 자리 위에)
    for (const el of g.querySelectorAll('.pg-team-pop')) {
      if (el.__seen) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1) continue;
      el.__seen = 1;
      const cells = [...g.querySelectorAll('[data-team]')].map((c) => {
        const cr = c.getBoundingClientRect();
        const tr = getComputedStyle(c).translate;
        return [c.dataset.team, Math.round(cr.left + cr.width / 2), Math.round(tr && tr !== 'none' ? parseFloat(tr) || 0 : 0)];
      });
      (K.pops = K.pops || []).push([now, Math.round(r.left + r.width / 2), el.textContent.trim().slice(0, 12), cells]);
    }
    // 글 — 보인 때 · 잘림 · 겹침
    const boxes = [];
    for (const el of g.querySelectorAll('*')) {
      const tx = ownText(el);
      if (!tx || !hangul.test(tx) || el.closest('[class*="pg-dev"]')) continue;
      const r = visible(el);
      if (!r) continue;
      const key = (tx.length > 60 ? tx.slice(0, 60) : tx) + ' @' + (el.className && el.className.baseVal === undefined ? String(el.className).split(' ')[0] : el.tagName);
      const k = K.texts[key] || (K.texts[key] = { first: now, last: now, runs: [] });
      if (now - k.last > 160) { k.runs.push([k.first, k.last]); k.first = now; }
      k.last = now;
      const rg = document.createRange();
      rg.selectNodeContents(el);
      const tw = rg.getBoundingClientRect().width;
      const cs = getComputedStyle(el);
      const room = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const over = cs.textOverflow === 'ellipsis' ? (room > 0 ? tw - room : 0) : cs.overflow !== 'visible' ? el.scrollWidth - el.clientWidth : 0;
      if (over > 0.5) {
        const c = K.clip[key] || (K.clip[key] = { first: now, last: now, over: 0 });
        c.last = now; c.over = Math.max(c.over, +over.toFixed(1));
      }
      if (r.right > innerWidth + 0.5 || r.left < -0.5) {
        const c = K.clip[key + ' (패널 밖)'] || (K.clip[key + ' (패널 밖)'] = { first: now, last: now, over: 0, out: true });
        c.last = now; c.over = Math.max(c.over, +Math.max(r.right - innerWidth, -r.left).toFixed(1));
      }
      boxes.push({ key, el, r });
    }
    const pairs = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (w > 0 && h > 0 && w * h > 30) pairs.push([a, b, w * h]);
    }
    // 다른 판 (불투명 바탕) 밑에 다 덮여 안 보이는 글은 겹침이 아님 — 진 뒤 상자 밑 관장 이름표 (10-26 8판)
    //   잠깐 모두 눌림 대상으로 (pointer-events) 해 elementsFromPoint 로 위에 그린 것을 봄 · 다섯 점 모두 덮이면 숨음
    if (pairs.length) {
      const pe = document.createElement('style');
      pe.textContent = '#pokemon-game, #pokemon-game * { pointer-events: auto !important; }';
      document.head.appendChild(pe);
      const opaque = (e) => { const c = getComputedStyle(e).backgroundColor; const m = c.match(/[\d.]+/g); return !!m && (m.length < 4 ? true : +m[3] > 0.85); };
      const hid = new Map();
      const covered = (bx) => {
        if (hid.has(bx.el)) return hid.get(bx.el);
        const r = bx.r;
        const pts = [[0.5, 0.5], [0.15, 0.2], [0.85, 0.2], [0.15, 0.8], [0.85, 0.8]];
        const all = pts.every(([fx, fy]) => {
          const st = document.elementsFromPoint(r.left + r.width * fx, r.top + r.height * fy);
          for (const e of st) {
            if (e === bx.el || bx.el.contains(e)) return false;
            if (!e.contains(bx.el) && opaque(e)) return true;
          }
          return false;
        });
        hid.set(bx.el, all);
        return all;
      };
      for (const [a, b, area] of pairs) {
        if (covered(a) || covered(b)) continue;
        const pk = a.key < b.key ? a.key + ' ⟷ ' + b.key : b.key + ' ⟷ ' + a.key;
        const o = K.overlap[pk] || (K.overlap[pk] = { first: now, last: now, area: 0 });
        o.last = now; o.area = Math.max(o.area, Math.round(area));
      }
      pe.remove();
    }
    for (const b of boxes) if (b.key.includes('쓰러졌다') && K.koText[b.key] === undefined) K.koText[b.key] = now;
    // 쓰러진 칸 (3:3 회색 · 1:1 벌러덩)
    for (const el of g.querySelectorAll('.pg-team-down, .pg-fx-body.pg-fainted, .pg-fx-body.pg-down')) {
      const id = (el.closest('[data-team]') && el.closest('[data-team]').getAttribute('data-team')) || (el.closest('.pg-fighter-me') ? 'me' : 'foe');
      if (K.down[id] === undefined) K.down[id] = now;
    }
    // 연출 캔버스 위 끝 걸침 · 숨음
    const cv = document.getElementById('pokemonFxCanvas');
    const top = parseFloat(document.body.style.getPropertyValue('--pg-fx-top')) || 0;
    if (cv && top > 8 && cv.width > 0) {
      const dpr = cv.width / innerWidth;
      const x = cv.getContext('2d', { willReadFrequently: true });
      const y0 = Math.round((top - 4) * dpr);
      const hh = Math.round(8 * dpr);
      const d = x.getImageData(0, y0, cv.width, hh).data;
      // 패널 폭 85% 넘게 칠한 줄 (어둠 · 번쩍 · 물들임 판) 은 뺌 (dev/ult-top.py 와 같음)
      const layerRow = [];
      for (let ry = 0; ry < hh; ry++) {
        let c = 0;
        for (let cx = 0; cx < cv.width; cx++) if (d[(ry * cv.width + cx) * 4 + 3] > 40) c++;
        layerRow.push(c > cv.width * 0.85);
      }
      let run = 0, best = 0;
      for (let cx = 0; cx < cv.width; cx++) {
        let up = false, lo = false;
        for (let ry = 0; ry < hh; ry++) if (!layerRow[ry] && d[(ry * cv.width + cx) * 4 + 3] > 40) { if (ry < hh / 2) up = true; else lo = true; }
        if (up && lo) { run++; best = Math.max(best, run); } else run = 0;
      }
      const px = best / dpr;
      if (px > 8) { if (!strOn) strOn = { from: now, px }; strOn.to = now; strOn.px = Math.max(strOn.px, px); }
      else if (strOn) { if (strOn.to - strOn.from > 300) K.straddle.push(strOn); strOn = null; }
      const band = Math.round(40 * dpr);
      if (top * dpr > band) {
        const above = x.getImageData(0, Math.round(top * dpr) - band, cv.width, band).data;
        const below = x.getImageData(0, Math.round(top * dpr), cv.width, band).data;
        let na = 0, nb = 0;
        for (let k = 3; k < above.length; k += 16) { if (above[k] > 40) na++; if (below[k] > 40) nb++; }
        na = (na * 4) / (dpr * dpr); nb = (nb * 4) / (dpr * dpr);
        if (na > 1500 && na / (na + nb) > 0.6) K.hidden.push([now, Math.round(na)]);
      }
    }
  };
  const id = setInterval(() => { try { tick(); } catch (e) { K.err = String(e); } }, 50);
  window.__tr = { K, t0, stop: () => { clearInterval(id); if (strOn && strOn.to - strOn.from > 300) K.straddle.push(strOn); for (const k of Object.values(K.texts)) k.runs.push([k.first, k.last]); return K; },
    fx: () => (window.__fxTrace || []).filter((e) => e[0] === 'F').map((e) => Math.round(e[1] - perf0)) };
  return 'ok';
})()
"""

# 상태 줄임 (판단에 쓰는 것만)
STATE = r"""
(() => {
  const d = window.__pgDebug; if (!d) return null;
  const s = d.state(); if (!s) return null;
  const st = s.runtime.stage; const now = window.__tr ? Date.now() - window.__tr.t0 : 0;
  // pn = 게임 시계 (performance.now — webview/clock 배를 따름) · now 와 견주면 그때 배 (#136 빠르게 ▶▶ 장면 전환 확인)
  const o = { now, pn: Math.round(performance.now()), phase: st ? st.phase : 'walk', screen: s.save.location.screen };
  // 본 것으로 적힌 처음 안내 (세이브 tips — 1910 판 끝에 끊긴 안내가 본 것으로 적히는지)
  o.tips = (s.save.tips || []).slice();
  if (st && st.phase === 'trainer') { o.ms = st.ms; o.pick = !!st.pick; o.vs = st.vsAt !== undefined; o.picked = st.pick ? st.pick.length : 0; }
  if (st && st.phase === 'team') {
    const b = st.team;
    o.tp = b.phase; o.t = b.t; o.result = b.result;
    // 떠 있는 팝업 종류 · 버린 누름 (#136 — 알아챌 말이 장면 전환 박자를 붙잡는지)
    o.pops = b.popups.map((p) => p.kind); o.deny = !!b.deny;
    // 시계 배 · 장면 전환 [종류 · 쪽 · 단계 · 단계 시작부터 ms] · 누를 창 (합동 멘트 모으기 · 끼어들기 — 내 찬 칸이 있을 때) · 쓰러짐 수 · 찬 칸 수 (#136 시간 나누기)
    o.scale = d.scale ? d.scale() : null;
    const v = d.view ? d.view() : null;
    o.view = v ? [v.kind, v.side, v.phase, Math.round(performance.now() - v.at)] : null;
    const u = b.phase === 'ult' ? b.ult : null;
    o.gather = !!u && (u.gather || 0) > 0;
    o.join = !!u && u.side === 'foe' && u.window > 0 && !u.hit && b.me.some((f) => !!f && f.hp > 0 && f.ult >= 1);
    o.faintN = b.log.reduce((m, e) => (e.t === 'faint' ? Math.max(m, e.id) : m), 0);
    o.readyN = [...b.ultReadyAt.me, ...b.ultReadyAt.foe].filter((x) => x !== null).length;
    o.meFull = b.me.map((f, i) => !!f && f.hp > 0 && b.ultReadyAt.me[i] !== null);
    o.meSp = b.me.map((f) => (f ? f.species : 0));
    o.meAlive = b.me.map((f) => !!f && f.hp > 0);
    o.foeWait = b.foeUltWait.some((x) => x !== null);
    o.ultSide = b.ult ? b.ult.side : null;
    // 상대 필살기 창 (끼어들기) — 엔진 teamJoinOpen 과 같은 조건 (TeamUlt 에 join 은 없음 — 늘 false 이던 것, 코드 리뷰어 #98)
    o.joinOpen = b.phase === 'ult' && !!b.ult && b.ult.side === 'foe' && b.ult.window > 0 && !b.ult.hit;
  }
  if (st && st.phase === 'result') o.result = true;
  if (st && st.phase === 'appear') o.ms = st.ms;
  if (st && st.phase === 'choice') { const c = s.save.pendingChoices[0]; o.ck = c ? c.kind : null; o.cms = st.ms; const m = c && c.uid ? s.save.monsters[c.uid] : null; o.nMoves = m ? m.moves.length : 0; }
  if (st && st.phase === 'battle') {
    const b = st.battle;
    o.bp = b.phase; o.meUlt = b.me.hp > 0 && b.me.ult >= 1; o.foeHp = b.foe.hp; o.catching = !!b.catch && b.catch.pressMs === null;
  }
  o.party = s.save.party.slice(0, 5);
  return o;
})()
"""


def load_runs(path=None):
    # file=<json> — 같은 모양의 다른 판 표 (scratchpad 장면 — 버그 다시 찍기 등)
    with open(path or RUNS, encoding="utf-8") as f:
        return json.load(f)["runs"]


def run_one(out, cfg):
    os.makedirs(out, exist_ok=True)
    for f in os.listdir(out):
        if f.startswith("f_") or f in ("log.jsonl", "checks.json", "summary.md", "sheet.png"):
            os.remove(os.path.join(out, f))
    rnd = __import__("random").Random(int(cfg.get("seed", 1)))
    w, h = cfg.get("size", "860x187").split("x")
    gym = cfg.get("gym", False)
    q = {"screen": "game", "dev": "1", "team": "5", "fx": "1", "shim": "1", "seed": str(cfg.get("seed", 1)), **({} if gym or cfg.get("wild") or cfg.get("direct") else {"place": "trainer", "ms": "200"}), **({"balls": "5-2-1"} if cfg.get("wild") else {}), **cfg.get("q", {})}
    httpd, port = gs.serve()
    url = f"http://127.0.0.1:{port}/dev/frame.html?" + urllib.parse.urlencode({"w": w, "h": h, "page": "game.html", "q": urllib.parse.urlencode(q)})
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    dbg = sock.getsockname()[1]
    sock.close()
    log = open(os.path.join(out, "log.jsonl"), "w", encoding="utf-8")
    K = {}
    flashes = []
    with tempfile.TemporaryDirectory(prefix=gs.PROF_PREFIX, ignore_cleanup_errors=True) as prof:
        p = subprocess.Popen([gs.browser(), "--headless=new", "--disable-gpu", "--edge-skip-compat-layer-relaunch", f"--remote-debugging-port={dbg}", f"--user-data-dir={prof}", f"--window-size={w},{h}", *gs.hide_scrollbars(),
                              # 첫 캡처가 30초 안에 안 돌아와 판이 깨지던 것 (10-26 2바퀴 3 · 9판) — 머리 없는 창을 배경으로 여겨 그림을 멈추지 않게
                              "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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
            ws.call("Page.bringToFront")
            ws.call("Emulation.setDeviceMetricsOverride", {"width": int(w), "height": int(h), "deviceScaleFactor": 1, "mobile": False})
            ws.call("Page.navigate", {"url": url})
            W = "document.getElementById('f').contentWindow"
            print("  불러옴", flush=True)
            # 화면 · 디버그 손잡이가 뜰 때까지
            for _ in range(200):
                if ws.ev(f"(() => {{ try {{ return !!{W}.__pgDebug && !!{W}.__pgDebug.state(); }} catch (e) {{ return false; }} }})()"):
                    break
                time.sleep(0.05)
            else:
                # 화면이 끝내 안 뜸 — 150초 헛 캡처하지 않고 실패로 (코드 리뷰어 #98)
                raise RuntimeError("화면 · 디버그 손잡이가 10초 안에 안 뜸 (빌드 · game-host 확인)")
            # 내 팀 (표의 team — [도감 번호, 레벨]) · 정해진 필살기 (devult — 선두)
            for i, (dex, lv) in enumerate(cfg.get("team", [])):
                ws.ev(f"{W}.__pgDebug.dev({{ kind: 'mon', slot: {i}, dex: {dex}, level: {lv} }})")
            # 파티 = 판 표 팀만 (시험 창 team=5 의 나머지 둘을 뺌 — 바로 3:3 · 체육관이 상성으로 피죤 · 버터플을 골라 판 표 팀이 안 나가던 것, UX 리뷰어 #98)
            if cfg.get("team"):
                for i in range(4, len(cfg["team"]) - 1, -1):
                    ws.ev(f"{W}.__pgDebug.dev({{ kind: 'mon-remove', slot: {i} }})")
            ws.ev(f"{W}.__pgDebug.dev({{ kind: 'heal' }})")
            # foes = 상대 [도감 번호, 레벨] (개발 메뉴 상대 — 바로 3:3 장면 · 체육관에서 먹음) · direct = 만남 · 고르기 없이 바로 트레이너 3:3
            #   (7판 힘겨루기가 상대가 2.6초 만에 쓰러져 안 나오던 것 — UX 리뷰어 #98)
            for i, (dex, lv) in enumerate(cfg.get("foes", [])):
                ws.ev(f"{W}.__pgDebug.dev({{ kind: 'foe', slot: {i}, dex: {dex}, level: {lv} }})")
            if cfg.get("direct"):
                ws.ev(f"{W}.__pgDebug.dev({{ kind: 'scene', scene: 'trainer-team' }})")
            # 체육관 판 — 개발 메뉴 "관장 3:3" 과 같은 장면 (대기실 · 들어가기 없이 바로 판)
            if gym:
                ws.ev(f"{W}.__pgDebug.dev({{ kind: 'scene', scene: 'gym-team' }})")
            # 야생 1:1 판 — 선두가 이기면 진화 (진화 바로 앞 레벨) · 야생 등장부터 · 마지막 기회 · 잡기 타이밍 · 결과 · 진화
            if cfg.get("wild"):
                if cfg.get("evolve"):
                    ws.ev(f"{W}.__pgDebug.dev({{ kind: 'pre-evolve' }})")
                ws.ev(f"{W}.__pgDebug.dev({{ kind: 'scene', scene: 'wild' }})")
            ws.ev(f"{W}.eval({json.dumps(COLLECT)})")
            print("  준비 끝", flush=True)
            t0 = time.time()
            n = 0
            acts = {"meet": False, "picks": 0, "go": False, "press": {}, "events": list(cfg.get("events", [])), "teamAt": None, "resultAt": None, "mash": 0}
            while time.time() - t0 < cfg.get("limit", LIMIT_S):
                el = time.time() - t0
                s = ws.ev(f"{W}.eval({json.dumps(STATE)})")
                if s:
                    log.write(json.dumps({"el": round(el, 3), **s}, ensure_ascii=False) + "\n")
                    step(ws, W, s, acts, el, rnd, cfg)
                    if acts["resultAt"] is not None and el - acts["resultAt"] > 3.5 and not cfg.get("wild"):
                        break
                    if cfg.get("wild") and acts.get("walkAt") is not None and el - acts["walkAt"] > 2.0:
                        break
                r = ws.call("Page.captureScreenshot", {"format": "png"})
                ms = int((time.time() - t0) * 1000)
                open(os.path.join(out, f"f_{ms:06d}.png"), "wb").write(base64.b64decode(r["data"]))
                n += 1
                time.sleep(max(0, TICK_S - (time.time() - t0 - el)))
            K = ws.ev(f"{W}.__tr ? {W}.__tr.stop() : null") or {}
            K["inputs"] = acts.get("inputs", [])
            K["probe"] = acts.get("probe", [])
            flashes = ws.ev(f"{W}.__tr ? {W}.__tr.fx() : []") or []
            print(f"  frames {n} · {round(time.time() - t0, 1)}s", flush=True)
        finally:
            log.close()
            gs.kill_browser(p, prof)
            httpd.shutdown()
    with open(os.path.join(out, "raw.json"), "w", encoding="utf-8") as f:
        json.dump({"cfg": cfg, "K": K, "flashes": flashes}, f, ensure_ascii=False)
    checks = judge(K, flashes, lum_series(out))
    with open(os.path.join(out, "checks.json"), "w", encoding="utf-8") as f:
        json.dump({"cfg": cfg, "checks": checks, "phases": K.get("phases", []), "err": K.get("err")}, f, ensure_ascii=False, indent=1)
    write_summary(out, cfg, checks, K)
    return checks


def step(ws, W, s, acts, el, rnd, cfg):
    """플레이어 흉내 — 판단은 한 번에 하나 · 누른 때 (페이지 시계) 를 적음 — 누른 것으로 닫힌 글은 1초 검사에서 뺌"""
    def inp(i, note=True):
        # note=False = 연타 (힘겨루기 Space) — "누른 뒤 사라진 글" 빼기에 안 셈 (연타 시작 누름이 필살기 이름 띠를 빼 버리던 것, UX 리뷰어 #98)
        if note:
            acts.setdefault("inputs", []).append(s.get("now", 0))
        ws.ev(f"{W}.__pgDebug.input({json.dumps(i)})")
    if s["phase"] == "trainer":
        # 사람 박자 — 만남 상자를 2.5초 읽고 3:3 · 고르기 판이 뜬 뒤 1초 · 한 마리씩 0.5초 · 다 고르고 0.8초 뒤 시작 (도구가 너무 빨라 "1초" 에 걸리던 것)
        if not s.get("pick") and not acts["meet"] and s.get("ms", 0) > 2700:
            acts["meet"] = True
            inp({"kind": "team-mode", "on": True})
        elif s.get("pick"):
            acts.setdefault("pickAt", el)
            if acts["picks"] < 3 and el - acts["pickAt"] >= 1.0 + 0.5 * acts["picks"]:
                uid = s["party"][acts["picks"]]
                acts["picks"] += 1
                inp({"kind": "team-pick", "uid": uid})
            elif acts["picks"] >= 3 and not acts["go"] and el - acts["pickAt"] >= 2.8:
                acts["go"] = True
                inp({"kind": "space"})
        return
    if s["phase"] == "team":
        if acts["teamAt"] is None:
            acts["teamAt"] = el
        tin = el - acts["teamAt"]
        # 정해진 장면 (표 events — at 초 · dev 동작: 상대 게이지 가득 · 내 게이지 가득)
        while acts["events"] and tin >= acts["events"][0]["at"]:
            e = acts["events"].pop(0)
            # js = 그때 페이지 (게임 iframe) 에서 돌려 결과를 기록 (acts probe → raw.json · 화면 자리 · 클래스 재기)
            if "js" in e:
                acts.setdefault("probe", []).append({"at": e["at"], "out": ws.ev(f"{W}.eval({json.dumps(e['js'])})")})
            else:
                ws.ev(f"{W}.__pgDebug.dev({json.dumps(e['dev'])})")
        if s.get("tp") == "clash":
            if el - acts["mash"] > 0.12:
                acts["mash"] = el
                # 화면 Space 와 같은 길 (main actions.input — 빠르게 ▶▶ 밀기 ×3 이면 연타 한 번 = 3, #138)
                inp({"kind": "space"}, note=False)
            return
        # only = 누를 칸만 (혼자 필살기 장면 — 나머지 찬 칸은 안 누름)
        # leadDex = 앞장 도감 번호 (고르기 순서로 칸이 바뀌어도 그 포켓몬) → lead 칸
        if cfg.get("leadDex") and cfg.get("lead") is None and cfg["leadDex"] in (s.get("meSp") or []):
            cfg["lead"] = s["meSp"].index(cfg["leadDex"])
        full = [i for i, f in enumerate(s.get("meFull", [])) if f and (cfg.get("only") is None or i in cfg["only"])]
        # interject = 상대 필살기 창 (끼어들기) 이 열릴 때만 누름 — 끼어들기 · 힘겨루기 장면을 꼭 만듦 (6판에서 내 필살기가 먼저 나가 안 나오던 것) · 12초 넘으면 그냥
        if cfg.get("interject") and not s.get("joinOpen") and tin < 12:
            return
        for i in full:
            # 처음 본 때 + 사람 박자 (0.6 ~ 1.6초) — 끼어들기 · 같이 쓰기 창이면 0.8 ~ 1.4초
            due = acts["press"].get(i)
            if due is None:
                quick = s.get("foeWait") or s.get("joinOpen")
                acts["press"][i] = el + (rnd.uniform(0.8, 1.4) if quick else rnd.uniform(*cfg.get("delay", [0.6, 1.6])))
                # lead = 처음 누를 칸 (앞장 고르기 — 그 앞장 합동 장면) · 다른 칸은 0.7초 늦게
                if cfg.get("lead") is not None and not acts.get("leadDone") and i != cfg["lead"]:
                    acts["press"][i] += 0.7
            elif el >= due:
                acts["press"].pop(i)
                if i == cfg.get("lead"):
                    acts["leadDone"] = True
                inp({"kind": "team-battle", "input": {"kind": "ult", "slot": i}})
                return
        for i in list(acts["press"]):
            if i not in full:
                acts["press"].pop(i)
        return
    if s["phase"] in ("defeat", "lobby") and not cfg.get("wild"):
        if acts["resultAt"] is None:
            acts["resultAt"] = el
        return
    if s["phase"] == "result":
        if acts["resultAt"] is None:
            acts["resultAt"] = el
        # 야생 — 결과 · 진화를 읽고 넘김 (4초)
        if cfg.get("wild") and el - acts["resultAt"] > 4.0 and el - acts.get("contAt", 0) > 2.0:
            acts["contAt"] = el
            inp({"kind": "result-continue"})
        return
    if cfg.get("wild"):
        if s["phase"] == "appear" and s.get("ms", 0) > 1800 and not acts.get("appearGo"):
            acts["appearGo"] = True
            inp({"kind": "space"})
        elif s["phase"] == "battle":
            acts["battleSeen"] = True
            bp = s.get("bp")
            wait = acts.setdefault("wait", {})
            if bp in ("choose", "last", "pick") or (bp == "catch" and s.get("catching")):
                key = bp
                due = wait.get(key)
                if due is None:
                    wait[key] = el + (rnd.uniform(0.8, 1.4) if bp == "choose" else rnd.uniform(0.6, 0.9) if bp == "catch" else 1.6)
                elif el >= due:
                    wait.pop(key)
                    if bp == "choose":
                        inp({"kind": "battle", "input": {"kind": "ult"} if s.get("meUlt") else {"kind": "act", "action": {"kind": "attack"}}})
                    elif bp == "last":
                        inp({"kind": "battle", "input": {"kind": "ball", "ball": "poke-ball"}})
                    elif bp == "catch":
                        inp({"kind": "battle", "input": {"kind": "space"}})
                    elif bp == "pick":
                        inp({"kind": "battle", "input": {"kind": "pick", "uid": s["party"][1]}})
            else:
                wait.clear()
        elif s["phase"] == "choice":
            # S22 진화 — "어…?" 를 1.5초 읽고 보기 · 연출이 끝나면 (엔진이 그 전엔 버림) 지금 기술 그대로 · S23 새 기술 = 2초 뒤 배우지 않기
            acts.setdefault("choiceAt", el)
            if el - acts.get("choiceTry", 0) < 1.0 or el - acts["choiceAt"] < 1.5:
                return
            acts["choiceTry"] = el
            if s.get("ck") == "evolve":
                inp({"kind": "evolve-watch"} if s.get("cms", 0) < 0 else {"kind": "evolve", "keep": list(range(min(4, s.get("nMoves", 0))))})
            elif s.get("ck") == "learn":
                inp({"kind": "learn", "replace": None})
        elif s["phase"] == "walk" and acts.get("battleSeen") and acts.get("walkAt") is None:
            acts["walkAt"] = el


SKIP_SHORT = ("Lv", "HP")
# ux-rules U1 "중요한 순간" 목록에 드는 글 — 나머지 (기술 말 · 상태 말 · 잡는 중) 는 "1초 참고" 로만
# (던졌다 ≠ 졌다 · "클릭해 막기" 는 막기 창 길이 그대로인 안내라 뺌)
U1_WORDS = r"쓰러졌|다 참|필살기|합동|끼어들|압도|VS|승부|이겼|(?<!던)졌다|잡았|아깝|도망|NEW|처음|완벽|좋아!|조금 (빨|늦)|레벨|진화|스탯|얻었|클리어|보상|관장|체육관|곧!|마지막|반격|쳐내|받아쳐|못 써|안 찼|지금!|힘겨루기|목표|다 했|기회"


def lum_series(out):
    """캡처마다 평균 밝기 (0 ~ 255) — 깜빡임을 그린 결과로 잼 (screenFlash 밖 CSS 번쩍 · 흰 막까지)"""
    try:
        from PIL import Image, ImageStat
    except ImportError:
        return []
    res = []
    for f in sorted(x for x in os.listdir(out) if x.startswith("f_")):
        im = Image.open(os.path.join(out, f)).convert("L")
        im.thumbnail((160, 80))
        res.append((int(f[2:-4]), ImageStat.Stat(im).mean[0]))
    return res


def judge(K, flashes, lum=()):
    """기록 → 걸린 것 (ux-rules)"""
    out = {"1초": [], "잘림": [], "겹침": [], "깜빡임": [], "걸침": [], "숨음": [], "쓰러짐 박자": [], "1초 참고": []}
    # 깜빡임 (밝기) — 앞 장보다 평균 밝기가 25 넘게 오른 장 = 번쩍 시작 · 1초 안에 3번 넘게면 걸림 (ux-rules U1 · 'F' 는 screenFlash 상한 안이라 늘 3 이하 — 코드 리뷰어 #98)
    #   캡처 간격 (약 70ms) 보다 짧은 번쩍은 못 볼 수 있음 · 정식 필살기 패널 번쩍은 규칙상 됨 (1초 3번만 지킴)
    ons = [lum[i][0] for i in range(1, len(lum)) if lum[i][1] - lum[i - 1][1] > 25]
    for i in range(len(ons)):
        j = i
        while j + 1 < len(ons) and ons[j + 1] - ons[i] < 1000:
            j += 1
        if j - i + 1 > 3:
            out["깜빡임"].append({"밝기 번": j - i + 1, "때": ons[i], "번쩍 ms": [x - ons[i] for x in ons[i:j + 1]]})
            break
    # 1초 — 글마다 (자리를 옮겨 다녀도 같은 글 · 숫자만 바뀌는 "시작 2/3" 은 한 글) 이어 보인 구간 (ux-rules — 쓰러짐 말은 이름마다)
    import re
    runs = {}
    u1 = set()
    for key, k in (K.get("texts") or {}).items():
        txt = re.sub(r"\d+", "#", key.split(" @")[0])
        # 3:3 띠 · 컷인 글 (필살기 이름 "용성군!" 등) 은 U1 목록 (3:3 띠 · 필살기 이름) — 이름만으로는 U1 낱말에 안 걸려 못 보던 것 (UX 리뷰어 #98)
        if re.search(r"@\S*(band|cutin)", key):
            u1.add(txt)
        if len(txt) < 3 or txt.startswith(SKIP_SHORT):
            continue
        # 쓰러짐 줄은 이름마다 ("통통코 · 레디바 쓰러졌다!" — 이름이 늘어도 같은 이름은 이어 봄, ux-rules #131)
        m = re.match(r"^(.*) 쓰러졌다!?$", txt)
        if m and " · " in m.group(1):
            for name in m.group(1).split(" · "):
                runs.setdefault(f"{name.strip()} 쓰러졌다!", []).extend(k.get("runs", []))
            continue
        runs.setdefault(txt, []).extend(k.get("runs", []))
    # 그 글을 품은 다른 글로 이어지면 이어서 셈 (VS 부제 "용성군! 힘겨루기!" 가 "용성군!" 을 이어받음 — #98 띠 고침)
    runs = {t: rs + [r for t2, rs2 in runs.items() if t2 != t and len(t) >= 3 and t in t2 for r in rs2] for t, rs in runs.items()}
    for txt, rs in runs.items():
        rs.sort()
        merged = []
        for a, b in rs:
            if merged and a - merged[-1][1] <= 200:
                merged[-1][1] = max(merged[-1][1], b)
            else:
                merged.append([a, b])
        presses = K.get("inputs", [])
        # 판이 끝나며 (team:over) 지워진 글 (다 참 · 칩) 은 판 끝 때문 — 쓰러짐 말은 끝까지 남아야 해서 그대로 셈
        overs = [p[0] for p in K.get("phases", []) if str(p[1]).endswith(":over")]
        # 필살기 · 힘겨루기 장면이 열리며 (team:ult · team:clash) 가려진 "다 참" 칩은 참고 — 상태 칩 (한 번 뜨는 알림 아님) · 상대 필살기면 끼어들기 창 (금 키) 이 넘겨받음 (bugs 1876)
        scenes = [p[0] for p in K.get("phases", []) if str(p[1]) in ("team:ult", "team:clash")] if txt.startswith("다 참") else []
        for a, b in merged:
            # 누른 뒤 0.4초 안에 사라진 글 (메뉴 · 고르기 · 던지기 안내) 은 사람이 닫은 것 — 뺌
            # 마지막으로 본 때는 누르기 바로 앞 (다음 장면엔 없음) — 누른 때 −0.15 ~ +0.4초
            ended = not txt.endswith("쓰러졌다!") and any(-100 <= b - t <= 700 for t in overs)
            if 0 < b - a < 1000 and not ended and not any(-150 <= b - t <= 400 for t in presses):
                # 기록기는 50ms 마다 봄 — 잰 값 950 ~ 999 는 실제 1초일 수 있어 참고로 (잡기 타이밍 결과 1.1초가 997 로 잡히던 것)
                isu1 = txt in u1 or re.search(U1_WORDS, txt)
                cut = any(-100 <= b - t <= 700 for t in scenes)
                big = isu1 and b - a < 950 and not cut
                why = {"뜻": "필살기 장면이 열려 가려짐 (상태 칩 — 1876)"} if cut else {} if big or not isu1 else {"뜻": "재는 간격 안"}
                out["1초" if big else "1초 참고"].append({"글": txt, "보인 ms": b - a, "때": a, **why})
    for key, c in (K.get("clip") or {}).items():
        # 패널 밖은 0.3초 넘게 머문 것만 (VS · 띠가 미끄러져 들어오는 동안은 뺌)
        if c.get("out") and c["last"] - c["first"] < 300:
            continue
        out["잘림"].append({"글": key, "넘침 px": c["over"], "때": c["first"], "까지": c["last"]})
    for pk, o in (K.get("overlap") or {}).items():
        if o["last"] - o["first"] >= 100:
            out["겹침"].append({"둘": pk, "px²": o["area"], "때": o["first"], "ms": o["last"] - o["first"]})
    fs = sorted(flashes)
    for i in range(len(fs)):
        j = i
        while j + 1 < len(fs) and fs[j + 1] - fs[i] < 1000:
            j += 1
        if j - i + 1 > 3:
            out["깜빡임"].append({"번": j - i + 1, "때": round(fs[i]), "번쩍 ms": [round(x - fs[i]) for x in fs[i:j + 1]]})
            break
    for s in K.get("straddle", []):
        out["걸침"].append({"때": s["from"], "ms": s["to"] - s["from"], "px": round(s["px"])})
    hid = K.get("hidden", [])
    if hid:
        out["숨음"].append({"때": hid[0][0], "장면": len(hid), "최대 px²": max(h[1] for h in hid)})
    downs = K.get("down", {})
    for key, at in (K.get("koText") or {}).items():
        first_down = min(downs.values()) if downs else None
        near = [d for d in downs.values() if abs(d - at) < 3000]
        if near and min(near) - at > 80:
            out["쓰러짐 박자"].append({"글": key, "글 ms": at, "쓰러진 모습 ms": min(near), "먼저 ms": min(near) - at})
        elif first_down is None:
            pass
    return out


def write_summary(out, cfg, checks, K):
    lines = [f"# {cfg.get('name', os.path.basename(out))}", "", f"- 크기 {cfg.get('size', '860x187')} · seed {cfg.get('seed', 1)} · {json.dumps(cfg.get('q', {}), ensure_ascii=False)}", ""]
    total = 0
    for k, items in checks.items():
        total += len(items)
        lines.append(f"## {k} — {len(items)}")
        for it in items[:12]:
            lines.append("- " + " · ".join(f"{a} {b}" for a, b in it.items()))
        if len(items) > 12:
            lines.append(f"- … {len(items) - 12}개 더")
        lines.append("")
    lines.insert(3, f"- 걸린 것 모두 {total}")
    lines.append("## 흐름")
    lines.append(" → ".join(f"{p[1]}@{p[0]}" for p in K.get("phases", [])))
    with open(os.path.join(out, "summary.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    sheet(out, checks)


def sheet(out, checks):
    """걸린 장면 모음 (최대 12장 — 기록 ms 와 가장 가까운 캡처)"""
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        return
    frames = sorted((int(f[2:-4]), f) for f in os.listdir(out) if f.startswith("f_"))
    if not frames:
        return
    # 기록 시각 (페이지 Date.now 기준) ≈ 캡처 시각 (도구 시계) — 둘 다 시작부터라 어림
    picks = []
    for k, items in checks.items():
        for it in items[:3]:
            t = it.get("때")
            if isinstance(t, (int, float)):
                picks.append((t, f"{k}: {list(it.values())[0]}"[:70]))
    picks = picks[:12]
    if not picks:
        return
    im0 = Image.open(os.path.join(out, frames[0][1]))
    w, h = im0.size
    cols = 2 if w > 600 else 3
    rows = (len(picks) + cols - 1) // cols
    S = Image.new("RGB", (cols * w, rows * (h + 16)), "black")
    dr = ImageDraw.Draw(S)
    try:
        from PIL import ImageFont
        font = ImageFont.truetype("C:/Windows/Fonts/malgun.ttf", 12)
    except Exception:
        font = None
    for i, (t, label) in enumerate(picks):
        ms, f = min(frames, key=lambda fr: abs(fr[0] - t))
        x, y = (i % cols) * w, (i // cols) * (h + 16)
        S.paste(Image.open(os.path.join(out, f)).convert("RGB"), (x, y + 16))
        dr.text((x + 2, y + 1), f"{ms} {label}", fill="yellow", font=font)
    S.save(os.path.join(out, "sheet.png"))


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return
    out = args[0]
    kv = dict(a.split("=", 1) for a in args[1:] if "=" in a and not a.startswith("--"))
    # 다시 셈 — 돌리지 않고 저장된 기록 (raw.json) 으로 검사 · 요약만 새로 (<out> 아래 판 폴더 모두)
    if "--rejudge" in args:
        dirs = sorted(d for d in os.listdir(out) if os.path.exists(os.path.join(out, d, "raw.json")))
        for d in dirs:
            raw = json.load(open(os.path.join(out, d, "raw.json"), encoding="utf-8"))
            c = judge(raw["K"], raw["flashes"], lum_series(os.path.join(out, d)))
            write_summary(os.path.join(out, d), raw["cfg"], c, raw["K"])
            print(d, json.dumps({k: len(v) for k, v in c.items()}, ensure_ascii=False))
        return
    if "--all" in args:
        runs = load_runs(kv.get("file"))
        start = int(kv.get("from", 1))
        rows = []
        for i, cfg in enumerate(runs, 1):
            if i < start or i > int(kv.get("to", len(runs))):
                continue
            print(f"run{i:02d} {cfg.get('name')}", flush=True)
            try:
                # 시간 초과 (첫 캡처가 안 돌아옴 — 같은 판도 다시 하면 대개 됨) 는 두 번 더
                for k in range(3):
                    try:
                        c = run_one(os.path.join(out, f"run{i:02d}"), cfg)
                        break
                    except TimeoutError:
                        if k == 2:
                            raise
                        print("  시간 초과 — 한 번 더", flush=True)
                rows.append((i, cfg.get("name"), {k: len(v) for k, v in c.items()}))
            except Exception as err:  # 한 판이 멈추거나 깨져도 나머지는 돌림 — 표에 실패로
                print(f"  실패: {type(err).__name__} {err}", flush=True)
                rows.append((i, f"{cfg.get('name')} — 실패 ({type(err).__name__})", {}))
        with open(os.path.join(out, "all.md"), "w", encoding="utf-8") as f:
            keys = ["걸침", "숨음", "1초", "잘림", "깜빡임", "겹침", "쓰러짐 박자", "1초 참고"]
            f.write("| 판 | 이름 | " + " | ".join(keys) + " |\n|" + "---|" * (len(keys) + 2) + "\n")
            for i, name, c in rows:
                f.write(f"| {i} | {name} | " + " | ".join(str(c.get(k, 0)) for k in keys) + " |\n")
        print(open(os.path.join(out, "all.md"), encoding="utf-8").read())
        return
    if "run" in kv:
        cfg = load_runs(kv.get("file"))[int(kv["run"]) - 1]
        # 남은 k=v 는 그 판 시험 창 매개변수에 더함 (bfast=1 — 빠르게 ▶▶ 켬 · 끔 판 길이 견주기, #138)
        extra = {k: v for k, v in kv.items() if k not in ("run", "file")}
        if extra:
            cfg = {**cfg, "q": {**cfg.get("q", {}), **extra}}
    else:
        cfg = {"name": "한 판", "size": kv.pop("size", "860x187"), "seed": int(kv.pop("seed", 1)), "q": kv}
    c = run_one(out, cfg)
    print(json.dumps({k: len(v) for k, v in c.items()}, ensure_ascii=False))


if __name__ == "__main__":
    main()
