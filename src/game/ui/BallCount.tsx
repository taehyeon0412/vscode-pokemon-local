import { useRef } from 'preact/hooks';
import type { BallId } from '../core/rules/catch';
import { itemName } from '../core/rules/items';
import { Icon, type IconName } from './Icon';

const BALL_ICON: Record<BallId, IconName> = { 'poke-ball': 'ball', 'great-ball': 'greatBall', 'ultra-ball': 'ultraBall' };

/** 볼 하나 — 픽셀 아이콘 + ×개수. 개수가 바뀌었을 때만 숫자가 2px 톡 (처음 그릴 때 · 정보줄을 다시 그릴 때는 안 튐 — 아트 디렉터 5차) */
function One({ id, n, compact }: { id: BallId; n: number; compact: boolean }) {
  const prev = useRef(n);
  const bumped = useRef<number | null>(null);
  if (prev.current !== n) {
    bumped.current = n;
    prev.current = n;
  }
  return (
    <span class="pg-ball-one" title={`${itemName(id)} ${n}개`}>
      <Icon name={BALL_ICON[id]} />
      {/* key 가 바뀌면 새로 그려져 튀는 움직임이 한 번 돎 */}
      <b key={n} class={bumped.current === n ? 'pg-count pg-bump' : 'pg-count'}>
        {compact ? n : `×${n}`}
      </b>
    </span>
  );
}

/**
 * 볼 개수 (S06 ①) — 몬스터볼은 늘 · 슈퍼볼 · 하이퍼볼은 가진 것만 (2026-10-20 태현 님 "상점에서 산 다른 볼도 몬스터볼 ×3 하이퍼볼 ×3 처럼").
 * counts = 볼 순서 (BALLS) 대로 · compact = 좁은 패널 (× 를 빼고 붙임 — 볼 세 종류에 오른쪽 메뉴가 밀려나던 것)
 */
export function BallCount({ counts, compact = false }: { counts: { id: BallId; n: number }[]; compact?: boolean }) {
  return (
    <span class={compact ? 'pg-balls pg-balls-compact' : 'pg-balls'}>
      {counts
        .filter((c) => c.id === 'poke-ball' || c.n > 0)
        .map((c) => (
          <One key={c.id} id={c.id} n={c.n} compact={compact} />
        ))}
    </span>
  );
}
