import type { GameState } from './engine.types';
import { marketRoadService } from './marketService';
import { allocateHouseServices, type ServiceAllocation } from '../population/serviceAllocation';

const cache = new WeakMap<GameState, ServiceAllocation>();

/** Derived only: no duplicate service state enters saves or tick mutations. */
export function householdServices(state: GameState): ServiceAllocation {
  const previous = cache.get(state);
  if (previous !== undefined) return previous;
  const allocation = allocateHouseServices({
    houses: state.houses, buildings: state.buildings, roadService: marketRoadService(state),
  });
  cache.set(state, allocation);
  return allocation;
}
