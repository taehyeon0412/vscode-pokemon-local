import { describe, expect, it } from 'vitest';
import { sampleMonster, sampleSave } from '../../../test/fixtures/save';
import { TEAM_OUT_COMMAND } from '../../shared/team-out';
import { teamInMessage, teamOutMessage } from './model';

describe('S01 ② 📦 내 포켓몬 꺼내기 — 보낼 팀 (gdd S01 ② ④)', () => {
  it('팀 맨 앞부터 · 그림 폴더 (세대 · 크기) · 이름 · 레벨 · 배운 기술 (이름 · 타입)', () => {
    const msg = teamOutMessage(sampleSave());
    expect(msg.command).toBe(TEAM_OUT_COMMAND);
    expect(msg.team.map((t) => [t.uid, t.form, t.gen, t.size, t.name, t.level])).toEqual([
      ['m1', 'bulbasaur', 'gen1', 32, '이상해씨', 5],
      ['m2', 'caterpie', 'gen1', 32, '캐터피', 3],
    ]);
    expect(msg.team[0]!.moves).toEqual([
      { id: 33, name: '몸통박치기', type: 'normal' },
      { id: 22, name: '덩굴채찍', type: 'grass' },
    ]);
  });

  it('이로치는 그림이 있을 때만 · 그림 데이터에 없는 모습은 뺌 · 5마리까지 · 세이브가 없으면 빈 목록', () => {
    const s = sampleSave();
    const shiny = teamOutMessage({ ...s, monsters: { ...s.monsters, m1: { ...s.monsters.m1!, shiny: true } } });
    expect(shiny.team[0]!.color).toBe('shiny');
    const unknown = teamOutMessage({ ...s, monsters: { ...s.monsters, m1: { ...s.monsters.m1!, form: 'no_such_form' } } });
    expect(unknown.team.map((t) => t.uid)).toEqual(['m2']);
    const many = { ...s, monsters: Object.fromEntries([1, 2, 3, 4, 5, 6].map((i) => [`m${i}`, sampleMonster({ uid: `m${i}` })])), party: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'] };
    expect(teamOutMessage(many).team).toHaveLength(5);
    expect(teamOutMessage(null).team).toEqual([]);
    expect(teamInMessage().team).toEqual([]);
  });
});
