import { useRef } from 'preact/hooks';
import { Icon } from './Icon';

/** 볼 개수 (S06 ①) — 픽셀 몬스터볼 아이콘 + ×개수 (단계 12). 개수가 바뀌었을 때만 숫자가 2px 톡 (처음 그릴 때 · 정보줄을 다시 그릴 때는 안 튐 — 아트 디렉터 5차) */
export function BallCount({ count }: { count: number }) {
  const prev = useRef(count);
  const bumped = useRef<number | null>(null);
  if (prev.current !== count) {
    bumped.current = count;
    prev.current = count;
  }
  return (
    <span class="pg-balls" title={`몬스터볼 ${count}개`}>
      <Icon name="ball" />
      {/* key 가 바뀌면 새로 그려져 튀는 움직임이 한 번 돎 */}
      <b key={count} class={bumped.current === count ? 'pg-count pg-bump' : 'pg-count'}>
        ×{count}
      </b>
    </span>
  );
}
