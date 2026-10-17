/**
 * S02 타이틀 (gdd S02):
 *                      포켓몬 게임 모드                      [③일반 모드]
 *               [①새로 하기]      [②이어 하기]
 * 이어 하기 옆 요약 줄 (🌱 이상해씨 Lv 5 · 🏅0 · 1,000원 · 12분) 은 리드 [제안] — 좁은 패널에서는 시간 → 돈 → 배지 순으로 숨김 (game.css)
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { TitleInfo } from '../../../shared/messages';
import { Button } from '../../../ui/Button';
import { formatMoney, formatPlayTime } from '../../../ui/format';
import { InfoBar } from '../../../ui/InfoBar';
import { Sprite } from '../../../ui/Sprite';
import { titleView, type TitleSummary } from '../model';

export interface TitleScreenProps {
  info: TitleInfo;
  media: string;
  /** 눌러서 확장의 답을 기다리는 중 — 버튼을 두 번 누르지 않게 */
  pending: boolean;
  onNew(): void;
  onContinue(): void;
  onExit(): void;
}

/** 요약 그림은 패널 크기와 상관없이 원본 크기 (버튼 · 글자 옆에서 혼자 커지지 않게) */
const SUMMARY_SPRITE_SCALE = 1;

function Summary({ summary, media }: { summary: TitleSummary; media: string }) {
  return (
    <span class="pg-summary">
      {summary.lead && <Sprite media={media} form={summary.lead.form} scale={SUMMARY_SPRITE_SCALE} title={summary.lead.name} />}
      {summary.lead && (
        <span class="pg-sum-lead">
          {summary.lead.name} Lv {summary.lead.level}
        </span>
      )}
      <span class="pg-sum-badges" title="배지">
        🏅{summary.badges}
      </span>
      <span class="pg-sum-money">{formatMoney(summary.money)}</span>
      <span class="pg-sum-time pg-dim" title="플레이 시간">
        {formatPlayTime(summary.playTimeMs)}
      </span>
    </span>
  );
}

export function TitleScreen({ info, media, pending, onNew, onContinue, onExit }: TitleScreenProps) {
  const view = titleView(info);
  const [confirming, setConfirming] = useState(false);
  // 확장이 새 요약을 보내면 (안 됐다는 안내 등) 확인을 닫음
  useEffect(() => setConfirming(false), [info]);
  // 확인이 뜨면 취소에 포커스 — Enter 를 눌러도 세이브가 지워지지 않게
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (confirming) rootRef.current?.querySelector<HTMLButtonElement>('[data-name="cancel"]')?.focus();
  }, [confirming]);

  const locked = pending || !view.canStart;
  const clickNew = () => (view.confirmNew ? setConfirming(true) : onNew());
  const lead = view.summary?.lead;

  return (
    <div
      class="pg-screen pg-title"
      ref={rootRef}
      onKeyDown={(e) => {
        if (confirming && e.key === 'Escape') setConfirming(false);
      }}
    >
      <InfoBar
        center={<span class="pg-title-text">포켓몬 게임 모드</span>}
        right={
          <Button secondary onClick={onExit} disabled={pending} title="일반 모드로">
            일반 모드
          </Button>
        }
      />
      <div class="pg-body pg-title-body">
        <div class="pg-row">
          {confirming ? (
            <>
              <span class="pg-ask">
                {lead && <span class="pg-ask-what">{`${lead.name} Lv ${lead.level} · ${formatPlayTime(view.summary?.playTimeMs ?? 0)} `}</span>}
                지금 저장이 지워져요. 새로 할까요?
              </span>
              <Button onClick={onNew} disabled={locked} key="confirm-new">
                새로 하기
              </Button>
              <Button secondary onClick={() => setConfirming(false)} disabled={pending} name="cancel" key="confirm-cancel">
                취소
              </Button>
            </>
          ) : (
            <>
              {/* 세이브가 있으면 주로 누를 것은 이어 하기 — 새로 하기는 덜 눈에 띄게 */}
              <Button onClick={clickNew} disabled={locked} secondary={view.canContinue}>
                새로 하기
              </Button>
              <Button onClick={onContinue} disabled={locked || !view.canContinue} title={view.continueHint ?? undefined}>
                이어 하기
              </Button>
              {view.summary && <Summary summary={view.summary} media={media} />}
            </>
          )}
        </div>
        {view.warnings.length > 0 && (
          <div class="pg-warning" title={view.warnings.join('\n')}>
            ⚠ {view.warnings[0]}
            {view.warnings.length > 1 ? ` (+${view.warnings.length - 1})` : ''}
          </div>
        )}
      </div>
    </div>
  );
}
