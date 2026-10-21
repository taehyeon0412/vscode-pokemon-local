/**
 * game.js — 게임 모드 웹뷰 쪽 시작점. boot.js 가 확장의 "load" 를 받고 불러온다.
 * 메시지 · 보임/안 보임 · 그리기 박자를 세션에 잇고, 화면(Preact)을 #pokemon-game 에 그린다.
 */
import { h, render } from 'preact';
import { TIMING } from '../core/balance';
import { canHeal, canOpenMenus, teamScale } from '../core/engine';
import { teamHealthy } from '../core/rules/bag';
import { STAGE_IDS } from '../core/save';
import { MENU_PANELS, menuShortcutOf } from '../features/menu/model';
import { levelUps } from '../features/result/model';
import { stageViewKey } from '../features/stage/model';
import { createStartSave } from '../features/starter/model';
import { GAME_COMMAND, isHostToWebview } from '../shared/messages';
import { shouldHoldBattle } from '../features/battle/fx/hold';
import { teamChoiceOn } from '../features/battle/team/TeamChoice';
import { spaceInput } from '../features/battle/fx/parry';
import { fieldTopPx, fitGameLayout, topGapPx } from '../ui/layout';
import { Store } from '../ui/store';
import { App, OVERLAY_INPUTS, overlayAllowed, type AppActions, type ViewState } from './app';
import { FrameLoop } from './frame-loop';
import './game.css';
// 개발 모드 (임시) 모양 — 지울 때 이 줄
import '../dev/dev.css';
import { getGameConfig, getGamePort } from './vscode-api';
import { WebviewSession } from './webview-session';
import { devApply } from '../dev/actions';
import { devClockFor, resetDevClock, setDevClock } from '../dev/clock';
import { setDevUlts } from '../dev/ult-pick';

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
    layout: fitGameLayout(window.innerHeight, config.minHeight),
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
      // 개발 모드 (임시) — 전투 느리게 · 멈춤 (웹뷰 시계) · 고른 필살기
      setDevClock(devClockFor(session.current, true));
      setDevUlts(session.current?.runtime.dev?.ults);
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
    // 개발 모드 (임시) — 계산을 안 맡는 동안 (접힘 · 안 보임) 은 시계를 그대로 (멈춤이면 다시 펴는 타이머까지 굳음)
    if (low || !session.running) setDevClock(1);
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
  // 개발 모드 (임시) — 게임 화면을 떠나면 (일반 모드 · 타이틀) 시계를 그대로 (일반 모드 포켓몬이 느려지거나 멈추지 않게)
  store.subscribe(() => {
    if (store.get().screen !== 'game') resetDevClock();
  });

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
    // 개발 모드 (임시, gdd 8장 · S02 ④) — 타이틀에서 들어가기 · 끝내기 (타이틀로) · 개발 메뉴 (한 줄 알림은 정보줄 알림 자리 toast)
    devStart: () => {
      setPending(true);
      session.devStart();
    },
    devEnd: () => {
      setPending(true);
      store.set({ overlay: null });
      setDevClock(1);
      session.devEnd();
    },
    dev: (action) => {
      let say = '';
      const stage0 = session.current?.runtime.stage;
      const changed = session.devChange((s) => {
        const r = devApply(s, action);
        say = r.say;
        return say ? { ...r.state, runtime: { ...r.state.runtime, toast: { text: `개발 — ${say}`, ms: TIMING.toastMs } } } : r.state;
      });
      if (!changed) return;
      setDevClock(devClockFor(session.current, true));
      // 장면을 바꾸면 판을 닫음 (바로 그 장면을 보게) — 안 바뀌었으면 (3마리가 안 됨 등) 판을 열어 둔 채 아래 줄 알림 (판만 닫히고 말이 없던 것 — UX 리뷰어 2026-10-21)
      const close = action.kind === 'scene' && session.current?.runtime.stage !== stage0;
      store.set({ state: session.current, ...(close ? { overlay: null } : {}) });
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
  //   + 정보줄 아래 띄움 --pg-gap · 상자 · 판이 시작하는 곳 --pg-field-top (지도 줄이 있으면 그 아래 — ui/layout). 바뀔 때만 씀
  let appliedFor = '';
  const applyUiScale = () => {
    const { uiScale, heightPx } = store.get().layout;
    const key = `${uiScale}:${heightPx}`;
    if (key === appliedFor) return;
    appliedFor = key;
    root.style.setProperty('--pg-ui', String(uiScale));
    root.style.setProperty('--pg-gap', `${topGapPx(heightPx)}px`);
    root.style.setProperty('--pg-field-top', `${fieldTopPx(heightPx)}px`);
  };
  applyUiScale();
  store.subscribe(applyUiScale);
  // 게임 설정 "동작 줄이기" (2026-10-20 태현 님 1안 — OS 설정 prefers-reduced-motion 은 안 봄) → pg-reduce-motion (game.css 가 꾸밈 움직임을 멈춤)
  store.subscribe(() => root.classList.toggle('pg-reduce-motion', store.get().state?.save.settings.reduceMotion === true));
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
  //   Space = 전투 중 막기 · 힘대결 연타 · 트레이너 만남 · 결과 넘기기 · Enter / Esc = 부탁 [도와준다] / [지나간다]
  //   전투 메뉴 숫자 · Z 는 BattleMenu 가 들음 · 3:3 의 1 · 2 · 3 · Z (필살기 · 예약) 와 트레이너 만남 3마리 고르기 1 ~ 5 는 아래 (orders #17 — 화면의 발밑 판 클릭도 같은 입력)
  window.addEventListener('keydown', (e) => {
    if (store.get().screen !== 'game' || e.repeat) return;
    const overlay = store.get().overlay;
    // 정보줄 메뉴 단축키 (2026-10-19 태현 님 "단축키 + 아이콘 + 설명") — F 빨리 걷기 · M 지도 · P 내 포켓몬 · B 가방 · S 설정.
    //   버튼이 보일 때 (걷는 중 · 대기실) 만 열고, 판이 떠 있으면 같은 키 = 닫기 · 다른 메뉴 키 = 그 판으로. 한글 입력 상태에서도 되게 자판 자리 (e.code)
    const shortcut = e.ctrlKey || e.metaKey || e.altKey ? null : menuShortcutOf(e.code);
    if (shortcut) {
      const cur = session.current;
      if (overlay) {
        if (overlay.kind === shortcut) actions.close();
        else if (shortcut !== 'fast' && MENU_PANELS.includes(overlay.kind)) actions.open({ kind: shortcut });
        else return;
        e.preventDefault();
        return;
      }
      // 전투 결과에서 P = 레벨업한 포켓몬의 스탯 찍기 (결과 상자의 레벨업 표시와 같음, 2026-10-20 태현 님)
      const rs = cur?.runtime.stage;
      if (shortcut === 'team' && cur && rs?.phase === 'result') {
        const ups = levelUps(rs.summary, cur.save);
        const t = ups.find((u) => u.points > 0) ?? ups[0];
        if (t) {
          e.preventDefault();
          actions.open({ kind: 'team', uid: t.uid });
          return;
        }
      }
      if (cur && canOpenMenus(cur)) {
        e.preventDefault();
        if (shortcut !== 'fast') actions.open({ kind: shortcut });
        else if (cur.save.location.screen === 'stage') actions.input({ kind: 'fast-walk', on: cur.save.settings.fastWalk !== true });
        return;
      }
    }
    // D = 개발 메뉴 (개발 모드 (임시) 가 켜져 있을 때 — 전투 중에도) · 열려 있으면 닫기
    if (e.code === 'KeyD' && !(e.ctrlKey || e.metaKey || e.altKey) && session.current?.runtime.dev) {
      e.preventDefault();
      if (overlay?.kind === 'dev') actions.close();
      else actions.open({ kind: 'dev' });
      return;
    }
    // A = 자동 전투 켜고 끄기 (2026-10-21 ideas #116 — 정보줄 · 전투의 자동 전투 칸과 같음, 판이 없을 때)
    if (!overlay && e.code === 'KeyA' && !(e.ctrlKey || e.metaKey || e.altKey)) {
      const cur = session.current;
      if (cur && (cur.save.location.screen === 'stage' || cur.save.location.screen === 'gym')) {
        e.preventDefault();
        actions.input({ kind: 'auto-battle', on: !cur.save.settings.autoBattle, say: true });
        return;
      }
    }
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
    if (e.code === 'Space' && !(onButton && phase !== 'appear' && phase !== 'battle' && phase !== 'team')) {
      e.preventDefault(); // 화면이 스크롤되지 않게
      // 전투 중에는 방금 누른 메뉴 버튼에 포커스가 남아 있어도 Space 는 게임으로 (버튼이 또 눌리지 않게 포커스를 뺌)
      if (onButton) e.target.blur();
      // 상대 공격 중이면 패링 (맞기까지 남은 ms — fx/parry, 2026-10-19), 아니면 그냥 Space
      actions.input(spaceInput(session.current, performance.now()));
    } else if (phase === 'team' && /^Digit[123]$/.test(e.code) && !(e.ctrlKey || e.metaKey || e.altKey)) {
      // 3:3 필살기 1 · 2 · 3 — 찼으면 씀 · 끼어듦 · 합류, 차는 중이면 예약 (다시 누르면 취소) — 발밑 판 클릭과 같음
      e.preventDefault();
      actions.input({ kind: 'team-battle', input: { kind: 'ult', slot: Number(e.code.slice(5)) - 1 } });
    } else if (phase === 'team' && e.code === 'KeyZ' && !(e.ctrlKey || e.metaKey || e.altKey)) {
      // Z = 먼저 찬 포켓몬 (1:1 습관 그대로, 예약은 없음)
      e.preventDefault();
      actions.input({ kind: 'team-battle', input: { kind: 'ult' } });
    } else if (phase === 'trainer' && stage.vsAt === undefined && ((!stage.pick && e.code === 'Digit1') || (stage.pick && e.key === 'Escape')) && session.current && teamChoiceOn(session.current) && !(e.ctrlKey || e.metaKey || e.altKey)) {
      // 트레이너 만남 1 = 1:1 (바로 VS — 주 버튼이 3:3 이어도 키로 고르게) · 3마리 고르기에서 Esc = 1:1 로 (디자인팀 UX 9차)
      e.preventDefault();
      actions.input({ kind: 'team-mode', on: false, go: true });
    } else if (phase === 'trainer' && !stage.pick && e.code === 'Digit3' && session.current && teamChoiceOn(session.current) && !(e.ctrlKey || e.metaKey || e.altKey)) {
      // 트레이너 만남 3 = 3:3 (3마리 고르기를 엶 — orders #17)
      e.preventDefault();
      actions.input({ kind: 'team-mode', on: true });
    } else if (((phase === 'trainer' && stage.pick) || (phase === 'lobby' && stage.picking)) && /^Digit[1-5]$/.test(e.code) && !(e.ctrlKey || e.metaKey || e.altKey)) {
      // 3마리 고르기 — 1 ~ 5 = 팀 순서대로 넣고 빼기 (Enter = 시작)
      const uid = session.current?.save.party[Number(e.code.slice(5)) - 1];
      if (uid) {
        e.preventDefault();
        actions.input({ kind: 'team-pick', uid });
      }
    } else if (phase === 'request' && ((e.key === 'Enter' && !onButton) || e.key === 'Escape')) {
      e.preventDefault();
      actions.input({ kind: 'request', help: e.key === 'Enter' });
    } else if ((phase === 'trainer' || phase === 'rival') && e.key === 'Enter' && !onButton) {
      // 트레이너 · 라이벌 만남 Enter = 바로 전투 (Space · 클릭과 같음, 2026-10-20 태현 님)
      e.preventDefault();
      actions.input({ kind: 'space' });
    } else if (phase === 'result' && e.key === 'Enter' && !onButton) {
      // S12 계속 (S23 · S22 의 숫자 · Enter · Esc 는 ChoiceBox 가 들음)
      e.preventDefault();
      actions.input({ kind: 'result-continue' });
    } else if (stage?.phase === 'facility' && ((e.key === 'Enter' && !onButton) || e.key === 'Escape')) {
      // 병원 · 상점 앞: Enter = 들어가기 (병원 앞은 회복하고 가기 — ideas #43, 주 버튼) · Esc = 지나가기 / 병원 안: Enter = 회복 (주 버튼 Enter 칸 — 아트 디렉터 4차, 다 나았으면 그대로) · Esc = 나가기
      e.preventDefault();
      const cur = session.current;
      if (stage.inside) {
        if (e.key === 'Escape') actions.input({ kind: 'facility-leave' });
        else if (cur && canHeal(cur) && !teamHealthy(cur.save)) actions.input({ kind: 'heal' });
      } else if (e.key === 'Enter' && stage.kind === 'hospital' && cur && !teamHealthy(cur.save)) actions.input({ kind: 'facility-heal' });
      else actions.input({ kind: 'facility', enter: e.key === 'Enter' });
    } else if (phase === 'lobby' && stage.picking && e.key === 'Escape') {
      // S16 3마리 고르기 판 Esc = 뒤로 (대기실 상자)
      e.preventDefault();
      actions.input({ kind: 'lobby-back' });
    } else if (phase === 'lobby' && e.key === 'Enter' && !onButton) {
      // S16 대기실 Enter = 도전 (주 버튼 — 꾹 누름 반복은 위에서 거름) · 3:3 이면 처음 = 3마리 고르기 판 · 판에서 = 시작
      e.preventDefault();
      actions.input({ kind: 'challenge' });
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

  // 3:3 배율 · 잠금 (teamScale) 이 바뀔 때만 패널 크기를 엔진에 알림 — 크기가 바뀔 때마다 보내면 상태가 자꾸 바뀜 · 판이 떠 있어도 (판 입력 거름 밖)
  const reportView = () => {
    const cur = session.current;
    if (!cur || store.get().layout.tooSmall) return;
    const view = { w: window.innerWidth, h: window.innerHeight };
    if ((!cur.runtime.view || teamScale(cur.runtime.view) !== teamScale(view)) && session.input({ kind: 'view', ...view })) store.set({ state: session.current });
  };

  window.addEventListener('resize', () => {
    store.set({ layout: fitGameLayout(window.innerHeight, config.minHeight), widthPx: window.innerWidth });
    sync(); // 너무 낮아졌으면 멈추고, 다시 키우면 이어 감
    reportView();
  });

  window.addEventListener('message', (event: MessageEvent<unknown>) => {
    if (!isHostToWebview(event.data)) return;
    session.handleMessage(event.data);
    sync();
    reportView();
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
