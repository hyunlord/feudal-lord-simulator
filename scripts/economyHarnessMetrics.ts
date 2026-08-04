import { createHash } from "node:crypto";

import type { CarterCancellation, Walker } from "../src/agents/walker.types";
import { BALANCE } from "../src/content/balanceConfig";
import { BUILDING_CONFIG_BY_KIND, type Building } from "../src/content/buildingConfig";
import type { ResourceType } from "../src/content/resourceConfig";
import type { GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import type { House } from "../src/population/population.types";

export interface HarnessMetric {
  readonly label: string;
  readonly value: string;
  readonly status: "PASS" | "FAIL";
}

export interface EconomyHarnessReport {
  readonly determinism: {
    readonly hashA: string;
    readonly hashB: string;
  };
  readonly metrics: readonly HarnessMetric[];
  readonly assumptions: readonly string[];
  readonly runtimeMs: number;
}

export interface RunEconomyHarnessInput {
  readonly scenario: GameState;
  readonly ticks: number;
  readonly warmupTicks: number;
}

interface RunTrace {
  readonly hash: string;
  readonly breadProduced: boolean;
  readonly foodRatios: readonly number[];
  readonly cancellationEvents: readonly CancellationEvent[];
  readonly maxLabourDeadlock: number;
  readonly levelChanges: Readonly<Record<string, readonly number[]>>;
}

interface CancellationEvent {
  readonly tick: number;
  readonly key: string;
}

const assumptions = [
  "Three houses start at 14 residents each, level 2, with one bread stock to avoid a cold-start hunger false failure.",
  "Two granaries start with 36 bread each so distributors can run before the first harvested wheat becomes bread.",
  "The 205-timber opening grant remains treasury and does not occupy building storage.",
  "No fake workers are injected after initialization; labour is recomputed from population each tick.",
  "Cargo thrashing counts non-manual cancellation states returned by advanceTick; no-road recovery remains observable for one tick before logical recovery.",
] as const;

function amount(record: Partial<Record<ResourceType, number>>, resource: ResourceType): number {
  return Math.max(0, record[resource] ?? 0);
}

function sortedResources(record: Partial<Record<ResourceType, number>>): Record<ResourceType, number> {
  return {
    wheat: amount(record, "wheat"),
    bread: amount(record, "bread"),
    logs: amount(record, "logs"),
    timber: amount(record, "timber"),
  };
}

function normalizeBuilding(building: Building) {
  return {
    id: building.id,
    kind: building.kind,
    inventory: sortedResources(building.inventory),
    reserved: sortedResources(building.reserved),
    stockReserved: sortedResources(building.stockReserved),
    productionProgress: building.productionProgress,
    workers: building.workers,
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
  return walker.kind === "carter"
    ? {
        ...common,
        mission: walker.mission,
        phase: walker.phase,
        destinationBuildingId: walker.destinationBuildingId,
        reservation: walker.reservation,
        cancellation: walker.cancellation,
      }
    : {
        ...common,
        phase: walker.phase,
        junctionVisits: walker.junctionVisits,
        tilesTravelled: walker.tilesTravelled,
        priorTile: walker.priorTile,
      };
}

export function hashEconomyState(state: GameState): string {
  const normalized = {
    tick: state.tick,
    population: state.population,
    idleWorkers: state.idleWorkers,
    buildings: [...state.buildings].sort((left, right) => left.id.localeCompare(right.id)).map(normalizeBuilding),
    houses: [...state.houses].sort((left, right) => left.buildingId.localeCompare(right.buildingId)).map(normalizeHouse),
    walkers: [...state.walkers].sort((left, right) => left.id.localeCompare(right.id)).map(normalizeWalker),
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex").slice(0, 16);
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

function rollingMax(values: readonly number[], window: number): number {
  let max = 0;
  let sum = 0;
  for (let index = 0; index < values.length; index += 1) {
    sum += values[index] ?? 0;
    if (index >= window) sum -= values[index - window] ?? 0;
    max = Math.max(max, sum);
  }
  return max;
}

function maxCancellations(events: readonly CancellationEvent[]): number {
  let max = 0;
  for (const event of events) {
    const count = events.filter((candidate) =>
      candidate.key === event.key &&
      candidate.tick >= event.tick &&
      candidate.tick < event.tick + 1200,
    ).length;
    max = Math.max(max, count);
  }
  return max;
}

function maxChangesInWindow(ticks: readonly number[], window: number): number {
  let max = 0;
  for (const tick of ticks) {
    const count = ticks.filter((candidate) => candidate >= tick && candidate < tick + window).length;
    max = Math.max(max, count);
  }
  return max;
}

function maxLevelChanges(changes: Readonly<Record<string, readonly number[]>>): number {
  return Object.values(changes).reduce((max, ticks) => Math.max(max, maxChangesInWindow(ticks, 2000)), 0);
}

function breadProductionCompleted(previous: GameState, next: GameState): boolean {
  for (const before of previous.buildings) {
    const definition = BUILDING_CONFIG_BY_KIND[before.kind];
    if (definition.production?.output !== "bread") continue;
    const after = next.buildings.find((building) => building.id === before.id);
    if (after === undefined) continue;
    if (
      before.productionProgress >= definition.production.ticksPerOutput - 1 &&
      after.productionProgress === 0
    ) {
      return true;
    }
  }
  return false;
}

function trackRun(initial: GameState, ticks: number, warmupTicks: number): RunTrace {
  let state = initial;
  let breadProduced = false;
  let deadlockStreak = 0;
  let maxLabourDeadlock = 0;
  const initialBread = totalBread(initial);
  const foodRatios: number[] = [];
  const events: CancellationEvent[] = [];
  const seenCancellations = new Set<string>();
  const lastLevels = new Map(initial.houses.map((house) => [house.buildingId, house.level]));
  const levelChanges: Record<string, number[]> = {};

  for (let step = 0; step < ticks; step += 1) {
    const previous = state;
    state = advanceTick(state);
    breadProduced = breadProduced || breadProductionCompleted(previous, state) || totalBread(state) > initialBread;
    if (state.tick > warmupTicks && breadProduced) foodRatios.push(starvingRatio(state));
    deadlockStreak = state.idleWorkers > 0 && state.buildings.some(productionUnderstaffed) ? deadlockStreak + 1 : 0;
    maxLabourDeadlock = Math.max(maxLabourDeadlock, deadlockStreak);
    for (const walker of state.walkers) {
      if (walker.kind !== "carter" || walker.cancellation === null) continue;
      if (seenCancellations.has(walker.id)) continue;
      const key = cancellationKey(walker, walker.cancellation);
      if (key !== null) events.push({ tick: state.tick, key });
      seenCancellations.add(walker.id);
    }
    for (const house of state.houses) {
      const previous = lastLevels.get(house.buildingId) ?? house.level;
      if (previous !== house.level) {
        levelChanges[house.buildingId] = [...(levelChanges[house.buildingId] ?? []), state.tick];
        lastLevels.set(house.buildingId, house.level);
      }
    }
  }

  return {
    hash: hashEconomyState(state),
    breadProduced,
    foodRatios,
    cancellationEvents: events,
    maxLabourDeadlock,
    levelChanges,
  };
}

function metric(label: string, value: string, passing: boolean): HarnessMetric {
  return { label, value, status: passing ? "PASS" : "FAIL" };
}

export function runEconomyHarness(input: RunEconomyHarnessInput): EconomyHarnessReport {
  const started = performance.now();
  const first = trackRun(input.scenario, input.ticks, input.warmupTicks);
  const second = trackRun(input.scenario, input.ticks, input.warmupTicks);
  const averageFood = first.foodRatios.reduce((total, ratio) => total + ratio, 0) / Math.max(1, first.foodRatios.length);
  const rollingFood = rollingMax(first.foodRatios, 1200) / 1200;
  const foodStability = Math.max(averageFood, rollingFood);
  const cancellationMax = maxCancellations(first.cancellationEvents);
  const oscillationMax = maxLevelChanges(first.levelChanges);
  return {
    determinism: { hashA: first.hash, hashB: second.hash },
    assumptions,
    runtimeMs: Math.round(performance.now() - started),
    metrics: [
      metric("Determinism hash", `${first.hash} == ${second.hash}`, first.hash === second.hash),
      metric(
        "Food stability",
        first.breadProduced ? `${Math.round(foodStability * 1000) / 10}% starving` : "no bread produced",
        first.breadProduced && averageFood <= 0.2 && rollingFood <= 0.2,
      ),
      metric("Cargo thrashing", `${cancellationMax} cancellations/1200`, cancellationMax < 5),
      metric("Labour deadlock", `${first.maxLabourDeadlock} consecutive ticks`, first.maxLabourDeadlock < 600),
      metric("Housing oscillation", `${oscillationMax} changes/2000`, oscillationMax < 4),
    ],
  };
}

export function formatEconomyHarnessReport(report: EconomyHarnessReport): string {
  const rows = [
    ["Metric", "Value", "Status"],
    ...report.metrics.map((metricRow) => [metricRow.label, metricRow.value, metricRow.status]),
  ];
  const metricWidth = Math.max(...rows.map((row) => row[0]?.length ?? 0)) + 2;
  const valueWidth = Math.max(...rows.map((row) => row[1]?.length ?? 0)) + 2;
  return rows
    .map((row) => `${(row[0] ?? "").padEnd(metricWidth)}${(row[1] ?? "").padEnd(valueWidth)}${row[2] ?? ""}`)
    .join("\n");
}
