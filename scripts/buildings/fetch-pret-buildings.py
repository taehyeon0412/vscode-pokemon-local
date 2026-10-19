"""병원 · 상점 건물 그림 — 파이어레드 원작 지도 (pret/pokefirered) 의 포켓몬센터 · 프렌들리숍을 타일로 다시 그려 잘라 냄 (2026-10-19 태현 님: 원작 그림 씀).
실행: python scripts/buildings/fetch-pret-buildings.py [--keep <받은 파일 둘 폴더>] [--map <지도 전체 그림 저장 경로>]
→ extension/media/buildings/hospital.png · shop.png (그림 1칸 = 1px, 건물 밖은 투명)

원작 지도 = 16 × 16 칸 (메타타일) 의 줄 · 메타타일 = 8 × 8 타일 4장 × 2층 (아래 · 위) · 타일 한 칸 값 = 0 ~ 15 (팔레트 안 색 번호, 0 = 투명).
파이어레드: 첫 묶음 (general) 타일 · 메타타일 640개 · 팔레트 0 ~ 6, 마을 묶음 (secondary) 은 그 뒤 · 팔레트 7 ~ 12.
"""
import argparse
import os
import struct
import sys
import tempfile
import urllib.request

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..")
OUT = os.path.join(ROOT, "extension", "media", "buildings")
RAW = "https://raw.githubusercontent.com/pret/pokefirered/master"

PRIMARY = "data/tilesets/primary/general"
NUM_PRIMARY = 640
NUM_PALS_PRIMARY = 7

# 상록시티 (48 × 40 칸) — 포켓몬센터 · 프렌들리숍이 다 있음
TOWN = {"layout": "data/layouts/ViridianCity/map.bin", "width": 48, "height": 40, "secondary": "data/tilesets/secondary/viridian_city"}

# 자를 곳 (칸 단위: x, y, 너비, 높이) — 지도 전체 그림 (--map) 을 보고 정함
CROPS = {
    "hospital": (24, 22, 5, 5),  # 포켓몬센터 (빨간 지붕 · P.C) 80 × 80
    "shop": (34, 16, 4, 4),  # 프렌들리숍 (파란 지붕 · MART) 64 × 64
}
# 땅 색을 모을 곳 (px: x0, y0, x1, y1) — 건물 바로 옆의 길 · 풀만 있는 곳. 가장자리에서 이 색만 따라가며 투명으로 (건물 색에서 멈춤)
GROUND_SAMPLES = [(384, 336, 464, 352), (464, 368, 480, 432), (528, 256, 544, 320), (544, 320, 608, 336)]


def fetch(path, keep):
    local = os.path.join(keep, path.replace("/", "_"))
    if not os.path.exists(local):
        with urllib.request.urlopen(f"{RAW}/{path}") as r, open(local, "wb") as f:
            f.write(r.read())
    with open(local, "rb") as f:
        return f.read()


def palette(text):
    lines = text.decode("ascii").split()
    # JASC-PAL · 0100 · 16 · r g b × 16
    nums = list(map(int, lines[3:3 + 48]))
    return [tuple(nums[i:i + 3]) for i in range(0, 48, 3)]


def tiles_of(png_bytes):
    """tiles.png → 8 × 8 타일마다 색 번호 (0 ~ 15) 목록"""
    import io
    im = Image.open(io.BytesIO(png_bytes))
    if im.mode != "P":
        sys.exit("tiles.png 가 색 번호 그림이 아님")
    w, h = im.size
    px = im.load()
    out = []
    for ty in range(h // 8):
        for tx in range(w // 8):
            out.append([[px[tx * 8 + x, ty * 8 + y] & 15 for x in range(8)] for y in range(8)])
    return out


def metatiles_of(data):
    return [struct.unpack_from("<8H", data, i) for i in range(0, len(data), 16)]


def ground_colors(img):
    px = img.load()
    return {px[x, y] for x0, y0, x1, y1 in GROUND_SAMPLES for y in range(y0, y1) for x in range(x0, x1)}


def clear_ground(im, ground):
    """가장자리에서 시작해 땅 색만 따라가며 투명으로 — 건물 안은 땅 색이 아니라서 안 지워짐"""
    w, h = im.size
    px = im.load()
    seen = set()
    todo = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    while todo:
        x, y = todo.pop()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h):
            continue
        seen.add((x, y))
        c = px[x, y]
        if c[3] == 0 or c not in ground:
            continue
        px[x, y] = (0, 0, 0, 0)
        todo += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--keep")
    ap.add_argument("--map")
    a = ap.parse_args()
    keep = a.keep or tempfile.mkdtemp(prefix="pret-buildings-")
    os.makedirs(keep, exist_ok=True)

    sec = TOWN["secondary"]
    tiles = tiles_of(fetch(f"{PRIMARY}/tiles.png", keep))
    tiles_sec = tiles_of(fetch(f"{sec}/tiles.png", keep))
    metas = metatiles_of(fetch(f"{PRIMARY}/metatiles.bin", keep))
    metas_sec = metatiles_of(fetch(f"{sec}/metatiles.bin", keep))
    pals = [palette(fetch(f"{PRIMARY}/palettes/{i:02d}.pal", keep)) for i in range(NUM_PALS_PRIMARY)]
    pals += [palette(fetch(f"{sec}/palettes/{i:02d}.pal", keep)) for i in range(NUM_PALS_PRIMARY, 13)]
    pals += [pals[0]] * (16 - len(pals))
    blocks = struct.unpack(f"<{TOWN['width'] * TOWN['height']}H", fetch(TOWN["layout"], keep))

    def tile(i):
        return tiles[i] if i < NUM_PRIMARY else tiles_sec[i - NUM_PRIMARY]

    def meta(i):
        return metas[i] if i < NUM_PRIMARY else metas_sec[i - NUM_PRIMARY]

    W, H = TOWN["width"] * 16, TOWN["height"] * 16
    img = Image.new("RGBA", (W, H), pals[0][0] + (255,))
    px = img.load()
    for by in range(TOWN["height"]):
        for bx in range(TOWN["width"]):
            m = meta(blocks[by * TOWN["width"] + bx] & 0x3FF)
            for layer in range(2):
                for k in range(4):
                    e = m[layer * 4 + k]
                    t = tile(e & 0x3FF)
                    hf, vf, pal = e & 0x400, e & 0x800, pals[(e >> 12) & 15]
                    ox, oy = bx * 16 + (k % 2) * 8, by * 16 + (k // 2) * 8
                    for y in range(8):
                        for x in range(8):
                            c = t[7 - y if vf else y][7 - x if hf else x]
                            if c:
                                px[ox + x, oy + y] = pal[c] + (255,)
    if a.map:
        img.save(a.map)
        print("지도", a.map, img.size)
    os.makedirs(OUT, exist_ok=True)
    ground = ground_colors(img)
    print("땅 색", len(ground))
    for name, box in CROPS.items():
        if not box:
            continue
        x, y, w, h = box
        part = img.crop((x * 16, y * 16, (x + w) * 16, (y + h) * 16))
        clear_ground(part, ground)
        part = part.crop(part.getbbox())
        part.save(os.path.join(OUT, f"{name}.png"))
        print("ok", name, part.size)


if __name__ == "__main__":
    main()
