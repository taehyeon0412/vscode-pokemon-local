/**
 * 게임 화면 뿌리 — 지금 화면(타이틀 · 게임)을 고르고, 패널이 너무 낮으면 안내만.
 * 게임 위에 뜨는 판 (S07 지도 · S18 내 포켓몬 · S19 가방 · S20 설정 · S14 상점 (대기실) · S21 프로필) 도 여기서 — 떠 있는 동안 게임이 멈춤 (main.ts).
 */
import { Component, type ComponentChildren } from 'preact';
import { canOpenMenus, canShop, canSwapBox, canTravel, inBattle, type GameInput, type GameState } from '../core/engine';
import { profileOpenable } from '../features/battle/model';
import { BagPanel } from '../features/menu/components/BagPanel';
import { MapPanel } from '../features/menu/components/MapPanel';
import { ProfileCard } from '../features/menu/components/ProfileCard';
import { SettingsPanel } from '../features/menu/components/SettingsPanel';
import { ShopPanel } from '../features/menu/components/ShopPanel';
import { TeamPanel } from '../features/menu/components/TeamPanel';
import type { Overlay } from '../features/menu/model';
import type { NewGameChoice } from '../features/starter/model';
import { StageScreen } from '../features/stage/components/StageScreen';
import { TitleScreen } from '../features/title/components/TitleScreen';
import type { TitleInfo } from '../shared/messages';
import { INFO_BAR_PX, type Layout } from '../ui/layout';
import type { Store } from '../ui/store';
import { TooSmall } from '../ui/TooSmall';
import { useStore } from '../ui/use-store';
import type { Screen } from './webview-session';

export interface ViewState {
  screen: Screen;
  title: TitleInfo | null;
  /** 화면에 보일 게임 상태 — 계산은 매 프레임이지만 화면은 1초에 한 번만 바꿈 */
  state: GameState | null;
  layout: Layout;
  /** 패널 너비 (스테이지에서 길 위의 것들을 그릴 자리) */
  widthPx: number;
  /** 버튼을 눌러 확장의 답을 기다리는 중 */
  pending: boolean;
  /** 게임 위에 뜬 판 (null = 없음) */
  overlay: Overlay | null;
}

export interface AppActions {
  /** S03 · S04 에서 고른 것으로 새로 하기 */
  newGame(choice: NewGameChoice): void;
  continueGame(): void;
  exit(): void;
  /** 게임 입력 (Space · 부탁 고르기 등) */
  input(input: GameInput): void;
  /** 판 열기 · 닫기 */
  open(o: Overlay): void;
  close(): void;
  /** 화면을 그리다 오류 — 확장에 알림 (확장이 알림을 띄우고 계산을 넘겨받음) */
  crashed(error: unknown): void;
}

/** 그 판을 지금 띄울 수 있는지 — 안 되면 닫음 (돌을 써서 진화 연출이 시작됨 · 전투가 끝남 등) */
export function overlayAllowed(o: Overlay, state: GameState): boolean {
  const st = state.runtime.stage;
  switch (o.kind) {
    case 'profile':
      return st?.phase === 'battle' && profileOpenable(st.battle);
    case 'shop':
      return state.save.location.screen === 'gym' && canShop(state);
    case 'map':
      return canTravel(state) || st?.phase === 'badge';
    case 'team':
      return !inBattle(state) && st?.phase !== 'choice';
    case 'bag':
    case 'settings':
      return canOpenMenus(state);
  }
}

/** 판이 떠 있는 동안 받는 입력 (판에서 누른 것) — 나머지 (전투 숫자 키 · Space 등) 는 안 받음 */
export const OVERLAY_INPUTS: readonly GameInput['kind'][] = ['team-move', 'team-swap', 'team-to-box', 'points', 'use-item', 'notifications', 'buy', 'travel'];

export function App({ store, media, actions }: { store: Store<ViewState>; media: string; actions: AppActions }) {
  const v = useStore(store);
  // 일반 모드에서는 아무것도 그리지 않음 (#pokemon-game 이 비면 game.css 가 숨김)
  if (v.screen === 'none') return null;
  // 화면이 바뀌면 (타이틀 → 게임 등) 오류 표시를 새로 시작
  return (
    <Guard key={v.screen} onError={actions.crashed}>
      <Screens v={v} media={media} actions={actions} />
    </Guard>
  );
}

function Screens({ v, media, actions }: { v: ViewState; media: string; actions: AppActions }) {
  if (v.screen === 'title' && v.title) {
    const title = <TitleScreen info={v.title} media={media} pending={v.pending} onNew={actions.newGame} onContinue={actions.continueGame} heroPx={Math.max(2, Math.round(2 * v.layout.scale))} bodyPx={v.layout.heightPx - Math.round(INFO_BAR_PX * v.layout.uiScale)} />;
    // 주인공 · 스타팅을 고르다 패널이 낮아져도 고르던 것이 그대로 — 타이틀은 숨겨 둔 채로 둠 (#298)
    if (v.layout.tooSmall) {
      return (
        <>
          <TooSmall layout={v.layout} playing={false} />
          <div hidden>{title}</div>
        </>
      );
    }
    return title;
  }
  if (v.layout.tooSmall) return <TooSmall layout={v.layout} playing={v.screen === 'game'} />;
  if (v.screen === 'game' && v.state) {
    return (
      <>
        <StageScreen state={v.state} layout={v.layout} widthPx={v.widthPx} media={media} onInput={actions.input} onOpen={actions.open} />
        {v.overlay && <OverlayView o={v.overlay} state={v.state} media={media} actions={actions} />}
      </>
    );
  }
  return null;
}

function OverlayView({ o, state, media, actions }: { o: Overlay; state: GameState; media: string; actions: AppActions }) {
  const save = state.save;
  const st = state.runtime.stage;
  switch (o.kind) {
    case 'map':
      return <MapPanel state={state} swap={canSwapBox(state)} midStage={save.location.screen === 'stage' && st?.phase === 'walk'} onInput={actions.input} onTeam={() => actions.open({ kind: 'team', back: 'map' })} onClose={actions.close} />;
    case 'team':
      return <TeamPanel save={save} media={media} swap={canSwapBox(state)} onInput={actions.input} onClose={actions.close} />;
    case 'bag':
      return <BagPanel save={save} media={media} onInput={actions.input} onClose={actions.close} />;
    case 'settings':
      return <SettingsPanel save={save} onInput={actions.input} onExit={actions.exit} onClose={actions.close} />;
    case 'shop':
      return (
        <div class="pg-overlay-field">
          <ShopPanel save={save} note={state.runtime.toast?.text} onInput={actions.input} onClose={actions.close} />
        </div>
      );
    case 'profile':
      return st?.phase === 'battle' ? (
        <div class="pg-overlay-field">
          <ProfileCard battle={st.battle} save={save} side={o.side} onClose={actions.close} />
        </div>
      ) : null;
  }
}

/** 화면 오류를 잡아 빈 패널 대신 안내 — 패널 제목줄 🏠 로 일반 모드로 나갈 수 있음 */
class Guard extends Component<{ onError(e: unknown): void; children: ComponentChildren }, { failed: boolean }> {
  override state = { failed: false };

  override componentDidCatch(error: unknown): void {
    console.error('[pokemon-game] 화면 오류', error);
    this.setState({ failed: true });
    this.props.onError(error);
  }

  override render() {
    if (this.state.failed) return <div class="pg-too-small"><span>⚠ 게임 화면에 오류가 났어요 — 제목줄 🏠 로 일반 모드로 나갈 수 있어요 (진행은 저장돼요)</span></div>;
    return this.props.children;
  }
}
