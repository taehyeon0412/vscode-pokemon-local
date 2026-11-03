"""화면의 "[키]" 글 ↔ 그 키가 지금 먹는지 (ideas 749 — 결과 상자 "[B] 가방" 이 클리어 카드에서 안 먹던 1897 · 관장 카드 [M] #127 · 처음 안내 [M] 1689 같은 종류 세 번째)
  python dev/key-hints.py <out_dir> [w=480,860] [h=187] [only=<장면 이름 일부>]   (폭마다 — 좁으면 키 칸을 숨기는 상자가 있어 둘 다)
  장면마다 시험 창을 새로 불러 1.6초 (상자가 뜬 지 1초 안 키를 안 받는 거름 밖) 기다린 뒤 보이는 키 칩 (.pg-menu-key — KeyCap) · 글 속 "[B]" 를 모으고,
  키마다 장면을 다시 불러 그 키를 한 번 눌러 봄 (게임 창 document 에 keydown) — 먹음 = 받은 쪽이 preventDefault 를 불렀거나 장면 단계 · 판 · 위치 · 설정 · 고를 것이 바뀜
  "다음 스테이지에서 [B]" · "[B] 가방은 다음에" 처럼 나중을 말하는 글의 키는 "나중" 으로 따로 셈 (지금 안 먹어도 됨)
  나온 것 = <out_dir>/key-hints.json · summary.md (안 먹는 키가 있으면 끝 코드 1) · 머리 없는 브라우저 1개 (끝나면 PID 로 끔)"""
import importlib.util
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.environ.get("PG_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = sys.argv[1:]
sys.argv = [sys.argv[0]]
spec = importlib.util.spec_from_file_location("gs", os.path.join(ROOT, "dev", "game-shots.py"))
gs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gs)
spec = importlib.util.spec_from_file_location("tr", os.path.join(ROOT, "dev", "team-run.py"))
tr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tr)

out = args[0]
kv = dict(a.split("=", 1) for a in args[1:])
WS_ = [int(x) for x in kv.pop("w", "480,860").split(",")]
H_ = int(kv.pop("h", 187))
ONLY = kv.pop("only", "")
os.makedirs(out, exist_ok=True)
GW = "document.getElementById('f').contentWindow"
WAIT_S = 1.6

# 결과 상자 · 클리어 카드 · 관장 카드 · 길 위 상자 · 처음 안내 (dev/game-host.js 매개변수 — 늘리면 여기에)
#   rms=6000 = 잡은 소개 카드 (5초) 뒤 결과 상자 · progress=1 = 상자 뒤가 클리어 카드 ("다음 스테이지에서 [B] 가방" — bugs 1897)
SCENES = [
    ("결과 상자", {"scene": "result"}),
    ("결과 상자 · 레벨업 둘", {"scene": "result", "ups": "2"}),
    ("결과 상자 · 잡음 + 진화의 돌", {"scene": "result", "got": "1", "cform": "pikachu:25:피카츄", "cstone": "1", "rms": "6000"}),
    ("결과 상자 · 잡음 + 진화의 돌 → 클리어 카드", {"scene": "result", "got": "1", "cform": "pikachu:25:피카츄", "cstone": "1", "rms": "6000", "progress": "1"}),
    ("결과 상자 · 트레이너", {"scene": "result", "trainer": "1"}),
    ("클리어 카드", {"place": "clear"}),
    ("관장 카드", {"place": "badge"}),
    ("대기실", {"place": "lobby"}),
    ("패배 상자", {"place": "defeat"}),
    ("병원 안", {"place": "hospital"}),
    ("상점 앞", {"place": "shop-front"}),
    ("병원 앞", {"place": "facility"}),
    ("트레이너 만남", {"place": "trainer"}),
    ("대기실 · 진화 아이템 안내", {"place": "lobby", "evotip": "thunder-stone", "evouser": "1"}),
    ("걷기", {}),
]

# 다른 장면에서 쓰는 키를 알려 주는 안내 글 (그 장면에선 안 먹어도 됨)
EXPLAIN = ("필살기는",)
# 화면 글 → 누를 키 (key · code) — 키 이름이 아닌 [지도] 같은 버튼 글은 뺌
SPECIAL = {"Enter": ("Enter", "Enter"), "Esc": ("Escape", "Escape"), "Space": (" ", "Space"), "Tab": ("Tab", "Tab")}


def key_of(tok):
    t = tok.strip().replace(" ", " ").split(" ")[0]
    if t in SPECIAL:
        return t, SPECIAL[t]
    if len(t) == 1 and t.isascii() and t.isalpha():
        return t.upper(), (t.lower(), "Key" + t.upper())
    if len(t) == 1 and t.isdigit():
        return t, (t, "Digit" + t)
    return None, None


COLLECT = r"""(() => {
  const root = document.getElementById('pokemon-game');
  const vis = (el) => {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) return false;
    return el.checkVisibility ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : true;
  };
  const ctx = (el) => (el.closest('button, .pg-banner, .pg-panel, [class*="tip"], [class*="toast"]') || el.parentElement || el).textContent.replace(/\s+/g, ' ').trim().slice(0, 70);
  const out = [];
  for (const el of root.querySelectorAll('.pg-menu-key')) if (vis(el)) out.push({ tok: el.textContent.trim(), how: 'chip', ctx: ctx(el) });
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const el = n.parentElement;
    if (!el || el.closest('.pg-menu-key') || !vis(el)) continue;
    for (const m of n.textContent.matchAll(/\[([^\]]{1,14})\]/g)) out.push({ tok: m[1], how: 'text', ctx: ctx(el), near: n.textContent.slice(Math.max(0, m.index - 16), m.index + m[0].length + 8) });
  }
  return out;
})()"""

SIG = r"""(() => {
  const s = window.__pgDebug.state();
  const st = s.runtime.stage || {};
  const panel = document.querySelector('#pokemon-game .pg-panel, #pokemon-game .pg-profile');
  return JSON.stringify({ ph: st.phase || null, sub: [st.picking, st.pick, st.inside, st.keep, st.again, st.vsAt !== undefined].map(String).join(), loc: s.save.location, set: s.save.settings, pend: (s.save.pendingChoices || []).length, panel: panel ? panel.className + '|' + panel.textContent.slice(0, 20) : null });
})()"""


def press_js(key, code):
    return (f"(() => {{ const e = new KeyboardEvent('keydown', {{ key: {json.dumps(key)}, code: {json.dumps(code)}, bubbles: true, cancelable: true }}); "
            f"document.dispatchEvent(e); return e.defaultPrevented; }})()")


class Page:
    def __init__(self, port, dbg):
        self.port, self.dbg = port, dbg
        self.ws = None

    def open(self):
        self.w = WS_[0]
        for _ in range(100):
            try:
                pages = [t for t in json.load(urllib.request.urlopen(f"http://127.0.0.1:{self.dbg}/json/list", timeout=1)) if t.get("type") == "page"]
                if pages:
                    self.ws = tr.WS(pages[0]["webSocketDebuggerUrl"])
                    break
            except Exception:
                pass
            time.sleep(0.1)
        if not self.ws:
            sys.exit("브라우저가 안 뜸")
        self.ws.call("Page.enable")
        self.ws.call("Emulation.setFocusEmulationEnabled", {"enabled": True})
        self.ws.call("Page.bringToFront")

    def load(self, q):
        self.ws.call("Emulation.setDeviceMetricsOverride", {"width": self.w, "height": H_, "deviceScaleFactor": 1, "mobile": False})
        q = {"screen": "game", "shim": "0", "seed": "42", **q}
        url = f"http://127.0.0.1:{self.port}/dev/frame.html?" + urllib.parse.urlencode({"w": self.w, "h": H_, "page": "game.html", "q": urllib.parse.urlencode(q)})
        self.ws.call("Page.navigate", {"url": url})
        time.sleep(0.3)
        for _ in range(200):
            if self.ws.ev(f"(() => {{ try {{ return !!{GW}.__pgDebug && !!{GW}.__pgDebug.state(); }} catch (e) {{ return false; }} }})()"):
                break
            time.sleep(0.05)
        else:
            return False
        # 키를 누르는 사람은 패널에 포커스가 있음 — 게임 창에 포커스 (트레이너 만남 "Space 넘기기" 처럼 포커스가 있을 때만 보이는 키 글)
        self.ws.ev(f"{GW}.focus()")
        time.sleep(WAIT_S)
        return True

    def ev(self, js):
        return self.ws.ev(f"{GW}.eval({json.dumps(js)})")


def main():
    port = gs.serve()[1]
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    dbg = s.getsockname()[1]
    s.close()
    rows = []
    with tempfile.TemporaryDirectory(prefix=gs.PROF_PREFIX, ignore_cleanup_errors=True) as prof:
        p = subprocess.Popen([gs.browser(), *gs.headless_flags(), f"--remote-debugging-port={dbg}", f"--user-data-dir={prof}", f"--window-size={max(WS_)},{H_}", *gs.hide_scrollbars(),
                              "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            pg = Page(port, dbg)
            pg.open()
            for w, (name0, q) in [(w, sc) for w in WS_ for sc in SCENES]:
                if ONLY and ONLY not in name0:
                    continue
                pg.w = w
                name = f"{name0} · {w}"
                if not pg.load(q):
                    rows.append({"scene": name, "tok": None, "verdict": "장면 안 뜸"})
                    continue
                hints = pg.ev(COLLECT) or []
                seen = {}
                for h in hints:
                    label, ke = key_of(h["tok"])
                    if not ke:
                        continue
                    # 나중 = "다음 스테이지에서 [B]" 처럼 나중을 말하는 글 · 설명 = 다른 장면에서 쓰는 키를 알려 주는 안내 ("필살기는 1 2 3" — 전투에서)
                    later = "나중" if h["how"] == "text" and "다음" in (h.get("near") or "") else "설명" if any(w in (h.get("ctx") or "") for w in EXPLAIN) else None
                    k = (label, later)
                    if k not in seen:
                        seen[k] = {**h, "label": label, "ke": ke, "later": later}
                if not seen:
                    # 그때 장면 단계 · 화면 글 앞부분 (장면이 다른 데로 넘어갔는지 보려고)
                    peek = pg.ev(r"(() => { const s = window.__pgDebug.state(); return (s.runtime.stage ? s.runtime.stage.phase : s.save.location.screen) + ' | ' + document.getElementById('pokemon-game').textContent.replace(/\s+/g, ' ').slice(0, 90); })()")
                    rows.append({"scene": name, "tok": None, "verdict": "키 글 없음", "ctx": peek})
                for (label, later), h in seen.items():
                    pg.load(q)
                    before = pg.ev(SIG)
                    prevented = pg.ev(press_js(*h["ke"]))
                    time.sleep(0.4)
                    after = pg.ev(SIG)
                    took = bool(prevented) or before != after
                    verdict = ("먹음" if took else "안 먹음") if not later else (f"{later} · 지금도 먹음" if took else f"{later} (지금 안 먹음 — 글대로)")
                    rows.append({"scene": name, "tok": label, "how": h["how"], "ctx": h["ctx"], "near": h.get("near"), "prevented": bool(prevented), "changed": before != after,
                                 "before": json.loads(before) if before else None, "after": json.loads(after) if after else None, "verdict": verdict})
                    print(f"{name:28s} [{label}] {h['how']:4s} {verdict:22s} · {h['ctx'][:50]}", flush=True)
        finally:
            gs.kill_browser(p, prof)
    json.dump(rows, open(os.path.join(out, "key-hints.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    bad = [r for r in rows if r["verdict"] in ("안 먹음", "장면 안 뜸")]
    lines = [f"# 화면 키 글 ↔ 먹는지 (폭 {WS_} × {H_}) — 안 먹음 {len(bad)}", "", "| 장면 | 키 | 모양 | 판정 | 둘레 글 |", "|---|---|---|---|---|"]
    lines += [f"| {r['scene']} | {r['tok'] or '—'} | {r.get('how') or ''} | {r['verdict']} | {(r.get('ctx') or '')[:60]} |" for r in rows]
    open(os.path.join(out, "summary.md"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print(f"\n안 먹음 {len(bad)} · 장면 {len({r['scene'] for r in rows})} · 키 {sum(1 for r in rows if r['tok'])}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
