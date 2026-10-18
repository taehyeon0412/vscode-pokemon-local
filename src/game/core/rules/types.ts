/**
 * 타입 상성 (mvp-spec 3.3 U5 — 원작 18타입 그대로, 6세대부터의 표).
 * 공격 타입 → 막는 타입: 2 = 효과가 굉장함 · 0.5 = 별로 · 0 = 없음 (적지 않은 칸은 1)
 */
import type { TypeName } from '../../data';

const CHART: Partial<Record<TypeName, Partial<Record<TypeName, number>>>> = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

/** 공격 타입 하나 → 막는 쪽 타입들 (두 타입이면 곱함): 0 · 0.25 · 0.5 · 1 · 2 · 4. 타입이 없으면 (공격 기본기) 1 */
export function effectiveness(attack: TypeName | null, defend: readonly TypeName[]): number {
  if (!attack) return 1;
  return defend.reduce((m, t) => m * (CHART[attack]?.[t] ?? 1), 1);
}

/** 화면 문구: "효과가 굉장했다!" · "효과가 별로인 듯하다…" · "효과가 없는 것 같다…" */
export function effectivenessText(mult: number): string | null {
  if (mult === 0) return '효과가 없는 것 같다…';
  if (mult > 1) return '효과가 굉장했다!';
  if (mult < 1) return '효과가 별로인 듯하다…';
  return null;
}
