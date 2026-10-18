/**
 * S01 ② 📦 내 포켓몬 꺼내기 — 확장 → 일반 모드 웹뷰 (main-bundle.js 의 GAME-PATCH) 메시지.
 * 게임 메시지 (command 'game') 와 따로 — game.js · boot.js 는 모르는 command 라 그냥 버림.
 * 늘 "이 목록으로 맞춤" (넣기 = 빈 목록). 일반 모드의 저장 목록 · 설정 동기화에는 안 들어감 (웹뷰가 game 표시로 빼고 저장).
 */
export const TEAM_OUT_COMMAND = 'game-team';

/** 꺼낸 포켓몬 하나 — 그림 (form · 세대 폴더 · 원본 크기 · 색) · 이름 · 레벨 (머리 위) · 배운 기술 (클릭하면 이 중 하나) */
export interface TeamOutMonster {
  uid: string;
  form: string;
  /** 'gen1' 같은 그림 폴더 */
  gen: string;
  size: number;
  color: 'default' | 'shiny';
  name: string;
  level: number;
  moves: { id: number; name: string; type: string }[];
}

export interface TeamOutMessage {
  command: typeof TEAM_OUT_COMMAND;
  team: TeamOutMonster[];
}
