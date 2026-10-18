// 게임 모드 미리보기의 가짜 확장 쪽 — dev/game.html 에서 씀 (사진은 dev/game-shots.py)
//   ?screen=title|game  save=none|ok|broken|newer  busy=1  notice=글  size=nano|small|medium|large  theme=dark|light  click=new|continue|exit
//   progress=0~1 (숲 1-1 진행, 스테이지 시드 42 — 그 자리 바로 앞에서 시작해 흔적 · 조우 · 부탁을 찍음)
//   battle=choose|skills|counter|clash|ult-cut|ult-beam|attack|pick|over|auto  dur=연출 ms (전투 장면을 바로 — 아래 battleKind)  animAt=초 (CSS 움직임을 그 시점에 멈춤)
// 확장이 하는 일 중 화면에 보이는 것만 흉내: ready → title · start, title-new · title-continue → start, exit → stop
(function () {
    const q = new URLSearchParams(location.search);
    const screen = q.get('screen') || 'title';
    const saveKind = q.get('save') || 'ok';
    const size = q.get('size') || 'nano';
    const theme = q.get('theme') || 'dark';

    // VS Code 테마 색 (웹뷰가 받는 변수 중 게임 화면이 쓰는 것)
    const THEMES = {
        dark: {
            '--vscode-editor-background': '#1e1e1e', '--vscode-foreground': '#cccccc', '--vscode-font-family': '-apple-system, "Segoe UI", sans-serif',
            '--vscode-button-foreground': '#ffffff', '--vscode-button-background': '#0e639c', '--vscode-button-hoverBackground': '#1177bb',
            '--vscode-button-secondaryForeground': '#ffffff', '--vscode-button-secondaryBackground': '#3a3d41', '--vscode-button-secondaryHoverBackground': '#45494e',
            '--vscode-editorWarning-foreground': '#cca700', '--vscode-focusBorder': '#007fd4', '--vscode-editorWidget-border': '#454545',
        },
        light: {
            '--vscode-editor-background': '#ffffff', '--vscode-foreground': '#616161', '--vscode-font-family': '-apple-system, "Segoe UI", sans-serif',
            '--vscode-button-foreground': '#ffffff', '--vscode-button-background': '#007acc', '--vscode-button-hoverBackground': '#0062a3',
            '--vscode-button-secondaryForeground': '#ffffff', '--vscode-button-secondaryBackground': '#5f6a79', '--vscode-button-secondaryHoverBackground': '#4c5561',
            '--vscode-editorWarning-foreground': '#bf8803', '--vscode-focusBorder': '#0090f1', '--vscode-editorWidget-border': '#c8c8c8',
        },
    };
    for (const [k, v] of Object.entries(THEMES[theme] || THEMES.dark)) document.documentElement.style.setProperty(k, v);

    const save = {
        version: 1, createdAt: 0, updatedAt: 0, playTimeMs: 754000, player: null,
        monsters: { m1: { uid: 'm1', species: 1, form: 'bulbasaur', level: 5, exp: 125, ivs: { hp: 1, attack: 1, defense: 1, speed: 1, ultimate: 1 },
            points: { hp: 0, attack: 0, defense: 0, speed: 0, ultimate: 0 }, unspentPoints: 0, moves: [{ moveId: 33, pp: 35 }], hp: 20, status: null, shiny: false, caughtAt: 'starter' } },
        party: ['m1'], box: [], nextMonsterUid: 2, bag: { 'poke-ball': 3 }, money: 1000, badges: [],
        stages: { 'forest-1': { seed: 42, progress: Number(q.get('progress') || (q.get('battle') ? 0.0483 : 0)), cleared: false, defeatedTrainers: [], facilities: [] } },
        location: { screen: 'stage', stageId: 'forest-1' }, lastHospital: null, dex: { seen: [1], caught: [1] },
        pendingEncounter: null, settings: { notifications: true, autoBattle: false },
    };
    const info = {
        save: saveKind,
        busy: q.get('busy') === '1',
        summary: saveKind === 'ok' ? { playTimeMs: save.playTimeMs, money: save.money, badges: save.badges, lead: { form: 'bulbasaur', species: 1, level: 5 } } : null,
    };
    if (q.get('notice')) info.notice = q.get('notice');

    // 전투 장면 (S09 · S10) — battle=choose|skills|counter|clash|ult-cut|ult-beam|attack|pick|over|auto, dur=연출 ms (사진 찍는 순간에 보이게 늘림)
    const battleKind = q.get('battle');
    let runtime = { rngState: 1, stepAccMs: 0 };
    if (battleKind) {
        const caterpie = { ...save.monsters.m1, uid: 'm2', species: 10, form: 'caterpie', level: 4, moves: [{ moveId: 33, pp: 35 }], hp: 16, caughtAt: 'forest-1' };
        save.monsters.m1 = { ...save.monsters.m1, moves: [{ moveId: 33, pp: 35 }, { moveId: 22, pp: 25 }, { moveId: 75, pp: 25 }] };
        save.monsters.m2 = caterpie;
        save.party = ['m1', 'm2'];
        save.nextMonsterUid = 3;
        save.settings.autoBattle = battleKind === 'auto';
        const wild = { ...save.monsters.m1, uid: 'wild', species: 4, form: 'charmander', level: 5, moves: [{ moveId: 52, pp: 25 }], hp: 20, caughtAt: 'forest-1' };
        save.pendingEncounter = { kind: 'wild', monster: wild, start: 'normal' };
        save.dex.seen = [1, 4, 10];
        const fighter = (m, types, stats, hp, extra) => ({
            uid: m.uid, species: m.species, form: m.form, level: m.level, shiny: false, types, stats, maxHp: stats.hp, hp,
            moves: m.moves.map((x) => ({ ...x })), status: null, gauge: 0, ult: 0, guard: 1, guardStreak: 0, streakMove: null, streakCount: 0, ...extra,
        });
        const me = fighter(save.monsters.m1, ['grass', 'poison'], { hp: 21, attack: 11, defense: 11, speed: 10, ultimate: 12 }, 15, { gauge: 0.7, ult: 0.45 });
        const foe = fighter(wild, ['fire'], { hp: 20, attack: 12, defense: 10, speed: 12, ultimate: 11 }, 13, { gauge: 0.6, ult: 0.3 });
        const dur = Number(q.get('dur') || 20000);
        const b = {
            kind: 'wild', me, foe, bench: {}, bagUsed: {}, phase: 'run', anim: null, clash: null, result: null, overMs: 0, fleeTries: 0,
            msg: '가랏, 이상해씨!', popups: [], popupSeq: 0, t: 5000, ultAt: { me: null, foe: null }, start: 'normal',
        };
        if (battleKind === 'choose' || battleKind === 'skills') Object.assign(b, { phase: 'choose', me: { ...me, gauge: 1 }, msg: '이상해씨는 무엇을 할까?' });
        if (battleKind === 'counter') Object.assign(b, { phase: 'anim', anim: { side: 'foe', action: { kind: 'move', moveId: 52 }, ms: 0, dur, counter: true }, msg: '야생 파이리의 불꽃세례!' });
        if (battleKind === 'clash') Object.assign(b, { phase: 'clash', clash: { kind: 'move', me: 75, foe: 52, base: 0.42, taps: 9, ms: 0, winner: null }, msg: '맞받아쳤다! 힘대결!' });
        if (battleKind === 'ult-cut' || battleKind === 'ult-beam') Object.assign(b, { phase: 'anim', me: { ...me, ult: 0 }, anim: { side: 'me', action: { kind: 'ult' }, ms: 0, dur, counter: false }, msg: '이상해씨의 필살기!', ultAt: { me: 5000, foe: null } });
        if (battleKind === 'attack') Object.assign(b, { phase: 'anim', anim: { side: 'me', action: { kind: 'attack' }, ms: 0, dur, counter: false }, msg: '이상해씨의 공격!' });
        if (battleKind === 'pick') Object.assign(b, { phase: 'pick', me: { ...me, hp: 0, gauge: 0 }, bench: { m1: { hp: 0, moves: me.moves, status: null } }, msg: '이상해씨가 쓰러졌다! 다음 포켓몬을 골라요 (숫자 키)' });
        if (battleKind === 'over') Object.assign(b, { phase: 'over', foe: { ...foe, hp: 0 }, result: 'win', msg: '야생 파이리가 쓰러졌다!' });
        runtime = { rngState: 1, stepAccMs: 0, speed: 1, stage: { phase: 'battle', battle: b }, stageId: 'forest-1', toast: null };
    }

    let epoch = 0;
    const toWebview = (m) => setTimeout(() => window.postMessage({ command: 'game', ...m }, '*'), 0);
    const start = (s) => toWebview({ type: 'start', epoch: ++epoch, state: { save: s, runtime } });

    window.pokemonGameLog = [];
    window.pokemonVscodeApi = {
        postMessage(m) {
            window.pokemonGameLog.push(m);
            if (m.command !== 'game') return;
            if (m.type === 'ready') return screen === 'game' ? start(save) : toWebview({ type: 'title', info });
            if (m.type === 'title-new') return start(m.save);
            if (m.type === 'title-continue') return start(save);
            if (m.type === 'exit') return toWebview({ type: 'stop' });
        },
    };
    window.pokemonGameConfig = { media: '../extension/media', size, script: '../extension/media/game/game.js' };

    // 연출 한 장면 멈춰 찍기 (머리 없는 브라우저는 CSS 움직임이 거의 안 흘러서) — animAt=초: 모든 움직임을 그 시점에 멈춤
    if (q.get('animAt')) {
        const st = document.createElement('style');
        st.textContent = '#pokemon-game * { animation-delay: -' + Number(q.get('animAt')) + 's !important; animation-play-state: paused !important; }';
        document.head.appendChild(st);
    }

    // 머리 없는 브라우저 사진에서는 requestAnimationFrame 이 거의 안 돌아서 (가상 시간) 타이머로 대신 — dev/game-shots.py 가 shim=1
    if (q.get('shim') === '1') {
        window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
        window.cancelAnimationFrame = (id) => clearTimeout(id);
    }

    const s = document.createElement('script');
    s.src = '../extension/media/game/game.js';
    document.body.appendChild(s);

    // 버튼 누르기 (사진용)
    const click = q.get('click');
    if (click) {
        const label = { new: '새로 하기', continue: '이어 하기', exit: '일반 모드', skills: '3 스킬' }[click];
        const alt = { skills: '3✨' }[click];
        // game.js 를 받아 화면이 그려질 때까지 기다렸다가
        const tryClick = (left) => {
            const b = [...document.querySelectorAll('#pokemon-game button')].find((x) => x.textContent.includes(label) || (alt && x.textContent.includes(alt)));
            if (b && !document.getElementById('pokemon-game').hidden) b.click();
            else if (left > 0) setTimeout(() => tryClick(left - 1), 100);
        };
        tryClick(30);
    }
})();
