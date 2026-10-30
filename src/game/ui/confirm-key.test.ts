import { describe, expect, it } from 'vitest';
import { STAGE_PHASES, type StageRuntime } from '../core/engine';
import { TIMING } from '../core/balance';
import { confirmKey, enterBoxKey, noteSpace, SPACE_BOX_MIN_MS, SPACE_RUN_GAP_MS, spaceAsEnter } from './confirm-key';

const SPACE = { key: ' ', code: 'Space', repeat: false };
const ENTER = { key: 'Enter', code: 'Enter', repeat: false, timeStamp: 0 };
// 창 capture 가 적은 뒤 상자가 보는 것과 같은 차례 — 적고 바로 물음 (shownAt = 상자가 뜬 때)
const press = (at: number, shownAt = -Infinity, repeat = false) => {
  noteSpace(repeat, at);
  return confirmKey({ ...SPACE, repeat, timeStamp: at }, shownAt);
};

describe('Enter 자리의 Space (#117 — 태현 님 "스페이스를 눌러도 작동 되게")', () => {
  it('Enter 는 늘 (상자가 막 떠도) · 한 번 누른 Space 도 Enter 처럼', () => {
    expect(confirmKey(ENTER, 0)).toBe(true);
    expect(press(10_000)).toBe(true);
    expect(confirmKey({ key: 'Escape', code: 'Escape', repeat: false, timeStamp: 10_100 })).toBe(false);
  });

  it('힘대결 연타 → 결과 → 다음 상자: 연타가 이어지는 동안은 상자를 안 누름 · 멈췄다 누르면 됨', () => {
    // 0.12초마다 연타 (힘대결) — 결과 상자가 22초에 떠도 그 뒤 연타는 Enter 가 아님 (상자가 1초 넘게 보인 뒤에도)
    let t = 20_000;
    const box = 22_000;
    expect(press(t)).toBe(true); // 묶음 첫 누름 (힘대결 중이라 main.ts 는 연타로 씀)
    const after: boolean[] = [];
    for (let i = 1; i <= 30; i++) after.push(press((t += 120), box));
    expect(after.every((x) => !x)).toBe(true);
    // 손을 떼고 0.4초 넘게 쉰 뒤 한 번 = 계속
    expect(press((t += SPACE_RUN_GAP_MS + 100), box)).toBe(true);
  });

  it('상자가 뜬 지 1초 안의 Space 는 아님 (U1 — 체육관 들어가기를 넘긴 뒤 대기실 · 진화했다!)', () => {
    const box = 50_000;
    expect(press(box + 500, box)).toBe(false);
    // 0.4초 넘게 쉬었어도 상자가 1초를 못 채웠으면 아님
    expect(press(box + 500 + SPACE_RUN_GAP_MS + 1, box)).toBe(false);
    expect(press(box + SPACE_BOX_MIN_MS + SPACE_RUN_GAP_MS + 100, box)).toBe(true);
    // 다음 상자가 뜨자마자 또 = 1초 안 → 안 누름
    const next = box + 1500;
    expect(press(next + 600, next)).toBe(false);
    expect(press(next + SPACE_BOX_MIN_MS + 100, next)).toBe(true);
  });

  it('꾹 누른 Space (repeat) 는 Enter 가 아니고 묶음을 이음', () => {
    let t = 70_000;
    expect(press(t)).toBe(true);
    for (let i = 0; i < 10; i++) expect(press((t += 33), -Infinity, true)).toBe(false);
    // 뗀 뒤 바로 다시 누름 = 같은 묶음
    expect(press((t += 200))).toBe(false);
    expect(press((t += 1000))).toBe(true);
  });

  it('Space 가 Enter 처럼 되는 길 위 상자 = 따로 뜻이 없는 곳만 (막기 · 연타 · VS · 진화 보기 · 넘기기는 그대로)', () => {
    const asEnter = STAGE_PHASES.filter((p) => spaceAsEnter(p));
    expect([...asEnter].sort()).toEqual(['badge', 'clear', 'defeat', 'facility', 'lobby', 'request', 'result']);
    // 전투 (패링 · 힘대결 연타 · 잡기 타이밍) · 3:3 · 트레이너 · 라이벌 (VS 넘기기) · 진화 (보기 · 넘기기) · 체육관 들어가기 (넘기기)
    for (const p of ['battle', 'team', 'trainer', 'rival', 'choice', 'gym-enter', 'appear', 'walk', 'hold'] as const) expect(spaceAsEnter(p)).toBe(false);
    expect(spaceAsEnter(undefined)).toBe(false);
  });

  it('상자 경계 — 병원 앞 → 안 · 대기실 → 3마리 고르기 · 잡은 소개 → 결과 상자에서 "뜬 때" 를 다시 셈', () => {
    const front: StageRuntime = { phase: 'facility', kind: 'hospital', at: 0.5, ms: 0, inside: false };
    expect(enterBoxKey(front)).not.toBe(enterBoxKey({ ...front, inside: true }));
    // 시간이 흘러도 같은 상자
    expect(enterBoxKey(front)).toBe(enterBoxKey({ ...front, ms: 3000 }));
    expect(enterBoxKey({ phase: 'lobby' })).not.toBe(enterBoxKey({ phase: 'lobby', picking: true }));
    const summary = { title: '', exp: [], money: 0, item: null, caught: { name: '파이리', toBox: false, uid: 'm3', isNew: true }, learned: [], choices: 0 };
    const intro = { phase: 'result', ms: 0, summary } as unknown as StageRuntime;
    const box = { phase: 'result', ms: TIMING.caughtIntroMs, summary } as unknown as StageRuntime;
    expect(enterBoxKey(intro)).not.toBe(enterBoxKey(box));
    // Space 가 따로 뜻인 장면은 상자 없음
    expect(enterBoxKey({ phase: 'walk' })).toBe('');
    expect(enterBoxKey(null)).toBe('');
  });

  it('S04 칩 줄 끝 탭을 마우스로 누른 뒤도 1초는 Space 결정 아님 (ideas 1646 — StarterPick 은 뜬 때 · 탭 누른 때 중 늦은 것을 넘김) · Enter 는 그대로', () => {
    const shown = 980_000;
    const tab = shown + 5000;
    expect(press(tab + 600, Math.max(shown, tab))).toBe(false);
    expect(press(tab + SPACE_BOX_MIN_MS + SPACE_RUN_GAP_MS + 100, Math.max(shown, tab))).toBe(true);
    expect(confirmKey({ ...ENTER, timeStamp: tab + 100 }, Math.max(shown, tab))).toBe(true);
  });
});
