/**
 * S09 ⑦ 메뉴 한 줄 (1 공격 · 2 방어 · 3 스킬 · 4 아이템 · 5 교체 · 도망 — 숫자 키) · ⑧ 필살기 게이지 💥 (Z) · ⑪ 맞받아치기 (Space).
 * 내 행동 게이지가 다 차면 켜짐 (그 전에는 흐리게). 3 스킬 → 같은 줄이 기술 목록, ← · Esc 로 돌아감.
 * 쓰러지면 같은 줄이 "다음 포켓몬" (숫자 키).
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { canUlt, counterOpen, switchable, ultCounterOpen, type BattleState, type GameInput } from '../../../core/engine';
import type { Save } from '../../../core/save';
import { speciesOf } from '../../../data';
import { Button } from '../../../ui/Button';
import { menuItems, type MenuItem, type MenuPage } from '../model';

export interface BattleMenuProps {
  battle: BattleState;
  save: Save;
  onInput(input: GameInput): void;
  /** 줄 맨 앞에 붙는 것 (낮은 패널에서 자동 전투 스위치) */
  lead?: ComponentChildren;
  /** 좁은 패널 — 짧은 이름 */
  compact?: boolean;
}

/** ← · Esc — 기력의조각에서 고르던 포켓몬 목록은 아이템으로, 나머지는 처음 메뉴로 */
const backOf = (page: MenuPage): MenuPage => (page === 'revive' ? 'items' : 'main');

export function BattleMenu({ battle: b, save, onInput, lead, compact = false }: BattleMenuProps) {
  const [page, setPage] = useState<MenuPage>('main');
  // 차례가 끝나면 처음 메뉴로
  useEffect(() => {
    if (b.phase !== 'choose') setPage('main');
  }, [b.phase]);

  const items = menuItems(b, save, page, compact);
  const ultReady = canUlt(b) || ultCounterOpen(b);
  const ultCounter = ultCounterOpen(b);
  const counter = counterOpen(b);
  const picking = b.phase === 'pick';
  const team = picking ? switchable(b, save) : [];

  const choose = (i: MenuItem) => {
    if (!i.enabled) return;
    if ('page' in i.go) setPage(i.go.page);
    else if ('back' in i.go) setPage(backOf(page));
    else {
      onInput({ kind: 'battle', input: { kind: 'act', action: i.go.action } });
      setPage('main');
    }
  };
  const pick = (uid: string) => onInput({ kind: 'battle', input: { kind: 'pick', uid } });

  // 단축키: 숫자 = 메뉴 · 다음 포켓몬 · Z = 필살기 · ← / Esc / Backspace = 뒤로 (Space 는 main.ts — 맞받아치기 · 연타)
  // 듣는 건 한 번만 달고, 지금 값은 ref 로 (초당 30번 다시 그려도 다시 달지 않게)
  const now = useRef({ b, items, page, team, choose, pick, onInput });
  now.current = { b, items, page, team, choose, pick, onInput };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const c = now.current;
      // 한글 입력 상태면 e.key 가 'ㅋ' 이라 자판 자리 (code) 로
      if (e.code === 'KeyZ') {
        e.preventDefault();
        c.onInput({ kind: 'battle', input: { kind: 'ult' } });
        return;
      }
      if (c.b.phase === 'pick' && /^[1-9]$/.test(e.key)) {
        const m = c.team[Number(e.key) - 1];
        if (m) c.pick(m.uid);
        return;
      }
      if (c.b.phase !== 'choose') return;
      if (e.key === 'ArrowLeft' || e.key === 'Escape' || e.key === 'Backspace') {
        if (c.page !== 'main') {
          e.preventDefault();
          setPage(backOf(c.page));
        }
        return;
      }
      if (/^[1-9]$/.test(e.key)) {
        const it = c.items.find((x) => x.num === Number(e.key));
        if (it) {
          e.preventDefault();
          c.choose(it);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const renderItems = (list: MenuItem[]) =>
    list.map((i) => (
      <Button key={i.key} onClick={() => choose(i)} disabled={!i.enabled} secondary={'back' in i.go} title={i.title}>
        {i.label}
        {i.sub && <span class="pg-sub">{i.sub}</span>}
      </Button>
    ));
  // 포커스가 없으면 Space 는 편집기로 감 → 클릭 안내 (선제공격과 같은 규칙)
  const key = document.hasFocus() ? '(Space)' : '(클릭!)';

  // 처음 메뉴는 늘 깔아 두고 (안 쓸 때는 안 보이게) 그 위에 지금 줄을 얹음 — 줄이 바뀌어도 필살기 게이지 · 💥 자리가 그대로
  const onMain = page === 'main' && !ultCounter && !counter && !picking && b.phase !== 'clash' && b.phase !== 'over';
  let row: ComponentChildren = null;
  if (ultCounter) {
    row = (
      <Button onClick={() => onInput({ kind: 'space' })} title="Space · Z">
        {compact ? `💥 맞받아치기! ${key}` : `💥 필살기로 맞받아치기! ${key}`}
      </Button>
    );
  } else if (counter) {
    row = (
      <Button onClick={() => onInput({ kind: 'space' })} title="Space">
        {`⚡ 맞받아치기! ${key}`}
      </Button>
    );
  } else if (picking) {
    row = (
      <>
        <span class="pg-dim">다음:</span>
        {team.slice(0, 5).map((m, i) => (
          <Button key={m.uid} onClick={() => pick(m.uid)} title={`HP ${m.hp}`}>
            {`${i + 1} ${speciesOf(m.species)?.name.ko ?? m.form}`}
            <span class="pg-sub">Lv{m.level}</span>
          </Button>
        ))}
      </>
    );
  } else if (page !== 'main' && b.phase !== 'clash' && b.phase !== 'over') {
    row = renderItems(items);
  }

  return (
    <span class={`pg-bmenu${b.phase === 'choose' ? ' pg-my-turn' : ''}${compact ? ' pg-compact' : ''}`}>
      {/* 좁은 패널에서 기술 · 아이템을 고르는 동안은 앞 버튼 (자동 전투) 을 빼서 이름 자리를 넓힘 */}
      {compact && page !== 'main' ? null : lead}
      <span class="pg-bmenu-items pg-stack">
        <span class={onMain ? 'pg-layer' : 'pg-layer pg-hidden'} aria-hidden={!onMain}>
          {renderItems(page === 'main' ? items : menuItems(b, save, 'main', compact))}
        </span>
        {row && <span class={counter || ultCounter ? 'pg-layer pg-counter' : 'pg-layer'}>{row}</span>}
      </span>
      <span class={ultReady ? 'pg-bar pg-bar-myult pg-full' : 'pg-bar pg-bar-myult'} title="필살기 게이지 — 때리면 · 맞으면 참 (Z)">
        <span class="pg-bar-fill" style={{ width: `${Math.round(b.me.ult * 100)}%` }} />
      </span>
      <Button onClick={() => onInput({ kind: 'battle', input: { kind: 'ult' } })} disabled={!ultReady} title="필살기 (Z) — 게이지가 차 있으면 아무 때나 · 상대 기술에 끼어들기">
        {compact ? '💥' : '💥 Z'}
      </Button>
    </span>
  );
}
