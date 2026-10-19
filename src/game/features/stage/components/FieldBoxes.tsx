/**
 * 길 · 체육관 위에 뜨는 상자 (임시 디자인 — 단계 12 에서 다시):
 *   S06 ⑥ 병원 · 상점 앞 [들어가기] [지나가기] (5초 뒤 지나감) · S13 병원 안 · S08 "승부다!" + ◓ · S17 패배 · S24 클리어 카드
 *   S16 대기실 · MVP 끝 카드 (관장을 처음 이김)
 * 단축키 Enter · Esc 는 main.ts (부탁과 같은 규칙).
 */
import { BALANCE, TIMING } from '../../../core/balance';
import { canHeal, type GameInput, type GameState } from '../../../core/engine';
import { teamHealthy } from '../../../core/rules/bag';
import { FACILITY_STAFF } from '../../../core/rules/stage';
import { GYM_LEADER } from '../../../core/rules/trainer';
import type { StageId } from '../../../core/save';
import { Button } from '../../../ui/Button';
import { formatMoney } from '../../../ui/format';
import { Sprite } from '../../../ui/Sprite';
import { clearView, lobbyView } from '../../menu/model';

export interface BoxProps {
  state: GameState;
  media: string;
  onInput(i: GameInput): void;
}

/** S06 ⑥ 앞에서 멈춤 · S13 병원 안 (상점 안은 ShopPanel) */
export function FacilityBox({ state, onInput, onBox }: BoxProps & { onBox(): void }) {
  const st = state.runtime.stage;
  if (st?.phase !== 'facility') return null;
  const hospital = st.kind === 'hospital';
  const label = hospital ? '🏥 병원' : '🏪 상점';
  if (!st.inside) {
    const left = Math.max(1, Math.ceil((TIMING.facilityPromptMs - st.ms) / 1000));
    return (
      <div class="pg-banner pg-facility-box">
        <span class="pg-ellipsis">
          <b>{label}</b> {hospital ? '— 회복 · 보관함' : '— 볼 · 상처약'}
        </span>
        <Button onClick={() => onInput({ kind: 'facility', enter: true })} title="Enter">
          들어가기
        </Button>
        <Button secondary onClick={() => onInput({ kind: 'facility', enter: false })} title={`Esc · ${left}초 뒤 지나감`}>
          지나가기 <span class="pg-sub">{left}</span>
        </Button>
      </div>
    );
  }
  if (!hospital) return null; // 상점 안 = ShopPanel (StageScreen)
  const healthy = teamHealthy(state.save);
  return (
    <div class="pg-banner pg-facility-box">
      {/* 말하는 사람 = 길 위 간호순 그림 (건물 옆) — 좁은 패널에선 이 줄을 숨기고 버튼 한 줄만 (game.css) */}
      <span class="pg-ellipsis pg-facility-say">
        <b>{FACILITY_STAFF.hospital.name}</b>: "무료로 회복해 드려요"
      </span>
      {/* 버튼 셋은 한 묶음 — 줄이 바뀌면 글과 버튼 사이에서만 (크기마다 모양이 같게) */}
      <span class="pg-facility-btns">
        <Button onClick={() => onInput({ kind: 'heal' })} disabled={!canHeal(state) || healthy} title={healthy ? '이미 다 건강해요 (PP 까지)' : 'HP · PP · 상태 이상'}>
          {healthy ? '✓ 다 나았어요' : '회복'}
        </Button>
        <Button secondary onClick={onBox} title="보관함과 팀 바꾸기 (여기서는 바꿀 수 있어요)">
          📦<span class="pg-long"> 보관함</span>
        </Button>
        <Button secondary onClick={() => onInput({ kind: 'facility-leave' })} title="Esc">
          나가기
        </Button>
      </span>
    </div>
  );
}

/** S08 — 눈이 마주침 → "승부다!" + 상대 몬스터볼 개수 (어떤 포켓몬인지는 안 보임) */
/** text = 이름 뒤 한 줄 (없으면 ': "승부다!"') · tag = 라이벌 전적 칩 ("전적 2승 1패" · "첫 만남!") — 있으면 라이벌 띠 (색이 다름, gdd 4.12) */
export function TrainerBanner({ name, balls, text, tag }: { name: string; balls: number; text?: string; tag?: string }) {
  return (
    <div class={tag ? 'pg-banner pg-trainer-box pg-rival-box' : 'pg-banner pg-trainer-box'}>
      <span class="pg-ellipsis">
        <b>{name}</b>
        {text ?? ': "승부다!"'}
      </span>
      {tag && <span class="pg-rival-rec">{tag}</span>}
      <span class="pg-foe-balls" title={`상대 포켓몬 ${balls}마리`}>
        {Array.from({ length: balls }, (_, i) => (
          <span key={i} class="pg-ball" />
        ))}
      </span>
    </div>
  );
}

/** S17 패배 — ① 안내 · ② 다시 시작 (마지막 병원 앞 · 관장전이면 대기실) */
export function DefeatBox({ state, onInput }: BoxProps) {
  const st = state.runtime.stage;
  if (st?.phase !== 'defeat') return null;
  const lh = state.save.lastHospital;
  const loc = state.save.location;
  const atHospital = loc.screen === 'stage' && lh?.stageId === loc.stageId;
  const run = loc.screen === 'stage' ? state.save.stages[loc.stageId]?.run : undefined;
  const reach = Math.round((run?.reach ?? 0) * 100);
  // 이 판에서 두 번 넘게 졌으면 — 같은 길 · 같은 트레이너라 그대로 다시 걸으면 또 질 수 있음 (단계 11 테스터)
  const stuck = !st.gym && (run?.retries ?? 0) >= 2;
  const from = atHospital && lh ? Math.round(lh.at * 100) : 0;
  return (
    <div class="pg-banner pg-defeat pg-two">
      <span class="pg-line pg-ellipsis">
        😵 <b>{st.gym ? '관장에게 졌다…' : '졌다… 눈앞이 깜깜해졌다'}</b>
        {st.lost > 0 ? <span class="pg-reward pg-loss">💰 −{formatMoney(st.lost)}</span> : <span class="pg-dim">돈은 그대로</span>}
      </span>
      <span class="pg-line">
        <span class="pg-dim pg-ellipsis">
          {stuck ? (
            '자꾸 지면 🗺 지도로 깬 스테이지에서 키우거나, 약해진 야생에게 볼을 던져 팀을 늘려 보세요'
          ) : (
            <>
              잡은 포켓몬 · 경험치는 그대로 · 팀은 다 회복했어요
              {!st.gym && reach > from && <span class="pg-long"> · {reach}% 까지 갔었어요</span>}
            </>
          )}
        </span>
        <Button onClick={() => onInput({ kind: 'defeat-continue' })} title="Enter">
          {st.gym ? '대기실로' : atHospital ? `다시 시작 (🏥 병원 앞 ${from}%)` : '다시 시작 (처음 0%)'}
        </Button>
      </span>
    </div>
  );
}

/** S24 스테이지 클리어 — ① 안내 (보너스 경험치 · 볼 +1 · 요약 · 새로 만난 포켓몬) · ② 다음 스테이지 · ③ 지도 · ④ 포켓몬 교체 */
export function ClearCard({ state, media, onInput, onMap, onTeam }: BoxProps & { onMap(): void; onTeam(): void }) {
  const loc = state.save.location;
  if (state.runtime.stage?.phase !== 'clear' || loc.screen !== 'stage') return null;
  const v = clearView(state.save, loc.stageId);
  const next: StageId | 'gym' = v.next ?? 'gym';
  return (
    <div class="pg-banner pg-clear pg-two">
      <span class="pg-line">
        <b class="pg-ellipsis">{v.title}</b>
        <span class="pg-reward">
          <span class="pg-long">보너스 </span>경험치 +{v.bonus}
        </span>
        <span class="pg-reward">◓ +{v.balls}</span>
        {v.seen.slice(0, 4).map((s) => (
          <span key={s.dex} class="pg-clear-new" title="이번에 처음 만난 포켓몬">
            <Sprite media={media} form={s.form} scale={0.75} />
          </span>
        ))}
      </span>
      <span class="pg-line">
        <span class="pg-dim pg-ellipsis">
          잡은 포켓몬 {v.caught} · 이긴 트레이너 {v.trainers} · {v.minutes}분
        </span>
        <Button onClick={() => onInput({ kind: 'travel', to: next })} title="Enter">
          {next === 'gym' ? '🏟' : '▶'}
          <span class="pg-long">{next === 'gym' ? ' 체육관으로' : ' 다음 스테이지'}</span>
        </Button>
        <Button secondary onClick={onMap} title="③ 지도">
          🗺<span class="pg-long"> 지도</span>
        </Button>
        <Button secondary onClick={onTeam} title="④ 포켓몬 교체 — 보관함과 팀을 바로 바꿔요">
          📦<span class="pg-long"> 포켓몬 교체</span>
        </Button>
      </span>
    </div>
  );
}

/** S16 체육관 대기실 — ④ 추천 레벨 · ⑤ 병원 (회복) · ⑥ 보관함 · ⑦ 상점 · ② 도전 · ③ 세계 지도 */
export function LobbyBox({ state, onInput, onBox, onShop, onMap }: BoxProps & { onBox(): void; onShop(): void; onMap(): void }) {
  if (state.runtime.stage?.phase !== 'lobby') return null;
  const v = lobbyView(state.save);
  const healthy = teamHealthy(state.save);
  return (
    <div class="pg-banner pg-lobby pg-two">
      <span class="pg-line">
        <b class="pg-ellipsis">🏟 숲 체육관 — {GYM_LEADER.name}</b>
        <span class={v.short ? 'pg-lv-short' : 'pg-dim'} title="추천 레벨 · 내 팀 평균 레벨">
          추천 Lv {v.recommended} · <span class="pg-long">센 3마리 </span>평균 Lv {v.average}
        </span>
        {state.save.badges.includes('forest') && <span class="pg-reward">🏅</span>}
      </span>
      <span class="pg-line">
        <Button secondary onClick={() => onInput({ kind: 'heal' })} disabled={healthy} title={healthy ? '이미 다 건강해요' : '⑤ 병원 — 무료로 다 회복'}>
          🏥<span class="pg-long"> 회복</span>
        </Button>
        <Button secondary onClick={onBox} title="⑥ 보관함과 팀 바꾸기">
          📦<span class="pg-long"> 보관함</span>
        </Button>
        <Button secondary onClick={onShop} title="⑦ 상점">
          🏪<span class="pg-long"> 상점</span>
        </Button>
        <Button onClick={() => onInput({ kind: 'challenge' })} title="② 관장 3마리와 1:1 토너먼트 (도망 불가)">
          ⚔ 도전!
        </Button>
        <Button secondary onClick={onMap} title="③ 깬 스테이지로 가서 키우기">
          🗺<span class="pg-long"> 세계 지도</span>
        </Button>
      </span>
    </div>
  );
}

/** MVP 끝 카드 — 관장을 처음 이김: 배지 → "숲 클리어! 다음 지역은 준비 중이에요" → 세계 지도 (숲에서 계속 키우기 · 다시 도전) */
export function BadgeCard({ state, onInput, onMap }: BoxProps & { onMap(): void }) {
  if (state.runtime.stage?.phase !== 'badge') return null;
  return (
    <div class="pg-banner pg-badge-card pg-two">
      <span class="pg-line pg-ellipsis">
        <span class="pg-badge-glow">🏅</span> <b>숲 배지를 받았다!</b> 🎉 숲 클리어! 다음 지역은 준비 중이에요
      </span>
      <span class="pg-line">
        <span class="pg-reward">💰 +{formatMoney(BALANCE.gymFirstMoney)}</span>
        <span class="pg-reward" title="가방에서 써요 (냄새꼬 → 라플레시아 등)">🍃 리프의돌</span>
        <span class="pg-dim pg-ellipsis">숲에서 계속 키우거나 관장에게 다시 도전할 수 있어요</span>
        <Button
          onClick={() => {
            onInput({ kind: 'badge-continue' });
            onMap();
          }}
          title="Enter"
        >
          🗺 세계 지도
        </Button>
        <Button secondary onClick={() => onInput({ kind: 'badge-continue' })}>
          대기실로
        </Button>
      </span>
    </div>
  );
}
