#!/usr/bin/env python3
"""원본에 없는 포켓몬을 PMD SpriteCollab 그림으로 만들어 내 PC 전용 vscode-pokemon(extension/)에 등록한다.

  python3 ~/.claude/vscode-pokemon-local/add-pokemon.py 658 greninja Greninja 개굴닌자
  python3 ~/.claude/vscode-pokemon-local/install.py    ← 그다음 설치

- 서 있기 = 정면, 걷기 = 오른쪽 (왼쪽으로 갈 땐 확장이 좌우를 뒤집음) — 기존 그림과 같은 방향
- 애니메이션마다 가장 낮은 점을 바닥(맨 아래 1px 위)에 맞추고, 프레임끼리 위치 차이는 그대로 둔다
- 32×32 에 안 들어가면 64×64 (확장의 originalSpriteSize 64 — 도트 크기는 같음)
- 그림: extension/media/gen<N>/<키>/{default,shiny}_{idle,walk}_8fps.gif, 한글 이름: extension/l10n/pokemon/ko/gen<N>.json
- 등록: pokemon.json 목록으로 POKEMON-EXTRA-PATCH 블록을 다시 씀 (데이터 2곳 · 세대 메뉴 · 한글 이름 세대 목록), 끝나면 make-moves.py 로 기술 표도 갱신
- 그림: PMD SpriteCollab (CC BY-NC 4.0, 작가는 저장소 sprite/<번호>/credits.txt) — 개인 비상업 용도
Pillow 필요 (pip3 install pillow).
"""
import io
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.request

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
EXT = os.path.join(HERE, "extension")
MANIFEST = os.path.join(HERE, "pokemon.json")
BASE = "https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite"
# PMD 시트 줄 = 방향 (0 아래 · 2 오른쪽)
ANIMS = {"idle": ("Idle", 0), "walk": ("Walk", 2)}
GEN_LAST_ID = [151, 251, 386, 493, 649, 721, 809, 905, 1025]

EXTRA_BEGIN = "/* POKEMON-EXTRA-PATCH */"
EXTRA_END = "/* /POKEMON-EXTRA-PATCH */"
DATA_ANCHOR = "\n};\nexports.POKEMON_DATA = Object.fromEntries("
GEN_ANCHOR = 'PokemonGeneration[PokemonGeneration["Gen5"] = 5] = "Gen5";'
L10N_ANCHOR = "const GENERATIONS = ['gen1', 'gen2', 'gen3', 'gen4', 'gen5'];"


def generation(dex):
    return next(i + 1 for i, last in enumerate(GEN_LAST_ID) if dex <= last)


def fetch(url):
    try:
        with urllib.request.urlopen(url, timeout=20) as res:
            return res.read()
    except Exception:
        return None


# AnimData.xml 은 구조가 단순해서 정규식으로 읽음 (homebrew python 의 xml 모듈이 깨져 있음)
def anim_info(xml, name):
    anims = {re.search(r"<Name>(\w+)</Name>", a).group(1): a for a in re.findall(r"<Anim>(.*?)</Anim>", xml, re.S)}
    a = anims[name]
    copy = re.search(r"<CopyOf>(\w+)</CopyOf>", a)
    if copy:
        return anim_info(xml, copy.group(1))
    size = lambda tag: int(re.search(rf"<{tag}>(\d+)</{tag}>", a).group(1))
    durations = [int(d) for d in re.findall(r"<Duration>(\d+)</Duration>", a)]
    return name, size("FrameWidth"), size("FrameHeight"), durations


def load_frames(folder, xml, kind):
    name, fw, fh, durations = anim_info(xml, ANIMS[kind][0])
    sheet = Image.open(io.BytesIO(fetch(f"{folder}/{name}-Anim.png"))).convert("RGBA")
    row = ANIMS[kind][1]
    frames = [sheet.crop((c * fw, row * fh, (c + 1) * fw, (row + 1) * fh)) for c in range(sheet.width // fw)]
    # 1틱 = 1/60초, GIF 는 10ms 단위
    ms = [max(20, round(t * 1000 / 60 / 10) * 10) for t in durations]
    return frames, ms, fw


def placement(frames, fw, canvas):
    """프레임 묶음을 캔버스에 놓을 위치 — 안 들어가면 None"""
    boxes = [f.getchannel("A").getbbox() for f in frames]
    left = min(b[0] for b in boxes)
    top = min(b[1] for b in boxes)
    right = max(b[2] for b in boxes)
    bottom = max(b[3] for b in boxes)
    if right - left > canvas or bottom - top > canvas - 1:
        return None
    # 프레임 가운데를 캔버스 가운데에, 넘치면 안으로 밀어 넣음
    dx = canvas // 2 - fw // 2
    dx = min(max(dx, -left), canvas - right)
    return dx, (canvas - 1) - bottom


def pixels(img):
    # Pillow 12 부터 getdata 대신 get_flattened_data
    return getattr(img, "get_flattened_data", img.getdata)()


def save_gif(frames, ms, dx, dy, canvas, path):
    placed = []
    for f in frames:
        c = Image.new("RGBA", (canvas, canvas))
        c.paste(f, (dx, dy))
        placed.append(c)
    # 0번 = 투명, 나머지는 쓰인 색 그대로
    colors = sorted({px[:3] for c in placed for px in pixels(c) if px[3] >= 128})
    if len(colors) > 255:
        sys.exit(f"색이 너무 많음 ({len(colors)})")
    index = {rgb: i + 1 for i, rgb in enumerate(colors)}
    palette = [0, 0, 0] + [v for rgb in colors for v in rgb]
    out = []
    for c in placed:
        p = Image.new("P", c.size)
        p.putpalette(palette + [0] * (768 - len(palette)))
        p.putdata([index[px[:3]] if px[3] >= 128 else 0 for px in pixels(c)])
        out.append(p)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    out[0].save(path, save_all=True, append_images=out[1:], duration=ms, loop=0, disposal=2, transparency=0, optimize=False)


def put_block(rel, anchor, code, after):
    # 지난번 블록은 지우고 다시 넣는다 — 목록이 바뀌어도 반영
    path = os.path.join(EXT, rel)
    src = open(path, encoding="utf-8").read()
    src = re.sub(r"\n?" + re.escape(EXTRA_BEGIN) + r".*?" + re.escape(EXTRA_END), "", src, flags=re.S)
    if src.count(anchor) != 1:
        sys.exit(f"{rel}: 넣을 자리를 못 찾음")
    i = src.index(anchor) + (len(anchor) if after else 0)
    src = src[:i] + "\n" + EXTRA_BEGIN + code + EXTRA_END + src[i:]
    write_atomic(path, src)


def write_atomic(path, text):
    # 임시 파일에 다 쓴 뒤 바꿈 — 쓰다가 실패해도 main-bundle.js 가 비거나 반쯤 남지 않게.
    # 윈도우에서 다른 프로그램(VS Code · 백신)이 잠깐 잡고 있으면 조금 쉬며 몇 번 다시
    tmp = f"{path}.{os.getpid()}.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(text)
    for attempt in range(6):
        try:
            os.replace(tmp, path)
            return
        except OSError:
            if attempt == 5:
                os.remove(tmp)
                raise
            time.sleep(0.2 * (attempt + 1))


def register(pokemon):
    entries = "".join(
        f"\n    {key}: {{ id: {p['id']}, name: {json.dumps(p['name'])}, generation: {p['generation']},"
        f" cry: {json.dumps(p['name'] + '!')}, possibleColors: {json.dumps(p['colors'])},"
        + (f" originalSpriteSize: {p['size']}," if p["size"] != 32 else "")
        + " },"
        for key, p in pokemon.items()
    ) + "\n"
    gens = sorted({p["generation"] for p in pokemon.values() if p["generation"] > 5})
    enum = "".join(f' PokemonGeneration[PokemonGeneration["Gen{g}"] = {g}] = "Gen{g}";' for g in gens) + " "
    l10n = "".join(f" GENERATIONS.push('gen{g}');" for g in gens) + " "
    put_block("media/main-bundle.js", DATA_ANCHOR, entries, False)
    put_block("out/common/pokemon-data.js", DATA_ANCHOR, entries, False)
    put_block("out/common/types.js", GEN_ANCHOR, enum, True)
    put_block("out/common/localize.js", L10N_ANCHOR, l10n, True)


def main():
    if len(sys.argv) != 5:
        sys.exit(__doc__)
    dex, key, name, ko = int(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4]
    gen = generation(dex)
    num = f"{dex:04d}"

    sources = {"default": f"{BASE}/{num}", "shiny": f"{BASE}/{num}/0000/0001"}
    loaded = {}
    for color, folder in sources.items():
        xml = fetch(f"{folder}/AnimData.xml")
        if xml is not None:
            xml = xml.decode("utf-8")
        else:
            if color == "default":
                sys.exit(f"#{num} 그림 없음")
            print("색이 다른 개체 그림 없음 — 기본만 만듦")
            continue
        loaded[color] = {kind: load_frames(folder, xml, kind) for kind in ANIMS}

    # 서 있기 · 걷기 · 색 모두 같은 캔버스 크기
    canvas = next(
        size
        for size in (32, 64)
        if all(placement(fr, fw, size) for anims in loaded.values() for fr, _, fw in anims.values())
    )
    for color, anims in loaded.items():
        for kind, (frames, ms, fw) in anims.items():
            dx, dy = placement(frames, fw, canvas)
            save_gif(frames, ms, dx, dy, canvas, os.path.join(EXT, "media", f"gen{gen}", key, f"{color}_{kind}_8fps.gif"))

    manifest = json.load(open(MANIFEST, encoding="utf-8")) if os.path.exists(MANIFEST) else {}
    manifest[key] = {"id": dex, "name": name, "generation": gen, "colors": list(loaded), "size": canvas}
    json.dump(manifest, open(MANIFEST, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    ko_path = os.path.join(EXT, "l10n", "pokemon", "ko", f"gen{gen}.json")
    names = json.load(open(ko_path, encoding="utf-8")) if os.path.exists(ko_path) else {}
    names[key] = ko
    write_atomic(ko_path, json.dumps(names, ensure_ascii=False, indent="\t") + "\n")

    register(manifest)
    # 새 포켓몬도 타입별 기술 · 입 위치 반영
    subprocess.run([sys.executable, os.path.join(HERE, "make-moves.py")], check=True)
    # 게임 모드 데이터 · 함께 들어 있는 작품 고지도 새 포켓몬에 맞게 (Node.js 가 있으면)
    node = shutil.which("node")
    if node:
        for script in ("fetch-pokeapi.mjs", "make-notices.mjs"):
            subprocess.run([node, os.path.join(HERE, "scripts", script)], check=True)
    else:
        print("Node.js 가 없어 게임 데이터 · 고지를 다시 만들지 못함 — node scripts/fetch-pokeapi.mjs · node scripts/make-notices.mjs 를 돌려 주세요")
    print(f"{ko}({key}) #{num} gen{gen} · {canvas}×{canvas} · {', '.join(loaded)} — 설치: python3 {HERE}/install.py")


if __name__ == "__main__":
    main()
