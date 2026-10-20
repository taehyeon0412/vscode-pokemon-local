/**
 * S06 ⑦ ~ ⑩ 정보줄 버튼 — 빨리 걷기 ▶▶ (2026-10-19) · 지도 · 내 포켓몬 (선두 그림) · 가방 · 설정 (2026-10-18 태현 님, 픽셀 아이콘 = 단계 12).
 * 단축키 + 아이콘 + 이름 (2026-10-19 태현 님 "아이콘만 있어 무슨 메뉴인지 모름") — 좁으면 아이콘 + 이름 → 아이콘만 (menuLabels).
 * 걷는 중에만 보임 (판이 떠 있는 동안 걸음이 멈춤).
 */
import type { ComponentChildren } from 'preact';
import { Button } from '../../../ui/Button';
import { Icon, type IconName } from '../../../ui/Icon';
import { Sprite } from '../../../ui/Sprite';
import { MENU_KEYS, type MenuLabels, type MenuShortcut, type Overlay } from '../model';

const BUTTONS: { kind: Overlay['kind'] & ('map' | 'team' | 'bag' | 'settings'); icon: IconName | null; label: string; title: string }[] = [
  { kind: 'map', icon: 'map', label: '지도', title: '⑦ 세계 지도' },
  { kind: 'team', icon: null, label: '포켓몬', title: '⑧ 내 포켓몬 (팀 순서 · 스탯 · 포인트)' },
  { kind: 'bag', icon: 'bag', label: '가방', title: '⑨ 가방 (상처약 · 진화의 돌)' },
  { kind: 'settings', icon: 'gear', label: '설정', title: '⑩ 설정 (알림 · 일반 모드로)' },
];

/** 빨리 걷기 (2026-10-19 태현 님 "걷는 시간이 너무 길어 루즈해") — on = 켜짐 (세이브에 남음) · active = 지금 실제로 ×3 (흔적 · 트레이너 · 병원이 0.5초 안에 다가오면 보통 빠르기) */
export interface FastWalk {
  on: boolean;
  active: boolean;
  onToggle(): void;
}

/** 버튼 얼굴 — 단축키 칸 · 아이콘 · 이름 (labels 만큼) */
function Face({ labels, shortcut, icon, label }: { labels: MenuLabels; shortcut: MenuShortcut; icon: ComponentChildren; label: string }) {
  return (
    <>
      {labels === 'full' && <span class="pg-menu-key">{MENU_KEYS[shortcut]}</span>}
      {icon}
      {labels !== 'icon' && <span class="pg-menu-text">{label}</span>}
    </>
  );
}

export function MenuButtons({
  onOpen,
  points,
  media,
  lead,
  fast,
  labels = 'icon',
}: {
  onOpen(o: Overlay): void;
  /** 내 포켓몬에 남은 포인트 합 (0 이면 안 보임) */
  points: number;
  media: string;
  /** 선두 포켓몬 그림 (◓ 대신) */
  lead: { form: string; shiny: boolean } | null;
  fast?: FastWalk;
  /** 단축키 · 이름을 보일지 (패널 폭 — menuLabels) */
  labels?: MenuLabels;
}) {
  const cls = labels === 'icon' ? 'pg-icon-btn' : 'pg-icon-btn pg-menu-item';
  return (
    <span class="pg-menu-buttons">
      {/* 켜짐 = 눌린 모양 (금색 테두리 + 밝은 남색) · 지금 ×3 이면 ▶▶ 가 금색 */}
      {fast && (
        <Button
          secondary
          extraClass={fast.on ? `${cls} pg-fast pg-on` : `${cls} pg-fast`}
          onClick={fast.onToggle}
          title={`빨리 걷기 ×3 ${fast.on ? '켜짐' : '꺼짐'} (${MENU_KEYS.fast}) — 흔적 · 트레이너 · 병원이 다가오면 보통 빠르기로`}
        >
          <Face labels={labels} shortcut="fast" icon={<Icon name={fast.active ? 'fastOn' : 'fast'} />} label="빨리 걷기" />
        </Button>
      )}
      {BUTTONS.map((b) => (
        <Button key={b.kind} secondary extraClass={b.kind === 'team' && points > 0 ? `${cls} pg-has-points` : cls} onClick={() => onOpen({ kind: b.kind })} title={`${b.title} (${MENU_KEYS[b.kind]})`}>
          <Face
            labels={labels}
            shortcut={b.kind}
            icon={b.icon ? <Icon name={b.icon} /> : lead ? <Sprite media={media} form={lead.form} shiny={lead.shiny} scale={1} crop={20} /> : <Icon name="ball" />}
            label={b.label}
          />
          {b.kind === 'team' && points > 0 && (
            // key = 포인트 수 — 바뀌면 새로 그려져 4번 다시 깜박임 (그 뒤 금색 칠로 멈춤)
            <span key={points} class="pg-points" title={`남은 포인트 ${points} — 내 포켓몬에서 스탯에 나눠 주기`}>
              +{points}
            </span>
          )}
        </Button>
      ))}
    </span>
  );
}
