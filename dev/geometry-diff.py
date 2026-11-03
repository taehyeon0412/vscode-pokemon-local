"""battleGeometry 회귀 표 견주기 (ideas 1686) — src/game/features/battle/__snapshots__/battle-geometry.txt 의 <기준> 판 ↔ 지금 판에서 바뀐 칸 · 나빠진 칸 수
  python dev/geometry-diff.py [기준=main]      (먼저 npx vitest run src/game/features/battle/geometry-table.test.ts -u 로 지금 판 표를 씀)
  나빠짐 = 말 숨김 0 → 1 · 줄 수 늘어남 · 위 붐빔 0 → 1 · 메뉴가 상대 HP 를 덮음 0 → 1 (좋아짐은 반대) · 나머지 (자리 · 메뉴 아래 끝) 는 바뀜으로만"""
import os
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.environ.get("PG_ROOT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REL = "src/game/features/battle/__snapshots__/battle-geometry.txt"
WORSE = {"hide": lambda a, b: b > a, "lines": lambda a, b: b > a, "busy": lambda a, b: b > a, "over": lambda a, b: b > a}


def parse(text):
    out = {}
    for line in text.splitlines():
        if " | " not in line:
            continue
        key, rest = line.split(" | ", 1)
        out[key] = dict(kv.split("=", 1) for kv in rest.split())
    return out


def main():
    ref = sys.argv[1] if len(sys.argv) > 1 else "main"
    old = subprocess.run(["git", "-C", ROOT, "show", f"{ref}:{REL}"], capture_output=True, text=True, encoding="utf-8")
    if old.returncode:
        sys.exit(f"{ref} 에 표가 없음 — {old.stderr.strip()}")
    a, b = parse(old.stdout), parse(open(os.path.join(ROOT, REL), encoding="utf-8").read())
    changed, worse, better = [], {k: [] for k in WORSE}, {k: [] for k in WORSE}
    for key in sorted(set(a) | set(b), key=lambda k: (int(k.split("x")[0]), k)):
        x, y = a.get(key), b.get(key)
        if x == y:
            continue
        changed.append(key)
        if not x or not y:
            continue
        for k, bad in WORSE.items():
            p, q = int(x.get(k, 0)), int(y.get(k, 0))
            if bad(p, q):
                worse[k].append(key)
            elif bad(q, p):
                better[k].append(key)
    print(f"# battleGeometry 표 {ref} ↔ 지금 — 칸 {len(b)} · 바뀐 칸 {len(changed)}")
    for k in WORSE:
        print(f"  {k:6s} 나빠짐 {len(worse[k]):3d} · 좋아짐 {len(better[k]):3d}" + (f"  (나빠진 칸: {', '.join(worse[k][:8])}{' …' if len(worse[k]) > 8 else ''})" if worse[k] else ""))
    other = [c for c in changed if not any(c in v for v in worse.values()) and not any(c in v for v in better.values())]
    if other:
        print(f"  자리 · 메뉴만 바뀐 칸 {len(other)}: {', '.join(other[:8])}{' …' if len(other) > 8 else ''}")
    sys.exit(1 if any(worse.values()) else 0)


if __name__ == "__main__":
    main()
