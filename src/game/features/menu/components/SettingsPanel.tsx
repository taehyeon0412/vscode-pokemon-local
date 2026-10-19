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
      <Row label="걷기">
        <Button secondary extraClass={save.settings.fastWalk === true ? 'pg-picked' : undefined} onClick={() => onInput({ kind: 'fast-walk', on: save.settings.fastWalk !== true })} title="빨리 걷기 ×3 — 흔적 · 트레이너 · 병원 · 아이템 · 부탁이 다가오면 보통 빠르기로 (정보줄 ▶▶ 와 같음)">
          {save.settings.fastWalk === true ? '✓ 빨리 걷기 ×3' : '빨리 걷기 ×3'}
        </Button>
        <span class="pg-dim pg-ellipsis">무언가 다가오면 보통 빠르기로</span>
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
