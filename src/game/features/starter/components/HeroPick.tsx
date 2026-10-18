/**
 * S03 주인공 선택 (gdd S03) — ① 남 · ② 여. 코드로 그린 픽셀 사람, 머리 모양만 다름. 처음 한 번만 (새로 하기 때) → S04.
 * 클릭 또는 ← → + Enter · Esc = 타이틀로. 임시 디자인 — 단계 12 에서 다시.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { Button } from '../../../ui/Button';
import { InfoBar } from '../../../ui/InfoBar';
import { Hero } from '../../stage/components/Hero';
import type { Gender } from '../model';

const CHOICES: { gender: Gender; label: string }[] = [
  { gender: 'male', label: '남' },
  { gender: 'female', label: '여' },
];

export function HeroPick({ px, onBack, onPick }: { px: number; onBack(): void; onPick(g: Gender): void }) {
  const [focus, setFocus] = useState(0);
  const now = useRef({ focus, onBack, onPick });
  now.current = { focus, onBack, onPick };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const c = now.current;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        setFocus((f) => (f + (e.key === 'ArrowLeft' ? -1 : 1) + CHOICES.length) % CHOICES.length);
      } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        c.onPick(CHOICES[c.focus]!.gender);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        c.onBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
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
      <div class="pg-body pg-pick-body">
        {CHOICES.map((c, i) => (
          <button key={c.gender} type="button" class={i === focus ? 'pg-hero-choice pg-chip-on' : 'pg-hero-choice'} onClick={() => onPick(c.gender)} onMouseEnter={() => setFocus(i)} title={`${c.label} 주인공 (Enter)`}>
            <Hero px={px} walking={i === focus} gender={c.gender} label={`${c.label} 주인공`} />
            <b>{c.label}</b>
          </button>
        ))}
      </div>
    </div>
  );
}
