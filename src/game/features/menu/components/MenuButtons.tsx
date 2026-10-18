/**
 * S06 ⑦ ~ ⑩ 정보줄 오른쪽 위 — 🗺 지도 · ◓ 내 포켓몬 · 🎒 가방 · ⚙ 설정 (2026-10-18 태현 님, 모양은 단계 12).
 * 걷는 중에만 보임 (판이 떠 있는 동안 걸음이 멈춤).
 */
import { Button } from '../../../ui/Button';
import { Sprite } from '../../../ui/Sprite';
import type { Overlay } from '../model';

const BUTTONS: { kind: Overlay['kind'] & ('map' | 'team' | 'bag' | 'settings'); icon: string; title: string }[] = [
  { kind: 'map', icon: '🗺', title: '⑦ 세계 지도' },
  { kind: 'team', icon: '◓', title: '⑧ 내 포켓몬 (팀 순서 · 스탯 · 포인트)' },
  { kind: 'bag', icon: '🎒', title: '⑨ 가방 (상처약 · 진화의 돌)' },
  { kind: 'settings', icon: '⚙', title: '⑩ 설정 (알림 · 일반 모드로)' },
];

export function MenuButtons({ onOpen, dot, media, lead }: { onOpen(o: Overlay): void; /** 내 포켓몬에 남은 포인트가 있음 */ dot: boolean; media: string; /** 선두 포켓몬 그림 (◓ 대신) */ lead: { form: string; shiny: boolean } | null }) {
  return (
    <span class="pg-menu-buttons">
      {BUTTONS.map((b) => (
        <Button key={b.kind} secondary extraClass="pg-icon-btn" onClick={() => onOpen({ kind: b.kind })} title={b.title}>
          {b.kind === 'team' && lead ? <Sprite media={media} form={lead.form} shiny={lead.shiny} scale={0.5} /> : b.icon}
          {b.kind === 'team' && dot && <span class="pg-dot" />}
        </Button>
      ))}
    </span>
  );
}
