/**
 * S09 ⑦ 메뉴 한 줄 (1 공격 · 2 방어 · 3 스킬 · 4 아이템 · 5 교체 · 도망 — 숫자 키) · ⑧ 필살기 게이지 💥 (Z) · ⑪ 맞받아치기 (Space).
 * 내 행동 게이지가 다 차면 켜짐 (그 전에는 흐리게). 3 스킬 → 같은 줄이 기술 목록, ← · Esc 로 돌아감.
 * 쓰러지면 같은 줄이 "다음 포켓몬" (숫자 키).
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { maxHpOf } from '../../../core/rules/bag';
import { canUlt, catchTriesUsed, counterOpen, itemLeft, lastChanceLimitMs, switchable, ultCounterOpen, type BattleState, type GameInput } from '../../../core/engine';
import { BALLS, type BallId } from '../../../core/rules/catch';
import { itemName } from '../../../core/rules/items';
import type { Save } from '../../../core/save';
import { speciesOf } from '../../../data';
import { Button } from '../../../ui/Button';
import { BALL_ICON } from '../../../ui/BallCount';
import { Icon } from '../../../ui/Icon';
import { catchView, menuItems, type MenuItem, type MenuPage } from '../model';

export interface BattleMenuProps {
  battle: BattleState;
  save: Save;
  onInput(input: GameInput): void;
  /** 줄 맨 앞에 붙는 것 (낮은 패널에서 자동 전투 스위치) */
  lead?: ComponentChildren;
  /** 좁은 패널 — 짧은 이름 · 'tiny' = 300px 아래 (번호 없는 두 글자) */
  compact?: boolean | 'tiny';
  /** 옆 메뉴 (세로 목록, Sea of Stars) — 머리 줄 이름표에 쓸 내 포켓몬 이름. 없으면 예전 가로 한 줄 */
  vertical?: string;
  /** 위 정보줄 자리 (좁고 낮은 패널) — 다음 포켓몬 고르기를 무대 위 세로 목록으로 */
  bar?: boolean;
}

/** ← · Esc — 기력의조각에서 고르던 포켓몬 목록은 아이템으로, 나머지는 처음 메뉴로 */
const backOf = (page: MenuPage): MenuPage => (page === 'revive' ? 'items' : 'main');

export function BattleMenu({ battle: b, save, onInput, lead, compact = false, vertical, bar = false }: BattleMenuProps) {
  const [page, setPage] = useState<MenuPage>('main');
  // 차례가 끝나면 처음 메뉴로
  useEffect(() => {
    if (b.phase !== 'choose') setPage('main');
  }, [b.phase]);

  const items = menuItems(b, save, page, compact);
  // 커서 (Sea of Stars 1f — 고를 줄이 늘 보임: ▸ + 밝은 줄, 아트 디렉터) · ↑ ↓ 로 옮기고 Enter 로 고름 · 페이지 · 차례가 바뀌면 첫 줄로
  const [cursor, setCursor] = useState(0);
  // 볼을 놓친 뒤 다음 차례는 커서를 "4 아이템" (볼이 있는 줄) 에 — 바로 Enter 로 다시 던지게 (ideas #131, 2026-10-21). 지난 차례의 볼 수를 기억해 비교
  const triesSeen = useRef(catchTriesUsed(b));
  useEffect(() => {
    const tries = catchTriesUsed(b);
    const missed = page === 'main' && b.phase === 'choose' && tries > triesSeen.current;
    if (b.phase === 'choose') triesSeen.current = tries;
    const itemsAt = items.findIndex((i) => i.key === 'items' && i.enabled);
    setCursor(missed && itemsAt >= 0 ? itemsAt : 0);
  }, [page, b.phase]);
  const enabledIdx = items.map((it, k) => (it.enabled ? k : -1)).filter((k) => k >= 0);
  const onIdx = enabledIdx.includes(cursor) ? cursor : (enabledIdx[0] ?? -1);
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
  const now = useRef({ b, items, page, team, choose, pick, onInput, balls: [] as readonly BallId[], onIdx, enabledIdx, cursor });
  now.current = { b, items, page, team, choose, pick, onInput, balls: BALLS.filter((ball) => itemLeft(b, save, ball) > 0), onIdx, enabledIdx, cursor };
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
      if (c.b.phase === 'last') {
        // 숫자 = 볼 (1 ~) · 그다음 숫자 = 안 던짐 (2026-10-19 태현 님 — 숫자 패드로도) · Esc = 안 던짐 · ↑ ↓ + Enter = 커서 (다른 판과 같게 — 아트 디렉터 5차)
        const rows = c.balls.length + 1;
        const n = /^[1-9]$/.test(e.key) ? Number(e.key) : 0;
        const ball = c.balls[n - 1];
        if (ball) c.onInput({ kind: 'battle', input: { kind: 'ball', ball } });
        else if (n === rows || e.key === 'Escape') c.onInput({ kind: 'battle', input: { kind: 'no-ball' } });
        else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          setCursor((Math.min(c.cursor, rows - 1) + (e.key === 'ArrowDown' ? 1 : rows - 1)) % rows);
        } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
          e.preventDefault();
          const at = c.balls[Math.min(c.cursor, rows - 1)];
          c.onInput({ kind: 'battle', input: at ? { kind: 'ball', ball: at } : { kind: 'no-ball' } });
        }
        return;
      }
      if (c.b.phase === 'pick') {
        // 다음 포켓몬 — 숫자 · ↑ ↓ + Enter (다른 메뉴와 같은 커서, 아트 디렉터 4차)
        const n = c.team.length;
        if (/^[1-9]$/.test(e.key)) {
          const m = c.team[Number(e.key) - 1];
          if (m) c.pick(m.uid);
        } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && n > 0) {
          e.preventDefault();
          setCursor((Math.min(c.cursor, n - 1) + (e.key === 'ArrowDown' ? 1 : n - 1)) % n);
        } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
          const m = c.team[Math.min(c.cursor, n - 1)];
          if (m) {
            e.preventDefault();
            c.pick(m.uid);
          }
        }
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
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const list = c.enabledIdx;
        if (list.length === 0) return;
        e.preventDefault();
        const at = Math.max(0, list.indexOf(c.onIdx));
        setCursor(list[(at + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length]!);
        return;
      }
      // 버튼에 포커스가 있으면 Enter 는 그 버튼이 받음 (두 번 고르지 않게)
      if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        const it = c.items[c.onIdx];
        if (it) {
          e.preventDefault();
          c.choose(it);
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
    list.map((i, k) => (
      <Button key={i.key} extraClass={b.phase === 'choose' && list === items && k === onIdx ? 'pg-on' : undefined} onClick={() => choose(i)} disabled={!i.enabled} secondary={'back' in i.go} title={i.title}>
        {i.label}
        {(vertical ? (i.subShort ?? i.sub) : i.sub) && <span class="pg-sub">{vertical ? (i.subShort ?? i.sub) : i.sub}</span>}
      </Button>
    ));
  // 포커스가 없으면 Space 는 편집기로 감 → 클릭 안내 (선제공격과 같은 규칙)
  const key = document.hasFocus() ? '(Space)' : '(클릭!)';

  // 처음 메뉴는 늘 깔아 두고 (안 쓸 때는 안 보이게) 그 위에 지금 줄을 얹음 — 줄이 바뀌어도 필살기 게이지 · 💥 자리가 그대로
  const onMain = page === 'main' && !ultCounter && !counter && !picking && b.phase !== 'clash' && b.phase !== 'over' && b.phase !== 'catch' && b.phase !== 'last';
  const balls = BALLS.filter((ball) => itemLeft(b, save, ball) > 0);
  let row: ComponentChildren = null;
  if (ultCounter) {
    row = (
      <Button onClick={() => onInput({ kind: 'space' })} title="Space · Z">
        {compact || vertical ? `맞받아치기! ${key}` : `필살기로 맞받아치기! ${key}`}
      </Button>
    );
  } else if (counter) {
    // 막기 (패링, 2026-10-19 태현 님) — 아무 때나 누르면 너무 일러 못 막음 → "기다렸다가" 를 글로. 누르면 그 순간 Space 와 같음 (엔진이 시간으로 판정)
    row = (
      <Button onClick={() => onInput({ kind: 'space' })} title="날아오는 공격에 원이 좁혀질 때 Space · 클릭 — 막으면 피해 절반, 딱 맞으면 0">
        {`막기 — 원이 좁혀질 때 ${document.hasFocus() ? 'Space' : '클릭'}`}
      </Button>
    );
  } else if (picking && vertical === undefined) {
    // 가로 한 줄 메뉴 (좁은 패널) — 고르는 동안만 무대 위에 세로 목록: 번호 · 이름 · HP 막대 · HP (2026-10-21 태현 님 A — 칸 다섯이 "1 캐… 2 어…" 로 잘려 누구를 낼지 모르던 것).
    //   위 정보줄 메뉴면 위에서 · 무대 안 가로 줄이면 아래에 붙음 (위쪽 말 칸 "○○가 쓰러졌다! 다음 포켓몬을 골라요" 를 가리지 않게)
    row = (
      <span class={`pg-pick-list${bar ? '' : ' pg-pick-list-low'}`}>
        <span class="pg-pick-title">다음 포켓몬 고르기</span>
        {team.slice(0, 5).map((m, i) => (
          <Button key={m.uid} extraClass={i === Math.min(cursor, team.length - 1) ? 'pg-on' : undefined} onClick={() => pick(m.uid)} title={`${i + 1} · HP ${m.hp}/${maxHpOf(m)}`}>
            <span class="pg-pick-n">{i + 1}</span>
            <span class="pg-pick-name">{speciesOf(m.species)?.name.ko ?? m.form}</span>
            <span class="pg-pick-hp">
              <i style={{ width: `${Math.round((m.hp / maxHpOf(m)) * 100)}%` }} />
            </span>
            <span class="pg-sub">
              {m.hp}/{maxHpOf(m)}
            </span>
          </Button>
        ))}
      </span>
    );
  } else if (picking) {
    row = (
      <>
        {team.slice(0, 5).map((m, i) => (
          <Button key={m.uid} extraClass={i === Math.min(cursor, team.length - 1) ? 'pg-on' : undefined} onClick={() => pick(m.uid)} title={`HP ${m.hp}`}>
            {`${i + 1} ${speciesOf(m.species)?.name.ko ?? m.form}`}
            <span class="pg-sub">HP {m.hp}/{maxHpOf(m)}</span>
          </Button>
        ))}
      </>
    );
  } else if (b.phase === 'last') {
    // S11 마지막 기회 — 볼 고르기 (가진 것만) · 안 던짐 · 남은 시간
    row = (
      <>
        {/* 남은 초 = 제목 옆 "3초" (따로 한 줄에 "3" 만 있으면 "3 안 던짐" 과 헷갈림 — 2026-10-19 전체 점검) */}
        {/* 좁은 패널 (300px 아래) 은 "마지막 기회!" 를 빼고 "6초" 만 — 볼 칸이 "1 몬스…" 로 잘리던 것 (UX 리뷰어 2026-10-21) */}
        <span class="pg-last-tag">
          <span class="pg-last-word">마지막 기회! </span>

          <span class="pg-last-sec" title="안 고르면 그냥 지나가요">
            {/* 자동 전투 (이로치 아님) 는 3초 — 엔진과 같은 lastChanceLimitMs (UX 리뷰어: 6초로 세다 4초에서 끝나던 것) */}
            {Math.max(0, Math.ceil((lastChanceLimitMs(b, save.settings.autoBattle) - b.lastMs) / 1000))}초
          </span>
        </span>
        {balls.map((ball, i) => (
          <Button key={ball} extraClass={i === Math.min(cursor, balls.length) ? 'pg-on' : undefined} onClick={() => onInput({ kind: 'battle', input: { kind: 'ball', ball } })} title="쓰러진 포켓몬 — 잡을 확률 절반">
            {/* 볼 그림 + 개수 — 좁은 패널 (360px 아래) 은 이름을 빼서 "1 ◓ 3개" (이름 · 개수가 잘리던 것) */}
            {`${i + 1} `}
            <Icon name={BALL_ICON[ball]} />
            <span class="pg-ball-word"> {itemName(ball)}</span>
            <span class="pg-sub">{itemLeft(b, save, ball)}개</span>
          </Button>
        ))}
        <Button extraClass={Math.min(cursor, balls.length) === balls.length ? 'pg-on' : undefined} onClick={() => onInput({ kind: 'battle', input: { kind: 'no-ball' } })} title={`${balls.length + 1} · Esc`}>
          {`${balls.length + 1} 안 던짐`}
        </Button>
      </>
    );
  } else if (b.phase === 'catch' && b.catch) {
    // S11 타이밍 원 — 원이 딱 맞을 때 Space (클릭도 됨)
    // 던진 뒤 = 지금 장면 한 줄 (2026-10-20 — 누른 때 = 던짐)
    const stage = catchView(b)?.stage;
    row =
      stage === 'ring' ? (
        <Button onClick={() => onInput({ kind: 'space' })} title="원이 안쪽 원에 딱 맞을 때">
          {/* 옆 메뉴는 칸이 좁아 짧게 (×3 패널에서 "원이 딱 맞을 때 (…" 로 잘리던 것) */}
          {vertical ? `딱 맞을 때 ${document.hasFocus() ? 'Space' : '클릭'}` : `원이 딱 맞을 때 ${key}`}
        </Button>
      ) : (
        <span class="pg-dim">{stage === 'shake' ? '흔들… 흔들…' : stage === 'end' ? (b.catch.caught ? '딸깍!' : '앗!') : '던졌다!'}</span>
      );
  } else if (page !== 'main' && b.phase !== 'clash' && b.phase !== 'over') {
    row = renderItems(items);
  }

  // 옆 메뉴에서 다음 포켓몬 · 마지막 기회 · 잡기 원은 처음 메뉴 층을 아예 빼서 판이 줄 수 · 글 길이만큼 (5줄 높이에 한 줄이 떠 있고 "원이 딱 맞을 때 (…" 로 잘리던 것)
  const gone = vertical !== undefined && (picking || b.phase === 'last' || b.phase === 'catch');
  const stack = (
    <span class="pg-bmenu-items pg-stack">
      <span class={onMain ? 'pg-layer' : gone ? 'pg-layer pg-hidden pg-gone' : 'pg-layer pg-hidden'} aria-hidden={!onMain}>
        {renderItems(page === 'main' ? items : menuItems(b, save, 'main', compact))}
      </span>
      {row && <span class={counter || ultCounter ? 'pg-layer pg-counter' : 'pg-layer'}>{row}</span>}
    </span>
  );
  // 필살기 Z 배지 (2026-10-19 태현 님 "Z 가 잘 안 보여 · 눈에 확 보였으면 · 다 차면 반짝반짝") — 18px 키 모양 칸 안이 게이지만큼 주황으로 차오름,
  // 다 차면 금색 채움 + 한 번 톡 커짐 + 빛 줄기 + 반짝 별 셋 (game.css .pg-ultz). 게이지 막대 대신 이 칸 하나
  const ultPct = Math.round(b.me.ult * 100);
  const ultBadge = (
    <button
      type="button"
      class={ultReady ? 'pg-ultz pg-ultz-ready' : 'pg-ultz'}
      disabled={!ultReady}
      onClick={() => onInput({ kind: 'battle', input: { kind: 'ult' } })}
      title={ultReady ? '필살기 (Z) — 지금 쓸 수 있어요 · 아무 때나 · 상대 기술에 끼어들기' : `필살기 게이지 ${ultPct}% — 때리면 · 맞으면 참 (Z)`}
    >
      <span class="pg-ultz-fill" style={{ height: `${ultReady ? 100 : ultPct}%` }} />
      <span class="pg-ultz-key">Z</span>
      {ultReady && (
        <>
          <span class="pg-ultz-shine" />
          <span class="pg-ultz-spark pg-ultz-s1">
            <Icon name="twinkle" />
          </span>
          <span class="pg-ultz-spark pg-ultz-s2">
            <Icon name="twinkle" />
          </span>
          <span class="pg-ultz-spark pg-ultz-s3">
            <Icon name="twinkle" />
          </span>
        </>
      )}
    </button>
  );

  // 옆 메뉴 (Sea of Stars): 판 위로 튀어나온 탭 줄 = 금색 이름표 (왼쪽) · 필살기 게이지 + Z (오른쪽), 그 아래 판에 세로 목록 (5줄 넘으면 옆 칸).
  // 고를 수 없는 동안 (상대 차례 · 연출 · 힘대결 · 끝) 은 판을 접고 탭 줄만 — 싸우는 그림을 가리지 않게 (아트 디렉터)
  if (vertical) {
    const open = b.phase === 'choose' || row !== null;
    return (
      <div class={`pg-vmenu${b.phase === 'choose' ? ' pg-my-turn' : ''}`}>
        <div class="pg-vmenu-tabs">
          {/* 고르는 동안 이름표 = "교체" (쓰러진 포켓몬 이름이 남아 있던 것) */}
          <span class="pg-vmenu-name">{picking ? '교체' : vertical}</span>
          <span class="pg-vmenu-ult">{ultBadge}</span>
        </div>
        {(open || lead) && (
          <div class="pg-vmenu-box">
            {lead && <div class="pg-vmenu-lead">{lead}</div>}
            {open && stack}
          </div>
        )}
      </div>
    );
  }

  return (
    <span class={`pg-bmenu${b.phase === 'choose' ? ' pg-my-turn' : ''}${compact ? ' pg-compact' : ''}`}>
      {/* 좁은 패널에서 기술 · 아이템을 고르는 동안은 앞 버튼 (자동 전투) 을 빼서 이름 자리를 넓힘 */}
      {compact && page !== 'main' ? null : lead}
      {stack}
      {ultBadge}
    </span>
  );
}
