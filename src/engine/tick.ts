import { stepCarters, spawnCarters } from "../agents/delivery";
import { spawnDistributors, stepDistributors } from "../agents/roaming";
import type { RoamingHouse, RoamingJunctionInput } from "../agents/roaming";
import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import {
  advanceConstructionSites,
  completeEligibleConstruction,
  recomputeConstructionStalls,
} from "./constructionLifecycle";
import { stepProduction } from "../economy/production";
import { buildingHasRequiredRoadAccess } from "./roadAccess";
import { settleMarkets } from "./marketSettlement";
import { updateHousing } from "../population/housing";
import type { House } from "../population/population.types";
import {
  allocateBuildingAndConstructionLabour,
  builderWalkersForSites,
} from "../population/labour";
import { createMulberry32, createRoamingJunctionSeed } from "./prng";
import {
  createDeliveryInventoryPort,
  createSimulationRoutePorts,
} from "./simulationPorts";
import { forestHarvestsAfterProduction } from "./forestHarvests";
import type { GameState } from "./engine.types";

function toRoamingHouse(
  house: House,
  state: GameState,
): RoamingHouse | null {
  const building = state.buildings.find(({ id }) => id === house.buildingId);
  return building === undefined
    ? null
    : {
        buildingId: house.buildingId,
        tx: building.tx,
        ty: building.ty,
        breadStock: house.breadStock,
        lastServicedTick: house.lastServicedTick,
      };
}

function mergeRoamingHouses(
  houses: readonly House[],
  updates: readonly RoamingHouse[],
): readonly House[] {
  const byId = new Map(updates.map((house) => [house.buildingId, house]));
  return houses.map((house) => {
    const update = byId.get(house.buildingId);
    return update === undefined
      ? house
      : {
          ...house,
          breadStock: update.breadStock,
          lastServicedTick: update.lastServicedTick,
        };
  });
}

export function runProduction(state: GameState): GameState {
  let forestHarvests = state.forestHarvests ?? [];
  const buildings = state.buildings.map((building) => {
    if (!buildingHasRequiredRoadAccess(state, building)) return building;
    const step = stepProduction(building, BUILDING_CONFIG_BY_KIND[building.kind]);
    forestHarvests = forestHarvestsAfterProduction({
      state: { ...state, forestHarvests },
      building,
      produced: step.produced,
    });
    return step.building;
  });
  return {
    ...state,
    buildings,
    forestHarvests,
  };
}

function rngForState(state: GameState) {
  return (input: RoamingJunctionInput) =>
    createMulberry32(
      createRoamingJunctionSeed({
        stateSeed: state.seed,
        walkerId: input.walkerId,
        tick: input.tick,
        tx: input.tile.tx,
        ty: input.tile.ty,
        visitCount: input.visitCount,
      }),
    );
}

export function advanceSimulationSubstep(state: GameState): GameState {
  const tick = state.tick + 1;
  const inventory = createDeliveryInventoryPort();
  const routePorts = createSimulationRoutePorts(state);
  const movedCarters = stepCarters({
    tick,
    buildings: state.buildings,
    constructionSites: state.constructionSites,
    walkers: state.walkers,
    treasuryTimber: state.treasuryTimber,
    inventory,
    routes: routePorts.delivery,
  });
  const roamingHouses = state.houses.flatMap((house) => {
    const converted = toRoamingHouse(house, state);
    return converted === null ? [] : [converted];
  });
  const movedDistributors = stepDistributors({
    tick,
    buildings: movedCarters.buildings,
    walkers: movedCarters.walkers,
    houses: roamingHouses,
    routes: routePorts.roaming,
    rngForJunction: rngForState({ ...state, tick }),
  });
  const marketSettled = settleMarkets({
    ...state,
    tick,
    buildings: [...movedDistributors.buildings],
    walkers: [...movedDistributors.walkers],
    treasuryTimber: movedCarters.treasuryTimber,
    treasuryCoin: state.treasuryCoin,
  });
  const servedHouses = mergeRoamingHouses(state.houses, movedDistributors.houses);
  const housing = updateHousing(servedHouses, marketSettled.buildings, tick, state.palisade);
  const labour = allocateBuildingAndConstructionLabour(
    marketSettled.buildings,
    movedCarters.constructionSites,
    housing.population,
    { era: state.era, tick, eraProclaimedTick: state.eraProclaimedTick },
  );
  const activeWalkers = movedDistributors.walkers.filter((walker) => walker.kind !== "builder");
  const walkers = [...activeWalkers, ...builderWalkersForSites(labour.constructionSites)];
  const produced = runProduction({
    ...state,
    tick,
    buildings: [...labour.buildings],
    constructionSites: [...labour.constructionSites],
    houses: [...housing.houses],
    walkers,
    population: housing.population,
    idleWorkers: labour.idleWorkers,
    treasuryTimber: movedCarters.treasuryTimber,
    treasuryCoin: marketSettled.treasuryCoin,
  });
  const progressed = {
    ...produced,
    constructionSites: recomputeConstructionStalls({
      ...produced,
      constructionSites: advanceConstructionSites(produced),
    }),
  };
  const spawnedCarters = spawnCarters({
    tick,
    buildings: progressed.buildings,
    constructionSites: progressed.constructionSites,
    walkers: progressed.walkers,
    treasuryTimber: progressed.treasuryTimber,
    inventory,
    routes: routePorts.delivery,
  });
  const spawnedDistributors = spawnDistributors({
    tick,
    buildings: spawnedCarters.buildings,
    walkers: spawnedCarters.walkers,
    routes: routePorts.roaming,
  });

  return {
    ...progressed,
    buildings: [...spawnedDistributors.buildings],
    constructionSites: [...spawnedCarters.constructionSites],
    walkers: [...spawnedDistributors.walkers],
    treasuryTimber: spawnedCarters.treasuryTimber,
    treasuryCoin: progressed.treasuryCoin,
    pathCache: routePorts.getPathCache(),
  };
}

export function advanceTick(state: GameState): GameState {
  return completeEligibleConstruction(
    advanceSimulationSubstep({ ...state, wallTick: state.wallTick + 1 }),
  );
}
