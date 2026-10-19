import { describe, expect, it } from 'vitest';
import { GAME_TOGGLE_COMMAND, withSkipShell } from './terminal-keys';

describe('F3 가 터미널에서도 먹게 — commandsToSkipShell 에 게임 전환 명령 (2026-10-19 태현 님)', () => {
  it('없으면 뒤에 넣음 · 다른 명령은 그대로', () => {
    expect(withSkipShell(undefined)).toEqual([GAME_TOGGLE_COMMAND]);
    expect(withSkipShell(['workbench.action.quickOpen'])).toEqual(['workbench.action.quickOpen', GAME_TOGGLE_COMMAND]);
  });

  it('이미 있거나 사용자가 "-" 로 뺐으면 쓰지 않음 · 이상한 값은 버리고 넣음', () => {
    expect(withSkipShell([GAME_TOGGLE_COMMAND])).toBeNull();
    expect(withSkipShell([`-${GAME_TOGGLE_COMMAND}`])).toBeNull();
    expect(withSkipShell('x')).toEqual([GAME_TOGGLE_COMMAND]);
    expect(withSkipShell([1, 'a'])).toEqual(['a', GAME_TOGGLE_COMMAND]);
  });
});
