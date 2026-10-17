// 게임 모드 미리보기의 가짜 확장 쪽 — dev/game.html 에서 씀 (사진은 dev/game-shots.py)
//   ?screen=title|game  save=none|ok|broken|newer  busy=1  notice=글  size=nano|small|medium|large  theme=dark|light  click=new|continue|exit
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
        stages: {}, location: { screen: 'stage', stageId: 'forest-1' }, lastHospital: null, dex: { seen: [1], caught: [1] },
        pendingEncounter: null, settings: { notifications: true, autoBattle: false },
    };
    const info = {
        save: saveKind,
        busy: q.get('busy') === '1',
        summary: saveKind === 'ok' ? { playTimeMs: save.playTimeMs, money: save.money, badges: save.badges, lead: { form: 'bulbasaur', species: 1, level: 5 } } : null,
    };
    if (q.get('notice')) info.notice = q.get('notice');

    let epoch = 0;
    const toWebview = (m) => setTimeout(() => window.postMessage({ command: 'game', ...m }, '*'), 0);
    const start = (s) => toWebview({ type: 'start', epoch: ++epoch, state: { save: s, runtime: { rngState: 1, stepAccMs: 0 } } });

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

    const s = document.createElement('script');
    s.src = '../extension/media/game/game.js';
    document.body.appendChild(s);

    // 버튼 누르기 (사진용)
    const click = q.get('click');
    if (click) {
        const label = { new: '새로 하기', continue: '이어 하기', exit: '일반 모드' }[click];
        // game.js 를 받아 화면이 그려질 때까지 기다렸다가
        const tryClick = (left) => {
            const b = [...document.querySelectorAll('#pokemon-game button')].find((x) => x.textContent.includes(label));
            if (b && !document.getElementById('pokemon-game').hidden) b.click();
            else if (left > 0) setTimeout(() => tryClick(left - 1), 100);
        };
        tryClick(30);
    }
})();
