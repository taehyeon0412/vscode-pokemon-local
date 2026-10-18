import { describe, expect, it } from 'vitest';
import { sampleMonster, sampleSave, viaJson } from '../../../test/fixtures/save';
import { BALANCE } from '../balance';
import { createNewSave, readSave, SAVE_VERSION, validateSave, type Save } from './index';

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
    expect(s.settings).toEqual({ notifications: true, autoBattle: false });
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
    expect(validateSave({ ...createNewSave(0), version: 2 }).ok).toBe(false);
  });
});

describe('망가진 세이브 — 고쳐서 읽음 (포켓몬을 잃지 않게)', () => {
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
    expect(save.location).toEqual({ screen: 'title' });
    expect(save.stages).toEqual({ 'forest-1': { seed: 1, progress: 1, cleared: false, defeatedTrainers: ['t1'], facilities: [], run: { startMs: save.playTimeMs, caught: 0, trainers: 0, seen: [], reach: 0, retries: 0 } } });
    expect(save.pendingEncounter).toBeNull();
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
    expect(viaJson(r.save)).toEqual({ ...(raw as object), stages, pendingChoices: [] });
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
