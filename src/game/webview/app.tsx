/**
 * 게임 화면 뿌리 — 지금 화면(타이틀 · 게임)을 고르고, 패널이 너무 낮으면 안내만.
 */
import { Component, type ComponentChildren } from 'preact';
import type { GameState } from '../core/engine';
import type { GameInput } from '../core/engine';
import { StageScreen } from '../features/stage/components/StageScreen';
import { TitleScreen } from '../features/title/components/TitleScreen';
import type { TitleInfo } from '../shared/messages';
import type { Layout } from '../ui/layout';
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
}

export interface AppActions {
  newGame(): void;
  continueGame(): void;
  exit(): void;
  /** 게임 입력 (Space · 부탁 고르기 등) */
  input(input: GameInput): void;
  /** 화면을 그리다 오류 — 확장에 알림 (확장이 알림을 띄우고 계산을 넘겨받음) */
  crashed(error: unknown): void;
}

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
  if (v.layout.tooSmall) return <TooSmall layout={v.layout} />;
  if (v.screen === 'title' && v.title) {
    return <TitleScreen info={v.title} media={media} pending={v.pending} onNew={actions.newGame} onContinue={actions.continueGame} />;
  }
  if (v.screen === 'game' && v.state) {
    return <StageScreen state={v.state} layout={v.layout} widthPx={v.widthPx} media={media} onInput={actions.input} />;
  }
  return null;
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
    if (this.state.failed) return <div class="pg-too-small">⚠ 게임 화면에 오류가 났어요 — 제목줄 🏠 로 일반 모드로 나갈 수 있어요 (진행은 저장돼요)</div>;
    return this.props.children;
  }
}
