/**
 * S04 스타팅 선택 (gdd S04 · 4.2) — ① 스타팅 줄 (18마리, 클릭 · ← →) · ② 진화 단계 (1 → 2 → 3) · ④ 처음 기술 2개 (후보 4개, 숫자 1 ~ 4) · ③ 결정 (Enter) → 숲 1-1.
 * Esc = S03 로. 임시 디자인 — 단계 12 에서 다시.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { BALANCE } from '../../../core/balance';
import { typeNameKo } from '../../../core/text';
import { speciesOf } from '../../../data';
import { Button } from '../../../ui/Button';
import { KeyCap } from '../../../ui/KeyCap';
import { InfoBar } from '../../../ui/InfoBar';
import { Sprite } from '../../../ui/Sprite';
import { moveView } from '../../result/model';
import { CHAIN_ROW_PX, CHAIN_ZOOM, chainArtWidth, defaultStarterMoves, evolutionChain, starterList, starterMoveCandidates } from '../model';

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
  // 다른 스타팅을 고르면 기본 2개로
  useEffect(() => setPicked(defaultStarterMoves(sel.dex).map((m) => m.id)), [sel.dex]);
  // 자기 타입 기술은 "×1.5" (같은 타입 1.5배 — 처음 하는 사람이 위력 숫자만 보고 고르지 않게, ★ 은 다른 화면에서 새 기술 · 등급이라 바꿈 2026-10-20)
  const ownTypes = speciesOf(sel.dex)?.types ?? [];
  const cands = starterMoveCandidates(sel.dex).map((m) => ({ ...moveView(m.id), own: ownTypes.includes(m.type) }));
  const chain = evolutionChain(sel.dex);
  const types = (speciesOf(sel.dex)?.types ?? []).map(typeNameKo).join(' · ');
  const ready = picked.length === BALANCE.starterMoves && !pending;

  const toggle = (id: number) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= BALANCE.starterMoves ? [...p.slice(1), id] : [...p, id]));

  // ← → 스타팅 · 1 ~ 4 기술 · Enter 결정 · Esc 뒤로 (듣는 건 한 번만 — 지금 값은 ref)
  const now = useRef({ list, cands, ready, sel, picked, toggle, onBack, onDone });
  now.current = { list, cands, ready, sel, picked, toggle, onBack, onDone };
  const stripRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
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
      } else if (e.key === 'Enter') {
        // 버튼에 포커스가 있어도 Enter = 결정 (방금 누른 기술 버튼이 다시 눌려 빠지지 않게 — 플레이 리뷰)
        e.preventDefault();
        if (c.ready) c.onDone(c.sel.dex, c.picked);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        c.onBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // 고른 포켓몬이 줄 밖이면 보이게 (← → 로 넘길 때)
  useEffect(() => {
    stripRef.current?.querySelector('.pg-chip-on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [index]);

  return (
    <div class="pg-screen pg-title pg-pick" ref={rootRef}>
      <InfoBar
        split
        left={<span class="pg-pick-tag">첫 포켓몬을 골라요</span>}
        right={
          <>
            <Button secondary onClick={onBack} title="Esc">
              ← 뒤로
            </Button>
            {/* 결정은 늘 보이는 정보줄에 (좁은 패널 · 낮은 패널에서 아래 줄이 넘쳐도) */}
            <Button extraClass="pg-pin" onClick={() => onDone(sel.dex, picked)} disabled={!ready} title="Enter — 숲 1-1 로">
              <KeyCap k="Enter" /> 결정 ▶
            </Button>
          </>
        }
      />
      <div class="pg-body pg-pick-body pg-pick-starter">
        <div class="pg-panel-row" ref={stripRef}>
          {list.map((s, i) => (
            <button key={s.dex} type="button" class={i === index ? 'pg-chip pg-starter-chip pg-chip-on' : 'pg-chip pg-starter-chip'} onClick={() => setIndex(i)} title={`${s.name} (← →)`}>
              <Sprite media={media} form={s.form} scale={1} crop={22} />
            </button>
          ))}
        </div>
        {/* 세 줄 (칩 · 진화 · 기술) 을 따로 — 줄 사이 = 패널 높이에 따라 (2026-10-20 태현 님 "빨간 네모 각각의 위아래 간격").
            ② 진화 단계 = 모든 단계 같은 점 크기 ×2 (진화할수록 커 보임 — 태현 님 "크기가 제각각"), 줄 높이 66 고정 · 실제 그림을 칸 한가운데 (center) */}
        <div class="pg-panel-row pg-starter-chain" style={{ height: `${CHAIN_ROW_PX}px` }}>
          <span class="pg-chain" title={`${sel.name} · ${types}`}>
            {chain.map((c, i) => (
              <span key={c.dex} class="pg-chain-step">
                {i > 0 && <span class="pg-dim">→</span>}
                <Sprite media={media} form={c.form} scale={1} crop={CHAIN_ROW_PX} cropWidth={chainArtWidth(c.form)} zoom={CHAIN_ZOOM} center />
                <span class={i === 0 ? 'pg-chain-name' : 'pg-chain-name pg-dim'}>{c.name}</span>
              </span>
            ))}
            <span class="pg-sub pg-chain-name">{types}</span>
          </span>
        </div>
        {/* ④ 처음 기술 — 좁으면 다음 줄로 */}
        <div class="pg-panel-row pg-panel-wrap">
          <span class="pg-panel-sep pg-dim">
            기술 {picked.length}/{BALANCE.starterMoves}
          </span>
          {cands.map((m, i) => (
            <Button key={m.id} secondary extraClass={picked.includes(m.id) ? 'pg-picked' : undefined} onClick={() => toggle(m.id)} title={`${m.detail} (${i + 1})${m.own ? ' · 자기 타입 (위력 × 1.5)' : ''}`}>
              {picked.includes(m.id) ? '✓' : ''}
              {i + 1} {m.name}
              {m.own && <span class="pg-own">×1.5</span>}
              <span class="pg-sub">{m.short}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
