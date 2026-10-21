/**
 * S20 설정 (gdd S20) — MVP 는 ③ 알림 (U9 · 언제 알리는지는 gdd 4.13 멈춤 · 알림 표) · ⑤ 일반 모드로 · ⑥ 닫기만.
 * 소리 · 게임 속도 · 세이브 내보내기는 다음 버전 (gdd 6).
 */
import { BALANCE } from '../../../core/balance';
import type { GameInput } from '../../../core/engine';
import type { Save } from '../../../core/save';
import { Button } from '../../../ui/Button';
import { Panel, Row } from './Panel';

export function SettingsPanel({ save, onInput, onExit, onClose, dev = false, onSaveIO, saveNote = null }: { save: Save; onInput(i: GameInput): void; onExit(): void; onClose(): void; /** 개발 모드 — 세이브 내보내기 · 불러오기를 숨김 (저장 안 됨 모드) */ dev?: boolean; /** ④ 세이브 내보내기 · 불러오기 (orders #33 — 파일 창은 확장) */ onSaveIO?(kind: 'export' | 'import'): void; /** 내보내기 · 불러오기 결과 한 줄 (3초) — 판 머리 아래 고정 줄에 (판 위에 뜨면 머리 · 첫 줄을 덮던 것, 픽셀 검사원) */ saveNote?: { ok: boolean; text: string } | null }) {
  const on = save.settings.notifications;
  return (
    <Panel icon="gear" title="설정" onClose={onClose} sub={saveNote ? <span class={`pg-saveio-sub${saveNote.ok ? '' : ' pg-saveio-fail'}`} role="status">{saveNote.text}</span> : undefined}>
      {/* 스위치를 한 줄에 · 라벨 열 없이 스위치 글이 라벨 · 좁으면 (480px 아래) "켜짐 · 꺼짐" 을 빼서 줄 수를 줄임 (켜짐 = ✓ + 금색 테두리 — 2026-10-21 스위치 여섯) (2026-10-20 아트 디렉터 4차 — 5줄이 210px 에서 잘리고 오른쪽이 비던 것), 설명은 title.
          자동 전투 (플레이 리뷰어 "자리 비울 준비를 걷는 중에") · 빨리 걷기 = 정보줄 ▶▶ 와 같음 */}
      <Row wrap>
        <Button secondary extraClass={on ? 'pg-picked' : undefined} onClick={() => onInput({ kind: 'notifications', on: !on })} title="알림 (처음 꺼짐) — 켜면 안 볼 때 기다리는 순간 VS Code 알림을 띄워요 (숨긴 지 10초 뒤 · 같은 기다림은 한 번). 꺼도 포켓몬 탭 배지는 늘 떠요">
          {on ? '✓ 알림' : '알림'}
          <span class="pg-long">{on ? ' 켜짐' : ' 꺼짐'}</span>
        </Button>
        <Button secondary extraClass={save.settings.autoBattle ? 'pg-picked' : undefined} onClick={() => onInput({ kind: 'auto-battle', on: !save.settings.autoBattle })} title="자동 전투 — 자리를 비워도 메뉴 · 필살기를 알아서 (전투 중 스위치와 같음)">
          {save.settings.autoBattle ? '✓ 자동 전투' : '자동 전투'}
          <span class="pg-long">{save.settings.autoBattle ? ' 켜짐' : ' 꺼짐'}</span>
        </Button>
        {/* 다음 버전 1단계 (2026-10-21) — 자동 전투 상처약 (기본 켬) · 이미 잡은 종은 마지막 기회 건너뛰기 (기본 끔) */}
        <Button secondary extraClass={save.settings.autoPotion !== false ? 'pg-picked' : undefined} onClick={() => onInput({ kind: 'auto-potion', on: save.settings.autoPotion === false })} title="자동 전투 상처약 — 자동 전투일 때 내 포켓몬 HP 가 30% 아래면 상처약을 써요">
          {/* 켜짐 · 꺼짐은 다른 스위치와 같은 자리 (켜짐만 빠져 있던 것 — 아트 디렉터 밤 점검 · orders #51) */}
          {save.settings.autoPotion !== false ? '✓ 자동 상처약' : '자동 상처약'}
          <span class="pg-long">{save.settings.autoPotion !== false ? ' 켜짐' : ' 꺼짐'}</span>
        </Button>
        <Button secondary extraClass={save.settings.skipCaughtLast === true ? 'pg-picked' : undefined} onClick={() => onInput({ kind: 'skip-caught-last', on: save.settings.skipCaughtLast !== true })} title="잡은 포켓몬은 마지막 기회 건너뛰기 — 이미 잡은 종을 쓰러뜨리면 볼 고르기 없이 지나가요">
          {/* "잡은 종 마지막 기회 볼 건너뛰기" = 설명서 같은 글 → 짧게, 뜻은 title (orders #51) */}
          {/* "볼" 까지 (빠지면 잡은 종과의 전투를 건너뛰는 것처럼 읽히던 것 — UX 리뷰어) */}
          {save.settings.skipCaughtLast === true ? '✓ 잡은 종 볼 건너뛰기' : '잡은 종 볼 건너뛰기'}
          <span class="pg-long">{save.settings.skipCaughtLast === true ? ' 켜짐' : ' 꺼짐'}</span>
        </Button>
        <Button secondary extraClass={save.settings.fastWalk === true ? 'pg-picked' : undefined} onClick={() => onInput({ kind: 'fast-walk', on: save.settings.fastWalk !== true })} title={`빨리 걷기 ×${BALANCE.fastWalkSpeed} — 흔적 · 트레이너 · 병원 · 아이템 · 부탁이 다가오면 보통 빠르기로 (정보줄 ▶▶ 와 같음)`}>
          {save.settings.fastWalk === true ? '✓ 빨리 걷기' : '빨리 걷기'}
          {/* 배수는 실제 값 그대로 ("×3" 이라 써 두고 2.5배로 걷던 것 — 기획 검토 #25) */}
          <span class="pg-long">{save.settings.fastWalk === true ? ` ×${BALANCE.fastWalkSpeed}` : ' 꺼짐'}</span>
        </Button>
        {/* 동작 줄이기 (2026-10-20 태현 님 1안 — 기본 꺼짐 · OS 설정은 안 봄, 맥도 윈도와 같게) — 켜면 꾸밈 움직임 (배지 빛 · +N 깜박 · 레벨업 별 · 말풍선 까딱 · 넓어지기 등) 을 멈춤, 흔들기 · 필살기 꽉 참 같은 게임 정보는 그대로 */}
        <Button secondary extraClass={save.settings.reduceMotion === true ? 'pg-picked' : undefined} onClick={() => onInput({ kind: 'reduce-motion', on: save.settings.reduceMotion !== true })} title="동작 줄이기 — 꾸밈 움직임 (반짝 · 깜박 · 까딱) 을 멈춤. 잡기 흔들기 · 필살기 꽉 참 같은 알림은 그대로">
          {save.settings.reduceMotion === true ? '✓ 동작 줄이기' : '동작 줄이기'}
          <span class="pg-long">{save.settings.reduceMotion === true ? ' 켜짐' : ' 꺼짐'}</span>
        </Button>
      </Row>
      {/* ④ 세이브 (orders #33 · gdd S20 ④) — PC 옮기기 · 백업. 불러오면 확인 상자 (지금 세이브는 백업 파일로 따로 — "보관함" 은 포켓몬 보관함과 헷갈려서, 개발 #48) · 개발 모드는 숨김 */}
      {onSaveIO && !dev && (
        <Row label="세이브">
          <Button secondary onClick={() => onSaveIO('export')} title="지금 세이브를 파일로 저장해요 (PC 옮기기 · 백업)">
            내보내기
          </Button>
          <Button secondary onClick={() => onSaveIO('import')} title="세이브 파일을 불러와 지금 세이브를 바꿔요 — 바꾸기 전에 한 번 더 물어보고, 지금 것은 백업해 둬요">
            불러오기
          </Button>
          <span class="pg-dim pg-long">PC 옮기기 · 백업</span>
        </Row>
      )}
      {/* 단축키 (2026-10-19 전체 점검 — 키보드로 하는 사람이 찾지 않게, 정보줄 메뉴 글자와 같은 자판 칸) */}
      <Row>
        {/* 키 + 뜻 = 한 묶음 (줄은 묶음 사이에서만 — 맨글자가 하나씩 줄어드는 칸이 되어 240 에서 "막 / 기" 처럼 글자마다 줄이 바뀌던 것) */}
        <span class="pg-keys pg-keys-wrap">
          <span class="pg-key-item">
            <span class="pg-menu-key">Space</span> 막기
          </span>
          <span class="pg-key-item">
            <span class="pg-menu-key">Z</span> 필살기
          </span>
          <span class="pg-key-item">
            <span class="pg-menu-key">1</span> ~ <span class="pg-menu-key">5</span> 고르기
          </span>
          <span class="pg-key-item">
            <span class="pg-menu-key">A</span> 자동 전투
          </span>
          <span class="pg-key-item">
            <span class="pg-menu-key">Esc</span> 닫기 · 지나가기
          </span>
        </span>
      </Row>
      <Row>
        <Button secondary onClick={onExit} title="자동저장하고 일반 모드로 (패널 제목줄 🏠 와 같음)">
          일반 모드로
        </Button>
        {/* 줄임표 대신 줄 바꿈 (맥 글자면 240 에서 "진행은 자동으로 저장…" — 픽셀 밤 점검) */}
        <span class="pg-dim pg-wrap-say">진행은 자동으로 저장돼요</span>
      </Row>
    </Panel>
  );
}
