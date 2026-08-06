import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import type { ResourceType } from "../content/resourceConfig";
import { buildingRoadAccessTiles } from "../engine/routing";
import type { GameState } from "../engine/engine.types";
import { acceptsResource, availableSpace } from "../economy/storage";
import { existingRoadComponent } from "../world/roadGraph";

const RESOURCE_LABELS = {
  wheat: "밀",
  bread: "빵",
  logs: "통나무",
  timber: "목재",
} as const satisfies Record<ResourceType, string>;

const STORAGE_LABELS = {
  wheat: "곡창",
  bread: "곡창",
  logs: "창고",
  timber: "창고",
} as const satisfies Record<ResourceType, "곡창" | "창고">;

function stockTotal(building: Building): number {
  return [...Object.values(building.inventory), ...Object.values(building.reserved)]
    .reduce((total, amount) => total + Math.max(0, amount ?? 0), 0);
}

function roadComponentKeys(state: GameState, target: Building): ReadonlySet<string> {
  return new Set(
    existingRoadComponent(state, buildingRoadAccessTiles(state, target))
      .map((coordinate) => `${coordinate.tx},${coordinate.ty}`),
  );
}

function isRoadConnected(
  state: GameState,
  target: Building,
  candidate: Building,
): boolean {
  const component = roadComponentKeys(state, target);
  return buildingRoadAccessTiles(state, candidate)
    .some((coordinate) => component.has(`${coordinate.tx},${coordinate.ty}`));
}

function hasConnectedSupply(
  state: GameState,
  target: Building,
  resource: ResourceType,
): boolean {
  return state.buildings.some((candidate) =>
    candidate.id !== target.id
    && (candidate.inventory[resource] ?? 0) > 0
    && isRoadConnected(state, target, candidate),
  );
}

function outputDestinationCause(
  state: GameState,
  target: Building,
  resource: ResourceType,
): string {
  const storageLabel = STORAGE_LABELS[resource];
  const destinations = state.buildings.filter((candidate) =>
    candidate.id !== target.id && acceptsResource(candidate.kind, resource),
  );
  if (destinations.length === 0) return `운반인이 가져갈 ${storageLabel}이 없습니다`;
  const available = destinations.filter((candidate) =>
    availableSpace(candidate, BUILDING_CONFIG_BY_KIND[candidate.kind]) > 0,
  );
  if (available.length === 0) return `모든 ${storageLabel}이 가득 찼습니다`;
  if (!available.some((candidate) => isRoadConnected(state, target, candidate))) {
    return `${storageLabel}까지 경로가 없습니다 — ${RESOURCE_LABELS[resource]} 운반 불가`;
  }
  return `운반인이 ${storageLabel}으로 옮기기를 기다리는 중`;
}

export function buildingProblemCause(state: GameState, buildingId: string): string | null {
  const building = state.buildings.find((candidate) => candidate.id === buildingId);
  if (building === undefined) return null;
  const definition = BUILDING_CONFIG_BY_KIND[building.kind];
  const production = definition.production;
  if (production === null) return null;

  if (building.workers < definition.workersRequired) {
    return state.idleWorkers > 0
      ? `유휴 일꾼 ${state.idleWorkers}명 — 도로 연결 확인`
      : "가용 일꾼이 없습니다";
  }

  if (
    production.input !== null
    && (building.inventory[production.input] ?? 0) < production.inputPerOutput
  ) {
    const inputResource = production.input;
    const label = RESOURCE_LABELS[inputResource];
    const storageLabel = STORAGE_LABELS[inputResource];
    const anySupply = state.buildings.some(
      (candidate) => (candidate.inventory[inputResource] ?? 0) > 0,
    );
    if (!anySupply) return `${storageLabel}에 ${label} 재고가 없습니다`;
    return hasConnectedSupply(state, building, inputResource)
      ? `${storageLabel}에서 ${label} 운반을 기다리는 중`
      : `${storageLabel}까지 경로가 없습니다 — ${label} 공급 불가`;
  }

  const releasedInput = production.input === null ? 0 : production.inputPerOutput;
  const outputBlocked = definition.storageCapacity - stockTotal(building) + releasedInput < 1
    && building.productionProgress >= production.ticksPerOutput;
  return outputBlocked ? outputDestinationCause(state, building, production.output) : null;
}
