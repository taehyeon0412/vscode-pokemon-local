// 📦 꺼내기 미리보기 — dev/team-out.html (일반 모드 미리보기가 READY 가 되면 게임 팀 메시지를 보냄)
(function () {
    const q = new URLSearchParams(location.search);
    const step = q.get('step') || 'out';
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = (t) => (document.getElementById('out').textContent += t + '\n');
    const team = [
        { uid: 'm1', form: 'bulbasaur', gen: 'gen1', size: 32, color: 'default', name: '이상해씨', level: 12, moves: [{ id: 22, name: '덩굴채찍', type: 'grass' }, { id: 33, name: '몸통박치기', type: 'normal' }] },
        { uid: 'm2', form: 'charmander', gen: 'gen1', size: 32, color: 'shiny', name: '파이리', level: 7, moves: [{ id: 52, name: '불꽃세례', type: 'fire' }] },
        { uid: 'm3', form: 'caterpie', gen: 'gen1', size: 32, color: 'default', name: '캐터피', level: 4, moves: [{ id: 81, name: '실뿜기', type: 'bug' }] },
        // 배운 기술이 0개 → 종 대표 기술이 아니라 "공격" (명세 검사관 단계 10)
        { uid: 'm4', form: 'metapod', gen: 'gen1', size: 32, color: 'default', name: '단데기', level: 7, moves: [] },
    ];
    const game = () => pokemonApp.allPokemon.pokemonCollection.filter((e) => e.game);
    const warns = [];
    const cw = console.warn.bind(console);
    console.warn = (...a) => {
        warns.push(a.map((v) => (v && v.message) || String(v)).join(' '));
        cw(...a);
    };
    (async () => {
        for (let i = 0; i < 100 && document.title !== 'READY'; i++) await wait(100);
        const before = pokemonApp.allPokemon.pokemonCollection.length;
        window.postMessage({ command: 'game-team', team }, '*');
        await wait(1200);
        out(`일반 ${before} · 게임 ${game().length} (${game().map((e) => e.pokemon.name + ' ' + e.game.level).join(', ')})`);
        out(`기술: ${game().map((e) => e.pokemon.gameMoves.map((m) => m[0] + '/' + m[1]).join(' ')).join(' | ')}`);
        // 저장 (saveState) 에 안 섞이는지 — setState 를 가로채서
        let saved = null;
        const api = { getState: () => undefined, setState: (s) => (saved = s), postMessage: () => {} };
        pokemonApp.saveState(api);
        out(`저장된 수 ${saved?.pokemonStates?.length} (일반만 ${before})`);
        // 걷게 두고 Lv 표가 그림을 따라가는지 (?shim=1 이어야 머리 없는 브라우저에서 박자가 돎)
        const gap = () => game().map((e) => Math.round(Math.abs(parseFloat(e.gameTag.style.left) - (e.pokemon.left + e.pokemon.calculateSpriteWidth(e.pokemon._size, e.pokemon._originalSpriteSize) / 2))));
        const from = game().map((e) => e.pokemon.left);
        await wait(10000);
        const moved = game().filter((e, i) => Math.abs(e.pokemon.left - from[i]) > 1).length;
        out(`10초 걸음: 움직인 ${moved}마리 · Lv 표와 그림 가운데 차이 ${gap().join(' ')}px · 경고 ${warns.length}${warns.length ? ' (' + warns[0] + ')' : ''}`);
        if (step === 'click') {
            const el = game()[0];
            el.collision.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            await wait(400);
            out('첫 포켓몬 클릭');
        }
        if (step === 'in') {
            window.postMessage({ command: 'game-team', team: [] }, '*');
            await wait(1700);
            out(`넣은 뒤: 전체 ${pokemonApp.allPokemon.pokemonCollection.length} · 게임 ${game().length} · 이름표 ${document.querySelectorAll('.game-team-level').length}`);
        }
        out(`오류: ${window.__log.filter((l) => /error/.test(l)).length}`);
        document.title = 'DONE';
    })();
})();
