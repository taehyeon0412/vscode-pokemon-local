/**
 * S06 스테이지 (gdd S06 · mvp-spec 3.2) — 자동으로 걷는 화면.
 *   정보줄: ① 볼 개수 · ② 미니맵 (오른쪽 ⑦ ~ ⑩ 은 단계 8)
 *   길: 숲 배경 2겹이 흐르고 (확장에 있는 숲 그림) ③ 주인공은 제자리걸음, ④ 흔적 · ⑭ 아이템 · ⑯ 부탁 · ⑥ 병원 · 상점 · ⑮ 배경 포켓몬
 * 전투 (S09 · S10) 는 같은 길 위에서 — features/battle 의 BattleLayer (주인공은 왼쪽 끝 트레이너 자리로, 야생은 튀어나온 자리 그대로).
 * 선제공격은 Space 또는 길 클릭 [제안] — 코딩 중에는 편집기에 포커스가 있어 Space 가 코드에 들어가므로, 클릭하면 패널에 포커스도 옴.
 */
import { BALANCE } from '../../../core/balance';
import type { GameInput, GameState } from '../../../core/engine';
import { bestHelper, requestAt } from '../../../core/rules/request';
import { withJosa } from '../../../core/text';
import { speciesOf } from '../../../data';
import { BallCount } from '../../../ui/BallCount';
import { Button } from '../../../ui/Button';
import { typeNameKo } from '../../../ui/format';
import { InfoBar } from '../../../ui/InfoBar';
import { INFO_BAR_PX, type Layout } from '../../../ui/layout';
import { BattleLayer, BattleMenuBar } from '../../battle/components/BattleLayer';
import { battleGeometry, battleSpritePx } from '../../battle/model';
import { contactX, heroX, minimapOf, STAGES, stagePx, visibleObjects } from '../model';
import { Hero } from './Hero';
import { Minimap } from './Minimap';
import { StageObjects } from './StageObjects';

export interface StageScreenProps {
  state: GameState;
  layout: Layout;
  widthPx: number;
  media: string;
  onInput(input: GameInput): void;
}

/** VS Code 테마 — 밝은 테마면 밝은 숲 그림 (일반 모드와 같은 그림 · 같은 규칙) */
function themeKind(): 'light' | 'dark' {
  const c = document.body.classList;
  return c.contains('vscode-light') || c.contains('vscode-high-contrast-light') ? 'light' : 'dark';
}

/** 숲 그림 크기별 높이 (원본 300 · 400 · 500 · 800px) 에서 땅 윗면 — 길 위의 것들이 서는 높이 */
const GROUND_PX: Record<Layout['size'], number> = { nano: 15, small: 20, medium: 25, large: 40 };
/** 주인공 키 (픽셀 14줄 × 픽셀 크기) */
const HERO_ROWS = 14;

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
        <span class="pg-space-done">{blocked ? '🛡 막아냈다!' : '⚡ 선제공격!'}</span>
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
        {stage.result.reward && <span class="pg-reward">🎁 {stage.result.reward}</span>}
      </div>
    );
  }
  const helper = bestHelper(save, t);
  const types = t.types.map(typeNameKo).join(' · ');
  return (
    <div class="pg-banner pg-request pg-two" title={`${t.who.name}: ${t.text}`}>
      <span class="pg-ellipsis pg-line">
        {t.who.icon} <b>{t.who.name}</b>: {t.text}
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

export function StageScreen({ state, layout, widthPx, media, onInput }: StageScreenProps) {
  const save = state.save;
  const stageId = save.location.screen === 'stage' ? save.location.stageId : null;
  const info = stageId ? STAGES[stageId] : null;
  const map = minimapOf(state);
  const phase = state.runtime.stage?.phase ?? 'walk';
  const progress = map?.progress ?? 0;
  const offset = progress * stagePx(layout.scale);
  const ground = GROUND_PX[layout.size] - 2;
  const hero = heroX(widthPx);
  const heroPx = 2 * layout.scale;
  const objects = visibleObjects(state, widthPx, layout.scale);
  const stageRt = state.runtime.stage;
  const battle = stageRt?.phase === 'battle' ? stageRt.battle : null;
  const geo = battle
    ? battleGeometry({
        widthPx,
        bodyPx: layout.heightPx - Math.round(INFO_BAR_PX * layout.uiScale),
        scale: layout.scale,
        uiScale: layout.uiScale,
        ground,
        foeX: contactX(widthPx, layout.scale),
        meSpritePx: battleSpritePx(battle.me.form, layout.scale, layout.heightPx),
        foeSpritePx: battleSpritePx(battle.foe.form, layout.scale, layout.heightPx),
        heroPx: HERO_ROWS * heroPx,
      })
    : null;
  const art = (layer: 'background' | 'foreground') => (media ? `url("${media}/backgrounds/forest/${layer}-${themeKind()}-${layout.size}.png")` : 'none');

  return (
    <div class={`pg-screen pg-stage pg-size-${layout.size}`}>
      {battle && geo?.menuInBar ? (
        <BattleMenuBar battle={battle} save={save} onInput={onInput} withAuto={geo.autoInMenu} compact={geo.compact} />
      ) : (
        <InfoBar
          left={<BallCount count={save.bag['poke-ball'] ?? 0} />}
          center={info && map ? <Minimap stage={info} progress={map.progress} facilities={map.facilities} gym={map.gym} /> : <span>🌲 숲</span>}
        />
      )}
      <div
        class={battle ? 'pg-body pg-field pg-in-battle' : 'pg-body pg-field'}
        onPointerDown={() => {
          // 튀어나온 순간 길을 클릭해도 선제공격 [제안] · 힘대결 중 클릭 = 연타 (gdd S10 ⑤)
          if (phase === 'appear' || battle?.phase === 'clash') onInput({ kind: 'space' });
        }}
      >
        <div class="pg-bg" style={{ backgroundImage: art('background'), backgroundPositionX: `${-Math.round(offset * 0.35)}px` }} />
        <div class="pg-fg" style={{ backgroundImage: art('foreground'), backgroundPositionX: `${-Math.round(offset * 0.7)}px` }} />
        <StageObjects objects={objects} media={media} scale={layout.scale} ground={ground} />
        <span class="pg-obj pg-hero-wrap" style={{ left: `${geo ? geo.trainerX : hero}px`, bottom: `${ground}px` }}>
          <Hero px={heroPx} walking={phase === 'walk'} />
        </span>
        {battle && geo && <BattleLayer battle={battle} save={save} media={media} ground={ground} geo={geo} onInput={onInput} />}
        <EncounterBox state={state} />
        <RequestBox state={state} onInput={onInput} />
        {phase === 'end' && (
          <div class="pg-banner pg-end pg-wrap">
            <span class="pg-ellipsis">🏁 스테이지 끝까지 왔어요! (클리어 카드는 다음 단계들에서)</span>
            <Button onClick={() => onInput({ kind: 'restart-stage' })}>처음부터 다시 걷기</Button>
          </div>
        )}
        {state.runtime.toast && phase === 'walk' && (
          // 주인공 머리 위 — 주운 자리에서 바로 보이게
          <div key={state.runtime.toast.text} class="pg-toast" style={{ left: `${hero}px`, bottom: `${ground + HERO_ROWS * heroPx + 4}px` }}>
            {state.runtime.toast.text}
          </div>
        )}
      </div>
    </div>
  );
}
