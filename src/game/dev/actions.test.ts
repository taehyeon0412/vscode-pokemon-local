import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { advance, createGameState, readRuntime, type GameState } from '../core/engine';
import { validateSave, type Save } from '../core/save';
import { viaJson } from '../../test/fixtures/save';
import { createStartSave } from '../features/starter/model';
import { devApply, type DevAction, type DevScene } from './actions';
import { devDemoSave, devState } from './demo';
import { readDev } from './runtime';

function start(): GameState {
  const s0: Save = { ...createStartSave(0, 7, 4), location: { screen: 'stage', stageId: 'forest-1' } };
  return { ...createGameState(s0, 7), runtime: { ...createGameState(s0, 7).runtime, view: { w: 860, h: 187 } } };
}

const apply = (state: GameState, ...actions: DevAction[]) => actions.reduce((s, a) => devApply(s, a).state, state);
/** 셋 — 개발 메뉴로 팀 3마리 */
const three = (state: GameState) => apply(devState(state), { kind: 'mon', slot: 1, dex: 7, level: 20 }, { kind: 'mon', slot: 2, dex: 1, level: 20 });

describe('개발 모드 (임시) — 메뉴 동작', () => {
  it('개발 상태 = 진행 중 값에만 개발 값 (세이브는 그대로) · 시연 세이브는 셋 · 올바름', () => {
    const s = start();
    const on = devState(s);
    expect(on.runtime.dev).toBeTruthy();
    expect(on.save).toBe(s.save);
    const demo = devDemoSave(0, 3);
    expect(demo.party).toHaveLength(3);
    expect(validateSave(demo).ok).toBe(true);
  });

  it('장면 바로 가기 — 모두 올바른 세이브 · 다음 걸음도 그 장면에서 이어짐', () => {
    const scenes: DevScene[] = ['stage-1', 'stage-2', 'stage-3', 'beach-1', 'beach-2', 'beach-3', 'beach-gym', 'volcano-1', 'volcano-2', 'volcano-3', 'volcano-gym', 'wild', 'catch', 'evolve', 'rival', 'trainer-team', 'gym-team', 'gym-enter', 'lobby'];
    const want: Record<DevScene, string> = {
      'stage-1': 'walk',
      'stage-2': 'walk',
      'stage-3': 'walk',
      'beach-1': 'walk',
      'beach-2': 'walk',
      'beach-3': 'walk',
      'beach-gym': 'lobby',
      'volcano-1': 'walk',
      'volcano-2': 'walk',
      'volcano-3': 'walk',
      'volcano-gym': 'lobby',
      wild: 'appear',
      catch: 'battle',
      evolve: 'choice',
      rival: 'rival',
      'trainer-team': 'team',
      'gym-team': 'team',
      'gym-enter': 'gym-enter',
      lobby: 'lobby',
    };
    for (const sc of scenes) {
      const s = devApply(three(start()), { kind: 'scene', scene: sc });
      expect(validateSave(s.state.save).ok, sc).toBe(true);
      const next = advance(s.state, 50).state;
      expect(next.runtime.stage?.phase, `${sc}: ${s.say}`).toBe(want[sc]);
    }
    // 화산 미리 보기 = 해변까지 같이 열어 3번째 지역 (관장 에이스 = 레벨표 3번째 — orders #75) · 체육관은 화산 방
    const v = devApply(three(start()), { kind: 'scene', scene: 'volcano-gym' }).state;
    expect(v.save.regions.order).toEqual(['forest', 'beach', 'volcano']);
    expect(v.save.location).toEqual({ screen: 'gym', region: 'volcano' });
    const v2 = devApply(three(start()), { kind: 'scene', scene: 'volcano-2' });
    expect(v2.state.save.regions.order).toEqual(['forest', 'beach', 'volcano']);
    // 알림 번호도 새 순서로 (숲만 연 세이브에서 "2-2" 로 나오던 것 — 코드 리뷰어 · 테스터 #75)
    expect(v2.say).toBe('3-2 처음부터');
  });

  it('3:3 — 본편 스위치가 꺼져 있어도 개발 모드 3:3 이면 트레이너전이 3:3 · 3마리 미만이면 안 감', () => {
    const few = devApply(devState(start()), { kind: 'scene', scene: 'trainer-team' });
    expect(few.state.runtime.stage).toBeNull();
    expect(few.say).toContain('3마리');
    const s = devApply(three(start()), { kind: 'scene', scene: 'trainer-team' }).state;
    const st = s.runtime.stage;
    expect(st?.phase).toBe('team');
    if (st?.phase === 'team') expect(st.team.me).toHaveLength(3);
  });

  it('고른 상대 팀으로 관장 3:3 · 야생', () => {
    const s = apply(three(start()), { kind: 'foe', slot: 0, dex: 150, level: 50 }, { kind: 'foe', slot: 1, dex: 151, level: 50 }, { kind: 'foe', slot: 2, dex: 25, level: 30 });
    const gym = devApply(s, { kind: 'scene', scene: 'gym-team' }).state.runtime.stage;
    expect(gym?.phase === 'team' && gym.team.foe.map((f) => f.species)).toEqual([150, 151, 25]);
    const wild = devApply(s, { kind: 'scene', scene: 'wild' }).state;
    expect(wild.save.pendingEncounter?.kind === 'wild' && wild.save.pendingEncounter.monster.species).toBe(150);
  });

  it('팀 만들기 · 레벨 · 필살기 고르기 · 빼기', () => {
    let s = three(start());
    expect(s.save.party).toHaveLength(3);
    const uid = s.save.party[1]!;
    s = apply(s, { kind: 'level', uid, level: 77 }, { kind: 'ult', uid, name: '하이드로캐논' });
    expect(s.save.monsters[uid]!.level).toBe(77);
    expect(s.runtime.dev?.ults[uid]).toBe('하이드로캐논');
    s = apply(s, { kind: 'mon', slot: 1, dex: 25, level: 10 });
    expect(s.save.monsters[uid]).toBeUndefined();
    expect(s.runtime.dev?.ults[uid]).toBeUndefined();
    s = apply(s, { kind: 'mon-remove', slot: 2 }, { kind: 'mon-remove', slot: 1 }, { kind: 'mon-remove', slot: 0 });
    expect(s.save.party).toHaveLength(1);
    expect(validateSave(s.save).ok).toBe(true);
  });

  it('상태 바꾸기 — 전투 중 게이지 가득 · HP 1 · 회복 · 돈 · 볼 · 진화 직전', () => {
    let s = devApply(three(start()), { kind: 'scene', scene: 'trainer-team' }).state;
    s = apply(s, { kind: 'gauge-full' }, { kind: 'hp1', side: 'foe' });
    // 상대 필살기 가득 (기획 R11 — 예고 "!" · 맞받아치기 시험)
    const foeFull = devApply(s, { kind: 'gauge-full', side: 'foe' });
    expect(foeFull.say).toBe('상대 필살기 가득');
    const fb = foeFull.state.runtime.stage;
    expect(fb?.phase === 'battle' ? fb.battle.foe.ult : fb?.phase === 'team' ? fb.team.foe.every((f) => f.hp <= 0 || f.ult >= 1) : null).toBeTruthy();
    const st = s.runtime.stage;
    expect(st?.phase === 'team' && st.team.me.every((f) => f.ult === 1)).toBe(true);
    expect(st?.phase === 'team' && st.team.ultReadyAt.me.every((t) => t !== null)).toBe(true);
    expect(st?.phase === 'team' && st.team.foe.every((f) => f.hp === 1)).toBe(true);
    const money = s.save.money;
    s = apply(s, { kind: 'money' }, { kind: 'balls' }, { kind: 'items' });
    expect(s.save.money).toBe(money + 10_000);
    expect(s.save.bag['ultra-ball']).toBeGreaterThanOrEqual(10);
    // 파이리 (4) 는 16 에 진화 — 15 · 경험치 거의 참
    const pre = devApply(start(), { kind: 'pre-evolve' });
    const lead = pre.state.save.monsters[pre.state.save.party[0]!]!;
    expect(lead.level).toBe(15);
    expect(validateSave(pre.state.save).ok).toBe(true);
  });

  it('속도 — 걷기 배가 실제 걸음을 빠르게 · 전투 배 · 멈춤 돌아가며', () => {
    const base = devApply(three(start()), { kind: 'scene', scene: 'stage-1' }).state;
    const slow = advance(base, 1000).state;
    const fast = advance(apply(base, { kind: 'walk' }), 1000).state;
    expect(fast.save.stages['forest-1']!.progress).toBeGreaterThan(slow.save.stages['forest-1']!.progress * 3);
    const s = apply(base, { kind: 'battle-speed' }, { kind: 'battle-speed' }, { kind: 'pause' });
    expect(s.runtime.dev?.battle).toBe(0.25);
    expect(s.runtime.dev?.pause).toBe(true);
  });

  it('넘기기 (확장 ↔ 웹뷰) 에서 개발 값이 남고 이상한 값은 걸러짐', () => {
    const s = apply(three(start()), { kind: 'walk' }, { kind: 'foe', slot: 0, dex: 25, level: 5 });
    const back = readRuntime(JSON.parse(JSON.stringify(s.runtime)), 1);
    expect(back.dev?.walk).toBe(4);
    expect(back.dev?.foes).toEqual([{ dex: 25, level: 5 }]);
    expect(readDev({ walk: 999, battle: 3, foes: [{ dex: 99999, level: 5 }, 'x'], ults: { a: 5 } })).toEqual({ team: true, walk: 1, battle: 1, pause: false, foes: [], ults: {} });
  });
});

describe('해변 미리 보기 — 4판 연 지역 (orders #30)', () => {
  it('해변 장면은 연 지역에 해변을 더함 · 세이브 검사 (안 볼 때 확장이 받는 상태) 를 지나도 해변에 그대로', () => {
    for (const sc of ['beach-2', 'beach-gym'] as const) {
      const s = devApply(start(), { kind: 'scene', scene: sc }).state;
      expect(s.save.regions.order).toEqual(['forest', 'beach']);
      const checked = validateSave(viaJson(s.save));
      expect(checked.ok && checked.save.location).toEqual(s.save.location);
    }
  });
});

describe('개발 메뉴 알림 줄인 말 (U514 — 아래 줄은 늘 한 줄 · 넘치면 알림마다 손으로 쓴 짧은 말)', () => {
  it('긴 알림만 짧은 말이 있고 더 짧음 · 상대 여럿은 마릿수 (첫 " · " 자르기가 꼬부기를 몰래 떨구던 것)', () => {
    const s = three(start());
    const foes = apply(s, { kind: 'foe', slot: 0, dex: 4, level: 20 });
    const r = devApply(foes, { kind: 'foe', slot: 1, dex: 7, level: 20 });
    expect(r.say).toBe('상대 파이리 Lv 20 · 꼬부기 Lv 20');
    expect(r.short).toBe('상대 2마리 Lv 20');
    const mixed = devApply(r.state, { kind: 'foe', slot: 2, dex: 1, level: 30 });
    expect(mixed.say).toBe('상대 파이리 Lv 20 · 꼬부기 Lv 20 · 이상해씨 Lv 30');
    expect(mixed.short).toBe('상대 3마리');
    const one = devApply(s, { kind: 'foe', slot: 0, dex: 4, level: 20 });
    expect(one.short).toBeUndefined();
    const lonely = devApply(apply(devState(start())), { kind: 'scene', scene: 'trainer-team' });
    expect(lonely.say).toContain('3:3 은 살아 있는');
    expect(lonely.short).toBe('3마리 필요 — 팀 탭');
    for (const x of [r, mixed, lonely]) expect(x.short!.length).toBeLessThan(x.say.length);
  });

  it('짧은 말은 알림에 실려 다시 불러와도 남음 (readRuntime) · 이상한 값은 버림', () => {
    const s = start();
    const rt = viaJson({ ...s.runtime, toast: { text: '개발 — 돈 +10000 → 10500', ms: 1000, short: '돈 +10000' } });
    expect(readRuntime(rt, 1)?.toast).toMatchObject({ short: '돈 +10000' });
    const bad = viaJson({ ...s.runtime, toast: { text: 'a', ms: 1000, short: 3 } });
    expect(readRuntime(bad, 1)?.toast).not.toHaveProperty('short');
  });

  it('[개발 끝내기] 는 넘쳐도 숨기지 않음 (판이 열린 동안 알림이 안 사라져 판 내내 숨던 것 — U514 UX 큼)', () => {
    const css = readFileSync(join(__dirname, 'dev.css'), 'utf8');
    const hide = [...css.matchAll(/([^{}]+)\{[^}]*display:\s*none/g)].map((m) => m[1]!);
    expect(hide.filter((sel) => sel.includes('.pg-dev-end'))).toEqual([]);
    const panel = readFileSync(join(__dirname, 'DevPanel.tsx'), 'utf8');
    expect(panel).toContain('pg-dev-end');
    expect(panel).not.toContain('pg-dev-foot-3');
  });
});
