import type { GameInput } from '../core/engine';

/** 판이 떠 있는 동안 받는 입력 (판에서 누른 것) — 나머지 (전투 숫자 키 · Space 등) 는 안 받음 (main.ts 가 거름 · 화면 없이 테스트하려고 app.tsx 에서 뺌) */
export const OVERLAY_INPUTS: readonly GameInput['kind'][] = ['team-move', 'team-swap', 'team-to-box', 'points', 'use-item', 'notifications', 'fast-walk', 'battle-fast', 'team-cutscene', 'auto-battle', 'reduce-motion', 'auto-potion', 'skip-caught-last', 'tip-seen', 'buy', 'sell', 'travel', 'region-pick'];
