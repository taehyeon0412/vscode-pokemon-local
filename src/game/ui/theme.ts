/** VS Code 테마 — 밝은 테마면 밝은 숲 그림 (일반 모드와 같은 그림 · 같은 규칙). 스테이지 · 타이틀이 같이 씀 */
export function themeKind(): 'light' | 'dark' {
  const c = document.body.classList;
  return c.contains('vscode-light') || c.contains('vscode-high-contrast-light') ? 'light' : 'dark';
}
