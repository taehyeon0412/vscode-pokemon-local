"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLocalizedPokemonName = exports.stringListAsQuickPickItemList = exports.TranslatedQuickPickItem = exports.resetPokemonTranslationsCache = exports.SUPPORTED_LOCALES = void 0;
const fs = require("fs");
const path = require("path");
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
const pokemon_data_1 = require("./pokemon-data");
/**
 * Cache for loaded Pokemon translations
 * Key: locale (e.g., 'fr-FR'), Value: translations map (pokemon key -> translated name)
 */
let pokemonTranslationsCache = {};
/**
 * Supported Pokemon translation locales
 * These correspond to the folders in l10n/pokemon/
 */
exports.SUPPORTED_LOCALES = ['ko', 'en-US', 'fr-FR', 'de-DE', 'ja-JP'];
const GENERATIONS = ['gen1', 'gen2', 'gen3', 'gen4', 'gen5'];
/* POKEMON-EXTRA-PATCH */ GENERATIONS.push('gen6'); /* /POKEMON-EXTRA-PATCH */
const FALLBACK_LOCALE = 'en-US';
/**
 * Resets the Pokemon translations cache
 * Useful when the language configuration changes
 */
function resetPokemonTranslationsCache() {
    pokemonTranslationsCache = {};
}
exports.resetPokemonTranslationsCache = resetPokemonTranslationsCache;
/**
 * Gets the configured locale for Pokemon names
 * Uses vscode-pokemon.pokemonLanguage configuration if set,
 * otherwise falls back to VS Code's language
 * @returns The locale string (e.g., 'fr-FR', 'en-US')
 */
function getPokemonLocale() {
    const config = vscode.workspace.getConfiguration('vscode-pokemon');
    const configuredLocale = config.get('pokemonLanguage', 'auto');
    // If a specific language is configured and different from 'auto'
    if (configuredLocale && configuredLocale !== 'auto') {
        return configuredLocale.toLowerCase().replace(/_/g, '-');
    }
    // Default: use VS Code's language
    return 'ko'; // LOCAL-PATCH: 자동이어도 무조건 한국어 이름
}
/**
 * Gets the extension path, with caching
 */
function getExtensionPath() {
    const extension = vscode.extensions.getExtension('local.vscode-pokemon');
    return extension?.extensionPath;
}
/**
 * Resolves the path to Pokemon translation files for a given locale
 */
function resolvePokemonL10nPath(locale) {
    const extensionPath = getExtensionPath();
    const basePath = extensionPath
        ? path.join(extensionPath, 'l10n', 'pokemon')
        : path.join(__dirname, '../../l10n/pokemon');
    const localePath = path.join(basePath, locale);
    if (fs.existsSync(localePath)) {
        return localePath;
    }
    // Fallback to en-US
    const fallbackPath = path.join(basePath, FALLBACK_LOCALE);
    return fs.existsSync(fallbackPath) ? fallbackPath : undefined;
}
/**
 * Loads Pokemon translations from generation files (gen1.json, gen2.json, gen3.json)
 * Translations are stored in l10n/pokemon/{locale}/gen*.json
 *
 * Note: English names are the default source of truth defined in
 * src/common/pokemon-generations/gen*.ts files. Translation files are optional
 * and missing translations will fall back to English names.
 *
 * @param locale The locale to load (e.g., 'fr-FR', 'en-US'). Uses configured locale if not provided
 * @returns Map of Pokemon keys to translated names
 */
function loadPokemonTranslations(locale) {
    // Use provided locale or get from configuration
    const targetLocale = locale || getPokemonLocale();
    // Return cached translations if available
    if (pokemonTranslationsCache[targetLocale]) {
        return pokemonTranslationsCache[targetLocale];
    }
    // Initialize cache for this locale
    const cache = {};
    pokemonTranslationsCache[targetLocale] = cache;
    try {
        const pokemonL10nPath = resolvePokemonL10nPath(targetLocale);
        if (!pokemonL10nPath) {
            console.warn(`[Pokemon Translations] Directory not found for locale: ${targetLocale}`);
            return cache;
        }
        let totalLoaded = 0;
        for (const gen of GENERATIONS) {
            const genFile = path.join(pokemonL10nPath, `${gen}.json`);
            if (!fs.existsSync(genFile)) {
                continue;
            }
            try {
                const genData = JSON.parse(fs.readFileSync(genFile, 'utf8'));
                Object.assign(cache, genData);
                totalLoaded += Object.keys(genData).length;
            }
            catch (error) {
                console.warn(`[Pokemon Translations] Error loading ${genFile}:`, error);
            }
        }
        if (totalLoaded > 0) {
            console.log(`[Pokemon Translations] Loaded ${totalLoaded} translations from ${pokemonL10nPath}`);
        }
        else {
            console.warn(`[Pokemon Translations] No translations found in ${pokemonL10nPath}`);
        }
    }
    catch (error) {
        console.error('[Pokemon Translations] Error loading translations:', error);
    }
    return cache;
}
class TranslatedQuickPickItem {
    label;
    value;
    constructor(label, value) {
        this.label = label;
        this.value = value;
    }
}
exports.TranslatedQuickPickItem = TranslatedQuickPickItem;
function stringListAsQuickPickItemList(collection) {
    return collection.map((el) => {
        return { label: koT(String(el)), value: el };
    });
}
exports.stringListAsQuickPickItemList = stringListAsQuickPickItemList;
/**
 * Gets the localized name of a Pokemon.
 * Loads translations from l10n/pokemon/{locale}/gen*.json files.
 * Falls back to the English name from POKEMON_DATA if no translation is available.
 *
 * @param pokemonType The Pokemon type (e.g., 'pikachu', 'charizard')
 * @returns The localized Pokemon name, or English name if translation not found
 */
function getLocalizedPokemonName(pokemonType) {
    const translations = loadPokemonTranslations();
    return (translations[pokemonType] || pokemon_data_1.POKEMON_DATA[pokemonType]?.name || pokemonType);
}
exports.getLocalizedPokemonName = getLocalizedPokemonName;
//# sourceMappingURL=localize.js.map