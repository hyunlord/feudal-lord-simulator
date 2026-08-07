import assert from "node:assert/strict";
import test from "node:test";

import type { Building } from "../src/content/buildingConfig";
import {
  createDeliveryInventoryPort,
  createSimulationRoutePorts,
} from "../src/engine/simulationPorts";
import type { GameState, RoadPathCache } from "../src/engine/engine.types";
import type { Grid, TileCoordinate } from "../src/world/grid";
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

function grassGrid(width: number, height: number): Grid {
  return {
    width,
    height,
    tiles: Array.from({ length: width * height }, (_unused, index) => {
      const tx = index % width;
      const ty = Math.floor(index / width);
      return tile(tx, ty);
    }),
  };
}

function building(
  id: string,
  kind: Building["kind"],
  origin: TileCoordinate,
  inventory: Building["inventory"] = {},
): Building {
  return {
    id,
    kind,
    tx: origin.tx,
    ty: origin.ty,
    workers: 0,
    inventory,
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}

function stateFromGrid(
  grid: Grid,
  buildings: readonly Building[],
  pathCache: RoadPathCache = {},
): GameState {
  return {
    tick: 0,
    seed: 1,
    tiles: [...grid.tiles],
    width: grid.width,
    height: grid.height,
    buildings: [...buildings],
    constructionSites: [],
    wallTick: 0,
    era: "hamlet",
    eraProclaimedTick: null,
    palisade: null,
    nextConstructionOrdinal: 1,
    houses: [],
    walkers: [],
    population: 0,
    idleWorkers: 0,
    treasuryTimber: 0,
    roadRevision: 7,
    pathCache,
  };
}

function setRoads(
  grid: Grid,
  coordinates: readonly TileCoordinate[],
): Grid {
  return {
    ...grid,
    tiles: grid.tiles.map((candidate) =>
      coordinates.some(
        (coordinate) => coordinate.tx === candidate.tx && coordinate.ty === candidate.ty,
      )
        ? { ...candidate, hasRoad: true }
        : candidate,
    ),
  };
}

test("delivery inventory port wraps space and stock reservations", () => {
  // Given
  const inventory = createDeliveryInventoryPort();
  const storehouse = building(
    "storehouse-a",
    "storehouse",
    { tx: 0, ty: 0 },
    { timber: 10 },
  );

  // When
  const withSpaceClaim = inventory.reserveSpace(storehouse, "timber", 8);
  const withStockClaim = inventory.reserveStock(withSpaceClaim, "timber", 6);
  const withdrawn = inventory.withdrawStock(withStockClaim, "timber", 4);
  const releasedSpace = inventory.releaseSpace(withdrawn.building, "timber", 8);
  const releasedStock = inventory.releaseStock(releasedSpace, "timber", 6);

  // Then
  assert.equal(inventory.availableSpace(storehouse), 190);
  assert.equal(withSpaceClaim.reserved.timber, 8);
  assert.equal(inventory.availableStock(withStockClaim, "timber"), 4);
  assert.equal(withdrawn.withdrawn, 4);
  assert.equal(releasedStock.inventory.timber, 6);
  assert.equal(releasedStock.reserved.timber, undefined);
  assert.equal(releasedStock.stockReserved.timber, undefined);
});

test("delivery route port resolves building routes and exposes updated cache", () => {
  // Given
  const farm = building("farm-a", "wheat_farm", { tx: 1, ty: 1 });
  const granary = building("granary-a", "granary", { tx: 6, ty: 1 });
  const grid = setRoads(grassGrid(9, 5), [
    { tx: 2, ty: 1 },
    { tx: 3, ty: 1 },
    { tx: 4, ty: 1 },
    { tx: 5, ty: 1 },
  ]);
  const ports = createSimulationRoutePorts(stateFromGrid(grid, [farm, granary]));

  // When
  const path = ports.delivery.betweenBuildings("farm-a", "granary-a");

  // Then
  assert.deepEqual(path, [
    { tx: 3, ty: 1 },
    { tx: 4, ty: 1 },
    { tx: 5, ty: 1 },
  ]);
  assert.deepEqual(ports.getPathCache(), {
    "road:7:farm-a->granary-a": path,
  });
});

test("route ports expose road-to-building paths, road checks, and NESW roaming neighbors", () => {
  // Given
  const granary = building("granary-a", "granary", { tx: 2, ty: 2 });
  const grid = setRoads(grassGrid(6, 6), [
    { tx: 2, ty: 1 },
    { tx: 3, ty: 1 },
    { tx: 4, ty: 1 },
    { tx: 3, ty: 0 },
    { tx: 3, ty: 2 },
  ]);
  const ports = createSimulationRoutePorts(stateFromGrid(grid, [granary]));

  // When
  const homePath = ports.roaming.homePath("granary-a");
  const returnPath = ports.roaming.returnPath({ tx: 4, ty: 1 }, "granary-a");
  const neighbors = ports.roaming.neighbors({ tx: 3, ty: 1 });

  // Then
  assert.deepEqual(homePath, [{ tx: 2, ty: 1 }]);
  assert.deepEqual(returnPath, [
    { tx: 4, ty: 1 },
    { tx: 3, ty: 1 },
  ]);
  assert.deepEqual(neighbors, [
    { tx: 3, ty: 0 },
    { tx: 4, ty: 1 },
    { tx: 3, ty: 2 },
    { tx: 2, ty: 1 },
  ]);
  assert.equal(ports.delivery.isRoad({ tx: 3, ty: 1 }), true);
  assert.equal(ports.delivery.isRoad({ tx: 0, ty: 0 }), false);
});
