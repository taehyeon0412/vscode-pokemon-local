"""S03 사람 그림 1단계 — 다른 AI 가 만든 '픽셀 그림' (확대 · 흐림 · 칸 간격이 조금씩 다름) → 진짜 픽셀 장면 PNG.
실행: python scripts/people/pixelize.py <AI 그림 (옆 걷기 장면이 한 줄, 투명 배경)> <출력 폴더> <이름>
→ <이름>_1.png … (장면마다) · <이름>_walk.gif · _<이름>_preview.png. 다음은 rewalk.py (순서 · 윗몸 고정 · 시트)
1) 칸 경계 찾기 — 색이 바뀌는 세기를 줄로 모아, 간격 10 ~ 17px 안에서 경계를 고름 (동적 계획)
2) 칸마다 가장 많은 색 → 색 수 줄이기
3) 테두리 밖 흰 배경 → 투명 (바깥에서 번지기)
4) 장면 나누기 → 머리 위치로 가로 맞춤 · 발로 세로 맞춤 → PNG · GIF
"""
import os
import sys
from collections import Counter

from PIL import Image, ImageChops, ImageStat

src, out, name = sys.argv[1:4]
os.makedirs(out, exist_ok=True)
src_im = Image.open(src).convert("RGBA")
W, H = src_im.size
# 투명 배경 → 자홍색 위에 (칸 찾기용), 알파는 따로
im = Image.new("RGB", (W, H), (255, 0, 255))
im.paste(src_im, (0, 0), src_im)
alpha_px = src_im.getchannel("A").load()


def bounds(profile, lo=10, hi=17, k=1.0):
    """색이 바뀌는 세기 줄에서, 간격 lo~hi 로 경계를 고름 (합이 가장 크게 — 동적 계획)"""
    n = len(profile)
    nz = [v for v in profile if v > 0.5]
    pen = k * sum(nz) / max(1, len(nz))
    NEG = -1e18
    best = [NEG] * (n + 1)
    prev = [-1] * (n + 1)
    for i in range(0, hi + 1):
        best[i] = profile[i] if i < n else 0
    for i in range(1, n + 1):
        for g in range(lo, hi + 1):
            j = i - g
            if j >= 0 and best[j] > NEG:
                v = best[j] + (profile[i] if i < n else 0) - pen
                if v > best[i]:
                    best[i], prev[i] = v, j
    # 끝에서 가장 좋은 곳부터 되짚기
    end = max(range(n - hi, n + 1), key=lambda i: best[i])
    out = []
    i = end
    while i >= 0:
        out.append(i)
        i = prev[i]
    return sorted(out)


diff_x = ImageChops.difference(im.crop((1, 0, W, H)), im.crop((0, 0, W - 1, H))).convert("L")
diff_y = ImageChops.difference(im.crop((0, 1, W, H)), im.crop((0, 0, W, H - 1))).convert("L")
prof_x = [0.0] + list(diff_x.resize((W - 1, 1), Image.BOX).get_flattened_data())
prof_y = [0.0] + list(diff_y.resize((1, H - 1), Image.BOX).get_flattened_data())
xs = bounds(prof_x)
ys = bounds(prof_y)
gaps = [b - a for a, b in zip(xs, xs[1:])]
print("cells", len(xs) - 1, "x", len(ys) - 1, "gap avg", round(sum(gaps) / len(gaps), 2))

# 2) 칸마다 가장 많은 색 (가장자리 1/4 은 빼고 가운데만)
nw, nh = len(xs) - 1, len(ys) - 1
px = im.load()
cells = Image.new("RGB", (nw, nh))
clear = set()
cp = cells.load()
for cy in range(nh):
    for cx in range(nw):
        x0, x1, y0, y1 = xs[cx], xs[cx + 1], ys[cy], ys[cy + 1]
        mx, my = (x1 - x0) // 4, (y1 - y0) // 4
        cnt = Counter()
        for y in range(y0 + my, max(y1 - my, y0 + my + 1)):
            for x in range(x0 + mx, max(x1 - mx, x0 + mx + 1)):
                xx, yy = min(x, W - 1), min(y, H - 1)
                if alpha_px[xx, yy] < 128:
                    cnt[None] += 1
                    continue
                r, g, b = px[xx, yy]
                cnt[(r // 8 * 8, g // 8 * 8, b // 8 * 8)] += 1
        top = cnt.most_common(1)[0][0]
        cp[cx, cy] = (255, 0, 255) if top is None else top
        if top is None:
            clear.add((cx, cy))
pal = cells.quantize(colors=40, method=Image.Quantize.MAXCOVERAGE, dither=Image.Dither.NONE).convert("RGB")

# 3) 투명 칸
rgba = pal.convert("RGBA")
rp = rgba.load()
for (x, y) in clear:
    rp[x, y] = (0, 0, 0, 0)

# 4) 장면 나누기
cols = [any(rp[x, y][3] for y in range(nh)) for x in range(nw)]
segs, start = [], None
for x, c in enumerate(cols + [False]):
    if c and start is None:
        start = x
    if not c and start is not None:
        if x - start > 6:
            segs.append((start, x))
        start = None
print("frames", segs)
frames = []
for a, b in segs:
    f = rgba.crop((a, 0, b, nh))
    bb = f.getbbox()
    f = f.crop((0, bb[1], f.width, bb[3]))
    # 머리 (위 8줄) 가운데
    top = f.crop((0, 0, f.width, 8)).getbbox()
    frames.append((f, (top[0] + top[2]) / 2))
fw = max(f.width for f, _ in frames) + 6
fh = max(f.height for f, _ in frames)
heads = [h for _, h in frames]
out_frames = []
for i, (f, h) in enumerate(frames):
    canvas = Image.new("RGBA", (fw, fh), (0, 0, 0, 0))
    x = round(fw / 2 - h)
    canvas.alpha_composite(f, (x, fh - f.height))
    canvas.save(f"{out}/{name}_{i + 1}.png")
    out_frames.append(canvas)
print("size", fw, fh)


def to_p(img):
    alpha = img.getchannel("A")
    p = img.convert("RGB").quantize(colors=255, dither=Image.Dither.NONE)
    p.paste(255, Image.eval(alpha, lambda a: 255 if a < 128 else 0))
    p.info["transparency"] = 255
    return p


seq = [to_p(f) for f in out_frames]
seq[0].save(f"{out}/{name}_walk.gif", save_all=True, append_images=seq[1:], duration=150, loop=0, disposal=2, transparency=255)
# 미리보기: 4장 4배 + 원본 줄인 것
prev = Image.new("RGBA", (fw * 4 * len(out_frames) + 10 * len(out_frames), fh * 4), (232, 236, 246, 255))
for i, f in enumerate(out_frames):
    prev.alpha_composite(f.resize((fw * 4, fh * 4), Image.NEAREST), (i * (fw * 4 + 10), 0))
prev.save(f"{out}/_{name}_preview.png")
