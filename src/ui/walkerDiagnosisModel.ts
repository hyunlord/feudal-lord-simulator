import type {
  CarterCancellationReason,
  CarterDestination,
  CarterWalker,
  TilePos,
  Walker,
} from "../agents/walker.types";
import { BALANCE } from "../content/balanceConfig";
import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import { constructionSiteAnchor, constructionSiteDisplayName } from "../economy/construction";
import { remainingCarterTravelCost } from '../agents/carterTravelCost';
import { getTile } from '../world/grid';
import { stoneReplacementSiteId } from '../engine/era';
import { resourceName } from "../content/resourceCatalog.ko";
import { WALKER_DIAGNOSIS_COPY } from "./walkerDiagnosisCopy.ko";

export type WalkerDiagnosisModel = {
  readonly walkerId: string;
  readonly roleLabel: typeof WALKER_DIAGNOSIS_COPY.carterRole | typeof WALKER_DIAGNOSIS_COPY.distributorRole;
  readonly cargoLabel: string;
  readonly sourceLabel: string;
  readonly sourceDirectionLabel: string | null;
  readonly sourceDistance: number | null;
  readonly destinationLabel: string;
  readonly statusLabel: string;
  readonly remainingDistance: number;
  readonly etaTicks: number;
  readonly housesPassed: number;
  readonly tilesTravelled: number | null;
  readonly cancellationLabel: string | null;
};

function assertNever(value: never): never {
  throw new Error(`Unhandled diagnostic variant: ${JSON.stringify(value)}`);
}

export function carterCancellationLabel(reason: CarterCancellationReason): string {
  switch (reason) {
    case "destination_unavailable":
      return WALKER_DIAGNOSIS_COPY.destinationUnavailable;
    case "manual":
      return WALKER_DIAGNOSIS_COPY.manualCancel;
    case "road_removed":
      return WALKER_DIAGNOSIS_COPY.roadRemoved;
    case "source_unavailable":
      return WALKER_DIAGNOSIS_COPY.sourceUnavailable;
    default:
      return assertNever(reason);
  }
}

function distance(left: TilePos, right: TilePos): number {
  return Math.abs(left.tx - right.tx) + Math.abs(left.ty - right.ty);
}

function directionLabel(from: TilePos, to: TilePos): string {
  const dx = to.tx - from.tx;
  const dy = to.ty - from.ty;
  const vertical = dy < 0 ? WALKER_DIAGNOSIS_COPY.north : dy > 0 ? WALKER_DIAGNOSIS_COPY.south : "";
  const horizontal = dx < 0 ? WALKER_DIAGNOSIS_COPY.west : dx > 0 ? WALKER_DIAGNOSIS_COPY.east : "";
  const label = `${vertical}${horizontal}`;
  return label === "" ? WALKER_DIAGNOSIS_COPY.samePosition : WALKER_DIAGNOSIS_COPY.directionSide(label);
}

function remainingPathDistance(walker: Walker): number {
  if (walker.kind === "builder") return 0;
  const next = walker.path[walker.pathIndex + 1];
  if (next === undefined) return 0;
  let total = distance(walker.position, next);
  for (let index = walker.pathIndex + 1; index < walker.path.length - 1; index += 1) {
    const start = walker.path[index];
    const end = walker.path[index + 1];
    if (start !== undefined && end !== undefined) total += distance(start, end);
  }
  return total;
}

function buildingLabel(state: GameState, buildingId: string): string {
  const building = state.buildings.find((candidate) => candidate.id === buildingId);
  return building === undefined ? buildingId : BUILDING_CONFIG_BY_KIND[building.kind].name;
}

function buildingPosition(state: GameState, buildingId: string): TilePos | null {
  const building = state.buildings.find((candidate) => candidate.id === buildingId);
  return building === undefined ? null : { tx: building.tx, ty: building.ty };
}

/**
 * INSTALL-23: a construction site is named by its building (or the wall segment) and where it lies from the carter
 * (the card showed the site's id); a site already gone is "공사장".
 */
function destinationLabel(state: GameState, destination: CarterDestination, from: TilePos): string {
  switch (destination.kind) {
    case "building":
      return buildingLabel(state, destination.buildingId);
    case "construction_site": {
      const site = state.constructionSites.find((candidate) => candidate.id === destination.siteId);
      if (site === undefined) return WALKER_DIAGNOSIS_COPY.siteGone;
      const at = constructionSiteAnchor(site);
      const here = { tx: Math.round(from.tx), ty: Math.round(from.ty) };
      const name = constructionSiteDisplayName(site);
      return distance(here, at) === 0 ? WALKER_DIAGNOSIS_COPY.site(name) : WALKER_DIAGNOSIS_COPY.sitePlace(name, directionLabel(here, at), distance(here, at));
    }
    default:
      return assertNever(destination);
  }
}

function destinationPosition(state: GameState, destination: CarterDestination): TilePos | null {
  switch (destination.kind) {
    case "building":
      return buildingPosition(state, destination.buildingId);
    case "construction_site": {
      const site = state.constructionSites.find((candidate) => candidate.id === destination.siteId);
      return site === undefined ? null : constructionSiteAnchor(site);
    }
    default:
      return assertNever(destination);
  }
}

function cargoLabel(walker: Walker): string {
  if (walker.kind === "builder") return WALKER_DIAGNOSIS_COPY.noCargo;
  if (walker.cargo === null) return WALKER_DIAGNOSIS_COPY.noCargo;
  return `${resourceName(walker.cargo.resource)} ${walker.cargo.amount}`;
}

function carterStatus(walker: CarterWalker): string {
  if (walker.cancellation !== null) return WALKER_DIAGNOSIS_COPY.deliveryCancelled;
  switch (walker.phase) {
    case "outbound":
      return walker.mission === "deliver" ? WALKER_DIAGNOSIS_COPY.delivering : WALKER_DIAGNOSIS_COPY.goingToCollect;
    case "returning":
      return WALKER_DIAGNOSIS_COPY.returningToSource;
    default:
      return assertNever(walker.phase);
  }
}

function adjacentHouseCount(state: GameState, walker: Walker): number {
  if (walker.kind === "builder") return 0;
  const adjacent = state.houses.filter((house) => {
    const building = state.buildings.find((candidate) => candidate.id === house.buildingId);
    return building !== undefined && walker.path.some((tile) => distance(building, tile) <= 1);
  });
  return adjacent.length;
}

function carterDiagnosis(
  state: GameState,
  walker: CarterWalker,
  remainingDistance: number,
): WalkerDiagnosisModel {
  const wallSiteId = walker.destination.kind === 'construction_site' ? walker.destination.siteId : null;
  const constructionSite = wallSiteId === null
    ? undefined : state.constructionSites.find(site => site.id === wallSiteId);
  const wallDelivery = constructionSite?.kind === 'palisade_segment' || constructionSite?.kind === 'stone_wall_segment'
    || (wallSiteId !== null && state.palisade?.segments.some(segment =>
      segment.id === wallSiteId
      || segment.constructionSiteId === wallSiteId
      || segment.replacementConstructionSiteId === wallSiteId
      || stoneReplacementSiteId(segment.id) === wallSiteId) === true);
  const travelCost = wallDelivery
    ? remainingCarterTravelCost(walker, tile => getTile(state, tile)?.hasRoad === true)
    : remainingDistance;
  const sourceLabel = walker.mission === "deliver"
    ? buildingLabel(state, walker.homeBuildingId)
    : destinationLabel(state, walker.destination, walker.position);
  const destination = walker.mission === "deliver"
    ? destinationLabel(state, walker.destination, walker.position)
    : buildingLabel(state, walker.homeBuildingId);
  const sourcePosition = walker.mission === "deliver"
    ? buildingPosition(state, walker.homeBuildingId)
    : destinationPosition(state, walker.destination);
  const targetPosition = walker.mission === "deliver"
    ? destinationPosition(state, walker.destination)
    : buildingPosition(state, walker.homeBuildingId);
  const sourceDirectionLabel = sourcePosition === null || targetPosition === null
    ? null
    : directionLabel(targetPosition, sourcePosition);
  const sourceDistance = sourcePosition === null || targetPosition === null
    ? null
    : distance(targetPosition, sourcePosition);
  return {
    walkerId: walker.id,
    roleLabel: WALKER_DIAGNOSIS_COPY.carterRole,
    cargoLabel: cargoLabel(walker),
    sourceLabel,
    sourceDirectionLabel,
    sourceDistance,
    destinationLabel: destination,
    statusLabel: carterStatus(walker),
    remainingDistance,
    etaTicks: Math.ceil(travelCost / BALANCE.CARTER_SPEED),
    housesPassed: adjacentHouseCount(state, walker),
    tilesTravelled: null,
    cancellationLabel: walker.cancellation === null
      ? null
      : carterCancellationLabel(walker.cancellation.reason),
  };
}

export function walkerDiagnosisModel(
  state: GameState,
  walkerId: string,
): WalkerDiagnosisModel | null {
  const walker = state.walkers.find((candidate) => candidate.id === walkerId);
  if (walker === undefined) return null;
  const remainingDistance = remainingPathDistance(walker);
  switch (walker.kind) {
    case "builder":
      return null;
    case "carter":
      return carterDiagnosis(state, walker, remainingDistance);
    case "distributor":
      return {
        walkerId: walker.id,
        roleLabel: WALKER_DIAGNOSIS_COPY.distributorRole,
        cargoLabel: cargoLabel(walker),
        sourceLabel: buildingLabel(state, walker.homeBuildingId),
        sourceDirectionLabel: null,
        sourceDistance: null,
        destinationLabel: walker.phase === "returning" ? WALKER_DIAGNOSIS_COPY.homeGranary : WALKER_DIAGNOSIS_COPY.roadRound,
        statusLabel: walker.phase === "returning" ? WALKER_DIAGNOSIS_COPY.returningToGranary : WALKER_DIAGNOSIS_COPY.distributing,
        remainingDistance,
        etaTicks: Math.ceil(remainingDistance / BALANCE.DISTRIBUTOR_SPEED),
        housesPassed: adjacentHouseCount(state, walker),
        tilesTravelled: walker.tilesTravelled,
        cancellationLabel: null,
      };
    default:
      return assertNever(walker);
  }
}
