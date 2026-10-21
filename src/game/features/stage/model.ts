/**
 * S06 스테이지 — 화면을 모르는 부분: 스테이지 이름표 · 길 위의 것들을 화면 어디에 그릴지.
 * 주인공은 제자리걸음, 배경 · 길 위의 것들이 오른쪽 → 왼쪽으로 흐름 (gdd S06 ③).
 */
import { BALANCE, TIMING } from '../../core/balance';
import { teamChoiceMeet, teamViewKey, waitReason, type BattleState, type GameState } from '../../core/engine';
import { resumeLine } from '../../core/engine/play';
import { planWild, sceneryAt, type Scenery, type WildPlan } from '../../core/rules/encounter';
import { requestAt, type RequestTemplate } from '../../core/rules/request';
import { REGIONS } from '../../core/rules/region';
import { stageCode, stageLayout, trainerId } from '../../core/rules/stage';
import { aliveCount, GYM_LEADER, shortTrainerName, trainerInfo, trainerNumber, trainerTeamSize, type TrainerInfo } from '../../core/rules/trainer';
import { recordText, rivalName, rivalRecord, rivalTeamSize } from '../../core/rules/rival';
import { heroLookOf } from '../../data/heroes';
import type { FacilitySpot, Save, StageId } from '../../core/save';
import type { IconName } from '../../data/icons';
import { battleViewKey } from '../battle/model';
import { resultViewKey } from '../result/model';
import { teamChoiceOn } from '../battle/team/TeamChoice';

/** 메뉴 · 대기실 · 병원에 보이는 세이브 값 (팀 · 돈 · 가방) — 바뀌면 다시 그림 */
function saveViewKey(save: Save): string {
  const team = save.party.map((uid) => {
    const m = save.monsters[uid];
    return m ? `${uid}:${m.species}:${m.level}:${m.hp}:${m.unspentPoints}:${m.status?.kind ?? ''}` : uid;
  });
  // 쌓아 둔 기술 고르기 수 · 본 안내 · 설정 (자동 전투 상처약 · 잡은 종 건너뛰기) — 2026-10-21 ideas #72 · #65 · #35 · orders #12
  const s = save.settings;
  return [save.money, team.join(','), save.box.length, JSON.stringify(save.bag), s.notifications, save.badges.length, save.laterChoices?.length ?? 0, save.tips?.length ?? 0, s.autoPotion !== false, s.skipCaughtLast === true].join('/');
}

export interface StageInfo {
  id: StageId;
  /** 스테이지 이름 (gdd: 이름은 [아이디어] 예시) */
  name: string;
  /** 번호 — 화면에는 작게 (mvp-spec S06 ②) */
  code: string;
  /** 픽셀 아이콘 (ui/Icon) */
  icon: IconName;
}

/** 지역 표 (core/rules/region — orders #35) 에서 — 숲 = 새싹 오솔길 1-1 · 버섯 그늘길 1-2 · 깊은 숲 1-3 */
export const STAGES: Readonly<Record<StageId, StageInfo>> = Object.fromEntries(
  Object.values(REGIONS).flatMap((r) => r.stages.map((s) => [s.id, { id: s.id, name: s.name, code: stageCode(s.id), icon: s.icon as IconName }])),
) as Record<StageId, StageInfo>;

/** "🌲 새싹 오솔길 (1-1)" — 글로만 쓸 때 (클리어 카드 문구 등). 화면 이름표는 STAGES 로 번호를 따로 작게 */
export function stageLabel(id: StageId): string {
  const s = STAGES[id];
  return `${s.name} (${s.code})`;
}

/** 걷는 빠르기 (화면, 크기 배율 1 일 때 px/초) — 길 위의 것들 사이가 넓은 패널에서도 한두 개씩 보이게 [제안] */
export const WALK_PX_PER_SEC = 57.6; // 48 → 57.6 (2026-10-21 태현 님 "1.2배" — 스테이지 길이 px 는 그대로, 걷는 시간 15 → 12.5분)

/** 스테이지 전체 길이 (px) */
export function stagePx(scale: number): number {
  return (BALANCE.stageWalkMs / 1000) * WALK_PX_PER_SEC * scale;
}

/**
 * 넓은 패널의 전투 무대 너비 — 패널이 이보다 넓으면 이 너비 안에서 싸움 (2026-10-19 리드 · 태현 님 "세세한 부분은 알아서 조정":
 * 1858px 패널에서 두 포켓몬이 565px · 트레이너끼리 1800px 떨어져 연출 · 눈이 화면을 가로지르던 것. 720 = 디자인 기준 화면 너비)
 */
export const BATTLE_STAGE_MAX_PX = 720;

/**
 * 주인공이 서는 자리 — "화면 가운데쯤" (gdd S06 ③ [확정]), 앞에서 다가오는 것이 조금 더 보이게 가운데보다 살짝 왼쪽 (45%).
 * 넓은 패널은 가운데 720px 무대 안의 45% (1858 → 48%) — 전투 무대가 패널 가운데에 오고, 야생은 튀어나온 자리 그대로 싸움
 * (2026-10-19 태현 님 "전투 화면이 애매하게 왼쪽으로 치우쳐 보여" — 예전엔 패널의 45% 라 무대가 57px 왼쪽)
 */
export function heroX(widthPx: number): number {
  if (widthPx > BATTLE_STAGE_MAX_PX) return Math.round((widthPx - BATTLE_STAGE_MAX_PX) / 2 + BATTLE_STAGE_MAX_PX * 0.45);
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
/** 병원 · 상점 건물 그림 (원작 파이어레드 포켓몬센터 · 프렌들리숍, scripts/buildings/fetch-pret-buildings.py) — 크기 (칸) · 문 가운데 x */
export const BUILDINGS: Readonly<Record<FacilitySpot['kind'], { file: string; w: number; h: number; door: number }>> = {
  hospital: { file: 'hospital', w: 80, h: 70, door: 40 },
  shop: { file: 'shop', w: 64, h: 62, door: 39 },
};
/** 간호순 · 점원의 왼쪽 끝 = 문 가운데 + 이만큼 칸 (문 반폭 8 + 틈 3 — 건물 앞, 문 오른쪽에 섬) */
const STAFF_FROM_DOOR = 11;

/** 건물을 그릴 크기 — k = 그림 1칸 = 화면 몇 px (사람과 같은 정수 배율 — heroDraw, 2026-10-19 태현 님 B안) · visible = 보이는 높이 (px, 자리보다 크면 지붕 위가 잘림) */
export function buildingDraw(kind: FacilitySpot['kind'], scale: number, roomPx: number): { k: number; visible: number } {
  const b = BUILDINGS[kind];
  const k = Math.max(1, Math.floor(scale));
  return { k, visible: Math.min(b.h * k, Math.max(0, Math.floor(roomPx))) };
}

/** 간호순 · 점원의 왼쪽 끝 (화면 px) — 건물 x (= 문 가운데) 기준 */
export function staffLeftPx(kind: FacilitySpot['kind'], x: number, scale: number, roomPx: number): number {
  return Math.round(x + STAFF_FROM_DOOR * buildingDraw(kind, scale, roomPx).k);
}

/** 1-3 길 끝 체육관 (2026-10-20 태현 님 A안 "1-3 끝 → 체육관 들어가기") — 원작 상록시티 체육관 외관 96 × 80 (scripts/buildings/fetch-pret-gym-front.py) ·
 *  문 칸 = (48, 64) 16 × 16 (열림 3장 gym-door-1 ~ 3) · 왼쪽 GYM 간판 기둥 16 × 24 */
export const GYM_FRONT = { file: 'gym-front', w: 96, h: 80, doorX: 48, doorY: 64, doorW: 16, post: { file: 'gym-post', w: 16, h: 24 } } as const;
/** 진행 1 (멈춘 곳) 에서 문 가운데 = 주인공 왼쪽 끝 + 이만큼 칸 앞 — gym-enter 첫 0.6초에 주인공이 문 앞까지 걸어감 */
const GYM_DOOR_AHEAD = 40;

/** 1-3 끝에 닿았을 때 (진행 1) 체육관 문 가운데 x — 간판 자리 (좁은 패널) 를 이 자리로 정해 다가오는 동안 바뀌지 않게.
 *  좁고 높은 패널 (240 × 315 — 배율이 커서) 은 문이 오른쪽 밖으로 나가지 않게 문 오른쪽 끝 + 8px 안으로 당김 (UX 리뷰어 2026-10-21) */
export const gymRestX = (widthPx: number, scale: number): number =>
  Math.min(heroX(widthPx) + GYM_DOOR_AHEAD * scale, widthPx - (GYM_FRONT.doorW / 2) * Math.max(1, Math.floor(scale)) - 8);

/** 길 끝 체육관 문 가운데 x (화면 px) — 1-3 에서 보일 때만 (멀면 null) */
export function gymFrontX(state: GameState, widthPx: number, scale: number): number | null {
  const save = state.save;
  if (save.location.screen !== 'stage' || save.location.stageId !== 'forest-3') return null;
  const prog = save.stages['forest-3'];
  if (!prog) return null;
  const x = gymRestX(widthPx, scale) + (1 - prog.progress) * stagePx(scale);
  return x < widthPx + GYM_FRONT.w * scale ? x : null;
}

/** gym-enter 장면 (엔진은 TIMING.gymEnterMs 만 지킴) — 0 ~ 0.6초 문 옆까지 걸음 (여섯 걸음 · 문을 가리지 않게) · 0.6 ~ 1.4 문이 열림 (3장) ·
 *  1.4 ~ 1.85 문 안으로 세 걸음 (한 칸씩 위로 · 흐려짐) · 2.0 ~ 2.4 화면 닦기 (여섯 걸음).
 *  walk = 문 옆까지 · enter = 문 옆 → 문 가운데 · wipe = 0 ~ 1, door = 0 (닫힘) ~ 3 (다 열림), rise = 위로 몇 칸, fade = 불투명도 */
export function gymEnterView(ms: number): { walk: number; enter: number; walking: boolean; door: 0 | 1 | 2 | 3; rise: number; fade: number; wipe: number } {
  const step = (t: number, n: number) => Math.min(1, Math.floor(Math.max(0, t) * n) / n);
  const walk = step(ms / 600, 6);
  const door = ms < 600 ? 0 : ms < 867 ? 1 : ms < 1133 ? 2 : 3;
  const into = ms < 1400 ? 0 : Math.min(3, Math.floor((ms - 1400) / 150) + 1);
  const fade = into <= 1 ? 1 : into === 2 ? 0.66 : ms < 1850 ? 0.33 : 0;
  const wipe = ms < 2000 ? 0 : step((ms - 2000) / 400, 6);
  return { walk, enter: into / 3, walking: ms < 600 || (ms >= 1400 && ms < 1850), door, rise: Math.max(0, into - 1), fade, wipe };
}

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
    } else if (s.kind === 'rival') {
      continue; // 라이벌은 길 위에 미리 안 보임 — 만날 때 오른쪽 끝에서 나타남 (gdd 4.12)
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
/** 라이벌 띠의 전적 칩 — 처음이면 "첫 만남!" (0승 0패는 뜻이 없어서 — 플레이 리뷰어) */
export function rivalTag(save: GameState['save'], id: string): string {
  const r = rivalRecord(save, id);
  return r.wins + r.losses === 0 ? '첫 만남!' : recordText(r);
}

export function foeTrainerView(state: GameState): { name: string; hat: string; shirt: string; look?: string; balls: number; left: number; talking: boolean; record?: string } | null {
  const save = state.save;
  const st = state.runtime.stage;
  const p = save.pendingEncounter;
  if (p?.kind === 'gym-leader' && st?.phase === 'battle' && st.battle.kind === 'gym') {
    const b = st.battle;
    return { name: GYM_LEADER.name, hat: GYM_LEADER.hat, shirt: GYM_LEADER.shirt, look: GYM_LEADER.look, ...foeBalls(b), talking: false };
  }
  // 라이벌 (gdd 4.12) — 주인공 그림 · "라이벌 휘웅" · 전적
  if (p?.kind === 'rival' && save.location.screen === 'stage') {
    const who = { name: rivalName(p.rival), hat: '#d8382e', shirt: '#2f6fd0', look: heroLookOf(p.rival).dir, record: rivalTag(save, p.rival) };
    if (st?.phase === 'rival') {
      const balls = rivalTeamSize(save, p.rival);
      return { ...who, balls, left: balls, talking: st.ms >= TIMING.trainerAlertMs };
    }
    if (st?.phase === 'battle' && st.battle.kind === 'trainer') return { ...who, ...foeBalls(st.battle), talking: false };
    return null;
  }
  if (p?.kind !== 'trainer' || save.location.screen !== 'stage') return null;
  const id = save.location.stageId;
  const prog = save.stages[id];
  if (!prog) return null;
  const n = trainerNumber(p.trainerId);
  const info = trainerInfo(id, n);
  if (st?.phase === 'trainer') {
    const balls = trainerTeamSize(prog.seed, n, aliveCount(save));
    return { name: info.name, hat: info.hat, shirt: info.shirt, look: info.look, balls, left: balls, talking: st.ms >= TIMING.trainerAlertMs };
  }
  if (st?.phase === 'battle' && st.battle.kind === 'trainer') {
    const b = st.battle;
    return { name: info.name, hat: info.hat, shirt: info.shirt, look: info.look, ...foeBalls(b), talking: false };
  }
  return null;
}

/** 야생이 튀어나온 자리 (= 전투하는 자리, gdd S09: 야생은 튀어나온 그 자리에서 싸움) */
export function contactX(widthPx: number, scale: number): number {
  return heroX(widthPx) + CONTACT_PX * scale;
}

/**
 * 전투 무대 (패널 안 왼쪽 끝 · 너비) — 무대 안 주인공 자리가 걷던 자리 (heroX) 와 같게 놓음 = 넓은 패널은 패널 가운데
 * → 야생은 튀어나온 자리 그대로 (contactX), 트레이너 · 상대 트레이너 · 관장은 무대 양 끝 (gdd S09 "양 끝" = 무대 기준). 좁은 패널은 패널 전체
 */
export function battleStage(widthPx: number): { left: number; width: number } {
  const width = Math.min(widthPx, BATTLE_STAGE_MAX_PX);
  return { left: heroX(widthPx) - heroX(width), width };
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
    // 부탁: 결과 · 저절로 [도와준다] 까지 남은 초 (ideas #115) / 패배: 저절로 다시 시작까지 남은 초 (#49) / 클리어 카드: 자동 전투면 [다음 스테이지] 까지 남은 초 (#48)
    st?.phase === 'request' ? `${st.result?.text ?? ''}:${st.result ? '' : Math.ceil((TIMING.requestAutoMs - st.ms) / 1000)}` : '',
    st?.phase === 'defeat' ? Math.ceil((TIMING.defeatAutoMs - (st.ms ?? 0)) / 1000) : '',
    st?.phase === 'clear' && state.save.settings.autoBattle ? Math.ceil((TIMING.clearAutoMs - (st.ms ?? 0)) / 1000) : '',
    // 병원 · 상점 앞: 남은 초 · 들어감 / 트레이너: "!" → "승부다!" / 패배 · 클리어 · 대기실 · 배지는 그대로
    st?.phase === 'facility' ? `${st.inside}:${Math.ceil((TIMING.facilityPromptMs - st.ms) / 1000)}` : '',
    st?.phase === 'trainer' ? `${st.n}:${st.ms >= TIMING.trainerAlertMs}:${st.ms >= meetVsAt(state)}:${st.vsAt ?? ''}` : '',
    // 3:3 고르기 막대 (만남 4초 · 3마리 고르기 10초) — 0.25초마다 (빠지면 막대가 꽉 찬 채 멈춰 있다 갑자기 줄었음 — 코드 리뷰어, 다시 그리는 열쇠 세 번째)
    st?.phase === 'trainer' && teamChoiceOn(state) ? `${Math.floor(st.ms / 250)}:${Math.floor((st.pickMs ?? 0) / 250)}` : '',
    st?.phase === 'rival' ? `${st.rival}:${st.ms >= TIMING.trainerAlertMs}:${st.ms >= vsStartMs('rival')}` : '',
    // 대기실 3마리 고르기 판 · 고른 셋
    st?.phase === 'lobby' ? `${st.picking ?? ''}:${(st.pick ?? []).join(',')}` : '',
    // 체육관 들어가기: 걸음 · 문 · 들어감 · 닦기가 한 걸음 바뀔 때마다 (빠지면 장면 내내 안 그려져 서 있다가 대기실로 — 2026-10-20 연속 캡처로 찾음)
    st?.phase === 'gym-enter' ? JSON.stringify(gymEnterView(st.ms)) : '',
    // 기다리는 이유 (밖 · 숨김 — 이로치 전투가 멈추면 걸음이 안 바뀌어 기다림 한 줄이 안 그려지던 것)
    waitReason(state) ?? '',
    // 보는 상태 (밖 · 숨김) — 멈춘 장면 (대기실 등) 에서 돌아와도 안 그려져 처음 안내가 멈춘 채 남던 것 (다시 그리는 열쇠 네 번째, UX 리뷰어 R12 재확인)
    state.runtime.away === true ? 'away' : '',
    state.runtime.headless === true ? 'hidden' : '',
    // 다시 켜기 한 줄 (R15 — 2초 뒤 사라짐)
    resumeLine(state) ?? '',
    state.runtime.toast?.text ?? '',
    saveViewKey(state.save),
    pending?.kind === 'wild' ? pending.start : '',
    st?.phase === 'battle' ? battleViewKey(st.battle, state.save.settings.autoBattle) : '',
    st?.phase === 'team' ? teamViewKey(st.team) : '',
    resultViewKey(state),
  ].join('|');
}

/** VS 컷인 길이 · 시작 — 만남 단계 끝 2초 ("승부다!" 띠 다음, 2026-10-20 태현 님 B안 · "휙 지나가 읽지도 못해" 0.8 → 2초) · 클릭 · Space · Enter 로 바로 넘김 */
export const VS_MS = TIMING.vsMs;
export function vsStartMs(phase: 'trainer' | 'rival'): number {
  return (phase === 'rival' ? TIMING.rivalMeetMs : TIMING.trainerMeetMs) - VS_MS;
}
/** 지금 만남의 VS 시작 ms — 3:3 을 고를 수 있는 만남은 고른 때 (stage.vsAt, 아직이면 Infinity), 그 밖은 만남 끝 2초 전 */
export function meetVsAt(state: GameState): number {
  const st = state.runtime.stage;
  if (st?.phase !== 'trainer') return vsStartMs(st?.phase === 'rival' ? 'rival' : 'trainer');
  if (st.vsAt !== undefined) return st.vsAt;
  const old = vsStartMs('trainer');
  // 고르는 중 (VS 아직) — 예전 길 VS 가 나오던 중에 자동 전투를 끄면 그 VS 그대로 (엔진이 다음 걸음에 vsAt = old)
  if (st.ask || teamChoiceMeet(state)) return !st.ask && st.ms >= old ? old : Infinity;
  return old;
}

/**
 * 접힌 줄 (150px 아래 = 숨김) 의 지금 상태 (2026-10-20 플레이 리뷰어 "접어 두고 코딩할 때 자동 전투가 켜졌는지 몰라 첫 전투에서 멈춤") ·
 * 기다리는 장면이면 그 장면 (gdd 4.13 R13 ② — "깊은 숲 63% · 반짝이는 흔적에서 기다려요 · ▲ 올리면 이어서") · 아니면 자동 전투 켜짐 / 꺼짐 (꺼짐 = 접혀 있는 동안 전부 멈춤)
 */
export function foldStatus(state: GameState): string {
  const loc = state.save.location;
  const where = loc.screen === 'stage' ? `${STAGES[loc.stageId].name} ${Math.min(100, Math.floor((state.save.stages[loc.stageId]?.progress ?? 0) * 100))}%` : loc.screen === 'gym' ? '숲 체육관' : '세계 지도';
  // ▲ 는 뒤 낱말과 한 덩이 (줄 끝에 "▲" 혼자 남던 것 — 픽셀 검사원) · 할 일이 앞 · 어디는 끝 · 자동 꺼짐은 켜는 방법까지 (접힌 채로는 켤 곳이 없음 — gdd 4.13 · ideas #155) (한 줄 높이에서 앞부분만 보여도 할 일을 앎 — UX 리뷰어 #27) · 구분점은 앞 낱말에 붙여 줄이 "·" 로 시작하지 않게
  const sep = '\u00a0· ';
  // 어디 ("새싹 오솔길 47%") 는 한 덩이 — 240 × 30 에서 "… · 새싹" 으로 끝나고 "오솔길 47%" 가 숨던 것 (UX 리뷰어)
  const place = where.replace(/ /g, '\u00a0');
  const wait = foldWait(state);
  if (wait) return [wait, '▲\u00a0올리면 이어서', place].join(sep);
  return (state.save.settings.autoBattle ? ['자동 전투 켜짐 — 전투도 저절로', '▲\u00a0올리면 보여요', place] : ['자동 전투 꺼짐 — 접혀 있는 동안 멈춰 있어요', '▲\u00a0올려서 자동 전투를 켜면 계속 걸어요', place]).join(sep);
}

/** 숨김에서도 기다리는 장면의 한 줄 · 없으면 null — 고르기는 엔진 waitReason (gdd 4.13 표와 늘 같음, 개발팀 f2002de) + 사람이 먼저 들어간 병원 · 상점 안 (알림은 없지만 멈춰 있음) */
export function foldWait(state: GameState): string | null {
  const st = state.runtime.stage;
  switch (waitReason(state)) {
    case 'shiny':
      return st?.phase === 'hold' ? '반짝이는 흔적에서 기다려요' : '반짝이는 포켓몬 앞에서 기다려요';
    case 'rival':
      return '라이벌이 길에서 기다려요';
    case 'battle':
      return '전투가 기다려요 — 내 차례';
    case 'choice':
      return '진화 · 새 기술을 고를 차례예요';
    case 'defeat':
      return st?.phase === 'defeat' && st.keep !== undefined ? `${shortTrainerName(st.keep)}에게 졌다 — 남은 포켓몬으로 계속` : '포켓몬들이 쓰러졌어요 — 다시 시작을 기다려요';
    case 'clear':
      return '스테이지를 깼어요 — 다음 스테이지를 골라요';
    case 'gym':
      return '체육관 대기실에서 기다려요';
    case 'badge':
      return '관장을 이겼어요! 배지를 받았어요';
    default:
      return st?.phase === 'facility' && st.inside ? `${st.kind === 'hospital' ? '병원' : '상점'} 안에서 기다려요` : null;
  }
}
