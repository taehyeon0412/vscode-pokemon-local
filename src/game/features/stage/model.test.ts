import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sampleSave, viaJson } from '../../../test/fixtures/save';
import { BALANCE, TIMING } from '../../core/balance';
import { createGameState, readRuntime, type GameState } from '../../core/engine';
import { pickRival } from '../../core/rules/rival';
import { stageLayout } from '../../core/rules/stage';
import { setRegionOrder } from '../../core/rules/region';
import { heroLookOf } from '../../data/heroes';
import { STAGE_IDS, TIPS_MAX } from '../../core/save';
import { summaryLines } from '../result/model';
import { badgeAutoLeft, evoTipItems, BATTLE_STAGE_MAX_PX, battleStage, CONTACT_PX, contactX, foldStatus, foeTrainerView, gymEnterView, gymFrontX, heroX, holdRivalLook, minimapOf, rivalTag, STAGES, sceneBackground, stageLabel, stagePx, stageViewKey, TEAM_ARENA, teamScene, visibleObjects, WALK_PX_PER_SEC } from './model';

function at(progress: number, stage: GameState['runtime']['stage'] = { phase: 'walk' }): GameState {
  const s = createGameState(sampleSave({ stages: { 'forest-1': { seed: 42, progress, cleared: false, defeatedTrainers: [], facilities: [], run: { startMs: 0, caught: 0, trainers: 0, seen: [], reach: 0, retries: 0 } } } }), 1);
  return { ...s, runtime: { ...s.runtime, stage } };
}
const layout = stageLayout('forest-1', 42);

describe('스테이지 이름표', () => {
  it('세이브의 스테이지 id 마다 이름이 있음', () => {
    for (const id of STAGE_IDS) expect(STAGES[id].id).toBe(id);
  });

  it('미니맵 모양: "🌲 새싹 오솔길 (1-1)" (gdd S06 ②)', () => {
    expect(stageLabel('forest-1')).toBe('새싹 오솔길 (1-1)');
  });
});

describe('길 위의 것들을 화면에', () => {
  it('스테이지 길이 = 걷는 시간 (20분) × 걷는 빠르기 × 크기 배율', () => {
    expect(stagePx(1)).toBe((BALANCE.stageWalkMs / 1000) * WALK_PX_PER_SEC);
    expect(stagePx(2)).toBe(stagePx(1) * 2);
  });

  it('만날 자리가 주인공 앞 (만나는 거리) 에 왔을 때 = 진행 % 가 그 자리', () => {
    const spot = layout.spots[0]!;
    const objs = visibleObjects(at(spot.at - 0.0001), 720, 1);
    const o = objs.find((x) => x.key.endsWith(String(spot.index)) && x.kind !== 'scenery' && x.kind !== 'facility')!;
    expect(o.x).toBeCloseTo(heroX(720) + CONTACT_PX + 0.0001 * stagePx(1), 3);
  });

  it('화면 밖 (멀리 앞 · 한참 뒤) 은 안 그림 · 왼쪽부터 정렬', () => {
    const objs = visibleObjects(at(0.5), 720, 1);
    for (const o of objs) {
      expect(o.x).toBeGreaterThan(-80);
      expect(o.x).toBeLessThan(800);
    }
    expect(objs.map((o) => o.x)).toEqual([...objs.map((o) => o.x)].sort((a, b) => a - b));
  });

  it('지나간 아이템 · 야생은 사라짐 · 만난 야생은 튀어나온 동안만 보임', () => {
    const wild = layout.spots.find((s) => s.kind === 'wild')!;
    const before = visibleObjects(at(wild.at - 0.0001), 720, 1).find((o) => o.key === `w${wild.index}`);
    expect(before).toMatchObject({ kind: 'wild', met: false });
    const meeting = visibleObjects(at(wild.at, { phase: 'appear', ms: 0, isNew: true }), 720, 1).find((o) => o.key === `w${wild.index}`);
    expect(meeting).toMatchObject({ kind: 'wild', met: true });
    expect(visibleObjects(at(wild.at + 0.0001), 720, 1).find((o) => o.key === `w${wild.index}`)).toBeUndefined();
    const item = layout.spots.find((s) => s.kind === 'item')!;
    expect(visibleObjects(at(item.at + 0.0001), 720, 1).find((o) => o.key === `i${item.index}`)).toBeUndefined();
  });

  it('부탁하던 사람은 지나간 뒤에도 화면 밖으로 나갈 때까지 보임 · 지금 부탁 중이면 active', () => {
    const req = layout.spots.find((s) => s.kind === 'request')!;
    const active = visibleObjects(at(req.at - 1e-7, { phase: 'request', at: req.at, number: 0, result: null, ms: 0 }), 720, 1).find((o) => o.key === `r${req.index}`);
    expect(active).toMatchObject({ kind: 'request', active: true });
    expect(visibleObjects(at(req.at + 0.001), 720, 1).find((o) => o.key === `r${req.index}`)).toMatchObject({ active: false });
  });

  it('미니맵: 진행 % · 시설 자리 (체육관은 1-3 에만)', () => {
    expect(minimapOf(at(0.37))).toEqual({ progress: 0.37, facilities: layout.facilities, gym: false });
  });
});

describe('S08 · S09 상대 볼 개수 (단계 9 테스터)', () => {
  it('상대가 쓰러진 순간 (다음 포켓몬을 내보내는 중) 에도 전부 = 처음 마릿수, 남은 것만 줄어듦', async () => {
    const { startTrainerBattle } = await import('../../core/engine/battle');
    const { foeTrainerView } = await import('./model');
    const { sampleMonster, sampleSave } = await import('../../../test/fixtures/save');
    const { createGameState } = await import('../../core/engine');
    const save = sampleSave({ pendingEncounter: { kind: 'trainer', trainerId: 'forest-1:t0', stageId: 'forest-1' } });
    const foe = (uid: string) => sampleMonster({ uid, species: 10, form: 'caterpie', level: 3 });
    const b0 = startTrainerBattle(save, [foe('a'), foe('b')], 'trainer', 't');
    const view = (b: typeof b0) => {
      const s = createGameState(save, 1);
      return foeTrainerView({ ...s, runtime: { ...s.runtime, stage: { phase: 'battle', battle: b }, stageId: 'forest-1' } });
    };
    expect(view(b0)).toMatchObject({ balls: 2, left: 2 });
    const down = { ...b0, phase: 'send' as const, foe: { ...b0.foe, hp: 0 }, foeDown: [{ species: 10, level: 3 }] };
    expect(view(down)).toMatchObject({ balls: 2, left: 1 });
  });
});

describe('라이벌 (gdd 4.12) — 띠 · 결과 보이기', () => {
  // 5.2 초안을 켠 본편은 라이벌 마릿수 = 몇 번째 지역 (draft52.test) — 여기는 끄고 예전 전적 규칙 (1 → 3마리) 을 봄
  const draft52 = BALANCE.draft52 as { rivalByRegion: boolean };
  beforeEach(() => {
    draft52.rivalByRegion = false;
  });
  afterEach(() => {
    draft52.rivalByRegion = true;
  });

  it('띠의 전적 칩 — 처음이면 "첫 만남!", 그 뒤 "전적 W승 L패" · 이름 · 볼 수 · "!" 뒤 띠', () => {
    expect(rivalTag(sampleSave(), 'boy')).toBe('첫 만남!');
    expect(rivalTag(sampleSave({ rivals: { boy: { wins: 0, losses: 1 } } }), 'boy')).toBe('전적 0승 1패');
    const meet = (ms: number): GameState => {
      const s = at(0.4, { phase: 'rival', rival: 'may', ms });
      return { ...s, save: { ...s.save, rivals: { may: { wins: 2, losses: 1 } }, pendingEncounter: { kind: 'rival', rival: 'may', stageId: 'forest-1' } } };
    };
    expect(foeTrainerView(meet(0))).toMatchObject({ name: '라이벌 지민', record: '전적 2승 1패', balls: 3, talking: false }); // 3마리 = min(3, 만난 수 + 1, 살아 있는 2 + 1)
    expect(foeTrainerView(meet(TIMING.trainerAlertMs))?.talking).toBe(true);
  });

  it('밖에서 멈춘 라이벌 기다림 — 길 끝 그림자 = 다시 보면 나올 그 라이벌 그림 (ideas #154) · 다른 장면은 없음', () => {
    const s = at(0.4, { phase: 'hold', why: 'rival' });
    // sampleSave 주인공 = 남자 · 처음 만남 → 가장 덜 만난 첫 라이벌 (pickRival)
    expect(holdRivalLook(s)).toBe(heroLookOf(pickRival(s.save) ?? undefined).dir);
    expect(holdRivalLook(s)).not.toBeNull();
    expect(holdRivalLook(at(0.4, { phase: 'hold', why: 'shiny' }))).toBeNull();
    expect(holdRivalLook(at(0.4, { phase: 'rival', rival: 'may', ms: 0 }))).toBeNull();
  });

  it('길 위에 미리 안 보임 (깜짝 등장)', () => {
    for (let seed = 1; seed < 200; seed++) {
      const rival = stageLayout('forest-1', seed).spots.find((x) => x.kind === 'rival');
      if (!rival) continue;
      const s = createGameState(sampleSave({ stages: { 'forest-1': { seed, progress: rival.at - 0.002, cleared: false, defeatedTrainers: [], facilities: [], run: { startMs: 0, caught: 0, trainers: 0, seen: [], reach: 0, retries: 0 } } } }), 1);
      expect(visibleObjects({ ...s, runtime: { ...s.runtime, stage: { phase: 'walk' } } }, 720, 1).some((o) => o.key.endsWith(String(rival.index)))).toBe(false);
      return;
    }
    throw new Error('라이벌 자리가 있는 시드가 없음');
  });

  it('이긴 결과 — 한마디는 둘째 줄 맨 끝 (좁은 패널에서 레벨업이 먼저)', () => {
    const lines = summaryLines({ title: '라이벌 레드와의 승부에서 이겼다!', exp: [{ uid: 'm1', name: '이상해씨', gain: 64, from: 5, to: 6 }], money: 180, item: '불꽃의돌', caught: null, learned: [], choices: 0, badge: null, quote: '레드: 다음엔 꼭 이길 거야! (전적 1승 0패)', rival: true });
    expect(lines.title).toBe('라이벌 레드와의 승부에서 이겼다!');
    expect(lines.head).toEqual([
      { kind: 'money', text: '+180원' },
      { kind: 'item', text: '불꽃의돌' },
    ]);
    expect(lines.body).toEqual([
      { kind: 'up', text: '이상해씨 Lv 5 → 6 (경험치 +64)' },
      { kind: 'quote', text: '레드: 다음엔 꼭 이길 거야! (전적 1승 0패)' },
    ]);
  });
});

describe('전투 무대 (battleStage, 2026-10-19)', () => {
  it('무대보다 좁거나 같은 패널은 패널 전체', () => {
    expect(battleStage(360)).toEqual({ left: 0, width: 360 });
    expect(battleStage(BATTLE_STAGE_MAX_PX)).toEqual({ left: 0, width: BATTLE_STAGE_MAX_PX });
  });

  it('넓은 패널은 720 무대를 패널 가운데에 — 무대 안 주인공 자리 = 걷던 자리 (1858 → 569 ~ 1289, 태현 님 "왼쪽으로 치우쳐 보여")', () => {
    const s = battleStage(1858);
    expect(s).toEqual({ left: heroX(1858) - heroX(720), width: 720 });
    expect(s.left).toBe(569);
    for (const w of [721, 900, 1200, 1858, 2400]) {
      const st = battleStage(w);
      expect(Math.abs(st.left * 2 + st.width - w)).toBeLessThanOrEqual(1);
    }
  });

  it('걷는 주인공 자리는 720 에서 이어짐 (좁은 패널 45% 그대로)', () => {
    expect(heroX(720)).toBe(324);
    expect(heroX(721)).toBe(325);
    expect(heroX(360)).toBe(162);
  });

  it('야생은 튀어나온 자리 그대로 싸움 (무대 안 만난 자리 + 무대 왼쪽 끝 = 패널의 만난 자리)', () => {
    for (const w of [800, 1200, 1858]) {
      for (const scale of [1, 2, 2.5]) {
        const s = battleStage(w);
        expect(s.left + contactX(s.width, scale)).toBe(contactX(w, scale));
      }
    }
  });
});

describe('1-3 끝 체육관 들어가기 (2026-10-20 태현 님 A안)', () => {
  it('장면 시간표 — 문 옆까지 걸음 0.6초 · 문 열림 3장 0.6 ~ 1.4 · 문 안으로 세 걸음 흐려짐 · 2초부터 닦기 · 엔진 시간 (gymEnterMs) 안에 끝남', () => {
    expect(gymEnterView(0)).toMatchObject({ walk: 0, enter: 0, door: 0, fade: 1, wipe: 0, walking: true });
    expect(gymEnterView(600)).toMatchObject({ walk: 1, door: 1, walking: false });
    expect(gymEnterView(1000).door).toBe(2);
    expect(gymEnterView(1300)).toMatchObject({ door: 3, enter: 0, fade: 1 });
    expect(gymEnterView(1500)).toMatchObject({ enter: 1 / 3, walking: true });
    expect(gymEnterView(1900)).toMatchObject({ enter: 1, fade: 0, wipe: 0 });
    expect(gymEnterView(2200).wipe).toBeGreaterThan(0);
    expect(gymEnterView(TIMING.gymEnterMs).wipe).toBe(1);
    // 걸음 수를 화면이 정함 (U506) — 3걸음이면 반 걸음 앞당겨 0.1 · 0.3 · 0.5초 · 끝은 늘 1
    expect(gymEnterView(99, 3).walk).toBe(0);
    expect(gymEnterView(100, 3).walk).toBeCloseTo(1 / 3);
    expect(gymEnterView(250, 3).walk).toBeCloseTo(1 / 3);
    expect(gymEnterView(500, 3).walk).toBe(1);
    expect(gymEnterView(600, 3).walk).toBe(1);
    expect(gymEnterView(100, 0).walk).toBe(0);
  });

  it('체육관 건물은 1-3 에서만 · 길 끝에 가까울 때만 보임 (멀면 null)', () => {
    const s3 = (progress: number): GameState => {
      const base = at(0);
      return { ...base, save: { ...base.save, location: { screen: 'stage', stageId: 'forest-3' }, stages: { 'forest-3': { ...base.save.stages['forest-1']!, progress } } } };
    };
    expect(gymFrontX(at(1), 1860, 2)).toBeNull();
    expect(gymFrontX(s3(0.5), 1860, 2)).toBeNull();
    const end = gymFrontX(s3(1), 1860, 2);
    expect(end).toBe(heroX(1860) + 40 * 2);
    // 좁고 높은 패널 (240, 배율 3) — 문 오른쪽 끝이 패널 안 (8px 여백)
    const narrow = gymFrontX(s3(1), 240, 3)!;
    expect(narrow + 8 * 3).toBeLessThanOrEqual(240 - 8);
  });

  it('장면이 한 걸음 바뀔 때마다 다시 그림 (stageViewKey) — 빠지면 장면 내내 서 있다가 대기실로 바뀜', () => {
    const base = at(0);
    const g = (ms: number): GameState => ({
      ...base,
      save: { ...base.save, location: { screen: 'stage', stageId: 'forest-3' }, stages: { 'forest-3': { ...base.save.stages['forest-1']!, progress: 1 } } },
      runtime: { ...base.runtime, stage: { phase: 'gym-enter', ms } },
    });
    const keys = [0, 300, 700, 1000, 1300, 1500, 1900, 2200].map((ms) => stageViewKey(g(ms)));
    expect(new Set(keys).size).toBe(keys.length);
    // 같은 걸음 안에서는 안 그림 (PC 부담)
    expect(stageViewKey(g(610))).toBe(stageViewKey(g(650)));
    // 걷는 동안은 0.05초마다 — 걸음 수가 몇이든 걸음 경계 (4걸음 = 0.075 · 0.225 …) 를 한 장면 안에 그림 (U506 작음 2)
    expect(stageViewKey(g(60))).not.toBe(stageViewKey(g(110)));
  });
});

describe('접힌 줄 (gdd 4.13 R13 ② — 기다리는 장면 · 자동 전투)', () => {
  it('기다리는 장면이면 그 장면 + "▲ 올리면 이어서"', () => {
    // 할 일 먼저 · 어디는 끝 · 구분점은 앞 낱말에 붙음 (줄이 "·" 로 시작하지 않게)
    expect(foldStatus(at(0.35, { phase: 'hold', why: 'shiny' }))).toBe('반짝이는 흔적에서 기다려요\u00a0· ▲\u00a0올리면 이어서\u00a0· 새싹\u00a0오솔길\u00a035%');
    expect(foldStatus(at(0.35, { phase: 'hold', why: 'rival' }))).toContain('라이벌이 길에서 기다려요');
    // 두 번째 3:3 패배 상자 = 직함 뺀 이름 (좁은 줄 — R8 A)
    expect(foldStatus(at(0.47, { phase: 'defeat', gym: false, lost: 100, keep: '엘리트 트레이너 소율' }))).toBe('소율에게 졌다 — 남은 포켓몬으로 계속\u00a0· ▲\u00a0올리면 이어서\u00a0· 새싹\u00a0오솔길\u00a047%');
  });

  it('자동 전투 꺼짐 = 접혀 있는 동안 전부 멈춤 (예전 "전투가 나오면 멈춰요" 는 틀림 — gdd 4.13)', () => {
    const off = at(0.47);
    const s = { ...off, save: { ...off.save, settings: { ...off.save.settings, autoBattle: false } } };
    expect(foldStatus(s)).toBe('자동 전투 꺼짐 — 접혀 있는 동안 멈춰 있어요\u00a0· ▲\u00a0올려서 자동 전투를 켜면 계속 걸어요\u00a0· 새싹\u00a0오솔길\u00a047%');
    const on = { ...off, save: { ...off.save, settings: { ...off.save.settings, autoBattle: true } } };
    expect(foldStatus(on)).toBe('자동 전투 켜짐 — 전투도 저절로\u00a0· ▲\u00a0올리면 보여요\u00a0· 새싹\u00a0오솔길\u00a047%');
  });
});

describe('다시 그리는 열쇠 — 보는 상태 (UX 리뷰어 R12 재확인)', () => {
  it('밖 · 숨김 앞뒤로 열쇠가 바뀜 (대기실처럼 멈춘 장면에서 돌아와도 처음 안내가 다시 셈)', () => {
    const lobby = at(0.47, { phase: 'lobby' });
    const k0 = stageViewKey(lobby);
    const away = { ...lobby, runtime: { ...lobby.runtime, away: true } };
    const hidden = { ...lobby, runtime: { ...lobby.runtime, headless: true } };
    expect(stageViewKey(away)).not.toBe(k0);
    expect(stageViewKey(hidden)).not.toBe(k0);
    expect(stageViewKey({ ...away, runtime: { ...away.runtime, away: false } })).toBe(k0);
  });
});

describe('이름표 번호 — 지역 순서를 따라감 (코드 리뷰어 #66 — 모듈을 읽을 때 한 번 세어 늘 2-x 이던 것)', () => {
  it('STAGES.code · stageLabel 이 지금 지역 순서로', () => {
    try {
      setRegionOrder(['forest', 'cave', 'beach'] as never);
      expect(STAGES['beach-1'].code).toBe('3-1');
      expect(stageLabel('beach-2')).toContain('3-2');
    } finally {
      setRegionOrder(null);
    }
    expect(STAGES['beach-1'].code).toBe('2-1');
    expect(STAGES['forest-3'].code).toBe('1-3');
  });
});

describe('3:3 판 배경 (태현 님 #78 — 시합장)', () => {
  it('지역마다 (#78 — 숲 A · 해변 E · 화산 B 틀) · 그 지역 그림이 들어오기 전은 길 배경 그대로 · 길에서는 스테이지 배경', () => {
    const s = createGameState(sampleSave(), 1);
    const team = { ...s, runtime: { ...s.runtime, stage: { phase: 'team' } as never } };
    expect(sceneBackground(s)).toBe('forest');
    expect(sceneBackground(team)).toBe(TEAM_ARENA.forest ?? 'forest');
    const arena = TEAM_ARENA as Record<string, string | undefined>;
    const was = arena.forest;
    arena.forest = 'arena-forest';
    try {
      expect(sceneBackground(team)).toBe('arena-forest');
      expect(sceneBackground(s)).toBe('forest');
    } finally {
      if (was === undefined) delete arena.forest;
      else arena.forest = was;
    }
  });

  it('ideas 713 — 길에서 3:3 으로 이긴 결과 상자 동안은 3:3 장면 그대로 (시합장 · 물건 · 주인공 숨김) · 1:1 결과 · 체육관 결과 · 걷기는 아님 · 넘기기에도 남음', () => {
    const s = createGameState(sampleSave(), 1);
    const result = (team: boolean): GameState => ({ ...s, runtime: { ...s.runtime, stage: { phase: 'result', ms: 0, summary: { title: '', exp: [], money: 0, item: null, caught: null, learned: [], choices: 0, badge: null, ...(team ? { team: true } : {}) } } } });
    expect(teamScene({ ...s, runtime: { ...s.runtime, stage: { phase: 'team' } as never } })).toBe(true);
    expect(teamScene(result(true))).toBe(true);
    expect(sceneBackground(result(true))).toBe(sceneBackground({ ...s, runtime: { ...s.runtime, stage: { phase: 'team' } as never } }));
    expect(teamScene(result(false))).toBe(false);
    expect(teamScene(s)).toBe(false);
    const gym = result(true);
    expect(teamScene({ ...gym, save: { ...gym.save, location: { screen: 'gym' } } })).toBe(false);
    const back = readRuntime(viaJson(result(true).runtime), 1).stage;
    expect(back?.phase === 'result' && back.summary.team).toBe(true);
  });
});

describe('관장 카드 자동 남은 초 (#127 UX 큼 — 칩이 1초에 처음 생겨 카드가 튀던 것)', () => {
  const run0 = { startMs: 0, caught: 0, trainers: 0, seen: [], reach: 0, retries: 0 };
  const cleared = () => ({ seed: 1, progress: 1, cleared: true, defeatedTrainers: [], facilities: [], run: { ...run0 } });
  const card = (ms: number | undefined, o: { auto?: boolean; all?: boolean } = {}): GameState => {
    const base = sampleSave();
    const save = sampleSave({
      location: { screen: 'gym' },
      badges: o.all ? ['forest', 'beach', 'volcano'] : ['forest'],
      regions: { order: o.all ? ['forest', 'beach', 'volcano'] : ['forest', 'beach'] },
      stages: { 'forest-1': cleared(), 'forest-2': cleared(), 'forest-3': cleared() },
      settings: { ...base.settings, autoBattle: o.auto !== false },
    });
    const s = createGameState(save, 7);
    return { ...s, runtime: { ...s.runtime, stage: ms === undefined ? { phase: 'badge' } : { phase: 'badge', ms }, stageId: null } };
  };
  it('ms 가 없는 첫 장면도 10초 (칩이 처음부터) — 버튼이 뜨는 1초까지 10 · 그 뒤 1초마다 · 열쇠도 같은 셈', () => {
    expect(badgeAutoLeft(card(undefined))).toBe(10);
    expect(badgeAutoLeft(card(16))).toBe(10);
    expect(badgeAutoLeft(card(1999))).toBe(10);
    expect(badgeAutoLeft(card(2000))).toBe(9);
    expect(badgeAutoLeft(card(TIMING.badgeAutoMs - 1))).toBe(1);
    expect(stageViewKey(card(undefined))).toBe(stageViewKey(card(16)));
    expect(stageViewKey(card(1999))).not.toBe(stageViewKey(card(2000)));
  });
  it('자동 꺼짐 · 첫 승 다 깸 (지도 — 엔진이 기다림) = 칩 없음 · 다시 이김은 다 깸이어도 셈 (대기실로)', () => {
    expect(badgeAutoLeft(card(0, { auto: false }))).toBeNull();
    expect(badgeAutoLeft(card(0, { all: true }))).toBeNull();
    const again = card(0, { all: true });
    expect(badgeAutoLeft({ ...again, runtime: { ...again.runtime, stage: { phase: 'badge', ms: 0, again: true } } })).toBe(10);
  });
});

describe('진화 아이템 안내 묶기 (ideas 1631)', () => {
  const withBag = (bag: Record<string, number>, tips: string[] = []) => ({ ...sampleSave(), bag: { 'poke-ball': 3, ...bag }, tips });
  it('하나면 그것만 · 없으면 빈 목록', () => {
    expect(evoTipItems(withBag({ 'thunder-stone': 1 }), 'thunder-stone')).toEqual(['thunder-stone']);
    expect(evoTipItems(withBag({ 'thunder-stone': 1 }), null)).toEqual([]);
  });
  it('못 본 것을 모두 묶음 — 엔진이 준 첫째가 앞 · 본 것 · 0개는 뺌', () => {
    const save = withBag({ 'fire-stone': 1, 'thunder-stone': 2, 'water-stone': 0, 'linking-cord': 1, 'leaf-stone': 1 }, ['evo-leaf-stone']);
    const got = evoTipItems(save, 'fire-stone');
    expect(got[0]).toBe('fire-stone');
    expect([...got].sort()).toEqual(['fire-stone', 'linking-cord', 'thunder-stone']);
  });
  it('본 안내 칸이 하나 남으면 첫째만 (못 적을 것을 묶지 않음)', () => {
    const tips = Array.from({ length: TIPS_MAX - 1 }, (_, i) => `x${i}`);
    expect(evoTipItems(withBag({ 'fire-stone': 1, 'thunder-stone': 1 }, tips), 'fire-stone')).toEqual(['fire-stone']);
  });
});
