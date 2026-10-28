/**
 * 픽셀 아이콘 그림 (단계 12, 2026-10-19 — 이모지 대신, design-system.md 7장). 그리는 곳 = ui/Icon.tsx.
 * 아이콘은 8 × 8 칸, 화면에서는 2배 (16px) — 포켓몬 그림 (보통 ×2) 과 같은 점 크기. 길 위 그림 (흔적 · 아이템) 은 크기가 제각각이고 그림 배율로.
 * 원작 UI 그림 대신 리드가 직접 그림 (태현 님 "추천대로").
 * 칸 글자: . = 빈칸, 나머지는 PAL 색 (Y/y = 금 · W/w = 크림 · R/r = 빨강 · G/g = 초록 · B/b = 파랑 · N/n = 갈색 — 대문자 밝음 · 소문자 그늘).
 * 어두운 테두리는 없음 — 남색 판 위에서 묻혀 모양이 흐려져서 (색면으로만)
 */
export const PAL: Record<string, string> = {
  Y: '#ffd76a',
  y: '#c9972c',
  W: '#e8e2cf',
  w: '#a9a38f',
  R: '#ff6b5a',
  r: '#b8443a',
  G: '#8fe388',
  g: '#3f9a4a',
  B: '#7fb8ff',
  b: '#3c64a8',
  N: '#b07a48',
  n: '#7a4e2a',
  /** 볼 가운데 띠 · 길 위 그림 테두리 (어두운 색 — 길 위 그림은 원작 그림처럼 테두리가 있음) */
  K: '#1a1406',
  D: '#14201a',
  /** 그림자 (반투명 검정) */
  k: 'rgba(0, 0, 0, 0.45)',
  /** 상처약 보라 (2026-10-20 물건 아이콘) · 하이퍼볼 검정 위 */
  P: '#c48cff',
  p: '#7d4fc4',
  L: '#4a4a52',
};

export const ICONS = {
  /** 몬스터볼 (볼 개수 · 상대 볼 · 잡음) */
  ball: ['..RRRR..', '.RWRRRR.', 'RRWRRRRr', 'LLLWWLLL', 'LLLWWLLL', 'WWWWWWWw', '.WWWWWw.', '..wwww..'],
  /** 잡기 창 큰 몬스터볼 24 × 24 (점 = 길 위 배율 — ×2 면 48px) — 8 × 8 을 6배로 키우면 띠가 창 바탕에 묻혀 버섯처럼 보여서 (아트 디렉터 8차): 바깥 1칸 L · 위 R (오른쪽 아래 r 그늘 · 왼쪽 위 W 빛) · 띠 L K L · 단추 6 × 6 (L 둘레 · W) · 아래 W (오른쪽 아래 w) */
  ballBig: ['........LLLLLLLL........', '......LLRRRRRRRRLL......', '....LLRRRRRRRRRRRRLL....', '...LRWWWRRRRRRRRRRRRL...', '..LRRWWWRRRRRRRRRRRRRL..', '..LRRRRRRRRRRRRRRRRRRL..', '.LRRRRRRRRRRRRRRRRRRRrL.', '.LRRRRRRRRRRRRRRRRRRrrL.', 'LRRRRRRRRRRRRRRRRRRrrrrL', 'LRRRRRRRRLLLLLLRRrrrrrrL', 'LRRRRRRRRLWWWWLRRrrrrrrL', 'LLLLLLLLLLWWWWLLLLLLLLLL', 'LKKKKKKKKLWWWWLKKKKKKKKL', 'LLLLLLLLLLWWWWLLLLLLLLLL', 'LWWWWWWWWLLLLLLWWWWwwwwL', 'LWWWWWWWWWWWWWWWWWwwwwwL', '.LWWWWWWWWWWWWWWWwwwwwL.', '.LWWWWWWWWWWWWWWwwwwwwL.', '..LWWWWWWWWWWWWwwwwwwL..', '..LWWWWWWWWWWWwwwwwwwL..', '...LWWWWWWWWWwwwwwwwL...', '....LLwwwwwwwwwwwwLL....', '......LLwwwwwwwwLL......', '........LLLLLLLL........'],
  /** 잡기 창 "아깝다!" — 열린 큰 몬스터볼 24 × 24 (뚜껑이 들리고 금색 빛살 · 아래 반쪽 속이 빛남, 2026-10-20 태현 님 "아깝다 나올 때 열린 상태로") */
  ballBigOpen: ['........LLLLLLLL........', '......LLRRRRRRRRLL......', '....LLRWWWRRRRRRRRLL....', '...LRRWWWRRRRRRRRRrrL...', '..LRRRRRRRRRRRRRRRRrrL..', '..LRRRRRRRRRRRRRRRrrrL..', '.LLLLLLLLLLLLLLLLLLLLLL.', '.LKKKKKKKKKKKKKKKKKKKKL.', '......Y....YY....Y......', '.......Y...YY...Y.......', '........Y..YY..Y........', '.........Y.YY.Y.........', 'LLLLLLLLLLLLLLLLLLLLLLLL', 'LKKKKKKKKKYYYYKKKKKKKKKL', 'LLLLLLLLLLLLLLLLLLLLLLLL', 'LWWWWWWWWWWWWWWWWWwwwwwL', '.LWWWWWWWWWWWWWWWwwwwwL.', '.LWWWWWWWWWWWWWWwwwwwwL.', '..LWWWWWWWWWWWWwwwwwwL..', '..LWWWWWWWWWWWwwwwwwwL..', '...LWWWWWWWWWwwwwwwwL...', '....LLwwwwwwwwwwwwLL....', '......LLwwwwwwwwLL......', '........LLLLLLLL........'],
  /** 물건 (상점 · 가방, 2026-10-20 아트 디렉터 3차 "물건 아이콘이 없음") — 슈퍼볼 · 하이퍼볼 · 상처약 · 좋은상처약 · 상태 회복약 · 기력의조각 · 진화의 돌 · 연결의끈 */
  greatBall: ['..BBBB..', '.BRBBRB.', 'BRWBBRBb', 'LLLWWLLL', 'LLLWWLLL', 'WWWWWWWw', '.WWWWWw.', '..wwww..'],
  ultraBall: ['..LLLL..', '.YLLLLY.', 'YYWLLYYy', 'KKKWWKKK', 'KKKWWKKK', 'WWWWWWWw', '.WWWWWw.', '..wwww..'],
  potion: ['...ww...', '...WW...', '..wWWw..', '.PPPPPP.', '.PWPPPp.', '.PWPPPp.', '.PPPPPp.', '..pppp..'],
  superPotion: ['...ww...', '...WW...', '..wWWw..', '.RRRRRR.', '.RWRRRr.', '.RWRRRr.', '.RRRRRr.', '..rrrr..'],
  fullHeal: ['...gg...', '...GG...', '..wWWw..', '.YYYYYY.', '.YWYYYy.', '.YWYYYy.', '.YYYYYy.', '..yyyy..'],
  /** 회복약 배지 단계 (#75 화산 — 배지 3 · 5) — 상처약 셋과 같은 분무기 · 금 꼭지 · 고급상처약 = 파랑 · 풀회복약 = 초록 + 흰 십자 (HP 가득 + 상태 — 병원 십자와 같은 뜻) */
  hyperPotion: ['...yy...', '...YY...', '..wWWw..', '.BBBBBB.', '.BWBBBb.', '.BWBBBb.', '.BBBBBb.', '..bbbb..'],
  fullRestore: ['...yy...', '...YY...', '..wWWw..', '.GGGGGG.', '.GWGWGg.', '.GGWWWg.', '.GGGWGg.', '..gggg..'],
  revive: ['...YY...', '..YWYy..', '.YWYYyy.', 'YWYYYYyy', 'yYYYYYyy', '.yYYYyy.', '..yyyy..', '...yy...'],
  stone: ['..wwww..', '.wWWWWw.', 'wWWWwWWw', 'wWWwwWww', 'wWWWWwww', '.wWWwww.', '..wwww..', '........'],
  cord: ['.YY..BB.', 'Y..YB..B', 'Y..YB..B', '.YYYBBB.', '..YB.B..', '..Y..B..', '.YY..BB.', '........'],
  /** 다음 버전 2단계 물건 (2026-10-21) — 이상한사탕 (포장 사탕) · 경험 부적 (금 고리 + 빨간 보석) · 팔 물건 여덟: 작은버섯 · 큰버섯 · 진주 · 큰진주 · 별의모래 · 별의조각 · 금구슬 · 큰금구슬 (작은 것 = 작게, 큰 것 = 8칸 가득 · 금구슬은 울퉁불퉁한 덩어리 — 둥근 돈 아이콘과 헷갈리지 않게) */
  rareCandy: ['........', '........', 'Ww.BB.wW', '.WBWBBW.', '.wBBBbw.', 'Ww.bb.wW', '........', '........'],
  expCharm: ['..y..y..', '.y....y.', '.y....y.', '..yYYy..', '.YYRRYY.', '.YRWRRy.', '..YRRy..', '...yy...'],
  tinyMushroom: ['........', '........', '...RR...', '..RWRR..', '.rrrrrr.', '...WW...', '...Ww...', '........'],
  bigMushroom: ['.RRRRRR.', 'RRWRRWRR', 'RWRRRRRR', 'RRRRRWRr', 'rrrrrrrr', '...WWw..', '...WWw..', '..wwww..'],
  pearl: ['........', '........', '...ww...', '..wWWw..', '..WWWw..', '..wWww..', '...ww...', '........'],
  bigPearl: ['........', '..wwww..', '.wWWWWw.', '.wWWWww.', '.wWWwww.', '.wWwwww.', '..wwww..', '........'],
  stardust: ['........', '.W....Y.', '...Y....', '.Y...W..', '....Y...', '..yYYYy.', '.yYWYYYy', 'yyyyyyyy'],
  starPiece: ['...R....', '..RRR...', 'RRRWRRR.', '.RRRRr..', '..RRrr..', '.RR..r..', '.r....r.', '........'],
  nugget: ['........', '...yy...', '..yWYy..', '.yWYYYy.', '.yYYYYyy', '..yYYyy.', '...yyy..', '........'],
  bigNugget: ['...yy...', '.yyWYy..', 'yWWYYYy.', 'yWYYYYYy', '.yYYYYYy', 'yYYYYYyy', '.yyYyyy.', '..yy.y..'],
  /** 돈 */
  coin: ['..yyyy..', '.yYYYYy.', 'yYWYYYYy', 'yYWYYYYy', 'yYYYYYYy', 'yYYYYYyy', '.yyyyyy.', '..yyyy..'],
  /** 받은 아이템 */
  gift: ['.RR..RR.', 'R..RR..R', '.RRRRRR.', 'yyyRRyyy', 'YYYRRYYY', 'YYYRRYYY', 'YYYRRYYY', 'yyyRRyyy'],
  /** 병원 · 회복 */
  hospital: ['WWWRRWWW', 'WWWRRWWW', 'WWWRRWWW', 'RRRRRRRR', 'RRRRRRRR', 'WWWRRWWw', 'WWWRRWWw', 'wwwRRwww'],
  /** 상점 (차양 친 가게) */
  shop: ['BBWWBBWW', 'BBWWBBWW', 'bbwwbbww', '.WWWWWW.', '.WWbbWW.', '.WWbbWW.', '.WWbbWW.', '.wwbbww.'],
  /** 체육관 (기둥 건물) */
  gym: ['...YY...', '..YYYY..', '.YYYYYY.', 'yyyyyyyy', '.WW..WW.', '.WW..WW.', '.ww..ww.', 'wwwwwwww'],
  /** 버섯 그늘길 (1-2) */
  mushroom: ['..RRRR..', '.RWRRWR.', 'RRRRRRRR', 'RWRRRRWR', 'rrrrrrrr', '...WW...', '...Ww...', '..wwww..'],
  /** 깊은 숲 (1-3) */
  oak: ['..GGGG..', '.GGGGGg.', 'GGGGGGgg', 'GGGGGggg', '.GGGggg.', '..gnng..', '...nn...', '...nn...'],
  /** 해변 스테이지 (2-1 반짝 모래길 · 2-2 갯바위 해안 · 2-3 등대 곶) — 숲 셋과 같은 8 × 8 · 테두리 없음 (길 위 흔적 그림 sparkle · pebbles · ripple 을 쓰던 것: 크기가 셋으로 섞이고 반짝은 이로치로 읽힘, 아트 디렉터 새 화면 한 바퀴) */
  /** 화산 스테이지 (#75) — 기슭 (용암이 흘러내리는 산) · 용암 동굴 (둥근 굴 입구 안 용암) · 분화구 (용암 그릇 + 연기 덩어리) ·
   *  몸통은 밝은 갈색 N (그늘 n 은 오른쪽 · 맨 아래만) — 어두운 n 몸통이 남색 판에서 2.7:1 · 안 고른 탭 0.6 에서 거의 안 보이던 것 · 동굴이 보관함 네모와 같던 것 (아트 디렉터 #75 큼) */
  volcanoSlope: ['........', '..RYYR..', '..NRRn..', '.NNNRnn.', '.NNNnRn.', 'NNNNnRnn', 'NNNnnnRn', 'nnnnnnnn'],
  volcanoCave: ['...nn...', '..NNNn..', '.NNNNnn.', 'NNN..nnn', 'NN....nn', 'NN.YY.nn', 'NNRYYRnn', 'nnRRRRnn'],
  volcanoCrater: ['..wWw...', '...ww...', '........', '.nN..Nn.', 'nNNRRNnn', 'NNRYYRnn', 'NNNRRnnn', 'nnnnnnnn'],
  beachSand: ['........', '........', '.....WW.', '....WWww', '..YYYyy.', '.YYYYYyy', 'YYYYYYyy', 'yyyyyyyy'],
  beachRock: ['........', 'B......B', '.B.WW.B.', '..WWWw..', '.WWWWww.', 'WWWWwwww', 'bBbBbBbB', 'BbBbBbBb'],
  // 등대 = 지붕 + 넓은 불빛 + 줄무늬 탑 (불빛이 탑보다 넓어야 등대로 — 원뿔만이면 라바콘으로 읽히던 것, UX)
  lighthouse: ['...rr...', 'Y.YYYY.Y', '...WW...', '...RR...', '...WW...', '..RRRr..', '..WWWw..', 'nnnnnnnn'],
  /** 숲 (스테이지 이름 · 1-1) */
  tree: ['...GG...', '..GGgG..', '.GGGGgg.', '..GGgg..', '.GGGGgg.', 'GGGGGggg', '...nn...', '...nn...'],
  /** 지도 */
  map: ['WWwWWwWW', 'WGGwGBwW', 'WGRwGBwW', 'WGGwBBwW', 'WBBwBGwW', 'WBBwGGwW', 'WWwWWwWW', 'wwwwwwww'],
  /** 보관함 · 포켓몬 교체 */
  box: ['NNNNNNNN', 'NNNWWNNN', 'nnnnnnnn', 'NNNNNNNn', 'NNWWWWNn', 'NNNNNNNn', 'NNNNNNNn', 'nnnnnnnn'],
  /** 가방 */
  bag: ['..WWWW..', '.W....W.', 'RRRRRRRr', 'RRRYYRRr', 'RRRYYRRr', 'RRRRRRRr', 'RRRRRRRr', 'rrrrrrrr'],
  /** 설정 (톱니) */
  gear: ['W..WW..W', '.WWWWWW.', '.WW..Ww.', 'WW....ww', 'WW....ww', '.Ww..ww.', '.wwwwww.', 'w..ww..w'],
  /** 배지 */
  badge: ['...yy...', '..yYGy..', '.yYGGGy.', 'yYGWGGgy', 'yYGGGggy', '.yGGggy.', '..yggy..', '...yy...'],
  // 해변 배지 = 같은 모양 · 잎 초록 → 물 파랑 (orders #67 — 숲 · 해변 배지가 같은 그림이던 것, 아트 디렉터)
  badgeBeach: ['...yy...', '..yYBy..', '.yYBBBy.', 'yYBWBBby', 'yYBBBbby', '.yBBbby.', '..ybby..', '...yy...'],
  /** 화산 배지 (#75) — 숲 초록 · 해변 파랑과 같은 다이아 틀 · 불 빨강 */
  badgeVolcano: ['...yy...', '..yYRy..', '.yYRRRy.', 'yYRWRRry', 'yYRRRrry', '.yRRrry.', '..yrry..', '...yy...'],
  /** 큰 배지 (관장 카드 — 16 × 16 칸, 점 크기는 다른 아이콘과 같은 2) · 무늬 = 작은 배지와 같은 문법 (빛 W 한 덩이 왼쪽 위 + 오른쪽 아래 테 안 그늘 띠 — 가운데 사선이 ✓ 로 읽히던 것, 아트 #127) */
  badgeBig: ['.......yy.......', '......yYYy......', '.....yYGGYy.....', '....yYGGGGYy....', '...yYGWWGGGYy...', '..yYGGWWGGGGYy..', '.yYGGGGGGGGGGYy.', 'yYGGGGGGGGGGGGYy', 'yYGGGGGGGGGGggYy', '.yYGGGGGGGGggYy.', '..yYGGGGGGggYy..', '...yYGGGGggYy...', '....yYGGggYy....', '.....yYGgYy.....', '......yYYy......', '.......yy.......'],
  // 해변 배지 = 같은 모양 · 잎 초록 → 물 파랑 (orders #67 — 숲 · 해변 배지가 같은 그림이던 것, 아트 디렉터)
  badgeVolcanoBig: ['.......yy.......', '......yYYy......', '.....yYRRYy.....', '....yYRRRRYy....', '...yYRWWRRRYy...', '..yYRRWWRRRRYy..', '.yYRRRRRRRRRRYy.', 'yYRRRRRRRRRRRRYy', 'yYRRRRRRRRRRrrYy', '.yYRRRRRRRRrrYy.', '..yYRRRRRRrrYy..', '...yYRRRRrrYy...', '....yYRRrrYy....', '.....yYRrYy.....', '......yYYy......', '.......yy.......'],
  badgeBeachBig: ['.......yy.......', '......yYYy......', '.....yYBBYy.....', '....yYBBBBYy....', '...yYBWWBBBYy...', '..yYBBWWBBBBYy..', '.yYBBBBBBBBBBYy.', 'yYBBBBBBBBBBBBYy', 'yYBBBBBBBBBBbbYy', '.yYBBBBBBBBbbYy.', '..yYBBBBBBbbYy..', '...yYBBBBbbYy...', '....yYBBbbYy....', '.....yYBbYy.....', '......yYYy......', '.......yy.......'],
  /** 빨리 걷기 ▶▶ (꺼짐 · 켜졌지만 지금은 보통 빠르기) */
  fast: ['........', 'W...W...', 'WW..WW..', 'WWW.WWW.', 'WWW.WWW.', 'WW..WW..', 'W...W...', '........'],
  /** 빨리 걷기 ▶▶ — 지금 ×3 으로 걷는 중 */
  fastOn: ['........', 'Y...Y...', 'YY..YY..', 'YYy.YYy.', 'YYy.YYy.', 'YY..YY..', 'Y...Y...', '........'],
  /** 잠김 */
  lock: ['..WWWW..', '.WW..WW.', '.W....W.', 'YYYYYYYY', 'YYYyyYYY', 'YYYyyYYY', 'YYYYYYYy', 'yyyyyyyy'],
  // ── 길 위 그림 (S06 ④ 야생 흔적 · ⑭ 떨어진 아이템) — 크기는 제각각, 화면 점 크기 = 포켓몬 그림 배율 ──
  /** 풀숲 흔들림 */
  tuft: ['.....D......', '..D.DGD..D..', '.DGDDGgDDGD.', '.DGGDGgDGgD.', 'DGDGgGgGgDGD', 'DGGgGgGgGGgD', 'DgGgggGgGggD', '.DDDDDDDDDD.'],
  /** 나무 흔들림 (잎 덤불) */
  bush: ['...DDDDDD...', '..DGGGGGgD..', '.DGGGGGGGgD.', 'DGGGgGGGGggD', 'DGGGGGGGgggD', 'DgGGGgGGgggD', '.DggggggggD.', '..DDnDDnDD..'],
  /** 물결 */
  ripple: ['...DDDDDD...', '.DDBBBBBBDD.', 'DBB.DDDD.BBD', 'DbbDBBBBDbbD', '.DDbbbbbbDD.', '...DDDDDD...'],
  /** 돌 부스러기 */
  pebbles: ['.......DDD..', '..DDD.DWWwD.', '.DWWwDDWwwD.', '.DWwwD.DDD..', '..DDD.......'],
  /** 날리는 나뭇잎 (위에 무언가) */
  leaf: ['....DDD.', '...DGGD.', '..DGGGD.', '.DGGGgD.', 'DGGggD..', 'DgDDD...', 'D.......'],
  /** 어른거리는 그림자 */
  shadow: ['...kkkkkk...', '.kkkkkkkkkk.', '.kkkkkkkkkk.', '...kkkkkk...'],
  /** 작은 반짝 (필살기 Z 가 다 찼을 때 둘레 별) */
  twinkle: ['..W..', '..Y..', 'WYWYW', '..Y..', '..W..'],
  /** 멈춤 (기다림 한 줄 — 밖 · 숨김에서 멈춘 장면, gdd 4.13 R13 ②) */
  pause: ['WW.WW', 'WW.WW', 'WW.WW', 'WW.WW', 'WW.WW'],
  /** 반짝 (떨어진 아이템 · 이로치 힌트) */
  sparkle: ['...W...', '...Y...', '..YWY..', 'WYWWWYW', '..YWY..', '...Y...', '...W...'],
} satisfies Record<string, readonly string[]>;

export type IconName = keyof typeof ICONS;
