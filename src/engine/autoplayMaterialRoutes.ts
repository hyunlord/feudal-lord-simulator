import { fetchCandidate } from '../agents/deliveryBuildingCandidates';
import type { DeliveryRoutePort } from '../agents/deliveryTypes';
import { BUILDING_CONFIG_BY_KIND, type Building } from '../content/buildingConfig';
import { createDeliveryInventoryPort } from './simulationPorts';
import { buildingHasRequiredRoadAccess } from './roadAccess';
import type { GameState } from './engine.types';
export function materialRawSource(state: GameState, home: Building, routes: DeliveryRoutePort) {
  if (home.kind !== 'masonry' || home.workers < BUILDING_CONFIG_BY_KIND.masonry.workersRequired || !buildingHasRequiredRoadAccess(state, home)) return null;
  const source = fetchCandidate(home, 'stone_raw', state.buildings, createDeliveryInventoryPort(), routes);
  return source === null || source.amount < (BUILDING_CONFIG_BY_KIND.masonry.production?.inputPerOutput ?? Infinity) ? null : source;
}
