"""3:3 판 길이 켬 · 끔 견주기 (ideas 736 — #138 에서 scratchpad 로 쓰던 것) — dev/team-run.py 로 찍은 판 폴더 (log.jsonl) 를 읽음
  python dev/team-breakdown.py <폴더>     <폴더>/<이름>_b0 (빠르게 끔) · <이름>_b1 (켬) 짝마다 판 길이 · 켬 ÷ 끔 + 까닭별 진짜 시간 + 장면 한 번 평균
  찍기 예) python dev/team-run.py <폴더>/run1_b0 run=1 bfast=0 · python dev/team-run.py <폴더>/run1_b1 run=1 bfast=1
  판 흐름 (상대 필살기가 한 번 더 나옴 등) 이 켬 · 끔에서 달라 합은 흔들림 — 장면 한 번 평균 (힘겨루기 · 합동 본편 · 혼자 필살기) 이 같은 것끼리 견줌"""
import json
import os
import sys

GAP_MS = 400  # 기록 사이가 이보다 길면 (캡처가 늦음) 그 틈은 안 셈


def rows(path):
    with open(os.path.join(path, "log.jsonl"), encoding="utf-8") as f:
        out = [json.loads(line) for line in f if line.strip()]
    return [r for r in out if r.get("phase") == "team" and r.get("tp") not in (None, "over")]


def bucket(o):
    v = o.get("view")
    if o.get("tp") == "clash":
        return "힘겨루기"
    if o.get("gather"):
        return "합동 멘트 (누를 창)" if o.get("join") or (o.get("scale") or 1) <= 1.01 else "할 일 없는 상대 멘트"
    if o.get("join"):
        return "끼어들기 창"
    if v:
        kind, side, phase = v[0], v[1], v[2]
        if phase in ("in", "out"):
            return "장면 들어가기 · 나오기"
        if kind == "duel":
            return "힘겨루기 결과"
        if kind == "joint":
            return "합동 큰 컷인" if phase == "cut" else "합동 본편"
        return "내 혼자 필살기" if side == "me" else "상대 혼자 필살기"
    return "보통 공격" if o.get("tp") == "run" else (o.get("tp") or "?")


def scenes(team):
    """같은 장면이 이어진 구간 — (열쇠, 진짜 ms). 힘겨루기는 들어가기 ~ 나오기를 한 장면으로"""
    out = []
    for a, b in zip(team, team[1:]):
        d = b["now"] - a["now"]
        if d > GAP_MS:
            continue
        v = a.get("view")
        key = ("duel",) if (v and v[0] == "duel") else (v[0], v[1], v[2]) if v else None
        if out and out[-1][0] == key:
            out[-1][1] += d
        else:
            out.append([key, d])
    return out


def one(path):
    team = rows(path)
    if len(team) < 2:
        return None
    by = {}
    for a, b in zip(team, team[1:]):
        d = b["now"] - a["now"]
        if d <= GAP_MS:
            k = bucket(a)
            by[k] = by.get(k, 0) + d
    per = {}
    names = {("duel",): "힘겨루기 장면 (들어가기 ~ 나오기)"}
    for key, d in scenes(team):
        if key is None:
            continue
        name = names.get(key) or ({"joint": "합동 본편", "solo": "혼자 필살기 본편"}.get(key[0]) if key[2] == "show" else None)
        if name == "혼자 필살기 본편":
            name = ("내 " if key[1] == "me" else "상대 ") + name
        if name:
            per.setdefault(name, []).append(d)
    return (team[-1]["now"] - team[0]["now"]) / 1000, by, per


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    root = sys.argv[1]
    pairs = sorted({d[:-3] for d in os.listdir(root) if d.endswith(("_b0", "_b1"))})
    tot = {"0": 0.0, "1": 0.0}
    by = {"0": {}, "1": {}}
    per = {"0": {}, "1": {}}
    print("| 판 | 끔 (초) | 켬 (초) | 켬 ÷ 끔 |\n|---|---|---|---|")
    for name in pairs:
        got = {m: one(os.path.join(root, f"{name}_b{m}")) if os.path.exists(os.path.join(root, f"{name}_b{m}", "log.jsonl")) else None for m in ("0", "1")}
        if not got["0"] or not got["1"]:
            print(f"| {name} | {got['0'] and round(got['0'][0], 1)} | {got['1'] and round(got['1'][0], 1)} | — |")
            continue
        for m in ("0", "1"):
            tot[m] += got[m][0]
            for k, v in got[m][1].items():
                by[m][k] = by[m].get(k, 0) + v
            for k, v in got[m][2].items():
                per[m].setdefault(k, []).extend(v)
        print(f"| {name} | {got['0'][0]:.1f} | {got['1'][0]:.1f} | {got['0'][0] / got['1'][0]:.2f} |")
    if tot["1"]:
        print(f"| 합 | {tot['0']:.1f} | {tot['1']:.1f} | {tot['0'] / tot['1']:.2f} |")
    print("\n| 까닭 | 끔 (초) | 켬 (초) |\n|---|---|---|")
    for k in sorted(set(by["0"]) | set(by["1"]), key=lambda k: -by["0"].get(k, 0)):
        print(f"| {k} | {by['0'].get(k, 0) / 1000:.1f} | {by['1'].get(k, 0) / 1000:.1f} |")
    print("\n| 장면 한 번 평균 | 끔 | 켬 |\n|---|---|---|")
    avg = lambda xs: f"{sum(xs) / len(xs) / 1000:.2f}초 ×{len(xs)}" if xs else "—"
    for k in sorted(set(per["0"]) | set(per["1"])):
        print(f"| {k} | {avg(per['0'].get(k, []))} | {avg(per['1'].get(k, []))} |")


if __name__ == "__main__":
    main()
