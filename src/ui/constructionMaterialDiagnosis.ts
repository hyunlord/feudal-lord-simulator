import { durationLabel } from "./gameTimeCopy.ko";
import type { CarterWalker, TilePos, Walker } from "../agents/walker.types";
import { BALANCE } from "../content/balanceConfig";
import { remainingCarterTravelCost } from '../agents/carterTravelCost';
import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import { RESOURCE_TYPES, type ResourceType } from "../content/resourceConfig";
import {
  constructionSiteAnchor,
  type ConstructionSite,
} from "../economy/construction";
import { resourceName } from "../content/resourceCatalog.ko";
import { CONSTRUCTION_MATERIAL_DIAGNOSIS_COPY } from "./constructionMaterialDiagnosisCopy.ko";

export type ConstructionMaterialDiagnosisState = Readonly<{
  buildings: readonly Building[];
  walkers: readonly Walker[];
  isRoad?: (tile: TilePos) => boolean;
}>;

export type ConstructionMaterialDiagnosis = Readonly<{
  resource: ResourceType;
  label: string;
  delivered: number;
  required: number;
  reserved: number;
  sourceLabel: string | null;
  sourceDirectionLabel: string | null;
  sourceDistance: number | null;
  carrierId: string | null;
  remainingPathDistance: number | null;
  etaTicks: number | null;
}>;

type MaterialProgress = Readonly<{
  resource: ResourceType;
  delivered: number;
  required: number;
  reserved: number;
}>;

type SourceFacts = Readonly<{
  label: string;
  directionLabel: string;
  distance: number;
}>;

function amount(record: Partial<Record<ResourceType, number>>, resource: ResourceType): number {
  return record[resource] ?? 0;
}

function distance(left: TilePos, right: TilePos): number {
  return Math.abs(left.tx - right.tx) + Math.abs(left.ty - right.ty);
}

function directionLabel(from: TilePos, to: TilePos): string {
  const dx = to.tx - from.tx;
  const dy = to.ty - from.ty;
  const vertical = dy < 0 ? CONSTRUCTION_MATERIAL_DIAGNOSIS_COPY.north : dy > 0 ? CONSTRUCTION_MATERIAL_DIAGNOSIS_COPY.south : "";
  const horizontal = dx < 0 ? CONSTRUCTION_MATERIAL_DIAGNOSIS_COPY.west : dx > 0 ? CONSTRUCTION_MATERIAL_DIAGNOSIS_COPY.east : "";
  const label = `${vertical}${horizontal}`;
  return label === "" ? CONSTRUCTION_MATERIAL_DIAGNOSIS_COPY.samePosition : CONSTRUCTION_MATERIAL_DIAGNOSIS_COPY.directionSide(label);
}

function remainingPathDistance(carrier: CarterWalker): number | null {
  if (carrier.path.length === 0 || carrier.pathIndex < 0) return null;
  const next = carrier.path[carrier.pathIndex + 1];
  if (next === undefined) return 0;
  let total = distance(carrier.position, next);
  for (let index = carrier.pathIndex + 1; index < carrier.path.length - 1; index += 1) {
    const current = carrier.path[index];
    const destination = carrier.path[index + 1];
    if (current === undefined || destination === undefined) return null;
    total += distance(current, destination);
  }
  return total;
}

function materialProgress(site: ConstructionSite): readonly MaterialProgress[] {
  return RESOURCE_TYPES.flatMap((resource) => {
    const required = amount(site.required, resource);
    const delivered = amount(site.delivered, resource);
    if (required === 0 || delivered >= required) return [];
    return [{
      resource,
      delivered,
      required,
      reserved: amount(site.reserved, resource),
    }];
  });
}

function activeCarrier(
  state: ConstructionMaterialDiagnosisState,
  site: ConstructionSite,
  resource: ResourceType,
): CarterWalker | null {
  return state.walkers
    .filter((walker): walker is CarterWalker =>
      walker.kind === "carter" &&
      walker.mission === "deliver" &&
      walker.phase === "outbound" &&
      walker.cancellation === null &&
      walker.reservation.resource === resource &&
      walker.reservation.destination.kind === "construction_site" &&
      walker.reservation.destination.siteId === site.id)
    .sort((left, right) => left.id.localeCompare(right.id))[0] ?? null;
}

function buildingLabel(building: Building): string {
  return BUILDING_CONFIG_BY_KIND[building.kind].name;
}

function sourceFacts(
  state: ConstructionMaterialDiagnosisState,
  site: ConstructionSite,
  carrier: CarterWalker,
): SourceFacts | null {
  const claim = carrier.reservation.sourceStockClaim;
  if (claim === null) return null;
  const anchor = constructionSiteAnchor(site);
  switch (claim.kind) {
    case "building": {
      const source = state.buildings.find((building) => building.id === claim.buildingId);
      if (source === undefined) return null;
      return {
        label: buildingLabel(source),
        directionLabel: directionLabel(anchor, source),
        distance: distance(anchor, source),
      };
    }
    case "treasury": {
      const home = state.buildings.find((building) => building.id === carrier.homeBuildingId);
      if (home === undefined) return null;
      return {
        label: CONSTRUCTION_MATERIAL_DIAGNOSIS_COPY.lordReserve,
        directionLabel: directionLabel(anchor, home),
        distance: distance(anchor, home),
      };
    }
  }
}

function fallbackLabel(site: ConstructionSite, progress: MaterialProgress): string {
  const prefix = `${resourceName(progress.resource)} ${progress.delivered}/${progress.required}`;
  switch (site.stall) {
    case "no_material_source":
      return CONSTRUCTION_MATERIAL_DIAGNOSIS_COPY.noSource(prefix);
    case "no_route":
      return CONSTRUCTION_MATERIAL_DIAGNOSIS_COPY.noRoute(prefix);
    case 'reserve_held':
      return CONSTRUCTION_MATERIAL_DIAGNOSIS_COPY.reserveHeld(prefix);
    case "awaiting_materials":
    case "none":
    case "no_builders":
      return CONSTRUCTION_MATERIAL_DIAGNOSIS_COPY.noCarrier(prefix, progress.reserved);
  }
}

function carrierLabel(
  progress: MaterialProgress,
  carrier: CarterWalker,
  facts: SourceFacts | null,
  remainingPathDistance: number,
  etaTicks: number,
): string {
  const prefix = CONSTRUCTION_MATERIAL_DIAGNOSIS_COPY.carrierPrefix(resourceName(progress.resource), progress.delivered, progress.required, progress.reserved);
  const source = facts === null
    ? CONSTRUCTION_MATERIAL_DIAGNOSIS_COPY.sourceUnknown
    : CONSTRUCTION_MATERIAL_DIAGNOSIS_COPY.source(facts.label, facts.directionLabel, facts.distance);
  return CONSTRUCTION_MATERIAL_DIAGNOSIS_COPY.carrier(prefix, source, carrier.id, remainingPathDistance, durationLabel(etaTicks));
}

export function constructionMaterialDiagnosis(
  site: ConstructionSite,
  state: ConstructionMaterialDiagnosisState,
): readonly ConstructionMaterialDiagnosis[] {
  return materialProgress(site).map((progress) => {
    const carrier = activeCarrier(state, site, progress.resource);
    if (carrier === null) {
      return {
        ...progress,
        label: fallbackLabel(site, progress),
        sourceLabel: null,
        sourceDirectionLabel: null,
        sourceDistance: null,
        carrierId: null,
        remainingPathDistance: null,
        etaTicks: null,
      };
    }
    const remaining = remainingPathDistance(carrier);
    if (remaining === null) {
      return {
        ...progress,
        label: fallbackLabel(site, progress),
        sourceLabel: null,
        sourceDirectionLabel: null,
        sourceDistance: null,
        carrierId: null,
        remainingPathDistance: null,
        etaTicks: null,
      };
    }
    const facts = sourceFacts(state, site, carrier);
    const weighted = (site.kind === 'palisade_segment' || site.kind === 'stone_wall_segment')
      && state.isRoad !== undefined
      ? remainingCarterTravelCost(carrier, state.isRoad) : remaining;
    const etaTicks = Math.ceil(weighted / BALANCE.CARTER_SPEED);
    return {
      ...progress,
      label: carrierLabel(progress, carrier, facts, remaining, etaTicks),
      sourceLabel: facts?.label ?? null,
      sourceDirectionLabel: facts?.directionLabel ?? null,
      sourceDistance: facts?.distance ?? null,
      carrierId: carrier.id,
      remainingPathDistance: remaining,
      etaTicks,
    };
  });
}
