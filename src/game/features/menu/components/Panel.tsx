/**
 * 메뉴 판 (S07 · S14 · S18 · S19 · S20 · S21 공통 틀) — 패널 전체를 덮는 낮은 판: 제목 줄 + 내용 (넘치면 안에서 스크롤).
 * 판이 떠 있는 동안 게임은 멈춤 (웹뷰가 계산을 쉼 — main.ts). 닫기 = ✕ · Esc. 임시 디자인 — 단계 12 에서 다시.
 */
import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { Button } from '../../../ui/Button';

export interface PanelProps {
  title: ComponentChildren;
  /** 제목 줄 오른쪽 (돈 · 안내) */
  extra?: ComponentChildren;
  onClose(): void;
  closeLabel?: string;
  children: ComponentChildren;
}

export function Panel({ title, extra, onClose, closeLabel = '닫기', children }: PanelProps) {
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
        <b class="pg-panel-title pg-ellipsis">{title}</b>
        {extra && <span class="pg-panel-extra pg-ellipsis">{extra}</span>}
        <Button secondary extraClass="pg-pin" onClick={onClose} title="Esc">
          ✕ {closeLabel}
        </Button>
      </div>
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
