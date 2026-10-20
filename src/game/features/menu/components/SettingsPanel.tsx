/**
 * S20 설정 (gdd S20) — MVP 는 ③ 알림 (U9: 안 볼 때 이로치 · 부탁 · 고를 것) · ⑤ 일반 모드로 · ⑥ 닫기만.
 * 소리 · 게임 속도 · 세이브 내보내기는 다음 버전 (gdd 6).
 */
import type { GameInput } from '../../../core/engine';
import type { Save } from '../../../core/save';
import { Button } from '../../../ui/Button';
import { Panel, Row } from './Panel';

export function SettingsPanel({ save, onInput, onExit, onClose }: { save: Save; onInput(i: GameInput): void; onExit(): void; onClose(): void }) {
  const on = save.settings.notifications;
  return (
    <Panel
      icon="gear"
      title="설정" onClose={onClose}>
      <Row label="알림">
        <Button secondary extraClass={on ? 'pg-picked' : undefined} onClick={() => onInput({ kind: 'notifications', on: !on })} title="패널이 안 보일 때 직접 해야 하는 순간을 VS Code 알림으로 — 이로치 흔적 · 길 위의 부탁 · 진화 · 새 기술 · 체육관 도착 · 클리어 · 패배">
          {on ? '✓ 알림 켜짐' : '알림 꺼짐'}
        </Button>
        <span class="pg-dim pg-ellipsis">안 볼 때 알려 줘요</span>
      </Row>
      {/* 자동 전투 (2026-10-20 플레이 리뷰어 "자리 비울 준비를 걷는 중에 할 수 없음" — 예전엔 전투 안 스위치뿐) */}
      <Row label="전투">
        <Button secondary extraClass={save.settings.autoBattle ? 'pg-picked' : undefined} onClick={() => onInput({ kind: 'auto-battle', on: !save.settings.autoBattle })} title="자동 전투 — 메뉴 · 필살기를 알아서 (전투 중 왼쪽 아래 스위치와 같음)">
          {save.settings.autoBattle ? '✓ 자동 전투' : '자동 전투'}
        </Button>
        <span class="pg-dim pg-ellipsis">자리를 비워도 전투가 저절로</span>
      </Row>
      <Row label="걷기">
        <Button secondary extraClass={save.settings.fastWalk === true ? 'pg-picked' : undefined} onClick={() => onInput({ kind: 'fast-walk', on: save.settings.fastWalk !== true })} title="빨리 걷기 ×3 — 흔적 · 트레이너 · 병원 · 아이템 · 부탁이 다가오면 보통 빠르기로 (정보줄 ▶▶ 와 같음)">
          {save.settings.fastWalk === true ? '✓ 빨리 걷기 ×3' : '빨리 걷기 ×3'}
        </Button>
        <span class="pg-dim pg-ellipsis">무언가 다가오면 보통 빠르기로</span>
      </Row>
      {/* 단축키 (2026-10-19 전체 점검 — 키보드로 하는 사람이 찾지 않게, 정보줄 메뉴 글자와 같은 자판 칸) */}
      <Row label="단축키">
        <span class="pg-keys pg-ellipsis">
          <span class="pg-menu-key">Space</span> 선제공격 · 막기 <span class="pg-menu-key">Z</span> 필살기 <span class="pg-menu-key">1</span> ~ <span class="pg-menu-key">5</span> 고르기{' '}
          <span class="pg-menu-key">Esc</span> 닫기 · 지나가기
        </span>
      </Row>
      <Row label="나가기">
        <Button secondary onClick={onExit} title="자동저장하고 일반 모드로 (패널 제목줄 🏠 와 같음)">
          일반 모드로
        </Button>
        <span class="pg-dim pg-ellipsis">진행은 자동으로 저장돼요</span>
      </Row>
    </Panel>
  );
}
