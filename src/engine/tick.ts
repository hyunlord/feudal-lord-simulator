import { BALANCE } from '../content/balanceConfig';
import { feasibleDistributorDistance } from './distributorAccess';
import { recordTimberAvailability, runProduction } from './simulationProduction';
export { runProduction } from './simulationProduction';
import { refreshMaterialResult } from './autoplayMaterialLifecycle';
import type { MaterialActivity } from '../agents/materialActivity';
import { recordMaterialActivity } from './autoplayMaterialCycle';
import { beginMaterialObservation } from './autoplayMaterialObservation';
import { recordFoodMeals } from './autoplayFoodTransientMeals';
import { recordRecurringDelivery } from './autoplayRecurringDelivery';
import { advanceFoodFlow } from './autoplayFoodFlow';
import { householdServices } from "./householdServices";
import { updateSettlementProgress } from "./settlementProgress";
import { stepCarters, spawnCarters } from "../agents/delivery";
import { spawnDistributors, stepDistributors } from "../agents/roaming";
import type { RoamingDeliveryEvent, RoamingHouse, RoamingJunctionInput } from "../agents/roaming";
import { buildingFootprint } from "../geometry/buildingFootprint";
import {
  advanceConstructionSites,
  completeEligibleConstruction,
  recomputeConstructionStalls,
} from "./constructionLifecycle";
import { recordFoodObservationActivity, refreshFoodObservation } from "./autoplayFoodThroughput";
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
import type { GameState } from "./engine.types";

function toRoamingHouse(
  house: House,
  state: GameState,
): RoamingHouse | null {
  const building = state.buildings.find(({ id }) => id === house.buildingId);
  return building === undefined
    ? null
    : {
        ...buildingFootprint(building),
        buildingId: house.buildingId,
        tx: building.tx,
        ty: building.ty,
        breadStock: house.breadStock,
        residents: house.residents,
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

function deliveredBreadFromObservedGranary(
  before: readonly House[],
  deliveryEvents: readonly RoamingDeliveryEvent[],
  observation: GameState["autoplayFoodObservation"],
): { readonly deliveredBread: number; readonly deliveredHouseIds: readonly string[] } {
  if (observation === undefined) return { deliveredBread: 0, deliveredHouseIds: [] };
  const targets = observation.targetHouseIds;
  const emptyHomes = new Set(before.filter(house => house.breadStock === 0).map(house => house.buildingId));
  const credited = deliveryEvents.filter(event => event.homeBuildingId === observation.siteId && emptyHomes.has(event.houseBuildingId)
    && (targets === undefined || targets.includes(event.houseBuildingId)));
  return { deliveredBread: credited.reduce((total, event) => total + Math.max(0, event.amount), 0),
    deliveredHouseIds: credited.map(event => event.houseBuildingId) };
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

export function advanceSimulationSubstep(input: GameState): GameState {
  if (input.settlement?.outcome === "abandoned") return input;
  const flowing = advanceFoodFlow(input);
  const routePorts = createSimulationRoutePorts(flowing);
  const state = beginMaterialObservation(flowing, routePorts.delivery);
  const tick = state.tick + 1;
  const inventory = createDeliveryInventoryPort();
  const materialEvents: MaterialActivity[] = [];
  const materialActivity = (event: MaterialActivity) => materialEvents.push(event);
  let deliveredWheat = 0;
  const movedCarters = stepCarters({
    tick,
    buildings: state.buildings,
    constructionSites: state.constructionSites,
    walkers: state.walkers,
    buildingDelivery: event => {
      if (state.autoplayFoodObservation?.kind !== 'wheat_farm'
        || event.homeBuildingId !== state.autoplayFoodObservation.siteId || event.resource !== 'wheat') return;
      const destination = state.buildings.find(b => b.id === event.destinationBuildingId);
      if (destination?.kind === 'granary' && state.houses.some(h => h.residents > 0
        && (feasibleDistributorDistance(state, destination, h.buildingId) ?? Infinity) <= BALANCE.DISTRIBUTOR_RANGE)) deliveredWheat += event.amount;
    },
    treasuryTimber: state.treasuryTimber,
    inventory,
    routes: routePorts.delivery,
    ...(state.autoplayMaterialRecovery === undefined ? {} : { materialActivity }),
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
  const delivery = deliveredBreadFromObservedGranary(
    state.houses,
    movedDistributors.deliveryEvents,
    state.autoplayFoodObservation,
  );
  const materialMoved = recordMaterialActivity(state, materialEvents);
  materialEvents.length = 0;
  const observedDeliveryState = delivery.deliveredBread === 0 && deliveredWheat === 0
    ? materialMoved
    : recordFoodObservationActivity({ ...materialMoved, tick }, { ...delivery, deliveredWheat });
  // The opening population staffs this whole substep; new arrivals enter work next tick.
  const labour = allocateBuildingAndConstructionLabour(
    movedDistributors.buildings,
    movedCarters.constructionSites,
    state.population,
    { era: state.era, tick, eraProclaimedTick: state.eraProclaimedTick },
    (building) => buildingHasRequiredRoadAccess(state, building),
  );
  const servedHouses = mergeRoamingHouses(state.houses, movedDistributors.houses);
  const marketSettled = settleMarkets({
    ...state,
    tick,
    houses: [...servedHouses],
    buildings: [...labour.buildings],
    constructionSites: [...labour.constructionSites],
    walkers: [...movedDistributors.walkers],
    treasuryTimber: movedCarters.treasuryTimber,
    treasuryCoin: state.treasuryCoin,
  });
  const housing = updateHousing(servedHouses, marketSettled.buildings, tick, state.palisade,
    undefined, householdServices(marketSettled));
  const activeWalkers = movedDistributors.walkers.filter((walker) => walker.kind !== "builder");
  const walkers = [...activeWalkers, ...builderWalkersForSites(labour.constructionSites)];
  const produced = runProduction(recordFoodMeals(recordRecurringDelivery({
    ...observedDeliveryState,
    ...(marketSettled.autoplayFoodFlow === undefined ? {} : { autoplayFoodFlow: marketSettled.autoplayFoodFlow }),
    tick,
    buildings: [...marketSettled.buildings],
    constructionSites: [...labour.constructionSites],
    houses: [...housing.houses],
    walkers,
    population: housing.population,
    idleWorkers: labour.idleWorkers,
    treasuryTimber: movedCarters.treasuryTimber,
    treasuryCoin: marketSettled.treasuryCoin,
    ...(marketSettled.coinLedger === undefined ? {} : { coinLedger: marketSettled.coinLedger }),
  }, { servedHouses, deliveryEvents: movedDistributors.deliveryEvents }), servedHouses));
  const progressed = {
    ...produced,
    constructionSites: recomputeConstructionStalls({
      ...produced,
      constructionSites: advanceConstructionSites(produced),
    }, routePorts.delivery),
  };
  const spawnedCarters = spawnCarters({
    tick,
    buildings: progressed.buildings,
    constructionSites: progressed.constructionSites,
    walkers: progressed.walkers,
    treasuryTimber: progressed.treasuryTimber,
    inventory,
    routes: routePorts.delivery,
    ...(progressed.wallConstructionReserve === undefined ? {} : { wallConstructionReserve: progressed.wallConstructionReserve }),
    ...(progressed.wallConstructionPriority === undefined ? {} : { wallConstructionPriority: progressed.wallConstructionPriority }),
    ...(state.autoplayMaterialRecovery === undefined ? {} : { materialActivity }),
  });
  const spawnedDistributors = spawnDistributors({
    tick,
    buildings: spawnedCarters.buildings,
    walkers: spawnedCarters.walkers,
    routes: routePorts.roaming,
  });

  return recordMaterialActivity(recordTimberAvailability({
    ...progressed,
    buildings: [...spawnedDistributors.buildings],
    constructionSites: [...spawnedCarters.constructionSites],
    walkers: [...spawnedDistributors.walkers],
    treasuryTimber: spawnedCarters.treasuryTimber,
    treasuryCoin: progressed.treasuryCoin,
    pathCache: routePorts.getPathCache(),
  }), materialEvents);
}

export function advanceTick(state: GameState): GameState {
  if (state.settlement?.outcome === "abandoned") return state;
  return updateSettlementProgress(refreshMaterialResult(refreshFoodObservation(completeEligibleConstruction(
    advanceSimulationSubstep({ ...state, wallTick: state.wallTick + 1 }),
  ))));
}
