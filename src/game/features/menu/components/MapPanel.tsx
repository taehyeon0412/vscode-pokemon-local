/**
 * S07 세계 지도 — 줄여서 씀 (mvp-spec S07) — ① 갈 수 있는 스테이지 (깬 스테이지 + 지금 스테이지) · ② 잠긴 스테이지 · 🏟 체육관 (1-3 을 깨면 바로)
 * ④ 팀 바꾸기 (스테이지 시작 전에만 — 걷는 중에 연 지도에서는 흐리게) · ③ 닫기.
 * 걷는 중에 다른 스테이지를 고르면 "지금 스테이지 진행이 처음부터 다시예요" 확인 한 번 · 지금 스테이지를 고르면 그대로 이어 함.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { dailyView, type GameInput, type GameState } from '../../../core/engine';
import { regionHere, type RegionId } from '../../../core/rules/region';
import type { StageId } from '../../../core/save';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { badgeIcon, isNewRegion, regionIcon } from '../../../ui/regionArt';
import { formatPlayTime } from '../../../ui/format';
import { josaOf } from '../../../core/text';
import { ITEM_ICON, mapView, type MapRegion } from '../model';
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
  // 오늘의 목표 (#28 · gdd U13 — 모두에게, orders #59 · 엔진이 꺼져 있으면 null) · 기록 (U12)
  const daily = dailyView(state);
  const rec = state.save.records;
  // 오늘의 목표 알림 ("… · [M] 지도") 이 떠 있을 때 열면 목표 칸까지 내려서 엶 — 240 · 480 × 150 에서 목표가 "▼ 더" 밑에 있어 알림이 보낸 곳에 목표가 안 보이던 것 (#59 UX 다시 보기)
  const dailyBox = useRef<HTMLDivElement>(null);
  const toDaily = state.runtime.toast?.text.startsWith('오늘의 목표') ?? false;
  useLayoutEffect(() => {
    const el = dailyBox.current;
    const body = el?.closest<HTMLElement>('.pg-panel-body');
    if (!toDaily || !el || !body) return;
    body.scrollTop += Math.round(el.getBoundingClientRect().top - body.getBoundingClientRect().top) - 4;
    // 처음 그릴 때 한 번만
  }, []);
  // 지역 (orders #67) — 연 지역이 둘 넘거나 · 잠긴 지역 · 고를 곳이 있으면 판 머리 줄에 지역 탭 (상점 [사기][팔기] 와 같은 탭 부품). 고른 탭 = 보는 지역 (처음엔 지금 지역)
  const hereId = regionHere(state.save.location).id;
  // 개발 #66 mapView — 연 지역 (꺼지면 지금 지역 하나) · 고를 곳 · 잠긴 곳
  const regions: MapRegion[] = v.regions.length ? v.regions : [{ id: hereId, name: v.region, k: 1, badge: v.badge, here: true, stages: v.stages, gym: v.gym }];
  const { next, locked } = v;
  const tabsOn = regions.length > 1 || locked.length > 0;
  const first = regions[0] as MapRegion;
  // 새로 연 지역 = 가 본 기록이 없음 → 탭에 NEW (빨간 글자 하나 — 6장 · ui/regionArt)
  const isNew = (r: MapRegion) => isNewRegion(r, state.save.stages);
  // 안 가 본 새 지역이 있으면 그 지역 탭부터 — 알림 중에만 그랬더니 알림이 지난 뒤 대기실에서 M 이면 숲 탭이던 것 (Enter 길은 해변 탭 — 개발 UX #70)
  const toNew = regions.find(isNew);
  const [viewId, setViewIdRaw] = useState<RegionId>(toNew?.id ?? regions.find((r) => r.here)?.id ?? first.id);
  const view = regions.find((r) => r.id === viewId) ?? first;
  const [confirm, setConfirm] = useState<string | null>(null);
  // 탭을 바꾸면 떠 있던 확인은 지움 (숲 탭으로 바꿔도 [가기] 가 해변 2-1 로 가던 것 — #67 UX 리뷰어)
  const setViewId = (id: RegionId) => {
    setViewIdRaw(id);
    setConfirm(null);
  };
  // 머리 줄이 넘치면 한 단계 (ux-rules U4 — 폭을 손으로 고르지 않음 · 맥 여유 1.1): 1 = 지도 아이콘 · 구분선 뺌 · 2 = NEW 글자 → 빨간 점 (240 맥 글자에서 "해변 NEW" 가 ✕ 밑에 7px 깔리던 것 — #67 UX 리뷰어)
  // 확인이 뜨면 판을 맨 위로 (내려서 칩을 누른 경우에도 확인 줄이 보이게)
  useLayoutEffect(() => {
    if (!confirm) return;
    const body = dailyBox.current?.closest<HTMLElement>('.pg-panel-body') ?? tabsBox.current?.closest('.pg-panel')?.querySelector<HTMLElement>('.pg-panel-body');
    if (body) body.scrollTop = 0;
  }, [confirm]);
  const tabsBox = useRef<HTMLSpanElement>(null);
  const [tight, setTight] = useState(0);
  useLayoutEffect(() => {
    const tabs = tabsBox.current;
    const head = tabs?.closest<HTMLElement>('.pg-panel-head');
    if (!tabs || !head || tight >= 2) return;
    const cs = getComputedStyle(head);
    const inner = head.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const gap = parseFloat(cs.columnGap) || 0;
    const range = document.createRange();
    range.selectNodeContents(tabs);
    // 탭 묶음 자체 폭도 견줌 (Range 는 앞 구분선 ::before · 여백을 안 세어 368 ~ 369 에서 1px 잘림을 못 봤음 — 픽셀 검사원)
    let used = Math.max(range.getBoundingClientRect().width, tabs.getBoundingClientRect().width) * 1.1;
    let n = 1;
    head.childNodes.forEach((c) => {
      // 그림 (svg) 도 셈 — HTMLElement 만 세면 지도 아이콘 16px 이 빠져 240 에서 넘침을 못 봤음
      if (!(c instanceof Element) || c.contains(tabs)) return;
      const w = c.getBoundingClientRect().width;
      if (w === 0) return;
      used += w;
      n += 1;
    });
    if (used + (n - 1) * gap > inner + 0.5) setTight((t) => t + 1);
  });
  // 다시 잴 때 — 처음 그림은 판 폭이 아직 0 일 수 있어 400ms · 글꼴이 온 뒤 · 크기가 바뀌면 (0 단계부터) 다시 그려 잼 (useFit 과 같은 박자)
  const [, setMeasure] = useState(0);
  useEffect(() => {
    const again = () => setMeasure((n) => n + 1);
    const reset = () => {
      setTight(0);
      again();
    };
    const t = window.setTimeout(again, 400);
    void document.fonts?.ready.then(again);
    window.addEventListener('resize', reset);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', reset);
    };
  }, []);
  const go = (to: StageId | 'gym', region?: RegionId) => {
    const here = state.save.location.screen === 'stage' ? state.save.location.stageId : null;
    if (to === here && midStage) return onClose(); // 지금 스테이지 = 그대로 이어 함
    const key = to === 'gym' && region ? `gym:${region}` : to;
    if (midStage && confirm !== key) return setConfirm(key);
    // 다른 지역 체육관 = to 'gym' + region (개발 #66)
    onInput({ kind: 'travel', to, ...(to === 'gym' && region && region !== hereId ? { region } : {}) });
    onClose();
  };
  const goConfirm = () => {
    if (!confirm) return;
    const [to, region] = confirm.startsWith('gym:') ? ['gym' as const, confirm.slice(4) as RegionId] : [confirm as StageId, undefined];
    go(to, region);
  };
  // 지역 끝 스테이지 이름 — 체육관 잠김 안내 ("깊은 숲을 깨면 열려요" · "등대 곶을 …")
  const lastName = view.stages[view.stages.length - 1]?.label ?? '지역 끝 스테이지';
  return (
    <Panel
      icon="map"
      title="세계 지도"
      extra={
        tabsOn ? (
          // 지역 탭 — 그림 + 이름 (+ 배지 · NEW · 지금) · 잠긴 지역 = 자물쇠 "???" (점선 — 못 누름 모양, 원칙 7) · 360 아래는 "세계 지도" 이름표를 뺌 (상점 탭과 같은 규칙)
          <span class={`pg-shop-tabs pg-region-tabs${tight ? ` pg-tight${tight}` : ''}`} role="tablist" ref={tabsBox}>
            {regions.map((r) => (
              <Button key={r.id} secondary extraClass={r.id === view.id ? 'pg-picked' : undefined} onClick={() => setViewId(r.id)} title={`${r.name}${r.here ? ' — 지금 있는 지역' : ''}${r.badge ? ' · 배지 받음' : ''}`}>
                {/* 지금 있는 지역 = 그림 오른쪽 아래 빨간 네모 점 (미니맵 "내 위치" 와 같은 점 — 금 칠은 "보는 곳" 이라 "지금" 이 글자 하나뿐이고 480 아래선 빠지던 것, 아트 디렉터) */}
                <span class="pg-region-ico">
                  <Icon name={regionIcon(r.id)} />
                  {r.here && <span class="pg-region-me" aria-hidden="true" />}
                </span>{' '}
                {r.name}
                {r.badge && <Icon name={badgeIcon(r.id)} />}
                {isNew(r) && <span class="pg-region-new">NEW</span>}
                {r.here && <span class="pg-sub pg-region-here"> 지금</span>}
              </Button>
            ))}
            {locked.length > 0 && (
              <Button secondary disabled extraClass="pg-region-locked" onClick={() => undefined} title={`관장을 이기면 새 지역이 열려요 (남은 곳 ${locked.length + next.length})`}>
                <Icon name="lock" />
                <span class="pg-region-qq"> ???</span>
              </Button>
            )}
          </span>
        ) : (
          <>
            {/* 지금 지역 (숲 · 해변 — 개발 b80dfc7 mapView.region) */}
            {v.region} {v.badge && <Icon name={badgeIcon(hereId)} title={`${v.region} 배지`} />}
          </>
        )
      }
      onClose={onClose}
    >
      {/* 이동 확인 = 판 맨 위 (맨 아래면 150 ~ 187 에서 오늘의 목표 아래로 숨어 경고를 못 본 채 두 번째 누름에 진행이 날아가던 것 — #67 UX 리뷰어) */}
      {confirm && (
        // 줄 바꿈 (240 에서 "지금 스테이지 진행…" 줄임표 — U4) · 문장은 크림 · "처음부터 다시" 만 빨강 (VS Code 경고 노랑 대신 — 0장)
        <Row wrap>
          <span class="pg-map-confirm">
            지금 스테이지 진행이 <b class="pg-em">처음부터 다시</b>예요 — 갈까요?
          </span>
          <Button onClick={goConfirm}>가기</Button>
          <Button secondary onClick={() => setConfirm(null)}>
            취소
          </Button>
        </Row>
      )}
      {/* 다음 지역 고르기 (관장 첫 승 뒤 남은 곳이 둘 넘을 때 — 개발 #66 next, 고를 때까지 남음) = 판 맨 위 한 줄 · 고른 곳은 연 지역에 더해지고 이동은 그 지역 탭에서 */}
      {next.length > 0 && (
        // 결정 띠 = 밝은 남색 + 1px 금선 (5장 특별한 순간 — 아래 스테이지 칩 줄과 같은 무게로 섞이던 것, 아트 디렉터) · 첫 버튼 ▸
        <div class="pg-panel-row pg-panel-wrap pg-region-pick-row">
          <b class="pg-region-pick-title">다음 지역을 골라요</b>
          {next.map((n) => (
            <Button key={n.id} secondary extraClass="pg-region-pick" onClick={() => {
                onInput({ kind: 'region-pick', region: n.id });
                // 고른 곳 탭으로 (띠가 사라지고 지금 지역 그대로라 고른 지역 스테이지가 안 보이던 것 — #67 UX 리뷰어)
                setViewId(n.id);
              }} title={`${n.name} 지역을 열어요 — 고르지 않은 곳은 다음 관장 뒤에 다시 나와요`}>
              <Icon name={regionIcon(n.id)} /> {n.name}
            </Button>
          ))}
        </div>
      )}
      {/* 칩 줄은 넘치면 다음 줄 (옆으로 잘라 240 에서 "버섯 그늘" · 480 에서 다섯째 칩이 판 끝에서 잘리던 것 — 아트 디렉터 밤 점검) */}
      <Row wrap>
        {view.stages.map((s) => (
          // 지금 스테이지 = 고른 칩 모양 (금색 테두리 · 밝은 남색 · 금색 글씨) — 금색 채움은 주 버튼이라 "눌러야 할 것" 으로 읽혀서, "● 지금" 글은 모양이 대신 (아트 디렉터 5차)
          <Button key={s.id} secondary extraClass={s.state === 'current' ? 'pg-picked' : undefined} disabled={s.state === 'locked'} onClick={() => go(s.id)} title={s.state === 'locked' ? '앞 스테이지를 깨면 열려요' : s.state === 'current' ? '지금 있는 스테이지 (이어서 걷기)' : '새 길로 걷기 (아이템 · 부탁 · 야생이 새로)'}>
            <span class="pg-region-ico">
              <Icon name={s.state === 'locked' ? 'lock' : s.icon} />
              {s.state === 'current' && <span class="pg-region-me" aria-hidden="true" />}
            </span>{' '}
            {s.label} <span class="pg-sub">{s.code}</span>
            {s.state === 'cleared' && ' ✓'}
          </Button>
        ))}
        <Button secondary disabled={!view.gym} onClick={() => go('gym', view.id)} title={view.gym ? `${view.name} 체육관 대기실로` : `${lastName}${josaOf(lastName, '을/를')} 깨면 열려요`}>
          <Icon name={view.gym ? 'gym' : 'lock'} /> 체육관
        </Button>
        <Button secondary disabled={!swap} onClick={onTeam} title={swap ? '보관함과 팀 바꾸기' : '스테이지를 시작하기 전에만 (걷는 중에는 병원에서)'}>
          <Icon name="box" /> 팀 바꾸기{!swap && <span class="pg-sub"> 병원에서</span>}
        </Button>
      </Row>
      {/* 오늘의 목표 = 스테이지 줄 아래 세 줄 (상자 · 할 일 · 한 수 / 할 수 · 보상 — 위에 두면 150 ~ 187 에서 지도의 본 일인 스테이지 버튼이 밀려 안 보이던 것) — 다 하면 상자 금 칠 · 숫자 금색 (색 하나에만 맡기지 않게 상자 모양도 바뀜) */}
      {daily && (
        <div class="pg-daily" ref={dailyBox} aria-label={`오늘의 목표 ${daily.done}/${daily.goals.length}`}>
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
    </Panel>
  );
}
