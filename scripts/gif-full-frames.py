"""포켓몬 GIF 를 "장면마다 전체" 로 다시 저장 (2026-10-20).
실행: python scripts/gif-full-frames.py [--check]
extension/media/gen*/*/*.gif 중 "바뀐 부분만 담은 장면" (프레임 칸이 그림 전체보다 작음) 이 있는 GIF 를,
모든 장면이 그림 전체를 담게 다시 저장함 (장면 · 시간 · 반복 · 투명은 그대로, 점 하나까지 같은지 확인한 뒤에만 덮어씀).
까닭: 태현 님 VS Code (맥) 에서 이런 GIF 를 칸 안에 잘라 넣으면 (스타팅 칩 · 진화 줄) 장면이 바뀔 때 일부만 그려져
뚜꾸리 · 개구마르 · 샤로다 · 브리가론 · 염무왕 · 개굴반장이 안 보이거나 잘림 — 652 대기 동작 GIF 중 18개 (모두 78 파일, 20종) 만 이 방식.
--check = 고칠 GIF 수만 셈 (파일은 안 바꿈).
"""
import glob
import os
import sys

from PIL import GifImagePlugin, Image, ImageChops, ImageSequence

# Pillow 는 둘째 장면부터 "바뀐 부분" 만 잘라 저장함 (_getbbox) — 그게 문제의 방식이라, 바뀐 장면이면 늘 전체 칸으로 (같은 장면은 그대로 합침)
_bbox = GifImagePlugin._getbbox


def _full_bbox(base_im, im_frame):
    delta, bbox = _bbox(base_im, im_frame)
    return delta, ((0, 0) + im_frame.size if bbox else None)


GifImagePlugin._getbbox = _full_bbox

HERE = os.path.dirname(os.path.abspath(__file__))
MEDIA = os.path.join(HERE, "..", "extension", "media")
check = "--check" in sys.argv


def partial(im):
    return any(fr.tile and fr.tile[0][1] != (0, 0) + im.size for fr in ImageSequence.Iterator(im))


def frames_of(path):
    im = Image.open(path)
    out = []
    for fr in ImageSequence.Iterator(im):
        out.append((fr.convert("RGBA"), fr.info.get("duration", im.info.get("duration", 125))))
    return out, im.info.get("loop", 0)


def shape(img):
    """투명 = 모양만 (알파 0 의 색은 무시) — 비교용 RGB + 모양"""
    m = img.getchannel("A").point(lambda v: 255 if v else 0)
    return Image.composite(img.convert("RGB"), Image.new("RGB", img.size), m), m


def timeline(frames):
    """연달아 같은 장면은 하나로 (시간 더함) — Pillow 가 저장할 때 똑같은 장면을 합쳐서"""
    out = []
    for img, d in frames:
        c, m = shape(img)
        if out and not ImageChops.difference(out[-1][0], c).getbbox() and not ImageChops.difference(out[-1][1], m).getbbox():
            out[-1][2] += d
        else:
            out.append([c, m, d])
    return out


KEY = (255, 0, 254)


def to_palette(frames):
    """모든 장면의 색을 한 팔레트 (0 = 투명) 에 모아 정확히 옮김 — Pillow 기본은 첫 장면 팔레트에 없는 색을 비슷한 색으로 바꿔서"""
    rgbs, colors = [], set()
    for img, _ in frames:
        rgb = Image.new("RGB", img.size, KEY)
        rgb.paste(img.convert("RGB"), mask=img.getchannel("A").point(lambda v: 255 if v else 0))
        rgbs.append(rgb)
        colors |= {c for _, c in rgb.getcolors(1 << 16)}
    colors = sorted(colors - {KEY})
    if len(colors) > 255:
        sys.exit("색이 255 개보다 많음")
    pal = [KEY] + colors
    palimg = Image.new("P", (1, 1))
    palimg.putpalette([v for c in pal for v in c] + [0] * (3 * (256 - len(pal))))
    return [rgb.quantize(palette=palimg, dither=Image.Dither.NONE) for rgb in rgbs]


fixed = 0
for path in sorted(glob.glob(os.path.join(MEDIA, "gen*", "*", "*.gif"))):
    with Image.open(path) as im:
        if not partial(im):
            continue
    if check:
        fixed += 1
        continue
    frames, loop = frames_of(path)
    tmp = path + ".tmp.gif"
    ps = to_palette(frames)
    ps[0].save(tmp, save_all=True, append_images=ps[1:], transparency=0, duration=[d for _, d in frames], loop=loop, disposal=2, optimize=False)
    # 점 하나까지 같은지 (투명은 모양만 · 연달아 같은 장면은 합쳐서 시간으로)
    again, _ = frames_of(tmp)
    ta, tb = timeline(frames), timeline(again)
    same = len(ta) == len(tb) and all(
        x[2] == y[2] and not ImageChops.difference(x[0], y[0]).getbbox() and not ImageChops.difference(x[1], y[1]).getbbox() for x, y in zip(ta, tb)
    )
    with Image.open(tmp) as t:
        still_partial = partial(t)
    if not same or still_partial:
        os.remove(tmp)
        sys.exit(f"다시 저장한 그림이 다름 · 아직 부분 장면: {path}")
    os.replace(tmp, path)
    fixed += 1
    print("고침", os.path.relpath(path, MEDIA))

print("ok", fixed, "GIF", "(셈만)" if check else "")
