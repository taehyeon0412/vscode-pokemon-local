/**
 * S06 스테이지 — 화면을 모르는 부분: 스테이지 이름표 · 길 위의 것들을 화면 어디에 그릴지.
 * 주인공은 제자리걸음, 배경 · 길 위의 것들이 오른쪽 → 왼쪽으로 흐름 (gdd S06 ③).
 */
import { BALANCE, TIMING } from '../../core/balance';
import type { BattleState, GameState } from '../../core/engine';
import { planWild, sceneryAt, type Scenery, type WildPlan } from '../../core/rules/encounter';
import { requestAt, type RequestTemplate } from '../../core/rules/request';
import { stageLayout, trainerId } from '../../core/rules/stage';
import { aliveCount, GYM_LEADER, trainerInfo, trainerNumber, trainerTeamSize, type TrainerInfo } from '../../core/rules/trainer';
import type { FacilitySpot, Save, StageId } from '../../core/save';
import { battleViewKey } from '../battle/model';
import { resultViewKey } from '../result/model';

/** 메뉴 · 대기실 · 병원에 보이는 세이브 값 (팀 · 돈 · 가방) — 바뀌면 다시 그림 */
function saveViewKey(save: Save): string {
  const team = save.party.map((uid) => {
    const m = save.monsters[uid];
    return m ? `${uid}:${m.species}:${m.level}:${m.hp}:${m.unspentPoints}:${m.status?.kind ?? ''}` : uid;
  });
  return [save.money, team.join(','), save.box.length, JSON.stringify(save.bag), save.settings.notifications, save.badges.length].join('/');
}

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

/** 병원 · 상점 건물이 주인공보다 이만큼 앞에 그려짐 (크기 배율 1 일 때 px) */
const FACILITY_PX = 20;

/** 만나는 것과 주인공 사이 거리 — 이만큼 앞에 왔을 때 만남 (크기 배율 1 일 때 px) */
export const CONTACT_PX = 44;

export type StageObject =
  | { key: string; kind: 'wild'; x: number; plan: WildPlan; met: boolean }
  | { key: string; kind: 'item'; x: number }
  | { key: string; kind: 'request'; x: number; template: RequestTemplate; active: boolean }
  /** 트레이너 — 이긴 트레이너는 안 보임 · alert = 눈이 마주침 ("!") */
  | { key: string; kind: 'trainer'; x: number; n: number; info: TrainerInfo; alert: boolean }
  /** active = 그 앞에 멈춰 있음 ([들어가기] [지나가기]) */
  | { key: string; kind: 'facility'; x: number; facility: FacilitySpot; active: boolean }
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
    // 주인공 바로 앞 (멈췄을 때 건물 앞에 서 있게 — 뒤에 가려지지 않게)
    const x = hero + FACILITY_PX * scale + (f.at - prog.progress) * len;
    const active = stage?.phase === 'facility' && stage.at === f.at;
    if (inView(x)) out.push({ key: `f${f.kind}${f.at}`, kind: 'facility', x, facility: f, active });
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
      if (!reached || meeting) out.push({ key: `w${s.index}`, kind: 'wild', x, plan: planWild(id, prog.seed, s, prog.run.retries), met: meeting });
    } else if (s.kind === 'item') {
      // 졌다 다시 걸을 때 이미 주운 아이템 (reach 앞) 은 안 보임
      if (!reached && s.at > prog.run.reach) out.push({ key: `i${s.index}`, kind: 'item', x });
    } else if (s.kind === 'trainer') {
      // 이긴 트레이너는 다시 안 보임 · 만나는 동안 (전투 중에는 오른쪽 끝 트레이너 자리에) 만 그 자리에
      const n = s.trainer ?? 0;
      const meeting = stage?.phase === 'trainer' && stage.n === n;
      if (prog.defeatedTrainers.includes(trainerId(id, n)) || (reached && !meeting)) continue;
      out.push({ key: `t${s.index}`, kind: 'trainer', x, n, info: trainerInfo(id, n), alert: meeting });
    } else {
      if (s.at <= prog.run.reach && !(stage?.phase === 'request' && stage.at === s.at)) continue; // 이미 고른 부탁
      const active = stage?.phase === 'request' && stage.at === s.at;
      out.push({ key: `r${s.index}`, kind: 'request', x, template: requestAt(prog.seed, number), active });
    }
  }
  return out.sort((a, b) => a.x - b.x);
}

/** 상대 볼 — 전부 (쓰러뜨린 + 지금 + 남은) · 남은 것 (쓰러진 지금 상대는 이미 foeDown 에 있음 — 테스터) */
function foeBalls(b: BattleState): { balls: number; left: number } {
  const now = b.foe.hp > 0 ? 1 : 0;
  return { balls: b.foeDown.length + now + b.foeQueue.length, left: now + b.foeQueue.length };
}

/**
 * S08 트레이너와 마주침 — "!" (잠깐) → 말풍선 "승부다!" + 상대 몬스터볼 개수 ◓ (어떤 포켓몬인지는 안 보임) · 전투 중 오른쪽 끝 트레이너 (남은 볼)
 * 트레이너 · 관장이 아니면 null
 */
export function foeTrainerView(state: GameState): { name: string; hat: string; shirt: string; balls: number; left: number; talking: boolean } | null {
  const save = state.save;
  const st = state.runtime.stage;
  const p = save.pendingEncounter;
  if (p?.kind === 'gym-leader' && st?.phase === 'battle' && st.battle.kind === 'gym') {
    const b = st.battle;
    return { name: GYM_LEADER.name, hat: GYM_LEADER.hat, shirt: GYM_LEADER.shirt, ...foeBalls(b), talking: false };
  }
  if (p?.kind !== 'trainer' || save.location.screen !== 'stage') return null;
  const id = save.location.stageId;
  const prog = save.stages[id];
  if (!prog) return null;
  const n = trainerNumber(p.trainerId);
  const info = trainerInfo(id, n);
  if (st?.phase === 'trainer') {
    const balls = trainerTeamSize(prog.seed, n, aliveCount(save));
    return { name: info.name, hat: info.hat, shirt: info.shirt, balls, left: balls, talking: st.ms >= TIMING.trainerAlertMs };
  }
  if (st?.phase === 'battle' && st.battle.kind === 'trainer') {
    const b = st.battle;
    return { name: info.name, hat: info.hat, shirt: info.shirt, ...foeBalls(b), talking: false };
  }
  return null;
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
    loc.screen === 'stage' ? loc.stageId : '',
    progress,
    st?.phase ?? '',
    st?.phase === 'appear' ? `${st.space}:${st.ms <= BALANCE.preemptiveWindowMs}` : '',
    st?.phase === 'request' ? `${st.result?.text ?? ''}` : '',
    // 병원 · 상점 앞: 남은 초 · 들어감 / 트레이너: "!" → "승부다!" / 패배 · 클리어 · 대기실 · 배지는 그대로
    st?.phase === 'facility' ? `${st.inside}:${Math.ceil((TIMING.facilityPromptMs - st.ms) / 1000)}` : '',
    st?.phase === 'trainer' ? `${st.n}:${st.ms >= TIMING.trainerAlertMs}` : '',
    state.runtime.toast?.text ?? '',
    saveViewKey(state.save),
    pending?.kind === 'wild' ? pending.start : '',
    st?.phase === 'battle' ? battleViewKey(st.battle, state.save.settings.autoBattle) : '',
    resultViewKey(state),
  ].join('|');
}
