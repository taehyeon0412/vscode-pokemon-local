/**
 * S14 상점 (gdd S14) — ① 사기: 몬스터볼 · 슈퍼볼 · 하이퍼볼 · 상처약 · 좋은상처약 · 상태 회복약 · 기력의조각 · 이상한사탕 (스테이지 상점에서 한 판에 1개) · 경험 부적 (마스터볼은 안 팖)
 * ② 팔기 (2026-10-21 다음 버전 2단계 — 정가 50%, 진화의 돌 · 연결의끈은 못 팖) · ③ 내 돈 (원) · 나가기.
 * 누를 때마다 하나씩 · Shift + 클릭 = 5개 (돈 · 가진 수가 모자라면 되는 만큼).
 */
import { useState } from 'preact/hooks';
import { itemName, VALUABLES } from '../../../core/rules/items';
import { BALANCE } from '../../../core/balance';
import type { GameInput } from '../../../core/engine';
import type { ItemId, Save } from '../../../core/save';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { formatMoney } from '../../../ui/format';
import { ITEM_ICON, sellView, shopView } from '../model';
import { Panel } from './Panel';

export function ShopPanel({ save, note, onInput, onClose }: { save: Save; /** 방금 산 것 ("몬스터볼을 샀다!") — 알림 줄은 판 밑에 깔려서 판 안에 */ note?: string; onInput(i: GameInput): void; onClose(): void }) {
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const sells = sellView(save);
  // 팔기 칸 자리 지키기 — 판을 연 동안 다 판 칸도 "가진 0" 흐리게 남김 (빠지면 뒤 칸이 당겨져 같은 자리를 누르면 다른 물건이 팔리던 것 — UX 리뷰어 2026-10-21). 탭을 바꾸면 새로 정리
  const [sellKeep, setSellKeep] = useState<ItemId[]>(() => sells.map((r) => r.item));
  const sellRows = sellKeep.map((item) => sells.find((r) => r.item === item) ?? { item, name: itemName(item), price: 0, have: 0 });
  const openTab = (t: 'buy' | 'sell') => {
    setTab(t);
    setSellKeep(sellView(save).map((r) => r.item));
  };
  const count = (e?: MouseEvent) => (e?.shiftKey ? BALANCE.shopBulk : 1);
  return (
    <Panel
      icon="shop"
      title="상점"
      extra={
        <>
          {/* 사기 · 팔기 — 고른 쪽 = 금색 테두리 (설정 스위치 켜짐과 같은 모양) · 팔 것이 없으면 팔기 흐리게 */}
          <span class="pg-shop-tabs">
            <Button secondary extraClass={tab === 'buy' ? 'pg-picked' : undefined} onClick={() => openTab('buy')} title="사기">
              사기
            </Button>
            <Button secondary extraClass={tab === 'sell' ? 'pg-picked' : undefined} onClick={() => openTab('sell')} disabled={sells.length === 0 && tab !== 'sell'} title={sells.length === 0 ? '팔 수 있는 물건이 없어요' : '팔기 — 정가의 절반'}>
              팔기
            </Button>
          </span>
          <span class="pg-money">
            <Icon name="coin" /> {formatMoney(save.money)}
          </span>
          {/* 넓으면 머리 줄 · 480px 아래는 판 맨 위 한 줄 (머리 줄 줄임표에 묻히던 것 — UX 리뷰어) */}
          {note ? <span class="pg-shop-note pg-long"> · {note}</span> : <span class="pg-dim pg-long"> · 눌러서 1개 · Shift 5개</span>}
        </>
      }
      onClose={onClose}
      closeLabel="나가기"
      // 좁은 패널 (480px 아래) = 머리 줄 아래 고정 한 줄 — 평소 "눌러서 1개 · Shift 5개" · 사고팔면 금색 알림 (판 안 맨 위에 끼면 칸이 밀리고 굴리면 안 보이던 것 — UX 리뷰어 2026-10-21)
      sub={<span class={note ? 'pg-shop-note-line pg-on' : 'pg-shop-note-line'}>{note ?? '눌러서 1개 · Shift 5개'}</span>}
    >
      {tab === 'buy' ? (
        /* 3칸 바둑판 — 이름 · 값 왼쪽, 설명 · 가진 수는 오른쪽 끝 흐리게 (넘치면 설명만 줄임, 긴 설명은 title) — 아트 디렉터 3차 */
        <div class="pg-shop-grid">
          {shopView(save).map((r) => (
            <Button
              key={r.item}
              secondary
              disabled={!r.affordable}
              extraClass={r.blocked ? 'pg-shop-item pg-shop-rule' : 'pg-shop-item'}
              onClick={(e) => onInput({ kind: 'buy', item: r.item, count: count(e) })}
              title={`${r.name} — ${r.detail}${r.blocked ? ` · ${r.blocked}` : r.affordable ? ' (눌러서 1개 · Shift + 클릭 5개)' : ' · 돈이 모자라요'}`}
            >
              <span class="pg-shop-name">
                <Icon name={ITEM_ICON[r.item]} /> {r.name} <b>{formatMoney(r.price)}</b>
              </span>
              <span class="pg-sub pg-shop-sub">
                {/* 못 사는 까닭이 있으면 그것을 (이상한사탕 "한 판에 1개") · 가진 수는 있을 때만 */}
                {/* 넘치면 설명이 줄고 가진 수는 늘 보임 (경험 부적 "가진…" 이 잘리던 것 — UX 리뷰어) */}
                {r.blocked ?? (
                  <>
                    <span class="pg-shop-eff">{r.effect}</span>
                    {r.have > 0 && <span class="pg-shop-have">{'\u00a0'}· 가진 {r.have}</span>}
                  </>
                )}
              </span>
            </Button>
          ))}
        </div>
      ) : sellRows.length === 0 ? (
        <div class="pg-dim">팔 수 있는 물건이 없어요 — 길에서 진주 · 금구슬 같은 물건을 주우면 여기서 팔아요</div>
      ) : (
        /* 팔기 — 받는 돈은 + 금색 (얻는 돈), 가진 수 오른쪽 */
        <div class="pg-shop-grid">
          {sellRows.map((r, i) => [
            // 팔 물건 다음 쓰는 물건 앞에 구분 한 줄
            i > 0 && !VALUABLES.includes(r.item) && VALUABLES.includes(sellRows[i - 1]!.item) && (
              <span key="sep" class="pg-shop-sep pg-dim">
                쓰는 물건
              </span>
            ),
            <Button key={r.item} secondary disabled={r.have <= 0} extraClass="pg-shop-item" onClick={(e) => onInput({ kind: 'sell', item: r.item, count: count(e) })} title={r.have > 0 ? `${r.name} 팔기 — 1개 ${formatMoney(r.price)} (Shift + 클릭 5개)` : `${r.name} — 다 팔았어요`}>
              <span class="pg-shop-name">
                <Icon name={ITEM_ICON[r.item]} /> {r.name} {r.have > 0 && <b>+{formatMoney(r.price)}</b>}
              </span>
              <span class="pg-sub pg-shop-sub">가진 {r.have}</span>
            </Button>,
          ])}
        </div>
      )}
    </Panel>
  );
}
