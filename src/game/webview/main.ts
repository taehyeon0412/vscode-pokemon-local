/**
 * game.js — 게임 모드 웹뷰 쪽 시작점. boot.js 가 확장의 "load" 를 받고 불러온다.
 * 메시지 · 보임/안 보임 · 그리기 박자를 세션에 잇고, 화면(Preact)을 #pokemon-game 에 그린다.
 */
import { h, render } from 'preact';
import { STAGE_IDS } from '../core/save';
import { stageViewKey } from '../features/stage/model';
import { createStartSave } from '../features/starter/model';
import { GAME_COMMAND, isHostToWebview } from '../shared/messages';
import { shouldHoldBattle } from '../features/battle/fx/hold';
import { fitLayout, gameSize } from '../ui/layout';
import { Store } from '../ui/store';
import { App, OVERLAY_INPUTS, overlayAllowed, type AppActions, type ViewState } from './app';
import { FrameLoop } from './frame-loop';
import './game.css';
import { getGameConfig, getGamePort } from './vscode-api';
import { WebviewSession } from './webview-session';

/** 게임 화면이 보이는 동안 body 에 붙임 — game.css 가 일반 모드 층을 숨기고, 일반 모드는 포켓몬을 멈춤 (main-bundle.js GAME-PATCH) */
const GAME_ON_CLASS = 'pokemon-game-on';
/** 버튼을 누르고 확장의 답이 이만큼 없으면 다시 누를 수 있게 */
const PENDING_TIMEOUT_MS = 5000;
/** 화면에 보이는 게임 상태를 바꾸는 간격 (계산은 매 프레임) — 스테이지는 배경이 흐르니 초당 30번 */
const VIEW_REFRESH_MS = 1000 / 30;

/** 접힌 상태에서 다시 높아진 뒤 상태를 달라고 하기까지 기다리는 시간 (ms) */
const EXPAND_WAIT_MS = 150;

const port = getGamePort();
if (!port) {
  console.error('[pokemon-game] VS Code API 가 없어요 — extension.js 의 GAME-PATCH 를 확인하세요');
} else {
  const config = getGameConfig();
  const session = new WebviewSession({ post: (m) => port.postMessage(m), now: () => performance.now(), hold: (state, dt) => shouldHoldBattle(state, dt, performance.now()) });
  const store = new Store<ViewState>({
    screen: 'none',
    title: null,
    state: null,
    layout: fitLayout(gameSize(config.size), window.innerHeight, config.minHeight),
    widthPx: window.innerWidth,
    pending: false,
    overlay: null,
    live: false,
  });
  let viewRefreshedAt = 0;
  let lastViewKey = '';
  let pendingTimer: number | undefined;

  const setPending = (pending: boolean) => {
    window.clearTimeout(pendingTimer);
    if (pending) pendingTimer = window.setTimeout(() => store.set({ pending: false }), PENDING_TIMEOUT_MS);
    store.set({ pending });
  };

  // 프레임 오류로 멈추면 마지막 상태를 확장에 넘김 (자동 전투면 확장이 이어 감)
  const loop = new FrameLoop(
    (dt) => {
      // 접힌 상태 (150px 아래) 면 그리지 않음 — 게임은 확장이 맡음 (sync)
      if (store.get().layout.tooSmall) return;
      session.frame(dt);
      // 판이 떠 있는 동안은 게임이 멈춤 — 판에서 누른 것은 input 이 바로 그림 (초당 30번 열쇠 계산을 쉼)
      if (store.get().overlay) return;
      const now = performance.now();
      if (now - viewRefreshedAt >= VIEW_REFRESH_MS) {
        viewRefreshedAt = now;
        // 보이는 것이 바뀌었을 때만 다시 그림 (부탁 · 끝에서 기다리는 동안은 안 그림). 포커스는 "Space! / 클릭!" 안내에
        const cur = session.current;
        const key = cur ? `${stageViewKey(cur)}|${document.hasFocus()}` : '';
        if (key !== lastViewKey) {
          lastViewKey = key;
          store.set({ state: cur });
        }
      }
    },
    () => session.hide(),
  );

  /** 맡고 있고 보이고 패널 높이가 될 때만 돎. 안 보이거나 접힌 상태 (150px 아래) 인데 맡겨졌으면 바로 돌려줌 (확장이 안 볼 때 규칙으로 이어 감) */
  // 접힌 상태에서 다시 높아지면 잠깐 기다렸다가 상태를 달라고 함 — 창 크기를 끌며 150px 경계를 오르내리는 동안 확장과 왕복하지 않게 (#297)
  let expandTimer = 0;
  const sync = () => {
    const low = store.get().layout.tooSmall;
    window.clearTimeout(expandTimer);
    if (!low && session.isCollapsed) expandTimer = window.setTimeout(() => session.setCollapsed(store.get().layout.tooSmall, !document.hidden), EXPAND_WAIT_MS);
    else session.setCollapsed(low, !document.hidden);
    if (session.running && (document.hidden || low)) session.hide();
    if (session.running && !low) loop.start();
    else loop.stop();
  };

  session.subscribe(() => {
    viewRefreshedAt = performance.now();
    setPending(false);
    // 새로 맡김 (다른 쪽에서 계산한 상태) — 같은 게임을 이어 받으면 (접었다 펴기 · 다른 탭) 떠 있던 판 (지도 · 가방 …) 은 그대로 두고
    // 지금 상태에서 못 띄우는 판만 아래에서 닫음 (#298). 타이틀 · 일반 모드로 바뀌면 닫음
    const keep = session.screen === 'game' && store.get().screen === 'game';
    store.set({ screen: session.screen, title: session.title, state: session.current, overlay: keep ? store.get().overlay : null, live: session.running });
  });

  // 판이 떠 있는 동안 게임을 멈춤 · 지금 상태에서 띄울 수 없는 판은 닫음
  store.subscribe(() => {
    const v = store.get();
    if (v.overlay && v.state && !overlayAllowed(v.overlay, v.state)) store.set({ overlay: null });
    session.setPaused(store.get().overlay !== null);
  });

  store.subscribe(() => document.body.classList.toggle(GAME_ON_CLASS, store.get().screen !== 'none'));

  const actions: AppActions = {
    newGame: (choice) => {
      try {
        const seed = crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now();
        const save = createStartSave(Date.now(), seed, choice.dex, { gender: choice.gender, look: choice.look, moves: choice.moves });
        setPending(true);
        session.newGame(save);
      } catch (e) {
        console.error('[pokemon-game] 새 세이브를 만들지 못함', e);
        setPending(false);
      }
    },
    continueGame: () => {
      setPending(true);
      session.continueGame();
    },
    exit: () => {
      setPending(true);
      session.exit();
    },
    input: (input) => {
      // 판이 떠 있으면 판에서 누른 것만 (전투 숫자 키 · Space 가 뒤에서 눌리지 않게)
      if (store.get().overlay && !OVERLAY_INPUTS.includes(input.kind)) return;
      // 받은 입력은 바로 화면에 (다음 새로 그림을 기다리지 않게)
      if (session.input(input)) store.set({ state: session.current });
    },
    open: (overlay) => {
      const cur = session.current;
      if (cur && overlayAllowed(overlay, cur)) store.set({ overlay });
    },
    // 지도에서 연 내 포켓몬 (④ 팀 바꾸기) 을 닫으면 지도로 ("부른 화면으로")
    close: () => {
      const o = store.get().overlay;
      store.set({ overlay: o?.kind === 'team' && o.back ? { kind: o.back } : null });
    },
    crashed: (e) => {
      loop.stop();
      session.hide(); // 게임 중이면 마지막 상태를 넘김 (확장이 들고 있음)
      port.postMessage({ command: GAME_COMMAND, type: 'load-failed', message: `화면 오류: ${String(e)}` });
    },
  };

  const root = document.createElement('div');
  root.id = 'pokemon-game';
  // game.css 를 받기 전에는 숨김 (모양 없는 화면이 번쩍이지 않게)
  root.hidden = true;
  document.body.appendChild(root);
  // 글자 · 버튼 · 정보줄 배율 (패널 높이에 맞춰, game.css 의 --pg-ui) — style 속성 대신 CSSOM 으로 (웹뷰 보안 규칙)
  const applyUiScale = () => root.style.setProperty('--pg-ui', String(store.get().layout.uiScale));
  applyUiScale();
  store.subscribe(applyUiScale);
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = config.script.replace(/game\.js(?=$|[?#])/, 'game.css');
  const show = () => {
    root.hidden = false;
  };
  // 글꼴 (Pretendard — game.css @font-face) 까지 받은 뒤에 보임: 글자 없는 버튼이 잠깐 보였다가 글자가 나타나지 않게. 늦어도 0.5초면 보임
  css.onload = () => {
    void Promise.race([document.fonts.load('600 12px Pretendard'), new Promise((r) => setTimeout(r, 500))]).then(show, show);
  };
  css.onerror = show;
  document.head.appendChild(css);
  render(h(App, { store, media: config.media, actions }), root);

  // 단축키 (mvp-spec 1장: 패널을 클릭해 둔 상태에서만 — 웹뷰 안 키보드라 VS Code 전역 단축키 아님)
  //   Space = 선제공격 (야생이 튀어나온 순간) · 전투 중 맞받아치기 · 힘대결 연타 · Enter / Esc = 부탁 [도와준다] / [지나간다]
  //   전투 메뉴 숫자 · Z 는 BattleMenu 가 들음
  window.addEventListener('keydown', (e) => {
    if (store.get().screen !== 'game' || e.repeat) return;
    const overlay = store.get().overlay;
    if (overlay) {
      // 판 (지도 · 내 포켓몬 …) 의 Esc 는 판이 들음 · S21 프로필은 여기서
      if (overlay.kind === 'profile' && e.key === 'Escape') {
        e.preventDefault();
        actions.close();
      }
      return;
    }
    const stage = session.current?.runtime.stage;
    const phase = stage?.phase;
    const loc = session.current?.save.location;
    // 버튼에 포커스가 있으면 Enter · Space 는 그 버튼이 받음 (Tab 으로 [지나간다] 에 두고 Enter)
    const onButton = e.target instanceof HTMLButtonElement;
    if (e.code === 'Space' && !(onButton && phase !== 'appear' && phase !== 'battle')) {
      e.preventDefault(); // 화면이 스크롤되지 않게
      // 전투 중에는 방금 누른 메뉴 버튼에 포커스가 남아 있어도 Space 는 게임으로 (버튼이 또 눌리지 않게 포커스를 뺌)
      if (onButton) e.target.blur();
      actions.input({ kind: 'space' });
    } else if (phase === 'request' && ((e.key === 'Enter' && !onButton) || e.key === 'Escape')) {
      e.preventDefault();
      actions.input({ kind: 'request', help: e.key === 'Enter' });
    } else if (phase === 'result' && e.key === 'Enter' && !onButton) {
      // S12 계속 (S23 · S22 의 숫자 · Enter · Esc 는 ChoiceBox 가 들음)
      e.preventDefault();
      actions.input({ kind: 'result-continue' });
    } else if (stage?.phase === 'facility' && ((e.key === 'Enter' && !onButton) || e.key === 'Escape')) {
      // 병원 · 상점 앞: Enter = 들어가기 · Esc = 지나가기 / 병원 안: Esc = 나가기
      e.preventDefault();
      if (stage.inside) {
        if (e.key === 'Escape') actions.input({ kind: 'facility-leave' });
      } else actions.input({ kind: 'facility', enter: e.key === 'Enter' });
    } else if (e.key === 'Enter' && !onButton && (phase === 'defeat' || phase === 'clear' || phase === 'badge')) {
      // S17 다시 시작 · S24 다음 스테이지 · MVP 끝 카드 → 세계 지도
      e.preventDefault();
      if (phase === 'defeat') actions.input({ kind: 'defeat-continue' });
      else if (phase === 'badge') {
        actions.input({ kind: 'badge-continue' });
        actions.open({ kind: 'map' });
      } else if (loc?.screen === 'stage') actions.input({ kind: 'travel', to: STAGE_IDS[STAGE_IDS.indexOf(loc.stageId) + 1] ?? 'gym' });
    }
  });

  window.addEventListener('resize', () => {
    store.set({ layout: fitLayout(gameSize(config.size), window.innerHeight, config.minHeight), widthPx: window.innerWidth });
    sync(); // 너무 낮아졌으면 멈추고, 다시 키우면 이어 감
  });

  window.addEventListener('message', (event: MessageEvent<unknown>) => {
    if (!isHostToWebview(event.data)) return;
    session.handleMessage(event.data);
    sync();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      session.hide();
      sync();
    } else if (!store.get().layout.tooSmall) {
      // 접힌 채 다시 보이면 상태를 달라고 하지 않음 (받자마자 돌려주는 왕복) — 150px 이상이 되면 setCollapsed 가 달라고 함
      session.show();
    }
  });

  port.postMessage({ command: GAME_COMMAND, type: 'ready' });
}
