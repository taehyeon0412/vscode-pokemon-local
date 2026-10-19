/**
 * S07 세계 지도 — 줄여서 씀 (mvp-spec S07) — ① 갈 수 있는 스테이지 (깬 스테이지 + 지금 스테이지) · ② 잠긴 스테이지 · 🏟 체육관 (1-3 을 깨면 바로)
 * ④ 팀 바꾸기 (스테이지 시작 전에만 — 걷는 중에 연 지도에서는 흐리게) · ③ 닫기.
 * 걷는 중에 다른 스테이지를 고르면 "지금 스테이지 진행이 처음부터 다시예요" 확인 한 번 · 지금 스테이지를 고르면 그대로 이어 함.
 */
import { useState } from 'preact/hooks';
import type { GameInput, GameState } from '../../../core/engine';
import type { StageId } from '../../../core/save';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { mapView } from '../model';
import { Panel, Row } from './Panel';

export interface MapPanelProps {
  state: GameState;
  /** 팀 바꾸기를 할 수 있는 곳 (클리어 카드 · 대기실에서 연 지도) */
  swap: boolean;
  /** 걷는 중에 연 지도 — 다른 곳으로 가면 지금 스테이지는 처음부터 */
  midStage: boolean;
  onInput(i: GameInput): void;
  onTeam(): void;
  onClose(): void;
}

export function MapPanel({ state, swap, midStage, onInput, onTeam, onClose }: MapPanelProps) {
  const v = mapView(state);
  const [confirm, setConfirm] = useState<StageId | 'gym' | null>(null);
  const go = (to: StageId | 'gym') => {
    const here = state.save.location.screen === 'stage' ? state.save.location.stageId : null;
    if (to === here && midStage) return onClose(); // 지금 스테이지 = 그대로 이어 함
    if (midStage && confirm !== to) return setConfirm(to);
    onInput({ kind: 'travel', to });
    onClose();
  };
  return (
    <Panel
      title={
        <>
          <Icon name="map" /> 세계 지도 · 숲 {v.badge && <Icon name="badge" title="숲 배지" />}
        </>
      } extra={midStage ? '다른 스테이지로 가면 지금 스테이지는 처음부터 다시예요' : '깬 스테이지에서 키울 수 있어요'} onClose={onClose}>
      <Row>
        {v.stages.map((s) => (
          <Button key={s.id} secondary={s.state !== 'current'} disabled={s.state === 'locked'} onClick={() => go(s.id)} title={s.state === 'locked' ? '앞 스테이지를 깨면 열려요' : s.state === 'current' ? '지금 스테이지 (이어서 걷기)' : '새 길로 걷기 (아이템 · 부탁 · 야생이 새로)'}>
            <Icon name={s.state === 'locked' ? 'lock' : s.icon} /> {s.label} <span class="pg-sub">{s.code}</span>
            {s.state === 'cleared' && ' ✓'}
            {s.state === 'current' && ' ●'}
          </Button>
        ))}
        <Button secondary={!v.gym} disabled={!v.gym} onClick={() => go('gym')} title={v.gym ? '체육관 대기실로' : '깊은 숲 (1-3) 을 깨면 열려요'}>
          <Icon name={v.gym ? 'gym' : 'lock'} /> 체육관
        </Button>
        <Button secondary disabled={!swap} onClick={onTeam} title={swap ? '보관함과 팀 바꾸기' : '스테이지를 시작하기 전에만 (걷는 중에는 병원에서)'}>
          <Icon name="box" /> 팀 바꾸기
        </Button>
      </Row>
      {confirm && (
        <Row>
          <span class="pg-warning">지금 스테이지 진행이 처음부터 다시예요 — 갈까요?</span>
          <Button onClick={() => go(confirm)}>가기</Button>
          <Button secondary onClick={() => setConfirm(null)}>
            취소
          </Button>
        </Row>
      )}
    </Panel>
  );
}
