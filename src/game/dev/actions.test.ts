import { describe, expect, it } from 'vitest';
import { advance, createGameState, readRuntime, type GameState } from '../core/engine';
import { validateSave, type Save } from '../core/save';
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
    const scenes: DevScene[] = ['stage-1', 'stage-2', 'stage-3', 'beach-1', 'beach-2', 'beach-3', 'beach-gym', 'wild', 'catch', 'evolve', 'rival', 'trainer-team', 'gym-team', 'gym-enter', 'lobby'];
    const want: Record<DevScene, string> = {
      'stage-1': 'walk',
      'stage-2': 'walk',
      'stage-3': 'walk',
      'beach-1': 'walk',
      'beach-2': 'walk',
      'beach-3': 'walk',
      'beach-gym': 'lobby',
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
