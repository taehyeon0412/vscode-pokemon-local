/**
 * S12 전투 결과 (gdd S12) — ① 경험치 · ② 돈 · ③ 아이템 · ④ 레벨업 · ⑥ 새 기술 · ⑤ 계속 (Space · Enter · 클릭).
 * 잠깐 보여 주고 저절로 넘어감 (자동 전투로 둬도 멈추지 않게) — 고를 것이 있으면 S23 · S22 로.
 * 모양 = 전투와 같은 판 (단계 12): 받은 것은 금색 글자 + 픽셀 아이콘, 레벨업 ▲ · 새 기술 ★
 * ④ 레벨업 = 왼쪽 얼굴 카드 (누르면 · P = 내 포켓몬 판에서 그 포켓몬 스탯 찍기) + 스탯을 찍어 본 적이 없으면 안내 말풍선 (2026-10-20 태현 님 B + 말풍선)
 * 잡았으면 결과 상자 전에 가운데 소개 카드 1.5초 (2026-10-20 태현 님 안 2)
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { BALANCE, TIMING } from '../../../core/balance';
import type { BattleSummary, GameInput } from '../../../core/engine';
import { Button } from '../../../ui/Button';
import { KeyCap } from '../../../ui/KeyCap';
import { Icon } from '../../../ui/Icon';
import { Sprite } from '../../../ui/Sprite';
import { speciesOf } from '../../../data';
import { spriteBoxOf } from '../../../data/sprite-boxes';
import { TypeTags } from '../../battle/components/TypeTag';
import { ITEM_ICON, stars } from '../../menu/model';
import { itemName, VALUABLES } from '../../../core/rules/items';
import type { CaughtStone } from '../../../core/rules/evo-tip';
import { ITEM_IDS, type ItemId } from '../../../core/save';
import { partText, resultTitleShown, summaryLines, type CaughtView, type LevelUpView, type SummaryPart } from '../model';

/** 잡은 포켓몬 소개 카드 — 결과 상자 전 3초 (TIMING.caughtIntroMs), 잡기 흔들기 창이 꺼지지 않고 같은 가운데 · 같은 높이에서 가로로 넓어지며 볼이 열리고 포켓몬이 나옴 (2026-10-20 태현 님 "잡았다 창이 너무 빨리 꺼져" → B) · 집중 모양 (둘레 어둡게 · 2px 금색 · 이름표 "잡았다!") · 그림 크게 · 처음 잡았으면 그림 칸 모서리 NEW! 칩 (도감 화면은 다음 버전) · 이름 Lv · 타입 · 팀 / 보관함. 누르면 넘김 (2026-10-20 태현 님 안 2) */
function CaughtIntro({ c, media, at, onSkip }: { c: CaughtView; media: string; at: { left: number; top: number; width?: number }; onSkip(): void }) {
  const types = speciesOf(c.species)?.types ?? [];
  // 그림 칸 64 — 실제 그림 (sprite-boxes) 이 칸을 채우는 가장 큰 정수 배 (위아래 1칸 여유, 1 ~ 3배)
  const box = spriteBoxOf(c.form);
  const zoom = box ? Math.max(1, Math.min(3, Math.floor(62 / Math.max(box[2] - box[0], box[3] - box[1])))) : 2;
  return (
    // 둘레 덮개 (잡기 창의 덮개를 이어받음) — 어디를 눌러도 넘김
    <div class="pg-caught-dim" onClick={onSkip} title="클릭 · Space · Enter — 넘기기">
      {/* --pg-open = 잡기 창 폭 104 에서 넓어질 때 양쪽에서 여는 만큼 · 볼이 옮겨 오는 거리 */}
      <div class="pg-caught-intro" style={{ left: `${at.left}px`, top: `${at.top}px`, ...(at.width !== undefined ? { width: `${at.width}px` } : {}), '--pg-open': `${Math.round(((at.width ?? 248) - 104) / 2)}px` }}>
        <span class="pg-caught-title">잡았다!</span>
        {/* 큰 볼 — 잡기 창 볼 자리 (가운데 · 위 18) 에서 창이 넓어지는 동안 그림 칸으로 옮겨 감 → 두 번 덜컹 → 1.2초 뚜껑이 들린 열린 볼 (빛살) 0.8초 → 2초에 금색 고리와 포켓몬
            (2026-10-20 태현 님 "볼이 열리는 연출이 너무 짧아 인지가 안 돼 — 좀 느리게 해도 돼") */}
        <span class="pg-caught-ball">
          <Icon name="ballBig" px={2} />
        </span>
        <span class="pg-caught-ball pg-caught-ball-open">
          <Icon name="ballBigOpen" px={2} />
        </span>
        <span class="pg-caught-art">
          <span class="pg-caught-mon">
            <Sprite media={media} form={c.form} shiny={c.shiny} scale={1} crop={64} zoom={zoom} center />
          </span>
          <i class="pg-caught-burst" aria-hidden="true" />
          {/* NEW! = 그림 칸 오른쪽 위 모서리 칩 (레벨업 카드 "+4" 와 같은 부품) · 올리면 "처음 잡았다" — 글 칸 첫 줄 "NEW! 처음 잡았다" 가 탭 "잡았다!" 와 겹쳐 두 번 읽히던 것 (ideas 1619 · 기획 10-28) */}
          {c.isNew && (
            <span class="pg-caught-new" title="처음 잡았다">
              NEW!
            </span>
          )}
          <i class="pg-lvup-spark pg-lvup-spark-1" aria-hidden="true" />
          <i class="pg-lvup-spark pg-lvup-spark-2" aria-hidden="true" />
        </span>
        <span class="pg-caught-info">
          <b class="pg-caught-name">
            {c.name} <span class="pg-dim">Lv{c.level}</span>
          </b>
          {/* ★ 등급 (orders #120 — 보관함에 가야 보이던 것) · 이름 바로 아래 · 보관함 · 프로필과 같은 ★ 모양 */}
          <span class="pg-star pg-caught-star" title="개체값 등급 (★ 많을수록 타고난 힘이 셈)">
            {stars(c.star)}
          </span>
          <TypeTags types={types} />
          <span class="pg-caught-where">{c.toBox ? '팀이 다 차서 보관함으로' : '팀에 들어옴'}</span>
        </span>
      </div>
    </div>
  );
}

/** 보물 이름 → 그 물건 아이콘 (없으면 선물) */
const treasureIcon = (name: string) => {
  const id = ITEM_IDS.find((i) => itemName(i) === name);
  return id ? ITEM_ICON[id] : 'gift';
};

/** 잡은 포켓몬이 보관함으로 갈 때 칸 앞말 (result/model summaryLines 와 같은 글) */
const TO_BOX_LEAD = '팀이 다 차서 ';

/** 첫 줄 받은 것 — 라이벌 보상 (돈 ×1.5 · 아이템) 은 ★ 금색 (gdd 4.12 — 글을 늘리면 좁은 패널에서 잘려서 표시로만) */
function Reward({ p, rare }: { p: SummaryPart; rare: boolean }) {
  // 받은 물건 (첫 승 리프의돌 · 보물) = 그 물건 그림 + 쓰는 곳 (공통 선물 그림 · 설명 없음이던 것 — 개발 UX #70, 배지 카드에서 칩을 뺀 f5b4ea5 뒤)
  const id = p.kind === 'item' || p.kind === 'treasure' ? ITEM_IDS.find((i) => itemName(i) === p.text) : undefined;
  return (
    <span class={rare && p.kind !== 'caught' ? 'pg-reward pg-reward-rare' : 'pg-reward'} title={id ? `${p.text} — ${VALUABLES.includes(id) ? '상점에서 팔아요' : '가방에서 써요'}` : undefined}>
      <Icon name={p.kind === 'caught' ? 'ball' : p.kind === 'money' ? 'coin' : p.kind === 'treasure' || p.kind === 'item' ? treasureIcon(p.text) : 'gift'} />{' '}
      {/* 팀이 다 차서 — 칸이 넘치면 "뷰티플라이 → 보관함" 만 (ResultBox whyOff · 240 에서 "팀이 다 차서 뷰티플라이 …" 로 잘리던 것 — UX U4) */}
      {p.kind === 'caught' && p.text.startsWith(TO_BOX_LEAD) ? (
        <>
          <span class="pg-caught-why">{TO_BOX_LEAD}</span>
          {p.text.slice(TO_BOX_LEAD.length)}
        </>
      ) : (
        p.text
      )}
    </span>
  );
}

/** 둘째 줄 — 레벨업 ▲ · 새 기술 ★ (금색) · 라이벌 한마디는 따옴표 */
function Line({ p }: { p: SummaryPart }) {
  if (p.kind === 'up' || p.kind === 'learned') {
    return (
      <>
        {/* ▲ · ★ 와 글을 줄 바꿈으로 떼지 않게 */}
        <span class="pg-up">{p.kind === 'up' ? '▲' : '★'}</span>
        {'\u00a0'}
        {p.text}
      </>
    );
  }
  return <>{p.kind === 'quote' ? `“${p.text}”` : p.text}</>;
}

/** 얼굴 카드 (최대 셋) — 포켓몬 그림 (길 위 크기) · 왼쪽 아래 Lv · 오른쪽 위 +남은 포인트 · 2px 금색 테두리 = 버튼. hint = 첫 포인트 카드 아래 말풍선 */
function FaceCards({ ups, media, hint, onStats }: { ups: LevelUpView[]; media: string; hint: boolean; onStats(uid: string): void }) {
  const shown = ups.slice(0, 3);
  const hintAt = shown.find((u) => u.points > 0)?.uid;
  return (
    <>
      {shown.map((u) => (
        <button key={u.uid} type="button" class="pg-lvup-card" onClick={() => onStats(u.uid)} title={`${u.name} Lv ${u.from} → ${u.to} — 스탯 찍기 (P)`}>
          <Sprite media={media} form={u.form} shiny={u.shiny} scale={1} crop={40} fieldSize center />
          {/* "Lv7" — ▲7 은 +7 로도 읽혀서 (아트 디렉터 7차 제안 · 2026-10-20 태현 님) */}
          <span class="pg-lvup-card-lv">Lv{u.to}</span>
          {u.points > 0 && <span class="pg-lvup-card-pts">+{u.points}</span>}
          <i class="pg-lvup-spark pg-lvup-spark-1" aria-hidden="true" />
          <i class="pg-lvup-spark pg-lvup-spark-2" aria-hidden="true" />
          {/* 처음 배울 때까지 — 카드 아래 말풍선이 카드를 가리킴 (스탯을 한 번 찍으면 안 나옴) */}
          {hint && u.uid === hintAt && (
            <span class="pg-lvup-hint">
              <span class="pg-lvup-hint-verb">눌러서 </span>스탯 찍기
            </span>
          )}
        </button>
      ))}
      {/* 넷째부터 = "+N" (카드는 셋까지 — 4 ~ 6마리 레벨업이면 넷째부터 화면에 없던 것, 개발 UX #70) · 이름은 title */}
      {ups.length > 3 && (
        <span class="pg-lvup-more" title={ups.slice(3).map((u) => `${u.name} Lv ${u.to}`).join(' · ')}>
          +{ups.length - 3}
        </span>
      )}
    </>
  );
}

/**
 * 넘치면 한 단계 (ux-rules U4 — 폭 경계를 손으로 고르지 않음): 첫 줄 얻은 것 (돈 · 물건 칩) 이 맥 여유 1.1 로 안 들어가면 번갈아 줄 (pg-result-tight) 로.
 * 칩이 더 필요한 폭 (원래 폭 × 1.1 − 지금 폭) 을 제목이 줄 수 있는 만큼 (지금 폭 − 최소 폭) 과 견줌 — 경계 460 고정이라 관장 첫 승 상자가 461 ~ 579 에서 "+300…" · "리프…" 로 잘리던 것 (#70 개발 UX 큼)
 * 그래도 넘치면 (첫 줄 버튼 · 칩 × 1.1 + 제목 최소 폭이 줄보다 넓음 · 상자가 패널 아래로) 얼굴 카드를 한 장만 (one — 빠진 레벨업은 pg-alt-ups) —
 * 경계 260 고정이라 261 ~ 330 레벨업 3마리 이상 · 진화 버튼에서 "계속 ▶" · "▶ 어…?" 가 넘치고 6마리면 상자가 패널보다 높던 것 (#70 개발 UX 다시 보기 큼 1 · U4 다섯 번째)
 * 그래도 상자가 패널 아래로 넘치고 둘째 차례에 진화 줄이 있으면 (short) 둘째 차례에서 1 = 빠진 레벨업 · 2 = ★ · 경험치까지 뺌 (진화 줄만 — 전부는 상자 title) —
 * 돌 줄 (#131) 이 둘째 차례에 두 줄을 더해 240 × 150 맥 · 보관함 이브이 + 레벨업 둘에서 5줄 → 상자 아래가 패널 밖이던 것 (#131 UX 큼 1)
 */
function useResultFit(): { box: { current: HTMLDivElement | null }; on: boolean; one: boolean; short: number } {
  const box = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const [one, setOne] = useState(false);
  const [short, setShort] = useState(0);
  // 한 번에 한 단계 — 칩 번갈아 줄 (on) 이 먼저, 그 판에서도 첫 줄이 넘치면 카드 한 장 (one) (카드를 먼저 빼면 461 ~ 598 에서 칩이 첫 줄에 남고 카드 둘이 빠지던 것)
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const line = el.querySelector<HTMLElement>('.pg-line');
    // 제목 없는 상자 (트레이너 — 숫자만, resultTitleShown) 는 줄의 남는 폭이 칩이 늘 자리
    const title = line?.querySelector<HTMLElement>('.pg-result-title') ?? null;
    if (!line || line.clientWidth === 0) return;
    const minW = (c: HTMLElement) => parseFloat(getComputedStyle(c).minWidth) || 0;
    const kids = [...line.children].filter((c): c is HTMLElement => c instanceof HTMLElement && c.offsetWidth > 0);
    const gap = parseFloat(getComputedStyle(line).columnGap) || 0;
    if (!on) {
      let need = 0;
      line.querySelectorAll<HTMLElement>(':scope > .pg-reward').forEach((c) => {
        if (c.offsetWidth > 0) need += c.scrollWidth * 1.1 - c.clientWidth;
      });
      const room = title ? title.getBoundingClientRect().width - minW(title) : line.clientWidth - kids.reduce((w, c) => w + c.getBoundingClientRect().width, 0) - gap * Math.max(0, kids.length - 1);
      if (need > Math.max(0, room) + 0.5) {
        setOn(true);
        return;
      }
    }
    const over = () => el.getBoundingClientRect().bottom > window.innerHeight - 1;
    if (!one && el.classList.contains('pg-lvup')) {
      // 첫 줄 = 제목 (최소 폭까지 줄어듦) + 보이는 칩 · 버튼 (내용 실제 너비 × 1.1) + 칸 사이 gap
      const need = kids.reduce((w, c) => w + (c === title ? minW(c) : c.scrollWidth * 1.1), 0) + gap * Math.max(0, kids.length - 1);
      if (need > line.clientWidth + 0.5 || over()) {
        setOne(true);
        return;
      }
    }
    // 둘째 차례가 보일 때만 (넓으면 번갈아 줄이 display none — 줄 수가 아니라 상자 아래로 잼, 맥 글꼴도 그 자리에서 잰 값)
    const altB = el.querySelector<HTMLElement>('.pg-result-alt-b');
    if (short < 2 && altB && altB.getClientRects().length > 0 && altB.querySelector('.pg-evo-note') && over()) setShort(short + 1);
  });
  useEffect(() => {
    const reset = () => {
      setOn(false);
      setOne(false);
      setShort(0);
    };
    window.addEventListener('resize', reset);
    return () => window.removeEventListener('resize', reset);
  }, []);
  return { box, on, one, short };
}

/** next = 이어서 고를 것 (맨 앞) — 버튼에 다음 할 일 · ups = 레벨업한 포켓몬 (result/model levelUps) · onStats = 내 포켓몬 판 (그 포켓몬) */
export function ResultBox({ summary, next, ups, hint = false, caught = null, ms = 0, introAt = { left: 0, top: 0 }, evoItem = null, stones = [], media, onInput, onStats }: { summary: BattleSummary; next: 'learn' | 'evolve' | null; ups: LevelUpView[]; /** 얼굴 카드 안내 말풍선 (needsStatHint) */ hint?: boolean; /** 진화 아이템 두 번째부터 (#125) — 얻은 아이템 id (한 줄 그림) */ evoItem?: ItemId | null; /** 막 잡은 포켓몬을 진화시킬 가방의 돌 (#131 — 그릴 때 지금 세이브로 다시 센 것 · summary.caught.stones 는 결과가 났을 때 신호라 놓아주거나 돌을 쓰면 낡음) */ stones?: readonly CaughtStone[]; /** 잡은 포켓몬 — 처음 caughtIntroMs 동안 소개 카드만 */ caught?: CaughtView | null; /** 결과 단계 지난 ms */ ms?: number; /** 소개 카드 자리 (길 칸 기준 정수 px) */ introAt?: { left: number; top: number; width?: number }; media: string; onInput(i: GameInput): void; onStats(uid: string): void }) {
  const tight = useResultFit();
  // 제목 없는 상자 (트레이너) 번갈아 칸의 경험치 장면 줄이기 (넘치면 한 단계 · 맥 여유 10%) — 0 = 이름 · 1 = 숫자만 · 2 = "+102 ×3" / "+25 ~ +51"
  //   (240 × 150 세 자리 경험치 "경험치 +102 · +102 · +1…" 이 버튼 밑으로 잘리던 것 — 개발 #98 11판 3판 · U4 "넘치면 한 단계" · 폭 경계를 손으로 고르지 않음)
  const [expStep, setExpStep] = useState(0);
  useLayoutEffect(() => {
    const inner = tight.box.current?.querySelector<HTMLElement>('.pg-result-alt-in');
    const bEl = inner?.querySelector<HTMLElement>('.pg-result-alt-b');
    if (!inner || !bEl || inner.clientWidth === 0 || expStep >= 2) return;
    const r = document.createRange();
    r.selectNodeContents(bEl);
    if (r.getBoundingClientRect().width * 1.1 > inner.clientWidth + 0.5) setExpStep(expStep + 1);
  });
  // 넓은 둘째 줄 돌 줄 끝 " · [B] 가방" (#131 UX — 할 일) — 줄이 맥 여유 1.1 로 안 들어가면 뺌 (★ · 경험치가 … 로 잘리지 않게 · 넘치면 한 단계)
  const [howOff, setHowOff] = useState(false);
  useLayoutEffect(() => {
    const body = tight.box.current?.querySelector<HTMLElement>('.pg-result-body');
    if (howOff || !body || body.clientWidth === 0 || !body.querySelector('.pg-evo-how')) return;
    const r = document.createRange();
    r.selectNodeContents(body);
    if (r.getBoundingClientRect().width * 1.1 > body.clientWidth + 0.5) setHowOff(true);
  });
  // 보관함 칸이 넘치면 앞말 "팀이 다 차서" 를 뺌 ("뷰티플라이 → 보관함") — 넘치면 한 단계 · 내용 실제 너비 (240 ~ 280 에서 "팀이 다 차서 뷰티플라이 …" 로 이름이 잘리던 것, bugs 2630 UX U4)
  const [whyOff, setWhyOff] = useState(false);
  useLayoutEffect(() => {
    if (whyOff) return;
    for (const why of tight.box.current?.querySelectorAll<HTMLElement>('.pg-caught-why') ?? []) {
      const cell = why.closest<HTMLElement>('.pg-reward');
      if (!cell || cell.clientWidth === 0) continue;
      // 잘리는 곳은 칸 자신이 아니라 바깥 칸 (번갈아 줄 · 첫 줄) — 내용 실제 오른쪽 끝을 바깥 칸 안쪽 끝과 견줌
      const host = cell.closest<HTMLElement>('.pg-result-alt-a, .pg-line') ?? cell;
      const r = document.createRange();
      r.selectNodeContents(cell);
      const hostRight = host.getBoundingClientRect().right - parseFloat(getComputedStyle(host).paddingRight);
      if (cell.scrollWidth > cell.clientWidth + 0.5 || r.getBoundingClientRect().right > Math.min(hostRight, cell.getBoundingClientRect().right) + 0.02) {
        setWhyOff(true);
        return;
      }
    }
  });
  useEffect(() => {
    const reset = () => {
      setExpStep(0);
      setWhyOff(false);
      setHowOff(false);
    };
    window.addEventListener('resize', reset);
    return () => window.removeEventListener('resize', reset);
  }, []);
  if (caught && ms < TIMING.caughtIntroMs) return <CaughtIntro c={caught} media={media} at={introAt} onSkip={() => onInput({ kind: 'result-continue' })} />;
  const { title, head, body } = summaryLines(summary);
  // 트레이너를 이긴 판 = 제목 없이 숫자만 (띠 · 전투 한 줄이 이미 "…승부에서 이겼다!" — 기획 판단 10-26) · 마우스를 올리면 (title) 전체
  const showTitle = resultTitleShown(summary);
  // 찍을 포인트가 있는 카드를 앞으로 — 넘쳐서 카드 한 장만 보일 때 (tight.one) 포인트 카드 · 말풍선이 숨지 않게 (2026-10-21)
  const cards = [...ups].sort((a, b) => Number(b.points > 0) - Number(a.points > 0));
  // 진화 한 줄도 (둘째 줄이 넘쳐 잘리는 날 올려서 볼 길 — UX #125 3바퀴)
  // 막 잡은 포켓몬이 가방의 진화의 돌로 진화할 수 있으면 (#131 — stones = 그릴 때 다시 센 것) "피카츄 → 라이츄 진화 가능" · 여럿이면 "외 N" (이브이) · 보관함으로 갔으면 " · 팀에 넣고" (가방은 팀에만 — evoUsersLine 과 같은 말)
  //   — 진화 아이템 한 줄 (#125) 과 같은 말 · 같은 자리 · 같은 종을 또 잡아도 그때마다 (짧고 그때 쓸모 있는 말)
  //   "진화 가능" · "팀에 넣고" 는 붙여 씀 (240 에서 "라플레시아 진화 / 가능" 으로 나뉘던 것 — UX #131)
  const stoneText = summary.caught && stones.length > 0 ? `${summary.caught.name} → ${stones[0]!.toName} 진화\u00a0가능${stones.length > 1 ? ` 외\u00a0${stones.length - 1}` : ''}${summary.caught.toBox ? '\u00a0· 팀에\u00a0넣고' : ''}` : '';
  const stoneAll = summary.caught && stones.length > 0 ? `${summary.caught.name} 진화 가능: ${stones.map((s) => `${s.toName} (${itemName(s.item)})`).join(' · ')}` : '';
  const all = [title, ...head.map(partText), ...(stoneAll ? [stoneAll] : []), ...(summary.evoNote ? [summary.evoNote] : []), ...body.map(partText)].join(' · ') + (summary.rival ? ` · 라이벌 보상 (돈 ×${BALANCE.rivalMoneyScale} · 아이템)` : '');
  // 카드가 레벨업을 보여 주면 둘째 줄의 "▲ 이상해씨 Lv 5 → 6 (경험치 +28)" 은 빼고 새 기술 (★) 을 앞에 — 같은 말 두 번 · 좁으면 ★ 가 잘리던 것 (아트 디렉터 7차, 전체는 마우스를 올리면)
  const rest1 = ups.length === 0 ? body : [...body.filter((p) => p.kind === 'learned'), ...body.filter((p) => p.kind !== 'up' && p.kind !== 'learned')];
  // 경험치만 오른 포켓몬이 여럿이면 "경험치" 낱말은 한 번 ("경험치 리자몽 +25 · 이상해꽃 +51 · 거북왕 +51" — 세 번 되풀이하던 것, 아트 디렉터 #97 · 원칙 5)
  const expOnly = summary.exp.filter((e) => e.to <= e.from);
  const firstExp = rest1.findIndex((p) => p.kind === 'exp');
  const rest =
    expOnly.length > 1 && firstExp >= 0
      ? [...rest1.slice(0, firstExp).filter((p) => p.kind !== 'exp'), { kind: 'exp' as const, text: `경험치 ${expOnly.map((e) => `${e.name} +${e.gain}`).join(' · ')}` }, ...rest1.slice(firstExp).filter((p) => p.kind !== 'exp')]
      : rest1;
  // 좁은 제목 없는 상자의 경험치 장면 = 넘치면 이름 없이 숫자만 → 더 넘치면 "+102 ×3" (모두 같을 때) · "+25 ~ +51" (game.css .pg-exp-s1 · s2)
  const expShort = expOnly.length > 0 ? `경험치 ${expOnly.map((e) => `+${e.gain}`).join(' · ')}` : '';
  const gains = expOnly.map((e) => e.gain);
  const expTiny = gains.length === 0 ? '' : gains.every((g) => g === gains[0]) ? `경험치 +${gains[0]}${gains.length > 1 ? ` ×${gains.length}` : ''}` : `경험치 +${Math.min(...gains)} ~ +${Math.max(...gains)}`;
  // 제목 — 좁으면 "야생 " 을 빼고 (pg-title-pre) 낱말 단위로 줄을 바꿈 (줄임표 금지 U4 — "야생 파이리를 …" 로 잘리던 것, 2026-10-21 orders #5)
  const pre = title.startsWith('야생 ') ? '야생 ' : '';
  const restLine = rest.map((p, i) => (
    <span key={i}>
      {i > 0 && ' · '}
      {p.kind === 'exp' && expShort ? (
        <>
          <span class="pg-exp-full">
            <Line p={p} />
          </span>
          <span class="pg-exp-short">{expShort}</span>
          <span class="pg-exp-tiny">{expTiny}</span>
        </>
      ) : (
        <Line p={p} />
      )}
    </span>
  ));
  // 카드 한 장일 때 빠진 포켓몬 레벨업 (pg-alt-ups — 그때만 보임, 카드에도 글에도 없던 것 · UX 리뷰어)
  const hiddenUps = cards.slice(1).map((u) => `${u.name} Lv\u00a0${u.to}`).join(' · ');
  // 진화 아이템 두 번째부터 한 줄 (#125) — 넓으면 둘째 줄 맨 앞 · 좁으면 (번갈아 줄) 둘째 차례 맨 앞 ·
  //   글 = 엔진 evoNote ("피카츄 → 라이츄 진화 가능 외 N · 팀에 넣고" — 처음 안내 · 알림 줄과 같은 말, 개발 9f262eac) · 그림 = 그 아이템 (끈도 돌 그림이던 것 — 아트 #125)
  //   막 잡은 포켓몬 줄 (#131) 이 있으면 그것이 먼저 (지금 막 잡은 포켓몬 일 · 팀 진화 알림은 올리면 보이는 전체 글에) — 둘 다 같은 날은 드묾 (이번 전투에서 돌을 얻고 + 그 돌로 진화할 종을 잡음)
  //   넓으면 끝에 " · 계속 뒤 [B] 가방" (pg-evo-how — 결과 상자에서는 B 가 안 먹어서 "계속 뒤" · UX #131 2바퀴 · 좁은 번갈아 줄 · 넘치면 뺌)
  //   사이 " · " 는 pg-evo-sep (넘쳐서 ★ · 경험치를 뺄 때 같이 · 점을 앞 낱말에 붙여 줄이 "·" 로 시작하지 않게)
  const evoNote = stoneText ? (
    <span class="pg-evo-note">
      <Icon name={ITEM_ICON[stones[0]!.item as keyof typeof ITEM_ICON] ?? 'stone'} /> {stoneText}
      <span class="pg-evo-how">{' · 계속 뒤 [B] 가방'}</span>
      {rest.length > 0 && <span class="pg-evo-sep">{' · '}</span>}
    </span>
  ) : summary.evoNote ? (
    <span class="pg-evo-note">
      <Icon name={evoItem ? ITEM_ICON[evoItem as keyof typeof ITEM_ICON] : 'stone'} /> {summary.evoNote}
      {rest.length > 0 && ' · '}
    </span>
  ) : null;
  const altB = rest.length > 0 || evoNote ? (
    <>
      {evoNote}
      {hiddenUps && (
        <span class="pg-alt-ups">
          <span class="pg-up">▲</span> {hiddenUps} ·{' '}
        </span>
      )}
      <span class="pg-alt-rest">{restLine}</span>
    </>
  ) : ups.length > 0 ? <><span class="pg-up">▲</span> {ups.map((u) => `${u.name} Lv\u00a0${u.to}`).join(' · ')}</> : null;
  const alt = head.length > 0 && (
    <span class={`${showTitle ? 'pg-line ' : 'pg-result-alt-in '}pg-result-alt${altB ? '' : ' pg-result-alt-solo'}${stoneText ? ' pg-result-alt-first-b' : ''}`}>
      <span class="pg-result-alt-a">
        {head.map((p) => (
          <Reward key={p.kind} p={p} rare={!!summary.rival} />
        ))}
      </span>
      {altB && <span class="pg-result-alt-b">{altB}</span>}
    </span>
  );
  const lines = (
    <>
      <span class="pg-line">
        {/* 제목 없는 상자 (트레이너 — 숫자만) 는 좁은 번갈아 줄을 제목 자리에 = 한 줄 상자 (240 × 150 에서 둘째 줄로 66px · 왼쪽 위 · 오른쪽 아래가 비고 주인공 머리를 덮던 것 — 아트 디렉터 #97 큼 3) */}
        {!showTitle && alt}
        {showTitle && (
          <b class="pg-result-title">
            {pre && <span class="pg-title-pre">{pre}</span>}
            {title.slice(pre.length)}
            {/* 처음 잡은 종 = 제목 끝 NEW! (소개 카드를 2초 전에 넘기면 "처음" 이 사라지던 것 — bugs 2630 · 볼 칸에 붙이면 240 에서 5글자 이름이 잘려 줄바꿈되는 제목으로, UX · 작은 자리라 빨강 글자 NEW) */}
            {summary.caught?.isNew && (
              <span class="pg-new" title="처음 잡았다">
                {' '}
                NEW!
              </span>
            )}
          </b>
        )}
        {head.map((p) => (
          <Reward key={p.kind} p={p} rare={!!summary.rival} />
        ))}
        <Button onClick={() => onInput({ kind: 'result-continue' })} title="Space · Enter">
          <KeyCap k="Enter" /> {next === 'evolve' ? '▶ 어…?' : next === 'learn' ? '▶ 새 기술' : '계속 ▶'}
        </Button>
      </span>
      {/* 진화 아이템 두 번째부터 (#125 — 관장 첫 승 · 라이벌의 돌 · 끈) = 둘째 줄 맨 앞 "팀의 피카츄가 진화할 수 있어요" (얻은 돌 바로 아래 · 첫 줄은 제목 · 얻은 것 · 버튼으로 꽉 참) */}
      {(rest.length > 0 || evoNote) && (
        <span class="pg-line pg-ellipsis pg-result-body">
          {evoNote}
          {restLine}
        </span>
      )}
      {/* 좁은 패널 (360px 아래) — 첫 줄에서 빠진 얻은 것 (돈 · 볼) 2.5초 → 배운 기술 · 경험치 (레벨업 상자면 레벨업) 2.5초 (2026-10-21 태현 님 A — 예전 #437 "얻은 것 숨김" · 아이콘 + … 잘림을 바꿈). 둘째가 없으면 얻은 것만 */}
      {showTitle && alt}
    </>
  );
  if (ups.length === 0) {
    return (
      <div ref={tight.box} class={`pg-banner pg-result pg-two${summary.caught ? ' pg-result-caught' : ''}${whyOff ? ' pg-result-nowhy' : ''}${howOff ? ' pg-result-howoff' : ''}${tight.on ? ' pg-result-tight' : ''}${tight.short ? ` pg-result-short${tight.short}` : ''}${expStep ? ` pg-exp-s${expStep}` : ''}`} title={all}>
        {lines}
      </div>
    );
  }
  return (
    <div ref={tight.box} class={`pg-banner pg-result pg-two pg-lvup${whyOff ? ' pg-result-nowhy' : ''}${howOff ? ' pg-result-howoff' : ''}${tight.on ? ' pg-result-tight' : ''}${tight.one ? ' pg-result-one' : ''}${tight.short ? ` pg-result-short${tight.short}` : ''}`} title={all}>
      <span class="pg-lvup-cards">
        <FaceCards ups={cards} media={media} hint={hint} onStats={onStats} />
      </span>
      <span class="pg-result-lines">{lines}</span>
    </div>
  );
}
