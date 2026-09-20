import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import { buildingRoadAccessTiles } from "../src/engine/routing";
import { canPlaceBuilding } from "../src/world/placement";
import { findExistingRoadPath } from "../src/world/roadGraph";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { applyOpeningVillageToTile } from "../src/state/openingVillage";
import { buildWorldGrid } from "../src/world/terrain";

export class InvalidGrowthOpeningError extends Error {
  readonly code = "invalid-opening-fixture";
  constructor(readonly seed: number, readonly issues: readonly string[]) {
    super(`Invalid opening fixture for seed ${seed}: ${issues.join("; ")}. No natural simulation ran; a legal seed-aware game opening is not implemented.`);
    this.name = "InvalidGrowthOpeningError";
  }
}

/** Validate the granted opening's geography, not its already-granted construction cost. */
function assertLegalOpening(state: GameState): void {
  const issues: string[] = [];
  for (const building of state.buildings) {
    const cleared = { ...state, buildings: state.buildings.filter(item => item.id !== building.id),
      tiles: state.tiles.map(tile => tile.buildingId === building.id ? { ...tile, buildingId: null } : tile) };
    const placement = canPlaceBuilding(cleared, building.kind, building.tx, building.ty);
    if (!placement.ok && placement.reason !== "insufficient_materials") issues.push(`${building.id}: ${placement.reason}`);
  }
  for (const tile of state.tiles) {
    if (tile.hasRoad && (tile.terrain === "water" || tile.buildingId !== null)) {
      issues.push(`road(${tile.tx},${tile.ty}): ${tile.terrain === "water" ? "water" : "occupied"}`);
    }
  }
  const granary = state.buildings.find(building => building.kind === "granary");
  const starts = granary === undefined ? [] : buildingRoadAccessTiles(state, granary);
  for (const building of state.buildings.filter(item => BUILDING_CONFIG_BY_KIND[item.kind].requiresRoad)) {
    const ends = buildingRoadAccessTiles(state, building);
    if (!starts.some(start => ends.some(destination => findExistingRoadPath(state, { start, destination }) !== null))) {
      issues.push(`${building.id}: disconnected-from-opening-granary`);
    }
  }
  if (issues.length > 0) throw new InvalidGrowthOpeningError(state.seed, issues.slice(0, 32));
}

/** Reuses the game's terrain and opening-village construction, without changing its default seed. */
export function createGrowthInitialState(seed: number) {
  const state = structuredClone(DEFAULT_GAME_STATE);
  const world = buildWorldGrid({ width: state.width, height: state.height, seed });
  const initial = { ...state, seed, tiles: world.tiles.map(applyOpeningVillageToTile) };
  assertLegalOpening(initial);
  return initial;
}

/** Run-local continuous qualifying window; observations are completed simulation ticks. */
export function createGrowthStability(targetLots: number) {
  let stableSince: number | null = null;
  let sustainedTicks = 0;
  let interruptions = 0;
  return {
    observe(sample: { readonly tick: number; readonly lots: number; readonly victory: boolean; readonly fullService: boolean }) {
      if (sample.lots >= targetLots && sample.victory && sample.fullService) {
        stableSince ??= sample.tick;
        sustainedTicks = sample.tick - stableSince + 1;
      } else {
        if (stableSince !== null) interruptions += 1;
        stableSince = null;
        sustainedTicks = 0;
      }
    },
    report: () => ({ stableSince, sustainedTicks, interruptions, complete: sustainedTicks >= 24_000 }),
  };
}
