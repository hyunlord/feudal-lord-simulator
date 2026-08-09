import assert from "node:assert/strict";
import test from "node:test";

import { BUILDING_CONFIG_BY_KIND, type Building, type BuildingKind } from "../src/content/buildingConfig";
import type { ResourceType } from "../src/content/resourceConfig";
import { createConstructionSite } from "../src/economy/construction";
import { decideNextAction } from "../src/engine/autoplay";
import type { GameState } from "../src/engine/engine.types";
import type { House } from "../src/population/population.types";
import type { Tile } from "../src/world/world.types";

function building(input: {
  readonly id: string;
  readonly kind: BuildingKind;
  readonly tx: number;
  readonly ty: number;
  readonly inventory?: Partial<Record<ResourceType, number>>;
  readonly workers?: number;
}): Building {
  return {
    id: input.id,
    kind: input.kind,
    tx: input.tx,
    ty: input.ty,
    workers: input.workers ?? 0,
    inventory: input.inventory ?? {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}

function house(buildingId: string, patch: Partial<House> = {}): House {
  return {
    buildingId,
    level: 0,
    residents: 4,
    hasWater: false,
    breadStock: 0,
    lastServicedTick: 0,
    unmetRequirementTicks: 0,
    ...patch,
  };
}

function tiles(buildings: readonly Building[], roads: readonly string[] = ["1,5", "2,5", "3,5"]): Tile[] {
  return Array.from({ length: 12 * 12 }, (_unused, index): Tile => {
    const tx = index % 12;
    const ty = Math.floor(index / 12);
    const owner = buildings.find((candidate) => {
      const definition = BUILDING_CONFIG_BY_KIND[candidate.kind];
      return tx >= candidate.tx &&
        tx < candidate.tx + definition.width &&
        ty >= candidate.ty &&
        ty < candidate.ty + definition.height;
    });
    return {
      tx,
      ty,
      terrain: tx === 0 ? "forest" : "grass",
      buildingId: owner?.id ?? null,
      hasRoad: roads.includes(`${tx},${ty}`),
    };
  });
}

function state(input: {
  readonly buildings: readonly Building[];
  readonly houses?: readonly House[];
  readonly roads?: readonly string[];
  readonly population?: number;
  readonly idleWorkers?: number;
  readonly timber?: number;
}): GameState {
  const houses = input.houses ?? [];
  return {
    tick: 0,
    seed: 1,
    width: 12,
    height: 12,
    tiles: tiles(input.buildings, input.roads),
    buildings: [...input.buildings],
    constructionSites: [],
    houses: [...houses],
    walkers: [],
    population: input.population ?? houses.reduce((total, candidate) => total + candidate.residents, 0),
    idleWorkers: input.idleWorkers ?? 0,
    treasuryTimber: input.timber ?? 500,
    treasuryCoin: 0,
    wallTick: 0,
    era: "hamlet",
    eraProclaimedTick: null,
    palisade: null,
    forestHarvests: [],
    nextConstructionOrdinal: 1,
    roadRevision: 1,
    pathCache: {},
  };
}

function fullHouse(candidate: Building): House {
  return house(candidate.id, { hasWater: true, breadStock: 40, residents: 22, lastServicedTick: 0, level: 3 });
}

test("Given low bread and no food chain When autoplay decides repeatedly Then it follows wheat farm, mill, granary priority before timber recovery", () => {
  const home = building({ id: "house-a", kind: "house", tx: 5, ty: 5 });
  const well = building({ id: "well-a", kind: "well", tx: 5, ty: 4 });
  const wheat = building({ id: "wheat-a", kind: "wheat_farm", tx: 2, ty: 2 });
  const mill = building({ id: "mill-a", kind: "mill", tx: 4, ty: 2 });
  const base = {
    houses: [house(home.id, { hasWater: true, breadStock: 0, lastServicedTick: -10_000 })],
    timber: 500,
    roads: ["1,5", "2,5", "3,5", "5,6", "2,4", "4,3"],
  };

  assert.deepEqual(decideNextAction(state({ ...base, buildings: [home, well] })), { kind: "place_building", building: "wheat_farm", tx: 6, ty: 5 });
  assert.deepEqual(decideNextAction(state({ ...base, buildings: [home, well, wheat] })), { kind: "place_building", building: "mill", tx: 4, ty: 6 });
  assert.deepEqual(decideNextAction(state({ ...base, buildings: [home, well, wheat, mill] })), { kind: "place_building", building: "granary", tx: 6, ty: 5 });
});

test("Given full housing and one food chain When autoplay decides Then it expands wheat before another cottage", () => {
  const homes = ["a", "b", "c", "d"].map((suffix, index) =>
    building({ id: `house-${suffix}`, kind: "house", tx: 5 + (index % 2), ty: 5 + Math.floor(index / 2) })
  );
  const food = [
    building({ id: "well-a", kind: "well", tx: 5, ty: 4 }),
    building({ id: "granary-a", kind: "granary", tx: 1, ty: 1, inventory: { bread: 40 }, workers: 2 }),
    building({ id: "wheat-a", kind: "wheat_farm", tx: 3, ty: 1, workers: 4 }),
    building({ id: "mill-a", kind: "mill", tx: 6, ty: 1, workers: 2 }),
  ];
  const actual = decideNextAction(state({
    buildings: [...homes, ...food],
    houses: homes.map(fullHouse),
    population: 88,
    idleWorkers: 8,
    roads: ["1,3", "2,3", "3,3", "5,7", "6,7", "3,4", "6,3"],
  }));

  assert.equal(actual.kind, "place_building");
  assert.equal(actual.kind === "place_building" ? actual.building : null, "wheat_farm");
});

test("Given supplemental wheat completed When a second mill is missing Then autoplay resumes the food chain instead of waiting forever", () => {
  const homes = ["a", "b", "c", "d"].map((suffix, index) =>
    building({ id: `house-${suffix}`, kind: "house", tx: 5 + (index % 2), ty: 5 + Math.floor(index / 2) })
  );
  const food = [
    building({ id: "well-a", kind: "well", tx: 5, ty: 4 }),
    building({ id: "granary-a", kind: "granary", tx: 1, ty: 1, inventory: { bread: 40 }, workers: 2 }),
    building({ id: "wheat-a", kind: "wheat_farm", tx: 3, ty: 1, workers: 4 }),
    building({ id: "wheat-b", kind: "wheat_farm", tx: 8, ty: 1, workers: 4 }),
    building({ id: "mill-a", kind: "mill", tx: 6, ty: 1, workers: 2 }),
  ];
  const actual = decideNextAction(state({
    buildings: [...homes, ...food],
    houses: homes.map(fullHouse),
    population: 88,
    idleWorkers: 8,
    roads: ["1,3", "2,3", "3,3", "5,7", "6,7", "3,4", "6,3", "8,3"],
  }));

  assert.equal(actual.kind, "place_building");
  assert.equal(actual.kind === "place_building" ? actual.building : null, "mill");
});

test("Given food support is under construction When housing is full Then autoplay waits instead of adding a cottage early", () => {
  const homes = ["a", "b", "c", "d"].map((suffix, index) =>
    building({ id: `house-${suffix}`, kind: "house", tx: 5 + (index % 2), ty: 5 + Math.floor(index / 2) })
  );
  const current = state({
    buildings: [
      ...homes,
      building({ id: "well-a", kind: "well", tx: 5, ty: 4 }),
      building({ id: "granary-a", kind: "granary", tx: 1, ty: 1, inventory: { bread: 40 }, workers: 2 }),
      building({ id: "wheat-a", kind: "wheat_farm", tx: 3, ty: 1, workers: 4 }),
      building({ id: "mill-a", kind: "mill", tx: 6, ty: 1, workers: 2 }),
    ],
    houses: homes.map(fullHouse),
    population: 88,
    idleWorkers: 8,
    roads: ["1,3", "2,3", "3,3", "5,7", "6,7", "3,4", "6,3"],
  });
  current.constructionSites = [createConstructionSite({ ordinal: 1, kind: "wheat_farm", tx: 8, ty: 1, startedTick: 0 })];

  assert.deepEqual(decideNextAction(current), { kind: "none" });
});

test("Given low timber When food is stable Then autoplay builds logging camp before sawmill and skips invalid placements", () => {
  const home = building({ id: "house-a", kind: "house", tx: 5, ty: 5 });
  const well = building({ id: "well-a", kind: "well", tx: 5, ty: 4 });
  const logging = building({ id: "logging-a", kind: "logging_camp", tx: 1, ty: 1 });
  const hydratedFed = house(home.id, { hasWater: true, breadStock: 20, lastServicedTick: 0 });
  const roads = ["1,2", "1,3", "1,4", "1,5", "2,5", "3,5", "4,5", "5,6"];

  assert.deepEqual(state({ buildings: [home, well], houses: [hydratedFed], timber: 35, roads }).tiles[0]?.terrain, "forest");
  assert.deepEqual(decideNextAction(state({ buildings: [home, well], houses: [hydratedFed], timber: 35, roads })), { kind: "place_building", building: "logging_camp", tx: 1, ty: 1 });
  assert.deepEqual(decideNextAction(state({ buildings: [home, well, logging], houses: [hydratedFed], timber: 35, roads })), { kind: "place_building", building: "sawmill", tx: 2, ty: 2 });
});

test("Given spare labour and housing capacity When autoplay decides Then it adds the deterministic road-adjacent house", () => {
  const home = building({ id: "house-a", kind: "house", tx: 5, ty: 5 });
  const well = building({ id: "well-a", kind: "well", tx: 5, ty: 4 });
  const actual = decideNextAction(state({
    buildings: [home, well],
    houses: [house(home.id, { hasWater: true, breadStock: 20, residents: 4, lastServicedTick: 0 })],
    idleWorkers: 7,
    roads: ["1,5", "2,5", "3,5", "5,6"],
  }));

  assert.deepEqual(actual, { kind: "place_building", building: "house", tx: 1, ty: 4 });
});
