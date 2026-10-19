/**
 * S03 주인공 선택 (gdd S03 — 2026-10-19 태현 님 A안) — 남 · 여 여러 명 (data/heroes.ts) 을 한 줄에.
 * 칸마다 정면 그림, 고른 (포커스 · 마우스를 올린) 칸만 정면으로 제자리걸음 (2026-10-19 태현 님). 처음 한 번만 (새로 하기 때) → S04.
 * 클릭 또는 ← → + Enter · Esc = 타이틀로.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { HERO_LOOKS, type HeroLook } from '../../../data/heroes';
import { Button } from '../../../ui/Button';
import { InfoBar } from '../../../ui/InfoBar';
import { Hero } from '../../stage/components/Hero';

/** 칸 이름 줄 · 칸 테두리와 안쪽 여백 (game.css .pg-pick-heroes) · 이보다 낮은 칸은 이름을 숨김 (game.css @media max-height 80px 와 같이) */
const LABEL_PX = 13;
const CARD_EDGE_PX = 8;
const LABEL_MIN_BODY = 60;

export function HeroPick({ px, media, bodyPx, initial, onBack, onPick }: { px: number; media: string; bodyPx?: number; initial?: string; onBack(): void; onPick(look: HeroLook): void }) {
  // 칸 그림이 쓸 수 있는 높이 — 큰 그림이 안 들어가면 작은 그림 (data/heroes.ts heroDraw)
  const room = bodyPx === undefined ? undefined : bodyPx - (bodyPx < LABEL_MIN_BODY ? 0 : LABEL_PX) - CARD_EDGE_PX;
  // S04 에서 ← 뒤로 오면 고른 칸 그대로
  const [focus, setFocus] = useState(() => Math.max(0, HERO_LOOKS.findIndex((l) => l.id === initial)));
  const now = useRef({ focus, onBack, onPick });
  now.current = { focus, onBack, onPick };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const c = now.current;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        setFocus((f) => (f + (e.key === 'ArrowLeft' ? -1 : 1) + HERO_LOOKS.length) % HERO_LOOKS.length);
      } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        c.onPick(HERO_LOOKS[c.focus]!);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        c.onBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // 키보드로 옮긴 칸이 좁은 패널 밖이면 보이게
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const btn = bodyRef.current?.querySelectorAll<HTMLElement>('.pg-hero-choice')[focus];
    btn?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    // 키보드로 쓰는 중 (버튼에 포커스가 있음) 이면 포커스도 같이 — Enter 가 표시된 칸을 누르게 (Tab 으로 다른 버튼에 있어도)
    if (btn && document.activeElement instanceof HTMLButtonElement && document.activeElement !== btn) btn.focus({ preventScroll: true });
  }, [focus]);
  return (
    <div class="pg-screen pg-title pg-pick">
      <InfoBar
        center={<span class="pg-title-text">주인공을 골라요</span>}
        right={
          <Button secondary onClick={onBack} title="Esc">
            ← 뒤로
          </Button>
        }
      />
      <div class="pg-body pg-pick-body pg-pick-heroes" ref={bodyRef}>
        {HERO_LOOKS.map((look, i) => {
          const on = i === focus;
          return (
            <button key={look.id} type="button" class={on ? 'pg-hero-choice pg-chip-on' : 'pg-hero-choice'} onClick={() => onPick(look)} onMouseEnter={() => setFocus(i)} onFocus={() => setFocus(i)} title={`${look.label} (Enter)`}>
              <Hero px={px} walking={on} front look={look} media={media} gender={look.gender} roomPx={room} />
              <b>{look.label}</b>
            </button>
          );
        })}
      </div>
    </div>
  );
}
