import { stepCarters, spawnCarters } from "../agents/delivery";
import { spawnDistributors, stepDistributors } from "../agents/roaming";
import type { RoamingHouse, RoamingJunctionInput } from "../agents/roaming";
import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import { stepProduction } from "../economy/production";
import { updateHousing } from "../population/housing";
import type { House } from "../population/population.types";
import { allocateBuildingLabour } from "../population/labour";
import { createMulberry32, createRoamingJunctionSeed } from "./prng";
import {
  createDeliveryInventoryPort,
  createSimulationRoutePorts,
} from "./simulationPorts";
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

function runProduction(state: GameState): GameState {
  return {
    ...state,
    buildings: state.buildings.map(
      (building) =>
        stepProduction(building, BUILDING_CONFIG_BY_KIND[building.kind]).building,
    ),
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

export function advanceTick(state: GameState): GameState {
  const tick = state.tick + 1;
  const inventory = createDeliveryInventoryPort();
  const routePorts = createSimulationRoutePorts(state);
  const movedCarters = stepCarters({
    tick,
    buildings: state.buildings,
    walkers: state.walkers,
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
  const servedHouses = mergeRoamingHouses(state.houses, movedDistributors.houses);
  const housing = updateHousing(servedHouses, movedDistributors.buildings, tick);
  const labour = allocateBuildingLabour(movedDistributors.buildings, housing.population);
  const produced = runProduction({
    ...state,
    tick,
    buildings: [...labour.buildings],
    houses: [...housing.houses],
    walkers: [...movedDistributors.walkers],
    population: housing.population,
    idleWorkers: labour.idleWorkers,
  });
  const spawnedCarters = spawnCarters({
    tick,
    buildings: produced.buildings,
    walkers: produced.walkers,
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
    ...produced,
    buildings: [...spawnedDistributors.buildings],
    walkers: [...spawnedDistributors.walkers],
    pathCache: routePorts.getPathCache(),
  };
}
