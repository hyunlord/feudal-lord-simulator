import { createHash } from "node:crypto";

import type { Walker } from "../src/agents/walker.types";
import type { Building } from "../src/content/buildingConfig";
import { RESOURCE_TYPES, type ResourceType } from "../src/content/resourceConfig";
import type { ConstructionSite } from "../src/economy/construction";
import type { ForestHarvest, GameState, PalisadeSegment, PalisadeState } from "../src/engine/engine.types";
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
  const empty = { wheat: 0, bread: 0, logs: 0, timber: 0, stone_raw: 0, stone: 0, coin: 0 };
  return RESOURCE_TYPES.reduce<Record<ResourceType, number>>(
    (result, resource) => ({ ...result, [resource]: amount(record, resource) }),
    empty,
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
  const common = {
    id: site.id,
    kind: site.kind,
    required: sortedResources(site.required),
    delivered: sortedResources(site.delivered),
    reserved: sortedResources(site.reserved),
    builderTicks: site.builderTicks,
    requiredBuilderTicks: site.requiredBuilderTicks,
    assignedBuilders: site.assignedBuilders,
    stall: site.stall,
    startedTick: site.startedTick,
  };
  switch (site.kind) {
    case "palisade_segment":
    case "stone_wall_segment":
      return {
        ...common,
        wallId: site.wallId,
        segmentIndex: site.segmentIndex,
        gateDistance: site.gateDistance,
        order: site.order,
        path: site.path,
        anchor: site.anchor,
      };
    case "house":
    case "well":
    case "storehouse":
    case "granary":
    case "chapel":
    case "wheat_farm":
    case "mill":
    case "logging_camp":
    case "sawmill":
    case "quarry":
    case "masonry":
    case "market":
    case "church":
    case "keep":
      return {
        ...common,
        tx: site.tx,
        ty: site.ty,
      };
    default:
      return assertNever(site);
  }
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

function normalizePalisadeSegment(segment: PalisadeSegment) {
  return {
    id: segment.id,
    order: segment.order,
    edgePath: segment.edgePath,
    tileCount: segment.tileCount,
    completed: segment.completed,
    constructionSiteId: segment.constructionSiteId,
    gateDistance: segment.gateDistance ?? null,
    material: segment.material ?? "timber",
    replacementConstructionSiteId: segment.replacementConstructionSiteId ?? null,
  };
}

function normalizePalisade(palisade: PalisadeState | null) {
  return palisade === null
    ? null
    : {
        id: palisade.id,
        polygon: palisade.polygon,
        gate: palisade.gate,
        segments: [...palisade.segments]
          .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
          .map(normalizePalisadeSegment),
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

function normalizeForestHarvest(harvest: ForestHarvest) {
  return {
    tx: harvest.tx,
    ty: harvest.ty,
    harvestedAtTick: harvest.harvestedAtTick,
  };
}

export function hashEconomyState(state: GameState): string {
  const normalized = {
    tick: state.tick,
    wallTick: state.wallTick,
    era: state.era,
    eraProclaimedTick: state.eraProclaimedTick,
    palisade: normalizePalisade(state.palisade),
    nextConstructionOrdinal: state.nextConstructionOrdinal,
    population: state.population,
    idleWorkers: state.idleWorkers,
    treasuryTimber: state.treasuryTimber,
    treasuryCoin: state.treasuryCoin,
    buildings: [...state.buildings].sort((left, right) => left.id.localeCompare(right.id)).map(normalizeBuilding),
    constructionSites: [...state.constructionSites]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(normalizeConstructionSite),
    houses: [...state.houses].sort((left, right) => left.buildingId.localeCompare(right.buildingId)).map(normalizeHouse),
    walkers: [...state.walkers].sort((left, right) => left.id.localeCompare(right.id)).map(normalizeWalker),
    forestHarvests: [...(state.forestHarvests ?? [])]
      .sort((left, right) => left.harvestedAtTick - right.harvestedAtTick || left.ty - right.ty || left.tx - right.tx)
      .map(normalizeForestHarvest),
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex").slice(0, 16);
}

export function hashOpeningState(state: GameState): string {
  const normalized = {
    seed: state.seed,
    width: state.width,
    height: state.height,
    population: state.population,
    treasuryTimber: state.treasuryTimber,
    treasuryCoin: state.treasuryCoin,
    buildings: [...state.buildings]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(({ id, kind, tx, ty, workers }) => ({ id, kind, tx, ty, workers })),
    houses: [...state.houses]
      .sort((left, right) => left.buildingId.localeCompare(right.buildingId))
      .map(({ buildingId, level, residents, hasWater }) => ({
        buildingId,
        level,
        residents,
        hasWater,
      })),
    roads: state.tiles
      .filter((tile) => tile.hasRoad)
      .map(({ tx, ty }) => ({ tx, ty }))
      .sort((left, right) => left.ty - right.ty || left.tx - right.tx),
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex").slice(0, 16);
}
