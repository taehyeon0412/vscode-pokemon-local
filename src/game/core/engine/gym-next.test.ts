import { describe, expect, it } from 'vitest';
import { sampleSave, viaJson } from '../../../test/fixtures/save';
import { TIMING } from '../balance';
import type { Save, StageProgress } from '../save';
import { AGAIN_WON_TOAST, applyInput, badgeAutoHeld, gymNext, step } from './play';
import { createGameState, readRuntime, type GameState, type StageRuntime } from './state';

const run0 = { startMs: 0, caught: 0, trainers: 0, seen: [], reach: 0, retries: 0 };
const cleared = (): StageProgress => ({ seed: 1, progress: 1, cleared: true, defeatedTrainers: [], facilities: [], run: { ...run0 } });
/** 숲 체육관 — 숲 깸 · 해변 열림 (안 깸) */
const gymSave = (o: Partial<Save> = {}): Save =>
  sampleSave({ location: { screen: 'gym' }, badges: ['forest'], regions: { order: ['forest', 'beach'] }, stages: { 'forest-1': cleared(), 'forest-2': cleared(), 'forest-3': cleared() }, ...o });
function at(save: Save, stage: StageRuntime | null = { phase: 'badge' }): GameState {
  const s = createGameState(save, 7);
  return { ...s, runtime: { ...s.runtime, stage, stageId: null } };
}
const where = (g: GameState) => (g.save.location.screen === 'stage' ? g.save.location.stageId : g.save.location.screen);
const auto = (s: Save): Save => ({ ...s, settings: { ...s.settings, autoBattle: true } });

describe('관장을 이긴 뒤 바로 다음 지역 (#127 — 태현 님 "세계지도를 눌러서 가야되서 불편한것 같아")', () => {
  it('다음 = 안 깬 연 지역의 안 깬 첫 스테이지 · 그 지역을 다 깼으면 그 체육관 · 다 깼으면 지도', () => {
    expect(gymNext(at(gymSave()))).toEqual({ kind: 'go', region: 'beach', to: 'beach-1' });
    expect(gymNext(at(gymSave({ stages: { ...gymSave().stages, 'beach-1': cleared() } })))).toEqual({ kind: 'go', region: 'beach', to: 'beach-2' });
    const allBeach = { ...gymSave().stages, 'beach-1': cleared(), 'beach-2': cleared(), 'beach-3': cleared() };
    expect(gymNext(at(gymSave({ stages: allBeach })))).toEqual({ kind: 'go', region: 'beach', to: 'gym' });
    expect(gymNext(at(gymSave({ badges: ['forest', 'beach', 'volcano'], regions: { order: ['forest', 'beach', 'volcano'] } })))).toEqual({ kind: 'map' });
  });

  it('카드 Enter = 바로 출발 (그 지역 1-1 새 판) · 체육관으로도 · 다 깼으면 아무 일 없음 (화면이 지도)', () => {
    const go = applyInput(at(gymSave()), { kind: 'badge-next' });
    expect(where(go)).toBe('beach-1');
    expect(go.runtime.stageId).toBe('beach-1');
    // 도착 한 줄 (어디로 왔는지 — 디자인 UX 리뷰어)
    expect(go.runtime.toast?.text).toBe('해변 2-1 도착!');
    const allBeach = { ...gymSave().stages, 'beach-1': cleared(), 'beach-2': cleared(), 'beach-3': cleared() };
    const toGym = applyInput(at(gymSave({ stages: allBeach })), { kind: 'badge-next' });
    expect(toGym.save.location).toEqual({ screen: 'gym', region: 'beach' });
    const done = at(gymSave({ badges: ['forest', 'beach', 'volcano'], regions: { order: ['forest', 'beach', 'volcano'] } }));
    expect(applyInput(done, { kind: 'badge-next' })).toBe(done);
    // 카드가 아니면 안 받음
    const lobby = at(gymSave(), { phase: 'lobby' });
    expect(applyInput(lobby, { kind: 'badge-next' })).toBe(lobby);
    // [대기실에 남기]
    expect(applyInput(at(gymSave()), { kind: 'badge-continue' }).runtime.stage).toEqual({ phase: 'lobby' });
  });

  it('남은 곳 둘 고르기 — 카드에서 바로 고르면 연 지역에 더하고 출발 · 고르지 않으면 첫째 (상성 좋은 쪽)', () => {
    const pick = gymSave({ regions: { order: ['forest'], next: ['beach', 'volcano'] } });
    const n = gymNext(at(pick));
    expect(n.kind).toBe('pick');
    expect(n.kind === 'pick' && [...n.regions].sort()).toEqual(['beach', 'volcano']);
    const v = applyInput(at(pick), { kind: 'badge-next', region: 'volcano' });
    expect(where(v)).toBe('volcano-1');
    expect(v.save.regions).toEqual({ order: ['forest', 'volcano'] });
    const first = applyInput(at(pick), { kind: 'badge-next' });
    expect(where(first)).toBe(`${n.kind === 'pick' ? n.regions[0] : ''}-1`);
    // 고를 곳이 아닌 지역은 첫째로
    expect(where(applyInput(at(pick), { kind: 'badge-next', region: 'forest' }))).toBe(where(first));
  });

  it('다시 이긴 관장 (배지 없음) 도 같은 카드 — 결과 뒤 again 카드 · 웹뷰와 주고받아도 남음', () => {
    const summary = { title: '관장 나래를 이겼다!', exp: [], money: 300, item: null, caught: null, learned: [], choices: 0, badge: null };
    const res = at(gymSave(), { phase: 'result', summary, ms: TIMING.resultMs, then: 'again' });
    const card = applyInput(res, { kind: 'result-continue' });
    expect(card.runtime.stage).toEqual({ phase: 'badge', again: true });
    const back = readRuntime(viaJson({ ...card.runtime, stage: { phase: 'badge', again: true, ms: 1200 } }), 1);
    expect(back.stage).toEqual({ phase: 'badge', again: true, ms: 1200 });
    expect(where(applyInput(card, { kind: 'badge-next' }))).toBe('beach-1');
  });

  it('자동 전투면 10초 뒤 다음 지역 — 첫 승 카드는 보는 동안만 셈 (밖 · 숨김이면 기다림) · 자동이 아니면 기다림 · 다 깼으면 기다림', () => {
    const run = (g: GameState, ms: number) => {
      let s = g;
      for (let t = 0; t < ms; t += TIMING.simStepMs) s = step(s, TIMING.simStepMs).state;
      return s;
    };
    expect(where(run(at(auto(gymSave())), TIMING.badgeAutoMs - 500))).toBe('gym');
    expect(where(run(at(auto(gymSave())), TIMING.badgeAutoMs + 500))).toBe('beach-1');
    const away = at(auto(gymSave()));
    expect(run({ ...away, runtime: { ...away.runtime, away: true } }, TIMING.badgeAutoMs + 2000).runtime.stage?.phase).toBe('badge');
    expect(run({ ...away, runtime: { ...away.runtime, headless: true } }, TIMING.badgeAutoMs + 2000).runtime.stage?.phase).toBe('badge');
    expect(run(at(gymSave()), TIMING.badgeAutoMs + 2000).runtime.stage?.phase).toBe('badge');
    const done = at(auto(gymSave({ badges: ['forest', 'beach', 'volcano'], regions: { order: ['forest', 'beach', 'volcano'] } })));
    expect(run(done, TIMING.badgeAutoMs + 2000).runtime.stage?.phase).toBe('badge');
    // 다시 이긴 관장 카드는 자동이면 10초 뒤 대기실 (되풀이 키우기가 다음 지역으로 끌려가지 않게 — 코드 리뷰어) · 버튼은 그대로 다음 지역
    const again = run(at(auto(gymSave()), { phase: 'badge', again: true }), TIMING.badgeAutoMs + 500);
    expect([where(again), again.runtime.stage?.phase]).toEqual(['gym', 'lobby']);
    // 다 깼어도 다시 이김은 대기실로 (지도를 기다리며 끝없이 서 있던 것 — UX #127 마지막 바퀴)
    const againDone = run(at(auto(gymSave({ badges: ['forest', 'beach', 'volcano'], regions: { order: ['forest', 'beach', 'volcano'] } })), { phase: 'badge', again: true }), TIMING.badgeAutoMs + 500);
    expect([where(againDone), againDone.runtime.stage?.phase]).toEqual(['gym', 'lobby']);
  });

  it('다시 이긴 카드는 밖에서도 10초를 셈 → 대기실 · 숨김이면 멈춤 · 첫 승 카드는 밖이면 멈춤 그대로 · 다 깬 뒤도 (#130 — 태현 님 "추천대로")', () => {
    const run = (g: GameState, ms: number) => {
      let s = g;
      for (let t = 0; t < ms; t += TIMING.simStepMs) s = step(s, TIMING.simStepMs).state;
      return s;
    };
    const look = (g: GameState, o: { away?: boolean; headless?: boolean }): GameState => ({ ...g, runtime: { ...g.runtime, ...o } });
    const again = at(auto(gymSave()), { phase: 'badge', again: true });
    // 밖 — 10초 전엔 카드 · 10초 뒤 대기실
    expect(run(look(again, { away: true }), TIMING.badgeAutoMs - 500).runtime.stage?.phase).toBe('badge');
    const out = run(look(again, { away: true }), TIMING.badgeAutoMs + 500);
    expect([where(out), out.runtime.stage?.phase]).toEqual(['gym', 'lobby']);
    // 돌아와 보면 대기실 첫 알림 "관장을 또 이겼어요" (ideas 1651) — 밖에 있는 동안은 셈 안 함 · 보는 동안 2.5초 · 보고 있었으면 안 띄움 (카드를 봤으니)
    expect(out.runtime.toast?.text).toBe(AGAIN_WON_TOAST);
    expect(run(out, 3000).runtime.toast?.text).toBe(AGAIN_WON_TOAST);
    expect(run(look(out, { away: false }), TIMING.toastMs + 200).runtime.toast?.text).not.toBe(AGAIN_WON_TOAST);
    expect(run(again, TIMING.badgeAutoMs + 500).runtime.toast?.text).not.toBe(AGAIN_WON_TOAST);
    // 숨김 (접힘 · 다른 탭) 은 멈춤 — 밖이면서 숨김이어도
    expect(run(look(again, { headless: true }), TIMING.badgeAutoMs + 2000).runtime.stage).toEqual({ phase: 'badge', again: true });
    expect(run(look(again, { away: true, headless: true }), TIMING.badgeAutoMs + 2000).runtime.stage?.phase).toBe('badge');
    // 첫 승 카드는 보는 동안만 그대로 (배지 · 제목을 놓치지 않게)
    const first = at(auto(gymSave()));
    expect(run(look(first, { away: true }), TIMING.badgeAutoMs + 2000).runtime.stage).toEqual({ phase: 'badge' });
    // 다 깬 뒤 다시 이김도 밖에서 대기실로
    const done = at(auto(gymSave({ badges: ['forest', 'beach', 'volcano'], regions: { order: ['forest', 'beach', 'volcano'] } })), { phase: 'badge', again: true });
    expect(run(look(done, { away: true }), TIMING.badgeAutoMs + 500).runtime.stage?.phase).toBe('lobby');
    // 칩 (FieldBoxes "멈춤") 과 엔진이 같은 판단
    expect([badgeAutoHeld({ headless: false }, true), badgeAutoHeld({ headless: false, away: true }, true), badgeAutoHeld({ headless: true }, true)]).toEqual([false, false, true]);
    expect([badgeAutoHeld({ headless: false }, false), badgeAutoHeld({ headless: false, away: true }, false), badgeAutoHeld({ headless: true }, false)]).toEqual([false, true, true]);
  });

  it('고르기에서 출발하면 "다음 지역을 골라요" 알림은 지움 (새 지역에 가서 뜨지 않게)', () => {
    const pick = at(gymSave({ regions: { order: ['forest'], next: ['beach', 'volcano'] } }));
    const withToast = { ...pick, runtime: { ...pick.runtime, toast: { text: '다음 지역을 골라요', ms: TIMING.toastMs } } };
    const out = applyInput(withToast, { kind: 'badge-next', region: 'beach' });
    expect(where(out)).toBe('beach-1');
    expect([out.runtime.toast?.text, out.runtime.toast?.then].flat()).not.toContain('다음 지역을 골라요');
  });
});
