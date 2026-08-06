import { createHash } from "node:crypto";

import type { Walker } from "../src/agents/walker.types";
import type { Building } from "../src/content/buildingConfig";
import { RESOURCE_TYPES, type ResourceType } from "../src/content/resourceConfig";
import type { ConstructionSite } from "../src/economy/construction";
import type { GameState } from "../src/engine/engine.types";
import type { House } from "../src/population/population.types";

function assertNever(value: never): never {
  throw new Error(`Unhandled harness variant: ${JSON.stringify(value)}`);
}

export function amount(
  record: Partial<Record<ResourceType, number>>,
  resource: ResourceType,
): number {
  return Math.max(0, record[resource] ?? 0);
}

export function sortedResources(
  record: Partial<Record<ResourceType, number>>,
): Record<ResourceType, number> {
  return RESOURCE_TYPES.reduce<Record<ResourceType, number>>(
    (result, resource) => ({ ...result, [resource]: amount(record, resource) }),
    { wheat: 0, bread: 0, logs: 0, timber: 0 },
  );
}

function normalizeBuilding(building: Building) {
  return {
    id: building.id,
    kind: building.kind,
    tx: building.tx,
    ty: building.ty,
    inventory: sortedResources(building.inventory),
    reserved: sortedResources(building.reserved),
    stockReserved: sortedResources(building.stockReserved),
    productionProgress: building.productionProgress,
    workers: building.workers,
  };
}

function normalizeConstructionSite(site: ConstructionSite) {
  return {
    id: site.id,
    kind: site.kind,
    tx: site.tx,
    ty: site.ty,
    required: sortedResources(site.required),
    delivered: sortedResources(site.delivered),
    reserved: sortedResources(site.reserved),
    builderTicks: site.builderTicks,
    requiredBuilderTicks: site.requiredBuilderTicks,
    assignedBuilders: site.assignedBuilders,
    stall: site.stall,
    startedTick: site.startedTick,
  };
}

function normalizeHouse(house: House) {
  return {
    buildingId: house.buildingId,
    level: house.level,
    residents: house.residents,
    hasWater: house.hasWater,
    breadStock: house.breadStock,
    lastServicedTick: house.lastServicedTick,
    unmetRequirementTicks: house.unmetRequirementTicks,
  };
}

function normalizeWalker(walker: Walker) {
  const common = {
    id: walker.id,
    kind: walker.kind,
    homeBuildingId: walker.homeBuildingId,
    position: walker.position,
    path: walker.path,
    pathIndex: walker.pathIndex,
    previousTile: walker.previousTile,
    cargo: walker.cargo,
    spawnedTick: walker.spawnedTick,
  };
  switch (walker.kind) {
    case "builder":
      return {
        ...common,
        siteId: walker.siteId,
        slotIndex: walker.slotIndex,
      };
    case "carter":
      return {
        ...common,
        mission: walker.mission,
        phase: walker.phase,
        destination: walker.destination,
        reservation: walker.reservation,
        cancellation: walker.cancellation,
      };
    case "distributor":
      return {
        ...common,
        phase: walker.phase,
        junctionVisits: walker.junctionVisits,
        tilesTravelled: walker.tilesTravelled,
        priorTile: walker.priorTile,
      };
    default:
      return assertNever(walker);
  }
}

export function hashEconomyState(state: GameState): string {
  const normalized = {
    tick: state.tick,
    wallTick: state.wallTick,
    nextConstructionOrdinal: state.nextConstructionOrdinal,
    population: state.population,
    idleWorkers: state.idleWorkers,
    treasuryTimber: state.treasuryTimber,
    buildings: [...state.buildings].sort((left, right) => left.id.localeCompare(right.id)).map(normalizeBuilding),
    constructionSites: [...state.constructionSites]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(normalizeConstructionSite),
    houses: [...state.houses].sort((left, right) => left.buildingId.localeCompare(right.buildingId)).map(normalizeHouse),
    walkers: [...state.walkers].sort((left, right) => left.id.localeCompare(right.id)).map(normalizeWalker),
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex").slice(0, 16);
}
