import assert from "node:assert/strict";
import test from "node:test";

import type { Walker } from "../src/agents/walker.types";
import type { BuildingKind } from "../src/content/buildingConfig";
import type { Building } from "../src/economy/economy.types";
import type { ConstructionSite } from "../src/economy/construction";
import type { GameState } from "../src/engine/engine.types";
import { objectRenderItemsForFrame } from "../src/render/renderObjectFrameCache";
import type { Tile } from "../src/world/world.types";

function tile(tx: number, ty: number): Tile {
  return { tx, ty, terrain: "grass", buildingId: null, hasRoad: false };
}

function constructionSite(id: string, kind: BuildingKind, tx: number, ty: number): ConstructionSite {
  return {
    id,
    kind,
    tx,
    ty,
    required: { timber: 40 },
    delivered: {},
    reserved: {},
    builderTicks: 0,
    requiredBuilderTicks: 800,
    assignedBuilders: 0,
    stall: "awaiting_materials",
    startedTick: 0,
  };
}

function worldState(input: {
  readonly seed: number;
  readonly tiles: readonly Tile[];
  readonly width: number;
  readonly height: number;
  readonly constructionSites?: readonly ConstructionSite[];
}): GameState {
  return {
    tick: 0,
    seed: input.seed,
    tiles: [...input.tiles],
    width: input.width,
    height: input.height,
    buildings: [] as Building[],
    constructionSites: [...(input.constructionSites ?? [])],
    wallTick: 0,
    nextConstructionOrdinal: 1,
    houses: [],
    walkers: [] as Walker[],
    population: 0,
    idleWorkers: 0,
    treasuryTimber: 0,
    roadRevision: 0,
    pathCache: {},
  };
}

test("objectRenderItemsForFrame invalidates static cache when construction sites change", () => {
  // Given
  const tiles = Array.from({ length: 9 }, (_, index) => tile(index % 3, Math.floor(index / 3)));
  const baseState = worldState({
    seed: 23,
    tiles,
    width: 3,
    height: 3,
    constructionSites: [constructionSite("site-a", "storehouse", 0, 0)],
  });
  const range = { minTx: 0, minTy: 0, maxTx: 2, maxTy: 2 } as const;
  objectRenderItemsForFrame({
    state: baseState,
    visibleTiles: tiles,
    range,
    includeGroundCover: false,
  });

  // When
  const items = objectRenderItemsForFrame({
    state: {
      ...baseState,
      constructionSites: [constructionSite("site-b", "storehouse", 2, 1)],
    },
    visibleTiles: tiles,
    range,
    includeGroundCover: false,
  });

  // Then
  assert.deepEqual(items.map((item) => `${item.kind}:${item.id}`), [
    "construction_site:site-b",
  ]);
});
