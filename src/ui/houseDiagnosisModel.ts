import { housePressureCauseLabel, housePressureStatus } from "../population/housePressure";
import { HOUSE_PRESSURE_COPY } from "./housePressureCopy.ko";
import { HOUSE_DIAGNOSIS_COPY } from "./houseDiagnosisCopy.ko";
import { houseHasFood, houseIsStarving } from "../population/houseFood";
import { durationLabel } from "./gameTimeCopy.ko";
import { serviceDiagnosis, type ServiceDiagnosis } from "./serviceDiagnosisModel";
import type { Building } from "../content/buildingConfig";
import { historicalHouseAssetMeta } from "../render/historicalHouseAssets";
import { houseCompoundAssetManifest } from "../render/houseCompoundAssetManifest.generated";
import { assetUrlForBase } from "../render/worldAssets";
import { HOUSING_CONFIG } from "../content/housingConfig";
import { buildingFootprint, houseLotArea } from "../geometry/buildingFootprint";
import { houseMergeOptions, houseMergeStatus, type HouseMergeOption } from "../engine/houseMerge";
import type { GameState } from "../engine/engine.types";
import { houseBuiltLevel, houseCondition, houseConditionLabel, type HouseCondition } from "../population/houseCondition";
import type { House } from "../population/population.types";
import { buildingRoadAccessTiles } from "../engine/routing";
import { palisadeProtectionForBuilding } from "../geometry/palisadeProtection";
import {
  missedHouseRouteReason,
  type DistributorRouteHistory,
  type DistributorRouteMissReason,
} from "./distributorRouteHistory";
import type { MarketAccessDiagnosis } from "../population/marketAccess";
import type { TileCoordinate } from "../world/grid";
import { existingRoadComponent } from "../world/roadGraph";

export type WaterDiagnosis =
  | { readonly kind: "capacity" | "paused" | "understaffed" | "unreachable"; readonly label: string }
  | { readonly kind: "supplied"; readonly label: string; readonly distance: number }
  | { readonly kind: "no_well"; readonly label: typeof HOUSE_DIAGNOSIS_COPY.noWell }
  | {
      readonly kind: "well_too_far";
      readonly label: string;
      readonly distance: number;
      readonly serviceRadius: number;
    };

export type BreadDiagnosis =
  | { readonly kind: "supplied"; readonly label: typeof HOUSE_DIAGNOSIS_COPY.breadSupplied }
  | { readonly kind: "no_granary"; readonly label: typeof HOUSE_DIAGNOSIS_COPY.noGranary }
  | {
      readonly kind: "granary_empty";
      readonly label: typeof HOUSE_DIAGNOSIS_COPY.granaryEmpty;
    }
  | {
      readonly kind: "road_disconnected";
      readonly label: typeof HOUSE_DIAGNOSIS_COPY.roadDisconnected;
    }
  | {
      readonly kind: "not_visited";
      readonly label: string;
      readonly route: DistributorMissedRouteDiagnosis | null;
    };

export type DistributorMissedRouteDiagnosis = DistributorRouteMissReason;

export type HouseDiagnosisModel = {
  readonly buildingId: string;
  readonly name: string;
  readonly thumbnailUrl: string | null;
  readonly level: number;
  readonly builtLevel: number;
  readonly condition: HouseCondition;
  readonly conditionLabel: string;
  readonly residents: number;
  readonly capacity: number;
  readonly footprintLabel: string;
  readonly mergeOptions: readonly HouseMergeOption[];
  readonly mergeStatus: string;
  readonly water: WaterDiagnosis;
  readonly bread: BreadDiagnosis;
  readonly population: PopulationDiagnosis;
  readonly protection: ProtectionDiagnosis;
  /** UI-3: a leaving or abandoned household and why (the engine's FP-3 cause), first in the card. */
  readonly pressure?: string | null;
  readonly market: MarketAccessDiagnosis | { readonly kind: "capacity" | "paused"; readonly label: string };
  readonly church: ServiceDiagnosis;
  readonly stoneHouse: StoneHouseDiagnosis;
};

export type PopulationDiagnosis =
  | { readonly kind: "declining"; readonly label: string; readonly elapsedTicks: number }
  | { readonly kind: "growth_blocked"; readonly label: typeof HOUSE_DIAGNOSIS_COPY.growthBlockedWater | typeof HOUSE_DIAGNOSIS_COPY.growthBlockedFood }
  | { readonly kind: "stable"; readonly label: typeof HOUSE_DIAGNOSIS_COPY.stable };

export type ProtectionDiagnosis =
  | { readonly kind: "inactive"; readonly label: typeof HOUSE_DIAGNOSIS_COPY.wallInactive; readonly amenityBonus: 0 }
  | { readonly kind: "inside"; readonly label: typeof HOUSE_DIAGNOSIS_COPY.wallInside; readonly amenityBonus: 2 }
  | { readonly kind: "outside"; readonly label: typeof HOUSE_DIAGNOSIS_COPY.wallOutside; readonly amenityBonus: 0 };

export type StoneHouseDiagnosis =
  | { readonly kind: "ready"; readonly label: typeof HOUSE_DIAGNOSIS_COPY.stoneHouseReady; readonly blockers: readonly [] }
  | { readonly kind: "blocked"; readonly label: string; readonly blockers: readonly string[] };

const HOUSE_NAMES = HOUSE_DIAGNOSIS_COPY.houseNames;

function coordinateKey(coordinate: TileCoordinate): string {
  return `${coordinate.tx},${coordinate.ty}`;
}

function servingWaterDiagnosis(state: GameState, home: Building): WaterDiagnosis {
  const result = serviceDiagnosis(state, home, "water");
  switch (result.kind) {
    case "served": return { kind: "supplied", label: result.label, distance: result.distance };
    case "missing": return { kind: "no_well", label: HOUSE_DIAGNOSIS_COPY.noWell };
    case "outside": return { kind: "well_too_far", label: result.label, distance: result.distance, serviceRadius: result.serviceRadius };
    case "paused": case "understaffed": case "unreachable": case "capacity": return { kind: result.kind, label: result.label };
  }
}

function servingMarketDiagnosis(state: GameState, home: Building): HouseDiagnosisModel["market"] {
  const result = serviceDiagnosis(state, home, "market");
  switch (result.kind) {
    case "served": return { ...result, kind: "within" };
    case "missing": return { kind: "no_market", label: HOUSE_DIAGNOSIS_COPY.noMarket, serviceRadius: result.serviceRadius };
    case "outside": case "paused": case "understaffed": case "unreachable": case "capacity": return { ...result, kind: result.kind };
  }
}

function populationDiagnosis(state: GameState, house: House): PopulationDiagnosis {
  const elapsedTicks = house.emptyFoodTicks ?? 0;
  if (houseIsStarving(house, state.tick)) {
    return {
      kind: "declining",
      label: HOUSE_DIAGNOSIS_COPY.declining(durationLabel(elapsedTicks)),
      elapsedTicks,
    };
  }
  if (house.hasWater && !houseHasFood(house) && state.tick > (house.starvationGraceUntilTick ?? 0)) {
    return { kind: "growth_blocked", label: HOUSE_DIAGNOSIS_COPY.growthBlockedFood };
  }
  return house.hasWater
    ? { kind: "stable", label: HOUSE_DIAGNOSIS_COPY.stable }
    : { kind: "growth_blocked", label: HOUSE_DIAGNOSIS_COPY.growthBlockedWater };
}

function protectionDiagnosis(state: GameState, home: Building): ProtectionDiagnosis {
  const protection = palisadeProtectionForBuilding(home, state.palisade);
  switch (protection) {
    case "inactive":
      return { kind: "inactive", label: HOUSE_DIAGNOSIS_COPY.wallInactive, amenityBonus: 0 };
    case "inside":
      return { kind: "inside", label: HOUSE_DIAGNOSIS_COPY.wallInside, amenityBonus: 2 };
    case "outside":
      return { kind: "outside", label: HOUSE_DIAGNOSIS_COPY.wallOutside, amenityBonus: 0 };
  }
}

function hasFreshBread(_state: GameState, house: House): boolean {
  return houseHasFood(house);
}

function stoneHouseDiagnosis(
  state: GameState,
  house: House,
  home: Building,
): StoneHouseDiagnosis {
  const blockers: string[] = [];
  if (serviceDiagnosis(state, home, "water").kind !== "served") blockers.push(servingWaterDiagnosis(state, home).label);
  if (!hasFreshBread(state, house)) blockers.push(HOUSE_DIAGNOSIS_COPY.freshBreadNeeded);
  const market = serviceDiagnosis(state, home, "market");
  const church = serviceDiagnosis(state, home, "church");
  if (market.kind !== "served") blockers.push(market.label);
  if (church.kind !== "served") blockers.push(church.label);
  if (palisadeProtectionForBuilding(home, state.palisade) !== "inside") {
    blockers.push(HOUSE_DIAGNOSIS_COPY.insideWallNeeded);
  }
  return blockers.length === 0
    ? { kind: "ready", label: HOUSE_DIAGNOSIS_COPY.stoneHouseReady, blockers: [] }
    : {
        kind: "blocked",
        label: HOUSE_DIAGNOSIS_COPY.stoneHouseBlocked(blockers.join(" · ")),
        blockers,
      };
}

function connectedToBreadGranary(
  state: GameState,
  home: Building,
  granaries: readonly Building[],
): boolean {
  const houseRoads = buildingRoadAccessTiles(state, home);
  const component = existingRoadComponent(state, houseRoads);
  const componentKeys = new Set(component.map(coordinateKey));
  return granaries.some((granary) =>
    buildingRoadAccessTiles(state, granary).some((road) => componentKeys.has(coordinateKey(road))),
  );
}

function servingBreadDiagnosis(
  state: GameState,
  house: House,
  home: Building,
  history: DistributorRouteHistory | null,
): BreadDiagnosis {
  if (house.breadStock > 0) return { kind: "supplied", label: HOUSE_DIAGNOSIS_COPY.breadSupplied };
  const granaries = state.buildings.filter((building) => building.kind === "granary");
  if (granaries.length === 0) return { kind: "no_granary", label: HOUSE_DIAGNOSIS_COPY.noGranary };
  const stockedGranaries = granaries.filter((granary) => (granary.inventory.bread ?? 0) > 0);
  if (stockedGranaries.length === 0) {
    return { kind: "granary_empty", label: HOUSE_DIAGNOSIS_COPY.granaryEmpty };
  }
  if (!connectedToBreadGranary(state, home, stockedGranaries)) {
    return { kind: "road_disconnected", label: HOUSE_DIAGNOSIS_COPY.roadDisconnected };
  }
  const route = missedHouseRouteReason({
    state,
    home,
    history,
    granaryIds: new Set(stockedGranaries.map((granary) => granary.id)),
  });
  if (route !== null) {
    return {
      kind: "not_visited",
      route,
      label: route.label,
    };
  }
  return {
    kind: "not_visited",
    label: HOUSE_DIAGNOSIS_COPY.noDistributorRecord,
    route: null,
  };
}

export function houseDiagnosisModel(
  state: GameState,
  houseId: string,
  history: DistributorRouteHistory | null = null,
): HouseDiagnosisModel | null {
  const house = state.houses.find((candidate) => candidate.buildingId === houseId);
  const home = state.buildings.find((candidate) => candidate.id === houseId);
  if (house === undefined || home === undefined || home.kind !== "house") return null;
  const level = Math.max(0, Math.min(HOUSE_NAMES.length - 1, house.level));
  const builtLevel = houseBuiltLevel(house);
  const condition = houseCondition(house);
  const footprint = buildingFootprint(home);
  const compoundAsset = houseCompoundAssetManifest.find((asset) => asset.level === builtLevel && asset.axis === home.houseLot);
  const thumbnailUrl = home.houseLot === undefined ? historicalHouseAssetMeta(builtLevel)?.url ?? null
    : compoundAsset === undefined ? null : assetUrlForBase(compoundAsset.url, import.meta.env?.BASE_URL ?? "/");
  return {
    buildingId: house.buildingId,
    thumbnailUrl,
    name: `${HOUSE_NAMES[builtLevel] ?? HOUSE_NAMES[0]}${home.houseLot === undefined ? "" : HOUSE_DIAGNOSIS_COPY.mergedHouseSuffix}`,
    capacity: (HOUSING_CONFIG.find((definition) => definition.level === level)?.capacity ?? HOUSING_CONFIG[0].capacity) * houseLotArea(home),
    footprintLabel: `${footprint.width}×${footprint.height}`,
    mergeOptions: houseMergeOptions(state, houseId),
    mergeStatus: houseMergeStatus(state, houseId),
    level,
    builtLevel,
    condition,
    conditionLabel: houseConditionLabel(condition),
    residents: house.residents,
    water: servingWaterDiagnosis(state, home),
    bread: servingBreadDiagnosis(state, house, home, history),
    population: populationDiagnosis(state, house),
    protection: protectionDiagnosis(state, home),
    market: servingMarketDiagnosis(state, home),
    church: serviceDiagnosis(state, home, "church"),
    stoneHouse: stoneHouseDiagnosis(state, house, home),
    pressure: housePressureLine(house),
  };
}

function housePressureLine(house: House): string | null {
  const status = housePressureStatus(house);
  const cause = housePressureCauseLabel(house);
  if (status === "settled" || cause === null) return null;
  return status === "leaving" ? cause : HOUSE_PRESSURE_COPY.abandoned;
}
