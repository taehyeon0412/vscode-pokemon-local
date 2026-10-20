/**
 * 타입 아이콘 (2026-10-20 태현 님 타입 표 B안 "원 엠블럼") — 8 × 8 칸, X = 칠함. 화면에서는 2배 (16px) · 색은 타입 표가 정함.
 * 리드가 직접 그림 (원작 UI 그림 아님): 노말 = 고리 · 불꽃 = 불길 · 물 = 물방울 · 전기 = 번개 · 풀 = 잎 · 얼음 = 눈송이 · 격투 = 주먹 · 독 = 해골 · 땅 = 흙더미 ·
 * 비행 = 날개 · 에스퍼 = 소용돌이 · 벌레 = 딱정벌레 · 바위 = 돌 · 고스트 = 유령 · 드래곤 = 송곳니 · 악 = 초승달 · 강철 = 너트 · 페어리 = 반짝임
 */
import type { TypeName } from './index';

export const TYPE_ICONS: Readonly<Record<TypeName, readonly string[]>> = {
  normal: ['..XXXX..', '.X....X.', 'X..XX..X', 'X.X..X.X', 'X.X..X.X', 'X..XX..X', '.X....X.', '..XXXX..'],
  fire: ['...X....', '...XX...', '..XXX.X.', '..XXXXX.', '.XXX.XXX', '.XX...XX', '.XX..XX.', '..XXXX..'],
  water: ['...XX...', '...XX...', '..XXXX..', '.XXXXXX.', '.XXXX.X.', '.XXXX.X.', '..XXXX..', '...XX...'],
  electric: ['....XXX.', '...XXX..', '..XXX...', '.XXXXXX.', '...XXX..', '..XXX...', '.XXX....', '.XX.....'],
  grass: ['.....XXX', '...XXXXX', '..XXXXXX', '.XXXXX.X', '.XXX.XXX', '.X.XXXX.', '.XX.....', 'X.......'],
  ice: ['...XX...', '.X.XX.X.', '..XXXX..', 'XXXXXXXX', 'XXXXXXXX', '..XXXX..', '.X.XX.X.', '...XX...'],
  fighting: ['.XXXXX..', 'X.X.X.X.', 'XXXXXXX.', 'XXXXXXXX', 'XXXXXXXX', '.XXXXXX.', '..XXXX..', '..XXXX..'],
  poison: ['..XXXX..', '.XXXXXX.', 'XX.XX.XX', 'XX.XX.XX', 'XXXXXXXX', '.XXXXXX.', '..X.X.X.', '..XXXX..'],
  ground: ['........', '...XX...', '..XXXX..', '.XX..XX.', 'XXXXXXXX', 'X..XX..X', 'XXXXXXXX', '........'],
  flying: ['X.......', 'XX......', 'XXX.....', 'XXXXX...', '.XXXXXX.', '..XXXXXX', '....XXXX', '......XX'],
  psychic: ['.XXXXX..', 'X.....X.', 'X.XXX..X', 'X.X.X..X', 'X.X..X.X', 'X..XX..X', '.X....X.', '..XXXX..'],
  bug: ['.X....X.', '..X..X..', '..XXXX..', '.XX.XXX.', 'XXXXXXXX', '.XXX.XX.', '.XXXXXX.', 'X..XX..X'],
  rock: ['..XXX...', '.XXXXX..', 'XXX.XXX.', 'XXXXXXXX', 'XX.XXXXX', 'XXXXX.XX', '.XXXXXX.', '........'],
  ghost: ['..XXXX..', '.XXXXXX.', 'XX.XX.XX', 'XX.XX.XX', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', 'X.XX.XX.'],
  dragon: ['X.....X.', 'XX...XX.', '.XX.XX..', '.XXXXX..', '..XXXX..', '..XXX...', '...XX...', '...X....'],
  dark: ['..XXXX..', '.XXX....', 'XXX.....', 'XXX.....', 'XXX.....', 'XXX.....', '.XXX....', '..XXXX..'],
  steel: ['..XXXX..', '.XXXXXX.', 'XXX..XXX', 'XX....XX', 'XX....XX', 'XXX..XXX', '.XXXXXX.', '..XXXX..'],
  fairy: ['...X....', '...X....', '..XXX...', 'XXXXXXX.', '..XXX...', '...X..X.', '...X.XXX', '......X.'],
};
