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
import { contentWidth, FIT_ROOM } from '../../../ui/useFit';
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
/** 3:3 결과 경험치 줄 — 판 끝에 쓰러져 있던 칸은 이름 뒤 작은 "기절" 칩 (멈춘 셋 빈칸이 "누가 쓰러졌나" 로 읽히게 — ideas 1669 · 가운데 줄은 "못 받음" 으로 읽혀 바꿈, 엔진은 싸운 셋 모두에게 줌) */
const Ko = () => <span class="pg-exp-ko">기절</span>;

/** down = 판 끝에 쓰러져 있던 칸 uid (이름 글자 맞추기면 같은 종 둘 · "코일 ⊂ 레어코일" 에서 엉뚱한 이름에 붙던 것 — UX 작음 4) */
function Line({ p, down = new Set<string>() }: { p: SummaryPart; down?: ReadonlySet<string> }) {
  if (p.kind === 'up' || p.kind === 'learned') {
    return (
      <>
        {/* 짧은 말의 누가는 ★ 앞 (★ 바로 뒤 이름은 ★ 등급 · 이로치로 읽혀서 — UX 2725 작음 3) */}
        {p.shortWho && <span class="pg-learned-short">{p.shortWho}{'\u00a0'}</span>}
        {/* ▲ · ★ 와 글을 줄 바꿈으로 떼지 않게 */}
        <span class="pg-up">{p.kind === 'up' ? '▲' : '★'}</span>
        {'\u00a0'}
        {/* 배운 기술 짧은 말 (기술 이름만) — 넓은 둘째 줄이 넘칠 때 (useResultFit learnShort · bugs 2711) */}
        {p.short ? (
          <>
            <span class="pg-learned-full">{p.text}</span>
            <span class="pg-learned-short">{p.short}</span>
          </>
        ) : (
          p.text
        )}
      </>
    );
  }
  if (p.kind === 'exp' && p.entries)
    return (
      <>
        경험치{' '}
        {p.entries.map((e, i) => (
          <span key={e.uid}>
            {i > 0 && ' · '}
            {e.name}
            {down.has(e.uid) && <Ko />}
            {`\u00a0+${e.gain}`}
          </span>
        ))}
      </>
    );
  if (p.kind === 'exp' && p.uid && p.name && down.has(p.uid))
    return (
      <>
        {p.name}
        <Ko />
        {p.text.slice(p.name.length)}
      </>
    );
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
function useResultFit(): { box: { current: HTMLDivElement | null }; on: boolean; one: boolean; short: number; split: boolean; learnShort: boolean; noPre: boolean; noKey: boolean } {
  const box = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const [one, setOne] = useState(false);
  const [short, setShort] = useState(0);
  const [split, setSplit] = useState(false);
  const [learnShort, setLearnShort] = useState(false);
  const [noPre, setNoPre] = useState(false);
  const [noKey, setNoKey] = useState(false);
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
    // 상자가 더 넓어질 수 있는 폭 — 상자는 내용만큼 (fit-content · 최대 = 무대 − 16px) 이라 제목 없는 상자 (트레이너 · 3:3) 는 남는 폭이 늘 0 으로 재져
    //   모든 폭에서 늘 한 단계 (tight · one) 줄던 것 (1898 UX 큼 — 다시 재기를 넣자 드러남) · 내용이 넘쳐 이미 최대 폭이면 0
    const host = (el.offsetParent as HTMLElement | null) ?? el.parentElement;
    const maxW = getComputedStyle(el).maxWidth;
    const grow = host ? Math.max(0, (maxW.endsWith('px') ? parseFloat(maxW) : host.clientWidth - 16) - el.getBoundingClientRect().width) : 0;
    if (!on) {
      let need = 0;
      line.querySelectorAll<HTMLElement>(':scope > .pg-reward').forEach((c) => {
        if (c.offsetWidth > 0) need += c.scrollWidth * 1.1 - c.clientWidth;
      });
      const room = grow + (title ? title.getBoundingClientRect().width - minW(title) : line.clientWidth - kids.reduce((w, c) => w + c.getBoundingClientRect().width, 0) - gap * Math.max(0, kids.length - 1));
      if (need > Math.max(0, room) + 0.5) {
        setOn(true);
        return;
      }
    }
    const over = () => el.getBoundingClientRect().bottom > window.innerHeight - 1;
    // 주인공 머리를 덮음 (그림 틀 위 끝) — 맥에서 제목이 두 줄로 접혀 상자가 2px 커지던 것 (464 ~ 520 × 150 레벨업 둘, bugs 2716 · U3) · 켜지는 단계는 "야생 " 빼기 · 짧은 말뿐이라 틀 기준으로 넉넉히
    const hero = el.closest('#pokemon-game')?.querySelector('.pg-hero-wrap')?.getBoundingClientRect();
    const onHero = () => {
      const r = el.getBoundingClientRect();
      return !!hero && hero.width > 0 && r.bottom > hero.top + 0.5 && r.left < hero.right && r.right > hero.left;
    };
    if (!one && el.classList.contains('pg-lvup')) {
      // 첫 줄 = 제목 (최소 폭까지 줄어듦) + 보이는 칩 · 버튼 (내용 실제 너비 × 1.1) + 칸 사이 gap
      const need = kids.reduce((w, c) => w + (c === title ? minW(c) : c.scrollWidth * 1.1), 0) + gap * Math.max(0, kids.length - 1);
      if (need > line.clientWidth + grow + 0.5 || over()) {
        // 카드를 빼기 전에 "계속" 버튼 Enter 키 칸부터 뺌 — 카드 한 장은 넓은 모양에서 빠진 레벨업이 어디에도 안 보여서 (맥 481 ~ 482 에서 키 칸이 다시 생겨 첫 줄이 넘치던 것 — UX 작음 묶음 3 큼 1 · bugs 2718 과 같은 뿌리)
        if (!noKey && Array.from(el.querySelectorAll<HTMLElement>('.pg-button .pg-menu-key')).some((k) => k.offsetWidth > 0)) setNoKey(true);
        else setOne(true);
        return;
      }
    }
    // 레벨업 상자가 주인공을 덮으면 카드를 빼지 않고 제목 앞 "야생 " 을 뺌 — 카드 한 장은 넓은 모양에서 빠진 레벨업이 어디에도 안 보여서 (UX 1917 큼 1 · bugs 2716)
    if (!noPre && el.classList.contains('pg-lvup') && el.querySelector('.pg-title-pre') && onHero()) {
      setNoPre(true);
      return;
    }
    // 그래도 덮으면 "계속" 버튼의 Enter 키 칸을 뺌 (Space · Enter 는 버튼 title) — 488 ~ 504 맥에서 키 칸이 생겨 제목이 두 줄 그대로 2px 덮던 것 (bugs 2716 남은 것)
    if (!noKey && (noPre || !el.querySelector('.pg-title-pre')) && el.classList.contains('pg-lvup') && onHero() && Array.from(el.querySelectorAll<HTMLElement>('.pg-button .pg-menu-key')).some((k) => k.offsetWidth > 0)) {
      setNoKey(true);
      return;
    }
    // 넓은 둘째 줄 (진화 한 줄 + ★ 배운 기술 · 경험치) 이 맥 여유로 안 들어가면 (bugs 2711 · U4 — 480 맥에서 배운 기술이 "…" 로 잘리던 것)
    //   ① 배운 기술을 기술 이름만 ("★ 덩굴채찍") → ② 그래도 넘치면 진화 줄을 따로 한 줄 (split — 상자가 한 줄 커져 150 에서 주인공 모자를 덮을 수 있어 나중 단계)
    //   상자가 더 넓어질 수 있는 폭 (grow) 까지 견줌 — 상자 자기 폭만 보면 내용만큼 넓어지는 상자라 1860 · 제목 없는 상자에서도 늘 넘친 것으로 재지던 것 (UX 2708 큼 1 · 1898 과 같은 뿌리)
    const body = el.querySelector<HTMLElement>('.pg-result-body');
    const bodyOver = () => !!body && body.clientWidth > 0 && !!body.querySelector('.pg-evo-note') && contentWidth(body) * FIT_ROOM > body.clientWidth + grow + 0.5;
    // 번갈아 둘째 차례 (좁은 모양) 에서 "★ 이상해씨가 / 덩굴채찍을 배웠다" 가 두 줄로 접혀 주인공을 덮으면 그 차례도 짧은 말 (400 ~ 460 — UX 1917 작음 2)
    const alt2 = el.querySelector<HTMLElement>('.pg-result-alt-b');
    const altLong = !!alt2 && alt2.getClientRects().length > 0 && !!alt2.querySelector('.pg-learned-short') && onHero();
    if (!learnShort && ((body?.querySelector('.pg-learned-short') && bodyOver()) || altLong)) {
      setLearnShort(true);
      return;
    }
    if (!split && bodyOver()) {
      setSplit(true);
      return;
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
      setSplit(false);
      setLearnShort(false);
      setNoPre(false);
      setNoKey(false);
    };
    window.addEventListener('resize', reset);
    return () => window.removeEventListener('resize', reset);
  }, []);
  // 글꼴이 늦게 붙거나 (픽셀 글꼴) 키 칸이 나타나 상자 · 첫 줄 · 칩 크기가 바뀌면 다시 잼 — 결과 상자는 다시 그리는 열쇠가 안 바뀌면 다시 안 그려져
  //   처음 잰 값에 머물러 500 × 150 첫 줄 칩이 "피카츄 팀에 들…" 로 잘리고 제목이 4줄이던 것 (bugs 1898 · 1897 howOff 와 같은 뿌리)
  //   감시는 상자 요소가 바뀔 때만 다시 붙임 (그릴 때마다 끊고 붙이면 새 감시의 첫 알림이 다시 그리기를 불러 끝없이 돎) · 끊기는 사라질 때
  const [, remeasure] = useState(0);
  const watch = useRef<{ el: Element; ro: ResizeObserver } | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el || watch.current?.el === el || typeof ResizeObserver === 'undefined') return;
    watch.current?.ro.disconnect();
    const ro = new ResizeObserver(() => remeasure((n) => n + 1));
    ro.observe(el);
    const line = el.querySelector('.pg-line');
    if (line) {
      ro.observe(line);
      for (const c of line.children) ro.observe(c);
    }
    watch.current = { el, ro };
    void document.fonts?.ready.then(() => watch.current?.el === el && remeasure((n) => n + 1));
  });
  useEffect(
    () => () => {
      watch.current?.ro.disconnect();
      watch.current = null;
    },
    [],
  );
  return { box, on, one, short, split, learnShort, noPre, noKey };
}

/** next = 이어서 고를 것 (맨 앞) — 버튼에 다음 할 일 · ups = 레벨업한 포켓몬 (result/model levelUps) · onStats = 내 포켓몬 판 (그 포켓몬) */
export function ResultBox({ summary, next, ups, hint = false, caught = null, ms = 0, introAt = { left: 0, top: 0 }, evoItem = null, stones = [], bagOk = false, bagLater = false, media, onInput, onStats }: { summary: BattleSummary; next: 'learn' | 'evolve' | null; ups: LevelUpView[]; /** 얼굴 카드 안내 말풍선 (needsStatHint) */ hint?: boolean; /** 진화 아이템 두 번째부터 (#125) — 얻은 아이템 id (한 줄 그림) */ evoItem?: ItemId | null; /** 막 잡은 포켓몬을 진화시킬 가방의 돌 (#131 — 그릴 때 지금 세이브로 다시 센 것 · summary.caught.stones 는 결과가 났을 때 신호라 놓아주거나 돌을 쓰면 낡음) */ stones?: readonly CaughtStone[]; /** 이 상자에서 B = 계속 + 가방이 먹는 때 (엔진 resultBagOk — ideas 1656) — 돌 줄 할 일을 "[B] 가방" 으로 */ bagOk?: boolean; /** 계속하면 클리어 · 관장 카드 (엔진 resultThenCard — 그 카드에선 B 가 안 먹음, bugs 1897) — 할 일을 "다음 스테이지에서 [B] 가방" 으로 */ bagLater?: boolean; /** 잡은 포켓몬 — 처음 caughtIntroMs 동안 소개 카드만 */ caught?: CaughtView | null; /** 결과 단계 지난 ms */ ms?: number; /** 소개 카드 자리 (길 칸 기준 정수 px) */ introAt?: { left: number; top: number; width?: number }; media: string; onInput(i: GameInput): void; onStats(uid: string): void }) {
  const tight = useResultFit();
  // 제목 없는 상자 (트레이너) 번갈아 칸의 경험치 장면 줄이기 (넘치면 한 단계 · 맥 여유 10%) — 0 = 이름 · 1 = 숫자만 · 2 = "+102 ×3" / "+25 ~ +51"
  //   (240 × 150 세 자리 경험치 "경험치 +102 · +102 · +1…" 이 버튼 밑으로 잘리던 것 — 개발 #98 11판 3판 · U4 "넘치면 한 단계" · 폭 경계를 손으로 고르지 않음)
  //   레벨업 상자 (얼굴 카드 — 상자 높이가 카드 44) 는 그다음 3 = 카드 높이 안에서 줄 바꿈 · 4 = 배운 기술은 기술 이름만 · 5 = 경험치 뺌 · 6 = ★ 기술 · 남은 줄도 뺌 ·
  //   7 = 빠진 레벨업의 "Lv N" 뺌 ("▲ 이상해씨 · 독침붕" — 셋이 같이 오른 3:3 240 맥에서 세 줄로 카드보다 커지던 것) (전부는 상자 title) ·
  //   빠진 레벨업 ("▲ 뷰티플라이 Lv 11") 은 끝까지 남김 — 레벨업은 중요한 순간 (U1 · 레벨업을 숨겨 큼이던 2718 과 같은 종류가 되지 않게, 기획 2725)
  //   (240 · 300 × 150 맥 3:3 결과 — "▲ 뷰티플라이 Lv 11 · ★ 아리아도스가 엉겨붙기를 배웠다" 가 한 줄 고정이라 "계속 ▶" 아래로 깔려 잘리던 것, bugs 2725 · U4 · 레벨업 상자엔 1 · 2 단계 칸도 안 붙던 것)
  const [expStep, setExpStep] = useState(0);
  useLayoutEffect(() => {
    const box = tight.box.current;
    const inner = box?.querySelector<HTMLElement>('.pg-result-alt-in');
    const bEl = inner?.querySelector<HTMLElement>('.pg-result-alt-b');
    const card = box?.querySelector<HTMLElement>('.pg-lvup-card');
    if (!inner || !bEl || inner.clientWidth === 0 || expStep >= (card ? 7 : 2)) return;
    if (expStep < 3 || !card) {
      const r = document.createRange();
      r.selectNodeContents(bEl);
      if (r.getBoundingClientRect().width * 1.1 > inner.clientWidth + 0.5) setExpStep(expStep + 1);
      return;
    }
    // 줄 바꿈 단계 — 맥 글꼴 (+10% — 글자 사이 0.06em 로 흉내) 로 감은 높이가 카드를 넘으면 다음 단계 (줄 수를 어림하면 두 줄에 드는 "★ 덩굴채찍" 까지 빼던 것)
    const ls = bEl.style.letterSpacing;
    bEl.style.letterSpacing = '0.06em';
    const h = bEl.getBoundingClientRect().height;
    bEl.style.letterSpacing = ls;
    if (h > card.getBoundingClientRect().height + 0.5) setExpStep(expStep + 1);
  });
  // 넓은 둘째 줄 돌 줄 끝 " · [B] 가방" (#131 UX — 할 일) — 줄이 맥 여유 1.1 로 안 들어가면 한 단계씩 짧은 글 → 마지막도 넘치면 뺌 (★ · 경험치가 … 로 잘리지 않게)
  //   클리어 · 관장 카드로 이어지는 상자 = "다음 스테이지에서 [B] 가방" → "다음 판에서 [B] 가방" → "[B] 가방은 다음에" (디자인 문구 — 상자 폭이 첫 줄로 정해져
  //   860 · 1860 에서도 할 일 칸이 통째로 빠지던 것, bugs 1901)
  const howTexts = bagOk ? ['\u00a0· [B]\u00a0가방'] : bagLater ? ['\u00a0· 다음 스테이지에서 [B]\u00a0가방', '\u00a0· 다음 판에서 [B]\u00a0가방', '\u00a0· 다음에 [B]\u00a0가방'] : ['\u00a0· 계속\u00a0뒤 [B]\u00a0가방'];
  const [howStep, setHowStep] = useState(0);
  // 할 일이 안 들어가면 짧은 글보다 먼저 상자를 패널 안에서 넓힘 — 상자는 left 50% 라 저절로는 패널 반까지만 늘어 상자 폭 = 첫 줄이었고, 넓은 패널 · 맥 글꼴에서도
  //   짧은 글로 가거나 할 일 칸이 빠지던 것 (bugs 1902) · 가운데 축 그대로 (translateX −50%) · 양옆 8px (최대 = 무대 − 16px)
  const [howWide, setHowWide] = useState<number | null>(null);
  const howOff = howStep >= howTexts.length;
  useLayoutEffect(() => {
    if (howOff) return;
    const box = tight.box.current;
    const over = () => {
      const body = box?.querySelector<HTMLElement>('.pg-result-body');
      if (!body || body.clientWidth === 0 || !body.querySelector('.pg-evo-how')) return false;
      const r = document.createRange();
      r.selectNodeContents(body);
      return r.getBoundingClientRect().width * 1.1 > body.clientWidth + 0.5;
    };
    const next = () => {
      const body = box?.querySelector<HTMLElement>('.pg-result-body');
      const host = box ? ((box.offsetParent as HTMLElement | null) ?? box.parentElement) : null;
      // 넓힐 자리가 남아 있으면 넓힘 (글꼴이 늦게 붙어 다시 넘쳐도 — 맥 글꼴에서 한 번 넓힌 뒤 바로 짧은 글로 가던 것) · 자리가 없을 때만 짧은 글
      if (box && body && host) {
        const r = document.createRange();
        r.selectNodeContents(body);
        const cur = box.getBoundingClientRect().width;
        const want = Math.min(host.clientWidth - 16, Math.ceil(cur + r.getBoundingClientRect().width * 1.1 - body.clientWidth + 1));
        if (want > cur + 0.5) {
          setHowWide(want);
          return;
        }
      }
      setHowStep((n) => n + 1);
    };
    if (over()) {
      next();
      return;
    }
    // 상자가 나중에 나타나거나 좁아지면 (소개 카드 뒤 · tight 단계) 다시 잼 — 다시 그리는 열쇠가 안 바뀌어 처음 잰 값에 머물러
    //   "다음 스테이지에서 [B] 가방" 이 480 ~ 535 × 150 에서 ★ 줄을 자르던 것 (bugs 1897 UX 큼)
    if (!box || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (!over()) return;
      ro.disconnect();
      next();
    });
    ro.observe(box);
    const body = box.querySelector<HTMLElement>('.pg-result-body');
    if (body) ro.observe(body);
    return () => ro.disconnect();
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
      setHowStep(0);
      setHowWide(null);
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
  // 배운 기술 짧은 말에 누가 배웠는지 — 레벨업한 포켓몬이 둘 넘거나 배운 포켓몬과 다르면 ("★ 아리아도스 엉겨붙기") · 같은 하나면 기술 이름만
  //   ("▲ 뷰티플라이 Lv 11 · ★ 엉겨붙기" 가 뷰티플라이가 배운 것처럼 읽히던 것 — 기획 2725 · U5)
  //   바로 앞에 빠진 레벨업 ("▲ 이상해씨 Lv 6 ·") 이 같은 포켓몬이면 붙이지 않음 (되풀이 · 두 줄로 감겨 상자가 주인공 모자를 덮던 것 — UX 2725 작음 1)
  //   카드 수로 정함 (카드 한 장 단계는 나중에 켜져, 처음 그림에 이름이 붙은 채 넘치면 한 단계가 끝까지 가던 것)
  const lastHidden = cards.length > 1 ? cards[cards.length - 1]!.name : null;
  const learnWho = (p: SummaryPart): SummaryPart =>
    p.kind === 'learned' && p.short && p.name && (ups.length !== 1 || ups[0]!.name !== p.name) && lastHidden !== p.name ? { ...p, shortWho: p.name } : p;
  const rest2 =
    expOnly.length > 1 && firstExp >= 0
      ? [...rest1.slice(0, firstExp).filter((p) => p.kind !== 'exp'), { kind: 'exp' as const, text: `경험치 ${expOnly.map((e) => `${e.name}\u00a0+${e.gain}`).join(' · ')}`, entries: expOnly.map((e) => ({ uid: e.uid, name: e.name, gain: e.gain })) }, ...rest1.slice(firstExp).filter((p) => p.kind !== 'exp')]
      : rest1;
  const rest = rest2.map(learnWho);
  // 좁은 제목 없는 상자의 경험치 장면 = 넘치면 이름 없이 숫자만 → 더 넘치면 "+102 ×3" (모두 같을 때) · "+25 ~ +51" (game.css .pg-exp-s1 · s2)
  const expShort = expOnly.length > 0 ? `경험치 ${expOnly.map((e) => `+${e.gain}`).join(' · ')}` : '';
  const gains = expOnly.map((e) => e.gain);
  const expTiny = gains.length === 0 ? '' : gains.every((g) => g === gains[0]) ? `경험치 +${gains[0]}${gains.length > 1 ? ` ×${gains.length}` : ''}` : `경험치 +${Math.min(...gains)} ~ +${Math.max(...gains)}`;
  // 제목 — 좁으면 "야생 " 을 빼고 (pg-title-pre) 낱말 단위로 줄을 바꿈 (줄임표 금지 U4 — "야생 파이리를 …" 로 잘리던 것, 2026-10-21 orders #5)
  const pre = title.startsWith('야생 ') ? '야생 ' : '';
  // 판 끝에 쓰러져 있던 내 칸 이름 (엔진 teamMe — 3:3 결과만)
  const downUids = new Set((summary.teamMe ?? []).filter((m) => m.down).map((m) => m.uid));
  const restLine = rest.map((p, i) => (
    <span key={i} class={p.kind === 'exp' ? 'pg-rest-exp' : undefined}>
      {i > 0 && ' · '}
      {p.kind === 'exp' && expShort ? (
        <>
          <span class="pg-exp-full">
            <Line p={p} down={downUids} />
          </span>
          <span class="pg-exp-short">{expShort}</span>
          <span class="pg-exp-tiny">{expTiny}</span>
        </>
      ) : (
        <Line p={p} down={downUids} />
      )}
    </span>
  ));
  // 카드 한 장일 때 빠진 포켓몬 레벨업 (pg-alt-ups — 그때만 보임, 카드에도 글에도 없던 것 · UX 리뷰어)
  const hiddenUps = cards.slice(1).map((u) => `${u.name} Lv\u00a0${u.to}`).join('\u00a0· ');
  // 그리는 모양 — 이름 뒤 "Lv N" 은 따로 (넘치면 마지막 단계에서 뺌 · pg-alt-nolv)
  const hiddenUpsEl = cards.slice(1).map((u, i) => (
    <span key={u.uid}>
      {i > 0 && '\u00a0· '}
      {u.name}
      <span class="pg-alt-ups-lv">{` Lv\u00a0${u.to}`}</span>
    </span>
  ));
  // 진화 아이템 두 번째부터 한 줄 (#125) — 넓으면 둘째 줄 맨 앞 · 좁으면 (번갈아 줄) 둘째 차례 맨 앞 ·
  //   글 = 엔진 evoNote ("피카츄 → 라이츄 진화 가능 외 N · 팀에 넣고" — 처음 안내 · 알림 줄과 같은 말, 개발 9f262eac) · 그림 = 그 아이템 (끈도 돌 그림이던 것 — 아트 #125)
  //   막 잡은 포켓몬 줄 (#131) 이 있으면 그것이 먼저 (지금 막 잡은 포켓몬 일 · 팀 진화 알림은 올리면 보이는 전체 글에) — 둘 다 같은 날은 드묾 (이번 전투에서 돌을 얻고 + 그 돌로 진화할 종을 잡음)
  //   넓으면 끝에 " · [B] 가방" (pg-evo-how — 이 상자에서 B 가 먹는 때 = bagOk · ideas 1656) · 계속하면 고르기 · 클리어 · 관장 카드로 이어지는 상자는 B 가 안 먹어서 " · 계속 뒤 [B] 가방" (UX #131 2바퀴) · 클리어 · 관장 카드로 이어지면 그 카드에서도 안 먹어 " · 다음 스테이지에서 [B] 가방" (bugs 1897 — bagLater) · 좁은 번갈아 줄 · 넘치면 뺌
  //   사이 " · " 는 pg-evo-sep (넘쳐서 ★ · 경험치를 뺄 때 같이 · 점을 앞 낱말에 붙여 줄이 "·" 로 시작하지 않게)
  const evoNote = stoneText ? (
    <span class="pg-evo-note">
      <Icon name={ITEM_ICON[stones[0]!.item as keyof typeof ITEM_ICON] ?? 'stone'} /> {stoneText}
      <span class="pg-evo-how">{howTexts[Math.min(howStep, howTexts.length - 1)]}</span>
      {rest.length > 0 && <span class="pg-evo-sep">{' · '}</span>}
    </span>
  ) : summary.evoNote ? (
    <span class="pg-evo-note">
      <Icon name={evoItem ? ITEM_ICON[evoItem as keyof typeof ITEM_ICON] : 'stone'} /> {summary.evoNote}
      {rest.length > 0 && <span class="pg-evo-sep">{' · '}</span>}
    </span>
  ) : null;
  const altB = rest.length > 0 || evoNote ? (
    <>
      {evoNote}
      {hiddenUps && (
        <span class="pg-alt-ups">
          <span class="pg-up">▲</span> {hiddenUpsEl}
          {/* 점은 앞 낱말에 붙임 (240 맥에서 둘째 줄이 "· ★ 덩굴채찍" 으로 시작하던 것) */}
          <span class="pg-alt-ups-sep">{'\u00a0·'}</span>{' '}
        </span>
      )}
      <span class="pg-alt-rest">{restLine}</span>
    </>
  ) : ups.length > 0 ? <><span class="pg-up">▲</span> {ups.map((u) => `${u.name} Lv\u00a0${u.to}`).join(' · ')}</> : null;
  // 좁은 번갈아 줄은 할 일 (돌 줄 · 진화 아이템 줄) 이 있으면 그 차례 먼저 — 얻은 것 나중 (ideas 1654 · 1.5초 찍기에 "진화 가능" 이 안 보이던 것, 기획 10-30)
  const alt = head.length > 0 && (
    <span class={`${showTitle ? 'pg-line ' : 'pg-result-alt-in '}pg-result-alt${altB ? '' : ' pg-result-alt-solo'}${stoneText || summary.evoNote ? ' pg-result-alt-first-b' : ''}`}>
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
      <div ref={tight.box} class={`pg-banner pg-result pg-two${summary.caught ? ' pg-result-caught' : ''}${whyOff ? ' pg-result-nowhy' : ''}${howOff ? ' pg-result-howoff' : ''}${tight.on ? ' pg-result-tight' : ''}${tight.short ? ` pg-result-short${tight.short}` : ''}${tight.split ? ' pg-result-split' : ''}${tight.learnShort ? ' pg-result-learnshort' : ''}${tight.noPre ? ' pg-result-nopre' : ''}${tight.noKey ? ' pg-result-nokey' : ''}${expStep ? ` pg-exp-s${expStep}` : ''}`} style={howWide ? { minWidth: `${howWide}px` } : undefined} title={all}>
        {lines}
      </div>
    );
  }
  return (
    <div ref={tight.box} class={`pg-banner pg-result pg-two pg-lvup${whyOff ? ' pg-result-nowhy' : ''}${howOff ? ' pg-result-howoff' : ''}${tight.on ? ' pg-result-tight' : ''}${tight.one ? ' pg-result-one' : ''}${tight.short ? ` pg-result-short${tight.short}` : ''}${tight.split ? ' pg-result-split' : ''}${tight.learnShort || expStep >= 4 ? ' pg-result-learnshort' : ''}${tight.noPre ? ' pg-result-nopre' : ''}${tight.noKey ? ' pg-result-nokey' : ''}${expStep ? ` pg-exp-s${Math.min(2, expStep)}` : ''}${expStep >= 3 ? ' pg-alt-wrap' : ''}${expStep >= 5 ? ' pg-alt-noexp' : ''}${expStep >= 6 ? ' pg-alt-norest' : ''}${expStep >= 7 ? ' pg-alt-nolv' : ''}`} style={howWide ? { minWidth: `${howWide}px` } : undefined} title={all}>
      <span class="pg-lvup-cards">
        <FaceCards ups={cards} media={media} hint={hint} onStats={onStats} />
      </span>
      <span class="pg-result-lines">{lines}</span>
    </div>
  );
}
