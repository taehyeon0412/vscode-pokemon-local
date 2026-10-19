/**
 * 픽셀 아이콘 그림 (단계 12, 2026-10-19 — 이모지 대신, design-system.md 7장). 그리는 곳 = ui/Icon.tsx.
 * 8 × 8 칸, 화면에서는 2배 (16px) — 포켓몬 그림 (보통 ×2) 과 같은 점 크기. 원작 UI 그림 대신 리드가 직접 그림 (태현 님 "추천대로").
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
};

export const ICONS = {
  /** 돈 */
  coin: ['..yyyy..', '.yYYYYy.', 'yYWYYYYy', 'yYWYYYYy', 'yYYYYYYy', 'yYYYYYyy', '.yyyyyy.', '..yyyy..'],
  /** 받은 아이템 */
  gift: ['.RR..RR.', 'R..RR..R', '.RRRRRR.', 'yyyRRyyy', 'YYYRRYYY', 'YYYRRYYY', 'YYYRRYYY', 'yyyRRyyy'],
  /** 병원 · 회복 */
  hospital: ['WWWRRWWW', 'WWWRRWWW', 'WWWRRWWW', 'RRRRRRRR', 'RRRRRRRR', 'WWWRRWWw', 'WWWRRWWw', 'wwwRRwww'],
  /** 상점 (차양 친 가게) */
  shop: ['BWBWBWBW', 'BWBWBWBW', 'bwbwbwbw', '.WWWWWW.', '.WWbbWW.', '.WWbbWW.', '.WWbbWW.', '.wwbbww.'],
  /** 체육관 (기둥 건물) */
  gym: ['...YY...', '..YYYY..', '.YYYYYY.', 'yyyyyyyy', '.WW..WW.', '.WW..WW.', '.ww..ww.', 'wwwwwwww'],
  /** 버섯 그늘길 (1-2) */
  mushroom: ['..RRRR..', '.RWRRWR.', 'RRRRRRRR', 'RWRRRRWR', 'rrrrrrrr', '...WW...', '...Ww...', '..wwww..'],
  /** 깊은 숲 (1-3) */
  oak: ['..GGGG..', '.GGGGGg.', 'GGGGGGgg', 'GGGGGggg', '.GGGggg.', '..gnng..', '...nn...', '...nn...'],
  /** 숲 (스테이지 이름 · 1-1) */
  tree: ['...GG...', '..GGgG..', '.GGGGgg.', '..GGgg..', '.GGGGgg.', 'GGGGGggg', '...nn...', '...nn...'],
  /** 지도 */
  map: ['WWWWWWWW', 'WBBGGBBW', 'WBGGGGBW', 'WBGRGGBW', 'WBGGGgBW', 'WBBGgBBW', 'WBBBBBBW', 'wwwwwwww'],
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
} satisfies Record<string, readonly string[]>;

export type IconName = keyof typeof ICONS;
