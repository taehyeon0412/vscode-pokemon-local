"""포켓몬 그림의 실제 그림 범위 — extension/media/gen<N>/<모습>/default_idle_8fps.gif 의 모든 장면을 합친 칸 (2026-10-20).
실행: python scripts/sprite-boxes.py
→ src/game/data/generated/sprite-boxes.json ({모습: [왼, 위, 오른, 아래, 바닥]} — 원본 칸 기준, 오른 · 아래 · 바닥은 끝 다음 칸. 바닥 = 가장 오래 보이는 장면의 발끝
쓰는 곳: ui/Sprite (crop + center) — 그림 칸 안에서 실제 그림을 한가운데에 둬서, 포켓몬마다 빈칸 크기가 달라도 줄 위 · 아래 간격이 같게
(스타팅 진화 줄 · 포켓몬 카드 · 진화 상자 — 태현 님 "진화 줄 위아래 간격 동일하게").
+ sprite-walk.json ({모습: [왼, 바닥]}) — 전투 그림 (default_walk_8fps.gif) 의 왼쪽 끝 · 발끝 (보이는 시간이 가장 긴 값) — 마지막 한 방 벌러덩 90° 의 누운 높이 (battle/model koSinkPx, 2026-10-21 — 대기 그림 기준이면 −8 ~ +12px 어긋남, 픽셀 검사원)
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
    ground, longest = None, -1
    for frame in ImageSequence.Iterator(im):
        b = frame.convert("RGBA").getbbox()
        if not b:
            continue
        u = b if u is None else (min(u[0], b[0]), min(u[1], b[1]), max(u[2], b[2]), max(u[3], b[3]))
        d = frame.info.get("duration", im.info.get("duration", 0)) or 0
        # 바닥 = 가장 오래 보이는 장면의 발끝 (같으면 앞 장면) — 브리가론처럼 장면마다 발 높이가 다르면 "가장 아래" 로 맞출 때 떠 보여서
        if d > longest:
            ground, longest = b[3], d
    if u:
        boxes[form] = list(u) + [ground]

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(boxes, f, separators=(",", ":"), sort_keys=True)
    f.write("\n")
print("ok", len(boxes), "모습 →", OUT)

# 걷기 그림 — 장면마다 왼쪽 끝 · 발끝이 달라서 보이는 시간 (duration) 을 더해 가장 오래 보이는 값
walk = {}
for path in sorted(glob.glob(os.path.join(MEDIA, "gen*", "*", "default_walk_8fps.gif"))):
    form = os.path.basename(os.path.dirname(path))
    im = Image.open(path)
    lefts, feet = {}, {}
    for frame in ImageSequence.Iterator(im):
        b = frame.convert("RGBA").getbbox()
        if not b:
            continue
        d = frame.info.get("duration", im.info.get("duration", 0)) or 1
        lefts[b[0]] = lefts.get(b[0], 0) + d
        feet[b[3]] = feet.get(b[3], 0) + d
    if lefts:
        walk[form] = [max(lefts, key=lambda k: (lefts[k], -k)), max(feet, key=lambda k: (feet[k], k))]
OUT_WALK = os.path.join(ROOT, "src", "game", "data", "generated", "sprite-walk.json")
with open(OUT_WALK, "w", encoding="utf-8") as f:
    json.dump(walk, f, separators=(",", ":"), sort_keys=True)
    f.write("\n")
print("ok", len(walk), "걷기 →", OUT_WALK)
