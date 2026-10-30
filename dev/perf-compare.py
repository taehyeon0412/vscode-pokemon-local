"""#140 전 · 후 표 (dev/perf-run.py 결과 둘) — 두 perf-run summary.json 을 판마다 견줘 "전 / 후 / 좋아진 %" (작을수록 좋은 지표는 줄어든 %, 클수록 좋은 1% fps 는 늘어난 %)
  python dev/perf-compare.py <전 summary.json> <후 summary.json> [out.md]"""
import json
import sys

before = json.load(open(sys.argv[1], encoding="utf-8"))
after = json.load(open(sys.argv[2], encoding="utf-8"))
LOWER = [("stall50", "50ms 넘는 멈칫"), ("stall100", "100ms 넘는"), ("max_ms", "가장 긴 ms"), ("avg_ms", "평균 ms")]
HIGHER = [("fps_low1", "나쁜 1% fps")]
MEM = [("renderer", "렌더러 MB"), ("gpu", "GPU MB")]


def pct(b, a, lower=True):
    if b in (None, "") or a in (None, ""):
        return ""
    if lower:
        if b == 0:
            return "0" if a == 0 else "↑"
        return f"{round((b - a) / b * 100)}%"
    if b == 0:
        return ""
    return f"{round((a - b) / b * 100)}%"


rows = []
head = ["판"] + [n for _, n in LOWER + HIGHER] + ["그리기 최대"] + [n for _, n in MEM]
lines = ["| " + " | ".join(head) + " |", "|" + "---|" * len(head)]
tot = {"stall50": [0, 0], "max": [0, 0]}
for k in sorted(after):
    if k not in before:
        continue
    b, a = before[k].get("median", {}), after[k].get("median", {})
    cells = [after[k]["name"]]
    for key, _ in LOWER:
        cells.append(f"{b.get(key)} → {a.get(key)} ({pct(b.get(key), a.get(key))})")
    for key, _ in HIGHER:
        cells.append(f"{b.get(key)} → {a.get(key)} (+{pct(b.get(key), a.get(key), lower=False)})")
    bd, ad = before[k].get("draws", {}), after[k].get("draws", {})
    cells.append(f"{bd.get('draw_max')} → {ad.get('draw_max')}")
    bm, am = b.get("mem", {}) or {}, a.get("mem", {}) or {}
    for key, _ in MEM:
        cells.append(f"{bm.get(key)} → {am.get(key)} ({pct(bm.get(key), am.get(key))})")
    tot["stall50"][0] += b.get("stall50") or 0
    tot["stall50"][1] += a.get("stall50") or 0
    tot["max"][0] = max(tot["max"][0], b.get("max_ms") or 0)
    tot["max"][1] = max(tot["max"][1], a.get("max_ms") or 0)
    lines.append("| " + " | ".join(str(c) for c in cells) + " |")
lines.append("")
lines.append(f"모든 판 50ms 넘는 멈칫 합 {tot['stall50'][0]} → {tot['stall50'][1]} ({pct(*tot['stall50'])}) · 가장 긴 프레임 {tot['max'][0]} → {tot['max'][1]}ms ({pct(*tot['max'])})")
txt = "\n".join(lines) + "\n"
if len(sys.argv) > 3:
    open(sys.argv[3], "w", encoding="utf-8").write(txt)
print(txt)
