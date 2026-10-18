/**
 * S14 상점 (gdd S14) — ① 몬스터볼 · 슈퍼볼 · 하이퍼볼 · 상처약 · 좋은상처약 · 상태 회복약 · 기력의조각 (마스터볼은 안 팖) · ③ 내 돈 (원) · ② 나가기.
 * 누를 때마다 하나씩 삼 (돈이 모자라면 흐리게). 임시 디자인.
 */
import type { GameInput } from '../../../core/engine';
import type { Save } from '../../../core/save';
import { Button } from '../../../ui/Button';
import { formatMoney } from '../../../ui/format';
import { shopView } from '../model';
import { Panel, Row } from './Panel';

export function ShopPanel({ save, note, onInput, onClose }: { save: Save; /** 방금 산 것 ("몬스터볼을 샀다!") — 알림 줄은 판 밑에 깔려서 판 안에 */ note?: string; onInput(i: GameInput): void; onClose(): void }) {
  return (
    <Panel
      title="🏪 상점"
      extra={
        <>
          <span class="pg-money">💰 {formatMoney(save.money)}</span>
          {note && <span class="pg-shop-note"> · {note}</span>}
        </>
      }
      onClose={onClose}
      closeLabel="나가기"
    >
      <Row wrap>
        {shopView(save).map((r) => (
          <Button key={r.item} secondary={!r.affordable} disabled={!r.affordable} onClick={() => onInput({ kind: 'buy', item: r.item })} title={r.affordable ? `${r.name} 하나 사기` : '돈이 모자라요'}>
            {r.name} <b>{formatMoney(r.price)}</b> <span class="pg-sub">{r.effect} · ×{r.have}</span>
          </Button>
        ))}
      </Row>
    </Panel>
  );
}
