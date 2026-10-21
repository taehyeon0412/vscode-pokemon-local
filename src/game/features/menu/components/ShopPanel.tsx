/**
 * S14 상점 (gdd S14) — ① 사기: 몬스터볼 · 슈퍼볼 · 하이퍼볼 · 상처약 · 좋은상처약 · 상태 회복약 · 기력의조각 · 이상한사탕 (스테이지 상점에서 한 판에 1개) · 경험 부적 (마스터볼은 안 팖)
 * ② 팔기 (2026-10-21 다음 버전 2단계 — 정가 50%, 진화의 돌 · 연결의끈은 못 팖) · ③ 내 돈 (원) · 나가기.
 * 누를 때마다 하나씩 · Shift + 클릭 = 5개 (돈 · 가진 수가 모자라면 되는 만큼).
 */
import { useState } from 'preact/hooks';
import { BALANCE } from '../../../core/balance';
import type { GameInput } from '../../../core/engine';
import type { Save } from '../../../core/save';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { formatMoney } from '../../../ui/format';
import { ITEM_ICON, sellView, shopView } from '../model';
import { Panel } from './Panel';

export function ShopPanel({ save, note, onInput, onClose }: { save: Save; /** 방금 산 것 ("몬스터볼을 샀다!") — 알림 줄은 판 밑에 깔려서 판 안에 */ note?: string; onInput(i: GameInput): void; onClose(): void }) {
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const sells = sellView(save);
  const count = (e?: MouseEvent) => (e?.shiftKey ? BALANCE.shopBulk : 1);
  return (
    <Panel
      icon="shop"
      title="상점"
      extra={
        <>
          {/* 사기 · 팔기 — 고른 쪽 = 금색 테두리 (설정 스위치 켜짐과 같은 모양) · 팔 것이 없으면 팔기 흐리게 */}
          <span class="pg-shop-tabs">
            <Button secondary extraClass={tab === 'buy' ? 'pg-picked' : undefined} onClick={() => setTab('buy')} title="사기">
              사기
            </Button>
            <Button secondary extraClass={tab === 'sell' ? 'pg-picked' : undefined} onClick={() => setTab('sell')} disabled={sells.length === 0 && tab !== 'sell'} title={sells.length === 0 ? '팔 수 있는 물건이 없어요' : '팔기 — 정가의 절반'}>
              팔기
            </Button>
          </span>
          <span class="pg-money">
            <Icon name="coin" /> {formatMoney(save.money)}
          </span>
          {note ? <span class="pg-shop-note"> · {note}</span> : <span class="pg-dim pg-long"> · 눌러서 1개 · Shift 5개</span>}
        </>
      }
      onClose={onClose}
      closeLabel="나가기"
    >
      {tab === 'buy' ? (
        /* 3칸 바둑판 — 이름 · 값 왼쪽, 설명 · 가진 수는 오른쪽 끝 흐리게 (넘치면 설명만 줄임, 긴 설명은 title) — 아트 디렉터 3차 */
        <div class="pg-shop-grid">
          {shopView(save).map((r) => (
            <Button
              key={r.item}
              secondary
              disabled={!r.affordable}
              extraClass="pg-shop-item"
              onClick={(e) => onInput({ kind: 'buy', item: r.item, count: count(e) })}
              title={`${r.name} — ${r.detail}${r.blocked ? ` · ${r.blocked}` : r.affordable ? ' (눌러서 1개 · Shift + 클릭 5개)' : ' · 돈이 모자라요'}`}
            >
              <span class="pg-shop-name">
                <Icon name={ITEM_ICON[r.item]} /> {r.name} <b>{formatMoney(r.price)}</b>
              </span>
              <span class="pg-sub pg-shop-sub">
                {/* 못 사는 까닭이 있으면 그것을 (이상한사탕 "한 판에 1개") · 가진 수는 있을 때만 */}
                {r.blocked ?? (r.have > 0 ? `${r.effect} · 가진 ${r.have}` : r.effect)}
              </span>
            </Button>
          ))}
        </div>
      ) : sells.length === 0 ? (
        <div class="pg-dim">팔 수 있는 물건이 없어요 — 길에서 진주 · 금구슬 같은 물건을 주우면 여기서 팔아요</div>
      ) : (
        /* 팔기 — 받는 돈은 + 금색 (얻는 돈), 가진 수 오른쪽 */
        <div class="pg-shop-grid">
          {sells.map((r) => (
            <Button key={r.item} secondary extraClass="pg-shop-item" onClick={(e) => onInput({ kind: 'sell', item: r.item, count: count(e) })} title={`${r.name} 팔기 — 1개 ${formatMoney(r.price)} (Shift + 클릭 5개)`}>
              <span class="pg-shop-name">
                <Icon name={ITEM_ICON[r.item]} /> {r.name} <b>+{formatMoney(r.price)}</b>
              </span>
              <span class="pg-sub pg-shop-sub">가진 {r.have}</span>
            </Button>
          ))}
        </div>
      )}
    </Panel>
  );
}
