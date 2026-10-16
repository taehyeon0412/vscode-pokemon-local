"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.randomName = void 0;
const pokemon_1 = require("../panel/pokemon");
function randomName() {
    const collection = pokemon_1.POKEMON_NAMES;
    return collection[Math.floor(Math.random() * collection.length)] ?? 'Unknown';
}
exports.randomName = randomName;
//# sourceMappingURL=names.js.map