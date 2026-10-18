/**
 * S06 스테이지 — 화면을 모르는 부분: 스테이지 이름표 · 길 위의 것들을 화면 어디에 그릴지.
 * 주인공은 제자리걸음, 배경 · 길 위의 것들이 오른쪽 → 왼쪽으로 흐름 (gdd S06 ③).
 */
import { BALANCE } from '../../core/balance';
import type { GameState } from '../../core/engine';
import { planWild, sceneryAt, type Scenery, type WildPlan } from '../../core/rules/encounter';
import { requestAt, type RequestTemplate } from '../../core/rules/request';
import { stageLayout } from '../../core/rules/stage';
import type { FacilitySpot, StageId } from '../../core/save';
import { battleViewKey } from '../battle/model';

export interface StageInfo {
  id: StageId;
  /** 스테이지 이름 (gdd: 이름은 [아이디어] 예시) */
  name: string;
  /** 번호 — 화면에는 작게 (mvp-spec S06 ②) */
  code: string;
  icon: string;
}

export const STAGES: Readonly<Record<StageId, StageInfo>> = {
  'forest-1': { id: 'forest-1', name: '새싹 오솔길', code: '1-1', icon: '🌲' },
  'forest-2': { id: 'forest-2', name: '버섯 그늘길', code: '1-2', icon: '🍄' },
  'forest-3': { id: 'forest-3', name: '깊은 숲', code: '1-3', icon: '🌳' },
};

/** "🌲 새싹 오솔길 (1-1)" — 글로만 쓸 때 (클리어 카드 문구 등). 화면 이름표는 STAGES 로 번호를 따로 작게 */
export function stageLabel(id: StageId): string {
  const s = STAGES[id];
  return `${s.icon} ${s.name} (${s.code})`;
}

/** 걷는 빠르기 (화면, 크기 배율 1 일 때 px/초) — 길 위의 것들 사이가 넓은 패널에서도 한두 개씩 보이게 [제안] */
export const WALK_PX_PER_SEC = 24;

/** 스테이지 전체 길이 (px) */
export function stagePx(scale: number): number {
  return (BALANCE.stageWalkMs / 1000) * WALK_PX_PER_SEC * scale;
}

/** 주인공이 서는 자리 — "화면 가운데쯤" (gdd S06 ③ [확정]), 앞에서 다가오는 것이 조금 더 보이게 가운데보다 살짝 왼쪽 (45%) */
export function heroX(widthPx: number): number {
  return Math.max(48, Math.round(widthPx * 0.45));
}

/** 만나는 것과 주인공 사이 거리 — 이만큼 앞에 왔을 때 만남 (크기 배율 1 일 때 px) */
export const CONTACT_PX = 44;

export type StageObject =
  | { key: string; kind: 'wild'; x: number; plan: WildPlan; met: boolean }
  | { key: string; kind: 'item'; x: number }
  | { key: string; kind: 'request'; x: number; template: RequestTemplate; active: boolean }
  | { key: string; kind: 'facility'; x: number; facility: FacilitySpot }
  | { key: string; kind: 'scenery'; x: number; scenery: Scenery };

/**
 * 지금 화면에 보이는 것 (왼쪽 → 오른쪽). 지나간 아이템 · 야생은 안 보임 (주웠고 · 쓰러뜨림),
 * 부탁하던 사람 · 시설 · 배경은 지나간 뒤에도 화면 밖으로 나갈 때까지 보임
 */
export function visibleObjects(state: GameState, widthPx: number, scale: number): StageObject[] {
  const save = state.save;
  if (save.location.screen !== 'stage') return [];
  const id = save.location.stageId;
  const prog = save.stages[id];
  if (!prog) return [];
  const layout = stageLayout(id, prog.seed, prog.facilities);
  const len = stagePx(scale);
  const hero = heroX(widthPx);
  const contact = contactX(widthPx, scale);
  const margin = 80 * scale;
  const inView = (x: number) => x > -margin && x < widthPx + margin;
  const stage = state.runtime.stage;
  const out: StageObject[] = [];

  for (const s of layout.scenery) {
    const x = hero + (s.at - prog.progress) * len;
    if (inView(x)) out.push({ key: `sc${s.index}`, kind: 'scenery', x, scenery: sceneryAt(id, prog.seed, s.index) });
  }
  for (const f of layout.facilities) {
    const x = hero + (f.at - prog.progress) * len;
    if (inView(x)) out.push({ key: `f${f.kind}${f.at}`, kind: 'facility', x, facility: f });
  }
  let requestNumber = 0;
  for (const s of layout.spots) {
    // 아이템은 주인공 발밑에서 줍고, 야생 · 부탁은 주인공 바로 앞에서 만남
    const x = (s.kind === 'item' ? hero : contact) + (s.at - prog.progress) * len;
    const number = s.kind === 'request' ? requestNumber++ : 0;
    if (!inView(x)) continue;
    const reached = s.at <= prog.progress;
    if (s.kind === 'wild') {
      // 만난 자리: 튀어나오는 동안만 그 포켓몬으로 (전투 중에는 전투 층이 같은 자리에 그림), 끝나면 사라짐
      const meeting = reached && s.at === prog.progress && stage?.phase === 'appear';
      if (!reached || meeting) out.push({ key: `w${s.index}`, kind: 'wild', x, plan: planWild(id, prog.seed, s), met: meeting });
    } else if (s.kind === 'item') {
      if (!reached) out.push({ key: `i${s.index}`, kind: 'item', x });
    } else {
      const active = stage?.phase === 'request' && stage.at === s.at;
      out.push({ key: `r${s.index}`, kind: 'request', x, template: requestAt(prog.seed, number), active });
    }
  }
  return out.sort((a, b) => a.x - b.x);
}

/** 야생이 튀어나온 자리 (= 전투하는 자리, gdd S09: 야생은 튀어나온 그 자리에서 싸움) */
export function contactX(widthPx: number, scale: number): number {
  return heroX(widthPx) + CONTACT_PX * scale;
}

/** 미니맵 (S06 ②): 진행 % · 병원 · 상점 · 체육관 자리 */
export function minimapOf(state: GameState): { progress: number; facilities: readonly FacilitySpot[]; gym: boolean } | null {
  const save = state.save;
  if (save.location.screen !== 'stage') return null;
  const prog = save.stages[save.location.stageId];
  if (!prog) return null;
  const layout = stageLayout(save.location.stageId, prog.seed, prog.facilities);
  return { progress: prog.progress, facilities: layout.facilities, gym: save.location.stageId === 'forest-3' };
}

/**
 * 화면에 보이는 것이 바뀌었는지 보는 열쇠 — 플레이 시간은 늘 바뀌니 빼고, 진행 · 단계 · 알림 · 볼 · 시작 상태만.
 * 부탁 · 끝처럼 멈춰 있을 때는 초당 30번 다시 그리지 않게 (main.ts)
 */
export function stageViewKey(state: GameState): string {
  const st = state.runtime.stage;
  const loc = state.save.location;
  const progress = loc.screen === 'stage' ? (state.save.stages[loc.stageId]?.progress ?? -1) : -1;
  const pending = state.save.pendingEncounter;
  return [
    loc.screen,
    progress,
    st?.phase ?? '',
    st?.phase === 'appear' ? `${st.space}:${st.ms <= BALANCE.preemptiveWindowMs}` : '',
    st?.phase === 'request' ? `${st.result?.text ?? ''}` : '',
    state.runtime.toast?.text ?? '',
    state.save.bag['poke-ball'] ?? 0,
    pending?.kind === 'wild' ? pending.start : '',
    st?.phase === 'battle' ? battleViewKey(st.battle, state.save.settings.autoBattle) : '',
  ].join('|');
}
