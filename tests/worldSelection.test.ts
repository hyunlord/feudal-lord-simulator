import assert from "node:assert/strict";
import test from "node:test";

import type { GameState } from "../src/engine/engine.types";
import { selectWorldAtTile } from "../src/render/worldSelection";

const STATE = {
  width: 2,
  height: 1,
  tiles: [
    { tx: 0, ty: 0, terrain: "grass", buildingId: "house", hasRoad: false },
    { tx: 1, ty: 0, terrain: "grass", buildingId: null, hasRoad: true },
  ],
  buildings: [{
    id: "house", kind: "house", tx: 0, ty: 0, workers: 0,
    inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0,
  }],
  constructionSites: [],
  walkers: [{
    id: "walker", kind: "distributor", homeBuildingId: "granary",
    position: { tx: 0, ty: 0 }, path: [{ tx: 0, ty: 0 }], pathIndex: 0,
    previousTile: null, cargo: null, spawnedTick: 0, phase: "roaming",
    junctionVisits: 0, tilesTravelled: 0, priorTile: null,
  }],
} as const satisfies Pick<GameState, "width" | "height" | "tiles" | "buildings" | "constructionSites" | "walkers">;

test("walker hit wins over a building occupying the same tile", () => {
  assert.deepEqual(selectWorldAtTile(STATE, { tx: 0, ty: 0 }), {
    kind: "walker",
    walkerId: "walker",
  });
});

test("moving walker remains selectable on the tile under its rendered feet", () => {
  const movingWalker = {
    ...STATE.walkers[0],
    position: { tx: 0.32, ty: 0 },
  };

  assert.deepEqual(
    selectWorldAtTile({ ...STATE, walkers: [movingWalker] }, { tx: 0, ty: 0 }),
    { kind: "walker", walkerId: "walker" },
  );
});

test("moving walker selection follows the next rendered tile", () => {
  const movingWalker = {
    ...STATE.walkers[0],
    position: { tx: 0.8, ty: 0 },
  };

  assert.deepEqual(
    selectWorldAtTile({ ...STATE, walkers: [movingWalker] }, { tx: 1, ty: 0 }),
    { kind: "walker", walkerId: "walker" },
  );
});

test("building and empty tile clicks select or dismiss deterministically", () => {
  assert.deepEqual(
    selectWorldAtTile({ ...STATE, walkers: [] }, { tx: 0, ty: 0 }),
    { kind: "building", buildingId: "house" },
  );
  assert.equal(selectWorldAtTile(STATE, { tx: 1, ty: 0 }), null);
});

test("construction sites are selectable beneath builder walkers", () => {
  // Given
  const builder = {
    id: "builder:construction-site-000001:0",
    kind: "builder",
    homeBuildingId: "construction-site-000001",
    siteId: "construction-site-000001",
    slotIndex: 0,
    position: { tx: 0, ty: 0 },
    path: [],
    pathIndex: 0,
    previousTile: null,
    cargo: null,
    spawnedTick: 0,
  } as const;
  const constructionTileState = {
    ...STATE,
    tiles: [{ ...STATE.tiles[0], buildingId: "construction-site-000001" }],
    buildings: [],
    constructionSites: [{
      id: "construction-site-000001",
      kind: "sawmill",
      tx: 0,
      ty: 0,
      required: { timber: 30 },
      delivered: { timber: 12 },
      reserved: { timber: 8 },
      builderTicks: 0,
      requiredBuilderTicks: 600,
      assignedBuilders: 0,
      stall: "awaiting_materials",
      startedTick: 4,
    }],
    walkers: [builder],
  } satisfies Pick<GameState, "width" | "height" | "tiles" | "buildings" | "constructionSites" | "walkers">;

  // When / Then
  assert.deepEqual(selectWorldAtTile(constructionTileState, { tx: 0, ty: 0 }), {
    kind: "construction_site",
    siteId: "construction-site-000001",
  });
});

test("construction site selection wins over a stale finished building id match", () => {
  // Given
  const state = {
    ...STATE,
    tiles: [{ ...STATE.tiles[0], buildingId: "construction-site-000001" }],
    buildings: [{
      ...STATE.buildings[0],
      id: "construction-site-000001",
      kind: "sawmill",
    }],
    constructionSites: [{
      id: "construction-site-000001",
      kind: "sawmill",
      tx: 0,
      ty: 0,
      required: { timber: 30 },
      delivered: {},
      reserved: {},
      builderTicks: 0,
      requiredBuilderTicks: 600,
      assignedBuilders: 0,
      stall: "no_route",
      startedTick: 4,
    }],
    walkers: [],
  } satisfies Pick<GameState, "width" | "height" | "tiles" | "buildings" | "constructionSites" | "walkers">;

  // When / Then
  assert.deepEqual(selectWorldAtTile(state, { tx: 0, ty: 0 }), {
    kind: "construction_site",
    siteId: "construction-site-000001",
  });
});

test("clicking through a builder can still resolve an underlying finished building", () => {
  // Given
  const builder = {
    id: "builder:construction-site-000001:0",
    kind: "builder",
    homeBuildingId: "construction-site-000001",
    siteId: "construction-site-000001",
    slotIndex: 0,
    position: { tx: 0, ty: 0 },
    path: [],
    pathIndex: 0,
    previousTile: null,
    cargo: null,
    spawnedTick: 0,
  } as const;

  // When / Then
  assert.deepEqual(
    selectWorldAtTile({ ...STATE, walkers: [builder] }, { tx: 0, ty: 0 }),
    { kind: "building", buildingId: "house" },
  );
});
