#!/usr/bin/env python3
"""타입별 기술(불꽃 · 물대포 · 스파크 · 나뭇잎), 1세대 전용 기술(signature-moves.json)과 특수 행동(비행 · 멀리뛰기)을 extension/media/main-bundle.js 에 넣는다.

  python3 ~/.claude/vscode-pokemon-local/make-moves.py
  python3 ~/.claude/vscode-pokemon-local/install.py    ← 그다음 설치

- 기술: 첫 번째 타입 → 없으면 두 번째 타입 중 불꽃 · 물 · 전기 · 풀 (타입은 PokeAPI csv, pokemon-types.json 에 저장해 두고 재사용)
- 입 위치: 오른쪽 보는 걷기 그림 첫 프레임에서 위쪽 60% 안의 가장 오른쪽 점 (전기는 입 대신 몸 테두리 — 몸 둘레에서 스파크)
- 세기: 종족값(능력치 합) 200 → 0, 650 → 1 — 셀수록 기술이 크고 길고 화려함 (pokemon-stats.json 에 저장해 두고 재사용)
- 행동: 날개 있는 비행 타입은 fly, JUMPERS(개굴닌자류)는 jump
- 동작 코드는 moves.js — 고친 뒤 이 스크립트를 다시 실행 (블록을 지우고 다시 씀)
- add-pokemon.py 가 포켓몬을 추가할 때도 자동으로 실행
Pillow 필요 (pip3 install pillow).
"""
import csv
import io
import json
import os
import re
import subprocess
import sys
import urllib.request

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
EXT = os.path.join(HERE, "extension")
BUNDLE = os.path.join(EXT, "media", "main-bundle.js")
TYPES_CACHE = os.path.join(HERE, "pokemon-types.json")
SIGNATURE_FILE = os.path.join(HERE, "signature-moves.json")
STATS_CACHE = os.path.join(HERE, "pokemon-stats.json")
CSV_BASE = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv"
MOVE_OF_TYPE = {"fire": "fire", "water": "water", "electric": "electric", "grass": "grass"}
# 멀리뛰기 — 개굴닌자 계열 · 개구리 · 토끼 · 피그점프 · 닌자 · 격투가 (도감 번호)
JUMPERS = {
    656, 657, 658,  # 개구마르 · 개굴반장 · 개굴닌자
    60, 61, 62, 186,  # 발챙이 계열 · 왕구리
    453, 454,  # 삐딱구리 · 독개굴
    535, 536, 537,  # 동챙이 계열
    427, 428,  # 이어롤 · 이어롭
    325, 326,  # 피그점프 · 피그킹
    447, 448,  # 리오르 · 루카리오
    106, 107,  # 시라소몬 · 홍수몬
    619, 620,  # 비조푸 · 비조도
    215, 461,  # 포푸니 · 포푸니라
    123,  # 스라크 (비행 타입이지만 뛰는 쪽)
    617,  # 어지리더
}
# 비행 타입이지만 날개가 없는 애들 — 안 날아다님
WINGLESS = {130, 187, 188, 189, 226, 458, 425, 426, 384, 641, 642, 645, 84, 85}

BEGIN = "/* POKEMON-MOVES-PATCH */"
END = "/* /POKEMON-MOVES-PATCH */"
CODE_ANCHOR = "function handleMouseOver(e) {"
HOOK_ANCHOR = "collision.addEventListener('mouseover', handleMouseOver);"
HOOK = " collision.addEventListener('click', handleMoveClick); collision.addEventListener('pointerdown', handleDragStart); startMoveAuto(); "


def pokemon_list():
    # 확장 데이터 그대로 — 키 → [도감 번호, 세대]
    script = (
        "const d = require(process.argv[1]);"
        "console.log(JSON.stringify(Object.fromEntries(Object.entries(d.POKEMON_DATA)"
        ".map(([k, v]) => [k, [v.id, v.generation]]))))"
    )
    out = subprocess.run(
        ["node", "-e", script, os.path.join(EXT, "out", "common", "pokemon-data.js")],
        capture_output=True, text=True, check=True,
    ).stdout
    return json.loads(out)


def pokemon_types():
    if os.path.exists(TYPES_CACHE):
        return {int(k): v for k, v in json.load(open(TYPES_CACHE, encoding="utf-8")).items()}

    names = {r["id"]: r["identifier"] for r in csv_rows("types")}
    types = {}
    for r in sorted(csv_rows("pokemon_types"), key=lambda r: int(r["slot"])):
        types.setdefault(int(r["pokemon_id"]), []).append(names[r["type_id"]])
    json.dump(types, open(TYPES_CACHE, "w", encoding="utf-8"), indent=1)
    return types


def csv_rows(name):
    with urllib.request.urlopen(f"{CSV_BASE}/{name}.csv", timeout=30) as res:
        return list(csv.DictReader(io.StringIO(res.read().decode("utf-8"))))


def pokemon_stats():
    # 도감 번호 → 종족값 합
    if os.path.exists(STATS_CACHE):
        return {int(k): v for k, v in json.load(open(STATS_CACHE, encoding="utf-8")).items()}
    total = {}
    for r in csv_rows("pokemon_stats"):
        total[int(r["pokemon_id"])] = total.get(int(r["pokemon_id"]), 0) + int(r["base_stat"])
    json.dump(total, open(STATS_CACHE, "w", encoding="utf-8"), indent=1)
    return total


def walk_alpha(gif):
    im = Image.open(gif)
    im.seek(0)
    return im.convert("RGBA").getchannel("A")


def body(gif):
    return list(walk_alpha(gif).getbbox())


def mouth(gif):
    alpha = walk_alpha(gif)
    left, top, right, bottom = alpha.getbbox()
    head_end = top + max(1, int((bottom - top) * 0.6))
    rightmost = {}
    for y in range(top, head_end):
        xs = [x for x in range(left, right) if alpha.getpixel((x, y)) >= 128]
        if xs:
            rightmost[y] = max(xs)
    x = max(rightmost.values())
    ys = [y for y, rx in rightmost.items() if rx >= x - 1]
    return x, round(sum(ys) / len(ys))


def signatures(pokemon):
    # 전용 기술 표 — 암컷 모습(_female)은 기본 모습 것을 그대로
    raw = {k: v for k, v in json.load(open(SIGNATURE_FILE, encoding="utf-8")).items() if not k.startswith("_")}
    for key in pokemon:
        base = key[: -len("_female")] if key.endswith("_female") else None
        if base and base in raw and key not in raw:
            raw[key] = raw[base]
    return {k: v for k, v in raw.items() if k in pokemon}


def write_bundle(table, acts, sig, shape):
    src = open(BUNDLE, encoding="utf-8").read()
    # 지난번 블록 지우기 — 한 줄짜리(연결)부터, 그다음 여러 줄(코드)
    src = re.sub(" " + re.escape(BEGIN) + r" [^\n]*?" + re.escape(END), "", src)
    src = re.sub(re.escape(BEGIN) + r"\n.*?" + re.escape(END) + r"\n", "", src, flags=re.S)
    if src.count(CODE_ANCHOR) != 1 or src.count(HOOK_ANCHOR) != 1:
        sys.exit("main-bundle.js: 넣을 자리를 못 찾음")
    code = open(os.path.join(HERE, "moves.js"), encoding="utf-8").read()
    moves = "const POKEMON_MOVES = " + json.dumps(table, separators=(",", ":")) + ";\n"
    moves += "const POKEMON_ACTS = " + json.dumps(acts, separators=(",", ":")) + ";\n"
    moves += "const POKEMON_SIGNATURE = " + json.dumps(sig, ensure_ascii=False, separators=(",", ":")) + ";\n"
    moves += "const POKEMON_SHAPE = " + json.dumps(shape, separators=(",", ":")) + ";\n"
    i = src.index(CODE_ANCHOR)
    src = src[:i] + BEGIN + "\n" + moves + code + END + "\n" + src[i:]
    i = src.index(HOOK_ANCHOR) + len(HOOK_ANCHOR)
    src = src[:i] + " " + BEGIN + HOOK + END + src[i:]
    open(BUNDLE, "w", encoding="utf-8").write(src)


def main():
    types = pokemon_types()
    stats = pokemon_stats()
    table = {}
    acts = {}
    pokemon = pokemon_list()
    sig = signatures(pokemon)
    shape = {}
    for key, (dex, gen) in pokemon.items():
        move = next((MOVE_OF_TYPE[t] for t in types.get(dex, []) if t in MOVE_OF_TYPE), None)
        gif = os.path.join(EXT, "media", f"gen{gen}", key, "default_walk_8fps.gif")
        if not os.path.exists(gif):
            continue
        power = round(min(1, max(0, (stats.get(dex, 400) - 200) / 450)), 2)
        if move:
            table[key] = [move, power, *(body(gif) if move == "electric" else mouth(gif))]
        if key in sig:
            shape[key] = [power, *mouth(gif), *body(gif)]
        if dex in JUMPERS:
            acts[key] = "jump"
        elif "flying" in types.get(dex, []) and dex not in WINGLESS:
            acts[key] = "fly"
    write_bundle(table, acts, sig, shape)
    subprocess.run(["node", "--check", BUNDLE], check=True)
    counts = {m: sum(1 for v in table.values() if v[0] == m) for m in MOVE_OF_TYPE.values()}
    print(f"기술 {len(table)}종 — " + " · ".join(f"{m} {n}" for m, n in counts.items()))
    print(f"전용 기술 {len(shape)}종 (연출 틀 {len({(v[0] if isinstance(v[0], list) else v)[1] for v in sig.values()})}개)")
    print(f"행동 — 비행 {sum(1 for a in acts.values() if a == 'fly')} · 멀리뛰기 {sum(1 for a in acts.values() if a == 'jump')}")


if __name__ == "__main__":
    main()
