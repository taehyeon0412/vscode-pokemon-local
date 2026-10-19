/**
 * F3 = 게임 모드 ↔ 일반 모드 (2026-10-19 태현 님 "F3 는 무조건 게임 전환") — 터미널을 클릭해 둔 동안에도 먹게.
 * VS Code 는 터미널에 포커스가 있으면 단축키를 셸로 넘기고, terminal.integrated.commandsToSkipShell 에 있는 명령만 VS Code 가 받음.
 * 그래서 처음 한 번만 그 목록 (사용자 설정) 에 게임 전환 명령을 넣음 — 사용자가 나중에 빼면 다시 넣지 않음 (index.ts 가 한 번 했다고 기억).
 */
export const GAME_TOGGLE_COMMAND = 'vscode-pokemon.game-mode';

/** 넣은 뒤의 목록 — 이미 있으면 (또는 "-" 로 뺀다고 적어 뒀으면) null (쓸 것 없음) */
export function withSkipShell(current: unknown, id: string = GAME_TOGGLE_COMMAND): string[] | null {
  const list = Array.isArray(current) ? current.filter((v): v is string => typeof v === 'string') : [];
  if (list.includes(id) || list.includes(`-${id}`)) return null;
  return [...list, id];
}
