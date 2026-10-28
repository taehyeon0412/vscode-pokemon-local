import { describe, expect, it } from 'vitest';
import { sampleMonster, sampleSave, viaJson } from '../../../test/fixtures/save';
import { BALANCE, TIMING } from '../balance';
import { release, releaseWarns, releaseWhy } from '../rules/bag';
import { readSave, type Save } from '../save';
import { applyInput, canRelease, teamLock } from './play';
import { createGameState, type GameState, type StageRuntime } from './state';

/** 팀 m1 (선두 이상해씨 Lv 5) · m2 (캐터피 Lv 3) + 보관함 m3 (뿔충이 Lv 4) */
const withBox = (o: Partial<Save> = {}): Save => {
  const s = sampleSave();
  return { ...s, monsters: { ...s.monsters, m3: sampleMonster({ uid: 'm3', species: 13, form: 'weedle', level: 4, caughtAt: 'forest-1' }) }, box: ['m3'], nextMonsterUid: 4, dex: { seen: [1, 10, 13], caught: [1, 10, 13] }, ...o };
};
function game(save: Save, stage: StageRuntime | null = { phase: 'walk' }): GameState {
  const s = createGameState(save, 7);
  return { ...s, runtime: { ...s.runtime, stage, stageId: 'forest-1' } };
}

describe('S18 ⑥ 놓아주기 (#121 — 2026-10-28 태현 님 "포켓몬 방출이나 놓아주기 이런게 없네")', () => {
  it('팀 · 보관함 둘 다 놓을 수 있음 — 세이브에서 지우고 도감 "잡은 적 있음" 은 남음 · 보상 없음', () => {
    const s = withBox();
    const fromBox = release(s, 'm3')!;
    expect(fromBox.box).toEqual([]);
    expect(fromBox.monsters.m3).toBeUndefined();
    expect(fromBox.dex.caught).toContain(13);
    expect(fromBox.money).toBe(s.money);
    expect(fromBox.bag).toEqual(s.bag);
    const fromTeam = release(s, 'm2')!;
    expect(fromTeam.party).toEqual(['m1']);
    expect(fromTeam.monsters.m2).toBeUndefined();
    expect(fromTeam.dex.caught).toContain(10);
    expect(s.monsters.m2).toBeDefined(); // 원래 세이브는 그대로
  });

  it('선두를 놓으면 다음 칸이 선두', () => {
    const s = withBox();
    expect(release(s, 'm1')!.party).toEqual(['m2']);
  });

  it('못 놓음 셋 — 팀 마지막 한 마리 · 놓으면 팀에 HP 남은 포켓몬이 없음 · 없는 포켓몬 (까닭 한 줄은 엔진이)', () => {
    const one = withBox({ party: ['m1'], box: ['m2', 'm3'] });
    expect(releaseWhy(one, 'm1')).toBe('팀의 마지막 한 마리는 놓아줄 수 없어요');
    expect(release(one, 'm1')).toBeNull();
    // 보관함은 팀이 한 마리여도 놓을 수 있음
    expect(releaseWhy(one, 'm3')).toBeNull();
    const s = withBox();
    const fainted = { ...s, monsters: { ...s.monsters, m2: { ...s.monsters.m2!, hp: 0 } } };
    expect(releaseWhy(fainted, 'm1')).toBe('놓으면 팀에 싸울 수 있는 포켓몬이 없어요');
    expect(release(fainted, 'm1')).toBeNull();
    // 쓰러진 쪽을 놓는 건 됨
    expect(release(fainted, 'm2')!.party).toEqual(['m1']);
    expect(releaseWhy(s, 'm9')).toBe('없는 포켓몬이에요');
  });

  it('놓은 포켓몬을 가리키던 남은 고르기 (진화 · 기술 · 쌓아 둔 기술) 도 지움', () => {
    const s = withBox({
      pendingChoices: [{ kind: 'learn', uid: 'm2', moveId: 75 }, { kind: 'learn', uid: 'm1', moveId: 75 }],
      laterChoices: [{ kind: 'learn', uid: 'm2', moveId: 22 }],
    });
    const r = release(s, 'm2')!;
    expect(r.pendingChoices).toEqual([{ kind: 'learn', uid: 'm1', moveId: 75 }]);
    expect(r.laterChoices).toEqual([]);
    // 칸이 없던 옛 세이브는 칸을 만들지 않음 (고친 세이브로 다시 써지지 않게)
    expect('laterChoices' in release(withBox(), 'm3')!).toBe(false);
  });

  it('한 번 더 물을 까닭 — 이로치 · ★5 · 높은 Lv [임시값] (팀 Lv 15 이상 · 보관함은 가장 높은 Lv 와 5 차이 안)', () => {
    const s = withBox();
    expect(releaseWarns(s, 'm2')).toEqual([]);
    const shiny = { ...s, monsters: { ...s.monsters, m2: { ...s.monsters.m2!, shiny: true } } };
    expect(releaseWarns(shiny, 'm2')).toEqual(['shiny']);
    const best = { ...s, monsters: { ...s.monsters, m3: { ...s.monsters.m3!, ivs: { hp: 31, attack: 31, defense: 31, speed: 31, ultimate: 31 } } } };
    expect(releaseWarns(best, 'm3')).toEqual(['star5']);
    // 낮은 판의 선두 Lv 5 는 아님
    expect(releaseWarns(s, 'm1')).toEqual([]);
    const { minLevel, nearTop } = BALANCE.releaseHigh;
    const lv = (n: number, top: number) => ({ ...s, monsters: { ...s.monsters, m1: { ...s.monsters.m1!, level: top }, m2: { ...s.monsters.m2!, level: n }, m3: { ...s.monsters.m3!, level: n } } });
    // 팀 (m2) 은 Lv 15 이상이면 · 혼자 높은 선두 Lv 60 이 있어도 Lv 50 주전은 물음
    expect(releaseWarns(lv(minLevel, minLevel), 'm2')).toEqual(['high']);
    expect(releaseWarns(lv(50, 60), 'm2')).toEqual(['high']);
    expect(releaseWarns(lv(minLevel - 1, 60), 'm2')).toEqual([]);
    // 보관함 (m3) 은 가장 높은 Lv 와 5 차이 안만
    expect(releaseWarns(lv(55, 60), 'm3')).toEqual(['high']);
    expect(releaseWarns(lv(60 - nearTop - 1, 60), 'm3')).toEqual([]);
  });

  it('엔진 — 걷는 중 · 대기실 · 병원에서 됨 (알림 줄은 안 씀 — 판이 그림) · 전투 · 만남 · 진화 고르기 중엔 안 됨', () => {
    const walk = game(withBox());
    const out = applyInput(walk, { kind: 'release', uid: 'm3' });
    expect(out.save.box).toEqual([]);
    expect(out.runtime.toast).toBe(walk.runtime.toast);
    expect(canRelease(walk)).toBe(true);
    for (const st of [{ phase: 'trainer', n: 0, ms: 0 }, { phase: 'appear', ms: 0 }, { phase: 'choice', ms: 0 }] as StageRuntime[]) {
      const g = game(withBox(), st);
      expect(canRelease(g)).toBe(false);
      expect(applyInput(g, { kind: 'release', uid: 'm3' })).toBe(g);
    }
    // 못 놓는 포켓몬은 그대로 (알림 없음)
    const one = game(withBox({ party: ['m1'], box: ['m2', 'm3'] }));
    expect(applyInput(one, { kind: 'release', uid: 'm1' })).toBe(one);
  });

  it('대기실 3마리 고르기에 든 포켓몬을 놓으면 고른 칸에서도 빠짐 · 3마리 아래면 3:3 잠김 (few) → 고르기 판을 닫음 (도전 Enter = 1:1 — 코드 리뷰어)', () => {
    const third = sampleMonster({ uid: 'm3', species: 13, form: 'weedle', level: 4 });
    const s = withBox({ monsters: { ...withBox().monsters, m3: third }, party: ['m1', 'm2', 'm3'], box: [], location: { screen: 'gym' } });
    const g = { ...game(s, { phase: 'lobby', picking: true, pick: ['m1', 'm2', 'm3'] }), runtime: { ...game(s).runtime, stage: { phase: 'lobby', picking: true, pick: ['m1', 'm2', 'm3'] } as StageRuntime, stageId: null, view: { w: 860, h: 187 } } };
    expect(teamLock(g)).toBeNull();
    const out = applyInput(g, { kind: 'release', uid: 'm2' });
    expect(out.runtime.stage).toEqual({ phase: 'lobby', pick: ['m1', 'm3'] });
    expect(teamLock(out)).toBe('few');
  });

  it('놓은 뒤 남는 장면 값 (코드 리뷰어) — 앞 알림을 그대로 둠 · 잡은 소개 카드 건너뜀 · 3:3 패배 상자 남은 수', () => {
    // 앞 알림 (오늘의 목표 ✓ 등) 은 손대지 않음 — 여럿 놓아도 밀려나지 않음 (디자인 UX 리뷰어 #121)
    const busy = game(withBox({ monsters: { ...withBox().monsters, m4: { ...withBox().monsters.m3!, uid: 'm4' } }, box: ['m3', 'm4'] }));
    const goal = { text: '오늘의 목표 ✓ 포켓몬 3마리 잡기', ms: 1000 };
    const withToast = { ...busy, runtime: { ...busy.runtime, toast: goal } };
    const twice = applyInput(applyInput(withToast, { kind: 'release', uid: 'm3' }), { kind: 'release', uid: 'm4' });
    expect(twice.save.box).toEqual([]);
    expect(twice.runtime.toast).toEqual(goal);
    // 방금 잡은 포켓몬을 소개 카드 중에 놓음 → 소개를 건너뜀
    const summary = { title: '', exp: [], money: 0, item: null, caught: { name: '뿔충이', toBox: true, uid: 'm3', isNew: true }, learned: [], choices: 0, badge: null };
    const intro = game(withBox(), { phase: 'result', ms: 100, summary } as StageRuntime);
    const after = applyInput(intro, { kind: 'release', uid: 'm3' }).runtime.stage;
    expect(after?.phase === 'result' && after.ms).toBe(TIMING.caughtIntroMs);
    // 3:3 두 번째 패배 상자 — 남은 (싸울 수 있는) 수
    const lost = game(withBox(), { phase: 'defeat', gym: false, lost: 100, keep: '소율', left: 2 });
    const d = applyInput(lost, { kind: 'release', uid: 'm2' }).runtime.stage;
    expect(d?.phase === 'defeat' && d.left).toBe(1);
  });

  it('놓은 뒤 세이브를 다시 불러와도 그대로 (고친 곳 없음 — 보관함으로 되살아나지 않음)', () => {
    const r = release(withBox(), 'm2')!;
    const back = readSave(viaJson(r));
    expect(back.kind).toBe('ok');
    if (back.kind !== 'ok') return;
    expect(back.problems).toEqual([]);
    expect(back.save.monsters.m2).toBeUndefined();
    expect(back.save.party).toEqual(['m1']);
    expect(back.save.box).toEqual(['m3']);
  });
});
