import { constructionSiteFootprint, isBuildingConstructionSite } from "../economy/construction";
import { buildingFootprint } from "../geometry/buildingFootprint";
import type { PalisadeFootprint } from "../world/palisadeGeometry";
import type { GameState } from "./engine.types";

export function palisadeFootprintsForState(state: GameState): readonly PalisadeFootprint[] {
  return [
    ...state.buildings.map(building => ({
      id: building.id,
      tx: building.tx,
      ty: building.ty,
      ...buildingFootprint(building),
    })),
    ...state.constructionSites.filter(isBuildingConstructionSite).map(site => ({
      id: site.id,
      ...constructionSiteFootprint(site),
    })),
  ].sort((left, right) => left.id.localeCompare(right.id));
}
