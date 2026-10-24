#!/usr/bin/env python3
"""3:3 합동 앞장 분류표 (orders #96 — 3:3 2/4) — 필살기 모음 (ULT_LIB) 한 줄마다 구 · 빔 · 오라 · 모으는 자리 · 연출이 자리를 알려 주는지
  python dev/joint-kinds.py [출력 md=docs/game-design/dev/joint-kinds.md]
  묶음 (extension/media/main-bundle.js) 의 ULT_LIB · POKEMON_ULT 를 읽음 — 필살기를 고치면 make-moves.py 뒤 다시 돌림.
  분류 규칙 = ult/bridge.js fxJ11Kind 와 같게 (바꾸면 둘 다):
    구 (모으는 자리 = 구 가운데) — ultorb (sky 빼고) · ultblackhole · 플레어드라이브 (ultdive flare — 불꽃 구)
    빔 (빔 시작 = 입) — ultbeam · ultvolt
    오라 (몸) — 그 밖 (돌진 · 연타 · 범위 · 하늘 · 기둥 …) · sky 구 (화면 위로 올라가는 구)
  알려 줌 = 연출 틀이 o.track 을 채움 (동료 별 · 번개가 그 자리를 따라감) — 일반 ultorb · 하이드로캐논 (turtle) · 플레어드라이브 (flare) — 나머지는 다리가 입 · 몸으로 셈"""
import json
import os
import sys
from collections import Counter, defaultdict

ROOT = os.environ.get("PG_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUNDLE = os.path.join(ROOT, "extension", "media", "main-bundle.js")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "docs", "game-design", "dev", "joint-kinds.md")
SPECIAL = ["uniq", "blast", "flare", "venus", "turtle", "ninja", "clones", "lucario", "mew", "mewtwo"]
KO = {"orb": "구", "beam": "빔", "aura": "오라"}
WHERE = {"orb": "구 가운데", "beam": "빔 시작 (입)", "aura": "몸"}


def grab(src, name):
    i = src.index(f"const {name} = ") + len(f"const {name} = ")
    return json.loads(src[i:src.index(";\n", i)])


def kind_of(fx, o):
    """ult/bridge.js fxJ11Kind 와 같은 규칙"""
    if (fx == "ultorb" and not o.get("sky")) or (fx == "ultdive" and o.get("flare")):
        return "orb"
    if fx == "ultblackhole":
        return "orb"
    if fx in ("ultbeam", "ultvolt"):
        return "beam"
    return "aura"


def tracked(fx, o):
    """연출 틀이 o.track 을 채우는지 (bridge team11Joint tracked 와 같게)"""
    special = any(o.get(k) for k in SPECIAL)
    return (fx == "ultdive" and bool(o.get("flare"))) or (fx == "ultbeam" and (bool(o.get("turtle")) or not special)) or (fx == "ultorb" and not o.get("sky") and not special)


def main():
    src = open(BUNDLE, encoding="utf-8").read()
    lib = grab(src, "ULT_LIB")
    forms = grab(src, "POKEMON_ULT")
    who = defaultdict(list)
    for f, idxs in forms.items():
        for i in idxs:
            who[i].append(f)
    rows = []
    for i, (name, fx, o) in enumerate(lib):
        o = o or {}
        ded = next((k for k in SPECIAL if o.get(k)), "")
        k = kind_of(fx, o)
        rows.append({"i": i, "name": name, "fx": fx, "ded": ded, "kind": k, "track": tracked(fx, o), "forms": who.get(i, [])})
    by = Counter((r["kind"], bool(r["ded"])) for r in rows)
    lines = [
        "# 3:3 합동 앞장 분류표 (orders #96 · dev/joint-kinds.py 가 만듦 — 손으로 고치지 않음)",
        "",
        "- 규칙: 구 = ultorb (sky 빼고) · ultblackhole · 플레어드라이브 / 빔 = ultbeam · ultvolt / 오라 = 그 밖 (sky 구 포함) — ult/bridge.js fxJ11Kind 와 같음",
        "- 모으는 자리: 구 = 구 가운데 · 빔 = 빔 시작 (입) · 오라 = 몸 — 동료 별이 사방에서 들어가고, 앞장 번개는 구 겉면 · 빔 둘레 · 몸 둘레",
        "- 알려 줌 ✓ = 연출 틀이 자리를 매 장면 알려 줌 (o.track) · 아니면 다리가 입 · 몸으로 셈 (구 · 빔인데 ✗ 인 것은 2/4 둘째 묶음에서 알려 주게 고칠 거리)",
        "",
        "| | 구 | 빔 | 오라 | 합 |",
        "|---|---|---|---|---|",
    ]
    for ded in (True, False):
        cnt = [by[(k, ded)] for k in ("orb", "beam", "aura")]
        lines.append(f"| {'전용' if ded else '일반'} | {cnt[0]} | {cnt[1]} | {cnt[2]} | {sum(cnt)} |")
    trk = Counter((r["kind"], r["track"]) for r in rows)
    lines += ["", f"- 알려 줌 ✓: 구 {trk[('orb', True)]} / {trk[('orb', True)] + trk[('orb', False)]} · 빔 {trk[('beam', True)]} / {trk[('beam', True)] + trk[('beam', False)]} · 오라 {trk[('aura', True)]}", ""]
    lines += ["## 전용 (107)", "", "| 이름 | 포켓몬 | 틀 | 전용 키 | 분류 | 모으는 자리 | 알려 줌 |", "|---|---|---|---|---|---|---|"]
    for r in sorted((r for r in rows if r["ded"]), key=lambda r: (r["kind"], r["fx"], r["name"])):
        lines.append(f"| {r['name']} | {' · '.join(r['forms'][:3])}{' …' if len(r['forms']) > 3 else ''} | {r['fx']} | {r['ded']} | {KO[r['kind']]} | {WHERE[r['kind']]} | {'✓' if r['track'] else '✗'} |")
    lines += ["", "## 일반 — 틀마다 (줄 수)", "", "| 틀 | 분류 | 모으는 자리 | 줄 | 알려 줌 | 이름 보기 |", "|---|---|---|---|---|---|"]
    gen = defaultdict(list)
    for r in rows:
        if not r["ded"]:
            gen[(r["fx"], r["kind"])].append(r)
    for (fx, k), rs in sorted(gen.items(), key=lambda kv: (kv[0][1], -len(kv[1]))):
        tk = sum(1 for r in rs if r["track"])
        names = sorted({r["name"] for r in rs})
        lines.append(f"| {fx} | {KO[k]} | {WHERE[k]} | {len(rs)} | {tk} / {len(rs)} | {' · '.join(names[:6])}{' …' if len(names) > 6 else ''} |")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    sys.stdout.reconfigure(encoding="utf-8")
    print(f"{len(rows)} 줄 → {OUT}")
    for ded in (True, False):
        print(("전용" if ded else "일반"), {KO[k]: by[(k, ded)] for k in ("orb", "beam", "aura")})


if __name__ == "__main__":
    main()
