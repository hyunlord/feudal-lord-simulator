import { marketRoadService } from "../src/engine/marketService";
import assert from "node:assert/strict";
import test from "node:test";

import type { Building } from "../src/content/buildingConfig";
import { marketAccessDiagnosis } from "../src/population/marketAccess";
import { updateHouse, updateHousing } from "../src/population/housing";
import type { House } from "../src/population/population.types";
import { houseDiagnosisModel } from "../src/ui/houseDiagnosisModel";
import type { GameState } from "../src/engine/engine.types";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import type { ConstructionSite } from "../src/economy/construction";
import type { Tile } from "../src/world/world.types";

function building(
  id: string,
  kind: Building["kind"],
  tx: number,
  ty: number,
  workers = 0,
): Building {
  return {
    id,
    kind,
    tx,
    ty,
    workers,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}

function house(input: Partial<House> = {}): House {
  return {
    buildingId: "home",
    level: 2,
    residents: 4,
    hasWater: true,
    breadStock: 1,
    lastServicedTick: 10,
    unmetRequirementTicks: 0,
    promotionTicks: 8399,
    ...input,
  };
}

function state(buildings: readonly Building[], household: House = house()): GameState {
  const width = 18;
  const height = 6;
  const ownerByTile = new Map<string, string>();
  for (const placed of buildings) {
    const size = placed.kind === "market" || placed.kind === "storehouse" || placed.kind === "granary" ? 2 : 1;
    for (let dy = 0; dy < size; dy += 1) {
      for (let dx = 0; dx < size; dx += 1) {
        ownerByTile.set(`${placed.tx + dx},${placed.ty + dy}`, placed.id);
      }
    }
  }
  return {
    ...DEFAULT_GAME_STATE,
    tick: 10,
    width,
    height,
    tiles: Array.from({ length: width * height }, (_unused, index): Tile => {
      const tx = index % width;
      const ty = Math.floor(index / width);
      return {
        tx,
        ty,
        terrain: "grass",
        buildingId: ownerByTile.get(`${tx},${ty}`) ?? null,
        hasRoad: ty === 0,
      };
    }),
    buildings: [...buildings],
    houses: [household],
    population: household.residents,
    treasuryCoin: 0,
  };
}

test("market access is a future level-four gate without changing levels zero through three", () => {
  // Given: all current level-three requirements are met but no market gate exists.
  const input = house();

  // When
  const withoutMarket = updateHouse(input, {
    tick: 10,
    hasGranaryNearby: true,
    hasMarketAccess: false,
  });
  const withMarket = updateHouse(input, {
    tick: 10,
    hasGranaryNearby: true,
    hasMarketAccess: true,
  });

  // Then: current levels remain behavior-identical.
  assert.equal(withoutMarket.level, 3);
  assert.deepEqual(withMarket, withoutMarket);
});

test("completed market footprint distance eight grants access and distance nine does not", () => {
  // Given: a home, granary, and markets at exact boundary distances.
  const home = building("home", "house", 1, 1);
  const well = building("well", "well", 1, 2);
  const granary = building("granary", "granary", 1, 3);
  const withinMarket = building("market-within", "market", 9, 1, 3);
  const outsideMarket = building("market-outside", "market", 10, 1, 3);

  // When
  const within = updateHousing([house()], [home, well, granary, withinMarket], 10);
  const outside = updateHousing([house()], [home, well, granary, outsideMarket], 10);

  // Then
  assert.equal(within.houses[0]?.level, 3);
  assert.equal(outside.houses[0]?.level, 3);
  assert.equal(within.houses[0]?.unmetRequirementTicks, 0);
  assert.equal(outside.houses[0]?.unmetRequirementTicks, 0);
});

test("house diagnosis reports within outside and no-market access without mutating state", () => {
  // Given
  const home = building("home", "house", 1, 1);
  const within = state([home, building("market", "market", 9, 1, 3)]);
  // MARKET-1 (MK-1): reach runs along the road; a market 9 tiles off with the road cut between is out of reach.
  const far = state([home, building("market", "market", 10, 1, 3)]);
  const outside = { ...far, tiles: far.tiles.map(tile => tile.tx === 5 && tile.ty === 0 ? { ...tile, hasRoad: false } : tile) };
  const missing = state([home]);

  // When
  const before = structuredClone(within);
  const withinModel = houseDiagnosisModel(within, "home");
  const outsideModel = houseDiagnosisModel(outside, "home");
  const missingModel = houseDiagnosisModel(missing, "home");

  // Then
  assert.deepEqual(within, before);
  assert.equal(withinModel?.market.kind, "within");
  assert.equal(withinModel?.market.distance, 8);
  assert.equal(outsideModel?.market.kind, "outside");
  assert.equal(outsideModel?.market.distance, 9);
  assert.equal(missingModel?.market.kind, "no_market");
});

test("unfinished market does not count for housing diagnosis", () => {
  // Given: a nearby construction-site market but no completed market building.
  const input = {
    ...state([building("home", "house", 1, 1)]),
    constructionSites: [
      {
        id: "market-site",
        kind: "market",
        tx: 10,
        ty: 1,
        required: { timber: 60 },
        delivered: {},
        reserved: {},
        builderTicks: 0,
        requiredBuilderTicks: 700,
        assignedBuilders: 0,
        stall: "awaiting_materials",
        startedTick: 0,
      },
    ] satisfies ConstructionSite[],
  };

  // When
  const model = houseDiagnosisModel(input, "home");

  // Then
  assert.equal(model?.market.kind, "no_market");
});

test("market service stops on a cut road or insufficient staffing and recovers on restoration", () => {
  const home = building("home", "house", 1, 1);
  const market = building("market", "market", 9, 1, 3);
  const connected = state([home, market]);
  const cut = { ...connected, tiles: connected.tiles.map(tile => tile.tx === 5 && tile.ty === 0 ? { ...tile, hasRoad: false } : tile) };
  assert.equal(marketAccessDiagnosis(home, connected.buildings, marketRoadService(connected)).kind, "within");
  assert.equal(marketAccessDiagnosis(home, cut.buildings, marketRoadService(cut)).kind, "unreachable");
  assert.equal(marketAccessDiagnosis(home, [home, { ...market, workers: 2 }], marketRoadService(connected)).kind, "understaffed");
  assert.equal(marketAccessDiagnosis(home, connected.buildings, marketRoadService(connected)).kind, "within");
});

test("market roads respect completed walls and permit the gate", () => {
  const home = building("home", "house", 1, 1);
  const market = building("market", "market", 9, 1, 3);
  const connected = state([home, market]);
  const wall = { gate: { x: 5, y: 4 }, segments: [{ completed: true, edgePath: [{ x: 5, y: 0 }, { x: 5, y: 5 }] }] };
  assert.equal(marketAccessDiagnosis(home, connected.buildings, marketRoadService({ ...connected, palisade: wall })).kind, "unreachable");
  assert.equal(marketAccessDiagnosis(home, connected.buildings, marketRoadService({ ...connected, palisade: { ...wall, gate: { x: 5, y: 0.5 } } })).kind, "within");
});

test("compound home can receive market service from only its second tile frontage", () => {
  const home: Building = { ...building("home", "house", 1, 1), houseLot: "horizontal" };
  const market = building("market", "market", 9, 1, 3);
  const input = state([home, market]);
  const grid = { ...input, tiles: input.tiles.map(tile => ({ ...tile, hasRoad: tile.ty === 0 && tile.tx >= 2 })) };
  assert.equal(marketAccessDiagnosis(home, grid.buildings, marketRoadService(grid)).kind, "within");
});
