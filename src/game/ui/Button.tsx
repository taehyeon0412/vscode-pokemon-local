import type { ComponentChildren } from 'preact';

export interface ButtonProps {
  children: ComponentChildren;
  /** e = 누른 마우스 이벤트 (Shift + 클릭 등) */
  onClick(e?: MouseEvent): void;
  disabled?: boolean;
  /** 덜 중요한 버튼 (취소 · 일반 모드 등) */
  secondary?: boolean;
  title?: string;
  autoFocus?: boolean;
  /** 찾기용 이름 (data-name) — 예: 확인 창이 뜰 때 취소에 포커스 */
  name?: string;
  /** 더 붙일 class (예: pg-pin — 좁아도 줄어들지 않는 버튼) */
  extraClass?: string;
}

/** 게임 버튼 — VS Code 테마 색을 따라감 (game.css .pg-button) */
export function Button({ children, onClick, disabled, secondary, title, autoFocus, name, extraClass }: ButtonProps) {
  return (
    <button
      type="button"
      class={`${secondary ? 'pg-button pg-secondary' : 'pg-button'}${extraClass ? ` ${extraClass}` : ''}`}
      disabled={disabled}
      title={title}
      autoFocus={autoFocus}
      data-name={name}
      onClick={(e) => {
        if (!disabled) onClick(e);
      }}
    >
      {children}
    </button>
  );
}
