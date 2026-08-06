import assert from "node:assert/strict";
import test from "node:test";

import type { GameState } from "../src/engine/engine.types";
import { resolveCanvasContextMenu } from "../src/render/canvasContextMenuResolution";
import type { Tile } from "../src/world/world.types";

function tile(tx: number, ty: number, buildingId: string | null): Tile {
  return { tx, ty, terrain: "grass", buildingId, hasRoad: false };
}

const state = {
  tick: 0,
  seed: 1,
  width: 2,
  height: 1,
  tiles: [
    tile(0, 0, "construction-site-000001"),
    tile(1, 0, "house"),
  ],
  buildings: [{
    id: "house", kind: "house", tx: 1, ty: 0, workers: 0,
    inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0,
  }],
  constructionSites: [{
    id: "construction-site-000001",
    kind: "sawmill",
    tx: 0,
    ty: 0,
    required: { timber: 30 },
    delivered: { timber: 12 },
    reserved: {},
    builderTicks: 0,
    requiredBuilderTicks: 600,
    assignedBuilders: 0,
    stall: "awaiting_materials",
    startedTick: 0,
  }],
  houses: [],
  walkers: [],
  population: 0,
  idleWorkers: 0,
  treasuryTimber: 0,
  wallTick: 0,
  nextConstructionOrdinal: 2,
  roadRevision: 0,
  pathCache: {},
} satisfies GameState;

test("context menu resolves the pointed construction site while placement stays armed", () => {
  // Given / When
  const resolution = resolveCanvasContextMenu({
    state,
    tile: { tx: 0, ty: 0 },
    selectedTool: "mill",
  });

  // Then
  assert.deepEqual(resolution, {
    action: { type: "cancel_construction", siteId: "construction-site-000001" },
    clearSelection: true,
  });
});

test("context menu ignores non-site tiles and still clears stale diagnostic selection", () => {
  // Given / When
  const resolution = resolveCanvasContextMenu({
    state,
    tile: { tx: 1, ty: 0 },
    selectedTool: null,
  });

  // Then
  assert.deepEqual(resolution, {
    action: null,
    clearSelection: true,
  });
});
