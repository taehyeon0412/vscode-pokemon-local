"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeColor = exports.availableColors = exports.createPokemon = exports.InvalidPokemonException = exports.PokemonCollection = exports.PokemonElement = void 0;
const pokemon_1 = require("./pokemon");
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
//# sourceMappingURL=pokemon-collection.js.map