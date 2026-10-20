"""사진에서 줄 사이 보이는 간격 재기 (2026-10-20 — 스타팅 진화 줄 위 43 · 아래 28px 처럼 눈대중으로 놓친 것을 숫자로).
실행: python dev/measure-gaps.py <사진.png> ... (TH=18 이면 진한 테두리까지 그림으로 셈, 기본 60)
화면 가운데 칸 (1000px 넘는 사진은 x 570 ~ 1290, 아니면 전체) 에서 정보줄 아래 (y 34 ~) 줄마다 바탕과 다른 점이 있는지 보고,
그림 · 글자가 있는 띠 (bands) 와 띠 사이 간격 (gaps) 을 찍음. 같은 묶음의 간격이 2px 넘게 다르면 손볼 곳.
바탕 = 사진 왼쪽 아래 구석 점 (게임 칸 왼쪽 끝 + 5, 맨 아래 − 3). 3px 이하 틈은 같은 띠로 봄.
"""
import os
import sys

from PIL import Image

TH = int(os.environ.get("TH", "60"))
TOP = 34

for path in sys.argv[1:]:
    im = Image.open(path).convert("RGB")
    w, h = im.size
    x0, x1 = (570, 1290) if w > 1000 else (0, w)
    bg = im.getpixel((x0 + 5, h - 3))
    rows = []
    for y in range(TOP, h - 2):
        rows.append(any(sum(abs(a - b) for a, b in zip(im.getpixel((x, y)), bg)) > TH for x in range(x0, x1, 2)))
    bands = []
    y = 0
    while y < len(rows):
        if rows[y]:
            s = y
            while y < len(rows) and rows[y]:
                y += 1
            bands.append((s + TOP, y + TOP))
        else:
            y += 1
    merged = []
    for b in bands:
        if merged and b[0] - merged[-1][1] <= 3:
            merged[-1] = (merged[-1][0], b[1])
        else:
            merged.append(b)
    gaps = [merged[i + 1][0] - merged[i][1] for i in range(len(merged) - 1)]
    print(os.path.basename(path), "bands", merged, "gaps", gaps)
