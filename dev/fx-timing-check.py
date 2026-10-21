"""필살기 박자 콜백 확인 (2026-10-21 디자인팀 — 1:1 쓰러짐 기다림) — 1:1 · 3:3 에서 fx.ult 의 timing ({ main, cover, total }) 이 불리는지
  python dev/fx-timing-check.py   (npm run build · make-moves.py 뒤)
  개발 창 (머리 없는 크롬) 1:1 전투 장면에서 window.pokemonFx.ult 를 부르고 콜백 값을 찍음. 안 불리면 끝 코드 1"""
import importlib.util
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("uf", os.path.join(ROOT, "dev", "ult-fx.py"))
uf = importlib.util.module_from_spec(spec)
argv = sys.argv
sys.argv = [argv[0]]
spec.loader.exec_module(uf)

PROBE = r"""
((team) => {
  const w = document.querySelector('iframe').contentWindow;
  const d = w.document;
  const fx = w.pokemonFx;
  fx.clear();
  fx.team?.(team);
  const meBox = d.querySelector('.pg-fighter-me');
  const foeBox = d.querySelector('.pg-fighter-foe');
  const src = { el: meBox.querySelector('.pg-sprite'), box: meBox, form: 'bulbasaur', size: 32, left: false, name: 'x' };
  const dst = { el: foeBox.querySelector('.pg-sprite'), box: foeBox, form: 'butterfree', size: 32, left: true };
  let got = null;
  const total = fx.ult(src, dst, () => {}, [], { timing: (t) => { got = t; } });
  fx.clear();
  fx.team?.(false);
  return { total, got };
})(%TEAM%)
"""

ws, p, httpd = uf.browser_page()
ok = True
try:
    for team in (False, True):
        r = ws.call("Runtime.evaluate", {"expression": PROBE.replace("%TEAM%", json.dumps(team)), "returnByValue": True})
        v = r.get("result", {}).get("value")
        print(("3:3" if team else "1:1"), v)
        if not v or not v.get("total") or not v.get("got") or v["got"].get("main", -1) <= 0:
            ok = False
finally:
    import subprocess
    import shutil
    subprocess.run(["taskkill", "/PID", str(p.pid), "/T", "/F"], capture_output=True)
    httpd.shutdown()
    shutil.rmtree(getattr(uf.browser_page, "prof", ""), ignore_errors=True)
print("통과" if ok else "실패 — timing 이 안 불림")
sys.exit(0 if ok else 1)
