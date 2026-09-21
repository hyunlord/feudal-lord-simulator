import { BUILDING_CONFIG_BY_KIND } from '../content/buildingConfig';
import { BALANCE } from '../content/balanceConfig';
import { buildingFootprint } from '../geometry/buildingFootprint';
import { createSimulationRoutePorts } from './simulationPorts';
import type { GameState } from './engine.types';

export interface RecurringDeliveryRoute {
  readonly buildingId: string;
  readonly identity: string;
  readonly providers: readonly { readonly id: string; readonly edges: number }[];
}
export interface RecurringDeliveryRoutes {
  readonly layout: string;
  readonly revision: number;
  readonly homes: readonly RecurringDeliveryRoute[];
}
export function recurringDeliveryRoutes(state: GameState): RecurringDeliveryRoutes {
  const relevant = state.buildings.filter(b => b.kind === 'house' || b.kind === 'granary');
  const layout = relevant.map(b => `${b.id}:${b.kind}:${b.tx},${b.ty}:${JSON.stringify(buildingFootprint(b))}:${b.workers >= BUILDING_CONFIG_BY_KIND[b.kind].workersRequired}`).join('|');
  const previous = state.autoplayRecurringDelivery?.routes;
  if (previous?.layout === layout && previous.revision === state.roadRevision) return previous;
  const routes = createSimulationRoutePorts(state).roaming;
  const starts = relevant.filter(b => b.kind === 'granary').flatMap(b => {
    const start = routes.homePath(b.id)?.[0];
    return start === undefined ? [] : [{ id: b.id, start, ready: b.workers >= BUILDING_CONFIG_BY_KIND.granary.workersRequired }];
  });
  const homes = state.houses.flatMap(house => {
    const building = relevant.find(b => b.id === house.buildingId);
    if (building === undefined) return [];
    const home = { ...house, tx: building.tx, ty: building.ty, ...buildingFootprint(building) };
    const providers = starts.flatMap(provider => {
      const path = routes.servicePath?.(provider.start, home);
      return path == null || path.length - 1 > BALANCE.DISTRIBUTOR_RANGE ? [] : [{ id: provider.id, edges: path.length - 1 }];
    });
    return [{ buildingId: building.id,
      identity: `${building.tx},${building.ty}:${JSON.stringify(buildingFootprint(building))}:${providers.map(p => `${p.id}:${p.edges}:${starts.find(s => s.id === p.id)?.ready}`).join('|')}`, providers }];
  });
  return { layout, revision: state.roadRevision, homes };
}
