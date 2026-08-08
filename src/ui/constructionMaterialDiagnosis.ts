import type { CarterWalker, TilePos, Walker } from "../agents/walker.types";
import { BALANCE } from "../content/balanceConfig";
import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import { RESOURCE_TYPES, type ResourceType } from "../content/resourceConfig";
import {
  constructionSiteAnchor,
  type ConstructionSite,
} from "../economy/construction";

const RESOURCE_LABELS = {
  wheat: "밀",
  bread: "빵",
  logs: "통나무",
  timber: "목재",
  stone_raw: "원석",
  stone: "석재",
  coin: "금화",
} as const satisfies Record<ResourceType, string>;

export type ConstructionMaterialDiagnosisState = Readonly<{
  buildings: readonly Building[];
  walkers: readonly Walker[];
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
  const vertical = dy < 0 ? "북" : dy > 0 ? "남" : "";
  const horizontal = dx < 0 ? "서" : dx > 0 ? "동" : "";
  const label = `${vertical}${horizontal}`;
  return label === "" ? "같은 위치" : `${label}쪽`;
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
        label: "영주 비축",
        directionLabel: directionLabel(anchor, home),
        distance: distance(anchor, home),
      };
    }
  }
}

function fallbackLabel(site: ConstructionSite, progress: MaterialProgress): string {
  const prefix = `${RESOURCE_LABELS[progress.resource]} ${progress.delivered}/${progress.required}`;
  switch (site.stall) {
    case "no_material_source":
      return `${prefix} · 공급처 없음 · ETA 확인 불가`;
    case "no_route":
      return `${prefix} · 공급처까지 도로 없음 · ETA 확인 불가`;
    case "awaiting_materials":
    case "none":
    case "no_builders":
      return `${prefix} · 예약 ${progress.reserved} · 배정된 운반인 없음 · ETA 확인 불가`;
  }
}

function carrierLabel(
  progress: MaterialProgress,
  carrier: CarterWalker,
  facts: SourceFacts | null,
  remainingPathDistance: number,
): string {
  const prefix = `${RESOURCE_LABELS[progress.resource]} ${progress.delivered}/${progress.required} · 예약 ${progress.reserved}`;
  const etaTicks = Math.ceil(remainingPathDistance / BALANCE.CARTER_SPEED);
  const source = facts === null
    ? "공급처 확인 불가"
    : `${facts.label} ${facts.directionLabel} ${facts.distance}칸`;
  return `${prefix} · ${source} · 운반 ${carrier.id} · 남은 길 ${remainingPathDistance}칸 · 예상 ${etaTicks}틱`;
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
    return {
      ...progress,
      label: carrierLabel(progress, carrier, facts, remaining),
      sourceLabel: facts?.label ?? null,
      sourceDirectionLabel: facts?.directionLabel ?? null,
      sourceDistance: facts?.distance ?? null,
      carrierId: carrier.id,
      remainingPathDistance: remaining,
      etaTicks: Math.ceil(remaining / BALANCE.CARTER_SPEED),
    };
  });
}
