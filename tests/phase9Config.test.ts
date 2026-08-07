import assert from "node:assert/strict";
import test from "node:test";

import { RESOURCE_TYPES, STORABLE_RESOURCE_TYPES } from "../src/content/resourceConfig";
import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import type { Building } from "../src/economy/economy.types";
import {
  acceptsResource,
  reserve,
} from "../src/economy/storage";
import type { GameState } from "../src/engine/engine.types";
import {
  buildMenuGroups,
  buildToolTooltipLines,
} from "../src/ui/buildMenuModel";
import { canPlaceBuilding, PlacementFailure } from "../src/world/placement";
import type { Tile } from "../src/world/world.types";
import { constructionOnSiteLabel } from "../src/economy/construction";
import { cargoColor } from "../src/render/drawWalkers";
import { SEMANTIC_PALETTE } from "../src/content/palette";
import { buildingBodyProfile } from "../src/render/buildingVisualState";

function tile(tx: number, ty: number, input: Partial<Tile> = {}): Tile {
  return {
    tx,
    ty,
    terrain: "grass",
    buildingId: null,
    hasRoad: false,
    ...input,
  };
}

function state(input: {
  readonly era?: GameState["era"];
  readonly treasuryTimber?: number;
  readonly tiles?: readonly Tile[];
  readonly buildings?: readonly Building[];
} = {}): GameState {
  const width = input.tiles === undefined ? 8 : 4;
  const height = input.tiles === undefined ? 8 : Math.ceil(input.tiles.length / width);
  return {
    tick: 0,
    seed: 1,
    width,
    height,
    tiles: [...(input.tiles ?? Array.from({ length: width * height }, (_unused, index) => tile(index % width, Math.floor(index / width))))],
    buildings: [...(input.buildings ?? [])],
    constructionSites: [],
    houses: [],
    walkers: [],
    population: 0,
    idleWorkers: 0,
    treasuryTimber: input.treasuryTimber ?? 500,
    treasuryCoin: 0,
    wallTick: 0,
    era: input.era ?? "hamlet",
    eraProclaimedTick: null,
    palisade: null,
    forestHarvests: [],
    nextConstructionOrdinal: 1,
    roadRevision: 0,
    pathCache: {},
  };
}

function building(kind: Building["kind"]): Building {
  return {
    id: `${kind}-test`,
    kind,
    tx: 0,
    ty: 0,
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}

test("Phase 9 resource contracts include stone while coin remains treasury-only", () => {
  // Given / When / Then
  assert.deepEqual(RESOURCE_TYPES, ["wheat", "bread", "logs", "timber", "stone_raw", "stone", "coin"]);
  assert.deepEqual(STORABLE_RESOURCE_TYPES, ["wheat", "bread", "logs", "timber", "stone_raw", "stone"]);
  assert.equal(acceptsResource("storehouse", "stone_raw"), true);
  assert.equal(acceptsResource("storehouse", "stone"), true);
  assert.equal(acceptsResource("granary", "stone_raw"), false);
  assert.equal(acceptsResource("granary", "stone"), false);
  assert.equal(acceptsResource("storehouse", "coin"), false);
  assert.equal(acceptsResource("granary", "coin"), false);
  assert.deepEqual(reserve(building("storehouse"), "coin", 1).reserved, {});
});

test("Phase 9 stone buildings have exact palisade-era config", () => {
  // Given / When / Then
  assert.deepEqual(BUILDING_CONFIG_BY_KIND.quarry, {
    kind: "quarry",
    name: "채석장",
    width: 2,
    height: 2,
    workersRequired: 4,
    buildCost: { timber: 50 },
    requiresAdjacentTerrain: "rock",
    requiresRoad: true,
    unlockEra: "palisade",
    production: {
      output: "stone_raw",
      input: null,
      inputPerOutput: 0,
      ticksPerOutput: 60,
    },
    storageCapacity: 20,
    serviceRadius: 0,
  });
  assert.deepEqual(BUILDING_CONFIG_BY_KIND.masonry, {
    kind: "masonry",
    name: "석공소",
    width: 1,
    height: 1,
    workersRequired: 3,
    buildCost: { timber: 45 },
    requiresAdjacentTerrain: null,
    requiresRoad: true,
    unlockEra: "palisade",
    production: {
      output: "stone",
      input: "stone_raw",
      inputPerOutput: 2,
      ticksPerOutput: 45,
    },
    storageCapacity: 20,
    serviceRadius: 0,
  });
});

test("Phase 9 market has exact palisade-era config and visible menu copy", () => {
  // Given
  const palisade = state({ era: "palisade" });

  // When / Then
  assert.deepEqual(BUILDING_CONFIG_BY_KIND.market, {
    kind: "market",
    name: "시장",
    width: 2,
    height: 2,
    workersRequired: 3,
    buildCost: { timber: 60 },
    requiresAdjacentTerrain: null,
    requiresRoad: true,
    unlockEra: "palisade",
    production: null,
    storageCapacity: 0,
    serviceRadius: 8,
  });
  assert.equal(buildMenuGroups(state({ era: "hamlet" })).some((group) => group.options.some((option) => option.tool === "market")), false);
  assert.equal(buildMenuGroups(palisade).some((group) => group.options.some((option) => option.tool === "market" && option.label === "시장")), true);
  assert.ok(buildToolTooltipLines("market", palisade).some((line) => line.includes("금화")));
  assert.deepEqual(buildingBodyProfile("market", 0).roofColor, SEMANTIC_PALETTE.goldDark);
});

test("Phase 9 unlock and quarry rock placement rules are enforced in placement and menu models", () => {
  // Given
  const palisadeTiles = [
    tile(0, 0), tile(1, 0, { hasRoad: true }), tile(2, 0), tile(3, 0),
    tile(0, 1), tile(1, 1), tile(2, 1), tile(3, 1),
    tile(0, 2), tile(1, 2), tile(2, 2), tile(3, 2, { terrain: "rock" }),
    tile(0, 3), tile(1, 3), tile(2, 3), tile(3, 3),
  ];
  const hamlet = state({ tiles: palisadeTiles, era: "hamlet" });
  const palisade = state({ tiles: palisadeTiles, era: "palisade" });

  // When / Then
  assert.deepEqual(canPlaceBuilding(hamlet, "quarry", 1, 1), {
    ok: false,
    reason: PlacementFailure.locked_era,
  });
  assert.deepEqual(canPlaceBuilding(palisade, "quarry", 1, 1), { ok: true });
  assert.deepEqual(canPlaceBuilding(palisade, "quarry", 0, 1), {
    ok: false,
    reason: PlacementFailure.needs_adjacent_terrain,
  });
  assert.equal(buildMenuGroups(hamlet).some((group) => group.options.some((option) => option.tool === "quarry")), false);
  assert.equal(buildMenuGroups(palisade).some((group) => group.options.some((option) => option.tool === "quarry")), true);
  assert.ok(buildToolTooltipLines("quarry", palisade).some((line) => line.includes("바위")));
  assert.ok(buildToolTooltipLines("masonry", palisade).some((line) => line.includes("석공소")));
});

test("Phase 9 labels and fallback colour tokens cover stone cargo and construction", () => {
  // Given
  const site = {
    id: "stone-site",
    kind: "masonry",
    tx: 1,
    ty: 1,
    required: { stone_raw: 2, stone: 1 },
    delivered: {},
    reserved: {},
    builderTicks: 0,
    requiredBuilderTicks: 600,
    assignedBuilders: 0,
    stall: "awaiting_materials",
    startedTick: 0,
  } as const;

  // When / Then
  assert.match(constructionOnSiteLabel(site), /원석/);
  assert.equal(cargoColor("stone_raw"), SEMANTIC_PALETTE.stoneDark);
  assert.equal(cargoColor("stone"), SEMANTIC_PALETTE.stone);
  assert.equal(cargoColor("coin"), SEMANTIC_PALETTE.gold);
  assert.deepEqual(buildingBodyProfile("quarry", 0).fill, SEMANTIC_PALETTE.stoneDark);
  assert.deepEqual(buildingBodyProfile("masonry", 0).fill, SEMANTIC_PALETTE.stone);
});
