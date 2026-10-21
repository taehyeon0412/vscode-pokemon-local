// 게임 모드 미리보기의 가짜 확장 쪽 — dev/game.html 에서 씀 (사진은 dev/game-shots.py)
//   ?screen=title|game  save=none|ok|broken|newer  busy=1  notice=글  size=nano|small|medium|large  theme=dark|light  click=new|continue|exit
//   progress=0~1 (숲 1-1 진행, 스테이지 시드 42 — 그 자리 바로 앞에서 시작해 흔적 · 조우 · 부탁을 찍음)
//   place=facility|hospital|shop|shop-front|trainer|trainer-battle|defeat|clear|lobby|gym-battle|badge (단계 8 · 9)
//   balls=<몬스터-슈퍼-하이퍼 개수, 예 3-0-2>  pts=<선두 남은 포인트>
//   scene=result 와 같이: ups=2 (둘이 레벨업) · ups=0 (레벨업 없음) · spent=1 (스탯을 찍어 본 세이브) · click=lvup|lvup2 (얼굴 카드 누르기)
//   st=3 (숲 1-3 · 길 끝 체육관) · gms=<ms> (체육관 들어가기 장면)
//   motion=reduce (게임 설정 동작 줄이기 켬)
//   ms=<만난 뒤 ms> — place=trainer · rival 의 시작 시각 (VS 컷인 사진: trainer 3000 · rival 3800)
//   place=rival|rival-talk|rival-battle|rival-over|rival-result|rival-lose  rival=<주인공 id, 기본 may>  record=<이김-짐, 기본 2-1> (라이벌 gdd 4.12)  click=map|team|bag|settings|profile|item
//   style=<CSS> (시안 비교 — 임시 CSS 를 얹음)
//   scene=result|learn|evolve|evolve-pick  battle=choose|skills|items|catch|last|counter|clash|ult-cut|ult-beam|attack|pick|over|auto  dur=연출 ms (전투 장면을 바로 — 아래 battleKind)  animAt=초 (CSS 움직임을 그 시점에 멈춤)
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
    // style=<CSS> — 시안 비교용 임시 CSS (body 끝 <style> 이라 game.css 보다 뒤 — 같은 우선순위면 이김). 사진은 myshots 의 style=@파일
    const extraCss = q.get('style');
    if (extraCss) {
        const add = () => {
            const el = document.createElement('style');
            el.textContent = extraCss;
            document.body.appendChild(el);
        };
        if (document.body) add();
        else document.addEventListener('DOMContentLoaded', add);
    }
    // VS Code 처럼 body 에 테마 class (밝은 숲 그림 고르기 — StageScreen · TitleScreen 의 themeKind)
    document.body.classList.add(theme === 'light' ? 'vscode-light' : 'vscode-dark');

    const save = {
        version: 3, createdAt: 0, updatedAt: 0, playTimeMs: 754000, player: null,
        monsters: { m1: { uid: 'm1', species: 1, form: 'bulbasaur', level: 5, exp: 125, ivs: { hp: 1, attack: 1, defense: 1, speed: 1, ultimate: 1 },
            points: { hp: 0, attack: 0, defense: 0, speed: 0, ultimate: 0 }, unspentPoints: 0, moves: [{ moveId: 33, pp: 35 }], hp: 20, status: null, shiny: false, caughtAt: 'starter' } },
        party: ['m1'], box: [], nextMonsterUid: 2, bag: { 'poke-ball': 3 }, money: 1000, badges: [],
        stages: { 'forest-1': { seed: 42, progress: Number(q.get('progress') || (q.get('battle') ? 0.0483 : 0)), cleared: false, defeatedTrainers: [], facilities: [], run: { startMs: 0, caught: 0, trainers: 0, seen: [], reach: 0, retries: 0 } } },
        location: { screen: 'stage', stageId: 'forest-1' }, lastHospital: null, dex: { seen: [1], caught: [1] },
        pendingEncounter: null, pendingChoices: [], settings: { notifications: true, autoBattle: false },
    };
    // look=<캐릭터 id> (S03, 2026-10-19) — 그 캐릭터로 숲 · 전투
    if (q.get('look')) save.player = { gender: q.get('gender') || 'female', look: q.get('look') };
    // fast=1 — 빨리 걷기 켬 (2026-10-19)
    if (q.get('fast') === '1') save.settings = { ...save.settings, fastWalk: true };
    // motion=reduce — 게임 설정 "동작 줄이기" 켬 (ux-rules U1 점검, 2026-10-21)
    if (q.get('motion') === 'reduce') save.settings = { ...save.settings, reduceMotion: true };
    // balls=3-2-1 — 몬스터볼 · 슈퍼볼 · 하이퍼볼 개수 (정보줄 볼 칸, 2026-10-20) · pts=4 — 선두 남은 포인트 (정보줄 "포켓몬 +4")
    if (q.get('balls')) { const [p, g, u] = q.get('balls').split('-').map(Number); save.bag = { 'poke-ball': p || 0, ...(g ? { 'great-ball': g } : {}), ...(u ? { 'ultra-ball': u } : {}) }; }
    if (q.get('pts')) save.monsters.m1 = { ...save.monsters.m1, unspentPoints: Number(q.get('pts')) };
    // team=5 — 다섯 마리 팀 (선두 리자드 Lv19 · 이상해풀 · 어니부기 · 피죤 · 버터플, 보관함 피카츄 — S18 팀 칸 이름 잘림 확인, 2026-10-20)
    if (q.get('team') === '5') {
        const mk = (uid, species, form, level, unspent = 0) => ({ ...save.monsters.m1, uid, species, form, level, unspentPoints: unspent, hp: 30, caughtAt: 'forest-1' });
        save.monsters = { m1: mk('m1', 5, 'charmeleon', 19, 2), m2: mk('m2', 2, 'ivysaur', 18), m3: mk('m3', 8, 'wartortle', 17), m4: mk('m4', 17, 'pidgeotto', 16), m5: mk('m5', 12, 'butterfree', 15), m6: mk('m6', 25, 'pikachu', 14) };
        save.party = ['m1', 'm2', 'm3', 'm4', 'm5'];
        save.box = ['m6'];
        save.nextMonsterUid = 7;
    }
    // spent=1 — 스탯을 이미 찍어 본 세이브 (말풍선은 이제 레벨업마다 나와서 차이 없음 — 2026-10-20)
    if (q.get('spent') === '1') save.monsters.m1 = { ...save.monsters.m1, points: { ...save.monsters.m1.points, attack: 10 } };
    const info = {
        save: saveKind,
        busy: q.get('busy') === '1',
        summary: saveKind === 'ok' ? { playTimeMs: save.playTimeMs, money: save.money, badges: save.badges, lead: { form: 'bulbasaur', species: 1, level: 5 }, where: '1-1 · 37%' } : null,
    };
    if (q.get('notice')) info.notice = q.get('notice');

    // 전투 장면 (S09 · S10) — battle=choose|skills|counter|clash|ult-cut|ult-beam|attack|pick|over|auto, dur=연출 ms (사진 찍는 순간에 보이게 늘림)
    const battleKind = q.get('battle');
    let runtime = { rngState: 1, stepAccMs: 0 };
    // st=3 — 숲 1-3 (길 끝 체육관, 2026-10-20 태현 님 A안) · progress= 는 1-3 진행 (0.9 쯤이면 체육관이 다가옴) · gms=<ms> 이면 체육관 들어가기 장면 (진행 1)
    if (q.get('st') === '3') {
        save.stages = { 'forest-3': { ...save.stages['forest-1'] } };
        save.location = { screen: 'stage', stageId: 'forest-3' };
        if (q.get('gms') !== null) {
            save.stages['forest-3'].progress = 1;
            runtime = { rngState: 1, stepAccMs: 0, speed: 1, stage: { phase: 'gym-enter', ms: Number(q.get('gms')) }, stageId: 'forest-3', toast: null };
        }
    }
    if (battleKind) {
        const caterpie = { ...save.monsters.m1, uid: 'm2', species: 10, form: 'caterpie', level: 4, moves: [{ moveId: 33, pp: 35 }], hp: 16, caughtAt: 'forest-1' };
        save.monsters.m1 = { ...save.monsters.m1, moves: [{ moveId: 33, pp: 35 }, { moveId: 22, pp: 25 }, { moveId: 75, pp: 25 }] };
        // me=<모습>:<도감 번호> — 내 포켓몬을 바꿈 (3:3 시안용 실제 필살기 찍기: me=venusaur:3&battle=ult&side=me, 2026-10-21 디자인팀)
        if (q.get('me')) { const [meForm, meSp] = q.get('me').split(':'); save.monsters.m1 = { ...save.monsters.m1, form: meForm, species: Number(meSp) || 1, level: 36 }; }
        save.monsters.m2 = caterpie;
        save.party = ['m1', 'm2'];
        save.nextMonsterUid = 3;
        save.settings.autoBattle = battleKind === 'auto';
        // foe=<모습>:<도감 번호> — 상대 포켓몬을 바꿈 (연출 시험: foe=pikachu:25&battle=move&side=foe&mv=87)
        const [foeForm, foeSp] = (q.get('foe') || 'charmander:4').split(':');
        const wild = { ...save.monsters.m1, uid: 'wild', species: Number(foeSp) || 4, form: foeForm, level: 5, moves: [{ moveId: 52, pp: 25 }], hp: 20, caughtAt: 'forest-1' };
        save.pendingEncounter = { kind: 'wild', monster: wild, start: 'normal' };
        save.dex.seen = [1, 4, 10];
        const fighter = (m, types, stats, hp, extra) => ({
            uid: m.uid, species: m.species, form: m.form, level: m.level, shiny: false, types, stats, maxHp: stats.hp, hp,
            moves: m.moves.map((x) => ({ ...x })), status: null, gauge: 0, ult: 0, guard: 1, guardStreak: 0, streakMove: null, streakCount: 0, ...extra,
        });
        const me = fighter(save.monsters.m1, ['grass', 'poison'], { hp: 21, attack: 11, defense: 11, speed: 10, ultimate: 12 }, 15, { gauge: 0.7, ult: q.get('myult') !== null ? Number(q.get('myult')) : 0.45 }); // myult=1 — 필살기 꽉 참 (Z 반짝 사진)
        const foe = fighter(wild, ['fire'], { hp: 20, attack: 12, defense: 10, speed: 12, ultimate: 11 }, 13, { gauge: 0.6, ult: q.get('foeult') !== null ? Number(q.get('foeult')) : 0.3 }); // foeult=0.85 · 1 — 상대 필살기 예고 "곧" · "!" 사진 (기획 R4)
        const dur = Number(q.get('dur') || 20000);
        const b = {
            kind: 'wild', me, foe, foeQueue: [], foeDown: [], foeUltWait: null, foeName: null, sendMs: 0, bench: {}, bagUsed: {}, phase: 'run', anim: null, clash: null, result: null, overMs: 0, fleeTries: 0,
            msg: '가랏, 이상해씨!', popups: [], popupSeq: 0, t: 5000, catch: null, lastMs: 0, fought: ['m1'], ultAt: { me: null, foe: null }, start: 'normal',
        };
        if (battleKind === 'choose' || battleKind === 'skills') Object.assign(b, { phase: 'choose', me: { ...me, gauge: 1 }, msg: '이상해씨는 무엇을 할까?' });
        if (battleKind === 'counter') Object.assign(b, { phase: 'anim', anim: { side: 'foe', action: { kind: 'move', moveId: 52 }, ms: 0, dur, counter: true }, msg: '야생 파이리의 불꽃세례!' });
        // ckind=ult — 필살기 힘대결 (연출 시험)
        if (battleKind === 'clash') {
            const ult = q.get('ckind') === 'ult';
            Object.assign(b, { phase: 'clash', clash: { kind: ult ? 'ult' : 'move', me: ult ? null : 75, foe: ult ? null : 52, base: 0.42, taps: 9, ms: 0, winner: null }, msg: ult ? '필살기 힘대결!' : '맞받아쳤다! 힘대결!' });
        }
        // side=foe — 상대가 쓰는 필살기 (연출 시험, fx=1 과 같이)
        if (battleKind === 'ult-cut' || battleKind === 'ult-beam') {
            const side = q.get('side') || 'me';
            Object.assign(b, { phase: 'anim', [side]: { ...(side === 'me' ? me : foe), ult: 0 }, anim: { side, action: { kind: 'ult' }, ms: 0, dur, counter: false }, msg: side === 'me' ? '이상해씨의 필살기!' : '야생 파이리의 필살기!', ultAt: { me: side === 'me' ? 5000 : null, foe: side === 'foe' ? 5000 : null } });
        }
        // battle=move&side=me|foe&mv=<기술 id> — 그 기술을 쓰는 중 (연출 시험, fx=1 과 같이) · miss=1 이면 빗나가는 기술 (피함 연출) · parry=good|perfect 면 막은 기술 (되튀기)
        // perfects=1 — 이번 완벽 패링이 이 전투 두 번째 (짧은 쳐올리기 · 글씨 — ideas #127 · UX U1 시험)
        if (q.get('perfects')) b.perfects = Number(q.get('perfects'));
        if (battleKind === 'move') { const side = q.get('side') || 'me'; Object.assign(b, { phase: 'anim', anim: { side, action: { kind: 'move', moveId: Number(q.get('mv') || 75) }, ms: 0, dur, counter: false, miss: q.get('miss') === '1', ...(q.get('parry') ? { parry: q.get('parry') } : {}) }, msg: side === 'me' ? '이상해씨의 기술!' : '야생 파이리의 기술!' }); }
        if (battleKind === 'attack') Object.assign(b, { phase: 'anim', anim: { side: 'me', action: { kind: 'attack' }, ms: 0, dur, counter: false }, msg: '이상해씨의 공격!' });
        // battle=riposte — 반격기 (완벽 패링 두 번 뒤, 필살기 짧게) · battle=riposte-chance — 반격 기회 (상대 둘레 두 번째 원, 2026-10-20)
        if (battleKind === 'riposte') Object.assign(b, { phase: 'anim', anim: { side: 'me', action: { kind: 'riposte' }, ms: 0, dur, counter: false }, msg: '이상해씨의 반격!' });
        if (battleKind === 'riposte-chance') Object.assign(b, { phase: 'riposte', riposte: { ms: 0, dur: 1200 }, msg: '완벽 패링!' });
        if (battleKind === 'pick') Object.assign(b, { phase: 'pick', me: { ...me, hp: 0, gauge: 0 }, bench: { m1: { hp: 0, moves: me.moves, status: null } }, msg: '이상해씨가 쓰러졌다! 다음 포켓몬을 골라요' });
        if (battleKind === 'over') Object.assign(b, { phase: 'over', foe: { ...foe, hp: 0 }, result: 'win', msg: '야생 파이리가 쓰러졌다!' });
        if (battleKind === 'items') { save.bag = { 'poke-ball': 3, 'great-ball': 1, potion: 2 }; Object.assign(b, { phase: 'choose', me: { ...me, gauge: 1 }, msg: '이상해씨는 무엇을 할까?' }); }
        // battle=catch — 잡기 (2026-10-20 다시 기획): cms=잡기 시작 ms · throw=던진 ms (없으면 원이 줄어드는 중) · caught=1|0 · shakes=1~3 · tries=이미 던진 볼 수 (창의 3/3 · 2/3 · 1/3)
        if (battleKind === 'catch') {
            const thrown = q.get('throw');
            const at = thrown === null ? null : Number(thrown);
            // last=1 — 이긴 뒤 마지막 기회 (쓰러진 상대, HP 0)
            const last = q.get('last') === '1';
            Object.assign(b, { phase: 'catch', bagUsed: { 'poke-ball': Number(q.get('tries') || 0) + 1 }, ...(last ? { foe: { ...b.foe, hp: 0 } } : {}), catch: { ball: 'poke-ball', ms: Number(q.get('cms') || 0), pressMs: at, throwMs: at, shakes: at === null ? 0 : Number(q.get('shakes') || 3), last, caught: at === null ? null : q.get('caught') !== '0', startT: 5000 }, msg: at === null ? '몬스터볼을 꺼냈다!' : '가랏, 몬스터볼!' });
        }
        if (battleKind === 'last') { save.bag = { 'poke-ball': 3, 'great-ball': 1 }; Object.assign(b, { phase: 'last', foe: { ...foe, hp: 0 }, msg: '야생 파이리가 쓰러졌다!' }); }
        runtime = { rngState: 1, stepAccMs: 0, speed: 1, stage: { phase: 'battle', battle: b }, stageId: 'forest-1', toast: null };
    }

    // 전투 뒤 장면 (단계 7) — scene=result|learn|evolve|evolve-pick
    const scene = q.get('scene');
    if (scene) {
        save.monsters.m1 = { ...save.monsters.m1, level: scene === 'result' ? 6 : 16, moves: [{ moveId: 33, pp: 30 }, { moveId: 22, pp: 20 }, { moveId: 52, pp: 25 }, { moveId: 84, pp: 30 }] };
        let stage = { phase: 'choice', ms: scene === 'evolve-pick' ? 4000 : scene === 'evolve-wait' ? -1 : 0 };
        if (scene === 'result') stage = { phase: 'result', ms: 0, summary: { title: '야생 피죤을 쓰러뜨렸다!', exp: [{ uid: 'm1', name: '이상해씨', gain: 28, from: 5, to: 6 }], money: 20, item: '몬스터볼', caught: null, learned: [{ name: '이상해씨', move: '덩굴채찍' }], choices: 1 } };
        // ups=2 — 둘이 같이 레벨업 (팀 경험치) · ups=0 — 레벨업 없음 (경험치만)
        if (scene === 'result' && q.get('ups') === '2') {
            save.monsters.m2 = { ...save.monsters.m1, uid: 'm2', species: 4, form: 'charmander', level: 7, unspentPoints: 2, caughtAt: 'forest-1' };
            save.party = ['m1', 'm2'];
            stage.summary.exp.push({ uid: 'm2', name: '파이리', gain: 14, from: 6, to: 7 });
        }
        // got=1 — 야생 파이리를 잡은 결과 (new=0 이면 도감에 이미 있음 · 소개 카드 1.5초 뒤 결과 상자) · rms=결과 지난 ms (rms=1600 = 소개 카드 지나 결과 상자)
        if (scene === 'result' && q.get('got') === '1') {
            save.monsters.m3 = { ...save.monsters.m1, uid: 'm3', species: 4, form: 'charmander', level: 5, unspentPoints: 0, caughtAt: 'forest-1' };
            save.party = [...save.party, 'm3'];
            stage.summary = { ...stage.summary, title: '야생 파이리를 잡았다!', caught: { name: '파이리', toBox: false, uid: 'm3', isNew: q.get('new') !== '0' } };
        }
        if (scene === 'result' && q.get('rms')) stage.ms = Number(q.get('rms'));
        if (scene === 'result' && q.get('ups') === '0') stage.summary = { ...stage.summary, exp: [{ uid: 'm1', name: '이상해씨', gain: 28, from: 5, to: 5 }], learned: [] };
        if (scene === 'learn') save.pendingChoices = [{ kind: 'learn', uid: 'm1', moveId: 75 }];
        if (scene === 'evolve' || scene === 'evolve-pick' || scene === 'evolve-wait') save.pendingChoices = [{ kind: 'evolve', uid: 'm1', to: 2, newMoves: [75, 76], level: 16, item: null }];
        runtime = { rngState: 1, stepAccMs: 0, speed: 1, stage, stageId: 'forest-1', toast: null };
    }

    // 단계 8 · 9 장면 — place=facility|hospital|shop|trainer|trainer-battle|defeat|clear|lobby|gym-battle|badge
    //   시드 42 숲 1-1: 병원 0.4724 · 상점 0.6132 · 트레이너 t0 0.30551 · t1 0.7019 (자리는 스테이지마다 정해짐) · 부탁 0.88669
    const place = q.get('place');
    if (place) {
        const st = save.stages['forest-1'];
        st.facilities = [{ kind: 'hospital', at: 0.4724 }, { kind: 'shop', at: 0.6132 }];
        st.run = { startMs: 0, caught: 2, trainers: 1, seen: [10, 13, 43], reach: 0, retries: 0 };
        const caterpie = { ...save.monsters.m1, uid: 'm2', species: 10, form: 'caterpie', level: 4, moves: [{ moveId: 33, pp: 35 }], hp: 16, unspentPoints: 2, caughtAt: 'forest-1' };
        const weedle = { ...save.monsters.m1, uid: 'm3', species: 13, form: 'weedle', level: 3, moves: [{ moveId: 40, pp: 35 }], hp: 14, caughtAt: 'forest-1' };
        save.monsters.m1 = { ...save.monsters.m1, moves: [{ moveId: 33, pp: 35 }, { moveId: 22, pp: 25 }] };
        Object.assign(save.monsters, { m2: caterpie, m3: weedle });
        save.party = ['m1', 'm2'];
        save.box = ['m3'];
        // party3=1 — 셋 (3:3 고르기 · 3마리 고르기 사진)
        if (q.get('party3') === '1') {
            save.party = ['m1', 'm2', 'm3'];
            save.box = [];
        }
        // party5=1 — 다섯 (3마리 고르기 판 2줄 · 상대 셋 사진 — 5글자 이름 버터플 · 피죤투 포함)
        if (q.get('party5') === '1') {
            const mk5 = (uid, species, form, level) => ({ ...save.monsters.m1, uid, species, form, level, unspentPoints: 0, hp: 30, caughtAt: 'forest-1' });
            Object.assign(save.monsters, { m1: mk5('m1', 5, 'charmeleon', 19), m2: mk5('m2', 2, 'ivysaur', 18), m3: mk5('m3', 8, 'wartortle', 17), m4: mk5('m4', 17, 'pidgeotto', 16), m5: mk5('m5', 12, 'butterfree', 15) });
            save.party = ['m1', 'm2', 'm3', 'm4', 'm5'];
            save.box = [];
        }
        save.nextMonsterUid = 4;
        save.bag = { 'poke-ball': 3, potion: 2, 'leaf-stone': 1 };
        const fighter = (m, types, stats, hp, extra) => ({
            uid: m.uid, species: m.species, form: m.form, level: m.level, shiny: false, types, stats, maxHp: stats.hp, hp, star: 3,
            moves: m.moves.map((x) => ({ ...x })), status: null, gauge: 0, ult: 0, guard: 1, guardStreak: 0, streakMove: null, streakCount: 0, ...extra,
        });
        const foeMon = (uid, species, form, level) => ({ ...save.monsters.m1, uid, species, form, level, moves: [{ moveId: 33, pp: 35 }], hp: 25, caughtAt: 'trainer' });
        const battle = (kind, foeName, foe, queue) => ({
            kind, me: fighter(save.monsters.m1, ['grass', 'poison'], { hp: 21, attack: 11, defense: 11, speed: 10, ultimate: 12 }, 15, { gauge: 1 }),
            foe: fighter(foe, ['bug'], { hp: 25, attack: 12, defense: 10, speed: 12, ultimate: 11 }, 18, { gauge: 0.4 }),
            foeQueue: queue, foeDown: [], foeUltWait: null, foeName, sendMs: 0,
            bench: {}, bagUsed: {}, phase: 'choose', anim: null, clash: null, result: null, overMs: 0, fleeTries: 0,
            msg: '이상해씨는 무엇을 할까?', popups: [], popupSeq: 0, t: 5000, catch: null, lastMs: 0, fought: ['m1'], ultAt: { me: null, foe: null }, start: 'normal',
        });
        let stage = { phase: 'walk' };
        if (place === 'facility' || place === 'hospital') { st.progress = 0.4724 - 1e-7; stage = { phase: 'facility', kind: 'hospital', at: 0.4724, ms: 0, inside: place === 'hospital' }; }
        if (place === 'shop') { st.progress = 0.6132; stage = { phase: 'facility', kind: 'shop', at: 0.6132, ms: 0, inside: true }; }
        // place=appear — 야생이 튀어나옴 "나타났다!" (ms= 지난 시간 · start=preemptive|ambush|normal → 전투 첫 말, 2026-10-21 선제공격은 스피드로)
        if (place === 'appear') {
            const wild = { ...save.monsters.m1, uid: 'wild', species: 4, form: 'charmander', level: 5, moves: [{ moveId: 52, pp: 25 }], hp: 20, caughtAt: 'forest-1' };
            save.pendingEncounter = { kind: 'wild', monster: wild, start: q.get('start') || 'normal' };
            stage = { phase: 'appear', ms: Number(q.get('ms') || 0), isNew: true };
        }
        if (place === 'shop-front') { st.progress = 0.6132 - 1e-7; stage = { phase: 'facility', kind: 'shop', at: 0.6132, ms: 0, inside: false }; }
        if (place === 'trainer' || place === 'trainer-battle') {
            st.progress = 0.30551;
            // tid=<스테이지>:t<번호> — 그 자리 트레이너 (예: forest-3:t2 = 엘리트 트레이너 소율 — tname 도 같은 이름이어야 엔진이 이 전투를 그대로 씀)
            const tid = q.get('tid') || 'forest-1:t0';
            const tst = tid.split(':')[0];
            if (tst !== 'forest-1') {
                save.stages[tst] = { ...st };
                save.location = { screen: 'stage', stageId: tst };
            }
            save.pendingEncounter = { kind: 'trainer', trainerId: tid, stageId: tst };
            // tname=<직함 이름> · tfoe=<모습>:<도감 번호> · tmsg=<말> · tphase=<단계> — 긴 직함 · 긴 이름 말 잘림 시험 (orders #20, 예: tname=엘리트 트레이너 소율&tfoe=beautifly:267&tphase=send)
            const [tf, ts] = (q.get('tfoe') || 'metapod:11').split(':');
            const tb = battle('trainer', q.get('tname') || '등산가 민수', foeMon('foe0', Number(ts) || 11, tf, 6), [foeMon('foe1', 14, 'kakuna', 6)]);
            if (q.get('tmsg')) tb.msg = q.get('tmsg');
            if (q.get('tphase')) tb.phase = q.get('tphase');
            if (q.get('tphase') === 'over') tb.result = 'win';
            if (q.get('tphase') === 'run') Object.assign(tb, { me: { ...tb.me, gauge: 0 }, foe: { ...tb.foe, gauge: 0 } });
            // tult=1 — 내 필살기로 상대를 쓰러뜨리는 중 (쓰러진 뒤 다음 볼까지 박자 시험, fx=1 · me=<모습>:<도감 번호> 와 같이 — 예 me=charizard:6)
            if (q.get('tult') === '1') {
                const [tmf, tms] = (q.get('me') || '').split(':');
                Object.assign(tb, { phase: 'anim', me: { ...tb.me, ult: 0, ...(tmf ? { form: tmf, species: Number(tms) || tb.me.species } : {}) }, foe: { ...tb.foe, hp: 1 }, anim: { side: 'me', action: { kind: 'ult' }, ms: 0, dur: Number(q.get('dur') || 20000), counter: false }, msg: '필살기!', ultAt: { me: 5000, foe: null } });
            }
            stage = place === 'trainer' ? { phase: 'trainer', n: 0, ms: Number(q.get('ms') || 1200) } : { phase: 'battle', battle: tb };
        }
        if (place && place.startsWith('rival')) {
            // 라이벌 — 시드 42 숲 1-1 의 빈 곳 (0.4) 에서 깜짝 등장 (사진용, 실제 자리는 시드마다)
            const rival = q.get('rival') || 'may';
            const [w, l] = (q.get('record') || '2-1').split('-').map(Number);
            save.rivals = { [rival]: { wins: w, losses: l } };
            st.progress = 0.4;
            save.pendingEncounter = { kind: 'rival', rival, stageId: 'forest-1' };
            const label = { boy: '레드', blue: '그린', brendan: '휘웅', wally: '민진', girl: '리프', may: '지민', 'may-rs': '봄이', 'leaf-em': '리즈' }[rival];
            if (place === 'rival' || place === 'rival-talk') stage = { phase: 'rival', rival, ms: q.get('ms') ? Number(q.get('ms')) : place === 'rival' ? 0 : 1200 };
            if (place === 'rival-battle') stage = { phase: 'battle', battle: battle('trainer', `라이벌 ${label}`, foeMon('foe0', 10, 'caterpie', 4), [foeMon('foe1', 16, 'pidgey', 4), foeMon('foe2', 255, 'torchic', 6)]) };
            if (place === 'rival-over') {
                const b = battle('trainer', `라이벌 ${label}`, foeMon('foe2', 255, 'torchic', 6), []);
                stage = { phase: 'battle', battle: { ...b, phase: 'over', result: 'lose', overMs: 0, me: { ...b.me, hp: 0 }, msg: `라이벌 ${label}에게 졌다… 연습 경기라 잃은 것은 없다!` } };
            }
            if (place === 'rival-lose') save.pendingEncounter = null;
            if (place === 'rival-result') {
                save.pendingEncounter = null;
                stage = { phase: 'result', ms: 0, summary: { title: `라이벌 ${label}${(label.charCodeAt(label.length - 1) - 0xac00) % 28 ? '과' : '와'}의 승부에서 이겼다!`, exp: [{ uid: 'm1', name: '이상해씨', gain: 64, from: 5, to: 6 }], money: 180, item: w === 0 ? '불꽃의돌' : '하이퍼볼', caught: null, learned: [], choices: 0, badge: null, quote: `${label}: 다음엔 꼭 이길 거야! (전적 ${w + 1}승 ${l}패)`, rival: true } };
            }
        }
        if (place === 'defeat') { st.progress = 0.4724 - 1e-7; st.run.reach = 0.61; st.run.retries = Number(q.get('retries') || 0); save.lastHospital = { stageId: 'forest-1', at: 0.4724 }; stage = { phase: 'defeat', gym: false, lost: 100 }; }
        if (place === 'clear') { st.progress = 1; st.cleared = true; save.playTimeMs = 2280000; stage = { phase: 'clear' }; }
        let stageId = save.location.screen === 'stage' ? save.location.stageId : 'forest-1';
        if (place === 'lobby' || place === 'gym-battle' || place === 'badge') {
            save.location = { screen: 'gym' };
            save.stages['forest-3'] = { ...st, progress: 1, cleared: true };
            stageId = null;
            if (place === 'badge') save.badges = ['forest'];
            if (place === 'gym-battle') save.pendingEncounter = { kind: 'gym-leader' };
            stage = place === 'lobby' ? { phase: 'lobby' } : place === 'badge' ? { phase: 'badge' } : { phase: 'battle', battle: battle('gym', '관장 나래', foeMon('gym0', 46, 'paras', 13), [foeMon('gym1', 44, 'gloom', 14), foeMon('gym2', 12, 'butterfree', 15)]) };
        }
        runtime = { rngState: 1, stepAccMs: 0, speed: 1, stage, stageId, toast: null };
    }

    // toast=<글> — 머리 위 알림이 뜬 화면 (사진용)
    if (q.get('toast')) runtime.toast = { text: q.get('toast'), ms: 600000 };
    // msg=<글> — 전투 한 줄 말을 바꿈 (긴 말이 잘리는지 보기, 2026-10-19)
    if (q.get('msg') && runtime.stage && runtime.stage.phase === 'battle') runtime.stage.battle.msg = q.get('msg');
    // pop=super,crit — 상대가 방금 맞은 숫자 + 상성 · 급소 문장 (1.2초 동안 말 앞에 붙는 흐름을 연속 캡처로 보기, 2026-10-21 UX 리뷰어)
    if (q.get('pop') && runtime.stage && runtime.stage.phase === 'battle') {
        const said = { super: '효과가 굉장했다!', weak: '효과가 별로인 듯하다…', crit: '급소에 맞았다!' };
        const kinds = q.get('pop').split(',').filter((k) => said[k]);
        runtime.stage.battle.popups = [{ id: 1, side: 'foe', text: '-12', ms: 0, kind: 'damage' }, ...kinds.map((k, i) => ({ id: 2 + i, side: 'foe', text: said[k], ms: 0, kind: k }))];
    }
    // bt=<ms> — 전투 시간 (0 이면 막 시작 — 볼 던지기 · 화면 닦기 사진, 2026-10-20)
    if (q.get('bt') && runtime.stage && runtime.stage.phase === 'battle') runtime.stage.battle.t = Number(q.get('bt'));
    // 개발 모드 (임시) — dev=1 이면 처음부터 개발 모드 · 타이틀의 개발 모드 줄 (title-dev) 도 흉내
    const devRt = { team: true, walk: 1, battle: 1, pause: false, foes: [], ults: {} };
    // devult=<필살기 이름> — 내 선두 (m1) 필살기 고르기 (dev=1 과 같이, 예: devult=블래스트번 — 박자 시험)
    if (q.get('devult')) devRt.ults = { m1: q.get('devult') };
    if (q.get('dev') === '1') runtime.dev = devRt;
    let epoch = 0;
    const toWebview = (m) => setTimeout(() => window.postMessage({ command: 'game', ...m }, '*'), 0);
    const start = (s) => toWebview({ type: 'start', epoch: ++epoch, state: { save: s, runtime } });

    window.pokemonGameLog = [];
    window.pokemonVscodeApi = {
        postMessage(m) {
            window.pokemonGameLog.push(m);
            // 화면 오류 글을 페이지 위에 (사진으로 원인 보기)
            if (m.type === 'load-failed') {
                const d = document.createElement('pre');
                d.style.cssText = 'position:fixed;left:0;bottom:0;z-index:99999;margin:0;color:#f88;background:#000;font-size:10px;white-space:pre-wrap';
                d.textContent = m.message;
                document.body.appendChild(d);
            }
            if (m.command !== 'game') return;
            if (m.type === 'ready') return screen === 'game' ? start(save) : toWebview({ type: 'title', info });
            if (m.type === 'title-new') return start(m.save);
            if (m.type === 'title-continue') return start(save);
            if (m.type === 'title-dev') {
                runtime.dev = devRt;
                return start(save);
            }
            if (m.type === 'dev-end') {
                delete runtime.dev;
                return toWebview({ type: 'title', info });
            }
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
        // 원래 setTimeout 을 잡아 둠 — 전투 연출 다리 (ult/bridge.js) 가 필살기 동안 setTimeout 에 번호를 붙여서, 그리기 반복까지 같이 멈추지 않게
        const st = window.setTimeout.bind(window);
        const ct = window.clearTimeout.bind(window);
        window.requestAnimationFrame = (cb) => st(() => cb(performance.now()), 16);
        window.cancelAnimationFrame = (id) => ct(id);
    }

    // 디버그: probe=선택자 → 계산된 스타일 몇 개를 페이지 아래에
    if (q.get('probe')) {
        setTimeout(() => {
            const el = document.querySelector(q.get('probe'));
            const d = document.createElement('pre');
            d.style.cssText = 'position:fixed;left:0;bottom:0;z-index:99999;margin:0;color:#8f8;background:#000;font-size:10px;white-space:pre-wrap';
            if (!el) d.textContent = 'no element';
            else { const cs = getComputedStyle(el); d.textContent = ['background-color', 'opacity', 'z-index', 'position', 'width', 'height', 'display', 'transform', 'filter', 'visibility', 'animation-name', 'animation-delay', '--pg-vs-at', 'top', 'right'].map((k) => k + '=' + cs.getPropertyValue(k)).join(' · ') + (el.tagName === 'IMG' ? ' · src=' + el.getAttribute('src') + ' · nat=' + el.naturalWidth : ''); }
            document.body.appendChild(d);
        }, Number(q.get('probeAt') || 900));
    }

    const s = document.createElement('script');
    s.src = '../extension/media/game/game.js';
    // fx=1 — 일반 모드 번들을 먼저 띄워 전투 연출 다리 (window.pokemonFx) 를 씀 (VS Code 와 같게)
    if (q.get('fx') === '1') {
        window.acquireVsCodeApi = () => ({ getState: () => undefined, setState: () => {}, postMessage: () => {} });
        const nb = document.createElement('script');
        nb.src = '../extension/media/main-bundle.js';
        nb.onload = () => {
            try {
                pokemonApp.pokemonPanelApp('../extension/media', 'none', 2, 'default', 'nano', 'pikachu', 'false', 'gen1', '32', window.acquireVsCodeApi());
            } catch (e) {
                console.error('일반 모드 번들 시작 실패', e);
            }
            // fxdbg=1 — 다리 부르기를 콘솔에 남김 (연출 시험)
            const f = window.pokemonFx;
            if (q.get('fxdbg') && f) {
                for (const k of ['ult', 'stopUlt', 'clear', 'move', 'duel', 'duelWin', 'stopDuel']) {
                    const fn = f[k];
                    f[k] = (...a) => {
                        const r = fn.apply(f, a);
                        console.log('fxdbg', k, Math.round(performance.now()), r);
                        return r;
                    };
                }
            }
            if (q.get('fxdbg')) setInterval(() => { const fb = document.querySelector('#pokemon-game .pg-fighter-me .pg-fx-body'); if (fb) { const cs = getComputedStyle(fb); console.log('fxdbg body', Math.round(performance.now()), fb.className, cs.animationName, cs.animationDuration, cs.transform, fb.style.getPropertyValue('--pg-dx')); } }, 100);
            if (q.get('fxdbg')) setInterval(() => { const cv = document.getElementById('pokemonFxCanvas'); console.log('fxdbg css', cv ? getComputedStyle(cv).clipPath : 'no canvas', document.body.style.getPropertyValue('--pg-fx-top'), document.querySelector('#pokemon-game .pg-infobar')?.getBoundingClientRect().bottom, (() => { const f = document.querySelector('#pokemon-game .pg-clash-time .pg-bar-fill'); return f ? Math.round(f.getBoundingClientRect().width) + '/' + Math.round(f.parentElement.getBoundingClientRect().width) + ' ' + f.className : '-'; })()); }, 500);
            if (q.get('fxdbg')) setInterval(() => console.log('fxdbg msg', Math.round(performance.now()), (document.getElementById('pokemon-game')?.innerText || '').replace(/\s+/g, ' ').slice(-70)), 250);
            document.body.appendChild(s);
            // impacts=1 — 18 타입 기술 임팩트를 격자로 한 번에 (ult/fx-hit.js 보기, big=1 이면 센 기술, pick=0 ~ 2 = 짜임)
            if (q.get('impacts') && window.pokemonFx?.testImpact) {
                setTimeout(() => {
                    const types = ['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'];
                    const cols = 6;
                    const W = window.innerWidth / cols;
                    const H = (window.innerHeight - 20) / 3;
                    types.forEach((t, i) => window.pokemonFx.testImpact(W * (i % cols) + W / 2, 20 + H * Math.floor(i / cols) + H / 2, 2, t, q.get('big') === '1', Number(q.get('w')) || 48, Number(q.get('pick')) || 0));
                }, Number(q.get('impacts')) || 300);
            }
            // stopult=<ms> — 그때 필살기를 멈춤 (맞받아치기로 끊긴 것처럼 — 남은 연출 · 숨긴 그림이 안 남는지 시험)
            if (q.get('stopult')) setTimeout(() => window.pokemonFx?.stopUlt?.(), Number(q.get('stopult')));
        };
        document.body.appendChild(nb);
    } else {
        document.body.appendChild(s);
    }

    // 개발 모드 장면 바로 가기 (사진용) — devscene=개발 메뉴 버튼 글자를 | 로 이어서 차례로 (예: 3:3 트레이너전|필살기 게이지 가득) ·
    //   key:Digit1 = 그 키 누름 · wait:500 = 쉼 · dev=1 과 같이. 하나 끝날 때마다 판이 닫혀 있으면 다시 엶
    const devScene = q.get('devscene');
    if (devScene) {
        const steps = devScene.split('|');
        const run = (i, left) => {
            if (i >= steps.length) return;
            const st = steps[i];
            if (st.startsWith('wait:')) return setTimeout(() => run(i + 1, 40), Number(st.slice(5)));
            if (st.startsWith('key:')) {
                const code = st.slice(4);
                if (document.querySelector('#pokemon-game .pg-panel')) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }));
                window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code.replace('Digit', '').replace('Key', '').toLowerCase() === 'space' ? ' ' : code.replace('Digit', '').replace('Key', ''), bubbles: true }));
                return setTimeout(() => run(i + 1, 40), 100);
            }
            const badge = document.querySelector('#pokemon-game .pg-dev-badge');
            const btn = [...document.querySelectorAll('#pokemon-game .pg-dev-btn')].find((x) => x.textContent.trim() === st);
            if (btn) {
                btn.click();
                // 장면이 아닌 것 (상태 · 속도) 은 판이 그대로 — 닫기
                setTimeout(() => { if (document.querySelector('#pokemon-game .pg-panel')) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' })); }, 50);
                return setTimeout(() => run(i + 1, 40), 300);
            }
            if (badge && !document.querySelector('#pokemon-game .pg-panel')) badge.click();
            // 개발 메뉴 탭 (장면 · 팀 · 바꾸기 · 속도) 을 차례로 넘겨 찾음
            else {
                const tabs = [...document.querySelectorAll('#pokemon-game .pg-dev-tabs button')];
                if (tabs.length) tabs[(40 - left) % tabs.length].click();
            }
            if (left > 0) setTimeout(() => run(i, left - 1), 100);
        };
        setTimeout(() => run(0, 40), 300);
    }
    // 버튼 누르기 (사진용)
    const click = q.get('click');
    if (click) {
        // map|team|bag|settings = 오른쪽 위 버튼 (S07 · S18 · S19 · S20) · profile = 상대 포켓몬 누르기 (S21) · item = 가방에서 상처약 고르기
        const label = { new: '새로 하기', continue: '이어 하기', exit: '일반 모드', skills: '3 스킬', items: '4 아이템', map: '🗺', team: '◓', bag: '🎒', settings: '⚙', item: '상처약', dev: '개발 저장 안 됨', devtitle: '개발 모드 (임시)' }[click];
        const alt = { skills: '3✨' }[click];
        // game.js 를 받아 화면이 그려질 때까지 기다렸다가
        const tryClick = (left) => {
            if (click === 'profile') {
                const f = document.querySelector('#pokemon-game .pg-fighter-foe');
                if (f) return f.click();
                if (left > 0) setTimeout(() => tryClick(left - 1), 100);
                return;
            }
            // hero = 새로 하기 → S03 (pick=N 이면 → 를 N 번 — 고른 칸 옮기기) · starter = S03 에서 첫 칸 → S04 (pick=N 이면 → 를 N 번 — 예: 12 = 개구마르 계열)
            if (click === 'hero' || click === 'starter') {
                const nb = [...document.querySelectorAll('#pokemon-game button')].find((x) => x.textContent.includes('새로 하기'));
                const pick = Number(q.get('pick') || 0);
                const right = () => { for (let i = 0; i < pick; i++) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })); };
                if (nb) { nb.click(); if (click === 'starter') setTimeout(() => { document.querySelector('#pokemon-game .pg-hero-choice')?.click(); setTimeout(right, 200); }, 200); else setTimeout(right, 200); return; }
                if (left > 0) setTimeout(() => tryClick(left - 1), 100);
                return;
            }
            if (click === 'item') {
                // 정보줄 버튼은 픽셀 아이콘 (단계 12) 이라 글자 대신 title 로 찾음
                const bag = [...document.querySelectorAll('#pokemon-game button')].find((x) => (x.title || '').includes('가방'));
                if (bag) { bag.click(); setTimeout(() => [...document.querySelectorAll('#pokemon-game .pg-chip')].find((x) => x.textContent.includes('상처약'))?.click(), 200); return; }
                if (left > 0) setTimeout(() => tryClick(left - 1), 100);
                return;
            }
            // lvup = S12 결과의 얼굴 카드 (첫째) · lvup2 = 둘째 (ups=2) → 내 포켓몬 판이 그 포켓몬으로
            if (click === 'lvup' || click === 'lvup2') {
                const all = [...document.querySelectorAll('#pokemon-game button')].filter((x) => (x.title || '').includes('스탯 찍기'));
                const t = all[click === 'lvup2' ? 1 : 0];
                if (t) return t.click();
                if (left > 0) setTimeout(() => tryClick(left - 1), 100);
                return;
            }
            const byTitle = { team: '내 포켓몬', map: '세계 지도', bag: '가방', settings: '설정' }[click];
            const b = [...document.querySelectorAll('#pokemon-game button')].find((x) => (byTitle && (x.title || '').includes(byTitle)) || x.textContent.includes(label) || (alt && x.textContent.includes(alt)));
            if (b && !document.getElementById('pokemon-game').hidden) b.click();
            else if (left > 0) setTimeout(() => tryClick(left - 1), 100);
        };
        tryClick(30);
    }
})();
