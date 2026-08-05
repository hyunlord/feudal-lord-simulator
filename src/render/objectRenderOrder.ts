import type { Walker } from "../agents/walker.types";
import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import type { Tile } from "../world/world.types";
import { depthKey } from "./iso";
import type { TileRange } from "./renderer";
import {
  buildForestLookup,
  buildGroundCover,
  buildTreeCluster,
  type GroundCoverDescriptor,
  type TreeDescriptor,
} from "./treeLayout";
import { walkerVisualAnchor } from "./walkerAnchor";

export type ObjectRenderItem =
  | {
      readonly kind: "tree";
      readonly id: string;
      readonly descriptor: TreeDescriptor;
      readonly depth: number;
      readonly anchorTx: number;
    }
  | {
      readonly kind: "groundCover";
      readonly id: string;
      readonly descriptor: GroundCoverDescriptor;
      readonly depth: number;
      readonly anchorTx: number;
    }
  | {
      readonly kind: "building";
      readonly id: string;
      readonly building: Building;
      readonly depth: number;
      readonly anchorTx: number;
    }
  | {
      readonly kind: "walker";
      readonly id: string;
      readonly walker: Walker;
      readonly depth: number;
      readonly anchorTx: number;
    };

type ObjectRenderInput = {
  readonly tiles: readonly Tile[];
  readonly worldTiles?: readonly Tile[];
  readonly buildings: readonly Building[];
  readonly walkers?: readonly Walker[];
  readonly range: TileRange;
  readonly seed?: number;
  readonly includeGroundCover?: boolean;
};

type TileArea = {
  readonly tx: number;
  readonly ty: number;
  readonly width: number;
  readonly height: number;
};

export function buildObjectRenderItems(input: ObjectRenderInput): readonly ObjectRenderItem[] {
  const items: ObjectRenderItem[] = [];
  const clearedTiles = clearedTreeTileKeys(input.buildings);
  const seed = input.seed ?? 0;
  const worldTiles = input.worldTiles ?? input.tiles;
  const foliageTiles = input.tiles.filter((tile) => tilePosIsWithinRange(tile.tx, tile.ty, input.range));
  const forestLookup = buildForestLookup(worldTiles);
  const protectedGroundCoverTiles = groundCoverProtectedTileKeys(worldTiles, input.buildings);

  for (const tile of foliageTiles) {
    if (tile.terrain === "forest" && isTreeCandidate(tile, clearedTiles)) {
      for (const tree of buildTreeCluster({ tile, forestLookup, seed })) {
        items.push({
          kind: "tree",
          id: tree.id,
          descriptor: tree,
          depth: depthKey(tree.anchorTx, tree.anchorTy),
          anchorTx: tree.anchorTx,
        });
      }
    } else if (
      (input.includeGroundCover ?? true) &&
      !protectedGroundCoverTiles.has(tileKey(tile.tx, tile.ty))
    ) {
      for (const groundCover of buildGroundCover({ tile, seed })) {
        items.push({
          kind: "groundCover",
          id: groundCover.id,
          descriptor: groundCover,
          depth: depthKey(groundCover.anchorTx, groundCover.anchorTy),
          anchorTx: groundCover.anchorTx,
        });
      }
    }
  }

  for (const walker of input.walkers ?? []) {
    if (tilePosIsWithinRange(walker.position.tx, walker.position.ty, input.range)) {
      const anchor = walkerVisualAnchor(walker.position);
      items.push({
        kind: "walker",
        id: walker.id,
        walker,
        depth: depthKey(anchor.tx, anchor.ty),
        anchorTx: anchor.tx,
      });
    }
  }

  for (const building of input.buildings) {
    const config = BUILDING_CONFIG_BY_KIND[building.kind];
    if (!footprintOverlapsRange(building.tx, building.ty, config.width, config.height, input.range)) {
      continue;
    }
    items.push({
      kind: "building",
      id: building.id,
      building,
      depth: depthKey(building.tx + config.width - 1, building.ty + config.height - 1),
      anchorTx: building.tx + config.width - 1,
    });
  }

  return items.sort(compareRenderItems);
}

export function clearedTreeTileKeys(buildings: readonly Building[]): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const building of buildings) {
    const config = BUILDING_CONFIG_BY_KIND[building.kind];
    for (let ty = building.ty - 1; ty <= building.ty + config.height; ty += 1) {
      for (let tx = building.tx - 1; tx <= building.tx + config.width; tx += 1) {
        keys.add(tileKey(tx, ty));
      }
    }
  }
  return keys;
}

export function groundCoverProtectedTileKeys(
  tiles: readonly Tile[],
  buildings: readonly Building[],
): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const tile of tiles) {
    if (tile.hasRoad) {
      addGroundCoverApron(keys, { tx: tile.tx, ty: tile.ty, width: 1, height: 1 });
    }
  }
  for (const building of buildings) {
    const config = BUILDING_CONFIG_BY_KIND[building.kind];
    addGroundCoverApron(keys, {
      tx: building.tx,
      ty: building.ty,
      width: config.width,
      height: config.height,
    });
  }
  return keys;
}

function compareRenderItems(left: ObjectRenderItem, right: ObjectRenderItem): number {
  const depthDifference = left.depth - right.depth;
  if (depthDifference !== 0) return depthDifference;

  const anchorDifference = left.anchorTx - right.anchorTx;
  return anchorDifference !== 0 ? anchorDifference : left.id.localeCompare(right.id);
}

function isTreeCandidate(tile: Tile, clearedTiles: ReadonlySet<string>): boolean {
  return (
    tile.buildingId === null &&
    !tile.hasRoad &&
    !clearedTiles.has(tileKey(tile.tx, tile.ty))
  );
}

function addGroundCoverApron(keys: Set<string>, area: TileArea): void {
  const radius = 2;
  for (let apronTy = area.ty - radius; apronTy < area.ty + area.height + radius; apronTy += 1) {
    for (let apronTx = area.tx - radius; apronTx < area.tx + area.width + radius; apronTx += 1) {
      keys.add(tileKey(apronTx, apronTy));
    }
  }
}

function tilePosIsWithinRange(tx: number, ty: number, range: TileRange): boolean {
  return tx >= range.minTx && tx <= range.maxTx && ty >= range.minTy && ty <= range.maxTy;
}

function footprintOverlapsRange(
  tx: number,
  ty: number,
  width: number,
  height: number,
  range: TileRange,
): boolean {
  return (
    tx <= range.maxTx &&
    tx + width - 1 >= range.minTx &&
    ty <= range.maxTy &&
    ty + height - 1 >= range.minTy
  );
}

function tileKey(tx: number, ty: number): string {
  return `${tx}:${ty}`;
}
