"""연출 박자 기록기 (ideas 1678 — UX 리뷰어가 손으로 붙이던 rAF 기록을 도구로) — 한 번 불러온 시험 창에서 화면 박자 (rAF) 마다 진짜 시계로
  고른 그림 (선택자) 의 자리 · 그림 장 (배경 자리 · 이미지) · 클래스 + 엔진 장면 · stage.ms 를 적고, 멈칫 · 튐 · 그림 장 간격 · 엔진 시간 흐름을 요약함
  python dev/raf-log.py <out_dir> [w=860] [h=187] [dur=6000] [track=.pg-hero,.pg-gym-wipe] [k=v …]   (나머지 k=v = dev/game-host.js 매개변수)
  예) python dev/raf-log.py out st=3 gms=0 track=.pg-hero,.pg-gym-wipe dur=5000     ← 체육관 들어가기 (U506 — 문 앞 걸음 · 닦기 6걸음)
  기본 shim=0 (진짜 화면 박자 — shim=1 은 16ms 타이머라 박자를 못 잼) · 나온 것 = <out_dir>/log.json (장면마다 한 줄) · summary.md
  멈칫 = 움직이던 그림이 2장 넘게 그대로 · 튐 = 한 장에 평소 (움직인 장 가운데 값) 의 3배 넘게 옮김 (ux-rules U2) · 머리 없는 브라우저 1개 (끝나면 PID 로 끔)"""
import importlib.util
import json
import os
import socket
import statistics
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
W_, H_ = int(kv.pop("w", 860)), int(kv.pop("h", 187))
DUR = int(kv.pop("dur", 6000))
TRACK = [s for s in kv.pop("track", ".pg-hero").split(",") if s]
q = {"screen": "game", "shim": "0", **kv}
os.makedirs(out, exist_ok=True)
GW = "document.getElementById('f').contentWindow"

# 게임 창 안 기록기 — 진짜 시계 (Performance.prototype.now — 게임 시계가 덮은 performance.now 가 아님, #140) · 장면마다 한 줄
LOGGER = r"""(() => {
  const P = () => Performance.prototype.now.call(performance);
  const sels = %(sels)s;
  const log = [];
  const t0 = P();
  const one = () => {
    const t = P() - t0;
    const d = window.__pgDebug;
    const s = d && d.state();
    const st = s && s.runtime.stage;
    const row = { t: Math.round(t * 10) / 10, ph: st ? st.phase : null, ms: st && typeof st.ms === 'number' ? Math.round(st.ms) : null, el: {} };
    for (const q of sels) {
      const e = document.querySelector('#pokemon-game ' + q);
      if (!e) { row.el[q] = null; continue; }
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      const cls = typeof e.className === 'string' ? e.className.split(' ').slice(0, 3).join(' ') : '';
      const img = e.tagName === 'IMG' ? e.getAttribute('src') : e.querySelector('img') ? e.querySelector('img').getAttribute('src') : '';
      // [왼 · 위 · 폭 · 높이 · 배경 자리 · 클래스 · 이미지 · 투명도 · clip-path]
      row.el[q] = [Math.round(r.left * 10) / 10, Math.round(r.top * 10) / 10, Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10, cs.backgroundPosition || '', cls, (img || '').split('/').pop(), Number(cs.opacity), cs.clipPath || ''];
    }
    log.push(row);
    if (t < %(dur)d) requestAnimationFrame(one);
    else window.__rafDone = 1;
  };
  window.__rafLog = log;
  requestAnimationFrame(one);
  return 'ok';
})()""" % {"sels": json.dumps(TRACK), "dur": DUR}


def summarize(log):
    lines = [f"# 연출 박자 기록 — {len(log)}장 · {log[-1]['t'] / 1000:.2f}초" if log else "# 기록 없음", ""]
    if not log:
        return "\n".join(lines)
    dts = [b["t"] - a["t"] for a, b in zip(log, log[1:])]
    lines.append(f"- 화면 박자: 장 사이 가운데 {statistics.median(dts):.1f}ms · 가장 긴 {max(dts):.1f}ms · 50ms 넘는 {sum(1 for d in dts if d > 50)}번")
    # 엔진 시간 흐름 — stage.ms 가 진짜 시간보다 얼마나 빨리 (장면마다)
    phases = []
    for r in log:
        if not phases or phases[-1][0] != r["ph"]:
            phases.append([r["ph"], r["t"], r["t"], r["ms"], r["ms"]])
        else:
            phases[-1][2], phases[-1][4] = r["t"], r["ms"]
    for ph, a, b, m0, m1 in phases:
        flow = f" · stage.ms {m0} → {m1} (진짜 {b - a:.0f}ms 동안 ×{(m1 - m0) / (b - a):.2f})" if m0 is not None and m1 is not None and b > a else ""
        lines.append(f"- 장면 {ph}: {a / 1000:.2f} ~ {b / 1000:.2f}초{flow}")
    lines.append("")
    # 장면이 바뀐 장 — 그때 자리 튐은 장면 넘어감이라 뺌
    cuts = {b["t"] for a, b in zip(log, log[1:]) if a["ph"] != b["ph"]}
    for sel in TRACK:
        rows = [(r["t"], r["el"].get(sel)) for r in log if r["el"].get(sel)]
        if not rows:
            lines.append(f"## {sel} — 없음")
            continue
        moves = [(t1, abs(e1[0] - e0[0]) + abs(e1[1] - e0[1])) for (t0, e0), (t1, e1) in zip(rows, rows[1:]) if t1 not in cuts]
        moving = [m for _, m in moves if m > 0.05]
        med = statistics.median(moving) if moving else 0
        jumps = [(t, m) for t, m in moves if med and m > 3 * med]
        jump_txt = f" — {', '.join(f'{t / 1000:.2f}초 {m:.1f}px' for t, m in jumps[:6])}" if jumps else ""
        lines.append(f"## {sel} — {len(rows)}장")
        if moving and len(moving) < 0.5 * len(moves):
            # 걸음 움직임 (픽셀 박자 — 움직이고 멈추고): 걸음 사이 간격이 고른지 (가운데의 1.8배 넘으면 끊김 — U2)
            at = [t for t, m in moves if m > 0.05]
            iv = [b - a for a, b in zip(at, at[1:])]
            miv = statistics.median(iv) if iv else 0
            odd = [(at[i + 1], v) for i, v in enumerate(iv) if miv and v > 1.8 * miv]
            lines.append(f"- 걸음 움직임: {len(moving)}걸음 · 한 걸음 가운데 {med:.2f}px · 튐 (3배 넘게) {len(jumps)}번{jump_txt}")
            if iv:
                lines.append(f"- 걸음 사이: 가운데 {miv:.0f}ms · 가장 짧은 {min(iv):.0f} · 가장 긴 {max(iv):.0f}ms · 끊김 (1.8배 넘게) {len(odd)}번" + (f" — {', '.join(f'{t / 1000:.2f}초 {v:.0f}ms' for t, v in odd[:6])}" if odd else ""))
        else:
            # 이어진 움직임 — 움직이던 것이 2장 넘게 그대로 (앞뒤로 움직였을 때만)
            stalls = []
            run = 0
            for i, (t, m) in enumerate(moves):
                if m <= 0.05:
                    run += 1
                else:
                    if run > 2 and i - run - 1 >= 0 and moves[i - run - 1][1] > 0.05:
                        stalls.append((moves[i - run][0], run))
                    run = 0
            lines.append(f"- 움직임: 움직인 장 {len(moving)} · 한 장 가운데 {med:.2f}px · 튐 (3배 넘게) {len(jumps)}번{jump_txt}")
            lines.append(f"- 멈칫 (움직이다 2장 넘게 그대로): {len(stalls)}번" + (f" — {', '.join(f'{t / 1000:.2f}초 {n}장' for t, n in stalls[:6])}" if stalls else ""))
        # 모양 바뀜 (폭 · 높이 · 배경 자리 · 클래스 · 이미지 · 투명도 · clip) — 닦기 걸음 · 걷기 그림 장
        changes = [t for (t0, e0), (t, e) in zip(rows, rows[1:]) if e0[2:] != e[2:]]
        gaps = [b - a for a, b in zip(changes, changes[1:])]
        lines.append(f"- 모양 바뀜: {len(changes)}번" + (f" ({', '.join(f'{t / 1000:.2f}' for t in changes[:12])}초)" if changes else "") + (f" · 간격 가운데 {statistics.median(gaps):.0f}ms · 가장 짧은 {min(gaps):.0f} · 가장 긴 {max(gaps):.0f}ms" if gaps else ""))
        lines.append(f"- 보인 때: {rows[0][0] / 1000:.2f} ~ {rows[-1][0] / 1000:.2f}초")
        lines.append("")
    return "\n".join(lines)


def main():
    port = gs.serve()[1]
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    dbg = s.getsockname()[1]
    s.close()
    url = f"http://127.0.0.1:{port}/dev/frame.html?" + urllib.parse.urlencode({"w": W_, "h": H_, "page": "game.html", "q": urllib.parse.urlencode(q)})
    log = []
    with tempfile.TemporaryDirectory(prefix=gs.PROF_PREFIX, ignore_cleanup_errors=True) as prof:
        p = subprocess.Popen([gs.browser(), *gs.headless_flags(), f"--remote-debugging-port={dbg}", f"--user-data-dir={prof}", f"--window-size={W_},{H_}", *gs.hide_scrollbars(),
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
            ws.call("Emulation.setFocusEmulationEnabled", {"enabled": True})  # 포커스 없이 뜨면 document.timeline 이 0 에 멈춰 CSS 애니메이션이 안 끝나고 쌓임 (#140)
            ws.call("Page.bringToFront")
            ws.call("Emulation.setDeviceMetricsOverride", {"width": W_, "height": H_, "deviceScaleFactor": 1, "mobile": False})
            ws.call("Page.navigate", {"url": url})
            # 게임 창 · 디버그 손잡이가 뜰 때까지 (기록은 그때부터 — 0초 = 손잡이가 뜬 장면)
            for _ in range(200):
                if ws.ev(f"(() => {{ try {{ return !!{GW}.__pgDebug && !!{GW}.__pgDebug.state(); }} catch (e) {{ return false; }} }})()"):
                    break
                time.sleep(0.05)
            else:
                sys.exit("화면 · 디버그 손잡이가 10초 안에 안 뜸")
            ws.ev(f"{GW}.eval({json.dumps(LOGGER)})")
            end = time.time() + DUR / 1000 + 20
            while time.time() < end and not ws.ev(f"!!{GW}.__rafDone"):
                time.sleep(0.25)
            log = ws.ev(f"{GW}.__rafLog") or []
        finally:
            gs.kill_browser(p, prof)
    json.dump({"q": q, "track": TRACK, "log": log}, open(os.path.join(out, "log.json"), "w", encoding="utf-8"), ensure_ascii=False)
    text = summarize(log)
    open(os.path.join(out, "summary.md"), "w", encoding="utf-8").write(text + "\n")
    print(text)


if __name__ == "__main__":
    main()
