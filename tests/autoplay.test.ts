import assert from "node:assert/strict";
import test from "node:test";

import { BUILDING_CONFIG_BY_KIND, type Building, type BuildingKind } from "../src/content/buildingConfig";
import type { ResourceType } from "../src/content/resourceConfig";
import { createConstructionSite } from "../src/economy/construction";
import { decideNextAction, type AutoplayAction } from "../src/engine/autoplay";
import type { GameState } from "../src/engine/engine.types";
import { resolveBuildingToConstructionSiteRoute } from "../src/engine/routing";
import type { House } from "../src/population/population.types";
import { gameReducer } from "../src/state/gameStore";
import { autoplayActionLabel, autoplayActionToGameAction } from "../src/ui/autoplayPresentation";
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
  readonly coin?: number;
  readonly tick?: number;
  readonly era?: GameState["era"];
}): GameState {
  const houses = input.houses ?? [];
  return {
    tick: input.tick ?? 0,
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
    treasuryCoin: input.coin ?? 0,
    wallTick: input.tick ?? 0,
    era: input.era ?? "hamlet",
    eraProclaimedTick: null,
    palisade: null,
    forestHarvests: [],
    nextConstructionOrdinal: 1,
    roadRevision: 1,
    pathCache: {},
  };
}

function assertAction(actual: AutoplayAction, expected: AutoplayAction): void {
  assert.deepEqual(actual, expected);
}

test("Given an unwatered house cluster When autoplay decides Then it builds the earliest valid well within radius six", () => {
  const home = building({ id: "house-a", kind: "house", tx: 5, ty: 5 });
  const actual = decideNextAction(state({ buildings: [home], houses: [house(home.id)] }));

  assertAction(actual, { kind: "place_building", building: "well", tx: 5, ty: 4 });
});

test("Given separated unwatered clusters When one well cannot cover all Then autoplay serves the most deprived cluster", () => {
  const early = building({ id: "house-a", kind: "house", tx: 2, ty: 2 });
  const deprived = building({ id: "house-b", kind: "house", tx: 9, ty: 9 });
  const actual = decideNextAction(state({
    buildings: [early, deprived],
    houses: [
      house(early.id, { unmetRequirementTicks: 1 }),
      house(deprived.id, { unmetRequirementTicks: 500 }),
    ],
  }));

  assertAction(actual, { kind: "place_building", building: "well", tx: 9, ty: 8 });
});

test("Given a roadless idle building When autoplay decides Then it places the nearest legal road segment from the connected road edge", () => {
  const storehouse = building({ id: "storehouse-a", kind: "storehouse", tx: 7, ty: 4, workers: 0 });
  const actual = decideNextAction(state({ buildings: [storehouse], roads: ["1,5", "2,5", "3,5"] }));

  assertAction(actual, {
    kind: "place_road",
    from: { tx: 4, ty: 5 },
    to: { tx: 6, ty: 5 },
  });
});

test("Given a busy roadless building When autoplay decides Then the idle-building road priority skips it", () => {
  const busyStorehouse = building({ id: "storehouse-a", kind: "storehouse", tx: 7, ty: 4, workers: 1 });
  const actual = decideNextAction(state({ buildings: [busyStorehouse], roads: ["1,5", "2,5", "3,5"] }));

  assert.notEqual(actual.kind, "place_road");
});

test("Given a food-chain construction site When autoplay decides Then it does not recommend the same building again", () => {
  const home = building({ id: "house-a", kind: "house", tx: 5, ty: 5 });
  const well = building({ id: "well-a", kind: "well", tx: 5, ty: 4 });
  const current = state({
    buildings: [home, well],
    houses: [house(home.id, { hasWater: true, breadStock: 0 })],
    roads: ["1,5", "2,5", "3,5", "5,6"],
  });
  current.constructionSites = [createConstructionSite({ ordinal: 1, kind: "wheat_farm", tx: 1, ty: 1, startedTick: 0 })];

  assert.notDeepEqual(decideNextAction(current), { kind: "place_building", building: "wheat_farm", tx: 1, ty: 1 });
});

test("Given a well or cottage is already under construction When autoplay decides Then it does not queue duplicates", () => {
  const home = building({ id: "house-a", kind: "house", tx: 5, ty: 5 });
  const current = state({
    buildings: [home],
    houses: [house(home.id, { breadStock: 20 })],
    idleWorkers: 7,
    timber: 500,
    roads: ["1,5", "2,5", "3,5", "5,6"],
  });
  current.constructionSites = [
    createConstructionSite({ ordinal: 1, kind: "well", tx: 5, ty: 4, startedTick: 0 }),
    createConstructionSite({ ordinal: 2, kind: "house", tx: 1, ty: 4, startedTick: 0 }),
  ];

  assert.deepEqual(decideNextAction(current), { kind: "none" });
});

test("Given the only missing era building is under construction When autoplay decides Then it waits", () => {
  const granary = building({ id: "granary-a", kind: "granary", tx: 1, ty: 1 });
  const current = state({ buildings: [granary], population: 60, timber: 250, roads: ["1,3", "2,3", "3,3"] });
  current.constructionSites = [createConstructionSite({ ordinal: 1, kind: "chapel", tx: 3, ty: 1, startedTick: 0 })];

  assert.deepEqual(decideNextAction(current), { kind: "none" });
});

test("Given Stone Town is already proclaimed When autoplay decides Then it waits without a false proclamation hint", () => {
  const current = state({ buildings: [], era: "stone_town", population: 200, timber: 500, coin: 500 });

  const action = decideNextAction(current);
  assert.deepEqual(action, { kind: "none" });
  assert.equal(autoplayActionLabel(action), "다음: 대기");
});

test("Given era requirements When one building is missing or all are met Then autoplay builds the missing building or proclaims", () => {
  const home = building({ id: "house-a", kind: "house", tx: 5, ty: 5 });
  const granary = building({ id: "granary-a", kind: "granary", tx: 1, ty: 1 });
  const chapel = building({ id: "chapel-a", kind: "chapel", tx: 3, ty: 1 });
  const ready = { population: 60, timber: 250 };

  assert.deepEqual(decideNextAction(state({
    ...ready,
    buildings: [home, granary],
    roads: ["1,3", "2,3", "3,3", "4,3", "5,3", "5,4"],
  })), {
    kind: "place_building",
    building: "chapel",
    tx: 3,
    ty: 2,
  });
  assert.deepEqual(decideNextAction(state({ ...ready, buildings: [granary, chapel], roads: ["1,3", "2,3", "3,2", "3,3"] })), { kind: "proclaim_era" });
});

test("Given an earlier isolated road island When autoplay places a food site Then construction still has a real source route", () => {
  const home = building({ id: "house-a", kind: "house", tx: 5, ty: 5 });
  const well = building({ id: "well-a", kind: "well", tx: 5, ty: 4 });
  const current = state({
    buildings: [home, well],
    houses: [house(home.id, { hasWater: true, breadStock: 0 })],
    roads: ["1,3", "5,6", "6,6"],
    timber: 500,
  });
  const advisorAction = decideNextAction(current);
  const gameAction = autoplayActionToGameAction(advisorAction, current);

  if (gameAction === null) assert.fail("expected autoplay action to map to a game action");
  const next = gameReducer(current, gameAction);
  const site = next.constructionSites.find((candidate) =>
    "tx" in candidate && candidate.kind === "wheat_farm",
  );
  if (site === undefined || !("tx" in site)) assert.fail("expected a wheat farm construction site");
  assert.notEqual(resolveBuildingToConstructionSiteRoute(next, home, site).path, null);
});
