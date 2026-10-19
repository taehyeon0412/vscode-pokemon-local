"""S03 사람 그림 2단계 — pixelize.py 의 장면을 걷기로 다시 잇기: 윗몸은 한 장으로 고정 (AI 가 장면마다 머리 · 팔을 조금씩 달리 그려 떨림),
다리만 장면마다 바꿈 + 순서 (다리 넓게 → 좁게 → 넓게 → 좁게) + 다리가 모인 장면은 윗몸 1칸 위로.
실행: python scripts/people/rewalk.py <장면 png 폴더> <이름> <윗몸 장면 번호> <순서 예: 2,3,4,3> [1 = 들썩] [키 칸 수 — 예: 28 이면 미리 줄임]
→ <이름>_sheet.png (게임용 — extension/media/people/<id>/walk.png 로) · <이름>_rewalk.gif · _x4.gif · _rewalk_strip.png (모두 장면 폴더에)
주의: 윗몸 / 다리를 나누는 줄은 다리 위쪽 옷 색으로 찾음 (is_short — 지금은 cap-girl 의 파랑 반바지). 다른 캐릭터는 그 색으로 바꿔서.
게임은 사람 키 28칸까지 그대로 그림 (data/heroes.ts HERO_MAX_ROWS) — 더 크면 마지막 인자로 미리 줄여 넣기 (가까운 점으로, 테두리가 덜 깨짐)
"""
import sys

from PIL import Image

folder, name, base_i, order = sys.argv[1], sys.argv[2], int(sys.argv[3]), [int(v) for v in sys.argv[4].split(",")]
bob = len(sys.argv) > 5 and sys.argv[5] == "1"
fr = {i: Image.open(f"{folder}/{name}_{i}.png").convert("RGBA") for i in (1, 2, 3, 4)}
W, H = fr[1].size


def is_short(c):
    r, g, b, a = c
    return a > 0 and b > r + 30 and b > 90  # 파랑 반바지


def shorts_rows(im):
    px = im.load()
    return [y for y in range(H // 2, H) if sum(1 for x in range(W) if is_short(px[x, y])) >= 3]


def shorts_cx(im, y0, y1):
    px = im.load()
    xs = [x for y in range(y0, y1) for x in range(W) if is_short(px[x, y])]
    return sum(xs) / len(xs)


def spread(im):
    """발 두 개 사이 (아래 3줄의 왼쪽 끝 ~ 오른쪽 끝)"""
    bb = im.crop((0, H - 3, W, H)).getbbox()
    return bb[2] - bb[0]


base = fr[base_i]
rows = shorts_rows(base)
if not rows:
    sys.exit(f"{name}_{base_i}.png 에서 다리 위 옷 색 (is_short) 을 못 찾음 — is_short 를 이 캐릭터 색으로 바꿔 주세요")
cut = rows[0]  # 반바지 위 = 윗몸 / 다리 나누는 줄
cx0 = shorts_cx(base, rows[0], rows[0] + 3)
print("cut", cut, "spread", {i: spread(f) for i, f in fr.items()})

# 키를 줄일 때는 윗몸 · 다리를 먼저 줄이고 잇기 — 이은 뒤 줄이면 들썩 장면만 다른 줄이 뽑혀 머리가 떨림
rows_to = int(sys.argv[6]) if len(sys.argv) > 6 else 0
k = rows_to / (H + 1) if rows_to and rows_to < H + 1 else 1.0


def shrink(img):
    if k == 1.0:
        return img
    g = img.resize((max(1, round(img.width * k)), max(1, round(img.height * k))), Image.NEAREST)
    g.putalpha(Image.eval(g.getchannel("A"), lambda v: 255 if v >= 128 else 0))
    return g


CW, CH = round(W * k), round((H + 1) * k)
upper = shrink(base.crop((0, 0, W, cut)))  # 모든 장면에 같은 윗몸 (한 번만 줄임)
frames = []
for i in order:
    f = fr[i]
    r = shorts_rows(f)
    if not r:
        sys.exit(f"{name}_{i}.png 에서 다리 위 옷 색을 못 찾음")
    dx = round((cx0 - shorts_cx(f, r[0], r[0] + 3)) * k)
    canvas = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    legs = shrink(f.crop((0, r[0], W, H)))
    legs_top = CH - legs.height  # 발은 늘 맨 아래 (땅)
    lift = 1 if (bob and spread(f) < 15) else 0  # 다리가 모인 장면은 윗몸만 1칸 위로 (줄인 뒤의 1칸)
    canvas.alpha_composite(upper, (0, legs_top - upper.height - lift))
    if lift:  # 윗몸과 다리 사이 1칸 — 다리 맨 윗줄을 한 번 더
        canvas.alpha_composite(legs.crop((0, 0, legs.width, 1)), (dx, legs_top - 1))
    canvas.alpha_composite(legs, (dx, legs_top))
    frames.append(canvas)
    print(i, "dx", dx, "lift", lift)


def to_p(img):
    a = img.getchannel("A")
    p = img.convert("RGB").quantize(colors=255, dither=Image.Dither.NONE)
    p.paste(255, Image.eval(a, lambda v: 255 if v < 128 else 0))
    p.info["transparency"] = 255
    return p


tag = "_".join(map(str, order)) + ("_bob" if bob else "")
for scale, suffix in ((1, ""), (4, "_x4")):
    seq = [to_p(f.resize((f.width * scale, f.height * scale), Image.NEAREST)) for f in frames]
    seq[0].save(f"{folder}/{name}_rewalk{suffix}.gif", save_all=True, append_images=seq[1:], duration=160, loop=0, disposal=2, transparency=255)
strip = Image.new("RGBA", ((CW * 6 + 10) * len(frames), CH * 6), (232, 236, 246, 255))
for n, f in enumerate(frames):
    strip.alpha_composite(f.resize((CW * 6, CH * 6), Image.NEAREST), (n * (CW * 6 + 10), 0))
strip.save(f"{folder}/_rewalk_strip.png")
for n, f in enumerate(frames):
    f.save(f"{folder}/{name}_rewalk_{n + 1}.png")
fw, fh = CW, CH
sheet = Image.new("RGBA", (fw * len(frames), fh), (0, 0, 0, 0))
for n, f in enumerate(frames):
    sheet.alpha_composite(f, (n * fw, 0))
sheet.save(f"{folder}/{name}_sheet.png", optimize=True)
print("sheet", sheet.size, "한 장면", fw, "x", fh)
print("ok", tag)
