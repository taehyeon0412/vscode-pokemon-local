/**
 * 길 위의 것들 (S06 ④ ⑤ ⑥ ⑭ ⑮ ⑯) — 위치는 model.ts 의 visibleObjects, 여기는 모양만. 트레이너 · 부탁하는 사람 · 병원 간호순 · 상점 점원은 원작 사람 그림 (data/people.ts), 병원 · 상점은 원작 건물 그림 (media/buildings), 흔적 · 아이템은 이모지 (임시).
 */
import { Fragment } from 'preact';
import type { TraceKind } from '../../../core/rules/encounter';
import { FACILITY_STAFF } from '../../../core/rules/stage';
import { personLook } from '../../../data/heroes';
import { Sprite } from '../../../ui/Sprite';
import { BUILDINGS, buildingDraw, staffLeftPx, type StageObject } from '../model';
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
  /** 사람이 쓸 수 있는 높이 (px) — 큰 그림이 안 들어가면 작게 (data/heroes.ts heroDraw) */
  roomPx?: number;
}

export function StageObjects({ objects, media, scale, ground, roomPx }: ObjectsProps) {
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
          case 'facility': {
            // 원작 건물 그림 — 주인공 뒤, 문 가운데가 o.x · 문 오른쪽 건물 앞에 간호순 · 점원
            const kind = o.facility.kind;
            const b = BUILDINGS[kind];
            const room = roomPx ?? Number.POSITIVE_INFINITY;
            const d = buildingDraw(kind, scale, room);
            const staff = FACILITY_STAFF[kind];
            const look = personLook(staff.look);
            const title = kind === 'hospital' ? '병원 — 회복 · 보관함' : '상점';
            return (
              <Fragment key={o.key}>
                {media ? (
                  <span class="pg-obj pg-building" style={{ left: `${Math.round(o.x - b.door * d.k)}px`, bottom: `${ground}px`, width: `${b.w * d.k}px`, height: `${d.visible}px` }} title={title}>
                    <img src={`${media.replace(/\/+$/, '')}/buildings/${b.file}.png`} alt="" width={b.w * d.k} height={b.h * d.k} draggable={false} />
                  </span>
                ) : (
                  <span class="pg-obj pg-facility" style={style} title={title}>
                    {kind === 'hospital' ? '🏥' : '🏪'}
                  </span>
                )}
                {look && (
                  <span class="pg-obj pg-facility-staff" style={{ left: `${staffLeftPx(kind, o.x, scale, room)}px`, bottom: `${ground}px` }} title={staff.name}>
                    <Hero px={2 * scale} walking={false} faceLeft label={staff.name} look={look} media={media} roomPx={roomPx} />
                  </span>
                )}
              </Fragment>
            );
          }
          case 'trainer':
            return (
              <span key={o.key} class={o.alert ? 'pg-obj pg-trainer pg-trainer-alert' : 'pg-obj pg-trainer'} style={style} title={o.info.name}>
                {o.alert ? <span class="pg-trainer-mark">!</span> : <span class="pg-nametag">{o.info.name}</span>}
                <Hero px={2 * scale} walking={false} hat={o.info.hat} shirt={o.info.shirt} faceLeft label={o.info.name} look={personLook(o.info.look)} media={media} roomPx={roomPx} />
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
                {personLook(o.template.who.look) ? (
                  <Hero px={2 * scale} walking={false} faceLeft label={o.template.who.name} look={personLook(o.template.who.look)} media={media} roomPx={roomPx} />
                ) : (
                  o.template.who.icon
                )}
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
