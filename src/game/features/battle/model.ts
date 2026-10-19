/**
 * S09 전투 화면 — 화면을 모르는 부분: 메뉴에 무엇이 있고 무엇이 흐린지 · 단축키 · 연출 모양 고르기.
 */
import type { BattleAction, BattlePopup, BattleState, Side } from '../../core/engine';
import { canAct, counterOpen, faintedTeam, itemLeft, switchable, ultCounterOpen } from '../../core/engine';
import { isShooting } from '../../core/rules/battle';
import { BALLS, isBall } from '../../core/rules/catch';
import { BATTLE_ITEMS, itemName } from '../../core/rules/items';
import type { Save } from '../../core/save';
import { typeNameKo, withJosa } from '../../core/text';
import { formOf, moveOf, speciesOf, type TypeName } from '../../data';

export type MenuPage = 'main' | 'skills' | 'items' | 'switch' | 'revive';

/** 4 아이템 페이지 — 볼 먼저 (S11), 그다음 전투 아이템 */
const MENU_ITEMS = [...BALLS, ...BATTLE_ITEMS];

export interface MenuItem {
  key: string;
  /** 단축키 숫자 (1 ~ 5) */
  num: number;
  label: string;
  /** 이름 뒤 작은 글 (PP · 개수 · 레벨) */
  sub?: string;
  /** 옆 메뉴 (좁은 세로 목록) 에서 쓰는 짧은 작은 글 — 없으면 sub (기술은 남은 PP 만, 전체는 title) */
  subShort?: string;
  /** 누르면 — 페이지를 바꾸거나 행동 */
  go: { page: MenuPage } | { action: BattleAction } | { back: true };
  enabled: boolean;
  title?: string;
}

/** 좁은 패널의 짧은 이름 (번호 + 낱말 하나, 전체 이름은 title) — 이모지는 쓰지 않음 (아트 디렉터 2026-10-19). 넓은 메뉴와 같은 낱말 (4 아이템 — 크기마다 '가방' · '아이템' 으로 다르던 것) */
const COMPACT_LABEL: Record<string, string> = { attack: '1 공격', guard: '2 방어', skills: '3 스킬', items: '4 아이템', switch: '5 교체', flee: '5 도망' };

/** 메뉴 한 줄 (mvp-spec S09 ⑦: 1 공격 · 2 방어 · 3 스킬 · 4 아이템 · 5 교체 · 도망, 숫자 키 1 ~ 5) — compact = 좁은 패널 */
export function menuItems(b: BattleState, save: Save, page: MenuPage, compact = false): MenuItem[] {
  const back: MenuItem = { key: 'back', num: 0, label: '←', go: { back: true }, enabled: true, title: '뒤로 (← · Esc)' };
  switch (page) {
    case 'main': {
      const skillsOk = b.me.moves.some((s) => s.pp > 0);
      const itemsOk = MENU_ITEMS.some((i) => canAct(b, save, { kind: 'item', item: i }));
      const anyItem = MENU_ITEMS.some((i) => itemLeft(b, save, i) > 0);
      const switchOk = switchable(b, save).length > 0;
      // 트레이너 · 관장전은 도망 불가 (gdd 4.7) — 5 = 교체만
      const fleeOk = b.kind === 'wild';
      const moreTitle = switchOk ? (fleeOk ? '5 교체 · 도망' : '5 교체 (트레이너와의 승부에서는 도망칠 수 없어요)') : fleeOk ? '5 도망' : '바꿀 포켓몬이 없어요 (트레이너와의 승부에서는 도망칠 수 없어요)';
      const items: MenuItem[] = [
        { key: 'attack', num: 1, label: '1 공격', go: { action: { kind: 'attack' } }, enabled: canAct(b, save, { kind: 'attack' }), title: '1 공격 — 약한 기본기, 횟수 제한 없음' },
        { key: 'guard', num: 2, label: '2 방어', go: { action: { kind: 'guard' } }, enabled: canAct(b, save, { kind: 'guard' }), title: '2 방어 — 다음 내 행동까지 받는 피해 절반 (연달아 쓰면 줄어듦)' },
        { key: 'skills', num: 3, label: '3 스킬', go: { page: 'skills' }, enabled: b.phase === 'choose' && skillsOk, title: skillsOk ? '3 스킬' : '쓸 수 있는 기술이 없어요 (1 공격만)' },
        { key: 'items', num: 4, label: '4 아이템', go: { page: 'items' }, enabled: b.phase === 'choose' && itemsOk, title: itemsOk ? '4 아이템 (볼 · 상처약 …)' : anyItem ? '지금 쓸 수 있는 아이템이 없어요 (HP 가득 · 상태 이상 없음 · 쓰러진 포켓몬 없음)' : '가방에 쓸 아이템이 없어요' },
        { key: 'more', num: 5, label: switchOk ? (fleeOk ? '5 교체·도망' : '5 교체') : fleeOk ? '5 도망' : '5 교체', go: switchOk ? { page: 'switch' } : { action: { kind: 'flee' } }, enabled: b.phase === 'choose' && (switchOk || fleeOk), title: moreTitle },
      ];
      if (!compact) return items;
      return items.map((i) => ({ ...i, label: COMPACT_LABEL[i.key === 'more' ? (switchOk || !fleeOk ? 'switch' : 'flee') : i.key] ?? i.label }));
    }
    case 'skills':
      return [
        ...b.me.moves.map((s, i): MenuItem => {
          const mv = moveOf(s.moveId);
          return {
            key: `m${s.moveId}`,
            num: i + 1,
            label: `${i + 1} ${mv?.name.ko ?? '?'}`,
            sub: `${s.pp}/${mv?.pp ?? '?'}`,
            subShort: `${s.pp}`,
            go: { action: { kind: 'move', moveId: s.moveId } },
            enabled: canAct(b, save, { kind: 'move', moveId: s.moveId }),
            title: mv ? `${mv.name.ko} · PP ${s.pp}/${mv.pp} · ${mv.power > 0 ? `위력 ${mv.power}` : '변화'} · ${typeNameKo(mv.type)}${isShooting(mv) ? ' · 쏘는 기술' : ''}${mv.streak ? ' · 연달아 쓰면 +10%' : ''}` : undefined,
          };
        }),
        back,
      ];
    case 'items':
      // 가진 것만 (볼 먼저 — S11 ① 볼 고르기) · 번호는 그 순서대로
      return [
        ...MENU_ITEMS.filter((item) => itemLeft(b, save, item) > 0).map((item, i): MenuItem => ({
          key: item,
          num: i + 1,
          label: `${i + 1} ${itemName(item)}`,
          sub: `×${itemLeft(b, save, item)}`,
          // 기력의조각 → 살릴 포켓몬 고르기
          go: item === 'revive' ? { page: 'revive' } : { action: { kind: 'item', item } },
          enabled: canAct(b, save, { kind: 'item', item }),
          title: item === 'revive' ? '쓰러진 팀 포켓몬을 HP 절반으로 (교체로 낼 수 있게)' : isBall(item) ? '볼 던지기 — 원이 작아질 때 Space (HP 가 낮을수록 잘 잡힘)' : undefined,
        })),
        back,
      ];
    case 'switch': {
      const team = switchable(b, save);
      return [
        // 팀 5마리 = 바꿀 포켓몬 최대 4 → 1 ~ 4, 도망은 그다음 번호
        ...team.slice(0, 4).map((m, i): MenuItem => ({
          key: m.uid,
          num: i + 1,
          label: `${i + 1} ${speciesOf(m.species)?.name.ko ?? m.form}`,
          sub: `Lv${m.level}`,
          title: `HP ${m.hp}`,
          go: { action: { kind: 'switch', uid: m.uid } },
          enabled: canAct(b, save, { kind: 'switch', uid: m.uid }),
        })),
        { key: 'flee', num: Math.min(team.length, 4) + 1, label: `${Math.min(team.length, 4) + 1} 도망`, go: { action: { kind: 'flee' } }, enabled: canAct(b, save, { kind: 'flee' }), title: b.kind === 'wild' ? undefined : '트레이너와의 승부에서는 도망칠 수 없어요' },
        back,
      ];
    }
    case 'revive':
      return [
        ...faintedTeam(b, save)
          .slice(0, 4)
          .map((m, i): MenuItem => ({
            key: `r${m.uid}`,
            num: i + 1,
            label: `${i + 1} ${speciesOf(m.species)?.name.ko ?? m.form}`,
            sub: `Lv${m.level}`,
            go: { action: { kind: 'item', item: 'revive', uid: m.uid } },
            enabled: canAct(b, save, { kind: 'item', item: 'revive', uid: m.uid }),
          })),
        back,
      ];
  }
}

/** S21 을 열 수 있는 때 — 힘대결 · 잡기 원 · 끝 · 다음 포켓몬 고르기 (숫자 키) 에는 안 열림 (멈춤으로 타이밍을 피하지 않게 [제안]) */
export function profileOpenable(b: BattleState): boolean {
  if (counterOpen(b) || ultCounterOpen(b)) return false; // 맞받아치기 창 (1.5초 · 1초) 도 타이밍
  return b.phase === 'run' || b.phase === 'choose' || b.phase === 'anim' || b.phase === 'last' || b.phase === 'send';
}

/** HP 바 색 — 반 넘음 초록 · 반 아래 노랑 · 5분의 1 아래 빨강 */
export function hpColor(hp: number, max: number): 'ok' | 'mid' | 'low' {
  const r = max > 0 ? hp / max : 0;
  return r > 0.5 ? 'ok' : r > 0.2 ? 'mid' : 'low';
}

/** 날아가는 기술 모양 — 타입마다 (임시 디자인, 단계 12 에서 다시) */
const TYPE_FX: Record<TypeName, string> = {
  normal: '💫', fire: '🔥', water: '💧', electric: '⚡', grass: '🍃', ice: '❄️', fighting: '👊', poison: '☠️', ground: '🪨',
  flying: '🌪️', psychic: '🔮', bug: '🐛', rock: '🪨', ghost: '👻', dragon: '🐉', dark: '🌑', steel: '⚙️', fairy: '✨',
};

export function moveFx(moveId: number | null): { icon: string; shooting: boolean } {
  const mv = moveId !== null ? moveOf(moveId) : undefined;
  if (!mv) return { icon: '💥', shooting: false };
  return { icon: TYPE_FX[mv.type], shooting: isShooting(mv) };
}

export const STATUS_LABEL: Record<string, string> = { poison: '독', burn: '화상', paralysis: '마비', sleep: '잠듦' };

export { duelKind, type DuelKind } from '../../core/rules/duel';

/** 타입 색 (빛줄기 · 힘대결 · 필살기 — 임시 디자인) */
export const TYPE_COLOR: Record<TypeName, string> = {
  normal: '#c8c8a8', fire: '#ff7a2e', water: '#4a9cff', electric: '#ffd52e', grass: '#5fcf4a', ice: '#8fe8ff', fighting: '#d0503a', poison: '#b05ad8', ground: '#d8b060',
  flying: '#a8c0ff', psychic: '#ff5aa0', bug: '#a8c830', rock: '#b8a058', ghost: '#7a62b8', dragon: '#7a5aff', dark: '#5a4a40', steel: '#b8c0d0', fairy: '#ffa8d8',
};

export function moveColor(moveId: number | null, fallback: TypeName | null): string {
  const mv = moveId !== null ? moveOf(moveId) : undefined;
  const t = mv?.type ?? fallback;
  return t ? TYPE_COLOR[t] : '#ffffff';
}

// ---------- 화면 자리 (S09: 왼쪽 끝 = 내 트레이너 구역 · 야생은 튀어나온 그 자리 · 메뉴는 내 HP 바 바로 위)

const BASE_SPRITE = 32;

/**
 * 전투 그림 키 — 보통 포켓몬은 원본 × 크기 배율, 큰 포켓몬 (원본 64px) 은 min(보통 키 × 1.3, 패널 높이 − 4 − 20 − 12) (gdd 3.0 [확정])
 */
export function battleSpritePx(form: string, scale: number, panelPx: number): number {
  const normal = BASE_SPRITE * scale;
  if ((formOf(form)?.size ?? BASE_SPRITE) <= BASE_SPRITE) return normal;
  return Math.max(normal, Math.round(Math.min(normal * 1.3, panelPx - 4 - 20 - 12)));
}

/**
 * HP 묶음 (2026-10-19 Sea of Stars — 정수 px, 배율을 곱하지 않음 · game.css .pg-hpblock 과 같은 값):
 * 이름 · Lv 줄 12 + 1 + HP 바 4 + 1 + 행동 게이지 2 = 20. 상대는 맨 위에 필살기 게이지 2 + 1 (여유 1)
 */
const HP_ROW_PX = 12;
const HP_BAR_PX = 4;
const GAUGE_PX = 2;
const HP_GAPS_PX = 2;
const FOE_ULT_PX = 4;
/** HP 묶음 위 여유 — 정보줄에 붙지 않게 */
const HP_TOP_GAP_PX = 4;
/** 두 HP 묶음 사이 최소 (글이 한 줄로 이어 읽히지 않게) */
const HP_PAIR_GAP_PX = 16;
/**
 * 옆 메뉴 (2026-10-19 태현 님 — Sea of Stars: 내 포켓몬 오른쪽 작은 세로 목록, 정수 px · game.css .pg-vmenu 와 같은 값):
 * 판 위로 튀어나온 탭 줄 (이름표 · 필살기 Z) 13 + 판 (5줄 × 13 + 위아래 여백 2 · 2 + 테두리 2).
 * 판 위 끝은 내 HP 묶음 이름 줄 위 끝에 맞춤. 이 너비 · 높이가 안 되면 예전처럼 가로 한 줄
 */
const SIDE_TAB_PX = 13;
const SIDE_ROW_PX = 13;
const SIDE_ROWS = 5;
const SIDE_PAD_PX = 6;
const SIDE_MIN_W_PX = 92;
const MENU_PX = 19;
/** HP 묶음 최소 너비 (이름 4 ~ 5글자 + Lv + 바) */
const HP_WIDE_MIN_PX = 80;
const AUTO_PX = 16;
/** 자동 전투 스위치 왼쪽 끝 (무대 왼쪽 끝에서) */
const AUTO_LEFT_PX = 4;
/** 자동 전투 스위치 대략 너비 (🔁 자동 OFF) */
const AUTO_EST_PX = 78;
/** 지금 한 줄 · 힘대결 안내 높이 */
const MSG_PX = 18;
/** 한 줄 말 둘째 줄 (game.css .pg-bmsg line-height) — 긴 말은 자리가 있으면 두 줄 */
const MSG_LINE_PX = 15;
/** 한 줄 말 위 띄움 최소 (예전 값) — 자리가 모자라면 정보줄 띄움 (4 ~ 8) 을 여기까지 줄임 */
const MSG_MIN_GAP_PX = 3;
/** 옆 메뉴 실제 폭 어림 (max-content — 기술 목록 "1 하이드로펌프 5/5" 까지) · 한 줄 말과 같은 높이에 걸칠 때만 씀 */
const SIDE_EST_W_PX = 170;
/** 상대 트레이너 머리 위 이름표 (9px 글자 + 여백 + 머리와 띄움) — 두 줄 말이 걸치지 않게 */
const NAMETAG_PX = 16;
/** 메뉴 줄 대략 너비 (버튼 6개 + 필살기 게이지) — 오른쪽으로 넘치지 않게 왼쪽 끝을 당김 */
const MENU_EST_PX = 380;
/** 이보다 좁은 패널은 메뉴를 짧게 (번호 + 그림 글자) · 패널 왼쪽 끝부터 */
export const COMPACT_WIDTH_PX = 560;
/** 한 줄을 상대 오른쪽에 둘 때 필요한 최소 너비 */
const MSG_SIDE_MIN_PX = 100;
/** 옆 메뉴일 때 오른쪽 위 한 줄의 오른쪽 끝 — 상대 오른쪽 끝에서 이만큼까지 (넓은 패널) */
const MSG_NEAR_FOE_PX = 260;

/**
 * 트레이너 · 관장전의 상대 포켓몬 자리 — 오른쪽 끝 = 상대 트레이너 구역 (포켓몬이 안 들어감, gdd S09 ②), 그 앞에서 싸움.
 * 야생은 튀어나온 그 자리 (contactX)
 */
export function trainerBattleFoeX(widthPx: number, scale: number, foeSpritePx: number): number {
  const zone = 8 + 20 * scale + 4;
  return Math.round(widthPx - zone - foeSpritePx / 2 - Math.max(0, widthPx * 0.1));
}

/** 상대 트레이너가 서는 자리 (오른쪽 끝, 가운데 x) */
export function foeTrainerX(widthPx: number, scale: number): number {
  return Math.round(widthPx - 8 - 10 * scale);
}

export interface BattleGeometry {
  trainerX: number;
  meX: number;
  foeX: number;
  /** 전투 그림 키 (큰 포켓몬은 상한 — battleSpritePx) */
  meSpritePx: number;
  foeSpritePx: number;
  /** HP 묶음 너비 (이름 · Lv · HP 바) · 가운데 (화면 안으로 당긴 자리) */
  meHpWide: number;
  foeHpWide: number;
  meHpX: number;
  foeHpX: number;
  /** 지금 한 줄을 둘 곳이 없음 (좁고 낮은 패널) */
  msgHidden: boolean;
  /** 각 HP 묶음 (HP 줄 + 행동 게이지, 상대는 + 필살기 게이지) 의 바닥 높이 (px, 길 바닥 기준이 아니라 화면 아래 기준) */
  meHpBottom: number;
  foeHpBottom: number;
  hpBlockPx: number;
  /** 메뉴 줄 — 패널이 낮아 HP 바 위에 안 들어가면 위 정보줄 자리 (gdd S09 [확정]) */
  menuInBar: boolean;
  menuBottom: number;
  menuLeft: number;
  /** 자동 전투 스위치 — 트레이너 머리 위에 안 들어가면 메뉴 줄 맨 앞 */
  autoInMenu: boolean;
  autoBottom: number;
  autoLeft: number;
  /** 좁은 패널 — 메뉴를 짧게 */
  compact: boolean;
  /** 지금 한 줄 · 힘대결 안내: 위 가운데가 HP 바와 겹치면 상대 오른쪽 (null = 위 가운데) */
  msgSide: { left: number; maxWidth: number } | null;
  /** 옆 메뉴 자리 (null = 예전 가로 한 줄) — 위 끝에서 top px, 너비 · 높이는 이 안에서 (2026-10-19 Sea of Stars) */
  menuSide: { left: number; top: number; maxWidth: number; maxHeight: number } | null;
  /** 옆 메뉴일 때 지금 한 줄은 오른쪽 위 (Sea of Stars) — 오른쪽 끝에서 right px */
  msgRight: { right: number; maxWidth: number } | null;
  /** 지금 한 줄이 넘치면 두 줄까지 (아래 두 줄 자리가 비었을 때 — 2026-10-19 태현 님 "길면 생략되어 버리네") */
  msgLines: 1 | 2;
  /** 위 한 줄 자리가 HP 묶음 · 메뉴로 붐빔 — 한 줄 말은 상대 오른쪽으로 (StageScreen 은 전투 동안 지도 줄을 정보줄 안으로) */
  topBusy: boolean;
  /** 길 칸 높이 (정보줄 뺀) — 머리 위 숫자가 위 말 칸 위로 올라가지 않게 */
  bodyPx: number;
  /** 한 줄 말 · 힘대결 안내 위 끝 (길 칸 위에서 px) — 지도 줄 아래 띄움, 자리가 모자라면 띄움을 줄임 (최소 3) */
  msgTop: number;
}

export interface GeometryInput {
  widthPx: number;
  /** 길이 있는 칸 높이 (정보줄 뺀) */
  bodyPx: number;
  scale: number;
  uiScale: number;
  ground: number;
  /** 야생이 튀어나온 자리 (스테이지 화면과 같은 x) */
  foeX: number;
  meSpritePx: number;
  foeSpritePx: number;
  /** 주인공 키 */
  heroPx: number;
  /** 주인공 너비 (없으면 코드 그림 20 × 배율) */
  heroWidthPx?: number;
  /** 길 칸 위에서 비워 둘 높이 — 지도 줄 (S06 ②, 패널 180px 이상) 의 아래 끝 (없으면 0) · HP 묶음 · 메뉴가 그 위로 안 올라감 */
  topPx?: number;
  /** 정보줄 · 지도 줄 아래 띄움 (ui/layout topGapPx) — 한 줄 말 · 힘대결 안내가 이만큼 아래에서 시작 (없으면 예전 3px) */
  gapPx?: number;
  /** 상대 트레이너가 오른쪽 끝에 서 있음 (트레이너 · 관장 · 라이벌전) — 두 줄 말이 그 이름표에 걸치지 않게 */
  foeTrainer?: boolean;
}

export function battleGeometry(g: GeometryInput): BattleGeometry {
  const u = g.uiScale;
  // 지도 줄 아래로 쓸 수 있는 높이 · 한 줄 말 자리 (위 띄움 + 한 줄 + 1)
  const top = g.topPx ?? 0;
  const room = g.bodyPx - top;
  const msgH = Math.round(MSG_PX * u);
  const heroHalf = (g.heroWidthPx ?? 20 * g.scale) / 2; // 주인공 너비의 반 (그림 사람은 그림 너비)
  const trainerX = Math.round(8 + heroHalf);
  const trainerEnd = trainerX + heroHalf + 4;
  const free = Math.max(0, g.foeX - g.foeSpritePx / 2 - g.meSpritePx - trainerEnd);
  const meX = Math.round(trainerEnd + g.meSpritePx / 2 + free * 0.35);
  const hpBlockPx = HP_ROW_PX + HP_BAR_PX + GAUGE_PX + HP_GAPS_PX;
  // HP 묶음 너비 — 두 묶음이 겹치지 않고 사이가 16px 이상 (좁은 패널) · 가운데 자리는 화면 안으로
  const gap = Math.max(40, Math.round(g.foeX) - meX - HP_PAIR_GAP_PX);
  // 판 없는 얇은 HP 줄 (Sea of Stars) 이라 그림 키 × 1.1 이면 충분 — 크게 (80px) 에서도 옆 메뉴 자리가 남게 (2026-10-19)
  const hpWide = (px: number) => Math.min(gap, Math.round(Math.max(HP_WIDE_MIN_PX, px * 1.1) * Math.max(1, Math.min(1.3, u))));
  const meHpWide = hpWide(g.meSpritePx);
  const foeHpWide = hpWide(g.foeSpritePx);
  const inside = (x: number, w: number) => Math.round(Math.min(Math.max(x, w / 2 + 2), g.widthPx - w / 2 - 2));
  const meHpX = inside(meX, meHpWide);
  const foeHpX = inside(g.foeX, foeHpWide);
  const foeExtra = FOE_ULT_PX;
  // 그림 바로 위 — 패널이 낮으면 그림 위에 겹쳐서라도 화면 안에 (정보줄 · 지도 줄과 4px 띄움)
  const meHpBottom = Math.max(0, Math.min(g.ground + g.meSpritePx + 1, room - hpBlockPx - HP_TOP_GAP_PX));
  const foeHpBottom = Math.max(0, Math.min(g.ground + g.foeSpritePx + 1, room - hpBlockPx - foeExtra - HP_TOP_GAP_PX));
  const menuBottom = meHpBottom + hpBlockPx;
  const menuPx = Math.round(MENU_PX * u);
  const compact = g.widthPx < COMPACT_WIDTH_PX;
  // 옆 메뉴: 내 포켓몬 · 내 HP 묶음 오른쪽 ~ 상대 그림 · 상대 HP 묶음 왼쪽 사이에 세로 목록이 들어가면 그쪽 (위 정보줄은 그대로 보임)
  const sideLeft0 = Math.round(Math.max(meX + g.meSpritePx / 2, meHpX + meHpWide / 2) + 6);
  const sideRight0 = Math.round(Math.min(g.foeX - g.foeSpritePx / 2, foeHpX - foeHpWide / 2) - 6);
  const sidePanelH = SIDE_ROW_PX * SIDE_ROWS + SIDE_PAD_PX;
  // 판 위 끝 = 내 HP 묶음 이름 줄 위 끝 (메뉴가 천장에 매달리지 않고 포켓몬 곁에) — 길 칸 아래로 넘치면 올리고, 탭 줄 자리는 남김.
  // 세로로는 길 칸 안에만 들어가면 됨 (포켓몬 옆이라 땅 띠에 걸쳐도 가리는 것이 없음)
  const myHpTop = g.bodyPx - (meHpBottom + hpBlockPx);
  const panelTop = Math.max(top + SIDE_TAB_PX + 1, Math.min(myHpTop, g.bodyPx - 2 - sidePanelH));
  const menuSide =
    !compact && sideRight0 - sideLeft0 >= SIDE_MIN_W_PX && top + SIDE_TAB_PX + 1 + sidePanelH + 2 <= g.bodyPx
      ? { left: sideLeft0, top: panelTop - SIDE_TAB_PX, maxWidth: sideRight0 - sideLeft0, maxHeight: g.bodyPx - (panelTop - SIDE_TAB_PX) - 2 }
      : null;
  const menuInBar = !menuSide && menuBottom + menuPx > room;
  // 내 HP 바 왼쪽 끝 (또는 그림 왼쪽 끝) 부터 — 오른쪽으로 넘치지 않게 당김
  const menuLeft = compact ? 6 : Math.round(Math.max(6, Math.min(meX - g.meSpritePx / 2, meHpX - meHpWide / 2, g.widthPx - MENU_EST_PX * u - 6)));
  const autoBottom = g.ground + g.heroPx + 2;
  // 트레이너 머리 위에 자리가 없거나, 내 HP 묶음과 겹치면 (좁은 패널) 메뉴 줄 맨 앞으로
  const autoTop = autoBottom + Math.round(AUTO_PX * u);
  const hitsMyHp = meHpX - meHpWide / 2 < AUTO_LEFT_PX + AUTO_EST_PX * u && autoBottom < meHpBottom + hpBlockPx && autoTop > meHpBottom;
  const autoInMenu = autoTop > room || hitsMyHp;
  // 위 가운데 한 줄이 HP 바 · 메뉴 줄과 겹치는지 — 겹치면 상대 오른쪽 빈 곳에 (자리가 있으면)
  // 옆 메뉴는 위 가운데를 차지하지 않음 (내 포켓몬 오른쪽 세로 목록)
  const highest = Math.max(meHpBottom + hpBlockPx, foeHpBottom + hpBlockPx + foeExtra, menuInBar || menuSide ? 0 : menuBottom + menuPx);
  // 한 줄 말 위 띄움 — 자리가 모자라면 줄임 (최소 예전 3px · 띄움 8px 때문에 480 × 190 에서 말이 숨던 것) · 말 자리 = 띄움 + 한 줄 + 1
  const msgGap = Math.max(MSG_MIN_GAP_PX, Math.min(g.gapPx ?? MSG_MIN_GAP_PX, room - highest - msgH - 1));
  const msgRoom = msgH + msgGap + 1;
  // 메뉴 줄이 위 한 줄 자리까지 올라와 있으면 (정보줄 바로 밑) 옆자리는 메뉴 오른쪽 끝 뒤부터 — 160px 에서 게이지 · 💥Z 위에 겹치던 것 (2026-10-19)
  const menuAtTop = !menuSide && !menuInBar && room - (menuBottom + menuPx) < msgRoom;
  const menuRight = menuSide ? menuSide.left + Math.min(menuSide.maxWidth, SIDE_EST_W_PX) : menuLeft + Math.round(MENU_EST_PX * u);
  const sideLeft = Math.round(Math.max(g.foeX + Math.max(g.foeSpritePx, foeHpWide) / 2 + 6, menuAtTop || menuSide ? menuRight + 8 : 0));
  const sideRoom = g.widthPx - sideLeft - 8;
  const topBusy = room - highest < msgRoom;
  // 옆 메뉴가 한 줄 말 (lines 줄) 아래에서 시작하면 말은 왼쪽으로 무대 끝까지 늘어나도 됨 — 예전엔 옆 메뉴 자리 (상대 왼쪽까지) 를 늘 피해서
  //   트레이너전 (상대가 오른쪽 끝) 에서 "상대 도토링이 쓰러졌다! 곤충채…" 처럼 잘림 (2026-10-19 태현 님)
  const menuBelow = (lines: number) => !menuSide || menuSide.top >= top + msgRoom + (lines - 1) * MSG_LINE_PX + 1;
  // 그래도 넘치면 두 줄까지 — 둘째 줄 아래가 땅 (트레이너전은 오른쪽 끝 트레이너 이름표) 위이고,
  //   위가 비었으면 HP 묶음 · 메뉴 줄 · 옆 메뉴도 두 줄 자리 아래일 때 / 위가 붐벼 상대 오른쪽에 둘 때는 그 아래가 비어 있음
  const floorPx = g.foeTrainer ? g.ground + g.heroPx + NAMETAG_PX : g.ground;
  const twoFits = g.bodyPx - (top + msgRoom + MSG_LINE_PX) >= floorPx;
  const msgLines: 1 | 2 = twoFits && (topBusy || (room - highest >= msgRoom + MSG_LINE_PX && menuBelow(2))) ? 2 : 1;
  // 옆 메뉴일 때 한 줄은 늘 오른쪽 위 (Sea of Stars, 아트 디렉터) — 넓은 패널에서는 상대 오른쪽 가까이까지만 (싸우는 곳에서 멀어지지 않게).
  // 위가 붐비면 (상대 HP 묶음이 위 끝까지) 상대 HP 묶음 오른쪽 끝에서 16px 띄워 "파이리 Lv5 이상해씨는…" 처럼 이어 읽히지 않게
  const foeRight = g.foeX + Math.max(g.foeSpritePx, foeHpWide) / 2;
  const msgRightPx = Math.round(Math.max(8, g.widthPx - (foeRight + MSG_NEAR_FOE_PX)));
  const msgLeftLimit = topBusy ? foeRight + 16 : menuBelow(msgLines) ? 8 : menuRight + 8;
  const msgRightRoom = Math.round(g.widthPx - msgRightPx - msgLeftLimit);
  const msgRight = menuSide && msgRightRoom >= MSG_SIDE_MIN_PX ? { right: msgRightPx, maxWidth: msgRightRoom } : null;
  const msgSide = !menuSide && topBusy && sideRoom >= MSG_SIDE_MIN_PX ? { left: sideLeft, maxWidth: sideRoom } : null;
  // 둘 곳이 없으면 (좁고 낮은 패널) 한 줄은 숨김 — HP 바가 더 중요, 내 차례는 메뉴 테두리로 보임
  const msgHidden = menuSide ? !msgRight : topBusy && !msgSide;
  return { trainerX, meX, foeX: Math.round(g.foeX), meSpritePx: g.meSpritePx, foeSpritePx: g.foeSpritePx, meHpWide, foeHpWide, meHpX, foeHpX, msgHidden, meHpBottom, foeHpBottom, hpBlockPx, menuInBar, menuBottom, menuLeft, autoInMenu, autoBottom, autoLeft: AUTO_LEFT_PX, compact, msgSide, menuSide, msgRight, msgLines, topBusy, msgTop: top + msgGap, bodyPx: g.bodyPx };
}

/**
 * 무대 (stage/model.ts battleStage) 안에서 잰 자리를 패널 자리로 — x 만 무대 왼쪽 끝만큼 옮김.
 * 오른쪽 끝에서 잰 한 줄 말 (msgRight) 은 무대 오른쪽 밖 너비만큼 더함. 높이 · 너비는 그대로
 */
export function placeOnStage(geo: BattleGeometry, stage: { left: number; width: number }, widthPx: number): BattleGeometry {
  const dx = stage.left;
  const rightGap = widthPx - stage.left - stage.width;
  if (dx === 0 && rightGap === 0) return geo;
  return {
    ...geo,
    trainerX: geo.trainerX + dx,
    meX: geo.meX + dx,
    foeX: geo.foeX + dx,
    meHpX: geo.meHpX + dx,
    foeHpX: geo.foeHpX + dx,
    menuLeft: geo.menuLeft + dx,
    autoLeft: geo.autoLeft + dx,
    msgSide: geo.msgSide && { ...geo.msgSide, left: geo.msgSide.left + dx },
    menuSide: geo.menuSide && { ...geo.menuSide, left: geo.menuSide.left + dx },
    msgRight: geo.msgRight && { ...geo.msgRight, right: geo.msgRight.right + rightGap },
  };
}

/** 화면 다시 그릴지 보는 열쇠 — 게이지는 1% 단위, 연출 · 힘대결은 진행 중이면 매번 (고르는 중 · 결과에서는 안 바뀜) */
export function battleViewKey(b: BattleState, auto: boolean): string {
  const pct = (v: number) => Math.round(v * 100);
  return [
    b.phase,
    auto,
    b.msg,
    b.me.uid,
    b.me.hp,
    b.foe.hp,
    pct(b.me.gauge),
    pct(b.foe.gauge),
    pct(b.me.ult),
    pct(b.foe.ult),
    b.me.status?.kind ?? '',
    b.foe.status?.kind ?? '',
    b.anim ? `${b.anim.side}${b.anim.action.kind}${Math.floor(b.anim.ms / 100)}` : '',
    b.clash ? `${b.clash.taps}:${Math.floor(b.clash.ms / 100)}` : '',
    // 볼: 누른 때 · 정해진 결과 · 흔들림이 끝나는 때 (원은 CSS 로 줄어듦) · 마지막 기회 남은 시간 (막대)
    b.catch ? `${b.catch.ball}:${b.catch.pressMs ?? ''}:${b.catch.caught ?? ''}` : '',
    b.phase === 'last' ? Math.floor(b.lastMs / 250) : '',
    b.popups.length ? b.popups.map((p) => `${p.text}${b.t - p.ms}`).join(',') : '',
    b.me.moves.map((s) => s.pp).join(','),
  ].join('|');
}

/**
 * 머리 위 글 나누기 (2026-10-20 플레이 리뷰어 "머리 위엔 숫자 하나, 문장은 위 말 칸 — 원작처럼"):
 * 숫자 (피해 · 회복) 만 머리 위에 — 상성은 숫자 크기 (굉장 = 크게 · 별로 = 작게), 급소는 숫자 뒤 "!".
 * 문장 (상성 · 급소 · 빗나감 · 막음 · 상태 · 그 밖) 은 위 한 줄 말에 붙임. 엔진 순서 = 같은 쪽에 -N → 상성 → 급소 (9df2458)
 */
export interface PopNumber {
  id: number;
  side: Side;
  text: string;
  kind: 'damage' | 'heal';
  size: 'big' | 'normal' | 'small';
  crit: boolean;
}

export function splitPopups(popups: readonly BattlePopup[]): { numbers: PopNumber[]; sentences: BattlePopup[] } {
  const numbers: PopNumber[] = [];
  for (const p of popups) {
    if (p.kind !== 'damage' && p.kind !== 'heal') continue;
    // 바로 뒤 두 개 안에서 같은 쪽 상성 · 급소 (다음 숫자를 만나면 거기까지)
    const after: BattlePopup[] = [];
    for (const q of popups) {
      if (q.side !== p.side || q.id <= p.id || q.id > p.id + 2) continue;
      if (q.kind === 'damage' || q.kind === 'heal') break;
      after.push(q);
    }
    const has = (k: BattlePopup['kind']) => after.some((q) => q.kind === k);
    const crit = has('crit');
    numbers.push({ id: p.id, side: p.side, kind: p.kind, text: crit ? `${p.text}!` : p.text, size: has('super') ? 'big' : has('weak') ? 'small' : 'normal', crit });
  }
  return { numbers, sentences: popups.filter((p) => p.kind !== 'damage' && p.kind !== 'heal') };
}

/** 말 칸에 붙일 문장 — 상태는 누가 걸렸는지 ("이상해씨는 독에 걸렸다!"), 나머지는 그대로 */
export function sentenceText(p: BattlePopup, nameOfSide: (s: Side) => string): string {
  return p.kind === 'status' ? `${withJosa(nameOfSide(p.side), '은/는')} ${p.text}` : p.text;
}

/**
 * 전투 시작 연출 (2026-10-20 태현 님 "트레이너와 만나 전투에 들어갈 때 밋밋해" → 추천 B + C · 야생 A):
 * 트레이너 · 관장 · 라이벌전 시작 = 양쪽 트레이너가 볼을 던져 포켓몬이 나옴 (C) · 상대가 다음 포켓몬을 낼 때도 같은 볼 · 야생 = 짧은 화면 닦기 (A).
 * 값 = 연출이 시작된 뒤 지난 ms (전투 시간 b.t · 내보내는 시간 b.sendMs — 화면을 다시 열어도 어긋나지 않게), 끝났으면 null
 */
export const SEND_FLY_MS = 450;
export const SEND_BURST_MS = 250;
export const WIPE_MS = 350;
export function introView(b: BattleState): { me: number | null; foe: number | null; wipe: number | null } {
  const sending = (at: number) => (at >= 0 && at < SEND_FLY_MS + SEND_BURST_MS ? at : null);
  if (b.kind === 'wild') return { me: null, foe: null, wipe: b.t >= 0 && b.t < WIPE_MS ? b.t : null };
  if (b.phase === 'send') return { me: null, foe: sending(b.sendMs), wipe: null };
  return { me: sending(b.t), foe: sending(b.t), wipe: null };
}
