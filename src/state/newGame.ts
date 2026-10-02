/**
 * ARCH-1 (spec docs/design/map-archetypes.md MA-6): a new game on a chosen land — the engine's half of the start
 * screen's choice (the picker itself is render's). A new land draws its map from (land, seed) and stamps the same
 * opening village on its town site (MA-2 ②). LM-E5 (LG-1): the riverside town too — seed 1 is today's map
 * (`DEFAULT_GAME_STATE`), any other seed its own river, woods and fields with the village on its nearest legal site; a
 * new game draws its seed at random (`randomNewGameSeed`), shows it and can be started again from it.
 */
import { LORD_SLICE_SCENARIO_ID } from "../content/scenario/coreScenarios";
import { SCENARIOS, archetypeById } from "../content/scenario/registry";
import type { ArchetypeDef } from "../content/scenario/types";
import type { GameState } from "../engine/engine.types";
import { buildArchetypeWorld } from "../world/archetypeTerrain";
import { DEFAULT_GAME_STATE } from "./gameStore";
import { applyOpeningVillageToTile, placeManorSite } from "./openingVillage";
import { initialAgency } from "../engine/townAgency";
import { InvalidGrowthOpeningError, seededOpening } from "./growthOpening";

/** LG-1: the seeds a new game draws from (six digits at most, so a player can read and type one). */
export const NEW_GAME_SEED_MAX = 999_999;

/**
 * LG-1 API: a new game's seed, drawn at random (the only randomness outside a game's own seed; `random` is injectable
 * for tests) — one whose map has a game (`newGameState` not null), else the next seed.
 */
export function randomNewGameSeed(options: Omit<NewGameOptions, "seed">, random: () => number = Math.random): number {
  const first = 1 + Math.floor(random() * NEW_GAME_SEED_MAX);
  for (let step = 0; step < NEW_GAME_SEED_MAX; step += 1) {
    const seed = 1 + (first - 1 + step) % NEW_GAME_SEED_MAX;
    if (newGameState({ ...options, seed }) !== null) return seed;
  }
  return DEFAULT_GAME_STATE.seed;
}

export interface NewGameOptions {
  readonly scenarioId: string;
  /** The land (`namespace:id`); absent = the scenario's own (the riverside town). */
  readonly archetypeId?: string;
  /** The map's seed, a whole number from 1 (the same seed, the same game). */
  readonly seed?: number;
  /**
   * LM-E1 (TA-1): "lord" — the town builds itself (the town agency) and the player sets its conditions; "sandbox"
   * (the default, today's game) — the player builds. A different axis from the scenario's campaign / sandbox.
   */
  readonly mode?: "lord" | "sandbox";
}

/** MA-6: the lands a new game can start on, in the start screen's order. */
export function mapArchetypes(): readonly ArchetypeDef[] {
  return SCENARIOS.listArchetypes();
}

/** MA-6: the opening state of a new game, or null for an unknown scenario, land or seed. */
export function newGameState(options: NewGameOptions): GameState | null {
  const state = openingState(options);
  // LM-E1 (TA-1): lord mode's town starts with its actors (the campaign's default stays sandbox). LM-E8 (LS-1): the lord's
  // slice is always lord mode.
  const lord = options.mode === "lord" || options.scenarioId === LORD_SLICE_SCENARIO_ID;
  return state === null || !lord ? state : { ...state, agency: initialAgency() };
}

function openingState(options: NewGameOptions): GameState | null {
  const scenario = SCENARIOS.get(options.scenarioId);
  if (scenario === undefined) return null;
  const archetype = archetypeById(options.archetypeId ?? scenario.archetype);
  const seed = options.seed ?? DEFAULT_GAME_STATE.seed;
  if (archetype === undefined || !Number.isInteger(seed) || seed < 1) return null;
  if (archetype.terrain.kind === "river") {
    if (seed === DEFAULT_GAME_STATE.seed) return placeManorSite({ ...structuredClone(DEFAULT_GAME_STATE), scenarioId: options.scenarioId });
    // LM-E5 (LG-1): another seed's own riverside map (a map with no legal site for the village has no game).
    try {
      return { ...seededOpening(seed).state, scenarioId: options.scenarioId };
    } catch (error) {
      if (error instanceof InvalidGrowthOpeningError) return null;
      throw error;
    }
  }
  const { width, height } = DEFAULT_GAME_STATE;
  const world = buildArchetypeWorld(archetype, { width, height, seed });
  const { river: _river, ...opening } = structuredClone(DEFAULT_GAME_STATE);
  // FIX-11 (MH-1): the manor house on the land's nearest free grass to the opening village's north-west.
  return placeManorSite({ ...opening, scenarioId: options.scenarioId, archetypeId: archetype.id, seed,
    ...(world.river === null ? {} : { river: world.river }),
    tiles: world.terrains.map((terrain, index) => applyOpeningVillageToTile({ tx: index % width, ty: Math.floor(index / width), terrain, buildingId: null, hasRoad: false })) });
}
