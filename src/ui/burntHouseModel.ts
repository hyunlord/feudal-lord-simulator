import { resourceName } from "../content/resourceCatalog.ko";
import type { ResourceType } from "../content/resourceConfig";
import type { BuildingConstructionSite } from "../domain/constructionSite";
import { isBuildingConstructionSite } from "../economy/constructionSiteAccessors";
import type { GameState } from "../engine/engine.types";
import { rebuildSiteFor } from "../engine/fire";
import { lordMode } from "../engine/townAgency";
import { ALERT_STACK_COPY } from "./alertStackCopy.ko";
import { BURNT_HOUSE_COPY } from "./burntHouseCopy.ko";
import { constructionAccessModel } from "./constructionAccessModel";
import { siteActions } from "./inspectorModel";

// LM-R1 (playtest 2026-10-02 #8): a burnt house's card answers "is it coming back, what does that need, what do I do":
// the rebuild site's work and builders (EV-6 `rebuildOf`), its materials and the cause that holds it (the construction
// access model the site's own card reads), and the one thing to do — start the rebuild (the `rebuild_house` command,
// the bot's and the town agency's own), fix the site's cause, or wait. In lord mode the town rebuilds by itself.

export type BurntHouseView = Readonly<{
  buildingId: string;
  status: string;
  conditions: readonly Readonly<{ text: string; met: boolean }>[];
  now: string;
  /** The player may start the rebuild (no site yet, not lord mode, the engine would place it). */
  canRebuild: boolean;
  household: string | null;
}>;

function rebuildSite(state: GameState, buildingId: string): BuildingConstructionSite | null {
  for (const site of state.constructionSites) if (isBuildingConstructionSite(site) && site.rebuildOf === buildingId) return site;
  return null;
}

function materials(site: BuildingConstructionSite, withDelivered: boolean): readonly Readonly<{ text: string; met: boolean }>[] {
  return (Object.entries(site.required) as [ResourceType, number | undefined][]).flatMap(([resource, required]) => {
    if (required === undefined || required <= 0) return [];
    const delivered = Math.floor(site.delivered[resource] ?? 0);
    return [withDelivered ? { text: BURNT_HOUSE_COPY.material(resourceName(resource), Math.min(delivered, required), required), met: delivered >= required }
      : { text: BURNT_HOUSE_COPY.materialNeeded(resourceName(resource), required), met: false }];
  });
}

/** The burnt house's card section, or null when the house is not burnt. */
export function burntHouseView(state: GameState, buildingId: string): BurntHouseView | null {
  const house = state.houses.find(candidate => candidate.buildingId === buildingId);
  if (house?.burntTick === undefined) return null;
  const household = house.residents > 0 ? BURNT_HOUSE_COPY.household(house.residents) : null;
  const site = rebuildSite(state, buildingId);
  const lord = lordMode(state);
  if (site === null) {
    const preview = rebuildSiteFor(state, buildingId);
    const canRebuild = !lord && preview !== null;
    return { buildingId, status: lord ? BURNT_HOUSE_COPY.townWaits : BURNT_HOUSE_COPY.notStarted,
      conditions: [...preview === null ? [] : materials(preview, false), { text: BURNT_HOUSE_COPY.builders, met: state.idleWorkers > 0 }],
      now: lord ? BURNT_HOUSE_COPY.townPrompt : BURNT_HOUSE_COPY.startPrompt, canRebuild, household };
  }
  const percent = site.requiredBuilderTicks <= 0 ? 100 : Math.min(100, Math.floor(site.builderTicks * 100 / site.requiredBuilderTicks));
  const access = constructionAccessModel(state, site);
  const blocked = access.cause === "none" ? [] : [{ text: access.cause === "reserve_deadlock" ? access.label : ALERT_STACK_COPY.site[access.cause].cause, met: false }];
  const conditions = [...materials(site, true), ...blocked];
  return { buildingId, status: BURNT_HOUSE_COPY.rebuilding(percent, site.assignedBuilders),
    conditions: conditions.length > 0 ? conditions : [{ text: BURNT_HOUSE_COPY.allMet, met: true }], now: siteActions(access)[0] ?? BURNT_HOUSE_COPY.wait, canRebuild: false, household };
}
