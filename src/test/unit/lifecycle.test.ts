/**
 * 확장 ↔ 웹뷰 한 바퀴 — 실제 메시지 순서대로 두 세션을 이어 붙여 본다 (웹뷰 생명주기).
 * 보임 3초 → 패널 접기 (자동 전투라 확장이 2초 계산) → 다시 펴기 (웹뷰가 새로 뜸) → 1초 → 저장
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Save } from '../../game/core/save';
import { GameSession } from '../../game/host/game-session';
import { SaveStore } from '../../game/host/save-store';
import type { HostToWebview, WebviewToHost } from '../../game/shared/messages';
import { WebviewSession } from '../../game/webview/webview-session';
import { MemorySaveArchive, MemorySaveStorage, sampleSave, viaJson } from '../fixtures/save';

let now = 0;
beforeEach(() => {
  vi.useFakeTimers();
  now = 0;
});
afterEach(() => {
  vi.useRealTimers();
});

describe('웹뷰 생명주기 한 바퀴', () => {
  it('접었다 펴도 게임 시간이 끊기지 않고 이어지고, 저장까지 됨', async () => {
    const storage = new MemorySaveStorage(sampleSave({ playTimeMs: 0, settings: { notifications: true, autoBattle: true } }));
    const store = new SaveStore(storage, new MemorySaveArchive(), { now: () => now });
    const host = new GameSession({ store, now: () => now, newSeed: () => 1, log: () => undefined, runner: { intervalMs: 250, now: () => now } });
    await host.init();

    // 메시지는 JSON 으로 복사해서 건넴 (postMessage 처럼 같은 객체를 나눠 쓰지 않게)
    let webview: WebviewSession | null = null;
    let gameLoaded = false;
    const toHost = (m: WebviewToHost) => host.handleMessage(viaJson(m));
    const toWebview = (m: HostToWebview) => {
      const copy = viaJson(m);
      if (copy.type === 'load' && !gameLoaded) {
        gameLoaded = true; // boot.js 가 game.js 를 불러옴 → game.js 가 ready
        webview = new WebviewSession({ post: toHost, now: () => now });
        toHost({ command: 'game', type: 'ready' });
        return;
      }
      webview?.handleMessage(copy);
    };
    host.attachView({ post: toWebview, visible: true });
    const frames = (ms: number) => {
      for (let t = 0; t < ms; t += 16) {
        now += 16;
        webview?.frame(16);
      }
    };

    // 1. 보이는 동안 웹뷰가 3초 계산
    toHost({ command: 'game', type: 'boot' });
    expect(await host.enterGame()).toBe('entered');
    expect(host.snapshot.owner).toBe('webview');
    frames(3000);

    // 2. 패널을 접음 — 웹뷰가 마지막 상태를 넘기고 버려짐, 확장이 2초 계산
    webview!.hide();
    host.onVisibilityChanged(false);
    webview = null;
    gameLoaded = false;
    for (let i = 0; i < 8; i++) {
      now += 250;
      vi.advanceTimersByTime(250);
    }
    expect(host.snapshot.owner).toBe('host');

    // 3. 다시 폄 — 웹뷰가 처음부터 다시 뜸 (boot → load → ready → start)
    toHost({ command: 'game', type: 'boot' });
    expect(host.snapshot.owner).toBe('webview');
    frames(1008);
    await store.flush();

    const play = host.snapshot.state!.save.playTimeMs;
    expect(play).toBeGreaterThanOrEqual(5950);
    expect(play).toBeLessThanOrEqual(6050);
    expect((storage.read() as Save).playTimeMs).toBe(play);
  });
});
