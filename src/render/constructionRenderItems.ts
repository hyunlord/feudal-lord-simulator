import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import type { ConstructionSite } from "../economy/construction";
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
  const config = BUILDING_CONFIG_BY_KIND[site.kind];
  if (
    !footprintHasVisibleTile({
      tx: site.tx,
      ty: site.ty,
      width: config.width,
      height: config.height,
    }, range)
  ) {
    return null;
  }
  return {
    kind: "construction_site",
    id: site.id,
    site,
    depth: depthKey(site.tx + config.width - 1, site.ty + config.height - 1),
    anchorTx: site.tx + config.width - 1,
  };
}
