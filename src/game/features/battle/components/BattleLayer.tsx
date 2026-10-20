/**
 * S09 전투 · S10 힘대결 화면 층 (gdd S09 · S10, mvp-spec S09 · S10) — 스테이지 길 위에 그대로 (배경은 멈춤).
 *   ① 내 트레이너 = 주인공 (StageScreen 이 왼쪽 끝으로 옮김) · ③ 내 포켓몬 · ④ 야생 (튀어나온 그 자리) · 트레이너 · 관장전은 ② 상대 트레이너 (오른쪽 끝) 앞
 *   ⑨ 포켓몬을 누르면 S21 프로필 (onProfile — 힘대결 · 잡기 원 · 끝에서는 안 열림)
 *   ⑥ 이름 · HP · 레벨 · ⑩ 행동 게이지 (HP 바 바로 아래) · 상대 ⑧ 필살기 게이지 (상대 HP 바 바로 위)
 *   ⑦ ⑧ ⑪ 메뉴 줄 = BattleMenu (내 HP 바 바로 위, 낮은 패널이면 정보줄 자리) · ⑫ 자동 전투 스위치 (트레이너 머리 위)
 * 연출은 CSS 로 간단히 (임시 디자인 — 원래 확장 필살기 연출에 잇는 건 단계 12).
 */
import type { ComponentChildren } from 'preact';
import { useRef } from 'preact/hooks';
import { BALANCE, TIMING } from '../../../core/balance';
import { canParry, canRiposte, type BattleState, type GameInput, type Side } from '../../../core/engine';
import { clashWithTaps, isShooting, type Fighter } from '../../../core/rules/battle';
import { catchTiming } from '../../../core/rules/catch';
import type { Save } from '../../../core/save';
import { moveOf, speciesOf } from '../../../data';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { Sprite } from '../../../ui/Sprite';
import { catchFoeClass, catchView, duelKind, hpColor, introView, moveColor, moveFx, profileOpenable, SEND_FLY_MS, sentenceText, splitPopups, STATUS_LABEL, type BattleGeometry } from '../model';
import { battleAnimKey, holdWindow } from '../fx/hold';
import { impactOf, ultSkippable } from '../fx/parry';
import { BattleMenu } from './BattleMenu';
import { fxCastAt, fxContact, useBattleFx } from './BattleFx';

export interface BattleLayerProps {
  battle: BattleState;
  save: Save;
  media: string;
  ground: number;
  geo: BattleGeometry;
  onInput(input: GameInput): void;
  /** S21 — 포켓몬을 누름 (열 수 있을 때만 넘김) */
  onProfile?(side: Side): void;
  /** 상대 트레이너 · 관장이 선 x (패널 px) — 볼을 던지는 손 자리 (없으면 볼 연출 없음) */
  foeTrainerLeft?: number;
}

/** 상대 이름 앞 — 야생 · 상대 (트레이너 · 관장) */
const foePrefix = (b: BattleState) => (b.kind === 'wild' ? '야생 ' : '상대 ');


const nameOf = (f: Fighter) => speciesOf(f.species)?.name.ko ?? '???';
/** 맞은 쪽 그림이 깜빡이는 시간 */
const HURT_MS = 420;
/** 머리 위 숫자 줄 사이 (글자 13 ~ 16px — 예전 11 이라 세 줄이 붙거나 겹침) · 한 줄 높이 */
const POP_STACK_PX = 16;
const MAX_TAPS = Math.round(BALANCE.clashTapMax / BALANCE.clashTap);

/** 행동 하나마다 다른 열쇠 — 같은 CSS 움직임이 다시 처음부터 돌게 */
/** 연출 하나의 열쇠 — 일반 모드 연출 다리 (fx/hold) 와 같은 기준 */
const animKey = battleAnimKey;

function Bar({ value, cls }: { value: number; cls: string }) {
  return (
    <span class={`pg-bar ${cls}`}>
      <span class="pg-bar-fill" style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
    </span>
  );
}

/** ⑫ 자동 전투 스위치 — "자동 꺼짐 · 켜짐" (9자 "자동 전투 OFF" 가 트레이너 이름표처럼 읽히던 것 — 4차, 설정 · 접힌 줄과 같은 한국어 — 5차), 상태는 모양으로: 꺼짐 = 흐린 글 · 흐린 선 · 켜짐 = 금색 선 + 크림 */
export function AutoButton({ save, onInput, short }: { save: Save; onInput(i: GameInput): void; short: boolean }) {
  const auto = save.settings.autoBattle;
  return (
    <Button
      secondary={!auto}
      onClick={() => onInput({ kind: 'auto-battle', on: !auto })}
      title={auto ? '자동 전투 켜짐 — 누르면 끔' : '자동 전투 꺼짐 — 켜면 내 행동도 알아서 (필살기 · 연타는 직접도 됨)'}
    >
      {short ? (auto ? '자동✓' : '자동') : auto ? '자동 켜짐' : '자동 꺼짐'}
    </Button>
  );
}

function HpBlock({ f, side, x, bottom, wide, prefix, noName }: { f: Fighter; side: Side; x: number; bottom: number; wide: number; prefix: string; noName?: boolean }) {
  const status = f.status ? STATUS_LABEL[f.status.kind] : null;
  const title = `${side === 'foe' ? prefix : ''}${nameOf(f)} Lv${f.level} · HP ${f.hp}/${f.maxHp}${status ? ` · ${status}` : ''}`;
  // 가운데 x 에 정수 px 로 (translateX(-50%) 는 홀수 폭이면 반 픽셀로 흐려짐 — 아트 디렉터)
  return (
    <div class={`pg-hpblock pg-hpblock-${side}`} style={{ left: `${x - Math.floor(wide / 2)}px`, bottom: `${bottom}px`, width: `${wide}px` }} title={title}>
      {side === 'foe' && <Bar value={f.ult} cls={f.ult >= 1 ? 'pg-bar-ult pg-full' : 'pg-bar-ult'} />}
      {/* 이름 · Lv 줄 (내 것은 오른쪽에 HP 숫자) → 얇은 HP 바 → 행동 게이지 (Sea of Stars, 포켓몬 머리 위). 옆 메뉴가 있으면 내 이름은 이름표가 맡음 */}
      <span class="pg-hprow">
        {!noName && <span class="pg-hpname">{nameOf(f)}</span>}
        <span class="pg-lv">Lv{f.level}</span>
        {status && <span class={`pg-status pg-status-${f.status!.kind}`}>{status}</span>}
        {side === 'me' && (
          <span class="pg-hpnum">
            {f.hp}/{f.maxHp}
          </span>
        )}
      </span>
      <Bar value={f.hp / f.maxHp} cls={`pg-bar-hp pg-hp-${hpColor(f.hp, f.maxHp)}`} />
      <Bar value={f.gauge} cls={f.gauge >= 1 ? 'pg-bar-act pg-full' : 'pg-bar-act'} />
    </div>
  );
}

/** 젖혔다 내밀기 (pg-cast) 길이 — 쏘는 때에 맞춰 늦게 시작할 수 있게 행동 길이와 따로 */
const CAST_BODY_MS = 600;

/** 포켓몬 그림 + 지금 하는 행동의 몸 움직임 (달려들기 · 들어가기 · 쓰러짐 · 맞음) */
function FighterBody(props: { b: BattleState; side: Side; x: number; target: number; px: number; media: string; ground: number; onProfile?(side: Side): void; sendAt?: number | null; extra?: string }) {
  const { b, side, x, target, px, media, ground, onProfile, sendAt, extra } = props;
  // 볼이 닿을 때 나오는 지연 — 처음 그릴 때 값만 (프레임마다 바꾸면 두 배로 빨라짐)
  const sendAt0 = useRef(sendAt ?? null).current;
  const f = b[side];
  const anim = b.anim?.side === side ? b.anim : null;
  const act = anim?.action;
  const mv = act?.kind === 'move' ? moveOf(act.moveId) : undefined;
  // 몸으로 닿는지 = 일반 모드 연출 틀 기준 (덩굴채찍 · 지진은 쏘고 · 에어슬래시는 달려듦 — 연출과 몸짓이 맞게, #328). 연출이 없으면 예전 기준
  const contact = anim ? fxContact(b) : null;
  const lunge = act?.kind === 'attack' || (act?.kind === 'move' && mv !== undefined && mv.power > 0 && (contact ?? !isShooting(mv)));
  // 쏘는 기술 (불꽃 · 물대포 · 광선 …) — 달려들지 않고 몸을 젖혔다 내밂 (일반 모드처럼, 2026-10-19 태현 님 "자연스럽고 멋지게")
  const cast = act?.kind === 'move' && mv !== undefined && !lunge;
  // 내미는 순간 (pg-cast 45%) = 입에서 쏘는 때 — 짧은 기술은 늦게 쏘니 몸짓도 늦춤 (CAST_BODY_MS 길이로)
  const castAt = cast && anim ? fxCastAt(b) : null;
  const bodyTiming = castAt !== null ? { animationDuration: `${CAST_BODY_MS}ms`, animationDelay: `${Math.max(0, Math.round(castAt - CAST_BODY_MS * 0.45))}ms` } : { animationDuration: anim ? `${anim.dur}ms` : undefined };
  const hurt = b.popups.some((p) => p.side === side && p.kind === 'damage' && p.ms < HURT_MS);
  const cls = [
    'pg-fx-body',
    lunge ? 'pg-lunge' : '',
    cast ? 'pg-cast' : '',
    act?.kind === 'switch' ? 'pg-recall' : '',
    act?.kind === 'ult' ? 'pg-charging' : '',
    hurt ? 'pg-hurt' : '',
    // 마지막 기회 동안은 쓰러진 상대를 흐리게 남김 (어디에 던지는지 보이게)
    // 마지막 기회 볼이 터져 다시 일어나는 끝 장면은 쓰러진 모습을 빼고 튀어나옴 (2026-10-20 태현 님 — 놓치면 10% 로 전투 계속)
    f.hp <= 0 && !(side === 'foe' && b.phase === 'catch' && b.catch?.caught === false && catchView(b)?.stage === 'end')
      ? (b.phase === 'last' || b.phase === 'catch') && side === 'foe'
        ? 'pg-down'
        : 'pg-fainted'
      : '',
    f.guard < 1 ? 'pg-guarded' : '',
  ].join(' ');
  return (
    // 볼 던지기 중이면 볼이 닿을 때 나옴 (그 전에는 안 보임 — pg-sendout 의 첫 장면), 아니면 내 포켓몬만 예전처럼 바로 나옴
    <span
      // 트레이너 · 관장 · 라이벌 포켓몬은 붙을 때마다 나오는 움직임 (다음 포켓몬 = 내보내는 시간 끝에 볼이 터진 뒤), 야생은 이미 튀어나와 있어서 없음
      class={`pg-obj pg-fighter pg-fighter-${side}${side === 'me' || b.kind !== 'wild' ? ' pg-sendout' : ''}${extra ? ` ${extra}` : ''}`}
      style={{ left: `${x}px`, bottom: `${ground}px`, ...(sendAt0 !== null ? { animationDelay: `${SEND_FLY_MS - sendAt0}ms` } : {}) }} title={`${side === 'foe' ? foePrefix(b) : ''}${nameOf(f)} Lv${f.level}${onProfile ? ' — 누르면 프로필' : ''}`} onClick={onProfile ? () => onProfile(side) : undefined}>
      {/* --pg-back = 맞으면 밀려나는 쪽 (상대 반대쪽) */}
      <span key={animKey(b)} class={cls} style={{ '--pg-dx': `${Math.round((target - x) * 0.75)}px`, '--pg-back': side === 'me' ? '-1' : '1', ...bodyTiming }}>
        {/* 걷기 그림 (옆모습) 으로 서로 마주 봄 — 서기 그림은 정면이라 가만히 앞만 보는 것처럼 보였음 (2026-10-19 태현 님). 걷기 그림은 오른쪽을 봄 → 상대는 뒤집음 */}
        <Sprite media={media} form={f.form} shiny={f.shiny} scale={1} px={px} action="walk" faceLeft={side === 'foe'} />
      </span>
    </span>
  );
}

/**
 * 볼 던지기 (2026-10-20 태현 님 C안) — 트레이너 손에서 픽셀 볼이 포물선으로 날아가 (0.45초) 포켓몬 자리에서 터짐 (금색 → 흰 고리 0.25초).
 * at = 던진 뒤 지난 ms — 애니메이션을 그만큼 앞당겨 시작, 처음 그릴 때 값만 씀 (다시 그릴 때마다 바꾸면 두 배로 빨라짐)
 */
function SendBall({ from, to, at: atNow }: { from: [number, number]; to: [number, number]; at: number }) {
  const at = useRef(atNow).current;
  return (
    <>
      <span
        class="pg-send-ball"
        style={{ left: `${from[0]}px`, bottom: `${from[1]}px`, '--pg-dx': `${Math.round(to[0] - from[0])}px`, '--pg-dy': `${Math.round(from[1] - to[1])}px`, animationDelay: `${-at}ms` }}
      >
        <Icon name="ball" />
      </span>
      <span class="pg-send-burst" style={{ left: `${to[0]}px`, bottom: `${to[1]}px`, animationDelay: `${SEND_FLY_MS - at}ms` }} />
    </>
  );
}

/** 야생 전투 시작 화면 닦기 (2026-10-20 태현 님 A안) — 처음 그릴 때의 지난 시간만 씀 */
function Wipe({ at }: { at: number }) {
  const at0 = useRef(at).current;
  return <span class="pg-wipe" style={{ animationDelay: `${-at0}ms` }} />;
}

/** 날아가는 기술 · 터지는 자리 · 방어 · 아이템 · 필살기 빛줄기 (맞는 순간 = 연출 끝쪽, 피해 숫자와 같이) */
/** native = 일반 모드 연출이 그림 (BattleFx) — 그때는 기술 · 공격 · 방어 · 아이템 · 상태 이모지를 안 그림 */
function Effects({ b, geo, ground, midMe, midFoe, native }: { b: BattleState; geo: BattleGeometry; ground: number; midMe: number; midFoe: number; native: boolean }) {
  const anim = b.anim;
  if (!anim) return null;
  if (native && anim.action.kind !== 'flee') return null;
  const from = anim.side === 'me' ? geo.meX : geo.foeX;
  const to = anim.side === 'me' ? geo.foeX : geo.meX;
  const y = anim.side === 'me' ? midMe : midFoe;
  const key = animKey(b);
  const dur = `${anim.dur}ms`;
  const a = anim.action;
  const out: ComponentChildren[] = [];
  if (a.kind === 'move') {
    const mv = moveOf(a.moveId);
    const fx = moveFx(a.moveId);
    if (mv && mv.class === 'status') {
      // 변화 기술 — 상대 쪽에서 반짝
      out.push(<span key={`${key}s`} class="pg-fx pg-fx-pulse" style={{ left: `${to}px`, bottom: `${ground}px`, animationDuration: dur }}>{fx.icon}</span>);
    } else if (fx.shooting) {
      out.push(
        <span key={`${key}p`} class={`pg-fx pg-shot pg-duel-${duelKind(a.moveId)}`} style={{ left: `${from}px`, bottom: `${y}px`, '--pg-dx': `${to - from}px`, animationDuration: dur, color: moveColor(a.moveId, null) }}>
          {fx.icon}
        </span>,
      );
    } else {
      out.push(<span key={`${key}i`} class="pg-fx pg-fx-impact" style={{ left: `${to}px`, bottom: `${y}px`, animationDuration: dur }}>{fx.icon}</span>);
    }
  } else if (a.kind === 'attack') {
    out.push(<span key={`${key}i`} class="pg-fx pg-fx-impact" style={{ left: `${to}px`, bottom: `${y}px`, animationDuration: dur }}>💥</span>);
  } else if (a.kind === 'guard') {
    out.push(<span key={`${key}g`} class="pg-fx pg-fx-pulse" style={{ left: `${from}px`, bottom: `${ground}px`, animationDuration: dur }}>🛡️</span>);
  } else if (a.kind === 'item') {
    out.push(<span key={`${key}t`} class="pg-fx pg-fx-pulse" style={{ left: `${from}px`, bottom: `${y}px`, animationDuration: dur }}>{a.item === 'revive' ? '💎' : '💊'}</span>);
  } else if (a.kind === 'flee') {
    out.push(<span key={`${key}f`} class="pg-fx pg-fx-pulse" style={{ left: `${from}px`, bottom: `${ground}px`, animationDuration: dur }}>💨</span>);
  } else if (a.kind === 'skip') {
    out.push(<span key={`${key}z`} class="pg-fx pg-fx-pulse" style={{ left: `${from}px`, bottom: `${y}px`, animationDuration: dur }}>{a.why === 'paralysis' ? '⚡' : a.why === 'wake' ? '❗' : a.why === 'sleep' || b[anim.side].status?.kind === 'sleep' ? '💤' : '⚡'}</span>);
  } else if (a.kind === 'ult') {
    const f = b[anim.side];
    const color = moveColor(null, f.types[0] ?? null);
    out.push(
      <div key={`${key}c`} class={`pg-ult-cut pg-ult-cut-${anim.side}`} style={{ animationDuration: dur }}>
        <span>
          💥 {anim.side === 'foe' ? foePrefix(b) : ''}
          {nameOf(f)}의 필살기!
        </span>
      </div>,
      <span
        key={`${key}b`}
        class="pg-ult-beam"
        style={{ left: `${Math.min(from, to)}px`, width: `${Math.abs(to - from)}px`, bottom: `${y}px`, backgroundColor: color, animationDuration: dur, transformOrigin: anim.side === 'me' ? 'left center' : 'right center' }}
      />,
      <span key={`${key}x`} class="pg-fx pg-fx-boom" style={{ left: `${to}px`, bottom: `${ground}px`, animationDuration: dur }}>
        💥
      </span>,
    );
  }
  return <>{out}</>;
}

/** 잡기 볼 하나 (픽셀 볼, 점 = 길 위 그림 배율) — 장면마다 새로 그림 (key), 처음 그릴 때 지난 시간만큼 앞당겨 시작 (다시 그릴 때마다 바꾸면 두 배로 빨라짐) */
function CatchBall({ cls, x, y, since, px, style, icon = 'ball' }: { cls: string; x?: number; y?: number; since: number; px: number; style?: Record<string, string>; icon?: 'ball' | 'ballBig' | 'ballBigOpen' }) {
  const since0 = useRef(since).current;
  return (
    <span class={`pg-catch-ball ${cls}`} style={{ ...(x !== undefined ? { left: `${x}px`, bottom: `${y ?? 0}px` } : {}), animationDelay: `${-since0}ms`, ...style }}>
      <Icon name={icon} px={px} />
    </span>
  );
}

/** 잡기 원 — TimingRing (패링 · 반격과 같은 모양 · 키 칸) 에 처음 그린 때의 지난 시간을 고정해 넘김 */
function CatchRing({ id, x, y, size, ms }: { id: string; x: number; y: number; size: number; ms: number }) {
  const ms0 = useRef(ms).current;
  return <TimingRing id={id} x={x} y={y} size={size} ringMs={TIMING.catchRingMs} lateMs={BALANCE.catchGoodMs} delay={-ms0} auto={false} label="던지기" />;
}

/** 딸깍 — 볼 둘레로 튀는 금색 별 (2px 점 + 십자, 4 걸음) — 창 안 볼 (48px) 기준 px */
const CATCH_STARS: [number, number][] = [[-28, -20], [28, -20], [-36, 8], [36, 8], [-16, -36], [16, -36]];
/** 흔들기 창 (2026-10-20 태현 님 B 집중 창 · 아트 디렉터 8차) — 104 × 108 고정 · 안 볼 = 24 × 24 ballBig 점 2 (48px, 창이 UI 라 ×3 패널에서도 그대로) ·
 *  볼 가운데 = 창 위에서 42px (위 여백 18 + 볼 반) — 땅의 볼이 날아 들어오는 거리 계산에 씀 */
const CATCH_WIN_W = 104;
const CATCH_WIN_H = 108;
const CATCH_WIN_BALL_Y = 42;

/**
 * S11 볼 던지기 (gdd S11 · 2026-10-20 태현 님 다시 기획) — ④ 서 있는 상대 둘레에서 원이 줄어듦 (딱 맞을 때 Space = 그때 던짐, 안 누르면 저절로)
 * → 주인공이 반 걸음 나서며 볼이 포물선으로 날아감 → 열리며 상대가 빛이 되어 빨려 들어감 → 떨어져 통통 → ⑤ 가운데 창에서 흔들흔들 (남은 기회 3/3) → 딸깍 · 터짐.
 * 장면 · 시간은 엔진 시간표 그대로 (model catchView ← engine catchTimeline)
 */
function Catch({ b, geo, ground, mid, handY }: { b: BattleState; geo: BattleGeometry; ground: number; mid: number; handY: number }) {
  const c = b.catch;
  const v = catchView(b);
  if (!c || !v) return null;
  // 던진 때로 열쇠 — 다시 그려져도 (팝업이 사라짐 등) 볼 · 원이 처음부터 다시 돌지 않게
  const key = `c${c.startT}`;
  const size = Math.round(geo.foeSpritePx * 1.1);
  const px = geo.scale;
  // 누른 순간 원을 그 크기로 멈추고 색으로 알려 줌 (완벽 금색 · 좋음 초록 · 빗나감 회색 + 빨랐다 / 늦었다)
  const timing = c.pressMs !== null ? catchTiming(c.pressMs, TIMING.catchRingMs) : null;
  const pressedScale = c.pressMs !== null ? Math.max(1, 2.8 - 1.8 * Math.min(1, c.pressMs / TIMING.catchRingMs)) : 1;
  const feedback =
    timing === 'perfect' ? '완벽!' : timing === 'good' ? '좋아!' : timing === 'none' && c.pressMs !== null ? (c.pressMs < TIMING.catchRingMs ? '조금 빨랐다' : '조금 늦었다') : null;
  const ring = { left: `${geo.foeX}px`, bottom: `${mid}px`, width: `${size}px`, height: `${size}px` };
  // ⑤ 흔들기 창 (2026-10-20 태현 님 B 집중 창) — 무대 가운데 (자리 · 모양은 game.css), 땅에 떨어진 볼이 0.15초에 창 가운데로 날아 들어감:
  //   시작 = 땅의 볼 자리 (창 가운데에서 dx · dy, 크기 = 길 위 볼 / 창 볼)
  const win = v.stage === 'shake' || v.stage === 'end' || v.stage === 'held';
  // 자리는 정수 px (top 50% · translate 는 무대 높이가 홀수면 0.5px 에 걸려 테두리 · 볼이 흐려짐, 아트 디렉터 8차)
  // 무대 가운데 — 넓은 패널은 무대가 길 칸 가운데라 무대 왼쪽 끝을 더함 (창은 길 칸 기준으로 놓임, 디자인 세션)
  const winLeft = geo.stageLeft + Math.round((geo.widthPx - CATCH_WIN_W) / 2);
  const winTop = Math.round((geo.bodyPx - CATCH_WIN_H) / 2);
  const flyIn = {
    '--pg-fx': `${Math.round(geo.foeX - (winLeft + CATCH_WIN_W / 2))}px`,
    '--pg-fy': `${Math.round(geo.bodyPx - ground - 4 * px - (winTop + CATCH_WIN_BALL_Y))}px`,
    '--pg-fs': String(Math.round(((8 * px) / 48) * 100) / 100),
  };
  const title = v.stage === 'end' || v.stage === 'held' ? (v.caught ? '잡았다!' : '아깝다!') : '잡는 중…';
  const shakeStyle = { animationDuration: `${TIMING.catchShakeMs}ms`, animationIterationCount: String(Math.max(1, v.shakes)) };
  return (
    <>
      {/* ④ 원 — 패링 · 반격 원과 같은 부품 (키 칸 "Space 던지기"). 지연은 처음 그린 때 값으로 고정: 다시 그릴 때마다 -c.ms 를 새로 넣으면
          돌던 원이 지난 시간만큼 앞으로 튀어 끊기고 엔진보다 일찍 다 줄어들었음 (2026-10-20 태현 님 "던질 때 렉 · 타이밍을 놓침", 코드 리뷰어) */}
      {v.stage === 'ring' && <CatchRing key={`${key}r`} id={`${key}r`} x={geo.foeX} y={mid} size={size} ms={c.ms} />}
      {v.stage === 'fly' && c.pressMs !== null && <span key={`${key}p`} class={`pg-catch-ring pg-ring-${timing}`} style={{ ...ring, transform: `translate(-50%, 50%) scale(${pressedScale})` }} />}
      {feedback && (v.stage === 'fly' || v.stage === 'suck') && (
        // 원 아래 (위는 상대 HP 칸 — 이름과 겹침)
        <span key={`${key}f`} class={`pg-pop pg-ring-text pg-ring-${timing}`} style={{ left: `${geo.foeX}px`, bottom: `${Math.max(2, ground - 16)}px` }}>
          {feedback}
        </span>
      )}
      {/* ③ 던지는 동안 주인공이 반 걸음 나섬 (game.css :has — 주인공은 StageScreen 이 그림) */}
      {v.stage === 'fly' && <span key={`${key}h`} class="pg-catch-throwing" />}
      {v.stage === 'fly' && (
        <CatchBall key={`${key}fly`} cls="pg-catch-fly" x={geo.trainerX} y={handY} since={v.since} px={px} style={{ '--pg-dx': `${geo.foeX - geo.trainerX}px`, '--pg-dy': `${handY - mid}px`, animationDuration: `${TIMING.catchFlyMs}ms` }} />
      )}
      {v.stage === 'suck' && (
        <>
          <CatchBall key={`${key}open`} cls="pg-catch-open" x={geo.foeX} y={mid} since={v.since} px={px} />
          <span key={`${key}ob`} class="pg-send-burst" style={{ left: `${geo.foeX}px`, bottom: `${mid}px` }} />
        </>
      )}
      {v.stage === 'drop' && <CatchBall key={`${key}drop`} cls="pg-catch-drop" x={geo.foeX} y={ground} since={v.since} px={px} style={{ '--pg-dy': `${mid - ground}px`, animationDuration: `${TIMING.catchDropMs}ms` }} />}
      {/* 흔들기 · 끝 · 잡힌 뒤 (전투 끝) 의 볼은 창 안에만 (땅의 볼은 창으로 날아 들어감 · 잡히면 창이 소개 카드까지 그대로 — 플레이 리뷰어) */}
      {v.stage === 'end' && !v.caught && <span key={`${key}bb`} class="pg-send-burst" style={{ left: `${geo.foeX}px`, bottom: `${ground + 4 * px}px` }} />}
      {win && (
        <div key={`${key}w`} class="pg-catch-win" style={{ left: `${winLeft}px`, top: `${winTop}px` }}>
          <span class="pg-catch-title">{title}</span>
          <span class="pg-catch-win-ball" style={flyIn}>
            {/* "아깝다!" = 열린 볼 (뚜껑이 들리고 빛살, 2026-10-20 태현 님) · 잡힘 = 닫힌 볼이 딸깍 */}
            <CatchBall key={`${key}w${v.stage}`} cls={v.stage === 'shake' ? 'pg-catch-shake' : v.stage === 'held' ? '' : 'pg-catch-click'} since={v.since} px={2} icon={v.stage === 'end' && !v.caught ? 'ballBigOpen' : 'ballBig'} style={v.stage === 'shake' ? shakeStyle : undefined} />
            {v.stage === 'end' && v.caught && CATCH_STARS.map(([dx, dy], i) => <span key={`s${i}`} class="pg-catch-star" style={{ '--pg-sx': `${dx}px`, '--pg-sy': `${dy}px` }} />)}
          </span>
          {/* 남은 볼 기회 (이번 볼 포함) = 점 ○●● — 볼 그림은 가진 볼 개수로 읽혀서 (플레이 리뷰어) · 왼쪽부터 꺼짐 (2026-10-20 태현 님) ·
              지금 던진 칸 = 남은 것 중 맨 왼쪽 pg-catch-now (모양은 game.css) */}
          <span class="pg-catch-left" title={`남은 볼 기회 ${v.left}/${BALANCE.catchTries} (이번 볼 포함)`}>
            {Array.from({ length: BALANCE.catchTries }, (_, i) => {
              const used = BALANCE.catchTries - v.left;
              return <span key={`b${i}`} class={`${i < used ? 'pg-catch-used' : 'pg-catch-ok'}${i === used ? ' pg-catch-now' : ''}`} />;
            })}
          </span>
        </div>
      )}
    </>
  );
}

/** 위 가운데 · (옆 메뉴) 오른쪽 위 · (낮은 패널) 상대 오른쪽 — 위 끝은 지도 줄 · 정보줄 아래 띄움 (geo.msgTop) */
function msgStyle(geo: BattleGeometry) {
  const top = `${geo.msgTop}px`;
  if (geo.msgSide) return { top, left: `${geo.msgSide.left}px`, right: 'auto', margin: 0, maxWidth: `${geo.msgSide.maxWidth}px`, transform: 'none' };
  if (geo.msgRight) return { top, left: 'auto', right: `${geo.msgRight.right}px`, margin: 0, maxWidth: `${geo.msgRight.maxWidth}px`, transform: 'none' };
  return { top };
}

/** 지금 한 줄에서 포켓몬 이름만 빨갛게 (Sea of Stars — 중요한 낱말만 색) */
function emphasize(msg: string, names: readonly string[]): ComponentChildren {
  const list = names.filter((n) => n && n !== '???').sort((a, c) => c.length - a.length);
  if (!list.length) return msg;
  const parts: ComponentChildren[] = [];
  let rest = msg;
  for (let guard = 0; rest && guard < 8; guard++) {
    let at = -1;
    let hit = '';
    for (const n of list) {
      const i = rest.indexOf(n);
      if (i >= 0 && (at < 0 || i < at)) {
        at = i;
        hit = n;
      }
    }
    if (at < 0) break;
    if (at > 0) parts.push(rest.slice(0, at));
    parts.push(<b class="pg-em">{hit}</b>);
    rest = rest.slice(at + hit.length);
  }
  if (rest) parts.push(rest);
  return parts;
}

/** S10 힘대결 — 두 기술이 가운데서 밀고 밀림. 연타할수록 맞부딪히는 자리가 상대 쪽으로 (gdd S10 ⑤) · 승자가 정해지면 이긴 줄기가 끝까지 */
/**
 * 패링 원 (2026-10-19 태현 님 A) — 상대 공격이 맞기 직전, 내 포켓몬 둘레에서 금색 원이 좁혀져 포켓몬 크기가 되는 순간 = 맞는 순간 (그때 Space · 클릭).
 * 맞는 순간은 연출 (BattleFx → fx/parry) 이 정함. 누르면 (막음 · 완벽 · 너무 일찍) 원은 사라지고 엔진이 글 (막았다!) 을 띄움.
 * 1배 자리에 얇은 과녁 원이 같이 떠서 "좁혀지는 원이 과녁에 겹칠 때" 를 눈으로 맞춤 (2026-10-20 플레이 리뷰어 — 예전엔 흰색이 될 때만 알 수 있었음).
 * HP 줄 아래 층 (z 4 · HP 줄보다 먼저 그림) — 큰 원이 내 HP 숫자를 가로지르지 않게.
 * 원 오른쪽에 작은 자판 칸 "Space 막기" (포커스가 없으면 "클릭 막기") — 무슨 키인지 모르던 것 (2026-10-20 태현 님)
 */
/**
 * 좁혀지는 원 + 과녁 원 + 키 칸 — 맞는 때까지 ringMs 동안 1.7배 → 1배, 그 뒤 lateMs 동안 흐려짐.
 * CSS 두 단계 (pg-ring-shrink → pg-ring-late) 라 시간 비율이 달라도 1배 = 맞는 때 (2026-10-20 패링 다시 기획: 패링 0.9 + 0.2초 · 반격 1.2 + 0.2초).
 * delay = 그린 때부터 좁혀지기 시작까지 (음수면 이미 지난 만큼) — 처음 그린 때 기준으로 고정 (그릴 때마다 바꾸면 어긋남)
 */
function TimingRing({ id, x, y, size, ringMs, lateMs, delay, auto, label }: { id: string; x: number; y: number; size: number; ringMs: number; lateMs: number; delay: number; auto: boolean; label: string }) {
  const timing = { animationDuration: `${ringMs}ms, ${lateMs}ms`, animationDelay: `${delay}ms, ${delay + ringMs}ms` };
  const style = { left: `${x}px`, bottom: `${y}px`, width: `${size}px`, height: `${size}px`, ...timing };
  return (
    <>
      <span key={`${id}t`} class={auto ? 'pg-parry-target pg-parry-auto' : 'pg-parry-target'} style={style} />
      <span key={id} class={auto ? 'pg-parry-ring pg-parry-auto' : 'pg-parry-ring'} style={style} />
      {/* 키 칸 = 원 왼쪽 · 원과 6px 넘게 띄움 (아트 디렉터 4차) · 자동 전투면 숨김 (맡겨 둔 사람을 부르지 않게) */}
      {!auto && (
        <span key={`${id}k`} class="pg-parry-key" style={{ left: `${x - Math.round(size * 0.55) - 8}px`, bottom: `${y}px`, ...timing }}>
          {document.hasFocus() ? (
            <>
              <span class="pg-menu-key">Space</span> {label}
            </>
          ) : (
            `클릭해 ${label}`
          )}
        </span>
      )}
    </>
  );
}

function ParryRing({ b, geo, y, auto }: { b: BattleState; geo: BattleGeometry; y: number; auto: boolean }) {
  const w = canParry(b) ? impactOf(animKey(b)) : null;
  if (!w) return null;
  // 원이 좁혀지기 시작하는 때 = 맞기 parryRingMs 전 — 지연은 맞는 순간을 적은 때 기준으로 고정
  return <TimingRing id={animKey(b)} x={geo.meX} y={y} size={Math.round(geo.meSpritePx * 1.1)} ringMs={TIMING.parryRingMs} lateMs={TIMING.parryLateMs} delay={Math.round(w.at - TIMING.parryRingMs - w.set)} auto={auto} label="막기" />;
}

/**
 * 반격 기회 (2026-10-20 패링 다시 기획 — 완벽 패링 뒤 phase 'riposte') — 상대 포켓몬 둘레에 두 번째 원, 1배가 되는 때 (riposte.ms === dur) 에 Space · 클릭.
 * 등급은 엔진이 riposte.ms 로 매김 (Space = {kind:'space'}). 지연은 처음 그린 때의 ms 로 고정, 기회마다 key 를 새로 (원이 처음부터 다시)
 */
function RiposteRing({ b, geo, y, auto }: { b: BattleState; geo: BattleGeometry; y: number; auto: boolean }) {
  const first = useRef<{ n: number; ms: number } | null>(null);
  const count = useRef(0);
  const r = canRiposte(b) ? b.riposte : null;
  if (!r) {
    first.current = null;
    return null;
  }
  if (!first.current) {
    count.current += 1;
    first.current = { n: count.current, ms: r.ms };
  }
  return <TimingRing id={`rip${first.current.n}`} x={geo.foeX} y={y} size={Math.round(geo.foeSpritePx * 1.1)} ringMs={r.dur} lateMs={TIMING.parryLateMs} delay={-first.current.ms} auto={auto} label="반격" />;
}

/** native = 일반 모드 대결이 그림 (BattleFx) — 그때는 줄기 · 💥 를 안 그리고 안내만 */
function Clash({ b, geo, y, native }: { b: BattleState; geo: BattleGeometry; y: number; native: boolean }) {
  const c = b.clash;
  if (!c) return null;
  const p = clashWithTaps(c.base, c.taps);
  const point = c.winner === 'me' ? geo.foeX : c.winner === 'foe' ? geo.meX : Math.round(geo.meX + (geo.foeX - geo.meX) * Math.min(0.88, Math.max(0.12, p)));
  const meColor = c.kind === 'ult' ? moveColor(null, b.me.types[0] ?? null) : moveColor(c.me, null);
  const foeColor = c.kind === 'ult' ? moveColor(null, b.foe.types[0] ?? null) : moveColor(c.foe, null);
  const meKind = c.kind === 'ult' ? 'beam' : duelKind(c.me);
  const foeKind = c.kind === 'ult' ? 'beam' : duelKind(c.foe);
  const left = Math.max(0, TIMING.clashMs - c.ms);
  const drain = native && c.winner === null ? holdWindow(animKey(b), performance.now()) : null;
  const big = c.kind === 'ult' ? ' pg-clash-ult' : '';
  const done = c.winner !== null ? ' pg-clash-done' : '';
  // 포커스가 없으면 Space 는 편집기로 감 → 클릭 안내 (선제공격과 같은 규칙)
  const tapHint = geo.compact ? '연타!' : document.hasFocus() ? '연타! (Space · 클릭)' : '클릭 연타!';
  return (
    <>
      {!native && (
        <>
          <span class={`pg-clash-beam pg-duel-${meKind}${big}${done}`} style={{ left: `${geo.meX}px`, width: `${Math.max(0, point - geo.meX)}px`, bottom: `${y}px`, backgroundColor: meColor }} />
          <span class={`pg-clash-beam pg-duel-${foeKind}${big}${done}`} style={{ left: `${point}px`, width: `${Math.max(0, geo.foeX - point)}px`, bottom: `${y}px`, backgroundColor: foeColor }} />
          <span class={`pg-fx pg-clash-point${done}`} style={{ left: `${point}px`, bottom: `${y}px` }}>
            💥
          </span>
        </>
      )}
      <div class="pg-clash-info" style={msgStyle(geo)}>
        {c.winner !== null ? (
          <b>{c.winner === 'me' ? '힘대결에서 이겼다!' : '힘대결에서 졌다…'}</b>
        ) : (
          <>
            <span>
              내 쪽 <b>{Math.round(p * 100)}%</b>
            </span>
            <span class="pg-clash-tap">{tapHint}</span>
            <span class="pg-dim">{c.taps >= MAX_TAPS ? '연타 MAX' : `연타 ${c.taps}/${MAX_TAPS}`}</span>
            <span class="pg-clash-time">
              {drain ? (
                // 일반 모드 대결을 붙잡는 동안 — 엔진 시간이 멈춰서 붙잡기 끝까지 CSS 로 줄어듦 (테스터: 1% 에서 멈춰 "시간 끝" 처럼 보였음)
                <span key={drain.from} class="pg-bar-fill pg-bar-drain" style={{ animationDuration: `${Math.max(1, Math.round(drain.until - drain.from))}ms`, animationDelay: `${-Math.round(drain.at - drain.from)}ms` }} />
              ) : (
                <span class="pg-bar-fill" style={{ width: `${Math.round((left / TIMING.clashMs) * 100)}%` }} />
              )}
            </span>
          </>
        )}
      </div>
    </>
  );
}

export function BattleLayer({ battle: b, save, media, ground, geo, onInput, onProfile, foeTrainerLeft }: BattleLayerProps) {
  // 일반 모드 기술 · 방어 · 회복 연출 (2026-10-19 태현 님) — 번들이 없으면 false (이모지 그대로)
  // 연출 층 (포켓몬 위 · HUD 아래, #350) — 일반 모드 연출 캔버스를 전투 중 이 안으로 옮김
  const fxLayer = useRef<HTMLDivElement>(null);
  const native = useBattleFx(b, fxLayer);
  const profile = onProfile && profileOpenable(b) ? onProfile : undefined;
  const midMe = ground + Math.round(geo.meSpritePx * 0.45);
  const midFoe = ground + Math.round(geo.foeSpritePx * 0.45);
  // 머리 위 = 숫자만 (상성 = 크기 · 급소 = "!"), 문장은 위 한 줄 말에 붙임 (2026-10-20 플레이 리뷰어 — 원작처럼)
  const { numbers, sentences } = splitPopups(b.popups);
  const popBase = (side: Side) => (side === 'me' ? geo.meHpBottom : geo.foeHpBottom) + geo.hpBlockPx + 2;
  // 위 말 칸 위로는 안 올라감 — 자리가 없으면 (낮은 패널) 포켓몬 몸 위에
  const popTop = geo.bodyPx - geo.msgTop - POP_STACK_PX;
  const popAt = (side: Side, i: number) => {
    const y = popBase(side) + i * POP_STACK_PX;
    return y <= popTop ? y : (side === 'me' ? midMe : midFoe) + i * POP_STACK_PX;
  };
  const sideName = (s: Side) => nameOf(s === 'me' ? b.me : b.foe);
  // 기술 연출 중 (말 = "파이리의 불꽃세례!") 이면 뒤에, 그다음 단계 (쓰러짐 · 고르기 · 끝 — 맞는 순간 엔진이 말을 바꿈) 면 앞에 —
  //   "효과가 굉장했다! 급소에 맞았다! 이상해씨가 쓰러졌다!" (원작 순서 · 좁은 패널에서 잘려도 문장이 앞에 남음)
  const said = sentences.map((p) => sentenceText(p, sideName));
  //   앞에 붙이는 건 엔진이 말을 바꾼 단계 (쓰러짐 · 고르기 · 끝 · 다음 포켓몬 · 마지막 기회) 만 — 연출이 끝나 run 이어도 말은 아직 그 행동 (다른 세션 플레이 리뷰어)
  const changed = b.phase === 'pick' || b.phase === 'over' || b.phase === 'send' || b.phase === 'last' || b.phase === 'choose';
  const msgText = (changed ? [...said, b.msg] : [b.msg, ...said]).filter(Boolean).join(' ');
  // 필살기 컷인이 같은 말을 하는 동안 · 둘 곳이 없는 좁은 패널에서는 위 한 줄을 숨김 — 그때 문장은 머리 위 한 줄로
  // 잡기 흔들기 창 (가운데) 이 떠 있는 동안도 숨김 — 창 이름표와 같은 말을 두 번 함 (아트 디렉터 8차)
  const catchShown = catchView(b)?.stage;
  const showMsg = msgText !== '' && !geo.msgHidden && b.phase !== 'clash' && b.anim?.action.kind !== 'ult' && catchShown !== 'shake' && catchShown !== 'end' && catchShown !== 'held';
  const lastSentence = showMsg ? undefined : sentences[sentences.length - 1];
  // 나갈 포켓몬이 없는 채로 시작한 전투 (이상한 세이브) — 내 자리는 비움
  const hasMe = b.me.uid !== 'none';
  // 전투 시작 연출 — 트레이너전 = 볼 던지기 (손 = 사람 키의 55%), 야생 = 화면 닦기
  const intro = introView(b);
  const handY = ground + Math.round((geo.autoBottom - ground) * 0.4);
  const throwFoe = intro.foe !== null && foeTrainerLeft !== undefined ? intro.foe : null;
  const sendBall = intro.sendBall !== undefined && intro.sendBall !== null && foeTrainerLeft !== undefined ? intro.sendBall : null;
  const throwMe = intro.me !== null && hasMe ? intro.me : null;
  // 잡기 흔들기 창 (가운데) 이 떠 있는 동안 — 메뉴 판을 숨김 (좁은 패널에서 겹침)
  const catchStage = catchView(b)?.stage;
  const catchWin = catchStage === 'shake' || catchStage === 'end';
  return (
    <>
      {hasMe && <FighterBody key={`me${b.me.uid}`} b={b} side="me" x={geo.meX} target={geo.foeX} px={geo.meSpritePx} media={media} ground={ground} onProfile={profile} sendAt={throwMe} />}
      {/* 잡기 중 상대 — 원이 줄어드는 동안은 서 있고, 빨려 들어감 · 볼 속 (숨김) · 빠져나와 튀어나옴 (catchFoeClass) */}
      <FighterBody key={`foe${b.foe.uid}`} b={b} side="foe" x={geo.foeX} target={geo.meX} px={geo.foeSpritePx} media={media} ground={ground} onProfile={profile} sendAt={throwFoe} extra={b.escaped && b.phase === 'over' ? 'pg-catch-run' : catchFoeClass(b)} />
      {/* 패링 원은 HP 줄보다 먼저 (같은 층에서 HP 숫자가 위) */}
      <ParryRing b={b} geo={geo} y={midMe} auto={save.settings.autoBattle} />
      <RiposteRing b={b} geo={geo} y={midFoe} auto={save.settings.autoBattle} />
      {hasMe && <HpBlock f={b.me} side="me" x={geo.meHpX} bottom={geo.meHpBottom} wide={geo.meHpWide} prefix="" noName={geo.menuSide !== null || geo.tiny} />}
      {b.phase !== 'send' && <HpBlock f={b.foe} side="foe" x={geo.foeHpX} bottom={geo.foeHpBottom} wide={geo.foeHpWide} prefix={foePrefix(b)} />}
      {b.phase === 'clash' ? <Clash b={b} geo={geo} y={Math.round((midMe + midFoe) / 2)} native={native} /> : <Effects b={b} geo={geo} ground={ground} midMe={midMe} midFoe={midFoe} native={native} />}
      <Catch b={b} geo={geo} ground={ground} mid={midFoe} handY={handY} />
      {throwMe !== null && <SendBall key={`sm${b.me.uid}`} from={[geo.trainerX, handY]} to={[geo.meX, midMe]} at={throwMe} />}
      {throwFoe !== null && foeTrainerLeft !== undefined && <SendBall key={`sf${b.foe.uid}`} from={[foeTrainerLeft, handY]} to={[geo.foeX, midFoe]} at={throwFoe} />}
      {sendBall !== null && foeTrainerLeft !== undefined && <SendBall key={`ss${b.foeDown.length}`} from={[foeTrainerLeft, handY]} to={[geo.foeX, midFoe]} at={sendBall} />}
      {intro.wipe !== null && <Wipe at={intro.wipe} />}
      {(['me', 'foe'] as const).map((side) => {
        const nums = numbers.filter((n) => n.side === side).slice(-3);
        const x = side === 'me' ? geo.meHpX : geo.foeHpX;
        return [
          ...nums.map((n, i) => (
            <span key={n.id} class={`pg-pop pg-pop-${n.kind} pg-pop-num-${n.size}${n.crit ? ' pg-pop-num-crit' : ''}`} style={{ left: `${x}px`, bottom: `${popAt(side, i)}px` }}>
              {n.text}
            </span>
          )),
          // 말 칸이 없을 때만 문장 한 줄 (가장 최근 것)
          lastSentence?.side === side && (
            <span key={`s${lastSentence.id}`} class={`pg-pop pg-pop-say pg-pop-${lastSentence.kind}`} style={{ left: `${x}px`, bottom: `${popAt(side, nums.length)}px` }}>
              {sentenceText(lastSentence, sideName)}
            </span>
          ),
        ];
      })}
      {/* 다시 보는 필살기 = Space 로 남은 연출 건너뛰기 — 아무도 몰라서 말 자리에 작은 키 칸 (다른 세션 플레이 리뷰어) */}
      {ultSkippable(b) && (
        <span class="pg-skip-key" style={msgStyle(geo)}>
          {document.hasFocus() ? (
            <>
              <span class="pg-menu-key">Space</span> 넘기기
            </>
          ) : (
            '클릭해 넘기기'
          )}
        </span>
      )}
      {showMsg && (
        <div key={b.msg} class={['pg-bmsg', b.phase === 'over' ? 'pg-bmsg-over' : '', geo.msgLines === 2 ? 'pg-bmsg-2' : ''].filter(Boolean).join(' ')} style={msgStyle(geo)} title={msgText}>
          {emphasize(msgText, [nameOf(b.me), nameOf(b.foe)])}
        </div>
      )}
      {!geo.autoInMenu && (
        <span class="pg-auto" style={{ left: `${geo.autoLeft}px`, bottom: `${geo.autoBottom}px` }}>
          <AutoButton save={save} onInput={onInput} short={false} />
        </span>
      )}
      {catchWin ? null : geo.menuSide ? (
        // 옆 메뉴 (Sea of Stars) — 내 포켓몬 오른쪽 세로 목록
        <div class="pg-bmenu-wrap pg-vmenu-wrap" style={{ left: `${geo.menuSide.left}px`, top: `${geo.menuSide.top}px`, maxWidth: `${geo.menuSide.maxWidth}px`, maxHeight: `${geo.menuSide.maxHeight}px` }}>
          <BattleMenu battle={b} save={save} onInput={onInput} vertical={hasMe ? nameOf(b.me) : '—'} lead={geo.autoInMenu ? <AutoButton save={save} onInput={onInput} short={false} /> : null} />
        </div>
      ) : (
        !geo.menuInBar && (
          <div class="pg-bmenu-wrap" style={{ left: `${geo.menuLeft}px`, bottom: `${geo.menuBottom}px`, maxWidth: `calc(100% - ${geo.menuLeft + 6}px)` }}>
            <BattleMenu battle={b} save={save} onInput={onInput} lead={geo.autoInMenu ? <AutoButton save={save} onInput={onInput} short={geo.compact} /> : null} compact={geo.tiny ? 'tiny' : geo.compact} />
          </div>
        )
      )}
      {/* 연출 층 — 비어 있는 상자 (Preact 는 안을 안 건드림), BattleFx 가 연출 캔버스를 넣음 */}
      <div class="pg-fxlayer" ref={fxLayer} />
    </>
  );
}

/** 패널이 낮을 때 — 위 정보줄 자리에 메뉴 줄 (gdd S09 [확정]) */
export function BattleMenuBar({ battle, save, onInput, withAuto, compact }: { battle: BattleState; save: Save; onInput(i: GameInput): void; withAuto: boolean; compact: boolean | 'tiny' }) {
  return (
    <div class="pg-infobar pg-infobar-battle">
      <BattleMenu battle={battle} save={save} onInput={onInput} compact={compact} lead={withAuto ? <AutoButton save={save} onInput={onInput} short={compact !== false} /> : null} />
    </div>
  );
}
