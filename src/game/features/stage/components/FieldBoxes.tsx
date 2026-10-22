/**
 * 길 · 체육관 위에 뜨는 상자 (단계 12 디자인 — 전투와 같은 판 · 픽셀 아이콘, game.css 공통 판 · 버튼):
 *   S06 ⑥ 병원 · 상점 앞 [들어가기] [지나가기] (10초 뒤 지나감) · S13 병원 안 · S08 "승부다!" + ◓ · S17 패배 · S24 클리어 카드
 *   S16 대기실 · MVP 끝 카드 (관장을 처음 이김)
 * 단축키 Enter · Esc 는 main.ts (부탁과 같은 규칙).
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { BALANCE, TIMING } from '../../../core/balance';
import { canHeal, gymLeaderOf, regionsOn, teamLock, waitReason, type GameInput, type GameState } from '../../../core/engine';
import { defeatWaits } from '../../../core/engine/play';
import { maxHpOf, teamHealth, teamHealthy } from '../../../core/rules/bag';
import { itemName } from '../../../core/rules/items';
import { regionGymMoney, regionGymTeam, regionHere, regionOrder } from '../../../core/rules/region';
import { FACILITY_STAFF } from '../../../core/rules/stage';
import { aliveCount, gymHint, shortTrainerName } from '../../../core/rules/trainer';
import { josaOf } from '../../../core/text';
import { speciesOf } from '../../../data';
import type { StageId } from '../../../core/save';
import { Button } from '../../../ui/Button';
import { Face } from '../../../ui/Face';
import { Icon } from '../../../ui/Icon';
import { badgeIcon, isNewRegion, regionIcon } from '../../../ui/regionArt';
import { KeyCap } from '../../../ui/KeyCap';
import { formatMoney } from '../../../ui/format';
import { Sprite } from '../../../ui/Sprite';
import { useFit } from '../../../ui/useFit';
import { clearView, lobbyView, mapView } from '../../menu/model';
import { STAGES, VS_MS } from '../model';
import { TypeTag } from '../../battle/components/TypeTag';

export interface BoxProps {
  state: GameState;
  media: string;
  onInput(i: GameInput): void;
}

/** S06 ⑥ 앞에서 멈춤 · S13 병원 안 (상점 안은 ShopPanel) */
export function FacilityBox({ state, media, onInput, onBox }: BoxProps & { onBox(): void }) {
  const st = state.runtime.stage;
  if (st?.phase !== 'facility') return null;
  const hospital = st.kind === 'hospital';
  if (!st.inside) {
    const left = Math.max(1, Math.ceil((TIMING.facilityPromptMs - st.ms) / 1000));
    // 병원 앞 = 팀 상태 (ideas #42 — 다 건강하면 엔진이 멈추지 않고 지나감) · 주 버튼 [회복하고 가기] 한 번에 (#43) · 들어가기 (보관함) 는 작게
    const team = hospital ? teamHealth(state.save) : null;
    // HP 가 가득인데 멈춘 까닭 (PP · 상태 이상) 을 글로 — "팀 HP 100%" 인데 왜 멈추나 싶던 것 (UX 리뷰어) · 비율은 내림 (99.5% 가 100% 로 보이지 않게)
    const party = state.save.party.map((uid) => state.save.monsters[uid]).filter((m) => m !== undefined);
    const hpFull = party.every((m) => m.hp >= maxHpOf(m));
    const hpPct = Math.floor((party.reduce((a, m) => a + Math.max(0, m.hp), 0) / Math.max(1, party.reduce((a, m) => a + maxHpOf(m), 0))) * 100);
    const need = hpFull ? (party.some((m) => m.status) ? '상태 회복' : 'PP 회복') : null;
    return (
      <div class="pg-banner pg-facility-box">
        <span class="pg-ellipsis">
          {/* 상점 앞 = 내 돈 (다음 버전 1단계 #119 — 들어가기 전에 살 수 있는지) */}
          <Icon name={hospital ? 'hospital' : 'shop'} /> <b class={hospital ? 'pg-fac-word' : undefined}>{hospital ? '병원' : '상점'}</b>{' '}
          {team ? (
            <span class={team.danger ? 'pg-team-hp' : 'pg-dim'} title="팀 HP 합 · 쓰러진 포켓몬 · 회복할 것">
              {need ?? `팀 HP ${hpPct}%`}
              {team.fainted > 0 && <span class="pg-fac-down"> · 쓰러짐 {team.fainted}</span>}
            </span>
          ) : (
            <span class="pg-money" title="내 돈">
              <span class="pg-dim">내 돈 </span>
              <Icon name="coin" /> {formatMoney(state.save.money)}
            </span>
          )}
        </span>
        {hospital ? (
          <>
            <Button onClick={() => onInput({ kind: 'facility-heal' })} title="다 회복하고 그대로 걸어가요 (Enter)">
              <KeyCap k="Enter" /> 회복하고 가기
            </Button>
            {/* 좁으면 보관함 그림만 (올리면 이름) — 병원 안 = 보관함 · 팀 바꾸기 */}
            <Button secondary onClick={() => onInput({ kind: 'facility', enter: true })} title="들어가기 — 보관함 · 팀 바꾸기">
              <Icon name="box" />
              <span class="pg-enter-word"> 들어가기</span>
            </Button>
          </>
        ) : (
          <Button onClick={() => onInput({ kind: 'facility', enter: true })} title="Enter">
            <KeyCap k="Enter" /> 들어가기
          </Button>
        )}
        <Button secondary extraClass="pg-pass-btn" onClick={() => onInput({ kind: 'facility', enter: false })} title={`Esc · ${left}초 뒤 지나감`}>
          <KeyCap k="Esc" /> <span class="pg-pass-word">지나가기 </span>
          <span class="pg-sub">{left}초</span>
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
        <Face media={media} id={FACILITY_STAFF.hospital.look} />
        <span class="pg-speaker">{FACILITY_STAFF.hospital.name}</span> 무료로 회복해 드려요
      </span>
      {/* 버튼 셋은 한 묶음 — 줄이 바뀌면 글과 버튼 사이에서만 (크기마다 모양이 같게) */}
      <span class="pg-facility-btns">
        <Button onClick={() => onInput({ kind: 'heal' })} disabled={!canHeal(state) || healthy} title={healthy ? '이미 다 건강해요 (PP 까지)' : 'HP · PP · 상태 이상 (Enter)'}>
          {healthy ? (
            '✓ 다 나았어요'
          ) : (
            <>
              <KeyCap k="Enter" /> 회복
            </>
          )}
        </Button>
        <Button secondary onClick={onBox} title="보관함과 팀 바꾸기 (여기서는 바꿀 수 있어요)">
          <Icon name="box" />
          {/* 400 부터 글자 (병원 앞 [들어가기] 와 같은 규칙 — 480 에서 자리가 있는데 아이콘만이던 것, UX 밤 점검 U5) */}
          <span class="pg-enter-word"> 보관함</span>
        </Button>
        <Button secondary onClick={() => onInput({ kind: 'facility-leave' })} title="Esc">
          <KeyCap k="Esc" /> 나가기
        </Button>
      </span>
    </div>
  );
}

/** S08 — 눈이 마주침 → "승부다!" + 상대 몬스터볼 개수 (어떤 포켓몬인지는 안 보임) */
/** text = 이름 뒤 한 줄 (없으면 ': "승부다!"') · tag = 라이벌 전적 칩 ("전적 2승 1패" · "첫 만남!") — 있으면 라이벌 띠 (색이 다름, gdd 4.12) · look = 얼굴 칸 (사람 그림 id) ·
 *  children = 둘째 줄 (3:3 을 고를 수 있는 만남의 1:1 / 3:3 버튼 — orders #17 4안, 상자 밖에 두면 VS 이름을 가리던 것) */
export function TrainerBanner({ name, balls, text, tag, media, look, children }: { name: string; balls: number; text?: string; tag?: string; media: string; look?: string; children?: ComponentChildren }) {
  // 이름 + "승부다!" 가 안 들어가면 "승부다!" 낱말을 뺌 (넘치면 한 단계 — 240 에서 "…" 한 점으로 줄던 것, 아트 디렉터 · 이름은 자르지 않음 U4)
  const line = useRef<HTMLSpanElement>(null);
  const [short, setShort] = useState(false);
  useLayoutEffect(() => {
    const el = line.current;
    if (el && !short && el.scrollWidth > el.clientWidth) setShort(true);
  });
  const head = (
    <>
      {/* 좁은 패널 (400 아래) 은 상자가 길 위 "!" 를 덮어 0.6초만 보이던 것 — 상자 앞에도 같은 빨간 "!" (UX 밤 점검 U1) */}
      <b class="pg-bang-in" aria-hidden="true">
        !
      </b>
      <Face media={media} id={look} />
      <span class="pg-ellipsis" ref={line}>
        {text ? (
          <>
            <b>{name}</b>
            {text}
          </>
        ) : (
          <>
            <span class="pg-speaker">{name}</span>
            {!short && ' 승부다!'}
          </>
        )}
      </span>
      {tag && <span class="pg-rival-rec">{tag}</span>}
      <span class="pg-foe-balls" title={`상대 포켓몬 ${balls}마리`}>
        {Array.from({ length: balls }, (_, i) => (
          <Icon key={i} name="ball" />
        ))}
      </span>
    </>
  );
  const cls = `pg-banner pg-trainer-box${tag ? ' pg-rival-box' : ''}`;
  return children ? (
    <div class={`${cls} pg-two`}>
      <span class="pg-line">{head}</span>
      {children}
    </div>
  ) : (
    <div class={cls}>{head}</div>
  );
}

/**
 * 기다림 한 줄 (gdd 4.13 R13 ② — 밖 · 숨김에서 멈춤) · 누르면 (VS Code 로 돌아오면) 이어서.
 * 이로치 흔적 · 라이벌 바로 앞 = 길 위 상자 자리 · 밖에서 이로치 전투가 멈춤 = 아래 가운데 (전투 위 줄 · 상대 HP · 말 칸을 가리지 않게 — 멈춘 장면에 이유가 안 보이던 것)
 */
export function HoldBox({ state }: { state: GameState }) {
  const st = state.runtime.stage;
  const why = st?.phase === 'hold' ? st.why : st?.phase === 'battle' && waitReason(state) === 'shiny' ? 'battle' : null;
  if (!why) return null;
  return (
    <div class={`pg-banner pg-hold${why === 'battle' ? ' pg-hold-low' : ''}`} role="status">
      {/* 멈춤 표시 (반짝 아이콘이면 "나타났다" 로 읽혀 멈춘 줄 몰랐던 것) · 밖에서는 키가 안 먹고 클릭으로 돌아옴 — "누르면" 이 전투 메뉴를 누르라는 뜻처럼 읽히던 것 (UX 리뷰어 #27) */}
      <Icon name="pause" />
      {/* 라이벌 = 360 아래 "라이벌!" (길 끝 그림자 "!" 가 같이 말함 — 맥 글자 넓이면 240 에서 두 줄이 되어 그 "!" 를 덮던 것, 픽셀 검사원) */}
      <b>
        {why === 'shiny' ? (
          '반짝이는 흔적!'
        ) : why === 'battle' ? (
          '반짝이는 포켓몬!'
        ) : (
          <>
            <span class="pg-tip-long">라이벌이 기다려요!</span>
            <span class="pg-tip-short">라이벌!</span>
          </>
        )}
      </b>
      <span class="pg-dim">클릭하면 이어서</span>
    </div>
  );
}

/**
 * S17 같은 판 두 번째 3:3 패배 — 멈춤 상자 (기획 R8 A · #152 A): 첫 줄 "<트레이너>에게 졌다" + 돈 / 둘째 줄 "남은 N마리로" + [Enter 계속 ▶] (주 버튼 — 그대로 걷기) + [Esc 병원 앞으로] (팀 회복 · 마지막 병원 앞에서 다시).
 * 넘치면 한 단계 (첫 줄 — 직함 뺀 이름, 맥 여유 10%) · 둘째 줄은 넘치면 [병원 앞으로] 가 다음 줄로 (자르지 않음 — U4)
 */
function DefeatKeep({ keep, lost, left, hospital, onInput }: { keep: string; lost: number; left: number; /** 이 스테이지에서 병원을 지났나 — 아니면 [처음부터] (스테이지 처음 0% — 테스터 #B) */ hospital: boolean; onInput(i: GameInput): void }) {
  const box = useRef<HTMLDivElement>(null);
  const short = useFit(box, 1, ':scope > .pg-line:first-child') >= 1;
  return (
    <div class="pg-banner pg-defeat pg-defeat-keep pg-two" ref={box}>
      <span class="pg-line">
        <b>{short ? shortTrainerName(keep) : keep}에게 졌다</b>
        {lost > 0 && (
          <span class="pg-reward pg-loss">
            <Icon name="coin" /> −{formatMoney(lost)}
          </span>
        )}
      </span>
      <span class="pg-line pg-keep-btns">
        <span class="pg-dim">{left > 0 ? `남은 ${left}마리로` : '남은 포켓몬으로'}</span>
        <Button onClick={() => onInput({ kind: 'defeat-continue' })} title="Enter — 남은 포켓몬으로 그대로 계속 걸어요">
          <KeyCap k="Enter" /> 계속 ▶
        </Button>
        {/* 무엇을 맞바꾸는지 버튼 글에 (회복 · 돌아갈 자리 — title 에만 있어 1초 안에 안 읽히던 것, UX 리뷰어 U5) */}
        <Button secondary onClick={() => onInput({ kind: 'defeat-retreat' })} title={hospital ? 'Esc — 팀을 다 회복하고 이 스테이지 병원 앞에서 다시 걸어요 (돈은 더 안 빠짐)' : 'Esc — 팀을 다 회복하고 스테이지 처음 (0%) 부터 다시 걸어요 (돈은 더 안 빠짐)'}>
          <KeyCap k="Esc" /> {hospital ? '병원에서 회복' : '회복하고 처음부터'}
        </Button>
      </span>
    </div>
  );
}

/** S17 패배 — ① 안내 · ② 다시 시작 (마지막 병원 앞 · 관장전이면 대기실) */
export function DefeatBox({ state, media, onInput }: BoxProps) {
  const st = state.runtime.stage;
  if (st?.phase !== 'defeat') return null;
  if (st.keep !== undefined) {
    const here = state.save.location.screen === 'stage' && state.save.lastHospital?.stageId === state.save.location.stageId;
    return <DefeatKeep keep={st.keep} lost={st.lost} left={st.left ?? aliveCount(state.save)} hospital={here} onInput={onInput} />;
  }
  return <DefeatPlain state={state} media={media} onInput={onInput} />;
}

/** 패배 상자 (보통) — 첫 줄은 넘치면 한 단계 ("졌다…" 만 — 맥 글자면 240 에서 "−100원" 이 잘리던 것, 픽셀 밤 점검) · 둘째 줄 안내는 줄임표 대신 줄 바꿈 */
function DefeatPlain({ state, onInput }: BoxProps) {
  const box = useRef<HTMLDivElement>(null);
  const short = useFit(box, 1, ':scope > .pg-line:first-child') >= 1;
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
    <div class="pg-banner pg-defeat pg-two" ref={box}>
      <span class="pg-line">
        <b>{st.gym ? '관장에게 졌다…' : short ? '졌다…' : '졌다… 눈앞이 깜깜해졌다'}</b>
        {st.lost > 0 ? (
          <span class="pg-reward pg-loss">
            <Icon name="coin" /> −{formatMoney(st.lost)}
          </span>
        ) : (
          <span class="pg-dim">돈은 그대로</span>
        )}
      </span>
      <span class="pg-line pg-defeat-more">
        <span class="pg-dim pg-defeat-say">
          {stuck ? (
            '자꾸 지면 지도에서 깬 스테이지로 가서 키우거나, 약해진 야생에게 볼을 던져 팀을 늘려 보세요'
          ) : (
            <>
              잡은 포켓몬 · 경험치는 그대로
              {!st.gym && (atHospital || reach > 0) && (
                <span class="pg-long">
                  {' '}
                  · {reach > from ? `${reach}% → ` : ''}
                  {atHospital ? `병원 앞 ${from}%` : '처음 0%'}
                </span>
              )}
            </>
          )}
        </span>
        <Button onClick={() => onInput({ kind: 'defeat-continue' })} title="Enter">
          {/* 남은 초 — 0 이면 저절로 다시 시작 (다음 버전 1단계 #49). 같은 판 두 번째 패배부터는 기다림 (지고 또 지며 돈이 빠지지 않게 — defeatWaits) 이라 숨김 */}
          <KeyCap k="Enter" /> {st.gym ? '대기실로 ▶' : '다시 시작 ▶'}
          {!defeatWaits(state.save, st) && <span class="pg-sub">{Math.max(1, Math.ceil((TIMING.defeatAutoMs - (st.ms ?? 0)) / 1000))}초</span>}
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
  // 자동 전투면 남은 초 뒤 저절로 다음 스테이지 (다음 버전 1단계 #48)
  const stage = state.runtime.stage;
  const autoLeft = state.save.settings.autoBattle ? Math.max(1, Math.ceil((TIMING.clearAutoMs - (stage.ms ?? 0)) / 1000)) : null;
  // 넘치면 한 단계 (줄임표 · 300px 손 경계 대신 — 301 ~ 414 · 482 ~ 563 에서 "잡은 포켓몬 2 · 이긴 …" 로 잘리던 것, UX 리뷰어 · U4 · 맥 여유 10%):
  //   1 = 스테이지 이름 뺌 "(1-1) 클리어!" · 2 = 요약 짧게 "잡은 2 · 트레이너 1 · 38분" · 3 = 요약 뺌
  const clearBox = useRef<HTMLDivElement>(null);
  const fit = useFit(clearBox, 3);
  return (
    <div class="pg-banner pg-clear pg-two" ref={clearBox}>
      <span class="pg-line">
        <Icon name={STAGES[loc.stageId].icon} />
        <b>
          {v.title.startsWith(STAGES[loc.stageId].name) ? (
            <>
              {fit < 1 && <span class="pg-clear-name">{STAGES[loc.stageId].name} </span>}
              {v.title.slice(STAGES[loc.stageId].name.length + 1)}
            </>
          ) : (
            v.title
          )}
        </b>
        <span class="pg-reward">
          <span class="pg-long">보너스 </span>경험치 +{v.bonus}
        </span>
        <span class="pg-reward">
          <Icon name="ball" /> +{v.balls}
        </span>
        {v.seen.length > 0 && <span class="pg-clear-new pg-dim">처음 만남</span>}
        {v.seen.slice(0, 4).map((s) => (
          <span key={s.dex} class="pg-clear-new" title="이번에 처음 만난 포켓몬">
            <Sprite media={media} form={s.form} scale={1} crop={24} />
          </span>
        ))}
      </span>
      <span class="pg-line">
        {fit < 3 && (
          <span class="pg-dim">{fit < 2 ? `잡은 포켓몬 ${v.caught} · 이긴 트레이너 ${v.trainers} · ${v.minutes}분 걸림` : `잡은 ${v.caught} · 트레이너 ${v.trainers} · ${v.minutes}분`}</span>
        )}
        <Button onClick={() => onInput({ kind: 'travel', to: next })} title="Enter">
          {/* ▶ 는 글 뒤 (계속 ▶ · 도전 ▶ 와 같게) · 주 버튼 안에는 아이콘 없이 (아트 디렉터 4차) */}
          <KeyCap k="Enter" /> <span class="pg-long">{next === 'gym' ? '체육관으로 ' : '다음 스테이지 '}</span>▶
          {autoLeft !== null && <span class="pg-sub">{autoLeft}초</span>}
        </Button>
        <Button secondary onClick={onMap} title="③ 지도">
          <Icon name="map" />
          <span class="pg-long"> 지도</span>
        </Button>
        <Button secondary onClick={onTeam} title="④ 포켓몬 교체 — 보관함과 팀을 바로 바꿔요">
          <Icon name="box" />
          <span class="pg-long"> 포켓몬 교체</span>
        </Button>
      </span>
    </div>
  );
}

/** S16 체육관 대기실 — ④ 추천 레벨 · ⑤ 병원 (회복) · ⑥ 보관함 · ⑦ 상점 · ② 도전 · ③ 세계 지도 */
export function LobbyBox({ state, media, onInput, onBox, onShop, onMap }: BoxProps & { onBox(): void; onShop(): void; onMap(): void }) {
  // 3마리 고르는 동안은 고르기 판이 이 자리 (도전 → 고르기 → 도전, 개발팀 92c4e03)
  if (state.runtime.stage?.phase !== 'lobby' || state.runtime.stage.picking) return null;
  const v = lobbyView(state.save);
  const healthy = teamHealthy(state.save);
  // 관장 힌트 (ideas #44) — 쓰는 타입 + 상성 좋은 내 포켓몬 (팀 · 보관함, 선두부터). 넓으면 첫 줄 끝, 좁으면 관장 이름에 올리면
  const hint = gymHint(state.save);
  // 관장이 가장 많이 쓰는 타입 — 좁아 힌트 글이 빠지면 (700 아래) 첫 줄 끝 타입 표 (물 방 240 에서 물 체육관 신호가 약하던 것, #661 UX)
  const gymTypes = regionGymTeam(regionHere(state.save.location), regionOrder(regionHere(state.save.location).id)).flatMap(([dex]) => speciesOf(dex)?.types ?? []);
  const gymType = gymTypes.sort((a, b) => gymTypes.filter((t) => t === b).length - gymTypes.filter((t) => t === a).length)[0];
  // 지금 지역 관장 (숲 나래 · 해변 해솔 — 엔진 gymLeaderOf, #37 해변 미리 보기에서 나래가 보이던 것)
  const leader = gymLeaderOf(state.save);
  const goodNames = hint.good.map((uid) => {
    const m = state.save.monsters[uid];
    return m ? (speciesOf(m.species)?.name.ko ?? m.form) : '';
  });
  const hintTitle = `${hint.text}${goodNames.length ? ` — 상성 좋은 내 포켓몬: ${goodNames.join(' · ')}` : ''}`;
  // 관장전 방식 (3:3 을 켰을 때 — 3마리 · 넓이가 되면 3:3, 아니면 1:1) — 도전 버튼 작은 칩 (설명은 처음 한 번 — 체육관 첫 알림, gdd S16)
  const teamOn = BALANCE.team.on || state.runtime.dev?.team === true;
  const lock = teamOn ? teamLock(state) : null;
  const mode = !teamOn ? null : lock === null ? '3:3' : '1:1';
  const modeWhy = lock === 'few' ? '싸울 수 있는 포켓몬이 3마리면 3:3' : lock === 'narrow' ? '패널을 넓히면 3:3' : null;
  // 버튼 줄이 넘치면 도전의 ▶ 를 뺌 (240 에서 "3:3" 칩까지 2px 넘쳐 상자 여백을 먹던 것 — UX 리뷰어 #27, 맥 여유 10%)
  const lobbyBox = useRef<HTMLDivElement>(null);
  // 2 단계 = Enter 키 칸도 뺌 (맥 +10% 에서 331 ~ 335 에 도전 버튼이 여백을 먹던 것 — UX 리뷰어 R12 재확인)
  // 새 지역 (지역이 켜졌을 때 — 가 본 기록이 없는 연 지역)
  const newRegion = regionsOn(state) ? mapView(state).regions.find((r) => isNewRegion(r, state.save.stages)) : undefined;
  const fit = useFit(lobbyBox, 2, ':scope > .pg-line:last-child');
  const tight = fit >= 1;
  // 첫 줄이 넘치면 타입 표를 한 단계씩 — 1 = 동그라미만 · 2 = 뺌 (관장 이름이 "나…" 로 줄던 것, U4 · 맥 여유 10%)
  const typeFit = useFit(lobbyBox, 2, ':scope > .pg-line:first-child');
  return (
    <div class="pg-banner pg-lobby pg-two" ref={lobbyBox}>
      <span class="pg-line">
        {/* 관장 얼굴 + 이름 ("숲 체육관" 은 지도 줄 이름표에 이미 — 두 번 나오던 것, 아트 디렉터 5차) */}
        <Face media={media} id={leader.look} />
        {/* 좁은 패널 (330px 아래) 은 얼굴 · "관장" 을 빼고 "나래" 만 — "관…" 으로 줄던 것 (U4 줄임표 금지). 바닥 이름표는 낮은 패널에서 상자에 깔려서 이름은 여기 남김 (UX 리뷰어 2026-10-21) */}
        <b class="pg-ellipsis" title={hintTitle}>
          <span class="pg-lobby-pre">{leader.name.split(' ')[0]} </span>
          {leader.name.split(' ').slice(1).join(' ')}
        </b>
        {/* 추천 · 내 팀을 나란히 (▼ 만이면 무엇과 비교했는지 모름 — 플레이 리뷰어), 모자라면 빨강 */}
        {/* 추천은 크림 · 모자라는 내 팀만 빨강 + ▼ (구절 전체가 빨갛던 것 — 아트 디렉터 4차) · 레벨은 정수 (내림 — 15.7 이 "15" 여도 모자라지 않음, 14.6 은 "14 ▼") */}
        <span class="pg-lobby-lv" title="내 팀 = 센 3마리 평균 Lv">
          추천 Lv {v.recommended} · <span class={v.short ? 'pg-lv-short' : 'pg-dim'}>내 팀 Lv {Math.floor(v.average)}{v.short ? ' ▼' : ''}</span>
        </span>
        {/* 이 체육관 (지금 지역) 배지 — 숲 고정이면 해변 대기실에서 숲 배지가 떠 이미 딴 것처럼 읽히던 것 (UX 새 화면 한 바퀴) */}
        {state.save.badges.includes(regionHere(state.save.location).badge) && <Icon name={badgeIcon(regionHere(state.save.location).id)} title={`${regionHere(state.save.location).name} 배지`} />}
        <span class="pg-lobby-hint" title={hintTitle}>
          {hint.text.replace(/^\S+ \S+ /, '').replace(' 포켓몬을 써요', ' 타입')}
          {goodNames.length > 0 && <span class="pg-lobby-good"> · 상성 좋음 {goodNames.length > 1 ? `${goodNames[0]} 외 ${goodNames.length - 1}` : goodNames[0]}</span>}
        </span>
        {gymType && typeFit < 2 && (
          <span class={typeFit >= 1 ? 'pg-lobby-type pg-lobby-type-disc' : 'pg-lobby-type'} title={hintTitle}>
            <TypeTag type={gymType} />
          </span>
        )}
      </span>
      <span class="pg-line">
        <Button secondary onClick={() => onInput({ kind: 'heal' })} disabled={healthy} title={healthy ? '이미 다 건강해요' : '⑤ 병원 — 무료로 다 회복'}>
          <Icon name="hospital" />
          <span class="pg-long"> 회복</span>
        </Button>
        <Button secondary onClick={onBox} title="⑥ 보관함과 팀 바꾸기">
          <Icon name="box" />
          <span class="pg-long"> 보관함</span>
        </Button>
        <Button secondary onClick={onShop} title="⑦ 상점">
          <Icon name="shop" />
          <span class="pg-long"> 상점</span>
        </Button>
        {/* 아직 안 가 본 새 지역이 있으면 지도 그림 오른쪽 위 빨간 알림 점 + title — 알림 2.4초가 지나면 새 지역을 알려 줄 곳이 없던 것 (#67 UX 리뷰어) */}
        <Button secondary onClick={onMap} title={newRegion ? `③ 세계 지도 (M) — 새 지역 ${newRegion.name}` : '③ 세계 지도 (M) — 깬 스테이지로 가서 키우기'}>
          <span class="pg-region-ico">
            <Icon name="map" />
            {newRegion && <span class="pg-new-dot" aria-hidden="true" />}
          </span>
          <span class="pg-long"> 세계 지도</span>
        </Button>
        <Button extraClass="pg-go" onClick={() => onInput({ kind: 'challenge' })} title={mode === '3:3' ? '② 관장 3마리와 3:3 실시간 배틀 — 나갈 3마리를 고름 (Enter)' : `② 관장 3마리와 1:1 토너먼트 (도망 불가) — Enter${modeWhy ? ` · ${modeWhy}` : ''}`}>
          {fit < 2 && <KeyCap k="Enter" />} {tight ? '도전' : '도전 ▶'}
          {mode && <span class={`pg-sub pg-lobby-mode${mode === '1:1' ? ' pg-dim' : ''}`}>{mode}</span>}
        </Button>
      </span>
    </div>
  );
}

/** 관장 첫 승 카드 — 배지 → "숲 클리어! …" → 세계 지도. 배지 이름 · 첫 승 물건 = 지금 지역 표 (해변 관장을 이겨도 "숲 배지 · 리프의돌" 이던 것).
 *  뒷말 = 다음 지역 (orders #67 — 개발 #66): 고를 곳이 있으면 "다음 지역을 골라요" · 바로 열렸으면 "새 지역 해변이 열렸어요" · 꺼져 있으면 (본편) "다음 지역은 준비 중이에요" */
export function BadgeCard({ state, onInput, onMap }: BoxProps & { onMap(): void }) {
  // 보상 · 버튼 줄이 넘치면 한 단계 — Enter 키 칸을 빼고 배지와 글 사이 6 (폭 경계 330 고정이라 맥 331 ~ 333 에서 버튼 묶음이 셋째 줄로 내려가 카드가 주인공을 덮던 것, 개발 UX #70 · U4)
  const card = useRef<HTMLDivElement>(null);
  const [tight, setTight] = useState(false);
  useLayoutEffect(() => {
    const el = card.current;
    if (!el || tight) return;
    const row = el.querySelector<HTMLElement>('.pg-badge-row');
    const glow = el.querySelector<HTMLElement>('.pg-badge-glow');
    if (!row || !glow || row.clientWidth === 0) return;
    const cs = getComputedStyle(el);
    const edge = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
    const parent = el.offsetParent instanceof HTMLElement ? el.offsetParent.clientWidth : window.innerWidth;
    const room = parent - 16 - edge - glow.offsetWidth - (parseFloat(cs.columnGap) || 0);
    const kids = [...row.children].filter((c): c is HTMLElement => c instanceof HTMLElement && c.offsetWidth > 0);
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
    const need = kids.reduce((w, c) => w + c.scrollWidth * 1.1, 0) + gap * Math.max(0, kids.length - 1);
    if (need > room + 0.5) setTight(true);
  });
  useEffect(() => {
    const reset = () => setTight(false);
    window.addEventListener('resize', reset);
    return () => window.removeEventListener('resize', reset);
  }, []);
  if (state.runtime.stage?.phase !== 'badge') return null;
  const region = regionHere(state.save.location);
  const map = regionsOn(state) ? mapView(state) : null;
  const opened = map?.regions.find((r) => isNewRegion(r, state.save.stages));
  // 뒷말 — 새 지역 이름만 빨강 (0장 중요한 낱말 · SoS 2f) · 본편 "준비 중" 은 흐리게
  const tail = map?.next.length ? (
    <>다음 지역을 골라요</>
  ) : opened ? (
    <>
      새 지역 <span class="pg-em">{opened.name}</span>
      {josaOf(opened.name, '이/가')} 열렸어요
    </>
  ) : map ? (
    <>모든 지역을 열었어요</>
  ) : (
    <span class="pg-dim">다음 지역은 준비 중이에요</span>
  );
  const item = region.firstWinItem;
  return (
    <div class={`pg-banner pg-badge-card${tight ? ' pg-badge-tight' : ''}`} ref={card}>
      <span class="pg-badge-glow">
        <Icon name={badgeIcon(region.id, true)} title={region.badgeName} />
      </span>
      {/* 좁으면 (480 아래) 첫 줄 뒷말을 빼고, 보상 · 버튼은 넘치면 버튼 묶음이 다음 줄 (240 에서 카드가 패널 밖으로 나가 [Enter 세계 지도] 가 "Ent" 로 잘리던 것 — 아트 디렉터 밤 점검) */}
      <span class="pg-badge-lines">
        <span class="pg-line">
          <b>
            {region.badgeName}
            {josaOf(region.badgeName, '을/를')} 받았다!
          </b>{' '}
          {/* "숲 클리어!" 만 480 아래에서 빼고 뒷말 (이번 소식) 은 360 아래에서만 뺌 — 480 · 240 에서 새 소식이 통째로 사라지던 것 (아트 디렉터) */}
          <span class="pg-long">{region.name} 클리어! </span>
          <span class="pg-badge-tail">{tail}</span>
        </span>
        {/* 돈 · 첫 승 물건은 바로 앞 결과 상자가 보여 줌 — 카드에서 또 보여 두 번 받은 것처럼 읽히던 것 (#70 개발 UX) · 받은 것은 title 에 */}
        <span class="pg-line pg-badge-row" title={`받은 것: ${formatMoney(regionGymMoney(regionOrder(region.id)))} · ${itemName(item)}`}>
          {/* 360 아래 = 뒷말 대신 지도 탭과 같은 표 "[해변 그림] 해변 NEW" (카드 · 알림 · 탭이 같은 표로 이어짐) */}
          {opened && (
            <span class="pg-reward pg-badge-newtag" title={`새 지역 ${opened.name}`}>
              <Icon name={regionIcon(opened.id)} /> {opened.name}
              <span class="pg-region-new">NEW</span>
            </span>
          )}
          <span class="pg-badge-btns">
            <Button
              onClick={() => {
                onInput({ kind: 'badge-continue' });
                onMap();
              }}
              title="Enter"
            >
              <KeyCap k="Enter" /> 세계 지도
            </Button>
            <Button secondary onClick={() => onInput({ kind: 'badge-continue' })}>
              대기실로
            </Button>
          </span>
        </span>
      </span>
    </div>
  );
}

/**
 * VS 컷인 (2026-10-20 태현 님 B안) — 트레이너 · 라이벌을 만나 "승부다!" 끝 2초 (VS_MS): 숲을 남색으로 덮고 위 띠 (나 · 내 팀 볼) 는 왼쪽에서,
 * 아래 띠 (상대 · 볼) 는 오른쪽에서 밀려 들어오고 가운데 금색 VS 가 찍힘 (번쩍임 없음). at = 시작한 뒤 지난 ms —
 * 처음 그릴 때 값만 씀 (다시 그릴 때마다 지연을 바꾸면 애니메이션이 두 배로 빨리 끝남, 라이벌 만남에서 안 보이던 것)
 */
/** VS 컷인 대결 그림 — src = battle.png · top = 그림이 시작하는 줄 (data/people-battle.ts) */
export interface VsArt {
  src: string;
  top: number;
}

/** 대결 그림 칸 — 원작 64 × 64 를 길 위와 같은 ×2 그대로 (줄이지 않음). 높이가 모자라면 아래 · 폭이 모자라면 양옆을 잘라 머리부터 보임 (2026-10-20 태현 님 "작은 화면도") */
function VsArtBox({ art, side }: { art: VsArt; side: 'me' | 'foe' }) {
  return (
    <span class={`pg-vs-art pg-vs-art-${side}`} style={{ height: `${(64 - art.top + 2) * VS_ART_SCALE}px`, '--pg-vs-art-top': `${-(art.top - 2) * VS_ART_SCALE}px` }} aria-hidden="true">
      <img src={art.src} width={64 * VS_ART_SCALE} height={64 * VS_ART_SCALE} alt="" draggable={false} />
    </span>
  );
}
const VS_ART_SCALE = 2;

export function VsCutIn({ me, myBalls, foe, foeBalls, tag, at, meArt, foeArt }: { me: string; myBalls: boolean[]; foe: string; foeBalls: number; /** 라이벌 전적 ("전적 2승 1패") — 전적 띠가 VS 에 가려지는 동안에도 보이게 */ tag?: string; at: number; /** 원작 대결 그림 (없으면 이름 · 볼만) */ meArt?: VsArt | null; foeArt?: VsArt | null }) {
  const at0 = useRef(at).current;
  return (
    <div class="pg-vs" style={{ '--pg-vs-at': `${-at0}ms`, '--pg-vs-dur': `${VS_MS}ms` }}>
      {meArt && <VsArtBox art={meArt} side="me" />}
      {foeArt && <VsArtBox art={foeArt} side="foe" />}
      <div class={meArt ? 'pg-vs-band pg-vs-me pg-has-art' : 'pg-vs-band pg-vs-me'}>
        <b>{me}</b>
        <span class="pg-foe-balls">
          {myBalls.map((alive, i) => (
            <span key={i} class={alive ? 'pg-ball-slot' : 'pg-ball-slot pg-ball-down'}>
              <Icon name="ball" />
            </span>
          ))}
        </span>
      </div>
      <div class="pg-vs-word">VS</div>
      <div class={foeArt ? 'pg-vs-band pg-vs-foe pg-has-art' : 'pg-vs-band pg-vs-foe'}>
        <span class="pg-foe-balls">
          {Array.from({ length: foeBalls }, (_, i) => (
            <Icon key={i} name="ball" />
          ))}
        </span>
        <b>{foe}</b>
        {tag && <span class="pg-rival-rec">{tag}</span>}
      </div>
      {/* 넘기기 안내 — 2초를 다 기다리지 않아도 (2026-10-20 태현 님 "클릭하면 바로 넘어가게") · 포커스가 없으면 키 대신 클릭 */}
      <span class="pg-vs-skip">{document.hasFocus() ? (<><KeyCap k="Space" /> 넘기기</>) : '클릭해 넘기기'}</span>
    </div>
  );
}
