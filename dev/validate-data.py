#!/usr/bin/env python3
"""moves-data/*.json 검사 — 틀 이름 · 옵션 · 빠진 포켓몬

  python dev/validate-data.py                 (모두)
  python dev/validate-data.py moves-data/gen2.json
"""
import io
import json
import os
import subprocess
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")  # 윈도우 콘솔(cp949)에서도
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXT = os.path.join(HERE, "extension")
PALETTE = set("fire dragon poison sludge gas smoke water ice grass solar psychic hypno electric ghost normal wind rock ground steel silk fairy petal sleep paralyze spore silver moon heal hyper fight blood tongue bone gold egg star aura bug dark".split())
SHAPES = set("needle star ball rock leaf coin egg bone heart".split())
SIG = {
    "breath": "c speed spread rise life grow rate dur smoke ember snow",
    "water": "surf",
    "bubbles": "c many",
    "beam": "c width wave rainbow sparkle len",
    "solarbeam": "",
    "projectile": "shape c n every speed arc big boomerang tri",
    "powder": "c petal around drift",
    "rings": "c n spiral forward",
    "vortex": "c height",
    "spark": "", "glow": "c", "shield": "c", "bolt": "", "quake": "c",
    "rockfall": "c n", "dash": "c fast roll", "slash": "c n x", "punch": "c n big",
    "zzz": "big", "notes": "c", "megavolt": "", "thunder": "", "shuriken": "", "splash": "", "metronome": "",
}
ULT = {
    "ultbeam": "c width rainbow wave spiral solar sparkle double charge venus turtle",
    "ultorb": "c size style sky lucario turtle",
    "ultnova": "c white",
    "ultblackhole": "c",
    "ultsparkle": "mode c",
    "ultquake": "c lava",
    "ultpillar": "kind c n blast venus",
    "ultbloom": "mode c",
    "ultvortex": "c n",
    "ultstorm": "kind c",
    "ultskyfall": "shape n c",
    "ultthunder": "mode c",
    "ultvolt": "c rainbow max",
    "ultswarm": "shape c n giant ninja clones",
    "ultrush": "c drill flame elec water fast",
    "ultdive": "c heavy elec flame flare",
    "ultbarrage": "kind c spin aura",
    "ultpsy": "c",
    "ultshadow": "c",
    "ultsplash": "", "ultcopy": "", "ultmetronome": "",
}
COMMON_ULT = {"tint", "tc"}
ENUMS = {
    ("ultorb", "style"): {"energy", "flame", "shadow", "aura", "water", "ice", "leaf"},
    ("ultsparkle", "mode"): {"twinkle", "moon"},
    ("ultpillar", "kind"): {"fire", "rock", "ice", "water", "light", "vine", "shadow"},
    ("ultbloom", "mode"): {"bloom", "vine"},
    ("ultstorm", "kind"): {"thunder", "blizzard", "wind", "acid", "petal", "leaf", "sand", "rain", "fire"},
    ("ultskyfall", "shape"): {"rock", "ice", "meteor", "star"},
    ("ultthunder", "mode"): {"spear", "pillar"},
    ("ultswarm", "shape"): SHAPES | {"shuriken"},
    ("ultbarrage", "kind"): {"punch", "slash", "kick"},
    ("projectile", "shape"): SHAPES,
}


def keys_by_gen():
    script = "const d=require(process.argv[1]);console.log(JSON.stringify(Object.fromEntries(Object.entries(d.POKEMON_DATA).map(([k,v])=>[k,v.generation]))))"
    out = subprocess.run(["node", "-e", script, os.path.join(EXT, "out", "common", "pokemon-data.js")], capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def check_move(where, m, table, common=frozenset()):
    errs = []
    if not isinstance(m, list) or len(m) < 2 or not isinstance(m[0], str) or not m[0]:
        return [f"{where}: [이름, 틀, 옵션] 모양이 아님 — {m!r}"]
    fx = m[1]
    if fx not in table:
        return [f"{where}: 없는 틀 '{fx}'"]
    o = m[2] if len(m) > 2 else {}
    if not isinstance(o, dict):
        return [f"{where}: 옵션이 객체가 아님"]
    allowed = set(table[fx].split()) | common
    for k, v in o.items():
        if k not in allowed:
            errs.append(f"{where}: '{fx}' 에 없는 옵션 '{k}'")
        if k in ("c", "sparkle", "tc") and isinstance(v, str) and v not in PALETTE:
            errs.append(f"{where}: 없는 색 '{v}'")
        if (fx, k) in ENUMS and v not in ENUMS[(fx, k)]:
            errs.append(f"{where}: '{fx}.{k}' 값 '{v}' 은 {sorted(ENUMS[(fx, k)])} 중 하나")
    return errs


def as_list(v):
    return v if v and isinstance(v[0], list) else [v]


def main():
    files = sys.argv[1:] or sorted(os.path.join(HERE, "moves-data", f) for f in os.listdir(os.path.join(HERE, "moves-data")) if f.endswith(".json"))
    gens = keys_by_gen()
    errs = []
    covered = set()
    for path in files:
        try:
            data = json.load(open(path, encoding="utf-8"))
        except Exception as e:  # noqa: BLE001
            errs.append(f"{path}: JSON 오류 — {e}")
            continue
        for key, entry in data.items():
            if key.startswith("_"):
                continue
            covered.add(key)
            if key not in gens and not any(k.startswith(key + "_") for k in gens):
                errs.append(f"{os.path.basename(path)}:{key}: 없는 포켓몬 키")
            if not isinstance(entry, dict) or not set(entry) <= {"moves", "ult"}:
                errs.append(f"{os.path.basename(path)}:{key}: {{moves, ult}} 만")
                continue
            for i, m in enumerate(entry.get("moves", [])):
                errs += check_move(f"{os.path.basename(path)}:{key}.moves[{i}]", m, SIG)
            if "ult" in entry:
                for i, m in enumerate(as_list(entry["ult"])):
                    errs += check_move(f"{os.path.basename(path)}:{key}.ult[{i}]", m, ULT, COMMON_ULT)
    # 빠진 포켓몬 (밑줄 앞 이름으로 덮인 것은 괜찮음) — 검사한 파일의 세대만
    group_gens = set()
    for path in files:
        name = os.path.basename(path)
        group_gens |= {1} if name == "gen1.json" else {2} if name == "gen2.json" else {3} if name == "gen3.json" else {4} if name == "gen4.json" else {5, 6} if name == "gen56.json" else set()

    def has(key):
        while True:
            if key in covered:
                return True
            if "_" not in key:
                return False
            key = key.rsplit("_", 1)[0]

    missing = [k for k, g in gens.items() if g in group_gens and not has(k)]
    for e in errs:
        print("✗", e)
    if missing:
        print(f"✗ 필살기 없는 포켓몬 {len(missing)}: " + " ".join(missing))
    print(f"검사: 파일 {len(files)} · 포켓몬 {len(covered)} · 오류 {len(errs)} · 빠짐 {len(missing)}")
    sys.exit(1 if errs or missing else 0)


if __name__ == "__main__":
    main()
