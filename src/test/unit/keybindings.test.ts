/** 단축키 (extension/package.json) — 설치하면 F3 = 게임 모드 ↔ 일반 모드 (2026-10-19 태현 님) */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface Keybinding {
  command: string;
  key: string;
  mac?: string;
  when?: string;
}

const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'extension', 'package.json'), 'utf8')) as { contributes: { keybindings: Keybinding[] } };

describe('F3 = 게임 모드 ↔ 일반 모드 (gdd 4.7)', () => {
  const f3 = pkg.contributes.keybindings.filter((k) => k.key === 'f3');

  it('설치하면 F3 가 게임 모드 명령 (일반 모드면 게임으로 · 게임 중이면 일반 모드로) — 맥도 F3', () => {
    expect(f3).toHaveLength(1);
    expect(f3[0]).toMatchObject({ command: 'vscode-pokemon.game-mode', mac: 'f3' });
  });

  it('찾기 창이 열려 있어도 F3 = 게임 전환 ("다음 찾기" 는 안 씀 — 태현 님) · 게임 빌드가 없을 때만 안 먹음', () => {
    const when = f3[0]?.when ?? '';
    expect(when).toContain('vscode-pokemon.gameAvailable');
    expect(when).not.toMatch(/findWidgetVisible|terminalFindVisible|webviewFindWidgetVisible/);
  });
});
