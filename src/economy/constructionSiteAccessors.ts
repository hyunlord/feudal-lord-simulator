import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import type { TileCoordinate } from "../geometry/tileGeometry";
import type {
  BuildingConstructionSite,
  ConstructionSite,
  ConstructionSiteFootprint,
  StoneWallConstructionSite,
  WallConstructionSite,
} from "./constructionSites";

// BLD-REG / C4: a site is a wall segment (named here) or a building — any kind of `BUILDING_CONFIG_BY_KIND`, so a new
// building kind needs no line in this file.

export function isBuildingConstructionSite(
  site: ConstructionSite,
): site is BuildingConstructionSite {
  return Object.hasOwn(BUILDING_CONFIG_BY_KIND, site.kind);
}

export function isStoneWallConstructionSite(
  site: ConstructionSite,
): site is StoneWallConstructionSite {
  return site.kind === "stone_wall_segment";
}

export function isWallConstructionSite(
  site: ConstructionSite,
): site is WallConstructionSite {
  return site.kind === "palisade_segment" || site.kind === "stone_wall_segment";
}

export function constructionSiteAnchor(site: ConstructionSite): TileCoordinate {
  return isWallConstructionSite(site) ? site.anchor : { tx: site.tx, ty: site.ty };
}

export function constructionSiteFootprint(site: ConstructionSite): ConstructionSiteFootprint {
  if (isWallConstructionSite(site)) {
    const xs = site.path.map((point) => point.x);
    const ys = site.path.map((point) => point.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    return {
      tx: minX,
      ty: minY,
      width: Math.max(1, Math.max(...xs) - minX),
      height: Math.max(1, Math.max(...ys) - minY),
    };
  }
  const definition = BUILDING_CONFIG_BY_KIND[site.kind];
  return { tx: site.tx, ty: site.ty, width: definition.width, height: definition.height };
}

export function constructionSiteDisplayName(site: ConstructionSite): string {
  if (site.kind === "palisade_segment") return "목책 구간";
  if (site.kind === "stone_wall_segment") return "석벽 구간";
  return BUILDING_CONFIG_BY_KIND[site.kind].name;
}

export function constructionSiteCacheKey(site: ConstructionSite): string {
  if (isWallConstructionSite(site)) {
    return [
      site.kind,
      site.id,
      site.wallId,
      site.segmentIndex,
      site.order,
      site.path.map((point) => `${point.x},${point.y}`).join(";"),
    ].join(":");
  }
  return `${site.kind}:${site.id}:${site.tx}:${site.ty}`;
}
