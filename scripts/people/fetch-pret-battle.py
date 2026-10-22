"""트레이너 대결 그림 — 파이어레드 · 에메랄드 원작 (pret/pokefirered · pret/pokeemerald graphics/trainers/front_pics) 을 VS 컷인용으로 (2026-10-20 태현 님 "추천대로").
실행: python scripts/people/fetch-pret-battle.py
→ extension/media/people/<id>/battle.png (원작 64 × 64 그대로, 팔레트 0번 = 투명 — 에메랄드 파일엔 투명 표시가 없어서)
  src/game/data/generated/people-battle.json ({id: {source, top}} — top = 그림이 시작하는 줄: 낮은 패널에서 아래를 자를 때 머리부터 보이게)
id 는 사람 그림 목록 (fetch-pret.py · data/people.ts) 의 id 와 같음 — 고를 수 있는 주인공 8명 (라이벌도 이 중 하나) · 숲 트레이너 9명 · 해변 트레이너 9명 · 관장 둘.
원작 대결 그림은 왼쪽 (플레이어 쪽) 을 봄 — 화면이 주인공을 뒤집어 오른쪽을 보게 함.
"""
import io
import json
import os
import urllib.request

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..")
OUT = os.path.join(ROOT, "extension", "media", "people")
JSON_OUT = os.path.join(ROOT, "src", "game", "data", "generated", "people-battle.json")
RAW = {
    "frlg": "https://raw.githubusercontent.com/pret/pokefirered/master/graphics/trainers/front_pics",
    "em": "https://raw.githubusercontent.com/pret/pokeemerald/master/graphics/trainers/front_pics",
}
# (사람 그림 id, 게임, 원작 파일)
B = [
    # 주인공 (data/heroes.ts) — 라이벌도 이 중 하나
    ("frlg-red", "frlg", "red_front_pic"),
    ("frlg-blue", "frlg", "rival_early_front_pic"),
    ("em-brendan", "em", "brendan"),
    ("em-wally", "em", "wally"),
    ("frlg-leaf", "frlg", "leaf_front_pic"),
    ("em-may", "em", "may"),
    ("em-may-rs", "em", "may_rs"),
    ("em-leaf", "em", "leaf"),
    # 숲 트레이너 (core/rules/trainer.ts)
    ("frlg-youngster", "frlg", "youngster_front_pic"),
    ("frlg-bug-catcher", "frlg", "bug_catcher_front_pic"),
    ("frlg-lass", "frlg", "lass_front_pic"),
    ("frlg-picnicker", "frlg", "picnicker_front_pic"),
    ("em-twin", "em", "twins"),
    ("em-school-kid", "em", "school_kid_m"),
    ("frlg-hiker", "frlg", "hiker_front_pic"),
    ("frlg-cooltrainer-f", "frlg", "cool_trainer_f_front_pic"),
    ("em-pokefan-f", "em", "pokefan_f"),
    # 해변 트레이너 (core/rules/region.ts — orders #37 · 2번째 지역, VS 오른쪽이 비던 것 bugs 663)
    ("frlg-tuber-m", "frlg", "tuber_m_front_pic"),
    ("frlg-tuber-f", "frlg", "tuber_f_front_pic"),
    ("frlg-fisher", "frlg", "fisherman_front_pic"),
    ("frlg-swimmer-m", "frlg", "swimmer_m_front_pic"),
    ("frlg-swimmer-f", "frlg", "swimmer_f_front_pic"),
    ("frlg-sailor", "frlg", "sailor_front_pic"),
    ("em-triathlete-f", "em", "running_triathlete_f"),
    ("frlg-cooltrainer-m", "frlg", "cool_trainer_m_front_pic"),
    ("frlg-beauty", "frlg", "beauty_front_pic"),
    # 관장 (숲 나래 · 해변 해솔)
    ("frlg-erika", "frlg", "leader_erika_front_pic"),
    ("frlg-misty", "frlg", "leader_misty_front_pic"),
]

manifest = {}
for pid, game, src in B:
    url = f"{RAW[game]}/{src}.png"
    with urllib.request.urlopen(url, timeout=30) as r:
        data = r.read()
    raw = Image.open(io.BytesIO(data))
    if raw.mode == "P" and "transparency" not in raw.info:
        raw.info["transparency"] = 0
    img = raw.convert("RGBA")
    box = img.getbbox()
    top = box[1] if box else 0
    d = os.path.join(OUT, pid)
    os.makedirs(d, exist_ok=True)
    img.save(os.path.join(d, "battle.png"), optimize=True)
    manifest[pid] = {"source": f"pret/poke{'firered' if game == 'frlg' else 'emerald'} graphics/trainers/front_pics/{src}.png", "w": img.width, "h": img.height, "top": top}
    print(pid, img.size, "top", top)

with open(JSON_OUT, "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=1)
    f.write("\n")
print("ok", len(manifest), "명 →", JSON_OUT)
