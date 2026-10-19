/** 미니맵 (S06 ②): 스테이지 아이콘 · 이름 (번호는 작게) + 가로 막대에 내 위치 · % · 병원 · 상점 · 체육관 (픽셀 아이콘, 단계 12) */
import type { FacilitySpot } from '../../../core/save';
import { Icon } from '../../../ui/Icon';
import type { StageInfo } from '../model';

export function Minimap({ stage, progress, facilities, gym }: { stage: StageInfo; progress: number; facilities: readonly FacilitySpot[]; gym: boolean }) {
  const pct = Math.min(100, Math.floor(progress * 100));
  return (
    <span class="pg-minimap">
      <span class="pg-stage-name">
        <Icon name={stage.icon} />
        <span class="pg-stage-label">
          {stage.name} <span class="pg-stage-code pg-dim">({stage.code})</span>
        </span>
      </span>
      <span class="pg-mapbar" title={`진행 ${pct}%`}>
        <span class="pg-mapfill" style={{ width: `${progress * 100}%` }} />
        {facilities.map((f) => (
          <span key={`${f.kind}${f.at}`} class="pg-mapicon" style={{ left: `${f.at * 100}%` }} title={f.kind === 'hospital' ? '병원' : '상점'}>
            <Icon name={f.kind === 'hospital' ? 'hospital' : 'shop'} />
          </span>
        ))}
        {gym && (
          <span class="pg-mapicon" style={{ left: '100%' }} title="체육관">
            <Icon name="gym" />
          </span>
        )}
        <span class="pg-mapme" style={{ left: `${progress * 100}%` }} />
      </span>
      <span class="pg-mappct">{pct}%</span>
    </span>
  );
}
