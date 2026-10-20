/**
 * 1-3 길 끝 체육관 (2026-10-20 태현 님 A안 "1-3 끝 → 체육관 들어가기" · 모양 C 간판 강조) — 원작 상록시티 체육관 외관 (media/buildings/gym-front.png) · 왼쪽 GYM 간판 기둥 ·
 * 기둥 왼쪽 땅 위 큰 간판 "숲 체육관 / 관장 나래". gym-enter 동안 문 칸에 원작 두짝 미닫이문 열림 3장 + 문 사이 흰 빛. 건물은 사람과 같은 정수 배율 (병원 · 상점과 같음), 자리가 모자라면 지붕 위가 잘림.
 * 좁은 패널 (끝에 닿았을 때 간판이 왼쪽 끝 밖으로 나가면) = 기둥을 숨기고 간판이 그 자리 (건물 바로 왼쪽) 에 섬 — 그래도 모자라면 왼쪽 끝 4px 에 붙음.
 * 간판 자리는 끝에 닿은 자리 (restX) 로 정함 — 건물이 다가오는 동안 간판이 튀거나 기둥이 사라지지 않게.
 */
import { GYM_LEADER } from '../../../core/rules/trainer';
import { GYM_FRONT } from '../model';

/** 문 열림 장마다 빛 폭 (칸) — 가운데에서 벌어짐 */
const LIGHT_W = [0, 4, 8, 10] as const;
/** 큰 간판 폭 어림 (px, 그림자 1px 포함 — 실제 74 쯤) · 화면 왼쪽 끝 여백 */
const BANNER_W = 78;
const EDGE = 4;

export function GymFront({ x, restX, k, ground, roomPx, media, door }: { x: number; restX: number; k: number; ground: number; roomPx: number; media: string; door: 0 | 1 | 2 | 3 }) {
  const g = GYM_FRONT;
  const base = `${media.replace(/\/+$/, '')}/buildings`;
  const toLeft = (doorX: number) => Math.round(doorX - (g.doorX + g.doorW / 2) * k);
  const left = toLeft(x);
  const rest = toLeft(restX);
  const visible = Math.min(g.h * k, Math.max(0, Math.floor(roomPx)));
  // 간판 오른쪽 끝이 건물 왼쪽에서 얼마나 (px) — 보통 기둥 왼쪽 8칸 (24칸) · 좁으면 기둥 자리 (2칸, 모자라면 왼쪽 끝 4px 까지 당김)
  const narrow = rest - 24 * k - BANNER_W < EDGE;
  const bannerGap = narrow ? rest - Math.max(rest - 2 * k, EDGE + BANNER_W) : 24 * k;
  return (
    <span class="pg-gymfront" style={{ left: `${left}px`, bottom: `${ground}px`, '--pg-gk': `${k}px` }} title={`숲 체육관 · ${GYM_LEADER.name}`}>
      {!narrow && <img class="pg-gymfront-post" src={`${base}/${g.post.file}.png`} alt="" width={g.post.w * k} height={g.post.h * k} draggable={false} />}
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
        {/* 문 사이로 새는 흰 빛 (문이 열릴수록 넓게, 걸음마다) */}
        {door > 0 && <span class="pg-gymfront-light" style={{ left: `${(g.doorX + (g.doorW - LIGHT_W[door]) / 2) * k}px`, width: `${LIGHT_W[door] * k}px` }} />}
      </span>
      {/* 큰 간판 — 땅 위에 다리 둘로 섬 (건물 위는 패널 높이에 따라 잘려서 땅에) */}
      <span class="pg-gymfront-banner" style={{ right: `calc(100% + ${bannerGap}px)` }}>
        <b>숲 체육관</b>
        <span>{GYM_LEADER.name}</span>
      </span>
    </span>
  );
}
