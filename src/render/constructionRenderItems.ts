import {
  constructionSiteFootprint,
  type ConstructionSite,
} from "../economy/construction";
import {
  isPalisadeConstructionSite,
  palisadeConstructionSchedule,
  type PalisadeConstructionSchedule,
} from "../economy/palisadeConstruction";
import { depthKey } from "./iso";
import {
  palisadePathVisible,
  palisadeRenderAnchor,
  palisadeSitePath,
} from "./palisadeRenderGeometry";
import { footprintHasVisibleTile, type TileRange } from "./renderVisibility";

export type ConstructionSiteRenderItem = {
  readonly kind: "construction_site";
  readonly id: string;
  readonly site: ConstructionSite;
  readonly schedule: PalisadeConstructionSchedule;
  readonly depth: number;
  readonly anchorTx: number;
};

export function constructionSiteRenderItem(
  site: ConstructionSite,
  sites: readonly ConstructionSite[],
  range: TileRange,
): ConstructionSiteRenderItem | null {
  if (isPalisadeConstructionSite(site)) {
    const path = palisadeSitePath(site);
    if (!palisadePathVisible(path, range)) return null;
    const anchor = palisadeRenderAnchor(path);
    return {
      kind: "construction_site",
      id: site.id,
      site,
      schedule: palisadeConstructionSchedule(site, sites),
      depth: anchor.depth,
      anchorTx: anchor.anchorTx,
    };
  }
  const footprint = constructionSiteFootprint(site);
  if (
    !footprintHasVisibleTile(footprint, range)
  ) {
    return null;
  }
  return {
    kind: "construction_site",
    id: site.id,
    site,
    schedule: { kind: "active" },
    depth: depthKey(footprint.tx + footprint.width - 1, footprint.ty + footprint.height - 1),
    anchorTx: footprint.tx + footprint.width - 1,
  };
}
