/**
 * S02 타이틀 (gdd S02) — 단계 12 디자인: 숲 그림 위 어두운 한 겹 · 금색 제목 (필살기 큰 글씨 A 와 같은 모양) · 판 모양 메뉴 한 줄
 *                      포켓몬 게임 모드
 *               [①새로 하기]      [②이어 하기]
 * ③ 일반 모드는 화면 안에 두지 않음 — 패널 제목줄 🏠 와 겹쳐서 (2026-10-18 태현 님)
 * 이어 하기 옆 요약 줄 (🌱 이상해씨 Lv 5 · 🏅0 · 1,000원 · 12분) 은 리드 [제안] — 좁은 패널에서는 시간 → 돈 → 배지 순으로 숨김 (game.css)
 * ① 새로 하기 → S03 주인공 (남 · 여) → S04 스타팅 → 확장에 새 세이브 (features/starter)
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { TitleInfo } from '../../../shared/messages';
import { Button } from '../../../ui/Button';
import { formatMoney, formatPlayTime } from '../../../ui/format';
import type { Layout } from '../../../ui/layout';
import { themeKind } from '../../../ui/theme';
import { HeroPick } from '../../starter/components/HeroPick';
import { StarterPick } from '../../starter/components/StarterPick';
import { HERO_LOOKS, type HeroLook } from '../../../data/heroes';
import type { NewGameChoice } from '../../starter/model';
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
  /** 정보줄 뺀 높이 — S03 칸에 큰 그림이 들어가는지 */
  bodyPx?: number;
  /** 숲 그림 크기 (스테이지와 같은 그림) */
  size?: Layout['size'];
}

/** 제목 — 필살기 큰 글씨 A (금색 그라데이션 + 두꺼운 갈색 테두리 + 금색 안쪽 선, 2026-10-19 태현 님) 와 같은 모양을 SVG 글자로 */
function Logo() {
  const text = '포켓몬 게임 모드';
  return (
    <svg class="pg-logo" viewBox="0 0 260 44" role="img" aria-label={text}>
      <defs>
        <linearGradient id="pg-logo-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffffff" />
          <stop offset="0.3" stop-color="#fffbe0" />
          <stop offset="0.62" stop-color="#ffe680" />
          <stop offset="1" stop-color="#f5c400" />
        </linearGradient>
      </defs>
      <text x="130" y="23" text-anchor="middle" dominant-baseline="central" fill="none" stroke="rgba(10, 5, 0, 0.9)" stroke-width="8" stroke-linejoin="round">
        {text}
      </text>
      <text x="130" y="23" text-anchor="middle" dominant-baseline="central" fill="url(#pg-logo-gold)" stroke="#b88a00" stroke-width="3" stroke-linejoin="round" paint-order="stroke">
        {text}
      </text>
    </svg>
  );
}

/** 메뉴 한 줄 (Sea of Stars 세로 메뉴와 같은 줄 — 올리면 줄 전체 바탕 + 금색 + ▸, 주로 누를 줄은 ▸ 가 늘 붙음) */
function MenuRow({ on, onClick, disabled, title, children }: { on: boolean; onClick(): void; disabled?: boolean; title?: string; children: ComponentChildren }) {
  return (
    <button type="button" class={on ? 'pg-title-item pg-on' : 'pg-title-item'} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
}

/** 이어 하기 줄 옆 흐린 요약 — 그림 없이 글자만 (×1 그림 옆 ×2 아이콘이 섞이지 않게, 아트 디렉터) */
function Summary({ summary }: { summary: TitleSummary }) {
  return (
    <span class="pg-summary">
      {summary.lead && (
        <span class="pg-sum-lead">
          {summary.lead.name} Lv {summary.lead.level}
        </span>
      )}
      <span class="pg-sum-badges">배지 {summary.badges}</span>
      <span class="pg-sum-money">{formatMoney(summary.money)}</span>
      <span class="pg-sum-time pg-dim">
        플레이 {formatPlayTime(summary.playTimeMs)}
      </span>
    </span>
  );
}

export function TitleScreen({ info, media, pending, onNew, onContinue, heroPx, bodyPx, size = 'medium' }: TitleScreenProps) {
  const view = titleView(info);
  const [confirming, setConfirming] = useState(false);
  // 새로 하기 다음 단계 — S03 주인공 · S04 스타팅 (고르는 동안은 화면에만, 결정하면 확장에 새 세이브)
  const [step, setStep] = useState<'title' | 'hero' | 'starter'>('title');
  const [look, setLook] = useState<HeroLook>(HERO_LOOKS[0]!);
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
        media={media}
        bodyPx={bodyPx}
        initial={look.id}
        onBack={() => setStep('title')}
        onPick={(l) => {
          setLook(l);
          setStep('starter');
        }}
      />
    );
  }
  if (step === 'starter') {
    return <StarterPick media={media} pending={pending} onBack={() => setStep('hero')} onDone={(dex, moves) => onNew({ gender: look.gender, look: look.id, dex, moves })} />;
  }

  return (
    <div
      class="pg-screen pg-title"
      ref={rootRef}
      onKeyDown={(e) => {
        if (confirming && e.key === 'Escape') setConfirming(false);
      }}
    >
      <div class="pg-body pg-title-body" style={{ backgroundImage: media ? `url("${media}/backgrounds/forest/foreground-${themeKind()}-${size}.png"), url("${media}/backgrounds/forest/background-${themeKind()}-${size}.png")` : 'none' }}>
        <Logo />
        <div class="pg-title-menu">
          {confirming ? (
            // 지우는 쪽 (새로 하기) 은 빨간 보조 버튼, 주 버튼은 취소 — 경고 문장은 크림, 지워지는 말만 빨강 (금색 = 고른 것)
            <div class="pg-row">
              <span class="pg-ask">
                {lead && <span class="pg-ask-what">{`${lead.name} Lv ${lead.level} · ${formatPlayTime(view.summary?.playTimeMs ?? 0)} `}</span>}
                <b class="pg-danger-text">지금 저장이 지워져요.</b> 새로 할까요?
              </span>
              <Button secondary extraClass="pg-danger" onClick={startNew} disabled={locked} key="confirm-new">
                새로 하기
              </Button>
              <Button onClick={() => setConfirming(false)} disabled={pending} name="cancel" key="confirm-cancel">
                취소
              </Button>
            </div>
          ) : view.canContinue ? (
            // 세이브가 있으면 주로 누를 것은 이어 하기 (위 · ▸) — 새로 하기는 아래
            <>
              <MenuRow on onClick={onContinue} disabled={locked} title={view.continueHint ?? undefined}>
                이어 하기 {view.summary && <Summary summary={view.summary} />}
              </MenuRow>
              <MenuRow on={false} onClick={clickNew} disabled={locked}>
                새로 하기
              </MenuRow>
            </>
          ) : (
            <>
              <MenuRow on onClick={clickNew} disabled={locked}>
                새로 하기
              </MenuRow>
              <MenuRow on={false} onClick={onContinue} disabled title={view.continueHint ?? undefined}>
                이어 하기
              </MenuRow>
            </>
          )}
        </div>
        {/* 세이브가 없을 때만 — 이 게임이 무엇을 저절로 하고 내가 무엇을 하는지 한 줄 (2026-10-21 첫 안내 #9 · 기획 [제안] 을 줄임). 좁으면 쉬기 안내를 뺌 */}
        {!view.canContinue && !confirming && (
          <p class="pg-title-tip">
            걷기 · 만남은 저절로 — 전투는 1 ~ 5 로 고르기<span class="pg-title-tip-more"> · 쉬려면 패널 위 집 버튼</span>
          </p>
        )}
        {view.warnings.length > 0 && (
          <div class="pg-warning" title={view.warnings.join('\n')}>
            <b>!</b> {view.warnings[0]}
            {view.warnings.length > 1 ? ` (+${view.warnings.length - 1})` : ''}
          </div>
        )}
      </div>
    </div>
  );
}
