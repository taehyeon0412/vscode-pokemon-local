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
};

export const ICONS = {
  /** 몬스터볼 (볼 개수 · 상대 볼 · 잡음) */
  ball: ['..RRRR..', '.RWRRRR.', 'RRWRRRRr', 'KKKWWKKK', 'KKKWWKKK', 'WWWWWWWw', '.WWWWWw.', '..wwww..'],
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
  /** 반짝 (떨어진 아이템 · 이로치 힌트) */
  sparkle: ['...W...', '...Y...', '..YWY..', 'WYWWWYW', '..YWY..', '...Y...', '...W...'],
} satisfies Record<string, readonly string[]>;

export type IconName = keyof typeof ICONS;
