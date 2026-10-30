/**
 * S12 전투 결과 · S23 기술 배우기 · S22 진화 — 화면을 모르는 부분: 무엇을 어떤 글로 보여 줄지.
 */
import { TIMING } from '../../core/balance';
import type { BattleSummary, GameState } from '../../core/engine';
import { evolvedForm, keepCount } from '../../core/rules/growth';
import { starGrade } from '../../core/rules/stats';
import type { Monster, PendingChoice, Save } from '../../core/save';
import { typeNameKo, withJosa } from '../../core/text';
import { moveOf, speciesOf } from '../../data';

const nameOf = (dex: number) => speciesOf(dex)?.name.ko ?? '???';

export interface MoveView {
  id: number;
  name: string;
  /** "위력 45 · 풀 · PP 25" */
  detail: string;
  /** 버튼 옆 작은 글 "위력 45" (변화 기술은 "변화") — 전투 기술 줄과 같은 말 (orders #119 · "풀 45" 는 숫자 뜻이 없어 PP 와 헷갈림) */
  short: string;
  /** 타입 "풀" — 넓으면 short 앞에 "풀 · " (잊을 기술을 고를 근거 — 위력만 남기면 넷이 "위력 40 · 45 · 40 · 40" 이던 것, UX #119) */
  typeKo: string;
}

export function moveView(id: number, pp?: number): MoveView {
  const mv = moveOf(id);
  if (!mv) return { id, name: '?', detail: '', short: '', typeKo: '' };
  const power = mv.power > 0 ? `위력 ${mv.power}` : '변화';
  return { id, name: mv.name.ko, detail: `${power} · ${typeNameKo(mv.type)} · PP ${pp ?? mv.pp}/${mv.pp}`, short: power, typeKo: typeNameKo(mv.type) };
}

/** S12 한 줄씩 — 첫 줄 (제목 · 잡은 포켓몬 · 돈 · 아이템) · 둘째 줄 (경험치 · 레벨업 · 새 기술) */
/** S12 결과 한 칸 — 글자만 (아이콘 · 기호는 화면 ResultBox 가 kind 로 붙임: 볼 · 돈 · 선물 · ▲ · ★) */
export interface SummaryPart {
  kind: 'caught' | 'money' | 'item' | 'treasure' | 'up' | 'exp' | 'learned' | 'quote';
  text: string;
  /** 넘칠 때 짧은 말 (배운 기술 = 기술 이름만 — ResultBox learnShort) */
  short?: string;
  /** 경험치 칸 — 누구 (3:3 결과 쓰러진 칸 "기절" 칩을 uid 로 붙임) · 여럿을 한 줄로 묶은 칸은 entries */
  uid?: string;
  name?: string;
  entries?: readonly { uid: string; name: string; gain: number }[];
}

export function summaryLines(s: BattleSummary): { title: string; head: SummaryPart[]; body: SummaryPart[] } {
  const head: SummaryPart[] = [];
  if (s.caught) head.push({ kind: 'caught', text: s.caught.toBox ? `팀이 다 차서 ${s.caught.name} → 보관함` : `${s.caught.name} 팀에 들어옴` });
  if (s.money > 0) head.push({ kind: 'money', text: `+${s.money}원` });
  if (s.item) head.push({ kind: 'item', text: s.item });
  // 보물 (팔 물건 — 다음 버전 2단계, 이름 글) = 받은 아이템처럼 한 칸 · 그림은 그 물건 아이콘 (ResultBox)
  if (s.treasure) head.push({ kind: 'treasure', text: s.treasure });
  // 레벨이 오른 포켓몬을 앞에 (묻히지 않게) · 나머지는 뒤에
  const body: SummaryPart[] = [
    ...s.exp.filter((e) => e.to > e.from).map((e): SummaryPart => ({ kind: 'up', text: `${e.name} Lv ${e.from} → ${e.to} (경험치 +${e.gain})` })),
    // 이름 · 경험치 · 숫자는 한 덩어리 (낱말 단위 줄 바꿈에서 "▲ 잠만보 Lv 15 · 피카츄 / 경험치 +260" 으로 갈려 피카츄가 레벨업 목록처럼 읽히던 것 — 개발 713 UX)
    ...s.exp.filter((e) => e.to <= e.from).map((e): SummaryPart => ({ kind: 'exp', text: `${e.name}\u00a0경험치\u00a0+${e.gain}`, uid: e.uid, name: e.name })),
  ];
  for (const l of s.learned) body.push({ kind: 'learned', text: `${withJosa(l.name, '이/가')} ${withJosa(l.move, '을/를')} 배웠다`, short: l.move });
  // 라이벌 한마디 (gdd 4.12) — 둘째 줄 맨 끝 (좁은 패널에서 레벨업이 잘리지 않게)
  if (s.quote) body.push({ kind: 'quote', text: s.quote });
  return { title: s.title, head, body };
}

/**
 * S12 상자 제목을 보일지 — 트레이너를 이긴 판 ("○○과의 승부에서 이겼다!") 은 숫자만 (기획 판단 2026-10-26 — 3:3 띠 "…3:3 승부에서 이겼다!" · 1:1 전투 한 줄 뒤
 * 상자 제목이 같은 말을 또 하던 것, 아트 원칙 "글은 반으로"). 관장 ("관장 ○○를 이겼다!" — 배지 순간) · 야생 (잡았다 · 쓰러뜨렸다) · 라이벌 (전적 · 한마디가 붙는 판) 은 그대로
 */
export function resultTitleShown(s: BattleSummary): boolean {
  return !!s.rival || s.badge !== null || !/의 (3:3 )?승부에서 이겼다!$/.test(s.title);
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

/** S12 잡은 포켓몬 소개 카드 (결과 상자 전 1.5초 — 2026-10-20 태현 님 안 2) — 그림 · 이름 · Lv · 타입 · NEW! 처음 잡았다 · 팀 / 보관함 */
export interface CaughtView {
  uid: string;
  name: string;
  form: string;
  shiny: boolean;
  level: number;
  species: number;
  toBox: boolean;
  isNew: boolean;
  /** ★ 등급 1 ~ 5 (개체값 — 보관함 · 프로필과 같은 값, orders #120 "잡고나서 보관함 들어가서 봐야되니까") */
  star: number;
}

/** 소개 카드 크기 (테두리 포함) — 잡기 흔들기 창 (104 × 108) 과 같은 높이 · 같은 가운데에서 가로로 넓어짐. 자리는 StageScreen 이 정수 px 로 */
export const CAUGHT_INTRO_W = 248;
export const CAUGHT_INTRO_H = 108;

export function caughtView(s: BattleSummary, save: Save): CaughtView | null {
  const m = s.caught ? save.monsters[s.caught.uid] : undefined;
  if (!s.caught || !m) return null;
  return { uid: s.caught.uid, name: s.caught.name, form: m.form, shiny: m.shiny, level: m.level, species: m.species, toBox: s.caught.toBox, isNew: s.caught.isNew, star: starGrade(m.ivs) };
}

/** S12 얼굴 카드 안내 말풍선 "눌러서 스탯 찍기" — 이번 전투에서 레벨업해 찍을 포인트가 있는 포켓몬이 있으면 매번 (2026-10-20 태현 님 "설명이 없으면 누를까?" → "레벨업 할 때마다 나오게 해줘 그냥", 예전엔 한 번도 안 찍어 본 동안만) */
export function needsStatHint(ups: LevelUpView[]): boolean {
  return ups.some((u) => u.points > 0);
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
      /** 진화를 보기 전 "어…? ○○의 모습이…!" 에서 기다림 (Space · 클릭으로 시작 — 2026-10-21 ideas #33) */
      waiting: boolean;
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
    waiting: st.ms < 0,
    current,
    fresh,
    keep: keepCount(m, c.newMoves),
  };
}

/** 화면을 다시 그릴지 보는 열쇠 (결과 · 고르기는 멈춰 있으니 바뀔 때만) */
export function resultViewKey(state: GameState): string {
  const st = state.runtime.stage;
  // 잡았으면 소개 카드 → 결과 상자로 넘어갈 때도 다시 그림 (빠지면 소개 카드가 결과 끝까지 남아 결과 상자가 안 보임 — UX 리뷰어 2026-10-21)
  if (st?.phase === 'result') return `result:${st.summary.title}:${!!st.summary.caught && st.ms >= TIMING.caughtIntroMs}`;
  if (st?.phase !== 'choice') return '';
  const c = state.save.pendingChoices[0];
  // ms < 0 = 진화를 보기 전 기다림 → 보기 시작하면 다시 그림 (2026-10-21 ideas #33)
  return `choice:${state.save.pendingChoices.length}:${c ? JSON.stringify(c) : ''}:${st.ms < 0}:${st.ms >= TIMING.evolveAnimMs}`;
}
