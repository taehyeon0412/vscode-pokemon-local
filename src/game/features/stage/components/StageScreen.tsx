/**
 * S06 스테이지 (gdd S06 · mvp-spec 3.2) — 자동으로 걷는 화면 · S16 체육관 (대기실 · 관장전) 도 같은 틀.
 *   정보줄: ① 볼 개수 · ② 미니맵 (체육관은 이름) · ⑦ ~ ⑩ 메뉴 버튼 (걷는 중에만, 단축키 + 아이콘 + 이름)
 *   패널 180px 이상이면 ② 는 정보줄 아래 지도 줄로 길게 (2026-10-19 태현 님) — 정보줄은 볼 (왼쪽 끝) · 메뉴 (오른쪽 끝), 상자 · 판은 지도 줄 아래부터
 *   길: 숲 배경 2겹이 흐르고 (확장에 있는 숲 그림) ③ 주인공은 제자리걸음, ④ 흔적 · ⑤ 트레이너 · ⑭ 아이템 · ⑯ 부탁 · ⑥ 병원 · 상점 · ⑮ 배경 포켓몬
 *   체육관: 코드로 그린 방 · 오른쪽에 관장 (임시 디자인)
 * 전투 (S09 · S10) 는 같은 길 위에서 — features/battle 의 BattleLayer (주인공은 왼쪽 끝 트레이너 자리로, 야생은 튀어나온 자리 그대로 · 트레이너는 오른쪽 끝).
 * 선제공격은 Space 또는 길 클릭 [제안] — 코딩 중에는 편집기에 포커스가 있어 Space 가 코드에 들어가므로, 클릭하면 패널에 포커스도 옴.
 */
import { useRef } from 'preact/hooks';
import { BALANCE } from '../../../core/balance';
import { canOpenMenus, canParry, isWalkingFast, itemLeft, type GameInput, type GameState } from '../../../core/engine';
import { spaceInput, ultSkippable } from '../../battle/fx/parry';
import { bestHelper, requestAt } from '../../../core/rules/request';
import { FACILITY_STAFF } from '../../../core/rules/stage';
import { GYM_LEADER } from '../../../core/rules/trainer';
import { josaOf, withJosa } from '../../../core/text';
import { speciesOf } from '../../../data';
import { heroHeightPx, heroLookOf, heroWidthPx, personLook } from '../../../data/heroes';
import { BallCount } from '../../../ui/BallCount';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { themeKind } from '../../../ui/theme';
import { typeNameKo } from '../../../ui/format';
import { InfoBar } from '../../../ui/InfoBar';
import { Face } from '../../../ui/Face';
import { KeyCap } from '../../../ui/KeyCap';
import { fieldTopPx, hasMapRow, INFO_BAR_PX, MAP_ROW_PX, topGapPx, type Layout } from '../../../ui/layout';
import { BattleLayer, BattleMenuBar } from '../../battle/components/BattleLayer';
import { battleGeometry, battleSpritePx, foeTrainerX, placeOnStage, trainerBattleFoeX } from '../../battle/model';
import { MenuButtons } from '../../menu/components/MenuButtons';
import { ShopPanel } from '../../menu/components/ShopPanel';
import { menuLabels, type Overlay, unspentPoints } from '../../menu/model';
import { ChoiceBox } from '../../result/components/ChoiceBox';
import { ResultBox } from '../../result/components/ResultBox';
import { choiceView } from '../../result/model';
import { battleStage, buildingDraw, BUILDINGS, contactX, foeTrainerView, heroX, minimapOf, staffLeftPx, type StageObject, stagePx, STAGES, visibleObjects, vsStartMs, WALK_PX_PER_SEC } from '../model';
import { BadgeCard, ClearCard, DefeatBox, FacilityBox, LobbyBox, TrainerBanner, VsCutIn } from './FieldBoxes';
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
  const blocked = stage.space && stage.ambush;
  // 패널에 포커스가 없으면 Space 는 편집기로 감 → "클릭!"
  const hint = document.hasFocus() ? 'Space!' : '클릭!';
  return (
    <div class="pg-banner pg-appear">
      <span class="pg-ellipsis">
        야생 <b class="pg-em">{withJosa(name, '이/가')}</b> 나타났다! <span class="pg-dim">Lv{pending.monster.level}</span>
      </span>
      {stage.isNew && <span class="pg-new">NEW!</span>}
      {stage.space ? (
        <span class="pg-space-done">{blocked ? '막아냈다!' : '선제공격!'}</span>
      ) : (
        stage.ms <= BALANCE.preemptiveWindowMs && <span class="pg-space-hint">{hint}</span>
      )}
    </div>
  );
}

function RequestBox({ state, media, onInput }: { state: GameState; media: string; onInput(i: GameInput): void }) {
  const stage = state.runtime.stage;
  const save = state.save;
  if (stage?.phase !== 'request' || save.location.screen !== 'stage') return null;
  const prog = save.stages[save.location.stageId];
  if (!prog) return null;
  const t = requestAt(prog.seed, stage.number);
  if (stage.result) {
    return (
      <div class={stage.result.ok ? 'pg-banner pg-request pg-ok' : 'pg-banner pg-request'} title={stage.result.text}>
        <span class="pg-ellipsis">{stage.result.text}</span>
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
  return (
    <div class="pg-banner pg-request pg-two" title={`${t.who.name}: ${t.text}`}>
      <span class="pg-ellipsis">
        {t.who.look ? <Face media={media} id={t.who.look} /> : `${t.who.icon} `}
        <span class="pg-speaker">{t.who.name}</span> {t.text}
      </span>
      <span class="pg-line pg-request-act">
        {helper && (
          <span class="pg-helper pg-ellipsis" title={helper.moveName ? undefined : `${types} 기술이 있으면 성공 ${Math.round(BALANCE.requestChanceMatch * 100)}%`}>
            {helper.moveName ? `${helper.name}의 ${helper.moveName}` : helper.name} · 성공{' '}
            {Math.round(helper.chance * 100)}%
          </span>
        )}
        <Button onClick={() => onInput({ kind: 'request', help: true })} disabled={!helper} title="Enter">
          <KeyCap k="Enter" /> 도와준다
        </Button>
        <Button secondary onClick={() => onInput({ kind: 'request', help: false })} title="Esc">
          <KeyCap k="Esc" /> 지나간다
        </Button>
      </span>
    </div>
  );
}

/** 팀 맨 앞 포켓몬 그림 (오른쪽 위 ◓ 버튼) */
function leadOf(save: GameState['save']): { form: string; shiny: boolean } | null {
  const m = save.party[0] ? save.monsters[save.party[0]] : undefined;
  return m ? { form: m.form, shiny: m.shiny } : null;
}

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
  const objects = gym ? [] : visibleObjects(state, widthPx, layout.scale);
  const stageRt = state.runtime.stage;
  const battle = stageRt?.phase === 'battle' ? stageRt.battle : null;
  const choice = choiceView(state);
  const foeTrainer = foeTrainerView(state);
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
  const art = (layer: 'background' | 'foreground') => (media && !gym ? `url("${media}/backgrounds/forest/${layer}-${themeKind()}-${layout.size}.png")` : 'none');
  // 체육관: 주인공은 무대 왼쪽 (대기실) · 관장은 무대 오른쪽 끝
  const heroLeft = geo ? geo.trainerX : gym ? stage.left + Math.round(stage.width * 0.18) : hero;
  // 큰 주인공이 위쪽 띠 (트레이너 · 만남 · 병원 상자, 상자 자리 fieldTop + 한 줄) 자리까지 올라오면 띠를 주인공 오른쪽 옆으로 — 옆자리가 넉넉할 때만
  //   병원 · 상점 앞 · 안이면 간호순 · 점원 오른쪽 옆으로 ("간호순:" 이 말하는데 띠에 가려지지 않게 — 아트 디렉터)
  const facility = objects.find((o): o is Extract<StageObject, { kind: 'facility' }> => o.kind === 'facility' && o.active);
  const staffLook = facility ? personLook(FACILITY_STAFF[facility.facility.kind].look) : undefined;
  // 병원 · 상점이면 간호순 · 점원과 건물 오른쪽 끝 중 더 오른쪽 (건물이 간호순보다 26px 더 나옴 — 건물 때문에 옮길 때 지붕에 걸치지 않게)
  const buildingRight = facility ? facility.x + (BUILDINGS[facility.facility.kind].w - BUILDINGS[facility.facility.kind].door) * buildingDraw(facility.facility.kind, layout.scale, heroRoom).k : 0;
  const sideFrom = facility && staffLook ? Math.max(staffLeftPx(facility.facility.kind, facility.x, layout.scale, heroRoom) + heroWidthPx(staffLook, layout.scale, heroRoom), buildingRight) : heroLeft + heroW / 2;
  const bannerLeft = Math.round(sideFrom + 8);
  // 오른쪽 끝 — 체육관 대기실은 관장 앞까지
  const leader = personLook(GYM_LEADER.look);
  const leaderW = leader ? heroWidthPx(leader, layout.scale, heroRoom) : 20 * layout.scale;
  // 이름표 (9px 글자, 관장 그림 오른쪽 끝 + 4px 에 붙음 — game.css .pg-foe-trainer .pg-nametag) 의 왼쪽 끝 어림
  // 상대 트레이너 · 관장 · 라이벌 = 무대 오른쪽 끝
  const leaderX = stage.left + foeTrainerX(stage.width, layout.scale);
  const tagLeft = leaderX + leaderW / 2 + 4 - (GYM_LEADER.name.length * 9 + 6) * layout.uiScale;
  const bannerRight = gym ? Math.min(leaderX - leaderW / 2, tagLeft) - 8 : widthPx - 8;
  // 병원 · 상점 건물 (사람보다 큼) 도 같이 — 낮은 패널에서 상자가 지붕 위에 얹히던 것 (2026-10-19 전체 점검, 210px)
  const bannerBottom = fieldTop + Math.round(BANNER_PX * layout.uiScale);
  const buildingTall = facility !== undefined && bodyPx - ground - buildingDraw(facility.facility.kind, layout.scale, heroRoom).visible < bannerBottom;
  const heroTall = !battle && (bodyPx - ground - heroH < bannerBottom || buildingTall) && bannerRight - bannerLeft >= (buildingTall ? FACILITY_SIDE_MIN_PX : BANNER_SIDE_MIN_PX);
  const showToast = state.runtime.toast && (phase === 'walk' || phase === 'clear' || phase === 'lobby' || phase === 'facility');
  const shopInside = stageRt?.phase === 'facility' && stageRt.inside && stageRt.kind === 'shop';
  // 전투 화면 단추의 Space (막기 · 맞받아치기 · 잡기 원) = 키 · 판 클릭과 같은 시계 — 엔진 시간으로만 재면 연출을 기다리는 동안 아무 때나 '완벽'
  const battleInput = (i: GameInput) => onInput(i.kind === 'space' ? spaceInput(state, performance.now()) : i);
  // ② 어디인지 — 스테이지는 미니맵, 체육관은 이름 (지도 줄이 있으면 둘째 줄, 없으면 정보줄 가운데)
  const where = gym ? (
    <span class="pg-stage-name">
      <Icon name="gym" /> 숲 체육관 {save.badges.includes('forest') && <Icon name="badge" title="숲 배지" />}
    </span>
  ) : info && map ? (
    <Minimap stage={info} progress={map.progress} facilities={map.facilities} gym={map.gym} />
  ) : (
    <span>
      <Icon name="tree" /> 숲
    </span>
  );

  return (
    <div class={`pg-screen pg-stage pg-size-${layout.size}${gym ? ' pg-gym' : ''}${covered ? ' pg-covered' : ''}`}>
      {battle && geo?.menuInBar ? (
        <BattleMenuBar battle={battle} save={save} onInput={battleInput} withAuto={geo.autoInMenu} compact={geo.compact} />
      ) : (
        <InfoBar
          split={mapRow}
          left={<BallCount count={battle ? itemLeft(battle, save, 'poke-ball') : (save.bag['poke-ball'] ?? 0)} />}
          center={mapRow ? undefined : where}
          right={
            canOpenMenus(state) ? (
              <MenuButtons
                onOpen={onOpen}
                points={unspentPoints(save)}
                media={media}
                lead={leadOf(save)}
                fast={gym ? undefined : { on: save.settings.fastWalk === true, active: isWalkingFast(state), onToggle: () => onInput({ kind: 'fast-walk', on: save.settings.fastWalk !== true }) }}
                labels={menuLabels(widthPx, mapRow)}
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
          // 튀어나온 순간 길을 클릭해도 선제공격 [제안] · 힘대결 중 클릭 = 연타 (gdd S10 ⑤)
          // 볼을 던졌을 때 클릭 = 타이밍 원 Space (S11)
          if (phase === 'appear' || battle?.phase === 'clash' || battle?.phase === 'catch') onInput({ kind: 'space' });
          // 상대 공격 중 판 클릭 = 패링 (Space 와 같음, 2026-10-19)
          else if (battle && (canParry(battle) || ultSkippable(battle))) onInput(spaceInput(state, performance.now()));
        }}
      >
        {gym ? (
          <GymRoom media={media} k={buildingDraw('hospital', layout.scale, heroRoom).k} floorPx={Math.max(ground + GYM_FLOOR_ABOVE_GROUND_PX, Math.round(bodyPx * GYM_FLOOR_SHARE))} dark={themeKind() === 'dark'} />
        ) : (
          <>
            <ScrollLayer cls="pg-bg" image={art('background')} start={offset * 0.35} pxPerSec={WALK_PX_PER_SEC * layout.scale * 0.35 * walkK} running={phase === 'walk' && live} />
            <ScrollLayer cls="pg-fg" image={art('foreground')} start={offset * 0.7} pxPerSec={WALK_PX_PER_SEC * layout.scale * 0.7 * walkK} running={phase === 'walk' && live} />
          </>
        )}
        {/* ② 지도 줄 — 정보줄 아래 길게 (가운데 720px 칸, 정보줄 볼 · 메뉴와 같은 양 끝) */}
        {mapRow && <div class="pg-maprow">{where}</div>}
        <StageObjects objects={objects} media={media} scale={layout.scale} ground={ground} roomPx={heroRoom} />
        <span class="pg-obj pg-hero-wrap" style={{ left: `${heroLeft}px`, bottom: `${ground}px` }}>
          <Hero px={heroPx} walking={phase === 'walk' && live} fast={fast} gender={look.gender} look={look} media={media} roomPx={heroRoom} />
        </span>
        {/* 전투 중 상대 트레이너 · 관장 = 오른쪽 끝 (남은 볼) · 대기실의 관장 */}
        {((battle && foeTrainer) || (gym && !battle) || (stageRt?.phase === 'rival' && foeTrainer)) && (
          <span class="pg-obj pg-foe-trainer" style={{ left: `${leaderX}px`, bottom: `${ground}px` }} title={foeTrainer?.name ?? GYM_LEADER.name}>
            {/* 머리 위 이름표 (decisions 2026-10-17) · 라이벌이 막 나타난 때는 "!" (gdd 4.12) */}
            {stageRt?.phase === 'rival' && !foeTrainer?.talking ? <span class="pg-trainer-mark">!</span> : <span class="pg-nametag">{foeTrainer?.name ?? GYM_LEADER.name}</span>}
            {foeTrainer && stageRt?.phase !== 'rival' && (
              <span class="pg-foe-balls">
                {Array.from({ length: foeTrainer.balls }, (_, i) => (
                  <span key={i} class={i < foeTrainer.left ? 'pg-ball-slot' : 'pg-ball-slot pg-ball-down'}>
                    <Icon name="ball" />
                  </span>
                ))}
              </span>
            )}
            <Hero px={heroPx} walking={false} hat={foeTrainer?.hat ?? GYM_LEADER.hat} shirt={foeTrainer?.shirt ?? GYM_LEADER.shirt} faceLeft label={foeTrainer?.name ?? GYM_LEADER.name} look={personLook(foeTrainer ? foeTrainer.look : GYM_LEADER.look)} media={media} roomPx={heroRoom} />
          </span>
        )}
        {battle && geo && (
          <BattleLayer battle={battle} save={save} media={media} ground={ground} geo={geo} onInput={battleInput} onProfile={(side) => onOpen({ kind: 'profile', side })} foeTrainerLeft={foeTrainer || gym ? leaderX : undefined} />
        )}
        <EncounterBox state={state} />
        {stageRt?.phase === 'trainer' && foeTrainer?.talking && stageRt.ms < vsStartMs('trainer') && <TrainerBanner name={foeTrainer.name} balls={foeTrainer.balls} media={media} look={foeTrainer.look} />}
        {/* VS 컷인 — 만남 단계 끝 0.8초 (트레이너 · 라이벌) */}
        {(stageRt?.phase === 'trainer' || stageRt?.phase === 'rival') && foeTrainer && stageRt.ms >= vsStartMs(stageRt.phase) && (
          <VsCutIn me={look.label} myBalls={save.party.map((uid) => (save.monsters[uid]?.hp ?? 0) > 0)} foe={foeTrainer.name} foeBalls={foeTrainer.balls} tag={foeTrainer.record} at={stageRt.ms - vsStartMs(stageRt.phase)} />
        )}
        {stageRt?.phase === 'rival' && foeTrainer?.talking && stageRt.ms < vsStartMs('rival') && (
          <TrainerBanner name={foeTrainer.name} balls={foeTrainer.balls} text={`${josaOf(foeTrainer.name, '이/가')} 승부를 걸어왔다!`} tag={foeTrainer.record ?? ''} media={media} look={foeTrainer.look} />
        )}
        <RequestBox state={state} media={media} onInput={onInput} />
        <FacilityBox state={state} media={media} onInput={onInput} onBox={() => onOpen({ kind: 'team' })} />
        {shopInside && <ShopPanel save={save} note={state.runtime.toast?.text} onInput={onInput} onClose={() => onInput({ kind: 'facility-leave' })} />}
        {stageRt?.phase === 'result' && <ResultBox summary={stageRt.summary} next={save.pendingChoices[0]?.kind ?? null} onInput={onInput} />}
        {choice && <ChoiceBox view={choice} media={media} scale={layout.scale} onInput={onInput} />}
        <DefeatBox state={state} media={media} onInput={onInput} />
        <ClearCard state={state} media={media} onInput={onInput} onMap={() => onOpen({ kind: 'map' })} onTeam={() => onOpen({ kind: 'team' })} />
        <LobbyBox state={state} media={media} onInput={onInput} onBox={() => onOpen({ kind: 'team' })} onShop={() => onOpen({ kind: 'shop' })} onMap={() => onOpen({ kind: 'map' })} />
        <BadgeCard state={state} media={media} onInput={onInput} onMap={() => onOpen({ kind: 'map' })} />
        {showToast && state.runtime.toast && (
          // 주인공 머리 위 — 주운 자리에서 바로 보이게
          <div key={state.runtime.toast.text} class="pg-toast" style={{ left: `${Math.max(80, heroLeft)}px`, bottom: `${toastBottom}px` }}>
            {state.runtime.toast.text}
          </div>
        )}
      </div>
    </div>
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
function GymRoom({ media, k, floorPx, dark }: { media: string; k: number; floorPx: number; dark: boolean }) {
  const url = (f: string) => (media ? `url("${media.replace(/\/+$/, '')}/buildings/${f}.png")` : 'none');
  return (
    <div class={dark ? 'pg-gym-room pg-gym-dark' : 'pg-gym-room'}>
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
