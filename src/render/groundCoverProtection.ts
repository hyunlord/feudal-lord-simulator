import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import {
  constructionSiteCacheKey,
  constructionSiteFootprint,
  type ConstructionSite,
} from "../economy/construction";
import type { Tile } from "../world/world.types";

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
  if (cached?.buildingSignature === buildingSignature) return cached.keys;

  const keys = new Set<string>();
  for (const tile of tiles) {
    if (tile.hasRoad) addGroundCoverApron(keys, { tx: tile.tx, ty: tile.ty, width: 1, height: 1 });
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

function addGroundCoverApron(keys: Set<string>, area: TileArea): void {
  const radius = 2;
  for (let apronTy = area.ty - radius; apronTy < area.ty + area.height + radius; apronTy += 1) {
    for (let apronTx = area.tx - radius; apronTx < area.tx + area.width + radius; apronTx += 1) {
      keys.add(`${apronTx}:${apronTy}`);
    }
  }
}
