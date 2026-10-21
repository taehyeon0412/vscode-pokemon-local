/**
 * S23 기술 배우기 · S22 진화 (gdd S22 · S23) — save.pendingChoices 맨 앞을 고를 때까지 기다림.
 *   S23: 바꿀 기술 하나 (숫자 1 ~ 4 · 클릭 = 고르기) → 결정 (Enter — 숫자 하나로 기술이 영영 사라지지 않게, ideas #40) · 배우지 않기 (Esc)
 *   S22: 진화 연출 약 4초 (Space 빨리 넘기기 · Esc 멈추기 = 다음 레벨업 때 다시) → 남길 지금 기술 고르기 (숫자로 켜고 끄기) · 결정 (Enter)
 * 임시 디자인 — 단계 12 에서 다시.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { GameInput } from '../../../core/engine';
import { withJosa } from '../../../core/text';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { KeyCap } from '../../../ui/KeyCap';
import { Sprite } from '../../../ui/Sprite';
import type { ChoiceView } from '../model';
import { pokemonFx } from '../../battle/fx/bridge';

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
  // S23 — 잊을 기술 (고른 칸 번호, 결정 전)
  const [forget, setForget] = useState<number | null>(null);
  // 다른 고르기로 넘어가면 고른 것을 비움
  const id = view.kind === 'learn' ? `l${view.monster.uid}${view.move.id}` : `e${view.monster.uid}${view.toName}`;
  useEffect(() => {
    setKeep([]);
    setForget(null);
  }, [id]);
  const learn = (replace: number | null) => view.kind === 'learn' && onInput({ kind: 'learn', replace, uid: view.monster.uid, moveId: view.move.id });

  const decide = () => {
    if (view.kind !== 'evolve' || view.animating) return;
    if (view.keep < view.current.length && keep.length !== view.keep) return;
    onInput({ kind: 'evolve', keep: view.keep >= view.current.length ? view.current.map((m) => m.id) : keep, uid: view.monster.uid, to: view.to });
  };
  const toggle = (moveId: number) => {
    setKeep((k) => (k.includes(moveId) ? k.filter((x) => x !== moveId) : view.kind === 'evolve' && k.length >= view.keep ? k : [...k, moveId]));
  };

  // 단축키 (듣는 건 한 번만 — 지금 값은 ref)
  const now = useRef({ view, keep, decide, toggle, onInput, forget, learn });
  now.current = { view, keep, decide, toggle, onInput, forget, learn };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const c = now.current;
      if (c.view.kind === 'learn') {
        if (/^[1-4]$/.test(e.key) && c.view.current[Number(e.key) - 1]) {
          // 같은 숫자를 다시 누르면 고르기를 풂
          e.preventDefault();
          const n = Number(e.key) - 1;
          setForget((f) => (f === n ? null : n));
        } else if (e.key === 'Enter' && c.forget !== null && !(e.target instanceof HTMLButtonElement)) {
          e.preventDefault();
          c.learn(c.forget);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          c.learn(null);
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
      <div class="pg-banner pg-choice pg-learn pg-two">
        {/* 한 줄은 글 하나로 (줄 칸 사이 간격이 글 사이에 끼지 않게) · 좁으면 (600px 아래) "★ 잎날가르기 풀 55 — 잊을 기술을 골라요" 로 (이름 · "배울 수 있어요" 를 뺌 — U4 줄임표 대신) */}
        <span class="pg-line">
          <span class="pg-ellipsis">
            <span class="pg-up">★</span> <span class="pg-learn-long">{withJosa(view.name, '이/가')} </span>
            <b title={view.move.detail}>{view.move.name}</b>
            <span class="pg-sub">{view.move.short}</span>
            <span class="pg-learn-long">{josa(view.move.name, '을/를')} 배울 수 있어요</span> —{' '}
            {forget === null ? (
              <>
                <span class="pg-learn-long">잊을 기술을 골라요</span>
                <span class="pg-learn-short">잊을 기술은?</span>
              </>
            ) : (
              <>
                <b class="pg-forget">{view.current[forget]?.name}</b> 대신<span class="pg-learn-long"> 배울까요</span>?
              </>
            )}
          </span>
        </span>
        <span class="pg-line pg-choice-row pg-learn-row">
          {/* 고른 칸 = 금색 테두리 (pg-picked) — 결정 전에는 아무것도 잊지 않음 */}
          {view.current.map((m, i) => (
            <Button key={m.id} secondary extraClass={forget === i ? 'pg-picked' : undefined} onClick={() => setForget(forget === i ? null : i)} title={`${m.detail} — 고른 뒤 [결정] 하면 잊고 ${view.move.name} 를 배워요`}>
              {`${i + 1} ${m.name}`}
              <span class="pg-sub">{m.short}</span>
            </Button>
          ))}
          <Button extraClass="pg-pin" onClick={() => forget !== null && learn(forget)} disabled={forget === null} title={forget === null ? '먼저 잊을 기술을 골라요 (숫자 1 ~ 4)' : 'Enter'}>
            <KeyCap k="Enter" /> 결정
          </Button>
          <Button secondary extraClass="pg-pin" onClick={() => learn(null)} title="Esc">
            배우지 않기
          </Button>
        </span>
      </div>
    );
  }

  if (view.waiting) {
    // 진화는 볼 때 시작 (2026-10-21 ideas #33 — 코딩 중에 4초 연출을 놓치지 않게): 옛 모습 그대로 서 있고 [보기] (Space · 클릭) 를 기다림. 모양은 디자인팀이 다듬음
    return (
      <div class="pg-evolve">
        {/* pg-evolve-old 는 번갈아 숨는 움직임이 붙어 있어 따로 (움직임 없이 서 있음) · 머리 위 금색 반짝 하나 = 무슨 일이 생길 것 (움직이지 않음 — 오래 기다려도 PC 부담 없이) */}
        <span class="pg-evolve-wait">
          <span class="pg-evolve-wait-mark" aria-hidden="true">
            <Icon name="sparkle" />
          </span>
          <Sprite media={media} form={view.monster.form} shiny={view.monster.shiny} scale={scale} />
        </span>
        <div class="pg-banner pg-evolve-msg">
          <span class="pg-ellipsis">어…? {view.name}의 모습이…!</span>
          {/* 주 버튼 = 진화 보기 (Space · 클릭) — 누를 때까지 기다림 */}
          <Button onClick={() => onInput({ kind: 'evolve-watch' })} title={document.hasFocus() ? 'Space · 클릭' : '클릭'}>
            <KeyCap k="Space" /> 진화 보기 ▶
          </Button>
        </div>
      </div>
    );
  }

  if (view.animating) {
    // 진화 연출 — 메가진화처럼 하얗게 빛나며 하얀 실루엣이 옛 ↔ 새 모습으로 점점 빠르게 · 빛줄기 · 펑 (캔버스 — EvolveStage, 2026-10-20 태현 님).
    // 연출 번들이 없으면 예전 CSS (옛 · 새 모습이 번갈아) 그대로
    return (
      <div class="pg-evolve">
        <EvolveStage>
          <span class="pg-evolve-old">
            <Sprite media={media} form={view.monster.form} shiny={view.monster.shiny} scale={scale} />
          </span>
          <span class="pg-evolve-new">
            <Sprite media={media} form={view.toForm} shiny={view.monster.shiny} scale={scale} />
          </span>
        </EvolveStage>
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
    <div class="pg-banner pg-choice pg-two pg-choice-art">
      {/* gdd S22 ① — 진화한 모습 = 두 줄 높이 왼쪽 칸 48 × 48, 길 위와 같은 크기 (첫 줄 글 앞 작은 그림이라 진화하는 순간 가장 작은 그림이던 것 · 두 줄 글 왼쪽을 한 선에 — 아트 디렉터 4차) */}
      <span class="pg-choice-sprite">
        <Sprite media={media} form={view.toForm} shiny={view.monster.shiny} scale={1} crop={48} fieldSize center />
      </span>
      <span class="pg-line">
        <span class="pg-ellipsis">
          {withJosa(view.name, '은/는')} <b>{view.toName}</b>
          {josa(view.toName, '으로/로')} 진화했다!
        </span>
        {/* 새 기술은 저절로 배움 — ★ 만으로는 고르는 화면처럼 읽힘 (플레이 리뷰어) */}
        {view.fresh.length > 0 && <span class="pg-dim">새로 배움</span>}
        {view.fresh.map((m) => (
          <span key={m.id} class="pg-reward" title={m.detail}>
            ★ {m.name} <span class="pg-sub">{m.short}</span>
          </span>
        ))}
      </span>
      <span class="pg-line pg-choice-row">
        {choosing && (
          <span class="pg-dim pg-keep">
            지금 기술 중 {view.keep}개 남기기 ({keep.length}/{view.keep})
          </span>
        )}
        {view.current.map((m, i) => (
          <Button key={m.id} secondary extraClass={!choosing || keep.includes(m.id) ? 'pg-picked' : undefined} onClick={() => choosing && toggle(m.id)} title={m.detail}>
            {`${choosing ? (keep.includes(m.id) ? '✓' : '') : ''}${i + 1} ${m.name}`}
            <span class="pg-sub">{m.short}</span>
          </Button>
        ))}
        <Button extraClass="pg-pin" onClick={decide} disabled={!ready} title="Enter">
          {ready ? '결정' : `${view.keep - keep.length}개 더 고르기`}
        </Button>
      </span>
    </div>
  );
}

/** 진화 무대 — 처음 그릴 때 캔버스 진화 연출을 부름 (옛 · 새 그림은 연출이 숨김 · 3.2초 = CSS 가 새 모습으로 바뀌는 때와 같음) */
const EVOLVE_FX_MS = 3200;
function EvolveStage({ children }: { children: ComponentChildren }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    // 그림이 다 읽힌 뒤 (첫 장면) 에 — 바로 부르면 그림 크기가 0
    const t = window.setTimeout(() => {
      if (ref.current) pokemonFx()?.evolve?.(ref.current, EVOLVE_FX_MS - 50);
    }, 50);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <span class="pg-evolve-stage" ref={ref}>
      {children}
    </span>
  );
}
