/**
 * S09 전투 · S10 힘대결 화면 층 (gdd S09 · S10, mvp-spec S09 · S10) — 스테이지 길 위에 그대로 (배경은 멈춤).
 *   ① 내 트레이너 = 주인공 (StageScreen 이 왼쪽 끝으로 옮김) · ③ 내 포켓몬 · ④ 야생 (튀어나온 그 자리)
 *   ⑥ 이름 · HP · 레벨 · ⑩ 행동 게이지 (HP 바 바로 아래) · 상대 ⑧ 필살기 게이지 (상대 HP 바 바로 위)
 *   ⑦ ⑧ ⑪ 메뉴 줄 = BattleMenu (내 HP 바 바로 위, 낮은 패널이면 정보줄 자리) · ⑫ 자동 전투 스위치 (트레이너 머리 위)
 * 연출은 CSS 로 간단히 (임시 디자인 — 원래 확장 필살기 연출에 잇는 건 단계 12).
 */
import type { ComponentChildren } from 'preact';
import { BALANCE, TIMING } from '../../../core/balance';
import type { BattleState, GameInput, Side } from '../../../core/engine';
import { clashWithTaps, isShooting, type Fighter } from '../../../core/rules/battle';
import type { Save } from '../../../core/save';
import { moveOf, speciesOf } from '../../../data';
import { Button } from '../../../ui/Button';
import { Sprite } from '../../../ui/Sprite';
import { duelKind, hpColor, moveColor, moveFx, STATUS_LABEL, type BattleGeometry } from '../model';
import { BattleMenu } from './BattleMenu';

export interface BattleLayerProps {
  battle: BattleState;
  save: Save;
  media: string;
  ground: number;
  geo: BattleGeometry;
  onInput(input: GameInput): void;
}

const nameOf = (f: Fighter) => speciesOf(f.species)?.name.ko ?? '???';
/** 맞은 쪽 그림이 깜빡이는 시간 */
const HURT_MS = 300;
const POP_STACK_PX = 11;
const MAX_TAPS = Math.round(BALANCE.clashTapMax / BALANCE.clashTap);

/** 행동 하나마다 다른 열쇠 — 같은 CSS 움직임이 다시 처음부터 돌게 */
function animKey(b: BattleState): string {
  return b.anim ? `${b.anim.side}${b.anim.action.kind}${b.t - b.anim.ms}` : '';
}

function Bar({ value, cls }: { value: number; cls: string }) {
  return (
    <span class={`pg-bar ${cls}`}>
      <span class="pg-bar-fill" style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
    </span>
  );
}

/** ⑫ 자동 전투 스위치 — 꺼져 있으면 OFF 를 분명히 */
export function AutoButton({ save, onInput, short }: { save: Save; onInput(i: GameInput): void; short: boolean }) {
  const auto = save.settings.autoBattle;
  return (
    <Button
      secondary={!auto}
      onClick={() => onInput({ kind: 'auto-battle', on: !auto })}
      title={auto ? '자동 전투 켜짐 — 누르면 끔' : '자동 전투 꺼짐 — 켜면 내 행동도 알아서 (필살기 · 연타는 직접도 됨)'}
    >
      {short ? (auto ? '🔁✓' : '🔁') : auto ? '🔁 자동 ON' : '🔁 자동 OFF'}
    </Button>
  );
}

function HpBlock({ f, side, x, bottom, wide }: { f: Fighter; side: Side; x: number; bottom: number; wide: number }) {
  const status = f.status ? STATUS_LABEL[f.status.kind] : null;
  const title = `${side === 'foe' ? '야생 ' : ''}${nameOf(f)} Lv${f.level} · HP ${f.hp}/${f.maxHp}${status ? ` · ${status}` : ''}`;
  return (
    <div class={`pg-hpblock pg-hpblock-${side}`} style={{ left: `${x}px`, bottom: `${bottom}px`, width: `${wide}px` }} title={title}>
      {side === 'foe' && <Bar value={f.ult} cls={f.ult >= 1 ? 'pg-bar-ult pg-full' : 'pg-bar-ult'} />}
      <span class="pg-hprow">
        <span class="pg-hpname">{nameOf(f)}</span>
        <span class="pg-lv">Lv{f.level}</span>
        <Bar value={f.hp / f.maxHp} cls={`pg-bar-hp pg-hp-${hpColor(f.hp, f.maxHp)}`} />
        {status && <span class={`pg-status pg-status-${f.status!.kind}`}>{status}</span>}
        {side === 'me' && <span class="pg-hpnum">{f.hp}</span>}
      </span>
      <Bar value={f.gauge} cls={f.gauge >= 1 ? 'pg-bar-act pg-full' : 'pg-bar-act'} />
    </div>
  );
}

/** 포켓몬 그림 + 지금 하는 행동의 몸 움직임 (달려들기 · 들어가기 · 쓰러짐 · 맞음) */
function FighterBody(props: { b: BattleState; side: Side; x: number; target: number; px: number; media: string; ground: number }) {
  const { b, side, x, target, px, media, ground } = props;
  const f = b[side];
  const anim = b.anim?.side === side ? b.anim : null;
  const act = anim?.action;
  const mv = act?.kind === 'move' ? moveOf(act.moveId) : undefined;
  const lunge = act?.kind === 'attack' || (act?.kind === 'move' && mv && mv.power > 0 && !isShooting(mv));
  const hurt = b.popups.some((p) => p.side === side && p.kind === 'damage' && p.ms < HURT_MS);
  const cls = [
    'pg-fx-body',
    lunge ? 'pg-lunge' : '',
    act?.kind === 'switch' ? 'pg-recall' : '',
    act?.kind === 'ult' ? 'pg-charging' : '',
    hurt ? 'pg-hurt' : '',
    f.hp <= 0 ? 'pg-fainted' : '',
    f.guard < 1 ? 'pg-guarded' : '',
  ].join(' ');
  return (
    <span class={`pg-obj pg-fighter pg-fighter-${side}${side === 'me' ? ' pg-sendout' : ''}`} style={{ left: `${x}px`, bottom: `${ground}px` }} title={`${side === 'foe' ? '야생 ' : ''}${nameOf(f)} Lv${f.level}`}>
      <span key={animKey(b)} class={cls} style={{ '--pg-dx': `${Math.round((target - x) * 0.75)}px`, animationDuration: anim ? `${anim.dur}ms` : undefined }}>
        <Sprite media={media} form={f.form} shiny={f.shiny} scale={1} px={px} faceLeft={side === 'foe'} />
      </span>
    </span>
  );
}

/** 날아가는 기술 · 터지는 자리 · 방어 · 아이템 · 필살기 빛줄기 (맞는 순간 = 연출 끝쪽, 피해 숫자와 같이) */
function Effects({ b, geo, ground, midMe, midFoe }: { b: BattleState; geo: BattleGeometry; ground: number; midMe: number; midFoe: number }) {
  const anim = b.anim;
  if (!anim) return null;
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
    out.push(<span key={`${key}z`} class="pg-fx pg-fx-pulse" style={{ left: `${from}px`, bottom: `${y}px`, animationDuration: dur }}>{b[anim.side].status?.kind === 'sleep' ? '💤' : '⚡'}</span>);
  } else if (a.kind === 'ult') {
    const f = b[anim.side];
    const color = moveColor(null, f.types[0] ?? null);
    out.push(
      <div key={`${key}c`} class={`pg-ult-cut pg-ult-cut-${anim.side}`} style={{ animationDuration: dur }}>
        <span>
          💥 {anim.side === 'foe' ? '야생 ' : ''}
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

/** 위 가운데 · 또는 (낮은 패널) 상대 오른쪽 */
function msgStyle(geo: BattleGeometry) {
  return geo.msgSide ? { left: `${geo.msgSide.left}px`, maxWidth: `${geo.msgSide.maxWidth}px`, transform: 'none' } : undefined;
}

/** S10 힘대결 — 두 기술이 가운데서 밀고 밀림. 연타할수록 맞부딪히는 자리가 상대 쪽으로 (gdd S10 ⑤) · 승자가 정해지면 이긴 줄기가 끝까지 */
function Clash({ b, geo, y }: { b: BattleState; geo: BattleGeometry; y: number }) {
  const c = b.clash;
  if (!c) return null;
  const p = clashWithTaps(c.base, c.taps);
  const point = c.winner === 'me' ? geo.foeX : c.winner === 'foe' ? geo.meX : Math.round(geo.meX + (geo.foeX - geo.meX) * Math.min(0.88, Math.max(0.12, p)));
  const meColor = c.kind === 'ult' ? moveColor(null, b.me.types[0] ?? null) : moveColor(c.me, null);
  const foeColor = c.kind === 'ult' ? moveColor(null, b.foe.types[0] ?? null) : moveColor(c.foe, null);
  const meKind = c.kind === 'ult' ? 'beam' : duelKind(c.me);
  const foeKind = c.kind === 'ult' ? 'beam' : duelKind(c.foe);
  const left = Math.max(0, TIMING.clashMs - c.ms);
  const big = c.kind === 'ult' ? ' pg-clash-ult' : '';
  const done = c.winner !== null ? ' pg-clash-done' : '';
  // 포커스가 없으면 Space 는 편집기로 감 → 클릭 안내 (선제공격과 같은 규칙)
  const tapHint = geo.compact ? '👆 연타!' : document.hasFocus() ? '👆 연타! (Space · 클릭)' : '👆 클릭 연타!';
  return (
    <>
      <span class={`pg-clash-beam pg-duel-${meKind}${big}${done}`} style={{ left: `${geo.meX}px`, width: `${Math.max(0, point - geo.meX)}px`, bottom: `${y}px`, backgroundColor: meColor }} />
      <span class={`pg-clash-beam pg-duel-${foeKind}${big}${done}`} style={{ left: `${point}px`, width: `${Math.max(0, geo.foeX - point)}px`, bottom: `${y}px`, backgroundColor: foeColor }} />
      <span class={`pg-fx pg-clash-point${done}`} style={{ left: `${point}px`, bottom: `${y}px` }}>
        💥
      </span>
      <div class="pg-clash-info" style={msgStyle(geo)}>
        {c.winner !== null ? (
          <b>{c.winner === 'me' ? '🎉 힘대결에서 이겼다!' : '💦 힘대결에서 졌다…'}</b>
        ) : (
          <>
            <span>
              내 쪽 <b>{Math.round(p * 100)}%</b>
            </span>
            <span class="pg-clash-tap">{tapHint}</span>
            <span class="pg-dim">{c.taps >= MAX_TAPS ? '연타 MAX' : `연타 ${c.taps}/${MAX_TAPS}`}</span>
            <span class="pg-clash-time">
              <span class="pg-bar-fill" style={{ width: `${Math.round((left / TIMING.clashMs) * 100)}%` }} />
            </span>
          </>
        )}
      </div>
    </>
  );
}

export function BattleLayer({ battle: b, save, media, ground, geo, onInput }: BattleLayerProps) {
  const midMe = ground + Math.round(geo.meSpritePx * 0.45);
  const midFoe = ground + Math.round(geo.foeSpritePx * 0.45);
  const popups = (side: Side) => b.popups.filter((p) => p.side === side);
  const popBase = (side: Side) => (side === 'me' ? geo.meHpBottom : geo.foeHpBottom) + geo.hpBlockPx + 2;
  // 필살기 컷인이 같은 말을 하는 동안 · 둘 곳이 없는 좁은 패널에서는 위 한 줄을 숨김
  const showMsg = b.msg && !geo.msgHidden && b.phase !== 'clash' && b.anim?.action.kind !== 'ult';
  // 나갈 포켓몬이 없는 채로 시작한 전투 (이상한 세이브) — 내 자리는 비움
  const hasMe = b.me.uid !== 'none';
  return (
    <>
      {hasMe && <FighterBody key={`me${b.me.uid}`} b={b} side="me" x={geo.meX} target={geo.foeX} px={geo.meSpritePx} media={media} ground={ground} />}
      <FighterBody key="foe" b={b} side="foe" x={geo.foeX} target={geo.meX} px={geo.foeSpritePx} media={media} ground={ground} />
      {hasMe && <HpBlock f={b.me} side="me" x={geo.meHpX} bottom={geo.meHpBottom} wide={geo.meHpWide} />}
      <HpBlock f={b.foe} side="foe" x={geo.foeHpX} bottom={geo.foeHpBottom} wide={geo.foeHpWide} />
      {b.phase === 'clash' ? <Clash b={b} geo={geo} y={Math.round((midMe + midFoe) / 2)} /> : <Effects b={b} geo={geo} ground={ground} midMe={midMe} midFoe={midFoe} />}
      {(['me', 'foe'] as const).map((side) =>
        popups(side).map((p, i) => (
          <span key={p.id} class={`pg-pop pg-pop-${p.kind}`} style={{ left: `${side === 'me' ? geo.meHpX : geo.foeHpX}px`, bottom: `${popBase(side) + i * POP_STACK_PX}px` }}>
            {p.text}
          </span>
        )),
      )}
      {showMsg && (
        <div key={b.msg} class={b.phase === 'over' ? 'pg-bmsg pg-bmsg-over' : 'pg-bmsg'} style={msgStyle(geo)} title={b.msg}>
          {b.msg}
        </div>
      )}
      {!geo.autoInMenu && (
        <span class="pg-auto" style={{ bottom: `${geo.autoBottom}px` }}>
          <AutoButton save={save} onInput={onInput} short={false} />
        </span>
      )}
      {!geo.menuInBar && (
        <div class="pg-bmenu-wrap" style={{ left: `${geo.menuLeft}px`, bottom: `${geo.menuBottom}px`, maxWidth: `calc(100% - ${geo.menuLeft + 6}px)` }}>
          <BattleMenu battle={b} save={save} onInput={onInput} lead={geo.autoInMenu ? <AutoButton save={save} onInput={onInput} short={geo.compact} /> : null} compact={geo.compact} />
        </div>
      )}
    </>
  );
}

/** 패널이 낮을 때 — 위 정보줄 자리에 메뉴 줄 (gdd S09 [확정]) */
export function BattleMenuBar({ battle, save, onInput, withAuto, compact }: { battle: BattleState; save: Save; onInput(i: GameInput): void; withAuto: boolean; compact: boolean }) {
  return (
    <div class="pg-infobar pg-infobar-battle">
      <BattleMenu battle={battle} save={save} onInput={onInput} compact={compact} lead={withAuto ? <AutoButton save={save} onInput={onInput} short={compact} /> : null} />
    </div>
  );
}
