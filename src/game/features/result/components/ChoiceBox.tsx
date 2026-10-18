/**
 * S23 기술 배우기 · S22 진화 (gdd S22 · S23) — save.pendingChoices 맨 앞을 고를 때까지 기다림.
 *   S23: 바꿀 기술 하나 (숫자 1 ~ 4) · 배우지 않기 (Esc)
 *   S22: 진화 연출 약 4초 (Space 빨리 넘기기 · Esc 멈추기 = 다음 레벨업 때 다시) → 남길 지금 기술 고르기 (숫자로 켜고 끄기) · 결정 (Enter)
 * 임시 디자인 — 단계 12 에서 다시.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { GameInput } from '../../../core/engine';
import { withJosa } from '../../../core/text';
import { Button } from '../../../ui/Button';
import { Sprite } from '../../../ui/Sprite';
import type { ChoiceView } from '../model';

/** 굵게 쓴 이름 뒤에 붙일 조사만 */
const josa = (word: string, pair: '을/를' | '으로/로') => withJosa(word, pair).slice(word.length);

export interface ChoiceBoxProps {
  view: ChoiceView;
  media: string;
  scale: number;
  onInput(i: GameInput): void;
}

export function ChoiceBox({ view, media, scale, onInput }: ChoiceBoxProps) {
  const [keep, setKeep] = useState<number[]>([]);
  // 다른 고르기로 넘어가면 고른 것을 비움
  const id = view.kind === 'learn' ? `l${view.monster.uid}${view.move.id}` : `e${view.monster.uid}${view.toName}`;
  useEffect(() => setKeep([]), [id]);

  const decide = () => {
    if (view.kind !== 'evolve' || view.animating) return;
    if (view.keep < view.current.length && keep.length !== view.keep) return;
    onInput({ kind: 'evolve', keep: view.keep >= view.current.length ? view.current.map((m) => m.id) : keep, uid: view.monster.uid, to: view.to });
  };
  const toggle = (moveId: number) => {
    setKeep((k) => (k.includes(moveId) ? k.filter((x) => x !== moveId) : view.kind === 'evolve' && k.length >= view.keep ? k : [...k, moveId]));
  };

  // 단축키 (듣는 건 한 번만 — 지금 값은 ref)
  const now = useRef({ view, keep, decide, toggle, onInput });
  now.current = { view, keep, decide, toggle, onInput };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const c = now.current;
      if (c.view.kind === 'learn') {
        if (/^[1-4]$/.test(e.key) && c.view.current[Number(e.key) - 1]) {
          e.preventDefault();
          c.onInput({ kind: 'learn', replace: Number(e.key) - 1, uid: c.view.monster.uid, moveId: c.view.move.id });
        } else if (e.key === 'Escape') {
          e.preventDefault();
          c.onInput({ kind: 'learn', replace: null, uid: c.view.monster.uid, moveId: c.view.move.id });
        }
        return;
      }
      if (c.view.animating) {
        if (e.key === 'Escape') {
          e.preventDefault();
          c.onInput({ kind: 'evolve-cancel', uid: c.view.monster.uid, to: c.view.to });
        }
        return; // Space (빨리 넘기기) 는 main.ts
      }
      if (/^[1-4]$/.test(e.key)) {
        const m = c.view.current[Number(e.key) - 1];
        if (m) {
          e.preventDefault();
          c.toggle(m.id);
        }
      } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        c.decide();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (view.kind === 'learn') {
    return (
      <div class="pg-banner pg-choice pg-two">
        {/* 한 줄은 글 하나로 (줄 칸 사이 간격이 글 사이에 끼지 않게) */}
        <span class="pg-line">
          <span class="pg-ellipsis">
            ✨ {withJosa(view.name, '이/가')} <b title={view.move.detail}>{view.move.name}</b>
            <span class="pg-sub">{view.move.short}</span>
            {josa(view.move.name, '을/를')} 배울 수 있어요! 기술이 4개 — 바꿀 기술을 골라요 (Esc 배우지 않기)
          </span>
        </span>
        <span class="pg-line pg-choice-row">
          {view.current.map((m, i) => (
            <Button key={m.id} onClick={() => onInput({ kind: 'learn', replace: i, uid: view.monster.uid, moveId: view.move.id })} title={`${m.detail} → ${view.move.name}`}>
              {`${i + 1} ${m.name}`}
              <span class="pg-sub">{m.short}</span>
            </Button>
          ))}
          <Button secondary extraClass="pg-pin" onClick={() => onInput({ kind: 'learn', replace: null, uid: view.monster.uid, moveId: view.move.id })} title="Esc">
            배우지 않기
          </Button>
        </span>
      </div>
    );
  }

  if (view.animating) {
    // 진화 연출 — 어두워지고 하얗게 빛나며 옛 · 새 모습이 점점 빠르게 번갈아 (CSS)
    return (
      <div class="pg-evolve">
        <span class="pg-evolve-stage">
          <span class="pg-evolve-old">
            <Sprite media={media} form={view.monster.form} shiny={view.monster.shiny} scale={scale} />
          </span>
          <span class="pg-evolve-new">
            <Sprite media={media} form={view.toForm} shiny={view.monster.shiny} scale={scale} />
          </span>
        </span>
        <div class="pg-banner pg-evolve-msg">
          <span class="pg-ellipsis">어…? {view.name}의 모습이…!</span>
          {/* 마우스로도 (편집기에 포커스가 있으면 Space 가 코드에 들어감 — 선제공격과 같은 규칙) · 처음 0.8초는 엔진이 안 받음 */}
          <Button secondary onClick={() => onInput({ kind: 'evolve-skip' })} title={document.hasFocus() ? 'Space' : '클릭'}>
            ▶▶
          </Button>
          <Button secondary onClick={() => onInput({ kind: 'evolve-cancel', uid: view.monster.uid, to: view.to })} title={document.hasFocus() ? 'Esc' : '클릭'}>
            멈추기
          </Button>
        </div>
      </div>
    );
  }

  const choosing = view.keep < view.current.length;
  const ready = !choosing || keep.length === view.keep;
  return (
    <div class="pg-banner pg-choice pg-two">
      <span class="pg-line">
        {/* gdd S22 ① — 진화한 모습 */}
        <span class="pg-choice-sprite">
          <Sprite media={media} form={view.toForm} shiny={view.monster.shiny} scale={1} />
        </span>
        <span class="pg-ellipsis">
          🎉 {withJosa(view.name, '은/는')} <b>{view.toName}</b>
          {josa(view.toName, '으로/로')} 진화했다!
        </span>
        {view.fresh.map((m) => (
          <span key={m.id} class="pg-reward" title={m.detail}>
            ✨ {m.name} <span class="pg-sub">{m.short}</span>
          </span>
        ))}
      </span>
      <span class="pg-line pg-choice-row">
        {choosing && (
          <span class="pg-dim pg-keep">
            남길 기술 {keep.length}/{view.keep}
          </span>
        )}
        {view.current.map((m, i) => (
          <Button key={m.id} secondary={choosing && !keep.includes(m.id)} onClick={() => choosing && toggle(m.id)} title={m.detail}>
            {`${choosing ? (keep.includes(m.id) ? '✓' : '') : ''}${i + 1} ${m.name}`}
            <span class="pg-sub">{m.short}</span>
          </Button>
        ))}
        <Button extraClass="pg-pin" onClick={decide} disabled={!ready} title="Enter">
          결정
        </Button>
      </span>
    </div>
  );
}
