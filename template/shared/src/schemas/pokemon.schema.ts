import { z } from "zod";

/**
 * Pokemon Schema
 *
 * Shared Zod schema between server and web for type safety and validation.
 * This ensures server tool output and widget expectations are always in sync.
 */

const PokemonTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const PokemonAbilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
});

const PokemonStatSchema = z.object({
  name: z.string(),
  value: z.number(),
});

const PokemonEvolutionSchema = z.object({
  id: z.number(),
  name: z.string(),
  order: z.number(),
  imageUrl: z.string().url(),
  isCurrent: z.boolean(),
});

/**
 * Main Pokemon Schema (Single Source of Truth)
 */
export const PokemonSchema = z.object({
  id: z.number(),
  name: z.string(),
  color: z.string(),
  description: z.string(),
  order: z.number(),
  imageUrl: z.string().url(),
  weightInKilograms: z.number(),
  heightInMeters: z.number(),
  types: z.array(PokemonTypeSchema),
  abilities: z.array(PokemonAbilitySchema),
  evolutions: z.array(PokemonEvolutionSchema),
  stats: z.array(PokemonStatSchema),
});

/**
 * Inferred TypeScript type
 */
export type Pokemon = z.infer<typeof PokemonSchema>;

/**
 * Example Pokemon data for development and testing
 * Used by widgetMeta export and can be used for mock data
 */
export const examplePokemonData: Pokemon = {
  id: 25,
  name: "pikachu",
  color: "yellow",
  description: "When several of these Pokémon gather, their electricity can build and cause lightning storms.",
  order: 35,
  imageUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png",
  weightInKilograms: 6.0,
  heightInMeters: 0.4,
  types: [
    {
      id: "electric",
      name: "Electric",
    },
  ],
  abilities: [
    {
      id: "static",
      name: "Static",
      description: "Contact with the Pokémon may cause paralysis.",
    },
    {
      id: "lightning-rod",
      name: "Lightning Rod",
      description: "Draws in all Electric-type moves to boost its Sp. Atk stat.",
    },
  ],
  evolutions: [
    {
      id: 172,
      name: "pichu",
      order: 218,
      imageUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/172.png",
      isCurrent: false,
    },
    {
      id: 25,
      name: "pikachu",
      order: 35,
      imageUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png",
      isCurrent: true,
    },
    {
      id: 26,
      name: "raichu",
      order: 36,
      imageUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/26.png",
      isCurrent: false,
    },
  ],
  stats: [
    { name: "hp", value: 35 },
    { name: "attack", value: 55 },
    { name: "defense", value: 40 },
    { name: "special-attack", value: 50 },
    { name: "special-defense", value: 50 },
    { name: "speed", value: 90 },
  ],
};
