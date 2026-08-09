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

function house(buildingId: string): House {
  return {
    buildingId,
    level: 3,
    residents: 22,
    hasWater: true,
    breadStock: 20,
    lastServicedTick: 0,
    unmetRequirementTicks: 0,
  };
}

function tiles(buildings: readonly Building[], roads: readonly string[]): Tile[] {
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
  readonly houses: readonly House[];
  readonly population: number;
  readonly idleWorkers: number;
  readonly roads: readonly string[];
  readonly timber?: number;
}): GameState {
  return {
    tick: 0,
    seed: 1,
    width: 12,
    height: 12,
    tiles: tiles(input.buildings, input.roads),
    buildings: [...input.buildings],
    constructionSites: [],
    houses: [...input.houses],
    walkers: [],
    population: input.population,
    idleWorkers: input.idleWorkers,
    treasuryTimber: input.timber ?? 120,
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

const ROADS = ["1,3", "2,3", "3,3", "5,7", "6,7", "3,4", "6,3", "8,3"] as const;

function settledHomes(count: number): Building[] {
  return Array.from({ length: count }, (_unused, index) =>
    building({ id: `house-${index}`, kind: "house", tx: 4 + (index % 3), ty: 5 + Math.floor(index / 3) })
  );
}

function foodChain(includeSecondMill: boolean): Building[] {
  return [
    building({ id: "well-a", kind: "well", tx: 5, ty: 4 }),
    building({ id: "granary-a", kind: "granary", tx: 1, ty: 1, inventory: { bread: 80 }, workers: 2 }),
    building({ id: "granary-b", kind: "granary", tx: 9, ty: 1, inventory: { bread: 80 }, workers: 2 }),
    building({ id: "wheat-a", kind: "wheat_farm", tx: 3, ty: 1, workers: 4 }),
    building({ id: "wheat-b", kind: "wheat_farm", tx: 8, ty: 1, workers: 4 }),
    ...(includeSecondMill ? [building({ id: "mill-b", kind: "mill", tx: 7, ty: 1, workers: 2 })] : []),
    building({ id: "mill-a", kind: "mill", tx: 6, ty: 1, workers: 2 }),
  ];
}

test("Given one extra cottage already matches food support When autoplay decides Then it does not over-expand housing", () => {
  const homes = settledHomes(5);
  const current = state({
    buildings: [
      ...homes,
      ...foodChain(true),
      building({ id: "wheat-c", kind: "wheat_farm", tx: 10, ty: 4, workers: 4 }),
    ],
    houses: homes.map(({ id }) => house(id)),
    population: 110,
    idleWorkers: 20,
    roads: ROADS,
  });

  assert.deepEqual(decideNextAction(current), { kind: "none" });
});

test("Given two completed mills support one more cottage When housing is full Then autoplay adds exactly one house", () => {
  const homes = settledHomes(4);
  const current = state({
    buildings: [...homes, ...foodChain(true)],
    houses: homes.map(({ id }) => house(id)),
    population: 88,
    idleWorkers: 20,
    roads: ROADS,
  });

  assert.deepEqual(decideNextAction(current), { kind: "place_building", building: "house", tx: 6, ty: 2 });
});

test("Given the second mill is still under construction When housing is full Then autoplay does not count it as support", () => {
  const homes = settledHomes(4);
  const current = state({
    buildings: [...homes, ...foodChain(false)],
    houses: homes.map(({ id }) => house(id)),
    population: 88,
    idleWorkers: 20,
    roads: ROADS,
  });
  current.constructionSites = [createConstructionSite({ ordinal: 1, kind: "mill", tx: 7, ty: 1, startedTick: 0 })];

  assert.deepEqual(decideNextAction(current), { kind: "none" });
});
