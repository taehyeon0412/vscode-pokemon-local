# VS Code Pokemon (내 PC 전용)

마켓의 [vscode-pokemon](https://github.com/jakobhoeg/vscode-pokemon) 5.0.2 를 가져와 고친 **개인용 수정본**입니다.
확장 ID 가 `local.vscode-pokemon` 이라 마켓 업데이트와 상관없이 그대로 유지됩니다 (원작자 업데이트도 안 들어옴).

<p align="center"><img src="docs/demo.gif" alt="포켓몬들이 기술을 쓰고 날아다니는 데모" width="800"></p>

## 이렇게 나와요

> 숲 배경 · medium 크기에서 실제 확장 코드로 찍은 화면입니다.

**🔥 불꽃 — 파이리 vs 리자몽** · 셀수록 불꽃이 크고 길게, 불똥까지 튐

![파이리와 리자몽이 불꽃을 뿜는 모습](docs/fire.png)

**⚡ 전기 — 피카츄 vs 라이츄** · 입이 아니라 몸 둘레에서, 셀수록 넓고 굵게 갈라짐

![피카츄와 라이츄 몸 둘레의 번개](docs/electric.png)

**💧 물 — 개굴닌자 물수리검 + 거북왕 물대포** · 개굴닌자는 던지는 자세로 표창 3개

![개굴닌자가 표창을 던지고 거북왕이 물대포를 쏘는 모습](docs/water.png)

**🪽 비행 · 멀리뛰기 — 리자몽 · 피죤투 · 루카리오** · 날개 있는 애들은 패널 2/3 높이로, 개굴닌자류는 포물선으로 폴짝

![리자몽과 피죤투가 날고 루카리오가 뛰어오른 모습](docs/fly-jump.png)

## 원본과 달라진 점

| 기능 | 내용 |
|---|---|
| 배경 자동 맞춤 | 숲 · 성 · 해변 배경이 패널 높이에 맞게 늘고 줄어듦 (땅 높이는 항상 포켓몬 발에 맞춤) |
| 한글 이름 | 1~6세대 한글 이름 (VS Code 표시 언어가 한국어일 때) |
| 6세대 추가 | 개구마르 · 개굴반장 · 개굴닌자 (소환 메뉴의 Generation 6) |
| 타입별 기술 | 클릭하거나 가끔 저절로 — 불꽃(불꽃 · 불똥), 물(물대포), 전기(몸 둘레 스파크), 풀(나뭇잎) |
| 기술 세기 | 종족값이 높을수록 크고 길고 화려함 (파이리 < 리자드 < 리자몽, 피카츄 < 라이츄, 전설이 가장 화려) |
| 전용기 | 개굴닌자 물수리검 — 던지는 자세로 표창 3개 (기술 쓸 때 60%) |
| 비행 | 날개 있는 비행 타입은 가끔 패널 2/3 높이로 날아다니다 내려옴 (공중에서 클릭하면 기술 쓰고 계속 비행) |
| 멀리뛰기 | 개구리 · 토끼 · 닌자 · 격투가류(개굴닌자 · 루카리오 · 이어롭 · 피그점프 등)는 가끔 포물선으로 폴짝 |
| 부드러운 이동 | 위치 이동을 GPU 애니메이션으로 — 원본의 0.1초마다 툭툭 끊기던 움직임 해결, 다른 패널이 바빠도 안 끊김 |
| 가벼워짐 | 상태 저장을 포켓몬마다 0.1초 → 전체 1초에 한 번 (편집기 쪽 부담 1/4) |

## 새 컴퓨터에 설치

필요한 것: VS Code, Python 3

```bash
# 1. 마켓 버전이 깔려 있으면 지우기 (명령 · 패널 이름이 같아서 둘 다 있으면 충돌)
code --uninstall-extension jakobhoeg.vscode-pokemon

# 2. 받기 — 이 경로에 두면 Claude Code 전역 지침의 명령과 그대로 맞음
git clone https://github.com/taehyeon0412/vscode-pokemon-local.git ~/.claude/vscode-pokemon-local

# 3. 설치 (윈도우는 python install.py)
python3 ~/.claude/vscode-pokemon-local/install.py
```

4. VS Code 명령 팔레트(⌘⇧P)에서 **Developer: Reload Window**

`code` 명령을 못 찾으면 `install.py` 가 만든 `dist/local.vscode-pokemon-*.vsix` 를 VS Code 확장 탭 `…` → **Install from VSIX…** 로 설치해도 됩니다.

### 권장 설정 (settings.json)

```jsonc
"vscode-pokemon.pokemonSize": "nano",
"vscode-pokemon.theme": "forest",
// 설정 동기화가 켜져 있으면 — 다른 컴퓨터의 마켓 버전이 따라 들어와 충돌하지 않게
"settingsSync.ignoredExtensions": ["jakobhoeg.vscode-pokemon"],
```

### 포켓몬 목록 옮기기

포켓몬 목록과 위치는 VS Code 가 작업 폴더별로 저장해서 새 컴퓨터엔 없습니다.
`backup-pokemon-list.json` (원래 데리고 있던 18마리)을 쓰려면 포켓몬 패널 메뉴의 **Import pokemon list** 에서 고르면 됩니다.

## 사용법

- 소환: 포켓몬 패널 위 **+** → 세대 선택 → 포켓몬 (검색창에 한글 이름으로 찾아도 됨)
- 기술: 포켓몬 **클릭**. 기술이 있는 타입(불꽃 · 물 · 전기 · 풀)만 반응하고, 평균 20초마다 누군가 저절로도 씀
- 비행 · 멀리뛰기: 저절로 (비행 평균 25초, 점프 12초마다 해당하는 애 하나)

## 고치기

모든 수정은 이 폴더에서 하고 마지막에 `python3 install.py` → Reload Window.

### 기술 · 행동 조절 — `moves.js`

맨 위 값만 바꾸고 `python3 make-moves.py` → `python3 install.py`

| 값 | 기본 | 뜻 |
|---|---|---|
| `MOVE_AUTO_AVG_SEC` | 20 | 평균 몇 초마다 누군가 저절로 기술 |
| `ACT_AUTO_AVG_SEC` | fly 25, jump 12 | 평균 몇 초마다 비행 · 점프 |
| `FLY_HEIGHT` | 2/3 | 비행 높이 (패널 높이 대비) |
| `MOVE_SPECIAL` | 개굴닌자 물수리검 | 전용기 (확률 · 그림 · 표창 수 · 간격) |

멀리뛰기 대상(`JUMPERS`)과 날개 없는 비행 타입 제외 목록(`WINGLESS`)은 `make-moves.py` 맨 위에 도감 번호로 있습니다.

### 포켓몬 추가 — `add-pokemon.py`

원본에 없는 포켓몬을 [PMD SpriteCollab](https://github.com/PMDCollab/SpriteCollab) 그림으로 만들어 등록합니다 (걷기 · 서 있기, 색이 다른 개체 포함, 한글 이름, 기술 표까지).

```bash
pip3 install pillow          # 처음 한 번 (Node.js 도 필요)
python3 add-pokemon.py 658 greninja Greninja 개굴닌자   # 도감번호 키 영문이름 한글이름
python3 install.py
```

## 폴더 구조

```
extension/        확장 본체 (원본 + 수정) — install.py 가 이걸 묶어 설치
moves.js          기술 · 행동 코드 원본 — make-moves.py 가 extension/media/main-bundle.js 에 끼워 넣음
make-moves.py     타입 · 종족값 · 입 위치로 기술 표 + 행동 표 생성
add-pokemon.py    포켓몬 추가 (그림 생성 + 등록)
install.py        vsix 로 묶어 설치 (install.sh 는 예전 명령용)
pokemon.json      add-pokemon 으로 추가한 포켓몬 목록
pokemon-types.json / pokemon-stats.json   PokeAPI 타입 · 종족값 저장본 (다시 안 받음)
backup-pokemon-list.json                  옮기기 전 포켓몬 목록
docs/             README 그림 (데모 · 장면 캡처)
```

### 원본 코드에서 바꾼 곳

찾기 쉽게 모두 주석 표시가 붙어 있습니다.

| 표시 | 위치 | 내용 |
|---|---|---|
| `POKEMON-FIT-PATCH` | `media/main-bundle.js` | 배경 자동 맞춤 |
| `POKEMON-EXTRA-PATCH` | `main-bundle.js`, `out/common/pokemon-data.js` · `types.js` · `localize.js` | 추가 포켓몬 데이터 · 6세대 메뉴 · 한글 이름 세대 (add-pokemon.py 가 다시 씀) |
| `POKEMON-MOVES-PATCH` | `main-bundle.js` | 기술 · 행동 (make-moves.py 가 다시 씀) |
| `LOCAL-PATCH` | `main-bundle.js`, `media/pokemon.css` | 저장 1초에 한 번, GPU 이동(`glideSprite`) |
| — | `package.json` | publisher `local`, 이름 "VS Code Pokemon (내 PC)" |
| — | `out/common/localize.js` | 확장 ID 를 `local.vscode-pokemon` 으로 |
| — | `l10n/pokemon/ko/` | 한글 이름 (PokeAPI) |

## 출처 · 라이선스

- 원작 코드: [jakobhoeg/vscode-pokemon](https://github.com/jakobhoeg/vscode-pokemon) — CC0
- 포켓몬 그림 저작권: © The Pokémon Company / Nintendo / Game Freak — 개인 비상업 용도
- 6세대 그림: [PMD SpriteCollab](https://github.com/PMDCollab/SpriteCollab) — CC BY-NC 4.0 (작가는 저장소 `sprite/<번호>/credits.txt`)
- 타입 · 종족값 · 한글 이름: [PokeAPI](https://github.com/PokeAPI/pokeapi)
