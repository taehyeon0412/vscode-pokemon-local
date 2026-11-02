"""설치 전 성능 지키기 (#140 5/5) — 합동 · 빠르게 판을 GPU 켬 · 화면 배율 1.5 로 3번씩 돌려 문턱을 넘으면 실패 (끝 코드 1)
  PG_ROOT=<잴 빌드 폴더> python dev/perf-guard.py [out_dir]
  판 = dev/perf-runs.json 의 합동 2인 860 (8) · 합동 3인 + 두 번째 860 (10) · 빠르게 (12) — 연출 · 그리기 길 (ult/ · moves.js) 을 고친 주제는 설치 전에 돌림
  문턱 = 2026-11-02 바로잡은 재기 (진짜 시계 · 진짜 화면 박자 · 셰이더 캐시 넘김 — dev/perf-base.md) 의 최적화 뒤 값 + 여유
    (후 빌드 3번 중 가장 나쁜 번: 합동 50.5 ~ 53.7ms · 빠르게 39ms → 가장 긴 80ms · 50ms 넘는 3 · 100ms 넘는 0. 빠르게도 같은 문턱 — 옛 160ms 는 게임 시계로 ×3 부풀던 것)
  판정 = 3번 가운데 값 (2026-11-02 기획 — 한 번만 재면 빠르게 판 메모리가 같은 코드에서도 GPU 200 ~ 750 MB 로 흔들려 1,200 문턱에 가끔 걸리던 것):
    50ms 넘는 · 가장 긴 · 메모리 최대 = 3번 가운데 값 · 100ms 넘는 멈칫은 3번 중 2번 이상이면 실패 (한 번뿐이면 "참고" — 머리 없는 창 한 번 흔들림)
  셰이더 캐시 (%TEMP%/pokemon-perf-gpucache) 가 없으면 판마다 warmup 한 번 (처음 쓰는 그림의 셰이더 엮기 60ms 남짓은 VS Code 에선 업데이트 뒤 처음 한 번뿐)
  약 6분 · 머리 없는 브라우저 1개 (끝나면 dev/cleanup.py 로 0 확인)"""
import json
import os
import shutil
import statistics
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.environ.get("TEMP", "."), "perf-guard")
REPS = 3

# (판 번호, 이름, 문턱) — max_ms · stall50 · 메모리 (브라우저 전체 최대) 는 3번 가운데 값이 넘으면 실패 · stall100 은 넘은 번이 2번 이상이면 실패
GUARDS = [
    (8, "합동 2인 860", {"stall100": 0, "max_ms": 80, "stall50": 3, "mem_all": 1200}),
    (10, "합동 3인 + 두 번째 860", {"stall100": 0, "max_ms": 80, "stall50": 3, "mem_all": 1200}),
    (12, "합동 3인 + 두 번째 860 빠르게", {"stall100": 0, "max_ms": 80, "stall50": 3, "mem_all": 1200}),
]


def main():
    os.makedirs(out, exist_ok=True)
    fails = []
    warm = "warmup=0" if os.path.isdir(os.path.join(tempfile.gettempdir(), "pokemon-perf-gpucache")) else "warmup=1"
    for idx, name, lim in GUARDS:
        # 지난 번 r1 ~ r3 가 남아 섞이지 않게
        shutil.rmtree(os.path.join(out, f"run{idx:02d}"), ignore_errors=True)
        subprocess.run([sys.executable, os.path.join(HERE, "perf-run.py"), out, f"from={idx}", f"to={idx}", f"rep={REPS}", "draws=0", "dpr=1.5", "gpu=1", "msamp=5", warm],
                       check=False, capture_output=True, text=True, encoding="utf-8", errors="replace")
        reps = []
        for r in range(1, REPS + 1):
            path = os.path.join(out, f"run{idx:02d}", f"r{r}", "perf.json")
            if os.path.exists(path):
                m = json.load(open(path, encoding="utf-8"))["m"]
                reps.append({"stall100": m.get("stall100") or 0, "max_ms": m.get("max_ms") or 0, "stall50": m.get("stall50") or 0, "mem_all": (m.get("mem_max") or {}).get("all") or 0})
        if len(reps) < REPS:
            fails.append(f"{name}: 판이 {REPS - len(reps)}번 안 돎 (perf.json 없음)")
            print(f"실패 · {name} — 판이 {REPS - len(reps)}번 안 돎", flush=True)
            continue
        got = {k: statistics.median(r[k] for r in reps) for k in ("max_ms", "stall50", "mem_all")}
        over100 = sum(1 for r in reps if r["stall100"] > lim["stall100"])
        bad = [f"{k} {got[k]} > {lim[k]} (3번 가운데)" for k in ("max_ms", "stall50", "mem_all") if got[k] > lim[k]]
        if over100 >= 2:
            bad.append(f"100ms 넘는 멈칫이 3번 중 {over100}번")
        each = " / ".join(f"{r['stall50']} · {r['stall100']} · {r['max_ms']}ms · {r['mem_all']} MB" for r in reps)
        line = f"{'실패' if bad else '통과'} · {name} — 3번 가운데: 50ms 넘는 {got['stall50']} · 가장 긴 {got['max_ms']}ms · 메모리 최대 {got['mem_all']} MB · 100ms 넘는 번 {over100}/3"
        note = "  (참고: 100ms 넘는 멈칫 한 번 — 머리 없는 창 흔들림일 수 있음)" if over100 == 1 else ""
        print(line + (f"  ← {', '.join(bad)}" if bad else note), flush=True)
        print(f"    번마다 (50ms 넘는 · 100ms 넘는 · 가장 긴 · 메모리 최대): {each}", flush=True)
        if bad:
            fails.append(f"{name}: {', '.join(bad)}")
    print("성능 지키기 —", "통과" if not fails else f"실패 {len(fails)}")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
