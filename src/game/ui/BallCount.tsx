/** 볼 개수 (S06 ①) — 코드로 그린 작은 몬스터볼 + ×개수 (글자 ◓ 는 작아서 잘 안 보임) */
export function BallCount({ count }: { count: number }) {
  return (
    <span class="pg-balls" title={`몬스터볼 ${count}개`}>
      <span class="pg-ball" aria-hidden="true" />×{count}
    </span>
  );
}
