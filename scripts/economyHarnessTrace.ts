import type { CarterCancellation, Walker } from "../src/agents/walker.types";
import { BALANCE } from "../src/content/balanceConfig";
import { BUILDING_CONFIG_BY_KIND, type Building } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { hashEconomyState, amount } from "./economyHarnessSerializer";
import { hasImpossibleConstructionCommitment } from "./economyHarnessLedger";

export interface RunTrace {
  readonly hash: string;
  readonly breadProduced: boolean;
  readonly foodRatios: readonly number[];
  readonly cancellationEvents: readonly CancellationEvent[];
  readonly maxLabourDeadlock: number;
  readonly levelChanges: Readonly<Record<string, readonly number[]>>;
  readonly maxStallDuration: number;
  readonly maxBuilderStarvation: number;
  readonly maxMaterialDeadlock: number;
  readonly completedConstruction: number;
  readonly requestedConstruction: number;
  readonly impossibleConstructionCommitment: boolean;
}

export interface CancellationEvent {
  readonly tick: number;
  readonly key: string;
}

function totalBread(state: GameState): number {
  const buildingBread = state.buildings.reduce((total, building) => total + amount(building.inventory, "bread"), 0);
  const cargoBread = state.walkers.reduce((total, walker) => total + (walker.cargo?.resource === "bread" ? walker.cargo.amount : 0), 0);
  return state.houses.reduce((total, house) => total + house.breadStock, buildingBread + cargoBread);
}

function starvingRatio(state: GameState): number {
  const starving = state.houses.filter((house) => state.tick - house.lastServicedTick > BALANCE.BREAD_HUNGER_WINDOW).length;
  return state.houses.length === 0 ? 0 : starving / state.houses.length;
}

function productionUnderstaffed(building: Building): boolean {
  const definition = BUILDING_CONFIG_BY_KIND[building.kind];
  return definition.production !== null && building.workers < definition.workersRequired;
}

function cancellationKey(walker: Walker, cancellation: CarterCancellation): string | null {
  if (walker.kind !== "carter") return null;
  if (cancellation.reason === "manual") return null;
  return `${walker.homeBuildingId}:${walker.reservation.resource}`;
}

function breadProductionCompleted(previous: GameState, next: GameState): boolean {
  for (const before of previous.buildings) {
    const definition = BUILDING_CONFIG_BY_KIND[before.kind];
    if (definition.production?.output !== "bread") continue;
    const after = next.buildings.find((building) => building.id === before.id);
    if (after === undefined) continue;
    if (before.productionProgress >= definition.production.ticksPerOutput - 1 && after.productionProgress === 0) return true;
  }
  return false;
}

function completedRequestedCount(initialIds: ReadonlySet<string>, state: GameState): number {
  return state.buildings.filter((building) => initialIds.has(building.id)).length;
}

function materialDeadlocked(state: GameState): boolean {
  return state.constructionSites.some((site) =>
    site.stall === "no_material_source" || site.stall === "no_route",
  );
}

function builderStarved(state: GameState): boolean {
  return state.constructionSites.some((site) =>
    site.stall === "no_builders" && site.assignedBuilders === 0,
  );
}

function stalled(state: GameState): boolean {
  return state.constructionSites.some((site) => site.stall !== "none");
}

export function trackRun(initial: GameState, ticks: number, warmupTicks: number): RunTrace {
  let state = initial;
  let breadProduced = false;
  let deadlockStreak = 0;
  let stallStreak = 0;
  let builderStarvationStreak = 0;
  let materialDeadlockStreak = 0;
  let maxLabourDeadlock = 0;
  let maxStallDuration = 0;
  let maxBuilderStarvation = 0;
  let maxMaterialDeadlock = 0;
  const initialBread = totalBread(initial);
  const requestedIds = new Set(initial.constructionSites.map((site) => site.id));
  const foodRatios: number[] = [];
  const events: CancellationEvent[] = [];
  const seenCancellations = new Set<string>();
  const lastLevels = new Map(initial.houses.map((house) => [house.buildingId, house.level]));
  const levelChanges: Record<string, number[]> = {};
  let impossibleConstructionCommitment = hasImpossibleConstructionCommitment(initial);

  for (let step = 0; step < ticks; step += 1) {
    const previous = state;
    state = advanceTick(state);
    breadProduced = breadProduced || breadProductionCompleted(previous, state) || totalBread(state) > initialBread;
    if (state.tick > warmupTicks && breadProduced) foodRatios.push(starvingRatio(state));
    deadlockStreak = state.idleWorkers > 0 && state.buildings.some(productionUnderstaffed) ? deadlockStreak + 1 : 0;
    stallStreak = stalled(state) ? stallStreak + 1 : 0;
    builderStarvationStreak = builderStarved(state) ? builderStarvationStreak + 1 : 0;
    materialDeadlockStreak = materialDeadlocked(state) ? materialDeadlockStreak + 1 : 0;
    maxLabourDeadlock = Math.max(maxLabourDeadlock, deadlockStreak);
    maxStallDuration = Math.max(maxStallDuration, stallStreak);
    maxBuilderStarvation = Math.max(maxBuilderStarvation, builderStarvationStreak);
    maxMaterialDeadlock = Math.max(maxMaterialDeadlock, materialDeadlockStreak);
    impossibleConstructionCommitment = impossibleConstructionCommitment || hasImpossibleConstructionCommitment(state);
    for (const walker of state.walkers) {
      if (walker.kind !== "carter" || walker.cancellation === null) continue;
      if (seenCancellations.has(walker.id)) continue;
      const key = cancellationKey(walker, walker.cancellation);
      if (key !== null) events.push({ tick: state.tick, key });
      seenCancellations.add(walker.id);
    }
    for (const house of state.houses) {
      const previousLevel = lastLevels.get(house.buildingId) ?? house.level;
      if (previousLevel === house.level) continue;
      levelChanges[house.buildingId] = [...(levelChanges[house.buildingId] ?? []), state.tick];
      lastLevels.set(house.buildingId, house.level);
    }
  }

  return {
    hash: hashEconomyState(state),
    breadProduced,
    foodRatios,
    cancellationEvents: events,
    maxLabourDeadlock,
    levelChanges,
    maxStallDuration,
    maxBuilderStarvation,
    maxMaterialDeadlock,
    completedConstruction: completedRequestedCount(requestedIds, state),
    requestedConstruction: requestedIds.size,
    impossibleConstructionCommitment,
  };
}
