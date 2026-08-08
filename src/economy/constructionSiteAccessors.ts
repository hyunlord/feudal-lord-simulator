import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import type { TileCoordinate } from "../geometry/tileGeometry";
import type {
  BuildingConstructionSite,
  ConstructionSite,
  ConstructionSiteFootprint,
  StoneWallConstructionSite,
  WallConstructionSite,
} from "./constructionSites";

function assertNever(value: never): never {
  throw new Error(`Unhandled construction site variant: ${JSON.stringify(value)}`);
}

export function isBuildingConstructionSite(
  site: ConstructionSite,
): site is BuildingConstructionSite {
  switch (site.kind) {
    case "palisade_segment":
    case "stone_wall_segment":
      return false;
    case "house":
    case "well":
    case "storehouse":
    case "granary":
    case "chapel":
    case "wheat_farm":
    case "mill":
    case "logging_camp":
    case "sawmill":
    case "quarry":
    case "masonry":
    case "market":
    case "church":
    case "keep":
      return true;
    default:
      return assertNever(site);
  }
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
  switch (site.kind) {
    case "palisade_segment":
    case "stone_wall_segment":
      return site.anchor;
    case "house":
    case "well":
    case "storehouse":
    case "granary":
    case "chapel":
    case "wheat_farm":
    case "mill":
    case "logging_camp":
    case "sawmill":
    case "quarry":
    case "masonry":
    case "market":
    case "church":
    case "keep":
      return { tx: site.tx, ty: site.ty };
    default:
      return assertNever(site);
  }
}

export function constructionSiteFootprint(site: ConstructionSite): ConstructionSiteFootprint {
  switch (site.kind) {
    case "palisade_segment": {
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
    case "stone_wall_segment": {
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
    case "house":
    case "well":
    case "storehouse":
    case "granary":
    case "chapel":
    case "wheat_farm":
    case "mill":
    case "logging_camp":
    case "sawmill":
    case "quarry":
    case "masonry":
    case "market":
    case "church":
    case "keep": {
      const definition = BUILDING_CONFIG_BY_KIND[site.kind];
      return { tx: site.tx, ty: site.ty, width: definition.width, height: definition.height };
    }
    default:
      return assertNever(site);
  }
}

export function constructionSiteDisplayName(site: ConstructionSite): string {
  switch (site.kind) {
    case "palisade_segment":
      return "목책 구간";
    case "stone_wall_segment":
      return "석벽 구간";
    case "house":
    case "well":
    case "storehouse":
    case "granary":
    case "chapel":
    case "wheat_farm":
    case "mill":
    case "logging_camp":
    case "sawmill":
    case "quarry":
    case "masonry":
    case "market":
    case "church":
    case "keep":
      return BUILDING_CONFIG_BY_KIND[site.kind].name;
    default:
      return assertNever(site);
  }
}

export function constructionSiteCacheKey(site: ConstructionSite): string {
  switch (site.kind) {
    case "palisade_segment":
    case "stone_wall_segment":
      return [
        site.kind,
        site.id,
        site.wallId,
        site.segmentIndex,
        site.order,
        site.path.map((point) => `${point.x},${point.y}`).join(";"),
      ].join(":");
    case "house":
    case "well":
    case "storehouse":
    case "granary":
    case "chapel":
    case "wheat_farm":
    case "mill":
    case "logging_camp":
    case "sawmill":
    case "quarry":
    case "masonry":
    case "market":
    case "church":
    case "keep":
      return `${site.kind}:${site.id}:${site.tx}:${site.ty}`;
    default:
      return assertNever(site);
  }
}
