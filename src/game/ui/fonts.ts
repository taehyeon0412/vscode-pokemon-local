/**
 * 글꼴이 자리 잡은 뒤 다시 재기 — 한 군데 (기획 2026-10-30: bugs 2728 대기실 이름표 · 2729 내 HP 줄 — 글꼴이 늦게 와 옛 배치로 잰 채 남던 것 두 번).
 * 크기를 재는 곳은 document.fonts 를 직접 듣지 않고 afterFonts(다시 재기) 만 씀 (src/game/ui/fonts.test.ts 가 지킴).
 * 알림 = 처음 document.fonts.ready · 글꼴을 다 받을 때마다 (loadingdone — ready 는 받기 시작 전이면 바로 끝나 늦은 글꼴을 놓침)
 *   · 숨겼던 게임 화면을 보인 때 (main.ts — 글꼴을 기다리며 숨긴 동안 잰 값은 0).
 */
type Fn = () => void;

const subs = new Set<Fn>();
let wired = false;

/** 다시 재라고 알림 — 한 장면 뒤 (배치가 끝난 다음) */
export function fontsSettled(): void {
  requestAnimationFrame(() => subs.forEach((f) => f()));
}

/** 글꼴이 자리 잡을 때마다 fn (이미 다 왔으면 곧 한 번) — 끄는 함수를 돌려줌 (useEffect 정리에) */
export function afterFonts(fn: Fn): Fn {
  const fonts = typeof document === 'undefined' ? undefined : document.fonts;
  if (fonts && !wired) {
    wired = true;
    fonts.addEventListener('loadingdone', fontsSettled);
  }
  subs.add(fn);
  void fonts?.ready.then(() => subs.has(fn) && fn());
  return () => {
    subs.delete(fn);
  };
}
