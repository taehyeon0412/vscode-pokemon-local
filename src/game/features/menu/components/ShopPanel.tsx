/**
 * S14 상점 (gdd S14) — ① 몬스터볼 · 슈퍼볼 · 하이퍼볼 · 상처약 · 좋은상처약 · 상태 회복약 · 기력의조각 (마스터볼은 안 팖) · ③ 내 돈 (원) · ② 나가기.
 * 누를 때마다 하나씩 삼 (돈이 모자라면 흐리게). 임시 디자인.
 */
import type { GameInput } from '../../../core/engine';
import type { Save } from '../../../core/save';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { formatMoney } from '../../../ui/format';
import { ITEM_ICON, shopView } from '../model';
import { Panel } from './Panel';

export function ShopPanel({ save, note, onInput, onClose }: { save: Save; /** 방금 산 것 ("몬스터볼을 샀다!") — 알림 줄은 판 밑에 깔려서 판 안에 */ note?: string; onInput(i: GameInput): void; onClose(): void }) {
  return (
    <Panel
      icon="shop"
      title="상점"
      extra={
        <>
          <span class="pg-money">
            <Icon name="coin" /> {formatMoney(save.money)}
          </span>
          {note ? <span class="pg-shop-note"> · {note}</span> : <span class="pg-dim"> · 눌러서 1개</span>}
        </>
      }
      onClose={onClose}
      closeLabel="나가기"
    >
      {/* 3칸 바둑판 — 이름 · 값 왼쪽, 설명 · 가진 수는 오른쪽 끝 흐리게 (넘치면 설명만 줄임, 긴 설명은 title) — 아트 디렉터 3차 */}
      <div class="pg-shop-grid">
        {shopView(save).map((r) => (
          <Button key={r.item} secondary disabled={!r.affordable} extraClass="pg-shop-item" onClick={() => onInput({ kind: 'buy', item: r.item })} title={`${r.name} — ${r.detail}${r.affordable ? ' (눌러서 하나 사기)' : ' · 돈이 모자라요'}`}>
            <span class="pg-shop-name">
              <Icon name={ITEM_ICON[r.item]} /> {r.name} <b>{formatMoney(r.price)}</b>
            </span>
            <span class="pg-sub pg-shop-sub">
              {r.effect} · 가진 {r.have}
            </span>
          </Button>
        ))}
      </div>
    </Panel>
  );
}
