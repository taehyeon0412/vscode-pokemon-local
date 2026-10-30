/**
 * 진화 아이템 처음 안내 본문 (#125 — 2026-10-28 태현 님 "천둥의돌 같은 아이템을 얻으면 화면에 듀토리얼처럼 팁이 나왔으면 좋겠어 이걸로 특정 포켓몬을 진화시킬수 있다 이런식?").
 * FirstTip 안 두 줄 — ① 돌 그림 · 이름 · 무엇 ② 쓸 포켓몬 (작은 그림 · 이름 → 진화형) + [B] 가방, 없으면 "지금은 쓸 포켓몬이 없어요 · 예 …".
 * 못 본 아이템이 둘 넘게 한꺼번에면 한 상자 (ideas 1631 — 6초 안내가 차례로 뜨던 것): ① 돌 그림들 · "진화의 돌 2개" ② 아이템마다 쓸 포켓몬 하나 — 얼굴 대신 그 돌 그림 (어느 돌이 누구 것인지 · 폭도 좁음, UX 1631 아이디어) (없으면 예 하나).
 * 글은 엔진 기본 문장 (rules/evo-tip evoTip) 을 반으로 (원칙 5) · 좁으면 (360 아래) 쓸 포켓몬 하나 + 외 N · 예 하나 · 넘치면 한 단계 (fitStep).
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { evoTip, type EvoUser } from '../../../core/rules/evo-tip';
import type { ItemId, Save } from '../../../core/save';
import { Icon } from '../../../ui/Icon';
import { KeyCap } from '../../../ui/KeyCap';
import { Sprite } from '../../../ui/Sprite';
import { contentWidth, FIT_ROOM } from '../../../ui/useFit';
import { ITEM_ICON } from '../../menu/model';

/** 넘치면 한 단계 마지막 (game.css .pg-evo-s1 ~ s3) — 1 = 둘째 줄 짧은 꼴 · 2 = 한 줄 "… · [B] 진화" · 3 = 한 줄에서 묶음 돌 그림 뺌 */
const FIT_MAX = 3;

/**
 * 안내 상자가 넘치는지 (ux-rules U4 — 폭 경계를 손으로 고르지 않음, 1631 UX 큼 둘): 줄마다 내용 × 맥 여유 1.1 이 상자 안쪽 폭을 넘거나
 * (둘째 줄이 접혀 세 줄로 주인공 머리를 덮던 것 — 맥 361 ~ 480) · 대기실 두 줄 상자 (맥 폭으로 늘려 잼) 가 주인공 · 관장 칸에 닿으면 (맥 620 ~ 690 에서 주인공 몸을 덮던 것)
 */
function tipOverflows(body: HTMLElement): boolean {
  const tip = body.closest<HTMLElement>('.pg-first-tip');
  const stage = tip?.offsetParent;
  if (!tip || !(stage instanceof HTMLElement) || stage.clientWidth === 0) return false;
  const cs = getComputedStyle(tip);
  const room = stage.clientWidth - 16 - (parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth));
  // 첫 줄 앞 "처음" 칸 (::before — 글 재기에 안 잡힘) · 둘째 줄 왼쪽 여백 (돌 그림 열에 맞춤)
  const chip = getComputedStyle(tip, '::before');
  const chipW = (parseFloat(chip.width) || 0) + (parseFloat(chip.marginRight) || 0);
  const lines = Array.from(body.querySelectorAll<HTMLElement>(':scope > .pg-evo-line')).filter((l) => l.getClientRects().length > 0);
  if (lines.some((l, i) => contentWidth(l) * FIT_ROOM + (i === 0 ? chipW : parseFloat(getComputedStyle(l).paddingLeft) || 0) > room + 0.5)) return true;
  if (!tip.classList.contains('pg-evo-low') || lines.length < 2) return false;
  const r = tip.getBoundingClientRect();
  const mid = r.left + r.width / 2;
  const half = (r.width * FIT_ROOM) / 2;
  const game = tip.closest('#pokemon-game') ?? document;
  return [game.querySelector('.pg-hero-wrap'), game.querySelector('.pg-foe-trainer')].some((el) => {
    const o = el?.getBoundingClientRect();
    return !!o && o.width > 0 && mid - half < o.right + 2 && mid + half > o.left - 2 && r.top < o.bottom;
  });
}

/** 넘치면 한 단계씩 올림 · 패널 크기가 바뀌면 0 부터 · 글꼴이 늦게 오면 다시 잼 (ui/useFit 과 같은 틀) */
function useTipFit(body: { current: HTMLElement | null }): number {
  const [step, setStep] = useState(0);
  const [, remeasure] = useState(0);
  useLayoutEffect(() => {
    const el = body.current;
    if (el && step < FIT_MAX && tipOverflows(el)) setStep(step + 1);
  });
  useEffect(() => {
    const reset = () => setStep(0);
    window.addEventListener('resize', reset);
    void document.fonts?.ready.then(() => remeasure((n) => n + 1));
    return () => window.removeEventListener('resize', reset);
  }, []);
  return step;
}

type Row = EvoUser & { item?: ItemId };

export function EvoTip({ save, items, media, onUsed }: { save: Save; items: readonly ItemId[]; media: string; /** 안내대로 [B] 를 누름 = 본 것 (가방을 보고 닫으면 같은 안내가 6초 다시 뜨던 것 — UX #125 3바퀴) */ onUsed(): void }) {
  const used = useRef(onUsed);
  used.current = onUsed;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyB' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) used.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  const body = useRef<HTMLSpanElement>(null);
  const step = useTipFit(body);
  const tips = items.map((i) => evoTip(save, i));
  const one = tips.length === 1 ? tips[0]! : null;
  // 여럿이면 아이템마다 첫째 하나씩 + 그 돌 (이브이처럼 한 포켓몬이 돌 둘을 쓰면 줄이 둘 — 진화형이 달라서)
  const users: Row[] = one ? one.users : tips.flatMap((t) => t.users.slice(0, 1).map((u) => ({ ...u, item: t.item })));
  const examples = one ? one.examples : tips.flatMap((t) => t.examples.slice(0, 1));
  const name = one ? one.itemName : `${items.includes('linking-cord') ? '진화 아이템' : '진화의 돌'} ${items.length}개`;
  const boxOnly = users.length > 0 && users.every((u) => u.where === 'box');
  const how = (
    <span class="pg-tip-part pg-evo-how">
      {boxOnly ? '팀에 넣고 ' : ''}
      <KeyCap k="B" /> 가방<span class="pg-tip-long">에서</span>
    </span>
  );
  // 360 아래는 얼굴 없이 (22px 그림이 둘째 줄을 키워 240 × 150 에서 주인공 머리를 덮던 것) · 묶음은 늘 얼굴 대신 그 돌 그림 (16px)
  const user = (u: Row, i: number, face = true) => {
    const m = save.monsters[u.uid];
    return (
      <span key={`${i}-${u.uid}`} class="pg-evo-user" title={`${u.where === 'team' ? '팀' : '보관함'}의 ${u.name} → ${u.toName}`}>
        {u.item ? (
          <Icon name={ITEM_ICON[u.item as keyof typeof ITEM_ICON]} />
        ) : (
          m &&
          face && (
            <span class="pg-evo-face">
              <Sprite media={media} form={m.form} shiny={m.shiny} scale={1} crop={22} center />
            </span>
          )
        )}
        {u.name} → {u.toName}
      </span>
    );
  };
  const title = one ? `${one.what} · ${one.how} · ${one.who}` : tips.map((t) => `${t.itemName}: ${t.who}`).join(' · ');
  const fit = Array.from({ length: step }, (_, i) => ` pg-evo-s${i + 1}`).join('');
  return (
    <span ref={body} class={`pg-evo-tip-body${one ? '' : ' pg-evo-many'}${fit}`} title={title}>
      <span class="pg-evo-line">
        {items.map((i) => (
          <Icon key={i} name={ITEM_ICON[i as keyof typeof ITEM_ICON]} />
        ))}
        <b>{name}</b>
        {/* 모든 폭에서 짧은 말 — 쓸 포켓몬이 둘째 줄에 있어 "특정 포켓몬을 진화시켜요" 는 같은 뜻 · 설명서 말투 (ideas 1633 — 기획 10-28 "추천대로") */}
        {/*   묶음은 뺌 — "진화의 돌 2개" 가 이미 같은 뜻 · 240 에서 첫 줄이 접혀 세 줄로 주인공을 덮던 것 (1631) */}
        {one && <span class="pg-evo-what"> — 진화에 써요</span>}
        {/* 대기실 · 360 아래 한 줄일 때만 (둘째 줄을 빼면 할 일이 사라지지 않게) */}
        {/*   쓸 포켓몬이 없으면 "아직 쓸 포켓몬 없음" ("[B] 진화" 를 눌러도 가방이 모두 흐려 넓은 판과 뜻이 반대이던 것 — UX #125 2바퀴) */}
        <span class="pg-evo-b1">
          {' · '}
          {users.length > 0 ? (
            <>
              <KeyCap k="B" /> 진화
            </>
          ) : (
            // "진화" 를 남김 (숲 관장 첫 보상 리프의돌은 보통 쓸 포켓몬이 없어 좁은 판 첫 안내가 거의 이 모양 — 진화 말이 빠지던 것, UX #125 3바퀴)
            //   300 아래는 "진화용" 만 (240 에서 "· 쓸 포켓몬 없음" 까지면 접혀 두 줄 — 주인공을 덮음)
            <span class="pg-dim">
              진화용<span class="pg-evo-none"> · 쓸 포켓몬 없음</span>
            </span>
          )}
        </span>
      </span>
      <span class="pg-evo-line pg-evo-who">
        {users.length > 0 ? (
          <>
            {/* 넓으면 둘까지 + "외 N" · 360 아래 · 넘치면 하나 + "외 N" (두 줄이 주인공을 덮지 않게 · 둘째가 있다는 것은 남김 — UX 1631 작음 5) */}
            <span class="pg-tip-long">
              {users.slice(0, 2).map((u, i) => user(u, i))}
              {users.length > 2 && <span class="pg-dim"> 외 {users.length - 2}</span>}
            </span>
            <span class="pg-tip-short">
              {user(users[0]!, 0, false)}
              {users.length > 1 && <span class="pg-dim"> 외 {users.length - 1}</span>}
            </span>
            {how}
          </>
        ) : (
          <>
            <span class="pg-dim pg-tip-long">지금은 쓸 포켓몬이 없어요</span>
            <span class="pg-dim pg-tip-short">아직 쓸 포켓몬 없음</span>
            {/* 예는 이름만 (진화형까지 쓰면 화살표가 줄줄이 이어져 둘째 줄이 첫 줄의 1.8배 — 아트 #125 큼) · 진화형은 올리면 */}
            {examples.length > 0 && (
              <>
                <span class="pg-tip-long pg-dim" title={examples.map((e) => `${e.name} → ${e.toName}`).join(' · ')}>
                  · 예 {examples.map((e) => e.name).join(' · ')}
                </span>
                <span class="pg-tip-short pg-dim">예 {examples[0]!.name}</span>
              </>
            )}
          </>
        )}
      </span>
    </span>
  );
}
