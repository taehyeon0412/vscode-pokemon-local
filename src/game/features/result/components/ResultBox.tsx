/**
 * S12 전투 결과 (gdd S12) — ① 경험치 · ② 돈 · ③ 아이템 · ④ 레벨업 · ⑥ 새 기술 · ⑤ 계속 (Space · Enter · 클릭).
 * 잠깐 보여 주고 저절로 넘어감 (자동 전투로 둬도 멈추지 않게) — 고를 것이 있으면 S23 · S22 로.
 * 모양 = 전투와 같은 판 (단계 12): 받은 것은 금색 글자 + 픽셀 아이콘, 레벨업 ▲ · 새 기술 ★
 */
import { BALANCE } from '../../../core/balance';
import type { BattleSummary, GameInput } from '../../../core/engine';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { partText, summaryLines, type SummaryPart } from '../model';

/** 첫 줄 받은 것 — 라이벌 보상 (돈 ×1.5 · 아이템) 은 ★ 금색 (gdd 4.12 — 글을 늘리면 좁은 패널에서 잘려서 표시로만) */
function Reward({ p, rare }: { p: SummaryPart; rare: boolean }) {
  return (
    <span class={rare && p.kind !== 'caught' ? 'pg-reward pg-reward-rare' : 'pg-reward'}>
      {p.kind === 'caught' ? <span class="pg-ball" aria-hidden="true" /> : <Icon name={p.kind === 'money' ? 'coin' : 'gift'} />} {p.text}
    </span>
  );
}

/** 둘째 줄 — 레벨업 ▲ · 새 기술 ★ (금색) · 라이벌 한마디는 따옴표 */
function Line({ p }: { p: SummaryPart }) {
  if (p.kind === 'up' || p.kind === 'learned') {
    return (
      <>
        <span class="pg-up">{p.kind === 'up' ? '▲' : '★'}</span> {p.text}
      </>
    );
  }
  return <>{p.kind === 'quote' ? `“${p.text}”` : p.text}</>;
}

/** next = 이어서 고를 것 (맨 앞) — 버튼에 다음 할 일 */
export function ResultBox({ summary, next, onInput }: { summary: BattleSummary; next: 'learn' | 'evolve' | null; onInput(i: GameInput): void }) {
  const { title, head, body } = summaryLines(summary);
  const all = [title, ...head.map(partText), ...body.map(partText)].join(' · ') + (summary.rival ? ` · 라이벌 보상 (돈 ×${BALANCE.rivalMoneyScale} · 아이템)` : '');
  return (
    <div class="pg-banner pg-result pg-two" title={all}>
      <span class="pg-line">
        <b class="pg-ellipsis">{title}</b>
        {head.map((p) => (
          <Reward key={p.kind} p={p} rare={!!summary.rival} />
        ))}
        <Button onClick={() => onInput({ kind: 'result-continue' })} title="Space · Enter">
          {next === 'evolve' ? '▶ 어…?' : next === 'learn' ? '▶ 새 기술' : '계속 ▶'}
        </Button>
      </span>
      {body.length > 0 && (
        <span class="pg-line pg-ellipsis pg-result-body">
          {body.map((p, i) => (
            <span key={i}>
              {i > 0 && ' · '}
              <Line p={p} />
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
