/**
 * 3:3 합동 이름 (orders #100 시안 → #96 ② 기획 표 joint-names.json — 짝 171 · 셋 규칙, 이름은 팀이 지음 · 태현 님이 바꿀 수 있음).
 * 참가자 첫 타입끼리 짝 (순서 상관없음) → 큰 이름. 셋 = "삼중 " + 앞장 × 먼저 끼어든 동료 짝 이름 (불꽃 · 물 · 풀 셋은 "삼색 대폭발").
 */
import type { TypeName } from '../../../data';

/** 두 타입 짝 — 영어 이름 순으로 정렬한 "a+b" (18 타입 × 짝 = 171 · 같은 타입 둘 포함) */
const PAIR: Record<string, string> = {
  'normal+normal': '전력 질주',
  'fire+normal': '불꽃 대돌진',
  'normal+water': '물보라 맹공',
  'grass+normal': '초록 질주',
  'electric+normal': '전광 돌격',
  'ice+normal': '얼음 강타',
  'fighting+normal': '백열 연타',
  'normal+poison': '독가시 맹공',
  'ground+normal': '땅울림 강타',
  'flying+normal': '질풍 돌격',
  'normal+psychic': '염동 일격',
  'bug+normal': '벌떼 몰이',
  'normal+rock': '낙석 맹공',
  'ghost+normal': '그림자 기습',
  'dragon+normal': '용맹 돌진',
  'dark+normal': '어둠 기습',
  'normal+steel': '철갑 맹진',
  'fairy+normal': '꿈빛 강타',
  'fire+fire': '쌍불기둥',
  'fire+water': '증기 폭발',
  'fire+grass': '화염 꽃보라',
  'electric+fire': '뇌염 섬광',
  'fire+ice': '빙염 소용돌이',
  'fighting+fire': '불주먹 난타',
  'fire+poison': '독불 연기',
  'fire+ground': '용암 분출',
  'fire+flying': '불사조 날개',
  'fire+psychic': '염화 사이코',
  'bug+fire': '불나방 춤',
  'fire+rock': '화산탄',
  'fire+ghost': '도깨비불 행렬',
  'dragon+fire': '화룡 포효',
  'dark+fire': '지옥불',
  'fire+steel': '쇳물 폭포',
  'fairy+fire': '불꽃놀이',
  'water+water': '대해일',
  'grass+water': '꽃잎 해일',
  'electric+water': '뇌우',
  'ice+water': '빙하 붕괴',
  'fighting+water': '파도 주먹',
  'poison+water': '독늪 소용돌이',
  'ground+water': '진흙 탁류',
  'flying+water': '폭풍우',
  'psychic+water': '신비의 물결',
  'bug+water': '이슬 군무',
  'rock+water': '암벽 격랑',
  'ghost+water': '심해 망령',
  'dragon+water': '해룡 승천',
  'dark+water': '검은 소용돌이',
  'steel+water': '수압 포격',
  'fairy+water': '무지개 분수',
  'grass+grass': '숲의 분노',
  'electric+grass': '번개 덩굴',
  'grass+ice': '서리꽃 만개',
  'fighting+grass': '덩굴 연격',
  'grass+poison': '독꽃 가루',
  'grass+ground': '거목 뿌리',
  'flying+grass': '꽃잎 회오리',
  'grass+psychic': '신비의 정원',
  'bug+grass': '숲의 군단',
  'grass+rock': '화석 숲',
  'ghost+grass': '유령 숲',
  'dragon+grass': '녹룡 폭풍',
  'dark+grass': '가시 덫',
  'grass+steel': '칼날 잎',
  'fairy+grass': '꽃의 축복',
  'electric+electric': '쌍뇌격',
  'electric+ice': '빙뢰',
  'electric+fighting': '뇌격권',
  'electric+poison': '독전류',
  'electric+ground': '땅속 방전',
  'electric+flying': '천둥 구름',
  'electric+psychic': '사이코 방전',
  'bug+electric': '번개 벌떼',
  'electric+rock': '낙뢰암',
  'electric+ghost': '도깨비 전격',
  'dragon+electric': '뇌룡 일섬',
  'dark+electric': '검은 번개',
  'electric+steel': '자력 포격',
  'electric+fairy': '별똥 전류',
  'ice+ice': '절대 빙결',
  'fighting+ice': '빙권 난타',
  'ice+poison': '독빙 결정',
  'ground+ice': '영구 동토',
  'flying+ice': '눈보라 회오리',
  'ice+psychic': '결정 공명',
  'bug+ice': '얼음 갑충',
  'ice+rock': '빙산 낙하',
  'ghost+ice': '설녀의 숨결',
  'dragon+ice': '빙룡 포효',
  'dark+ice': '흑빙 일섬',
  'ice+steel': '강철 고드름',
  'fairy+ice': '다이아 눈꽃',
  'fighting+fighting': '백만 주먹',
  'fighting+poison': '독침 찌르기',
  'fighting+ground': '땅 가르기',
  'fighting+flying': '공중 연격',
  'fighting+psychic': '정신 일도',
  'bug+fighting': '갑충 박치기',
  'fighting+rock': '바위 부수기',
  'fighting+ghost': '혼령 발경',
  'dragon+fighting': '용권',
  'dark+fighting': '뒷골목 난투',
  'fighting+steel': '철권 난타',
  'fairy+fighting': '별빛 발차기',
  'poison+poison': '맹독 늪',
  'ground+poison': '독 진흙탕',
  'flying+poison': '독바람',
  'poison+psychic': '환각 안개',
  'bug+poison': '독벌 습격',
  'poison+rock': '독석 폭격',
  'ghost+poison': '저주 안개',
  'dragon+poison': '독룡 숨결',
  'dark+poison': '맹독 함정',
  'poison+steel': '부식 비',
  'fairy+poison': '달콤한 독',
  'ground+ground': '대지 붕괴',
  'flying+ground': '모래 폭풍',
  'ground+psychic': '지각 변동',
  'bug+ground': '지하 군단',
  'ground+rock': '산사태',
  'ghost+ground': '무덤 흔들기',
  'dragon+ground': '지룡 진격',
  'dark+ground': '개미지옥',
  'ground+steel': '강철 드릴',
  'fairy+ground': '요정의 대지',
  'flying+flying': '대폭풍',
  'flying+psychic': '천공 염동',
  'bug+flying': '은빛 날개바람',
  'flying+rock': '급강하 낙석',
  'flying+ghost': '혼령 회오리',
  'dragon+flying': '천룡 강하',
  'dark+flying': '밤까마귀 떼',
  'flying+steel': '칼날 깃 폭풍',
  'fairy+flying': '하늘 요정 춤',
  'psychic+psychic': '초능력 폭주',
  'bug+psychic': '환상 날갯짓',
  'psychic+rock': '운석 낙하',
  'ghost+psychic': '영혼 공명',
  'dragon+psychic': '신룡 강림',
  'dark+psychic': '환영 붕괴',
  'psychic+steel': '염동 톱니',
  'fairy+psychic': '달빛 기도',
  'bug+bug': '곤충 대군',
  'bug+rock': '갑옷 돌격',
  'bug+ghost': '혼불 나비',
  'bug+dragon': '용충 비상',
  'bug+dark': '밤벌레 떼',
  'bug+steel': '철갑 집게',
  'bug+fairy': '꽃가루 나비',
  'rock+rock': '거암 낙하',
  'ghost+rock': '비석 저주',
  'dragon+rock': '용의 거암',
  'dark+rock': '흑요석 비',
  'rock+steel': '광석 폭격',
  'fairy+rock': '보석 폭발',
  'ghost+ghost': '망령 행진',
  'dragon+ghost': '망령룡',
  'dark+ghost': '악몽',
  'ghost+steel': '저주 갑주',
  'fairy+ghost': '환상의 밤',
  'dragon+dragon': '쌍룡 포효',
  'dark+dragon': '흑룡 파멸',
  'dragon+steel': '철룡 돌파',
  'dragon+fairy': '성룡의 빛',
  'dark+dark': '칠흑 습격',
  'dark+steel': '흑철 칼날',
  'dark+fairy': '달과 그림자',
  'steel+steel': '강철 협공',
  'fairy+steel': '백금 별빛',
  'fairy+fairy': '요정의 원무',
};

/** 세 타입 특별 이름 (셋 다 다를 때) */
const TRIO: Record<string, string> = {
  'fire+grass+water': '삼색 대폭발',
};

export const JOINT_NAME_DEFAULT = '합동 필살기';
export const JOINT_TRIPLE_PREFIX = '삼중';

const pairName = (a: TypeName, b: TypeName): string => PAIR[[a, b].sort().join('+')] ?? JOINT_NAME_DEFAULT;

/** 참가자 첫 타입들 (앞장 · 먼저 끼어든 동료 · 다음 순) → 합동 이름 */
export function jointName(types: readonly TypeName[]): string {
  if (types.length === 2) return pairName(types[0]!, types[1]!);
  if (types.length === 3) {
    const special = TRIO[[...types].sort().join('+')];
    if (special) return special;
    const pair = pairName(types[0]!, types[1]!);
    return pair === JOINT_NAME_DEFAULT ? pair : `${JOINT_TRIPLE_PREFIX} ${pair}`;
  }
  return JOINT_NAME_DEFAULT;
}

/**
 * 긴 합동 이름을 두 줄로 나눌 자리 — 긴 줄이 가장 짧아지는 띄어쓰기 (같으면 앞쪽 = "삼중" 뒤) · 띄어쓰기가 없으면 null
 * ("삼중 도깨비불 / 행렬" · "삼중 하늘 요정 / 춤" 처럼 한쪽이 한두 글자로 남던 것 — UX 리뷰어 #96)
 */
export function splitName(name: string): [string, string] | null {
  let best: [string, string] | null = null;
  let bestLen = Infinity;
  for (let i = name.indexOf(' '); i > 0; i = name.indexOf(' ', i + 1)) {
    const a = name.slice(0, i);
    const b = name.slice(i + 1);
    const len = Math.max(a.replace(/ /g, '').length, b.replace(/ /g, '').length);
    if (len < bestLen) {
      bestLen = len;
      best = [a, b];
    }
  }
  return best;
}
