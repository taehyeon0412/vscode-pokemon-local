"""체육관 외관 · 문 열림 그림 — 파이어레드 원작 지도 (pret/pokefirered) 상록시티 체육관을 타일로 다시 그려 잘라 냄 (2026-10-20 태현 님 A안 "1-3 끝 → 체육관 들어가기").
실행: python scripts/buildings/fetch-pret-gym-front.py [--keep <받은 파일 둘 폴더>]
→ extension/media/buildings/gym-front.png (닫힌 문, 96 × 80) · gym-door-1 ~ 3.png (문 칸 16 × 16, 조금 · 반 · 다 열림 — graphics/door_anims/sliding_double.png 를
   그 자리 메타타일 팔레트로 칠함) · gym-post.png (왼쪽 GYM 간판 기둥, 16 × 24). 그림 1칸 = 1px, 건물 밖은 투명.
지도 · 타일 읽기는 fetch-pret-buildings.py 와 같음 (그 파일의 함수를 빌림).
"""
import argparse
import importlib.util
import io
import os
import struct
import tempfile

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("pret_buildings", os.path.join(HERE, "fetch-pret-buildings.py"))
pb = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pb)

# 상록시티 지도 px — 체육관 건물 (누런 지붕 · 가운데 볼 장식 · 두짝 미닫이문) · 문 메타타일 칸 · 왼쪽 GYM 간판 기둥
GYM_BOX = (528, 96, 624, 176)
DOOR_CELL = (36, 10)
POST_BOX = (512, 152, 528, 176)
DOOR_ANIM = "graphics/door_anims/sliding_double.png"
DOOR_PAL = 3


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--keep")
    a = ap.parse_args()
    keep = a.keep or tempfile.mkdtemp(prefix="pret-gym-front-")
    os.makedirs(keep, exist_ok=True)
    town = pb.TOWN
    sec = town["secondary"]
    tiles = pb.tiles_of(pb.fetch(f"{pb.PRIMARY}/tiles.png", keep))
    tiles_sec = pb.tiles_of(pb.fetch(f"{sec}/tiles.png", keep))
    metas = pb.metatiles_of(pb.fetch(f"{pb.PRIMARY}/metatiles.bin", keep))
    metas_sec = pb.metatiles_of(pb.fetch(f"{sec}/metatiles.bin", keep))
    pals = [pb.palette(pb.fetch(f"{pb.PRIMARY}/palettes/{i:02d}.pal", keep)) for i in range(pb.NUM_PALS_PRIMARY)]
    pals += [pb.palette(pb.fetch(f"{sec}/palettes/{i:02d}.pal", keep)) for i in range(pb.NUM_PALS_PRIMARY, 13)]
    pals += [pals[0]] * (16 - len(pals))
    blocks = struct.unpack(f"<{town['width'] * town['height']}H", pb.fetch(town["layout"], keep))

    def tile(i):
        return tiles[i] if i < pb.NUM_PRIMARY else tiles_sec[i - pb.NUM_PRIMARY]

    def meta(i):
        return metas[i] if i < pb.NUM_PRIMARY else metas_sec[i - pb.NUM_PRIMARY]

    W, H = town["width"] * 16, town["height"] * 16
    img = Image.new("RGBA", (W, H), pals[0][0] + (255,))
    px = img.load()
    for by in range(town["height"]):
        for bx in range(town["width"]):
            m = meta(blocks[by * town["width"] + bx] & 0x3FF)
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
    ground = pb.ground_colors(img)
    os.makedirs(pb.OUT, exist_ok=True)

    # 문 열림 그림의 팔레트 = 원작 문 표 (field_door) 에서 두짝 미닫이문이 쓰는 3번 — 닫힌 문 칸 색과 6색 중 5색이 같음 (메타타일 팔레트는 지붕 쪽이라 분홍으로 나옴)
    dx, dy = DOOR_CELL
    door_pal = pals[DOOR_PAL]
    anim = Image.open(io.BytesIO(pb.fetch(DOOR_ANIM, keep)))
    apx = anim.load()
    frames = anim.size[1] // 16
    for f in range(frames):
        out = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
        opx = out.load()
        for y in range(16):
            for x in range(16):
                c = apx[x, f * 16 + y] & 15
                if c:
                    opx[x, y] = door_pal[c] + (255,)
        out.save(os.path.join(pb.OUT, f"gym-door-{f + 1}.png"))
        print("ok", f"gym-door-{f + 1}", out.size)

    for name, box in (("gym-front", GYM_BOX), ("gym-post", POST_BOX)):
        part = img.crop(box)
        pb.clear_ground(part, ground)
        part.save(os.path.join(pb.OUT, f"{name}.png"))
        print("ok", name, part.size, "문 칸 (건물 안 px):", (dx * 16 - GYM_BOX[0], dy * 16 - GYM_BOX[1]) if name == "gym-front" else "")


if __name__ == "__main__":
    main()
