/**
 * S06 스테이지 (gdd S06 · mvp-spec 3.2) — 자동으로 걷는 화면 · S16 체육관 (대기실 · 관장전) 도 같은 틀.
 *   정보줄: ① 볼 개수 · ② 미니맵 (체육관은 이름) · ⑦ ~ ⑩ 오른쪽 위 버튼 (걷는 중에만)
 *   길: 숲 배경 2겹이 흐르고 (확장에 있는 숲 그림) ③ 주인공은 제자리걸음, ④ 흔적 · ⑤ 트레이너 · ⑭ 아이템 · ⑯ 부탁 · ⑥ 병원 · 상점 · ⑮ 배경 포켓몬
 *   체육관: 코드로 그린 방 · 오른쪽에 관장 (임시 디자인)
 * 전투 (S09 · S10) 는 같은 길 위에서 — features/battle 의 BattleLayer (주인공은 왼쪽 끝 트레이너 자리로, 야생은 튀어나온 자리 그대로 · 트레이너는 오른쪽 끝).
 * 선제공격은 Space 또는 길 클릭 [제안] — 코딩 중에는 편집기에 포커스가 있어 Space 가 코드에 들어가므로, 클릭하면 패널에 포커스도 옴.
 */
import { useRef } from 'preact/hooks';
import { BALANCE } from '../../../core/balance';
import { canOpenMenus, itemLeft, type GameInput, type GameState } from '../../../core/engine';
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
import { INFO_BAR_PX, type Layout } from '../../../ui/layout';
import { BattleLayer, BattleMenuBar } from '../../battle/components/BattleLayer';
import { battleGeometry, battleSpritePx, foeTrainerX, placeOnStage, trainerBattleFoeX } from '../../battle/model';
import { MenuButtons } from '../../menu/components/MenuButtons';
import { ShopPanel } from '../../menu/components/ShopPanel';
import { hasUnspent, type Overlay } from '../../menu/model';
import { ChoiceBox } from '../../result/components/ChoiceBox';
import { ResultBox } from '../../result/components/ResultBox';
import { choiceView } from '../../result/model';
import { battleStage, contactX, foeTrainerView, heroX, minimapOf, staffLeftPx, STAGES, stagePx, visibleObjects, WALK_PX_PER_SEC, type StageObject } from '../model';
import { BadgeCard, ClearCard, DefeatBox, FacilityBox, LobbyBox, TrainerBanner } from './FieldBoxes';
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
}

/** 숲 그림 크기별 높이 (원본 300 · 400 · 500 · 800px) 에서 땅 윗면 — 길 위의 것들이 서는 높이 */
const GROUND_PX: Record<Layout['size'], number> = { nano: 15, small: 20, medium: 25, large: 40 };
/** 위쪽 띠 한 줄 높이 (글자 배율 1) · 띠를 주인공 옆으로 옮길 때 남아야 할 폭 */
const BANNER_PX = 22;
const BANNER_SIDE_MIN_PX = 180;
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
        야생 <b>{withJosa(name, '이/가')}</b> 나타났다! <span class="pg-dim">Lv{pending.monster.level}</span>
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

function RequestBox({ state, onInput }: { state: GameState; onInput(i: GameInput): void }) {
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
      <span class="pg-ellipsis pg-line">
        {t.who.look ? null : `${t.who.icon} `}
        <b>{t.who.name}</b>: {t.text}
      </span>
      <span class="pg-line pg-request-act">
        {helper && (
          <span class="pg-helper pg-ellipsis" title={helper.moveName ? undefined : `${types} 기술이 있으면 성공 ${Math.round(BALANCE.requestChanceMatch * 100)}%`}>
            {helper.moveName ? `${helper.name}의 ${helper.moveName}` : `${helper.name} (맞는 기술 없음 — ${types} 기술이면 ${Math.round(BALANCE.requestChanceMatch * 100)}%)`} · 성공{' '}
            {Math.round(helper.chance * 100)}%
          </span>
        )}
        <Button onClick={() => onInput({ kind: 'request', help: true })} disabled={!helper} title="Enter">
          도와준다
        </Button>
        <Button secondary onClick={() => onInput({ kind: 'request', help: false })} title="Esc">
          지나간다
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

export function StageScreen({ state, layout, widthPx, media, onInput, onOpen }: StageScreenProps) {
  const save = state.save;
  const gym = save.location.screen === 'gym';
  const stageId = save.location.screen === 'stage' ? save.location.stageId : null;
  const info = stageId ? STAGES[stageId] : null;
  const map = minimapOf(state);
  const phase = state.runtime.stage?.phase ?? (gym ? 'lobby' : 'walk');
  const progress = map?.progress ?? 0;
  const offset = progress * stagePx(layout.scale);
  const ground = GROUND_PX[layout.size] - 2;
  const hero = heroX(widthPx);
  const heroPx = 2 * layout.scale;
  const look = heroLookOf(save.player?.look, save.player?.gender);
  const bodyPx = layout.heightPx - Math.round(INFO_BAR_PX * layout.uiScale);
  // 주인공이 쓸 수 있는 높이 — 큰 그림이 안 들어가면 작은 그림 (data/heroes.ts heroDraw)
  const heroRoom = bodyPx - ground - 2;
  const heroH = heroHeightPx(look, layout.scale, heroRoom);
  const heroW = heroWidthPx(look, layout.scale, heroRoom);
  // 머리 위 알림 — 패널이 낮으면 머리 위 자리가 알림 한 줄보다 좁음 → 칸 안으로 (16px = 글자 11 + 위아래 여백, 글자 배율만큼)
  const toastBottom = Math.max(0, Math.min(ground + heroH + 4, bodyPx - Math.ceil(16 * layout.uiScale) - 1));
  const objects = gym ? [] : visibleObjects(state, widthPx, layout.scale);
  const stageRt = state.runtime.stage;
  const battle = stageRt?.phase === 'battle' ? stageRt.battle : null;
  const choice = choiceView(state);
  const foeTrainer = foeTrainerView(state);
  // 전투 · 관장 · 라이벌은 무대 안에서 (넓은 패널은 720px 무대 — battleStage), 자리는 무대 안에서 재고 패널 자리로 옮김
  const stage = battleStage(widthPx);
  const geo = battle
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
        }),
        stage,
        widthPx,
      )
    : null;
  const art = (layer: 'background' | 'foreground') => (media && !gym ? `url("${media}/backgrounds/forest/${layer}-${themeKind()}-${layout.size}.png")` : 'none');
  // 체육관: 주인공은 무대 왼쪽 (대기실) · 관장은 무대 오른쪽 끝
  const heroLeft = geo ? geo.trainerX : gym ? stage.left + Math.round(stage.width * 0.18) : hero;
  // 큰 주인공이 위쪽 띠 (트레이너 · 만남 · 병원 상자, 위 3px + 한 줄) 자리까지 올라오면 띠를 주인공 오른쪽 옆으로 — 옆자리가 넉넉할 때만
  //   병원 · 상점 앞 · 안이면 간호순 · 점원 오른쪽 옆으로 ("간호순:" 이 말하는데 띠에 가려지지 않게 — 아트 디렉터)
  const facility = objects.find((o): o is Extract<StageObject, { kind: 'facility' }> => o.kind === 'facility' && o.active);
  const staffLook = facility ? personLook(FACILITY_STAFF[facility.facility.kind].look) : undefined;
  const sideFrom = facility && staffLook ? staffLeftPx(facility.facility.kind, facility.x, layout.scale, heroRoom) + heroWidthPx(staffLook, layout.scale, heroRoom) : heroLeft + heroW / 2;
  const bannerLeft = Math.round(sideFrom + 8);
  // 오른쪽 끝 — 체육관 대기실은 관장 앞까지
  const leader = personLook(GYM_LEADER.look);
  const leaderW = leader ? heroWidthPx(leader, layout.scale, heroRoom) : 20 * layout.scale;
  // 이름표 (9px 글자, 관장 그림 오른쪽 끝 + 4px 에 붙음 — game.css .pg-foe-trainer .pg-nametag) 의 왼쪽 끝 어림
  // 상대 트레이너 · 관장 · 라이벌 = 무대 오른쪽 끝
  const leaderX = stage.left + foeTrainerX(stage.width, layout.scale);
  const tagLeft = leaderX + leaderW / 2 + 4 - (GYM_LEADER.name.length * 9 + 6) * layout.uiScale;
  const bannerRight = gym ? Math.min(leaderX - leaderW / 2, tagLeft) - 8 : widthPx - 8;
  const heroTall = !battle && bodyPx - ground - heroH < 3 + Math.round(BANNER_PX * layout.uiScale) && bannerRight - bannerLeft >= BANNER_SIDE_MIN_PX;
  const showToast = state.runtime.toast && (phase === 'walk' || phase === 'clear' || phase === 'lobby' || phase === 'facility');
  const shopInside = stageRt?.phase === 'facility' && stageRt.inside && stageRt.kind === 'shop';

  return (
    <div class={`pg-screen pg-stage pg-size-${layout.size}${gym ? ' pg-gym' : ''}`}>
      {battle && geo?.menuInBar ? (
        <BattleMenuBar battle={battle} save={save} onInput={onInput} withAuto={geo.autoInMenu} compact={geo.compact} />
      ) : (
        <InfoBar
          left={<BallCount count={battle ? itemLeft(battle, save, 'poke-ball') : (save.bag['poke-ball'] ?? 0)} />}
          center={
            gym ? (
              <span class="pg-stage-name">
                <Icon name="gym" /> 숲 체육관 {save.badges.includes('forest') && <Icon name="badge" title="숲 배지" />}
              </span>
            ) : info && map ? (
              <Minimap stage={info} progress={map.progress} facilities={map.facilities} gym={map.gym} />
            ) : (
              <span>
                <Icon name="tree" /> 숲
              </span>
            )
          }
          right={canOpenMenus(state) ? <MenuButtons onOpen={onOpen} dot={hasUnspent(save)} media={media} lead={leadOf(save)} /> : null}
        />
      )}
      <div
        class={['pg-body', 'pg-field', battle ? 'pg-in-battle' : '', heroTall ? 'pg-hero-tall' : ''].filter(Boolean).join(' ')}
        style={heroTall ? { '--pg-banner-left': `${bannerLeft}px`, '--pg-banner-max': `${Math.round(bannerRight - bannerLeft)}px` } : undefined}
        onPointerDown={() => {
          // 튀어나온 순간 길을 클릭해도 선제공격 [제안] · 힘대결 중 클릭 = 연타 (gdd S10 ⑤)
          // 볼을 던졌을 때 클릭 = 타이밍 원 Space (S11)
          if (phase === 'appear' || battle?.phase === 'clash' || battle?.phase === 'catch') onInput({ kind: 'space' });
        }}
      >
        {gym ? (
          <div class="pg-gym-room" />
        ) : (
          <>
            <ScrollLayer cls="pg-bg" image={art('background')} start={offset * 0.35} pxPerSec={WALK_PX_PER_SEC * layout.scale * 0.35} running={phase === 'walk'} />
            <ScrollLayer cls="pg-fg" image={art('foreground')} start={offset * 0.7} pxPerSec={WALK_PX_PER_SEC * layout.scale * 0.7} running={phase === 'walk'} />
          </>
        )}
        <StageObjects objects={objects} media={media} scale={layout.scale} ground={ground} roomPx={heroRoom} />
        <span class="pg-obj pg-hero-wrap" style={{ left: `${heroLeft}px`, bottom: `${ground}px` }}>
          <Hero px={heroPx} walking={phase === 'walk'} gender={look.gender} look={look} media={media} roomPx={heroRoom} />
        </span>
        {/* 전투 중 상대 트레이너 · 관장 = 오른쪽 끝 (남은 볼) · 대기실의 관장 */}
        {((battle && foeTrainer) || (gym && !battle) || (stageRt?.phase === 'rival' && foeTrainer)) && (
          <span class="pg-obj pg-foe-trainer" style={{ left: `${leaderX}px`, bottom: `${ground}px` }} title={foeTrainer?.name ?? GYM_LEADER.name}>
            {/* 머리 위 이름표 (decisions 2026-10-17) · 라이벌이 막 나타난 때는 "!" (gdd 4.12) */}
            {stageRt?.phase === 'rival' && !foeTrainer?.talking ? <span class="pg-trainer-mark">!</span> : <span class="pg-nametag">{foeTrainer?.name ?? GYM_LEADER.name}</span>}
            {foeTrainer && stageRt?.phase !== 'rival' && (
              <span class="pg-foe-balls">
                {Array.from({ length: foeTrainer.balls }, (_, i) => (
                  <span key={i} class={i < foeTrainer.left ? 'pg-ball' : 'pg-ball pg-ball-down'} />
                ))}
              </span>
            )}
            <Hero px={heroPx} walking={false} hat={foeTrainer?.hat ?? GYM_LEADER.hat} shirt={foeTrainer?.shirt ?? GYM_LEADER.shirt} faceLeft label={foeTrainer?.name ?? GYM_LEADER.name} look={personLook(foeTrainer ? foeTrainer.look : GYM_LEADER.look)} media={media} roomPx={heroRoom} />
          </span>
        )}
        {battle && geo && <BattleLayer battle={battle} save={save} media={media} ground={ground} geo={geo} onInput={onInput} onProfile={(side) => onOpen({ kind: 'profile', side })} />}
        <EncounterBox state={state} />
        {stageRt?.phase === 'trainer' && foeTrainer?.talking && <TrainerBanner name={foeTrainer.name} balls={foeTrainer.balls} />}
        {stageRt?.phase === 'rival' && foeTrainer?.talking && (
          <TrainerBanner name={foeTrainer.name} balls={foeTrainer.balls} text={`${josaOf(foeTrainer.name, '이/가')} 승부를 걸어왔다!`} tag={foeTrainer.record ?? ''} />
        )}
        <RequestBox state={state} onInput={onInput} />
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

/** 배경이 흐르는 거리 (아주 멀리 — 반복 그림이라 그림 폭을 몰라도 됨, 초당 17 ~ 70px 이면 몇 시간) */
const SCROLL_DISTANCE_PX = 1_000_000;

/**
 * 배경 · 앞 수풀 — 걷는 동안 CSS 애니메이션으로 일정하게 흐름 (화면 새로 고침마다 매끈하게 · 2026-10-19 태현 님 "뚝뚝 끊겨 눈이 아파").
 * 처음 위치는 지금 진행 위치에서 (음수 지연), 멈추면 (만남 · 전투 · 병원 앞 …) 같이 멈춤. 크기가 바뀌면 다시 맞춤. 길 위의 것과 딱 맞을 필요는 없는 겹 (패럴랙스)
 */
function ScrollLayer({ cls, image, start, pxPerSec, running }: { cls: string; image: string; start: number; pxPerSec: number; running: boolean }) {
  // 애니메이션 시작점은 처음 그릴 때 (또는 빠르기가 바뀔 때) 한 번만 — 매번 바꾸면 그때마다 튐
  const at = useRef<{ start: number; v: number } | null>(null);
  if (!at.current || at.current.v !== pxPerSec) at.current = { start, v: pxPerSec };
  const { start: s0, v } = at.current;
  return (
    <div
      class={`${cls} pg-scroll`}
      style={{
        backgroundImage: image,
        animationDuration: `${v > 0 ? SCROLL_DISTANCE_PX / v : 1}s`,
        animationDelay: `${v > 0 ? -s0 / v : 0}s`,
        animationPlayState: running && v > 0 ? 'running' : 'paused',
      }}
    />
  );
}
