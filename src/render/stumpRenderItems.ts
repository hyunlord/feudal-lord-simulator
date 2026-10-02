import type { ForestHarvest } from "../engine/engine.types";
import type { Tile } from "../world/world.types";
import { felledTreeSignature, treeStageItem } from "./landStageItems";
import type { ObjectRenderItem } from "./objectRenderTypes";

// A felled forest cell (a `forestHarvests` record) draws its Wave 42 stage picture — stump, saplings or young wood, by
// the engine's treeStage (landStageItems.ts, landStageModel.ts) — in place of its trees until the engine drops the record
// (LG-3 ①: grown and open at a year's turn). NAT-5 replaced the screen's own recovery clock (forestRecovery.ts).

export function stumpRenderItemForTile(
  tile: Tile,
  harvestsByTile: ReadonlyMap<string, ForestHarvest>,
  clearedTiles: ReadonlySet<string>,
  tick: number,
): ObjectRenderItem | null {
  const harvest = harvestsByTile.get(tileKey(tile.tx, tile.ty));
  if (harvest === undefined || !isStumpCandidate(tile, clearedTiles)) return null;
  return treeStageItem(harvest, tick);
}

export function forestHarvestLookup(
  harvests: readonly ForestHarvest[],
): ReadonlyMap<string, ForestHarvest> {
  const lookup = new Map<string, ForestHarvest>();
  for (const harvest of harvests) lookup.set(tileKey(harvest.tx, harvest.ty), harvest);
  return lookup;
}

/** The felled trees' part of the object queue's cache key: changes exactly when one of their pictures does. */
export function forestHarvestAgeSignature(
  harvests: readonly ForestHarvest[] | undefined,
  tick: number,
): string {
  return felledTreeSignature(harvests, tick);
}

function isStumpCandidate(tile: Tile, clearedTiles: ReadonlySet<string>): boolean {
  return (
    tile.terrain === "forest" &&
    tile.buildingId === null &&
    !tile.hasRoad &&
    !clearedTiles.has(tileKey(tile.tx, tile.ty))
  );
}

function tileKey(tx: number, ty: number): string {
  return `${tx}:${ty}`;
}
