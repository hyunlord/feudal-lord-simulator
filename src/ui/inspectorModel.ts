import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import { constructionSiteDisplayName, type ConstructionSite } from "../economy/construction";
import type { GameState } from "../engine/engine.types";
import { houseHasFood } from "../population/houseFood";
import { buildingInspectorModel } from "../render/buildingInspectorModel";
import { ALERT_STACK_COPY } from "./alertStackCopy.ko";
import { IN_TRANSIT_CAUSE_MARK } from "./alertStackModel";
import type { CauseDetail } from "./causeRegistry";
import { constructionAccessModel, currentConstructionSiteLabel, type ConstructionAccessModel } from "./constructionAccessModel";
import { houseDiagnosisModel } from "./houseDiagnosisModel";
import { buildingCausePresentation, houseProgressModel } from "./houseProgressModel";
import { INSPECTOR_COPY } from "./inspectorCopy.ko";
import { buildingProblemCause } from "./problemCauseModel";

// Left inspector: name, one state line, "왜?" (causes, the blocking one first) and "조치" (one or two things to do).
// Causes come from the same models as the cause map and the warning stack (`buildingCauseSnapshot` for buildings,
// `constructionAccessModel` for construction sites), so the three never disagree.

export type InspectorLine = Readonly<{
  text: string;
  /** The cause that stops production, growth or construction (drawn as the block line). */
  block: boolean;
}>;

export type InspectorModel = Readonly<{
  targetId: string;
  target: "building" | "site";
  name: string;
  stateLine: string;
  why: readonly InspectorLine[];
  actions: readonly string[];
}>;

const MAX_WHY_LINES = 3;
const MAX_ACTIONS = 2;

function serviceAction(requirement: "water" | "market" | "church", reason: string): readonly string[] {
  const copy = INSPECTOR_COPY.action.service[requirement];
  switch (reason) {
    case "missing": return [copy.missing];
    case "outside": return [copy.outside];
    case "capacity": return [copy.capacity];
    case "unreachable": return [copy.unreachable];
    default: return [];
  }
}

function breadAction(reason: string): readonly string[] {
  const copy = INSPECTOR_COPY.action;
  switch (reason) {
    case "no_granary": return [copy.buildGranary];
    case "granary_empty": return [copy.fillGranary];
    case "road_disconnected": return [copy.connectGranary];
    case "delivery_range": return [copy.granaryNear];
    case "awaiting_delivery": return [copy.awaitDelivery];
    default: return [];
  }
}

function facilityAction(state: GameState, building: Building, blocker: CauseDetail): readonly string[] {
  const copy = INSPECTOR_COPY.action;
  switch (blocker.reason) {
    case "storage_overflow": case "output_full": return [copy.moreStorage];
    case "no_road": return [copy.connectRoad];
    case "no_input": {
      const input = BUILDING_CONFIG_BY_KIND[building.kind].production?.input ?? null;
      if (input === null) return [];
      if (blocker.label.includes(IN_TRANSIT_CAUSE_MARK)) return [copy.awaitHaul];
      const anySupply = state.buildings.some((candidate) => (candidate.inventory[input] ?? 0) > 0);
      return [anySupply ? copy.connectSupply : copy.produceInput[input] ?? copy.connectSupply];
    }
    default: return [];
  }
}

function blockerActions(state: GameState, building: Building, blocker: CauseDetail): readonly string[] {
  const copy = INSPECTOR_COPY.action;
  if (blocker.reason === "paused") return [copy.resume];
  if (blocker.reason === "upkeep_unpaid") return [copy.payUpkeep];
  if (blocker.reason === "understaffed") {
    return [state.idleWorkers > 0 ? copy.assignableHands(state.idleWorkers) : copy.moreHands];
  }
  switch (blocker.requirement) {
    case "water": case "market": case "church": return serviceAction(blocker.requirement, blocker.reason);
    case "bread": return breadAction(blocker.reason);
    case "granary": return [copy.granaryNear];
    case "protected": return [copy.wall];
    case "production": return facilityAction(state, building, blocker);
  }
}

function houseState(state: GameState, building: Building, name: string): string {
  const progress = houseProgressModel(state, building.id);
  const residents = state.houses.find((house) => house.buildingId === building.id)?.residents ?? 0;
  if (progress === null) return INSPECTOR_COPY.houseState(name, residents, INSPECTOR_COPY.houseSteady(0));
  const status = progress.status === "ready" ? progress.summary
    : progress.status === "risk" ? INSPECTOR_COPY.houseRisk(progress.currentLevel)
      : progress.status === "blocked" ? INSPECTOR_COPY.houseBlocked(progress.nextLevel ?? progress.currentLevel)
        : INSPECTOR_COPY.houseSteady(progress.currentLevel);
  return INSPECTOR_COPY.houseState(name, residents, status);
}

/** Causes that are not the blocker but still explain the building (water, bread, starvation, production). */
function supportingCauses(state: GameState, building: Building, blocker: CauseDetail | null): readonly string[] {
  if (building.kind !== "house") {
    const problem = buildingProblemCause(state, building.id);
    return problem === null ? [] : [problem];
  }
  const diagnosis = houseDiagnosisModel(state, building.id);
  const house = state.houses.find((candidate) => candidate.buildingId === building.id);
  if (diagnosis === null || house === undefined) return [];
  return [
    ...(blocker?.requirement !== "water" && diagnosis.water.kind !== "supplied" ? [diagnosis.water.label] : []),
    // Opening cottages start without bread inside a starvation grace; only an unfed house past it is a cause.
    ...(blocker?.requirement !== "bread" && !houseHasFood(house) && state.tick > (house.starvationGraceUntilTick ?? 0)
      ? [diagnosis.bread.label] : []),
    ...(diagnosis.population.kind === "declining" ? [diagnosis.population.label] : []),
  ];
}

function buildingInspector(state: GameState, building: Building): InspectorModel | null {
  const presentation = buildingCausePresentation(state, building.id);
  const basics = buildingInspectorModel(state, building.id);
  if (presentation === null || basics === null) return null;
  const blocker = presentation.blocker !== null && presentation.blocker.label !== "" ? presentation.blocker : null;
  const stopped = presentation.status === "blocked" || presentation.status === "risk";
  const lines: InspectorLine[] = blocker === null ? [] : [{ text: blocker.label, block: stopped }];
  for (const text of supportingCauses(state, building, blocker)) {
    if (!lines.some((line) => line.text === text)) lines.push({ text, block: false });
  }
  const required = BUILDING_CONFIG_BY_KIND[building.kind].workersRequired;
  const facilityStatus = stopped ? INSPECTOR_COPY.facilityStopped : INSPECTOR_COPY.facilityRunning;
  return {
    targetId: building.id,
    target: "building",
    name: basics.name,
    stateLine: building.kind === "house" ? houseState(state, building, basics.name)
      : required > 0 ? INSPECTOR_COPY.facilityState(building.workers, required, facilityStatus) : facilityStatus,
    why: lines.slice(0, MAX_WHY_LINES),
    actions: (blocker === null ? [] : blockerActions(state, building, blocker)).slice(0, MAX_ACTIONS),
  };
}

function siteActions(access: ConstructionAccessModel): readonly string[] {
  const copy = INSPECTOR_COPY.action;
  switch (access.cause) {
    case "road_disconnected": case "no_route":
      return [access.missingRoadTiles.length === 1 ? copy.siteRoadOne
        : access.missingRoadTiles.length > 1 ? copy.siteRoadMany : copy.siteRoad];
    case "wall_blocked": return [copy.siteWall];
    case "no_material": return [copy.siteMaterial];
    case "no_workers": return [copy.siteWorkers];
    case "reserve_held": return [copy.siteReserve];
    case "reserve_deadlock": return [copy.siteDeadlock];
    case "none": return [];
  }
}

function siteInspector(state: GameState, site: ConstructionSite): InspectorModel {
  const access = constructionAccessModel(state, site);
  const onSite = currentConstructionSiteLabel(state, site);
  return {
    targetId: site.id,
    target: "site",
    name: INSPECTOR_COPY.siteName(constructionSiteDisplayName(site)),
    stateLine: onSite !== "" ? onSite : INSPECTOR_COPY.siteWorking(site.builderTicks, site.requiredBuilderTicks, site.assignedBuilders),
    why: access.cause === "none" ? [] : [{
      text: access.cause === "reserve_deadlock" ? access.label : ALERT_STACK_COPY.site[access.cause].cause,
      block: true,
    }],
    actions: siteActions(access).slice(0, MAX_ACTIONS),
  };
}

/** Inspector content for a building or construction-site id; null when nothing is selected or the id is unknown. */
export function inspectorModel(state: GameState, targetId: string | null): InspectorModel | null {
  if (targetId === null) return null;
  const building = state.buildings.find((candidate) => candidate.id === targetId);
  if (building !== undefined) return buildingInspector(state, building);
  const site = state.constructionSites.find((candidate) => candidate.id === targetId);
  return site === undefined ? null : siteInspector(state, site);
}
