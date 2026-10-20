"""포켓몬 그림의 실제 그림 범위 — extension/media/gen<N>/<모습>/default_idle_8fps.gif 의 모든 장면을 합친 칸 (2026-10-20).
실행: python scripts/sprite-boxes.py
→ src/game/data/generated/sprite-boxes.json ({모습: [왼, 위, 오른, 아래]} — 원본 칸 기준, 오른 · 아래는 끝 다음 칸)
쓰는 곳: ui/Sprite (crop + center) — 그림 칸 안에서 실제 그림을 한가운데에 둬서, 포켓몬마다 빈칸 크기가 달라도 줄 위 · 아래 간격이 같게
(스타팅 진화 줄 · 포켓몬 카드 · 진화 상자 — 태현 님 "진화 줄 위아래 간격 동일하게").
"""
import glob
import json
import os

from PIL import Image, ImageSequence

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
MEDIA = os.path.join(ROOT, "extension", "media")
OUT = os.path.join(ROOT, "src", "game", "data", "generated", "sprite-boxes.json")

boxes = {}
for path in sorted(glob.glob(os.path.join(MEDIA, "gen*", "*", "default_idle_8fps.gif"))):
    form = os.path.basename(os.path.dirname(path))
    im = Image.open(path)
    u = None
    for frame in ImageSequence.Iterator(im):
        b = frame.convert("RGBA").getbbox()
        if not b:
            continue
        u = b if u is None else (min(u[0], b[0]), min(u[1], b[1]), max(u[2], b[2]), max(u[3], b[3]))
    if u:
        boxes[form] = list(u)

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(boxes, f, separators=(",", ":"), sort_keys=True)
    f.write("\n")
print("ok", len(boxes), "모습 →", OUT)
