import assert from "node:assert/strict";
import test from "node:test";

import type { Building } from "../src/content/buildingConfig";
import type {
  BuildingConstructionSite,
  ConstructionSite,
  PalisadeConstructionSite,
} from "../src/economy/construction";
import { advanceFrame } from "../src/engine/frameClock";
import { advanceTick } from "../src/engine/tick";
import type { GameState, PalisadeState } from "../src/engine/engine.types";
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
  readonly wallTick?: number;
  readonly eraProclaimedTick?: number | null;
  readonly palisade?: PalisadeState | null;
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
    wallTick: input.wallTick ?? 0,
    era: input.palisade === null || input.palisade === undefined ? "hamlet" : "palisade",
    eraProclaimedTick: input.eraProclaimedTick ?? null,
    palisade: input.palisade ?? null,
    nextConstructionOrdinal: 1,
    houses: [...(input.houses ?? [])],
    walkers: [],
    population: input.houses?.reduce((total, item) => total + item.residents, 0) ?? 0,
    idleWorkers: 0,
    treasuryTimber: 0,
    treasuryCoin: 0,
    roadRevision: 1,
    pathCache: {},
    forestHarvests: [],
  };
}

function site(id: string, patch: Partial<BuildingConstructionSite> = {}): BuildingConstructionSite {
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

function wallSite(
  id: string,
  order: number,
  patch: Partial<PalisadeConstructionSite> = {},
): PalisadeConstructionSite {
  return {
    id,
    kind: "palisade_segment",
    wallId: "wall-a",
    segmentIndex: order,
    gateDistance: order * 4,
    order,
    path: [{ x: order, y: 0 }, { x: order + 1, y: 0 }],
    anchor: { tx: order, ty: 0 },
    required: { timber: 15 },
    delivered: { timber: 15 },
    reserved: {},
    builderTicks: 0,
    requiredBuilderTicks: 2_000,
    assignedBuilders: 0,
    stall: "no_builders",
    startedTick: 0,
    ...patch,
  };
}

function palisade(site: PalisadeConstructionSite): PalisadeState {
  return {
    id: site.wallId,
    polygon: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
    gate: { x: 0, y: 0 },
    segments: [{
      id: `${site.wallId}-segment-state-000`,
      order: site.order,
      edgePath: site.path,
      tileCount: 1,
      completed: false,
      constructionSiteId: site.id,
    }],
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
	      roads: [[0, 2]],
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

test("advanceTick reserves palisade-era wall labour before production during the first six hundred simulation ticks", () => {
  // Given
  const home = building("home", "house", 4, 4);
  const farm = building("a-farm", "wheat_farm", 0, 0);
  const logging = building("b-logging", "logging_camp", 2, 0);
  const wall = wallSite("wall-a-segment-000", 0);

  // When
  const baseline = advanceTick(
	    state({
	      width: 8,
	      height: 8,
	      buildings: [farm, logging, home],
	      constructionSites: [wall],
	      houses: [house(home.id, 20)],
	      roads: [[0, 2], [2, 1]],
	    }),
	  );
	  const diverted = advanceTick(
	    state({
	      width: 8,
	      height: 8,
	      buildings: [farm, logging, home],
	      constructionSites: [wall],
	      houses: [house(home.id, 20)],
	      roads: [[0, 2], [2, 1]],
	      eraProclaimedTick: 0,
	      palisade: palisade(wall),
	    }),
  );

  // Then
  assert.deepEqual(
    baseline.buildings.map(({ id, workers }) => ({ id, workers })),
    [
      { id: "a-farm", workers: 4 },
      { id: "b-logging", workers: 3 },
      { id: "home", workers: 0 },
    ],
  );
  assert.deepEqual(
    diverted.buildings.map(({ id, workers }) => ({ id, workers })),
    [
      { id: "a-farm", workers: 4 },
      { id: "b-logging", workers: 2 },
      { id: "home", workers: 0 },
    ],
  );
  assert.equal(diverted.constructionSites[0]?.assignedBuilders, 3);
  assert.equal(diverted.buildings.find(({ id }) => id === farm.id)?.productionProgress, 1);
  assert.equal(diverted.buildings.find(({ id }) => id === logging.id)?.productionProgress, 0);
}
);

test("advanceFrame applies the palisade labour boundary by simulation tick instead of wall tick or speed", () => {
  // Given
  const home = building("home", "house", 4, 4);
  const farm = building("a-farm", "wheat_farm", 0, 0);
  const logging = building("b-logging", "logging_camp", 2, 0);
  const wall = wallSite("wall-a-segment-000", 0);
  const initial = state({
    width: 8,
    height: 8,
	  buildings: [farm, logging, home],
	  constructionSites: [wall],
	  houses: [house(home.id, 20)],
	  roads: [[0, 2], [2, 1]],
	  tick: 595,
	  wallTick: 9,
    eraProclaimedTick: 0,
    palisade: palisade(wall),
  });

  // When
  const speedFive = advanceFrame(initial, 5);
  const direct = Array.from({ length: 5 }).reduce<GameState>(
    (current) => advanceTick(current),
    initial,
  );

  // Then
  assert.equal(speedFive.tick, 600);
  assert.equal(speedFive.wallTick, 10);
  assert.equal(direct.tick, 600);
  assert.equal(direct.wallTick, 14);
  assert.deepEqual(
    speedFive.buildings.map(({ id, workers }) => ({ id, workers })),
    direct.buildings.map(({ id, workers }) => ({ id, workers })),
  );
  assert.deepEqual(
    speedFive.constructionSites.map(({ id, assignedBuilders, builderTicks }) => ({
      id,
      assignedBuilders,
      builderTicks,
    })),
    direct.constructionSites.map(({ id, assignedBuilders, builderTicks }) => ({
      id,
      assignedBuilders,
      builderTicks,
    })),
  );
  assert.deepEqual(
    speedFive.buildings.map(({ id, workers }) => ({ id, workers })),
    [
      { id: "a-farm", workers: 4 },
      { id: "b-logging", workers: 3 },
      { id: "home", workers: 0 },
    ],
  );
  assert.equal(speedFive.constructionSites[0]?.assignedBuilders, 2);
});

test("scripted palisade labour trace shows a production dip without one hundred twenty stalled productive ticks", () => {
  // Given
  const home = building("home", "house", 4, 4);
  const farm = building("a-farm", "wheat_farm", 0, 0);
  const logging = building("b-logging", "logging_camp", 2, 0);
  const wall = wallSite("wall-a-segment-000", 0);
  let current = state({
    width: 8,
    height: 8,
	  buildings: [farm, logging, home],
	  constructionSites: [wall],
	  houses: [house(home.id, 20)],
	  roads: [[0, 2], [2, 1]],
	  eraProclaimedTick: 0,
	  palisade: palisade(wall),
	});
  let longestStall = 0;
  let currentStall = 0;
  let productionDipTicks = 0;
  let farmProgressTicks = 0;

  // When
  for (let step = 0; step < 600; step += 1) {
    const beforeFarmProgress =
      current.buildings.find(({ id }) => id === farm.id)?.productionProgress ?? 0;
    current = advanceTick(current);
    const nextFarm = current.buildings.find(({ id }) => id === farm.id);
    const nextLogging = current.buildings.find(({ id }) => id === logging.id);
    const madeProgress =
      (nextFarm?.productionProgress ?? 0) !== beforeFarmProgress ||
      (nextFarm?.inventory.wheat ?? 0) > 0 ||
      (nextLogging?.inventory.logs ?? 0) > 0;

    if (nextLogging?.workers === 2) productionDipTicks += 1;
    if ((nextFarm?.productionProgress ?? 0) > 0) farmProgressTicks += 1;
    currentStall = madeProgress ? 0 : currentStall + 1;
    longestStall = Math.max(longestStall, currentStall);
  }

  // Then
  assert.ok(productionDipTicks > 0);
  assert.ok(farmProgressTicks > 0);
  assert.ok(longestStall < 120);
});
