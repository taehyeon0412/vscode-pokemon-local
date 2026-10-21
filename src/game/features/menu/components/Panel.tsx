/**
 * 메뉴 판 (S07 · S14 · S18 · S19 · S20 · S21 공통 틀) — 패널 전체를 덮는 낮은 판: 제목 줄 + 내용 (넘치면 안에서 스크롤).
 * 판이 떠 있는 동안 게임은 멈춤 (웹뷰가 계산을 쉼 — main.ts). 닫기 = ✕ · Esc. 모양 = 정보줄 아래 떠 있는 판 (단계 12, game.css).
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
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
  /** 판 맨 아래 고정 한 줄 (드물게 누르는 것 — 개발 메뉴 끝내기 · 알림, 2026-10-21 아트 디렉터: 위험한 것이 첫 자리에 있던 것) */
  foot?: ComponentChildren;
  children: ComponentChildren;
}

export function Panel({ icon, title, extra, onClose, closeLabel = '닫기', sub, foot, children }: PanelProps) {
  // 몸통 아래로 한 줄 (12px) 넘게 더 있으면 몸통 밑 따로 한 줄 "▼ 아래에 더" — 누르면 한 화면 내려감 (개발 메뉴와 같은 말 — 150 ~ 187 에서 지도 목표 · 설정 아래 줄이 스크롤 아래에 있는지 몰랐던 것, UX 밤 점검) ·
  //   몸통 위에 얹으면 마지막 줄 이름을 가리고 · 누르면 밑 버튼이 눌리던 것 (UX 리뷰어 — 상점에서 물건이 사짐) · 끝까지 내리면 사라짐 · 맨 아래 고정 줄 (foot) 이 있는 판은 그 줄이 맡음
  const body = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  // 한 번 생긴 아래 줄은 판이 열려 있는 동안 자리를 지킴 (끝에서 글만 숨김 — 빠지면 몸통이 14px 길어지며 마지막 줄이 툭 내려가던 것, UX 리뷰어 U2)
  const [kept, setKept] = useState(false);
  const check = () => {
    const el = body.current;
    if (!el) return;
    const m = el.scrollHeight - (el.scrollTop + el.clientHeight) > 12;
    setMore(m);
    if (m) setKept(true);
  };
  const down = () => {
    const el = body.current;
    if (el) el.scrollBy({ top: Math.max(16, el.clientHeight - 16) });
  };
  useLayoutEffect(check);
  useEffect(() => {
    const el = body.current;
    el?.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      el?.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.repeat) return;
      // 세이브 불러오기 확인 상자가 떠 있으면 Esc 는 그 상자 몫 (그만두기 — 판까지 닫히던 것)
      // 세이브 묻는 상자 · 오류 상자가 Esc 를 받음 (결과 한 줄은 아님 — 내보낸 직후 Esc 로 판이 안 닫히던 것, 개발 #48)
      if (document.querySelector('#pokemon-game .pg-saveio:not(.pg-saveio-result)')) return;
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
        {/* 넓으면 (480 이상) "▼ 더" 는 머리 줄 ✕ 왼쪽 — 세로 자리를 안 씀 (187 높이 지도에서 아래 줄이 목표 줄을 반쯤 자르던 것, UX 리뷰어) */}
        {!foot && more && (
          <button type="button" class="pg-panel-more pg-panel-more-head" onClick={down} title="아래로 (휠 · 끌기로도)">
            ▼ 아래에 더
          </button>
        )}
        <Button secondary extraClass="pg-pin" onClick={onClose} title="Esc">
          {/* 아주 좁은 패널 (300px 아래) 은 ✕ 만 — 판 머리 줄에 탭 · 돈이 들어가게 (2026-10-21 상점 사기 · 팔기) */}
          ✕ <span class="pg-close-word">{closeLabel}</span>
        </Button>
      </div>
      {sub && <div class="pg-panel-sub">{sub}</div>}
      <div class="pg-panel-body" ref={body}>
        {children}
      </div>
      {foot && <div class="pg-panel-foot">{foot}</div>}
      {!foot && kept && (
        <button type="button" class={`pg-panel-more pg-panel-more-foot${more ? '' : ' pg-hidden-keep'}`} onClick={down} title="아래로 (휠 · 끌기로도)" tabIndex={more ? 0 : -1}>
          ▼ 아래에 더
        </button>
      )}
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
