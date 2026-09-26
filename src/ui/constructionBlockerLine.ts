import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import { RESOURCE_TYPES } from "../content/resourceConfig";
import type { CarterWalker } from "../agents/walker.types";
import type { ConstructionSite } from "../domain/constructionSite";
import type { GameState } from "../engine/engine.types";
import { acceptsResource } from "../economy/storage";
import { constructionSiteAnchor } from "../economy/constructionSiteAccessors";
import { CONSTRUCTION_BLOCKER_COPY } from "./constructionBlockerCopy.ko";

// UX-3R2 site inspector first line (UX3R 6절): what the site waits for, where the nearest stock of it is and how many
// carts are bringing it — "목재 4 대기 — 가장 가까운 창고 12칸, 운반꾼 0". Only while it waits for materials (the other
// stalls keep their own first line). Distances are tile steps (Manhattan) from the site, as the diagnosis rows use.
export function constructionBlockerLine(state: Pick<GameState, "buildings" | "walkers" | "treasuryTimber">, site: ConstructionSite): string | null {
  if (site.stall !== "awaiting_materials" && site.stall !== "no_material_source") return null;
  const waiting = RESOURCE_TYPES.map(resource => ({ resource,
    missing: Math.max(0, (site.required[resource] ?? 0) - (site.delivered[resource] ?? 0) - (site.reserved[resource] ?? 0)) }))
    .find(entry => entry.missing > 0);
  if (waiting === undefined) return null;
  const anchor = constructionSiteAnchor(site);
  const stores = state.buildings.filter(building => acceptsResource(building.kind, waiting.resource) && (building.inventory[waiting.resource] ?? 0) > 0)
    .map(building => ({ building, distance: Math.abs(building.tx - anchor.tx) + Math.abs(building.ty - anchor.ty) }))
    .sort((left, right) => left.distance - right.distance);
  const carters = state.walkers.filter(walker => {
    if (walker.kind !== "carter") return false;
    const destination = (walker as CarterWalker).destination;
    return destination.kind === "construction_site" && destination.siteId === site.id;
  }).length;
  const nearest = stores[0];
  const source = nearest !== undefined ? CONSTRUCTION_BLOCKER_COPY.nearest(BUILDING_CONFIG_BY_KIND[nearest.building.kind].name, nearest.distance)
    : waiting.resource === "timber" && state.treasuryTimber > 0 ? CONSTRUCTION_BLOCKER_COPY.treasury : CONSTRUCTION_BLOCKER_COPY.none;
  return CONSTRUCTION_BLOCKER_COPY.line(CONSTRUCTION_BLOCKER_COPY.resource(waiting.resource), waiting.missing, source, carters);
}
