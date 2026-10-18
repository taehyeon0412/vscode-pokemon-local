/**
 * S01 ② 📦 내 포켓몬 꺼내기 (gdd S01 ② ④) — 세이브의 팀 (최대 5마리, 맨 앞부터) 을 일반 모드 웹뷰에 보낼 모양으로.
 * 그림 데이터 (forms.json) 에 없는 모습은 뺌 (웹뷰가 못 그림) · 이로치는 그림이 있을 때만.
 */
import { BALANCE } from '../../core/balance';
import type { Save } from '../../core/save';
import { formOf, moveOf, speciesOf } from '../../data';
import { TEAM_OUT_COMMAND, type TeamOutMessage, type TeamOutMonster } from '../../shared/team-out';

export function teamOutMessage(save: Save | null): TeamOutMessage {
  const team: TeamOutMonster[] = [];
  for (const uid of save?.party.slice(0, BALANCE.partySize) ?? []) {
    const m = save?.monsters[uid];
    const f = m ? formOf(m.form) : undefined;
    if (!m || !f) continue;
    team.push({
      uid: m.uid,
      form: m.form,
      gen: `gen${f.gen}`,
      size: f.size,
      color: m.shiny && f.shiny ? 'shiny' : 'default',
      name: speciesOf(m.species)?.name.ko ?? m.form,
      level: m.level,
      moves: m.moves
        .map((s) => moveOf(s.moveId))
        .filter((mv): mv is NonNullable<typeof mv> => !!mv)
        .map((mv) => ({ id: mv.id, name: mv.name.ko, type: mv.type })),
    });
  }
  return { command: TEAM_OUT_COMMAND, team };
}

/** 넣기 — 빈 목록 */
export function teamInMessage(): TeamOutMessage {
  return { command: TEAM_OUT_COMMAND, team: [] };
}
