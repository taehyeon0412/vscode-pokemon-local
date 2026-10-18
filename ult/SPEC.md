# 필살기 (꾹 누르기) — 설계 · 약속

포켓몬을 **1초 넘게 꾹 누르면** 필살기. 1초 전에 떼면 지금처럼 일반 기술, 누른 채 4px 넘게 움직이면 지금처럼 잡기.

```
누르는 중 (0.25초~)   발밑에 빛이 모이고 몸이 부르르 — 1초 차면 번쩍
① 시작 0.9초          화면 어두워짐 + 그 포켓몬만 빛 · 컷인(큰 그림이 가로 띠로 휙) · 화면 가운데 큰 금색 글씨 "기술 이름!!"
② 연출 (틀마다 2~4.5초) ult/fx-*.js 의 연출 틀
③ 끝 0.5초            화면이 다시 밝아짐
```

연출 길이 상한은 **15초** (`core.js` 의 `ultClamp(…, 800, 15000)`, 2026-10-19 태현 님) — 고퀄리티로 새로 만드는 필살기(개굴닌자 · 리자몽 · 이상해꽃 · 거북왕 등 7 ~ 9초)처럼 어떤 포켓몬이든 길게 만들 수 있음.

**공통 기 모으기** (`fx-sky.js` 맨 끝 `runPowerUp`, 2026-10-19 태현 님: 모든 포켓몬 필살기를 리자몽 · 거북왕처럼): 전용 옵션(ninja clones lucario turtle mewtwo mew flare blast venus aura)이 없는 필살기는 모두 ② 앞에 **1.9초 기 모으기** — 쓰는 애 뒤로 그 색 오라(불꽃 모양 기운) · 빨려 드는 빛줄기와 빛가루 · 발밑 돌덩이가 떠올라 맴돎 · 두근할 때마다 고리와 흔들림 · 막판 오라 가장자리 번개 → 임팩트 프레임(하양 · 검정 한순간) · 충격파 두 겹 · 돌덩이가 사방으로 (하늘 틀은 머리 위로 빛기둥, 땅 틀은 땅에 빛나는 금). 틀 동안 몸에 그 색 테두리(기를 두름). `ms` 도 1.9초 길어짐. 기 모으기 없이 바로 쓰려면 `ULT_FX.<틀>.plain` (잉어킹 → 갸라도스 파괴광선).

**큰 마무리** (`ultFinale(kind, …)` · `ultFinaleAt(초, () => [kind, …])` — core.js, 그림은 fx-sky.js `ULT_FINALE`, 2026-10-19): 공통 틀이 절정에서 부름. `dome`(u, x, R, cols) 땅에서 그 색 빛의 반구가 서서히 부풀어 눈부시게 빛나다 사그라듦(블래스트번처럼 — 임팩트 프레임 · 충격파 · 빛 앞에서 검게 떠오르는 돌덩이 · 피어오르는 불티) / `pillar`(u, x, w, cols) 화면 꼭대기까지 일자로 넓은 기둥 · 퍼지는 구 · 뻗는 줄기 · 파편 / `bloom`(u, x, R, 꽃잎색) 거대한 꽃이 피었다 꽃잎 폭풍. 어디서: 구체 · 블랙홀 · 소용돌이 · 거대 바위 · 유성군 마지막 · 번개 창 · 1000만볼트 · 날리기 · 반짝 박치기 · 기둥 마지막 · 꽃밭(햇빛) · 돌진 벽 · 다이브 · 연타 마지막 한 방(루카리오 빼고) · 염력 · 그림자 → `dome`, 광선(처음 맞은 애 자리) → `dome`, 대폭발(몸 자리) → `dome`, 지진 · 달 · 날씨(절정) · 번개 기둥 마지막 → `pillar`, 덩굴 · 꽃잎 / 잎 폭풍 → `bloom`. 마무리가 다 보이게 틀 뒤에 시간을 더 줌 (`POWER_EXTRA`, 틀 안의 시간은 그대로).

### 필살기 대결

꾹 눌러 쓴 필살기는 `ULT_CLASH_CHANCE`(0.5) 확률로 **받아칠 상대**를 찾음 — 땅에 있고 한가하고 몸길이 2.5배 넘게 떨어진 애 중 가장 먼 애 (특수 필살기뿐인 메타몽 빼고). 있으면 연출 틀 대신 **서로의 고유 필살기가 맞부딪힘** (`ult/duel.js`):

```
① VS 1.5초        번쩍 · 어두워짐(둘만 밝음) · 위 띠에 쓰는 애 · 아래 띠에 받아친 애 · 가운데 VS 쾅 (core.js ultVsIntro)
② 모으기 0.7초     charge — 각자 필살기 모양으로 기 모으기
③ 나가기          각자 필살기 모양이 앞으로 (종류마다 빠르기 DUEL_SPEED) — 먼저 닿은 쪽은 가운데서 기다림
④ 밀고 밀리기 3.6초 둘의 앞머리가 만나는 곳(xm, ym)에서 0.9초마다 한쪽이 밀어붙임, 막판(climax)엔 격해짐 — 만나는 곳 빛 덩어리 · 번개 · 튀는 에너지는 엔진이
⑤ 결과            이긴 쪽 앞머리가 0.4초 만에 진 쪽 몸까지 → 그 필살기 모양으로 터짐(win) · 진 쪽 벌러덩 · "효과는 굉장했다!" / 무승부면 가운데 대폭발 · 둘 다 벌러덩
⑥ 여운 1.5초
```

필살기 틀 → 대결 모양 종류 (`DUEL_KIND`):

| 종류 | 필살기 틀 | 파일 |
|---|---|---|
| `beam` 광선 | ultbeam | duel-energy.js |
| `bolt` 번개 | ultvolt · ultthunder | duel-energy.js |
| `orb` 구체 | ultorb · ultblackhole · ultsparkle(moon) | duel-energy.js |
| `dome` 충격파 | ultnova | duel-energy.js |
| `ground` 땅에서 솟음 | ultquake · ultpillar · ultbloom | duel-earth.js |
| `tornado` 회오리 | ultvortex | duel-earth.js |
| `storm` 폭풍 벽 | ultstorm | duel-earth.js |
| `meteor` 낙하 | ultskyfall | duel-earth.js |
| `swarm` 날리기 | ultswarm · ultsparkle(twinkle) | duel-body.js |
| `rush` 몸으로 | ultrush · ultdive · ultbarrage | duel-body.js |
| `wave` 파동 | ultpsy · ultshadow | duel-body.js |

모양 만드는 법 — `ult/duel-*.js` 에서 `Object.assign(DUEL_FX, { beam: {...} })` (파일 전체를 IIFE 로):

```js
DUEL_FX.beam = {
    charge(D, X, k, dt) {},      // 모으기 (k 0→1) — 입자만. 없으면 엔진이 기본 모으기
    draw(ctx, px, D, X) {},      // 매 프레임 — X.x0 에서 X.front 까지 그 필살기 모양. 알파에 X.fade 곱하기. 맨 밑 층(z -1)이라 튀는 입자가 위에 보임
    tick(D, X, dt) {},           // 매 프레임 — 입자 뿌리기 (나가기부터, fade 가 남아 있는 동안)
    push(D, X, strong) {},       // 밀어붙이는 구간이 바뀔 때 (strong = 이쪽이 밀어붙임)
    win(D, X, L) {},             // 이긴 쪽 앞머리가 진 쪽(L) 몸에 닿은 순간 한 번 — 그 필살기 방식으로 L.body 에서 터짐
};
```

| `X` (한쪽) | 뜻 |
|---|---|
| `p` `name` `fx` `o` `kind` `cols` | 포켓몬 · 필살기 이름 · 틀 · 옵션 · 종류 · 색 팔레트 |
| `dir` `left` | 상대 쪽 (+1 오른쪽) |
| `x0` `y0` | 필살기가 나가기 시작하는 곳 (몸 앞) · 맞부딪히는 높이 |
| `front` | 지금 앞머리 x — **모양의 앞 끝이 정확히 여기** (상대 앞머리와 만나는 곳) |
| `fade` | 1 → 0 사라짐 (진 쪽 · 끝날 때) |
| `pushing` `pa` | +1 밀어붙이는 중 / -1 밀리는 중 / 0 · 밀어붙이는 세기 0~1 — 밀 땐 굵고 밝게, 밀릴 땐 움츠러들게 |
| `S` `s` `P` `w` `h` `body` `mouth` `ground` | 점 크기 · 그림 1픽셀 · 세기 0~1 · 그림 크기 · 몸 · 입 · 땅 높이 y |
| `st` | 모양마다 마음대로 쓰는 상태 |

| `D` (대결) | 뜻 |
|---|---|
| `t` `phase` | 대결 시작부터 초 · `charge` `go` `push` `through` `after` `draw` |
| `xm` `ym` | 만나는 곳 (빛 덩어리) |
| `lane` | 크기 기준 — 맞부딪히는 줄의 반 굵기 (패널 높이의 9%, 10~34px) |
| `climax` | 막판 0~1 |
| `A` `B` `winner` `loser` `draw` `W` `H` `ground` `S` `tm` `tO` | 양쪽 · 승패 · 패널 · 땅 · 밀기 시작 · 끝 |

도구 (duel.js): `duelPuppet(ctx, X, cx, bottom, { rot, scale, alpha })` 포켓몬을 캔버스에 그림(몸으로 부딪히는 필살기 — 진짜 그림은 `duelHide(X, true)`, 끝나면 엔진이 다시 보임) · `duelSplash(D, up)` · `duelBoom(D, x, y, cols, big)` + 위의 도구 전부.

지킬 것: 위 "지킬 것" 그대로 + **그 필살기다워야 함** (X.fx · X.o 로 — 예 ground 는 ultquake 면 갈라짐 · 바위 가시, ultpillar 면 o.kind 기둥, ultbloom 이면 덩굴 · 꽃) · 앞머리는 `ym` 높이에서 상대와 맞닿게 · 패널 바닥(`ground`) 아래로 그리지 않기 · 높이가 낮은(180~260px) 넓은 패널에서도 어색하지 않게.

점검: `python dev/smoke.py --fx duel --p charizard,pikachu,bulbasaur,squirtle --win 640x260` (종류 짝 22판) · 장면 `--shot clash --ua '["다이내믹풀플레임","ultorb",{"c":"fire","style":"flame"}]' --ub '["로케트박치기","ultrush",{"c":"water","water":1}]' --actor 0 --vs 3 --winner a --theme none --win 640x260 --at 2600,4400,6300,6800`.

## 파일

| 파일 | 내용 | 누가 |
|---|---|---|
| `ult/core.js` | 꾹 누르기 · 기 모으기 · 시작 연출 · 도구(아래 API) · 특수 틀(잉어킹 · 메타몽 · 손가락흔들기) | 본체 |
| `ult/fx-energy.js` | `ultbeam` `ultorb` `ultnova` `ultblackhole` `ultsparkle` | 연출 A |
| `ult/fx-earth.js` | `ultquake` `ultpillar` `ultbloom` `ultvortex` | 연출 B |
| `ult/fx-sky.js` | `ultstorm` `ultskyfall` `ultthunder` `ultvolt` `ultswarm` | 연출 C |
| `ult/fx-body.js` | `ultrush` `ultdive` `ultbarrage` `ultpsy` `ultshadow` | 연출 D |
| `moves-data/gen1.json` … `gen56.json` | 포켓몬별 클릭 기술 추가분 + 필살기 | 세대별 |

`make-moves.py` 가 `moves.js` → `ult/core.js` → `ult/fx-*.js` 순서로 이어 붙여 main-bundle.js 에 넣고, `signature-moves.json` + `moves-data/*.json` 으로 표를 만든다.

## 데이터 — `moves-data/<묶음>.json`

```jsonc
{
  "_설명": "…",
  "dragonite": {
    // 클릭 기술에 더할 것 (1세대는 signature-moves.json 대표 기술 + 이것 + 타입 기술, 2세대부터는 이것 + 타입 기술)
    "moves": [["파괴광선", "beam", {"c": "hyper", "width": 1.4, "sparkle": "hyper"}]],
    // 필살기 — [이름, 필살기 틀, 옵션]. 여러 개 [[…], […]] 면 번갈아 (주머니에서 하나씩 — 다 나올 때까지 같은 걸 안 뽑고, 연달아도 안 나옴)
    "ult": ["파괴광선", "ultbeam", {"c": "hyper", "width": 1.3}]
  },
  "unown": { "ult": ["잠재파워", "ultorb", {"c": "hypno"}] }   // unown_a … unown_z 모두 (밑줄 앞 이름으로 찾음)
}
```

- 키 찾는 순서: `rotom_heat` → `rotom` → 없으면 타입 기본 필살기 (아래 표). `_female` 도 같은 식.
- 필살기가 없으면 **타입 기본** — 첫 번째 타입, 단 노말+X 면 X (피죤투 → 비행).
- 클릭 기술은 이제 **모든 포켓몬**이 `moves` + 타입 기술(make-moves.py `TYPE_MOVES`, 종족값 단계)을 무작위로 씀. 2세대부터도 `moves` 가 비면 타입 기술만.
- 타입 기술과 이름이 같은 건 한 번만 들어감.

## 클릭 기술 틀 (`moves` 에 쓰는 것, moves.js 의 SIG_FX)

`[이름, 틀, 옵션]` — 색 `c` 는 SIG_PALETTE 이름: `fire dragon poison sludge gas smoke water ice grass solar psychic hypno electric ghost normal wind rock ground steel silk fairy petal sleep paralyze spore silver moon heal hyper fight blood tongue bone gold egg star aura bug dark`

| 틀 | 모양 | 옵션 |
|---|---|---|
| `breath` | 입에서 뿜기 (화염방사 · 용의숨결 · 독가스 · 눈보라) | `c` `speed` `spread` `rise` `life` `grow` `rate` `dur` `smoke` `ember` `snow` |
| `water` | 물대포 · 파도타기 | `surf` |
| `bubbles` | 거품 | `c` `many` |
| `beam` | 광선 (파괴광선 · 냉동빔 · 오로라빔 · 환상빔 · 하이드로펌프) — `len` 을 주면 짧은 채찍 · 혀 | `c` `width` `wave` `rainbow` `sparkle` `len` |
| `solarbeam` | 솔라빔 (1.2초 모으기 + 굵은 빛줄기) | — |
| `projectile` | 날리기 | `shape`(needle star ball rock leaf coin egg bone heart) `c` `n` `every` `speed` `arc` `big` `boomerang` `tri` |
| `powder` | 가루 · 꽃잎 | `c` `petal` `around` `drift` |
| `rings` | 퍼지는 고리 / 앞으로 물결 | `c` `n` `spiral` `forward` |
| `vortex` | 회오리 기둥 | `c` `height` |
| `spark` | 몸 둘레 스파크 | — |
| `glow` | 반짝이며 올라감 | `c` |
| `shield` | 보호막 | `c` |
| `bolt` | 하늘에서 번개 한 줄 | — |
| `quake` | 지진 | `c` |
| `rockfall` | 바위 떨어뜨리기 | `c` `n` |
| `dash` | 돌진 | `c` `fast` `roll` |
| `slash` | 할퀴기 자국 | `c` `n` `x` |
| `punch` | 주먹 · 부리 | `c` `n` `big` |
| `zzz` `notes` | Z · 음표 | `big` / `c` |
| `megavolt` `thunder` | 100만볼트 · 먹구름 번개 (화려) | — |
| `shuriken` | 물수리검 (개굴닌자 전용 — 던지는 그림이 있는 애만) | — |
| `splash` `metronome` | 튀어오르기 · 손가락흔들기 | — |

광선 힘겨루기는 `beam`(len 없는 것) · `solarbeam` 을 가진 애끼리 일어남.

## 필살기 틀 (`ult` 에 쓰는 것)

모든 필살기 공통 옵션: `tint` — 쓰는 동안 그 포켓몬 그림에 거는 CSS filter (예 `"hue-rotate(200deg) saturate(1.6)"` 메가리자몽X 파란 불꽃), `tc` — 큰 글씨 색 팔레트 (기본 금색).

### A — 에너지 (`ult/fx-energy.js`)
| 틀 | 모양 | 옵션 |
|---|---|---|
| `ultbeam` | 0.9초 모으기(빛이 빨려 듦 · 구슬 두근) → 화면 끝까지 **굵은 광선**(패널 높이의 1/5 이상), 화면 흔들림, 광선에 닿은 포켓몬 벌러덩. 입 앞 빛 구는 포켓몬 크기에 맞춰 작게(쓰는 애를 가리지 않게), 광선은 그 빛 구에서 가늘게 시작해 나아가며 굵어짐(나팔 모양 — 높이도 입에서 광선 높이로 부드럽게). 짧게 누르기 `beam` · 힘겨루기 빔도 입 앞 작은 빛 구(`muzzleGlow`)에서 시작 | `c` `width`(굵기 배수) `rainbow` `wave` `spiral`(나선 고리가 감김) `solar`(하늘 햇빛 기둥으로 모으기) `sparkle`(흩날리는 빛 팔레트) `double`(두 줄 — 거북왕 대포) `charge`(모으는 초) `turtle`(거북왕 하이드로캐논 — 어깨의 두 대포에 2초 물 기 모으기(물 소용돌이 고리 · 물웅덩이에서 빨려 오르는 물줄기) → 정적 0.4초(화면이 까매지고 대포만 빛남 · 집중선) → 임팩트 프레임(하양 · 검정 각 0.06초) → 굵은 물줄기 두 가닥이 꼬이며 화면 끝까지(발이 박히며 금 · 충격파 세 겹 · 압력 고리 · 물보라, 거북왕은 꼭두각시로 물줄기 앞에) · 왕관 물보라 · 물기둥 → 1초 뒤 출력 최대(두 가닥이 합쳐져 두 배 굵기) → 그치면 거대한 물 폭발 → 높은 해일 두 겹 · 비 · 물 불꽃놀이(`waterFireworks`), 약 8.6초. fx-sky.js 가 덮어씀) `venus`(이상해꽃 솔라빔 — 2초 동안 하늘의 햇빛 줄기 · 빛 줄기 · 빛가루가 소용돌이치며 등의 꽃으로 모이고 꽃잎이 둘레를 돎 → 번쩍 임팩트 → 꽃 앞에서 땅과 나란히 화면 끝까지 굵은 햇빛 광선(아래가 땅 위에 오는 높이 · 굵기는 이상해꽃 크기에 맞춤, 달리는 에너지 마디 · 나선으로 감는 꽃잎, 이상해꽃은 꼭두각시로 광선 앞에) · 가장 가까운 애 자리 빛 폭발 · 충격파 → 거대한 빛의 꽃이 피었다 꽃잎 폭풍, 약 7초. fx-sky.js 가 덮어씀) |
| `ultorb` | 머리 위에서 거대한 구체를 키워 던짐 → 닿은 곳 대폭발 | `c` `size` `style`(`energy` `flame` `shadow` `aura` `water` `ice` `leaf`) `sky`(하늘 높이 올라가 커지다 화면 전체 폭발 — 오리진즈슈퍼노바 · 화룡점정류) `mew`(뮤 오리진즈슈퍼노바 — 하늘로 날아올라 2초 우주의 기 모으기(분홍 은하 소용돌이 · 빨려 드는 별빛) → 머리 위 거대한 분홍 태양(빛살 · 별빛 고리, 화면이 분홍빛) → 땅으로 내던짐 → 분홍 초신성(blastDome 분홍 · 하늘로 솟는 빛기둥 · 별 반짝이) → 사이코필드(땅이 분홍빛으로 반짝) → 내려앉음, 약 8초. fx-sky.js 가 덮어씀) `mewtwo`(뮤츠 사이코브레이크 — 떠올라 한 손에 2초 보랏빛 염력 모으기(뒤로 보랏빛 오라 · 염력에 떠오른 돌덩이 14개 · 둘레에 튀는 보랏빛 번개 · 구에 지직거리는 전기 줄기 · 일그러짐 고리 · 화면이 보랏빛으로) → 눈이 번뜩 → 거대한 염력 구를 던짐(돌덩이도 함께) → 블랙홀처럼 검게 빨려 듦 → 보랏빛 빛의 반구(blastDome) · 보랏빛 번개 열 줄 · 충격파 세 겹 → 내려앉음, 약 8.6초. fx-sky.js 가 덮어씀) `turtle`(거북왕 메가런처 — 물 구 안에서 1.5초 기 모으기 → 진화 모션 → 메가거북왕(SpriteCollab 에 몸 그림이 없어 원래 그림을 1.3배로 키우고 등의 거대한 대포 · 팔 대포를 그려 올림 — `megaTurtle`) → 대포 포구에 1.6초 거대한 물 구(표면 물살 · 도는 물 고리, 그동안 팔 대포 연사로 작은 물기둥들) → 쾅 발사(큰 반동 · 나선 물살 · 물의파동 고리) → 물 구가 부풀어 터짐 · 왕관 물보라(`crownSplash`) · 물기둥 셋 · 높은 해일 두 겹 · 비 · 물 불꽃놀이 → 원래 모습으로, 약 8.5초. fx-sky.js 가 덮어씀) `lucario`(루카리오 진 파동탄 — 파동 감지로 다른 포켓몬이 파란 실루엣 → 두 손 앞에 파랑 · 검정 소용돌이로 모음 → 여러 갈래가 휘어져 반드시 명중 → 맞은 곳마다 파동 기둥이 이어져 한꺼번에 터짐, 약 6초. fx-sky.js 가 덮어씀) |
| `ultnova` | 몸에서 **화면 전체 대폭발** — 하얗게 번쩍 · 충격파 여러 겹 · 모두 벌러덩 | `c` `white` |
| `ultblackhole` | 앞에 검은 구멍이 열려 빛 · 입자 · 다른 포켓몬을 빨아들이다 폭발 | `c` |
| `ultsparkle` | `twinkle`: 화면 가득 하트 · 별 + 반짝이며 박치기 / `moon`: 하늘에 거대한 달이 떠서 빛이 쏟아짐 | `mode` `c` |

### B — 땅 · 자연 (`ult/fx-earth.js`)
| 틀 | 모양 | 옵션 |
|---|---|---|
| `ultquake` | 화면 전체 대지진 · 땅이 갈라지는 선 · 바위 기둥이 솟음 · 다른 포켓몬 튀어오름 | `c` `lava`(갈라진 틈에서 용암 — 단애의칼) |
| `ultpillar` | 앞으로 차례차례 땅에서 **거대 기둥**이 솟음 (분화 · 스톤에지 · 얼음 기둥 · 물기둥 · 빛기둥) | `kind`(`fire` `rock` `ice` `water` `light` `vine` `shadow`) `c` `n` `venus`(이상해꽃 하드플랜트 — 초록 기운 · 잎이 모이는 1.5초 기 모으기 → 진화 모션 → 메가이상해꽃(SpriteCollab 에 몸 그림이 없어 원래 그림을 1.35배로 키우고 등에 거대한 꽃을 그려 올림 — `megaVenus`) → 앞발로 쿵, 빛나는 금이 달려가고 거대한 덩굴 · 나무뿌리가 파도처럼 연달아 솟음 → 끝에서 거대한 꽃이 피어 꽃잎 폭풍 → 원래 모습으로, 약 8초. fx-sky.js 가 덮어씀) `blast`(리자몽 블래스트번 — 살짝 떠올라 동그란 불꽃 구에서 1.5초 기 모으기 → 진화 모션(하얀 실루엣이 리자몽 ↔ 메가리자몽X 로 점점 빠르게, 빛줄기) → 메가리자몽X(진짜 그림은 숨기고 같은 폴더의 megax_idle 그림 — add-form.py) 파란 불꽃 구에서 파란 기 모으기 → 하얗게 번쩍 → 베지터 자폭 같은 거대한 파란 빛의 반구 대폭발(`blastDome` · `domeLight` — 눈부신 하얀 심 · 도트를 섞은 얇은 테두리 · 빛 무리 · 옅은 빛줄기 · 빛 앞에서 검게 떠오르는 돌덩이, 끝엔 색이 한 단계씩 어두워지며 사라짐; 터지는 동안 리자몽은 안 보임) · 화면 끝까지 파란 땅 불길 → 메가리자몽X 로 다시 나타나 원래 모습으로, 약 8.5초. fx-sky.js 가 덮어씀) |
| `ultbloom` | `bloom`: 앞쪽 땅에 꽃밭이 확 피고 하늘에서 빛기둥 / `vine`: 땅에서 거대한 덩굴 여러 줄이 솟아 채찍질 | `mode` `c` |
| `ultvortex` | 화면 높이 **거대 소용돌이** (하이드로보텍스 · 거대 회오리불꽃 · 폭풍 · 모래지옥) — 다른 포켓몬이 휘말려 빙글 | `c` `n`(1·2 기둥) |

### C — 하늘 · 날씨 · 날리기 (`ult/fx-sky.js`)
| 틀 | 모양 | 옵션 |
|---|---|---|
| `ultstorm` | 화면 전체 날씨 폭격 | `kind`(`thunder` 먹구름+번개 다발 · `blizzard` · `wind` 폭풍 · `acid` 독비+독늪 · `petal` 꽃잎 폭풍 · `leaf` 잎 폭풍 · `sand` · `rain` · `fire` 불비) `c` |
| `ultskyfall` | 하늘에서 떨어짐 — `n` 1: 거대한 것 하나(월즈엔드폴 바위 · 레이징지오프리즈 얼음), 여럿: 용성군 | `shape`(`rock` `ice` `meteor` `star`) `n` `c` |
| `ultthunder` | `spear`: 하늘의 번개를 한 점에 모아 거대한 번개 창을 던짐(스파킹기가볼트) / `pillar`: 굵은 번개 기둥이 앞 땅에 연달아 | `mode` `c` |
| `ultvolt` | 1000만볼트 — 굵은 무지개 번개 7줄이 화면 끝까지 · 가지 · 충격파 (`rainbow: 0` 이면 `c` 색 — 100만볼트) | `c` `rainbow`(기본 1) `max`(극대 — 11줄 · 네 번 두근 · 마지막 거대 번개 기둥) |
| `ultswarm` | 화면 가득 날리기 (바늘미사일 · 잎폭풍 · 스피드스타 · 코인 · 하트) / `giant`: 거대한 것 하나(뼈다귀부메랑 · 알폭탄) / `ninja`: 개굴닌자 거대 물수리검 — 물 회오리가 감싸 펑(물빛 테두리) → 뛰어오르는 순간부터 작은 표창이 돌며 물빛 · 보랏빛 기운 소용돌이를 빨아들여 커짐 → 내리꽂듯 던짐(물빛 · 보랏빛 꼬리, 물방울 · 보랏빛 기운이 흩날림) → 화면 끝 조금 안쪽에 꽂혀 멈칫 → 물기둥 속에서 하얗게 달아오르다 물기둥째 대폭발 — 나선 물 돔(나선수리검처럼, `swirlDome`)이 동그란 반원으로 크게(패널 높이 안) 커지며 세로축으로 팽이처럼 돎: 층마다 가로 물결 줄기가 개굴닌자 쪽으로 쓩 흐르고 뒷면은 옅게 거꾸로, 속은 하얗게, 닿은 애는 휘말려 빙글 → 개굴닌자는 돔 앞에 착지해 서 있다가 돔이 물보라로 터지는 순간 허공의 베인 자국도 한꺼번에 터짐 (약 6초) / `clones`: 그림자분신 물수리검 — 분신 n마리가 보랏빛 연기로 펑 → 차례로 뛰어올라 한 점에 던짐(모일수록 표창이 커짐) → 진짜 · 분신 모두 X 자로 교차 돌진 → 멈칫 → 합쳐진 표창이 터지며 보랏빛 나선 돔(`swirlDome` 의 pal, 거대 물수리검보다 조금 작게)이 진짜 쪽으로 돎 · 분신들은 돔 둘레에서 빛남 → 돔이 터지는 순간 화면 가르는 X · 분신이 한꺼번에 연기로 펑 → 진짜는 연기로 순간이동해 제자리로 (약 5.5초). 둘 다 뛰는 동안 진짜 그림은 숨기고 캔버스 꼭두각시로 (같은 자리로 돌아옴) | `shape`(needle star ball rock leaf coin egg bone heart shuriken) `c` `n` `giant` `ninja` `clones`(분신 수 2~8, 좁은 패널은 3~4) |

### D — 몸 · 마음 (`ult/fx-body.js`)
| 틀 | 모양 | 옵션 |
|---|---|---|
| `ultrush` | 온몸에 오라 → 화면 끝까지 돌진 → 벽에 쾅, 지나가며 포켓몬 튕겨냄 | `c` `drill`(드릴 회전) `flame`(불꽃 두름) `elec`(번개 두름) `water` `fast` |
| `ultdive` | 화면 위로 솟아 사라짐 → 빛을 두르고 내리꽂힘 → 큰 충격파 · 주변 튕겨 오름 | `c` `heavy`(잠만보 프레스 — 화면 전체 쿵) `elec` `flame` `flare`(리자몽 플레어드라이브 — 날갯짓하듯 들썩이며 하늘 높이 솟아 동그란 불꽃 구에 감싸임(둘레로 불씨 원이 빙글) → 2초 동안 기를 모으듯 불꽃 줄기 · 불씨가 소용돌이치며 빨려 듦 → 점화 · 불꽃 유성이 하나씩 천천히 쏟아지기 시작(용성군처럼) · 불꽃 구째로 혜성 꼬리를 끌며 급강하 · 닿는 순간 대폭발(퍼지는 불꽃 구 · 뻗는 불꽃 줄기 · 불덩이 파편 · 차례로 터지는 작은 폭발 + 화면 꼭대기까지 일자로 넓은 불기둥) · 땅 불길이 번짐 · 불 속에서 솟아 제자리로, 약 7.5초. 불꽃은 파이어와 같은 그림 — 불꽃 혀(`flameTongue`) · 불꽃 구(`fireOrb`) · 불기둥(`firePillar`) · 눕힌 불꽃 혀 꼬리(`fireTail`) · 땅 불길 띠(`groundFlames`). fx-sky.js 가 덮어씀) |
| `ultbarrage` | 가장 가까운 포켓몬 쪽으로 달려가 연타 수십 발 → 마지막 한 방 | `kind`(`punch` `slash` `kick`) `c` `spin`(팽이처럼) `aura`(파동 인파이트 — 처음에 파동을 모으고 · 내내 파랑 · 검정 파동 불꽃 · 마지막에 동그란 파동 고리(도넛) 다섯 겹이 연달아 앞으로 날아가며 커짐, 약 5.5초) |
| `ultpsy` | 화면이 보랏빛으로 일렁이고 다른 포켓몬들이 공중에 떠올랐다 툭 떨어짐 | `c` `mew`(뮤 메트로놈 — 분홍 거품 방울에 싸여 손가락을 까딱 → 화면 곳곳을 통통 튀며 불꽃 · 물줄기 · 햇빛 광선 · 번개 · 고드름 비를 작게 연달아 → 가운데로 돌아와 거품이 펑, 분홍 대폭발 → 내려앉음, 약 8초. fx-sky.js 가 덮어씀) `mewtwo`(뮤츠 사이코키네시스 — 보랏빛 염력 구에서 1.5초 기 모으기 → 진화 모션 → 메가뮤츠Y(진짜 그림은 숨기고 같은 폴더의 megay 그림 — add-form.py) → 다른 포켓몬들(진짜 그림을 잠깐 숨기고 꼭두각시로)과 돌덩이가 보랏빛 오라에 감싸여 떠올라 메가뮤츠Y 손에서 이어진 보랏빛 번개 사슬에 끌려 두꺼운 염력 소용돌이 띠를 따라 돎(화면이 보랏빛으로) → 꼭대기에서 멈칫 · 눈이 번뜩 → 원래 자리에 한꺼번에 내리꽂힘 · 떨어진 자리마다 작은 보랏빛 폭발과 솟는 번개 · 메가뮤츠Y 둘레 거대한 염력 폭발 · 갈라진 땅 → 원래 모습으로, 약 9초. fx-sky.js 가 덮어씀) |
| `ultshadow` | 화면이 새까매지고 바닥에서 그림자 손이 솟아 다른 포켓몬을 붙잡아 흔듦 | `c` |

### 특수 (`ult/core.js`)
| 틀 | 모양 |
|---|---|
| `ultsplash` | 잉어킹 — 온 힘을 모아 화면 끝까지 튀어올라… "그러나 아무 일도 일어나지 않았다!" (가끔 갸라도스로 변해 파괴광선) |
| `ultcopy` | 메타몽 — 가장 가까운 포켓몬 모습으로 변해 그 애의 필살기 |
| `ultmetronome` | 손가락흔들기 — 다른 포켓몬 필살기 중 아무거나 |

### 전용 필살기 (`ult/fx-unique.js`, 데이터 옵션 `uniq`)
모든 틀 공통 옵션 `uniq: '<이름>'` — 그 이름의 전용 연출로 (틀 이름은 그대로라 대결 모양도 그대로, 기 모으기 공통층은 안 거침). 그리기 도구는 fx-sky.js 가 `ULT_KIT` 으로 내줌. `dev/validate-data.py` 가 이름 · 틀이 맞는지 봄.

| uniq | 틀 | 포켓몬 · 기술 | 모양 |
|---|---|---|---|
| `pikachu` | ultvolt | 피카츄 1000만볼트 | 먹구름 · 하늘 번개가 연달아 내리꽂히며 충전(몸에 지직 · 빨려 드는 빛줄기) → 뛰어올라 전기 구(둘레로 무지개 빛 일곱) → 임팩트 프레임 · 무지개 번개 일곱 줄기가 부채꼴로 땅에(닿은 애 벌러덩) → 하늘 번개 기둥이 구에 쾅 → 노란 빛의 반구 → 내려앉음, 약 7.6초 |
| `gengar` | ultorb | 팬텀 섀도볼 | 화면이 새까매지고 보랏빛 안개 → 하늘에 거대한 웃는 얼굴(빨간 눈 · 뾰족한 이빨) → 둥실 떠서 머리 위 섀도볼을 키움 → 작은 섀도볼 난사(다른 포켓몬 · 땅에 하나씩 펑) → 얼굴이 크게 웃음 → 거대한 섀도볼 → 보랏빛 빛의 반구, 약 6.8초 |
| `snorlax` | ultdive | 잠만보 기가임팩트 | 쿨쿨(Z) → 번쩍 "!" → 하얀 기운 · 떠오르는 돌덩이 · 우르릉 → 화면 위로 휙 → 과녁 그림자가 커짐 → 1.6배로 쿵! (화면 전체 흔들림 · 충격파 세 겹 · 화면 끝까지 땅 금 · 모두 튀어 오름 · 주황빛 반구) → 깡충 돌아와 다시 쿨쿨, 약 7.2초 |

### 타입 기본 필살기 (make-moves.py `TYPE_ULTS`)
| 타입 | 이름 | 틀 |
|---|---|---|
| normal | 울트라대시어택 | `ultrush` normal |
| fire | 다이내믹풀플레임 | `ultorb` style flame |
| water | 하이드로보텍스 | `ultvortex` water |
| grass | 블룸샤인엑스트라 | `ultbloom` bloom |
| electric | 스파킹기가볼트 | `ultthunder` spear |
| ice | 레이징지오프리즈 | `ultskyfall` ice 1 |
| fighting | 전력무쌍격렬권 | `ultbarrage` punch |
| poison | 애시드포이즌딜리트 | `ultstorm` acid |
| ground | 라이징랜드오버 | `ultquake` |
| flying | 파이널다이브클래시 | `ultdive` wind |
| psychic | 맥시멈사이브레이커 | `ultpsy` |
| bug | 절대포식회전참 | `ultbarrage` slash spin |
| rock | 월즈엔드폴 | `ultskyfall` rock 1 |
| ghost | 무한암야로의유인 | `ultshadow` |
| dragon | 얼티메이트드래곤번 | `ultdive` dragon |
| dark | 블랙홀이클립스 | `ultblackhole` |
| steel | 초월나선연격 | `ultrush` steel drill |
| fairy | 러블리스타임팩트 | `ultsparkle` twinkle |

## 연출 틀 만드는 법 (API)

```js
// ult/fx-*.js — 파일마다 Object.assign 으로 등록
Object.assign(ULT_FX, {
    ultbeam: {
        ms: (P, o) => 3200,                 // ② 연출 시간(ms) — 이 동안 포켓몬이 멈춰 있고 화면이 어두움. 2000~4500 권장
        run: (u, o, ms, pokemon) => { … },  // 그리기 시작 (u = 위치 · 크기, o = 옵션)
    },
});
```

`u` (쓰는 순간 위치 — `sigGeometry` 에 더한 것):

| 값 | 뜻 |
|---|---|
| `P` | 세기 0~1 (종족값) — 셀수록 크고 화려하게. 약한 애도 필살기다워야 하니 `0.4 + 0.6 * P` 처럼 바닥을 두기 |
| `s` / `S` | 그림 1픽셀 크기 / 필살기용 점 크기 `max(2, s)` — **nano 크기면 s = 1** 이라 큰 연출은 `S` 로 |
| `dir` `left` | 보는 쪽 (+1 오른쪽) |
| `W` `H` | 패널 크기 (px). VS Code 패널은 작고(예 300×250) 납작할 수도 있음 — 크기는 W · H 비율로, 최소값 두기 |
| `ground` | 발 높이 y (땅) |
| `w` `h` | 포켓몬 그림 크기 |
| `mouth` `body` | 입 `{x, y}` · 몸 `{cx, cy, rx, ry, top, bottom, front}` |
| `R` | 기준 반지름 `max(w, 40)` |
| `others()` | 맞을 수 있는 다른 포켓몬 `[{ pokemon, x, y, bottom }]` (x, y = 몸 가운데) |

도구 (core.js):

| 도구 | 뜻 |
|---|---|
| `ultShake(amp, ms)` | 다른 포켓몬 · 앞쪽 풀 흔들기 (쓰는 애는 안 흔듦) |
| `ultHit(q, dir, kind)` | 다른 포켓몬 맞히기 — `kind`: `tumble`(뒤로 밀려 벌러덩 · 기본) `lift`(떠올랐다 툭) `spin`(빙글 돌며 떠오름) `shake` |
| `ultHitIn(u, x0, x1, kind)` | x 가 x0~x1 안인 다른 포켓몬 모두 맞히기 |
| `ultDark(alpha, ms)` | 기본 어둠 위에 더 어둡게 (고스트 · 블랙홀) |
| `ultMove(pokemon, fn)` | 포켓몬을 움직이는 상태 — `fn(i)` 를 0.1초(1프레임)마다 부름, `true` 를 돌려주면 끝. 위치는 `pokemon.positionLeft(x)` · `positionBottom(y)` (보이는 그림은 0.15초 늦게 따라옴) |
| `ultHide(pokemon, on)` | 그림 숨기기 (화면 밖으로 날아간 동안) |

기존 도구 그대로: `sigParticle` `sigEmitter` `sigBurst` `sigRing` `sigDisc` `sigImpact` `zigzag` `zapLine` `zapBranch` `dotAt` `fadeInOut` `screenFlash` `DRAW` `SHAPES` `sigPal` `SIG_PALETTE` `moveRand` `movePick` `boltPath`, 그리고 클릭 기술 틀 `SIG_FX.<틀>.run(g, o, ms, pokemon)` 을 부품으로 (g 에 `{ ...u, P: 1 }`).

입자: `sigParticle({ x, y, s, max(초), vx, vy, g(중력), drag, update(p, dt), draw(ctx, p, t, px) })` — `t` = 0~1 진행, `px(v)` = 점 칸에 맞춤(p.s 단위). 화면 전체를 칠할 땐 `fillRect` 한 번으로 (점마다 돌지 말기).

### 지킬 것

- **화려하게**: 모으기 → 터짐 → 여운. 화면 번쩍 · 흔들림 · 충격파 · 튀는 조각 · 다른 포켓몬 반응(벌러덩 · 떠오름). 기존 `solarbeam` · `megavolt` · `thunder` · 광선 힘겨루기 정도가 **최소** 기준
- **도트 느낌**: 사각형 점(`dotAt`, `fillRect`)으로 — 부드러운 원 · 그라디언트 · shadowBlur 는 쓰지 않음 (큰 글씨 제외)
- **가볍게**: 살아 있는 입자 1500개 이하, 화면 전체 반복은 큰 덩어리로. 60fps 유지
- 화면 끝 · 작은 패널 · 납작한 패널 · 패널 양 끝에 선 포켓몬에서도 안 깨지게
- 이 틀이 쓰는 옵션은 전부 처리 (없는 옵션은 무시)
