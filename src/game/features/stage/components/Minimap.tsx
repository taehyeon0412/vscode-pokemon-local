/** 미니맵 (S06 ②): 스테이지 아이콘 · 이름 (번호는 작게) + 가로 막대에 내 위치 · % · 병원 · 상점 · 체육관 (픽셀 아이콘, 단계 12)
 *  + 넓으면 % 뒤 "약 8분 남음" (ideas #118, 엔진 walkLeftMs) · 팀이 위험할 때만 빨간 "팀 HP 38% · 쓰러짐 1" (#47 — 평소엔 자리 안 차지, 2026-10-21 태현 님 "새추천으로") */
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { FacilitySpot } from '../../../core/save';
import { afterFonts } from '../../../ui/fonts';
import { Icon } from '../../../ui/Icon';
import type { StageInfo } from '../model';

export function Minimap({ stage, progress, facilities, gym, leftMs = null, team = null }: { stage: StageInfo; progress: number; facilities: readonly FacilitySpot[]; gym: boolean; leftMs?: number | null; /** 위험할 때만 (teamHealth().danger) */ team?: { hpPct: number; fainted: number } | null }) {
  const pct = Math.min(100, Math.floor(progress * 100));
  // 1분 아래는 "1분 안" (0분 남음이 되지 않게)
  const leftMin = leftMs !== null && leftMs > 0 ? Math.ceil(leftMs / 60_000) : null;
  // 다음에 올 시설 — 막대가 짧으면 (160 아래) 이것만 (아이콘 16px 둘이 서로 · 내 위치와 겹치던 것, 아트 디렉터 밤 점검 · game.css 컨테이너 쿼리)
  const next = facilities.findIndex((f) => f.at > progress);
  // 넘치면 한 단계 (ux-rules U4 — 폭 경계를 손으로 고르지 않음): 이름이 말줄임되면 1 = 남은 시간 → 2 = 번호 → 3 = 팀 HP 칸의 "팀" → 4 = 이름 (아이콘 · 막대 · % 는 남음 · 이름은 title) —
  //   팀 HP 칸 · 남은 시간이 더해져 641 ~ 656 · 700 ~ 720 × 150 에서 "새싹 오솔…" 로 잘리던 것 (bugs 2754 — media 경계 사이 틈) ·
  //   내용 (팀 칸 · HP 자릿수 · 쓰러짐 · 남은 시간) · 크기 · 글꼴이 바뀌면 0 부터 — 바뀐 내용은 재기 전에 바로 적음 (A → B → A 로 돌아오면 A 때 단계가 다시 쓰여 같은 "팀 HP 5%" 에서 번호가 빠지기도 · 남기도 하던 것, UX 2754) ·
  //   그릴 때 그 PC 글꼴로 다시 재서 맥 여유 없이 실제 값 (U4 짧은 글 단계)
  const box = useRef<HTMLSpanElement>(null);
  const key = `${stage.code}|${team ? `${team.fainted > 0 ? 'd' : 'h'}${String(team.hpPct).length}` : '-'}|${leftMin !== null ? 1 : 0}`;
  const [cut, setCut] = useState({ key, n: 0 });
  const n = cut.key === key ? cut.n : 0;
  useLayoutEffect(() => {
    const label = box.current?.querySelector<HTMLElement>('.pg-stage-label');
    const fresh = cut.key !== key;
    let over = false;
    if (n < 4 && label && label.getClientRects().length > 0) {
      const range = document.createRange();
      range.selectNodeContents(label);
      over = range.getBoundingClientRect().width > label.getBoundingClientRect().width + 0.01;
    }
    if (over) setCut({ key, n: n + 1 });
    else if (fresh) setCut({ key, n });
  });
  useEffect(() => {
    const again = () => setCut({ key: '', n: 0 });
    window.addEventListener('resize', again);
    const offFonts = afterFonts(again);
    return () => {
      window.removeEventListener('resize', again);
      offFonts();
    };
  }, []);
  return (
    <span ref={box} class={`pg-minimap${n >= 1 ? ' pg-map-cut1' : ''}${n >= 2 ? ' pg-map-cut2' : ''}${n >= 3 ? ' pg-map-cut3' : ''}${n >= 4 ? ' pg-map-cut4' : ''}`}>
      <span class="pg-stage-name" title={`${stage.name} (${stage.code})`}>
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
