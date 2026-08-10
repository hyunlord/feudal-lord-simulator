import assert from "node:assert/strict";
import test from "node:test";

import type { Building, BuildingKind } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { onboardingWorldGuidanceTargets } from "../src/ui/onboardingWorldGuidance";
import type { Tile } from "../src/world/world.types";

const EXISTING_KINDS = ["house", "logging_camp"] as const satisfies readonly BuildingKind[];

test("building guidance does not rescan the world for a road that cannot unlock placement", () => {
  const width = 8;
  const height = 8;
  const tiles = grassGrid(width, height);
  tiles[1] = { ...tiles[1]!, hasRoad: true };
  let tileReads = 0;
  const observedTiles = new Proxy(tiles, {
    get(target, property, receiver) {
      if (typeof property === "string" && /^\d+$/.test(property)) tileReads += 1;
      return Reflect.get(target, property, receiver);
    },
  });
  const state: GameState = {
    ...DEFAULT_GAME_STATE,
    width,
    height,
    tiles: observedTiles,
    buildings: EXISTING_KINDS.map(building),
    constructionSites: [],
    houses: [{
      buildingId: "house-0-0-0",
      level: 0,
      residents: 3,
      hasWater: true,
      breadStock: 0,
      lastServicedTick: 0,
      starvationGraceUntilTick: 0,
      unmetRequirementTicks: 0,
    }],
    walkers: [],
    population: 3,
    treasuryTimber: 0,
    pathCache: {},
  };

  assert.deepEqual(onboardingWorldGuidanceTargets(state), []);
  assert.ok(
    tileReads <= tiles.length * 8,
    `guidance read ${tileReads} tile entries for ${tiles.length} tiles`,
  );
});

function grassGrid(width: number, height: number): Tile[] {
  return Array.from({ length: width * height }, (_, index) => ({
    tx: index % width,
    ty: Math.floor(index / width),
    terrain: "grass",
    buildingId: index === 0 ? "house-0-0-0" : null,
    hasRoad: false,
  }));
}

function building(kind: BuildingKind, index: number): Building {
  return {
    id: kind === "house" ? "house-0-0-0" : `${kind}-${index}`,
    kind,
    tx: kind === "house" ? 0 : 2 + (index % 4),
    ty: kind === "house" ? 0 : 2 + Math.floor(index / 4),
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}
