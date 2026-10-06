import type { Building } from '../../content/buildingConfig';
import type { GameState } from '../../engine/engine.types';
import { stateCalendar } from '../../engine/scenarioState';
import { boundaryHash, hashNumbers } from '../../world/boundary/boundaryGeometry';
import type { ArtEntry, ArtPoint, StockPileEntry } from './artContract';
import { createArtAdapters } from './artAdapters';
import type { ArtImageEnvironment } from './artImageLoader';
import type { ArtRegistry } from './artRegistry';
import { ART_REGISTRY } from './wave42Registry';

type StockState = Pick<GameState, 'seed' | 'tick' | 'scenarioId'>;
function isStockPile(entry: ArtEntry | null): entry is StockPileEntry {
  return entry?.kind === 'ground-prop' && entry.placement === 'stock-pile';
}
/** Only real positive inventory is a selector fact; the catalogue owns resource and building membership. */
export function createResourceStockPileArt(registry: ArtRegistry, environment?: ArtImageEnvironment) {
  const adapters = createArtAdapters(registry, environment);
  const resources = [...new Set(registry.entries('ground-prop').filter(isStockPile).map(entry => entry.resource))];
  const select = (state: StockState, building: Pick<Building, 'id' | 'kind' | 'inventory'>): StockPileEntry | null => {
    const seasons = ['spring', 'summer', 'autumn', 'winter'] as const;
    const season = seasons[stateCalendar(state).season];
    const seed = boundaryHash(hashNumbers(Array.from(building.id, character => character.charCodeAt(0))), state.seed, 31);
    for (const resource of resources) {
      const amount = Object.entries(building.inventory).find(([key]) => key === resource)?.[1] ?? 0;
      if (!(amount > 0)) continue;
      const entry = registry.select('ground-prop', 'stock-pile', { placement: 'stock-pile', buildingKind: building.kind, resource, season }, seed);
      if (isStockPile(entry) && entry.resource === resource) return entry;
    }
    return null;
  };
  const draw = (context: Parameters<typeof adapters.draw>[0], state: StockState, building: Building, at: ArtPoint): boolean => {
    const entry = select(state, building);
    return entry !== null && adapters.draw(context, entry.id, { at });
  };
  return { select, draw, loadSettled: adapters.loadSettled, placement: adapters.placement };
}
export const RESOURCE_STOCK_PILE_ART = createResourceStockPileArt(ART_REGISTRY);
