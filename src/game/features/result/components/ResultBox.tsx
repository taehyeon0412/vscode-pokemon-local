/**
 * S12 전투 결과 (gdd S12) — ① 경험치 · ② 돈 · ③ 아이템 · ④ 레벨업 · ⑥ 새 기술 · ⑤ 계속 (Space · Enter · 클릭).
 * 잠깐 보여 주고 저절로 넘어감 (자동 전투로 둬도 멈추지 않게) — 고를 것이 있으면 S23 · S22 로 (임시 디자인).
 */
import { BALANCE } from '../../../core/balance';
import type { BattleSummary, GameInput } from '../../../core/engine';
import { Button } from '../../../ui/Button';
import { summaryLines } from '../model';

/** next = 이어서 고를 것 (맨 앞) — 버튼에 다음 할 일 */
export function ResultBox({ summary, next, onInput }: { summary: BattleSummary; next: 'learn' | 'evolve' | null; onInput(i: GameInput): void }) {
  const { head, body } = summaryLines(summary);
  const all = [...head, ...body].join(' · ') + (summary.rival ? ` · 라이벌 보상 (돈 ×${BALANCE.rivalMoneyScale} · 아이템)` : '');
  return (
    <div class="pg-banner pg-result pg-two" title={all}>
      <span class="pg-line">
        <b class="pg-ellipsis">{head[0]}</b>
        {head.slice(1).map((h) => (
          // 라이벌 보상 (돈 ×1.5 · 아이템) 은 금색 (gdd 4.12 — 트레이너보다 좋게, 글을 늘리면 좁은 패널에서 잘려서 색으로만)
          <span key={h} class={summary.rival && !h.startsWith('◓') ? 'pg-reward pg-reward-rare' : 'pg-reward'}>
            {h}
          </span>
        ))}
        <Button onClick={() => onInput({ kind: 'result-continue' })} title="Space · Enter">
          {next === 'evolve' ? '▶ 어…?' : next === 'learn' ? '▶ 새 기술' : '계속 ▶'}
        </Button>
      </span>
      {body.length > 0 && <span class="pg-line pg-ellipsis pg-result-body">{body.join(' · ')}</span>}
    </div>
  );
}
