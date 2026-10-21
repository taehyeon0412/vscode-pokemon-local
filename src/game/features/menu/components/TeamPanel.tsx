/**
 * S18 내 포켓몬 (gdd S18 · 4.10) — ① 팀 5칸 (맨 앞 = 선두, ← → 로 순서 · 전투 중만 아니면 어디서나) · ② 보관함
 * (병원 · 체육관 대기실 · 스테이지 시작 전에 열면 팀과 바꿈, 그 밖에선 보기만) · ④ 스탯 · 경험치 · ⑤ 남은 포인트 나누기 · ③ 닫기.
 * 순서 = 팀 칸 끌어다 놓기 · ← → 버튼 · 키 — 임시 디자인.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { BALANCE } from '../../../core/balance';
import type { GameInput } from '../../../core/engine';
import { STAT_KEYS, type Save } from '../../../core/save';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { Sprite } from '../../../ui/Sprite';
import { STAT_LABEL, teamView, type MonsterView } from '../model';
import { Panel, Row } from './Panel';
import { MAP_ROW_MIN_HEIGHT_PX } from '../../../ui/layout';
import { CardArt, StatCard, type StatCardData } from './StatCard';

export interface TeamPanelProps {
  save: Save;
  media: string;
  /** 보관함과 바꿀 수 있는 곳 (병원 · 대기실 · 스테이지 시작 전) */
  swap: boolean;
  /** 처음 고를 포켓몬 (없으면 선두) */
  first?: string;
  onInput(i: GameInput): void;
  onClose(): void;
}

/** 끌어다 놓기 (팀 칸끼리 — 순서 바꾸기) */
interface Drag {
  onStart(uid: string): void;
  onDrop(uid: string): void;
}

function Chip({ m, media, selected, lead, onClick, drag }: { m: MonsterView; media: string; selected: boolean; lead: boolean; onClick(): void; drag?: Drag }) {
  const hpCls = m.hp <= 0 ? ' pg-chip-down' : '';
  return (
    <button
      type="button"
      class={`pg-chip pg-team-chip${selected ? ' pg-chip-on' : ''}${hpCls}`}
      onClick={onClick}
      title={`${m.name} Lv${m.level} · HP ${m.hp}/${m.maxHp}${m.status ? ` · ${m.status}` : ''}${drag ? ' — 끌어다 놓아 순서 바꾸기' : ''}`}
      draggable={!!drag}
      onDragStart={drag ? () => drag.onStart(m.uid) : undefined}
      onDragOver={drag ? (e) => e.preventDefault() : undefined}
      onDrop={
        drag
          ? (e) => {
              e.preventDefault();
              drag.onDrop(m.uid);
            }
          : undefined
      }
    >
      <Sprite media={media} form={m.form} shiny={m.shiny} scale={1} crop={22} />
      {lead && <span class="pg-lead">선두</span>}
      <span class="pg-ellipsis">{m.name}</span>
      <span class="pg-dim">Lv{m.level}</span>
      {m.unspent > 0 && <span class="pg-dot" title={`남은 포인트 ${m.unspent}`} />}
    </button>
  );
}

/** 카드 뒤 — 경험치 (이름 + 가는 막대, 아트 디렉터 4차) · 상태 · 기술 (막대 뒤 "·" 는 없앰 — 경험치 없음처럼 읽혀서, 5차) */
function CardMore({ v }: { v: MonsterView }) {
  return (
    <>
      <span class="pg-exp" title={`다음 레벨까지 경험치 ${v.expToNext}`}>
        경험치
        <span class="pg-expbar">
          <span class="pg-bar-fill" style={{ width: `${Math.round(v.expRatio * 100)}%` }} />
        </span>
      </span>
      {v.status && <span class="pg-status">{v.status}</span>}
      {v.moves.length === 0 ? (
        <span class="pg-dim">기술 없음 (1 공격만)</span>
      ) : (
        v.moves.map((mv) => (
          <span key={mv.id} class="pg-move" title={mv.detail}>
            {mv.name} <span class="pg-sub">{mv.short}</span>
          </span>
        ))
      )}
    </>
  );
}

/** 내 포켓몬 → 카드 (HP 는 지금 HP / 최대) */
function cardOf(v: MonsterView): StatCardData {
  const st = (k: string) => v.stats.find((x) => x.key === k)?.value ?? 0;
  return { name: v.name, form: v.form, shiny: v.shiny, level: v.level, hp: v.hp, maxHp: v.maxHp, star: v.star, attack: st('attack'), defense: st('defense'), speed: st('speed'), ultimate: st('ultimate') };
}

export function TeamPanel({ save, media, swap, first, onInput, onClose }: TeamPanelProps) {
  const { party, box } = teamView(save);
  const [sel, setSel] = useState<string | null>(first ?? party[0]?.uid ?? null);
  const selected = [...party, ...box].find((m) => m.uid === sel) ?? party[0] ?? null;
  const inParty = selected ? party.some((m) => m.uid === selected.uid) : false;
  const idx = selected ? party.findIndex((m) => m.uid === selected.uid) : -1;
  // 끌어다 놓기 — 놓은 칸 자리로 한 칸씩 옮김 (← → 와 같은 입력)
  const dragging = useRef<string | null>(null);
  const drag: Drag = {
    onStart: (uid) => {
      dragging.current = uid;
      setSel(uid);
    },
    onDrop: (target) => {
      const from = party.findIndex((m) => m.uid === dragging.current);
      const to = party.findIndex((m) => m.uid === target);
      const uid = dragging.current;
      dragging.current = null;
      if (from < 0 || to < 0 || !uid) return;
      for (let i = 0; i < Math.abs(to - from); i++) onInput({ kind: 'team-move', uid, dir: to > from ? 1 : -1 });
    },
  };

  // ← → = 고른 팀 포켓몬 순서 (Esc 는 Panel)
  const now = useRef({ selected, inParty, onInput });
  now.current = { selected, inParty, onInput };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const c = now.current;
      if (e.repeat || !c.selected || !c.inParty || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      e.preventDefault();
      c.onInput({ kind: 'team-move', uid: c.selected.uid, dir: e.key === 'ArrowLeft' ? -1 : 1 });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Panel
      icon="ball"
      title="내 포켓몬"
      // 보관함 = 아이콘 (칩 줄 보관함 칸과 같은 그림 — 맥 글자면 240 에서 "팀 1/5 · 보관함 0" 이 "…" 로 잘리던 것, 픽셀 밤 점검)
      extra={
        <span title={`팀 ${party.length}/${BALANCE.partySize} · 보관함 ${box.length}`}>
          <span class="pg-tip-long">팀 </span>
          {party.length}/{BALANCE.partySize} · <Icon name="box" /> {box.length}
        </span>
      }
      onClose={onClose}
    >
      {/* 남은 포인트 = 판 맨 위 따로 한 줄 + 누구의 포인트인지 (스탯 찍기 말풍선에서 오면 바로 보이게 — 이동 버튼과 한 줄이면 480 에서 "+스피드" 가 반쯤 · "+필살" 이 안 보이고, 칩 아래면 240 에서 칩 네 줄에 밀려 스크롤해야 보이던 것, UX 밤 점검) */}
      {selected && selected.unspent > 0 && (
        <Row wrap>
          <span class="pg-points-left">
            {selected.name} 남은 포인트 {selected.unspent}
          </span>
          {STAT_KEYS.map((k) => (
            <Button key={k} secondary onClick={(e?: MouseEvent) => onInput({ kind: 'points', uid: selected.uid, stat: k, n: e?.shiftKey ? BALANCE.shopBulk : 1 })} title={`${STAT_LABEL[k]} +1 포인트 (Shift + 클릭 +${BALANCE.shopBulk})`}>
              +{STAT_LABEL[k]}
            </Button>
          ))}
        </Row>
      )}
      {/* 라벨 열 없음 — 칩 줄만 봐도 팀 · 보관함 (아트 디렉터 3차 "라벨: 값 양식") · 넘치면 다음 줄 (480 에서 다섯째 칩 · 240 에서 "보관함이 비었어요" 가 잘리던 것 — UX · 픽셀 밤 점검) */}
      <Row wrap>
        {party.map((m, i) => (
          <Chip key={m.uid} m={m} media={media} selected={selected?.uid === m.uid} lead={i === 0} onClick={() => setSel(m.uid)} drag={drag} />
        ))}
        <span class="pg-panel-sep">
          <Icon name="box" title="보관함" />
        </span>
        {box.length === 0 ? <span class="pg-dim">보관함이 비었어요</span> : box.map((m) => <Chip key={m.uid} m={m} media={media} selected={selected?.uid === m.uid} lead={false} onClick={() => setSel(m.uid)} />)}
      </Row>
      {selected && (
        <>
          <Row wrap>
            {inParty && (
              <>
                <Button secondary onClick={() => onInput({ kind: 'team-move', uid: selected.uid, dir: -1 })} disabled={idx <= 0} title="한 칸 앞으로 (맨 앞 = 선두)">
                  ← 한 칸 앞
                </Button>
                <Button secondary onClick={() => onInput({ kind: 'team-move', uid: selected.uid, dir: 1 })} disabled={idx >= party.length - 1} title="한 칸 뒤로">
                  한 칸 뒤 →
                </Button>
                {swap && (
                  <Button secondary onClick={() => onInput({ kind: 'team-to-box', uid: selected.uid })} disabled={party.length <= 1} title="보관함으로 (팀에 하나는 남겨요)">
                    <Icon name="box" /> 보관함으로
                  </Button>
                )}
              </>
            )}
            {!inParty && swap && (
              <>
                {party.length < BALANCE.partySize && <Button onClick={() => onInput({ kind: 'team-swap', boxUid: selected.uid, partyUid: null })}>팀에 넣기</Button>}
                {party.map((p, i) => (
                  <Button key={p.uid} secondary onClick={() => onInput({ kind: 'team-swap', boxUid: selected.uid, partyUid: p.uid })} title={`${p.name} 와(과) 바꾸기`}>
                    ↔ {i + 1} {p.name}
                  </Button>
                ))}
              </>
            )}
            {!inParty && !swap && <span class="pg-dim">보관함 포켓몬이에요 (병원에서 팀과 바꿔요)</span>}
          </Row>
          {/* 180px 이상 = 두 줄 카드 (왼쪽 48 그림 · 1줄 이름 · HP · 스탯 / 2줄 경험치 · 기술 — 아트 디렉터 5차), 낮으면 한 줄 (판 안 스크롤) · 좁으면 다음 줄로 */}
          {window.innerHeight >= MAP_ROW_MIN_HEIGHT_PX ? (
            <div class="pg-card2 pg-team-card">
              <CardArt media={media} form={selected.form} shiny={selected.shiny} />
              <Row wrap>
                <StatCard d={cardOf(selected)} media={media} art={false} />
              </Row>
              <Row wrap>
                <CardMore v={selected} />
              </Row>
            </div>
          ) : (
            <Row wrap>
              <StatCard d={cardOf(selected)} media={media} />
              <CardMore v={selected} />
            </Row>
          )}
        </>
      )}
    </Panel>
  );
}
