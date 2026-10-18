// 웹뷰 흉내 — VS Code 없이 브라우저에서 포켓몬 패널을 띄움 (dev/preview.html 이 iframe 으로, dev/smoke.py 가 직접)
//   ?bundle=build/x.js   쓸 묶음 (기본 ../extension/media/main-bundle.js)
//   ?p=charizard,pikachu  포켓몬 (기본 몇 마리) · ?size=nano · ?theme=forest|none
//   ?smoke=all | ultbeam,ultorb | pokemon | lib   틀마다(옵션 여러 벌) · p 의 포켓몬마다 · 데이터의 필살기 모두(&from=&to=) 차례로 쓰고 오류 · 입자 수를 #smoke 에 JSON 으로
//   ?shot=<틀>&opts={json}&at=1500&actor=0  필살기를 쓰고 at ms 뒤 화면을 멈춤 (스크린샷용) · ?shot=own 이면 그 포켓몬 자기 필살기
//   ?shim=1  requestAnimationFrame 을 타이머로 (머리 없는 브라우저용)
const q = new URLSearchParams(location.search);
window.__log = [];
window.addEventListener('error', (e) => window.__log.push(`error: ${e.error?.stack || e.message}`));
const consoleError = console.error.bind(console);
console.error = (...a) => {
    window.__log.push(`console.error: ${a.map((v) => v?.stack || String(v)).join(' ')}`);
    consoleError(...a);
};
window.acquireVsCodeApi = () => ({ getState: () => undefined, setState: () => {}, postMessage: () => {} });
// 머리 없는 브라우저의 가상 시간에선 requestAnimationFrame 이 안 돌아서 — ?shim=1 이면 16ms 타이머로 (smoke.py 가 붙임)
let frozen = false;
window.__freeze = () => {
    frozen = true;
};
if (q.get('shim')) {
    window.requestAnimationFrame = (cb) => setTimeout(() => !frozen && cb(performance.now()), 16);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
}

// 틀마다 시험할 옵션 — SPEC.md 의 옵션을 고루
const VARIANTS = {
    ultbeam: [{ c: 'hyper' }, { solar: 1 }, { c: 'ice', rainbow: 1 }, { c: 'water', double: 1, sparkle: 'water' }, { c: 'psychic', spiral: 1, wave: 1 }, { c: 'solar', venus: 1 }, { c: 'water', turtle: 1 }, { c: 'hyper', uniq: 'gyarados' }, { c: 'ice', uniq: 'lapras' }, { c: 'wind', uniq: 'lugia' }, { c: 'fire', uniq: 'hooh' }, { c: 'water', uniq: 'kyogre' }, { c: 'dragon', uniq: 'dialga' }, { c: 'ice', rainbow: 1, uniq: 'suicune' }, { c: 'water', uniq: 'feraligatr' }],
    ultorb: [{ c: 'fire', style: 'flame' }, { c: 'ghost', style: 'shadow' }, { c: 'aura', style: 'aura' }, { c: 'aura', style: 'aura', lucario: 1 }, { c: 'water', turtle: 1 }, { c: 'psychic', mewtwo: 1 }, { c: 'psychic', mew: 1 }, { c: 'psychic', sky: 1 }, { c: 'ghost', style: 'shadow', uniq: 'gengar' }],
    ultnova: [{ c: 'fire' }, { c: 'normal', white: 1 }, { c: 'ice', white: 1, uniq: 'articuno' }, { c: 'fire', uniq: 'typhlosion' }],
    ultblackhole: [{ c: 'dark' }, { c: 'dark', uniq: 'darkrai' }, { uniq: 'umbreon' }],
    ultsparkle: [{ mode: 'twinkle', c: 'fairy' }, { mode: 'moon', c: 'moon' }, { mode: 'twinkle', c: 'star', uniq: 'eevee' }, { mode: 'moon', c: 'moon', uniq: 'gardevoir' }, { mode: 'twinkle', c: 'fairy', uniq: 'togekiss' }],
    ultquake: [{ c: 'ground' }, { c: 'fire', lava: 1 }, { c: 'fire', lava: 1, uniq: 'groudon' }, { c: 'fire', lava: 1, uniq: 'entei' }, { c: 'ground', uniq: 'swampert' }],
    ultpillar: [{ kind: 'fire' }, { kind: 'rock' }, { kind: 'ice' }, { kind: 'water' }, { kind: 'light' }, { kind: 'vine' }, { kind: 'shadow' }, { kind: 'fire', c: 'fire', blast: 1 }, { kind: 'vine', c: 'grass', venus: 1 }, { kind: 'rock', n: 6, uniq: 'tyranitar' }],
    ultbloom: [{ mode: 'bloom', c: 'grass' }, { mode: 'vine', c: 'grass' }, { mode: 'vine', c: 'grass', uniq: 'meganium' }],
    ultvortex: [{ c: 'water' }, { c: 'fire', n: 2 }],
    ultstorm: [...['thunder', 'blizzard', 'wind', 'acid', 'petal', 'leaf', 'sand', 'rain', 'fire'].map((kind) => ({ kind })), { kind: 'thunder', c: 'electric', uniq: 'zapdos' }],
    ultskyfall: [{ shape: 'rock', n: 1 }, { shape: 'ice', n: 1 }, { shape: 'meteor', n: 8, c: 'dragon' }, { shape: 'star', n: 6, c: 'star' }, { shape: 'star', n: 12, c: 'gold', uniq: 'arceus' }, { shape: 'meteor', n: 8, uniq: 'salamence' }],
    ultthunder: [{ mode: 'spear' }, { mode: 'pillar' }, { mode: 'pillar', uniq: 'raikou' }],
    ultvolt: [{ rainbow: 1 }, { c: 'electric', rainbow: 0 }, { rainbow: 1, max: 1, uniq: 'pikachu' }],
    ultswarm: [{ shape: 'needle', c: 'bug' }, { shape: 'leaf', c: 'grass', n: 40 }, { shape: 'star', c: 'star' }, { shape: 'shuriken', c: 'water', giant: 1 }, { shape: 'shuriken', c: 'water', giant: 1, ninja: 1 }, { shape: 'shuriken', c: 'water', clones: 5 }, { shape: 'heart', c: 'fairy' }],
    ultrush: [{ c: 'normal' }, { c: 'steel', drill: 1 }, { c: 'fire', flame: 1 }, { c: 'electric', elec: 1 }, { c: 'water', water: 1, fast: 1 }, { c: 'dragon', uniq: 'dragonite' }, { c: 'hyper', fast: 1, uniq: 'arcanine' }],
    ultdive: [{ c: 'wind' }, { c: 'normal', heavy: 1 }, { c: 'electric', elec: 1 }, { c: 'dragon', flame: 1 }, { c: 'fire', flare: 1 }, { heavy: 1, c: 'normal', uniq: 'snorlax' }, { c: 'dragon', uniq: 'rayquaza' }, { c: 'dragon', uniq: 'garchomp' }, { c: 'steel', heavy: 1, uniq: 'metagross' }],
    ultbarrage: [{ kind: 'punch', c: 'fight' }, { kind: 'slash', c: 'bug', spin: 1 }, { kind: 'kick', c: 'fire' }, { kind: 'punch', c: 'aura', aura: 1 }, { kind: 'slash', c: 'psychic', uniq: 'palkia' }, { kind: 'punch', c: 'fire', uniq: 'machamp' }, { kind: 'punch', c: 'steel', uniq: 'scizor' }, { kind: 'kick', c: 'fire', uniq: 'blaziken' }, { kind: 'slash', c: 'grass', uniq: 'sceptile' }],
    ultpsy: [{ c: 'psychic' }, { c: 'psychic', mewtwo: 1 }, { c: 'fairy', mew: 1 }, { c: 'psychic', uniq: 'alakazam' }, { c: 'psychic', uniq: 'espeon' }],
    ultshadow: [{ c: 'ghost' }, { c: 'ghost', uniq: 'giratina' }],
    ultsplash: [{}],
    ultcopy: [{}],
    ultmetronome: [{}],
    ultgeneric: [{}],
};
window.__VARIANTS = VARIANTS;
// 대결 모양 종류마다 대표 필살기 (ult/duel.js 의 DUEL_KIND)
const DUEL_REPS = {
    beam: ['파괴광선', 'ultbeam', { c: 'hyper', width: 1.3 }],
    bolt: ['1000만볼트', 'ultvolt', { rainbow: 1 }],
    orb: ['다이내믹풀플레임', 'ultorb', { c: 'fire', style: 'flame' }],
    dome: ['대폭발', 'ultnova', { c: 'hyper' }],
    ground: ['스톤에지', 'ultpillar', { kind: 'rock', c: 'rock' }],
    tornado: ['하이드로보텍스', 'ultvortex', { c: 'water' }],
    storm: ['눈보라', 'ultstorm', { kind: 'blizzard', c: 'ice' }],
    meteor: ['용성군', 'ultskyfall', { shape: 'meteor', n: 8, c: 'dragon' }],
    swarm: ['바늘미사일', 'ultswarm', { shape: 'needle', c: 'bug' }],
    rush: ['기가임팩트', 'ultrush', { c: 'normal' }],
    wave: ['사이코키네시스', 'ultpsy', { c: 'psychic' }],
};
window.__DUEL_REPS = DUEL_REPS;

const script = document.createElement('script');
script.src = q.get('bundle') || '../extension/media/main-bundle.js';
script.onload = () => start().catch((e) => window.__log.push(`start: ${e.stack || e}`));
script.onerror = () => window.__log.push(`bundle 못 읽음: ${script.src}`);
document.body.appendChild(script);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function koNames() {
    const names = {};
    for (let g = 1; g <= 6; g++) {
        try {
            Object.assign(names, await (await fetch(`../extension/l10n/pokemon/ko/gen${g}.json`)).json());
        } catch {
            // file:// 이면 못 읽음 — 영어 키 그대로
        }
    }
    return names;
}

async function start() {
    const size = q.get('size') || 'nano';
    pokemonApp.pokemonPanelApp('../extension/media', q.get('theme') || 'forest', 2, 'default', size, 'pikachu', 'false', 'gen1', '32', acquireVsCodeApi());
    const names = await koNames();
    const keys = (q.get('p') || 'charizard,pikachu,venusaur,gengar,dragonite').split(',').filter(Boolean);
    window.__spawn = (key, color = 'default') => {
        const d = __ult.info(key);
        if (!d) {
            window.__log.push(`없는 포켓몬 ${key}`);
            return;
        }
        window.postMessage({ command: 'spawn-pokemon', type: key, generation: `gen${d.generation}`, originalSpriteSize: d.originalSpriteSize ?? 32, color, name: names[key] || names[key.split('_')[0]] || key }, '*');
    };
    keys.forEach((k) => window.__spawn(k));
    for (let i = 0; i < 50 && __ult.list().length < keys.length; i++) {
        await wait(50);
    }
    window.__spread();
    await wait(300);
    document.title = 'READY';
    if (q.get('smoke')) {
        await smoke(q.get('smoke'));
    } else if (q.get('shot')) {
        await shot();
    }
}

// 골고루 세우기
window.__spread = () => {
    const n = __ult.list().length;
    for (let i = 0; i < n; i++) {
        const p = __ult.pick(i);
        __ult.place(i, ((i + 0.5) / n) * window.innerWidth - spriteSize(p) / 2);
    }
};
const spriteSize = (p) => p.calculateSpriteWidth(p._size, p._originalSpriteSize);

async function idle() {
    for (let i = 0; i < 200 && __ult.active(); i++) {
        await wait(50);
    }
    await wait(250);
}

async function runOne(label, actor, spec) {
    const before = __ult.errors.length + window.__log.length;
    let max = 0;
    const t0 = performance.now();
    let total = 0;
    try {
        total = spec ? __ult.fire(actor, spec) : __ult.fire(actor);
    } catch (e) {
        window.__log.push(`${label}: ${e.stack || e}`);
    }
    const end = t0 + (total || 0) + 300;
    while (performance.now() < end) {
        max = Math.max(max, __ult.count());
        await wait(40);
    }
    const errs = [...__ult.errors, ...window.__log].slice(before);
    return { label, ms: Math.round(total || 0), maxParticles: max, errors: errs.slice(0, 5) };
}

async function smoke(what) {
    const out = [];
    const n = __ult.list().length;
    let k = 0;
    if (what === 'pokemon') {
        for (let i = 0; i < n; i++) {
            await idle();
            const p = __ult.pick(i);
            for (const ult of __ult.of(p.label)) {
                out.push({ pokemon: p.label, ult: ult[0], fx: ult[1], ...(await runOne(`${p.label}:${ult[0]}`, i, ult)) });
                await idle();
            }
        }
    } else if (what === 'duellib') {
        // 데이터에 있는 필살기 모두를 대결로 — 틀 + 옵션이 같은 건 한 번만, 상대는 종류별 대표를 돌아가며, 승패도 돌아가며 (이긴 쪽 모양까지 보려고)
        const seen = new Set();
        const lib = __ult.lib().filter(([, fx, o]) => {
            const key = JSON.stringify([fx, o]);
            return !['ultsplash', 'ultcopy', 'ultmetronome'].includes(fx) && !seen.has(key) && seen.add(key);
        });
        const kinds = Object.keys(DUEL_REPS);
        const from = Number(q.get('from') ?? 0);
        const to = Math.min(lib.length, Number(q.get('to') ?? lib.length));
        for (let i = from; i < to; i++) {
            await idle();
            __spread();
            const ua = lib[i];
            const ub = DUEL_REPS[kinds[i % kinds.length]];
            const win = ['a', 'b', 'draw'][i % 3];
            const before = __ult.errors.length + window.__log.length;
            let max = 0;
            const total = __ult.clash(0, n - 1, ua, ub, win);
            const end = performance.now() + total + 300;
            while (performance.now() < end) {
                max = Math.max(max, __ult.count());
                await wait(40);
            }
            out.push({ label: `${ua[0]} ${ua[1]} ${JSON.stringify(ua[2])} vs ${ub[1]} (${win})`, ms: Math.round(total), maxParticles: max, errors: [...__ult.errors, ...window.__log].slice(before).slice(0, 5) });
        }
    } else if (what === 'duel') {
        // 대결 모양 종류끼리 — 종류마다 한 번씩 쓰고, 상대는 돌아가며
        const kinds = Object.keys(DUEL_REPS);
        const rounds = Number(q.get('rounds') ?? 2);
        for (let r = 0; r < rounds; r++) {
            for (let i = 0; i < kinds.length; i++) {
                await idle();
                __spread();
                const ka = kinds[i];
                const kb = kinds[(i + 1 + r * 3) % kinds.length];
                const before = __ult.errors.length + window.__log.length;
                let max = 0;
                const total = __ult.clash(0, n - 1, DUEL_REPS[ka], DUEL_REPS[kb]);
                const end = performance.now() + total + 300;
                while (performance.now() < end) {
                    max = Math.max(max, __ult.count());
                    await wait(40);
                }
                out.push({ label: `대결 ${ka} vs ${kb}`, ms: Math.round(total), maxParticles: max, errors: [...__ult.errors, ...window.__log].slice(before).slice(0, 5) });
            }
        }
    } else if (what === 'clash') {
        // 필살기 대결 — 양 끝에서 안쪽으로 짝지어
        for (let i = 0; i < Math.floor(n / 2); i++) {
            await idle();
            __spread();
            const before = __ult.errors.length + window.__log.length;
            let max = 0;
            const total = __ult.clash(i, n - 1 - i);
            const end = performance.now() + total + 300;
            while (performance.now() < end) {
                max = Math.max(max, __ult.count());
                await wait(40);
            }
            const p = __ult.pick(i);
            const r = __ult.pick(n - 1 - i);
            out.push({ label: `대결 ${p.label} vs ${r.label}`, ms: Math.round(total), maxParticles: max, errors: [...__ult.errors, ...window.__log].slice(before).slice(0, 5) });
        }
    } else if (what === 'lib') {
        // 데이터에 실제로 있는 필살기 — 틀 + 옵션이 같은 건 한 번만
        const seen = new Set();
        const lib = __ult.lib().filter(([, fx, o]) => {
            const key = JSON.stringify([fx, o]);
            return !seen.has(key) && seen.add(key);
        });
        const from = Number(q.get('from') ?? 0);
        const to = Number(q.get('to') ?? lib.length);
        for (const ult of lib.slice(from, to)) {
            await idle();
            __spread();
            out.push({ fx: ult[1], o: ult[2], ...(await runOne(`${ult[0]} ${ult[1]} ${JSON.stringify(ult[2])}`, k++ % n, ult)) });
        }
    } else {
        const list = what === 'all' ? Object.keys(VARIANTS) : what.split(',');
        for (const fx of list) {
            for (const o of VARIANTS[fx] || [{}]) {
                await idle();
                __spread();
                out.push({ fx, o, ...(await runOne(`${fx} ${JSON.stringify(o)}`, k++ % n, [`시험 ${fx}`, fx, o])) });
            }
        }
    }
    const pre = document.createElement('pre');
    pre.id = 'smoke';
    pre.textContent = JSON.stringify({ results: out, log: window.__log.slice(0, 20) });
    document.body.appendChild(pre);
    document.title = 'SMOKE:DONE';
}

async function shot() {
    const fx = q.get('shot');
    const actor = Number(q.get('actor') ?? 0);
    const at = Number(q.get('at') ?? 1500);
    const o = JSON.parse(q.get('opts') || '{}');
    if (fx === 'own') {
        __ult.fire(actor);
    } else if (fx === 'clash') {
        __ult.clash(actor, Number(q.get('vs') ?? __ult.list().length - 1), q.get('ua') ? JSON.parse(q.get('ua')) : undefined, q.get('ub') ? JSON.parse(q.get('ub')) : undefined, q.get('win') || undefined); // 필살기 대결 (win=a|b|draw 로 승패를 정함)
    } else if (fx === 'sig') {
        // 클릭 기술 하나 (opts = [이름, 틀, 옵션]) — &x=0.15 면 패널 그 위치에 세우고 오른쪽을 보고
        if (q.get('x')) {
            __ult.place(actor, window.innerWidth * Number(q.get('x')));
        }
        __ult.sig(actor, o, false);
    } else if (fx === 'beamclash') {
        __ult.beamclash(actor, Number(q.get('vs') ?? __ult.list().length - 1)); // 광선 힘겨루기
    } else if (fx === 'press') {
        __ult.press(actor, Number(q.get('hold') ?? 1100)); // 진짜 꾹 누르기처럼 (기 모으기 → 필살기)
    } else {
        __ult.fire(actor, [q.get('name') || `시험 ${fx}`, fx, o]);
    }
    await wait(at);
    window.__freeze(); // 멈춤 — 지금 그림 그대로
    window.requestAnimationFrame = () => 0;
    const pre = document.createElement('pre');
    pre.id = 'log';
    pre.style.display = 'none';
    pre.textContent = JSON.stringify({ log: window.__log, errors: __ult.errors, srcs: __ult.list().map((k, i) => __ult.pick(i).el.src.split('/').slice(-3).join('/')) });
    document.body.appendChild(pre);
    document.title = 'SHOT:READY';
}
