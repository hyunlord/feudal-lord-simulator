import type { TileCoordinate } from "../geometry/tileGeometry";
import type { ConstructionLabourSite } from "./labour";

export type BuilderLabourWalker = {
  readonly id: string;
  readonly kind: "builder";
  readonly homeBuildingId: string;
  readonly siteId: string;
  readonly slotIndex: number;
  readonly position: { readonly tx: number; readonly ty: number };
  readonly path: readonly [];
  readonly pathIndex: 0;
  readonly previousTile: null;
  readonly cargo: null;
  readonly spawnedTick: 0;
};

const BUILDER_ANCHORS = [
  { tx: 0.25, ty: 0.25 },
  { tx: 0.65, ty: 0.35 },
  { tx: 0.45, ty: 0.7 },
] as const;

function constructionLabourSiteAnchor(site: ConstructionLabourSite): TileCoordinate {
  switch (site.kind) {
    case "palisade_segment":
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
      return { tx: site.tx, ty: site.ty };
  }
}

const wholeNonnegative = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export function builderWalkersForSites(
  constructionSites: readonly ConstructionLabourSite[],
): readonly BuilderLabourWalker[] {
  return [...constructionSites]
    .sort((left, right) => left.id.localeCompare(right.id))
    .flatMap((site) => {
      const siteAnchor = constructionLabourSiteAnchor(site);
      return BUILDER_ANCHORS.slice(0, wholeNonnegative(site.assignedBuilders)).map(
        (anchor, slotIndex): BuilderLabourWalker => ({
          id: `builder:${site.id}:${slotIndex}`,
          kind: "builder",
          homeBuildingId: site.id,
          siteId: site.id,
          slotIndex,
          position: { tx: siteAnchor.tx + anchor.tx, ty: siteAnchor.ty + anchor.ty },
          path: [],
          pathIndex: 0,
          previousTile: null,
          cargo: null,
          spawnedTick: 0,
        }),
      );
    });
}
