/**
 * S07 세계 지도 — 줄여서 씀 (mvp-spec S07) — ① 갈 수 있는 스테이지 (깬 스테이지 + 지금 스테이지) · ② 잠긴 스테이지 · 🏟 체육관 (1-3 을 깨면 바로)
 * ④ 팀 바꾸기 (스테이지 시작 전에만 — 걷는 중에 연 지도에서는 흐리게) · ③ 닫기.
 * 걷는 중에 다른 스테이지를 고르면 "지금 스테이지 진행이 처음부터 다시예요" 확인 한 번 · 지금 스테이지를 고르면 그대로 이어 함.
 */
import { useState } from 'preact/hooks';
import { dailyView, type GameInput, type GameState } from '../../../core/engine';
import type { StageId } from '../../../core/save';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { formatPlayTime } from '../../../ui/format';
import { ITEM_ICON, mapView } from '../model';
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
  // 오늘의 목표 (#28 · gdd U13 — 개발 모드에서만, 엔진이 꺼져 있으면 null) · 기록 (U12)
  const daily = dailyView(state);
  const rec = state.save.records;
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
      icon="map"
      title="세계 지도"
      extra={
        <>
          숲 {v.badge && <Icon name="badge" title="숲 배지" />}
        </>
      }
      onClose={onClose}
    >
      {/* 칩 줄은 넘치면 다음 줄 (옆으로 잘라 240 에서 "버섯 그늘" · 480 에서 다섯째 칩이 판 끝에서 잘리던 것 — 아트 디렉터 밤 점검) */}
      <Row wrap>
        {v.stages.map((s) => (
          // 지금 스테이지 = 고른 칩 모양 (금색 테두리 · 밝은 남색 · 금색 글씨) — 금색 채움은 주 버튼이라 "눌러야 할 것" 으로 읽혀서, "● 지금" 글은 모양이 대신 (아트 디렉터 5차)
          <Button key={s.id} secondary extraClass={s.state === 'current' ? 'pg-picked' : undefined} disabled={s.state === 'locked'} onClick={() => go(s.id)} title={s.state === 'locked' ? '앞 스테이지를 깨면 열려요' : s.state === 'current' ? '지금 있는 스테이지 (이어서 걷기)' : '새 길로 걷기 (아이템 · 부탁 · 야생이 새로)'}>
            <Icon name={s.state === 'locked' ? 'lock' : s.icon} /> {s.label} <span class="pg-sub">{s.code}</span>
            {s.state === 'cleared' && ' ✓'}
          </Button>
        ))}
        <Button secondary disabled={!v.gym} onClick={() => go('gym')} title={v.gym ? '체육관 대기실로' : '깊은 숲 (1-3) 을 깨면 열려요'}>
          <Icon name={v.gym ? 'gym' : 'lock'} /> 체육관
        </Button>
        <Button secondary disabled={!swap} onClick={onTeam} title={swap ? '보관함과 팀 바꾸기' : '스테이지를 시작하기 전에만 (걷는 중에는 병원에서)'}>
          <Icon name="box" /> 팀 바꾸기{!swap && <span class="pg-sub"> 병원에서</span>}
        </Button>
      </Row>
      {/* 오늘의 목표 = 스테이지 줄 아래 세 줄 (상자 · 할 일 · 한 수 / 할 수 · 보상 — 위에 두면 150 ~ 187 에서 지도의 본 일인 스테이지 버튼이 밀려 안 보이던 것) — 다 하면 상자 금 칠 · 숫자 금색 (색 하나에만 맡기지 않게 상자 모양도 바뀜) */}
      {daily && (
        <div class="pg-daily" aria-label={`오늘의 목표 ${daily.done}/${daily.goals.length}`}>
          <span class="pg-daily-head">
            <b>오늘의 목표</b> <span class="pg-dim">{daily.done}/{daily.goals.length}</span>
          </span>
          {daily.goals.map((g, i) => (
            <span key={i} class={`pg-daily-goal${g.done ? ' pg-on' : ''}`} title={`${g.label} — ${Math.min(g.have, g.need)}/${g.need} · 보상 ${g.reward}`}>
              <span class="pg-daily-box" aria-hidden="true" />
              <span class="pg-daily-label">{g.label}</span>
              <span class="pg-daily-n">
                {Math.min(g.have, g.need)}/{g.need}
              </span>
              {/* 보상 = 물건 아이콘 + ×개수 (받은 것 = 아이콘 + 숫자 — 6장, 글 "보상 몬스터볼 ×2" 는 title · 240 에서 줄이 꺾이던 것, 아트 디렉터 새 화면 한 바퀴) */}
              {(() => {
                const raw = state.save.daily?.goals[i];
                return raw ? (
                  // 다 한 줄 = 받음 ✓ (다 하는 순간 줌 — "보상" 이 아직 받을 것처럼 읽히던 것, UX 리뷰어)
                  <span class="pg-daily-reward" title={`${raw.done ? '받음' : '보상'} ${g.reward.replace(/ (\d+)$/, ' ×$1')}`}>
                    <Icon name={ITEM_ICON[raw.reward]} />
                    {/* 받을 것 = +N (× 는 정보줄 "볼 ×3" 처럼 가진 수로 읽혀서 — UX) */}
                    {raw.done ? `+${raw.rewardN} ✓` : `+${raw.rewardN}`}
                  </span>
                ) : (
                  <span class="pg-daily-reward">보상 {g.reward.replace(/ (\d+)$/, ' ×$1')}</span>
                );
              })()}
            </span>
          ))}
        </div>
      )}
      {/* 기록 (U12 [제안]) = 판 아래 흐린 한 줄 */}
      {daily && rec && (
        <div class="pg-daily-rec">
          {/* 플레이 시간까지 (gdd U12 — 명세 검사관 #53) */}
          {/* 항목마다 줄 안 바뀜 ("걸은 길 / 987.7 스테이지" 로 갈리던 것 — UX) */}
          <span class="pg-nw">이긴 전투 {rec.wins}</span> · <span class="pg-nw">잡은 포켓몬 {rec.catches}</span> · <span class="pg-nw">걸은 길 {(rec.walked / 10000).toFixed(1)} 스테이지</span> · <span class="pg-nw">플레이 {formatPlayTime(state.save.playTimeMs)}</span>
        </div>
      )}
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
