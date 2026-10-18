/**
 * S02 타이틀 (gdd S02):
 *                      포켓몬 게임 모드
 *               [①새로 하기]      [②이어 하기]
 * ③ 일반 모드는 화면 안에 두지 않음 — 패널 제목줄 🏠 와 겹쳐서 (2026-10-18 태현 님)
 * 이어 하기 옆 요약 줄 (🌱 이상해씨 Lv 5 · 🏅0 · 1,000원 · 12분) 은 리드 [제안] — 좁은 패널에서는 시간 → 돈 → 배지 순으로 숨김 (game.css)
 * ① 새로 하기 → S03 주인공 (남 · 여) → S04 스타팅 → 확장에 새 세이브 (features/starter)
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { TitleInfo } from '../../../shared/messages';
import { Button } from '../../../ui/Button';
import { formatMoney, formatPlayTime } from '../../../ui/format';
import { InfoBar } from '../../../ui/InfoBar';
import { Sprite } from '../../../ui/Sprite';
import { HeroPick } from '../../starter/components/HeroPick';
import { StarterPick } from '../../starter/components/StarterPick';
import type { Gender, NewGameChoice } from '../../starter/model';
import { titleView, type TitleSummary } from '../model';

export interface TitleScreenProps {
  info: TitleInfo;
  media: string;
  /** 눌러서 확장의 답을 기다리는 중 — 버튼을 두 번 누르지 않게 */
  pending: boolean;
  /** S03 · S04 에서 고른 것으로 새로 하기 */
  onNew(choice: NewGameChoice): void;
  onContinue(): void;
  /** 주인공 그림 픽셀 크기 (S03) */
  heroPx: number;
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

export function TitleScreen({ info, media, pending, onNew, onContinue, heroPx }: TitleScreenProps) {
  const view = titleView(info);
  const [confirming, setConfirming] = useState(false);
  // 새로 하기 다음 단계 — S03 주인공 · S04 스타팅 (고르는 동안은 화면에만, 결정하면 확장에 새 세이브)
  const [step, setStep] = useState<'title' | 'hero' | 'starter'>('title');
  const [gender, setGender] = useState<Gender>('male');
  // 확장이 새 요약을 보내면 (안 됐다는 안내 등) 확인을 닫고 타이틀로
  useEffect(() => {
    setConfirming(false);
    setStep('title');
  }, [info]);
  // 확인이 뜨면 취소에 포커스 — Enter 를 눌러도 세이브가 지워지지 않게
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (confirming) rootRef.current?.querySelector<HTMLButtonElement>('[data-name="cancel"]')?.focus();
  }, [confirming]);

  const locked = pending || !view.canStart;
  const startNew = () => {
    setConfirming(false);
    setStep('hero');
  };
  const clickNew = () => (view.confirmNew ? setConfirming(true) : startNew());
  const lead = view.summary?.lead;

  if (step === 'hero') {
    return (
      <HeroPick
        px={heroPx}
        onBack={() => setStep('title')}
        onPick={(g) => {
          setGender(g);
          setStep('starter');
        }}
      />
    );
  }
  if (step === 'starter') {
    return <StarterPick media={media} scale={heroPx / 2} pending={pending} onBack={() => setStep('hero')} onDone={(dex, moves) => onNew({ gender, dex, moves })} />;
  }

  return (
    <div
      class="pg-screen pg-title"
      ref={rootRef}
      onKeyDown={(e) => {
        if (confirming && e.key === 'Escape') setConfirming(false);
      }}
    >
      <InfoBar center={<span class="pg-title-text">포켓몬 게임 모드</span>} />
      <div class="pg-body pg-title-body">
        <div class="pg-row">
          {confirming ? (
            <>
              <span class="pg-ask">
                {lead && <span class="pg-ask-what">{`${lead.name} Lv ${lead.level} · ${formatPlayTime(view.summary?.playTimeMs ?? 0)} `}</span>}
                지금 저장이 지워져요. 새로 할까요?
              </span>
              <Button onClick={startNew} disabled={locked} key="confirm-new">
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
