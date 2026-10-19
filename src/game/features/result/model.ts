/**
 * S12 전투 결과 · S23 기술 배우기 · S22 진화 — 화면을 모르는 부분: 무엇을 어떤 글로 보여 줄지.
 */
import { TIMING } from '../../core/balance';
import type { BattleSummary, GameState } from '../../core/engine';
import { evolvedForm, keepCount } from '../../core/rules/growth';
import type { Monster, PendingChoice } from '../../core/save';
import { typeNameKo, withJosa } from '../../core/text';
import { moveOf, speciesOf } from '../../data';

const nameOf = (dex: number) => speciesOf(dex)?.name.ko ?? '???';

export interface MoveView {
  id: number;
  name: string;
  /** "위력 45 · 풀 · PP 25" */
  detail: string;
  /** 버튼 옆 작은 글 "풀 45" (변화 기술은 "풀 변화") */
  short: string;
}

export function moveView(id: number, pp?: number): MoveView {
  const mv = moveOf(id);
  if (!mv) return { id, name: '?', detail: '', short: '' };
  const power = mv.power > 0 ? `위력 ${mv.power}` : '변화';
  return { id, name: mv.name.ko, detail: `${power} · ${typeNameKo(mv.type)} · PP ${pp ?? mv.pp}/${mv.pp}`, short: `${typeNameKo(mv.type)} ${mv.power > 0 ? mv.power : '변화'}` };
}

/** S12 한 줄씩 — 첫 줄 (제목 · 잡은 포켓몬 · 돈 · 아이템) · 둘째 줄 (경험치 · 레벨업 · 새 기술) */
export function summaryLines(s: BattleSummary): { head: string[]; body: string[] } {
  const head = [s.title];
  if (s.caught) head.push(s.caught.toBox ? `◓ 팀이 다 차서 ${s.caught.name} → 보관함` : `◓ ${s.caught.name} 팀에 들어옴`);
  if (s.money > 0) head.push(`💰 +${s.money}원`);
  if (s.item) head.push(`🎁 ${s.item}`);
  // 레벨이 오른 포켓몬을 앞에 (묻히지 않게) · 나머지는 뒤에
  const up = s.exp.filter((e) => e.to > e.from).map((e) => `⬆ ${e.name} Lv ${e.from} → ${e.to} (+${e.gain} EXP)`);
  const rest = s.exp.filter((e) => e.to <= e.from).map((e) => `${e.name} +${e.gain} EXP`);
  const body = [...up, ...rest];
  for (const l of s.learned) body.push(`✨ ${withJosa(l.name, '이/가')} ${withJosa(l.move, '을/를')} 배웠다`);
  // 라이벌 한마디 (gdd 4.12) — 둘째 줄 맨 끝 (좁은 패널에서 레벨업이 잘리지 않게)
  if (s.quote) body.push(`💬 ${s.quote}`);
  return { head, body };
}

export type ChoiceView =
  | { kind: 'learn'; monster: Monster; name: string; move: MoveView; current: MoveView[] }
  | {
      kind: 'evolve';
      monster: Monster;
      name: string;
      to: number;
      toName: string;
      toForm: string;
      /** 진화 연출 중 (Space 넘기기 · Esc 멈추기) */
      animating: boolean;
      current: MoveView[];
      fresh: MoveView[];
      /** 남길 지금 기술 수 — 지금 기술 수와 같으면 고를 것 없이 결정 */
      keep: number;
    };

/** S23 · S22 — 지금 고를 것 (맨 앞) */
export function choiceView(state: GameState): ChoiceView | null {
  const st = state.runtime.stage;
  const c: PendingChoice | undefined = state.save.pendingChoices[0];
  if (st?.phase !== 'choice' || !c) return null;
  const m = state.save.monsters[c.uid];
  if (!m) return null;
  const current = m.moves.map((s) => moveView(s.moveId, s.pp));
  if (c.kind === 'learn') return { kind: 'learn', monster: m, name: nameOf(m.species), move: moveView(c.moveId), current };
  const fresh = c.newMoves.filter((id) => !m.moves.some((s) => s.moveId === id)).map((id) => moveView(id));
  return {
    kind: 'evolve',
    monster: m,
    name: nameOf(m.species),
    to: c.to,
    toName: nameOf(c.to),
    toForm: evolvedForm(m.form, m.species, c.to),
    animating: st.ms < TIMING.evolveAnimMs,
    current,
    fresh,
    keep: keepCount(m, c.newMoves),
  };
}

/** 화면을 다시 그릴지 보는 열쇠 (결과 · 고르기는 멈춰 있으니 바뀔 때만) */
export function resultViewKey(state: GameState): string {
  const st = state.runtime.stage;
  if (st?.phase === 'result') return `result:${st.summary.title}`;
  if (st?.phase !== 'choice') return '';
  const c = state.save.pendingChoices[0];
  return `choice:${state.save.pendingChoices.length}:${c ? JSON.stringify(c) : ''}:${st.ms >= TIMING.evolveAnimMs}`;
}
