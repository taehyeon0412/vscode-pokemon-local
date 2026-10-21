import { describe, expect, it } from 'vitest';
import { sampleMonster, sampleSave, viaJson } from '../../../test/fixtures/save';
import { BALANCE } from '../balance';
import { createNewSave, NOTIFY_OFF_TIP, readSave, SAVE_VERSION, validateSave, type Save } from './index';

/** 고친 세이브를 꺼냄 (ok 가 아니면 실패) */
function fix(raw: unknown): { save: Save; problems: string[] } {
  const r = validateSave(raw);
  if (!r.ok) throw new Error(`ok 가 아님: ${r.reason}`);
  return r;
}

describe('새 세이브', () => {
  it('검사를 고칠 것 없이 통과', () => {
    const r = validateSave(createNewSave(123));
    expect(r).toEqual({ ok: true, save: createNewSave(123), problems: [] });
  });

  it('시작 돈 · 몬스터볼 · 타이틀 (mvp-spec 3.4 · 4장)', () => {
    const s = createNewSave(0);
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.money).toBe(1000);
    expect(s.bag['poke-ball']).toBe(3);
    expect(s.location).toEqual({ screen: 'title' });
    // 알림 (VS Code 팝업) 은 처음 꺼짐 (2026-10-21 태현 님 "추천안" — gdd 4.13) · 옮김 표시
    expect(s.settings).toEqual({ notifications: false, autoBattle: false });
    expect(s.tips).toEqual([NOTIFY_OFF_TIP]);
  });
});

describe('저장하고 다시 불러오기', () => {
  it('JSON 으로 돌려도 그대로 (globalState 와 같은 길)', () => {
    const save = sampleSave({
      bag: { 'poke-ball': 2, potion: 1, 'leaf-stone': 1 },
      badges: ['forest'],
      lastHospital: { stageId: 'forest-1', at: 0.5 },
      pendingEncounter: { kind: 'wild', monster: sampleMonster({ uid: 'wild', species: 13, form: 'weedle' }), start: 'ambush' },
    });
    save.monsters.m1!.status = { kind: 'sleep', turnsLeft: 2 };
    const r = readSave(viaJson(save));
    expect(r).toEqual({ kind: 'ok', save, problems: [], migratedFrom: null });
  });
});

describe('망가진 세이브 — 살릴 수 없음', () => {
  it.each([
    ['객체가 아님', 'hello'],
    ['null', null],
    ['목록', []],
    ['포켓몬 목록이 없음', { ...createNewSave(0), monsters: 'oops' }],
  ])('%s → broken', (_name, raw) => {
    expect(readSave(raw).kind).toBe('broken');
  });

  it('버전이 다르면 validate 는 거절 (옮기기는 readSave 가)', () => {
    expect(validateSave({ ...createNewSave(0), version: SAVE_VERSION + 1 }).ok).toBe(false);
    expect(validateSave({ ...createNewSave(0), version: 1 }).ok).toBe(false);
  });
});

describe('망가진 세이브 — 고쳐서 읽음 (포켓몬을 잃지 않게)', () => {
  it('주인공 캐릭터 (S03 look): 아는 이름은 그대로 · 모르는 이름은 빼고 성별만 · 옛 세이브 (look 없음) 는 그대로', () => {
    const base = viaJson(sampleSave());
    expect(fix({ ...base, player: { gender: 'female', look: 'may' } }).save.player).toEqual({ gender: 'female', look: 'may' });
    const odd = fix({ ...base, player: { gender: 'male', look: 'nobody' } });
    expect(odd.save.player).toEqual({ gender: 'male' });
    expect(odd.problems.join(' ')).toContain('player.look');
    expect(fix({ ...base, player: { gender: 'male' } })).toMatchObject({ save: { player: { gender: 'male' } }, problems: [] });
    // 옛 캐릭터 (모자 소녀, 2026-10-19 뺌) 는 리프로 — 고친 것으로 치지 않음
    expect(fix({ ...base, player: { gender: 'female', look: 'cap-girl' } })).toMatchObject({ save: { player: { gender: 'female', look: 'girl' } }, problems: [] });
    // 캐릭터와 성별이 다르면 캐릭터 쪽으로
    const mixed = fix({ ...base, player: { gender: 'male', look: 'may' } });
    expect(mixed.save.player).toEqual({ gender: 'female', look: 'may' });
    expect(mixed.problems.join(' ')).toContain('player.gender');
  });

  it('팀이 없는 포켓몬 · 겹친 칸을 가리키면 뺌', () => {
    const { save, problems } = fix({ ...sampleSave(), party: ['m1', 'm1', 'ghost', 7, 'm2'] });
    expect(save.party).toEqual(['m1', 'm2']);
    expect(problems.length).toBe(3);
  });

  it('팀이 5마리를 넘으면 나머지는 보관함 맨 앞으로', () => {
    const monsters: Save['monsters'] = {};
    const uids = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'];
    for (const uid of uids) monsters[uid] = sampleMonster({ uid });
    const { save } = fix({ ...sampleSave(), monsters, party: uids, box: [], nextMonsterUid: 8 });
    expect(save.party).toEqual(uids.slice(0, BALANCE.partySize));
    expect(save.box).toEqual(['m6', 'm7']);
  });

  it('팀 · 보관함 어디에도 없는 포켓몬은 보관함으로', () => {
    const { save } = fix({ ...sampleSave(), party: ['m1'], box: [] });
    expect(save.box).toEqual(['m2']);
  });

  it('도감 번호 · 그림 이름이 없는 포켓몬은 빼고 팀에서도 뺌', () => {
    const raw = sampleSave();
    (raw.monsters.m2 as unknown as Record<string, unknown>).species = 99999;
    const { save } = fix(raw);
    expect(Object.keys(save.monsters)).toEqual(['m1']);
    expect(save.party).toEqual(['m1']);
  });

  it('범위 밖 숫자는 범위 안으로, 숫자가 아니면 기본값', () => {
    const raw = viaJson(sampleSave()) as unknown as { monsters: Record<string, Record<string, unknown>> };
    raw.monsters.m1!.level = 250;
    raw.monsters.m1!.hp = 'lots';
    raw.monsters.m1!.ivs = { hp: 40, attack: -3, defense: 1.6, speed: 31, ultimate: 0 };
    const { save } = fix(raw);
    const m = save.monsters.m1!;
    expect(m.level).toBe(100);
    expect(m.hp).toBe(0);
    expect(m.ivs).toEqual({ hp: 31, attack: 0, defense: 2, speed: 31, ultimate: 0 });
  });

  it('기술: 겹친 기술 · 번호 없는 칸 · 4칸 넘는 것을 뺌', () => {
    const moves = [{ moveId: 1, pp: 5 }, { moveId: 1, pp: 5 }, { pp: 3 }, { moveId: 2, pp: 5 }, { moveId: 3, pp: 5 }, { moveId: 4, pp: 5 }, { moveId: 5, pp: 5 }];
    const raw = sampleSave();
    (raw.monsters.m1 as unknown as Record<string, unknown>).moves = moves;
    const { save } = fix(raw);
    expect(save.monsters.m1!.moves.map((m) => m.moveId)).toEqual([1, 2, 3, 4]);
  });

  it('모르는 아이템 · 0개 · 모르는 칸은 뺌', () => {
    const { save, problems } = fix({ ...sampleSave(), bag: { 'poke-ball': 2, 'master-ball': 1, potion: 0 }, extra: true });
    expect(save.bag).toEqual({ 'poke-ball': 2 });
    expect(problems.some((p) => p.startsWith('extra'))).toBe(true);
  });

  it('다음 uid 가 있는 번호와 겹치면 올림', () => {
    const { save } = fix({ ...sampleSave(), nextMonsterUid: 2 });
    expect(save.nextMonsterUid).toBe(3);
  });

  it('잡은 종은 만난 종에도 들어감', () => {
    const { save } = fix({ ...sampleSave(), dex: { seen: [1], caught: [10, 1, 10] } });
    expect(save.dex).toEqual({ seen: [1, 10], caught: [1, 10] });
  });

  it('포켓몬이 하나도 없는데 스테이지에 있으면 타이틀로', () => {
    const { save } = fix({ ...createNewSave(0), location: { screen: 'stage', stageId: 'forest-1' } });
    expect(save.location).toEqual({ screen: 'title' });
  });

  it('알 수 없는 곳 · 스테이지 · 하던 전투는 기본값으로', () => {
    const { save } = fix({
      ...sampleSave(),
      location: { screen: 'stage', stageId: 'volcano-9' },
      stages: { 'forest-1': { seed: 1, progress: 3, cleared: 'yes', defeatedTrainers: ['t1', 't1'], facilities: [{ kind: 'casino', at: 1 }] }, 'moon-1': {} },
      pendingEncounter: { kind: 'wild', monster: { species: 'x' }, start: 'normal' },
    });
    // 팀이 있으면 타이틀이 아니라 안 깬 첫 스테이지 (타이틀로 두면 이어 해도 아무 일도 안 일어남 — #351)
    expect(save.location).toEqual({ screen: 'stage', stageId: 'forest-1' });
    expect(save.stages).toEqual({ 'forest-1': { seed: 1, progress: 1, cleared: false, defeatedTrainers: ['t1'], facilities: [], run: { startMs: save.playTimeMs, caught: 0, trainers: 0, seen: [], reach: 0, retries: 0 } } });
    expect(save.pendingEncounter).toBeNull();
  });

  it('포켓몬이 있는데 타이틀 · 지도면 이어 할 곳으로 — 안 깬 첫 스테이지, 다 깼으면 체육관 (#351)', () => {
    const run = { startMs: 0, caught: 0, trainers: 0, seen: [], reach: 0, retries: 0 };
    const st = (cleared: boolean) => ({ seed: 1, progress: cleared ? 1 : 0.3, cleared, defeatedTrainers: [], facilities: [], run });
    expect(fix({ ...sampleSave(), location: { screen: 'title' } }).save.location).toEqual({ screen: 'stage', stageId: 'forest-1' });
    expect(fix({ ...sampleSave(), location: { screen: 'world-map' }, stages: { 'forest-1': st(true) } }).save.location).toEqual({ screen: 'stage', stageId: 'forest-2' });
    expect(fix({ ...sampleSave(), location: { screen: 'title' }, stages: { 'forest-1': st(true), 'forest-2': st(true), 'forest-3': st(true) } }).save.location).toEqual({ screen: 'gym' });
    // 포켓몬이 하나도 없으면 그대로 타이틀 (스타팅부터)
    expect(fix({ ...sampleSave(), monsters: {}, party: [], box: [], location: { screen: 'world-map' } }).save.location).toEqual({ screen: 'title' });
  });

  it('잠듦 남은 번수는 1~3', () => {
    const raw = sampleSave();
    (raw.monsters.m1 as unknown as Record<string, unknown>).status = { kind: 'sleep', turnsLeft: 9 };
    expect(fix(raw).save.monsters.m1!.status).toEqual({ kind: 'sleep', turnsLeft: 3 });
  });

  it('고친 세이브를 다시 검사하면 고칠 게 없음', () => {
    const { save } = fix({ ...sampleSave(), party: ['m1', 'ghost'], money: -5, extra: 1 });
    expect(validateSave(viaJson(save))).toEqual({ ok: true, save, problems: [] });
  });

  it('팀이 비고 보관함에만 포켓몬이 있으면 첫 마리를 팀으로 (나갈 포켓몬이 없으면 안 됨)', () => {
    const { save } = fix({ ...sampleSave(), party: [], box: ['m2', 'm1'] });
    expect(save.party).toEqual(['m2']);
    expect(save.box).toEqual(['m1']);
  });
});

describe('망가진 세이브 — 이상한 이름 (테스터 · 코드 리뷰어가 찾은 것)', () => {
  it('팀 칸의 toString · constructor 같은 물려받은 이름은 없는 포켓몬', () => {
    const { save } = fix({ ...sampleSave(), party: ['m1', 'toString', 'constructor', '__proto__'] });
    expect(save.party).toEqual(['m1']);
  });

  it('규칙(m숫자)에 안 맞는 열쇠는 새 번호로 — 포켓몬 · 팀 자리를 잃지 않음', () => {
    const raw = viaJson(sampleSave()) as unknown as { monsters: Record<string, unknown>; party: string[] };
    raw.monsters = JSON.parse(`{"__proto__": ${JSON.stringify(sampleMonster({ uid: '__proto__' }))}, "": ${JSON.stringify(sampleMonster({ uid: '' }))}, "m2": ${JSON.stringify(sampleMonster({ uid: 'm2' }))}}`) as Record<string, unknown>;
    raw.party = ['__proto__', '', 'm2'];
    const { save } = fix(raw);
    expect(Object.keys(save.monsters).sort()).toEqual(['m2', 'm3', 'm4']);
    expect(save.party).toEqual(['m3', 'm4', 'm2']);
    expect(save.nextMonsterUid).toBe(5);
  });

  it('아주 긴 uid 숫자도 nextMonsterUid 가 오락가락하지 않음', () => {
    const raw = viaJson(sampleSave()) as unknown as { monsters: Record<string, unknown> };
    raw.monsters['m99999999999999999999'] = sampleMonster({ uid: 'm99999999999999999999' });
    const { save } = fix(raw);
    expect(validateSave(viaJson(save))).toEqual({ ok: true, save, problems: [] });
  });

  it('하던 야생 전투 상대의 uid 가 비어도 다시 검사하면 고칠 게 없음', () => {
    const wild = sampleMonster({ uid: '', species: 13, form: 'weedle' });
    const { save } = fix({ ...sampleSave(), pendingEncounter: { kind: 'wild', monster: wild, start: 'normal' } });
    expect(save.pendingEncounter?.kind === 'wild' && save.pendingEncounter.monster.uid).toBe('wild');
    expect(validateSave(viaJson(save))).toEqual({ ok: true, save, problems: [] });
  });

  it.each([
    ['팀이 문자열', { party: 'm1' }],
    ['돈이 글자 "5"', { money: '5' }],
    ['스테이지가 목록', { stages: [] }],
    ['설정이 없음', { settings: undefined }],
    ['도감이 null', { dex: null }],
  ])('%s → 고쳐서 읽고, 다시 검사하면 고칠 게 없음', (_n, patch) => {
    const { save } = fix({ ...sampleSave(), ...patch });
    expect(validateSave(viaJson(save))).toEqual({ ok: true, save, problems: [] });
  });
});

describe('고정된 1판 세이브 표본 (src/test/fixtures/save-v1.json)', () => {
  it('지금 코드로 고칠 것 없이 읽힘 — 형식을 바꾸면 이 표본을 옮기는 함수가 있어야 통과', async () => {
    const raw: unknown = (await import('../../../test/fixtures/save-v1.json')).default;
    const r = readSave(viaJson(raw));
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.problems).toEqual([]);
    expect(r.save.party).toEqual(['m1', 'm2']);
    expect(r.save.pendingEncounter?.kind).toBe('wild');
    // pendingChoices 는 단계 7 에 더한 칸 (전투 끝의 S23 · S22 고르기) — 그 전 1판 세이브에는 없고, 고칠 것 없이 빈 목록으로 읽음 (버전을 안 올려도 되는 덧붙임)
    // stages.*.run 은 단계 9 에 더한 칸 (S24 요약) — 없으면 빈 기록 (시작 = 지금 플레이 시간)
    const rawStages = (raw as { stages: Record<string, object>; playTimeMs: number });
    const stages = Object.fromEntries(Object.entries(rawStages.stages).map(([k, v]) => [k, { ...v, run: { startMs: rawStages.playTimeMs, caught: 0, trainers: 0, seen: [], reach: 0, retries: 0 } }]));
    // 2판 (2026-10-21 orders #15) — 칸은 그대로, 판만 올라감
    // 알림 처음 값이 꺼짐으로 바뀜 (2026-10-21) — 옛 세이브는 읽을 때 한 번 꺼짐으로 · 표시 (고친 기록 없음)
    const settings = { ...(raw as { settings: object }).settings, notifications: false };
    expect(viaJson(r.save)).toEqual({ ...(raw as object), version: SAVE_VERSION, stages, pendingChoices: [], settings, tips: [NOTIFY_OFF_TIP] });
    // 옮긴 뒤 켠 것은 그대로 (다시 읽어도 꺼지지 않음)
    const on = readSave(viaJson({ ...r.save, settings: { ...r.save.settings, notifications: true } }));
    expect(on.kind === 'ok' && on.save.settings.notifications).toBe(true);
  });

  it('단계 7 의 고르기 칸이 있는 세이브도 그대로 · 없는 포켓몬 · 모르는 기술을 가리키는 고르기는 뺌', async () => {
    const raw = (await import('../../../test/fixtures/save-v1.json')).default as Record<string, unknown>;
    const choices = [
      { kind: 'learn', uid: 'm1', moveId: 22 },
      { kind: 'evolve', uid: 'm1', to: 2, newMoves: [75, 76], level: 16, item: null },
      { kind: 'learn', uid: 'm99', moveId: 22 },
      { kind: 'learn', uid: 'm1', moveId: 999999 },
    ];
    const r = readSave(viaJson({ ...raw, pendingChoices: choices }));
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.save.pendingChoices).toEqual(choices.slice(0, 2));
    expect(r.problems.length).toBe(2);
  });
});

describe('고정된 3판 세이브 표본 (src/test/fixtures/save-v3.json — #30 세이브 4판 옮기기의 바탕, orders #43)', () => {
  // 시뮬 (scripts/sim-mvp.ts) 로 숲 관장을 이긴 순간의 세이브 (꼬부기 · 5마리 · 라이벌 전적 · 처음 안내) + 2 · 3판 옵션 칸 (빨리 걷기 · 상처약 · 이미 잡은 종 건너뛰기 · 3:3 · 쌓아 둔 기술 고르기).
  // 4판을 만들 때: 이 표본을 그대로 두고 "옮기면 같이 쓰는 칸 · 진행 칸이 그대로 + regions.order = ['forest']" 테스트를 더함 (dev-log #40)
  const load = async () => (await import('../../../test/fixtures/save-v3.json')).default as unknown as Record<string, unknown>;

  it('지금 코드로 고칠 것 없이 그대로 읽힘 (모든 칸 · 옵션 칸)', async () => {
    const raw = await load();
    expect(raw.version).toBe(3);
    const r = readSave(viaJson(raw));
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.problems).toEqual([]);
    expect(viaJson(r.save)).toEqual(raw);
    expect(r.save.badges).toEqual(['forest']);
    expect(r.save.location).toEqual({ screen: 'gym' });
    expect(r.save.settings.teamMode).toBe(true);
    expect(r.save.laterChoices).toHaveLength(1);
    expect(Object.keys(r.save.rivals ?? {}).length).toBeGreaterThan(0);
    expect(validateSave(viaJson(raw))).toEqual({ ok: true, save: r.save, problems: [] });
  });

  it('옛 창 대비 — 판이 더 새 (4판) 이면 지금 코드는 읽지 않고 잠금 (newer)', async () => {
    const raw = await load();
    expect(readSave(viaJson({ ...raw, version: SAVE_VERSION + 1 }))).toEqual({ kind: 'newer', version: SAVE_VERSION + 1 });
  });
});

describe('pendingChoices 검사 (단계 7 코드 리뷰어)', () => {
  it('toString 같은 이름 · 고친 열쇠 이름', async () => {
    const raw = (await import('../../../test/fixtures/save-v1.json')).default as Record<string, unknown>;
    const r = readSave(viaJson({ ...raw, pendingChoices: [{ kind: 'learn', uid: 'toString', moveId: 22 }, { kind: 'learn', uid: 'constructor', moveId: 22 }] }));
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.save.pendingChoices).toEqual([]);
    // 열쇠 이름이 규칙에 안 맞아 바뀐 포켓몬을 가리키면 새 이름으로
    const monsters = raw.monsters as Record<string, unknown>;
    const renamedRaw = { ...raw, monsters: { ...monsters, odd: { ...(monsters.m2 as object), uid: 'odd' } }, box: ['odd'], pendingChoices: [{ kind: 'learn', uid: 'odd', moveId: 22 }] };
    const r2 = readSave(viaJson(renamedRaw));
    expect(r2.kind).toBe('ok');
    if (r2.kind !== 'ok') return;
    expect(r2.save.pendingChoices).toHaveLength(1);
    expect(r2.save.monsters[r2.save.pendingChoices[0]!.uid]).toBeDefined();
  });
});
describe('진화 고르기 검사 (단계 7 테스터)', () => {
  it('그 종의 진짜 진화만 · 포켓몬마다 하나만', async () => {
    const raw = (await import('../../../test/fixtures/save-v1.json')).default as Record<string, unknown>;
    const evo = (to: number) => ({ kind: 'evolve', uid: 'm1', to, newMoves: [75], level: 16, item: null });
    const r = readSave(viaJson({ ...raw, pendingChoices: [evo(150), evo(2), evo(2)] }));
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.save.pendingChoices).toEqual([evo(2)]);
  });
});

describe('손으로 만든 큰 세이브 (테스터 #48 — 불러오기)', () => {
  it('배지 6만 개 · 고르기 4만 개 · 포켓몬 열쇠 14만 개도 빨리 읽고 (멈추지 않음) 상한에서 자름 · 고친 기록도 상한', () => {
    const base = sampleSave();
    const badges = Array.from({ length: 60_000 }, (_, i) => `b${i}`);
    const choices = Array.from({ length: 40_000 }, (_, i) => ({ kind: 'learn', uid: 'm1', moveId: i % 2 ? 33 : 22 }));
    const t0 = performance.now();
    const r = readSave(viaJson({ ...base, badges, pendingChoices: choices }));
    expect(performance.now() - t0).toBeLessThan(1500);
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.save.badges.length).toBeLessThanOrEqual(500);
    expect(r.save.pendingChoices.length).toBeLessThanOrEqual(100);
    expect(r.problems.length).toBeLessThanOrEqual(201);
    // 포켓몬 열쇠가 아주 많아도 스택이 넘치지 않음 (Math.max(...) 펼치기 대신 반복)
    const junk = Object.fromEntries(Array.from({ length: 140_000 }, (_, i) => [`m${i + 2}`, 0]));
    expect(() => readSave(viaJson({ ...base, monsters: { ...base.monsters, ...junk } }))).not.toThrow();
  });
});
