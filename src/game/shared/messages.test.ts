import { describe, expect, it } from 'vitest';
import { sampleSave } from '../../test/fixtures/save';
import { createGameState } from '../core/engine';
import { isHostToWebview, isWebviewToHost } from './messages';

const state = createGameState(sampleSave(), 1);

describe('웹뷰 → 확장 메시지 모양', () => {
  it.each([
    { command: 'game', type: 'boot' },
    { command: 'game', type: 'ready' },
    { command: 'game', type: 'state', epoch: 1, state },
    { command: 'game', type: 'hidden', epoch: 2, state },
    { command: 'game', type: 'save-now', epoch: 1, reason: 'catch', state },
    { command: 'game', type: 'load-failed', message: 'x' },
    { command: 'game', type: 'title-new', save: state.save },
    { command: 'game', type: 'title-continue' },
    { command: 'game', type: 'exit', epoch: null, state: null },
    { command: 'game', type: 'exit', epoch: 3, state },
  ])('받음: $type', (m) => {
    expect(isWebviewToHost(m)).toBe(true);
  });

  it.each([
    ['원래 확장 메시지', { command: 'spawn-pokemon', type: 'boot' }],
    ['모르는 종류', { command: 'game', type: 'explode' }],
    ['epoch 없음', { command: 'game', type: 'state', state }],
    ['상태 없음', { command: 'game', type: 'state', epoch: 1 }],
    ['모르는 저장 까닭', { command: 'game', type: 'save-now', epoch: 1, reason: 'because', state }],
    ['새로 하기 세이브 없음', { command: 'game', type: 'title-new' }],
    ['나가기 epoch 이 글자', { command: 'game', type: 'exit', epoch: '1', state: null }],
    ['나가기 상태가 이상함', { command: 'game', type: 'exit', epoch: 1, state: 'x' }],
    ['객체가 아님', 'game'],
  ])('버림: %s', (_n, m) => {
    expect(isWebviewToHost(m)).toBe(false);
  });
});

describe('확장 → 웹뷰 메시지 모양', () => {
  it('load · stop · start', () => {
    expect(isHostToWebview({ command: 'game', type: 'load' })).toBe(true);
    expect(isHostToWebview({ command: 'game', type: 'stop' })).toBe(true);
    expect(isHostToWebview({ command: 'game', type: 'start', epoch: 3, state })).toBe(true);
    expect(isHostToWebview({ command: 'game', type: 'start', epoch: 3 })).toBe(false);
    expect(isHostToWebview({ command: 'list-pokemon' })).toBe(false);
  });

  it('세이브 내보내기 · 가져오기 (orders #33)', () => {
    for (const type of ['save-export', 'save-import', 'save-import-confirm', 'save-import-cancel']) expect(isWebviewToHost({ command: 'game', type })).toBe(true);
    expect(isHostToWebview({ command: 'game', type: 'save-result', ok: true, text: '저장했어요' })).toBe(true);
    expect(isHostToWebview({ command: 'game', type: 'save-result', ok: 'yes', text: 'x' })).toBe(false);
    expect(isHostToWebview({ command: 'game', type: 'save-import-ask', name: 'a.json', summary: null })).toBe(true);
    expect(isHostToWebview({ command: 'game', type: 'save-import-ask', error: '망가짐' })).toBe(true);
    expect(isHostToWebview({ command: 'game', type: 'save-import-ask', error: 3 })).toBe(false);
  });

  it('title (S02 요약)', () => {
    expect(isHostToWebview({ command: 'game', type: 'title', info: { save: 'none', busy: false, summary: null } })).toBe(true);
    expect(isHostToWebview({ command: 'game', type: 'title', info: { save: 'none' } })).toBe(false);
    expect(isHostToWebview({ command: 'game', type: 'title' })).toBe(false);
  });
});
