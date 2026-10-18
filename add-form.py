#!/usr/bin/env python3
"""포켓몬의 다른 모습(메가진화 등)을 PMD SpriteCollab 그림으로 받아 GIF 로 만든다 — 필살기 연출에서 잠깐 바꿔 그릴 때 씀.

  python3 add-form.py 6 0001 charizard megax "Mega Charizard X" 메가리자몽X
  (도감 번호 · SpriteCollab 모습 폴더 · 포켓몬 키 · 모습 이름표 · 영어 이름 · 한글 이름)

- 그림: extension/media/gen<N>/<키>/<모습>_{idle,walk}_8fps.gif — add-pokemon.py 와 같은 방식 (발을 바닥에, 32 · 64 · 96 칸)
- 목록: pokemon-forms.json — scripts/make-notices.mjs 가 작가 고지(THIRD-PARTY-NOTICES.txt)에 넣음
- 모습 폴더 이름은 https://sprites.pmdcollab.org 에서 확인 (예: 리자몽 0001 = Mega_X)
- 그림: PMD SpriteCollab (CC BY-NC 4.0, 작가는 저장소 sprite/<번호>/<모습>/credits.txt) — 개인 비상업 용도
Pillow 필요 (pip3 install pillow).
"""
import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FORMS = os.path.join(HERE, "pokemon-forms.json")

# add-pokemon.py 의 받기 · 자르기 · GIF 만들기를 그대로 씀 (파일 이름에 - 가 있어 import 대신)
_spec = importlib.util.spec_from_file_location("add_pokemon", os.path.join(HERE, "add-pokemon.py"))
ap = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ap)


def main():
    if len(sys.argv) != 7:
        sys.exit(__doc__)
    dex, form, key, tag, name, ko = int(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], sys.argv[6]
    gen = ap.generation(dex)
    folder = f"{ap.BASE}/{dex:04d}/{form}"
    xml = ap.fetch(f"{folder}/AnimData.xml")
    if xml is None:
        sys.exit(f"#{dex:04d}/{form} 그림 없음")
    xml = xml.decode("utf-8")
    anims = {kind: ap.load_frames(folder, xml, kind) for kind in ap.ANIMS}
    canvas = next(size for size in (32, 64, 96) if all(ap.placement(fr, fw, size) for fr, _, fw in anims.values()))
    for kind, (frames, ms, fw) in anims.items():
        dx, dy = ap.placement(frames, fw, canvas)
        ap.save_gif(frames, ms, dx, dy, canvas, os.path.join(ap.EXT, "media", f"gen{gen}", key, f"{tag}_{kind}_8fps.gif"))
    forms = json.load(open(FORMS, encoding="utf-8")) if os.path.exists(FORMS) else {}
    forms[f"{key}_{tag}"] = {"id": dex, "form": form, "base": key, "tag": tag, "name": name, "ko": ko, "generation": gen, "size": canvas}
    with open(FORMS, "w", encoding="utf-8") as f:
        json.dump(forms, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"{ko}({key} {tag}) #{dex:04d}/{form} gen{gen} · {canvas}×{canvas} — 고지: node scripts/make-notices.mjs")


if __name__ == "__main__":
    main()
