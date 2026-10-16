# VS Code Pokemon (한국어판 · 내 PC 전용)

**VS Code 패널에서 포켓몬을 키워요.** 클릭하면 기술을 쓰고, 잡아서 던지면 쿵 넘어지고, 날개 달린 애들은 하늘을 날아다녀요.

<p align="center"><img src="docs/demo.gif" alt="포켓몬들이 기술을 쓰고 날아다니는 데모" width="800"></p>

> 마켓의 [vscode-pokemon](https://github.com/jakobhoeg/vscode-pokemon) 5.0.2 를 바탕으로 고친 수정본이에요.
> 확장 이름이 `local.vscode-pokemon` 이라 마켓 업데이트와 상관없이 그대로 유지돼요.

## ✨ 이런 걸 할 수 있어요

### 🕹️ 직접 놀기

| | 이렇게 하면 | 이렇게 돼요 |
|:-:|---|---|
| 🖱️ | 포켓몬을 **클릭** | 타입에 맞는 기술을 써요 |
| ✋ | 포켓몬을 **잡아서 끌기** | 잡혀 있는 동안 파닥파닥 바둥거려요 |
| 💫 | 높은 데서 **놓기** | 쿵 넘어져서 머리 위로 별이 빙글빙글 돌다가 비틀 일어나요 |
| ➕ | 패널 위 **+** | 포켓몬을 불러요 — 한글 이름으로 검색돼요 |
| ⚙️ | 패널 위 **⚙** | 기본 포켓몬 · 크기 · 배경 · 이름 언어를 한 번에 바꿔요 |

### ⚔️ 타입별 기술

| 타입 | 기술 | 이런 애들 |
|:-:|---|---|
| 🔥 불꽃 | 입에서 불꽃이 활활, 센 애는 불똥까지 | 파이리 · 리자몽 · 나인테일 · 블레이범 |
| 💧 물 | 물대포를 쭉 | 꼬부기 · 거북왕 · 갸라도스 · 라프라스 |
| ⚡ 전기 | 몸 둘레로 번개가 지직 | 피카츄 · 라이츄 · 전룡 |
| 🍃 풀 | 나뭇잎이 빙글빙글 | 이상해씨 · 이상해꽃 · 치코리타 |
| 🥷 전용기 | **물수리검** — 던지는 자세로 표창을 슝슝슝 | 개굴닌자 |

> 💪 **강할수록 화려해요.** 같은 불꽃이라도 파이리 → 리자드 → 리자몽 순으로 크고 길어지고, 전설 포켓몬이 제일 화려해요.

### 🌿 저절로 하는 행동

| | 이렇게 돼요 |
|:-:|---|
| 🪽 **비행** | 날개 달린 포켓몬(리자몽 · 피죤투 · 망나뇽 · 크로뱃 …)이 가끔 하늘 높이 날아다니다 내려와요 |
| 🐸 **멀리뛰기** | 개구리 · 토끼 · 닌자 · 격투가(개굴닌자 · 루카리오 · 이어롭 · 피그점프 …)가 가끔 폴짝 뛰어요 |
| ✨ **혼자 기술** | 20초에 한 번쯤 누군가 혼자 기술을 써요 |

### 🇰🇷 편하게

- **완전 한국어** — 포켓몬 이름 · 메뉴 · 명령이 VS Code 언어와 상관없이 한국어로 나와요
- **6세대 추가** — 개구마르 · 개굴반장 · 개굴닌자를 부를 수 있어요
- **기본 포켓몬** — 정해 두면 새 작업 폴더나 다른 컴퓨터에서 패널이 비어 있을 때 자동으로 나와요
- **배경 자동 맞춤** — 숲 · 성 · 해변 배경이 패널 크기에 맞게 늘고 줄어요

### 🚀 부드럽고 가볍게

- 원본은 툭툭 끊기며 걸었는데, 이제 **매끄럽게** 걸어요 (다른 창이 바빠도 안 끊겨요)
- 포켓몬이 많아도 **VS Code 가 버벅이지 않게** 가볍게 만들었어요

## 📸 이렇게 나와요

> 실제 확장 코드로 찍은 화면입니다 (medium 크기, 배경 없이 — 배경은 아래 따로).

**🔥 불꽃 — 파이리 vs 리자몽** · 셀수록 불꽃이 크고 길게, 불똥까지 튐

![파이리와 리자몽이 불꽃을 뿜는 모습](docs/fire.png)

**⚡ 전기 — 피카츄 vs 라이츄** · 입이 아니라 몸 둘레에서, 셀수록 넓고 굵게 갈라짐

![피카츄와 라이츄 몸 둘레의 번개](docs/electric.png)

**💧 물 — 개굴닌자 물수리검 + 거북왕 물대포** · 개굴닌자는 던지는 자세로 표창 3개

![개굴닌자가 표창을 던지고 거북왕이 물대포를 쏘는 모습](docs/water.png)

**🪽 비행 · 멀리뛰기 — 리자몽 · 피죤투 · 루카리오** · 날개 있는 애들은 패널 2/3 높이로, 개굴닌자류는 포물선으로 폴짝

![리자몽과 피죤투가 날고 루카리오가 뛰어오른 모습](docs/fly-jump.png)

### 🏞️ 배경

`vscode-pokemon.theme` 으로 고릅니다. 패널 높이에 맞춰 자동으로 늘고 줄어들고, 땅이 항상 포켓몬 발 높이에 옵니다 (아래는 어두운 테마 · medium 크기 원래 크기).

**🌲 forest**

![숲 배경](docs/bg-forest.png)

**🏰 castle**

![성 배경](docs/bg-castle.png)

**🏖️ beach**

![해변 배경](docs/bg-beach.png)

## 📦 새 컴퓨터에 설치

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
**⚙ → 기본 포켓몬 → 지금 데리고 있는 포켓몬으로 저장** 해 두면 설정 동기화로 넘어가서, 새 컴퓨터에서 패널이 빈 채로 시작할 때 그 포켓몬들이 나옵니다.
`backup-pokemon-list.json` (원래 데리고 있던 18마리)을 쓰려면 명령 팔레트의 **포켓몬: 포켓몬 목록 가져오기** 에서 고르면 됩니다.

## 🛠️ 고치기

> 여기부터는 직접 고치거나 포켓몬을 더 넣고 싶은 사람을 위한 내용이에요.

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

## 📁 폴더 구조

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
| `LOCAL-PATCH` | `out/extension/extension.js`, `main-bundle.js` | ⚙ 설정 메뉴(`vscode-pokemon.settings-menu`), 빈 패널이 `fresh-session` 을 보내면 기본 포켓몬 소환 |
| `LOCAL-PATCH` | `out/extension/extension.js`, `out/common/localize.js` | 메뉴 문구를 `koT` 로 `l10n/bundle.l10n.ko.json` 에서 (VS Code 언어 무시), 이름 언어 자동 → 한국어 |
| — | `package.json` | publisher `local`, 이름 "VS Code Pokemon (내 PC)", 명령 · 패널 · 설정 이름 한국어, `pokemonLanguage` 기본 `ko` |
| — | `out/common/localize.js` | 확장 ID 를 `local.vscode-pokemon` 으로 |
| — | `l10n/pokemon/ko/` | 한글 이름 (PokeAPI) |

## 📜 출처 · 라이선스

- 원작 코드: [jakobhoeg/vscode-pokemon](https://github.com/jakobhoeg/vscode-pokemon) — CC0
- 포켓몬 그림 저작권: © The Pokémon Company / Nintendo / Game Freak — 개인 비상업 용도
- 6세대 그림: [PMD SpriteCollab](https://github.com/PMDCollab/SpriteCollab) — CC BY-NC 4.0 (작가는 저장소 `sprite/<번호>/credits.txt`)
- 타입 · 종족값 · 한글 이름: [PokeAPI](https://github.com/PokeAPI/pokeapi)
