/**
 * S19 가방 (gdd S19) — ① 가진 아이템 · 전투 밖에서 상처약 · 좋은상처약 · 상태 회복약 · 기력의조각 · 진화의 돌 · 연결의끈을 씀 (볼은 전투에서만) · ② 닫기.
 * 아이템을 고르면 쓸 팀 포켓몬 (못 쓰면 흐리게 + 까닭). 진화의 돌 → S22 진화 (멈추면 돌을 돌려줌). 임시 디자인.
 */
import { useState } from 'preact/hooks';
import type { GameInput } from '../../../core/engine';
import type { ItemId, Save } from '../../../core/save';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { Sprite } from '../../../ui/Sprite';
import { bagTargets, bagView } from '../model';
import { Panel, Row } from './Panel';

export interface BagPanelProps {
  save: Save;
  media: string;
  onInput(i: GameInput): void;
  onClose(): void;
}

export function BagPanel({ save, media, onInput, onClose }: BagPanelProps) {
  const rows = bagView(save);
  const [sel, setSel] = useState<ItemId | null>(null);
  const item = rows.find((r) => r.item === sel) ?? null;
  const targets = item?.field ? bagTargets(save, item.item) : [];
  return (
    <Panel
      title={
        <>
          <Icon name="bag" /> 가방
        </>
      } extra={rows.length === 0 ? '아무것도 없어요' : '쓸 아이템을 골라요'} onClose={onClose}>
      <Row>
        {rows.map((r) => (
          <button
            key={r.item}
            type="button"
            class={`pg-chip${sel === r.item ? ' pg-chip-on' : ''}${r.field ? '' : ' pg-chip-dim'}`}
            onClick={() => setSel(r.item)}
            title={r.field ? (r.evolution ? '진화의 돌 — 진화하는 포켓몬에게' : '전투 밖에서 써요') : '볼은 전투에서만 써요'}
          >
            {r.name} <b>×{r.count}</b>
          </button>
        ))}
      </Row>
      {item && !item.field && (
        <Row>
          <span class="pg-dim">{item.name}은(는) 전투에서 써요 (볼 = 야생 포켓몬에게)</span>
        </Row>
      )}
      {item?.field && (
        <Row label={`${item.name} →`}>
          {targets.map(({ view, block }) => (
            <Button key={view.uid} secondary disabled={!!block} onClick={() => onInput({ kind: 'use-item', item: item.item, uid: view.uid })} title={block ?? `${view.name}에게 쓰기`}>
              <Sprite media={media} form={view.form} shiny={view.shiny} scale={0.5} />
              {view.name} <span class="pg-sub">{block ?? `HP ${view.hp}/${view.maxHp}`}</span>
            </Button>
          ))}
        </Row>
      )}
    </Panel>
  );
}
