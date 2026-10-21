import type { ConstructionSite, ConstructionStall } from '../domain/constructionSite';
import type { GameState } from './engine.types';
import { createDeliveryInventoryPort, createSimulationRoutePorts } from './simulationPorts';

/**
 * STONE-1 ⓑ (lord mode, the user's ruling 2026-10-21): why a wall site stands, told apart from the reserve. A wall site
 * whose every reachable source sits at its reserve floor reads `reserve_held` (`wallReserveHeld`) — but when the
 * material lies in buildings no delivery route reaches, the wall waits for a route, not for the reserve:
 * `stock_unreachable`. Seed 32 (1326): its stone in three storehouses and a masonry outside the wall, the town's one gate
 * opening on the river, the one storehouse inside at its floor (DGX engine-SINK-diag-695396c). A reading for the screen —
 * the site's saved `stall` stays as it is (no saved field changes); the words are the screen's.
 */
export type WallStallCause = ConstructionStall | 'stock_unreachable';

export interface WallStockReach {
  readonly resource: 'timber' | 'stone';
  /** Stock in buildings a delivery route reaches (before the reserve floors). */
  readonly reachable: number;
  /** Stock in buildings no delivery route reaches. */
  readonly unreachable: number;
}

export function wallStockReach(state: GameState, site: ConstructionSite): WallStockReach | null {
  if (site.kind !== 'palisade_segment' && site.kind !== 'stone_wall_segment') return null;
  const resource = site.kind === 'palisade_segment' ? 'timber' : 'stone';
  const routes = createSimulationRoutePorts(state).delivery;
  const inventory = createDeliveryInventoryPort();
  const destination = { kind: 'construction_site' as const, siteId: site.id };
  let reachable = 0;
  let unreachable = 0;
  for (const building of state.buildings) {
    const available = inventory.availableStock(building, resource);
    if (available <= 0) continue;
    if (routes.fromBuildingToDestination(building.id, destination) === null) unreachable += available;
    else reachable += available;
  }
  return { resource, reachable, unreachable };
}

export function wallStallCause(state: GameState, site: ConstructionSite): WallStallCause {
  if (site.stall !== 'reserve_held' || state.agency === undefined) return site.stall;
  const reach = wallStockReach(state, site);
  return reach !== null && reach.unreachable > 0 ? 'stock_unreachable' : site.stall;
}
