/**
 * S06 스테이지 (gdd S06 · mvp-spec 3.2) — 자동으로 걷는 화면 · S16 체육관 (대기실 · 관장전) 도 같은 틀.
 *   정보줄: ① 볼 개수 · ② 미니맵 (체육관은 이름) · ⑦ ~ ⑩ 메뉴 버튼 (걷는 중에만, 단축키 + 아이콘 + 이름)
 *   패널 180px 이상이면 ② 는 정보줄 아래 지도 줄로 길게 (2026-10-19 태현 님) — 정보줄은 볼 (왼쪽 끝) · 메뉴 (오른쪽 끝), 상자 · 판은 지도 줄 아래부터
 *   길: 숲 배경 2겹이 흐르고 (확장에 있는 숲 그림) ③ 주인공은 제자리걸음, ④ 흔적 · ⑤ 트레이너 · ⑭ 아이템 · ⑯ 부탁 · ⑥ 병원 · 상점 · ⑮ 배경 포켓몬
 *   체육관: 코드로 그린 방 · 오른쪽에 관장 (임시 디자인)
 * 전투 (S09 · S10) 는 같은 길 위에서 — features/battle 의 BattleLayer (주인공은 왼쪽 끝 트레이너 자리로, 야생은 튀어나온 자리 그대로 · 트레이너는 오른쪽 끝).
 * 튀어나올 때 선제공격 · 기습은 스피드로 정함 (2026-10-21 태현 님 — Space · 클릭 선제공격을 뺌).
 */
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { BALANCE, TIMING } from '../../../core/balance';
import { AUTO_TEAM_TIP, autoTeamTipDue, battleAutoUltLeft, canOpenMenus, regionsOn, teamFastOk, teamUltOpen, canParry, canRiposte, gymLeaderOf, isWalkingFast, itemLeft, teamAutoUltLeft, teamAutoUltNext, teamLock, teamMeetTipDue, TEAM_MEET_TIP, walkLeftMs, type GameInput, type GameState } from '../../../core/engine';
import { maxHpOf, teamHealth } from '../../../core/rules/bag';
import { spaceInput, ultSkippable } from '../../battle/fx/parry';
import { BALLS } from '../../../core/rules/catch';
import { bestHelper, requestAt } from '../../../core/rules/request';
import { FACILITY_STAFF } from '../../../core/rules/stage';
import { gymRoomOf, regionHere } from '../../../core/rules/region';
import { josaOf, withJosa } from '../../../core/text';
import { speciesOf } from '../../../data';
import { heroDraw, heroHeightPx, heroLookOf, heroWidthPx, personLook } from '../../../data/heroes';
import { battleArtOf } from '../../../data/people-battle';
import { BallCount } from '../../../ui/BallCount';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { badgeIcon, isNewRegion } from '../../../ui/regionArt';
import { themeKind } from '../../../ui/theme';
import { typeNameKo } from '../../../ui/format';
import { InfoBar } from '../../../ui/InfoBar';
import { TeamLayer } from '../../battle/team/TeamLayer';
import { TeamChoice, teamChoiceOn, TeamMeet, teamMeetOn } from '../../battle/team/TeamChoice';
import { Face } from '../../../ui/Face';
import { resumeLine } from '../../../core/engine/play';
import { FirstTip } from '../../../ui/FirstTip';
import { KeyCap } from '../../../ui/KeyCap';
import { fieldTopPx, hasMapRow, INFO_BAR_PX, MAP_ROW_PX, topGapPx, type Layout } from '../../../ui/layout';
import { barSay, BattleLayer, BattleMenuBar, pickRightOf } from '../../battle/components/BattleLayer';
import { battleGeometry, battleSpritePx, foeTrainerX, placeOnStage, ringHint, trainerBattleFoeX } from '../../battle/model';
import { MenuButtons } from '../../menu/components/MenuButtons';
import { ShopPanel } from '../../menu/components/ShopPanel';
import { mapView, menuLabels, type Overlay, unspentPoints } from '../../menu/model';
import { ChoiceBox } from '../../result/components/ChoiceBox';
import { ResultBox } from '../../result/components/ResultBox';
import { CAUGHT_INTRO_H, CAUGHT_INTRO_W, caughtView, choiceView, levelUps, needsStatHint } from '../../result/model';
import { battleStage, buildingDraw, BUILDINGS, contactX, foeTrainerView, gymEnterView, holdRivalLook, gymFrontX, gymRestX, heroX, minimapOf, sceneBackground, staffLeftPx, type StageObject, stagePx, STAGES, visibleObjects, meetVsAt, vsStartMs, WALK_PX_PER_SEC } from '../model';
import { BadgeCard, ClearCard, DefeatBox, FacilityBox, HoldBox, LobbyBox, TrainerBanner, VsCutIn, type VsArt } from './FieldBoxes';
import { GymFront } from './GymFront';
import { StageToast } from './StageToast';
import { Hero } from './Hero';
import { Minimap } from './Minimap';
import { StageObjects } from './StageObjects';

export interface StageScreenProps {
  state: GameState;
  layout: Layout;
  widthPx: number;
  media: string;
  onInput(input: GameInput): void;
  /** 판 열기 (지도 · 내 포켓몬 · 가방 · 설정 · 상점 · 프로필) */
  onOpen(o: Overlay): void;
  /** 이 화면이 지금 계산 중 (판이 안 떠 있고 웹뷰가 맡음) — 아니면 배경 흐름 · 걷기를 멈춤 (멈춘 그림이 걷는 척하지 않게 · PC 부담). 안 주면 true */
  live?: boolean;
  /** 판 (지도 · 내 포켓몬 · 가방 · 설정 · 상점 · 프로필) 이 위에 떠 있음 — 길 위 상자 · 전투 한 줄 · 머리 위 알림을 숨김 (반투명 판 뒤로 비치지 않게) */
  covered?: boolean;
}

/** 숲 그림 크기별 높이 (원본 300 · 400 · 500 · 800px) 에서 땅 윗면 — 길 위의 것들이 서는 높이 */
const GROUND_PX: Record<Layout['size'], number> = { nano: 15, small: 20, medium: 25, large: 40 };
/** 위쪽 띠 한 줄 높이 (글자 배율 1) · 띠를 주인공 옆으로 옮길 때 남아야 할 폭 */
const BANNER_PX = 22;
const BANNER_SIDE_MIN_PX = 180;
/** 건물 때문에 옆으로 옮길 때 남아야 할 폭 — 병원 · 상점 상자 한 줄 ("🏥 병원 회복 · 보관함 [들어가기] [지나가기 2초]" ≈ 320 · 병원 안 ≈ 340), 모자라면 가운데 그대로 (두 줄로 꺾이지 않게) */
const FACILITY_SIDE_MIN_PX = 340;
function EncounterBox({ state }: { state: GameState }) {
  const stage = state.runtime.stage;
  const pending = state.save.pendingEncounter;
  if (stage?.phase !== 'appear' || pending?.kind !== 'wild') return null;
  const name = speciesOf(pending.monster.species)?.name.ko ?? '???';
  return (
    <div class="pg-banner pg-appear">
      <span class="pg-ellipsis">
        야생 <b class="pg-em">{withJosa(name, '이/가')}</b> 나타났다! <span class="pg-dim">Lv{pending.monster.level}</span>
      </span>
      {stage.isNew && <span class="pg-new">NEW!</span>}
      {/* 시작은 만날 때 스피드로 정해짐 — 띠가 보이는 내내 (전투 첫 말은 선제공격이면 바로 "무엇을 할까?" 로 덮이고 좁은 패널은 말 줄이 숨음, 2026-10-21) */}
      {pending.start !== 'normal' && <span class={pending.start === 'ambush' ? 'pg-start pg-start-ambush' : 'pg-start'}>{pending.start === 'ambush' ? '기습당했다!' : '선제공격!'}</span>}
    </div>
  );
}

function RequestBox({ state, media, onInput }: { state: GameState; media: string; onInput(i: GameInput): void }) {
  const stage = state.runtime.stage;
  const save = state.save;
  if (stage?.phase !== 'request' || save.location.screen !== 'stage') return null;
  const prog = save.stages[save.location.stageId];
  if (!prog) return null;
  // 지역 표의 부탁 (숲 · 해변 — orders #37)
  const t = requestAt(prog.seed, stage.number, save.location.stageId);
  if (stage.result) {
    return (
      <div class={stage.result.ok ? 'pg-banner pg-request pg-ok' : 'pg-banner pg-request'} title={stage.result.text}>
        <span class="pg-request-say">{stage.result.text}</span>
        {stage.result.reward && (
          <span class="pg-reward">
            <Icon name="gift" /> {stage.result.reward}
          </span>
        )}
      </div>
    );
  }
  const helper = bestHelper(save, t);
  const types = t.types.map(typeNameKo).join(' · ');
  // 남은 초 — 0 이면 저절로 (도울 포켓몬이 있으면 도와준다 · 없으면 지나감, 2026-10-21 다음 버전 1단계 #115). 그 버튼에 붙임
  const left = Math.max(1, Math.ceil((TIMING.requestAutoMs - stage.ms) / 1000));
  const sec = <span class="pg-sub">{left}초</span>;
  return (
    // 말 · 도움 줄은 줄임표 없이 낱말 단위로 줄 바꿈 · 버튼 줄은 넘치면 버튼이 다음 줄 (240 에서 "쓰러진 나무가 길을 막…" 으로 무엇을 돕는지 모른 채 고르던 것 · "성공" 이 빠져 "30%" 만 — UX · 픽셀 밤 점검)
    <div class="pg-banner pg-request pg-two" title={`${t.who.name}: ${t.text}`}>
      <span class="pg-request-say">
        {t.who.look ? <Face media={media} id={t.who.look} /> : `${t.who.icon} `}
        <span class="pg-speaker">{t.who.name}</span> {t.text}
      </span>
      <span class="pg-line pg-request-act">
        {helper && (
          <span class="pg-helper" title={helper.moveName ? `${helper.name}의 ${helper.moveName}` : `${helper.name} — ${types} 기술이 있으면 성공 ${Math.round(BALANCE.requestChanceMatch * 100)}%`}>
            {/* 370px 아래는 누가 돕는지 빼고 "성공 30%" 만 (도울 포켓몬 이름이 "이상해…" 로 잘리던 것 — UX 리뷰어 2026-10-21) */}
            <span class="pg-helper-who">{helper.moveName ? `${helper.name}의 ${helper.moveName}` : helper.name} · </span>
            <span class="pg-helper-word">성공 </span>
            {Math.round(helper.chance * 100)}%
          </span>
        )}
        <Button onClick={() => onInput({ kind: 'request', help: true })} disabled={!helper} title="Enter">
          <KeyCap k="Enter" /> 도와준다{helper && sec}
        </Button>
        <Button secondary onClick={() => onInput({ kind: 'request', help: false })} title="Esc">
          <KeyCap k="Esc" /> 지나간다{!helper && sec}
        </Button>
      </span>
    </div>
  );
}

/** 팀 맨 앞 포켓몬 그림 (오른쪽 위 ◓ 버튼) */
/** 잡은 포켓몬 소개 카드 자리 · 폭 — 길 칸 가운데 정수 px (홀수 폭 · 높이에서도 흐리지 않게), 좁은 패널은 양쪽 8px 남기고 줄임 */
function introAt(widthPx: number, bodyPx: number): { left: number; top: number; width: number } {
  const width = Math.min(CAUGHT_INTRO_W, widthPx - 16);
  return { left: Math.round((widthPx - width) / 2), top: Math.round((bodyPx - CAUGHT_INTRO_H) / 2), width };
}

/** 이보다 좁은 패널은 볼 칸을 붙여 씀 (× 빼고) · 더 좁으면 볼 칸을 숲 왼쪽 위로 (볼 한 종류 400 · 둘 460 · 셋 520px — 볼 · 지도 · 메뉴 다섯이 한 줄에 안 들어가 지도가 "0'" 처럼 잘리던 것, 2026-10-20) */
const BALLS_COMPACT_PX = 600;
const ballsFieldPx = (kinds: number) => 340 + 60 * kinds;

/** VS 컷인 대결 그림 (사람 그림 id → battle.png) — 원작 그림이 없는 사람은 null (이름 · 볼만) */
function vsArt(media: string, id: string | undefined): VsArt | null {
  const a = battleArtOf(id);
  return a && media && id ? { src: `${media.replace(/\/+$/, '')}/people/${id}/battle.png`, top: a.top } : null;
}

function leadOf(save: GameState['save']): { form: string; shiny: boolean } | null {
  const m = save.party[0] ? save.monsters[save.party[0]] : undefined;
  return m ? { form: m.form, shiny: m.shiny } : null;
}

/** 저절로 나가는 필살기 첫 안내 (save.tips — ideas #150) */
const ULT_WAIT_TIP = 'ult-wait';
/** 3:3 필살기 다 참 처음 안내 (태현 님 #82 — 필살기는 눌러야만 나감) */
const ULT_READY_TIP = 'ult-ready';

export function StageScreen({ state, layout, widthPx, media, onInput, onOpen, live = true, covered = false }: StageScreenProps) {
  const save = state.save;
  const gym = save.location.screen === 'gym';
  const stageId = save.location.screen === 'stage' ? save.location.stageId : null;
  const info = stageId ? STAGES[stageId] : null;
  const map = minimapOf(state);
  const phase = state.runtime.stage?.phase ?? (gym ? 'lobby' : 'walk');
  // 빨리 걷기 (설정, 2026-10-19) — 걷는 동안 일이 멀리 있으면 엔진이 ×3 → 배경 흐름 · 걷기 그림도 같이
  const fast = isWalkingFast(state);
  const walkK = fast ? BALANCE.fastWalkSpeed : 1;
  const progress = map?.progress ?? 0;
  const offset = progress * stagePx(layout.scale);
  const ground = GROUND_PX[layout.size] - 2;
  const hero = heroX(widthPx);
  const heroPx = 2 * layout.scale;
  const look = heroLookOf(save.player?.look, save.player?.gender);
  const bodyPx = layout.heightPx - Math.round(INFO_BAR_PX * layout.uiScale);
  // 지도 줄 (S06 ②, 2026-10-19 태현 님 "맵을 정보바 밑에 길게") — 패널 180px 이상이면 정보줄 아래 둘째 줄 (전투 중에도 — 볼 · 지도 자리가 안 움직이게, 아래 geo 참고)
  const gap = topGapPx(layout.heightPx);
  const mapRowFits = hasMapRow(layout.heightPx);
  // 길 위 상자 · 메뉴 판이 시작하는 곳 (game.css --pg-field-top 과 같은 값 — main.ts) · 전투가 아닐 때 씀
  const fieldTop = fieldTopPx(layout.heightPx);
  // 주인공이 쓸 수 있는 높이 — 큰 그림이 안 들어가면 작은 그림 (data/heroes.ts heroDraw)
  const heroRoom = bodyPx - ground - 2;
  const heroH = heroHeightPx(look, layout.scale, heroRoom);
  const heroW = heroWidthPx(look, layout.scale, heroRoom);
  // 머리 위 알림 — 패널이 낮으면 머리 위 자리가 알림 한 줄보다 좁음 → 칸 안으로, 위는 상자 자리 (16px = 글자 11 + 위아래 여백, 글자 배율만큼)
  const toastBottom = Math.max(0, Math.min(ground + heroH + 4, bodyPx - Math.ceil(16 * layout.uiScale) - fieldTop));
  // 3:3 동안은 길 위 물건 · 주인공을 숨김 (무대 = 여섯 마리 — 디자인 4안)
  const teamOn = state.runtime.stage?.phase === 'team';
  const objects = gym || teamOn ? [] : visibleObjects(state, widthPx, layout.scale);
  const stageRt = state.runtime.stage;
  const battle = stageRt?.phase === 'battle' ? stageRt.battle : null;
  // 3:3 (orders #17 — 모두에게, orders #59)
  const team = stageRt?.phase === 'team' ? stageRt.team : null;
  // 저절로 나갈 필살기를 기다리는 중이면 지금 누를 키 (1:1 자동 전투 = Z · 3:3 = 그 칸 번호) — "N초" 칩의 뜻 첫 안내 (ideas #150)
  const teamNext = team?.phase === 'run' ? teamAutoUltNext(team) : null;
  const ultWaitMs = battle ? (battle.phase !== 'clash' ? (battleAutoUltLeft(battle, save.settings.autoBattle === true) ?? 0) : 0) : team && teamNext !== null ? (teamAutoUltLeft(team, teamNext) ?? 0) : 0;
  const ultWaitKey = ultWaitMs <= 0 ? null : battle ? 'Z' : teamNext !== null ? String(teamNext + 1) : null;
  // 칩과 같은 남은 초 (3 · 2 · 1 — 글이 "3초" 로 멈춰 있고 칩만 줄던 것, UX 리뷰어)
  const ultWaitSec = Math.ceil(ultWaitMs / 1000);
  // 자동 전투로 3:3 이 시작된 판의 처음 안내 (orders #71 — 엔진 autoTeamTipDue) · 판 첫 12초만 (중간에 갑자기 뜨지 않게 — 못 보고 지나가면 다음 판에)
  const autoTeamTip = team !== null && autoTeamTipDue(state) && team.t < 12000;
  // 3:3 에서 먼저 다 찬 칸 (필살기는 눌러야만 나감 — #82) — 처음 한 번 "필살기 다 참 — [1] 누르면 나가요"
  const teamReadyKey = team && team.phase === 'run' ? [0, 1, 2].find((i) => teamUltOpen(team, i)) : undefined;
  // 전투 ×2 를 켰는데 지금은 기본 박자 (필살기 · 끼어들기 · 알아챌 순간 — 엔진 teamFastOk) = 스위치 글을 흐리게 (켰는데 안 먹는 것처럼 보이던 것, UX 리뷰어 #83 큼 ②) ·
  //   0.4초 넘게 이어질 때만 바꿈 (0.3초 · 40ms 끼었다 빠지는 박자에 스위치가 깜빡이지 않게 — U2)
  // 안 가 본 새 지역 (정보줄 지도 아이콘 표시 — 대기실 지도 버튼과 같은 규칙 · 개발 UX #70)
  const newRegionName = regionsOn(state) ? (mapView(state).regions.find((r) => isNewRegion(r, save.stages))?.name ?? null) : null;
  const fastHeldNow = team !== null && save.settings.battleFast === true && !teamFastOk(team);
  const fastHeldRef = useRef({ on: false, want: false, since: 0 });
  {
    const h = fastHeldRef.current;
    const now = performance.now();
    if (h.want !== fastHeldNow) {
      h.want = fastHeldNow;
      h.since = now;
    }
    if (h.on !== h.want && now - h.since >= 400) h.on = h.want;
  }
  const fastHeld = fastHeldRef.current.on && team !== null && save.settings.battleFast === true;
  const choice = choiceView(state);
  const foeTrainer = foeTrainerView(state);
  const rivalShadow = holdRivalLook(state);
  const shadowLook = rivalShadow ? personLook(rivalShadow) : undefined;
  const shadowDot = shadowLook ? Math.max(1, Math.round(heroDraw(shadowLook, heroPx / 2, heroRoom)?.scale ?? 1)) : 1;
  // VS 컷인 중 — 길 위 상대 이름표는 숨김 (컷인 띠에 같은 이름이 있고, 반투명 덮개 너머로 대결 그림과 겹쳐 보임)
  // VS = 만남 끝 2초 · 3:3 을 고를 수 있는 만남은 고른 때부터 2초 (meetVsAt — 디자인팀 4안)
  const vsAt = meetVsAt(state);
  const vsOn = (stageRt?.phase === 'trainer' || stageRt?.phase === 'rival') && stageRt.ms >= vsAt;
  // 전투 · 관장 · 라이벌은 무대 안에서 (넓은 패널은 720px 무대 — battleStage), 자리는 무대 안에서 재고 패널 자리로 옮김
  const stage = battleStage(widthPx);
  const geoAt = (topPx: number) =>
    battle
      ? placeOnStage(
          battleGeometry({
            widthPx: stage.width,
            bodyPx: layout.heightPx - Math.round(INFO_BAR_PX * layout.uiScale),
            scale: layout.scale,
            uiScale: layout.uiScale,
            ground,
            foeX: battle.kind === 'wild' ? contactX(stage.width, layout.scale) : trainerBattleFoeX(stage.width, layout.scale, battleSpritePx(battle.foe.form, layout.scale, layout.heightPx)),
            meSpritePx: battleSpritePx(battle.me.form, layout.scale, layout.heightPx),
            foeSpritePx: battleSpritePx(battle.foe.form, layout.scale, layout.heightPx),
            heroPx: heroH,
            heroWidthPx: heroW,
            topPx,
            gapPx: gap,
            foeTrainer: battle.kind !== 'wild',
          }),
          stage,
          widthPx,
        )
      : null;
  const geoWithRow = geoAt(mapRowFits ? gap + MAP_ROW_PX : 0);
  // 전투 중 지도 줄 때문에 위 한 줄 자리가 붐비면 (낮은 패널 · 큰 포켓몬) 그 전투 동안만 지도를 정보줄 안으로 — 한 줄 말 · 메뉴가 먼저
  //   (지도 줄이 있으면 190px 에서 상대 HP 묶음이 말 자리에 닿아 말이 상대 오른쪽 좁은 칸으로 · 480px 폭은 말이 숨었음)
  const mapRow = mapRowFits && !geoWithRow?.topBusy;
  const geo = mapRowFits && !mapRow ? geoAt(0) : geoWithRow;
  // 배경 = 지역 표 (스테이지 → 지역 → 숲 — orders #57, 지금은 모두 숲)
  // 3:3 판이면 시합장 (태현 님 #78 — sceneBackground, 그림이 들어오기 전엔 길 배경)
  const art = (layer: 'background' | 'foreground') => (media && !gym ? `url("${media}/backgrounds/${sceneBackground(state)}/${layer}-${themeKind()}-${layout.size}.png")` : 'none');
  // 체육관: 주인공은 무대 왼쪽 (대기실) · 관장은 무대 오른쪽 끝
  const heroStand = geo ? geo.trainerX : gym ? stage.left + Math.round(stage.width * 0.18) : hero;
  // 1-3 길 끝 체육관 (2026-10-20 태현 님 A안) — gym-enter 동안 주인공이 문 앞까지 걸어가 들어가며 사라지고 화면 닦기 (stage/model gymEnterView)
  const gymX = gymFrontX(state, widthPx, layout.scale);
  const gymK = Math.max(1, Math.floor(layout.scale));
  const gymEnter = stageRt?.phase === 'gym-enter' ? gymEnterView(stageRt.ms) : null;
  // heroLeft 는 주인공 가운데 (.pg-obj translateX(-50%)) — 문 옆 = 주인공 오른쪽 끝이 문틀 (문 가운데 − 8칸) 왼쪽 네 칸 (팔이 문을 가리지 않게) · 문 가운데 = 주인공 가운데가 문 가운데
  const gymBeside = gymX !== null ? gymX - 12 * gymK - Math.round(heroW / 2) : heroStand;
  const gymInto = gymX ?? heroStand;
  const heroLeft = gymEnter && gymX !== null ? Math.round(heroStand + (gymBeside - heroStand) * gymEnter.walk + (gymInto - gymBeside) * gymEnter.enter) : heroStand;
  // 큰 주인공이 위쪽 띠 (트레이너 · 만남 · 병원 상자, 상자 자리 fieldTop + 한 줄) 자리까지 올라오면 띠를 주인공 오른쪽 옆으로 — 옆자리가 넉넉할 때만
  //   병원 · 상점 앞 · 안이면 간호순 · 점원 오른쪽 옆으로 ("간호순:" 이 말하는데 띠에 가려지지 않게 — 아트 디렉터)
  const facility = objects.find((o): o is Extract<StageObject, { kind: 'facility' }> => o.kind === 'facility' && o.active);
  const staffLook = facility ? personLook(FACILITY_STAFF[facility.facility.kind].look) : undefined;
  // 병원 · 상점이면 간호순 · 점원과 건물 오른쪽 끝 중 더 오른쪽 (건물이 간호순보다 26px 더 나옴 — 건물 때문에 옮길 때 지붕에 걸치지 않게)
  const buildingRight = facility ? facility.x + (BUILDINGS[facility.facility.kind].w - BUILDINGS[facility.facility.kind].door) * buildingDraw(facility.facility.kind, layout.scale, heroRoom).k : 0;
  const sideFrom = facility && staffLook ? Math.max(staffLeftPx(facility.facility.kind, facility.x, layout.scale, heroRoom) + heroWidthPx(staffLook, layout.scale, heroRoom), buildingRight) : heroLeft + heroW / 2;
  const bannerLeft = Math.round(sideFrom + 8);
  // 오른쪽 끝 — 체육관 대기실은 관장 앞까지
  // 지금 지역 관장 (숲 나래 · 해변 해솔 — #37)
  const gymLeader = gymLeaderOf(save);
  const leader = personLook(gymLeader.look);
  const leaderW = leader ? heroWidthPx(leader, layout.scale, heroRoom) : 20 * layout.scale;
  // 이름표 (9px 글자, 관장 그림 오른쪽 끝 + 4px 에 붙음 — game.css .pg-foe-trainer .pg-nametag) 의 왼쪽 끝 어림
  // 상대 트레이너 · 관장 · 라이벌 = 무대 오른쪽 끝
  const leaderX = stage.left + foeTrainerX(stage.width, layout.scale);
  const tagLeft = leaderX + leaderW / 2 + 4 - (gymLeader.name.length * 9 + 6) * layout.uiScale;
  const bannerRight = gym ? Math.min(leaderX - leaderW / 2, tagLeft) - 8 : widthPx - 8;
  // 병원 · 상점 건물 (사람보다 큼) 도 같이 — 낮은 패널에서 상자가 지붕 위에 얹히던 것 (2026-10-19 전체 점검, 210px)
  const bannerBottom = fieldTop + Math.round(BANNER_PX * layout.uiScale);
  const buildingTall = facility !== undefined && bodyPx - ground - buildingDraw(facility.facility.kind, layout.scale, heroRoom).visible < bannerBottom;
  const heroTall = !battle && (bodyPx - ground - heroH < bannerBottom || buildingTall) && bannerRight - bannerLeft >= (buildingTall ? FACILITY_SIDE_MIN_PX : BANNER_SIDE_MIN_PX);
  // 상점 안에서는 길 위 알림을 안 그림 — 상점 판 안 알림 ("진주를 팔았다!") 과 같은 말이 판 너머로 비쳐 겹치던 것 (UX 리뷰어 2026-10-21)
  const inShop = stageRt?.phase === 'facility' && stageRt.inside && stageRt.kind === 'shop';
  // 자동 전투 첫 안내 (기획 R12 — toast kind 'auto-tip') = 자동 스위치 옆: 전투 = 전투 스위치 · 걷기 = 정보줄 스위치 (메뉴가 보일 때 — 340px 아래도 안내 동안은 스위치를 보임, game.css) · 아니면 머리 위 알림.
  // 숲 1-1 첫 걷기 안내 (5초) 가 떠 있으면 뒤로 (240 에서 가리던 것 — UX 리뷰어) · 1초 넘게 보이면 tip-seen 'auto' (엔진이 그렸을 때만 셈)
  // 안 보는 동안 (밖 · 숨김) — 처음 안내 · 자동 전투 안내는 시간을 세지 않음 (자동 전투 안내는 그리지 않음 — 밖에서 1초 지나 셈하던 것, UX 리뷰어 R12 재확인)
  const away = state.runtime.away === true || state.runtime.headless === true;
  const walkTipOn = save.location.screen === 'stage' && save.location.stageId === 'forest-1' && phase === 'walk' && !(save.tips ?? []).includes('walk');
  const tipText = state.runtime.toast?.kind === 'auto-tip' && !walkTipOn && !away ? state.runtime.toast.text : null;
  // 스위치가 있는 곳 (1:1 전투 · 메뉴가 보이는 걷기 · 대기실) 에만 — 없으면 그리지 않음 (머리 위 알림으로 떨어져 병원 앞 · 클리어 카드 상자를 덮고 "[A]" 가 글자로 나오던 것, UX 리뷰어 R12 재확인 큼)
  const autoTip = tipText && (battle || canOpenMenus(state)) ? tipText : null;
  const autoSeen = () => onInput({ kind: 'tip-seen', id: 'auto' });
  const showToast = state.runtime.toast && state.runtime.toast.kind !== 'auto-tip' && !inShop && (phase === 'walk' || phase === 'clear' || phase === 'lobby' || phase === 'facility');
  const shopInside = stageRt?.phase === 'facility' && stageRt.inside && stageRt.kind === 'shop';
  // 전투 화면 단추의 Space (막기 · 맞받아치기 · 잡기 원) = 키 · 판 클릭과 같은 시계 — 엔진 시간으로만 재면 연출을 기다리는 동안 아무 때나 '완벽'
  const battleInput = (i: GameInput) => onInput(i.kind === 'space' ? spaceInput(state, performance.now()) : i);
  // ② 어디인지 — 스테이지는 미니맵, 체육관은 이름 (지도 줄이 있으면 둘째 줄, 없으면 정보줄 가운데)
  // ① 볼 칸 — 몬스터볼 · 슈퍼볼 · 하이퍼볼 (전투 중이면 이 전투에서 쓴 만큼 뺌)
  const ballCounts = BALLS.map((id) => ({ id, n: battle ? itemLeft(battle, save, id) : (save.bag[id] ?? 0) }));
  const balls = <BallCount counts={ballCounts} compact={widthPx < BALLS_COMPACT_PX} />;
  // 좁으면 볼 칸을 정보줄 밖으로 — 지도 줄이 있으면 그 줄 맨 앞 (숲 위로 내리면 지도 줄 이름과 겹침 — 아트 디렉터 7차), 없으면 숲 왼쪽 위
  const ballsOut = widthPx < ballsFieldPx(ballCounts.filter((c) => c.id === 'poke-ball' || c.n > 0).length);
  const ballsInField = ballsOut && !mapRow;
  // 팀이 위험할 때만 (HP 절반 아래 · 쓰러짐) 지도 옆 빨간 칸 (#47)
  const health = teamHealth(save);
  // 비율은 내림 (병원 앞 상자와 같은 숫자 — 반올림 17 · 내림 16 으로 달랐던 것, UX 리뷰어)
  const partyMons = save.party.map((uid) => save.monsters[uid]).filter((m) => m !== undefined);
  const hpFloor = Math.floor((partyMons.reduce((a, m) => a + Math.max(0, m.hp), 0) / Math.max(1, partyMons.reduce((a, m) => a + maxHpOf(m), 0))) * 100);
  const teamDanger = health.danger ? { ...health, hpPct: hpFloor } : null;
  const where = gym ? (
    <span class="pg-stage-name" title={`${regionHere(save.location).name} 체육관`}>
      {/* 지금 지역 체육관 (숲 · 해변 — #37) · 300 아래는 "체육관" 낱말을 뺌 (체육관 아이콘이 말함 — 240 에서 "해변 체육관" + "+2" 가 넘쳐 "관" 이 잘리던 것, 픽셀 검사원) */}
      <Icon name="gym" /> {regionHere(save.location).name}
      <span class="pg-gym-word"> 체육관</span> {save.badges.includes(regionHere(save.location).badge) && <Icon name={badgeIcon(regionHere(save.location).id)} title={`${regionHere(save.location).name} 배지`} />}
    </span>
  ) : info && map ? (
    <Minimap stage={info} progress={map.progress} facilities={map.facilities} gym={map.gym} leftMs={walkLeftMs(save)} team={teamDanger} />
  ) : (
    <span>
      <Icon name="tree" /> 숲
    </span>
  );

  // 대기실 바닥 관장 이름표가 위 상자에 깔리면 숨김 (이름은 상자 첫 줄에 있음 — 240 × 150 에서 글자 위 6줄이 잘리던 것, 픽셀 검사원 #27)
  const screen = useRef<HTMLDivElement>(null);
  const tagUnder = () => {
    const tag = screen.current?.querySelector<HTMLElement>('.pg-foe-trainer .pg-nametag');
    if (!tag) return;
    tag.classList.remove('pg-tag-under');
    const box = screen.current?.querySelector<HTMLElement>('.pg-lobby');
    if (!box) return;
    const a = box.getBoundingClientRect();
    const t = tag.getBoundingClientRect();
    if (t.top < a.bottom + 2 && t.right > a.left && t.left < a.right) tag.classList.add('pg-tag-under');
  };
  useLayoutEffect(tagUnder);
  // 넓힌 뒤 (상자가 넘치면 한 단계를 다시 잰 다음 장면) 에도 다시 잼 — 480 → 860 으로 넓혀도 이름표가 숨은 채 남던 것 (UX 리뷰어 · 실제 VS Code)
  useEffect(() => {
    const on = () => requestAnimationFrame(() => requestAnimationFrame(tagUnder));
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return (
    // pg-bg-<배경> = 배경 시간에 맞춰 건물 빛을 맞춤 (밤 · 노을 해변 — 원작 낮 그림 건물이 가장 밝은 덩어리였던 것, game.css · orders #61 아트 디렉터)
    <div class={`pg-screen pg-stage pg-size-${layout.size}${gym ? ' pg-gym' : ` pg-bg-${sceneBackground(state)}`}${covered ? ' pg-covered' : ''}`} ref={screen}>
      {battle && geo?.menuInBar ? (
        <BattleMenuBar battle={battle} save={save} onInput={battleInput} withAuto={geo.autoInMenu} compact={geo.tiny ? 'tiny' : geo.compact} say={barSay(battle, geo.msgHidden, geo.widthPx - 48, 2)} hint={ringHint(battle, geo, save.settings.autoBattle)} pickRight={pickRightOf(geo)} autoTip={autoTip} />
      ) : (
        <InfoBar
          split={mapRow}
          left={ballsOut ? undefined : balls}
          center={mapRow ? undefined : where}
          right={
            team ? (
              // 3:3 정보줄 오른쪽 = 자동 · 전투 ×2 스위치 (태현 님 #83 "화면 상단에 전투 x2 를 사용자가 선택" · 개발 UX — 3:3 에 자동 표시가 없던 것) · 키 C (X = 각성, 기획 10-22) — 빨리 걷기 · 자동 스위치와 같은 모양 (켜짐 = ✓ · 금 테두리)
              <span class="pg-menu-buttons pg-team-switches">
                <Button
                  secondary
                  extraClass={save.settings.autoBattle ? 'pg-auto-walk pg-on' : 'pg-auto-walk'}
                  onClick={() => onInput({ kind: 'auto-battle', on: !save.settings.autoBattle })}
                  title={save.settings.autoBattle ? '자동 전투 켜짐 — 누르면 끔 (A)' : '자동 전투 꺼짐 — 켜면 알아서 (A · 필살기는 늘 직접)'}
                >
                  {menuLabels(widthPx, mapRow) === 'full' && <span class="pg-menu-key">A</span>}
                  <span class="pg-menu-text">{save.settings.autoBattle ? '✓ 자동' : '□ 자동'}</span>
                </Button>
                <Button
                  secondary
                  extraClass={save.settings.battleFast ? `pg-battle-fast pg-on${fastHeld ? ' pg-held' : ''}` : 'pg-battle-fast'}
                  onClick={() => onInput({ kind: 'battle-fast', on: save.settings.battleFast !== true })}
                  title={fastHeld ? '전투 ×2 켜짐 (C) — 지금은 필살기 · 끼어들기라 기본 박자' : `전투 ×2 ${save.settings.battleFast ? '켜짐' : '꺼짐'} (C) — 보통 공격만 빨리 · 필살기 · 누를 틈 · 알아챌 순간은 그대로`}
                >
                  {menuLabels(widthPx, mapRow) === 'full' && <span class="pg-menu-key">C</span>}
                  {/* 좁으면 "×2" 만 (240 에서 정보줄이 넘치지 않게 — title 에 전체) */}
                  <span class="pg-menu-text">
                    {save.settings.battleFast ? '✓ ' : '□ '}
                    <span class="pg-long">전투 </span>×2
                  </span>
                </Button>
              </span>
            ) : canOpenMenus(state) ? (
              <MenuButtons
                onOpen={onOpen}
                points={unspentPoints(save)}
                later={save.laterChoices?.length ?? 0}
                media={media}
                lead={leadOf(save)}
                fast={gym ? undefined : { on: save.settings.fastWalk === true, active: isWalkingFast(state), onToggle: () => onInput({ kind: 'fast-walk', on: save.settings.fastWalk !== true }) }}
                auto={{ on: save.settings.autoBattle, onToggle: () => onInput({ kind: 'auto-battle', on: !save.settings.autoBattle }), tip: battle ? null : autoTip, onSeen: autoSeen }}
                labels={menuLabels(widthPx, mapRow)}
                newRegion={newRegionName}
              />
            ) : null
          }
        />
      )}
      <div
        class={['pg-body', 'pg-field', battle ? 'pg-in-battle' : '', heroTall ? 'pg-hero-tall' : ''].filter(Boolean).join(' ')}
        style={heroTall ? { '--pg-banner-left': `${bannerLeft}px`, '--pg-banner-max': `${Math.round(bannerRight - bannerLeft)}px` } : undefined}
        onPointerDown={(e) => {
          // 버튼 (필살기 Z · 막기 · 메뉴) 에서 올라온 누름은 버튼 몫 — 판이 먼저 패링 · 연타로 받으면 필살기가 무시됨 (2026-10-20 테스터 [큼])
          if (e.target instanceof Element && e.target.closest('button')) return;
          // 힘대결 중 클릭 = 연타 (gdd S10 ⑤)
          // 볼을 던졌을 때 클릭 = 타이밍 원 Space (S11)
          // 트레이너 · 라이벌 만남 ("승부다!" · VS) 클릭 = 바로 전투 (2026-10-20 태현 님)
          if (phase === 'trainer' || phase === 'rival' || phase === 'gym-enter' || battle?.phase === 'clash' || battle?.phase === 'catch') onInput({ kind: 'space' });
          // 상대 공격 중 판 클릭 = 패링 (Space 와 같음, 2026-10-19)
          else if (battle && (canParry(battle) || canRiposte(battle) || ultSkippable(battle))) onInput(spaceInput(state, performance.now()));
        }}
      >
        {gym ? (
          <GymRoom media={media} room={gymRoomOf(regionHere(save.location))} k={buildingDraw('hospital', layout.scale, heroRoom).k} floorPx={Math.max(ground + GYM_FLOOR_ABOVE_GROUND_PX, Math.round(bodyPx * GYM_FLOOR_SHARE))} dark={themeKind() === 'dark'} />
        ) : (
          <>
            <ScrollLayer cls="pg-bg" image={art('background')} start={offset * 0.35} pxPerSec={WALK_PX_PER_SEC * layout.scale * 0.35 * walkK} running={phase === 'walk' && live} />
            <ScrollLayer cls="pg-fg" image={art('foreground')} start={offset * 0.7} pxPerSec={WALK_PX_PER_SEC * layout.scale * 0.7 * walkK} running={phase === 'walk' && live} />
          </>
        )}
        {/* ② 지도 줄 — 정보줄 아래 길게 (가운데 720px 칸, 정보줄 볼 · 메뉴와 같은 양 끝) */}
        {mapRow && (
          <div class="pg-maprow">
            {ballsOut && balls}
            {where}
          </div>
        )}
        {/* 아주 좁은 패널 — 볼 칸은 숲 왼쪽 위 (정보줄은 지도 · 메뉴) */}
        {/* 걷는 동안만 — 상자 (결과 · 병원 · 트레이너) 가 같은 왼쪽 위 자리를 덮어 아이콘 조각만 삐져나오던 것 */}
        {ballsInField && phase === 'walk' && <div class="pg-field-balls">{balls}</div>}
        <StageObjects objects={objects} media={media} scale={layout.scale} ground={ground} roomPx={heroRoom} buildRoomPx={bodyPx - ground - fieldTop} />
        {gymX !== null && media && <GymFront x={gymX} restX={gymRestX(widthPx, layout.scale)} k={gymK} ground={ground} roomPx={heroRoom} media={media} door={gymEnter?.door ?? 0} gymName={`${regionHere(save.location).name} 체육관`} leader={gymLeader.name} />}
        {/* 체육관 장면 · 대기실 = 자리 옮김 0.45초 없이 (걸음이 픽셀 박자로 · 대기실에 들어오며 미끄러지지 않게 — UX 리뷰어 2026-10-21) · 가운데 맞춤 translateX 는 그대로 */}
        <span hidden={teamOn} class={`pg-obj pg-hero-wrap${gymEnter || phase === 'lobby' ? ' pg-hero-still' : ''}`} style={{ left: `${heroLeft}px`, bottom: `${ground}px`, ...(gymEnter ? { opacity: String(gymEnter.fade), transform: `translateX(-50%) translateY(${-gymEnter.rise * gymK}px)` } : {}) }}>
          <Hero px={heroPx} walking={(phase === 'walk' || gymEnter?.walking === true) && live} fast={fast} gender={look.gender} look={look} media={media} roomPx={heroRoom} />
        </span>
        {/* 전투 중 상대 트레이너 · 관장 = 오른쪽 끝 (남은 볼) · 대기실의 관장 */}
        {((battle && foeTrainer) || (gym && !battle) || (stageRt?.phase === 'rival' && foeTrainer)) && (
          <span class="pg-obj pg-foe-trainer" style={{ left: `${leaderX}px`, bottom: `${ground}px` }} title={foeTrainer?.name ?? gymLeader.name}>
            {/* 머리 위 이름표 (decisions 2026-10-17) · 라이벌 장면은 VS 전까지 "!" (gdd 4.12 — 트레이너와 같게, 대사 상자가 뜨면 0.8초에 이름표로 바뀌어 1초가 안 되던 것 · UX 리뷰어 2026-10-21) */}
            {stageRt?.phase === 'rival' && !vsOn ? <span class="pg-trainer-mark">!</span> : !vsOn && <span class="pg-nametag">{foeTrainer?.name ?? gymLeader.name}</span>}
            {foeTrainer && stageRt?.phase !== 'rival' && (
              <span class="pg-foe-balls">
                {Array.from({ length: foeTrainer.balls }, (_, i) => (
                  <span key={i} class={i < foeTrainer.left ? 'pg-ball-slot' : 'pg-ball-slot pg-ball-down'}>
                    <Icon name="ball" />
                  </span>
                ))}
              </span>
            )}
            <Hero px={heroPx} walking={false} hat={foeTrainer?.hat ?? gymLeader.hat} shirt={foeTrainer?.shirt ?? gymLeader.shirt} faceLeft label={foeTrainer?.name ?? gymLeader.name} look={personLook(foeTrainer ? foeTrainer.look : gymLeader.look)} media={media} roomPx={heroRoom} />
          </span>
        )}
        {/* 라이벌 기다림 (밖에서 멈춤) — 길 오른쪽 끝 그림자 + "!" (ideas #154 · 기다림 한 줄만 있고 길에는 아무도 없어 무엇이 기다리는지 안 보이던 것) · 다시 보면 같은 자리에 그 라이벌이 나옴 */}
        {rivalShadow && (
          // 테두리 두께 = 그림 한 칸 (--pg-dot — 1px 이면 ×2 그림 격자의 반 칸, 원칙 4)
          <span class="pg-obj pg-foe-trainer pg-rival-shadow" style={{ left: `${leaderX}px`, bottom: `${ground}px`, '--pg-dot': `${shadowDot}px` }} title="라이벌이 기다려요">
            <span class="pg-trainer-mark">!</span>
            <Hero px={heroPx} walking={false} faceLeft label="라이벌" look={personLook(rivalShadow)} media={media} roomPx={heroRoom} />
          </span>
        )}
        {battle && geo && (
          <BattleLayer battle={battle} save={save} media={media} ground={ground} geo={geo} onInput={battleInput} onProfile={(side) => onOpen({ kind: 'profile', side })} foeTrainerLeft={foeTrainer || gym ? leaderX : undefined} autoTip={autoTip} />
        )}
        {teamChoiceOn(state) && <TeamChoice state={state} media={media} onInput={onInput} />}
        {team && <TeamLayer team={team} media={media} widthPx={widthPx} heightPx={layout.heightPx} infoBarPx={Math.round(INFO_BAR_PX * layout.uiScale)} fieldTopPx={fieldTopPx(layout.heightPx)} onInput={onInput} />}
        {/* 체육관으로 — 화면 닦기 (위 → 아래) */}
        {gymEnter && gymEnter.wipe > 0 && (
          <div class={`pg-gym-wipe${gymEnter.wipe > 0 && gymEnter.wipe < 1 ? ' pg-wiping' : ''}`} style={{ '--pg-wipe': String(gymEnter.wipe) }} />
        )}
        <EncounterBox state={state} />
        {/* 3마리 고르는 동안은 숨김 (고르기 판 뒤로 "승부다!" 상자 끝이 비치던 것) */}
        {stageRt?.phase === 'trainer' && foeTrainer?.talking && stageRt.ms < vsAt && !stageRt.pick && (
          // 3:3 을 고를 수 있는 만남 = 둘째 줄 1:1 / 3:3 버튼 (orders #17 4안 — 상자 밖에 두면 VS 이름을 가리던 것)
          <TrainerBanner name={foeTrainer.name} balls={foeTrainer.balls} media={media} look={foeTrainer.look}>
            {teamMeetOn(state) ? <TeamMeet state={state} onInput={onInput} /> : null}
          </TrainerBanner>
        )}
        {/* VS 컷인 — 만남 단계 끝 2초 (트레이너 · 라이벌, VS_MS) */}
        {vsOn && foeTrainer && (
          <VsCutIn me={look.label} myBalls={save.party.map((uid) => (save.monsters[uid]?.hp ?? 0) > 0)} foe={foeTrainer.name} foeBalls={foeTrainer.balls} tag={foeTrainer.record} at={stageRt.ms - vsAt} meArt={vsArt(media, look.dir ?? look.id)} foeArt={vsArt(media, foeTrainer.look)} />
        )}
        {stageRt?.phase === 'rival' && foeTrainer?.talking && stageRt.ms < vsStartMs('rival') && (
          <TrainerBanner name={foeTrainer.name} balls={foeTrainer.balls} text={`${josaOf(foeTrainer.name, '이/가')} 승부를 걸어왔다!`} tag={foeTrainer.record ?? ''} media={media} look={foeTrainer.look} />
        )}
        <RequestBox state={state} media={media} onInput={onInput} />
        <FacilityBox state={state} media={media} onInput={onInput} onBox={() => onOpen({ kind: 'team' })} />
        {shopInside && <ShopPanel save={save} note={state.runtime.toast?.text} onInput={onInput} onClose={() => onInput({ kind: 'facility-leave' })} />}
        {stageRt?.phase === 'result' && <ResultBox summary={stageRt.summary} next={save.pendingChoices[0]?.kind ?? null} ups={levelUps(stageRt.summary, save)} hint={needsStatHint(levelUps(stageRt.summary, save))} caught={caughtView(stageRt.summary, save)} ms={stageRt.ms} introAt={introAt(widthPx, bodyPx)} media={media} onInput={onInput} onStats={(uid) => onOpen({ kind: 'team', uid })} />}
        {choice && <ChoiceBox view={choice} media={media} scale={layout.scale} onInput={onInput} />}
        <DefeatBox state={state} media={media} onInput={onInput} />
        <HoldBox state={state} />
        {/* 다시 켜기 한 줄 (기획 R15 — 전투 중에 껐다가 들어오면 2초 "다시 켜서 전투를 처음부터!", 엔진 resumeLine) — 1:1 = 아래 끝 (말 칸이 숨는 240 × 150 · 320 × 150 · 360 × 170 에서도 · 위 메뉴 · HP 밖) · 3:3 = 위 가운데 (아래는 앞줄 발밑 판) */}
        {resumeLine(state) && (
          <div class={`pg-banner pg-hold pg-resume${team ? ' pg-resume-top' : ' pg-hold-low'}`} role="status">
            <b>{resumeLine(state)}</b>
          </div>
        )}
        <ClearCard state={state} media={media} onInput={onInput} onMap={() => onOpen({ kind: 'map' })} onTeam={() => onOpen({ kind: 'team' })} />
        <LobbyBox state={state} media={media} onInput={onInput} onBox={() => onOpen({ kind: 'team' })} onShop={() => onOpen({ kind: 'shop' })} onMap={() => onOpen({ kind: 'map' })} />
        <BadgeCard state={state} media={media} onInput={onInput} onMap={() => onOpen({ kind: 'map' })} />
        {/* 처음 한 번 안내 (orders #12 · 세이브 tips) — 숲 1-1 처음 걷기 · 처음 마지막 기회 · 필살기 처음 꽉 참. 다 보면 tip-seen */}
        {save.location.screen === 'stage' && save.location.stageId === 'forest-1' && phase === 'walk' && !(save.tips ?? []).includes('walk') && (
          <FirstTip key="walk" ms={5000} className="pg-first-tip-top" paused={away} onSeen={() => onInput({ kind: 'tip-seen', id: 'walk' })}>
            {/* 줄은 "—" 뒤에서 바뀜 (좁은 패널에서 "야생 / 포켓몬" 사이로 갈리던 것) */}
            <span class="pg-tip-part">자동으로 걸어요 —</span> <span class="pg-tip-part">야생 포켓몬을 만나면 전투가 시작돼요</span>
          </FirstTip>
        )}
        {battle?.phase === 'last' && !(save.tips ?? []).includes('last') && (
          <FirstTip key="last" ms={4000} className="pg-first-tip-low" paused={away} onSeen={() => onInput({ kind: 'tip-seen', id: 'last' })}>
            {/* 360px 아래는 짧게 한 줄 — 두 줄이면 잡을 상대 · 내 포켓몬을 가림 (UX 리뷰어) */}
            <span class="pg-tip-long">약해진 포켓몬에게 </span>볼을 던지면 팀이 늘어요
          </FirstTip>
        )}
        {/* 체육관 첫 알림 (gdd S16 · 기획 R9 ⑤) — 3:3 을 켠 뒤 대기실에 처음 들어갈 때 3초 · 클리어 보상 · 레벨업 알림 (대기실 첫 5초) 이 끝난 뒤 (겹쳐 가리지 않게 — U1). 그 뒤로는 도전 버튼의 "3:3" 칩만 */}
        {stageRt?.phase === 'lobby' && !stageRt.picking && !state.runtime.toast && (BALANCE.team.on || state.runtime.dev?.team === true) && !(save.tips ?? []).includes('gym-team') && (
          // 5초 (약 30글자 + 키 셋 — 걷기 안내와 같은 시간, 3초는 빠듯하던 것) · 밖 · 숨김이면 안 셈 (UX 리뷰어 #27)
          <FirstTip key="gym-team" ms={5000} className="pg-first-tip-low pg-gym-tip" paused={away} onSeen={() => onInput({ kind: 'tip-seen', id: 'gym-team' })}>
            <GymTip lock={teamLock(state)} />
          </FirstTip>
        )}
        {/* 3:3 처음 안내 (기획 R9 ⑤ — 2026-10-22 태현 님 A "추천안으로") — 3:3 을 고를 수 있는 만남이 처음 나올 때 4초 · 아래 가운데 (위는 "승부다!" 상자 — 1:1 / 3:3 버튼을 가리지 않게) · 보는 동안만 셈 */}
        {teamMeetOn(state) && teamMeetTipDue(state) && (
          <FirstTip key="team-meet" ms={4000} className="pg-first-tip-low" paused={away} onSeen={() => onInput({ kind: 'tip-seen', id: TEAM_MEET_TIP })}>
            <span class="pg-tip-part pg-tip-long">3:3 이 열렸어요 —&nbsp;</span>
            <span class="pg-tip-part pg-tip-long">
              셋이 함께 싸우고 돈 ×{BALANCE.team.moneyScale} · <KeyCap k="3" />
            </span>
            {/* 360 아래 한 줄 (두 줄이 주인공 · 트레이너 아래 반을 덮던 것 — 개발 UX #59) */}
            <span class="pg-tip-short">
              3:3 이 열렸어요 · 돈 ×{BALANCE.team.moneyScale} · <KeyCap k="3" />
            </span>
          </FirstTip>
        )}
        {/* 필살기 안내 = 고르는 때 · 게이지 차는 때만 (원 · 연출 중엔 원을 가려서) · 자동 전투도 띄움 (#82 — 이제 저절로 안 나가서 눌러야 함 · 개발 코드 리뷰어) —
            자동이면 연출 중에도 (원 안내가 없고 · 고르기 ↔ 연출이 번갈아 1초 안에 끊겼다 다시 뜨지 않게) */}
        {battle && (battle.phase === 'choose' || battle.phase === 'run' || (save.settings.autoBattle && battle.phase === 'anim')) && battle.me.ult >= 1 && !(save.tips ?? []).includes('ult') && (
          <FirstTip key="ult" ms={3000} className="pg-first-tip-low" paused={away} onSeen={() => onInput({ kind: 'tip-seen', id: 'ult' })}>
            필살기 다 참! <KeyCap k="Z" />
          </FirstTip>
        )}
        {/* "N초" 칩의 뜻 (ideas #150 · orders #34) — 볼 때 저절로 나가는 필살기가 처음 다 찼을 때 한 번: 1:1 자동 전투 (Z 모서리 3 · 2 · 1) · 3:3 (발밑 판 3 · 2 · 1 — 자동 전투가 꺼져도).
            저절로 나가면 (3초) 같이 사라짐 · 1초 넘게 보면 셈 · 1:1 = 아래 가운데 · 3:3 = 위 가운데 (아래는 발밑 판), 480 아래 3:3 은 내 쪽 왼쪽 위 (가운데면 상대 쓰러짐 말 · 피해 숫자를 0.7초 덮던 것 — UX 리뷰어) */}
        {/* 자동 전투 3:3 처음 안내 (orders #71 — 자동이면 트레이너전은 3:3 기본) = VS 뒤 3:3 판 첫 12초 · 위 가운데 · 보는 동안만 셈 (U6) · 한 줄만 — 두 줄이면 1번 포켓몬 머리를 덮음 (폭을 재서 세 단계: 520 이상 418 · 361 ~ 519 302 · 360 아래 181, 맥 +10% 포함) */}
        {autoTeamTip && (
          <FirstTip key={AUTO_TEAM_TIP} ms={5000} className="pg-first-tip-top pg-tip-auto-team" paused={away} onSeen={() => onInput({ kind: 'tip-seen', id: AUTO_TEAM_TIP })}>
            <span class="pg-t71-long">
              자동 전투는 3:3 — 셋이 같이 싸우고 돈 ×{BALANCE.team.moneyScale} · 1:1 은 <KeyCap k="A" /> 자동을 끄고 만남에서
            </span>
            <span class="pg-t71-mid">
              자동 전투는 3:3 · 돈 ×{BALANCE.team.moneyScale} — 1:1 은 <KeyCap k="A" /> 끄고 만남에서
            </span>
            <span class="pg-t71-short">
              자동은 3:3 · 1:1 은 <KeyCap k="A" /> 끄고
            </span>
          </FirstTip>
        )}
        {/* 자동 3:3 안내가 떠 있으면 같은 자리 필살기 안내는 기다림 */}
        {ultWaitKey && !autoTeamTip && !(save.tips ?? []).includes(ULT_WAIT_TIP) && (
          <FirstTip key={ULT_WAIT_TIP} ms={BALANCE.ultAutoWaitMs} className={team ? 'pg-first-tip-top pg-tip-mine' : 'pg-first-tip-low'} paused={away} onSeen={() => onInput({ kind: 'tip-seen', id: ULT_WAIT_TIP })}>
            {/* 좁으면 (360 아래 · 480 아래 3:3) 짧은 말 — "필살기" 는 남김 (빼면 무엇이 저절로인지 빠지던 것) */}
            <span class="pg-tip-part pg-tip-long">필살기 다 참 —&nbsp;</span>
            <span class="pg-tip-part pg-tip-long">
              {ultWaitSec}초 뒤 저절로 · 지금 <KeyCap k={ultWaitKey} /> 누르면 바로
            </span>
            <span class="pg-tip-short">
              필살기 {ultWaitSec}초 뒤 저절로 · <KeyCap k={ultWaitKey} /> 바로
            </span>
            {/* 459 아래 3:3 = 더 짧게 한 줄 (짧은 말 197px 가 반 폭 112px 에 두 줄로 접혀 막 다 찬 1번 포켓몬 반짝임을 덮던 것 — 개발 UX #59) */}
            {team && (
              <span class="pg-tip-tiny">
                필살기 {ultWaitSec}초 뒤 · <KeyCap k={ultWaitKey} /> 바로
              </span>
            )}
          </FirstTip>
        )}
        {/* 3:3 필살기 다 참 처음 안내 (#82 — 저절로 안 나가니 "3초 뒤 저절로" 대신) · 같은 자리 (위 · 좁으면 내 쪽 왼쪽 위) · 자동 3:3 안내가 떠 있으면 기다림 */}
        {team && teamReadyKey !== undefined && !autoTeamTip && !(save.tips ?? []).includes(ULT_READY_TIP) && (
          <FirstTip key={ULT_READY_TIP} ms={4000} seenMs={2500} className="pg-first-tip-top pg-tip-mine" paused={away} onSeen={() => onInput({ kind: 'tip-seen', id: ULT_READY_TIP })}>
            <span class="pg-tip-part pg-tip-long">필살기 다 참 —&nbsp;</span>
            <span class="pg-tip-part pg-tip-long">
              <KeyCap k={String(teamReadyKey + 1)} /> 누르면 나가요 (저절로 안 나가요)
            </span>
            <span class="pg-tip-short">
              필살기 다 참 · <KeyCap k={String(teamReadyKey + 1)} /> 누르면 나가요
            </span>
            <span class="pg-tip-tiny">
              필살기 다 참 · <KeyCap k={String(teamReadyKey + 1)} /> 누르기
            </span>
          </FirstTip>
        )}
        {/* 주인공 머리 위 — 주운 자리에서 바로 보이게 (긴 알림은 패널 끝 안쪽으로 당김 · 줄 바꿈).
            대기실 = 상자가 머리 위를 차지해서 바닥 줄 주인공 ~ 관장 사이 (버튼을 가리던 것 — 2026-10-21 orders #3) */}
        {/* 클리어 카드도 바닥 줄 (카드가 머리 위를 차지 — 머리 위면 카드 아래 버튼 줄 [다음 스테이지 ▶] · 지도 · 교체 를 가리던 것, 개발 UX 리뷰어 R14) */}
        {showToast && state.runtime.toast && (phase === 'lobby' || phase === 'clear' ? (
          <StageToast key={state.runtime.toast.text} text={state.runtime.toast.text} center={(heroLeft + heroW / 2 + 8 + bannerRight) / 2} bottom={ground + 2} room={bannerRight - (heroLeft + heroW / 2 + 8)} avoid=".pg-banner.pg-clear, .pg-banner.pg-lobby" />
        ) : (
          <StageToast key={state.runtime.toast.text} text={state.runtime.toast.text} center={heroLeft} bottom={toastBottom} />
        ))}
      </div>
    </div>
  );
}

/** 체육관 첫 알림 글 (gdd S16 — 문구 = 기획) · 큰 줄 + 작은 줄 (좁으면 작은 줄은 키 칸만 — 줄은 낱말 묶음 사이에서만 바뀜) · 3:3 을 못 하면 이유 + "이번엔 1:1 승부" */
// 360 아래는 짧은 말 한 줄 (두 줄 38px 가 240 대기실 바닥 줄 주인공 · 관장 아래 15px 를 덮던 것 — 픽셀 검사원 새 화면 한 바퀴)
function GymTip({ lock }: { lock: 'few' | 'narrow' | null }) {
  if (lock !== null)
    return (
      <>
        <span class="pg-tip-long">
          <span class="pg-tip-part">{lock === 'few' ? '싸울 수 있는 포켓몬이 3마리면 3:3 —' : '패널을 넓히면 3:3 —'}</span> <span class="pg-tip-part">이번엔 1:1 승부</span>
        </span>
        <span class="pg-tip-short">{lock === 'few' ? '싸울 3마리면 3:3 — 이번엔 1:1' : '넓히면 3:3 — 이번엔 1:1'}</span>
      </>
    );
  return (
    <>
      <span class="pg-tip-long">
        <b class="pg-tip-part">관장전은 3:3 실시간 배틀!</b> <span class="pg-tip-part pg-long">포켓몬 3마리가 함께 싸운다 ·</span>{' '}
        <span class="pg-tip-part">
          필살기는 <KeyCap k="1" /> <KeyCap k="2" /> <KeyCap k="3" />
        </span>
      </span>
      <span class="pg-tip-short">
        <b>관장전 3:3!</b> 필살기 <KeyCap k="1" /> <KeyCap k="2" /> <KeyCap k="3" />
      </span>
    </>
  );
}

/** 체육관 바닥 = 사람이 서는 땅 위로 적어도 이만큼 · 높은 패널은 길 칸의 42% 까지 (위에서 비스듬히 보는 방 — 뒷벽 위가 텅 비지 않게) */
const GYM_FLOOR_ABOVE_GROUND_PX = 20;
const GYM_FLOOR_SHARE = 0.42;

/**
 * S16 체육관 방 (2026-10-20 태현 님 A안 "추천으로") — 원작 파이어레드 무지개시티 체육관 (풀 타입) 그림 (scripts/buildings/fetch-pret-gym.py):
 * 아래부터 풀 바닥 · 뒷벽 창문 줄 (주황 몰딩 + 벽 밑 그늘) · 벽 앞 나무 (띄엄띄엄 — 창문이 보이게), 그 위는 원작 벽 색 · 맨 위 천장 몰딩.
 * 사람 · 건물과 같은 정수 배율 k (예전엔 코드로 그린 초록 줄무늬 + 갈색 바닥)
 */
function GymRoom({ media, room, k, floorPx, dark }: { media: string; room: string; k: number; floorPx: number; dark: boolean }) {
  // room = 지역 표의 체육관 방 그림 이름 앞 (gymRoomOf — 없으면 'gym' = 숲 방, orders #57)
  const url = (f: string) => (media ? `url("${media.replace(/\/+$/, '')}/buildings/${f.replace(/^gym/, room)}.png")` : 'none');
  return (
    // pg-room-<방> = 방마다 바탕색 (위 띠와 벽 사이 빈 줄 — 물 방은 연한 물빛, game.css)
    <div class={`pg-gym-room pg-room-${room}${dark ? ' pg-gym-dark' : ''}`}>
      <div class="pg-gym-floor" style={{ height: `${floorPx}px`, backgroundImage: url('gym-floor'), backgroundSize: `${48 * k}px ${32 * k}px` }} />
      <div class="pg-gym-wall" style={{ bottom: `${floorPx}px`, height: `${31 * k}px`, backgroundImage: url('gym-wall'), backgroundSize: `${96 * k}px ${31 * k}px` }} />
      <div class="pg-gym-trees" style={{ bottom: `${floorPx - 6 * k}px`, height: `${24 * k}px`, backgroundImage: url('gym-trees'), backgroundSize: `${64 * k}px ${24 * k}px` }} />
      <div class="pg-gym-top" style={{ height: `${9 * k}px`, backgroundImage: url('gym-top'), backgroundSize: `${96 * k}px ${9 * k}px` }} />
    </div>
  );
}

/** 배경이 흐르는 거리 (아주 멀리 — 반복 그림이라 그림 폭을 몰라도 됨, 초당 17 ~ 70px 이면 몇 시간) */
const SCROLL_DISTANCE_PX = 1_000_000;

/**
 * 배경 · 앞 수풀 — 걷는 동안 CSS 애니메이션으로 일정하게 흐름 (화면 새로 고침마다 매끈하게 · 2026-10-19 태현 님 "뚝뚝 끊겨 눈이 아파").
 * 처음 위치는 지금 진행 위치에서 (음수 지연), 멈추면 (만남 · 전투 · 병원 앞 …) 같이 멈춤. 크기가 바뀌면 다시 맞춤. 길 위의 것과 딱 맞을 필요는 없는 겹 (패럴랙스)
 */
function ScrollLayer({ cls, image, start, pxPerSec, running }: { cls: string; image: string; start: number; pxPerSec: number; running: boolean }) {
  // 애니메이션 시작점은 처음 그릴 때 (또는 빠르기가 바뀔 때) 한 번만 — 매번 바꾸면 그때마다 튐.
  // 빠르기가 바뀌면 (빨리 걷기 켜고 끔 · 일이 다가와 보통 빠르기로) 엔진 진행 자리 (start) 로 다시 맞추지 않고 지금 보이는 자리에서 새 빠르기로 이어 감 —
  // 엔진 자리로 맞추면 CSS 흐름과 조금 달라 배경이 뚝 끊겨 보였음 (2026-10-20 태현 님). 보이는 자리 = 이 흐름의 시작 자리 + 빠르기 × 흐른 시간 (멈춘 동안은 안 셈)
  const at = useRef<{ base: number; v: number; gen: number; pos: number; since: number | null } | null>(null);
  const now = performance.now();
  const c = at.current;
  const seen = c ? c.pos + (c.since === null ? 0 : (c.v * (now - c.since)) / 1000) : start;
  if (!c) at.current = { base: start, v: pxPerSec, gen: 0, pos: start, since: running ? now : null };
  // 새 빠르기 = 새 흐름 (key 로 다시 붙여 처음부터 · 지연은 보이던 자리)
  else if (c.v !== pxPerSec) at.current = { base: seen, v: pxPerSec, gen: c.gen + 1, pos: seen, since: running ? now : null };
  // 멈춤 · 다시 감 — CSS 가 제자리에서 멈췄다 이어 가니 흐름은 그대로, 보이는 자리 셈만
  else if ((c.since !== null) !== running) at.current = { ...c, pos: seen, since: running ? now : null };
  const { base, v, gen } = at.current as { base: number; v: number; gen: number };
  return (
    <div
      key={gen}
      class={`${cls} pg-scroll`}
      style={{
        backgroundImage: image,
        animationDuration: `${v > 0 ? SCROLL_DISTANCE_PX / v : 1}s`,
        animationDelay: `${v > 0 ? -base / v : 0}s`,
        animationPlayState: running && v > 0 ? 'running' : 'paused',
      }}
    />
  );
}
