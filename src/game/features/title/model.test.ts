import { describe, expect, it } from 'vitest';
import { TITLE_NOTICES, type TitleInfo } from '../../shared/messages';
import { BUSY_WARNING, NOTICE_TEXT, titleView } from './model';

const summary: TitleInfo['summary'] = { playTimeMs: 754_000, money: 1000, badges: [], lead: { form: 'bulbasaur', species: 1, level: 5 } };

describe('S02 타이틀 보기', () => {
  it('세이브 없음: 이어 하기 흐리게 (까닭: 없음) · 새로 하기는 확인 없이', () => {
    expect(titleView({ save: 'none', busy: false, summary: null })).toEqual({
      canStart: true,
      canContinue: false,
      continueHint: '이어 할 세이브가 없어요',
      confirmNew: false,
      summary: null,
      warnings: [],
    });
  });

  it('세이브 있음: 이어 하기 · 새로 하기 확인 · 요약 (한글 이름 · 배지 수)', () => {
    const v = titleView({ save: 'ok', busy: false, summary: { ...summary!, badges: ['forest'] } });
    expect(v).toMatchObject({ canStart: true, canContinue: true, continueHint: null, confirmNew: true, warnings: [] });
    expect(v.summary).toEqual({ lead: { form: 'bulbasaur', name: '이상해씨', level: 5 }, badges: 1, money: 1000, playTimeMs: 754_000 });
  });

  it('팀이 비었어도 요약은 보임', () => {
    expect(titleView({ save: 'ok', busy: false, summary: { ...summary!, lead: null } }).summary?.lead).toBeNull();
  });

  it('망가진 세이브: 이어 하기 못 함 (까닭은 "없어요" 가 아님) · 새로 하기는 확인 · 백업 안내', () => {
    const v = titleView({ save: 'broken', busy: false, summary: null });
    expect(v.canContinue).toBe(false);
    expect(v.continueHint).toContain('읽지 못했어요');
    expect(v.confirmNew).toBe(true);
    expect(v.warnings).toHaveLength(1);
    expect(v.warnings[0]).toContain('백업');
  });

  it('더 새 버전 세이브: 이어 하기 못 함 · 업데이트 안내 · 요약이 와도 숨김', () => {
    const v = titleView({ save: 'newer', busy: false, summary });
    expect(v.canContinue).toBe(false);
    expect(v.summary).toBeNull();
    expect(v.warnings[0]).toContain('업데이트');
  });

  it('다른 창이 게임 중: 두 버튼 모두 흐리게 · 안내 한 줄 (같은 까닭의 notice 는 겹치지 않음)', () => {
    const v = titleView({ save: 'ok', busy: true, summary, notice: 'busy' });
    expect(v.canStart).toBe(false);
    expect(v.warnings).toEqual([BUSY_WARNING]);
  });

  it('방금 안 된 까닭이 맨 앞 (패널이 낮으면 첫 줄만 보임)', () => {
    expect(titleView({ save: 'broken', busy: false, summary: null, notice: 'write-failed' }).warnings[0]).toBe(NOTICE_TEXT['write-failed']);
  });

  it('까닭 코드마다 문구가 있음', () => {
    for (const n of TITLE_NOTICES) expect(NOTICE_TEXT[n].length).toBeGreaterThan(0);
  });
});
