/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/common/names.ts":
/*!*****************************!*\
  !*** ./src/common/names.ts ***!
  \*****************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.randomName = void 0;
const pokemon_1 = __webpack_require__(/*! ../panel/pokemon */ "./src/panel/pokemon.ts");
function randomName() {
    const collection = pokemon_1.POKEMON_NAMES;
    return collection[Math.floor(Math.random() * collection.length)] ?? 'Unknown';
}
exports.randomName = randomName;


/***/ }),

/***/ "./src/common/pokemon-data.ts":
/*!************************************!*\
  !*** ./src/common/pokemon-data.ts ***!
  \************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getRandomPokemonConfig = exports.getRandomPokemonConfigFrom = exports.getDefaultPokemon = exports.getPokemonByGeneration = exports.getAllPokemon = exports.POKEMON_DATA = void 0;
/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/naming-convention */
const types_1 = __webpack_require__(/*! ./types */ "./src/common/types.ts");
const POKEMON_DATA_RAW = {
    // Generation 1
    bulbasaur: {
        id: 1,
        name: 'Bulbasaur',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Bulbasaur!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    ivysaur: {
        id: 2,
        name: 'Ivysaur',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Ivysaur!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    venusaur: {
        id: 3,
        name: 'Venusaur',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Venusaur!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    venusaur_female: {
        id: 3,
        name: 'Venusaur (Female)',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Venusaur!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    charmander: {
        id: 4,
        name: 'Charmander',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Charmander!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    charmeleon: {
        id: 5,
        name: 'Charmeleon',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Charmeleon!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    charizard: {
        id: 6,
        name: 'Charizard',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Charizard!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    squirtle: {
        id: 7,
        name: 'Squirtle',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Squritle!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    wartortle: {
        id: 8,
        name: 'Wartortle',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Wartortle!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    blastoise: {
        id: 9,
        name: 'Blastoise',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Blastoise!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    caterpie: {
        id: 10,
        name: 'Caterpie',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Caterpie!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    metapod: {
        id: 11,
        name: 'Metapod',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Metapod!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    butterfree: {
        id: 12,
        name: 'Butterfree',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Butterfree!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    weedle: {
        id: 13,
        name: 'Weedle',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Weedle!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    kakuna: {
        id: 14,
        name: 'Kakuna',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Kakuna!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    beedrill: {
        id: 15,
        name: 'Beedrill',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Beedrill!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    pidgey: {
        id: 16,
        name: 'Pidgey',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Pidgey!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    pidgeotto: {
        id: 17,
        name: 'Pidgeotto',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Pidgeotto!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    pidgeot: {
        id: 18,
        name: 'Pidgeot',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Pidgeot!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    rattata: {
        id: 19,
        name: 'Rattata',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Rattata!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    raticate: {
        id: 20,
        name: 'Raticate',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Raticate!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    spearow: {
        id: 21,
        name: 'Spearow',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Spearow!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    fearow: {
        id: 22,
        name: 'Fearow',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Fearow!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    ekans: {
        id: 23,
        name: 'Ekans',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Ekans!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    arbok: {
        id: 24,
        name: 'Arbok',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Arbok!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    pikachu: {
        id: 25,
        name: 'Pikachu',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Pikachu!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    pikachu_female: {
        id: 25,
        name: 'Pikachu (Female)',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Pikachu!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    raichu: {
        id: 26,
        name: 'Raichu',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Raichu!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    sandshrew: {
        id: 27,
        name: 'Sandshrew',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Sandshrew!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    sandslash: {
        id: 28,
        name: 'Sandslash',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Sandslash!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    nidoran_female: {
        id: 29,
        name: 'Nidoran♀',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Nidoran!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    nidorina: {
        id: 30,
        name: 'Nidorina',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Nidorina!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    nidoqueen: {
        id: 31,
        name: 'Nidoqueen',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Nidoqueen!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    nidoran_male: {
        id: 32,
        name: 'Nidoran♂',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Nidoran!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    nidorino: {
        id: 33,
        name: 'Nidorino',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Nidorino!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    nidoking: {
        id: 34,
        name: 'Nidoking',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Nidoking!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    clefairy: {
        id: 35,
        name: 'Clefairy',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Clefairy!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    clefable: {
        id: 36,
        name: 'Clefable',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Clefable!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    vulpix: {
        id: 37,
        name: 'Vulpix',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Vulpix!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    ninetales: {
        id: 38,
        name: 'Ninetales',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Ninetales!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    jigglypuff: {
        id: 39,
        name: 'Jigglypuff',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Jigglypuff!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    wigglytuff: {
        id: 40,
        name: 'Wigglytuff',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Wigglytuff!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    zubat: {
        id: 41,
        name: 'Zubat',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Zubat!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    golbat: {
        id: 42,
        name: 'Golbat',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Golbat!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    oddish: {
        id: 43,
        name: 'Oddish',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Oddish!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    gloom: {
        id: 44,
        name: 'Gloom',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Gloom!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    vileplume: {
        id: 45,
        name: 'Vileplume',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Vileplume!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    paras: {
        id: 46,
        name: 'Paras',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Paras!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    parasect: {
        id: 47,
        name: 'Parasect',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Parasect!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    venonat: {
        id: 48,
        name: 'Venonat',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Venonat!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    venomoth: {
        id: 49,
        name: 'Venomoth',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Venomoth!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    diglett: {
        id: 50,
        name: 'Diglett',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Diglett!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    dugtrio: {
        id: 51,
        name: 'Dugtrio',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Dugtrio!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    meowth: {
        id: 52,
        name: 'Meowth',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Meowth!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    persian: {
        id: 53,
        name: 'Persian',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Persian!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    psyduck: {
        id: 54,
        name: 'Psyduck',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Psyduck!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    golduck: {
        id: 55,
        name: 'Golduck',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Golduck!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    mankey: {
        id: 56,
        name: 'Mankey',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Mankey!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    primeape: {
        id: 57,
        name: 'Primeape',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Primeape!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    growlithe: {
        id: 58,
        name: 'Growlithe',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Growlithe!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    arcanine: {
        id: 59,
        name: 'Arcanine',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Arcanine!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    poliwag: {
        id: 60,
        name: 'Poliwag',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Poliwag!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    poliwhirl: {
        id: 61,
        name: 'Poliwhirl',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Poliwhirl!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    poliwrath: {
        id: 62,
        name: 'Poliwrath',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Poliwrath!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    abra: {
        id: 63,
        name: 'Abra',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Abra!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    kadabra: {
        id: 64,
        name: 'Kadabra',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Kadabra!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    alakazam: {
        id: 65,
        name: 'Alakazam',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Alakazam!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    machop: {
        id: 66,
        name: 'Machop',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Machop!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    machoke: {
        id: 67,
        name: 'Machoke',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Machoke!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    machamp: {
        id: 68,
        name: 'Machamp',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Alakazam!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    bellsprout: {
        id: 69,
        name: 'Bellsprout',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Bellsprout!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    weepinbell: {
        id: 70,
        name: 'Weepinbell',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Weepinbell!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    victreebel: {
        id: 71,
        name: 'Victreebel',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Victreebel!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    tentacool: {
        id: 72,
        name: 'Tentacool',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Tentacool!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    tentacruel: {
        id: 73,
        name: 'Tentacruel',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Tentacruel!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    geodude: {
        id: 74,
        name: 'Geodude',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Geodude!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    graveler: {
        id: 75,
        name: 'Graveler',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Graveler!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    golem: {
        id: 76,
        name: 'Golem',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Golem!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    ponyta: {
        id: 77,
        name: 'Ponyta',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Ponyta!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    rapidash: {
        id: 78,
        name: 'Rapidash',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Rapidash!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    slowpoke: {
        id: 79,
        name: 'Slowpoke',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Slowpoke!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    slowbro: {
        id: 80,
        name: 'Slowbro',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Slowbro!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    magnemite: {
        id: 81,
        name: 'Magnemite',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Magnemite!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    magneton: {
        id: 82,
        name: 'Magneton',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Magneton!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    farfetchd: {
        id: 83,
        name: "Farfetch'd",
        generation: types_1.PokemonGeneration.Gen1,
        cry: "Farfetch'd!",
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    doduo: {
        id: 84,
        name: 'Doduo',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Doduo!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    dodrio: {
        id: 85,
        name: 'Dodrio',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Dodrio!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    seel: {
        id: 86,
        name: 'Seel',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Seel!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    dewgong: {
        id: 87,
        name: 'Dewgong',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Dewgong!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    grimer: {
        id: 88,
        name: 'Grimer',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Grimer!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    muk: {
        id: 89,
        name: 'Muk',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Muk!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    shellder: {
        id: 90,
        name: 'Shellder',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Shellder!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    cloyster: {
        id: 91,
        name: 'Cloyster',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Cloyster!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    gastly: {
        id: 92,
        name: 'Gastly',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Gastly!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    haunter: {
        id: 93,
        name: 'Haunter',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Haunter!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    gengar: {
        id: 94,
        name: 'Gengar',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Gengar!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    onix: {
        id: 95,
        name: 'Onix',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Onix!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    drowzee: {
        id: 96,
        name: 'Drowzee',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Drowzee!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    hypno: {
        id: 97,
        name: 'Hypno',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Hypno!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    krabby: {
        id: 98,
        name: 'Krabby',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Krabby!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    kingler: {
        id: 99,
        name: 'Kingler',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Kingler!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    voltorb: {
        id: 100,
        name: 'Voltorb',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Voltorb!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    electrode: {
        id: 101,
        name: 'Electrode',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Electrode!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    exeggcute: {
        id: 102,
        name: 'Exeggcute',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Exeggcute!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    exeggutor: {
        id: 103,
        name: 'Exeggutor',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Exeggutor!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    cubone: {
        id: 104,
        name: 'Cubone',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Cubone!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    marowak: {
        id: 105,
        name: 'Marowak',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Marowak!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    hitmonlee: {
        id: 106,
        name: 'Hitmonlee',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Hitmonlee!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    hitmonchan: {
        id: 107,
        name: 'Hitmonchan',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Hitmonchan!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    lickitung: {
        id: 108,
        name: 'Lickitung',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Lickitung!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    koffing: {
        id: 109,
        name: 'Koffing',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Koffing!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    weezing: {
        id: 110,
        name: 'Weezing',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Weezing!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    rhyhorn: {
        id: 111,
        name: 'Rhyhorn',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Rhyhorn!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    rhydon: {
        id: 112,
        name: 'Rhydon',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Rhydon!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    chansey: {
        id: 113,
        name: 'Chansey',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Chansey!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    tangela: {
        id: 114,
        name: 'Tangela',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Tangela!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    kangaskhan: {
        id: 115,
        name: 'Kangaskhan',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Kangaskhan!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    horsea: {
        id: 116,
        name: 'Horsea',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Horsea!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    seadra: {
        id: 117,
        name: 'Seadra',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Seadra!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    goldeen: {
        id: 118,
        name: 'Goldeen',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Goldeen!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    seaking: {
        id: 119,
        name: 'Seaking',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Seaking!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    staryu: {
        id: 120,
        name: 'Staryu',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Staryu!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    starmie: {
        id: 121,
        name: 'Starmie',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Starmie!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    mrmime: {
        id: 122,
        name: 'Mr. Mime',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Mr. Mime!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    scyther: {
        id: 123,
        name: 'Scyther',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Scyther!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    jynx: {
        id: 124,
        name: 'Jynx',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Jynx!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    electabuzz: {
        id: 125,
        name: 'Electabuzz',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Electabuzz!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    magmar: {
        id: 126,
        name: 'Magmar',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Magmar!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    pinsir: {
        id: 127,
        name: 'Pinsir',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Pinsir!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    tauros: {
        id: 128,
        name: 'Tauros',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Tauros!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    magikarp: {
        id: 129,
        name: 'Magikarp',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Magikarp!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    gyarados: {
        id: 130,
        name: 'Gyarados',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Gyarados!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    lapras: {
        id: 131,
        name: 'Lapras',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Lapras!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    ditto: {
        id: 132,
        name: 'Ditto',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Ditto!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    eevee: {
        id: 133,
        name: 'Eevee',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Eevee!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    vaporeon: {
        id: 134,
        name: 'Vaporeon',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Vaporeon!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    jolteon: {
        id: 135,
        name: 'Jolteon',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Jolteon!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    flareon: {
        id: 136,
        name: 'Flareon',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Flareon!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    porygon: {
        id: 137,
        name: 'Porygon',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Porygon!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    omanyte: {
        id: 138,
        name: 'Omanyte',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Omanyte!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    omastar: {
        id: 139,
        name: 'Omastar',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Omastar!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    kabuto: {
        id: 140,
        name: 'Kabuto',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Kabuto!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    kabutops: {
        id: 141,
        name: 'Kabutops',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Kabutops!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    aerodactyl: {
        id: 142,
        name: 'Aerodactyl',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Aerodactyl!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    snorlax: {
        id: 143,
        name: 'Snorlax',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Snorlax!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    articuno: {
        id: 144,
        name: 'Articuno',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Articuno!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    zapdos: {
        id: 145,
        name: 'Zapdos',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Zapdos!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    moltres: {
        id: 146,
        name: 'Moltres',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Moltres!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    dratini: {
        id: 147,
        name: 'Dratini',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Dratini!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    dragonair: {
        id: 148,
        name: 'Dragonair',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Dragonair!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    dragonite: {
        id: 149,
        name: 'Dragonite',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Dragonite!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    mewtwo: {
        id: 150,
        name: 'Mewtwo',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Mewtwo!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    mew: {
        id: 151,
        name: 'Mew',
        generation: types_1.PokemonGeneration.Gen1,
        cry: 'Mew!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    // Generation 2
    chikorita: {
        id: 152,
        name: 'Chikorita',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Chikorita!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    bayleef: {
        id: 153,
        name: 'Bayleef',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Bayleef!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    meganium: {
        id: 154,
        name: 'Meganium',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Meganium!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    meganium_female: {
        id: 154,
        name: 'Meganium (Female)',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Meganium!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    cyndaquil: {
        id: 155,
        name: 'Cyndaquil',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Cyndaquil!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    quilava: {
        id: 156,
        name: 'Quilava',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Quilava!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    typhlosion: {
        id: 157,
        name: 'Typhlosion',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Typhlosion!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    totodile: {
        id: 158,
        name: 'Totodile',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Totodile!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    croconaw: {
        id: 159,
        name: 'Croconaw',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Croconaw!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    feraligatr: {
        id: 160,
        name: 'Feraligatr',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Feraligatr!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    sentret: {
        id: 161,
        name: 'Sentret',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Sentret!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    furret: {
        id: 162,
        name: 'Furret',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Furret!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    hoothoot: {
        id: 163,
        name: 'Hoothoot',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Hoothoot!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    noctowl: {
        id: 164,
        name: 'Noctowl',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Noctowl!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    ledyba: {
        id: 165,
        name: 'Ledyba',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Ledyba!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    ledian: {
        id: 166,
        name: 'Ledian',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Ledian!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    spinarak: {
        id: 167,
        name: 'Spinarak',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Spinarak!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    ariados: {
        id: 168,
        name: 'Ariados',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Ariados!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    crobat: {
        id: 169,
        name: 'Crobat',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Crobat!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    chinchou: {
        id: 170,
        name: 'Chinchou',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Chinchou!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    lanturn: {
        id: 171,
        name: 'Lanturn',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Lanturn!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    pichu: {
        id: 172,
        name: 'Pichu',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Pichu!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    pichu_spiky_eared: {
        id: 172,
        name: 'Pichu (Spiky-eared)',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Pichu!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    cleffa: {
        id: 173,
        name: 'Cleffa',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Cleffa!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    igglybuff: {
        id: 174,
        name: 'Igglybuff',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Igglybuff!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    togepi: {
        id: 175,
        name: 'Togepi',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Togepi!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    togetic: {
        id: 176,
        name: 'Togetic',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Togetic!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    natu: {
        id: 177,
        name: 'Natu',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Natu!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    xatu: {
        id: 178,
        name: 'Xatu',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Xatu!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    mareep: {
        id: 179,
        name: 'Mareep',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Mareep!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    flaaffy: {
        id: 180,
        name: 'Flaaffy',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Flaaffy!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    ampharos: {
        id: 181,
        name: 'Ampharos',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Ampharos!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    bellossom: {
        id: 182,
        name: 'Bellossom',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Bellossom!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    marill: {
        id: 183,
        name: 'Marill',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Marill!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    azumarill: {
        id: 184,
        name: 'Azumarill',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Azumarill!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    sudowoodo: {
        id: 185,
        name: 'Sudowoodo',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Sudowoodo!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    politoed: {
        id: 186,
        name: 'Politoed',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Politoed!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    hoppip: {
        id: 187,
        name: 'Hoppip',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Hoppip!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    skiploom: {
        id: 188,
        name: 'Skiploom',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Skiploom!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    jumpluff: {
        id: 189,
        name: 'Jumpluff',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Jumpluff!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    aipom: {
        id: 190,
        name: 'Aipom',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Aipom!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    sunkern: {
        id: 191,
        name: 'Sunkern',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Sunkern!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    sunflora: {
        id: 192,
        name: 'Sunflora',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Sunflora!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    yanma: {
        id: 193,
        name: 'Yanma',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Yanma!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    wooper: {
        id: 194,
        name: 'Wooper',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Wooper!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    quagsire: {
        id: 195,
        name: 'Quagsire',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Quagsire!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    espeon: {
        id: 196,
        name: 'Espeon',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Espeon!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    umbreon: {
        id: 197,
        name: 'Umbreon',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Umbreon!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    murkrow: {
        id: 198,
        name: 'Murkrow',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Murkrow!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    slowking: {
        id: 199,
        name: 'Slowking',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Slowking!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    misdreavus: {
        id: 200,
        name: 'Misdreavus',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Misdreavus!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    unown_a: {
        id: 201,
        name: 'Unown A',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Unown!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    unown_b: {
        id: 201,
        name: 'Unown B',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Unown!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    unown_c: {
        id: 201,
        name: 'Unown C',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Unown!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    unown_d: {
        id: 201,
        name: 'Unown D',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Unown!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    unown_e: {
        id: 201,
        name: 'Unown E',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Unown!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    unown_f: {
        id: 201,
        name: 'Unown F',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Unown!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    unown_g: {
        id: 201,
        name: 'Unown G',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Unown!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    unown_h: {
        id: 201,
        name: 'Unown H',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Unown!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    unown_i: {
        id: 201,
        name: 'Unown I',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Unown!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    unown_j: {
        id: 201,
        name: 'Unown J',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Unown!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    unown_k: {
        id: 201,
        name: 'Unown K',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Unown!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    unown_l: {
        id: 201,
        name: 'Unown L',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Unown!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    unown_m: {
        id: 201,
        name: 'Unown M',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Unown!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    unown_n: {
        id: 201,
        name: 'Unown N',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Unown!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    unown_o: {
        id: 201,
        name: 'Unown O',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Unown!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    unown_p: {
        id: 201,
        name: 'Unown P',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Unown!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    unown_q: {
        id: 201,
        name: 'Unown Q',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Unown!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    unown_r: {
        id: 201,
        name: 'Unown R',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Unown!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    unown_s: {
        id: 201,
        name: 'Unown S',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Unown!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    unown_t: {
        id: 201,
        name: 'Unown T',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Unown!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    unown_u: {
        id: 201,
        name: 'Unown U',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Unown!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    unown_v: {
        id: 201,
        name: 'Unown V',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Unown!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    unown_w: {
        id: 201,
        name: 'Unown W',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Unown!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    unown_x: {
        id: 201,
        name: 'Unown X',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Unown!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    unown_y: {
        id: 201,
        name: 'Unown Y',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Unown!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    unown_z: {
        id: 201,
        name: 'Unown Z',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Unown!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    unown_exclamation: {
        id: 201,
        name: 'Unown !',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Unown!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    unown_question: {
        id: 201,
        name: 'Unown ?',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Unown!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    wobbuffet_male: {
        id: 202,
        name: 'Wobbuffet (Male)',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Wobbuffet!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    wobbuffet_female: {
        id: 202,
        name: 'Wobbuffet (Female)',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Wobbuffet!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    girafarig: {
        id: 203,
        name: 'Girafarig',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Girafarig!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    pineco: {
        id: 204,
        name: 'Pineco',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Pineco!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    forretress: {
        id: 205,
        name: 'Forretress',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Forretress!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    dunsparce: {
        id: 206,
        name: 'Dunsparce',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Dunsparce!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    gligar: {
        id: 207,
        name: 'Gligar',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Gligar!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    steelix: {
        id: 208,
        name: 'Steelix',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Steelix!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        originalSpriteSize: 64,
    },
    steelix_female: {
        id: 208,
        name: 'Steelix (Female)',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Steelix!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        originalSpriteSize: 64,
    },
    snubbull: {
        id: 209,
        name: 'Snubbull',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Snubbull!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    granbull: {
        id: 210,
        name: 'Granbull',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Granbull!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    qwilfish: {
        id: 211,
        name: 'Qwilfish',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Qwilfish!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    scizor: {
        id: 212,
        name: 'Scizor',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Scizor!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    shuckle: {
        id: 213,
        name: 'Shuckle',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Shuckle!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    heracross_male: {
        id: 214,
        name: 'Heracross (Male)',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Heracross!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    heracross_female: {
        id: 214,
        name: 'Heracross (Female)',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Heracross!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    sneasel: {
        id: 215,
        name: 'Sneasel',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Sneasel!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    teddiursa: {
        id: 216,
        name: 'Teddiursa',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Teddiursa!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    ursaring: {
        id: 217,
        name: 'Ursaring',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Ursaring!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    slugma: {
        id: 218,
        name: 'Slugma',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Slugma!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    magcargo: {
        id: 219,
        name: 'Magcargo',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Magcargo!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    swinub: {
        id: 220,
        name: 'Swinub',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Swinub!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    piloswine: {
        id: 221,
        name: 'Piloswine',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Piloswine!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    corsola: {
        id: 222,
        name: 'Corsola',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Corsola!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    remoraid: {
        id: 223,
        name: 'Remoraid',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Remoraid!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    octillery: {
        id: 224,
        name: 'Octillery',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Octillery!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    delibird: {
        id: 225,
        name: 'Delibird',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Delibird!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    mantine: {
        id: 226,
        name: 'Mantine',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Mantine!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    skarmory: {
        id: 227,
        name: 'Skarmory',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Skarmory!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    houndour: {
        id: 228,
        name: 'Houndour',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Houndour!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    houndoom: {
        id: 229,
        name: 'Houndoom',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Houndoom!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    kingdra: {
        id: 230,
        name: 'Kingdra',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Kingdra!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    phanpy: {
        id: 231,
        name: 'Phanpy',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Phanpy!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    donphan: {
        id: 232,
        name: 'Donphan',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Donphan!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    porygon2: {
        id: 233,
        name: 'Porygon2',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Porygon2!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    stantler: {
        id: 234,
        name: 'Stantler',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Stantler!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    smeargle: {
        id: 235,
        name: 'Smeargle',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Smeargle!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    tyrogue: {
        id: 236,
        name: 'Tyrogue',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Tyrogue!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    hitmontop: {
        id: 237,
        name: 'Hitmontop',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Hitmontop!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    smoochum: {
        id: 238,
        name: 'Smoochum',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Smoochum!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    elekid: {
        id: 239,
        name: 'Elekid',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Elekid!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    magby: {
        id: 240,
        name: 'Magby',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Magby!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    miltank: {
        id: 241,
        name: 'Miltank',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Miltank!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    blissey: {
        id: 242,
        name: 'Blissey',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Blissey!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    raikou: {
        id: 243,
        name: 'Raikou',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Raikou!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    entei: {
        id: 244,
        name: 'Entei',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Entei!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    suicune: {
        id: 245,
        name: 'Suicune',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Suicune!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    larvitar: {
        id: 246,
        name: 'Larvitar',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Larvitar!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    pupitar: {
        id: 247,
        name: 'Pupitar',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Pupitar!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    tyranitar: {
        id: 248,
        name: 'Tyranitar',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Tyranitar!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    lugia: {
        id: 249,
        name: 'Lugia',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Lugia!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        originalSpriteSize: 64,
    },
    hooh: {
        id: 250,
        name: 'Ho-Oh',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Ho-Oh!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        originalSpriteSize: 64,
    },
    celebi: {
        id: 251,
        name: 'Celebi',
        generation: types_1.PokemonGeneration.Gen2,
        cry: 'Celebi!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    // Generation 3
    treecko: {
        id: 252,
        name: 'Treecko',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Treecko!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    grovyle: {
        id: 253,
        name: 'Grovyle',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Grovyle!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    sceptile: {
        id: 254,
        name: 'Sceptile',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Sceptile!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    torchic: {
        id: 255,
        name: 'Torchic',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Torchic!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    combusken: {
        id: 256,
        name: 'Combusken',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Combusken!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    blaziken: {
        id: 257,
        name: 'Blaziken',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Blaziken!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    mudkip: {
        id: 258,
        name: 'Mudkip',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Mudkip!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    marshtomp: {
        id: 259,
        name: 'Marshtomp',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Marshtomp!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    swampert: {
        id: 260,
        name: 'Swampert',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Swampert!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    poochyena: {
        id: 261,
        name: 'Poochyena',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Poochyena!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    mightyena: {
        id: 262,
        name: 'Mightyena',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Mightyena!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    zigzagoon: {
        id: 263,
        name: 'Zigzagoon',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Zigzagoon!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    linoone: {
        id: 264,
        name: 'Linoone',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Linoone!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    wurmple: {
        id: 265,
        name: 'Wurmple',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Wurmple!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    silcoon: {
        id: 266,
        name: 'Silcoon',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Silcoon!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    beautifly: {
        id: 267,
        name: 'Beautifly',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Beautifly!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    cascoon: {
        id: 268,
        name: 'Cascoon',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Cascoon!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    dustox: {
        id: 269,
        name: 'Dustox',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Dustox!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    lotad: {
        id: 270,
        name: 'Lotad',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Lotad!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    lombre: {
        id: 271,
        name: 'Lombre',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Lombre!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    ludicolo: {
        id: 272,
        name: 'Ludicolo',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Ludicolo!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    seedot: {
        id: 273,
        name: 'Seedot',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Seedot!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    nuzleaf: {
        id: 274,
        name: 'Nuzleaf',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Nuzleaf!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    shiftry: {
        id: 275,
        name: 'Shiftry',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Shiftry!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    taillow: {
        id: 276,
        name: 'Taillow',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Taillow!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    swellow: {
        id: 277,
        name: 'Swellow',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Swellow!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    wingull: {
        id: 278,
        name: 'Wingull',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Wingull!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    pelipper: {
        id: 279,
        name: 'Pelipper',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Pelipper!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    ralts: {
        id: 280,
        name: 'Ralts',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Ralts!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    kirlia: {
        id: 281,
        name: 'Kirlia',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Kirlia!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    gardevoir: {
        id: 282,
        name: 'Gardevoir',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Gardevoir!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    surskit: {
        id: 283,
        name: 'Surskit',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Surskit!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    masquerain: {
        id: 284,
        name: 'Masquerain',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Masquerain!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    shroomish: {
        id: 285,
        name: 'Shroomish',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Shroomish!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    breloom: {
        id: 286,
        name: 'Breloom',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Breloom!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    slakoth: {
        id: 287,
        name: 'Slakoth',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Slakoth!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    vigoroth: {
        id: 288,
        name: 'Vigoroth',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Vigoroth!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    slaking: {
        id: 289,
        name: 'Slaking',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Slaking!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    nincada: {
        id: 290,
        name: 'Nincada',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Nincada!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    ninjask: {
        id: 291,
        name: 'Ninjask',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Ninjask!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    shedinja: {
        id: 292,
        name: 'Shedinja',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Shedinja!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    whismur: {
        id: 293,
        name: 'Whismur',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Whismur!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    loudred: {
        id: 294,
        name: 'Loudred',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Loudred!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    exploud: {
        id: 295,
        name: 'Exploud',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Exploud!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    makuhita: {
        id: 296,
        name: 'Makuhita',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Makuhita!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    hariyama: {
        id: 297,
        name: 'Hariyama',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Hariyama!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    azurill: {
        id: 298,
        name: 'Azurill',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Azurill!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    nosepass: {
        id: 299,
        name: 'Nosepass',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Nosepass!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    skitty: {
        id: 300,
        name: 'Skitty',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Skitty!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    delcatty: {
        id: 301,
        name: 'Delcatty',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Delcatty!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    sableye: {
        id: 302,
        name: 'Sableye',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Sableye!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    mawile: {
        id: 303,
        name: 'Mawile',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Mawile!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    aron: {
        id: 304,
        name: 'Aron',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Aron!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    lairon: {
        id: 305,
        name: 'Lairon',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Lairon!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    aggron: {
        id: 306,
        name: 'Aggron',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Aggron!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    meditite: {
        id: 307,
        name: 'Meditite',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Meditite!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    medicham: {
        id: 308,
        name: 'Medicham',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Medicham!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    electrike: {
        id: 309,
        name: 'Electrike',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Electrike!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    manectric: {
        id: 310,
        name: 'Manectric',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Manectric!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    plusle: {
        id: 311,
        name: 'Plusle',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Plusle!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    minun: {
        id: 312,
        name: 'Minun',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Minun!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    volbeat: {
        id: 313,
        name: 'Volbeat',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Volbeat!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    illumise: {
        id: 314,
        name: 'Illumise',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Illumise!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    roselia: {
        id: 315,
        name: 'Roselia',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Roselia!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    gulpin: {
        id: 316,
        name: 'Gulpin',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Gulpin!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    swalot: {
        id: 317,
        name: 'Swalot',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Swalot!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    carvanha: {
        id: 318,
        name: 'Carvanha',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Carvanha!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    sharpedo: {
        id: 319,
        name: 'Sharpedo',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Sharpedo!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    wailmer: {
        id: 320,
        name: 'Wailmer',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Wailmer!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    wailord: {
        id: 321,
        name: 'Wailord',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Wailord!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        originalSpriteSize: 64,
    },
    numel: {
        id: 322,
        name: 'Numel',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Numel!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    camerupt: {
        id: 323,
        name: 'Camerupt',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Camerupt!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    torkoal: {
        id: 324,
        name: 'Torkoal',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Torkoal!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    spoink: {
        id: 325,
        name: 'Spoink',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Spoink!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    grumpig: {
        id: 326,
        name: 'Grumpig',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Grumpig!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    spinda: {
        id: 327,
        name: 'Spinda',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Spinda!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    trapinch: {
        id: 328,
        name: 'Trapinch',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Trapinch!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    vibrava: {
        id: 329,
        name: 'Vibrava',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Vibrava!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    flygon: {
        id: 330,
        name: 'Flygon',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Flygon!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    cacnea: {
        id: 331,
        name: 'Cacnea',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Cacnea!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    cacturne: {
        id: 332,
        name: 'Cacturne',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Cacturne!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    swablu: {
        id: 333,
        name: 'Swablu',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Swablu!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    altaria: {
        id: 334,
        name: 'Altaria',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Altaria!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    zangoose: {
        id: 335,
        name: 'Zangoose',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Zangoose!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    seviper: {
        id: 336,
        name: 'Seviper',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Seviper!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    lunatone: {
        id: 337,
        name: 'Lunatone',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Lunatone!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    solrock: {
        id: 338,
        name: 'Solrock',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Solrock!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    barboach: {
        id: 339,
        name: 'Barboach',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Barboach!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    whiscash: {
        id: 340,
        name: 'Whiscash',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Whiscash!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    corphish: {
        id: 341,
        name: 'Corphish',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Corphish!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    crawdaunt: {
        id: 342,
        name: 'Crawdaunt',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Crawdaunt!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    baltoy: {
        id: 343,
        name: 'Baltoy',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Baltoy!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    claydol: {
        id: 344,
        name: 'Claydol',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Claydol!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    lileep: {
        id: 345,
        name: 'Lileep',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Lileep!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    cradily: {
        id: 346,
        name: 'Cradily',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Cradily!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    anorith: {
        id: 347,
        name: 'Anorith',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Anorith!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    armaldo: {
        id: 348,
        name: 'Armaldo',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Armaldo!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    feebas: {
        id: 349,
        name: 'Feebas',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Feebas!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    milotic: {
        id: 350,
        name: 'Milotic',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Milotic!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    castform: {
        id: 351,
        name: 'Castform',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Castform!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    kecleon: {
        id: 352,
        name: 'Kecleon',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Kecleon!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    shuppet: {
        id: 353,
        name: 'Shuppet',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Shuppet!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    banette: {
        id: 354,
        name: 'Banette',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Banette!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    duskull: {
        id: 355,
        name: 'Duskull',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Duskull!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    dusclops: {
        id: 356,
        name: 'Dusclops',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Dusclops!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    tropius: {
        id: 357,
        name: 'Tropius',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Tropius!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    chimecho: {
        id: 358,
        name: 'Chimecho',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Chimecho!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    absol: {
        id: 359,
        name: 'Absol',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Absol!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    wynaut: {
        id: 360,
        name: 'Wynaut',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Wynaut!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    snorunt: {
        id: 361,
        name: 'Snorunt',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Snorunt!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    glalie: {
        id: 362,
        name: 'Glalie',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Glalie!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    spheal: {
        id: 363,
        name: 'Spheal',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Spheal!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    sealeo: {
        id: 364,
        name: 'Sealeo',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Sealeo!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    walrein: {
        id: 365,
        name: 'Walrein',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Walrein!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    clamperl: {
        id: 366,
        name: 'Clamperl',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Clamperl!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    huntail: {
        id: 367,
        name: 'Huntail',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Huntail!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    gorebyss: {
        id: 368,
        name: 'Gorebyss',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Gorebyss!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    relicanth: {
        id: 369,
        name: 'Relicanth',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Relicanth!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    luvdisc: {
        id: 370,
        name: 'Luvdisc',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Luvdisc!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    bagon: {
        id: 371,
        name: 'Bagon',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Bagon!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    shelgon: {
        id: 372,
        name: 'Shelgon',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Shelgon!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    salamence: {
        id: 373,
        name: 'Salamence',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Salamence!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    beldum: {
        id: 374,
        name: 'Beldum',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Beldum!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    metang: {
        id: 375,
        name: 'Metang',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Metang!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    metagross: {
        id: 376,
        name: 'Metagross',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Metagross!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    regirock: {
        id: 377,
        name: 'Regirock',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Regirock!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    regice: {
        id: 378,
        name: 'Regice',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Regice!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    registeel: {
        id: 379,
        name: 'Registeel',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Registeel!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    latias: {
        id: 380,
        name: 'Latias',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Latias!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    latios: {
        id: 381,
        name: 'Latios',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Latios!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    kyogre: {
        id: 382,
        name: 'Kyogre',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Kyogre!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        originalSpriteSize: 64,
    },
    groudon: {
        id: 383,
        name: 'Groudon',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Groudon!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        originalSpriteSize: 64,
    },
    rayquaza: {
        id: 384,
        name: 'Rayquaza',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Rayquaza!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        originalSpriteSize: 64,
    },
    jirachi: {
        id: 385,
        name: 'Jirachi',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Jirachi!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    deoxys: {
        id: 386,
        name: 'Deoxys',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Deoxys!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        extraSprites: ["left_facing" /* PokemonExtraSprite.leftFacing */],
    },
    deoxys_speed: {
        id: 386,
        name: 'Deoxys (Speed)',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Deoxys!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        extraSprites: ["left_facing" /* PokemonExtraSprite.leftFacing */],
    },
    deoxys_attack: {
        id: 386,
        name: 'Deoxys (Attack)',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Deoxys!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        extraSprites: ["left_facing" /* PokemonExtraSprite.leftFacing */],
    },
    deoxys_defense: {
        id: 386,
        name: 'Deoxys (Defense)',
        generation: types_1.PokemonGeneration.Gen3,
        cry: 'Deoxys!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    // Generation 4
    turtwig: {
        id: 387,
        name: 'Turtwig',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Turtwig!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    grotle: {
        id: 388,
        name: 'Grotle',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Grotle!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    torterra: {
        id: 389,
        name: 'Torterra',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Torterra!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        extraSprites: ["left_facing" /* PokemonExtraSprite.leftFacing */],
    },
    chimchar: {
        id: 390,
        name: 'Chimchar',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Chimchar!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    monferno: {
        id: 391,
        name: 'Monferno',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Monferno!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    infernape: {
        id: 392,
        name: 'Infernape',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Infernape!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    piplup: {
        id: 393,
        name: 'Piplup',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Piplup!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    prinplup: {
        id: 394,
        name: 'Prinplup',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Prinplup!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    empoleon: {
        id: 395,
        name: 'Empoleon',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Empoleon!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    starly: {
        id: 396,
        name: 'Starly',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Starly!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    staravia: {
        id: 397,
        name: 'Staravia',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Staravia!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    staraptor: {
        id: 398,
        name: 'Staraptor',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Staraptor!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    bidoof: {
        id: 399,
        name: 'Bidoof',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Bidoof!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    bibarel: {
        id: 400,
        name: 'Bibarel',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Bibarel!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    kricketot: {
        id: 401,
        name: 'Kricketot',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Kricketot!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        extraSprites: ["left_facing" /* PokemonExtraSprite.leftFacing */],
    },
    kricketune: {
        id: 402,
        name: 'Kricketune',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Kricketune!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        extraSprites: ["left_facing" /* PokemonExtraSprite.leftFacing */],
    },
    shinx: {
        id: 403,
        name: 'Shinx',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Shinx!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    luxio: {
        id: 404,
        name: 'Luxio',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Luxio!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    luxray: {
        id: 405,
        name: 'Luxray',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Luxray!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    budew: {
        id: 406,
        name: 'Budew',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Budew!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    roserade: {
        id: 407,
        name: 'Roserade',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Roserade!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        extraSprites: ["left_facing" /* PokemonExtraSprite.leftFacing */],
    },
    cranidos: {
        id: 408,
        name: 'Cranidos',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Cranidos!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    rampardos: {
        id: 409,
        name: 'Rampardos',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Rampardos!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    shieldon: {
        id: 410,
        name: 'Shieldon',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Shieldon!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    bastiodon: {
        id: 411,
        name: 'Bastiodon',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Bastiodon!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    burmy_plant: {
        id: 412,
        name: 'Burmy (Plant)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Burmy!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    burmy_sandy: {
        id: 412,
        name: 'Burmy (Sandy)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Burmy!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    burmy_trash: {
        id: 412,
        name: 'Burmy (Trash)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Burmy!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    wormadam_plant: {
        id: 413,
        name: 'Wormadam (Plant)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Wormadam!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    wormadam_sandy: {
        id: 413,
        name: 'Wormadam (Sandy)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Wormadam!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    wormadam_trash: {
        id: 413,
        name: 'Wormadam (Trash)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Wormadam!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    mothim: {
        id: 414,
        name: 'Mothim',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Mothim!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    combee_male: {
        id: 415,
        name: 'Combee (Male)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Combee!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    combee_female: {
        id: 415,
        name: 'Combee (Female)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Combee!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    vespiquen: {
        id: 416,
        name: 'Vespiquen',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Vespiquen!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    pachirisu: {
        id: 417,
        name: 'Pachirisu',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Pachirisu!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    buizel: {
        id: 418,
        name: 'Buizel',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Buizel!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    floatzel: {
        id: 419,
        name: 'Floatzel',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Floatzel!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    cherubi: {
        id: 420,
        name: 'Cherubi',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Cherubi!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    cherrim: {
        id: 421,
        name: 'Cherrim',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Cherrim!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    shellos_west: {
        id: 422,
        name: 'Shellos (West)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Shellos!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    shellos_east: {
        id: 422,
        name: 'Shellos (East)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Shellos!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    gastrodon_west: {
        id: 423,
        name: 'Gastrodon (West)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Gastrodon!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    gastrodon_east: {
        id: 423,
        name: 'Gastrodon (East)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Gastrodon!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    ambipom: {
        id: 424,
        name: 'Ambipom',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Ambipom!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        extraSprites: ["left_facing" /* PokemonExtraSprite.leftFacing */],
    },
    drifloon: {
        id: 425,
        name: 'Drifloon',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Drifloon!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    drifblim: {
        id: 426,
        name: 'Drifblim',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Drifblim!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    buneary: {
        id: 427,
        name: 'Buneary',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Buneary!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        extraSprites: ["left_facing" /* PokemonExtraSprite.leftFacing */],
    },
    lopunny: {
        id: 428,
        name: 'Lopunny',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Lopunny!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    mismagius: {
        id: 429,
        name: 'Mismagius',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Mismagius!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    honchkrow: {
        id: 430,
        name: 'Honchkrow',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Honchkrow!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    glameow: {
        id: 431,
        name: 'Glameow',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Glameow!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    purugly: {
        id: 432,
        name: 'Purugly',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Purugly!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    chingling: {
        id: 433,
        name: 'Chingling',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Chingling!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    stunky: {
        id: 434,
        name: 'Stunky',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Stunky!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    skuntank: {
        id: 435,
        name: 'Skuntank',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Skuntank!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    bronzor: {
        id: 436,
        name: 'Bronzor',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Bronzor!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    bronzong: {
        id: 437,
        name: 'Bronzong',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Bronzong!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    bonsly: {
        id: 438,
        name: 'Bonsly',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Bonsly!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    mimeJr: {
        id: 439,
        name: 'Mime Jr.',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Mime Jr.!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    happiny: {
        id: 440,
        name: 'Happiny',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Happiny!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    chatot: {
        id: 441,
        name: 'Chatot',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Chatot!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    spiritomb: {
        id: 442,
        name: 'Spiritomb',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Spiritomb!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    gible: {
        id: 443,
        name: 'Gible',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Gible!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        extraSprites: ["left_facing" /* PokemonExtraSprite.leftFacing */],
    },
    gible_female: {
        id: 443,
        name: 'Gible (Female)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Gible!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        extraSprites: ["left_facing" /* PokemonExtraSprite.leftFacing */],
    },
    gabite: {
        id: 444,
        name: 'Gabite',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Gabite!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    gabite_female: {
        id: 444,
        name: 'Gabite (Female)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Gabite!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    garchomp: {
        id: 445,
        name: 'Garchomp',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Garchomp!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        extraSprites: ["left_facing" /* PokemonExtraSprite.leftFacing */],
    },
    garchomp_female: {
        id: 445,
        name: 'Garchomp (Female)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Garchomp!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        extraSprites: ["left_facing" /* PokemonExtraSprite.leftFacing */],
    },
    munchlax: {
        id: 446,
        name: 'Munchlax',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Munchlax!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    riolu: {
        id: 447,
        name: 'Riolu',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Riolu!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        extraSprites: ["left_facing" /* PokemonExtraSprite.leftFacing */],
    },
    lucario: {
        id: 448,
        name: 'Lucario',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Lucario!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    hippopotas_male: {
        id: 449,
        name: 'Hippopotas (Male)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Hippopotas!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    hippopotas_female: {
        id: 449,
        name: 'Hippopotas (Female)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Hippopotas!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    hippowdon_male: {
        id: 450,
        name: 'Hippowdon (Male)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Hippowdon!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    hippowdon_female: {
        id: 450,
        name: 'Hippowdon (Female)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Hippowdon!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    skorupi: {
        id: 451,
        name: 'Skorupi',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Skorupi!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    drapion: {
        id: 452,
        name: 'Drapion',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Drapion!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    croagunk: {
        id: 453,
        name: 'Croagunk',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Croagunk!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    toxicroak: {
        id: 454,
        name: 'Toxicroak',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Toxicroak!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    carnivine: {
        id: 455,
        name: 'Carnivine',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Carnivine!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    finneon: {
        id: 456,
        name: 'Finneon',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Finneon!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    lumineon: {
        id: 457,
        name: 'Lumineon',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Lumineon!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    mantyke: {
        id: 458,
        name: 'Mantyke',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Mantyke!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    snover: {
        id: 459,
        name: 'Snover',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Snover!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    abomasnow: {
        id: 460,
        name: 'Abomasnow',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Abomasnow!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    weavile: {
        id: 461,
        name: 'Weavile',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Weavile!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    magnezone: {
        id: 462,
        name: 'Magnezone',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Magnezone!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    lickilicky: {
        id: 463,
        name: 'Lickilicky',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Lickilicky!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    rhyperior: {
        id: 464,
        name: 'Rhyperior',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Rhyperior!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    tangrowth: {
        id: 465,
        name: 'Tangrowth',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Tangrowth!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    electivire: {
        id: 466,
        name: 'Electivire',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Electivire!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    magmortar: {
        id: 467,
        name: 'Magmortar',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Magmortar!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    togekiss: {
        id: 468,
        name: 'Togekiss',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Togekiss!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        extraSprites: ["left_facing" /* PokemonExtraSprite.leftFacing */],
    },
    yanmega: {
        id: 469,
        name: 'Yanmega',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Yanmega!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    leafeon: {
        id: 470,
        name: 'Leafeon',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Leafeon!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    glaceon: {
        id: 471,
        name: 'Glaceon',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Glaceon!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    gliscor: {
        id: 472,
        name: 'Gliscor',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Gliscor!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    mamoswine: {
        id: 473,
        name: 'Mamoswine',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Mamoswine!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    porygonZ: {
        id: 474,
        name: 'Porygon-Z',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Porygon-Z!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    gallade: {
        id: 475,
        name: 'Gallade',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Gallade!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    probopass: {
        id: 476,
        name: 'Probopass',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Probopass!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    dusknoir: {
        id: 477,
        name: 'Dusknoir',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Dusknoir!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    froslass: {
        id: 478,
        name: 'Froslass',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Froslass!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    rotom: {
        id: 479,
        name: 'Rotom',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Rotom!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    rotom_heat: {
        id: 479,
        name: 'Rotom (Heat Form)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Rotom!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    rotom_wash: {
        id: 479,
        name: 'Rotom (Wash Form)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Rotom!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        extraSprites: ["left_facing" /* PokemonExtraSprite.leftFacing */],
    },
    rotom_frost: {
        id: 479,
        name: 'Rotom (Frost Form)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Rotom!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    rotom_fan: {
        id: 479,
        name: 'Rotom (Fan Form)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Rotom!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    rotom_mow: {
        id: 479,
        name: 'Rotom (Mow Form)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Rotom!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    uxie: {
        id: 480,
        name: 'Uxie',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Uxie!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    mesprit: {
        id: 481,
        name: 'Mesprit',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Mesprit!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    azelf: {
        id: 482,
        name: 'Azelf',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Azelf!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    dialga: {
        id: 483,
        name: 'Dialga',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Dialga!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        originalSpriteSize: 64,
    },
    palkia: {
        id: 484,
        name: 'Palkia',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Palkia!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        originalSpriteSize: 64,
    },
    heatran: {
        id: 485,
        name: 'Heatran',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Heatran!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    regigigas: {
        id: 486,
        name: 'Regigigas',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Regigigas!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        originalSpriteSize: 64,
    },
    giratina: {
        id: 487,
        name: 'Giratina',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Giratina!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        originalSpriteSize: 64,
    },
    giratina_origin: {
        id: 487,
        name: 'Giratina (Origin Form)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Giratina!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        originalSpriteSize: 64,
    },
    cresselia: {
        id: 488,
        name: 'Cresselia',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Cresselia!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    phione: {
        id: 489,
        name: 'Phione',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Phione!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    manaphy: {
        id: 490,
        name: 'Manaphy',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Manaphy!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    darkrai: {
        id: 491,
        name: 'Darkrai',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Darkrai!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    shaymin: {
        id: 492,
        name: 'Shaymin',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Shaymin!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    shaymin_sky: {
        id: 492,
        name: 'Shaymin (Sky Form)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Shaymin!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        extraSprites: ["left_facing" /* PokemonExtraSprite.leftFacing */],
    },
    arceus: {
        id: 493,
        name: 'Arceus',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Arceus!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        originalSpriteSize: 64,
    },
    arceus_bug: {
        id: 493,
        name: 'Arceus (Bug)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Arceus!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
    },
    arceus_dark: {
        id: 493,
        name: 'Arceus (Dark)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Arceus!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        originalSpriteSize: 64,
    },
    arceus_dragon: {
        id: 493,
        name: 'Arceus (Dragon)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Arceus!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        originalSpriteSize: 64,
    },
    arceus_electric: {
        id: 493,
        name: 'Arceus (Electric)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Arceus!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        originalSpriteSize: 64,
    },
    arceus_fighting: {
        id: 493,
        name: 'Arceus (Fighting)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Arceus!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        originalSpriteSize: 64,
    },
    arceus_fire: {
        id: 493,
        name: 'Arceus (Fire)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Arceus!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        originalSpriteSize: 64,
    },
    arceus_flying: {
        id: 493,
        name: 'Arceus (Flying)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Arceus!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        originalSpriteSize: 64,
    },
    arceus_ghost: {
        id: 493,
        name: 'Arceus (Ghost)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Arceus!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        originalSpriteSize: 64,
    },
    arceus_grass: {
        id: 493,
        name: 'Arceus (Grass)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Arceus!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        originalSpriteSize: 64,
    },
    arceus_ground: {
        id: 493,
        name: 'Arceus (Ground)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Arceus!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        originalSpriteSize: 64,
    },
    arceus_ice: {
        id: 493,
        name: 'Arceus (Ice)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Arceus!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        originalSpriteSize: 64,
    },
    arceus_poison: {
        id: 493,
        name: 'Arceus (Poison)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Arceus!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        originalSpriteSize: 64,
    },
    arceus_psychic: {
        id: 493,
        name: 'Arceus (Psychic)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Arceus!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        originalSpriteSize: 64,
    },
    arceus_rock: {
        id: 493,
        name: 'Arceus (Rock)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Arceus!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        originalSpriteSize: 64,
    },
    arceus_steel: {
        id: 493,
        name: 'Arceus (Steel)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Arceus!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        originalSpriteSize: 64,
    },
    arceus_water: {
        id: 493,
        name: 'Arceus (Water)',
        generation: types_1.PokemonGeneration.Gen4,
        cry: 'Arceus!',
        possibleColors: ["default" /* PokemonColor.default */, "shiny" /* PokemonColor.shiny */],
        originalSpriteSize: 64,
    },
    /* Generation 5 */
    victini: {
        id: 494,
        name: 'Victini',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Victini!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    snivy: {
        id: 495,
        name: 'Snivy',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Snivy!',
        possibleColors: [],
    },
    servine: {
        id: 496,
        name: 'Servine',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Servine!',
        possibleColors: [],
    },
    serperior: {
        id: 497,
        name: 'Serperior',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Serperior!',
        possibleColors: [],
    },
    tepig: {
        id: 498,
        name: 'Tepig',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Tepig!',
        possibleColors: [],
    },
    pignite: {
        id: 499,
        name: 'Pignite',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Pignite!',
        possibleColors: [],
    },
    emboar: {
        id: 500,
        name: 'Emboar',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Emboar!',
        possibleColors: [],
    },
    oshawott: {
        id: 501,
        name: 'Oshawott',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Oshawott!',
        possibleColors: [],
    },
    dewott: {
        id: 502,
        name: 'Dewott',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Dewott!',
        possibleColors: [],
    },
    samurott: {
        id: 503,
        name: 'Samurott',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Samurott!',
        possibleColors: [],
    },
    patrat: {
        id: 504,
        name: 'Patrat',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Patrat!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    watchog: {
        id: 505,
        name: 'Watchog',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Watchog!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    lillipup: {
        id: 506,
        name: 'Lillipup',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Lillipup!',
        possibleColors: [],
    },
    herdier: {
        id: 507,
        name: 'Herdier',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Herdier!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    stoutland: {
        id: 508,
        name: 'Stoutland',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Stoutland!',
        possibleColors: [],
    },
    purrloin: {
        id: 509,
        name: 'Purrloin',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Purrloin!',
        possibleColors: [],
    },
    liepard: {
        id: 510,
        name: 'Liepard',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Liepard!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    pansage: {
        id: 511,
        name: 'Pansage',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Pansage!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    simisage: {
        id: 512,
        name: 'Simisage',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Simisage!',
        possibleColors: [],
    },
    pansear: {
        id: 513,
        name: 'Pansear',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Pansear!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    simisear: {
        id: 514,
        name: 'Simisear',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Simisear!',
        possibleColors: [],
    },
    panpour: {
        id: 515,
        name: 'Panpour',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Panpour!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    simipour: {
        id: 516,
        name: 'Simipour',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Simipour!',
        possibleColors: [],
    },
    munna: {
        id: 517,
        name: 'Munna',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Munna!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    musharna: {
        id: 518,
        name: 'Musharna',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Musharna!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    pidove: {
        id: 519,
        name: 'Pidove',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Pidove!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    tranquill: {
        id: 520,
        name: 'Tranquill',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Tranquill!',
        possibleColors: [],
    },
    unfezant: {
        id: 521,
        name: 'Unfezant',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Unfezant!',
        possibleColors: [],
    },
    blitzle: {
        id: 522,
        name: 'Blitzle',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Blitzle!',
        possibleColors: [],
    },
    zebstrika: {
        id: 523,
        name: 'Zebstrika',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Zebstrika!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    roggenrola: {
        id: 524,
        name: 'Roggenrola',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Roggenrola!',
        possibleColors: [],
    },
    boldore: {
        id: 525,
        name: 'Boldore',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Boldore!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    gigalith: {
        id: 526,
        name: 'Gigalith',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Gigalith!',
        possibleColors: [],
    },
    woobat: {
        id: 527,
        name: 'Woobat',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Woobat!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    swoobat: {
        id: 528,
        name: 'Swoobat',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Swoobat!',
        possibleColors: [],
    },
    drilbur: {
        id: 529,
        name: 'Drilbur',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Drilbur!',
        possibleColors: ["default" /* PokemonColor.default */],
        extraSprites: ["left_facing" /* PokemonExtraSprite.leftFacing */],
    },
    excadrill: {
        id: 530,
        name: 'Excadrill',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Excadrill!',
        possibleColors: [],
    },
    audino: {
        id: 531,
        name: 'Audino',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Audino!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    timburr: {
        id: 532,
        name: 'Timburr',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Timburr!',
        possibleColors: [],
    },
    gurdurr: {
        id: 533,
        name: 'Gurdurr',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Gurdurr!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    conkeldurr: {
        id: 534,
        name: 'Conkeldurr',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Conkeldurr!',
        possibleColors: [],
    },
    tympole: {
        id: 535,
        name: 'Tympole',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Tympole!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    palpitoad: {
        id: 536,
        name: 'Palpitoad',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Palpitoad!',
        possibleColors: [],
    },
    seismitoad: {
        id: 537,
        name: 'Seismitoad',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Seismitoad!',
        possibleColors: [],
    },
    throh: {
        id: 538,
        name: 'Throh',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Throh!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    sawk: {
        id: 539,
        name: 'Sawk',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Sawk!',
        possibleColors: ["default" /* PokemonColor.default */],
        extraSprites: ["left_facing" /* PokemonExtraSprite.leftFacing */],
    },
    sewaddle: {
        id: 540,
        name: 'Sewaddle',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Sewaddle!',
        possibleColors: [],
    },
    swadloon: {
        id: 541,
        name: 'Swadloon',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Swadloon!',
        possibleColors: [],
    },
    leavanny: {
        id: 542,
        name: 'Leavanny',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Leavanny!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    venipede: {
        id: 543,
        name: 'Venipede',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Venipede!',
        possibleColors: [],
    },
    whirlipede: {
        id: 544,
        name: 'Whirlipede',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Whirlipede!',
        possibleColors: [],
    },
    scolipede: {
        id: 545,
        name: 'Scolipede',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Scolipede!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    cottonee: {
        id: 546,
        name: 'Cottonee',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Cottonee!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    whimsicott: {
        id: 547,
        name: 'Whimsicott',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Whimsicott!',
        possibleColors: [],
    },
    petilil: {
        id: 548,
        name: 'Petilil',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Petilil!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    lilligant: {
        id: 549,
        name: 'Lilligant',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Lilligant!',
        possibleColors: [],
    },
    basculin_red_striped: {
        id: 550,
        name: 'Basculin (Red-Striped Form)',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Basculin!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    basculin_blue_striped: {
        id: 550,
        name: 'Basculin (Blue-Striped Form)',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Basculin!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    sandile: {
        id: 551,
        name: 'Sandile',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Sandile!',
        possibleColors: [],
    },
    krokorok: {
        id: 552,
        name: 'Krokorok',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Krokorok!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    krookodile: {
        id: 553,
        name: 'Krookodile',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Krookodile!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    darumaka: {
        id: 554,
        name: 'Darumaka',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Darumaka!',
        possibleColors: [],
    },
    darmanitan: {
        id: 555,
        name: 'Darmanitan',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Darmanitan!',
        possibleColors: [],
    },
    maractus: {
        id: 556,
        name: 'Maractus',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Maractus!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    dwebble: {
        id: 557,
        name: 'Dwebble',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Dwebble!',
        possibleColors: [],
    },
    crustle: {
        id: 558,
        name: 'Crustle',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Crustle!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    scraggy: {
        id: 559,
        name: 'Scraggy',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Scraggy!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    scrafty: {
        id: 560,
        name: 'Scrafty',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Scrafty!',
        possibleColors: [],
    },
    sigilyph: {
        id: 561,
        name: 'Sigilyph',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Sigilyph!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    yamask: {
        id: 562,
        name: 'Yamask',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Yamask!',
        possibleColors: [],
    },
    cofagrigus: {
        id: 563,
        name: 'Cofagrigus',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Cofagrigus!',
        possibleColors: [],
    },
    tirtouga: {
        id: 564,
        name: 'Tirtouga',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Tirtouga!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    carracosta: {
        id: 565,
        name: 'Carracosta',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Carracosta!',
        possibleColors: [],
    },
    archen: {
        id: 566,
        name: 'Archen',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Archen!',
        possibleColors: [],
    },
    archeops: {
        id: 567,
        name: 'Archeops',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Archeops!',
        possibleColors: [],
    },
    trubbish: {
        id: 568,
        name: 'Trubbish',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Trubbish!',
        possibleColors: [],
    },
    garbodor: {
        id: 569,
        name: 'Garbodor',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Garbodor!',
        possibleColors: ["default" /* PokemonColor.default */],
        extraSprites: ["left_facing" /* PokemonExtraSprite.leftFacing */],
    },
    zorua: {
        id: 570,
        name: 'Zorua',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Zorua!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    zoroark: {
        id: 571,
        name: 'Zoroark',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Zoroark!',
        possibleColors: [],
    },
    minccino: {
        id: 572,
        name: 'Minccino',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Minccino!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    cinccino: {
        id: 573,
        name: 'Cinccino',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Cinccino!',
        possibleColors: [],
    },
    gothita: {
        id: 574,
        name: 'Gothita',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Gothita!',
        possibleColors: [],
    },
    gothorita: {
        id: 575,
        name: 'Gothorita',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Gothorita!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    gothitelle: {
        id: 576,
        name: 'Gothitelle',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Gothitelle!',
        possibleColors: [],
    },
    solosis: {
        id: 577,
        name: 'Solosis',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Solosis!',
        possibleColors: [],
    },
    duosion: {
        id: 578,
        name: 'Duosion',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Duosion!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    reuniclus: {
        id: 579,
        name: 'Reuniclus',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Reuniclus!',
        possibleColors: [],
    },
    ducklett: {
        id: 580,
        name: 'Ducklett',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Ducklett!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    swanna: {
        id: 581,
        name: 'Swanna',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Swanna!',
        possibleColors: [],
    },
    vanillite: {
        id: 582,
        name: 'Vanillite',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Vanillite!',
        possibleColors: [],
    },
    vanillish: {
        id: 583,
        name: 'Vanillish',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Vanillish!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    vanilluxe: {
        id: 584,
        name: 'Vanilluxe',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Vanilluxe!',
        possibleColors: [],
    },
    deerling_spring: {
        id: 585,
        name: 'Deerling (Spring Form)',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Deerling!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    deerling_summer: {
        id: 585,
        name: 'Deerling (Summer Form)',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Deerling!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    deerling_autumn: {
        id: 585,
        name: 'Deerling (Autumn Form)',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Deerling!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    deerling_winter: {
        id: 585,
        name: 'Deerling (Winter Form)',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Deerling!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    sawsbuck_spring: {
        id: 586,
        name: 'Sawsbuck (Spring Form)',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Sawsbuck!',
        possibleColors: [],
    },
    sawsbuck_summer: {
        id: 586,
        name: 'Sawsbuck (Summer Form)',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Sawsbuck!',
        possibleColors: [],
    },
    sawsbuck_autumn: {
        id: 586,
        name: 'Sawsbuck (Autumn Form)',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Sawsbuck!',
        possibleColors: [],
    },
    sawsbuck_winter: {
        id: 586,
        name: 'Sawsbuck (Winter Form)',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Sawsbuck!',
        possibleColors: [],
    },
    emolga: {
        id: 587,
        name: 'Emolga',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Emolga!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    karrablast: {
        id: 588,
        name: 'Karrablast',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Karrablast!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    escavalier: {
        id: 589,
        name: 'Escavalier',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Escavalier!',
        possibleColors: [],
    },
    foongus: {
        id: 590,
        name: 'Foongus',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Foongus!',
        possibleColors: [],
    },
    amoonguss: {
        id: 591,
        name: 'Amoonguss',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Amoonguss!',
        possibleColors: [],
    },
    frillish: {
        id: 592,
        name: 'Frillish',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Frillish!',
        possibleColors: [],
    },
    jellicent: {
        id: 593,
        name: 'Jellicent',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Jellicent!',
        possibleColors: [],
    },
    alomomola: {
        id: 594,
        name: 'Alomomola',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Alomomola!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    joltik: {
        id: 595,
        name: 'Joltik',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Joltik!',
        possibleColors: [],
    },
    galvantula: {
        id: 596,
        name: 'Galvantula',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Galvantula!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    ferroseed: {
        id: 597,
        name: 'Ferroseed',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Ferroseed!',
        possibleColors: [],
    },
    ferrothorn: {
        id: 598,
        name: 'Ferrothorn',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Ferrothorn!',
        possibleColors: [],
    },
    klink: {
        id: 599,
        name: 'Klink',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Klink!',
        possibleColors: [],
    },
    klang: {
        id: 600,
        name: 'Klang',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Klang!',
        possibleColors: ["default" /* PokemonColor.default */],
        extraSprites: ["left_facing" /* PokemonExtraSprite.leftFacing */],
    },
    klinklang: {
        id: 601,
        name: 'Klinklang',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Klinklang!',
        possibleColors: [],
    },
    tynamo: {
        id: 602,
        name: 'Tynamo',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Tynamo!',
        possibleColors: [],
    },
    eelektrik: {
        id: 603,
        name: 'Eelektrik',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Eelektrik!',
        possibleColors: [],
    },
    eelektross: {
        id: 604,
        name: 'Eelektross',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Eelektross!',
        possibleColors: [],
    },
    elgyem: {
        id: 605,
        name: 'Elgyem',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Elgyem!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    beheeyem: {
        id: 606,
        name: 'Beheeyem',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Beheeyem!',
        possibleColors: [],
    },
    litwick: {
        id: 607,
        name: 'Litwick',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Litwick!',
        possibleColors: ["default" /* PokemonColor.default */],
        extraSprites: ["left_facing" /* PokemonExtraSprite.leftFacing */],
    },
    lampent: {
        id: 608,
        name: 'Lampent',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Lampent!',
        possibleColors: [],
    },
    chandelure: {
        id: 609,
        name: 'Chandelure',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Chandelure!',
        possibleColors: [],
    },
    axew: {
        id: 610,
        name: 'Axew',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Axew!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    fraxure: {
        id: 611,
        name: 'Fraxure',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Fraxure!',
        possibleColors: [],
    },
    haxorus: {
        id: 612,
        name: 'Haxorus',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Haxorus!',
        possibleColors: [],
    },
    cubchoo: {
        id: 613,
        name: 'Cubchoo',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Cubchoo!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    beartic: {
        id: 614,
        name: 'Beartic',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Beartic!',
        possibleColors: [],
    },
    cryogonal: {
        id: 615,
        name: 'Cryogonal',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Cryogonal!',
        possibleColors: [],
    },
    shelmet: {
        id: 616,
        name: 'Shelmet',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Shelmet!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    accelgor: {
        id: 617,
        name: 'Accelgor',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Accelgor!',
        possibleColors: [],
    },
    stunfisk: {
        id: 618,
        name: 'Stunfisk',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Stunfisk!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    mienfoo: {
        id: 619,
        name: 'Mienfoo',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Mienfoo!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    mienshao: {
        id: 620,
        name: 'Mienshao',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Mienshao!',
        possibleColors: [],
    },
    druddigon: {
        id: 621,
        name: 'Druddigon',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Druddigon!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    golett: {
        id: 622,
        name: 'Golett',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Golett!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    golurk: {
        id: 623,
        name: 'Golurk',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Golurk!',
        possibleColors: [],
    },
    pawniard: {
        id: 624,
        name: 'Pawniard',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Pawniard!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    bisharp: {
        id: 625,
        name: 'Bisharp',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Bisharp!',
        possibleColors: [],
    },
    bouffalant: {
        id: 626,
        name: 'Bouffalant',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Bouffalant!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    rufflet: {
        id: 627,
        name: 'Rufflet',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Rufflet!',
        possibleColors: [],
    },
    braviary: {
        id: 628,
        name: 'Braviary',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Braviary!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    vullaby: {
        id: 629,
        name: 'Vullaby',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Vullaby!',
        possibleColors: [],
    },
    mandibuzz: {
        id: 630,
        name: 'Mandibuzz',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Mandibuzz!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    heatmor: {
        id: 631,
        name: 'Heatmor',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Heatmor!',
        possibleColors: ["default" /* PokemonColor.default */],
        extraSprites: ["left_facing" /* PokemonExtraSprite.leftFacing */],
    },
    durant: {
        id: 632,
        name: 'Durant',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Durant!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    deino: {
        id: 633,
        name: 'Deino',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Deino!',
        possibleColors: [],
    },
    zweilous: {
        id: 634,
        name: 'Zweilous',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Zweilous!',
        possibleColors: [],
    },
    hydreigon: {
        id: 635,
        name: 'Hydreigon',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Hydreigon!',
        possibleColors: [],
    },
    larvesta: {
        id: 636,
        name: 'Larvesta',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Larvesta!',
        possibleColors: [],
    },
    volcarona: {
        id: 637,
        name: 'Volcarona',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Volcarona!',
        possibleColors: [],
    },
    cobalion: {
        id: 638,
        name: 'Cobalion',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Cobalion!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    terrakion: {
        id: 639,
        name: 'Terrakion',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Terrakion!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    virizion: {
        id: 640,
        name: 'Virizion',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Virizion!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    tornadus: {
        id: 641,
        name: 'Tornadus',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Tornadus!',
        possibleColors: [],
    },
    thundurus: {
        id: 642,
        name: 'Thundurus',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Thundurus!',
        possibleColors: [],
    },
    reshiram: {
        id: 643,
        name: 'Reshiram',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Reshiram!',
        possibleColors: [],
    },
    zekrom: {
        id: 644,
        name: 'Zekrom',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Zekrom!',
        possibleColors: [],
    },
    landorus: {
        id: 645,
        name: 'Landorus',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Landorus!',
        possibleColors: [],
    },
    kyurem: {
        id: 646,
        name: 'Kyurem',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Kyurem!',
        possibleColors: [],
    },
    keldeo: {
        id: 647,
        name: 'Keldeo',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Keldeo!',
        possibleColors: ["default" /* PokemonColor.default */],
    },
    meloetta: {
        id: 648,
        name: 'Meloetta',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Meloetta!',
        possibleColors: ["default" /* PokemonColor.default */],
        extraSprites: ["left_facing" /* PokemonExtraSprite.leftFacing */],
    },
    genesect: {
        id: 649,
        name: 'Genesect',
        generation: types_1.PokemonGeneration.Gen5,
        cry: 'Genesect!',
        possibleColors: [],
    },
/* POKEMON-EXTRA-PATCH */
    froakie: { id: 656, name: "Froakie", generation: 6, cry: "Froakie!", possibleColors: ["default", "shiny"], },
    frogadier: { id: 657, name: "Frogadier", generation: 6, cry: "Frogadier!", possibleColors: ["default", "shiny"], originalSpriteSize: 64, },
    greninja: { id: 658, name: "Greninja", generation: 6, cry: "Greninja!", possibleColors: ["default", "shiny"], },
/* /POKEMON-EXTRA-PATCH */
};
exports.POKEMON_DATA = Object.fromEntries(Object.entries(POKEMON_DATA_RAW).filter(([, config]) => config.possibleColors.length > 0));
function getAllPokemon() {
    return Object.keys(exports.POKEMON_DATA);
}
exports.getAllPokemon = getAllPokemon;
function getPokemonByGeneration(generation) {
    return Object.entries(exports.POKEMON_DATA)
        .filter(([, config]) => config.generation === generation)
        .map(([key]) => key);
}
exports.getPokemonByGeneration = getPokemonByGeneration;
function getDefaultPokemon() {
    return 'bulbasaur';
}
exports.getDefaultPokemon = getDefaultPokemon;
/**
 * Returns a random Pokemon config from a given pool.
 * @param types The keys to choose from.
 * @returns A random Pokemon config from the given pool.
 */
function getRandomPokemonConfigFrom(types) {
    const randomType = types[Math.floor(Math.random() * types.length)];
    return [randomType, exports.POKEMON_DATA[randomType]];
}
exports.getRandomPokemonConfigFrom = getRandomPokemonConfigFrom;
function getRandomPokemonConfig() {
    const keys = Object.keys(exports.POKEMON_DATA);
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    return [randomKey, exports.POKEMON_DATA[randomKey]];
}
exports.getRandomPokemonConfig = getRandomPokemonConfig;


/***/ }),

/***/ "./src/common/types.ts":
/*!*****************************!*\
  !*** ./src/common/types.ts ***!
  \*****************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ALL_THEMES = exports.ALL_SCALES = exports.ALL_COLORS = exports.WebviewMessage = exports.PokemonGeneration = void 0;
var PokemonGeneration;
(function (PokemonGeneration) {
    PokemonGeneration[PokemonGeneration["Gen1"] = 1] = "Gen1";
    PokemonGeneration[PokemonGeneration["Gen2"] = 2] = "Gen2";
    PokemonGeneration[PokemonGeneration["Gen3"] = 3] = "Gen3";
    PokemonGeneration[PokemonGeneration["Gen4"] = 4] = "Gen4";
    PokemonGeneration[PokemonGeneration["Gen5"] = 5] = "Gen5";
})(PokemonGeneration = exports.PokemonGeneration || (exports.PokemonGeneration = {}));
class WebviewMessage {
    text;
    command;
    constructor(text, command) {
        this.text = text;
        this.command = command;
    }
}
exports.WebviewMessage = WebviewMessage;
exports.ALL_COLORS = ["default" /* PokemonColor.default */];
exports.ALL_SCALES = [
    "nano" /* PokemonSize.nano */,
    "small" /* PokemonSize.small */,
    "medium" /* PokemonSize.medium */,
    "large" /* PokemonSize.large */,
];
exports.ALL_THEMES = ["none" /* Theme.none */, "forest" /* Theme.forest */, "castle" /* Theme.castle */, "beach" /* Theme.beach */];


/***/ }),

/***/ "./src/panel/base-pokemon-type.ts":
/*!****************************************!*\
  !*** ./src/panel/base-pokemon-type.ts ***!
  \****************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.BasePokemonType = exports.InvalidStateError = void 0;
const pokemon_data_1 = __webpack_require__(/*! ../common/pokemon-data */ "./src/common/pokemon-data.ts");
const states_1 = __webpack_require__(/*! ./states */ "./src/panel/states.ts");
class InvalidStateError extends Error {
    fromState;
    pokemonType;
    constructor(fromState, pokemonType) {
        super(`Invalid state ${fromState} for pokemon type ${pokemonType}`);
        this.fromState = fromState;
        this.pokemonType = pokemonType;
    }
}
exports.InvalidStateError = InvalidStateError;
// LOCAL-PATCH: 위치 이동을 GPU(컴포지터) 애니메이션으로 — left/bottom 은 바로 바꾸고 보이는 그림만 이전 자리에서 미끄러져 옴
// 메인 스레드가 바빠도(같은 프로세스의 다른 패널 등) 이어지고, 0.1초 타이머보다 길게 잡아 다음 이동이 조금 늦어도 안 멈춤
const GLIDE_MS = 150;
function glideSprite(el, dx, dy) {
    if ((!dx && !dy) || Math.abs(dx) > 40 || Math.abs(dy) > 40) {
        return; // 안 움직였거나 순간이동(바닥 재배치 등)
    }
    // 아직 덜 온 거리는 이어받음
    const prev = el.glideAnim;
    if (prev && prev.playState === 'running') {
        const progress = prev.effect.getComputedTiming().progress ?? 1;
        dx += prev.glideDx * (1 - progress);
        dy += prev.glideDy * (1 - progress);
        prev.cancel();
    }
    const anim = el.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0px 0px' }], { duration: GLIDE_MS, easing: 'linear' });
    // 시작을 방금 그린 프레임 시각으로 — 안 그러면 새 애니메이션 첫 프레임이 출발점에 머물러 0.1초마다 멈칫함
    anim.startTime = document.timeline.currentTime;
    anim.glideDx = dx;
    anim.glideDy = dy;
    el.glideAnim = anim;
}
class BasePokemonType {
    label = 'base';
    static count = 0;
    sequence = {
        startingState: "sit-idle" /* States.sitIdle */,
        sequenceStates: [],
    };
    static possibleColors;
    currentState;
    currentStateEnum;
    holdState;
    holdStateEnum;
    el;
    collision;
    speech;
    _left;
    _bottom;
    pokemonRoot;
    _floor;
    _friend;
    _name;
    _baseSpeed;
    _size;
    _generation;
    _originalSpriteSize;
    constructor(spriteElement, collisionElement, speechElement, size, left, bottom, pokemonRoot, floor, name, speed, generation, originalSpriteSize) {
        this.el = spriteElement;
        this.collision = collisionElement;
        this.speech = speechElement;
        this.pokemonRoot = pokemonRoot;
        this._floor = floor;
        this._left = left;
        this._bottom = bottom;
        this._originalSpriteSize = originalSpriteSize;
        this.initSprite(size, left, bottom, originalSpriteSize);
        this.currentStateEnum = this.sequence.startingState;
        this.currentState = (0, states_1.resolveState)(this.currentStateEnum, this);
        this._name = name;
        this._size = size;
        this._baseSpeed = this.randomizeSpeed(speed);
        this._generation = generation;
        // Increment the static count of the Pokemon class that the constructor belongs to
        this.constructor.count += 1;
    }
    initSprite(pokemonSize, left, bottom, originalSpriteSize) {
        const spriteSize = this.calculateSpriteWidth(pokemonSize, originalSpriteSize);
        this.el.style.left = `${left}px`;
        this.el.style.bottom = `${bottom}px`;
        this.el.style.width = `${spriteSize}px`;
        this.el.style.height = `${spriteSize}px`;
        // Remove 'auto' since it gave issues with sizing
        this.el.style.maxWidth = 'none';
        this.el.style.maxHeight = 'none';
        this.collision.style.left = `${left}px`;
        this.collision.style.bottom = `${bottom}px`;
        this.collision.style.width = `${spriteSize}px`;
        this.collision.style.height = `${spriteSize}px`;
        this.speech.style.left = `${left}px`;
        this.speech.style.bottom = `${bottom + spriteSize}px`;
        this.hideSpeechBubble();
    }
    get left() {
        return this._left;
    }
    get bottom() {
        return this._bottom;
    }
    repositionAccompanyingElements() {
        this.collision.style.left = `${this._left}px`;
        this.collision.style.bottom = `${this._bottom}px`;
        this.speech.style.left = `${this._left}px`;
        this.speech.style.bottom = `${this._bottom +
            this.calculateSpriteWidth(this._size, this._originalSpriteSize)}px`;
    }
    calculateSpriteWidth(size, originalSpriteSize) {
        switch (size) {
            case "nano" /* PokemonSize.nano */:
                return originalSpriteSize;
            case "small" /* PokemonSize.small */:
                return originalSpriteSize * 1.5;
            case "medium" /* PokemonSize.medium */:
                return originalSpriteSize * 2;
            case "large" /* PokemonSize.large */:
                return originalSpriteSize * 2.5;
            default:
                return originalSpriteSize;
        }
    }
    positionBottom(bottom) {
        glideSprite(this.el, 0, bottom - this._bottom); // LOCAL-PATCH
        this._bottom = bottom;
        this.el.style.bottom = `${this._bottom}px`;
        this.repositionAccompanyingElements();
    }
    positionLeft(left) {
        glideSprite(this.el, this._left - left, 0); // LOCAL-PATCH
        this._left = left;
        this.el.style.left = `${this._left}px`;
        this.repositionAccompanyingElements();
    }
    get width() {
        return this.el.width;
    }
    get floor() {
        return this._floor;
    }
    get hello() {
        // return the sound of the name of the animal
        return ` says hello 👋!`;
    }
    getState() {
        return { currentStateEnum: this.currentStateEnum };
    }
    get speed() {
        const base = this._baseSpeed ?? 0;
        switch (this._size) {
            case "nano" /* PokemonSize.nano */:
                return base * 0.5; // much slower for nano
            case "small" /* PokemonSize.small */:
                return base * 0.75; // slower for small
            case "medium" /* PokemonSize.medium */:
                return base * 1.0; // baseline
            case "large" /* PokemonSize.large */:
                return base * 1.25; // slightly faster for large
            default:
                return base;
        }
    }
    randomizeSpeed(speed) {
        const min = speed * 0.7;
        const max = speed * 1.3;
        const newSpeed = Math.random() * (max - min) + min;
        return newSpeed;
    }
    get isMoving() {
        return this._baseSpeed !== 0 /* PokemonSpeed.still */;
    }
    recoverFriend(friend) {
        // Recover friends..
        this._friend = friend;
    }
    recoverState(state) {
        // TODO : Resolve a bug where if it was swiping before, it would fail
        // because holdState is no longer valid.
        this.currentStateEnum = state.currentStateEnum ?? "sit-idle" /* States.sitIdle */;
        this.currentState = (0, states_1.resolveState)(this.currentStateEnum, this);
        if (!(0, states_1.isStateAboveGround)(this.currentStateEnum)) {
            // Reset the bottom of the sprite to the floor as the theme
            // has likely changed.
            this.positionBottom(this.floor);
        }
    }
    get canSwipe() {
        return !(0, states_1.isStateAboveGround)(this.currentStateEnum);
    }
    get canChase() {
        return !(0, states_1.isStateAboveGround)(this.currentStateEnum) && this.isMoving;
    }
    showSpeechBubble(duration = 3000, friend = false) {
        // Extract the media folder
        const segments = this.pokemonRoot.split('/');
        const basePath = segments.slice(0, segments.length - 3).join('/');
        if (friend) {
            this.speech.src = `${basePath}/heart.png`;
        }
        else {
            this.speech.src = `${basePath}/happy.png`;
        }
        this.speech.style.display = 'block';
        setTimeout(() => {
            this.hideSpeechBubble();
        }, duration);
    }
    hideSpeechBubble() {
        this.speech.style.display = 'none';
    }
    swipe() {
        if (this.currentStateEnum === "swipe" /* States.swipe */) {
            return;
        }
        this.holdState = this.currentState;
        this.holdStateEnum = this.currentStateEnum;
        this.currentStateEnum = "swipe" /* States.swipe */;
        this.currentState = (0, states_1.resolveState)(this.currentStateEnum, this);
        this.showSpeechBubble();
    }
    chase(ballState, canvas) {
        this.currentStateEnum = "chase" /* States.chase */;
        this.currentState = new states_1.ChaseState(this, ballState, canvas);
    }
    faceLeft() {
        this.el.style.transform = 'scaleX(-1)';
    }
    faceRight() {
        this.el.style.transform = 'scaleX(1)';
    }
    setAnimation(face, hasLeftFacingSprite) {
        const validFace = !hasLeftFacingSprite && face === 'walk_left' ? 'walk' : face;
        if (this.el.src.endsWith(`_${validFace}_8fps.gif`)) {
            return;
        }
        this.el.src = `${this.pokemonRoot}_${validFace}_8fps.gif`;
    }
    chooseNextState(fromState) {
        // Work out next state
        var possibleNextStates = undefined;
        for (var i = 0; i < this.sequence.sequenceStates.length; i++) {
            if (this.sequence.sequenceStates[i].state === fromState) {
                possibleNextStates = this.sequence.sequenceStates[i].possibleNextStates;
            }
        }
        if (!possibleNextStates) {
            throw new InvalidStateError(fromState, this.label);
        }
        // randomly choose the next state
        const idx = Math.floor(Math.random() * possibleNextStates.length);
        return possibleNextStates[idx];
    }
    nextFrame() {
        const hasLeftFacingSprite = pokemon_data_1.POKEMON_DATA[this.label]?.extraSprites?.includes("left_facing" /* PokemonExtraSprite.leftFacing */);
        if (!hasLeftFacingSprite) {
            if (this.currentState.horizontalDirection === states_1.HorizontalDirection.left) {
                this.faceLeft();
            }
            else if (this.currentState.horizontalDirection === states_1.HorizontalDirection.right) {
                this.faceRight();
            }
        }
        else {
            this.faceRight();
        }
        this.setAnimation(this.currentState.spriteLabel, hasLeftFacingSprite);
        // What's my buddy doing?
        if (this.hasFriend &&
            this.currentStateEnum !== "chase-friend" /* States.chaseFriend */ &&
            this.isMoving) {
            if (this.friend?.isPlaying &&
                !(0, states_1.isStateAboveGround)(this.currentStateEnum)) {
                this.currentState = (0, states_1.resolveState)("chase-friend" /* States.chaseFriend */, this);
                this.currentStateEnum = "chase-friend" /* States.chaseFriend */;
                return;
            }
        }
        var frameResult = this.currentState.nextFrame();
        if (frameResult === states_1.FrameResult.stateComplete) {
            // If recovering from swipe..
            if (this.holdState && this.holdStateEnum) {
                this.currentState = this.holdState;
                this.currentStateEnum = this.holdStateEnum;
                this.holdState = undefined;
                this.holdStateEnum = undefined;
                return;
            }
            var nextState = this.chooseNextState(this.currentStateEnum);
            this.currentState = (0, states_1.resolveState)(nextState, this);
            this.currentStateEnum = nextState;
        }
        else if (frameResult === states_1.FrameResult.stateCancel) {
            if (this.currentStateEnum === "chase" /* States.chase */) {
                var nextState = this.chooseNextState("idle-with-ball" /* States.idleWithBall */);
                this.currentState = (0, states_1.resolveState)(nextState, this);
                this.currentStateEnum = nextState;
            }
            else if (this.currentStateEnum === "chase-friend" /* States.chaseFriend */) {
                var nextState = this.chooseNextState("idle-with-ball" /* States.idleWithBall */);
                this.currentState = (0, states_1.resolveState)(nextState, this);
                this.currentStateEnum = nextState;
            }
        }
    }
    get hasFriend() {
        return this._friend !== undefined;
    }
    get friend() {
        return this._friend;
    }
    get name() {
        return this._name;
    }
    makeFriendsWith(friend) {
        this._friend = friend;
        console.log(this.name, ": I'm now friends ❤️ with ", friend.name);
        return true;
    }
    get isPlaying() {
        return (this.isMoving &&
            (this.currentStateEnum === "run-right" /* States.runRight */ ||
                this.currentStateEnum === "run-left" /* States.runLeft */));
    }
    get emoji() {
        return '🐶';
    }
}
exports.BasePokemonType = BasePokemonType;


/***/ }),

/***/ "./src/panel/main.ts":
/*!***************************!*\
  !*** ./src/panel/main.ts ***!
  \***************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.pokemonPanelApp = exports.saveState = exports.allPokemon = void 0;
// This script will be run within the webview itself
const names_1 = __webpack_require__(/*! ../common/names */ "./src/common/names.ts");
const pokemon_collection_1 = __webpack_require__(/*! ./pokemon-collection */ "./src/panel/pokemon-collection.ts");
const states_1 = __webpack_require__(/*! ./states */ "./src/panel/states.ts");
const pokemon_data_1 = __webpack_require__(/*! ../common/pokemon-data */ "./src/common/pokemon-data.ts");
exports.allPokemon = new pokemon_collection_1.PokemonCollection();
var pokemonCounter;
function normalizePokemonCounter(counter) {
    if (counter === undefined || Number.isNaN(counter)) {
        return 0;
    }
    return Math.max(0, counter);
}
/* POKEMON-FIT-PATCH */
// 배경을 패널 높이에 맞춘다 — 땅(포켓몬이 걷는 줄)이 항상 floor 높이에 오도록
// 배율 = (패널 높이 - floor) / (그림 높이 - floor), 그림 위쪽을 패널 위에 붙인다
function fitThemeBackground(foregroundEl, floor) {
    const match = document.body.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
    if (!match) {
        return;
    }
    const img = new Image();
    img.onload = () => {
        const apply = () => {
            const room = img.naturalHeight - floor;
            if (room <= 0) {
                return;
            }
            const scale = Math.max(0.2, (window.innerHeight - floor) / room);
            const height = Math.round(img.naturalHeight * scale);
            [document.body, foregroundEl].forEach((el) => {
                el.style.backgroundSize = `auto ${height}px`;
                el.style.backgroundPosition = 'left top';
                el.style.imageRendering = 'pixelated';
            });
        };
        apply();
        window.addEventListener('resize', apply);
    };
    img.src = match[1];
}
function calculateFloor(size, theme) {
    switch (theme) {
        case "forest" /* Theme.forest */:
            switch (size) {
                case "small" /* PokemonSize.small */:
                    return 30;
                case "medium" /* PokemonSize.medium */:
                    return 40;
                case "large" /* PokemonSize.large */:
                    return 65;
                case "nano" /* PokemonSize.nano */:
                default:
                    return 23;
            }
        case "castle" /* Theme.castle */:
            switch (size) {
                case "small" /* PokemonSize.small */:
                    return 60;
                case "medium" /* PokemonSize.medium */:
                    return 80;
                case "large" /* PokemonSize.large */:
                    return 120;
                case "nano" /* PokemonSize.nano */:
                default:
                    return 45;
            }
        case "beach" /* Theme.beach */:
            switch (size) {
                case "small" /* PokemonSize.small */:
                    return 60;
                case "medium" /* PokemonSize.medium */:
                    return 80;
                case "large" /* PokemonSize.large */:
                    return 120;
                case "nano" /* PokemonSize.nano */:
                default:
                    return 45;
            }
    }
    return 0;
}
/* POKEMON-MOVES-PATCH */
const POKEMON_MOVES = {"bulbasaur":["grass",0.26,26,21],"ivysaur":["grass",0.46,23,22],"venusaur":["grass",0.72,25,20],"venusaur_female":["grass",0.72,25,20],"charmander":["fire",0.24,26,21],"charmeleon":["fire",0.46,24,20],"charizard":["fire",0.74,28,16],"squirtle":["water",0.25,21,20],"wartortle":["water",0.46,22,20],"blastoise":["water",0.73,26,16],"pikachu":["electric",0.27,7,14,24,31],"pikachu_female":["electric",0.27,7,14,24,31],"raichu":["electric",0.63,3,12,26,31],"vulpix":["fire",0.22,26,22],"ninetales":["fire",0.68,27,21],"oddish":["grass",0.27,23,21],"gloom":["grass",0.43,26,21],"vileplume":["grass",0.64,25,19],"paras":["grass",0.19,24,23],"parasect":["grass",0.46,26,19],"psyduck":["water",0.27,24,21],"golduck":["water",0.67,24,20],"growlithe":["fire",0.33,24,19],"arcanine":["fire",0.79,28,18],"poliwag":["water",0.22,22,22],"poliwhirl":["water",0.41,23,20],"poliwrath":["water",0.69,23,19],"bellsprout":["grass",0.22,23,20],"weepinbell":["grass",0.42,23,22],"victreebel":["grass",0.64,24,14],"tentacool":["water",0.3,23,18],"tentacruel":["water",0.7,26,18],"ponyta":["fire",0.47,24,20],"rapidash":["fire",0.67,27,19],"slowpoke":["water",0.26,27,23],"slowbro":["water",0.64,25,19],"magnemite":["electric",0.28,9,17,20,30],"magneton":["electric",0.59,7,7,22,30],"seel":["water",0.28,25,20],"dewgong":["water",0.61,26,18],"shellder":["water",0.23,21,17],"cloyster":["water",0.72,24,15],"krabby":["water",0.28,26,23],"kingler":["water",0.61,30,16],"voltorb":["electric",0.29,9,16,24,31],"electrode":["electric",0.64,5,10,27,31],"exeggcute":["grass",0.28,28,18],"exeggutor":["grass",0.73,28,10],"tangela":["grass",0.52,23,20],"horsea":["water",0.21,22,20],"seadra":["water",0.53,21,16],"goldeen":["water",0.27,21,20],"seaking":["water",0.56,26,18],"staryu":["water",0.31,20,20],"starmie":["water",0.71,22,18],"electabuzz":["electric",0.64,1,9,22,31],"magmar":["fire",0.66,22,18],"magikarp":["water",0,25,18],"gyarados":["water",0.76,27,14],"lapras":["water",0.74,23,16],"vaporeon":["water",0.72,27,20],"jolteon":["electric",0.72,1,13,25,31],"flareon":["fire",0.72,25,18],"omanyte":["water",0.34,21,22],"omastar":["water",0.66,23,18],"kabuto":["water",0.34,24,21],"kabutops":["water",0.66,26,19],"zapdos":["electric",0.84,1,7,25,31],"moltres":["fire",0.84,26,14],"chikorita":["grass",0.26,21,20],"bayleef":["grass",0.46,25,13],"meganium":["grass",0.72,25,12],"meganium_female":["grass",0.72,25,12],"cyndaquil":["fire",0.24,24,22],"quilava":["fire",0.46,25,19],"typhlosion":["fire",0.74,25,16],"totodile":["water",0.25,24,21],"croconaw":["water",0.46,23,17],"feraligatr":["water",0.73,27,14],"chinchou":["water",0.29,24,20],"lanturn":["water",0.58,27,18],"pichu":["electric",0.01,8,16,23,31],"pichu_spiky_eared":["electric",0.01,8,14,23,31],"mareep":["electric",0.18,6,13,26,31],"flaaffy":["electric",0.37,3,11,24,31],"ampharos":["electric",0.69,2,8,25,32],"bellossom":["grass",0.64,20,19],"marill":["water",0.11,22,22],"azumarill":["water",0.49,22,18],"politoed":["water",0.67,23,19],"hoppip":["grass",0.11,20,15],"skiploom":["grass",0.31,21,18],"jumpluff":["grass",0.58,21,16],"sunkern":["grass",0,20,22],"sunflora":["grass",0.5,21,18],"wooper":["water",0.02,22,22],"quagsire":["water",0.51,23,17],"slowking":["water",0.64,22,18],"qwilfish":["water",0.53,25,18],"slugma":["fire",0.11,24,20],"magcargo":["fire",0.51,25,19],"corsola":["water",0.47,25,21],"remoraid":["water",0.22,24,20],"octillery":["water",0.62,25,18],"mantine":["water",0.63,28,15],"houndour":["fire",0.29,24,20],"houndoom":["fire",0.67,25,18],"kingdra":["water",0.76,25,20],"elekid":["electric",0.36,10,13,23,31],"magby":["fire",0.37,21,18],"raikou":["electric",0.84,1,7,28,31],"entei":["fire",0.84,26,17],"suicune":["water",0.84,28,20],"hooh":["fire",1,50,39],"celebi":["grass",0.89,22,20],"treecko":["grass",0.24,24,22],"grovyle":["grass",0.46,22,20],"sceptile":["grass",0.73,26,14],"torchic":["fire",0.24,22,21],"combusken":["fire",0.46,22,20],"blaziken":["fire",0.73,25,16],"mudkip":["water",0.24,21,22],"marshtomp":["water",0.46,22,20],"swampert":["water",0.74,27,18],"lotad":["water",0.04,24,20],"lombre":["water",0.31,24,16],"ludicolo":["water",0.62,26,13],"seedot":["grass",0.04,21,21],"nuzleaf":["grass",0.31,22,20],"shiftry":["grass",0.62,24,19],"wingull":["water",0.16,24,21],"pelipper":["water",0.53,24,16],"surskit":["water",0.15,23,22],"shroomish":["grass",0.21,23,22],"breloom":["grass",0.58,25,15],"electrike":["electric",0.21,2,18,25,31],"manectric":["electric",0.61,2,8,26,31],"plusle":["electric",0.46,9,15,23,31],"minun":["electric",0.46,9,15,23,31],"roselia":["grass",0.44,21,20],"carvanha":["water",0.23,25,20],"sharpedo":["water",0.58,27,19],"wailmer":["water",0.44,24,20],"wailord":["water",0.67,52,48],"numel":["fire",0.23,26,20],"camerupt":["fire",0.58,29,20],"torkoal":["fire",0.6,27,20],"cacnea":["grass",0.3,22,22],"cacturne":["grass",0.61,24,18],"barboach":["water",0.2,23,18],"whiscash":["water",0.6,26,21],"corphish":["water",0.24,23,18],"crawdaunt":["water",0.6,23,17],"lileep":["grass",0.34,24,18],"cradily":["grass",0.66,25,16],"feebas":["water",0,22,23],"milotic":["water",0.76,26,18],"tropius":["grass",0.58,29,16],"spheal":["water",0.2,23,22],"sealeo":["water",0.47,26,18],"walrein":["water",0.73,29,12],"clamperl":["water",0.32,20,24],"huntail":["water",0.63,26,18],"gorebyss":["water",0.63,25,19],"relicanth":["water",0.63,24,22],"luvdisc":["water",0.29,23,22],"kyogre":["water",1,50,47],"turtwig":["grass",0.26,24,21],"grotle":["grass",0.46,23,21],"torterra":["grass",0.72,25,19],"chimchar":["fire",0.24,22,20],"monferno":["fire",0.46,25,18],"infernape":["fire",0.74,26,16],"piplup":["water",0.25,22,21],"prinplup":["water",0.46,23,18],"empoleon":["water",0.73,24,16],"bibarel":["water",0.47,30,22],"shinx":["electric",0.14,6,17,26,31],"luxio":["electric",0.36,2,12,26,31],"luxray":["electric",0.72,1,9,26,31],"budew":["grass",0.18,21,23],"roserade":["grass",0.7,23,14],"wormadam_plant":["grass",0.5,22,18],"wormadam_sandy":["grass",0.5,22,18],"wormadam_trash":["grass",0.5,22,18],"pachirisu":["electric",0.46,7,15,25,30],"buizel":["water",0.29,26,22],"floatzel":["water",0.66,24,14],"cherubi":["grass",0.17,20,19],"cherrim":["grass",0.56,21,21],"shellos_west":["water",0.28,23,18],"shellos_east":["water",0.28,22,21],"gastrodon_west":["water",0.61,23,16],"gastrodon_east":["water",0.61,24,16],"carnivine":["grass",0.56,24,15],"finneon":["water",0.29,23,22],"lumineon":["water",0.58,24,20],"mantyke":["water",0.32,25,19],"snover":["grass",0.3,23,20],"abomasnow":["grass",0.65,26,17],"magnezone":["electric",0.74,3,9,27,32],"tangrowth":["grass",0.74,24,16],"electivire":["electric",0.76,4,7,29,31],"magmortar":["fire",0.76,25,15],"leafeon":["grass",0.72,26,20],"rotom":["electric",0.53,5,11,23,31],"rotom_heat":["electric",0.53,2,11,25,30],"rotom_wash":["electric",0.53,2,8,26,31],"rotom_frost":["electric",0.53,3,8,24,30],"rotom_fan":["electric",0.53,3,7,28,31],"rotom_mow":["electric",0.53,1,11,26,31],"palkia":["water",1,53,36],"heatran":["fire",0.89,29,18],"phione":["water",0.62,22,22],"manaphy":["water",0.89,22,20],"shaymin":["grass",0.89,23,22],"shaymin_sky":["grass",0.89,22,18],"victini":["fire",0.89,21,20],"pansage":["grass",0.26,21,20],"pansear":["fire",0.26,21,19],"panpour":["water",0.26,21,18],"zebstrika":["electric",0.66,2,5,31,30],"tympole":["water",0.21,23,22],"leavanny":["grass",0.67,21,15],"cottonee":["grass",0.18,22,18],"petilil":["grass",0.18,22,18],"basculin_red_striped":["water",0.58,22,20],"basculin_blue_striped":["water",0.58,22,20],"maractus":["grass",0.58,20,14],"tirtouga":["water",0.34,26,18],"ducklett":["water",0.23,22,18],"deerling_spring":["grass",0.3,25,18],"deerling_summer":["grass",0.3,25,18],"deerling_autumn":["grass",0.3,25,18],"deerling_winter":["grass",0.3,25,18],"emolga":["electric",0.51,7,10,24,25],"alomomola":["water",0.6,21,15],"galvantula":["electric",0.6,4,13,28,28],"litwick":["fire",0.17,21,18],"stunfisk":["electric",0.6,7,15,25,28],"heatmor":["fire",0.63,28,14],"virizion":["grass",0.84,28,12],"keldeo":["water",0.84,25,15],"froakie":["water",0.25,21,21],"frogadier":["water",0.46,46,48],"greninja":["water",0.73,25,14]};
const POKEMON_ACTS = {"charizard":"fly","butterfree":"fly","pidgey":"fly","pidgeotto":"fly","pidgeot":"fly","spearow":"fly","fearow":"fly","zubat":"fly","golbat":"fly","poliwag":"jump","poliwhirl":"jump","poliwrath":"jump","farfetchd":"fly","hitmonlee":"jump","hitmonchan":"jump","scyther":"jump","aerodactyl":"fly","articuno":"fly","zapdos":"fly","moltres":"fly","dragonite":"fly","hoothoot":"fly","noctowl":"fly","ledyba":"fly","ledian":"fly","crobat":"fly","togetic":"fly","natu":"fly","xatu":"fly","politoed":"jump","yanma":"fly","murkrow":"fly","gligar":"fly","sneasel":"jump","delibird":"fly","skarmory":"fly","lugia":"fly","hooh":"fly","beautifly":"fly","taillow":"fly","swellow":"fly","wingull":"fly","pelipper":"fly","masquerain":"fly","ninjask":"fly","spoink":"jump","grumpig":"jump","swablu":"fly","altaria":"fly","tropius":"fly","salamence":"fly","starly":"fly","staravia":"fly","staraptor":"fly","mothim":"fly","combee_male":"fly","combee_female":"fly","vespiquen":"fly","buneary":"jump","lopunny":"jump","honchkrow":"fly","chatot":"fly","riolu":"jump","lucario":"jump","croagunk":"jump","toxicroak":"jump","weavile":"jump","togekiss":"fly","yanmega":"fly","gliscor":"fly","pidove":"fly","woobat":"fly","tympole":"jump","sigilyph":"fly","ducklett":"fly","emolga":"fly","braviary":"fly","mandibuzz":"fly","froakie":"jump","frogadier":"jump","greninja":"jump"};
// 타입별 기술 + 특수 행동 — make-moves.py 가 main-bundle.js 의 handleMouseOver 앞에 표와 같이 넣는다
// POKEMON_MOVES[키] = [기술, 세기, 입 x, 입 y] / 전기는 [기술, 세기, 왼, 위, 오른, 아래] 몸 테두리
//   — 좌표는 오른쪽 보는 걷기 그림 첫 프레임 기준 픽셀, 세기는 종족값 기준 0~1 (클수록 크고 길고 화려하게)
// POKEMON_ACTS[키] = 'fly'(날개 있는 비행 타입 — 패널 2/3 높이로 날아다니다 내려옴) | 'jump'(개굴닌자류 — 멀리뛰기)
// MOVE_SPECIAL[키] = 전용기 (개굴닌자 물수리검 등)
const MOVE_AUTO_AVG_SEC = 20; // 평균 이 초마다 누군가 한 번 저절로 기술
const ACT_AUTO_AVG_SEC = { fly: 25, jump: 12 }; // 평균 이 초마다 해당하는 애 중 하나가
const FLY_HEIGHT = 2 / 3; // 패널 높이 대비
// 전용기 — chance 확률로 기본 기술 대신. sprite 는 쓰는 동안 바꿀 그림(<색>_<sprite>_8fps.gif),
// 표창은 first ms 뒤부터 every ms 마다 count 개 (던지는 그림 한 바퀴 = 0.42초에 맞춤)
const MOVE_SPECIAL = {
    greninja: { kind: 'shuriken', chance: 0.6, sprite: 'shoot', first: 180, every: 420, count: 3 }, // 물수리검
};

const moveEmitters = [];
const moveParticles = [];
let moveCanvas;
let moveCtx;
let moveRaf = 0;
let moveLast = 0;
let moveAutoStarted = false;

const moveRand = (min, max) => min + Math.random() * (max - min);
const movePick = (list) => list[Math.floor(Math.random() * list.length)];
const spriteSize = (pokemon) => pokemon.calculateSpriteWidth(pokemon._size, pokemon._originalSpriteSize);
const rightEdge = (pokemon) => Math.max(0, window.innerWidth - spriteSize(pokemon));
// 초당 입자 수 — 셀수록 많이
const moveRate = (kind, power) => ({ fire: 70 + 110 * power, water: 55 + 90 * power, electric: 30 + 70 * power, grass: 10 + 20 * power })[kind];

// 정면(서 있기) 그림이면 아무 쪽으로나, 아니면 보던 쪽
function facingLeft(el) {
    if (el.src.includes('_idle_')) {
        return Math.random() < 0.5;
    }
    return el.style.transform.includes('-1') || el.src.includes('_walk_left_');
}

function faceState(state, left) {
    state.horizontalDirection = left ? states_1.HorizontalDirection.left : states_1.HorizontalDirection.right;
    // 왼쪽 그림이 따로 없으면 setAnimation 이 walk 로 바꾸고 좌우를 뒤집음
    state.spriteLabel = left ? 'walk_left' : 'walk';
}

class MoveState {
    label = "swipe" /* States.swipe */;
    frames = 0;
    constructor(left, hold, sprite) {
        faceState(this, left);
        if (sprite) {
            this.spriteLabel = sprite; // 따로 그림이 있는 전용기 — 왼쪽이면 nextFrame 이 좌우를 뒤집음
        }
        this.hold = hold;
    }
    nextFrame() {
        this.frames += 1;
        return this.frames >= this.hold ? states_1.FrameResult.stateComplete : states_1.FrameResult.stateContinue;
    }
}

// 날아올라 좌우로 날아다니다(살짝 출렁) 내려앉음
class FlyState {
    label = "swipe" /* States.swipe */;
    constructor(pokemon) {
        this.pokemon = pokemon;
        this.dir = Math.random() < 0.5 ? -1 : 1;
        const h = spriteSize(pokemon);
        this.top = Math.max(pokemon.floor + h, window.innerHeight * FLY_HEIGHT - h / 2);
        this.climb = Math.max(2, (this.top - pokemon.floor) / 12); // 1.2초 만에 오르내림
        this.cruise = Math.round(moveRand(40, 80)); // 4~8초
        this.phase = 'up';
        this.t = 0;
        faceState(this, this.dir < 0);
    }
    nextFrame() {
        const p = this.pokemon;
        this.t += 1;
        let x = p.left + this.dir * p.speed * 2.5;
        if (x <= 0 || x >= rightEdge(p)) {
            this.dir = -this.dir;
            faceState(this, this.dir < 0);
            x = Math.min(Math.max(x, 0), rightEdge(p));
        }
        p.positionLeft(x);
        if (this.phase === 'up') {
            p.positionBottom(Math.min(this.top, p.bottom + this.climb));
            if (p.bottom >= this.top) {
                this.phase = 'cruise';
                this.t = 0;
            }
        } else if (this.phase === 'cruise') {
            p.positionBottom(this.top + Math.sin(this.t * 0.35) * 3);
            if (this.t >= this.cruise) {
                this.phase = 'down';
            }
        } else {
            p.positionBottom(Math.max(p.floor, p.bottom - this.climb));
            if (p.bottom <= p.floor) {
                return states_1.FrameResult.stateComplete;
            }
        }
        return states_1.FrameResult.stateContinue;
    }
}

// 포물선으로 몸길이 3~4배 앞으로 폴짝 — 앞이 막혔으면 반대로
class JumpState {
    label = "swipe" /* States.swipe */;
    constructor(pokemon, left) {
        this.pokemon = pokemon;
        const w = spriteSize(pokemon);
        const roomRight = rightEdge(pokemon) - pokemon.left;
        const roomLeft = pokemon.left;
        this.dir = left ? -1 : 1;
        if ((this.dir > 0 ? roomRight : roomLeft) < w * 2) {
            this.dir = -this.dir;
        }
        this.dist = Math.min(w * moveRand(3, 4), this.dir > 0 ? roomRight : roomLeft);
        this.height = w * 0.9;
        this.x0 = pokemon.left;
        this.n = 8;
        this.i = 0;
        faceState(this, this.dir < 0);
    }
    nextFrame() {
        const p = this.pokemon;
        this.i += 1;
        const k = this.i / this.n;
        p.positionLeft(this.x0 + this.dir * this.dist * k);
        p.positionBottom(p.floor + 4 * this.height * k * (1 - k));
        return this.i >= this.n ? states_1.FrameResult.stateComplete : states_1.FrameResult.stateContinue;
    }
}

function startAct(pokemon, act) {
    // 끝나면 swipe 다음 상태(서 있기)로 — 원래 하던 걸로 돌아가면 공중에서 걸을 수 있어서
    pokemon.holdState = undefined;
    pokemon.holdStateEnum = undefined;
    pokemon.currentStateEnum = "swipe" /* States.swipe */;
    pokemon.currentState = act === 'fly' ? new FlyState(pokemon) : new JumpState(pokemon, facingLeft(pokemon.el));
}

function moveCanvasReady() {
    if (!moveCanvas) {
        moveCanvas = document.createElement('canvas');
        // 포켓몬(2) · 공(3) 위, 앞쪽 풀(5) 아래 — CSP 때문에 style 은 속성 하나씩
        moveCanvas.style.position = 'fixed';
        moveCanvas.style.left = '0';
        moveCanvas.style.top = '0';
        moveCanvas.style.margin = '0'; // pokemon.css 의 body>* 위아래 여백(4px)에 밀리지 않게
        moveCanvas.style.width = '100%';
        moveCanvas.style.height = '100%';
        moveCanvas.style.pointerEvents = 'none';
        moveCanvas.style.zIndex = '4';
        document.body.appendChild(moveCanvas);
        moveCtx = moveCanvas.getContext('2d');
    }
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(window.innerWidth * dpr);
    const h = Math.round(window.innerHeight * dpr);
    if (moveCanvas.width !== w || moveCanvas.height !== h) {
        moveCanvas.width = w;
        moveCanvas.height = h;
    }
    moveCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// 번개 한 줄기 — angle 쪽으로 가면서 옆으로 한 칸씩 꺾임
function boltPath(angle, steps, x = 0, y = 0) {
    const points = [];
    for (let i = 0; i < steps; i++) {
        x += Math.cos(angle);
        y += Math.sin(angle);
        if (i % 2 === 1) {
            const side = movePick([-1, 1]);
            x += -Math.sin(angle) * side;
            y += Math.cos(angle) * side;
        }
        points.push([x, y]);
    }
    return points;
}

function spawnParticle(e) {
    const s = e.s;
    const P = e.power;
    const p = { move: e.move, x: e.x, y: e.y, life: 0, s, vx: 0, vy: 0, g: 0, drag: 0 };
    switch (e.move) {
        case 'fire':
            if (Math.random() < 0.25 * P) {
                // 불똥 — 더 멀리 튀다가 떨어짐
                p.move = 'ember';
                p.vx = e.dir * moveRand(50, 80) * (1 + 0.5 * P) * s;
                p.vy = moveRand(-20, -5) * s;
                p.g = 25 * s;
                p.drag = 1.2;
                p.max = moveRand(0.5, 0.9);
                p.color = movePick(['#ffe680', '#ffb347']);
                break;
            }
            p.vx = e.dir * moveRand(28, 48) * (1 + 0.8 * P) * s;
            p.vy = moveRand(-10, 6) * (1 + 0.6 * P) * s;
            p.g = -14 * s; // 불은 위로 뜸
            p.drag = 2.6 - P;
            p.max = moveRand(0.35, 0.6) * (1 + 0.7 * P);
            p.grow = 2 + 2.5 * P;
            break;
        case 'water':
            p.vx = e.dir * moveRand(55, 78) * (1 + 0.6 * P) * s;
            p.vy = moveRand(-16, -4) * s;
            p.g = 130 * (1 - 0.3 * P) * s;
            p.drag = 0.4;
            p.max = moveRand(0.5, 0.8) * (1 + 0.4 * P);
            p.color = movePick(['#e8f7ff', '#8fd3ff', '#8fd3ff', '#3fa2f0']);
            p.size = Math.random() < 0.2 + 0.5 * P ? (P > 0.6 ? 3 : 2) : 1;
            break;
        case 'electric': {
            // 몸 둘레(타원) 안쪽에서 바깥으로 튐 — 셀수록 넓고 길고 갈라짐
            const angle = moveRand(0, Math.PI * 2);
            const reach = 1 + 0.5 * P;
            p.x = e.cx + Math.cos(angle) * e.rx * 0.75 * reach;
            p.y = e.cy + Math.sin(angle) * e.ry * 0.75 * reach;
            p.max = moveRand(0.08, 0.16);
            p.path = boltPath(angle + moveRand(-0.4, 0.4), Math.floor(moveRand(3, 7) + 6 * P));
            if (Math.random() < P) {
                const [mx, my] = p.path[Math.floor(p.path.length / 2)];
                p.path = p.path.concat(boltPath(angle + movePick([-0.9, 0.9]), Math.ceil(p.path.length / 2), mx, my));
            }
            p.thick = P > 0.6 && Math.random() < 0.5;
            break;
        }
        case 'flash':
            // 몸 둘레로 번쩍 퍼지는 고리
            Object.assign(p, { cx: e.cx, cy: e.cy, rx: e.rx * (1 + 0.5 * P), ry: e.ry * (1 + 0.5 * P), max: 0.25 });
            break;
        case 'shuriken':
            // 빙글 돌며 일직선으로 — 셀수록 크고 빠름
            p.dir = e.dir;
            p.vx = e.dir * (120 + 60 * P) * s;
            p.vy = moveRand(-6, 6) * s;
            p.max = 1.6;
            p.arm = P > 0.6 ? 3 : 2;
            break;
        case 'grass':
            p.vx = e.dir * moveRand(40, 60) * (1 + 0.5 * P) * s;
            p.vy = moveRand(-8, 8) * (1 + 0.5 * P) * s;
            p.drag = 0.2;
            p.max = moveRand(0.7, 1.0) * (1 + 0.5 * P);
            p.phase = moveRand(0, Math.PI * 2);
            p.color = movePick(['#8be04e', '#4cae3c', '#2f7d32']);
            p.big = P > 0.55 && Math.random() < 0.6;
            break;
    }
    moveParticles.push(p);
}

function drawParticle(ctx, p) {
    const s = p.s;
    const t = p.life / p.max;
    // 도트 느낌 — 그림 픽셀 칸에 맞춰 찍음
    const px = (v) => Math.round(v / s) * s;
    switch (p.move) {
        case 'fire': {
            const colors = ['#fff6b3', '#ffc93c', '#ff7a21', '#d9381e'];
            const size = s * Math.round(1 + t * p.grow);
            if (t < 0.88) {
                ctx.globalAlpha = 1;
                ctx.fillStyle = colors[Math.min(3, Math.floor(t / 0.22))];
            } else {
                ctx.globalAlpha = (1 - t) / 0.12;
                ctx.fillStyle = '#7a7a7a';
            }
            ctx.fillRect(px(p.x - size / 2), px(p.y - size / 2), size, size);
            break;
        }
        case 'ember':
            ctx.globalAlpha = t < 0.7 ? 1 : (1 - t) / 0.3;
            ctx.fillStyle = p.color;
            ctx.fillRect(px(p.x), px(p.y), s, s);
            break;
        case 'water': {
            const size = s * p.size;
            ctx.globalAlpha = t < 0.7 ? 1 : (1 - t) / 0.3;
            ctx.fillStyle = p.color;
            ctx.fillRect(px(p.x), px(p.y), size, size);
            break;
        }
        case 'electric':
            ctx.globalAlpha = 1;
            p.path.forEach(([x, y], i) => {
                ctx.fillStyle = i < 2 ? '#ffffff' : '#ffe53b';
                ctx.fillRect(px(p.x + x * s), px(p.y + y * s), p.thick ? s * 2 : s, s);
            });
            break;
        case 'shuriken': {
            // + 모양과 x 모양을 번갈아 그려서 도는 것처럼
            const plus = Math.floor(p.life / 0.05) % 2 === 0;
            const dot = (dx, dy, color) => {
                ctx.fillStyle = color;
                ctx.fillRect(px(p.x + dx * s), px(p.y + dy * s), s, s);
            };
            ctx.globalAlpha = 1;
            for (const [ax, ay] of plus ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
                for (let k = 1; k <= (plus ? p.arm : p.arm - 1); k++) {
                    dot(ax * k, ay * k, k === 1 ? '#cdefff' : k < p.arm ? '#8fd3ff' : '#3fa2f0');
                }
            }
            for (const [ax, ay] of plus ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                dot(ax, ay, '#8fd3ff');
            }
            dot(0, 0, '#ffffff');
            break;
        }
        case 'trail':
            ctx.globalAlpha = 1 - t;
            ctx.fillStyle = '#8fd3ff';
            ctx.fillRect(px(p.x), px(p.y), s, s);
            break;
        case 'flash': {
            const grow = 1 + 0.4 * t;
            const dots = Math.max(16, Math.round((p.rx + p.ry) / s));
            ctx.globalAlpha = 1 - t;
            ctx.fillStyle = '#fff9c4';
            for (let i = 0; i < dots; i++) {
                const a = (i / dots) * Math.PI * 2;
                ctx.fillRect(px(p.cx + Math.cos(a) * p.rx * grow), px(p.cy + Math.sin(a) * p.ry * grow), s, s);
            }
            break;
        }
        case 'grass': {
            // 가로 · 세로를 번갈아 그려서 빙글 도는 것처럼
            const flat = Math.floor(p.life / 0.08) % 2 === 0;
            const long = p.big ? 3 : 2;
            const short = p.big ? 2 : 1;
            ctx.globalAlpha = t < 0.8 ? 1 : (1 - t) / 0.2;
            ctx.fillStyle = p.color;
            ctx.fillRect(px(p.x), px(p.y), (flat ? long : short) * s, (flat ? short : long) * s);
            break;
        }
    }
}

function moveTick(now) {
    const dt = moveLast ? Math.min(0.05, (now - moveLast) / 1000) : 0;
    moveLast = now;
    moveCanvasReady();
    const ctx = moveCtx;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (let i = moveEmitters.length - 1; i >= 0; i--) {
        const e = moveEmitters[i];
        if (now >= e.until) {
            moveEmitters.splice(i, 1);
            continue;
        }
        if (e.move === 'shuriken') {
            if (e.shots > 0 && now >= e.nextShot) {
                spawnParticle(e);
                e.shots -= 1;
                e.nextShot += e.every;
            }
            continue;
        }
        if (e.nextFlash && now >= e.nextFlash) {
            spawnParticle({ ...e, move: 'flash' });
            e.nextFlash = e.power > 0.75 ? now + 300 : 0;
        }
        e.acc += dt * moveRate(e.move, e.power);
        while (e.acc >= 1) {
            e.acc -= 1;
            spawnParticle(e);
        }
    }
    for (let i = moveParticles.length - 1; i >= 0; i--) {
        const p = moveParticles[i];
        p.life += dt;
        if (p.life >= p.max) {
            moveParticles.splice(i, 1);
            continue;
        }
        const keep = Math.exp(-p.drag * dt);
        p.vx *= keep;
        p.vy = p.vy * keep + p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.move === 'grass') {
            p.y += Math.sin(p.phase + p.life * 14) * p.s * 0.6;
        }
        if (p.move === 'shuriken') {
            if (p.x < -20 || p.x > window.innerWidth + 20) {
                p.life = p.max;
            } else if (Math.random() < 0.6) {
                moveParticles.push({ move: 'trail', x: p.x, y: p.y + moveRand(-1, 1) * p.s, life: 0, s: p.s, vx: -p.dir * moveRand(5, 20) * p.s, vy: moveRand(-6, 6) * p.s, g: 40 * p.s, drag: 1, max: 0.25 });
            }
        }
        drawParticle(ctx, p);
    }
    ctx.globalAlpha = 1;

    if (moveEmitters.length || moveParticles.length) {
        moveRaf = requestAnimationFrame(moveTick);
    } else {
        moveRaf = 0;
        moveLast = 0;
    }
}

function startMoveEffect(pokemon, move, left, emitMs, special) {
    const kind = special ? special.kind : move[0];
    const power = move[1];
    const size = pokemon._originalSpriteSize || 32;
    const rect = pokemon.el.getBoundingClientRect();
    const s = rect.width / size;
    const dir = left ? -1 : 1;
    // 왼쪽을 보면 그림이 좌우로 뒤집혀 있음
    const sx = (v) => rect.left + (left ? size - v : v) * s;
    const now = performance.now();
    const emitter = { move: kind, power, dir, s, until: now + emitMs, acc: 1 };
    if (kind === 'electric') {
        const [, , l, t, r, b] = move;
        emitter.cx = (sx(l) + sx(r)) / 2;
        emitter.cy = rect.top + ((t + b) / 2) * s;
        emitter.rx = ((r - l) / 2) * s;
        emitter.ry = ((b - t) / 2) * s;
        emitter.nextFlash = power > 0.4 ? now : 0;
    } else {
        const [, , mouthX, mouthY] = move;
        emitter.x = sx(mouthX + 0.5) + dir * s;
        emitter.y = rect.top + (mouthY + 0.5) * s;
    }
    if (special) {
        // 던지는 손 높이 — 입보다 살짝 아래
        emitter.y += 2 * s;
        emitter.shots = special.count;
        emitter.every = special.every;
        emitter.nextShot = now + special.first - 120;
    }
    moveEmitters.push(emitter);
    if (!moveRaf) {
        moveRaf = requestAnimationFrame(moveTick);
    }
}

function useMove(pokemon) {
    const move = POKEMON_MOVES[pokemon.label];
    const current = pokemon.currentState;
    if (!move || !pokemon.canSwipe || current instanceof MoveState || current instanceof JumpState) {
        return;
    }
    const flying = current instanceof FlyState;
    const left = flying ? current.dir < 0 : facingLeft(pokemon.el);
    if (flying) {
        // 공중에서 쓰고 계속 날기
        pokemon.holdState = current;
        pokemon.holdStateEnum = "swipe" /* States.swipe */;
    } else if (pokemon.currentStateEnum !== "swipe" /* States.swipe */) {
        // 마우스를 올려 멈춘 상태(swipe)면 그 전 상태를 그대로 두고 끝나면 돌아감
        pokemon.holdState = current;
        pokemon.holdStateEnum = pokemon.currentStateEnum;
    }
    const special = MOVE_SPECIAL[pokemon.label] && Math.random() < MOVE_SPECIAL[pokemon.label].chance ? MOVE_SPECIAL[pokemon.label] : undefined;
    const emitMs = special ? special.first + special.every * (special.count - 1) : 550 + 650 * move[1];
    pokemon.currentStateEnum = "swipe" /* States.swipe */;
    pokemon.currentState = new MoveState(left, Math.ceil((emitMs + (special ? 300 : 450)) / 100), special?.sprite);
    pokemon.hideSpeechBubble();
    // 다음 프레임에 몸을 돌린 뒤 뿜음
    setTimeout(() => startMoveEffect(pokemon, move, left, emitMs, special), 120);
}

function handleMoveClick(e) {
    exports.allPokemon.pokemonCollection.forEach((element) => {
        if (element.collision === e.currentTarget) {
            useMove(element.pokemon);
        }
    });
}

function startMoveAuto() {
    if (moveAutoStarted) {
        return;
    }
    moveAutoStarted = true;
    const ready = (has) =>
        exports.allPokemon.pokemonCollection.filter(
            (element) => has(element.pokemon.label) && ['sit-idle', 'walk-right', 'walk-left'].includes(element.pokemon.currentStateEnum),
        );
    setInterval(() => {
        if (document.hidden) {
            return;
        }
        if (Math.random() < 1 / MOVE_AUTO_AVG_SEC) {
            const list = ready((key) => POKEMON_MOVES[key]);
            if (list.length) {
                useMove(movePick(list).pokemon);
            }
        }
        for (const act of ['fly', 'jump']) {
            if (Math.random() < 1 / ACT_AUTO_AVG_SEC[act]) {
                const list = ready((key) => POKEMON_ACTS[key] === act);
                if (list.length) {
                    startAct(movePick(list).pokemon, act);
                }
            }
        }
    }, 1000);
}
/* /POKEMON-MOVES-PATCH */
function handleMouseOver(e) {
    var el = e.currentTarget;
    exports.allPokemon.pokemonCollection.forEach((element) => {
        if (element.collision === el) {
            if (!element.pokemon.canSwipe) {
                return;
            }
            element.pokemon.swipe();
        }
    });
}
// LOCAL-PATCH: 마지막 저장 시각 (모든 포켓몬 공용)
let lastSavedAt = 0;
function startAnimations(collision, pokemon, stateApi) {
    if (!stateApi) {
        stateApi = acquireVsCodeApi();
    }
    collision.addEventListener('mouseover', handleMouseOver); /* POKEMON-MOVES-PATCH */ collision.addEventListener('click', handleMoveClick); startMoveAuto(); /* /POKEMON-MOVES-PATCH */
    setInterval(() => {
        var updates = exports.allPokemon.seekNewFriends();
        updates.forEach((message) => {
            stateApi?.postMessage({
                text: message,
                command: 'info',
            });
        });
        pokemon.nextFrame();
        // LOCAL-PATCH: 저장은 1초에 한 번 — 포켓몬마다 0.1초마다 저장하면 버벅임
        if (Date.now() - lastSavedAt >= 1000) {
            lastSavedAt = Date.now();
            saveState(stateApi);
        }
    }, 100);
}
function addPokemonToPanel(pokemonType, basePokemonUri, gen, originalSpriteSize, pokemonColor, pokemonSize, left, bottom, floor, name, stateApi, incrementCounter = true) {
    var pokemonSpriteElement = document.createElement('img');
    pokemonSpriteElement.className = 'pokemon';
    document.getElementById('pokemonContainer').appendChild(pokemonSpriteElement);
    var collisionElement = document.createElement('div');
    collisionElement.className = 'collision';
    document.getElementById('pokemonContainer').appendChild(collisionElement);
    var speechBubbleElement = document.createElement('img');
    speechBubbleElement.className = `bubble bubble-${pokemonSize} b-${originalSpriteSize}`;
    speechBubbleElement.src = `${basePokemonUri}/heart.png`;
    document.getElementById('pokemonContainer').appendChild(speechBubbleElement);
    const root = `${basePokemonUri}/${gen}/${pokemonType}/${pokemonColor}`;
    console.log('Creating new pokemon : ', pokemonType, root, pokemonColor, pokemonSize, name, originalSpriteSize);
    try {
        if (!(0, pokemon_collection_1.availableColors)(pokemonType).includes(pokemonColor)) {
            throw new pokemon_collection_1.InvalidPokemonException('Invalid color for pokemon type');
        }
        var newPokemon = (0, pokemon_collection_1.createPokemon)(pokemonType, pokemonSpriteElement, collisionElement, speechBubbleElement, pokemonSize, left, bottom, root, floor, name, gen, originalSpriteSize);
        if (incrementCounter) {
            pokemonCounter++;
        }
        startAnimations(collisionElement, newPokemon, stateApi);
    }
    catch (e) {
        // Remove elements
        pokemonSpriteElement.remove();
        collisionElement.remove();
        speechBubbleElement.remove();
        throw e;
    }
    pokemonSpriteElement.style.opacity = '0';
    const pokeballEl = document.createElement('div');
    pokeballEl.classList.add('pokeball-sprite');
    // Position pokeball at pokemon location + pokemon center offset
    pokeballEl.style.left = `${left}px`;
    pokeballEl.style.bottom = `${bottom}px`;
    document.getElementById('pokemonContainer').appendChild(pokeballEl);
    pokeballEl.offsetHeight;
    pokeballEl.classList.add('pokeball-open');
    // show pokemon earlier while pokeball animation is still running
    const computed = window.getComputedStyle(pokeballEl);
    const durationStr = (computed.animationDuration || '0s').split(',')[0].trim();
    const durationMs = durationStr.endsWith('ms')
        ? parseFloat(durationStr)
        : parseFloat(durationStr) * 1000;
    const spawnRatio = 0.7;
    const spawnDelay = Math.max(0, durationMs * spawnRatio);
    let spawned = false;
    const showPokemon = () => {
        if (spawned) {
            return;
        }
        spawned = true;
        pokemonSpriteElement.classList.add('spawn-pop');
        pokemonSpriteElement.style.opacity = '1';
        if (pokemonColor === "shiny" /* PokemonColor.shiny */) {
            const shinyOverlay = document.createElement('img');
            shinyOverlay.src = `${basePokemonUri}/shiny-anim.gif?t=${Date.now()}`;
            shinyOverlay.className = 'shiny-overlay';
            shinyOverlay.style.left = pokemonSpriteElement.style.left;
            shinyOverlay.style.bottom = pokemonSpriteElement.style.bottom;
            shinyOverlay.style.width = pokemonSpriteElement.style.width;
            shinyOverlay.style.height = pokemonSpriteElement.style.height;
            document.getElementById('pokemonContainer').appendChild(shinyOverlay);
            const removeOverlay = () => shinyOverlay.remove();
            shinyOverlay.addEventListener('animationend', removeOverlay);
            setTimeout(removeOverlay, 1500);
        }
        saveState(stateApi);
    };
    const spawnTimeout = setTimeout(showPokemon, spawnDelay);
    pokeballEl.addEventListener('animationend', (e) => {
        if (e.animationName !== 'pokeball-open') {
            return;
        }
        pokeballEl.remove();
        clearTimeout(spawnTimeout);
        showPokemon();
    });
    return new pokemon_collection_1.PokemonElement(pokemonSpriteElement, collisionElement, speechBubbleElement, newPokemon, pokemonColor, pokemonType, gen, originalSpriteSize);
}
function removePokemonFromPanel(message, stateApi) {
    if (!stateApi) {
        stateApi = acquireVsCodeApi();
    }
    // Remove elements
    var pokemon = exports.allPokemon.locate(message.name);
    if (!pokemon) {
        stateApi?.postMessage({
            command: 'error',
            text: `Could not find pokemon ${message.name}`,
        });
        return;
    }
    var pokemonSpriteElement = pokemon.el;
    console.log('Removing pokemon ', message.name);
    console.log('pokemon:', pokemon);
    // Remove from collection immediately so rapid deletes of Pokemon don't interfere with each other
    exports.allPokemon.removeFromCollection(message.name);
    pokemon.collision.remove();
    pokemon.speech.remove();
    pokemonCounter = normalizePokemonCounter(pokemonCounter - 1);
    saveState(stateApi);
    stateApi?.postMessage({
        command: 'info',
        text: '👋 Removed pokemon ' + message.name,
    });
    // pokemon fade out
    pokemonSpriteElement.classList.add('fade-out');
    const pokeballEl = document.createElement('div');
    pokeballEl.classList.add('pokeball-sprite');
    pokeballEl.style.left = `${pokemon.pokemon.left}px`;
    pokeballEl.style.bottom = `${pokemon.pokemon.bottom}px`;
    const container = document.getElementById('pokemonContainer');
    container.appendChild(pokeballEl);
    pokeballEl.offsetHeight;
    pokeballEl.classList.add('pokeball-close');
    pokemonSpriteElement.addEventListener('animationend', (e) => {
        if (e.animationName !== 'pokemon-fade-out') {
            return;
        }
        pokemonSpriteElement.remove();
    }, { once: true });
    pokeballEl.addEventListener('animationend', (e) => {
        if (e.animationName !== 'pokeball-close') {
            return;
        }
        pokeballEl.remove();
    }, { once: true });
}
function saveState(stateApi) {
    if (!stateApi) {
        stateApi = acquireVsCodeApi();
    }
    var state = new states_1.PokemonPanelState();
    state.pokemonStates = [];
    exports.allPokemon.pokemonCollection.forEach((pokemonItem) => {
        state.pokemonStates?.push({
            pokemonName: pokemonItem.pokemon.name,
            pokemonColor: pokemonItem.color,
            pokemonType: pokemonItem.type,
            pokemonState: pokemonItem.pokemon.getState(),
            pokemonGeneration: pokemonItem.generation,
            originalSpriteSize: pokemonItem.originalSpriteSize,
            pokemonFriend: pokemonItem.pokemon.friend?.name ?? undefined,
            elLeft: pokemonItem.el.style.left,
            elBottom: pokemonItem.el.style.bottom,
        });
    });
    state.pokemonCounter = normalizePokemonCounter(pokemonCounter);
    stateApi?.setState(state);
}
exports.saveState = saveState;
function recoverState(basePokemonUri, gen, pokemonSize, floor, stateApi) {
    if (!stateApi) {
        stateApi = acquireVsCodeApi();
    }
    var state = stateApi?.getState();
    if (!state) {
        pokemonCounter = 0;
    }
    else {
        pokemonCounter = normalizePokemonCounter(state.pokemonCounter);
    }
    var recoveryMap = new Map();
    console.log('recoverState: saved pokemon count =', state?.pokemonStates?.length ?? 0);
    state?.pokemonStates?.forEach((p) => {
        console.log('Recovering pokemon ', p.pokemonType, p.pokemonName);
        try {
            console.log('Adding pokemon to panel for recovery');
            var newPokemon = addPokemonToPanel(p.pokemonType ?? 'bulbasaur', basePokemonUri, p.pokemonGeneration ?? 'gen1', p.originalSpriteSize ?? 32, p.pokemonColor ?? "default" /* PokemonColor.default */, pokemonSize, parseInt(p.elLeft ?? '0'), parseInt(p.elBottom ?? '0'), floor, p.pokemonName ?? (0, names_1.randomName)(), stateApi, false);
            exports.allPokemon.push(newPokemon);
            recoveryMap.set(newPokemon.pokemon, p);
        }
        catch (InvalidPokemonException) {
            console.log('State had invalid pokemon (' + p.pokemonType + '), discarding.');
        }
    });
    recoveryMap.forEach((state, pokemon) => {
        // Recover previous state.
        if (state.pokemonState !== undefined) {
            pokemon.recoverState(state.pokemonState);
        }
        // Resolve friend relationships
        var friend = undefined;
        if (state.pokemonFriend) {
            friend = exports.allPokemon.locate(state.pokemonFriend);
            if (friend) {
                pokemon.recoverFriend(friend.pokemon);
            }
        }
    });
}
function randomStartPosition() {
    return Math.floor(Math.random() * (window.innerWidth * 0.7));
}
let canvas, ctx;
function initCanvas() {
    canvas = document.getElementById('pokemonCanvas');
    if (!canvas) {
        console.log('Canvas not ready');
        return;
    }
    ctx = canvas.getContext('2d');
    if (!ctx) {
        console.log('Canvas context not ready');
        return;
    }
    ctx.canvas.width = window.innerWidth;
    ctx.canvas.height = window.innerHeight;
}
// It cannot access the main VS Code APIs directly.
function pokemonPanelApp(basePokemonUri, theme, themeKind, pokemonColor, pokemonSize, pokemonType, throwBallWithMouse, gen, originalSpriteSize, stateApi) {
    var floor = 0;
    if (!stateApi) {
        stateApi = acquireVsCodeApi();
    }
    // Apply Theme backgrounds
    const foregroundEl = document.getElementById('foreground');
    if (theme !== "none" /* Theme.none */) {
        var _themeKind = '';
        switch (themeKind) {
            case 2 /* ColorThemeKind.dark */:
                _themeKind = 'dark';
                break;
            case 1 /* ColorThemeKind.light */:
                _themeKind = 'light';
                break;
            case 3 /* ColorThemeKind.highContrast */:
            default:
                _themeKind = 'light';
                break;
        }
        document.body.style.backgroundImage = `url('${basePokemonUri}/backgrounds/${theme}/background-${_themeKind}-${pokemonSize}.png')`;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        foregroundEl.style.backgroundImage = `url('${basePokemonUri}/backgrounds/${theme}/foreground-${_themeKind}-${pokemonSize}.png')`;
        floor = calculateFloor(pokemonSize, theme); /* POKEMON-FIT-PATCH */ fitThemeBackground(foregroundEl, floor); // Themes have pokemonCollection at a specified height from the ground
    }
    else {
        document.body.style.backgroundImage = '';
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        foregroundEl.style.backgroundImage = '';
    }
    console.log('Starting pokemon session', pokemonColor, basePokemonUri, pokemonType, throwBallWithMouse);
    // New session
    var state = stateApi?.getState();
    const hasRecoverableState = state !== undefined &&
        Array.isArray(state.pokemonStates) &&
        state.pokemonStates.length > 0;
    if (hasRecoverableState) {
        console.log('Recovering state - ', state);
        recoverState(basePokemonUri, gen, pokemonSize, floor, stateApi);
    }
    else {
        console.log('No recoverable pokemon state, starting an empty session.');
        pokemonCounter = normalizePokemonCounter(state?.pokemonCounter);
        saveState(stateApi);
    }
    initCanvas();
    // Handle messages sent from the extension to the webview
    window.addEventListener('message', (event) => {
        const message = event.data; // The json data that the extension sent
        console.log('Received message in panel:', message);
        switch (message.command) {
            case 'spawn-pokemon':
                console.log('adding pokemon to panel from message', message);
                exports.allPokemon.push(addPokemonToPanel(message.type, basePokemonUri, message.generation, message.originalSpriteSize, message.color, pokemonSize, randomStartPosition(), floor, floor, message.name ?? (0, names_1.randomName)(), stateApi));
                saveState(stateApi);
                break;
            case 'spawn-random-pokemon':
                var [randomPokemonType, randomPokemonConfig] = (0, pokemon_data_1.getRandomPokemonConfig)();
                console.log('adding random pokemon to panel from message');
                exports.allPokemon.push(addPokemonToPanel(randomPokemonType, basePokemonUri, randomPokemonConfig.generation.toString(), randomPokemonConfig.originalSpriteSize ?? 32, "default" /* PokemonColor.default */, pokemonSize, randomStartPosition(), floor, floor, (0, names_1.randomName)(), stateApi));
                saveState(stateApi);
                break;
            case 'list-pokemon':
                var pokemonCollection = exports.allPokemon.pokemonCollection;
                stateApi?.postMessage({
                    command: 'list-pokemon',
                    text: pokemonCollection
                        .map((pokemon) => `${pokemon.type},${pokemon.pokemon.name},${pokemon.color}`)
                        .join('\n'),
                });
                break;
            case 'roll-call':
                var pokemonCollection = exports.allPokemon.pokemonCollection;
                // go through every single
                // pokemon and then print out their name
                pokemonCollection.forEach((pokemon) => {
                    stateApi?.postMessage({
                        command: 'info',
                        text: `${pokemon.pokemon.emoji} ${pokemon.pokemon.name} (${pokemon.color} ${pokemon.type}): ${pokemon.pokemon.hello}`,
                    });
                });
                break;
            case 'delete-pokemon':
                removePokemonFromPanel(message, stateApi);
                break;
            case 'reset-pokemon':
                var pokemonToRemove = [...exports.allPokemon.pokemonCollection];
                pokemonToRemove.forEach((pokemon) => {
                    removePokemonFromPanel({ name: pokemon.pokemon.name }, stateApi);
                });
                // Wait for animations to complete before resetting
                setTimeout(() => {
                    exports.allPokemon.reset();
                    pokemonCounter = 0;
                    saveState(stateApi);
                }, 500);
                break;
            case 'pause-pokemon':
                pokemonCounter = 1;
                saveState(stateApi);
                break;
        }
    });
}
exports.pokemonPanelApp = pokemonPanelApp;
window.addEventListener('resize', function () {
    initCanvas();
});


/***/ }),

/***/ "./src/panel/pokemon-collection.ts":
/*!*****************************************!*\
  !*** ./src/panel/pokemon-collection.ts ***!
  \*****************************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.normalizeColor = exports.availableColors = exports.createPokemon = exports.InvalidPokemonException = exports.PokemonCollection = exports.PokemonElement = void 0;
const pokemon_1 = __webpack_require__(/*! ./pokemon */ "./src/panel/pokemon.ts");
class PokemonElement {
    el;
    collision;
    speech;
    pokemon;
    color;
    type;
    generation;
    originalSpriteSize;
    remove() {
        this.el.remove();
        this.collision.remove();
        this.speech.remove();
        this.color = "null" /* PokemonColor.null */;
    }
    constructor(el, collision, speech, pokemon, color, type, generation, originalSpriteSize) {
        this.el = el;
        this.collision = collision;
        this.speech = speech;
        this.pokemon = pokemon;
        this.color = color;
        this.type = type;
        this.generation = generation;
        this.originalSpriteSize = originalSpriteSize;
    }
}
exports.PokemonElement = PokemonElement;
class PokemonCollection {
    _pokemonCollection;
    constructor() {
        this._pokemonCollection = new Array(0);
    }
    get pokemonCollection() {
        return this._pokemonCollection;
    }
    push(pokemon) {
        this._pokemonCollection.push(pokemon);
    }
    reset() {
        this._pokemonCollection.forEach((pokemon) => {
            pokemon.remove();
        });
        this._pokemonCollection = [];
    }
    locate(name) {
        return this._pokemonCollection.find((collection) => {
            return collection.pokemon.name === name;
        });
    }
    remove(name) {
        const idx = this._pokemonCollection.findIndex((pokemon) => pokemon.pokemon.name === name);
        if (idx === -1) {
            return;
        }
        this._pokemonCollection[idx].remove();
        this._pokemonCollection.splice(idx, 1);
    }
    removeFromCollection(name) {
        const idx = this._pokemonCollection.findIndex((pokemon) => pokemon.pokemon.name === name);
        if (idx === -1) {
            return;
        }
        this._pokemonCollection.splice(idx, 1);
    }
    seekNewFriends() {
        if (this._pokemonCollection.length <= 1) {
            return [];
        } // You can't be friends with yourself.
        var messages = new Array(0);
        this._pokemonCollection.forEach((pokemonInCollection) => {
            if (pokemonInCollection.pokemon.hasFriend) {
                return;
            } // I already have a friend!
            this._pokemonCollection.forEach((potentialFriend) => {
                if (potentialFriend.pokemon.hasFriend) {
                    return;
                } // Already has a friend. sorry.
                if (!potentialFriend.pokemon.canChase) {
                    return;
                } // Pokemon is busy doing something else.
                if (potentialFriend.pokemon.left > pokemonInCollection.pokemon.left &&
                    potentialFriend.pokemon.left <
                        pokemonInCollection.pokemon.left + pokemonInCollection.pokemon.width) {
                    // We found a possible new friend..
                    console.log(pokemonInCollection.pokemon.name, ' wants to be friends with ', potentialFriend.pokemon.name, '.');
                    if (pokemonInCollection.pokemon.makeFriendsWith(potentialFriend.pokemon)) {
                        potentialFriend.pokemon.showSpeechBubble(2000, true);
                        pokemonInCollection.pokemon.showSpeechBubble(2000, true);
                    }
                }
            });
        });
        return messages;
    }
}
exports.PokemonCollection = PokemonCollection;
class InvalidPokemonException {
    message;
    constructor(message) {
        this.message = message;
    }
}
exports.InvalidPokemonException = InvalidPokemonException;
function createPokemon(pokemonType, el, collision, speech, size, left, bottom, pokemonRoot, floor, name, generation, originalSpriteSize) {
    if (!name) {
        throw new InvalidPokemonException('name is undefined');
    }
    try {
        return new pokemon_1.Pokemon(pokemonType, el, collision, speech, size, left, bottom, pokemonRoot, floor, name, 3 /* PokemonSpeed.normal */, generation, originalSpriteSize);
    }
    catch (error) {
        throw new InvalidPokemonException(`Invalid Pokemon type: ${pokemonType}`);
    }
}
exports.createPokemon = createPokemon;
function availableColors(pokemonType) {
    const pokemon = pokemon_1.Pokemon.getPokemonData(pokemonType);
    return pokemon ? pokemon.possibleColors : ["default" /* PokemonColor.default */];
}
exports.availableColors = availableColors;
function normalizeColor(pokemonColor, pokemonType) {
    const colors = availableColors(pokemonType);
    return colors.includes(pokemonColor) ? pokemonColor : colors[0];
}
exports.normalizeColor = normalizeColor;


/***/ }),

/***/ "./src/panel/pokemon.ts":
/*!******************************!*\
  !*** ./src/panel/pokemon.ts ***!
  \******************************/
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.POKEMON_NAMES = exports.Pokemon = void 0;
const pokemon_data_1 = __webpack_require__(/*! ../common/pokemon-data */ "./src/common/pokemon-data.ts");
const base_pokemon_type_1 = __webpack_require__(/*! ./base-pokemon-type */ "./src/panel/base-pokemon-type.ts");
class Pokemon extends base_pokemon_type_1.BasePokemonType {
    config;
    constructor(pokemonType, spriteElement, collisionElement, speechElement, size, left, bottom, pokemonRoot, floor, name, speed, generation, originalSpriteSize) {
        super(spriteElement, collisionElement, speechElement, size, left, bottom, pokemonRoot, floor, name, speed, generation, originalSpriteSize);
        this.config = pokemon_data_1.POKEMON_DATA[pokemonType] || pokemon_data_1.POKEMON_DATA.bulbasaur;
        this.label = pokemonType;
    }
    static possibleColors = ["default" /* PokemonColor.default */];
    sequence = {
        startingState: "sit-idle" /* States.sitIdle */,
        sequenceStates: [
            {
                state: "sit-idle" /* States.sitIdle */,
                possibleNextStates: ["walk-left" /* States.walkLeft */, "walk-right" /* States.walkRight */],
            },
            {
                state: "walk-left" /* States.walkLeft */,
                possibleNextStates: ["sit-idle" /* States.sitIdle */, "walk-right" /* States.walkRight */],
            },
            {
                state: "walk-right" /* States.walkRight */,
                possibleNextStates: ["sit-idle" /* States.sitIdle */, "walk-left" /* States.walkLeft */],
            },
            {
                state: "swipe" /* States.swipe */,
                possibleNextStates: ["sit-idle" /* States.sitIdle */],
            },
        ],
    };
    get generation() {
        return this.config.generation;
    }
    get pokedexNumber() {
        return this.config.id;
    }
    showSpeechBubble(duration = 3000, friend) {
        super.showSpeechBubble(duration, friend);
    }
    static getPokemonData(type) {
        return pokemon_data_1.POKEMON_DATA[type];
    }
}
exports.Pokemon = Pokemon;
exports.POKEMON_NAMES = [
    'Bella',
    'Charlie',
    'Molly',
    'Coco',
    'Ruby',
    'Oscar',
    'Lucy',
    'Bailey',
    'Milo',
    'Daisy',
    'Archie',
    'Ollie',
    'Rosie',
    'Lola',
    'Frankie',
    'Roxy',
    'Poppy',
    'Luna',
    'Jack',
    'Millie',
    'Teddy',
    'Cooper',
    'Bear',
    'Rocky',
    'Alfie',
    'Hugo',
    'Bonnie',
    'Pepper',
    'Lily',
    'Tilly',
    'Leo',
    'Maggie',
    'George',
    'Mia',
    'Marley',
    'Harley',
    'Chloe',
    'Lulu',
    'Missy',
    'Jasper',
    'Billy',
    'Nala',
    'Monty',
    'Ziggy',
    'Winston',
    'Zeus',
    'Zoe',
    'Stella',
    'Sasha',
    'Rusty',
    'Gus',
    'Baxter',
    'Dexter',
    'Willow',
    'Barney',
    'Bruno',
    'Penny',
    'Honey',
    'Milly',
    'Murphy',
    'Simba',
    'Holly',
    'Benji',
    'Henry',
    'Lilly',
    'Pippa',
    'Shadow',
    'Sam',
    'Lucky',
    'Ellie',
    'Duke',
    'Jessie',
    'Cookie',
    'Harvey',
    'Bruce',
    'Jax',
    'Rex',
    'Louie',
    'Jet',
    'Banjo',
];


/***/ }),

/***/ "./src/panel/states.ts":
/*!*****************************!*\
  !*** ./src/panel/states.ts ***!
  \*****************************/
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.StandLeftState = exports.StandRightState = exports.JumpDownLeftState = exports.ClimbWallLeftState = exports.ChaseFriendState = exports.ChaseState = exports.RunLeftState = exports.RunRightState = exports.WalkLeftState = exports.WalkRightState = exports.IdleWithBallState = exports.SwipeState = exports.LandState = exports.WallHangLeftState = exports.LieState = exports.SitIdleState = exports.resolveState = exports.isStateAboveGround = exports.BallState = exports.FrameResult = exports.HorizontalDirection = exports.PokemonPanelState = exports.PokemonElementState = exports.PokemonInstanceState = void 0;
class PokemonInstanceState {
    currentStateEnum;
}
exports.PokemonInstanceState = PokemonInstanceState;
class PokemonElementState {
    pokemonState;
    pokemonGeneration;
    originalSpriteSize;
    pokemonType;
    pokemonColor;
    elLeft;
    elBottom;
    pokemonName;
    pokemonFriend;
}
exports.PokemonElementState = PokemonElementState;
class PokemonPanelState {
    pokemonStates;
    pokemonCounter;
}
exports.PokemonPanelState = PokemonPanelState;
var HorizontalDirection;
(function (HorizontalDirection) {
    HorizontalDirection[HorizontalDirection["left"] = 0] = "left";
    HorizontalDirection[HorizontalDirection["right"] = 1] = "right";
    HorizontalDirection[HorizontalDirection["natural"] = 2] = "natural";
})(HorizontalDirection = exports.HorizontalDirection || (exports.HorizontalDirection = {}));
var FrameResult;
(function (FrameResult) {
    FrameResult[FrameResult["stateContinue"] = 0] = "stateContinue";
    FrameResult[FrameResult["stateComplete"] = 1] = "stateComplete";
    // Special states
    FrameResult[FrameResult["stateCancel"] = 2] = "stateCancel";
})(FrameResult = exports.FrameResult || (exports.FrameResult = {}));
class BallState {
    cx;
    cy;
    vx;
    vy;
    paused;
    constructor(cx, cy, vx, vy) {
        this.cx = cx;
        this.cy = cy;
        this.vx = vx;
        this.vy = vy;
        this.paused = false;
    }
}
exports.BallState = BallState;
function isStateAboveGround(state) {
    return (state === "climb-wall-left" /* States.climbWallLeft */ ||
        state === "jump-down-left" /* States.jumpDownLeft */ ||
        state === "land" /* States.land */ ||
        state === "wall-hang-left" /* States.wallHangLeft */);
}
exports.isStateAboveGround = isStateAboveGround;
function resolveState(state, pokemon) {
    switch (state) {
        case "sit-idle" /* States.sitIdle */:
            return new SitIdleState(pokemon);
        case "walk-right" /* States.walkRight */:
            return new WalkRightState(pokemon);
        case "walk-left" /* States.walkLeft */:
            return new WalkLeftState(pokemon);
        case "run-right" /* States.runRight */:
            return new RunRightState(pokemon);
        case "run-left" /* States.runLeft */:
            return new RunLeftState(pokemon);
        case "lie" /* States.lie */:
            return new LieState(pokemon);
        case "wall-hang-left" /* States.wallHangLeft */:
            return new WallHangLeftState(pokemon);
        case "climb-wall-left" /* States.climbWallLeft */:
            return new ClimbWallLeftState(pokemon);
        case "jump-down-left" /* States.jumpDownLeft */:
            return new JumpDownLeftState(pokemon);
        case "land" /* States.land */:
            return new LandState(pokemon);
        case "swipe" /* States.swipe */:
            return new SwipeState(pokemon);
        case "idle-with-ball" /* States.idleWithBall */:
            return new IdleWithBallState(pokemon);
        case "chase-friend" /* States.chaseFriend */:
            return new ChaseFriendState(pokemon);
        case "stand-right" /* States.standRight */:
            return new StandRightState(pokemon);
        case "stand-left" /* States.standLeft */:
            return new StandLeftState(pokemon);
    }
    return new SitIdleState(pokemon);
}
exports.resolveState = resolveState;
class AbstractStaticState {
    label = "sit-idle" /* States.sitIdle */;
    idleCounter;
    spriteLabel = 'idle';
    holdTime = 50;
    pokemon;
    horizontalDirection = HorizontalDirection.left;
    constructor(pokemon) {
        this.idleCounter = 0;
        this.pokemon = pokemon;
    }
    nextFrame() {
        this.idleCounter++;
        if (this.idleCounter > this.holdTime) {
            return FrameResult.stateComplete;
        }
        return FrameResult.stateContinue;
    }
}
class SitIdleState extends AbstractStaticState {
    label = "sit-idle" /* States.sitIdle */;
    spriteLabel = 'idle';
    horizontalDirection = HorizontalDirection.right;
    holdTime = 50;
}
exports.SitIdleState = SitIdleState;
class LieState extends AbstractStaticState {
    label = "lie" /* States.lie */;
    spriteLabel = 'lie';
    horizontalDirection = HorizontalDirection.right;
    holdTime = 50;
}
exports.LieState = LieState;
class WallHangLeftState extends AbstractStaticState {
    label = "wall-hang-left" /* States.wallHangLeft */;
    spriteLabel = 'wallgrab';
    horizontalDirection = HorizontalDirection.left;
    holdTime = 50;
}
exports.WallHangLeftState = WallHangLeftState;
class LandState extends AbstractStaticState {
    label = "land" /* States.land */;
    spriteLabel = 'land';
    horizontalDirection = HorizontalDirection.left;
    holdTime = 10;
}
exports.LandState = LandState;
class SwipeState extends AbstractStaticState {
    label = "swipe" /* States.swipe */;
    spriteLabel = 'idle'; // use base idle sprite
    horizontalDirection = HorizontalDirection.natural;
    holdTime = 15;
}
exports.SwipeState = SwipeState;
class IdleWithBallState extends AbstractStaticState {
    label = "idle-with-ball" /* States.idleWithBall */;
    spriteLabel = 'with_ball';
    horizontalDirection = HorizontalDirection.left;
    holdTime = 30;
}
exports.IdleWithBallState = IdleWithBallState;
class WalkRightState {
    label = "walk-right" /* States.walkRight */;
    pokemon;
    spriteLabel = 'walk';
    horizontalDirection = HorizontalDirection.right;
    leftBoundary;
    speedMultiplier = 1;
    idleCounter;
    holdTime = 60;
    constructor(pokemon) {
        this.leftBoundary = Math.floor(window.innerWidth * 0.95);
        this.pokemon = pokemon;
        this.idleCounter = 0;
    }
    nextFrame() {
        this.idleCounter++;
        this.pokemon.positionLeft(this.pokemon.left + this.pokemon.speed * this.speedMultiplier);
        // Random chance to stop in the middle
        if (this.pokemon.isMoving && Math.random() < 0.01) {
            return FrameResult.stateComplete;
        }
        if (this.pokemon.isMoving &&
            this.pokemon.left >= this.leftBoundary - this.pokemon.width) {
            return FrameResult.stateComplete;
        }
        else if (!this.pokemon.isMoving && this.idleCounter > this.holdTime) {
            return FrameResult.stateComplete;
        }
        return FrameResult.stateContinue;
    }
}
exports.WalkRightState = WalkRightState;
class WalkLeftState {
    label = "walk-left" /* States.walkLeft */;
    spriteLabel = 'walk_left';
    horizontalDirection = HorizontalDirection.left;
    pokemon;
    speedMultiplier = 1;
    idleCounter;
    holdTime = 60;
    constructor(pokemon) {
        this.pokemon = pokemon;
        this.idleCounter = 0;
    }
    nextFrame() {
        this.idleCounter++;
        this.pokemon.positionLeft(this.pokemon.left - this.pokemon.speed * this.speedMultiplier);
        // Random chance to stop in the middle
        if (this.pokemon.isMoving && Math.random() < 0.01) {
            return FrameResult.stateComplete;
        }
        if (this.pokemon.isMoving && this.pokemon.left <= 0) {
            return FrameResult.stateComplete;
        }
        else if (!this.pokemon.isMoving && this.idleCounter > this.holdTime) {
            return FrameResult.stateComplete;
        }
        return FrameResult.stateContinue;
    }
}
exports.WalkLeftState = WalkLeftState;
class RunRightState extends WalkRightState {
    label = "run-right" /* States.runRight */;
    spriteLabel = 'walk_fast';
    speedMultiplier = 1.6;
    holdTime = 130;
}
exports.RunRightState = RunRightState;
class RunLeftState extends WalkLeftState {
    label = "run-left" /* States.runLeft */;
    spriteLabel = 'walk_fast';
    speedMultiplier = 1.6;
    holdTime = 130;
}
exports.RunLeftState = RunLeftState;
class ChaseState {
    label = "chase" /* States.chase */;
    spriteLabel = 'run';
    horizontalDirection = HorizontalDirection.left;
    ballState;
    canvas;
    pokemon;
    constructor(pokemon, ballState, canvas) {
        this.pokemon = pokemon;
        this.ballState = ballState;
        this.canvas = canvas;
    }
    nextFrame() {
        if (this.ballState.paused) {
            return FrameResult.stateCancel; // Ball is already caught
        }
        if (this.pokemon.left > this.ballState.cx) {
            this.horizontalDirection = HorizontalDirection.left;
            this.pokemon.positionLeft(this.pokemon.left - this.pokemon.speed);
        }
        else {
            this.horizontalDirection = HorizontalDirection.right;
            this.pokemon.positionLeft(this.pokemon.left + this.pokemon.speed);
        }
        if (this.canvas.height - this.ballState.cy <
            this.pokemon.width + this.pokemon.floor &&
            this.ballState.cx < this.pokemon.left &&
            this.pokemon.left < this.ballState.cx + 15) {
            // hide ball
            this.canvas.style.display = 'none';
            this.ballState.paused = true;
            return FrameResult.stateComplete;
        }
        return FrameResult.stateContinue;
    }
}
exports.ChaseState = ChaseState;
class ChaseFriendState {
    label = "chase-friend" /* States.chaseFriend */;
    spriteLabel = 'run';
    horizontalDirection = HorizontalDirection.left;
    pokemon;
    constructor(pokemon) {
        this.pokemon = pokemon;
    }
    nextFrame() {
        if (!this.pokemon.hasFriend || !this.pokemon.friend?.isPlaying) {
            return FrameResult.stateCancel; // Friend is no longer playing.
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (this.pokemon.left > this.pokemon.friend.left) {
            this.horizontalDirection = HorizontalDirection.left;
            this.pokemon.positionLeft(this.pokemon.left - this.pokemon.speed);
        }
        else {
            this.horizontalDirection = HorizontalDirection.right;
            this.pokemon.positionLeft(this.pokemon.left + this.pokemon.speed);
        }
        return FrameResult.stateContinue;
    }
}
exports.ChaseFriendState = ChaseFriendState;
class ClimbWallLeftState {
    label = "climb-wall-left" /* States.climbWallLeft */;
    spriteLabel = 'wallclimb';
    horizontalDirection = HorizontalDirection.left;
    pokemon;
    constructor(pokemon) {
        this.pokemon = pokemon;
    }
    nextFrame() {
        this.pokemon.positionBottom(this.pokemon.bottom + 1);
        if (this.pokemon.bottom >= 100) {
            return FrameResult.stateComplete;
        }
        return FrameResult.stateContinue;
    }
}
exports.ClimbWallLeftState = ClimbWallLeftState;
class JumpDownLeftState {
    label = "jump-down-left" /* States.jumpDownLeft */;
    spriteLabel = 'fall_from_grab';
    horizontalDirection = HorizontalDirection.right;
    pokemon;
    constructor(pokemon) {
        this.pokemon = pokemon;
    }
    nextFrame() {
        this.pokemon.positionBottom(this.pokemon.bottom - 5);
        if (this.pokemon.bottom <= this.pokemon.floor) {
            this.pokemon.positionBottom(this.pokemon.floor);
            return FrameResult.stateComplete;
        }
        return FrameResult.stateContinue;
    }
}
exports.JumpDownLeftState = JumpDownLeftState;
class StandRightState extends AbstractStaticState {
    label = "stand-right" /* States.standRight */;
    spriteLabel = 'stand';
    horizontalDirection = HorizontalDirection.right;
    holdTime = 60;
}
exports.StandRightState = StandRightState;
class StandLeftState extends AbstractStaticState {
    label = "stand-right" /* States.standRight */;
    spriteLabel = 'stand';
    horizontalDirection = HorizontalDirection.left;
    holdTime = 60;
}
exports.StandLeftState = StandLeftState;


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__("./src/panel/main.ts");
/******/ 	self.pokemonApp = __webpack_exports__;
/******/ 	
/******/ })()
;