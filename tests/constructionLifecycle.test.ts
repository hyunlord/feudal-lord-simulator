import assert from "node:assert/strict";
import test from "node:test";

import type { Building } from "../src/content/buildingConfig";
import {
  constructionSiteFootprint,
  createPalisadeConstructionSite,
  type BuildingConstructionSite,
  type ConstructionSite,
} from "../src/economy/construction";
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

function siteAtTile(
  sites: readonly ConstructionSite[],
  tx: number,
  ty: number,
): ConstructionSite | null {
  return sites.find((candidate) => {
    const footprint = constructionSiteFootprint(candidate);
    return tx >= footprint.tx &&
      tx < footprint.tx + footprint.width &&
      ty >= footprint.ty &&
      ty < footprint.ty + footprint.height;
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
    forestHarvests: [],
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

test("advanceTick completes a ready palisade segment as wall state without creating a building or house", () => {
  // Given
  const home = building("home", "house", 0, 0);
  const wallSite = createPalisadeConstructionSite({
    id: "wall-a-segment-000",
    wallId: "wall-a",
    segmentIndex: 0,
    gateDistance: 0,
    order: 0,
    path: [{ x: 2, y: 0 }, { x: 4, y: 0 }],
    startedTick: 0,
  });
  const before = state({
    width: 6,
    height: 3,
    buildings: [home],
    constructionSites: [{
      ...wallSite,
      delivered: { timber: 30 },
      builderTicks: 120,
      assignedBuilders: 3,
    }],
    houses: [house(home.id, 6)],
    wallTick: 59,
  });
  const proclaimed = {
    ...before,
    era: "palisade",
    eraProclaimedTick: 0,
    palisade: {
      id: "wall-a",
      polygon: [{ x: 2, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 0 }],
      gate: { x: 2, y: 0 },
      segments: [{
        id: "wall-a-segment-000",
        order: 0,
        edgePath: wallSite.path,
        tileCount: 2,
        completed: false,
        constructionSiteId: wallSite.id,
      }],
    },
  } satisfies GameState;

  // When
  const next = advanceTick(proclaimed);

  // Then
  assert.deepEqual(next.constructionSites, []);
  assert.equal(next.buildings.some(({ id }) => id === wallSite.id), false);
  assert.equal(next.houses.some(({ buildingId }) => buildingId === wallSite.id), false);
  assert.deepEqual(next.palisade?.segments, [{
    id: "wall-a-segment-000",
    order: 0,
    edgePath: wallSite.path,
    tileCount: 2,
    completed: true,
    constructionSiteId: null,
  }]);
  assert.deepEqual(next.walkers.filter(({ kind }) => kind === "builder"), []);
  assert.deepEqual(constructionCompletionEvents(proclaimed, next), []);
});

test("advanceFrame at 5x keeps a ready palisade segment visible until sixty wall ticks", () => {
  // Given
  const home = building("home", "house", 0, 0);
  const wallSite = createPalisadeConstructionSite({
    id: "wall-a-segment-000",
    wallId: "wall-a",
    segmentIndex: 0,
    gateDistance: 0,
    order: 0,
    path: [{ x: 2, y: 0 }, { x: 4, y: 0 }],
    startedTick: 0,
  });
  let current: GameState = {
    ...state({
      width: 6,
      height: 3,
      buildings: [home],
      constructionSites: [{
        ...wallSite,
        delivered: { timber: 30 },
        builderTicks: 120,
        assignedBuilders: 3,
      }],
      houses: [house(home.id, 6)],
      wallTick: 0,
    }),
    era: "palisade",
    eraProclaimedTick: 0,
    palisade: {
      id: "wall-a",
      polygon: [{ x: 2, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 0 }],
      gate: { x: 2, y: 0 },
      segments: [{
        id: "wall-a-segment-000",
        order: 0,
        edgePath: wallSite.path,
        tileCount: 2,
        completed: false,
        constructionSiteId: wallSite.id,
      }],
    },
  };

  // When
  for (let index = 0; index < 59; index += 1) {
    current = advanceFrame(current, 5);
  }
  const beforeFloor = current;
  current = advanceFrame(current, 5);

  // Then
  assert.equal(beforeFloor.wallTick, 59);
  assert.equal(beforeFloor.constructionSites.length, 1);
  assert.equal(beforeFloor.palisade?.segments[0]?.completed, false);
  assert.equal(current.wallTick, 60);
  assert.equal(current.constructionSites.length, 0);
  assert.equal(current.palisade?.segments[0]?.completed, true);
});

test("palisade aggregate completes only after the last planned segment completes", () => {
  // Given
  const firstSite = createPalisadeConstructionSite({
    id: "wall-a-segment-000",
    wallId: "wall-a",
    segmentIndex: 0,
    gateDistance: 0,
    order: 0,
    path: [{ x: 2, y: 0 }, { x: 4, y: 0 }],
    startedTick: 0,
  });
  const secondSite = createPalisadeConstructionSite({
    id: "wall-a-segment-001",
    wallId: "wall-a",
    segmentIndex: 1,
    gateDistance: 4,
    order: 1,
    path: [{ x: 4, y: 0 }, { x: 6, y: 0 }],
    startedTick: 0,
  });
  const base = {
    ...state({
      width: 8,
      height: 3,
      buildings: [building("home", "house", 0, 0)],
      constructionSites: [
        { ...firstSite, delivered: { timber: 30 }, builderTicks: 120 },
        { ...secondSite, delivered: { timber: 30 }, builderTicks: 119, assignedBuilders: 1 },
      ],
      wallTick: 59,
    }),
    era: "palisade",
    eraProclaimedTick: 0,
    palisade: {
      id: "wall-a",
      polygon: [{ x: 2, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 0 }],
      gate: { x: 2, y: 0 },
      segments: [
        {
          id: "wall-a-segment-000",
          order: 0,
          edgePath: firstSite.path,
          tileCount: 2,
          completed: false,
          constructionSiteId: firstSite.id,
        },
        {
          id: "wall-a-segment-001",
          order: 1,
          edgePath: secondSite.path,
          tileCount: 2,
          completed: false,
          constructionSiteId: secondSite.id,
        },
      ],
    },
  } satisfies GameState;

  // When
  const partial = advanceTick(base);
  const final = advanceTick({
    ...partial,
    constructionSites: partial.constructionSites.map((candidate) =>
      candidate.id === secondSite.id ? { ...candidate, builderTicks: 120 } : candidate,
    ),
    wallTick: 59,
  });

  // Then
  assert.deepEqual(partial.palisade?.segments.map(({ completed }) => completed), [true, false]);
  assert.equal(partial.constructionSites.map(({ id }) => id).includes(secondSite.id), true);
  assert.deepEqual(final.palisade?.segments.map(({ completed }) => completed), [true, true]);
  assert.deepEqual(final.constructionSites, []);
});
