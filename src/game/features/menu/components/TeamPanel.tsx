/**
 * S18 내 포켓몬 (gdd S18 · 4.10) — ① 팀 5칸 (맨 앞 = 선두, ← → 로 순서 · 전투 중만 아니면 어디서나) · ② 보관함
 * (병원 · 체육관 대기실 · 스테이지 시작 전에 열면 팀과 바꿈, 그 밖에선 보기만) · ④ 스탯 · 경험치 · ⑤ 남은 포인트 나누기 · ③ 닫기.
 * 순서 = 팀 칸 끌어다 놓기 · ← → 버튼 · 키 — 임시 디자인.
 */
import { Fragment, type ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { BALANCE } from '../../../core/balance';
import type { GameInput } from '../../../core/engine';
import { releaseWarns, releaseWhy, type ReleaseWarn } from '../../../core/rules/bag';
import { STAT_KEYS, type Save } from '../../../core/save';
import { withJosa } from '../../../core/text';
import { Button } from '../../../ui/Button';
import { confirmKey, onKeyboardButton, SPACE_BOX_MIN_MS, useShownAt } from '../../../ui/confirm-key';
import { realNow } from '../../../ui/real-clock';
import { Icon } from '../../../ui/Icon';
import { Sprite } from '../../../ui/Sprite';
import { afterRelease, STAT_LABEL, teamView, type MonsterView } from '../model';
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

/** S18 ⑥ 놓아주기 버튼 — 못 누르면 까닭 한 줄을 버튼 옆에 (올려야만 보이면 왜 안 눌리는지 모름 — U5) */
function ReleaseButton({ why, name, onClick }: { why: string | null; name: string; onClick(): void }) {
  // [까닭][버튼] — 버튼은 늘 줄 오른쪽 끝 (못 누를 때 자리가 옮겨 가던 것, 아트 #121) · 위험 = 기존 부품 .pg-danger (보조 버튼 + 빨강 글)
  return (
    <span class="pg-release">
      {why && <span class="pg-dim pg-release-why">{why}</span>}
      <Button secondary extraClass="pg-release-btn pg-danger" onClick={onClick} disabled={why !== null} title={why ?? `${withJosa(name, '을/를')} 놓아줘요 — 다시 돌아오지 않아요 (한 번 더 물어요)`}>
        놓아주기
      </Button>
    </span>
  );
}

/** 놓아주기 한 번 더 물을 까닭 (rules/bag releaseWarns) — 확인 줄 둘째 물음에 그대로 · ★ 는 보관함 · 잡은 카드와 같은 금색 ★ */
//   높은 Lv 은 "높은" 까지 (Lv 19 만이면 왜 경고인지 안 보이던 것 — UX #121)
const WARN_WORD: Record<ReleaseWarn, (m: MonsterView) => ComponentChildren> = { shiny: () => '이로치', star5: () => <span class="pg-star">★5</span>, high: (m) => `높은 Lv ${m.level}` };

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
            {mv.name} <span class="pg-sub"><span class="pg-mv-type">{mv.typeKo} · </span>{mv.short}</span>
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

  // S18 ⑥ 놓아주기 (#121) — 고른 칸 줄 끝 작은 버튼 → 그 줄 자리가 확인 줄 (기본 = 아니요 · 이로치 · ★5 · 높은 Lv 은 한 번 더)
  const [ask, setAsk] = useState<{ uid: string; step: 1 | 2 } | null>(null);
  // 확인 줄 커서 0 = 아니요 · 1 = 놓아주기
  const [askOn, setAskOn] = useState(0);
  // 확인 줄이 뜬 때 (Space 는 1초 뒤부터 · 연타 묶음 안 받음 — #117 confirm-key)
  const shownAt = useShownAt(ask ? `${ask.uid}:${ask.step}` : '');
  const askMon = ask ? [...party, ...box].find((m) => m.uid === ask.uid) ?? null : null;
  // 고른 칸이 바뀌거나 사라지면 확인 줄을 닫음
  useEffect(() => {
    if (ask && (!askMon || ask.uid !== selected?.uid)) setAsk(null);
  }, [ask, askMon, selected?.uid]);
  // 놓아준 뒤 판 안 한 줄 — 판이 놓은 이름을 직접 들고 그림 (판이 열린 동안 게임이 멈춰 알림 줄도 멈춰서, 알림 글을 쓰면 판을 열 때 떠 있던
  //   "피카츄를 잡았다!" 가 나오던 것 — UX #121 큼) · 판이 닫힐 때까지 남김 (놓을 때마다 줄이 끼어들어 다음 [놓아주기] 가 16px 씩 옮겨 가던 것)
  const [released, setReleased] = useState<string | null>(null);
  // 확인 줄이 닫힌 때 — 닫힌 직후 → 가 팀 순서를 말없이 바꾸지 않게 0.5초 ← → 안 받음 (UX #121)
  const closedAt = useRef(-Infinity);
  const closeAsk = () => {
    closedAt.current = realNow();
    setAsk(null);
  };
  const openAsk = (uid: string) => {
    setAsk({ uid, step: 1 });
    setAskOn(0);
  };
  // 확인 줄이 뜰 때 · 둘째 물음으로 바뀔 때 판 스크롤 안으로 데려옴 (187 에서 위 8px 조각만 보이던 것 — UX #121 큼 · 태현 님 #430 과 같은 종류)
  const askRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (ask) askRef.current?.scrollIntoView({ block: 'nearest' });
  }, [ask?.uid, ask?.step]);
  // 놓은 뒤 새로 고른 칸도 데려옴 (240 × 150 에서 칩 아래 테두리만 · 이름이 안 보여 [놓아주기] 가 누구 것인지 몰랐던 것 — UX #121 2바퀴)
  const followSel = useRef(false);
  useLayoutEffect(() => {
    if (!followSel.current) return;
    followSel.current = false;
    document.querySelector<HTMLElement>('#pokemon-game .pg-team-chip.pg-chip-on')?.scrollIntoView({ block: 'nearest' });
  }, [sel]);
  const confirm = () => {
    if (!ask || !askMon) return;
    // 확인 줄이 뜬 지 1초 안은 놓아주기를 안 받음 (키 · 마우스 모두) — 같은 자리에 둘째 물음 [그래도 놓아주기] 가 떠서 두 번 누름 한 번에 이로치 · ★5 가 놓이던 것 (U1 — 묻는 글이 1초는 보이게)
    if (realNow() - shownAt < SPACE_BOX_MIN_MS) return;
    // 누르는 그때 다시 봄 (뜬 뒤 팀이 바뀌었을 수 있음 — 코드 리뷰어 #121)
    if (releaseWhy(save, ask.uid) !== null) {
      closeAsk();
      return;
    }
    if (ask.step === 1 && releaseWarns(save, ask.uid).length > 0) {
      setAsk({ uid: ask.uid, step: 2 });
      setAskOn(0);
      return;
    }
    // 놓은 뒤 = 같은 목록 옆 칸 (afterRelease — 선두로 떨어지지 않게) · 그 칩을 판 안으로
    followSel.current = true;
    setSel(afterRelease(party.map((m) => m.uid), box.map((m) => m.uid), ask.uid));
    closeAsk();
    setReleased(askMon.name);
    onInput({ kind: 'release', uid: ask.uid });
  };
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

  // ← → = 고른 팀 포켓몬 순서 (Esc 는 Panel) · 확인 줄이 떠 있으면 ← → = 아니요 · 놓아주기 커서 · Enter (Space 는 1초 뒤 · 연타 묶음 안 받음) = 커서 · Esc = 아니요
  const now = useRef({ selected, inParty, onInput, ask, askOn, shownAt, confirm, closeAsk });
  now.current = { selected, inParty, onInput, ask, askOn, shownAt, confirm, closeAsk };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const c = now.current;
      if (c.ask) {
        if (e.key === 'Tab') return;
        // 판 (Esc 닫기) · 게임 키보다 먼저 (capture) — 확인 줄 몫
        e.stopPropagation();
        if ((e.key === 'Enter' || e.code === 'Space') && onKeyboardButton(e)) return;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          if (!e.repeat) setAskOn((v) => 1 - v);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          c.closeAsk();
          return;
        }
        const space = e.code === 'Space';
        if (e.key !== 'Enter' && !space) return;
        e.preventDefault();
        if (e.repeat || (space && !confirmKey(e, c.shownAt))) return;
        if (c.askOn === 1) c.confirm();
        else c.closeAsk();
        return;
      }
      if (e.repeat || !c.selected || !c.inParty || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
      if (realNow() - closedAt.current < 500) return;
      e.preventDefault();
      c.onInput({ kind: 'team-move', uid: c.selected.uid, dir: e.key === 'ArrowLeft' ? -1 : 1 });
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
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
      // 놓아준 직후 한 줄 (엔진 알림 글 — 알림 줄은 판 밑에 깔림) = 판 머리 바로 아래 (판 안 끝 줄이면 187 에서 스크롤 아래로 반쯤 잘리던 것 — U1) · 상점 판 note 와 같은 자리
      sub={
        released ? (
          <span class="pg-release-note" role="status">
            {withJosa(released, '을/를')} 놓아줬다… 잘 지내!
          </span>
        ) : undefined
      }
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
      {selected && ask && askMon && (
        // 확인 줄 = 고른 칸 줄 자리 (위로 떠 다른 것을 덮는 상자가 아니라) · 주 버튼 = 아니요 (기본 커서) · 놓아주기 = 위험 부품 .pg-danger · 커서 = ▸ (메뉴와 같은 말)
        <Row wrap>
          <span ref={askRef} class="pg-release-ask" role="alertdialog" aria-label="놓아주기 확인">
            {ask.step === 1 ? (
              // 꼭 읽을 한 마디 = 빨강 굵게 (타이틀 "지금 저장이 지워져요." 와 같은 .pg-danger-text — 흐린 글이면 줄에서 가장 늦게 읽히던 것, 아트 #121)
              <span class="pg-release-q">
                <b>{withJosa(askMon.name, '을/를')}</b> 놓아줄까요? <b class="pg-danger-text">다시 돌아오지 않아요</b>
              </span>
            ) : (
              // 둘째 물음에도 이름 (첫 물음을 1초만 본 사람이 누구를 묻는지 모르던 것 — UX #121)
              <span class="pg-release-q">
                <b>{askMon.name}</b> ·{' '}
                <b class="pg-release-warn">
                  {releaseWarns(save, askMon.uid).map((w, i) => (
                    <Fragment key={w}>
                      {i > 0 && ' · '}
                      {WARN_WORD[w](askMon)}
                    </Fragment>
                  ))}
                </b>{' '}
                — 정말 놓아줄까요?
              </span>
            )}
            <Button extraClass={askOn === 0 ? 'pg-on' : undefined} onClick={closeAsk} onMouseEnter={() => setAskOn(0)} title="Esc — 놓아주지 않아요">
              <span class="pg-release-cur">▸</span>
              아니요
            </Button>
            <Button secondary extraClass={`pg-release-go pg-danger${askOn === 1 ? ' pg-on' : ''}`} onClick={confirm} onMouseEnter={() => setAskOn(1)} title={ask.step === 1 ? '놓아주기 — 다시 돌아오지 않아요' : '그래도 놓아주기'}>
              <span class="pg-release-cur">▸</span>
              {ask.step === 1 ? '놓아주기' : '그래도 놓아주기'}
            </Button>
          </span>
        </Row>
      )}
      {selected && (
        <>
          {!ask && <Row wrap>
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
            {!inParty && !swap && <span class="pg-dim pg-box-only">보관함 포켓몬이에요 (병원에서 팀과 바꿔요)</span>}
            {/* 놓아주기 — 줄 끝 작은 버튼 (크게 누를 것 아님 · 위험 = .pg-danger 보조 버튼 + 빨강 글) · 못 누르면 모든 버튼과 같은 끊긴 흐린 테두리 + 까닭 한 줄 (rules/bag releaseWhy) */}
            <ReleaseButton why={releaseWhy(save, selected.uid)} name={selected.name} onClick={() => openAsk(selected.uid)} />
          </Row>}
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
