"""설치 전 성능 지키기 (#140 5/5) — 합동 · 빠르게 판을 GPU 켬 · 화면 배율 1.5 로 한 번씩 돌려 문턱을 넘으면 실패 (끝 코드 1)
  PG_ROOT=<잴 빌드 폴더> python dev/perf-guard.py [out_dir]
  판 = dev/perf-runs.json 의 합동 2인 860 (8) · 합동 3인 + 두 번째 860 (10) · 빠르게 (12) — 연출 · 그리기 길 (ult/ · moves.js) 을 고친 주제는 설치 전에 돌림
  문턱 = 2026-10-30 최적화 뒤 값 + 여유 (판 흐름이 판마다 달라 50ms 넘는 수는 넉넉히 · 100ms 넘는 멈칫은 0 이어야)
  약 2분 · 머리 없는 브라우저 1개 (끝나면 dev/cleanup.py 로 0 확인)"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.environ.get("TEMP", "."), "perf-guard")

# (판 번호, 이름, 문턱) — stall100 · max_ms 는 넘으면 실패 · stall50 은 넉넉히 · 메모리는 브라우저 전체 최대
GUARDS = [
    (8, "합동 2인 860", {"stall100": 0, "max_ms": 100, "stall50": 6, "mem_all": 1200}),
    (10, "합동 3인 + 두 번째 860", {"stall100": 0, "max_ms": 100, "stall50": 6, "mem_all": 1200}),
    (12, "합동 3인 + 두 번째 860 빠르게", {"stall100": 2, "max_ms": 160, "mem_all": 1200}),
]


def main():
    os.makedirs(out, exist_ok=True)
    fails = []
    for idx, name, lim in GUARDS:
        subprocess.run([sys.executable, os.path.join(HERE, "perf-run.py"), out, f"from={idx}", f"to={idx}", "rep=1", "draws=0", "dpr=1.5", "gpu=1", "msamp=5"],
                       check=False, capture_output=True, text=True, encoding="utf-8", errors="replace")
        path = os.path.join(out, f"run{idx:02d}", "r1", "perf.json")
        if not os.path.exists(path):
            fails.append(f"{name}: 판이 안 돎 (perf.json 없음)")
            continue
        m = json.load(open(path, encoding="utf-8"))["m"]
        got = {"stall100": m.get("stall100"), "max_ms": m.get("max_ms"), "stall50": m.get("stall50"), "mem_all": (m.get("mem_max") or {}).get("all")}
        bad = [f"{k} {got[k]} > {v}" for k, v in lim.items() if got.get(k) is not None and got[k] > v]
        line = f"{'실패' if bad else '통과'} · {name} — 50ms 넘는 {got['stall50']} · 100ms 넘는 {got['stall100']} · 가장 긴 {got['max_ms']}ms · 메모리 최대 {got['mem_all']} MB"
        print(line + (f"  ← {', '.join(bad)}" if bad else ""), flush=True)
        if bad:
            fails.append(f"{name}: {', '.join(bad)}")
    print("성능 지키기 —", "통과" if not fails else f"실패 {len(fails)}")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
