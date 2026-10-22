/**
 * 진짜 시계 — 화면 붙잡기 (U1 "1초 넘게" — 3:3 띠 · 쓰러짐 말 · 결과 줄) 는 게임 배 (webview/clock.ts — ▶▶ ×2 · 끼어들 창 늦춤) 와 상관없이 진짜 시간으로 잰다
 * (게임 시계로 세어 ▶▶ 에서 "1.2초" 붙잡기가 실제 0.6초 · 상대 필살기 띠가 0.85 ~ 0.96초만 보이던 것 — UX 리뷰어 #95 13바퀴 큼 1 · 같은 띠 세 번째).
 * 불러올 때 잡아 둠 — 게임 시계는 처음 1 이 아닌 배가 될 때 (화면이 다 뜬 뒤) performance.now · setTimeout 을 바꿔 끼움
 */
const now0 = performance.now.bind(performance);
const later0 = globalThis.setTimeout.bind(globalThis);
const clear0 = globalThis.clearTimeout.bind(globalThis);

export function realNow(): number {
  return now0();
}

/** 진짜 시간 ms 뒤에 부름 — 끄는 함수를 돌려줌 (useEffect 정리에 그대로) */
export function realLater(fn: () => void, ms: number): () => void {
  const id = later0(fn, ms);
  return () => clear0(id);
}
