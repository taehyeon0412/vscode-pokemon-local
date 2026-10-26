import { useLayoutEffect, useState } from 'preact/hooks';

/** 끝 말을 넘어가는 때 (fallAt — performance.now) 에 다시 그림 — 붙잡힌 엔진은 그동안 다시 안 그려서 (BattleLayer · StageScreen 정보줄 말) */
export function useFallWake(fallAt: number): void {
  const [, wake] = useState(0);
  useLayoutEffect(() => {
    const left = fallAt - performance.now();
    if (left <= 0) return undefined;
    const id = setTimeout(() => wake((n) => n + 1), Math.ceil(left) + 16);
    return () => clearTimeout(id);
  }, [fallAt]);
}
