"""기술마다 모양 (#122) 한 번에 — dev/move-look.json 을 고친 뒤
  python dev/move-look.py
  ① make-moves.py — 표를 일반 모드 기술 모음 (MOVE_LIB) 에 합쳐 main-bundle.js (이름이 같은 일반 모드 기술도 같이)
  ② dev/move-fx.py — 기술마다 길이 · 맞는 때 다시 잼 (3:3 박자 — src/game/data/generated/move-fx.json)
  ③ 표의 기술마다 틀 · 길이 전 → 뒤 보고
  그다음 npm run build (게임 묶음) → 시험 창 · 연속 캡처로 봄. main-bundle.js · move-fx.json 은 표와 같이 커밋 (vitest move-look 이 묶음이 표와 맞는지 봄)"""
import json
import os
import re
import subprocess
import sys

ROOT = os.environ.get("PG_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "src", "game", "data", "generated", "move-fx.json")
LOOK = os.path.join(ROOT, "dev", "move-look.json")
MOVES = os.path.join(ROOT, "src", "game", "data", "generated", "moves.json")
ENV = {**os.environ, "PYTHONIOENCODING": "utf-8"}


def run(args):
    r = subprocess.run([sys.executable, *args], cwd=ROOT, env=ENV, capture_output=True, text=True, encoding="utf-8")
    print((r.stdout or "").strip().splitlines()[-1] if r.stdout.strip() else "", flush=True)
    if r.returncode:
        sys.exit(f"{args[0]} 실패:\n{r.stderr}")


def main():
    before = json.load(open(FX, encoding="utf-8"))
    run([os.path.join(ROOT, "make-moves.py")])
    run([os.path.join(ROOT, "dev", "move-fx.py")])
    after = json.load(open(FX, encoding="utf-8"))
    moves = json.load(open(MOVES, encoding="utf-8"))
    looks = [k for k in json.load(open(LOOK, encoding="utf-8")) if not k.startswith("_")]
    print(f"표 {len(looks)}개 — 기술 · 틀 · 길이 ms (전 → 뒤)")
    for k in looks:
        b, a = before.get(k), after.get(k)
        name = moves.get(k, {}).get("name", {}).get("ko", k)
        fx = f"{b[3]} → {a[3]}" if b and a and b[3] != a[3] else (a[3] if a else "?")
        print(f"  {k} {name} · {fx} · {b[0] if b else '?'} → {a[0] if a else '?'}ms")
    changed = [k for k in after if before.get(k) != after.get(k) and k not in looks]
    if changed:
        print(f"표에 없는데 박자가 바뀐 기술 {len(changed)}개 (같은 이름 일반 모드 기술을 빌려 쓰던 것): " + " · ".join(moves.get(k, {}).get("name", {}).get("ko", k) for k in changed[:20]))
    print("다음: npm run build → 시험 창 · 연속 캡처")


if __name__ == "__main__":
    main()
