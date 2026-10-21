/** 미니맵 (S06 ②): 스테이지 아이콘 · 이름 (번호는 작게) + 가로 막대에 내 위치 · % · 병원 · 상점 · 체육관 (픽셀 아이콘, 단계 12)
 *  + 넓으면 % 뒤 "약 8분 남음" (ideas #118, 엔진 walkLeftMs) · 팀이 위험할 때만 빨간 "팀 HP 38% · 쓰러짐 1" (#47 — 평소엔 자리 안 차지, 2026-10-21 태현 님 "새추천으로") */
import type { FacilitySpot } from '../../../core/save';
import { Icon } from '../../../ui/Icon';
import type { StageInfo } from '../model';

export function Minimap({ stage, progress, facilities, gym, leftMs = null, team = null }: { stage: StageInfo; progress: number; facilities: readonly FacilitySpot[]; gym: boolean; leftMs?: number | null; /** 위험할 때만 (teamHealth().danger) */ team?: { hpPct: number; fainted: number } | null }) {
  const pct = Math.min(100, Math.floor(progress * 100));
  // 1분 아래는 "1분 안" (0분 남음이 되지 않게)
  const leftMin = leftMs !== null && leftMs > 0 ? Math.ceil(leftMs / 60_000) : null;
  // 다음에 올 시설 — 막대가 짧으면 (120 아래) 이것만 (아이콘 16px 둘이 서로 · 내 위치와 겹치던 것, 아트 디렉터 밤 점검 · game.css 컨테이너 쿼리)
  const next = facilities.findIndex((f) => f.at > progress);
  return (
    <span class="pg-minimap">
      <span class="pg-stage-name">
        <Icon name={stage.icon} />
        <span class="pg-stage-label">
          {stage.name} <span class="pg-stage-code pg-dim">({stage.code})</span>
        </span>
      </span>
      <span class="pg-mapbar" title={`진행 ${pct}%${leftMin !== null ? ` · 약 ${leftMin}분 남음 (전투 · 부탁 빼고)` : ''}`}>
        <span class="pg-mapfill" style={{ width: `${progress * 100}%` }} />
        {facilities.map((f, i) => (
          <span key={`${f.kind}${f.at}`} class={i === next ? 'pg-mapicon pg-mapicon-next' : 'pg-mapicon pg-mapicon-more'} style={{ left: `${f.at * 100}%` }} title={f.kind === 'hospital' ? '병원' : '상점'}>
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
      {leftMin !== null && (
        <span class="pg-mapleft pg-dim" title="남은 걷기 시간 (전투 · 부탁 빼고)">
          {leftMin <= 1 ? '1분 안' : `약 ${leftMin}분 남음`}
        </span>
      )}
      {team && (
        <span class="pg-team-hp" title="팀 HP 합 · 쓰러진 포켓몬 — 병원 · 대기실에서 회복해요">
          <span class="pg-team-word">팀 </span>HP {team.hpPct}%{team.fainted > 0 && <span class="pg-team-down"> · 쓰러짐 {team.fainted}</span>}
        </span>
      )}
    </span>
  );
}
