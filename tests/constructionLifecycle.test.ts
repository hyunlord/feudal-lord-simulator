import assert from "node:assert/strict";
import test from "node:test";

import { BUILDING_CONFIG_BY_KIND, type Building } from "../src/content/buildingConfig";
import type { ConstructionSite } from "../src/economy/construction";
import { constructionCompletionEvents } from "../src/engine/constructionLifecycle";
import type { GameState } from "../src/engine/engine.types";
import { advanceFrame } from "../src/engine/frameClock";
import { advanceTick } from "../src/engine/tick";
import type { House } from "../src/population/population.types";
import type { Tile } from "../src/world/world.types";

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

function siteAtTile(
  sites: readonly ConstructionSite[],
  tx: number,
  ty: number,
): ConstructionSite | null {
  return sites.find((candidate) => {
    const definition = BUILDING_CONFIG_BY_KIND[candidate.kind];
    return tx >= candidate.tx &&
      tx < candidate.tx + definition.width &&
      ty >= candidate.ty &&
      ty < candidate.ty + definition.height;
  }) ?? null;
}

function state(input: {
  readonly width: number;
  readonly height: number;
  readonly buildings: readonly Building[];
  readonly constructionSites?: readonly ConstructionSite[];
  readonly houses?: readonly House[];
  readonly roads?: readonly [number, number][];
  readonly wallTick?: number;
}): GameState {
  const sites = input.constructionSites ?? [];
  const roadKeys = new Set(input.roads?.map(([tx, ty]) => `${tx},${ty}`) ?? []);
  return {
    tick: 0,
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
        buildingId: owner?.id ?? siteAtTile(sites, tx, ty)?.id ?? null,
        hasRoad: roadKeys.has(`${tx},${ty}`),
      });
    }),
    buildings: [...input.buildings],
    constructionSites: [...sites],
    wallTick: input.wallTick ?? 0,
    era: "hamlet",
    eraProclaimedTick: null,
    palisade: null,
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

test("advanceTick advances construction work after delivery and completes without duplicate material spend", () => {
  // Given
  const home = building("home", "house", 0, 0);
  const target = site("construction-site-000001", {
    kind: "house",
    tx: 2,
    ty: 0,
    required: { timber: 8 },
    delivered: { timber: 8 },
    requiredBuilderTicks: 3,
    startedTick: 0,
  });
  const before = state({
    width: 5,
    height: 3,
    buildings: [home],
    constructionSites: [target],
    houses: [house(home.id, 6)],
    wallTick: 59,
  });

  // When
  const next = advanceTick(before);

  // Then
  assert.deepEqual(next.constructionSites, []);
  assert.equal(next.buildings.find(({ id }) => id === target.id)?.kind, "house");
  assert.equal(next.houses.find(({ buildingId }) => buildingId === target.id)?.level, 0);
  assert.equal(next.treasuryTimber, 0);
  assert.equal(
    next.tiles.find(({ tx, ty }) => tx === target.tx && ty === target.ty)?.buildingId,
    target.id,
  );
  assert.deepEqual(next.walkers.filter(({ kind }) => kind === "builder"), []);
  assert.deepEqual(constructionCompletionEvents(before, next), [{
    siteId: target.id,
    buildingId: target.id,
    kind: "house",
    tx: target.tx,
    ty: target.ty,
    completedWallTick: 60,
  }]);
});

test("advanceTick freezes site work while materials are missing", () => {
  // Given
  const home = building("home", "house", 0, 0);
  const target = site("construction-site-000001", {
    required: { timber: 8 },
    delivered: {},
    assignedBuilders: 3,
    requiredBuilderTicks: 6,
    stall: "awaiting_materials",
  });

  // When
  const next = advanceTick(
    state({
      width: 5,
      height: 3,
      buildings: [home],
      constructionSites: [target],
      houses: [house(home.id, 6)],
      roads: [[1, 0]],
    }),
  );

  // Then
  assert.equal(next.constructionSites[0]?.builderTicks, 0);
  assert.equal(next.constructionSites[0]?.stall, "no_material_source");
});

test("advanceTick reports no_route then resumes delivery after reconnect without duplicate cargo", () => {
  // Given
  const home = building("home", "house", 0, 0);
  const store = building("store", "storehouse", 0, 2, {
    inventory: { timber: 8 },
  });
  const target = site("construction-site-000001", {
    tx: 2,
    ty: 0,
    required: { timber: 8 },
    requiredBuilderTicks: 3,
  });
  const disconnected = state({
    width: 5,
    height: 4,
    buildings: [home, store],
    constructionSites: [target],
    houses: [house(home.id, 6)],
    roads: [[1, 0]],
  });

  // When
  const stalled = advanceTick(disconnected);
  let reconnected: GameState = {
    ...stalled,
    tiles: stalled.tiles.map((current) =>
      current.tx === 1 && current.ty === 1 ? { ...current, hasRoad: true } : current,
    ),
    roadRevision: stalled.roadRevision + 1,
    pathCache: {},
  };
  for (let index = 0; index < 20; index += 1) {
    reconnected = advanceTick(reconnected);
  }

  // Then
  assert.equal(stalled.constructionSites[0]?.stall, "no_route");
  assert.deepEqual(reconnected.constructionSites[0]?.delivered, { timber: 8 });
  assert.deepEqual(reconnected.constructionSites[0]?.reserved, {});
  assert.equal(
    reconnected.buildings.find(({ id }) => id === store.id)?.inventory.timber ?? 0,
    0,
  );
});

test("advanceFrame at 5x cannot complete a fully staffed house before sixty wall ticks", () => {
  // Given
  const home = building("home", "house", 0, 0);
  const target = site("construction-site-000001", {
    kind: "house",
    tx: 2,
    ty: 0,
    required: {},
    delivered: {},
    requiredBuilderTicks: 15,
    startedTick: 0,
  });
  let current = state({
    width: 5,
    height: 3,
    buildings: [home],
    constructionSites: [target],
    houses: [house(home.id, 6)],
    wallTick: 0,
  });

  // When
  for (let index = 0; index < 59; index += 1) {
    current = advanceFrame(current, 5);
  }
  const beforeFloor = current;
  current = advanceFrame(current, 5);

  // Then
  assert.equal(beforeFloor.wallTick, 59);
  assert.equal(beforeFloor.constructionSites[0]?.builderTicks, 15);
  assert.equal(beforeFloor.buildings.some(({ id }) => id === target.id), false);
  assert.equal(current.wallTick, 60);
  assert.equal(current.buildings.find(({ id }) => id === target.id)?.kind, "house");
});
