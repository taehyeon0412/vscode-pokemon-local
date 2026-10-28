/**
 * S04 스타팅 선택 (gdd S04 · 4.2) — ① 스타팅 줄 (19마리 — 피카츄는 끝 · #128, 클릭 · ← →) · ② 진화 단계 (1 → 2 → 3) · ④ 처음 기술 2개 (후보 4개, 숫자 1 ~ 4) · ③ 결정 (Enter) → 숲 1-1.
 * Esc = S03 로. 임시 디자인 — 단계 12 에서 다시.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { BALANCE } from '../../../core/balance';
import { typeNameKo } from '../../../core/text';
import { speciesOf } from '../../../data';
import { Button } from '../../../ui/Button';
import { confirmKey, onKeyboardButton, useShownAt } from '../../../ui/confirm-key';
import { KeyCap } from '../../../ui/KeyCap';
import { InfoBar } from '../../../ui/InfoBar';
import { contentWidth, FIT_ROOM } from '../../../ui/useFit';
import { TypeTags } from '../../battle/components/TypeTag';
import { Sprite } from '../../../ui/Sprite';
import { moveView } from '../../result/model';
import { chainArtWidth, chainGroundPad, chipPx, defaultStarterMoves, evolutionChain, PICK_COLUMN_PX, pickLayout, starterList, starterMoveCandidates } from '../model';
import { INFO_BAR_PX } from '../../../ui/layout';

export interface StarterPickProps {
  media: string;
  pending: boolean;
  onBack(): void;
  onDone(dex: number, moves: number[]): void;
}

export function StarterPick({ media, pending, onBack, onDone }: StarterPickProps) {
  // 진화 단계 그림은 원본 ×1 (개구마르 계열처럼 32 · 64 가 섞임 — mvp-spec 1장 · 줄이면 점이 빠져 뭉개짐, 아트 디렉터 2026-10-19)
  const list = starterList();
  const [index, setIndex] = useState(0);
  const sel = list[index] ?? list[0]!;
  const [picked, setPicked] = useState<number[]>(() => defaultStarterMoves(sel.dex).map((m) => m.id));
  // 다른 스타팅을 고르면 기본 2개로 — 그리기 전에 (✓ 없는 첫 그림이 한 번 보이고, 그 폭으로 칩 줄 · 탭을 재던 것 — UX 2바퀴)
  useLayoutEffect(() => setPicked(defaultStarterMoves(sel.dex).map((m) => m.id)), [sel.dex]);
  // 자기 타입 기술은 "×1.5" (같은 타입 1.5배 — 처음 하는 사람이 위력 숫자만 보고 고르지 않게, ★ 은 다른 화면에서 새 기술 · 등급이라 바꿈 2026-10-20)
  const ownTypes = speciesOf(sel.dex)?.types ?? [];
  const cands = starterMoveCandidates(sel.dex).map((m) => ({ ...moveView(m.id), own: ownTypes.includes(m.type), power: m.power }));
  const chain = evolutionChain(sel.dex);
  const selTypes = speciesOf(sel.dex)?.types ?? [];
  const types = selTypes.map(typeNameKo).join(' · ');
  // 크기 단계 (칩 · 진화 배율 — 들어가는 가장 큰 것) · 칩 줄 위 · 줄 사이 (태현 님 "높으면 위 빈 공간을 써서 목록 · 진화를 크게") — starter/model pickLayout
  // 정보줄 높이 = 20 × 글자 배율 (--pg-ui, main.ts) + 아래 선 1 · 폭 = 패널 − 좌우 8, 넓어도 가운데 720 칸 (정보줄 · 진화 줄과 같은 칸)
  const ui = parseFloat(document.getElementById('pokemon-game')?.style.getPropertyValue('--pg-ui') ?? '') || 1;
  const barPx = Math.round(INFO_BAR_PX * ui) + 1;
  const lay = pickLayout(window.innerHeight - barPx, Math.min(window.innerWidth - 16, PICK_COLUMN_PX), list.length, chain.map((c) => c.form));
  const zoom = lay.chainZoom;
  const rowPx = lay.rowPx;
  // 바닥 (가장 오래 보이는 장면의 발끝) 을 한 줄로 — 그 아래 여유 (브리가론처럼 바닥보다 내려가는 장면)
  const groundPad = chainGroundPad(chain.map((c) => c.form), zoom);
  const chipCrop = 22 * lay.chipZoom;
  const ready = picked.length === BALANCE.starterMoves && !pending;
  // 넘치면 한 단계 (U4 — 맥 여유 1.1 · 폭 경계를 손으로 고르지 않음, #128 픽셀 큼 · 예전부터)
  //   정보줄: 1 제목 짧게 · 2 [←] (뒤로 글 뺌 · title Esc — 이름은 오래 남김, U5) · 3 바뀌어 뜨는 숲 안내 뺌 ("첫 포켓몬" 은 남김 — 숲 안내는 제목 title) · 4 제목 뺌
  //     — 240 에서 [← 뒤로] 가 통째로 가려지고 맥에서 [Enter 결정] 이 "er" 만 보이던 것 · 결정 버튼은 끝까지 그대로
  //   기술 줄: 1 "위력" 글 뺌 · 2 "기술 2/2" 뺌 — 맥 240 에서 첫 기술이 둘째 줄로 내려가 다 보이는 기술이 0 이던 것 (피카츄 "전기쇼크 ×1.5")
  //   칸 하나 = 테두리 · 안쪽 여백 + 글 × 1.1 (버튼은 글만 재면 여백만큼 모자라 넘침을 못 봄)
  const sumOf = (c: Element, keys: ('paddingLeft' | 'paddingRight' | 'borderLeftWidth' | 'borderRightWidth' | 'marginLeft' | 'marginRight')[]) => {
    const s = getComputedStyle(c);
    return keys.reduce((w, k) => w + (parseFloat(s[k]) || 0), 0);
  };
  const edgeOf = (c: HTMLElement) => sumOf(c, ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth', 'marginLeft', 'marginRight']);
  // 정보줄 한쪽 = 글 × 1.1 + 안 칸들의 바깥 여백 (흐린 안내 줄 margin-left 10 — Range 는 여백을 안 셈, 코드 리뷰어)
  const sideOf = (c: HTMLElement) => contentWidth(c) * FIT_ROOM + [...c.children].reduce((m, k) => m + sumOf(k, ['marginLeft', 'marginRight']), 0);
  const stripRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const chainRef = useRef<HTMLDivElement>(null);
  // 진화 줄 넘치면 한 단계 (2637 — 420 · 300px 폭 규칙이 자리가 남아도 "라이츄" 이름 · 타입을 숨기던 것, U4 폭 경계를 손으로 고르지 않음): 1 뒤 단계 이름 뺌 · 2 타입 뺌
  const [chainFit, setChainFit] = useState(0);
  const [barFit, setBarFit] = useState(0);
  const [moveFit, setMoveFit] = useState(0);
  // 다시 재기 — 이미 0 단계여도 다시 그려 재도록 (setX(0) 만으로는 안 그려져 잼이 빠지는 함정 — ui/useFit 과 같음, 코드 리뷰어)
  const [fitRun, setFitRun] = useState(0);
  const movesRef = useRef<HTMLDivElement>(null);
  // 다른 스타팅을 고르면 기술 줄은 처음부터 (피카츄에서 "위력" 이 빠진 채 다른 스타팅도 숫자만 남던 것 — 테스터 · 코드 리뷰어 · UX) · 그리기 전에
  useLayoutEffect(() => {
    setMoveFit(0);
    setChainFit(0);
  }, [sel.dex]);
  useLayoutEffect(() => {
    const bar = rootRef.current?.querySelector<HTMLElement>('.pg-infobar');
    if (bar && barFit < 4 && bar.clientWidth > 0) {
      const cs = getComputedStyle(bar);
      const sides = [...bar.children].filter((c): c is HTMLElement => c instanceof HTMLElement && c.offsetWidth > 0);
      const need = sides.reduce((w, c) => w + sideOf(c), 0) + (parseFloat(cs.columnGap) || 0) * Math.max(0, sides.length - 1);
      if (need > bar.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) + 0.5) setBarFit(barFit + 1);
    }
    const row = movesRef.current;
    const body = bodyRef.current;
    if (row && moveFit < 2 && row.clientWidth > 0) {
      // 첫 줄 = "기술 n/2" + 첫 기술 버튼 (둘째 줄로 내려가면 낮은 패널에서 다 보이는 기술이 없음)
      const kids = [...row.children].filter((c): c is HTMLElement => c instanceof HTMLElement && c.offsetWidth > 0).slice(0, 2);
      const need = kids.reduce((w, c) => w + edgeOf(c) + contentWidth(c) * FIT_ROOM, 0) + (parseFloat(getComputedStyle(row).columnGap) || 0) * Math.max(0, kids.length - 1);
      if (need > row.clientWidth + 0.5) setMoveFit(moveFit + 1);
      // 기술 줄이 둘 넘게 감겨 판 아래에서 잘리면 "위력" 을 빼 줄 수를 줄임 (2638 — 480 × 187 셋째 · 넷째 기술이 판 끝에 반쯤 걸리던 것)
      const items = [...row.children].filter((c): c is HTMLElement => c instanceof HTMLElement && c.offsetWidth > 0);
      if (moveFit === 0 && body && new Set(items.map((c) => c.offsetTop)).size > 1 && row.getBoundingClientRect().bottom > body.getBoundingClientRect().bottom + 0.5) setMoveFit(1);
    }
    // 진화 줄 — 격자 (가운데) + 오른쪽 옆 타입이 판 안쪽 폭에 드는지 (글 × 맥 여유 1.1 · 진화 줄 칸은 격자만큼만 넓어 판과 견줌)
    const crow = chainRef.current;
    if (crow && body && chainFit < 2 && crow.clientWidth > 0) {
      const bcs = getComputedStyle(body);
      const bb = body.getBoundingClientRect();
      const rr = { left: bb.left + (parseFloat(bcs.paddingLeft) || 0), right: bb.left + body.clientWidth - (parseFloat(bcs.paddingRight) || 0) };
      const grid = crow.querySelector('.pg-chain-grid')?.getBoundingClientRect();
      const tr = crow.querySelector('.pg-chain-types')?.getBoundingClientRect();
      const labels = [...crow.querySelectorAll<HTMLElement>('.pg-chain-label')].reduce((w, l) => w + l.getBoundingClientRect().width, 0);
      const room = (FIT_ROOM - 1) * (labels / 2 + (tr?.width ?? 0));
      const right = Math.max(grid?.right ?? 0, tr && tr.width > 0 ? tr.right : 0) + room;
      if (grid && (right > rr.right + 0.5 || grid.left < rr.left - 0.5)) setChainFit(chainFit + 1);
    }
  });
  useEffect(() => {
    const reset = () => {
      setBarFit(0);
      setMoveFit(0);
      setChainFit(0);
      setFitRun((n) => n + 1);
    };
    window.addEventListener('resize', reset);
    const t = window.setTimeout(reset, 400);
    void document.fonts?.ready.then(reset);
    return () => {
      window.removeEventListener('resize', reset);
      window.clearTimeout(t);
    };
  }, []);

  const toggle = (id: number) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= BALANCE.starterMoves ? [...p.slice(1), id] : [...p, id]));

  // ← → 스타팅 · 1 ~ 4 기술 · Enter 결정 · Esc 뒤로 (듣는 건 한 번만 — 지금 값은 ref)
  const shownAt = useShownAt('starter');
  const now = useRef({ list, cands, ready, sel, picked, toggle, onBack, onDone, shownAt });
  now.current = { list, cands, ready, sel, picked, toggle, onBack, onDone, shownAt };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      // 접힌 상태 (150px 아래 — app.tsx 가 고르던 화면을 hidden 으로 둠) 에서는 키를 받지 않음: 안 보이는 채 Enter 로 새 게임이 시작되던 것 (테스터)
      if (rootRef.current?.offsetParent === null) return;
      const c = now.current;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        setIndex((i) => (i + (e.key === 'ArrowLeft' ? -1 : 1) + c.list.length) % c.list.length);
      } else if (/^[1-4]$/.test(e.key) && c.cands[Number(e.key) - 1]) {
        e.preventDefault();
        c.toggle(c.cands[Number(e.key) - 1]!.id);
      } else if (e.key === 'Enter' || (e.code === 'Space' && !onKeyboardButton(e))) {
        // 버튼에 포커스가 있어도 Enter = 결정 (방금 누른 기술 버튼이 다시 눌려 빠지지 않게 — 플레이 리뷰) · Space 도 결정 (#117 — 마우스로 누른 칩 · 기술 버튼이 Space 로 또 눌려
        //   기술이 빠지던 것 막음 (테스터 · 코드 리뷰어) · Tab 으로 간 버튼은 Space 가 그 버튼 · 화면이 뜬 지 1초 안 · 연타 둘째부터는 결정 안 함)
        e.preventDefault();
        if (c.ready && confirmKey(e, c.shownAt)) c.onDone(c.sel.dex, c.picked);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        c.onBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // 칩 줄 양 끝 탭 ◀ N · N ▶ — 그쪽에 다 안 보이는 칩 수 (칩 줄 막대는 숨김: 윈도우 VS Code 막대 10px 가 진화 · 기술 줄을 밀어 150 에서 첫 기술이 잘리던 것 · #128 UX 큼,
  //   맥은 겹침 막대라 옆에 더 있다는 표시가 없던 것 · 줄 끝 피카츄가 처음 화면 밖 — UX 작음 · ideas 1644). 넘치지 않으면 (칩이 여러 줄로 감길 때 포함) 없음
  const [more, setMore] = useState<[number, number]>([0, 0]);
  // 넘칠 때 칩 줄 폭 = 칸 단위 (n 칸 × 한 칸 − 사이 · 남는 폭은 오른쪽 빈자리) + 칸에 맞춰 멈춤 (game.css scroll-snap) — 끝 탭 옆에 칩 조각이 남지 않게 (아트 디렉터)
  const [stripW, setStripW] = useState(0);
  // 판 폭 — 세로 막대가 생기면 줄어듦 (기술 ✓ 로 줄이 늘 때 등 — window resize 가 아니라 안 다시 재던 것, UX 2바퀴) · 바뀌면 칩 줄 폭 · 고른 칩 · 탭 숫자를 다시
  const [bodyW, setBodyW] = useState(0);
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setBodyW(body.clientWidth));
    ro.observe(body);
    return () => ro.disconnect();
  }, []);
  const cellOf = (el: HTMLElement) => {
    const chips = el.querySelectorAll<HTMLElement>('.pg-starter-chip');
    if (chips.length < 2) return null;
    const pitch = chips[1]!.offsetLeft - chips[0]!.offsetLeft;
    return pitch > 0 ? { pitch, gap: pitch - chips[0]!.offsetWidth } : null;
  };
  useLayoutEffect(() => {
    const el = stripRef.current;
    const body = bodyRef.current;
    if (!el || !body) return;
    const cell = cellOf(el);
    const cs = getComputedStyle(body);
    const room = body.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const w = lay.chipZoom === 1 && cell && el.scrollWidth > room + 0.5 ? Math.floor((room + cell.gap) / cell.pitch) * cell.pitch - cell.gap : 0;
    if (w !== stripW) setStripW(w);
  });
  const countMore = () => {
    const el = stripRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const chips = [...el.querySelectorAll<HTMLElement>('.pg-starter-chip')].map((c) => c.getBoundingClientRect());
    const n: [number, number] = el.scrollWidth > el.clientWidth + 0.5 ? [chips.filter((c) => c.left < r.left - 0.5).length, chips.filter((c) => c.right > r.right + 0.5).length] : [0, 0];
    setMore((m) => (m[0] === n[0] && m[1] === n[1] ? m : n));
  };
  // 탭 = 한 화면씩 · 칸 단위 (보이는 칸 − 탭 아래 두 칸 — 반 칸씩 건너뛰어 다 안 보이는 칩이 생기던 것, UX 2바퀴)
  const page = (dir: number) => {
    const el = stripRef.current;
    const cell = el && cellOf(el);
    if (!el || !cell) return;
    el.scrollLeft += dir * Math.max(1, Math.floor((el.clientWidth + cell.gap) / cell.pitch) - 2) * cell.pitch;
  };
  // 고른 포켓몬이 줄 밖이면 보이게 (← → 로 넘길 때 · 다시 재기 뒤 — 처음 그린 뒤 판 세로 막대가 생겨 폭이 줄면 고른 칩이 64% 만 보이던 것, UX 600 × 187)
  useEffect(() => {
    stripRef.current?.querySelector('.pg-chip-on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    countMore();
  }, [index, fitRun, lay.chipZoom, bodyW, stripW]);

  return (
    <div class={`pg-screen pg-title pg-pick${barFit ? ` pg-bar-fit${barFit}` : ''}${moveFit ? ` pg-move-fit${moveFit}` : ''}`} ref={rootRef}>
      <InfoBar
        split
        left={
          // 첫 안내 #63 (2026-10-21) — 넓으면 제목 옆 흐린 한 줄 · 좁은 패널 (600px 아래) 은 제목이 3초 뒤 숲 안내로 한 번 바뀜 (아래 줄을 더할 자리가 없어서)
          <>
            <span class="pg-pick-tag pg-starter-tag" title="숲은 풀 · 벌레 포켓몬이 많아요 — 불꽃 · 비행이 유리">
              <span class="pg-starter-tag-a">
                첫 포켓몬<span class="pg-tag-long">을 골라요</span>
              </span>
              <span class="pg-starter-tag-b">
                <span class="pg-tag-long">숲은 </span>불꽃 · 비행<span class="pg-tag-long">이</span> 유리
              </span>
            </span>
            <span class="pg-starter-tip">
              <span class="pg-tag-long">숲은 풀 · 벌레가 많아요 — </span>불꽃 · 비행이 유리
            </span>
          </>
        }
        right={
          <>
            <Button secondary onClick={onBack} title="Esc — 뒤로">
              ←<span class="pg-back-word"> 뒤로</span>
            </Button>
            {/* 결정은 늘 보이는 정보줄에 (좁은 패널 · 낮은 패널에서 아래 줄이 넘쳐도) */}
            <Button extraClass="pg-pin" onClick={() => onDone(sel.dex, picked)} disabled={!ready} title="Enter — 숲 1-1 로">
              <KeyCap k="Enter" /> 결정 ▶
            </Button>
          </>
        }
      />
      <div class="pg-body pg-pick-body pg-pick-starter" ref={bodyRef} style={{ paddingTop: `${lay.topPx}px`, gap: `${lay.gapPx}px` }}>
        {/* 칩 줄 — 배율이 크면 (×2 · ×3) 폭에 맞춰 여러 줄로 감음 · 그림은 실제 그림을 칸 한가운데 */}
        <div
          class={lay.chipZoom > 1 ? 'pg-panel-row pg-panel-wrap pg-starter-strip' : 'pg-panel-row pg-starter-strip'}
          ref={stripRef}
          style={stripW ? { width: `${stripW}px`, alignSelf: 'flex-start' } : undefined}
          // 칩 줄이 넘칠 때만 세로 휠 = 가로 스크롤 (240 ~ 480 에서 휠을 굴리면 판 전체가 내려가 칩 줄이 사라지던 것 — #128 UX · 피카츄가 줄 끝)
          //   그 방향 끝이면 · Ctrl (확대) 이면 그대로 판에 넘김 (코드 리뷰어)
          onWheel={(e) => {
            const el = e.currentTarget;
            if (e.ctrlKey || el.scrollWidth <= el.clientWidth + 1 || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
            if (e.deltaY < 0 ? el.scrollLeft <= 0 : el.scrollLeft >= el.scrollWidth - el.clientWidth - 1) return;
            e.preventDefault();
            el.scrollLeft += e.deltaY;
          }}
          onScroll={countMore}
        >
          {more[0] > 0 && (
            <button type="button" class="pg-strip-tab pg-strip-tab-l" tabIndex={-1} onClick={() => page(-1)} aria-label={`왼쪽에 ${more[0]}마리 더`} title={`왼쪽에 ${more[0]}마리 더 — 누르면 넘김 (← →)`}>
              <span class="pg-strip-arrow pg-strip-arrow-l" />
              {more[0]}
            </button>
          )}
          {list.map((s, i) => (
            <button key={s.dex} type="button" class={i === index ? 'pg-chip pg-starter-chip pg-chip-on' : 'pg-chip pg-starter-chip'} style={{ height: `${chipPx(lay.chipZoom)}px` }} onClick={() => setIndex(i)} title={`${s.name} (← →)`}>
              <Sprite media={media} form={s.form} scale={1} crop={chipCrop} zoom={lay.chipZoom} center />
            </button>
          ))}
          {more[1] > 0 && (
            <button type="button" class="pg-strip-tab pg-strip-tab-r" tabIndex={-1} onClick={() => page(1)} aria-label={`오른쪽에 ${more[1]}마리 더`} title={`오른쪽에 ${more[1]}마리 더 — 누르면 넘김 (← →)`}>
              {more[1]}
              <span class="pg-strip-arrow pg-strip-arrow-r" />
            </button>
          )}
        </div>
        {/* 세 줄 (칩 · 진화 · 기술) 을 따로 — 줄 사이 = 패널 높이에 따라 (2026-10-20 태현 님 "빨간 네모 각각의 위아래 간격").
            ② 진화 단계 = 위 칸 그림 (같은 점 크기 · 발끝을 한 줄에) + 아래 칸 이름 (그림마다 바로 밑, 끝에 타입) — 태현 님 그림 A안.
            한 격자에 두 줄이라 이름이 그림 바로 밑에 맞음 (열 = 단계 · 화살표 · 단계 … · 타입) */}
        <div class={`pg-panel-row pg-starter-chain${chainFit ? ` pg-chain-fit${chainFit}` : ''}`} ref={chainRef} title={`${sel.name} · ${types}`}>
          {/* 타입을 뺀 단계는 이름 줄 14 (타입 표 20 높이가 없으면 이름 밑이 비어 진화 → 기술 간격이 칩 → 진화보다 8px 크던 것, 2640) */}
          <div class="pg-chain-grid" style={{ gridTemplateRows: `${rowPx}px ${chainFit >= 2 ? 14 : 20}px` }}>
            <div class="pg-chain-pics">
              {chain.map((c, i) => [
                i > 0 && (
                  <span key={`a${c.dex}`} class="pg-chain-arrow pg-dim" style={{ gridColumn: 2 * i }}>
                    →
                  </span>
                ),
                <span key={c.dex} class="pg-chain-pic" style={{ gridColumn: 2 * i + 1 }}>
                  <Sprite media={media} form={c.form} scale={1} crop={rowPx} cropWidth={chainArtWidth(c.form, zoom)} zoom={zoom} bottom bottomPad={groundPad} title={c.name} />
                </span>,
              ])}
            </div>
            <div class="pg-chain-names">
              {chain.map((c, i) => (
                <span key={c.dex} class={i === 0 ? 'pg-chain-label' : 'pg-chain-label pg-dim'} style={{ gridColumn: 2 * i + 1 }}>
                  {c.name}
                </span>
              ))}
              {/* 타입은 격자 밖 오른쪽 옆 (포켓몬 셋 · 이름만으로 화면 가운데 — 태현 님 "전체를 가운데면 포켓몬이 왼쪽으로 보여 거슬려") */}
              <span class="pg-chain-types">
                <TypeTags types={selTypes} />
              </span>
            </div>
          </div>
        </div>
        {/* ④ 처음 기술 — 좁으면 다음 줄로 */}
        <div class="pg-panel-row pg-panel-wrap" ref={movesRef}>
          <span class="pg-panel-sep pg-dim pg-move-count">
            기술 {picked.length}/{BALANCE.starterMoves}
          </span>
          {cands.map((m, i) => (
            <Button key={m.id} secondary extraClass={picked.includes(m.id) ? 'pg-picked' : undefined} onClick={() => toggle(m.id)} title={`${m.detail} (${i + 1})${m.own ? ' · 자기 타입 (위력 × 1.5)' : ''}`}>
              {picked.includes(m.id) ? '✓' : ''}
              {i + 1} {m.name}
              {m.own && <span class="pg-own">×1.5</span>}
              <span class="pg-sub">
                {m.power > 0 ? (
                  <>
                    <span class="pg-pow-word">위력 </span>
                    {m.power}
                  </>
                ) : (
                  m.short
                )}
              </span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
