/**
 * S19 가방 (gdd S19) — ① 가진 아이템 · 전투 밖에서 상처약 · 좋은상처약 · 상태 회복약 · 기력의조각 · 진화의 돌 · 연결의끈을 씀 (볼은 전투에서만) · ② 닫기.
 * 아이템을 고르면 쓸 팀 포켓몬 (못 쓰면 흐리게 + 까닭). 진화의 돌 → S22 진화 (멈추면 돌을 돌려줌). 임시 디자인.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { GameInput } from '../../../core/engine';
import { itemName } from '../../../core/rules/items';
import type { ItemId, Save } from '../../../core/save';
import { withJosa } from '../../../core/text';
import { Button } from '../../../ui/Button';
import { afterFonts } from '../../../ui/fonts';
import { Icon } from '../../../ui/Icon';
import { Sprite } from '../../../ui/Sprite';
import { bagBoxNote, bagTargets, bagView, ITEM_ICON } from '../model';
import { Panel, Row } from './Panel';

export interface BagPanelProps {
  save: Save;
  media: string;
  onInput(i: GameInput): void;
  onClose(): void;
}

/**
 * 머리 줄 뜻 (#148 — 칩 ▲ 는 7px 라 열두 칸 가운데서 찾아야 하고 240 은 돌 칩이 굴려야 보여서 · U5): 쓸 수 있는 돌 · 끈이 한 가지면 이름까지 "▲ 천둥의돌로 진화 가능" · 둘 넘으면 "▲ 진화 가능" · 넓으면 뒤에 " · 쓸 아이템을 골라요".
 * 넘치면 한 단계 (내용 실제 너비가 머리 줄 칸을 넘으면 — ux-rules U4): 1 = 뒤 안내 뺌 · 2 = 이름 뺌 · 패널 크기 · 글꼴이 바뀌면 0 부터.
 *   이름은 머리 아이콘을 빼고도 안 들어갈 때만 뺌 (아이콘은 Panel tight 가 먼저 뺌 — 둘이 같은 칸을 따로 재 처음 열기 ↔ 크기 바꾼 뒤 이름이 남고 빠짐이 갈리던 것, #148 UX 3) ·
 *   그릴 때 · 크기 · 글꼴이 바뀔 때 그 PC 글꼴로 다시 재서 맥 여유 없이 실제 값 (ux-rules U4 짧은 글 단계 · 1698 — 맥 흉내 +0.06em 훑기로 확인)
 */
function EvoKey({ item }: { item: ItemId | null }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [step, setStep] = useState(0);
  const max = item ? 2 : 1;
  useLayoutEffect(() => {
    const ex = ref.current?.closest<HTMLElement>('.pg-panel-extra');
    const head = ex?.parentElement;
    if (!ex || !head || step >= max || ex.clientWidth <= 0) return;
    const icon = step >= 1 ? head.querySelector(':scope > .pg-icon') : null;
    const iconRoom = icon ? icon.getBoundingClientRect().width + (parseFloat(getComputedStyle(head).columnGap) || 0) : 0;
    const range = document.createRange();
    range.selectNodeContents(ex);
    if (range.getBoundingClientRect().width > ex.clientWidth + iconRoom + 0.02) setStep(step + 1);
  });
  useEffect(() => {
    const again = () => setStep(0);
    window.addEventListener('resize', again);
    const offFonts = afterFonts(again);
    return () => {
      window.removeEventListener('resize', again);
      offFonts();
    };
  }, []);
  return (
    <>
      <span ref={ref} class="pg-evo-key">
        <span class="pg-evo-sign" aria-hidden="true" />
        {item && step < 2 ? `${withJosa(itemName(item), '으로/로')} 진화 가능` : '진화 가능'}
      </span>
      {step < 1 && <span class="pg-long"> · 쓸 아이템을 골라요</span>}
    </>
  );
}

export function BagPanel({ save, media, onInput, onClose }: BagPanelProps) {
  const rows = bagView(save);
  const evoRows = rows.filter((r) => r.evolve);
  const [sel, setSel] = useState<ItemId | null>(null);
  const item = rows.find((r) => r.item === sel) ?? null;
  const targets = item?.field ? bagTargets(save, item.item) : [];
  const boxNote = item?.field ? bagBoxNote(save, item.item) : null;
  // 고른 물건 줄을 판 안으로 — 굴려 내려가 칩을 누르면 줄이 칩 위에 생기며 스크롤 고정 (scroll anchoring) 으로 판 밖에 남던 것 (#148 UX 큼 1 · ux-rules U4 "판 안에 뜨는 줄")
  const pickRow = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (sel) pickRow.current?.querySelector('.pg-bag-pick')?.scrollIntoView({ block: 'nearest' });
  }, [sel]);
  return (
    <Panel
      icon="bag"
      title="가방"
      // 길에서 쓸 것이 없으면 (볼만 있음) 그렇다고 — 고를 것이 없는데 "쓸 아이템을 골라요" 이던 것 (UX 밤 점검)
      extra={
        rows.length === 0 ? (
          '아무것도 없어요'
        ) : evoRows.length > 0 ? (
          // 칩 ▲ 의 뜻 (#148) — 한 가지면 그 이름 · 돌이 바뀌면 (진화 · 다 씀) 0 단계부터
          <EvoKey key={evoRows.map((r) => r.item).join(',')} item={evoRows.length === 1 ? evoRows[0]!.item : null} />
        ) : rows.some((r) => r.field) ? (
          '쓸 아이템을 골라요'
        ) : (
          <>
            지금 쓸 것이 없어요<span class="pg-long"> · 볼은 전투에서</span>
          </>
        )
      }
      onClose={onClose}
    >
      {/* 고른 물건 줄 (쓸 포켓몬 · 안내) 을 칩 위에 — 칩이 여러 줄이면 아래로 밀려 굴려야 보이던 것 (UX 리뷰어 2026-10-21) */}
      <div ref={pickRow} class="pg-bag-pickwrap">
        {item && !item.field && (
          <Row extraClass="pg-bag-pick">
            <span class="pg-dim">{item.note}</span>
          </Row>
        )}
        {/* 보관함에만 쓸 포켓몬이 있으면 그 한 줄만 (#148 UX 큼 2 — 팀 버튼은 모두 "진화하지 않아요" 라 빼고 · 좁으면 줄을 바꿔 다 보임: 옆 스크롤 줄에 두면 240 에서 "팀에 …" 로 잘리던 것) */}
        {item?.field && boxNote && (
          <Row label={`${item.name} →`} extraClass="pg-bag-pick pg-bag-note">
            <span class="pg-dim">{boxNote}</span>
          </Row>
        )}
        {item?.field && !boxNote && (
          <Row label={`${item.name} →`} extraClass="pg-bag-pick">
            {targets.map(({ view, block, to }) => (
              <Button key={view.uid} secondary disabled={!!block} onClick={() => onInput({ kind: 'use-item', item: item.item, uid: view.uid })} title={block ?? `${view.name}에게 쓰기`}>
                <Sprite media={media} form={view.form} shiny={view.shiny} scale={1} crop={22} />
                {view.name} <span class="pg-sub">{block ?? (to ? `→ ${to}` : `HP ${view.hp}/${view.maxHp}`)}</span>
              </Button>
            ))}
          </Row>
        )}
      </div>
      {/* 칩은 여러 줄로 (새 물건이 생겨 18개면 한 줄 옆 스크롤 끝이 반 잘리던 것 — UX 리뷰어 2026-10-21) ·
          지금 진화할 수 있는 포켓몬이 있는 돌 · 끈 = 칩 오른쪽 위 ▲ (#148 — 칸 폭 · 줄 바꿈을 안 바꿈) */}
      <Row wrap extraClass="pg-bag-chips">
        {rows.map((r) => (
          <button
            key={r.item}
            type="button"
            class={`pg-chip${sel === r.item ? ' pg-chip-on' : ''}${r.field ? '' : ' pg-chip-dim'}${r.evolve ? ' pg-evo-mark' : ''}`}
            onClick={() => setSel(r.item)}
            title={r.evolve ? `▲ ${r.evolve}` : r.field ? (r.evolution ? '진화의 돌 — 진화하는 포켓몬에게' : '전투 밖에서 써요') : r.note}
          >
            <Icon name={ITEM_ICON[r.item]} /> {r.name} <b>{r.count}개</b>
          </button>
        ))}
      </Row>
    </Panel>
  );
}
