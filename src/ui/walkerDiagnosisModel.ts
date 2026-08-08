import type {
  CarterCancellationReason,
  CarterDestination,
  CarterWalker,
  TilePos,
  Walker,
} from "../agents/walker.types";
import { BALANCE } from "../content/balanceConfig";
import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import type { ResourceType } from "../content/resourceConfig";
import type { GameState } from "../engine/engine.types";
import { constructionSiteAnchor } from "../economy/construction";

export type WalkerDiagnosisModel = {
  readonly walkerId: string;
  readonly roleLabel: "운반인" | "배급자";
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

const RESOURCE_LABELS = {
  wheat: "밀",
  bread: "빵",
  logs: "통나무",
  timber: "목재",
  stone_raw: "원석",
  stone: "석재",
  coin: "금화",
} as const satisfies Record<ResourceType, string>;

function assertNever(value: never): never {
  throw new Error(`Unhandled diagnostic variant: ${JSON.stringify(value)}`);
}

export function carterCancellationLabel(reason: CarterCancellationReason): string {
  switch (reason) {
    case "destination_unavailable":
      return "목적지를 이용할 수 없음";
    case "manual":
      return "수동 취소";
    case "road_removed":
      return "도로가 끊김";
    case "source_unavailable":
      return "출발지 재고를 이용할 수 없음";
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
  const vertical = dy < 0 ? "북" : dy > 0 ? "남" : "";
  const horizontal = dx < 0 ? "서" : dx > 0 ? "동" : "";
  const label = `${vertical}${horizontal}`;
  return label === "" ? "같은 위치" : `${label}쪽`;
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

function destinationLabel(state: GameState, destination: CarterDestination): string {
  switch (destination.kind) {
    case "building":
      return buildingLabel(state, destination.buildingId);
    case "construction_site":
      return destination.siteId;
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
  if (walker.kind === "builder") return "화물 없음";
  if (walker.cargo === null) return "화물 없음";
  return `${RESOURCE_LABELS[walker.cargo.resource]} ${walker.cargo.amount}`;
}

function carterStatus(walker: CarterWalker): string {
  if (walker.cancellation !== null) return "배송 취소";
  switch (walker.phase) {
    case "outbound":
      return walker.mission === "deliver" ? "배송 중" : "수령하러 이동 중";
    case "returning":
      return "출발지로 귀환 중";
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
  const sourceLabel = walker.mission === "deliver"
    ? buildingLabel(state, walker.homeBuildingId)
    : destinationLabel(state, walker.destination);
  const destination = walker.mission === "deliver"
    ? destinationLabel(state, walker.destination)
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
    roleLabel: "운반인",
    cargoLabel: cargoLabel(walker),
    sourceLabel,
    sourceDirectionLabel,
    sourceDistance,
    destinationLabel: destination,
    statusLabel: carterStatus(walker),
    remainingDistance,
    etaTicks: Math.ceil(remainingDistance / BALANCE.CARTER_SPEED),
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
        roleLabel: "배급자",
        cargoLabel: cargoLabel(walker),
        sourceLabel: buildingLabel(state, walker.homeBuildingId),
        sourceDirectionLabel: null,
        sourceDistance: null,
        destinationLabel: walker.phase === "returning" ? "홈 곡창" : "도로 순회",
        statusLabel: walker.phase === "returning" ? "곡창으로 귀환 중" : "주택 배급 순회 중",
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
