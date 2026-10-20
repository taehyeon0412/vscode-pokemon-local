/**
 * 1-3 길 끝 체육관 (2026-10-20 태현 님 A안 "1-3 끝 → 체육관 들어가기") — 원작 상록시티 체육관 외관 (media/buildings/gym-front.png) · 왼쪽 GYM 간판 기둥 ·
 * 우리 간판 "숲 체육관 · 관장 나래". gym-enter 동안 문 칸에 원작 두짝 미닫이문 열림 3장. 건물은 사람과 같은 정수 배율 (병원 · 상점과 같음), 자리가 모자라면 지붕 위가 잘림.
 * 시안 (2026-10-20, 태현 님이 고르면 하나만 남김): a 원작 그대로 · b 숲 체육관답게 (둥근 나무 · 덤불 · 문 사이 금빛 · 원으로 닫히는 닦기) · c 간판 강조 (땅 위 큰 간판 · 흰 빛 · 위에서 아래로 닦기)
 */
import { GYM_LEADER } from '../../../core/rules/trainer';
import { Icon } from '../../../ui/Icon';
import { GYM_FRONT } from '../model';

export type GymLook = 'a' | 'b' | 'c';
/** 시안 고르기 (dev/game-host gl=a|b|c) */
export const gymLook = (): GymLook => {
  const v = (globalThis as { __pgGymLook?: string }).__pgGymLook;
  return v === 'b' || v === 'c' ? v : 'a';
};

/** 문 열림 장마다 빛 폭 (칸) — 가운데에서 벌어짐 */
const LIGHT_W = [0, 4, 8, 10] as const;

export function GymFront({ x, k, ground, roomPx, media, door, look }: { x: number; k: number; ground: number; roomPx: number; media: string; door: 0 | 1 | 2 | 3; look: GymLook }) {
  const g = GYM_FRONT;
  const base = `${media.replace(/\/+$/, '')}/buildings`;
  const left = Math.round(x - (g.doorX + g.doorW / 2) * k);
  const visible = Math.min(g.h * k, Math.max(0, Math.floor(roomPx)));
  const sign = `숲 체육관 · ${GYM_LEADER.name}`;
  return (
    <span class={`pg-gymfront pg-gymfront-${look}`} style={{ left: `${left}px`, bottom: `${ground}px`, '--pg-gk': `${k}px` }} title={sign}>
      {look === 'b' && (
        <>
          <img class="pg-gymfront-trees pg-gymfront-trees-l" src={`${base}/gym-trees.png`} alt="" width={64 * k} height={24 * k} draggable={false} />
          <img class="pg-gymfront-trees pg-gymfront-trees-r" src={`${base}/gym-trees.png`} alt="" width={64 * k} height={24 * k} draggable={false} />
          <span class="pg-gymfront-bush pg-gymfront-bush-l">
            <Icon name="bush" px={2 * k} />
          </span>
          <span class="pg-gymfront-bush pg-gymfront-bush-r">
            <Icon name="bush" px={2 * k} />
          </span>
        </>
      )}
      <img class="pg-gymfront-post" src={`${base}/${g.post.file}.png`} alt="" width={g.post.w * k} height={g.post.h * k} draggable={false} />
      <span class="pg-gymfront-body" style={{ width: `${g.w * k}px`, height: `${visible}px` }}>
        <img src={`${base}/${g.file}.png`} alt="" width={g.w * k} height={g.h * k} draggable={false} />
        {door > 0 && (
          <img
            class="pg-gymfront-door"
            src={`${base}/gym-door-${door}.png`}
            alt=""
            width={g.doorW * k}
            height={g.doorW * k}
            style={{ left: `${g.doorX * k}px`, bottom: '0px' }}
            draggable={false}
          />
        )}
        {/* 문 사이로 새는 빛 — b 금빛 · c 흰 빛 (문이 열릴수록 넓게, 걸음마다) */}
        {door > 0 && look !== 'a' && <span class="pg-gymfront-light" style={{ left: `${(g.doorX + (g.doorW - LIGHT_W[door]) / 2) * k}px`, width: `${LIGHT_W[door] * k}px` }} />}
      </span>
      {/* 간판 — a · b = 기둥 위 작은 이름표 · c = 기둥 왼쪽 땅 위 큰 간판 */}
      {look === 'c' ? (
        <span class="pg-gymfront-banner">
          <b>숲 체육관</b>
          <span>{GYM_LEADER.name}</span>
        </span>
      ) : (
        <span class="pg-gymfront-sign">{sign}</span>
      )}
    </span>
  );
}
