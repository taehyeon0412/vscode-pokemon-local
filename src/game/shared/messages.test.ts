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
  ])('받음: $type', (m) => {
    expect(isWebviewToHost(m)).toBe(true);
  });

  it.each([
    ['원래 확장 메시지', { command: 'spawn-pokemon', type: 'boot' }],
    ['모르는 종류', { command: 'game', type: 'explode' }],
    ['epoch 없음', { command: 'game', type: 'state', state }],
    ['상태 없음', { command: 'game', type: 'state', epoch: 1 }],
    ['모르는 저장 까닭', { command: 'game', type: 'save-now', epoch: 1, reason: 'because', state }],
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
});
