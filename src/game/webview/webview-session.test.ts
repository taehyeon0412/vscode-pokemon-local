import { describe, expect, it } from 'vitest';
import { sampleSave } from '../../test/fixtures/save';
import { createGameState } from '../core/engine';
import type { WebviewToHost } from '../shared/messages';
import { WebviewSession } from './webview-session';

function make() {
  let now = 0;
  const sent: WebviewToHost[] = [];
  const s = new WebviewSession({ post: (m) => sent.push(m), now: () => now });
  const frames = (ms: number, dt = 16) => {
    for (let t = 0; t < ms; t += dt) {
      now += dt;
      s.frame(dt);
    }
  };
  return { s, sent, frames };
}

const start = (epoch = 1) => ({ command: 'game', type: 'start', epoch, state: createGameState(sampleSave({ playTimeMs: 0 }), 1) }) as const;

describe('웹뷰 세션', () => {
  it('맡기 전에는 계산도 보내기도 안 함', () => {
    const { s, sent, frames } = make();
    frames(2000);
    expect(s.running).toBe(false);
    expect(sent).toEqual([]);
  });

  it('판이 다른 세이브 (설치 뒤 다시 로드 전 — 옛 확장 + 새 웹뷰) 는 맡지 않고 load-failed 로 넘김 (2026-10-21 코드 리뷰어)', () => {
    const { s, sent, frames } = make();
    const old = start(5);
    s.handleMessage({ ...old, state: { ...old.state, save: { ...old.state.save, version: 1 as unknown as 2 } } });
    frames(2000);
    expect(s.running).toBe(false);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ type: 'load-failed' });
    expect((sent[0] as { message: string }).message).toContain('다시 로드');
  });

  it('맡으면 계산하고, 바뀐 상태를 1초에 한 번 보냄', () => {
    const { s, sent, frames } = make();
    s.handleMessage(start(4));
    frames(992);
    expect(sent).toEqual([]);
    frames(32);
    expect(sent).toHaveLength(1);
    const m = sent[0]!;
    expect(m.type === 'state' && m.epoch).toBe(4);
    expect(m.type === 'state' && m.state.save.playTimeMs).toBeGreaterThan(900);
  });

  it('숨으면 마지막 상태(hidden)를 넘기고 멈춤', () => {
    const { s, sent, frames } = make();
    s.handleMessage(start(2));
    frames(500);
    s.hide();
    const hidden = sent.at(-1)!;
    expect(hidden.type).toBe('hidden');
    expect(hidden.type === 'hidden' && hidden.state.save.playTimeMs).toBe(500);
    expect(s.running).toBe(false);
    frames(2000);
    expect(sent.at(-1)).toBe(hidden);
  });

  it('패널이 150px 아래로 접히면 hidden 으로 넘기고, 다시 높아지면 ready 로 최신 상태를 달라고 함 (바뀔 때만)', () => {
    const { s, sent, frames } = make();
    s.handleMessage(start(3));
    frames(300);
    s.setCollapsed(true, true);
    // 접혀서 넘길 때는 collapsed 표시 — 확장이 접힌 동안 다시 맡기지 않고 알림을 "올리면" 으로 (#297 · #299)
    expect(sent.at(-1)).toMatchObject({ type: 'hidden', epoch: 3, collapsed: true });
    expect(s.isCollapsed).toBe(true);
    expect(s.running).toBe(false);
    s.setCollapsed(true, true); // 창 크기를 바꾸는 동안 또 불려도 그대로
    expect(sent).toHaveLength(1);
    s.setCollapsed(false, true);
    expect(sent.at(-1)).toMatchObject({ type: 'ready' });
    s.setCollapsed(false, true);
    expect(sent).toHaveLength(2);
  });

  it('연출이 아직이면 (deps.hold) 그 걸음을 미룸 — 계산 · 보내기를 안 함 (2026-10-19)', () => {
    let holding = true;
    const sent: unknown[] = [];
    const s = new WebviewSession({ post: (m) => sent.push(m), now: () => 0, hold: () => holding });
    s.handleMessage(start(9));
    const before = s.current;
    s.frame(100);
    expect(s.current).toBe(before);
    holding = false;
    s.frame(100);
    expect(s.current).not.toBe(before);
  });

  it('그냥 안 보이게 될 때 (접힘이 아님) 의 hidden 에는 collapsed 가 없음', () => {
    const { s, sent } = make();
    s.handleMessage(start(4));
    s.hide();
    expect(sent.at(-1)).toMatchObject({ type: 'hidden', epoch: 4 });
    expect(sent.at(-1)).not.toHaveProperty('collapsed');
  });

  it('접힌 채로 안 보이게 됐다가 높아지면 ready 를 보내지 않음 (보일 때 visibilitychange 가 보냄) · 타이틀은 넘길 게 없음', () => {
    const { s, sent } = make();
    s.handleMessage(start(6));
    s.setCollapsed(true, true);
    s.setCollapsed(false, false);
    expect(sent.map((m) => m.type)).toEqual(['hidden']);
    const t = make();
    t.s.handleMessage({ command: 'game', type: 'title', info: { save: 'ok', busy: false, summary: null } });
    t.s.setCollapsed(true, true);
    t.s.setCollapsed(false, true);
    expect(t.sent).toEqual([]);
  });

  it('접힌 채로 start 를 받으면 계산하지 않고 바로 hidden 으로 돌려줌 (코드 리뷰어)', () => {
    const { s, sent, frames } = make();
    s.setCollapsed(true, true);
    expect(sent).toEqual([]); // 맡은 게임이 없으면 넘길 것도 없음
    s.handleMessage(start(7));
    expect(sent.at(-1)).toMatchObject({ type: 'hidden', epoch: 7 });
    expect(s.running).toBe(false);
    expect(s.screen).toBe('game');
    frames(2000);
    expect(sent).toHaveLength(1);
  });

  it('suspend (VS Code 밖 · 자동 전투 꺼짐) 이면 hidden 으로 마지막 상태를 넘기고 멈춤', () => {
    const { s, sent, frames } = make();
    s.handleMessage(start(5));
    frames(200);
    s.handleMessage({ command: 'game', type: 'suspend' });
    expect(sent.at(-1)).toMatchObject({ type: 'hidden', epoch: 5 });
    expect(s.running).toBe(false);
  });

  it('focus 로 VS Code 포커스를 받으면 다음 걸음부터 엔진에 away 로 넘김 (포커스가 없을 때 이로치 흔적 앞에서 멈추게 — 2026-10-19)', () => {
    const { s, frames } = make();
    s.handleMessage(start(5));
    frames(50);
    expect(s.current?.runtime.away).toBeFalsy();
    s.handleMessage({ command: 'game', type: 'focus', focused: false });
    frames(50);
    expect(s.current?.runtime.away).toBe(true);
    expect(s.running).toBe(true); // 계산은 그대로 웹뷰가
    s.handleMessage({ command: 'game', type: 'focus', focused: true });
    frames(50);
    expect(s.current?.runtime.away).toBe(false);
  });

  it('계산을 넘기면 (hidden) 화면에도 알림 — 멈춘 그림이 걷는 척 (배경 흐름 · 제자리걸음) 하지 않게 (테스터)', () => {
    const { s, frames } = make();
    s.handleMessage(start(5));
    frames(100);
    let changes = 0;
    let running: boolean | null = null;
    s.subscribe(() => {
      changes++;
      running = s.running;
    });
    s.handleMessage({ command: 'game', type: 'suspend' });
    expect(changes).toBe(1);
    expect(running).toBe(false);
    expect(s.current).not.toBeNull(); // 마지막 그림은 그대로 보임
  });

  it('다시 보이면 · 이미 불러온 game.js 에 load 가 오면 ready 로 상태를 달라고 함', () => {
    const { s, sent } = make();
    s.show();
    s.handleMessage({ command: 'game', type: 'load' });
    expect(sent.map((m) => m.type)).toEqual(['ready', 'ready']);
  });

  it('stop 이면 멈춤 · save-now 는 바로 보냄', () => {
    const { s, sent } = make();
    s.handleMessage(start());
    s.saveNow('catch');
    expect(sent.at(-1)).toMatchObject({ type: 'save-now', reason: 'catch', epoch: 1 });
    s.handleMessage({ command: 'game', type: 'stop' });
    expect(s.running).toBe(false);
    s.saveNow('catch');
    expect(sent).toHaveLength(1);
  });

  it('오래 멈췄다 온 프레임은 0.1초까지만 계산', () => {
    const { s } = make();
    s.handleMessage(start());
    s.frame(60_000);
    expect(s.current!.save.playTimeMs).toBe(100);
  });
});

describe('웹뷰 화면 고르기 (단계 3)', () => {
  const title = { command: 'game', type: 'title', info: { save: 'ok', busy: false, summary: null } } as const;

  it('title → 타이틀 화면 (계산은 안 맡음) · start → 게임 · stop → 일반 모드, 바뀔 때마다 알림', () => {
    const { s } = make();
    let changes = 0;
    s.subscribe(() => changes++);
    expect(s.screen).toBe('none');
    s.handleMessage(title);
    expect(s.screen).toBe('title');
    expect(s.title).toEqual(title.info);
    expect(s.running).toBe(false);
    s.handleMessage(start());
    expect(s.screen).toBe('game');
    expect(s.title).toBeNull();
    s.handleMessage({ command: 'game', type: 'stop' });
    expect(s.screen).toBe('none');
    expect(changes).toBe(3);
  });

  it('게임 중에 title 이 오면 계산을 놓음 (새 epoch 을 기다림)', () => {
    const { s, sent, frames } = make();
    s.handleMessage(start());
    s.handleMessage(title);
    frames(2000);
    expect(s.running).toBe(false);
    expect(sent).toEqual([]);
  });

  it('새로 하기 · 이어 하기', () => {
    const { s, sent } = make();
    const save = sampleSave();
    s.newGame(save);
    s.continueGame();
    expect(sent).toEqual([
      { command: 'game', type: 'title-new', save },
      { command: 'game', type: 'title-continue' },
    ]);
  });

  it('일반 모드로: 타이틀에서는 상태 없이, 게임 중이면 맡은 epoch · 마지막 상태와 함께', () => {
    const { s, sent, frames } = make();
    s.handleMessage(title);
    s.exit();
    expect(sent.at(-1)).toEqual({ command: 'game', type: 'exit', epoch: null, state: null });
    s.handleMessage(start(7));
    frames(500);
    s.exit();
    const m = sent.at(-1)!;
    expect(m).toMatchObject({ type: 'exit', epoch: 7 });
    expect(m.type === 'exit' && m.state?.save.playTimeMs).toBeGreaterThan(400);
  });

  it('구독을 끊으면 알리지 않음', () => {
    const { s } = make();
    let changes = 0;
    const off = s.subscribe(() => changes++);
    off();
    s.handleMessage(title);
    expect(changes).toBe(0);
  });
});
