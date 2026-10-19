import { Icon } from './Icon';

/** 볼 개수 (S06 ①) — 픽셀 몬스터볼 아이콘 + ×개수 (단계 12). 개수가 바뀌면 숫자가 톡 튐 */
export function BallCount({ count }: { count: number }) {
  return (
    <span class="pg-balls" title={`몬스터볼 ${count}개`}>
      <Icon name="ball" />
      {/* key 가 바뀌면 새로 그려져 튀는 움직임이 다시 돎 */}
      <b key={count} class="pg-count">
        ×{count}
      </b>
    </span>
  );
}
