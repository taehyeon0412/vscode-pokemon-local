/**
 * 길 위의 것들 (S06 ④ ⑤ ⑥ ⑭ ⑮ ⑯) — 위치는 model.ts 의 visibleObjects, 여기는 모양만 (임시 디자인: 이모지 · 코드로 그린 사람 · CSS 움직임 — 단계 12 에서 다시).
 */
import type { TraceKind } from '../../../core/rules/encounter';
import { Sprite } from '../../../ui/Sprite';
import type { StageObject } from '../model';
import { Hero } from './Hero';

const TRACE_ICON: Record<TraceKind, string> = {
  grass: '🌿',
  tree: '🌳',
  water: '〰️',
  ground: '🪨',
  sky: '🍃',
  shadow: '🌑',
};

const TRACE_TITLE: Record<TraceKind, string> = {
  grass: '풀숲이 흔들린다',
  tree: '나무가 흔들린다',
  water: '물결이 인다',
  ground: '돌 부스러기가 떨어진다',
  sky: '나뭇잎이 날린다 (위에 무언가 있다)',
  shadow: '그림자가 어른거린다',
};

export interface ObjectsProps {
  objects: readonly StageObject[];
  media: string;
  scale: number;
  /** 바닥 높이 (px) — 길 위의 것들이 서는 곳 */
  ground: number;
}

export function StageObjects({ objects, media, scale, ground }: ObjectsProps) {
  return (
    <>
      {objects.map((o) => {
        const style = { left: `${Math.round(o.x)}px`, bottom: `${ground}px` };
        switch (o.kind) {
          case 'scenery':
            return (
              <span key={o.key} class={`pg-scenery pg-scenery-${o.scenery.place}`} style={{ left: `${Math.round(o.x)}px` }}>
                <Sprite media={media} form={o.scenery.form} scale={scale} action={o.scenery.place === 'sky' ? 'walk' : 'idle'} />
              </span>
            );
          case 'facility':
            return (
              <span key={o.key} class={o.active ? 'pg-obj pg-facility pg-facility-active' : 'pg-obj pg-facility'} style={style} title={o.facility.kind === 'hospital' ? '병원 — 회복 · 보관함' : '상점'}>
                {o.facility.kind === 'hospital' ? '🏥' : '🏪'}
              </span>
            );
          case 'trainer':
            return (
              <span key={o.key} class={o.alert ? 'pg-obj pg-trainer pg-trainer-alert' : 'pg-obj pg-trainer'} style={style} title={o.info.name}>
                {o.alert ? <span class="pg-trainer-mark">!</span> : <span class="pg-nametag">{o.info.name}</span>}
                <Hero px={2 * scale} walking={false} hat={o.info.hat} shirt={o.info.shirt} faceLeft label={o.info.name} />
              </span>
            );
          case 'item':
            return (
              <span key={o.key} class="pg-obj pg-item" style={style} title="반짝이는 것이 떨어져 있다">
                ✨
              </span>
            );
          case 'request':
            return (
              <span key={o.key} class={o.active ? 'pg-obj pg-npc pg-npc-active' : 'pg-obj pg-npc'} style={style} title={`${o.template.who.name}`}>
                <span class="pg-npc-mark">❓</span>
                {o.template.who.icon}
              </span>
            );
          case 'wild': {
            if (o.met) {
              return (
                <span key={o.key} class={`pg-obj pg-wild pg-pop-${o.plan.trace}`} style={style}>
                  <Sprite media={media} form={o.plan.form} shiny={o.plan.shiny} scale={scale} faceLeft />
                </span>
              );
            }
            const cls = ['pg-obj', 'pg-trace', `pg-trace-${o.plan.trace}`, o.plan.strong ? 'pg-trace-strong' : '', o.plan.shiny ? 'pg-trace-shiny' : ''].join(' ');
            return (
              <span key={o.key} class={cls} style={style} title={TRACE_TITLE[o.plan.trace] + (o.plan.strong ? ' (크게!)' : '')}>
                {/* 모든 흔적에 같은 신호 — 배경 나무 · 풀과 헷갈리지 않게 */}
                <span class="pg-trace-dots">{o.plan.strong ? '💢' : '…'}</span>
                {TRACE_ICON[o.plan.trace]}
                {o.plan.shiny && <span class="pg-sparkle">✨</span>}
              </span>
            );
          }
        }
      })}
    </>
  );
}
