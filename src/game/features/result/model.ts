/**
 * S12 전투 결과 · S23 기술 배우기 · S22 진화 — 화면을 모르는 부분: 무엇을 어떤 글로 보여 줄지.
 */
import { BALANCE, TIMING } from '../../core/balance';
import type { BattleSummary, GameState } from '../../core/engine';
import { evolvedForm, keepCount } from '../../core/rules/growth';
import type { Monster, PendingChoice, Save } from '../../core/save';
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
/** S12 결과 한 칸 — 글자만 (아이콘 · 기호는 화면 ResultBox 가 kind 로 붙임: 볼 · 돈 · 선물 · ▲ · ★) */
export interface SummaryPart {
  kind: 'caught' | 'money' | 'item' | 'up' | 'exp' | 'learned' | 'quote';
  text: string;
}

export function summaryLines(s: BattleSummary): { title: string; head: SummaryPart[]; body: SummaryPart[] } {
  const head: SummaryPart[] = [];
  if (s.caught) head.push({ kind: 'caught', text: s.caught.toBox ? `팀이 다 차서 ${s.caught.name} → 보관함` : `${s.caught.name} 팀에 들어옴` });
  if (s.money > 0) head.push({ kind: 'money', text: `+${s.money}원` });
  if (s.item) head.push({ kind: 'item', text: s.item });
  // 레벨이 오른 포켓몬을 앞에 (묻히지 않게) · 나머지는 뒤에
  const body: SummaryPart[] = [
    ...s.exp.filter((e) => e.to > e.from).map((e): SummaryPart => ({ kind: 'up', text: `${e.name} Lv ${e.from} → ${e.to} (경험치 +${e.gain})` })),
    ...s.exp.filter((e) => e.to <= e.from).map((e): SummaryPart => ({ kind: 'exp', text: `${e.name} 경험치 +${e.gain}` })),
  ];
  for (const l of s.learned) body.push({ kind: 'learned', text: `${withJosa(l.name, '이/가')} ${withJosa(l.move, '을/를')} 배웠다` });
  // 라이벌 한마디 (gdd 4.12) — 둘째 줄 맨 끝 (좁은 패널에서 레벨업이 잘리지 않게)
  if (s.quote) body.push({ kind: 'quote', text: s.quote });
  return { title: s.title, head, body };
}

/** S12 레벨업한 포켓몬 — 그림 · 남은 포인트 (누르면 내 포켓몬 판에서 스탯 찍기, 2026-10-20 태현 님) */
export interface LevelUpView {
  uid: string;
  name: string;
  from: number;
  to: number;
  form: string;
  shiny: boolean;
  /** 지금 남은 포인트 (이번 레벨업 + 전에 안 쓴 것) */
  points: number;
}

/** 레벨이 오른 팀 포켓몬 (결과 순서대로) — 팀에서 빠졌거나 없는 포켓몬은 뺌 */
export function levelUps(s: BattleSummary, save: Save): LevelUpView[] {
  return s.exp.flatMap((e) => {
    const m = save.monsters[e.uid];
    return e.to > e.from && m ? [{ uid: e.uid, name: e.name, from: e.from, to: e.to, form: m.form, shiny: m.shiny, points: m.unspentPoints }] : [];
  });
}

/** S12 잡은 포켓몬 소개 카드 (결과 상자 전 1.5초 — 2026-10-20 태현 님 안 2) — 그림 · 이름 · Lv · 타입 · NEW 도감 등록 · 팀 / 보관함 */
export interface CaughtView {
  uid: string;
  name: string;
  form: string;
  shiny: boolean;
  level: number;
  species: number;
  toBox: boolean;
  isNew: boolean;
}

export function caughtView(s: BattleSummary, save: Save): CaughtView | null {
  const m = s.caught ? save.monsters[s.caught.uid] : undefined;
  if (!s.caught || !m) return null;
  return { uid: s.caught.uid, name: s.caught.name, form: m.form, shiny: m.shiny, level: m.level, species: m.species, toBox: s.caught.toBox, isNew: s.caught.isNew };
}

/**
 * 고른 포인트를 한 번이라도 나눠 봤는지 — 레벨마다 자동 A 개가 points 에 · 고르는 F 개가 unspentPoints 에 쌓이므로
 * 오른 레벨 수 L = (points 합 + 남은) ÷ (A + F) · 직접 나눈 수 = points 합 − A × L. 세이브에 따로 적지 않고 알아냄
 */
export function monsterSpentPoints(m: Monster): number {
  const sum = Object.values(m.points).reduce((n, v) => n + v, 0);
  const levels = (sum + m.unspentPoints) / (BALANCE.pointsAutoPerLevel + BALANCE.pointsFreePerLevel);
  return Math.round(sum - BALANCE.pointsAutoPerLevel * levels);
}

/** S12 얼굴 카드 안내 말풍선 "눌러서 스탯 찍기" — 스탯을 한 번도 안 찍어 본 동안만 (찍어 보면 안 나옴, 2026-10-20 태현 님 "설명이 없으면 누를까?") */
export function needsStatHint(save: Save, ups: LevelUpView[]): boolean {
  return ups.some((u) => u.points > 0) && !Object.values(save.monsters).some((m) => monsterSpentPoints(m) > 0);
}

/** 결과 한 칸을 글자 한 줄로 (마우스를 올렸을 때) */
export function partText(p: SummaryPart): string {
  return p.kind === 'up' ? `▲ ${p.text}` : p.kind === 'learned' ? `★ ${p.text}` : p.text;
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
