/**
 * S09 ⑦ 메뉴 한 줄 (1 공격 · 2 방어 · 3 기술 · 4 아이템 · 5 교체 · 도망 — 숫자 키) · ⑧ 필살기 게이지 💥 (Z) · ⑪ 맞받아치기 (Space).
 * 내 행동 게이지가 다 차면 켜짐 (그 전에는 흐리게). 3 기술 → 같은 줄이 기술 목록, ← · Esc 로 돌아감.
 * 쓰러지면 같은 줄이 "다음 포켓몬" (숫자 키).
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { maxHpOf } from '../../../core/rules/bag';
import { battleAutoUltLeft, battleFoeUltWarn, canAct, canUlt, catchTriesUsed, counterOpen, itemLeft, lastChanceLimitMs, switchable, ultCounterOpen, type BattleState, type GameInput } from '../../../core/engine';
import { BALLS, type BallId } from '../../../core/rules/catch';
import { itemName } from '../../../core/rules/items';
import type { Save } from '../../../core/save';
import { moveOf, speciesOf } from '../../../data';
import { Button } from '../../../ui/Button';
import { BALL_ICON } from '../../../ui/BallCount';
import { confirmKey, onKeyboardButton, useShownAt } from '../../../ui/confirm-key';
import { ITEM_ICON } from '../../menu/model';
import { Icon } from '../../../ui/Icon';
import { KeyCap } from '../../../ui/KeyCap';
import { KO_FLIP_MS, KO_SLUMP_MS, KO_START_LAG_MS, koFallAt, koTiming, setPickShow } from '../fx/hold';
import { useFallWake } from './fallWake';
import { ballTier, catchTone, catchView, hpColor, menuItems, TIER_WORD, TONE_WORD, type MenuItem, type MenuPage } from '../model';

/** 다음 포켓몬 고르기가 보이는 때 (ms) — game.css .pg-pick-list 의 2.3s 와 같은 값 (벌러덩 2.3초 · 쓰러진 모습이 다 사라진 뒤) */
const PICK_SHOW_MS = 2300;
/** 메뉴 줄 줄이기 단계 (game.css .pg-fit-○ — 버튼이 잘리면 한 단계씩, 폭 경계를 손으로 고르면 경계 사이에 틈이 생겨 잘리던 것 — orders #23 UX 리뷰어 2차).
 *  count 개수 · name 볼 이름 · word "마지막 기회!" · one 볼마다 칸 → "5초" 옆 칸 하나 · pad 여백 · none 그 칸도 뺌 · column 옆 메뉴 한 칸으로 · list 무대 위 세로 목록 */
type FitStep = 'count' | 'name' | 'word' | 'noword' | 'one' | 'pad' | 'none' | 'column' | 'list';
/** 마지막 기회 — 볼 단계가 다 같으면 칸 하나로 먼저 (같은 "어려움" 셋을 남기고 "마지막 기회!" 를 먼저 빼던 것 — U1, UX 리뷰어 3차) */
// "마지막 기회!" 는 볼마다 칸 · 여백을 줄인 뒤에도 넘칠 때만 뺌 (240 에서 먼저 빠져 "5초" 뜻이 약하던 것 — UX 밤 점검 U1 · U5)
//   word = "마지막 기회!" → 짧은 "기회" · noword = 그것도 뺌
const FIT_LAST: FitStep[] = ['count', 'name', 'one', 'pad', 'word', 'noword', 'none'];
const FIT_LAST_SAME: FitStep[] = ['count', 'name', 'one', 'pad', 'word', 'noword', 'none'];
const FIT_ROW: FitStep[] = ['count', 'name', 'list'];
const FIT_SIDE: FitStep[] = ['count', 'name', 'column', 'list'];
/** 무대 위 목록 한 줄 (16 + 사이 1) · 제목 줄 · 위아래 여백 — 낮은 패널에서 줄 수를 정함 */
const LIST_ROW_PX = 17;
const LIST_HEAD_PX = 30;

/** 버튼 글이 넘치는지 — 내용의 실제 너비로 (scrollWidth 는 정수라 0.02 ~ 0.43px 넘침을 못 보는데 그래도 "…" 가 그려지던 것 — UX 리뷰어 #23 3차) */
function textOver(x: HTMLElement): boolean {
  // 아직 안 그려진 칸 (폭 0 — 처음 장면) 은 안 잼 (그때 넘침으로 세어 단계가 쌓여 "마지막 기회!" 가 빠지던 것 — UX 리뷰어 #23 4차)
  if (x.clientWidth === 0) return false;
  if (x.scrollWidth > x.clientWidth) return true;
  const cs = getComputedStyle(x);
  const inner = x.getBoundingClientRect().right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth);
  const r = document.createRange();
  r.selectNodeContents(x);
  // 0.019 — 줄임표는 0.02px 부터 그려지고 · 배치 반올림 (1/64px = 0.016) 은 넘침이 아님 (넓은 자리인데 단계가 끝까지 쌓이던 것)
  return r.getBoundingClientRect().right > inner + 0.019;
}

export interface BattleMenuProps {
  battle: BattleState;
  save: Save;
  onInput(input: GameInput): void;
  /** 줄 맨 앞에 붙는 것 (낮은 패널에서 자동 전투 스위치) */
  lead?: ComponentChildren;
  /** 좁은 패널 — 짧은 이름 · 'tiny' = 300px 아래 (번호 없는 두 글자) */
  compact?: boolean | 'tiny';
  /** 옆 메뉴 (세로 목록, Sea of Stars) — 머리 줄 이름표에 쓸 내 포켓몬 이름. 없으면 예전 가로 한 줄 */
  vertical?: string;
  /** 위 정보줄 자리 (좁고 낮은 패널) — 다음 포켓몬 고르기를 무대 위 세로 목록으로 */
  bar?: boolean;
  /** 원 옆 키 칸이 자리가 없어 숨었을 때 메뉴 줄 안내 — 막기 · 반격 (BattleLayer ringHint) */
  hint?: '막기' | '반격' | null;
}

/** ← · Esc — 기력의조각에서 고르던 포켓몬 목록은 아이템으로, 나머지는 처음 메뉴로 */
const backOf = (page: MenuPage): MenuPage => (page === 'revive' ? 'items' : 'main');

/** 목록 고르기 키 — Enter (키보드로 간 버튼에 포커스가 있으면 그 버튼이 받음) · Space (#117 — 전투의 Space 는 main.ts 가 버튼 누름을 막고 포커스를 빼서 버튼과 상관없음 · 목록이 보인 지 1초 뒤부터) */
const enterOrSpace = (e: KeyboardEvent, shownAt: number) => (e.key === 'Enter' ? !onKeyboardButton(e) : confirmKey(e, shownAt));

/** 볼 잡기 어려움 칸 (orders #23) — 글 + 색 + 테두리 모양 (쉬움 실선 · 보통 끊긴 선 · 어려움 점선 — 잡기 원과 같은 말, 색 하나에만 맡기지 않음) */
function Tier({ tier }: { tier: MenuItem['tier'] }) {
  // 올리면 무엇의 단계인지 ("보통" 이 볼 등급으로 · "어려움" 이 타이밍으로 읽힐 수 있어서 — UX 리뷰어)
  return tier ? (
    <span class={`pg-tier pg-tier-${tier}`} title={`잡기 ${TIER_WORD[tier]} — 지금 던지면 잡기 쉬운 정도 (HP 를 더 깎거나 좋은 볼이면 쉬워져요)`}>
      {TIER_WORD[tier]}
    </span>
  ) : null;
}

/** 좁은 아이템 목록의 탭 (ideas #148) — 볼 · 회복 (상처약 · 상태 회복 · 기력의조각) */
type ItemTab = 'ball' | 'heal';
const ITEM_TABS: readonly ItemTab[] = ['ball', 'heal'];
const tabOf = (i: MenuItem | undefined): ItemTab | null => (!i || 'back' in i.go ? null : i.ball ? 'ball' : 'heal');

export function BattleMenu({ battle: b, save, onInput, lead, compact = false, vertical, bar = false, hint = null }: BattleMenuProps) {
  const [page, setPage] = useState<MenuPage>('main');
  // 차례가 끝나면 처음 메뉴로
  useEffect(() => {
    if (b.phase !== 'choose') setPage('main');
  }, [b.phase]);

  const items = menuItems(b, save, page, compact);
  const foeWarn = battleFoeUltWarn(b);
  const [win, setWin] = useState(() => `${window.innerWidth}x${window.innerHeight}`);
  useEffect(() => {
    const on = () => setWin(`${window.innerWidth}x${window.innerHeight}`);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const fitKey = `${page}|${b.phase}|${vertical === undefined ? 'h' : 'v'}|${compact}|${bar}|${win}|${items.map((i) => `${i.key}${i.enabled ? 1 : 0}${i.tier ?? ''}${i.warn ?? ''}`).join(',')}`;
  const fitRef = useRef({ key: '', n: 0 });
  if (fitRef.current.key !== fitKey) fitRef.current = { key: fitKey, n: 0 };
  const fit = fitRef.current.n;
  const [, refit] = useState(0);
  // 줄 내용이 바뀌고 0.4초 뒤 · 글꼴이 들어온 뒤 0 부터 한 번 더 — 줄이기는 늘기만 해서 불러오는 순간 잠깐 넘친 단계가 남던 것 (UX 리뷰어 #23 4차)
  useEffect(() => {
    const again = () => {
      fitRef.current.n = 0;
      refit((v) => v + 1);
    };
    const id = setTimeout(again, 400);
    return () => clearTimeout(id);
  }, [fitKey]);
  useEffect(() => {
    let alive = true;
    void document.fonts?.ready.then(() => {
      if (!alive) return;
      fitRef.current.n = 0;
      setMainTiny(false);
      refit((v) => v + 1);
    });
    return () => {
      alive = false;
    };
  }, []);
  const rowLayer = useRef<HTMLSpanElement>(null);
  // 처음 메뉴 줄 (가로) 도 넘치면 한 단계 — 번호 없는 짧은 낱말 (240 의 그것). 줄이기 단계는 아래 줄만 재서, 300 ~ 320 · 맥 글자에서 "1 …" "4 아…" 로 다섯 버튼이 다 잘리던 것 (UX 리뷰어 1px 훑기 — U4)
  //   폭이 바뀌거나 글꼴이 들어오면 다시 잼 (fitKey 의 win · fonts.ready)
  const mainLayer = useRef<HTMLSpanElement>(null);
  const [mainTiny, setMainTiny] = useState(false);
  useEffect(() => setMainTiny(false), [win, compact]);
  const lastBalls = b.phase === 'last' ? BALLS.filter((ball) => itemLeft(b, save, ball) > 0) : [];
  const sameTier = lastBalls.length > 1 && lastBalls.every((ball) => ballTier(b, ball) === ballTier(b, lastBalls[0]!));
  const fitSteps = b.phase === 'last' ? (sameTier ? FIT_LAST_SAME : FIT_LAST) : vertical !== undefined ? FIT_SIDE : FIT_ROW;
  const steps = fitSteps.slice(0, fit);
  const fitList = page !== 'main' && b.phase !== 'last' && b.phase !== 'catch' && steps.includes('list');
  useLayoutEffect(() => {
    const el = rowLayer.current;
    if (!el || el.clientWidth === 0 || fitRef.current.n >= fitSteps.length || fitList) return;
    // 잘림 = 버튼 글이 넘침 (줄임표 — 내용 실제 너비로) · 줄이 판 밖으로 · 옆 메뉴가 패널 아래로
    const over =
      el.scrollWidth > el.clientWidth ||
      [...el.querySelectorAll<HTMLElement>('.pg-button')].some(textOver) ||
      (vertical !== undefined && el.getBoundingClientRect().bottom > window.innerHeight - 1);
    if (over) {
      fitRef.current.n += 1;
      refit((v) => v + 1);
    }
  });
  // Z 옆 "다 참" 칩 (#82) — 패널 오른쪽 끝을 넘으면 뺌 (맥 글자 1.1 · 메뉴 줄이 가운데라 넘는 폭이 줄이기 단계마다 달라 손으로 고른 경계 대신 잼 — U4) · 폭이 바뀌면 다시 잼
  const fullChip = useRef<HTMLSpanElement>(null);
  const [fullOff, setFullOff] = useState(false);
  useEffect(() => setFullOff(false), [win, compact]);
  useLayoutEffect(() => {
    const el = fullChip.current;
    if (!el || fullOff) return;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.left + r.width * 1.1 > document.documentElement.clientWidth - 1) setFullOff(true);
  });
  useLayoutEffect(() => {
    const el = mainLayer.current;
    if (!el || mainTiny || compact === 'tiny' || vertical !== undefined || el.clientWidth === 0) return;
    if ([...el.querySelectorAll<HTMLElement>('.pg-button')].some(textOver)) setMainTiny(true);
  });
  // 커서 (Sea of Stars 1f — 고를 줄이 늘 보임: ▸ + 밝은 줄, 아트 디렉터) · ↑ ↓ 로 옮기고 Enter 로 고름 · 페이지 · 차례가 바뀌면 첫 줄로
  const [cursor, setCursor] = useState(0);
  // 아이템 탭 (좁고 낮은 목록 — ideas #148) · null = 커서가 있는 묶음을 따라감
  const [itemTab, setItemTab] = useState<ItemTab | null>(null);
  // 목록이 스크롤되면 (좁고 낮은 패널) 커서 줄이 보이게
  useLayoutEffect(() => {
    rowLayer.current?.querySelector<HTMLElement>('.pg-pick-scroll .pg-on')?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);
  // 볼을 놓친 뒤 다음 차례는 커서를 "4 아이템" (볼이 있는 줄) 에 — 바로 Enter 로 다시 던지게 (ideas #131, 2026-10-21). 지난 차례의 볼 수를 기억해 비교
  // 그리기 전에 옮김 (useEffect 면 "▸1 공격" 이 한 장면 보였다가 아이템으로 튐 — UX 리뷰어)
  const triesSeen = useRef(catchTriesUsed(b));
  // 커서를 ↑ ↓ 로 옮겼는지 — 안 옮겼으면 Enter = 지난번 행동 다시 (ideas #22), 옮겼으면 그 줄 (볼을 놓친 차례는 처음부터 커서)
  const [moved, setMoved] = useState(false);
  useLayoutEffect(() => {
    const tries = catchTriesUsed(b);
    const missed = page === 'main' && b.phase === 'choose' && tries > triesSeen.current;
    if (b.phase === 'choose') triesSeen.current = tries;
    const itemsAt = items.findIndex((i) => i.key === 'items' && i.enabled);
    setCursor(missed && itemsAt >= 0 ? itemsAt : 0);
    setMoved(missed);
    setItemTab(null);
  }, [page, b.phase]);
  const enabledIdx = items.map((it, k) => (it.enabled ? k : -1)).filter((k) => k >= 0);
  const onIdx = enabledIdx.includes(cursor) ? cursor : (enabledIdx[0] ?? -1);
  const ultReady = canUlt(b) || ultCounterOpen(b);
  const ultCounter = ultCounterOpen(b);
  const counter = counterOpen(b);
  const picking = b.phase === 'pick';
  // 쓰러진 포켓몬이 실제로 넘어가기 전 — 이름표 ("쓰러졌다! 교체") · 마지막 기회 칸은 넘어질 때부터 (말 칸과 같은 박자 fx/hold koTiming —
  //   맞는 순간 바뀌어 넘어짐보다 0.7 ~ 1.8초 먼저 · 마지막 기회 "6초" 가 3초 넘게 멈춰 있던 것, UX 리뷰어 #97 큼 2)
  const reduce = save.settings.reduceMotion === true;
  const now0 = performance.now();
  const fallAt = koFallAt(b, now0, reduce);
  const falling = fallAt > now0;
  useFallWake(fallAt);
  // 필살기에 쓰러졌으면 고르기 목록도 남은 연출 뒤로 (벌러덩이 연출 끝에 넘어가서 — fx/hold fxTailLeft) · 고르기 처음 그릴 때 값만.
  //   누운 그림과 겹치는 아래 목록 (bar 아님) 만 — 위 목록은 겹치지 않아 2.15초 그대로 (4.2초 동안 고를 것이 안 보이던 것, UX 리뷰어)
  const pickWait = useRef<number | null>(null);
  if (!picking) pickWait.current = null;
  // 내 쪽 넘어짐 기다림과 같은 값 (fx/hold koTiming) — 남은 만큼 (쓰러진 때 정한 값이라, 다음 볼을 내보내는 동안 같이 쓰러진 경우 이미 지난 기다림을 또 셈 — 코드 리뷰어 #97)
  else if (pickWait.current === null) {
    const fall = koTiming(b, 'me', now0, reduce).fallAt;
    pickWait.current = fall > 0 ? Math.max(0, Math.round(fall - now0 - KO_START_LAG_MS - (reduce ? KO_SLUMP_MS : KO_FLIP_MS))) : 0;
  }
  // 고르기는 목록이 보이는 때부터 (CSS .pg-pick-list 2.3초 + 넘어짐 기다림 — 같은 값) — 그 전에 숫자를 누르면 내 포켓몬이 넘어지기 전에 다음 포켓몬이 나와
  //   쓰러짐이 0 ~ 0.24초만 보이던 것 (UX 리뷰어 6차 · 옆 메뉴는 바로 떠서 1 이 바로 먹던 것 — 옆 메뉴도 같은 때 열림) · 첫 장면부터 닫힘 (한 장면 보였다 사라지던 것, 7차)
  const [pickReady, setPickReady] = useState(b.phase !== 'pick');
  useLayoutEffect(() => {
    if (!picking) {
      setPickReady(true);
      setPickShow(0);
      return;
    }
    setPickReady(false);
    const wait = PICK_SHOW_MS + (pickWait.current ?? 0);
    setPickShow(performance.now() + wait);
    const id = setTimeout(() => setPickReady(true), wait);
    return () => clearTimeout(id);
  }, [picking]);
  const team = picking ? switchable(b, save) : [];
  // Enter 다시 (ideas #22) — 처음 메뉴 · 내 차례 · 커서를 안 옮김 · 지난번 공격 · 기술 · 막기를 지금 할 수 있을 때. 아주 좁은 메뉴 (두 글자) 는 자리가 없어 커서 그대로
  const last = b.lastMe;
  const lastName = !last ? null : last.kind === 'attack' ? '공격' : last.kind === 'guard' ? '방어' : last.kind === 'move' ? (moveOf(last.moveId)?.name.ko ?? null) : null;
  const repeatOn = compact === false && page === 'main' && b.phase === 'choose' && !moved && lastName !== null && !!last && canAct(b, save, last);
  // 미리 누른 것 (ideas #31 — 게이지가 차기 0.5초 전에 누르면 차자마자) = 눌린 칸으로
  const queued = b.queued ?? null;
  const isQueued = (i: MenuItem) =>
    queued !== null && (('action' in i.go && i.go.action.kind === queued.kind && (queued.kind !== 'move' || (i.go.action.kind === 'move' && i.go.action.moveId === queued.moveId))) || (i.key === 'skills' && queued.kind === 'move'));

  const choose = (i: MenuItem) => {
    if (!i.enabled) return;
    if ('page' in i.go) setPage(i.go.page);
    else if ('back' in i.go) setPage(backOf(page));
    else {
      onInput({ kind: 'battle', input: { kind: 'act', action: i.go.action } });
      setPage('main');
    }
  };
  const pick = (uid: string) => onInput({ kind: 'battle', input: { kind: 'pick', uid } });

  // 단축키: 숫자 = 메뉴 · 다음 포켓몬 · Z = 필살기 · ← / Esc / Backspace = 뒤로 (Space 는 main.ts — 맞받아치기 · 연타)
  //   다음 포켓몬 · 마지막 기회 볼 고르기는 Space 도 Enter 처럼 (#117 — 연타 묶음 둘째부터는 아님) · 메뉴 (고르기 · 게이지) 의 Space 는 막기 그대로
  // 듣는 건 한 번만 달고, 지금 값은 ref 로 (초당 30번 다시 그려도 다시 달지 않게)
  // 고르기 목록이 보인 때 (#117 — Space 는 1초 넘게 보인 뒤부터)
  const shownAt = useShownAt(`${b.phase}:${pickReady ? 1 : 0}:${falling ? 1 : 0}`);
  const now = useRef({ b, items, page, team, choose, pick, onInput, balls: [] as readonly BallId[], onIdx, enabledIdx, cursor, repeatOn, pickReady, falling, shownAt });
  now.current = { b, items, page, team, choose, pick, onInput, balls: BALLS.filter((ball) => itemLeft(b, save, ball) > 0), onIdx, enabledIdx, cursor, repeatOn, pickReady, falling, shownAt };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const c = now.current;
      // 한글 입력 상태면 e.key 가 'ㅋ' 이라 자판 자리 (code) 로
      if (e.code === 'KeyZ') {
        e.preventDefault();
        c.onInput({ kind: 'battle', input: { kind: 'ult' } });
        return;
      }
      if (c.b.phase === 'last') {
        // 넘어지기 전엔 칸이 안 보여 키도 안 받음 (보이지 않는 칸에서 볼이 날아가 · 안 던짐으로 끝나던 것 — 코드 리뷰어 #97)
        if (c.falling) return;
        // 숫자 = 볼 (1 ~) · 그다음 숫자 = 안 던짐 (2026-10-19 태현 님 — 숫자 패드로도) · Esc = 안 던짐 · ↑ ↓ + Enter = 커서 (다른 판과 같게 — 아트 디렉터 5차)
        const rows = c.balls.length + 1;
        const n = /^[1-9]$/.test(e.key) ? Number(e.key) : 0;
        const ball = c.balls[n - 1];
        if (ball) c.onInput({ kind: 'battle', input: { kind: 'ball', ball } });
        else if (n === rows || e.key === 'Escape') c.onInput({ kind: 'battle', input: { kind: 'no-ball' } });
        else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          setCursor((Math.min(c.cursor, rows - 1) + (e.key === 'ArrowDown' ? 1 : rows - 1)) % rows);
        } else if (enterOrSpace(e, c.shownAt)) {
          e.preventDefault();
          const at = c.balls[Math.min(c.cursor, rows - 1)];
          c.onInput({ kind: 'battle', input: at ? { kind: 'ball', ball: at } : { kind: 'no-ball' } });
        }
        return;
      }
      if (c.b.phase === 'pick') {
        // 다음 포켓몬 — 숫자 · ↑ ↓ + Enter (다른 메뉴와 같은 커서, 아트 디렉터 4차) · 목록이 보이기 전엔 안 받음
        if (!c.pickReady) return;
        const n = c.team.length;
        if (/^[1-9]$/.test(e.key)) {
          const m = c.team[Number(e.key) - 1];
          if (m) c.pick(m.uid);
        } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && n > 0) {
          e.preventDefault();
          setCursor((Math.min(c.cursor, n - 1) + (e.key === 'ArrowDown' ? 1 : n - 1)) % n);
        } else if (enterOrSpace(e, c.shownAt)) {
          const m = c.team[Math.min(c.cursor, n - 1)];
          if (m) {
            e.preventDefault();
            c.pick(m.uid);
          }
        }
        return;
      }
      if (c.b.phase === 'run') {
        // 미리 누르기 (ideas #31) — 게이지가 차는 동안 1 공격 · 2 방어 · 기술 숫자 · Enter (다시) 를 보냄, 엔진이 0.5초 안이면 기억했다가 차자마자 (너무 이르면 그냥 무시) · 3 = 기술 줄을 미리 엶
        if (/^[1-9]$/.test(e.key)) {
          const it = c.items.find((x) => x.num === Number(e.key));
          if (it && 'action' in it.go && (it.go.action.kind === 'attack' || it.go.action.kind === 'guard' || it.go.action.kind === 'move')) {
            e.preventDefault();
            c.onInput({ kind: 'battle', input: { kind: 'act', action: it.go.action } });
          } else if (it && 'page' in it.go && it.go.page === 'skills') {
            e.preventDefault();
            setPage('skills');
          }
        } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement) && c.page === 'main' && c.b.lastMe) {
          e.preventDefault();
          c.onInput({ kind: 'battle', input: { kind: 'repeat' } });
        } else if ((e.key === 'ArrowLeft' || e.key === 'Escape' || e.key === 'Backspace') && c.page !== 'main') {
          e.preventDefault();
          setPage(backOf(c.page));
        }
        return;
      }
      if (c.b.phase !== 'choose') return;
      if (e.key === 'ArrowLeft' || e.key === 'Escape' || e.key === 'Backspace') {
        if (c.page !== 'main') {
          e.preventDefault();
          setPage(backOf(c.page));
        }
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const list = c.enabledIdx;
        if (list.length === 0) return;
        e.preventDefault();
        // 처음 ↓ 는 커서를 보이기만 (Enter 다시 칸이 사라지고 지금 줄에 ▸)
        if (c.repeatOn) setMoved(true);
        else {
          const at = Math.max(0, list.indexOf(c.onIdx));
          setCursor(list[(at + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length]!);
          setItemTab(null);
        }
        return;
      }
      // 버튼에 포커스가 있으면 Enter 는 그 버튼이 받음 (두 번 고르지 않게)
      if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        if (c.repeatOn) {
          e.preventDefault();
          c.onInput({ kind: 'battle', input: { kind: 'repeat' } });
          return;
        }
        const it = c.items[c.onIdx];
        if (it) {
          e.preventDefault();
          c.choose(it);
        }
        return;
      }
      if (/^[1-9]$/.test(e.key)) {
        const it = c.items.find((x) => x.num === Number(e.key));
        if (it) {
          e.preventDefault();
          c.choose(it);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const renderItems = (list: MenuItem[], cur = list === items) =>
    list.map((i) => (
      <Button
        key={i.key}
        extraClass={isQueued(i) ? 'pg-queued' : b.phase === 'choose' && cur && i.key === items[onIdx]?.key && !repeatOn ? 'pg-on' : undefined}
        onClick={() => choose(i)}
        disabled={!i.enabled && !isQueued(i)}
        secondary={'back' in i.go}
        title={isQueued(i) ? `${i.title ?? i.label} — 미리 눌렀어요 (게이지가 차면 바로)` : i.title}
      >
        {i.ball ? (
          <>
            {`${i.num} `}
            <Icon name={BALL_ICON[i.ball]} />
            <span class="pg-ball-word"> {i.label.replace(/^\d+\s/, '')}</span>
          </>
        ) : page === 'items' && i.key in ITEM_ICON ? (
          // 회복 물건도 번호 + 물건 아이콘 + 이름 (볼 줄은 아이콘 · 회복 줄은 이름만이라 아이콘 열이 안 맞던 것 — 아트 디렉터 밤 점검)
          <>
            {`${i.num} `}
            <Icon name={ITEM_ICON[i.key as keyof typeof ITEM_ICON]} />
            {` ${i.label.replace(/^\d+\s/, '')}`}
          </>
        ) : (
          i.label
        )}
        {/* 기술 상성 (ideas #24) — 효과가 굉장함 ▲ · 별로 ▼ · 없음 ✕ (색 + 모양) */}
        {i.mark && <span class={`pg-eff pg-eff-${i.mark}`}>{i.mark === 'up' ? '▲' : i.mark === 'down' ? '▼' : '✕'}</span>}
        {/* 방어 ▲ — 상대 필살기가 곧 · 다 참 (기획 R4 — 방어하면 피해 절반) */}
        {i.key === 'guard' && foeWarn && <span class={`pg-guard-up${foeWarn.full ? ' pg-full' : ''}`} title="상대 필살기가 곧 — 방어하면 피해 절반">▲</span>}
        {/* 못 누르는 볼 (기회를 다 씀) 은 단계 칸을 뺌 — 밝게 남아 누르고 싶게 만들던 것 */}
        {i.enabled && <Tier tier={i.tier} />}
        {/* 가로 메뉴의 기술 PP 는 뺌 (올리면 나옴 · 옆 메뉴는 "PP 10") — 480 · 600 에서 "1 몸통박치기 1…" 로 잘리던 것 */}
        {(vertical ? (i.subShort ?? i.sub) : i.mark !== undefined || i.subShort?.startsWith('PP') ? null : i.sub) && <span class="pg-sub">{vertical ? (i.subShort ?? i.sub) : i.sub}</span>}
        {i.warn && <span class="pg-sub pg-sub-warn">{i.warn}</span>}
      </Button>
    ));
  // Enter 다시 칸 (ideas #22) — 넓은 메뉴 · 옆 메뉴만 (줄인 메뉴는 커서 그대로)
  const repeatChip = repeatOn ? (
    <span class="pg-repeat" title={`Enter — 지난번 ${lastName} 다시 · ↑ ↓ 로 다른 것 고르기`}>
      <KeyCap k="Enter" /> 다시<span class="pg-repeat-what"> · {lastName}</span>
    </span>
  ) : null;
  // 미리 누른 것 (ideas #31) — 옆 메뉴는 게이지가 차는 동안 접혀 있어 칸이 안 보여서 머리 아래 한 줄 "방어 예약" (UX 리뷰어)
  const queuedName = !queued ? null : queued.kind === 'attack' ? '공격' : queued.kind === 'guard' ? '방어' : queued.kind === 'move' ? (moveOf(queued.moveId)?.name.ko ?? '기술') : null;
  // 포커스가 없으면 Space 는 편집기로 감 → 클릭 안내 (선제공격과 같은 규칙)
  const key = document.hasFocus() ? '(Space)' : '(클릭!)';

  // 처음 메뉴는 늘 깔아 두고 (안 쓸 때는 안 보이게) 그 위에 지금 줄을 얹음 — 줄이 바뀌어도 필살기 게이지 · 💥 자리가 그대로
  // 원 안내 (hint — 좁은 패널 막기 · 반격) 가 뜨면 처음 메뉴 층은 숨김 (흐린 칸 위에 글이 겹쳐 그려지던 것)
  const onMain = page === 'main' && !ultCounter && !counter && !picking && !hint && b.phase !== 'clash' && b.phase !== 'over' && b.phase !== 'catch' && b.phase !== 'last';
  const balls = BALLS.filter((ball) => itemLeft(b, save, ball) > 0);
  let row: ComponentChildren = null;
  if (ultCounter) {
    row = (
      <Button onClick={() => onInput({ kind: 'space' })} title="Space · Z">
        {compact || vertical ? `맞받아치기! ${key}` : `필살기로 맞받아치기! ${key}`}
      </Button>
    );
  } else if (counter) {
    // 막기 (패링, 2026-10-19 태현 님) — 아무 때나 누르면 너무 일러 못 막음 → "기다렸다가" 를 글로. 누르면 그 순간 Space 와 같음 (엔진이 시간으로 판정)
    row = (
      <Button onClick={() => onInput({ kind: 'space' })} title="날아오는 공격에 원이 좁혀질 때 Space · 클릭 — 막으면 피해 절반, 딱 맞으면 0">
        {`막기 — 원이 좁혀질 때 ${document.hasFocus() ? 'Space' : '클릭'}`}
      </Button>
    );
  } else if (picking && vertical === undefined) {
    // 가로 한 줄 메뉴 (좁은 패널) — 고르는 동안만 무대 위에 세로 목록: 번호 · 이름 · HP 막대 · HP (2026-10-21 태현 님 A — 칸 다섯이 "1 캐… 2 어…" 로 잘려 누구를 낼지 모르던 것).
    //   위 정보줄 메뉴면 위에서 · 무대 안 가로 줄이면 아래에 붙음 (위쪽 말 칸 "○○가 쓰러졌다! 다음 포켓몬을 골라요" 를 가리지 않게)
    row = (
      <span class={`pg-pick-list${bar ? '' : ' pg-pick-list-low'}`} style={{ '--pg-ko-wait': `${pickWait.current ?? 0}ms` }}>
        <span class="pg-pick-title">다음 포켓몬 고르기</span>
        {team.slice(0, 5).map((m, i) => (
          <Button key={m.uid} extraClass={i === Math.min(cursor, team.length - 1) ? 'pg-on' : undefined} onClick={() => pick(m.uid)} title={`${i + 1} · HP ${m.hp}/${maxHpOf(m)}`}>
            <span class="pg-pick-n">{i + 1}</span>
            <span class="pg-pick-name">{speciesOf(m.species)?.name.ko ?? m.form}</span>
            {/* HP 막대 · 숫자 색 = 전투 HP 막대 색 (초록 · 노랑 · 빨강 — ideas #147, 막대가 늘 초록이던 것) */}
            <span class={`pg-pick-hp pg-hp-${hpColor(m.hp, maxHpOf(m))}`}>
              <i style={{ width: `${Math.round((m.hp / maxHpOf(m)) * 100)}%` }} />
            </span>
            <span class={`pg-sub pg-hp-${hpColor(m.hp, maxHpOf(m))}`}>
              {m.hp}/{maxHpOf(m)}
            </span>
          </Button>
        ))}
      </span>
    );
  } else if (picking && pickReady) {
    row = (
      <>
        {team.slice(0, 5).map((m, i) => (
          <Button key={m.uid} extraClass={i === Math.min(cursor, team.length - 1) ? 'pg-on' : undefined} onClick={() => pick(m.uid)} title={`HP ${m.hp}`}>
            {`${i + 1} ${speciesOf(m.species)?.name.ko ?? m.form}`}
            <span class={`pg-sub pg-hp-${hpColor(m.hp, maxHpOf(m))}`}>HP {m.hp}/{maxHpOf(m)}</span>
          </Button>
        ))}
      </>
    );
  } else if (b.phase === 'last' && !falling) {
    // S11 마지막 기회 — 볼 고르기 (가진 것만) · 안 던짐 · 남은 시간
    row = (
      <>
        {/* 남은 초 = 제목 옆 "3초" (따로 한 줄에 "3" 만 있으면 "3 안 던짐" 과 헷갈림 — 2026-10-19 전체 점검) */}
        {/* 좁은 패널 (300px 아래) 은 "마지막 기회!" 를 빼고 "6초" 만 — 볼 칸이 "1 몬스…" 로 잘리던 것 (UX 리뷰어 2026-10-21) */}
        <span class="pg-last-tag">
          <span class="pg-last-word">마지막 기회! </span>
          <span class="pg-last-short">기회 </span>

          <span class="pg-last-sec" title="안 고르면 그냥 지나가요">
            {/* 자동 전투 (이로치 아님) 는 3초 — 엔진과 같은 lastChanceLimitMs (UX 리뷰어: 6초로 세다 4초에서 끝나던 것) */}
            {Math.max(0, Math.ceil((lastChanceLimitMs(b, save.settings.autoBattle) - b.lastMs) / 1000))}초
          </span>
          {/* 300px 아래 — 볼마다의 잡기 어려움 칸은 빼고 고른 볼의 것 하나만 여기 (orders #23 · 칸 셋이 "1 ◓…" 로 잘리던 것) */}
          {/* 자리는 늘 같은 폭 (안 던짐 · 단계가 바뀌어도 볼 줄이 옆으로 튀지 않게 — 마우스 밑 버튼이 바뀌어 다른 볼이 날아가던 것, UX 리뷰어 2차) */}
          <span class="pg-last-tier">{cursor < balls.length && balls[cursor] && <Tier tier={ballTier(b, balls[cursor])} />}</span>
        </span>
        {balls.map((ball, i) => (
          <Button
            key={ball}
            extraClass={i === Math.min(cursor, balls.length) ? 'pg-on' : undefined}
            onClick={() => onInput({ kind: 'battle', input: { kind: 'ball', ball } })}
            // 올리면 커서도 그 볼로 — 좁은 패널은 커서 볼의 잡기 칸만 보여서 (마우스로 하는 사람이 다른 볼 단계를 못 보던 것)
            onMouseEnter={() => setCursor(i)}
            title={`${i + 1} · ${itemName(ball)} ${itemLeft(b, save, ball)}개${ballTier(b, ball) ? ` · 잡기 ${TIER_WORD[ballTier(b, ball)!]}` : ''} — 쓰러진 포켓몬이라 잡을 확률 절반 (단계에 이미 들어 있음)`}
          >
            {/* 볼 그림 + 개수 — 좁은 패널 (360px 아래) 은 이름을 빼서 "1 ◓ 3개" (이름 · 개수가 잘리던 것) */}
            {`${i + 1} `}
            <Icon name={BALL_ICON[ball]} />
            <span class="pg-ball-word"> {itemName(ball)}</span>
            <Tier tier={ballTier(b, ball)} />
            <span class="pg-sub">{itemLeft(b, save, ball)}개</span>
          </Button>
        ))}
        <Button extraClass={Math.min(cursor, balls.length) === balls.length ? 'pg-on' : undefined} onClick={() => onInput({ kind: 'battle', input: { kind: 'no-ball' } })} onMouseEnter={() => setCursor(balls.length)} title={`${balls.length + 1} · Esc`}>
          {`${balls.length + 1} 안 던짐`}
        </Button>
      </>
    );
  } else if (b.phase === 'catch' && b.catch) {
    // S11 타이밍 원 — 원이 딱 맞을 때 Space (클릭도 됨)
    // 던진 뒤 = 지금 장면 한 줄 (2026-10-20 — 누른 때 = 던짐)
    const stage = catchView(b)?.stage;
    // 잡기 쉬움 글 (원 색 · 선 모양과 같은 뜻 — ideas #128) · "어려움" 만 쓰면 타이밍이 어렵다로 읽혀서 "잡기 어려움" (UX 리뷰어 2026-10-21) · 옆 메뉴는 버튼 아래 한 줄
    const tone = catchTone(b);
    row =
      stage === 'ring' ? (
        <>
          <Button onClick={() => onInput({ kind: 'space' })} title="원이 안쪽 원에 딱 맞을 때">
            {/* 옆 메뉴는 칸이 좁아 짧게 (×3 패널에서 "원이 딱 맞을 때 (…" 로 잘리던 것) */}
            {vertical ? `딱 맞을 때 ${document.hasFocus() ? 'Space' : '클릭'}` : `원이 딱 맞을 때 ${key}`}
          </Button>
          <span class={`pg-catch-tone pg-catch-tone-${tone}`} title="그냥 던졌을 때 잡기 쉬운 정도 — HP 를 더 깎거나 좋은 볼이면 쉬워져요">
            잡기 {TONE_WORD[tone]}
          </span>
        </>
      ) : (
        <span class="pg-dim">{stage === 'shake' ? '흔들… 흔들…' : stage === 'end' ? (b.catch.caught ? '딸깍!' : '앗!') : '던졌다!'}</span>
      );
  } else if (page !== 'main' && ((vertical === undefined && compact) || fitList) && b.phase !== 'clash' && b.phase !== 'over') {
    // 좁은 가로 메뉴 (compact) 의 기술 · 아이템 · 교체 줄 = 무대 위 세로 목록 (다음 포켓몬 고르기 #75 와 같은 판, 바로 뜸) — 한 줄 다섯 칸이 "1 몸…" 으로 잘리던 것 (U4, 픽셀 검사원 2026-10-21)
    // 낮은 패널 — 줄이 안 들어가면 두 칸 (400 이상) · 좁으면 목록 안 스크롤 (150 에서 일곱이면 6 · 7 번이 패널 밖이던 것 — UX 리뷰어 #23 3차)
    const listN = items.filter((i) => !('back' in i.go)).length;
    const rowsFit = Math.max(3, Math.floor((window.innerHeight - 20 - LIST_HEAD_PX - 8) / LIST_ROW_PX));
    // 아이템이 줄보다 많으면 [볼] [회복] 탭 (ideas #148 — 150 에서 일곱이면 6 · 7 번이 스크롤 아래로 숨던 것) · 번호는 그대로 (숫자 키 · 손에 익은 번호) · ↑ ↓ 로 다른 묶음에 가면 탭도 따라감
    const tabs = page === 'items' && listN > rowsFit && items.some((i) => tabOf(i) === 'ball') && items.some((i) => tabOf(i) === 'heal');
    const tabOn = tabs ? (itemTab ?? tabOf(items[onIdx]) ?? 'ball') : null;
    const shown = items.filter((i) => !('back' in i.go) && (tabOn === null || tabOf(i) === tabOn));
    const many = shown.length > rowsFit;
    // 탭을 누르면 그 묶음 첫 쓸 수 있는 줄로 · 쓸 줄이 없으면 (HP 가득 — 회복 넷 모두 못 누름) 뒤로 칩으로 (커서가 숨은 몬스터볼에 남아 Enter 가 볼을 던지던 것)
    //   누른 탭의 포커스는 풂 (남으면 다음 Enter · Space 가 탭을 다시 눌러 고른 줄을 못 쓰던 것 — UX 리뷰어)
    const pickTab = (t: ItemTab) => {
      setItemTab(t);
      const k = items.findIndex((i) => tabOf(i) === t && i.enabled);
      setCursor(k >= 0 ? k : items.findIndex((i) => 'back' in i.go));
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    };
    // 줄이 안 들어가면 한 칸 스크롤 (두 칸이면 넓어져 볼 던질 상대 · 옆 메뉴 탭을 덮던 것 — UX 리뷰어 #23 5차)
    const listCls = `pg-pick-list pg-pick-now${bar ? '' : ' pg-pick-list-low'}${fitList && !compact ? ' pg-pick-left' : ''}${many ? ' pg-pick-scroll' : ''}${tabOn ? ' pg-pick-tabs' : ''}`;
    // 스크롤 끝이면 pg-scroll-end ("▼ 더" 숨김) — 처음 · 커서로 내릴 때 · 휠
    const markEnd = (el: HTMLElement | null): void => {
      el?.classList.toggle('pg-scroll-end', el.scrollTop + el.clientHeight >= el.scrollHeight - 1);
    };
    row = (
      <span class={listCls} ref={(el) => {
        markEnd(el);
      }} onScroll={(e) => markEnd(e.currentTarget as HTMLElement)}>
        <span class="pg-pick-title">
          {/* 탭이면 제목 자리에 탭 둘 (탭 이름이 무엇의 목록인지 말함 — 240 에서 제목 · 탭 · HP · 뒤로가 한 줄에 안 들어가서) */}
          {tabOn
            ? ITEM_TABS.map((t) => (
                <Button key={t} secondary extraClass={`pg-pick-tab${t === tabOn ? ' pg-on' : ''}`} onClick={() => pickTab(t)} title={t === 'ball' ? '볼 — 몬스터볼 · 슈퍼볼 · 하이퍼볼' : '회복 — 상처약 · 상태 회복 · 기력의조각'}>
                  {t === 'ball' ? '볼' : '회복'}
                </Button>
              ))
            : page === 'skills'
              ? '기술'
              : page === 'items'
                ? '아이템'
                : page === 'revive'
                  ? '살릴 포켓몬'
                  : '교체 · 도망'}
          {/* 내 쪽 위 목록이면 내 HP 칸 대신 여기 (목록이 HP 칸을 반쯤 덮어 "15/21" 이 "5/21" 로 보이던 것 — UX 리뷰어 #23 4차) */}
          {/* 무대 위 목록이면 늘 (목록이 내 HP 칸을 덮어 상처약을 고를 때 HP 가 안 보이던 것 — 내 HP 칸은 숨김, UX 리뷰어 #23 5차) */}
          <span class="pg-pick-myhp">
            HP {b.me.hp}/{b.me.maxHp}
          </span>
          {items
            .filter((i) => 'back' in i.go)
            .map((i) => (
              // 커서가 뒤로 칸에 오면 이 칩이 고른 모양 (↓ 로 오면 커서가 어디에도 안 보이던 것)
              <Button key={i.key} secondary extraClass={`pg-pick-back${i.key === items[onIdx]?.key ? ' pg-on' : ''}`} onClick={() => choose(i)} title={i.title}>
                <KeyCap k="Esc" /> 뒤로
              </Button>
            ))}
        </span>
        {shown.map((i) => (
          <Button key={i.key} extraClass={isQueued(i) ? 'pg-queued' : i.key === items[onIdx]?.key ? 'pg-on' : undefined} onClick={() => choose(i)} disabled={!i.enabled && !isQueued(i)} title={i.title}>
            {
              <>
                <span class="pg-pick-n">{i.num}</span>
                <span class="pg-pick-name">{i.label.replace(/^\d+\s/, '')}</span>
                {i.mark && <span class={`pg-eff pg-eff-${i.mark}`}>{i.mark === 'up' ? '▲' : i.mark === 'down' ? '▼' : '✕'}</span>}
                {i.enabled && <Tier tier={i.tier} />}
                {i.sub && <span class="pg-sub">{i.sub}</span>}
                {i.warn && <span class="pg-sub pg-sub-warn">{i.warn}</span>}
              </>
            }
          </Button>
        ))}
      </span>
    );
  } else if (hint) {
    // 원 옆 키 칸이 안 들어가는 좁은 패널 — 원이 뜬 동안 메뉴 줄이 키를 말함 (잡기 원 "원이 딱 맞을 때 (Space)" 와 같은 자리)
    row = <span class="pg-ring-hint">{`${hint} — 원이 좁혀질 때 ${document.hasFocus() ? 'Space' : '클릭'}`}</span>;
  } else if (page !== 'main' && b.phase !== 'clash' && b.phase !== 'over') {
    // 옆 메뉴에서 아이템이 다섯 넘으면 "← 뒤로" 줄은 뺌 (Esc · ← 그대로) — 다섯 줄 한 칸에 들어가게 (두 칸이 되며 볼 칸이 "1 ◓…" 로 잘리던 것, orders #23 UX 리뷰어)
    row = renderItems(vertical !== undefined && page === 'items' && items.filter((i) => !('back' in i.go)).length > 5 ? items.filter((i) => !('back' in i.go)) : items, true);
  }

  // 옆 메뉴에서 다음 포켓몬 · 마지막 기회 · 잡기 원은 처음 메뉴 층을 아예 빼서 판이 줄 수 · 글 길이만큼 (5줄 높이에 한 줄이 떠 있고 "원이 딱 맞을 때 (…" 로 잘리던 것)
  const gone = vertical !== undefined && (picking || b.phase === 'last' || b.phase === 'catch' || fitList);
  const fitCls = steps.map((s) => ` pg-fit-${s}`).join('');
  const stack = (
    <span class={`pg-bmenu-items pg-stack${fitCls}`}>
      <span ref={mainLayer} class={onMain ? 'pg-layer' : gone ? 'pg-layer pg-hidden pg-gone' : 'pg-layer pg-hidden'} aria-hidden={!onMain}>
        {renderItems(page === 'main' && !mainTiny ? items : menuItems(b, save, 'main', mainTiny ? 'tiny' : compact), page === 'main')}
      </span>
      {row && (
        <span ref={rowLayer} class={counter || ultCounter ? 'pg-layer pg-counter' : 'pg-layer'}>
          {row}
        </span>
      )}
    </span>
  );
  // 필살기 Z 배지 (2026-10-19 태현 님 "Z 가 잘 안 보여 · 눈에 확 보였으면 · 다 차면 반짝반짝") — 18px 키 모양 칸 안이 게이지만큼 주황으로 차오름,
  // 다 차면 금색 채움 + 한 번 톡 커짐 + 빛 줄기 + 반짝 별 셋 (game.css .pg-ultz). 게이지 막대 대신 이 칸 하나
  const ultPct = Math.round(b.me.ult * 100);
  // 다 찬 필살기 누를 틈 (기획 R2 — 자동 전투 · 볼 때 3초 [임시값] 뒤 저절로) — Z 모서리 숫자 3 · 2 · 1 = 남은 초 (엔진 battleAutoUltLeft) · 실제로 나갈 때까지 1 을 남김.
  //   16 × 2px 막대는 알아채기 어렵고 끝난 뒤에도 안 나가 보였던 것 (UX · 픽셀) · 기다리는 동안 Z 는 다 참 모양 그대로 (연출 사이마다 다시 톡 커지던 것)
  const autoLeft = battleAutoUltLeft(b, save.settings.autoBattle === true);
  // 세는 때 = Z 를 쓸 수 있을 때 (엔진도 그때만 셈) · 내 행동 연출 중 = 멈춤 (점선 칩) · 마지막 기회 · 결과 같은 그 밖은 칩 · 다 참 모양 없음 (못 나가는데 "3" 이 5초 넘게 남던 것 — UX 리뷰어 2차)
  const autoPaused = autoLeft !== null && !ultReady && b.phase === 'anim' && b.anim?.side === 'me';
  const autoSec = autoLeft === null || (!ultReady && !autoPaused) ? null : Math.max(1, Math.ceil(autoLeft / 1000));
  // 예약 없음 (태현 님 #88 — 10-22 "필살기 예약 이라는건 없애자"): 쓸 수 없을 때 누른 Z 는 엔진이 버리고 까닭 도장 (b.ultDeny, 1초) → 칩 한 줄 (말없이 먹지 않게 U5).
  //   그래서 Z 는 늘 누를 수 있음 (꺼진 버튼이면 클릭이 엔진까지 안 가 알림이 없음) · 자동 셈이 멈춘 동안 (내 연출 중) 은 다 찬 모양으로 두지 않음 (누르면 버려지니)
  const zReady = ultReady || (autoSec !== null && !autoPaused);
  // 버린 Z 는 Z 를 흐리게 (까닭 한 줄은 내 포켓몬 발밑 — BattleLayer UltDeny) · 그 1초 안에 쓸 수 있게 되면 흐림을 거둠
  const deny = b.ultDeny ?? null;
  const denyGo = deny !== null && ultReady;
  // 숫자 칩은 Z 밖 형제 (Z 안 첫 자식이면 Z 의 칠 · 빛 줄기 · 반짝 밑에 깔리고 · Z 톡 커짐에 같이 ×1.7 로 커지던 것 — 픽셀 검사원 2차) · Z 오른쪽 옆
  const ultBadge = (
    <span class="pg-ultz-wrap">
    <button
      type="button"
      class={`${zReady ? 'pg-ultz pg-ultz-ready' : 'pg-ultz'}${autoSec !== null ? ' pg-ultz-auto' : ''}${fullOff && b.me.ult >= 1 ? ' pg-ultz-fullline' : ''}${deny && !denyGo ? ' pg-ultz-denied' : ''}`}
      aria-disabled={!zReady}
      onClick={() => onInput({ kind: 'battle', input: { kind: 'ult' } })}
      title={
        autoSec !== null && !autoPaused
          ? `필살기 (Z) — ${autoSec}초 뒤 저절로 · 지금 Z 로 바로`
          : ultReady
            ? '필살기 (Z) — 지금 쓸 수 있어요 · 아무 때나 · 상대 기술에 끼어들기'
            : b.me.ult >= 1
              ? '필살기 다 참 — 지금 연출이 끝나면 Z'
              : `필살기 게이지 ${ultPct}% — 때리면 · 맞으면 참 (Z)`
      }
    >
      <span class="pg-ultz-fill" style={{ height: `${zReady ? 100 : ultPct}%` }} />
      <span class="pg-ultz-key">Z</span>
      {zReady && (
        <>
          <span class="pg-ultz-shine" />
          <span class="pg-ultz-spark pg-ultz-s1">
            <Icon name="twinkle" />
          </span>
          <span class="pg-ultz-spark pg-ultz-s2">
            <Icon name="twinkle" />
          </span>
          <span class="pg-ultz-spark pg-ultz-s3">
            <Icon name="twinkle" />
          </span>
        </>
      )}
    </button>
      {/* "3초" — 칠 없는 금 테두리 (키 칩 [1] [2] 과 다른 모양 — 같은 금 칠 숫자면 "누를 키" 로 읽히던 것, UX 리뷰어 2차) */}
      {/* 필살기는 눌러야만 나감 (태현 님 #82) — 다 차면 "다 참" (3 · 2 · 1 남은 초 대신 · 다 찬 것을 알아채게 U1 · U5) */}
      {autoSec !== null ? (
        <span class={`pg-ultz-count${autoPaused ? ' pg-paused' : ''}`}>{autoSec}초</span>
      ) : (
        b.me.ult >= 1 &&
        !fullOff && (
          // 게이지가 차 있는 동안 늘 (내 기술 연출 중엔 흐리게 — 연출마다 칩이 빠져 자동 전투면 차례마다 깜빡이던 것, UX 리뷰어 #82)
          <span ref={fullChip} class={`pg-ultz-count pg-ultz-full${ultReady ? '' : ' pg-paused'}`}>
            다 참
          </span>
        )
      )}
    </span>
  );

  // 자동 전투면 메뉴 줄을 접고 필살기 Z (+ 자동 버튼) 만 (ideas #25 — 맡겨 둔 동안 고를 칸이 줄줄이 보이지 않게) · 볼 · 마지막 기회 · 막기 같은 줄은 그대로
  const collapse = save.settings.autoBattle === true && onMain;

  // 옆 메뉴 (Sea of Stars): 판 위로 튀어나온 탭 줄 = 금색 이름표 (왼쪽) · 필살기 게이지 + Z (오른쪽), 그 아래 판에 세로 목록 (5줄 넘으면 옆 칸).
  // 고를 수 없는 동안 (상대 차례 · 연출 · 힘대결 · 끝) 은 판을 접고 탭 줄만 — 싸우는 그림을 가리지 않게 (아트 디렉터)
  if (vertical) {
    const open = !collapse && (b.phase === 'choose' || row !== null) && !fitList;
    // 남은 볼 기회 (야생 · 한 번 놓친 뒤) = 이름표에 한 번 "마지막 볼!" · "볼 기회 2" — 볼마다 붙으면 130px 칸에서 "· 마지…" 로 잘리던 것 (UX 리뷰어 2차)
    const triesWarn = page === 'items' && !fitList ? items.find((i) => i.warn)?.warn : undefined;
    //   글은 짧게 "마지막!" · "기회 2" (옆 칸이 약 100px 라 "←" 탭과 같이 서면 "마…" 로 잘리던 것 — 뜻은 title "볼 기회")
    const tabWarn = triesWarn ? (triesWarn.includes('마지막') ? '마지막!' : triesWarn.replace(' · ', '')) : null;
    return (
      <div class={`pg-vmenu${b.phase === 'choose' ? ' pg-my-turn' : ''}`}>
        <div class="pg-vmenu-tabs">
          {/* 고르는 동안 이름표 = "쓰러졌다! 교체" (쓰러진 포켓몬 이름이 남아 있던 것 · 말 칸이 숨는 150 넓은 패널에서 쓰러졌다는 글이 0ms 이던 것, UX 리뷰어 2026-10-21) */}
          <span class={`pg-vmenu-name${tabWarn && !picking ? ' pg-vmenu-name-warn' : ''}`} title={tabWarn && !picking ? `${vertical} — 이 포켓몬에게 볼을 던질 기회${triesWarn?.includes('마지막') ? ' 마지막 한 번' : triesWarn}` : undefined}>
            {picking && !falling ? '쓰러졌다! 교체' : (tabWarn ?? vertical)}
          </span>
          {page === 'items' && items.filter((i) => !('back' in i.go)).length > 5 && !fitList && (
            <button type="button" class={`pg-vmenu-back${items[onIdx] && 'back' in items[onIdx].go ? ' pg-on' : ''}`} onClick={() => setPage(backOf(page))} title="뒤로 (Esc · ←)">
              ←
            </button>
          )}
          <span class="pg-vmenu-ult">{ultBadge}</span>
        </div>
        {(open || lead || (queuedName && !collapse)) && (
          <div class="pg-vmenu-box">
            {lead && <div class="pg-vmenu-lead">{lead}</div>}
            {open && stack}
            {open && repeatChip && <div class="pg-vmenu-repeat">{repeatChip}</div>}
            {!open && queuedName && !collapse && (
              <div class="pg-vmenu-repeat">
                <span class="pg-repeat pg-queued-line" title="게이지가 차면 바로 나가요">
                  {queuedName} 예약
                </span>
              </div>
            )}
          </div>
        )}
        {fitList && stack}
      </div>
    );
  }

  return (
    <span class={`pg-bmenu${b.phase === 'choose' ? ' pg-my-turn' : ''}${compact ? ' pg-compact' : ''}`}>
      {/* 좁은 패널에서 기술 · 아이템을 고르는 동안은 앞 버튼 (자동 전투) 을 빼서 이름 자리를 넓힘 */}
      {compact && page !== 'main' ? null : lead}
      {collapse ? null : stack}
      {collapse ? null : repeatChip}
      {ultBadge}
    </span>
  );
}
