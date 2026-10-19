"""S03 사람 그림 — 파이어레드 · 리프그린 원작 필드 그림 (pret/pokefirered) 받아서 게임용으로 (2026-10-19 태현 님: 원작 그림 씀).
실행: python scripts/people/fetch-frlg.py [출력 폴더 = extension/media/people] [--keep <받은 그림 둘 폴더>]
원작 한 장 = 16 × 32 장면 9장: 0 정면 · 1 뒤 · 2 옆 (왼쪽을 봄) · 3 ~ 4 정면 걷기 · 5 ~ 6 뒤 걷기 · 7 ~ 8 옆 걷기.
→ <id>/walk.png = 옆 걷기 4장 (2 → 7 → 2 → 8, 좌우를 뒤집어 오른쪽을 봄) · <id>/front.png = 정면 1장 (0)
   모든 장면을 같은 칸 (쓰는 장면들의 그림 범위를 합친 것, 발끝 맞춤) 으로 잘라 걷기 · 정면 키가 같음.
"""
import io
import os
import sys
import urllib.request

from PIL import Image

BASE = "https://raw.githubusercontent.com/pret/pokefirered/master/graphics/object_events/pics/people"
# 게임 캐릭터 id → 원작 그림 이름 (boy · girl 은 세이브에 남은 이름이라 그대로)
PEOPLE = {
    "boy": "red_normal",  # 레드
    "girl": "green_normal",  # 리프 (원작 코드 이름은 green)
}
WALK = [2, 7, 2, 8]
FRONT = [0]

args = [a for a in sys.argv[1:] if not a.startswith("--")]
out_root = args[0] if args else os.path.join(os.path.dirname(__file__), "..", "..", "extension", "media", "people")
keep = sys.argv[sys.argv.index("--keep") + 1] if "--keep" in sys.argv else None

for pid, name in PEOPLE.items():
    with urllib.request.urlopen(f"{BASE}/{name}.png", timeout=30) as r:
        data = r.read()
    if keep:
        os.makedirs(keep, exist_ok=True)
        with open(os.path.join(keep, f"{name}.png"), "wb") as f:
            f.write(data)
    sheet = Image.open(io.BytesIO(data)).convert("RGBA")  # 팔레트 0번 = 투명
    frames = [sheet.crop((i * 16, 0, i * 16 + 16, 32)) for i in range(9)]
    used = WALK + FRONT
    boxes = [frames[i].getbbox() for i in used]
    top = min(b[1] for b in boxes)
    left = min(b[0] for b in boxes)
    right = max(b[2] for b in boxes)
    bottom = max(b[3] for b in boxes)
    cut = lambda f: f.crop((left, top, right, bottom))  # noqa: E731
    w, h = right - left, bottom - top
    walk = Image.new("RGBA", (w * len(WALK), h), (0, 0, 0, 0))
    for n, i in enumerate(WALK):
        walk.alpha_composite(cut(frames[i]).transpose(Image.FLIP_LEFT_RIGHT), (n * w, 0))
    front = Image.new("RGBA", (w * len(FRONT), h), (0, 0, 0, 0))
    for n, i in enumerate(FRONT):
        front.alpha_composite(cut(frames[i]), (n * w, 0))
    d = os.path.join(out_root, pid)
    os.makedirs(d, exist_ok=True)
    walk.save(os.path.join(d, "walk.png"), optimize=True)
    front.save(os.path.join(d, "front.png"), optimize=True)
    print(pid, name, "한 장면", w, "x", h, "→", d)
