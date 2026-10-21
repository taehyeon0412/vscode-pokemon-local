/**
 * 개발 모드 (임시, gdd 8장) — 포켓몬마다 고른 필살기 이름 (개발 메뉴 → 연출). 1:1 · 3:3 연출이 쏠 때 읽음.
 * 게임 상태 (runtime.dev.ults) 를 웹뷰가 장마다 여기에 옮김 — 연출 코드는 상태를 몰라도 됨.
 */
let picks: Readonly<Record<string, string>> = {};

export function setDevUlts(next: Readonly<Record<string, string>> | undefined): void {
  picks = next ?? {};
}

/** 그 포켓몬 (uid) 에 고른 필살기 이름 — 없으면 undefined (돌아가며) */
export function devUltOf(uid: string | undefined): string | undefined {
  return uid ? picks[uid] : undefined;
}
