/**
 * 진화 아이템 처음 안내 본문 (#125 — 2026-10-28 태현 님 "천둥의돌 같은 아이템을 얻으면 화면에 듀토리얼처럼 팁이 나왔으면 좋겠어 이걸로 특정 포켓몬을 진화시킬수 있다 이런식?").
 * FirstTip 안 두 줄 — ① 돌 그림 · 이름 · 무엇 ② 쓸 포켓몬 (작은 그림 · 이름 → 진화형) + [B] 가방, 없으면 "지금은 쓸 포켓몬이 없어요 · 예 …".
 * 글은 엔진 기본 문장 (rules/evo-tip evoTip) 을 반으로 (원칙 5) · 좁으면 (360 아래) 쓸 포켓몬 하나 · 예 하나.
 */
import { useEffect, useRef } from 'preact/hooks';
import { evoTip } from '../../../core/rules/evo-tip';
import type { ItemId, Save } from '../../../core/save';
import { Icon } from '../../../ui/Icon';
import { KeyCap } from '../../../ui/KeyCap';
import { Sprite } from '../../../ui/Sprite';
import { ITEM_ICON } from '../../menu/model';

export function EvoTip({ save, item, media, onUsed }: { save: Save; item: ItemId; media: string; /** 안내대로 [B] 를 누름 = 본 것 (가방을 보고 닫으면 같은 안내가 6초 다시 뜨던 것 — UX #125 3바퀴) */ onUsed(): void }) {
  const used = useRef(onUsed);
  used.current = onUsed;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyB' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) used.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  const tip = evoTip(save, item);
  const boxOnly = tip.users.length > 0 && tip.users.every((u) => u.where === 'box');
  const how = (
    <span class="pg-tip-part pg-evo-how">
      {boxOnly ? '팀에 넣고 ' : ''}
      <KeyCap k="B" /> 가방<span class="pg-tip-long">에서</span>
    </span>
  );
  // 360 아래는 그림 없이 (22px 그림이 둘째 줄을 키워 240 × 150 에서 주인공 머리를 덮던 것)
  const user = (u: (typeof tip.users)[number], face = true) => {
    const m = save.monsters[u.uid];
    return (
      <span key={u.uid} class="pg-evo-user" title={`${u.where === 'team' ? '팀' : '보관함'}의 ${u.name} → ${u.toName}`}>
        {m && face && (
          <span class="pg-evo-face">
            <Sprite media={media} form={m.form} shiny={m.shiny} scale={1} crop={22} center />
          </span>
        )}
        {u.name} → {u.toName}
      </span>
    );
  };
  return (
    <span class="pg-evo-tip-body" title={`${tip.what} · ${tip.how} · ${tip.who}`}>
      <span class="pg-evo-line">
        <Icon name={ITEM_ICON[item as keyof typeof ITEM_ICON]} />
        <b>{tip.itemName}</b>
        {/* 모든 폭에서 짧은 말 — 쓸 포켓몬이 둘째 줄에 있어 "특정 포켓몬을 진화시켜요" 는 같은 뜻 · 설명서 말투 (ideas 1633 — 기획 10-28 "추천대로") */}
        <span class="pg-evo-what"> — 진화에 써요</span>
        {/* 대기실 · 360 아래 한 줄일 때만 (둘째 줄을 빼면 할 일이 사라지지 않게) */}
        {/*   쓸 포켓몬이 없으면 "아직 쓸 포켓몬 없음" ("[B] 진화" 를 눌러도 가방이 모두 흐려 넓은 판과 뜻이 반대이던 것 — UX #125 2바퀴) */}
        <span class="pg-evo-b1">
          {' · '}
          {tip.users.length > 0 ? (
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
        {tip.users.length > 0 ? (
          <>
            {/* 넓으면 둘까지 + "외 N" · 360 아래는 하나 (두 줄이 주인공을 덮지 않게) */}
            <span class="pg-tip-long">
              {tip.users.slice(0, 2).map((u) => user(u))}
              {tip.users.length > 2 && <span class="pg-dim"> 외 {tip.users.length - 2}</span>}
            </span>
            <span class="pg-tip-short">{user(tip.users[0]!, false)}</span>
            {how}
          </>
        ) : (
          <>
            <span class="pg-dim pg-tip-long">지금은 쓸 포켓몬이 없어요</span>
            <span class="pg-dim pg-tip-short">아직 쓸 포켓몬 없음</span>
            {/* 예는 이름만 (진화형까지 쓰면 화살표가 줄줄이 이어져 둘째 줄이 첫 줄의 1.8배 — 아트 #125 큼) · 진화형은 올리면 */}
            {tip.examples.length > 0 && (
              <>
                <span class="pg-tip-long pg-dim" title={tip.examples.map((e) => `${e.name} → ${e.toName}`).join(' · ')}>
                  · 예 {tip.examples.map((e) => e.name).join(' · ')}
                </span>
                <span class="pg-tip-short pg-dim">예 {tip.examples[0]!.name}</span>
              </>
            )}
          </>
        )}
      </span>
    </span>
  );
}
