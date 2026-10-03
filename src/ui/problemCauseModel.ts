import { MONEY_RULE_COPY } from '../content/moneyCopy.ko';
import { HOUSEHOLD_LABOUR_COPY } from "./householdLabourCopy.ko";
import { PLAGUE_UI_COPY } from "./plagueUiCopy.ko";
import { outstandingArrears } from '../engine/moneyRules';
import { BUILDING_OPERATION_COPY } from './buildingOperationCopy.ko';
import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import { STORABLE_RESOURCE_TYPES, type ResourceType } from "../content/resourceConfig";
import { resourceEntry } from "../content/resourceCatalog";
import { buildingRoadAccessTiles } from "../engine/routing";
import type { GameState } from "../engine/engine.types";
import { buildingHasRequiredRoadAccess, ROAD_ACCESS_MARKER } from "../engine/roadAccess";
import { productionOperation } from "../economy/production";
import { acceptsResource, availableSpace, storageCapacityBlock, storageIntakeSpace } from "../economy/storage";
import { existingRoadComponent } from "../world/roadGraph";
import { farmsteadCause } from "../zones/arableStrips";
import { ARABLE_CAUSE_LABELS, FARMSTEAD_COPY } from "../zones/arableCopy.ko";
import { resourceName } from "../content/resourceCatalog.ko";
import { PROBLEM_CAUSE_COPY } from "./problemCauseCopy.ko";

/** The store a good waits for: its granary or storehouse (money has none; its causes name the storehouse). */
const storeLabelOf = (resource: ResourceType): string =>
  BUILDING_CONFIG_BY_KIND[resourceEntry(resource).storage === "granary" ? "granary" : "storehouse"].name;

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
  const storageLabel = storeLabelOf(resource);
  const destinations = state.buildings.filter((candidate) =>
    candidate.id !== target.id && acceptsResource(candidate.kind, resource),
  );
  if (destinations.length === 0) return PROBLEM_CAUSE_COPY.noStore(storageLabel);
  const storable = STORABLE_RESOURCE_TYPES.find((candidate) => candidate === resource);
  const blocked = storable === undefined ? null : storageCapacityBlock(destinations, storable);
  if (blocked !== null) return PROBLEM_CAUSE_COPY.storeFull(storageLabel, blocked.used, blocked.capacity);
  const available = destinations.filter((candidate) =>
    storable !== undefined && storageIntakeSpace(candidate, storable,
      availableSpace(candidate, BUILDING_CONFIG_BY_KIND[candidate.kind])) > 0,
  );
  if (!available.some((candidate) => isRoadConnected(state, target, candidate))) {
    return PROBLEM_CAUSE_COPY.noRoute(storageLabel, resourceName(resource));
  }
  return PROBLEM_CAUSE_COPY.waiting(storageLabel);
}

export function buildingProblemCause(state: GameState, buildingId: string): string | null {
  const building = state.buildings.find((candidate) => candidate.id === buildingId);
  if (building === undefined) return null;
  if (building.upkeepUnpaid === true) return MONEY_RULE_COPY.upkeepUnpaidDetail(outstandingArrears(state).byFacility.get(building.id) ?? 0);
  // UI-8: church or chapel whose priest died during the plague gets a dedicated inspector reason (PL-6).
  if ((building.kind === "church" || building.kind === "chapel") && (building as { curacyVacant?: boolean }).curacyVacant === true) return PLAGUE_UI_COPY.curacyVacant;
  if (building.operationPaused === true) return BUILDING_OPERATION_COPY.paused;
  const definition = BUILDING_CONFIG_BY_KIND[building.kind];
  if (building.kind === "farmstead") {
    if (!buildingHasRequiredRoadAccess(state, building)) return ROAD_ACCESS_MARKER;
    const cause = farmsteadCause(state, building.id);
    return cause === null ? null : cause === "no_field" ? FARMSTEAD_COPY.noField : ARABLE_CAUSE_LABELS[cause];
  }
  const production = definition.production;
  if (production === null) return null;

  const operation = productionOperation(building, definition, buildingHasRequiredRoadAccess(state, building));
  if (operation === "no_road") {
    return ROAD_ACCESS_MARKER;
  }

  if (operation === "understaffed") {
    return state.idleWorkers > 0
      ? HOUSEHOLD_LABOUR_COPY.assignableWorkersRoad(state.idleWorkers)
      : "가용 일꾼이 없습니다";
  }

  if (
    operation === "no_input" && production.input !== null
  ) {
    const inputResource = production.input;
    const label = resourceName(inputResource);
    const storageLabel = storeLabelOf(inputResource);
    const anySupply = state.buildings.some(
      (candidate) => (candidate.inventory[inputResource] ?? 0) > 0,
    );
    if (!anySupply) return `${storageLabel}에 ${label} 재고가 없습니다`;
    return hasConnectedSupply(state, building, inputResource)
      ? `${storageLabel}에서 ${label} 운반을 기다리는 중`
      : `${storageLabel}까지 경로가 없습니다 — ${label} 공급 불가`;
  }

  if (operation === "output_full") return outputDestinationCause(state, building, production.output);
  const outputResource = STORABLE_RESOURCE_TYPES.find((candidate) => candidate === production.output);
  if (outputResource !== undefined && (building.inventory[outputResource] ?? 0) > 0) {
    const blocked = storageCapacityBlock(state.buildings.filter((candidate) => candidate.id !== building.id), outputResource);
    if (blocked !== null) return `${storeLabelOf(outputResource)} 가득 참 (${blocked.used}/${blocked.capacity})`;
  }
  return null;
}
