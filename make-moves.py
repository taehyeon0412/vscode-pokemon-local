#!/usr/bin/env python3
"""타입별 기술, 대표 기술(signature-moves.json · moves-data/*.json), 필살기(꾹 누르기 — ult/)와 특수 행동(비행 · 멀리뛰기)을 extension/media/main-bundle.js 에 넣는다.

  python3 ~/.claude/vscode-pokemon-local/make-moves.py
  python3 ~/.claude/vscode-pokemon-local/install.py    ← 그다음 설치
  python3 make-moves.py --out dev/build/test.js        ← 미리보기용 (main-bundle.js 는 그대로, 망가진 데이터 파일은 건너뜀)

- 클릭 기술: 대표 기술(1세대 signature-moves.json + moves-data 의 moves) + 타입 기술(TYPE_MOVES, 종족값 단계) 중 무작위 — 모든 포켓몬
- 필살기: moves-data 의 ult → 없으면 타입 기본(TYPE_ULTS). 키는 rotom_heat → rotom 처럼 밑줄 앞으로 줄여 가며 찾음
- 예전 기술(POKEMON_MOVES): 첫 번째 타입 → 없으면 두 번째 타입 중 불꽃 · 물 · 전기 · 풀 (타입은 PokeAPI csv, pokemon-types.json 에 저장해 두고 재사용)
- 입 위치: 오른쪽 보는 걷기 그림 첫 프레임에서 위쪽 60% 안의 가장 오른쪽 점 (전기는 입 대신 몸 테두리 — 몸 둘레에서 스파크)
- 세기: 종족값(능력치 합) 200 → 0, 650 → 1 — 셀수록 기술이 크고 길고 화려함 (pokemon-stats.json 에 저장해 두고 재사용)
- 행동: 날개 있는 비행 타입은 fly, JUMPERS(개굴닌자류)는 jump
- 동작 코드는 moves.js + ult/core.js + ult/fx-*.js — 고친 뒤 이 스크립트를 다시 실행 (블록을 지우고 다시 씀)
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
DATA_DIR = os.path.join(HERE, "moves-data")
ULT_DIR = os.path.join(HERE, "ult")
STATS_CACHE = os.path.join(HERE, "pokemon-stats.json")
# 기술마다 모양 (#122 — 디자인 표: 게임 기술 id → {fx?: 틀, 변주 값 …}) · 게임 기술 이름 · 위력
LOOK_FILE = os.path.join(HERE, "dev", "move-look.json")
GAME_MOVES_FILE = os.path.join(HERE, "src", "game", "data", "generated", "moves.json")
# 위력 → 효과 크기 기본 (size — 포켓몬 그림은 그대로, 효과만) [임시값]: 위력 40 이하 0.85 ~ 120 이상 1.25 · 위력 없는 변화 기술 1.0 · 표에 적은 값은 0.7 ~ 1.4 로 자름
LOOK_SIZE = {"low": 40, "high": 120, "min": 0.85, "max": 1.25, "clamp": (0.7, 1.4)}
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
# 타입별 기술 — (이름, 연출 틀, 옵션, 필요 단계) 단계: 0 누구나 · 1 종족값 400+ · 2 종족값 500+
# 회오리(회오리불꽃 · 바다회오리 · 회오리 · 모래지옥)는 그 타입이면 누구나, 폭풍은 비행 타입 중 400+
TYPE_MOVES = {
    "normal": [("몸통박치기", "dash", {"c": "normal"}, 0), ("전광석화", "dash", {"c": "normal", "fast": 1}, 0), ("하이퍼보이스", "rings", {"c": "normal", "forward": 1, "n": 4}, 1), ("파괴광선", "beam", {"c": "hyper", "width": 1.4, "sparkle": "hyper"}, 2)],
    "fire": [("불꽃세례", "breath", {"c": "fire", "speed": 0.8, "life": 0.8}, 0), ("회오리불꽃", "vortex", {"c": "fire"}, 0), ("화염방사", "breath", {"c": "fire", "smoke": 1}, 1)],
    "water": [("물대포", "water", {}, 0), ("거품", "bubbles", {"c": "water"}, 0), ("바다회오리", "vortex", {"c": "water"}, 0), ("하이드로펌프", "beam", {"c": "water", "width": 1.5, "sparkle": "water"}, 2)],
    "electric": [("전기쇼크", "spark", {}, 0), ("10만볼트", "spark", {}, 1), ("번개", "thunder", {}, 2)],
    "grass": [("덩굴채찍", "beam", {"c": "grass", "len": 2.5, "width": 0.4, "wave": 1}, 0), ("잎날가르기", "projectile", {"shape": "leaf", "c": "grass", "n": 5, "every": 90}, 0), ("수면가루", "powder", {"c": "sleep"}, 1), ("솔라빔", "solarbeam", {}, 2)],
    "ice": [("얼음뭉치", "projectile", {"shape": "needle", "c": "ice", "n": 2, "every": 120}, 0), ("냉동빔", "beam", {"c": "ice", "sparkle": "ice"}, 1), ("눈보라", "breath", {"c": "ice", "snow": 1, "speed": 1.2, "rise": -0.4, "rate": 1.3}, 2)],
    "fighting": [("태권당수", "slash", {"c": "fight", "n": 1}, 0), ("메가톤펀치", "punch", {"c": "fight", "n": 1, "big": 1}, 0), ("크로스촙", "slash", {"c": "fight", "x": 1}, 1)],
    "poison": [("독침", "projectile", {"shape": "needle", "c": "poison", "n": 1}, 0), ("용해액", "breath", {"c": "poison", "speed": 0.7, "rise": -0.6, "life": 0.8}, 0), ("오물폭탄", "projectile", {"shape": "ball", "c": "sludge", "n": 2, "arc": 120, "every": 200}, 1)],
    "ground": [("진흙뿌리기", "projectile", {"shape": "ball", "c": "ground", "n": 2, "arc": 140, "every": 150, "speed": 0.8}, 0), ("모래지옥", "vortex", {"c": "ground"}, 0), ("지진", "quake", {"c": "ground"}, 1)],
    "flying": [("바람일으키기", "rings", {"c": "wind", "forward": 1, "n": 3}, 0), ("날개치기", "dash", {"c": "wind"}, 0), ("폭풍", "vortex", {"c": "wind"}, 1)],
    "psychic": [("염동력", "rings", {"c": "psychic", "n": 3}, 0), ("환상빔", "beam", {"c": "psychic", "wave": 1}, 1), ("사이코키네시스", "rings", {"c": "psychic", "n": 6}, 2)],
    "bug": [("실뿜기", "beam", {"c": "silk", "width": 0.3, "wave": 1, "len": 4}, 0), ("바늘미사일", "projectile", {"shape": "needle", "c": "bug", "n": 4, "every": 90}, 0), ("시저크로스", "slash", {"c": "bug", "x": 1}, 1)],
    "rock": [("돌떨구기", "rockfall", {"c": "rock", "n": 2}, 0), ("스톤샤워", "rockfall", {"c": "rock", "n": 5}, 1)],
    "ghost": [("핥기", "beam", {"c": "tongue", "len": 1.6, "width": 0.6}, 0), ("나이트헤드", "rings", {"c": "ghost", "n": 4}, 0), ("섀도볼", "projectile", {"shape": "ball", "c": "ghost", "n": 1, "big": 1, "speed": 0.8}, 1)],
    "dragon": [("용의분노", "breath", {"c": "dragon", "speed": 0.9}, 0), ("회오리", "vortex", {"c": "dragon"}, 0), ("용의숨결", "breath", {"c": "dragon", "smoke": 1}, 1)],
    "dark": [("물기", "slash", {"c": "dark", "n": 2}, 0), ("악의파동", "rings", {"c": "dark", "n": 4}, 1)],
    "steel": [("아이언테일", "slash", {"c": "steel", "n": 1}, 0), ("러스터캐논", "beam", {"c": "steel", "sparkle": "steel"}, 1)],
    "fairy": [("천사의키스", "projectile", {"shape": "heart", "c": "fairy", "n": 3, "every": 160, "speed": 0.6}, 0), ("문포스", "projectile", {"shape": "ball", "c": "moon", "n": 1, "big": 1}, 1)],
}

# 타입 기본 필살기 — 첫 번째 타입 (노말+X 면 X). 이름 · 연출 틀 · 옵션 (ult/SPEC.md)
TYPE_ULTS = {
    "normal": ["울트라대시어택", "ultrush", {"c": "normal"}],
    "fire": ["다이내믹풀플레임", "ultorb", {"c": "fire", "style": "flame"}],
    "water": ["하이드로보텍스", "ultvortex", {"c": "water"}],
    "grass": ["블룸샤인엑스트라", "ultbloom", {"mode": "bloom", "c": "grass"}],
    "electric": ["스파킹기가볼트", "ultthunder", {"mode": "spear", "c": "electric"}],
    "ice": ["레이징지오프리즈", "ultskyfall", {"shape": "ice", "n": 1, "c": "ice"}],
    "fighting": ["전력무쌍격렬권", "ultbarrage", {"kind": "punch", "c": "fight"}],
    "poison": ["애시드포이즌딜리트", "ultstorm", {"kind": "acid", "c": "poison"}],
    "ground": ["라이징랜드오버", "ultquake", {"c": "ground"}],
    "flying": ["파이널다이브클래시", "ultdive", {"c": "wind"}],
    "psychic": ["맥시멈사이브레이커", "ultpsy", {"c": "psychic"}],
    "bug": ["절대포식회전참", "ultbarrage", {"kind": "slash", "c": "bug", "spin": 1}],
    "rock": ["월즈엔드폴", "ultskyfall", {"shape": "rock", "n": 1, "c": "rock"}],
    "ghost": ["무한암야로의유인", "ultshadow", {"c": "ghost"}],
    "dragon": ["얼티메이트드래곤번", "ultdive", {"c": "dragon"}],
    "dark": ["블랙홀이클립스", "ultblackhole", {"c": "dark"}],
    "steel": ["초월나선연격", "ultrush", {"c": "steel", "drill": 1}],
    "fairy": ["러블리스타임팩트", "ultsparkle", {"mode": "twinkle", "c": "fairy"}],
}

# 타입 기술 없이 대표 기술만 — 잉어킹(튀어오르기 · 몸통박치기) · 메타몽 · 단데기 · 딱충이
ONLY_SIGNATURE = {"magikarp", "ditto", "metapod", "kakuna"}

# 비행 타입이지만 날개가 없는 애들 — 안 날아다님
WINGLESS = {130, 187, 188, 189, 226, 458, 425, 426, 384, 641, 642, 645, 84, 85}

BEGIN = "/* POKEMON-MOVES-PATCH */"
END = "/* /POKEMON-MOVES-PATCH */"
CODE_ANCHOR = "function handleMouseOver(e) {"
HOOK_ANCHOR = "collision.addEventListener('mouseover', handleMouseOver);"
HOOK = " collision.addEventListener('click', handleMoveClick); collision.addEventListener('pointerdown', handleDragStart); collision.addEventListener('pointerdown', handleUltPress); startMoveAuto(); "


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


# 자동으로 찾으면 잎 · 볏 · 뿔 · 배 끝에 걸리는 포켓몬 — 그림 높이의 몇 % 줄에서 가장 앞 점 (fy),
# [fx, fy] 는 그 줄에서 왼쪽부터 fx 너비 안의 가장 앞 점 (집게 · 팔 · 뿔이 머리보다 앞에 있을 때). 2026-10-19 확인표로 맞춤
MOUTH_FIX = {
    "abomasnow": 0.3, "aggron": 0.3, "ambipom": 0.38, "azumarill": 0.6, "barboach": 0.5, "bayleef": 0.35,
    "bellossom": 0.5, "blastoise": 0.42, "bonsly": 0.5, "breloom": 0.5, "budew": 0.55, "butterfree": 0.5,
    "cherubi": 0.6, "chikorita": 0.42, "chinchou": 0.55, "combee_female": 0.45, "combee_male": 0.45,
    "combusken": 0.4, "corphish": 0.5, "crustle": 0.68, "drifblim": 0.5, "electrode": 0.55, "empoleon": 0.4,
    "exeggutor": 0.75, "flaaffy": 0.42, "gastly": 0.62, "gloom": 0.62, "golbat": 0.45, "goldeen": 0.5,
    "gurdurr": 0.55, "gyarados": 0.3, "haunter": 0.42, "heracross_female": 0.42, "heracross_male": 0.42,
    "hooh": 0.55, "hoppip": 0.6, "hypno": 0.35, "jumpluff": 0.55, "jynx": 0.38, "kingler": [0.75, 0.55],
    "koffing": 0.5, "krabby": [0.7, 0.6], "lanturn": 0.6, "leafeon": 0.4, "leavanny": 0.3, "lombre": 0.5,
    "lotad": 0.7, "ludicolo": 0.55, "machamp": [0.75, 0.18], "magmar": 0.3, "magmortar": 0.35,
    "maractus": 0.3, "meganium": 0.3, "meganium_female": 0.3, "metapod": 0.45, "oddish": 0.72,
    "omastar": 0.55, "panpour": 0.45, "parasect": 0.72, "petilil": 0.55, "piloswine": 0.7, "pinsir": 0.45,
    "probopass": 0.55, "rayquaza": 0.45, "roserade": 0.4, "samurott": [0.75, 0.3], "scolipede": 0.3,
    "sentret": 0.6, "shedinja": 0.5, "shellder": 0.55, "skiploom": 0.62, "snorlax": [0.7, 0.22],
    "stantler": 0.5, "sunflora": 0.45, "sunkern": 0.62, "torterra": 0.65, "turtwig": 0.5, "venomoth": 0.42,
    "venonat": 0.55, "venusaur": 0.7, "venusaur_female": 0.7, "vileplume": 0.78, "zubat": 0.5,
}


def mouth(gif, key=None):
    # 머리 앞 — 가는 부분(더듬이 · 잎 끝 · 가스 꼬리처럼 1~2칸 폭)은 빼고, 위쪽 55% 줄마다 가장 앞 점을 보되
    # 아래로 갈수록 깎아서 (배 · 팔에 속지 않게) 가장 앞으로 나온 줄을 고름
    alpha = walk_alpha(gif)
    if alpha.getbbox() is None:
        return 0, 0
    w, h0 = alpha.size
    px = alpha.load()
    left, top, right, bottom = alpha.getbbox()
    h = bottom - top

    def solid(x, y):
        return 0 <= x < w and 0 <= y < h0 and px[x, y] >= 128

    fix = MOUTH_FIX.get(key)
    if fix is not None:
        fx, fy = fix if isinstance(fix, list) else (1, fix)
        y = min(bottom - 1, round(top + fy * h))
        xs = [x for x in range(left, right) if solid(x, y) and x <= left + fx * (right - left)]
        return (max(xs) if xs else right - 1), y

    def thick(x, y):
        return (solid(x, y) and solid(x - 1, y) and solid(x - 2, y) and (solid(x, y - 1) or solid(x, y + 1))
                and (solid(x - 1, y - 1) or solid(x - 1, y + 1)))

    rows = {}
    for y in range(top, top + max(1, int(h * 0.55))):
        xs = [x for x in range(left, right) if thick(x, y)]
        if xs:
            rows[y] = max(xs)
    if not rows:  # 아주 가는 그림 — 예전 방식 (위쪽 60%에서 가장 앞 점)
        for y in range(top, top + max(1, int(h * 0.6))):
            xs = [x for x in range(left, right) if solid(x, y)]
            if xs:
                rows[y] = max(xs)
        x = max(rows.values())
        ys = [y for y, rx in rows.items() if rx >= x - 1]
        return x, round(sum(ys) / len(ys))
    _, y0, x0 = max((rx - 0.35 * (y - top), -y, rx) for y, rx in rows.items())  # 같으면 위쪽 줄
    y0 = -y0
    ys = [y for y, rx in rows.items() if rx >= x0 - 1 and abs(y - y0) <= max(2, h * 0.08)]
    y = round(sum(ys) / len(ys))
    return max([x for x in range(left, right) if solid(x, y)] or [x0]), y


def as_list(v):
    return v if isinstance(v[0], list) else [v]


def lookup(table, key, field=None):
    # rotom_heat → rotom, basculin_red_striped → basculin_red → basculin (field 가 있으면 그 값이 있는 것까지)
    while True:
        v = table.get(key)
        if v is not None and (field is None or field in v):
            return v if field is None else v[field]
        if "_" not in key:
            return None
        key = key.rsplit("_", 1)[0]


def load_data(lenient):
    # moves-data/*.json 합치기 — {키: {moves, ult}}
    data = {}
    if not os.path.isdir(DATA_DIR):
        return data
    for name in sorted(os.listdir(DATA_DIR)):
        if not name.endswith(".json"):
            continue
        try:
            part = json.load(open(os.path.join(DATA_DIR, name), encoding="utf-8"))
        except Exception as e:  # noqa: BLE001
            if not lenient:
                sys.exit(f"moves-data/{name}: {e}")
            print(f"건너뜀 moves-data/{name}: {e}")
            continue
        data.update({k: v for k, v in part.items() if not k.startswith("_")})
    return data


def signatures(pokemon, data):
    # 대표 기술 (여러 개면 펼침) — 1세대 signature-moves.json + moves-data 의 moves. 다른 모습(_female 등)은 기본 모습 것
    raw = {k: v for k, v in json.load(open(SIGNATURE_FILE, encoding="utf-8")).items() if not k.startswith("_")}
    out = {}
    for key in pokemon:
        base = lookup(raw, key)
        out[key] = (as_list(base) if base else []) + list(lookup(data, key, "moves") or [])
    return out


def primary_type(types):
    if not types:
        return "normal"
    return types[1] if types[0] == "normal" and len(types) > 1 else types[0]


def moveset(sig, types, bst):
    # 대표 기술 + 타입 기술 (종족값 단계까지), 같은 이름은 한 번만
    tier = (bst >= 400) + (bst >= 500)
    pool = list(sig)
    for t in types:
        pool += [[name, fx, opt] for name, fx, opt, need in TYPE_MOVES.get(t, []) if tier >= need]
    seen = set()
    return [m for m in pool if not (m[0] in seen or seen.add(m[0]))]


def look_size(power):
    """위력 → 효과 크기 기본 (#122)"""
    if not power:
        return 1.0
    t = min(1, max(0, (power - LOOK_SIZE["low"]) / (LOOK_SIZE["high"] - LOOK_SIZE["low"])))
    return round(LOOK_SIZE["min"] + (LOOK_SIZE["max"] - LOOK_SIZE["min"]) * t, 2)


def bundle_table(src, name):
    """main-bundle.js 의 GAME-PATCH 표 (const 이름 = { 키: '값', … }) — 게임이 기술을 찾는 규칙 (gameMoveEntry) 과 같게"""
    m = re.search(r"const " + name + r" = \{([^}]*)\};", src)
    return dict(re.findall(r"(\w+): '([^']+)'", m.group(1))) if m else {}


def apply_move_look(lib):
    """#122 기술마다 모양 — dev/move-look.json 의 값을 이름이 같은 MOVE_LIB 기술에 덮어씀 (일반 모드 그 기술도 같이 바뀜).
    MOVE_LIB 에 없는 게임 기술은 새로 더함 — 게임은 이름으로 찾고 (gameMoveEntry), 없으면 타입 기본 기술 (GAME_TYPE_MOVE) 을 빌려 모두 같아 보였음.
    표에 없는 기술은 그대로 (빈 표 = 예전과 같은 묶음). size 를 안 적으면 위력으로 (look_size)"""
    if not os.path.exists(LOOK_FILE):
        return 0
    looks = {k: v for k, v in json.load(open(LOOK_FILE, encoding="utf-8")).items() if not k.startswith("_")}
    if not looks:
        return 0
    moves = json.load(open(GAME_MOVES_FILE, encoding="utf-8"))
    src = open(BUNDLE, encoding="utf-8").read()
    alias = bundle_table(src, "GAME_MOVE_ALIAS")
    type_move = bundle_table(src, "GAME_TYPE_MOVE")
    for mid, look in looks.items():
        mv = moves.get(mid)
        if not mv or not isinstance(look, dict):
            sys.exit(f"dev/move-look.json: 게임에 없는 기술 id {mid} (또는 값이 표가 아님)")
        look = dict(look)
        fx = look.pop("fx", None)
        lo, hi = LOOK_SIZE["clamp"]
        look["size"] = round(min(hi, max(lo, float(look["size"]))), 2) if "size" in look else look_size(mv.get("power"))
        name = alias.get(mv["name"]["ko"], mv["name"]["ko"])
        hits = [m for m in lib if m[0] == name]
        if not hits:
            base = next((m for m in lib if m[0] == type_move.get(mv["type"], "몸통박치기")), lib[0])
            hits = [[name, base[1], dict(base[2]) if len(base) > 2 else {}]]
            lib.append(hits[0])
        for m in hits:
            if fx:
                m[1] = fx
            if len(m) < 3:
                m.append({})
            m[2] = {**m[2], **look}
    return len(looks)


def write_bundle(table, acts, lib, movesets, shape, ult_lib, ults, out):
    src = open(BUNDLE, encoding="utf-8").read()
    # 지난번 블록 지우기 — 한 줄짜리(연결)부터, 그다음 여러 줄(코드)
    src = re.sub(" " + re.escape(BEGIN) + r" [^\n]*?" + re.escape(END), "", src)
    src = re.sub(re.escape(BEGIN) + r"\n.*?" + re.escape(END) + r"\n", "", src, flags=re.S)
    if src.count(CODE_ANCHOR) != 1 or src.count(HOOK_ANCHOR) != 1:
        sys.exit("main-bundle.js: 넣을 자리를 못 찾음")
    code = open(os.path.join(HERE, "moves.js"), encoding="utf-8").read()
    # 필살기 — 본체(core) → 연출 틀(fx-*) → 대결 본체(duel) → 대결 모양(duel-*) → 게임 모드 전투 다리 (bridge — window.pokemonFx)
    fx = sorted(f for f in os.listdir(ULT_DIR) if f.startswith("fx-") and f.endswith(".js"))
    duel = sorted(f for f in os.listdir(ULT_DIR) if f.startswith("duel-") and f.endswith(".js"))
    for name in ["core.js", *fx, "duel.js", *duel, "bridge.js"]:
        code += f"\n// ===== ult/{name} =====\n" + open(os.path.join(ULT_DIR, name), encoding="utf-8").read()
    moves = "const POKEMON_MOVES = " + json.dumps(table, separators=(",", ":")) + ";\n"
    moves += "const POKEMON_ACTS = " + json.dumps(acts, separators=(",", ":")) + ";\n"
    moves += "const MOVE_LIB = " + json.dumps(lib, ensure_ascii=False, separators=(",", ":")) + ";\n"
    moves += "const POKEMON_MOVESET = " + json.dumps(movesets, separators=(",", ":")) + ";\n"
    moves += "const POKEMON_SHAPE = " + json.dumps(shape, separators=(",", ":")) + ";\n"
    moves += "const ULT_LIB = " + json.dumps(ult_lib, ensure_ascii=False, separators=(",", ":")) + ";\n"
    moves += "const POKEMON_ULT = " + json.dumps(ults, separators=(",", ":")) + ";\n"
    # 필살기마다 본편 시작에서 처음 맞는 때 · 본편 길이 (dev/ult-fx.py 가 잼 — 3:3 합동 필살기가 같은 때 맞게, 열쇠 = "이름|틀")
    hit_path = os.path.join(ULT_DIR, "ult-hit.json")
    ult_hit = json.load(open(hit_path, encoding="utf-8")) if os.path.exists(hit_path) else {}
    moves += "const ULT_HIT = " + json.dumps(ult_hit, ensure_ascii=False, separators=(",", ":")) + ";\n"
    # 필살기가 맞는 포켓몬을 덮는 구간 (dev/ult-cover.py --data · --write-data — #107 대상을 연출 위에 다시 그림, 열쇠 = 틀 · 옵션)
    cover_path = os.path.join(ULT_DIR, "ult-cover.json")
    ult_cover = json.load(open(cover_path, encoding="utf-8")) if os.path.exists(cover_path) else {}
    moves += "const ULT_COVER = " + json.dumps(ult_cover, ensure_ascii=False, separators=(",", ":")) + ";\n"
    i = src.index(CODE_ANCHOR)
    src = src[:i] + BEGIN + "\n" + moves + code + END + "\n" + src[i:]
    i = src.index(HOOK_ANCHOR) + len(HOOK_ANCHOR)
    src = src[:i] + " " + BEGIN + HOOK + END + src[i:]
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "w", encoding="utf-8").write(src)


# 게임 엔진이 고르는 필살기 (3:3 대상 — 2026-10-21 기획 R7: 원작 범위기만 상대 모두, 그 밖 · 원작 기술이 아닌 필살기는 한 마리)
ULT_MOVES_OUT = os.path.join(HERE, "src", "game", "data", "generated", "ult-moves.json")
SPREAD_TARGETS = {"all-opponents", "all-other-pokemon"}


def ult_spread_names(names):
    """필살기 이름 중 원작 범위기 (PokeAPI 대상이 상대 모두 · 나 빼고 모두) — .cache/pokeapi (scripts/fetch-pokeapi.mjs 가 받음), 없으면 None"""
    root = os.path.join(HERE, ".cache", "pokeapi")
    dirs = sorted((os.path.join(root, d) for d in os.listdir(root)), key=os.path.getmtime) if os.path.isdir(root) else []
    dirs = [d for d in dirs if os.path.exists(os.path.join(d, "move_names.csv")) and os.path.exists(os.path.join(d, "moves.csv"))]
    if not dirs:
        return None
    d = dirs[-1]
    read = lambda f: list(csv.DictReader(io.open(os.path.join(d, f), encoding="utf-8")))
    target_name = {r["id"]: r["identifier"] for r in read("move_targets.csv")}
    target_of = {r["id"]: target_name.get(r["target_id"], "") for r in read("moves.csv")}
    spread_ids = {i for i, t in target_of.items() if t in SPREAD_TARGETS}
    ko = {}
    for r in read("move_names.csv"):
        if r["local_language_id"] == "3":
            ko.setdefault(r["name"].replace(" ", ""), r["move_id"])
    return sorted(n for n in names if ko.get(n.replace(" ", "")) in spread_ids)


def write_ult_moves(ult_lib, ults):
    forms = {key: [ult_lib[i][0] for i in ids] for key, ids in sorted(ults.items())}
    names = sorted({n for v in forms.values() for n in v})
    spread = ult_spread_names(names)
    if spread is None:
        # 캐시가 없으면 지난번 범위기 목록 그대로
        prev = json.load(open(ULT_MOVES_OUT, encoding="utf-8")) if os.path.exists(ULT_MOVES_OUT) else {}
        spread = [n for n in prev.get("spread", []) if n in names]
    data = {"forms": forms, "spread": spread}
    open(ULT_MOVES_OUT, "w", encoding="utf-8", newline=chr(10)).write(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + chr(10))
    print(f"엔진 필살기 표 — 모습 {len(forms)} · 이름 {len(names)} · 원작 범위기 {len(spread)} → {os.path.relpath(ULT_MOVES_OUT, HERE)}")


def main():
    out = BUNDLE
    if "--out" in sys.argv:
        out = os.path.abspath(sys.argv[sys.argv.index("--out") + 1])
    lenient = out != BUNDLE or "--lenient" in sys.argv
    data = load_data(lenient)
    types = pokemon_types()
    stats = pokemon_stats()
    table = {}
    acts = {}
    pokemon = pokemon_list()
    sig = signatures(pokemon, data)
    shape = {}
    lib = []
    lib_index = {}
    movesets = {}
    ult_lib = []
    ult_index = {}
    ults = {}
    for key, (dex, gen) in pokemon.items():
        move = next((MOVE_OF_TYPE[t] for t in types.get(dex, []) if t in MOVE_OF_TYPE), None)
        gif = os.path.join(EXT, "media", f"gen{gen}", key, "default_walk_8fps.gif")
        if not os.path.exists(gif):
            continue
        power = round(min(1, max(0, (stats.get(dex, 400) - 200) / 450)), 2)
        if move:
            table[key] = [move, power, *(body(gif) if move == "electric" else mouth(gif, key))]
        if walk_alpha(gif).getbbox() is None:
            continue  # 빈 그림
        # 클릭 기술 — 대표 기술 + 타입 기술 (모든 포켓몬)
        pool = moveset(sig[key], [] if key.removesuffix("_female") in ONLY_SIGNATURE else types.get(dex, []), stats.get(dex, 400))
        shape[key] = [power, *mouth(gif, key), *body(gif)]
        if pool:
            ids = []
            for m in pool:
                k = json.dumps(m, ensure_ascii=False, sort_keys=True)
                if k not in lib_index:
                    lib_index[k] = len(lib)
                    lib.append(m)
                ids.append(lib_index[k])
            movesets[key] = ids
        # 필살기 — moves-data → 타입 기본
        ult = lookup(data, key, "ult") or TYPE_ULTS[primary_type(types.get(dex, []))]
        ids = []
        for m in as_list(ult):
            m = [m[0], m[1], m[2] if len(m) > 2 else {}]
            k = json.dumps(m, ensure_ascii=False, sort_keys=True)
            if k not in ult_index:
                ult_index[k] = len(ult_lib)
                ult_lib.append(m)
            ids.append(ult_index[k])
        ults[key] = ids
        if dex in JUMPERS:
            acts[key] = "jump"
        elif "flying" in types.get(dex, []) and dex not in WINGLESS:
            acts[key] = "fly"
    looked = apply_move_look(lib)
    write_bundle(table, acts, lib, movesets, shape, ult_lib, ults, out)
    subprocess.run(["node", "--check", out], check=True)
    if looked:
        print(f"기술마다 모양 (dev/move-look.json) {looked}개 — 다음은 python dev/move-fx.py (3:3 박자)")
    write_ult_moves(ult_lib, ults)
    counts = {m: sum(1 for v in table.values() if v[0] == m) for m in MOVE_OF_TYPE.values()}
    print(f"기술 {len(table)}종 — " + " · ".join(f"{m} {n}" for m, n in counts.items()))
    sizes = [len(v) for v in movesets.values()]
    vortex = sum(1 for v in movesets.values() if any(lib[i][1] == "vortex" for i in v))
    print(f"기술 묶음 {len(movesets)}마리 · 평균 {sum(sizes) / len(sizes):.1f}개 · 기술 모음 {len(lib)}개 · 연출 틀 {len({m[1] for m in lib})}개 · 회오리 쓰는 애 {vortex}마리")
    print(f"행동 — 비행 {sum(1 for a in acts.values() if a == 'fly')} · 멀리뛰기 {sum(1 for a in acts.values() if a == 'jump')}")
    by_fx = {}
    for ids in ults.values():
        for i in ids:
            by_fx[ult_lib[i][1]] = by_fx.get(ult_lib[i][1], 0) + 1
    print(f"필살기 {len(ults)}마리 · 필살기 모음 {len(ult_lib)}개 — " + " · ".join(f"{k} {v}" for k, v in sorted(by_fx.items(), key=lambda kv: -kv[1])))
    if out != BUNDLE:
        print(f"→ {out}")


if __name__ == "__main__":
    main()
