"""게임 글꼴 줄이기 (orders #140 최적화 — 2026-10-30 기획): 원본 Pretendard 가변 글꼴 (dev/fonts/PretendardVariable.woff2 · OFL) 에서
게임 · 데이터 · 연출에 나오는 글자 + 상용 한글 2,350자 (KS X 1001 — 새 말이 생겨도 거의 다 들어가는 안전망) + 보이는 ASCII 만 남기고,
이름을 "PG Sans" 로 바꿔 extension/media/fonts/PGSansVariable.woff2 로 씀 (굵기 축 · 글자 모양 · 글자 사이 그대로 — 2.06 MB → 약 0.46 MB).
OFL 3조: 원본에 Reserved Font Name "Pretendard" 가 있어 바꾼 판 (줄인 판도) 은 그 이름을 못 씀 → 글꼴 안 이름 · 파일 이름 · CSS 이름 모두 PG Sans.
  python dev/font-subset.py          만들기 (fontTools · brotli 필요 — pip install fonttools brotli)
  python dev/font-subset.py --check  코드 · 데이터에 나오는 글자 중 원본에 있는데 줄인 글꼴에 없는 것 (있으면 목록 · 끝 코드 1 — 다시 만들기)
글자 목록 (테스트 src/test/unit/font-subset.test.ts 가 읽음): dev/fonts/pg-sans-chars.txt (줄인 글꼴 글자) · dev/fonts/pretendard-chars.txt (원본 글자)"""
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "dev", "fonts", "PretendardVariable.woff2")
OUT = os.path.join(ROOT, "extension", "media", "fonts", "PGSansVariable.woff2")
CHARS = os.path.join(ROOT, "dev", "fonts", "pg-sans-chars.txt")
ORIG_CHARS = os.path.join(ROOT, "dev", "fonts", "pretendard-chars.txt")
# 글자를 모으는 곳 — 게임 화면 · 연출 · 받아 온 데이터 (포켓몬 · 기술 · 아이템 이름) · 확장 쪽 말
SCAN = ["src", "ult", os.path.join("extension", "media")]
EXTS = (".ts", ".tsx", ".js", ".json", ".css", ".html")
SKIP = ("node_modules", os.path.join("extension", "media", "fonts"))
FAMILY = "PG Sans"
PS = "PGSans"


def scanned_chars():
    chars = set()
    for top in SCAN:
        for dp, _dn, fn in os.walk(os.path.join(ROOT, top)):
            if any(s in dp for s in SKIP):
                continue
            for f in fn:
                if not f.endswith(EXTS) or f.endswith(".min.js"):
                    continue
                try:
                    chars.update(open(os.path.join(dp, f), encoding="utf-8").read())
                except (UnicodeDecodeError, OSError):
                    pass
    return {c for c in chars if 0x20 <= ord(c) <= 0xFFFF}


def ks_hangul():
    out = set()
    for cp in range(0xAC00, 0xD7A4):
        try:
            if len(chr(cp).encode("euc-kr")) == 2:
                out.add(chr(cp))
        except UnicodeEncodeError:
            pass
    return out


def cmap_chars(path):
    f = TTFont(path)
    return {chr(cp) for cp in f.getBestCmap() if cp <= 0xFFFF}


def rename(font):
    for rec in font["name"].names:
        if rec.nameID in (1, 3, 4, 16, 17, 21):
            s = rec.toUnicode()
            if "Pretendard" in s:
                rec.string = s.replace("Pretendard", FAMILY)
        elif rec.nameID in (6, 25):
            s = rec.toUnicode()
            if "Pretendard" in s:
                rec.string = s.replace("Pretendard", PS)
    # 바꾼 판이라는 말 (설명 칸)
    font["name"].setName(f"{FAMILY} — subset of Pretendard (OFL 1.1, Reserved Font Name Pretendard) for vscode-pokemon-local", 10, 3, 1, 0x409)


def main():
    orig = cmap_chars(SRC)
    want = (scanned_chars() | ks_hangul() | {chr(c) for c in range(0x20, 0x7F)}) & orig
    if "--check" in sys.argv:
        have = set(open(CHARS, encoding="utf-8").read())
        missing = sorted((scanned_chars() & orig) - have)
        if missing:
            print(f"줄인 글꼴에 없는 글자 {len(missing)}: {''.join(missing)} — python dev/font-subset.py 로 다시 만들기")
            sys.exit(1)
        print("글자 ✓")
        return
    opts = subset.Options()
    opts.layout_features = ["*"]
    opts.flavor = "woff2"
    opts.name_IDs = ["*"]
    opts.name_languages = ["*"]
    opts.notdef_outline = True
    # OS/2 코드 페이지 · 유니코드 범위는 원본 그대로 — 다시 세면 라틴 1 하나만 남아 Windows 가 동아시아 글꼴로 안 보고
    #   ClearType 색 번짐으로 그림 (결과 칩 금색 글자 가에 빨강 · 초록 — bugs 2727)
    opts.prune_unicode_ranges = False
    opts.prune_codepage_ranges = False
    font = TTFont(SRC)
    sub = subset.Subsetter(options=opts)
    sub.populate(text="".join(sorted(want)))
    sub.subset(font)
    rename(font)
    font.flavor = "woff2"
    font.save(OUT)
    with open(CHARS, "w", encoding="utf-8", newline="\n") as f:
        f.write("".join(sorted(cmap_chars(OUT))))
    with open(ORIG_CHARS, "w", encoding="utf-8", newline="\n") as f:
        f.write("".join(sorted(orig)))
    print(f"{os.path.relpath(OUT, ROOT)} {os.path.getsize(OUT):,} B (원본 {os.path.getsize(SRC):,} B) · 글자 {len(want):,}")


if __name__ == "__main__":
    main()
