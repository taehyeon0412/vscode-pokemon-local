/** 볼 개수 (S06 ①) — 코드로 그린 작은 몬스터볼 + ×개수 (글자 ◓ 는 작아서 잘 안 보임). 개수가 바뀌면 숫자가 톡 튐 */
export function BallCount({ count }: { count: number }) {
  return (
    <span class="pg-balls" title={`몬스터볼 ${count}개`}>
      <span class="pg-ball" aria-hidden="true" />
      {/* key 가 바뀌면 새로 그려져 튀는 움직임이 다시 돎 */}
      <b key={count} class="pg-count">
        ×{count}
      </b>
    </span>
  );
}
