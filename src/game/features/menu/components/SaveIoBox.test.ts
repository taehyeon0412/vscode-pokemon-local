import { describe, expect, it } from 'vitest';
import { askKeyAct } from './SaveIoBox';

describe('세이브 불러오기 묻는 상자 키', () => {
  it('보통은 Enter · Space = 불러오기 · Esc = 그만두기', () => {
    expect(askKeyAct('Enter', 0)).toBe('import-confirm');
    expect(askKeyAct(' ', 0)).toBe('import-confirm');
    expect(askKeyAct('Escape', 0)).toBe('import-cancel');
  });
  it('빠지는 포켓몬이 있으면 (lost) Enter 도 그만두기 — 불러오기는 버튼을 눌러야 (ideas 166)', () => {
    expect(askKeyAct('Enter', 2)).toBe('import-cancel');
    expect(askKeyAct(' ', 1)).toBe('import-cancel');
    expect(askKeyAct('Escape', 1)).toBe('import-cancel');
  });
});
