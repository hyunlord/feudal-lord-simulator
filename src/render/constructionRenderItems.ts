import {
  constructionSiteFootprint,
  type ConstructionSite,
} from "../economy/construction";
import { depthKey } from "./iso";
import { footprintHasVisibleTile, type TileRange } from "./renderVisibility";

export type ConstructionSiteRenderItem = {
  readonly kind: "construction_site";
  readonly id: string;
  readonly site: ConstructionSite;
  readonly depth: number;
  readonly anchorTx: number;
};

export function constructionSiteRenderItem(
  site: ConstructionSite,
  range: TileRange,
): ConstructionSiteRenderItem | null {
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
    depth: depthKey(footprint.tx + footprint.width - 1, footprint.ty + footprint.height - 1),
    anchorTx: footprint.tx + footprint.width - 1,
  };
}
