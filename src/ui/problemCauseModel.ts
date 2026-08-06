import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import type { ResourceType } from "../content/resourceConfig";
import { buildingRoadAccessTiles } from "../engine/routing";
import type { GameState } from "../engine/engine.types";
import { existingRoadComponent } from "../world/roadGraph";

const RESOURCE_LABELS = {
  wheat: "밀",
  bread: "빵",
  logs: "통나무",
  timber: "목재",
} as const satisfies Record<ResourceType, string>;

function stockTotal(building: Building): number {
  return [...Object.values(building.inventory), ...Object.values(building.reserved)]
    .reduce((total, amount) => total + Math.max(0, amount ?? 0), 0);
}

function hasConnectedSupply(
  state: GameState,
  target: Building,
  resource: ResourceType,
): boolean {
  const component = new Set(
    existingRoadComponent(state, buildingRoadAccessTiles(state, target))
      .map((coordinate) => `${coordinate.tx},${coordinate.ty}`),
  );
  return state.buildings.some((building) =>
    building.id !== target.id
    && (building.inventory[resource] ?? 0) > 0
    && buildingRoadAccessTiles(state, building)
      .some((coordinate) => component.has(`${coordinate.tx},${coordinate.ty}`)),
  );
}

export function buildingProblemCause(state: GameState, buildingId: string): string | null {
  const building = state.buildings.find((candidate) => candidate.id === buildingId);
  if (building === undefined) return null;
  const definition = BUILDING_CONFIG_BY_KIND[building.kind];
  const production = definition.production;
  if (production === null) return null;

  if (building.workers < definition.workersRequired) {
    return state.idleWorkers > 0
      ? "일꾼이 있지만 이 건물까지 도로가 이어지지 않음"
      : "가용 일꾼이 없습니다";
  }

  if (
    production.input !== null
    && (building.inventory[production.input] ?? 0) < production.inputPerOutput
  ) {
    const inputResource = production.input;
    const label = RESOURCE_LABELS[inputResource];
    const anySupply = state.buildings.some(
      (candidate) => (candidate.inventory[inputResource] ?? 0) > 0,
    );
    if (!anySupply) return `필요한 ${label} 재고가 없습니다`;
    return hasConnectedSupply(state, building, inputResource)
      ? `${label} 운반을 기다리는 중`
      : `${label} 보관소와 도로가 이어지지 않음`;
  }

  const releasedInput = production.input === null ? 0 : production.inputPerOutput;
  const outputBlocked = definition.storageCapacity - stockTotal(building) + releasedInput < 1
    && building.productionProgress >= production.ticksPerOutput;
  return outputBlocked ? "생산품 저장 공간이 가득 찼습니다" : null;
}
