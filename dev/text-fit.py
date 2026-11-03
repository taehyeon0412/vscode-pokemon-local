"""글자 맞춤 검사 (ideas 1663 — UX 리뷰어가 손으로 하던 맥 +10% · keep-all 견주기를 도구로) — 한 번 불러온 시험 창에서 패널 폭을 바꿔 가며
  보이는 글 칸마다 줄 수 · 낱말 안에서 끊김 · 줄임표 (…) · 잘림 (넘친 칸 · 패널 밖) 을 재고, 맥 흉내 · keep-all 켬 / 끔과 견줌
  python dev/text-fit.py <out_dir> [w=240-480] [step=1] [h=150] [vars=win,mac] [at=2500] [settle=6] [root=#pokemon-game] [css.<이름>=<CSS>] [k=v …]
    (나머지 k=v = dev/game-host.js 매개변수 · w 는 "240-480" (step 간격) 또는 "240,300,480")
  예) python dev/text-fit.py out w=240-720 step=4 scene=result ups=3 trainer=3                 ← 결과 상자 3:3 레벨업 셋 (윈도우 · 맥)
      python dev/text-fit.py out w=240,300,480 h=187 vars=win,mac,keep,nokeep team=5 click=team   ← 내 포켓몬 판 · 모든 글 keep-all 켬 / 끔
  변형: win = 그대로 · mac = 글자 사이 +0.06em (맥 글꼴 폭 +10% 흉내) · keep = 모든 글 word-break: keep-all · nokeep = word-break: normal ·
    css.<이름>=<CSS> = 직접 (vars 에 이름을 넣음) · 시험 창 style= 도 같이 얹힘
  잼: display:none 만 빼고 모든 글 칸 (visibility 로 숨은 번갈아 차례도 배치는 그대로라 잼 — hid 표시) · 글자마다 자리 (Range) ·
    낱말 끊김 = 보통 띄어쓰기가 아닌 두 글자 사이에서 줄이 바뀜 (붙임 띄어쓰기 · 한 낱말 안) · 잘림 = 넘침을 자르는 칸 (overflow hidden · clip) 이나 패널 밖으로 0.5px 넘게
    (스크롤 칸 안 아래쪽은 스크롤이라 뺌 · 옆 스크롤은 sx) · … = text-overflow: ellipsis 칸에서 내용 실제 너비가 칸보다 넓음
  check=result (ideas 1667) — 결과 상자 장면에서 폭마다 엔진 결과 (레벨업 · 배운 기술 · 돈 · 물건 · 보물 · 잡은 포켓몬) 가 상자 안 글 · 얼굴 카드 · 새 기술 N 어디에도
    없으면 "빠짐" (번갈아 숨은 차례 글도 보이는 것으로 셈 — display:none 만 빠짐 · 경험치만 오른 포켓몬 숫자는 빠져도 되는 단계가 있어 참고) · 상자가 패널 밖으로 나간 px
    예) python dev/text-fit.py out w=240-720 check=result scene=result ups=3 trainer=3
  cover=<A 선택자>@<B 선택자> (ideas 1665 · ux-rules U3) — 폭마다 보이는 A 가 보이는 B 를 덮은 넓이 (px²) · 예) cover=.pg-first-tip@.pg-hero-wrap,.pg-foe-trainer,.pg-banner.pg-lobby
  reload=<n> — n 폭마다 다시 불러옴 (시간이 지나면 넘어가는 장면 — 결과 상자는 resultMs 5초 · check=result 는 기본 8폭마다 · at 600)
  나온 것 = <out_dir>/fit.json (변형 → 폭 → 글 칸) · summary.md (걸린 것을 글 칸마다 폭 구간으로 · win 보다 줄이 는 곳 · check=result 면 빠진 것) · 머리 없는 브라우저 1개 (끝나면 PID 로 끔)"""
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

BUILTIN = {
    "win": "",
    "mac": "#pokemon-game{letter-spacing:.06em}",
    "keep": "#pokemon-game *{word-break:keep-all!important}",
    "nokeep": "#pokemon-game *{word-break:normal!important}",
}

out = args[0]
kv = dict(a.split("=", 1) for a in args[1:])
H_ = int(kv.pop("h", 150))
STEP = int(kv.pop("step", 1))
ws_ = kv.pop("w", "240-480")
WIDTHS = list(range(int(ws_.split("-")[0]), int(ws_.split("-")[1]) + 1, STEP)) if "-" in ws_ else [int(x) for x in ws_.split(",")]
AT_ARG = kv.pop("at", None)
SETTLE = int(kv.pop("settle", 6))
ROOT_SEL = kv.pop("root", "#pokemon-game")
CHECK = kv.pop("check", "")
COVER = kv.pop("cover", "")
if COVER and "@" not in COVER:
    sys.exit("cover=<A 선택자>@<B 선택자>")
AT = int(AT_ARG) if AT_ARG is not None else (600 if CHECK == "result" else 2500)
RELOAD = int(kv.pop("reload", 8 if CHECK == "result" else 0))
CUSTOM = {k[4:]: kv.pop(k) for k in list(kv) if k.startswith("css.")}
VARS = kv.pop("vars", "win,mac").split(",")
for v in VARS:
    if v not in BUILTIN and v not in CUSTOM:
        sys.exit(f"변형 {v} 을 모름 — win · mac · keep · nokeep 또는 css.{v}=<CSS>")
os.makedirs(out, exist_ok=True)
GW = "document.getElementById('f').contentWindow"

# 글 칸마다 재기 (시험 창 frame.html 에서 돌림 — 게임 창 = iframe)
MEASURE = r"""((root) => {
  const w = document.getElementById('f').contentWindow, d = w.document;
  const rootEl = d.querySelector(root);
  if (!rootEl) return null;
  const view = rootEl.getBoundingClientRect();
  const none = (e) => { for (let p = e; p && p !== d.documentElement; p = p.parentElement) if (w.getComputedStyle(p).display === 'none') return true; return false; };
  const hid = (e) => { for (let p = e; p && p !== d.documentElement; p = p.parentElement) { const cs = w.getComputedStyle(p); if (cs.visibility === 'hidden' || cs.opacity === '0') return true; } return false; };
  const name = (e) => { const c = [...e.classList].filter((x) => x.startsWith('pg-')).slice(0, 2).join('.'); return e.tagName.toLowerCase() + (c ? '.' + c : ''); };
  const path = (e) => { const o = []; for (let p = e; p && p !== rootEl && o.length < 3; p = p.parentElement) o.unshift(name(p)); return o.join(' > '); };
  const cuts = (e, L, T, R, B) => {
    let x = 0, y = 0, sx = 0, scX = false, scY = false;
    // 절대 · 고정 위치 칸은 자기 기준 칸 (offsetParent) 부터 위만 자름 — 그 사이 칸의 overflow 는 안 자름 (말풍선 · 모서리 칩) · body · html 은 자르지 않음 (보이는 창으로 감)
    let skip = null;
    for (let p = e; p && p !== d.body && p !== d.documentElement; p = p.parentElement) {
      const cs = w.getComputedStyle(p);
      if (p !== e && skip !== null && p !== skip) { if (cs.position === 'absolute' || cs.position === 'fixed') skip = cs.position === 'fixed' ? d.body : p.offsetParent; continue; }
      if (p === skip) skip = null;
      if (cs.position === 'absolute' || cs.position === 'fixed') skip = cs.position === 'fixed' ? d.body : p.offsetParent;
      if (p === e || (cs.overflowX === 'visible' && cs.overflowY === 'visible')) continue;
      const q = p.getBoundingClientRect();
      const ox = Math.max(0, R - q.right, q.left - L), oy = Math.max(0, B - q.bottom, q.top - T);
      //   스크롤 칸을 지난 뒤 바깥 칸은 그 방향을 안 셈 (스크롤 칸 밖 글은 스크롤로 닿음 — 판 테두리가 판 아래쪽 글을 자른 것처럼 보이던 가짜)
      if (!scX) { if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') { sx = Math.max(sx, ox); scX = true; } else x = Math.max(x, ox); }
      if (!scY) { if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') scY = true; else y = Math.max(y, oy); }
    }
    // 패널 밖 — 스크롤 칸 안이면 그 방향은 스크롤로 닿음 (판 아래쪽 글)
    if (!scX) x = Math.max(x, R - view.right, view.left - L);
    if (!scY) y = Math.max(y, B - view.bottom, view.top - T);
    return [x, y, sx];
  };
  // … = 이 글의 오른쪽 끝이 가장 가까운 ellipsis 칸 안쪽 끝을 1/64px (배치 단위) 넘게 넘음 (칸 전체 Range 는 절대 위치 그림까지 넣어 가짜가 남 · scrollWidth 는 정수라 0.02 ~ 0.43px 를 놓침 — U4 ·
  //   0.015 = 안쪽 여백 5.2px 가 배치 단위로 5.1875 가 되는 0.0125 를 빼려고 — 전투 메뉴 단추 가짜)
  const ell = (e, R) => { for (let p = e; p && p !== rootEl.parentElement; p = p.parentElement) { const cs = w.getComputedStyle(p); if (cs.textOverflow === 'ellipsis' && cs.overflowX !== 'visible') { const q = p.getBoundingClientRect(); return R > q.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight) + 0.015; } } return false; };
  const gap = (ch) => ch === ' ' || ch === '\n' || ch === '\t';
  const groups = new Map();
  const tw = d.createTreeWalker(rootEl, 4);
  let n;
  while ((n = tw.nextNode())) { if (!n.nodeValue.trim()) continue; const el = n.parentElement; if (!groups.has(el)) groups.set(el, []); groups.get(el).push(n); }
  const items = [];
  for (const [el, nodes] of groups) {
    if (none(el)) continue;
    const chars = [];
    for (const t of nodes) {
      const s = t.nodeValue;
      for (let i = 0; i < s.length; i++) {
        const rg = d.createRange(); rg.setStart(t, i); rg.setEnd(t, i + 1);
        const rs = [...rg.getClientRects()].filter((r) => r.width > 0.1);
        chars.push({ ch: s[i], r: rs.length ? rs[rs.length - 1] : null });
      }
    }
    const vis = chars.filter((c) => c.r && !gap(c.ch));
    if (!vis.length) continue;
    const tops = [];
    for (const c of vis) if (!tops.some((t) => Math.abs(t - c.r.top) < 3)) tops.push(c.r.top);
    const br = [];
    let prev = null;
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      // 줄 끝 띄어쓰기는 폭 0 (Range 가 없음) — 그래도 끊을 곳이라 앞 글자를 놓음
      if (gap(c.ch)) { prev = null; continue; }
      if (!c.r) continue;
      if (prev && !gap(prev.ch) && !gap(c.ch) && c.r.top > prev.r.top + 3) {
        let a = i - 1; while (a > 0 && !gap(chars[a - 1].ch)) a--;
        let b = i; while (b < chars.length - 1 && !gap(chars[b + 1].ch)) b++;
        br.push(chars.slice(a, i).map((x) => x.ch).join('') + '|' + chars.slice(i, b + 1).map((x) => x.ch).join(''));
      }
      prev = c;
    }
    const L = Math.min(...vis.map((c) => c.r.left)), T = Math.min(...vis.map((c) => c.r.top)), R = Math.max(...vis.map((c) => c.r.right)), B = Math.max(...vis.map((c) => c.r.bottom));
    const [cx, cy, sx] = cuts(el, L, T, R, B);
    // 통째로 패널 밖 (걸어 들어오는 트레이너 · 날아오는 띠) 은 잘림이 아님 — 칸 일부가 보일 때만 셈
    if (R <= view.left || L >= view.right || B <= view.top || T >= view.bottom) continue;
    const it = { p: path(el), t: nodes.map((t) => t.nodeValue).join('').replace(/\s+/g, ' ').trim().slice(0, 80), lines: tops.length };
    if (br.length) it.br = br;
    if (cx > 0.5) it.cx = Math.round(cx * 10) / 10;
    if (cy > 0.5) it.cy = Math.round(cy * 10) / 10;
    if (sx > 0.5) it.sx = Math.round(sx * 10) / 10;
    if (ell(el, R)) it.ell = 1;
    if (hid(el)) it.hid = 1;
    items.push(it);
  }
  return items;
})"""


# 결과 상자에서 빠진 것 (check=result · ideas 1667) — 엔진 결과가 진짜 값 · 상자 글 (display:none 만 뺌) · 보이는 얼굴 카드 (title 이 이름으로 시작) · 새 기술 N
CHECK_RESULT = r"""(() => {
  const w = document.getElementById('f').contentWindow, d = w.document;
  let st = null;
  try { st = w.__pgDebug.state(); } catch (e) { return null; }
  const s = st && st.runtime.stage && st.runtime.stage.phase === 'result' ? st.runtime.stage.summary : null;
  const box = d.querySelector('#pokemon-game .pg-result');
  if (!s || !box) return null;
  const none = (e) => { for (let p = e; p && p !== d.documentElement; p = p.parentElement) if (w.getComputedStyle(p).display === 'none') return true; return false; };
  let text = '';
  const tw = d.createTreeWalker(box, 4);
  let n;
  while ((n = tw.nextNode())) if (!none(n.parentElement)) text += n.nodeValue;
  text = text.replace(/\s+/g, ' ').replace(/,/g, '');
  const cards = [...box.querySelectorAll('.pg-lvup-card')].filter((c) => !none(c));
  const cardOf = (name) => cards.find((c) => (c.title || '').startsWith(name + ' '));
  const shownIn = (el, sel) => { const x = el && el.querySelector(sel); return !!x && !none(x); };
  const miss = [];
  for (const e of s.exp.filter((x) => x.to > x.from)) if (!cardOf(e.name) && !text.includes(e.name)) miss.push('▲ ' + e.name);
  for (const l of s.learned) {
    const nameN = [...box.querySelectorAll('.pg-alt-up-name')].some((x) => !none(x) && x.textContent.includes(l.name) && shownIn(x, '.pg-alt-up-new'));
    if (!text.includes(l.move) && !shownIn(cardOf(l.name), '.pg-lvup-card-new') && !nameN) miss.push('★ ' + l.name + ' ' + l.move);
  }
  if (s.money > 0 && !text.includes('+' + s.money)) miss.push('+' + s.money + '원');
  for (const k of ['item', 'treasure']) if (s[k] && !text.includes(s[k])) miss.push(s[k]);
  if (s.caught && !text.includes(s.caught.name)) miss.push('잡음 ' + s.caught.name);
  const expMiss = s.exp.filter((e) => e.to <= e.from && !text.includes('+' + e.gain)).map((e) => e.name);
  const R = box.getBoundingClientRect(), V = d.querySelector('#pokemon-game').getBoundingClientRect();
  const out = Math.max(0, R.bottom - V.bottom, V.top - R.top, R.right - V.right, V.left - R.left);
  return { miss, expMiss, out: Math.round(out * 10) / 10, cards: cards.length, cls: box.className.replace(/pg-banner |pg-result |pg-two |pg-lvup /g, '').replace(/pg-/g, '') };
})()"""


# A 가 B 를 덮은 넓이 (cover= — 둘 다 보이는 것만 · 서로 안에 든 것은 뺌)
COVER_JS = r"""((A, B) => {
  const w = document.getElementById('f').contentWindow, d = w.document;
  const shown = (e) => { for (let p = e; p && p !== d.documentElement; p = p.parentElement) { const cs = w.getComputedStyle(p); if (cs.display === 'none' || cs.visibility === 'hidden') return false; } return true; };
  const name = (e) => { const c = [...e.classList].filter((x) => x.startsWith('pg-')).slice(0, 3).join('.'); return e.tagName.toLowerCase() + (c ? '.' + c : ''); };
  const as = [...d.querySelectorAll(A)].filter(shown), bs = [...d.querySelectorAll(B)].filter(shown);
  const out = [];
  for (const a of as) {
    const r = a.getBoundingClientRect();
    for (const b of bs) {
      if (a.contains(b) || b.contains(a)) continue;
      const q = b.getBoundingClientRect();
      const ox = Math.min(r.right, q.right) - Math.max(r.left, q.left), oy = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
      if (ox > 0.5 && oy > 0.5) out.push([name(a), name(b), Math.round(ox * oy)]);
    }
  }
  return out;
})"""


def settle(ws):
    ws.call("Runtime.evaluate", {"expression": f"new Promise((r) => {{ const w = {GW}; let k = 0; const f = () => (++k >= {SETTLE} ? r(1) : w.requestAnimationFrame(f)); w.requestAnimationFrame(f); }})", "awaitPromise": True, "returnByValue": True})


def load(ws, port, name, W):
    """시험 창을 그 변형 CSS 로 불러오고 화면 · 디버그 손잡이가 뜬 뒤 at ms 기다림"""
    css = BUILTIN.get(name, CUSTOM.get(name, ""))
    q = {"screen": "game", "shim": "0", **kv}
    if css:
        q["style"] = (q.get("style", "") + css)
    url = f"http://127.0.0.1:{port}/dev/frame.html?" + urllib.parse.urlencode({"w": W, "h": H_, "page": "game.html", "q": urllib.parse.urlencode(q)})
    ws.call("Page.navigate", {"url": url})
    for _ in range(200):
        if ws.ev(f"(() => {{ try {{ return !!{GW}.__pgDebug && !!{GW}.__pgDebug.state(); }} catch (e) {{ return false; }} }})()"):
            break
        time.sleep(0.05)
    else:
        sys.exit("화면 · 디버그 손잡이가 10초 안에 안 뜸")
    time.sleep(AT / 1000)


def run_variant(ws, port, name):
    res, chk, cov = {}, {}, {}
    for i, W in enumerate(WIDTHS):
        if i == 0 or (RELOAD and i % RELOAD == 0):
            load(ws, port, name, W)
        ws.ev(f"document.getElementById('f').style.width = '{W}px'")
        settle(ws)
        res[W] = ws.ev(f"{MEASURE}({json.dumps(ROOT_SEL)})") or []
        if CHECK == "result":
            chk[W] = ws.ev(CHECK_RESULT)
        if COVER:
            a, b = COVER.split("@", 1)
            cov[W] = ws.ev(f"{COVER_JS}({json.dumps(a)}, {json.dumps(b)})") or []
    return res, chk, cov


def ranges(ws):
    """[240, 241, 242, 300] → "240 ~ 242 · 300" (재지 않은 폭은 STEP 간격으로 잇기)"""
    out, s, p = [], None, None
    for w in ws:
        if s is None:
            s = p = w
        elif w - p <= STEP:
            p = w
        else:
            out.append(f"{s}" if s == p else f"{s} ~ {p}")
            s = p = w
    if s is not None:
        out.append(f"{s}" if s == p else f"{s} ~ {p}")
    return " · ".join(out)


def summarize_check(chk):
    """check=result — 변형마다 빠진 것 · 패널 밖 · 경험치 숫자 빠짐 (참고) 을 폭 구간으로"""
    lines = ["# 결과 상자 — 빠진 것 (check=result · ideas 1667)", ""]
    for v in VARS:
        miss, notes, none_ = {}, {}, []
        for W, c in chk.get(v, {}).items():
            if not c:
                none_.append(W)
                continue
            for m in c["miss"]:
                miss.setdefault(m, []).append(W)
            if c["out"] > 0.5:
                miss.setdefault(f"상자가 패널 밖 (~{c['out']}px)", []).append(W)
            for e in c["expMiss"]:
                notes.setdefault(f"경험치 숫자 없음 {e}", []).append(W)
        lines.append(f"## {v} — 빠짐 {len(miss)}")
        for k, ws in sorted(miss.items(), key=lambda x: x[1][0]):
            lines.append(f"- {k} · 폭 {ranges(ws)}")
        for k, ws in sorted(notes.items(), key=lambda x: x[1][0]):
            lines.append(f"- (참고) {k} · 폭 {ranges(ws)}")
        if none_:
            lines.append(f"- (결과 상자가 없음 · 폭 {ranges(none_)})")
        lines.append("")
    return "\n".join(lines)


def summarize_cover(cov):
    """cover= — 변형마다 (A · B) 짝이 덮은 폭 구간 · 가장 큰 넓이"""
    lines = [f"# 덮음 (cover={COVER})", ""]
    for v in VARS:
        pairs = {}
        for W, items in cov.get(v, {}).items():
            for a, b, area in items:
                pairs.setdefault((a, b), []).append((W, area))
        lines.append(f"## {v} — 덮은 짝 {len(pairs)}")
        for (a, b), ws in sorted(pairs.items(), key=lambda x: x[1][0][0]):
            lines.append(f"- `{a}` → `{b}` · 가장 큰 {max(x[1] for x in ws)}px² · 폭 {ranges([x[0] for x in ws])}")
        lines.append("")
    return "\n".join(lines)


def summarize(data):
    lines = [f"# 글자 맞춤 — {' '.join(f'{k}={v}' for k, v in kv.items())} · h={H_} · w={WIDTHS[0]} ~ {WIDTHS[-1]} (간격 {STEP}) · 변형 {', '.join(VARS)}", ""]
    base = data.get("win")
    for v in VARS:
        prob = {}
        for W, items in data[v].items():
            seen = {}
            for it in items:
                key = (it["p"], it["t"])
                seen[key] = seen.get(key, 0) + 1
                k = key + (seen[key],)
                tags = []
                for b in it.get("br", []):
                    tags.append(f"낱말 끊김 {b}")
                if it.get("ell"):
                    tags.append("…")
                if it.get("cx"):
                    tags.append(f"옆 잘림 {it['cx']}px")
                if it.get("cy"):
                    tags.append(f"위아래 잘림 {it['cy']}px")
                if base is not None and v != "win":
                    b0 = [x for x in base.get(W, []) if (x["p"], x["t"]) == key]
                    if b0 and it["lines"] > b0[0]["lines"]:
                        tags.append(f"줄 {b0[0]['lines']} → {it['lines']}")
                for tg in tags:
                    prob.setdefault((k, tg, bool(it.get("hid"))), []).append(W)
        lines.append(f"## {v} — 걸린 것 {len(prob)}")
        for (k, tg, hidden), ws in sorted(prob.items(), key=lambda x: (x[0][0][0], x[1][0])):
            lines.append(f"- {tg} · `{k[0]}` \"{k[1][:40]}\"{' (숨은 차례)' if hidden else ''} · 폭 {ranges(ws)}")
        lines.append("")
    return "\n".join(lines)


def main():
    port = gs.serve()[1]
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    dbg = s.getsockname()[1]
    s.close()
    data, chk, cov = {}, {}, {}
    t0 = time.time()
    with tempfile.TemporaryDirectory(prefix=gs.PROF_PREFIX, ignore_cleanup_errors=True) as prof:
        p = subprocess.Popen([gs.browser(), *gs.headless_flags(), f"--remote-debugging-port={dbg}", f"--user-data-dir={prof}", f"--window-size={max(WIDTHS)},{H_}", *gs.hide_scrollbars(),
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
            if not ws_url:
                sys.exit("브라우저가 안 뜸")
            ws = tr.WS(ws_url)
            ws.call("Page.enable")
            ws.call("Emulation.setFocusEmulationEnabled", {"enabled": True})  # 포커스 없이 뜨면 document.timeline 이 0 에 멈춰 CSS 애니메이션이 안 끝남 (#140)
            ws.call("Page.bringToFront")
            ws.call("Emulation.setDeviceMetricsOverride", {"width": max(WIDTHS), "height": H_, "deviceScaleFactor": 1, "mobile": False})
            for v in VARS:
                data[v], chk[v], cov[v] = run_variant(ws, port, v)
                print(f"{v} — 폭 {len(WIDTHS)}개 잼 ({time.time() - t0:.0f}초)")
        finally:
            gs.kill_browser(p, prof)
    json.dump({"q": kv, "h": H_, "widths": WIDTHS, "vars": VARS, "data": data, **({"check": chk} if CHECK else {}), **({"cover": cov} if COVER else {})}, open(os.path.join(out, "fit.json"), "w", encoding="utf-8"), ensure_ascii=False)
    text = summarize(data) + ("\n" + summarize_check(chk) if CHECK == "result" else "") + ("\n" + summarize_cover(cov) if COVER else "")
    open(os.path.join(out, "summary.md"), "w", encoding="utf-8").write(text + "\n")
    print(text)


if __name__ == "__main__":
    main()
