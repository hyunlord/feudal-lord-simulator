/**
 * ARCH-1 (spec docs/design/map-archetypes.md AR-6): a new game on a chosen land — the engine's half of the start
 * screen's choice (the picker itself is render's). The riverside town is today's map (seed 1, `DEFAULT_GAME_STATE`);
 * a new land draws its map from (land, seed) and stamps the same opening village on its town site (AR-2 ②).
 */
import { SCENARIOS, archetypeById } from "../content/scenario/registry";
import type { ArchetypeDef } from "../content/scenario/types";
import type { GameState } from "../engine/engine.types";
import { buildArchetypeWorldGrid } from "../world/archetypeTerrain";
import { DEFAULT_GAME_STATE } from "./gameStore";
import { applyOpeningVillageToTile } from "./openingVillage";

export interface NewGameOptions {
  readonly scenarioId: string;
  /** The land (`namespace:id`); absent = the scenario's own (the riverside town). */
  readonly archetypeId?: string;
  /** The map's seed, a whole number from 1; the riverside town's map is seed 1 only. */
  readonly seed?: number;
}

/** AR-6: the lands a new game can start on, in the start screen's order. */
export function mapArchetypes(): readonly ArchetypeDef[] {
  return SCENARIOS.listArchetypes();
}

/** AR-6: the opening state of a new game, or null for an unknown scenario, land or seed. */
export function newGameState(options: NewGameOptions): GameState | null {
  const scenario = SCENARIOS.get(options.scenarioId);
  if (scenario === undefined) return null;
  const archetype = archetypeById(options.archetypeId ?? scenario.archetype);
  const seed = options.seed ?? DEFAULT_GAME_STATE.seed;
  if (archetype === undefined || !Number.isInteger(seed) || seed < 1) return null;
  if (archetype.terrain.kind === "river") {
    return seed === DEFAULT_GAME_STATE.seed ? { ...structuredClone(DEFAULT_GAME_STATE), scenarioId: options.scenarioId } : null;
  }
  const world = buildArchetypeWorldGrid(archetype, { width: DEFAULT_GAME_STATE.width, height: DEFAULT_GAME_STATE.height, seed });
  return { ...structuredClone(DEFAULT_GAME_STATE), scenarioId: options.scenarioId, archetypeId: archetype.id, seed,
    tiles: world.tiles.map(applyOpeningVillageToTile) };
}
