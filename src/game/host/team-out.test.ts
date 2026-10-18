import { describe, expect, it } from 'vitest';
import { sampleSave } from '../../test/fixtures/save';
import type { Save } from '../core/save';
import type { TeamOutMessage } from '../shared/team-out';
import { BROKEN_SAVE_TEXT, NEWER_SAVE_TEXT, NO_SAVE_TEXT, TeamOut, type TeamSave } from './team-out';

function setup(save: Save | null | 'broken' | 'newer', stored = false) {
  const posts: TeamOutMessage[] = [];
  const infos: string[] = [];
  const ctx: boolean[] = [];
  let kept = stored;
  const t = new TeamOut({
    post: (m) => posts.push(m),
    readSave: async (): Promise<TeamSave> => (save === null ? { kind: 'none' } : typeof save === 'string' ? { kind: save } : { kind: 'ok', save }),
    load: () => kept,
    store: (on) => {
      kept = on;
    },
    setContext: (on) => ctx.push(on),
    info: (m) => infos.push(m),
  });
  return {
    t,
    posts,
    infos,
    ctx,
    kept: () => kept,
    store: (on: boolean) => {
      kept = on;
    },
  };
}

describe('📦 꺼내기 상태 (확장 쪽, S01 ②)', () => {
  it('꺼내기 → 세이브의 팀을 보냄 · 제목줄은 넣기 버튼 · 이 PC 에 기억 / 넣기 → 빈 목록', async () => {
    const s = setup(sampleSave());
    expect(s.ctx).toEqual([false]);
    await s.t.takeOut();
    expect(s.posts.at(-1)?.team.map((m) => m.uid)).toEqual(['m1', 'm2']);
    expect([s.t.isOut, s.kept(), s.ctx.at(-1)]).toEqual([true, true, true]);
    s.t.putIn();
    expect(s.posts.at(-1)?.team).toEqual([]);
    expect([s.t.isOut, s.kept(), s.ctx.at(-1)]).toEqual([false, false, false]);
  });

  it('세이브가 없으면 안내만 (꺼냄 상태가 안 됨) · 망가짐 · 더 새 버전은 그 까닭을 (새로 하기를 권하지 않게 — 테스터 단계 10)', async () => {
    const s = setup(null);
    await s.t.takeOut();
    expect(s.infos).toEqual([NO_SAVE_TEXT]);
    expect(s.posts).toEqual([]);
    expect(s.t.isOut).toBe(false);
    for (const [kind, text] of [['broken', BROKEN_SAVE_TEXT], ['newer', NEWER_SAVE_TEXT]] as const) {
      const b = setup(kind);
      await b.t.takeOut();
      expect([b.infos, b.posts, b.t.isOut]).toEqual([[text], [], false]);
    }
  });

  it('웹뷰가 새로 뜨면 · 게임에서 돌아오면 꺼낸 채일 때만 다시 보냄 · VS Code 를 다시 켜도 꺼낸 채', async () => {
    const off = setup(sampleSave());
    await off.t.refresh();
    expect(off.posts).toEqual([]);
    const on = setup(sampleSave(), true);
    expect(on.t.isOut).toBe(true);
    expect(on.ctx).toEqual([true]);
    await on.t.refresh();
    expect(on.posts.at(-1)?.team).toHaveLength(2);
  });

  it('세이브를 읽는 사이에 넣기를 누르면 늦게 온 팀은 버림 · 다른 창에서 넣었으면 이 창도 치움 (코드 리뷰어 · 테스터 단계 10)', async () => {
    let release: (s: TeamSave) => void = () => undefined;
    const posts: TeamOutMessage[] = [];
    let kept = true;
    const t = new TeamOut({
      post: (m) => posts.push(m),
      readSave: () => new Promise((r) => (release = r)),
      load: () => kept,
      store: (on) => {
        kept = on;
      },
      setContext: () => undefined,
      info: () => undefined,
    });
    const slow = t.refresh();
    t.putIn();
    release({ kind: 'ok', save: sampleSave() });
    await slow;
    expect(posts.map((m) => m.team.length)).toEqual([0]);
    const taking = t.takeOut();
    t.putIn();
    release({ kind: 'ok', save: sampleSave() });
    await taking;
    expect([t.isOut, posts.map((m) => m.team.length)]).toEqual([false, [0, 0]]);
    // 다른 창이 넣음 → 이 창도 화면의 팀을 치우고 (빈 목록) 꺼냄 상태를 맞춤
    const other = setup(sampleSave(), true);
    other.store(false);
    await other.t.refresh();
    expect([other.posts.map((m) => m.team.length), other.t.isOut, other.ctx.at(-1)]).toEqual([[0], false, false]);
  });
});
