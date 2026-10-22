/** 라이벌 (gdd 4.12 · mvp-spec 3.10 — 2026-10-19 태현 님) — 누가 · 팀 · 보상 · 전적 · 자리 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sampleMonster, sampleSave, viaJson } from '../../../test/fixtures/save';
import { BALANCE } from '../balance';
import { Rng } from '../engine/rng';
import { validateSave } from '../save';
import { counterStarter, pickRival, recordText, rivalItem, rivalName, rivalPartner, rivalRecord, rivalTeam, rivalTeamSize, withRivalResult } from './rival';
import { stageLayout } from './stage';

const STONES = ['fire-stone', 'water-stone', 'thunder-stone', 'leaf-stone', 'moon-stone'];
const met = (rivals: Record<string, { wins: number; losses: number }>) => sampleSave({ rivals });

describe('누가 나오나 — 내가 고르지 않은 7명 중 가장 덜 만난 라이벌', () => {
  it('처음엔 S03 순서의 첫 사람 (나는 빼고) · 이름 "라이벌 ○○" · 전적 글자', () => {
    expect(pickRival(sampleSave({ player: { gender: 'female', look: 'girl' } }))).toBe('boy');
    expect(pickRival(sampleSave({ player: { gender: 'male', look: 'boy' } }))).toBe('blue');
    expect(rivalName('brendan')).toBe('라이벌 휘웅');
    expect(recordText({ wins: 2, losses: 1 })).toBe('전적 2승 1패');
  });

  it('만난 수 (이김 + 짐) 가 가장 적은 사람 — 7명을 고르게 다 만남', () => {
    let save = sampleSave({ player: { gender: 'male', look: 'brendan' } });
    const seen: string[] = [];
    for (let i = 0; i < 14; i++) {
      const r = pickRival(save)!;
      seen.push(r);
      save = withRivalResult(save, r, i % 3 === 0);
    }
    expect(seen).not.toContain('brendan');
    expect(new Set(seen.slice(0, 7)).size).toBe(7);
    expect(new Set(seen.slice(7)).size).toBe(7);
    expect(pickRival(met({ boy: { wins: 3, losses: 0 }, blue: { wins: 0, losses: 1 } }))).toBe('brendan');
  });

  it('전적 더하기 · 옛 세이브 (칸 없음) 는 0승 0패', () => {
    const old = sampleSave();
    expect(old.rivals).toBeUndefined();
    expect(rivalRecord(old, 'boy')).toEqual({ wins: 0, losses: 0 });
    const s = withRivalResult(withRivalResult(withRivalResult(old, 'boy', true), 'boy', false), 'may', false);
    expect(s.rivals).toEqual({ boy: { wins: 1, losses: 1 }, may: { wins: 0, losses: 1 } });
  });
});

describe('팀 — 1 → 3마리 · 에이스 = 파트너 · 레벨 = 내 팀 가장 높은 레벨', () => {
  // 5.2 초안을 켠 본편은 라이벌 마릿수 = 몇 번째 지역 (draft52.test) — 여기는 끄고 예전 전적 규칙 (1 → 3마리) 을 봄
  const draft52 = BALANCE.draft52 as { rivalByRegion: boolean };
  beforeEach(() => {
    draft52.rivalByRegion = false;
  });
  afterEach(() => {
    draft52.rivalByRegion = true;
  });

  it('처음 1마리, 만날 때마다 +1, 최대 3, 살아 있는 내 포켓몬 + 1 까지', () => {
    expect(rivalTeamSize(sampleSave(), 'boy')).toBe(1);
    expect(rivalTeamSize(met({ boy: { wins: 1, losses: 0 } }), 'boy')).toBe(2);
    expect(rivalTeamSize(met({ boy: { wins: 2, losses: 5 } }), 'boy')).toBe(3);
    const alone = sampleSave({ party: ['m1'], rivals: { boy: { wins: 4, losses: 0 } } });
    expect(rivalTeamSize(alone, 'boy')).toBe(2);
  });

  it('에이스는 맨 끝 · 레벨 = 내 팀 최고, 앞은 2 낮게 (최소 2) · 같은 시드면 같은 팀', () => {
    const save = sampleSave({ monsters: { m1: sampleMonster({ level: 12 }), m2: sampleMonster({ uid: 'm2', species: 10, form: 'caterpie', level: 7, caughtAt: 'forest-1' }) }, rivals: { brendan: { wins: 1, losses: 1 } } });
    const team = rivalTeam(save, 'brendan', 'forest-1', 42);
    expect(team).toHaveLength(3);
    expect(team[2]!.species).toBe(252); // 나무지기 (16 전이라 그대로)
    expect(team[2]!.level).toBe(12);
    expect(team.slice(0, 2).map((m) => m.level)).toEqual([12 - BALANCE.rivalLevelGap, 12 - BALANCE.rivalLevelGap]);
    expect(team.map((m) => m.uid)).toEqual(['foe0', 'foe1', 'foe2']);
    expect(viaJson(rivalTeam(save, 'brendan', 'forest-1', 42))).toEqual(viaJson(team));
    const low = rivalTeam(sampleSave({ monsters: { m1: sampleMonster({ level: 2 }) }, party: ['m1'], rivals: { boy: { wins: 1, losses: 0 } } }), 'boy', 'forest-1', 42);
    expect(low.map((m) => m.level)).toEqual([2, 2]);
  });

  it('진화 레벨을 넘으면 진화형 — 휘웅 레벨 20 = 나무돌이', () => {
    const save = sampleSave({ monsters: { m1: sampleMonster({ level: 20 }) }, party: ['m1'] });
    expect(rivalTeam(save, 'brendan', 'forest-1', 1)[0]!.species).toBe(253);
  });

  it('파트너 — 라이벌마다 다름, 그린만 내 스타팅에 상성 유리 + 에이스 앞 이브이', () => {
    const starter = (species: number, form: string) => sampleSave({ monsters: { m1: sampleMonster({ species, form }) }, party: ['m1'] });
    expect(counterStarter(starter(1, 'bulbasaur'))).toBe(4); // 풀 → 파이리
    expect(counterStarter(starter(4, 'charmander'))).toBe(7); // 불꽃 → 꼬부기
    expect(counterStarter(starter(7, 'squirtle'))).toBe(1); // 물 → 이상해씨
    expect(counterStarter(starter(25, 'pikachu'))).toBe(133);
    const s = sampleSave();
    expect(['boy', 'brendan', 'wally', 'girl', 'may', 'may-rs', 'leaf-em'].map((id) => rivalPartner(s, id))).toEqual([25, 252, 280, 1, 255, 258, 7]);
    const blue = rivalTeam(sampleSave({ rivals: { blue: { wins: 1, losses: 1 } } }), 'blue', 'forest-1', 9);
    expect(blue.map((m) => m.species).slice(1)).toEqual([133, 4]);
    // 스타팅이 풀 · 불꽃 · 물이 아니라 에이스가 이브이면 둘째는 숲 포켓몬 (이브이 둘 아님 — 테스터)
    const pidgey = sampleSave({ monsters: { m1: sampleMonster({ species: 16, form: 'pidgey', caughtAt: 'forest-1' }) }, party: ['m1'], rivals: { blue: { wins: 1, losses: 1 } } });
    const evee = rivalTeam(pidgey, 'blue', 'forest-1', 9).map((m) => m.species);
    expect(evee.at(-1)).toBe(133);
    expect(evee.filter((d) => d === 133)).toHaveLength(1);
  });
});

describe('이기면 받는 아이템 — 트레이너 (돈만) 보다 좋게', () => {
  it('그 라이벌을 처음 이기면 진화의 돌 (5종 중)', () => {
    const got = new Set<string>();
    for (let seed = 1; seed < 200; seed++) got.add(rivalItem(sampleSave(), 'boy', new Rng(seed)));
    expect([...got].sort()).toEqual([...STONES].sort());
  });

  it('두 번째부터는 비율대로 — 슈퍼볼 · 하이퍼볼 · 좋은상처약 · 기력의조각 · 만병통치제 · 가끔 진화의 돌', () => {
    const save = met({ boy: { wins: 1, losses: 0 } });
    const n = 4000;
    const count: Record<string, number> = {};
    for (let seed = 1; seed <= n; seed++) {
      const it = rivalItem(save, 'boy', new Rng(seed));
      const k = STONES.includes(it) ? 'stone' : it;
      count[k] = (count[k] ?? 0) + 1;
    }
    for (const [k, p] of Object.entries(BALANCE.rivalItems)) expect(Math.abs((count[k] ?? 0) / n - p)).toBeLessThan(0.03);
    expect(Object.values(BALANCE.rivalItems).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
});

describe('자리 — 판마다 rivalChance 로 1번, 다른 자리는 그대로', () => {
  it('비율 · 범위 · 다른 자리와 떨어짐 · 같은 시드면 같은 자리', () => {
    let have = 0;
    const N = 600;
    for (let seed = 1; seed <= N; seed++) {
      const spots = stageLayout('forest-2', seed).spots;
      const r = spots.filter((s) => s.kind === 'rival');
      expect(r.length).toBeLessThanOrEqual(1);
      if (!r[0]) continue;
      have++;
      const at = r[0].at;
      expect(at).toBeGreaterThanOrEqual(BALANCE.rivalSpotRange[0]);
      expect(at).toBeLessThanOrEqual(BALANCE.rivalSpotRange[1]);
      for (const o of spots) if (o !== r[0]) expect(Math.abs(o.at - at)).toBeGreaterThanOrEqual(BALANCE.rivalGap - 1e-9);
      expect(stageLayout('forest-2', seed).spots.find((s) => s.kind === 'rival')?.at).toBe(at);
    }
    expect(Math.abs(have / N - BALANCE.rivalChance)).toBeLessThan(0.08);
  });
});

describe('세이브 — rivals 칸', () => {
  it('있으면 그대로 · 모르는 라이벌 · 이상한 수는 고쳐서 · 없으면 칸을 만들지 않음 (옛 세이브를 다시 쓰지 않게)', () => {
    const ok = validateSave(viaJson(met({ boy: { wins: 2, losses: 1 } })));
    expect(ok.ok && ok.save.rivals).toEqual({ boy: { wins: 2, losses: 1 } });
    expect(ok.ok && ok.problems).toEqual([]);
    const bad = validateSave(viaJson({ ...sampleSave(), rivals: { boy: { wins: -3, losses: 'x' }, nobody: { wins: 1, losses: 1 } } }));
    expect(bad.ok && bad.save.rivals).toEqual({ boy: { wins: 0, losses: 0 } });
    expect(bad.ok && bad.problems.length).toBeGreaterThan(0);
    // 라이벌을 만난 채 껐다 켜도 (pendingEncounter) 그대로 · 모르는 라이벌이면 버림 (코드 리뷰어)
    const meeting = validateSave(viaJson(sampleSave({ pendingEncounter: { kind: 'rival', rival: 'may', stageId: 'forest-1' } })));
    expect(meeting.ok && meeting.save.pendingEncounter).toEqual({ kind: 'rival', rival: 'may', stageId: 'forest-1' });
    expect(meeting.ok && meeting.problems).toEqual([]);
    const nobody = validateSave(viaJson({ ...sampleSave(), pendingEncounter: { kind: 'rival', rival: 'nobody', stageId: 'forest-1' } }));
    expect(nobody.ok && nobody.save.pendingEncounter).toBeNull();
    const old = validateSave(viaJson(sampleSave()));
    expect(old.ok && 'rivals' in old.save).toBe(false);
    expect(old.ok && old.problems).toEqual([]);
  });
});
