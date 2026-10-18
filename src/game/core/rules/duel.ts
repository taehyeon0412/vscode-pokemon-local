/**
 * 쏘는 기술 짝짓기 표 (mvp-spec S10 · 9장) — 화면과 규칙이 같이 씀.
 */
import { moveOf, type TypeName } from '../../data';

/**
 * 쏘는 기술 → 힘대결 모양 짝짓기 표 (mvp-spec S10 · 9장) — 원래 확장의 필살기 대결 11종 (ult/duel.js) 이름 그대로.
 * 맞받아치기에서 나가는 기술 (같은 모양 먼저 — rules/battle counterMove) 과 힘대결 그림에 씀. 원래 연출에 잇는 건 단계 12.
 */
export type DuelKind = 'beam' | 'bolt' | 'orb' | 'dome' | 'ground' | 'tornado' | 'storm' | 'meteor' | 'swarm' | 'rush' | 'wave';

const TYPE_DUEL: Record<TypeName, DuelKind> = {
  normal: 'beam', fire: 'beam', water: 'wave', electric: 'bolt', grass: 'swarm', ice: 'beam', fighting: 'orb', poison: 'orb', ground: 'ground',
  flying: 'tornado', psychic: 'wave', bug: 'swarm', rock: 'meteor', ghost: 'orb', dragon: 'beam', dark: 'wave', steel: 'beam', fairy: 'orb',
};

/** 타입 기본값과 다른 기술만 (기술 key) */
const MOVE_DUEL: Readonly<Record<string, DuelKind>> = {
  swift: 'swarm', 'egg-bomb': 'orb', barrage: 'orb', 'spike-cannon': 'swarm', 'pay-day': 'swarm', 'razor-wind': 'tornado', 'weather-ball': 'orb',
  'fire-spin': 'tornado', 'magma-storm': 'tornado', 'fire-blast': 'orb', inferno: 'orb', 'flame-burst': 'orb', 'searing-shot': 'orb', 'mystical-fire': 'orb', 'sacred-fire': 'storm',
  'hydro-pump': 'beam', whirlpool: 'tornado', 'water-shuriken': 'swarm', bubble: 'orb', 'origin-pulse': 'wave',
  'zap-cannon': 'orb', 'charge-beam': 'beam', electroweb: 'storm',
  'solar-beam': 'beam', 'energy-ball': 'orb', 'seed-bomb': 'orb', 'seed-flare': 'dome', 'leaf-tornado': 'tornado', absorb: 'orb', 'mega-drain': 'orb', 'giga-drain': 'orb',
  blizzard: 'storm', 'powder-snow': 'storm', 'icy-wind': 'storm', 'frost-breath': 'storm', 'icicle-spear': 'swarm', 'ice-shard': 'swarm', 'icicle-crash': 'meteor',
  'vacuum-wave': 'wave', 'poison-sting': 'swarm', smog: 'storm', 'clear-smog': 'storm', 'sludge-wave': 'wave', 'acid-spray': 'storm',
  'mud-slap': 'swarm', 'precipice-blades': 'ground',
  'sky-attack': 'rush', aeroblast: 'beam',
  psybeam: 'beam', 'luster-purge': 'beam', 'mist-ball': 'orb', 'psycho-cut': 'swarm', 'stored-power': 'orb', psystrike: 'dome',
  'signal-beam': 'beam', 'attack-order': 'swarm', 'silver-wind': 'storm', 'struggle-bug': 'swarm',
  'power-gem': 'beam', 'ancient-power': 'meteor',
  'ominous-wind': 'storm', hex: 'wave',
  twister: 'tornado', 'spacial-rend': 'wave', 'roar-of-time': 'beam',
  'night-daze': 'dome',
  'magnet-bomb': 'orb', 'mirror-shot': 'beam',
  'fairy-wind': 'tornado',
};

export function duelKind(moveId: number | null): DuelKind {
  const mv = moveId !== null ? moveOf(moveId) : undefined;
  if (!mv) return 'beam';
  return MOVE_DUEL[mv.key] ?? TYPE_DUEL[mv.type];
}
