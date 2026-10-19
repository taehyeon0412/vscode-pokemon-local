"""사람 그림 — 파이어레드 · 에메랄드 원작 필드 그림 (pret/pokefirered · pret/pokeemerald) 을 받아 게임용으로 (2026-10-19 태현 님: 원작 그림 씀 · 이름은 모두 한글).
실행: python scripts/people/fetch-pret.py [--keep <받은 그림 둘 폴더>]
→ extension/media/people/<id>/walk.png (옆모습 — 걷기 4장 2 → 7 → 2 → 8, 걷지 않는 사람은 1장) · front.png (정면 — 걷기 4장 0 → 3 → 0 → 4, 걷지 않는 사람은 1장)
  src/game/data/generated/people.json (id · 한글 이름 · 묶음 · 받은 곳 · 그림 크기)
원작 한 장 = 장면 9 ~ 10장 (16 × 32, 꼬마는 16 × 16, 폭주족 32 × 32): 0 정면 · 1 뒤 · 2 옆 (왼쪽을 봄) · 3 ~ 4 정면 걷기 · 5 ~ 6 뒤 걷기 · 7 ~ 8 옆 걷기.
관장 · 사천왕 등은 3장 (정면 · 뒤 · 옆) 뿐 — 원작에서도 걷지 않음.
옆모습은 좌우를 뒤집어 오른쪽을 보게 · 모든 장면을 같은 칸 (쓰는 장면들의 그림 범위를 합친 것, 발끝 맞춤) 으로 잘라 옆 · 정면 키가 같음.
팔레트 0번 = 배경 (에메랄드 파일엔 투명 표시가 없어 0번을 투명으로).
"""
import io
import json
import os
import sys
import urllib.request

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..")
OUT = os.path.join(ROOT, "extension", "media", "people")
JSON_OUT = os.path.join(ROOT, "src", "game", "data", "generated", "people.json")
RAW = {
    "frlg": "https://raw.githubusercontent.com/pret/pokefirered/master/graphics/object_events/pics/people",
    "em": "https://raw.githubusercontent.com/pret/pokeemerald/master/graphics/object_events/pics/people",
}
# (게임, 원작 파일, id, 한글 이름, 묶음)
P = [
    # 주인공 · 라이벌
    ("frlg", "red_normal", "frlg-red", "레드", "hero"),
    ("frlg", "green_normal", "frlg-leaf", "리프", "hero"),
    ("frlg", "blue", "frlg-blue", "그린", "hero"),
    ("em", "brendan/walking", "em-brendan", "휘웅", "hero"),
    ("em", "may/walking", "em-may", "지민", "hero"),
    ("em", "ruby_sapphire_brendan/walking", "em-brendan-rs", "휘웅 2", "hero"),
    ("em", "ruby_sapphire_may/walking", "em-may-rs", "봄이", "hero"),
    ("em", "red", "em-red", "레드 2", "hero"),
    ("em", "leaf", "em-leaf", "리즈", "hero"),
    ("em", "wally", "em-wally", "민진", "hero"),
    # 관장
    ("frlg", "brock", "frlg-brock", "웅", "leader"),
    ("frlg", "misty", "frlg-misty", "이슬", "leader"),
    ("frlg", "lt_surge", "frlg-lt-surge", "마티스", "leader"),
    ("frlg", "erika", "frlg-erika", "민화", "leader"),
    ("frlg", "koga", "frlg-koga", "독수", "leader"),
    ("frlg", "sabrina", "frlg-sabrina", "초련", "leader"),
    ("frlg", "blaine", "frlg-blaine", "강연", "leader"),
    ("frlg", "giovanni", "frlg-giovanni", "비주기", "leader"),
    ("em", "gym_leaders/roxanne", "em-roxanne", "원규", "leader"),
    ("em", "gym_leaders/brawly", "em-brawly", "철구", "leader"),
    ("em", "gym_leaders/wattson", "em-wattson", "암페어", "leader"),
    ("em", "gym_leaders/flannery", "em-flannery", "민지", "leader"),
    ("em", "gym_leaders/norman", "em-norman", "종길", "leader"),
    ("em", "gym_leaders/winona", "em-winona", "은송", "leader"),
    ("em", "gym_leaders/tate", "em-tate", "풍", "leader"),
    ("em", "gym_leaders/liza", "em-liza", "란", "leader"),
    ("em", "gym_leaders/juan", "em-juan", "아단", "leader"),
    ("em", "wallace", "em-wallace", "윤진", "leader"),
    # 사천왕 · 챔피언 · 배틀프런티어
    ("frlg", "lorelei", "frlg-lorelei", "칸나", "elite"),
    ("frlg", "bruno", "frlg-bruno", "시바", "elite"),
    ("frlg", "agatha", "frlg-agatha", "국화", "elite"),
    ("frlg", "lance", "frlg-lance", "목호", "elite"),
    ("em", "elite_four/sidney", "em-sidney", "혁진", "elite"),
    ("em", "elite_four/phoebe", "em-phoebe", "회연", "elite"),
    ("em", "elite_four/glacia", "em-glacia", "미혜", "elite"),
    ("em", "elite_four/drake", "em-drake", "권수", "elite"),
    ("em", "steven", "em-steven", "성호", "elite"),
    ("em", "frontier_brains/anabel", "em-anabel", "아나벨", "elite"),
    ("em", "frontier_brains/brandon", "em-brandon", "브랜든", "elite"),
    ("em", "frontier_brains/greta", "em-greta", "그레타", "elite"),
    ("em", "frontier_brains/lucy", "em-lucy", "루시", "elite"),
    ("em", "frontier_brains/noland", "em-noland", "놀랜드", "elite"),
    ("em", "frontier_brains/spenser", "em-spenser", "스펜서", "elite"),
    ("em", "frontier_brains/tucker", "em-tucker", "터커", "elite"),
    # 악당단
    ("frlg", "rocket_m", "frlg-rocket-m", "로켓단 단원 ♂", "villain"),
    ("frlg", "rocket_f", "frlg-rocket-f", "로켓단 단원 ♀", "villain"),
    ("em", "team_aqua/aqua_member_m", "em-aqua-m", "아쿠아단 단원 ♂", "villain"),
    ("em", "team_aqua/aqua_member_f", "em-aqua-f", "아쿠아단 단원 ♀", "villain"),
    ("em", "team_aqua/archie", "em-archie", "아강", "villain"),
    ("em", "team_magma/magma_member_m", "em-magma-m", "마그마단 단원 ♂", "villain"),
    ("em", "team_magma/magma_member_f", "em-magma-f", "마그마단 단원 ♀", "villain"),
    ("em", "team_magma/maxie", "em-maxie", "마적", "villain"),
    # 트레이너 칭호
    ("frlg", "bug_catcher", "frlg-bug-catcher", "곤충채집 소년", "trainer"),
    ("em", "bug_catcher", "em-bug-catcher", "곤충채집 소년 2", "trainer"),
    ("frlg", "camper", "frlg-camper", "캠프보이", "trainer"),
    ("em", "camper", "em-camper", "캠프보이 2", "trainer"),
    ("frlg", "picnicker", "frlg-picnicker", "피크닉 소녀", "trainer"),
    ("em", "picnicker", "em-picnicker", "피크닉 소녀 2", "trainer"),
    ("frlg", "lass", "frlg-lass", "짧은치마", "trainer"),
    ("em", "lass", "em-lass", "짧은치마 2", "trainer"),
    ("frlg", "youngster", "frlg-youngster", "반바지 꼬마", "trainer"),
    ("em", "youngster", "em-youngster", "반바지 꼬마 2", "trainer"),
    ("frlg", "hiker", "frlg-hiker", "등산가", "trainer"),
    ("em", "hiker", "em-hiker", "등산가 2", "trainer"),
    ("frlg", "beauty", "frlg-beauty", "아가씨", "trainer"),
    ("em", "beauty", "em-beauty", "아가씨 2", "trainer"),
    ("frlg", "black_belt", "frlg-black-belt", "태권왕", "trainer"),
    ("em", "black_belt", "em-black-belt", "태권왕 2", "trainer"),
    ("frlg", "biker", "frlg-biker", "폭주족", "trainer"),
    ("frlg", "channeler", "frlg-channeler", "기도사", "trainer"),
    ("frlg", "cooltrainer_m", "frlg-cooltrainer-m", "엘리트 트레이너 ♂", "trainer"),
    ("frlg", "cooltrainer_f", "frlg-cooltrainer-f", "엘리트 트레이너 ♀", "trainer"),
    ("frlg", "crush_girl", "frlg-crush-girl", "배틀걸", "trainer"),
    ("frlg", "fisher", "frlg-fisher", "낚시꾼", "trainer"),
    ("em", "fisherman", "em-fisherman", "낚시꾼 2", "trainer"),
    ("frlg", "gentleman", "frlg-gentleman", "신사", "trainer"),
    ("em", "gentleman", "em-gentleman", "신사 2", "trainer"),
    ("frlg", "rocker", "frlg-rocker", "로커", "trainer"),
    ("frlg", "sailor", "frlg-sailor", "뱃사람", "trainer"),
    ("em", "sailor", "em-sailor", "뱃사람 2", "trainer"),
    ("frlg", "scientist", "frlg-scientist", "과학자", "trainer"),
    ("em", "scientist_1", "em-scientist", "과학자 2", "trainer"),
    ("frlg", "poke_maniac", "frlg-poke-maniac", "포켓몬 마니아", "trainer"),
    ("em", "maniac", "em-maniac", "마니아", "trainer"),
    ("frlg", "rich_boy", "frlg-rich-boy", "도련님", "trainer"),
    ("em", "rich_boy", "em-rich-boy", "도련님 2", "trainer"),
    ("frlg", "swimmer_m_land", "frlg-swimmer-m", "수영팬티 소년", "trainer"),
    ("frlg", "swimmer_f_land", "frlg-swimmer-f", "비키니 아가씨", "trainer"),
    ("frlg", "tuber_m_land", "frlg-tuber-m", "튜브 꼬마 ♂", "trainer"),
    ("frlg", "tuber_f", "frlg-tuber-f", "튜브 꼬마 ♀", "trainer"),
    ("em", "tuber_m", "em-tuber-m", "튜브 꼬마 ♂ 2", "trainer"),
    ("em", "tuber_f", "em-tuber-f", "튜브 꼬마 ♀ 2", "trainer"),
    ("em", "expert_m", "em-expert-m", "고수 ♂", "trainer"),
    ("em", "expert_f", "em-expert-f", "고수 ♀", "trainer"),
    ("em", "hex_maniac", "em-hex-maniac", "오컬트 마니아", "trainer"),
    ("em", "ninja_boy", "em-ninja-boy", "닌자 소년", "trainer"),
    ("em", "psychic_m", "em-psychic-m", "초능력자", "trainer"),
    ("em", "school_kid_m", "em-school-kid", "학원생", "trainer"),
    ("em", "twin", "em-twin", "쌍둥이", "trainer"),
    ("em", "pokefan_m", "em-pokefan-m", "포켓몬 애호가 ♂", "trainer"),
    ("em", "pokefan_f", "em-pokefan-f", "포켓몬 애호가 ♀", "trainer"),
    ("em", "running_triathlete_m", "em-triathlete-m", "트라이애슬론 ♂", "trainer"),
    ("em", "running_triathlete_f", "em-triathlete-f", "트라이애슬론 ♀", "trainer"),
    ("em", "artist", "em-artist", "화가", "trainer"),
    ("em", "reporter_m", "em-reporter-m", "기자 ♂", "trainer"),
    ("em", "reporter_f", "em-reporter-f", "기자 ♀", "trainer"),
    # 그 밖 사람들
    ("frlg", "prof_oak", "frlg-prof-oak", "오박사", "people"),
    ("em", "prof_birch", "em-prof-birch", "털보박사", "people"),
    ("frlg", "bill", "frlg-bill", "이수재", "people"),
    ("frlg", "mr_fuji", "frlg-mr-fuji", "후지 노인", "people"),
    ("frlg", "nurse", "frlg-nurse", "간호순", "people"),
    ("frlg", "clerk", "frlg-clerk", "점원", "people"),
    ("frlg", "mom", "frlg-mom", "엄마", "people"),
    ("frlg", "daisy", "frlg-daisy", "그린의 누나", "people"),
    ("frlg", "captain", "frlg-captain", "선장", "people"),
    ("frlg", "policeman", "frlg-policeman", "경찰관", "people"),
    ("frlg", "chef", "frlg-chef", "요리사", "people"),
    ("em", "cook", "em-cook", "요리사 2", "people"),
    ("em", "scott", "em-scott", "스캇", "people"),
    ("frlg", "balding_man", "frlg-balding-man", "대머리 아저씨", "people"),
    ("frlg", "fat_man", "frlg-fat-man", "뚱보 아저씨", "people"),
    ("frlg", "boy", "frlg-boy", "소년", "people"),
    ("frlg", "little_boy", "frlg-little-boy", "꼬마", "people"),
    ("frlg", "little_girl", "frlg-little-girl", "여자아이", "people"),
    ("frlg", "man", "frlg-man", "아저씨", "people"),
    ("frlg", "old_man_1", "frlg-old-man-1", "할아버지", "people"),
    ("frlg", "old_man_2", "frlg-old-man-2", "할아버지 2", "people"),
    ("frlg", "old_woman", "frlg-old-woman", "할머니", "people"),
    ("frlg", "woman_1", "frlg-woman-1", "아주머니", "people"),
    ("frlg", "woman_2", "frlg-woman-2", "아주머니 2", "people"),
    ("frlg", "woman_3", "frlg-woman-3", "아주머니 3", "people"),
    ("frlg", "worker_m", "frlg-worker-m", "작업원 ♂", "people"),
    ("frlg", "worker_f", "frlg-worker-f", "작업원 ♀", "people"),
    ("em", "boy_1", "em-boy-1", "소년 2", "people"),
    ("em", "boy_2", "em-boy-2", "소년 3", "people"),
    ("em", "boy_3", "em-boy-3", "소년 4", "people"),
    ("em", "girl_1", "em-girl-1", "소녀", "people"),
    ("em", "girl_2", "em-girl-2", "소녀 2", "people"),
    ("em", "girl_3", "em-girl-3", "소녀 3", "people"),
    ("em", "little_boy", "em-little-boy", "꼬마 2", "people"),
    ("em", "little_girl", "em-little-girl", "여자아이 2", "people"),
    ("em", "man_1", "em-man-1", "아저씨 2", "people"),
    ("em", "man_2", "em-man-2", "아저씨 3", "people"),
    ("em", "man_3", "em-man-3", "아저씨 4", "people"),
    ("em", "man_4", "em-man-4", "아저씨 5", "people"),
    ("em", "man_5", "em-man-5", "아저씨 6", "people"),
    ("em", "old_man", "em-old-man", "할아버지 3", "people"),
    ("em", "old_woman", "em-old-woman", "할머니 2", "people"),
    ("em", "woman_1", "em-woman-1", "아주머니 4", "people"),
    ("em", "woman_2", "em-woman-2", "아주머니 5", "people"),
    ("em", "woman_3", "em-woman-3", "아주머니 6", "people"),
    ("em", "woman_4", "em-woman-4", "아주머니 7", "people"),
    ("em", "woman_5", "em-woman-5", "아주머니 8", "people"),
]

keep = sys.argv[sys.argv.index("--keep") + 1] if "--keep" in sys.argv else None
manifest = []
for game, src, pid, name, group in P:
    url = f"{RAW[game]}/{src}.png"
    with urllib.request.urlopen(url, timeout=30) as r:
        data = r.read()
    if keep:
        d = os.path.join(keep, game)
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, src.replace("/", "-") + ".png"), "wb") as f:
            f.write(data)
    raw = Image.open(io.BytesIO(data))
    if raw.mode == "P" and "transparency" not in raw.info:
        raw.info["transparency"] = 0
    sheet = raw.convert("RGBA")
    W, H = sheet.size
    fw = 32 if W == 320 else 16
    n = W // fw
    fr = [sheet.crop((i * fw, 0, i * fw + fw, H)) for i in range(n)]
    walking = n >= 9
    side_idx = [2, 7, 2, 8] if walking else [min(2, n - 1)]
    front_idx = [0, 3, 0, 4] if walking else [0]
    used = [fr[i] for i in side_idx + front_idx]
    boxes = [f.getbbox() for f in used if f.getbbox()]
    l, t = min(b[0] for b in boxes), min(b[1] for b in boxes)
    rr, bb = max(b[2] for b in boxes), max(b[3] for b in boxes)
    w, h = rr - l, bb - t
    # 옆모습은 뒤집으니 자르는 칸도 뒤집은 쪽 기준 (가로 범위를 좌우 대칭으로 넓힘 — 정면 · 옆 칸 폭이 같게)
    l2, r2 = min(l, fw - rr), max(rr, fw - l)
    w = r2 - l2
    # 장면마다 발끝을 맨 아래 줄에 — 에메랄드는 서 있는 장면 (0 · 2) 아래가 1줄 비어 있어 서 있으면 1칸 뜸 (2026-10-19 테스터)
    def grounded(img):
        box = img.getbbox()
        gap = img.height - box[3] if box else 0
        if gap <= 0:
            return img
        out_img = Image.new("RGBA", img.size, (0, 0, 0, 0))
        out_img.alpha_composite(img.crop((0, 0, img.width, img.height - gap)), (0, gap))
        return out_img

    sides = [grounded(fr[i].transpose(Image.FLIP_LEFT_RIGHT).crop((l2, t, r2, bb))) for i in side_idx]
    fronts = [grounded(fr[i].crop((l2, t, r2, bb))) for i in front_idx]
    top2 = min(f.getbbox()[1] for f in sides + fronts if f.getbbox())  # 내린 뒤 위쪽 빈 줄은 잘라냄
    h = h - top2
    side = Image.new("RGBA", (w * len(side_idx), h), (0, 0, 0, 0))
    for k, f in enumerate(sides):
        side.alpha_composite(f.crop((0, top2, w, top2 + h)), (k * w, 0))
    front = Image.new("RGBA", (w * len(front_idx), h), (0, 0, 0, 0))
    for k, f in enumerate(fronts):
        front.alpha_composite(f.crop((0, top2, w, top2 + h)), (k * w, 0))
    d = os.path.join(OUT, pid)
    os.makedirs(d, exist_ok=True)
    side.save(os.path.join(d, "walk.png"), optimize=True)
    front.save(os.path.join(d, "front.png"), optimize=True)
    manifest.append({
        "id": pid, "name": name, "group": group, "source": f"pret/poke{'firered' if game == 'frlg' else 'emerald'} {src}",
        "walk": {"frames": len(side_idx), "w": w, "h": h}, "front": {"frames": len(front_idx), "w": w, "h": h},
    })
    print(pid, name, "걷기" if walking else "서 있기만", w, "x", h)

with open(JSON_OUT, "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=1)
    f.write("\n")
print("ok", len(manifest), "명 →", JSON_OUT)
