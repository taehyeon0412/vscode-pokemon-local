/**
 * 지역마다 다른 그림 (orders #67) — 배지 (숲 잎 초록 · 해변 물 파랑 — 둘 다 받으면 지도 탭 "숲 ◆" · "해변 ◆" 이 같은 그림이던 것, 아트 디렉터) · 지역 표시 (첫 스테이지 아이콘)
 */
import { REGIONS, type RegionId } from '../core/rules/region';
import type { IconName } from '../data/icons';

const BADGE: Record<RegionId, readonly [IconName, IconName]> = {
  forest: ['badge', 'badgeBig'],
  beach: ['badgeBeach', 'badgeBeachBig'],
};

/** 그 지역 배지 그림 (big = 16 × 16 — 배지 카드) */
export const badgeIcon = (id: RegionId, big = false): IconName => BADGE[id][big ? 1 : 0];

/** 지역 표시 그림 = 첫 스테이지 아이콘 (숲 나무 · 해변 모래길) */
export const regionIcon = (id: RegionId): IconName => REGIONS[id].stages[0].icon as IconName;
