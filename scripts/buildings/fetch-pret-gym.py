"""체육관 방 그림 — 파이어레드 원작 지도 (pret/pokefirered) 의 무지개시티 체육관 (풀 타입) 을 타일로 다시 그려 잘라 냄 (2026-10-20 태현 님 A안 "추천으로").
실행: python scripts/buildings/fetch-pret-gym.py [--keep <받은 파일 둘 폴더>] [--map <지도 전체 그림 저장 경로>]
→ extension/media/buildings/gym-wall.png (창문 벽 줄, 가로로 이어 붙임) · gym-top.png (천장 몰딩 줄) · gym-floor.png (풀 바닥, 반복) · gym-trees.png (벽 앞 나무 줄, 가로로 이어 붙임)
  그림 1칸 = 1px — 화면에서는 사람 · 건물과 같은 정수 배율로 키움 (game.css .pg-gym-room)

원작 지도 = 16 × 16 칸 (메타타일) · 메타타일 = 8 × 8 타일 4장 × 2층 (아래 · 위) · 기본 묶음 building 640개 · 팔레트 0 ~ 6, 체육관 묶음은 그 뒤 · 팔레트 7 ~ 12.
옆에서 보는 방이라 원작 (위에서 내려다봄) 의 북쪽 벽 = 뒷벽, 풀 바닥 = 바닥, 나무 = 벽 앞에 선 나무로 씀.
"""
import argparse
import io
import os
import struct
import sys
import tempfile
import urllib.request

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "extension", "media", "buildings")
RAW = "https://raw.githubusercontent.com/pret/pokefirered/master"
PRIMARY = "data/tilesets/primary/building"
SECONDARY = "data/tilesets/secondary/celadon_gym"
LAYOUT = "data/layouts/CeladonCity_Gym/map.bin"
W, H = 13, 20
NUM_PRIMARY = 640

# 창문 벽 줄 (px): 3 ~ 8번 칸 = 벽 · 창문 둘 · 벽 · 창문 둘 → 이어 붙이면 창문 간격이 고름. 위 9 = 벽 윗선 아래, 아래 40 = 주황 몰딩 + 벽 밑 그늘
WALL = (48, 9, 144, 40)
# 천장 몰딩 (px): 같은 3 ~ 8번 칸의 맨 위 (어두운 선 · 주황 · 분홍 · 어두운 선)
TOP = (48, 0, 144, 9)
# 6번 칸 위쪽의 체육관 문장 아랫부분을 3번 칸 벽으로 덮음 (이어 붙이면 문장이 줄줄이 반복돼서)
EMBLEM_PATCH = ((48, 0, 64, 17), (96, 0))
# 풀 바닥 = 나무 · 꽃 없는 칸 여섯 (칸 x, y) — 2줄 × 3칸
FLOOR = [[(5, 5), (6, 5), (7, 5)], [(10, 5), (2, 5), (11, 6)]]
# 나무 한 그루 (윗층만 — 바탕 풀 없이, px) · 나무 줄 칸 폭 (나무 16 + 사이)
TREE = (16, 40, 32, 88)
TREE_STEP = 64


def fetch(path, keep):
    local = os.path.join(keep, path.replace("/", "_"))
    if not os.path.exists(local):
        with urllib.request.urlopen(f"{RAW}/{path}") as r, open(local, "wb") as f:
            f.write(r.read())
    with open(local, "rb") as f:
        return f.read()


def palette(text):
    nums = list(map(int, text.decode("ascii").split()[3:3 + 48]))
    return [tuple(nums[i:i + 3]) for i in range(0, 48, 3)]


def tiles_of(png_bytes):
    im = Image.open(io.BytesIO(png_bytes))
    if im.mode != "P":
        sys.exit("tiles.png 가 색 번호 그림이 아님")
    w, h = im.size
    px = im.load()
    return [[[px[tx * 8 + x, ty * 8 + y] & 15 for x in range(8)] for y in range(8)] for ty in range(h // 8) for tx in range(w // 8)]


def metatiles_of(data):
    return [struct.unpack_from("<8H", data, i) for i in range(0, len(data), 16)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--keep")
    ap.add_argument("--map")
    a = ap.parse_args()
    keep = a.keep or tempfile.mkdtemp(prefix="pret-gym-")
    os.makedirs(keep, exist_ok=True)

    tiles = tiles_of(fetch(f"{PRIMARY}/tiles.png", keep))
    tiles_sec = tiles_of(fetch(f"{SECONDARY}/tiles.png", keep))
    metas = metatiles_of(fetch(f"{PRIMARY}/metatiles.bin", keep))
    metas_sec = metatiles_of(fetch(f"{SECONDARY}/metatiles.bin", keep))
    pals = [palette(fetch(f"{PRIMARY}/palettes/{i:02d}.pal", keep)) for i in range(7)]
    pals += [palette(fetch(f"{SECONDARY}/palettes/{i:02d}.pal", keep)) for i in range(7, 13)]
    pals += [pals[0]] * (16 - len(pals))
    blocks = struct.unpack(f"<{W * H}H", fetch(LAYOUT, keep))

    def tile(i):
        return tiles[i] if i < NUM_PRIMARY else tiles_sec[i - NUM_PRIMARY]

    def meta(i):
        return metas[i] if i < NUM_PRIMARY else metas_sec[i - NUM_PRIMARY]

    def render(layers):
        img = Image.new("RGBA", (W * 16, H * 16), (0, 0, 0, 0))
        px = img.load()
        for by in range(H):
            for bx in range(W):
                m = meta(blocks[by * W + bx] & 0x3FF)
                for layer in layers:
                    for k in range(4):
                        e = m[layer * 4 + k]
                        t = tile(e & 0x3FF)
                        pal = pals[(e >> 12) & 15]
                        ox, oy = bx * 16 + (k % 2) * 8, by * 16 + (k // 2) * 8
                        for y in range(8):
                            for x in range(8):
                                c = t[7 - y if e & 0x800 else y][7 - x if e & 0x400 else x]
                                if c:
                                    px[ox + x, oy + y] = pal[c] + (255,)
        return img

    full, top = render((0, 1)), render((1,))
    if a.map:
        full.save(a.map)
        print("지도", a.map, full.size)
    os.makedirs(OUT, exist_ok=True)

    src, dst = EMBLEM_PATCH
    wall_src = full.copy()
    wall_src.paste(full.crop(src), dst)
    wall = wall_src.crop(WALL)
    wall.save(os.path.join(OUT, "gym-wall.png"))
    wall_src.crop(TOP).save(os.path.join(OUT, "gym-top.png"))

    floor = Image.new("RGBA", (16 * len(FLOOR[0]), 16 * len(FLOOR)))
    for r, row in enumerate(FLOOR):
        for c, (cx, cy) in enumerate(row):
            floor.paste(full.crop((cx * 16, cy * 16, cx * 16 + 16, cy * 16 + 16)), (c * 16, r * 16))
    floor.save(os.path.join(OUT, "gym-floor.png"))

    tree = top.crop(TREE)
    tree = tree.crop(tree.getbbox())
    trees = Image.new("RGBA", (TREE_STEP, tree.height), (0, 0, 0, 0))
    trees.paste(tree, ((TREE_STEP - tree.width) // 2, 0))
    trees.save(os.path.join(OUT, "gym-trees.png"))
    print("ok wall", wall.size, "floor", floor.size, "trees", trees.size)


if __name__ == "__main__":
    main()
