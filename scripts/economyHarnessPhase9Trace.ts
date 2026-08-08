import { BUILDING_CONFIG_BY_KIND, type Building } from "../src/content/buildingConfig";
import { canProclaimStoneTownEra, confirmStoneTownProclamation, evaluateEraRequirements } from "../src/engine/era";
import type { GameState, PalisadeSegment } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { buildingRoadAccessTiles } from "../src/engine/routing";
import { placementSpendableResource } from "../src/world/placement";
import { existingRoadComponent } from "../src/world/roadGraph";
import { hashEconomyState, sortedResources } from "./economyHarnessSerializer";
import {
  PHASE9_MAX_ERA3_REQUIREMENT_TICK,
  PHASE9_MAX_STONE_WALL_COMPLETION_TICKS,
  PHASE9_RUN_TICKS,
} from "./economyHarnessPhase9Scenario";

export interface Phase9RunTrace {
  readonly hash: string;
  readonly initialTick: number;
  readonly maxStoneChainStallWithAccess: number;
  readonly stoneChainAccessMissingTicks: number;
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
  const storehouse = buildingById(state, "phase9-storehouse-0");
  return quarry !== null &&
    masonry !== null &&
    storehouse !== null &&
    hasRockAccess(state, quarry) &&
    sameRoadComponent(state, quarry, storehouse) &&
    sameRoadComponent(state, masonry, storehouse);
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

function stoneSegmentsComplete(state: GameState): boolean {
  return state.palisade?.segments.every((segment) => segment.material === "stone") === true;
}

function segmentHasMaterial(segment: PalisadeSegment): boolean {
  return segment.material === "timber" || segment.material === "stone";
}

function segmentMaterialGapCount(state: GameState): number {
  return state.palisade?.segments.filter((segment) => !segmentHasMaterial(segment)).length ?? 0;
}

export function trackPhase9Run(initial: GameState): Phase9RunTrace {
  let state = initial;
  const initialTreasuryCoin = initial.treasuryCoin;
  const initialTick = state.tick;
  let maxStoneChainStallWithAccess = 0;
  let stoneChainAccessMissingTicks = stoneChainHasAccess(state) ? 0 : 1;
  let stoneChainStallWithAccess = 0;
  let coinReachedTick: number | null = null;
  let coin200ReachedTick: number | null = state.treasuryCoin >= 200 ? state.tick : null;
  let spendableStone400ReachedTick: number | null = placementSpendableResource(state, "stone") >= 400 ? state.tick : null;
  let era3ConditionsMetTick: number | null = allEraRequirementsMet(state) ? state.tick : null;
  let proclamationTick: number | null = null;
  let proclaimedState = state;
  let segmentMaterialGapTicks = segmentMaterialGapCount(state) > 0 ? 1 : 0;

  while (state.tick < PHASE9_RUN_TICKS && proclamationTick === null) {
    const previous = state;
    state = advanceTick(state);
    if (stoneChainHasAccess(state)) {
      stoneChainStallWithAccess = stoneChainChanged(previous, state) ? 0 : stoneChainStallWithAccess + 1;
      maxStoneChainStallWithAccess = Math.max(maxStoneChainStallWithAccess, stoneChainStallWithAccess);
    } else {
      stoneChainAccessMissingTicks += 1;
    }
    if (segmentMaterialGapCount(state) > 0) segmentMaterialGapTicks += 1;
    if (coinReachedTick === null && state.treasuryCoin > initialTreasuryCoin) coinReachedTick = state.tick;
    if (coin200ReachedTick === null && state.treasuryCoin >= 200) coin200ReachedTick = state.tick;
    if (spendableStone400ReachedTick === null && placementSpendableResource(state, "stone") >= 400) {
      spendableStone400ReachedTick = state.tick;
    }
    if (era3ConditionsMetTick === null && allEraRequirementsMet(state)) era3ConditionsMetTick = state.tick;
    if (
      era3ConditionsMetTick !== null &&
      era3ConditionsMetTick <= PHASE9_MAX_ERA3_REQUIREMENT_TICK &&
      canProclaimStoneTownEra(state)
    ) {
      state = confirmStoneTownProclamation(state);
      proclamationTick = state.eraProclaimedTick;
      proclaimedState = state;
    }
  }

  let stoneWallCompleteTick: number | null = stoneSegmentsComplete(state) ? state.tick : null;
  segmentMaterialGapTicks += segmentMaterialGapCount(state);
  for (let step = 0; step < PHASE9_MAX_STONE_WALL_COMPLETION_TICKS && stoneWallCompleteTick === null; step += 1) {
    state = advanceTick(state);
    if (segmentMaterialGapCount(state) > 0) segmentMaterialGapTicks += 1;
    if (coinReachedTick === null && state.treasuryCoin > initialTreasuryCoin) coinReachedTick = state.tick;
    if (coin200ReachedTick === null && state.treasuryCoin >= 200) coin200ReachedTick = state.tick;
    if (spendableStone400ReachedTick === null && placementSpendableResource(state, "stone") >= 400) {
      spendableStone400ReachedTick = state.tick;
    }
    if (stoneSegmentsComplete(state)) stoneWallCompleteTick = state.tick;
  }

  return {
    hash: hashEconomyState(state),
    initialTick,
    maxStoneChainStallWithAccess,
    stoneChainAccessMissingTicks,
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
