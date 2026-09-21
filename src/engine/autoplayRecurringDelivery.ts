import { BALANCE } from '../content/balanceConfig';
import { BUILDING_CONFIG_BY_KIND } from '../content/buildingConfig';
import { HOUSE_FOOD_INTERVAL, houseFoodRation } from '../content/houseFoodConfig';
import { availableStock } from '../economy/storage';
import { buildingFootprint } from '../geometry/buildingFootprint';
import { houseIsStarving } from '../population/houseFood';
import type { House } from '../population/population.types';
import type { RoamingDeliveryEvent, RoamingHouse } from '../agents/roaming';
import type { GameState } from './engine.types';
import { recurringDeliveryRoutes, type RecurringDeliveryRoutes } from './autoplayRecurringDeliveryRoutes';

interface DeliveryWindow {
  readonly startedTick: number;
  readonly untilTick: number;
  readonly requested: number;
  readonly consumed: number;
  readonly delivered: number;
  readonly actionableMissed: number;
  readonly stockedStarvation: boolean;
  readonly starving: boolean;
}
interface DeliveryHome {
  readonly buildingId: string;
  readonly identity: string;
  readonly window: DeliveryWindow;
  readonly qualified: boolean;
  readonly deficientSince?: number;
  readonly attemptedSiteId?: string;
  readonly lastAttemptTick?: number;
}
export interface AutoplayRecurringDelivery {
  readonly tick: number;
  readonly routes: RecurringDeliveryRoutes;
  readonly homes: readonly DeliveryHome[];
}
function emptyWindow(tick: number, edges: number): DeliveryWindow {
  return { startedTick: tick, untilTick: tick + HOUSE_FOOD_INTERVAL + BALANCE.DISTRIBUTOR_INTERVAL
    + (2 * BALANCE.DISTRIBUTOR_RANGE + edges) * Math.ceil(1 / BALANCE.DISTRIBUTOR_SPEED),
  requested: 0, consumed: 0, delivered: 0, actionableMissed: 0, stockedStarvation: false, starving: false };
}
function stockedProviders(state: GameState, ids: readonly string[]): boolean {
  return state.buildings.some(b => ids.includes(b.id)
    && b.workers >= BUILDING_CONFIG_BY_KIND.granary.workersRequired && availableStock(b, 'bread') > 0);
}
export function recordRecurringDelivery(state: GameState, activity: {
  readonly servedHouses: readonly House[];
  readonly deliveryEvents: readonly RoamingDeliveryEvent[];
}): GameState {
  const previous = state.autoplayRecurringDelivery;
  if (previous?.tick === state.tick) return state;
  const rewind = previous !== undefined && previous.tick > state.tick;
  const routes = recurringDeliveryRoutes(state);
  const completeChain = ['wheat_farm', 'mill', 'granary'].every(kind => state.buildings.some(b => b.kind === kind));
  const homes = routes.homes.flatMap(route => {
    const house = state.houses.find(h => h.buildingId === route.buildingId);
    const served = activity.servedHouses.find(h => h.buildingId === route.buildingId);
    if (house === undefined || served === undefined) return [];
    const prior = rewind ? undefined : previous?.homes.find(h => h.buildingId === route.buildingId);
    const edges = Math.min(...route.providers.map(p => p.edges));
    if (!Number.isFinite(edges)) return prior === undefined ? [] : [{ ...prior, identity: route.identity, qualified: false, window: emptyWindow(state.tick, 0) }];
    const eligible = completeChain && house.hasWater && state.tick > (house.starvationGraceUntilTick ?? 0);
    if (prior === undefined && (!eligible || served.residents === 0)) return [];
    const start = prior === undefined || prior.identity !== route.identity || !eligible;
    let measurement = start ? emptyWindow(state.tick - 1, edges) : prior.window;
    const stocked = stockedProviders(state, route.providers.map(p => p.id));
    const requested = eligible && state.tick % HOUSE_FOOD_INTERVAL === 0 ? houseFoodRation(served) : 0;
    const consumed = Math.min(requested, served.breadStock);
    const starving = eligible && houseIsStarving(house, state.tick);
    measurement = { ...measurement, requested: measurement.requested + requested, consumed: measurement.consumed + consumed,
      delivered: measurement.delivered + activity.deliveryEvents.filter(e => e.houseBuildingId === house.buildingId).reduce((n, e) => n + e.amount, 0),
      actionableMissed: measurement.actionableMissed + (stocked ? requested - consumed : 0),
      stockedStarvation: measurement.stockedStarvation || stocked && starving,
      starving: measurement.starving || starving };
    let qualified = start ? false : prior.qualified;
    let deficientSince = prior?.deficientSince;
    let attemptedSiteId = prior?.attemptedSiteId;
    let lastAttemptTick = prior?.lastAttemptTick;
    const observation = state.autoplayFoodObservation;
    if (deficientSince !== undefined && observation?.kind === 'granary'
      && observation.targetHouseIds?.includes(house.buildingId) && observation.placedTick >= deficientSince
      && observation.placedTick !== lastAttemptTick) {
      attemptedSiteId = observation.siteId;
      lastAttemptTick = observation.placedTick;
    }
    if (eligible && state.tick >= measurement.untilTick) {
      qualified = measurement.actionableMissed > 0 && measurement.stockedStarvation;
      if (qualified) deficientSince ??= measurement.startedTick;
      const attemptPending = attemptedSiteId !== undefined && state.constructionSites.some(s => s.id === attemptedSiteId);
      if (measurement.requested > 0 && measurement.consumed === measurement.requested && !measurement.starving && !attemptPending) {
        deficientSince = undefined;
        attemptedSiteId = undefined;
      }
      measurement = emptyWindow(state.tick, edges);
    }
    return [{ buildingId: house.buildingId, identity: route.identity, qualified, window: measurement,
      ...(deficientSince === undefined ? {} : { deficientSince }),
      ...(attemptedSiteId === undefined ? {} : { attemptedSiteId }),
      ...(lastAttemptTick === undefined ? {} : { lastAttemptTick }) }];
  });
  return { ...state, autoplayRecurringDelivery: { tick: state.tick, routes, homes } };
}
export function recurringDeliveryHomes(state: GameState): readonly RoamingHouse[] {
  const observation = state.autoplayRecurringDelivery;
  if (observation === undefined || observation.tick > state.tick) return [];
  const routes = recurringDeliveryRoutes(state);
  return observation.homes.flatMap(entry => {
    if (!entry.qualified || entry.deficientSince === undefined || entry.attemptedSiteId !== undefined) return [];
    const route = routes.homes.find(h => h.buildingId === entry.buildingId);
    if (route === undefined || route.identity !== entry.identity || !stockedProviders(state, route.providers.map(p => p.id))) return [];
    const house = state.houses.find(h => h.buildingId === entry.buildingId);
    const building = state.buildings.find(b => b.id === entry.buildingId);
    return house === undefined || building === undefined ? [] : [{ ...house, tx: building.tx, ty: building.ty, ...buildingFootprint(building) }];
  });
}
