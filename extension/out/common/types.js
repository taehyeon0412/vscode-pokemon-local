"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_THEMES = exports.ALL_SCALES = exports.ALL_COLORS = exports.WebviewMessage = exports.PokemonGeneration = void 0;
var PokemonGeneration;
(function (PokemonGeneration) {
    PokemonGeneration[PokemonGeneration["Gen1"] = 1] = "Gen1";
    PokemonGeneration[PokemonGeneration["Gen2"] = 2] = "Gen2";
    PokemonGeneration[PokemonGeneration["Gen3"] = 3] = "Gen3";
    PokemonGeneration[PokemonGeneration["Gen4"] = 4] = "Gen4";
    PokemonGeneration[PokemonGeneration["Gen5"] = 5] = "Gen5";
/* POKEMON-EXTRA-PATCH */ PokemonGeneration[PokemonGeneration["Gen6"] = 6] = "Gen6"; /* /POKEMON-EXTRA-PATCH */
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
//# sourceMappingURL=types.js.map