/**
 * S06 스테이지 — 단계 3 의 껍데기: 볼 개수 ① · 스테이지 이름 ② (번호는 작게). 오른쪽 위는 단계 4 의 ⑦ ~ ⑩ 자리.
 * ⑪ 일반 모드는 화면 안에 두지 않음 — 패널 제목줄 🏠 와 겹쳐서 (2026-10-18 태현 님)
 * 가운데 자리는 ③ 주인공 자리 — 단계 4 에서 주인공 · 자동 걷기 · 배경 · 미니맵 막대 · 흔적 · 조우로 바뀜 (지금은 팀 맨 앞 포켓몬을 임시로)
 */
import type { GameState } from '../../../core/engine';
import { BallCount } from '../../../ui/BallCount';
import { InfoBar } from '../../../ui/InfoBar';
import type { Layout } from '../../../ui/layout';
import { Sprite } from '../../../ui/Sprite';
import { STAGES } from '../model';

export interface StagePlaceholderProps {
  state: GameState;
  layout: Layout;
  media: string;
}

export function StagePlaceholder({ state, layout, media }: StagePlaceholderProps) {
  const save = state.save;
  const leadUid = save.party[0];
  const lead = leadUid ? save.monsters[leadUid] : undefined;
  const stage = save.location.screen === 'stage' ? STAGES[save.location.stageId] : null;
  return (
    <div class="pg-screen pg-stage">
      <InfoBar
        left={<BallCount count={save.bag['poke-ball'] ?? 0} />}
        center={
          stage ? (
            <span class="pg-stage-name">
              {stage.icon} {stage.name} <span class="pg-stage-code pg-dim">({stage.code})</span>
            </span>
          ) : (
            <span class="pg-stage-name">🌲 숲</span>
          )
        }
      />
      <div class="pg-body pg-stage-body">
        <div class="pg-stage-note pg-dim">🚧 스테이지 준비 중 — 걷기 · 흔적 · 조우는 다음 단계에서</div>
        {lead && (
          <div class="pg-stage-lead">
            <Sprite media={media} form={lead.form} shiny={lead.shiny} scale={layout.scale} action="walk" title={`Lv ${lead.level}`} />
          </div>
        )}
        <div class="pg-ground" />
      </div>
    </div>
  );
}
