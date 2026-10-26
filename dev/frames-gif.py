"""연속 캡처 (f_<ms>.png — dev/cdp-frames.py 등) → GIF (장면 간격 = 실제 ms) — 개발 · 디자인이 같이 씀 (2026-10-24 기획)
  python dev/frames-gif.py <폴더> <out.gif> [시작ms] [끝ms] [crop=x0,y0,x1,y1] [scale=정수] [keep=1]
  깨진 장은 뺌 (keep=1 이면 그대로): 찍기가 200ms 넘게 멈춘 바로 뒤 한 장 · 위 줄이 겹쳐 그려진 장 (머리 없는 브라우저가 멈칫한 뒤
  화면을 덜 그린 채 찍은 것 — 정보줄이 세 줄로 쌓여 보여 태현 님께 가는 GIF 에서 버그로 읽히던 것, #108 beam_before 14.30초 · r96_foe 13.84초)"""
import os
import sys

from PIL import Image, ImageChops, ImageStat

GAP_MS = 200


def frames(d, a, b):
    out = []
    for f in os.listdir(d):
        if f.startswith("f_") and f.endswith(".png"):
            try:
                t = int(f[2:-4])
            except ValueError:
                continue
            if a <= t <= b:
                out.append((t, os.path.join(d, f)))
    return sorted(out)


def torn(im):
    """위 36px 줄이 61px 아래에 그대로 한 번 더 있으면 (정보줄 · 위 줄이 겹쳐 쌓인 깨진 장)"""
    if im.height < 100:
        return False
    w = im.width
    a = im.crop((0, 0, w, 36)).convert("RGB")
    b = im.crop((0, 61, w, 97)).convert("RGB")
    return sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3 < 10


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    pos = [x for x in sys.argv[1:] if "=" not in x]
    kv = dict(x.split("=", 1) for x in sys.argv[1:] if "=" in x)
    if len(pos) < 2:
        sys.exit(__doc__)
    d, out = pos[0], pos[1]
    a = int(pos[2]) if len(pos) > 2 else 0
    b = int(pos[3]) if len(pos) > 3 else 10**9
    crop = tuple(int(v) for v in kv["crop"].split(",")) if "crop" in kv else None
    scale = int(kv.get("scale", 1))
    keep = kv.get("keep") == "1"
    fs = frames(d, a, b)
    if not fs:
        sys.exit("장면 없음")
    picked, dropped = [], []
    for i, (t, p) in enumerate(fs):
        im = Image.open(p)
        if not keep and ((i and t - fs[i - 1][0] > GAP_MS) or torn(im)):
            dropped.append(t)
            continue
        if crop:
            im = im.crop(crop)
        if scale > 1:
            im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
        picked.append((t, im.convert("RGB")))
    ims = [im for _, im in picked]
    # 장면 간격 = 다음 장까지 실제 ms (뺀 장 자리는 앞 장이 그만큼 더 머묾)
    durs = [max(20, picked[i + 1][0] - picked[i][0]) for i in range(len(picked) - 1)] + [100]
    ims[0].save(out, save_all=True, append_images=ims[1:], duration=durs, loop=0, optimize=False, disposal=1)
    print(f"{out} — {len(ims)}장" + (f" · 뺀 장 {len(dropped)} ({', '.join(map(str, dropped[:6]))}{' …' if len(dropped) > 6 else ''})" if dropped else ""))


if __name__ == "__main__":
    main()
