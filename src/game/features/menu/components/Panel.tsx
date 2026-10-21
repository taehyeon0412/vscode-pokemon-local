/**
 * 메뉴 판 (S07 · S14 · S18 · S19 · S20 · S21 공통 틀) — 패널 전체를 덮는 낮은 판: 제목 줄 + 내용 (넘치면 안에서 스크롤).
 * 판이 떠 있는 동안 게임은 멈춤 (웹뷰가 계산을 쉼 — main.ts). 닫기 = ✕ · Esc. 모양 = 정보줄 아래 떠 있는 판 (단계 12, game.css).
 */
import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { Button } from '../../../ui/Button';
import { Icon, type IconName } from '../../../ui/Icon';

export interface PanelProps {
  /** 제목 앞 아이콘 (금색 이름표 밖 남색 위 — 이름표 위에서는 묻혀서) */
  icon?: IconName;
  title: ComponentChildren;
  /** 제목 줄 오른쪽 (돈 · 안내) */
  extra?: ComponentChildren;
  onClose(): void;
  closeLabel?: string;
  /** 제목 줄 바로 아래 고정 한 줄 (내용과 같이 스크롤되지 않음 — 상점 알림 · 안내, 2026-10-21) */
  sub?: ComponentChildren;
  children: ComponentChildren;
}

export function Panel({ icon, title, extra, onClose, closeLabel = '닫기', sub, children }: PanelProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.repeat) return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return (
    <div class="pg-panel" role="dialog">
      <div class="pg-panel-head">
        {icon && <Icon name={icon} />}
        <b class="pg-panel-title pg-ellipsis">{title}</b>
        {extra && <span class="pg-panel-extra pg-ellipsis">{extra}</span>}
        <Button secondary extraClass="pg-pin" onClick={onClose} title="Esc">
          {/* 아주 좁은 패널 (300px 아래) 은 ✕ 만 — 판 머리 줄에 탭 · 돈이 들어가게 (2026-10-21 상점 사기 · 팔기) */}
          ✕ <span class="pg-close-word">{closeLabel}</span>
        </Button>
      </div>
      {sub && <div class="pg-panel-sub">{sub}</div>}
      <div class="pg-panel-body">{children}</div>
    </div>
  );
}

/** 줄 하나 (넘치면 옆으로 스크롤 · wrap 이면 다음 줄로) */
export function Row({ children, label, wrap }: { children: ComponentChildren; label?: ComponentChildren; /** 높이가 되면 여러 줄로 (상점) */ wrap?: boolean }) {
  return (
    <div class={wrap ? 'pg-panel-row pg-panel-wrap' : 'pg-panel-row'}>
      {label && <span class="pg-panel-label pg-dim">{label}</span>}
      {children}
    </div>
  );
}
