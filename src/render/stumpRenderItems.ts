import type { ForestHarvest } from "../engine/engine.types";
import { stumpAgeAt } from "../engine/forestHarvests";
import type { Tile } from "../world/world.types";
import { depthKey } from "./iso";
import type { ObjectRenderItem } from "./objectRenderTypes";
import { buildStumpDescriptor } from "./treeLayout";

export function stumpRenderItemForTile(
  tile: Tile,
  harvestsByTile: ReadonlyMap<string, ForestHarvest>,
  clearedTiles: ReadonlySet<string>,
  tick: number,
): ObjectRenderItem | null {
  const harvest = harvestsByTile.get(tileKey(tile.tx, tile.ty));
  if (harvest === undefined || !isStumpCandidate(tile, clearedTiles)) return null;
  const stump = buildStumpDescriptor({ harvest, tick });
  return {
    kind: "stump",
    id: stump.id,
    descriptor: stump,
    depth: depthKey(stump.anchorTx, stump.anchorTy),
    anchorTx: stump.anchorTx,
  };
}

export function forestHarvestLookup(
  harvests: readonly ForestHarvest[],
): ReadonlyMap<string, ForestHarvest> {
  const lookup = new Map<string, ForestHarvest>();
  for (const harvest of harvests) lookup.set(tileKey(harvest.tx, harvest.ty), harvest);
  return lookup;
}

export function forestHarvestAgeSignature(
  harvests: readonly ForestHarvest[],
  tick: number,
): string {
  return harvests
    .map((harvest) => `${harvest.tx},${harvest.ty},${stumpAgeAt(harvest, tick)}`)
    .join("|");
}

function isStumpCandidate(tile: Tile, clearedTiles: ReadonlySet<string>): boolean {
  return (
    tile.buildingId === null &&
    !tile.hasRoad &&
    !clearedTiles.has(tileKey(tile.tx, tile.ty))
  );
}

function tileKey(tx: number, ty: number): string {
  return `${tx}:${ty}`;
}
