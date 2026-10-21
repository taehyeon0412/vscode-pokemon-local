/**
 * 멈춤 · 알림 (gdd 4.13 표 · U6 "멈추면 알리고, 알리지 않으면 멈추지 않는다") — 밖 (패널은 보이는데 VS Code 포커스 없음) · 숨김에서 사람을 기다리는 이유.
 * paused = 자동 꺼짐 + 숨김 (확장이 계산을 멈춤 — 확장이 넘겨받을 때 한 번).
 * 이 파일은 아무것도 가져오지 않음 — shared/messages 가 값으로 가져가 boot.js (일반 모드에서도 읽힘) 에 들어가므로 (게임 코드 138KB 가 딸려 가던 것 — 코드 리뷰어)
 */
export const GAME_NOTICES = ['shiny', 'rival', 'battle', 'choice', 'defeat', 'clear', 'gym', 'badge', 'paused'] as const;
export type GameNotice = (typeof GAME_NOTICES)[number];
