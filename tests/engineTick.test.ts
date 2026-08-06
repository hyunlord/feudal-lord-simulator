import assert from "node:assert/strict";
import test from "node:test";

import type { Building } from "../src/content/buildingConfig";
import type { ConstructionSite } from "../src/economy/construction";
import { advanceTick } from "../src/engine/tick";
import type { GameState } from "../src/engine/engine.types";
import type { House } from "../src/population/population.types";
import type { Tile } from "../src/world/world.types";

function tile(tx: number, ty: number, patch: Partial<Tile> = {}): Tile {
  return {
    tx,
    ty,
    terrain: "grass",
    buildingId: null,
    hasRoad: false,
    ...patch,
  };
}

function building(
  id: string,
  kind: Building["kind"],
  tx: number,
  ty: number,
  patch: Partial<Building> = {},
): Building {
  return {
    id,
    kind,
    tx,
    ty,
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
    ...patch,
  };
}

function house(buildingId: string, residents: number): House {
  return {
    buildingId,
    level: 0,
    residents,
    hasWater: false,
    breadStock: 0,
    lastServicedTick: 0,
    unmetRequirementTicks: 0,
  };
}

function state(input: {
  readonly width: number;
  readonly height: number;
  readonly buildings: readonly Building[];
  readonly constructionSites?: readonly ConstructionSite[];
  readonly houses?: readonly House[];
  readonly roads?: readonly [number, number][];
  readonly tick?: number;
}): GameState {
  const roadKeys = new Set(input.roads?.map(([tx, ty]) => `${tx},${ty}`) ?? []);
  return {
    tick: input.tick ?? 0,
    seed: 7,
    width: input.width,
    height: input.height,
    tiles: Array.from({ length: input.width * input.height }, (_unused, index) => {
      const tx = index % input.width;
      const ty = Math.floor(index / input.width);
      const owner = input.buildings.find((candidate) =>
        candidate.tx === tx && candidate.ty === ty
      );
      return tile(tx, ty, {
        buildingId: owner?.id ?? null,
        hasRoad: roadKeys.has(`${tx},${ty}`),
      });
    }),
    buildings: [...input.buildings],
    constructionSites: [...(input.constructionSites ?? [])],
    wallTick: 0,
    nextConstructionOrdinal: 1,
    houses: [...(input.houses ?? [])],
    walkers: [],
    population: input.houses?.reduce((total, item) => total + item.residents, 0) ?? 0,
    idleWorkers: 0,
    treasuryTimber: 0,
    roadRevision: 1,
    pathCache: {},
  };
}

function site(id: string, patch: Partial<ConstructionSite> = {}): ConstructionSite {
  return {
    id,
    kind: "well",
    tx: 2,
    ty: 2,
    required: {},
    delivered: {},
    reserved: {},
    builderTicks: 0,
    requiredBuilderTicks: 200,
    assignedBuilders: 0,
    stall: "no_builders",
    startedTick: 0,
    ...patch,
  };
}

test("advanceTick allocates labour before production and runs one production step", () => {
  // Given
  const home = building("home", "house", 4, 4);
  const farm = building("farm", "wheat_farm", 0, 0, {
    productionProgress: 39,
  });

  // When
  const next = advanceTick(
    state({
      width: 6,
      height: 6,
      buildings: [farm, home],
      houses: [house(home.id, 8)],
    }),
  );

  // Then
  const updatedFarm = next.buildings.find(({ id }) => id === farm.id);
  assert.equal(next.tick, 1);
  assert.equal(updatedFarm?.workers, 4);
  assert.equal(updatedFarm?.inventory.wheat, 1);
  assert.equal(updatedFarm?.productionProgress, 0);
  assert.equal(next.idleWorkers, 0);
}
);

test("advanceTick spawns a carter from producer stock using road-access routes", () => {
  // Given
  const producer = building("producer", "logging_camp", 0, 0, {
    inventory: { logs: 8 },
  });
  const store = building("store", "storehouse", 3, 0);

  // When
  const next = advanceTick(
    state({
      width: 6,
      height: 4,
      buildings: [producer, store],
      roads: [[1, 0], [2, 0]],
    }),
  );

  // Then
  assert.equal(next.walkers[0]?.kind, "carter");
  assert.deepEqual(next.walkers[0]?.cargo, { resource: "logs", amount: 8 });
  assert.equal(next.buildings.find(({ id }) => id === producer.id)?.inventory.logs ?? 0, 0);
  assert.equal(next.buildings.find(({ id }) => id === store.id)?.reserved.logs, 8);
});

test("advanceTick steps distributors before housing so bread service is visible same tick", () => {
  // Given
  const granary = building("granary", "granary", 0, 0);
  const home = building("home", "house", 2, 1);
  const distributor = {
    id: "distributor:granary:120",
    kind: "distributor" as const,
    homeBuildingId: granary.id,
    position: { tx: 2, ty: 0 },
    path: [{ tx: 1, ty: 0 }, { tx: 2, ty: 0 }],
    pathIndex: 1,
    previousTile: { tx: 1, ty: 0 },
    cargo: { resource: "bread" as const, amount: 2 },
    spawnedTick: 120,
    phase: "roaming" as const,
    junctionVisits: 0,
    tilesTravelled: 1,
    priorTile: { tx: 1, ty: 0 },
  };

  // When
  const next = advanceTick({
    ...state({
      width: 5,
      height: 3,
      buildings: [granary, home],
      houses: [house(home.id, 1)],
      roads: [[0, 0], [1, 0], [2, 0]],
    }),
    walkers: [distributor],
  });

  // Then
  const updatedHouse = next.houses.find(({ buildingId }) => buildingId === home.id);
  assert.equal(updatedHouse?.breadStock, 1);
  assert.equal(updatedHouse?.lastServicedTick, 1);
}
);

test("advanceTick assigns post-production builders and derives stable builder walkers", () => {
  // Given
  const home = building("home", "house", 4, 4);
  const farm = building("farm", "wheat_farm", 0, 0);
  const laterSite = site("construction-site-000020", { tx: 5, ty: 2 });
  const firstSite = site("construction-site-000010", { tx: 2, ty: 3 });

  // When
  const next = advanceTick(
    state({
      width: 8,
      height: 8,
      buildings: [farm, home],
      constructionSites: [laterSite, firstSite],
      houses: [house(home.id, 18)],
    }),
  );

  // Then
  assert.deepEqual(
    next.constructionSites.map(({ id, assignedBuilders }) => ({ id, assignedBuilders })),
    [
      { id: "construction-site-000020", assignedBuilders: 2 },
      { id: "construction-site-000010", assignedBuilders: 3 },
    ],
  );
  assert.equal(next.idleWorkers, 0);
  assert.deepEqual(
    next.walkers.filter(({ kind }) => kind === "builder").map(({ id, position }) => ({
      id,
      position,
    })),
    [
      { id: "builder:construction-site-000010:0", position: { tx: 2.25, ty: 3.25 } },
      { id: "builder:construction-site-000010:1", position: { tx: 2.65, ty: 3.35 } },
      { id: "builder:construction-site-000010:2", position: { tx: 2.45, ty: 3.7 } },
      { id: "builder:construction-site-000020:0", position: { tx: 5.25, ty: 2.25 } },
      { id: "builder:construction-site-000020:1", position: { tx: 5.65, ty: 2.35 } },
    ],
  );
});

test("advanceTick never starves active production for construction builders", () => {
  // Given
  const home = building("home", "house", 4, 4);
  const farm = building("a-farm", "wheat_farm", 0, 0);
  const sawmill = building("b-sawmill", "sawmill", 2, 0);

  // When
  const next = advanceTick(
    state({
      width: 8,
      height: 8,
      buildings: [sawmill, home, farm],
      constructionSites: [site("construction-site-000001")],
      houses: [house(home.id, 12)],
    }),
  );

  // Then
  assert.deepEqual(
    next.buildings.map(({ id, workers }) => ({ id, workers })),
    [
      { id: "b-sawmill", workers: 2 },
      { id: "home", workers: 0 },
      { id: "a-farm", workers: 4 },
    ],
  );
  assert.equal(next.constructionSites[0]?.assignedBuilders, 0);
  assert.equal(next.constructionSites[0]?.stall, "no_builders");
  assert.deepEqual(next.walkers.filter(({ kind }) => kind === "builder"), []);
});
