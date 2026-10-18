/**
 * 게임 문구 도우미 — 받침에 맞춰 조사 고르기 ("상처약을" · "몬스터볼을" · "피콘이" · "버터플이").
 * 확장 쪽 · 웹뷰 쪽 문구가 같게 core 에 둠.
 */

/** 앞 = 받침 있을 때 · 뒤 = 받침 없을 때 */
export type Josa = '을/를' | '이/가' | '은/는' | '과/와' | '으로/로';

/** 숫자 읽을 때 받침: 0 영 · 1 일 · 3 삼 · 6 육 · 7 칠 · 8 팔 (받침 있음), 2 · 4 · 5 · 9 (없음) */
const DIGIT_BATCHIM = [true, true, false, true, false, false, true, true, true, false];

/** 마지막 글자의 받침 — 없으면 null (한글 · 숫자가 아니면 모름) / ㄹ 받침인지도 */
function lastSound(word: string): { batchim: boolean; rieul: boolean } | null {
  const ch = word.trim().slice(-1);
  if (!ch) return null;
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28;
    return { batchim: jong !== 0, rieul: jong === 8 };
  }
  if (ch >= '0' && ch <= '9') {
    const d = Number(ch);
    return { batchim: DIGIT_BATCHIM[d]!, rieul: d === 1 || d === 7 || d === 8 };
  }
  return null;
}

/** 단어 + 조사 ("상처약" + "을/를" → "상처약을"). 받침을 모르면 "을(를)" 처럼 둘 다 */
export function withJosa(word: string, josa: Josa): string {
  const [a, b] = josa.split('/') as [string, string];
  const s = lastSound(word);
  if (!s) return `${word}${a}(${b})`;
  if (josa === '으로/로') return `${word}${s.batchim && !s.rieul ? a : b}`;
  return `${word}${s.batchim ? a : b}`;
}

/** 타입 한글 이름 (원작 한국판) */
const TYPE_KO: Record<string, string> = {
  normal: '노말', fire: '불꽃', water: '물', electric: '전기', grass: '풀', ice: '얼음', fighting: '격투', poison: '독', ground: '땅',
  flying: '비행', psychic: '에스퍼', bug: '벌레', rock: '바위', ghost: '고스트', dragon: '드래곤', dark: '악', steel: '강철', fairy: '페어리',
};
export const typeNameKo = (t: string): string => TYPE_KO[t] ?? t;
