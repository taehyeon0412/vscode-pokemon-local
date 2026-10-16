"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POKEMON_NAMES = exports.Pokemon = void 0;
const pokemon_data_1 = require("../common/pokemon-data");
const base_pokemon_type_1 = require("./base-pokemon-type");
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
//# sourceMappingURL=pokemon.js.map