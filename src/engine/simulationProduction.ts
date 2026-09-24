import { recordTimberExpansionShortage } from './autoplayTimberRecovery';
import { recordFoodEfficiency } from './autoplayFoodEfficiency';
import { recordMaterialProduction } from './autoplayMaterialCycle';
import { materialRawSource } from './autoplayMaterialRoutes';
import { createSimulationRoutePorts } from './simulationPorts';
import { recordFoodFlow } from './autoplayFoodFlow';
import { recordFoodObservationActivity } from './autoplayFoodThroughput';
import { forestHarvestsAfterProduction } from './forestHarvests';
import { buildingHasRequiredRoadAccess } from './roadAccess';
import { BUILDING_CONFIG_BY_KIND } from '../content/buildingConfig';
import { productionOperation, stepProduction } from '../economy/production';
import { placementSpendableResource } from '../world/placement';
import type { GameState } from './engine.types';

export function runProduction(state: GameState): GameState {
  let forestHarvests = state.forestHarvests ?? [];
  let materialRecord = state.autoplayMaterialRecovery;
  const materialRoutes = materialRecord?.status === 'observing' ? createSimulationRoutePorts(state).delivery : undefined;
  let eligibleMillTicks = 0;
  let rawStarvedTicks = 0;
  let wheatConsumed = 0;
  let observedOutput = 0;
  let wheatProduced = 0;
  let farmFullTicks = 0;
  let farmReadyTicks = 0;
  let breadProduced = 0;
  let timberProduced = 0;
  const buildings = state.buildings.map((building) => {
    if (!buildingHasRequiredRoadAccess(state, building)) return building;
    if (building.kind === 'wheat_farm') {
      const operation = productionOperation(building, BUILDING_CONFIG_BY_KIND.wheat_farm);
      if (operation === 'output_full') farmFullTicks += 1;
      if (operation === 'working' || operation === 'output_full') farmReadyTicks += 1;
    }
    if (building.kind === 'mill' && building.workers >= BUILDING_CONFIG_BY_KIND.mill.workersRequired) {
      eligibleMillTicks += 1;
      if (productionOperation(building, BUILDING_CONFIG_BY_KIND.mill) === 'no_input') rawStarvedTicks += 1;
    }
    const step = stepProduction(building, BUILDING_CONFIG_BY_KIND[building.kind]);
    if (building.kind === 'masonry' && materialRecord !== undefined) {
      const operation = productionOperation(building, BUILDING_CONFIG_BY_KIND.masonry);
      const hauling = operation === 'no_input' && materialRoutes !== undefined
        && state.walkers.some(w => w.kind === 'carter' && w.homeBuildingId === building.id && w.cancellation === null)
        && materialRawSource(state, building, materialRoutes) !== null;
      materialRecord = recordMaterialProduction(materialRecord, building.id, step.produced === 'stone', operation === 'working', hauling);
    }
    if (step.produced === "wheat") wheatProduced += 1;
    if (building.kind === 'sawmill' && step.produced === 'timber') timberProduced += 1;
    if (step.produced === "bread") {
      breadProduced += 1;
      wheatConsumed += (building.inventory.wheat ?? 0) - (step.building.inventory.wheat ?? 0);
    }
    if (step.produced !== null && state.autoplayFoodObservation?.siteId === building.id) observedOutput += 1;
    forestHarvests = forestHarvestsAfterProduction({
      state: { ...state, forestHarvests },
      building,
      produced: step.produced,
    });
    return step.building;
  });
  const nextState = recordFoodEfficiency(recordFoodFlow({
    ...state,
    buildings,
    forestHarvests,
    timberProductionWindow: timberProductionWindow(state, timberProduced),
    ...(materialRecord === undefined ? {} : { autoplayMaterialRecovery: materialRecord }),
  }, { wheatProduced, breadProduced, farmFullTicks, farmReadyTicks }),
  { eligibleMillTicks, rawStarvedTicks, wheatConsumed }, true);
  return observedOutput === 0
    ? nextState
    : recordFoodObservationActivity(nextState, { outputProduced: observedOutput });
}

function timberProductionWindow(state: GameState, produced: number): NonNullable<GameState['timberProductionWindow']> {
  const startTick = Math.max(0, state.tick - 2399);
  const existing = state.timberProductionWindow?.productionTicks.filter(tick => tick >= startTick && tick <= state.tick) ?? [];
  const productionTicks = produced === 0 ? existing : [...existing, ...Array.from({ length: produced }, () => state.tick)];
  return {
    startTick,
    throughTick: state.tick,
    produced: productionTicks.length,
    productionTicks,
    ...(state.timberProductionWindow?.expansionShortageSinceTick === undefined ? {}
      : { expansionShortageSinceTick: state.timberProductionWindow.expansionShortageSinceTick }),
    ...(state.timberProductionWindow?.availableTimber === undefined
      ? {}
      : { availableTimber: state.timberProductionWindow.availableTimber }),
    ...(state.timberProductionWindow?.lastAvailableIncreaseTick === undefined
      ? {}
      : { lastAvailableIncreaseTick: state.timberProductionWindow.lastAvailableIncreaseTick }),
  };
}

export function recordTimberAvailability(input: GameState): GameState {
  const state = recordTimberExpansionShortage(input);
  const observation = state.timberProductionWindow;
  if (observation === undefined) return state;
  if (state.wallConstructionReserve?.resource !== 'timber' || state.wallConstructionPriority === 'priority') return state;
  const availableTimber = placementSpendableResource(state, 'timber');
  const lastAvailableIncreaseTick = observation.availableTimber === undefined || availableTimber > observation.availableTimber
    ? state.tick
    : observation.lastAvailableIncreaseTick ?? state.tick;
  return {
    ...state,
    timberProductionWindow: {
      ...observation,
      availableTimber,
      lastAvailableIncreaseTick,
    },
  };
}
