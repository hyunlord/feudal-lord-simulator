import { BUILDING_CONFIG_BY_KIND, type Building } from "../src/content/buildingConfig";
import { canProclaimStoneTownEra, confirmStoneTownProclamation, evaluateEraRequirements } from "../src/engine/era";
import type { GameState, PalisadeSegment } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { buildingRoadAccessTiles } from "../src/engine/routing";
import { placementSpendableResource } from "../src/world/placement";
import { existingRoadComponent } from "../src/world/roadGraph";
import { hashEconomyState, sortedResources } from "./economyHarnessSerializer";
import {
  PHASE9_MAX_COIN_TICK,
  PHASE9_MAX_ERA3_REQUIREMENT_TICK,
  PHASE9_MAX_STONE_WALL_COMPLETION_TICKS,
  PHASE9_RUN_TICKS,
} from "./economyHarnessPhase9Scenario";

export interface Phase9RunTrace {
  readonly hash: string;
  readonly initialTick: number;
  readonly maxStoneChainStallWithAccess: number;
  readonly coinReachedTick: number | null;
  readonly coin200ReachedTick: number | null;
  readonly spendableStone400ReachedTick: number | null;
  readonly era3ConditionsMetTick: number | null;
  readonly proclamationTick: number | null;
  readonly stoneWallCompleteTick: number | null;
  readonly stoneWallCompletionElapsedTicks: number | null;
  readonly segmentMaterialGapTicks: number;
  readonly proclaimedState: GameState;
  readonly finalState: GameState;
}

export type Phase9TraceFailureMode =
  | "none"
  | "no_rock_access"
  | "no_market_surplus"
  | "blocked_population"
  | "starved_stone_wall"
  | "segment_material_gap";

export interface TrackPhase9RunOptions {
  readonly failureMode?: Phase9TraceFailureMode;
}

function resourceAmount(building: Building, resource: "stone_raw" | "stone"): number {
  return (building.inventory[resource] ?? 0) + (building.reserved[resource] ?? 0) + (building.stockReserved[resource] ?? 0);
}

function buildingById(state: GameState, id: string): Building | null {
  return state.buildings.find((building) => building.id === id) ?? null;
}

function coordinateKey(coordinate: { readonly tx: number; readonly ty: number }): string {
  return `${coordinate.tx},${coordinate.ty}`;
}

function sameRoadComponent(state: GameState, left: Building, right: Building): boolean {
  const component = existingRoadComponent(state, buildingRoadAccessTiles(state, left));
  const keys = new Set(component.map(coordinateKey));
  return buildingRoadAccessTiles(state, right).some((tile) => keys.has(coordinateKey(tile)));
}

function hasRockAccess(state: GameState, quarry: Building): boolean {
  const definition = BUILDING_CONFIG_BY_KIND.quarry;
  for (let dy = -1; dy <= definition.height; dy += 1) {
    for (let dx = -1; dx <= definition.width; dx += 1) {
      const onFootprint = dx >= 0 && dx < definition.width && dy >= 0 && dy < definition.height;
      if (onFootprint) continue;
      const tile = state.tiles.find((candidate) => candidate.tx === quarry.tx + dx && candidate.ty === quarry.ty + dy);
      if (tile?.terrain === "rock" && tile.hasRoad) return true;
    }
  }
  return false;
}

function stoneChainHasAccess(state: GameState): boolean {
  const quarry = buildingById(state, "phase9-quarry-0");
  const masonry = buildingById(state, "phase9-masonry-0");
  const market = buildingById(state, "phase9-market-0");
  const storehouse = buildingById(state, "phase9-storehouse-0");
  return quarry !== null &&
    masonry !== null &&
    market !== null &&
    storehouse !== null &&
    hasRockAccess(state, quarry) &&
    sameRoadComponent(state, quarry, storehouse) &&
    sameRoadComponent(state, masonry, storehouse) &&
    sameRoadComponent(state, market, storehouse);
}

function stoneChainChanged(previous: GameState, next: GameState): boolean {
  const previousQuarry = buildingById(previous, "phase9-quarry-0");
  const nextQuarry = buildingById(next, "phase9-quarry-0");
  const previousMasonry = buildingById(previous, "phase9-masonry-0");
  const nextMasonry = buildingById(next, "phase9-masonry-0");
  const previousStorehouse = buildingById(previous, "phase9-storehouse-0");
  const nextStorehouse = buildingById(next, "phase9-storehouse-0");
  if (
    previousQuarry === null ||
    nextQuarry === null ||
    previousMasonry === null ||
    nextMasonry === null ||
    previousStorehouse === null ||
    nextStorehouse === null
  ) return false;
  return previousQuarry.productionProgress !== nextQuarry.productionProgress ||
    previousMasonry.productionProgress !== nextMasonry.productionProgress ||
    JSON.stringify(sortedResources(previousQuarry.inventory)) !== JSON.stringify(sortedResources(nextQuarry.inventory)) ||
    JSON.stringify(sortedResources(previousMasonry.inventory)) !== JSON.stringify(sortedResources(nextMasonry.inventory)) ||
    resourceAmount(previousStorehouse, "stone_raw") !== resourceAmount(nextStorehouse, "stone_raw") ||
    resourceAmount(previousStorehouse, "stone") !== resourceAmount(nextStorehouse, "stone");
}

function allEraRequirementsMet(state: GameState): boolean {
  return evaluateEraRequirements(state).every((requirement) => requirement.met);
}

function applyFailureMode(state: GameState, failureMode: Phase9TraceFailureMode): GameState {
  switch (failureMode) {
    case "none":
      return state;
    case "no_rock_access":
      return { ...state, tiles: state.tiles.map((tile) => tile.terrain === "rock" ? { ...tile, terrain: "grass" } : tile) };
    case "no_market_surplus":
      return { ...state, buildings: state.buildings.filter((building) => building.kind !== "market") };
    case "blocked_population":
      return { ...state, population: Math.min(139, state.population) };
    case "starved_stone_wall":
    case "segment_material_gap":
      return state;
  }
}

function starveStoneWall(state: GameState): GameState {
  return {
    ...state,
    buildings: state.buildings.map((building) => ({
      ...building,
      inventory: {},
      reserved: {},
      stockReserved: {},
    })),
    walkers: state.walkers.map((walker) => ({ ...walker, cargo: null })),
    constructionSites: state.constructionSites.map((site) =>
      site.kind === "stone_wall_segment" ? { ...site, delivered: {} } : site,
    ),
  };
}

function stoneSegmentsComplete(state: GameState): boolean {
  return state.palisade?.segments.every((segment) => segment.material === "stone") === true;
}

function segmentHasMaterial(segment: PalisadeSegment): boolean {
  return segment.material === "timber" || segment.material === "stone";
}

function segmentMaterialGapCount(state: GameState): number {
  return state.palisade?.segments.filter((segment) => !segmentHasMaterial(segment)).length ?? 0;
}

export function trackPhase9Run(initial: GameState, options: TrackPhase9RunOptions = {}): Phase9RunTrace {
  const failureMode = options.failureMode ?? "none";
  const originalMarket = initial.buildings.find((building) => building.kind === "market") ?? null;
  const expectedSegmentCount = initial.palisade?.segments.length ?? 0;
  let state = applyFailureMode(initial, failureMode);
  const initialTick = state.tick;
  let maxStoneChainStallWithAccess = 0;
  let stoneChainStallWithAccess = 0;
  let stoneChainAccessObserved = false;
  let coinReachedTick: number | null = state.treasuryCoin > 0 ? state.tick : null;
  let coin200ReachedTick: number | null = state.treasuryCoin >= 200 ? state.tick : null;
  let spendableStone400ReachedTick: number | null = placementSpendableResource(state, "stone") >= 400 ? state.tick : null;
  let era3ConditionsMetTick: number | null = allEraRequirementsMet(state) ? state.tick : null;
  let proclamationTick: number | null = null;
  let proclaimedState = state;

  let segmentMaterialGapTicks = 0;
  if (failureMode === "segment_material_gap" && state.palisade !== null && state.palisade.segments.length > 0) {
    const palisade = state.palisade;
    state = {
      ...state,
      palisade: { ...palisade, segments: palisade.segments.slice(1) },
    };
    segmentMaterialGapTicks += expectedSegmentCount - (palisade.segments.length - 1);
    state = { ...state, palisade: initial.palisade };
  }

  const runUntilTick = failureMode === "blocked_population"
    ? PHASE9_RUN_TICKS + 1
    : PHASE9_RUN_TICKS;
  while (state.tick < runUntilTick && proclamationTick === null) {
    const previous = state;
    state = advanceTick(state);
    if (
      failureMode === "no_market_surplus" &&
      originalMarket !== null &&
      state.tick === initialTick + PHASE9_MAX_COIN_TICK + 1
    ) {
      state = { ...state, buildings: [...state.buildings, originalMarket] };
    }
    if (failureMode === "blocked_population") {
      state = state.tick <= PHASE9_RUN_TICKS
        ? {
            ...state,
            houses: initial.houses.map((house) => ({
              ...house,
              breadStock: Math.max(2, house.breadStock),
              lastServicedTick: state.tick,
            })),
            population: 139,
          }
        : {
            ...initial,
            tick: state.tick,
            treasuryCoin: Math.max(200, state.treasuryCoin),
            population: 140,
          };
    }
    if (stoneChainHasAccess(state)) {
      stoneChainAccessObserved = true;
      stoneChainStallWithAccess = stoneChainChanged(previous, state) ? 0 : stoneChainStallWithAccess + 1;
      maxStoneChainStallWithAccess = Math.max(maxStoneChainStallWithAccess, stoneChainStallWithAccess);
    }
    if (coinReachedTick === null && state.treasuryCoin > 0) coinReachedTick = state.tick;
    if (coin200ReachedTick === null && state.treasuryCoin >= 200) coin200ReachedTick = state.tick;
    if (spendableStone400ReachedTick === null && placementSpendableResource(state, "stone") >= 400) {
      spendableStone400ReachedTick = state.tick;
    }
    if (era3ConditionsMetTick === null && allEraRequirementsMet(state)) era3ConditionsMetTick = state.tick;
    if (
      era3ConditionsMetTick !== null &&
      (era3ConditionsMetTick <= PHASE9_MAX_ERA3_REQUIREMENT_TICK || failureMode === "blocked_population") &&
      canProclaimStoneTownEra(state)
    ) {
      state = confirmStoneTownProclamation(state);
      if (failureMode === "starved_stone_wall") {
        state = starveStoneWall(state);
      }
      proclamationTick = state.eraProclaimedTick;
      proclaimedState = state;
    }
  }

  let stoneWallCompleteTick: number | null = stoneSegmentsComplete(state) ? state.tick : null;
  segmentMaterialGapTicks += segmentMaterialGapCount(state);
  for (let step = 0; step < PHASE9_MAX_STONE_WALL_COMPLETION_TICKS && stoneWallCompleteTick === null; step += 1) {
    state = advanceTick(state);
    if (failureMode === "starved_stone_wall") state = starveStoneWall(state);
    if (failureMode === "blocked_population") {
      state = {
        ...state,
        houses: initial.houses.map((house) => ({
          ...house,
          breadStock: Math.max(2, house.breadStock),
          lastServicedTick: state.tick,
        })),
        population: 140,
      };
    }
    if (segmentMaterialGapCount(state) > 0) segmentMaterialGapTicks += 1;
    if (stoneSegmentsComplete(state)) stoneWallCompleteTick = state.tick;
  }

  return {
    hash: hashEconomyState(state),
    initialTick,
    maxStoneChainStallWithAccess: stoneChainAccessObserved
      ? maxStoneChainStallWithAccess
      : state.tick - initialTick,
    coinReachedTick,
    coin200ReachedTick,
    spendableStone400ReachedTick,
    era3ConditionsMetTick,
    proclamationTick,
    stoneWallCompleteTick,
    stoneWallCompletionElapsedTicks: proclamationTick === null || stoneWallCompleteTick === null
      ? null
      : stoneWallCompleteTick - proclamationTick,
    segmentMaterialGapTicks,
    proclaimedState,
    finalState: state,
  };
}
