import type { Walker } from "../agents/walker.types";
import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import {
  constructionSiteCacheKey,
  constructionSiteFootprint,
  type ConstructionSite,
} from "../economy/construction";
import type { PalisadeState } from "../engine/engine.types";
import type { Tile } from "../world/world.types";
import {
  constructionSiteRenderItem,
} from "./constructionRenderItems";
import { depthKey } from "./iso";
import { palisadeSegmentRenderItems } from "./palisadeObjectRenderItems";
import type {
  ObjectRenderItem,
  RenderQueueItem,
  WorldObjectRenderItem,
} from "./objectRenderTypes";
import {
  footprintHasVisibleTile,
  tileIsVisibleInRange,
  type TileRange,
} from "./renderVisibility";
import {
  buildForestLookup,
  buildGroundCover,
  buildTreeCluster,
} from "./treeLayout";
import { walkerVisualAnchor } from "./walkerAnchor";
export type { ObjectRenderItem, RenderQueueItem, WorldObjectRenderItem };

type ObjectRenderInput = {
  readonly tiles: readonly Tile[];
  readonly worldTiles?: readonly Tile[];
  readonly buildings: readonly Building[];
  readonly palisade?: PalisadeState | null;
  readonly constructionSites?: readonly ConstructionSite[] | undefined;
  readonly walkers?: readonly Walker[];
  readonly range: TileRange;
  readonly seed?: number;
  readonly includeGroundCover?: boolean;
};
type ObjectRenderInputWithoutConstruction = Omit<ObjectRenderInput, "constructionSites"> & {
  readonly constructionSites?: undefined;
};

type TileArea = {
  readonly tx: number;
  readonly ty: number;
  readonly width: number;
  readonly height: number;
};

const groundCoverProtectionCache = new WeakMap<readonly Tile[], {
  readonly buildingSignature: string;
  readonly keys: ReadonlySet<string>;
}>();

export function buildObjectRenderItems(
  input: ObjectRenderInputWithoutConstruction,
): readonly WorldObjectRenderItem[];
export function buildObjectRenderItems(
  input: ObjectRenderInput & { readonly constructionSites: readonly ConstructionSite[] },
): readonly RenderQueueItem[];
export function buildObjectRenderItems(
  input: ObjectRenderInput,
): readonly RenderQueueItem[] {
  const items: RenderQueueItem[] = [];
  const constructionSites = input.constructionSites ?? [];
  const clearedTiles = clearedTreeTileKeys(input.buildings, constructionSites);
  const seed = input.seed ?? 0;
  const worldTiles = input.worldTiles ?? input.tiles;
  const foliageTiles = input.tiles.filter((tile) =>
    tileIsVisibleInRange(tile.tx, tile.ty, input.range),
  );
  const forestLookup = buildForestLookup(worldTiles);
  const protectedGroundCoverTiles = groundCoverProtectedTileKeys(worldTiles, input.buildings, constructionSites);

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
    if (tileIsVisibleInRange(walker.position.tx, walker.position.ty, input.range)) {
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
    if (
      !footprintHasVisibleTile({
        tx: building.tx,
        ty: building.ty,
        width: config.width,
        height: config.height,
      }, input.range)
    ) {
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

  items.push(...palisadeSegmentRenderItems(input.palisade, input.range));

  for (const site of constructionSites) {
    const item = constructionSiteRenderItem(site, constructionSites, input.range);
    if (item !== null) items.push(item);
  }

  return items.sort(compareRenderItems);
}

export function clearedTreeTileKeys(
  buildings: readonly Building[],
  constructionSites: readonly ConstructionSite[] = [],
): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const building of buildings) {
    const config = BUILDING_CONFIG_BY_KIND[building.kind];
    for (let ty = building.ty - 1; ty <= building.ty + config.height; ty += 1) {
      for (let tx = building.tx - 1; tx <= building.tx + config.width; tx += 1) {
        keys.add(tileKey(tx, ty));
      }
    }
  }
  for (const site of constructionSites) {
    const footprint = constructionSiteFootprint(site);
    for (let ty = footprint.ty - 1; ty <= footprint.ty + footprint.height; ty += 1) {
      for (let tx = footprint.tx - 1; tx <= footprint.tx + footprint.width; tx += 1) {
        keys.add(tileKey(tx, ty));
      }
    }
  }
  return keys;
}

export function groundCoverProtectedTileKeys(
  tiles: readonly Tile[],
  buildings: readonly Building[],
  constructionSites: readonly ConstructionSite[] = [],
): ReadonlySet<string> {
  const buildingSignature = [
    ...buildings.map((building) => `${building.kind}:${building.tx}:${building.ty}`),
    ...constructionSites.map(constructionSiteCacheKey),
  ]
    .join("|");
  const cached = groundCoverProtectionCache.get(tiles);
  if (cached?.buildingSignature === buildingSignature) {
    return cached.keys;
  }
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
  for (const site of constructionSites) {
    const footprint = constructionSiteFootprint(site);
    addGroundCoverApron(keys, {
      tx: footprint.tx,
      ty: footprint.ty,
      width: footprint.width,
      height: footprint.height,
    });
  }
  groundCoverProtectionCache.set(tiles, { buildingSignature, keys });
  return keys;
}

function compareRenderItems(left: RenderQueueItem, right: RenderQueueItem): number {
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

function tileKey(tx: number, ty: number): string {
  return `${tx}:${ty}`;
}
