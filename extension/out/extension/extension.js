"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.spawnPokemonDeactivate = exports.activate = exports.storeCollectionAsMemento = exports.PokemonSpecification = exports.shouldSpawnInitialCollection = void 0;
const vscode = require("vscode");
// LOCAL-PATCH: 메뉴 문구는 VS Code 언어와 상관없이 무조건 한국어 (l10n/bundle.l10n.ko.json)
const KO_TEXT = (() => {
    try {
        return JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../../l10n/bundle.l10n.ko.json'), 'utf8'));
    }
    catch {
        return {};
    }
})();
function koT(message, ...args) {
    return (KO_TEXT[message] ?? message).replace(/\{(\d+)\}/g, (m, i) => (args[i] !== undefined ? String(args[i]) : m));
}
const localize = require("../common/localize");
const names_1 = require("../common/names");
const pokemon_data_1 = require("../common/pokemon-data");
const types_1 = require("../common/types");
const pokemon_collection_1 = require("../panel/pokemon-collection");
const EXTRA_POKEMON_KEY = 'vscode-pokemon.extra-pokemon';
const EXTRA_POKEMON_KEY_TYPES = EXTRA_POKEMON_KEY + '.types';
const EXTRA_POKEMON_KEY_COLORS = EXTRA_POKEMON_KEY + '.colors';
const EXTRA_POKEMON_KEY_NAMES = EXTRA_POKEMON_KEY + '.names';
const DEFAULT_POKEMON_SCALE = "medium" /* PokemonSize.medium */;
const DEFAULT_COLOR = "default" /* PokemonColor.default */;
const DEFAULT_POKEMON_TYPE = (0, pokemon_data_1.getDefaultPokemon)();
const DEFAULT_POSITION = "panel" /* ExtPosition.panel */;
const DEFAULT_THEME = "none" /* Theme.none */;
class PokemonQuickPickItem {
    name_;
    type;
    color;
    constructor(name_, type, color) {
        this.name_ = name_;
        this.type = type;
        this.color = color;
        this.name = name_;
        this.label = name_;
        // LOCAL-PATCH: "default pikachu" 대신 "피카츄"
        this.description = `${localize.getLocalizedPokemonName(type)}${color === 'shiny' ? ' · 색이 다른 개체' : ''}`;
    }
    name;
    label;
    kind;
    description;
    detail;
    picked;
    alwaysShow;
    buttons;
}
let webviewViewProvider;
function getConfiguredSize() {
    var size = vscode.workspace
        .getConfiguration('vscode-pokemon')
        .get('pokemonSize', DEFAULT_POKEMON_SCALE);
    if (types_1.ALL_SCALES.lastIndexOf(size) === -1) {
        size = DEFAULT_POKEMON_SCALE;
    }
    return size;
}
function getConfiguredTheme() {
    var theme = vscode.workspace
        .getConfiguration('vscode-pokemon')
        .get('theme', DEFAULT_THEME);
    if (types_1.ALL_THEMES.lastIndexOf(theme) === -1) {
        theme = DEFAULT_THEME;
    }
    return theme;
}
function getConfiguredThemeKind() {
    return vscode.window.activeColorTheme.kind;
}
function getConfigurationPosition() {
    return vscode.workspace
        .getConfiguration('vscode-pokemon')
        .get('position', DEFAULT_POSITION);
}
function getThrowWithMouseConfiguration() {
    return vscode.workspace
        .getConfiguration('vscode-pokemon')
        .get('throwBallWithMouse', true);
}
function getConfiguredShinyOdds() {
    return vscode.workspace
        .getConfiguration('vscode-pokemon')
        .get('shinyOdds', 8192);
}
function maybeMakeShiny(possibleColors) {
    if (possibleColors.includes("shiny" /* PokemonColor.shiny */)) {
        const shinyOdds = getConfiguredShinyOdds();
        if (Math.floor(Math.random() * shinyOdds) === 0) {
            return "shiny" /* PokemonColor.shiny */;
        }
    }
    return possibleColors[0];
}
/**
 * Resolves a 'random' defaultPokemon entry to a concrete type, optionally
 * constrained to `pool`. Falls back to the full types list if `pool` is
 * empty or contains no valid entries (invalid entries are warned about, not
 * treated as fatal).
 */
function resolveRandomPokemonType(pool) {
    const allPokemon = (0, pokemon_data_1.getAllPokemon)();
    if (!pool || pool.length === 0) {
        const [randomPokemonType] = (0, pokemon_data_1.getRandomPokemonConfigFrom)(allPokemon);
        return randomPokemonType;
    }
    // Normalize pool entries for case-insensitive matching
    const normalizedPool = pool.map((entry) => entry.toLowerCase().trim());
    const invalidPoolEntries = normalizedPool.filter((entry) => !allPokemon.includes(entry));
    if (invalidPoolEntries.length > 0) {
        console.warn(`Invalid pokemon type(s) in defaultPokemon pool: ${invalidPoolEntries.join(', ')}`);
    }
    const validPoolEntries = normalizedPool.filter((entry) => allPokemon.includes(entry));
    if (validPoolEntries.length === 0) {
        console.warn(`No valid pokemon in defaultPokemon pool, falling back to random selection from all pokemon`);
    }
    // Fall back to the full pokemon list if the pool was empty or fully invalid
    const candidateKeys = validPoolEntries.length > 0 ? validPoolEntries : allPokemon;
    const [randomPokemonType] = (0, pokemon_data_1.getRandomPokemonConfigFrom)(candidateKeys);
    return randomPokemonType;
}
function getConfiguredDefaultPokemon() {
    const defaultConfig = vscode.workspace
        .getConfiguration('vscode-pokemon')
        .get('defaultPokemon', []);
    const size = getConfiguredSize();
    const result = [];
    for (const config of defaultConfig) {
        // Validate that the pokemon type exists
        if (config.type !== 'random' && !pokemon_data_1.POKEMON_DATA[config.type]) {
            console.warn(`Invalid pokemon type in defaultPokemon config: ${config.type}`);
            continue;
        }
        const resolvedType = config.type === 'random'
            ? resolveRandomPokemonType(config.pool)
            : config.type;
        const name = config.name || (0, names_1.randomName)();
        /**
         * If shiny is not specified, default color to maybeMakeShiny with the
         * pokemon's available colors. If shiny is true, force shiny color. If
         * shiny is false, force default color.
         */
        let color;
        if (config.shiny === undefined) {
            color = maybeMakeShiny((0, pokemon_collection_1.availableColors)(resolvedType));
        }
        else if (config.shiny) {
            color = "shiny" /* PokemonColor.shiny */;
        }
        else {
            color = DEFAULT_COLOR;
        }
        result.push(new PokemonSpecification(color, resolvedType, size, name));
    }
    return result;
}
function getSessionPokemonCollection(context) {
    const savedCollection = PokemonSpecification.collectionFromMemento(context, getConfiguredSize());
    if (savedCollection.length > 0) {
        return savedCollection;
    }
    return getConfiguredDefaultPokemon();
}
function getDefaultPokemonForFreshSession(context) {
    return []; // LOCAL-PATCH: 기본 포켓몬은 패널이 'fresh-session' 을 보낼 때 소환 (여기서도 하면 두 번 나옴)
    const savedCollection = PokemonSpecification.collectionFromMemento(context, getConfiguredSize());
    if (savedCollection.length > 0) {
        return [];
    }
    return getConfiguredDefaultPokemon();
}
function shouldSpawnInitialCollection(collection) {
    return collection.length > 0;
}
exports.shouldSpawnInitialCollection = shouldSpawnInitialCollection;
async function spawnAndPersistCollection(context, panel, collection) {
    collection.forEach((item) => {
        panel.spawnPokemon(item);
    });
    await storeCollectionAsMemento(context, collection);
}
function updatePanelThrowWithMouse() {
    const panel = getPokemonPanel();
    if (panel !== undefined) {
        panel.setThrowWithMouse(getThrowWithMouseConfiguration());
    }
}
async function updateExtensionPositionContext() {
    await vscode.commands.executeCommand('setContext', 'vscode-pokemon.position', getConfigurationPosition());
}
class PokemonSpecification {
    color;
    type;
    size;
    name;
    generation;
    originalSpriteSize;
    constructor(color, type, size, name, generation) {
        this.color = color;
        this.type = type;
        this.size = size;
        if (!name) {
            this.name = (0, names_1.randomName)();
        }
        else {
            this.name = name;
        }
        this.generation = generation || `gen${pokemon_data_1.POKEMON_DATA[type].generation}`;
        this.originalSpriteSize = pokemon_data_1.POKEMON_DATA[type].originalSpriteSize || 32;
    }
    static fromConfiguration() {
        var color = vscode.workspace
            .getConfiguration('vscode-pokemon')
            .get('pokemonColor', DEFAULT_COLOR);
        if (types_1.ALL_COLORS.lastIndexOf(color) === -1) {
            color = DEFAULT_COLOR;
        }
        var type = vscode.workspace
            .getConfiguration('vscode-pokemon')
            .get('pokemonType', DEFAULT_POKEMON_TYPE);
        // Use POKEMON_DATA to validate the type
        if (!pokemon_data_1.POKEMON_DATA[type]) {
            type = DEFAULT_POKEMON_TYPE;
        }
        return new PokemonSpecification(color, type, getConfiguredSize());
    }
    static collectionFromMemento(context, size) {
        var contextTypes = context.globalState.get(EXTRA_POKEMON_KEY_TYPES, []);
        var contextColors = context.globalState.get(EXTRA_POKEMON_KEY_COLORS, []);
        var contextNames = context.globalState.get(EXTRA_POKEMON_KEY_NAMES, []);
        var result = [];
        for (let index = 0; index < contextTypes.length; index++) {
            result.push(new PokemonSpecification(contextColors?.[index] ?? DEFAULT_COLOR, contextTypes[index], size, contextNames[index]));
        }
        return result;
    }
}
exports.PokemonSpecification = PokemonSpecification;
async function storeCollectionAsMemento(context, collection) {
    var contextTypes = new Array(collection.length);
    var contextColors = new Array(collection.length);
    var contextNames = new Array(collection.length);
    for (let index = 0; index < collection.length; index++) {
        contextTypes[index] = collection[index].type;
        contextColors[index] = collection[index].color;
        contextNames[index] = collection[index].name;
    }
    await context.globalState.update(EXTRA_POKEMON_KEY_TYPES, contextTypes);
    await context.globalState.update(EXTRA_POKEMON_KEY_COLORS, contextColors);
    await context.globalState.update(EXTRA_POKEMON_KEY_NAMES, contextNames);
    context.globalState.setKeysForSync([
        EXTRA_POKEMON_KEY_TYPES,
        EXTRA_POKEMON_KEY_COLORS,
        EXTRA_POKEMON_KEY_NAMES,
    ]);
}
exports.storeCollectionAsMemento = storeCollectionAsMemento;
let spawnPokemonStatusBar;
function waitForPokemonList(webview) {
    return new Promise((resolve) => {
        const disposable = webview.onDidReceiveMessage((message) => {
            if (message.command !== 'list-pokemon') {
                return;
            }
            disposable.dispose();
            const pokemonList = [];
            message.text.split('\n').forEach((pokemon) => {
                if (!pokemon) {
                    return;
                }
                var parts = pokemon.split(',');
                pokemonList.push({
                    type: parts[0],
                    name: parts[1],
                    color: parts[2],
                });
            });
            resolve(pokemonList);
        });
    });
}
function getPokemonPanel() {
    if (getConfigurationPosition() === "explorer" /* ExtPosition.explorer */ &&
        webviewViewProvider) {
        return webviewViewProvider;
    }
    else if (PokemonPanel.currentPanel) {
        return PokemonPanel.currentPanel;
    }
    else {
        return undefined;
    }
}
function getWebview() {
    if (getConfigurationPosition() === "explorer" /* ExtPosition.explorer */ &&
        webviewViewProvider) {
        return webviewViewProvider.getWebview();
    }
    else if (PokemonPanel.currentPanel) {
        return PokemonPanel.currentPanel.getWebview();
    }
}
function activate(context) {
    // Reset the Pokemon translations cache at startup to load the correct language
    localize.resetPokemonTranslationsCache();
    context.subscriptions.push(vscode.commands.registerCommand('vscode-pokemon.start', async () => {
        if (getConfigurationPosition() === "explorer" /* ExtPosition.explorer */ &&
            webviewViewProvider) {
            await vscode.commands.executeCommand('pokemonView.focus');
        }
        else {
            const spec = PokemonSpecification.fromConfiguration();
            PokemonPanel.createOrShow(context.extensionUri, spec.color, spec.type, spec.size, spec.generation, spec.originalSpriteSize, getConfiguredTheme(), getConfiguredThemeKind(), getThrowWithMouseConfiguration());
            if (PokemonPanel.currentPanel) {
                const collection = getSessionPokemonCollection(context);
                await spawnAndPersistCollection(context, PokemonPanel.currentPanel, collection);
            }
        }
    }));
    spawnPokemonStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    spawnPokemonStatusBar.command = 'vscode-pokemon.spawn-pokemon';
    context.subscriptions.push(spawnPokemonStatusBar);
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateStatusBar));
    context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(updateStatusBar));
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateExtensionPositionContext));
    updateStatusBar();
    const spec = PokemonSpecification.fromConfiguration();
    webviewViewProvider = new PokemonWebviewViewProvider(context, context.extensionUri, spec.color, spec.type, spec.size, spec.generation, spec.originalSpriteSize, getConfiguredTheme(), getConfiguredThemeKind(), getThrowWithMouseConfiguration());
    updateExtensionPositionContext().catch((e) => {
        console.error(e);
    });
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(PokemonWebviewViewProvider.viewType, webviewViewProvider));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-pokemon.delete-pokemon', async () => {
        const panel = getPokemonPanel();
        if (panel === undefined) {
            await createPokemonPlayground(context);
            return;
        }
        const webview = getWebview();
        if (!webview) {
            return;
        }
        const listPromise = waitForPokemonList(webview);
        panel.listPokemon();
        const pokemonList = await listPromise;
        if (!pokemonList.length) {
            await vscode.window.showErrorMessage(koT('There are no pokemon to remove.'));
            return;
        }
        // LOCAL-PATCH: 맨 위에 "모두 지우기" — 한 번 더 묻고, 지운 뒤 알림의 [되돌리기]로 다시 불러옴
        const pokemon = await vscode.window.showQuickPick([
            { label: '$(trash) 포켓몬 모두 지우기', description: `${pokemonList.length}마리`, removeAll: true },
            { label: '', kind: vscode.QuickPickItemKind.Separator },
            ...pokemonList.map((val) => {
                return new PokemonQuickPickItem(val.name, val.type, val.color);
            }),
        ], {
            placeHolder: koT('Select the pokemon to remove.'),
        });
        if (pokemon?.removeAll) {
            const ok = await vscode.window.showWarningMessage(`포켓몬 ${pokemonList.length}마리를 모두 지울까요?`, { modal: true }, '모두 지우기');
            if (ok !== '모두 지우기') {
                return;
            }
            panel.resetPokemon();
            await storeCollectionAsMemento(context, []);
            const undo = await vscode.window.showInformationMessage(`포켓몬 ${pokemonList.length}마리를 지웠어요.`, '되돌리기');
            if (undo === '되돌리기') {
                const specs = pokemonList.map((item) => new PokemonSpecification(item.color, item.type, getConfiguredSize(), item.name));
                specs.forEach((spec) => getPokemonPanel()?.spawnPokemon(spec));
                await storeCollectionAsMemento(context, specs);
            }
            return;
        }
        if (pokemon) {
            panel.deletePokemon(pokemon.name);
            const collection = pokemonList
                .filter((item) => {
                return item.name !== pokemon.name;
            })
                .map((item) => {
                return new PokemonSpecification(item.color, item.type, "medium" /* PokemonSize.medium */, item.name);
            });
            await storeCollectionAsMemento(context, collection);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-pokemon.remove-all-pokemon', async () => {
        const panel = getPokemonPanel();
        if (panel !== undefined) {
            panel.resetPokemon();
            await storeCollectionAsMemento(context, []);
        }
        else {
            await createPokemonPlayground(context);
            await vscode.window.showInformationMessage(koT("A Pokemon Playground has been created. You can now use the 'Remove All Pokemon' Command to remove all Pokemon."));
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-pokemon.roll-call', async () => {
        const panel = getPokemonPanel();
        if (panel !== undefined) {
            panel.rollCall();
        }
        else {
            await createPokemonPlayground(context);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-pokemon.configure-keybindings', async () => {
        const items = [
            {
                label: koT('Spawn additional pokemon'),
                description: 'vscode-pokemon.spawn-pokemon',
                commandId: 'vscode-pokemon.spawn-pokemon',
            },
            {
                label: koT('Spawn random pokemon'),
                description: 'vscode-pokemon.spawn-random-pokemon',
                commandId: 'vscode-pokemon.spawn-random-pokemon',
            },
            {
                label: koT('Remove pokemon'),
                description: 'vscode-pokemon.delete-pokemon',
                commandId: 'vscode-pokemon.delete-pokemon',
            },
            {
                label: koT('Remove all pokemon'),
                description: 'vscode-pokemon.remove-all-pokemon',
                commandId: 'vscode-pokemon.remove-all-pokemon',
            },
        ];
        const picked = await vscode.window.showQuickPick(items, {
            placeHolder: koT('Select a command to configure its keybinding'),
            matchOnDescription: true,
        });
        if (!picked) {
            return;
        }
        await vscode.commands.executeCommand('workbench.action.openGlobalKeybindings', picked.commandId);
    }));
    // LOCAL-PATCH: ⚙ 설정 메뉴 — 기본 포켓몬 · 크기 · 배경 · 이름 언어 (패널 제목 줄 + 왼쪽)
    const SIZE_LABELS = { nano: '아주 작게', small: '작게', medium: '보통', large: '크게' };
    const THEME_LABELS = { none: '없음', forest: '숲', castle: '성', beach: '해변' };
    const LANGUAGE_LABELS = { ko: '한국어', auto: '한국어 (자동)', 'en-US': '영어', 'fr-FR': '프랑스어', 'de-DE': '독일어', 'ja-JP': '일본어' };
    const defaultName = (d) => (d.type === 'random' ? '무작위' : localize.getLocalizedPokemonName(d.type));
    // 기본 포켓몬이 바뀔 때마다 바로 전 목록을 10개까지 기억 — ↩ 되돌리기
    const DEFAULT_HISTORY_KEY = 'defaultPokemonHistory';
    async function defaultPokemonMenu() {
        const config = vscode.workspace.getConfiguration('vscode-pokemon');
        const list = config.get('defaultPokemon', []);
        const history = context.globalState.get(DEFAULT_HISTORY_KEY, []);
        const save = async (next) => {
            await context.globalState.update(DEFAULT_HISTORY_KEY, [...history, list].slice(-10));
            await config.update('defaultPokemon', next, vscode.ConfigurationTarget.Global);
        };
        const previous = history[history.length - 1];
        const summary = (l) => (l.length ? `${l.length}마리 — ${l.map(defaultName).join(', ')}` : '비어 있음');
        const pick = await vscode.window.showQuickPick([
            ...(previous ? [{ label: '$(discard) 되돌리기', description: `바로 전 목록으로 · ${summary(previous)}`, value: 'undo' }] : []),
            { label: '$(save) 지금 데리고 있는 포켓몬으로 저장', value: 'save' },
            { label: '$(add) 포켓몬 추가', value: 'add' },
            ...(list.length
                ? [
                    { label: '$(remove) 빼기', description: list.map(defaultName).join(', '), value: 'remove' },
                    { label: '$(play) 지금 패널에 불러오기', value: 'spawn' },
                    { label: '$(trash) 모두 비우기', value: 'clear' },
                ]
                : []),
        ], {
            placeHolder: list.length
                ? `기본 포켓몬 ${list.length}마리 — 패널이 빈 채로 시작할 때(새 작업 폴더 · 처음 켤 때) 나와요`
                : '기본 포켓몬이 없어요 — 패널이 빈 채로 시작할 때 나올 포켓몬을 정하세요',
        });
        if (!pick) {
            return;
        }
        if (pick.value === 'undo') {
            await context.globalState.update(DEFAULT_HISTORY_KEY, history.slice(0, -1));
            await config.update('defaultPokemon', previous, vscode.ConfigurationTarget.Global);
            await vscode.window.showInformationMessage(`기본 포켓몬을 되돌렸어요 (${summary(previous)}).`);
        }
        else if (pick.value === 'save') {
            const panel = getPokemonPanel();
            const webview = getWebview();
            if (!panel || !webview) {
                await vscode.window.showErrorMessage(koT('Panel not active, make sure the pokemon view is visible before running this command.'));
                return;
            }
            const listPromise = waitForPokemonList(webview);
            panel.listPokemon();
            const current = await listPromise;
            if (!current.length) {
                await vscode.window.showInformationMessage('패널에 포켓몬이 없어요.');
                return;
            }
            await save(current.map((p) => ({ type: p.type, name: p.name, shiny: p.color === 'shiny' })));
            await vscode.window.showInformationMessage(`기본 포켓몬으로 ${current.length}마리를 저장했어요.`);
        }
        else if (pick.value === 'add') {
            const options = Object.entries(pokemon_data_1.POKEMON_DATA).map(([type, data]) => ({
                label: localize.getLocalizedPokemonName(type),
                description: `#${data.id.toString().padStart(4, '0')} - ${data.generation}세대`,
                value: type,
            }));
            const chosen = await vscode.window.showQuickPick(options, { placeHolder: '추가할 포켓몬 — 이름으로 찾고 여러 마리 고르기', matchOnDescription: true, canPickMany: true });
            if (chosen?.length) {
                await save(list.concat(chosen.map((c) => ({ type: c.value }))));
            }
        }
        else if (pick.value === 'remove') {
            const chosen = await vscode.window.showQuickPick(list.map((d, i) => ({ label: defaultName(d), description: d.name ?? '', index: i })), { placeHolder: '뺄 포켓몬을 고르세요', canPickMany: true });
            if (chosen?.length) {
                const drop = new Set(chosen.map((c) => c.index));
                await save(list.filter((_, i) => !drop.has(i)));
            }
        }
        else if (pick.value === 'spawn') {
            const panel = getPokemonPanel();
            if (panel) {
                const specs = getConfiguredDefaultPokemon();
                specs.forEach((spec) => panel.spawnPokemon(spec));
                await storeCollectionAsMemento(context, PokemonSpecification.collectionFromMemento(context, getConfiguredSize()).concat(specs));
            }
        }
        else if (pick.value === 'clear') {
            const ok = await vscode.window.showWarningMessage(`기본 포켓몬 ${list.length}마리를 모두 비울까요? (되돌리기로 다시 살릴 수 있어요)`, { modal: true }, '비우기');
            if (ok === '비우기') {
                await save([]);
            }
        }
    }
    context.subscriptions.push(vscode.commands.registerCommand('vscode-pokemon.settings-menu', async () => {
        const config = vscode.workspace.getConfiguration('vscode-pokemon');
        const defaults = config.get('defaultPokemon', []);
        const size = getConfiguredSize();
        const theme = getConfiguredTheme();
        const language = config.get('pokemonLanguage', 'ko');
        const picked = await vscode.window.showQuickPick([
            { label: '$(star) 기본 포켓몬', description: defaults.length ? `${defaults.length}마리 — ${defaults.map(defaultName).join(', ')}` : '없음', detail: '패널이 빈 채로 시작할 때 자동으로 나와요', value: 'default' },
            { label: '$(zoom-in) 크기', description: SIZE_LABELS[size] ?? size, value: 'size' },
            { label: '$(symbol-color) 배경', description: THEME_LABELS[theme] ?? theme, value: 'theme' },
            { label: '$(globe) 이름 언어', description: LANGUAGE_LABELS[language] ?? language, value: 'language' },
        ], { placeHolder: '포켓몬 설정' });
        if (!picked) {
            return;
        }
        if (picked.value === 'default') {
            await defaultPokemonMenu();
        }
        else if (picked.value === 'size' || picked.value === 'theme') {
            const labels = picked.value === 'size' ? SIZE_LABELS : THEME_LABELS;
            const current = picked.value === 'size' ? size : theme;
            const chosen = await vscode.window.showQuickPick(Object.entries(labels).map(([value, label]) => ({ label, description: value === current ? '현재' : '', value })), { placeHolder: picked.value === 'size' ? '포켓몬 크기' : '배경' });
            if (chosen) {
                await config.update(picked.value === 'size' ? 'pokemonSize' : 'theme', chosen.value, vscode.ConfigurationTarget.Global);
            }
        }
        else if (picked.value === 'language') {
            await vscode.commands.executeCommand('vscode-pokemon.change-pokemon-language');
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-pokemon.change-pokemon-language', async () => {
        const config = vscode.workspace.getConfiguration('vscode-pokemon');
        const currentLanguage = config.get('pokemonLanguage', 'auto');
        // Language display names and flags (official Pokemon languages only)
        /* eslint-disable @typescript-eslint/naming-convention */
        const languageLabels = {
            auto: {
                label: '$(globe) Auto',
                description: koT('Use VS Code language'),
            },
            'en-US': {
                label: '🇺🇸 English (US)',
                description: koT('English names'),
            },
            'fr-FR': {
                label: '🇫🇷 Français (FR)',
                description: koT('French names'),
            },
            'de-DE': {
                label: '🇩🇪 Deutsch (DE)',
                description: koT('German names'),
            },
            'ja-JP': {
                label: '🇯🇵 日本語 (JP)',
                description: koT('Japanese names'),
            },
            ko: {
                label: '🇰🇷 한국어 (KO)',
                description: koT('Korean names'),
            },
        };
        /* eslint-enable @typescript-eslint/naming-convention */
        const languageOptions = [
            {
                label: languageLabels['auto'].label,
                description: languageLabels['auto'].description,
                detail: currentLanguage === 'auto'
                    ? koT('Current')
                    : undefined,
                value: 'auto',
            },
            ...localize.SUPPORTED_LOCALES.map((locale) => ({
                label: languageLabels[locale]?.label || locale,
                description: languageLabels[locale]?.description || locale,
                detail: currentLanguage === locale
                    ? koT('Current')
                    : undefined,
                value: locale,
            })),
        ];
        const picked = await vscode.window.showQuickPick(languageOptions, {
            placeHolder: koT('Select language for Pokemon names'),
        });
        if (!picked) {
            return;
        }
        // Update configuration persistently
        await config.update('pokemonLanguage', picked.value, vscode.ConfigurationTarget.Global);
        // Reset translation cache to force reload
        localize.resetPokemonTranslationsCache();
        // Preload translations with the new language
        // This ensures the cache is immediately available
        const testPokemon = 'bulbasaur';
        localize.getLocalizedPokemonName(testPokemon);
        await vscode.window.showInformationMessage(koT('Pokemon language changed to {0}. The change will persist after restart.', picked.label));
    }));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-pokemon.export-pokemon-list', async () => {
        const pokemonCollection = PokemonSpecification.collectionFromMemento(context, getConfiguredSize());
        const pokemonJson = JSON.stringify(pokemonCollection, null, 2);
        const fileName = `pokemonCollection-${Date.now()}.json`;
        if (!vscode.workspace.workspaceFolders) {
            await vscode.window.showErrorMessage(koT('You must have a folder or workspace open to export pokemonCollection.'));
            return;
        }
        const filePath = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, fileName);
        const newUri = vscode.Uri.file(fileName).with({
            scheme: 'untitled',
            path: filePath.fsPath,
        });
        await vscode.workspace.openTextDocument(newUri).then(async (doc) => {
            await vscode.window.showTextDocument(doc).then(async (editor) => {
                await editor.edit((edit) => {
                    edit.insert(new vscode.Position(0, 0), pokemonJson);
                });
            });
        });
    }));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-pokemon.import-pokemon-list', async () => {
        const options = {
            canSelectMany: false,
            openLabel: 'Open pokemonCollection.json',
            filters: {
                json: ['json'],
            },
        };
        const fileUri = await vscode.window.showOpenDialog(options);
        if (fileUri && fileUri[0]) {
            console.log('Selected file: ' + fileUri[0].fsPath);
            try {
                const fileContents = await vscode.workspace.fs.readFile(fileUri[0]);
                const pokemonToLoad = JSON.parse(String.fromCharCode.apply(null, Array.from(fileContents)));
                // load the pokemon into the collection
                var collection = PokemonSpecification.collectionFromMemento(context, getConfiguredSize());
                // fetch just the pokemon types
                const panel = getPokemonPanel();
                for (let i = 0; i < pokemonToLoad.length; i++) {
                    const pokemon = pokemonToLoad[i];
                    const pokemonSpec = new PokemonSpecification((0, pokemon_collection_1.normalizeColor)(pokemon.color, pokemon.type), pokemon.type, pokemon.size, pokemon.name);
                    collection.push(pokemonSpec);
                    if (panel !== undefined) {
                        panel.spawnPokemon(pokemonSpec);
                    }
                }
                await storeCollectionAsMemento(context, collection);
            }
            catch (e) {
                await vscode.window.showErrorMessage(koT('Failed to import pokemon: {0}', e?.message));
            }
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-pokemon.spawn-pokemon', async () => {
        const panel = getPokemonPanel();
        if (getConfigurationPosition() === "explorer" /* ExtPosition.explorer */ &&
            webviewViewProvider) {
            await vscode.commands.executeCommand('pokemonView.focus');
        }
        if (panel) {
            // Dynamic QuickPick: show only generations by default; reveal Pokémon matches when typing
            const generationItems = Object.values(types_1.PokemonGeneration)
                .filter((gen) => typeof gen === 'number')
                .map((gen) => ({
                label: `$(folder) ${koT('Generation {0}', gen)}`,
                description: koT('Browse Gen {0} Pokemon', gen),
                isGeneration: true,
                gen: gen,
            }));
            const allPokemonOptions = Object.entries(pokemon_data_1.POKEMON_DATA).map(([type, config]) => ({
                label: localize.getLocalizedPokemonName(type),
                value: type,
                description: `#${config.id.toString().padStart(4, '0')} - ${config.generation}세대`,
                isGeneration: false,
            }));
            const qp = vscode.window.createQuickPick();
            qp.placeholder = koT('Select a generation or start typing to search for a Pokemon...');
            qp.matchOnDescription = true;
            const setGenerationOnlyItems = () => {
                qp.items = [
                    {
                        label: koT('Generations'),
                        kind: vscode.QuickPickItemKind.Separator,
                    },
                    ...generationItems,
                ];
            };
            const setWithSearchResults = (query) => {
                const q = query.toLowerCase().trim();
                const results = allPokemonOptions.filter((opt) => opt.label.toLowerCase().includes(q) ||
                    (opt.description?.toLowerCase().includes(q) ?? false));
                qp.items = [
                    {
                        label: koT('Generations'),
                        kind: vscode.QuickPickItemKind.Separator,
                    },
                    ...generationItems,
                    {
                        label: koT('Results'),
                        kind: vscode.QuickPickItemKind.Separator,
                    },
                    ...results,
                ];
            };
            setGenerationOnlyItems();
            let selectedPokemonType;
            const disposables = [];
            disposables.push(qp.onDidChangeValue((val) => {
                if (val && val.trim().length > 0) {
                    setWithSearchResults(val);
                }
                else {
                    setGenerationOnlyItems();
                }
            }));
            disposables.push(qp.onDidAccept(async () => {
                const sel = qp.selectedItems[0];
                if (!sel) {
                    qp.hide();
                    return;
                }
                if (sel.isGeneration) {
                    // Don't hide the first quick pick yet - dispose it manually
                    const pokemonInGeneration = (0, pokemon_data_1.getPokemonByGeneration)(sel.gen);
                    const pokemonOptions = pokemonInGeneration.map((type) => ({
                        label: localize.getLocalizedPokemonName(type),
                        value: type,
                        description: `#${pokemon_data_1.POKEMON_DATA[type].id
                            .toString()
                            .padStart(4, '0')}`,
                    }));
                    // Manually dispose the first quick pick to prevent race condition
                    disposables.forEach((d) => d.dispose());
                    qp.dispose();
                    const picked = await vscode.window.showQuickPick(pokemonOptions, {
                        placeHolder: koT('Select a Pokemon'),
                    });
                    if (picked) {
                        selectedPokemonType = picked;
                        // Handle the rest of the flow
                        const possibleColors = (0, pokemon_collection_1.availableColors)(selectedPokemonType.value);
                        const name = await vscode.window.showInputBox({
                            placeHolder: koT('Leave blank for a random name'),
                            prompt: koT('Name your Pokemon'),
                            value: (0, names_1.randomName)(),
                        });
                        if (name === undefined) {
                            console.log('Cancelled Spawning Pokemon - No Name Entered');
                            return;
                        }
                        const spec = new PokemonSpecification(maybeMakeShiny(possibleColors), selectedPokemonType.value, getConfiguredSize(), name);
                        panel.spawnPokemon(spec);
                        var collection = PokemonSpecification.collectionFromMemento(context, getConfiguredSize());
                        collection.push(spec);
                        await storeCollectionAsMemento(context, collection);
                    }
                }
                else {
                    selectedPokemonType = sel;
                    qp.hide();
                }
            }));
            const closed = new Promise((resolve) => {
                disposables.push(qp.onDidHide(() => {
                    disposables.forEach((d) => d.dispose());
                    qp.dispose();
                    resolve();
                }));
            });
            qp.show();
            await closed;
            if (!selectedPokemonType) {
                console.log('Cancelled Spawning Pokemon - No Selection');
                return;
            }
            if (!selectedPokemonType) {
                console.log('Cancelled Spawning Pokemon - No Pokemon Selected');
                return;
            }
            // Rest of the existing code
            const possibleColors = (0, pokemon_collection_1.availableColors)(selectedPokemonType.value);
            const name = await vscode.window.showInputBox({
                placeHolder: koT('Leave blank for a random name'),
                prompt: koT('Name your Pokemon'),
                value: (0, names_1.randomName)(),
            });
            if (name === undefined) {
                console.log('Cancelled Spawning Pokemon - No Name Entered');
                return;
            }
            const spec = new PokemonSpecification(maybeMakeShiny(possibleColors), selectedPokemonType.value, getConfiguredSize(), name);
            panel.spawnPokemon(spec);
            var collection = PokemonSpecification.collectionFromMemento(context, getConfiguredSize());
            collection.push(spec);
            await storeCollectionAsMemento(context, collection);
        }
        else {
            await createPokemonPlayground(context);
            await vscode.window.showInformationMessage(koT("A Pokemon Playground has been created. You can now use the 'Spawn Additional Pokemon' Command to add more Pokemon."));
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('vscode-pokemon.spawn-random-pokemon', async () => {
        const panel = getPokemonPanel();
        if (getConfigurationPosition() === "explorer" /* ExtPosition.explorer */ &&
            webviewViewProvider) {
            await vscode.commands.executeCommand('pokemonView.focus');
        }
        if (panel) {
            var [randomPokemonType, randomPokemonConfig] = (0, pokemon_data_1.getRandomPokemonConfig)();
            const spec = new PokemonSpecification(maybeMakeShiny(randomPokemonConfig.possibleColors), randomPokemonType, getConfiguredSize(), randomPokemonConfig.name);
            panel.spawnPokemon(spec);
            var collection = PokemonSpecification.collectionFromMemento(context, getConfiguredSize());
            collection.push(spec);
            await storeCollectionAsMemento(context, collection);
        }
        else {
            await createPokemonPlayground(context);
            await vscode.window.showInformationMessage(koT("A Pokemon Playground has been created. You can now use the 'Remove All Pokemon' Command to remove all Pokemon."));
        }
    }));
    // Listening to configuration changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('vscode-pokemon.pokemonColor') ||
            e.affectsConfiguration('vscode-pokemon.pokemonType') ||
            e.affectsConfiguration('vscode-pokemon.pokemonSize') ||
            e.affectsConfiguration('vscode-pokemon.theme') ||
            e.affectsConfiguration('workbench.colorTheme')) {
            const spec = PokemonSpecification.fromConfiguration();
            const panel = getPokemonPanel();
            if (panel) {
                panel.updatePokemonColor(spec.color);
                panel.updatePokemonSize(spec.size);
                panel.updatePokemonType(spec.type);
                panel.updateTheme(getConfiguredTheme(), getConfiguredThemeKind());
                panel.update();
            }
        }
        if (e.affectsConfiguration('vscode-pokemon.position')) {
            void updateExtensionPositionContext();
        }
        if (e.affectsConfiguration('vscode-pokemon.throwBallWithMouse')) {
            updatePanelThrowWithMouse();
        }
        if (e.affectsConfiguration('vscode-pokemon.pokemonLanguage')) {
            // Reset the Pokemon translations cache when the language changes
            localize.resetPokemonTranslationsCache();
            // Update the panel to reflect the new language
            const panel = getPokemonPanel();
            if (panel) {
                panel.update();
            }
        }
    }));
    if (vscode.window.registerWebviewPanelSerializer) {
        // Make sure we register a serializer in activation event
        vscode.window.registerWebviewPanelSerializer(PokemonPanel.viewType, {
            async deserializeWebviewPanel(webviewPanel) {
                // Reset the webview options so we use latest uri for `localResourceRoots`.
                webviewPanel.webview.options = getWebviewOptions(context.extensionUri);
                const spec = PokemonSpecification.fromConfiguration();
                PokemonPanel.revive(webviewPanel, context.extensionUri, spec.color, spec.type, spec.size, spec.generation, spec.originalSpriteSize, getConfiguredTheme(), getConfiguredThemeKind(), getThrowWithMouseConfiguration());
                if (PokemonPanel.currentPanel) {
                    const collection = getDefaultPokemonForFreshSession(context);
                    if (shouldSpawnInitialCollection(collection)) {
                        await spawnAndPersistCollection(context, PokemonPanel.currentPanel, collection);
                    }
                }
            },
        });
    }
}
exports.activate = activate;
function updateStatusBar() {
    spawnPokemonStatusBar.text = `$(squirrel)`;
    spawnPokemonStatusBar.tooltip = koT('Spawn Pokemon');
    spawnPokemonStatusBar.show();
}
function spawnPokemonDeactivate() {
    spawnPokemonStatusBar.dispose();
}
exports.spawnPokemonDeactivate = spawnPokemonDeactivate;
function getWebviewOptions(extensionUri) {
    return {
        // Enable javascript in the webview
        enableScripts: true,
        // And restrict the webview to only loading content from our extension's `media` directory.
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
    };
}
class PokemonWebviewContainer {
    _extensionUri;
    _disposables = [];
    _pokemonColor;
    _pokemonType;
    _pokemonSize;
    _pokemonGeneration;
    _pokemonOriginalSpriteSize;
    _theme;
    _themeKind;
    _throwBallWithMouse;
    constructor(extensionUri, color, type, size, generation, originalSpriteSize, theme, themeKind, throwBallWithMouse) {
        this._extensionUri = extensionUri;
        this._pokemonColor = color;
        this._pokemonType = type;
        this._pokemonSize = size;
        this._pokemonGeneration = generation;
        this._pokemonOriginalSpriteSize = originalSpriteSize;
        this._theme = theme;
        this._themeKind = themeKind;
        this._throwBallWithMouse = throwBallWithMouse;
    }
    pokemonColor() {
        return (0, pokemon_collection_1.normalizeColor)(this._pokemonColor, this._pokemonType);
    }
    pokemonType() {
        return this._pokemonType;
    }
    pokemonSize() {
        return this._pokemonSize;
    }
    pokemonGeneration() {
        return this._pokemonGeneration;
    }
    pokemonOriginalSpriteSize() {
        return this._pokemonOriginalSpriteSize;
    }
    theme() {
        return this._theme;
    }
    themeKind() {
        return this._themeKind;
    }
    throwBallWithMouse() {
        return this._throwBallWithMouse;
    }
    updatePokemonColor(newColor) {
        this._pokemonColor = newColor;
    }
    updatePokemonType(newType) {
        this._pokemonType = newType;
    }
    updatePokemonSize(newSize) {
        this._pokemonSize = newSize;
    }
    updatePokemonGeneration(newGeneration) {
        this._pokemonGeneration = newGeneration;
    }
    updateTheme(newTheme, themeKind) {
        this._theme = newTheme;
        this._themeKind = themeKind;
    }
    setThrowWithMouse(newThrowWithMouse) {
        this._throwBallWithMouse = newThrowWithMouse;
        void this.getWebview().postMessage({
            command: 'throw-with-mouse',
            enabled: newThrowWithMouse,
        });
    }
    throwBall() {
        void this.getWebview().postMessage({
            command: 'throw-ball',
        });
    }
    resetPokemon() {
        void this.getWebview().postMessage({
            command: 'reset-pokemon',
        });
    }
    spawnPokemon(spec) {
        void this.getWebview().postMessage({
            command: 'spawn-pokemon',
            type: spec.type,
            color: spec.color,
            name: spec.name,
            generation: spec.generation,
            originalSpriteSize: spec.originalSpriteSize,
        });
        void this.getWebview().postMessage({
            command: 'set-size',
            size: spec.size,
        });
    }
    listPokemon() {
        void this.getWebview().postMessage({ command: 'list-pokemon' });
    }
    rollCall() {
        void this.getWebview().postMessage({ command: 'roll-call' });
    }
    deletePokemon(pokemonName) {
        void this.getWebview().postMessage({
            command: 'delete-pokemon',
            name: pokemonName,
        });
    }
    getWebview() {
        throw new Error('Not implemented');
    }
    _update() {
        const webview = this.getWebview();
        webview.html = this._getHtmlForWebview(webview);
    }
    // #TODO: verify if this is needed
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    update() { }
    _getHtmlForWebview(webview) {
        // Local path to main script run in the webview
        const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'media', 'main-bundle.js');
        // And the uri we use to load this script in the webview
        const scriptUri = webview.asWebviewUri(scriptPathOnDisk);
        // Local path to css styles
        const styleResetPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css');
        const stylesPathMainPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'pokemon.css');
        const silkScreenFontPath = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'Silkscreen-Regular.ttf'));
        // Uri to load styles into webview
        const stylesResetUri = webview.asWebviewUri(styleResetPath);
        const stylesMainUri = webview.asWebviewUri(stylesPathMainPath);
        // Get path to resource on disk
        const basePokemonUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media'));
        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();
        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';
                font-src ${webview.cspSource};">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${stylesResetUri}" rel="stylesheet" nonce="${nonce}">
				<link href="${stylesMainUri}" rel="stylesheet" nonce="${nonce}">
                <style nonce="${nonce}">
                @font-face {
                    font-family: 'silkscreen';
                    src: url('${silkScreenFontPath}') format('truetype');
                }
                </style>
				<title>VS Code Pokemon</title>
			</head>
			<body>
                <canvas id="pokemonCanvas"></canvas>
                <div id="pokemonContainer"></div>
                <div id="foreground"></div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
                <script nonce="${nonce}">
                    pokemonApp.pokemonPanelApp(
                        "${basePokemonUri}",
                        "${this.theme()}",
                        ${this.themeKind()},
                        "${this.pokemonColor()}",
                        "${this.pokemonSize()}",
                        "${this.pokemonType()}",
                        "${this.throwBallWithMouse()}",
                        "${this.pokemonGeneration()}",
                        "${this.pokemonOriginalSpriteSize()}",
                    );
                </script>
            </body>
			</html>`;
    }
}
function handleWebviewMessage(message) {
    switch (message.command) {
        case 'alert':
            void vscode.window.showErrorMessage(message.text);
            return;
        case 'info':
            void vscode.window.showInformationMessage(message.text);
            return;
        case 'fresh-session': {
            // LOCAL-PATCH: 패널이 빈 채로 시작 → 기본 포켓몬 소환
            const panel = getPokemonPanel();
            if (panel) {
                getConfiguredDefaultPokemon().forEach((spec) => panel.spawnPokemon(spec));
            }
            return;
        }
    }
}
/**
 * Manages pokemon coding webview panels
 */
class PokemonPanel extends PokemonWebviewContainer {
    /**
     * Track the currently panel. Only allow a single panel to exist at a time.
     */
    static currentPanel;
    static viewType = 'pokemonCoding';
    _panel;
    static createOrShow(extensionUri, pokemonColor, pokemonType, pokemonSize, pokemonGeneration, pokemonOriginalSpriteSize, theme, themeKind, throwBallWithMouse) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        // If we already have a panel, show it.
        if (PokemonPanel.currentPanel) {
            if (pokemonColor === PokemonPanel.currentPanel.pokemonColor() &&
                pokemonType === PokemonPanel.currentPanel.pokemonType() &&
                pokemonSize === PokemonPanel.currentPanel.pokemonSize() &&
                pokemonGeneration === PokemonPanel.currentPanel.pokemonGeneration()) {
                PokemonPanel.currentPanel._panel.reveal(column);
                return;
            }
            else {
                PokemonPanel.currentPanel.updatePokemonColor(pokemonColor);
                PokemonPanel.currentPanel.updatePokemonType(pokemonType);
                PokemonPanel.currentPanel.updatePokemonSize(pokemonSize);
                PokemonPanel.currentPanel.update();
            }
        }
        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(PokemonPanel.viewType, koT('Pokemon Panel'), vscode.ViewColumn.Two, getWebviewOptions(extensionUri));
        PokemonPanel.currentPanel = new PokemonPanel(panel, extensionUri, pokemonColor, pokemonType, pokemonSize, pokemonGeneration, pokemonOriginalSpriteSize, theme, themeKind, throwBallWithMouse);
    }
    resetPokemon() {
        void this.getWebview().postMessage({ command: 'reset-pokemon' });
    }
    listPokemon() {
        void this.getWebview().postMessage({ command: 'list-pokemon' });
    }
    rollCall() {
        void this.getWebview().postMessage({ command: 'roll-call' });
    }
    deletePokemon(pokemonName) {
        void this.getWebview().postMessage({
            command: 'delete-pokemon',
            name: pokemonName,
        });
    }
    static revive(panel, extensionUri, pokemonColor, pokemonType, pokemonSize, pokemonGeneration, pokemonOriginalSpriteSize, theme, themeKind, throwBallWithMouse) {
        PokemonPanel.currentPanel = new PokemonPanel(panel, extensionUri, pokemonColor, pokemonType, pokemonSize, pokemonGeneration, pokemonOriginalSpriteSize, theme, themeKind, throwBallWithMouse);
    }
    constructor(panel, extensionUri, color, type, size, generation, originalSpriteSize, theme, themeKind, throwBallWithMouse) {
        super(extensionUri, color, type, size, generation, originalSpriteSize, theme, themeKind, throwBallWithMouse);
        this._panel = panel;
        // Set the webview's initial html content
        this._update();
        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        // Update the content based on view changes
        this._panel.onDidChangeViewState(() => {
            this.update();
        }, null, this._disposables);
        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(handleWebviewMessage, null, this._disposables);
    }
    dispose() {
        PokemonPanel.currentPanel = undefined;
        // Clean up our resources
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
    update() {
        if (this._panel.visible) {
            this._update();
        }
    }
    getWebview() {
        return this._panel.webview;
    }
}
class PokemonWebviewViewProvider extends PokemonWebviewContainer {
    static viewType = 'pokemonView';
    _webviewView;
    _context;
    constructor(context, extensionUri, color, type, size, generation, originalSpriteSize, theme, themeKind, throwBallWithMouse) {
        super(extensionUri, color, type, size, generation, originalSpriteSize, theme, themeKind, throwBallWithMouse);
        this._context = context;
    }
    async resolveWebviewView(webviewView) {
        this._webviewView = webviewView;
        webviewView.webview.options = getWebviewOptions(this._extensionUri);
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(handleWebviewMessage, null, this._disposables);
        const collection = getDefaultPokemonForFreshSession(this._context);
        if (shouldSpawnInitialCollection(collection)) {
            await spawnAndPersistCollection(this._context, this, collection);
        }
    }
    update() {
        this._update();
    }
    getWebview() {
        if (this._webviewView === undefined) {
            throw new Error(koT('Panel not active, make sure the pokemon view is visible before running this command.'));
        }
        else {
            return this._webviewView.webview;
        }
    }
}
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
async function createPokemonPlayground(context) {
    const spec = PokemonSpecification.fromConfiguration();
    PokemonPanel.createOrShow(context.extensionUri, spec.color, spec.type, spec.size, spec.generation, spec.originalSpriteSize, getConfiguredTheme(), getConfiguredThemeKind(), getThrowWithMouseConfiguration());
    if (PokemonPanel.currentPanel) {
        var collection = PokemonSpecification.collectionFromMemento(context, getConfiguredSize());
        collection.forEach((item) => {
            PokemonPanel.currentPanel?.spawnPokemon(item);
        });
        await storeCollectionAsMemento(context, collection);
    }
    else {
        var collection = PokemonSpecification.collectionFromMemento(context, getConfiguredSize());
        collection.push(spec);
        await storeCollectionAsMemento(context, collection);
    }
}
//# sourceMappingURL=extension.js.map